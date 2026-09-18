import { PAWN_SHAPES, PAWN_SILHOUETTES, PAWN_VIEWBOX, type PawnShape } from "../../game/data/pawns";

interface PawnGlyphProps {
  /** Index into the pawn table, as stored on the player. */
  pawn: number;
  size?: number;
  className?: string;
  title?: string;
}

/** The flat form of a token, drawn from the same silhouette as its 3D model. */
export function PawnGlyph({ pawn, size = 22, className = "", title }: PawnGlyphProps) {
  const shape: PawnShape = PAWN_SHAPES[pawn] ?? "taxi";
  return (
    <svg
      viewBox={`0 0 ${PAWN_VIEWBOX} ${PAWN_VIEWBOX}`}
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {PAWN_SILHOUETTES[shape].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
