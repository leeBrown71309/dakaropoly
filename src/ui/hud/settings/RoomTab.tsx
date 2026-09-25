import { useAccount } from "../../../net/accountStore";
import { useState } from "react";
import { useRoom } from "../../../net/roomStore";
import { useVoice } from "../../../net/voice";
import { formatCode, inviteLink } from "../../../net/room";
import { NAME_MAX } from "../../../game/types";
import { keepingFullscreen } from "../../fullscreen";
import { useCompact } from "../../useViewport";
import { useCopy } from "../../useCopy";
import { useIsSpectator } from "../../useTurn";
import { Button, Fitting } from "../../kit/Button";
import { Tooltip } from "../../kit/Tooltip";
import { Icon } from "../../icons/Icon";
import { Row, Section } from "./SettingsLayout";
import { HostSettings } from "./HostSettings";

/**
 * The room, from inside the game — one section per question this tab
 * answers: how do others get in, who am I here, am I in the call, and what
 * has the host decided. Who sits where is the left roster's business, and
 * is not repeated here.
 *
 * The code stops being visible the moment play begins, which is exactly when
 * it is needed most: somebody's phone dies, or a friend turns up late, and
 * the one thing that lets them in is a string nobody wrote down. It lives in
 * the settings panel because that is the only surface reachable at any point
 * in a turn without giving anything up — and it opens on this tab online.
 */
export function RoomTab() {
  const code = useRoom((s) => s.code);
  if (!code) return null;

  return (
    <div>
      <InviteCard code={code} />
      <IdentitySection />
      <VoiceSection />
      <HostSettings />
    </div>
  );
}

/** The code, the link, and whether this device is actually connected. */
function InviteCard({ code }: { code: string }) {
  const present = useRoom((s) => s.present);
  const clientId = useRoom((s) => s.clientId);
  const reconnecting = useRoom((s) => s.reconnecting);
  const restore = useRoom((s) => s.restore);
  const compact = useCompact();
  const { copied, copy } = useCopy();
  const connected = clientId !== null && present.includes(clientId);

  return (
    <section
      className={`relative overflow-hidden rounded-[4px] ${compact ? "mb-3 px-3 py-2" : "mb-5 px-4 py-3"}`}
      style={{
        background: "linear-gradient(176deg,#fffaf0 0%,#f3e7cd 100%)",
        boxShadow: "inset 0 0 0 1px rgba(168,112,31,.35), inset 0 0 0 4px rgba(255,250,240,.9), inset 0 0 0 5px rgba(168,112,31,.18)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="u-label text-ink-500">Code du salon</span>
        <span
          className={`u-label ml-auto flex items-center gap-1.5 ${connected ? "text-teal-500" : "text-clay-700"}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${reconnecting ? "animate-pulse" : ""}`}
            style={{ backgroundColor: connected ? "#1E6F6B" : "#8E4526" }}
          />
          {connected ? "Connecté" : reconnecting ? "Reconnexion…" : "Hors ligne"}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          className={`u-display tracking-[0.16em] text-ink-900 ${compact ? "text-[24px]" : "text-[34px]"} leading-none`}
        >
          {formatCode(code)}
        </div>
        <div className="ml-auto flex gap-1.5">
          <Button face="bone" size="sm" icon={copied === "code" ? "check" : "key"} onClick={() => copy("code", code)}>
            {copied === "code" ? "Copié" : "Copier le code"}
          </Button>
          <Button
            face="bone"
            size="sm"
            icon={copied === "link" ? "check" : "exchange"}
            onClick={() => copy("link", inviteLink(code))}
          >
            {copied === "link" ? "Copié" : "Copier le lien"}
          </Button>
        </div>
      </div>

      <p className={`mt-1.5 leading-snug text-ink-500 ${compact ? "text-[10.5px]" : "text-[11.5px]"}`}>
        Un ami arrive en retard, un téléphone s'éteint ? Ce code suffit pour entrer ou reprendre sa place.
      </p>

      {!connected && (
        <div className="mt-2 flex items-center gap-2 border-t border-dotted border-ink-300/50 pt-2">
          <Icon name="warning" size={14} className="shrink-0 text-clay-700" />
          <span className={`text-ink-700 ${compact ? "text-[10.5px]" : "text-[11.5px]"}`}>
            {reconnecting
              ? "Reconnexion au salon…"
              : "Cet appareil n'est plus relié au salon : rien de ce qui s'y joue ne lui parvient."}
          </span>
          <Button
            face="teal"
            size="sm"
            icon="exchange"
            className="ml-auto shrink-0"
            disabled={reconnecting}
            onClick={() => void restore()}
          >
            Reconnecter
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * The name this device answers to, what it is at the table, and the way to
 * change the name.
 *
 * The rename exists for the chair that changes hands: an arrival who takes
 * back an absent player's seat is announced under that player's frozen name
 * — by design, because the board, the log and every other screen already
 * carry it. Renaming is how they say who is actually sitting there, and
 * `renameSelf` carries it to all three names at once.
 */
function IdentitySection() {
  const myName = useRoom((s) => s.myName);
  const renameSelf = useRoom((s) => s.renameSelf);
  const clientId = useRoom((s) => s.clientId);
  const hostId = useRoom((s) => s.hostId);
  const spectating = useIsSpectator();
  // An account's name is its pseudo; it is changed from the profile.
  const isAccount = useAccount((s) => s.status === "ready");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    setEditing(false);
    const clean = draft.trim();
    if (clean && clean !== myName) void renameSelf(clean);
  };

  const role = spectating ? "Spectateur" : "Joueur";
  const isHost = clientId !== null && clientId === hostId;

  return (
    <Section title="Vous" icon="pen">
      <Row
        title={
          editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
              maxLength={NAME_MAX}
              aria-label="Nouveau nom"
              className="field max-w-[220px] py-1 text-[12.5px]"
            />
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="truncate">{myName ?? "—"}</span>
              <span className="u-label rounded-[2px] px-1 py-0.5 text-ink-500" style={{ background: "rgba(110,86,52,.1)" }}>
                {role}
              </span>
              {isHost && (
                <span className="u-label flex items-center gap-0.5 text-gold-700">
                  <Icon name="crown" size={11} />
                  Hôte
                </span>
              )}
            </span>
          )
        }
        description={
          isAccount
            ? "Votre pseudo : c'est lui que voient les autres. Il se change depuis votre profil, à l'accueil."
            : "Le nom que voient les autres sur le plateau, dans le journal et dans la discussion."
        }
      >
        {isAccount ? null : editing ? (
          <>
            <Fitting icon="check" label="Valider" disabled={draft.trim().length === 0} onClick={commit} />
            <Fitting icon="close" label="Annuler" onClick={() => setEditing(false)} />
          </>
        ) : (
          <Button
            face="bone"
            size="sm"
            icon="pen"
            onClick={() => {
              setDraft(myName ?? "");
              setEditing(true);
            }}
          >
            Renommer
          </Button>
        )}
      </Row>
    </Section>
  );
}

/**
 * This device's place in the call. The microphone button on the rail does
 * the same thing; this row is where the reason lives when it will not — an
 * insecure address, a refused permission, or a host who has kept the call
 * for the players.
 */
function VoiceSection() {
  const active = useVoice((s) => s.active);
  const muted = useVoice((s) => s.muted);
  const busy = useVoice((s) => s.busy);
  const error = useVoice((s) => s.error);
  const start = useVoice((s) => s.start);
  const stop = useVoice((s) => s.stop);
  const toggleMute = useVoice((s) => s.toggleMute);
  const spectatorVoice = useRoom((s) => s.spectatorVoice);
  const spectating = useIsSpectator();
  const allowed = !spectating || spectatorVoice;

  const description = !allowed
    ? "L'hôte a réservé le vocal aux joueurs assis."
    : active
      ? muted
        ? "Vous êtes dans l'appel, micro coupé : vous entendez sans être entendu."
        : "Vous êtes dans l'appel. Chaque appareil parle directement aux autres."
      : (error ?? "Rejoignez l'appel pour parler et entendre les autres.");

  return (
    <Section title="Vocal" icon={active && !muted ? "mic" : "micOff"}>
      <Row title="Votre micro" description={description}>
        {active ? (
          <>
            <Button face="bone" size="sm" icon={muted ? "mic" : "micOff"} onClick={toggleMute}>
              {muted ? "Réactiver" : "Couper"}
            </Button>
            <Button face="slate" size="sm" onClick={stop}>
              Quitter
            </Button>
          </>
        ) : (
          <Tooltip
            title={allowed ? "Rejoindre l'appel" : "Micro réservé aux joueurs"}
            detail={
              allowed
                ? "Le navigateur demande l'accès au micro, puis vous entrez dans l'appel avec les autres."
                : "L'hôte peut ouvrir le vocal aux spectateurs dans ses réglages, plus bas."
            }
          >
            <Button
              face="teal"
              size="sm"
              icon="mic"
              disabled={!allowed || busy}
              onClick={() => void keepingFullscreen(() => start())}
            >
              Rejoindre
            </Button>
          </Tooltip>
        )}
      </Row>
    </Section>
  );
}
