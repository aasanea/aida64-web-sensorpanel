"""
Auto-Updater Service for AIDA64 Glassmorphism Dashboard.
Provides:
1. Version and system telemetry (current version, repository, OS, Python version).
2. Live GitHub release queries with semver comparison.
3. In-memory caching with 1-hour TTL to respect GitHub rate limits.
4. Graceful error handling for offline status or rate limits.
"""

import os
import sys
import time
import platform
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
import httpx
from loguru import logger

CURRENT_VERSION = "1.0.0"
GITHUB_REPO = "aasanea/aida64-web-sensorpanel"
CACHE_TTL_SECONDS = 3600


def parse_semver(version_str: str) -> Tuple[int, int, int]:
    """
    Parses a semver version string into a (major, minor, patch) integer tuple.
    Handles 'v1.2.3', '1.2.3', 'v2.0', pre-release suffixes (e.g. '1.1.0-beta').
    """
    if not version_str or not isinstance(version_str, str):
        return (0, 0, 0)
    cleaned = version_str.strip().lstrip("vV")
    # Strip pre-release or build metadata (e.g., -beta.1 or +20130313144700)
    base = cleaned.split("-")[0].split("+")[0]
    parts = []
    for seg in base.split("."):
        try:
            parts.append(int(seg))
        except ValueError:
            break
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])  # type: ignore


def is_newer_version(latest_str: str, current_str: str) -> bool:
    """
    Returns True if latest_str is strictly newer than current_str based on semver.
    """
    latest_tuple = parse_semver(latest_str)
    current_tuple = parse_semver(current_str)
    return latest_tuple > current_tuple


class UpdaterService:
    """
    Singleton service managing versioning, GitHub release checks,
    and cache invalidation for the AIDA64 Dashboard.
    """

    _instance: Optional["UpdaterService"] = None

    def __init__(self) -> None:
        self.current_version: str = CURRENT_VERSION
        self.github_repo: str = GITHUB_REPO
        self.cache_ttl: int = CACHE_TTL_SECONDS
        self._cache: Optional[Dict[str, Any]] = None
        self._last_checked_time: float = 0.0

    @classmethod
    def get_instance(cls) -> "UpdaterService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_version_info(self) -> Dict[str, Any]:
        """
        Returns current version info and system platform telemetry.
        """
        return {
            "current_version": self.current_version,
            "repo": self.github_repo,
            "python_version": platform.python_version(),
            "os": f"{platform.system()} {platform.release()}",
        }

    async def check_for_updates(self, force: bool = False) -> Dict[str, Any]:
        """
        Queries the GitHub releases API for the latest release.
        Uses an in-memory cache with CACHE_TTL_SECONDS (1h) unless force=True.
        Compares semantic versions and handles offline / rate-limited scenarios gracefully.
        """
        now = time.time()
        if not force and self._cache is not None and (now - self._last_checked_time < self.cache_ttl):
            logger.debug("Returning cached update status")
            return self._cache

        url = f"https://api.github.com/repos/{self.github_repo}/releases/latest"
        headers = {
            "User-Agent": f"aida64-dashboard-updater/{self.current_version}",
            "Accept": "application/vnd.github.v3+json",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)

            if resp.status_code == 200:
                data = resp.json()
                tag_name = data.get("tag_name", "")
                name = data.get("name") or tag_name
                body = data.get("body") or ""
                published_at = data.get("published_at")
                html_url = data.get("html_url")

                # Prefer zip asset if attached in release assets, fallback to zipball_url
                download_url = None
                assets = data.get("assets", [])
                if isinstance(assets, list):
                    for asset in assets:
                        asset_name = asset.get("name", "").lower()
                        if asset_name.endswith(".zip"):
                            download_url = asset.get("browser_download_url")
                            break
                if not download_url:
                    download_url = data.get("zipball_url") or html_url

                update_available = is_newer_version(tag_name, self.current_version)

                result: Dict[str, Any] = {
                    "current_version": self.current_version,
                    "latest_version": tag_name,
                    "update_available": update_available,
                    "release_name": name,
                    "release_notes": body,
                    "published_at": published_at,
                    "html_url": html_url,
                    "download_url": download_url,
                    "checked_at": datetime.now(timezone.utc).isoformat(),
                }
                self._cache = result
                self._last_checked_time = now
                logger.info(
                    f"Update check successful: current={self.current_version}, "
                    f"latest={tag_name}, available={update_available}"
                )
                return result

            elif resp.status_code == 404:
                err_msg = "No releases found on GitHub repository"
                logger.info(f"GitHub release check: {err_msg}")
                result = {
                    "current_version": self.current_version,
                    "latest_version": self.current_version,
                    "update_available": False,
                    "release_name": None,
                    "release_notes": None,
                    "published_at": None,
                    "html_url": None,
                    "download_url": None,
                    "checked_at": datetime.now(timezone.utc).isoformat(),
                    "error": err_msg,
                }
                return result

            elif resp.status_code in (403, 429):
                err_msg = f"GitHub API rate limit exceeded (HTTP {resp.status_code})"
                logger.warning(err_msg)
                return {
                    "current_version": self.current_version,
                    "latest_version": self._cache.get("latest_version") if self._cache else self.current_version,
                    "update_available": False,
                    "release_name": None,
                    "release_notes": None,
                    "published_at": None,
                    "html_url": None,
                    "download_url": None,
                    "checked_at": datetime.now(timezone.utc).isoformat(),
                    "error": err_msg,
                }

            else:
                err_msg = f"GitHub API responded with status {resp.status_code}"
                logger.warning(err_msg)
                return {
                    "current_version": self.current_version,
                    "latest_version": self._cache.get("latest_version") if self._cache else self.current_version,
                    "update_available": False,
                    "release_name": None,
                    "release_notes": None,
                    "published_at": None,
                    "html_url": None,
                    "download_url": None,
                    "checked_at": datetime.now(timezone.utc).isoformat(),
                    "error": err_msg,
                }

        except Exception as e:
            err_msg = f"Failed to check for updates: {str(e)}"
            logger.warning(err_msg)
            return {
                "current_version": self.current_version,
                "latest_version": self._cache.get("latest_version") if self._cache else self.current_version,
                "update_available": False,
                "release_name": None,
                "release_notes": None,
                "published_at": None,
                "html_url": None,
                "download_url": None,
                "checked_at": datetime.now(timezone.utc).isoformat(),
                "error": err_msg,
            }
