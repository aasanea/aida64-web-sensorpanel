# Security Policy

The maintainers of **AIDA64 Glassmorphism Web Dashboard** take the security and integrity of our codebase, user systems, and telemetry pipelines very seriously. This policy outlines our supported versions, vulnerability disclosure procedures, and response commitments.

---

## 🛡️ Supported Versions

We actively provide security patches and bug fixes for the versions listed below:

| Version | Supported          | Status                                 |
| ------- | ------------------ | -------------------------------------- |
| 1.x.x   | :white_check_mark: | Current Stable Release (Active Support)|
| < 1.0   | :x:                | End of Life (Unsupported)              |

Users are strongly encouraged to upgrade to the latest patch release within the `v1.x` branch to ensure they receive all security and stability enhancements.

---

## 🔒 Security Scope & Architecture Considerations

Because **AIDA64 Glassmorphism Web Dashboard** interacts directly with low-level Windows APIs and local network interfaces, key security boundaries include:

1. **Windows Shared Memory Access**:
   - The reader maps the read-only section `AIDA64_SensorValues` using 64-bit Windows Kernel32 APIs.
   - It performs strict input bounds checking and XML sanitization to prevent memory corruption or malformed entity injection.
2. **Local WebSocket & REST API (`:8088`)**:
   - By default, the FastAPI server binds to localhost or internal network interfaces.
   - Endpoints do not execute arbitrary system commands or accept unauthenticated state mutations.
3. **Frontend Isolation**:
   - The dashboard operates as a client-side Web Component application without loading untrusted third-party remote scripts.

---

## 🚨 Reporting a Vulnerability

If you discover or suspect a security vulnerability in this project, **please do not open a public GitHub issue**. Disclosing vulnerabilities publicly puts other users at risk before a fix is available.

Instead, please report security vulnerabilities using one of the following private channels:

### Option 1: GitHub Security Advisory (Recommended)
Submit a confidential advisory directly through GitHub:
1. Navigate to the repository's **Security** tab.
2. Click on **Advisories** ➡️ **Report a vulnerability**.
3. Fill out the report details including reproduction steps and proof of concept.

### Option 2: Private Security Email
If GitHub Security Advisories are inaccessible, you may email our security maintainer directly:
- **Email**: `security@aasanea.com`
- **Subject Line**: `[SECURITY] AIDA64 Dashboard Vulnerability Report - <Brief Summary>`

---

## 📋 What to Include in Your Report

To help us investigate and triage your report quickly, please provide:
- A clear description of the vulnerability and its potential impact.
- Exact steps to reproduce the issue (including sample payloads, curl commands, or script snippets).
- Affected version(s) of the dashboard, Python runtime, and Windows build.
- A proposed fix or mitigation, if available.
- Any relevant logs (ensure all personal data or system tokens are redacted).

---

## ⏱️ Response & Disclosure Timeline

When a vulnerability is reported through private channels:

1. **Initial Acknowledgment**: Within **48 hours**, we will confirm receipt of your report.
2. **Triage & Assessment**: Within **5 business days**, we will assess severity, reproduce the issue, and provide an initial status update.
3. **Remediation & Patch**: A fix will be developed, tested against our automated test suite, and prepared for release.
4. **Coordinated Disclosure**: Once a patched release is published, a public Security Advisory will be posted crediting the researcher (if desired). We follow standard 90-day responsible coordinated disclosure principles.

---

## 🤝 Safe Harbor

Any security research conducted in good faith and in compliance with this policy will be considered authorized conduct:
- We will not pursue legal action against researchers who report vulnerabilities following these guidelines.
- We request that you give us reasonable time to remediate issues before making details publicly available.
- Please do not access or attempt to access unauthorized external user data or disrupt service availability.
