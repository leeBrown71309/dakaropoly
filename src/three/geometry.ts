/**
 * Board grid.
 *
 * A standard Monopoly side is two 2×2 corners with nine 1×2 tiles between
 * them, so the board is exactly 13 units square: corners at ±5.5, the ring
 * two units deep, and a 9×9 centre field inside ±4.5.
 */
export const HALF = 6.5;
/** Depth of the tile ring, measured inwards from the board edge. */
export const RING = 2;
/** Half-size of the centre field. */
export const INNER = HALF - RING;
/** Width of a regular (non-corner) tile along the edge it sits on. */
export const TILE_W = 1;
/** Depth of the colour band printed at the inner edge of a street. */
export const BAND_DEPTH = 0.42;
/** Top surface of the board, in world units. */
export const BOARD_TOP = 0;

export type Side = 0 | 1 | 2 | 3;

export interface TileCell {
  /** Centre of the cell. */
  x: number;
  z: number;
  /** Footprint along each axis. */
  w: number;
  d: number;
  side: Side;
  corner: boolean;
}

const CORNER = HALF - RING / 2; // 5.5

/**
 * Cell occupied by a board position. Sides run clockwise from the bottom
 * edge of the screen: 0 bottom, 1 left, 2 top, 3 right.
 */
export function tileCell(pos: number): TileCell {
  if (pos === 0) return { x: CORNER, z: CORNER, w: RING, d: RING, side: 0, corner: true };
  if (pos === 10) return { x: -CORNER, z: CORNER, w: RING, d: RING, side: 1, corner: true };
  if (pos === 20) return { x: -CORNER, z: -CORNER, w: RING, d: RING, side: 2, corner: true };
  if (pos === 30) return { x: CORNER, z: -CORNER, w: RING, d: RING, side: 3, corner: true };

  if (pos >= 1 && pos <= 9) {
    return { x: 5 - pos, z: CORNER, w: TILE_W, d: RING, side: 0, corner: false };
  }
  if (pos >= 11 && pos <= 19) {
    return { x: -CORNER, z: 15 - pos, w: RING, d: TILE_W, side: 1, corner: false };
  }
  if (pos >= 21 && pos <= 29) {
    return { x: pos - 25, z: -CORNER, w: TILE_W, d: RING, side: 2, corner: false };
  }
  return { x: CORNER, z: pos - 35, w: RING, d: TILE_W, side: 3, corner: false };
}

/** Unit vector pointing from the centre of the board towards a side. */
export const OUTWARD: Record<Side, [number, number]> = {
  0: [0, 1],
  1: [-1, 0],
  2: [0, -1],
  3: [1, 0],
};

/** Centre of the colour band printed at a street's inner edge. */
export function bandCenter(pos: number): [number, number] {
  const cell = tileCell(pos);
  const [ox, oz] = OUTWARD[cell.side];
  const inset = RING / 2 - BAND_DEPTH / 2;
  return [cell.x - ox * inset, cell.z - oz * inset];
}

/**
 * Where tokens stand: in the outer half of the tile, clear of the colour
 * band and of any houses built on it.
 */
export function pawnWorldPos(pos: number, slot: number, total: number): [number, number] {
  const cell = tileCell(pos);
  const [ox, oz] = OUTWARD[cell.side];
  const push = cell.corner ? 0.1 : 0.4;
  const spread = total <= 1 ? 0 : 0.26;
  const angle = (slot / Math.max(total, 1)) * Math.PI * 2;
  return [
    cell.x + ox * push + Math.cos(angle) * spread,
    cell.z + oz * push + Math.sin(angle) * spread,
  ];
}

/** Axis houses are laid out along for a given side. */
export function housesAxis(side: Side): "x" | "z" {
  return side === 0 || side === 2 ? "x" : "z";
}

/**
 * World height of the printed board surface — the plane tokens, dice and
 * buildings all rest on. Kept here so the board group offset is defined in
 * exactly one place.
 */
export const BOARD_GROUP_Y = -0.4;
export const BOARD_SURFACE_H = 0.07;
export const BOARD_SURFACE_Y = BOARD_GROUP_Y + BOARD_SURFACE_H;
