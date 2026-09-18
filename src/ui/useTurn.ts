import { useGame } from "../game/store";
import { actorFor } from "../game/selectors";

/**
 * Whether this device may act right now.
 *
 * In a hot-seat game `localPlayerId` is `null` — one device speaks for
 * everyone, so the answer is always yes and the HUD behaves exactly as it
 * always has. Online it is the player's own seat, and only the legal actor
 * gets buttons.
 *
 * Note this is about *entitlement*, not readiness: panels still gate on
 * `animating` as well, because the rules run ahead of the board.
 */
export function useIsMyTurn(): boolean {
  const game = useGame((s) => s.game);
  const localPlayerId = useGame((s) => s.localPlayerId);
  if (!game) return false;
  if (localPlayerId === null) return true;
  return actorFor(game) === localPlayerId;
}

/**
 * The seat this device owns, or the player whose turn it is in a hot-seat
 * game. Use it wherever the interface means "you" — your holdings, your
 * balance — rather than "the player to move".
 */
export function useMySeat(): number | null {
  const game = useGame((s) => s.game);
  const localPlayerId = useGame((s) => s.localPlayerId);
  if (!game) return null;
  return localPlayerId ?? actorFor(game);
}
