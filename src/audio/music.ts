// Generative score: dark drones + sub pulses at rest, glitchy synthesized breakbeats and a distorted reese bass as guard alertness rises. THE SEQUENCER lives here (a 25 ms look-ahead
// scheduler on `intensity`: bars, the chord movement, the sub pulse, the texture, the breakbeat, the phrase-end glitches, the reese line — every decision and every random draw
// exactly as before the split); the VOICES live behind `MusicBackend` (musicBackend.ts): the page's Web Audio node graph node for node (`WebAudioMusicBackend`; a native host's
// synth was the other backend, since removed). Every random number a voice takes is drawn HERE and handed over, so the rnd stream and the
// notes it decides are byte for byte the page's whatever plays them.
// MORE THAN THE ONE THEME (pieces.ts, MUSIC.pieces — ON in the page, `?onetheme` off; OFF in the module and on the frozen stand): seven newer pieces take turns with the theme
// here. `piece` says which is playing (0 = the theme: `tick` below, untouched); `turn` at each bar line is where one hands over to the next — a bar of swell, then the new
// piece from its first bar. Which comes next is the level's own list (setlist.ts, MUSIC.byLevel: `setlist` below), or with that off a shuffled bag on the PAGE's die
// (sysRandom: not the sequencer's stream, never the game's). With the switch off none of it
// draws, schedules or builds anything: the theme's stream is what it was (tools/qa/music-check.ts).
import type { MusicBackend, NoiseDice, PieceVoices } from './musicBackend';
import { midi } from './musicBackend';
import { sysRandom } from '../math/dice';
import { MUSIC, PIECES, PIECE_NAMES, Hands, drawMetal, type Piece } from './pieces';
export { midi, makeDrive, WebAudioMusicBackend } from './musicBackend';
export type { MusicBackend } from './musicBackend';
export { MUSIC, PIECE_NAMES } from './pieces';

export class Music {
  intensity = 0;            // target 0..1 (0 = undetected, ~0.5 = suspicious, 1 = firefight)
  private cur = 0;
  private bpm = 87; private step = 0; private nextT = 0; private timer: ReturnType<typeof setInterval> | null = null;
  private bar = 0;
  private roots = [38, 38, 34, 41, 38, 36, 34, 33];   // D2 D2 Bb1 F2 | D2 C2 Bb1 A1 — brooding minor movement
  private chordI = 0;
  enabled = true;
  /** times the sequencer found itself more than 50 ms behind the clock and jumped to now instead of playing the backlog (W8.8 — a throttled background tab, a long
   *  main-thread stall: the old catch-up loop scheduled every missed sixteenth at once, a burst of two seconds of drums in one 25 ms tick) */
  resyncs = 0;
  private rnd: () => number;
  /** notes handed to the backend since start (QA / the panel) */
  notes = 0;
  /** which piece is playing: 0 = the theme (`tick` below), i > 0 = pieces.ts PIECES[i − 1] (PIECE_NAMES[i] names it) */
  piece = 0;
  /** pieces begun since start (the first deal counts) */
  changes = 0;
  /** the newer pieces' voices over this backend; null on a backend without them (it plays the theme alone) */
  private hands: Hands | null;
  private dealt = false; private bag: number[] = []; private since = 0; private want = -1; private leaving = false; private more = false;
  /** THE MAIN MENU IS UP (main.ts: the title and its start pages). The maintainer, 10-14: "we should only have the main theme on the main menu" — so while it is, the
   *  score is the theme and nothing is dealt; the deal begins when play does (at the next bar line, behind the lead-out, when the theme was already sounding), and a visit
   *  that comes back to the menu comes back to the theme. A piece picked by hand (the panel) is left alone until the menu next opens or closes. */
  get menu() { return this.menuUp; }
  set menu(v: boolean) { if (v !== this.menuUp) { this.menuUp = v; this.byHand = false; } }
  private menuUp = false; private byHand = false;
  /** the menu's rule holds now: nothing is dealt, by the clock or by a mission */
  private get themeOnly() { return this.menuUp && !this.byHand; }

  /** `own` = keep its own 25 ms timer (the page); false = the caller turns it with pump() (an offline render stepping the clock itself) */
  constructor(private be: MusicBackend & Partial<PieceVoices>, own = true) {
    let s = 0x9e3779b9; this.rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
    this.hands = be.pluck ? new Hands(be as MusicBackend & PieceVoices, this.rnd, () => { this.notes++; }) : null;
    this.nextT = be.now() + 0.3;
    if (own) this.timer = setInterval(() => this.schedule(), 25);
  }
  /** one turn of the scheduler, for a caller that keeps the clock (see the constructor) */
  pump() { this.schedule(); }

  stop() { if (this.timer !== null) { clearInterval(this.timer); this.timer = null; } this.be.stop(); }
  setVolume(v: number) { this.be.setMaster(v, 0.2); }
  get pieceName() { return PIECE_NAMES[this.piece]; }
  /** the piece asked for, when a handover is on its way; else the one playing (what a picker shows) */
  get picked() { return this.want >= 0 ? this.want : this.piece; }
  /** the Piece playing; null = the theme */
  private get playing(): Piece | null { return this.piece ? PIECES[this.piece - 1] : null; }
  /** a mission began (main.ts: the Game dealt a fresh encounter — not a load, not a show's scratch copy). Once the piece playing has had MUSIC.missionAfter seconds the new mission gets the next one; a quick
   *  restart keeps its music. */
  mission() { if (MUSIC.pieces && this.hands && this.dealt && !this.themeOnly && !this.own && this.want < 0 && this.be.now() - this.since > MUSIC.missionAfter) this.want = this.next(); }   // (a level with music of its own keeps it across its restarts: the clock alone turns its list)
  /** ask for piece i by hand (the listening page, the panel): at the next bar line behind a bar of swell, or `now` = cut to its first bar at once */
  setPiece(i: number, now = false) {
    if (!this.hands || !(i >= 0 && i < PIECE_NAMES.length)) return;
    this.dealt = true; this.byHand = true;
    if (now) { this.begin(i, this.be.now() + 0.05); this.nextT = this.since; }
    else if (i === this.piece) { this.want = -1; this.leaving = false; }   // (picking the piece that is playing calls off a handover on its way)
    else { this.want = i; this.leaving = false; }
  }
  /** THE LEVEL'S OWN MUSIC (setlist.ts; the maintainer, 10-15: "we should curate the music for each level, not do it randomly"): the pieces written down for the level this
   *  page is on, in their order, as PIECE_NAMES indices (main.ts says which, once, through AudioEngine.scoreSet). With MUSIC.byLevel on and a list here nothing is drawn from
   *  the bag: play opens on the list's first piece, the clock hands over to the one after the piece playing and round again, and a new mission on the same list keeps
   *  the music it has (a retry is not a new piece). A piece picked by hand that is not on the list plays on until the clock's next handover, which is to the list's first. */
  get setlist() { return this.list; }
  set setlist(l: readonly number[] | null) {   // (a list that is another level's or another kind of mission's, said while play is on: its first piece at the next bar line, unless the piece playing is on it)
    const was = this.own?.join(); this.list = l; const own = this.own;
    if (own && own.join() !== was && this.dealt && !this.themeOnly && !own.includes(this.picked)) this.want = own[0];
  }
  private list: readonly number[] | null = null;
  private get own(): readonly number[] | null { return MUSIC.byLevel && this.list && this.list.length ? this.list : null; }
  /** the next piece: the level's own list in its order (the one after the piece playing; its first when the piece playing is not the level's), else off the bag — every
   *  piece but the one playing, shuffled on the page's own die, refilled when it runs out, so the visit opens with the newer pieces in some order and the theme comes
   *  round after them */
  private next(): number {
    const own = this.own; if (own) return own[(own.indexOf(this.piece) + 1) % own.length];
    this.bag = this.bag.filter(i => i !== this.piece);   // (never the piece playing: one picked by hand may still be in the bag)
    if (!this.bag.length) {
      this.bag = PIECE_NAMES.map((_, i) => i).filter(i => i !== this.piece);
      for (let i = this.bag.length - 1; i > 0; i--) { const j = Math.floor(sysRandom() * (i + 1)); const a = this.bag[i]; this.bag[i] = this.bag[j]; this.bag[j] = a; }
    }
    return this.bag.pop()!;
  }
  /** piece i from its first bar at t */
  private begin(i: number, t = this.nextT) {
    this.piece = i; this.want = -1; this.leaving = false; this.step = 0; this.bar = 0; this.chordI = 0; this.since = t; this.changes++;
    this.hands!.m.length = 0;
    const p = this.playing;
    this.be.padTone!(p ? p.pad[0] : 420, p ? p.pad[1] : 4);
    if (p) { this.be.echo!(60 / p.bpm / 4 * p.echo); this.more = true; for (const [kind, notes] of p.warm ?? []) this.be.warmTuned!(kind, notes.map(midi)); }
  }
  /** at a bar line starting at t: does another piece begin here? A piece that has had MUSIC.minutes hands over at the end of a four-bar phrase once the floor is calm
   *  (after twice that, whatever the floor is doing); the bar before the handover is the lead-out, under a swell. True = it began (the step counter is the new piece's). */
  private turn(t: number, barLen: number, x: number): boolean {
    if (!this.hands) return false;
    if (this.want >= 0 && this.leaving) { this.begin(this.want, t); return true; }
    if (this.want < 0 && MUSIC.pieces && this.dealt && this.bar % 4 === 3) { const age = t - this.since, lim = MUSIC.minutes * 60; if (age > lim * 2 || (age > lim && x < 0.3)) { const n = this.next(); if (n !== this.piece) this.want = n; } }   // (a list of one piece plays on)
    if (this.want >= 0) { this.leaving = true; this.swell(t, barLen); }
    return false;
  }

  private schedule() {
    const be = this.be;
    if (this.themeOnly) {   // on the main menu: the theme, and back to it (a lead-out already sounding is the one that hands back; a handover on its way from the theme is called off)
      this.dealt = false;
      if (this.piece !== 0) this.want = 0; else if (this.want > 0) { this.want = -1; this.leaving = false; }
    } else if (!this.dealt) {   // play opens on one of the newer pieces: at once when nothing has sounded yet, else handed over from the menu's theme — and a piece the menu never took back plays on
      this.dealt = true;
      if (!MUSIC.pieces || !this.hands) { /* the theme alone */ }
      else if (!(this.step || this.bar)) this.begin(this.next());
      else if (this.piece === 0) { if (this.want < 0) this.want = this.next(); }
      else if (this.want === 0) { this.want = -1; this.leaving = false; }
    }
    // smooth intensity
    this.cur += (this.intensity - this.cur) * 0.04;
    const x = this.enabled ? this.cur : 0;
    const cur = this.playing;
    if (cur) { const l = cur.levels(x), e = this.enabled; be.setLevels({ drums: l.drums, drumsTc: 0.4, bass: l.bass, bassTc: 0.6, pad: e ? l.pad : 0, padTc: 1.5, sub: e ? l.sub : 0, subTc: 0.8, tex: e ? l.tex : 0, texTc: 0.8 }); }
    else be.setLevels({ drums: x < 0.25 ? 0 : Math.min(1, (x - 0.25) / 0.5) * 0.9, drumsTc: 0.4, bass: x < 0.6 ? 0 : (x - 0.6) / 0.4 * 0.42, bassTc: 0.6,
      pad: this.enabled ? 0.5 - x * 0.2 : 0, padTc: 1.5, sub: this.enabled ? 0.45 + x * 0.25 : 0, subTc: 0.8, tex: this.enabled ? 0.35 : 0, texTc: 0.8 });
    if (this.more) be.setMore!(this.enabled ? 1 : 0, 0.5);
    const now = be.now();
    // Fallen behind the clock (the timer was throttled in a background tab, or the main thread stalled): the sixteenths we missed are gone — pick the phrase up from NOW.
    // Scheduling them all "at" times already past plays every one of them this instant: the machine-gun burst of drums on coming back to the tab.
    if (this.nextT < now - 0.05) { this.nextT = now + 0.05; this.resyncs++; }
    while (this.nextT < now + 0.12) {
      const p = this.playing, steps = p ? p.steps : 16, spb = 60 / (p ? p.bpm : this.bpm) / 4;   // 16th note
      if (this.step % steps === 0 && this.turn(this.nextT, spb * steps, x)) continue;
      if (p) this.tickPiece(p, this.step % steps, this.nextT, spb, x); else this.tick(this.step, this.nextT, spb, x);
      this.step++; if (this.step % steps === 0) this.bar++;
      // subtle swing on odd 16ths
      this.nextT += spb * (p ? (this.step % 2 === 1 ? 1 + p.swing : 1 - p.swing) : this.step % 2 === 1 ? 1.08 : 0.92);
    }
  }

  /** one sixteenth of a newer piece: its chord's turn at the head of every `hold` bars, then the piece's own tick */
  private tickPiece(p: Piece, s: number, t: number, spb: number, x: number) {
    if (s === 0 && this.bar % p.hold === 0) { if (this.bar) this.chordI = (this.chordI + 1) % p.roots.length; this.hands!.pad(t, p.chord(p.roots[this.chordI])); }
    this.hands!.ease = 1;
    p.tick(this.hands!, s, this.bar, t, spb, x, p.roots[this.chordI]);
  }

  private tick(step: number, t: number, spb: number, x: number) {
    const s16 = step % 16; const bar = this.bar;
    // chord movement every 2 bars
    if (s16 === 0 && bar % 2 === 0) {
      this.chordI = (this.chordI + 1) % this.roots.length; const root = this.roots[this.chordI];
      this.be.padChord(t, [midi(root), midi(root), midi(root + 7), midi(root + 19)], 0.8);
    }
    const root = this.roots[this.chordI];
    // sub pulse: on 1 and the "and" of 3, longer when calm
    if (s16 === 0 || (s16 === 10 && this.rnd() < 0.6 + x * 0.3)) this.sub(t, midi(root - 12), x > 0.6 ? 0.35 : 0.7);
    // texture: sparse metallic / granular hits when calm, radio-ish blips
    if (this.rnd() < (s16 % 4 === 2 ? 0.1 : 0.03)) this.metal(t, 0.15 + this.rnd() * 0.2);
    if (x < 0.3 && s16 === 12 && bar % 4 === 3) this.swell(t, spb * 8);
    if (x < 0.25) return;
    // ---- breakbeat (synth kit). Two-bar phrase with probabilistic ghost notes and end-of-phrase stutters.
    const dens = Math.min(1, (x - 0.25) / 0.6);
    const kick = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0][s16] || (this.rnd() < 0.08 * dens ? 1 : 0);
    const snare = (s16 === 4 || s16 === 12) ? 1 : (this.rnd() < 0.12 * dens && s16 % 2 === 1 ? 0.35 : 0);
    const hat = s16 % 2 === 0 ? 0.5 : (this.rnd() < 0.55 * dens ? 0.28 : 0);
    if (kick) this.kick(t, kick === 1 ? 1 : 0.6);
    if (snare) this.snare(t, snare);
    if (hat) this.hat(t, hat, this.rnd() < 0.1);
    // phrase-end glitch: 1/32 or 1/48 snare rolls, reversed noise
    if (bar % 2 === 1 && s16 >= 12 && this.rnd() < 0.5 * dens) { const n = this.rnd() < 0.5 ? 2 : 3; for (let k = 1; k < n; k++) this.snare(t + (spb / n) * k, 0.3 + 0.15 * k, 1800 + 900 * k); }
    if (s16 === 15 && bar % 4 === 3 && this.rnd() < 0.7) this.reverseNoise(t + spb * 0.2, spb * 0.8);
    // reese bass line when things kick off
    if (x > 0.6 && (s16 === 0 || s16 === 3 || s16 === 8 || (s16 === 11 && this.rnd() < 0.6) || (s16 === 14 && this.rnd() < 0.4))) {
      const nn = root - 12 + [0, 0, 0, 3, -2, 5, 0, 7][Math.floor(this.rnd() * 8)];
      this.reese(t, midi(nn), spb * (s16 === 0 ? 2.8 : 1.6));
    }
  }

  // ---- voices: the dice drawn here in the order the graph drew them, then the backend ----
  /** a noise voice's dice: playback rate, then start offset (the order the buffer source took them) */
  private noiseDice(): NoiseDice { return { rate: 0.9 + this.rnd() * 0.2, offset: this.rnd() * 1.5 }; }
  private sub(t: number, f: number, len: number) { this.notes++; this.be.sub(t, f, len); }
  private kick(t: number, v: number) { this.notes++; this.be.kick(t, v, this.noiseDice()); }   // (the click's noise was made after the sine: its dice come after nothing else's)
  private snare(t: number, v: number, tone = 1900) { this.notes++; const d = this.noiseDice(); this.be.snare(t, v, tone, d); }   // (the noise first, then the tone: the noise's dice first)
  private hat(t: number, v: number, open: boolean) { this.notes++; this.be.hat(t, v, open, this.noiseDice()); }
  private metal(t: number, v: number) {
    this.notes++;
    this.be.metal(t, v, drawMetal(this.rnd));
  }
  private swell(t: number, len: number) { this.notes++; this.be.swell(t, len); }
  private reverseNoise(t: number, len: number) { this.notes++; this.be.reverseNoise(t, len); }
  private reese(t: number, f: number, len: number) { this.notes++; this.be.reese(t, f, len); }
}
