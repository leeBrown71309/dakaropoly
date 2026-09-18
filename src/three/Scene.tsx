import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { BoardMesh } from "./BoardMesh";
import { Pawns } from "./PawnMesh";
import { DicePair } from "./DiceMesh";

export function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 12.5, 10.5], fov: 40 }}
      gl={{ antialias: true }}
    >
      <hemisphereLight args={["#e8f2ff", "#33452e", 1.1]} />
      <directionalLight
        position={[9, 16, 7]}
        intensity={1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={2}
        shadow-camera-far={40}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight position={[-8, 10, -6]} intensity={0.35} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#1b5e9e" roughness={0.25} metalness={0.2} />
      </mesh>
      <fog attach="fog" args={["#0d2238", 26, 60]} />
      <BoardMesh />
      <Pawns />
      <DicePair />
      <OrbitControls
        target={[0, 0, 0]}
        minPolarAngle={0.35}
        maxPolarAngle={1.25}
        minDistance={8}
        maxDistance={24}
        enablePan={false}
      />
    </Canvas>
  );
}
