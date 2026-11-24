import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PluginHostWidget } from "../widgets/plugins/PluginHostWidget";
import { BUILTIN_WIDGET_IDS, resolveOrderedWidgetIds } from "../widgets/registry";

describe("Phase 7 Plugin SDK & Widget Registry (FR-PL-1..3)", () => {
  it("mounts third-party plugin HTML inside a strictly sandboxed iframe", () => {
    render(
      <PluginHostWidget
        plugin={{
          manifest: {
            id: "io.etarnity.hello",
            name: "Hello World",
            version: "1.0.0",
            entry: "index.js",
            permissions: ["storage"],
          },
          html_srcdoc: "<!doctype html><html><body><div>Hello Plugin</div></body></html>",
        }}
      />,
    );

    const frame = screen.getByTitle("Hello World");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
  });

  it("merges built-in widgets and third-party plugins honoring order and hidden list", () => {
    const ordered = resolveOrderedWidgetIds(
      BUILTIN_WIDGET_IDS,
      ["io.etarnity.hello"],
      ["pomodoro", "music"],
      ["shelf"],
    );

    expect(ordered[0]).toBe("pomodoro");
    expect(ordered[1]).toBe("music");
    expect(ordered).not.toContain("shelf");
    expect(ordered).toContain("io.etarnity.hello");
  });
});
