import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IslandShell } from "./app/IslandShell";
import type { ShapeStyle } from "./design/tokens";
import { DevStatesPage } from "./dev/DevStatesPage";
import {
  isTauriRuntime,
  monitorAutoScaleFactor,
  settingsGet,
  settingsUpdate,
  subscribeSettingsUpdated,
} from "./lib/ipc";
import { DEFAULT_SETTINGS, type LumenSettings, resolveSettingsScaleFactor } from "./settings";
import { SettingsWindow } from "./settings/SettingsWindow";

function detectIsSettingsWindow(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("window") === "settings") {
      return true;
    }
  } catch {
    // ignore
  }
  if (window.location.hash.includes("settings")) {
    return true;
  }
  try {
    if (getCurrentWindow().label === "settings") {
      return true;
    }
  } catch {
    // ignore
  }
  const anyWin = window as unknown as {
    __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } };
  };
  return anyWin.__TAURI_INTERNALS__?.metadata?.currentWindow?.label === "settings";
}

function detectIsDevStatesRoute(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.location.pathname.startsWith("/dev/states") ||
    window.location.hash.includes("/dev/states") ||
    new URLSearchParams(window.location.search).get("route") === "dev-states"
  );
}

export function App() {
  const [settings, setSettings] = useState<LumenSettings>(DEFAULT_SETTINGS);
  const [autoMonitorScale, setAutoMonitorScale] = useState<number | null>(null);
  const isSettingsWindow = detectIsSettingsWindow();
  const isDevStatesRoute = detectIsDevStatesRoute();

  useEffect(() => {
    if (isDevStatesRoute) {
      return;
    }
    let unlisten: (() => void) | undefined;
    void settingsGet().then((loaded) => loaded && setSettings(loaded));
    if (isTauriRuntime()) {
      void monitorAutoScaleFactor().then((f) => setAutoMonitorScale(f));
    }
    void subscribeSettingsUpdated((next) => {
      setSettings(next);
      if (isTauriRuntime()) {
        void monitorAutoScaleFactor().then((f) => setAutoMonitorScale(f));
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [isDevStatesRoute]);

  if (isDevStatesRoute) {
    return <DevStatesPage />;
  }

  if (isSettingsWindow) {
    return (
      <SettingsWindow
        initialSettings={settings}
        onSettingsCommitted={(next) => setSettings(next)}
      />
    );
  }

  const handleShapeChange = (nextShape: ShapeStyle) => {
    const next = { ...settings, shapeStyle: nextShape };
    setSettings(next);
    void settingsUpdate(next);
  };

  const scaleFactor =
    settings.scale === "auto" && autoMonitorScale !== null
      ? autoMonitorScale
      : resolveSettingsScaleFactor(settings.scale);

  return (
    <IslandShell
      shapeStyle={settings.shapeStyle}
      scaleFactor={scaleFactor}
      hideInFullscreen={settings.hideInFullscreen}
      minimalNotch={settings.minimalNotch}
      hoverToOpen={settings.hoverToOpen}
      hoverReturnSeconds={settings.hoverReturnSeconds}
      mascotEnabled={settings.mascotEnabled}
      showHeaderClockSetting={settings.showHeaderClock}
      language={settings.language}
      reducedMotionOverride={settings.reducedMotionOverride}
      reduceTransparency={settings.reduceTransparency}
      glowEnabled={settings.glowEnabled}
      parallaxEnabled={settings.parallaxEnabled}
      banglaDigits={settings.banglaDigits}
      locationOptIn={settings.locationOptIn}
      chipFocusEnabled={settings.chipFocusEnabled}
      chipLedgerEnabled={settings.chipLedgerEnabled}
      chipClipboardEnabled={settings.chipClipboardEnabled}
      chipDevPulseEnabled={settings.chipDevPulseEnabled}
      reminderSnoozeMinutes={settings.reminderSnoozeMinutes}
      reminderDefaultLeadMinutes={settings.reminderDefaultLeadMinutes}
      restingShowClock={settings.restingShowClock}
      restingShowWaveform={settings.restingShowWaveform}
      restingShowSensorDots={settings.restingShowSensorDots}
      restingShowBatteryRing={settings.restingShowBatteryRing}
      nowPlayingBannerEnabled={settings.nowPlayingBannerEnabled}
      nowPlayingBannerSeconds={settings.nowPlayingBannerSeconds}
      notificationDurationSeconds={settings.notificationDurationSeconds}
      pageOrder={settings.pageOrder}
      hiddenPages={settings.hiddenPages}
      initialWaterGoalMl={settings.waterGoalMl}
      mediaExclusions={settings.mediaExclusions}
      onShapeChange={handleShapeChange}
    />
  );
}

export default App;
