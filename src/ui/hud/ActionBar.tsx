import { useGame } from "../../game/store";
import { formatMoney } from "../../game/types";

export function ActionBar() {
  const game = useGame((s) => s.game);
  const dispatch = useGame((s) => s.dispatch);
  const toggleLog = useGame((s) => s.toggleLog);
  const logOpen = useGame((s) => s.logOpen);
  if (!game || game.phase === "game-over") return null;
  const player = game.players[game.current];
  if (!player) return null;

  const busy = game.phase === "resolving" || game.phase === "card";
  const inBuy = game.phase === "buy-decision";
  const inAuction = game.phase === "auction";
  const inDebt = game.phase === "debt";
  const contextBlocked = busy || inBuy || inAuction || inDebt;

  return (
    <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#101a2b]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2 pr-1">
          <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: player.color }} />
          <span className="font-bold text-slate-100">{player.name}</span>
        </div>

        {player.inJail && game.phase === "turn-start" ? (
          <div className="flex gap-2">
            <button
              disabled={contextBlocked}
              onClick={() => dispatch({ t: "roll" })}
              className="rounded-xl bg-amber-400 px-5 py-2.5 font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-40"
            >
              🎲 Tenter un double
            </button>
            <button
              disabled={contextBlocked || player.money < 50}
              onClick={() => dispatch({ t: "pay-fine" })}
              className="rounded-xl bg-emerald-500/80 px-3 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400/80 disabled:opacity-40"
            >
              Payer 50 F
            </button>
            <button
              disabled={contextBlocked || player.getOutCards <= 0}
              onClick={() => dispatch({ t: "use-jail-card" })}
              className="rounded-xl bg-sky-500/70 px-3 py-2.5 text-sm font-semibold text-white hover:bg-sky-400/70 disabled:opacity-40"
            >
              🎟️ Carte ({player.getOutCards})
            </button>
          </div>
        ) : game.phase === "turn-start" ? (
          <button
            disabled={contextBlocked}
            onClick={() => dispatch({ t: "roll" })}
            className="rounded-xl bg-amber-400 px-6 py-2.5 font-bold text-slate-900 transition hover:scale-105 hover:bg-amber-300 active:scale-95 disabled:opacity-40"
          >
            🎲 Lancer les dés
          </button>
        ) : game.phase === "post-roll" ? (
          <button
            disabled={contextBlocked}
            onClick={() => dispatch({ t: "end-turn" })}
            className="rounded-xl bg-slate-200 px-6 py-2.5 font-bold text-slate-900 transition hover:bg-white disabled:opacity-40"
          >
            ✅ Terminer le tour
          </button>
        ) : (
          <span className="px-2 text-sm text-slate-500">
            {inBuy ? "Décision d'achat…" : inAuction ? "Enchères en cours…" : inDebt ? "Régler la dette…" : "…"}
          </span>
        )}

        <div className="ml-2 border-l border-white/10 pl-2">
          <button
            onClick={toggleLog}
            className="rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-white/10 hover:text-slate-200"
          >
            📜
          </button>
        </div>
      </div>
      {player.money < 0 && (
        <div className="mt-1 text-center text-xs text-red-400">
          Solde négatif : {formatMoney(player.money)}
        </div>
      )}
      {logOpen && <LogPanel />}
    </div>
  );
}

function LogPanel() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  return (
    <div className="absolute bottom-[76px] left-1/2 w-[420px] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#101a2b]/92 p-3 text-xs backdrop-blur-md">
      <div className="max-h-44 overflow-y-auto">
        {[...game.log].reverse().slice(0, 40).map((entry, i) => (
          <div key={i} className="border-b border-white/5 py-1 text-slate-300 last:border-0">
            {entry}
          </div>
        ))}
      </div>
    </div>
  );
}
