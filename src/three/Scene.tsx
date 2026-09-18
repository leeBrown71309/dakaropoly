import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { BoardMesh } from "./BoardMesh";
import { Pawns } from "./PawnMesh";
import { DicePair } from "./DiceMesh";
import { useCompact } from "../ui/useViewport";
import {
  cameraRig,
  registerCameraRig,
  viewFor,
  INTRO_VIEW,
  INTRO_DURATION,
  PAN_LIMIT,
} from "./cameraRig";

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Orbit controls wired for a board game: left-drag orbits, right-drag (or
 * two fingers) slides the board around the screen, wheel or pinch zooms. The
 * target is clamped so the board can never be pushed out of reach. Controls
 * stay disabled until the opening move has settled.
 */
function Controls({ compact }: { compact: boolean }) {
  const ref = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const [introDone, setIntroDone] = useState(false);
  const introElapsed = useRef(0);

  const view = viewFor(compact);
  const introFrom = useMemo(() => new THREE.Vector3(...INTRO_VIEW.position), []);
  const introTo = useMemo(() => new THREE.Vector3(...view.position), [view]);

  useEffect(() => {
    registerCameraRig({
      reset: () => {
        const controls = ref.current;
        if (!controls) return;
        camera.position.set(...view.position);
        controls.target.set(...view.target);
        controls.update();
      },
      zoom: (factor) => {
        const controls = ref.current;
        if (!controls) return;
        const offset = camera.position.clone().sub(controls.target);
        const distance = THREE.MathUtils.clamp(offset.length() * factor, 7, 34);
        camera.position.copy(controls.target).add(offset.setLength(distance));
        controls.update();
      },
    });
    return () => registerCameraRig(null);
  }, [camera, view]);

  // Turning a laptop window from wide to short changes which framing fits.
  useEffect(() => {
    if (introDone) cameraRig.reset();
  }, [introDone, view]);

  useFrame((_, dt) => {
    const controls = ref.current;
    if (!controls) return;

    // Opening move: settle onto the board before handing over the controls.
    if (!introDone) {
      introElapsed.current = Math.min(INTRO_DURATION, introElapsed.current + dt);
      camera.position.lerpVectors(introFrom, introTo, easeOutCubic(introElapsed.current / INTRO_DURATION));
      controls.update();
      if (introElapsed.current >= INTRO_DURATION) setIntroDone(true);
      return;
    }

    const target = controls.target;
    target.x = THREE.MathUtils.clamp(target.x, -PAN_LIMIT.x, PAN_LIMIT.x);
    target.y = THREE.MathUtils.clamp(target.y, -PAN_LIMIT.y, PAN_LIMIT.y);
    target.z = THREE.MathUtils.clamp(target.z, -PAN_LIMIT.z, PAN_LIMIT.z);
  });

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enabled={introDone}
      target={[...view.target]}
      enablePan
      screenSpacePanning
      panSpeed={0.9}
      enableDamping
      dampingFactor={0.075}
      rotateSpeed={0.55}
      zoomSpeed={0.85}
      minPolarAngle={0.12}
      maxPolarAngle={1.34}
      minDistance={7}
      maxDistance={34}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
    />
  );
}

export function Scene() {
  // A phone renders the same diorama on a tenth of the power: the shadow
  // atlas and the pixel ratio are where that difference is paid back.
  const compact = useCompact();
  const shadowSize = compact ? 1024 : 2048;

  return (
    <Canvas
      shadows
      dpr={compact ? [1, 1.75] : [1, 2]}
      camera={{ position: [...INTRO_VIEW.position], fov: 36, near: 0.5, far: 140 }}
      gl={{ antialias: !compact }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.06;
        scene.background = new THREE.Color("#0f3238");
      }}
    >
      {/* Warm low sun, cool sky bounce — late afternoon over the Atlantic */}
      <hemisphereLight args={["#cfe6f2", "#2b4a3c", 0.75] as const} />
      <directionalLight
        position={[11, 15, 8]}
        intensity={2.1}
        color="#ffe6bd"
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={48}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[-9, 7, -8]} intensity={0.42} color="#9fd3e8" />

      {/* Ocean */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.45, 0]} receiveShadow>
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial color="#12595e" roughness={0.22} metalness={0.32} />
      </mesh>

      <fog attach="fog" args={["#0f3238", 44, 98]} />

      <BoardMesh />
      <Pawns />
      <DicePair />

      {/* Soft contact shadow grounding the diorama on the water */}
      <ContactShadows
        position={[0, -0.72, 0]}
        scale={22}
        resolution={compact ? 512 : 1024}
        blur={2.6}
        opacity={0.5}
        far={5}
        color="#0a2321"
      />

      <Controls compact={compact} />
    </Canvas>
  );
}
