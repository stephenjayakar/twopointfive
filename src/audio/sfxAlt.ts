// OTHER TAKES of voices the maintainer was not happy with, to pick between on the listening page and on a sound replay's lanes (replay/soundlanes.ts):
// two more ways each of the fourteen he filed under 'toys' (10-12) could go, and one more of each of the four he flagged on the lanes (10-13: propScrape,
// propThud, lockBreak, magDrop — those four were also redone in the game's table to his note, so the take here is a second answer to the same note).
// NOTHING HERE IS IN THE GAME'S TABLE: buildSfx / gameSfx never ask this file, a take is rendered the first time somebody asks for it and loaded beside the
// game's buffer under a name of its own (`audio.loadTake`). A TAKE HE PICKS IS MOVED INTO sfx.ts BY HAND and its place here becomes `PICKED` (10-13: footHard
// new 1, magIn new 2, rack new 2; 10-24: grabCatch new 1, gunStrip new 2), so the take beside it keeps its number; a picked place renders nothing and is offered nowhere (`altPicked`).
// Each tells another physical story than the voice it stands beside, and leans on what the toys lacked: contacts as short bands of noise, bodies as many
// close modes that die at once, air and cloth — not a few notes left ringing. Each is set to the level of the voice it could replace (sfx.ts HEARD, or the two
// measured rows below), so a pick changes the sound and not how loud it is. They were made and measured where nothing can be listened to.
// THE GRAB'S THREE BEATS (grabCatch, gunStrip, gunDown: new voices of 10-23, written blind) have two other takes each as well — not a note answered but another
// idea of the same beat to choose from: more cloth or a harder slap, a rattle or one snap and a click, set down soft or knocked down hard.
// He chose on 10-24: the catch's 'new 1' and the strip's 'new 2' are the game's voices, and the gun on the floor stays the first one written (its two
// other takes are still here to hear beside it).
import type { SfxBuffer, SfxContext } from './backend';
import { HEARD, SLIDE, clack, cluster, knock, thud, tuned, vary, voiced, type SfxName } from './sfx';
import { biquad, peakTo, type Mode, type Tune, type Voice } from './synth';

interface Take { say: string; dur: number; seed: number; fn: (v: Voice) => void; picked?: true }
/** a take he PICKED (10-13): its recipe is the game's own voice now, in sfx.ts. Its place in the list stays, so 'new 2' still names the take it named when he chose */
const PICKED: Take = { say: 'picked: the game plays this one now', dur: 0, seed: 0, fn: () => {}, picked: true };

/** as loud to the ear as the game's own voice, for the two toys sfx.ts levels another way (measured off its buffers at 48 kHz) */
const AS: Partial<Record<SfxName, number>> = { chokeLimp: 0.108, wallDebris: 0.206 };

/** how tall the voice stands so far: what is laid beside a throat is sized against it */
const peak = (v: Voice): number => { let pk = 1e-6; for (let i = 0; i < v.n; i++) pk = Math.max(pk, Math.abs(v.out[i])); return pk; };
/** three bumps of pitch over the protest's 0.42 s */
const TAU3 = Math.PI * 2 * 3 / 0.42;
/** syllables: [start, length, weight] rows as one amplitude curve */
const syllables = (rows: readonly (readonly [number, number, number])[], pow = 1) => (t: number): number => {
  let a = 0; for (const [s, l, w] of rows) if (t >= s && t < s + l) a += w * Math.pow(Math.sin(Math.PI * (t - s) / l), pow); return a;
};

const TAKES: Partial<Record<SfxName, readonly Take[]>> = {
  rifleSuppressed: [
    { say: 'gas, then the action', dur: 0.5, seed: 9101, fn: v => {
      const d = v.layer();
      v.blast(0, 0.0011, 0.5, d);                                                                       // what the can lets through of the front
      v.hiss(0, 250, 5200, 0.0006, 0.009, 1.7, d); v.hiss(0, 250, 2400, 0.002, 0.03, 0.7, d); v.hiss(0.004, 500, 1600, 0.006, 0.07, 0.22, d);   // the gas: its burst, the can emptying, the leak
      v.hiss(0, 90, 320, 0.001, 0.02, 1.1, d);
      v.slaps(d, [[2.9, 0.3, 6000], [6.8, -0.24, 4200], [13.5, 0.18, 3000], [24, -0.12, 2200], [41, 0.08, 1600]]);
      clack(v, 0.03, 700, 5000, 0.02, 0.55, d);                                                         // the carrier on its buffer
      clack(v, 0.066, 450, 4600, 0.028, 0.8, d); v.hiss(0.066, 120, 420, 0.001, 0.015, 0.4, d);         // and home
      v.add(peakTo(d)); v.drive(1.15);
      v.tail(0.008, [[150, 900, 0.16, 0.1], [900, 3500, 0.11, 0.08]], 0.01);
    } },
    { say: 'the round’s crack, a muffled thump', dur: 0.6, seed: 9102, fn: v => {
      const d = v.layer();
      v.blast(0, 0.00028, 0.9, d); knock(v, 0, 2000, 12000, 0.0015, 1.3, d);                           // the round going past the sound it makes
      v.hiss(0.003, 120, 700, 0.001, 0.02, 1.6, d); v.hiss(0.003, 600, 3000, 0.002, 0.012, 0.6, d);     // the muzzle, in the can
      v.slaps(d, [[3.4, 0.36, 7000], [7.9, -0.3, 5200], [15, 0.24, 3800], [26, -0.19, 2900], [39, 0.15, 2300], [58, -0.11, 1800], [83, 0.07, 1400]]);
      clack(v, 0.034, 800, 4500, 0.016, 0.3, d); clack(v, 0.07, 500, 4200, 0.022, 0.45, d);
      v.add(peakTo(d)); v.drive(1.1);
      v.tail(0.01, [[200, 1200, 0.3, 0.12], [1200, 5000, 0.2, 0.1]], 0.012);
    } },
  ],
  magOut: [
    { say: 'polymer, dragged out of the well', dur: 0.26, seed: 9111, fn: v => {
      knock(v, 0, 1800, 7000, 0.0015, 0.7); v.ring(0, cluster(v, 1400, 5200, 5, 0.006), 0.0004, 0.3);   // the release
      v.hiss(0.018, 600, 3200, 0.03, 0.03, 0.5); v.hiss(0.018, 250, 700, 0.03, 0.04, 0.35);             // the drag, and the well's hollow
      knock(v, 0.105, 250, 1500, 0.008, 0.8); v.ring(0.105, cluster(v, 320, 1700, 6, 0.02), 0.0015, 0.3);   // clear of it
      for (let k = 0; k < 3; k++) knock(v, 0.118 + 0.011 * k + 0.004 * v.u(), 1500, 4500, 0.002, 0.18 * (1 - k * 0.2));   // the rounds shift
      v.hiss(0.15, 90, 600, 0.004, 0.02, 0.4);                                                          // into the palm
    } },
    { say: 'steel, stripped fast', dur: 0.2, seed: 9112, fn: v => {
      clack(v, 0, 1500, 6500, 0.007, 0.9);
      v.hiss(0.01, 1800, 6000, 0.012, 0.016, 0.45); v.ring(0.012, cluster(v, 900, 3800, 8, 0.03), 0.02, 0.22);   // sheet steel along the well's lip
      clack(v, 0.06, 700, 3600, 0.03, 0.7);
      for (let k = 0; k < 4; k++) knock(v, 0.07 + 0.009 * k + 0.004 * v.u(), 1200, 3800, 0.0022, 0.22 * (1 - k * 0.18));
    } },
  ],
  magIn: [
    { say: 'seated with the heel of the hand', dur: 0.24, seed: 9121, fn: v => {
      knock(v, 0, 900, 3600, 0.004, 0.3); v.hiss(0.008, 500, 2800, 0.02, 0.022, 0.45);                  // finds the well, slides up
      v.hiss(0.075, 80, 700, 0.002, 0.022, 1.0); clack(v, 0.078, 380, 3400, 0.022, 0.85);               // the palm, and the receiver taking it
      knock(v, 0.084, 2500, 7000, 0.0012, 0.5); v.ring(0.084, [[2900, 0.005, 1], [4700, 0.004, 0.6]], 0.0003, 0.2);   // the catch
    } },
    PICKED,
  ],
  rack: [
    { say: 'charging handle: back, let go, home', dur: 0.46, seed: 9131, fn: v => {
      knock(v, 0, 1500, 6000, 0.0015, 0.35);                                                            // the latch
      for (let k = 0; k < 8; k++) v.hiss(0.01 + k * 0.011, 900, 4200, 0.003, 0.006, 0.26 + 0.03 * k);   // the carrier dragged back against its spring
      v.hiss(0.01, 300, 1100, 0.04, 0.04, 0.3);
      clack(v, 0.105, 500, 4500, 0.025, 0.8);                                                           // the rear stop
      v.hiss(0.125, 1200, 5000, 0.03, 0.01, 0.35);                                                      // let go: it runs
      clack(v, 0.165, 400, 5000, 0.03, 1.0); v.hiss(0.165, 110, 420, 0.001, 0.018, 0.5);                // home
      v.ring(0.168, [[212, 0.12, 1], [229, 0.1, 0.8], [431, 0.06, 0.4]], 0.004, 0.07);                  // the buffer spring, a moment
    } },
    PICKED,
  ],
  footHard: [
    PICKED,
    { say: 'a rubber sole, grit under it', dur: 0.26, seed: 9142, fn: v => {
      const j = 1 + 0.08 * v.rnd();
      v.hiss(0, 60 * j, 520 * j, 0.0015, 0.016, 1.0); v.hiss(0, 400, 1600, 0.001, 0.007, 0.3);
      v.hiss(0.02, 1500, 5000, 0.02, 0.045, 0.2);                                                       // the sole turning on grit
      v.hiss(0.08 + 0.01 * v.u(), 180, 900, 0.008, 0.024, 0.45);
      for (let k = 0; k < 5; k++) knock(v, 0.03 + 0.09 * v.u(), 3000, 8000, 0.001, 0.07);
    } },
  ],
  doorBang: [
    { say: 'a solid leaf into its frame', dur: 0.75, seed: 9151, fn: v => {
      const d = v.layer();
      v.hiss(0, 45, 300, 0.002, 0.06, 1.4, d); v.ring(0, [[52, 0.3, 1], [71, 0.22, 0.7], [96, 0.16, 0.5]], 0.006, 0.5, 0, d);
      knock(v, 0, 150, 2600, 0.009, 1.2, d); v.ring(0, cluster(v, 140, 1100, 10, 0.07), 0.002, 0.45, 0, d);   // the leaf's slap
      clack(v, 0.012, 1000, 5000, 0.012, 0.5, d);                                                       // the latch goes home under it
      knock(v, 0.06, 200, 1800, 0.008, 0.3, d); knock(v, 0.105, 250, 1500, 0.008, 0.16, d);             // the frame settles
      v.slaps(d, [[4.2, 0.4, 5000], [9.6, -0.3, 3600], [17, 0.24, 2600], [29, -0.18, 2000], [47, 0.12, 1500]]);
      v.add(d); v.tail(0.01, [[60, 300, 0.5, 0.2], [300, 1500, 0.35, 0.16], [1500, 5000, 0.2, 0.06]], 0.012);
    } },
    { say: 'a hollow door: a flat whap', dur: 0.45, seed: 9152, fn: v => {
      const d = v.layer();
      knock(v, 0, 180, 1400, 0.012, 1.4, d); v.ring(0, cluster(v, 190, 900, 9, 0.05), 0.003, 0.5, 0, d);    // the skins drumming on the air between them
      v.hiss(0, 70, 260, 0.003, 0.03, 0.6, d);
      knock(v, 0.008, 1500, 5000, 0.002, 0.4, d);
      knock(v, 0.05, 1200, 4000, 0.002, 0.2, d); knock(v, 0.074, 1400, 4200, 0.002, 0.12, d);          // the handle rattles in its rose
      v.slaps(d, [[3.8, 0.34, 5000], [8.7, -0.25, 3600], [16, 0.18, 2600], [28, -0.1, 2000]]);
      v.add(d); v.tail(0.01, [[150, 900, 0.25, 0.14], [900, 4000, 0.15, 0.06]], 0.01);
    } },
  ],
  doorLatch: [
    { say: 'lever down, bolt back, lever let go', dur: 0.22, seed: 9161, fn: v => {
      v.hiss(0, 500, 2200, 0.012, 0.012, 0.3);                                                          // the spring loading
      clack(v, 0.022, 1100, 5200, 0.008, 0.8); v.hiss(0.022, 150, 600, 0.002, 0.012, 0.35);             // the bolt back; the door takes it
      clack(v, 0.085, 850, 4400, 0.01, 1.0);                                                            // the lever snaps up
      v.hiss(0.085, 120, 520, 0.002, 0.018, 0.5); v.ring(0.085, [[118, 0.07, 1], [176, 0.05, 0.7]], 0.004, 0.12);
    } },
    { say: 'the bolt dropping into its keep', dur: 0.16, seed: 9162, fn: v => {
      v.hiss(0, 1400, 4200, 0.01, 0.004, 0.35);                                                         // riding up the strike plate
      knock(v, 0.014, 300, 2400, 0.006, 1.0); v.ring(0.014, cluster(v, 400, 2600, 7, 0.018), 0.001, 0.4);
      v.hiss(0.014, 100, 450, 0.002, 0.02, 0.6);
    } },
  ],
  doorRattle: [
    { say: 'the lever worked twice, the leaf against its bolt', dur: 0.5, seed: 9171, fn: v => {
      const at = [0, 0.07, 0.19, 0.25, 0.335];
      for (let k = 0; k < at.length; k++) {
        const t = at[k] + 0.008 * v.u(), w = (k & 1 ? 0.7 : 1) * (0.75 + 0.25 * v.u());
        clack(v, t, 900, 4500, 0.009, 0.7 * w);
        v.hiss(t + 0.004, 100, 700, 0.002, 0.012, 0.6 * w);                                             // the leaf, held, knocking
      }
      v.ring(0.004, [[118, 0.06, 1], [187, 0.045, 0.7]], 0.004, 0.14); v.ring(0.194, [[118, 0.06, 1], [187, 0.045, 0.7]], 0.004, 0.11);
    } },
    { say: 'a knob turned hard against a dead lock', dur: 0.42, seed: 9172, fn: v => {
      for (let k = 0; k < 3; k++) {
        const t = k * 0.12 + 0.01 * v.u();
        v.hiss(t, 700, 2600, 0.012, 0.012, 0.4);                                                        // the spindle grinding round
        knock(v, t + 0.03, 1500, 5000, 0.002, 0.8 - 0.15 * k); v.ring(t + 0.03, cluster(v, 1300, 4200, 5, 0.008), 0.0004, 0.25);   // to its stop
        v.hiss(t + 0.034, 110, 600, 0.002, 0.014, 0.5);
      }
    } },
  ],
  stairDoor: [
    { say: 'crash bar, then the door on its stop', dur: 1.7, seed: 9181, fn: v => {
      const d = v.layer();
      clack(v, 0, 280, 3200, 0.05, 0.9, d); v.hiss(0, 80, 300, 0.002, 0.03, 0.6, d);                    // the bar: ka-
      clack(v, 0.045, 450, 3800, 0.03, 0.7, d);                                                         // the latch out: -chunk
      v.hiss(0.07, 200, 900, 0.12, 0.08, 0.12, d);                                                      // the leaf swinging
      v.hiss(0.34, 40, 260, 0.003, 0.09, 1.6, d); v.ring(0.34, [[47, 0.45, 1], [63, 0.35, 0.8], [88, 0.25, 0.5]], 0.008, 0.5, 0, d);   // the stop
      knock(v, 0.34, 150, 2200, 0.012, 1.3, d); v.hiss(0.34, 160, 1300, 0.004, 0.12, 0.5, d);           // its steel skin as a band of noise, not notes
      v.ring(0.34, cluster(v, 180, 1500, 14, 0.22), 0.0015, 0.22, 0, d);
      knock(v, 0.41, 300, 2500, 0.006, 0.25, d);
      v.slaps(d, [[6, 0.45, 5000], [14, -0.38, 3800], [27, 0.3, 2800], [46, -0.24, 2200], [77, 0.18, 1700], [123, -0.12, 1300]]);
      v.add(d); v.tail(0.345, [[50, 250, 1.3, 0.2], [250, 1200, 1.0, 0.2], [1200, 4000, 0.6, 0.08]], 0.02);
    } },
    { say: 'shouldered open: one heavy hit', dur: 1.2, seed: 9182, fn: v => {
      const d = v.layer();
      v.hiss(0, 45, 320, 0.004, 0.07, 1.5, d); knock(v, 0, 200, 2600, 0.012, 1.2, d);
      v.ring(0, cluster(v, 150, 1300, 12, 0.16), 0.003, 0.3, 0, d); v.ring(0, [[51, 0.35, 1], [74, 0.26, 0.7]], 0.008, 0.45, 0, d);
      clack(v, 0.02, 500, 3800, 0.03, 0.6, d);
      knock(v, 0.15, 400, 2800, 0.005, 0.28, d); knock(v, 0.21, 450, 2600, 0.005, 0.16, d);             // the bar coming back
      v.slaps(d, [[6, 0.42, 5000], [14, -0.34, 3800], [27, 0.26, 2800], [46, -0.2, 2200], [77, 0.13, 1700]]);
      v.add(d); v.tail(0.01, [[50, 250, 0.9, 0.2], [250, 1200, 0.7, 0.18], [1200, 4000, 0.4, 0.07]], 0.02);
    } },
  ],
  chokeLimp: [
    { say: 'the breath goes out of him', dur: 0.8, seed: 9191, fn: v => {
      v.throat(0.02, 0.5, t => 96 - 50 * t, t => Math.pow(Math.sin(Math.PI * Math.min(1, t / 0.5)), 0.7) * Math.exp(-t / 0.22),
        () => [[480, 130, 1], [1250, 180, 0.4], [2400, 240, 0.15]], { open: 0.75, breath: 1.0, voice: 0.25, jitter: 0.04, shimmer: 0.15 });
      biquad(v.out, v.sr, 'lp', 1800);
      const pk = peak(v);
      v.hiss(0.02, 400, 2400, 0.05, 0.16, 0.25 * pk);                                                   // air through the nose and the sleeve
      v.hiss(0.3, 900, 5000, 0.025, 0.05, 0.3 * pk); v.hiss(0.47, 700, 4000, 0.03, 0.07, 0.24 * pk);    // cloth, as his weight comes onto the arm
      v.hiss(0.52, 60, 420, 0.012, 0.06, 0.6 * pk); knock(v, 0.6, 150, 1100, 0.012, 0.3 * pk);          // the sag; a heel letting go of the floor
    } },
    { say: 'no voice: air, cloth, his heels', dur: 0.8, seed: 9192, fn: v => {
      v.hiss(0, 300, 2200, 0.07, 0.2, 0.6);
      for (const t of [0.18, 0.31, 0.43, 0.56]) v.hiss(t + 0.02 * v.u(), 1200, 6000, 0.02, 0.04, 0.2 + 0.15 * v.u());
      v.hiss(0.36, 150, 1400, 0.03, 0.07, 0.5); v.hiss(0.55, 120, 900, 0.02, 0.05, 0.4);                // heels dragging
      v.hiss(0.5, 50, 300, 0.02, 0.08, 0.7);
    } },
  ],
  lightBreak: [
    { say: 'a tube: a pop, and a rain of crumbs', dur: 0.72, seed: 9201, fn: v => {
      const d = v.layer();
      v.blast(0, 0.0009, 0.8, d); v.hiss(0, 300, 2500, 0.0005, 0.008, 1.3, d);                         // the vacuum going
      v.hiss(0, 1500, 12000, 0.0005, 0.022, 1.2, d);                                                    // the glass, all at once
      v.ring(0.002, cluster(v, 420, 1500, 6, 0.05), 0.001, 0.3, 0, d);                                  // the fitting's sheet metal
      v.add(d);
      for (let k = 0; k < 46; k++) {
        const t = 0.05 + 0.5 * Math.pow(v.u(), 1.6), big = v.u() < 0.2;
        knock(v, t, big ? 1800 : 3500, big ? 7000 : 12000, big ? 0.004 : 0.0012, (big ? 0.3 : 0.14) * (1 - t));
        if (big) v.ring(t, [[2600 + 3500 * v.u(), 0.02, 1], [5200 + 4000 * v.u(), 0.012, 0.6]], 0.0003, 0.07);
      }
      v.hiss(0.03, 2500, 9000, 0.05, 0.16, 0.1);                                                        // phosphor and dust
    } },
    { say: 'a bulb: a sharp pop, a few shards land', dur: 0.62, seed: 9202, fn: v => {
      v.blast(0, 0.0004, 0.9); knock(v, 0, 2000, 14000, 0.006, 1.3); v.hiss(0, 500, 3000, 0.0005, 0.005, 0.7);
      for (let k = 0; k < 7; k++) {
        const t = 0.2 + 0.3 * v.u(), f = 2400 + 3200 * v.u(), w = 0.25 + 0.3 * v.u();
        knock(v, t, 2000, 9000, 0.002, w); v.ring(t, [[f, 0.035, 1], [f * 2.31, 0.02, 0.5]], 0.0003, w * 0.4);
        if (v.u() < 0.5) knock(v, t + 0.03 + 0.04 * v.u(), 2500, 9000, 0.0015, w * 0.4);                // and skips once
      }
    } },
  ],
  wallDebris: [
    { say: 'blockwork: lumps and a run of grit', dur: 2.7, seed: 9211, fn: v => {
      v.hiss(0.02, 1500, 7000, 0.12, 0.5, 0.35); v.hiss(0.02, 300, 1500, 0.08, 0.35, 0.4);
      for (let k = 0; k < 70; k++) {
        const t = 0.05 + 2.3 * Math.pow(v.u(), 1.9), size = v.u(), w = (0.25 + 0.75 * v.u()) * (1 - 0.5 * t / 2.3);
        if (size > 0.85) { v.hiss(t, 60, 500, 0.002, 0.03, 1.3 * w); knock(v, t, 300, 2200, 0.012, 0.8 * w); knock(v, t + 0.04 + 0.05 * v.u(), 300, 1800, 0.008, 0.3 * w); }   // a block lands, rocks once
        else if (size > 0.4) knock(v, t, 250 + 600 * size, 2500 + 2500 * size, 0.004 + 0.008 * size, 0.6 * w);
        else knock(v, t, 1800, 8000, 0.0015 + 0.003 * v.u(), 0.3 * w);
      }
      v.hiss(1.2, 2000, 8000, 0.4, 0.5, 0.05);                                                          // dust still running
    } },
    { say: 'a partition: boards flap down, studs clatter', dur: 2.0, seed: 9212, fn: v => {
      for (const t of [0.03, 0.2, 0.46]) { const w = 1 - t; knock(v, t, 150, 3000, 0.02, 1.1 * w); v.hiss(t, 70, 400, 0.004, 0.05, 0.8 * w); }   // sheets of board
      for (let k = 0; k < 5; k++) { const t = 0.15 + 0.9 * v.u(); v.ring(t, cluster(v, 300, 1800, 6, 0.04), 0.0015, 0.3); knock(v, t, 400, 3000, 0.004, 0.4); }   // studs
      for (let k = 0; k < 90; k++) { const t = 0.05 + 1.7 * Math.pow(v.u(), 1.7); knock(v, t, 1500, 9000, 0.001 + 0.002 * v.u(), 0.22 * (1 - 0.5 * t / 1.7) * (0.3 + 0.7 * v.u())); }
      v.hiss(0.05, 2500, 9000, 0.1, 0.45, 0.22);                                                        // gypsum
    } },
  ],
  murmur: [
    { say: 'all breath, no voice', dur: 0.32, seed: 9221, fn: v => {
      const syl = [[0, 0.08, 0.8], [0.095, 0.085, 1.0], [0.195, 0.095, 0.65]] as const;
      v.throat(0, 0.3, () => 100, syllables(syl),
        t => t < 0.09 ? [[560, 140, 1], [1600, 200, 0.7], [2600, 260, 0.35]] : t < 0.19 ? [[700, 150, 1], [1200, 190, 0.7], [2500, 260, 0.3]] : [[400, 140, 1], [1000, 200, 0.6], [2400, 260, 0.3]],
        { open: 0.8, breath: 1.0, voice: 0 });
      const pk = peak(v);
      v.hiss(0, 2200, 6000, 0.01, 0.012, 0.3 * pk); v.hiss(0.185, 3000, 7000, 0.004, 0.008, 0.25 * pk); // the consonants
      biquad(v.out, v.sr, 'lp', 4500);
    } },
    { say: 'low and flat, in the chest', dur: 0.34, seed: 9222, fn: v => {
      v.throat(0, 0.32, t => 92 - 38 * t, syllables([[0, 0.13, 0.9], [0.15, 0.16, 1.0]]),
        t => t < 0.14 ? [[420, 100, 1], [1100, 150, 0.4], [2300, 200, 0.1]] : [[330, 100, 1], [900, 150, 0.35], [2200, 200, 0.1]],
        { open: 0.5, breath: 0.3, voice: 0.8, jitter: 0.03, shimmer: 0.12 });
      biquad(v.out, v.sr, 'lp', 2200);
    } },
  ],
  heldProtest: [
    { say: 'a breath in through the nose, one strangled grunt', dur: 0.85, seed: 9231, fn: v => {
      v.throat(0.42, 0.24, t => 135 - 125 * t, t => Math.pow(Math.sin(Math.PI * Math.min(1, t / 0.24)), 0.8),
        () => [[300, 90, 1], [850, 140, 0.2]], { open: 0.3, jitter: 0.05, shimmer: 0.2, breath: 0.12 });
      biquad(v.out, v.sr, 'lp', 800);
      const pk = peak(v);
      v.hiss(0.3, 900, 3200, 0.06, 0.018, 0.35 * pk);                                                   // in through the nose, under the hand
      v.hiss(0.6, 1000, 4500, 0.03, 0.05, 0.12 * pk);                                                   // a sleeve
    } },
    { say: 'three short ones, fighting it', dur: 0.85, seed: 9232, fn: v => {
      v.throat(0.3, 0.42, t => 122 + 26 * Math.sin(TAU3 * t), syllables([[0, 0.09, 0.8], [0.13, 0.09, 1.0], [0.25, 0.15, 0.7]], 1.2),
        () => [[280, 85, 1], [1000, 150, 0.12], [2200, 200, 0.03]], { open: 0.38, jitter: 0.04, shimmer: 0.16, breath: 0.08 });
      biquad(v.out, v.sr, 'lp', 900);
      const pk = peak(v);
      v.hiss(0.34, 1000, 4500, 0.03, 0.04, 0.16 * pk); v.hiss(0.52, 1000, 4500, 0.03, 0.05, 0.14 * pk); v.hiss(0.66, 150, 900, 0.01, 0.04, 0.2 * pk);   // cloth, a boot
    } },
  ],
  // the four he FLAGGED on 10-13 (each redone in sfx.ts to his note): one other way each could go
  propScrape: [
    { say: 'on castors: it rolls, and coasts', dur: 0.7, seed: 9301, fn: v => {
      v.hiss(0, 110, 620, 0.06, 0.28, 1.0); v.hiss(0.01, 700, 2400, 0.05, 0.18, 0.22);                    // the wheels through the floor, their tyres on the lino
      for (let t = 0.02; t < 0.6; t += 0.03 + 0.03 * v.u() + 0.02 * t) knock(v, t, 900, 3200, 0.0015, 0.14 * Math.exp(-t / 0.3));   // the stems rattling in their sockets, slowing
    } },
  ],
  propThud: [
    { say: 'a knock, and what is on it rattles', dur: 0.35, seed: 9311, fn: v => {
      v.hiss(0, 120, 900, 0.001, 0.012, 1.0); v.ring(0, [[105, 0.05, 1], [176, 0.035, 0.5]], 0.005, 0.5); knock(v, 0.002, 800, 2800, 0.003, 0.3);
      for (let k = 0; k < 3; k++) knock(v, 0.03 + 0.035 * k + 0.02 * v.u(), 1200, 4200, 0.002, 0.12 / (k + 1));
    } },
  ],
  lockBreak: [
    { say: 'the keep shears: one crack, the bolt a dull clack', dur: 0.4, seed: 9321, fn: v => {
      v.hiss(0, 500, 6000, 0.0004, 0.009, 1.0); v.hiss(0, 70, 320, 0.002, 0.04, 1.2); v.ring(0, [[150, 0.08, 0.6], [246, 0.06, 0.4]], 0.006, 0.6);
      clack(v, 0.03, 300, 1800, 0.045, 0.6);
      for (let k = 0; k < 4; k++) knock(v, 0.02 + 0.03 * k + 0.02 * v.u(), 1000, 4200, 0.005, 0.25 / (k + 1));
      v.drive(1.2);
    } },
  ],
  magDrop: [
    { say: 'falls flat: one slap and a skid', dur: 0.35, seed: 9331, fn: v => {
      v.hiss(0, 120, 600, 0.0008, 0.016, 1.0); knock(v, 0, 500, 2400, 0.005, 0.6); v.ring(0, cluster(v, 300, 1300, 6, 0.018), 0.0012, 0.3);
      knock(v, 0.028, 400, 2000, 0.004, 0.3); v.hiss(0.04, 700, 2600, 0.02, 0.05, 0.14);
    } },
  ],
  // the grab's three beats: two other ideas of each
  grabCatch: [
    PICKED,   // (10-24: 'more sleeve than thump' is the game's catch now)
    { say: 'a hard slap: forearm on his chest rig, a grunt knocked out of him', dur: 0.3, seed: 9402, fn: v => {
      knock(v, 0, 300, 1400, 0.007, 1.1); knock(v, 0, 1400, 4200, 0.0025, 0.5);                           // no cloth first: the arm is there at once, on nylon and plates
      thud(v, 0, 120, 0.11, 0.9, 480);
      for (let k = 0; k < 2; k++) knock(v, 0.012 + 0.014 * k + 0.004 * v.u(), 2200, 6000, 0.0012, 0.16);  // what hangs on the rig, jumping
      const b = v.layer();
      v.throat(0.03, 0.07, t => 150 - 600 * t, t => Math.pow(Math.sin(Math.PI * Math.min(1, t / 0.07)), 0.6), () => [[520, 110, 1], [1150, 160, 0.35], [2400, 220, 0.08]], { open: 0.32, breath: 0.25, jitter: 0.05, shimmer: 0.2 }, b);
      biquad(b, v.sr, 'lp', 1800); v.add(peakTo(b), 0.45);                                                // 'hk': pressed, shut by the arm
      v.hiss(0.11, 600, 2600, 0.015, 0.02, 0.07);
    } },
  ],
  gunStrip: [
    { say: 'a rattle: the gun shaken out of his fingers, no clean snap', dur: 0.27, seed: 9411, fn: v => {
      v.hiss(0, 700, 2800, 0.012, 0.02, 0.3);                                                             // a glove closing over the slide
      let at = 0.012; for (let k = 0; k < 7; k++) { const a = 0.75 * Math.pow(0.82, k); knock(v, at, 1900, 6500, 0.0014, a); v.ring(at, vary(v, SLIDE, 4, 0.06), 0.0004, a * 0.3); if (k % 2 === 0) knock(v, at + 0.003, 600, 1900, 0.003, a * 0.5); at += 0.015 + 0.004 * k + 0.004 * v.u(); }   // steel in its rails and polymer on a knuckle, slowing
      v.ring(0.06, [[3600, 0.012, 1], [5300, 0.008, 0.6], [7400, 0.005, 0.3]], 0.0003, 0.12, 0.3);        // a sling swivel, or the lanyard loop
      knock(v, at + 0.02, 1500, 5000, 0.002, 0.3);                                                        // into Sam's palm
    } },
    PICKED,   // (10-24: 'one snap and one click' is the game's strip now)
  ],
  gunDown: [
    { say: 'set down soft, as onto carpet: a pat and the hand leaving it', dur: 0.3, seed: 9421, fn: v => {
      v.hiss(0, 90, 420, 0.004, 0.026, 1.0); v.hiss(0, 300, 1100, 0.003, 0.012, 0.5);                     // the weight, taken by something that gives
      knock(v, 0.004, 900, 2400, 0.004, 0.14);                                                            // the magazine's floor plate through the pile
      v.hiss(0.02, 600, 2600, 0.03, 0.03, 0.16);                                                          // pile and sleeve
      knock(v, 0.1, 1200, 3200, 0.002, 0.05);                                                             // a finger off the trigger guard
    } },
    { say: 'a harder knock on a hard floor, and it rocks flat for longer', dur: 0.42, seed: 9422, fn: v => {
      v.hiss(0, 120, 600, 0.0008, 0.014, 0.9); knock(v, 0, 500, 2600, 0.005, 0.9); v.ring(0, cluster(v, 320, 1500, 7, 0.02), 0.0012, 0.35);
      knock(v, 0.002, 2000, 5500, 0.0015, 0.22);                                                          // the slide's steel on the floor
      let at = 0.06; for (let k = 0; k < 5; k++) { const a = 0.22 * Math.pow(0.68, k); knock(v, at, 700, 2600, 0.003, a); if (k < 2) knock(v, at + 0.002, 2200, 5000, 0.0012, a * 0.4); at += 0.07 * Math.pow(0.78, k) + 0.008 * v.u(); }   // heel and muzzle in turn, quicker and smaller each time
    } },
  ],
};
const CACHE = new Map<string, SfxBuffer>();

/** is take k (0-based) one he picked — the game's own voice now, so nothing to offer beside it */
export function altPicked(name: string, k: number): boolean { return !!TAKES[name as SfxName]?.[k]?.picked; }
/** how many places a voice's list of other takes has (0 for a voice with none); a picked take keeps its place: ask altPicked */
export function altTakes(name: string): number { return TAKES[name as SfxName]?.length ?? 0; }
/** what take k is, in a few words (a button's tooltip) */
export function altSay(name: string, k: number): string { return TAKES[name as SfxName]?.[k]?.say ?? ''; }
/** the voices that have other takes, in the table's order */
export function altNames(): SfxName[] { return Object.keys(TAKES) as SfxName[]; }
/** take k (0-based) of a voice, rendered when first asked for at this sample rate; null where there is none */
export function altTake(ctx: SfxContext, name: string, k: number): SfxBuffer | null {
  const T = TAKES[name as SfxName]?.[k]; if (!T || T.picked) return null;
  const key = `${name}#${k}@${ctx.sampleRate}`, had = CACHE.get(key); if (had) return had;
  const as = HEARD[name as SfxName] ?? AS[name as SfxName]; if (as === undefined) return null;
  const buf = voiced(ctx, as, T.dur, T.seed, T.fn); CACHE.set(key, buf); return buf;
}
/** take k made under a Tune (the replay page's sound lanes): never kept, never the buffer `altTake` hands out */
export function altOne(ctx: SfxContext, name: string, k: number, tune: Tune): SfxBuffer | null {
  const T = TAKES[name as SfxName]?.[k]; if (!T || T.picked) return null;
  const as = HEARD[name as SfxName] ?? AS[name as SfxName]; if (as === undefined) return null;
  return tuned(tune, () => voiced(ctx, as, T.dur, T.seed, T.fn));
}
/** the seed take k is written with (what a tuner's 'seed' starts from) */
export function altSeed(name: string, k: number): number | undefined { return TAKES[name as SfxName]?.[k]?.seed; }
