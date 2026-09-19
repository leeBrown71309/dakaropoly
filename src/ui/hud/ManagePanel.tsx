import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { useIsMyTurn, useMySeat } from "../useTurn";
import { BOARD, GROUP_MEMBERS, GROUP_ORDER, STATION_POS, UTILITY_POS } from "../../game/data/board";
import { GROUP_COLORS, GROUP_NAMES, GROUP_ON_COLOR } from "../../game/colors";
import {
  canBuildOn,
  canMortgage,
  canSellHouseOn,
  canUnmortgage,
  houseRefund,
  mortgageValue,
  ownedPositions,
  unmortgageCost,
} from "../../game/selectors";
import { formatMoney, type ColorGroup, type GameState, type Player } from "../../game/types";
import { Card, Label, BrassRule } from "../kit/Surface";
import { Button, Fitting } from "../kit/Button";
import { Money } from "../kit/Money";
import { Tooltip } from "../kit/Tooltip";
import { TitleDeed } from "../kit/TitleDeed";
import { Icon } from "../icons/Icon";

export function ManagePanel() {
  const game = useGame((s) => s.game);
  const manageOpen = useGame((s) => s.manageOpen);
  const toggleManage = useGame((s) => s.toggleManage);
  const compact = useCompact();
  const mySeat = useMySeat();
  const [viewedId, setViewedId] = useState<number | null>(null);

  if (!game) return null;
  const player: Player | undefined = game.players[viewedId ?? mySeat ?? game.current];
  if (!player) return null;

  const ownedGroups = GROUP_ORDER.map((group) => ({
    group,
    positions: GROUP_MEMBERS[group].filter((pos) => game.tiles[pos]?.owner === player.id),
  })).filter((entry) => entry.positions.length > 0);

  const utilities = ownedPositions(game, player.id).filter((pos) => BOARD[pos]?.group === undefined);
  const empty = ownedGroups.length === 0 && utilities.length === 0;

  return (
    <AnimatePresence>
      {manageOpen && (
        <motion.aside
          initial={{ x: 340 }}
          animate={{ x: 0 }}
          exit={{ x: 340 }}
          transition={{ type: "spring", stiffness: 340, damping: 34 }}
          className={`pointer-events-auto absolute right-0 z-40 flex flex-col ${
            compact ? "bottom-[54px] top-1 w-[282px]" : "bottom-24 top-14 w-[324px]"
          }`}
        >
          <Card className="flex min-h-0 flex-1 flex-col rounded-r-none border-r-0">
            <header
              className={`flex items-center gap-2 ${compact ? "px-2.5 pb-1 pt-1.5" : "px-3 pb-2 pt-2.5"}`}
            >
              <Icon name="deed" size={compact ? 15 : 17} className="text-ink-700" />
              <span className={`u-display text-ink-900 ${compact ? "text-[13px]" : "text-[15px]"}`}>
                Patrimoine
              </span>
              <Fitting icon="close" label="Fermer" className="ml-auto !h-7 !w-7" onClick={toggleManage} />
            </header>

            <div className={`flex items-center gap-2 ${compact ? "px-2.5 pb-1.5" : "px-3 pb-2"}`}>
              <div className="relative flex-1">
                <select
                  value={player.id}
                  onChange={(e) => setViewedId(Number(e.target.value))}
                  className="field appearance-none py-1.5 pr-8 text-[12.5px]"
                >
                  {game.players
                    .filter((p) => !p.bankrupt)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
                <Icon
                  name="chevronDown"
                  size={14}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500"
                />
              </div>
              <Money amount={player.money} className="text-[14px] font-bold text-ink-900" />
            </div>

            <BrassRule />

            <div
              className={`scroll-paper min-h-0 flex-1 overflow-y-auto ${
                compact ? "px-2.5 py-1.5" : "px-3 py-2.5"
              }`}
            >
              {empty && (
                <p className="py-6 text-center text-[12.5px] italic text-ink-300">
                  Aucun bien au portefeuille.
                </p>
              )}

              {ownedGroups.map(({ group, positions }) => (
                <section key={group} className="mb-3">
                  <div
                    className="mb-1 inline-flex items-center gap-1.5 rounded-[2px] px-2 py-[3px]"
                    style={{ backgroundColor: GROUP_COLORS[group], color: GROUP_ON_COLOR[group] }}
                  >
                    <span className="u-label">{GROUP_NAMES[group]}</span>
                    <span className="u-label opacity-70">
                      {positions.length}/{GROUP_MEMBERS[group].length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {positions.map((pos) => (
                      <PropertyRow key={pos} pos={pos} player={player} group={group} />
                    ))}
                  </div>
                </section>
              ))}

              {utilities.length > 0 && (
                <section className="mb-2">
                  <div className="mb-1 inline-flex rounded-[2px] bg-ink-700 px-2 py-[3px] text-sand-100">
                    <span className="u-label">Gares & services</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {utilities.map((pos) => (
                      <PropertyRow key={pos} pos={pos} player={player} />
                    ))}
                  </div>
                </section>
              )}
            </div>

            <BrassRule />

            <footer className={`flex items-center justify-between ${compact ? "px-2.5 py-1" : "px-3 py-2"}`}>
              <Label>Réserve de la banque</Label>
              <span className="flex items-center gap-3 text-[12px] font-bold text-ink-700">
                <span className="flex items-center gap-1">
                  <Icon name="house" size={14} className="text-teal-500" />
                  {game.houseStock}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="hotel" size={14} className="text-clay-500" />
                  {game.hotelStock}
                </span>
              </span>
            </footer>
          </Card>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/**
 * Which line of the title deed is the rent this property earns right now.
 *
 * A register that prints six figures without saying which one is live leaves
 * the reading to be done twice — once off the card, once off the board.
 */
function activeRentRow(game: GameState, pos: number): number {
  const tile = BOARD[pos];
  const state = game.tiles[pos];
  if (!tile || !state) return 0;
  if (tile.kind === "street") return state.houses;
  if (tile.kind === "station") {
    return Math.max(1, STATION_POS.filter((p) => game.tiles[p]?.owner === state.owner).length) - 1;
  }
  return UTILITY_POS.filter((p) => game.tiles[p]?.owner === state.owner).length === 2 ? 1 : 0;
}

function PropertyRow({ pos, player, group }: { pos: number; player: Player; group?: ColorGroup }) {
  const game = useGame((s) => s.game);
  const dispatch = useGame((s) => s.dispatch);
  const mySeat = useMySeat();
  const canAct = useIsMyTurn();
  const [deedOpen, setDeedOpen] = useState(false);
  if (!game) return null;
  const tile = BOARD[pos];
  const state = game.tiles[pos];
  if (!tile || !state) return null;

  const buildBlock = canBuildOn(game, player, pos);
  const sellBlock = canSellHouseOn(game, player, pos);
  const mortgageBlock = canMortgage(game, player, pos);
  const unmortgageBlock = canUnmortgage(game, player, pos);
  const isMine = mySeat === player.id;
  const nextRent = tile.rents?.[state.houses + 1];

  return (
    <div
      className="rounded-[3px] px-2 py-1.5"
      style={{
        background: state.mortgaged ? "rgba(142,69,38,.10)" : "rgba(120,95,60,.07)",
        boxShadow: "inset 0 0 0 1px rgba(110,86,52,.18)",
      }}
    >
      <button
        type="button"
        onClick={() => setDeedOpen((open) => !open)}
        aria-expanded={deedOpen}
        className="flex w-full items-center gap-1.5 text-left"
      >
        {group && (
          <span className="h-3.5 w-[3px] rounded-[1px]" style={{ backgroundColor: GROUP_COLORS[group] }} />
        )}
        <span className="truncate text-[12.5px] font-bold text-ink-900">{tile.name}</span>
        <Icon
          name="chevronDown"
          size={12}
          className={`shrink-0 text-ink-300 transition-transform ${deedOpen ? "rotate-180" : ""}`}
        />

        <span className="ml-auto flex items-center gap-0.5">
          {state.mortgaged ? (
            <Icon name="lock" size={13} className="text-clay-700" />
          ) : state.houses === 5 ? (
            <Icon name="hotel" size={14} className="text-clay-500" />
          ) : (
            Array.from({ length: state.houses }).map((_, i) => (
              <Icon key={i} name="house" size={12} className="text-teal-500" />
            ))
          )}
        </span>
      </button>

      {/* The rent register, on demand. It is the same title deed the buy and
          auction panels print, rather than a second copy of the same figures
          left free to drift away from them. */}
      <AnimatePresence initial={false}>
        {deedOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <TitleDeed pos={pos} activeRow={activeRentRow(game, pos)} dense className="mt-1.5" />
          </motion.div>
        )}
      </AnimatePresence>

      {isMine && canAct && (
        <div className="mt-1 flex flex-wrap gap-1">
          {tile.kind === "street" && (
            <>
              <Tooltip
                title={buildBlock?.title ?? "Construire"}
                detail={
                  buildBlock?.detail ??
                  `Une maison de plus sur ${tile.name} pour ${formatMoney(tile.houseCost ?? 0)}${
                    nextRent === undefined ? "" : `, et le loyer passe à ${formatMoney(nextRent)}`
                  }.`
                }
              >
                <Button
                  face="teal"
                  size="sm"
                  icon="hammer"
                  disabled={buildBlock !== null}
                  onClick={() => dispatch({ t: "build", pos })}
                >
                  <Money amount={tile.houseCost ?? 0} />
                </Button>
              </Tooltip>
              <Tooltip
                title={sellBlock?.title ?? "Vendre un bâtiment"}
                detail={
                  sellBlock?.detail ??
                  `La banque reprend un bâtiment pour ${formatMoney(houseRefund(pos))}, la moitié de son prix.`
                }
              >
                <Button
                  face="bone"
                  size="sm"
                  icon="minus"
                  disabled={sellBlock !== null}
                  onClick={() => dispatch({ t: "sell-house", pos })}
                >
                  <Money amount={houseRefund(pos)} signed />
                </Button>
              </Tooltip>
            </>
          )}
          {!state.mortgaged ? (
            <Tooltip
              title={mortgageBlock?.title ?? "Hypothéquer"}
              detail={
                mortgageBlock?.detail ??
                `La banque avance ${formatMoney(mortgageValue(pos))}. Le bien ne rapporte plus de loyer tant que l'hypothèque court.`
              }
            >
              <Button
                face="slate"
                size="sm"
                icon="lock"
                disabled={mortgageBlock !== null}
                onClick={() => dispatch({ t: "mortgage", pos })}
              >
                <Money amount={mortgageValue(pos)} signed />
              </Button>
            </Tooltip>
          ) : (
            <Tooltip
              title={unmortgageBlock?.title ?? "Lever l'hypothèque"}
              detail={
                unmortgageBlock?.detail ??
                `Rembourser coûte ${formatMoney(unmortgageCost(pos))} — la moitié du prix, plus 10 % d'intérêt — et le loyer reprend.`
              }
            >
              <Button
                face="gold"
                size="sm"
                icon="key"
                disabled={unmortgageBlock !== null}
                onClick={() => dispatch({ t: "unmortgage", pos })}
              >
                <Money amount={-unmortgageCost(pos)} signed />
              </Button>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
