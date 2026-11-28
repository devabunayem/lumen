import type { ParsedQuickAdd } from "../lib/ipc";

const PRAYER_ALIASES: Record<string, string> = {
  fajr: "Fajr",
  fojor: "Fajr",
  fojr: "Fajr",
  dhuhr: "Dhuhr",
  zuhr: "Dhuhr",
  zohor: "Dhuhr",
  johor: "Dhuhr",
  asr: "Asr",
  asor: "Asr",
  asar: "Asr",
  maghrib: "Maghrib",
  magrib: "Maghrib",
  magreb: "Maghrib",
  isha: "Isha",
  esha: "Isha",
};

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  sunday: 0,
  robibar: 0,
  mon: 1,
  monday: 1,
  sombar: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  mongolbar: 2,
  wed: 3,
  wednesday: 3,
  budhbar: 3,
  thu: 4,
  thurs: 4,
  thursday: 4,
  brihospotibar: 4,
  fri: 5,
  friday: 5,
  shukrobar: 5,
  jumuah: 5,
  sat: 6,
  saturday: 6,
  shonibar: 6,
};

function fmtYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt12h(h24: number, min: number): string {
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${suffix}`;
}

function parseHhMm(raw: string, forcePm: boolean | null): [number, number] | null {
  const parts = raw.split(":");
  if (parts.length > 2) return null;
  const hNum = Number(parts[0]);
  const mNum = parts[1] !== undefined ? Number(parts[1]) : 0;
  if (
    !Number.isInteger(hNum) ||
    !Number.isInteger(mNum) ||
    hNum < 0 ||
    hNum > 23 ||
    mNum < 0 ||
    mNum > 59
  ) {
    return null;
  }
  let h = hNum;
  if (forcePm === true && h >= 1 && h <= 11) h += 12;
  else if (forcePm === false && h === 12) h = 0;
  else if (forcePm === null && parts.length < 2) return null;
  return [h, mNum];
}

function clampDom(year: number, monthIndex0: number, dom: number): Date {
  const maxDays = new Date(year, monthIndex0 + 1, 0).getDate();
  return new Date(year, monthIndex0, Math.min(dom, maxDays));
}

export function parseQuickAddLocal(
  raw: string,
  nowDate: Date,
  defaultMode: "task" | "reminder",
): ParsedQuickAdd {
  const trimmed = raw.trim();
  const baseToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  const words = trimmed ? trimmed.split(/\s+/) : [];
  const consumed = new Array<boolean>(words.length).fill(false);

  let isDeadline = false;
  let importance: "normal" | "urgent" = "normal";
  let targetKind: "task" | "reminder" = defaultMode;

  words.forEach((w, i) => {
    const lw = w.replace(/[^a-z0-9:]/gi, "").toLowerCase();
    if (lw === "deadline" || lw === "due" || lw === "hardstop") {
      isDeadline = true;
      consumed[i] = true;
    } else if (lw === "urgent" || lw === "joruri" || lw === "asap") {
      importance = "urgent";
      consumed[i] = true;
    }
  });

  // 1. Prayer-linked phrases
  let prayerAnchor: ParsedQuickAdd["prayerAnchor"] = null;
  for (let i = 0; i < words.length; i += 1) {
    const clean = words[i].replace(/[^a-z]/gi, "").toLowerCase();
    const prayer = PRAYER_ALIASES[clean];
    if (!prayer) continue;

    consumed[i] = true;
    let offsetMin = 10;
    let relation: "before" | "after" = "before";
    for (let j = 0; j < words.length; j += 1) {
      const lw = words[j].replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (lw === "before" || lw === "age" || lw === "agey") {
        relation = "before";
        consumed[j] = true;
      } else if (lw === "after" || lw === "por" || lw === "pore") {
        relation = "after";
        consumed[j] = true;
      } else if (["min", "mins", "minute", "minutes", "m", "er"].includes(lw)) {
        consumed[j] = true;
      } else if (j < i || (j > i && j - i <= 3)) {
        const numMatch = /^(\d+)m?$/.exec(lw);
        if (numMatch) {
          const n = Number(numMatch[1]);
          if (n >= 0 && n <= 180) {
            offsetMin = n;
            consumed[j] = true;
          }
        }
      }
    }
    prayerAnchor = { prayer, offsetMin, relation };
    targetKind = "reminder";
    break;
  }

  let reminderKind: ParsedQuickAdd["reminderKind"] = prayerAnchor ? "prayer" : "once";
  let repeatRule: string | null = null;
  let dueDate: Date | null = null;

  if (!prayerAnchor) {
    const lowerFull = trimmed.toLowerCase();
    if (lowerFull.includes("every month") || lowerFull.includes("monthly")) {
      reminderKind = "monthly";
      targetKind = "reminder";
      let dom = baseToday.getDate();
      words.forEach((w, i) => {
        const lw = w.toLowerCase();
        if (["every", "month", "monthly", "on", "the"].includes(lw)) {
          consumed[i] = true;
        } else {
          const ord = /^(\d{1,2})(st|nd|rd|th)?$/.exec(lw);
          if (ord) {
            const d = Number(ord[1]);
            if (d >= 1 && d <= 31) {
              dom = d;
              consumed[i] = true;
            }
          }
        }
      });
      const cand = clampDom(baseToday.getFullYear(), baseToday.getMonth(), dom);
      dueDate =
        cand >= baseToday ? cand : clampDom(baseToday.getFullYear(), baseToday.getMonth() + 1, dom);
      repeatRule = `Monthly · Day ${dom}`;
    } else if (
      lowerFull.includes("every day") ||
      lowerFull.includes("daily") ||
      lowerFull.includes("protidin")
    ) {
      reminderKind = "daily";
      targetKind = "reminder";
      dueDate = baseToday;
      words.forEach((w, i) => {
        if (["every", "day", "daily", "protidin"].includes(w.toLowerCase())) {
          consumed[i] = true;
        }
      });
      repeatRule = "Daily";
    } else {
      let foundEvery = false;
      let foundWd: number | null = null;
      words.forEach((w, i) => {
        const lw = w.toLowerCase();
        if (["every", "weekly", "protishoptaho"].includes(lw)) {
          foundEvery = true;
          consumed[i] = true;
        } else if (WEEKDAY_MAP[lw] !== undefined) {
          foundWd = WEEKDAY_MAP[lw];
          consumed[i] = true;
        }
      });
      const stepToWd = (wd: number) => {
        const diff = (wd - baseToday.getDay() + 7) % 7;
        return new Date(baseToday.getFullYear(), baseToday.getMonth(), baseToday.getDate() + diff);
      };
      if (foundEvery || lowerFull.includes("weekly")) {
        reminderKind = "weekly";
        targetKind = "reminder";
        const wd = foundWd ?? baseToday.getDay();
        dueDate = stepToWd(wd);
        repeatRule = "Weekly";
      } else if (foundWd !== null) {
        dueDate = stepToWd(foundWd);
      }
    }
  }

  if (!dueDate) {
    for (let i = 0; i < words.length; i += 1) {
      const lw = words[i].toLowerCase();
      if (["today", "ajke", "aj"].includes(lw)) {
        dueDate = baseToday;
        consumed[i] = true;
        break;
      }
      if (["tomorrow", "tmrw", "kal", "kalke", "agamikal"].includes(lw)) {
        dueDate = new Date(baseToday.getFullYear(), baseToday.getMonth(), baseToday.getDate() + 1);
        consumed[i] = true;
        break;
      }
    }
  }

  // Time parsing
  let dueTime: string | null = null;
  let time24: string | null = null;
  if (!prayerAnchor) {
    const periodIdx = words.findIndex((t) =>
      ["shokale", "sokal", "sokale", "morning", "am"].includes(t.toLowerCase()),
    );
    const pmIdx = words.findIndex((t) =>
      [
        "bikal",
        "bikale",
        "dupur",
        "dupure",
        "sondha",
        "sondhay",
        "raat",
        "rat",
        "evening",
        "night",
        "pm",
      ].includes(t.toLowerCase()),
    );
    for (let i = 0; i < words.length; i += 1) {
      const lw = words[i].toLowerCase();
      const nxt = words[i + 1]?.toLowerCase();
      let parsed: [number, number] | null = null;
      const toConsume: number[] = [];

      if (lw.endsWith("am") || lw.endsWith("pm")) {
        parsed = parseHhMm(lw.slice(0, -2), lw.endsWith("pm"));
        if (parsed) toConsume.push(i);
      } else if (nxt && (nxt === "am" || nxt === "pm")) {
        parsed = parseHhMm(lw, nxt === "pm");
        if (parsed) {
          toConsume.push(i, i + 1);
          if (periodIdx >= 0) toConsume.push(periodIdx);
          if (pmIdx >= 0) toConsume.push(pmIdx);
        }
      } else if (nxt && ["tay", "ta", "baje"].includes(nxt)) {
        const forcePm = pmIdx >= 0 ? true : periodIdx >= 0 ? false : null;
        parsed = parseHhMm(lw, forcePm);
        if (parsed) {
          toConsume.push(i, i + 1);
          if (periodIdx >= 0) toConsume.push(periodIdx);
          if (pmIdx >= 0) toConsume.push(pmIdx);
        }
      } else if (lw.includes(":")) {
        parsed = parseHhMm(lw, null);
        if (parsed) toConsume.push(i);
      }

      if (parsed) {
        toConsume.forEach((idx) => {
          consumed[idx] = true;
        });
        time24 = `${String(parsed[0]).padStart(2, "0")}:${String(parsed[1]).padStart(2, "0")}`;
        dueTime = fmt12h(parsed[0], parsed[1]);
        break;
      }
    }
  }

  if (dueTime && ["daily", "weekly", "monthly"].includes(reminderKind) && repeatRule) {
    repeatRule = `${repeatRule} · ${dueTime}`;
  }

  const resolvedDate = dueDate ?? baseToday;
  const dateKey = fmtYmd(resolvedDate);
  const atIso = prayerAnchor
    ? dateKey
    : time24 || dueDate
      ? `${dateKey}T${time24 ?? "09:00"}:00`
      : null;

  const remaining = words.filter((_, idx) => !consumed[idx]);
  while (
    remaining.length > 0 &&
    ["at", "on", "by", "for", "every"].includes(remaining[remaining.length - 1].toLowerCase())
  ) {
    remaining.pop();
  }
  const title = remaining.length > 0 ? remaining.join(" ") : trimmed;

  const tomorrowKey = fmtYmd(
    new Date(baseToday.getFullYear(), baseToday.getMonth(), baseToday.getDate() + 1),
  );
  const todayKey = fmtYmd(baseToday);
  let chipLabel: string;
  if (prayerAnchor) {
    chipLabel = `${prayerAnchor.offsetMin}m ${prayerAnchor.relation} ${prayerAnchor.prayer}`;
  } else if (repeatRule) {
    chipLabel = repeatRule;
  } else {
    const dayTag =
      dateKey === todayKey
        ? "Today"
        : dateKey === tomorrowKey
          ? "Tomorrow"
          : resolvedDate.toLocaleDateString("en-US", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
    chipLabel = dueTime ? `${dayTag} · ${dueTime}` : dayTag;
  }

  return {
    title,
    targetKind,
    dueDate: dateKey,
    dueTime,
    isDeadline,
    reminderKind,
    at: atIso,
    repeatRule,
    prayerAnchor,
    importance,
    chipLabel,
  };
}
