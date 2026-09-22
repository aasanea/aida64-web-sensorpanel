"""
Frontend verification tests for AIDA64 Glassmorphism 2.0 Dashboard.
Audits the modular Web Components architecture against strict specifications:
- 24 mandatory sensors contract (across index.html + Web Component JS files)
- Strict CSS specification for Glassmorphism 2.0 (design-tokens.css + style.css)
- Google Fonts: Orbitron, Rajdhani, Tajawal, Cairo
- Progress bar Arabic labels & 100cm typography
- EventBus, StateManager, and WebSocket architecture
"""

import os
import re
import glob
import pytest

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
INDEX_HTML = os.path.join(FRONTEND_DIR, "index.html")
STYLE_CSS = os.path.join(FRONTEND_DIR, "css", "style.css")
DESIGN_TOKENS_CSS = os.path.join(FRONTEND_DIR, "css", "design-tokens.css")
APP_JS = os.path.join(FRONTEND_DIR, "js", "app.js")
COMPONENTS_DIR = os.path.join(FRONTEND_DIR, "js", "components")
STORE_DIR = os.path.join(FRONTEND_DIR, "js", "store")

REQUIRED_24_SENSORS = [
    "cpu_temp", "cpu_load", "cpu_clock", "cpu_power", "cpu_fan_rpm", "cpu_hotspot_temp",
    "gpu_temp", "gpu_load", "gpu_clock", "gpu_power", "gpu_fan_rpm", "gpu_hotspot_temp",
    "ram_used_percent", "ram_used_gb", "ram_total_gb",
    "vram_used_percent", "vram_used_gb", "vram_total_gb",
    "motherboard_temp", "vrm_temp", "pch_temp", "nvme_temp",
    "network_download_mbps", "network_upload_mbps"
]


def _read_all_frontend_sources():
    """Read all frontend source files (HTML + JS components) into one combined string."""
    sources = []
    # index.html
    if os.path.exists(INDEX_HTML):
        with open(INDEX_HTML, "r", encoding="utf-8") as f:
            sources.append(f.read())
    # All JS component files (Web Components contain HTML templates)
    for js_file in glob.glob(os.path.join(COMPONENTS_DIR, "*.js")):
        with open(js_file, "r", encoding="utf-8") as f:
            sources.append(f.read())
    # app.js
    if os.path.exists(APP_JS):
        with open(APP_JS, "r", encoding="utf-8") as f:
            sources.append(f.read())
    return "\n".join(sources)


def _read_all_css_sources():
    """Read all CSS files (design-tokens.css + style.css) into one combined string."""
    sources = []
    for css_file in [DESIGN_TOKENS_CSS, STYLE_CSS]:
        if os.path.exists(css_file):
            with open(css_file, "r", encoding="utf-8") as f:
                sources.append(f.read())
    # Also scan component JS files for Shadow DOM CSS
    for js_file in glob.glob(os.path.join(COMPONENTS_DIR, "*.js")):
        with open(js_file, "r", encoding="utf-8") as f:
            sources.append(f.read())
    return "\n".join(sources)


def _read_all_js_sources():
    """Read all JS files (app.js + store/ + components/) into one combined string."""
    sources = []
    for js_file in [APP_JS]:
        if os.path.exists(js_file):
            with open(js_file, "r", encoding="utf-8") as f:
                sources.append(f.read())
    for directory in [STORE_DIR, COMPONENTS_DIR]:
        if os.path.isdir(directory):
            for js_file in glob.glob(os.path.join(directory, "*.js")):
                with open(js_file, "r", encoding="utf-8") as f:
                    sources.append(f.read())
    return "\n".join(sources)


def test_files_exist():
    assert os.path.exists(INDEX_HTML), "index.html does not exist"
    assert os.path.exists(STYLE_CSS), "style.css does not exist"
    assert os.path.exists(DESIGN_TOKENS_CSS), "design-tokens.css does not exist"
    assert os.path.exists(APP_JS), "app.js does not exist"
    assert os.path.isdir(COMPONENTS_DIR), "js/components/ directory does not exist"
    assert os.path.isdir(STORE_DIR), "js/store/ directory does not exist"


def test_24_sensors_present_in_html():
    """Sensors may be in index.html or inside Web Component shadow DOM templates."""
    all_sources = _read_all_frontend_sources()

    missing = []
    for sensor in REQUIRED_24_SENSORS:
        # Check for id="sensor" or getElementById('sensor') or template literals
        pattern = rf"""(id=['"]?{sensor}['"]?|getElementById\(['"]{sensor}['"]\)|#{sensor}['" ])"""
        if not re.search(pattern, all_sources):
            missing.append(sensor)

    assert not missing, f"Missing sensors across frontend sources: {missing}"


def test_google_fonts_present():
    with open(INDEX_HTML, "r", encoding="utf-8") as f:
        html = f.read()

    for font in ["Orbitron", "Rajdhani", "Tajawal", "Cairo"]:
        assert font in html, f"Missing Google Font {font} in index.html"


def test_strict_glassmorphism_css():
    """Glassmorphism specs may be split across design-tokens.css and style.css."""
    all_css = _read_all_css_sources()

    # Glassmorphism specs must be defined in :root CSS variables
    variable_requirements = [
        "--glass-bg: rgba(255, 255, 255, 0.03);",
        "--glass-blur: blur(24px) saturate(180%);",
        "--glass-border: 1px solid rgba(255, 255, 255, 0.08);",
        "--glass-radius: 20px;",
        "--glass-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 8px 32px 0 rgba(0, 0, 0, 0.4);",
    ]
    for req in variable_requirements:
        assert req in all_css, f"Strict CSS variable missing: {req}"

    # .glass-card must reference the variables
    var_references = [
        "background: var(--glass-bg);",
        "backdrop-filter: var(--glass-blur);",
        "-webkit-backdrop-filter: var(--glass-blur);",
        "border: var(--glass-border);",
        "border-radius: var(--glass-radius);",
        "box-shadow: var(--glass-shadow);",
        "padding: 24px;"
    ]
    for req in var_references:
        assert req in all_css, f"Strict CSS requirement missing in .glass-card: {req}"


def test_arabic_labels_on_progress_bars():
    """Arabic labels may be in index.html or inside Web Component JS templates."""
    all_sources = _read_all_frontend_sources()

    arabic_labels = ["نسبة الاستهلاك", "التردد MHz", "الطاقة W", "المروحة RPM", "نشاط التنزيل", "نشاط الرفع"]
    for label in arabic_labels:
        assert label in all_sources, f"Missing Arabic label: {label}"


def test_units_displayed():
    """Units may be in index.html or inside Web Component JS templates."""
    all_sources = _read_all_frontend_sources()

    for unit in ["°C", "MHz", "W", "RPM", "GB", "Mbps", "%"]:
        assert unit in all_sources, f"Missing visible unit {unit} in frontend sources"


def test_app_js_eventbus_and_features():
    """Features may be spread across app.js, state_manager.js, and event_bus.js."""
    all_js = _read_all_js_sources()

    assert "EventBus" in all_js, "EventBus missing from JS sources"
    assert "on(" in all_js and "emit(" in all_js, "EventBus on/emit missing"
    assert "requestAnimationFrame" in all_js, "requestAnimationFrame missing"
    assert "ping" in all_js and "pong" in all_js, "Heartbeat ping-pong missing"
    assert "api/sensors" in all_js, "Polling fallback endpoint missing"
    assert "reconnect" in all_js.lower(), "Reconnect mechanism missing"
    assert "8088" in all_js, "Port 8088 missing from fallback endpoint"


def test_weekdays_strip_present():
    all_sources = _read_all_frontend_sources()

    assert 'id="weekdays-strip"' in all_sources, "weekdays-strip missing from frontend sources"
    for day in ["السبت", "الأحد", "الأثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]:
        assert day in all_sources, f"Day {day} missing from weekdays-strip in frontend sources"

    all_css = _read_all_css_sources()
    assert ".weekdays-strip" in all_css, ".weekdays-strip missing from CSS"
    assert ".weekday-pill.active-day" in all_css or "active-day" in all_css, ".weekday-pill.active-day missing from CSS"

    all_js = _read_all_js_sources()
    assert "updateWeekdays" in all_js, "updateWeekdays missing from JS"


def test_web_components_registered():
    """Verify that Web Component custom elements are imported and used."""
    with open(INDEX_HTML, "r", encoding="utf-8") as f:
        html = f.read()

    expected_tags = [
        "dashboard-header", "dashboard-cpu", "dashboard-gpu", "dashboard-ram",
        "dashboard-storage", "dashboard-network",
        "dashboard-display", "dashboard-weather", "dashboard-appointments",
        "dashboard-matches"
    ]
    for tag in expected_tags:
        assert tag in html, f"Custom element <{tag}> missing from index.html"

    # Verify component JS files exist (including dashboard-vram and dashboard-thermals for backward compatibility)
    for tag in expected_tags + ["dashboard-vram", "dashboard-thermals"]:
        js_file = os.path.join(COMPONENTS_DIR, f"{tag}.js")
        assert os.path.exists(js_file), f"Component file {tag}.js missing from js/components/"


def test_matches_center_card_3d_flip():
    """Verify Live Matches and Saudi Pro League Standings 3D Flip Card."""
    matches_js_path = os.path.join(COMPONENTS_DIR, "dashboard-matches.js")
    with open(matches_js_path, "r", encoding="utf-8") as f:
        matches_js = f.read()

    # 1. 3D Flip Mechanics & Structure
    assert "card-flipper" in matches_js
    assert "card-front" in matches_js
    assert "card-back" in matches_js
    assert "btn-flip-standings" in matches_js
    assert "btn-flip-matches" in matches_js
    assert "perspective: 1200px" in matches_js

    # 2. Typography Standard (24px Title, 18-19px Team names)
    assert "font-size: 24px" in matches_js
    assert "font-size: 18px" in matches_js or "font-size: 19px" in matches_js
    assert "دوري روشن" in matches_js
    assert "نخبة آسيا" in matches_js
    assert "كأس الملك" in matches_js


def test_gpu_unified_vram_3d_flip():
    """Verify GPU & VRAM Unified 3D Flip Card architecture."""
    gpu_js_path = os.path.join(COMPONENTS_DIR, "dashboard-gpu.js")
    with open(gpu_js_path, "r", encoding="utf-8") as f:
        gpu_js = f.read()

    # 1. 3D Flip Mechanics & Architecture
    assert "card-flipper" in gpu_js, "card-flipper container missing in dashboard-gpu.js"
    assert "card-front" in gpu_js, "card-front face missing in dashboard-gpu.js"
    assert "card-back" in gpu_js, "card-back face missing in dashboard-gpu.js"
    assert "btn-flip-details" in gpu_js, "btn-flip-details toggle button missing in dashboard-gpu.js"
    assert "btn-flip-back" in gpu_js, "btn-flip-back toggle button missing in dashboard-gpu.js"
    assert "toggleFlip" in gpu_js, "toggleFlip method missing in dashboard-gpu.js"
    assert "perspective: 1200px" in gpu_js, "3D perspective missing in dashboard-gpu.js"

    # 2. Front Face Mission-Critical Metrics
    assert "gpu_temp" in gpu_js, "gpu_temp missing in dashboard-gpu.js"
    assert "gpu_load" in gpu_js, "gpu_load missing in dashboard-gpu.js"
    assert "gpu_clock" in gpu_js, "gpu_clock missing in dashboard-gpu.js"
    assert "gpu_power" in gpu_js, "gpu_power missing in dashboard-gpu.js"
    assert "vram_used_gb" in gpu_js, "vram_used_gb missing in dashboard-gpu.js"
    assert "vram_total_gb" in gpu_js, "vram_total_gb missing in dashboard-gpu.js"
    assert "vram_used_percent" in gpu_js, "vram_used_percent missing in dashboard-gpu.js"

    # 3. Back Face Deep Telemetry
    assert "gpu_hotspot_back" in gpu_js or "gpu_hotspot_temp" in gpu_js, "gpu_hotspot missing in dashboard-gpu.js"
    assert "vram_temp" in gpu_js, "vram_temp missing in dashboard-gpu.js"
    assert "vram_speed_mhz" in gpu_js, "vram_speed_mhz missing in dashboard-gpu.js"
    assert "gpu_fan_rpm" in gpu_js, "gpu_fan_rpm missing in dashboard-gpu.js"
    assert "gpu_voltage_mv" in gpu_js, "gpu_voltage_mv missing in dashboard-gpu.js"


def test_state_manager_exists():
    """Verify StateManager and EventBus exist in store/."""
    sm_path = os.path.join(STORE_DIR, "state_manager.js")
    eb_path = os.path.join(STORE_DIR, "event_bus.js")
    assert os.path.exists(sm_path), "state_manager.js missing from js/store/"
    assert os.path.exists(eb_path), "event_bus.js missing from js/store/"


def test_preset_themes_and_switcher():
    """Verify OLED Black, Cyberpunk, Emerald themes, Zero-FOUT script, and theme switcher."""
    with open(DESIGN_TOKENS_CSS, "r", encoding="utf-8") as f:
        tokens_css = f.read()

    assert 'html[data-theme="oled"]' in tokens_css, "OLED Black theme missing in design-tokens.css"
    assert 'html[data-theme="cyberpunk"]' in tokens_css, "Cyberpunk theme missing in design-tokens.css"
    assert 'html[data-theme="emerald"]' in tokens_css, "Emerald theme missing in design-tokens.css"

    with open(INDEX_HTML, "r", encoding="utf-8") as f:
        index_html = f.read()

    assert "aida64_theme" in index_html, "Zero-FOUT theme initializer missing from index.html"

    header_js_path = os.path.join(COMPONENTS_DIR, "dashboard-header.js")
    with open(header_js_path, "r", encoding="utf-8") as f:
        header_js = f.read()

    assert "btn-theme-toggle" in header_js, "btn-theme-toggle missing from dashboard-header.js"
    assert "startViewTransition" in header_js, "View Transitions API call missing in dashboard-header.js"
    assert "THEMES" in header_js, "THEMES list missing in dashboard-header.js"


def test_critical_thermal_alert_definitions():
    """Verify Proposal #2: Neon Critical Thermal Alerts, GPU-composite CSS, and ISA-18.2 Hysteresis."""
    css_sources = _read_all_css_sources()
    js_sources = _read_all_js_sources()

    # 1. CSS Animations & GPU Compositor
    assert ".glass-card.critical-thermal::after" in css_sources, "critical-thermal pseudo-element glow missing in CSS"
    assert "@keyframes thermal-glow-pulse" in css_sources, "thermal-glow-pulse keyframe missing in CSS"
    assert "prefers-reduced-motion" in css_sources, "prefers-reduced-motion accessibility missing in CSS"

    # 2. CPU & GPU Shadow DOM styling
    cpu_js_path = os.path.join(COMPONENTS_DIR, "dashboard-cpu.js")
    gpu_js_path = os.path.join(COMPONENTS_DIR, "dashboard-gpu.js")

    with open(cpu_js_path, "r", encoding="utf-8") as f:
        cpu_js = f.read()
    with open(gpu_js_path, "r", encoding="utf-8") as f:
        gpu_js = f.read()

    for comp_name, comp_code in [("CPU", cpu_js), ("GPU", gpu_js)]:
        assert ":host(.critical-thermal)" in comp_code, f":host(.critical-thermal) missing in {comp_name}"
        assert "updateThermalAlarm" in comp_code, f"updateThermalAlarm method missing in {comp_name}"
        assert "HYSTERESIS_ON = 85" in comp_code, f"HYSTERESIS_ON = 85 missing in {comp_name}"
        assert "HYSTERESIS_OFF = 82" in comp_code, f"HYSTERESIS_OFF = 82 missing in {comp_name}"
        assert "HOTSPOT_ON = 95" in comp_code, f"HOTSPOT_ON = 95 missing in {comp_name}"
        assert "HOTSPOT_OFF = 90" in comp_code, f"HOTSPOT_OFF = 90 missing in {comp_name}"
        assert "MIN_HOLD_MS = 1500" in comp_code, f"MIN_HOLD_MS = 1500 missing in {comp_name}"
        assert "thermal:critical" in comp_code, f"thermal:critical EventBus emit missing in {comp_name}"


def test_hybrid_core_matrix_and_3d_flip():
    """Verify Proposal #1: Hybrid Core Matrix (8 P-Cores + 12 E-Cores) & 3D Flip Card."""
    cpu_js_path = os.path.join(COMPONENTS_DIR, "dashboard-cpu.js")
    with open(cpu_js_path, "r", encoding="utf-8") as f:
        cpu_js = f.read()

    # 1. 3D Flip Mechanics & Architecture
    assert "card-flipper" in cpu_js, "card-flipper container missing in dashboard-cpu.js"
    assert "card-front" in cpu_js, "card-front face missing in dashboard-cpu.js"
    assert "card-back" in cpu_js, "card-back face missing in dashboard-cpu.js"
    assert "btn-flip-cores" in cpu_js, "btn-flip-cores toggle button missing in dashboard-cpu.js"
    assert "btn-flip-back" in cpu_js, "btn-flip-back toggle button missing in dashboard-cpu.js"
    assert "toggleFlip" in cpu_js, "toggleFlip method missing in dashboard-cpu.js"

    # 2. Micro Heatmap Strip (Front face)
    assert "micro-cores-strip" in cpu_js, "micro-cores-strip missing in dashboard-cpu.js"
    assert "p-mini-bars" in cpu_js, "p-mini-bars container missing in dashboard-cpu.js"
    assert "e-mini-bars" in cpu_js, "e-mini-bars container missing in dashboard-cpu.js"

    # 3. Detailed 20-Core Matrix (Back face)
    assert "p-cores-grid" in cpu_js, "p-cores-grid missing in dashboard-cpu.js"
    assert "e-cores-grid" in cpu_js, "e-cores-grid missing in dashboard-cpu.js"
    assert "p-cores-avg" in cpu_js, "p-cores-avg display missing in dashboard-cpu.js"
    assert "e-cores-avg" in cpu_js, "e-cores-avg display missing in dashboard-cpu.js"
    assert "buildCoreDOMElements" in cpu_js, "buildCoreDOMElements method missing in dashboard-cpu.js"
    assert "renderCores" in cpu_js, "renderCores method missing in dashboard-cpu.js"

    # 4. Host perspective CSS
    css_sources = _read_all_css_sources()
    assert "perspective: 1200px" in css_sources or "perspective: 1200px" in cpu_js, "3D perspective missing in CSS"


if __name__ == "__main__":
    pytest.main(["-v", __file__])


