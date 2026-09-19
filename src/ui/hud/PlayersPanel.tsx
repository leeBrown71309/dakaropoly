import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../../game/store";
import { useRoom } from "../../net/roomStore";
import { useVoice } from "../../net/voice";
import { useCompact } from "../useViewport";
import { GROUP_MEMBERS, GROUP_ORDER } from "../../game/data/board";
import { GROUP_COLORS } from "../../game/colors";
import { ownedPositions } from "../../game/selectors";
import type { GameState, Player } from "../../game/types";
import { Card } from "../kit/Surface";
import { Money } from "../kit/Money";
import { Icon, type IconName } from "../icons/Icon";
import { PlayerMark } from "../icons/PlayerMark";

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

const SLIDE = { type: "spring", stiffness: 480, damping: 38 } as const;

interface TabProps {
  label: string;
  icon: IconName;
  count: number;
  active: boolean;
  compact: boolean;
  onSelect: () => void;
}

/** One face of the register, printed on the header of the card. */
function Tab({ label, icon, count, active, compact, onSelect }: TabProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title={label}
      className={`u-label relative flex items-center gap-1 px-1.5 pb-1 pt-0.5 transition-colors ${
        active ? "text-ink-900" : "text-ink-300 hover:text-ink-500"
      }`}
    >
      {compact ? <Icon name={icon} size={13} /> : label}
      {count > 0 && <span className={active ? "text-gold-700" : ""}>{count}</span>}
      {active && <span className="mat-brass absolute inset-x-1 bottom-0 h-[2px] rounded-full" />}
    </button>
  );
}

/**
 * Whether this device can hear that one, and whether they are talking.
 *
 * Nothing at all until somebody opens a microphone: a row of grey mics on a
 * table where nobody is talking says less than empty space does.
 */
function VoiceMark({ clientId, compact }: { clientId: string | undefined; compact: boolean }) {
  const active = useVoice((s) => s.active);
  const state = useVoice((s) => (clientId ? s.peers[clientId] : undefined));
  const talking = useVoice((s) => (clientId ? s.talking[clientId] === true : false));
  const self = useRoom((s) => s.clientId);

  if (!active || !clientId) return null;
  const up = clientId === self || state === "connected";
  if (!up) return null;

  return (
    <Icon
      name="mic"
      size={compact ? 10 : 12}
      className={`shrink-0 transition-colors ${talking ? "text-teal-500" : "text-ink-300"}`}
      style={talking ? { filter: "drop-shadow(0 0 3px rgba(62,156,148,.8))" } : undefined}
    />
  );
}

function PlayerRow({ game, player: p, compact }: { game: GameState; player: Player; compact: boolean }) {
  // The device actually sitting in this chair, which is not necessarily the
  // one `seat_order` still names: its occupant may have got up and come back
  // to watch instead.
  const clientId = useRoom((s) => s.seats.find((row) => row.seat === p.id)?.clientId);
  const active = game.current === p.id && game.phase !== "game-over";
  const holdings = holdingsOf(game, p);
  const count = ownedPositions(game, p.id).length;

  return (
    <li
      className={`relative flex items-center ${
        compact ? "gap-1.5 py-[3px] pr-1.5" : "gap-2.5 py-1.5 pr-3"
      } ${p.bankrupt ? "opacity-45 saturate-50" : ""}`}
    >
      {active && (
        <span
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, rgba(205,161,88,.22), rgba(205,161,88,.04))" }}
        />
      )}

      {/* Enamel colour tab identifying the player */}
      <span
        className={compact ? "w-[5px] self-stretch" : "w-[7px] self-stretch"}
        style={{
          backgroundColor: p.color,
          boxShadow: "inset -1px 0 2px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.35)",
        }}
      />

      <PlayerMark player={p} size={compact ? 16 : 24} className="relative" />

      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`u-display truncate leading-tight text-ink-900 ${
              compact ? "text-[11px]" : "text-[14px]"
            }`}
          >
            {p.name}
          </span>
          <VoiceMark clientId={clientId} compact={compact} />
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
                      h.owned === h.total
                        ? "0 0 0 1px rgba(33,30,25,.45)"
                        : "0 0 0 1px rgba(33,30,25,.2)",
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
    </li>
  );
}

function SpectatorRow({
  clientId,
  name,
  here,
  mine,
  compact,
}: {
  clientId: string;
  name: string;
  here: boolean;
  mine: boolean;
  compact: boolean;
}) {
  return (
    <li
      className={`relative flex items-center ${
        compact ? "gap-1.5 py-[3px] pr-1.5" : "gap-2.5 py-1.5 pr-3"
      } ${here ? "" : "opacity-45"}`}
    >
      {/* Neutral tab: a spectator owns nothing to be coloured for */}
      <span
        className={compact ? "w-[5px] self-stretch" : "w-[7px] self-stretch"}
        style={{
          backgroundColor: "#9A8F7C",
          boxShadow: "inset -1px 0 2px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.35)",
        }}
      />

      <Icon name="eye" size={compact ? 13 : 18} className="relative shrink-0 text-ink-300" />

      <div className="relative flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className={`u-display truncate leading-tight text-ink-900 ${
            compact ? "text-[11px]" : "text-[14px]"
          }`}
        >
          {name}
        </span>
        <VoiceMark clientId={clientId} compact={compact} />
        {mine && <span className="u-label shrink-0 text-gold-700">vous</span>}
      </div>

      <span
        className="relative h-1.5 w-1.5 shrink-0 rounded-full"
        title={here ? "connecté" : "absent"}
        style={{ backgroundColor: here ? "#1E6F6B" : "#9A8F7C" }}
      />
    </li>
  );
}

/**
 * The bank's register: one card against the left edge with two faces — the
 * players, and, online, the spectators standing behind them. A chevron folds
 * the whole thing into a tab and hands the space back to the board: every
 * figure it holds is visible elsewhere, so it only earns its width while it
 * is being looked at.
 *
 * Eight players on a phone in landscape is the worst case the HUD has to
 * hold — the compact card is sized so that the whole stack still clears the
 * turn sign above it.
 */
export function PlayersPanel() {
  const game = useGame((s) => s.game);
  const online = useGame((s) => s.online);
  const open = useGame((s) => s.rosterOpen);
  const tab = useGame((s) => s.rosterTab);
  const toggleRoster = useGame((s) => s.toggleRoster);
  const setRosterTab = useGame((s) => s.setRosterTab);
  const watchers = useRoom((s) => s.watchers);
  const present = useRoom((s) => s.present);
  const clientId = useRoom((s) => s.clientId);
  const compact = useCompact();

  if (!game) return null;

  // Presence, not the database: the watchers list is rebuilt from the
  // channel on every sync and cached for the tab across a reload.
  const spectators = online ? watchers : [];
  const showSpectators = online && tab === "spectators";

  return (
    <div className={`pointer-events-none absolute left-0 z-30 ${compact ? "top-1" : "top-4"}`}>
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="roster"
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={SLIDE}
          >
            <Card
              className={`pointer-events-auto rounded-l-none border-l-0 ${
                compact ? "w-[152px]" : "w-[236px]"
              }`}
            >
              <div className={`flex items-center gap-0.5 ${compact ? "pl-1 pr-1 pt-1" : "pl-2 pr-1 pt-1.5"}`}>
                <Tab
                  label="Joueurs"
                  icon="ranking"
                  count={game.players.length}
                  active={!showSpectators}
                  compact={compact}
                  onSelect={() => setRosterTab("players")}
                />
                {online && (
                  <Tab
                    label="Spectateurs"
                    icon="eye"
                    count={spectators.length}
                    active={showSpectators}
                    compact={compact}
                    onSelect={() => setRosterTab("spectators")}
                  />
                )}
                <button
                  type="button"
                  onClick={toggleRoster}
                  title="Masquer la liste"
                  aria-label="Masquer la liste"
                  className="ml-auto flex h-6 w-6 items-center justify-center rounded-[3px] text-ink-300 transition-colors hover:bg-black/5 hover:text-ink-900"
                >
                  <Icon name="chevronDown" size={compact ? 12 : 14} className="rotate-90" />
                </button>
              </div>

              <div className="rule-brass mx-1.5 opacity-70" />

              {showSpectators ? (
                spectators.length > 0 ? (
                  <ul className={`divide-y divide-[rgba(110,86,52,.16)] ${compact ? "pb-1" : "pb-1.5"}`}>
                    {spectators.map((s) => (
                      <SpectatorRow
                        key={s.clientId}
                        clientId={s.clientId}
                        name={s.name}
                        here={present.includes(s.clientId)}
                        mine={s.clientId === clientId}
                        compact={compact}
                      />
                    ))}
                  </ul>
                ) : (
                  <p
                    className={`text-center italic text-ink-300 ${
                      compact ? "px-1 py-2 text-[10.5px]" : "px-2 py-3 text-[12px]"
                    }`}
                  >
                    Aucun spectateur
                  </p>
                )
              ) : (
                <ul className={`divide-y divide-[rgba(110,86,52,.16)] ${compact ? "pb-1" : "pb-1.5"}`}>
                  {game.players.map((p) => (
                    <PlayerRow key={p.id} game={game} player={p} compact={compact} />
                  ))}
                </ul>
              )}
            </Card>
          </motion.div>
        ) : (
          <motion.button
            key="tab"
            type="button"
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={SLIDE}
            onClick={toggleRoster}
            title="Afficher la liste"
            aria-label="Afficher la liste"
            className={`mat-card mat-grain pointer-events-auto flex items-center gap-1.5 rounded-l-none border-l-0 ${
              compact ? "px-1.5 py-1.5" : "gap-2 px-2 py-2"
            }`}
          >
            <Icon name="chevronDown" size={compact ? 12 : 15} className="-rotate-90 text-ink-500" />
            <span className="u-label text-ink-500">{game.players.length}</span>
            {online && spectators.length > 0 && (
              <span className="flex items-center gap-0.5 text-ink-300">
                <Icon name="eye" size={compact ? 11 : 13} />
                <span className="u-label">{spectators.length}</span>
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
