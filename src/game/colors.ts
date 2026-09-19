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

/**
 * The two event decks, in one place.
 *
 * Baraka is orange and Teranga blue — on the printed square, on the pile in
 * the middle of the board, and on the card that comes off it. A player who
 * lands on one should already know which deck they are about to draw from
 * by the colour under their token, and the card should look like it came
 * from there. Teranga used to be printed on cream, which is the colour of
 * the board itself: its squares vanished among the properties.
 */
export interface DeckStyle {
  /** What the deck is called on the board and on its cards. */
  name: string;
  /** Full strength: the icon, the pile, the keyline on the card. */
  strong: string;
  /** A wash of it, filling the printed square. */
  tint: string;
  /** Ink that stays legible on that square, and on the card. */
  on: string;
  /** The card stock itself, top to bottom. */
  face: [string, string, string];
}

export const DECK_STYLES: Record<"chance" | "chest", DeckStyle> = {
  chance: {
    name: "Baraka",
    strong: "#C2721C",
    tint: "rgba(210,122,26,0.46)",
    on: "#4A2C0A",
    face: ["#F9E2B6", "#F0C685", "#E3A65A"],
  },
  chest: {
    name: "Teranga",
    strong: "#2F5E8C",
    tint: "rgba(40,88,140,0.44)",
    on: "#16324F",
    face: ["#CFE1F3", "#B2CDE7", "#93B5D9"],
  },
};
