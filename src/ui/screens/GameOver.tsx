import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { Button } from "../kit/Button";
import { quitToHome } from "../leaveGame";
import { FinalStandings } from "./FinalStandings";

export function GameOver() {
  const game = useGame((s) => s.game);
  const openSetup = useGame((s) => s.openSetup);

  const compact = useCompact();
  if (!game) return null;

  return (
    <div className="mat-felt h-full overflow-hidden">
      <div className="p-safe h-full">
        <div className={`scroll-paper h-full overflow-y-auto ${compact ? "px-3 py-3" : "px-6 py-8"}`}>
          <div className="mx-auto w-[540px] max-w-full">
            <motion.div
              initial={{ y: 22, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
            >
              <FinalStandings game={game} compact={compact} />
            </motion.div>

            <div className={`flex justify-center gap-3 ${compact ? "mt-3" : "mt-5"}`}>
              <Button face="gold" size={compact ? "md" : "lg"} icon="dice" onClick={openSetup}>
                Revanche
              </Button>
              <Button face="bone" size={compact ? "md" : "lg"} icon="arrowLeft" onClick={quitToHome}>
                Menu
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
