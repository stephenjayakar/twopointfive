// A THROW READS ITS DISTANCE — the check behind src/game/character.ts THROW_BY (on in the page, ?nothrowby; off on the frozen stand, TPS_THROWBY=1).
//   bun run tools/qa/throwby-check.ts        (also `probes.ts throwby`, family 'player')
// The animator on its own (a bare figure, standing, crouched, walking and with a gun in his hands, the switch put on by hand), then the stands and the whole Game:
//   (a) a throw told nothing, one told `full` m or more, and ANY throw with the switch off are one and the same overhand: the same pose, bit for bit, every
//       frame. (That this one overhand is the overhand as it was before the table is by reading the code — its `full` branch scales nothing — not by this line.)
//   (b) THE TOSS: told under `toss` m the wrist never comes above the shoulder joint (nor, from a gun held high, above where it started), goes back behind
//       it (from his side: a hand that starts on a gun goes back only as far as `tossIn` allows), and lets go ahead of it at chest height;
//   (w) A HARD THROW IS NO TOSS: told under `toss` m but leaving at `tossFast` m/s or more (the cursor far out, a wall two steps off) it is the shortest
//       overhand, the same pose as one told `toss` m; told a slow speed it is the toss;
//   (c) THE OVERHAND BY SIZE: from `toss` m up the wrist does come above the shoulder, and the further the throw the higher it peaks, the further behind the
//       shoulder it is cocked and the more the chest turns — strictly, across the band, the whole wind-up the most of all;
//   (d) nothing pops: no swing's wrist is faster in any frame than the whole wind-up's fastest or turns its line at speed more sharply (+ KINK°), the other
//       wrist is no faster and bent no further than in the whole wind-up (+ BEND°), no elbow folds under ELBOW° (or the whole wind-up's own fold, if that is
//       tighter), and each swing starts and ends on the hand of the pose underneath;
//   (e) the clock is one clock: every swing holds the can exactly as long (`throwing`) and is over on the same frame;
//   (r) a throw re-triggered mid-swing into ANOTHER read: each wrist, on its own, moves no further in a frame than that wrist ever does in a swing nobody
//       re-triggered, or re-triggered into itself, in the WHOLE WIND-UP — the swing as it was before the table — does (+ SLACK);
//   (y) A BLAST MID-SWING takes the swing: folded or blinded a few frames into any of the three, both wrists and the head go where the same man's go when he is
//       hit doing nothing (the fold's and the blinded hunch's own weights; MOVES raised for the line) — against a swing that throws on, with the switch off
//   (z) … only one that LANDS mid-swing: a throw begun already blinded or folded, or as either lets go, is the whole swing (the switch-off one)
//   (h) the stands: standUp() leaves the switch as the stand says (frozen: off unless TPS_THROWBY=1; shipped: on, from the harness's one boot), FROZEN_HOLDS and STAND_ENV carry the word,
//       the page's boot puts it on and ?nothrowby off, the knob registry and the journal's list hold the table;
//   (f) the Game, switch on: a can thrown short, middling and long — and one aimed far that a near wall stops, where the level has such a line — has the
//       animator on the swing its distance and its speed ask for;
//   (g) THE CAN IS NOT THE SWING'S: the same three throws with the switch off and on put the same can in the air on the same frame from the same place at the
//       same speed; and off, every one of them is the one overhand. (The BODY differs, and the guards see the body: with somebody watching, a run's digest may
//       differ off and on — that is the picture and the AI on one model, not this line's subject. Here nobody watches.)
//   (k) ONE CAN: switch on, the fist is not round a can on any frame the thrown one is in the air (combat.ts: `throwing` runs three frames past the release);
//       a wind-up called off before the release keeps its can in the fist, off and on;
// Not staged here: the two defender call sites (frag.ts, lanes.ts) pass the same distance the same way and are read, not run.
// THROWBY_BREAK=1 = the switch left off for the 'on' lines: (y), (f) and (k) must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const ELBOW = 45, SLACK = 0.02, KINK = 20, BEND = 10;

export async function throwbyCheck(): Promise<boolean> {
  const { standUp, loadCharacter } = await import('./headless.ts');
  const CH = await import(`${ROOT}/src/game/character.ts`);
  const { doThrow, throwOrigin } = await import(`${ROOT}/src/game/player.ts`);
  const P = await import(`${ROOT}/src/host/profile.ts`), K = await import(`${ROOT}/src/game/knobs.ts`), E = await import(`${ROOT}/src/host/standEnv.ts`);
  const { THROW_BY: BY, THROW_DUR, THROW_RELEASE } = CH;
  const DT = 1 / 60, rnd0 = Math.random, was = BY.on, DEG = 180 / Math.PI; let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== throwby: a throw reads its distance ===');
  try {
  const ch: any = await loadCharacter();
  type P3 = [number, number, number];
  const sub = (a: number[], b: number[]): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = (a: number[]) => Math.hypot(a[0], a[1], a[2]);
  type Carriage = 'standing' | 'crouched' | 'walking' | 'armed' | 'armed, crouched';
  const figure = (how: Carriage) => {
    Math.random = seeded(5);
    const c: any = new CH.Character(ch, { id: 1, tint: [0, 0, 0], tint2: [0, 0, 0], pos: [0, 0, 0], yaw: 0 }); c.anim.phase = 0; const gun = how === 'armed' || how === 'armed, crouched'; c.anim.upper = gun ? 'relaxed' : 'none';
    if (how === 'crouched' || how === 'armed, crouched') c.anim.crouchTarget = 1;
    const step = () => { if (how === 'walking') { c.anim.speed = 1.3; c.vel = [0, 0, 1.3]; c.pos = [c.pos[0], c.pos[1], c.pos[2] + 1.3 * DT]; } c.update(DT); };
    for (let i = 0; i < 60; i++) step();
    return { c, step, wristR: () => sub(c.bones.handR, c.bones.upperArmR), wristL: () => sub(c.bones.handL, c.bones.upperArmL) };
  };

  /** one swing of a bare figure, frame by frame: the wrist off the shoulder joint in his own frame (up, ahead), its speed, the elbow's fold, the chest's turn */
  interface Swing { read: string | null; restUp: number; frames: number; held: number; peakUp: number; back: number; relUp: number; relAhead: number; fast: number; kink: number; fastL: number; bendL: number; fold: number; turn: number; startGap: number; endGap: number; hash: string; }
  const cache = new Map<string, Swing>();
  const swing = (dist: number | undefined, how: Carriage, on = true, speed?: number): Swing => {
    const key = `${dist}|${how}|${on}|${speed}`, hit = cache.get(key); if (hit) return hit;
    const { c, step, wristR: wrist, wristL } = figure(how);
    const f = c.forward(), ahead = (v: number[]) => v[0] * f[0] + v[2] * f[2];
    const rest = wrist(); BY.on = on; c.anim.throwItem(dist, speed); BY.on = true; const read = c.anim.throwRead;
    const S: Swing = { read, restUp: rest[1], frames: 0, held: 0, peakUp: -9, back: 9, relUp: 0, relAhead: 0, fast: 0, kink: 0, fastL: 0, bendL: 0, fold: 180, turn: 0, startGap: 0, endGap: 0, hash: '' };
    let prev = wrist(), prevL = wristL(), pv: P3 = [0, 0, 0], h = 2166136261 >>> 0; const ang = (a: number[], b: number[]) => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.max(1e-9, len(a) * len(b))))) * DEG;
    const mix = (x: number) => { const b = new Float64Array([x]), u = new Uint32Array(b.buffer); h = Math.imul(h ^ u[0], 16777619) >>> 0; h = Math.imul(h ^ u[1], 16777619) >>> 0; };
    let released = false;
    for (let i = 0; i < 80 && c.anim.inThrow; i++) {
      const held = c.anim.throwing, t = c.anim.throwTime; step(); S.frames++; if (held) S.held++;
      const w = wrist(); if (i === 0) S.startGap = len(sub(w, rest));
      S.peakUp = Math.max(S.peakUp, w[1]); if (t < THROW_RELEASE) S.back = Math.min(S.back, ahead(w));
      if (!released && t + DT >= THROW_RELEASE) { released = true; S.relUp = w[1]; S.relAhead = ahead(w); }
      const v = sub(w, prev), wl = wristL(); if (how !== 'walking') { S.fast = Math.max(S.fast, len(v) / DT); S.fastL = Math.max(S.fastL, len(sub(wl, prevL)) / DT); if (len(v) / DT > 3 && len(pv) / DT > 3) S.kink = Math.max(S.kink, ang(v, pv)); } prev = w; prevL = wl; pv = v;
      S.bendL = Math.max(S.bendL, ang(sub(c.bones.handL, c.bones.forearmL), sub(c.bones.fingerL, c.bones.handL)));
      const ua = sub(c.bones.upperArmR, c.bones.forearmR), fa = sub(c.bones.handR, c.bones.forearmR); S.fold = Math.min(S.fold, Math.acos(Math.max(-1, Math.min(1, (ua[0] * fa[0] + ua[1] * fa[1] + ua[2] * fa[2]) / (len(ua) * len(fa))))) * DEG);
      const sh = sub(c.bones.upperArmL, c.bones.upperArmR); S.turn = Math.max(S.turn, Math.abs(Math.atan2(ahead(sh), Math.abs(sh[0] * f[2] - sh[2] * f[0]))) * DEG);
      for (const k of ['handR', 'handL', 'forearmR', 'forearmL', 'chest', 'hips', 'head', 'footL', 'footR']) for (const x of c.bones[k]) mix(x);
    }
    for (let i = 0; i < 12; i++) step(); S.endGap = how === 'walking' ? 0 : len(sub(wrist(), rest)); S.hash = h.toString(16);
    cache.set(key, S); return S;
  };
  /** a throw of `d1` re-triggered `at` frames into a throw of `d0` (at 0 = a plain throw of `d1`): the furthest each wrist moves in one frame over the `n` frames from there on */
  const moves = (d0: number, d1: number, at: number, n = 12, how: Carriage = 'standing'): { r: number; l: number } => {
    const { c, step, wristR, wristL } = figure(how); BY.on = true; if (at > 0) { c.anim.throwItem(d0); for (let i = 0; i < at; i++) step(); }
    let pr = wristR(), pl = wristL(), r = 0, l = 0; c.anim.throwItem(d1);
    for (let i = 0; i < n; i++) { step(); const wr = wristR(), wl = wristL(); r = Math.max(r, len(sub(wr, pr))); l = Math.max(l, len(sub(wl, pl))); pr = wr; pl = wl; }
    return { r, l };
  };

  BY.on = true;
  const HOWS: Carriage[] = ['standing', 'crouched', 'walking', 'armed', 'armed, crouched'], GUN = (how: Carriage) => how === 'armed' || how === 'armed, crouched';
  const TOSS = [0.5, 1, 2, BY.toss - 0.1], OVER = [BY.toss, BY.toss + 1.5, (BY.toss + BY.full) / 2, BY.full - 1.5, BY.full, BY.full + 3];
  const table: string[] = [];
  { // (a)
    const bad: string[] = [];
    for (const how of HOWS) { const base = swing(undefined, how, false); if (base.read !== 'full') bad.push(`${how}, told nothing, switch off: ${base.read}`);
      for (const [d, on] of [[undefined, true], [BY.full, true], [BY.full + 3, true], [40, true], [1, false], [6, false]] as [number | undefined, boolean][]) { const s = swing(d, how, on); if (s.hash !== base.hash || s.frames !== base.frames || s.read !== 'full') bad.push(`${how}, told ${d} m, switch ${on ? 'on' : 'off'}: ${s.read}, pose hash ${s.hash} against ${base.hash}`); } }
    line(!bad.length, `(a) a throw told nothing, or ${BY.full} m and over, or anything with the switch off, is one and the same overhand (nine bones' positions, bit for bit, every frame), standing, crouched, walking and with a gun in his hands`, bad.join(' · '));
  }
  for (const how of HOWS) {
    const full = swing(undefined, how);
    table.push(`${how}: ` + [...TOSS, ...OVER].map(d => { const s = swing(d, how); return `${d} m ${s.read} peak ${(s.peakUp * 100).toFixed(0)} cm, lets go ${(s.relUp * 100).toFixed(0)} cm up ${(s.relAhead * 100).toFixed(0)} ahead, elbow ${s.fold.toFixed(0)}°`; }).join(' · '));
    { // (b)
      const bad: string[] = []; let lastBack = 0;
      for (const d of TOSS) { const s = swing(d, how);
        if (s.read !== 'toss') bad.push(`${d} m reads ${s.read}`);
        if (s.peakUp > Math.max(-0.01, s.restUp + 0.005) || s.peakUp > 0) bad.push(`${d} m: the wrist comes to ${(s.peakUp * 100).toFixed(0)} cm of the shoulder's height (it starts at ${(s.restUp * 100).toFixed(0)})`);
        if (how !== 'walking' && !GUN(how) && s.back > -0.08) bad.push(`${d} m: the wrist goes no further back than ${(s.back * 100).toFixed(0)} cm`);
        if (s.relAhead < 0.3 || s.relUp > -0.05 || s.relUp < -0.32) bad.push(`${d} m: it lets go ${(s.relAhead * 100).toFixed(0)} cm ahead, ${(s.relUp * 100).toFixed(0)} cm up`);
        if (how === 'standing' && s.back > lastBack + 1e-4 && d > TOSS[0]) bad.push(`${d} m swings back less (${(s.back * 100).toFixed(1)} cm) than a shorter toss (${(lastBack * 100).toFixed(1)} cm)`); lastBack = s.back; }
      line(!bad.length, `(b) ${how}: under ${BY.toss} m it is an underhand toss — the wrist stays below the shoulder${how === 'walking' || GUN(how) ? '' : ', goes back behind it'} and lets go ahead at chest height`, bad.join(' · '));
    }
    { // (c)
      const bad: string[] = []; let last: Swing | null = null, lastD = 0;
      for (const d of OVER) { const s = swing(d, how);
        if (s.read !== (d >= BY.full ? 'full' : 'short')) bad.push(`${d} m reads ${s.read}`);
        if (s.peakUp < 0.03) bad.push(`${d} m: the wrist peaks ${(s.peakUp * 100).toFixed(0)} cm over the shoulder`);
        if (last && d <= BY.full && lastD < BY.full) { if (!(s.peakUp > last.peakUp + 0.002)) bad.push(`${d} m peaks ${(s.peakUp * 100).toFixed(1)} cm, ${lastD} m ${(last.peakUp * 100).toFixed(1)} cm`); if (!(s.back < last.back - 0.002)) bad.push(`${d} m cocks back ${(s.back * 100).toFixed(1)} cm, ${lastD} m ${(last.back * 100).toFixed(1)} cm`); if (how === 'standing' && !(s.turn > last.turn + 0.2)) bad.push(`${d} m turns the chest ${s.turn.toFixed(1)}°, ${lastD} m ${last.turn.toFixed(1)}°`); }
        last = s; lastD = d; }
      const least = swing(BY.toss, how); if (!(full.peakUp - least.peakUp > 0.05)) bad.push(`the shortest overhand peaks only ${((full.peakUp - least.peakUp) * 100).toFixed(1)} cm under the whole wind-up`);
      line(!bad.length, `(c) ${how}: from ${BY.toss} m the overhand grows with the distance — higher, further back${how === 'standing' ? ', more turn' : ''} — up to the whole wind-up at ${BY.full} m`, bad.join(' · '));
    }
    { // (d) (e)
      const bad: string[] = [], clock: string[] = [], floor = Math.min(full.fold, ELBOW);
      for (const d of [...TOSS, ...OVER]) { const s = swing(d, how);
        if (how !== 'walking' && s.fast > full.fast + 0.05) bad.push(`${d} m: wrist ${s.fast.toFixed(1)} m/s (the whole wind-up ${full.fast.toFixed(1)})`);
        if (s.fold < floor - 2) bad.push(`${d} m: the elbow folds to ${s.fold.toFixed(0)}°`);
        if (s.kink > full.kink + KINK) bad.push(`${d} m: the wrist's line turns ${s.kink.toFixed(0)}° in a frame at speed (the whole wind-up ${full.kink.toFixed(0)}°)`);
        if (how !== 'walking' && s.fastL > full.fastL + 0.5) bad.push(`${d} m: the other wrist ${s.fastL.toFixed(1)} m/s (the whole wind-up ${full.fastL.toFixed(1)})`);
        if (s.bendL > full.bendL + BEND) bad.push(`${d} m: the other wrist bends ${s.bendL.toFixed(0)}° (the whole wind-up ${full.bendL.toFixed(0)}°)`);
        if (s.startGap > 0.03 || s.endGap > 0.03) bad.push(`${d} m: starts ${(s.startGap * 100).toFixed(1)} cm, ends ${(s.endGap * 100).toFixed(1)} cm off the hand underneath`);
        if (s.frames !== full.frames || s.held !== full.held) clock.push(`${d} m: ${s.frames} frames, the can held ${s.held} (the whole wind-up ${full.frames}, ${full.held})`); }
      line(!bad.length, `(d) ${how}: nothing pops — ${how === 'walking' ? '' : `no wrist faster than the whole wind-up's ${full.fast.toFixed(1)} m/s, `}${how === 'walking' ? '' : `no corner in the wrist's line sharper than the whole wind-up's ${full.kink.toFixed(0)}° + ${KINK}, the other wrist no faster, `}the other wrist bent no further than in the whole wind-up (+ ${BEND}°), no elbow folded under ${floor.toFixed(0)}° (the whole wind-up's own: ${full.fold.toFixed(0)}°)${how === 'walking' ? '' : ', every swing on and off the hand underneath'}`, bad.join(' · '));
      line(!clock.length && Math.abs(full.frames * DT - THROW_DUR) < 2 * DT, `(e) ${how}: one clock — every swing is ${full.frames} frames and holds the can ${full.held}`, clock.join(' · '));
    }
  }
  { // (w)
    const bad: string[] = [];
    for (const how of HOWS) { const least = swing(BY.toss, how);
      for (const d of [0.8, 1.5, BY.toss - 0.2]) { const hard = swing(d, how, true, BY.tossFast + 1.5), soft = swing(d, how, true, BY.tossFast - 1.5), edge = swing(d, how, true, BY.tossFast);
        if (hard.read !== 'short' || hard.hash !== least.hash) bad.push(`${how}, ${d} m thrown hard: ${hard.read}, pose ${hard.hash} (the overhand told ${BY.toss} m: ${least.hash})`);
        if (edge.read !== 'short') bad.push(`${how}, ${d} m at ${BY.tossFast} m/s: ${edge.read}`);
        if (soft.read !== 'toss' || soft.hash !== swing(d, how).hash) bad.push(`${how}, ${d} m thrown softly: ${soft.read}`); } }
    line(!bad.length, `(w) a hard throw is no toss: told under ${BY.toss} m but leaving at ${BY.tossFast} m/s or more it is the shortest overhand (the pose of one told ${BY.toss} m); under that speed, the toss`, bad.join(' · '));
  }
  { // (r)
    const bad: string[] = [], seen: string[] = []; let wr = 0, wl = 0;
    for (const how of ['standing', 'armed', 'armed, crouched'] as Carriage[]) {
      const plain = moves(12, 12, 0, 45, how); let nr = plain.r, nl = plain.l;
      for (const at of [17, 30, 36]) { const m = moves(12, 12, at, 12, how); nr = Math.max(nr, m.r); nl = Math.max(nl, m.l); }
      for (const at of [17, 30, 36]) for (const [d0, d1] of [[12, 2], [12, 5], [2, 12], [5, 12], [2, 6], [6, 2], [5, 2], [6, 12], [2, 2], [5, 5]]) { const m = moves(d0, d1, at, 12, how); wr = Math.max(wr, m.r); wl = Math.max(wl, m.l);
        if (m.r > nr + SLACK) bad.push(`${how}, ${d0} m into ${d1} m at frame ${at}: the throwing wrist moves ${(m.r * 100).toFixed(1)} cm in a frame (its most otherwise: ${(nr * 100).toFixed(1)} cm)`);
        if (m.l > nl + SLACK) bad.push(`${how}, ${d0} m into ${d1} m at frame ${at}: the other wrist moves ${(m.l * 100).toFixed(1)} cm in a frame (its most otherwise: ${(nl * 100).toFixed(1)} cm)`); }
      seen.push(`${how}: into another read at most ${(wr * 100).toFixed(1)} / ${(wl * 100).toFixed(1)} cm a frame (throwing wrist / the other), otherwise ${(nr * 100).toFixed(1)} / ${(nl * 100).toFixed(1)}`); wr = wl = 0;
    }
    line(!bad.length, `(r) a throw re-triggered mid-swing into another read: neither wrist moves further in a frame than it does in the whole wind-up, plain or re-triggered into itself (+ ${SLACK * 100} cm), empty-handed and with a gun in his hands`, bad.length ? bad.join(' · ') : seen.join(' · '));
  }

  // ---- a blast mid-swing: the swing gives way to the fold and to the blinded hunch (those are MOVES': raised for these lines, put back after)
  { const MV = CH.MOVES, keep = { ...MV }, brk = process.env.THROWBY_BREAK === '1'; MV.on = 1; MV.dazzle = 1; MV.clutch = 1;
    const AT = 4, bad: string[] = [], seen: string[] = [], PARTS = ['the throwing wrist', 'the off wrist', 'the head'] as const;
    const hit = (c: any, kind: string, k = 1) => { if (kind === 'blinded') c.anim.dazzle = k ? { from: [0.05, 0, 3], k: 1 } : null; else { c.anim.clutch = k; c.anim.foldToo = true; } };
    const at = (f: ReturnType<typeof figure>): P3[] => [f.wristR(), f.wristL(), sub(f.c.bones.head, f.c.bones.hips)];
    /** a man hit `AT` frames into a throw against the same man hit doing nothing: how far apart their wrists and heads are, frame by frame, with how far the blast has him */
    const gaps = (kind: string, d: number, how: Carriage, on: boolean) => {
      const a = figure(how), b = figure(how); BY.on = true; a.c.anim.throwItem(d); BY.on = on; const out: { w: number; gap: number[] }[] = []; let fast = 0, pr = a.wristR();
      for (let i = 0; i < 46; i++) { if (i === AT) { hit(a.c, kind); hit(b.c, kind); } const m = a.c.anim.mvs, w = Math.max(m.cf.x, m.dz.x); a.step(); b.step();
        const pa = at(a), pb = at(b); fast = Math.max(fast, len(sub(pa[0], pr)) / DT); pr = pa[0]; out.push({ w, gap: pa.map((p, k) => len(sub(p, pb[k]))) }); }
      BY.on = true; return { out, fast };
    };
    /** a 12 m throw begun `after` frames after a hit that lasted `held` frames: every frame's wrists and head */
    const begun = (kind: string, held: number, after: number, on: boolean) => {
      const a = figure('standing'); hit(a.c, kind); for (let i = 0; i < held; i++) a.step(); if (after >= 0) { hit(a.c, kind, 0); for (let i = 0; i < after; i++) a.step(); }
      const w0 = Math.max(a.c.anim.mvs.cf.x, a.c.anim.mvs.dz.x); BY.on = true; a.c.anim.throwItem(12); BY.on = on; const out: number[] = []; for (let i = 0; i < 46; i++) { a.step(); for (const p of at(a)) out.push(...p); } BY.on = true; return { w0, out };
    };
    try {
      for (const kind of ['blinded', 'folded']) for (const how of ['standing', 'armed', 'crouched'] as Carriage[]) for (const d of [2, 5, 12]) {
        const off = gaps(kind, d, how, false), on = gaps(kind, d, how, !brk); const teeth = [0, 0, 0], half = [0, 0, 0], most = [0, 0, 0];
        for (let i = AT; i < off.out.length; i++) for (let k = 0; k < 3; k++) { const w = on.out[i].w, g0 = off.out[i].gap[k], g1 = on.out[i].gap[k], sl = k ? SLACK / 4 : SLACK; if (w >= 0.5) teeth[k] = Math.max(teeth[k], g0);
          if (w >= 0.5 && g1 > 0.8 * g0 + sl) half[k] = Math.max(half[k], g1 - 0.8 * g0); if (w >= 0.8 && g1 > 0.45 * g0 + sl) most[k] = Math.max(most[k], g1 - 0.45 * g0); }
        if (teeth[0] < 0.1) bad.push(`${kind}, ${how}, ${d} m: nothing to give way (the unfaded arm is never more than ${teeth[0].toFixed(2)} m off the hit man's)`);
        for (let k = 0; k < 3; k++) if (half[k] > 0 || most[k] > 0) bad.push(`${kind}, ${how}, ${d} m: ${PARTS[k]} throws on (${half[k].toFixed(3)} m over at half, ${most[k].toFixed(3)} m over at most of the way)`);
        if (on.fast > off.fast + 0.5) bad.push(`${kind}, ${how}, ${d} m: the wrist goes ${on.fast.toFixed(1)} m/s giving way, ${off.fast.toFixed(1)} throwing on`);
        if (d === 12 && how !== 'armed') seen.push(`${kind}, ${how}: wrist ${off.out[AT + 20].gap[0].toFixed(2)} → ${on.out[AT + 20].gap[0].toFixed(2)} m, off wrist ${teeth[1].toFixed(2)} m and head ${teeth[2].toFixed(3)} m at stake`);
      }
      if (!brk) { if (!(Math.max(...['blinded', 'folded'].map(k => gaps(k, 12, 'armed', false).out.reduce((m, o) => o.w >= 0.5 ? Math.max(m, o.gap[1]) : m, 0))) > 0.03)) bad.push('the off wrist is never at stake: the line cannot see its fade');
        if (!(Math.max(...['blinded', 'folded'].map(k => gaps(k, 12, 'crouched', false).out.reduce((m, o) => o.w >= 0.8 ? Math.max(m, o.gap[2]) : m, 0))) > 0.02)) bad.push('the head is never at stake: the line cannot see the trunk fade'); }
    } finally { Object.assign(MV, keep); }
    line(!bad.length, `(y) a blast mid-swing takes the swing: folded or blinded ${AT} frames into a toss, a short and a full overhand, standing, crouched and with a gun, both wrists and the head go where the hit man's go — by the time the blast has him halfway they are nearer than a swing that throws on, and most of the way there with it; nothing faster for it (a third of a second after the hit, the full overhand: ${seen.join(' · ')})`, bad.join(' · '));
    // … but only a blast that lands mid-swing: a throw begun already blinded or folded, or in the tail as either lets go, is the whole swing
    { MV.on = 1; MV.dazzle = 1; MV.clutch = 1; const bad: string[] = [], seen: string[] = [];
      try { for (const kind of ['blinded', 'folded']) for (const [name, held, after] of [['already', 90, -1], ['as it lets go', 90, 1], ['in its tail', 90, 12]] as const) {
          const off = begun(kind, held, after, false), on = begun(kind, held, after, true); let d = 0; for (let i = 0; i < off.out.length; i++) d = Math.max(d, Math.abs(on.out[i] - off.out[i]));
          seen.push(`${kind} ${name} ${on.w0.toFixed(2)}`); if (after < 12 && !(on.w0 > 0.5)) bad.push(`${kind} ${name}: he is only ${on.w0.toFixed(2)} hit as the throw begins, the case shows nothing`);
          if (after < 0 ? d > 0.005 : d !== 0) bad.push(`${kind} ${name}: the swing is not the whole one (a wrist or the head ${d.toFixed(3)} m off it)`); }
      } finally { Object.assign(MV, keep); }
      line(!bad.length, `(z) only a blast that LANDS mid-swing: a 12 m throw begun already blinded or folded, the frame either lets go, and in its tail is the whole swing — the switch-off one, bit for bit as the hit lets go and within half a centimetre while it still has him (how far the hit has him as each begins: ${seen.join(' · ')})`, bad.join(' · '));
    }
  }

  // ---- the stands
  { const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_THROWBY;
    const told = frozen || word !== undefined, want = told ? word === '1' : true;
    // (told: put the wrong way first, the stand must put it right. The shipped stand told nothing pins nothing: the switch is as the stand's one boot left
    //  it when the harness was loaded — `was`, read before this check touched it — and standUp() must leave that alone)
    BY.on = told ? !want : was; await quiet(() => standUp());
    const row = P.FROZEN_HOLDS['THROW_BY.on']; const keepK = K.knobsCopy(); let onEmpty: unknown, onNo: unknown, onOther: unknown; const stood = BY.on;
    try { BY.on = false; P.pageSwitches(new URLSearchParams('')); onEmpty = BY.on; P.pageSwitches(new URLSearchParams('nothrowby')); onNo = BY.on; P.pageSwitches(new URLSearchParams('noclose&nokitanim')); onOther = BY.on; } finally { K.knobsBack(keepK); }
    const reg = K.knobRegistry();
    const bad: string[] = [];
    if (stood !== want) bad.push(`standUp() left the switch ${stood}, the ${frozen ? 'frozen' : 'shipped'} stand${word !== undefined ? ` with TPS_THROWBY=${word}` : ''} wants ${want}`);
    if (!(typeof row === 'string' && /TPS_THROWBY=1/.test(row) && E.STAND_ENV.includes('TPS_THROWBY'))) bad.push(`FROZEN_HOLDS['THROW_BY.on'] = ${JSON.stringify(row)}, STAND_ENV has the word: ${E.STAND_ENV.includes('TPS_THROWBY')}`);
    if (!(onEmpty === true && onNo === false && onOther === true)) bad.push(`the page's boot: '' → ${onEmpty} · 'nothrowby' → ${onNo} · other flags → ${onOther}`);
    if (reg.THROW_BY !== BY || !K.JOURNAL_KNOBS.includes('THROW_BY')) bad.push(`the registry holds the table: ${reg.THROW_BY === BY}, the journal's list: ${K.JOURNAL_KNOBS.includes('THROW_BY')}`);
    line(!bad.length, `(h) the stands: standUp() leaves the switch ${want ? 'on' : 'off'} here, FROZEN_HOLDS and STAND_ENV carry TPS_THROWBY, the page's boot puts it on and ?nothrowby off, the registry and the journal's list hold the table`, bad.join(' · '));
  }

  // ---- the Game
  const want = (d: number, sp: number) => d < BY.toss && sp < BY.tossFast ? 'toss' : d < BY.full ? 'short' : 'full';
  /** throws short, middling and long, down the clearest line the level has from where he stands, and one aimed long down the line a wall stops soonest: what the animator read and what came out of his hand */
  const run = async (on: boolean) => {
    Math.random = seeded(21); const W: any = await quiet(() => standUp()); const g = W.game, pl = g.player;
    BY.on = on;   // (after the stand: it sets the switch its own way)
    g.playerInvisible = true; g.godMode = true; g.aiEnabled = false;
    for (let i = 0; i < 20; i++) W.step(DT);
    const out: { d: number; sp: number; read: string | null; item: string; both: number; fist: number }[] = []; let kept = false;
    for (const [aim, to] of [[1.2, 1.2], [6, 6], [13, 13], [13, 0]]) {   // [how far he aims, how far it should get]
      let best: any = null, bd = -1;
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, o = throwOrigin(g), sol = g.items.solve(o, [pl.char.pos[0] + Math.sin(a) * aim, 0.05, pl.char.pos[2] + Math.cos(a) * aim]); const d = Math.hypot(sol.land[0] - pl.char.pos[0], sol.land[2] - pl.char.pos[2]); if (bd < 0 || Math.abs(d - to) < Math.abs(bd - to)) { best = sol; bd = d; } }
      pl.canisters = Math.max(pl.canisters, 2); pl.slot = 'smoke'; pl.holstered = false; W.step(DT); const n0 = g.items.items.length; doThrow(g, best, 'smoke'); /* (the smoke slot selected, a can to spare: the fist shows what a click would throw) */ const read = pl.char.anim.throwRead;
      let item = 'none', both = 0, fist = 0; for (let i = 0; i < 70; i++) { W.step(DT); const air = g.items.items.length > n0; if (i < 40 && pl.char.anim.grip[1]) { fist++; if (air) both++; } if (item === 'none' && air) { const it = g.items.items[g.items.items.length - 1]; item = `f${i} ${[...it.pos, ...it.vel].map((x: number) => x.toFixed(4)).join(',')}`; } }
      out.push({ d: bd, sp: Math.hypot(best.v0[0], best.v0[2]), read, item, both, fist });
      if (aim === 1.2) { /* a wind-up called off before the release: the can is back on his belt and stays in his fist */
        pl.canisters = Math.max(pl.canisters, 2); doThrow(g, best, 'smoke'); for (let i = 0; i < 8; i++) W.step(DT); pl.pendingThrow = null; pl.canisters++; for (let i = 0; i < 4; i++) W.step(DT); kept = !!pl.char.anim.grip[1]; for (let i = 0; i < 60; i++) W.step(DT); }
    }
    return { out, kept };
  };
  const off = await run(false), on = await run(process.env.THROWBY_BREAK !== '1');
  { const bad = on.out.filter(o => o.read !== want(o.d, o.sp)).map(o => `${o.d.toFixed(1)} m at ${o.sp.toFixed(1)} m/s read ${o.read}, wanted ${want(o.d, o.sp)}`); const kinds = new Set(on.out.map(o => want(o.d, o.sp)));
    if (!kinds.has('toss') || kinds.size < 2) bad.push(`the level gave no line for both a toss and an overhand (${on.out.map(o => o.d.toFixed(1)).join(', ')} m)`);
    const wall = on.out[3], stopped = wall.d < BY.toss && wall.sp >= BY.tossFast;
    line(!bad.length, `(f) the Game, switch on: cans thrown ${on.out.map(o => `${o.d.toFixed(1)} m at ${o.sp.toFixed(1)} m/s`).join(', ')} are swung as ${on.out.map(o => want(o.d, o.sp)).join(', ')}${stopped ? ' (the last: aimed far, a wall stops it short)' : ' (no wall stops a far throw inside toss range from here: that case is line (w) only)'}`, bad.join(' · ')); }
  { const bad: string[] = [];
    off.out.forEach((o, i) => { if (o.read !== 'full') bad.push(`off, ${o.d.toFixed(1)} m read ${o.read}`); if (o.item === 'none' || o.item !== on.out[i].item) bad.push(`${o.d.toFixed(1)} m: the can off ${o.item} · on ${on.out[i].item}`); });
    line(!bad.length, `(g) the can is not the swing's: off and on the same cans leave the hand on the same frame from the same place at the same speed, and off every throw is the one overhand`, bad.join(' · ')); }
  { const bad = on.out.filter(o => o.both > 0).map(o => `${o.d.toFixed(1)} m: the fist is still round a can for ${o.both} frames with the thrown one in the air`);
    const seen = on.out.some(o => o.fist > 0) || off.out.some(o => o.fist > 0);   // (the fist's flag is written by the prop pass: a harness that never runs it shows nothing here)
    if (!on.kept || !off.kept) bad.push(`a wind-up called off before the release leaves the fist ${on.kept ? 'round' : 'empty of'} its can on, ${off.kept ? 'round' : 'empty of'} it off`);
    if (process.env.THROWBY_BREAK !== '1' && !seen) bad.push('the fist is never round a can in any of these throws: this stand does not run the prop pass, and the line sees nothing');
    line(!bad.length, `(k) one can: switch on, the fist lets go of its can the frame the thrown one is in the air (off, it holds one for ${off.out.map(o => o.both).join(', ')} frames more); a wind-up called off before the release keeps its can either way`, bad.join(' · ')); }
  for (const t of table) console.log(`  ${t}`);
  } finally { BY.on = was; Math.random = rnd0; }
  return all;
}

if (import.meta.main) process.exit((await throwbyCheck()) ? 0 : 1);
