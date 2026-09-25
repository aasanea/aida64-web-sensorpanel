"""
End-to-end Integration Test Suite for AIDA64 Glassmorphism 2.0 Dashboard.
Covers:
1. Full Pipeline Stream: Shared Memory -> aida_reader -> FastAPI -> WebSocket.
2. Failure Scenarios:
   - Shared memory unavailable / closed (Fallback to Registry).
   - Both Shared Memory & Registry unavailable (Graceful Null degradation: all 24 fields null, never 0).
   - Malformed / Corrupted XML recovery.
   - WebSocket Disconnect and Reconnect lifecycle.
   - Multiple WebSocket clients isolated disconnect.
   - Client requesting /api/sensors while WebSocket is active.
   - Concurrent REST requests under active WebSocket streaming.
3. Latency and Throughput Benchmarks (Reader, API, WS roundtrip).
4. End-to-End Browser UI Validation via Playwright Chromium.
"""

import asyncio
import concurrent.futures
import json
import os
import sys
import threading
import time
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import services.aida_service as aida_reader
from core.config import settings
from main import app, manager
from models import SensorData, HardwareMetrics


# ============================================================================
# 1. Full Live Pipeline Stream
# ============================================================================
@pytest.mark.asyncio
async def test_full_pipeline_stream():
    """Verify live reading from AIDA64 Shared Memory and 24-sensor contract."""
    # 1. Direct shared memory / registry reading
    sensors_dict = aida_reader.read_aida_sensors()
    assert isinstance(sensors_dict, dict), "Sensors dict must be valid dictionary"
    if not sensors_dict:
        # AIDA64 is not running on this host (e.g. CI runner environment).
        # Verify fallback pipeline contract to ensure models & structure are compliant.
        sensor_data, sensor_count = aida_reader.get_sensors_and_count(fallback_registry=True)
        assert isinstance(sensor_data, HardwareMetrics)
        dump = sensor_data.model_dump()
        assert len(dump) >= 24
        return

    assert len(sensors_dict) > 0, "At least some sensors must be detected from AIDA64"

    # 2. Extract SensorData model
    sensor_data, sensor_count = aida_reader.get_sensors_and_count()
    assert isinstance(sensor_data, HardwareMetrics)
    assert sensor_count > 0

    # Check fields
    dump = sensor_data.model_dump()
    assert len(dump) >= 24, f"SensorData must contain at least 24 fields, got {len(dump)}"

    active_keys = [k for k, v in dump.items() if v is not None]
    print(f"\n[Integration] Populated active metrics ({len(active_keys)}/{len(dump)}): {active_keys}")
    for k in active_keys:
        val = dump[k]
        print(f"   [OK] {k:22s} = {val}")
        string_fields = (
            "display_res", "date_gregorian", "date_hijri",
            "riyadh_weather_desc", "riyadh_weather_icon",
            "prayer_fajr", "prayer_sunrise", "prayer_dhuhr",
            "prayer_asr", "prayer_maghrib", "prayer_isha",
            "next_prayer_name", "next_prayer_time",
            "prev_prayer_name", "prev_prayer_time",
            "next_appointment_title", "next_appointment_time",
            "next_appointment_category", "next_appointment_category_label",
            "next_appointment_location",
        )
        if k in string_fields:
            assert isinstance(val, str), f"Field {k} must be string, got {type(val)}"
        elif k in ("today_appointments", "cpu_cores"):
            assert isinstance(val, list), f"Field {k} must be list, got {type(val)}"
            if k == "cpu_cores":
                assert len(val) == 20, f"Expected 20 CPU cores, got {len(val)}"
        elif k == "next_appointment_ongoing":
            assert isinstance(val, bool), f"Field {k} must be bool, got {type(val)}"
        else:
            assert isinstance(val, (int, float)), f"Field {k} must be numeric, got {type(val)}"

    assert len(active_keys) >= 20, f"Expected at least 20 live sensors, got {len(active_keys)}"


# ============================================================================
# 2. Failure Scenarios: Shared Memory & Registry Degradation
# ============================================================================
def test_shared_memory_unavailable_fallback_registry():
    """
    Scenario: AIDA64 Shared Memory handle is closed/unavailable.
    Expectation: Fallback to Windows Registry (read_registry_sensors) seamlessly.
    """
    mock_registry_data = {
        "TCPU": {"category": "reg", "label": "CPU", "value": "54.0"},
        "SCPUUTI": {"category": "reg", "label": "CPU Utilization", "value": "28.5"},
        "TGPU1": {"category": "reg", "label": "GPU", "value": "46.0"},
        "SMEMUTI": {"category": "reg", "label": "Memory Utilization", "value": "42.0"},
    }

    with patch.object(aida_reader, "read_shared_memory", return_value=None):
        with patch.object(aida_reader, "read_registry_sensors", return_value=mock_registry_data):
            sensors = aida_reader.read_aida_sensors(fallback_registry=True)
            assert "TCPU" in sensors
            assert sensors["TCPU"]["value"] == "54.0"

            sensor_data, count = aida_reader.get_sensors_and_count(fallback_registry=True)
            assert count == 4
            assert sensor_data.cpu_temp == 54.0
            assert sensor_data.cpu_load == 28.5
            assert sensor_data.gpu_temp == 46.0
            assert sensor_data.ram_used_percent == 42.0
            # Missing sensors must be None, NOT 0
            assert sensor_data.cpu_power is None
            assert sensor_data.vrm_temp is None
            print("\n[Failure Scenario] Registry fallback successfully engaged when Shared Memory unavailable.")


def test_shared_memory_and_registry_unavailable_graceful_null():
    """
    Scenario: Both Shared Memory and Registry are unavailable / return empty.
    Expectation: Return SensorData with ALL 24 fields set to None (NEVER 0). Zero crashes.
    """
    with patch.object(aida_reader, "read_shared_memory", return_value=None):
        with patch.object(aida_reader, "read_registry_sensors", return_value={}):
            sensor_data, count = aida_reader.get_sensors_and_count(fallback_registry=True)
            assert count == 0

            dump = sensor_data.model_dump()
            assert len(dump) >= 24
            exempt_fields = (
                "date_gregorian", "date_hijri",
                "riyadh_temp", "riyadh_weather_desc", "riyadh_weather_icon",
                "prayer_fajr", "prayer_sunrise", "prayer_dhuhr",
                "prayer_asr", "prayer_maghrib", "prayer_isha",
                "next_prayer_name", "next_prayer_time", "next_prayer_seconds",
                "prev_prayer_name", "prev_prayer_time", "prev_prayer_seconds",
                "appointments_count", "appointments_remaining",
                "next_appointment_title", "next_appointment_time",
                "next_appointment_category", "next_appointment_category_label",
                "next_appointment_seconds", "next_appointment_ongoing",
                "next_appointment_location",
                "today_appointments",
                "sonar_connected",
                "audio_mic_muted", "audio_mic_volume",
                "audio_master_volume", "audio_master_muted",
                "audio_game_volume", "audio_game_muted",
                "audio_chat_volume", "audio_chat_muted",
                "audio_media_volume", "audio_media_muted",
                "audio_aux_volume", "audio_aux_muted",
            )
            for field, val in dump.items():
                if field in exempt_fields:
                    continue
                assert val is None, f"Field '{field}' must be None during total outage, but got {val}"

            # Verify REST API behavior under total AIDA64 outage
            client = TestClient(app)
            response = client.get("/api/sensors")
            assert response.status_code == 200
            api_data = response.json()
            for field, val in api_data.items():
                if field in exempt_fields:
                    continue
                assert val is None, f"API field '{field}' must be null, got {val}"

            # Verify Health Endpoint under total outage
            health_resp = client.get("/health")
            assert health_resp.status_code == 200
            health_data = health_resp.json()
            assert health_data["status"] == "healthy"
            assert health_data["sensors_detected"] == 0
            print("\n[Failure Scenario] Graceful null degradation verified: all 24 sensors returned None.")


def test_corrupt_or_malformed_xml_handling():
    """
    Scenario: AIDA64 writes truncated, malformed, or unescaped XML to shared memory.
    Expectation: XML parser catches ParseError and falls back to regex extraction cleanly.
    """
    # Malformed XML containing valid child blocks followed by an abrupt unclosed corrupted tag
    malformed_xml = (
        "<temp><id>TCPU</id><label>CPU</label><value>58.5</value></temp>"
        "<pwr><id>PCPUPKG</id><label>CPU Package</label><value>95.2</value></pwr>"
        "<broken><id>CORRUPT_TAG_NO_CLOSE"
    )

    parsed = aida_reader.parse_aida_xml(malformed_xml)
    assert "TCPU" in parsed, "Regex fallback must extract TCPU from malformed XML"
    assert parsed["TCPU"]["value"] == "58.5"
    assert "PCPUPKG" in parsed
    assert parsed["PCPUPKG"]["value"] == "95.2"
    print("\n[Failure Scenario] Malformed XML gracefully parsed via regex fallback.")


# ============================================================================
# 3. Failure Scenarios: WebSocket Disconnect & Reconnect Lifecycle
# ============================================================================
def test_websocket_disconnect_and_reconnect():
    """
    Scenario: Client establishes WebSocket connection, disconnects abruptly, and reconnects.
    Expectation: Manager cleans up disconnected socket, allows immediate reconnection,
                 and delivers fresh telemetry frames.
    """
    client = TestClient(app)
    initial_active = manager.count

    # 1. Connect Client
    with client.websocket_connect("/ws") as ws1:
        assert manager.count == initial_active + 1
        initial_payload = ws1.receive_json()
        assert "cpu_temp" in initial_payload

        # Heartbeat ping-pong
        ws1.send_text("ping")
        pong = ws1.receive_text()
        assert pong == "pong"

    # 2. After disconnect context exit
    assert manager.count == initial_active, "Active connections must decrement after disconnect"

    # 3. Reconnect
    with client.websocket_connect("/ws") as ws2:
        assert manager.count == initial_active + 1
        reconnect_payload = ws2.receive_json()
        assert "cpu_temp" in reconnect_payload

        ws2.send_text("ping")
        assert ws2.receive_text() == "pong"

    assert manager.count == initial_active
    print("\n[Failure Scenario] WebSocket disconnect and reconnect lifecycle verified.")


def test_multiple_websocket_clients_isolated_disconnect():
    """
    Scenario: Multiple WebSocket clients connected simultaneously; one disconnects.
    Expectation: Remaining client continues receiving streaming broadcasts without interruption.
    """
    client = TestClient(app)
    initial_active = manager.count

    with client.websocket_connect("/ws") as ws_a:
        with client.websocket_connect("/ws") as ws_b:
            assert manager.count == initial_active + 2

            # Both receive initial payload
            data_a = ws_a.receive_json()
            data_b = ws_b.receive_json()
            assert "cpu_temp" in data_a
            assert "cpu_temp" in data_b

            # Client A pings
            ws_a.send_text("ping")
            assert ws_a.receive_text() == "pong"

        # ws_b has disconnected
        assert manager.count == initial_active + 1

        # ws_a is still connected and operational
        ws_a.send_text("ping")
        assert ws_a.receive_text() == "pong"

    assert manager.count == initial_active
    print("\n[Failure Scenario] Multiple client isolation verified: one disconnect does not affect others.")


# ============================================================================
# 4. Scenario: REST API Request While WebSocket Is Active
# ============================================================================
def test_client_requesting_api_sensors_while_websocket_active():
    """
    Scenario: Client queries /api/sensors and /health while WebSocket is actively connected.
    Expectation: REST endpoint responds immediately with 200 OK and valid 24-sensor JSON.
                 WebSocket stream remains undisturbed.
    """
    client = TestClient(app)

    with client.websocket_connect("/ws") as ws:
        assert manager.count >= 1
        ws_initial = ws.receive_json()
        assert "cpu_temp" in ws_initial

        # Interleaved REST API calls
        for _ in range(10):
            response = client.get("/api/sensors")
            assert response.status_code == 200
            sensors_data = response.json()
            assert len(sensors_data) >= 24
            assert "cpu_temp" in sensors_data
            assert "ram_used_percent" in sensors_data

        # Health endpoint should reflect 1 active connection
        health_resp = client.get("/health")
        assert health_resp.status_code == 200
        assert health_resp.json()["active_connections"] >= 1

        # Verify WebSocket is still responsive
        ws.send_text("ping")
        assert ws.receive_text() == "pong"

    print("\n[Concurrency] REST /api/sensors requested 10 times during active WebSocket stream with zero interference.")


def test_concurrent_rest_requests_during_websocket_stream():
    """
    Scenario: High concurrency: 25 rapid concurrent requests to /api/sensors while WebSocket is active.
    Expectation: 100% success rate (200 OK), no thread locks, no memory mapping race conditions.
    """
    client = TestClient(app)

    with client.websocket_connect("/ws") as ws:
        _ = ws.receive_json()

        def fetch_sensors():
            res = client.get("/api/sensors")
            return res.status_code, res.json()

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(fetch_sensors) for _ in range(25)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        assert len(results) == 25
        for status, body in results:
            assert status == 200
            assert len(body) >= 24
            assert "cpu_temp" in body

        # Verify WS is still alive after storm
        ws.send_text("ping")
        assert ws.receive_text() == "pong"

    print("\n[Concurrency] 25 concurrent /api/sensors requests completed successfully under active WS connection.")


# ============================================================================
# 5. Latency and Throughput Benchmarks
# ============================================================================
def test_pipeline_latency_and_throughput_benchmark():
    """
    Benchmark latency across pipeline stages:
    1. AIDA64 Shared Memory Read + Parsing (50 iterations)
    2. FastAPI /api/sensors REST Response (50 iterations)
    3. WebSocket Ping-Pong Heartbeat (20 iterations)
    """
    iterations = 50

    # Stage 1: AIDA64 Memory Read Latency
    read_latencies = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        _ = aida_reader.get_sensor_data()
        t1 = time.perf_counter()
        read_latencies.append((t1 - t0) * 1000.0)

    avg_read = sum(read_latencies) / len(read_latencies)
    min_read = min(read_latencies)
    max_read = max(read_latencies)
    p95_read = sorted(read_latencies)[int(len(read_latencies) * 0.95)]

    # Stage 2: REST /api/sensors Latency
    client = TestClient(app)
    api_latencies = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        res = client.get("/api/sensors")
        t1 = time.perf_counter()
        assert res.status_code == 200
        api_latencies.append((t1 - t0) * 1000.0)

    avg_api = sum(api_latencies) / len(api_latencies)
    min_api = min(api_latencies)
    max_api = max(api_latencies)
    p95_api = sorted(api_latencies)[int(len(api_latencies) * 0.95)]

    # Stage 3: WebSocket Ping-Pong Roundtrip Latency
    ws_latencies = []
    with client.websocket_connect("/ws") as ws:
        _ = ws.receive_json()
        for _ in range(20):
            t0 = time.perf_counter()
            ws.send_text("ping")
            resp = ws.receive_text()
            t1 = time.perf_counter()
            assert resp == "pong"
            ws_latencies.append((t1 - t0) * 1000.0)

    avg_ws = sum(ws_latencies) / len(ws_latencies)
    min_ws = min(ws_latencies)
    max_ws = max(ws_latencies)
    p95_ws = sorted(ws_latencies)[int(len(ws_latencies) * 0.95)]

    print("\n" + "=" * 70)
    print(" PIPELINE LATENCY BENCHMARK RESULTS")
    print("=" * 70)
    print(f" 1. AIDA64 Memory Read + Parse: Avg={avg_read:.2f}ms | Min={min_read:.2f}ms | Max={max_read:.2f}ms | P95={p95_read:.2f}ms")
    print(f" 2. FastAPI REST /api/sensors : Avg={avg_api:.2f}ms | Min={min_api:.2f}ms | Max={max_api:.2f}ms | P95={p95_api:.2f}ms")
    print(f" 3. WebSocket Ping-Pong RTT   : Avg={avg_ws:.2f}ms | Min={min_ws:.2f}ms | Max={max_ws:.2f}ms | P95={p95_ws:.2f}ms")
    print("=" * 70)

    # Assert SLA budgets
    assert avg_read < 25.0, f"Average memory read latency must be <25ms, got {avg_read:.2f}ms"
    assert avg_api < 50.0, f"Average REST API latency must be <50ms, got {avg_api:.2f}ms"
    assert avg_ws < 20.0, f"Average WebSocket roundtrip latency must be <20ms, got {avg_ws:.2f}ms"


# ============================================================================
# 6. End-to-End Browser UI Validation via Playwright Chromium
# ============================================================================
def test_playwright_e2e_browser_ui():
    """
    Launch backend uvicorn server in background thread, load index.html via Playwright Chromium,
    verify WebSocket connection in UI, live sensor rendering in DOM, and capture screenshot.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        pytest.skip("Playwright is not installed in this environment")

    import socket
    import uvicorn

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        test_port = s.getsockname()[1]

    config = uvicorn.Config(app, host="127.0.0.1", port=test_port, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    # Wait for server startup
    time.sleep(1.5)

    # Helper JS to find element by ID piercing Shadow DOM boundaries
    DEEP_QUERY_JS = """
    (id) => {
        let el = document.getElementById(id);
        if (el) return el.innerText;
        const allHosts = document.querySelectorAll('*');
        for (const host of allHosts) {
            if (host.shadowRoot) {
                el = host.shadowRoot.getElementById(id);
                if (el) return el.innerText;
            }
        }
        return null;
    }
    """

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1920, "height": 1080})
            page.goto(f"http://127.0.0.1:{test_port}/")

            # 1. Check title
            assert "AIDA64" in page.title()

            # 2. Check WebSocket live badge (in light DOM)
            page.wait_for_selector("#status-badge.live", timeout=15000)
            status_text = page.locator("#status-text").inner_text()
            assert "مباشر" in status_text or "WebSocket" in status_text, f"Expected live status, got: {status_text}"

            # 3. Wait for live telemetry (may be in shadow DOM)
            page.wait_for_function("""
                () => {
                    let el = document.getElementById("cpu_temp");
                    if (el && el.innerText !== "--") return true;
                    const hosts = document.querySelectorAll("*");
                    for (const host of hosts) {
                        if (host.shadowRoot) {
                            el = host.shadowRoot.getElementById("cpu_temp");
                            if (el && el.innerText !== "--") return true;
                        }
                    }
                    return false;
                }
            """, timeout=15000)

            # 4. Verify DOM values (piercing Shadow DOM)
            cpu_temp = page.evaluate(DEEP_QUERY_JS, "cpu_temp")
            gpu_temp = page.evaluate(DEEP_QUERY_JS, "gpu_temp")
            ram_pct = page.evaluate(DEEP_QUERY_JS, "ram_used_percent")
            total_power = page.evaluate(DEEP_QUERY_JS, "total_power")
            date_greg = page.evaluate(DEEP_QUERY_JS, "date_gregorian")
            cpu_volt = page.evaluate(DEEP_QUERY_JS, "cpu_voltage")
            date_hijri = page.evaluate(DEEP_QUERY_JS, "date_hijri")

            assert cpu_temp and cpu_temp != "--" and float(cpu_temp) > 0
            assert gpu_temp and gpu_temp != "--" and float(gpu_temp) > 0
            assert ram_pct and ram_pct != "--" and float(ram_pct) > 0
            assert total_power and total_power != "--" and float(total_power) > 0
            assert date_greg and date_greg != "--/--/--" and len(date_greg) >= 8
            assert date_hijri and "1448" in date_hijri
            assert cpu_volt and cpu_volt != "--" and float(cpu_volt) > 0

            # 5. Capture visual verification screenshot
            screenshots_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "screenshots"))
            os.makedirs(screenshots_dir, exist_ok=True)
            screenshot_path = os.path.join(screenshots_dir, "dashboard_e2e_live.png")
            screenshot_rec_path = os.path.join(screenshots_dir, "dashboard_recovered.png")
            page.screenshot(path=screenshot_path, full_page=True)
            import shutil
            shutil.copyfile(screenshot_path, screenshot_rec_path)

            # 6. Test Interactive Theme Dropdown Menu & Direct Theme Selection
            btn_theme = page.locator("#btn-theme-toggle")
            assert btn_theme.is_visible(), "Theme dropdown trigger button must be visible"

            # Open Theme Dropdown Menu
            btn_theme.click()
            page.wait_for_timeout(600)
            dropdown_menu = page.locator("#theme-dropdown-menu")
            assert dropdown_menu.is_visible(), "Theme dropdown menu must open upon trigger click"
            page.screenshot(path=os.path.join(screenshots_dir, "theme_dropdown_menu_open.png"), full_page=True)

            # Direct Selection 1: Neo-Skeuomorphic Tactile System
            item_neo = page.locator(".theme-menu-item[data-theme-id='neo-tactile']")
            assert item_neo.is_visible(), "Neo-tactile theme item must be visible in dropdown"
            item_neo.click()
            # Wait for circular ripple View Transition animation (0.65s) to fully finish and remove pseudo-elements
            page.wait_for_timeout(1400)
            theme_attr = page.locator("html").get_attribute("data-theme")
            assert theme_attr == "neo-tactile", f"Expected theme 'neo-tactile', got: {theme_attr}"
            page.screenshot(path=os.path.join(screenshots_dir, "dashboard_theme_neo_tactile.png"), full_page=True)

            # Direct Selection 2: Deep Space Aurora
            btn_theme.click()
            page.wait_for_timeout(400)
            page.locator(".theme-menu-item[data-theme-id='aurora']").click()
            page.wait_for_timeout(800)
            theme_attr = page.locator("html").get_attribute("data-theme")
            assert theme_attr == "aurora", f"Expected theme 'aurora', got: {theme_attr}"

            # Direct Selection 3: Formula 1 Pitwall
            btn_theme.click()
            page.wait_for_timeout(400)
            page.locator(".theme-menu-item[data-theme-id='f1-pitwall']").click()
            page.wait_for_timeout(800)
            theme_attr = page.locator("html").get_attribute("data-theme")
            assert theme_attr == "f1-pitwall", f"Expected theme 'f1-pitwall', got: {theme_attr}"

            # Direct Selection 4: Reset back to Default (Cyan Glass)
            btn_theme.click()
            page.wait_for_timeout(400)
            page.locator(".theme-menu-item[data-theme-id='default']").click()
            page.wait_for_timeout(800)
            theme_attr = page.locator("html").get_attribute("data-theme")
            assert theme_attr is None or theme_attr == "default", f"Expected default theme, got: {theme_attr}"
            page.screenshot(path=os.path.join(screenshots_dir, "dashboard_theme_default.png"), full_page=True)

            # Verify localStorage persistence
            saved_theme = page.evaluate("() => localStorage.getItem('aida64_theme')")
            assert saved_theme == "default", f"Expected localStorage 'default', got: {saved_theme}"

            # 7. Test Proposal #2: Interactive Neon Critical Thermal Alerts & Hysteresis
            # Inject simulated critical temperature (CPU 89°C, GPU 88°C) via stateManager
            page.evaluate("() => window.stateManager.setMockTelemetry({ cpu_temp: 89.0, gpu_temp: 88.0 })")
            
            # Wait for animation frame & LERP to cross 85°C threshold
            page.wait_for_function("""() => {
                const cpuCard = document.getElementById('card-cpu');
                const gpuCard = document.getElementById('card-gpu');
                return cpuCard && cpuCard.classList.contains('critical-thermal') &&
                       gpuCard && gpuCard.classList.contains('critical-thermal');
            }""", timeout=5000)

            # Capture live screenshot of the critical neon thermal breathing glow
            thermal_screenshot_path = os.path.join(screenshots_dir, "dashboard_thermal_alert_live.png")
            page.screenshot(path=thermal_screenshot_path, full_page=True)

            # Test ISA-18.2 Deadband (Hysteresis): Temp drops to 83.5°C (above 82°C OFF threshold) -> Alert MUST stay active
            page.evaluate("() => window.stateManager.setMockTelemetry({ cpu_temp: 83.5, gpu_temp: 83.5 })")
            page.wait_for_timeout(500)
            cpu_still_critical = page.evaluate("() => document.getElementById('card-cpu').classList.contains('critical-thermal')")
            gpu_still_critical = page.evaluate("() => document.getElementById('card-gpu').classList.contains('critical-thermal')")
            assert cpu_still_critical, "CPU alert should remain active in deadband (83.5°C > 82°C)"
            assert gpu_still_critical, "GPU alert should remain active in deadband (83.5°C > 82°C)"

            # Test Clearance: Temp drops below 82°C (e.g. 65°C) after MIN_HOLD_MS (1500ms)
            time.sleep(1.6)
            page.evaluate("() => window.stateManager.setMockTelemetry({ cpu_temp: 65.0, gpu_temp: 60.0 })")
            page.wait_for_function("""() => {
                const cpuCard = document.getElementById('card-cpu');
                const gpuCard = document.getElementById('card-gpu');
                return cpuCard && !cpuCard.classList.contains('critical-thermal') &&
                       gpuCard && !gpuCard.classList.contains('critical-thermal');
            }""", timeout=5000)

            # Reset mock telemetry back to live stream
            page.evaluate("() => window.stateManager.setMockTelemetry(null)")

            # 8. Test Proposal #1: Hybrid 20-Core Matrix (8P + 12E) & 3D Flip Card
            # Capture Front Face with Micro-Cores Strip
            front_screenshot_path = os.path.join(screenshots_dir, "dashboard_cpu_front.png")
            page.screenshot(path=front_screenshot_path, full_page=True)

            # Assert Micro Heatmap Strip exists and has 8 P-mini-bars and 12 E-mini-bars
            p_mini_count = page.evaluate("() => document.getElementById('card-cpu').shadowRoot.getElementById('p-mini-bars').children.length")
            e_mini_count = page.evaluate("() => document.getElementById('card-cpu').shadowRoot.getElementById('e-mini-bars').children.length")
            assert p_mini_count == 8, f"Expected 8 P-mini-bars, got {p_mini_count}"
            assert e_mini_count == 12, f"Expected 12 E-mini-bars, got {e_mini_count}"

            # Click Flip Button to trigger 3D Flip
            page.evaluate("() => document.getElementById('card-cpu').shadowRoot.getElementById('btn-flip-cores').click()")
            page.wait_for_function("() => document.getElementById('card-cpu').classList.contains('flipped')", timeout=3000)
            page.wait_for_timeout(800)  # Wait for CSS 3D transition

            # Verify Back Face 20-Core Matrix DOM elements
            p_cells_count = page.evaluate("() => document.getElementById('card-cpu').shadowRoot.getElementById('p-cores-grid').children.length")
            e_cells_count = page.evaluate("() => document.getElementById('card-cpu').shadowRoot.getElementById('e-cores-grid').children.length")
            assert p_cells_count == 8, f"Expected 8 P-Core cells, got {p_cells_count}"
            assert e_cells_count == 12, f"Expected 12 E-Core cells, got {e_cells_count}"

            # Capture live screenshot of the 3D Flipped Back Face
            flipped_screenshot_path = os.path.join(screenshots_dir, "dashboard_cpu_cores_flipped.png")
            page.screenshot(path=flipped_screenshot_path, full_page=True)

            # Flip back to front
            page.evaluate("() => document.getElementById('card-cpu').shadowRoot.getElementById('btn-flip-back').click()")
            page.wait_for_function("() => !document.getElementById('card-cpu').classList.contains('flipped')", timeout=3000)
            page.wait_for_timeout(700)

            print(f"\n[Playwright E2E] UI successfully connected and rendered live metrics:")
            print(f"   [OK] CPU Temp    : {cpu_temp} C")
            print(f"   [OK] GPU Temp    : {gpu_temp} C")
            print(f"   [OK] RAM Used    : {ram_pct} %")
            print(f"   [OK] Total Power : {total_power} W")
            print(f"   [OK] Date Greg   : {date_greg}")
            print(f"   [OK] Date Hijri  : {date_hijri}")
            print(f"   [OK] CPU Voltage : {cpu_volt} V")
            print(f"   [OK] All 4 Themes Verified & Captured Successfully!")
            print(f"   [OK] Critical Thermal Alerts & Hysteresis Verified Successfully!")
            print(f"   [OK] Hybrid 20-Core Matrix & 3D Flip Card Verified Successfully!")
            print(f"   [OK] Screenshots saved in: {screenshots_dir}")

            browser.close()
    finally:
        server.should_exit = True
        thread.join(timeout=2.0)


if __name__ == "__main__":
    pytest.main(["-v", "-s", __file__])
