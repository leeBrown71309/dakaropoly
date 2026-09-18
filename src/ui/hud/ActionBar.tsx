import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { useIsMyTurn, useIsOnline, useWaitingFor } from "../useTurn";
import { cameraRig } from "../../three/cameraRig";
import { Rail, BrassRule } from "../kit/Surface";
import { Button, Fitting } from "../kit/Button";
import { Money } from "../kit/Money";
import { PlayerMark } from "../icons/PlayerMark";

/** Pip positions on a 3×3 grid, row-major. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function MiniDie({ value, size }: { value: number; size: number }) {
  const on = PIPS[value] ?? [];
  return (
    <span
      className="grid grid-cols-3 grid-rows-3 gap-[1px] rounded-[3px] p-[3px]"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(180deg,#fbf6ea,#e6dac2)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.9), 0 1px 2px rgba(0,0,0,.45)",
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{ backgroundColor: on.includes(i) ? "#2b2620" : "transparent" }}
        />
      ))}
    </span>
  );
}

export function ActionBar() {
  const game = useGame((s) => s.game);
  const dispatch = useGame((s) => s.dispatch);
  const toggleLog = useGame((s) => s.toggleLog);
  const toggleManage = useGame((s) => s.toggleManage);
  const toggleTrade = useGame((s) => s.toggleTrade);
  const toggleSettings = useGame((s) => s.toggleSettings);
  const logOpen = useGame((s) => s.logOpen);
  const manageOpen = useGame((s) => s.manageOpen);
  const tradeOpen = useGame((s) => s.tradeOpen);
  const settingsOpen = useGame((s) => s.settingsOpen);
  const animating = useGame((s) => s.animating);
  const compact = useCompact();
  const myTurn = useIsMyTurn();
  const online = useIsOnline();
  const waitingForName = useWaitingFor();

  if (!game || game.phase === "game-over") return null;
  const player = game.players[game.current];
  if (!player) return null;

  const busy = animating || game.phase === "resolving" || game.phase === "card";
  const blocked = busy || game.phase === "buy-decision" || game.phase === "auction" || game.phase === "debt";
  // While the queue is playing the rules have already moved on, but the board
  // has not — so the rail waits too rather than offering the next action.
  const waitingFor = waitingForName
    ? `Au tour de ${waitingForName}`
    : animating
      ? "En cours"
      : game.phase === "buy-decision"
        ? compact
          ? "Achat"
          : "Décision d'achat"
        : game.phase === "auction"
          ? compact
            ? "Enchères"
            : "Enchères en cours"
          : game.phase === "debt"
            ? compact
              ? "Dette"
              : "Dette à régler"
            : "Résolution";

  const primarySize = compact ? "md" : "lg";
  const secondarySize = compact ? "sm" : "md";
  const waiting = (
    <span
      className={`u-label flex items-center gap-2 whitespace-nowrap text-gold-300/80 ${
        compact ? "px-1.5 py-2" : "px-4 py-3"
      }`}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-300" />
      {waitingFor}
    </span>
  );

  return (
    <>
      {logOpen && <LogReceipt compact={compact} />}

      <Rail
        className={`pointer-events-auto absolute bottom-0 left-1/2 z-30 flex max-w-full -translate-x-1/2 items-center rounded-b-none ${
          compact ? "gap-1.5 px-1.5 pb-1.5 pt-1.5" : "gap-3 px-3 pb-3 pt-2.5"
        }`}
      >
        <span className="mat-brass absolute inset-x-0 top-0 h-[2px]" />

        {/* Who is playing, on an inset paper plate */}
        <div
          className={`flex min-w-0 shrink-0 items-center rounded-[3px] ${
            compact ? "gap-1.5 px-1.5 py-1" : "gap-2.5 px-2.5 py-1.5"
          }`}
          style={{
            background: "linear-gradient(180deg,#f7f0e1,#e8dcc4)",
            boxShadow: "inset 0 2px 5px rgba(78,56,28,.35), 0 1px 0 rgba(255,225,180,.16)",
          }}
        >
          <PlayerMark player={player} size={compact ? 19 : 26} />
          <div className="min-w-0 leading-tight">
            <div
              className={`u-display truncate text-ink-900 ${compact ? "max-w-[92px] text-[11.5px]" : "text-[14px]"}`}
            >
              {player.name}
            </div>
            <Money
              amount={player.money}
              className={`font-bold text-ink-700 ${compact ? "text-[10.5px]" : "text-[12px]"}`}
            />
          </div>
          {game.lastRoll && (
            <span
              className={`flex shrink-0 gap-1 border-l border-ink-300/40 ${compact ? "pl-1.5" : "ml-1 pl-2.5"}`}
            >
              <MiniDie value={game.lastRoll.a} size={compact ? 17 : 22} />
              <MiniDie value={game.lastRoll.b} size={compact ? 17 : 22} />
            </span>
          )}
        </div>

        {/* Primary action for the current phase */}
        <div className={`flex items-center ${compact ? "gap-1" : "gap-2"}`}>
          {animating || !myTurn ? (
            waiting
          ) : game.phase === "turn-start" && player.inJail ? (
            <>
              <Button
                face="gold"
                size={primarySize}
                icon="dice"
                disabled={blocked}
                onClick={() => dispatch({ t: "roll" })}
              >
                {compact ? "Double" : "Tenter un double"}
              </Button>
              <Button
                face="teal"
                size={secondarySize}
                icon="coins"
                disabled={blocked || player.money < 50}
                onClick={() => dispatch({ t: "pay-fine" })}
              >
                {compact ? "50 F" : "Payer 50 F"}
              </Button>
              <Button
                face="bone"
                size={secondarySize}
                icon="key"
                disabled={blocked || player.getOutCards <= 0}
                onClick={() => dispatch({ t: "use-jail-card" })}
              >
                {compact ? `${player.getOutCards}` : `Carte (${player.getOutCards})`}
              </Button>
            </>
          ) : game.phase === "turn-start" ? (
            <Button
              face="gold"
              size={primarySize}
              icon="dice"
              disabled={blocked}
              onClick={() => dispatch({ t: "roll" })}
            >
              {compact ? "Lancer" : "Lancer les dés"}
            </Button>
          ) : game.phase === "post-roll" ? (
            <Button
              face="bone"
              size={primarySize}
              icon="check"
              disabled={blocked}
              onClick={() => dispatch({ t: "end-turn" })}
            >
              {compact ? "Terminer" : "Terminer le tour"}
            </Button>
          ) : (
            waiting
          )}
        </div>

        {/* Fittings */}
        <div
          className={`flex items-center border-l border-black/30 ${compact ? "gap-1 pl-1.5" : "gap-1.5 pl-3"}`}
        >
          <Fitting icon="deed" label="Patrimoine" active={manageOpen} onClick={toggleManage} />
          <Fitting
            icon="exchange"
            label={online ? "Échanges : bientôt en ligne" : "Échanger"}
            active={tradeOpen}
            disabled={online}
            onClick={toggleTrade}
          />
          <Fitting icon="receipt" label="Journal" active={logOpen} onClick={toggleLog} />
          {/* On a phone the camera buttons fold into the rail: pinching already
              zooms, so only the recentre is worth its own corner. */}
          {compact && <Fitting icon="recenter" label="Recadrer le plateau" onClick={() => cameraRig.reset()} />}
          <Fitting icon="cog" label="Paramètres et règles" active={settingsOpen} onClick={toggleSettings} />
        </div>
      </Rail>

      {player.money < 0 && (
        <div
          className={`pointer-events-auto absolute left-1/2 z-30 -translate-x-1/2 ${
            compact ? "bottom-[58px]" : "bottom-[86px]"
          }`}
        >
          <span className="u-label rounded-[3px] bg-clay-700 px-2.5 py-1.5 text-sand-50 shadow-lg">
            Solde négatif&nbsp;: <Money amount={player.money} />
          </span>
        </div>
      )}
    </>
  );
}

/** The game log, printed as a till receipt torn off above the rail. */
function LogReceipt({ compact }: { compact: boolean }) {
  const game = useGame((s) => s.game);
  if (!game) return null;
  const entries = [...game.log].reverse().slice(0, 40);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className={`pointer-events-auto absolute left-1/2 z-30 max-w-[92vw] -translate-x-1/2 ${
          compact ? "bottom-[58px] w-[300px]" : "bottom-[92px] w-[380px]"
        }`}
      >
        <div
          className={`mat-grain relative ${compact ? "px-3 pb-2 pt-2" : "px-4 pb-3 pt-3"}`}
          style={{
            background: "linear-gradient(180deg,#fdfaf2 0%,#f3ebd9 100%)",
            boxShadow: "0 16px 34px -12px rgba(52,33,12,.6)",
          }}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="u-label text-ink-500">Journal de partie</span>
            <span className="u-label text-ink-300">Tour {game.turnCount + 1}</span>
          </div>
          <BrassRule className="mb-2" />
          <div className={`scroll-paper overflow-y-auto pr-1 ${compact ? "max-h-28" : "max-h-52"}`}>
            {entries.map((entry, i) => (
              <div
                key={i}
                className={`border-b border-dotted border-ink-300/40 leading-snug text-ink-700 last:border-0 ${
                  compact ? "py-[3px] text-[11px]" : "py-[5px] text-[12px]"
                }`}
              >
                {entry}
              </div>
            ))}
          </div>
        </div>
        {/* Torn edge */}
        <div className="perforated" style={{ background: "#f3ebd9" }} />
        <svg viewBox="0 0 380 8" className="block h-2 w-full" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 0h380v3l-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5-9.5-5-9.5 5L0 3z"
            fill="#f3ebd9"
          />
        </svg>
      </motion.div>
    </AnimatePresence>
  );
}
