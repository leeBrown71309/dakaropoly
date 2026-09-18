import { useGame } from "../../game/store";
import { formatMoney } from "../../game/types";
import { ownedPositions } from "../../game/selectors";

export function PlayersPanel() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  return (
    <div className="absolute left-3 top-3 z-30 flex w-56 flex-col gap-1.5">
      {game.players.map((p) => (
        <div
          key={p.id}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 backdrop-blur-md transition ${
            game.current === p.id && game.phase !== "game-over"
              ? "border-amber-400/70 bg-amber-400/10"
              : "border-white/10 bg-[#101a2b]/80"
          } ${p.bankrupt ? "opacity-40" : ""}`}
        >
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-100">
              {p.name}
              {p.inJail && " 🔒"}
              {p.getOutCards > 0 && " 🎟️"}
            </div>
            <div className="text-xs text-slate-400">
              {p.bankrupt ? "Faillite" : formatMoney(p.money)} · {ownedPositions(game, p.id).length} biens
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
