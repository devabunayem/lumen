import { useEffect, useState } from "react";
import { IslandShell } from "./app/IslandShell";
import type { ShapeStyle } from "./design/tokens";
import { settingsGet, settingsUpdate, subscribeSettingsUpdated } from "./lib/ipc";
import { DEFAULT_SETTINGS, type LumenSettings, resolveSettingsScaleFactor } from "./settings";
import { SettingsWindow } from "./settings/SettingsWindow";

export function App() {
  const [settings, setSettings] = useState<LumenSettings>(DEFAULT_SETTINGS);
  const isSettingsWindow =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("window") === "settings";

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
