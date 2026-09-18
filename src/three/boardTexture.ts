import * as THREE from "three";
import { BOARD } from "../game/data/board";
import { GROUP_COLORS } from "../game/colors";
import type { TileDef } from "../game/types";
import { OUTLINE_PATHS, type OutlineName } from "../ui/icons/paths";
import { HALF, RING, INNER, BAND_DEPTH, tileCell, OUTWARD } from "./geometry";

/**
 * The board is printed, not assembled.
 *
 * Every static mark — tile fields, colour bands, names, prices, icons,
 * corners and the centre wordmark — is drawn once into a single canvas that
 * is mapped over the whole playing surface. Only the things that change
 * during a game (owner pips, houses, mortgage marks, decks) stay as meshes.
 */
const SIZE = 2048;
const PPU = SIZE / (HALF * 2);

const INK = "#23201C";
const INK_SOFT = "#6B6152";
const PRICE_INK = "#8A6A3A";
const PAPER = "#F3E9D4";
const FIELD = "#17554F";
const KEYLINE = "rgba(58,48,34,0.45)";
const SEPARATOR = "rgba(58,48,34,0.34)";

const SANS = '"Archivo Variable", "Segoe UI", sans-serif';
const SERIF = '"Fraunces Variable", Georgia, serif';

const toU = (x: number): number => (x + HALF) * PPU;
const toV = (z: number): number => (z + HALF) * PPU;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Converts a world-space axis-aligned box into canvas pixels. */
function rectOf(x0: number, z0: number, x1: number, z1: number): Rect {
  return { x: toU(x0), y: toV(z0), w: (x1 - x0) * PPU, h: (z1 - z0) * PPU };
}

function cellRect(pos: number): Rect {
  const c = tileCell(pos);
  return rectOf(c.x - c.w / 2, c.z - c.d / 2, c.x + c.w / 2, c.z + c.d / 2);
}

/** The colour band strip at a street's inner edge. */
function bandRect(pos: number): Rect {
  const c = tileCell(pos);
  const [ox, oz] = OUTWARD[c.side];
  if (ox === 0) {
    const inner = c.z - (oz * RING) / 2;
    const outer = inner + oz * BAND_DEPTH;
    return rectOf(c.x - c.w / 2, Math.min(inner, outer), c.x + c.w / 2, Math.max(inner, outer));
  }
  const inner = c.x - (ox * RING) / 2;
  const outer = inner + ox * BAND_DEPTH;
  return rectOf(Math.min(inner, outer), c.z - c.d / 2, Math.max(inner, outer), c.z + c.d / 2);
}

/** The area left for text once the colour band is taken out. */
function contentRect(pos: number, hasBand: boolean): Rect {
  const c = tileCell(pos);
  const [ox, oz] = OUTWARD[c.side];
  const eaten = hasBand ? BAND_DEPTH : 0;
  const pad = 0.06;

  if (ox === 0) {
    const innerEdge = c.z - (oz * RING) / 2 + oz * eaten;
    const outerEdge = c.z + (oz * RING) / 2;
    const z0 = Math.min(innerEdge, outerEdge) + pad;
    const z1 = Math.max(innerEdge, outerEdge) - pad;
    return rectOf(c.x - c.w / 2 + pad, z0, c.x + c.w / 2 - pad, z1);
  }
  const innerEdge = c.x - (ox * RING) / 2 + ox * eaten;
  const outerEdge = c.x + (ox * RING) / 2;
  const x0 = Math.min(innerEdge, outerEdge) + pad;
  const x1 = Math.max(innerEdge, outerEdge) - pad;
  return rectOf(x0, c.z - c.d / 2 + pad, x1, c.z + c.d / 2 - pad);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface TextOptions {
  font: string;
  color: string;
  max: number;
  min: number;
  tracking?: number;
  upper?: boolean;
  weight?: number;
}

/**
 * Draws text centred in a rect, shrinking until it fits on at most three
 * lines. Always upright: the whole board is read from one seat.
 */
function drawFitted(ctx: CanvasRenderingContext2D, text: string, rect: Rect, o: TextOptions): number {
  const label = o.upper ? text.toUpperCase() : text;
  let size = o.max;
  let lines: string[] = [];

  for (;;) {
    ctx.font = `${o.weight ?? 700} ${size}px ${o.font}`;
    lines = wrap(ctx, label, rect.w);
    const fits = lines.length * size * 1.16 <= rect.h && lines.every((l) => ctx.measureText(l).width <= rect.w);
    if (fits || size <= o.min) break;
    size -= 1;
  }

  ctx.fillStyle = o.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (o.tracking) ctx.letterSpacing = `${o.tracking}px`;

  const lineHeight = size * 1.16;
  const startY = rect.y + rect.h / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, rect.x + rect.w / 2, startY + i * lineHeight);
  });
  ctx.letterSpacing = "0px";
  return lines.length * lineHeight;
}

/** Stamps a shared icon outline, scaled from its 24-unit grid. */
function drawOutline(
  ctx: CanvasRenderingContext2D,
  name: OutlineName,
  cx: number,
  cy: number,
  size: number,
  color: string,
  weight = 1.7,
): void {
  const scale = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const d of OUTLINE_PATHS[name]) ctx.stroke(new Path2D(d));
  ctx.restore();
}

function fillRect(ctx: CanvasRenderingContext2D, r: Rect, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

function strokeRect(ctx: CanvasRenderingContext2D, r: Rect, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
}

const DECK_ICON: Record<string, OutlineName> = { chance: "cowrie", chest: "teapot" };

function drawStreet(ctx: CanvasRenderingContext2D, pos: number, tile: TileDef): void {
  if (tile.group) {
    const band = bandRect(pos);
    fillRect(ctx, band, GROUP_COLORS[tile.group]);
    strokeRect(ctx, band, "rgba(35,32,28,0.5)", 2);
  }

  const area = contentRect(pos, true);
  const nameArea: Rect = { ...area, h: area.h * 0.66 };
  const priceArea: Rect = { x: area.x, y: area.y + area.h * 0.7, w: area.w, h: area.h * 0.3 };

  drawFitted(ctx, tile.name, nameArea, {
    font: SANS,
    color: INK,
    max: 27,
    min: 15,
    upper: true,
    tracking: 0.5,
  });
  if (tile.price !== undefined) {
    drawFitted(ctx, `${tile.price} F`, priceArea, { font: SANS, color: PRICE_INK, max: 23, min: 14 });
  }
}

function drawIconTile(
  ctx: CanvasRenderingContext2D,
  pos: number,
  tile: TileDef,
  icon: OutlineName,
  color: string,
  subtitle?: string,
): void {
  const area = contentRect(pos, false);
  const short = Math.min(area.w, area.h);
  const iconSize = short * 0.46;

  drawOutline(ctx, icon, area.x + area.w / 2, area.y + area.h * 0.28, iconSize, color, 1.8);

  const nameArea: Rect = { x: area.x, y: area.y + area.h * 0.48, w: area.w, h: area.h * 0.3 };
  drawFitted(ctx, tile.name, nameArea, {
    font: SANS,
    color: INK,
    max: 25,
    min: 14,
    upper: true,
    tracking: 0.5,
  });

  const footer = subtitle ?? (tile.price !== undefined ? `${tile.price} F` : undefined);
  if (footer) {
    const footArea: Rect = { x: area.x, y: area.y + area.h * 0.8, w: area.w, h: area.h * 0.2 };
    drawFitted(ctx, footer, footArea, { font: SANS, color: PRICE_INK, max: 22, min: 13 });
  }
}

function drawCorner(ctx: CanvasRenderingContext2D, pos: number, tile: TileDef): void {
  const area = contentRect(pos, false);
  const cx = area.x + area.w / 2;

  const art: Record<string, { icon: OutlineName; color: string; note?: string }> = {
    go: { icon: "arrowLeft", color: "#B87620", note: "Recevez 200 F" },
    jail: { icon: "jail", color: "#8E4526", note: "Simple visite" },
    free: { icon: "coins", color: "#1E6F6B", note: "Repos" },
    "goto-jail": { icon: "police", color: "#8E4526", note: "Sans passer par le Départ" },
  };
  const spec = art[tile.kind];
  if (!spec) return;

  drawOutline(ctx, spec.icon, cx, area.y + area.h * 0.3, area.h * 0.3, spec.color, 1.7);

  drawFitted(
    ctx,
    tile.name,
    { x: area.x, y: area.y + area.h * 0.52, w: area.w, h: area.h * 0.24 },
    { font: SERIF, color: INK, max: 38, min: 20, weight: 600 },
  );

  if (spec.note) {
    drawFitted(
      ctx,
      spec.note,
      { x: area.x, y: area.y + area.h * 0.78, w: area.w, h: area.h * 0.16 },
      { font: SANS, color: INK_SOFT, max: 20, min: 12, upper: true, tracking: 1.2 },
    );
  }
}

function drawCentre(ctx: CanvasRenderingContext2D): void {
  const field = rectOf(-INNER, -INNER, INNER, INNER);
  fillRect(ctx, field, FIELD);

  // Printed keyline just inside the field
  const inset = 0.16 * PPU;
  ctx.strokeStyle = "rgba(240,214,159,0.30)";
  ctx.lineWidth = 3;
  ctx.strokeRect(field.x + inset, field.y + inset, field.w - inset * 2, field.h - inset * 2);

  const cx = field.x + field.w / 2;
  const cy = field.y + field.h * 0.36;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#E8A23B";
  ctx.font = `700 126px ${SERIF}`;
  ctx.fillText("DAKAR", cx, cy - 76);
  ctx.fillText("OPOLY", cx, cy + 50);

  ctx.fillStyle = "rgba(245,237,221,0.62)";
  ctx.font = `600 31px ${SANS}`;
  ctx.letterSpacing = "13px";
  ctx.fillText("SÉNÉGAL", cx, cy + 140);
  ctx.letterSpacing = "0px";

  ctx.strokeStyle = "rgba(240,214,159,0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 148, cy + 108);
  ctx.lineTo(cx + 148, cy + 108);
  ctx.stroke();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D): void {
  // Paper ring
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // A touch of shading towards the outer edge, so the ring is not dead flat
  const edge = ctx.createLinearGradient(0, 0, 0, SIZE);
  edge.addColorStop(0, "rgba(160,132,84,0.16)");
  edge.addColorStop(0.5, "rgba(160,132,84,0)");
  edge.addColorStop(1, "rgba(160,132,84,0.16)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, SIZE, SIZE);

  drawCentre(ctx);

  // Outer printed rules
  strokeRect(ctx, rectOf(-HALF + 0.04, -HALF + 0.04, HALF - 0.04, HALF - 0.04), KEYLINE, 5);
  strokeRect(ctx, rectOf(-INNER, -INNER, INNER, INNER), KEYLINE, 4);

  BOARD.forEach((tile, pos) => {
    const cell = tileCell(pos);
    const rect = cellRect(pos);

    if (!cell.corner) {
      fillRect(ctx, rect, PAPER);
      // Very light shading across each tile so the ring is not dead flat
      const shade = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      shade.addColorStop(0, "rgba(255,255,255,0.32)");
      shade.addColorStop(1, "rgba(196,170,120,0.16)");
      ctx.fillStyle = shade;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    strokeRect(ctx, rect, SEPARATOR, 2.5);

    switch (tile.kind) {
      case "street":
        drawStreet(ctx, pos, tile);
        break;
      case "station":
        drawIconTile(ctx, pos, tile, "train", "#2F2A22");
        break;
      case "utility":
        drawIconTile(ctx, pos, tile, tile.name.includes("SDE") ? "droplet" : "bolt", "#1E6F6B");
        break;
      case "tax":
        drawIconTile(ctx, pos, tile, "coins", "#8E4526", `${tile.taxAmount} F`);
        break;
      case "chance":
      case "chest":
        drawIconTile(ctx, pos, tile, DECK_ICON[tile.kind] ?? "cowrie", tile.kind === "chance" ? "#A8701F" : "#1E6F6B", "");
        break;
      default:
        drawCorner(ctx, pos, tile);
    }
  });
}

/**
 * Builds the printed surface. Call again once webfonts have loaded — the
 * first pass may otherwise be set in a fallback face.
 */
export function createBoardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
