import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { formatMoney } from "../../game/types";
import { netWorthOf, ownedPositions } from "../../game/selectors";
import type { GameState } from "../../game/types";

const AWARDS: { icon: string; label: string; stat: (s: GameState) => Record<number, number>; onlyIf: number }[] = [
  {
    icon: "👑",
    label: "Roi du loyer",
    stat: (s) => Object.fromEntries(s.players.map((p) => [p.id, p.stats.rentsCollected])),
    onlyIf: 1,
  },
  {
    icon: "🔒",
    label: "Client fidèle de Rebeuss",
    stat: (s) => Object.fromEntries(s.players.map((p) => [p.id, p.stats.jailVisits])),
    onlyIf: 1,
  },
  {
    icon: "🏗️",
    label: "Baron de l'immobilier",
    stat: (s) => Object.fromEntries(s.players.map((p) => [p.id, p.stats.purchases])),
    onlyIf: 1,
  },
  {
    icon: "💸",
    label: "Tirelire percée",
    stat: (s) => Object.fromEntries(s.players.map((p) => [p.id, p.stats.rentPaid])),
    onlyIf: 1,
  },
  {
    icon: "🍀",
    label: "Fils de la chance",
    stat: (s) => Object.fromEntries(s.players.map((p) => [p.id, p.stats.cardsDrawn])),
    onlyIf: 1,
  },
];

function computeAwards(game: GameState): { icon: string; label: string; name: string }[] {
  const results: { icon: string; label: string; name: string }[] = [];
  for (const award of AWARDS) {
    const values = award.stat(game);
    const best = Object.entries(values).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    if (best && (best[1] as number) >= award.onlyIf) {
      const player = game.players[Number(best[0])];
      if (player) results.push({ icon: award.icon, label: award.label, name: player.name });
    }
  }
  return results.slice(0, 3);
}

export function GameOver() {
  const game = useGame((s) => s.game);
  const openSetup = useGame((s) => s.openSetup);
  const goHome = useGame((s) => s.goHome);
  if (!game) return null;

  const ranking = [...game.players].sort((a, b) => netWorthOf(game, b) - netWorthOf(game, a));
  const winner = game.winner !== null ? game.players[game.winner] : null;
  const awards = computeAwards(game);

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto bg-[radial-gradient(120%_90%_at_50%_15%,#16324f_0%,#0e1420_55%,#090d14_100%)] px-6 py-10 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="mb-2 text-7xl"
      >
        🏆
      </motion.div>
      <h1 className="mb-1 text-4xl font-black text-amber-300">
        {winner ? `${winner.name} remporte Dakar !` : "Partie terminée"}
      </h1>
      <p className="mb-8 text-slate-400">
        {ranking.length} patrimoines évalués en {game.turnCount} tours.
      </p>

      <div className="mb-8 flex w-full max-w-xl flex-col gap-2">
        {ranking.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
            className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
              i === 0 ? "border-amber-400/60 bg-amber-400/10" : "border-white/10 bg-[#101a2b]/80"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="font-bold text-slate-100">{p.name}</span>
              {p.bankrupt && <span className="text-xs text-red-400">faillite</span>}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-400">{ownedPositions(game, p.id).length} biens</span>
              <span className="font-bold text-emerald-300">{formatMoney(netWorthOf(game, p))}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {awards.length > 0 && (
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-lg font-bold text-slate-300">Les prix douteux de la soirée</h2>
          {awards.map((a, i) => (
            <motion.div
              key={a.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.15 }}
              className="rounded-xl border border-white/10 bg-[#101a2b]/80 px-4 py-2 text-sm text-slate-200"
            >
              {a.icon} <b>{a.label}</b> — {a.name}
            </motion.div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={openSetup}
          className="rounded-2xl bg-amber-400 px-8 py-3.5 font-bold text-slate-900 transition hover:scale-105 hover:bg-amber-300"
        >
          🔁 Revanche !
        </button>
        <button
          onClick={goHome}
          className="rounded-2xl border border-white/10 px-8 py-3.5 text-slate-300 transition hover:bg-white/5"
        >
          Menu
        </button>
      </div>
    </div>
  );
}
