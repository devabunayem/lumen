import { COLOR_TOKENS } from "./tokens";

export interface IconProps {
  size?: number;
  className?: string;
}

const baseProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
});

export function PinIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

export function SettingsIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.78 1 1.44 1.09H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function PlayIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="6" y="4" width="4" height="16" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function VolumeOnIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

export function VolumeOffIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}

export function MusicNoteIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export function CalendarIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function PlusIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function CloseIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function BellIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function DropletIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  );
}

export function LinkIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function FileIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export function NoteIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function CapsIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M12 4 4 12h4v4h8v-4h4Z" />
      <line x1="8" y1="20" x2="16" y2="20" />
    </svg>
  );
}

export function BatteryIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="2" y="7" width="16" height="10" rx="2" />
      <line x1="22" y1="11" x2="22" y2="13" />
    </svg>
  );
}

const SUN_RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

export interface SunIconProps extends IconProps {
  warmDusk?: boolean;
  animated?: boolean;
}

/**
 * Pure vector glyph of the golden triangle-ray sun with subtle crescent rim shading.
 */
export function SunGlyph({
  warmDusk = false,
  animated = false,
}: {
  warmDusk?: boolean;
  animated?: boolean;
}) {
  const primary = warmDusk ? COLOR_TOKENS.sunDusk : COLOR_TOKENS.sunDisc;
  return (
    <g>
      <g className={animated ? "lumen-sun-spin" : undefined}>
        {SUN_RAY_ANGLES.map((deg) => (
          <polygon
            key={deg}
            points="12,1.1 10.65,4.9 13.35,4.9"
            fill={deg >= 45 && deg <= 135 ? COLOR_TOKENS.sunShade : primary}
            stroke="none"
            transform={`rotate(${deg} 12 12)`}
          />
        ))}
      </g>
      <circle cx="12" cy="12" r="5.35" fill={primary} stroke="none" />
      <path
        d="M 12 6.65 A 5.35 5.35 0 0 1 12 17.35 A 4.05 5.35 0 0 0 12 6.65 Z"
        fill={COLOR_TOKENS.sunShade}
        stroke="none"
      />
    </g>
  );
}

export function SunIcon({
  size = 15,
  className,
  warmDusk = false,
  animated = false,
}: SunIconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <SunGlyph warmDusk={warmDusk} animated={animated} />
    </svg>
  );
}

export function BoltIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function MicIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

export function MicOffIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

export function LockIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function BellOffIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5" />
      <path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export function CameraIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

export function ScanTextIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 9h10" />
      <path d="M12 9v7" />
    </svg>
  );
}

export function ChevronUpIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

export function CoffeeIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  );
}

export function GridIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

export function MoonIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function TimerIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <line x1="10" y1="2" x2="14" y2="2" />
      <line x1="12" y1="14" x2="15" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </svg>
  );
}

export function InboxIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

export function CheckListIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </svg>
  );
}

export function WifiIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M12 20h.01" />
      <path d="M2 8.82a15 15 0 0 1 20 0" />
      <path d="M5 12.859a10 10 0 0 1 14 0" />
      <path d="M8.5 16.429a5 5 0 0 1 7 0" />
    </svg>
  );
}

export function BluetoothIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="m7 7 10 10-5 5V2l5 5L7 17" />
    </svg>
  );
}

export function ClipboardIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

export function ClockLedgerIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  );
}

export function CloudIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

export function CloudRainIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M16 14v6" />
      <path d="M8 14v6" />
      <path d="M12 16v6" />
    </svg>
  );
}

export interface MoonStarIconProps extends IconProps {
  twinkle?: boolean;
}

/**
 * Pure vector glyph of a luminous tilted crescent moon flanked by two 5-point stars.
 */
export function MoonStarGlyph({ twinkle = false }: { twinkle?: boolean }) {
  return (
    <g>
      {/* Bold tilted crescent moon */}
      <path
        d="M 14.2 2.8 A 8.8 8.8 0 1 0 21.8 14.3 A 6.95 6.95 0 1 1 14.2 2.8 Z"
        fill={COLOR_TOKENS.moonCrescent}
        stroke="none"
      />
      {/* Upper-right star */}
      <polygon
        points="17.1,3.9 17.95,5.65 19.9,5.9 18.5,7.25 18.85,9.2 17.1,8.25 15.35,9.2 15.7,7.25 14.3,5.9 16.25,5.65"
        fill={COLOR_TOKENS.moonStar}
        stroke="none"
        className={twinkle ? "lumen-moon-twinkle" : undefined}
      />
      {/* Lower-left star overlapping crescent curve with crisp dark cutout halo */}
      <polygon
        points="6.7,14.6 7.55,16.35 9.5,16.6 8.1,17.95 8.45,19.9 6.7,18.95 4.95,19.9 5.3,17.95 3.9,16.6 5.85,16.35"
        fill={COLOR_TOKENS.moonStar}
        stroke={COLOR_TOKENS.surface}
        strokeWidth="2.1"
        strokeLinejoin="round"
        paintOrder="stroke"
        className={twinkle ? "lumen-moon-twinkle" : undefined}
      />
    </g>
  );
}

export function MoonStarIcon({ size = 15, className, twinkle = false }: MoonStarIconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <MoonStarGlyph twinkle={twinkle} />
    </svg>
  );
}

export function SkipBackIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none" />
      <line x1="5" y1="19" x2="5" y2="5" strokeWidth="1.8" />
    </svg>
  );
}

export function SkipForwardIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" />
      <line x1="19" y1="5" x2="19" y2="19" strokeWidth="1.8" />
    </svg>
  );
}

export function CompassIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <circle cx="12" cy="12" r="9.5" />
      <polygon points="15.8 8.2 13.8 13.8 8.2 15.8 10.2 10.2 15.8 8.2" />
    </svg>
  );
}

export function HeadphonesIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

export function ShareIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export function CheckIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Precision viewfinder crop frame with inner capture ring for Windows Snipping Tool. */
export function SnippingToolIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Screen frame with solid center record indicator for Windows Screen Recording. */
export function ScreenRecordIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="3" y="4.5" width="18" height="13" rx="3" />
      <circle cx="12" cy="11" r="2.75" fill="currentColor" stroke="none" />
      <path d="M8.5 20.5h7" />
    </svg>
  );
}

/** Stopwatch / Focus timer glyph with crown and sweep hand. */
export function FocusTimerIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M10 2.5h4" />
      <path d="M12 2.5v2" />
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.25V13l2.75 1.75" />
    </svg>
  );
}

/** Crisp video camera glyph for Camera on state. */
export function VideoCamIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="2.5" y="6.5" width="13.5" height="11" rx="2.5" />
      <path d="m16 10.2 5-2.7v9l-5-2.7" />
    </svg>
  );
}

/** Slashed video camera glyph for Camera off state. */
export function VideoCamOffIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M10.5 6.5h3a2.5 2.5 0 0 1 2.5 2.5v1.5" />
      <path d="M16 16a2.5 2.5 0 0 1-2.5 1.5H5A2.5 2.5 0 0 1 2.5 15V9A2.5 2.5 0 0 1 5 6.5h1" />
      <path d="m16 10.2 5-2.7v9l-2.8-1.5" />
    </svg>
  );
}

export function ShieldIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3Z" />
    </svg>
  );
}

export function RepeatIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function CrescentIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function SolidDotMark({ size = 6, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <circle cx="4" cy="4" r="3.5" />
    </svg>
  );
}

export function HollowDotMark({ size = 6, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      className={className}
    >
      <circle cx="4" cy="4" r="2.75" />
    </svg>
  );
}

export function BellTickMark({ size = 7, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M2.5 6.8h5l-.6-2.4a2 2 0 1 0-3.8 0l-.6 2.4Z" />
      <path d="M4.2 8.2h1.6" />
    </svg>
  );
}

export function DiamondMark({ size = 6, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <polygon points="4,0.6 7.4,4 4,7.4 0.6,4" />
    </svg>
  );
}

export function CpuIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.8" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </svg>
  );
}

export function GpuIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2.5" />
      <circle cx="9" cy="12" r="2.7" />
      <circle cx="16.5" cy="12" r="2.2" />
      <path d="M5 18v2M19 18v2" />
    </svg>
  );
}

export function UploadDropIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M12 3v10" />
      <path d="m8.5 9.5 3.5 3.5 3.5-3.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function CopyIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function TrashIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
