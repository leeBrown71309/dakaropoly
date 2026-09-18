import { motion } from "framer-motion";
import { useGame } from "../../game/store";

export function Home() {
  const openSetup = useGame((s) => s.openSetup);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 bg-[radial-gradient(120%_90%_at_50%_15%,#16324f_0%,#0e1420_55%,#090d14_100%)] px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="text-7xl">🌴 🎲 🇸🇳</div>
        <h1 className="bg-gradient-to-r from-amber-300 via-amber-200 to-orange-400 bg-clip-text text-6xl font-black tracking-tight text-transparent">
          DAKAROPOLY
        </h1>
        <p className="max-w-md text-lg text-slate-300">
          Le Monopoly 3D de Dakar — achetez la Médina, bâtissez les Almadies, méfiez-vous de Rebeuss.
        </p>
      </motion.div>
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        onClick={openSetup}
        className="rounded-2xl bg-amber-400 px-10 py-4 text-lg font-bold text-slate-900 shadow-lg shadow-amber-500/25 transition hover:scale-105 hover:bg-amber-300 active:scale-95"
      >
        🎲 Nouvelle partie
      </motion.button>
      <p className="absolute bottom-5 text-sm text-slate-500">
        Fait maison, pour les soirées en famille — 2 à 8 joueurs sur un seul écran.
      </p>
    </div>
  );
}
