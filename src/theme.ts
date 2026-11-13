export const ACCENT_THEMES = [
  { id: "royal-violet", name: "Royal Violet", primary: "#6855DB", text: "#FFFFFF" },
  { id: "ocean-blue", name: "Ocean Blue", primary: "#2878D7", text: "#000000" },
  { id: "emerald-green", name: "Emerald Green", primary: "#15966B", text: "#000000" },
  { id: "rose-pink", name: "Rose Pink", primary: "#D94F91", text: "#000000" },
  { id: "ruby-red", name: "Ruby Red", primary: "#D94343", text: "#000000" },
  { id: "sunset-orange", name: "Sunset Orange", primary: "#E77B32", text: "#000000" },
  { id: "golden-amber", name: "Golden Amber", primary: "#B98216", text: "#000000" },
  { id: "teal-fresh", name: "Teal Fresh", primary: "#159C9C", text: "#000000" },
  { id: "royal-indigo", name: "Royal Indigo", primary: "#4654B8", text: "#FFFFFF" },
  { id: "graphite-black", name: "Graphite Black", primary: "#343B46", text: "#FFFFFF" },
] as const;

export type AccentThemeId = (typeof ACCENT_THEMES)[number]["id"];
export const DEFAULT_ACCENT_THEME: AccentThemeId = "royal-violet";
export const ACCENT_THEME_STORAGE_KEY = "gbk-healthcare:appearance:v1";

export function isAccentThemeId(value: unknown): value is AccentThemeId {
  return ACCENT_THEMES.some((theme) => theme.id === value);
}
