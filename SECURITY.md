# Security Policy

## Supported Versions

Lumen is currently in active pre-1.0 development on `main`. Security fixes are applied directly to `main` and included in all upcoming releases.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities, Windows privilege-escalation findings, plugin sandbox escapes, or credential handling bugs.

Instead, report vulnerabilities privately via:

- **GitHub Security Advisories:** Use the _Report a vulnerability_ button in the Security tab of this repository, or
- **Email:** `mdnayem1100khan@gmail.com` with `[SECURITY] Lumen:` in the subject line.

We will acknowledge receipt within 48 hours and work with you on verification and a coordinated fix.

## Security Guarantees

- Strict Tauri v2 capability allowlist and Content Security Policy (CSP)
- Local-first storage with zero telemetry
- Optional AI API keys stored strictly in Windows Credential Manager (never in plain JSON or logs)
- Third-party plugins run in a restricted web sandbox with explicit declared permissions
