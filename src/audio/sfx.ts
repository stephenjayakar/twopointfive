// Procedurally synthesized sound effects rendered into AudioBuffers at startup (no samples shipped).
import type { SfxBuffer, SfxContext } from './backend';
import { Voice, biquad, band, peakTo, TUNING, type Mode, type Tune } from './synth';
export type SfxName =
  | 'pistolSuppressed' | 'pistolLoud' | 'carbineReport' | 'rifleSuppressed' | 'launcher' | 'dryFire' | 'magOut' | 'magIn' | 'rack' | 'magDrop' | 'footSoft' | 'footHard' | 'ocp' | 'nvOn' | 'nvOff'
  | 'click' | 'throw' | 'canisterBounce' | 'bulletImpact' | 'bodyHit' | 'bodyFall' | 'lightBreak' | 'lightOff' | 'deny' | 'equip' | 'smokePop' | 'alertSting' | 'radio'
  | 'doorCreak' | 'doorBang' | 'doorLatch' | 'doorBash' | 'doorRattle' | 'lockPick' | 'lockOpen' | 'lockBreak' | 'powerDown' | 'powerUp' | 'stunBang' | 'earRing' | 'propScrape' | 'propThud'
  | 'grabScuffle' | 'chokeStrain' | 'chokeLimp' | 'whipThud' | 'shove' | 'murmur' | 'heldProtest' | 'whistle'
  | 'stairDoor' | 'stairBoots' | 'casingTink' | 'thunderNear' | 'thunderFar' | 'glassCrack' | 'glassTinkle' | 'glassShatter' | 'glassCrunch'
  | 'padBeep' | 'padOpen' | 'alarmChirp'   // devices (game/devices.ts): a keypad key, the pad accepting the code, a tripwire's emitter chirping as it reports
  | 'wallCrack' | 'wallThump' | 'wallDebris'   // a wall charge going off (game/blastFeel.ts)
  | 'wallOn' | 'wallOff'   // the player's back landing on a wall and his stepping off it (game/wallsnap.ts `voice`)
  | 'grabCatch' | 'gunStrip' | 'gunDown'   // the grab as three beats: the catch, the gun twisted out of his hand, the gun let down onto the floor
  | 'mk12Suppressed' | 'mp7Suppressed' | 'mk46Report' | 'm1014Report' | 'm870Report' | 'hk45Suppressed' | 'g18Report'   // the guns a card's two slots offer, each its own report (game/gunlook.ts), and the pump gun's
  | 'beltCoverUp' | 'beltBoxOff' | 'beltBoxOn' | 'beltLay' | 'beltCoverDown' | 'chargeLmg' | 'shellIn' | 'boltDrop'   // how they are fed: a belt under a feed cover, shells one at a time (game/gunreload.ts)
  | 'chairRoll'   // a chair coasting on its castors (game/props.ts CASTOR): looped between ROLL_LOOP's two marks for as long as it rolls
  | 'fireBed' | 'fireCrack';   // an open fire (game/fire.ts): its low bed, looped between FIRE_LOOP's two marks for as long as it burns, and one crack of the wood

type Gen = (t: number, i: number, sr: number, rnd: () => number, state: Float32Array) => number;

// A VOICE NOT RENDERED YET (buildSfxLater, below). While `later` is up, a row of the table is not its samples but the call that makes them: every voice has a seed
// of its own and reads nothing of another's, so made in any order, at any time, each is sample for sample what buildSfx makes (tools/qa/sfxwarm-check.ts).
const LATER = Symbol('later');
let later = false;
function lazy(fn: () => SfxBuffer): SfxBuffer {
  if (!later) return fn();
  let b: SfxBuffer | null = null;
  const real = () => { if (!b) { const was = later; later = false; try { b = fn(); } finally { later = was; } } return b; };   // (rendered with `later` down: a voice built from another renders that one now)
  // (a row built FROM this one reads it like any buffer, and so renders it there and then: correct, only not left for later)
  return { get sampleRate() { return real().sampleRate; }, get length() { return real().length; }, get duration() { return real().duration; }, get numberOfChannels() { return real().numberOfChannels; },
    getChannelData: (c: number) => real().getChannelData(c), [LATER]: real } as unknown as SfxBuffer;
}
function render(ctx: SfxContext, dur: number, gen: Gen, seed = 1): SfxBuffer {
  if (only) return ctx.createBuffer(1, 1, ctx.sampleRate);
  return lazy(() => renderNow(ctx, dur, gen, seed));
}
function renderNow(ctx: SfxContext, dur: number, gen: Gen, seed: number): SfxBuffer {
  const sr = ctx.sampleRate; const n = Math.max(1, Math.floor(dur * sr));
  const buf = ctx.createBuffer(1, n, sr); const d = buf.getChannelData(0);
  let s = seed >>> 0 || 1; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
  const state = new Float32Array(16);
  for (let i = 0; i < n; i++) d[i] = gen(i / sr, i, sr, rnd, state);
  // gentle fade out to avoid clicks
  const f = Math.min(n, Math.floor(sr * 0.01)); for (let i = 0; i < f; i++) d[n - 1 - i] *= i / f;
  return buf;
}

// one-pole lowpass helper using state slot k
const lp = (x: number, st: Float32Array, k: number, a: number) => (st[k] += a * (x - st[k]));
const env = (t: number, a: number, d: number) => (t < a ? t / a : Math.exp(-(t - a) / d));
const TAU = Math.PI * 2;

// THE STRUCK, FIRED AND SPOKEN VOICES are built from audio/synth.ts's instruments (modes set ringing by a contact, a pressure front and the room's slaps behind it, a
// gated piezo, a throat) where the first table had a sine under a hiss: `make` runs one and sets its level. HEARD = how loud each of them is to the ear (synth.ts
// `heard`), kept from the table before they were redone — every gain in the game was set against those, so a redone voice sits where the old one sat in the mix.
// TWO ARE NOT: murmur is 0.052 where the old one measured 0.064, heldProtest 0.064 for 0.087 — the takedown's blow lost its sub-bass with the rest, and the two voices
// are kept the 12 and 10 dB under it that tools/qa/audio-render.ts asks for. WHAT THE YARDSTICK DOES NOT HOLD: it listens above 300 Hz, and the old hits were 80–98 % below 150 Hz, so on
// full-range speakers the redone ones carry 5–17 dB less wideband level (the same loudness in the mids, less thump under it).
// (The table as it was is audio/sfxWas.ts: the listening page's 'before' buttons, and the game under ?oldsounds. THE GAME PLAYS FROM IT THE VOICES PICKED AS BETTER BEFORE (sfxWas.ts `WAS_IN_GAME`), not the
// ones below — audio.ts `gameSfx`; ?newsounds = this table whole.)
export const HEARD: Partial<Record<SfxName, number>> = {
  pistolSuppressed: 0.11, pistolLoud: 0.291, carbineReport: 0.287, rifleSuppressed: 0.119, launcher: 0.087, dryFire: 0.094, magIn: 0.149, rack: 0.183, magDrop: 0.107, footHard: 0.111,
  click: 0.063, casingTink: 0.087, canisterBounce: 0.214, bulletImpact: 0.175, bodyHit: 0.071, bodyFall: 0.048, lightBreak: 0.181, glassCrack: 0.22, glassTinkle: 0.116, glassShatter: 0.279,
  lightOff: 0.059, deny: 0.059, doorCreak: 0.061, doorBang: 0.11, doorLatch: 0.098, doorBash: 0.117, doorRattle: 0.082, lockPick: 0.045, lockOpen: 0.125, lockBreak: 0.196, powerDown: 0.083,
  powerUp: 0.068, radio: 0.146, stunBang: 0.249, propThud: 0.102, propScrape: 0.05, chairRoll: 0.04, stairDoor: 0.128, stairBoots: 0.096, chokeStrain: 0.059, whipThud: 0.09, murmur: 0.052, heldProtest: 0.064, padBeep: 0.073,
  padOpen: 0.108, alarmChirp: 0.123, magOut: 0.096, equip: 0.062, nvOn: 0.119, nvOff: 0.124,
  // (the guns of the two slots and their feeding: no table before them to keep a level from — each set by hand against the four reports and the handling voices above:
  //  the two shotguns a little over the bare pistol, the belt gun and the Glock 18 a little under it (their rounds stack), the MP7 and the HK45 under every other gun)
  mk12Suppressed: 0.118, mp7Suppressed: 0.086, mk46Report: 0.268, m1014Report: 0.31, m870Report: 0.3, hk45Suppressed: 0.08, g18Report: 0.268,
  fireBed: 0.03, fireCrack: 0.075,   // (an open fire, game/fire.ts: set by hand under a footstep on a hard floor — the bed is a thing you notice when you stop, a crack turns no head)
  beltCoverUp: 0.09, beltBoxOff: 0.075, beltBoxOn: 0.11, beltLay: 0.09, beltCoverDown: 0.15, chargeLmg: 0.17, shellIn: 0.105, boltDrop: 0.18,
  // (the grab's three beats: no table before them either — set by hand against the hold's voices at the gains they are played at (0.5, 0.45, 0.4): the catch about
  //  as loud as the scuffle it stands in for and under the whip, the strip and the knock each under the catch. The takes he picked on 10-24 were made to these
  //  same numbers, so his picks changed the sounds and not the levels)
  grabCatch: 0.125, gunStrip: 0.1, gunDown: 0.095,
};
/** one voice: run, levelled to its HEARD number, and CUT WHERE IT ENDS (`dur` is room to work in — the mixer holds a voice's slot for its buffer's whole length, so a
 *  buffer does not carry silence behind the sound) */
function make(ctx: SfxContext, name: SfxName, dur: number, seed: number, fn: (v: Voice) => void): SfxBuffer {
  const as = HEARD[name]; if (as === undefined) throw new Error(`sfx: ${name} has no HEARD level`);
  if (only) { if (only !== name) return ctx.createBuffer(1, 1, ctx.sampleRate); hit = true; }
  return lazy(() => voiced(ctx, as, dur, seed, fn));
}
// ONE VOICE OF THE TABLE BY ITSELF, AND A VOICE MADE ANOTHER WAY (the replay page's sound lanes; nothing in the game calls either). `only` set = every other row of the
// table is an empty buffer; never set while the game's own table is built.
let only: SfxName | null = null, hit = false;
/** fn run under a Tune (audio/synth.ts TUNING), the hook put back after. With a layer muted or one heard alone the voice is first made whole to learn the scales its
 *  levelling used, then made again with those fixed — so a layer alone is as loud as it is in the mix. */
export function tuned<T>(tune: Tune, fn: () => T): T {
  const was = TUNING.on;
  try {
    if (tune.mute?.length || tune.solo !== undefined) {
      const dry: Tune = { seed: tune.seed, over: tune.over, norms: [] }; TUNING.on = dry; fn();
      const t2: Tune = { ...tune, fixedK: dry.levelK, fixedNorms: dry.norms }; TUNING.on = t2; const r = fn(); tune.wrote = t2.wrote; tune.levelK = dry.levelK; return r;
    }
    TUNING.on = tune; return fn();
  } finally { TUNING.on = was; }
}
/** one voice of the table, alone, as written or under a Tune; null for a row that is not built of the instruments (the old per-sample rows: nothing to tune in them).
 *  With no Tune, or one with nothing in it, the buffer is the table's own to the bit. */
export function buildOne(ctx: SfxContext, name: string, tune?: Tune): SfxBuffer | null {
  const run = (): SfxBuffer | null => { only = name as SfxName; hit = false; try { const b = buildSfx(ctx)[name as SfxName]; return hit ? b : null; } finally { only = null; } };
  return tune ? tuned(tune, run) : run();
}
/** `make` for a voice that is not a row of this table (audio/sfxAlt.ts's other takes): the level it is set to is handed in */
export function voiced(ctx: SfxContext, as: number, dur: number, seed: number, fn: (v: Voice) => void): SfxBuffer {
  if (TUNING.on) TUNING.on.wrote = seed;
  const v = new Voice(ctx.sampleRate, dur, TUNING.on?.seed ?? seed); fn(v); v.level(as);
  let n = v.n; while (n > 1 && Math.abs(v.out[n - 1]) < 2e-5) n--;
  n = Math.min(v.n, n + Math.floor(v.sr * 0.01));
  const f = Math.min(n, Math.floor(v.sr * 0.01)); for (let i = 0; i < f; i++) v.out[n - 1 - i] *= i / f;
  const buf = ctx.createBuffer(1, n, v.sr); buf.getChannelData(0).set(v.out.subarray(0, n)); return buf;
}
/** THE CHAIR'S ROLL IS ONE BUFFER FOR TWO USES. Looped between these two marks (seconds into the buffer) it has no seam: the mixer holds it there for as long as the
 *  chair coasts (audio.ts `follow`). Played once from its start — the listening page, the lanes' 'again' — it comes up over the first mark's length and dies away after
 *  the second. */
export const ROLL_LOOP = { start: 0.12, end: 2.12 };
/** the stretch of the open fire's bed that repeats while it burns (game/fire.ts): long, so that nothing in it is heard coming round */
export const FIRE_LOOP = { start: 0.12, end: 7.12 };
/** a steady take cut to that shape: the stretch between the marks is `raw` from 0.1 s with its first quarter second crossed (equal power) with what follows its end, so
 *  its last sample runs into its first; ahead of it the stretch's own tail coming up, after it the stretch's own head going down. A take too short for that (every other
 *  voice's build hands the table a one-sample buffer for this row: `only`) is handed back as it is. */
function rollLoop(ctx: SfxContext, raw: SfxBuffer, span: { start: number; end: number } = ROLL_LOOP): SfxBuffer {
  const sr = raw.sampleRate, x = raw.getChannelData(0);
  const h = Math.round(span.start * sr), N = Math.round(span.end * sr) - h, xf = Math.round(0.25 * sr), x0 = Math.round(0.1 * sr), tl = Math.round(0.35 * sr);
  if (x.length < x0 + N + xf) return raw;
  const S = new Float32Array(N);
  for (let i = 0; i < N; i++) { if (i >= xf) S[i] = x[x0 + i]; else { const w = i / xf; S[i] = x[x0 + i] * Math.sqrt(w) + x[x0 + N + i] * Math.sqrt(1 - w); } }
  const out = ctx.createBuffer(1, h + N + tl, sr), o = out.getChannelData(0);
  for (let i = 0; i < h; i++) o[i] = S[N - h + i] * (i / h);
  o.set(S, h);
  for (let i = 0; i < tl; i++) o[h + N + i] = S[i] * (1 - i / tl);
  return out;
}
/** something heavy and soft-edged landing on something big (a body on a floor, a leaf on its stop): a low push of air and the two or three modes of what took it */
export const thud = (v: Voice, at: number, f: number, t60: number, g: number, hi = 260, dst?: Float32Array): void => {
  v.hiss(at, f * 0.45, hi, 0.002, t60 * 0.5, g * 1.5, dst);
  v.ring(at, [[f, t60, 0.6], [f * 1.64, t60 * 0.75, 0.42], [f * 2.63, t60 * 0.5, 0.22]], 0.006, g * 0.7, 0, dst);
};
/** a part's modes drawn again: each a few dB up or down (and, with pct, a little off its pitch) — what makes the second bounce of a thing differ from the first */
export const vary = (v: Voice, m: readonly Mode[], db = 4, pct = 0): Mode[] => m.map(([f, t, g]): Mode => [f * (1 + pct * v.rnd()), t, g * Math.pow(10, db * v.rnd() / 20)]);
/** a contact with no note in it: a band of noise up in a third of a millisecond and gone in a few */
export const knock = (v: Voice, at: number, lo: number, hi: number, d: number, g: number, dst?: Float32Array): void => v.hiss(at, lo, hi, 0.0003, d, g, dst);
/** a body that is not a bell: n modes spread between lo and hi, none where a neighbour is, the high ones dying first */
export const cluster = (v: Voice, lo: number, hi: number, n: number, t60: number): Mode[] => {
  const out: Mode[] = [];
  for (let i = 0; i < n; i++) { const f = lo * Math.pow(hi / lo, (i + 0.5 + 0.4 * v.rnd()) / n); out.push([f, t60 * Math.sqrt(lo / f) * (1 + 0.3 * v.rnd()), (0.5 + 0.5 * v.u()) * Math.pow(lo / f, 0.3)]); }
  return out;
};
/** steel on steel: the contact, and the part's own short clatter under it */
export const clack = (v: Voice, at: number, lo: number, hi: number, t60: number, g: number, dst?: Float32Array): void => {
  knock(v, at, lo, hi, Math.min(0.008, t60 * 0.25), g, dst); v.ring(at, cluster(v, lo, hi, 9, t60), 0.0005, g * 0.4, 0.25, dst);
};
// the parts that are in more than one voice, each its own few modes [Hz, T60 s, weight]: a pistol's slide on its stop · a rifle's bolt home · a magazine catch · a
// door's latch bolt · a hollow-core door leaf · a solenoid's armature (a contactor, an electric strike) · a furnished room's lowest modes
export const SLIDE: Mode[] = [[1150, 0.025, 1], [2700, 0.018, 0.8], [4300, 0.012, 0.6], [6900, 0.008, 0.35]];
const BOLT: Mode[] = [[760, 0.035, 1], [1900, 0.025, 0.8], [3300, 0.015, 0.6], [5200, 0.009, 0.4]];
const LATCH: Mode[] = [[1250, 0.022, 1], [2150, 0.016, 0.8], [3400, 0.01, 0.6], [5100, 0.006, 0.4]];
const LEAF: Mode[] = [[78, 0.16, 0.6], [124, 0.13, 1], [187, 0.1, 0.9], [265, 0.07, 0.7], [390, 0.05, 0.5], [560, 0.035, 0.3]];
const STRIKE: Mode[] = [[310, 0.05, 1], [720, 0.035, 0.8], [1500, 0.022, 0.6], [2600, 0.012, 0.4], [4200, 0.007, 0.25]];
const ROOM: Mode[] = [[62, 0.18, 1], [87, 0.14, 0.8], [118, 0.1, 0.6]];
/** a boot on a hard floor: the heel (the floor's few modes under a tick), then the ball of the foot 85 ms behind it and the grit under it. No two alike. */
const boot = (v: Voice, at: number, g: number, bright = 1, dst?: Float32Array): void => {
  const j = 1 + 0.06 * v.rnd();
  v.ring(at, [[95 * j, 0.12, 0.3], [270 * j, 0.07, 1], [640 * j, 0.045, 0.6], [1150 * j, 0.03, 0.7 * bright], [2100 * j, 0.018, 0.4 * bright]], 0.0012, g * 0.8, 0.3, dst);
  v.hiss(at, 3000, 12000, 0.0001, 0.0015, 0.3 * g * bright, dst);
  v.hiss(at + 0.085, 60, 700, 0.004, 0.018, 0.55 * g, dst); v.hiss(at + 0.085, 2600, 4500, 0.006, 0.025, 0.12 * g * bright, dst);
};
/** every effect rendered into `ctx`'s buffers — a real BaseAudioContext on the page (AudioBuffers, nothing copied), the plain stand-in (audio/backend.ts sfxContext) on a host without one */
export function buildSfx(ctx: SfxContext): Record<SfxName, SfxBuffer> {
  // the wall charge's patter (wallDebris below): 60 bits of wall coming down, each its landing time, knock pitch, decay, level and how much grit is in it — thick in the
  // first half second and thinning for two, off a little generator of its own so the table is the same on every boot
  const bits: number[][] = []; { let s = 0x6d2b79f5; const u = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
    for (let k = 0; k < 60; k++) { const t = 0.07 + 2.25 * Math.pow(u(), 1.8); bits.push([t, 130 + 1100 * u() * u(), 0.006 + 0.04 * u(), (0.3 + 0.7 * u()) * (1 - 0.55 * t / 2.3), 0.25 + 0.75 * u()]); } }
  return {
    // ---- GUNS. A report is a pressure front (no tone in it), the muzzle's crack and the propellant's roar as bands of noise — most of it between 300 Hz and 2 kHz,
    //      where a real one's weight is — its first slaps off the floor and the walls a few milliseconds behind, the room's own low modes, and a tail that goes dark as it
    //      dies; the ACTION is steel stopping against steel. Sam's two are suppressed: gas through a can (the can's own two colours in it), and the action nearly as
    //      loud as the shot.
    // suppressed pistol: the can's short cough, then the slide — back against its stop 24 ms in, home 55 ms in
    pistolSuppressed: make(ctx, 'pistolSuppressed', 0.32, 11, v => {
      const d = v.layer();
      v.blast(0, 0.0008, 0.35, d);
      v.hiss(0, 900, 2600, 0.0004, 0.006, 1.6, d); v.hiss(0, 900, 2600, 0.0004, 0.035, 0.35, d);        // the gas: most of it gone in milliseconds, the rest leaking out
      v.hiss(0, 1320, 1700, 0.0004, 0.012, 0.8, d); v.hiss(0, 3080, 3760, 0.0004, 0.008, 0.5, d);       // the can
      v.hiss(0, 220, 800, 0.0004, 0.012, 1.2, d); v.ring(0, [[120, 0.07, 1]], 0.003, 0.65, 0, d);        // the chest of it
      v.slaps(d, [[3.1, 0.32, 7000], [7.4, -0.22, 5000], [14.2, 0.16, 3500], [23, -0.13, 2500]]);
      v.ring(0.024, SLIDE, 0.0006, 0.35, 0.7, d); v.ring(0.055, SLIDE, 0.0005, 0.55, 0.7, d); v.ring(0.055, [[410, 0.03, 1]], 0.002, 0.2, 0, d);
      v.add(peakTo(d)); v.drive(1.1);
    }),
    // unsuppressed 9 mm indoors: the front, the crack, the bark, eight slaps inside a tenth of a second, the room's low modes (air, not a note) and half a second of room
    pistolLoud: make(ctx, 'pistolLoud', 0.9, 23, v => {
      const d = v.layer();
      v.blast(0, 0.00035, 1.0, d); v.hiss(0, 400, 9000, 0.0002, 0.0035, 1.5, d); v.hiss(0, 3000, 14000, 0.0001, 0.002, 0.8, d);
      v.hiss(0, 500, 1800, 0.0003, 0.003, 2.0, d); v.hiss(0, 500, 1800, 0.0003, 0.018, 0.45, d);
      v.drive(1.5, peakTo(d));
      v.slaps(d, [[3.1, 0.55, 7000], [7.3, -0.45, 5500], [12.9, 0.38, 4200], [18.4, -0.3, 3400], [27, 0.24, 2600], [39, -0.18, 2000], [56, 0.14, 1600], [81, -0.1, 1300]]);
      v.ring(0, ROOM, 0.004, 0.14, 0, d); v.ring(0.024, SLIDE, 0.0006, 0.07, 0.7, d); v.ring(0.055, SLIDE, 0.0005, 0.09, 0.7, d);
      v.add(d); v.tail(0.01, [[90, 350, 0.5, 0.14], [350, 1800, 0.4, 0.2], [1800, 4500, 0.28, 0.14], [4500, 11000, 0.16, 0.08]], 0.012);
    }),
    // the guards' AKS-74U indoors: the round's own crack FIRST (it is supersonic), the muzzle's front 3 ms behind it and a second, fatter one behind that — the short
    // barrel's bark is that double front and a band of mids, never a note — ten slaps, the room's low modes, the bolt's clack under it and most of a second of the
    // building answering. Three of these 0.1 s apart overlap into the ripping sound of a burst; the mixer's propagation (occlusion low-pass, the routed doorway
    // source, the reverb send) turns one two rooms off into a muffled triple thump. Not louder to the FLOOR than the pistol (level 1, the 80 m gate) — louder in character.
    carbineReport: make(ctx, 'carbineReport', 1.25, 211, v => {
      const d = v.layer();
      v.hiss(0, 3000, 14000, 0.0001, 0.0012, 1.6, d);
      v.blast(0.003, 0.0005, 1.6, d); v.blast(0.005, 0.0012, 0.9, d); v.hiss(0.003, 1200, 12000, 0.0002, 0.003, 2.2, d);
      v.hiss(0.003, 350, 1400, 0.0003, 0.004, 1.5, d); v.hiss(0.003, 350, 1400, 0.0003, 0.025, 0.4, d); v.hiss(0.003, 1500, 5000, 0.0003, 0.007, 1.6, d); v.hiss(0.003, 360, 560, 0.0003, 0.018, 0.9, d);
      v.drive(1.8, peakTo(d));
      v.slaps(d, [[2.7, 0.6, 8000], [6.1, -0.5, 6000], [10.4, 0.42, 4800], [15.8, -0.36, 3800], [23, 0.3, 3000], [33, -0.24, 2400], [47, 0.19, 1900], [66, -0.15, 1500], [92, 0.11, 1200], [128, -0.08, 1000]]);
      v.ring(0.003, ROOM, 0.004, 0.24, 0, d); v.ring(0.051, BOLT, 0.0004, 0.1, 0.5, d);
      v.add(d); v.tail(0.012, [[70, 300, 0.7, 0.17], [300, 1500, 0.5, 0.2], [1500, 4500, 0.3, 0.2], [4500, 11000, 0.18, 0.09]], 0.015);
    }),
    // Sam's rifle: 5.56 through a suppressor is still a cough, not a bang — with a rifle's worth behind it: the round's crack off the walls, a deeper 'thup' through a
    // bigger can, the buffer bottoming 32 ms in and the bolt home at 68 (louder than the pistol's slide), and the gas leaking out of the can for a twentieth of a
    // second after. Level 1 to the floor like the pistol: the difference is character, and thirty of them a magazine on AUTO overlapping into a stuttering hiss.
    rifleSuppressed: make(ctx, 'rifleSuppressed', 0.5, 213, v => {
      const d = v.layer(), c = v.layer();
      v.hiss(0, 2500, 14000, 0.0001, 0.0015, 0.9, c); v.slaps(c, [[4.1, 0.5, 8000], [9.7, -0.32, 6000], [17, 0.2, 4500]]);
      v.blast(0.0005, 0.0006, 0.5, d);
      v.hiss(0, 700, 3200, 0.0004, 0.008, 1.6, d); v.hiss(0, 700, 3200, 0.0004, 0.06, 0.4, d);
      v.hiss(0, 950, 1270, 0.0004, 0.015, 0.8, d); v.hiss(0, 2350, 2880, 0.0004, 0.009, 0.5, d); v.hiss(0.012, 1400, 2800, 0.0003, 0.003, 0.3, d);
      v.hiss(0, 180, 700, 0.0004, 0.014, 1.0, d); v.ring(0, [[95, 0.09, 1]], 0.003, 0.6, 0, d);
      v.slaps(d, [[5, 0.25, 5000], [9.5, -0.18, 3500], [17, 0.13, 2600]]);
      v.ring(0.032, [[420, 0.03, 1], [980, 0.02, 0.7], [2100, 0.012, 0.4]], 0.001, 0.4, 0.3, d); v.ring(0.068, BOLT, 0.0004, 0.6, 0.5, d);
      v.add(c, 0.5); v.add(d); peakTo(v.out); v.drive(1.2);
    }),
    // ---- THE GUNS A CARD'S TWO SLOTS OFFER (game/gunlook.ts: each row's own voice, read with that switch on). FIRST TAKES, written blind: nobody has heard one.
    // Mk 12: the same 5.56 as the rifle above from eighteen inches of barrel through a longer can — the powder is burnt before the baffles get it, so less gas hisses
    // out and what is left is lower, rounder and longer: a 'thump' with a chest to it, both of the can's colours an octave-third down, the round's crack off the walls
    // a little later (it leaves faster), the rifle buffer bottoming 38 ms in and the bolt home at 82. One at a time, 0.3 s apart.
    mk12Suppressed: make(ctx, 'mk12Suppressed', 0.55, 3121, v => {
      const d = v.layer(), c = v.layer();
      v.hiss(0, 3000, 14000, 0.0001, 0.0013, 1.0, c); v.slaps(c, [[4.6, 0.5, 8000], [10.8, -0.34, 6000], [18.5, 0.22, 4500], [29, -0.12, 3200]]);
      v.blast(0.0005, 0.0009, 0.6, d);
      v.hiss(0, 450, 2000, 0.0006, 0.012, 1.6, d); v.hiss(0, 450, 2000, 0.0006, 0.085, 0.3, d);
      v.hiss(0, 640, 860, 0.0005, 0.022, 0.9, d); v.hiss(0, 1650, 2050, 0.0005, 0.012, 0.4, d);
      v.hiss(0, 120, 520, 0.0006, 0.022, 1.3, d); v.ring(0, [[72, 0.12, 1]], 0.004, 0.75, 0, d);
      v.slaps(d, [[5.5, 0.25, 4500], [10.5, -0.18, 3200], [19, 0.13, 2400]]);
      v.ring(0.038, [[330, 0.035, 1], [800, 0.024, 0.7], [1750, 0.014, 0.4]], 0.0012, 0.4, 0.3, d);
      v.ring(0.082, BOLT, 0.0005, 0.6, 0.5, d); v.ring(0.082, [[240, 0.03, 1]], 0.002, 0.25, 0, d);
      v.add(c, 0.45); v.add(d); peakTo(v.out); v.drive(1.15);
    }),
    // MP7: 4.6 mm through its can — the smallest, driest, highest of the long guns: a 'tk' with next to no chest (nothing under 350 Hz), the little round's crack
    // faint behind it, a small can's two high colours, and a light bolt back 14 ms in and home at 34. Fifteen a second (one every 4/60 s) overlap into a tight purr:
    // each round is over inside its own period but the leak of gas and a sixth of a second of room, which is the floor the string rides on. Not gunfire to the floor (level 0.8) and not meant to sound like it.
    mp7Suppressed: make(ctx, 'mp7Suppressed', 0.26, 3137, v => {
      const d = v.layer();
      v.hiss(0, 4000, 14000, 0.0001, 0.0009, 0.5, d);
      v.blast(0, 0.0005, 0.25, d);
      v.hiss(0, 1500, 4200, 0.0003, 0.004, 1.6, d); v.hiss(0, 1500, 4200, 0.0003, 0.03, 0.4, d);
      v.hiss(0, 2050, 2500, 0.0003, 0.008, 0.8, d); v.hiss(0, 4400, 5200, 0.0003, 0.005, 0.45, d);
      v.hiss(0, 350, 1000, 0.0004, 0.006, 0.6, d);
      v.slaps(d, [[3.4, 0.28, 8000], [8.1, -0.18, 6000], [15, 0.1, 4000]]);
      v.ring(0.014, [[1500, 0.012, 1], [3400, 0.009, 0.8], [5600, 0.006, 0.5]], 0.0005, 0.3, 0.6, d);
      v.ring(0.034, [[1250, 0.014, 1], [2900, 0.01, 0.8], [4700, 0.007, 0.6], [7400, 0.004, 0.3]], 0.0004, 0.5, 0.6, d);
      v.add(peakTo(d)); v.drive(1.05);
      v.tail(0.005, [[300, 1200, 0.2, 0.06], [1200, 3000, 0.14, 0.05], [3000, 6000, 0.07, 0.04]], 0.006);                          // what a room keeps of it: the floor a string of them never falls under
    }),
    // Mk 46: a bare 5.56 from a long barrel behind a flash hider — the round's crack and ONE hard front (no second fat one: the short rifle's fireball bark is not in
    // it), flatter and brighter — and the gun's own machinery in every round: the carrier against its buffer 24 ms in, a link falling free, the bolt home on the next
    // round at 56. Twelve a second (one every 5/60 s) overlap into a hammering chug; the room's tail is kept short and thin so a string of them does not stack into mud.
    mk46Report: make(ctx, 'mk46Report', 0.85, 3163, v => {
      const d = v.layer();
      v.hiss(0, 3500, 15000, 0.0001, 0.001, 1.1, d);
      v.blast(0.0035, 0.0004, 1.5, d); v.hiss(0.0035, 1500, 9000, 0.0002, 0.0025, 1.6, d);
      v.hiss(0.0035, 500, 1800, 0.0003, 0.003, 1.7, d); v.hiss(0.0035, 500, 1800, 0.0003, 0.016, 0.4, d); v.hiss(0.0035, 1800, 5500, 0.0003, 0.006, 1.5, d);
      v.drive(1.8, peakTo(d));
      v.slaps(d, [[2.9, 0.55, 8000], [6.4, -0.46, 6000], [11, 0.38, 4800], [16.5, -0.32, 3800], [24, 0.25, 3000], [35, -0.19, 2400], [50, 0.14, 1900], [70, -0.1, 1500]]);
      v.ring(0.0035, ROOM, 0.004, 0.16, 0, d);
      v.ring(0.024, [[520, 0.03, 1], [1300, 0.022, 0.8], [2500, 0.014, 0.5]], 0.0008, 0.16, 0.5, d); v.hiss(0.024, 150, 600, 0.001, 0.01, 0.2, d);
      knock(v, 0.03, 3500, 9000, 0.0012, 0.1, d); v.ring(0.034, [[4100, 0.01, 1], [6300, 0.007, 0.7], [8800, 0.004, 0.4]], 0.0003, 0.07, 0.3, d);
      v.ring(0.056, BOLT, 0.0004, 0.2, 0.5, d);
      v.add(d); v.tail(0.012, [[80, 300, 0.45, 0.13], [300, 1500, 0.35, 0.16], [1500, 4500, 0.22, 0.14], [4500, 11000, 0.12, 0.05]], 0.012);
    }),
    // M1014: twelve gauge from eighteen inches — the biggest, lowest, fattest report on the floor: two wide fronts (no rifle's crack: the shot is barely supersonic and
    // there is an ounce of it), a roar under a kilohertz, real weight under 200 Hz, nine slaps, the room's low modes pushed hard and a long tail that goes dark — then
    // the gas action: the bolt back 45 ms in and slamming home at 62.
    m1014Report: make(ctx, 'm1014Report', 1.5, 3181, v => {
      const d = v.layer();
      v.blast(0, 0.0016, 1.6, d); v.blast(0.002, 0.003, 1.0, d);
      v.hiss(0, 250, 5000, 0.0003, 0.006, 2.4, d); v.hiss(0, 2000, 9000, 0.0002, 0.003, 0.9, d);
      v.hiss(0, 180, 900, 0.0004, 0.008, 2.0, d); v.hiss(0, 180, 900, 0.0004, 0.045, 0.6, d);
      v.hiss(0, 60, 220, 0.001, 0.05, 0.9, d);
      v.drive(2.0, peakTo(d));
      v.slaps(d, [[3.3, 0.6, 6000], [7.6, -0.5, 4500], [13.4, 0.42, 3600], [19.6, -0.36, 2900], [29, 0.3, 2300], [42, -0.24, 1800], [60, 0.19, 1400], [86, -0.14, 1100], [120, 0.1, 900]]);
      v.ring(0, ROOM, 0.006, 0.3, 0, d); v.ring(0, [[44, 0.22, 1]], 0.006, 0.2, 0, d);
      v.ring(0.045, [[380, 0.04, 1], [900, 0.03, 0.8], [1900, 0.02, 0.5]], 0.001, 0.1, 0.4, d);
      clack(v, 0.062, 450, 3800, 0.03, 0.16, d); v.hiss(0.062, 120, 500, 0.001, 0.016, 0.14, d);
      v.add(d); v.tail(0.014, [[50, 250, 1.0, 0.18], [250, 1200, 0.7, 0.22], [1200, 4000, 0.36, 0.14], [4000, 10000, 0.18, 0.05]], 0.018);
    }),
    // the pump gun of the big slot: the same twelve gauge from a short breaching barrel — more bark (the powder still burning at the muzzle), a little less under
    // it — and NO action in the shot: a hand works it after. The fore-end hauled back along the tube (the bolt unlocking, the hull out) 0.30 s in, and run forward
    // to lock at 0.48: two heavy clacks, the hollow magazine tube rattling under each. The row's 0.9 s between shells has room for it.
    m870Report: make(ctx, 'm870Report', 1.3, 3187, v => {
      const d = v.layer(), TUBE: Mode[] = [[210, 0.06, 0.8], [470, 0.045, 1], [1150, 0.025, 0.5], [2300, 0.012, 0.25]];
      v.blast(0, 0.0013, 1.6, d); v.blast(0.0015, 0.0024, 0.9, d);
      v.hiss(0, 300, 6000, 0.0003, 0.006, 2.0, d); v.hiss(0, 1500, 9000, 0.0002, 0.004, 1.1, d);
      v.hiss(0, 220, 1100, 0.0004, 0.008, 1.9, d); v.hiss(0, 220, 1100, 0.0004, 0.035, 0.55, d);
      v.hiss(0, 70, 240, 0.001, 0.04, 1.2, d);
      v.drive(2.0, peakTo(d));
      v.slaps(d, [[3.3, 0.6, 6500], [7.6, -0.5, 5000], [13.4, 0.42, 3900], [19.6, -0.36, 3100], [29, 0.3, 2400], [42, -0.24, 1900], [60, 0.19, 1500], [86, -0.14, 1200], [120, 0.1, 950]]);
      v.ring(0, ROOM, 0.006, 0.32, 0, d);
      v.hiss(0.25, 900, 3600, 0.035, 0.012, 0.05, d); clack(v, 0.3, 380, 3600, 0.03, 0.2, d); v.ring(0.3, TUBE, 0.0015, 0.07, 0, d); v.hiss(0.3, 110, 480, 0.001, 0.016, 0.12, d);
      knock(v, 0.335, 1400, 4200, 0.003, 0.06, d);                                                        // the hull leaving
      v.hiss(0.43, 900, 3600, 0.035, 0.01, 0.05, d); clack(v, 0.48, 320, 4200, 0.034, 0.26, d); v.ring(0.48, vary(v, TUBE, 3, 0.03), 0.0015, 0.08, 0, d); v.hiss(0.48, 100, 450, 0.001, 0.018, 0.16, d);
      v.add(d); v.tail(0.014, [[55, 250, 0.9, 0.2], [250, 1200, 0.65, 0.2], [1200, 4000, 0.36, 0.15], [4000, 10000, 0.18, 0.06]], 0.018);
    }),
    // HK45: a subsonic .45 through a big can — no crack at all (nothing breaks the sound barrier), a soft low 'pff' with a thud under it, softer at its onset and
    // lower in both of the can's colours than the pistol at the top of this table — and then mostly the slide, which is nearly as loud as the shot: a heavier one,
    // back 30 ms in and home at 68. The quietest gun there is.
    hk45Suppressed: make(ctx, 'hk45Suppressed', 0.32, 3203, v => {
      const d = v.layer(), SL45: Mode[] = [[880, 0.03, 1], [2100, 0.022, 0.8], [3500, 0.014, 0.6], [5600, 0.009, 0.3]];
      v.blast(0, 0.0014, 0.3, d);
      v.hiss(0, 500, 1700, 0.0006, 0.009, 1.5, d); v.hiss(0, 500, 1700, 0.0006, 0.05, 0.3, d);
      v.hiss(0, 800, 1050, 0.0006, 0.016, 0.8, d); v.hiss(0, 1900, 2350, 0.0006, 0.01, 0.4, d);
      v.hiss(0, 130, 520, 0.0006, 0.018, 1.3, d); v.ring(0, [[88, 0.09, 1]], 0.004, 0.7, 0, d);
      v.slaps(d, [[3.1, 0.26, 5000], [7.4, -0.18, 3600], [14.2, 0.12, 2600]]);
      v.ring(0.03, SL45, 0.0007, 0.55, 0.7, d); v.ring(0.068, SL45, 0.0006, 0.8, 0.7, d); v.ring(0.068, [[330, 0.035, 1]], 0.002, 0.3, 0, d);
      v.add(peakTo(d)); v.drive(1.05);
    }),
    // Glock 18: the bare 9 mm of this table with everything that stacks cut short — twenty a second (one every 3/60 s) have to overlap into a ripping snarl, so the
    // room is six slaps and a quarter second of tail, its low modes halved; the crack and the bark are whole, the compensator's cuts spit a band of their own, and
    // the slide is a light fast one: back 12 ms in, home at 30.
    g18Report: make(ctx, 'g18Report', 0.5, 3217, v => {
      const d = v.layer();
      v.blast(0, 0.00035, 1.0, d); v.hiss(0, 400, 9000, 0.0002, 0.003, 1.5, d); v.hiss(0, 3000, 14000, 0.0001, 0.002, 0.9, d);
      v.hiss(0, 550, 2000, 0.0003, 0.003, 2.0, d); v.hiss(0, 550, 2000, 0.0003, 0.012, 0.4, d);
      v.hiss(0, 2400, 5200, 0.0002, 0.004, 0.6, d);
      v.drive(1.5, peakTo(d));
      v.slaps(d, [[3.1, 0.55, 7000], [7.3, -0.45, 5500], [12.9, 0.36, 4200], [18.4, -0.27, 3400], [27, 0.19, 2600], [39, -0.12, 2000]]);
      v.ring(0, ROOM, 0.004, 0.08, 0, d); v.ring(0.012, SLIDE, 0.0005, 0.09, 0.7, d); v.ring(0.03, SLIDE, 0.0004, 0.13, 0.7, d);
      v.add(d); v.tail(0.008, [[90, 350, 0.28, 0.08], [350, 1800, 0.24, 0.13], [1800, 4500, 0.16, 0.1], [4500, 11000, 0.09, 0.06]], 0.008);
    }),
    // the launcher under the fore-end (launcher.ts; slowed, the 40 mm): the pin, the round uncorking, the tube's own air column knocked once — a 'thoonk', dead in a
    // twentieth of a second — and a puff of propellant. Near silent: a 'prop' event at 0.45, not gunfire
    launcher: make(ctx, 'launcher', 0.32, 217, v => {
      v.ring(0, [[1900, 0.008, 0.5], [3600, 0.005, 0.4]], 0.0004, 0.3, 0.6);
      v.blast(0.004, 0.0006, 0.5); v.hiss(0.004, 600, 1500, 0.0005, 0.004, 0.6);
      v.ring(0.004, [[430, 0.045, 1], [1290, 0.025, 0.35], [2150, 0.015, 0.15]], 0.003, 0.9);
      v.hiss(0.006, 150, 600, 0.002, 0.03, 0.6); v.hiss(0.008, 500, 1600, 0.002, 0.025, 0.3);
    }),
    // ---- HANDLING: small steel and polymer parts. Each click is the part's own handful of modes (the high ones gone first) and the knock of the gun it is in.
    // the striker falling on nothing: two hits a millisecond and a half apart (the striker, then the frame taking it)
    dryFire: make(ctx, 'dryFire', 0.08, 3, v => { const m: Mode[] = [[700, 0.012, 0.6], [1900, 0.01, 1], [3600, 0.007, 0.8], [5800, 0.004, 0.5]]; v.ring(0, m, 0.0004, 0.6, 0.6); v.ring(0.0015, m, 0.0004, 0.45, 0.4); v.hiss(0, 300, 1500, 0.0004, 0.006, 0.3); }),
    // a switch: over, and the softer tick of it settling
    click: make(ctx, 'click', 0.05, 43, v => { const m: Mode[] = [[900, 0.006, 0.6], [2400, 0.005, 1], [4100, 0.004, 0.8], [7200, 0.0025, 0.5]]; v.ring(0, m, 0.0003, 0.7, 0.6); v.ring(0.03, m, 0.0003, 0.25, 0.5); }),
    // the magazine out: the catch, the body sliding down the well, and its lip popping clear
    magOut: make(ctx, 'magOut', 0.25, 5, v => {
      v.ring(0, [[2100, 0.008, 1], [3800, 0.006, 0.8], [6200, 0.004, 0.5]], 0.0003, 0.5, 0.5); v.hiss(0.05, 1200, 2500, 0.03, 0.03, 0.22);
      v.ring(0.16, [[700, 0.025, 1], [1900, 0.008, 0.5]], 0.001, 0.6, 0.3);
    }),
    // HIS PICK (10-13, 'new 2' of the takes): the magazine run up the well, seated, and a tug on it to be sure — contacts as short bands of noise, no note left ringing
    magIn: make(ctx, 'magIn', 0.32, 9122, v => {
      v.hiss(0, 600, 3000, 0.018, 0.018, 0.4);
      clack(v, 0.05, 500, 3600, 0.016, 0.7); v.hiss(0.05, 100, 600, 0.002, 0.016, 0.5);
      knock(v, 0.055, 2600, 7000, 0.001, 0.45);
      knock(v, 0.17, 600, 2600, 0.004, 0.35); v.ring(0.17, cluster(v, 500, 2400, 6, 0.018), 0.001, 0.14);   // the tug: it rocks on its catch
      knock(v, 0.19, 900, 3000, 0.003, 0.2);
    }),
    // HIS PICK (10-13, 'new 2'): a pistol slide, slingshot — hauled back over its rails, let go, home
    rack: make(ctx, 'rack', 0.26, 9132, v => {
      v.hiss(0, 1500, 6000, 0.01, 0.012, 0.3);                                                          // the hand on the serrations
      for (let k = 0; k < 4; k++) v.hiss(0.012 + k * 0.009, 1200, 5200, 0.002, 0.005, 0.3);
      clack(v, 0.05, 900, 6000, 0.014, 0.75);
      v.hiss(0.062, 1500, 6000, 0.016, 0.006, 0.3);
      clack(v, 0.088, 600, 6000, 0.02, 1.0); v.hiss(0.088, 140, 520, 0.001, 0.014, 0.55);               // the barrel locks up
    }),
    // a loaded polymer magazine on a hard floor. HIS FLAG (10-13): "sounds kinda hollow, high pitched" — it was five notes between 620 Hz and 4 kHz left ringing. Now its
    // weight on the floor, the polymer's clack with no note in it, a body dead inside two hundredths of a second, the rounds shifting in it; three bounces and it lies flat
    magDrop: make(ctx, 'magDrop', 0.45, 17, v => {
      const hits = [0, 0.15, 0.225, 0.262];
      for (let k = 0; k < hits.length; k++) { const a = Math.pow(0.5, k), at = hits[k];
        v.hiss(at, 110, 520, 0.0008, 0.014, 0.6 * a); knock(v, at, 500, 2600, 0.004, 0.6 * a);
        v.ring(at, cluster(v, 320, 1500, 6, 0.016), 0.0012, 0.3 * a);
        if (k < 2) knock(v, at + 0.004 + 0.003 * v.u(), 1800, 5000, 0.0015, 0.1 * a); }
      v.hiss(0.262, 200, 1400, 0.004, 0.02, 0.2);
    }),
    // ---- A BELT UNDER A FEED COVER, SHELLS ONE AT A TIME (game/gunreload.ts plays these by name). FIRST TAKES, written blind: nobody has heard one.
    // the feed cover up: its two latches pressed (two ticks a hundredth apart), the cover swung up on its hinge with the feed pawls hanging loose in it, and the
    // hollow sheet-steel knock of it stopping upright
    beltCoverUp: make(ctx, 'beltCoverUp', 0.42, 3229, v => {
      v.ring(0, LATCH, 0.0005, 0.7, 0.6); v.ring(0.014, vary(v, LATCH, 3, 0.04), 0.0005, 0.55, 0.6); v.hiss(0, 150, 700, 0.001, 0.012, 0.3);
      v.hiss(0.05, 700, 3200, 0.05, 0.05, 0.16);
      for (let k = 0; k < 3; k++) knock(v, 0.09 + 0.035 * k + 0.01 * v.u(), 2500, 7000, 0.0012, 0.12);
      clack(v, 0.24, 400, 2800, 0.05, 0.6); v.hiss(0.24, 120, 500, 0.001, 0.018, 0.35);
    }),
    // the empty belt box off: nylon rasping over the hand, its clip let go of the rail under the receiver, the little weight of it coming away, and the last few
    // loose links of the old belt ticking off the tray
    beltBoxOff: make(ctx, 'beltBoxOff', 0.46, 3251, v => {
      v.hiss(0, 800, 4500, 0.05, 0.04, 0.3);
      knock(v, 0.1, 900, 3500, 0.003, 0.7); v.ring(0.1, cluster(v, 700, 2800, 6, 0.014), 0.0008, 0.2); v.hiss(0.1, 100, 450, 0.002, 0.016, 0.4);
      v.hiss(0.14, 600, 3000, 0.03, 0.05, 0.2);
      for (let k = 0; k < 4; k++) { const at = 0.2 + 0.05 * k + 0.02 * v.u(), f = 3800 + 2600 * v.u(); v.ring(at, [[f, 0.012, 1], [f * 1.43, 0.008, 0.6], [f * 2.2, 0.005, 0.3]], 0.0003, 0.22 * Math.pow(0.8, k), 0.4); }
    }),
    // a full one on: slid along the rail, the clip snapping over — heavier, a hundred rounds' weight stopping against the gun and the belt shifting inside the box
    beltBoxOn: make(ctx, 'beltBoxOn', 0.5, 3253, v => {
      v.hiss(0, 500, 2600, 0.06, 0.03, 0.3);
      clack(v, 0.13, 500, 3200, 0.02, 0.9); v.hiss(0.13, 80, 400, 0.002, 0.022, 0.8);
      knock(v, 0.136, 2400, 6000, 0.001, 0.3);
      for (let k = 0; k < 6; k++) knock(v, 0.17 + 0.03 * k + 0.012 * v.u(), 500 + 400 * v.u(), 2200, 0.004, 0.2 * Math.pow(0.78, k));
      v.hiss(0.17, 150, 900, 0.01, 0.06, 0.15);
    }),
    // the belt laid in: its first rounds drawn across the feed tray — links and brass on steel, eight small contacts in a third of a second, no two alike — and the
    // first round pressed against the cartridge stop
    beltLay: make(ctx, 'beltLay', 0.55, 3257, v => {
      v.hiss(0, 900, 4000, 0.04, 0.08, 0.14);
      for (let k = 0; k < 8; k++) { const at = 0.02 + 0.04 * k + 0.014 * v.u(), f = 2600 + 3200 * v.u(), a = 0.5 + 0.5 * v.u();
        v.ring(at, [[f, 0.02, 1], [f * 1.012, 0.02, 0.8], [f * 1.9, 0.01, 0.4]], 0.0004, 0.3 * a, 0.4); knock(v, at, 800, 3000, 0.002, 0.3 * a); }
      knock(v, 0.38, 600, 3200, 0.004, 0.8); v.ring(0.38, cluster(v, 500, 3000, 7, 0.02), 0.0008, 0.25); v.hiss(0.38, 140, 600, 0.001, 0.014, 0.3);
    }),
    // the cover slapped shut with the flat of the hand: the loudest of them — a flat heavy clack with weight under it, both latches catching a hundredth behind,
    // the belt's hanging end rattling once
    beltCoverDown: make(ctx, 'beltCoverDown', 0.32, 3259, v => {
      v.hiss(0, 200, 1500, 0.003, 0.006, 0.4);                                                           // the palm on it
      knock(v, 0.006, 300, 5000, 0.006, 1.0); v.ring(0.006, cluster(v, 350, 3000, 10, 0.03), 0.0006, 0.45, 0.2); v.hiss(0.006, 90, 450, 0.001, 0.02, 0.8);
      v.ring(0.016, LATCH, 0.0004, 0.5, 0.6); v.ring(0.021, vary(v, LATCH, 3, 0.04), 0.0004, 0.4, 0.6);
      for (let k = 0; k < 3; k++) { const f = 3400 + 2400 * v.u(); v.ring(0.06 + 0.035 * k, [[f, 0.012, 1], [f * 1.5, 0.007, 0.5]], 0.0003, 0.1 * Math.pow(0.6, k), 0.3); }
    }),
    // the cocking handle: hauled back against a heavy spring — the scrape rising as it loads — to its stop, then run forward home (the bolt stays back: it fires
    // from there)
    chargeLmg: make(ctx, 'chargeLmg', 0.5, 3271, v => {
      v.hiss(0, 600, 3500, 0.12, 0.012, 0.35); v.hiss(0.03, 180, 700, 0.09, 0.02, 0.2);
      clack(v, 0.16, 350, 3600, 0.03, 1.0); v.hiss(0.16, 100, 480, 0.001, 0.02, 0.7); v.ring(0.16, [[260, 0.05, 1], [610, 0.035, 0.6]], 0.002, 0.2);
      v.hiss(0.25, 800, 4000, 0.06, 0.01, 0.25);
      clack(v, 0.34, 700, 5000, 0.018, 0.6); v.hiss(0.34, 150, 600, 0.001, 0.012, 0.3);
    }),
    // one shell thumbed into the tube: the plastic hull pushed against the shell latch, past it (a click), and stopping on the one ahead with the hollow tube and its
    // spring under it. Played once a shell, a third of a second apart: one buffer, so the caller deals each play's rate (0.94‥1.06, off the shell's place in the tube: gunreload.ts shellRate) and no two neighbours are the same.
    shellIn: make(ctx, 'shellIn', 0.24, 3299, v => {
      v.hiss(0, 900, 3500, 0.03, 0.012, 0.3); v.hiss(0, 150, 600, 0.02, 0.02, 0.2);
      v.ring(0.055, [[1050, 0.02, 1], [1900, 0.014, 0.8], [3100, 0.009, 0.5]], 0.0005, 0.6, 0.6);
      clack(v, 0.085, 420, 3000, 0.02, 0.8); v.hiss(0.085, 110, 500, 0.001, 0.018, 0.5);
      v.ring(0.085, [[190, 0.07, 0.8], [430, 0.05, 1], [980, 0.03, 0.5]], 0.002, 0.25);
      v.hiss(0.1, 1200, 3200, 0.004, 0.02, 0.1);                                                          // the spring taking it up
    }),
    // the bolt release hit with the thumb and a heavy bolt run home on a shell: the button's tick, the shell scraped out of the lifter and up the ramp, and the slam —
    // the lowest, heaviest clack in the handling voices
    boltDrop: make(ctx, 'boltDrop', 0.32, 3301, v => {
      v.ring(0, [[1700, 0.008, 1], [3200, 0.006, 0.7]], 0.0004, 0.25, 0.5);
      v.hiss(0.008, 900, 4200, 0.004, 0.01, 0.3);
      clack(v, 0.034, 300, 4200, 0.035, 1.0); v.hiss(0.034, 100, 500, 0.001, 0.02, 0.8);
      v.ring(0.034, [[560, 0.04, 1], [1400, 0.028, 0.8], [2500, 0.016, 0.5], [3900, 0.01, 0.3]], 0.0005, 0.4, 0.3);
      v.hiss(0.05, 1400, 3600, 0.003, 0.03, 0.08);                                                        // the recoil spring singing after it
    }),
    // holster / sling: cloth over the gun, the retention snapping, a swivel's tick
    equip: make(ctx, 'equip', 0.2, 83, v => {
      v.hiss(0, 1500, 4000, 0.04, 0.03, 0.3); v.ring(0.08, [[900, 0.012, 1], [1700, 0.009, 0.8], [3100, 0.005, 0.6]], 0.0005, 0.8, 0.4);
      v.ring(0.12, [[2600, 0.006, 1], [4400, 0.004, 0.6]], 0.0003, 0.12, 0.5);
    }),
    // HIS PICK (10-13, 'new 1'): a boot on a hard floor, heel then sole, no ring in it (`boot` below is still the stair door's boots)
    footHard: make(ctx, 'footHard', 0.22, 9141, v => {
      const j = 1 + 0.08 * v.rnd();
      v.hiss(0, 70 * j, 900 * j, 0.0008, 0.011, 1.0); v.hiss(0, 900, 3200, 0.0005, 0.004, 0.35); knock(v, 0, 3000, 9000, 0.0008, 0.12);
      v.ring(0, [[82 * j, 0.06, 1], [141 * j, 0.04, 0.5]], 0.004, 0.25);                                // the slab under it
      v.hiss(0.07 + 0.01 * v.u(), 120, 1500, 0.006, 0.02, 0.5); v.hiss(0.075, 2200, 6500, 0.012, 0.03, 0.09);
    }),
    // a spent case on lino (game/particleFx.ts casingFx): brass rings high and inharmonic, every mode a close PAIR beating against itself, and each hop wakes a
    // different mix of them — four hops, smaller and closer. Played quiet: it is the detail under the report, not an event (and not one the guards hear: the shot was)
    casingTink: make(ctx, 'casingTink', 0.3, 71, v => {
      const at = [0, 0.1, 0.16, 0.195], amp = [1, 0.45, 0.22, 0.12];
      for (let k = 0; k < 4; k++) { const o = k & 1; v.ring(at[k], [[5100, 0.11, o ? 0.3 : 1], [5170, 0.1, o ? 0.25 : 0.8], [8300, 0.07, o ? 0.5 : 0.6], [8410, 0.065, o ? 0.45 : 0.5], [12400, 0.04, o ? 0.6 : 0.3]], 0.0002, amp[k], 0.5); }
    }),
    // a canister off the floor: a FILLED steel can says 'tonk' — six short modes, none a multiple of another, all gone in a twentieth of a second — on the thud of what
    // it landed on, the fuze head's lever ticking, and the rim touching down again
    canisterBounce: make(ctx, 'canisterBounce', 0.4, 53, v => {
      const can: Mode[] = [[480, 0.045, 0.7], [830, 0.06, 1], [1270, 0.04, 0.8], [1900, 0.028, 0.6], [2850, 0.018, 0.4], [4300, 0.01, 0.25]];
      v.ring(0, can, 0.0004, 0.9, 0.5); v.ring(0, [[150, 0.06, 1]], 0.004, 0.36); v.hiss(0, 120, 700, 0.0008, 0.012, 0.3);
      v.ring(0.012, [[3300, 0.006, 1], [5600, 0.004, 0.6]], 0.0003, 0.14, 0.6); v.ring(0.11, vary(v, can, 5), 0.0004, 0.25, 0.5);
    }),
    // a round into a wall: the crack of it, the thwack of what it went into, a low knock, and the bits it threw landing over a tenth of a second (no falling whistle)
    bulletImpact: make(ctx, 'bulletImpact', 0.25, 59, v => {
      v.hiss(0, 1500, 10000, 0.0003, 0.004, 1.0); v.hiss(0, 200, 2200, 0.0008, 0.022, 0.9); v.hiss(0, 80, 300, 0.001, 0.03, 0.5);
      for (let k = 0; k < 6; k++) { const at = 0.012 + v.u() * 0.11, lo = 1000 + 3000 * v.u(); v.hiss(at, lo, lo + 4000 + 4000 * v.u(), 0.0005, 0.004 + 0.006 * v.u(), 0.25 * (1 - at / 0.14)); }
    }),
    // ---- BODIES AND FURNITURE: soft weight on a floor. No note under any of them: the slap of the contact (a few hundred hertz, dead at once), the floor's own few
    //      low modes under it, cloth.
    bodyHit: make(ctx, 'bodyHit', 0.25, 61, v => { v.hiss(0, 90, 300, 0.002, 0.03, 3.2); v.hiss(0, 250, 800, 0.001, 0.012, 1.4); v.hiss(0, 1200, 2700, 0.0005, 0.005, 0.6); v.hiss(0, 3000, 9000, 0.0003, 0.003, 0.25); v.ring(0, [[110, 0.08, 1]], 0.003, 0.5); }),
    // knees first (one, then the other), the trunk a third of a second on, a shoulder and the head a beat behind it, and his kit settling
    bodyFall: make(ctx, 'bodyFall', 0.9, 67, v => {
      const floor: Mode[] = [[48, 0.15, 1], [73, 0.12, 0.8], [105, 0.1, 0.6], [160, 0.08, 0.4]];
      const land = (at: number, g: number) => { v.ring(at, vary(v, floor, 4), 0.01, g * 0.3); v.hiss(at, 280, 900, 0.002, 0.02, 0.9 * g); v.hiss(at, 1600, 4000, 0.01, 0.06, 0.15 * g); };
      land(0, 0.45); land(0.025, 0.35); land(0.32, 1); land(0.4, 0.5); v.ring(0.44, [[300, 0.04, 1], [700, 0.025, 0.6]], 0.002, 0.3);
      for (let k = 0; k < 4; k++) v.ring(0.33 + 0.19 * v.u(), [[2200 + 1500 * v.u(), 0.01, 1], [5200, 0.006, 0.5]], 0.0004, 0.08, 0.5);
    }),
    // furniture knocked. HIS FLAG (10-13): "a bit jank, doesn't seem natural" — it was a hollow box of six notes, and the same box again a tenth of a second on. Now one
    // bump: the thing's weight stopping, a broad soft-edged contact, panels that are dead in a twentieth of a second, and it settling back on its feet
    // (played at different rates per kind: cardboard low and dull, a steel bin bright)
    propThud: make(ctx, 'propThud', 0.3, 149, v => {
      thud(v, 0, 95, 0.06, 0.8, 240); v.hiss(0, 140, 1100, 0.0015, 0.016, 0.9);
      v.ring(0, cluster(v, 150, 900, 7, 0.05), 0.003, 0.35); v.hiss(0.004, 900, 3200, 0.001, 0.006, 0.18);
      v.hiss(0.05, 200, 900, 0.01, 0.03, 0.1);
    }),
    // the pistol-whip landing behind his ear: the blow going through him (low, dead), a short dull knock with no ring to it (bone, not wood), the frame meeting it with
    // the slide's steel answering for a few milliseconds, and his collar going over as the head does — the loudest thing a hold makes
    whipThud: make(ctx, 'whipThud', 0.34, 191, v => {
      thud(v, 0, 62, 0.09, 1.1, 200); v.ring(0, [[330, 0.035, 0.5], [545, 0.028, 0.3], [900, 0.015, 0.18]], 0.0015, 0.6);
      v.ring(0, SLIDE, 0.0004, 0.2, 0.8); v.hiss(0.04, 500, 3000, 0.01, 0.07, 0.3); v.drive(1.0);
    }),
    // ---- DOORS AND LOCKS. A leaf is a big hollow panel: a slam is its half dozen modes between 80 and 560 Hz, the rebate's slap, the latch a beat behind and the leaf
    //      bouncing in its frame; a hinge creaks by sticking and slipping — impulses, never a tone — against the same few resonances every time.
    // a door opened: the latch drawn back, the leaf leaving its seal, the hinge letting go in two or three short runs, the air the leaf moves
    doorCreak: make(ctx, 'doorCreak', 0.7, 107, v => {
      v.ring(0, LATCH, 0.0006, 0.5, 0.5); v.ring(0.04, [[124, 0.13, 1], [187, 0.1, 0.9]], 0.006, 0.25);
      const x = v.layer(), h = v.layer(), sr = v.sr;
      for (const [b0, len] of [[0.08, 0.14], [0.27, 0.11], [0.44, 0.13]]) { let t = b0;
        for (;;) { const u = (t - b0) / len; if (u >= 1) break; t += (1 + 0.25 * v.rnd()) / (35 + 55 * Math.sin(Math.PI * u)); const i = Math.floor(t * sr); if (i < x.length) x[i] += -Math.log(1 - 0.98 * v.u()) * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, u))); } }
      for (const [f, q, g] of [[620, 3.4, 1], [1340, 5.5, 0.7], [2280, 6.2, 0.5], [3650, 6.6, 0.3]]) v.add(biquad(x.slice(), sr, 'bp', f, q), g, h);
      v.add(peakTo(h, 0.22)); v.hiss(0.05, 60, 400, 0.25, 0.12, 0.03);
    }),
    doorBang: make(ctx, 'doorBang', 0.8, 109, v => {
      const d = v.layer();
      v.ring(0, LEAF, 0.0025, 0.9, 0, d); v.ring(0, [[68, 0.15, 1]], 0.004, 0.15, 0, d); v.hiss(0, 700, 1700, 0.0005, 0.005, 1.1, d); v.hiss(0, 250, 900, 0.001, 0.012, 0.8, d); v.hiss(0, 30, 200, 0.008, 0.03, 0.1, d);
      v.ring(0.022, LATCH, 0.0006, 0.35, 0.5, d);
      for (const [at, g] of [[0.045, 0.32], [0.08, 0.16], [0.105, 0.08]]) v.ring(at, vary(v, LEAF, 5), 0.0025, g, 0, d);
      v.slaps(d, [[4, 0.3, 4000], [9, -0.22, 3000], [16, 0.15, 2200]]); v.add(d); v.tail(0.01, [[80, 400, 0.3, 0.1], [400, 2000, 0.2, 0.06]]);
    }),
    // the latch: the bolt riding up the strike's lip, across it, and snapping home into the keep (the leaf's board answering)
    doorLatch: make(ctx, 'doorLatch', 0.16, 113, v => {
      v.ring(0, LATCH, 0.0006, 0.4, 0.5); v.hiss(0.004, 2000, 5000, 0.01, 0.012, 0.08);
      v.ring(0.045, vary(v, LATCH, 3), 0.0006, 1, 0.5); v.ring(0.045, [[180, 0.06, 1], [310, 0.05, 1], [520, 0.04, 1]], 0.002, 0.4);
    }),
    // kicked open: the boot on the skin, the leaf's whole weight going, the latch tearing past its keep, the frame ticking, and the leaf coming off its stop
    doorBash: make(ctx, 'doorBash', 0.9, 127, v => {
      const d = v.layer();
      v.ring(0, LEAF.map(([f, t, g]): Mode => [f, t * 1.2, g]), 0.008, 1.0, 0, d); v.ring(0, [[68, 0.18, 1]], 0.008, 0.5, 0, d);
      v.hiss(0, 250, 1200, 0.002, 0.02, 0.9, d); v.hiss(0, 1500, 6000, 0.0005, 0.006, 0.35, d);
      v.ring(0.018, LATCH, 0.0006, 0.45, 0.5, d); v.ring(0.06, vary(v, LATCH, 4), 0.0006, 0.25, 0.5, d);
      for (let k = 0; k < 4; k++) v.ring(0.03 + 0.12 * v.u(), [[1800 + 1400 * v.u(), 0.01, 1], [4200, 0.006, 0.5]], 0.0004, 0.12, 0.5, d);
      v.ring(0.19, vary(v, LEAF, 5), 0.004, 0.3, 0, d);
      v.slaps(d, [[4, 0.3, 4000], [9, -0.22, 3000], [16, 0.15, 2200]]); v.add(d); v.tail(0.01, [[60, 400, 0.35, 0.14], [400, 2500, 0.22, 0.08]]);
    }),
    // locks: the lever tried against a thrown bolt (the latch knocking in its keep and the leaf in its frame, four times, never the same twice), one click of a pick
    // working the pins (a tick and a whisper of scrape), the plug going over (its pins ticking) and the bolt drawing back with a clunk, and the keep splintering out
    // of the jamb under a boot (wood letting go splinter by splinter over a low thump, the strike plate ringing off the jamb and then the floor) — that one plays
    // under doorBash
    doorRattle: make(ctx, 'doorRattle', 0.32, 151, v => {
      const taps = [0, 0.062, 0.105, 0.19], amp = [1, 0.7, 0.85, 0.4];
      for (let k = 0; k < taps.length; k++) { v.ring(taps[k], vary(v, LATCH, 5), 0.0006, 0.6 * amp[k], 0.5); v.ring(taps[k], vary(v, [[124, 0.13, 1], [187, 0.1, 0.9], [265, 0.07, 0.7]], 4), 0.003, 0.28 * amp[k]); }
    }),
    lockPick: make(ctx, 'lockPick', 0.14, 157, v => { v.ring(0, [[1400, 0.006, 0.6], [3200, 0.004, 1], [5600, 0.003, 0.7], [8300, 0.002, 0.4]], 0.0003, 0.35, 0.7); v.hiss(0.03, 1500, 5000, 0.004, 0.03, 0.1); }),
    lockOpen: make(ctx, 'lockOpen', 0.3, 163, v => {
      v.hiss(0, 1900, 3200, 0.005, 0.02, 0.15); for (let k = 0; k < 7; k++) v.ring(0.004 + k * 0.008 + 0.002 * v.u(), [[3100, 0.003, 1], [5200, 0.002, 0.6]], 0.0002, 0.12 + 0.08 * v.u(), 0.5);
      v.ring(0.07, [[240, 0.06, 1], [410, 0.045, 0.8], [760, 0.03, 0.6], [1350, 0.018, 0.45], [2300, 0.01, 0.3]], 0.001, 1.0, 0.4);
    }),
    // HIS FLAG (10-13): "the high pitched end of this sounds weird" — from a tenth of a second on it was two rings between 2.7 and 7.3 kHz (the strike plate as a bell).
    // Now the end is the plate bent out on its screws (a dull clack, nothing left to ring), the jamb settling, and a piece of it on the floor
    lockBreak: make(ctx, 'lockBreak', 0.5, 167, v => {
      v.hiss(0, 400, 7000, 0.0004, 0.012, 0.8); thud(v, 0, 150, 0.09, 0.9, 350);
      for (let k = 0; k < 7; k++) { const q = (k * 0.6180339) % 1; v.hiss(0.012 + q * 0.16, 700 + 300 * (k % 3), 5200 - 2600 * q, 0.0003, 0.006 + (k % 2) * 0.005, 0.35 - 0.15 * q); }   // splinters, duller as they go
      clack(v, 0.085, 450, 2400, 0.03, 0.4); v.hiss(0.1, 250, 1800, 0.01, 0.07, 0.18);
      knock(v, 0.23, 350, 1900, 0.006, 0.22); knock(v, 0.262, 500, 2400, 0.004, 0.1);
      v.drive(1.2);
    }),
    // ---- the response team's way in (game/qrf.ts): the west stair door — a steel fire door on a crash bar — thrown open against its stop in a bare concrete stairwell,
    //      and the boots coming up that stairwell heard through it just before. The door: the bar's two clacks, the leaf off the stop, the steel skin ringing (ten
    //      modes between 68 Hz and 1.5 kHz, each with a twin a hundredth above it: sheet steel beats), the stairwell's flutter and most of a second of it throwing
    //      the sound back. Also played, pitched up and quieter, under a boot that rings off it (doors.ts 'clang').
    stairDoor: make(ctx, 'stairDoor', 1.3, 223, v => {
      const d = v.layer(), bar: Mode[] = [[640, 0.06, 1], [1480, 0.04, 0.8], [2350, 0.03, 0.6], [3900, 0.015, 0.35]];
      v.ring(0, bar, 0.0008, 0.4, 0.5, d); v.ring(0.018, vary(v, bar, 4), 0.0008, 0.3, 0.5, d);
      const f = [68, 112, 171, 236, 318, 437, 590, 810, 1120, 1540], t60 = [0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.08], skin: Mode[] = [];
      for (let k = 0; k < f.length; k++) { const a = (1 - 0.06 * k) * (0.6 + 0.4 * v.u()); skin.push([f[k], t60[k], a], [f[k] * (1.007 + 0.008 * v.u()), t60[k] * 0.9, a * 0.7]); }
      v.ring(0.02, skin, 0.0012, 1.0, 0, d); v.ring(0.02, [[58, 0.2, 1]], 0.005, 0.5, 0, d); v.hiss(0.02, 400, 3000, 0.0005, 0.006, 0.4, d);
      v.slaps(d, [[7, 0.7, 5000], [14, -0.5, 4200], [21, 0.35, 3400], [28, -0.25, 2700], [35, 0.18, 2000]]); v.add(d);
      v.tail(0.03, [[60, 300, 1.4, 0.2], [300, 1200, 1.1, 0.14], [1200, 4000, 0.4, 0.05]], 0.04);
    }),
    // nine heavy footfalls on concrete treads over two and a half seconds, two men's worth out of step (the same boot as footHard, no two alike), getting nearer
    // (louder, brighter), the stairwell slapping each one back — muffled at the source by whoever plays it through a shut steel door
    stairBoots: make(ctx, 'stairBoots', 2.7, 227, v => {
      const steps = [0.05, 0.36, 0.7, 0.98, 1.31, 1.6, 1.94, 2.22, 2.5], d = v.layer();
      for (let k = 0; k < steps.length; k++) { const near = 0.45 + 0.55 * (k / (steps.length - 1)); boot(v, steps[k], near, 0.4 + 0.6 * near, d); }
      v.slaps(d, [[6, 0.4, 5000], [13, -0.3, 3500], [21, 0.22, 2500], [34, -0.15, 1800]]); v.add(d);
      for (let k = 0; k < steps.length; k++) { const near = 0.45 + 0.55 * (k / (steps.length - 1)); v.tail(steps[k] + 0.01, [[100, 600, 0.6, 0.1 * near], [600, 2500, 0.4, 0.05 * near]], 0.01); }
    }),
    // ---- GLASS AND LAMPS. Glass rings sharp and never as a chord: every ping is its own two or three modes, the upper ones gone first.
    // a tube or a bulb shot out: the pop of it (it was under vacuum), the pieces ringing as they land for a third of a second, the dust
    lightBreak: make(ctx, 'lightBreak', 0.7, 71, v => {
      v.blast(0, 0.0005, 0.5); v.hiss(0, 600, 1400, 0.0005, 0.006, 0.7); v.hiss(0, 2000, 9000, 0.0003, 0.004, 0.5);
      for (let k = 0; k < 9; k++) { const f = 3200 + ((k * 977) % 2600), d = 0.07 + (k % 3) * 0.04; v.ring(0.01 + ((k * 0.6180339) % 1) * 0.35, [[f, d, 0.6], [f * 1.593, d * 0.7, 0.3], [f * 2.37, d * 0.5, 0.12]], 0.0003, 0.18, 0.4); }
      v.hiss(0.02, 2500, 11000, 0.02, 0.2, 0.05);
    }),
    // a round into laminated glazing (game/glass.ts glassHit): the smack of the impact — a hard broadband tick with the pane's own short knock under it — then a short
    // bright crackle as the star runs out from the hole (a dozen tiny pings over 0.2 s, thinning) and a whisper of falling grit. No crash: the pane holds.
    glassCrack: make(ctx, 'glassCrack', 0.45, 151, v => {
      v.hiss(0, 800, 14000, 0.0002, 0.006, 1.0); v.hiss(0, 150, 2500, 0.0006, 0.02, 0.6); v.ring(0, [[190, 0.04, 1], [420, 0.025, 0.6], [900, 0.012, 0.4]], 0.001, 0.3);
      for (let k = 0; k < 12; k++) { const f = 3100 + ((k * 1237) % 5200), d = 0.035 + (k % 3) * 0.025; v.ring(0.004 + ((k * 0.6180339) % 1) ** 1.4 * 0.2, [[f, d, 0.6], [f * 1.47, d * 0.7, 0.3]], 0.0002, 0.13 - 0.007 * k, 0.5); }
      v.hiss(0.02, 3000, 12000, 0.02, 0.12, 0.05); v.drive(1.4);
    }),
    // BROKEN GLASS after it lets go (game/shards.ts). glassTinkle: three pieces landing on a hard floor — each its own four modes, and each BOUNCING: the same piece
    // heard again at the same pitches, sooner and quieter each time, a click at every touch. Played at rate 0.55‥1.4 by size.
    glassTinkle: make(ctx, 'glassTinkle', 0.5, 157, v => {
      const R = [1, 1.5, 2.5, 3.8], T = [0.04, 0.025, 0.015, 0.009];
      for (const [f1, t0, g0] of [[2900, 0, 0.6], [4700, 0.035, 0.45], [7300, 0.09, 0.35]]) { const fs = R.map(r => f1 * r * (1 + 0.08 * v.rnd())); let at = t0, gap = 0.07 + 0.05 * v.u(), g = g0;   // (the smallest piece's top mode is past hearing: ring leaves it out)
        for (let b = 0; b < 4 && at < 0.46; b++) { v.ring(at, fs.map((f, k): Mode => [f, T[k], (0.4 + 0.6 * v.u()) * (1 - 0.15 * k)]), 0.0002, g, 0.6); at += gap; gap *= 0.45; g *= 0.45; } }
      v.hiss(0, 2500, 12000, 0.001, 0.04, 0.04);
    }),
    // glassShatter: a plate breaking on the floor / a tempered pane's dice coming down — the crack of the break, then a DENSE fall of pings thinning over most of a second
    // (thirty of them, the late ones quieter: the small pieces land last and ring least) on a hiss of grit running out across the floor.
    glassShatter: make(ctx, 'glassShatter', 1.1, 163, v => {
      v.hiss(0, 500, 14000, 0.0002, 0.015, 0.9); v.hiss(0, 200, 3000, 0.0008, 0.04, 0.7);
      for (let k = 0; k < 30; k++) { const f = 2900 + ((k * 1319) % 6100), d = 0.04 + (k % 4) * 0.02; v.ring(0.006 + ((k * 0.6180339) % 1) ** 1.8 * 0.75, [[f, d, 0.6], [f * 1.61, d * 0.7, 0.3]], 0.0002, 0.2 - 0.004 * k, 0.5); }
      v.hiss(0.03, 3000, 13000, 0.03, 0.3, 0.07); v.drive(1.5);
    }),
    // ---- ELECTRICS. A piezo is a square wave switched on and off through a small disc (2.7 kHz: the one every keypad and beeper has); mains hum does not change pitch
    //      when the power goes, the FANS do.
    // a light put out (the OCP on it; a torch dying): the relay letting go, the ballast's tick behind it, the arc's last few half-cycles
    lightOff: make(ctx, 'lightOff', 0.2, 73, v => {
      v.ring(0, [[650, 0.015, 0.8], [1500, 0.01, 1], [2800, 0.006, 0.7], [4600, 0.003, 0.4]], 0.0005, 0.6, 0.6); v.ring(0.025, [[900, 0.01, 1], [2100, 0.006, 0.7]], 0.0005, 0.2, 0.5);
      const x = v.layer(); for (let i = 0; i < x.length; i++) { const t = i / v.sr; x[i] = v.nz() * (Math.abs(Math.sin(Math.PI * 100 * t + 0.4)) > 0.8 ? 1 : 0) * env(t, 0.002, 0.035); }
      v.add(band(x, v.sr, 300, 5000), 0.2);
    }),
    // 'no': a switch, and two short pips from a beeper driven off its own note (thin, flat) — the OCP not charged, nothing to use it on, a keypad refusing a code
    deny: make(ctx, 'deny', 0.25, 79, v => { v.ring(0, [[900, 0.006, 0.6], [2400, 0.005, 1], [4100, 0.004, 0.8]], 0.0003, 0.3, 0.5); v.piezo(0.012, 0.035, 1900, 1, 2730, 8); v.piezo(0.087, 0.035, 1900, 1, 2730, 8); }),
    // devices (game/devices.ts). A keypad key: the key bottoming on the pad and its beeper for 55 ms. The pad taking the code: two beeps (the same beeper: it has one
    // note), then the electric strike letting go and buzzing while it is held. A tripwire reporting: the emitter's two-tone chirp (2.4 / 3.1 kHz alternating at
    // 18 Hz) for a third of a second, steady and then cut; it is a tell for the player standing at it, the floor hears the radio, not this.
    padBeep: make(ctx, 'padBeep', 0.08, 227, v => { v.ring(0, [[450, 0.015, 1], [1100, 0.01, 0.7], [2300, 0.006, 0.4]], 0.002, 0.3); v.piezo(0.01, 0.055, 2730, 1, 2730, 8); }),
    padOpen: make(ctx, 'padOpen', 0.32, 229, v => {
      v.piezo(0, 0.045, 2730, 0.7, 2730, 8); v.piezo(0.09, 0.045, 2730, 0.7, 2730, 8); v.ring(0.17, STRIKE, 0.001, 1.6, 0.4);
      const x = v.layer(), sr = v.sr; for (let i = Math.floor(0.175 * sr); i < Math.floor(0.31 * sr); i++) { const t = i / sr; x[i] = (Math.abs(Math.sin(TAU * 50 * t)) - 0.64) * Math.min(1, (t - 0.175) / 0.002, (0.31 - t) / 0.004); }
      v.add(peakTo(biquad(x, sr, 'bp', 600, 1), 0.2));
    }),
    alarmChirp: make(ctx, 'alarmChirp', 0.36, 233, v => v.piezo(0, 0.33, t => (Math.floor(t * 18) & 1) ? 3100 : 2400, 1, 2900, 6)),
    // a net line: the squelch opening with a pop, a quarter second of open carrier, and the squelch tail's crash cut dead — all of it through a handset's small
    // speaker (350 Hz to 3.4 kHz, a peak at 2.2, overdriven). No voice in it: the line is on the strip
    radio: make(ctx, 'radio', 0.35, 101, v => {
      const x = v.layer(), sr = v.sr;
      v.blast(0, 0.0004, 0.6, x); v.hiss(0, 400, 3400, 0.0005, 0.012, 0.5, x);
      for (let i = 0; i < x.length; i++) { const t = i / sr; if (t > 0.008 && t < 0.23) x[i] += v.nz() * 0.06; else if (t >= 0.23 && t < 0.33) x[i] += v.nz() * 0.9 * Math.min(1, (t - 0.23) / 0.001, (0.33 - t) / 0.001); }
      biquad(x, sr, 'hp', 350); biquad(x, sr, 'lp', 3400); const pk = biquad(x.slice(), sr, 'bp', 2200, 2.5);
      for (let i = 0; i < x.length; i++) x[i] = Math.tanh((x[i] + pk[i]) * 5); v.add(x);
    }),
    // mains: the contactor's clack, then everything that was running on the floor running DOWN — the fans' rush falling away while the transformers' hum (its pitch
    // the mains', steady) just stops / the same coming back, with the tubes' starters plinking
    powerDown: make(ctx, 'powerDown', 1.6, 131, v => {
      v.ring(0, STRIKE, 0.001, 1.2, 0.4); v.ring(0, [[70, 0.12, 1]], 0.005, 0.5);
      v.gen((t, sr, rnd, st) => { const f = 2 * Math.sin(Math.PI * (150 + 750 * Math.exp(-t * 2.2)) / sr); st[0] += f * st[1]; st[1] += f * (rnd() - st[0] - 0.66 * st[1]); return st[1] * 0.3 * Math.exp(-t / 0.6) * Math.min(1, t / 0.01); });
      v.gen(t => (Math.sin(TAU * 100 * t + 0.7) * 0.6 + Math.sin(TAU * 200 * t + 2.1) * 0.3 + Math.sin(TAU * 300 * t + 0.3) * 0.15) * Math.exp(-t / 0.02) * 0.25);
    }),
    powerUp: make(ctx, 'powerUp', 1.8, 137, v => {
      v.ring(0, vary(v, STRIKE, 3), 0.001, 1.1, 0.4); v.ring(0, [[62, 0.12, 1]], 0.005, 0.5);
      v.gen((t, sr, rnd, st) => { const f = 2 * Math.sin(Math.PI * (150 + 650 * (1 - Math.exp(-t * 2.2))) / sr); st[0] += f * st[1]; st[1] += f * (rnd() - st[0] - 0.66 * st[1]); return st[1] * 0.25 * Math.min(1, t / 0.4) * Math.exp(-Math.max(0, t - 1) / 0.5); });
      v.gen(t => (Math.sin(TAU * 100 * t + 1.1) * 0.5 + Math.sin(TAU * 200 * t + 0.2) * 0.35 + Math.sin(TAU * 300 * t + 2.6) * 0.12) * Math.min(1, t / 0.03) * Math.exp(-Math.max(0, t - 0.3) / 0.9) * 0.2);
      v.ring(0.9, [[1700, 0.025, 1], [2900, 0.015, 0.7], [4400, 0.008, 0.4]], 0.0003, 0.3, 0.6); v.ring(1.25, [[1850, 0.025, 1], [3100, 0.015, 0.7], [4700, 0.008, 0.4]], 0.0003, 0.22, 0.6);
    }),
    // stun canister indoors: the front of it (a big one: a millisecond and a half through zero), the crack, the roar, the slaps off every wall, the room's lowest
    // modes (felt: air, not a note), the building answering — two dozen things around the room knocked once each over the next half second — and most of a second
    // of tail going dark. The can itself barely rings. Driven hard: it is meant to be the loudest thing in the building. (Slowed, it is the frag.)
    stunBang: make(ctx, 'stunBang', 1.5, 139, v => {
      const d = v.layer();
      v.hiss(0, 4000, 16000, 0.0001, 0.0008, 1.2, d); v.blast(0, 0.0016, 1.2, d);
      v.hiss(0, 300, 8000, 0.0002, 0.008, 2.6, d); v.hiss(0, 200, 2500, 0.0005, 0.045, 1.2, d);
      v.drive(2.2, peakTo(d)); v.ring(0, [[1180, 0.06, 0.5], [2210, 0.05, 0.3], [3470, 0.035, 0.2]], 0.0006, 0.03, 0, d);
      v.slaps(d, [[2.3, 0.6, 9000], [5.2, -0.52, 7000], [8.8, 0.45, 5500], [13.5, -0.4, 4500], [20, 0.33, 3600], [29, -0.27, 2900], [41, 0.22, 2300], [58, -0.17, 1800], [82, 0.13, 1400], [115, -0.1, 1100], [160, 0.07, 900]]);
      v.ring(0, [[34, 0.5, 1], [52, 0.4, 0.9], [71, 0.3, 0.7], [96, 0.25, 0.5]], 0.006, 0.3, 0, d);
      for (let k = 0; k < 25; k++) v.ring(0.04 + 0.36 * v.u(), [[300 + 2200 * v.u() * v.u(), 0.015 + 0.025 * v.u(), 1]], 0.001, 0.04, 0.3, d);
      v.add(d); v.tail(0.015, [[50, 250, 0.9, 0.2], [250, 1000, 0.6, 0.34], [1000, 3500, 0.4, 0.24], [3500, 10000, 0.22, 0.12]], 0.02);
    }),
    // ---- THROATS (the hold's three; no words in any of them — stand-ins for voices, kept low). Pulses through formants, each cycle a little off the last.
    // the choke, while the arm is closed: ONE GRAIN of strain, 0.62 s — pressed, creaky voice near 75 Hz (the folds apart a quarter of each cycle, no two cycles
    // alike) with the air forced past the forearm in it, under a slow tremor, a wet click or two; an 80 ms rise and a 220 ms fall so grains retriggered every 0.4 s
    // (player.ts CHOKE_GRAIN) run into one strained sound, and letting go of Space just lets the last one die — nothing to stop
    chokeStrain: make(ctx, 'chokeStrain', 0.62, 179, v => {
      v.throat(0, 0.62, t => 74 + 9 * Math.sin(TAU * 2.1 * t), t => Math.min(1, t / 0.08) * Math.min(1, (0.62 - t) / 0.22) * (0.66 + 0.34 * Math.sin(TAU * 6.2 * t + 1)),
        () => [[700, 150, 1], [1250, 200, 0.5], [2600, 300, 0.2]], { open: 0.25, jitter: 0.12, shimmer: 0.25, breath: 0.5 });
      biquad(v.out, v.sr, 'lp', 2600); const pk = v.out.reduce((m, y) => Math.max(m, Math.abs(y)), 1e-9);
      v.ring(0.17, [[1200, 0.008, 1]], 0.0005, 0.05 * pk); v.ring(0.41, [[1350, 0.008, 1]], 0.0005, 0.04 * pk);
    }),
    // Sam's question, under his breath by the man's ear: three breathy syllables a quarter of a second in all — a whisper (air through a mouth that moves, a
    // consonant's tick at the front of each) with a thread of voice near 105 Hz falling a tone over the phrase, the middle syllable leaned on.
    murmur: make(ctx, 'murmur', 0.3, 197, v => {
      const syl = [[0, 0.075, 0.8], [0.09, 0.085, 1.0], [0.19, 0.09, 0.7]];
      v.throat(0, 0.3, t => 105 - 57 * t, t => { let a = 0; for (const [s0, len, w] of syl) { const u = (t - s0) / len; if (u > 0 && u < 1) a += Math.sin(Math.PI * u) ** 2 * w; } return a; },
        t => t < 0.085 ? [[500, 110, 1], [1500, 160, 0.5], [2500, 220, 0.2]] : t < 0.185 ? [[650, 120, 1], [1100, 150, 0.55], [2450, 220, 0.2]] : [[350, 110, 1], [950, 160, 0.45], [2300, 220, 0.18]],
        { open: 0.68, breath: 0.9, voice: 0.35, jitter: 0.015 });
      const pk = v.out.reduce((m, y) => Math.max(m, Math.abs(y)), 1e-9); for (const [s0] of syl) v.hiss(s0, 2500, 5000, 0.003, 0.006, 0.04 * pk);
      biquad(v.out, v.sr, 'lp', 3000);
    }),
    // the man's side of it, muffled under the forearm: two syllables of closed-mouth voice ('mm-MMh') — through the nose (one low formant, next to nothing above
    // it) and an arm, the pitch up and over in alarm rather than stating anything. It starts 0.3 s INTO the buffer: played with Sam's murmur it answers it; played
    // as the hold locks it is his first sound in the arm.
    heldProtest: make(ctx, 'heldProtest', 0.82, 199, v => {
      const syl = [[0, 0.13, 0.7], [0.16, 0.24, 1.0]];
      v.throat(0.3, 0.5, t => 118 + 45 * Math.sin(Math.PI * Math.min(1, t / 0.34)), t => { let a = 0; for (const [s0, len, w] of syl) { const u = (t - s0) / len; if (u > 0 && u < 1) a += Math.pow(Math.sin(Math.PI * u), 1.2) * w; } return a; },
        () => [[270, 80, 1], [1100, 150, 0.125], [2200, 200, 0.03]], { open: 0.4, jitter: 0.025, shimmer: 0.1, breath: 0.06 });
      biquad(v.out, v.sr, 'lp', 900);
    }),
    // the goggles (the Chaos Theory whine, electronic by intent): the mount over its detent, the tube's whine climbing and HOLDING where it gets to / falling away
    nvOn: make(ctx, 'nvOn', 0.9, 37, v => {
      v.gen(t => { const f0 = 500, f1 = 5200, k = Math.log(f1 / f0) / 0.8, ph = TAU * (t < 0.8 ? f0 * (Math.exp(k * t) - 1) / k : f0 * (Math.exp(k * 0.8) - 1) / k + f1 * (t - 0.8)); return Math.sin(ph) * env(t, 0.02, 0.5) * 0.22 + Math.sin(ph * 0.5) * env(t, 0.02, 0.4) * 0.08; });
      v.ring(0, [[800, 0.015, 1], [1900, 0.01, 0.7], [3400, 0.006, 0.4]], 0.0008, 0.1, 0.4);
    }),
    nvOff: make(ctx, 'nvOff', 0.5, 41, v => {
      v.gen(t => { const f0 = 3000, f1 = 200, k = Math.log(f1 / f0) / 0.45, ph = TAU * (t < 0.45 ? f0 * (Math.exp(k * t) - 1) / k : f0 * (Math.exp(k * 0.45) - 1) / k + f1 * (t - 0.45)); return Math.sin(ph) * env(t, 0.005, 0.2) * 0.2; });
      v.ring(0, [[800, 0.015, 1], [1900, 0.01, 0.7], [3400, 0.006, 0.4]], 0.0008, 0.09, 0.4);
    }),
    // ---- the voices that are what they were: air, cloth, grit, and the few that are electronic or music by intent. TWO OF THEM WERE TOUCHED where they stand (no
    //      HEARD row: their gains are their own): glassCrunch's grit is band-passed where it was a bare high-pass, earRing's tones sit up where ears ring.
    footSoft: render(ctx, 0.18, (t, _i, _sr, rnd, st) => lp(rnd(), st, 0, 0.04) * env(t, 0.004, 0.05) * 1.6 + lp(rnd(), st, 1, 0.3) * env(t, 0.001, 0.015) * 0.15, 19),
    // OCP: capacitor whine-thump
    ocp: render(ctx, 0.45, (t) => {
      const f = 2400 * Math.exp(-t * 9) + 180; const ph = TAU * (2400 / -9 * Math.exp(-t * 9) + 180 * t);
      return (Math.sin(ph) * (0.5 + 0.5 * Math.sin(TAU * 90 * t))) * env(t, 0.002, 0.12) * 0.7 + Math.sin(TAU * 60 * t) * env(t, 0.005, 0.1) * 0.5 + (f > 0 ? 0 : 0);
    }, 31),
    throw: render(ctx, 0.35, (t, _i, _sr, rnd, st) => lp(rnd(), st, 0, 0.03 + 0.25 * Math.sin(Math.PI * Math.min(1, t / 0.3))) * Math.sin(Math.PI * Math.min(1, t / 0.32)) * 0.5, 47),
    // glassCrunch: a boot coming down on glass litter — no ring at all: a short gritty double crackle (heel, then the ball of the foot) of band-passed noise bursts with a
    // dozen clicks in it, and a soft low press under it.
    glassCrunch: render(ctx, 0.32, (t, _i, _sr, rnd, st) => {
      const g1 = env(t, 0.004, 0.035), t2 = t - 0.09, g2 = t2 > 0 ? env(t2, 0.006, 0.05) * 0.8 : 0;
      const nz = rnd(); const hp = lp(nz - lp(nz, st, 0, 0.35), st, 2, 0.55);
      let out = hp * (g1 + g2) * 1.34 + lp(rnd(), st, 1, 0.04) * (g1 + g2) * 0.5;
      for (let k = 0; k < 12; k++) { const th = t - ((k * 0.6180339) % 1) * 0.2; if (th < 0 || th > 0.004) continue; out += rnd() * 0.5 * (1 - th / 0.004); }
      return Math.tanh(out * 1.6) * 0.7;
    }, 167),
    smokePop: render(ctx, 0.6, (t, _i, _sr, rnd, st) => rnd() * env(t, 0.0005, 0.015) * 0.7 + lp(rnd(), st, 0, 0.08) * env(t, 0.002, 0.06) * 0.7 + lp(rnd(), st, 1, 0.3) * env(t, 0.05, 0.4) * 0.25, 89),
    // reverse-swell + hit for the alert transition
    alertSting: render(ctx, 1.6, (t, _i, _sr, rnd, st) => {
      const rise = t < 0.7 ? lp(rnd(), st, 0, 0.02 + 0.5 * (t / 0.7) ** 3) * Math.pow(t / 0.7, 3) * 0.7 : 0;
      const th = t - 0.7; const hit = th >= 0 ? (Math.sin(TAU * (48 * th + 4 * Math.exp(-th * 6))) * env(th, 0.002, 0.35) * 1.1 + lp(rnd(), st, 1, 0.2) * env(th, 0.001, 0.15) * 0.7 + Math.sin(TAU * 587 * th) * env(th, 0.005, 0.5) * 0.12 + Math.sin(TAU * 622 * th) * env(th, 0.005, 0.6) * 0.1) : 0;
      return Math.tanh((rise + hit) * 1.2) * 0.9;
    }, 97),
    // what the player's ears do about it when it goes off in sight: a thin whistle (two tones a few hertz apart up where ears ring, so it wavers) that swells in as the bang decays and takes a couple of seconds to clear
    earRing: render(ctx, 2.6, (t) => (Math.sin(TAU * 4810 * t) + Math.sin(TAU * 4817 * t + 1) * 0.7 + Math.sin(TAU * 6290 * t + 2) * 0.35) * Math.min(1, t / 0.18) * Math.exp(-t / 1.1) * 0.078, 149),
    // loose furniture set going. HIS FLAG (10-13): "seems jank, maybe it should just be a single scrape? didn't match the chair getting pushed" — it was a hiss chopped
    // square by a stick-slip chatter over a judder. Now ONE scrape: the drag swelling as the thing starts to move and tailing off as it stops, the grit on top, its weight
    // through the floor, a few uneven catches and no beat (played at different rates per kind; the body drag and a sleeve on a wall play it too)
    propScrape: make(ctx, 'propScrape', 0.42, 139, v => {
      v.hiss(0, 220, 1700, 0.05, 0.11, 1.0); v.hiss(0, 1700, 4200, 0.03, 0.06, 0.1); v.hiss(0.01, 80, 300, 0.03, 0.09, 0.8);
      for (let k = 0; k < 5; k++) knock(v, 0.03 + 0.045 * k + 0.012 * v.u(), 400, 1800, 0.004, 0.12 * (1 - k / 6));
    }),
    // a chair coasting on its castors over a hard floor: the wheels' low rumble breathing a little, the tyres' band, grit, the bearings' small uneven ticks and now and
    // then the stem rattling in its socket. STEADY from end to end (the bands' fall is two hundred seconds): `rollLoop` cuts it to the loop.
    chairRoll: lazy(() => rollLoop(ctx, make(ctx, 'chairRoll', 2.6, 211, v => {
      const r = v.layer(); v.hiss(0, 60, 340, 0.03, 200, 1.0, r);
      for (let i = 0; i < r.length; i++) { const t = i / v.sr; r[i] *= 1 + 0.2 * Math.sin(19.5 * t) + 0.12 * Math.sin(48.4 * t + 1.3); }
      v.add(r);
      v.hiss(0, 380, 1500, 0.03, 200, 0.3); v.hiss(0, 1800, 5200, 0.03, 200, 0.06);
      for (let t = 0.01; t < 2.58; t += 0.022 + 0.05 * v.u()) knock(v, t, 900, 3200, 0.0015 + 0.0015 * v.u(), 0.035 + 0.05 * v.u());
      for (let t = 0.15; t < 2.5; t += 0.28 + 0.3 * v.u()) knock(v, t, 500, 1500, 0.006, 0.07 + 0.07 * v.u());
    }))),
    // an open fire in a drum (game/fire.ts): the bed — the draught's low breath, the flames' flutter over it, the wood ticking now and then — STEADY from end to end and cut to its
    // own long loop (FIRE_LOOP); and one crack of the wood: a hard snap, the split's two or three smaller ones behind it, a little of the drum's own ring
    fireBed: lazy(() => rollLoop(ctx, make(ctx, 'fireBed', 7.6, 223, v => {
      const r = v.layer(); v.hiss(0, 45, 260, 0.03, 200, 1.0, r);
      for (let i = 0; i < r.length; i++) { const t = i / v.sr; r[i] *= 1 + 0.3 * Math.sin(5.9 * t) + 0.22 * Math.sin(13.7 * t + 0.8) + 0.12 * Math.sin(31.0 * t + 2.1); }
      v.add(r);
      const m = v.layer(); v.hiss(0, 300, 1300, 0.03, 200, 0.42, m);
      for (let i = 0; i < m.length; i++) { const t = i / v.sr; m[i] *= 0.55 + 0.45 * Math.sin(8.3 * t + 1.1) * Math.sin(21.0 * t); }
      v.add(m);
      v.hiss(0, 1500, 4200, 0.03, 200, 0.05);
      for (let t = 0.05; t < 7.55; t += 0.08 + 0.5 * v.u()) knock(v, t, 1800, 6500, 0.001 + 0.002 * v.u(), 0.02 + 0.06 * v.u() * v.u());
    }), FIRE_LOOP)),
    fireCrack: make(ctx, 'fireCrack', 0.3, 227, v => {
      knock(v, 0.002, 1400, 7000, 0.004, 1.0); knock(v, 0.003, 500, 1600, 0.012, 0.5);
      for (let k = 0; k < 3; k++) knock(v, 0.025 + 0.03 * k + 0.02 * v.u(), 2200, 8000, 0.002, 0.3 * (1 - k / 4) * (0.5 + v.u()));
      v.ring(0.002, [[410, 0.05, 0.25], [690, 0.035, 0.15]], 0.002, 0.18);
    }),
    // ---- the hold (player.ts startGrab → the questions → chokeOut / whipOut; freeHeld when a round takes Sam down under him): close, quiet body sounds a metre from
    //      the listener — cloth, breath, a throat, one hard knock. The voiced bits of the three KEPT ones (grabScuffle, chokeLimp, shove) are a glottal pulse train (phase-accumulated in st[3],
    //      jittered) rounded off by the low-pass and gating a band of breath noise; chokeStrain, murmur and heldProtest are synth.ts's throat. No words: a stand-in for
    //      voices, kept well under the thuds. Levels sit against bodyHit at the takedown's 0.55 — a blow that is 7 dB lighter wideband since it lost its sub-bass
    //      (tools/qa/audio-render.ts prints the table); the game plays them at grabScuffle 0.4, chokeStrain 0.25, chokeLimp 0.35, whipThud 0.7, shove 0.3 (freeHeld: he
    //      wrenches loose — the E shove it was made for is gone), murmur 0.2, heldProtest 0.18 (0.16 under an answer).
    // the grab: Sam's sleeve over the man's shoulder and the forearm dragging across his collar (two rustles of mid-band cloth), his chest into the man's back (a soft
    // low bump), and the breath the man snatches as the arm arrives — voiceless intake, a flutter of voice in it, choked OFF at 100 ms rather than let fade
    grabScuffle: render(ctx, 0.36, (t, _i, sr, rnd, st) => {
      const n = rnd();
      const cloth = (lp(n, st, 0, 0.28) - lp(n, st, 1, 0.05)) * (env(t, 0.006, 0.04) + (t > 0.085 ? env(t - 0.085, 0.012, 0.06) * 0.8 : 0)) * 0.7;
      const bump = (lp(rnd(), st, 2, 0.035) * 1.4 + Math.sin(TAU * 85 * t) * 0.3) * env(t, 0.004, 0.06);
      const tg = t - 0.13; let gasp = 0;
      if (tg > 0) {
        const m = rnd(); st[3] += (155 - 150 * tg) / sr; const pulse = Math.max(0, Math.sin(TAU * st[3]));
        const shut = tg < 0.1 ? Math.min(1, tg / 0.03) : Math.exp(-(tg - 0.1) / 0.012);
        gasp = ((lp(m, st, 4, 0.55) - lp(m, st, 5, 0.12)) * (0.45 + 0.55 * pulse) * 0.8 + lp(pulse - 0.32, st, 6, 0.05) * 0.45) * shut;
      }
      return cloth + bump + gasp;
    }, 173),
    // he goes: the last of his air out past the arm (broadband breath, bright at first, sagging), a few slack pulses of voice in it as the larynx lets go, then his
    // jacket folding over the forearm as the knees give (two soft rustles) and his weight coming onto Sam's arm and thigh — no floor in it: the floor is bodyFall's,
    // off the ragdoll's own impact (Game.bodyThud)
    chokeLimp: render(ctx, 0.8, (t, _i, sr, rnd, st) => {
      const n = rnd();
      const breath = (lp(n, st, 0, 0.5 - 0.3 * Math.min(1, t / 0.5)) - lp(n, st, 1, 0.06)) * env(t, 0.05, 0.22) * 0.4;
      st[3] += (95 - 40 * Math.min(1, t / 0.3)) / sr; const ph = st[3] % 1; const pulse = ph < 0.35 ? Math.sin(Math.PI * ph / 0.35) ** 2 : 0;
      const moan = lp(pulse - 0.175, st, 2, 0.04) * env(t, 0.03, 0.12) * 0.9;
      const t1 = t - 0.28, t2 = t - 0.46; const m = rnd();
      const cloth = (lp(m, st, 4, 0.25) - lp(m, st, 5, 0.05)) * ((t1 > 0 ? env(t1, 0.015, 0.07) : 0) + (t2 > 0 ? env(t2, 0.02, 0.09) * 0.7 : 0)) * 0.55;
      const sag = t1 > 0 ? (lp(rnd(), st, 6, 0.03) * 1.2 + Math.sin(TAU * 70 * t1) * 0.25) * env(t1, 0.01, 0.09) : 0;
      return breath + moan + cloth + sag;
    }, 181),
    // the release: both palms into his shoulder blades (a low bump), his jacket and then his arms flung out (two bursts of cloth), and his first stumbling step
    // catching him — a shoe scuffing the floor: band hiss chopped by stick-slip over a low judder (the recipe propScrape had until 10-13, shorter and lighter)
    shove: render(ctx, 0.45, (t, _i, sr, rnd, st) => {
      const n = rnd();
      const palms = (lp(rnd(), st, 0, 0.045) * 1.5 + Math.sin(TAU * 105 * t) * 0.35) * env(t, 0.003, 0.055);
      const cloth = (lp(n, st, 1, 0.3) - lp(n, st, 2, 0.05)) * (env(t, 0.005, 0.06) + (t > 0.07 ? env(t - 0.07, 0.015, 0.08) * 0.6 : 0)) * 0.7;
      const ts = t - 0.16; let scuff = 0;
      if (ts > 0) {
        const m = rnd(); st[3] += (60 + 20 * Math.sin(ts * 25)) / sr;
        const chat = 0.55 + 0.45 * (Math.sin(ts * 95) > 0 ? 1 : -1) * (0.5 + 0.5 * Math.sin(ts * 9));
        scuff = ((lp(m, st, 4, 0.16) - lp(m, st, 5, 0.025)) * chat * 0.9 + Math.sin(TAU * st[3]) * 0.12) * env(ts, 0.012, 0.08) * Math.min(1, ts / 0.015) * 0.8;
      }
      return palms + cloth + scuff;
    }, 193),
    // his back onto the plaster (game/wallsnap.ts `voice`, the player's ears only): the shoulder blades and the pack meet the wall (a soft knock, its weight between
    // 100 and 500 Hz so a laptop's speakers carry it), the jacket presses flat and then settles as he sinks a little (two brushes of cloth), and the webbing ticks twice
    wallOn: render(ctx, 0.42, (t, _i, sr, rnd, st) => {
      const n = rnd(); st[6] += (95 + 45 * Math.exp(-t / 0.03)) / sr;
      const knock = (lp(rnd(), st, 0, 0.07) * 1.6 + Math.sin(TAU * st[6]) * 0.3) * env(t, 0.008, 0.05);
      const t2 = t - 0.09;
      const cloth = (lp(n, st, 1, 0.3) - lp(n, st, 2, 0.05)) * (env(t, 0.01, 0.05) * 0.5 + (t2 > 0 ? env(t2, 0.03, 0.09) * 0.45 : 0));
      const m = rnd(), hi = m - lp(m, st, 3, 0.5), t3 = t - 0.035, t4 = t - 0.062;
      const kit = hi * ((t3 > 0 ? env(t3, 0.001, 0.008) * 0.12 : 0) + (t4 > 0 ? env(t4, 0.001, 0.006) * 0.07 : 0));
      return knock + cloth + kit;
    }, 211),
    // …and off it: the jacket drags and peels away (cloth swelling in rather than struck, a little stick-slip in its first tenth of a second) and a sole turns on the floor
    wallOff: render(ctx, 0.34, (t, _i, _sr, rnd, st) => {
      const n = rnd(); const chat = t < 0.1 ? 0.7 + 0.3 * (Math.sin(t * 150) > 0 ? 1 : -1) : 1;
      const peel = (lp(n, st, 0, 0.3) - lp(n, st, 1, 0.05)) * env(t, 0.06, 0.07) * chat * 0.75;
      const ts = t - 0.13; const m = rnd();
      const sole = ts > 0 ? (lp(m, st, 2, 0.05) * 1.3 + (lp(m, st, 3, 0.3) - lp(m, st, 4, 0.08)) * 0.3) * env(ts, 0.005, 0.045) : 0;
      return peel + sole;
    }, 227),
    // ---- THE GRAB AS THREE BEATS (played by name in place of grabScuffle and the knocked-out gun's borrowed magDrop: the catch as the arm lands, the strip 0.25 s
    //      after it at his gun hand, the gun on the floor 0.70 s after it — a soft bump, a snap and a click, a dull knock). Written blind, three takes of each;
    //      THE MAINTAINER PICKED BY EAR (10-24: "catch: new 1 · strip: new 2 at 0.25 s · gun down: in the game at 0.70 s"): the catch and the strip below are the
    //      takes he chose, moved here from audio/sfxAlt.ts with their seeds (the same buffers to the sample), the knock is the first one written.
    // the catch (his pick, 'new 1'): more sleeve than thump — the whole forearm dragged over his shoulder and collar, Sam closing up behind him 55 ms in (felt more
    // than struck: its weight about 130 Hz), the jacket bunching under the arm, and his breath in through the nose, pinched off. A catch, not a struggle
    grabCatch: make(ctx, 'grabCatch', 0.32, 9401, v => {
      v.hiss(0, 900, 5500, 0.05, 0.008, 0.6); v.hiss(0.004, 350, 1400, 0.05, 0.01, 0.4);                  // the whole forearm dragged over his shoulder and collar
      thud(v, 0.055, 130, 0.07, 0.45, 420); v.hiss(0.055, 250, 800, 0.002, 0.012, 0.3);                   // Sam closing up behind him: felt more than struck
      v.hiss(0.075, 1200, 5000, 0.012, 0.03, 0.3);                                                        // the jacket bunching under the arm
      v.hiss(0.1, 1500, 4200, 0.035, 0.005, 0.22);                                                        // his breath in through the nose, pinched off
      v.hiss(0.17, 700, 3000, 0.02, 0.014, 0.08);
    }),
    // the strip (his pick, 'new 2'): one snap and one click, nothing between them — the gun wrenched out against his thumb (a snap with a knuckle in it), and
    // 0.13 s later the grip turned over into Sam's hand. Hard and dry between the catch's cloth and the knock; nothing in it rings, so slowed to 0.8 it is a carbine and not a slowed pistol
    gunStrip: make(ctx, 'gunStrip', 0.2, 9412, v => {
      knock(v, 0, 1200, 8000, 0.0035, 1.0); v.hiss(0, 300, 1100, 0.0005, 0.008, 0.9); v.ring(0, cluster(v, 700, 3600, 7, 0.01), 0.0006, 0.3);   // wrenched out against his thumb: a snap with a knuckle in it
      clack(v, 0.13, 1800, 7000, 0.008, 0.45); v.ring(0.13, [[3100, 0.005, 1], [5000, 0.004, 0.6]], 0.0003, 0.16);   // turned over, the grip in Sam's hand
    }),
    // the gun on the floor (his pick: the first take, as it was), thrown down flat — ONE dull knock (its weight under 500 Hz, the frame and the magazine dead inside two hundredths of a
    // second, a little steel in the contact), then it rocks flat: three small ticks, each half the last, and the hand leaving it. No bounce and no ring
    gunDown: make(ctx, 'gunDown', 0.34, 4219, v => {
      v.hiss(0, 100, 480, 0.001, 0.018, 1.0); knock(v, 0, 380, 1700, 0.006, 0.6); v.ring(0, cluster(v, 240, 1000, 6, 0.022), 0.0015, 0.3);
      knock(v, 0.003, 1700, 4200, 0.0015, 0.1);
      for (let k = 0; k < 3; k++) knock(v, 0.07 + 0.045 * k + 0.012 * v.u(), 800, 2800, 0.0025, 0.13 / (k + 1));
      v.hiss(0.06, 250, 1100, 0.02, 0.026, 0.07);
    }),
    // Sam's low whistle (V, game/whistle.ts): two short lip-whistled notes, the second a shade over a minor third down (1.1 kHz for 140 ms, a 40 ms breath, 0.9 kHz
    // for 170 ms), each scooped into from a touch flat the way a mouth finds a pitch and rounded off rather than cut, a whisper of second harmonic, and the breath
    // that makes it round the note (band noise about the pitch, loudest on the attacks) — phase-accumulated so the glide is exact at any rate. Quiet by design
    // (peak ~0.3, played at WHISTLE.gain): a sound for the man six metres off, not the floor.
    whistle: render(ctx, 0.36, (t, _i, sr, rnd, st) => {
      const t2 = t - 0.18;
      let f = 0, a = 0, atk = 0;
      if (t < 0.14) { f = 1100 * (1 - 0.045 * Math.exp(-t * 45)); a = Math.pow(Math.sin(Math.PI * t / 0.14), 0.6); atk = env(t, 0.004, 0.03); }
      else if (t2 > 0 && t2 < 0.17) { f = 900 * (1 + 0.05 * Math.exp(-t2 * 35)); a = Math.pow(Math.sin(Math.PI * t2 / 0.17), 0.7) * 0.9; atk = env(t2, 0.004, 0.035); }
      st[3] += f / sr; const tone = f > 0 ? Math.sin(TAU * st[3]) + 0.07 * Math.sin(2 * TAU * st[3]) : 0;
      const n = rnd(); const breath = (lp(n, st, 0, 0.3) - lp(n, st, 1, 0.07));
      return (tone * 0.26 + breath * (0.05 + 0.12 * atk)) * a;
    }, 223),
    // thunder (game/weather.ts plays it distance / 343 s after the stroke, low-passed and slowed further with every kilometre). A channel kilometres long and
    // crooked arrives over seconds: NEAR — the tearing-cloth crackle of the nearest few hundred metres of it (sparse impulses over a bright hiss, gone in a
    // third of a second), the clap (broadband, fast, a second smaller one behind it), then the roll: brown noise through two poles near 190 Hz, kneaded by
    // three slow beats against each other so it surges and sags the way thunder does, four seconds of it. FAR — no crackle, the clap dulled to a thump, the
    // roll slower to gather and longer to die. Both mono and dry: the mixer leans them toward the bearing and adds the room.
    thunderNear: render(ctx, 6.2, (t, _i, _sr, rnd, st) => {
      const n = rnd();
      const roll = 0.5 + 0.5 * Math.min(1, Math.abs(Math.sin(TAU * 0.9 * t + 1.0) * 0.6 + Math.sin(TAU * 1.7 * t + 2.0) * 0.45 + Math.sin(TAU * 0.37 * t) * 0.5));
      const tear = t < 0.6 ? ((Math.abs(rnd()) > 0.94 ? rnd() * 2.5 : 0) + (n - lp(n, st, 0, 0.3)) * 0.7) * env(t, 0.004, 0.11) : 0;
      const c1 = t - 0.1, c2 = t - 0.48;
      const clap = lp(rnd(), st, 1, 0.16) * ((c1 > 0 ? env(c1, 0.004, 0.28) : 0) + (c2 > 0 ? env(c2, 0.01, 0.4) * 0.55 : 0));
      const rum = lp(lp(rnd(), st, 2, 0.025), st, 3, 0.025) * 9.0;
      const rumble = rum * roll * (env(t, 0.3, 2.3) + 0.2 * env(t, 1.6, 1.6));
      return Math.tanh((tear * 0.45 + clap * 1.7 + rumble * 1.4) * 1.25) * 0.95;
    }, 401),
    // ---- a WALL CHARGE going off (game/blastFeel.ts plays the three together in place of the stun can's report it used to borrow, each a little later and the crack thinner
    //      the further off the listener is). CRACK: the detonation front — a few milliseconds of everything, a hard mid body, three slaps off the room's walls inside a
    //      tenth of a second and half a second of the room ringing down; no steel in it (the can's ring is the can's). THUMP: what is felt — a sine that dives from 105 Hz to
    //      27, the floor answering a beat behind it, the pressure wave's whump, and a rumble (brown noise through two poles near 100 Hz, kneaded so it rolls) that takes
    //      two seconds to leave. DEBRIS: the wall coming down after it — three heavy pieces, sixty small ones thinning out over two seconds, grit running under them.
    wallCrack: render(ctx, 1.1, (t, _i, _sr, rnd, st) => {
      const n = rnd();
      const front = (n - lp(n, st, 0, 0.45)) * env(t, 0.0002, 0.006) * 1.6 + n * env(t, 0.0003, 0.02) * 1.5;
      const body = lp(rnd(), st, 1, 0.16) * env(t, 0.001, 0.07) * 2.0;
      const s1 = t - 0.021, s2 = t - 0.047, s3 = t - 0.083;
      const slap = lp(rnd(), st, 2, 0.3) * ((s1 > 0 ? env(s1, 0.001, 0.016) * 0.9 : 0) + (s2 > 0 ? env(s2, 0.002, 0.022) * 0.65 : 0) + (s3 > 0 ? env(s3, 0.003, 0.03) * 0.45 : 0));
      const tail = lp(rnd(), st, 3, 0.05) * env(t, 0.03, 0.3) * 0.7 + lp(rnd(), st, 4, 0.012) * env(t, 0.06, 0.45) * 0.6;
      return Math.tanh((front + body + slap + tail) * 1.9) * 0.97;
    }, 431),
    wallThump: render(ctx, 3.2, (t, _i, sr, rnd, st) => {
      const f = 27 + 78 * Math.exp(-t * 6.5); st[5] += f / sr; const thump = Math.sin(TAU * st[5]) * env(t, 0.002, 0.42) * 1.9;
      const t2 = t - 0.07; const f2 = 46 + 30 * Math.exp(-Math.max(t2, 0) * 5); st[6] += f2 / sr; const floor = t2 > 0 ? Math.sin(TAU * st[6]) * env(t2, 0.01, 0.3) * 0.8 : 0;
      const whump = lp(rnd(), st, 0, 0.03) * env(t, 0.004, 0.2) * 2.8;
      const roll = 0.55 + 0.45 * Math.abs(Math.sin(TAU * 1.3 * t + 0.7) * 0.6 + Math.sin(TAU * 2.9 * t + 2.1) * 0.4);
      const rumble = lp(lp(rnd(), st, 1, 0.014), st, 2, 0.014) * 10 * roll * (env(t, 0.05, 0.75) + 0.35 * env(t, 0.5, 0.9));
      const growl = lp(rnd(), st, 3, 0.05) * roll * env(t, 0.05, 0.6) * 1.0;   // the same roll an octave or two up: what a small speaker has of it
      return Math.tanh((thump + floor + whump + growl + rumble * 1.2) * 1.4) * 0.97;
    }, 433),
    wallDebris: render(ctx, 2.7, (t, _i, _sr, rnd, st) => {
      const n = rnd(), grit = n - lp(n, st, 0, 0.3), dull = lp(n, st, 1, 0.08);
      let out = grit * env(t, 0.15, 0.6) * 0.1 * (0.4 + 0.3 * Math.abs(Math.sin(TAU * 7.3 * t) + Math.sin(TAU * 11.9 * t + 1)));   // grit running down the broken edge
      for (let k = 0; k < bits.length; k++) { const b = bits[k], th = t - b[0]; if (th < 0 || th > b[2] * 7) continue; out += (Math.sin(TAU * b[1] * th) * 0.55 + grit * b[4] * 0.9 + dull * (1 - b[4])) * env(th, 0.0006, b[2]) * b[3] * 0.5; }
      const c1 = t - 0.2, c2 = t - 0.46, c3 = t - 0.85;   // three pieces heavy enough to be heard as themselves
      if (c1 > 0) out += (Math.sin(TAU * 92 * c1) * 0.7 + dull * 1.2) * env(c1, 0.002, 0.06) * 0.8;
      if (c2 > 0) out += (Math.sin(TAU * 76 * c2) * 0.7 + dull * 1.2) * env(c2, 0.002, 0.07) * 0.6;
      if (c3 > 0) out += (Math.sin(TAU * 108 * c3) * 0.7 + dull * 1.2) * env(c3, 0.002, 0.05) * 0.42;
      return Math.tanh(out * 1.1) * 0.9;
    }, 439),
    thunderFar: render(ctx, 7.5, (t, _i, _sr, rnd, st) => {
      const roll = 0.45 + 0.55 * Math.min(1, Math.abs(Math.sin(TAU * 0.55 * t + 0.4) * 0.6 + Math.sin(TAU * 1.15 * t + 2.6) * 0.4 + Math.sin(TAU * 0.23 * t + 1.1) * 0.55));
      const c1 = t - 0.3;
      const thump = lp(lp(rnd(), st, 0, 0.06), st, 1, 0.06) * (c1 > 0 ? env(c1, 0.04, 0.6) : 0) * 3.0;
      const rum = lp(lp(rnd(), st, 2, 0.018), st, 3, 0.018) * 12.0;
      const rumble = rum * roll * (env(t, 0.9, 3.2) + 0.25 * env(t, 2.8, 2.0));
      return Math.tanh((thump + rumble * 1.5) * 1.2) * 0.95;
    }, 409),
  };
}
/** THE TABLE WITH NO VOICE RENDERED: per name, the call that renders it — the samples buildSfx makes, whenever and in whatever order they are asked for (`lazy`,
 *  above). The mixer renders them a voice at a time while the page waits on other things (audio.ts SFX_WARM) instead of all at once inside the first click. */
export function buildSfxLater(ctx: SfxContext): Map<SfxName, () => SfxBuffer> {
  const was = later; later = true; let t: Record<SfxName, SfxBuffer>; try { t = buildSfx(ctx); } finally { later = was; }
  const out = new Map<SfxName, () => SfxBuffer>();
  for (const n of Object.keys(t) as SfxName[]) { const b = t[n], real = (b as unknown as { [LATER]?: () => SfxBuffer })[LATER]; out.set(n, real ?? (() => b)); }   // (a row made another way is already its samples)
  return out;
}
