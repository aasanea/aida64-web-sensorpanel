# Frontend remediation verification — 2026-10-06

All four approved remediations are implemented with native JavaScript modules,
Web Components, and CSS. No package installation, bundling, or backend restart is
required. Refresh existing dashboard windows to load asset revision 20261006.2.

## Changes

- Master volume uses nullish fallback, preserving 0%. Invalid/zero FPS clears
  derived frame time; actual frame-time measurements take precedence and the UI
  labels provenance. Derived RAM/VRAM percentages also recompute from raw values.
- Complete snapshots clear omitted fields. Five seconds without a snapshot
  marks telemetry stale and clears displayed values. Heartbeat responses alone
  cannot keep readings fresh. In-flight HTTP responses cannot revive stopped
  telemetry. This detects transport silence/missing fields, not a hardware source
  repeatedly sending plausible but frozen measurements.
- Cards subscribe to one `state-changed` delta pipeline. The bootstrap no longer
  reads or mutates shadow DOM, animates components, or duplicates countdowns.
- CPU/GPU DOM and EventBus listeners share AbortController ownership. Components
  cancel frame IDs on disconnect; smoothing uses elapsed time with a 100 ms cap.
  Thermal alarms use raw targets and clear when temperature streams disappear.
- Prayer and appointment clocks run once per second and change text only when
  necessary. SVG geometry and nodes are cached and invalidated on gauge rebuild.
- Only Almarai, Roboto Mono, and Barlow are loaded. Semantic status colors are
  independent of theme accents and use an opaque status surface. Inactive flip
  faces are inert and aria-hidden; focus moves to the visible face.

## Repeatable checks

From the dashboard directory:

```powershell
node tests/test_frontend_remediations.cjs
python -m pytest tests/test_frontend.py tests/test_performance.py -q
```

Results: 14 behavioral checks and 19 Python checks passed. All 18 JavaScript
modules passed `node --check`. Tests cover zero/missing values, provenance,
single-event delivery, refresh-independent smoothing, abort cleanup, remounts,
core-stream disappearance, thermal reset, timers, flip focus, and polling races.

With the existing service running, open
`http://127.0.0.1:8088/dev/verification.html`. It runs the dashboard in a
1920×1080 iframe, observes a 30-second live stream, exercises functional cases,
and measures five seconds of animated telemetry in each theme. Append
`?functional-only` to skip frame-timing samples. Synthetic values affect the
iframe only; the harness makes no API writes and restores live streaming and
the original theme. It never changes stored theme/gauge preferences or real
appointments.

## Runtime evidence

See `artifacts/frontend-remediation-runtime.json` for the final-source benchmark.
The benchmark passed 68 browser assertions, including 20 CPU and 20 GPU
disconnect/remount cycles, inactive faces/focus on all five flip cards, and 1 Hz
countdown mutation limits. A separate functional pass covers all ten gauge
styles in addition to these cases; all 78 checks passed. Its results are saved in
`artifacts/frontend-remediation-functional.json`. A fresh dashboard tab produced
zero console warnings/errors. `artifacts/dashboard-remediated-full.png` captures
the final 1920×1080 RTL layout with live telemetry and the corrected 0% Master
Volume reading.

Semantic text contrast on its status surface is 9.36–14.27:1 in the six dark
themes and 6.27–7.28:1 in Neo-Tactile. These are status-token/surface checks,
not a claim of full-dashboard WCAG conformance.

The final 1920×1080 run measured a 12.4–12.5 ms 95th-percentile frame interval
across live and themed stress scenarios, below the 16.67 ms budget for 60 FPS.
Average rAF cadence was 139.69–182.25 Hz on this browser/host. No long tasks or
long animation frames were recorded. Occasional 25–42 ms intervals occurred;
this is evidence of performance headroom, not perfectly steady presentation
on the physical kiosk display. Application exception/rejection captures were
empty. Check the target display with its actual refresh rate for physical
presentation pacing.

The original frontend is backed up under
`backups/frontend-before-remediation-14480425-111715.zip`.
