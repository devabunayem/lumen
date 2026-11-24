import { useEffect, useRef } from "react";
import type { LoadedPlugin } from "../../lib/ipc";

export interface PluginHostWidgetProps {
  plugin: LoadedPlugin;
  onPluginEvent?: (type: string, payload: unknown) => void;
}

interface PluginBridgeMessage {
  source?: string;
  pluginId?: string;
  type?: string;
  key?: string;
  value?: string;
  requestId?: string;
  payload?: unknown;
}

/**
 * Renders a third-party widget strictly inside a sandboxed iframe (FR-PL-2).
 */
export function PluginHostWidget({ plugin, onPluginEvent }: PluginHostWidgetProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const allowed = new Set(plugin.manifest.permissions);

    const onMessage = (event: MessageEvent<PluginBridgeMessage>) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      const data = event.data;
      if (!data || data.source !== "lumen-plugin") {
        return;
      }

      if (data.type === "storage:get" || data.type === "storage:set") {
        if (!allowed.has("storage")) {
          iframeRef.current?.contentWindow?.postMessage(
            { type: "error", requestId: data.requestId, message: "storage permission denied" },
            "*",
          );
          return;
        }
        const safeKey = `lumen_plugin:${plugin.manifest.id}:${String(data.key ?? "")}`;
        if (data.type === "storage:set") {
          window.localStorage.setItem(safeKey, String(data.value ?? ""));
          iframeRef.current?.contentWindow?.postMessage(
            { type: "storage:ok", requestId: data.requestId },
            "*",
          );
        } else {
          const val = window.localStorage.getItem(safeKey);
          iframeRef.current?.contentWindow?.postMessage(
            { type: "storage:value", requestId: data.requestId, value: val },
            "*",
          );
        }
        return;
      }

      onPluginEvent?.(String(data.type ?? "custom"), data.payload);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [plugin.manifest.id, plugin.manifest.permissions, onPluginEvent]);

  return (
    <div
      data-testid={`plugin-host-${plugin.manifest.id}`}
      className="h-full w-full overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--hairline)",
      }}
    >
      <iframe
        ref={iframeRef}
        title={plugin.manifest.name}
        sandbox="allow-scripts"
        srcDoc={plugin.html_srcdoc}
        className="h-full w-full border-0 bg-transparent"
      />
    </div>
  );
}
