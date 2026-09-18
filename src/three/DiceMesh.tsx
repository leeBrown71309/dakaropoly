import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../game/store";
import { dieFaceTexture } from "./textures";

const FACE_QUATS: Record<number, THREE.Quaternion> = {
  1: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),
  2: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
  3: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
  4: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2)),
  5: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
  6: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)),
};

function quatFor(face: number): THREE.Quaternion {
  return FACE_QUATS[face] ?? FACE_QUATS[1] ?? new THREE.Quaternion();
}

function Die({
  face,
  rolling,
  offset,
  spinSeed,
}: {
  face: number;
  rolling: boolean;
  offset: [number, number];
  spinSeed: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const spin = useRef(new THREE.Vector3(Math.random() + 2, Math.random() + 3, Math.random() + 2));

  useFrame((_, dt) => {
    if (!ref.current) return;
    if (rolling) {
      ref.current.rotation.x += dt * spin.current.x * 2.2;
      ref.current.rotation.y += dt * spin.current.y * 2.2;
      ref.current.rotation.z += dt * spin.current.z * 2.2;
      return;
    }
    const base = quatFor(face);
    const t = base.clone().multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(spinSeed) * 0.8),
    );
    ref.current.quaternion.slerp(t, Math.min(1, dt * 12));
  });

  return (
    <mesh ref={ref} position={[offset[0], 0.32, offset[1]]} castShadow>
      <boxGeometry args={[0.55, 0.55, 0.55]} />
      <meshStandardMaterial attach="material-0" map={dieFaceTexture(3)} roughness={0.4} />
      <meshStandardMaterial attach="material-1" map={dieFaceTexture(4)} roughness={0.4} />
      <meshStandardMaterial attach="material-2" map={dieFaceTexture(1)} roughness={0.4} />
      <meshStandardMaterial attach="material-3" map={dieFaceTexture(6)} roughness={0.4} />
      <meshStandardMaterial attach="material-4" map={dieFaceTexture(2)} roughness={0.4} />
      <meshStandardMaterial attach="material-5" map={dieFaceTexture(5)} roughness={0.4} />
    </mesh>
  );
}

export function DicePair() {
  const dice = useGame((s) => s.dice);
  const a = dice?.a ?? 1;
  const b = dice?.b ?? 1;
  const rolling = dice?.rolling ?? false;
  return (
    <group position={[0, -0.27, 1.35]}>
      <Die face={a} rolling={rolling} offset={[-0.78, 0]} spinSeed={1.2} />
      <Die face={b} rolling={rolling} offset={[0.78, 0.18]} spinSeed={2.6} />
    </group>
  );
}
