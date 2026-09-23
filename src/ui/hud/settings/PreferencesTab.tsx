import { useGame, DEFAULT_SETTINGS, type Settings } from "../../../game/store";
import { sfx } from "../../../audio/sounds";
import { useFullscreen } from "../../fullscreen";
import { Switch } from "../../kit/Switch";
import { Row, Section, SliderRow } from "./SettingsLayout";

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;

/** The three settings that decide how fast the evening moves. */
const PACING_KEYS = ["stepDuration", "announceDuration", "toastDuration"] as const;

/**
 * What this device feels like to play on: pace, sound, screen.
 *
 * Grouped by what they change rather than by kind of control. Every one of
 * them is this device's own — online, the others keep theirs — which is why
 * the tab says so in its heading rather than leaving players to wonder
 * whether slowing their tokens slows everyone's.
 */
export function PreferencesTab() {
  const settings = useGame((s) => s.settings);
  const updateSettings = useGame((s) => s.updateSettings);
  const soundOn = useGame((s) => s.soundOn);
  const toggleSound = useGame((s) => s.toggleSound);

  const set = (patch: Partial<Settings>) => updateSettings(patch);
  const pacingIsDefault = PACING_KEYS.every((key) => settings[key] === DEFAULT_SETTINGS[key]);
  const resetPacing = () =>
    set(Object.fromEntries(PACING_KEYS.map((key) => [key, DEFAULT_SETTINGS[key]])) as Partial<Settings>);

  return (
    <div>
      <Section
        title="Rythme de la partie"
        icon="dice"
        action={
          <button
            type="button"
            disabled={pacingIsDefault}
            onClick={resetPacing}
            className="u-label rounded-[3px] px-1.5 py-1 text-gold-700 transition-colors enabled:hover:bg-gold-500/15 disabled:text-ink-300"
          >
            Par défaut
          </button>
        }
      >
        <SliderRow
          title="Vitesse des pions"
          description="Le temps qu'un pion met à franchir une case."
          value={settings.stepDuration}
          min={60}
          max={420}
          step={10}
          inverted
          ends={["Lent", "Rapide"]}
          format={(ms) => `${ms} ms / case`}
          onChange={(stepDuration) => set({ stepDuration })}
        />
        <SliderRow
          title="Durée des annonces"
          description="La carte qui interrompt le jeu : impôt, loyer, prison, faillite."
          value={settings.announceDuration}
          min={1000}
          max={9000}
          step={250}
          ends={["Courte", "Longue"]}
          format={seconds}
          onChange={(announceDuration) => set({ announceDuration })}
        />
        <SliderRow
          title="Durée des messages"
          description="Les petits billets épinglés en bas à gauche du plateau."
          value={settings.toastDuration}
          min={1500}
          max={12000}
          step={250}
          ends={["Courte", "Longue"]}
          format={seconds}
          onChange={(toastDuration) => set({ toastDuration })}
        />
      </Section>

      <Section title="Son" icon={soundOn ? "soundOn" : "soundOff"}>
        <Row
          title="Effets sonores"
          description={soundOn ? "Dés, pas, caisse, marteau et coups de maillet." : "Tous les sons de la partie sont coupés."}
        >
          <Switch checked={soundOn} onChange={toggleSound} label="Effets sonores" />
        </Row>
        <SliderRow
          title="Volume"
          value={settings.volume}
          min={0}
          max={1}
          step={0.05}
          ends={["0 %", "100 %"]}
          format={(v) => `${Math.round(v * 100)} %`}
          disabled={!soundOn}
          onChange={(volume) => set({ volume })}
          // A level is judged by ear: letting go of the thumb plays a sample.
          onCommit={() => sfx.play("coin")}
        />
      </Section>

      <ScreenSection />
    </div>
  );
}

/**
 * On a phone this is the setting that buys back the most board: fullscreen
 * reclaims the browser chrome, and on Android it is also the only state in
 * which the orientation can be pinned to landscape. A browser that cannot do
 * it at all gets no section, rather than a switch that does nothing.
 */
function ScreenSection() {
  const { active, supported, toggle } = useFullscreen();
  if (!supported) return null;

  return (
    <Section title="Écran" icon={active ? "shrink" : "expand"}>
      <Row
        title="Plein écran"
        description={
          active ? "Le plateau occupe tout l'écran." : "Masque les barres du navigateur et verrouille le paysage."
        }
      >
        <Switch checked={active} onChange={toggle} label="Plein écran" />
      </Row>
    </Section>
  );
}
