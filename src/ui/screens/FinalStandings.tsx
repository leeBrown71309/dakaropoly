import { motion } from "framer-motion";
import { netWorthOf, ownedPositions, standingsOf } from "../../game/selectors";
import type { GameState } from "../../game/types";
import { Card, Label, BrassRule } from "../kit/Surface";
import { Money } from "../kit/Money";
import { Icon, type IconName } from "../icons/Icon";
import { PlayerMark } from "../icons/PlayerMark";

interface AwardDef {
  icon: IconName;
  label: string;
  of: (s: GameState) => Record<number, number>;
  min: number;
}

const AWARDS: AwardDef[] = [
  {
    icon: "crown",
    label: "Roi du loyer",
    of: (s) => Object.fromEntries(s.players.map((p) => [p.id, p.stats.rentsCollected])),
    min: 1,
  },
  {
    icon: "jail",
    label: "Client fidèle de Rebeuss",
    of: (s) => Object.fromEntries(s.players.map((p) => [p.id, p.stats.jailVisits])),
    min: 1,
  },
  {
    icon: "hotel",
    label: "Baron de l'immobilier",
    of: (s) => Object.fromEntries(s.players.map((p) => [p.id, p.stats.purchases])),
    min: 1,
  },
  {
    icon: "banknote",
    label: "Tirelire percée",
    of: (s) => Object.fromEntries(s.players.map((p) => [p.id, p.stats.rentPaid])),
    min: 1,
  },
  {
    icon: "cowrie",
    label: "Fils de la chance",
    of: (s) => Object.fromEntries(s.players.map((p) => [p.id, p.stats.cardsDrawn])),
    min: 1,
  },
];

function computeAwards(game: GameState): { icon: IconName; label: string; name: string }[] {
  const results: { icon: IconName; label: string; name: string }[] = [];
  for (const award of AWARDS) {
    const values = award.of(game);
    const best = Object.entries(values).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= award.min) {
      const player = game.players[Number(best[0])];
      if (player) results.push({ icon: award.icon, label: award.label, name: player.name });
    }
  }
  return results.slice(0, 3);
}

interface FinalStandingsProps {
  game: GameState;
  compact: boolean;
  /** The small print above the title. */
  caption?: string;
  /**
   * The table stopped before anybody won — everyone left and the room
   * closed. The order is then the net worth of the last turn played.
   */
  unfinished?: boolean;
  /**
   * Each player's photo, by player id, when the game is read back from the
   * history. Left out, photos come from the room this device is in.
   */
  photos?: Record<number, string | null>;
}

/**
 * The card a game ends on: who won, the table in its final order, and the
 * evening's dubious prizes.
 *
 * Drawn from nothing but the board, so the same card serves the game that
 * has just finished and any game read back from the history.
 */
export function FinalStandings({
  game,
  compact,
  caption = "Fin de partie",
  unfinished = false,
  photos,
}: FinalStandingsProps) {
  const ranking = standingsOf(game);
  const winner = !unfinished && game.winner !== null ? game.players[game.winner] : null;
  const awards = computeAwards(game);
  const title = unfinished ? "Partie inachevée" : winner ? `${winner.name} remporte Dakar` : "Match nul";
  const summary = unfinished
    ? `Arrêtée au tour ${game.turnCount} · classement au patrimoine`
    : `${game.turnCount} tours joués · ${ranking.length} patrimoines évalués`;

  return (
    <Card className={`relative text-center ${compact ? "px-4 pb-4 pt-5" : "px-7 pb-7 pt-8"}`}>
      {/* Wax seal */}
      <motion.span
        initial={{ scale: 0.4, rotate: -24, opacity: 0 }}
        animate={{ scale: 1, rotate: -8, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 14, delay: 0.15 }}
        className={`absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full ${
          compact ? "-top-4 h-11 w-11" : "-top-6 h-16 w-16"
        }`}
        style={{
          background: "radial-gradient(circle at 35% 30%, #D98A63 0%, #A84E2B 55%, #7A3419 100%)",
          boxShadow: "0 8px 18px -6px rgba(60,25,10,.7), inset 0 2px 4px rgba(255,255,255,.28)",
          color: "#F7E3D3",
        }}
      >
        <Icon name="crown" size={compact ? 20 : 28} strokeWidth={1.6} />
      </motion.span>

      <div className={`u-label text-gold-700 ${compact ? "mt-4" : "mt-6"}`}>{caption}</div>
      <h1 className={`u-display mt-1.5 leading-tight text-ink-900 ${compact ? "text-[21px]" : "text-[28px]"}`}>
        {title}
      </h1>
      <p className={`mt-1 text-ink-500 ${compact ? "text-[11px]" : "text-[12.5px]"}`}>{summary}</p>

      <BrassRule className={compact ? "my-3" : "my-5"} />

      <div className={`flex flex-col text-left ${compact ? "gap-1" : "gap-1.5"}`}>
        {ranking.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.09 }}
            className={`flex items-center gap-3 rounded-[3px] ${compact ? "px-2 py-1" : "px-3 py-2"}`}
            style={{
              background: i === 0 ? "rgba(232,162,59,.16)" : "rgba(120,95,60,.07)",
              boxShadow: i === 0 ? "inset 0 0 0 1.5px rgba(168,112,31,.65)" : "inset 0 0 0 1px rgba(110,86,52,.18)",
            }}
          >
            <span
              className="u-label flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px]"
              style={
                i === 0
                  ? { background: "linear-gradient(180deg,#f2d69f,#9a6f2c)", color: "#3A2A08" }
                  : { background: "rgba(110,86,52,.18)", color: "#6B6152" }
              }
            >
              {i + 1}
            </span>
            <PlayerMark player={p} size={compact ? 20 : 24} avatar={photos ? (photos[p.id] ?? null) : undefined} />
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ink-900">
              {p.name}
              {p.bankrupt && <span className="ml-2 u-label text-clay-700">Faillite</span>}
            </span>
            <span className="u-label shrink-0 text-ink-300">{ownedPositions(game, p.id).length} biens</span>
            <Money amount={netWorthOf(game, p)} className="shrink-0 text-[14px] font-bold text-ink-900" />
          </motion.div>
        ))}
      </div>

      {awards.length > 0 && (
        <>
          <BrassRule className={compact ? "my-3" : "my-5"} />
          <Label>Les prix douteux de la soirée</Label>
          <div className={`flex flex-col gap-1.5 ${compact ? "mt-1.5" : "mt-2.5"}`}>
            {awards.map((a, i) => (
              <motion.div
                key={a.label}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.12 }}
                className="flex items-center gap-2.5 rounded-[3px] px-3 py-1.5 text-left"
                style={{ boxShadow: "inset 0 0 0 1px rgba(110,86,52,.2)" }}
              >
                <Icon name={a.icon} size={16} className="shrink-0 text-clay-500" />
                <span className="text-[12.5px] font-bold text-ink-900">{a.label}</span>
                <span className="ml-auto text-[12.5px] text-ink-500">{a.name}</span>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
