import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { BellIcon, SettingsIcon } from "../design/icons";
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
  prayerSetMethod,
  settingsGet,
  settingsUpdate,
} from "../lib/ipc";
import { DEFAULT_SETTINGS, type LumenSettings } from "./index";

export type SettingsSection =
  "general" | "appearance" | "pages" | "notifications" | "widgets" | "plugins" | "about";

interface SidebarItem {
  id: SettingsSection;
  label: string;
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
  const isBn = settings.language === "bn";

  useEffect(() => {
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

  const handleMinimize = () => {
    try {
      void getCurrentWindow().minimize();
    } catch {
      // ignore outside Tauri
    }
  };

  const visiblePageOrder = settings.pageOrder.filter((id) => id !== "music" && id !== "prayer");

  const movePage = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= visiblePageOrder.length) {
      return;
    }
    const order = [...visiblePageOrder];
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
      id: "notifications",
      label: isBn ? "নোটিফিকেশন" : "Notifications",
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
      id: "plugins",
      label: msg.settings.sections.plugins || "Plugins",
      iconBg: "linear-gradient(180deg, #ff9f0a 0%, #e07b00 100%)",
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
      {/* Clean Minimal Sidebar */}
      <aside
        aria-label="Settings sections"
        className="flex w-60 shrink-0 flex-col p-3 pt-4"
        style={{
          backgroundColor: "#070709",
          borderRight: "1px solid var(--hairline)",
        }}
      >
        <div data-tauri-drag-region className="mb-4 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              title="Close"
              className="flex h-3 w-3 cursor-pointer items-center justify-center rounded-full border-0 bg-[#ff5f56] p-0 hover:opacity-80 active:opacity-60"
            />
            <button
              type="button"
              onClick={handleMinimize}
              title="Minimize"
              className="h-3 w-3 cursor-pointer rounded-full border-0 bg-[#febc2e] p-0 hover:opacity-80 active:opacity-60"
            />
            <div className="h-3 w-3 rounded-full bg-[#28c840] opacity-40" />
          </div>
          <span
            data-tauri-drag-region
            className="text-xs font-semibold tracking-wide text-[#8e8e93]"
          >
            {msg.settings.title}
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
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
                <span className="flex items-center gap-2.5">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                    style={{ background: item.iconBg }}
                  >
                    {item.icon({ size: 13 })}
                  </span>
                  <span className="text-[13px] font-medium">{item.label}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main
        className="flex flex-1 flex-col overflow-hidden"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <header
          data-tauri-drag-region
          className="flex h-14 shrink-0 items-center justify-between px-8"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          <h1 data-tauri-drag-region className="text-xl font-bold tracking-tight text-white">
            {currentItem.label}
          </h1>
          <div className="flex items-center gap-3">
            {statusBanner && (
              <span className="rounded-full border border-[#30d158]/30 bg-[#30d158]/15 px-3 py-1 text-xs font-medium text-[#30d158]">
                {statusBanner}
              </span>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-[#2c2c2e] text-xs text-[#8e8e93] hover:bg-[#3a3a3c] hover:text-white"
              title="Close window"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-8">
          {warningBanner && (
            <div
              role="alert"
              className="rounded-xl border border-[#ff9f0a]/40 bg-[#ff9f0a]/10 p-3 text-xs text-[#ff9f0a]"
            >
              {warningBanner}
            </div>
          )}

          {/* 1. GENERAL (Startup, Notch Size & Placement, Resting Bar Indicators, Playback Banner, Language & Hotkeys) */}
          {section === "general" && (
            <div className="space-y-6">
              <AppleGroup title={isBn ? "স্টার্টআপ ও আচরণ" : "Startup & Behavior"}>
                <div className="divide-y divide-[#2c2c2e]/50">
                  <AppleRow
                    label={isBn ? "Windows-এর সাথে চালু করুন" : "Start with Windows"}
                    hint={
                      isBn
                        ? "লগইন করার পর স্বয়ংক্রিয়ভাবে লুমেন চালু হবে"
                        : "Launch Lumen automatically when you sign in"
                    }
                  >
                    <AppleToggle
                      checked={settings.startWithWindows}
                      onChange={(v) => void commit({ ...settings, startWithWindows: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label={isBn ? "ফুলস্ক্রিনে লুকিয়ে রাখুন" : "Hide in full screen"}
                    hint={
                      isBn
                        ? "গেম, মুভি বা স্লাইড চলাকালীন নচ অটো-হাইড থাকবে"
                        : "Games, videos and slides that fill the screen"
                    }
                  >
                    <AppleToggle
                      checked={settings.hideInFullscreen}
                      onChange={(v) => void commit({ ...settings, hideInFullscreen: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label={isBn ? "হোভার করলে খুলবে" : "Hover to open"}
                    hint={
                      isBn
                        ? "মাউস নিলে বড় হবে এবং সরিয়ে নিলে ছোট হয়ে যাবে"
                        : "Expands on cursor hover and shrinks on mouse leave"
                    }
                  >
                    <AppleToggle
                      checked={settings.hoverToOpen}
                      onChange={(v) => void commit({ ...settings, hoverToOpen: v })}
                    />
                  </AppleRow>

                  {settings.hoverToOpen && (
                    <AppleRow
                      label={msg.settings.appearance.hoverReturnSeconds}
                      hint={msg.settings.appearance.hoverReturnSecondsHint}
                    >
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {[0, 3, 5, 10, 15].map((secs) => (
                          <button
                            key={secs}
                            type="button"
                            onClick={() => void commit({ ...settings, hoverReturnSeconds: secs })}
                            className={`cursor-pointer rounded-lg border-0 px-2.5 py-1 text-xs font-semibold transition-all ${
                              settings.hoverReturnSeconds === secs
                                ? "bg-[#0a84ff] text-white"
                                : "bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
                            }`}
                          >
                            {secs === 0 ? "Immediate" : `${secs}s`}
                          </button>
                        ))}
                      </div>
                    </AppleRow>
                  )}
                </div>
              </AppleGroup>

              <AppleGroup
                title={isBn ? "ডিফল্ট নচ ও স্ট্যাটাস ইন্ডিকেটর" : "Resting Notch & Indicators"}
              >
                <div className="divide-y divide-[#2c2c2e]/50">
                  <AppleRow
                    label={isBn ? "মাঝখানে সময় (ঘড়ি)" : "Centered Time Clock"}
                    hint={
                      isBn
                        ? "নচের একদম মাঝখানে সবসময় সময় দেখাবে"
                        : "Always keep the live clock centered in the resting notch"
                    }
                  >
                    <AppleToggle
                      checked={settings.restingShowClock}
                      onChange={(v) => void commit({ ...settings, restingShowClock: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label={isBn ? "ডানদিকে মিউজিক ওয়েভ" : "Right-Side Music Wave"}
                    hint={
                      isBn
                        ? "গান বা ইউটিউব চললে নড়বে, বন্ধ থাকলে স্থির থাকবে"
                        : "Animates during music/YouTube playback and rests idle when stopped"
                    }
                  >
                    <AppleToggle
                      checked={settings.restingShowWaveform}
                      onChange={(v) => void commit({ ...settings, restingShowWaveform: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label={isBn ? "বামদিকে মাইক্রোফোন ও ক্যামেরা ডট" : "Left Mic & Camera Dots"}
                    hint={
                      isBn
                        ? "ক্যামেরা চালু হলে সবুজ ও মাইক চালু হলে কমলা ডট জ্বলবে"
                        : "Show green camera and orange microphone indicator dots"
                    }
                  >
                    <AppleToggle
                      checked={settings.restingShowSensorDots}
                      onChange={(v) => void commit({ ...settings, restingShowSensorDots: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label={
                      isBn ? "বামদিকে চার্জিং রিং ও ব্যাটারি %" : "Left Charging Ring & Battery %"
                    }
                    hint={
                      isBn
                        ? "ল্যাপটপ চার্জে থাকলে গোল চার্জিং আইকন ও % দেখাবে"
                        : "Show circular charging ring and battery percentage when plugged in or low"
                    }
                  >
                    <AppleToggle
                      checked={settings.restingShowBatteryRing}
                      onChange={(v) => void commit({ ...settings, restingShowBatteryRing: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label={isBn ? "মিনিমাল নচ" : "Minimal notch"}
                    hint={
                      isBn
                        ? "আইডল অবস্থায় আরও ছোট পিল দেখাবে"
                        : "A smaller resting pill when nothing is active"
                    }
                  >
                    <AppleToggle
                      checked={settings.minimalNotch}
                      onChange={(v) => void commit({ ...settings, minimalNotch: v })}
                    />
                  </AppleRow>
                </div>
              </AppleGroup>

              <AppleGroup
                title={isBn ? "ইউটিউব / মিডিয়া নাউ-প্লেইং ব্যানার" : "Now-Playing Start Banner"}
              >
                <div className="divide-y divide-[#2c2c2e]/50">
                  <AppleRow
                    label={isBn ? "প্লে শুরু হলে কী চলছে দেখাও" : "Brief Now-Playing Banner"}
                    hint={
                      isBn
                        ? "ইউটিউব বা গান শুরু হলে হালকা বড় করে নাম দেখাবে, তারপর ডিফল্ট ঘড়িতে ফিরবে"
                        : "Briefly expand to show track info on playback start, then return to default clock"
                    }
                  >
                    <AppleToggle
                      checked={settings.nowPlayingBannerEnabled}
                      onChange={(v) => void commit({ ...settings, nowPlayingBannerEnabled: v })}
                    />
                  </AppleRow>

                  {settings.nowPlayingBannerEnabled && (
                    <AppleRow
                      label={isBn ? "ব্যানার দেখানোর সময়" : "Track Banner Duration"}
                      hint={
                        isBn
                          ? "কতক্ষণ পর আবার ডিফল্ট নচ ভিউতে ফিরে আসবে"
                          : "Seconds before smoothly returning to the centered clock notch"
                      }
                    >
                      <div className="flex gap-1.5">
                        {[2, 4, 6, 8].map((secs) => (
                          <button
                            key={secs}
                            type="button"
                            onClick={() =>
                              void commit({ ...settings, nowPlayingBannerSeconds: secs })
                            }
                            className={`cursor-pointer rounded-lg border-0 px-2.5 py-1 text-xs font-semibold ${
                              settings.nowPlayingBannerSeconds === secs
                                ? "bg-[#0a84ff] text-white"
                                : "bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
                            }`}
                          >
                            {secs}s
                          </button>
                        ))}
                      </div>
                    </AppleRow>
                  )}
                </div>
              </AppleGroup>

              <AppleGroup title={isBn ? "সাইজ ও মনিটর পজিশন" : "Size & Display Placement"}>
                <div className="space-y-4 p-4">
                  <div>
                    <div className="text-[13px] font-medium text-white">Scale Size</div>
                    <div className="mt-0.5 text-[12px] text-[#8e8e93]">
                      Adjust overall scale of the Dynamic Island
                    </div>
                    <div className="mt-3 flex max-w-md rounded-lg border border-[#2c2c2e]/50 bg-[#141416] p-1">
                      {(["auto", "100", "115", "130", "150"] as const).map((s) => {
                        const active = String(settings.scale) === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => void commit({ ...settings, scale: s })}
                            className={`flex-1 cursor-pointer rounded-md border-0 py-1 text-xs font-medium transition-all ${
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

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[13px] font-medium text-white">Monitor Placement</div>
                      <div className="text-[12px] text-[#8e8e93]">Which display shows Lumen</div>
                    </div>
                    <div className="flex gap-2">
                      {(["primary", "active", "index"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => void commit({ ...settings, monitorMode: mode })}
                          className={`cursor-pointer rounded-lg border-0 px-3 py-1.5 text-xs font-semibold capitalize ${
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
                    <select
                      value={settings.monitorIndex}
                      onChange={(e) =>
                        void commit({ ...settings, monitorIndex: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-[#2c2c2e] bg-[#141416] px-3 py-2 text-xs text-white outline-none"
                    >
                      {monitors.map((m) => (
                        <option key={m.index} value={m.index}>
                          #{m.index + 1}: {m.name} ({m.width}x{m.height})
                        </option>
                      ))}
                    </select>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-medium text-white">Horizontal Offset</div>
                      <span className="font-mono text-xs text-[#0a84ff]">
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
                      className="mt-2 w-full accent-[#0a84ff]"
                    />
                  </div>
                </div>
              </AppleGroup>

              <AppleGroup title={isBn ? "ভাষা ও শর্টকাট" : "Language & Shortcuts"}>
                <div className="space-y-4 p-4">
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
                          className={`cursor-pointer rounded-lg border-0 px-3 py-1.5 text-xs font-semibold transition-all ${
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="mb-1 text-xs text-[#8e8e93]">Global Hotkey: Show / Hide</div>
                      <input
                        type="text"
                        value={settings.hotkeyHide}
                        onChange={(e) => void commit({ ...settings, hotkeyHide: e.target.value })}
                        className="w-full rounded-lg border border-[#2c2c2e] bg-[#141416] px-3 py-1.5 text-xs text-white outline-none focus:border-[#0a84ff]"
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-[#8e8e93]">
                        Global Hotkey: Open / Collapse
                      </div>
                      <input
                        type="text"
                        value={settings.hotkeyExpand}
                        onChange={(e) => void commit({ ...settings, hotkeyExpand: e.target.value })}
                        className="w-full rounded-lg border border-[#2c2c2e] bg-[#141416] px-3 py-1.5 text-xs text-white outline-none focus:border-[#0a84ff]"
                      />
                    </div>
                  </div>
                </div>
              </AppleGroup>
            </div>
          )}

          {/* 2. APPEARANCE & SOUND */}
          {section === "appearance" && (
            <div className="space-y-6">
              <AppleGroup title={isBn ? "আকৃতি ও ভিজ্যুয়াল" : "Shape & Visuals"}>
                <div className="divide-y divide-[#2c2c2e]/50">
                  <div className="flex items-center justify-between p-4">
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
                        className={`cursor-pointer rounded-lg border-0 px-3 py-1.5 text-xs font-semibold ${
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
                        className={`cursor-pointer rounded-lg border-0 px-3 py-1.5 text-xs font-semibold ${
                          settings.shapeStyle === "pill"
                            ? "bg-[#bf5af2] text-white"
                            : "bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
                        }`}
                      >
                        Floating Pill
                      </button>
                    </div>
                  </div>

                  <AppleRow
                    label={isBn ? "অ্যাকশন ম্যাসকট (Lumi)" : "Lumi Action Mascot"}
                    hint={
                      isBn
                        ? "অ্যাকশন বা অভ্যর্থনার সময় নচে Lumi-র চোখ ও হাত নাড়ানো অ্যানিমেশন দেখাবে"
                        : "Show expressive Lumi eyes & waving hand during actions and greetings"
                    }
                  >
                    <AppleToggle
                      checked={settings.mascotEnabled}
                      onChange={(v) => void commit({ ...settings, mascotEnabled: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label={isBn ? "মুভেবল অ্যাকশন গ্লো" : "Movable Action Glow"}
                    hint={
                      isBn
                        ? "নচের নিচের কিনারায় চলমান মাল্টি-কালার অরোরা আলো"
                        : "Flowing multi-color aurora glow along the bottom rim of the notch"
                    }
                  >
                    <div className="flex gap-1.5">
                      {(
                        [
                          ["action", isBn ? "অ্যাকশনে" : "On Action"],
                          ["always", isBn ? "সবসময়" : "Always"],
                          ["off", isBn ? "বন্ধ" : "Off"],
                        ] as const
                      ).map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => void commit({ ...settings, actionGlowMode: mode })}
                          className={`cursor-pointer rounded-lg border-0 px-2.5 py-1 text-xs font-semibold transition-colors ${
                            settings.actionGlowMode === mode
                              ? "bg-[#bf5af2] text-white"
                              : "bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </AppleRow>

                  <AppleRow
                    label="Show Full Date in Expanded Header"
                    hint="Show date beside the clock on expanded secondary pages"
                  >
                    <AppleToggle
                      checked={settings.showHeaderClock}
                      onChange={(v) => void commit({ ...settings, showHeaderClock: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label={msg.settings.homeTab.banglaDigits}
                    hint="Render clocks, countdowns, and hydration totals in Bangla digits"
                  >
                    <AppleToggle
                      checked={settings.banglaDigits}
                      onChange={(v) => void commit({ ...settings, banglaDigits: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label={msg.settings.homeTab.glowEnabled}
                    hint="Adaptive dawn, day, dusk, night, and album-art ambient glow"
                  >
                    <AppleToggle
                      checked={settings.glowEnabled}
                      onChange={(v) => void commit({ ...settings, glowEnabled: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label={msg.settings.homeTab.parallaxEnabled}
                    hint="Gently shift ambient glows up to 12 px toward the pointer"
                  >
                    <AppleToggle
                      checked={settings.parallaxEnabled}
                      onChange={(v) => void commit({ ...settings, parallaxEnabled: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label="Reduce Motion Override"
                    hint="Use faster 120ms transitions regardless of Windows OS settings"
                  >
                    <AppleToggle
                      checked={settings.reducedMotionOverride}
                      onChange={(v) => void commit({ ...settings, reducedMotionOverride: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label={msg.settings.homeTab.reduceTransparency}
                    hint="Use opaque card backgrounds without backdrop blur"
                  >
                    <AppleToggle
                      checked={settings.reduceTransparency}
                      onChange={(v) => void commit({ ...settings, reduceTransparency: v })}
                    />
                  </AppleRow>
                </div>
              </AppleGroup>

              <AppleGroup title={msg.settings.homeTab.chipsGroup}>
                <div className="divide-y divide-[#2c2c2e]/50">
                  <AppleRow label={msg.settings.homeTab.chipFocus}>
                    <AppleToggle
                      checked={settings.chipFocusEnabled}
                      onChange={(v) => void commit({ ...settings, chipFocusEnabled: v })}
                    />
                  </AppleRow>
                  <AppleRow label={msg.settings.homeTab.chipLedger}>
                    <AppleToggle
                      checked={settings.chipLedgerEnabled}
                      onChange={(v) => void commit({ ...settings, chipLedgerEnabled: v })}
                    />
                  </AppleRow>
                  <AppleRow label={msg.settings.homeTab.chipClipboard}>
                    <AppleToggle
                      checked={settings.chipClipboardEnabled}
                      onChange={(v) => void commit({ ...settings, chipClipboardEnabled: v })}
                    />
                  </AppleRow>
                  <AppleRow label={msg.settings.homeTab.chipDevPulse}>
                    <AppleToggle
                      checked={settings.chipDevPulseEnabled}
                      onChange={(v) => void commit({ ...settings, chipDevPulseEnabled: v })}
                    />
                  </AppleRow>
                </div>
              </AppleGroup>

              <AppleGroup title="Sound Design">
                <div className="divide-y divide-[#2c2c2e]/50">
                  <AppleRow
                    label={msg.settings.homeTab.soundsEnabled}
                    hint="Subtle synthesized UI tones — automatically silenced in calls, Focus, or mute"
                  >
                    <AppleToggle
                      checked={settings.soundEnabled}
                      onChange={(v) => void commit({ ...settings, soundEnabled: v })}
                    />
                  </AppleRow>

                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-medium text-white">
                        {msg.settings.homeTab.soundVolume}
                      </div>
                      <span className="font-mono text-xs text-[#0a84ff]">
                        {settings.soundVolume}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={settings.soundVolume}
                      onChange={(e) =>
                        void commit({ ...settings, soundVolume: Number(e.target.value) })
                      }
                      className="mt-2 w-full accent-[#0a84ff]"
                    />
                  </div>

                  <AppleRow
                    label={msg.settings.homeTab.soundInterface}
                    hint="Expand, collapse, toggles, water drops, and arc scrub ticks"
                  >
                    <AppleToggle
                      checked={settings.soundInterface}
                      onChange={(v) => void commit({ ...settings, soundInterface: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label={msg.settings.homeTab.soundReminders}
                    hint="Prayer reminders and incoming alarms"
                  >
                    <AppleToggle
                      checked={settings.soundReminders}
                      onChange={(v) => void commit({ ...settings, soundReminders: v })}
                    />
                  </AppleRow>
                </div>
              </AppleGroup>
            </div>
          )}

          {/* 3. PAGES */}
          {section === "pages" && (
            <div className="space-y-6">
              <AppleGroup title={msg.settings.sections.pages}>
                <div className="space-y-2 p-4">
                  <div className="mb-3 text-xs text-[#8e8e93]">
                    {msg.settings.pagesTab.description}
                  </div>
                  {visiblePageOrder.map((pageId, idx) => {
                    const isHidden = settings.hiddenPages.includes(pageId);
                    return (
                      <div
                        key={pageId}
                        className="flex items-center justify-between rounded-xl border border-[#2c2c2e]/60 bg-[#141416] p-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-4 font-mono text-xs text-[#8e8e93]">{idx + 1}.</span>
                          <span className="text-sm font-medium capitalize text-white">
                            {pageId}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => movePage(idx, -1)}
                            className="cursor-pointer rounded-lg border-0 bg-[#2c2c2e] px-2.5 py-1 text-xs text-white hover:bg-[#3a3a3c] disabled:opacity-30"
                          >
                            {msg.settings.pagesTab.moveUp}
                          </button>
                          <button
                            type="button"
                            disabled={idx === visiblePageOrder.length - 1}
                            onClick={() => movePage(idx, 1)}
                            className="cursor-pointer rounded-lg border-0 bg-[#2c2c2e] px-2.5 py-1 text-xs text-white hover:bg-[#3a3a3c] disabled:opacity-30"
                          >
                            {msg.settings.pagesTab.moveDown}
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePageVisibility(pageId)}
                            className={`cursor-pointer rounded-lg border-0 px-2.5 py-1 text-xs font-semibold ${
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

          {/* 4. NOTIFICATIONS & REMINDERS */}
          {section === "notifications" && (
            <div className="space-y-6">
              <AppleGroup title={isBn ? "নোটিফিকেশন ও প্রাইভেসি" : "Notification Popups & Preview"}>
                <div className="divide-y divide-[#2c2c2e]/50">
                  <AppleRow
                    label="Notification Popups"
                    hint="Show live OS & browser toasts inside the Dynamic Island"
                  >
                    <AppleToggle
                      checked={notifyCfg.enabled}
                      onChange={(v) => void commitNotify({ ...notifyCfg, enabled: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label="Hide Previews"
                    hint="Off shows standard-capped message previews with a More button for long texts"
                  >
                    <AppleToggle
                      checked={notifyCfg.hide_previews}
                      onChange={(v) => void commitNotify({ ...notifyCfg, hide_previews: v })}
                    />
                  </AppleRow>

                  <AppleRow
                    label={isBn ? "নোটিফিকেশন থাকার সময়" : "Notification Display Time"}
                    hint={
                      isBn
                        ? "কত সেকেন্ড পর অটো-ডিসমিস হবে"
                        : "How long incoming notifications remain visible"
                    }
                  >
                    <div className="flex gap-1.5">
                      {[5, 8, 12, 15].map((secs) => (
                        <button
                          key={secs}
                          type="button"
                          onClick={() =>
                            void commit({ ...settings, notificationDurationSeconds: secs })
                          }
                          className={`cursor-pointer rounded-lg border-0 px-2.5 py-1 text-xs font-semibold ${
                            settings.notificationDurationSeconds === secs
                              ? "bg-[#0a84ff] text-white"
                              : "bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
                          }`}
                        >
                          {secs}s
                        </button>
                      ))}
                    </div>
                  </AppleRow>

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

                  <div className="flex items-center justify-between gap-3 p-4">
                    <button
                      type="button"
                      onClick={() =>
                        void notifyPushTest(
                          "Lumen",
                          "Test Alert",
                          "Your dynamic island notifications are active with crisp previews and More reader support.",
                        )
                      }
                      className="cursor-pointer rounded-lg border-0 bg-[#0a84ff] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0071e3]"
                    >
                      Send Test Notification
                    </button>
                    <span className="text-[11px] text-[#30d158]">
                      Desktop & Browser Logo Sync Active
                    </span>
                  </div>
                </div>
              </AppleGroup>

              <AppleGroup title={isBn ? "টাইমড রিমাইন্ডার" : "Timed Reminders"}>
                <div className="divide-y divide-[#2c2c2e]/50">
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <div className="text-[13px] font-medium text-white">Reminder Snooze</div>
                      <div className="text-[12px] text-[#8e8e93]">
                        Auto re-alert delay when clicking Snooze
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg bg-[#2c2c2e] p-0.5">
                      {[2, 3, 5, 10].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => void commit({ ...settings, reminderSnoozeMinutes: mins })}
                          className={`cursor-pointer rounded-md border-0 px-2.5 py-1 text-xs font-medium transition-colors ${
                            settings.reminderSnoozeMinutes === mins
                              ? "bg-[#636366] text-white shadow-sm"
                              : "bg-transparent text-[#8e8e93] hover:text-white"
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <div className="text-[13px] font-medium text-white">
                        Default Lead Reminder
                      </div>
                      <div className="text-[12px] text-[#8e8e93]">
                        How early to warn before a scheduled reminder
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg bg-[#2c2c2e] p-0.5">
                      {[0, 5, 10, 15, 30].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() =>
                            void commit({ ...settings, reminderDefaultLeadMinutes: mins })
                          }
                          className={`cursor-pointer rounded-md border-0 px-2 py-1 text-xs font-medium transition-colors ${
                            settings.reminderDefaultLeadMinutes === mins
                              ? "bg-[#636366] text-white shadow-sm"
                              : "bg-transparent text-[#8e8e93] hover:text-white"
                          }`}
                        >
                          {mins === 0 ? "Exact" : `${mins}m`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </AppleGroup>
            </div>
          )}

          {/* 5. WIDGETS (Media, Hydration, Prayer & Location consolidated) */}
          {section === "widgets" && (
            <div className="space-y-6">
              <AppleGroup title="Media Exclusions">
                <div className="p-4">
                  <div className="text-[13px] font-medium text-white">Excluded Media Apps</div>
                  <div className="mb-2 text-[12px] text-[#8e8e93]">
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
                    className="w-full rounded-lg border border-[#2c2c2e] bg-[#141416] px-3 py-2 text-xs text-white outline-none focus:border-[#0a84ff]"
                    placeholder="discord, zoom"
                  />
                </div>
              </AppleGroup>

              <AppleGroup title="Hydration Goal">
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-medium text-white">Daily Water Goal</div>
                      <div className="text-[12px] text-[#8e8e93]">Default is 1500 mL per day</div>
                    </div>
                    <span className="font-mono text-sm text-[#32ade6]">
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

              <AppleGroup title="Prayer Times & Location">
                <div className="divide-y divide-[#2c2c2e]/50">
                  <div className="p-4">
                    <div className="mb-2 text-[13px] font-medium text-white">
                      Calculation Method
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["karachi", "Karachi (Bangladesh)"],
                          ["muslim_world_league", "MWL"],
                          ["egyptian", "Egyptian"],
                          ["umm_al_qura", "Umm al-Qura"],
                          ["north_america", "ISNA"],
                        ] as const
                      ).map(([method, label]) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => void prayerSetMethod(method, "hanafi")}
                          className="cursor-pointer rounded-lg border-0 bg-[#2c2c2e] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3a3a3c]"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <AppleRow
                    label={msg.settings.homeTab.locationOptIn}
                    hint={
                      isBn
                        ? "চালু থাকলে Windows লোকেশন থেকে নামাজ, সেহরি/ইফতার, কিবলা, সূর্যের আর্ক ও আবহাওয়া স্বয়ংক্রিয়ভাবে আপডেট হবে"
                        : "Automatically syncs prayer times, Iftar/Sehri, Qibla compass, Day Arc, and weather from your Windows location"
                    }
                  >
                    <AppleToggle
                      checked={settings.locationOptIn}
                      onChange={(v) => void commit({ ...settings, locationOptIn: v })}
                    />
                  </AppleRow>
                </div>
              </AppleGroup>

              <AppleGroup title={isBn ? "ওয়াক্ত টাইমলাইন" : "Waqt Timeline"}>
                <div className="divide-y divide-[#2c2c2e]/70">
                  <AppleRow
                    label={isBn ? "রাতের সমাপ্তি (Bedtime)" : "Night Block Bedtime"}
                    hint={
                      isBn
                        ? "ইশার পর রাতের ব্লক কোন সময় শেষ হবে"
                        : "Trims the Night Waqt block end time"
                    }
                  >
                    <input
                      type="time"
                      value={settings.waqtBedtimeHHMM}
                      onChange={(e) =>
                        void commit({ ...settings, waqtBedtimeHHMM: e.target.value || "23:30" })
                      }
                      className="rounded-lg border border-[#38383a] bg-[#2c2c2e] px-2.5 py-1 text-xs text-white outline-none"
                    />
                  </AppleRow>
                  <AppleRow
                    label={isBn ? "নামাজের সময় ফোকাস চললে" : "When Prayer Arrives During Focus"}
                    hint={
                      isBn
                        ? "ফোকাস টাইমার চলার সময় আজান/ওয়াক্ত এলে আচরণ"
                        : "Choose whether to ask, auto-pause, or keep going"
                    }
                  >
                    <select
                      value={settings.waqtPrayerPauseMode}
                      onChange={(e) =>
                        void commit({
                          ...settings,
                          waqtPrayerPauseMode: e.target.value as "ask" | "auto_pause" | "ignore",
                        })
                      }
                      className="rounded-lg border border-[#38383a] bg-[#2c2c2e] px-2.5 py-1 text-xs text-white outline-none"
                    >
                      <option value="ask">{isBn ? "জিজ্ঞাসা করুন" : "Ask"}</option>
                      <option value="auto_pause">{isBn ? "অটো পজ" : "Auto-pause"}</option>
                      <option value="ignore">{isBn ? "চালিয়ে যান" : "Ignore"}</option>
                    </select>
                  </AppleRow>
                  <AppleRow
                    label={isBn ? "ফজরে দিন রোলওভার" : "Roll Over Unfinished Tasks at Fajr"}
                  >
                    <AppleToggle
                      checked={settings.waqtRolloverAtFajr}
                      onChange={(v) => void commit({ ...settings, waqtRolloverAtFajr: v })}
                    />
                  </AppleRow>
                  <AppleRow label={isBn ? "রমজানে তারাবিহ ব্লক" : "Show Taraweeh Block in Ramadan"}>
                    <AppleToggle
                      checked={settings.waqtRamadanTaraweeh}
                      onChange={(v) => void commit({ ...settings, waqtRamadanTaraweeh: v })}
                    />
                  </AppleRow>
                </div>
              </AppleGroup>
            </div>
          )}

          {/* 6. PLUGINS */}
          {section === "plugins" && (
            <div className="space-y-6">
              <AppleGroup title="Installed Plugins">
                <div className="space-y-3 p-4">
                  {effectivePlugins.length === 0 ? (
                    <div className="py-2 text-xs text-[#8e8e93]">
                      No third-party plugins installed. Drop plugins into{" "}
                      <code className="text-[#0a84ff]">%APPDATA%\Lumen\plugins</code>.
                    </div>
                  ) : (
                    effectivePlugins.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border border-[#2c2c2e]/60 bg-[#141416] p-3"
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
                      className="mt-2 cursor-pointer rounded-lg border-0 bg-[#2c2c2e] px-3 py-1.5 text-xs text-white hover:bg-[#3a3a3c]"
                    >
                      Reload Plugins
                    </button>
                  )}
                </div>
              </AppleGroup>
            </div>
          )}

          {/* 7. ABOUT */}
          {section === "about" && (
            <div className="space-y-6">
              <AppleGroup title="About Lumen">
                <div className="space-y-3 p-6 text-center">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0a84ff] to-[#bf5af2] text-3xl font-black text-white shadow-lg">
                    L
                  </div>
                  <h2 className="m-0 text-lg font-bold text-white">Lumen for Windows</h2>
                  <p className="mx-auto m-0 max-w-sm text-xs text-[#8e8e93]">
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
        </div>
      </main>
    </div>
  );
}

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
        {hint && <div className="mt-0.5 text-[12px] text-[#8e8e93]">{hint}</div>}
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
