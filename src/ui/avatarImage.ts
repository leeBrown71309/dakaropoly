/**
 * Turning a picture into a profile photo: a centred square, 128 px on a
 * side, as a data URL.
 *
 * There is no file store — a photo is a string in the profile, copied to the
 * roster whenever its owner sits down — so it has to be small. 128 px covers
 * the largest place a photo is drawn at on a high-density screen, and WebP
 * keeps it to a few kilobytes. Safari draws WebP but cannot encode it, and
 * quietly hands back a PNG when asked to; JPEG is the fallback there.
 *
 * The cap mirrors `profiles_avatar_shape` in `supabase/schema.sql`.
 */
const SIZE = 128;
export const AVATAR_MAX_CHARS = 60_000;

/** The board's paper, behind a transparent picture that becomes a JPEG. */
const BACKDROP = "#F3E7CF";

function load(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = src;
  });
}

function encode(canvas: HTMLCanvasElement): string {
  for (const quality of [0.85, 0.7, 0.55]) {
    let url = canvas.toDataURL("image/webp", quality);
    if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= AVATAR_MAX_CHARS) return url;
  }
  throw new Error("Cette image est trop lourde, même réduite");
}

function draw(img: HTMLImageElement): string {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error("Image illisible");
  const side = Math.min(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le navigateur ne sait pas redimensionner l'image");
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return encode(canvas);
}

/** A picture chosen on the device. */
export async function fileToAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Ce fichier n'est pas une image");
  const url = URL.createObjectURL(file);
  try {
    return draw(await load(url, false));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The photo on the Google account. Google serves it small by default and
 * says so in the address (`=s96-c`); asking for more gives the square room
 * to shrink cleanly. If the image host refuses to share its pixels across
 * origins, the canvas is tainted and cannot be read back — that is reported
 * as a failure, and the profile simply starts without a photo.
 */
export async function urlToAvatar(url: string): Promise<string> {
  const larger = url.replace(/=s\d+(-c)?$/u, "=s256-c");
  try {
    return draw(await load(larger, true));
  } catch {
    throw new Error("La photo Google n'a pas pu être récupérée");
  }
}
