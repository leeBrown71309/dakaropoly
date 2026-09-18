import { BOARD, STATION_RENTS } from "../../game/data/board";
import { GROUP_COLORS, GROUP_ON_COLOR } from "../../game/colors";
import { mortgageValue } from "../../game/selectors";
import type { TileDef } from "../../game/types";
import { Card, BrassRule } from "./Surface";
import { Money } from "./Money";

interface RentRow {
  label: string;
  value: number | string;
}

function streetRows(tile: TileDef): RentRow[] {
  const r = tile.rents ?? [];
  return [
    { label: "Loyer terrain nu", value: r[0] ?? 0 },
    { label: "Avec 1 maison", value: r[1] ?? 0 },
    { label: "Avec 2 maisons", value: r[2] ?? 0 },
    { label: "Avec 3 maisons", value: r[3] ?? 0 },
    { label: "Avec 4 maisons", value: r[4] ?? 0 },
    { label: "Avec hôtel", value: r[5] ?? 0 },
  ];
}

function stationRows(): RentRow[] {
  return STATION_RENTS.map((value, i) => ({
    label: i === 0 ? "1 gare possédée" : `${i + 1} gares possédées`,
    value,
  }));
}

function utilityRows(): RentRow[] {
  return [
    { label: "1 service possédé", value: "4 × dés" },
    { label: "2 services possédés", value: "10 × dés" },
  ];
}

interface TitleDeedProps {
  pos: number;
  /** Index of the row matching the current rent, printed in relief. */
  activeRow?: number;
  /** Tighter setting for a short screen — same register, smaller type. */
  dense?: boolean;
  className?: string;
}

/**
 * The property card itself, laid out like a real title deed: colour band,
 * engraved caption, rent register, then the mortgage footer.
 */
export function TitleDeed({ pos, activeRow, dense = false, className = "" }: TitleDeedProps) {
  const tile = BOARD[pos] as TileDef | undefined;
  if (!tile) return null;

  const isStreet = tile.kind === "street" && tile.group !== undefined;
  const band = isStreet && tile.group ? GROUP_COLORS[tile.group] : tile.kind === "station" ? "#2F2A22" : "#1E6F6B";
  const bandInk = isStreet && tile.group ? GROUP_ON_COLOR[tile.group] : "#F4EBD8";
  const kicker = isStreet ? "Titre de propriété" : tile.kind === "station" ? "Titre — réseau TER" : "Titre — service public";
  const rows = isStreet ? streetRows(tile) : tile.kind === "station" ? stationRows() : utilityRows();

  return (
    <Card className={`overflow-hidden ${className}`}>
      <div
        className={dense ? "px-2.5 pb-1.5 pt-1.5" : "px-3.5 pb-2.5 pt-2"}
        style={{
          backgroundColor: band,
          color: bandInk,
          boxShadow: "inset 0 -2px 6px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.22)",
        }}
      >
        <div className="u-label opacity-75">{kicker}</div>
        <div className={`u-display leading-[1.1] ${dense ? "mt-0.5 text-[15px]" : "mt-1 text-[19px]"}`}>
          {tile.name}
        </div>
      </div>

      <div className={dense ? "px-2.5 py-1.5" : "px-3.5 py-2.5"}>
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-baseline justify-between ${
              dense ? "py-[1px] text-[11px]" : "py-[3px] text-[12.5px]"
            } ${activeRow === i ? "font-bold text-ink-900" : "text-ink-700"}`}
          >
            <span className={activeRow === i ? "" : "opacity-85"}>{row.label}</span>
            <span className="mx-2 min-w-3 flex-1 translate-y-[-3px] border-b border-dotted border-ink-300/60" />
            {typeof row.value === "number" ? (
              <Money amount={row.value} className="font-semibold" />
            ) : (
              <span className="font-semibold">{row.value}</span>
            )}
          </div>
        ))}

        <BrassRule className={dense ? "my-1.5" : "my-2.5"} />

        <div
          className={`flex items-baseline justify-between text-ink-500 ${
            dense ? "text-[10.5px]" : "text-[11.5px]"
          }`}
        >
          <span>
            Hypothèque <Money amount={mortgageValue(pos)} className="font-bold text-ink-700" />
          </span>
          {tile.houseCost !== undefined && (
            <span>
              Maison <Money amount={tile.houseCost} className="font-bold text-ink-700" />
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
