import type { ReactNode, SVGProps } from "react";
import { OUTLINE_PATHS, type OutlineName } from "./paths";

/**
 * Hand-drawn icon family for Dakaropoly.
 *
 * One consistent grid (24), one stroke weight, round joins, `currentColor`
 * only. Two icons are deliberately Senegalese rather than generic: the
 * "Baraka" deck is a cowrie shell and the "Teranga" deck an ataya teapot.
 */
export type IconName =
  | "dice"
  | "die"
  | "jail"
  | "lock"
  | "key"
  | "receipt"
  | "check"
  | "gavel"
  | "exchange"
  | "cowrie"
  | "teapot"
  | "house"
  | "hotel"
  | "hammer"
  | "warning"
  | "flag"
  | "banknote"
  | "coins"
  | "bank"
  | "deed"
  | "crown"
  | "soundOn"
  | "soundOff"
  | "arrowLeft"
  | "chevronDown"
  | "recenter"
  | "rotate"
  | "expand"
  | "shrink"
  | "cog"
  | "book"
  | "ranking"
  | "plus"
  | "minus"
  | "close";

/** Renders a shared outline, so the HUD and the printed board never drift. */
const outline = (name: OutlineName): ReactNode => (
  <>
    {OUTLINE_PATHS[name].map((d, i) => (
      <path key={i} d={d} />
    ))}
  </>
);

const ICONS: Record<IconName, ReactNode> = {
  dice: (
    <>
      <rect x="2.2" y="9.4" width="10.6" height="10.6" rx="2.6" transform="rotate(-9 7.5 14.7)" />
      <circle cx="5.9" cy="13.1" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="16.7" r="1.05" fill="currentColor" stroke="none" />
      <rect x="11.6" y="4" width="10.6" height="10.6" rx="2.6" transform="rotate(11 16.9 9.3)" />
      <circle cx="14.6" cy="7.6" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="19.2" cy="11" r="1.05" fill="currentColor" stroke="none" />
    </>
  ),
  die: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="8.4" cy="8.4" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="8.4" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="8.4" cy="15.6" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="15.6" r="1.25" fill="currentColor" stroke="none" />
    </>
  ),
  jail: outline("jail"),
  lock: (
    <>
      <rect x="4.6" y="10.4" width="14.8" height="9.8" rx="2.2" />
      <path d="M8.1 10.4V7.7a3.9 3.9 0 0 1 7.8 0v2.7" />
    </>
  ),
  key: (
    <>
      <circle cx="8.4" cy="8.4" r="4.1" />
      <path d="M11.4 11.4 20 20" />
      <path d="M17.3 16.7 15 19" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.3h12v17.4l-2.4-1.5-2.4 1.5-2.4-1.5-2.4 1.5L6 19.2z" />
      <path d="M9.2 8.2h5.6M9.2 12.2h5.6" />
    </>
  ),
  check: <path d="M4.6 12.6 9.6 17.6 19.6 6.4" />,
  gavel: (
    <>
      <rect x="12.1" y="2.7" width="4.7" height="8.6" rx="1.3" transform="rotate(45 14.45 7)" />
      <path d="M11.1 10.5 5 16.6a1.7 1.7 0 0 0 0 2.4l.4.4a1.7 1.7 0 0 0 2.4 0l6.1-6.1" />
      <path d="M3.2 21.3h9.4" />
    </>
  ),
  exchange: (
    <>
      <path d="M3.8 9.2h15.4" />
      <path d="M15.6 5.6 19.2 9.2 15.6 12.8" />
      <path d="M20.2 15.1H4.8" />
      <path d="M8.4 11.5 4.8 15.1 8.4 18.7" />
    </>
  ),
  cowrie: outline("cowrie"),
  teapot: outline("teapot"),
  house: <path d="M4.2 10.6 12 4.2l7.8 6.4v8.3a1.5 1.5 0 0 1-1.5 1.5H5.7a1.5 1.5 0 0 1-1.5-1.5z" />,
  hotel: (
    <>
      <path d="M5.2 20.4V5.9a1.5 1.5 0 0 1 1.5-1.5h10.6a1.5 1.5 0 0 1 1.5 1.5v14.5" />
      <path d="M2.9 20.4h18.2" />
      <path d="M8.4 8.2h2M13.6 8.2h2M8.4 12.1h2M13.6 12.1h2" />
      <path d="M10 20.4v-4.1h4v4.1" />
    </>
  ),
  hammer: (
    <>
      <path d="M12.9 7.3 16.4 3.8a1.4 1.4 0 0 1 2 0l1.8 1.8a1.4 1.4 0 0 1 0 2l-3.5 3.5z" />
      <path d="M13.9 10.3 5.9 18.3a2 2 0 1 0 2.8 2.8l8-8" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4.3 21 19.6H3z" />
      <path d="M12 10.2v4.2" />
      <circle cx="12" cy="17.2" r="0.95" fill="currentColor" stroke="none" />
    </>
  ),
  flag: (
    <>
      <path d="M6.1 21V3.6" />
      <path d="M6.1 4.8h11.2l-2.3 3.7 2.3 3.7H6.1" />
    </>
  ),
  banknote: (
    <>
      <rect x="2.4" y="6" width="19.2" height="12" rx="2.2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.1 9.6v4.8M17.9 9.6v4.8" />
    </>
  ),
  coins: outline("coins"),
  bank: (
    <>
      <path d="M2.9 9.5 12 4.1l9.1 5.4" />
      <path d="M5.2 9.5v9M9.4 9.5v9M14.6 9.5v9M18.8 9.5v9" />
      <path d="M2.9 20.6h18.2" />
    </>
  ),
  deed: (
    <>
      <rect x="4.6" y="3.4" width="14.8" height="17.2" rx="1.6" />
      <path d="M4.6 8.6h14.8" />
      <path d="M7.9 12.4h8.2M7.9 16.1h5.2" />
    </>
  ),
  crown: (
    <>
      <path d="M3.9 18.4h16.2" />
      <path d="M3.9 18.4V7.6l4.2 3.1L12 4.4l3.9 6.3 4.2-3.1v10.8" />
    </>
  ),
  soundOn: (
    <>
      <path d="M4 9.4h3.4L12 5.3v13.4L7.4 14.6H4z" />
      <path d="M15.4 9.3a4 4 0 0 1 0 5.4" />
      <path d="M18 6.8a7.6 7.6 0 0 1 0 10.4" />
    </>
  ),
  soundOff: (
    <>
      <path d="M4 9.4h3.4L12 5.3v13.4L7.4 14.6H4z" />
      <path d="M15.8 9.9 20.6 14.7M20.6 9.9 15.8 14.7" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19.2 12H4.8" />
      <path d="M10.6 6.2 4.8 12l5.8 5.8" />
    </>
  ),
  chevronDown: <path d="M6 9.5 12 15.5 18 9.5" />,
  cog: (
    <>
      <circle cx="12" cy="12" r="3.3" />
      <circle cx="12" cy="12" r="6.2" />
      <path d="M18.20 12.00L20.40 12.00M16.38 7.62L17.94 6.06M12.00 5.80L12.00 3.60M7.62 7.62L6.06 6.06M5.80 12.00L3.60 12.00M7.62 16.38L6.06 17.94M12.00 18.20L12.00 20.40M16.38 16.38L17.94 17.94" />
    </>
  ),
  book: (
    <>
      <path d="M4.2 5.4a2.2 2.2 0 0 1 2.2-2.2h13.4v15.6H6.4a2.2 2.2 0 0 0-2.2 2.2z" />
      <path d="M4.2 21a2.2 2.2 0 0 1 2.2-2.2h13.4" />
      <path d="M8.2 7.6h7.6M8.2 11.4h5.2" />
    </>
  ),
  ranking: <path d="M4.4 6.6h15.2M4.4 12h10.4M4.4 17.4h6" />,
  recenter: (
    <>
      <path d="M4 8.7v-3a1.7 1.7 0 0 1 1.7-1.7h3" />
      <path d="M15.3 4h3A1.7 1.7 0 0 1 20 5.7v3" />
      <path d="M20 15.3v3a1.7 1.7 0 0 1-1.7 1.7h-3" />
      <path d="M8.7 20h-3A1.7 1.7 0 0 1 4 18.3v-3" />
      <circle cx="12" cy="12" r="2.7" />
    </>
  ),
  rotate: (
    <>
      <rect x="8.7" y="2.4" width="6.6" height="11" rx="1.7" />
      <path d="M11.3 11.6h1.4" />
      {/* The sweep passes under the handset, never through it */}
      <path d="M4.4 14.4Q12 21.8 19.6 14.4" />
      <path d="M16.6 14.9 19.6 14.4 19 17.4" />
    </>
  ),
  expand: (
    <>
      <path d="M14.4 3.8H20v5.6" />
      <path d="M20 3.8 13.4 10.4" />
      <path d="M9.6 20.2H4v-5.6" />
      <path d="M4 20.2l6.6-6.6" />
    </>
  ),
  shrink: (
    <>
      <path d="M20.2 9.4h-5.6V3.8" />
      <path d="M14.6 9.4 20.6 3.4" />
      <path d="M3.8 14.6h5.6v5.6" />
      <path d="M9.4 14.6 3.4 20.6" />
    </>
  ),
  plus: <path d="M12 5.2v13.6M5.2 12h13.6" />,
  minus: <path d="M5.2 12h13.6" />,
  close: <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />,
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, size = 18, strokeWidth = 1.75, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {ICONS[name]}
    </svg>
  );
}
