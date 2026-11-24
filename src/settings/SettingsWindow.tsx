import { useEffect, useState } from "react";
import { getMessages } from "../i18n";
import {
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

type SettingsSection =
  "general" | "display" | "pages" | "appearance" | "widgets" | "plugins" | "about";

interface SectionDef {
  id: SettingsSection;
  labelKey: keyof ReturnType<typeof getMessages>["settings"]["sections"];
  accent: string;
  glyph: string;
}

const SECTIONS: SectionDef[] = [
  { id: "general", labelKey: "general", accent: "var(--accent-blue)", glyph: "⚙" },
  { id: "display", labelKey: "display", accent: "var(--accent-cyan)", glyph: "▣" },
  { id: "pages", labelKey: "pages", accent: "var(--accent-green)", glyph: "☰" },
  { id: "appearance", labelKey: "appearance", accent: "var(--accent-purple)", glyph: "✦" },
  { id: "widgets", labelKey: "widgets", accent: "var(--accent-orange)", glyph: "◈" },
  { id: "plugins", labelKey: "plugins", accent: "var(--accent-red)", glyph: "⌘" },
  { id: "about", labelKey: "about", accent: "var(--accent-blue)", glyph: "ⓘ" },
];

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
  const activeDef = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  useEffect(() => {
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
  };

  const commitNotify = async (next: NotificationPrivacyConfig) => {
    setNotifyCfg(next);
    const saved = await notifySetConfig(next);
    if (saved) {
      setNotifyCfg(saved);
    }
    setStatusBanner(msg.settings.saved);
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

  return (
    <div
      data-testid="settings-window"
      className="flex h-full w-full overflow-hidden"
      style={{ backgroundColor: "var(--surface)", color: "var(--text-primary)" }}
    >
      <aside
        aria-label="Settings sections"
        className="flex w-56 shrink-0 flex-col gap-1.5 p-4"
        style={{
          backgroundColor: "var(--surface-raised)",
          borderRight: "1px solid var(--hairline)",
        }}
      >
        <div className="mb-3 px-2">
          <h1 className="type-title m-0">{msg.settings.title}</h1>
          <p className="type-caption mt-1 mb-0" style={{ color: "var(--text-secondary)" }}>
            {msg.settings.subtitle}
          </p>
        </div>

        {SECTIONS.map((item) => {
          const active = item.id === section;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-0 px-2.5 py-2 text-left transition-colors"
              style={{
                backgroundColor: active ? "var(--surface-button)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                style={{ backgroundColor: item.accent, color: "#000000" }}
              >
                {item.glyph}
              </span>
              <span className="type-body text-sm">{msg.settings.sections[item.labelKey]}</span>
            </button>
          );
        })}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <header className="flex items-center justify-between">
          <h2 className="type-title m-0" style={{ color: activeDef.accent }}>
            {msg.settings.sections[activeDef.labelKey]}
          </h2>
          {statusBanner && (
            <span
              className="type-caption rounded-full px-3 py-1"
              style={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--hairline)",
                color: "var(--accent-green)",
              }}
            >
              {statusBanner}
            </span>
          )}
        </header>

        {warningBanner && (
          <div
            role="alert"
            className="type-caption rounded-xl p-3"
            style={{
              backgroundColor: "var(--surface-raised)",
              border: "1px solid var(--accent-orange)",
              color: "var(--accent-orange)",
            }}
          >
            {warningBanner}
          </div>
        )}

        {section === "general" && (
          <div className="flex flex-col gap-3">
            <SettingCard>
              <ToggleRow
                label={msg.settings.general.startWithWindows}
                hint={msg.settings.general.startWithWindowsHint}
                checked={settings.startWithWindows}
                onChange={(v) => void commit({ ...settings, startWithWindows: v })}
              />
            </SettingCard>

            <SettingCard>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="type-body text-sm">{msg.settings.general.language}</div>
                  <div className="type-caption" style={{ color: "var(--text-secondary)" }}>
                    {msg.settings.general.languageHint}
                  </div>
                </div>
                <div className="flex gap-2">
                  {(["en", "bn"] as const).map((lang) => (
                    <CapsuleButton
                      key={lang}
                      active={settings.language === lang}
                      accent="var(--accent-blue)"
                      onClick={() => void commit({ ...settings, language: lang })}
                    >
                      {lang === "en" ? "English" : "বাংলা"}
                    </CapsuleButton>
                  ))}
                </div>
              </div>
            </SettingCard>

            <SettingCard>
              <div className="flex flex-col gap-3">
                <div className="type-caption" style={{ color: "var(--text-secondary)" }}>
                  {msg.settings.general.hotkeyHint}
                </div>
                <label className="flex items-center justify-between gap-3">
                  <span className="type-body text-sm">{msg.settings.general.hotkeyHide}</span>
                  <input
                    type="text"
                    value={settings.hotkeyHide}
                    onChange={(e) => setSettings({ ...settings, hotkeyHide: e.target.value })}
                    onBlur={() => void commit(settings)}
                    className="type-caption rounded-lg border-0 px-3 py-1.5"
                    style={{
                      backgroundColor: "var(--surface-button)",
                      color: "var(--text-primary)",
                    }}
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="type-body text-sm">{msg.settings.general.hotkeyExpand}</span>
                  <input
                    type="text"
                    value={settings.hotkeyExpand}
                    onChange={(e) => setSettings({ ...settings, hotkeyExpand: e.target.value })}
                    onBlur={() => void commit(settings)}
                    className="type-caption rounded-lg border-0 px-3 py-1.5"
                    style={{
                      backgroundColor: "var(--surface-button)",
                      color: "var(--text-primary)",
                    }}
                  />
                </label>
              </div>
            </SettingCard>
          </div>
        )}

        {section === "display" && (
          <div className="flex flex-col gap-3">
            <SettingCard>
              <div className="flex flex-col gap-3">
                <span className="type-body text-sm">{msg.settings.display.monitorMode}</span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["primary", msg.settings.display.primary],
                      ["active", msg.settings.display.active],
                      ["index", msg.settings.display.index],
                    ] as const
                  ).map(([mode, label]) => (
                    <CapsuleButton
                      key={mode}
                      active={settings.monitorMode === mode}
                      accent="var(--accent-cyan)"
                      onClick={() => void commit({ ...settings, monitorMode: mode })}
                    >
                      {label}
                    </CapsuleButton>
                  ))}
                </div>

                {settings.monitorMode === "index" && monitors.length > 0 && (
                  <label className="flex items-center justify-between gap-3">
                    <span className="type-caption" style={{ color: "var(--text-secondary)" }}>
                      {msg.settings.display.selectMonitor}
                    </span>
                    <select
                      value={settings.monitorIndex}
                      onChange={(e) =>
                        void commit({ ...settings, monitorIndex: Number(e.target.value) })
                      }
                      className="type-caption rounded-lg border-0 px-3 py-1.5"
                      style={{
                        backgroundColor: "var(--surface-button)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {monitors.map((m) => (
                        <option key={m.index} value={m.index}>
                          {m.name} ({m.width}×{m.height} · {Math.round(m.scale_factor * 100)}%)
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </SettingCard>

            <SettingCard>
              <div className="flex flex-col gap-2">
                <span className="type-body text-sm">{msg.settings.display.scale}</span>
                <div className="flex flex-wrap gap-2">
                  {(["auto", "100", "115", "130", "150"] as const).map((sc) => (
                    <CapsuleButton
                      key={sc}
                      active={String(settings.scale) === sc}
                      accent="var(--accent-cyan)"
                      onClick={() => void commit({ ...settings, scale: sc })}
                    >
                      {sc === "auto" ? "Auto" : `${sc}%`}
                    </CapsuleButton>
                  ))}
                </div>
              </div>
            </SettingCard>

            <SettingCard>
              <label className="flex items-center justify-between gap-4">
                <span className="type-body text-sm">
                  {msg.settings.display.offsetX} ({settings.positionOffsetX}px)
                </span>
                <input
                  type="range"
                  min={-240}
                  max={240}
                  step={4}
                  value={settings.positionOffsetX}
                  onChange={(e) =>
                    void commit({ ...settings, positionOffsetX: Number(e.target.value) })
                  }
                  className="w-56 accent-cyan-400"
                />
              </label>
            </SettingCard>

            <SettingCard>
              <ToggleRow
                label={msg.settings.display.hideFullscreen}
                hint={msg.settings.display.hideFullscreenHint}
                checked={settings.hideInFullscreen}
                onChange={(v) => void commit({ ...settings, hideInFullscreen: v })}
              />
            </SettingCard>
          </div>
        )}

        {section === "pages" && (
          <SettingCard>
            <div className="flex flex-col gap-2.5">
              <p className="type-caption m-0" style={{ color: "var(--text-secondary)" }}>
                {msg.settings.pagesTab.description}
              </p>
              {settings.pageOrder.map((pageId, idx) => {
                const isHidden = settings.hiddenPages.includes(pageId);
                return (
                  <div
                    key={pageId}
                    className="flex items-center justify-between rounded-xl px-3 py-2"
                    style={{ backgroundColor: "var(--surface)" }}
                  >
                    <span className="type-body text-sm capitalize">{pageId}</span>
                    <div className="flex items-center gap-1.5">
                      <CapsuleButton
                        active={false}
                        accent="var(--accent-green)"
                        onClick={() => movePage(idx, -1)}
                      >
                        {msg.settings.pagesTab.moveUp}
                      </CapsuleButton>
                      <CapsuleButton
                        active={false}
                        accent="var(--accent-green)"
                        onClick={() => movePage(idx, 1)}
                      >
                        {msg.settings.pagesTab.moveDown}
                      </CapsuleButton>
                      <CapsuleButton
                        active={!isHidden}
                        accent="var(--accent-green)"
                        onClick={() => togglePageVisibility(pageId)}
                      >
                        {isHidden ? msg.settings.pagesTab.hidden : msg.settings.pagesTab.visible}
                      </CapsuleButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </SettingCard>
        )}

        {section === "appearance" && (
          <div className="flex flex-col gap-3">
            <SettingCard>
              <div className="flex items-center justify-between gap-4">
                <span className="type-body text-sm">{msg.settings.appearance.shape}</span>
                <div className="flex gap-2">
                  <CapsuleButton
                    active={settings.shapeStyle === "notch"}
                    accent="var(--accent-purple)"
                    onClick={() => void commit({ ...settings, shapeStyle: "notch" })}
                  >
                    {msg.settings.appearance.notch}
                  </CapsuleButton>
                  <CapsuleButton
                    active={settings.shapeStyle === "pill"}
                    accent="var(--accent-purple)"
                    onClick={() => void commit({ ...settings, shapeStyle: "pill" })}
                  >
                    {msg.settings.appearance.pill}
                  </CapsuleButton>
                </div>
              </div>
            </SettingCard>

            <SettingCard>
              <ToggleRow
                label={msg.settings.appearance.minimalNotch}
                hint={msg.settings.appearance.minimalNotchHint}
                checked={settings.minimalNotch}
                onChange={(v) => void commit({ ...settings, minimalNotch: v })}
              />
            </SettingCard>

            <SettingCard>
              <ToggleRow
                label={msg.settings.appearance.hoverToOpen}
                hint={msg.settings.appearance.hoverToOpenHint}
                checked={settings.hoverToOpen}
                onChange={(v) => void commit({ ...settings, hoverToOpen: v })}
              />
            </SettingCard>

            <SettingCard>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="type-body text-sm">
                    {msg.settings.appearance.hoverReturnSeconds}
                  </div>
                  <div className="type-caption" style={{ color: "var(--text-secondary)" }}>
                    {msg.settings.appearance.hoverReturnSecondsHint}
                  </div>
                </div>
                <div className="flex gap-2">
                  {([3, 5, 10] as const).map((sec) => (
                    <CapsuleButton
                      key={sec}
                      active={settings.hoverReturnSeconds === sec}
                      accent="var(--accent-purple)"
                      onClick={() => void commit({ ...settings, hoverReturnSeconds: sec })}
                    >
                      {sec}s
                    </CapsuleButton>
                  ))}
                </div>
              </div>
            </SettingCard>

            <SettingCard>
              <ToggleRow
                label={msg.settings.appearance.mascot}
                hint={msg.settings.appearance.mascotHint}
                checked={settings.mascotEnabled}
                onChange={(v) => void commit({ ...settings, mascotEnabled: v })}
              />
            </SettingCard>

            <SettingCard>
              <ToggleRow
                label={msg.settings.appearance.headerClock}
                checked={settings.showHeaderClock}
                onChange={(v) => void commit({ ...settings, showHeaderClock: v })}
              />
            </SettingCard>

            <SettingCard>
              <ToggleRow
                label={msg.settings.appearance.reduceMotion}
                hint={msg.settings.appearance.reduceMotionHint}
                checked={settings.reducedMotionOverride}
                onChange={(v) => void commit({ ...settings, reducedMotionOverride: v })}
              />
            </SettingCard>
          </div>
        )}

        {section === "widgets" && (
          <div className="flex flex-col gap-3">
            <SettingCard>
              <label className="flex items-center justify-between gap-4">
                <span className="type-body text-sm">{msg.settings.widgetsTab.waterGoal}</span>
                <input
                  type="number"
                  min={500}
                  max={6000}
                  step={250}
                  value={settings.waterGoalMl}
                  onChange={(e) =>
                    void commit({
                      ...settings,
                      waterGoalMl: Math.max(250, Number(e.target.value) || 1500),
                    })
                  }
                  className="type-caption w-24 rounded-lg border-0 px-3 py-1.5 tabular-nums"
                  style={{
                    backgroundColor: "var(--surface-button)",
                    color: "var(--text-primary)",
                  }}
                />
              </label>
            </SettingCard>

            <SettingCard>
              <label className="flex flex-col gap-2">
                <span className="type-body text-sm">{msg.settings.widgetsTab.mediaExclusions}</span>
                <input
                  type="text"
                  value={settings.mediaExclusions.join(", ")}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      mediaExclusions: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  onBlur={() => void commit(settings)}
                  placeholder="obs, teams, zoom"
                  className="type-caption rounded-lg border-0 px-3 py-1.5"
                  style={{
                    backgroundColor: "var(--surface-button)",
                    color: "var(--text-primary)",
                  }}
                />
              </label>
            </SettingCard>

            <SettingCard>
              <div className="flex flex-col gap-3">
                <ToggleRow
                  label={msg.settings.widgetsTab.notifyEnabled}
                  checked={notifyCfg.enabled}
                  onChange={(v) => void commitNotify({ ...notifyCfg, enabled: v })}
                />
                <ToggleRow
                  label={msg.settings.widgetsTab.hidePreviews}
                  checked={notifyCfg.hide_previews}
                  onChange={(v) => void commitNotify({ ...notifyCfg, hide_previews: v })}
                />
                <ToggleRow
                  label={msg.settings.widgetsTab.respectFocusAssist}
                  checked={notifyCfg.respect_focus_assist}
                  onChange={(v) => void commitNotify({ ...notifyCfg, respect_focus_assist: v })}
                />
                <div>
                  <CapsuleButton
                    active
                    accent="var(--accent-orange)"
                    onClick={() =>
                      void notifyPushTest(
                        "Lumen",
                        "Test Notification",
                        "Notification pipeline active with privacy filtering.",
                      )
                    }
                  >
                    {msg.settings.widgetsTab.testNotify}
                  </CapsuleButton>
                </div>
              </div>
            </SettingCard>
          </div>
        )}

        {section === "plugins" && (
          <SettingCard>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="type-caption" style={{ color: "var(--text-secondary)" }}>
                  {msg.settings.pluginsTab.folderHint}
                </span>
                <CapsuleButton
                  active
                  accent="var(--accent-red)"
                  onClick={() => {
                    if (onReloadPlugins) {
                      onReloadPlugins();
                    } else {
                      void pluginsList().then(setDiscoveredPlugins);
                    }
                  }}
                >
                  {msg.settings.pluginsTab.reload}
                </CapsuleButton>
              </div>
              {effectivePlugins.length === 0 ? (
                <p className="type-body m-0 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {msg.settings.pluginsTab.empty}
                </p>
              ) : (
                effectivePlugins.map((plugin) => (
                  <div
                    key={plugin.id}
                    className="flex items-center justify-between rounded-xl px-3 py-2"
                    style={{ backgroundColor: "var(--surface)" }}
                  >
                    <div>
                      <div className="type-body text-sm">
                        {plugin.name} · v{plugin.version}
                      </div>
                      <div className="type-caption" style={{ color: "var(--text-secondary)" }}>
                        {plugin.id}
                      </div>
                    </div>
                    <span className="type-caption" style={{ color: "var(--accent-cyan)" }}>
                      {plugin.permissions.length > 0 ? plugin.permissions.join(", ") : "sandboxed"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </SettingCard>
        )}

        {section === "about" && (
          <SettingCard>
            <div className="flex flex-col gap-2">
              <div className="type-title">Lumen</div>
              <p className="type-body m-0 text-sm" style={{ color: "var(--text-secondary)" }}>
                {msg.settings.aboutTab.tagline}
              </p>
              <p className="type-caption m-0" style={{ color: "var(--text-secondary)" }}>
                {msg.settings.aboutTab.author}
              </p>
              <p className="type-caption m-0" style={{ color: "var(--accent-green)" }}>
                {msg.settings.aboutTab.license}
              </p>
              <a
                href="https://github.com/devabunayem/lumen"
                target="_blank"
                rel="noreferrer"
                className="type-caption mt-1"
                style={{ color: "var(--accent-blue)" }}
              >
                https://github.com/devabunayem/lumen
              </a>
            </div>
          </SettingCard>
        )}
      </main>
    </div>
  );
}

function SettingCard({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-4"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--hairline)",
      }}
    >
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <div>
        <div className="type-body text-sm">{label}</div>
        {hint && (
          <div className="type-caption" style={{ color: "var(--text-secondary)" }}>
            {hint}
          </div>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-blue-500"
      />
    </label>
  );
}

function CapsuleButton({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean;
  accent: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="type-caption cursor-pointer rounded-full border-0 px-3 py-1.5 font-semibold"
      style={{
        backgroundColor: active ? accent : "var(--surface-button)",
        color: active ? "#000000" : "var(--text-primary)",
      }}
    >
      {children}
    </button>
  );
}
