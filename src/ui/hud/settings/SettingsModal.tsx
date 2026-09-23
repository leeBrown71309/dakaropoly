import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../../game/store";
import { useCompact } from "../../useViewport";
import { useIsOnline } from "../../useTurn";
import { Button, Fitting } from "../../kit/Button";
import { BrassRule } from "../../kit/Surface";
import { Icon, type IconName } from "../../icons/Icon";
import { RoomTab } from "./RoomTab";
import { PreferencesTab } from "./PreferencesTab";
import { GroupsTab } from "./GroupsTab";
import { RulesTab } from "./RulesTab";

type Tab = "salon" | "reglages" | "groupes" | "regles";

interface TabDef {
  id: Tab;
  label: string;
  /** Under the label in the sidebar: what is behind it, in three words. */
  hint: string;
  icon: IconName;
  title: string;
  subtitle: (online: boolean) => string;
  onlineOnly?: boolean;
}

const TABS: TabDef[] = [
  {
    id: "salon",
    label: "Salon",
    hint: "Code, vocal, hôte",
    icon: "key",
    title: "Le salon",
    subtitle: () => "Inviter, se renommer, rejoindre le vocal — et les réglages de l'hôte, communs à tous.",
    onlineOnly: true,
  },
  {
    id: "reglages",
    label: "Réglages",
    hint: "Rythme, son, écran",
    icon: "cog",
    title: "Réglages",
    subtitle: (online) =>
      online
        ? "Propres à cet appareil : les autres joueurs gardent les leurs."
        : "Le rythme, le son et l'affichage de la partie.",
  },
  {
    id: "groupes",
    label: "Groupes",
    hint: "Prix et loyers",
    icon: "ranking",
    title: "Groupes et prix",
    subtitle: () => "Ce que coûte chaque rue, et ce qu'elle rapporte une fois bâtie.",
  },
  {
    id: "regles",
    label: "Règles",
    hint: "Le jeu en bref",
    icon: "book",
    title: "Règles",
    subtitle: () => "Les règles officielles, telles que ce plateau les applique.",
  },
];

/**
 * Settings, reference and the way out, in one panel reachable at any moment
 * of a turn.
 *
 * Laid out as a sidebar and a page rather than a strip of tabs over one long
 * scroll. The sidebar says what exists before anything is opened — the old
 * header tabs gave no hint that the room code, the microphone switch and the
 * sound all lived under one "Réglages" — and on a phone held in landscape,
 * the only way this game is played on one, width is what there is to spare
 * and height is what there is not.
 *
 * Leaving is not a setting, so it is not a row among the sliders: it sits
 * at the foot of the sidebar, set apart, in the colour of things that cost.
 */
export function SettingsModal() {
  const open = useGame((s) => s.settingsOpen);
  const toggleSettings = useGame((s) => s.toggleSettings);
  const askQuit = useGame((s) => s.askQuit);
  const compact = useCompact();
  const online = useIsOnline();
  // Unset until the player picks one, so the panel opens where it is most
  // useful: online, on the room and its code — the thing asked for most once
  // play has begun.
  const [picked, setPicked] = useState<Tab | null>(null);

  const tabs = TABS.filter((t) => online || !t.onlineOnly);
  const current = tabs.find((t) => t.id === picked) ?? (tabs[0] as TabDef);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !useGame.getState().confirmQuitOpen) toggleSettings();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toggleSettings]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`absolute inset-0 z-50 flex items-center justify-center ${compact ? "px-2 py-1" : "px-4 py-4"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            background: "radial-gradient(80% 60% at 50% 45%, rgba(38,24,8,.5) 0%, rgba(20,12,4,.78) 100%)",
          }}
          onClick={toggleSettings}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className={`flex max-w-full overflow-hidden rounded-[4px] ${
              compact ? "h-full w-full max-w-[780px]" : "h-[min(620px,86vh)] w-[840px]"
            }`}
            style={{ boxShadow: "var(--shadow-deep)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              tabs={tabs}
              current={current.id}
              compact={compact}
              onPick={setPicked}
              onQuit={askQuit}
            />

            <section className="mat-card mat-grain flex min-w-0 flex-1 flex-col rounded-l-none border-l-0">
              <header className={`flex items-start gap-3 ${compact ? "px-3 pb-1.5 pt-2" : "px-5 pb-3 pt-4"}`}>
                <div className="min-w-0 flex-1">
                  <h2
                    id="settings-title"
                    className={`u-display leading-tight text-ink-900 ${compact ? "text-[15px]" : "text-[20px]"}`}
                  >
                    {current.title}
                  </h2>
                  <p className={`truncate text-ink-500 ${compact ? "text-[10.5px]" : "mt-0.5 text-[12px]"}`}>
                    {current.subtitle(online)}
                  </p>
                </div>
                <Fitting icon="close" label="Fermer" className="!h-8 !w-8" onClick={toggleSettings} />
              </header>
              <BrassRule />

              <div className={`scroll-paper min-h-0 flex-1 overflow-y-auto ${compact ? "px-3 py-2.5" : "px-5 py-4"}`}>
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  {current.id === "salon" && <RoomTab />}
                  {current.id === "reglages" && <PreferencesTab />}
                  {current.id === "groupes" && <GroupsTab />}
                  {current.id === "regles" && <RulesTab />}
                </motion.div>
              </div>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SidebarProps {
  tabs: TabDef[];
  current: Tab;
  compact: boolean;
  onPick: (tab: Tab) => void;
  onQuit: () => void;
}

/** The wooden spine of the panel: where you are, where else you can go, and the door. */
function Sidebar({ tabs, current, compact, onPick, onQuit }: SidebarProps) {
  return (
    <nav
      aria-label="Sections des paramètres"
      className={`mat-wood mat-grain flex shrink-0 flex-col rounded-r-none ${compact ? "w-[118px] p-1.5" : "w-[200px] p-3"}`}
    >
      <div className={`flex items-center gap-2 ${compact ? "px-1.5 pb-1.5 pt-1" : "px-2 pb-3 pt-1"}`}>
        <Icon name="cog" size={compact ? 14 : 17} className="shrink-0 text-gold-300" />
        <span className={`u-display text-sand-50 ${compact ? "text-[13px]" : "text-[17px]"}`}>Paramètres</span>
      </div>
      <span className="mat-brass mb-1.5 block h-px opacity-60" />

      <ul className="flex flex-col gap-0.5">
        {tabs.map((tab) => {
          const active = tab.id === current;
          return (
            <li key={tab.id}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onPick(tab.id)}
                className={`relative flex w-full items-center rounded-[3px] text-left transition-colors ${
                  compact ? "gap-2 px-2 py-1.5" : "gap-2.5 px-2.5 py-2"
                } ${active ? "text-gold-300" : "text-sand-200/85 hover:bg-white/5 hover:text-gold-300"}`}
                style={
                  active
                    ? {
                        background: "rgba(0,0,0,.3)",
                        boxShadow: "inset 0 2px 6px rgba(0,0,0,.45), 0 1px 0 rgba(255,210,150,.12)",
                      }
                    : undefined
                }
              >
                {active && <span className="mat-brass absolute inset-y-1.5 left-0 w-[3px] rounded-full" />}
                <Icon name={tab.icon} size={compact ? 14 : 16} className="shrink-0" />
                <span className="min-w-0">
                  <span className={`block font-semibold leading-tight ${compact ? "text-[12px]" : "text-[13.5px]"}`}>
                    {tab.label}
                  </span>
                  {!compact && (
                    <span className={`block text-[10.5px] leading-tight ${active ? "text-sand-200/80" : "text-sand-300/55"}`}>
                      {tab.hint}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-2">
        <Button face="clay" size="sm" icon="arrowLeft" block onClick={onQuit}>
          {compact ? "Quitter" : "Quitter la partie"}
        </Button>
      </div>
    </nav>
  );
}
