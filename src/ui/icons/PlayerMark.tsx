import type { Player } from "../../game/types";
import { useSeatPhoto } from "../useTurn";
import { Avatar } from "../kit/Avatar";
import { PawnGlyph } from "./PawnGlyph";

interface PlayerMarkProps {
  player: Player;
  size?: number;
  className?: string;
  /** Adds the player's name as an accessible label. */
  labelled?: boolean;
  /**
   * The photo to show, when the caller knows it — the history, reading a
   * game long after its room closed. Left out, it is looked up in the room
   * this device is in; `null` insists on the pawn.
   */
  avatar?: string | null;
}

/**
 * How a player is shown, everywhere. One component so the seventeen places
 * that draw an identity stay in step.
 *
 * The pawn, tinted with the player's colour, is the whole mark for a guest:
 * it is the same silhouette extruded into the token on the 3D board, so it
 * is what ties a name in the HUD to a piece on the table. An account with a
 * photo shows its face instead, and keeps that link visible — ringed in the
 * player's colour, with the pawn pinned to its corner wherever there is room
 * to read it.
 */
export function PlayerMark({ player, size = 22, className = "", labelled = false, avatar }: PlayerMarkProps) {
  const seated = useSeatPhoto(player.id);
  const photo = avatar === undefined ? seated : avatar;

  if (!photo) {
    return (
      <span className={`inline-flex shrink-0 ${className}`} style={{ color: player.color }}>
        <PawnGlyph pawn={player.pawn} size={size} title={labelled ? player.name : undefined} />
      </span>
    );
  }

  const badge = Math.round(size * 0.52);
  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={labelled ? player.name : undefined}
    >
      <Avatar src={photo} name={player.name} size={size} ring={player.color} />
      {size >= 20 && (
        <span
          className="absolute flex items-center justify-center rounded-full"
          style={{
            width: badge,
            height: badge,
            right: -badge * 0.28,
            bottom: -badge * 0.28,
            background: "#FBF7EE",
            color: player.color,
            boxShadow: "0 1px 3px rgba(52,33,12,.45)",
          }}
        >
          <PawnGlyph pawn={player.pawn} size={Math.round(badge * 0.78)} />
        </span>
      )}
    </span>
  );
}
