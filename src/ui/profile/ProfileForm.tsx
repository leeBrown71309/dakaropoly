import { useEffect, useRef, useState } from "react";
import { useAccount } from "../../net/accountStore";
import { isPseudoAvailable } from "../../net/account";
import { cleanPseudo, pseudoProblem, suggestPseudo, PSEUDO_MAX, PSEUDO_MIN } from "../../net/pseudo";
import { fileToAvatar, urlToAvatar } from "../avatarImage";
import { Avatar } from "../kit/Avatar";
import { Button } from "../kit/Button";
import { Label } from "../kit/Surface";

/** What the form knows about the pseudo in the field. */
type Availability = "idle" | "checking" | "free" | "taken" | "unknown";

/** Long enough to let a word be typed, short enough to feel live. */
const CHECK_DELAY_MS = 400;

interface ProfileFormProps {
  /** Creating the profile after the first sign-in, or changing it later. */
  mode: "create" | "edit";
  compact: boolean;
}

/**
 * The pseudo and the photo: the whole of a profile.
 *
 * Whether the pseudo is free is asked while the player types, so « Ce pseudo
 * existe déjà » arrives before they press anything. It is only advice —
 * somebody can take the same pseudo in the second between the check and the
 * save, and then the database's own refusal is shown in the same place.
 *
 * The photo is optional. On creation the Google account's photo is offered;
 * it can be kept, replaced by one from the device, or removed. It is the
 * game's copy that changes, never the Google account.
 */
export function ProfileForm({ mode, compact }: ProfileFormProps) {
  const profile = useAccount((s) => s.profile);
  const googleName = useAccount((s) => s.googleName);
  const googlePhoto = useAccount((s) => s.googlePhoto);
  const busy = useAccount((s) => s.busy);
  const error = useAccount((s) => s.error);
  const save = useAccount((s) => s.save);
  const clearError = useAccount((s) => s.clearError);

  const [pseudo, setPseudo] = useState(() => profile?.pseudo ?? suggestPseudo(googleName));
  const [photo, setPhoto] = useState<string | null>(() => profile?.avatar ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [saved, setSaved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const clean = cleanPseudo(pseudo);
  const problem = pseudoProblem(pseudo);
  const current = profile?.pseudo ?? null;
  const unchanged = mode === "edit" && clean === current && photo === (profile?.avatar ?? null);

  useEffect(() => {
    if (problem || clean === current) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    let live = true;
    const timer = setTimeout(() => {
      isPseudoAvailable(clean)
        .then((free) => live && setAvailability(free ? "free" : "taken"))
        .catch(() => live && setAvailability("unknown"));
    }, CHECK_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [clean, problem, current]);

  const takePhoto = async (making: Promise<string>) => {
    setPhotoBusy(true);
    setPhotoNote(null);
    try {
      setPhoto(await making);
    } catch (e) {
      setPhotoNote(e instanceof Error ? e.message : "Image illisible");
    } finally {
      setPhotoBusy(false);
    }
  };

  // Offered once, when the profile is first made. A refusal from Google's
  // image host is said rather than swallowed: otherwise the player would
  // wonder why the photo they can see on Google is not here.
  useEffect(() => {
    if (mode !== "create" || !googlePhoto) return;
    let live = true;
    urlToAvatar(googlePhoto)
      .then((url) => live && setPhoto((mine) => mine ?? url))
      .catch((e: unknown) => live && setPhotoNote(e instanceof Error ? e.message : null));
    return () => {
      live = false;
    };
  }, [mode, googlePhoto]);

  const canSave =
    !problem && availability !== "taken" && availability !== "checking" && !unchanged && !busy && !photoBusy;

  const submit = async () => {
    if (!canSave) return;
    setSaved(false);
    const ok = await save({ pseudo: clean, avatar: photo });
    if (ok) setSaved(true);
    // Somebody took the pseudo in the moment between the check and the save.
    else if (useAccount.getState().error === "Ce pseudo existe déjà") setAvailability("taken");
  };

  const hint = pseudoHint(pseudo, problem, availability, clean === current && mode === "edit");
  const side = compact ? 64 : 88;

  return (
    <div className={`flex ${compact ? "gap-3" : "gap-5"}`}>
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <Avatar src={photo} name={clean || googleName || "?"} size={side} ring="rgba(168,112,31,.55)" />
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void takePhoto(fileToAvatar(file));
          }}
        />
        <Button face="bone" size="sm" icon="image" disabled={photoBusy} onClick={() => fileInput.current?.click()}>
          {photo ? "Changer" : "Ajouter"}
        </Button>
        {googlePhoto && mode === "edit" && (
          <Button face="bone" size="sm" disabled={photoBusy} onClick={() => void takePhoto(urlToAvatar(googlePhoto))}>
            Photo Google
          </Button>
        )}
        {photo && (
          <Button face="slate" size="sm" icon="close" disabled={photoBusy} onClick={() => setPhoto(null)}>
            Retirer
          </Button>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <label htmlFor="profile-pseudo">
          <Label>Pseudo</Label>
        </label>
        <input
          id="profile-pseudo"
          value={pseudo}
          onChange={(e) => {
            setPseudo(e.target.value);
            setSaved(false);
            if (error) clearError();
          }}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          maxLength={PSEUDO_MAX}
          autoComplete="nickname"
          spellCheck={false}
          placeholder="Comment la table vous appelle"
          className="field mt-1 text-[14px]"
        />
        <p className={`mt-1 min-h-[1.2em] text-[11.5px] ${hint.tone}`}>{hint.text}</p>
        {photoNote && <p className="mt-1 text-[11.5px] text-clay-700">{photoNote}</p>}
        <p className={`mt-1 leading-snug text-ink-500 ${compact ? "text-[11px]" : "text-[12px]"}`}>
          Le pseudo est unique et respecte les majuscules : c'est votre nom à chaque table en ligne. La photo est
          facultative.
        </p>

        {error && <p className="mt-2 text-[12px] font-semibold text-clay-700">{error}</p>}

        <div className="mt-3 flex items-center gap-2">
          <Button face="gold" size={compact ? "sm" : "md"} icon="check" disabled={!canSave} onClick={() => void submit()}>
            {busy ? "Un instant…" : mode === "create" ? "Créer mon profil" : "Enregistrer"}
          </Button>
          {saved && mode === "edit" && <span className="u-label text-teal-700">Enregistré</span>}
        </div>
      </div>
    </div>
  );
}

/** The line under the pseudo field, and the colour it is printed in. */
function pseudoHint(
  pseudo: string,
  problem: string | null,
  availability: Availability,
  isCurrent: boolean,
): { text: string; tone: string } {
  if (!pseudo.trim()) return { text: `De ${PSEUDO_MIN} à ${PSEUDO_MAX} caractères`, tone: "text-ink-500" };
  if (problem) return { text: problem, tone: "text-clay-700" };
  if (isCurrent) return { text: "Votre pseudo actuel", tone: "text-ink-500" };
  switch (availability) {
    case "checking":
      return { text: "Vérification…", tone: "text-ink-500" };
    case "taken":
      return { text: "Ce pseudo existe déjà", tone: "text-clay-700 font-semibold" };
    case "free":
      return { text: "Disponible", tone: "text-teal-700 font-semibold" };
    case "unknown":
      return { text: "Disponibilité inconnue pour l'instant : l'enregistrement tranchera", tone: "text-ink-500" };
    default:
      return { text: "", tone: "" };
  }
}
