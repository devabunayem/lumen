import { describe, expect, it } from "vitest";
import { INITIAL_ISLAND_CONTEXT, reduceIslandState } from "../app/stateMachine";

describe("Island Finite State Machine", () => {
  it("starts in idle state", () => {
    expect(INITIAL_ISLAND_CONTEXT.state).toBe("idle");
  });

  it("transitions idle -> expanded on hover expand -> minimal slim -> idle restore", () => {
    const expanded = reduceIslandState(INITIAL_ISLAND_CONTEXT, { type: "HOVER_EXPAND" });
    expect(expanded.state).toBe("expanded");

    const slim = reduceIslandState(expanded, { type: "HOVER_COLLAPSE_SLIM" });
    expect(slim.state).toBe("minimal");

    const rested = reduceIslandState(slim, { type: "RESTORE_NORMAL" });
    expect(rested.state).toBe("idle");
  });

  it("toggles expanded on click and collapses on Escape", () => {
    const expanded = reduceIslandState(INITIAL_ISLAND_CONTEXT, { type: "CLICK" });
    expect(expanded.state).toBe("expanded");

    const collapsed = reduceIslandState(expanded, { type: "ESCAPE" });
    expect(collapsed.state).toBe("idle");
  });

  it("hides in fullscreen and restores resting state when exiting fullscreen", () => {
    const withMedia = reduceIslandState(INITIAL_ISLAND_CONTEXT, {
      type: "MEDIA_CHANGE",
      active: true,
    });
    expect(withMedia.state).toBe("live");

    const hidden = reduceIslandState(withMedia, { type: "FULLSCREEN_CHANGE", active: true });
    expect(hidden.state).toBe("hidden");

    const restored = reduceIslandState(hidden, { type: "FULLSCREEN_CHANGE", active: false });
    expect(restored.state).toBe("live");
  });

  it("shows HUD for notifications and restores previous state on dismiss", () => {
    const hud = reduceIslandState(INITIAL_ISLAND_CONTEXT, { type: "NOTIFICATION" });
    expect(hud.state).toBe("hud");

    const back = reduceIslandState(hud, { type: "HUD_DISMISS" });
    expect(back.state).toBe("idle");
  });
});
