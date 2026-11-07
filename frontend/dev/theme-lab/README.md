# Live architecture proposals — second iteration

The active gallery is http://localhost:8088/dev/theme-lab/index.html. All three approved designs are also selectable in the production header at http://localhost:8088/ using the IDs `orbit`, `vector`, and `folio`. Selection applies the full composition immediately and is saved with the existing `aida64_theme` preference.

The previous Lumen/Titanium/Pearl proposals were rejected because they retained the original card structure. The active proposals now use completely new native templates; none imports or subclasses the production dashboard card components.

| Architecture | Composition | Live route |
| --- | --- | --- |
| ORBIT / COMMAND | One connected cockpit surface with large CPU/GPU instruments and a central FPS spine; horizontal resource band; daily area below | architecture.html?design=orbit |
| VECTOR / OBSERVATORY | Large measured CPU/GPU history plot, top instrument strip, vertical rail, engineering parameter rows, separate daily sidebar | architecture.html?design=vector |
| FOLIO / STUDIO | Ruled hardware table with CPU/GPU/RAM/VRAM rows, flat storage/network/audio/display sections, separate daily margin | architecture.html?design=folio |

Implementation: `TelemetryStation` owns one shadow root, its native templates, DOM references, event subscriptions, timer handles and rendering. It reuses the unchanged production StateManager/EventBus and real `/ws`, `/api/sensors`, `/api/matches/today` data. Rendering is coalesced into one rAF per pending update; text changes are detected; clocks/countdowns run at 1 Hz; meter animations use transforms. History is bounded to 60 seconds/125 samples and starts empty. There are no simulated or prefilled chart points. CPU-core and network-process detail dialogs use actual values, explicitly labelled as snapshots at opening. Native dialog supplies focus management and Escape handling.

Missing/nonfinite values display unavailable; zero is preserved; Master volume uses nullish fallback; zero/missing FPS clears derived frame time; measured/derived frame time is labelled. Existing snapshot/stale semantics remain owned by the production store. Saudi/current/upcoming match filtering uses the backend match records; it omits past records incorrectly marked upcoming by the upstream feed. Appointment management and saved preferences are not mutated.

`assets/orbit.jpg`, `assets/vector.jpg`, `assets/folio.jpg` are actual 1920x1080 browser captures. Different readings reflect capture times. Initial old preview files are retained for comparison/history but are no longer the gallery options. Production frontend integration now uses the same templates and styles; the backend remains unchanged.

Validation: JS syntax, actual-source truthfulness/history regression script (`node tests/test_theme_architectures.cjs`), the existing 14 remediation behavioral checks, and live browser checks for layout bounds, real zero readings, CPU 20-core dialog, and matches filtering. Final browser evidence is saved under `tests/artifacts/theme-architectures-runtime.json`. Optional `&measure` samples rendering after warm-up; this describes the current host/browser, not a universal steady-FPS guarantee.

Production integration: `frontend/js/components/dashboard-station.js` and `frontend/css/dashboard-station.css` are the shared sources for previews and production. `design-tokens.css` owns their palettes and semantic status colors; `style.css` supplies compatible ambient layers and stops invisible orb animations. The existing `dashboard-header` supplies all ten theme choices. In the new native masthead it becomes a compact picker in a slot, retaining the approved identity/clock layout. `app.js` swaps only top-level nodes and keeps one shared StateManager. Hidden legacy cards disconnect instead of continuing animation/fetch loops. Switching among the three new designs preserves the measured history. Returning to any classic theme reconnects the existing bento components. Structural changes skip the full-page View Transition snapshot so the next picker click remains responsive.

Integration checks: `node tests/test_theme_integration.cjs`, `node tests/test_theme_architectures.cjs`, and the existing 14 remediation checks. Browser checks cover real menu selection, all three compositions, persisted reload, keyboard Enter selection, repeated classic/native switches, one visible header, live zero readings and console errors. Evidence: `tests/artifacts/theme-integration-runtime.json` and `themes-integrated-*.jpg`. Original modified source files were backed up under `tests/artifacts/theme-integration-backup-20261006/` before integration.
# Aurora content parity — 2026-10-06

The three native templates now share a complete nine-section live inspector,
including all CPU/platform, GPU/VRAM, storage and network fields; configured
audio/display profiles; three tournament tabs; and the existing appointment
manager. Gauge styles use the existing picker/engine. Native dialogs handle
focus and Escape, and tab lists support RTL keyboard navigation.

See [the review and information map](AURORA-REDESIGN-REVIEW.md). Screenshots and
runtime measurements are in `tests/artifacts/aurora-redesign-20261006/`.
Run `node tests/test_station_content.cjs` alongside the existing three frontend
checks. It verifies missing/zero/ongoing values, live inspector updates, complete
sensor groups and token contrast. No npm or build step is required.

