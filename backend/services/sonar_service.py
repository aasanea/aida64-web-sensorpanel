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
import math
from services.telemetry_contract import source_meta
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
        self._data.update({"sonar_mode": None, "sonar_channels": None, "sonar_profiles": None})
        self._observed_at = 0.0
        self._mode_checked_at = 0.0
        self._sonar_base_url: Optional[str] = None
        self._last_discovery_attempt: float = 0.0
        self._running: bool = False
        self._task: Optional[asyncio.Task] = None
        self._session_devices = []
        self._meter_routes = {}
        self._routes_observed_at = 0.0

    @classmethod
    def get_instance(cls) -> "SonarService":
        if cls._instance is None:
            cls._instance = SonarService()
        return cls._instance

    def get_snapshot(self) -> Dict[str, Any]:
        """Returns the latest audio & mic telemetry snapshot."""
        if self._observed_at and time.time() - self._observed_at > 2:
            self._clear()
        result = dict(self._data)
        result["sonar_source"] = source_meta("SteelSeries Sonar", self._observed_at, 2, available=self._data["sonar_connected"])
        return result

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

    def _clear(self):
        self._data = {key: False if key == "sonar_connected" else None for key in self._data}
        self._observed_at = 0.0
        self._mode_checked_at = 0.0
        self._session_devices = []
        self._meter_routes = {}
        self._routes_observed_at = 0.0

    def get_meter_routes(self):
        if not self._data.get('sonar_connected') or time.time() - self._routes_observed_at > 2:
            return {}
        return self._meter_routes

    @staticmethod
    def select_meter_routes(devices, redirections, mode):
        active = {device['id']: {'id': device['id'], 'name': device.get('friendlyName', 'Unknown endpoint'), 'flow': device.get('dataFlow')} for device in devices if device.get('state') == 'active' and device.get('id')}
        virtual_mics = [device for device in devices if device.get('state') == 'active' and device.get('role') == 'chatCapture' and device.get('dataFlow') == 'capture' and device.get('isVad')]
        routes = {'mic': active.get(virtual_mics[0]['id']) if len(virtual_mics) == 1 else None, 'input': None, 'monitoring': None, 'streaming': None}
        if mode == 'stream':
            stream_inputs = [d for d in devices if d.get('state') == 'active' and d.get('role') == 'stream' and d.get('dataFlow') == 'capture' and d.get('isVad')]
            routes['stream_input'] = active.get(stream_inputs[0]['id']) if len(stream_inputs) == 1 else None
            for route in redirections:
                if route.get('isRunning'):
                    key = {'mic': 'input', 'monitoring': 'monitoring', 'streaming': 'streaming'}.get(route.get('streamRedirectionId'))
                    if key:
                        routes[key] = active.get(route.get('deviceId'))
        else:
            outputs = {route.get('deviceId') for route in redirections if route.get('isRunning') and route.get('id') != 'mic'}
            if len(outputs) == 1:
                routes['monitoring'] = active.get(outputs.pop())
            mic = next((route for route in redirections if route.get('id') == 'mic' and route.get('isRunning')), {})
            routes['input'] = active.get(mic.get('deviceId'))
        for key, device in routes.items():
            if device and device['flow'] != ('capture' if key in ('mic', 'input', 'stream_input') else 'render'):
                routes[key] = None
        return routes

    def get_session_devices(self):
        return self._session_devices if time.time() - self._routes_observed_at <= 2 else []

    async def _fetch_meter_routes(self, client, mode):
        try:
            devices, routes = await asyncio.gather(client.get(f'{self._sonar_base_url}/audioDevices', timeout=0.5), client.get(f'{self._sonar_base_url}/{"streamRedirections" if mode == "stream" else "classicRedirections"}', timeout=0.5))
            devices.raise_for_status()
            routes.raise_for_status()
            self._session_devices = [d for d in devices.json() if d.get("state")=="active" and d.get("dataFlow")=="render"]
            self._meter_routes = self.select_meter_routes(devices.json(), routes.json(), mode)
            self._routes_observed_at = time.time()
        except (httpx.HTTPError, ValueError, TypeError, KeyError):
            self._session_devices = []
            self._meter_routes = {}
            self._routes_observed_at = time.time()

    @staticmethod
    def _channel(raw):
        raw = raw if isinstance(raw, dict) else {}
        volume = raw.get("volume")
        valid = isinstance(volume, (int, float)) and not isinstance(volume, bool) and math.isfinite(volume) and 0 <= volume <= 1
        muted = raw.get("muted")
        return {"volume": round(volume * 100, 1) if valid else None, "muted": muted if isinstance(muted, bool) else None}

    async def _fetch_volume_settings(self, client: httpx.AsyncClient) -> bool:
        if not self._sonar_base_url:
            self._sonar_base_url = await self._discover_sonar_url(client)
            if not self._sonar_base_url:
                self._clear()
                return False
        try:
            mode = self._data.get("sonar_mode")
            if not mode or time.time() - self._mode_checked_at >= 1:
                response = await client.get(f"{self._sonar_base_url}/mode", timeout=0.5)
                response.raise_for_status()
                mode = response.json()
                if mode not in ("classic", "stream"):
                    raise ValueError("Unsupported Sonar mode")
                self._mode_checked_at = time.time()
            endpoint = "streamer" if mode == "stream" else "classic"
            response = await client.get(f"{self._sonar_base_url}/volumeSettings/{endpoint}", timeout=0.5)
            response.raise_for_status()
            raw = response.json()
            channels = {}
            snapshot = {key: None for key in self._data}
            for key, device in {"master": None, "game": "game", "chat": "chatRender", "media": "media", "aux": "aux", "mic": "chatCapture"}.items():
                item = raw.get("masters", {}) if device is None else raw.get("devices", {}).get(device, {})
                if mode == "stream":
                    streams = item.get("stream", {})
                    channel = {path: self._channel(streams.get(path)) for path in ("monitoring", "streaming")}
                    canonical = channel["monitoring"]
                else:
                    canonical = self._channel(item.get("classic"))
                    channel = {"classic": canonical}
                channels[key] = channel
                snapshot[f"audio_{key}_volume"] = canonical["volume"]
                snapshot[f"audio_{key}_muted"] = canonical["muted"]
            snapshot.update(sonar_connected=True, sonar_mode=mode, sonar_channels=channels)
            if self._data.get('sonar_mode') != mode:
                self._session_devices = []
                self._meter_routes = {}
                self._routes_observed_at = 0.0
            # Publish a complete snapshot, never a mixture of two modes.
            self._data = snapshot
            self._observed_at = time.time()
            return True
        except Exception as error:
            logger.debug(f"Sonar polling error (will rediscover): {error}")
            self._sonar_base_url = None
            self._clear()
            return False

    async def _poll_loop(self) -> None:
        """Background loop polling Sonar every 250ms."""
        # Using verify=False because SteelSeries GG uses a local self-signed certificate
        async with httpx.AsyncClient(verify=False) as client:
            while self._running:
                try:
                    await self._fetch_volume_settings(client)
                    if self._data.get('sonar_connected') and time.time() - self._routes_observed_at >= 1:
                        await self._fetch_meter_routes(client, self._data['sonar_mode'])
                    await asyncio.sleep(0.25)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.debug(f"Unexpected error in Sonar loop: {e}")
                    await asyncio.sleep(1.0)
