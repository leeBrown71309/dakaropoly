import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SVGLoader } from "three-stdlib";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../game/store";
import { PAWN_SHAPES, PAWN_SILHOUETTES, PAWN_VIEWBOX, type PawnShape } from "../game/data/pawns";
import { pawnWorldPos, BOARD_SURFACE_Y } from "./geometry";

/** Height of the tallest point of a token, in world units. */
const TOKEN_HEIGHT = 0.46;
const BASE_HEIGHT = 0.035;
const BASE_RADIUS = 0.135;

const geometryCache = new Map<PawnShape, THREE.BufferGeometry>();

/**
 * Carves a token out of its 2D silhouette: the same paths the HUD draws are
 * extruded and bevelled, so the piece you picked in the lobby is literally
 * the piece standing on the board.
 */
function tokenGeometry(shape: PawnShape): THREE.BufferGeometry {
  const cached = geometryCache.get(shape);
  if (cached) return cached;

  const paths = PAWN_SILHOUETTES[shape].map((d) => `<path d="${d}"/>`).join("");
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAWN_VIEWBOX} ${PAWN_VIEWBOX}">${paths}</svg>`;
  const parsed = new SVGLoader().parse(markup);
  const shapes = parsed.paths.flatMap((path) => SVGLoader.createShapes(path));

  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: 6.5,
    bevelEnabled: true,
    bevelThickness: 1.25,
    bevelSize: 0.95,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 12,
  });

  // SVG's Y axis points down. Rotating rather than mirroring keeps the
  // winding order intact, so the normals stay correct.
  geometry.rotateX(Math.PI);

  const scale = TOKEN_HEIGHT / PAWN_VIEWBOX;
  geometry.scale(scale, scale, scale);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  geometry.translate(
    -(box.min.x + box.max.x) / 2,
    -box.min.y + BASE_HEIGHT,
    -(box.min.z + box.max.z) / 2,
  );
  geometry.computeVertexNormals();

  geometryCache.set(shape, geometry);
  return geometry;
}

function Pawn({ id }: { id: number }) {
  const game = useGame((s) => s.game);
  const vis = useGame((s) => s.visPos[id] ?? 0);
  const current = game?.current ?? -1;
  const ref = useRef<THREE.Group>(null);
  const hop = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null);

  const player = game?.players[id];
  const shape: PawnShape = PAWN_SHAPES[player?.pawn ?? 0] ?? "taxi";
  const geometry = useMemo(() => tokenGeometry(shape), [shape]);

  const target = useMemo<[number, number, number]>(() => {
    if (!game) return [0, BOARD_SURFACE_Y, 0];
    const [x, z] = pawnWorldPos(vis, id, game.players.length);
    return [x, BOARD_SURFACE_Y, z];
  }, [game, vis, id]);

  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    const from = group.position.clone();
    const to = new THREE.Vector3(target[0], target[1], target[2]);
    if (from.distanceTo(to) > 0.001) hop.current = { from, to, t: 0 };
  }, [target]);

  useFrame((state, dt) => {
    const group = ref.current;
    if (!group) return;

    const jump = hop.current;
    if (jump) {
      jump.t = Math.min(1, jump.t + dt / 0.19);
      const k = 1 - Math.pow(1 - jump.t, 2);
      group.position.lerpVectors(jump.from, jump.to, k);
      group.position.y = jump.to.y + Math.sin(k * Math.PI) * 0.34;
      // Lean into the jump, then settle upright.
      group.rotation.z = Math.sin(k * Math.PI) * -0.22;
      if (jump.t >= 1) {
        hop.current = null;
        group.rotation.z = 0;
      }
      return;
    }

    if (current === id) {
      group.position.y = target[1] + Math.abs(Math.sin(state.clock.elapsedTime * 2.6)) * 0.055;
    }
  });

  if (!game || !player || player.bankrupt) return null;

  return (
    <group ref={ref} position={target}>
      {/* Turned base the token stands on */}
      <mesh castShadow receiveShadow position={[0, BASE_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[BASE_RADIUS, BASE_RADIUS * 1.08, BASE_HEIGHT, 24]} />
        <meshStandardMaterial color="#2E1C0F" roughness={0.72} metalness={0.06} />
      </mesh>

      <mesh castShadow geometry={geometry}>
        <meshStandardMaterial color={player.color} roughness={0.46} metalness={0.1} />
      </mesh>

      {current === id && (
        <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[BASE_RADIUS + 0.045, BASE_RADIUS + 0.095, 32]} />
          <meshBasicMaterial color="#E8A23B" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}

export function Pawns() {
  const count = useGame((s) => s.game?.players.length ?? 0);
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <Pawn key={i} id={i} />
      ))}
    </group>
  );
}
