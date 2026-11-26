const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"] as const;

/**
 * Formats ASCII numerals into Bangla numerals when `banglaDigits` is active.
 */
export function formatDigits(input: string | number, banglaDigits: boolean): string {
  const str = String(input);
  if (!banglaDigits) {
    return str;
  }
  return str.replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/**
 * Replaces `{{key}}` placeholders inside i18n message strings.
 */
export function interpolateMsg(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : "",
  );
}

/**
 * Translates common English prayer/day/month/countdown labels gently into Bangla when active.
 */
export function formatPrayerLabel(
  nameEn: string,
  nameBn: string | undefined,
  language: "en" | "bn",
): string {
  if (language === "bn" && nameBn && nameBn.trim()) {
    return nameBn;
  }
  return nameEn;
}
