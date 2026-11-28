import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  BellIcon,
  BellOffIcon,
  CalendarIcon,
  CameraIcon,
  CoffeeIcon,
  DropletIcon,
  LockIcon,
  MicIcon,
  MicOffIcon,
  MusicNoteIcon,
  ScanTextIcon,
} from "../../design/icons";
import {
  calendarHubAddTask,
  calendarHubGetSnapshot,
  type CalendarEvent,
  type MediaStateSnapshot,
  notifyGetConfig,
  notifySetConfig,
  type PomodoroSnapshot,
  pomodoroToggle,
  type PrayerSchedule,
  prayerGetSchedule,
  sendMediaCommand,
  systemCaptureScreenshot,
  systemGetMicMuted,
  systemLockWorkstation,
  systemOcrScreen,
  systemToggleMicMute,
  type TaskItem,
  type WaterSummary,
  waterGetSummary,
  waterLog,
} from "../../lib/ipc";

export interface ControlPanelWidgetProps {
  media: MediaStateSnapshot | null;
  pomodoro: PomodoroSnapshot | null;
  waterGoalMl: number;
  cameraActive?: boolean;
  micActive?: boolean;
  language: "en" | "bn";
  onPomodoroChange?: (next: PomodoroSnapshot) => void;
  onNavigatePage: (pageId: string) => void;
}

const TILE_COLS = 4;

export function ControlPanelWidget({
  media,
  pomodoro,
  waterGoalMl,
  cameraActive = false,
  micActive = false,
  language,
  onPomodoroChange,
  onNavigatePage,
}: ControlPanelWidgetProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [micMuted, setMicMuted] = useState(false);
  const [quietMode, setQuietMode] = useState(false);
  const [caffeineOn, setCaffeineOn] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [prayer, setPrayer] = useState<PrayerSchedule | null>(null);
  const [water, setWater] = useState<WaterSummary | null>(null);
  const [statusChip, setStatusChip] = useState<string | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [ocrSnippet, setOcrSnippet] = useState<string | null>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let active = true;
    void systemGetMicMuted().then((m) => active && setMicMuted(m));
    void notifyGetConfig().then((cfg) => active && cfg && setQuietMode(!cfg.enabled));
    const now = new Date();
    void calendarHubGetSnapshot(now.getFullYear(), now.getMonth() + 1).then((snap) => {
      if (!active || !snap) return;
      setTasks(
        snap.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          done: Boolean(t.doneAt),
          due_at: t.dueDate ? (t.dueTime ? `${t.dueDate}T${t.dueTime}:00` : t.dueDate) : null,
          created_at: t.createdAt,
        })),
      );
      setEvents(
        snap.events.map((e) => ({
          id: e.id,
          title: e.title,
          start_at: e.start,
          created_at: e.start,
        })),
      );
    });
    void prayerGetSchedule().then((p) => active && p && setPrayer(p));
    void waterGetSummary(waterGoalMl).then((w) => active && w && setWater(w));
    return () => {
      active = false;
    };
  }, [waterGoalMl]);

  const showTempStatus = (msg: string) => {
    setStatusChip(msg);
    window.setTimeout(() => setStatusChip(null), 2400);
  };

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
      showTempStatus(language === "bn" ? "শেল্ফে সেভ হয়েছে" : "Saved to Shelf");
    }
  };

  const handleOcr = async () => {
    const text = await systemOcrScreen();
    if (text) {
      setOcrSnippet(text.slice(0, 64));
      showTempStatus(language === "bn" ? "টেক্সট কপি হয়েছে" : "Text copied");
    } else {
      showTempStatus(language === "bn" ? "টেক্সট পাওয়া যায়নি" : "No text found");
    }
  };

  const handleSaveOcrTodo = async () => {
    if (!ocrSnippet) {
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const created = await calendarHubAddTask({ title: ocrSnippet, dueDate: today });
    if (created) {
      setTasks((prev) => [
        {
          id: created.id,
          title: created.title,
          done: false,
          due_at: created.dueDate,
          created_at: created.createdAt,
        },
        ...prev,
      ]);
    }
    setOcrSnippet(null);
    onNavigatePage("calendar_hub");
  };

  const handleQuickWater = async () => {
    const updated = await waterLog(250, waterGoalMl);
    if (updated) {
      setWater(updated);
    } else {
      setWater((prev) => {
        const nextMl = (prev?.today_ml ?? 0) + 250;
        const pct = Math.min(100, Math.round((nextMl / waterGoalMl) * 100));
        return {
          today_ml: nextMl,
          goal_ml: waterGoalMl,
          percentage: pct,
          goal_reached: nextMl >= waterGoalMl,
          last_entry_id: prev?.last_entry_id ?? null,
          weekly: prev?.weekly ?? [],
        };
      });
    }
    showTempStatus(language === "bn" ? "+২৫০ml যোগ হয়েছে" : "+250ml logged");
  };

  const handleQuickFocus = async () => {
    const updated = await pomodoroToggle();
    if (updated) {
      onPomodoroChange?.(updated);
    }
  };

  const openTasks = tasks.filter((t) => !t.done);
  const nextTask = openTasks[0];
  const waterMl = water?.today_ml ?? 0;
  const totalFocusSecs = Math.max(1, pomodoro?.total_secs ?? 25 * 60);
  const remainingSecs = pomodoro?.remaining_secs ?? 25 * 60;
  const focusProgress = Math.min(1, Math.max(0, 1 - remainingSecs / totalFocusSecs));
  const pomMins = Math.floor(remainingSecs / 60);
  const pomSecs = String(remainingSecs % 60).padStart(2, "0");

  const isBn = language === "bn";

  const micLabel = micMuted
    ? isBn
      ? "মাইক আনমিউট"
      : "Unmute Mic"
    : isBn
      ? "মাইক মিউট"
      : "Mute Mic";
  const quietLabel = quietMode
    ? isBn
      ? "DND বন্ধ করুন"
      : "Disable DND"
    : isBn
      ? "ডু নট ডিস্টার্ব"
      : "Do Not Disturb";
  const caffeineLabel = caffeineOn
    ? isBn
      ? "ক্যাফেইন চালু"
      : "Keep Awake On"
    : isBn
      ? "ক্যাফেইন মোড"
      : "Keep Awake";
  const mediaLabel = cameraActive
    ? isBn
      ? "ক্যামেরা চালু"
      : "Camera Active"
    : media?.active?.title
      ? media.active.title
      : isBn
        ? "মিউজিক"
        : "Music";
  const shotLabel = isBn ? "স্ক্রিনশট" : "Screenshot";
  const ocrLabel = isBn ? "টেক্সট কপি" : "Copy Text";
  const agendaLabel =
    events.length > 0
      ? `${isBn ? "অ্যাজেন্ডা:" : "Agenda:"} ${events[0].title}`
      : isBn
        ? "ক্যালেন্ডার"
        : "Calendar";
  const lockLabel = isBn ? "লক করুন" : "Lock PC";

  const displayBanner = hoverLabel ?? statusChip;

  const tiles = [
    {
      id: "mic",
      active: micMuted,
      isToggle: true,
      activeColor: "var(--accent-red)",
      icon: micMuted ? <MicOffIcon size={20} /> : <MicIcon size={20} />,
      label: micLabel,
      onClick: () => void handleToggleMic(),
      onLongPress: () => showTempStatus(micLabel),
    },
    {
      id: "dnd",
      active: quietMode,
      isToggle: true,
      activeColor: "var(--accent-purple)",
      icon: quietMode ? <BellOffIcon size={20} /> : <BellIcon size={20} />,
      label: quietLabel,
      onClick: () => void handleToggleQuiet(),
      onLongPress: () => onNavigatePage("calendar_hub"),
    },
    {
      id: "caffeine",
      active: caffeineOn,
      isToggle: true,
      activeColor: "var(--accent-orange)",
      icon: <CoffeeIcon size={20} />,
      label: caffeineLabel,
      onClick: () => {
        setCaffeineOn((prev) => {
          const next = !prev;
          showTempStatus(
            next
              ? isBn
                ? "স্ক্রিন সচল থাকবে"
                : "Keep Awake enabled"
              : isBn
                ? "ক্যাফেইন বন্ধ"
                : "Keep Awake off",
          );
          return next;
        });
      },
    },
    {
      id: "media",
      active: Boolean(media?.active?.is_playing) || cameraActive || micActive,
      isToggle: false,
      activeColor: "var(--accent-green)",
      icon: <MusicNoteIcon size={20} />,
      label: mediaLabel,
      onClick: () => onNavigatePage("home"),
      onLongPress: () => void sendMediaCommand("play_pause"),
    },
    {
      id: "shot",
      active: false,
      isToggle: false,
      activeColor: "var(--accent-cyan)",
      icon: <CameraIcon size={20} />,
      label: shotLabel,
      onClick: () => void handleScreenshot(),
      onLongPress: () => onNavigatePage("shelf"),
    },
    {
      id: "ocr",
      active: Boolean(ocrSnippet),
      isToggle: false,
      activeColor: "var(--accent-orange)",
      icon: <ScanTextIcon size={20} />,
      label: ocrLabel,
      onClick: () => void handleOcr(),
      onLongPress: () => onNavigatePage("calendar_hub"),
    },
    {
      id: "calendar",
      active: events.length > 0,
      isToggle: false,
      activeColor: "var(--accent-blue)",
      icon: <CalendarIcon size={20} />,
      label: agendaLabel,
      onClick: () => onNavigatePage("calendar_hub"),
    },
    {
      id: "lock",
      active: false,
      isToggle: false,
      activeColor: "var(--accent-blue)",
      icon: <LockIcon size={20} />,
      label: lockLabel,
      onClick: () => void systemLockWorkstation(),
    },
  ];

  const handleTileKeyDown = (index: number, e: React.KeyboardEvent<HTMLButtonElement>) => {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % tiles.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + tiles.length) % tiles.length;
    } else if (e.key === "ArrowDown") {
      nextIndex = (index + TILE_COLS) % tiles.length;
    } else if (e.key === "ArrowUp") {
      nextIndex = (index - TILE_COLS + tiles.length) % tiles.length;
    }
    if (nextIndex !== null) {
      e.preventDefault();
      e.stopPropagation();
      tileRefs.current[nextIndex]?.focus();
    }
  };

  const nextPrayerName = isBn ? prayer?.next_name_bn : prayer?.next_name_en;
  const showPrayerFallback =
    openTasks.length === 0 && Boolean(nextPrayerName && prayer?.next_time_12h);

  const ringRadius = 6;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - focusProgress);

  return (
    <div
      data-testid="control-panel-widget"
      className="grid h-full w-full grid-cols-[1.05fr_1fr] items-stretch gap-2.5 overflow-hidden px-0.5 py-0.5"
    >
      {/* Left: 4x2 iOS Control Center Squircle Grid */}
      <div
        role="group"
        aria-label={isBn ? "কুইক কন্ট্রোল গ্রিড" : "Quick Control Grid"}
        className="grid h-full grid-cols-4 grid-rows-2 gap-1.5"
      >
        {tiles.map((tile, index) => (
          <IconTile
            key={tile.id}
            refCallback={(el) => {
              tileRefs.current[index] = el;
            }}
            active={tile.active}
            isToggle={tile.isToggle}
            activeColor={tile.activeColor}
            icon={tile.icon}
            label={tile.label}
            prefersReducedMotion={prefersReducedMotion}
            onHover={setHoverLabel}
            onKeyDown={(e) => handleTileKeyDown(index, e)}
            onClick={tile.onClick}
            onLongPress={tile.onLongPress}
          />
        ))}
      </div>

      {/* Right: Pixel-aligned Connected Glance Stack */}
      <div className="flex h-full min-w-0 flex-col justify-between gap-1.5">
        {ocrSnippet ? (
          <motion.button
            type="button"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            onClick={() => void handleSaveOcrTodo()}
            className="flex min-h-0 w-full flex-1 cursor-pointer items-center border-0 px-3 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
            style={{
              backgroundColor: "var(--surface-button)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--accent-orange)",
              color: "var(--text-primary)",
            }}
          >
            <div className="min-w-0 flex-1">
              <div
                className="type-caption truncate font-semibold"
                style={{ color: "var(--accent-orange)" }}
              >
                {isBn ? "To-Do তে সেভ করুন" : "Save OCR as To-Do"}
              </div>
              <div className="type-caption truncate" style={{ color: "var(--text-secondary)" }}>
                {ocrSnippet}
              </div>
            </div>
          </motion.button>
        ) : (
          <motion.button
            type="button"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            onClick={() => onNavigatePage(showPrayerFallback ? "home" : "calendar_hub")}
            className="flex min-h-0 w-full flex-1 cursor-pointer items-center border-0 px-3 py-1.5 text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
            style={{
              backgroundColor: "var(--surface-raised)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--hairline)",
              color: "var(--text-primary)",
            }}
          >
            <div className="min-w-0 flex-1" aria-live="polite">
              <div
                className="type-caption truncate font-semibold"
                style={{
                  color: displayBanner
                    ? "var(--accent-cyan)"
                    : showPrayerFallback
                      ? "var(--accent-cyan)"
                      : "var(--accent-green)",
                }}
              >
                {displayBanner ??
                  (showPrayerFallback && nextPrayerName
                    ? `${isBn ? "পরবর্তী নামাজ:" : "Next Prayer:"} ${nextPrayerName}`
                    : isBn
                      ? `${openTasks.length}টি কাজ বাকি`
                      : `${openTasks.length} ${openTasks.length === 1 ? "task" : "tasks"} left`)}
              </div>
              <div className="type-caption truncate" style={{ color: "var(--text-secondary)" }}>
                {nextTask
                  ? nextTask.title
                  : showPrayerFallback && prayer
                    ? `${prayer.next_time_12h} · ${prayer.countdown_text}`
                    : isBn
                      ? "সব কাজ শেষ"
                      : "All caught up"}
              </div>
            </div>
          </motion.button>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <motion.button
            type="button"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            aria-label={isBn ? "+২৫০ml পানি যোগ করুন" : "Log +250ml water"}
            title={isBn ? "ট্যাপে +২৫০ml · ডান-ক্লিকে ওয়াটার" : "Tap +250ml · Right-click for Water"}
            onClick={() => void handleQuickWater()}
            onContextMenu={(e) => {
              e.preventDefault();
              onNavigatePage("water");
            }}
            className="flex cursor-pointer items-center gap-1.5 border-0 px-2.5 py-1.5 text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
            style={{
              backgroundColor: "var(--surface-raised)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--hairline)",
              color: "var(--text-primary)",
            }}
          >
            <span className="shrink-0" style={{ color: "var(--accent-cyan)" }}>
              <DropletIcon size={13} />
            </span>
            <span
              className="type-caption truncate tabular-nums font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {waterMl}/{waterGoalMl}ml
            </span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            aria-label={isBn ? "ফোকাস টাইমার চালু/বিরতি" : "Start or pause focus timer"}
            title={
              isBn
                ? "ট্যাপে চালু/বিরতি · ডান-ক্লিকে পমোডোরো"
                : "Tap start/pause · Right-click for Timer"
            }
            onClick={() => void handleQuickFocus()}
            onContextMenu={(e) => {
              e.preventDefault();
              onNavigatePage("calendar_hub");
            }}
            className="flex cursor-pointer items-center justify-between gap-1.5 border-0 px-2.5 py-1.5 text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
            style={{
              backgroundColor: "var(--surface-raised)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--hairline)",
              color: "var(--text-primary)",
            }}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="shrink-0 -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="8"
                  cy="8"
                  r={ringRadius}
                  fill="none"
                  stroke="var(--hairline-strong)"
                  strokeWidth="2"
                />
                <circle
                  cx="8"
                  cy="8"
                  r={ringRadius}
                  fill="none"
                  stroke="var(--accent-orange)"
                  strokeWidth="2"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                />
              </svg>
              <span
                className="type-caption truncate font-semibold"
                style={{ color: "var(--accent-orange)" }}
              >
                {isBn ? "ফোকাস" : "Focus"}
              </span>
            </div>
            <span
              className="type-caption shrink-0 tabular-nums"
              style={{ color: "var(--text-secondary)" }}
            >
              {pomMins}:{pomSecs}
            </span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function IconTile({
  active,
  isToggle,
  activeColor,
  icon,
  label,
  prefersReducedMotion,
  refCallback,
  onHover,
  onKeyDown,
  onClick,
  onLongPress,
}: {
  active: boolean;
  isToggle: boolean;
  activeColor: string;
  icon: React.ReactNode;
  label: string;
  prefersReducedMotion: boolean;
  refCallback: (el: HTMLButtonElement | null) => void;
  onHover: (label: string | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  onClick: () => void;
  onLongPress?: () => void;
}) {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <motion.button
      ref={refCallback}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={isToggle ? active : undefined}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      onMouseEnter={() => onHover(label)}
      onMouseLeave={() => {
        clearLongPress();
        onHover(null);
      }}
      onFocus={() => onHover(label)}
      onBlur={() => onHover(null)}
      onPointerDown={() => {
        if (!onLongPress) return;
        longPressedRef.current = false;
        clearLongPress();
        longPressTimerRef.current = window.setTimeout(() => {
          longPressedRef.current = true;
          onLongPress();
        }, 450);
      }}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onContextMenu={(e) => {
        if (!onLongPress) return;
        e.preventDefault();
        onLongPress();
      }}
      onKeyDown={onKeyDown}
      onClick={() => {
        if (longPressedRef.current) {
          longPressedRef.current = false;
          return;
        }
        onClick();
      }}
      className="flex h-full w-full cursor-pointer items-center justify-center border-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
      style={{
        backgroundColor: active ? activeColor : "var(--surface-raised)",
        borderRadius: "14px",
        border: active ? `1px solid ${activeColor}` : "1px solid var(--hairline)",
        color: active ? "#000000" : "var(--text-secondary)",
      }}
    >
      {icon}
    </motion.button>
  );
}
