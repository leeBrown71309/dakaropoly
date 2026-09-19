import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { useIsMyTurn, useWaitingFor } from "../useTurn";
import { BOARD, STATION_POS, STATION_RENTS, UTILITY_POS } from "../../game/data/board";
import { holdingRow } from "../../game/selectors";
import { formatMoney, type GameState, type TileDef } from "../../game/types";

/**
 * What this purchase would change for the buyer, or nothing to say.
 *
 * The register answers "what does it earn at each level"; it does not answer
 * "what does buying it do for me", which is the question in front of somebody
 * holding two gares and looking at a third. Spelling it out also settles what
 * the marked line means — it is where they stand, not where they would land.
 */
function purchaseGain(game: GameState, pos: number, playerId: number): string | null {
  const tile = BOARD[pos];
  if (tile?.kind === "station") {
    const held = STATION_POS.filter((p) => game.tiles[p]?.owner === playerId).length;
    if (held === 0) return null;
    const next = STATION_RENTS[held] ?? 0;
    return `Vous possédez ${held === 1 ? "1 gare" : `${held} gares`} : avec celle-ci, chacune rapporterait ${formatMoney(next)}.`;
  }
  if (tile?.kind === "utility") {
    const held = UTILITY_POS.filter((p) => game.tiles[p]?.owner === playerId).length;
    if (held !== 1) return null;
    return "Vous possédez déjà l'autre service : les deux ensemble rapportent 10 × les dés.";
  }
  return null;
}
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
  // What the purchase would actually change, said in words rather than left
  // to be read off a table: buying a station lifts the rent on *all* of them,
  // which is the whole reason to want a third.
  const gain = purchaseGain(game, pos, game.current);

  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={decisionAnchor(compact)}
    >
      {/* The line the buyer already stands on — nothing at all when they hold
          none of the family. Every line claims a number held, so marking the
          one this purchase would reach said they already owned a square they
          are still deciding whether to buy. */}
      <TitleDeed pos={pos} activeRow={holdingRow(game, pos, game.current)} dense={compact} />
      {gain && (
        // On the same stock as the price below it: loose text here sits
        // straight on the board, where a lacquered green table is no
        // background to read a sentence off.
        <p
          className={`mt-1.5 rounded-[3px] leading-snug text-ink-700 ${
            compact ? "px-2.5 py-1 text-[10.5px]" : "px-3 py-1.5 text-[11.5px]"
          }`}
          style={{
            background: "linear-gradient(180deg,#f7f0e1,#e6d9bf)",
            boxShadow: "inset 0 0 0 1px rgba(110,86,52,.22)",
          }}
        >
          {gain}
        </p>
      )}

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
