import { useState } from "react";
import {
  Lumi,
  LUMI_GLOW_HUES,
  LUMI_MOODS,
  type LumiAccessory,
  type LumiGlowHue,
  type LumiMood,
} from "../design/lumi";

const LOD_SIZES = [18, 22, 28, 56, 96] as const;

const SEASONAL_OPTIONS: Array<{ id: LumiAccessory; label: string }> = [
  { id: "ramadanLantern", label: "Ramadan lantern" },
  { id: "eidSparkle", label: "Eid sparkle" },
  { id: "boishakhHat", label: "Boishakh hat" },
];

export function DevLumiPage() {
  const [heroMood, setHeroMood] = useState<LumiMood>("idle");
  const [heroGlow, setHeroGlow] = useState<LumiGlowHue>("dusk");
  const [accessories, setAccessories] = useState<LumiAccessory[]>([]);
  const [scale150, setScale150] = useState(false);
  const [talking, setTalking] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [beat, setBeat] = useState(0);
  const [resolvedMood, setResolvedMood] = useState<LumiMood>("idle");

  const toggleAccessory = (acc: LumiAccessory) => {
    setAccessories((cur) => (cur.includes(acc) ? cur.filter((a) => a !== acc) : [...cur, acc]));
  };

  return (
    <div
      data-testid="dev-lumi-page"
      className="min-h-screen w-full overflow-y-auto bg-[#0b0a18] p-8 text-white"
      style={{ overflowY: "auto", userSelect: "text" }}
    >
      <div className="mx-auto max-w-[1120px] space-y-10">
        {/* Header & Interactive Inspector */}
        <div className="flex flex-wrap items-center justify-between gap-6 border-b border-white/10 pb-8">
          <div className="flex items-center gap-6">
            <div className="flex h-[132px] w-[132px] items-center justify-center rounded-3xl border border-white/10 bg-black/40">
              <div style={{ transform: scale150 ? "scale(1.5)" : undefined }}>
                <Lumi
                  size={96}
                  mood={heroMood}
                  glowHue={heroGlow}
                  talking={talking}
                  beat={beat}
                  reducedMotion={reducedMotion}
                  allowMultiple
                  onMoodResolved={setResolvedMood}
                  accessories={accessories}
                />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Lumi — Interactive Rig &amp; State Machine
              </h1>
              <p className="text-xs text-white/65">
                Active Mood: <strong className="text-[#ffc247]">{resolvedMood}</strong> · Click to
                squish · Hover 2s to purr · Double-click for love
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setBeat((b) => b + 1)}
                  className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white hover:bg-white/25"
                >
                  Trigger Beat Nod
                </button>
                <button
                  type="button"
                  onClick={() => setTalking((t) => !t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    talking ? "bg-[#ffc247] text-black" : "bg-white/10 text-white/80"
                  }`}
                >
                  Talking: {talking ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  onClick={() => setReducedMotion((r) => !r)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    reducedMotion ? "bg-[#ff453a] text-white" : "bg-white/10 text-white/80"
                  }`}
                >
                  Reduce Motion: {reducedMotion ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  onClick={() => setScale150((s) => !s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    scale150 ? "bg-[#7a78ff] text-white" : "bg-white/10 text-white/80"
                  }`}
                >
                  Scale: {scale150 ? "150%" : "100%"}
                </button>
                {SEASONAL_OPTIONS.map((opt) => {
                  const active = accessories.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleAccessory(opt.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        active ? "bg-[#2fd6b8] text-black" : "bg-white/10 text-white/75"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* All 12 Moods */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-white/80 uppercase">
            All 12 Moods (Click to test 1.5s dwell &amp; calm/focus/worried priority)
          </h2>
          <div className="grid grid-cols-6 gap-4">
            {LUMI_MOODS.map((m) => (
              <button
                key={m}
                type="button"
                data-testid={`dev-lumi-mood-${m}`}
                onClick={() => setHeroMood(m)}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-colors ${
                  heroMood === m
                    ? "border-[#ffc247]/70 bg-white/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <Lumi
                  size={56}
                  mood={m}
                  glowHue={heroGlow}
                  active={false}
                  reducedMotion={reducedMotion}
                  accessories={accessories}
                />
                <span className="text-xs font-medium capitalize text-white/85">{m}</span>
              </button>
            ))}
          </div>
        </section>

        {/* LOD Ladder & Notch Preview */}
        <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-8">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold tracking-wide text-white/80 uppercase">
              LOD Sizes (18 · 22 · 28 · 56 · 96 px)
            </h2>
            <div className="flex items-end gap-6 rounded-2xl border border-white/10 bg-black/40 p-6">
              {LOD_SIZES.map((sz) => (
                <div
                  key={sz}
                  data-testid={`dev-lumi-lod-${sz}`}
                  className="flex flex-col items-center gap-2"
                >
                  <Lumi size={sz} mood={heroMood} glowHue={heroGlow} accessories={accessories} />
                  <span className="text-xs tabular-nums text-white/65">{sz}</span>
                </div>
              ))}
            </div>
            <div
              data-testid="dev-lumi-pill-preview"
              className="flex h-[32px] w-[196px] items-center gap-2.5 rounded-full border border-white/10 bg-black px-3"
            >
              <Lumi size={18} mood={heroMood} glowHue={heroGlow} />
              <span className="text-xs font-semibold text-white">Hi, hello!</span>
            </div>
          </section>

          {/* 4 Glow Hues */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold tracking-wide text-white/80 uppercase">
              Context Glow Hues
            </h2>
            <div className="grid grid-cols-4 gap-3 rounded-2xl border border-white/10 bg-black/40 p-6">
              {LUMI_GLOW_HUES.map((hue) => (
                <button
                  key={hue}
                  type="button"
                  data-testid={`dev-lumi-glow-${hue}`}
                  onClick={() => setHeroGlow(hue)}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 ${
                    heroGlow === hue ? "border-white/40 bg-white/10" : "border-transparent"
                  }`}
                >
                  <Lumi size={56} mood="idle" glowHue={hue} />
                  <span className="text-xs font-medium capitalize text-white/80">{hue}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
