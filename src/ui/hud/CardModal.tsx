import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { useIsMyTurn } from "../useTurn";
import { Button } from "../kit/Button";
import { BrassRule } from "../kit/Surface";
import { Icon } from "../icons/Icon";
import { DECK_STYLES } from "../../game/colors";

/**
 * The card stock, built from the same two colours as the squares the cards
 * are drawn from — orange for Baraka, blue for Teranga. Only the icon is
 * local; everything else comes from `DECK_STYLES` so the board, the pile and
 * the card can never drift apart.
 */
const DECK_ICON = { chance: "cowrie", chest: "teapot" } as const;

const DECK_STYLE = {
  chance: deckFace("chance"),
  chest: deckFace("chest"),
};

function deckFace(deck: "chance" | "chest") {
  const style = DECK_STYLES[deck];
  return {
    name: style.name,
    icon: DECK_ICON[deck],
    face: `linear-gradient(172deg,${style.face[0]} 0%,${style.face[1]} 55%,${style.face[2]} 100%)`,
    ink: style.on,
    trim: style.strong,
  };
}

export function CardModal() {
  const cardView = useGame((s) => s.cardView);
  const ackCard = useGame((s) => s.ackCard);
  const compact = useCompact();
  const myTurn = useIsMyTurn();

  // The backdrop never takes pointer events. The card leaves on a spring that
  // takes about two seconds to settle, and until it does this layer is still
  // in the document — invisible, but perfectly capable of swallowing every
  // click meant for the board, at exactly the moment the buy panel appears
  // underneath it. Only the card itself is interactive, which is all it ever
  // needed to be.
  return (
    <AnimatePresence>
      {cardView && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            background:
              "radial-gradient(80% 60% at 50% 45%, rgba(38,24,8,.52) 0%, rgba(20,12,4,.78) 100%)",
          }}
        >
          <motion.div
            initial={{ y: -220, rotate: -18, scale: 0.82, opacity: 0 }}
            animate={{ y: 0, rotate: -1.4, scale: 1, opacity: 1 }}
            exit={{ y: 90, rotate: 9, scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 210, damping: 21 }}
            className={`pointer-events-auto ${compact ? "mx-3 w-[262px]" : "mx-4 w-[330px]"}`}
          >
            <Deck
              deck={cardView.deck}
              title={cardView.card.title}
              text={cardView.card.text}
              compact={compact}
              canAck={myTurn}
              onAck={ackCard}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Deck({
  deck,
  title,
  text,
  compact,
  canAck,
  onAck,
}: {
  deck: "chance" | "chest";
  title: string;
  text: string;
  compact: boolean;
  canAck: boolean;
  onAck: () => void;
}) {
  const s = DECK_STYLE[deck];
  return (
    <div
      className={`mat-grain relative text-center ${compact ? "px-4 pb-3.5 pt-4" : "px-6 pb-5 pt-5"}`}
      style={{
        background: s.face,
        color: s.ink,
        borderRadius: "5px",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.7), inset 0 0 0 1px rgba(0,0,0,.09), 0 30px 60px -20px rgba(20,12,3,.8), 0 10px 22px -10px rgba(20,12,3,.6)",
      }}
    >
      {/* Printed inner keyline, like a real card */}
      <span
        className="pointer-events-none absolute inset-[7px] rounded-[3px]"
        style={{ border: `1px solid ${s.trim}55` }}
      />

      <div className="relative">
        <Icon
          name={s.icon}
          size={compact ? 30 : 44}
          strokeWidth={1.45}
          style={{ color: s.trim }}
          className="mx-auto"
        />
        <div
          className={`u-label tracking-[0.22em] ${compact ? "mt-1.5" : "mt-2.5"}`}
          style={{ color: s.trim }}
        >
          {s.name}
        </div>

        <BrassRule className={`mx-auto w-24 ${compact ? "my-2" : "my-3"}`} />

        <h2 className={`u-display leading-tight ${compact ? "text-[17px]" : "text-[22px]"}`}>{title}</h2>
        <p
          className={`mx-auto mt-1.5 max-w-[250px] leading-relaxed opacity-85 ${
            compact ? "text-[11.5px]" : "text-[13.5px]"
          }`}
        >
          {text}
        </p>

        <Button
          face={deck === "chance" ? "slate" : "teal"}
          size={compact ? "sm" : "md"}
          block
          className={compact ? "mt-3" : "mt-5"}
          disabled={!canAck}
          onClick={onAck}
        >
          {canAck ? "C'est noté" : "En attente…"}
        </Button>
      </div>
    </div>
  );
}
