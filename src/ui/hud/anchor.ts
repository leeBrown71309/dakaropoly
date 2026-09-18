/**
 * Where the three decision panels — buy, auction, debt — sit on screen.
 *
 * On a full screen they float against the right edge, vertically centred. On
 * a phone in landscape there is not enough height for that: a card centred on
 * a 380px viewport is taller than the space it has, and the half it loses is
 * off both ends at once. There it hangs from the top instead, stops short of
 * the action rail, and scrolls.
 */
export function decisionAnchor(compact: boolean): string {
  return compact
    ? "pointer-events-auto scroll-paper absolute right-1.5 top-1 z-30 max-h-[calc(100%-54px)] w-[240px] overflow-y-auto"
    : "pointer-events-auto absolute right-4 top-1/2 z-30 w-[312px] -translate-y-1/2";
}
