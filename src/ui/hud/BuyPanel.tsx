import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { useIsMyTurn, useWaitingFor } from "../useTurn";
import { BOARD } from "../../game/data/board";
import { rentRow } from "../../game/selectors";
import { formatMoney, type TileDef } from "../../game/types";
import { decisionAnchor } from "./anchor";
import { TitleDeed } from "../kit/TitleDeed";
import { Button } from "../kit/Button";
import { Tooltip } from "../kit/Tooltip";
import { Money } from "../kit/Money";
import { Label } from "../kit/Surface";

export function BuyPanel() {
  const game = useGame((s) => s.game);
  const dispatch = useGame((s) => s.dispatch);
  // Wait for the event queue to drain, so the card never arrives before
  // the token it describes.
  const animating = useGame((s) => s.animating);
  const compact = useCompact();
  const myTurn = useIsMyTurn();
  const waitingForName = useWaitingFor();
  if (animating || !game || game.phase !== "buy-decision" || game.buyTile === null) return null;

  const pos = game.buyTile;
  const tile = BOARD[pos] as TileDef | undefined;
  const price = tile?.price ?? 0;
  const player = game.players[game.current];
  const affordable = (player?.money ?? 0) >= price;

  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={decisionAnchor(compact)}
    >
      {/* The line this purchase would put the buyer on, not the first one.
          A player holding two stations was being shown "1 gare possédée" on
          the card for their third. */}
      <TitleDeed pos={pos} activeRow={rentRow(game, pos, game.current)} dense={compact} />

      <div
        className={`mt-1.5 flex items-center justify-between rounded-[3px] ${
          compact ? "px-2.5 py-1.5" : "px-3 py-2"
        }`}
        style={{
          background: "linear-gradient(180deg,#f7f0e1,#e6d9bf)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.8), 0 8px 18px -8px rgba(52,33,12,.5)",
        }}
      >
        <Label>Prix d'achat</Label>
        <Money amount={price} className={`font-bold text-ink-900 ${compact ? "text-[14px]" : "text-[17px]"}`} />
      </div>

      {!myTurn ? (
        <p className="mt-1.5 text-center text-[11.5px] font-semibold text-sand-200">
          {waitingForName ? `${waitingForName} décide…` : "En attente…"}
        </p>
      ) : (
        <div className="mt-1.5 flex gap-1.5">
          <Tooltip
            className="flex-1"
            title={affordable ? "Acheter" : "Fonds insuffisants"}
            detail={
              affordable
                ? `${formatMoney(price)} à la banque, et le titre est à vous. Refuser l'envoie aux enchères, où il partira peut-être moins cher — à quelqu'un d'autre.`
                : `${tile?.name ?? "Ce bien"} coûte ${formatMoney(price)} ; il vous manque ${formatMoney(price - (player?.money ?? 0))}. Il partira donc aux enchères.`
            }
          >
            <Button
              face="teal"
              size={compact ? "sm" : "md"}
              icon="coins"
              block
              disabled={!affordable}
              onClick={() => dispatch({ t: "buy" })}
            >
              Acheter
            </Button>
          </Tooltip>
          <Button
            face="bone"
            size={compact ? "sm" : "md"}
            icon="gavel"
            block
            onClick={() => dispatch({ t: "decline" })}
          >
            Aux enchères
          </Button>
        </div>
      )}

      {myTurn && !affordable && (
        <p className="mt-1.5 text-center text-[10.5px] font-semibold leading-snug text-sand-200">
          Fonds insuffisants — le bien part aux enchères.
        </p>
      )}
    </motion.div>
  );
}
