import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { useRoom, type ChatMessage } from "../../net/roomStore";
import type { Seat } from "../../net/room";
import { useCompact } from "../useViewport";
import { BrassRule } from "../kit/Surface";
import { Fitting } from "../kit/Button";
import { Icon } from "../icons/Icon";

const clock = (at: number): string =>
  new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * Who the sender was to the table when they spoke. Messages written before
 * the badge existed read the current roster instead — the best answer left
 * once their own device stopped recording the fact.
 */
const roleOf = (m: ChatMessage, seats: Seat[]): string => {
  const role =
    m.role ?? (seats.some((s) => s.clientId === m.clientId && s.seat !== null) ? "player" : "spectator");
  return role === "player" ? "joueur" : "spectateur";
};

/**
 * The written chat, pinned above the rail beside the journal.
 *
 * It exists because not everyone at a table has Discord or WhatsApp, and
 * because the moment people most need to talk is the moment they are
 * negotiating a trade — which is why it sits within reach of the board
 * rather than in a screen of its own.
 */
export function ChatPanel() {
  const chatOpen = useGame((s) => s.chatOpen);
  const toggleChat = useGame((s) => s.toggleChat);
  const messages = useRoom((s) => s.messages);
  const seats = useRoom((s) => s.seats);
  const say = useRoom((s) => s.say);
  const markRead = useRoom((s) => s.markRead);
  const myClientId = useRoom((s) => s.clientId);
  const compact = useCompact();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Open is read: the counter on the rail is only for what was missed.
  useEffect(() => {
    if (chatOpen) markRead();
  }, [chatOpen, messages.length, markRead]);

  useEffect(() => {
    if (chatOpen) endRef.current?.scrollIntoView({ block: "end" });
  }, [chatOpen, messages.length]);

  if (!chatOpen) return null;

  const send = () => {
    say(draft);
    setDraft("");
  };

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={`pointer-events-auto absolute right-2 z-30 max-w-[92vw] ${
        compact ? "bottom-[58px] w-[280px]" : "bottom-[92px] w-[340px]"
      }`}
    >
      <div
        className={`mat-grain relative rounded-[3px] ${compact ? "px-2.5 pb-2 pt-2" : "px-3 pb-2.5 pt-2.5"}`}
        style={{
          background: "linear-gradient(180deg,#fdfaf2 0%,#f3ebd9 100%)",
          boxShadow: "0 16px 34px -12px rgba(52,33,12,.6)",
        }}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <Icon name="chat" size={13} className="text-ink-500" />
          <span className="u-label text-ink-500">Discussion</span>
          <Fitting icon="close" label="Fermer" className="ml-auto !h-6 !w-6" onClick={toggleChat} />
        </div>
        <BrassRule className="mb-1.5" />

        <div className={`scroll-paper overflow-y-auto pr-1 ${compact ? "h-24" : "h-40"}`}>
          {messages.length === 0 ? (
            <p className="py-4 text-center text-[11.5px] italic text-ink-300">
              Personne n'a encore rien dit.
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`leading-snug ${compact ? "py-[3px]" : "py-[4px]"}`}>
                <span
                  className={`font-bold ${m.clientId === myClientId ? "text-gold-700" : "text-teal-700"} ${
                    compact ? "text-[11px]" : "text-[12px]"
                  }`}
                >
                  {m.name}
                </span>
                <span
                  className={`u-label ml-1.5 ${roleOf(m, seats) === "joueur" ? "text-teal-700/70" : "text-ink-300"}`}
                >
                  {roleOf(m, seats)}
                </span>
                <span className="ml-1 text-[10px] text-ink-300">{clock(m.at)}</span>
                <div
                  className={`whitespace-pre-wrap break-words text-ink-700 ${
                    compact ? "text-[11px]" : "text-[12px]"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <BrassRule className="my-1.5" />
        <div className="flex items-center gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Votre message"
            maxLength={240}
            className={`field py-1 ${compact ? "text-[11.5px]" : "text-[12.5px]"}`}
          />
          <Fitting
            icon="check"
            label="Envoyer"
            className="!h-8 !w-8 shrink-0"
            disabled={draft.trim().length === 0}
            onClick={send}
          />
        </div>
      </div>
    </motion.div>
  );
}
