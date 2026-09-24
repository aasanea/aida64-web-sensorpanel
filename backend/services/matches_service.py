"""
Matches & Sports Live Telemetry Service.
Provides:
1. Live Today's Matches with priority focus on Saudi Pro League (دوري روشن السعودي).
2. Upcoming Matches across Saudi Pro League, King's Cup, and AFC Champions League Elite.
3. Multi-Tournament Standings on Back Face:
   - دوري روشن (Roshn Saudi League - 18 teams)
   - نخبة آسيا (AFC Champions League Elite)
   - كأس الملك (King's Cup bracket & matches)
4. Background polling with caching (60s for matches, 300s for standings).
5. Full graceful fallback resilience if external endpoints are unreachable.
"""

import os
import json
import time
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional
import httpx
from loguru import logger

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
STANDINGS_CACHE_FILE = os.path.join(CACHE_DIR, "saudi_standings_cache.json")
MATCHES_CACHE_FILE = os.path.join(CACHE_DIR, "matches_cache.json")
TOURNAMENTS_CACHE_FILE = os.path.join(CACHE_DIR, "tournaments_cache.json")

# 365Scores API Endpoints
API_BASE = "https://webws.365scores.com/web"
COMMON_PARAMS = "appTypeId=5&langId=27&timezoneName=Asia/Riyadh&userCountryId=122"

SAUDI_LEAGUE_ID = 649
EPL_ID = 7
LA_LIGA_ID = 11
SERIE_A_ID = 17
BUNDESLIGA_ID = 25
LIGUE_1_ID = 35
CHAMPIONS_LEAGUE_ID = 572
AFC_ELITE_ID = 623
KINGS_CUP_ID = 5501
SAUDI_SUPER_CUP_ID = 5502
SAUDI_NT_ID = 5087
GULF_CUP_ID = 5452
WORLD_CUP_ID = 5930
ASIAN_CUP_ID = 6196

SAUDI_CLUBS_IDS = {
    5087,  # المنتخب السعودي
    5457,  # الهلال
    8593,  # الاتحاد
    7549,  # النصر
    8947,  # القادسية
    55793, # نيوم
    8944,  # الشباب
    7548,  # الأهلي
    8949,  # التعاون
    8943,  # الاتفاق
    8950,  # الرائد
    9660,  # الخليج
    11571, # ضمك
    9662,  # العروبة
    9661,  # الرياض
    36195, # الخلود
    36194, # الأخدود
    8945,  # الوحدة
    8946,  # الفتح
    8954,  # الطائي
    8953,  # الباطن
    8952,  # الفيصلي
    8951,  # الحزم
    8948,  # أبها
    36196, # العدالة
    9659,  # نجران
}

COMPETITION_NAMES = {
    649: "دوري روشن",
    7: "الدوري الإنجليزي",
    11: "الدوري الإسباني",
    17: "الدوري الإيطالي",
    25: "الدوري الألماني",
    35: "الدوري الفرنسي",
    572: "دوري أبطال أوروبا",
    623: "نخبة آسيا",
    5501: "كأس الملك",
    5502: "كأس السوبر السعودي",
    5452: "كأس الخليج العربي",
    5930: "كأس العالم",
    6196: "كأس آسيا",
}

OFFICIAL_BROADCASTERS = {
    649: "SSC 1 HD",
    5501: "SSC 1 HD",
    5502: "SSC Extra 1",
    6164: "SSC 1 HD",
    5452: "SSC 1 HD // الكأس",
    5930: "beIN Sports // SSC HD",
    6196: "beIN AFC // SSC HD",
    7: "beIN Sports 1 HD",
    11: "beIN Sports 1 HD",
    17: "Starzplay // AD Sports",
    25: "beIN Sports 5 HD",
    35: "beIN Sports 4 HD",
    572: "beIN Sports 1 HD",
    623: "beIN AFC // SSC HD",
}

ARABIC_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
WEEKDAYS = ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ar,en;q=0.9",
}

# Fallback Standings Table in case of network unavailability on first boot
FALLBACK_ROSHN_STANDINGS = [
    {"position": 1, "team_name": "الهلال", "team_id": 5457, "played": 7, "won": 6, "tied": 0, "lost": 1, "goals_for": 23, "goals_against": 5, "goal_diff": 18, "points": 18},
    {"position": 2, "team_name": "الاتحاد", "team_id": 8593, "played": 7, "won": 5, "tied": 2, "lost": 0, "goals_for": 16, "goals_against": 6, "goal_diff": 10, "points": 17},
    {"position": 3, "team_name": "النصر", "team_id": 7549, "played": 7, "won": 5, "tied": 1, "lost": 1, "goals_for": 18, "goals_against": 8, "goal_diff": 10, "points": 16},
    {"position": 4, "team_name": "القادسية", "team_id": 8947, "played": 7, "won": 5, "tied": 1, "lost": 1, "goals_for": 14, "goals_against": 6, "goal_diff": 8, "points": 16},
    {"position": 5, "team_name": "نيوم", "team_id": 55793, "played": 7, "won": 5, "tied": 0, "lost": 2, "goals_for": 15, "goals_against": 8, "goal_diff": 7, "points": 15},
    {"position": 6, "team_name": "الشباب", "team_id": 8944, "played": 7, "won": 4, "tied": 1, "lost": 2, "goals_for": 12, "goals_against": 7, "goal_diff": 5, "points": 13},
    {"position": 7, "team_name": "الأهلي", "team_id": 7548, "played": 7, "won": 4, "tied": 1, "lost": 2, "goals_for": 13, "goals_against": 9, "goal_diff": 4, "points": 13},
    {"position": 8, "team_name": "التعاون", "team_id": 8949, "played": 7, "won": 3, "tied": 2, "lost": 2, "goals_for": 10, "goals_against": 8, "goal_diff": 2, "points": 11},
    {"position": 9, "team_name": "الاتفاق", "team_id": 8943, "played": 7, "won": 3, "tied": 1, "lost": 3, "goals_for": 9, "goals_against": 10, "goal_diff": -1, "points": 10},
    {"position": 10, "team_name": "الرائد", "team_id": 8950, "played": 7, "won": 2, "tied": 2, "lost": 3, "goals_for": 8, "goals_against": 10, "goal_diff": -2, "points": 8},
    {"position": 11, "team_name": "الخليج", "team_id": 9660, "played": 7, "won": 2, "tied": 1, "lost": 4, "goals_for": 7, "goals_against": 11, "goal_diff": -4, "points": 7},
    {"position": 12, "team_name": "ضمك", "team_id": 11571, "played": 7, "won": 2, "tied": 1, "lost": 4, "goals_for": 9, "goals_against": 14, "goal_diff": -5, "points": 7},
    {"position": 13, "team_name": "العروبة", "team_id": 9662, "played": 7, "won": 2, "tied": 1, "lost": 4, "goals_for": 6, "goals_against": 13, "goal_diff": -7, "points": 7},
    {"position": 14, "team_name": "الرياض", "team_id": 9661, "played": 7, "won": 2, "tied": 0, "lost": 5, "goals_for": 7, "goals_against": 14, "goal_diff": -7, "points": 6},
    {"position": 15, "team_name": "الخلود", "team_id": 36195, "played": 7, "won": 1, "tied": 2, "lost": 4, "goals_for": 8, "goals_against": 14, "goal_diff": -6, "points": 5},
    {"position": 16, "team_name": "الأخدود", "team_id": 36194, "played": 7, "won": 1, "tied": 1, "lost": 5, "goals_for": 6, "goals_against": 13, "goal_diff": -7, "points": 4},
    {"position": 17, "team_name": "الوحدة", "team_id": 8945, "played": 7, "won": 1, "tied": 1, "lost": 5, "goals_for": 8, "goals_against": 19, "goal_diff": -11, "points": 4},
    {"position": 18, "team_name": "الفتح", "team_id": 8946, "played": 7, "won": 1, "tied": 0, "lost": 6, "goals_for": 5, "goals_against": 15, "goal_diff": -10, "points": 3},
]

class MatchesService:
    _instance: Optional["MatchesService"] = None

    def __init__(self):
        self._standings: List[Dict[str, Any]] = []
        self._afc_standings: List[Dict[str, Any]] = []
        self._kings_cup_matches: List[Dict[str, Any]] = []
        self._matches: List[Dict[str, Any]] = []
        self._saudi_matches: List[Dict[str, Any]] = []
        self._upcoming_matches: List[Dict[str, Any]] = []
        self._saudi_round_info: Dict[str, Any] = {"round_name": "الجولة الحالية", "matches": []}
        self._last_standings_update: Optional[str] = None
        self._last_matches_update: Optional[str] = None
        self._running: bool = False
        self._task: Optional[asyncio.Task] = None
        
        os.makedirs(CACHE_DIR, exist_ok=True)
        self._load_cache()

    @classmethod
    def get_instance(cls) -> "MatchesService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_cache(self) -> None:
        """Loads cached tournaments and matches from local JSON files."""
        if os.path.exists(STANDINGS_CACHE_FILE):
            try:
                with open(STANDINGS_CACHE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._standings = data.get("standings", [])
                    self._last_standings_update = data.get("last_update")
            except Exception as e:
                logger.warning(f"Could not load standings cache: {e}")

        if not self._standings:
            self._standings = list(FALLBACK_ROSHN_STANDINGS)

        if os.path.exists(TOURNAMENTS_CACHE_FILE):
            try:
                with open(TOURNAMENTS_CACHE_FILE, "r", encoding="utf-8") as f:
                    tdata = json.load(f)
                    self._afc_standings = tdata.get("afc_standings", [])
                    self._kings_cup_matches = tdata.get("kings_cup_matches", [])
            except Exception as e:
                logger.warning(f"Could not load tournaments cache: {e}")

        if os.path.exists(MATCHES_CACHE_FILE):
            try:
                with open(MATCHES_CACHE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._matches = data.get("matches", [])
                    self._saudi_matches = data.get("saudi_matches", [])
                    self._upcoming_matches = data.get("upcoming_matches", [])
                    self._saudi_round_info = data.get("saudi_round_info", self._saudi_round_info)
                    self._last_matches_update = data.get("last_update")
            except Exception as e:
                logger.warning(f"Could not load matches cache: {e}")

    def _save_cache(self) -> None:
        """Saves current state to local JSON files."""
        try:
            with open(STANDINGS_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(
                    {"standings": self._standings, "last_update": self._last_standings_update},
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
            with open(TOURNAMENTS_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "afc_standings": self._afc_standings,
                        "kings_cup_matches": self._kings_cup_matches,
                        "last_update": self._last_standings_update,
                    },
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
            with open(MATCHES_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "matches": self._matches,
                        "saudi_matches": self._saudi_matches,
                        "upcoming_matches": self._upcoming_matches,
                        "saudi_round_info": self._saudi_round_info,
                        "last_update": self._last_matches_update,
                    },
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
        except Exception as e:
            logger.warning(f"Could not save sports cache: {e}")

    async def start(self) -> None:
        """Starts the background sports polling loop."""
        if self._running:
            return
        self._running = True
        asyncio.create_task(self.refresh_all())
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("MatchesService background poller started.")

    async def stop(self) -> None:
        """Stops the background poller."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("MatchesService stopped.")

    async def _poll_loop(self) -> None:
        """Periodic background refresh: matches every 30s if live matches exist, otherwise 60s, standings every 300s."""
        tick = 0
        while self._running:
            try:
                has_live = any(m.get("is_live") for m in self._matches)
                sleep_sec = 30 if has_live else 60
                await asyncio.sleep(sleep_sec)
                tick += 1
                await self.fetch_matches()
                if tick % 5 == 0:
                    await self.fetch_standings()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in sports poll loop: {e}")

    async def refresh_all(self) -> None:
        """Fetches both standings and matches immediately."""
        await asyncio.gather(self.fetch_standings(), self.fetch_matches(), return_exceptions=True)

    async def fetch_standings(self) -> None:
        """Fetches Standings for Roshn League, AFC Champions League Elite, and King's Cup."""
        try:
            async with httpx.AsyncClient(headers=DEFAULT_HEADERS, timeout=12.0) as client:
                # 1. Saudi Pro League (649)
                roshn_url = f"{API_BASE}/standings/?{COMMON_PARAMS}&competitions={SAUDI_LEAGUE_ID}"
                # 2. AFC Champions League Elite (623)
                afc_url = f"{API_BASE}/standings/?{COMMON_PARAMS}&competitions={AFC_ELITE_ID}"
                # 3. King's Cup (5501)
                king_url = f"{API_BASE}/games/current/?{COMMON_PARAMS}&competitions={KINGS_CUP_ID}"

                roshn_resp, afc_resp, king_resp = await asyncio.gather(
                    client.get(roshn_url), client.get(afc_url), client.get(king_url), return_exceptions=True
                )

                # Process Roshn League Standings
                if isinstance(roshn_resp, httpx.Response) and roshn_resp.status_code == 200:
                    rdata = roshn_resp.json()
                    s_list = rdata.get("standings", [])
                    if s_list:
                        self._standings = self._parse_standings_rows(s_list[0].get("rows", []))

                # Process AFC Champions League Elite Standings
                if isinstance(afc_resp, httpx.Response) and afc_resp.status_code == 200:
                    adata = afc_resp.json()
                    as_list = adata.get("standings", [])
                    if as_list:
                        self._afc_standings = self._parse_standings_rows(as_list[0].get("rows", []))

                # Process King's Cup Games / Bracket
                if isinstance(king_resp, httpx.Response) and king_resp.status_code == 200:
                    kdata = king_resp.json()
                    kgames = kdata.get("games", [])
                    self._kings_cup_matches = [
                        parsed for g in kgames
                        if (parsed := self._parse_game(g, is_saudi=True, comp_name="كأس خادم الحرمين الشريفين"))
                    ]

                self._last_standings_update = datetime.now().isoformat()
                self._save_cache()
                logger.info(f"Updated Tournaments: Roshn ({len(self._standings)}), AFC ({len(self._afc_standings)}), King's Cup ({len(self._kings_cup_matches)})")
        except Exception as e:
            logger.warning(f"Exception fetching standings: {e}")

    def _parse_standings_rows(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Parses generic standings rows."""
        parsed = []
        for r in rows:
            comp_info = r.get("competitor", {})
            team_id = comp_info.get("id", 0)
            parsed.append({
                "position": r.get("position"),
                "team_name": comp_info.get("name", "فريق"),
                "team_id": team_id,
                "team_logo": f"https://imagecache.365scores.com/image/upload/f_png,w_48,h_48,c_limit,q_auto:eco,dpr_2/competitors/{team_id}",
                "played": r.get("gamePlayed", 0),
                "won": r.get("gamesWon", 0),
                "tied": r.get("gamesEven", 0),
                "lost": r.get("gamesLost", 0),
                "goals_for": r.get("for", 0),
                "goals_against": r.get("against", 0),
                "goal_diff": int(r.get("ratio", 0)),
                "points": int(r.get("points", 0)),
                "recent_form": r.get("recentForm", [])[:5],
            })
        return parsed

    async def fetch_matches(self) -> None:
        """Fetches today's matches, live matches, and upcoming fixtures across Top 5 World Leagues + Saudi Tournaments + Saudi National Team."""
        try:
            async with httpx.AsyncClient(headers=DEFAULT_HEADERS, timeout=12.0) as client:
                urls = {
                    "saudi": f"{API_BASE}/games/current/?{COMMON_PARAMS}&competitions={SAUDI_LEAGUE_ID}",
                    "saudi_nt": f"{API_BASE}/games/current/?{COMMON_PARAMS}&competitors={SAUDI_NT_ID}",
                    "saudi_super": f"{API_BASE}/games/current/?{COMMON_PARAMS}&competitions={SAUDI_SUPER_CUP_ID}",
                    "epl": f"{API_BASE}/games/current/?{COMMON_PARAMS}&competitions={EPL_ID}",
                    "laliga": f"{API_BASE}/games/current/?{COMMON_PARAMS}&competitions={LA_LIGA_ID}",
                    "seriea": f"{API_BASE}/games/current/?{COMMON_PARAMS}&competitions={SERIE_A_ID}",
                    "bundes": f"{API_BASE}/games/current/?{COMMON_PARAMS}&competitions={BUNDESLIGA_ID}",
                    "ligue1": f"{API_BASE}/games/current/?{COMMON_PARAMS}&competitions={LIGUE_1_ID}",
                    "ucl": f"{API_BASE}/games/current/?{COMMON_PARAMS}&competitions={CHAMPIONS_LEAGUE_ID}",
                    "afc": f"{API_BASE}/games/current/?{COMMON_PARAMS}&competitions={AFC_ELITE_ID}",
                    "king": f"{API_BASE}/games/current/?{COMMON_PARAMS}&competitions={KINGS_CUP_ID}",
                    "all": f"{API_BASE}/games/allscores/?{COMMON_PARAMS}",
                }

                keys = list(urls.keys())
                requests = [client.get(urls[k]) for k in keys]
                responses = await asyncio.gather(*requests, return_exceptions=True)
                resp_map = dict(zip(keys, responses))

                def parse_comp_games(resp, cid: int, comp_name: str, is_saudi: bool = False) -> List[Dict[str, Any]]:
                    games = []
                    if isinstance(resp, httpx.Response) and resp.status_code == 200:
                        try:
                            d = resp.json()
                            for g in d.get("games", []):
                                p = self._parse_game(g, is_saudi=is_saudi, comp_name=comp_name, comp_id=cid)
                                if p:
                                    games.append(p)
                        except Exception as ex:
                            logger.debug(f"Error parsing games for {comp_name}: {ex}")
                    return games

                saudi_raw = parse_comp_games(resp_map.get("saudi"), SAUDI_LEAGUE_ID, "دوري روشن", is_saudi=True)
                saudi_nt_raw = parse_comp_games(resp_map.get("saudi_nt"), 0, "المنتخب السعودي", is_saudi=True)
                saudi_super_raw = parse_comp_games(resp_map.get("saudi_super"), SAUDI_SUPER_CUP_ID, "كأس السوبر السعودي", is_saudi=True)
                epl_raw = parse_comp_games(resp_map.get("epl"), EPL_ID, "الدوري الإنجليزي")
                laliga_raw = parse_comp_games(resp_map.get("laliga"), LA_LIGA_ID, "الدوري الإسباني")
                seriea_raw = parse_comp_games(resp_map.get("seriea"), SERIE_A_ID, "الدوري الإيطالي")
                bundes_raw = parse_comp_games(resp_map.get("bundes"), BUNDESLIGA_ID, "الدوري الألماني")
                ligue1_raw = parse_comp_games(resp_map.get("ligue1"), LIGUE_1_ID, "الدوري الفرنسي")
                ucl_raw = parse_comp_games(resp_map.get("ucl"), CHAMPIONS_LEAGUE_ID, "دوري أبطال أوروبا")
                afc_raw = parse_comp_games(resp_map.get("afc"), AFC_ELITE_ID, "نخبة آسيا")
                king_raw = parse_comp_games(resp_map.get("king"), KINGS_CUP_ID, "كأس الملك", is_saudi=True)

                # Round name for Saudi League
                round_name = "الجولة الحالية"
                if saudi_raw:
                    r_name = saudi_raw[0].get("round_name") or "الجولة"
                    r_num = saudi_raw[0].get("round_num") or ""
                    round_name = f"{r_name} {r_num}".strip()

                # Allscores parsing for today & live matches
                today_allscores: List[Dict[str, Any]] = []
                all_resp = resp_map.get("all")
                if isinstance(all_resp, httpx.Response) and all_resp.status_code == 200:
                    try:
                        all_data = all_resp.json()
                        competitions_map = {c["id"]: c.get("name", "") for c in all_data.get("competitions", [])}
                        for g in all_data.get("games", []):
                            c_id = g.get("competitionId")
                            is_s = c_id in [SAUDI_LEAGUE_ID, KINGS_CUP_ID, SAUDI_SUPER_CUP_ID, GULF_CUP_ID, 6164]
                            # Strictly soccer / football from top 5 leagues + Saudi + UCL + AFC
                            if c_id not in COMPETITION_NAMES and not is_s:
                                continue
                            c_name = COMPETITION_NAMES.get(c_id, competitions_map.get(c_id, g.get("competitionDisplayName", "")))
                            p = self._parse_game(g, is_saudi=is_s, comp_name=c_name, comp_id=c_id)
                            if p:
                                today_allscores.append(p)
                    except Exception as ex:
                        logger.debug(f"Error parsing allscores: {ex}")

                # 1. Strictly Saudi matches and full pool
                all_league_groups = [
                    saudi_raw,
                    king_raw,
                    saudi_super_raw,
                    saudi_nt_raw,
                    afc_raw,
                    epl_raw,
                    laliga_raw,
                    seriea_raw,
                    bundes_raw,
                    ligue1_raw,
                    ucl_raw,
                    today_allscores,
                ]
                full_pool: List[Dict[str, Any]] = []
                for grp in all_league_groups:
                    full_pool.extend(grp)

                # Deduplicate full pool
                seen_all = set()
                deduped_all = []
                for m in full_pool:
                    if m["id"] not in seen_all:
                        deduped_all.append(m)
                        seen_all.add(m["id"])

                # Sort chronologically by start_time
                # 1. Gather all upcoming matches
                upcoming_saudi = [
                    m for m in deduped_all
                    if m.get("is_saudi") and not m["is_live"] and not m["is_ended"] and "تأجل" not in m.get("status_text", "")
                ]
                upcoming_world = [
                    m for m in deduped_all
                    if not m.get("is_saudi") and not m["is_live"] and not m["is_ended"] and "تأجل" not in m.get("status_text", "")
                ]

                # Combined upcoming: Guaranteed all Saudi upcoming matches + Top European matches
                all_upcoming = upcoming_saudi + upcoming_world
                all_upcoming.sort(key=lambda x: x.get("start_time") or "9999")
                self._upcoming_matches = all_upcoming[:60]

                # 2. Strictly Roshn Saudi League matches (recent ended + live + upcoming for Roshn League only - NO National Teams)
                roshn_games = [
                    m for m in deduped_all
                    if (m.get("competition_id") == SAUDI_LEAGUE_ID or m.get("is_roshn")) and not m.get("is_saudi_nt")
                ]
                roshn_ended = [m for m in roshn_games if m["is_ended"]][-12:]
                roshn_live = [m for m in roshn_games if m["is_live"]]
                roshn_upcoming = [
                    m for m in roshn_games
                    if not m["is_live"] and not m["is_ended"] and "تأجل" not in m.get("status_text", "")
                ]
                roshn_feed = roshn_ended + roshn_live + roshn_upcoming
                roshn_feed.sort(key=lambda x: x.get("start_time") or "9999")
                self._saudi_matches = roshn_feed

                # Round name for Saudi Roshn League
                round_name = "الجولة الحالية"
                if roshn_upcoming:
                    r_name = roshn_upcoming[0].get("round_name") or "الجولة"
                    r_num = roshn_upcoming[0].get("round_num") or ""
                    round_name = f"{r_name} {r_num}".strip()
                elif roshn_games:
                    r_name = roshn_games[-1].get("round_name") or "الجولة"
                    r_num = roshn_games[-1].get("round_num") or ""
                    round_name = f"{r_name} {r_num}".strip()

                # 3. "الكل" (All Matches): Recent ended matches with final scores + live + all upcoming fixtures
                recent_ended = [m for m in deduped_all if m["is_ended"]][-30:]
                live_games = [m for m in deduped_all if m["is_live"]]
                if live_games:
                    async def enrich_live(m_item: dict) -> None:
                        gid = m_item.get("id")
                        if not gid:
                            return
                        try:
                            g_url = f"{API_BASE}/game/?gameId={gid}&langId=27"
                            g_resp = await client.get(g_url, timeout=3.5)
                            if g_resp.status_code == 200:
                                g_obj = g_resp.json().get("game", {})
                                pgt = g_obj.get("preciseGameTime")
                                if pgt and isinstance(pgt, dict):
                                    p_min = pgt.get("minutes")
                                    p_sec = pgt.get("seconds")
                                    if p_min is not None and p_sec is not None:
                                        m_item["game_time_minutes"] = int(p_min)
                                        m_item["game_time_seconds"] = int(p_sec)
                                        m_item["auto_progress"] = bool(pgt.get("autoProgress", True))
                                        m_item["clock_direction"] = pgt.get("clockDirection", 1)
                                        m_item["game_time_epoch"] = time.time()
                                        m_item["live_timer"] = f"{int(p_min)}:{int(p_sec):02d}"
                                if g_obj.get("addedTime") is not None:
                                    try:
                                        m_item["added_time"] = int(g_obj["addedTime"])
                                    except (ValueError, TypeError):
                                        pass
                                if g_obj.get("gameTime") is not None:
                                    try:
                                        m_item["game_time"] = int(round(float(g_obj["gameTime"])))
                                    except (ValueError, TypeError):
                                        pass
                        except Exception as e_live:
                            logger.debug(f"Live match {gid} detail fetch error: {e_live}")

                    await asyncio.gather(*[enrich_live(m) for m in live_games], return_exceptions=True)

                all_feed = recent_ended + live_games + all_upcoming[:50]
                all_feed.sort(key=lambda x: x.get("start_time") or "9999")
                self._matches = all_feed

                self._saudi_round_info = {
                    "round_name": round_name,
                    "matches": self._saudi_matches,
                }
                self._last_matches_update = datetime.now().isoformat()
                self._save_cache()
                logger.info(f"Updated Matches: {len(self._matches)} all, {len(self._saudi_matches)} roshn, {len(self._upcoming_matches)} upcoming.")
        except Exception as e:
            logger.warning(f"Exception fetching matches: {e}")

    def _parse_game(self, g: Dict[str, Any], is_saudi: bool = False, comp_name: str = "", comp_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Normalizes a raw game object from 365Scores."""
        try:
            home = g.get("homeCompetitor", {})
            away = g.get("awayCompetitor", {})
            status_text = g.get("statusText", "")
            game_time_status = g.get("gameTimeStatus", 0)
            
            is_live = game_time_status in [1, 2, 3] or "شوط" in status_text or "مباشر" in status_text
            is_ended = "انتهت" in status_text or game_time_status == 4

            home_score = home.get("score")
            away_score = away.get("score")
            if home_score is not None:
                home_score = int(home_score)
            if away_score is not None:
                away_score = int(away_score)

            start_time = g.get("startTime", "")
            start_time_str = ""
            start_date_str = ""
            date_key = ""
            day_label = ""
            weekday_name = ""
            if start_time:
                try:
                    dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                    start_time_str = dt.strftime("%H:%M")
                    date_key = dt.strftime("%Y-%m-%d")
                    weekday_name = WEEKDAYS[dt.weekday()]
                    month_name = ARABIC_MONTHS[dt.month - 1]
                    day_label = f"{weekday_name} {dt.day} {month_name}"
                    start_date_str = f"{weekday_name} {dt.strftime('%d/%m')}"
                except Exception:
                    start_time_str = start_time[:16]

            home_id = home.get("id", 0)
            away_id = away.get("id", 0)
            c_id = comp_id or g.get("competitionId")

            # Live Game Time, Extra/Stoppage Time & Halftime detection
            raw_gt = g.get("gameTime")
            game_time: Optional[int] = None
            if raw_gt is not None:
                try:
                    gt_float = float(raw_gt)
                    if gt_float > 0:
                        game_time = int(round(gt_float))
                except (ValueError, TypeError):
                    pass

            raw_added = g.get("addedTime")
            added_time: Optional[int] = None
            if raw_added is not None:
                try:
                    added_int = int(raw_added)
                    if added_int > 0:
                        added_time = added_int
                except (ValueError, TypeError):
                    pass

            game_time_display = str(g.get("gameTimeDisplay") or "").strip()

            is_halftime = (
                "استراحة" in status_text or
                "بين الشوطين" in status_text or
                game_time_status == 2
            )

            # Determine live minute text
            live_minute = ""
            if is_live:
                if is_halftime:
                    live_minute = "HT"
                elif game_time_display and any(c.isdigit() for c in game_time_display):
                    live_minute = game_time_display if game_time_display.endswith("'") else f"{game_time_display}'"
                elif game_time is not None and game_time > 0:
                    if added_time and added_time > 0:
                        live_minute = f"{game_time}+{added_time}'"
                    else:
                        live_minute = f"{game_time}'"
                elif start_time:
                    try:
                        dt_start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                        now_tz = datetime.now().astimezone()
                        elapsed_min = int((now_tz - dt_start.astimezone()).total_seconds() / 60)
                        if 0 < elapsed_min <= 47:
                            live_minute = f"{min(45, elapsed_min)}'"
                        elif 47 < elapsed_min <= 62:
                            live_minute = "HT"
                            is_halftime = True
                        elif 62 < elapsed_min <= 115:
                            second_half_min = 45 + (elapsed_min - 62)
                            live_minute = f"{min(90, second_half_min)}'"
                    except Exception:
                        pass

            is_saudi_nt = (home_id == SAUDI_NT_ID or away_id == SAUDI_NT_ID)
            is_roshn = (c_id == SAUDI_LEAGUE_ID)
            is_s = (
                is_saudi or
                is_saudi_nt or
                is_roshn or
                c_id in [SAUDI_LEAGUE_ID, KINGS_CUP_ID, SAUDI_SUPER_CUP_ID, GULF_CUP_ID, 6164] or
                home_id in SAUDI_CLUBS_IDS or
                away_id in SAUDI_CLUBS_IDS
            )

            final_comp_name = comp_name
            if not final_comp_name or final_comp_name == "المنتخب السعودي":
                final_comp_name = COMPETITION_NAMES.get(c_id, g.get("competitionDisplayName", "المنتخب السعودي" if is_saudi_nt else ("دوري روشن" if is_roshn else "مباراة")))

            # Determine broadcasting channel
            channel = OFFICIAL_BROADCASTERS.get(c_id, "SSC 1 HD // الكأس" if is_saudi_nt else ("SSC 1 HD" if is_s else "beIN Sports HD"))
            tv_networks = g.get("tvNetworks") or []
            if tv_networks and isinstance(tv_networks, list) and len(tv_networks) > 0:
                net_name = tv_networks[0].get("name")
                if net_name:
                    channel = net_name

            return {
                "id": g.get("id"),
                "competition_id": c_id,
                "competition_name": final_comp_name,
                "channel": channel,
                "is_saudi": is_s,
                "is_saudi_nt": is_saudi_nt,
                "is_roshn": is_roshn,
                "round_name": g.get("roundName", "الجولة"),
                "round_num": g.get("roundNum"),
                "stage_name": g.get("stageName", ""),
                "home_name": home.get("name", "المستضيف"),
                "home_id": home_id,
                "home_logo": f"https://imagecache.365scores.com/image/upload/f_png,w_48,h_48,c_limit,q_auto:eco,dpr_2/competitors/{home_id}",
                "home_score": home_score,
                "home_qualified": home.get("isQualified", False),
                "away_name": away.get("name", "الضيف"),
                "away_id": away_id,
                "away_logo": f"https://imagecache.365scores.com/image/upload/f_png,w_48,h_48,c_limit,q_auto:eco,dpr_2/competitors/{away_id}",
                "away_score": away_score,
                "away_qualified": away.get("isQualified", False),
                "status_text": status_text,
                "is_live": is_live,
                "is_ended": is_ended,
                "game_time": game_time,
                "added_time": added_time,
                "game_time_display": game_time_display,
                "live_minute": live_minute,
                "game_time_minutes": game_time,
                "game_time_seconds": 0 if game_time is not None else None,
                "auto_progress": True if is_live and not is_halftime else False,
                "clock_direction": 1,
                "game_time_epoch": time.time(),
                "live_timer": f"{game_time}:00" if game_time is not None else live_minute,
                "is_halftime": is_halftime,
                "start_time": start_time,
                "start_time_display": start_time_str,
                "start_date_display": start_date_str,
                "date_key": date_key,
                "day_label": day_label,
                "weekday": weekday_name,
                "venue": g.get("venue", {}).get("name", ""),
            }
        except Exception as e:
            logger.debug(f"Error parsing game {g.get('id')}: {e}")
            return None

    def get_standings(self) -> Dict[str, Any]:
        """Returns Multi-Tournament Standings Snapshot (Roshn, AFC Elite, King's Cup)."""
        return {
            "competition": "دوري روشن السعودي",
            "competition_id": SAUDI_LEAGUE_ID,
            "total_teams": len(self._standings),
            "last_update": self._last_standings_update or datetime.now().isoformat(),
            "standings": self._standings,
            "roshn": {
                "name": "دوري روشن السعودي",
                "standings": self._standings,
            },
            "afc": {
                "name": "دوري أبطال آسيا للنخبة",
                "standings": self._afc_standings[:16] if self._afc_standings else [],
            },
            "king": {
                "name": "كأس خادم الحرمين الشريفين",
                "matches": self._kings_cup_matches[:16] if self._kings_cup_matches else [],
            }
        }

    def get_today_matches(self) -> Dict[str, Any]:
        """Returns Today's Matches, Upcoming Fixtures, and Saudi Round Snapshot."""
        live_count = sum(1 for m in self._matches if m.get("is_live"))
        return {
            "live_count": live_count,
            "last_update": self._last_matches_update or datetime.now().isoformat(),
            "matches": self._matches,
            "saudi_matches": self._saudi_matches,
            "upcoming_matches": self._upcoming_matches,
            "saudi_round": self._saudi_round_info,
        }

