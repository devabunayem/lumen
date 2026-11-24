# Windows Notifications Technical Spike (`FR-NT-4`)

## Problem

Windows `Windows.UI.Notifications.Management.UserNotificationListener` normally requires **package identity** (an MSIX package or MSIX sparse package) to call `RequestAccessAsync()` and read incoming toast notifications from Action Center.

## Options Evaluated

1. **MSIX Sparse Package (`Package.appxmanifest` + `Add-AppxPackage -ExternalLocation`):**
   - Grants full `UserNotificationListener` access while keeping the standard `.exe`/MSI/NSIS layout.
   - Requires signing with a trusted/self-signed certificate during local dev or distribution.
2. **Unpackaged Runtime Probe + Privacy Pipeline + Fallback:**
   - Attempts `UserNotificationListener::Current()` and `RequestAccessAsync()` safely at runtime without panicking if Windows returns `AccessDenied` (`UserNotificationListenerAccessStatus::Denied` / missing package identity).
   - When packaged (via MSIX sparse manifest or Store/winget MSIX), live toast mirroring activates automatically. When unpackaged, Lumen stays crash-free (`NFR-REL-1`) and exposes `notify_push_test` + internal reminder chimes/popups.

## Decision

- **v1.0 Architecture:** Ship the full `lumen-notify` privacy filter pipeline (`hide_previews`, per-app `allow_list`/`deny_list`, Focus Assist / `SHQueryUserNotificationState` suppression, and sensitive payment/OTP keyword masking) paired with the safe `UserNotificationListener` runtime probe and MSIX sparse package compatibility (`docs/decisions/0001-notifications-listener.md`).
