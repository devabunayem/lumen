import { IslandShell } from "./app/IslandShell";
import { DEFAULT_SETTINGS } from "./settings";

export function App() {
  return <IslandShell shapeStyle={DEFAULT_SETTINGS.shapeStyle} scaleFactor={1} />;
}

export default App;
