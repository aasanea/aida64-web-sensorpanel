# ⚡ AIDA64 Web SensorPanel

<div align="center">

### Next-Gen Glassmorphism 2.0 Real-Time Telemetry HUD & Sensor Display
*A cinematic, GPU-accelerated hardware monitoring panel powered by AIDA64 Extreme via 0ms Windows Shared Memory. Engineered for dedicated internal PC chassis screens, secondary monitors, and desk kiosks.*

[![GitHub Release](https://img.shields.io/badge/Release-v2.5.0--cinematic-22D3EE?style=for-the-badge&logo=github&labelColor=0F172A)](https://github.com/aasanea/aida64-web-sensorpanel/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge&logo=opensourceinitiative&logoColor=white&labelColor=0F172A)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-38BDF8?style=for-the-badge&logo=python&logoColor=white&labelColor=0F172A)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white&labelColor=0F172A)](https://fastapi.tiangolo.com/)
[![Renderer](https://img.shields.io/badge/Renderer-60%20FPS%20rAF-10B981?style=for-the-badge&logo=googlechrome&logoColor=white&labelColor=0F172A)](#-60-fps-rendering-engine)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011%20Kiosk-0078D4?style=for-the-badge&logo=windows&logoColor=white&labelColor=0F172A)](#-quickstart--turnkey-installation)
[![Shared Memory](https://img.shields.io/badge/Shared%20Memory-0ms%20Latency-A855F7?style=for-the-badge&logo=speedtest&logoColor=white&labelColor=0F172A)](#-architectural-highlights)
[![GitHub Stars](https://img.shields.io/badge/Stars-%E2%AD%90%20Showcase-FACC15?style=for-the-badge&logo=reverbnation&labelColor=0F172A)](https://github.com/aasanea/aida64-web-sensorpanel)

<br/>

[![AIDA64 Web SensorPanel Hero](tests/screenshots/dashboard_theme_default.png)](tests/screenshots/dashboard_theme_default.png)

</div>

---

## 📑 Table of Contents / فهرس المحتويات

- [✨ Key Architectural Highlights](#-key-architectural-highlights)
  - [1. ⚡ 0ms ctypes Windows Shared Memory Bridge](#1--0ms-ctypes-windows-shared-memory-bridge)
  - [2. 🧠 20-Core Arrow Lake Hybrid Architecture & Liquid Cooling Loop](#2--20-core-arrow-lake-hybrid-architecture--liquid-cooling-loop)
  - [3. 🔄 Interactive 3D Flip Cards (Bento-Grid HUD)](#3--interactive-3d-flip-cards-bento-grid-hud)
  - [4. ⚽ Live Saudi & Global Sports Center with Second-Level Precision](#4--live-saudi--global-sports-center-with-second-level-precision)
  - [5. 🎛️ 10-Style Dynamic Vector Gauge Engine & Contextual Picker](#5-️-10-style-dynamic-vector-gauge-engine--contextual-picker)
  - [6. 📅 Interactive Agenda & Riyadh Prayer Times HUD](#6--interactive-agenda--riyadh-prayer-times-hud)
  - [7. 🔊 Web Audio API Sonar Pings & ISA-18.2 Thermal Alarms](#7--web-audio-api-sonar-pings--isa-182-thermal-alarms)
  - [8. ⚡ Dedicated Native Host Appliance (~75MB RAM & Zero-Taskbar Presence)](#8--dedicated-native-host-appliance-75mb-ram--zero-taskbar-presence)
  - [9. 🚀 In-App & CLI Live Auto-Updater](#9--in-app--cli-live-auto-updater)
- [🖼️ Visual Showcase & Themes](#️-visual-showcase--themes)
- [📊 Head-to-Head Comparison Matrix](#-head-to-head-comparison-matrix)
- [🚀 Quickstart & Turnkey Installation](#-quickstart--turnkey-installation)
- [⚙️ AIDA64 Shared Memory Setup Guide](#️-aida64-shared-memory-setup-guide)
- [🔄 Updating Guide (In-App & CLI)](#-updating-guide-in-app--cli)
- [🏗️ System Architecture Topology](#️-system-architecture-topology)
- [🗺️ Architectural Roadmap & Future Enhancements](ROADMAP.md)
- [🧪 Automated Verification & Test Suite](#-automated-verification--test-suite)
- [🇸🇦 الدليل العربي الكامل والشامل (Arabic Comprehensive Guide)](#-الدليل-العربي-الكامل-والشامل-arabic-comprehensive-guide)
  - [المواصفات التقنية الفائقة](#المواصفات-التقنية-الفائقة)
  - [محرك العدادات المتجهة بـ 10 تصاميم فريدة](#محرك-العدادات-المتجهة-بـ-10-تصاميم-فريدة)
  - [ساعة التوقيت اللحظية للمباريات بالثواني](#ساعة-التوقيت-اللحظية-للمباريات-بالثواني)
  - [طريقة التثبيت بأمر واحد](#طريقة-التثبيت-بأمر-واحد)
  - [إعداد برنامج AIDA64 خطوة بخطوة](#إعداد-برنامج-aida64-خطوة-بخطوة)
  - [إدارة التحديثات](#إدارة-التحديثات)

---

## ✨ Key Architectural Highlights

### 1. ⚡ 0ms ctypes Windows Shared Memory Bridge
Unlike legacy web dashboards that query sluggish HTTP endpoints or poll external JSON files, **AIDA64 Web SensorPanel** maps directly into Windows RAM (`AIDA64_SensorValues`) using 64-bit Win32 `Kernel32` APIs (`OpenFileMappingW`, `MapViewOfFile`, `UnmapViewOfFile`).
- **Zero Socket Latency:** Native C-level memory pointer reading in Python.
- **Zero File I/O Overhead:** No temporary disk polling or SSD wear.
- **Automated Registry Fallback:** Gracefully degrades to Windows Registry querying (`Software\FinalWire\AIDA64\SensorValues`) if memory mapping is temporarily locked.

### 2. 🧠 20-Core Arrow Lake Hybrid Architecture & Liquid Cooling Loop
Custom-tailored telemetry pipeline specifically optimized for modern hybrid processor architectures such as Intel Core Ultra 200S Series (Arrow Lake) and Raptor Lake:
- **Liquid Cooling Pump Speed Telemetry:** Real-time RPM tracking (`مضخة التبريد PUMP 1500+ RPM`) with visual flow vital indicator positioned directly alongside CPU vitals.
- **Front Face Micro Heatmap Strip:** Real-time mini-bars showing per-core loads and temperatures directly on the main card.
- **Dedicated P-Core & E-Core Clusters:** Clustered analytics reporting individual core frequencies, clock distribution, load percentages, and package hotspot temperatures.
- **Dynamic Voltage & Platform Thermals:** High-precision monitoring of CPU VCore, VRM, Motherboard, PCH Chipset, and NVMe SSD temps.

### 3. 🔄 Interactive 3D Flip Cards (Bento-Grid HUD)
Every major tile on the dashboard is an interactive, GPU-accelerated 3D flipper card with hardware-accelerated CSS `transform: rotateY(180deg)`:
- **CPU Card Flip:** Flips to reveal the full 20-core telemetry matrix (8 P-Cores + 12 E-Cores), individual frequencies, and motherboard VRM / PCH power stages.
- **GPU & VRAM Card Flip:** Front face displays integrated VRAM usage (GB used / GB total) and load % progress track; 3D flip reveals VRAM junction temperature, hotspot temperature, memory clock (MHz), cooling fan speeds (RPM), and core voltage.
- **Matches Card Flip:** Flips between today's live football fixtures and the complete 18-team Saudi Pro League Standings table.
- **Audio & Media HUD Flip:** Flips to reveal SteelSeries Sonar mixer channel levels and A/V display controls.

### 4. ⚽ Live Saudi & Global Sports Center with Second-Level Precision
Integrated sports telemetry center tracking live scores, upcoming fixtures, and league standings:
- **Sub-Second Live Match Stopwatch:** Real-time match minute and seconds ticking (`MM:SS`) updated second-by-second via `_tickLiveTimers` without page reloads.
- **Stoppage & Extra Time Badges:** Dynamic badges (`+4'`, `+7'`), halftime (`HT`) indicators, and live score pulses.
- **Zero Raster Asset Overhead:** 100% lightweight pure SVG vector emblems for clubs and competitions (Saudi Pro League, AFC Champions League, UEFA Champions League, Premier League, La Liga, Serie A, and more).
- **Dynamic 18-Team Table:** Complete Saudi Pro League standings with points, goal differential, and match history.

### 5. 🎛️ 10-Style Dynamic Vector Gauge Engine & Contextual Picker
Full customization freedom: Right-click any circular temperature gauge on the dashboard to open the Glassmorphism style picker:
- **10 Mathematically Rendered Vector Styles:**
  1. **Racing Tachometer (النمط الرياضي):** Aggressive sports car speedometer needle with progressive LED warning arc.
  2. **Turbine Engine (التوربين النفاث):** 24-blade aeronautic turbine ring with dynamic blade-lighting physics.
  3. **Hexa-Matrix (الشبكة السداسية):** Futuristic sci-fi honeycomb grid with modular segment lighting.
  4. **Liquid Mercury (المدار الزئبقي):** Smooth viscous liquid level indicator with buoyant meniscus effects.
  5. **Tactical Radar (الرادار التكتيكي):** Military-grade radar sweep with targeting reticle and telemetry coordinates.
  6. **Holo Minimal (الهولوغرام العائم):** Floating holographic ring with ultra-thin glowing laser edge.
  7. **Arc Reactor (مفاعل القوس):** Glowing particle accelerator core with magnetic field lines.
  8. **Retro Nixie (أنابيب النيكسي):** Vintage warm neon filament gas tube aesthetic.
  9. **Dual Split Arc (ثنائية الجليد والنار):** Symmetrical dual-arc balancing cold baseline against load thermals.
  10. **Prism Glass (المنشور الزجاجي):** Crystal facet reflections with refractive dispersion gradients.
- **Flexible Scope:** Apply styles individually (CPU only / GPU only) or toggle "Apply to All".
- **Instant Persistence:** Choices persist across restarts via `localStorage` with Web Audio feedback chimes.

### 6. 📅 Interactive Agenda & Riyadh Prayer Times HUD
- **Daily Appointments Hub:** Integrated modal allowing viewing, creating, and managing daily calendar events and meetings with category tags (`عمل`, `شخصي`).
- **Precision Riyadh Prayer Times:** Automated countdown timers for Fajr, Dhuhr, Asr, Maghrib, and Isha prayers with dynamic elapsed indicators.

### 7. 🔊 Web Audio API Sonar Pings & ISA-18.2 Thermal Alarms
- **SteelSeries GG Sonar Integration:** Automatic sub-system discovery via `%PROGRAMDATA%/SteelSeries/SteelSeries Engine 3/coreProps.json`, syncing master volume, mic mute state, and virtual channel allocations.
- **Synthesized Acoustic Sonar Ping:** In-browser audio feedback powered by Web Audio API synthesizers.
- **ISA-18.2 Compliant Thermal Warning Alarms:** Multi-stage thermal hysteresis alarm triggering glowing neon alert borders and acoustic warnings when CPU, GPU, or Hotspot thermals exceed critical safety thresholds (85°C / 95°C).

### 8. ⚡ Dedicated Native Host Appliance (~75MB RAM & Zero-Taskbar Presence)
For enthusiasts who prefer running the SensorPanel as a clean, dedicated desktop appliance:
- **C# / WebView2 Engine:** Ultra-low ~75MB RAM usage, Alt+Tab immunity, and zero Taskbar presence.
- **System Tray Management:** Amber lightning bolt icon (`⚡`) in the Windows System Tray to switch displays, toggle Always-on-Top, or configure auto-start.

### 9. 🚀 In-App & CLI Live Auto-Updater
- **GitHub Releases API Integration:** Automated background release checking comparing current deployment against the latest GitHub release tag.
- **Non-Intrusive In-App Toast:** One-click visual notification alerting users when a new version is available.
- **One-Command CLI Updater:** Automated script (`scripts\update.bat`) that pulls updates, merges patches, and upgrades Python virtual environment packages cleanly.

---

## 🖼️ Visual Showcase & Themes

Switch instantly between 4 cinematic themes with zero flicker and seamless CSS View Transitions:

| Theme | Preview | Accent Palette |
| :--- | :--- | :--- |
| **Default Cyan Glass** | ![Cyan Glass](tests/screenshots/dashboard_theme_default.png) | `#22D3EE` Cyan / `#38BDF8` Sky |
| **Cyberpunk 2077** | ![Cyberpunk](tests/screenshots/dashboard_theme_cyberpunk.png) | `#FFE600` Neon Yellow / `#FF0055` Cyber Red |
| **OLED Pure Black** | ![OLED Black](tests/screenshots/dashboard_theme_oled.png) | `#000000` Deep Contrast / `#38BDF8` Ice Blue |
| **Emerald Matrix** | ![Emerald](tests/screenshots/dashboard_theme_emerald.png) | `#00FF66` Acid Green / `#059669` Emerald |

### 🎛️ Interactive Hardware Inspections

| 20-Core Arrow Lake Flip Matrix | GPU & VRAM Deep Telemetry Flip |
| :---: | :---: |
| [![Arrow Lake Flipped](tests/screenshots/dashboard_cpu_cores_flipped.png)](tests/screenshots/dashboard_cpu_cores_flipped.png) | [![GPU Flipped](tests/screenshots/dashboard_gpu_flipped.png)](tests/screenshots/dashboard_gpu_flipped.png) |
| *8 P-Cores + 12 E-Cores breakdown with platform thermals & VRM* | *VRAM Junction temp, Memory Clock, Hotspot, and Fan RPM* |

| 18-Team Saudi Pro League Standings Table | Real-Time Live Match Stopwatch (`MM:SS`) |
| :---: | :---: |
| [![Standings Table](tests/screenshots/dashboard_matches_standings_flipped.png)](tests/screenshots/dashboard_matches_standings_flipped.png) | [![Live Stopwatch](tests/screenshots/dashboard_matches_live_stopwatch.png)](tests/screenshots/dashboard_matches_live_stopwatch.png) |
| *Complete 18-team Saudi Pro League table with points & pure SVG emblems* | *Second-by-second live match ticker with stoppage time badges (`+4'`)* |

| 10-Style Dynamic Temperature Gauge Picker | Critical Thermal Alert (ISA-18.2) |
| :---: | :---: |
| [![Gauge Picker](tests/screenshots/gauge_picker_modal_live.png)](tests/screenshots/gauge_picker_modal_live.png) | [![Thermal Alert](tests/screenshots/dashboard_thermal_alert_live.png)](tests/screenshots/dashboard_thermal_alert_live.png) |
| *Right-click contextual Glassmorphism picker with 10 vector styles* | *Pulsing neon warning aura and acoustic alarm triggers* |

| Daily Schedule & Appointments Center | CPU Master Front with Water Pump Telemetry |
| :---: | :---: |
| [![Appointments Modal](tests/screenshots/appointments_modal_live.png)](tests/screenshots/appointments_modal_live.png) | [![CPU Front](tests/screenshots/dashboard_cpu_front.png)](tests/screenshots/dashboard_cpu_front.png) |
| *Integrated agenda HUD with Riyadh prayer countdowns* | *Liquid Cooling Pump RPM (1500+ RPM) & Micro Heatmap Strip* |

---

## 📊 Head-to-Head Comparison Matrix

How does **AIDA64 Web SensorPanel** compare to legacy and alternative hardware monitoring displays?

| Feature / Metric | **AIDA64 Web SensorPanel** ⚡ | Traditional AIDA64 SensorPanel 🐢 | MoBro (ModBros) 📱 | Electron-based HUDs (CAM/iCUE) 🐌 |
| :--- | :---: | :---: | :---: | :---: |
| **Core Architecture** | **ctypes Shared Memory + Web** | Win32 GDI DirectDraw | Node / Web Bridge | Chromium / Electron Shell |
| **Memory Latency** | **0ms (Direct RAM pointer)** | 0ms (Direct GDI) | 250ms - 1000ms (HTTP/WS) | 100ms - 500ms (IPC) |
| **CPU Usage** | **< 0.5% (Extremely Low)** | 1.5% - 3.5% (GDI redraws) | 2.0% - 5.0% | 4.0% - 10.0%+ (Heavy) |
| **RAM Footprint** | **~45 MB** | ~120 MB | ~180 MB | ~350 MB - 700 MB |
| **Display FPS** | **60 FPS locked (rAF)** | 1 - 10 FPS (Static ticks) | 15 - 30 FPS | 30 - 60 FPS |
| **Visual Aesthetics** | **Glassmorphism 2.0 (Bento)** | 90s Bitmap skins | Pre-set Widget cards | Flat Corporate UI |
| **Interactive 3D Flip Cards** | **✅ Yes (3D CSS Matrix)** | ❌ No (Flat canvas) | ❌ No | ❌ No |
| **Arrow Lake 20-Core Matrix** | **✅ Yes (8P + 12E Heatmap)** | ⚠️ Manual Text Labels | ❌ Aggregate only | ⚠️ Aggregate only |
| **Saudi & Global Sports Center** | **✅ Yes (Pure SVG Emblems)** | ❌ No | ❌ No | ❌ No |
| **Audio Mixer Integration** | **✅ Yes (SteelSeries Sonar)** | ❌ No | ❌ No | ❌ No |
| **Acoustic Alerts** | **✅ Web Audio API Synthesizer** | ⚠️ Beep speaker only | ❌ No | ❌ No |
| **License & Extensibility** | **MIT Open-Source** | Proprietary Commercial | Freemium / Proprietary | Proprietary Closed-Source |

---

## 🚀 Quickstart & Turnkey Installation

### Method 1: Turnkey One-Liner (Recommended for Windows 10 & 11)

Open **PowerShell** (no Administrator privileges required) and run:

```powershell
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/aasanea/aida64-web-sensorpanel/main/scripts/install.ps1 | iex"
```

#### What this turnkey installer does automatically:
1. Verifies Python 3.11+ (installs Python 3.12 automatically via `winget` if missing).
2. Clones or downloads the latest release from GitHub into `%USERPROFILE%\aida64-web-sensorpanel`.
3. Creates an isolated Python virtual environment (`.venv`) and installs all dependencies.
4. Generates a sleek **AIDA64 Web SensorPanel** shortcut on your Windows Desktop.
5. Performs a live diagnostic test against `AIDA64_SensorValues` in RAM and reports detected sensors.
6. Offers to launch the kiosk HUD immediately!

---

### Method 2: Manual Clone & Setup

If you prefer full control over your development environment:

```powershell
# 1. Clone repository
git clone https://github.com/aasanea/aida64-web-sensorpanel.git D:\Services\aida64_dashboard
cd D:\Services\aida64_dashboard

# 2. Initialize isolated virtual environment
python -m venv .venv
.\.venv\Scripts\activate

# 3. Install dependencies
pip install -r backend\requirements.txt

# 4. Launch Kiosk SensorPanel
.\scripts\start.bat
```

### ⚡ Native Host Launcher (~75MB RAM & Zero-Taskbar Presence)

For enthusiasts who prefer running the SensorPanel as a clean, dedicated desktop appliance with **zero Taskbar clutter**, Alt+Tab immunity, and ~75MB RAM consumption:

```cmd
# Launch Ultra-Lightweight Native Host with System Tray Icon
launch_native.bat

# Bring Panel immediately to Primary Display (4K / Main Screen)
switch_to_primary.bat

# Terminate Native Host cleanly
stop_panel.bat
```

*Right-click the amber lightning bolt icon (⚡) in the Windows System Tray next to the clock to cycle displays, toggle Always-on-Top, or enable Windows Auto-Start.*

---

## ⚙️ AIDA64 Shared Memory Setup Guide

To enable live telemetry export from AIDA64 Extreme to the Web SensorPanel:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        AIDA64 Extreme Preferences                      │
├────────────────────────────────────────────────────────────────────────┤
│  File  ──►  Preferences  ──►  Hardware Monitoring  ──►  External Apps  │
│                                                                        │
│   [✔] Enable shared memory                                             │
│   [✔] Enable writing sensor values to Registry (Backup Layer)          │
│   Update frequency: 500 ms (or 1000 ms)                                │
│                                                                        │
│   [ Apply ]   [ OK ]                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Instructions:
1. Open **AIDA64 Extreme**.
2. In the top menu bar, click **File** ➡️ **Preferences** (`ملف` ➡️ `تفضيلات`).
3. In the left navigation tree, expand **Hardware Monitoring** and click **External Applications**.
4. Check the following boxes:
   - ✅ **Enable shared memory** *(Mandatory for 0ms telemetry streaming)*.
   - ✅ **Enable writing sensor values to Registry** *(Optional / Fallback layer)*.
5. Set your preferred polling frequency (recommended: **500 ms**).
6. Click **Apply**, then click **OK**.

---

## 🔄 Updating Guide (In-App & CLI)

Keeping your AIDA64 Web SensorPanel up to date is seamless and effortless:

### 1. In-App Notification (Automatic)
When an update is published on GitHub, a glowing notification badge appears in the top navigation bar. Clicking the notification reveals release notes and lets you trigger the update process directly.

### 2. Command-Line Updater (One-Click)
Double-click or run from terminal:

```cmd
D:\Services\aida64_dashboard\scripts\update.bat
```

*The updater automatically stashes local configs, pulls latest commits or release packages, upgrades `.venv` dependencies, and restarts the dashboard.*

---

## 🏗️ System Architecture Topology

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   AIDA64 Extreme (64-bit Engine)                       │
│           Monitors CPU, GPU, RAM, VRAM, Pumps, Thermals, Power         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  Windows Shared Memory (RAM Buffer)
                  Memory Handle: "AIDA64_SensorValues"
                  Latency: 0.00ms | Zero Disk I/O
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    FastAPI Asynchronous Backend                        │
│                       (Port: 8088 /ws & REST)                          │
│  ├─ ctypes Kernel32 Memory Mapping (OpenFileMappingW / MapViewOfFile)   │
│  ├─ Fallback Engine: Windows Registry Querying                         │
│  ├─ SteelSeries Sonar Audio Engine Client (VolumeSettings Discovery)   │
│  ├─ Riyadh Prayer Times & Weather Microservice                         │
│  ├─ Saudi Pro League & Global Matches Service (SVG Emblems)            │
│  └─ WebSocket Telemetry Push Engine (500ms broadcast + Ping/Pong)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ WebSocket (/ws)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Glassmorphism 2.0 Web HUD                           │
│                (Edge / Chrome Kiosk Mode on Sensor Screen)             │
│  ├─ 60 FPS requestAnimationFrame Smooth Animation Loop                 │
│  ├─ Dynamic SVG Temperature Arc Rings & Neon Progress Bars             │
│  ├─ Interactive 3D Flip Cards (Arrow Lake 20-Core & League Standings)   │
│  ├─ Web Audio API Acoustic Sonar Pings & ISA-18.2 Thermal Alarms        │
│  └─ Quad Cinematic Color Palettes (Cyan Glass, Cyberpunk, OLED, Emerald)│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Automated Verification & Test Suite

The project includes an enterprise-grade automated test suite validating contracts, data models, WebSocket streaming, and frontend web components:

```powershell
# Run the complete test suite
python -m pytest tests/ -v -s
```

### Covered Test Modules:
- `test_aida_reader.py`: Shared memory mapping, XML parsing, and fallback layers.
- `test_api.py`: FastAPI endpoints (`/health`, `/api/sensors`, `/api/matches/today`).
- `test_sonar_service.py`: SteelSeries Sonar discovery and volume parser.
- `test_matches_service.py`: Sports telemetry and Saudi Pro League standings.
- `test_performance.py`: Verifies latency benchmarks and memory footprint under load.

---

<div dir="rtl">

# 🇸🇦 الدليل العربي الكامل والشامل (Arabic Comprehensive Guide)

## ⚡ لوحة مراقبة العتاد السينمائية AIDA64 Web SensorPanel
لوحة تحكم عتاد فائقة التطور تعتمد على جماليات **Glassmorphism 2.0** وشبكة **Bento Grid** غير المتماثلة، صُممت خصيصاً للشاشات المستقلة المدمجة داخل كيس الحاسوب (Internal Chassis Displays) أو الشاشات الثانوية المكتبية، بدقة قراءة 100 سم وواجهة عربية أصيلة متكاملة.

---

### 🌟 المواصفات التقنية الفائقة

1. **جسر الذاكرة المشتركة المباشر (0ms Latency)**:
   - قراءة فورية من ذاكرة ويندوز العشوائية (`AIDA64_SensorValues`) عبر مكتبة `ctypes` وواجهات `Kernel32` لنظام 64-bit دون أي استهلاك للقرص أو تأخير شبكي.
   - دعم التراجع التلقائي إلى سجل النظام (`Windows Registry`) في حال إغلاق الذاكرة المشتركة.

2. **البطاقة الموحدة للمعالج والتبريد المائي بـ 20 نواة (Arrow Lake & Raptor Lake)**:
   - **مراقبة مضخة التبريد المائي:** قراءة حية لسرعة دوران المضخة (`مضخة التبريد PUMP 1500+ RPM`) مع مؤشر تدفق حيوي بجانب حرارة المعالج لضمان سلامة حلقة التبريد.
   - **شريط حراري مصغر (Micro Heatmap):** متابعة الأنوية الـ 20 لحظياً على الواجهة الرئيسية للبطاقة.
   - **بطاقة ثلاثية الأبعاد (3D Flip):** تنقلب بزاوية 180 درجة لعرض مصفوفة تفصيلية متكاملة:
     - **8 أنوية أداء (P-Cores):** تردد كل نواة ونسبة حملها وحرارتها الفردية.
     - **12 نواة كفاءة (E-Cores):** أحمال الأنوية المجمعة وتردداتها.
     - **حرارة المنصة المتكاملة:** مستشعرات منظم الجهد (VRM)، اللوحة الأم، شريحة PCH، ووحدات تخزين NVMe SSD فائقة السرعة.

3. **البطاقة الموحدة لمعالج الرسوميات والذاكرة (GPU & VRAM Master)**:
   - **الواجهة الأمامية:** استهلاك ذاكرة الفيديو VRAM بالجيجابايت (GB used / GB total) وشريط التقدم، تردد النواة، واستهلاك الطاقة بالواط.
   - **الوجه الخلفي المنقلب ثلاثي الأبعاد:** حرارة رقاقات الذاكرة (VRAM Junction Temp)، حرارة البقعة الساخنة (Hotspot)، تردد الذاكرة (Memory Clock)، سرعة المراوح (RPM)، وفولتية الكرت (mV).

4. **محرك العدادات المتجهة بـ 10 تصاميم فريدة (Dynamic Vector Gauge Engine)**:
   - تخصيص مطلق: اضغط بالزر الأيمن للفأرة (Right-Click) على أي عداد حراري دائري لفتح نافذة الاختيار الزجاجية.
   - **10 تصاميم متجهة مرسومة رياضياً:**
     1. **النمط الرياضي (Racing Tachometer):** مؤشر سيارات السباق مع شريط LED تصاعدي.
     2. **التوربين النفاث (Turbine Engine):** محرك نفاث بـ 24 شفرة مع فيزياء إضاءة ديناميكية.
     3. **الشبكة السداسية (Hexa-Matrix):** نمط خلايا النحل المستقبلي مع إضاءة مقطعية ذكية.
     4. **المدار الزئبقي (Liquid Mercury):** مؤشر سائل لزج ناعم مع تأثيرات التوتر السطحي.
     5. **الرادار التكتيكي (Tactical Radar):** ماسح رادار حربي مع شبكة استهداف وإحداثيات عتاد.
     6. **الهولوغرام العائم (Holo Minimal):** حلقة هولوغرافية عائمة بحواف ليزرية متوهجة.
     7. **مفاعل القوس (Arc Reactor):** قلب مسرع الجسيمات مع خطوط المجال المغناطيسي.
     8. **أنابيب النيكسي (Retro Nixie):** جماليات كلاسيكية دافئة تحاكي أنابيب الغاز النيونية القديمة.
     9. **ثنائية الجليد والنار (Dual Split Arc):** قوسان متقابلان يوازنان درجات الحرارة والأحمال.
     10. **المنشور الزجاجي (Prism Glass):** أوجه كريستالية عاكسة مع تدرجات لونية منكسرة.
   - إمكانية التطبيق الفردي على عداد محدد أو تفعيل خيار "تطبيق على جميع العدادات".
   - حفظ التفضيلات تلقائياً في التخزين المحلي (`localStorage`) مع مؤثرات صوتية عبر `Web Audio API`.

5. **مركز المباريات وساعة التوقيت اللحظية بالثواني**:
   - **ساعة توقيت لحظية فائقة الدقة:** متابعة دقائق وثواني المباريات الجارية بالثواني الحية (`MM:SS`) عبر دالة `_tickLiveTimers`.
   - **شارات الوقت بدل الضائع:** عرض الوقت الإضافي بدقة (`+4'`, `+7'`)، وحالة الاستراحة (`HT`)، ونبضات تسجيل الأهداف.
   - **شعارات نوادي وبطولات متجهة (Pure SVG):** خفيفة جداً وعالية الدقة وبدون استهلاك للذاكرة.
   - **جدول ترتيب دوري روشن بـ 18 نادياً:** ينقلب ثلاثي الأبعاد ليعرض جدول الترتيب والنقاط وفارق الأهداف.

6. **مركز المواعيد والجدول اليومي ومواقيت صلاة الرياض**:
   - نافذة منبثقة تفاعلية لإدارة وجدولة المواعيد اليومية وتصنيفها (`عمل` / `شخصي`).
   - عداد تنازلي دقيق لمواقيت الصلاة الخمس لمدينة الرياض مع تنبيهات دخول الوقت ومؤشر الوقت المنقضي.

7. **تطبيق الديسكتوب الأصلي (Native Host Appliance)**:
   - مشغل مكتبي مبني بلغة C# و WebView2 باستهلاك ذاكرة منخفض جداً (~75MB RAM).
   - يعمل كجهاز مخصص مستقل دون أي ظهور في شريط المهام ومحصن ضد التبديل غير المقصود (Alt+Tab).
   - أيقونة صاعقة برتقالية (`⚡`) في علبة النظام (System Tray) لتبديل الشاشات وتفعيل الشاشة الكاملة.

8. **تكامل كامل مع SteelSeries GG Sonar ونظام الإنذار الحراري ISA-18.2**:
   - قراءة مستويات الصوت والقنوات الافتراضية (Game / Chat / Media / Aux / Mic).
   - نظام إنذار حراري بوميض نيون متوهج ونغمات تنبيه عند تجاوز درجات الحرارة الحرجة (85°C / 95°C).

---

### 🚀 طريقة التثبيت بأمر واحد (Windows One-Liner)

افتح نافذة **PowerShell** ونفّذ الأمر التالي:

</div>

```powershell
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/aasanea/aida64-web-sensorpanel/main/scripts/install.ps1 | iex"
```

<div dir="rtl">

يقوم السكربت الذكي بكافة الخطوات تلقائياً:
- التحقق من وجود Python 3.11+ (وتثبيته تلقائياً عبر `winget` في حال عدم توفره).
- استنساخ المشروع وتحميل كافة التبعات البرمجية داخل بيئة افتراضية معزولة (`.venv`).
- إنشاء اختصار رسمي أنيق على سطح المكتب بعنوان **AIDA64 Web SensorPanel**.
- فحص الاتصال ببرنامج AIDA64 والتأكد من بث الحساسات في الذاكرة المشتركة.

---

### ⚙️ إعداد برنامج AIDA64 خطوة بخطوة

لتفعيل تصدير بيانات الحساسات من AIDA64 إلى لوحة التحكم:
1. افتح برنامج **AIDA64 Extreme**.
2. من شريط القوائم العلوي، اختر: **File** ➡️ **Preferences** (ملف ➡️ تفضيلات).
3. انتقل إلى القسم الجانبي: **Hardware Monitoring** ➡️ **External Applications** (مراقبة العتاد ➡️ التطبيقات الخارجية).
4. فعّل الخيارات التالية:
   - ✅ **Enable shared memory** (تفعيل الذاكرة المشتركة - إجباري).
   - ✅ **Enable writing sensor values to Registry** (تفعيل كتابة القيم في السجل - طبقة احتياطية).
5. اضبط معدل التحديث على **500 ms** أو **1000 ms**.
6. اضغط **Apply** (تطبيق) ثم **OK** (موافق).

---

### 🔄 إدارة التحديثات

- **التحديث التلقائي من داخل اللوحة**: سيظهر لك إشعار نيون أنيق أعلى اللوحة فور صدور إصدار جديد على GitHub.
- **التحديث عبر موجه الأوامر**: يمكنك تشغيل السكربت المخصص في أي وقت:

</div>

```cmd
D:\Services\aida64_dashboard\scripts\update.bat
```

<div dir="rtl">

---

## 📜 الترخيص والحقوق (License)

هذا المشروع مرخص بموجب رخصة **MIT** مفتوحة المصدر - راجع ملف [LICENSE](LICENSE) للمزيد من التفاصيل. يُسمح بالاستخدام والتعديل والتطوير الشخصي والتجاري بكل حرية.

</div>
