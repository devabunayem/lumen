import { motion } from "motion/react";
import { CpuIcon, GpuIcon, WifiIcon } from "../design/icons";
import { getMotionTransition } from "../design/motion";
import { COLOR_TOKENS } from "../design/tokens";
import { getMessages, type AppLanguage } from "../i18n";
import { formatDigits } from "../i18n/digits";
import type { SystemTelemetrySnapshot } from "../lib/ipc";

export interface SystemMonitorCardProps {
  telemetry: SystemTelemetrySnapshot | null;
  cpuHistory: number[];
  gpuHistory: number[];
  netDownHistory: number[];
  loading?: boolean;
  language: AppLanguage;
  banglaDigits: boolean;
  reduceMotion: boolean;
}

function formatThroughput(bps: number, banglaDigits: boolean): string {
  const safe = Math.max(0, Number.isFinite(bps) ? bps : 0);
  if (safe < 1024) {
    return `${formatDigits(Math.round(safe), banglaDigits)} B/s`;
  }
  const kb = safe / 1024;
  if (kb < 1024) {
    return `${formatDigits(kb >= 100 ? Math.round(kb) : kb.toFixed(1), banglaDigits)} KB/s`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${formatDigits(mb.toFixed(1), banglaDigits)} MB/s`;
  }
  const gb = mb / 1024;
  return `${formatDigits(gb.toFixed(2), banglaDigits)} GB/s`;
}

function formatByteTotal(bytes: number, banglaDigits: boolean): string {
  const safe = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
  const mb = safe / (1024 * 1024);
  if (mb < 1024) {
    return `${formatDigits(mb >= 100 ? Math.round(mb) : mb.toFixed(1), banglaDigits)} MB`;
  }
  const gb = mb / 1024;
  return `${formatDigits(gb.toFixed(2), banglaDigits)} GB`;
}

function buildSparklinePoints(
  series: number[],
  maxVal: number,
  width: number,
  height: number,
): string {
  const values = series.length >= 2 ? series : [0, ...series, 0];
  const peak = Math.max(1, maxVal);
  return values
    .map((val, idx) => {
      const x = (idx / Math.max(1, values.length - 1)) * width;
      const clamped = Math.min(1, Math.max(0, val / peak));
      const y = height - clamped * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function loadColor(pct: number, fallback: string): string {
  if (pct >= 90) return COLOR_TOKENS.accentRed;
  if (pct >= 75) return COLOR_TOKENS.accentOrange;
  return fallback;
}

export function SystemMonitorCard({
  telemetry,
  cpuHistory,
  gpuHistory,
  netDownHistory,
  loading = false,
  language,
  banglaDigits,
  reduceMotion,
}: SystemMonitorCardProps) {
  const msg = getMessages(language);
  const tMsg = msg.systemShelf.telemetry;

  if (loading && !telemetry) {
    return (
      <section
        data-testid="sys-monitor-card"
        className="cal-glass-card flex h-[258px] w-[236px] flex-col gap-[7px] overflow-hidden p-[10px]"
      >
        <div className="lumen-skeleton-shimmer h-[20px] w-32 rounded-full" />
        <div className="lumen-skeleton-shimmer flex-1 rounded-[12px]" />
        <div className="lumen-skeleton-shimmer flex-1 rounded-[12px]" />
        <div className="lumen-skeleton-shimmer flex-1 rounded-[12px]" />
      </section>
    );
  }

  const cpuPct = Math.round(Math.min(100, Math.max(0, telemetry?.cpuPercent ?? 0)));
  const cpuColor = loadColor(cpuPct, COLOR_TOKENS.accentCyan);
  const cpuCores = telemetry?.cpuCores ?? 1;

  const gpuAvailable = telemetry?.gpuPercent !== null && telemetry?.gpuPercent !== undefined;
  const gpuPct = gpuAvailable
    ? Math.round(Math.min(100, Math.max(0, telemetry?.gpuPercent ?? 0)))
    : 0;
  const gpuColor = loadColor(gpuPct, COLOR_TOKENS.accentPurple);

  const ramPct = telemetry?.ramPercent ?? 0;
  const ramTotal = telemetry?.ramTotalGb ?? 0;
  const ramUsed = telemetry?.ramUsedGb ?? 0;

  const netOnline = telemetry?.netOnline ?? false;
  const downBps = telemetry?.netDownBps ?? 0;
  const upBps = telemetry?.netUpBps ?? 0;
  const peakNet = Math.max(64 * 1024, ...netDownHistory, downBps);

  const springTx = getMotionTransition("progressSpring", reduceMotion);

  return (
    <section
      data-testid="sys-monitor-card"
      className="cal-glass-card flex h-[258px] w-[236px] flex-col gap-[7px] overflow-hidden p-[10px]"
    >
      {/* Header + RAM badge */}
      <div className="flex h-[20px] shrink-0 items-center justify-between gap-1.5">
        <span
          className="whitespace-nowrap text-[12px] font-semibold leading-none"
          style={{ color: COLOR_TOKENS.textPrimary }}
        >
          {tMsg.title}
        </span>

        <span
          data-testid="sys-ram-pill"
          className="shrink-0 whitespace-nowrap rounded-full px-1.5 py-[2px] text-[9px] font-medium leading-none tabular-nums"
          style={{
            backgroundColor: COLOR_TOKENS.calPillBg,
            border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
            color: COLOR_TOKENS.textSecondary,
          }}
        >
          {ramTotal > 0
            ? `${tMsg.ram} ${formatDigits(ramUsed.toFixed(1), banglaDigits)}/${formatDigits(Math.round(ramTotal), banglaDigits)}G · ${formatDigits(ramPct, banglaDigits)}%`
            : `${tMsg.ram} ${formatDigits(ramPct, banglaDigits)}%`}
        </span>
      </div>

      {/* 1. CPU Sub-panel */}
      <div
        data-testid="sys-cpu-panel"
        className="flex min-h-0 flex-1 flex-col justify-between rounded-[12px] px-[9px] py-[7px]"
        style={{
          backgroundColor: COLOR_TOKENS.sysSubcardBg,
          border: `1px solid ${COLOR_TOKENS.sysSubcardBorder}`,
        }}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span style={{ color: cpuColor }}>
              <CpuIcon size={13} />
            </span>
            <span className="text-[11px] font-semibold" style={{ color: COLOR_TOKENS.textPrimary }}>
              {tMsg.cpu}
            </span>
            <span
              className="truncate text-[9.5px] tabular-nums"
              style={{ color: COLOR_TOKENS.textTertiary }}
            >
              {formatDigits(cpuCores, banglaDigits)} {tMsg.cores}
            </span>
          </div>

          <span
            data-testid="sys-cpu-pct"
            className="text-[15px] font-semibold leading-none tabular-nums"
            style={{ color: cpuColor }}
          >
            {formatDigits(cpuPct, banglaDigits)}%
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="h-[4px] min-w-0 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: COLOR_TOKENS.sysTrackBg }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: cpuColor }}
              initial={false}
              animate={{ width: `${cpuPct}%` }}
              transition={springTx}
            />
          </div>
          <svg width="56" height="16" viewBox="0 0 56 16" aria-hidden="true" className="shrink-0">
            <polyline
              fill="none"
              stroke={cpuColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={buildSparklinePoints(cpuHistory, 100, 56, 16)}
            />
          </svg>
        </div>
      </div>

      {/* 2. GPU Sub-panel */}
      <div
        data-testid="sys-gpu-panel"
        className="flex min-h-0 flex-1 flex-col justify-between rounded-[12px] px-[9px] py-[7px]"
        style={{
          backgroundColor: COLOR_TOKENS.sysSubcardBg,
          border: `1px solid ${COLOR_TOKENS.sysSubcardBorder}`,
        }}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span style={{ color: gpuColor }}>
              <GpuIcon size={13} />
            </span>
            <span className="text-[11px] font-semibold" style={{ color: COLOR_TOKENS.textPrimary }}>
              {tMsg.gpu}
            </span>
            {telemetry?.gpuName && (
              <span
                title={telemetry.gpuName}
                className="max-w-[92px] truncate text-[9.5px]"
                style={{ color: COLOR_TOKENS.textTertiary }}
              >
                {telemetry.gpuName.replace(/NVIDIA GeForce |AMD Radeon |Intel\(R\) /g, "")}
              </span>
            )}
          </div>

          <span
            data-testid="sys-gpu-pct"
            className="text-[15px] font-semibold leading-none tabular-nums"
            style={{ color: gpuAvailable ? gpuColor : COLOR_TOKENS.textSecondary }}
          >
            {gpuAvailable ? `${formatDigits(gpuPct, banglaDigits)}%` : "—"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div
              className="h-[4px] w-full overflow-hidden rounded-full"
              style={{ backgroundColor: COLOR_TOKENS.sysTrackBg }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: gpuColor }}
                initial={false}
                animate={{ width: `${gpuPct}%` }}
                transition={springTx}
              />
            </div>
            {telemetry?.vramUsedGb !== null &&
              telemetry?.vramUsedGb !== undefined &&
              telemetry?.vramTotalGb !== null &&
              telemetry?.vramTotalGb !== undefined && (
                <div
                  className="text-[9px] leading-none tabular-nums"
                  style={{ color: COLOR_TOKENS.textTertiary }}
                >
                  {tMsg.vram} {formatDigits(telemetry.vramUsedGb.toFixed(1), banglaDigits)} /{" "}
                  {formatDigits(telemetry.vramTotalGb.toFixed(1), banglaDigits)} GB
                </div>
              )}
          </div>

          <svg width="52" height="16" viewBox="0 0 52 16" aria-hidden="true" className="shrink-0">
            <polyline
              fill="none"
              stroke={gpuAvailable ? gpuColor : COLOR_TOKENS.textTertiary}
              strokeOpacity={gpuAvailable ? 1 : 0.3}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={buildSparklinePoints(gpuAvailable ? gpuHistory : [0, 0], 100, 52, 16)}
            />
          </svg>
        </div>
      </div>

      {/* 3. Internet Use Sub-panel */}
      <div
        data-testid="sys-net-panel"
        className="flex min-h-0 flex-1 flex-col justify-between rounded-[12px] px-[9px] py-[7px]"
        style={{
          backgroundColor: COLOR_TOKENS.sysSubcardBg,
          border: `1px solid ${COLOR_TOKENS.sysSubcardBorder}`,
        }}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              style={{
                color: netOnline ? COLOR_TOKENS.accentGreen : COLOR_TOKENS.accentRed,
              }}
            >
              <WifiIcon size={13} />
            </span>
            <span className="text-[11px] font-semibold" style={{ color: COLOR_TOKENS.textPrimary }}>
              {tMsg.internet}
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-1">
            <span
              className="h-[5px] w-[5px] shrink-0 rounded-full"
              style={{
                backgroundColor: netOnline ? COLOR_TOKENS.accentGreen : COLOR_TOKENS.accentRed,
              }}
            />
            <span
              className="max-w-[92px] truncate text-[9.5px] font-medium"
              style={{
                color: netOnline ? COLOR_TOKENS.textSecondary : COLOR_TOKENS.accentRed,
              }}
            >
              {netOnline ? telemetry?.netInterfaceName || tMsg.online : tMsg.offline}
            </span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-1.5">
          <div className="flex min-w-0 flex-col gap-0.5 tabular-nums">
            <div className="flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold leading-none">
              <span data-testid="sys-net-down" style={{ color: COLOR_TOKENS.accentGreen }}>
                ↓ {formatThroughput(downBps, banglaDigits)}
              </span>
              <span data-testid="sys-net-up" style={{ color: COLOR_TOKENS.accentBlue }}>
                ↑ {formatThroughput(upBps, banglaDigits)}
              </span>
            </div>
            <div className="text-[9px] leading-none" style={{ color: COLOR_TOKENS.textTertiary }}>
              {tMsg.session}{" "}
              {formatByteTotal(
                (telemetry?.netSessionRxBytes ?? 0) + (telemetry?.netSessionTxBytes ?? 0),
                banglaDigits,
              )}
            </div>
          </div>

          <svg width="40" height="18" viewBox="0 0 40 18" aria-hidden="true" className="shrink-0">
            <polyline
              fill="none"
              stroke={netOnline ? COLOR_TOKENS.accentGreen : COLOR_TOKENS.textTertiary}
              strokeOpacity={netOnline ? 1 : 0.3}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={buildSparklinePoints(netOnline ? netDownHistory : [0, 0], peakNet, 40, 18)}
            />
          </svg>
        </div>
      </div>
    </section>
  );
}
