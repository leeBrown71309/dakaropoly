import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame, type Settings } from "../../game/store";
import { useCompact } from "../useViewport";
import { useFullscreen } from "../fullscreen";
import { BOARD, GROUP_MEMBERS, GROUP_ORDER } from "../../game/data/board";
import { GROUP_COLORS, GROUP_NAMES, GROUP_ON_COLOR } from "../../game/colors";
import { Card, Label, BrassRule } from "../kit/Surface";
import { Button, Fitting } from "../kit/Button";
import { Money } from "../kit/Money";
import { Icon, type IconName } from "../icons/Icon";
import { RoomPanel } from "./RoomPanel";

type Tab = "reglages" | "groupes" | "regles";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "reglages", label: "Réglages", icon: "cog" },
  { id: "groupes", label: "Groupes", icon: "ranking" },
  { id: "regles", label: "Règles", icon: "book" },
];

export function SettingsModal() {
  const open = useGame((s) => s.settingsOpen);
  const toggleSettings = useGame((s) => s.toggleSettings);
  const compact = useCompact();
  const [tab, setTab] = useState<Tab>("reglages");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`absolute inset-0 z-50 flex items-center justify-center ${compact ? "px-2 py-1" : "px-4"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            background: "radial-gradient(80% 60% at 50% 45%, rgba(38,24,8,.5) 0%, rgba(20,12,4,.78) 100%)",
          }}
          onClick={toggleSettings}
        >
          <motion.div
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="w-[620px] max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Card
              className={`flex flex-col overflow-hidden ${compact ? "max-h-[97vh]" : "max-h-[84vh]"}`}
            >
              <header
                className={`flex items-center gap-2 ${compact ? "px-3 pb-1 pt-1.5" : "px-4 pb-2 pt-3"}`}
              >
                <Icon name="cog" size={compact ? 15 : 18} className="text-ink-700" />
                <span className={`u-display text-ink-900 ${compact ? "text-[13px]" : "text-[16px]"}`}>
                  Paramètres
                </span>
                <Fitting icon="close" label="Fermer" className="ml-auto !h-7 !w-7" onClick={toggleSettings} />
              </header>

              <div className={`flex gap-1 ${compact ? "px-3" : "px-4"}`}>
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 rounded-t-[3px] transition ${
                      compact ? "px-2.5 py-1" : "px-3 py-1.5"
                    }`}
                    style={
                      tab === t.id
                        ? {
                            background: "rgba(232,162,59,.2)",
                            boxShadow: "inset 0 0 0 1px rgba(168,112,31,.65)",
                            color: "#3A342B",
                          }
                        : { color: "#6B6152" }
                    }
                  >
                    <Icon name={t.icon} size={14} />
                    <span className="u-label">{t.label}</span>
                  </button>
                ))}
              </div>
              <BrassRule />

              <div
                className={`scroll-paper min-h-0 flex-1 overflow-y-auto ${
                  compact ? "px-3 py-2" : "px-4 py-3"
                }`}
              >
                {tab === "reglages" && <SettingsTab />}
                {tab === "groupes" && <GroupsTab />}
                {tab === "regles" && <RulesTab />}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */

interface SliderProps {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

function Slider({ label, hint, value, min, max, step, format, onChange }: SliderProps) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="u-money text-[12.5px] font-bold text-ink-900">{format(value)}</span>
      </div>
      <input
        type="range"
        className="range mt-1"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className="text-[11.5px] leading-snug text-ink-500">{hint}</p>
    </div>
  );
}

function SettingsTab() {
  const settings = useGame((s) => s.settings);
  const updateSettings = useGame((s) => s.updateSettings);
  const soundOn = useGame((s) => s.soundOn);
  const toggleSound = useGame((s) => s.toggleSound);
  const askQuit = useGame((s) => s.askQuit);

  const set = (patch: Partial<Settings>) => updateSettings(patch);
  const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

  return (
    <div>
      {/* Only mounted when this device is in a room; silent otherwise. */}
      <RoomPanel />

      <Slider
        label="Durée des messages"
        hint="Combien de temps les petits billets restent épinglés en bas à gauche."
        value={settings.toastDuration}
        min={1500}
        max={12000}
        step={250}
        format={seconds}
        onChange={(toastDuration) => set({ toastDuration })}
      />
      <Slider
        label="Durée des annonces"
        hint="La carte qui s'affiche pour un impôt, un loyer, la prison ou une faillite."
        value={settings.announceDuration}
        min={1000}
        max={9000}
        step={250}
        format={seconds}
        onChange={(announceDuration) => set({ announceDuration })}
      />
      <Slider
        label="Vitesse des pions"
        hint="Temps que met un pion pour franchir une case. Plus bas, plus rapide."
        value={settings.stepDuration}
        min={60}
        max={420}
        step={10}
        format={(ms) => `${ms} ms`}
        onChange={(stepDuration) => set({ stepDuration })}
      />

      <BrassRule className="my-3" />

      <Slider
        label="Volume"
        hint="Niveau général des effets sonores."
        value={settings.volume}
        min={0}
        max={1}
        step={0.05}
        format={(v) => `${Math.round(v * 100)} %`}
        onChange={(volume) => set({ volume })}
      />

      <FullscreenRow />

      <div className="flex items-center justify-between py-2">
        <div>
          <Label>Effets sonores</Label>
          <p className="mt-0.5 text-[11.5px] text-ink-500">
            {soundOn ? "Les sons sont actifs." : "Tous les sons sont coupés."}
          </p>
        </div>
        <Button
          face={soundOn ? "teal" : "slate"}
          size="sm"
          icon={soundOn ? "soundOn" : "soundOff"}
          onClick={toggleSound}
        >
          {soundOn ? "Activés" : "Coupés"}
        </Button>
      </div>

      <BrassRule className="my-3" />

      <div className="flex items-center justify-between py-1">
        <div>
          <Label>Quitter la partie</Label>
          <p className="mt-0.5 text-[11.5px] text-ink-500">
            La partie en cours est effacée définitivement.
          </p>
        </div>
        <Button face="clay" size="sm" icon="arrowLeft" onClick={askQuit}>
          Quitter
        </Button>
      </div>
    </div>
  );
}

/**
 * On a phone this is the setting that buys back the most board: fullscreen
 * reclaims the browser chrome, and on Android it is also the only state in
 * which the orientation can be pinned to landscape.
 */
function FullscreenRow() {
  const { active, supported, toggle } = useFullscreen();
  if (!supported) return null;

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <Label>Plein écran</Label>
        <p className="mt-0.5 text-[11.5px] text-ink-500">
          {active
            ? "Le plateau occupe tout l'écran."
            : "Masque les barres du navigateur et verrouille le paysage."}
        </p>
      </div>
      <Button
        face={active ? "teal" : "slate"}
        size="sm"
        icon={active ? "shrink" : "expand"}
        onClick={toggle}
      >
        {active ? "Quitter" : "Activer"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function GroupsTab() {
  return (
    <div>
      <p className="mb-3 text-[12.5px] leading-snug text-ink-700">
        Les huit groupes, du moins cher au plus cher. Posséder un groupe entier double le loyer
        du terrain nu et permet d'y construire.
      </p>

      <div className="flex flex-col gap-1.5">
        {GROUP_ORDER.map((group, rank) => {
          const tiles = GROUP_MEMBERS[group].map((pos) => BOARD[pos]).filter((t) => t !== undefined);
          const hotelRent = Math.max(...tiles.map((t) => t?.rents?.[5] ?? 0));

          return (
            <div
              key={group}
              className="rounded-[3px] px-2.5 py-2"
              style={{ boxShadow: "inset 0 0 0 1px rgba(110,86,52,.2)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="u-label flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px]"
                  style={{ backgroundColor: GROUP_COLORS[group], color: GROUP_ON_COLOR[group] }}
                >
                  {rank + 1}
                </span>
                <span className="text-[13px] font-bold text-ink-900">{GROUP_NAMES[group]}</span>
                <span className="u-label ml-auto text-ink-500">
                  Maison <Money amount={tiles[0]?.houseCost ?? 0} />
                </span>
                <span className="u-label text-ink-500">
                  Hôtel jusqu'à <Money amount={hotelRent} />
                </span>
              </div>

              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-7">
                {tiles.map((tile) => (
                  <span key={tile?.pos} className="text-[11.5px] text-ink-700">
                    {tile?.name} <Money amount={tile?.price ?? 0} className="text-ink-500" />
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <BrassRule className="my-3" />

      <div className="flex flex-col gap-1 text-[12px] text-ink-700">
        <p>
          <b>Gares</b> — 200 F chacune. Le loyer dépend du nombre possédé : 25, 50, 100 puis 200 F.
        </p>
        <p>
          <b>Services</b> (SENELEC, SDE) — 150 F. Le loyer vaut 4 × le jet de dés, ou 10 × si vous
          possédez les deux.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-3">
      <h3 className="u-display mb-1 text-[14px] text-ink-900">{title}</h3>
      <div className="flex flex-col gap-1 text-[12.5px] leading-snug text-ink-700">{children}</div>
    </section>
  );
}

function RulesTab() {
  return (
    <div>
      <Rule title="Le tour">
        <p>Lancez les dés, avancez, puis résolvez la case où vous vous arrêtez.</p>
        <p>
          Un double vous fait rejouer. <b>Trois doubles d'affilée</b> vous envoient directement en
          prison.
        </p>
        <p>
          Passer par le Départ rapporte 200 F. Tomber <b>pile</b> dessus rapporte le double.
        </p>
      </Rule>

      <Rule title="Acheter un bien">
        <p>Sur une case libre, vous pouvez l'acheter au prix affiché.</p>
        <p>
          Si vous refusez, elle part <b>obligatoirement aux enchères</b>, ouvertes à tous les
          joueurs — vous compris. Les mises partent de zéro et le plus offrant l'emporte.
        </p>
      </Rule>

      <Rule title="Les loyers">
        <p>Terrain nu : loyer de base, <b>doublé</b> si le propriétaire détient tout le groupe.</p>
        <p>Avec des bâtiments : le loyer du barème inscrit sur le titre de propriété.</p>
        <p>Un bien hypothéqué ne rapporte aucun loyer.</p>
        <p>Vous encaissez vos loyers même depuis la prison.</p>
      </Rule>

      <Rule title="Construire">
        <p>
          Ouvrez <b>Patrimoine</b> dans la barre du bas, pendant votre tour. Le bouton marteau
          construit, le bouton moins revend.
        </p>
        <p>
          Il faut posséder <b>tout le groupe</b>, sans aucune hypothèque dessus.
        </p>
        <p>
          La construction est <b>uniforme</b> : jamais plus d'une maison d'écart entre deux
          propriétés du même groupe. Il faut donc bâtir sur la moins construite.
        </p>
        <p>La 5ᵉ maison devient un hôtel.</p>
        <p>
          La banque ne dispose que de <b>32 maisons et 12 hôtels</b>. Stock épuisé, plus personne ne
          construit.
        </p>
      </Rule>

      <Rule title="Hypothéquer">
        <p>Une hypothèque rapporte la moitié du prix d'achat du bien.</p>
        <p>Il faut d'abord revendre tous les bâtiments du groupe.</p>
        <p>La lever coûte la moitié du prix, majorée de 10 %.</p>
      </Rule>

      <Rule title="La prison">
        <p>On y va par la case « Allez en prison », par une carte, ou après trois doubles.</p>
        <p>
          Pour sortir : faire un double (trois tentatives), payer 50 F, ou utiliser une carte de
          sortie.
        </p>
        <p>Après trois échecs, l'amende de 50 F est prélevée et vous sortez.</p>
      </Rule>

      <Rule title="Échanger">
        <p>
          Argent et propriétés, dans les deux sens, avec n'importe quel joueur. Un bien qui porte
          des bâtiments ne peut pas être échangé : vendez-les d'abord.
        </p>
      </Rule>

      <Rule title="La faillite">
        <p>
          Si vous devez plus que vos liquidités, vendez vos bâtiments ou hypothéquez pour réunir la
          somme.
        </p>
        <p>
          Sinon c'est la faillite : envers un joueur, il récupère tout ; envers la banque, vos biens
          repartent aux enchères.
        </p>
        <p>Le dernier joueur encore debout remporte la partie.</p>
      </Rule>
    </div>
  );
}
