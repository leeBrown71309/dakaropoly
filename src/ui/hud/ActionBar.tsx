import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";
import { useRoom } from "../../net/roomStore";
import { useVoice } from "../../net/voice";
import { keepingFullscreen } from "../fullscreen";
import { useCompact } from "../useViewport";
import { useIsMyTurn, useIsOnline, useIsSpectator, useWaitingFor } from "../useTurn";
import { cameraRig } from "../../three/cameraRig";
import { formatMoney } from "../../game/types";
import { Rail, BrassRule } from "../kit/Surface";
import { Button, Fitting } from "../kit/Button";
import { Tooltip } from "../kit/Tooltip";
import { Money } from "../kit/Money";
import { PlayerMark } from "../icons/PlayerMark";
import { ChatPanel } from "./ChatPanel";

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
  const toggleChat = useGame((s) => s.toggleChat);
  const chatOpen = useGame((s) => s.chatOpen);
  const unread = useRoom((s) => s.unread);
  const voiceActive = useVoice((s) => s.active);
  const voiceMuted = useVoice((s) => s.muted);
  const voiceBusy = useVoice((s) => s.busy);
  const startVoice = useVoice((s) => s.start);
  const toggleMute = useVoice((s) => s.toggleMute);
  const spectatorVoice = useRoom((s) => s.spectatorVoice);
  const spectating = useIsSpectator();
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
  // The dice wait for an answer, as the engine now insists. Ending the turn
  // still lapses the offer, so this is never a dead end — and the offer's own
  // pane is on screen for both sides, which is where the reason is written.
  const offerWaiting = Boolean(game.pendingTrade);
  // Why the rail is not offering its usual action. A greyed button with no
  // reason is the thing players ask about first.
  const railBlock = offerWaiting
    ? {
        title: "Offre en attente",
        detail:
          "Un échange est sur la table. Il se répond avant que les dés repartent : accepté plus tard, il porterait sur un plateau qui a déjà bougé.",
      }
    : animating
      ? {
          title: "Le plateau rattrape",
          detail: "Les règles ont déjà avancé. La barre attend que les pions et les cartes finissent de jouer.",
        }
      : game.phase === "card"
        ? { title: "Carte en cours", detail: "La carte tirée bloque le tour jusqu'à ce qu'elle soit acquittée." }
        : game.phase === "buy-decision"
          ? { title: "Décision d'achat", detail: "Achetez le titre ou envoyez-le aux enchères avant de continuer." }
          : game.phase === "auction"
            ? { title: "Enchères en cours", detail: "La vente se termine avant que le tour reprenne." }
            : game.phase === "debt"
              ? { title: "Dette à régler", detail: "Rien d'autre n'est possible tant que la somme due n'est pas payée ou la faillite déclarée." }
              : null;
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

  // A spectator only gets a microphone if the host has opened it: a room
  // holds any number of them, and a dozen talking at once buries the game.
  const micAllowed = !spectating || spectatorVoice;

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
      {online && <ChatPanel />}

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
              <Tooltip
                title={railBlock?.title ?? "Tenter un double"}
                detail={
                  railBlock?.detail ??
                  "Un double vous fait sortir et vous avancez d'autant. Au troisième échec, vous payez 50 F et sortez quand même."
                }
              >
                <Button
                  face="gold"
                  size={primarySize}
                  icon="dice"
                  disabled={blocked || offerWaiting}
                  onClick={() => dispatch({ t: "roll" })}
                >
                  {compact ? "Double" : "Tenter un double"}
                </Button>
              </Tooltip>
              <Tooltip
                title={railBlock?.title ?? (player.money < 50 ? "Fonds insuffisants" : "Payer la caution")}
                detail={
                  railBlock?.detail ??
                  (player.money < 50
                    ? `La caution est de 50 F et vous n'avez que ${formatMoney(player.money)}.`
                    : "50 F à la banque et vous sortez immédiatement, puis vous lancez les dés normalement.")
                }
              >
                <Button
                  face="teal"
                  size={secondarySize}
                  icon="coins"
                  disabled={blocked || player.money < 50}
                  onClick={() => dispatch({ t: "pay-fine" })}
                >
                  {compact ? "50 F" : "Payer 50 F"}
                </Button>
              </Tooltip>
              <Tooltip
                title={railBlock?.title ?? (player.getOutCards <= 0 ? "Aucune carte" : "Sortie de prison")}
                detail={
                  railBlock?.detail ??
                  (player.getOutCards <= 0
                    ? "Il faut une carte Sortie de prison, tirée d'un paquet Baraka ou Teranga, pour sortir sans payer."
                    : "La carte est dépensée et vous sortez sans rien payer.")
                }
              >
                <Button
                  face="bone"
                  size={secondarySize}
                  icon="key"
                  disabled={blocked || player.getOutCards <= 0}
                  onClick={() => dispatch({ t: "use-jail-card" })}
                >
                  {compact ? `${player.getOutCards}` : `Carte (${player.getOutCards})`}
                </Button>
              </Tooltip>
            </>
          ) : game.phase === "turn-start" ? (
            <Tooltip
              title={railBlock?.title ?? "Lancer les dés"}
              detail={
                railBlock?.detail ??
                "Votre pion avance du total des deux dés. Un double vous fait rejouer — trois d'affilée vous envoient à Rebeuss."
              }
            >
              <Button
                face="gold"
                size={primarySize}
                icon="dice"
                disabled={blocked || offerWaiting}
                onClick={() => dispatch({ t: "roll" })}
              >
                {compact ? "Lancer" : "Lancer les dés"}
              </Button>
            </Tooltip>
          ) : game.phase === "post-roll" ? (
            <Tooltip
              title={railBlock?.title ?? "Terminer le tour"}
              detail={
                railBlock?.detail ??
                "Passe la main. C'est aussi le moment où une offre restée sans réponse expire — bâtissez ou hypothéquez avant, si vous y tenez."
              }
            >
              <Button
                face="bone"
                size={primarySize}
                icon="check"
                disabled={blocked}
                onClick={() => dispatch({ t: "end-turn" })}
              >
                {compact ? "Terminer" : "Terminer le tour"}
              </Button>
            </Tooltip>
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
            label="Échanger"
            active={tradeOpen}
            disabled={!myTurn || Boolean(game.pendingTrade)}
            onClick={toggleTrade}
          />
          <Fitting icon="receipt" label="Journal" active={logOpen} onClick={toggleLog} />
          {online && !micAllowed && (
            // A spectator's greyed microphone is the button most likely to be
            // tapped and least likely to explain itself: the native title
            // never shows on a phone, which is where this is played.
            <Tooltip
              title="Micro réservé aux joueurs"
              detail="L'hôte n'a pas ouvert le vocal aux spectateurs. Il peut le faire dans Paramètres, onglet Salon."
            >
              <Fitting icon="micOff" label="Micro réservé aux joueurs" disabled />
            </Tooltip>
          )}
          {online && micAllowed && (
            <Fitting
              icon={voiceActive && voiceMuted ? "micOff" : "mic"}
              label={!voiceActive ? "Activer le micro" : voiceMuted ? "Reprendre le micro" : "Couper le micro"}
              active={voiceActive && !voiceMuted}
              disabled={voiceBusy}
              onClick={() =>
                // Asking for the microphone costs the page its fullscreen on
                // Android: the prompt cannot be shown over it. The wrapper
                // takes it back at the player's next touch.
                voiceActive ? toggleMute() : void keepingFullscreen(() => startVoice())
              }
            />
          )}
          {online && (
            <span className="relative">
              <Fitting icon="chat" label="Discussion" active={chatOpen} onClick={toggleChat} />
              {unread > 0 && !chatOpen && (
                <span
                  className="u-label pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px]"
                  style={{ backgroundColor: "#C2643C", color: "#FBEDEB" }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
          )}
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
