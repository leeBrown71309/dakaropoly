/**
 * Icon outlines as plain path data on a 24 grid.
 *
 * Kept free of JSX so the same strokes can be rendered as SVG in the HUD and
 * as `Path2D` on the printed board texture — one icon language everywhere.
 */
export const OUTLINE_PATHS = {
  /** "Baraka" deck — a cowrie shell. */
  cowrie: [
    "M12 3.4c3.55 0 6.4 3.85 6.4 8.6s-2.85 8.6-6.4 8.6-6.4-3.85-6.4-8.6S8.45 3.4 12 3.4z",
    "M12 6.6v10.8",
    "M10.5 9.1h3M10.5 12h3M10.5 14.9h3",
  ],
  /** "Teranga" deck — an ataya teapot. */
  teapot: [
    "M4.9 11.2h10.4v3.6a4.6 4.6 0 0 1-4.6 4.6H9.5a4.6 4.6 0 0 1-4.6-4.6z",
    "M15.3 12.4 19.6 9v6.4l-4.3-2.2",
    "M8.6 11.2V9.9a1.9 1.9 0 0 1 1.9-1.9h0",
    "M10.5 8V6.3",
    "M6.2 19.4h8",
  ],
  /** Prison bars. */
  jail: ["M3.8 3.8h16.4v16.4H3.8z", "M9.3 3.8v16.4M14.7 3.8v16.4"],
  coins: [
    "M12 4a6.9 2.9 0 1 1 0 5.8 6.9 2.9 0 0 1 0-5.8z",
    "M5.1 6.9v4.8c0 1.6 3.09 2.9 6.9 2.9s6.9-1.3 6.9-2.9V6.9",
    "M5.1 11.7v4.8c0 1.6 3.09 2.9 6.9 2.9s6.9-1.3 6.9-2.9v-4.8",
  ],
  /** TER station. */
  train: [
    "M6.6 3.8h10.8a2.6 2.6 0 0 1 2.6 2.6v8.2a2.6 2.6 0 0 1-2.6 2.6H6.6A2.6 2.6 0 0 1 4 14.6V6.4a2.6 2.6 0 0 1 2.6-2.6z",
    "M4 9.6h16",
    "M8.4 13.4h7.2",
    "M7.8 17.2 5.6 20.8M16.2 17.2l2.2 3.6",
  ],
  /** SENELEC — electricity. */
  bolt: ["M13.8 2.6 6 13.6h5.2l-1.4 8 8-11.2h-5.2z"],
  /** SDE — water. */
  droplet: ["M12 3c3.7 4.3 6.1 7.6 6.1 10.4a6.1 6.1 0 1 1-12.2 0C5.9 10.6 8.3 7.3 12 3z"],
  /** Direction of travel, printed on the Go corner. */
  arrowLeft: ["M20.4 12H5.2", "M11.2 5.8 5 12l6.2 6.2"],
  /** Sent to jail. */
  police: [
    "M12 3.2 19.4 6v6.2c0 4.2-3 7.6-7.4 8.6-4.4-1-7.4-4.4-7.4-8.6V6z",
    "M8.6 11.6h6.8M12 8.2v6.8",
  ],
} as const;

export type OutlineName = keyof typeof OUTLINE_PATHS;
