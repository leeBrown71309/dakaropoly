import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";

export function CardModal() {
  const cardView = useGame((s) => s.cardView);
  const ackCard = useGame((s) => s.ackCard);
  return (
    <AnimatePresence>
      {cardView && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ rotateY: 90, scale: 0.8 }}
            animate={{ rotateY: 0, scale: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="mx-4 w-[320px]"
          >
            <div
              className="flex flex-col items-center gap-4 rounded-3xl p-6 text-center shadow-2xl"
              style={{ backgroundColor: cardView.deck === "chance" ? "#f59e0b" : "#e9dfc8" }}
            >
              <div className="text-5xl">{cardView.deck === "chance" ? "🍀" : "🤝"}</div>
              <div
                className={`text-xs font-bold uppercase tracking-widest ${cardView.deck === "chance" ? "text-amber-950/70" : "text-amber-900/60"}`}
              >
                {cardView.deck === "chance" ? "Baraka !" : "Teranga"}
              </div>
              <h2 className="text-xl font-black text-slate-900">{cardView.card.title}</h2>
              <p className="text-slate-800">{cardView.card.text}</p>
              <button
                onClick={ackCard}
                className="mt-2 w-full rounded-xl bg-slate-900 px-6 py-3 font-bold text-amber-300 transition hover:bg-slate-800"
              >
                C'est noté !
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
