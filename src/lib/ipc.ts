import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { IslandState } from "../app/stateMachine";

export interface IslandSnapshot {
  state: IslandState;
  minimal_mode: boolean;
  has_live_activity: boolean;
}

export interface PillBoundsPayload {
  width: number;
  height: number;
  topOffset: number;
  visible: boolean;
  hideInFullscreen: boolean;
}

export interface MediaSessionSummary {
  app_id: string;
  title: string;
  artist: string;
  is_playing: boolean;
}

export interface MediaSessionInfo {
  app_id: string;
  title: string;
  artist: string;
  album_title: string;
  is_playing: boolean;
  position_ms: number;
  duration_ms: number;
  album_art_data_url: string | null;
  accent_hex: string;
}

export interface MediaStateSnapshot {
  active: MediaSessionInfo | null;
  sessions: MediaSessionSummary[];
  volume_percent: number;
  muted: boolean;
}

export function isTauriRuntime(): boolean {
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

export async function syncPillBounds(bounds: PillBoundsPayload): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("sync_pill_bounds", {
    width: bounds.width,
    height: bounds.height,
    topOffset: bounds.topOffset,
    visible: bounds.visible,
    hideInFullscreen: bounds.hideInFullscreen,
  });
}

export async function setIslandSurfaceMode(expanded: boolean, hidden: boolean): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("set_island_surface_mode", { expanded, hidden });
}

export async function requestKeyboardFocus(focused: boolean): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("request_keyboard_focus", { focused });
}

export async function getMediaState(): Promise<MediaStateSnapshot | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<MediaStateSnapshot>("media_get_state");
}

export async function sendMediaCommand(
  command: "play_pause" | "next" | "previous" | "toggle_mute",
): Promise<MediaStateSnapshot | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<MediaStateSnapshot>("media_control", { command });
}

export async function seekMedia(positionMs: number): Promise<MediaStateSnapshot | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<MediaStateSnapshot>("media_seek", { positionMs });
}

export async function setSystemVolume(volumePercent: number): Promise<MediaStateSnapshot | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<MediaStateSnapshot>("media_set_volume", { volumePercent });
}

export async function selectMediaSession(appId: string): Promise<MediaStateSnapshot | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<MediaStateSnapshot>("media_select_session", { appId });
}

export async function subscribeFullscreenChange(
  onChange: (active: boolean) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<{ active: boolean }>("lumen://fullscreen-changed", (event) => {
    onChange(event.payload.active);
  });
}

export async function subscribeMediaUpdated(
  onUpdate: (snapshot: MediaStateSnapshot) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<MediaStateSnapshot>("lumen://media-updated", (event) => {
    onUpdate(event.payload);
  });
}

export async function subscribeTrayToggleExpand(onToggle: () => void): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen("lumen://tray-toggle-expand", () => onToggle());
}

export async function subscribeTrayToggleHide(onToggle: () => void): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen("lumen://tray-toggle-hide", () => onToggle());
}
