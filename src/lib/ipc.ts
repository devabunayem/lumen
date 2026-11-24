import { invoke } from "@tauri-apps/api/core";
import type { IslandState } from "../app/stateMachine";

export interface IslandSnapshot {
  state: IslandState;
  minimal_mode: boolean;
  has_live_activity: boolean;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getIslandSnapshot(): Promise<IslandSnapshot | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<IslandSnapshot>("get_island_snapshot");
}

export async function dispatchIslandCommand(eventName: string): Promise<IslandSnapshot | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<IslandSnapshot>("dispatch_island_event", { eventName });
}
