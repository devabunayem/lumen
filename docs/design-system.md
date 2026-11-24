# Lumen Design System

All visuals in Lumen strictly follow CSS variables and motion presets defined in `src/design/`:

- **Surface & Contrast:** True black (`--surface: #000000`) base pill with raised inner tiles (`--surface-raised: #1C1C1E`), secondary capsules (`--surface-button: #2C2C2E`), and a 1 px inner hairline (`--hairline: rgba(255, 255, 255, 0.08)`).
- **One Accent Per Widget:** Green (`#30D158`) for To-do/success, Blue/Cyan (`#0A84FF` / `#5AC8FA`) for Water & Prayer, Orange (`#FF9F0A`) for Pomodoro, Purple (`#BF5AF2`) for Ask, Red (`#FF453A`) for Alerts.
- **Continuous Curvature (Squircle / Notch):** Generated via SVG path masks (`src/design/shapes.ts`) rather than circular `border-radius` alone.
- **Typography:** Bundled variable `Inter` (`@fontsource-variable/inter`) with `tabular-nums` for clocks and countdowns.
- **Motion:** Physical springs (`src/design/motion.ts`) with automatic 120 ms fade fallback when `prefers-reduced-motion: reduce` is active.
