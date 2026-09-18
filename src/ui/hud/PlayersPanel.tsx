import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { GROUP_MEMBERS, GROUP_ORDER } from "../../game/data/board";
import { GROUP_COLORS } from "../../game/colors";
import { ownedPositions } from "../../game/selectors";
import type { GameState, Player } from "../../game/types";
import { Card } from "../kit/Surface";
import { Money } from "../kit/Money";
import { PawnGlyph } from "../icons/PawnGlyph";
import { Icon } from "../icons/Icon";

interface GroupHolding {
  group: string;
  color: string;
  owned: number;
  total: number;
}

function holdingsOf(game: GameState, player: Player): GroupHolding[] {
  return GROUP_ORDER.map((group) => {
    const members = GROUP_MEMBERS[group];
    return {
      group,
      color: GROUP_COLORS[group],
      owned: members.filter((pos) => game.tiles[pos]?.owner === player.id).length,
      total: members.length,
    };
  }).filter((h) => h.owned > 0);
}

/**
 * The bank's register: one card per player, butted against the left edge of
 * the screen. The player to move slides proud of the stack.
 *
 * Eight players on a phone in landscape is the worst case the HUD has to
 * hold — the compact card is sized so that the whole stack still clears the
 * turn sign above it.
 */
export function PlayersPanel() {
  const game = useGame((s) => s.game);
  const compact = useCompact();
  if (!game) return null;

  return (
    <div
      className={`pointer-events-none absolute left-0 z-30 flex flex-col ${
        compact ? "top-1 gap-[3px]" : "top-4 gap-1.5"
      }`}
    >
      {game.players.map((p) => {
        const active = game.current === p.id && game.phase !== "game-over";
        const holdings = holdingsOf(game, p);
        const count = ownedPositions(game, p.id).length;

        return (
          <div
            key={p.id}
            className={`transition-transform duration-300 ease-out ${active ? "translate-x-0" : "-translate-x-2.5"}`}
          >
            <Card
              className={`relative flex items-center overflow-hidden rounded-l-none border-l-0 ${
                compact ? "w-[148px] gap-1.5 py-[3px] pr-1.5" : "w-[226px] gap-2.5 py-1.5 pr-3"
              } ${p.bankrupt ? "opacity-45 saturate-50" : ""}`}
              style={
                active
                  ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,.9), 0 14px 30px -10px rgba(52,33,12,.65)" }
                  : undefined
              }
            >
              {/* Enamel colour tab identifying the player */}
              <span
                className={compact ? "w-[5px] self-stretch" : "w-[7px] self-stretch"}
                style={{
                  backgroundColor: p.color,
                  boxShadow: "inset -1px 0 2px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.35)",
                }}
              />

              <span style={{ color: p.color }} className="shrink-0">
                <PawnGlyph pawn={p.pawn} size={compact ? 17 : 26} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`u-display truncate leading-tight text-ink-900 ${
                      compact ? "text-[11px]" : "text-[14px]"
                    }`}
                  >
                    {p.name}
                  </span>
                  {p.inJail && <Icon name="jail" size={compact ? 10 : 12} className="shrink-0 text-clay-700" />}
                  {p.getOutCards > 0 && (
                    <Icon name="key" size={compact ? 10 : 12} className="shrink-0 text-gold-700" />
                  )}
                </div>

                <div className={`flex items-center gap-2 ${compact ? "" : "mt-0.5"}`}>
                  {p.bankrupt ? (
                    <span className="u-label text-clay-700">Faillite</span>
                  ) : (
                    <Money
                      amount={p.money}
                      className={`font-bold leading-none text-ink-900 ${
                        compact ? "text-[10.5px]" : "text-[13px]"
                      }`}
                    />
                  )}

                  {holdings.length > 0 && (
                    <span className="flex items-center gap-[2px]">
                      {holdings.map((h) => (
                        <span
                          key={h.group}
                          title={`${h.owned}/${h.total}`}
                          className={compact ? "h-2 w-[4px] rounded-[1px]" : "h-2.5 w-[5px] rounded-[1px]"}
                          style={{
                            backgroundColor: h.color,
                            opacity: h.owned === h.total ? 1 : 0.42,
                            boxShadow:
                              h.owned === h.total ? "0 0 0 1px rgba(33,30,25,.45)" : "0 0 0 1px rgba(33,30,25,.2)",
                          }}
                        />
                      ))}
                    </span>
                  )}

                  {count > 0 && !compact && <span className="u-label ml-auto text-ink-300">{count}</span>}
                </div>
              </div>

              {/* Brass edge marking whose turn it is */}
              {active && <span className="mat-brass absolute inset-y-0 right-0 w-[3px]" />}
            </Card>
          </div>
        );
      })}
    </div>
  );
}
