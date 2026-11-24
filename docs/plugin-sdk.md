# Lumen Plugin & Widget SDK

Lumen supports two extension paths (`FR-PL-1..3`):

1. **Built-in TypeScript Widget Contract (`src/widgets/types.ts` & `src/widgets/registry.ts`):** First-class React widgets contributed directly to this repository.
2. **Third-Party Sandboxed Plugins (`%APPDATA%\Lumen\plugins\<plugin-id>\`):** User-installed web widgets loaded at startup into a strict `<iframe sandbox="allow-scripts">` container.

## `manifest.json` Specification

Place a folder inside `%APPDATA%\Lumen\plugins\` containing `manifest.json` and your entry HTML/JS file:

```json
{
  "id": "io.etarnity.hello",
  "name": "Hello World",
  "version": "1.0.0",
  "entry": "index.js",
  "permissions": ["storage"]
}
```

### Security Rules (`NFR-SEC-1`, `FR-PL-2`)

- Entry paths must be strictly relative inside the plugin folder; `..` traversal or absolute paths are rejected by `lumen_plugins::WidgetManifest::validate`.
- Third-party plugins run inside an opaque sandboxed `<iframe sandbox="allow-scripts">` with zero access to Tauri IPC (`window.__TAURI_INTERNALS__`), filesystem, or registry.
- Allowed bridge permissions (`"network"`, `"storage"`, `"media"`, `"notifications"`) are checked explicitly by `PluginHostWidget` on every `postMessage` call.

## Hello World Example (`index.js`)

```js
const root = document.getElementById("lumen-plugin-root");
root.style.display = "flex";
root.style.alignItems = "center";
root.style.justifyContent = "space-between";
root.innerHTML = "<strong>Hello Lumen Plugin!</strong><span>Sandboxed</span>";

window.LumenPlugin.postMessage("storage:set", {
  requestId: "init",
  key: "lastSeen",
  value: new Date().toISOString(),
});
```

Refresh or reload installed plugins anytime from **Tray -> Settings... -> Plugins**.
