import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";
import { PAWN_EMOJIS } from "../../game/data/pawns";

interface Draft {
  name: string;
  pawn: number;
}

const COLORS = ["#F59E0B", "#3B82F6", "#EF4444", "#22C55E", "#A855F7", "#06B6D4", "#EC4899", "#84CC16"];

export function Setup() {
  const startGame = useGame((s) => s.startGame);
  const goHome = useGame((s) => s.goHome);
  const [players, setPlayers] = useState<Draft[]>([
    { name: "", pawn: 0 },
    { name: "", pawn: 1 },
  ]);

  const taken = (i: number, pawn: number) => players.some((p, idx) => idx !== i && p.pawn === pawn);
  const valid = players.every((p) => p.name.trim().length > 0) && players.length >= 2;

  const update = (i: number, patch: Partial<Draft>) => {
    setPlayers((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto bg-[#0e1420] px-6 py-8">
      <div className="mb-6 flex w-full max-w-2xl items-center justify-between">
        <button
          onClick={goHome}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          ← Retour
        </button>
        <h1 className="text-2xl font-bold text-slate-100">Qui joue ce soir ?</h1>
        <div className="w-20" />
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-3">
        <AnimatePresence initial={false}>
          {players.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#101a2b]/85 p-3"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                style={{ backgroundColor: `${COLORS[p.pawn]}22`, border: `2px solid ${COLORS[p.pawn]}` }}
              >
                {PAWN_EMOJIS[p.pawn]}
              </div>
              <input
                value={p.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder={`Joueur ${i + 1}`}
                maxLength={14}
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-slate-100 outline-none focus:border-amber-400/60"
              />
              <div className="flex gap-1">
                {PAWN_EMOJIS.map((emoji, pi) => (
                  <button
                    key={pi}
                    disabled={taken(i, pi)}
                    onClick={() => update(i, { pawn: pi })}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition ${
                      p.pawn === pi
                        ? "bg-amber-400/25 ring-2 ring-amber-400"
                        : taken(i, pi)
                          ? "cursor-not-allowed opacity-20"
                          : "hover:bg-white/10"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {players.length > 2 && (
                <button
                  onClick={() => setPlayers((ps) => ps.filter((_, idx) => idx !== i))}
                  className="ml-1 rounded-lg px-2 py-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                >
                  ✕
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {players.length < 8 && (
          <button
            onClick={() =>
              setPlayers((ps) => {
                const used = new Set(ps.map((p) => p.pawn));
                const next = PAWN_EMOJIS.findIndex((_, pi) => !used.has(pi));
                return [...ps, { name: "", pawn: next === -1 ? 0 : next }];
              })
            }
            className="rounded-2xl border border-dashed border-white/20 py-3 text-slate-400 transition hover:border-amber-400/50 hover:text-amber-300"
          >
            + Ajouter un joueur ({players.length}/8)
          </button>
        )}
      </div>

      <button
        disabled={!valid}
        onClick={() =>
          startGame(players.map((p) => ({ name: p.name.trim(), pawn: p.pawn })))
        }
        className={`mt-8 rounded-2xl px-10 py-4 text-lg font-bold transition ${
          valid
            ? "bg-amber-400 text-slate-900 shadow-lg shadow-amber-500/25 hover:scale-105 hover:bg-amber-300 active:scale-95"
            : "cursor-not-allowed bg-white/10 text-slate-500"
        }`}
      >
        🚀 Lancer la partie
      </button>
    </div>
  );
}
