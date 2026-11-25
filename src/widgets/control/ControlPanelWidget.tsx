import { useEffect, useState } from "react";
import {
  BellIcon,
  BellOffIcon,
  CameraIcon,
  DropletIcon,
  LockIcon,
  MicIcon,
  MicOffIcon,
  ScanTextIcon,
} from "../../design/icons";
import {
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
  language: "en" | "bn";
  onNavigatePage: (pageId: string) => void;
}

export function ControlPanelWidget({
  media,
  pomodoro,
  waterGoalMl,
  language,
  onNavigatePage,
}: ControlPanelWidgetProps) {
  const [micMuted, setMicMuted] = useState(false);
  const [quietMode, setQuietMode] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [water, setWater] = useState<WaterSummary | null>(null);
  const [statusChip, setStatusChip] = useState<string | null>(null);
  const [ocrSnippet, setOcrSnippet] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void systemGetMicMuted().then((m) => active && setMicMuted(m));
    void notifyGetConfig().then((cfg) => active && cfg && setQuietMode(!cfg.enabled));
    void tasksList().then((list) => active && setTasks(list));
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

  return (
    <div
      data-testid="control-panel-widget"
      className="grid h-full w-full grid-cols-[1.15fr_1fr] items-stretch gap-2.5 px-1"
    >
      {/* Left: 2x3 Quick System Actions */}
      <div className="grid grid-cols-2 gap-1.5">
        <ActionTile
          active={micMuted}
          activeColor="var(--accent-red)"
          icon={micMuted ? <MicOffIcon size={13} /> : <MicIcon size={13} />}
          label={micMuted ? (isBn ? "মাইক মিউট" : "Mic Muted") : isBn ? "মাইক অন" : "Mic Live"}
          onClick={() => void handleToggleMic()}
        />
        <ActionTile
          active={quietMode}
          activeColor="var(--accent-purple)"
          icon={quietMode ? <BellOffIcon size={13} /> : <BellIcon size={13} />}
          label={quietMode ? (isBn ? "নীরব মোড" : "Quiet On") : isBn ? "নোটিফিকেশন" : "Alerts On"}
          onClick={() => void handleToggleQuiet()}
        />
        <ActionTile
          active={false}
          activeColor="var(--accent-cyan)"
          icon={<CameraIcon size={13} />}
          label={isBn ? "স্ক্রিনশট" : "Screenshot"}
          onClick={() => void handleScreenshot()}
        />
        <ActionTile
          active={Boolean(ocrSnippet)}
          activeColor="var(--accent-orange)"
          icon={<ScanTextIcon size={13} />}
          label={isBn ? "টেক্সট কপি" : "Copy Text"}
          onClick={() => void handleOcr()}
        />
        <ActionTile
          active={false}
          activeColor="var(--accent-blue)"
          icon={<LockIcon size={13} />}
          label={isBn ? "লক পিসি" : "Lock PC"}
          onClick={() => void systemLockWorkstation()}
        />
        <ActionTile
          active={Boolean(media?.active?.is_playing)}
          activeColor="var(--accent-green)"
          icon={<span className="text-[11px] font-bold">♪</span>}
          label={media?.active?.title ? media.active.title : isBn ? "মিডিয়া" : "Music"}
          onClick={() => onNavigatePage("music")}
        />
      </div>

      {/* Right: Today at a Glance (Connected Summaries) */}
      <div className="flex flex-col justify-between gap-1.5">
        {ocrSnippet ? (
          <button
            type="button"
            onClick={() => void handleSaveOcrTodo()}
            className="flex w-full cursor-pointer items-center justify-between border-0 px-3 py-2 text-left"
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
            className="flex w-full cursor-pointer items-center justify-between border-0 px-3 py-2 text-left transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--surface-raised)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--hairline)",
              color: "var(--text-primary)",
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="type-caption font-semibold" style={{ color: "var(--accent-green)" }}>
                {statusChip ??
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
            className="flex cursor-pointer items-center gap-1.5 border-0 px-2.5 py-2 text-left transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--surface-raised)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--hairline)",
              color: "var(--text-primary)",
            }}
          >
            <span style={{ color: "var(--accent-cyan)" }}>
              <DropletIcon size={13} />
            </span>
            <span className="type-caption tabular-nums truncate font-medium">
              {waterMl}/{waterGoalMl}ml
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigatePage("pomodoro")}
            className="flex cursor-pointer items-center justify-between border-0 px-2.5 py-2 text-left transition-opacity hover:opacity-90"
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

function ActionTile({
  active,
  activeColor,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  activeColor: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-2 border-0 px-2.5 py-1.5 text-left transition-transform active:scale-95"
      style={{
        backgroundColor: active ? "var(--surface-button)" : "var(--surface-raised)",
        borderRadius: "var(--card-radius)",
        border: active ? `1px solid ${activeColor}` : "1px solid var(--hairline)",
        color: "var(--text-primary)",
      }}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: active ? activeColor : "var(--surface-button)",
          color: active ? "#000000" : "var(--text-primary)",
        }}
      >
        {icon}
      </span>
      <span className="type-caption truncate font-medium">{label}</span>
    </button>
  );
}
