import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { BOARD } from "../game/data/board";
import type { TileDef } from "../game/types";
import { useGame } from "../game/store";
import { createBoardTexture } from "./boardTexture";
import { deckTexture } from "./textures";
import {
  HALF,
  RING,
  BAND_DEPTH,
  BOARD_GROUP_Y,
  BOARD_SURFACE_H,
  tileCell,
  bandCenter,
  OUTWARD,
  housesAxis,
} from "./geometry";

/** Width of the wooden frame around the printed surface. */
const FRAME_LIP = 0.62;
const FRAME_H = 0.52;

/**
 * A little house: a square block with a gable, extruded once and shared by
 * every tile rather than being yet another cube.
 */
const HOUSE_GEOMETRY = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, -0.5);
  shape.lineTo(0.5, -0.5);
  shape.lineTo(0.5, 0.18);
  shape.lineTo(0, 0.5);
  shape.lineTo(-0.5, 0.18);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.82,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.045,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.center();
  return geo;
})();

/** Regenerates the printed surface once webfonts are available. */
function useBoardTexture(): THREE.CanvasTexture {
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) setGeneration((g) => g + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const texture = useMemo(() => createBoardTexture(), [generation]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function Surface() {
  const texture = useBoardTexture();

  const materials = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({ color: "#E0D0AE", roughness: 0.92 });
    const top = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88 });
    return [edge, edge, top, edge, edge, edge];
  }, [texture]);

  useEffect(
    () => () => {
      materials[0]?.dispose();
      materials[2]?.dispose();
    },
    [materials],
  );

  return (
    <mesh position={[0, BOARD_SURFACE_H / 2, 0]} receiveShadow castShadow material={materials}>
      <boxGeometry args={[HALF * 2, BOARD_SURFACE_H, HALF * 2]} />
    </mesh>
  );
}

function Frame() {
  const outer = HALF * 2 + FRAME_LIP * 2;
  return (
    <group>
      {/* Lacquered frame the printed sheet is inlaid into */}
      <mesh position={[0, -FRAME_H / 2 + BOARD_SURFACE_H * 0.55, 0]} receiveShadow castShadow>
        <boxGeometry args={[outer, FRAME_H, outer]} />
        <meshStandardMaterial color="#5C3A1F" roughness={0.58} metalness={0.06} />
      </mesh>
    </group>
  );
}

function OwnerMark({ pos, color }: { pos: number; color: string }) {
  const cell = tileCell(pos);
  const [ox, oz] = OUTWARD[cell.side];
  const inset = RING / 2 - 0.055;
  const along = cell.side === 0 || cell.side === 2 ? cell.w : cell.d;

  return (
    <mesh
      position={[cell.x + ox * inset, BOARD_SURFACE_H + 0.012, cell.z + oz * inset]}
      castShadow
    >
      <boxGeometry
        args={ox === 0 ? [along * 0.86, 0.024, 0.08] : [0.08, 0.024, along * 0.86]}
      />
      <meshStandardMaterial color={color} roughness={0.42} metalness={0.12} />
    </mesh>
  );
}

function Buildings({ pos, houses }: { pos: number; houses: number }) {
  const cell = tileCell(pos);
  const [bx, bz] = bandCenter(pos);
  const axis = housesAxis(cell.side);

  if (houses === 5) {
    return (
      <mesh
        position={[bx, BOARD_SURFACE_H + 0.09, bz]}
        rotation={[0, axis === "x" ? 0 : Math.PI / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.46, 0.17, BAND_DEPTH * 0.62]} />
        <meshStandardMaterial color="#B23A2E" roughness={0.45} />
      </mesh>
    );
  }

  const offsets = [-0.27, -0.09, 0.09, 0.27].slice(0, houses);
  return (
    <group>
      {offsets.map((offset, i) => (
        <mesh
          key={i}
          position={[
            bx + (axis === "x" ? offset : 0),
            BOARD_SURFACE_H + 0.075,
            bz + (axis === "z" ? offset : 0),
          ]}
          rotation={[0, axis === "x" ? 0 : Math.PI / 2, 0]}
          scale={[0.16, 0.16, 0.16]}
          geometry={HOUSE_GEOMETRY}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#2F7D50" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function MortgageMark({ pos }: { pos: number }) {
  const cell = tileCell(pos);
  return (
    <mesh position={[cell.x, BOARD_SURFACE_H + 0.006, cell.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[cell.w * 0.94, cell.d * 0.94]} />
      <meshBasicMaterial color="#8E4526" transparent opacity={0.3} />
    </mesh>
  );
}

function TileOverlay({ pos }: { pos: number }) {
  const tile = BOARD[pos] as TileDef;
  const state = useGame((s) => s.game?.tiles[pos]);
  const ownerColor = useGame((s) => {
    const owner = s.game?.tiles[pos]?.owner;
    return owner === undefined || owner === null ? null : (s.game?.players[owner]?.color ?? null);
  });

  if (!state) return null;
  const houses = tile.kind === "street" ? state.houses : 0;

  return (
    <group>
      {ownerColor && <OwnerMark pos={pos} color={ownerColor} />}
      {houses > 0 && <Buildings pos={pos} houses={houses} />}
      {state.mortgaged && <MortgageMark pos={pos} />}
    </group>
  );
}

/** The two card decks, sitting on the centre field. */
function Decks() {
  const decks = useMemo(
    () => [
      { x: -2.35, z: -2.55, rot: -0.19, tex: deckTexture("Baraka", "#E8A23B", "#3E2A0C") },
      { x: 2.35, z: -2.55, rot: 0.17, tex: deckTexture("Teranga", "#F1E7D2", "#23372F") },
    ],
    [],
  );

  return (
    <group>
      {decks.map((deck, i) => (
        <group key={i} position={[deck.x, BOARD_SURFACE_H, deck.z]} rotation={[0, deck.rot, 0]}>
          <mesh position={[0, 0.045, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.45, 0.09, 0.95]} />
            <meshStandardMaterial color="#D9CBAC" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.0905, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.4, 0.9]} />
            <meshBasicMaterial map={deck.tex} transparent />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function BoardMesh() {
  return (
    <group position={[0, BOARD_GROUP_Y, 0]}>
      <Frame />
      <Surface />
      <Decks />
      {BOARD.map((_, pos) => (
        <TileOverlay key={pos} pos={pos} />
      ))}
    </group>
  );
}
