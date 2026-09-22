"""
SteelSeries GG Sonar Audio Service.
Dynamically discovers Sonar local port via coreProps.json,
fetches live volume settings and microphone mute status,
and provides non-blocking telemetry to the dashboard.
"""

import os
import json
import time
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional
import httpx
from loguru import logger

# Possible locations for SteelSeries coreProps.json
CORE_PROPS_PATHS = [
    Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData")) / "SteelSeries" / "GG" / "coreProps.json",
    Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData")) / "SteelSeries" / "SteelSeries Engine 3" / "coreProps.json",
]


class SonarService:
    _instance: Optional["SonarService"] = None

    def __init__(self):
        self._data: Dict[str, Any] = {
            "sonar_connected": False,
            "audio_mic_muted": None,
            "audio_mic_volume": None,
            "audio_master_volume": None,
            "audio_master_muted": None,
            "audio_game_volume": None,
            "audio_game_muted": None,
            "audio_chat_volume": None,
            "audio_chat_muted": None,
            "audio_media_volume": None,
            "audio_media_muted": None,
            "audio_aux_volume": None,
            "audio_aux_muted": None,
        }
        self._sonar_base_url: Optional[str] = None
        self._last_discovery_attempt: float = 0.0
        self._running: bool = False
        self._task: Optional[asyncio.Task] = None

    @classmethod
    def get_instance(cls) -> "SonarService":
        if cls._instance is None:
            cls._instance = SonarService()
        return cls._instance

    def get_snapshot(self) -> Dict[str, Any]:
        """Returns the latest audio & mic telemetry snapshot."""
        return dict(self._data)

    async def start(self) -> None:
        """Starts the background polling worker."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("Sonar audio background service started")

    async def stop(self) -> None:
        """Stops the background polling worker."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("Sonar audio background service stopped")

    async def _discover_sonar_url(self, client: httpx.AsyncClient) -> Optional[str]:
        """Discovers the dynamic webServerAddress of Sonar via coreProps.json."""
        now = time.time()
        # Rate limit discovery attempts to once every 3 seconds to avoid disk/network thrashing
        if now - self._last_discovery_attempt < 3.0:
            return None
        self._last_discovery_attempt = now

        target_path: Optional[Path] = None
        for p in CORE_PROPS_PATHS:
            if p.exists():
                target_path = p
                break

        if not target_path:
            return None

        try:
            content = target_path.read_text(encoding="utf-8")
            props = json.loads(content)
            gg_address = props.get("ggEncryptedAddress")
            if not gg_address:
                return None

            url = f"https://{gg_address}/subApps"
            resp = await client.get(url, timeout=0.5)
            if resp.status_code == 200:
                subapps_data = resp.json()
                sonar_meta = (
                    subapps_data.get("subApps", {})
                    .get("sonar", {})
                    .get("metadata", {})
                )
                web_addr = sonar_meta.get("webServerAddress")
                if web_addr:
                    logger.debug(f"Discovered dynamic Sonar webServerAddress: {web_addr}")
                    return web_addr.rstrip("/")
        except Exception as e:
            logger.debug(f"Sonar port discovery check: {e}")

        return None

    async def _fetch_volume_settings(self, client: httpx.AsyncClient) -> bool:
        """Queries Sonar volumeSettings/classic endpoint and parses channel levels."""
        if not self._sonar_base_url:
            self._sonar_base_url = await self._discover_sonar_url(client)
            if not self._sonar_base_url:
                self._data["sonar_connected"] = False
                return False

        try:
            url = f"{self._sonar_base_url}/volumeSettings/classic"
            resp = await client.get(url, timeout=0.25)
            if resp.status_code != 200:
                self._sonar_base_url = None
                self._data["sonar_connected"] = False
                return False

            raw = resp.json()
            masters = raw.get("masters", {}).get("classic", {})
            devices = raw.get("devices", {})

            # Master channel
            master_vol = masters.get("volume")
            master_muted = masters.get("muted")
            self._data["audio_master_volume"] = (
                round(master_vol * 100.0, 1) if isinstance(master_vol, (int, float)) else None
            )
            self._data["audio_master_muted"] = bool(master_muted) if master_muted is not None else False

            # Microphone (chatCapture)
            mic = devices.get("chatCapture", {}).get("classic", {})
            mic_vol = mic.get("volume")
            mic_muted = mic.get("muted")
            self._data["audio_mic_volume"] = (
                round(mic_vol * 100.0, 1) if isinstance(mic_vol, (int, float)) else None
            )
            self._data["audio_mic_muted"] = bool(mic_muted) if mic_muted is not None else False

            # Game channel
            game = devices.get("game", {}).get("classic", {})
            game_vol = game.get("volume")
            self._data["audio_game_volume"] = (
                round(game_vol * 100.0, 1) if isinstance(game_vol, (int, float)) else None
            )
            self._data["audio_game_muted"] = bool(game.get("muted", False))

            # Chat Render channel
            chat = devices.get("chatRender", {}).get("classic", {})
            chat_vol = chat.get("volume")
            self._data["audio_chat_volume"] = (
                round(chat_vol * 100.0, 1) if isinstance(chat_vol, (int, float)) else None
            )
            self._data["audio_chat_muted"] = bool(chat.get("muted", False))

            # Media channel
            media = devices.get("media", {}).get("classic", {})
            media_vol = media.get("volume")
            self._data["audio_media_volume"] = (
                round(media_vol * 100.0, 1) if isinstance(media_vol, (int, float)) else None
            )
            self._data["audio_media_muted"] = bool(media.get("muted", False))

            # Aux channel
            aux = devices.get("aux", {}).get("classic", {})
            aux_vol = aux.get("volume")
            self._data["audio_aux_volume"] = (
                round(aux_vol * 100.0, 1) if isinstance(aux_vol, (int, float)) else None
            )
            self._data["audio_aux_muted"] = bool(aux.get("muted", False))

            self._data["sonar_connected"] = True
            return True

        except Exception as e:
            logger.debug(f"Sonar polling error (will retry/rediscover): {e}")
            self._sonar_base_url = None
            self._data["sonar_connected"] = False
            return False

    async def _poll_loop(self) -> None:
        """Background loop polling Sonar every 250ms."""
        # Using verify=False because SteelSeries GG uses a local self-signed certificate
        async with httpx.AsyncClient(verify=False) as client:
            while self._running:
                try:
                    await self._fetch_volume_settings(client)
                    await asyncio.sleep(0.25)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.debug(f"Unexpected error in Sonar loop: {e}")
                    await asyncio.sleep(1.0)
