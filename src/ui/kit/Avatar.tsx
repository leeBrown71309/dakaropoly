import { GROUP_COLORS, GROUP_ON_COLOR } from "../../game/colors";
import type { ColorGroup } from "../../game/types";

interface AvatarProps {
  /** A data URL, or `null` for somebody without a photo. */
  src: string | null;
  /** Whose face this is: the initial comes from it, and so does the colour. */
  name: string;
  size: number;
  /** A keyline in the player's colour, which is what ties a face to a pawn. */
  ring?: string;
  className?: string;
}

const GROUPS = Object.keys(GROUP_COLORS) as ColorGroup[];

/**
 * The same name always lands on the same colour, so a player without a
 * photo is still recognisable from one game to the next.
 */
function groupFor(name: string): ColorGroup {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
  return GROUPS[hash % GROUPS.length] as ColorGroup;
}

/**
 * A person's face: their photo, or the initial of their name set on one of
 * the board's group colours. Nothing is fetched — the photo is a string the
 * profile carries, and the fallback is type on a disc.
 *
 * Decorative by design (`alt=""`): it always sits beside the name it stands
 * for, and reading "photo de Moussa, Moussa" aloud helps nobody.
 */
export function Avatar({ src, name, size, ring, className = "" }: AvatarProps) {
  const keyline = ring ? `0 0 0 ${Math.max(1.5, size / 16)}px ${ring}` : undefined;
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size, boxShadow: keyline }}
      />
    );
  }
  const group = groupFor(name);
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase("fr") ?? "?";
  return (
    <span
      aria-hidden
      className={`u-display inline-flex shrink-0 select-none items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.46),
        lineHeight: 1,
        background: GROUP_COLORS[group],
        color: GROUP_ON_COLOR[group],
        boxShadow: keyline,
      }}
    >
      {initial}
    </span>
  );
}
