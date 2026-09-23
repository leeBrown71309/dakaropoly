import type { ReactNode } from "react";
import { BOARD, GROUP_MEMBERS, GROUP_ORDER, STATION_RENTS } from "../../../game/data/board";
import { GROUP_COLORS, GROUP_NAMES, GROUP_ON_COLOR } from "../../../game/colors";
import { formatMoney } from "../../../game/types";
import { useCompact } from "../../useViewport";
import { Money } from "../../kit/Money";
import { Icon } from "../../icons/Icon";
import { Section } from "./SettingsLayout";

const STATIONS = BOARD.filter((tile) => tile.kind === "station");
const UTILITIES = BOARD.filter((tile) => tile.kind === "utility");

interface DeedCardProps {
  /** The band across the top, printed the way the title deed prints it. */
  band: string;
  ink: string;
  rank?: number;
  name: string;
  /** Right-hand side of the band. */
  badge: ReactNode;
  lines: { name: string; price: number }[];
  footer: ReactNode;
}

/**
 * One group, as a miniature of the title deeds the buy panel shows: the
 * colour band on top, the streets and what they cost, and what the group
 * earns once it is built on. The old list ran all of that together on two
 * lines per group, and the eye had nothing to hold on to.
 */
function DeedCard({ band, ink, rank, name, badge, lines, footer }: DeedCardProps) {
  const compact = useCompact();
  return (
    <div
      className="flex flex-col overflow-hidden rounded-[3px]"
      style={{
        background: "rgba(255,252,244,.7)",
        boxShadow: "inset 0 0 0 1px rgba(110,86,52,.22), 0 1px 0 rgba(255,255,255,.7)",
      }}
    >
      <div
        className={`flex items-center gap-2 ${compact ? "px-2 py-1" : "px-2.5 py-1.5"}`}
        style={{ backgroundColor: band, color: ink, boxShadow: "inset 0 -1px 0 rgba(0,0,0,.18)" }}
      >
        {rank !== undefined && <span className="u-label opacity-75">{rank}</span>}
        <span className={`u-display leading-none ${compact ? "text-[12.5px]" : "text-[14px]"}`}>{name}</span>
        <span className="u-label ml-auto opacity-90">{badge}</span>
      </div>
      <ul className={`flex-1 ${compact ? "px-2 py-1" : "px-2.5 py-1.5"}`}>
        {lines.map((line) => (
          <li
            key={line.name}
            className={`flex items-baseline gap-2 text-ink-700 ${compact ? "py-px text-[11px]" : "py-0.5 text-[12px]"}`}
          >
            <span className="truncate">{line.name}</span>
            <span className="min-w-3 flex-1 translate-y-[-3px] border-b border-dotted border-ink-300/60" />
            <Money amount={line.price} className="shrink-0 font-semibold text-ink-900" />
          </li>
        ))}
      </ul>
      <div
        className={`border-t border-[rgba(110,86,52,.14)] text-ink-500 ${
          compact ? "px-2 py-1 text-[10.5px]" : "px-2.5 py-1.5 text-[11px]"
        }`}
      >
        {footer}
      </div>
    </div>
  );
}

export function GroupsTab() {
  const grid = "grid grid-cols-1 gap-2 @lg:grid-cols-2";

  return (
    <div className="@container">
      <Section bare title="Les huit groupes" icon="ranking" note="Du moins cher au plus cher, dans l'ordre du plateau.">
        <div className={grid}>
          {GROUP_ORDER.map((group, rank) => {
            const tiles = GROUP_MEMBERS[group]
              .map((pos) => BOARD[pos])
              .filter((t): t is NonNullable<typeof t> => t !== undefined);
            const hotelRent = Math.max(...tiles.map((t) => t.rents?.[5] ?? 0));
            const bareRent = Math.min(...tiles.map((t) => t.rents?.[0] ?? 0));
            return (
              <DeedCard
                key={group}
                band={GROUP_COLORS[group]}
                ink={GROUP_ON_COLOR[group]}
                rank={rank + 1}
                name={GROUP_NAMES[group]}
                badge={
                  <span className="flex items-center gap-1">
                    <Icon name="house" size={11} />
                    {formatMoney(tiles[0]?.houseCost ?? 0)}
                  </span>
                }
                lines={tiles.map((t) => ({ name: t.name, price: t.price ?? 0 }))}
                footer={
                  <>
                    Loyer nu dès <b className="text-ink-700">{formatMoney(bareRent)}</b> · hôtel jusqu'à{" "}
                    <b className="text-ink-700">{formatMoney(hotelRent)}</b>
                  </>
                }
              />
            );
          })}
        </div>
      </Section>

      <Section
        bare
        title="Gares et services"
        icon="deed"
        note="Ni maison ni hôtel : leur loyer dépend du nombre que vous en possédez."
      >
        <div className={grid}>
          <DeedCard
            band="#3A342B"
            ink="#F5EDDD"
            name="Gares"
            badge={formatMoney(STATIONS[0]?.price ?? 0)}
            lines={STATIONS.map((t) => ({ name: t.name, price: t.price ?? 0 }))}
            footer={
              <>
                Loyer selon le nombre possédé :{" "}
                <b className="text-ink-700">{STATION_RENTS.map((r) => formatMoney(r)).join(" · ")}</b>
              </>
            }
          />
          <DeedCard
            band="#3A342B"
            ink="#F5EDDD"
            name="Services publics"
            badge={formatMoney(UTILITIES[0]?.price ?? 0)}
            lines={UTILITIES.map((t) => ({ name: t.name, price: t.price ?? 0 }))}
            footer={
              <>
                Loyer : <b className="text-ink-700">4 × les dés</b>, ou <b className="text-ink-700">10 ×</b> avec
                les deux services.
              </>
            }
          />
        </div>
      </Section>
    </div>
  );
}
