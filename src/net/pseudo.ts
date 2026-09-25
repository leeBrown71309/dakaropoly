import { NAME_MAX } from "../game/types";

/**
 * What a pseudo may look like. The same rule is written into the
 * `profiles_pseudo_shape` constraint in `supabase/schema.sql` — the form
 * checks it so the player hears about it while typing, the database checks
 * it because the form is only what one client believes. Change one, change
 * the other.
 *
 * A pseudo is a name at the table, so it is exactly as long as one may be.
 * Letters are Latin with their accents, spelled out as code point ranges on
 * both sides so that neither depends on a locale.
 */
export const PSEUDO_MIN = 3;
export const PSEUDO_MAX = NAME_MAX;

const PSEUDO_SHAPE = /^[A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ _.-]+$/u;
const PSEUDO_CHAR = /[A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ _.-]/u;

/**
 * The pseudo as it will be stored.
 *
 * Composed first: some keyboards type « é » as an « e » followed by a
 * combining accent, which is two characters the rule does not accept and one
 * the player can see. Then trimmed, as the database does.
 */
export function cleanPseudo(input: string): string {
  return input.normalize("NFC").trim();
}

/** Why a pseudo cannot be used, in a sentence for the form, or `null`. */
export function pseudoProblem(input: string): string | null {
  const pseudo = cleanPseudo(input);
  if (pseudo.length < PSEUDO_MIN) return `Au moins ${PSEUDO_MIN} caractères`;
  if (pseudo.length > PSEUDO_MAX) return `${PSEUDO_MAX} caractères au plus`;
  if (!PSEUDO_SHAPE.test(pseudo)) return "Lettres, chiffres, espaces, « _ », « . » et « - » seulement";
  return null;
}

/**
 * A first guess at a pseudo, from the name on the Google account: its first
 * word, kept to the characters a pseudo may hold. Only a suggestion for the
 * field — whether it is free is asked separately — and empty when there is
 * nothing usable, rather than inventing a name the player never chose.
 */
export function suggestPseudo(fullName: string | null | undefined): string {
  const first = cleanPseudo(fullName ?? "").split(/\s+/u)[0] ?? "";
  const kept = Array.from(first)
    .filter((c) => PSEUDO_CHAR.test(c))
    .join("")
    .slice(0, PSEUDO_MAX);
  return kept.length >= PSEUDO_MIN ? kept : "";
}
