import { useRoom } from "../../../net/roomStore";
import { IDLE_CHOICES_MINUTES } from "../../../net/room";
import { useCompact } from "../../useViewport";
import { Switch } from "../../kit/Switch";
import { Segmented } from "../../kit/Segmented";
import { Row, Section } from "./SettingsLayout";

const IDLE_OPTIONS = IDLE_CHOICES_MINUTES.map((minutes) => ({
  value: minutes * 60,
  label: `${minutes} min`,
}));

/**
 * The settings that belong to the room rather than to a device, and so to
 * the one person who opened it.
 *
 * Everyone sees where they stand — a spectator whose microphone is shut
 * should be able to find out why without asking, and a player should know
 * how long the table will wait for them — but only the host can move them,
 * here and in the database, which refuses anybody else regardless.
 *
 * Mounted in the settings panel during play and in the lobby before it, so
 * a host can set the room up before anyone arrives.
 */
export function HostSettings() {
  const clientId = useRoom((s) => s.clientId);
  const hostId = useRoom((s) => s.hostId);
  const seats = useRoom((s) => s.seats);
  const spectatorVoice = useRoom((s) => s.spectatorVoice);
  const idleSeconds = useRoom((s) => s.idleSeconds);
  const hostBusy = useRoom((s) => s.hostBusy);
  const allowSpectatorVoice = useRoom((s) => s.allowSpectatorVoice);
  const setIdleTimeout = useRoom((s) => s.setIdleTimeout);
  const compact = useCompact();

  const isHost = clientId !== null && clientId === hostId;
  const hostName = seats.find((s) => s.clientId === hostId)?.name;
  const idleMinutes = Math.round(idleSeconds / 60);

  return (
    <Section
      title="Réglages de l'hôte"
      icon="crown"
      note={
        isHost
          ? "Vous avez créé ce salon : ces réglages s'appliquent à tout le monde."
          : `Seul l'hôte${hostName ? `, ${hostName},` : ""} peut modifier ces réglages.`
      }
    >
      <Row
        title="Micro des spectateurs"
        description={
          spectatorVoice
            ? "Les spectateurs peuvent rejoindre le vocal et parler."
            : "Le vocal est réservé aux joueurs assis : les spectateurs n'y ont pas accès."
        }
        muted={!isHost}
      >
        <Switch
          checked={spectatorVoice}
          disabled={!isHost || hostBusy}
          onChange={(allowed) => void allowSpectatorVoice(allowed)}
          label="Micro des spectateurs"
        />
      </Row>

      <div className={compact ? "px-2.5 py-1.5" : "px-3 py-2.5"}>
        <div className={!isHost ? "opacity-60" : ""}>
          <div className={`font-semibold leading-tight text-ink-900 ${compact ? "text-[12px]" : "text-[13px]"}`}>
            Fermeture du salon vide
          </div>
          <div className={`mt-0.5 leading-snug text-ink-500 ${compact ? "text-[10.5px]" : "text-[11.5px]"}`}>
            Quand plus aucun joueur n'est assis pendant {idleMinutes} minutes, le salon est supprimé et son code
            ne mène plus nulle part.
          </div>
        </div>
        <div className="mt-1.5">
          <Segmented
            options={IDLE_OPTIONS}
            value={idleSeconds}
            onChange={(seconds) => void setIdleTimeout(seconds)}
            label="Délai de fermeture du salon vide"
            disabled={!isHost || hostBusy}
            compact={compact}
          />
        </div>
      </div>
    </Section>
  );
}
