import { useGame } from "./game/store";
import { Home } from "./ui/screens/Home";
import { Setup } from "./ui/screens/Setup";
import { GameScreen } from "./ui/screens/GameScreen";
import { GameOver } from "./ui/screens/GameOver";

export function App() {
  const screen = useGame((s) => s.screen);
  switch (screen) {
    case "setup":
      return <Setup />;
    case "game":
      return <GameScreen />;
    case "over":
      return <GameOver />;
    default:
      return <Home />;
  }
}
