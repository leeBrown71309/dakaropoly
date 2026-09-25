import {
  avatarOf,
  durationOf,
  finalBoardOf,
  finalOccupant,
  nameOf,
  takeoversIn,
  type HistoryGame,
  type Person,
} from "../../net/history";
import { Card, Label, BrassRule } from "../kit/Surface";
import { FinalStandings } from "../screens/FinalStandings";
import { formatDuration, formatWhen } from "./format";

interface GameDetailProps {
  game: HistoryGame;
  people: Record<string, Person>;
  compact: boolean;
}

/**
 * One past game, laid out as the card it ended on — the ranking and the
 * evening's prizes, read from the board the database kept — and, when a
 * chair changed hands on the way, who took over from whom.
 */
export function GameDetail({ game, people, compact }: GameDetailProps) {
  const board = finalBoardOf(game, people);
  if (!board) return null;

  const photos = Object.fromEntries(
    board.players.map((p) => {
      const occupant = finalOccupant(game, p.id);
      return [p.id, occupant ? avatarOf(occupant, people) : null];
    }),
  );
  const duration = durationOf(game);
  const caption = [formatWhen(game.startedAt), duration !== null ? formatDuration(duration) : null]
    .filter(Boolean)
    .join(" · ");
  const takeovers = takeoversIn(game);

  return (
    <>
      <FinalStandings
        game={board}
        compact={compact}
        caption={caption}
        unfinished={game.status === "unfinished"}
        photos={photos}
      />

      {takeovers.length > 0 && (
        <Card className={`mt-2 ${compact ? "p-3" : "p-4"}`}>
          <Label>Chaises reprises en cours de partie</Label>
          <BrassRule className="my-2" />
          <ul className="flex flex-col gap-1">
            {takeovers.map((t) => (
              <li key={`${t.seat}-${t.to.fromTurn}`} className="text-[12.5px] text-ink-700">
                <span className="u-label mr-2 text-ink-300">Tour {t.to.fromTurn}</span>
                <span className="font-bold text-ink-900">{nameOf(t.to, people)}</span> a repris la place de{" "}
                <span className="font-bold text-ink-900">{nameOf(t.from, people)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
