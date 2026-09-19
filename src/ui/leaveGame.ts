import { useGame } from "../game/store";
import { useRoom } from "../net/roomStore";

/**
 * Leaves for the title screen, and leaves the room with it.
 *
 * Walking out of an online game without saying so leaves a chair that looks
 * taken until the room gives up on it a minute later — and has the next
 * reload of this tab walk straight back into a game nobody meant to rejoin.
 */
export function quitToHome(): void {
  const { code, leave } = useRoom.getState();
  if (code) void leave();
  useGame.getState().goHome();
}
