import bn from "./bn.json";
import en from "./en.json";

export type AppLanguage = "en" | "bn";

export const TRANSLATIONS: Record<AppLanguage, typeof en> = {
  en,
  bn,
};

export function getMessages(language: AppLanguage): typeof en {
  return TRANSLATIONS[language] ?? en;
}
