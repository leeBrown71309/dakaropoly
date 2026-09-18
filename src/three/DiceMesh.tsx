import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../game/store";
import { dieFaceTexture } from "./textures";
import { DIE_SIZE, DICE_FPS, type DieTrack } from "../animation/diceRoll";
import { BOARD_SURFACE_Y } from "./geometry";

/**
 * Plays back a recorded throw. All the physics happened up front in
 * `animation/diceRoll`; this only samples the track and poses the mesh, so
 * the dice cannot drift out of step with the engine's result.
 */
function Die({ index }: { index: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const track = useGame((s) => s.diceThrow?.recording.dice[index] ?? null);
  const startedAt = useGame((s) => s.diceThrow?.startedAt ?? 0);

  const materials = useMemo(() => {
    const faces = track?.faces ?? [3, 4, 1, 6, 2, 5];
    return faces.map(
      (value) =>
        new THREE.MeshStandardMaterial({
          map: dieFaceTexture(value),
          roughness: 0.34,
          metalness: 0.04,
        }),
    );
  }, [track]);

  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh || !track || track.poses.length === 0) return;

    const elapsed = (performance.now() - startedAt) / 1000;
    const frame = Math.min(Math.max(Math.floor(elapsed * DICE_FPS), 0), track.poses.length - 1);
    const pose = track.poses[frame] as DieTrack["poses"][number];
    mesh.position.set(pose.p[0], pose.p[1], pose.p[2]);
    mesh.quaternion.set(pose.q[0], pose.q[1], pose.q[2], pose.q[3]);
  });

  if (!track) return null;

  return (
    <mesh ref={ref} castShadow receiveShadow material={materials}>
      <boxGeometry args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} />
    </mesh>
  );
}

export function DicePair() {
  const hasThrow = useGame((s) => s.diceThrow !== null);
  if (!hasThrow) return null;

  // The simulation runs with its ground plane at y = 0, so the whole group
  // is lifted to sit on the printed surface.
  return (
    <group position={[0, BOARD_SURFACE_Y, 0]}>
      <Die index={0} />
      <Die index={1} />
    </group>
  );
}
