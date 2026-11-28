import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { IslandState } from "../app/stateMachine";
import type { LumenSettings } from "../settings";

export interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
  scale_factor: number;
  is_primary: boolean;
}

export interface SettingsUpdateResult {
  settings: LumenSettings;
  hotkey_warning: string | null;
  autostart_warning: string | null;
}

export type PluginPermission = "network" | "storage" | "media" | "notifications";

export interface WidgetManifest {
  id: string;
  name: string;
  version: string;
  entry: string;
  permissions: PluginPermission[];
}

export interface LoadedPlugin {
  manifest: WidgetManifest;
  html_srcdoc: string;
}

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
  cornerRadius?: number;
  homeVisible?: boolean;
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
  estimate_min?: number;
  block_id?: string | null;
  start_at?: string | null;
  fixed?: boolean;
  done_at?: string | null;
  source?: "local" | "calendar" | string;
  calendar_event_id?: number | null;
  client?: string | null;
  kind?: "task" | "meeting" | "habit" | "deadline" | string;
  sort_order?: number;
}

export interface ActivityLogItem {
  id: number;
  start_at: string;
  end_at: string | null;
  kind: "focus" | "music" | "prayer" | "water" | "ledger" | "break" | string;
  ref_id: string | null;
  note: string | null;
}

export interface WaqtBlockItem {
  id: number;
  title: string;
  kind: "task" | "meeting" | "habit" | "deadline" | string;
  source: "local" | "calendar" | string;
  estimate_min: number;
  done: boolean;
  done_at: string | null;
  fixed: boolean;
  start_at: string | null;
  slot_start_min: number;
  slot_end_min: number;
  client: string | null;
  calendar_event_id: number | null;
  sort_order: number;
}

export interface WaqtSuggestion {
  id: string;
  text: string;
  source: "due_today" | "yesterday_unfinished" | "calendar_gap" | "inbox" | "rhythm" | string;
  kind: string;
  estimate_min: number;
  task_id: number | null;
  block_id: string;
}

export interface WaqtGhostAnchor {
  id: string;
  title: string;
  kind: string;
  estimate_min: number;
  block_id: string;
  progress_label: string | null;
  is_user_template: boolean;
}

export interface WaqtPlanAssignment {
  task_id: number;
  task_title: string;
  prev_block_id: string | null;
  target_block_id: string;
  target_block_name: string;
  estimate_min: number;
}

export interface WaqtTomorrowBlock {
  id: string;
  name: string;
  range_label: string;
  task_count: number;
}

export interface WaqtBlockView {
  id: string;
  default_name: string;
  name: string;
  prayer_label: string;
  start_min: number;
  end_min: number;
  range_label: string;
  is_past: boolean;
  is_current: boolean;
  fill_ratio_pct: number;
  remaining_min: number;
  free_capacity_min: number;
  used_capacity_min: number;
  capacity_status: "free" | "tight" | "overbooked";
  length_hint_kind: "deep_work" | "quick_tasks" | "short_break" | string;
  focus_minutes: number;
  logged_focus_min: number;
  logged_prayer_done: boolean;
  status_text: string;
  items: WaqtBlockItem[];
  suggestion: WaqtSuggestion | null;
  rhythm_anchors: WaqtGhostAnchor[];
}

export interface WaqtTimelineState {
  date_label: string;
  now_min: number;
  rail_start_min: number;
  rail_end_min: number;
  sun_progress_pct: number;
  is_friday: boolean;
  is_ramadan: boolean;
  is_after_isha: boolean;
  all_tasks_done: boolean;
  sehri_min: number;
  iftar_min: number;
  location_configured: boolean;
  active_block_id: string;
  next_prayer_name: string;
  next_prayer_in_min: number;
  current_focus_task_id: number | null;
  focus_next_task_id: number | null;
  focus_next_task_title: string | null;
  yesterday_rollover_count: number;
  total_focus_min: number;
  total_planned_min: number;
  total_free_min: number;
  day_is_overbooked: boolean;
  prayers_done_count: number;
  water_today_ml: number;
  water_goal_ml: number;
  focus_bars: number[];
  blocks: WaqtBlockView[];
  unplanned: TaskItem[];
  tomorrow_blocks: WaqtTomorrowBlock[];
  tomorrow_tasks: WaqtBlockItem[];
  plan_my_day_preview: WaqtPlanAssignment[];
  activity_log: ActivityLogItem[];
}

export interface WaqtFocusFlowResult {
  waqt: WaqtTimelineState;
  pomodoro: PomodoroSnapshot;
  ledger: TimeLedgerState;
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
  latitude?: number;
  longitude?: number;
  next_name_en: string;
  next_name_bn: string;
  next_time_12h: string;
  next_is_tomorrow: boolean;
  next_diff_min?: number;
  countdown_text: string;
  progress_pct: number;
  sun_arc_ratio: number;
  now_min?: number;
  is_friday?: boolean;
  is_ramadan?: boolean;
  is_night_mode?: boolean;
  sehri_min?: number;
  iftar_min?: number;
  night_start_min?: number;
  night_end_min?: number;
  tomorrow_fajr_min?: number;
  hijri_date: string;
  sehri_iftar_label: string;
  slots: PrayerSlot[];
}

export interface QuickTogglesState {
  wifi: boolean | null;
  bluetooth: boolean | null;
  focus: boolean;
  micMuted: boolean;
  micInUse: boolean;
  keepAwake: boolean;
  cameraEnabled: boolean;
  cameraInUse: boolean;
  silentMode: boolean;
}

export interface OpenMeteoWeather {
  tempC: number;
  weatherCode: number;
  condition: string;
  precipNote: string | null;
  city: string;
  fetchedAt: string;
  offline: boolean;
}

export interface TasbihState {
  count: number;
  target: number;
}

export interface TimeLedgerState {
  id: number;
  client_name: string;
  elapsed_secs: number;
  running: boolean;
  started_at: string | null;
  updated_at: string;
}

export interface ClipboardChipSnapshot {
  displayText: string;
  sensitive: boolean;
  rawHash: string;
  hasContent: boolean;
}

export interface DevPulseSnapshot {
  ports: number[];
  primaryPort: number | null;
  up: boolean;
}

export interface PrayerCityPreset {
  id: string;
  name_en: string;
  name_bn: string;
  latitude: number;
  longitude: number;
  tz_offset_minutes: number;
}

export interface PomodoroSnapshot {
  phase: "focus" | "short_break" | "long_break";
  remaining_secs: number;
  total_secs: number;
  running: boolean;
  cycle_index: number;
  cycles_before_long: number;
  daily_focus_minutes: number;
  chime_tick: number;
}

export interface ShelfItem {
  id: number;
  kind: string;
  path_or_text: string;
  display_name: string;
  available: boolean;
  added_at: string;
}

export interface HudEvent {
  kind: string;
  label: string;
  value_pct: number | null;
  active: boolean;
}

export interface NotificationPrivacyConfig {
  enabled: boolean;
  hide_previews: boolean;
  quiet_during_fullscreen: boolean;
  respect_focus_assist: boolean;
  allow_list: string[];
  deny_list: string[];
  masked_keywords: string[];
  suppress_native_toast: boolean;
}

export interface NotificationPopup {
  id: number;
  app_name: string;
  title: string;
  body: string;
  app_icon_data_url?: string | null;
  source_app_id?: string | null;
}

export interface ReminderItem {
  id: number;
  title: string;
  target_at: string;
  lead_minutes: number;
  lead_dismissed: boolean;
  snooze_until: string | null;
  exact_fired: boolean;
  completed: boolean;
  created_at: string;
}

export interface ReminderAlertPayload {
  reminder: ReminderItem;
  stage: "lead" | "snooze" | "exact" | string;
  is_exact_due: boolean;
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
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
    cornerRadius: bounds.cornerRadius ?? null,
    homeVisible: bounds.homeVisible ?? null,
  });
}

export async function setIslandSurfaceMode(
  expanded: boolean,
  hidden: boolean,
  hud = false,
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("set_island_surface_mode", { expanded, hidden, hud });
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

export async function pomodoroGetState(): Promise<PomodoroSnapshot | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<PomodoroSnapshot>("pomodoro_get_state");
}

export async function pomodoroToggle(): Promise<PomodoroSnapshot | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<PomodoroSnapshot>("pomodoro_toggle");
}

export async function pomodoroSkip(): Promise<PomodoroSnapshot | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<PomodoroSnapshot>("pomodoro_skip");
}

export async function pomodoroReset(): Promise<PomodoroSnapshot | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<PomodoroSnapshot>("pomodoro_reset");
}

export async function shelfList(): Promise<ShelfItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<ShelfItem[]>("shelf_list");
}

export async function shelfAdd(kind: string, pathOrText: string): Promise<ShelfItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<ShelfItem[]>("shelf_add", { kind, pathOrText });
}

export async function shelfRemove(id: number): Promise<ShelfItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<ShelfItem[]>("shelf_remove", { id });
}

export async function shelfClear(): Promise<ShelfItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<ShelfItem[]>("shelf_clear");
}

export async function shelfOpen(target: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("shelf_open", { target });
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

export async function subscribeAudioPeak(onPeak: (peak: number) => void): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<number>("lumen://audio-peak", (event) => {
    const val =
      typeof event.payload === "number" && Number.isFinite(event.payload) ? event.payload : 0;
    onPeak(Math.max(0, Math.min(1, val)));
  });
}

export async function subscribePomodoroTick(
  onTick: (snapshot: PomodoroSnapshot) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<PomodoroSnapshot>("lumen://pomodoro-tick", (event) => {
    onTick(event.payload);
  });
}

export async function subscribeHudEvent(onHud: (hud: HudEvent) => void): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<HudEvent>("lumen://hud-event", (event) => {
    onHud(event.payload);
  });
}

export async function notifyGetConfig(): Promise<NotificationPrivacyConfig | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<NotificationPrivacyConfig>("notify_get_config");
}

export async function notifySetConfig(
  config: NotificationPrivacyConfig,
): Promise<NotificationPrivacyConfig | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<NotificationPrivacyConfig>("notify_set_config", { config });
}

export async function notifyPushTest(
  appName: string,
  title: string,
  body: string,
): Promise<NotificationPopup | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<NotificationPopup | null>("notify_push_test", { appName, title, body });
}

export async function subscribeNotificationPopup(
  onPopup: (popup: NotificationPopup) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<NotificationPopup>("lumen://notification-popup", (event) => {
    onPopup(event.payload);
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

export async function settingsGet(): Promise<LumenSettings | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<LumenSettings>("settings_get");
}

export async function settingsUpdate(
  settings: LumenSettings,
): Promise<SettingsUpdateResult | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<SettingsUpdateResult>("settings_update", {
    settings: {
      ...settings,
      scale: String(settings.scale),
    },
  });
}

export async function monitorsList(): Promise<MonitorInfo[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<MonitorInfo[]>("monitors_list");
}

export async function openSettingsWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("open_settings_window");
}

export async function closeSettingsWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("close_settings_window");
}

export async function subscribeSettingsUpdated(
  onUpdate: (settings: LumenSettings) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<LumenSettings>("lumen://settings-updated", (event) => {
    onUpdate(event.payload);
  });
}

export async function pluginsList(): Promise<LoadedPlugin[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<LoadedPlugin[]>("plugins_list");
}

export async function systemGetMicMuted(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }
  return invoke<boolean>("system_get_mic_muted");
}

export async function systemToggleMicMute(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }
  return invoke<boolean>("system_toggle_mic_mute");
}

export async function systemLockWorkstation(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("system_lock_workstation");
}

export async function systemCaptureScreenshot(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<string>("system_capture_screenshot");
}

export interface CalendarEvent {
  id: number;
  title: string;
  start_at: string;
  created_at: string;
}

export async function systemOcrScreen(): Promise<string> {
  if (!isTauriRuntime()) {
    return "";
  }
  return invoke<string>("system_ocr_screen");
}

export async function systemPrivacyIndicators(): Promise<[boolean, boolean]> {
  if (!isTauriRuntime()) {
    return [false, false];
  }
  return invoke<[boolean, boolean]>("system_privacy_indicators");
}

export async function calendarList(): Promise<CalendarEvent[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<CalendarEvent[]>("calendar_list");
}

export async function calendarAdd(title: string, startAt: string): Promise<CalendarEvent[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<CalendarEvent[]>("calendar_add", { title, startAt });
}

export async function calendarDelete(id: number): Promise<CalendarEvent[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<CalendarEvent[]>("calendar_delete", { id });
}

export async function remindersList(): Promise<ReminderItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<ReminderItem[]>("reminders_list");
}

export async function remindersAdd(
  title: string,
  targetAt: string,
  leadMinutes: number,
): Promise<ReminderItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<ReminderItem[]>("reminders_add", { title, targetAt, leadMinutes });
}

export async function remindersDelete(id: number): Promise<ReminderItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<ReminderItem[]>("reminders_delete", { id });
}

export async function remindersStop(id: number, stage: string): Promise<ReminderItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<ReminderItem[]>("reminders_stop", { id, stage });
}

export async function remindersSnooze(id: number): Promise<ReminderItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<ReminderItem[]>("reminders_snooze", { id });
}

export async function subscribeReminderAlert(
  onAlert: (alert: ReminderAlertPayload) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<ReminderAlertPayload>("lumen://reminder-alert", (event) => {
    onAlert(event.payload);
  });
}

export async function subscribeRemindersUpdated(
  onUpdated: (items: ReminderItem[]) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<ReminderItem[]>("lumen://reminders-updated", (event) => {
    onUpdated(event.payload);
  });
}

export async function systemQuickTogglesState(): Promise<QuickTogglesState> {
  if (!isTauriRuntime()) {
    return {
      wifi: true,
      bluetooth: true,
      focus: false,
      micMuted: false,
      micInUse: false,
      keepAwake: false,
      cameraEnabled: true,
      cameraInUse: false,
      silentMode: false,
    };
  }
  return invoke<QuickTogglesState>("system_quick_toggles_state");
}

export async function systemToggleWifi(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }
  return invoke<boolean>("system_toggle_wifi");
}

export async function systemToggleBluetooth(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }
  return invoke<boolean>("system_toggle_bluetooth");
}

export async function systemToggleKeepAwake(enabled?: boolean): Promise<boolean> {
  if (!isTauriRuntime()) {
    return Boolean(enabled);
  }
  return invoke<boolean>("system_toggle_keep_awake", { enabled: enabled ?? null });
}

export async function systemLaunchSnippingScreenshot(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("system_launch_snipping_screenshot");
}

export async function systemLaunchScreenRecording(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("system_launch_screen_recording");
}

export async function systemToggleCamera(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return true;
  }
  return invoke<boolean>("system_toggle_camera");
}

export async function systemToggleSilentMode(enabled?: boolean): Promise<boolean> {
  if (!isTauriRuntime()) {
    return Boolean(enabled);
  }
  return invoke<boolean>("system_toggle_silent_mode", { enabled: enabled ?? null });
}

export async function prayerSetMethod(
  method: string,
  madhab: string,
): Promise<PrayerSchedule | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<PrayerSchedule>("prayer_set_method", { method, madhab });
}

export async function weatherGetCurrent(): Promise<OpenMeteoWeather | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<OpenMeteoWeather>("weather_get_current");
}

export async function tasbihGet(): Promise<TasbihState> {
  if (!isTauriRuntime()) {
    return { count: 33, target: 33 };
  }
  return invoke<TasbihState>("tasbih_get");
}

export async function tasbihIncrement(): Promise<TasbihState> {
  if (!isTauriRuntime()) {
    return { count: 34, target: 33 };
  }
  return invoke<TasbihState>("tasbih_increment");
}

export async function tasbihReset(): Promise<TasbihState> {
  if (!isTauriRuntime()) {
    return { count: 0, target: 33 };
  }
  return invoke<TasbihState>("tasbih_reset");
}

export async function ledgerGet(): Promise<TimeLedgerState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<TimeLedgerState>("ledger_get");
}

export async function ledgerToggle(clientName?: string): Promise<TimeLedgerState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<TimeLedgerState>("ledger_toggle", { clientName: clientName ?? null });
}

export async function clipboardGetLatest(): Promise<ClipboardChipSnapshot> {
  if (!isTauriRuntime()) {
    return { displayText: "", sensitive: false, rawHash: "", hasContent: false };
  }
  return invoke<ClipboardChipSnapshot>("clipboard_get_latest");
}

export async function clipboardCopyLatest(): Promise<ClipboardChipSnapshot> {
  if (!isTauriRuntime()) {
    return { displayText: "", sensitive: false, rawHash: "", hasContent: false };
  }
  return invoke<ClipboardChipSnapshot>("clipboard_copy_latest");
}

export async function homeSetVisible(visible: boolean): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("home_set_visible", { visible });
}

export async function systemBatteryStatus(): Promise<[number, boolean] | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<[number, boolean] | null>("system_battery_status");
}

export async function monitorAutoScaleFactor(): Promise<number> {
  if (!isTauriRuntime()) {
    return 1;
  }
  return invoke<number>("monitor_auto_scale_factor");
}

export async function subscribeDevPulseUpdated(
  onUpdate: (pulse: DevPulseSnapshot) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<DevPulseSnapshot>("lumen://dev-pulse-updated", (event) => {
    onUpdate(event.payload);
  });
}

export async function subscribeClipboardUpdated(
  onUpdate: (clip: ClipboardChipSnapshot) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<ClipboardChipSnapshot>("lumen://clipboard-updated", (event) => {
    onUpdate(event.payload);
  });
}

export async function subscribePrayerUpdated(
  onUpdate: (sched: PrayerSchedule) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<PrayerSchedule>("lumen://prayer-updated", (event) => {
    onUpdate(event.payload);
  });
}

export async function waqtGetState(): Promise<WaqtTimelineState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaqtTimelineState>("waqt_get_state");
}

export async function waqtAddTask(input: {
  title: string;
  estimateMin?: number;
  blockId?: string | null;
  kind?: string;
  fixed?: boolean;
  startAt?: string | null;
  client?: string | null;
}): Promise<WaqtTimelineState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaqtTimelineState>("waqt_add_task", {
    title: input.title,
    estimateMin: input.estimateMin ?? null,
    blockId: input.blockId ?? null,
    kind: input.kind ?? null,
    fixed: input.fixed ?? null,
    startAt: input.startAt ?? null,
    client: input.client ?? null,
  });
}

export async function waqtAssignTask(
  taskId: number,
  blockId: string | null,
  sortOrder?: number | null,
): Promise<WaqtTimelineState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaqtTimelineState>("waqt_assign_task", {
    taskId,
    blockId,
    sortOrder: sortOrder ?? null,
  });
}

export async function waqtUpdateTaskMeta(input: {
  taskId: number;
  estimateMin?: number;
  kind?: string;
  blockId?: string | null;
  client?: string | null;
}): Promise<WaqtTimelineState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaqtTimelineState>("waqt_update_task_meta", {
    taskId: input.taskId,
    estimateMin: input.estimateMin ?? null,
    kind: input.kind ?? null,
    blockId: input.blockId === undefined ? null : input.blockId,
    client: input.client === undefined ? null : input.client,
  });
}

export async function waqtMoveOverflowToNext(
  fromBlockId: string,
): Promise<WaqtTimelineState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaqtTimelineState>("waqt_move_overflow_to_next", { fromBlockId });
}

export async function waqtRenameBlock(
  blockId: string,
  name: string,
): Promise<WaqtTimelineState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaqtTimelineState>("waqt_rename_block", { blockId, name });
}

export async function waqtRolloverYesterday(accept: boolean): Promise<WaqtTimelineState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaqtTimelineState>("waqt_rollover_yesterday", { accept });
}

export async function waqtStartFocusFlow(
  taskId?: number | null,
): Promise<WaqtFocusFlowResult | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaqtFocusFlowResult>("waqt_start_focus_flow", { taskId: taskId ?? null });
}

export async function waqtDismissHint(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("waqt_dismiss_hint");
}

export async function waqtLogActivity(
  kind: string,
  refId?: string | null,
  note?: string | null,
): Promise<WaqtTimelineState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaqtTimelineState>("waqt_log_activity", {
    kind,
    refId: refId ?? null,
    note: note ?? null,
  });
}

export async function waqtAssignBatch(
  assignments: Array<[number, string | null]>,
): Promise<WaqtTimelineState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaqtTimelineState>("waqt_assign_batch", { assignments });
}

export async function waqtAcceptSuggestion(input: {
  suggestionId: string;
  text: string;
  blockId: string;
  kind: string;
  estimateMin: number;
  taskId: number | null;
}): Promise<WaqtTimelineState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaqtTimelineState>("waqt_accept_suggestion", {
    suggestionId: input.suggestionId,
    text: input.text,
    blockId: input.blockId,
    kind: input.kind,
    estimateMin: input.estimateMin,
    taskId: input.taskId,
  });
}

export async function waqtDismissSuggestion(
  suggestionId: string,
  text: string,
): Promise<WaqtTimelineState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaqtTimelineState>("waqt_dismiss_suggestion", { suggestionId, text });
}

export async function waqtDismissFirstRun(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("waqt_dismiss_first_run");
}

export async function waqtSeedSampleTask(): Promise<WaqtTimelineState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<WaqtTimelineState>("waqt_seed_sample_task");
}

export async function subscribeWaqtUpdated(
  onUpdate: (state: WaqtTimelineState) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<WaqtTimelineState>("lumen://waqt-updated", (event) => {
    onUpdate(event.payload);
  });
}
