import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { BOARD } from "../../game/data/board";
import { GROUP_COLORS } from "../../game/colors";
import { ownedPositions } from "../../game/selectors";
import type { Player } from "../../game/types";
import { Card, Label, BrassRule } from "../kit/Surface";
import { Button, Fitting } from "../kit/Button";
import { Money } from "../kit/Money";
import { PawnGlyph } from "../icons/PawnGlyph";
import { Icon } from "../icons/Icon";

/** A property chip that can be laid on the table as part of an offer. */
function PropChip({
  pos,
  selected,
  onToggle,
}: {
  pos: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const tile = BOARD[pos];
  if (!tile) return null;
  const band = tile.group ? GROUP_COLORS[tile.group] : "#4A4238";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-[3px] px-2 py-1 text-left transition"
      style={{
        background: selected ? "rgba(30,111,107,.16)" : "rgba(120,95,60,.06)",
        boxShadow: selected
          ? "inset 0 0 0 1.5px rgba(30,111,107,.75)"
          : "inset 0 0 0 1px rgba(110,86,52,.2)",
      }}
    >
      <span className="h-3.5 w-[3px] shrink-0 rounded-[1px]" style={{ backgroundColor: band }} />
      <span className="truncate text-[12px] font-semibold text-ink-900">{tile.name}</span>
      {selected && <Icon name="check" size={12} className="ml-auto shrink-0 text-teal-500" />}
    </button>
  );
}

function OfferColumn({
  owner,
  caption,
  money,
  onMoney,
  picks,
  onTogglePick,
  tradable,
  compact,
}: {
  owner: Player;
  caption: string;
  money: number;
  onMoney: (v: number) => void;
  picks: number[];
  onTogglePick: (pos: number) => void;
  tradable: number[];
  compact: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-1.5 flex items-center gap-2">
        <span style={{ color: owner.color }}>
          <PawnGlyph pawn={owner.pawn} size={compact ? 16 : 20} />
        </span>
        <span className={`u-display text-ink-900 ${compact ? "text-[12px]" : "text-[13.5px]"}`}>
          {owner.name}
        </span>
        <Label className="ml-auto">{caption}</Label>
      </div>

      <div className="mb-1.5 flex items-center gap-2">
        <Icon name="coins" size={14} className="shrink-0 text-ink-500" />
        <input
          type="number"
          min={0}
          max={owner.money}
          value={money}
          onChange={(e) => onMoney(Math.max(0, Math.min(Number(e.target.value) || 0, owner.money)))}
          className="field py-1 text-[12.5px]"
        />
      </div>

      <div className="scroll-paper flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {tradable.length === 0 ? (
          <p className="py-3 text-center text-[11.5px] italic text-ink-300">Rien d'échangeable</p>
        ) : (
          tradable.map((pos) => (
            <PropChip key={pos} pos={pos} selected={picks.includes(pos)} onToggle={() => onTogglePick(pos)} />
          ))
        )}
      </div>
    </div>
  );
}

export function TradeModal() {
  const game = useGame((s) => s.game);
  const tradeOpen = useGame((s) => s.tradeOpen);
  const toggleTrade = useGame((s) => s.toggleTrade);
  const dispatch = useGame((s) => s.dispatch);
  const compact = useCompact();

  const [to, setTo] = useState<number | null>(null);
  const [giveMoney, setGiveMoney] = useState(0);
  const [takeMoney, setTakeMoney] = useState(0);
  const [giveProps, setGiveProps] = useState<number[]>([]);
  const [takeProps, setTakeProps] = useState<number[]>([]);
  const [awaiting, setAwaiting] = useState(false);

  if (!game) return null;
  const current = game.players[game.current];
  if (!current) return null;

  const canTrade = game.phase === "post-roll" || game.phase === "turn-start";
  const target = to !== null ? game.players[to] : null;

  const reset = () => {
    setGiveMoney(0);
    setTakeMoney(0);
    setGiveProps([]);
    setTakeProps([]);
    setTo(null);
    setAwaiting(false);
  };

  const close = () => {
    reset();
    toggleTrade();
  };

  /** Buildings must be sold before a property can change hands. */
  const tradableOf = (p: Player) =>
    ownedPositions(game, p.id).filter((pos) => (game.tiles[pos]?.houses ?? 0) === 0);

  const toggleIn = (list: number[], set: (v: number[]) => void, pos: number) =>
    set(list.includes(pos) ? list.filter((x) => x !== pos) : [...list, pos]);

  const nothingOffered =
    giveMoney === 0 && takeMoney === 0 && giveProps.length === 0 && takeProps.length === 0;

  return (
    <AnimatePresence>
      {tradeOpen && canTrade && (
        <motion.div
          className={`absolute inset-0 z-50 flex items-center justify-center ${
            compact ? "px-2 py-1" : "px-4"
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            background: "radial-gradient(80% 60% at 50% 45%, rgba(38,24,8,.5) 0%, rgba(20,12,4,.76) 100%)",
          }}
        >
          <motion.div
            initial={{ y: 26, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 18, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="w-[600px] max-w-full"
          >
            <Card className={`flex flex-col overflow-hidden ${compact ? "max-h-[97vh]" : "max-h-[80vh]"}`}>
              <header
                className={`flex items-center gap-2 ${compact ? "px-3 pb-1 pt-1.5" : "px-4 pb-2 pt-3"}`}
              >
                <Icon name="exchange" size={compact ? 15 : 18} className="text-ink-700" />
                <span className={`u-display text-ink-900 ${compact ? "text-[13px]" : "text-[16px]"}`}>
                  {target ? `Échange avec ${target.name}` : "Proposer un échange"}
                </span>
                <Fitting icon="close" label="Fermer" className="ml-auto !h-7 !w-7" onClick={close} />
              </header>
              <BrassRule />

              {!target ? (
                <div className={compact ? "p-3" : "p-4"}>
                  <Label>Choisir un partenaire</Label>
                  <div className={`mt-2 grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-2"}`}>
                    {game.players
                      .filter((p) => p.id !== current.id && !p.bankrupt)
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setTo(p.id)}
                          className={`flex items-center gap-2.5 rounded-[3px] text-left transition hover:brightness-[.97] ${
                            compact ? "px-2 py-1.5" : "px-3 py-2.5"
                          }`}
                          style={{
                            background: "rgba(120,95,60,.07)",
                            boxShadow: "inset 0 0 0 1px rgba(110,86,52,.22)",
                          }}
                        >
                          <span style={{ color: p.color }}>
                            <PawnGlyph pawn={p.pawn} size={compact ? 18 : 24} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-bold text-ink-900">{p.name}</span>
                            <Money amount={p.money} className="text-[11.5px] text-ink-500" />
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : awaiting ? (
                <div className={compact ? "p-3" : "p-4"}>
                  <p
                    className={`mb-3 text-center font-semibold text-ink-700 ${
                      compact ? "text-[12px]" : "text-[13px]"
                    }`}
                  >
                    <span className="u-display text-[15px] text-ink-900">{target.name}</span>, acceptes-tu cet
                    échange&nbsp;?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Summary owner={current} caption="donne" money={giveMoney} props={giveProps} />
                    <Summary owner={target} caption="donne" money={takeMoney} props={takeProps} />
                  </div>
                  <div className={`flex justify-end gap-2 ${compact ? "mt-2.5" : "mt-4"}`}>
                    <Button face="bone" size={compact ? "sm" : "md"} onClick={() => setAwaiting(false)}>
                      Modifier
                    </Button>
                    <Button
                      face="teal"
                      size={compact ? "sm" : "md"}
                      icon="check"
                      onClick={() => {
                        dispatch({
                          t: "propose-trade",
                          offer: { to: target.id, giveMoney, giveProps, takeMoney, takeProps },
                        });
                        close();
                      }}
                    >
                      Accepter l'échange
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={`grid min-h-0 flex-1 grid-cols-2 ${compact ? "gap-2.5 p-3" : "gap-4 p-4"}`}
                  >
                    <OfferColumn
                      owner={current}
                      caption="donne"
                      money={giveMoney}
                      onMoney={setGiveMoney}
                      picks={giveProps}
                      onTogglePick={(pos) => toggleIn(giveProps, setGiveProps, pos)}
                      tradable={tradableOf(current)}
                      compact={compact}
                    />
                    <OfferColumn
                      owner={target}
                      caption="donne"
                      money={takeMoney}
                      onMoney={setTakeMoney}
                      picks={takeProps}
                      onTogglePick={(pos) => toggleIn(takeProps, setTakeProps, pos)}
                      tradable={tradableOf(target)}
                      compact={compact}
                    />
                  </div>
                  <BrassRule />
                  <div
                    className={`flex items-center gap-2 ${compact ? "px-3 py-1.5" : "px-4 py-2.5"}`}
                  >
                    <Button face="bone" size="sm" icon="arrowLeft" onClick={() => setTo(null)}>
                      {compact ? "Partenaire" : "Changer de partenaire"}
                    </Button>
                    <Button
                      face="gold"
                      size={compact ? "sm" : "md"}
                      className="ml-auto"
                      disabled={nothingOffered}
                      onClick={() => setAwaiting(true)}
                    >
                      Proposer
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Summary({
  owner,
  caption,
  money,
  props,
}: {
  owner: Player;
  caption: string;
  money: number;
  props: number[];
}) {
  return (
    <div
      className="rounded-[3px] p-3"
      style={{ background: "rgba(120,95,60,.07)", boxShadow: "inset 0 0 0 1px rgba(110,86,52,.2)" }}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span style={{ color: owner.color }}>
          <PawnGlyph pawn={owner.pawn} size={18} />
        </span>
        <span className="text-[12.5px] font-bold text-ink-900">{owner.name}</span>
        <Label className="ml-auto">{caption}</Label>
      </div>
      {money > 0 && <Money amount={money} className="text-[14px] font-bold text-teal-700" />}
      {props.map((pos) => (
        <div key={pos} className="text-[12px] text-ink-700">
          {BOARD[pos]?.name}
        </div>
      ))}
      {money === 0 && props.length === 0 && <span className="text-[12px] italic text-ink-300">Rien</span>}
    </div>
  );
}
