import type { ColorGroup } from "./types";

/**
 * Group colours, warmed and slightly desaturated so they sit inside the
 * sand/terracotta palette instead of fighting it. Shared by the 3D board
 * and the HUD — this is the single source of truth.
 */
export const GROUP_COLORS: Record<ColorGroup, string> = {
  brown: "#8A5A3B",
  lightblue: "#7FB4CE",
  pink: "#BE5686",
  orange: "#D4802F",
  red: "#BC4239",
  yellow: "#DEB43C",
  green: "#3E8B58",
  darkblue: "#345A87",
};

export const GROUP_NAMES: Record<ColorGroup, string> = {
  brown: "Marron",
  lightblue: "Bleu clair",
  pink: "Rose",
  orange: "Orange",
  red: "Rouge",
  yellow: "Jaune",
  green: "Vert",
  darkblue: "Bleu foncé",
};

/** Ink that stays legible printed on top of each group band. */
export const GROUP_ON_COLOR: Record<ColorGroup, string> = {
  brown: "#F8EFE2",
  lightblue: "#16323F",
  pink: "#FBEFF4",
  orange: "#2E1B08",
  red: "#FBEDEB",
  yellow: "#33270A",
  green: "#EFF8F1",
  darkblue: "#EDF2F8",
};
