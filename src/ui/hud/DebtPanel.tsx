import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { decisionAnchor } from "./anchor";
import { netWorthOf } from "../../game/selectors";
import { Card, Label, BrassRule } from "../kit/Surface";
import { Button } from "../kit/Button";
import { Money } from "../kit/Money";
import { Icon } from "../icons/Icon";

/** A bank notice of unpaid debt, rubber-stamped across the face. */
export function DebtPanel() {
  const game = useGame((s) => s.game);
  const dispatch = useGame((s) => s.dispatch);
  // Wait for the event queue to drain, so the card never arrives before
  // the token it describes.
  const animating = useGame((s) => s.animating);
  const toggleManage = useGame((s) => s.toggleManage);
  const compact = useCompact();
  if (animating || !game || game.phase !== "debt" || !game.debt) return null;

  const debt = game.debt;
  const player = game.players[game.current];
  if (!player) return null;
  const creditor = debt.creditor !== null ? game.players[debt.creditor] : null;
  const canPay = player.money >= debt.amount;

  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={decisionAnchor(compact)}
    >
      <Card className="relative overflow-hidden">
        <div
          className={`flex items-center gap-2 ${compact ? "px-2.5 py-1.5" : "px-3.5 py-2"}`}
          style={{
            backgroundColor: "#8E4526",
            color: "#FBEDEB",
            boxShadow: "inset 0 -2px 6px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.2)",
          }}
        >
          <Icon name="warning" size={16} />
          <span className="u-label">Avis de dette</span>
        </div>

        {/* Rubber stamp */}
        <span
          className="pointer-events-none absolute right-3 top-16 -rotate-[14deg] select-none rounded-[3px] border-[2.5px] px-2 py-0.5"
          style={{ borderColor: "rgba(142,69,38,.45)", color: "rgba(142,69,38,.45)" }}
        >
          <span className="u-label text-[13px] tracking-[0.2em]">Impayé</span>
        </span>

        <div className={compact ? "px-2.5 py-2" : "px-3.5 py-3"}>
          <Label>Somme exigible</Label>
          <div className="mt-1">
            <Money
              amount={debt.amount}
              className={`u-display leading-none text-clay-700 ${compact ? "text-[23px]" : "text-[30px]"}`}
            />
          </div>
          <p className={`mt-1.5 leading-snug text-ink-700 ${compact ? "text-[11px]" : "text-[12.5px]"}`}>
            <span className="font-bold">{player.name}</span> doit cette somme à{" "}
            <span className="font-bold">{creditor ? creditor.name : "la banque"}</span>.
          </p>

          <BrassRule className={compact ? "my-1.5" : "my-2.5"} />

          <div className={`flex justify-between ${compact ? "text-[10.5px]" : "text-[11.5px]"}`}>
            <span className="text-ink-500">
              Liquide <Money amount={player.money} className="font-bold text-ink-900" />
            </span>
            <span className="text-ink-500">
              Patrimoine <Money amount={netWorthOf(game, player)} className="font-bold text-ink-900" />
            </span>
          </div>
        </div>
      </Card>

      <div className="mt-1.5 flex gap-1.5">
        <Button
          face="teal"
          size={compact ? "sm" : "md"}
          icon="coins"
          block
          disabled={!canPay}
          onClick={() => dispatch({ t: "pay-debt" })}
        >
          Régler
        </Button>
        <Button
          face="clay"
          size={compact ? "sm" : "md"}
          icon="flag"
          block
          onClick={() => dispatch({ t: "declare-bankruptcy" })}
        >
          Faillite
        </Button>
      </div>

      {!canPay && (
        <button
          type="button"
          onClick={toggleManage}
          className={`mt-1.5 w-full text-center font-semibold leading-snug text-gold-300 underline decoration-gold-700 underline-offset-2 hover:text-gold-500 ${
            compact ? "text-[10.5px]" : "text-[11.5px]"
          }`}
        >
          Vendre des bâtiments ou hypothéquer pour réunir la somme
        </button>
      )}
    </motion.div>
  );
}
