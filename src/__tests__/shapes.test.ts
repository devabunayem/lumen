import { describe, expect, it } from "vitest";
import { generateNotchPath, generatePillPath } from "../design/shapes";

describe("Continuous curvature SVG paths", () => {
  it("generates a closed cubic-bezier notch path for collapsed 200x32 pill", () => {
    const d = generateNotchPath({ width: 200, height: 32 });
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d.includes("C ")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("generates a closed squircle pill path", () => {
    const d = generatePillPath({ width: 200, height: 32 });
    expect(d.startsWith("M ")).toBe(true);
    expect(d.includes("C ")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });
});
