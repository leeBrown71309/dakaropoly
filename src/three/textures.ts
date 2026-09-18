import * as THREE from "three";

const cache = new Map<string, THREE.CanvasTexture>();

function makeTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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
  return lines.slice(0, 3);
}

export function tileLabelTexture(name: string, price?: number): THREE.CanvasTexture {
  const key = `tile:${name}:${price ?? ""}`;
  return makeTexture(key, 256, 148, (ctx) => {
    ctx.clearRect(0, 0, 256, 148);
    ctx.textAlign = "center";
    ctx.fillStyle = "#3a352c";
    let size = 34;
    ctx.font = `bold ${size}px "Segoe UI", sans-serif`;
    let lines = wrapLines(ctx, name, 232);
    while (lines.length > 2 && size > 22) {
      size -= 2;
      ctx.font = `bold ${size}px "Segoe UI", sans-serif`;
      lines = wrapLines(ctx, name, 232);
    }
    const startY = lines.length === 1 ? 58 : lines.length === 2 ? 46 : 38;
    lines.forEach((l, i) => {
      ctx.fillText(l, 128, startY + i * (size + 4));
    });
    if (price !== undefined) {
      ctx.fillStyle = "#8a6d1f";
      ctx.font = 'bold 34px "Segoe UI", sans-serif';
      ctx.fillText(`${price} F`, 128, 132);
    }
  });
}

export function iconLabelTexture(emoji: string, name: string): THREE.CanvasTexture {
  const key = `corner:${emoji}:${name}`;
  return makeTexture(key, 256, 168, (ctx) => {
    ctx.clearRect(0, 0, 256, 168);
    ctx.textAlign = "center";
    ctx.font = '64px "Segoe UI Emoji", sans-serif';
    ctx.fillText(emoji, 128, 66);
    ctx.fillStyle = "#3a352c";
    let size = 26;
    ctx.font = `bold ${size}px "Segoe UI", sans-serif`;
    let lines = wrapLines(ctx, name, 224);
    while (lines.length > 2 && size > 18) {
      size -= 2;
      ctx.font = `bold ${size}px "Segoe UI", sans-serif`;
      lines = wrapLines(ctx, name, 224);
    }
    const startY = 96 + Math.max(0, 2 - lines.length) * 4;
    lines.slice(0, 2).forEach((l, i) => {
      ctx.fillText(l, 128, startY + i * (size + 4));
    });
  });
}

export function centerLogoTexture(): THREE.CanvasTexture {
  return makeTexture("center-logo", 512, 512, (ctx) => {
    ctx.clearRect(0, 0, 512, 512);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f4b83a";
    ctx.font = 'bold 92px "Segoe UI", sans-serif';
    ctx.fillText("DAKAR", 256, 200);
    ctx.fillText("OPOLY", 256, 300);
    ctx.fillStyle = "#f7ecd7";
    ctx.font = 'italic 44px "Georgia", serif';
    ctx.fillText("Sénégal", 256, 370);
    ctx.font = '52px "Segoe UI Emoji", sans-serif';
    ctx.fillText("🌴 🇸🇳 🌴", 256, 448);
  });
}

export function deckTexture(label: string, bg: string, fg: string): THREE.CanvasTexture {
  return makeTexture(`deck:${label}`, 256, 128, (ctx) => {
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 120, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.font = 'bold 40px "Segoe UI", sans-serif';
    ctx.fillText(label, 128, 74);
  });
}

export function dieFaceTexture(value: number): THREE.CanvasTexture {
  return makeTexture(`die:${value}`, 128, 128, (ctx) => {
    ctx.fillStyle = "#faf6ec";
    ctx.beginPath();
    ctx.roundRect(4, 4, 120, 120, 22);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#22201b";
    const spots: Record<number, [number, number][]> = {
      1: [[64, 64]],
      2: [[38, 38], [90, 90]],
      3: [[38, 38], [64, 64], [90, 90]],
      4: [[38, 38], [90, 38], [38, 90], [90, 90]],
      5: [[38, 38], [90, 38], [64, 64], [38, 90], [90, 90]],
      6: [[38, 34], [90, 34], [38, 64], [90, 64], [38, 94], [90, 94]],
    };
    for (const [x, y] of spots[value] as [number, number][]) {
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
