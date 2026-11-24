# ADR 0001 — Windows Notification Listener Packaging Strategy

- **Status:** Accepted for v1.0
- **Requirement:** `FR-NT-1`, `FR-NT-2`, `FR-NT-3`, `FR-NT-4`

## Context

Unpackaged Win32 binaries distributed via portable ZIP or NSIS/MSI do not carry an AppX package identity unless wrapped with an MSIX sparse package or installed via MSIX.

## Decision

1. Implement WinRT `UserNotificationListener` behind a graceful, panic-free runtime capability probe in `lumen-notify`.
2. Keep all privacy filtering (`hide_previews`, `allow_list`/`deny_list`, Focus Assist quiet check, and sensitive digit/keyword masking) pure and deterministic in `lumen-notify`.
3. Provide an optional MSIX sparse package path for contributors/users needing full Action Center toast interception, while ensuring unpackaged NSIS/MSI builds never crash when package identity is absent.
