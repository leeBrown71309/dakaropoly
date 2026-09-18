import { useGame } from "../game/store";
import { actorFor, mayAct, tradeRoleFor, type TradeRole } from "../game/selectors";

/**
 * Whether this device may act right now.
 *
 * In a hot-seat game one device speaks for everyone, so the answer is always
 * yes and the HUD behaves exactly as it always has. Online it is the player's
 * own seat against the legal actor — and a spectator, who has no seat, never
 * gets a turn.
 *
 * Note this is about *entitlement*, not readiness: panels still gate on
 * `animating` as well, because the rules run ahead of the board.
 */
export function useIsMyTurn(): boolean {
  const game = useGame((s) => s.game);
  const online = useGame((s) => s.online);
  const localPlayerId = useGame((s) => s.localPlayerId);
  if (!game) return false;
  return mayAct(game, online, localPlayerId);
}

/**
 * The seat this device owns, or the player whose turn it is in a hot-seat
 * game. Use it wherever the interface means "you" — your holdings, your
 * balance — rather than "the player to move". `null` for a spectator, who
 * owns nothing to show.
 */
export function useMySeat(): number | null {
  const game = useGame((s) => s.game);
  const online = useGame((s) => s.online);
  const localPlayerId = useGame((s) => s.localPlayerId);
  if (!game) return null;
  return online ? localPlayerId : actorFor(game);
}

/** True when this game is being played across devices rather than hot-seat. */
export function useIsOnline(): boolean {
  return useGame((s) => s.online);
}

/**
 * Where this device stands in an offer lying on the table: answering it,
 * waiting on it, or — for everyone else at the table — neither.
 */
export function useTradeRole(): TradeRole {
  const game = useGame((s) => s.game);
  const online = useGame((s) => s.online);
  const localPlayerId = useGame((s) => s.localPlayerId);
  if (!game) return null;
  return tradeRoleFor(game, online, localPlayerId);
}

/** True when this device is watching a game it has no seat in. */
export function useIsSpectator(): boolean {
  const online = useGame((s) => s.online);
  const localPlayerId = useGame((s) => s.localPlayerId);
  return online && localPlayerId === null;
}

/**
 * Who everyone is waiting for, for the panels that stay on screen when it is
 * somebody else's move. Returns null when it is this device's turn.
 */
export function useWaitingFor(): string | null {
  const game = useGame((s) => s.game);
  const mine = useIsMyTurn();
  if (!game || mine) return null;
  const actor = actorFor(game);
  return actor === null ? null : (game.players[actor]?.name ?? null);
}
