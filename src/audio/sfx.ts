// Procedurally synthesized sound effects rendered into AudioBuffers at startup (no samples shipped).
export type SfxName =
  | 'pistolSuppressed' | 'pistolLoud' | 'carbineReport' | 'rifleSuppressed' | 'launcher' | 'dryFire' | 'magOut' | 'magIn' | 'rack' | 'magDrop' | 'footSoft' | 'footHard' | 'ocp' | 'nvOn' | 'nvOff'
  | 'click' | 'throw' | 'canisterBounce' | 'bulletImpact' | 'bodyHit' | 'bodyFall' | 'lightBreak' | 'lightOff' | 'deny' | 'equip' | 'smokePop' | 'alertSting' | 'radio'
  | 'doorCreak' | 'doorBang' | 'doorLatch' | 'doorBash' | 'doorRattle' | 'lockPick' | 'lockOpen' | 'lockBreak' | 'powerDown' | 'powerUp' | 'stunBang' | 'earRing' | 'propScrape' | 'propThud'
  | 'grabScuffle' | 'chokeStrain' | 'chokeLimp' | 'whipThud' | 'shove' | 'murmur' | 'heldProtest' | 'whistle'
  | 'stairDoor' | 'stairBoots' | 'casingTink' | 'thunderNear' | 'thunderFar' | 'glassCrack'
  | 'padBeep' | 'padOpen' | 'alarmChirp';   // devices (game/devices.ts): a keypad key, the pad accepting the code, a tripwire's emitter chirping as it reports

type Gen = (t: number, i: number, sr: number, rnd: () => number, state: Float32Array) => number;

function render(ctx: BaseAudioContext, dur: number, gen: Gen, seed = 1): AudioBuffer {
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

export function buildSfx(ctx: BaseAudioContext): Record<SfxName, AudioBuffer> {
  const TAU = Math.PI * 2;
  return {
    // suppressed 5.7×28: sharp 'thwip' — bandpassed noise snap + low thump + slide clack 35 ms later
    pistolSuppressed: render(ctx, 0.32, (t, _i, _sr, rnd, st) => {
      const n = rnd();
      const snap = (lp(n, st, 0, 0.35) - lp(n, st, 1, 0.06)) * env(t, 0.0008, 0.022) * 1.1;
      const thump = Math.sin(TAU * (70 * t - 18 * t * t)) * env(t, 0.002, 0.05) * 0.9;
      const tc = t - 0.035; const clack = tc > 0 ? (rnd() - lp(rnd(), st, 2, 0.2)) * env(tc, 0.0005, 0.012) * 0.5 + Math.sin(TAU * 1900 * tc) * env(tc, 0.0005, 0.006) * 0.15 : 0;
      const tail = lp(n, st, 3, 0.02) * env(t, 0.01, 0.12) * 0.5;
      return (snap + thump + clack + tail) * 0.72;
    }, 11),
    // unsuppressed 9 mm indoors: broadband crack, big low end, long-ish slap tail
    pistolLoud: render(ctx, 0.9, (t, _i, _sr, rnd, st) => {
      const n = rnd();
      const crack = n * env(t, 0.0005, 0.03) * 1.0;
      const body = lp(n, st, 0, 0.12) * env(t, 0.001, 0.09) * 1.3;
      const thump = Math.sin(TAU * (95 * t - 30 * t * t)) * env(t, 0.001, 0.08) * 1.2;
      const tail = lp(rnd(), st, 1, 0.015) * env(t, 0.02, 0.35) * 0.9;
      return Math.tanh((crack + body + thump + tail) * 1.4) * 0.95;
    }, 23),
    // the guards' AKS-74U indoors (rifles, docs/internal/sc20k-design.md §3.3): pistolLoud's recipe pushed — a harder, shorter supersonic crack (0.4 ms up, gone in
    // 20 ms, with a spitting high edge on it), the propellant body a shade darker and longer, the chest thump an octave down (55 Hz, diving — phase-accumulated so
    // the sweep is exact at any sample rate), the short barrel's bark as a brief mid honk, and a 0.6 s slap off every wall; driven harder into tanh than the pistol.
    // Three of these 0.1 s apart overlap into the ripping sound of a burst; the mixer's propagation (occlusion low-pass, the routed doorway source, the reverb send)
    // turns one two rooms off into a muffled triple thump. Not louder to the FLOOR than the pistol (level 1, the 80 m gate) — louder in character.
    carbineReport: render(ctx, 1.25, (t, _i, sr, rnd, st) => {
      const n = rnd();
      const crack = n * env(t, 0.0004, 0.02) * 1.25 + (n - lp(n, st, 0, 0.5)) * env(t, 0.0003, 0.006) * 0.7;
      const body = lp(rnd(), st, 1, 0.09) * env(t, 0.001, 0.12) * 1.5;
      const f = 55 + 60 * Math.exp(-t * 14); st[3] += f / sr; const thump = Math.sin(TAU * st[3]) * env(t, 0.001, 0.11) * 1.5;
      const bark = (Math.sin(TAU * 410 * t) * 0.5 + Math.sin(TAU * 620 * t) * 0.3) * env(t, 0.001, 0.03) * 0.35;
      const tail = lp(rnd(), st, 2, 0.012) * env(t, 0.03, 0.6) * 1.0 + lp(rnd(), st, 4, 0.04) * env(t, 0.01, 0.2) * 0.5;
      return Math.tanh((crack + body + thump + bark + tail) * 1.8) * 0.97;
    }, 211),
    // Sam's FN2000 (rifles, docs/internal/sc20k-design.md §5): pistolSuppressed's recipe — 5.56 through an integral suppressor is still a 'thwip', not a bang — with a
    // rifle's worth behind it: the snap band a little wider, the thump deeper (50 Hz, diving, phase-accumulated) and heavier, the ACTION louder than the pistol's slide
    // (a bolt carrier's clack 45 ms in, then it running home at 95 ms), and the gas hissing out of the can for a fifth of a second after. Level 1 to the floor like the
    // pistol (finding 1: "not materially louder"): the difference is character, and thirty of them a magazine on AUTO overlapping into a stuttering hiss.
    rifleSuppressed: render(ctx, 0.5, (t, _i, sr, rnd, st) => {
      const n = rnd();
      const snap = (lp(n, st, 0, 0.45) - lp(n, st, 1, 0.05)) * env(t, 0.0008, 0.026) * 1.15;
      const f = 50 + 40 * Math.exp(-t * 20); st[5] += f / sr; const thump = Math.sin(TAU * st[5]) * env(t, 0.002, 0.07) * 1.1;
      const t1 = t - 0.045; const clack = t1 > 0 ? (rnd() - lp(rnd(), st, 2, 0.2)) * env(t1, 0.0005, 0.014) * 0.55 + Math.sin(TAU * 1500 * t1) * env(t1, 0.0005, 0.008) * 0.18 : 0;
      const t2 = t - 0.095; const home = t2 > 0 ? lp(rnd(), st, 3, 0.4) * env(t2, 0.001, 0.02) * 0.5 + Math.sin(TAU * 620 * t2) * env(t2, 0.001, 0.025) * 0.2 : 0;
      const hiss = lp(rnd(), st, 4, 0.03) * env(t, 0.01, 0.2) * 0.55;
      return Math.tanh((snap + thump + clack + home + hiss) * 1.1) * 0.78;
    }, 213),
    // the ring-airfoil launcher (launcher.ts): a hand-cycled tube under the fore-end letting a rubber ring go — the 'throw' body's whoosh, short, over a low hollow
    // thunk (magOut's first click slowed) and a puff of propellant: near silent, the doc's "CT's near-silent launcher" (a 'prop' event at 0.45, not gunfire)
    launcher: render(ctx, 0.32, (t, _i, sr, rnd, st) => {
      const whoosh = lp(rnd(), st, 0, 0.05 + 0.3 * Math.sin(Math.PI * Math.min(1, t / 0.18))) * Math.sin(Math.PI * Math.min(1, t / 0.2)) * 0.45;
      const f = 90 + 60 * Math.exp(-t * 30); st[3] += f / sr; const thunk = Math.sin(TAU * st[3]) * env(t, 0.001, 0.05) * 0.8;
      const click = (rnd() - lp(rnd(), st, 1, 0.3)) * env(t, 0.0004, 0.006) * 0.35;
      const puff = lp(rnd(), st, 2, 0.08) * env(t, 0.004, 0.06) * 0.5;
      return (whoosh + thunk + click + puff) * 0.8;
    }, 217),
    dryFire: render(ctx, 0.08, (t, _i, _sr, rnd, st) => (rnd() - lp(rnd(), st, 0, 0.3)) * env(t, 0.0004, 0.006) * 0.6 + Math.sin(TAU * 2600 * t) * env(t, 0.0004, 0.004) * 0.2, 3),
    magOut: render(ctx, 0.25, (t, _i, _sr, rnd, st) => {
      const c1 = (rnd() - lp(rnd(), st, 0, 0.25)) * env(t, 0.0005, 0.01) * 0.5;
      const ts = t - 0.05; const slide = ts > 0 ? lp(rnd(), st, 1, 0.08 + 0.1 * ts) * env(ts, 0.01, 0.06) * 0.35 : 0;
      const t2 = t - 0.16; const c2 = t2 > 0 ? (rnd() - lp(rnd(), st, 2, 0.3)) * env(t2, 0.0005, 0.008) * 0.35 : 0;
      return c1 + slide + c2;
    }, 5),
    magIn: render(ctx, 0.22, (t, _i, _sr, rnd, st) => {
      const c1 = lp(rnd(), st, 0, 0.5) * env(t, 0.0005, 0.012) * 0.5 + Math.sin(TAU * 900 * t) * env(t, 0.001, 0.01) * 0.2;
      const t2 = t - 0.09; const c2 = t2 > 0 ? (lp(rnd(), st, 1, 0.6) * env(t2, 0.0005, 0.02) * 0.8 + Math.sin(TAU * 520 * t2) * env(t2, 0.001, 0.025) * 0.3) : 0;
      return c1 + c2;
    }, 7),
    rack: render(ctx, 0.3, (t, _i, _sr, rnd, st) => {
      const a = lp(rnd(), st, 0, 0.4) * env(t, 0.001, 0.03) * 0.7 + Math.sin(TAU * 700 * t) * env(t, 0.001, 0.02) * 0.2;
      const t2 = t - 0.13; const b = t2 > 0 ? lp(rnd(), st, 1, 0.5) * env(t2, 0.001, 0.035) * 0.9 + Math.sin(TAU * 480 * t2) * env(t2, 0.001, 0.03) * 0.3 : 0;
      return a + b;
    }, 13),
    // polymer magazine clattering on carpet/lino
    magDrop: render(ctx, 0.5, (t, _i, _sr, rnd, st) => {
      let out = 0;
      const hits = [0, 0.11, 0.19, 0.25, 0.29];
      for (let k = 0; k < hits.length; k++) { const th = t - hits[k]; if (th < 0) continue; const a = Math.pow(0.55, k); out += (Math.sin(TAU * (1450 + k * 210) * th) * 0.4 + Math.sin(TAU * (2900 + k * 330) * th) * 0.25 + lp(rnd(), st, k, 0.5) * 0.5) * env(th, 0.0005, 0.018) * a; }
      return out * 0.7;
    }, 17),
    footSoft: render(ctx, 0.18, (t, _i, _sr, rnd, st) => lp(rnd(), st, 0, 0.04) * env(t, 0.004, 0.05) * 1.6 + lp(rnd(), st, 1, 0.3) * env(t, 0.001, 0.015) * 0.15, 19),
    footHard: render(ctx, 0.2, (t, _i, _sr, rnd, st) => lp(rnd(), st, 0, 0.07) * env(t, 0.002, 0.04) * 1.5 + (rnd() - lp(rnd(), st, 1, 0.4)) * env(t, 0.0008, 0.01) * 0.35 + Math.sin(TAU * 140 * t) * env(t, 0.002, 0.04) * 0.4, 29),
    // OCP: capacitor whine-thump
    ocp: render(ctx, 0.45, (t) => {
      const f = 2400 * Math.exp(-t * 9) + 180; const ph = TAU * (2400 / -9 * Math.exp(-t * 9) + 180 * t);
      return (Math.sin(ph) * (0.5 + 0.5 * Math.sin(TAU * 90 * t))) * env(t, 0.002, 0.12) * 0.7 + Math.sin(TAU * 60 * t) * env(t, 0.005, 0.1) * 0.5 + (f > 0 ? 0 : 0);
    }, 31),
    // goggles: the classic rising whine
    nvOn: render(ctx, 0.9, (t) => { const f0 = 500, f1 = 5200; const k = Math.log(f1 / f0) / 0.8; const ph = TAU * f0 * (Math.exp(k * Math.min(t, 0.8)) - 1) / k; return Math.sin(ph) * env(t, 0.02, 0.5) * 0.22 + Math.sin(ph * 0.5) * env(t, 0.02, 0.4) * 0.08; }, 37),
    nvOff: render(ctx, 0.5, (t) => { const f0 = 3000, f1 = 200; const k = Math.log(f1 / f0) / 0.45; const ph = TAU * f0 * (Math.exp(k * Math.min(t, 0.45)) - 1) / k; return Math.sin(ph) * env(t, 0.005, 0.2) * 0.2; }, 41),
    click: render(ctx, 0.05, (t, _i, _sr, rnd, st) => (rnd() - lp(rnd(), st, 0, 0.3)) * env(t, 0.0003, 0.004) * 0.5 + Math.sin(TAU * 3200 * t) * env(t, 0.0003, 0.003) * 0.2, 43),
    throw: render(ctx, 0.35, (t, _i, _sr, rnd, st) => lp(rnd(), st, 0, 0.03 + 0.25 * Math.sin(Math.PI * Math.min(1, t / 0.3))) * Math.sin(Math.PI * Math.min(1, t / 0.32)) * 0.5, 47),
    // a spent case landing on lino (GPU particles, game/particleFx.ts casingFx): brass rings high and inharmonic — three partials well above the canister's, gone in
    // 30 ms — and hops once, smaller, 55 ms later. Played quiet: it is the detail under the report, not an event (and not one the guards hear: the shot was)
    casingTink: render(ctx, 0.16, (t) => { let out = 0; for (let k = 0; k < 2; k++) { const th = t - k * 0.055; if (th < 0) continue; out += (Math.sin(TAU * 4210 * th) * 0.5 + Math.sin(TAU * 6370 * th) * 0.35 + Math.sin(TAU * 9120 * th) * 0.2) * env(th, 0.0003, 0.012) * (k === 0 ? 1 : 0.45); } return out * 0.55; }, 71),
    canisterBounce: render(ctx, 0.4, (t) => (Math.sin(TAU * 1310 * t) * 0.5 + Math.sin(TAU * 2140 * t) * 0.35 + Math.sin(TAU * 3370 * t) * 0.25 + Math.sin(TAU * 5210 * t) * 0.12) * env(t, 0.0005, 0.09) * 0.6, 53),
    bulletImpact: render(ctx, 0.25, (t, _i, _sr, rnd, st) => (rnd() * env(t, 0.0004, 0.012) * 0.7 + lp(rnd(), st, 0, 0.1) * env(t, 0.001, 0.05) * 0.8 + Math.sin(TAU * (400 + 900 * Math.exp(-t * 40)) * t) * env(t, 0.001, 0.03) * 0.3), 59),
    bodyHit: render(ctx, 0.25, (t, _i, _sr, rnd, st) => lp(rnd(), st, 0, 0.05) * env(t, 0.002, 0.06) * 1.6 + Math.sin(TAU * 80 * t) * env(t, 0.002, 0.07) * 0.6, 61),
    bodyFall: render(ctx, 0.9, (t, _i, _sr, rnd, st) => { const t2 = t - 0.32; return lp(rnd(), st, 0, 0.03) * env(t, 0.01, 0.09) * 1.2 + (t2 > 0 ? lp(rnd(), st, 1, 0.02) * env(t2, 0.005, 0.14) * 1.8 + Math.sin(TAU * 55 * t2) * env(t2, 0.004, 0.12) * 0.9 + lp(rnd(), st, 2, 0.2) * env(t2, 0.02, 0.2) * 0.15 : 0); }, 67),
    lightBreak: render(ctx, 0.7, (t, _i, _sr, rnd, st) => {
      let out = rnd() * env(t, 0.0005, 0.02) * 0.6 + Math.sin(TAU * 180 * t) * env(t, 0.001, 0.04) * 0.3;
      for (let k = 0; k < 9; k++) { const th = t - (0.01 + ((k * 0.6180339) % 1) * 0.35); if (th < 0) continue; out += Math.sin(TAU * (3200 + ((k * 977) % 2600)) * th) * env(th, 0.0004, 0.03 + (k % 3) * 0.02) * 0.18; }
      return out + lp(rnd(), st, 0, 0.5) * env(t, 0.02, 0.25) * 0.08;
    }, 71),
    // a round into laminated glazing (game/glass.ts glassHit): the smack of the impact — a hard broadband tick with a low knock under it — then a short bright
    // crackle as the star runs out from the hole (a dozen tiny high partials over 0.2 s, thinning) and a whisper of falling grit. No crash: the pane holds.
    glassCrack: render(ctx, 0.45, (t, _i, _sr, rnd, st) => {
      let out = rnd() * env(t, 0.0002, 0.012) * 1.0 + lp(rnd(), st, 0, 0.3) * env(t, 0.0006, 0.03) * 0.6 + Math.sin(TAU * (210 * t - 40 * t * t)) * env(t, 0.001, 0.04) * 0.45;
      for (let k = 0; k < 12; k++) { const th = t - (0.004 + ((k * 0.6180339) % 1) ** 1.4 * 0.2); if (th < 0) continue; out += Math.sin(TAU * (3100 + ((k * 1237) % 5200)) * th) * env(th, 0.0003, 0.012 + (k % 3) * 0.01) * (0.13 - 0.007 * k); }
      return Math.tanh((out + lp(rnd(), st, 1, 0.5) * env(t, 0.02, 0.16) * 0.06) * 1.4) * 0.85;
    }, 151),
    lightOff: render(ctx, 0.2, (t, _i, _sr, rnd, st) => lp(rnd(), st, 0, 0.2) * env(t, 0.001, 0.02) * 0.6 + Math.sin(TAU * 120 * t) * env(t, 0.002, 0.05) * 0.5, 73),
    deny: render(ctx, 0.25, (t) => (Math.sin(TAU * 220 * t) + Math.sin(TAU * 330 * t) * 0.5) * (env(t, 0.005, 0.05) + (t > 0.11 ? env(t - 0.11, 0.005, 0.05) : 0)) * 0.25, 79),
    equip: render(ctx, 0.2, (t, _i, _sr, rnd, st) => { const t2 = t - 0.08; return (rnd() - lp(rnd(), st, 0, 0.3)) * env(t, 0.0005, 0.008) * 0.35 + (t2 > 0 ? lp(rnd(), st, 1, 0.5) * env(t2, 0.0005, 0.015) * 0.5 : 0); }, 83),
    smokePop: render(ctx, 0.6, (t, _i, _sr, rnd, st) => rnd() * env(t, 0.0005, 0.015) * 0.7 + lp(rnd(), st, 0, 0.08) * env(t, 0.002, 0.06) * 0.7 + lp(rnd(), st, 1, 0.3) * env(t, 0.05, 0.4) * 0.25, 89),
    // reverse-swell + hit for the alert transition
    alertSting: render(ctx, 1.6, (t, _i, _sr, rnd, st) => {
      const rise = t < 0.7 ? lp(rnd(), st, 0, 0.02 + 0.5 * (t / 0.7) ** 3) * Math.pow(t / 0.7, 3) * 0.7 : 0;
      const th = t - 0.7; const hit = th >= 0 ? (Math.sin(TAU * (48 * th + 4 * Math.exp(-th * 6))) * env(th, 0.002, 0.35) * 1.1 + lp(rnd(), st, 1, 0.2) * env(th, 0.001, 0.15) * 0.7 + Math.sin(TAU * 587 * th) * env(th, 0.005, 0.5) * 0.12 + Math.sin(TAU * 622 * th) * env(th, 0.005, 0.6) * 0.1) : 0;
      return Math.tanh((rise + hit) * 1.2) * 0.9;
    }, 97),
    // guard radio squelch blip
    // doors: hinge creak (stick-slip: a wobbly saw-ish tone through a resonant body), slam, latch click, kicked open
    doorCreak: render(ctx, 0.7, (t, _i, sr, rnd, st) => {
      const f = 310 + 120 * Math.sin(t * 9) + 60 * Math.sin(t * 23 + 1) + 40 * lp(rnd(), st, 2, 0.002) * 30;
      st[3] += f / sr; const ph = st[3] % 1; const saw = (ph * 2 - 1);
      const body = lp(saw, st, 0, 0.08) - lp(saw, st, 1, 0.02);
      return body * (0.5 + 0.5 * Math.sin(t * 31)) * env(t, 0.03, 0.4) * Math.min(1, t / 0.05) * 0.35;
    }, 107),
    doorBang: render(ctx, 0.8, (t, _i, _sr, rnd, st) => lp(rnd(), st, 0, 0.02) * env(t, 0.002, 0.12) * 2.2 + Math.sin(TAU * 62 * t) * env(t, 0.002, 0.15) * 0.9 + Math.sin(TAU * 124 * t) * env(t, 0.002, 0.08) * 0.4 + (rnd() - lp(rnd(), st, 1, 0.5)) * env(t, 0.001, 0.02) * 0.3 + lp(rnd(), st, 2, 0.1) * (t > 0.09 ? env(t - 0.09, 0.003, 0.04) : 0) * 0.5, 109),
    doorLatch: render(ctx, 0.16, (t, _i, _sr, rnd, st) => { const t2 = t - 0.045; return (rnd() - lp(rnd(), st, 0, 0.25)) * env(t, 0.0005, 0.006) * 0.45 + Math.sin(TAU * 1900 * t) * env(t, 0.0005, 0.01) * 0.15 + (t2 > 0 ? lp(rnd(), st, 1, 0.3) * env(t2, 0.0008, 0.012) * 0.6 + Math.sin(TAU * 900 * t2) * env(t2, 0.001, 0.02) * 0.2 : 0); }, 113),
    doorBash: render(ctx, 0.9, (t, _i, _sr, rnd, st) => lp(rnd(), st, 0, 0.03) * env(t, 0.001, 0.09) * 2.4 + Math.sin(TAU * 48 * t) * env(t, 0.001, 0.2) * 1.0 + rnd() * env(t, 0.0005, 0.01) * 0.5 + lp(rnd(), st, 1, 0.15) * (t > 0.05 ? env(t - 0.05, 0.004, 0.06) : 0) * 0.7, 127),
    // locks: the lever tried against a thrown bolt (a few metallic clacks over the leaf knocking in its frame), one click of a pick working the pins (a tick and a
    // whisper of scrape), the cylinder going over and the bolt drawing back (snap, then a duller clunk), and the keep splintering out of the jamb under a boot
    // (a burst of wood crackle over a low thump, the strike plate clinking away) — that one plays under doorBash
    doorRattle: render(ctx, 0.32, (t, _i, _sr, rnd, st) => { let out = 0; const taps = [0, 0.05, 0.11, 0.2], amp = [1, 0.7, 0.85, 0.4]; for (let k = 0; k < taps.length; k++) { const th = t - taps[k]; if (th < 0) continue; out += ((rnd() - lp(rnd(), st, k, 0.3)) * env(th, 0.0004, 0.005) * 0.3 + Math.sin(TAU * (1650 + k * 140) * th) * env(th, 0.0005, 0.012) * 0.22 + Math.sin(TAU * 210 * th) * env(th, 0.001, 0.03) * 0.35) * amp[k]; } return out; }, 151),
    lockPick: render(ctx, 0.14, (t, _i, _sr, rnd, st) => { const t2 = t - 0.03; return (rnd() - lp(rnd(), st, 0, 0.3)) * env(t, 0.0003, 0.003) * 0.35 + Math.sin(TAU * 4300 * t) * env(t, 0.0003, 0.005) * 0.12 + (t2 > 0 ? (lp(rnd(), st, 1, 0.12) - lp(rnd(), st, 2, 0.03)) * env(t2, 0.004, 0.03) * 0.25 : 0); }, 157),
    lockOpen: render(ctx, 0.3, (t, _i, _sr, rnd, st) => { const t2 = t - 0.07; return (rnd() - lp(rnd(), st, 0, 0.25)) * env(t, 0.0004, 0.006) * 0.5 + Math.sin(TAU * 2500 * t) * env(t, 0.0004, 0.008) * 0.2 + (t2 > 0 ? lp(rnd(), st, 1, 0.35) * env(t2, 0.001, 0.02) * 0.8 + Math.sin(TAU * 320 * t2) * env(t2, 0.001, 0.04) * 0.4 : 0); }, 163),
    lockBreak: render(ctx, 0.6, (t, _i, _sr, rnd, st) => {
      let out = rnd() * env(t, 0.0004, 0.015) * 0.8 + lp(rnd(), st, 0, 0.06) * env(t, 0.001, 0.07) * 1.4 + Math.sin(TAU * 150 * t) * env(t, 0.001, 0.06) * 0.6;
      for (let k = 0; k < 7; k++) { const th = t - (0.012 + ((k * 0.6180339) % 1) * 0.16); if (th < 0) continue; out += (rnd() - lp(rnd(), st, 1 + (k % 3), 0.4)) * env(th, 0.0003, 0.006 + (k % 2) * 0.005) * 0.35; }   // splinters letting go one after another
      const c1 = t - 0.09, c2 = t - 0.21;   // the strike plate: off the jamb, then off the floor
      if (c1 > 0) out += (Math.sin(TAU * 2700 * c1) * 0.3 + Math.sin(TAU * 4100 * c1) * 0.15) * env(c1, 0.0005, 0.05);
      if (c2 > 0) out += (Math.sin(TAU * 3100 * c2) * 0.18 + Math.sin(TAU * 4600 * c2) * 0.1) * env(c2, 0.0005, 0.035);
      return Math.tanh(out * 1.2) * 0.9;
    }, 167),
    // mains: contactor clunk + transformer hum winding down / spinning back up with ballast plinks
    powerDown: render(ctx, 1.6, (t, _i, sr, rnd, st) => {
      const f = 100 * Math.exp(-t * 1.6) + 18; st[3] += f / sr; const hum = (Math.sin(st[3] * TAU) * 0.6 + Math.sin(st[3] * TAU * 2) * 0.3 + Math.sin(st[3] * TAU * 3) * 0.15) * env(t, 0.005, 0.7) * 0.35;
      const clunk = lp(rnd(), st, 0, 0.05) * env(t, 0.001, 0.05) * 1.8 + Math.sin(TAU * 70 * t) * env(t, 0.001, 0.08) * 0.6;
      return hum + clunk;
    }, 131),
    powerUp: render(ctx, 1.8, (t, _i, sr, rnd, st) => {
      const f = 30 + 70 * (1 - Math.exp(-t * 2.2)); st[3] += f / sr; const hum = (Math.sin(st[3] * TAU) * 0.5 + Math.sin(st[3] * TAU * 2) * 0.35) * Math.min(1, t / 0.3) * env(t, 0.3, 0.9) * 0.3;
      const clunk = lp(rnd(), st, 0, 0.05) * env(t, 0.001, 0.05) * 1.6 + Math.sin(TAU * 60 * t) * env(t, 0.001, 0.08) * 0.5;
      const t2 = t - 0.9, t3 = t - 1.25; const plink = (t2 > 0 ? Math.sin(TAU * 2100 * t2) * env(t2, 0.0005, 0.02) * 0.2 + rnd() * env(t2, 0.0003, 0.004) * 0.2 : 0) + (t3 > 0 ? Math.sin(TAU * 1700 * t3) * env(t3, 0.0005, 0.02) * 0.15 : 0);
      return hum + clunk + plink;
    }, 137),
    radio: render(ctx, 0.35, (t, _i, _sr, rnd, st) => { const sq = (t < 0.06 || (t > 0.25 && t < 0.31)) ? lp(rnd(), st, 0, 0.6) * 0.4 : 0; const tone = (t > 0.07 && t < 0.22) ? (Math.sign(Math.sin(TAU * 1250 * t)) * 0.12 + Math.sin(TAU * 1870 * t) * 0.08) : 0; return sq + tone; }, 101),
    // stun canister indoors: supersonic crack, a chest thump that dives (phase-accumulated so the sweep is exact at any sample rate), the steel body
    // ringing for a moment, and a long slap off every wall — driven hard into tanh, it is meant to be the loudest thing in the building
    stunBang: render(ctx, 1.5, (t, _i, sr, rnd, st) => {
      const n = rnd();
      const crack = n * env(t, 0.0003, 0.012) * 1.3 + (n - lp(n, st, 0, 0.5)) * env(t, 0.0002, 0.004) * 0.8;
      const body = lp(rnd(), st, 1, 0.09) * env(t, 0.001, 0.11) * 1.8;
      const f = 36 + 95 * Math.exp(-t * 9); st[3] += f / sr; const thump = Math.sin(TAU * st[3]) * env(t, 0.001, 0.2) * 1.5;
      const ring = (Math.sin(TAU * 1180 * t) * 0.5 + Math.sin(TAU * 2210 * t) * 0.3 + Math.sin(TAU * 3470 * t) * 0.2) * env(t, 0.001, 0.22) * 0.14;
      const tail = lp(rnd(), st, 2, 0.02) * env(t, 0.03, 0.55) * 0.9 + lp(rnd(), st, 4, 0.006) * env(t, 0.08, 0.7) * 0.6;
      return Math.tanh((crack + body + thump + ring + tail) * 1.7) * 0.97;
    }, 139),
    // what the player's ears do about it when it goes off in sight: a thin whistle that swells in as the bang decays and takes a couple of seconds to clear
    earRing: render(ctx, 2.6, (t) => (Math.sin(TAU * 3120 * t) + Math.sin(TAU * 4310 * t) * 0.3 + Math.sin(TAU * 2650 * t) * 0.15) * Math.min(1, t / 0.18) * Math.exp(-t / 1.1) * 0.11, 149),
    // loose furniture: a short scrape / caster rattle (band-limited hiss chopped by stick-slip chatter over a low judder whose pitch wanders) and a hollow knock
    // (played at different rates per kind: cardboard low and dull, a steel bin bright)
    propScrape: render(ctx, 0.42, (t, _i, sr, rnd, st) => {
      const f = 70 + 25 * Math.sin(t * 21) + 15 * Math.sin(t * 57 + 1); st[3] += f / sr; const judder = Math.sin(st[3] * TAU) * 0.14;
      const grain = lp(rnd(), st, 0, 0.14) - lp(rnd(), st, 1, 0.02);
      const chatter = 0.55 + 0.45 * (Math.sin(t * 83) > 0 ? 1 : -1) * (0.5 + 0.5 * Math.sin(t * 7));
      return (grain * chatter * 0.9 + judder) * env(t, 0.012, 0.15) * Math.min(1, t / 0.02) * 0.8;
    }, 139),
    propThud: render(ctx, 0.4, (t, _i, _sr, rnd, st) => lp(rnd(), st, 0, 0.04) * env(t, 0.002, 0.07) * 1.7 + Math.sin(TAU * 96 * t) * env(t, 0.002, 0.08) * 0.7 + Math.sin(TAU * 232 * t) * env(t, 0.001, 0.03) * 0.3 + (rnd() - lp(rnd(), st, 1, 0.4)) * env(t, 0.0006, 0.008) * 0.3, 149),
    // ---- the response team's way in (game/qrf.ts): the west stair door — a steel fire door on a crash bar — thrown open against its stop in a bare concrete stairwell,
    //      and the boots coming up that stairwell heard through it just before. The door: the bar's clack, the leaf booming off the stop (doorBang's low body, harder),
    //      the steel skin ringing (a cluster of inharmonic partials, 180–900 Hz, a third of a second), and the stairwell throwing it back for most of a second (a dense
    //      dark tail). Also played, pitched up and quieter, under a boot that rings off it (doors.ts 'clang').
    stairDoor: render(ctx, 1.3, (t, _i, _sr, rnd, st) => {
      const bar = (rnd() - lp(rnd(), st, 0, 0.3)) * env(t, 0.0005, 0.008) * 0.5 + Math.sin(TAU * 1400 * t) * env(t, 0.0005, 0.01) * 0.15;
      const tb = t - 0.02; const boom = tb > 0 ? lp(rnd(), st, 1, 0.025) * env(tb, 0.002, 0.14) * 2.4 + Math.sin(TAU * 58 * tb) * env(tb, 0.002, 0.18) * 1.0 + Math.sin(TAU * 116 * tb) * env(tb, 0.002, 0.1) * 0.45 : 0;
      const ring = tb > 0 ? (Math.sin(TAU * 183 * tb) * 0.5 + Math.sin(TAU * 411 * tb) * 0.35 + Math.sin(TAU * 647 * tb) * 0.22 + Math.sin(TAU * 902 * tb) * 0.12) * env(tb, 0.001, 0.3) * 0.32 : 0;
      const tail = lp(rnd(), st, 2, 0.015) * env(t, 0.05, 0.75) * 0.9 + lp(rnd(), st, 3, 0.05) * env(t, 0.02, 0.3) * 0.35;
      return Math.tanh((bar + boom + ring + tail) * 1.3) * 0.95;
    }, 223),
    // eight heavy footfalls on concrete treads over two and a half seconds, two men's worth out of step (a low thud + a gritty scuff each), getting nearer (louder,
    // brighter) — muffled at the source by whoever plays it through a shut steel door
    stairBoots: render(ctx, 2.7, (t, _i, _sr, rnd, st) => {
      let out = 0; const steps = [0.05, 0.36, 0.7, 0.98, 1.31, 1.6, 1.94, 2.22, 2.5];
      for (let k = 0; k < steps.length; k++) { const th = t - steps[k]; if (th < 0 || th > 0.25) continue; const near = 0.45 + 0.55 * (k / (steps.length - 1)); out += (lp(rnd(), st, k % 4, 0.03 + 0.05 * near) * env(th, 0.003, 0.05) * 1.6 + Math.sin(TAU * (70 + 8 * (k % 3)) * th) * env(th, 0.002, 0.06) * 0.6 + (rnd() - lp(rnd(), st, 4 + (k % 3), 0.4)) * env(th, 0.001, 0.012) * 0.25 * near) * near; }
      return out * 0.8;
    }, 227),
    // ---- the hold (player.ts startGrab → the questions → chokeOut / whipOut; freeHeld when a round takes Sam down under him): close, quiet body sounds a metre from
    //      the listener — cloth, breath, a throat, one hard knock. The voiced bits are a glottal pulse train (phase-accumulated in st[3], jittered) rounded off by the
    //      low-pass and gating a band of breath noise: no words, a stand-in for voices, kept well under the thuds. Levels sit against bodyHit at the takedown's 0.55
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
    // the choke, while the arm is closed: ONE GRAIN of strain, 0.62 s — pressed, creaky voice at ~75 Hz (short open phase, the rate wandering) with air forced past the
    // forearm chopped by the same pulses, under a slow tremor; an 80 ms rise and a 220 ms fall so grains retriggered every 0.4 s (player.ts CHOKE_GRAIN) run into one
    // strained sound, and letting go of Space just lets the last one die — nothing to stop
    chokeStrain: render(ctx, 0.62, (t, _i, sr, rnd, st) => {
      const n = rnd();
      const jit = lp(rnd(), st, 0, 0.002) * 120;
      st[3] += (74 + 9 * Math.sin(TAU * 2.1 * t) + jit) / sr; const ph = st[3] % 1;
      const pulse = ph < 0.3 ? Math.sin(Math.PI * ph / 0.3) ** 2 : 0;
      const voiced = lp(pulse - 0.15, st, 1, 0.05) * 0.9;
      const turb = (lp(n, st, 2, 0.2) - lp(n, st, 4, 0.045)) * (0.3 + 0.7 * pulse) * 1.05;
      const trem = 0.62 + 0.38 * Math.sin(TAU * 6.2 * t + 1);
      const win = Math.min(1, t / 0.08) * Math.min(1, (0.62 - t) / 0.22);
      return (voiced + turb) * trem * win * 0.75;
    }, 179),
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
    // the pistol-whip landing behind his ear: a sine thump diving 90 → 50 Hz over 80 ms (the blow going through his skull), a short dull knock with no ring to it
    // (bone, not wood), the click of the frame meeting it with the slide's steel answering for a few milliseconds, and his collar going over as the head does — the
    // loudest thing a hold makes, driven a little into tanh like the door slams
    whipThud: render(ctx, 0.34, (t, _i, sr, rnd, st) => {
      const n = rnd(), m = rnd();
      st[3] += (50 + 40 * Math.max(0, 1 - t / 0.08)) / sr;
      const thump = Math.sin(TAU * st[3]) * env(t, 0.0015, 0.06) * 1.0;
      const knock = (Math.sin(TAU * 330 * t) * 0.5 + Math.sin(TAU * 545 * t) * 0.3) * env(t, 0.001, 0.022) * 0.7 + lp(n, st, 0, 0.08) * env(t, 0.001, 0.035) * 1.2;
      const click = (n - lp(n, st, 1, 0.3)) * env(t, 0.0003, 0.004) * 0.6 + (Math.sin(TAU * 1750 * t) * 0.14 + Math.sin(TAU * 2890 * t) * 0.08) * env(t, 0.0005, 0.018);
      const band = lp(m, st, 2, 0.28) - lp(m, st, 4, 0.05); const tc = t - 0.04; const cloth = tc > 0 ? band * env(tc, 0.01, 0.08) * 0.45 : 0;
      return Math.tanh(thump + knock + click + cloth) * 0.9;
    }, 191),
    // the release: both palms into his shoulder blades (a low bump), his jacket and then his arms flung out (two bursts of cloth), and his first stumbling step
    // catching him — a shoe scuffing the floor: band hiss chopped by stick-slip over a low judder (propScrape's recipe, shorter and lighter)
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
    // Sam's question, under his breath by the man's ear: three breathy syllables a quarter of a second in all — band noise round one low formant (darker, brighter,
    // darker), half voiced by a soft pulse near 105 Hz falling a tone over the phrase, the middle syllable leaned on. No words: a placeholder for a voice, kept low.
    murmur: render(ctx, 0.3, (t, _i, sr, rnd, st) => {
      const n = rnd();
      const syl = [[0, 0.075, 0.8, 0.13], [0.09, 0.085, 1.0, 0.19], [0.19, 0.09, 0.7, 0.11]];   // start, length, weight, band coefficient
      let a = 0, k = 0.13;
      for (const [s0, len, w, kk] of syl) { const u = (t - s0) / len; if (u > 0 && u < 1) { a += Math.sin(Math.PI * u) ** 2 * w; k = kk; } }
      st[3] += (108 - 40 * t) / sr; const open = Math.max(0, Math.sin(TAU * st[3]));
      const band = (lp(n, st, 0, k) - lp(n, st, 1, 0.03)) * (0.5 + 0.5 * open);
      const hum = lp(open - 0.32, st, 2, 0.03);
      return (band * 1.7 + hum * 0.75) * a * 0.5;
    }, 197),
    // the man's side of it, muffled under the forearm: two syllables of closed-mouth voice ('mm-MMh') — a rounded pulse wave through two poles (lips shut, an arm over
    // them), the pitch up and over in alarm rather than stating anything, a thread of breath through the nose on each pulse. It starts 0.3 s INTO the buffer: played
    // with Sam's murmur it answers it; played as the hold locks it is his first sound in the arm.
    heldProtest: render(ctx, 0.82, (t, _i, sr, rnd, st) => {
      const tt = t - 0.3; if (tt < 0) return 0;
      const syl = [[0, 0.13, 0.7], [0.16, 0.24, 1.0]];
      let a = 0; for (const [s0, len, w] of syl) { const u = (tt - s0) / len; if (u > 0 && u < 1) a += Math.pow(Math.sin(Math.PI * u), 1.2) * w; }
      const f0 = 118 + 45 * Math.sin(Math.PI * Math.min(1, tt / 0.34)) + lp(rnd(), st, 0, 0.003) * 60;
      st[3] += f0 / sr; const ph = st[3] % 1;
      const glot = ph < 0.45 ? Math.sin(Math.PI * ph / 0.45) ** 2 : 0;
      const voice = lp(lp(glot - 0.225, st, 1, 0.06), st, 2, 0.06);
      const n = rnd(); const air = (lp(n, st, 4, 0.12) - lp(n, st, 5, 0.03)) * glot * 0.3;
      return (voice * 2.4 + air) * a * 0.42;
    }, 199),
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
    // devices (game/devices.ts). A keypad key: a soft square-ish 1.76 kHz blip, 60 ms, the membrane's click under it. The pad taking the code: two quick rising
    // tones (1.32 → 1.98 kHz) and the strike's clack. A tripwire reporting: the emitter's piezo — two-tone chirp (2.4 / 3.1 kHz alternating at 18 Hz) for a third
    // of a second, thin and directional; it is a tell for the player standing at it, the floor hears the radio, not this.
    padBeep: render(ctx, 0.08, (t, _i, _sr, rnd, st) => (Math.sign(Math.sin(TAU * 1760 * t)) * 0.5 + Math.sin(TAU * 1760 * t) * 0.5) * env(t, 0.002, 0.03) * 0.16 + (rnd() - lp(rnd(), st, 0, 0.3)) * env(t, 0.0003, 0.003) * 0.12, 227),
    padOpen: render(ctx, 0.32, (t, _i, sr, rnd, st) => { const f = t < 0.11 ? 1320 : 1980; st[3] += f / sr; const g2 = t < 0.11 ? env(t, 0.003, 0.06) : env(t - 0.11, 0.003, 0.09); const tc = t - 0.2; const clack = tc > 0 ? (rnd() - lp(rnd(), st, 0, 0.25)) * env(tc, 0.0005, 0.012) * 0.4 + Math.sin(TAU * 2100 * tc) * env(tc, 0.0005, 0.008) * 0.12 : 0; return Math.sin(TAU * st[3]) * g2 * 0.2 + clack; }, 229),
    alarmChirp: render(ctx, 0.36, (t, _i, sr, _rnd, st) => { const f = (Math.floor(t * 18) & 1) ? 3100 : 2400; st[3] += f / sr; return (Math.sin(TAU * st[3]) + 0.3 * Math.sign(Math.sin(TAU * st[3]))) * env(t, 0.004, 0.25) * (t < 0.33 ? 1 : env(t - 0.33, 0.001, 0.01)) * 0.14; }, 233),
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
