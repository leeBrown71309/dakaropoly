import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../../game/store";

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className={`rounded-full px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur-md ${
              t.tone === "good"
                ? "bg-emerald-500/85 text-emerald-950"
                : t.tone === "bad"
                  ? "bg-red-500/85 text-red-50"
                  : "bg-slate-700/85 text-slate-100"
            }`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
