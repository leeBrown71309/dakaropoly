import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { useTradeRole } from "../useTurn";
import { Card, Label, BrassRule } from "../kit/Surface";
import { Button } from "../kit/Button";
import { Icon } from "../icons/Icon";
import { PlayerMark } from "../icons/PlayerMark";
import { Summary } from "./TradeModal";

/**
 * An offer lying on the table.
 *
 * Only the two sides see it: the one being offered the deal gets Accepter and
 * Refuser, the one who made it gets a way to take it back. A trade between
 * two other players is their business — everyone else has the toast and the
 * journal, and an uninvited modal over the board would be rude.
 */
export function TradeOffer() {
  const game = useGame((s) => s.game);
  const dispatch = useGame((s) => s.dispatch);
  const role = useTradeRole();
  const compact = useCompact();

  const pending = game?.pendingTrade ?? null;
  const from = pending ? game?.players[pending.from] : undefined;
  const to = pending ? game?.players[pending.offer.to] : undefined;
  const show = Boolean(pending && from && to && role);

  return (
    <AnimatePresence>
      {show && pending && from && to && (
        <motion.div
          // Nothing here takes pointer events but the card itself: a backdrop
          // that lingers through its own exit is a click trap over the board.
          className={`pointer-events-none absolute inset-0 z-[55] flex items-center justify-center ${
            compact ? "px-2 py-1" : "px-4"
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            background:
              "radial-gradient(80% 60% at 50% 45%, rgba(38,24,8,.5) 0%, rgba(20,12,4,.76) 100%)",
          }}
        >
          <motion.div
            initial={{ y: 26, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 18, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="pointer-events-auto w-[560px] max-w-full"
          >
            <Card className="overflow-hidden">
              <header
                className={`flex items-center gap-2 ${compact ? "px-3 pb-1 pt-1.5" : "px-4 pb-2 pt-3"}`}
              >
                <Icon name="exchange" size={compact ? 15 : 18} className="text-ink-700" />
                <span className={`u-display text-ink-900 ${compact ? "text-[13px]" : "text-[16px]"}`}>
                  {role === "answer" ? "Proposition d'échange" : "Offre envoyée"}
                </span>
              </header>
              <BrassRule />

              <div className={compact ? "p-3" : "p-4"}>
                <div className="mb-2 flex items-center justify-center gap-2">
                  <PlayerMark player={from} size={compact ? 16 : 20} />
                  <span className="text-[12.5px] font-bold text-ink-900">{from.name}</span>
                  <Icon name="exchange" size={13} className="text-ink-300" />
                  <PlayerMark player={to} size={compact ? 16 : 20} />
                  <span className="text-[12.5px] font-bold text-ink-900">{to.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Summary
                    owner={from}
                    caption="donne"
                    money={pending.offer.giveMoney}
                    props={pending.offer.giveProps}
                  />
                  <Summary
                    owner={to}
                    caption="donne"
                    money={pending.offer.takeMoney}
                    props={pending.offer.takeProps}
                  />
                </div>

                {role === "answer" ? (
                  <div className={`flex items-center gap-2 ${compact ? "mt-2.5" : "mt-4"}`}>
                    <Label>{to.name}, c'est à vous de décider</Label>
                    <Button
                      face="clay"
                      size={compact ? "sm" : "md"}
                      icon="close"
                      className="ml-auto"
                      onClick={() => dispatch({ t: "reject-trade" })}
                    >
                      Refuser
                    </Button>
                    <Button
                      face="teal"
                      size={compact ? "sm" : "md"}
                      icon="check"
                      onClick={() => dispatch({ t: "accept-trade" })}
                    >
                      Accepter
                    </Button>
                  </div>
                ) : (
                  <div className={`flex items-center gap-2 ${compact ? "mt-2.5" : "mt-4"}`}>
                    <span className="u-label flex items-center gap-2 text-ink-500">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-500" />
                      En attente de {to.name}
                    </span>
                    <Button
                      face="bone"
                      size={compact ? "sm" : "md"}
                      icon="arrowLeft"
                      className="ml-auto"
                      onClick={() => dispatch({ t: "withdraw-trade" })}
                    >
                      Retirer l'offre
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
