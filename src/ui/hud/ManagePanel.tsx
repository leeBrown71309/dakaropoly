import { useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { BOARD } from "../../game/data/board";
import { GROUP_COLORS, GROUP_NAMES } from "../../game/colors";
import { formatMoney } from "../../game/types";
import { canBuildOn, canMortgage, canSellHouseOn, canUnmortgage, houseRefund, mortgageValue, unmortgageCost } from "../../game/selectors";

export function ManagePanel() {
  const game = useGame((s) => s.game);
  const manageOpen = useGame((s) => s.manageOpen);
  const toggleManage = useGame((s) => s.toggleManage);
  const dispatch = useGame((s) => s.dispatch);
  const [playerId, setPlayerId] = useState<number | null>(null);

  if (!game) return null;
  const player = game.players[playerId ?? game.current] ?? null;
  if (!player) return null;

  const groups: Record<string, number[]> = {};
  BOARD.forEach((tile, pos) => {
    if (tile.group && game.tiles[pos]?.owner === player.id) {
      groups[tile.group] = [...(groups[tile.group] ?? []), pos];
    }
  });
  const others = BOARD.map((_, pos) => pos).filter(
    (pos) => game.tiles[pos]?.owner === player.id && !BOARD[pos]?.group,
  );

  return (
    <>
      <button
        onClick={toggleManage}
        className="absolute right-3 top-14 z-30 rounded-xl border border-white/10 bg-[#101a2b]/80 px-3 py-2 text-sm text-slate-200 backdrop-blur-md hover:bg-white/10"
      >
        🏠 Patrimoine
      </button>
      {manageOpen && (
        <motion.div
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          exit={{ x: 320 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute right-3 top-14 z-30 max-h-[70vh] w-80 overflow-y-auto rounded-2xl border border-white/10 bg-[#101a2b]/90 p-4 backdrop-blur-md"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-100">Patrimoine</h3>
            <div className="text-xs text-slate-400">{formatMoney(player.money)}</div>
          </div>
          <select
            value={player.id}
            onChange={(e) => setPlayerId(Number(e.target.value))}
            className="mb-3 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-sm text-slate-200"
          >
            {game.players.filter((p) => !p.bankrupt).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {Object.entries(groups).length === 0 && others.length === 0 && (
            <p className="text-sm text-slate-500">Aucun bien.</p>
          )}
          {Object.entries(groups).map(([group, positions]) => (
            <div key={group} className="mb-4">
              <div
                className="mb-1 inline-block rounded px-2 py-0.5 text-xs font-bold text-slate-900"
                style={{ backgroundColor: GROUP_COLORS[group] }}
              >
                {GROUP_NAMES[group]}
              </div>
              <div className="flex flex-col gap-2">
                {positions.map((pos) => {
                  const tile = BOARD[pos];
                  const st = game.tiles[pos];
                  if (!tile || !st) return null;
                  const st2 = st;
                  return (
                    <div key={pos} className="rounded-xl border border-white/10 bg-black/20 p-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-100">{tile.name}</span>
                        <span className="text-slate-400">
                          {st2.mortgaged ? "🔒 hypothèque" : st2.houses === 5 ? "🏨 hôtel" : st2.houses > 0 ? `${st2.houses} 🏠` : ""}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <button
                          onClick={() => dispatch({ t: "build", pos })}
                          disabled={canBuildOn(game, player, pos) !== null}
                          title={canBuildOn(game, player, pos) ?? "Construire"}
                          className="rounded bg-emerald-600/80 px-2 py-1 text-xs font-semibold text-white disabled:opacity-30"
                        >
                          + 🏠 {tile.houseCost}
                        </button>
                        <button
                          onClick={() => dispatch({ t: "sell-house", pos })}
                          disabled={canSellHouseOn(game, player, pos) !== null}
                          className="rounded bg-white/10 px-2 py-1 text-xs text-slate-200 disabled:opacity-30"
                        >
                          − 🏠 +{houseRefund(pos)}
                        </button>
                        {!st2.mortgaged ? (
                          <button
                            onClick={() => dispatch({ t: "mortgage", pos })}
                            disabled={canMortgage(game, player, pos) !== null}
                            title={canMortgage(game, player, pos) ?? "Hypothéquer"}
                            className="rounded bg-amber-600/70 px-2 py-1 text-xs font-semibold text-white disabled:opacity-30"
                          >
                            Hypo. +{mortgageValue(pos)}
                          </button>
                        ) : (
                          <button
                            onClick={() => dispatch({ t: "unmortgage", pos })}
                            disabled={canUnmortgage(game, player, pos) !== null}
                            className="rounded bg-sky-600/70 px-2 py-1 text-xs font-semibold text-white disabled:opacity-30"
                          >
                            Lever −{unmortgageCost(pos)}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-3 border-t border-white/10 pt-2 text-xs text-slate-500">
            Banque : {game.houseStock} 🏠 · {game.hotelStock} 🏨
          </div>
        </motion.div>
      )}
    </>
  );
}
