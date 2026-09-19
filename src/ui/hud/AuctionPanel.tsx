import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { useIsMyTurn } from "../useTurn";
import { decisionAnchor } from "./anchor";
import { formatMoney } from "../../game/types";
import { TitleDeed } from "../kit/TitleDeed";
import { Button } from "../kit/Button";
import { Tooltip } from "../kit/Tooltip";
import { Money } from "../kit/Money";
import { Label } from "../kit/Surface";
import { Icon } from "../icons/Icon";
import { PlayerMark } from "../icons/PlayerMark";

const RAISES = [10, 50, 100];

export function AuctionPanel() {
  const game = useGame((s) => s.game);
  const dispatch = useGame((s) => s.dispatch);
  // Wait for the event queue to drain, so the card never arrives before
  // the token it describes.
  const animating = useGame((s) => s.animating);
  const compact = useCompact();
  const myTurn = useIsMyTurn();
  if (animating || !game || game.phase !== "auction" || !game.auction) return null;

  const auction = game.auction;
  const bidder = game.players[auction.order[0] ?? -1];
  const leader = auction.highBidder !== null ? game.players[auction.highBidder] : null;

  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={decisionAnchor(compact)}
    >
      <div className={`flex items-center gap-2 text-sand-100 ${compact ? "mb-1" : "mb-2"}`}>
        <Icon name="gavel" size={compact ? 14 : 17} className="text-gold-300" />
        <span className="u-label text-sand-100">Vente aux enchères</span>
      </div>

      <TitleDeed pos={auction.pos} dense={compact} />

      {/* Standing bid */}
      <div
        className={`flex items-center justify-between rounded-[3px] ${
          compact ? "mt-1.5 px-2.5 py-1.5" : "mt-2 px-3 py-2"
        }`}
        style={{
          background: "linear-gradient(180deg,#f7f0e1,#e6d9bf)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.8), 0 8px 18px -8px rgba(52,33,12,.5)",
        }}
      >
        <Label>Meilleure offre</Label>
        {leader ? (
          <span className="flex items-center gap-2">
            <PlayerMark player={leader} size={compact ? 15 : 18} />
            <span className={`font-bold text-ink-700 ${compact ? "text-[11px]" : "text-[12px]"}`}>
              {leader.name}
            </span>
            <Money
              amount={auction.highBid}
              className={`font-bold text-ink-900 ${compact ? "text-[13px]" : "text-[16px]"}`}
            />
          </span>
        ) : (
          <span className={`font-semibold italic text-ink-300 ${compact ? "text-[11px]" : "text-[12px]"}`}>
            Aucune offre
          </span>
        )}
      </div>

      {bidder && myTurn ? (
        <>
          <div className={`flex items-center gap-2 px-0.5 ${compact ? "mt-1.5" : "mt-2"}`}>
            <PlayerMark player={bidder} size={compact ? 16 : 20} />
            <span className={`font-bold text-sand-100 ${compact ? "text-[11px]" : "text-[12.5px]"}`}>
              {compact ? bidder.name : `À ${bidder.name} d'enchérir`}
            </span>
            <Money
              amount={bidder.money}
              className={`ml-auto font-semibold text-sand-300 ${compact ? "text-[10.5px]" : "text-[12px]"}`}
            />
          </div>

          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {RAISES.map((step) => {
              const next = auction.highBid === 0 ? step : auction.highBid + step;
              return (
                <Tooltip
                  key={step}
                  title={next > bidder.money ? "Au-dessus de vos moyens" : `Enchérir à ${formatMoney(next)}`}
                  detail={
                    next > bidder.money
                      ? `Vous avez ${formatMoney(bidder.money)} en caisse. On n'enchérit pas à crédit : il faudrait vendre ou hypothéquer, ce qui ne se fait pas pendant une enchère.`
                      : "La banque vend au plus offrant. Chacun mise à son tour, et l'enchère tombe quand tous les autres ont passé."
                  }
                >
                  <Button
                    face="gold"
                    size="sm"
                    block
                    disabled={next > bidder.money}
                    onClick={() => dispatch({ t: "bid", amount: next })}
                    className={`flex-col !gap-0.5 ${compact ? "py-1.5" : "py-2"}`}
                  >
                    <span className="u-label opacity-70">+{step}</span>
                    <Money amount={next} className={compact ? "text-[11px] font-bold" : "text-[12px] font-bold"} />
                  </Button>
                </Tooltip>
              );
            })}
          </div>

          <Button
            face="slate"
            size="sm"
            icon="close"
            block
            className="mt-1.5"
            onClick={() => dispatch({ t: "auction-pass" })}
          >
            Se retirer
          </Button>
        </>
      ) : bidder ? (
        <p className="mt-2 text-center text-[12px] font-semibold text-sand-300">
          {bidder.name} enchérit…
        </p>
      ) : (
        <p className="mt-2 text-center text-[12px] font-semibold text-sand-300">Adjudication…</p>
      )}
    </motion.div>
  );
}
