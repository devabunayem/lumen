import { useEffect, useState } from "react";
import {
  BellIcon,
  CapsIcon,
  DropletIcon,
  FileIcon,
  MusicNoteIcon,
  SettingsIcon,
} from "../design/icons";
import { getMessages } from "../i18n";
import {
  closeSettingsWindow,
  type LoadedPlugin,
  type MonitorInfo,
  monitorsList,
  type NotificationPrivacyConfig,
  notifyGetConfig,
  notifyPushTest,
  notifySetConfig,
  pluginsList,
  settingsGet,
  settingsUpdate,
} from "../lib/ipc";
import { DEFAULT_SETTINGS, type LumenSettings } from "./index";

export type SettingsSection =
  | "general"
  | "display"
  | "pages"
  | "appearance"
  | "music"
  | "notifications"
  | "widgets"
  | "todo"
  | "pomodoro"
  | "water"
  | "prayer"
  | "shelf"
  | "hud"
  | "plugins"
  | "about";

interface SidebarItem {
  id: SettingsSection;
  label: string;
  badge?: string;
  iconBg: string;
  icon: (props: { size?: number }) => React.ReactNode;
}

export interface SettingsWindowProps {
  initialSettings?: LumenSettings;
  onSettingsCommitted?: (next: LumenSettings) => void;
  pluginCards?: Array<{ id: string; name: string; version: string; permissions: string[] }>;
  onReloadPlugins?: () => void;
}

export function SettingsWindow({
  initialSettings,
  onSettingsCommitted,
  pluginCards = [],
  onReloadPlugins,
}: SettingsWindowProps) {
  const [section, setSection] = useState<SettingsSection>("general");
  const [settings, setSettings] = useState<LumenSettings>(initialSettings ?? DEFAULT_SETTINGS);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [notifyCfg, setNotifyCfg] = useState<NotificationPrivacyConfig>({
    enabled: true,
    hide_previews: false,
    quiet_during_fullscreen: true,
    respect_focus_assist: true,
    allow_list: [],
    deny_list: [],
    masked_keywords: ["otp", "pin", "code", "password", "tk", "bdt"],
    suppress_native_toast: false,
  });
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [warningBanner, setWarningBanner] = useState<string | null>(null);
  const [discoveredPlugins, setDiscoveredPlugins] = useState<LoadedPlugin[]>([]);

  const msg = getMessages(settings.language);

  useEffect(() => {
    // Pure OLED black base matching the Dynamic Island notch
    document.documentElement.style.background = "#000000";
    document.body.style.background = "#000000";

    if (!initialSettings) {
      void settingsGet().then((loaded) => {
        if (loaded) {
          setSettings(loaded);
        }
      });
    }
    void monitorsList().then(setMonitors);
    void notifyGetConfig().then((cfg) => cfg && setNotifyCfg(cfg));
    void pluginsList().then(setDiscoveredPlugins);
  }, [initialSettings]);

  const effectivePlugins =
    pluginCards.length > 0
      ? pluginCards
      : discoveredPlugins.map((p) => ({
          id: p.manifest.id,
          name: p.manifest.name,
          version: p.manifest.version,
          permissions: p.manifest.permissions,
        }));

  const commit = async (next: LumenSettings) => {
    setSettings(next);
    onSettingsCommitted?.(next);
    const res = await settingsUpdate(next);
    if (res) {
      setSettings(res.settings);
      onSettingsCommitted?.(res.settings);
      const warns = [res.hotkey_warning, res.autostart_warning].filter(Boolean);
      setWarningBanner(warns.length > 0 ? warns.join(" · ") : null);
    }
    setStatusBanner(msg.settings.saved);
    const timer = setTimeout(() => setStatusBanner(null), 2500);
    return () => clearTimeout(timer);
  };

  const commitNotify = async (next: NotificationPrivacyConfig) => {
    setNotifyCfg(next);
    const saved = await notifySetConfig(next);
    if (saved) {
      setNotifyCfg(saved);
    }
    setStatusBanner(msg.settings.saved);
    const timer = setTimeout(() => setStatusBanner(null), 2500);
    return () => clearTimeout(timer);
  };

  const handleClose = () => {
    void closeSettingsWindow();
  };

  const movePage = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= settings.pageOrder.length) {
      return;
    }
    const order = [...settings.pageOrder];
    const [moved] = order.splice(idx, 1);
    order.splice(target, 0, moved);
    void commit({ ...settings, pageOrder: order });
  };

  const togglePageVisibility = (id: string) => {
    const hidden = settings.hiddenPages.includes(id)
      ? settings.hiddenPages.filter((p) => p !== id)
      : [...settings.hiddenPages, id];
    void commit({ ...settings, hiddenPages: hidden });
  };

  const SIDEBAR_ITEMS: SidebarItem[] = [
    {
      id: "general",
      label: msg.settings.sections.general || "General",
      iconBg: "linear-gradient(180deg, #8e8e93 0%, #636366 100%)",
      icon: (p) => <SettingsIcon {...p} />,
    },
    {
      id: "display",
      label: msg.settings.sections.display || "Display",
      iconBg: "linear-gradient(180deg, #329aff 0%, #0066ff 100%)",
      icon: (p) => (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.85}
          className="h-3.5 w-3.5"
          {...p}
        >
          <rect x="2" y="3" width="20" height="14" rx="2.5" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
    {
      id: "pages",
      label: msg.settings.sections.pages || "Pages",
      iconBg: "linear-gradient(180deg, #4cd964 0%, #24b445 100%)",
      icon: (p) => (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="h-3.5 w-3.5"
          {...p}
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      ),
    },
    {
      id: "appearance",
      label: msg.settings.sections.appearance || "Appearance",
      iconBg: "linear-gradient(180deg, #d874ff 0%, #9b30d9 100%)",
      icon: (p) => (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.85}
          className="h-3.5 w-3.5"
          {...p}
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "music",
      label: "Music & Lyrics",
      iconBg: "linear-gradient(180deg, #ff5b7f 0%, #fa2449 100%)",
      icon: (p) => <MusicNoteIcon {...p} />,
    },
    {
      id: "notifications",
      label: "Notifications",
      iconBg: "linear-gradient(180deg, #ff6259 0%, #e62e24 100%)",
      icon: (p) => <BellIcon {...p} />,
    },
    {
      id: "widgets",
      label: msg.settings.sections.widgets || "Widgets",
      iconBg: "linear-gradient(180deg, #329aff 0%, #0066ff 100%)",
      icon: (p) => (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.85}
          className="h-3.5 w-3.5"
          {...p}
        >
          <rect
            x="3"
            y="3"
            width="7.5"
            height="7.5"
            rx="2"
            fill="currentColor"
            fillOpacity={0.25}
          />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
          <rect
            x="13.5"
            y="13.5"
            width="7.5"
            height="7.5"
            rx="2"
            fill="currentColor"
            fillOpacity={0.25}
          />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
        </svg>
      ),
    },
    {
      id: "todo",
      label: "To-do",
      iconBg: "linear-gradient(180deg, #4cd964 0%, #24b445 100%)",
      icon: (p) => (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
          {...p}
        >
          <path d="m8 12 3 3 6-6" />
          <rect x="3" y="3" width="18" height="18" rx="4" />
        </svg>
      ),
    },
    {
      id: "pomodoro",
      label: "Pomodoro",
      iconBg: "linear-gradient(180deg, #7d7aff 0%, #5856d6 100%)",
      icon: (p) => (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.85}
          strokeLinecap="round"
          className="h-3.5 w-3.5"
          {...p}
        >
          <circle cx="12" cy="13.5" r="7.5" />
          <line x1="12" y1="2.5" x2="12" y2="5" />
          <line x1="12" y1="13.5" x2="15" y2="10.5" />
        </svg>
      ),
    },
    {
      id: "water",
      label: "Water",
      iconBg: "linear-gradient(180deg, #5ac8fa 0%, #0099e6 100%)",
      icon: (p) => <DropletIcon {...p} />,
    },
    {
      id: "prayer",
      label: "Prayer",
      iconBg: "linear-gradient(180deg, #34d399 0%, #059669 100%)",
      icon: (p) => (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" {...p}>
          <path d="M12 3a7 7 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      ),
    },
    {
      id: "shelf",
      label: "Shelf",
      iconBg: "linear-gradient(180deg, #ffb340 0%, #ff8800 100%)",
      icon: (p) => <FileIcon {...p} />,
    },
    {
      id: "hud",
      label: "HUD & popups",
      iconBg: "linear-gradient(180deg, #70d7ff 0%, #0a84ff 100%)",
      icon: (p) => <CapsIcon {...p} />,
    },
    {
      id: "plugins",
      label: msg.settings.sections.plugins || "Plugins",
      iconBg: "linear-gradient(180deg, #ff6961 0%, #d70015 100%)",
      icon: (p) => (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.85}
          strokeLinecap="round"
          className="h-3.5 w-3.5"
          {...p}
        >
          <path d="M12 2v4M8 6h8v4a4 4 0 0 1-8 0V6Z" />
          <path d="M12 14v8" />
        </svg>
      ),
    },
    {
      id: "about",
      label: msg.settings.sections.about || "About",
      iconBg: "linear-gradient(180deg, #7c7c80 0%, #48484a 100%)",
      icon: (p) => (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="h-3.5 w-3.5"
          {...p}
        >
          <circle cx="12" cy="12" r="9.5" />
          <line x1="12" y1="16" x2="12" y2="11.5" />
          <circle cx="12" cy="8" r="0.75" fill="currentColor" />
        </svg>
      ),
    },
  ];

  const currentItem = SIDEBAR_ITEMS.find((s) => s.id === section) ?? SIDEBAR_ITEMS[0];

  return (
    <div
      data-testid="settings-window"
      className="flex h-screen w-screen overflow-hidden select-none font-sans text-white"
      style={{
        backgroundColor: "var(--surface)",
        color: "var(--text-primary)",
      }}
    >
      {/* Apple-style Sidebar (Left) */}
      <aside
        aria-label="Settings sections"
        className="flex w-64 shrink-0 flex-col p-3 pt-4"
        style={{
          backgroundColor: "#070709",
          borderRight: "1px solid var(--hairline)",
        }}
      >
        {/* Window Traffic Lights & Title */}
        <div className="mb-4 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              title="Close"
              className="flex h-3 w-3 items-center justify-center rounded-full bg-[#ff5f56] hover:opacity-80 active:opacity-60 border-0 cursor-pointer p-0"
            />
            <div className="h-3 w-3 rounded-full bg-[#febc2e] opacity-60" />
            <div className="h-3 w-3 rounded-full bg-[#28c840] opacity-60" />
          </div>
          <span className="text-xs font-semibold tracking-wide text-[#8e8e93]">
            {msg.settings.title}
          </span>
        </div>

        {/* Navigation List */}
        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
          {SIDEBAR_ITEMS.map((item) => {
            const active = item.id === section;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all ${
                  active
                    ? "bg-[#1a1a1d] text-white"
                    : "bg-transparent text-[#98989d] hover:bg-[#121215] hover:text-[#e5e5ea]"
                }`}
                style={{
                  border: active ? "1px solid var(--hairline-top)" : "1px solid transparent",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-white"
                    style={{
                      background: item.iconBg,
                      boxShadow:
                        "inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 1px 3px rgba(0, 0, 0, 0.65)",
                    }}
                  >
                    {item.icon({ size: 13 })}
                  </span>
                  <span className="text-[13px] font-medium">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="rounded bg-[#0a84ff] px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Content Area (Right) */}
      <main
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {/* Header Bar */}
        <header
          className="flex h-14 shrink-0 items-center justify-between px-8"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          <h1 className="text-xl font-bold tracking-tight text-white">{currentItem.label}</h1>
          <div className="flex items-center gap-3">
            {statusBanner && (
              <span className="rounded-full bg-[#30d158]/15 px-3 py-1 text-xs font-medium text-[#30d158] border border-[#30d158]/30">
                {statusBanner}
              </span>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2c2c2e] text-[#8e8e93] hover:bg-[#3a3a3c] hover:text-white border-0 cursor-pointer text-xs"
              title="Close window"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {warningBanner && (
            <div
              role="alert"
              className="rounded-xl border border-[#ff9f0a]/40 bg-[#ff9f0a]/10 p-3 text-xs text-[#ff9f0a]"
            >
              {warningBanner}
            </div>
          )}

          {/* Section: GENERAL */}
          {section === "general" && (
            <div className="space-y-6">
              {/* Group: Startup */}
              <AppleGroup title="Startup">
                <AppleRow
                  label="Start with Windows"
                  hint="Launch Lumen automatically when you sign in."
                >
                  <AppleToggle
                    checked={settings.startWithWindows}
                    onChange={(v) => void commit({ ...settings, startWithWindows: v })}
                  />
                </AppleRow>
              </AppleGroup>

              {/* Group: Notch Size & Behavior */}
              <AppleGroup title="Notch">
                <div className="p-4 space-y-4">
                  <div>
                    <div className="text-[13px] font-medium text-white">Size</div>
                    <div className="text-[12px] text-[#8e8e93] mt-0.5">
                      Adjust the default scale of the dynamic island
                    </div>
                    {/* Scale Segmented Control */}
                    <div className="mt-3 flex rounded-lg bg-[#141416] p-1 border border-[#2c2c2e]/50 max-w-md">
                      {(["auto", "100", "115", "130", "150"] as const).map((s) => {
                        const active = String(settings.scale) === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => void commit({ ...settings, scale: s })}
                            className={`flex-1 rounded-md py-1 text-xs font-medium transition-all border-0 cursor-pointer ${
                              active
                                ? "bg-[#3a3a3c] text-white shadow"
                                : "bg-transparent text-[#8e8e93] hover:text-[#d1d1d6]"
                            }`}
                          >
                            {s === "auto" ? "Auto" : `${s}%`}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="h-[1px] bg-[#2c2c2e]/50" />

                  <AppleRow
                    label="Minimal notch"
                    hint="A smaller pill when nothing is playing or active"
                  >
                    <AppleToggle
                      checked={settings.minimalNotch}
                      onChange={(v) => void commit({ ...settings, minimalNotch: v })}
                    />
                  </AppleRow>

                  <div className="h-[1px] bg-[#2c2c2e]/50" />

                  <AppleRow
                    label="Lumi mascot"
                    hint="A little animated friend that lives inside the notch"
                  >
                    <AppleToggle
                      checked={settings.mascotEnabled}
                      onChange={(v) => void commit({ ...settings, mascotEnabled: v })}
                    />
                  </AppleRow>

                  <div className="h-[1px] bg-[#2c2c2e]/50" />

                  <AppleRow
                    label="Date & time"
                    hint="The clock and date beside the status ring in the resting pill"
                  >
                    <AppleToggle
                      checked={settings.showHeaderClock}
                      onChange={(v) => void commit({ ...settings, showHeaderClock: v })}
                    />
                  </AppleRow>

                  <div className="h-[1px] bg-[#2c2c2e]/50" />

                  <AppleRow
                    label="Hover to open"
                    hint="Expands on cursor hover and shrinks to slim notch on mouse leave"
                  >
                    <AppleToggle
                      checked={settings.hoverToOpen}
                      onChange={(v) => void commit({ ...settings, hoverToOpen: v })}
                    />
                  </AppleRow>
                </div>
              </AppleGroup>

              {/* Group: Fullscreen */}
              <AppleGroup title="Full screen">
                <AppleRow
                  label="Hide in full screen"
                  hint="Games, videos and slides that fill the screen"
                >
                  <AppleToggle
                    checked={settings.hideInFullscreen}
                    onChange={(v) => void commit({ ...settings, hideInFullscreen: v })}
                  />
                </AppleRow>
              </AppleGroup>

              {/* Group: Language & Hotkeys */}
              <AppleGroup title="Language & Shortcuts">
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-medium text-white">Language</div>
                      <div className="text-[12px] text-[#8e8e93]">
                        Switch between English and Bangla
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(["en", "bn"] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => void commit({ ...settings, language: lang })}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold border-0 cursor-pointer transition-all ${
                            settings.language === lang
                              ? "bg-[#0a84ff] text-white"
                              : "bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
                          }`}
                        >
                          {lang === "en" ? "English" : "বাংলা"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-[1px] bg-[#2c2c2e]/50" />

                  <div className="space-y-3">
                    <div className="text-[13px] font-medium text-white">Global Hotkeys</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-[#8e8e93] mb-1">Show / Hide</div>
                        <input
                          type="text"
                          value={settings.hotkeyHide}
                          onChange={(e) => void commit({ ...settings, hotkeyHide: e.target.value })}
                          className="w-full rounded-lg bg-[#141416] px-3 py-1.5 text-xs text-white border border-[#2c2c2e] focus:border-[#0a84ff] outline-none"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-[#8e8e93] mb-1">Open / Collapse</div>
                        <input
                          type="text"
                          value={settings.hotkeyExpand}
                          onChange={(e) =>
                            void commit({ ...settings, hotkeyExpand: e.target.value })
                          }
                          className="w-full rounded-lg bg-[#141416] px-3 py-1.5 text-xs text-white border border-[#2c2c2e] focus:border-[#0a84ff] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </AppleGroup>
            </div>
          )}

          {/* Section: DISPLAY */}
          {section === "display" && (
            <div className="space-y-6">
              <AppleGroup title="Monitor Placement">
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-medium text-white">Placement Mode</div>
                      <div className="text-[12px] text-[#8e8e93]">
                        Which monitor to pin Lumen to
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(["primary", "active", "index"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => void commit({ ...settings, monitorMode: mode })}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold border-0 cursor-pointer capitalize ${
                            settings.monitorMode === mode
                              ? "bg-[#0a84ff] text-white"
                              : "bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {monitors.length > 0 && settings.monitorMode === "index" && (
                    <div className="pt-2">
                      <div className="text-xs text-[#8e8e93] mb-1.5">Select Monitor Index</div>
                      <select
                        value={settings.monitorIndex}
                        onChange={(e) =>
                          void commit({ ...settings, monitorIndex: Number(e.target.value) })
                        }
                        className="w-full rounded-lg bg-[#141416] px-3 py-2 text-xs text-white border border-[#2c2c2e] outline-none"
                      >
                        {monitors.map((m) => (
                          <option key={m.index} value={m.index}>
                            #{m.index + 1}: {m.name} ({m.width}x{m.height})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="h-[1px] bg-[#2c2c2e]/50" />

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-medium text-white">Horizontal Offset</div>
                      <span className="text-xs font-mono text-[#0a84ff]">
                        {settings.positionOffsetX} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-400}
                      max={400}
                      step={4}
                      value={settings.positionOffsetX}
                      onChange={(e) =>
                        void commit({ ...settings, positionOffsetX: Number(e.target.value) })
                      }
                      className="w-full mt-2 accent-[#0a84ff]"
                    />
                  </div>
                </div>
              </AppleGroup>
            </div>
          )}

          {/* Section: PAGES */}
          {section === "pages" && (
            <div className="space-y-6">
              <AppleGroup title={msg.settings.sections.pages}>
                <div className="p-4 space-y-2">
                  <div className="text-xs text-[#8e8e93] mb-3">
                    {msg.settings.pagesTab.description}
                  </div>
                  {settings.pageOrder.map((pageId, idx) => {
                    const isHidden = settings.hiddenPages.includes(pageId);
                    return (
                      <div
                        key={pageId}
                        className="flex items-center justify-between rounded-xl bg-[#141416] p-3 border border-[#2c2c2e]/60"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-mono text-[#8e8e93] w-4">{idx + 1}.</span>
                          <span className="text-sm font-medium capitalize text-white">
                            {pageId}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => movePage(idx, -1)}
                            className="rounded-lg bg-[#2c2c2e] px-2.5 py-1 text-xs text-white hover:bg-[#3a3a3c] disabled:opacity-30 border-0 cursor-pointer"
                          >
                            {msg.settings.pagesTab.moveUp}
                          </button>
                          <button
                            type="button"
                            disabled={idx === settings.pageOrder.length - 1}
                            onClick={() => movePage(idx, 1)}
                            className="rounded-lg bg-[#2c2c2e] px-2.5 py-1 text-xs text-white hover:bg-[#3a3a3c] disabled:opacity-30 border-0 cursor-pointer"
                          >
                            {msg.settings.pagesTab.moveDown}
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePageVisibility(pageId)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold border-0 cursor-pointer ${
                              isHidden
                                ? "bg-[#ff453a]/20 text-[#ff453a]"
                                : "bg-[#30d158]/20 text-[#30d158]"
                            }`}
                          >
                            {isHidden
                              ? msg.settings.pagesTab.hidden
                              : msg.settings.pagesTab.visible}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AppleGroup>
            </div>
          )}

          {/* Section: APPEARANCE */}
          {section === "appearance" && (
            <div className="space-y-6">
              <AppleGroup title="Surface Styling">
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-medium text-white">Island Shape</div>
                      <div className="text-[12px] text-[#8e8e93]">
                        Attached top notch or floating pill
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void commit({ ...settings, shapeStyle: "notch" })}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold border-0 cursor-pointer ${
                          settings.shapeStyle === "notch"
                            ? "bg-[#bf5af2] text-white"
                            : "bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
                        }`}
                      >
                        Notch
                      </button>
                      <button
                        type="button"
                        onClick={() => void commit({ ...settings, shapeStyle: "pill" })}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold border-0 cursor-pointer ${
                          settings.shapeStyle === "pill"
                            ? "bg-[#bf5af2] text-white"
                            : "bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
                        }`}
                      >
                        Floating Pill
                      </button>
                    </div>
                  </div>

                  <div className="h-[1px] bg-[#2c2c2e]/50" />

                  <AppleRow
                    label="Reduce Motion Override"
                    hint="Use faster 120ms transitions regardless of Windows OS settings"
                  >
                    <AppleToggle
                      checked={settings.reducedMotionOverride}
                      onChange={(v) => void commit({ ...settings, reducedMotionOverride: v })}
                    />
                  </AppleRow>
                </div>
              </AppleGroup>
            </div>
          )}

          {/* Section: MUSIC */}
          {section === "music" && (
            <div className="space-y-6">
              <AppleGroup title="Media & Lyrics">
                <div className="p-4 space-y-4">
                  <div>
                    <div className="text-[13px] font-medium text-white">Excluded Media Apps</div>
                    <div className="text-[12px] text-[#8e8e93] mb-2">
                      Hide sessions from specific apps (comma-separated, e.g. discord, slack)
                    </div>
                    <input
                      type="text"
                      value={settings.mediaExclusions.join(", ")}
                      onChange={(e) => {
                        const arr = e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        void commit({ ...settings, mediaExclusions: arr });
                      }}
                      className="w-full rounded-lg bg-[#141416] px-3 py-2 text-xs text-white border border-[#2c2c2e] focus:border-[#ff375f] outline-none"
                      placeholder="discord, zoom"
                    />
                  </div>
                </div>
              </AppleGroup>
            </div>
          )}

          {/* Section: NOTIFICATIONS */}
          {section === "notifications" && (
            <div className="space-y-6">
              <AppleGroup title="Notification Privacy">
                <div className="p-4 space-y-4">
                  <AppleRow
                    label="Notification Popups"
                    hint="Show toast pills on the desktop island"
                  >
                    <AppleToggle
                      checked={notifyCfg.enabled}
                      onChange={(v) => void commitNotify({ ...notifyCfg, enabled: v })}
                    />
                  </AppleRow>

                  <div className="h-[1px] bg-[#2c2c2e]/50" />

                  <AppleRow
                    label="Hide Previews"
                    hint="Mask the message body until you hover or click"
                  >
                    <AppleToggle
                      checked={notifyCfg.hide_previews}
                      onChange={(v) => void commitNotify({ ...notifyCfg, hide_previews: v })}
                    />
                  </AppleRow>

                  <div className="h-[1px] bg-[#2c2c2e]/50" />

                  <AppleRow
                    label="Quiet in Full Screen"
                    hint="Suppress popups when games or presentations are active"
                  >
                    <AppleToggle
                      checked={notifyCfg.quiet_during_fullscreen}
                      onChange={(v) =>
                        void commitNotify({ ...notifyCfg, quiet_during_fullscreen: v })
                      }
                    />
                  </AppleRow>

                  <div className="h-[1px] bg-[#2c2c2e]/50" />

                  <button
                    type="button"
                    onClick={() =>
                      void notifyPushTest(
                        "Lumen",
                        "Test Alert",
                        "Your dynamic island notifications are active",
                      )
                    }
                    className="rounded-lg bg-[#0a84ff] px-4 py-2 text-xs font-semibold text-white border-0 cursor-pointer hover:bg-[#0071e3]"
                  >
                    Send Test Notification
                  </button>
                </div>
              </AppleGroup>
            </div>
          )}

          {/* Section: WATER */}
          {section === "water" && (
            <div className="space-y-6">
              <AppleGroup title="Hydration Settings">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-medium text-white">Daily Water Goal</div>
                      <div className="text-[12px] text-[#8e8e93]">Default is 1500 mL per day</div>
                    </div>
                    <span className="text-sm font-mono text-[#32ade6]">
                      {settings.waterGoalMl} mL
                    </span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={4000}
                    step={100}
                    value={settings.waterGoalMl}
                    onChange={(e) =>
                      void commit({ ...settings, waterGoalMl: Number(e.target.value) })
                    }
                    className="w-full accent-[#32ade6]"
                  />
                </div>
              </AppleGroup>
            </div>
          )}

          {/* Section: PLUGINS */}
          {section === "plugins" && (
            <div className="space-y-6">
              <AppleGroup title="Installed Plugins">
                <div className="p-4 space-y-3">
                  {effectivePlugins.length === 0 ? (
                    <div className="text-xs text-[#8e8e93] py-2">
                      No third-party plugins installed. Drop plugins into{" "}
                      <code className="text-[#0a84ff]">%APPDATA%\Lumen\plugins</code>.
                    </div>
                  ) : (
                    effectivePlugins.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl bg-[#141416] p-3 border border-[#2c2c2e]/60"
                      >
                        <div>
                          <div className="text-sm font-medium text-white">{p.name}</div>
                          <div className="text-xs text-[#8e8e93]">
                            v{p.version} · {p.permissions.join(", ")}
                          </div>
                        </div>
                        <span className="rounded bg-[#30d158]/20 px-2 py-0.5 text-xs text-[#30d158]">
                          Active
                        </span>
                      </div>
                    ))
                  )}
                  {onReloadPlugins && (
                    <button
                      type="button"
                      onClick={onReloadPlugins}
                      className="mt-2 rounded-lg bg-[#2c2c2e] px-3 py-1.5 text-xs text-white hover:bg-[#3a3a3c] border-0 cursor-pointer"
                    >
                      Reload Plugins
                    </button>
                  )}
                </div>
              </AppleGroup>
            </div>
          )}

          {/* Section: ABOUT */}
          {section === "about" && (
            <div className="space-y-6">
              <AppleGroup title="About Lumen">
                <div className="p-6 text-center space-y-3">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0a84ff] to-[#bf5af2] text-3xl font-black text-white shadow-lg">
                    L
                  </div>
                  <h2 className="text-lg font-bold text-white m-0">Lumen for Windows</h2>
                  <p className="text-xs text-[#8e8e93] max-w-sm mx-auto m-0">
                    Free, open-source Dynamic Island engineered for Windows 10 & 11 with native DWM
                    and 60fps/120fps motion.
                  </p>
                  <div className="pt-2 text-[11px] text-[#636366]">
                    Version 1.0.0 · MIT License · 100% Offline & Zero Telemetry
                  </div>
                </div>
              </AppleGroup>
            </div>
          )}

          {/* Fallback for other widgets */}
          {["widgets", "todo", "pomodoro", "prayer", "shelf", "hud"].includes(section) && (
            <div className="space-y-6">
              <AppleGroup title={`${currentItem.label} Configuration`}>
                <div className="p-4 text-xs text-[#8e8e93]">
                  All live activity settings and alerts for {currentItem.label} are automatically
                  synchronized with your active Notch state.
                </div>
              </AppleGroup>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ---------------- Helper Apple UI Components ----------------

function AppleGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="px-1 text-xs font-semibold tracking-wide text-[#8e8e93]">{title}</div>
      <div
        className="overflow-hidden rounded-2xl shadow-sm"
        style={{
          backgroundColor: "#0c0c0e",
          border: "1px solid var(--hairline)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function AppleRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="pr-4">
        <div className="text-[13px] font-medium text-white">{label}</div>
        {hint && <div className="text-[12px] text-[#8e8e93] mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function AppleToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? "bg-[#30d158]" : "bg-[#39393d]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
