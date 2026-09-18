import { Rail } from "../kit/Surface";
import { Fitting } from "../kit/Button";
import { useCompact } from "../useViewport";
import { cameraRig } from "../../three/cameraRig";

/**
 * Camera fittings, mounted bottom-right. Orbiting and panning are done by
 * dragging the board directly; these cover the cases a mouse drag cannot.
 *
 * A short screen has no corner to spare and a touch screen pinches to zoom,
 * so there the whole stack folds into a single recentre on the action rail.
 */
export function ViewControls() {
  const compact = useCompact();
  if (compact) return null;

  return (
    <Rail className="pointer-events-auto absolute bottom-3 right-3 z-30 flex flex-col gap-1.5 p-1.5">
      <Fitting icon="plus" label="Zoomer" onClick={() => cameraRig.zoom(0.82)} />
      <Fitting icon="minus" label="Dézoomer" onClick={() => cameraRig.zoom(1.22)} />
      <Fitting icon="recenter" label="Recadrer le plateau" onClick={() => cameraRig.reset()} />
    </Rail>
  );
}
