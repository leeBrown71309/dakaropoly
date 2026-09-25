import { describe, expect, it } from "vitest";
import { cleanPseudo, pseudoProblem, suggestPseudo } from "../src/net/pseudo";

describe("pseudoProblem", () => {
  it("accepts ordinary pseudos, accents and spaces included", () => {
    for (const ok of ["Moussa", "moussa", "Awa Ndiaye", "Aïssatou", "Joël_22", "b.o-b", "Œuvre"]) {
      expect(pseudoProblem(ok), ok).toBeNull();
    }
  });

  it("refuses what is too short or too long", () => {
    expect(pseudoProblem("ab")).toMatch(/Au moins 3/);
    expect(pseudoProblem("  ab  ")).toMatch(/Au moins 3/);
    expect(pseudoProblem("abcdefghijklmno")).toMatch(/14 caractères au plus/);
  });

  it("refuses characters the database would refuse", () => {
    for (const bad of ["<script>", "moi@home", "joueur!", "dé🎲"]) {
      expect(pseudoProblem(bad), bad).not.toBeNull();
    }
  });

  it("reads a decomposed accent as the letter it looks like", () => {
    const decomposed = "José"; // « José » typed as e + combining accent
    expect(pseudoProblem(decomposed)).toBeNull();
    expect(cleanPseudo(decomposed)).toBe("José");
  });
});

describe("suggestPseudo", () => {
  it("takes the first word of the Google name", () => {
    expect(suggestPseudo("Awa Ndiaye")).toBe("Awa");
  });

  it("drops characters a pseudo cannot hold", () => {
    expect(suggestPseudo("M'Baye Diop")).toBe("MBaye");
  });

  it("keeps within the length a name may have at the table", () => {
    expect(suggestPseudo("Maximiliendelacroix")).toHaveLength(14);
  });

  it("suggests nothing rather than something the player never chose", () => {
    expect(suggestPseudo(null)).toBe("");
    expect(suggestPseudo("Al")).toBe("");
    expect(suggestPseudo("李小龍")).toBe("");
  });
});
