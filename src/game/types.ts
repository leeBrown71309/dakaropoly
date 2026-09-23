export type ColorGroup =
  | "brown"
  | "lightblue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "darkblue";

export type TileKind =
  | "go"
  | "street"
  | "station"
  | "utility"
  | "tax"
  | "chance"
  | "chest"
  | "jail"
  | "free"
  | "goto-jail";

export interface TileDef {
  kind: TileKind;
  pos: number;
  name: string;
  group?: ColorGroup;
  price?: number;
  houseCost?: number;
  rents?: number[];
  taxAmount?: number;
}

export type CardEffect =
  | { k: "money"; amount: number }
  | { k: "collect-each"; amount: number }
  | { k: "pay-each"; amount: number }
  | { k: "move"; pos: number }
  | { k: "move-back"; steps: number }
  | { k: "go-to-jail" }
  | { k: "nearest-station" }
  | { k: "nearest-utility" }
  | { k: "repairs"; house: number; hotel: number }
  | { k: "jail-free" };

export interface CardDef {
  id: string;
  deck: "chance" | "chest";
  title: string;
  text: string;
  effect: CardEffect;
}

export interface PlayerStats {
  rentsCollected: number;
  rentPaid: number;
  jailVisits: number;
  cardsDrawn: number;
  doublesRolled: number;
  purchases: number;
}

export interface Player {
  id: number;
  name: string;
  pawn: number;
  color: string;
  money: number;
  position: number;
  inJail: boolean;
  jailAttempts: number;
  getOutCards: number;
  bankrupt: boolean;
  stats: PlayerStats;
}

export interface TileState {
  owner: number | null;
  houses: number;
  mortgaged: boolean;
}

export interface AuctionState {
  pos: number;
  order: number[];
  highBid: number;
  highBidder: number | null;
}

export interface DebtState {
  amount: number;
  creditor: number | null;
  distribute: boolean;
  after: "continue" | "release-move";
  moveSteps: number;
}

export interface GameState {
  phase: PhaseKind;
  buyTile: number | null;
  auction: AuctionState | null;
  debt: DebtState | null;
  card: { deck: "chance" | "chest"; cardId: string } | null;
  players: Player[];
  current: number;
  tiles: TileState[];
  houseStock: number;
  hotelStock: number;
  lastRoll: { a: number; b: number } | null;
  lastRollDouble: boolean;
  doublesCount: number;
  turnCount: number;
  winner: number | null;
  pendingAuctions: number[];
  decks: { chance: string[]; chest: string[] };
  discards: { chance: string[]; chest: string[] };
  turnEnded: boolean;
  /**
   * An offer lying on the table, waiting for the other side to answer.
   *
   * A trade used to execute the moment it was proposed, which between
   * friends on one screen is only impolite — online it is a way to take
   * somebody's property without asking them.
   */
  pendingTrade: PendingTrade | null;
  rng: number;
  log: string[];
}

export type PhaseKind =
  | "turn-start"
  | "resolving"
  | "post-roll"
  | "buy-decision"
  | "auction"
  | "debt"
  | "card"
  | "game-over";

export type GameEvent =
  | { t: "roll-dice"; a: number; b: number }
  | { t: "move-steps"; player: number; steps: number }
  | { t: "teleport"; player: number; pos: number }
  | { t: "money"; player: number; amount: number }
  | { t: "show-card"; deck: "chance" | "chest"; cardId: string }
  | { t: "buy"; player: number; pos: number; price: number }
  | { t: "auction-start"; pos: number; participants: number[] }
  | { t: "auction-end"; player: number | null; pos: number; price: number }
  | { t: "jail-in"; player: number }
  | { t: "jail-out"; player: number; reason: "fine" | "card" | "doubles" }
  | { t: "build"; pos: number; houses: number }
  | { t: "mortgage"; pos: number }
  | { t: "unmortgage"; pos: number }
  | { t: "transfer"; from: number; to: number; pos: number }
  | { t: "turn"; player: number }
  | { t: "winner"; player: number }
  | { t: "toast"; text: string; tone: "good" | "bad" | "info" }
  | { t: "announce"; kind: AnnounceKind; title: string; detail: string; amount?: number }
  | { t: "sound"; name: SoundName };

/**
 * Moments that happen *to* a player rather than being chosen by them.
 * They interrupt the animation queue with a card, because a toast is too
 * easy to miss when money leaves your account without you clicking.
 */
export type AnnounceKind = "tax" | "jail" | "rent" | "bankruptcy";

export type SoundName =
  | "dice"
  | "step"
  | "register"
  | "pay"
  | "coin"
  | "card"
  | "jail"
  | "buy"
  | "build"
  | "sell"
  | "mortgage"
  | "unmortgage"
  | "gavel"
  | "bankrupt"
  | "teleport"
  | "win";


export interface TradeOffer {
  to: number;
  giveMoney: number;
  giveProps: number[];
  takeMoney: number;
  takeProps: number[];
}

/** Who put an offer on the table, and what it is. The recipient is `offer.to`. */
export interface PendingTrade {
  from: number;
  offer: TradeOffer;
}

export type Action =
  | { t: "roll"; forced?: { a: number; b: number } }
  | { t: "ack-card" }
  | { t: "buy" }
  | { t: "decline" }
  | { t: "bid"; amount: number }
  | { t: "auction-pass" }
  | { t: "end-turn" }
  | { t: "build"; pos: number }
  | { t: "sell-house"; pos: number }
  | { t: "mortgage"; pos: number }
  | { t: "unmortgage"; pos: number }
  | { t: "pay-fine" }
  | { t: "use-jail-card" }
  | { t: "pay-debt" }
  | { t: "declare-bankruptcy" }
  /**
   * Walking out on one's own accord, rather than being driven out by a debt.
   * The estate returns to the bank and the game carries on without them —
   * legal in any phase but the ones that own the table: an auction, and the
   * drawer's own unacknowledged card, or the debtor's own unresolved debt.
   */
  | { t: "resign"; playerId: number }
  | { t: "offer-trade"; offer: TradeOffer }
  | { t: "accept-trade" }
  | { t: "reject-trade" }
  | { t: "withdraw-trade" }
  /**
   * Taking up a new name mid-game — after a late arrival sits in somebody's
   * abandoned chair, the board still says the old name. A name is display,
   * not a rule, so this is legal in any phase and belongs to the numbered
   * player rather than to whoever is to move.
   */
  | { t: "rename"; playerId: number; name: string };

export type ApplyResult = { state: GameState; events: GameEvent[] };

/**
 * How long a player's name may be. The join form, the rename fields and the
 * engine all cut the name to this, so nobody can wear a banner as a name.
 */
export const NAME_MAX = 14;

export const formatMoney = (n: number): string => `${n.toLocaleString("fr-FR")} F`;
