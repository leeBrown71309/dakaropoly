import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { useCompact } from "../useViewport";
import { PAWN_SHAPES, PLAYER_COLORS } from "../../game/data/pawns";
import { Card, BrassRule } from "../kit/Surface";
import { Button } from "../kit/Button";
import { PawnGlyph } from "../icons/PawnGlyph";

/** Title screen, set like a printed travel poster for the city. */
export function Home() {
  const openSetup = useGame((s) => s.openSetup);
  const compact = useCompact();

  return (
    <div className="mat-felt relative h-full overflow-hidden">
      {/* Low sun behind the poster */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(52% 40% at 50% 68%, rgba(232,162,59,.28) 0%, rgba(232,162,59,0) 70%)",
        }}
      />

      <div className="p-safe relative flex h-full items-center justify-center">
        <motion.div
          initial={{ y: 26, opacity: 0, rotate: -0.8 }}
          animate={{ y: 0, opacity: 1, rotate: -0.6 }}
          transition={{ type: "spring", stiffness: 160, damping: 20 }}
          className={`relative mx-4 max-w-[calc(100%-2rem)] ${compact ? "w-[400px]" : "w-[440px]"}`}
        >
          <Card className={`text-center ${compact ? "px-6 pb-5 pt-6" : "px-9 pb-8 pt-9"}`}>
            {/* Printed double keyline */}
            <span
              className="pointer-events-none absolute inset-[9px]"
              style={{ border: "1px solid rgba(168,112,31,.4)" }}
            />
            <span
              className="pointer-events-none absolute inset-[13px]"
              style={{ border: "2.5px solid rgba(168,112,31,.22)" }}
            />

            <div className="relative">
              <div className="u-label text-gold-700">Monopoly · Sénégal</div>

              <h1
                className={`u-display leading-[0.92] text-ink-900 ${
                  compact ? "mt-1.5 text-[38px]" : "mt-3 text-[54px]"
                }`}
                style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1', fontWeight: 700 }}
              >
                Dakaropoly
              </h1>

              <BrassRule className={`mx-auto w-40 ${compact ? "my-3" : "my-5"}`} />

              <p
                className={`mx-auto max-w-[300px] leading-relaxed text-ink-700 ${
                  compact ? "text-[12px]" : "text-[13.5px]"
                }`}
              >
                Achetez la Médina, bâtissez les Almadies, et priez de ne jamais voir Rebeuss.
                Deux à huit joueurs, un seul écran.
              </p>

              <Button
                face="gold"
                size={compact ? "md" : "lg"}
                icon="dice"
                className={compact ? "mt-4" : "mt-7"}
                onClick={openSetup}
              >
                Nouvelle partie
              </Button>

              {/* The eight tokens, printed along the foot of the poster */}
              <div
                className={`flex items-end justify-center opacity-70 ${
                  compact ? "mt-4 gap-2" : "mt-8 gap-3"
                }`}
              >
                {PAWN_SHAPES.map((_, i) => (
                  <span key={i} style={{ color: PLAYER_COLORS[i] }}>
                    <PawnGlyph pawn={i} size={compact ? 16 : 20} />
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>

        {!compact && (
          <p className="absolute bottom-5 text-[11.5px] text-sand-300/60">
            Fait maison, pour les soirées en famille.
          </p>
        )}
      </div>
    </div>
  );
}
