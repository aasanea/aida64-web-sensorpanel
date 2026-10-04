"""
Network Telemetry & Process Monitoring Service.
Provides real-time per-process network usage tracking (Top 5 apps),
ping latency, active connection counts, and NIC metadata without requiring admin privileges.
"""

import asyncio
import re
import socket
import time
from typing import Any, Dict, List, Optional, Tuple
from loguru import logger
import psutil

from services.aida_service import read_aida_sensors, _get_float

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
        self._last_proc_io: Dict[int, Tuple[int, int]] = {}  # pid -> (read_bytes, write_bytes)
        self._last_sample_time: float = time.perf_counter()

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
        return self._snapshot

    async def _poll_loop(self) -> None:
        """Periodic sampling loop (runs every 1.5 seconds)."""
        while self._running:
            try:
                # 1. Measure Ping in thread pool
                ping_ms = await asyncio.to_thread(self._measure_ping)

                # 2. Measure per-process bandwidth in thread pool
                top_procs, active_conns = await asyncio.to_thread(self._sample_processes)

                # 3. Read NIC & IP details from AIDA64
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
                }
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
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(0.6)
                t0 = time.perf_counter()
                s.connect((host, port))
                lat = (time.perf_counter() - t0) * 1000.0
                s.close()
                return round(lat, 1)
            except Exception:
                continue
        return None

    def _sample_processes(self) -> Tuple[List[Dict[str, Any]], int]:
        """
        Samples active internet processes and calculates per-second transfer rates.
        Groups multiple processes of the same application.
        """
        now = time.perf_counter()
        dt = max(0.2, now - self._last_sample_time)
        self._last_sample_time = now

        # Identify all active established connections with remote endpoints
        active_pids: Dict[int, int] = {}
        total_active_connections = 0

        try:
            conns = psutil.net_connections(kind="inet")
            for c in conns:
                if c.status == "ESTABLISHED" and c.pid and c.raddr:
                    r_ip = c.raddr.ip
                    # Filter out local loopback & broadcast
                    if not r_ip.startswith("127.") and r_ip != "::1" and r_ip != "0.0.0.0":
                        total_active_connections += 1
                        active_pids[c.pid] = active_pids.get(c.pid, 0) + 1
        except Exception as e:
            logger.debug(f"Could not read net_connections: {e}")

        current_io: Dict[int, Tuple[int, int]] = {}
        proc_names: Dict[int, str] = {}

        for pid in active_pids:
            try:
                p = psutil.Process(pid)
                proc_names[pid] = p.name()
                io = p.io_counters()
                if io:
                    current_io[pid] = (io.read_bytes, io.write_bytes)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

        # Aggregate bandwidth by application executable name
        app_aggregates: Dict[str, Dict[str, Any]] = {}

        for pid, (r2, w2) in current_io.items():
            raw_name = proc_names.get(pid, "Unknown")
            conns_count = active_pids.get(pid, 1)

            dl_bytes = 0
            ul_bytes = 0
            if pid in self._last_proc_io:
                r1, w1 = self._last_proc_io[pid]
                if r2 >= r1:
                    dl_bytes = r2 - r1
                if w2 >= w1:
                    ul_bytes = w2 - w1

            key = raw_name.lower()
            if key not in app_aggregates:
                app_aggregates[key] = {
                    "raw_name": raw_name,
                    "dl_bytes": 0,
                    "ul_bytes": 0,
                    "connections": 0,
                }
            app_aggregates[key]["dl_bytes"] += dl_bytes
            app_aggregates[key]["ul_bytes"] += ul_bytes
            app_aggregates[key]["connections"] += conns_count

        self._last_proc_io = current_io

        # Format and resolve friendly names and rates
        proc_list: List[Dict[str, Any]] = []
        for key, info in app_aggregates.items():
            dl_rate_kbps = round((info["dl_bytes"] / dt) / 1024.0, 1)
            ul_rate_kbps = round((info["ul_bytes"] / dt) / 1024.0, 1)
            total_rate_kbps = round(dl_rate_kbps + ul_rate_kbps, 1)

            raw_name = info["raw_name"]
            friendly_name, icon = KNOWN_APPS.get(key, (raw_name.replace(".exe", "").capitalize(), "🌐"))

            proc_list.append({
                "name": friendly_name,
                "raw_name": raw_name,
                "dl_kbps": dl_rate_kbps,
                "ul_kbps": ul_rate_kbps,
                "total_kbps": total_rate_kbps,
                "connections": info["connections"],
                "icon": icon,
            })

        # Sort primarily by total bandwidth; if all are 0, sort by number of active connections
        proc_list.sort(key=lambda x: (x["total_kbps"], x["connections"]), reverse=True)

        return proc_list[:5], total_active_connections

    def _extract_nic_metadata(self) -> Dict[str, Any]:
        """Extracts NIC connection speed, total downloaded/uploaded MB/GB, and IPs."""
        sensors = read_aida_sensors()

        # Find best active NIC
        best_speed: Optional[float] = None
        best_tot_dl: Optional[float] = None
        best_tot_ul: Optional[float] = None
        highest_activity = -1.0

        for k in sensors:
            m = re.match(r"^SNIC(\d+)DLRATE$", k)
            if m:
                idx = m.group(1)
                dl_r = _get_float(sensors, f"SNIC{idx}DLRATE") or 0.0
                ul_r = _get_float(sensors, f"SNIC{idx}ULRATE") or 0.0
                tot_dl = _get_float(sensors, f"SNIC{idx}TOTDL")  # in MB
                tot_ul = _get_float(sensors, f"SNIC{idx}TOTUL")  # in MB
                spd = _get_float(sensors, f"SNIC{idx}CONNSPD")  # in Mbps

                activity = dl_r + ul_r
                if (tot_dl or 0.0) + (tot_ul or 0.0) > 0 and activity >= highest_activity:
                    highest_activity = activity
                    best_speed = spd
                    best_tot_dl = tot_dl
                    best_tot_ul = tot_ul

        local_ip_val = sensors.get("SPRIIPADDR", {}).get("value")
        ext_ip_val = sensors.get("SEXTIPADDR", {}).get("value")

        # Fallback for local IP if AIDA64 returns host or empty
        local_ip = str(local_ip_val).strip() if local_ip_val else None
        if not local_ip or local_ip.startswith("127.") or local_ip.startswith("172.31."):
            # Detect actual default route LAN IP
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("192.168.3.1", 80))
                detected_ip = s.getsockname()[0]
                s.close()
                if detected_ip and not detected_ip.startswith("127."):
                    local_ip = detected_ip
            except Exception:
                pass

        ext_ip = str(ext_ip_val).strip() if ext_ip_val else None

        tot_dl_gb = round(best_tot_dl / 1024.0, 2) if best_tot_dl is not None else None
        tot_ul_gb = round(best_tot_ul / 1024.0, 2) if best_tot_ul is not None else None

        return {
            "local_ip": local_ip,
            "ext_ip": ext_ip,
            "link_speed": best_speed,
            "total_dl_gb": tot_dl_gb,
            "total_ul_gb": tot_ul_gb,
        }
