import { create } from "zustand";

export type IslandState = "hidden" | "minimal" | "idle" | "live" | "peek" | "expanded" | "hud";

export type IslandEvent =
  | { type: "HOVER" }
  | { type: "HOVER_EXPAND" }
  | { type: "HOVER_COLLAPSE_SLIM" }
  | { type: "RESTORE_NORMAL" }
  | { type: "LEAVE" }
  | { type: "CLICK" }
  | { type: "ESCAPE" }
  | { type: "HOTKEY_TOGGLE_HIDE" }
  | { type: "HOTKEY_TOGGLE_EXPAND" }
  | { type: "MEDIA_CHANGE"; active: boolean }
  | { type: "TIMER_TICK"; active: boolean }
  | { type: "NOTIFICATION" }
  | { type: "HUD_DISMISS" }
  | { type: "FULLSCREEN_CHANGE"; active: boolean }
  | { type: "DRAG_ENTER" };

export interface IslandContext {
  state: IslandState;
  previousNonHiddenState: Exclude<IslandState, "hidden" | "hud">;
  minimalMode: boolean;
  hasLiveActivity: boolean;
  isFullscreen: boolean;
}

export const INITIAL_ISLAND_CONTEXT: IslandContext = {
  state: "idle",
  previousNonHiddenState: "idle",
  minimalMode: false,
  hasLiveActivity: false,
  isFullscreen: false,
};

function resolveRestingState(
  ctx: Pick<IslandContext, "minimalMode" | "hasLiveActivity">,
): "minimal" | "idle" | "live" {
  if (ctx.hasLiveActivity) {
    return "live";
  }
  return ctx.minimalMode ? "minimal" : "idle";
}

/**
 * Pure deterministic finite state machine for Lumen's 7 island states (SRS Section 4 & 7.3).
 */
export function reduceIslandState(ctx: IslandContext, event: IslandEvent): IslandContext {
  switch (event.type) {
    case "FULLSCREEN_CHANGE": {
      if (event.active) {
        const prev =
          ctx.state === "hidden" || ctx.state === "hud" ? ctx.previousNonHiddenState : ctx.state;
        return {
          ...ctx,
          isFullscreen: true,
          previousNonHiddenState: prev,
          state: "hidden",
        };
      }
      return {
        ...ctx,
        isFullscreen: false,
        state: resolveRestingState(ctx),
      };
    }

    case "HOTKEY_TOGGLE_HIDE": {
      if (ctx.state === "hidden") {
        return {
          ...ctx,
          state: ctx.previousNonHiddenState,
        };
      }
      const prev = ctx.state === "hud" ? ctx.previousNonHiddenState : ctx.state;
      return {
        ...ctx,
        previousNonHiddenState: prev,
        state: "hidden",
      };
    }

    case "HOTKEY_TOGGLE_EXPAND": {
      if (ctx.state === "expanded") {
        return {
          ...ctx,
          state: resolveRestingState(ctx),
        };
      }
      return {
        ...ctx,
        previousNonHiddenState: "expanded",
        state: "expanded",
      };
    }

    case "CLICK": {
      if (ctx.state === "hidden") {
        return ctx;
      }
      if (ctx.state === "expanded") {
        return {
          ...ctx,
          state: resolveRestingState(ctx),
        };
      }
      return {
        ...ctx,
        previousNonHiddenState: "expanded",
        state: "expanded",
      };
    }

    case "ESCAPE": {
      if (ctx.state === "expanded" || ctx.state === "peek") {
        return {
          ...ctx,
          state: resolveRestingState(ctx),
        };
      }
      return ctx;
    }

    case "HOVER": {
      if (ctx.state === "idle" || ctx.state === "live" || ctx.state === "minimal") {
        return {
          ...ctx,
          previousNonHiddenState: ctx.state,
          state: "peek",
        };
      }
      return ctx;
    }

    case "HOVER_EXPAND": {
      if (ctx.state !== "hidden" && ctx.state !== "expanded") {
        return {
          ...ctx,
          previousNonHiddenState: "expanded",
          state: "expanded",
        };
      }
      return ctx;
    }

    case "HOVER_COLLAPSE_SLIM": {
      if (ctx.state === "expanded" || ctx.state === "peek") {
        return {
          ...ctx,
          previousNonHiddenState: "minimal",
          state: "minimal",
        };
      }
      return ctx;
    }

    case "RESTORE_NORMAL": {
      if (ctx.state === "minimal") {
        const resting = resolveRestingState(ctx);
        return {
          ...ctx,
          previousNonHiddenState: resting,
          state: resting,
        };
      }
      return ctx;
    }

    case "LEAVE": {
      if (ctx.state === "peek") {
        return {
          ...ctx,
          state: resolveRestingState(ctx),
        };
      }
      return ctx;
    }

    case "DRAG_ENTER": {
      if (ctx.state === "hidden") {
        return ctx;
      }
      return {
        ...ctx,
        previousNonHiddenState: "expanded",
        state: "expanded",
      };
    }

    case "MEDIA_CHANGE":
    case "TIMER_TICK": {
      const nextCtx = { ...ctx, hasLiveActivity: event.active };
      if (ctx.state === "idle" || ctx.state === "minimal" || ctx.state === "live") {
        const resting = resolveRestingState(nextCtx);
        return {
          ...nextCtx,
          previousNonHiddenState: resting,
          state: resting,
        };
      }
      return nextCtx;
    }

    case "NOTIFICATION": {
      if (ctx.state === "hidden" || ctx.state === "expanded") {
        return ctx;
      }
      const prev = ctx.state === "hud" ? ctx.previousNonHiddenState : ctx.state;
      return {
        ...ctx,
        previousNonHiddenState: prev,
        state: "hud",
      };
    }

    case "HUD_DISMISS": {
      if (ctx.state === "hud") {
        return {
          ...ctx,
          state: ctx.previousNonHiddenState,
        };
      }
      return ctx;
    }
  }
}

interface IslandStore extends IslandContext {
  dispatch: (event: IslandEvent) => void;
  setMinimalMode: (minimal: boolean) => void;
}

export const useIslandStore = create<IslandStore>((set) => ({
  ...INITIAL_ISLAND_CONTEXT,
  dispatch: (event) =>
    set((current) => {
      const next = reduceIslandState(current, event);
      return next;
    }),
  setMinimalMode: (minimalMode) =>
    set((current) => {
      const updated: IslandContext = { ...current, minimalMode };
      if (current.state === "idle" || current.state === "minimal") {
        const resting = resolveRestingState(updated);
        return { ...updated, state: resting, previousNonHiddenState: resting };
      }
      return updated;
    }),
}));
