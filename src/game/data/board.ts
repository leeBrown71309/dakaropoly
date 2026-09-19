import type { ColorGroup, TileDef } from "../types";

export const BOARD: TileDef[] = [
  { kind: "go", pos: 0, name: "Départ" },
  { kind: "street", pos: 1, name: "Pikine", group: "brown", price: 60, houseCost: 50, rents: [2, 10, 30, 90, 160, 250] },
  { kind: "chest", pos: 2, name: "Teranga" },
  { kind: "street", pos: 3, name: "Guédiawaye", group: "brown", price: 60, houseCost: 50, rents: [4, 20, 60, 180, 320, 450] },
  { kind: "tax", pos: 4, name: "Impôt sur le revenu", taxAmount: 200 },
  { kind: "station", pos: 5, name: "Gare de Dakar", price: 200 },
  { kind: "street", pos: 6, name: "Parcelles Assainies", group: "lightblue", price: 100, houseCost: 50, rents: [6, 30, 90, 270, 400, 550] },
  { kind: "chance", pos: 7, name: "Baraka !" },
  { kind: "street", pos: 8, name: "Grand Yoff", group: "lightblue", price: 100, houseCost: 50, rents: [6, 30, 90, 270, 400, 550] },
  { kind: "street", pos: 9, name: "Ouest-Foire", group: "lightblue", price: 120, houseCost: 50, rents: [8, 40, 100, 300, 450, 600] },
  { kind: "jail", pos: 10, name: "Prison de Rebeuss" },
  { kind: "street", pos: 11, name: "Médina", group: "pink", price: 140, houseCost: 100, rents: [10, 50, 150, 450, 625, 750] },
  { kind: "utility", pos: 12, name: "SENELEC", price: 150 },
  { kind: "street", pos: 13, name: "Hann-Maristes", group: "pink", price: 140, houseCost: 100, rents: [10, 50, 150, 450, 625, 750] },
  { kind: "street", pos: 14, name: "Fass-Colobane", group: "pink", price: 160, houseCost: 100, rents: [12, 60, 180, 500, 700, 900] },
  { kind: "station", pos: 15, name: "Gare de Bel-Air", price: 200 },
  { kind: "street", pos: 16, name: "Sicap-Liberté", group: "orange", price: 180, houseCost: 100, rents: [14, 70, 200, 550, 750, 950] },
  { kind: "chest", pos: 17, name: "Teranga" },
  { kind: "street", pos: 18, name: "Grand Dakar", group: "orange", price: 180, houseCost: 100, rents: [14, 70, 200, 550, 750, 950] },
  { kind: "street", pos: 19, name: "Ouakam", group: "orange", price: 200, houseCost: 100, rents: [16, 80, 220, 600, 800, 1000] },
  { kind: "free", pos: 20, name: "Parking gratuit" },
  { kind: "street", pos: 21, name: "Yoff", group: "red", price: 220, houseCost: 150, rents: [18, 90, 250, 700, 875, 1050] },
  { kind: "chance", pos: 22, name: "Baraka !" },
  { kind: "street", pos: 23, name: "Sacré-Cœur", group: "red", price: 220, houseCost: 150, rents: [18, 90, 250, 700, 875, 1050] },
  { kind: "street", pos: 24, name: "Mermoz", group: "red", price: 240, houseCost: 150, rents: [20, 100, 300, 750, 925, 1100] },
  { kind: "station", pos: 25, name: "Gare de Ouakam", price: 200 },
  { kind: "street", pos: 26, name: "Point E", group: "yellow", price: 260, houseCost: 150, rents: [22, 110, 330, 800, 975, 1150] },
  { kind: "street", pos: 27, name: "Fann", group: "yellow", price: 260, houseCost: 150, rents: [22, 110, 330, 800, 975, 1150] },
  { kind: "utility", pos: 28, name: "SDE", price: 150 },
  { kind: "street", pos: 29, name: "Plateau", group: "yellow", price: 280, houseCost: 150, rents: [24, 120, 360, 850, 1025, 1200] },
  { kind: "goto-jail", pos: 30, name: "Aller en prison" },
  { kind: "street", pos: 31, name: "Les Mamelles", group: "green", price: 300, houseCost: 200, rents: [26, 130, 390, 900, 1100, 1275] },
  { kind: "street", pos: 32, name: "Baobab", group: "green", price: 300, houseCost: 200, rents: [26, 130, 390, 900, 1100, 1275] },
  { kind: "chest", pos: 33, name: "Teranga" },
  { kind: "street", pos: 34, name: "Fann Résidence", group: "green", price: 320, houseCost: 200, rents: [28, 150, 450, 1000, 1200, 1400] },
  // "Gare des Almadies", not "Station Almadies": the other three are gares du
  // TER, and the odd one out read as a different kind of thing on a board
  // where the kind is the whole point.
  { kind: "station", pos: 35, name: "Gare des Almadies", price: 200 },
  { kind: "chance", pos: 36, name: "Baraka !" },
  { kind: "street", pos: 37, name: "Ngor", group: "darkblue", price: 350, houseCost: 200, rents: [35, 175, 500, 1100, 1300, 1500] },
  { kind: "tax", pos: 38, name: "Taxe de luxe", taxAmount: 100 },
  { kind: "street", pos: 39, name: "Almadies", group: "darkblue", price: 400, houseCost: 200, rents: [50, 200, 600, 1400, 1700, 2000] },
];

export const GO_POS = 0;
export const JAIL_POS = 10;
export const STATION_POS = [5, 15, 25, 35];
export const UTILITY_POS = [12, 28];
export const STATION_RENTS = [25, 50, 100, 200];

export const GROUP_MEMBERS: Record<ColorGroup, number[]> = {
  brown: [1, 3],
  lightblue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  darkblue: [37, 39],
};

export const GROUP_ORDER: ColorGroup[] = [
  "brown",
  "lightblue",
  "pink",
  "orange",
  "red",
  "yellow",
  "green",
  "darkblue",
];

export function tileAt(pos: number): TileDef {
  return BOARD[pos] as TileDef;
}

export function isOwnable(kind: TileDef["kind"]): boolean {
  return kind === "street" || kind === "station" || kind === "utility";
}
