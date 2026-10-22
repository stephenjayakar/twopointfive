// THE SCORE'S NEWER PIECES. music.ts's sequencer played one theme (87 bpm, D minor: drones and sub at rest, a breakbeat and a reese bass as the floor heats up). These are seven
// more written for the same seat: the same three layers on the same `intensity` (calm · suspicious · firefight), each with its own tempo, metre, key, band and groove, so an hour
// of play is not one loop. All of it is synthesis written for this game; nothing is recorded, sampled or quoted from anywhere. THE BAND IS ACOUSTIC wherever a thing is struck,
// plucked, bowed or blown (acoustic.ts: an upright bass, a drum kit with brushes and cymbals, hand drums, a gong and a kettledrum, koto / dulcimer / felt piano / plucked
// strings; musicBackend.ts: a bowed section, a flute, a clarinet, a muted trumpet, horns) and electric only where the maintainer liked it so: the theme's own gliding pad,
// sub and growling reese bass under every piece, a vibraphone, an electric piano, the bells (10-14: "more diverse instrumentation and making them sound more acoustic rather
// than synth (specifically the accents and percussion, the long drawn out glissando pads and the fat synth bass are great)").
//   MUSIC.pieces  the switch: ON in the page (`?onetheme` = the theme alone, as it was), OFF here and on the frozen stand (TPS_MUSIC=1). Off = the sequencer as it was, note for
//                 note and draw for draw (tools/qa/music-check.ts holds the theme's note stream against a pin taken before this file existed; MUSIC_BREAK=1 must fail).
//   which piece   THE LEVEL'S OWN (setlist.ts, MUSIC.byLevel — ON in the page, `?shuffle` off; OFF here and on the frozen stand, raised by the same TPS_MUSIC=1): each level has
//                 two pieces written down for it; play opens on the first (off the menu, or on a page that loads straight in), the next takes over once a piece has had MUSIC.minutes at a calm phrase end (twice
//                 that whatever the floor is doing), in the list's order and round again. The theme is on no list: it is the main menu's. A new mission on the same page
//                 keeps the music it has. Switch off (or a host that names no level): music.ts deals them from a shuffled bag (the page's own die, never the game's) — the
//                 visit opens on a new one, a mission that starts once a piece has had MUSIC.missionAfter seconds moves on, and so does a piece that has had MUSIC.minutes.
//   how tense     THE OPPOSITION'S NERVES (MUSIC.theirs — ON in the page, `?teamnerves` off; OFF here and on the frozen stand, raised by the same TPS_MUSIC=1): the tension the
//                 score follows (game/guards.ts tension; the page hands it this switch) is how roused the men against the player are. In live play a teammate counts
//                 only while he is in a fight of his own ('alert'); what a blast, a noise or a tripped breaker left on him does not. A man under an order never talks
//                 himself calm, so with the switch off (as it was) one can left a teammate's wariness holding the score up for as long as his order stood, every
//                 defender down or not. While a show runs (the day showcase's pair hunting) its men's scripted states are the score's cue and read as they always did.
// A PIECE is data plus one `tick`: called once per sixteenth with the bar, the step in it, the smoothed intensity x and the chord's root, it plays through `Hands` (the voices
// with the sequencer's die behind them — every random number a voice or a decision takes is drawn there, in the order asked). A piece keeps what it must remember between
// steps in `h.m` (cleared when a piece begins).
import type { MusicBackend, PieceVoices, MusicLevels, MetalHit, NoiseDice, KeyKind, PercKind, WindKind, BowKind } from './musicBackend';
import { midi } from './musicBackend';

/** the pieces switch, the level's-own-music switch, whose nerves the tension reads, and the two times the deal reads (registered in game/knobs.ts; the listener's ears only: no rule reads it, a replay holds no sound) */
export const MUSIC = { pieces: false, byLevel: false, theirs: false, minutes: 4, missionAfter: 45 };

/** a struck metal's dice, in the order the graph drew them: the base pitch, then per partial the decay's draw and the pan's (the theme's pinned stream rests on this order) */
export function drawMetal(rnd: () => number): MetalHit {
  const base = 700 + rnd() * 2200; const decays: number[] = [], pans: number[] = [];
  for (let k = 0; k < 4; k++) { decays.push(1.2 + rnd()); pans.push(rnd() * 1.6 - 0.8); }
  return { base, decays: decays as MetalHit['decays'], pans: pans as MetalHit['pans'] };
}
/** the voices as a piece plays them: the backend behind the score's one die, each note counted */
export class Hands {
  /** a piece's own memory between steps (cleared when a piece begins) */
  m: number[] = [];
  /** the weight of every drum stroke from here to the end of this step (1 at its start): how a piece brings its kit in from under the hand drums instead of all at once */
  ease = 1;
  constructor(private be: MusicBackend & PieceVoices, readonly rnd: () => number, private count: () => void) {}
  private dice(): NoiseDice { return { rate: 0.9 + this.rnd() * 0.2, offset: this.rnd() * 1.5 }; }
  /** true `p` of the time */
  maybe(p: number) { return this.rnd() < p; }
  pick<T>(a: readonly T[]): T { return a[Math.floor(this.rnd() * a.length) % a.length]; }
  pad(t: number, notes: [number, number, number, number]) { this.be.padChord(t, notes.map(midi) as [number, number, number, number], 0.8); }
  sub(t: number, note: number, len: number) { this.count(); this.be.sub(t, midi(note), len); }
  /** (a note under E1 is played an octave up: below that the growl is a rattle no speaker makes a pitch of) */
  reese(t: number, note: number, len: number) { this.count(); this.be.reese(t, midi(note < 28 ? note + 12 : note), len); }
  // (a player is never on the grid to the millisecond, and never hits a thing twice the same: every acoustic note lands up to a few thousandths late, at its own weight)
  /** `slide` (semitones, 0 = none): the note is slid into from that far off */
  pluck(t: number, note: number, len: number, v: number, slide = 0) { this.count(); this.be.pluck(t + this.rnd() * 0.005, midi(note), len, v, slide ? midi(note + slide) : 0); }
  keys(t: number, note: number, len: number, v: number, kind: KeyKind, pan = this.rnd() * 1.2 - 0.6) { this.count(); this.be.keys(t + this.rnd() * 0.005, midi(note), len, v, pan, kind); }
  strings(t: number, notes: number[], len: number, v: number, attack: number, how: BowKind) { this.count(); this.be.strings(t, notes.map(midi), len, v, attack, how); }
  wind(t: number, note: number, len: number, v: number, kind: WindKind) { this.count(); this.be.wind(t, midi(note), len, v, kind, this.dice()); }
  perc(t: number, kind: PercKind, v: number) { this.count(); this.be.perc(t + this.rnd() * 0.006, kind, v * this.ease * (0.88 + this.rnd() * 0.24), this.dice()); }
  /** the theme's own struck metal and its swell of noise: Paper Walls keeps both (its callback to the theme) */
  metal(t: number, v: number) { this.count(); this.be.metal(t, v, drawMetal(this.rnd)); }
  /** the kit comes in under a piece, not on a line: 0.4 of its weight where x reaches a, all of it by b */
  easeIn(x: number, a: number, b: number) { this.ease = 0.4 + 0.6 * on(x, a, b); }
  swell(t: number, len: number) { this.count(); this.be.swell(t, len); }
  /** a cymbal rolled from t, breaking at t + len */
  roll(t: number, len: number, v: number) { this.count(); this.be.cymbalRoll(t, len, v); }
}

/** the theme's own facts (music.ts plays it; it is no Piece): what a page or a check says of it */
export const THEME = { name: 'Theme', key: 'D minor', bpm: 87, steps: 16 };

export interface Piece {
  name: string;
  /** its key, as a listener would say it */
  key: string;
  bpm: number;
  /** sixteenths in a bar (16 = four four, 12 = twelve eight) */
  steps: number;
  /** how far the off sixteenths lean late (the theme: 0.08) */
  swing: number;
  /** bars a chord holds */
  hold: number;
  /** the chord roots, in turn (MIDI notes) */
  roots: number[];
  /** the pad's four notes over a root (its fourth oscillator sounds an octave above what it is given) */
  chord(root: number): [number, number, number, number];
  /** the pad lowpass's centre and resonance */
  pad: [number, number];
  /** the echo's time, in sixteenths */
  echo: number;
  /** the theme's five bus levels at intensity x (drums = the theme's own kit, which no piece plays: 0; bass = the reese; pad; sub; tex = the swell that leads a handover) */
  levels(x: number): Pick<MusicLevels, 'drums' | 'bass' | 'pad' | 'sub' | 'tex'>;
  tick(h: Hands, s: number, bar: number, t: number, spb: number, x: number, root: number): void;
  /** tuned notes (MIDI) it will ask for several at a time, by kind: made a few at a time from when the piece begins, so that a chord's or a run's strings are not all
   *  made in the one step that first plays them */
  warm?: readonly (readonly [KeyKind, readonly number[]])[];
}

/** a bar of hits from a word: x = full, o = half, - = a ghost, anything else = rest */
const P = (w: string) => Array.from(w, c => c === 'x' ? 1 : c === 'o' ? 0.55 : c === '-' ? 0.28 : 0);
/** 0 below a, 1 above b */
const on = (x: number, a: number, b: number) => Math.max(0, Math.min(1, (x - a) / (b - a)));
/** degree d of a scale (semitones in one octave), octaves carried */
const deg = (scale: readonly number[], d: number) => scale[((d % scale.length) + scale.length) % scale.length] + 12 * Math.floor(d / scale.length);
/** the sub's note under a root: an octave down while that is still a pitch a speaker can make (D1 and up), else the root itself */
const low = (root: number) => root - 12 >= 26 ? root - 12 : root;
/** a run down the toms over the bar's last four steps (k = 0‥3): the fill that turns a phrase over, each stroke a little harder */
const toms = (h: Hands, t: number, k: number, v: number) => h.perc(t, k < 2 ? 'tomHi' : 'tomLo', v * (0.6 + 0.12 * k));
type Riff = readonly (readonly [step: number, semis: number, len: number])[];
type Motif = readonly (readonly [step: number, semis: number])[];

// ---- 1. NIGHT SHIFT — 78 bpm, C minor, a slow lean. Three in the morning: an upright bass that says little, a muted trumpet that sighs a half step down, a clarinet
//         answering from underneath, a felt piano and brushes; when it goes loud, tom-toms, a shiver of strings and the growling bass. (The maintainer, 10-14: "a bit
//         too upbeat" of its first cut — 92 bpm, a walking blues riff and a ride pattern: all three are gone.) ----
const NS_A: Riff = [[0, 0, 5], [7, -2, 2], [10, -5, 3], [14, -1, 2]], NS_B: Riff = [[0, 0, 6], [10, 3, 2], [12, 2, 2], [14, -4, 2]], NS_OFF: Riff = [[0, 0, 6], [10, 7, 3], [14, 1, 2]];
const NS_VIBES: readonly Motif[] = [[[2, 3], [5, 2]], [[0, 8], [6, 7]], [[4, 14], [10, 11]], [[8, 6], [12, 7]], [[2, 15], [8, 14], [14, 11]]];   // (half steps and a tritone: nothing that resolves)
const NS_HORN = [67, 70, 72, 63, 62, 68], NS_REED = [51, 55, 56, 58, 55];   // (the clarinet from E flat 3 up: under that it is no clarinet, and it rubs on the pad)
const NS_TOM = P('x.....x...o.x...'), NS_K1 = P('x.........o.....'), NS_K2 = P('x.........x..x..'), NS_GH = P('.......-.-....-.');
const nightShift: Piece = {
  name: 'Night Shift', key: 'C minor', bpm: 78, steps: 16, swing: 0.12, hold: 2, roots: [36, 36, 32, 31, 36, 34, 32, 31], pad: [380, 3.5], echo: 3,
  chord: r => r === 32 ? [r, r + 7, r + 16, r + 18] : r === 31 ? [r, r + 16, r + 22, r + 13] : [r, r + 7, r + 15, r + 14],   // (the colour on top, where it is a colour and not mud: a ninth over every minor third, a sharp fourth over A flat, a flat ninth over G seven)
  levels: x => ({ drums: 0, bass: on(x, 0.6, 1) * 0.4, pad: 0.44 - x * 0.15, sub: 0.3 + x * 0.2, tex: 0.3 }),
  tick(h, s, bar, t, spb, x, root) {
    const hot = x > 0.55, tonic = root === 36;
    if (s === 0) { h.sub(t, low(root), 0.6); h.m[0] = h.maybe(x < 0.25 ? 0.45 : 0.3) ? Math.floor(h.rnd() * NS_VIBES.length) : -1; }
    // the bass: the root and little else at rest, the whole slow figure once anyone is uneasy
    const riff = tonic ? (bar % 2 ? NS_B : NS_A) : NS_OFF;
    for (const [st, semi, len] of riff) if (st === s && (st === 0 || h.maybe(0.15 + x * 1.6))) h.pluck(t, root + semi, spb * len * 1.5, 0.45 + x * 0.3);
    // the trumpet: one long note every four bars, and the half step or the step it falls; the clarinet under it two bars on
    if (!hot && bar % 4 === 1) { if (s === 2) { h.m[1] = h.pick(NS_HORN); h.wind(t, h.m[1], spb * 7, 0.2, 'trumpet'); } else if (s === 10 && h.m[1] && h.maybe(0.75)) h.wind(t, h.m[1] - h.pick([1, 1, 2]), spb * 9, 0.16, 'trumpet'); }
    if (x < 0.7 && bar % 4 === 3 && s === 4 && h.maybe(0.7)) h.wind(t, h.pick(NS_REED), spb * 11, 0.22, 'clarinet');
    // the vibraphone: two or three notes a bar, or none; a felt piano's low fifth where the phrase turns
    const mo = h.m[0] >= 0 ? NS_VIBES[h.m[0]] : null;
    if (mo) for (const [st, semi] of mo) if (st === s) h.keys(t, 60 + semi, 2.6, 0.2 + h.rnd() * 0.1, 'vibes');
    if (s === 0 && bar % 4 === 0) { h.keys(t, root + 12, 3.5, 0.3, 'piano', -0.2); h.keys(t + 0.03, root + 19, 3.5, 0.22, 'piano', 0.2); }
    if (s === 0 && bar % 8 === 4 && x < 0.3 && h.maybe(0.5)) h.perc(t, 'gong', 0.22);
    // brushes: a sweep on two and four, taps between
    const br = on(x, 0.06, 0.2);
    if (br > 0 && !hot) { if (s === 4 || s === 12) h.perc(t, 'brush', 0.7 * br); else if (s % 2 === 1 && h.maybe(0.15)) h.perc(t, 'brushTap', 0.4 * br); }
    if (x < 0.25) return;
    h.easeIn(x, 0.25, 0.5);
    if (!hot) { if (NS_K1[s]) h.perc(t, 'kick', 0.75 * NS_K1[s]); if (s === 12) h.perc(t, 'rim', 0.7); if (s === 4 && bar % 8 === 7) h.roll(t, spb * 12, 0.5); return; }   // (one stick on the rim a bar: half the pace of the brushes)
    // the kit: toms under everything, the snare late
    if (NS_TOM[s]) h.perc(t, 'tomLo', 0.75 * NS_TOM[s]);
    const k = NS_K2[s] || (h.maybe(0.05) ? 0.6 : 0); if (k) h.perc(t, 'kick', k);
    if (bar % 4 === 3 && s >= 12) toms(h, t, s - 12, 0.9);
    else if (s === 4 || s === 12) h.perc(t, 'snare', 0.95); else if (NS_GH[s] && h.maybe(0.5)) h.perc(t, 'snare', 0.22);
    if (s % 2 === 0) h.perc(t, s % 4 === 0 ? 'ride' : 'hat', s % 4 === 0 ? 0.5 : 0.4);
    if (s === 0 && bar % 8 === 0) h.perc(t, 'crash', 0.6); if (s === 4 && bar % 8 === 7) h.roll(t, spb * 12, 0.7);
    if (x > 0.6 && (s === 0 || s === 7 || s === 10 || (s === 14 && h.maybe(0.5)))) h.reese(t, root - 12 + (s === 7 ? -2 : s === 10 ? -5 : s === 14 ? (tonic ? (bar % 2 ? -4 : -1) : 1) : 0), spb * (s === 0 ? 5 : 2.4));   // (its pickup is the bass's own, riff for riff: NS_A's leading tone, NS_B's sixth, the half step over the other roots)
    if (x > 0.65 && s === 0 && bar % 2 === 0) h.strings(t, root === 32 ? [root + 24, root + 28, root + 30, root + 31] : root === 31 ? [root + 24, root + 25, root + 28, root + 34] : [root + 24, root + 27, root + 26, root + 31], spb * 26, 0.3, 0.35, 'trem');   // (the pad's own chord, shivering: the third and the colour a half step apart)
    if (x > 0.7 && s === 8 && bar % 4 === 2) h.wind(t, root + 12, spb * 7, 0.3, 'horn');
  },
};

// ---- 2. PAPER WALLS — twelve eight at 84, D on the hirajoshi scale (D Eb G A Bb). Koto phrases and a breathy flute over open fifths; one great drum at rest, a taiko
//         pattern as the floor wakes, the whole drum line and a shuffle when it breaks. ----
const HIRA = [0, 1, 5, 7, 8];
const PW_KOTO: readonly Motif[] = [[[0, 0], [2, 1], [3, 0], [6, 3], [9, 2]], [[0, 4], [1, 3], [3, 2], [6, 1], [8, 0]], [[0, 2], [3, 3], [6, 5], [7, 6], [9, 5]], [[0, 0], [6, 0], [7, 1], [8, 0]], [[3, 7], [4, 6], [6, 5], [9, 3], [10, 4], [11, 3]]];
const PW_T1 = P('x..o.ox..o.-'), PW_T2 = P('x-o.-ox.o.-o'), PW_K = P('x.....x....o');
const paperWalls: Piece = {
  name: 'Paper Walls', key: 'D hirajoshi', bpm: 84, steps: 12, swing: 0, hold: 2, roots: [38, 38, 39, 38, 34, 34, 36, 38], pad: [300, 6], echo: 3,
  chord: r => [r, r + 7, r + 12, r + 7],
  levels: x => ({ drums: 0, bass: on(x, 0.6, 1) * 0.34, pad: 0.5 - x * 0.2, sub: 0.4 + x * 0.1, tex: 0.3 }),
  tick(h, s, bar, t, spb, x, root) {
    const hot = x > 0.55;
    if (s === 0) {
      h.sub(t, low(root), 0.8);
      h.m[0] = h.maybe(x < 0.25 ? 0.6 : hot ? 0.25 : 0.4) ? Math.floor(h.rnd() * PW_KOTO.length) : -1;
      if (x < 0.5 && bar % 4 === 2 && h.maybe(0.7)) { h.wind(t, 62 + deg(HIRA, h.pick([0, 2, 3, 4, 5])), spb * 10, 0.3, 'flute'); h.m[1] = h.maybe(0.5) ? 1 : 0; } else h.m[1] = 0;
    }
    if (s === 6 && h.maybe(0.3 + x * 0.4)) h.sub(t, low(root), 0.5);
    if (s === 10 && h.m[1]) h.wind(t, 62 + deg(HIRA, h.pick([1, 3, 5])), spb * 6, 0.22, 'flute');
    const mo = h.m[0] >= 0 ? PW_KOTO[h.m[0]] : null;
    if (mo) for (const [st, d] of mo) if (st === s) h.keys(t, 62 + deg(HIRA, d), 1.4, 0.3 + h.rnd() * 0.15, 'koto');
    if (x < 0.3 && s === 6 && bar % 4 === 3) h.swell(t, spb * 6);
    if (h.maybe(0.015)) h.metal(t, 0.1 + h.rnd() * 0.12);   // (these two are the theme's own textures, left as he heard them)
    // the drums
    if (x < 0.2) { if (bar % 2 === 0 && s === 0) h.perc(t, 'taiko', 0.5); else if (s === 9 && h.maybe(0.3)) h.perc(t, 'taiko', 0.25); return; }
    const w = hot ? 0.75 : on(x, 0.2, 0.5) * 0.7 + 0.3, tk = (hot ? PW_T2 : PW_T1)[s];
    if (tk) h.perc(t, 'taiko', tk * w);
    if (s === 3 || s === 9) h.perc(t, 'wood', 0.6 * w);
    if (!hot) return;
    if (bar % 4 === 3 && s >= 9) for (let k = 1; k < 3; k++) h.perc(t + (spb / 3) * k, 'taiko', 0.4 + 0.15 * k);
    h.easeIn(x, 0.55, 0.75);
    if (PW_K[s]) h.perc(t, 'kick', 1);
    if (s === 3 || s === 9) h.perc(t, 'snare', 0.9);
    h.perc(t, s === 11 && h.maybe(0.3) ? 'hatOpen' : 'hat', [0.5, 0.2, 0.3][s % 3]);
    if (s === 0 || s === 5 || s === 8) h.reese(t, root - 12, spb * 2.5);
    if (x > 0.75 && s % 3 === 0) h.strings(t, [root + 24, root + 31], spb * 1.2, s === 0 ? 0.32 : 0.2, 0.012, 'short');
  },
};

// ---- 3. DEAD FREIGHT — 160 bpm, E minor, four in a bar and even. At rest it is half time: an electric piano and the bass's tail. Then a rim and a shaker count it in, and
//         when it goes loud a break runs on a ride cymbal under a long growling bass. (Its first cut was in seven: the maintainer, 10-14, "i wonder if the 7/8 stutter
//         isn't quite the right fit for a game based on *smooth* operators. the snare roll is what gave it away" — the bar is whole now, nothing is shredded, and what
//         turns a phrase over is a run down the toms and a cymbal.) ----
const DF_A: Riff = [[0, 0, 3], [4, 7, 2], [6, 6, 2], [8, 0, 2], [10, 1, 2], [12, -2, 2], [14, -5, 2]], DF_B: Riff = [[0, 0, 3], [4, 10, 2], [6, 7, 2], [8, 5, 2], [10, 3, 2], [12, -2, 2], [14, -1, 2]];
const DF_K1 = P('x.....o...x.....'), DF_K2 = P('x.....x...x.....'), DF_K3 = P('x.....x..x.x....');
const deadFreight: Piece = {
  name: 'Dead Freight', key: 'E minor', bpm: 160, steps: 16, swing: 0.04, hold: 4, roots: [40, 40, 41, 40, 43, 41, 40, 38], pad: [400, 4], echo: 6,
  chord: r => [r, r + 7, r + 10, r + 3],   // (minor sevenths in parallel: the bass, the piano and the reese all move that way)
  levels: x => ({ drums: 0, bass: on(x, 0.6, 1) * 0.3, pad: 0.4 - x * 0.15, sub: 0.34 + x * 0.12, tex: 0.35 }),
  tick(h, s, bar, t, spb, x, root) {
    const hot = x > 0.6, calm = x < 0.2;
    if (s === 0) h.sub(t, root - 12, calm ? 0.8 : 0.4); else if (s === 8 && h.maybe(0.3 + x * 0.4)) h.sub(t, root - 12, 0.4);
    // the bass: three bars of the figure and one that climbs back to it; at rest only the figure's last notes, every other bar
    const riff = bar % 4 === 3 ? DF_B : DF_A;
    for (const [st, semi, len] of riff) if (st === s && (calm ? bar % 2 === 0 && (st === 0 || st >= 8) : true)) h.pluck(t, root + semi, spb * len * 1.8, calm ? 0.38 : 0.26 + x * 0.22);
    // the electric piano: single notes hung in the echo at rest, a stab off the beat later
    if (calm ? (s === 0 || s === 8) && h.maybe(0.3) : s === 6 && h.maybe(0.2)) h.keys(t, root + 24 + h.pick([0, 2, 3, 7, 10, 14]), 2.6, 0.26, 'rhodes');
    if (!calm && ((s === 4 && bar % 2 === 0) || (s === 10 && bar % 4 === 3 && h.maybe(0.7)))) for (const semi of [3, 7, 14]) h.keys(t, root + 24 + semi, 1.2, 0.2, 'rhodes', semi === 7 ? 0 : semi === 3 ? -0.4 : 0.4);
    if (calm && s === 8 && bar % 8 === 7) h.roll(t, spb * 8, 0.4);
    if (calm && s === 0 && bar % 8 === 4 && h.maybe(0.4)) h.perc(t, 'gong', 0.18);
    if (x < 0.15) return;
    const inn = on(x, 0.15, 0.3);   // (the count comes in from nothing)
    if (s % 2 === 0) h.perc(t, 'shaker', (s % 4 === 0 ? 0.8 : 0.45) * inn);
    if (s === 4 || s === 12) h.perc(t, 'rim', 0.7 * inn);
    if (x < 0.35) return;
    h.easeIn(x, 0.35, 0.55);
    if (!hot) { if (DF_K1[s]) h.perc(t, 'kick', DF_K1[s]); if (s % 2 === 0) h.perc(t, 'hat', 0.5); return; }
    // the break: a ride that never stops, ghosts between the backbeats, and nothing cut short
    const k = (bar % 4 === 3 ? DF_K3 : DF_K2)[s] || (h.maybe(0.06) ? 0.6 : 0); if (k) h.perc(t, 'kick', k);
    if (bar % 8 === 7 && s >= 12) toms(h, t, s - 12, 0.9);
    else if (s === 4 || s === 12) h.perc(t, 'snare', 1); else if (s % 2 === 1 && h.maybe(0.22)) h.perc(t, 'snare', 0.2);
    if (s % 2 === 0) h.perc(t, s % 8 === 0 ? 'rideBell' : 'ride', s % 4 === 0 ? 0.6 : 0.4); else h.perc(t, 'hat', 0.28);
    if (s === 0 && bar % 8 === 0) h.perc(t, 'crash', 0.6); if (s === 0 && bar % 8 === 7) h.roll(t, spb * 16, 0.6);
    if (s === 0) h.reese(t, root - 12, spb * 10); else if (s === 10) h.reese(t, root - 12 + h.pick([0, 3, -2, 7]), spb * 4.5);
  },
};

// ---- 4. UNDERTOW — 68 bpm, B flat minor, heavy. Bells turn a three-step figure against the four of the bar over a held bass and a long sub; congas, then a kit in half
//         time whose one snare lands like a door — and in a firefight the kit DOUBLES: a backbeat at 136 over the same slow chords, with horns and a kettledrum. (The
//         maintainer, 10-14: "the firefight version feels too slow ... I wonder if it should go to double time when that happens".) ----
const UT_PENT = [0, 3, 5, 7, 10, 12], UT_FIG = [2, 4, 3, 5, 2, 1, 3, 0];   // (the bells' figure: eight notes, three sixteenths apart — a bar and a half, so it comes round on a different beat each time)
const UT_LO = P('..x......x..x...'), UT_HI = P('.....x.x......x-'), UT_K1 = P('x.........x.....'), UT_HAT = P('x.o.x.o.x.o.x.oo');
const UT_K2 = P('x..x....x..x.x..'), UT_K3 = P('x..x.x..x..x...x');   // (double time: two bars of four at 136 to each bar of the piece — kicks on their ones and off their twos)
const UT_REESE: Riff = [[0, 0, 3], [3, 0, 2], [6, 3, 3], [10, -2, 3], [13, -5, 2]];
const undertow: Piece = {
  name: 'Undertow', key: 'B♭ minor', bpm: 68, steps: 16, swing: 0.12, hold: 2, roots: [34, 34, 37, 36, 34, 34, 39, 41], pad: [360, 5], echo: 3,
  chord: r => r === 36 ? [r, r, r + 10, r + 3] : r === 41 || r === 37 ? [r, r, r + 7, r + 4] : [r, r, r + 7, r + 3],   // (D flat and F major, as the bells over them say)
  levels: x => ({ drums: 0, bass: on(x, 0.55, 1) * 0.45, pad: 0.5 - x * 0.15, sub: 0.4 + x * 0.25, tex: 0.3 }),
  tick(h, s, bar, t, spb, x, root) {
    const hot = latch(h, 0, s, x, 0.5, 0.6), g = bar * 16 + s;   // (the kit changes gear on a bar line and stays in it: no half-time snare and backbeat in one bar)
    const third = root === 37 || root === 41 ? 28 : 27;
    if (s === 0) h.sub(t, low(root), 1.2); else if (s === 11 && h.maybe(0.5)) h.sub(t, low(root), 0.5);
    // the bells: every third sixteenth the next note of the figure, some left out, so it never sits on the bar
    if (g % 3 === 0 && h.maybe(hot ? 0.45 : 0.8)) h.keys(t, 70 + UT_PENT[UT_FIG[(g / 3) % UT_FIG.length]], 2.2, 0.2 + h.rnd() * 0.14, 'bell', (g / 3) % 2 ? 0.5 : -0.5);
    // the bass: the root held, a fifth or a step under it as a pickup
    if (s === 0) h.pluck(t, root, spb * 9, 0.36 + x * 0.3); else if (s === 10 && h.maybe(0.6)) h.pluck(t, root + h.pick([7, -2, 7, 10]), spb * 4, 0.3 + x * 0.3);
    if (x < 0.35 && s === 0 && bar % 4 === 2) h.strings(t, [root + 24, root + 31], 5, 0.25, 2.5, 'bow');
    if (s === 0 && bar % 8 === 6 && x < 0.3 && h.maybe(0.6)) h.perc(t, 'gong', 0.25);
    if (x < 0.15) return;
    const w = (0.6 + 0.4 * x) * on(x, 0.15, 0.3);   // (the hands come in from nothing)
    if (UT_LO[s]) h.perc(t, 'congaLo', UT_LO[s] * w); if (UT_HI[s]) h.perc(t, 'congaHi', UT_HI[s] * w);
    if (x < 0.3 && !hot) return;
    h.easeIn(x, 0.3, 0.55);
    if (!hot) {   // half time: the one snare, a great drum under it
      if (UT_HAT[s]) h.perc(t, 'hat', UT_HAT[s] * 0.5);
      if (s === 8) { h.perc(t, 'snare', 1); h.perc(t, 'taiko', 0.8); }
      if (UT_K1[s]) h.perc(t, 'kick', 1); if (s === 4 && bar % 2 === 1) h.roll(t, spb * 4, 0.45);
      if (s === 0 && bar % 4 === 0) h.keys(t, root + 12, 3, 0.4, 'timp', 0);
      return;
    }
    // double time
    const k = (bar % 2 ? UT_K3 : UT_K2)[s] || (h.maybe(0.05) ? 0.6 : 0); if (k) h.perc(t, 'kick', k);
    if (bar % 4 === 3 && s >= 12) toms(h, t, s - 12, 0.95);
    else if (s % 4 === 2) h.perc(t, 'snare', 1); else if (h.maybe(0.14)) h.perc(t + spb / 2, 'snare', 0.2);
    h.perc(t, 'ride', s % 2 === 0 ? 0.55 : 0.3); if (h.maybe(0.25)) h.perc(t + spb / 2, 'hat', 0.3);   // (the ride says 136 too: its eighths, the beats leaned on)
    if (s === 0 || s === 8) h.perc(t, 'taiko', s ? 0.5 : 0.8);
    if (s === 0 && bar % 4 === 0) h.perc(t, 'crash', 0.6);
    if (s === 0 && bar % 2 === 0) h.keys(t, root + 12, 3, 0.5, 'timp', 0);
    for (const [st, semi, len] of UT_REESE) if (st === s) h.reese(t, root - 12 + semi, spb * len * 0.8);
    if (s === 0 && bar % 2 === 0) for (const n of [root + 12, root + 19, root + third]) h.wind(t, n, spb * 2.5, 0.26, 'horn');   // (the horns)
    if (s === 12 && bar % 4 === 3) h.strings(t, [root + 12, root + 19, root + 25], spb * 4, 0.45, spb * 3.8, 'bow');   // (and the swell into the one, a half step over the root)
  },
};

// ---- 5. GLASS RAIN — 96 bpm, F sharp phrygian, bare. A frame drum like a pulse; a hammered dulcimer turning over the half step above the tonic; a felt piano's low
//         fifths; strings holding one note and the note a half step over it, and shivering when the shooting starts. (The maintainer, 10-14, of its first cut:
//         "a bit too upbeat (feels kinda chrono trigger esque to me) despite the phrygian elements ... the main melodies in firefight glass rain do sound very
//         synth-y" — the congas' chatter, the electric piano's arpeggios, the major chords and the sawtooth stabs are gone.) ----
const GR_FRAME = P('x.........o..-..'), GR_K1 = P('x.........x.....'), GR_K2 = P('x.........x..x..'), GR_K3 = P('x..x......x.....'), GR_PIZZ: Riff = [[0, 0, 1], [2, 0, 1], [4, 0, 1], [6, 1, 1], [8, 0, 1], [10, 0, 1], [12, 0, 1], [14, 1, 1]];   // (even eighths, the half step on the weak ones: a pulse, not a dance)
const GR_CELLS: readonly Motif[] = [[[0, 0], [3, 1], [6, 0]], [[2, 7], [4, 8], [8, 7], [12, 5]], [[0, 12], [6, 13], [8, 12], [14, 10]], [[4, 3], [6, 1], [10, 0]], [[0, -2], [8, 0]], [[2, 1], [10, 0]]];
const glassRain: Piece = {
  name: 'Glass Rain', key: 'F♯ phrygian', bpm: 96, steps: 16, swing: 0.05, hold: 2, roots: [42, 42, 43, 42, 40, 40, 43, 42], pad: [340, 4.5], echo: 8,
  chord: r => r === 43 ? [r, r + 7, r + 12, r + 6] : r === 40 ? [r, r + 7, r + 10, r + 2] : [r, r + 7, r + 12, r + 1],   // (no thirds: a fifth, and over it the half step, the tritone or the ninth)
  levels: x => ({ drums: 0, bass: on(x, 0.6, 1) * 0.4, pad: 0.45 - x * 0.15, sub: 0.35 + x * 0.25, tex: 0.25 }),
  tick(h, s, bar, t, spb, x, root) {
    const hot = x > 0.6, w = 0.3 + 0.45 * x;
    if (s === 0) { h.sub(t, root - 12, 0.7); h.m[0] = h.maybe(hot ? 0.35 : 0.55) ? Math.floor(h.rnd() * GR_CELLS.length) : -1; h.m[1] = h.maybe(0.4) ? 54 : 66; } else if (s === 10) h.sub(t, root - 12, 0.4);
    // the pulse: a frame drum, and the low drum that bends up under the hand
    if (GR_FRAME[s]) h.perc(t, 'frame', GR_FRAME[s] * (w + 0.15));
    if (s === 7 && x > 0.2 && h.maybe(0.5)) h.perc(t, 'tabla', w);
    // the dulcimer, always from F sharp whatever the chord under it; now and then the last note of a cell is rolled
    const mo = h.m[0] >= 0 ? GR_CELLS[h.m[0]] : null;
    if (mo) for (const [st, semi] of mo) if (st === s) { h.keys(t, h.m[1] + semi, 2.4, 0.24 + h.rnd() * 0.1, 'dulcimer'); if (st === mo[mo.length - 1][0] && h.maybe(0.3)) for (let k = 1; k < 4; k++) h.keys(t + (spb / 2) * k, h.m[1] + semi, 1.6, 0.12 + 0.03 * k, 'dulcimer'); }
    if (s === 0 && bar % 4 === 0) { h.keys(t, root + 12, 4, 0.3, 'piano', -0.2); h.keys(t + 0.03, root + 19, 4, 0.22, 'piano', 0.2); }
    // the strings: one note held and the half step over it creeping in; in a firefight, the same two shivering
    if (x <= 0.65 && s === 0 && bar % 4 === 0 && h.maybe(0.8)) h.strings(t, [root + 31, root + 36], spb * 28, 0.2, 2.2, 'bow');
    if (x <= 0.65 && s === 0 && bar % 4 === 2 && h.maybe(0.5)) h.strings(t, [root + 37], spb * 20, 0.13, 2.8, 'bow');
    if (x > 0.65 && s === 0 && bar % 2 === 0) h.strings(t, [root + 24, root + 31, root + 37], spb * 28, 0.3, 0.3, 'trem');
    if (s === 0 && bar % 8 === 4 && x < 0.3 && h.maybe(0.5)) h.perc(t, 'gong', 0.22);
    if (x < 0.3) return;
    if (s % 2 === 0) h.perc(t, 'shaker', s % 4 === 0 ? 0.6 : 0.35);
    h.easeIn(x, 0.3, 0.55);
    if (!hot) { if (GR_K1[s]) h.perc(t, 'kick', 0.9); if (s === 8) h.perc(t, 'rim', 0.8); if (s === 12 && bar % 2 === 1) h.perc(t, 'brush', 0.5); if (s === 4 && bar % 8 === 7) h.roll(t, spb * 12, 0.5); return; }   // (half time: one stroke on the rim a bar)
    const k = (bar % 2 ? GR_K3 : GR_K2)[s] || (h.maybe(0.05) ? 0.6 : 0); if (k) h.perc(t, 'kick', k);
    if (bar % 4 === 3 && s >= 12) toms(h, t, s - 12, 0.9);
    else if (s === 4 || s === 12) h.perc(t, 'snare', 1); else if (s % 2 === 1 && h.maybe(0.12)) h.perc(t, 'snare', 0.2);
    h.perc(t, (s === 2 || s === 10) && h.maybe(0.3) ? 'hatOpen' : 'hat', s % 2 === 0 ? 0.5 : 0.25);
    if (s === 0 && bar % 8 === 0) h.perc(t, 'crash', 0.6); if (s === 4 && bar % 8 === 7) h.roll(t, spb * 12, 0.7);
    if (s === 0 && bar % 4 === 0) h.keys(t, root, 3, 0.5, 'timp', 0);   // (down where a kettledrum is one)
    for (const [st, semi] of GR_PIZZ) if (st === s) h.keys(t, root + 12 + semi, 0.6, 0.3, 'pizz', 0.25);   // (the cellos, plucking the bass's own line)
    if (s === 0 || s === 10 || ((s === 6 || s === 13) && h.maybe(0.5))) h.reese(t, root - 12 + (s === 0 ? 0 : h.pick([0, 0, 1, 7, -2])), spb * (s === 0 ? 5 : 3));
  },
};

// ---- THE BREAK AND THE BASS. The maintainer, 10-14, of the record he was listening to: "the jazzy breakbeats and phenomenal bass work as the foundation are really what
//      pull me in". The two pieces under this stand on exactly that and nothing else: a drummer's two-bar break on the acoustic kit (ride, ghost notes, a foot on the
//      hat) that is cut and laid back down a beat at a time, and an upright bass LINE — a two-bar figure with pops, slides and passing notes — that is there from the
//      first bar and is the tune. Everything over them is colour. ----
/** two bars of a drummer at the kit, a row a limb: kick, snare (x a backbeat, o a push, - a ghost), ride (x the beat, o the skip, - a tap), the hat under the foot */
interface Break { k: number[]; s: number[]; r: number[]; f: number[] }
const brk = (k: string, s: string, r: string, f: string): Break => ({ k: P(k), s: P(s), r: P(r), f: P(f) });
/** how a bar is put together from the beats of the two written ones (0‥3 this bar's own, 4‥7 the other bar's): whole nearly always, and now and then the way a break is
 *  cut up — its first half said twice, a half borrowed from the other bar, the halves changed over. Whole beats and half bars only: nothing is shredded — and only the
 *  kick and the snare are cut: the ride and the foot keep their own bar, as a drummer's right hand does. */
const CUTS: readonly (readonly number[])[] = [[0, 1, 2, 3], [0, 1, 0, 1], [0, 1, 6, 7], [4, 5, 2, 3], [0, 5, 2, 7], [2, 3, 0, 1]];   // (the last, the halves changed over, is kept for the bars it leaves a kick on the one of: see drum)
/** what turns a phrase over, the bar's last two beats by the sixteenth: s the snare, - a ghost, h l the toms, k the kick, . nothing */
const FILLS4: readonly string[] = ['s-shs.ll', '..s-shhl', 's.-s-.hl', 'hh.ll.sk', '....s-sl'], FILLS3: readonly string[] = ['s-shll', '..shhl', 's.sl.l', 'h.hl.l'];
/** the drummer's own two cells of a piece's memory: the bar's cut, the bar's fill (a piece keeps its own things under 8) */
const CUT = 8, FILL = 9;
/** the sticks are down for this bar (a piece at rest calls it on its bar line instead of `drum`): nothing of the last bar's cut or fill is left to be picked up half way through a later one */
const rest = (h: Hands, s: number) => { if (s === 0) h.m[CUT] = h.m[FILL] = 0; };
/** true once x has risen over `hi`, until it falls under `lo`; it only changes on a bar line (the cell is the piece's): a kit changes gear between bars, not inside one */
const latch = (h: Hands, cell: number, s: number, x: number, lo: number, hi: number) => { if (s === 0) h.m[cell] = x > (h.m[cell] ? lo : hi) ? 1 : 0; return !!h.m[cell]; };
/** one sixteenth of the break `B` in a bar of `steps`. `d` 0‥1 = how hard the drummer plays (the ghosts, the cuts); `soft` = sticks down: the backbeat is one stick
 *  across the rim and the head only ever whispers. The ride and the foot's hat are time, not weight: they are played as written whatever `Hands.ease` is. */
function drum(h: Hands, B: Break, steps: number, s: number, bar: number, t: number, d: number, soft: boolean) {
  const bl = steps / 4, fills = bl === 3 ? FILLS3 : FILLS4;
  if (s === 0) {
    if (h.m[FILL] && !soft && bar % 8 === 0) h.perc(t, 'crash', 0.55);   // (the fill that ends eight bars lands on a cymbal)
    // (never a cut on the bar a phrase begins on; the halves changed over only where that leaves a kick on the one: the second written bar of a break in four)
    h.m[CUT] = !soft && bar % 4 && h.maybe(0.08 + 0.2 * d) ? 1 + Math.floor(h.rnd() * (CUTS.length - (bl === 3 || bar % 2 === 0 ? 2 : 1))) : 0;
    h.m[FILL] = bar % 4 === 3 && h.maybe(soft ? 0.3 : bar % 8 === 7 ? 0.9 : 0.4) ? 1 + Math.floor(h.rnd() * fills.length) : 0;
  }
  const beat = Math.floor(s / bl), own = (bar % 2) * steps + s, ease = h.ease;
  const src = CUTS[h.m[CUT] || 0][beat], i = ((bar + (src >> 2)) % 2) * steps + (src & 3) * bl + s % bl, k = B.k[i], sn = B.s[i];
  const time = (ride: number) => { h.ease = 1; if (ride) h.perc(t, ride >= 1 && !soft && s % (2 * bl) === 0 && h.maybe(0.3) ? 'rideBell' : 'ride', (ride >= 1 ? 0.55 : ride > 0.5 ? 0.42 : 0.26) * (soft ? 0.8 : 1)); if (B.f[own]) h.perc(t, 'hat', 0.4); h.ease = ease; };
  let hands = true;   // (false once a fill has begun: both hands have left the ride)
  if (h.m[FILL] && beat >= 2) {
    const f = fills[h.m[FILL] - 1], j = s - 2 * bl, c = f[j], up = 0.7 + 0.3 * j / (2 * bl), q = soft ? 0.5 : 1;
    if (c !== '.') {   // a stroke of the fill, and the feet under it as written
      if (c === 's') h.perc(t, soft ? 'rim' : 'snare', (soft ? 0.6 : 0.85) * up); else if (c === '-') h.perc(t, 'snare', 0.2); else if (c === 'h') h.perc(t, 'tomHi', 0.75 * up * q); else if (c === 'l') h.perc(t, 'tomLo', 0.8 * up * q);
      if (c === 'k') h.perc(t, 'kick', 0.9 * q); else if (k) h.perc(t, 'kick', (soft ? 0.7 : 1) * k);
      time(0);
      return;
    }
    hands = !/[^.]/.test(f.slice(0, j));   // (a rest inside a fill: the feet play on, the hands stay off the ride)
  }
  if (k) h.perc(t, 'kick', (soft ? 0.7 : 1) * k);
  if (!hands) { /* the sticks are over the toms */ }
  else if (sn >= 1) h.perc(t, soft ? 'rim' : 'snare', soft ? 0.7 : 1);
  else if (sn > 0.5) { if (!soft || h.maybe(0.5)) h.perc(t, 'snare', soft ? 0.3 : 0.6); }
  else if (sn > 0) { if (h.maybe(0.55 + 0.35 * d)) h.perc(t, 'snare', 0.16 + 0.08 * d); }
  else if (!k && s % 2 === 1 && h.maybe(0.07 * d)) h.perc(t, 'snare', 0.15);   // (a ghost nobody wrote)
  time(hands && !(soft && bl === 4 && s % 4 === 2) ? B.r[own] : 0);   // (sticks down, a ride in four leaves out the eighths between the beats: the firefight's ride is in double time over the same backbeat)
}
/** a bass line: two bars of [step, semitones over the root, length in sixteenths, weight (1 when absent), the slide into it (semitones off the note; 0 = plucked clean)].
 *  The notes at full weight are the line's bones and always sound; the rest (pops an octave up, passing notes, pickups) come in with `fill` */
type Line = readonly (readonly [step: number, semis: number, len: number, w?: number, slide?: number])[];
const walk = (h: Hands, L: Line, g: number, t: number, spb: number, root: number, v: number, fill: number) => { for (const [st, semi, len, w = 1, slide = 0] of L) if (st === g && (w >= 1 || h.maybe(fill))) h.pluck(t, root + semi, spb * len * 1.5, v * (0.55 + 0.45 * w), slide); };
/** the fat synth bass under the line when it goes loud: the bones of the same line, with it, or an octave under where a speaker can still say that */
const growl = (h: Hands, L: Line, g: number, t: number, spb: number, root: number, steps: number) => {
  let lowest = 0; for (const [, semi, , w = 1] of L) if (w >= 1 && semi < lowest) lowest = semi;
  const base = root - 12 + lowest >= 28 ? root - 12 : root;   // (the whole line an octave down or not at all — Hands.reese folds a note under E1 up by itself, and note by note that turns a line inside out)
  for (const [st, semi, len, w = 1] of L) if (st === g && w >= 1 && (st % steps === 0 || h.maybe(0.4))) h.reese(t, base + semi, spb * Math.max(2, len) * 0.9);
};

// ---- 6. COLD STORAGE — 172 bpm, G minor: a fast jazz break with the band in half time over it. The bass line is the piece: G, a pop at the octave, the flat seven slid
//         up to the octave, down through the fifth and a chromatic step back up to it. At rest it is the line's bones under a ride and the foot's hat, slow; then the
//         break comes in at speed with a stick on the rim, and a guitar comps off the beat; then the whole break, horns, and the growl under the line. (It was first
//         written at 92 and swung; the maintainer, 10-14, of the one fast piece he had: "love the tempo for dead freight" — so the kit plays at that speed and the band
//         keeps its own.) ----
const CS_BRK = brk('x.........x.....' + 'x.....x...x.....', '....x..-.-..x..-' + '....x.-..-..x.-o', 'x.-.x.o.x.-.x.o.' + 'x.-.x.o.x.-.x.o.', '....x.......x...' + '....x.......x...');   // (the second bar's kick on six is under the bass's fifth; the ride's skip notes are the firefight's — sticks down, it is four to the bar)
const CS_A: Line = [[0, 0, 3], [3, 12, 1, 0.6], [6, 10, 2], [8, 12, 2, 0.8, -2], [11, 7, 2], [14, 5, 1, 0.7], [15, 6, 1, 0.7], [16, 7, 4], [22, 3, 2], [24, 0, 2.5], [27, -2, 2, 0.8], [30, -1, 2, 0.7]];
const CS_B: Line = [[0, 0, 3], [3, 12, 1, 0.6], [6, 10, 2], [8, 12, 1.5, 0.8, -2], [11, 15, 2], [14, 14, 1, 0.7], [15, 12, 1, 0.8], [16, 10, 3], [20, 7, 2], [23, 5, 1, 0.7], [24, 3, 2], [26, 5, 1, 0.7], [27, 3, 1, 0.7], [28, 0, 2], [30, -2, 2, 0.7]];
const CS_OFF: Line = [[0, 0, 3], [3, 12, 1, 0.6], [6, 7, 2], [8, 12, 2, 0.8, -2], [11, 10, 2], [14, 7, 2, 0.7], [16, 0, 4], [22, 7, 2], [24, 12, 2, 0.8], [27, 10, 2, 0.8], [30, 7, 2, 0.7]];
const CS_TURN: Line = [[0, 0, 3], [3, 12, 1, 0.6], [6, 7, 2], [8, 12, 2, 0.8, -2], [11, 10, 2], [14, 7, 2, 0.7], [16, 0, 4], [22, -2, 2], [24, -5, 2], [27, -6, 2, 0.8], [30, -8, 2]];   // (D, and round the G it is going to: C, A, A flat, F sharp)
const CS_FLUTE: readonly (readonly [number, number])[] = [[70, 67], [72, 70], [74, 72], [74, 70], [72, 67], [67, 62]];   // (a note and the one it falls to: G, B flat, C and D only, good over every chord it meets)
const CS_HARP_AB = [0, 4, 7, 10, 14, 18, 19], CS_HARP_D = [0, 3, 6, 9, 12, 15, 18];   // (up the A flat's own chord from A flat; up the diminished chord inside the D's from F sharp)
const coldStorage: Piece = {
  name: 'Cold Storage', key: 'G minor', bpm: 172, steps: 16, swing: 0.04, hold: 4, roots: [31, 31, 34, 32, 31, 31, 36, 38], pad: [360, 3.5], echo: 6,
  warm: [['harp', [...CS_HARP_AB.map(n => 56 + n), ...CS_HARP_D.map(n => 54 + n)]], ['guitar', [53, 58, 62, 69, 56, 62, 65, 72, 54, 60, 63, 70, 52, 58, 67, 54, 60, 63, 69]]],   // (the harp's two runs; the guitar's five chords)
  chord: r => r === 31 ? [r, r + 7, r + 15, r + 21] : r === 38 ? [r, r + 16, r + 22, r + 13] : r === 32 ? [r, r + 7, r + 16, r + 18] : [r, r + 7, r + 16, r + 14],   // (a minor sixth at home, the dorian colour its C chord has; ninths on B flat and C, a sharp fourth on A flat, a flat nine on the D that turns it round)
  levels: x => ({ drums: 0, bass: on(x, 0.6, 1) * 0.36, pad: 0.4 - x * 0.15, sub: 0.3 + x * 0.15, tex: 0.3 }),
  tick(h, s, bar, t, spb, x, root) {
    const hot = latch(h, 5, s, x, 0.5, 0.55), calm = x < 0.2, tonic = root === 31;
    // the band is in half time over the kit: S = its own sixteenth (0‥15; -1 between them) in a bar of two of the kit's, B = that bar, sp = its sixteenth's length
    const S = s % 2 ? -1 : (bar % 2) * 8 + s / 2, B = bar >> 1, sp = spb * 2, g = (B % 2) * 16 + S;
    const L = tonic ? ((B >> 1) % 2 ? CS_B : CS_A) : root === 38 ? CS_TURN : CS_OFF;
    if (S >= 0) {
      if (S === 0) h.sub(t, low(root), 0.6);
      walk(h, L, g, t, sp, root, 0.5 + x * 0.25, on(x, 0.08, 0.4));
      // the guitar: three or four strings off the beat, never on it
      const b = root >= 36 ? root - 12 : root, v4 = root === 38 ? [28, 34, 37, 43] : root === 36 ? [28, 34, 38, 43] : tonic ? [22, 27, 31, 38] : [22, 28, 31, 38];   // (rootless ninths, kept above the bass)
      if ((S === 6 && h.maybe(calm ? 0.25 : 0.6)) || (S === 11 && B % 2 === 1 && h.maybe(calm ? 0.15 : 0.45))) for (let k = calm ? 2 : 0; k < 4; k++) h.keys(t + k * 0.012, b + v4[k], 0.9, 0.2, 'guitar', -0.35);
      // the flute: a long note and the one it falls to, once in eight of its bars; a harp up the chord of the bar that turns the phrase round
      if (!hot && B % 8 === 5) { if (S === 2) { h.m[4] = h.maybe(0.8) ? 1 + Math.floor(h.rnd() * CS_FLUTE.length) : 0; if (h.m[4]) h.wind(t, CS_FLUTE[h.m[4] - 1][0], sp * 8, 0.24, 'flute'); } else if (S === 11 && h.m[4] && h.maybe(0.7)) h.wind(t, CS_FLUTE[h.m[4] - 1][1], sp * 9, 0.18, 'flute'); }
      if (!hot && S === 8 && B % 8 === 7 && h.maybe(calm ? 0.5 : 0.8)) for (let k = 0; k < 7; k++) h.keys(t + sp * 0.4 * k, root === 38 ? 54 + CS_HARP_D[k] : 56 + CS_HARP_AB[k], 2.4, 0.13 + 0.02 * k, 'harp', -0.5 + k * 0.16);
    }
    if (calm) { if (S >= 0 && S % 8 === 0) h.perc(t, 'ride', 0.3); if (S === 4 || S === 12) h.perc(t, 'hat', 0.3); if (S === 0 && B % 8 === 4 && h.maybe(0.4)) h.perc(t, 'gong', 0.18); rest(h, s); return; }   // (the drummer keeping the band's slow time with one hand and a foot)
    h.easeIn(x, 0.2, 0.45);
    drum(h, CS_BRK, 16, s, bar, t, on(x, 0.2, 0.9), !hot);
    if (!hot || S < 0) return;
    growl(h, L, g, t, sp, root, 16);
    if (S === 0 && B % 2 === 0) for (const n of [root + 12, root + 19, root + 22]) h.wind(t, n, sp * 3, 0.24, 'horn');
    if (x > 0.75 && S === 14 && B % 4 === 1) for (const n of [root + 19, root + (tonic ? 23 : 22), root + 26]) h.wind(t, n, sp * 2, 0.22, 'horn');   // (the section's push into the next bar)
  },
};

// ---- 7. WIRE ACT — twelve eight at 98 (the beat goes by at 131), A minor. The same foundation in the other jazz metre: a bell pattern on the ride, a backbeat on two and
//         four of the four slow beats, and a bass line that climbs the blue note. A marimba turns a short cell over it now and then; a clarinet holds long notes underneath.
//         (Kept dark on purpose: no tambourine, no chatter, the marimba silent in a firefight — he has twice called a piece "too upbeat".) ----
const WA_BRK = brk('x.....x....o' + 'x....x..o...', '...x.-..-x..' + '...x..--.x-.', 'x.o.ox.o.x.o' + 'x.o.ox.o.x.o', '...x.....x..' + '...x.....x..');
const WA_A: Line = [[0, 0, 2.5], [3, 7, 1, 0.7], [5, 10, 1, 0.8], [6, 12, 2, 1, -2], [9, 10, 1.5, 0.8], [11, 7, 1, 0.7], [12, 0, 2.5], [15, 3, 1.5], [17, 5, 1, 0.8], [18, 6, 1.5, 1, -1], [20, 7, 2], [22, -2, 1, 0.7], [23, -1, 1, 0.7]];
const WA_B: Line = [[0, 0, 2.5], [3, 12, 1, 0.6], [5, 10, 1, 0.8], [6, 7, 2], [9, 5, 1.5, 0.8], [11, 3, 1, 0.8], [12, 0, 2], [14, -2, 1, 0.7], [15, 0, 1.5], [18, 3, 1.5], [20, 5, 1, 0.8], [21, 7, 2, 1, -1], [23, 2, 1, 0.7]];
const WA_OFF: Line = [[0, 0, 2.5], [3, 7, 1, 0.7], [5, 10, 1, 0.8], [6, 12, 2, 1, -2], [9, 10, 1.5, 0.8], [11, 7, 1, 0.7], [12, 0, 2.5], [15, 7, 1.5], [18, 6, 1.5, 0.8], [20, 7, 2], [22, 10, 2, 0.7]];   // (the sharp fourth, as the chords over it have it)
const WA_PENT = [0, 3, 5, 7, 10], WA_FLAT = [0, 4, 6, 7, 10], WA_CELLS: readonly Motif[] = [[[0, 5], [2, 4], [3, 5], [6, 7]], [[1, 3], [3, 4], [4, 3], [6, 2], [9, 0]], [[0, 7], [3, 6], [6, 5], [8, 4], [9, 5]], [[6, 2], [8, 3], [9, 2], [11, 0]], [[0, 0], [1, 2], [3, 0], [9, 4]]];
const WA_REED = [57, 60, 64, 62, 55];
const wireAct: Piece = {
  name: 'Wire Act', key: 'A minor', bpm: 98, steps: 12, swing: 0, hold: 2, roots: [33, 33, 36, 33, 33, 33, 31, 32], pad: [380, 4], echo: 3,
  chord: r => r === 33 ? [r, r + 7, r + 15, r + 10] : r === 32 ? [r, r + 7, r + 16, r + 18] : [r, r + 7, r + 16, r + 10],   // (a minor seventh at home; sevenths on C and G, and the A flat a half step under home with its sharp fourth)
  levels: x => ({ drums: 0, bass: on(x, 0.6, 1) * 0.36, pad: 0.42 - x * 0.15, sub: 0.3 + x * 0.15, tex: 0.3 }),
  tick(h, s, bar, t, spb, x, root) {
    const hot = latch(h, 5, s, x, 0.5, 0.55), calm = x < 0.2, tonic = root === 33, g = (bar % 2) * 12 + s;
    const L = tonic ? (Math.floor(bar / 2) % 2 ? WA_B : WA_A) : WA_OFF;
    if (s === 0) { h.sub(t, low(root), 0.6); h.m[4] = h.maybe(calm ? 0.3 : hot ? 0 : 0.35) ? Math.floor(h.rnd() * WA_CELLS.length) : -1; }
    walk(h, L, g, t, spb, root, 0.46 + x * 0.25, on(x, 0.08, 0.4));
    // the marimba: a cell a bar, or none; from A — and over the A flat from A flat, on that chord's own notes (its major third and sharp fourth)
    const mo = h.m[4] >= 0 ? WA_CELLS[h.m[4]] : null;
    if (mo) for (const [st, d] of mo) if (st === s) h.keys(t, root === 32 ? 56 + deg(WA_FLAT, d) : 57 + deg(WA_PENT, d), 1.2, 0.22 + h.rnd() * 0.1, 'marimba', d % 2 ? 0.4 : -0.3);
    if (x < 0.7 && bar % 4 === 2 && s === 3 && h.maybe(0.7)) h.wind(t, h.pick(root === 32 ? [60, 62, 63] : WA_REED), spb * 14, 0.22, 'clarinet');
    if (x <= 0.65 && s === 0 && bar % 8 === 0 && h.maybe(0.7)) h.strings(t, [root + 31, root + 36], spb * 30, 0.18, 2.4, 'bow');
    // one hand on a shaker until the sticks come up: the beat and the note before it
    const w = on(x, 0.05, 0.15);
    if (calm && w > 0 && s % 3 !== 1) h.perc(t, 'shaker', (s % 3 === 0 ? 0.5 : 0.25) * w);
    if (calm) { if (s % 6 === 0) h.perc(t, 'ride', 0.3); rest(h, s); return; }
    h.easeIn(x, 0.2, 0.45);
    drum(h, WA_BRK, 12, s, bar, t, on(x, 0.2, 0.9), !hot);
    if (!hot) return;
    growl(h, L, g, t, spb, root, 12);
    if ((s === 0 && bar % 2 === 0) || (s === 9 && bar % 4 === 3)) for (const n of [root + 12, root + 19, root + 22]) h.wind(t, n, spb * 2.5, 0.24, 'horn');
    if (x > 0.65 && s === 0 && bar % 4 === 0) h.strings(t, [root + 24, root + 31, root + 34], spb * 22, 0.28, 0.3, 'trem');
  },
};

/** the pieces beside the theme, in no order that matters (music.ts deals them from a bag); the theme itself is music.ts's own tick, as it always was */
export const PIECES: readonly Piece[] = [nightShift, paperWalls, deadFreight, undertow, glassRain, coldStorage, wireAct];
/** every piece of the score by name, the theme first (index 0 = music.ts's own; i > 0 = PIECES[i - 1]) */
export const PIECE_NAMES: readonly string[] = [THEME.name, ...PIECES.map(p => p.name)];
