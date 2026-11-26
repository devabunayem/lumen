import { useRef, useState, type KeyboardEvent } from "react";
import { playUiSound } from "../../design/sounds";
import { COLOR_TOKENS } from "../../design/tokens";
import { getMessages, type AppLanguage } from "../../i18n";
import { formatDigits, interpolateMsg } from "../../i18n/digits";
import type { WaterSummary } from "../../lib/ipc";
import { DigitRoll } from "./DigitRoll";

export interface WaterCardProps {
  water: WaterSummary;
  language?: AppLanguage;
  banglaDigits: boolean;
  reduceMotion: boolean;
  onLogWater: (ml: number) => void;
  onOpenWaterPage: () => void;
}

const STEP_OPTIONS = [150, 250, 500] as const;

export function WaterCard({
  water,
  language = "en",
  banglaDigits,
  reduceMotion,
  onLogWater,
  onOpenWaterPage,
}: WaterCardProps) {
  const msg = getMessages(language);
  const [stepMl, setStepMl] = useState<number>(250);
  const [pickerOpen, setPickerOpen] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const liters = (water.today_ml / 1000).toFixed(1);
  const goalLiters = (water.goal_ml / 1000).toFixed(1);
  const pct = Math.min(100, Math.max(0, water.percentage));

  const triggerAdd = (ml: number) => {
    void playUiSound("water_add");
    onLogWater(ml);
  };

  const handlePointerDown = () => {
    longPressFiredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      setPickerOpen(true);
    }, 380);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleClick = () => {
    if (longPressFiredRef.current || pickerOpen) {
      longPressFiredRef.current = false;
      return;
    }
    triggerAdd(stepMl);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " ") {
      e.preventDefault();
      triggerAdd(stepMl);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onOpenWaterPage();
    }
  };

  return (
    <div
      data-testid="home-water-card"
      role="button"
      tabIndex={0}
      aria-label={`${msg.home.water.title} ${liters} L`}
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onContextMenu={(e) => {
        e.preventDefault();
        setPickerOpen((v) => !v);
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`home-glass-card relative flex h-[94px] cursor-pointer items-stretch justify-between gap-2.5 overflow-hidden px-[12px] py-[10px] text-left ${
        reduceMotion ? "" : "transition-transform duration-100 active:scale-[0.96]"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="type-home-meta" style={{ color: COLOR_TOKENS.textSecondary }}>
            {msg.home.water.title}
          </span>
        </div>

        <div className="mt-auto">
          <div className="type-home-stat-md whitespace-nowrap text-white">
            <DigitRoll
              value={`${liters} L`}
              banglaDigits={banglaDigits}
              reduceMotion={reduceMotion}
            />
          </div>

          <div className="mt-0.5">
            <div
              className="type-home-micro mb-1 truncate"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              {water.goal_reached
                ? formatDigits(
                    interpolateMsg(msg.home.water.goalReached, { goal: goalLiters }),
                    banglaDigits,
                  )
                : formatDigits(
                    interpolateMsg(msg.home.water.ofGoal, { goal: goalLiters, step: stepMl }),
                    banglaDigits,
                  )}
            </div>
            <div className="h-[4px] w-full overflow-hidden rounded-full bg-white/15">
              <div
                className={`h-full origin-left rounded-full ${
                  reduceMotion ? "" : "transition-transform duration-200 ease-out"
                }`}
                style={{
                  background: COLOR_TOKENS.accentBlue,
                  transform: `scaleX(${pct / 100})`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Animated water vessel visualization */}
      <div
        data-testid="water-liquid-visual"
        aria-hidden="true"
        className="relative w-[36px] shrink-0 self-stretch overflow-hidden rounded-[12px]"
        style={{
          background: "rgba(255, 255, 255, 0.04)",
          border: `1px solid ${COLOR_TOKENS.chipGlassBorder}`,
        }}
      >
        <div
          className={`absolute inset-x-0 bottom-0 h-full ${
            reduceMotion ? "" : "transition-transform duration-500 ease-out"
          }`}
          style={{
            transform: `translate3d(0, ${(1 - (pct <= 0 ? 0.18 : 0.18 + (pct / 100) * 0.82)) * 100}%, 0)`,
          }}
        >
          {/* Back slow liquid wave crest */}
          <svg
            viewBox="0 0 96 14"
            preserveAspectRatio="none"
            className={`absolute -top-[8px] left-0 h-[10px] w-[200%] ${
              reduceMotion ? "" : "lumen-water-wave-b"
            }`}
          >
            <path
              d="M0 7 Q12 1 24 7 T48 7 T72 7 T96 7 V14 H0 Z"
              fill={`color-mix(in srgb, ${COLOR_TOKENS.accentBlue} 52%, white 24%)`}
              fillOpacity={0.5}
            />
          </svg>
          {/* Front primary liquid wave crest */}
          <svg
            viewBox="0 0 96 14"
            preserveAspectRatio="none"
            className={`absolute -top-[7px] left-0 h-[10px] w-[200%] ${
              reduceMotion ? "" : "lumen-water-wave-a"
            }`}
          >
            <path
              d="M0 7 Q12 12 24 7 T48 7 T72 7 T96 7 V14 H0 Z"
              fill={COLOR_TOKENS.accentBlue}
              fillOpacity={0.88}
            />
          </svg>
          {/* Liquid body fill */}
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(180deg, color-mix(in srgb, ${COLOR_TOKENS.accentBlue} 88%, transparent) 0%, color-mix(in srgb, ${COLOR_TOKENS.accentBlue} 65%, black 35%) 100%)`,
            }}
          />
          {!reduceMotion && (
            <>
              <span className="lumen-water-bubble-1 absolute bottom-2 left-2.5 h-[3px] w-[3px] rounded-full bg-white/65" />
              <span className="lumen-water-bubble-2 absolute bottom-1 right-2.5 h-[2px] w-[2px] rounded-full bg-white/55" />
            </>
          )}
        </div>
        {/* Vertical glass specular highlight */}
        <div className="pointer-events-none absolute inset-y-1.5 left-1 w-[2px] rounded-full bg-white/15" />
      </div>

      {pickerOpen && (
        <div
          data-testid="water-size-picker"
          role="dialog"
          aria-label={msg.home.water.pickSize}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-1.5 bottom-1.5 z-30 flex items-center justify-between gap-1 rounded-[14px] p-1"
          style={{
            background: COLOR_TOKENS.arcTooltipBg,
            border: `1px solid ${COLOR_TOKENS.chipGlassBorder}`,
          }}
        >
          {STEP_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setStepMl(opt);
                setPickerOpen(false);
                triggerAdd(opt);
              }}
              className="type-home-micro flex-1 rounded-full py-1 text-center font-semibold text-white"
              style={{
                background: opt === stepMl ? COLOR_TOKENS.accentBlue : "transparent",
              }}
            >
              +{formatDigits(opt, banglaDigits)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
