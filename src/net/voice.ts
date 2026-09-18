import { create } from "zustand";
import { pushToast } from "../game/store";

/**
 * Voice, peer to peer.
 *
 * Every device dials every other one directly: no server carries the audio,
 * so there is no quota to run out of and nothing to pay for. The cost is
 * borne by the phones instead — each one encodes a separate stream per other
 * player, which is comfortable at four and heavy at eight. That trade is the
 * whole reason this exists in this shape; a mixing server would swap it for
 * a meter running.
 *
 * Signalling rides the room's Realtime channel, which is already open for
 * the game itself. It is addressed rather than broadcast in spirit — every
 * device receives every message, and each one keeps only what carries its
 * own id.
 */

/** What two devices say to each other to get a call up. */
export interface VoiceSignal {
  t: "offer" | "answer";
  sdp: string;
}

export interface VoiceWire {
  k: "rtc";
  from: string;
  to: string;
  signal: VoiceSignal;
}

/**
 * Public STUN only. It is enough for the ordinary home router, which is
 * where this will be played; behind a symmetric NAT or a strict corporate
 * firewall two peers will fail to meet, and relaying through a TURN server
 * is the only fix — which is a server, and a bill.
 */
const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

/** How loud counts as talking, and how often the meters are read. */
const SPEAKING_LEVEL = 0.045;
const METER_MS = 180;

/** Longest we wait for candidates before sending the description anyway. */
const GATHER_MS = 2500;

interface Peer {
  pc: RTCPeerConnection;
  /** Remote audio has to be attached to an element to play at all. */
  el: HTMLAudioElement;
  analyser: AnalyserNode | null;
}

interface VoiceState {
  /** A microphone is open and this device is in the mesh. */
  active: boolean;
  /** Open, but nothing is being sent. */
  muted: boolean;
  busy: boolean;
  error: string | null;
  /** Client ids heard talking right now, this device included. */
  talking: Record<string, boolean>;
  /** How each leg of the mesh is doing, for the dots in the roster. */
  peers: Record<string, RTCPeerConnectionState>;

  start: () => Promise<void>;
  stop: () => void;
  toggleMute: () => void;
  clearError: () => void;
}

/** What the room layer hands over so voice can reach the other devices. */
export interface VoiceLink {
  selfId: string;
  send: (wire: VoiceWire) => void;
  /** Re-publishes presence, so the others learn this device has a mic on. */
  announce: () => void;
}

let link: VoiceLink | null = null;
let localStream: MediaStream | null = null;
let localAnalyser: AnalyserNode | null = null;
let audioCtx: AudioContext | null = null;
let meter: ReturnType<typeof setInterval> | null = null;
const peers = new Map<string, Peer>();

/* ------------------------------------------------------------------ */
/* Pure bits, so the parts that decide anything can be tested.          */

/**
 * Which of two devices dials.
 *
 * Both sides learn about each other at the same moment, so without a rule
 * they would both offer and the negotiations would collide. Comparing ids
 * needs no agreement and no extra message: the smaller one dials.
 */
export function shouldOffer(selfId: string, peerId: string): boolean {
  return selfId < peerId;
}

/** The other devices with a microphone open, from what presence reports. */
export function voicePeers(
  entries: { clientId: string; voice: boolean }[],
  selfId: string,
): string[] {
  return entries.filter((e) => e.voice && e.clientId !== selfId).map((e) => e.clientId);
}

/* ------------------------------------------------------------------ */

export const useVoice = create<VoiceState>()((set, get) => ({
  active: false,
  muted: false,
  busy: false,
  error: null,
  talking: {},
  peers: {},

  clearError: () => set({ error: null }),

  start: async () => {
    if (get().active || get().busy) return;
    set({ busy: true, error: null });
    try {
      // `getUserMedia` simply does not exist on an insecure origin, so a
      // phone on the same Wi-Fi as the laptop cannot do this at all — only
      // localhost and the deployed site are trusted. Saying which is the
      // difference between a fixable problem and a broken button.
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Le micro exige une connexion sécurisée. Le vocal fonctionne sur le site en ligne, pas sur une adresse locale en http.",
        );
      }
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localAnalyser = analyserFor(localStream);
      set({ active: true, muted: false });
      startMeter();
      // Nobody knows there is a microphone here until presence says so; the
      // answer comes back as a peer list through `syncVoicePeers`.
      link?.announce();
    } catch (e) {
      teardown();
      const message = micMessage(e);
      set({ error: message });
      // On screen at once, and kept in the panel so the reason survives the
      // four seconds the slip is up.
      pushToast(message, "bad");
    } finally {
      set({ busy: false });
    }
  },

  stop: () => {
    teardown();
    set({ active: false, muted: false, talking: {}, peers: {} });
    link?.announce();
  },

  toggleMute: () => {
    const muted = !get().muted;
    // The track stays in the connection and simply stops carrying anything:
    // renegotiating with every peer to mute would be absurd.
    for (const track of localStream?.getAudioTracks() ?? []) track.enabled = !muted;
    set({ muted });
  },
}));

// Reaching the call from the browser console, in development only. A mesh
// that half came up looks identical from the outside to one that did not
// start, and the difference is entirely in here.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __dakavoice?: unknown }).__dakavoice = () => ({
    ...useVoice.getState(),
    dialled: [...peers.keys()],
  });
}

/* ------------------------------------------------------------------ */

/** Installed by the room layer once its channel is up. */
export function attachVoice(next: VoiceLink): void {
  link = next;
}

export function detachVoice(): void {
  teardown();
  useVoice.setState({ active: false, muted: false, talking: {}, peers: {} });
  link = null;
}

/** True when presence should tell the room this device has a mic open. */
export function voiceIsOn(): boolean {
  return useVoice.getState().active;
}

/**
 * Brings the mesh in line with who is actually in the call.
 *
 * Called on every presence sync, so somebody arriving, leaving, or closing
 * their laptop is handled by the same path rather than by three of them.
 */
export function syncVoicePeers(ids: string[]): void {
  const selfId = link?.selfId;
  if (!selfId || !useVoice.getState().active) {
    if (peers.size > 0) dropAll();
    return;
  }

  const wanted = new Set(ids.filter((id) => id !== selfId));
  for (const id of [...peers.keys()]) if (!wanted.has(id)) dropPeer(id);
  for (const id of wanted) {
    if (peers.has(id)) continue;
    if (shouldOffer(selfId, id)) void dial(id);
    else ensurePeer(id);
  }
}

/** A signalling message off the room channel. */
export async function handleVoiceWire(wire: VoiceWire): Promise<void> {
  const selfId = link?.selfId;
  // Everyone receives everything on this channel; this one is not ours.
  if (!selfId || wire.to !== selfId || wire.from === selfId) return;
  if (!useVoice.getState().active) return;

  const peer = ensurePeer(wire.from);
  const { pc } = peer;
  try {
    if (wire.signal.t === "offer") {
      await pc.setRemoteDescription({ type: "offer", sdp: wire.signal.sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      const sdp = pc.localDescription?.sdp;
      if (sdp) link?.send({ k: "rtc", from: selfId, to: wire.from, signal: { t: "answer", sdp } });
    } else if (pc.signalingState === "have-local-offer") {
      await pc.setRemoteDescription({ type: "answer", sdp: wire.signal.sdp });
    }
  } catch {
    // A leg that will not come up is not worth a message on screen: the dot
    // beside that player stays grey, which says it better.
    dropPeer(wire.from);
  }
}

/* ------------------------------------------------------------------ */

async function dial(id: string): Promise<void> {
  const selfId = link?.selfId;
  if (!selfId) return;
  const { pc } = ensurePeer(id);
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const sdp = pc.localDescription?.sdp;
    if (sdp) link?.send({ k: "rtc", from: selfId, to: id, signal: { t: "offer", sdp } });
  } catch {
    dropPeer(id);
  }
}

function ensurePeer(id: string): Peer {
  const existing = peers.get(id);
  if (existing) return existing;

  const pc = new RTCPeerConnection(ICE);
  const el = new Audio();
  el.autoplay = true;
  const peer: Peer = { pc, el, analyser: null };
  peers.set(id, peer);

  if (localStream) for (const track of localStream.getTracks()) pc.addTrack(track, localStream);

  pc.ontrack = (ev) => {
    const stream = ev.streams[0];
    if (!stream) return;
    el.srcObject = stream;
    // Started by a tap on the microphone button, so there is a gesture
    // behind this; a browser that refuses anyway leaves the dot grey.
    void el.play().catch(() => undefined);
    peer.analyser = analyserFor(stream);
  };

  pc.onconnectionstatechange = () => {
    useVoice.setState((s) => ({ peers: { ...s.peers, [id]: pc.connectionState } }));
    if (pc.connectionState === "failed") dropPeer(id);
  };

  return peer;
}

/**
 * Waits for the candidates instead of trickling them.
 *
 * Trickling means a dozen or more messages per pair, and at eight players
 * that is a burst of hundreds through a channel with a rate limit — which
 * would be dropped, not queued. One description carrying everything costs a
 * second or two of setup and two messages per pair.
 */
async function gathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const finish = (): void => {
      pc.removeEventListener("icegatheringstatechange", check);
      clearTimeout(timer);
      resolve();
    };
    const check = (): void => {
      if (pc.iceGatheringState === "complete") finish();
    };
    // Some networks never say they are done. What has been gathered by then
    // is almost always enough.
    const timer = setTimeout(finish, GATHER_MS);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

function dropPeer(id: string): void {
  const peer = peers.get(id);
  if (!peer) return;
  peer.pc.onconnectionstatechange = null;
  peer.pc.ontrack = null;
  peer.pc.close();
  peer.el.srcObject = null;
  peers.delete(id);
  useVoice.setState((s) => {
    const { [id]: _gone, ...peersLeft } = s.peers;
    const { [id]: _quiet, ...talkingLeft } = s.talking;
    return { peers: peersLeft, talking: talkingLeft };
  });
}

function dropAll(): void {
  for (const id of [...peers.keys()]) dropPeer(id);
}

function teardown(): void {
  stopMeter();
  dropAll();
  for (const track of localStream?.getTracks() ?? []) track.stop();
  localStream = null;
  localAnalyser = null;
  void audioCtx?.close().catch(() => undefined);
  audioCtx = null;
}

/* ------------------------------------------------------------------ */

function analyserFor(stream: MediaStream): AnalyserNode | null {
  try {
    audioCtx ??= new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    return analyser;
  } catch {
    // Only the talking indicator is lost; the call itself is unaffected.
    return null;
  }
}

/** Rough loudness, 0 to 1, from the waveform rather than the spectrum. */
function level(analyser: AnalyserNode, buf: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (const sample of buf) {
    const centred = (sample - 128) / 128;
    sum += centred * centred;
  }
  return Math.sqrt(sum / buf.length);
}

function startMeter(): void {
  stopMeter();
  const buf = new Uint8Array(256);
  meter = setInterval(() => {
    const talking: Record<string, boolean> = {};
    for (const [id, peer] of peers) {
      if (peer.analyser) talking[id] = level(peer.analyser, buf) > SPEAKING_LEVEL;
    }
    const selfId = link?.selfId;
    if (selfId && localAnalyser) {
      talking[selfId] = !useVoice.getState().muted && level(localAnalyser, buf) > SPEAKING_LEVEL;
    }
    useVoice.setState({ talking });
  }, METER_MS);
}

function stopMeter(): void {
  if (meter !== null) clearInterval(meter);
  meter = null;
  useVoice.setState({ talking: {} });
}

function micMessage(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError") {
      return "Le micro a été refusé. Autorisez-le dans les réglages du navigateur, puis réessayez.";
    }
    if (e.name === "NotFoundError") return "Aucun micro trouvé sur cet appareil.";
    if (e.name === "NotReadableError") return "Le micro est déjà utilisé par une autre application.";
  }
  return e instanceof Error ? e.message : "Le micro n'a pas pu être ouvert";
}
