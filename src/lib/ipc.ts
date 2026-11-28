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
  control_mode?: "smtc" | "audio_window" | string;
  pid?: number;
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
  control_mode?: "smtc" | "audio_window" | string;
  pid?: number;
  can_seek?: boolean;
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

export async function shelfPickFiles(): Promise<ShelfItem[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<ShelfItem[]>("shelf_pick_files");
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

export interface CalendarTask {
  id: number;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  estimateMin: number | null;
  doneAt: string | null;
  client: string | null;
  projectId: string | null;
  isDeadline: boolean;
  createdAt: string;
}

export interface PrayerAnchorSpec {
  prayer: string;
  offsetMin: number;
  relation: "before" | "after" | string;
}

export interface CalendarReminder {
  id: number;
  title: string;
  kind: "once" | "daily" | "weekly" | "monthly" | "prayer" | string;
  at: string | null;
  repeatRule: string | null;
  prayerAnchor: PrayerAnchorSpec | null;
  snoozeCount: number;
  active: boolean;
  importance: "normal" | "urgent" | string;
  missed: boolean;
  nextTriggerAt?: string | null;
  createdAt: string;
}

export interface CalendarSource {
  id: string;
  provider: "local" | "ics" | "google" | "microsoft" | string;
  accountLabel: string;
  icsUrl: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  connected: boolean;
}

export interface CalendarHubEvent {
  id: number;
  sourceId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  meetingUrl: string | null;
  location: string | null;
  readOnly: boolean;
}

export interface FocusSessionRecord {
  id: number;
  taskId: number | null;
  startAt: string;
  endAt: string | null;
  kind: "focus" | "short" | "long" | string;
  completed: boolean;
}

export interface DayMarkSummary {
  dateKey: string;
  taskCount: number;
  eventCount: number;
  reminderCount: number;
  deadlineCount: number;
}

export interface CalendarHubSnapshot {
  year: number;
  month: number;
  dayMarks: DayMarkSummary[];
  tasks: CalendarTask[];
  events: CalendarHubEvent[];
  reminders: CalendarReminder[];
  sources: CalendarSource[];
  recentFocusSessions: FocusSessionRecord[];
  focusTaskId?: number | null;
}

export interface ParsedQuickAdd {
  title: string;
  targetKind: "task" | "reminder" | string;
  dueDate: string | null;
  dueTime: string | null;
  isDeadline: boolean;
  reminderKind: "once" | "daily" | "weekly" | "monthly" | "prayer" | string;
  at: string | null;
  repeatRule: string | null;
  prayerAnchor: PrayerAnchorSpec | null;
  importance: "normal" | "urgent" | string;
  chipLabel: string;
}

export interface DueCalendarReminderAlert {
  reminder: CalendarReminder;
  isRepeat: boolean;
  wasDeferred: boolean;
}

export async function calendarHubGetSnapshot(
  year: number,
  month: number,
): Promise<CalendarHubSnapshot | null> {
  if (!isTauriRuntime()) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const prefix = `${year}-${pad(month)}`;
    return {
      year,
      month,
      dayMarks: [
        {
          dateKey: `${prefix}-02`,
          taskCount: 1,
          eventCount: 0,
          reminderCount: 0,
          deadlineCount: 0,
        },
        {
          dateKey: `${prefix}-03`,
          taskCount: 0,
          eventCount: 1,
          reminderCount: 0,
          deadlineCount: 0,
        },
        {
          dateKey: `${prefix}-05`,
          taskCount: 0,
          eventCount: 0,
          reminderCount: 1,
          deadlineCount: 0,
        },
        {
          dateKey: `${prefix}-09`,
          taskCount: 1,
          eventCount: 1,
          reminderCount: 0,
          deadlineCount: 0,
        },
        {
          dateKey: `${prefix}-10`,
          taskCount: 0,
          eventCount: 0,
          reminderCount: 1,
          deadlineCount: 0,
        },
        {
          dateKey: `${prefix}-12`,
          taskCount: 1,
          eventCount: 0,
          reminderCount: 0,
          deadlineCount: 0,
        },
        {
          dateKey: `${prefix}-14`,
          taskCount: 0,
          eventCount: 1,
          reminderCount: 1,
          deadlineCount: 0,
        },
        {
          dateKey: `${prefix}-16`,
          taskCount: 0,
          eventCount: 1,
          reminderCount: 0,
          deadlineCount: 0,
        },
        {
          dateKey: `${prefix}-17`,
          taskCount: 1,
          eventCount: 0,
          reminderCount: 1,
          deadlineCount: 0,
        },
        {
          dateKey: `${prefix}-19`,
          taskCount: 0,
          eventCount: 0,
          reminderCount: 1,
          deadlineCount: 0,
        },
        {
          dateKey: `${prefix}-23`,
          taskCount: 1,
          eventCount: 1,
          reminderCount: 0,
          deadlineCount: 0,
        },
        {
          dateKey: `${prefix}-26`,
          taskCount: 1,
          eventCount: 1,
          reminderCount: 1,
          deadlineCount: 0,
        },
        {
          dateKey: `${prefix}-27`,
          taskCount: 0,
          eventCount: 1,
          reminderCount: 0,
          deadlineCount: 0,
        },
        {
          dateKey: `${prefix}-28`,
          taskCount: 2,
          eventCount: 0,
          reminderCount: 0,
          deadlineCount: 1,
        },
        {
          dateKey: `${prefix}-30`,
          taskCount: 1,
          eventCount: 0,
          reminderCount: 0,
          deadlineCount: 0,
        },
      ],
      tasks: [
        {
          id: 1,
          title: "Invoice",
          dueDate: `${prefix}-26`,
          dueTime: "9:00",
          estimateMin: 15,
          doneAt: `${prefix}-26T09:10:00Z`,
          client: null,
          projectId: null,
          isDeadline: false,
          createdAt: `${prefix}-20T08:00:00Z`,
        },
        {
          id: 2,
          title: "Design review",
          dueDate: `${prefix}-26`,
          dueTime: "2:30",
          estimateMin: 25,
          doneAt: null,
          client: null,
          projectId: null,
          isDeadline: false,
          createdAt: `${prefix}-20T08:00:00Z`,
        },
        {
          id: 3,
          title: "Reply mail",
          dueDate: `${prefix}-26`,
          dueTime: null,
          estimateMin: 15,
          doneAt: null,
          client: null,
          projectId: null,
          isDeadline: false,
          createdAt: `${prefix}-20T08:00:00Z`,
        },
        {
          id: 4,
          title: "Review PRs",
          dueDate: `${prefix}-26`,
          dueTime: null,
          estimateMin: 25,
          doneAt: null,
          client: null,
          projectId: null,
          isDeadline: false,
          createdAt: `${prefix}-20T08:00:00Z`,
        },
      ],
      events: [
        {
          id: 1,
          sourceId: "local",
          title: "Team standup",
          start: `${prefix}-26T16:12:00`,
          end: `${prefix}-26T16:42:00`,
          allDay: false,
          color: "#30d158",
          meetingUrl: "https://meet.google.com/lumen-standup",
          location: "Google Meet",
          readOnly: false,
        },
        {
          id: 2,
          sourceId: "local",
          title: "Client call",
          start: `${prefix}-26T18:30:00`,
          end: `${prefix}-26T19:00:00`,
          allDay: false,
          color: "#7a78ff",
          meetingUrl: null,
          location: null,
          readOnly: false,
        },
        {
          id: 3,
          sourceId: "local",
          title: "Sprint review",
          start: `${prefix}-27T10:00:00`,
          end: `${prefix}-27T11:00:00`,
          allDay: false,
          color: "#30d158",
          meetingUrl: null,
          location: null,
          readOnly: false,
        },
      ],
      reminders: [
        {
          id: 1,
          title: "Call supplier",
          kind: "once",
          at: `${prefix}-26T17:00:00`,
          repeatRule: "5:00 PM · once",
          prayerAnchor: null,
          snoozeCount: 0,
          active: true,
          importance: "normal",
          missed: false,
          createdAt: `${prefix}-26T08:00:00Z`,
        },
        {
          id: 2,
          title: "Read 10 pages",
          kind: "daily",
          at: `${prefix}-26T21:00:00`,
          repeatRule: "Daily · 9:00 PM",
          prayerAnchor: null,
          snoozeCount: 0,
          active: true,
          importance: "normal",
          missed: false,
          createdAt: `${prefix}-26T08:00:00Z`,
        },
        {
          id: 3,
          title: "Review notes",
          kind: "prayer",
          at: `${prefix}-26T17:01:00`,
          repeatRule: null,
          prayerAnchor: { prayer: "Maghrib", offsetMin: 10, relation: "before" },
          snoozeCount: 0,
          active: true,
          importance: "normal",
          missed: false,
          createdAt: `${prefix}-26T08:00:00Z`,
        },
      ],
      sources: [
        {
          id: "local",
          provider: "local",
          accountLabel: "Local calendar",
          icsUrl: null,
          lastSyncedAt: null,
          lastError: null,
          connected: true,
        },
      ],
      recentFocusSessions: [],
      focusTaskId: 2,
    };
  }
  return invoke<CalendarHubSnapshot>("calendar_hub_get_snapshot", { year, month });
}

export async function calendarHubAddTask(input: {
  title: string;
  dueDate?: string | null;
  dueTime?: string | null;
  estimateMin?: number | null;
  isDeadline?: boolean;
}): Promise<CalendarTask | null> {
  if (!isTauriRuntime()) {
    return {
      id: Date.now(),
      title: input.title,
      dueDate: input.dueDate ?? null,
      dueTime: input.dueTime ?? null,
      estimateMin: input.estimateMin ?? 25,
      doneAt: null,
      client: null,
      projectId: null,
      isDeadline: Boolean(input.isDeadline),
      createdAt: new Date().toISOString(),
    };
  }
  return invoke<CalendarTask>("calendar_hub_add_task", {
    title: input.title,
    dueDate: input.dueDate ?? null,
    dueTime: input.dueTime ?? null,
    estimateMin: input.estimateMin ?? null,
    isDeadline: input.isDeadline ?? false,
  });
}

export async function calendarHubToggleTask(id: number): Promise<string | null> {
  if (!isTauriRuntime()) {
    return new Date().toISOString();
  }
  return invoke<string | null>("calendar_hub_toggle_task", { id });
}

export async function calendarHubAddLocalEvent(input: {
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  color?: string;
  meetingUrl?: string | null;
  location?: string | null;
}): Promise<CalendarHubEvent | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<CalendarHubEvent>("calendar_hub_add_local_event", {
    title: input.title,
    start: input.start,
    end: input.end,
    allDay: input.allDay ?? false,
    color: input.color ?? "#30d158",
    meetingUrl: input.meetingUrl ?? null,
    location: input.location ?? null,
  });
}

export async function calendarHubAddReminder(input: {
  title: string;
  kind: string;
  at?: string | null;
  repeatRule?: string | null;
  prayerAnchor?: PrayerAnchorSpec | null;
  importance?: string;
}): Promise<CalendarReminder | null> {
  if (!isTauriRuntime()) {
    return {
      id: Date.now(),
      title: input.title,
      kind: input.kind,
      at: input.at ?? null,
      repeatRule: input.repeatRule ?? null,
      prayerAnchor: input.prayerAnchor ?? null,
      snoozeCount: 0,
      active: true,
      importance: input.importance ?? "normal",
      missed: false,
      createdAt: new Date().toISOString(),
    };
  }
  return invoke<CalendarReminder>("calendar_hub_add_reminder", {
    title: input.title,
    kind: input.kind,
    at: input.at ?? null,
    repeatRule: input.repeatRule ?? null,
    prayerAnchor: input.prayerAnchor ?? null,
    importance: input.importance ?? "normal",
  });
}

export async function calendarHubParseQuickAdd(
  raw: string,
  mode: "task" | "reminder",
): Promise<ParsedQuickAdd | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<ParsedQuickAdd>("calendar_hub_parse_quick_add", { raw, mode });
}

export async function calendarHubMoveTaskDue(id: number, dueDate: string | null): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("calendar_hub_move_task_due", { id, dueDate });
}

export async function calendarHubDeleteTask(id: number): Promise<CalendarTask | null> {
  if (!isTauriRuntime()) return null;
  return invoke<CalendarTask | null>("calendar_hub_delete_task", { id });
}

export async function calendarHubRestoreTask(task: CalendarTask): Promise<CalendarTask | null> {
  if (!isTauriRuntime()) return task;
  return invoke<CalendarTask>("calendar_hub_restore_task", { task });
}

export async function calendarHubSetFocusTask(taskId: number | null): Promise<number | null> {
  if (!isTauriRuntime()) return taskId;
  return invoke<number | null>("calendar_hub_set_focus_task", { taskId });
}

export async function calendarHubCompleteReminder(id: number): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("calendar_hub_complete_reminder", { id });
}

export async function calendarHubSnoozeReminder(id: number, minutes = 10): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("calendar_hub_snooze_reminder", { id, minutes });
}

export async function calendarHubDismissMissed(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("calendar_hub_dismiss_missed");
}

export async function subscribeCalendarReminderAlert(
  onAlert: (alert: DueCalendarReminderAlert) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) return () => {};
  return listen<DueCalendarReminderAlert>("lumen://calendar-reminder-alert", (event) => {
    onAlert(event.payload);
  });
}

export async function subscribeCalendarHubUpdated(onUpdated: () => void): Promise<UnlistenFn> {
  if (!isTauriRuntime()) return () => {};
  return listen("lumen://calendar-hub-updated", () => onUpdated());
}

export type PrayerArrivalMode = "ask" | "auto_pause" | "ignore";

export interface FocusConfig {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  rounds: number;
  socialBlockedArmed: boolean;
  syncDnd: boolean;
  syncTimeLedger: boolean;
  prayerArrivalMode: PrayerArrivalMode;
}

export interface PrayerArrivalPrompt {
  prayerKey: string;
  prayerName: string;
}

export interface FreeFocusLogPrompt {
  durationMin: number;
  completedAt: string;
  suggestedTitle: string;
}

export interface FocusFlowState {
  config: FocusConfig;
  boundTaskId: number | null;
  boundTaskTitle: string | null;
  pausedForPrayer: string | null;
  prayerPrompt: PrayerArrivalPrompt | null;
  freeFocusLogPrompt: FreeFocusLogPrompt | null;
  lumiCompanionMode: "idle" | "body_double_focus" | "prayer_pause" | "celebrate_focus" | string;
  socialBlockActive: boolean;
  dndActive: boolean;
  timeLedgerActive: boolean;
}

export async function calendarHubConnectIcs(label: string, url: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("calendar_hub_connect_ics", { label, url });
}

export async function calendarHubConnectOAuth(
  provider: "google" | "microsoft",
  clientId: string,
  writeScope = false,
): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("calendar_hub_connect_oauth", { provider, clientId, writeScope });
}

export async function calendarHubSyncNow(sourceId?: string | null): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("calendar_hub_sync_now", { sourceId: sourceId ?? null });
}

export async function calendarHubDisconnectSource(sourceId: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("calendar_hub_disconnect_source", { sourceId });
}

export async function calendarHubDeleteAllData(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("calendar_hub_delete_all_data");
}

export async function calendarHubOpenExternalUrl(url: string): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  await invoke("calendar_hub_open_external_url", { url });
}

export async function calendarHubPushTaskEvent(
  title: string,
  startRfc3339: string,
  endRfc3339: string,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invoke<string>("calendar_hub_push_task_event", { title, startRfc3339, endRfc3339 });
}

export async function calendarHubFocusGetState(): Promise<FocusFlowState | null> {
  if (!isTauriRuntime()) return null;
  return invoke<FocusFlowState>("calendar_hub_focus_get_state");
}

export async function calendarHubFocusRespondPrayer(
  pause: boolean,
): Promise<FocusFlowState | null> {
  if (!isTauriRuntime()) return null;
  return invoke<FocusFlowState>("calendar_hub_focus_respond_prayer", { pause });
}

export async function calendarHubFocusDismissFreeLog(): Promise<FocusFlowState | null> {
  if (!isTauriRuntime()) return null;
  return invoke<FocusFlowState>("calendar_hub_focus_dismiss_free_log");
}

export async function calendarHubFocusLogFreeTask(title: string): Promise<CalendarTask | null> {
  if (!isTauriRuntime()) return null;
  return invoke<CalendarTask>("calendar_hub_focus_log_free_task", { title });
}

export async function subscribeFocusFlowUpdated(
  onUpdate: (state: FocusFlowState) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) return () => {};
  return listen<FocusFlowState>("lumen://focus-flow-updated", (event) => {
    onUpdate(event.payload);
  });
}

export interface SystemTelemetrySnapshot {
  cpuPercent: number;
  cpuCores: number;
  ramPercent: number;
  ramUsedGb: number;
  ramTotalGb: number;
  gpuPercent: number | null;
  gpuName: string | null;
  vramUsedGb: number | null;
  vramTotalGb: number | null;
  netDownBps: number;
  netUpBps: number;
  netSessionRxBytes: number;
  netSessionTxBytes: number;
  netOnline: boolean;
  netInterfaceName: string | null;
}

export interface ClipboardHistoryItem {
  id: number;
  preview: string;
  kind: "link" | "code" | "color" | "text" | "secret" | string;
  rawHash: string;
  pinned: boolean;
  sensitive: boolean;
  copiedAt: string;
}

export async function systemShelfSetVisible(visible: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("system_shelf_set_visible", { visible });
}

export async function systemTelemetryGetSnapshot(): Promise<SystemTelemetrySnapshot | null> {
  if (!isTauriRuntime()) return null;
  return invoke<SystemTelemetrySnapshot>("system_telemetry_get_snapshot");
}

export async function subscribeSystemTelemetry(
  onSample: (snapshot: SystemTelemetrySnapshot) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) return () => {};
  return listen<SystemTelemetrySnapshot>("lumen://system-telemetry", (event) => {
    onSample(event.payload);
  });
}

export async function clipboardHistoryList(): Promise<ClipboardHistoryItem[]> {
  if (!isTauriRuntime()) return [];
  return invoke<ClipboardHistoryItem[]>("clipboard_history_list");
}

export async function clipboardHistoryCopy(id: number): Promise<ClipboardChipSnapshot | null> {
  if (!isTauriRuntime()) return null;
  return invoke<ClipboardChipSnapshot>("clipboard_history_copy", { id });
}

export async function clipboardHistoryTogglePin(id: number): Promise<ClipboardHistoryItem[]> {
  if (!isTauriRuntime()) return [];
  return invoke<ClipboardHistoryItem[]>("clipboard_history_toggle_pin", { id });
}

export async function clipboardHistoryDelete(id: number): Promise<ClipboardHistoryItem[]> {
  if (!isTauriRuntime()) return [];
  return invoke<ClipboardHistoryItem[]>("clipboard_history_delete", { id });
}

export async function clipboardHistoryClear(keepPinned = true): Promise<ClipboardHistoryItem[]> {
  if (!isTauriRuntime()) return [];
  return invoke<ClipboardHistoryItem[]>("clipboard_history_clear", { keepPinned });
}

export async function subscribeClipboardHistoryUpdated(
  onUpdate: (items: ClipboardHistoryItem[]) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) return () => {};
  return listen<ClipboardHistoryItem[]>("lumen://clipboard-history-updated", (event) => {
    onUpdate(event.payload);
  });
}
