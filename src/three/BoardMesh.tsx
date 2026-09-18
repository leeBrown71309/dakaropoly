import { useMemo } from "react";
import { BOARD } from "../game/data/board";
import type { TileDef } from "../game/types";
import { tileCenter, SIDE_LAYOUT } from "./geometry";
import { tileLabelTexture, iconLabelTexture, deckTexture, centerLogoTexture } from "./textures";
import { useGame } from "../game/store";

const GROUP_COLORS: Record<string, string> = {
  brown: "#96613A",
  lightblue: "#7CC4E8",
  pink: "#D957A4",
  orange: "#F59331",
  red: "#E14B4B",
  yellow: "#F2C744",
  green: "#3AA65C",
  darkblue: "#2F5D9E",
};

const CORNER_ICON: Record<string, string> = {
  go: "🏁",
  jail: "🔒",
  free: "🅿️",
  "goto-jail": "👮",
  chance: "🍀",
  chest: "🤝",
  tax: "💸",
};

function TileMesh({ pos }: { pos: number }) {
  const geo = useMemo(() => tileCenter(pos), [pos]);
  const tile = BOARD[pos] as TileDef;
  const st = useGame((s) => (s.game ? s.game.tiles[pos] : undefined));
  const players = useGame((s) => s.game?.players);
  const ownerColor = st && st.owner !== null && players ? (players[st.owner]?.color ?? null) : null;
  const houses = st?.houses ?? 0;

  const layout = SIDE_LAYOUT[geo.side];
  const bandColor = tile.group ? GROUP_COLORS[tile.group] : null;
  const isCorner = tile.kind === "go" || tile.kind === "jail" || tile.kind === "free" || tile.kind === "goto-jail";

  const houseSpread = houses < 5 ? [-0.27, -0.09, 0.09, 0.27].slice(0, houses) : [];

  return (
    <group position={[geo.x, 0, geo.z]}>
      <mesh receiveShadow castShadow position={[0, 0.06, 0]}>
        <boxGeometry args={layout.dims} />
        <meshStandardMaterial color="#f2e9d8" roughness={0.9} />
      </mesh>
      {bandColor !== null && (
        <mesh position={[layout.band[0], 0.09, layout.band[1]]} receiveShadow castShadow>
          <boxGeometry args={layout.bandSize} />
          <meshStandardMaterial color={ownerColor ?? bandColor} roughness={0.65} />
        </mesh>
      )}
      {isCorner ? (
        <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.6, 1.0]} />
          <meshBasicMaterial map={iconLabelTexture(CORNER_ICON[tile.kind] ?? "", tile.name)} transparent />
        </mesh>
      ) : (
        <mesh position={[layout.label[0], 0.125, layout.label[1]]} rotation={[-Math.PI / 2, 0, layout.labelRot]}>
          <planeGeometry args={[0.92, 0.55]} />
          <meshBasicMaterial map={tileLabelTexture(tile.name, tile.price)} transparent />
        </mesh>
      )}
      {ownerColor !== null && (
        <mesh position={[layout.anchor[0], 0.13, layout.anchor[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.09, 16]} />
          <meshBasicMaterial color={ownerColor} />
        </mesh>
      )}
      {houses > 0 && houses < 5 && (
        <group position={[layout.houses[0], 0.18, layout.houses[1]]}>
          {houseSpread.map((offset, i) => (
            <mesh key={i} position={layout.housesAxis === "x" ? [offset, 0, 0] : [0, 0, offset]} castShadow>
              <boxGeometry args={[0.13, 0.13, 0.13]} />
              <meshStandardMaterial color="#2f9e4f" roughness={0.5} />
            </mesh>
          ))}
        </group>
      )}
      {houses === 5 && (
        <mesh position={[layout.houses[0], 0.2, layout.houses[1]]} castShadow>
          <boxGeometry args={[0.46, 0.2, 0.32]} />
          <meshStandardMaterial color="#c92a2a" roughness={0.5} />
        </mesh>
      )}
      {st?.mortgaged && (
        <mesh position={[0, 0.131, layout.label[1] * 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.8, 0.4]} />
          <meshBasicMaterial color="#8b1a1a" transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

function CenterPiece() {
  const decks = useMemo(
    () => [
      { x: -1.75, z: -1.7, rot: -0.25, tex: deckTexture("BARAKA !", "#f59e0b", "#3a2400") },
      { x: 1.75, z: -1.7, rot: 0.25, tex: deckTexture("TERANGA", "#e9dfc8", "#5a4a22") },
    ],
    [],
  );
  return (
    <group>
      {decks.map((d, i) => (
        <group key={i} position={[d.x, 0, d.z]} rotation={[0, d.rot, 0]}>
          <mesh receiveShadow position={[0, 0.1, 0]}>
            <boxGeometry args={[1.5, 0.08, 0.85]} />
            <meshStandardMaterial color="#d9cfb6" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.142, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.44, 0.8]} />
            <meshBasicMaterial map={d.tex} transparent />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function BoardMesh() {
  return (
    <group position={[0, -0.4, 0]}>
      <mesh receiveShadow castShadow position={[0, -0.2, 0]}>
        <boxGeometry args={[13.5, 0.5, 13.5]} />
        <meshStandardMaterial color="#20624a" roughness={0.85} />
      </mesh>
      <mesh receiveShadow position={[0, 0.051, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8.8, 8.8]} />
        <meshStandardMaterial color="#1a5240" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.2, 6.2]} />
        <meshBasicMaterial map={centerLogoTexture()} transparent />
      </mesh>
      {BOARD.map((_, pos) => (
        <TileMesh key={pos} pos={pos} />
      ))}
      <CenterPiece />
    </group>
  );
}
