import { useState } from "react";
import { motion } from "motion/react";
import {
  BluetoothIcon,
  CoffeeIcon,
  LockIcon,
  MicIcon,
  MicOffIcon,
  MoonIcon,
  SettingsIcon,
  WifiIcon,
} from "../../design/icons";
import { CONTENT_STAGGER, MOTION_PRESETS } from "../../design/motion";
import { playUiSound } from "../../design/sounds";
import { COLOR_TOKENS } from "../../design/tokens";
import { getMessages } from "../../i18n";
import { formatDigits } from "../../i18n/digits";

export interface TogglesState {
  wifi: boolean | null;
  bluetooth: boolean | null;
  focus: boolean;
  micMuted: boolean;
  keepAwake: boolean;
}

export interface TogglesRowProps {
  nowDate: Date;
  language: "en" | "bn";
  banglaDigits: boolean;
  toggles: TogglesState;
  reduceMotion: boolean;
  onToggleWifi: () => Promise<boolean>;
  onToggleBluetooth: () => Promise<boolean>;
  onToggleFocus: () => void;
  onToggleMic: () => void;
  onToggleKeepAwake: () => void;
  onLockWorkstation: () => void;
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
  onToggleWifi,
  onToggleBluetooth,
  onToggleFocus,
  onToggleMic,
  onToggleKeepAwake,
  onLockWorkstation,
  onOpenSettings,
  onToggleShape,
}: TogglesRowProps) {
  const msg = getMessages(language);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const { datePart, timePart } = formatHeaderDate(nowDate, banglaDigits);

  const triggerError = (key: string) => {
    void playUiSound("error");
    setErrorKey(key);
    window.setTimeout(() => {
      setErrorKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const handleRadioClick = async (key: "wifi" | "bluetooth", action: () => Promise<boolean>) => {
    try {
      const next = await action();
      void playUiSound(next ? "toggle_on" : "toggle_off");
    } catch {
      triggerError(key);
    }
  };

  const buttons = [
    {
      key: "wifi",
      label: msg.home.toggles.wifi,
      active: Boolean(toggles.wifi),
      activeColor: COLOR_TOKENS.accentBlue,
      icon: <WifiIcon size={14} />,
      onClick: () => void handleRadioClick("wifi", onToggleWifi),
    },
    {
      key: "bluetooth",
      label: msg.home.toggles.bluetooth,
      active: Boolean(toggles.bluetooth),
      activeColor: COLOR_TOKENS.accentBlue,
      icon: <BluetoothIcon size={14} />,
      onClick: () => void handleRadioClick("bluetooth", onToggleBluetooth),
    },
    {
      key: "focus",
      label: msg.home.toggles.focus,
      active: toggles.focus,
      activeColor: COLOR_TOKENS.accentFocus,
      icon: <MoonIcon size={14} />,
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
      icon: toggles.micMuted ? <MicOffIcon size={14} /> : <MicIcon size={14} />,
      onClick: () => {
        void playUiSound(toggles.micMuted ? "toggle_off" : "toggle_on");
        onToggleMic();
      },
    },
    {
      key: "awake",
      label: msg.home.toggles.keepAwake,
      active: toggles.keepAwake,
      activeColor: COLOR_TOKENS.accentOrange,
      icon: <CoffeeIcon size={14} />,
      onClick: () => {
        void playUiSound(toggles.keepAwake ? "toggle_off" : "toggle_on");
        onToggleKeepAwake();
      },
    },
    {
      key: "lock",
      label: msg.home.toggles.lock,
      active: false,
      activeColor: COLOR_TOKENS.surfaceButton,
      icon: <LockIcon size={14} />,
      onClick: () => {
        void playUiSound("toggle_on");
        onLockWorkstation();
      },
    },
  ];

  return (
    <header className="relative z-10 grid h-[30px] w-full grid-cols-[1fr_auto_1fr] items-center">
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

      <div className="flex items-center gap-1.5" role="group" aria-label="Quick toggles">
        {buttons.map((btn) => {
          const hasErr = errorKey === btn.key;
          return (
            <div key={btn.key} className="relative flex items-center justify-center">
              <motion.button
                type="button"
                aria-label={btn.label}
                aria-pressed={btn.key === "lock" ? undefined : btn.active}
                title={hasErr ? msg.home.toggles.radioError : btn.label}
                onClick={btn.onClick}
                whileTap={
                  reduceMotion
                    ? undefined
                    : { scale: 0.96, transition: MOTION_PRESETS.pressFeedback }
                }
                animate={
                  hasErr && !reduceMotion ? { x: [...CONTENT_STAGGER.errorShakeX] } : { x: 0 }
                }
                transition={{ duration: 0.24 }}
                className="flex h-[32px] w-[32px] items-center justify-center rounded-full"
                style={{ background: "transparent" }}
              >
                <motion.span
                  animate={
                    reduceMotion
                      ? undefined
                      : btn.active
                        ? { scale: [...CONTENT_STAGGER.togglePulseScale] }
                        : { scale: 1 }
                  }
                  transition={{ duration: 0.22 }}
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
                  style={{
                    background: btn.active ? btn.activeColor : COLOR_TOKENS.toggleOff,
                    color: btn.active ? COLOR_TOKENS.textPrimary : COLOR_TOKENS.toggleIconOff,
                    transition: `background-color ${MOTION_PRESETS.toggleCrossfade.duration}s ease-out, color ${MOTION_PRESETS.toggleCrossfade.duration}s ease-out`,
                  }}
                >
                  {btn.icon}
                </motion.span>
              </motion.button>
              {hasErr && (
                <div
                  role="tooltip"
                  className="type-home-micro pointer-events-none absolute top-[34px] z-30 whitespace-nowrap rounded-lg px-2 py-0.5 text-white"
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
          className="flex h-[32px] w-[32px] items-center justify-center rounded-full"
          style={{ color: COLOR_TOKENS.toggleIconOff }}
        >
          <SettingsIcon size={15} />
        </motion.button>
      </div>
    </header>
  );
}
