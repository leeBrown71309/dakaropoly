import { standingsOf } from "../../game/selectors";
import {
  avatarOf,
  durationOf,
  finalBoardOf,
  finalOccupant,
  mySeat,
  nameOf,
  placeOf,
  takeoversIn,
  wonBy,
  type GameStatus,
  type History,
  type HistoryGame,
  type Person,
} from "../../net/history";
import { Icon } from "../icons/Icon";
import { PlayerMark } from "../icons/PlayerMark";
import { formatDuration, formatPlace, formatWhen } from "./format";

const STATUS: Record<GameStatus, { label: string; color: string; background: string }> = {
  finished: { label: "Terminée", color: "#12494A", background: "rgba(30,111,107,.14)" },
  unfinished: { label: "Inachevée", color: "#6B6152", background: "rgba(110,86,52,.14)" },
  playing: { label: "En cours", color: "#7A5212", background: "rgba(232,162,59,.2)" },
};

interface GameHistoryProps {
  history: History;
  userId: string;
  compact: boolean;
  onOpen: (gameId: string) => void;
}

/** The account's recent games, newest first. */
export function GameHistory({ history, userId, compact, onOpen }: GameHistoryProps) {
  if (history.games.length === 0) {
    return (
      <p className={`leading-snug text-ink-500 ${compact ? "text-[12px]" : "text-[13px]"}`}>
        Aucune partie pour l'instant. Les parties jouées en ligne en étant connecté apparaîtront ici, terminées ou
        non.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {history.games.map((g) => (
        <GameRow key={g.id} game={g} people={history.people} userId={userId} compact={compact} onOpen={onOpen} />
      ))}
    </div>
  );
}

interface GameRowProps {
  game: HistoryGame;
  people: Record<string, Person>;
  userId: string;
  compact: boolean;
  onOpen: (gameId: string) => void;
}

function GameRow({ game, people, userId, compact, onOpen }: GameRowProps) {
  const board = finalBoardOf(game, people);
  const seat = mySeat(game, userId);
  const place = seat !== null ? placeOf(game, seat) : null;
  const won = wonBy(game, userId);
  const duration = durationOf(game);
  const status = STATUS[game.status];
  const winner = game.status === "finished" && game.winner !== null ? finalOccupant(game, game.winner) : null;
  const tableSize = board?.players.length ?? new Set(game.seats.map((s) => s.seat)).size;

  const takeovers = takeoversIn(game);
  const took = takeovers.find((t) => t.to.accountId === userId);
  const replaced = takeovers.find(
    (t) => t.from.accountId === userId && finalOccupant(game, t.seat)?.accountId !== userId,
  );

  const result = won
    ? "Victoire"
    : place !== null
      ? `${formatPlace(place)} sur ${tableSize}`
      : game.status === "playing"
        ? "Partie en cours"
        : "Sans classement";

  const open = board !== null;

  return (
    <button
      type="button"
      disabled={!open}
      onClick={() => onOpen(game.id)}
      className={`flex w-full items-center gap-3 rounded-[3px] text-left transition enabled:hover:brightness-[1.03] disabled:cursor-default ${
        compact ? "px-2.5 py-2" : "px-3 py-2.5"
      }`}
      style={{
        background: won ? "rgba(232,162,59,.14)" : "rgba(120,95,60,.07)",
        boxShadow: won ? "inset 0 0 0 1.5px rgba(168,112,31,.6)" : "inset 0 0 0 1px rgba(110,86,52,.2)",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className="u-label rounded-[2px] px-1.5 py-[1px] text-[9.5px]"
            style={{ color: status.color, background: status.background }}
          >
            {status.label}
          </span>
          <span className="text-[11.5px] text-ink-500">{formatWhen(game.startedAt)}</span>
        </div>

        <div className="mt-1 flex items-center gap-1.5">
          {won && <Icon name="crown" size={15} className="shrink-0 text-gold-700" />}
          <span className={`font-bold text-ink-900 ${compact ? "text-[13px]" : "text-[14px]"}`}>{result}</span>
          {winner && !won && (
            <span className="truncate text-[12px] text-ink-500">· victoire de {nameOf(winner, people)}</span>
          )}
        </div>

        {(took || replaced) && (
          <p className="mt-0.5 truncate text-[11.5px] text-ink-500">
            {took
              ? `A repris la place de ${nameOf(took.from, people)} au tour ${took.to.fromTurn}`
              : replaced
                ? `Remplacé par ${nameOf(replaced.to, people)} au tour ${replaced.to.fromTurn}`
                : null}
          </p>
        )}

        {board && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {standingsOf(board).map((p) => {
              const occupant = finalOccupant(game, p.id);
              return (
                <PlayerMark
                  key={p.id}
                  player={p}
                  size={compact ? 18 : 20}
                  labelled
                  avatar={occupant ? avatarOf(occupant, people) : null}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 text-right">
        {duration !== null && (
          <div className="flex items-center justify-end gap-1 text-[12px] font-semibold text-ink-700">
            <Icon name="clock" size={13} className="text-ink-300" />
            {formatDuration(duration)}
          </div>
        )}
        <div className="u-label mt-0.5 text-ink-300">{game.turnCount} tours</div>
        {open && <div className="u-label mt-1 text-gold-700">Détail</div>}
      </div>
    </button>
  );
}
