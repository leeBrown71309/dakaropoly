/** How the history prints dates, durations and places, in French. */

const WHEN = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** « sam. 20 sept. 2026, 20:00 » */
export function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : WHEN.format(date);
}

/** « 38 min », « 1 h 24 » — a game is never timed to the second. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** « 1er », « 2e », « 3e »… */
export function formatPlace(place: number): string {
  return place === 1 ? "1er" : `${place}e`;
}
