import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { quitToHome } from "../leaveGame";
import { useIsOnline, useIsSpectator } from "../useTurn";
import { useRoom } from "../../net/roomStore";
import { formatCode } from "../../net/room";
import { Card, Label, BrassRule } from "../kit/Surface";
import { Button } from "../kit/Button";
import { Money } from "../kit/Money";
import { Icon } from "../icons/Icon";

/**
 * Leaving throws the saved game away, and a Monopoly evening is long — so the
 * cost is spelled out before the door opens.
 */
export function ConfirmQuit() {
  const open = useGame((s) => s.confirmQuitOpen);
  const cancelQuit = useGame((s) => s.cancelQuit);
  const game = useGame((s) => s.game);
  const compact = useCompact();
  const online = useIsOnline();
  const spectating = useIsSpectator();
  const code = useRoom((s) => s.code);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-[60] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            background: "radial-gradient(70% 55% at 50% 50%, rgba(38,20,8,.6) 0%, rgba(18,10,3,.84) 100%)",
          }}
          onClick={cancelQuit}
        >
          <motion.div
            initial={{ y: 18, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            className={`max-w-full ${compact ? "w-[300px]" : "w-[360px]"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="overflow-hidden">
              <div
                className={`flex items-center gap-2.5 ${compact ? "px-3 py-1.5" : "px-4 py-2.5"}`}
                style={{
                  backgroundColor: "#8E4526",
                  color: "#FBEDEB",
                  boxShadow: "inset 0 -2px 6px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.18)",
                }}
              >
                <Icon name="warning" size={compact ? 15 : 18} />
                <span className="u-label">Quitter la partie</span>
              </div>

              <div className={compact ? "px-3 pb-3 pt-2" : "px-4 pb-4 pt-3"}>
                {/*
                  * Online there is a way back, so saying there is not was
                  * simply false — the board lives in the room, not on this
                  * device. What is actually at stake is the chair, which
                  * anybody may take once it is free, and the code, which is
                  * the only way in. Both are worth reading before leaving.
                  */}
                <p className={`leading-snug text-ink-700 ${compact ? "text-[11.5px]" : "text-[13px]"}`}>
                  {!online ? (
                    <>
                      La partie en cours sera <b>définitivement effacée</b>. Il n'y a pas de retour
                      en arrière.
                    </>
                  ) : spectating ? (
                    <>La partie continue sans vous. Vous pourrez revenir avec le code du salon.</>
                  ) : (
                    <>
                      La partie continue sans vous et <b>votre place se libère</b>. Vous pourrez la
                      reprendre avec le code du salon, tant que personne d'autre ne s'y assoit.
                    </>
                  )}
                </p>

                {online && code && (
                  <div
                    className="mt-2.5 flex items-center gap-2 rounded-[3px] px-2.5 py-1.5"
                    style={{
                      background: "rgba(120,95,60,.07)",
                      boxShadow: "inset 0 0 0 1px rgba(110,86,52,.2)",
                    }}
                  >
                    <Icon name="key" size={13} className="shrink-0 text-ink-500" />
                    <Label>Code du salon</Label>
                    <span className="u-display ml-auto tracking-[0.14em] text-ink-900">
                      {formatCode(code)}
                    </span>
                  </div>
                )}

                {game && (
                  <>
                    <BrassRule className={compact ? "my-2" : "my-3"} />
                    <div className="flex items-center justify-between">
                      <Label>{online ? "La partie continue" : "En cours"}</Label>
                      <span className="text-[12px] text-ink-500">
                        {game.players.filter((p) => !p.bankrupt).length} joueurs · tour{" "}
                        {game.turnCount + 1}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {game.players.map((p) => (
                        <span key={p.id} className="text-[11.5px] text-ink-700">
                          <span
                            className="mr-1 inline-block h-2 w-2 rounded-[1px] align-middle"
                            style={{ backgroundColor: p.color }}
                          />
                          {p.name} <Money amount={p.money} className="text-ink-500" />
                        </span>
                      ))}
                    </div>
                  </>
                )}

                <div className={`flex gap-2 ${compact ? "mt-2.5" : "mt-4"}`}>
                  <Button face="bone" size={compact ? "sm" : "md"} block onClick={cancelQuit}>
                    Continuer à jouer
                  </Button>
                  <Button
                    face="clay"
                    size={compact ? "sm" : "md"}
                    icon={online ? "arrowLeft" : "flag"}
                    block
                    onClick={quitToHome}
                  >
                    Quitter
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
