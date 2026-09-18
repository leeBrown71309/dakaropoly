import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { formatMoney } from "../../game/types";
import { netWorthOf } from "../../game/selectors";

export function DebtPanel() {
  const game = useGame((s) => s.game);
  const dispatch = useGame((s) => s.dispatch);
  if (!game || game.phase !== "debt" || !game.debt) return null;
  const debt = game.debt;
  const player = game.players[game.current];
  if (!player) return null;
  const creditor = debt.creditor !== null ? game.players[debt.creditor] : null;
  const canPay = player.money >= debt.amount;

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-28 left-1/2 z-30 w-[380px] -translate-x-1/2 rounded-2xl border border-red-400/50 bg-[#1c1016]/93 p-4 backdrop-blur-md"
    >
      <h3 className="mb-1 text-lg font-bold text-red-300">⚠️ Dettes</h3>
      <p className="mb-1 text-sm text-slate-300">
        {player.name} doit {formatMoney(debt.amount)} à {creditor ? creditor.name : "la banque"}.
      </p>
      <p className="mb-3 text-xs text-slate-500">
        Fonds : {formatMoney(player.money)} · Patrimoine : {formatMoney(netWorthOf(game, player))}
      </p>
      <div className="flex gap-2">
        <button
          disabled={!canPay}
          onClick={() => dispatch({ t: "pay-debt" })}
          className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-40"
        >
          Payer maintenant
        </button>
        <button
          onClick={() => dispatch({ t: "declare-bankruptcy" })}
          className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-500"
        >
          🏴 Déclarer faillite
        </button>
      </div>
      {!canPay && (
        <p className="mt-2 text-center text-xs text-slate-500">
          Pas assez de fonds — vendez des bâtiments / hypothéquez via le patrimoine.
        </p>
      )}
    </motion.div>
  );
}
