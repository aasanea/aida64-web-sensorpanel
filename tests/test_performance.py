"""
Performance & Resource Leak Automated Test Suite.
Verifies:
1. Backend AIDA64 Reader latency (< 10ms target, typically < 1ms).
2. Shared Memory unmapping & zero Windows handle leaks.
3. Frontend CSS Hardware Acceleration (transform: translateZ(0), will-change, contain).
4. Zero layout thrashing in frontend animation render loop.
"""

import os
import sys
import time
import statistics
import ctypes
from ctypes import wintypes
import pytest

# Ensure backend in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
import services.aida_service as aida_reader

STYLE_CSS = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "css", "style.css"))
APP_JS = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "js", "app.js"))


def test_backend_reader_latency():
    """Verify aida_reader.get_sensor_data() execution latency over 100 iterations is well within budget."""
    # Warm-up
    for _ in range(5):
        aida_reader.get_sensor_data()

    latencies = []
    iterations = 100
    for _ in range(iterations):
        t0 = time.perf_counter()
        data = aida_reader.get_sensor_data()
        t1 = time.perf_counter()
        latencies.append((t1 - t0) * 1000.0) # in ms

    avg_latency = statistics.mean(latencies)
    p95_latency = statistics.quantiles(latencies, n=20)[18]

    print(f"\n[BENCHMARK] AIDA64 Reader Latency: Avg={avg_latency:.3f}ms, P95={p95_latency:.3f}ms, Max={max(latencies):.3f}ms")
    # Budget is 500ms max, target is < 10ms
    assert avg_latency < 10.0, f"Average latency too high: {avg_latency:.3f} ms"
    assert p95_latency < 25.0, f"P95 latency too high: {p95_latency:.3f} ms"


def test_shared_memory_handle_cleanliness():
    """Verify that UnmapViewOfFile and CloseHandle execute cleanly with zero handle leaks."""
    kernel32 = ctypes.windll.kernel32
    GetCurrentProcess = kernel32.GetCurrentProcess
    GetCurrentProcess.restype = wintypes.HANDLE
    GetProcessHandleCount = kernel32.GetProcessHandleCount
    GetProcessHandleCount.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    GetProcessHandleCount.restype = wintypes.BOOL

    proc = GetCurrentProcess()
    initial_handles = wintypes.DWORD()
    GetProcessHandleCount(proc, ctypes.byref(initial_handles))

    for _ in range(100):
        aida_reader.get_sensor_data()

    final_handles = wintypes.DWORD()
    GetProcessHandleCount(proc, ctypes.byref(final_handles))

    delta = final_handles.value - initial_handles.value
    assert delta <= 0, f"Handle leak detected: handle count increased by {delta}"


def test_frontend_css_hardware_acceleration():
    """Verify hardware acceleration (transform: translateZ(0), will-change, contain) in style.css."""
    assert os.path.exists(STYLE_CSS), "style.css not found"
    with open(STYLE_CSS, "r", encoding="utf-8") as f:
        css = f.read()

    assert "transform: translateZ(0);" in css, "Hardware acceleration (transform: translateZ(0)) missing in style.css"
    assert "will-change:" in css, "will-change property missing in style.css"
    assert "contain: layout style;" in css or "contain: strict;" in css, "Layout containment missing in style.css"
    assert "-webkit-backface-visibility: hidden;" in css, "Backface-visibility GPU promotion missing"


def test_frontend_dom_anti_thrashing():
    """Verify app.js does not trigger forced synchronous layouts (layout thrashing)."""
    assert os.path.exists(APP_JS), "app.js not found"
    with open(APP_JS, "r", encoding="utf-8") as f:
        js = f.read()

    # Disallowed layout-triggering properties inside render loop
    forbidden_layout_reads = [
        "offsetWidth", "offsetHeight", "clientWidth", "clientHeight",
        "getComputedStyle", "getBoundingClientRect"
    ]
    for prop in forbidden_layout_reads:
        assert prop not in js, f"Potential layout thrashing property '{prop}' detected in app.js"

    # Verify requestAnimationFrame and domCache are implemented
    assert "requestAnimationFrame" in js
    assert "domCache" in js
