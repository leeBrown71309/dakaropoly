import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../game/store";
import { PAWN_SHAPES, type PawnShape } from "../game/data/pawns";
import { pawnWorldPos } from "./geometry";

function PawnShapeGeometry({ shape }: { shape: PawnShape }) {
  switch (shape) {
    case "box":
      return <boxGeometry args={[0.22, 0.3, 0.22]} />;
    case "cylinder":
      return <cylinderGeometry args={[0.11, 0.13, 0.32, 12]} />;
    case "cone":
      return <coneGeometry args={[0.14, 0.32, 12]} />;
    case "sphere":
      return <sphereGeometry args={[0.15, 16, 12]} />;
    case "capsule":
      return <capsuleGeometry args={[0.1, 0.14, 4, 8]} />;
    case "torus":
      return <torusGeometry args={[0.11, 0.05, 8, 16]} />;
    case "octahedron":
      return <octahedronGeometry args={[0.16]} />;
    case "dodecahedron":
      return <dodecahedronGeometry args={[0.15]} />;
    default:
      return <sphereGeometry args={[0.15, 16, 12]} />;
  }
}

function Pawn({ id }: { id: number }) {
  const game = useGame((s) => s.game);
  const vis = useGame((s) => s.visPos[id] ?? 0);
  const current = game?.current ?? -1;
  const ref = useRef<THREE.Group>(null);
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null);
  const landed = useRef(false);

  const target = useMemo<[number, number, number]>(() => {
    if (!game) return [0, 0, 0];
    const [wx, wz] = pawnWorldPos(vis, id, game.players.length);
    return [wx, -0.27, wz];
  }, [game, vis, id]);

  useEffect(() => {
    if (!ref.current) return;
    const from = ref.current.position.clone();
    const to = new THREE.Vector3(target[0], target[1], target[2]);
    if (from.distanceTo(to) > 0.001) {
      anim.current = { from, to, t: 0 };
      landed.current = false;
    }
  }, [target]);

  useFrame((state, dt) => {
    const a = anim.current;
    if (a && ref.current) {
      a.t = Math.min(1, a.t + dt / 0.18);
      const k = 1 - Math.pow(1 - a.t, 2);
      ref.current.position.lerpVectors(a.from, a.to, k);
      ref.current.position.y = a.to.y + Math.sin(k * Math.PI) * 0.3;
      if (a.t >= 1) anim.current = null;
      return;
    }
    if (ref.current && current === id) {
      ref.current.position.y = target[1] + Math.abs(Math.sin(state.clock.elapsedTime * 3)) * 0.07;
    }
  });

  if (!game) return null;
  const player = game.players[id];
  if (!player || player.bankrupt) return null;
  const shape = PAWN_SHAPES[player.pawn] ?? "sphere";

  return (
    <group ref={ref} position={target}>
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.15, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
      <mesh castShadow position={[0, 0.17, 0]}>
        <PawnShapeGeometry shape={shape} />
        <meshStandardMaterial color={player.color} roughness={0.35} metalness={0.15} />
      </mesh>
      {current === id && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.27, 24]} />
          <meshBasicMaterial color="#ffd75e" transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}

export function Pawns() {
  const count = useGame((s) => s.game?.players.length ?? 0);
  return (
    <group>
      {[0, 1, 2, 3, 4, 5, 6, 7].slice(0, count).map((i) => (
        <Pawn key={i} id={i} />
      ))}
    </group>
  );
}
