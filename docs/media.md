# Lumen Media Bridge (`lumen-media`)

Implements Windows System Media Transport Controls (SMTC) integration, CoreAudio system volume control, and album-art accent colour extraction (`FR-MUS-1` to `FR-MUS-3`, `FR-MUS-5` to `FR-MUS-7`):

- **SMTC Session Discovery:** Enumerates active sessions (`Spotify`, browsers, VLC, etc.), prioritises playing sessions or user-selected preferred sessions (`FR-MUS-7`), and extracts metadata + base64 artwork.
- **Contrast-Safe Accent Colour (`FR-MUS-6`):** Samples saturated artwork pixels and ensures relative luminance `>= 0.22` against `#000000` so controls stay readable.
- **Media Exclusions (`FR-MUS-5`):** Filters apps/titles before triggering automatic track-change live peeks.
- **System Volume (`FR-MUS-2`):** Reads/writes Windows master render endpoint scalar volume and mute state via `IAudioEndpointVolume`.
