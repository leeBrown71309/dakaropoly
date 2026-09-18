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
import { Toasts } from "../hud/Toasts";
import { TurnBanner, MoneyRain } from "../hud/TurnBanner";

export function GameScreen() {
  const game = useGame((s) => s.game);
  const toggleSound = useGame((s) => s.toggleSound);
  const soundOn = useGame((s) => s.soundOn);
  const goHome = useGame((s) => s.goHome);
  if (!game) return null;

  return (
    <div className="relative h-full overflow-hidden bg-[radial-gradient(120%_90%_at_50%_15%,#16324f_0%,#0e1420_55%,#090d14_100%)]">
      <Scene />
      <PlayersPanel />
      <TurnBanner />
      <div className="absolute right-3 top-3 z-30 flex gap-2">
        <button
          onClick={toggleSound}
          className="rounded-xl border border-white/10 bg-[#101a2b]/80 px-3 py-2 text-sm text-slate-200 backdrop-blur-md hover:bg-white/10"
        >
          {soundOn ? "🔊" : "🔇"}
        </button>
        <button
          onClick={goHome}
          className="rounded-xl border border-white/10 bg-[#101a2b]/80 px-3 py-2 text-sm text-slate-200 backdrop-blur-md hover:bg-white/10"
        >
          🚪
        </button>
      </div>
      <ManagePanel />
      <TradeModal />
      <ActionBar />
      <BuyPanel />
      <AuctionPanel />
      <DebtPanel />
      <CardModal />
      <Toasts />
      <MoneyRain />
    </div>
  );
}
