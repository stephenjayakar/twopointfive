// GLASS TUNING RULES, HELD (rebuild/glass/tuning.md) — one probe a rule the tuning round added on top of the three glass parts (fracture / rounds through / falling
// glass), each asserting BOTH sides: the rule on = the new behaviour, its knob at the old value = the old behaviour. Staged as tools/qa/glass-tune.ts stages its
// scenes (the same panes, shooter, aims and cadences), so a number here can be read against that instrument's rows.
//
//   bun run tools/qa/probes.ts glasstune            the seven
//   bun run tools/qa/probes.ts glasstune-<x>        blast | rake | spall | sound | budget | stack | off
//
// Every probe switches on what it needs itself (the harness stands the glass parts OFF and at chaos 0: src/host/standup.ts) and puts every table it touched back,
// on a throw too. No Math.random of its own: the stand-up's dice are seeded as the other glass probes seed them, and put back.
import { standUp, ROOT, fake } from './headless.ts';
import { TUNE_PANE, floatPartition } from './office-pane.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon, detonateStun } = await import(`${ROOT}/src/game/combat.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const PM = await import(`${ROOT}/src/render/particles.ts`);
const GM = await import(`${ROOT}/src/game/glass.ts`);
const GBM = await import(`${ROOT}/src/game/glassbreak.ts`);
const GPM = await import(`${ROOT}/src/game/glasspen.ts`);
const SM = await import(`${ROOT}/src/game/shards.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { GB_STATS, GLASSBREAK } = GBM; const { SHARDS, SHARD_STATS } = SM; const { GLASSPEN, shotThroughGlass } = GPM; const { GLASS, GLASSFX } = GM;

type Vec3 = [number, number, number];
type PaneKind = 'annealed' | 'tempered' | 'laminated';
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash01 = (n: number) => { let x = (n | 0) * 0x9E3779B1; x ^= x >>> 15; x = Math.imul(x, 0x85EBCA6B); x ^= x >>> 13; return ((x >>> 0) % 100000) / 100000; };
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function mkVerdict() { let all = true; return { verdict: ((ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }) as Verdict, all: () => all }; }

// ---------------------------------------------------------------- the tables, put back whatever happens
const TABLES: Record<string, any> = { GLASSFX, GLASS, GLASSBREAK, GLASSPEN, SHARDS };
const clone = (x: any): any => Array.isArray(x) ? x.map(clone) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, clone(v)])) : x;
/** one probe: its banner, its verdict, and every glass table + Math.random exactly as they were afterwards (a throw included: probes.ts logs it as the failure) */
async function probe(title: string, body: (verdict: Verdict) => Promise<void>): Promise<boolean> {
  console.log(`\n=== ${title} ===`);
  const snap = clone(TABLES), rnd = Math.random, V = mkVerdict(), t0 = performance.now();
  try { await body(V.verdict); }
  finally { for (const [name, vals] of Object.entries(snap)) { const T = TABLES[name]; for (const k of Object.keys(T)) if (!(k in (vals as any))) delete T[k]; for (const [k, v] of Object.entries(vals as any)) T[k] = clone(v); } Math.random = rnd; }
  console.log(`  (${title.split(':')[0]}: ${((performance.now() - t0) / 1000).toFixed(1)} s of wall)`);
  return V.all();
}
const resetStats = () => { for (const k of Object.keys(GB_STATS)) (GB_STATS as any)[k] = 0; for (const k of Object.keys(SHARD_STATS)) (SHARD_STATS as any)[k] = 0; };

// ---------------------------------------------------------------- the staging (glass-tune.ts runScene, in pieces)
interface Parts { fx?: boolean; brk?: boolean; shards?: boolean; pen?: boolean }
interface Pane { bi: number; b: any; kind: PaneKind; out: Vec3; tan: Vec3; hu: number; hv: number; sam: Vec3; yaw: number }
/** the pane glass-tune.ts shoots for a type — the conference partition's second sheet (annealed), the first full-height facade sheet (tempered), the manager's
 *  sidelight (laminated) — and the side its shooter stands on, 1.7 m out with floor under him */
function paneOf(game: any, engine: any, kind: PaneKind): Pane {
  const gb = game.glassBreak;
  // (by where it stands, office-pane.ts — never 'box 115', nor 'else the first sheet of that type': the door-size export moved every index here up one, and
  //  the laminated pick fell through to a strip of clerestory no round of this staging reaches)
  const bi = TUNE_PANE[kind], pick = { i: bi, b: game.level.boxes[bi] }, is = gb.typeOfPane(bi);
  if (is !== kind) throw new Error(`the office's ${kind} pane (box ${bi}) breaks as ${is ?? 'no sheet'}: the type rule or the level has moved`);
  const b = pick.b, wide = b.h[0] >= b.h[2] ? 0 : 2, cs = Math.cos(b.yaw ?? 0), sn = Math.sin(b.yaw ?? 0);
  const nrm: Vec3 = wide === 0 ? [sn, 0, cs] : [cs, 0, -sn], tan: Vec3 = wide === 0 ? [cs, 0, -sn] : [-sn, 0, cs];
  const p = v3.mad([b.c[0], 0, b.c[2]], nrm, 1.7) as Vec3, q = v3.mad([b.c[0], 0, b.c[2]], nrm, -1.7) as Vec3, inB = (x: Vec3) => x[0] > 4 && x[0] < 36 && x[2] > 4 && x[2] < 24;
  const side = kind === 'tempered' ? (inB(p) ? 1 : -1) : (p[2] > q[2] ? 1 : -1);
  const out = v3.scale(nrm, side) as Vec3;
  return { bi: pick.i, b, kind, out, tan, hu: wide === 0 ? b.h[0] : b.h[2], hv: b.h[1], sam: v3.mad([b.c[0], 0, b.c[2]], out, 1.7) as Vec3, yaw: Math.atan2(-out[0], -out[2]) };
}
/** glass-tune.ts's aims: 'point' one spot off the sheet's centre, 'hand' a hand's breadth round it, 'walk' the burst walked across the sheet (k of n) — each a
 *  point half a metre BEHIND the pane, chest height on a full-height sheet */
function aimAt(P: Pane, spread: 'point' | 'hand' | 'walk', k: number, n: number): Vec3 {
  const b = P.b; let u = 0.11, v = 0.17;
  if (spread === 'hand') { u = 0.11 + (hash01(k * 7 + 1) - 0.5) * 0.12; v = 0.17 + (hash01(k * 7 + 2) - 0.5) * 0.12; }
  else if (spread === 'walk') { u = (-0.7 + 1.4 * k / Math.max(1, n - 1)) * P.hu * 0.9 + (hash01(k * 7 + 1) - 0.5) * 0.1; v = (hash01(k * 7 + 2) - 0.5) * Math.min(0.8, P.hv * 1.2); }
  return [b.c[0] + P.tan[0] * u - P.out[0] * 0.5, b.c[1] + v - (b.c[1] - 1.35) * (P.kind === 'tempered' ? 1 : 0), b.c[2] + P.tan[2] * u - P.out[2] * 0.5];
}
/** where glass-tune.ts's stun scenes burst their can: 1.2 m out from the foot of the sheet's middle, 0.4 m up */
const stunSpot = (P: Pane): Vec3 => v3.mad([P.b.c[0], 0.4, P.b.c[2]], P.out, 1.2) as Vec3;

async function stage(parts: Parts = {}) {
  Math.random = seeded(4242);
  const W = await standUp(); const { game, engine } = W as any; floatPartition(game);
  engine.particles = new PM.Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  // (the stand-up has just put the three parts off and chaos at 0: what this probe needs goes on here, by name)
  GLASSFX.on = parts.fx ?? true; GLASSPEN.on = parts.pen ?? true; game.tune.glassBreak = parts.brk ?? true; game.tune.glassShards = parts.shards ?? true; game.tune.chaos = 0.5;
  game.godMode = true; game.player.visibility = 0.02; resetStats();
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.char.bodyYaw = gd.char.aimYaw = Math.PI / 2; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; gd.flashlight.enabled = false; gd.char.update(0); });
  const P = engine.particles, seen = new WeakSet<any>(), events: any[] = []; (W as any).audioLog = [];
  /** one frame, the particle queue drained as a renderer would, the new hearing events kept */
  let look: Vec3 | null = null;   // (stand(…, true): the cursor held on the pane, frame by frame)
  const step = (n = 1) => { for (let i = 0; i < n; i++) { if (look) (W as any).cursorAt(look); W.step(DT); P.pending.length = 0; P.pendingImpulses.length = 0; for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind !== 'step') events.push(e); } } };
  /** Sam on his side of the pane with the gun up. `aimed`: the cursor is put on the sheet and kept there, and he is given a second to come round to it — the
   *  page's Sam turns and brings the gun to bear with weight (the shipped stand), so a round fired 0.2 s after a teleport goes where the gun still points:
   *  into the wall beside a 0.55 m sidelight. For the lines that count the rounds a pane took. */
  const stand = (X: Pane, gun: 'rifle' | 'pistol' = 'rifle', aimed = false) => { look = null; game.puppet = null; game.teleportPlayer(X.sam); game.player.char.bodyYaw = game.player.char.aimYaw = X.yaw; game.player.slot = gun; game.player.holstered = false; game.player.crouch = false; step(2);
    if (aimed) { look = [X.b.c[0], 1.3, X.b.c[2]]; step(60); } };
  const fire = (p: Vec3, gunId = 'fn2000') => { fireWeapon(game, game.player.char, p, true, { weapon: (WEAPONS as any)[gunId] }); const fa = game.player.firearm; if (fa) { fa.chamber = 1; fa.mag = Math.max(fa.mag ?? 0, 5); fa.cool = 0; } };
  /** `n` rounds at glass-tune's cadence (the first 0.2 s in), then on to `frames` in all; `each` after every frame */
  const shoot = (X: Pane, n: number, spread: 'point' | 'hand' | 'walk', frames: number, each?: (f: number) => void, every = 0.1, gunId = 'fn2000') => {
    const t0 = game.time; let fired = 0, nextAt = 0.2;
    for (let f = 0; f < frames; f++) { const t = game.time - t0; while (fired < n && t >= nextAt) { fire(aimAt(X, spread, fired, n), gunId); fired++; nextAt += every; } step(); each?.(f); }
    return fired;
  };
  const stun = (at: Vec3) => detonateStun(game, { kind: 'flash', pos: at, vel: [0, 0, 0], age: 1, fuse: 0, fired: true, who: 0 } as any);
  const audio = (name: string) => ((W as any).audioLog as any[]).filter(a => a.name === name);
  return { W, game, engine, gb: game.glassBreak, step, stand, fire, shoot, stun, audio, events, pane: (k: PaneKind) => paneOf(game, engine, k) };
}
const infoStr = (i: any) => `open ${f3(i.openFraction)} · run ${i.run} · gone ${i.gone} · walkable ${i.walkable} · sites ${i.sites}`;

// ================================================================ glasstune-blast
/** glassbreak.ts blast(): k = power × (1 − d ∕ radius) against GLASSBREAK.blastRunK 0.2 (annealed runs) / blastDiceK 0.45 (tempered dices); a stun arrives at
 *  bangPower 0.6 */
export async function glasstuneBlast(): Promise<boolean> {
  return probe('glasstune-blast: a stun runs an annealed partition and spares the tempered facade; a full blast dices it; the old run threshold spares both', async verdict => {
    const stunRun = async (kind: PaneKind, how: 'stun' | 'full') => {
      const S = await stage(), X = S.pane(kind); S.stand(X); S.step(10);
      const at = stunSpot(X);
      if (how === 'stun') S.stun(at); else S.gb.blast(at, { power: 1, who: 0 });
      S.step(180);
      const i = S.gb.paneInfo(X.bi);
      return { i, bi: X.bi, stats: { ...GB_STATS }, str: `pane ${X.bi} (${kind}), ${how === 'stun' ? `stun at bangPower ${GLASSBREAK.bangPower}` : 'blast at power 1'} 1.2 m out · after 3 s: ${i ? infoStr(i) : 'no record (untouched)'} · GB_STATS blasts ${GB_STATS.blasts} runs ${GB_STATS.runs} diced ${GB_STATS.diced} dropped ${GB_STATS.dropped}` };
    };
    console.log(`  knobs: blastM ${GLASSBREAK.blastM} · bangPower ${GLASSBREAK.bangPower} · blastRunK ${GLASSBREAK.blastRunK} · blastDiceK ${GLASSBREAK.blastDiceK} · blastSheetK ${GLASSBREAK.blastSheetK}`);
    const a = await stunRun('annealed', 'stun');
    verdict(!!a.i && a.i.run && a.i.openFraction > 0.3, 'a stun 1.2 m off an annealed partition pane runs it (open > 0.3 after 3 s)', a.str);
    const t = await stunRun('tempered', 'stun');
    verdict((!t.i || (!t.i.gone && t.i.openFraction === 0)) && t.stats.diced === 0, 'the same stun 1.2 m off a tempered facade pane leaves it standing (not diced, open 0)', t.str);
    const full = await stunRun('tempered', 'full');
    verdict(!!full.i && full.stats.diced >= 1 && full.i.openFraction > 0.5, 'a full-power blast (power 1) at the same distance dices the tempered pane', full.str);
    GLASSBREAK.blastRunK = 0.35;
    const old = await stunRun('annealed', 'stun');
    verdict(!old.i || (!old.i.run && old.i.openFraction < 0.3), 'with blastRunK 0.35 (the old threshold) the stun no longer runs the annealed pane', `blastRunK 0.35 · ${old.str}`);
  });
}

// ================================================================ glasstune-rake
/** GlassBreak.rake (GLASSBREAK.rakeOpen 0.5, rakeM 0.5): a man WALKING at a run, mostly-open annealed pane takes what is left below head height out with him.
 *  ONE staging holds three of the four cases on the same shot-out pane, in this order: the rule off (he walks at it: nothing), the rule back on with him STOOD
 *  where that walk left him (nothing), then walking again (raked). He is stood there by that first walk because a teleport cannot: the nav cell against the
 *  partition is no floor, and the nearest a body gets to the sheet is its own radius + the wall's half thickness (0.48 m — the task's "within 0.4 m" is not a
 *  place a man can be; inside rakeM 0.5 is what the rule reads). */
export async function glasstuneRake(): Promise<boolean> {
  return probe('glasstune-rake: walking at a shot-out annealed pane rakes it and he goes through; standing by it, a pane a third open, or rakeOpen 0 do not', async verdict => {
    const shipped = GLASSBREAK.rakeOpen;
    const dist = (S: any, X: Pane) => v3.dot(v3.sub(S.game.player.char.pos, X.b.c), X.out) as number;   // (metres this side of the sheet; < 0 = beyond it)
    const toward = (S: any, X: Pane) => -(v3.dot(S.game.player.char.vel, X.out) as number);              // (his commanded speed AT the sheet)
    const walkAt = (S: any, X: Pane, frames = 300) => { S.game.puppet = { goal: v3.mad([X.b.c[0], 0, X.b.c[2]], X.out, -1.5) as Vec3, aim: null, walk: 1.55 }; let through: number | null = null, vMax = 0; const t0 = S.game.time;
      for (let f = 0; f < frames; f++) { S.step(); vMax = Math.max(vMax, toward(S, X)); if (through == null && dist(S, X) < -0.3) through = S.game.time - t0; } return { through, vMax }; };
    /** what else stands in the opening: statics that are not glass across the sheet's footprint at the height a body is collided at */
    const inTheWay = (S: any, X: Pane) => S.game.level.boxes.map((b: any, i: number) => ({ b, i })).filter(({ b, i }: any) => i !== X.bi && !(b.flags & (1 << 17)) && !(b.flags & 2) && Math.abs(b.c[0] - X.b.c[0]) < b.h[0] + 0.1 && Math.abs(b.c[2] - X.b.c[2]) < b.h[2] + 0.1 && b.c[1] + b.h[1] > 0.2 && b.c[1] - b.h[1] < 1.7)
      .map(({ b, i }: any) => `box ${i} (y ${f2(b.c[1] - b.h[1])}‥${f2(b.c[1] + b.h[1])}, ${f2(2 * Math.min(b.h[0], b.h[2]))} m thick)`);
    {
      GLASSBREAK.rakeOpen = 0;
      const S = await stage(), X = S.pane('annealed'); S.stand(X); S.shoot(X, 30, 'walk', 360);
      const before = S.gb.paneInfo(X.bi);
      verdict(!!before && before.run && before.openFraction >= shipped && !before.walkable && GB_STATS.raked === 0, 'the staging: a rifle magazine on auto leaves the pane run, past rakeOpen, and NOT walkable', `pane ${X.bi} (y ${f2(X.b.c[1] - X.hv)}‥${f2(X.b.c[1] + X.hv)}) after 30 rounds + 6 s: ${before ? infoStr(before) : 'no record'} · shipped rakeOpen ${shipped}, rakeM ${GLASSBREAK.rakeM}`);
      // (1) the rule off
      const w0 = walkAt(S, X), off = S.gb.paneInfo(X.bi);
      verdict(GB_STATS.raked === 0 && !off.walkable && dist(S, X) > 0 && w0.vMax > 0.3, 'with rakeOpen 0 nothing is raked and he does not get through', `rakeOpen 0 · walked at it 5 s (peak ${f2(w0.vMax)} m/s toward the sheet): raked ${GB_STATS.raked} · walkable ${off.walkable} · through ${w0.through == null ? 'never' : f2(w0.through) + ' s'} · ends ${f2(dist(S, X))} m this side`);
      // (2) the rule on, the man stood where he is
      S.game.puppet = null; S.step(20); const v0 = toward(S, X);
      GLASSBREAK.rakeOpen = shipped; let vStand = 0; for (let f = 0; f < 180; f++) { S.step(); vStand = Math.max(vStand, Math.abs(toward(S, X))); }
      const stood = S.gb.paneInfo(X.bi), dStand = dist(S, X);
      verdict(GB_STATS.raked === 0 && !stood.walkable && dStand > 0 && dStand <= GLASSBREAK.rakeM && vStand < 0.3, 'a man STANDING inside rakeM of the shot-out pane for 3 s (no velocity toward it) rakes nothing', `rakeOpen ${shipped} · stood ${f2(dStand)} m off the sheet (rakeM ${GLASSBREAK.rakeM}; a body gets no nearer) for 180 frames, speed toward it ${f2(v0)} at the start, peak ${f2(vStand)} · raked ${GB_STATS.raked} · walkable ${stood.walkable}`);
      // (3) the rule on, walking
      const w1 = walkAt(S, X), after = S.gb.paneInfo(X.bi); S.game.puppet = null;
      verdict(GB_STATS.raked > 0 && after.walkable, 'walking at it rakes it: pieces taken (GB_STATS.raked > 0) and the pane becomes walkable', `rakeOpen ${shipped} · walked at it 5 s (peak ${f2(w1.vMax)} m/s toward the sheet): raked ${GB_STATS.raked} · ${infoStr(after)}`);
      const blockers = inTheWay(S, X);
      // (what the office gives: every partition stands on a 0.5 m dwarf wall, so the glass's own answer — walkable — is all there is to hold; where he ends is printed)
      verdict(S.game.col.glassWalkable?.(X.bi) === true, '… and the glass itself no longer stops him (col.glassWalkable; in the office the dwarf wall under the partition still does)', `through ${w1.through == null ? 'never' : f2(w1.through) + ' s into the walk'} · ends ${f2(dist(S, X))} m ${dist(S, X) > 0 ? 'THIS side' : 'beyond'} of the sheet · col.glassWalkable(${X.bi}) ${S.game.col.glassWalkable?.(X.bi)} · other statics across the opening at body height: ${blockers.join(', ') || 'none'}`);
    }
    // --- a pane only about a third open: a 5-round burst, the rule as shipped
    {
      const S = await stage(), X = S.pane('annealed'); S.stand(X); S.shoot(X, 5, 'hand', 360);
      const before = S.gb.paneInfo(X.bi); const w = walkAt(S, X), after = S.gb.paneInfo(X.bi); S.game.puppet = null;
      verdict(!!before && before.run && before.openFraction > 0 && before.openFraction < GLASSBREAK.rakeOpen && GB_STATS.raked === 0 && !after.walkable && dist(S, X) > 0, 'a pane under rakeOpen (a 5-round burst, about a third open) is not raked by walking at it', `after the burst: ${before ? infoStr(before) : 'no record'} (rakeOpen ${GLASSBREAK.rakeOpen}) · walked at it 5 s (peak ${f2(w.vMax)} m/s): raked ${GB_STATS.raked} · ends ${f2(dist(S, X))} m this side · walkable ${after.walkable}`);
    }
  });
}

// ================================================================ glasstune-spall
/** glass.ts glassImpact → shards.spall (SHARDS.spallOut 10, spallBack 6): a round into a pane that lets nothing go still throws glass off both faces */
export async function glasstuneSpall(): Promise<boolean> {
  return probe('glasstune-spall: one round into a laminated pane births spall and the pane stays shut; spallOut / spallBack 0 births none', async verdict => {
    const one = async () => { const S = await stage(), X = S.pane('laminated'); S.stand(X); S.shoot(X, 1, 'point', 60); const i = S.gb.paneInfo(X.bi);
      return { i, born: SHARD_STATS.born, spalls: SHARD_STATS.spalls, fragments: SHARD_STATS.fragments, str: `pane ${X.bi} (laminated), one FN2000 round, 1 s · born ${SHARD_STATS.born} · spalls ${SHARD_STATS.spalls} · fragments ${SHARD_STATS.fragments} · ${i ? infoStr(i) : 'no record'}` }; };
    const on = await one();
    verdict(on.born > 0 && on.spalls >= 1 && !!on.i && on.i.openFraction === 0 && !on.i.gone, `as shipped (spallOut ${SHARDS.spallOut}, spallBack ${SHARDS.spallBack}): particles born, a spall booked, the pane shut`, on.str);
    SHARDS.spallOut = 0; SHARDS.spallBack = 0; SHARDS.exitFines = 0;   // (exitFines: with rounds passing through, a rifle round crosses a laminated sheet and `crossed` throws its own jet off the far face)
    const off = await one();
    verdict(off.born === 0 && off.spalls === 0 && !!off.i && off.i.openFraction === 0, 'spallOut, spallBack and exitFines 0: none born (the pane still shut, still starred)', `spallOut 0 · spallBack 0 · exitFines 0 · ${off.str}`);
  });
}

// ================================================================ glasstune-sound
/** SHARDS.soundGap {glassTinkle 0.07, glassShatter 0.11} (one landing sound a kind a gap), GLASS.liveGap 0.2 (one 'glass' hearing event a pane a gap),
 *  GLASS.crackGap 0.045 (no two glassCrack starts floor-wide inside it) */
export async function glasstuneSound(): Promise<boolean> {
  return probe('glasstune-sound: a diced pane is ≤ 10 shatters (≥ 25 without the gap); a magazine into laminated glass files ≤ 15 hearing events (30 without); cracks never closer than the gap', async verdict => {
    const minGap = (xs: any[]) => { let m = Infinity; for (let i = 1; i < xs.length; i++) m = Math.min(m, xs[i].t - xs[i - 1].t); return m; };
    const hitCracks = (xs: any[]) => xs.filter(a => Math.abs(a.gain - 0.5) < 1e-6 || Math.abs(a.gain - 0.9) < 1e-6);
    const crList = (xs: any[]) => xs.map(a => `t ${f3(a.t)} gain ${a.gain}${a.opts?.rate ? ' rate ' + (+a.opts.rate).toFixed(2) : ''}`).join(' · ');
    const gapStr = (m: number) => m === Infinity ? 'n/a (under two)' : `${f3(m)} s`;
    const dice = async () => { const S = await stage(), X = S.pane('tempered'); S.stand(X); S.shoot(X, 1, 'point', 300); const i = S.gb.paneInfo(X.bi), sh = S.audio('glassShatter'), cr = S.audio('glassCrack');
      return { shatters: sh.length, merged: SHARD_STATS.soundsMerged, sounds: SHARD_STATS.sounds, crackMin: minGap(cr), cracks: cr.length, cr, list: crList(cr), gone: !!i?.gone, str: `pane ${X.bi} (tempered), one FN2000 round, 5 s · ${i ? infoStr(i) : 'no record'} · glassShatter ${sh.length} · glassTinkle ${S.audio('glassTinkle').length} · SHARD_STATS sounds ${SHARD_STATS.sounds} soundsMerged ${SHARD_STATS.soundsMerged} · glassCrack ${cr.length}, closest pair ${gapStr(minGap(cr))}` }; };
    const mag = async () => { const S = await stage(), X = S.pane('laminated'); S.stand(X, 'rifle', true); const n = S.shoot(X, 30, 'hand', 300);
      // (THIS pane's events: liveGap is one 'glass' event a PANE a gap, and a rifle round goes on through a laminated sheet — from where the shipped stand holds
      //  the gun some of the thirty come down on the clerestory across the manager's office and file that pane's own events. Counted beside: bounded by the gap
      //  as this pane's are, and not part of 'every round files its own' with the gap off. The cursor is held on the sheet — stand(…, true) — which glass-tune.ts's
      //  scene of the same name does not do: on the shipped stand its first round is in the wall.)
      const all = S.events.filter((e: any) => e.kind === 'glass'), ev = all.filter((e: any) => Math.abs((e.pos[0] - X.b.c[0]) * X.out[0] + (e.pos[2] - X.b.c[2]) * X.out[2]) < 0.3 && Math.abs((e.pos[0] - X.b.c[0]) * X.tan[0] + (e.pos[2] - X.b.c[2]) * X.tan[2]) < X.hu + 0.3);
      const cr = S.audio('glassCrack'), i = S.gb.paneInfo(X.bi);
      return { fired: n, glass: ev.length, beyond: all.length - ev.length, crackMin: minGap(cr), cracks: cr.length, cr, str: `pane ${X.bi} (laminated), ${n} FN2000 rounds on auto into a hand's breadth, 5 s · 'glass' hearing events ${ev.length}${all.length > ev.length ? ` (and ${all.length - ev.length} on panes beyond it)` : ''} · glassCrack starts ${cr.length}, closest pair ${gapStr(minGap(cr))} · ${i ? infoStr(i) : 'no record'}` }; };
    console.log(`  knobs: SHARDS.soundGap ${JSON.stringify(SHARDS.soundGap)} · soundsPerFrame ${SHARDS.soundsPerFrame} · GLASS.liveGap ${GLASS.liveGap} · GLASS.crackGap ${GLASS.crackGap}`);
    const d1 = await dice();
    verdict(d1.gone && d1.shatters >= 1 && d1.shatters <= 10, 'a tempered pane diced by one rifle round: ≤ 10 glassShatter starts', d1.str);
    verdict(d1.merged > 0, '… and landings were merged into them (soundsMerged > 0)', `soundsMerged ${d1.merged} of ${d1.sounds + d1.merged} asked`);
    const m1 = await mag();
    verdict(m1.fired === 30 && m1.glass >= 1 && m1.glass <= 15 && m1.beyond <= 15, "a tight 30-round magazine into a laminated pane files ≤ 15 'glass' hearing events (and no more on the panes its rounds go on to)", m1.str);
    const worst = Math.min(d1.crackMin, m1.crackMin);
    // as described: EVERY 'glassCrack' start. (glass.ts gates only the HIT crack — gain 0.5 / 0.9; glassbreak.ts's falling-glass sound and debris.ts's shard landings play the same sample ungated.)
    console.log(`    (informational, every site that plays the sample: closest two starts ${gapStr(worst)}) dice run: ${d1.cracks} starts, closest ${gapStr(d1.crackMin)} [${d1.list}] · magazine run: ${m1.cracks} starts, closest ${gapStr(m1.crackMin)}`);
    // the rule as glass.ts states it — HIT cracks — held both ways: two rounds on ONE frame into a pane that stays shut
    const pair = async () => { const S = await stage(), X = S.pane('laminated'); S.stand(X); const t0 = S.game.time; S.fire(aimAt(X, 'hand', 0, 30)); S.fire(aimAt(X, 'hand', 7, 30)); S.step(30);
      const h = hitCracks(S.audio('glassCrack')).filter((a: any) => a.t >= t0 - 1e-6); return { hits: h.length, min: minGap(h) }; };
    const p1 = await pair();
    const hd = hitCracks(d1.cr), hm = hitCracks(m1.cr), hworst = Math.min(minGap(hd), minGap(hm));
    verdict(p1.hits === 1 && hm.length >= 2 && hworst >= 0.04, 'with crackGap on, no two HIT cracks start closer than 0.04 s: two rounds on one frame sound once', `two rounds, one frame: ${p1.hits} hit crack(s) · dice run ${hd.length} hit crack(s) · magazine run ${hm.length}, closest ${gapStr(minGap(hm))}`);
    { const keepGap = GLASS.crackGap; GLASS.crackGap = 0; const p0 = await pair(); GLASS.crackGap = keepGap;
      verdict(p0.hits === 2 && p0.min < 0.04, 'crackGap 0: the two rounds on one frame are two hit cracks', `crackGap 0 · ${p0.hits} hit cracks, closest ${gapStr(p0.min)}`); }
    const keep = clone(SHARDS.soundGap); SHARDS.soundGap = {} as any;
    const d0 = await dice(); SHARDS.soundGap = keep;
    verdict(d0.gone && d0.shatters >= 25 && d0.merged === 0, 'soundGap zeroed ({} = every landing its own sound): ≥ 25 glassShatter starts, nothing merged', `soundGap {} · ${d0.str}`);
    GLASS.liveGap = 0;
    const m0 = await mag();
    verdict(m0.glass === 30, "liveGap 0: every one of the 30 rounds files its own 'glass' event", `liveGap 0 · ${m0.str}`);
  });
}

// ================================================================ glasstune-budget
/** shards.ts budget() / send(): SHARDS.liveCap 4000, capFloor 3 (a fragment past the cap still gets a few pieces while live < cap × overCap 1.25),
 *  pressLife 0.3 */
export async function glasstuneBudget(): Promise<boolean> {
  return probe('glasstune-budget: one diced facade pane is barely trimmed under the shipped cap; at a cap of 300 later fragments still get pieces up to cap × overCap; capFloor 0 holds the cap itself', async verdict => {
    const dice = async () => { const S = await stage(), X = S.pane('tempered'); S.stand(X); const cap = SHARDS.liveCap; let bornAtCap: number | null = null, atF = -1;
      S.shoot(X, 1, 'point', 300, f => { if (bornAtCap == null && S.game.shards.live >= cap) { bornAtCap = SHARD_STATS.born; atF = f; } });
      const i = S.gb.paneInfo(X.bi);
      return { born: SHARD_STATS.born, trimmed: SHARD_STATS.trimmed, peak: SHARD_STATS.peakLive, fragments: SHARD_STATS.fragments, bornAtCap: bornAtCap as number | null, atF, gone: !!i?.gone,
        str: `pane ${X.bi} (tempered) diced by one round, 5 s · fragments ${SHARD_STATS.fragments} · born ${SHARD_STATS.born} · trimmed ${SHARD_STATS.trimmed} · peakLive ${SHARD_STATS.peakLive} · recsDeferred ${SHARD_STATS.recsDeferred} · estimate first at the cap: ${bornAtCap == null ? 'never' : `frame ${atF}, born ${bornAtCap} by then`}` }; };
    const a = await dice();
    verdict(a.gone && a.born > 0 && a.trimmed < 300 && a.peak <= SHARDS.liveCap * SHARDS.overCap, `as shipped (liveCap ${SHARDS.liveCap}, capFloor ${SHARDS.capFloor}, overCap ${SHARDS.overCap}): one diced pane trims < 300 and peaks ≤ cap × overCap`, a.str);
    SHARDS.liveCap = 300;
    const b = await dice();
    verdict(b.bornAtCap != null && b.born > b.bornAtCap && b.peak <= 300 * SHARDS.overCap + SHARDS.capFloor * 4 && b.peak > 300, 'liveCap 300: fragments after the estimate reaches the cap still get pieces (born keeps rising), peakLive ≤ 300 × 1.25 + a few', `liveCap 300 · capFloor ${SHARDS.capFloor} · ${b.str} · bound ${300 * SHARDS.overCap} + ${SHARDS.capFloor * 4}`);
    SHARDS.capFloor = 0;
    const c = await dice();
    verdict(c.gone && c.born > 0 && c.peak <= 300, 'liveCap 300 and capFloor 0: peakLive ≤ 300 (the cap is the cap, as it was)', `liveCap 300 · capFloor 0 · ${c.str}`);
  });
}

// ================================================================ glasstune-stack
/** GLASS IS NOT COVER — orders.ts stackPosts / behindGlass + glasspen.ts shotThroughGlass (GLASSPEN.stackEyes 3, stackEnergy 1.0). Staged on the plain office
 *  with no scenario: every door face's BASE deal (the private stackPostsOn(…, glass = false), two men) is computed, and the faces where a base post has a rifle
 *  line through a pane from the floor beyond the door are FOUND by asking — not named here. Then the public stackPosts is asked on those faces. */
export async function glasstuneStack(): Promise<boolean> {
  return probe('glasstune-stack: on a door whose jamb a rifle reaches through a pane the stack is dealt off it; with stackEyes 0 (or rounds stopping in glass) the deal is the base one', async verdict => {
    const S = await stage({ brk: false, shards: false, pen: true }), g = S.game, O = g.orders as any, men = g.guards.slice(0, 2);
    const same = (a: any[] | null, b: any[] | null) => JSON.stringify((a ?? []).map(p => p.pos.map((x: number) => +x.toFixed(3)))) === JSON.stringify((b ?? []).map(p => p.pos.map((x: number) => +x.toFixed(3))));
    const ps = (posts: any[] | null) => posts ? posts.map(p => `(${f2(p.pos[0])}, ${f2(p.pos[2])})`).join(' ') : 'null';
    /** the lattice behindGlass asks from (orders.ts): the floor beyond the door, chest height */
    const eyesOf = (d: any, side: number): Vec3[] => { const th = d.def.closedDir, u = [Math.cos(th), Math.sin(th)], n = [-u[1] * side, u[0] * side], c = d.frameCentre, eyes: Vec3[] = [];
      for (let b = 0.75; b <= 7.5; b += 0.75) for (let l = -6; l <= 6; l += 0.75) { const q: Vec3 = [c[0] - n[0] * b + u[0] * l, 1.3, c[2] - n[1] * b + u[1] * l]; if (!g.col.nav.isBlocked(q[0], q[2])) eyes.push(q); } return eyes; };
    const faces: { d: any; name: string; side: 1 | -1; base: any[]; flagged: any[] }[] = []; let asked = 0;
    for (const d of g.doors.list) for (const side of [1, -1] as const) {
      const base = O.stackPostsOn(d, side, men, [], false) as any[] | null; if (!base) continue; asked++;
      faces.push({ d, name: d.def.name ?? `door ${g.doors.list.indexOf(d)}`, side, base, flagged: base.filter(p => O.behindGlass(d, side, p.pos)) });
    }
    const hot = faces.filter(f => f.flagged.length > 0), cold = faces.filter(f => f.flagged.length === 0);
    verdict(hot.length >= 1, 'the office has at least one door face whose base stack post sits in a rifle line through glass', `${asked} door faces with a base deal for two men · behind glass on ${hot.length}: ${hot.map(f => `${f.name}/${f.side > 0 ? '+' : '−'} ${ps(f.flagged)}`).join(' · ') || 'none'}`);
    // the flag is the pure function's count, asked again here with the same lattice
    let countOk = hot.length > 0; const counts: string[] = [];
    for (const f of hot) for (const p of f.flagged) { const eyes = eyesOf(f.d, f.side), n = shotThroughGlass(g, eyes, [p.pos[0], 1.3, p.pos[2]]) as number; counts.push(`${f.name}/${f.side > 0 ? '+' : '−'} (${f2(p.pos[0])}, ${f2(p.pos[2])}): ${n} of ${eyes.length} eyes`); if (n < GLASSPEN.stackEyes) countOk = false; }
    verdict(countOk, `a flagged post = shotThroughGlass ≥ stackEyes (${GLASSPEN.stackEyes}) defender-side rifle lines (stackEnergy ${GLASSPEN.stackEnergy}) through a pane`, counts.join(' · ') || 'nothing flagged');
    // rule on: no dealt post is behind glass (a face with glass at both hands and no other room falls back to the walls' own marks — named if it happens)
    let onOk = hot.length > 0, moved = 0, fbOk = true; const onRows: string[] = [], fbRows: string[] = [];
    for (const f of hot) { const dealt = g.orders.stackPosts(f.d, f.side, men) as any[] | null, bad = (dealt ?? []).filter(p => O.behindGlass(f.d, f.side, p.pos)), asBase = same(dealt, f.base);
      const room = O.stackPostsOn(f.d, f.side, men, [], true) as any[] | null, tag = `${f.name}/${f.side > 0 ? '+' : '−'}`;
      if (!room) { if (!asBase) fbOk = false; fbRows.push(`${tag}: no deal clear of glass → ${asBase ? 'the base posts' : 'NOT the base posts: ' + ps(dealt)} ${ps(f.base)}, ${bad.length} still behind glass`); continue; }
      if (!dealt || bad.length) onOk = false; if (!asBase) moved++;
      onRows.push(`${tag}: base ${ps(f.base)} → dealt ${ps(dealt)}${bad.length ? ` · STILL behind glass: ${ps(bad)}` : ''}`); }
    verdict(onOk && moved >= 1, 'glass on: stackPosts deals no post that behindGlass flags (faces with other room at the door)', onRows.join(' · ') || 'no face to ask');
    verdict(fbOk, "… and a face with glass at both hands and no other room falls back to the walls' own marks (orders.ts's stated fallback — those men DO wait behind glass)", fbRows.join(' · ') || 'no such face');
    const coldSame = cold.filter(f => same(g.orders.stackPosts(f.d, f.side, men), f.base)).length;
    verdict(cold.length > 0 && coldSame === cold.length, '… and a face with no glass line is dealt exactly its base posts', `${coldSame} of ${cold.length} faces identical to the base deal`);
    // rule off, both ways
    // what is remembered per place is asked afresh once a pane's toll has moved (a round through, a piece out, a restart) — never kept from glass that no longer stands so
    { const f = hot[0], p = f.flagged[0]; O.behindGlass(f.d, f.side, p.pos); const kept = O.glassAt.size, key = [...O.glassAt.keys()][0], truth = O.glassAt.get(key);
      const plant = () => { O.glassAt.set(key, !truth); return O.glassAt.get(key) !== truth; };
      // (a) a rifle round through a pane
      const bi = GM.glassPanes(g)[0], b = g.level.boxes[bi], n: Vec3 = b.h[0] < b.h[2] ? [1, 0, 0] : [0, 0, 1], from = v3.mad(b.c, n, 1.2) as Vec3, rd = v3.scale(n, -1) as Vec3;
      plant(); const sig0 = GPM.glassTollSig(g); const P = GPM.roundPath(g, from, rd, 30, 1.0); if (P) GPM.commitCrossings(g, P.cross, P.len, 0); const sig1 = GPM.glassTollSig(g);
      O.behindGlass(f.d, f.side, p.pos); const afterHole = O.glassAt.get(key);
      // (b) the restart that makes every pane whole again
      plant(); g.resetLevelState(); const sig2 = GPM.glassTollSig(g); O.behindGlass(f.d, f.side, p.pos); const afterReset = O.glassAt.get(key);
      verdict(kept >= 1 && !!P && P.cross.length >= 1 && sig1 !== sig0 && sig2 !== sig1 && afterHole !== !truth && afterReset !== !truth && O.behindGlass(f.d, f.side, p.pos) === true,
        'the places remembered as behind glass are asked afresh when the glass changes: a wrong answer planted in the memory outlives neither a round through a pane nor a restart', `remembered ${kept} · toll signature ${sig0} → ${sig1} (a round through pane ${bi}) → ${sig2} (restart) · the planted entry after each: ${afterHole === undefined ? 'gone' : afterHole}, ${afterReset === undefined ? 'gone' : afterReset} (the truth: ${truth})`); }
    const eyes0 = GLASSPEN.stackEyes; GLASSPEN.stackEyes = 0;
    const offEyes = faces.filter(f => same(g.orders.stackPosts(f.d, f.side, men), f.base)).length, flagEyes = hot.filter(f => f.flagged.some(p => O.behindGlass(f.d, f.side, p.pos))).length;
    GLASSPEN.stackEyes = eyes0;
    verdict(offEyes === faces.length && flagEyes === 0, 'stackEyes 0: every face is dealt its base posts and nothing is flagged', `${offEyes} of ${faces.length} faces identical · faces still flagged ${flagEyes}`);
    GLASSPEN.on = false;
    const offPen = faces.filter(f => same(g.orders.stackPosts(f.d, f.side, men), f.base)).length, flagPen = hot.filter(f => f.flagged.some(p => O.behindGlass(f.d, f.side, p.pos))).length;
    GLASSPEN.on = true;
    verdict(offPen === faces.length && flagPen === 0, 'rounds stopping in glass (GLASSPEN.on false): the same — the stack it always was', `${offPen} of ${faces.length} faces identical · faces still flagged ${flagPen}`);
  });
}

// ================================================================ glasstune-off
/** GLASSFX.on, the one switch over the three parts: off = each part's own switch off, digest for digest */
export async function glasstuneOff(): Promise<boolean> {
  return probe('glasstune-off: GLASSFX.on false digests as the three parts switched off one by one; on, the digest differs', async verdict => {
    const script = async (parts: Parts) => {
      const S = await stage(parts); let frames = 0; const step = (n: number) => { S.step(n); frames += n; };
      for (const kind of ['annealed', 'tempered', 'laminated'] as PaneKind[]) { const X = S.pane(kind); S.stand(X); frames += 2; for (let k = 0; k < 3; k++) { S.fire(aimAt(X, 'hand', k, 3)); step(6); } step(40); }
      const A = S.pane('annealed'); S.stand(A); frames += 2; S.stun(stunSpot(A));
      step(360 - frames);
      const gl = S.events.filter((e: any) => e.kind === 'glass').length;
      return { digest: JSON.stringify(digestGame(S.game, true)), note: `${frames} frames · 9 rounds (3 a pane type) + a stun · 'glass' events ${gl} · GB impacts ${GB_STATS.impacts} diced ${GB_STATS.diced} runs ${GB_STATS.runs} · shards born ${SHARD_STATS.born} · pen crossed ${GPM.GLASSPEN_STATS.crossed}` };
    };
    const c0 = GPM.GLASSPEN_STATS.crossed; void c0;
    const fxOff = await script({ fx: false, brk: true, shards: true, pen: true });
    const partsOff = await script({ fx: true, brk: false, shards: false, pen: false });
    const allOn = await script({ fx: true, brk: true, shards: true, pen: true });
    const firstDiff = (a: string, b: string) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i >= a.length && i >= b.length ? 'identical' : `first difference at char ${i}: …${a.slice(Math.max(0, i - 40), i + 40)}… ≠ …${b.slice(Math.max(0, i - 40), i + 40)}…`; };
    verdict(fxOff.digest === partsOff.digest, 'GLASSFX.on false (every part\'s own switch ON) ≡ GLASSFX.on true with glassBreak, glassShards and GLASSPEN.on off', `digest ${fxOff.digest.length} chars vs ${partsOff.digest.length} · ${firstDiff(fxOff.digest, partsOff.digest)}\n    fx off: ${fxOff.note}\n    parts off: ${partsOff.note}`);
    verdict(allOn.digest !== fxOff.digest, 'with it on (and the parts on) the same script digests differently', `${firstDiff(allOn.digest, fxOff.digest).slice(0, 220)}\n    all on: ${allOn.note}`);
  });
}
