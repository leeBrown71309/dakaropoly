import * as CANNON from "cannon-es";

/**
 * Physical dice that still obey the engine.
 *
 * The rules engine decides the roll before anything moves, so the throw
 * cannot be left to chance — but faking the physics looks fake. Instead the
 * throw is simulated for real, and only once the dice have come to rest are
 * the pip faces assigned, so that the face actually pointing up carries the
 * value the engine drew. Opposite faces still sum to seven, so the result is
 * a legitimate die in every position.
 *
 * The simulation is pure and deterministic given a seed: no DOM, no three.js,
 * and therefore testable.
 */

export interface DiePose {
  p: [number, number, number];
  q: [number, number, number, number];
}

export interface DieTrack {
  /** Poses sampled at `FPS`, from throw to rest. */
  poses: DiePose[];
  /** Pip value per box face, in three.js material order (+X,−X,+Y,−Y,+Z,−Z). */
  faces: number[];
}

export interface DiceThrow {
  dice: DieTrack[];
  /** Seconds of recorded motion. */
  duration: number;
}

export const DIE_SIZE = 0.46;
/** Half-width of the invisible pen the dice are thrown into. */
export const PEN = 1.35;
/** The pen sits in the clear lower half of the centre field, off the wordmark. */
export const PEN_Z = 2.15;
const FPS = 60;
const STEP = 1 / 120;
const MAX_STEPS = 720;
const REST_SPEED = 0.06;
const REST_STEPS = 10;

/** Deterministic PRNG so a given seed always replays the same throw. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LOCAL_AXES: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const OPPOSITE = [1, 0, 3, 2, 5, 4];

/** Which face of the cube ended up pointing at the sky. */
function upAxis(q: CANNON.Quaternion): number {
  let best = 0;
  let bestY = -Infinity;
  for (let i = 0; i < 6; i++) {
    const axis = LOCAL_AXES[i] as [number, number, number];
    const world = q.vmult(new CANNON.Vec3(axis[0], axis[1], axis[2]));
    if (world.y > bestY) {
      bestY = world.y;
      best = i;
    }
  }
  return best;
}

/**
 * Labels the six faces so `axis` carries `value`, keeping every pair of
 * opposite faces summing to seven.
 */
export function labelFaces(axis: number, value: number): number[] {
  const faces = new Array<number>(6).fill(0);
  faces[axis] = value;
  faces[OPPOSITE[axis] as number] = 7 - value;

  const remainingValues: number[] = [];
  for (let v = 1; v <= 3; v++) {
    if (v !== value && v !== 7 - value) remainingValues.push(v);
  }

  const free = [0, 1, 2, 3, 4, 5].filter((i) => i !== axis && i !== OPPOSITE[axis]);
  const firstAxis = free[0] as number;
  const secondAxis = free.find((i) => i !== firstAxis && i !== OPPOSITE[firstAxis]) as number;

  const a = remainingValues[0] as number;
  const b = remainingValues[1] as number;
  faces[firstAxis] = a;
  faces[OPPOSITE[firstAxis] as number] = 7 - a;
  faces[secondAxis] = b;
  faces[OPPOSITE[secondAxis] as number] = 7 - b;
  return faces;
}

function buildWorld(): CANNON.World {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -26, 0) });
  world.defaultContactMaterial.friction = 0.32;
  world.defaultContactMaterial.restitution = 0.28;
  world.allowSleep = true;

  const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(ground);

  // Invisible pen so the dice never tumble off the centre field
  const walls: [number, number, number, number][] = [
    [PEN, 0, PEN_Z, -Math.PI / 2],
    [-PEN, 0, PEN_Z, Math.PI / 2],
    [0, 0, PEN_Z + PEN, Math.PI],
    [0, 0, PEN_Z - PEN, 0],
  ];
  for (const [x, y, z, yaw] of walls) {
    const wall = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    wall.position.set(x, y, z);
    wall.quaternion.setFromEuler(0, yaw, 0);
    world.addBody(wall);
  }
  return world;
}

function makeDie(rng: () => number, side: number): CANNON.Body {
  const half = DIE_SIZE / 2;
  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Box(new CANNON.Vec3(half, half, half)),
    angularDamping: 0.12,
    linearDamping: 0.06,
  });

  body.position.set(side * (0.34 + rng() * 0.16), 1.6 + rng() * 0.45, PEN_Z + 0.85 + rng() * 0.3);
  body.quaternion.setFromEuler(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2);
  body.velocity.set((rng() - 0.5) * 2.6, -1.5 - rng() * 1.2, -3.4 - rng() * 1.6);
  body.angularVelocity.set(
    (rng() - 0.5) * 26,
    (rng() - 0.5) * 26,
    (rng() - 0.5) * 26,
  );
  body.sleepSpeedLimit = REST_SPEED;
  body.sleepTimeLimit = 0.12;
  return body;
}

const atRest = (body: CANNON.Body): boolean =>
  body.velocity.length() < REST_SPEED && body.angularVelocity.length() < REST_SPEED;

/**
 * Throws two dice and records the motion. `a` and `b` are the values the
 * engine already drew; they are painted onto whichever faces finish upwards.
 */
export function simulateThrow(a: number, b: number, seed: number): DiceThrow {
  const rng = mulberry32(seed);
  const world = buildWorld();
  const bodies = [makeDie(rng, -1), makeDie(rng, 1)];
  for (const body of bodies) world.addBody(body);

  const tracks: DiePose[][] = [[], []];
  const sampleEvery = Math.round(1 / (FPS * STEP));
  let restFor = 0;
  let steps = 0;

  for (; steps < MAX_STEPS; steps++) {
    // `step`, not `fixedStep`: the latter paces itself against the wall
    // clock, which would barely advance inside this synchronous loop.
    world.step(STEP);

    if (steps % sampleEvery === 0) {
      bodies.forEach((body, i) => {
        (tracks[i] as DiePose[]).push({
          p: [body.position.x, body.position.y, body.position.z],
          q: [body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w],
        });
      });
    }

    restFor = bodies.every(atRest) ? restFor + 1 : 0;
    if (restFor >= REST_STEPS) break;
  }

  // Always record the settled pose as the final frame.
  bodies.forEach((body, i) => {
    (tracks[i] as DiePose[]).push({
      p: [body.position.x, body.position.y, body.position.z],
      q: [body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w],
    });
  });

  const values = [a, b];
  const dice: DieTrack[] = bodies.map((body, i) => ({
    poses: tracks[i] as DiePose[],
    faces: labelFaces(upAxis(body.quaternion), values[i] as number),
  }));

  return { dice, duration: (dice[0]?.poses.length ?? 1) / FPS };
}

export const DICE_FPS = FPS;
