import { describe, expect, it } from "vitest";
import { mayTalk, shouldOffer, voicePeers } from "../src/net/voice";

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
    { clientId: "me", voice: true, seated: true },
    { clientId: "talker", voice: true, seated: true },
    { clientId: "listener", voice: false, seated: true },
    { clientId: "watcher", voice: true, seated: false },
  ];

  it("keeps the other players who have a microphone open", () => {
    expect(voicePeers(room, "me", false)).toEqual(["talker"]);
  });

  it("leaves out this device, so nothing dials itself", () => {
    expect(voicePeers(room, "me", true)).not.toContain("me");
  });

  it("leaves out everyone who has not joined the call", () => {
    // Being in the room is not being in the call: somebody who never opened
    // a microphone must not have one dialled at them.
    expect(voicePeers(room, "me", true)).not.toContain("listener");
  });

  it("is empty when nobody else is talking", () => {
    expect(voicePeers([{ clientId: "me", voice: true, seated: true }], "me", true)).toEqual([]);
    expect(voicePeers([], "me", true)).toEqual([]);
  });
});

/**
 * A room seats eight at most and can hold any number of people standing
 * behind them. A dozen of those talking at once buries the game, so the host
 * decides — and the rule is applied by every device, not just by the one
 * whose button would be hidden.
 */
describe("the host's switch for spectators", () => {
  const room = [
    { clientId: "me", voice: true, seated: true },
    { clientId: "player", voice: true, seated: true },
    { clientId: "watcher", voice: true, seated: false },
  ];

  it("lets a player talk either way", () => {
    expect(mayTalk(true, false)).toBe(true);
    expect(mayTalk(true, true)).toBe(true);
  });

  it("keeps a spectator out until the host opens it", () => {
    expect(mayTalk(false, false)).toBe(false);
    expect(mayTalk(false, true)).toBe(true);
  });

  it("dials no spectator while the switch is off", () => {
    // Not merely hidden on their screen: nobody calls them, so a spectator
    // who forces their own microphone on is still heard by no one.
    expect(voicePeers(room, "me", false)).toEqual(["player"]);
  });

  it("dials them once it is on", () => {
    expect(voicePeers(room, "me", true)).toEqual(["player", "watcher"]);
  });

  it("still lets a spectator hear the players", () => {
    // Shut out of talking is not shut out of listening: they came to follow
    // the game, and the players are seated either way.
    expect(voicePeers(room, "watcher", false)).toEqual(["me", "player"]);
  });
});
