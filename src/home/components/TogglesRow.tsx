import { useState } from "react";
import { motion } from "motion/react";
import {
  BellOffIcon,
  FocusTimerIcon,
  LockIcon,
  MicIcon,
  MicOffIcon,
  ScreenRecordIcon,
  SettingsIcon,
  SnippingToolIcon,
  VideoCamIcon,
  VideoCamOffIcon,
} from "../../design/icons";
import { CONTENT_STAGGER, MOTION_PRESETS } from "../../design/motion";
import { playUiSound } from "../../design/sounds";
import { COLOR_TOKENS } from "../../design/tokens";
import { getMessages } from "../../i18n";
import { formatDigits } from "../../i18n/digits";

export interface TogglesState {
  focus: boolean;
  micMuted: boolean;
  cameraEnabled: boolean;
  silentMode: boolean;
}

export interface TogglesRowProps {
  nowDate: Date;
  language: "en" | "bn";
  banglaDigits: boolean;
  toggles: TogglesState;
  reduceMotion: boolean;
  onLaunchScreenshot: () => Promise<void> | void;
  onLaunchScreenRecord: () => Promise<void> | void;
  onToggleFocus: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => Promise<boolean> | void;
  onLockWorkstation: () => void;
  onToggleSilentMode: () => void;
  onOpenSettings: () => void;
  onToggleShape?: () => void;
}

function formatHeaderDate(
  now: Date,
  banglaDigits: boolean,
): { datePart: string; timePart: string } {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = days[now.getDay()];
  const dateNum = now.getDate();
  const month = months[now.getMonth()];
  const h24 = now.getHours();
  const m = now.getMinutes();
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  return {
    datePart: formatDigits(`${day} ${dateNum} ${month}`, banglaDigits),
    timePart: `${formatDigits(`${h12}:${String(m).padStart(2, "0")}`, banglaDigits)} ${suffix}`,
  };
}

export function TogglesRow({
  nowDate,
  language,
  banglaDigits,
  toggles,
  reduceMotion,
  onLaunchScreenshot,
  onLaunchScreenRecord,
  onToggleFocus,
  onToggleMic,
  onToggleCamera,
  onLockWorkstation,
  onToggleSilentMode,
  onOpenSettings,
  onToggleShape,
}: TogglesRowProps) {
  const msg = getMessages(language);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const { datePart, timePart } = formatHeaderDate(nowDate, banglaDigits);

  const triggerError = (key: string) => {
    void playUiSound("error");
    setErrorKey(key);
    window.setTimeout(() => {
      setErrorKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const triggerFlash = (key: string) => {
    setFlashKey(key);
    window.setTimeout(() => {
      setFlashKey((prev) => (prev === key ? null : prev));
    }, 850);
  };

  const handleAsyncAction = async (
    key: string,
    action: () => Promise<unknown> | void,
    flash = false,
  ) => {
    try {
      await action();
      if (flash) {
        triggerFlash(key);
      }
      void playUiSound("toggle_on");
    } catch {
      triggerError(key);
    }
  };

  const buttons = [
    {
      key: "screenshot",
      label: msg.home.toggles.screenshot,
      active: flashKey === "screenshot",
      activeColor: COLOR_TOKENS.accentCyan,
      pressable: false,
      icon: <SnippingToolIcon size={14} />,
      onClick: () => void handleAsyncAction("screenshot", onLaunchScreenshot, true),
    },
    {
      key: "record",
      label: msg.home.toggles.record,
      active: flashKey === "record",
      activeColor: COLOR_TOKENS.accentRed,
      pressable: false,
      icon: <ScreenRecordIcon size={14} />,
      onClick: () => void handleAsyncAction("record", onLaunchScreenRecord, true),
    },
    {
      key: "focus",
      label: msg.home.toggles.focus,
      active: toggles.focus,
      activeColor: COLOR_TOKENS.accentFocus,
      pressable: true,
      icon: <FocusTimerIcon size={14} />,
      onClick: () => {
        void playUiSound(toggles.focus ? "toggle_off" : "toggle_on");
        onToggleFocus();
      },
    },
    {
      key: "mic",
      label: msg.home.toggles.mic,
      active: toggles.micMuted,
      activeColor: COLOR_TOKENS.accentRed,
      pressable: true,
      icon: toggles.micMuted ? <MicOffIcon size={14} /> : <MicIcon size={14} />,
      onClick: () => {
        void playUiSound(toggles.micMuted ? "toggle_off" : "toggle_on");
        onToggleMic();
      },
    },
    {
      key: "camera",
      label: msg.home.toggles.camera,
      active: !toggles.cameraEnabled,
      activeColor: COLOR_TOKENS.accentRed,
      pressable: true,
      icon: toggles.cameraEnabled ? <VideoCamIcon size={14} /> : <VideoCamOffIcon size={14} />,
      onClick: () => {
        void playUiSound(toggles.cameraEnabled ? "toggle_off" : "toggle_on");
        void handleAsyncAction("camera", onToggleCamera);
      },
    },
    {
      key: "lock",
      label: msg.home.toggles.lock,
      active: false,
      activeColor: COLOR_TOKENS.surfaceButton,
      pressable: false,
      icon: <LockIcon size={14} />,
      onClick: () => {
        void playUiSound("toggle_on");
        onLockWorkstation();
      },
    },
    {
      key: "silent",
      label: msg.home.toggles.silent,
      active: toggles.silentMode,
      activeColor: COLOR_TOKENS.accentOrange,
      pressable: true,
      icon: <BellOffIcon size={14} />,
      onClick: () => {
        if (!toggles.silentMode) {
          void playUiSound("toggle_on");
        }
        onToggleSilentMode();
        if (toggles.silentMode) {
          void playUiSound("toggle_off");
        }
      },
    },
  ];

  return (
    <header className="relative z-10 grid h-[28px] w-full grid-cols-[1fr_auto_1fr] items-center">
      <div
        data-testid="home-header-clock"
        title="Toggle date & time"
        onContextMenu={(e) => {
          e.preventDefault();
          onToggleShape?.();
        }}
        className="type-home-meta flex items-center gap-1 whitespace-nowrap"
        style={{ color: COLOR_TOKENS.textPrimary }}
      >
        <span>{datePart}</span>
        <span style={{ color: COLOR_TOKENS.textSecondary }}>·</span>
        <span className="font-semibold tabular-nums">{timePart}</span>
      </div>

      <div className="flex items-center gap-1" role="group" aria-label="Quick toggles">
        {buttons.map((btn) => {
          const hasErr = errorKey === btn.key;
          return (
            <div key={btn.key} className="relative flex items-center justify-center">
              <motion.button
                type="button"
                data-testid={`home-toggle-${btn.key}`}
                aria-label={btn.label}
                aria-pressed={btn.pressable ? btn.active : undefined}
                title={hasErr ? msg.home.toggles.radioError : btn.label}
                onClick={btn.onClick}
                whileTap={
                  reduceMotion
                    ? undefined
                    : { scale: 0.94, transition: MOTION_PRESETS.pressFeedback }
                }
                animate={
                  hasErr && !reduceMotion ? { x: [...CONTENT_STAGGER.errorShakeX] } : { x: 0 }
                }
                transition={{ duration: 0.24 }}
                className="-my-[2px] flex h-[30px] w-[30px] items-center justify-center rounded-full"
                style={{ background: "transparent" }}
              >
                <span
                  className="flex h-[24px] w-[24px] items-center justify-center rounded-full transition-colors duration-150"
                  style={{
                    background: btn.active ? btn.activeColor : COLOR_TOKENS.toggleOff,
                    color: btn.active ? COLOR_TOKENS.textPrimary : COLOR_TOKENS.toggleIconOff,
                    border: `1px solid ${btn.active ? COLOR_TOKENS.hairlineTop : COLOR_TOKENS.hairline}`,
                  }}
                >
                  {btn.icon}
                </span>
              </motion.button>
              {hasErr && (
                <div
                  role="tooltip"
                  className="type-home-micro pointer-events-none absolute top-[30px] z-30 whitespace-nowrap rounded-lg px-2 py-0.5 text-white"
                  style={{
                    background: COLOR_TOKENS.arcTooltipBg,
                    border: `1px solid ${COLOR_TOKENS.chipGlassBorder}`,
                  }}
                >
                  {msg.home.toggles.radioError}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <motion.button
          type="button"
          aria-label={msg.home.toggles.settings}
          title={msg.home.toggles.settings}
          onClick={onOpenSettings}
          whileTap={
            reduceMotion ? undefined : { scale: 0.96, transition: MOTION_PRESETS.pressFeedback }
          }
          className="-my-[2px] flex h-[32px] w-[32px] items-center justify-center rounded-full"
          style={{ color: COLOR_TOKENS.toggleIconOff }}
        >
          <SettingsIcon size={14} />
        </motion.button>
      </div>
    </header>
  );
}
