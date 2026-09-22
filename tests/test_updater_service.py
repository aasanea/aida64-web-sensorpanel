"""
Unit and Integration tests for UpdaterService and System API endpoints.
Verifies:
1. Version info telemetry (version, repository, Python, OS).
2. Semver comparison algorithm (including 'v' prefix, major/minor/patch, and invalid inputs).
3. GitHub release check with mocked responses and asset URL extraction.
4. Cache expiration and force refresh behavior.
5. Graceful offline and rate-limiting error resilience.
6. FastAPI REST endpoints /api/system/version and /api/system/check-update.
"""

import sys
import os
import time
from unittest.mock import AsyncMock, patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import pytest
import httpx
from fastapi.testclient import TestClient

from main import app
from services.updater_service import (
    UpdaterService,
    CURRENT_VERSION,
    GITHUB_REPO,
    CACHE_TTL_SECONDS,
    parse_semver,
    is_newer_version,
)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def fresh_service():
    """Returns a fresh or reset UpdaterService instance."""
    service = UpdaterService.get_instance()
    service._cache = None
    service._last_checked_time = 0.0
    return service


# ==============================================================================
# 1. Semver Comparison Tests
# ==============================================================================

def test_semver_parser():
    assert parse_semver("1.0.0") == (1, 0, 0)
    assert parse_semver("v1.2.3") == (1, 2, 3)
    assert parse_semver("V2.0") == (2, 0, 0)
    assert parse_semver("1.5.2-beta.1") == (1, 5, 2)
    assert parse_semver("invalid") == (0, 0, 0)
    assert parse_semver("") == (0, 0, 0)
    assert parse_semver(None) == (0, 0, 0)


def test_is_newer_version():
    # Newer versions
    assert is_newer_version("1.1.0", "1.0.0") is True
    assert is_newer_version("2.0.0", "1.0.0") is True
    assert is_newer_version("1.0.1", "1.0.0") is True
    assert is_newer_version("v1.2.0", "1.0.0") is True
    assert is_newer_version("1.10.0", "1.9.0") is True

    # Same or older versions
    assert is_newer_version("1.0.0", "1.0.0") is False
    assert is_newer_version("v1.0.0", "1.0.0") is False
    assert is_newer_version("0.9.9", "1.0.0") is False
    assert is_newer_version("1.0.0", "1.0.1") is False
    assert is_newer_version("0.1.0", "1.0.0") is False


# ==============================================================================
# 2. Version Info Telemetry Tests
# ==============================================================================

def test_get_version_info(fresh_service):
    info = fresh_service.get_version_info()
    assert isinstance(info, dict)
    assert info["current_version"] == CURRENT_VERSION
    assert info["repo"] == GITHUB_REPO
    assert "python_version" in info and len(info["python_version"]) > 0
    assert "os" in info and len(info["os"]) > 0


# ==============================================================================
# 3. GitHub API Release Checks & Asset Extraction
# ==============================================================================

@pytest.mark.asyncio
async def test_check_for_updates_available(fresh_service):
    mock_payload = {
        "tag_name": "v1.5.0",
        "name": "Release 1.5.0 - Neon Performance Boost",
        "body": "Major UI speedups and new widgets.",
        "published_at": "2026-09-22T12:00:00Z",
        "html_url": "https://github.com/aasanea/aida64-web-sensorpanel/releases/tag/v1.5.0",
        "zipball_url": "https://api.github.com/repos/aasanea/aida64-web-sensorpanel/zipball/v1.5.0",
        "assets": [
            {
                "name": "aida64-web-sensorpanel-v1.5.0.zip",
                "browser_download_url": "https://github.com/aasanea/aida64-web-sensorpanel/releases/download/v1.5.0/aida64-dashboard.zip",
            }
        ],
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_payload

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        result = await fresh_service.check_for_updates(force=True)

        assert result["update_available"] is True
        assert result["latest_version"] == "v1.5.0"
        assert result["current_version"] == CURRENT_VERSION
        assert result["release_name"] == "Release 1.5.0 - Neon Performance Boost"
        assert result["download_url"] == "https://github.com/aasanea/aida64-web-sensorpanel/releases/download/v1.5.0/aida64-dashboard.zip"
        assert result["published_at"] == "2026-09-22T12:00:00Z"
        assert "checked_at" in result
        assert mock_get.call_count == 1


@pytest.mark.asyncio
async def test_check_for_updates_up_to_date(fresh_service):
    mock_payload = {
        "tag_name": "v1.0.0",
        "name": "Version 1.0.0",
        "body": "Initial release",
        "published_at": "2026-09-01T00:00:00Z",
        "html_url": "https://github.com/aasanea/aida64-web-sensorpanel/releases/tag/v1.0.0",
        "zipball_url": "https://api.github.com/repos/aasanea/aida64-web-sensorpanel/zipball/v1.0.0",
        "assets": [],
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_payload

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        result = await fresh_service.check_for_updates(force=True)

        assert result["update_available"] is False
        assert result["latest_version"] == "v1.0.0"
        assert result["download_url"] == mock_payload["zipball_url"]


# ==============================================================================
# 4. In-Memory Cache and TTL Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_cache_ttl_and_force_refresh(fresh_service):
    mock_payload = {
        "tag_name": "v1.2.0",
        "name": "Release 1.2.0",
        "body": "Notes",
        "published_at": "2026-09-20T00:00:00Z",
        "html_url": "https://github.com/aasanea/aida64-web-sensorpanel",
        "zipball_url": "https://github.com/aasanea/aida64-web-sensorpanel.zip",
        "assets": [],
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_payload

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        # Call 1: Fetches and caches
        res1 = await fresh_service.check_for_updates(force=False)
        assert mock_get.call_count == 1

        # Call 2: Within TTL, should return cached result without hitting network
        res2 = await fresh_service.check_for_updates(force=False)
        assert mock_get.call_count == 1
        assert res1 == res2

        # Call 3: Artificially expire cache
        fresh_service._last_checked_time = time.time() - (CACHE_TTL_SECONDS + 10)
        res3 = await fresh_service.check_for_updates(force=False)
        assert mock_get.call_count == 2

        # Call 4: force=True should bypass cache even if fresh
        res4 = await fresh_service.check_for_updates(force=True)
        assert mock_get.call_count == 3


# ==============================================================================
# 5. Graceful Error Handling (Offline & Rate Limiting)
# ==============================================================================

@pytest.mark.asyncio
async def test_rate_limiting_resilience(fresh_service):
    mock_resp = MagicMock()
    mock_resp.status_code = 403

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        result = await fresh_service.check_for_updates(force=True)
        assert result["update_available"] is False
        assert "error" in result
        assert "rate limit" in result["error"].lower()


@pytest.mark.asyncio
async def test_network_offline_resilience(fresh_service):
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = httpx.ConnectError("Network unreachable")

        result = await fresh_service.check_for_updates(force=True)
        assert result["update_available"] is False
        assert "error" in result
        assert result["current_version"] == CURRENT_VERSION


# ==============================================================================
# 6. REST API Endpoints Integration
# ==============================================================================

def test_api_system_version_endpoint(client):
    resp = client.get("/api/system/version")
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_version"] == CURRENT_VERSION
    assert data["repo"] == GITHUB_REPO
    assert "python_version" in data
    assert "os" in data


def test_api_system_check_update_endpoint(client):
    mock_payload = {
        "tag_name": "v1.1.0",
        "name": "Update v1.1.0",
        "body": "Changelog",
        "published_at": "2026-09-22T00:00:00Z",
        "html_url": "https://github.com/aasanea/aida64-web-sensorpanel/releases/v1.1.0",
        "zipball_url": "https://api.github.com/repos/aasanea/aida64-web-sensorpanel/zipball/v1.1.0",
        "assets": [],
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_payload

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        resp = client.get("/api/system/check-update?force=true")
        assert resp.status_code == 200
        data = resp.json()
        assert "update_available" in data
        assert data["latest_version"] == "v1.1.0"
        assert data["current_version"] == CURRENT_VERSION
