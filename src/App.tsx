import { useEffect } from "react";
import { useGame } from "./game/store";
import { normaliseCode } from "./net/room";
import { useRoom } from "./net/roomStore";
import { onlineAvailable } from "./net/supabase";
import { Home } from "./ui/screens/Home";
import { Setup } from "./ui/screens/Setup";
import { Online } from "./ui/screens/Online";
import { GameScreen } from "./ui/screens/GameScreen";
import { GameOver } from "./ui/screens/GameOver";
import { Profile } from "./ui/screens/Profile";
import { RotateGate } from "./ui/screens/RotateGate";

function Screen() {
  const screen = useGame((s) => s.screen);
  switch (screen) {
    case "setup":
      return <Setup />;
    case "online":
      return <Online />;
    case "game":
      return <GameScreen />;
    case "over":
      return <GameOver />;
    case "profile":
      return <Profile />;
    default:
      return <Home />;
  }
}

/**
 * How a tab arrives at an online game, in the two ways it can.
 *
 * An invitation is a link rather than a code read down the phone: `?s=ABC123`
 * drops the guest straight onto the join form with the code filled in. A
 * reload is the other way in, and the quieter one — the room is remembered
 * for the life of the tab, so a refresh, a crash or a phone that gave up
 * comes back to the same chair instead of to the title screen.
 */
function useOnlineEntry(): void {
  const openOnline = useGame((s) => s.openOnline);
  useEffect(() => {
    if (!onlineAvailable) return;

    const invited = normaliseCode(new URLSearchParams(location.search).get("s") ?? "");
    if (invited) {
      openOnline("join", invited);
      // Drop the parameter so a reload does not reopen the form over a game.
      history.replaceState(null, "", location.pathname);
      return;
    }

    void useRoom.getState().restore();
  }, [openOnline]);
}

export function App() {
  useOnlineEntry();
  return (
    <>
      <Screen />
      {/* Sits above every screen: the board is unplayable upright wherever you are. */}
      <RotateGate />
    </>
  );
}
