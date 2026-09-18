import { useRoom } from "../../net/roomStore";
import { useVoice } from "../../net/voice";
import { formatCode, inviteLink } from "../../net/room";
import { PLAYER_COLORS } from "../../game/data/pawns";
import { useCompact } from "../useViewport";
import { useCopy } from "../useCopy";
import { Label, BrassRule } from "../kit/Surface";
import { Button } from "../kit/Button";
import { PawnGlyph } from "../icons/PawnGlyph";
import { Icon } from "../icons/Icon";

/**
 * The room, from inside the game.
 *
 * The code stops being visible the moment play begins, which is exactly when
 * it is needed most: somebody's phone dies, or a friend turns up late, and
 * the one thing that lets them in is a string nobody wrote down. It lives in
 * the settings panel because that is the only surface reachable at any point
 * in a turn without giving anything up.
 */
export function RoomPanel() {
  const code = useRoom((s) => s.code);
  const seats = useRoom((s) => s.seats);
  const present = useRoom((s) => s.present);
  const watchers = useRoom((s) => s.watchers);
  const clientId = useRoom((s) => s.clientId);
  const reconnecting = useRoom((s) => s.reconnecting);
  const restore = useRoom((s) => s.restore);
  const voiceActive = useVoice((s) => s.active);
  const voiceError = useVoice((s) => s.error);
  const stopVoice = useVoice((s) => s.stop);
  const compact = useCompact();
  const { copied, copy } = useCopy();

  if (!code) return null;

  const connected = clientId !== null && present.includes(clientId);
  const players = seats.filter((s) => s.seat !== null).sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));

  return (
    <div>
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

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {players.map((s) => {
          const here = present.includes(s.clientId);
          return (
            <span key={s.clientId} className="flex items-center gap-1.5">
              <span style={{ color: PLAYER_COLORS[s.pawn ?? 0] }} className="shrink-0">
                <PawnGlyph pawn={s.pawn ?? 0} size={16} />
              </span>
              <span className="text-[11.5px] font-bold text-ink-700">{s.name}</span>
              <span
                className="h-1.5 w-1.5 rounded-full"
                title={here ? "connecté" : "absent"}
                style={{ backgroundColor: here ? "#1E6F6B" : "#9A8F7C" }}
              />
            </span>
          );
        })}
      </div>

      {watchers.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Icon name="eye" size={13} className="shrink-0 text-ink-300" />
          {watchers.map((w) => (
            <span key={w.clientId} className="text-[11.5px] text-ink-500">
              {w.name}
            </span>
          ))}
        </div>
      )}

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
        <div className="mt-2 flex items-center gap-2">
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
