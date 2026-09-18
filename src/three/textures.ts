import * as THREE from "three";

/**
 * Small canvas textures for objects that sit on the board. The board surface
 * itself is drawn in `boardTexture.ts`.
 */
const cache = new Map<string, THREE.CanvasTexture>();

function makeTexture(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  draw(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(key, texture);
  return texture;
}

/** Top card of a deck, printed with the deck's name. */
export function deckTexture(label: string, bg: string, fg: string): THREE.CanvasTexture {
  return makeTexture(`deck:${label}`, 384, 248, (ctx) => {
    ctx.clearRect(0, 0, 384, 248);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(5, 5, 374, 238, 12);
    ctx.fill();

    ctx.strokeStyle = "rgba(35,32,28,0.35)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = `${fg}55`;
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 344, 208);

    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '600 66px "Fraunces Variable", Georgia, serif';
    ctx.fillText(label, 192, 124);
  });
}

/** One face of a die, drawn at the pip layout for its value. */
export function dieFaceTexture(value: number): THREE.CanvasTexture {
  return makeTexture(`die:${value}`, 128, 128, (ctx) => {
    ctx.fillStyle = "#FBF6EA";
    ctx.beginPath();
    ctx.roundRect(2, 2, 124, 124, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(90,70,45,0.25)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#2B2620";
    const spots: Record<number, [number, number][]> = {
      1: [[64, 64]],
      2: [[40, 40], [88, 88]],
      3: [[40, 40], [64, 64], [88, 88]],
      4: [[40, 40], [88, 40], [40, 88], [88, 88]],
      5: [[40, 40], [88, 40], [64, 64], [40, 88], [88, 88]],
      6: [[38, 36], [90, 36], [38, 64], [90, 64], [38, 92], [90, 92]],
    };
    for (const [x, y] of spots[value] ?? []) {
      ctx.beginPath();
      ctx.arc(x, y, 11.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
