import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IslandShell } from "./app/IslandShell";
import type { ShapeStyle } from "./design/tokens";
import { settingsGet, settingsUpdate, subscribeSettingsUpdated } from "./lib/ipc";
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

export function App() {
  const [settings, setSettings] = useState<LumenSettings>(DEFAULT_SETTINGS);
  const isSettingsWindow = detectIsSettingsWindow();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void settingsGet().then((loaded) => loaded && setSettings(loaded));
    void subscribeSettingsUpdated((next) => setSettings(next)).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

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

  return (
    <IslandShell
      shapeStyle={settings.shapeStyle}
      scaleFactor={resolveSettingsScaleFactor(settings.scale)}
      hideInFullscreen={settings.hideInFullscreen}
      minimalNotch={settings.minimalNotch}
      hoverToOpen={settings.hoverToOpen}
      hoverReturnSeconds={settings.hoverReturnSeconds}
      mascotEnabled={settings.mascotEnabled}
      showHeaderClockSetting={settings.showHeaderClock}
      language={settings.language}
      reducedMotionOverride={settings.reducedMotionOverride}
      pageOrder={settings.pageOrder}
      hiddenPages={settings.hiddenPages}
      initialWaterGoalMl={settings.waterGoalMl}
      mediaExclusions={settings.mediaExclusions}
      onShapeChange={handleShapeChange}
    />
  );
}

export default App;
