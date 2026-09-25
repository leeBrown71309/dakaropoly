import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { useAccount } from "../../net/accountStore";
import { useCompact } from "../useViewport";
import { Card, Label, BrassRule } from "../kit/Surface";
import { Button, Fitting } from "../kit/Button";
import { Icon } from "../icons/Icon";
import { ProfileForm } from "../profile/ProfileForm";
import { GameHistory } from "../profile/GameHistory";
import { GameDetail } from "../profile/GameDetail";
import { useMyGames } from "../profile/useMyGames";

/**
 * The account: who the table calls you, and the games you have played.
 *
 * Laid out like the online screen — a column of printed cards on the felt —
 * and, like the settings panel, with leaving at the foot rather than among
 * the things one changes: signing out and deleting the account are not
 * settings.
 */
export function Profile() {
  const compact = useCompact();
  const goHome = useGame((s) => s.goHome);
  const status = useAccount((s) => s.status);
  const userId = useAccount((s) => s.userId);
  const games = useMyGames(status === "ready");
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = openId ? games.history?.games.find((g) => g.id === openId) : undefined;

  const title = opened ? "Détail de la partie" : status === "needs-profile" ? "Bienvenue" : "Mon profil";
  const back = opened ? () => setOpenId(null) : goHome;

  return (
    <div className="mat-felt h-full overflow-hidden">
      <div className="p-safe h-full">
        <div className={`scroll-paper h-full overflow-y-auto ${compact ? "px-3 py-3" : "px-6 py-8"}`}>
          <div className={`mx-auto max-w-full ${compact ? "w-[760px]" : "w-[620px]"}`}>
            <div className={`flex items-center gap-3 ${compact ? "mb-2" : "mb-4"}`}>
              <Fitting icon="arrowLeft" label={opened ? "Mes parties" : "Retour"} onClick={back} />
              <h1 className={`u-display text-sand-100 ${compact ? "text-[16px]" : "text-[22px]"}`}>{title}</h1>
            </div>

            <motion.div
              key={opened ? opened.id : status}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            >
              {opened && games.history ? (
                <GameDetail game={opened} people={games.history.people} compact={compact} />
              ) : (
                <ProfileBody
                  compact={compact}
                  userId={userId}
                  games={games}
                  onOpen={setOpenId}
                />
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileBody({
  compact,
  userId,
  games,
  onOpen,
}: {
  compact: boolean;
  userId: string | null;
  games: ReturnType<typeof useMyGames>;
  onOpen: (id: string) => void;
}) {
  const status = useAccount((s) => s.status);
  const error = useAccount((s) => s.error);
  const busy = useAccount((s) => s.busy);
  const refresh = useAccount((s) => s.refresh);
  const signIn = useAccount((s) => s.signIn);
  const pad = compact ? "p-3" : "p-4";

  if (status === "unavailable") {
    return (
      <Card className={pad}>
        <Notice>Le mode en ligne n'est pas configuré sur cette version du jeu : les comptes n'y existent pas.</Notice>
      </Card>
    );
  }

  if (status === "loading") {
    return (
      <Card className={pad}>
        <Notice>{error ?? "Lecture du compte…"}</Notice>
        {error && (
          <Button face="bone" size="sm" icon="rotate" className="mt-3" onClick={() => void refresh()}>
            Réessayer
          </Button>
        )}
      </Card>
    );
  }

  if (status === "guest") {
    return (
      <Card className={pad}>
        <Notice>
          Vous jouez en invité. Connectez-vous avec Google pour choisir un pseudo et retrouver l'historique de vos
          parties en ligne. Sans compte, tout le jeu reste ouvert.
        </Notice>
        {error && <p className="mt-2 text-[12px] font-semibold text-clay-700">{error}</p>}
        <Button face="gold" size={compact ? "sm" : "md"} icon="user" className="mt-3" disabled={busy} onClick={() => void signIn()}>
          {busy ? "Un instant…" : "Se connecter avec Google"}
        </Button>
      </Card>
    );
  }

  if (status === "needs-profile") {
    return (
      <>
        <Card className={pad}>
          <Label>Votre profil</Label>
          <p className={`mt-1 leading-snug text-ink-700 ${compact ? "text-[12px]" : "text-[13px]"}`}>
            Vous êtes connecté avec Google. Il reste à choisir le pseudo sous lequel les autres vous verront.
          </p>
          <BrassRule className="my-3" />
          <ProfileForm mode="create" compact={compact} />
        </Card>
        <AccountFoot compact={compact} deletable={false} />
      </>
    );
  }

  return (
    <>
      <Card className={pad}>
        <Label>Profil</Label>
        <BrassRule className="my-2.5" />
        <ProfileForm mode="edit" compact={compact} />
      </Card>

      <Card className={`mt-2 ${pad}`}>
        <div className="flex items-center">
          <Label>Mes parties en ligne</Label>
          {games.history && games.history.games.length > 0 && (
            <span className="u-label ml-auto text-ink-300">{games.history.games.length} dernières</span>
          )}
        </div>
        <BrassRule className="my-2.5" />
        {games.loading ? (
          <Notice>Chargement de l'historique…</Notice>
        ) : games.error ? (
          <>
            <Notice tone="bad">{games.error}</Notice>
            <Button face="bone" size="sm" icon="rotate" className="mt-2" onClick={games.reload}>
              Réessayer
            </Button>
          </>
        ) : games.history && userId ? (
          <GameHistory history={games.history} userId={userId} compact={compact} onOpen={onOpen} />
        ) : null}
      </Card>

      <AccountFoot compact={compact} deletable />
    </>
  );
}

/** Signing out, and deleting the account — confirmed first, since it is for good. */
function AccountFoot({ compact, deletable }: { compact: boolean; deletable: boolean }) {
  const busy = useAccount((s) => s.busy);
  const signOut = useAccount((s) => s.signOut);
  const remove = useAccount((s) => s.remove);
  const goHome = useGame((s) => s.goHome);
  const [confirming, setConfirming] = useState(false);

  const leave = async (act: () => Promise<void>) => {
    await act();
    // Out of the account either way, unless it was refused — then the
    // refusal is on this screen and the player stays to read it.
    if (useAccount.getState().status === "guest") goHome();
  };

  if (confirming) {
    return (
      <Card className={`mt-2 ${compact ? "p-3" : "p-4"}`}>
        <Label className="text-clay-700">Supprimer le compte</Label>
        <p className={`mt-1 leading-snug text-ink-700 ${compact ? "text-[12px]" : "text-[13px]"}`}>
          Le pseudo, la photo et votre historique sont effacés pour de bon. Les parties restent chez les autres
          joueurs, où vous n'apparaîtrez plus que sous le nom que vous aviez à la table.
        </p>
        <div className="mt-3 flex gap-2">
          <Button face="slate" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
            Annuler
          </Button>
          <Button face="clay" size="sm" icon="trash" disabled={busy} onClick={() => void leave(remove)}>
            {busy ? "Suppression…" : "Supprimer définitivement"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${compact ? "mt-3" : "mt-5"}`}>
      <Button face="slate" size={compact ? "sm" : "md"} icon="logout" disabled={busy} onClick={() => void leave(signOut)}>
        Se déconnecter
      </Button>
      {deletable && (
        <Button
          face="bone"
          size={compact ? "sm" : "md"}
          icon="trash"
          className="ml-auto"
          disabled={busy}
          onClick={() => setConfirming(true)}
        >
          Supprimer mon compte
        </Button>
      )}
    </div>
  );
}

function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "bad" }) {
  return (
    <p className={`flex items-start gap-2 text-[13px] leading-snug ${tone === "bad" ? "text-clay-700" : "text-ink-700"}`}>
      <Icon name={tone === "bad" ? "warning" : "user"} size={15} className="mt-px shrink-0 opacity-70" />
      <span>{children}</span>
    </p>
  );
}
