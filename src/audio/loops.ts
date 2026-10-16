// The mixer's LOOPS as data: what the room hums are made of and how a smoke canister's hiss is shaped. One place, read by the mixer (audio.ts setupAmbience / hiss) and by the
// listening page (src/sounds/main.ts), so the page plays what the game plays. No game code is imported here.
import type { SfxBuffer, SfxContext } from './backend';
import { noiseBuffer, toneNoise } from './webaudio';

export type AmbienceKind = 'hum' | 'servers' | 'wind' | 'buzz';
export interface AmbienceLoop { buffer: SfxBuffer; filter: { type: 'lowpass' | 'bandpass'; freq: number; Q?: number }; wobble?: { rateHz: number; depthHz: number } }

/** one ambience emitter's loop: its buffer (fresh noise each call, off the system die) and its own tone filter */
export function ambienceLoop(sc: SfxContext, kind: AmbienceKind): AmbienceLoop {
  if (kind === 'servers') return { buffer: toneNoise(sc, 3, [118, 236, 355], 0.5), filter: { type: 'lowpass', freq: 1800 } };
  if (kind === 'hum') return { buffer: toneNoise(sc, 3, [50, 100, 150], 0.15), filter: { type: 'lowpass', freq: 600 } };
  if (kind === 'buzz') return { buffer: toneNoise(sc, 2, [100, 200, 300, 400], 0.05), filter: { type: 'bandpass', freq: 240, Q: 2 } };
  return { buffer: noiseBuffer(sc, 4), filter: { type: 'lowpass', freq: 500, Q: 0.5 }, wobble: { rateHz: 0.11, depthHz: 250 } };
}
/** the emitters the mixer stands up (the office's places): where, what, its level at the emitter, how far it carries */
export const AMBIENCE_OFFICE: { what: string; pos: [number, number, number]; kind: AmbienceKind; base: number; radius: number }[] = [
  { what: 'server room', pos: [18, 1.2, 7], kind: 'servers', base: 0.5, radius: 12 },
  { what: 'vending machines', pos: [29.5, 1.2, 13.2], kind: 'buzz', base: 0.35, radius: 7 },
  { what: 'flickering panel ballast', pos: [16.5, 2.8, 20.6], kind: 'buzz', base: 0.15, radius: 6 },
  { what: 'air handling', pos: [8, 2.6, 18], kind: 'hum', base: 0.25, radius: 14 },
  { what: 'wind outside', pos: [16, 3, 27], kind: 'wind', base: 0.5, radius: 18 },
  { what: 'wind outside, west', pos: [1.5, 3, 20], kind: 'wind', base: 0.4, radius: 14 },
];
/** the ambience panners' distance law */
export const AMBIENCE_DISTANCE = { ref: 2, rolloff: 1 };

/** a smoke canister's hiss: a 2 s noise loop through a band, risen over `rise`, held, faded over the last `tail` seconds */
export const HISS = { seconds: 2, filter: { type: 'bandpass' as const, freq: 2600, Q: 0.8 }, peak: 0.5, rise: 0.3, tail: 2, distance: { ref: 1.2, rolloff: 1.3 }, pop: 0.9 };
