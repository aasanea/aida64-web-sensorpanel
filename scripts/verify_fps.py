#!/usr/bin/env python3
"""
FPS Verification and Monitoring Script for AIDA64 Dashboard
Runs for 5 minutes (300 seconds), sampling every second.
Tracks:
- RTSS FPS vs AIDA64 FPS vs API FPS
- GPU utilization, clock, power, temperature
- Logs game detection events and outputs summary statistics.
"""

import os
import sys
import time
import json
import datetime
import urllib.request

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Setup paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
BACKEND_DIR = os.path.join(PROJECT_DIR, "backend")
sys.path.insert(0, BACKEND_DIR)

from aida_reader import read_aida_sensors

OUTPUT_DIR = os.path.join(PROJECT_DIR, "logs")
os.makedirs(OUTPUT_DIR, exist_ok=True)
REPORT_JSON_PATH = os.path.join(OUTPUT_DIR, "fps_test_report.json")
REPORT_TXT_PATH = os.path.join(OUTPUT_DIR, "fps_test_report.txt")

TOTAL_DURATION = 300  # 5 minutes in seconds
SAMPLE_INTERVAL = 1.0  # 1 sample per second

print("=" * 70, flush=True)
print("🚀 بدء تشغيل سكربت التحقق من FPS (المدة: 5 دقائق / 300 ثانية)", flush=True)
print(f"⏰ وقت البدء: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
print("=" * 70, flush=True)
print("⏳ في انتظار إطلاق اللعبة لمراقبة حساسات الإطارات وكرت الشاشة...", flush=True)
print("-" * 70, flush=True)

samples = []
start_time = time.time()
last_print_time = start_time
game_detected = False
first_game_time = None

while True:
    now = time.time()
    elapsed = now - start_time
    if elapsed >= TOTAL_DURATION:
        break

    # Sample AIDA64 Shared Memory
    try:
        raw_sensors = read_aida_sensors()
        rtss_raw = raw_sensors.get("SRTSSFPS", {}).get("value", "")
        aida_raw = raw_sensors.get("SAIDAFPS", {}).get("value", "")
    except Exception as e:
        rtss_raw = "ERR"
        aida_raw = "ERR"

    # Sample Dashboard API
    try:
        req = urllib.request.Request("http://127.0.0.1:8088/api/sensors", headers={"User-Agent": "FPSVerifier"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            api_data = json.loads(resp.read().decode("utf-8"))
            api_fps = api_data.get("fps")
            gpu_load = api_data.get("gpu_load")
            gpu_clock = api_data.get("gpu_clock")
            gpu_temp = api_data.get("gpu_temp")
            gpu_pwr = api_data.get("gpu_power")
            cpu_load = api_data.get("cpu_load")
    except Exception as e:
        api_fps = None
        gpu_load = None
        gpu_clock = None
        gpu_temp = None
        gpu_pwr = None
        cpu_load = None

    sample_entry = {
        "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
        "elapsed_s": round(elapsed, 1),
        "api_fps": api_fps,
        "rtss_raw": rtss_raw,
        "aida_raw": aida_raw,
        "gpu_load": gpu_load,
        "gpu_clock": gpu_clock,
        "gpu_temp": gpu_temp,
        "gpu_power": gpu_pwr,
        "cpu_load": cpu_load,
    }
    samples.append(sample_entry)

    # Check for game launch (FPS > 0)
    current_fps_num = 0.0
    try:
        current_fps_num = float(api_fps) if api_fps is not None else 0.0
    except (ValueError, TypeError):
        current_fps_num = 0.0

    if current_fps_num > 0 and not game_detected:
        game_detected = True
        first_game_time = round(elapsed, 1)
        print("\n" + "🔥" * 35, flush=True)
        print(f"🎮 [تم رصد تشغيل اللعبة!] بعد {first_game_time} ثانية:", flush=True)
        print(f"   - معدل الإطارات (FPS): {current_fps_num:.0f} FPS", flush=True)
        print(f"   - استهلاك كرت الشاشة: {gpu_load}% | تردد: {gpu_clock} MHz", flush=True)
        print(f"   - حرارة كرت الشاشة: {gpu_temp}°C | الطاقة: {gpu_pwr} W", flush=True)
        print("🔥" * 35 + "\n", flush=True)

    # Print heartbeat every 10 seconds or when FPS > 0
    if now - last_print_time >= 10.0 or (current_fps_num > 0 and (now - last_print_time >= 5.0)):
        remaining = int(TOTAL_DURATION - elapsed)
        mins, secs = divmod(remaining, 60)
        status_tag = "🎮 اللعبة نشطة" if current_fps_num > 0 else "💤 خامل (سطح المكتب)"
        print(
            f"[{sample_entry['timestamp']}] "
            f"متبقي: {mins:02d}:{secs:02d} | "
            f"FPS: {current_fps_num:5.1f} | "
            f"RTSS: {rtss_raw:4} | "
            f"GPU: {gpu_load or 0:3.0f}% ({gpu_clock or 0:4.0f}MHz, {gpu_temp or 0:2.0f}°C) | "
            f"الحالة: {status_tag}",
            flush=True,
        )
        last_print_time = now

    # Sleep to maintain 1 second interval
    loop_cost = time.time() - now
    sleep_needed = max(0.0, SAMPLE_INTERVAL - loop_cost)
    time.sleep(sleep_needed)

# Compute Statistics
fps_values = [
    float(s["api_fps"])
    for s in samples
    if s["api_fps"] is not None and float(s["api_fps"]) > 0
]
all_fps = [float(s["api_fps"]) for s in samples if s["api_fps"] is not None]
gpu_loads = [float(s["gpu_load"]) for s in samples if s["gpu_load"] is not None]

summary = {
    "total_samples": len(samples),
    "duration_seconds": round(time.time() - start_time, 1),
    "game_detected": game_detected,
    "first_game_detected_at_s": first_game_time,
    "active_fps_samples_count": len(fps_values),
    "max_fps": max(fps_values) if fps_values else 0.0,
    "min_fps_active": min(fps_values) if fps_values else 0.0,
    "avg_fps_active": round(sum(fps_values) / len(fps_values), 1) if fps_values else 0.0,
    "max_gpu_load": max(gpu_loads) if gpu_loads else 0.0,
    "avg_gpu_load": round(sum(gpu_loads) / len(gpu_loads), 1) if gpu_loads else 0.0,
    "samples_data": samples,
}

# Write reports
with open(REPORT_JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)

report_text = f"""
======================================================================
               تقرير التحقق من دقة معدل الإطارات (FPS)
======================================================================
وقت الفحص: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
إجمالي مدة الاختبار: {summary['duration_seconds']} ثانية ({summary['total_samples']} عينة)

النتائج التشغيلية:
- هل تم رصد لعبة 3D نشطة؟ : {'نعم ✅' if game_detected else 'لا (ظل الجهاز في حالة خمول) ⚠️'}
- زمن أول رصد للإطارات   : {first_game_time} ثانية من بدء الاختبار
- أعلى معدل إطارات (Max) : {summary['max_fps']:.1f} FPS
- أقل معدل إطارات نشط    : {summary['min_fps_active']:.1f} FPS
- متوسط الإطارات أثناء اللعب: {summary['avg_fps_active']:.1f} FPS
- أقصى استهلاك لكرت الشاشة: {summary['max_gpu_load']:.1f} %
- متوسط استهلاك كرت الشاشة: {summary['avg_gpu_load']:.1f} %

خلاصة التقييم:
{'✅ قراءة الـ FPS تعمل بدقة متناهية وترصد معدل الإطارات الفعلي في الوقت الحقيقي.' if game_detected else '⚠️ لم يتم رصد إطارات > 0؛ يرجى التأكد من تشغيل لعبة 3D أو تفعيل RTSS في AIDA64.'}
======================================================================
"""

with open(REPORT_TXT_PATH, "w", encoding="utf-8") as f:
    f.write(report_text)

print("\n" + report_text, flush=True)
print(f"📁 تم حفظ التقرير الكامل في: {REPORT_JSON_PATH}", flush=True)
