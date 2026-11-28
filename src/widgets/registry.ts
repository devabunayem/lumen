import type { LoadedPlugin } from "../lib/ipc";

export const BUILTIN_WIDGET_IDS = ["calendar_hub", "control", "water", "shelf"] as const;

export interface IslandPageMeta {
  id: string;
  titleLead: string;
  titleAccent: string;
  accentVar: string;
  plugin?: LoadedPlugin;
}

/**
 * Resolves ordered visible widget/page IDs combining built-in widgets and plugins (FR-PL-3).
 */
export function resolveOrderedWidgetIds(
  builtinIds: readonly string[],
  pluginIds: readonly string[],
  pageOrder: readonly string[],
  hiddenPages: readonly string[],
): string[] {
  const known = new Set([...builtinIds, ...pluginIds]);
  const ordered: string[] = [];

  for (const id of pageOrder) {
    if (known.has(id) && !hiddenPages.includes(id) && !ordered.includes(id)) {
      ordered.push(id);
    }
  }
  for (const id of [...builtinIds, ...pluginIds]) {
    if (!hiddenPages.includes(id) && !ordered.includes(id)) {
      ordered.push(id);
    }
  }

  return ordered.length > 0 ? ordered : [builtinIds[0] ?? "control"];
}
