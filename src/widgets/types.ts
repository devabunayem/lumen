import type { ReactNode } from "react";

/**
 * Widget contract per SRS Section 5.11 (FR-PL-1).
 */
export interface LumenWidget {
  id: string;
  title: string;
  accent: string;
  icon: ReactNode;
  render: () => ReactNode;
  onActivate?: () => void;
  getLiveActivity?: () => LiveActivitySnapshot | null;
}

export interface LiveActivitySnapshot {
  widgetId: string;
  label: string;
  accent: string;
}
