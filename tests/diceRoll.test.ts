import { describe, expect, it } from "vitest";
import * as CANNON from "cannon-es";
import { DIE_SIZE, PEN, PEN_Z, labelFaces, simulateThrow } from "../src/animation/diceRoll";

const LOCAL_AXES: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Recomputes, from a settled pose, which face is pointing at the sky. */
function upAxisOf(q: [number, number, number, number]): number {
  const quat = new CANNON.Quaternion(q[0], q[1], q[2], q[3]);
  let best = 0;
  let bestY = -Infinity;
  LOCAL_AXES.forEach((axis, i) => {
    const world = quat.vmult(new CANNON.Vec3(axis[0], axis[1], axis[2]));
    if (world.y > bestY) {
      bestY = world.y;
      best = i;
    }
  });
  return best;
}

describe("labelFaces", () => {
  it("puts the wanted value on the wanted face", () => {
    for (let axis = 0; axis < 6; axis++) {
      for (let value = 1; value <= 6; value++) {
        expect(labelFaces(axis, value)[axis]).toBe(value);
      }
    }
  });

  it("keeps opposite faces summing to seven", () => {
    for (let axis = 0; axis < 6; axis++) {
      for (let value = 1; value <= 6; value++) {
        const faces = labelFaces(axis, value);
        expect((faces[0] ?? 0) + (faces[1] ?? 0)).toBe(7);
        expect((faces[2] ?? 0) + (faces[3] ?? 0)).toBe(7);
        expect((faces[4] ?? 0) + (faces[5] ?? 0)).toBe(7);
      }
    }
  });

  it("uses each pip value exactly once", () => {
    for (let axis = 0; axis < 6; axis++) {
      for (let value = 1; value <= 6; value++) {
        expect([...labelFaces(axis, value)].sort()).toEqual([1, 2, 3, 4, 5, 6]);
      }
    }
  });
});

describe("simulateThrow", () => {
  it("is deterministic for a given seed", () => {
    const a = simulateThrow(4, 2, 1234);
    const b = simulateThrow(4, 2, 1234);
    expect(a.dice[0]?.poses).toEqual(b.dice[0]?.poses);
    expect(a.dice[1]?.faces).toEqual(b.dice[1]?.faces);
  });

  it("shows the value the engine drew, for every combination", () => {
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        const thrown = simulateThrow(a, b, a * 100 + b);
        const wanted = [a, b];
        thrown.dice.forEach((die, i) => {
          const last = die.poses[die.poses.length - 1];
          expect(last).toBeDefined();
          if (!last) return;
          const face = die.faces[upAxisOf(last.q)];
          expect(face).toBe(wanted[i]);
        });
      }
    }
  });

  it("comes to rest flat on the board, inside the pen", () => {
    for (let seed = 0; seed < 12; seed++) {
      const thrown = simulateThrow(3, 5, seed);
      for (const die of thrown.dice) {
        const last = die.poses[die.poses.length - 1];
        expect(last).toBeDefined();
        if (!last) continue;
        // Resting on a face puts the centre half a die above the surface.
        expect(last.p[1]).toBeGreaterThan(DIE_SIZE * 0.35);
        expect(last.p[1]).toBeLessThan(DIE_SIZE * 0.95);
        expect(Math.abs(last.p[0])).toBeLessThan(PEN);
        expect(Math.abs(last.p[2] - PEN_Z)).toBeLessThan(PEN);
      }
    }
  });

  it("records a throw long enough to read but never endless", () => {
    const thrown = simulateThrow(6, 6, 77);
    expect(thrown.duration).toBeGreaterThan(0.4);
    expect(thrown.duration).toBeLessThan(6);
  });
});
