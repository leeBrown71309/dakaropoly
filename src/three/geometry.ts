export interface TileCenter {
  x: number;
  z: number;
  side: 0 | 1 | 2 | 3;
}

export function tileCenter(pos: number): TileCenter {
  const C = 5.5;
  if (pos === 0) return { x: C, z: C, side: 0 };
  if (pos === 10) return { x: -C, z: C, side: 1 };
  if (pos === 20) return { x: -C, z: -C, side: 2 };
  if (pos === 30) return { x: C, z: -C, side: 3 };
  if (pos >= 1 && pos <= 9) return { x: 4.5 - (pos - 1), z: C, side: 0 };
  if (pos >= 11 && pos <= 19) return { x: -C, z: 4.5 - (pos - 11), side: 1 };
  if (pos >= 21 && pos <= 29) return { x: -4.5 + (pos - 21), z: -C, side: 2 };
  return { x: C, z: -4.5 + (pos - 31), side: 3 };
}

interface Layout {
  dims: [number, number, number];
  band: [number, number];
  bandSize: [number, number, number];
  label: [number, number];
  labelRot: number;
  anchor: [number, number];
  houses: [number, number];
  housesAxis: "x" | "z";
}

export const SIDE_LAYOUT: Record<0 | 1 | 2 | 3, Layout> = {
  0: { dims: [1, 0.12, 2], band: [0, 0.66], bandSize: [1, 0.15, 0.7], label: [0, -0.35], labelRot: 0, anchor: [0, -0.85], houses: [0, 0.28], housesAxis: "x" },
  1: { dims: [2, 0.12, 1], band: [-0.65, 0], bandSize: [0.7, 0.15, 1], label: [0.35, 0], labelRot: 0, anchor: [0.85, 0], houses: [-0.28, 0], housesAxis: "z" },
  2: { dims: [1, 0.12, 2], band: [0, -0.65], bandSize: [1, 0.15, 0.7], label: [0, 0.35], labelRot: 0, anchor: [0, 0.85], houses: [0, -0.28], housesAxis: "x" },
  3: { dims: [2, 0.12, 1], band: [0.65, 0], bandSize: [0.7, 0.15, 1], label: [-0.35, 0], labelRot: 0, anchor: [-0.85, 0], houses: [0.28, 0], housesAxis: "z" },
};

export function pawnWorldPos(pos: number, slot: number, total: number): [number, number] {
  const geo = tileCenter(pos);
  const layout = SIDE_LAYOUT[geo.side];
  const r = total <= 1 ? 0 : 0.24;
  const angle = (slot / total) * Math.PI * 2;
  return [
    geo.x + layout.anchor[0] + Math.cos(angle) * r,
    geo.z + layout.anchor[1] + Math.sin(angle) * r,
  ];
}
