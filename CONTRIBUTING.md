# Contributing to AIDA64 Glassmorphism Web Dashboard

Thank you for your interest in contributing to **AIDA64 Glassmorphism Web Dashboard**! We welcome contributions from hardware enthusiasts, backend engineers, frontend developers, and UI/UX designers.

This document outlines the guidelines and best practices for developing, testing, and submitting contributions to ensure the highest standards of performance, stability, and code quality.

---

## 🧭 Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please be respectful, constructive, and collaborative in all issues, pull requests, and discussions.

---

## 🛠️ Development Setup & Prerequisites

### Prerequisites
1. **Operating System**: Windows 10 (22H2+) or Windows 11 (64-bit recommended for shared memory access).
2. **Python**: Version `3.11`, `3.12`, or `3.13` (64-bit).
3. **AIDA64 Extreme**: Configured with shared memory export enabled:
   - `File` ➡️ `Preferences` ➡️ `Hardware Monitoring` ➡️ `External Applications`
   - Check **"Enable shared memory"** (`AIDA64_SensorValues`).
   - (Optional) Check **"Enable writing sensor values to Registry"**.
4. **Browser**: Modern Chromium browser (Microsoft Edge or Google Chrome) supporting CSS `backdrop-filter`, Web Components, and WebSocket APIs.

### Local Environment Setup
```powershell
# Clone the repository
git clone https://github.com/your-username/aida64_dashboard.git
cd aida64_dashboard

# Create and activate a Python virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install backend dependencies and test tools
pip install --upgrade pip
pip install -r backend/requirements.txt
pip install pytest pytest-asyncio httpx

# Run the local development server
python backend/main.py
```
Access the dashboard at `http://localhost:8088`.

---

## 🏛️ Architecture & Design Principles

The dashboard is engineered for high performance, low resource consumption, and extreme readability on dedicated secondary displays:

- **Zero Overhead Ingestion**: Direct Windows kernel memory mapping (`OpenFileMappingW` / `MapViewOfFile`) extracting `AIDA64_SensorValues` in under 2ms.
- **WebSocket Streaming**: 500ms real-time broadcast loop with client ping-pong heartbeats.
- **Glassmorphism 2.0**: Native Web Components with hardware-accelerated animations (`transform: translateZ(0)`), SVG progress rings, and dynamic thermal coloration.
- **High Readability**: High-contrast typography optimized for 100cm distance (Orbitron `#F8FAFF` ≥48px for metric values, Tajawal 14px for Arabic/bilingual labels).

---

## 📐 Coding Standards & Conventions

### 1. Python & FastAPI Backend Conventions
- **Strict Typing**: All function signatures, models, and utility methods must have explicit Python type annotations (`typing` and `pydantic`).
- **Data Contracts**:
  - Telemetry values must adhere strictly to `HardwareMetrics` / `SensorData` models in `backend/models/`.
  - Missing, unmapped, or inactive sensor readings must return `None` (null in JSON), **never** arbitrary dummy values or `0`.
- **Asynchronous Execution**:
  - Route handlers and WebSocket communication loops must be non-blocking `async def`.
  - CPU-bound or memory-mapping operations must be lightweight (< 10ms execution budget).
- **Resource Management**:
  - Any Windows kernel handles or memory-mapped buffers opened via `ctypes` must be unmapped and closed explicitly in a `finally` block to prevent handle leaks.
- **Structured Logging**:
  - Use `loguru.logger` (`logger.info`, `logger.debug`, `logger.warning`, `logger.error`).
  - Do not use raw `print()` statements in production code.

### 2. Frontend & Web Components Standards
- **Vanilla ES6+ Custom Elements**:
  - Use standard Web Components (`customElements.define('dashboard-<name>', ComponentClass)`).
  - No bloated external JS frameworks (React/Vue/Angular) in the core display engine.
- **Zero Layout Thrashing & 60 FPS Guarantee**:
  - Do **not** query layout-triggering DOM properties (e.g., `offsetWidth`, `offsetHeight`, `clientWidth`, `getBoundingClientRect()`) inside the active render loop.
  - Cache all element references inside a `domCache` object during `connectedCallback()`.
  - Synchronize visual updates using `requestAnimationFrame`.
- **CSS & GPU Acceleration**:
  - Use CSS custom properties defined in `frontend/css/style.css` for consistent design tokens and theming.
  - Promote animating layers to GPU surfaces using `transform: translateZ(0);` and `will-change`.
  - Ensure CSS layout containment (`contain: layout style;`) on independent widget cards.

---

## 🧪 Testing Guidelines

All submissions must pass the complete automated test suite before being reviewed.

### Running Tests
Execute `pytest` from the repository root:
```powershell
# Run all tests with verbose output
python -m pytest tests/ -v -s

# Run specific test modules
python -m pytest tests/test_api.py -v
python -m pytest tests/test_performance.py -v
python -m pytest tests/test_frontend.py -v
```

### Test Suite Structure
- `tests/test_aida_reader.py`: Shared memory extraction and 24-sensor contract validation.
- `tests/test_api.py`: FastAPI endpoints (`/health`, `/api/sensors`) and WebSocket streaming.
- `tests/test_frontend.py`: Custom element registrations, DOM structure, and CSS rule contracts.
- `tests/test_performance.py`: Latency benchmarks (< 10ms), handle leak detection, and GPU-acceleration validation.
- `tests/test_integration.py`: End-to-end telemetry pipeline verification.

### Test Requirements for New Features
- Any new sensor or feature must include unit tests verifying default states (`None` when unavailable) and valid states.
- Any frontend DOM changes must be verified for anti-thrashing compliance in `tests/test_performance.py`.

---

## 🔀 Pull Request (PR) Process

1. **Fork the Repository**: Create your feature or bugfix branch off `main`:
   ```bash
   git checkout -b feat/add-fan-curve-telemetry
   ```
2. **Implement Changes**: Adhere strictly to code style and architecture conventions.
3. **Verify Locally**:
   - Run `python -m pytest tests/ -v` and confirm all tests pass.
   - Verify visually in a browser at 100% zoom and kiosk mode.
4. **Commit Your Changes**: Follow Conventional Commits (detailed below).
5. **Open a Pull Request**:
   - Fill out the PR template completely.
   - Link any related issues (`Closes #42` or `Fixes #15`).
   - Attach screenshots or recordings for any UI changes.
6. **Code Review**: Address reviewer feedback promptly. Once approved and CI checks pass, your PR will be squash-merged into `main`.

---

## 📝 Git Commit Message Conventions

We adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>(<scope>): <short summary in imperative mood>

[optional body]

[optional footer(s)]
```

### Allowed Types
- `feat`: A new feature or capability.
- `fix`: A bug fix.
- `docs`: Documentation changes only.
- `style`: Changes that do not affect code logic (whitespace, formatting).
- `refactor`: Code changes that neither fix a bug nor add a feature.
- `perf`: A code change that improves performance or decreases latency.
- `test`: Adding missing tests or correcting existing tests.
- `ci`: Changes to CI/CD workflows and configuration files.
- `chore`: Routine maintenance tasks, dependencies, or tool updates.

### Examples
- `feat(sensors): support NVMe drive temperature reading`
- `fix(backend): release kernel handle when shared memory mapping fails`
- `perf(frontend): eliminate synchronous reflow in CPU ring renderer`
- `docs(readme): clarify AIDA64 registry fallback configuration`

---

## 💬 Getting Help

If you encounter issues or have questions:
- Search existing [GitHub Issues](https://github.com/aasanea/aida64_dashboard/issues).
- Open a discussion topic or bug report with detailed steps to reproduce.
