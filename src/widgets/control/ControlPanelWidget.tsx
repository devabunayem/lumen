import { useEffect, useState } from "react";
import {
  BellIcon,
  BellOffIcon,
  CalendarIcon,
  CameraIcon,
  DropletIcon,
  LockIcon,
  MicIcon,
  MicOffIcon,
  MusicNoteIcon,
  ScanTextIcon,
} from "../../design/icons";
import {
  type CalendarEvent,
  calendarList,
  type MediaStateSnapshot,
  notifyGetConfig,
  notifySetConfig,
  type PomodoroSnapshot,
  systemCaptureScreenshot,
  systemGetMicMuted,
  systemLockWorkstation,
  systemOcrScreen,
  systemToggleMicMute,
  type TaskItem,
  tasksAdd,
  tasksList,
  type WaterSummary,
  waterGetSummary,
} from "../../lib/ipc";

export interface ControlPanelWidgetProps {
  media: MediaStateSnapshot | null;
  pomodoro: PomodoroSnapshot | null;
  waterGoalMl: number;
  cameraActive?: boolean;
  micActive?: boolean;
  language: "en" | "bn";
  onNavigatePage: (pageId: string) => void;
}

export function ControlPanelWidget({
  media,
  pomodoro,
  waterGoalMl,
  cameraActive = false,
  micActive = false,
  language,
  onNavigatePage,
}: ControlPanelWidgetProps) {
  const [micMuted, setMicMuted] = useState(false);
  const [quietMode, setQuietMode] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [water, setWater] = useState<WaterSummary | null>(null);
  const [statusChip, setStatusChip] = useState<string | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [ocrSnippet, setOcrSnippet] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void systemGetMicMuted().then((m) => active && setMicMuted(m));
    void notifyGetConfig().then((cfg) => active && cfg && setQuietMode(!cfg.enabled));
    void tasksList().then((list) => active && setTasks(list));
    void calendarList().then((evs) => active && setEvents(evs));
    void waterGetSummary(waterGoalMl).then((w) => active && w && setWater(w));
    return () => {
      active = false;
    };
  }, [waterGoalMl]);

  const handleToggleMic = async () => {
    const next = await systemToggleMicMute();
    setMicMuted(next);
  };

  const handleToggleQuiet = async () => {
    const cfg = await notifyGetConfig();
    if (!cfg) {
      setQuietMode((prev) => !prev);
      return;
    }
    const updated = await notifySetConfig({ ...cfg, enabled: !cfg.enabled });
    if (updated) {
      setQuietMode(!updated.enabled);
    }
  };

  const handleScreenshot = async () => {
    const saved = await systemCaptureScreenshot();
    if (saved) {
      setStatusChip(language === "bn" ? "শেল্ফে সেভ হয়েছে" : "Saved to Shelf");
      window.setTimeout(() => setStatusChip(null), 2600);
    }
  };

  const handleOcr = async () => {
    const text = await systemOcrScreen();
    if (text) {
      setOcrSnippet(text.slice(0, 64));
      setStatusChip(language === "bn" ? "টেক্সট কপি হয়েছে" : "Text copied");
    } else {
      setStatusChip(language === "bn" ? "টেক্সট পাওয়া যায়নি" : "No text found");
    }
    window.setTimeout(() => setStatusChip(null), 2600);
  };

  const handleSaveOcrTodo = async () => {
    if (!ocrSnippet) {
      return;
    }
    const next = await tasksAdd(ocrSnippet, null);
    setTasks(next);
    setOcrSnippet(null);
    onNavigatePage("todo");
  };

  const openTasks = tasks.filter((t) => !t.done);
  const nextTask = openTasks[0];
  const waterMl = water?.today_ml ?? 0;
  const remainingSecs = pomodoro?.remaining_secs ?? 25 * 60;
  const pomMins = Math.floor(remainingSecs / 60);
  const pomSecs = String(remainingSecs % 60).padStart(2, "0");

  const isBn = language === "bn";

  const micLabel = micMuted
    ? isBn
      ? "মাইক আনমিউট করুন"
      : "Unmute Mic"
    : isBn
      ? "মাইক মিউট করুন"
      : "Mute Mic";
  const quietLabel = quietMode
    ? isBn
      ? "নীরব মোড বন্ধ করুন"
      : "Disable Quiet Mode"
    : isBn
      ? "নীরব মোড চালু করুন"
      : "Quiet / DND Mode";
  const shotLabel = isBn ? "স্ক্রিনশট নিন (Shelf)" : "Screenshot → Shelf";
  const ocrLabel = isBn ? "স্ক্রিন থেকে টেক্সট কপি (OCR)" : "Copy Screen Text (OCR)";
  const lockLabel = isBn ? "উইন্ডোজ লক করুন" : "Lock Windows";
  const mediaOrAgendaLabel = cameraActive
    ? isBn
      ? "ক্যামেরা চালু আছে"
      : "Camera Active"
    : events.length > 0
      ? `${isBn ? "অ্যাজেন্ডা:" : "Agenda:"} ${events[0].title}`
      : media?.active?.title
        ? media.active.title
        : isBn
          ? "মিউজিক প্লেয়ার"
          : "Music Player";

  const displayBanner = hoverLabel ?? statusChip;

  return (
    <div
      data-testid="control-panel-widget"
      className="grid h-full w-full grid-cols-[1fr_1.15fr] items-center gap-2.5 overflow-hidden px-0.5"
    >
      {/* Left: Compact Icon-Only 3x2 Quick Action Grid (zero clipping, label shown on hover) */}
      <div className="grid h-full grid-cols-3 grid-rows-2 gap-1.5 py-0.5">
        <IconTile
          active={micMuted}
          activeColor="var(--accent-red)"
          icon={micMuted ? <MicOffIcon size={15} /> : <MicIcon size={15} />}
          label={micLabel}
          onHover={setHoverLabel}
          onClick={() => void handleToggleMic()}
        />
        <IconTile
          active={quietMode}
          activeColor="var(--accent-purple)"
          icon={quietMode ? <BellOffIcon size={15} /> : <BellIcon size={15} />}
          label={quietLabel}
          onHover={setHoverLabel}
          onClick={() => void handleToggleQuiet()}
        />
        <IconTile
          active={false}
          activeColor="var(--accent-cyan)"
          icon={<CameraIcon size={15} />}
          label={shotLabel}
          onHover={setHoverLabel}
          onClick={() => void handleScreenshot()}
        />
        <IconTile
          active={Boolean(ocrSnippet)}
          activeColor="var(--accent-orange)"
          icon={<ScanTextIcon size={15} />}
          label={ocrLabel}
          onHover={setHoverLabel}
          onClick={() => void handleOcr()}
        />
        <IconTile
          active={false}
          activeColor="var(--accent-blue)"
          icon={<LockIcon size={15} />}
          label={lockLabel}
          onHover={setHoverLabel}
          onClick={() => void systemLockWorkstation()}
        />
        <IconTile
          active={Boolean(media?.active?.is_playing) || cameraActive || micActive}
          activeColor={
            cameraActive
              ? "var(--accent-green)"
              : micActive
                ? "var(--accent-orange)"
                : "var(--accent-green)"
          }
          icon={events.length > 0 ? <CalendarIcon size={15} /> : <MusicNoteIcon size={15} />}
          label={mediaOrAgendaLabel}
          onHover={setHoverLabel}
          onClick={() => onNavigatePage(events.length > 0 ? "calendar" : "music")}
        />
      </div>

      {/* Right: Responsive Connected Glance Stack */}
      <div className="flex h-full min-w-0 flex-col justify-between gap-1.5 py-0.5">
        {ocrSnippet ? (
          <button
            type="button"
            onClick={() => void handleSaveOcrTodo()}
            className="flex min-h-0 w-full flex-1 cursor-pointer items-center justify-between border-0 px-3 py-1.5 text-left"
            style={{
              backgroundColor: "var(--surface-button)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--accent-orange)",
              color: "var(--text-primary)",
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="type-caption font-semibold" style={{ color: "var(--accent-orange)" }}>
                {isBn ? "To-Do তে সেভ করুন" : "Save OCR as To-Do"}
              </div>
              <div className="type-caption truncate" style={{ color: "var(--text-secondary)" }}>
                {ocrSnippet}
              </div>
            </div>
            <span className="type-caption ml-2 shrink-0">+</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigatePage("todo")}
            className="flex min-h-0 w-full flex-1 cursor-pointer items-center justify-between border-0 px-3 py-1.5 text-left transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--surface-raised)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--hairline)",
              color: "var(--text-primary)",
            }}
          >
            <div className="min-w-0 flex-1">
              <div
                className="type-caption truncate font-semibold"
                style={{
                  color: displayBanner ? "var(--accent-cyan)" : "var(--accent-green)",
                }}
              >
                {displayBanner ??
                  (isBn
                    ? `${openTasks.length}টি কাজ বাকি`
                    : `${openTasks.length} ${openTasks.length === 1 ? "task" : "tasks"} left`)}
              </div>
              <div className="type-caption truncate" style={{ color: "var(--text-secondary)" }}>
                {nextTask ? nextTask.title : isBn ? "সব কাজ শেষ" : "All caught up"}
              </div>
            </div>
            <span className="type-caption ml-2 shrink-0" style={{ color: "var(--text-tertiary)" }}>
              →
            </span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onNavigatePage("water")}
            className="flex cursor-pointer items-center gap-1.5 border-0 px-2.5 py-1.5 text-left transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--surface-raised)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--hairline)",
              color: "var(--text-primary)",
            }}
          >
            <span className="shrink-0" style={{ color: "var(--accent-cyan)" }}>
              <DropletIcon size={12} />
            </span>
            <span className="type-caption tabular-nums truncate font-medium">
              {waterMl}/{waterGoalMl}ml
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigatePage("pomodoro")}
            className="flex cursor-pointer items-center justify-between border-0 px-2.5 py-1.5 text-left transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--surface-raised)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--hairline)",
              color: "var(--text-primary)",
            }}
          >
            <span className="type-caption font-semibold" style={{ color: "var(--accent-orange)" }}>
              {isBn ? "ফোকাস" : "Focus"}
            </span>
            <span className="type-caption tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {pomMins}:{pomSecs}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function IconTile({
  active,
  activeColor,
  icon,
  label,
  onHover,
  onClick,
}: {
  active: boolean;
  activeColor: string;
  icon: React.ReactNode;
  label: string;
  onHover: (label: string | null) => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseEnter={() => onHover(label)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(label)}
      onBlur={() => onHover(null)}
      onClick={onClick}
      className="flex h-full w-full cursor-pointer items-center justify-center border-0 transition-transform hover:scale-[1.03] active:scale-95"
      style={{
        backgroundColor: active ? activeColor : "var(--surface-raised)",
        borderRadius: "var(--card-radius)",
        border: active ? `1px solid ${activeColor}` : "1px solid var(--hairline)",
        color: active ? "#000000" : "var(--text-primary)",
      }}
    >
      {icon}
    </button>
  );
}
