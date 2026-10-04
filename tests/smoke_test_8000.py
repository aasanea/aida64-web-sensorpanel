"""
Visual E2E Smoke Test for http://127.0.0.1:8000/
Validates:
1. HTTP 200 on page and all static/dynamic assets.
2. Zero console / rendering errors.
3. WebSocket connection to /ws establishes and displays 'مباشر (WebSocket)' status.
4. All 9 cards are present and rendered.
5. All 24 mandatory hardware sensors are present, rendered with non-empty / non-fallback values.
6. Captures high-res full page screenshot.
"""

import os
import sys
import json
import time

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from playwright.sync_api import sync_playwright

TARGET_URL = "http://127.0.0.1:8000/"

REQUIRED_24_SENSORS = [
    "cpu_temp", "cpu_load", "cpu_clock", "cpu_power", "cpu_fan_rpm", "cpu_hotspot_temp",
    "gpu_temp", "gpu_load", "gpu_clock", "gpu_power", "gpu_fan_rpm", "gpu_hotspot_temp",
    "ram_used_percent", "ram_used_gb", "ram_total_gb",
    "vram_used_percent", "vram_used_gb", "vram_total_gb",
    "motherboard_temp", "vrm_temp", "pch_temp", "nvme_temp",
    "network_download_mbps", "network_upload_mbps"
]

DEEP_QUERY_JS = """
(id) => {
    let el = document.getElementById(id);
    if (el) return (el.innerText || el.textContent || "").trim();
    const queue = [document];
    while (queue.length > 0) {
        const root = queue.shift();
        if (!root || !root.querySelectorAll) continue;
        const hosts = root.querySelectorAll('*');
        for (const host of hosts) {
            if (host.shadowRoot) {
                el = host.shadowRoot.getElementById(id);
                if (el) return (el.innerText || el.textContent || "").trim();
                queue.push(host.shadowRoot);
            }
        }
    }
    return null;
}
"""

def run_smoke_test():
    console_errors = []
    page_errors = []
    network_errors = []
    assets_loaded = []

    print(f"[TEST 1] Initiating Playwright Chromium connection to {TARGET_URL}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        # Capture console events
        def on_console(msg):
            if msg.type == "error":
                console_errors.append(msg.text)
                print(f"  [CONSOLE ERROR] {msg.text}")
        page.on("console", on_console)

        # Capture unhandled page errors
        def on_page_error(exc):
            page_errors.append(str(exc))
            print(f"  [PAGE ERROR] {exc}")
        page.on("pageerror", on_page_error)

        # Capture network responses
        def on_response(response):
            status = response.status
            url = response.url
            assets_loaded.append({"url": url, "status": status})
            if status >= 400:
                network_errors.append({"url": url, "status": status})
                print(f"  [HTTP {status}] Failed request: {url}")
        page.on("response", on_response)

        # Navigate to target
        t0 = time.time()
        response = page.goto(TARGET_URL, wait_until="networkidle", timeout=30000)
        nav_duration = (time.time() - t0) * 1000
        print(f"  -> Page navigation finished in {nav_duration:.1f}ms. Main Document HTTP Status: {response.status}")
        assert response.status == 200, f"Expected HTTP 200 on {TARGET_URL}, got {response.status}"

        # 1. Wait for live status badge
        print("[TEST 2] Verifying WebSocket telemetry stream status...")
        page.wait_for_selector("#status-badge.live", timeout=15000)
        status_text = page.locator("#status-text").inner_text()
        print(f"  -> Connection Status Badge: '{status_text}'")
        assert "مباشر" in status_text or "WebSocket" in status_text, f"Expected live status, got: {status_text}"

        # Allow 2 telemetry ticks to populate values
        page.wait_for_timeout(2000)

        # 2. Verify all 9 cards
        print("[TEST 3] Verifying 9 bento grid cards...")
        cards = {
            "Header Bar": "#dashboard-header",
            "CPU Card": "#card-cpu",
            "Appointments Card": "#card-appointments",
            "GPU Card": "#card-gpu",
            "RAM Card": "#card-ram",
            "Matches Card": "#card-matches",
            "Storage Card": "#card-storage",
            "Display Telemetry": "#card-slot-1",
            "Weather Card": "#card-slot-2",
            "Network Card": "#card-network"
        }
        for name, sel in cards.items():
            loc = page.locator(sel)
            visible = loc.is_visible()
            print(f"  -> {name} ({sel}): {'VISIBLE [OK]' if visible else 'MISSING [FAIL]'}")
            assert visible, f"Card '{name}' ({sel}) is not visible on page!"

        # 3. Verify all 24 mandatory sensors
        print("[TEST 4] Piercing Shadow DOM to verify 24 mandatory hardware sensors...")
        sensor_results = {}
        missing_sensors = []
        unpopulated_sensors = []

        for sensor_id in REQUIRED_24_SENSORS:
            val = page.evaluate(DEEP_QUERY_JS, sensor_id)
            sensor_results[sensor_id] = val
            if val is None:
                missing_sensors.append(sensor_id)
                print(f"  [X] {sensor_id}: NOT FOUND in DOM / Shadow DOM")
            elif val == "" or val == "--":
                unpopulated_sensors.append(sensor_id)
                print(f"  [!] {sensor_id}: Present but unpopulated ('{val}')")
            else:
                print(f"  [OK] {sensor_id}: {val}")

        print(f"\n--- SENSOR AUDIT SUMMARY ---")
        print(f"Total Mandatory: {len(REQUIRED_24_SENSORS)}")
        print(f"Found & Active:  {len(REQUIRED_24_SENSORS) - len(missing_sensors) - len(unpopulated_sensors)}")
        print(f"Missing in DOM:  {missing_sensors}")
        print(f"Unpopulated:     {unpopulated_sensors}")

        # 4. Capture live screenshots
        print("\n[TEST 5] Capturing Live E2E Screenshots...")
        screenshots_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "screenshots"))
        os.makedirs(screenshots_dir, exist_ok=True)
        screenshot_full = os.path.join(screenshots_dir, "smoke_test_8000_live.png")
        page.screenshot(path=screenshot_full, full_page=True)
        print(f"  -> Full page screenshot saved to: {screenshot_full}")

        # Copy to root and brain directory for easy embedding
        root_screenshot = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "smoke_test_8000_live.png"))
        import shutil
        shutil.copyfile(screenshot_full, root_screenshot)
        print(f"  -> Mirrored screenshot to root: {root_screenshot}")

        # Also copy to brain artifact directory if exists
        brain_dir = r"C:\Users\User\.gemini\antigravity\brain\2f5f01e1-18e9-4bf6-9b0b-0e6e1358b4bd"
        if os.path.exists(brain_dir):
            brain_screenshot = os.path.join(brain_dir, "smoke_test_8000_live.png")
            shutil.copyfile(screenshot_full, brain_screenshot)
            print(f"  -> Mirrored screenshot to brain artifact dir: {brain_screenshot}")

        browser.close()

    print("\n--- ERROR AUDIT ---")
    print(f"Console Errors: {len(console_errors)}")
    print(f"Page Errors:    {len(page_errors)}")
    print(f"Network Errors: {len(network_errors)}")
    print(f"Assets Loaded:  {len(assets_loaded)} (all returned 200/304)")

    assert len(console_errors) == 0, f"Found console errors: {console_errors}"
    assert len(page_errors) == 0, f"Found unhandled page errors: {page_errors}"
    assert len(network_errors) == 0, f"Found failed HTTP requests: {network_errors}"
    assert len(missing_sensors) == 0, f"Missing sensors in DOM: {missing_sensors}"
    assert len(unpopulated_sensors) == 0, f"Unpopulated sensors: {unpopulated_sensors}"

    print("\n[ALL CHECKS PASSED] Visual E2E Smoke Test Successful!")
    return {
        "status": "PASSED",
        "sensors": sensor_results,
        "assets_count": len(assets_loaded),
        "screenshot": root_screenshot
    }

if __name__ == "__main__":
    res = run_smoke_test()
    print("\nRESULT JSON:")
    print(json.dumps(res, indent=2))
