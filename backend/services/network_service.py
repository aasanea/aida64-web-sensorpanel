"""
Network Telemetry & Process Monitoring Service.
Provides measured NIC rates and per-process connection counts (Top 5 apps),
ping latency, active connection counts, and NIC metadata without requiring admin privileges.
"""

import asyncio
import re
import socket
import time
from typing import Any, Dict, List, Optional, Tuple
from loguru import logger
import psutil

from services.telemetry_contract import source_meta

KNOWN_APPS: Dict[str, Tuple[str, str]] = {
    "msedge.exe": ("Microsoft Edge", "🌐"),
    "chrome.exe": ("Google Chrome", "🌐"),
    "firefox.exe": ("Mozilla Firefox", "🦊"),
    "brave.exe": ("Brave Browser", "🦁"),
    "opera.exe": ("Opera", "⭕"),
    "discord.exe": ("Discord", "💬"),
    "telegram.exe": ("Telegram", "✈️"),
    "whatsapp.exe": ("WhatsApp", "📱"),
    "steam.exe": ("Steam Client", "🎮"),
    "steamwebhelper.exe": ("Steam Client", "🎮"),
    "spotify.exe": ("Spotify", "🎵"),
    "chatgpt.exe": ("ChatGPT", "🤖"),
    "thunderbird.exe": ("Thunderbird Mail", "✉️"),
    "code.exe": ("VS Code", "💻"),
    "python.exe": ("Python Service", "🐍"),
    "pythonw.exe": ("Python Service", "🐍"),
    "node.exe": ("Node.js Runtime", "🟢"),
    "epicgameslauncher.exe": ("Epic Games", "🎯"),
    "comet.exe": ("Comet Browser", "☄️"),
    "language_server.exe": ("Code AI Assistant", "⚡"),
    "aida64panel.exe": ("AIDA64 Host", "📊"),
    "aida64.exe": ("AIDA64", "⚙️"),
    "tailscaled.exe": ("Tailscale VPN", "🔒"),
    "googledrivefs.exe": ("Google Drive", "📁"),
    "onedrive.exe": ("OneDrive", "☁️"),
    "dropbox.exe": ("Dropbox", "📦"),
    "qbittorrent.exe": ("qBittorrent", "📥"),
    "idman.exe": ("IDM Downloader", "⬇️"),
    "svchost.exe": ("Windows Services", "🪟"),
    "system": ("Windows Kernel", "🪟"),
    "jellyfin.exe": ("Jellyfin Media", "🎬"),
    "obs64.exe": ("OBS Studio", "🎥"),
    "steelseriesengine.exe": ("SteelSeries GG", "🎧"),
    "steelseriessonar.exe": ("SteelSeries Sonar", "🔊"),
}


class NetworkService:
    """Singleton service for real-time network process tracking and latency telemetry."""

    _instance: Optional["NetworkService"] = None

    def __init__(self):
        self._running: bool = False
        self._worker_task: Optional[asyncio.Task] = None

        self._observed_at = 0.0
        self._last_nic = None
        self._session_nic = None
        self._snapshot: Dict[str, Any] = {
            "network_top_processes": [],
            "network_active_conns": 0,
            "network_local_ip": None,
            "network_ext_ip": None,
            "network_link_speed_mbps": None,
            "network_total_dl_gb": None,
            "network_total_ul_gb": None,
            "network_ping_ms": None,
        }

    @classmethod
    def get_instance(cls) -> "NetworkService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def start(self) -> None:
        """Starts background polling worker."""
        if self._running:
            return
        self._running = True
        self._worker_task = asyncio.create_task(self._poll_loop())
        logger.info("NetworkProcessService started successfully.")

    async def stop(self) -> None:
        """Stops background polling worker."""
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None
        logger.info("NetworkProcessService stopped.")

    def get_snapshot(self) -> Dict[str, Any]:
        """Returns the latest network telemetry and top processes snapshot."""
        snapshot = dict(self._snapshot)
        if not self._observed_at or time.time() - self._observed_at > 5:
            snapshot = {key: None for key in snapshot}
        snapshot["network_source"] = source_meta("Windows selected route / psutil", self._observed_at, 5, available=bool(snapshot.get("network_interface")))
        snapshot["network_process_measurement"] = "connections_only"
        return snapshot

    async def _poll_loop(self) -> None:
        """Periodic sampling loop (runs every 1.5 seconds)."""
        while self._running:
            try:
                # 1. Measure Ping in thread pool
                ping_ms = await asyncio.to_thread(self._measure_ping)

                # 2. Count established per-process connections
                top_procs, active_conns = await asyncio.to_thread(self._sample_processes)

                # 3. Read the route-selected Windows NIC
                nic_info = await asyncio.to_thread(self._extract_nic_metadata)

                # 4. Update atomic snapshot
                self._snapshot = {
                    "network_top_processes": top_procs,
                    "network_active_conns": active_conns,
                    "network_local_ip": nic_info.get("local_ip"),
                    "network_ext_ip": nic_info.get("ext_ip"),
                    "network_link_speed_mbps": nic_info.get("link_speed"),
                    "network_total_dl_gb": nic_info.get("total_dl_gb"),
                    "network_total_ul_gb": nic_info.get("total_ul_gb"),
                    "network_ping_ms": ping_ms,
                    "network_download_mbps": nic_info.get("download_mbps"),
                    "network_upload_mbps": nic_info.get("upload_mbps"),
                    "network_interface": nic_info.get("interface"),
                }
                self._observed_at = time.time()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug(f"Error in network polling cycle: {e}")

            await asyncio.sleep(1.5)

    def _measure_ping(self) -> Optional[float]:
        """Measures TCP connect latency to reliable DNS endpoint without admin rights."""
        hosts = [("1.1.1.1", 53), ("8.8.8.8", 53)]
        for host, port in hosts:
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
                    connection.settimeout(0.6)
                    t0 = time.perf_counter()
                    connection.connect((host, port))
                    return round((time.perf_counter() - t0) * 1000.0, 1)
            except Exception:
                continue
        return None

    def _sample_processes(self):
        """Connections are measured. General process I/O is NOT network bandwidth."""
        counts = {}
        try:
            for connection in psutil.net_connections(kind="inet"):
                if connection.status == "ESTABLISHED" and connection.pid and connection.raddr and connection.raddr.ip not in ("::1", "0.0.0.0") and not connection.raddr.ip.startswith("127."):
                    counts[connection.pid] = counts.get(connection.pid, 0) + 1
        except (psutil.AccessDenied, OSError):
            return None, None
        apps = {}
        for pid, count in counts.items():
            try:
                raw_name = psutil.Process(pid).name()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
            key = raw_name.lower()
            if key not in apps:
                name, icon = KNOWN_APPS.get(key, (raw_name.removesuffix(".exe"), "🌐"))
                apps[key] = {"name": name, "raw_name": raw_name, "icon": icon, "connections": 0, "dl_kbps": None, "ul_kbps": None, "total_kbps": None, "measurement": "connections_only"}
            apps[key]["connections"] += count
        return sorted(apps.values(), key=lambda app: app["connections"], reverse=True)[:5], sum(counts.values())

    def _extract_nic_metadata(self):
        """All rate, address, speed and totals refer to the same route-selected NIC."""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as route:
                route.connect(("1.1.1.1", 53))
                local_ip = route.getsockname()[0]
            interfaces = psutil.net_if_addrs()
            name = next((name for name, addresses in interfaces.items() if any(address.family == socket.AF_INET and address.address == local_ip for address in addresses)), None)
            counters = psutil.net_io_counters(pernic=True).get(name)
            stats = psutil.net_if_stats().get(name)
            if not counters or not stats or not stats.isup:
                self._last_nic = None
                return {}
            now = time.perf_counter()
            download = upload = None
            if self._last_nic and self._last_nic[0] == name:
                _, previous_time, previous_rx, previous_tx = self._last_nic
                elapsed = now - previous_time
                if elapsed > 0 and counters.bytes_recv >= previous_rx and counters.bytes_sent >= previous_tx:
                    download = round((counters.bytes_recv - previous_rx) * 8 / elapsed / 1_000_000, 3)
                    upload = round((counters.bytes_sent - previous_tx) * 8 / elapsed / 1_000_000, 3)
            self._last_nic = (name, now, counters.bytes_recv, counters.bytes_sent)
            if not self._session_nic or self._session_nic[0] != name or counters.bytes_recv < self._session_nic[1] or counters.bytes_sent < self._session_nic[2]:
                self._session_nic = (name, counters.bytes_recv, counters.bytes_sent)
            return {"interface": name, "local_ip": local_ip, "ext_ip": None, "link_speed": stats.speed if stats.speed > 0 else None,
                    "download_mbps": download, "upload_mbps": upload,
                    "total_dl_gb": round((counters.bytes_recv-self._session_nic[1])/1024**3, 3),
                    "total_ul_gb": round((counters.bytes_sent-self._session_nic[2])/1024**3, 3)}
        except (OSError, StopIteration):
            self._last_nic = None
            return {}
