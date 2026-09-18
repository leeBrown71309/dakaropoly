import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";
import { BOARD } from "../../game/data/board";
import { formatMoney } from "../../game/types";
import { ownedPositions } from "../../game/selectors";

export function TradeModal() {
  const game = useGame((s) => s.game);
  const tradeOpen = useGame((s) => s.tradeOpen);
  const toggleTrade = useGame((s) => s.toggleTrade);
  const dispatch = useGame((s) => s.dispatch);

  const [to, setTo] = useState<number | null>(null);
  const [giveMoney, setGiveMoney] = useState(0);
  const [takeMoney, setTakeMoney] = useState(0);
  const [giveProps, setGiveProps] = useState<number[]>([]);
  const [takeProps, setTakeProps] = useState<number[]>([]);
  const [awaiting, setAwaiting] = useState(false);

  if (!game) return null;
  const current = game.players[game.current];
  if (!current) return null;

  const canTrade = game.phase === "post-roll" || game.phase === "turn-start";
  const target = to !== null ? game.players[to] : null;

  const toggleProp = (list: number[], set: (v: number[]) => void, pos: number) => {
    set(list.includes(pos) ? list.filter((p) => p !== pos) : [...list, pos]);
  };

  return (
    <>
      <button
        onClick={toggleTrade}
        disabled={!canTrade}
        className="absolute right-[132px] top-14 z-30 rounded-xl border border-white/10 bg-[#101a2b]/80 px-3 py-2 text-sm text-slate-200 backdrop-blur-md hover:bg-white/10 disabled:opacity-40"
      >
        🤝 Échanger
      </button>
      <AnimatePresence>
        {tradeOpen && canTrade && (
          <motion.div
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-[560px] max-w-[92vw] rounded-2xl border border-white/10 bg-[#101a2b]/95 p-5">
              {!target ? (
                <div className="flex flex-col gap-3">
                  <h3 className="text-lg font-bold text-slate-100">Avec qui ?</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {game.players
                      .filter((p) => p.id !== current.id && !p.bankrupt)
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setTo(p.id)}
                          className="rounded-xl border border-white/10 px-4 py-3 text-left text-slate-100 hover:bg-white/10"
                        >
                          <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                          {p.name}
                        </button>
                      ))}
                  </div>
                  <button onClick={toggleTrade} className="self-end text-slate-400 hover:text-slate-200">
                    Fermer
                  </button>
                </div>
              ) : awaiting ? (
                <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-bold text-slate-100">
                    {target.name}, acceptes-tu cet échange ?
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-white/10 p-3">
                      <div className="mb-1 text-xs font-bold uppercase text-slate-400">{current.name} donne</div>
                      <div className="text-emerald-300">{giveMoney > 0 ? formatMoney(giveMoney) : "—"}</div>
                      {giveProps.map((pos) => (
                        <div key={pos} className="text-slate-200">{BOARD[pos]?.name}</div>
                      ))}
                    </div>
                    <div className="rounded-xl border border-white/10 p-3">
                      <div className="mb-1 text-xs font-bold uppercase text-slate-400">{target.name} donne</div>
                      <div className="text-emerald-300">{takeMoney > 0 ? formatMoney(takeMoney) : "—"}</div>
                      {takeProps.map((pos) => (
                        <div key={pos} className="text-slate-200">{BOARD[pos]?.name}</div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setAwaiting(false)}
                      className="rounded-lg bg-white/10 px-4 py-2 text-slate-200 hover:bg-white/20"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => {
                        dispatch({
                          t: "propose-trade",
                          offer: { to: target.id, giveMoney, giveProps, takeMoney, takeProps },
                        });
                        setAwaiting(false);
                        setGiveMoney(0);
                        setTakeMoney(0);
                        setGiveProps([]);
                        setTakeProps([]);
                        setTo(null);
                        toggleTrade();
                      }}
                      className="rounded-lg bg-emerald-500 px-4 py-2 font-bold text-emerald-950 hover:bg-emerald-400"
                    >
                      ✅ Accepter
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-bold text-slate-100">
                    Échange {current.name} ↔ {target.name}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="mb-1 text-xs font-bold uppercase text-slate-400">{current.name} donne</div>
                      <input
                        type="number"
                        min={0}
                        max={current.money}
                        value={giveMoney}
                        onChange={(e) => setGiveMoney(Math.max(0, Math.min(Number(e.target.value) || 0, current.money)))}
                        className="mb-2 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-sm text-slate-100"
                      />
                      <div className="flex flex-col gap-1">
                        {ownedPositions(game, current.id).map((pos) => {
                          const st = game.tiles[pos];
                          if (st && st.houses > 0) return null;
                          return (
                            <label key={pos} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 hover:bg-white/5">
                              <input
                                type="checkbox"
                                checked={giveProps.includes(pos)}
                                onChange={() => toggleProp(giveProps, setGiveProps, pos)}
                              />
                              {BOARD[pos]?.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold uppercase text-slate-400">{target.name} donne</div>
                      <input
                        type="number"
                        min={0}
                        max={target.money}
                        value={takeMoney}
                        onChange={(e) => setTakeMoney(Math.max(0, Math.min(Number(e.target.value) || 0, target.money)))}
                        className="mb-2 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-sm text-slate-100"
                      />
                      <div className="flex flex-col gap-1">
                        {ownedPositions(game, target.id).map((pos) => {
                          const st = game.tiles[pos];
                          if (st && st.houses > 0) return null;
                          return (
                            <label key={pos} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 hover:bg-white/5">
                              <input
                                type="checkbox"
                                checked={takeProps.includes(pos)}
                                onChange={() => toggleProp(takeProps, setTakeProps, pos)}
                              />
                              {BOARD[pos]?.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={toggleTrade} className="rounded-lg px-4 py-2 text-slate-400 hover:text-slate-200">
                      Fermer
                    </button>
                    <button
                      onClick={() => setAwaiting(true)}
                      className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-slate-900 hover:bg-amber-300"
                    >
                      Proposer l'échange →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
