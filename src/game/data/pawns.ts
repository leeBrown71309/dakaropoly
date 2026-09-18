/**
 * The eight tokens. Each one is a real Senegalese object with a silhouette
 * distinct enough to be read at pawn scale, both as a 2D glyph in the HUD
 * and as a 3D model on the board.
 */
export type PawnShape =
  | "taxi"
  | "pirogue"
  | "baobab"
  | "lion"
  | "peanut"
  | "djembe"
  | "monument"
  | "teapot";

export const PAWN_SHAPES: PawnShape[] = [
  "taxi",
  "pirogue",
  "baobab",
  "lion",
  "peanut",
  "djembe",
  "monument",
  "teapot",
];

export const PAWN_NAMES: string[] = [
  "Taxi",
  "Pirogue",
  "Baobab",
  "Lion",
  "Arachide",
  "Djembé",
  "Monument",
  "Théière",
];

/**
 * Silhouettes, drawn once on a 32×32 grid and used twice: as the flat glyph
 * in the HUD, and extruded with a bevel into the 3D token on the board. A
 * single source keeps the piece you pick identical to the piece you move.
 *
 * Each entry is a list of closed sub-paths; they must stay solid (no holes)
 * so the extrusion reads as one carved object.
 */
export const PAWN_SILHOUETTES: Record<PawnShape, string[]> = {
  taxi: [
    "M3.6 19.8v-3.3c0-1.05.74-1.96 1.77-2.17l2.6-.54 2.86-3.87a2.8 2.8 0 0 1 2.25-1.14h6.84c.89 0 1.72.42 2.25 1.14l2.86 3.87 2.6.54a2.21 2.21 0 0 1 1.77 2.17v3.3c0 .58-.47 1.05-1.05 1.05H5.25c-.91 0-1.65-.47-1.65-1.05z",
    "M9.6 17.6a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z",
    "M22.4 17.6a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z",
    "M12.9 4.4h6.2c.66 0 1.2.54 1.2 1.2v2.2h-8.6V5.6c0-.66.54-1.2 1.2-1.2z",
  ],
  pirogue: [
    "M2.4 18.2h27.2c-.7 4.6-5.1 7.2-13.6 7.2S3.1 22.8 2.4 18.2z",
    "M14.9 4.2h1.9c.5 0 .9.4.9.9v12.2h-3.7V5.1c0-.5.4-.9.9-.9z",
    "M18.9 6.8 26 16.4c.3.4 0 .9-.5.9h-6.6V6.8z",
  ],
  baobab: [
    "M9.2 30c0-8.8 1.5-15 4.2-19h5.2c2.7 4 4.2 10.2 4.2 19z",
    "M14.2 12.9 5.3 8.5 4.2 10.7l8.7 4.3z",
    "M14.9 11.7 10.1 3.6 8 4.9l4.6 7.9z",
    "M14.85 11.2V2.4h2.3v8.8z",
    "M17.1 11.7 21.9 3.6 24 4.9l-4.6 7.9z",
    "M17.8 12.9l8.9-4.4 1.1 2.2-8.7 4.3z",
  ],
  lion: [
    "M8.8 14.4c0-1.15.93-2.08 2.08-2.08h11.4c1.15 0 2.08.93 2.08 2.08v4.3c0 1.15-.93 2.08-2.08 2.08h-11.4c-1.15 0-2.08-.93-2.08-2.08z",
    "M23.8 7.2a5.4 5.4 0 1 1 0 10.8 5.4 5.4 0 0 1 0-10.8z",
    "M20.4 7.4 21.3 4.3l2.4 2.1z",
    "M27.4 10.9h3.6c.55 0 1 .45 1 1v2.5c0 .55-.45 1-1 1h-3.6z",
    "M10.4 21.2a1.15 1.15 0 0 1 2.3 0v5.6a1.15 1.15 0 0 1-2.3 0z",
    "M13.6 21.2a1.15 1.15 0 0 1 2.3 0v5.6a1.15 1.15 0 0 1-2.3 0z",
    "M19.2 21.2a1.15 1.15 0 0 1 2.3 0v5.6a1.15 1.15 0 0 1-2.3 0z",
    "M22.2 21.2a1.15 1.15 0 0 1 2.3 0v5.6a1.15 1.15 0 0 1-2.3 0z",
    "M9.4 15.6c-2.9.5-4.7 2.3-5.2 5.2-.22 1.35.3 2.5 1.35 2.8l.62-2.4c-.3-1.55.72-2.7 2.38-3z",
    "M4.6 22.7a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5z",
  ],
  peanut: [
    "M16 3.4c3.55 0 6.15 2.6 6.15 6 0 2-.9 3.35-1.6 4.45-.6 1-.9 1.6-.9 2.6s.3 1.6.9 2.6c.7 1.1 1.6 2.45 1.6 4.45 0 3.4-2.6 6-6.15 6s-6.15-2.6-6.15-6c0-2 .9-3.35 1.6-4.45.6-1 .9-1.6.9-2.6s-.3-1.6-.9-2.6c-.7-1.1-1.6-2.45-1.6-4.45 0-3.4 2.6-6 6.15-6z",
  ],
  djembe: [
    "M5.1 4.3h21.8c.72 0 1.3.58 1.3 1.3v1.5c0 .72-.58 1.3-1.3 1.3H5.1c-.72 0-1.3-.58-1.3-1.3V5.6c0-.72.58-1.3 1.3-1.3z",
    "M5.9 9.1h20.2l-2.7 8.7a5.2 5.2 0 0 1-2.1 2.8l-1.5 1h-7.6l-1.5-1a5.2 5.2 0 0 1-2.1-2.8z",
    "M12.4 22.3h7.2v3.5l2.9 2.3c.75.6.33 1.8-.64 1.8H10.14c-.97 0-1.39-1.2-.64-1.8l2.9-2.3z",
  ],
  monument: [
    "M5.4 26.6h21.2l1.6 3.4H3.8z",
    "M13.2 5.4a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8z",
    "M11.1 11.9h4.4c1.3 0 2.4 1 2.55 2.3l1.25 11h-4.4l-.5-6.4-1 6.4H9l1.1-8.6-1.9 3.6-2.4-1.1 2.9-5.7c.5-.95 1.4-1.5 2.4-1.5z",
    "M18.9 12.6l6.1-5.9 2.1 2.2-5.4 5.2z",
    "M26.3 2.8a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6z",
  ],
  teapot: [
    "M4.9 12.9h14.6v5.1a6.3 6.3 0 0 1-6.3 6.3h-2a6.3 6.3 0 0 1-6.3-6.3z",
    "M19.9 14.6 26.8 9.1v10.3l-6.9-3z",
    "M9.4 12.9v-1.3a2.8 2.8 0 0 1 5.6 0v1.3z",
    "M11.3 6.6h1.8c.5 0 .9.4.9.9v1.5h-3.6V7.5c0-.5.4-.9.9-.9z",
    "M5.6 25.6h13.2c.6 0 1 .45 1 1s-.4 1-1 1H5.6c-.6 0-1-.45-1-1s.4-1 1-1z",
  ],
};

/** Grid the silhouette paths are drawn on. */
export const PAWN_VIEWBOX = 32;

/**
 * Gouache palette — muted and warm so the tokens sit inside the sand and
 * terracotta board instead of glowing on top of it.
 */
export const PLAYER_COLORS = [
  "#D9812C", // safran
  "#2E7F8C", // lagon
  "#BC4A3C", // terre cuite
  "#5E8C3F", // palmier
  "#7B5BA6", // bissap
  "#C25A8D", // hibiscus
  "#3B6BA5", // indigo
  "#8A6A3A", // kola
];
