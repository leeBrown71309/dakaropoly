import type { Player } from "../../game/types";
import { PawnGlyph } from "./PawnGlyph";

interface PlayerMarkProps {
  player: Player;
  size?: number;
  className?: string;
  /** Adds the player's name as an accessible label. */
  labelled?: boolean;
}

/**
 * How a player is shown, everywhere. One component so the seventeen places
 * that draw an identity stay in step — and so an avatar can be introduced
 * later in one edit rather than seventeen.
 *
 * The pawn is tinted with the player's colour and is deliberately the whole
 * mark: it is the same silhouette extruded into the token on the 3D board, so
 * it is what ties a name in the HUD to a piece on the table. Whatever richer
 * portrait arrives later has to keep that link visible.
 */
export function PlayerMark({ player, size = 22, className = "", labelled = false }: PlayerMarkProps) {
  return (
    <span className={`inline-flex shrink-0 ${className}`} style={{ color: player.color }}>
      <PawnGlyph pawn={player.pawn} size={size} title={labelled ? player.name : undefined} />
    </span>
  );
}
