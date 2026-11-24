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

export interface TaskItem {
  id: number;
  title: string;
  done: boolean;
  due_at: string | null;
  created_at: string;
}

export interface WaterDayPoint {
  date_label: string;
  total_ml: number;
}

export interface WaterSummary {
  today_ml: number;
  goal_ml: number;
  percentage: number;
  goal_reached: boolean;
  last_entry_id: number | null;
  weekly: WaterDayPoint[];
}

export interface PrayerSlot {
  id: string;
  name_en: string;
  name_bn: string;
  time_12h: string;
  minute_of_day: number;
  arc_ratio: number;
  passed: boolean;
}

export interface PrayerSchedule {
  city_name: string;
  next_name_en: string;
  next_name_bn: string;
  next_time_12h: string;
  next_is_tomorrow: boolean;
  countdown_text: string;
  progress_pct: number;
  sun_arc_ratio: number;
  hijri_date: string;
  sehri_iftar_label: string;
  slots: PrayerSlot[];
}

export interface PrayerCityPreset {
  id: string;
  name_en: string;
  name_bn: string;
  latitude: number;
  longitude: number;
  tz_offset_minutes: number;
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

export async function tasksList(): Promise<TaskItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<TaskItem[]>("tasks_list");
}

export async function tasksAdd(title: string, dueAt?: string | null): Promise<TaskItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<TaskItem[]>("tasks_add", { title, dueAt: dueAt ?? null });
}

export async function tasksToggle(id: number): Promise<TaskItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<TaskItem[]>("tasks_toggle", { id });
}

export async function tasksDelete(id: number): Promise<TaskItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<TaskItem[]>("tasks_delete", { id });
}

export async function tasksExportJson(): Promise<string> {
  if (!isTauriRuntime()) {
    return "[]";
  }
  return invoke<string>("tasks_export_json");
}

export async function waterGetSummary(goalMl = 1500, resetHour = 4): Promise<WaterSummary | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaterSummary>("water_get_summary", { goalMl, resetHour });
}

export async function waterLog(
  ml: number,
  goalMl = 1500,
  resetHour = 4,
): Promise<WaterSummary | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaterSummary>("water_log", { ml, goalMl, resetHour });
}

export async function waterUndo(
  entryId: number,
  goalMl = 1500,
  resetHour = 4,
): Promise<WaterSummary | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaterSummary>("water_undo", { entryId, goalMl, resetHour });
}

export async function prayerListCities(): Promise<PrayerCityPreset[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<PrayerCityPreset[]>("prayer_list_cities");
}

export async function prayerGetSchedule(): Promise<PrayerSchedule | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<PrayerSchedule>("prayer_get_schedule");
}

export async function prayerSetCity(cityId: string): Promise<PrayerSchedule | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<PrayerSchedule>("prayer_set_city", { cityId });
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
