import { describe, expect, it } from "vitest";
import { shouldOffer, voicePeers } from "../src/net/voice";

/**
 * The two decisions a mesh makes before any audio flows: who dials whom, and
 * who is even in the call. Everything else in `voice.ts` is browser plumbing
 * that only a browser can exercise; these two are rules, and a rule that is
 * wrong here leaves two players unable to hear each other with nothing on
 * screen to say why.
 */

describe("who dials", () => {
  it("picks exactly one side of every pair", () => {
    // Both devices learn about each other in the same presence sync. If both
    // dialled, the two offers would collide and neither call would come up.
    const a = "0b460b07-9cd4-487a-b745-8f84aa2148e4";
    const b = "b4df8088-a240-4918-94d0-4e15bb02c11a";

    expect(shouldOffer(a, b)).toBe(true);
    expect(shouldOffer(b, a)).toBe(false);
  });

  it("agrees with itself whichever side is asking", () => {
    const ids = ["aaa", "bbb", "ccc", "zzz-9", "0-first"];
    for (const x of ids) {
      for (const y of ids) {
        if (x === y) continue;
        // Exactly one of the two dials — never both, never neither.
        expect(shouldOffer(x, y) !== shouldOffer(y, x)).toBe(true);
      }
    }
  });

  it("never dials itself", () => {
    expect(shouldOffer("aaa", "aaa")).toBe(false);
  });
});

describe("who is in the call", () => {
  const room = [
    { clientId: "me", voice: true },
    { clientId: "talker", voice: true },
    { clientId: "listener", voice: false },
    { clientId: "watcher", voice: true },
  ];

  it("keeps the others who have a microphone open", () => {
    expect(voicePeers(room, "me")).toEqual(["talker", "watcher"]);
  });

  it("leaves out this device, so nothing dials itself", () => {
    expect(voicePeers(room, "me")).not.toContain("me");
  });

  it("leaves out everyone who has not joined the call", () => {
    // Being in the room is not being in the call: somebody who never opened
    // a microphone must not have one dialled at them.
    expect(voicePeers(room, "me")).not.toContain("listener");
  });

  it("includes a spectator, who is in the room like anyone else", () => {
    expect(voicePeers(room, "me")).toContain("watcher");
  });

  it("is empty when nobody else is talking", () => {
    expect(voicePeers([{ clientId: "me", voice: true }], "me")).toEqual([]);
    expect(voicePeers([], "me")).toEqual([]);
  });
});
