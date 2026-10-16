// STEALTH POSES (src/game/stealthpose.ts — the feed in stealthfeed.ts, the animator's half in character.ts stealthLayer / stealthPicture), headless:
//   bun run tools/qa/stealthpose-check.ts [harness|off|idle|walk|rise|creep|cable|standdown …]      (probes.ts stealthpose; STEALTHPOSE_BREAK=1 = the switch left off: must fail)
// THE CONTRACT: one switch, STEALTHPOSE.on, and it changes NO RULE — Sam stands where he stood on every frame, at the pace he had. It moves his ARMS when his
// hands are empty in a crouch, plus a centimetre of sway at a stand; at a door with the wand he squats and bows to the gap, and that IS the pose (`bones` go with it).
//   harness    the two stands' row, the stand word, the page's switch, the knob registry, a recording's tables
//   off        the switch off: nothing is ever fed and the layer is never made; the same run twice hashes the same poses and digests the same; the switch ON
//              with every half off writes the very same poses and digest (the code path with nothing to do changes nothing)
//   idle       crouched at a stand: both wrists forward of the knees, between 0.15 m off the floor and the higher knee, never a held frame
//   walk       the crouch walk: the hand opposite the forward foot is the forward hand; wrists never under the floor
//   rise       standing up and crouching down on the move
//   creep      the close-in mode near a man: the free (left) hand reaches further forward than without
//   cable      the look under a door: the pose itself — the drawn skeleton and `bones` are one (what is drawn is what the game reads), the head below the
//              shoulder line and well under the kneel's, never higher than off, the right wrist low at the gap, the lock work's flag and the wand's look untouched
//   standdown  the pistol drawn from the crouch: the layer is out inside 0.3 s
// Every part also holds: his place (`pos`) equal on and off on every frame, `bones.head` never higher than off, and prints + bounds how far `bones.head` and
// `bones.chest` are from the switch-off run (2 cm; outside the look itself, where his head really is lower). Run it on both stands (plain, and TPS_PROFILE=shipped): it writes the switch
// itself for each arm. The stagings are tools/qa/stealth-strip.ts's own.
import { standUp, ROOT } from './headless.ts';
const { STEALTHPOSE } = await import(`${ROOT}/src/game/stealthpose.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { KITANIM, KITANIM_STATS } = await import(`${ROOT}/src/game/kitanim.ts`);
const { WAND } = await import(`${ROOT}/src/game/wand.ts`);
const { m4 } = await import(`${ROOT}/src/math/vec.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const KN: any = await import(`${ROOT}/src/game/knobs.ts`);
const ST: any = await import('./stealth-strip.ts');

type P3 = number[];
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const BREAK = process.env.STEALTHPOSE_BREAK === '1';
const DT = 1 / 60, EAST = Math.PI / 2, J = JSON.stringify;
const cm = (x: number) => (Number.isFinite(x) ? (x * 100).toFixed(1) : String(x)), f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const dist = (a: P3, b: P3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const HALVES = { idle: true, walk: true, rise: true, creep: true, cable: true, nod: true };
/** the switch for an arm (STEALTHPOSE_BREAK=1: left off, the on-lines then asked of the build as it was) */
const arm = (on: boolean, halves = true) => () => { Object.assign(STEALTHPOSE, { on: on && !BREAK }, halves ? HALVES : { idle: false, walk: false, rise: false, creep: false, cable: false }); };

/** one frame of a run: his place, the game's bones (world, and in his own frame: left, up, forward), the DRAWN skeleton's head / shoulders / right wrist */
interface Rec { pos: P3; head: P3; chest: P3; hL: P3; hR: P3; kL: P3; kR: P3; fL: P3; fR: P3; wHead: P3; wChest: P3; dHead: P3; dShoL: P3; dShoR: P3; dHR: P3; fed: boolean; made: boolean; wA: number; lockpick: boolean; wanding: boolean; creep: boolean; ready: string | null }
interface Run { recs: Rec[]; hash: number; digest: string }
function rec(g: any): Rec {
  const c = g.player.char, F = ST.frameOf(c), n = c.anim.nodes, D = (k: string): P3 => F.rel(m4.transformPoint(c.world, c.skel.nodePos(n[k]))), B = (k: string): P3 => F.rel(c.bones[k]);
  return { pos: [...c.pos], head: B('head'), chest: B('chest'), hL: B('handL'), hR: B('handR'), kL: D('shinL'), kR: D('shinR'), fL: D('footL'), fR: D('footR'), wHead: [...c.bones.head], wChest: [...c.bones.chest],
    dHead: D('head'), dShoL: D('upperArmL'), dShoR: D('upperArmR'), dHR: D('handR'), fed: c.anim.stealth != null, made: (c.anim as any).sp != null, wA: (c.anim as any).sp?.wA ?? 0, lockpick: !!c.anim.lockpick, wanding: !!g.player.wanding, creep: !!c.anim.creep, ready: c.anim.ready ?? null };
}
function hashPose(h: number, g: any): number { const d: Float32Array = g.player.char.anim.pose.data, u = new Uint32Array(d.buffer, d.byteOffset, d.length); for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0; return h; }
type Part = 'idle' | 'walk' | 'rise' | 'creep' | 'cable' | 'draw';
/** a part played from a fresh stand-up on its own seed, the switch written before the first step */
async function play(part: Part, first: () => void): Promise<Run> {
  const recs: Rec[] = []; let hash = 2166136261, g: any;
  const snap = () => { recs.push(rec(g)); hash = hashPose(hash, g); };
  if (part === 'cable') {
    const S = await ST.atDoor(7105, first); g = S.g; snap();
    if (!S.begin()) throw new Error("cable: the wand's row was not offered");
    snap(); for (let i = 0; i < 100; i++) { S.W.step(DT); snap(); }
    S.W.input.pressed.add('Space'); for (let i = 0; i < 60; i++) { S.W.step(DT); snap(); }
  } else {
    const S = await ST.lobby(7100 + ['idle', 'walk', 'rise', 'creep', 'cable', 'draw'].indexOf(part), true, part === 'creep' ? [5.6, 0, 19.5] : [6.5, 0, 19.5], () => { first(); if (part === 'creep') CLOSE.on = true; }); g = S.g;
    const go = (n: number) => { for (let i = 0; i < n; i++) { S.step(1); snap(); } };
    if (part === 'idle') go(150);
    else if (part === 'walk') { S.W.input.keys.add('KeyD'); go(150); }
    else if (part === 'rise') { S.W.input.keys.add('KeyD'); go(50); g.player.crouch = false; go(70); g.player.crouch = true; go(60); }
    else if (part === 'creep') { const A = g.guards[0]; ST.place(A, [10.2, 0, 19.5], EAST); A.hold = true; A.pinned = true; S.W.input.keys.add('KeyD'); let n = 0; while (g.player.char.pos[0] < 10.2 - 1.3 && n++ < 500) go(1); }
    else { go(30); S.W.input.pressed.add('KeyE'); go(40); }
  }
  return { recs, hash, digest: J(digestGame(g, true)) };
}
const cache = new Map<string, Promise<Run>>();
export const run = (part: Part, on: boolean, halves = true, again = 0) => { const k = `${part}:${on}:${halves}:${again}`; let r = cache.get(k); if (!r) cache.set(k, r = hushed(() => play(part, arm(on, halves)))); return r; };

/** the lines every part holds, on against off */
function common(F: { verdict: Verdict }, part: string, on: Run, off: Run, bound: number, skip: (i: number) => boolean = () => false) {
  const n = Math.min(on.recs.length, off.recs.length); let dPos = 0, dHead = 0, dChest = 0, up = -Infinity, low = Infinity;
  for (let i = 0; i < n; i++) { const a = on.recs[i], b = off.recs[i]; dPos = Math.max(dPos, dist(a.pos, b.pos)); if (!skip(i)) { dHead = Math.max(dHead, dist(a.wHead, b.wHead)); dChest = Math.max(dChest, dist(a.wChest, b.wChest)); } up = Math.max(up, a.wHead[1] - b.wHead[1]); low = Math.min(low, a.hL[1], a.hR[1]); }
  F.verdict(on.recs.length === off.recs.length && dPos < 1e-9, `${part}: his place is the same on every frame, switch on and off (no pace, no step of the game's moved)`, `${n} frames · furthest apart ${dPos.toExponential(1)} m`);
  F.verdict(up <= 0.001, `${part}: bones.head is never higher than with the switch off`, `most it is above: ${cm(up)} cm`);
  F.verdict(dHead <= bound && dChest <= bound, `${part}: bones.head and bones.chest stay within ${cm(bound)} cm of the switch-off run`, `head ≤ ${cm(dHead)} cm · chest ≤ ${cm(dChest)} cm`);
  F.verdict(low > 0.02, `${part}: neither wrist is ever under the floor`, `lowest wrist ${cm(low)} cm up`);
}
const fedAny = (r: Run) => r.recs.some(x => x.fed || x.made);

export async function stealthposeOff(): Promise<boolean> {
  const F = family('stealthpose-off: the switch off is the build — nothing fed, the layer never made, the poses and the digest the same');
  const was = { ...STEALTHPOSE }, rnd = Math.random;
  try {
    for (const part of ['idle', 'walk', 'rise', 'cable'] as Part[]) {
      const a = await run(part, false), b = await run(part, false, true, 1), c = await hushed(() => play(part, () => { Object.assign(STEALTHPOSE, { on: true, idle: false, walk: false, rise: false, creep: false, cable: false }); }));
      F.verdict(!fedAny(a), `${part}: off, the animator is fed nothing and the layer's state is never made`, `frames fed or made: ${a.recs.filter(x => x.fed || x.made).length} of ${a.recs.length}`);
      F.verdict(a.hash === b.hash && a.digest === b.digest, `${part}: off, the same run twice writes the same poses and digests the same`, `pose hash ${a.hash.toString(16)} / ${b.hash.toString(16)} · digest equal ${a.digest === b.digest}`);
      F.verdict(c.hash === a.hash && c.digest === a.digest, `${part}: the switch ON with every half off writes the very poses and digest of the switch off`, `pose hash ${c.hash.toString(16)} against ${a.hash.toString(16)} · digest equal ${c.digest === a.digest}`);
    }
  } finally { Object.assign(STEALTHPOSE, was); Math.random = rnd; }
  return F.done();
}

export async function stealthposeIdle(): Promise<boolean> {
  const F = family('stealthpose-idle: crouched at a stand, hands empty — the arms hang forward of the knees, and never a held frame');
  const was = { ...STEALTHPOSE }, rnd = Math.random;
  try {
    const on = await run('idle', true), off = await run('idle', false); common(F, 'idle', on, off, 0.02);
    const side = (rs: Rec[]) => { let fwd = Infinity, lo = Infinity, hi = -Infinity; for (const r of rs) { const kz = Math.max(r.kL[2], r.kR[2]), ky = Math.max(r.kL[1], r.kR[1]); fwd = Math.min(fwd, r.hL[2] - kz, r.hR[2] - kz); lo = Math.min(lo, r.hL[1], r.hR[1]); hi = Math.max(hi, r.hL[1] - ky, r.hR[1] - ky); } return { fwd, lo, hi }; };
    const A = side(on.recs.slice(20)), B = side(off.recs.slice(20));
    F.verdict(A.fwd > 0, 'both wrists are forward of the front knee on every frame', `on: the nearer wrist is ${cm(A.fwd)} cm in front of it · off: ${cm(B.fwd)} cm`);
    F.verdict(A.lo >= 0.15 && A.hi <= 0, 'both wrists are between 0.15 m off the floor and the higher knee', `on: lowest ${cm(A.lo)} cm up, highest ${cm(A.hi)} cm against the higher knee · off: ${cm(B.lo)} / ${cm(B.hi)}`);
    const span = (rs: Rec[], k: 'hL' | 'hR' | 'wHead') => { let m = 0; for (const r of rs) m = Math.max(m, dist(r[k], rs[0][k])); return m; };
    const mv = Math.min(span(on.recs.slice(20), 'hL'), span(on.recs.slice(20), 'hR'));
    let still = 0, runL = 0; for (let i = 21; i < on.recs.length; i++) { runL = dist(on.recs[i].hL, on.recs[i - 1].hL) < 1e-5 ? runL + 1 : 0; still = Math.max(still, runL); }
    F.verdict(mv > 0.008 && still < 6, 'never a held frame: each wrist drifts more than 8 mm over the cycle, and is never still six frames running', `wrists travel ≥ ${cm(mv)} cm · longest run of still frames ${still}`);
    F.verdict(on.recs.slice(30).every(r => r.wA > 0.9), 'the layer is fully in from half a second on', `least weight ${f2(Math.min(...on.recs.slice(30).map(r => r.wA)))}`);
  } finally { Object.assign(STEALTHPOSE, was); Math.random = rnd; }
  return F.done();
}

export async function stealthposeWalk(): Promise<boolean> {
  const F = family('stealthpose-walk: the crouch walk, hands empty — the hand opposite the forward foot is the forward hand');
  const was = { ...STEALTHPOSE }, rnd = Math.random;
  try {
    const on = await run('walk', true), off = await run('walk', false); common(F, 'walk', on, off, 0.02);
    const tally = (rs: Rec[]) => { let steps = 0, ok = 0, held = 0, sgn = 0, worst = Infinity;
      for (let i = 40; i < rs.length; i++) { const r = rs[i], d = r.fR[2] - r.fL[2], s = Math.abs(d) > 0.3 ? Math.sign(d) : 0; held = s !== 0 && s === sgn ? held + 1 : 0; sgn = s;
        if (held === 8) { steps++; const lead = s * (r.hL[2] - r.hR[2]); worst = Math.min(worst, lead); if (lead > 0.1) ok++; } }   // (s > 0: the right foot is ahead, so the LEFT hand leads)
      return { steps, ok, worst }; };
    const A = tally(on.recs), B = tally(off.recs);
    F.verdict(A.steps >= 3 && A.ok === A.steps, 'on every step the hand opposite the forward foot is more than 10 cm ahead of the other', `on: ${A.ok} of ${A.steps} steps, least lead ${cm(A.worst)} cm · off: ${B.ok} of ${B.steps}, least ${cm(B.worst)} cm`);
    let hi = -Infinity; for (const r of on.recs.slice(40)) { const ky = Math.max(r.kL[1], r.kR[1], 0.5); hi = Math.max(hi, r.hL[1] - ky, r.hR[1] - ky); }
    F.verdict(hi <= 0.1, 'the hands stay low: no wrist more than 10 cm over knee height', `highest ${cm(hi)} cm against the higher knee`);
  } finally { Object.assign(STEALTHPOSE, was); Math.random = rnd; }
  return F.done();
}

export async function stealthposeRise(): Promise<boolean> {
  const F = family('stealthpose-rise: standing up and crouching down on the move — arms only');
  const was = { ...STEALTHPOSE }, rnd = Math.random;
  try {
    const on = await run('rise', true), off = await run('rise', false); common(F, 'rise', on, off, 0.02);
    const up = (rs: Rec[]) => rs.slice(56, 80).reduce((m, r) => m + r.hL[1] + r.hR[1], 0) / 48;
    F.verdict(up(on.recs) < up(off.recs) - 0.005, 'standing up, the hands come up after him: over the first 0.4 s they are lower than with the switch off', `mean wrist height on ${cm(up(on.recs))} cm · off ${cm(up(off.recs))} cm`);
    { const dU = on.recs.slice(110, 120).reduce((m, r, i) => Math.max(m, dist(r.hL, off.recs[110 + i].hL), dist(r.hR, off.recs[110 + i].hR)), 0);
      F.verdict(on.recs.slice(110, 120).every(r => r.wA > 0.9) && dU < 0.005, 'upright, hands empty, the layer is still fed and poses nothing: both wrists are the switch-off run\'s', `weight ${f2(on.recs[115].wA)} · wrists ≤ ${cm(dU)} cm apart`); }
    const d = on.recs.slice(160).reduce((m, r, i) => Math.max(m, dist(r.hL, off.recs[160 + i].hL)), 0);
    F.verdict(d > 0.05, 'crouched again, the arms are back in the layer inside 0.7 s', `left wrist ${cm(d)} cm from the switch-off run`);
  } finally { Object.assign(STEALTHPOSE, was); Math.random = rnd; }
  return F.done();
}

export async function stealthposeCreep(): Promise<boolean> {
  const F = family('stealthpose-creep: the close-in mode near a man — the free hand leads');
  const was = { ...STEALTHPOSE }, wasClose = CLOSE.on, rnd = Math.random;
  try {
    const on = await run('creep', true), off = await run('creep', false); common(F, 'creep', on, off, 0.02);
    // (the frames the close-in mode has him and the knife's tell does not yet: in reach the tell's own arms are the build's. Off, the mode's carriage holds the
    //  left hand STILL — at arm's reach, chest high on the frozen stand; down at his side under the page's kit handling (KIT.close.left) — and on, it goes out LOW
    //  with its own foot and comes back as he passes over it)
    const lead = (rs: Rec[]) => { let y = 0, n = 0, out = 0, no = 0, back = 0, nb = 0, lo = Infinity, hi = -Infinity;
      for (const r of rs.slice(12)) if (r.creep && !r.ready) { const z = r.hL[2] - r.chest[2]; y += r.hL[1]; n++; lo = Math.min(lo, z); hi = Math.max(hi, z); if (r.fL[2] > 0.1) { out += z; no++; } else if (r.fL[2] < -0.3) { back += z; nb++; } }
      return { y: y / Math.max(1, n), n, out: out / Math.max(1, no), back: back / Math.max(1, nb), travel: hi - lo }; };
    const A = lead(on.recs.slice(84)), B = lead(off.recs.slice(84));
    F.verdict(A.n >= 20 && A.y < 0.5 && A.y > 0.25, 'in the mode and out of reach, the free (left) hand is carried LOW: between shin and knee height', `${A.n} frames · on: ${cm(A.y)} cm up on average · off: ${cm(B.y)} cm (the frozen stand holds it chest high, the page's kit handling at his side)`);
    F.verdict(A.out > A.back + 0.1 && A.out > 0.3, 'it leads its own foot: out in front while the left foot is forward, back while that foot is behind him', `on: ${cm(A.out)} cm ahead of the chest with the foot forward, ${cm(A.back)} cm with it behind · off: ${cm(B.out)} / ${cm(B.back)} cm (held still)`);
    F.verdict(A.travel > 0.15 && B.travel < 0.1, 'so it is never a held hand: it travels with every step, where the mode alone holds it', `on: ${cm(A.travel)} cm of travel · off: ${cm(B.travel)} cm`);
    let dR = 0; const n = Math.min(on.recs.length, off.recs.length); for (let i = n - 40; i < n; i++) dR = Math.max(dR, dist(on.recs[i].hR, off.recs[i].hR));
    F.verdict(dR < 0.03, "the right hand is the close-in mode's own (the knife hand): where it is with the switch off", `right wrist ≤ ${cm(dR)} cm from the switch-off run over the last 40 frames`);
  } finally { Object.assign(STEALTHPOSE, was); CLOSE.on = wasClose; Math.random = rnd; }
  return F.done();
}

export async function stealthposeCable(): Promise<boolean> {
  const F = family("stealthpose-cable: the look under a door — a squat bowed to the gap, the pose itself (drawn and read as one)");
  const was = { ...STEALTHPOSE }, rnd = Math.random;
  try {
    const on = await run('cable', true), off = await run('cable', false);
    const look = (() => { let last = -1e9; return on.recs.map((r, i) => { if (r.wanding || r.lockpick) last = i; return i - last <= 45; }); })();   // (the look and the three quarters of a second he takes to come out of it)
    common(F, 'cable', on, off, 0.02, i => look[i]);   // (before the row and once out of it he is at a crouch with empty hands: the idle's sway)
    { let dOn = 0, dOff = 0; const j = (r: Rec) => dist(r.dHead, r.head); const j0 = j(off.recs[0]); for (const r of on.recs) dOn = Math.max(dOn, Math.abs(j(r) - j0)); for (const r of off.recs) dOff = Math.max(dOff, Math.abs(j(r) - j0));
      F.verdict(dOn < 1e-4 + dOff, 'on every frame the DRAWN head joint is where bones.head has it (one skeleton: what is drawn is what the game reads)', `drawn joint to bones.head: ${cm(j0)} cm of the head's own, never more than ${dOn.toExponential(1)} m off that with the switch on · ${dOff.toExponential(1)} m off`); }
    { let k = 0, least = Infinity, since = 0; for (let i = 0; i < Math.min(on.recs.length, off.recs.length); i++) { const a = on.recs[i], b = off.recs[i]; since = a.wanding ? since + 1 : 0; if (since > 30) { k++; least = Math.min(least, b.wHead[1] - a.wHead[1]); } }
      F.verdict(k > 40 && least > 0.1, 'from half a second into the look bones.head is more than 10 cm under the lock work\'s kneel (his eye, his capsules and the meter are down there with him)', `${k} frames · least ${cm(least)} cm lower`); }
    const n = Math.min(on.recs.length, off.recs.length), same = on.recs.slice(0, n).every((r, i) => r.lockpick === off.recs[i].lockpick && r.wanding === off.recs[i].wanding);
    F.verdict(same && on.recs[60].lockpick && on.recs[60].wanding, "the lock work's flag and the wand's look are what they are with the switch off, frame for frame", `same ${same} · a second in: lockpick ${on.recs[60].lockpick}, wanding ${on.recs[60].wanding}`);
    const a = on.recs[60], b = off.recs[60], sho = Math.min(a.dShoL[1], a.dShoR[1]);
    F.verdict(a.dHead[1] < sho && a.dHead[1] < b.dHead[1] - 0.1, 'a second in, the head is bowed below the shoulder line (and well under the kneel\'s)', `drawn head ${cm(a.dHead[1])} cm up · shoulders ${cm(sho)} cm · off: head ${cm(b.dHead[1])} cm`);
    F.verdict(a.dHR[1] < 0.35 && a.dHR[2] > a.kL[2] - 0.05, 'the right wrist is low at the gap', `${cm(a.dHR[1])} cm up, ${cm(a.dHR[2])} cm forward`);
    let hi = -Infinity; for (let i = 0; i < n; i++) hi = Math.max(hi, on.recs[i].dHead[1] - off.recs[i].dHead[1]);
    F.verdict(hi <= 0.001, 'the head is never higher than with the switch off', `most it is above: ${cm(hi)} cm`);
    const t = on.recs.findIndex((r, i) => i > 1 && r.dHead[1] < sho + 0.03);
    F.verdict(t > 0 && t <= 40, 'he is down in it inside two thirds of a second of the row', `frame ${t}`);
    const end = on.recs[n - 1], endOff = off.recs[n - 1];
    F.verdict(dist(end.dHead, endOff.dHead) < 0.02, 'a second after he lets go he is the crouch again', `drawn head ${cm(dist(end.dHead, endOff.dHead))} cm from the switch-off run`);
    // a goggle NOD inside the look (the hands are the look's, so a flip there is the nod): the look at the gap must not take it back out
    { type NodRun = { dir: P3; down: number; head: P3 }[];
      const nodRun = async (o: { flip: 'down' | 'up' | null; at?: number; key?: boolean }): Promise<NodRun> => hushed(async () => {
        // (the flip is asked for with the N KEY, as he asks: the wand reads it while he looks — WAND.nv — and kit handling makes it a nod, his hands being on the cable; both raised here, since the frozen stand has kit handling off and there no nod exists at all)
        const kit = { on: KITANIM.on, nv: KITANIM.nv }, wnv = WAND.nv;
        try {
        const S = await ST.atDoor(7105, () => { arm(true)(); STEALTHPOSE.nod = o.key ?? true; KITANIM.on = true; KITANIM.nv = true; WAND.nv = true; }), pl = S.g.player, c = pl.char; if (o.flip === 'up') pl.nv = true;   // (goggles up: they are down before he kneels)
        if (!S.begin()) throw new Error("cable: the wand's row was not offered");
        const at = o.at ?? 70, out: NodRun = [], nods0 = KITANIM_STATS.nv.nod;
        for (let i = 0; i < at + 36; i++) { if (i === at && o.flip) S.W.input.pressed.add('KeyN'); S.W.step(DT);
          if (i === at && o.flip && (pl.nv !== (o.flip === 'down') || KITANIM_STATS.nv.nod !== nods0 + 1)) throw new Error(`cable: N during the look did not flip the goggles by a nod (nv ${pl.nv}, nods ${KITANIM_STATS.nv.nod - nods0})`);
          if (i >= at) { const h = c.headDir(); out.push({ dir: [h[0], h[1], h[2]], down: Math.asin(Math.max(-1, Math.min(1, -h[1]))) * 180 / Math.PI, head: [...c.bones.head] as P3 }); } }
        return out;
        } finally { Object.assign(KITANIM, kit); WAND.nv = wnv; } });
      const ang = (a: P3, b: P3) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180 / Math.PI;
      const cmp = (fl: NodRun, st: NodRun) => { let peak = 0, steeper = -Infinity, joint = 0, late = 0, step = 0, down = 0;
        for (let i = 0; i < fl.length; i++) { const d = ang(fl[i].dir, st[i].dir); peak = Math.max(peak, d); steeper = Math.max(steeper, fl[i].down - st[i].down); joint = Math.max(joint, dist(fl[i].head, st[i].head)); down = Math.max(down, fl[i].down);
          if (i > 0) step = Math.max(step, ang(fl[i].dir, fl[i - 1].dir)); if (i >= 30) late = Math.max(late, d); }
        return { peak, steeper, joint, late, step, down }; };
      const said = (m: ReturnType<typeof cmp>, st: NodRun) => `head turned ${m.peak.toFixed(1)}° at most from the same frames with no flip · ${m.steeper <= 0 ? 'never steeper' : `${m.steeper.toFixed(2)}° steeper at most`} (the look: ${st[0].down.toFixed(0)}° down) · bones.head ${(m.joint * 1000).toFixed(2)} mm off · ${m.step.toFixed(1)}° in a frame at most · ${m.late.toFixed(2)}° left half a second on`;
      const still = await nodRun({ flip: null });
      for (const way of ['down', 'up'] as const) { const m = cmp(await nodRun({ flip: way }), still);   // (goggles down or up, the head is posed the same before the flip: one run with no flip stands for both)
        F.verdict(m.peak > 12 && m.steeper < 0.5 && m.joint < 0.001 && m.step < 7 && m.late < 0.5, `night vision flipped ${way} inside the look: the nod SHOWS (the look at the gap does not take it back out) as a lift of the head off the gap — never nearer straight down than the look itself — the head joint stays put, no frame jumps, and it is over when the nod is`, said(m, still)); }
      { const m = cmp(await nodRun({ flip: 'down', key: false }), still);
        F.verdict(BREAK || m.peak < 4, 'with the key off (STEALTHPOSE.nod) the look takes the nod back out, as it was: the goggles swing on a still head', said(m, still)); }
      // …and a nod the look comes in over (the flip as the row is taken) stays the nod it began as: seen, never through straight down, no frame jumps
      { const st0 = await nodRun({ flip: null, at: 2 }), flx = await nodRun({ flip: 'down', at: 2 }), m = cmp(flx, st0); let own = 0; for (let i = 1; i < st0.length; i++) own = Math.max(own, ang(st0[i].dir, st0[i - 1].dir));
        F.verdict(m.peak > 8 && m.down < 84 && m.joint < 0.005 && m.step < own + 6.5 && m.late < 0.5, 'flipped as the look begins, the nod is seen on the way in (neither taken out nor cancelled half way), his gaze stops short of straight down, the head joint stays within half a centimetre and no frame turns the head by more than the look and the nod do between them',
          `${said(m, st0)} · steepest ${m.down.toFixed(1)}° down · the look alone turns it ${own.toFixed(1)}° in a frame at most`); } }
  } finally { Object.assign(STEALTHPOSE, was); Math.random = rnd; }
  return F.done();
}

export async function stealthposeStanddown(): Promise<boolean> {
  const F = family('stealthpose-standdown: the pistol drawn from the crouch — the layer is out inside 0.3 s');
  const was = { ...STEALTHPOSE }, rnd = Math.random;
  try {
    const on = await run('draw', true), off = await run('draw', false); common(F, 'draw', on, off, 0.02);
    const k = 30, before = on.recs[k - 1].wA, at = on.recs.findIndex((r, i) => i >= k && r.wA <= 0.01);
    F.verdict(before > 0.9 && at >= k && at - k <= 18, 'E from the crouch idle: the layer was in, and is out within 18 frames of the key', `weight before ${f2(before)} · out ${at < 0 ? 'never' : `${at - k} frames after`}`);
    const d = dist(on.recs[on.recs.length - 1].hR, off.recs[off.recs.length - 1].hR);
    F.verdict(d < 0.005, "the gun hand ends where the build's carriage has it", `right wrist ${cm(d)} cm from the switch-off run`);
  } finally { Object.assign(STEALTHPOSE, was); Math.random = rnd; }
  return F.done();
}

export async function stealthposeHarness(): Promise<boolean> {
  const F = family('stealthpose-harness: the frozen stand holds the switch off, the page turns it on unless ?nostealthpose, the table is a registered knob table');
  const P = await import(`${ROOT}/src/host/profile.ts`), E = await import(`${ROOT}/src/host/standEnv.ts`), was = { ...STEALTHPOSE }, rnd = Math.random;
  try {
    { const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_STEALTHPOSE;
      if (frozen || word !== undefined) STEALTHPOSE.on = word !== '1';   // (the other way up: the stand-up must WRITE it)
      const before = STEALTHPOSE.on; await hushed(() => standUp()); const want = frozen || word !== undefined ? word === '1' : before;
      F.verdict(STEALTHPOSE.on === want, frozen ? 'standUp() on the frozen stand puts STEALTHPOSE.on to what TPS_STEALTHPOSE says (unset: off)' : "standUp() on the shipped stand leaves STEALTHPOSE.on to the page's boot (or to TPS_STEALTHPOSE where it is given)",
        `before ${before} · after ${STEALTHPOSE.on} · TPS_STEALTHPOSE ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'}`);
      if (!frozen && word === undefined) { const c = KN.knobsCopy(); try { STEALTHPOSE.on = false; P.shippedBoot?.(); F.verdict(STEALTHPOSE.on === true, "the shipped stand's boot (the page with no flag) puts it ON", `after shippedBoot(): ${STEALTHPOSE.on}`); } finally { KN.knobsBack(c); } } }
    { const row = P.FROZEN_HOLDS['STEALTHPOSE.on']; F.verdict(row === 'TPS_STEALTHPOSE=1' && E.STAND_ENV.includes('TPS_STEALTHPOSE'), 'FROZEN_HOLDS names STEALTHPOSE.on with the word that turns it on, and STAND_ENV carries that word', `FROZEN_HOLDS['STEALTHPOSE.on'] = ${J(row)} · in STAND_ENV ${E.STAND_ENV.includes('TPS_STEALTHPOSE')}`); }
    { const c = KN.knobsCopy(); let a: unknown, b: unknown, o: unknown;
      try { STEALTHPOSE.on = false; P.pageSwitches(new URLSearchParams('')); a = STEALTHPOSE.on; P.pageSwitches(new URLSearchParams('nostealthpose')); b = STEALTHPOSE.on; P.pageSwitches(new URLSearchParams('noclose&nohandwork')); o = STEALTHPOSE.on; } finally { KN.knobsBack(c); }
      F.verdict(a === true && b === false && o === true, "the page's boot (pageSwitches): no flag → on · ?nostealthpose → off · other flags leave it on", `'' → ${a} · 'nostealthpose' → ${b} · 'noclose&nohandwork' → ${o}`); }
    { const reg = KN.knobRegistry(), same = reg.STEALTHPOSE === STEALTHPOSE, inJ = KN.JOURNAL_KNOBS.includes('STEALTHPOSE'); const c = KN.knobsCopy(), on0 = STEALTHPOSE.on, s0 = STEALTHPOSE.swaySecs; STEALTHPOSE.on = !on0; STEALTHPOSE.swaySecs = s0 + 1; KN.knobsBack(c);
      F.verdict(same && inJ && STEALTHPOSE.on === on0 && STEALTHPOSE.swaySecs === s0, 'knobRegistry().STEALTHPOSE is the table, a recording carries it (JOURNAL_KNOBS), knobsCopy / knobsBack put it back', `registry is the table ${same} · in JOURNAL_KNOBS ${inJ} · on put back ${STEALTHPOSE.on === on0} · swaySecs put back ${STEALTHPOSE.swaySecs === s0}`); }
  } finally { Object.assign(STEALTHPOSE, was); Math.random = rnd; }
  return F.done();
}

const SUBS: Record<string, () => Promise<boolean>> = { harness: stealthposeHarness, off: stealthposeOff, idle: stealthposeIdle, walk: stealthposeWalk, rise: stealthposeRise, creep: stealthposeCreep, cable: stealthposeCable, standdown: stealthposeStanddown };
if (import.meta.main) {
  const want = process.argv.slice(2).filter(a => !a.startsWith('-')), unknown = want.filter(w => !SUBS[w]);
  if (unknown.length) { console.log(`unknown: ${unknown.join(' ')} (one or more of: ${Object.keys(SUBS).join(' ')})`); process.exit(2); }
  if (BREAK) console.log("STEALTHPOSE_BREAK=1: the switch is left OFF in the 'on' arm — the idle / walk / rise / creep / cable / standdown lines must fail");
  let ok = true; for (const k of want.length ? want : Object.keys(SUBS)) ok = await SUBS[k]() && ok;
  console.log(ok ? '\n=== stealthpose: ALL PASS ===' : '\n=== stealthpose: FAILED ==='); process.exit(ok ? 0 : 1);
}
