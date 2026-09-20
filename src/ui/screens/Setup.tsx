import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";
import { NAME_MAX } from "../../game/types";
import { useCompact } from "../useViewport";
import { PAWN_NAMES, PAWN_SHAPES, PLAYER_COLORS } from "../../game/data/pawns";
import { Card, Label, BrassRule } from "../kit/Surface";
import { Button, Fitting } from "../kit/Button";
import { PawnGlyph } from "../icons/PawnGlyph";
import { Icon } from "../icons/Icon";

interface Draft {
  name: string;
  pawn: number;
}

const MAX_PLAYERS = 8;

/**
 * The roster, laid out as a printed entry form filled in before the game.
 *
 * A phone in landscape is wide and short, so the form turns the other way:
 * two columns of players instead of one long scroll.
 */
export function Setup() {
  const startGame = useGame((s) => s.startGame);
  const goHome = useGame((s) => s.goHome);
  const compact = useCompact();
  const [players, setPlayers] = useState<Draft[]>([
    { name: "", pawn: 0 },
    { name: "", pawn: 1 },
  ]);

  const takenBy = (pawn: number, exceptIndex: number) =>
    players.some((p, i) => i !== exceptIndex && p.pawn === pawn);

  const valid = players.length >= 2 && players.every((p) => p.name.trim().length > 0);

  const update = (index: number, patch: Partial<Draft>) =>
    setPlayers((ps) => ps.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const addPlayer = () =>
    setPlayers((ps) => {
      const used = new Set(ps.map((p) => p.pawn));
      const free = PAWN_SHAPES.findIndex((_, i) => !used.has(i));
      return [...ps, { name: "", pawn: free === -1 ? 0 : free }];
    });

  return (
    <div className="mat-felt h-full overflow-hidden">
      <div className="p-safe h-full">
        <div className={`scroll-paper h-full overflow-y-auto ${compact ? "px-3 py-3" : "px-6 py-8"}`}>
          <div className={`mx-auto max-w-full ${compact ? "w-[880px]" : "w-[620px]"}`}>
            <div className={`flex items-center gap-3 ${compact ? "mb-2" : "mb-4"}`}>
              <Fitting icon="arrowLeft" label="Retour" onClick={goHome} />
              <h1 className={`u-display text-sand-100 ${compact ? "text-[16px]" : "text-[22px]"}`}>
                Qui joue ce soir&nbsp;?
              </h1>
              <span className="u-label ml-auto text-sand-300/70">
                {players.length} / {MAX_PLAYERS}
              </span>
            </div>

            <Card className={compact ? "p-2.5" : "p-4"}>
              {!compact && (
                <>
                  <div className="mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-3 px-1">
                    <Label>Pion</Label>
                    <Label>Nom du joueur</Label>
                    <span />
                  </div>
                  <BrassRule className="mb-3" />
                </>
              )}

              <div className={compact ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2.5"}>
                <AnimatePresence initial={false}>
                  {players.map((p, i) => (
                    <motion.div
                      key={i}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className={`rounded-[3px] ${compact ? "p-2" : "p-2.5"}`}
                      style={{
                        background: "rgba(120,95,60,.07)",
                        boxShadow: "inset 0 0 0 1px rgba(110,86,52,.2)",
                      }}
                    >
                      <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
                        <span
                          className={`flex shrink-0 items-center justify-center rounded-[3px] ${
                            compact ? "h-9 w-9" : "h-11 w-11"
                          }`}
                          style={{
                            color: PLAYER_COLORS[p.pawn],
                            background: "linear-gradient(180deg,#fdfaf2,#efe5cf)",
                            boxShadow: "inset 0 0 0 1px rgba(110,86,52,.25), 0 1px 2px rgba(80,60,30,.2)",
                          }}
                        >
                          <PawnGlyph pawn={p.pawn} size={compact ? 24 : 30} />
                        </span>

                        <div className="min-w-0 flex-1">
                          <input
                            value={p.name}
                            onChange={(e) => update(i, { name: e.target.value })}
                            placeholder={`Joueur ${i + 1}`}
                            maxLength={NAME_MAX}
                            className={`field ${compact ? "py-1 text-[12.5px]" : "text-[14px]"}`}
                          />
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {PAWN_SHAPES.map((_, pi) => {
                              const disabled = takenBy(pi, i);
                              const chosen = p.pawn === pi;
                              return (
                                <button
                                  key={pi}
                                  type="button"
                                  disabled={disabled}
                                  title={PAWN_NAMES[pi]}
                                  aria-label={PAWN_NAMES[pi]}
                                  onClick={() => update(i, { pawn: pi })}
                                  className={`flex items-center justify-center rounded-[3px] transition disabled:cursor-not-allowed disabled:opacity-20 ${
                                    compact ? "h-7 w-7" : "h-8 w-8"
                                  }`}
                                  style={{
                                    color: PLAYER_COLORS[pi],
                                    background: chosen ? "rgba(232,162,59,.22)" : "transparent",
                                    boxShadow: chosen
                                      ? "inset 0 0 0 1.5px rgba(168,112,31,.9)"
                                      : "inset 0 0 0 1px rgba(110,86,52,.18)",
                                  }}
                                >
                                  <PawnGlyph pawn={pi} size={compact ? 17 : 20} />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {players.length > 2 && (
                          <Fitting
                            icon="close"
                            label={`Retirer le joueur ${i + 1}`}
                            className="!h-8 !w-8 self-start"
                            onClick={() => setPlayers((ps) => ps.filter((_, idx) => idx !== i))}
                          />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {players.length < MAX_PLAYERS && (
                <button
                  type="button"
                  onClick={addPlayer}
                  className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-[3px] font-bold text-ink-500 transition hover:text-ink-900 ${
                    compact ? "py-1.5 text-[12px]" : "py-2.5 text-[12.5px]"
                  }`}
                  style={{ boxShadow: "inset 0 0 0 1.5px rgba(110,86,52,.28)", borderStyle: "dashed" }}
                >
                  <Icon name="plus" size={15} />
                  Ajouter un joueur
                </button>
              )}
            </Card>

            <div className={`flex justify-center ${compact ? "mt-3" : "mt-5"}`}>
              <Button
                face="gold"
                size={compact ? "md" : "lg"}
                icon="dice"
                disabled={!valid}
                onClick={() => startGame(players.map((p) => ({ name: p.name.trim(), pawn: p.pawn })))}
              >
                Lancer la partie
              </Button>
            </div>
            {!valid && (
              <p className="mt-2 text-center text-[11.5px] text-sand-300/70">
                Chaque joueur doit avoir un nom.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
