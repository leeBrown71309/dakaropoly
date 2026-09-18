import { motion } from "framer-motion";
import { Scene } from "../../three/Scene";
import { useGame } from "../../game/store";
import { PlayersPanel } from "../hud/PlayersPanel";
import { ActionBar } from "../hud/ActionBar";
import { BuyPanel } from "../hud/BuyPanel";
import { AuctionPanel } from "../hud/AuctionPanel";
import { DebtPanel } from "../hud/DebtPanel";
import { ManagePanel } from "../hud/ManagePanel";
import { TradeModal } from "../hud/TradeModal";
import { CardModal } from "../hud/CardModal";
import { Announcement } from "../hud/Announcement";
import { SettingsModal } from "../hud/SettingsModal";
import { ConfirmQuit } from "../hud/ConfirmQuit";
import { Toasts } from "../hud/Toasts";
import { ViewControls } from "../hud/ViewControls";
import { TurnBanner, MoneyRain } from "../hud/TurnBanner";

/**
 * The board fills the frame; every control lives on the rail at the foot of
 * the screen or on a panel anchored to an edge.
 *
 * Those edge-anchored controls are mounted inside a safe-area frame, so a
 * notch or a rounded corner never clips them — they position themselves
 * against its padding box without knowing the insets exist. The 3D scene and
 * the full-bleed overlays stay outside it and run to the glass.
 */
export function GameScreen() {
  const game = useGame((s) => s.game);
  if (!game) return null;

  return (
    <div className="relative h-full overflow-hidden bg-[#0d2a2f]">
      <Scene />

      <div className="p-safe pointer-events-none absolute inset-0">
        <PlayersPanel />
        <TurnBanner />
        <ViewControls />
        <ManagePanel />
        <ActionBar />
        <BuyPanel />
        <AuctionPanel />
        <DebtPanel />
        <Toasts />
      </div>

      <TradeModal />
      <CardModal />
      <Announcement />
      <SettingsModal />
      <ConfirmQuit />
      <MoneyRain />

      {/* Curtain covering the first painted frame, lifted as the camera settles */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-50 bg-[#0d2a2f]"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.85, ease: "easeOut" }}
      />
    </div>
  );
}
