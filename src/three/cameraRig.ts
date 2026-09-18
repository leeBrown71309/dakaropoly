/**
 * Bridge between the HTML view controls and the orbit controls living
 * inside the R3F canvas. The Scene registers an implementation on mount;
 * the HUD only ever talks to this façade, so neither side imports the other.
 */
export interface CameraRigApi {
  reset: () => void;
  /** factor < 1 moves closer, > 1 moves away. */
  zoom: (factor: number) => void;
}

let api: CameraRigApi | null = null;

export function registerCameraRig(next: CameraRigApi | null): void {
  api = next;
}

export const cameraRig = {
  reset: (): void => api?.reset(),
  zoom: (factor: number): void => api?.zoom(factor),
};

export interface CameraView {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

/** Default framing, shared by the initial camera and the reset button. */
export const DEFAULT_VIEW: CameraView = {
  position: [0, 16.5, 14.2],
  target: [0, 0, 0.65],
};

/**
 * Framing for a short screen. The rail and the bank cards cover a far larger
 * share of a phone in landscape, so the board is set back and lifted to keep
 * all forty tiles clear of the furniture.
 */
export const COMPACT_VIEW: CameraView = {
  position: [0, 19.4, 16.6],
  target: [0, 0, 1.1],
};

export function viewFor(compact: boolean): CameraView {
  return compact ? COMPACT_VIEW : DEFAULT_VIEW;
}

/**
 * Where the camera starts when a board first appears: high and far, so the
 * diorama is already standing on the water and the shot settles onto it
 * instead of the board popping into frame.
 */
export const INTRO_VIEW = {
  position: [0, 30.5, 25.5] as const,
};

/** Seconds the opening move takes. */
export const INTRO_DURATION = 1.7;

/** How far the board may be dragged off-centre before it stops. */
export const PAN_LIMIT = { x: 6.5, y: 3.5, z: 6.5 };
