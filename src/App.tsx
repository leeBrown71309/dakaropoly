import { useEffect } from "react";
import { useGame } from "./game/store";
import { normaliseCode } from "./net/room";
import { onlineAvailable } from "./net/supabase";
import { Home } from "./ui/screens/Home";
import { Setup } from "./ui/screens/Setup";
import { Online } from "./ui/screens/Online";
import { GameScreen } from "./ui/screens/GameScreen";
import { GameOver } from "./ui/screens/GameOver";
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
    default:
      return <Home />;
  }
}

/**
 * An invitation is a link, not a code read down the phone: `?s=ABC123` drops
 * the guest straight onto the join form with the code already filled in.
 */
function useInviteLink(): void {
  const openOnline = useGame((s) => s.openOnline);
  useEffect(() => {
    if (!onlineAvailable) return;
    const code = normaliseCode(new URLSearchParams(location.search).get("s") ?? "");
    if (!code) return;
    openOnline("join", code);
    // Drop the parameter so a reload does not reopen the form over a game.
    history.replaceState(null, "", location.pathname);
  }, [openOnline]);
}

export function App() {
  useInviteLink();
  return (
    <>
      <Screen />
      {/* Sits above every screen: the board is unplayable upright wherever you are. */}
      <RotateGate />
    </>
  );
}
