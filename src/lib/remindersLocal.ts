import type { ReminderAlertPayload, ReminderItem } from "./ipc";

const REMINDERS_STORAGE_KEY = "lumen_reminders_v1";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Removes any reminder that expired 7+ days ago so localStorage stays lean.
 */
export function purgeExpiredLocalReminders(
  items: ReminderItem[],
  nowMs: number = Date.now(),
): ReminderItem[] {
  return items.filter((item) => {
    const targetMs = Date.parse(item.target_at);
    if (Number.isNaN(targetMs)) {
      return false;
    }
    return nowMs - targetMs < SEVEN_DAYS_MS;
  });
}

export function loadLocalReminders(nowMs: number = Date.now()): ReminderItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(REMINDERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const cleaned = purgeExpiredLocalReminders(parsed as ReminderItem[], nowMs);
    if (cleaned.length !== parsed.length) {
      window.localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveLocalReminders(
  items: ReminderItem[],
  nowMs: number = Date.now(),
): ReminderItem[] {
  const cleaned = purgeExpiredLocalReminders(items, nowMs);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(cleaned));
    } catch {
      // ignore quota/private mode errors
    }
  }
  return cleaned;
}

export function addLocalReminder(
  items: ReminderItem[],
  title: string,
  targetAtIso: string,
  leadMinutes: number,
  nowMs: number = Date.now(),
): ReminderItem[] {
  const next: ReminderItem = {
    id: nowMs,
    title: title.trim(),
    target_at: targetAtIso,
    lead_minutes: Math.max(0, Math.min(1440, leadMinutes)),
    lead_dismissed: false,
    snooze_until: null,
    exact_fired: false,
    completed: false,
    created_at: new Date(nowMs).toISOString(),
  };
  return saveLocalReminders([next, ...items], nowMs);
}

export function stopLocalReminder(
  items: ReminderItem[],
  id: number,
  stage: string,
  nowMs: number = Date.now(),
): ReminderItem[] {
  const next = items.map((rem) => {
    if (rem.id !== id) {
      return rem;
    }
    const targetPassed = Date.parse(rem.target_at) <= nowMs;
    if (stage === "exact" || rem.exact_fired || targetPassed) {
      return {
        ...rem,
        lead_dismissed: true,
        snooze_until: null,
        exact_fired: true,
        completed: true,
      };
    }
    return {
      ...rem,
      lead_dismissed: true,
      snooze_until: null,
    };
  });
  return saveLocalReminders(next, nowMs);
}

export function snoozeLocalReminder(
  items: ReminderItem[],
  id: number,
  snoozeMinutes: number,
  nowMs: number = Date.now(),
): ReminderItem[] {
  const snoozeAt = new Date(nowMs + Math.max(1, snoozeMinutes) * 60_000).toISOString();
  const next = items.map((rem) =>
    rem.id === id ? { ...rem, lead_dismissed: true, snooze_until: snoozeAt } : rem,
  );
  return saveLocalReminders(next, nowMs);
}

/**
 * Evaluates due reminders in non-Tauri browser preview mode so early lead alerts,
 * snooze repeats, and mandatory exact-time triggers behave identically.
 */
export function pollDueLocalReminders(
  items: ReminderItem[],
  nowMs: number = Date.now(),
): { updated: ReminderItem[]; due: ReminderAlertPayload[] } {
  const cleaned = purgeExpiredLocalReminders(items, nowMs);
  const due: ReminderAlertPayload[] = [];
  const updated = cleaned.map((rem) => {
    if (rem.completed) {
      return rem;
    }
    const targetMs = Date.parse(rem.target_at);
    if (Number.isNaN(targetMs)) {
      return rem;
    }

    if (!rem.exact_fired && nowMs >= targetMs) {
      const next = { ...rem, exact_fired: true, lead_dismissed: true, snooze_until: null };
      due.push({ reminder: next, stage: "exact", is_exact_due: true });
      return next;
    }

    if (rem.snooze_until) {
      const snoozeMs = Date.parse(rem.snooze_until);
      if (!Number.isNaN(snoozeMs) && nowMs >= snoozeMs) {
        const next = { ...rem, snooze_until: null };
        due.push({ reminder: next, stage: "snooze", is_exact_due: rem.exact_fired });
        return next;
      }
    }

    if (rem.lead_minutes > 0 && !rem.lead_dismissed && !rem.exact_fired) {
      const leadAt = targetMs - rem.lead_minutes * 60_000;
      if (nowMs >= leadAt && nowMs < targetMs) {
        const next = { ...rem, lead_dismissed: true };
        due.push({ reminder: next, stage: "lead", is_exact_due: false });
        return next;
      }
    }

    return rem;
  });

  return { updated: saveLocalReminders(updated, nowMs), due };
}
