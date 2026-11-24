import { useState } from "react";
import { IslandShell } from "./app/IslandShell";
import type { ShapeStyle } from "./design/tokens";
import { DEFAULT_SETTINGS } from "./settings";

export function App() {
  const [shapeStyle, setShapeStyle] = useState<ShapeStyle>(DEFAULT_SETTINGS.shapeStyle);

  return (
    <IslandShell
      shapeStyle={shapeStyle}
      scaleFactor={1}
      hideInFullscreen={DEFAULT_SETTINGS.hideInFullscreen}
      onShapeChange={setShapeStyle}
    />
  );
}

export default App;
