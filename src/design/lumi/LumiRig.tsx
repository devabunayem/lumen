import { motion } from "motion/react";
import { useId } from "react";
import { CONTENT_STAGGER, MOTION_PRESETS } from "../motion";
import { COLOR_TOKENS } from "../tokens";
import {
  LUMI_BODY_PATH,
  resolveGlowToken,
  resolveLumiLod,
  type LumiAccessory,
  type LumiGlowHue,
  type LumiLookPoint,
  type LumiMood,
} from "./types";

export interface LumiRigProps {
  size: number;
  mood: LumiMood;
  glowHue: LumiGlowHue;
  showGlow: boolean;
  talking: boolean;
  lookAt?: LumiLookPoint;
  accessories?: readonly LumiAccessory[];
  blinkClosed?: boolean;
  purring?: boolean;
  animateAmbient?: boolean;
  reducedMotion?: boolean;
  noddingBeat?: boolean;
  squishPulse?: boolean;
}

/**
 * Animated 200x200 vector character rig for Lumi ("Main" state machine layers):
 * - Automatic 3-tier LOD (`micro <= 22`, `compact <= 40`, `full >= 41`)
 * - Breathing (4s / 6s sleepy), spark flicker (+-3 deg), natural blink (90ms/120ms)
 * - Cursor look (+-6px eased 180ms), 12 expressive animated moods, beat nod, squish tap
 */
export function LumiRig({
  size,
  mood,
  glowHue,
  showGlow,
  talking,
  lookAt,
  accessories = [],
  blinkClosed = false,
  purring = false,
  animateAmbient = true,
  reducedMotion = false,
  noddingBeat = false,
  squishPulse = false,
}: LumiRigProps) {
  const uid = useId().replace(/:/g, "");
  const bodyGradId = `lumi-body-${uid}`;
  const glowGradId = `lumi-glow-${uid}`;
  const lod = resolveLumiLod(size);
  const glowColor = resolveGlowToken(glowHue);

  const motionEnabled = animateAmbient && !reducedMotion;

  // Clamp cursor look offset to +-6 SVG units (only applied smoothly)
  const lookDx = Math.max(-1, Math.min(1, lookAt?.x ?? 0)) * 6;
  const lookDy = Math.max(-1, Math.min(1, lookAt?.y ?? 0)) * 6;

  const isMicro = lod === "micro";
  const isFull = lod === "full";
  const showBlushAndMouth = lod !== "micro";

  const happyArcEyes = purring || mood === "hello" || mood === "happy" || mood === "celebrate";
  const isCalm = mood === "calm";
  const isSleepy = mood === "sleepy";
  const isHeartEyes = mood === "love";
  const isCurious = mood === "curious";
  const isWorried = mood === "worried";
  const isOops = mood === "oops";
  const isFocus = mood === "focus";
  const isCelebrate = mood === "celebrate";
  const isHello = mood === "hello";
  const isTalking = talking || mood === "talk";

  const eyeRx = isMicro ? 13 : 11;
  const eyeRy = isMicro ? 16.5 : 15;

  // Body ambient + mood kinematic transform (zero hops/shakes under reducedMotion)
  const bodyAnimate = (() => {
    if (squishPulse && !reducedMotion) {
      return { scaleX: [1, 1.08, 1], scaleY: [1, 0.92, 1], y: 0, x: 0, rotate: 0 };
    }
    if (noddingBeat && !reducedMotion) {
      return { scale: [1, 1.04, 1], y: [0, 2, 0], x: 0, rotate: 0 };
    }
    if (!motionEnabled) {
      return {
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
        rotate: isCurious && isFull ? 8 : 0,
      };
    }
    if (isCelebrate) {
      return { y: [0, -10, 0], scale: [1, 1.04, 1], x: 0, rotate: 0 };
    }
    if (isHello) {
      return { y: [0, -6, 0], scale: [1, 1.02, 1], x: 0, rotate: 0 };
    }
    if (isOops) {
      return { x: [...CONTENT_STAGGER.errorShakeX], scale: 1, y: 0, rotate: 0 };
    }
    if (isCurious && isFull) {
      return { rotate: 8, scale: [1, 1.025, 1], x: 0, y: 0 };
    }
    return { scale: [1, 1.03, 1], x: 0, y: 0, rotate: 0 };
  })();

  const bodyTransition = (() => {
    if (squishPulse && !reducedMotion) {
      return { ...MOTION_PRESETS.snappy };
    }
    if (noddingBeat && !reducedMotion) {
      return MOTION_PRESETS.lumiBeatNod;
    }
    if (!motionEnabled) {
      return MOTION_PRESETS.reducedMotionFade;
    }
    if (isCelebrate) {
      return { ...MOTION_PRESETS.bouncy, repeat: Infinity, repeatDelay: 0.7 };
    }
    if (isHello) {
      return { duration: 0.6, repeat: Infinity, repeatDelay: 0.4, ease: "easeInOut" as const };
    }
    if (isOops) {
      return { duration: 0.36, ease: "easeInOut" as const };
    }
    if (isCurious && isFull) {
      return MOTION_PRESETS.gentle;
    }
    return {
      duration: isSleepy ? 6 : 4,
      repeat: Infinity,
      ease: "easeInOut" as const,
    };
  })();

  const renderStandardEye = (cx: number, cy: number, radiusScale = 1) => {
    const rx = eyeRx * radiusScale;
    const ry = eyeRy * radiusScale;
    if (blinkClosed) {
      return (
        <motion.path
          key={`blink-${cx}`}
          d={`M${cx - rx} ${cy + 1} Q${cx} ${cy + 7} ${cx + rx} ${cy + 1}`}
          stroke={COLOR_TOKENS.lumiEye}
          strokeWidth={isMicro ? 5 : 4.2}
          strokeLinecap="round"
          fill="none"
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.09 }}
        />
      );
    }
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={COLOR_TOKENS.lumiEye} />
        <motion.g
          animate={{ x: lookDx, y: lookDy }}
          transition={reducedMotion ? { duration: 0 } : MOTION_PRESETS.lumiLook}
        >
          <circle
            cx={cx - 4.2 * radiusScale}
            cy={cy - 5.2 * radiusScale}
            r={4.1 * radiusScale}
            fill="#ffffff"
          />
          {!isMicro && (
            <circle
              cx={cx + 3.4 * radiusScale}
              cy={cy + 4.4 * radiusScale}
              r={2.0 * radiusScale}
              fill="#ffffff"
            />
          )}
        </motion.g>
        {isFull && (
          <ellipse
            cx={cx}
            cy={cy + 9.2 * radiusScale}
            rx={5.5 * radiusScale}
            ry={2.1 * radiusScale}
            fill={COLOR_TOKENS.lumiSparkOuter}
            opacity="0.45"
          />
        )}
      </g>
    );
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      overflow="visible"
      aria-hidden="true"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <radialGradient id={bodyGradId} cx="46%" cy="32%" r="68%" fx="42%" fy="28%">
          <stop offset="0%" stopColor={COLOR_TOKENS.lumiBodyTop} />
          <stop offset="45%" stopColor={COLOR_TOKENS.lumiBodyMid} />
          <stop offset="100%" stopColor={COLOR_TOKENS.lumiBodyBot} />
        </radialGradient>

        <radialGradient id={glowGradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={glowColor} stopOpacity="0.58" />
          <stop offset="55%" stopColor={glowColor} stopOpacity="0.22" />
          <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Separate outer context Glow Layer */}
      {showGlow && (
        <motion.circle
          data-testid="lumi-glow-layer"
          cx="100"
          cy="114"
          r="98"
          fill={`url(#${glowGradId})`}
          animate={{ opacity: isCalm ? 0.92 : 1 }}
          transition={MOTION_PRESETS.lumiTransition}
        />
      )}

      {/* Ground shadow ellipse */}
      {!isMicro && (
        <ellipse cx="100" cy="190" rx="42" ry="6.5" fill={COLOR_TOKENS.lumiShadow} opacity="0.34" />
      )}

      {/* Main animated character group */}
      <motion.g
        style={{ transformOrigin: "100px 124px" }}
        animate={bodyAnimate}
        transition={bodyTransition}
      >
        {/* Nub arms (Full LOD only) */}
        {isFull && (
          <g data-testid="lumi-arms-layer" fill={COLOR_TOKENS.lumiArm}>
            {/* Left arm */}
            <motion.ellipse
              cx={isCelebrate ? 23 : 22}
              cy={isCelebrate ? 96 : 131}
              rx={9}
              ry={isCelebrate ? 15 : 13.5}
              animate={{ rotate: isCelebrate ? -38 : 24 }}
              transition={reducedMotion ? { duration: 0.01 } : MOTION_PRESETS.lumiTransition}
            />

            {/* Right arm */}
            {isCelebrate ? (
              <motion.ellipse
                cx={177}
                cy={96}
                rx={9}
                ry={15}
                animate={{ rotate: [34, 46, 34] }}
                transition={
                  motionEnabled ? { duration: 0.5, repeat: Infinity } : { duration: 0.01 }
                }
              />
            ) : isHello ? (
              <g>
                <motion.ellipse
                  cx={177}
                  cy={98}
                  rx={9}
                  ry={15}
                  style={{ transformOrigin: "168px 110px" }}
                  animate={motionEnabled ? { rotate: [36, 8, 42, 8, 36] } : { rotate: 36 }}
                  transition={
                    motionEnabled
                      ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.01 }
                  }
                />
                <path
                  d="M191 84 Q197 92 192 102"
                  stroke={COLOR_TOKENS.lumiSparkOuter}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.85"
                />
                <path
                  d="M197 80 Q204 92 198 106"
                  stroke={COLOR_TOKENS.lumiSparkOuter}
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.55"
                />
              </g>
            ) : (
              <ellipse cx="178" cy="131" rx="9" ry="13.5" transform="rotate(-24 178 131)" />
            )}
          </g>
        )}

        {/* Focus headphones (200 ms fade in) */}
        {isFull && isFocus && (
          <motion.g
            data-testid="lumi-focus-headphones"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reducedMotion ? { duration: 0.01 } : MOTION_PRESETS.lumiHeadphones}
          >
            <path
              d="M27 116 C27 60 60 36 100 36 C140 36 173 60 173 116"
              stroke={COLOR_TOKENS.lumiHeadphoneBand}
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
            />
            <rect
              x="14"
              y="98"
              width="17"
              height="38"
              rx="8.5"
              fill={COLOR_TOKENS.lumiHeadphoneCup}
            />
            <rect
              x="169"
              y="98"
              width="17"
              height="38"
              rx="8.5"
              fill={COLOR_TOKENS.lumiHeadphoneCup}
            />
          </motion.g>
        )}

        {/* Base marshmallow light-droplet body */}
        <path data-testid="lumi-body" d={LUMI_BODY_PATH} fill={`url(#${bodyGradId})`} />

        {/* Belly & top-left specular highlights */}
        {isFull && (
          <g data-testid="lumi-highlights-layer">
            <ellipse
              cx="100"
              cy="142"
              rx="46"
              ry="26"
              fill={COLOR_TOKENS.lumiBelly}
              opacity="0.34"
            />
            <ellipse
              cx="67"
              cy="75"
              rx="20"
              ry="10"
              transform="rotate(-32 67 75)"
              fill="#ffffff"
              opacity="0.58"
            />
          </g>
        )}

        {/* Flame spark with +-3 deg 2.4s flicker (droops in sleepy) */}
        <motion.g
          data-testid="lumi-spark"
          style={{ transformOrigin: "100px 46px" }}
          animate={
            isSleepy
              ? { rotate: -18, y: 4 }
              : motionEnabled
                ? { rotate: [-3, 3, -3], y: 0 }
                : { rotate: 0, y: 0 }
          }
          transition={
            !isSleepy && motionEnabled
              ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
              : MOTION_PRESETS.lumiTransition
          }
        >
          <path
            d="M100 13 C109 28 111 39 100 46 C89 39 91 28 100 13 Z"
            fill={COLOR_TOKENS.lumiSparkOuter}
          />
          {!isMicro && (
            <path
              d="M100 22 C104.5 31 105.5 38 100 43 C94.5 38 95.5 31 100 22 Z"
              fill={COLOR_TOKENS.lumiSparkInner}
            />
          )}
        </motion.g>

        {/* Optional Boishakh tiny hat */}
        {isFull && accessories.includes("boishakhHat") && (
          <g data-testid="lumi-acc-boishakh-hat" transform="translate(124 44) rotate(18)">
            <path d="M-14 14 L0 -6 L14 14 Z" fill={COLOR_TOKENS.waqtDeadline} />
            <rect
              x="-15"
              y="12"
              width="30"
              height="5"
              rx="2.5"
              fill={COLOR_TOKENS.lumiSparkOuter}
            />
          </g>
        )}

        {/* Pink blush */}
        {showBlushAndMouth && (
          <motion.g
            data-testid="lumi-blush-layer"
            fill={COLOR_TOKENS.lumiBlush}
            animate={{
              opacity: isHeartEyes ? 0.78 : 0.55,
              scale: isHeartEyes && !reducedMotion ? 1.15 : 1,
            }}
            transition={MOTION_PRESETS.lumiTransition}
          >
            <ellipse cx="50" cy="129" rx="11" ry="6" />
            <ellipse cx="150" cy="129" rx="11" ry="6" />
          </motion.g>
        )}

        {/* Eyes layer */}
        <g data-testid="lumi-eyes-layer">
          {happyArcEyes ? (
            <>
              <path
                d="M58 119 Q72 100 86 119"
                stroke={COLOR_TOKENS.lumiEye}
                strokeWidth={isMicro ? 5.5 : 5}
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M114 119 Q128 100 142 119"
                stroke={COLOR_TOKENS.lumiEye}
                strokeWidth={isMicro ? 5.5 : 5}
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : isCalm ? (
            <>
              <path
                d="M58 113 Q72 125 86 113"
                stroke={COLOR_TOKENS.lumiEye}
                strokeWidth={isMicro ? 5.2 : 4.5}
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M114 113 Q128 125 142 113"
                stroke={COLOR_TOKENS.lumiEye}
                strokeWidth={isMicro ? 5.2 : 4.5}
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : isSleepy ? (
            <>
              {/* Half-closed sleepy lids */}
              <path
                d="M58 115 Q72 124 86 115"
                stroke={COLOR_TOKENS.lumiEye}
                strokeWidth={isMicro ? 5.2 : 4.5}
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M114 115 Q128 124 142 115"
                stroke={COLOR_TOKENS.lumiEye}
                strokeWidth={isMicro ? 5.2 : 4.5}
                strokeLinecap="round"
                fill="none"
              />
              {isFull && (
                <>
                  <path
                    d="M60 105 Q72 109 84 105"
                    stroke={COLOR_TOKENS.lumiEye}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    opacity="0.38"
                    fill="none"
                  />
                  <path
                    d="M116 105 Q128 109 140 105"
                    stroke={COLOR_TOKENS.lumiEye}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    opacity="0.38"
                    fill="none"
                  />
                </>
              )}
            </>
          ) : isHeartEyes ? (
            <motion.g
              style={{ transformOrigin: "100px 112px" }}
              animate={motionEnabled ? { scale: [1, 1.1, 1] } : { scale: 1 }}
              transition={motionEnabled ? { duration: 0.9, repeat: Infinity } : { duration: 0.01 }}
            >
              <path
                d="M72 126 C72 126 57 116 57 107 C57 102 61 99 66 99 C69 99 71 101 72 104 C73 101 75 99 78 99 C83 99 87 102 87 107 C87 116 72 126 72 126 Z"
                fill={COLOR_TOKENS.lumiMouthFill}
              />
              <path
                d="M128 126 C128 126 113 116 113 107 C113 102 117 99 122 99 C125 99 127 101 128 104 C129 101 131 99 134 99 C139 99 143 102 143 107 C143 116 128 126 128 126 Z"
                fill={COLOR_TOKENS.lumiMouthFill}
              />
            </motion.g>
          ) : (
            <>
              {renderStandardEye(72, 114, isCurious ? 1.14 : 1)}
              {renderStandardEye(128, 114, isCurious ? 0.9 : 1)}
            </>
          )}

          {isWorried && showBlushAndMouth && (
            <>
              <path
                d="M58 96 Q70 88 82 93"
                stroke={COLOR_TOKENS.lumiEye}
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M118 93 Q130 88 142 96"
                stroke={COLOR_TOKENS.lumiEye}
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
            </>
          )}
        </g>

        {/* Mouth layer */}
        {showBlushAndMouth && (
          <g data-testid="lumi-mouth-layer">
            {isTalking ? (
              <motion.path
                d="M91 128 Q100 129 109 128 Q107 141 100 141 Q93 141 91 128 Z"
                fill={COLOR_TOKENS.lumiEye}
                style={{ transformOrigin: "100px 132px" }}
                animate={motionEnabled ? { scaleY: [0.65, 1.15, 0.7, 1.05, 0.8] } : { scaleY: 1 }}
                transition={
                  motionEnabled
                    ? { duration: 0.36, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.01 }
                }
              />
            ) : isHello || mood === "happy" || isCelebrate ? (
              <path
                d="M91 128 Q100 129 109 128 Q107 141 100 141 Q93 141 91 128 Z"
                fill={COLOR_TOKENS.lumiEye}
              />
            ) : isOops || isSleepy ? (
              <ellipse
                cx="100"
                cy="132"
                rx="4.2"
                ry="5"
                stroke={COLOR_TOKENS.lumiEye}
                strokeWidth="3"
                fill={isOops ? COLOR_TOKENS.lumiMouthFill : "none"}
              />
            ) : isWorried ? (
              <path
                d="M90 133 Q95 128 100 133 Q105 138 110 133"
                stroke={COLOR_TOKENS.lumiEye}
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
            ) : isFocus ? (
              <path
                d="M93 130 Q100 135 107 130"
                stroke={COLOR_TOKENS.lumiEye}
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
            ) : (
              <path
                d="M91 128 Q95.5 135 100 128.5 Q104.5 135 109 128"
                stroke={COLOR_TOKENS.lumiEye}
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
          </g>
        )}
      </motion.g>

      {/* Particles layer (Full LOD only, suppressed cleanly under reducedMotion!) */}
      {isFull && !reducedMotion && (
        <g data-testid="lumi-particles-layer">
          {(mood === "happy" || isCelebrate) && (
            <>
              <motion.path
                d="M38 56 L42 64 L50 68 L42 72 L38 80 L34 72 L26 68 L34 64 Z"
                fill={COLOR_TOKENS.lumiSparkOuter}
                animate={
                  isCelebrate
                    ? { scale: [0.5, 1.2, 0.8], opacity: [0.4, 1, 0] }
                    : { opacity: [0.6, 1, 0.6] }
                }
                transition={{ duration: isCelebrate ? 0.9 : 1.4, repeat: Infinity }}
              />
              <motion.path
                d="M162 56 L165 63 L172 66 L165 69 L162 76 L159 69 L152 66 L159 63 Z"
                fill={COLOR_TOKENS.lumiSparkInner}
                animate={
                  isCelebrate
                    ? { scale: [0.5, 1.2, 0.8], opacity: [0.4, 1, 0] }
                    : { opacity: [0.7, 1, 0.7] }
                }
                transition={{ duration: isCelebrate ? 0.9 : 1.2, repeat: Infinity, delay: 0.15 }}
              />
            </>
          )}
          {isCelebrate && (
            <motion.g
              animate={{ y: [0, -10], opacity: [1, 0] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            >
              <path
                d="M100 2 L102.5 8 L108.5 10.5 L102.5 13 L100 19 L97.5 13 L91.5 10.5 L97.5 8 Z"
                fill={COLOR_TOKENS.lumiSparkOuter}
              />
              <circle cx="52" cy="40" r="3" fill={COLOR_TOKENS.lumiGlowFocus} />
              <circle cx="150" cy="40" r="3" fill={COLOR_TOKENS.lumiGlowPrayer} />
            </motion.g>
          )}
          {isCalm && (
            <path
              d="M164 60 A8 8 0 1 0 174 70 A6 6 0 1 1 164 60 Z"
              fill={COLOR_TOKENS.lumiGlowPrayer}
              opacity="0.9"
            />
          )}
          {isCurious && (
            <text x="156" y="62" fontSize="20" fontWeight="700" fill={COLOR_TOKENS.lumiSparkInner}>
              ?
            </text>
          )}
          {isSleepy && (
            <motion.g
              fill={COLOR_TOKENS.lumiGlowNight}
              fontWeight="700"
              animate={motionEnabled ? { y: [0, -6, 0], opacity: [0.55, 1, 0.55] } : undefined}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <text x="150" y="64" fontSize="14">
                z
              </text>
              <text x="163" y="48" fontSize="18">
                Z
              </text>
            </motion.g>
          )}
          {isWorried && (
            <motion.path
              d="M160 72 C164 80 166 86 160 91 C154 86 156 80 160 72 Z"
              fill={COLOR_TOKENS.lumiSweat}
              animate={motionEnabled ? { y: [0, 4, 0] } : undefined}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          )}
          {isHeartEyes && (
            <motion.path
              d="M162 72 C162 72 154 66 154 61 C154 58 156.5 56 159 56 C160.5 56 161.5 57 162 58.5 C162.5 57 163.5 56 165 56 C167.5 56 170 58 170 61 C170 66 162 72 162 72 Z"
              fill={COLOR_TOKENS.lumiBlush}
              animate={motionEnabled ? { y: [0, -8], opacity: [0.95, 0] } : undefined}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
          {accessories.includes("eidSparkle") && (
            <>
              <path
                d="M164 46 A9 9 0 1 0 176 58 A7 7 0 1 1 164 46 Z"
                fill={COLOR_TOKENS.lumiSparkInner}
              />
              <path
                d="M36 44 L38 49 L43 51 L38 53 L36 58 L34 53 L29 51 L34 49 Z"
                fill={COLOR_TOKENS.lumiSparkOuter}
              />
            </>
          )}
          {accessories.includes("ramadanLantern") && (
            <g data-testid="lumi-acc-ramadan-lantern" transform="translate(174 134)">
              <line
                x1="0"
                y1="-22"
                x2="0"
                y2="0"
                stroke={COLOR_TOKENS.lumiSparkOuter}
                strokeWidth="2"
              />
              <rect
                x="-7"
                y="0"
                width="14"
                height="18"
                rx="4"
                fill={COLOR_TOKENS.lumiShadow}
                opacity="0.9"
              />
              <rect x="-4" y="4" width="8" height="10" rx="2" fill={COLOR_TOKENS.lumiSparkInner} />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
