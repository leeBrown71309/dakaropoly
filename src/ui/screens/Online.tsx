import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { useRoom } from "../../net/roomStore";
import { formatCode, inviteLink, normaliseCode, CODE_SIZE, seatedInOrder } from "../../net/room";
import { PAWN_NAMES, PAWN_SHAPES, PLAYER_COLORS } from "../../game/data/pawns";
import { useCompact } from "../useViewport";
import { useCopy } from "../useCopy";
import { quitToHome } from "../leaveGame";
import { Card, Label, BrassRule } from "../kit/Surface";
import { Button, Fitting } from "../kit/Button";
import { PawnGlyph } from "../icons/PawnGlyph";
import { Icon } from "../icons/Icon";

const MAX_PLAYERS = 8;

/**
 * Creating or joining a room, then the lobby itself.
 *
 * One screen rather than three: before a code exists it is a short form, and
 * after it the same frame becomes the roster. Nothing moves on screen between
 * the two, which makes the transition read as the room filling up.
 */
export function Online() {
  const mode = useGame((s) => s.onlineMode);
  const pendingCode = useGame((s) => s.pendingCode);
  const compact = useCompact();

  const code = useRoom((s) => s.code);
  const pending = useRoom((s) => s.pending);
  const busy = useRoom((s) => s.busy);
  const error = useRoom((s) => s.error);
  const clearError = useRoom((s) => s.clearError);

  const [name, setName] = useState("");
  const [pawn, setPawn] = useState<number | null>(0);
  const [codeInput, setCodeInput] = useState(pendingCode);

  // `pendingCode` arrives from a shared link one render after mount, so the
  // field has to follow it rather than keep the empty value it started with.
  useEffect(() => {
    if (pendingCode) setCodeInput(pendingCode);
  }, [pendingCode]);

  const host = useRoom((s) => s.host);
  const join = useRoom((s) => s.join);

  const joining = mode === "join";
  const nameOk = name.trim().length > 0;
  const codeOk = codeInput.length === CODE_SIZE;
  const ready = nameOk && (!joining || codeOk) && !busy;

  const submit = () => {
    if (!ready) return;
    if (joining) void join(codeInput, name.trim(), pawn);
    else if (pawn !== null) void host(name.trim(), pawn);
  };

  return (
    <div className="mat-felt h-full overflow-hidden">
      <div className="p-safe h-full">
        <div className={`scroll-paper h-full overflow-y-auto ${compact ? "px-3 py-3" : "px-6 py-8"}`}>
          <div className={`mx-auto max-w-full ${compact ? "w-[760px]" : "w-[620px]"}`}>
            <div className={`flex items-center gap-3 ${compact ? "mb-2" : "mb-4"}`}>
              <Fitting icon="arrowLeft" label="Retour" onClick={quitToHome} />
              <h1 className={`u-display text-sand-100 ${compact ? "text-[16px]" : "text-[22px]"}`}>
                {pending
                  ? "Partie en cours"
                  : code
                    ? "Salon"
                    : joining
                      ? "Rejoindre une partie"
                      : "Créer une partie"}
              </h1>
            </div>

            {error && (
              <button
                type="button"
                onClick={clearError}
                className="mb-2 flex w-full items-center gap-2 rounded-[3px] px-3 py-2 text-left"
                style={{ backgroundColor: "#8E4526", color: "#FBEDEB" }}
              >
                <Icon name="warning" size={15} className="shrink-0" />
                <span className="text-[12px] font-semibold">{error}</span>
                <Icon name="close" size={13} className="ml-auto shrink-0 opacity-70" />
              </button>
            )}

            {pending ? (
              <Resume compact={compact} />
            ) : code ? (
              <Lobby compact={compact} />
            ) : (
              <Card className={compact ? "p-3" : "p-4"}>
                {joining && (
                  <div className="mb-3">
                    <Label>Code du salon</Label>
                    <input
                      value={codeInput}
                      onChange={(e) => setCodeInput(normaliseCode(e.target.value))}
                      placeholder="ABC-123"
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      className="field mt-1 text-center text-[22px] font-bold tracking-[0.3em]"
                    />
                  </div>
                )}

                <Label>Votre nom</Label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="Comment on vous appelle ?"
                  maxLength={14}
                  className="field mt-1 text-[14px]"
                />

                <BrassRule className="my-3" />

                <Label>{joining ? "Votre pion, ou spectateur" : "Votre pion"}</Label>
                <PawnPicker value={pawn} onPick={setPawn} allowSpectator={joining} />

                <Button
                  face="gold"
                  size={compact ? "md" : "lg"}
                  icon={joining ? "check" : "dice"}
                  block
                  className="mt-4"
                  disabled={!ready}
                  onClick={submit}
                >
                  {busy ? "Un instant…" : joining ? "Rejoindre" : "Créer le salon"}
                </Button>
                {!nameOk && (
                  <p className="mt-2 text-center text-[11.5px] text-ink-500">
                    Il faut un nom pour que les autres vous reconnaissent.
                  </p>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PawnPicker({
  value,
  onPick,
  allowSpectator,
  taken = [],
}: {
  value: number | null;
  onPick: (pawn: number | null) => void;
  allowSpectator: boolean;
  taken?: number[];
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {PAWN_SHAPES.map((_, i) => {
        const isTaken = taken.includes(i);
        return (
          <button
            key={i}
            type="button"
            disabled={isTaken}
            title={PAWN_NAMES[i]}
            aria-label={PAWN_NAMES[i]}
            onClick={() => onPick(i)}
            className="flex h-10 w-10 items-center justify-center rounded-[3px] transition disabled:cursor-not-allowed disabled:opacity-20"
            style={{
              color: PLAYER_COLORS[i],
              background: value === i ? "rgba(232,162,59,.22)" : "transparent",
              boxShadow:
                value === i
                  ? "inset 0 0 0 1.5px rgba(168,112,31,.9)"
                  : "inset 0 0 0 1px rgba(110,86,52,.18)",
            }}
          >
            <PawnGlyph pawn={i} size={24} />
          </button>
        );
      })}
      {allowSpectator && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="flex h-10 items-center gap-1.5 rounded-[3px] px-3 text-[12px] font-bold text-ink-700 transition"
          style={{
            background: value === null ? "rgba(30,111,107,.18)" : "transparent",
            boxShadow:
              value === null
                ? "inset 0 0 0 1.5px rgba(30,111,107,.75)"
                : "inset 0 0 0 1px rgba(110,86,52,.18)",
          }}
        >
          <Icon name="ranking" size={14} />
          Spectateur
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Lobby({ compact }: { compact: boolean }) {
  const code = useRoom((s) => s.code) ?? "";
  const seats = useRoom((s) => s.seats);
  const present = useRoom((s) => s.present);
  const clientId = useRoom((s) => s.clientId);
  const hostId = useRoom((s) => s.hostId);
  const busy = useRoom((s) => s.busy);
  const setPawn = useRoom((s) => s.setPawn);
  const start = useRoom((s) => s.start);
  const leave = useRoom((s) => s.leave);
  const goHome = useGame((s) => s.goHome);
  const { copied, copy } = useCopy();

  const me = seats.find((s) => s.clientId === clientId);
  const players = seatedInOrder(seats);
  // Presence, not the roster: standing in a room is a fact about the channel
  // rather than about the game, and nobody writes a row to watch.
  const watchers = useRoom((s) => s.watchers);
  const isHost = clientId !== null && clientId === hostId;
  const takenPawns = seats
    .filter((s) => s.clientId !== clientId && s.pawn !== null)
    .map((s) => s.pawn as number);

  const quit = () => {
    void leave().then(goHome);
  };

  return (
    <>
      <Card className={`text-center ${compact ? "p-3" : "p-4"}`}>
        <Label>Code du salon</Label>
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`u-display mt-1 tracking-[0.18em] text-ink-900 ${
            compact ? "text-[30px]" : "text-[40px]"
          }`}
        >
          {formatCode(code)}
        </motion.div>
        <p className="mt-1 text-[12px] text-ink-500">
          Les autres le saisissent depuis « Rejoindre une partie ».
        </p>
        <div className="mt-2 flex justify-center gap-1.5">
          <Button
            face="bone"
            size="sm"
            icon={copied === "code" ? "check" : "key"}
            onClick={() => copy("code", code)}
          >
            {copied === "code" ? "Code copié" : "Copier le code"}
          </Button>
          <Button
            face="bone"
            size="sm"
            icon={copied === "link" ? "check" : "exchange"}
            onClick={() => copy("link", inviteLink(code))}
          >
            {copied === "link" ? "Lien copié" : "Copier le lien"}
          </Button>
        </div>
      </Card>

      <Card className={`mt-2 ${compact ? "p-3" : "p-4"}`}>
        <div className="flex items-center">
          <Label>
            Joueurs {players.length}/{MAX_PLAYERS}
          </Label>
          {watchers.length > 0 && (
            <span className="u-label ml-auto text-ink-300">{watchers.length} spectateur(s)</span>
          )}
        </div>
        <BrassRule className="my-2" />

        <div className={compact ? "grid grid-cols-2 gap-1.5" : "flex flex-col gap-1.5"}>
          {players.map((s) => (
            <div
              key={s.clientId}
              className="flex items-center gap-2.5 rounded-[3px] px-2.5 py-1.5"
              style={{
                background: "rgba(120,95,60,.07)",
                boxShadow: "inset 0 0 0 1px rgba(110,86,52,.2)",
              }}
            >
              <span style={{ color: PLAYER_COLORS[s.pawn ?? 0] }} className="shrink-0">
                <PawnGlyph pawn={s.pawn ?? 0} size={22} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink-900">
                {s.name}
                {s.clientId === clientId && <span className="ml-1.5 u-label text-gold-700">vous</span>}
              </span>
              {s.clientId === hostId && <Icon name="crown" size={13} className="shrink-0 text-gold-700" />}
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                title={present.includes(s.clientId) ? "connecté" : "absent"}
                style={{ backgroundColor: present.includes(s.clientId) ? "#1E6F6B" : "#9A8F7C" }}
              />
            </div>
          ))}
        </div>

        {me && (
          <>
            <BrassRule className="my-2.5" />
            <Label>Changer de pion</Label>
            <PawnPicker
              value={me.pawn}
              taken={takenPawns}
              allowSpectator
              onPick={(p) => void setPawn(p, me.name)}
            />
          </>
        )}
      </Card>

      <div className={`flex items-center gap-2 ${compact ? "mt-3" : "mt-5"}`}>
        <Button face="slate" size={compact ? "sm" : "md"} icon="arrowLeft" onClick={quit}>
          Quitter le salon
        </Button>
        {isHost ? (
          <Button
            face="gold"
            size={compact ? "md" : "lg"}
            icon="dice"
            className="ml-auto"
            disabled={players.length < 2 || busy}
            onClick={() => void start()}
          >
            Lancer la partie
          </Button>
        ) : (
          <span className="u-label ml-auto flex items-center gap-2 text-sand-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-300" />
            En attente de l'hôte
          </span>
        )}
      </div>
      {isHost && players.length < 2 && (
        <p className="mt-2 text-center text-[11.5px] text-sand-300/70">
          Il faut au moins deux joueurs assis pour commencer.
        </p>
      )}
    </>
  );
}


/* ------------------------------------------------------------------ */

/**
 * The door into a game that has already started.
 *
 * The whole table is shown rather than only what is free, because the
 * question someone arriving late actually has is where their friends have
 * got to — and because a chair marked as still held explains why it cannot
 * be taken far better than leaving it out would.
 */
function Resume({ compact }: { compact: boolean }) {
  const pending = useRoom((s) => s.pending);
  const busy = useRoom((s) => s.busy);
  const resume = useRoom((s) => s.resume);
  const watch = useRoom((s) => s.watch);
  const cancelPending = useRoom((s) => s.cancelPending);

  if (!pending) return null;
  const free = pending.offers.filter((o) => o.free);

  return (
    <>
      <Card className={compact ? "p-3" : "p-4"}>
        <Label>Code {formatCode(pending.code)}</Label>
        <p className={`mt-1 leading-snug text-ink-700 ${compact ? "text-[12px]" : "text-[13px]"}`}>
          {free.length > 0
            ? "La partie a déjà commencé. Une place vous attend, ou installez-vous pour regarder."
            : "La partie a déjà commencé et toutes les places sont tenues. Vous pouvez la suivre en spectateur."}
        </p>

        <BrassRule className="my-2.5" />

        <div className={compact ? "grid grid-cols-2 gap-1.5" : "flex flex-col gap-1.5"}>
          {pending.offers.map((o) => (
            <div
              key={o.seat}
              className="flex items-center gap-2.5 rounded-[3px] px-2.5 py-1.5"
              style={{
                background: o.free ? "rgba(232,162,59,.12)" : "rgba(120,95,60,.07)",
                boxShadow: o.free
                  ? "inset 0 0 0 1px rgba(168,112,31,.55)"
                  : "inset 0 0 0 1px rgba(110,86,52,.2)",
              }}
            >
              <span
                style={{ color: PLAYER_COLORS[o.pawn], opacity: o.out ? 0.35 : 1 }}
                className="shrink-0"
              >
                <PawnGlyph pawn={o.pawn} size={22} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink-900">
                {o.name}
              </span>
              {o.free ? (
                <Button
                  face={o.mine ? "gold" : "teal"}
                  size="sm"
                  icon="check"
                  disabled={busy}
                  onClick={() => void resume(o.seat)}
                >
                  {o.mine ? "Ma place" : "Prendre"}
                </Button>
              ) : (
                <span className="u-label shrink-0 text-ink-300">{o.out ? "éliminé" : "en jeu"}</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className={`flex items-center gap-2 ${compact ? "mt-3" : "mt-5"}`}>
        <Button face="slate" size={compact ? "sm" : "md"} icon="arrowLeft" onClick={cancelPending}>
          Un autre code
        </Button>
        <Button
          face="bone"
          size={compact ? "sm" : "md"}
          icon="ranking"
          className="ml-auto"
          disabled={busy}
          onClick={() => void watch()}
        >
          Regarder la partie
        </Button>
      </div>
    </>
  );
}
