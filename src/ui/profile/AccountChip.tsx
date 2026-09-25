import { useGame } from "../../game/store";
import { useAccount } from "../../net/accountStore";
import { useRoom } from "../../net/roomStore";
import { Avatar } from "../kit/Avatar";
import { Button } from "../kit/Button";
import { Icon } from "../icons/Icon";

/**
 * The account, in the corner of the title screen: a way in for a guest, the
 * face and pseudo of an account, which open the profile.
 *
 * Only here. Signing in changes the identity that holds a chair, so it is
 * offered where no chair is held — and a device that still remembers a room
 * is sent back to it rather than offered a new identity on the way.
 */
export function AccountChip({ compact }: { compact: boolean }) {
  const status = useAccount((s) => s.status);
  const profile = useAccount((s) => s.profile);
  const busy = useAccount((s) => s.busy);
  const error = useAccount((s) => s.error);
  const signIn = useAccount((s) => s.signIn);
  const refresh = useAccount((s) => s.refresh);
  const openProfile = useGame((s) => s.openProfile);
  const inRoom = useRoom((s) => s.code !== null);

  if (status === "unavailable" || inRoom) return null;

  let chip = null;
  if (status === "loading") {
    chip = error ? (
      <Button face="bone" size="sm" icon="rotate" onClick={() => void refresh()}>
        Compte injoignable, réessayer
      </Button>
    ) : null;
  } else if (status === "guest") {
    chip = (
      <Button face="bone" size={compact ? "sm" : "md"} icon="user" disabled={busy} onClick={() => void signIn()}>
        {busy ? "Un instant…" : "Se connecter avec Google"}
      </Button>
    );
  } else if (status === "needs-profile") {
    chip = (
      <Button face="gold" size={compact ? "sm" : "md"} icon="pen" onClick={openProfile}>
        Choisir mon pseudo
      </Button>
    );
  } else if (profile) {
    chip = (
      <button
        type="button"
        onClick={openProfile}
        className="btn btn-enamel face-bone flex items-center gap-2 py-1 pl-1 pr-3"
        aria-label={`Profil de ${profile.pseudo}`}
      >
        <Avatar src={profile.avatar} name={profile.pseudo} size={compact ? 24 : 30} />
        <span className={`max-w-[140px] truncate font-bold ${compact ? "text-[12px]" : "text-[13px]"}`}>
          {profile.pseudo}
        </span>
      </button>
    );
  }

  return (
    <div
      className="absolute flex flex-col items-end gap-1.5"
      style={{ top: "calc(var(--safe-t) + 12px)", right: "calc(var(--safe-r) + 12px)" }}
    >
      {chip}
      {error && status !== "loading" && (
        <p
          className="flex max-w-[280px] items-start gap-1.5 rounded-[3px] px-2.5 py-1.5 text-[11.5px] leading-snug shadow-lg"
          style={{ backgroundColor: "#8E4526", color: "#FBEDEB" }}
        >
          <Icon name="warning" size={13} className="mt-px shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
