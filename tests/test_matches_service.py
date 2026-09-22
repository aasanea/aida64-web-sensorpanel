"""
Unit tests for MatchesService and sports API endpoints.
Tests:
1. MatchesService singleton initialization & fallback resilience.
2. GET /api/matches/today returns valid matches list and saudi round info.
3. GET /api/matches/saudi-standings returns 18 clubs with points and rank.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import pytest
from fastapi.testclient import TestClient
from main import app
from services.matches_service import MatchesService

@pytest.fixture
def client():
    return TestClient(app)

def test_matches_service_singleton_and_fallback():
    service = MatchesService.get_instance()
    assert service is not None
    
    standings_data = service.get_standings()
    assert "standings" in standings_data
    assert len(standings_data["standings"]) >= 18
    assert standings_data["competition"] == "دوري روشن السعودي"
    
    # Verify top club has expected keys
    first_club = standings_data["standings"][0]
    assert "position" in first_club
    assert "team_name" in first_club
    assert "points" in first_club
    assert "played" in first_club

def test_api_today_matches_endpoint(client):
    resp = client.get("/api/matches/today")
    assert resp.status_code == 200
    data = resp.json()
    assert "matches" in data
    assert "saudi_round" in data
    assert isinstance(data["matches"], list)

def test_api_saudi_standings_endpoint(client):
    resp = client.get("/api/matches/saudi-standings")
    assert resp.status_code == 200
    data = resp.json()
    assert "standings" in data
    assert len(data["standings"]) >= 18
    
    # Verify sorted positions 1 to 18
    positions = [row["position"] for row in data["standings"][:18]]
    assert positions == list(range(1, 19))
