import { useState } from "react";
import { useRoom } from "../../net/roomStore";
import { useVoice } from "../../net/voice";
import { formatCode, inviteLink } from "../../net/room";
import { NAME_MAX } from "../../game/types";
import { useCompact } from "../useViewport";
import { useCopy } from "../useCopy";
import { Label, BrassRule } from "../kit/Surface";
import { Button, Fitting } from "../kit/Button";
import { Icon } from "../icons/Icon";

/**
 * The room, from inside the game — one section per question this panel
 * answers: who am I here, how do others get in, may the spectators talk,
 * and is this device still connected. Who sits where is the left roster's
 * business, and is not repeated here.
 *
 * The code stops being visible the moment play begins, which is exactly when
 * it is needed most: somebody's phone dies, or a friend turns up late, and
 * the one thing that lets them in is a string nobody wrote down. It lives in
 * the settings panel because that is the only surface reachable at any point
 * in a turn without giving anything up.
 */
export function RoomPanel() {
  const code = useRoom((s) => s.code);
  const present = useRoom((s) => s.present);
  const clientId = useRoom((s) => s.clientId);
  const reconnecting = useRoom((s) => s.reconnecting);
  const restore = useRoom((s) => s.restore);
  const voiceActive = useVoice((s) => s.active);
  const voiceError = useVoice((s) => s.error);
  const stopVoice = useVoice((s) => s.stop);
  const hostId = useRoom((s) => s.hostId);
  const spectatorVoice = useRoom((s) => s.spectatorVoice);
  const allowSpectatorVoice = useRoom((s) => s.allowSpectatorVoice);
  const compact = useCompact();
  const { copied, copy } = useCopy();

  if (!code) return null;

  const connected = clientId !== null && present.includes(clientId);
  const isHost = clientId !== null && clientId === hostId;

  return (
    <div>
      <RenameRow />

      <BrassRule className="my-3" />

      <div className="flex items-center gap-3">
        <div>
          <Label>Code du salon</Label>
          <div className={`u-display tracking-[0.16em] text-ink-900 ${compact ? "text-[22px]" : "text-[28px]"}`}>
            {formatCode(code)}
          </div>
        </div>
        <div className="ml-auto flex flex-col gap-1.5">
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
      </div>

      <p className="mt-1.5 text-[11.5px] leading-snug text-ink-500">
        Un joueur qui a quitté la partie peut y revenir avec ce code et reprendre sa place.
      </p>

      <BrassRule className="my-3" />

      {/*
        * The host's switch. Everyone sees where it stands — a spectator whose
        * microphone is shut should be able to find out why without asking —
        * but only the host can move it, here and in the database.
        */}
      <div className="flex items-center gap-2">
        <Icon name="eye" size={14} className="shrink-0 text-ink-300" />
        <div className="min-w-0 flex-1">
          <Label>Micro des spectateurs</Label>
          <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">
            {spectatorVoice
              ? "Les spectateurs peuvent parler."
              : "Le vocal est réservé aux joueurs assis."}
          </p>
        </div>
        {isHost ? (
          <Button
            face={spectatorVoice ? "teal" : "slate"}
            size="sm"
            icon={spectatorVoice ? "mic" : "micOff"}
            className="shrink-0"
            onClick={() => void allowSpectatorVoice(!spectatorVoice)}
          >
            {spectatorVoice ? "Autorisé" : "Coupé"}
          </Button>
        ) : (
          <span className="u-label shrink-0 text-ink-300">{spectatorVoice ? "autorisé" : "coupé"}</span>
        )}
      </div>

      {(voiceActive || voiceError) && (
        <div className="mt-2 flex items-center gap-2">
          <Icon
            name={voiceActive ? "mic" : "micOff"}
            size={14}
            className={`shrink-0 ${voiceActive ? "text-teal-500" : "text-clay-700"}`}
          />
          <span className="text-[11.5px] leading-snug text-ink-700">
            {voiceActive
              ? "Vocal actif. Chaque appareil parle directement aux autres."
              : voiceError}
          </span>
          {voiceActive && (
            <Button face="slate" size="sm" icon="micOff" className="ml-auto shrink-0" onClick={stopVoice}>
              Quitter
            </Button>
          )}
        </div>
      )}

      {!connected && (
        <div className="mt-3 flex items-center gap-2">
          <Icon name="warning" size={14} className="shrink-0 text-clay-700" />
          <span className="text-[11.5px] text-ink-700">
            {reconnecting ? "Reconnexion au salon…" : "Vous n'êtes pas connecté au salon."}
          </span>
          <Button
            face="teal"
            size="sm"
            icon="exchange"
            className="ml-auto"
            disabled={reconnecting}
            onClick={() => void restore()}
          >
            Reconnecter
          </Button>
        </div>
      )}

      <BrassRule className="my-3" />
    </div>
  );
}

/**
 * The name this device answers to, and the way to change it.
 *
 * It exists for the chair that changes hands: an arrival who takes back an
 * absent player's seat is announced to the table under that player's frozen
 * name — by design, because the board, the log and every other screen
 * already carry it. The rename is how they say who is actually sitting
 * there, and `renameSelf` carries it to all three names at once. Players
 * and spectators alike get the row; hot-seat games have no room, and no
 * room means this panel is not mounted.
 */
function RenameRow() {
  const myName = useRoom((s) => s.myName);
  const renameSelf = useRoom((s) => s.renameSelf);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    setEditing(false);
    const clean = draft.trim();
    if (clean && clean !== myName) void renameSelf(clean);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <Label>Votre nom</Label>
        <p className="mt-0.5 truncate text-[12.5px] font-bold text-ink-700">{myName ?? "—"}</p>
      </div>
      {editing ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            maxLength={NAME_MAX}
            className="field w-32 py-1 text-[12px]"
          />
          <Fitting icon="check" label="Valider" disabled={draft.trim().length === 0} onClick={commit} />
          <Fitting icon="close" label="Annuler" onClick={() => setEditing(false)} />
        </>
      ) : (
        <Button
          face="bone"
          size="sm"
          icon="pen"
          className="shrink-0"
          onClick={() => {
            setDraft(myName ?? "");
            setEditing(true);
          }}
        >
          Renommer
        </Button>
      )}
    </div>
  );
}
