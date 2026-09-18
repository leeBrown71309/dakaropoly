import { motion } from "framer-motion";
import { usePortraitBlocked } from "../useViewport";
import { enterLandscape, fullscreenSupported } from "../fullscreen";
import { Card, BrassRule } from "../kit/Surface";
import { Button } from "../kit/Button";
import { Icon } from "../icons/Icon";

/**
 * Dakaropoly is a wide diorama with a rail of controls along the foot: held
 * upright, a phone leaves room for neither. Rather than fold the board into a
 * column it cannot serve, the gate asks for the device to be turned.
 *
 * Mounted above every screen, so it also covers the title and the roster.
 */
export function RotateGate() {
  const blocked = usePortraitBlocked();
  if (!blocked) return null;

  return (
    <div className="mat-felt fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      <div className="p-safe flex h-full w-full items-center justify-center">
        <div className="w-[300px] max-w-[86vw]">
          <Card className="px-6 pb-6 pt-7 text-center">
            <span
              className="pointer-events-none absolute inset-[9px]"
              style={{ border: "1px solid rgba(168,112,31,.4)" }}
            />

            <div className="relative">
              <motion.div
                className="mx-auto w-fit text-gold-700"
                animate={{ rotate: [0, 0, -90, -90, 0] }}
                transition={{ duration: 3.4, times: [0, 0.22, 0.5, 0.86, 1], repeat: Infinity }}
              >
                <Icon name="rotate" size={54} strokeWidth={1.4} />
              </motion.div>

              <BrassRule className="mx-auto my-4 w-28" />

              <h1 className="u-display text-[23px] leading-tight text-ink-900">
                Tournez l'appareil
              </h1>
              <p className="mx-auto mt-2 max-w-[230px] text-[13px] leading-relaxed text-ink-700">
                Dakaropoly se joue en paysage&nbsp;: le plateau tient toute la largeur, et les
                commandes se posent en bas.
              </p>

              {fullscreenSupported() && (
                <>
                  <Button
                    face="gold"
                    icon="expand"
                    className="mt-5"
                    onClick={() => void enterLandscape()}
                  >
                    Passer en plein écran
                  </Button>
                  <p className="mt-2 text-[11px] leading-snug text-ink-500">
                    Sur Android, le plein écran verrouille aussi l'orientation.
                  </p>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
