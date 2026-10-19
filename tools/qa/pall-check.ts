// A BLAST'S PALL (src/game/destruction.ts CHAOS.pall — the maintainer, 10-14: "i'd also expect much more dust/smoke from a wall charge" / "same goes for 40mm" / "and
// frag"). Headless: the smoke solver is a null object here, so this check reads what the game ASKS of it — every emitter handed to g.smoke.emit, by its
// radius, density and seconds (its `mass` = π^1.5 · radius³ · density · ttl, the solver's own gaussian) — and nothing of how it then looks or what a sight
// line reads through it: that is tools/qa/pall-page.cjs, on the real page.
//   bun run tools/qa/pall-check.ts            the stand; a wall charge, a hand grenade and a 40 mm on the block's floor with the rule on and off (the
//                                             dust asked of the solver, where it stands, how much more it is); off = the same emitters as ever, on adds
//                                             and changes none of them; the far side only through a hole, and by a wall that stands no emitter in it or
//                                             beyond it (a grenade against one, a 40 mm fired at one); the allowance, the charge it never refuses, the
//                                             lane's reset; a tight spot heaps nothing; the particle layer follows the solver's part; a starved solver; nothing at chaos 0, with the one switch off or
//                                             under a show's own chaos; the panel's reset; the game digests the same either way; the journal's and
//                                             the page's switches
//   TPS_PROFILE=shipped …                     the same on the stand the page opens on
//   PALL_BREAK=1 …                            the rule never switched on and the same lines asked: must fail
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { CHAOS, PALL_STATS, resetChaosKnobs } = await import(`${ROOT}/src/game/destruction.ts`);
const { WALLCHARGE, WALLSHOT, wallAt, wallPt } = await import(`${ROOT}/src/game/wallcharge.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { blast: fragBlast, FRAG } = await import(`${ROOT}/src/game/frag.ts`);
const { fireShell, HE40, HE40_STATS } = await import(`${ROOT}/src/game/he40.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const PROFILE = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
type Vec3 = [number, number, number];
const PLAYER_ID = 1, f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
const massOf = (e: any) => Math.pow(Math.PI, 1.5) * e.radius ** 3 * e.density * e.ttl;
const zero = () => { for (const k of Object.keys(PALL_STATS)) (PALL_STATS as any)[k] = 0; };

/** the block's floor with its room clear running, every emitter the game hands the solver kept in `emits`, the rule as asked */
export async function floor(rule: boolean, opts: { chaos?: number; sw?: boolean } = {}) {
  DESTRUCTION.on = opts.sw ?? true; const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'block.json'), 'utf8')));
  const W: any = await standUp({ level: lvl }); const g = W.game; DESTRUCTION.on = opts.sw ?? true; WALLCHARGE.on = true; g.tune.chaos = opts.chaos ?? 0.5; g.godMode = true;
  if (lvl.scenarios?.roomClear) await startFromQuery(g, new URLSearchParams('roomclear&squad4'));
  g.aiEnabled = false;   // (after the deal: the room clear refuses a floor nobody would move on)
  const step = (n: number) => { for (let i = 0; i < n; i++) W.step(1 / 60); }; step(30);
  const emits: any[] = []; let inPall = false; const pe = g.destr.pallEmit.bind(g.destr); g.destr.pallEmit = (...a: any[]) => { inPall = true; try { return pe(...a); } finally { inPall = false; } };
  g.smoke.emit = (e: any) => { emits.push({ ...e, pos: [...e.pos], t: g.time, pall: inPall }); };   // (`pall`: asked by the pall's own one emitter call)
  CHAOS.pall.on = rule; CHAOS.pall.solver = true; zero();
  WALLSHOT.on = false;   // (this check holds the pall's OWN table: the share of it a wall charge asks for on the shipped stand is WALLSHOT's, held by its own check `wallshot`)
  return { g, step, emits };
}
export type Floor = Awaited<ReturnType<typeof floor>>;
/** the pall's emitters among what was asked, and the rest */
const split = (emits: any[]) => ({ pall: emits.filter(e => e.pall), rest: emits.filter(e => !e.pall) });
const dustOf = (emits: any[]) => emits.filter(e => e.kind === 'puff');
const sum = (xs: any[]) => xs.reduce((a, e) => a + massOf(e), 0);
const plain = (emits: any[]) => JSON.stringify(emits.map(e => [e.kind, e.radius, e.density, e.ttl, e.speed, e.pos.map((v: number) => +v.toFixed(4))]));
/** the most emitters of a list within 0.15 m of one of them on the plan, itself counted (a burst's column stands over its ring by design: two is no heap) */
const heapOf = (P: any[]) => Math.max(0, ...P.map(e => P.filter(o => Math.hypot(o.pos[0] - e.pos[0], o.pos[2] - e.pos[2]) < 0.15).length));
export const thickOf = (w: any) => 2 * (w.alongX ? w.box.h[2] : w.box.h[0]);
/** how far off the wall's face (the charge's side positive) an emitter stands */
export const offOf = (w: any) => { const face = wallPt(w, 0, 0, 0), nrm = wallPt(w, 0, 1, 0); return (e: any) => (e.pos[0] - face[0]) * (nrm[0] - face[0]) + (e.pos[2] - face[2]) * (nrm[2] - face[2]); };

/** a wall of this floor the game offers a charge on, that a charge then holes: the first by the walls' own order */
export function wallSpot(g: any): any {
  const C = g.wallCharge, H = WALLCHARGE.height;
  for (const B of g.destr.walls.all()) { if (B.kind !== 'wall') continue; const b = B.box, ax = b.h[0] >= b.h[2], T = ax ? b.h[2] : b.h[0];
    for (const side of [1, -1]) { const p: Vec3 = ax ? [b.c[0], H, b.c[2] + side * (T + 0.06)] : [b.c[0] + side * (T + 0.06), H, b.c[2]], from: Vec3 = ax ? [p[0], 0, p[2] + side] : [p[0] + side, 0, p[2]];
      const w0 = wallAt(g, [p[0], 0, p[2]], from), w = w0 && w0.ok && !w0.outer && w0.index === B.id ? C.settle(w0) : null;
      if (w && w.ok && C.setSpot(w) && !C.openAt(w) && C.farFloor(w) && g.destr.walls.wouldOpen(wallPt(w, 0, 0.06, H), {}).some((o: any) => o.id === w.index && o.hole)) return w; } }
  return null;
}
/** the charge set on the spot and blown, two seconds on: what was asked of the solver, which side of the wall each pall emitter stands on (`held`: the
 *  charge told its wall held — holeAt answering null for the one call — so what blow() hands the pall is seen) */
export function charge(S: Floor, held = false) {
  const g = S.g, C = g.wallCharge, w = wallSpot(g); if (!w) return null; const n0 = S.emits.length, holeAt = C.holeAt;
  C.set.push({ wall: w, t: g.time, by: 'probe', paid: 0 }); if (held) C.holeAt = () => null; let r: any; try { r = C.blow(C.set[C.set.length - 1]); } finally { if (held) C.holeAt = holeAt; } S.step(120);
  const got = S.emits.slice(n0), { pall, rest } = split(got), off = offOf(w), T = thickOf(w);
  return { hole: !!r?.hole, wall: w.index, pall, rest, near: pall.filter(e => off(e) > 0).length, far: pall.filter(e => off(e) < -T).length, inWall: pall.filter(e => off(e) <= 0 && off(e) >= -T).length, dust: dustOf(rest) };
}
/** an open place on the floor to burst a thing at: half a metre off Sam */
export const openAt = (g: any): Vec3 => { const p = g.player.char.pos; return [p[0] + 0.5, 0, p[2] + 0.5]; };
export function burst(S: Floor, kind: 'frag' | '40 mm', where?: Vec3) {
  const g = S.g, n0 = S.emits.length, at = where ?? openAt(g);
  if (kind === 'frag') fragBlast(g, at, { who: PLAYER_ID, name: 'frag grenade', destr: { radius: FRAG.destrM, power: 1 } });
  else fragBlast(g, [at[0], at[1] - FRAG.lift, at[2]], { who: PLAYER_ID, name: '40 mm grenade' });   // (he40.ts's own call, word for word: the round's burst is the frag's blast with its own radii)
  S.step(120); const got = S.emits.slice(n0), { pall, rest } = split(got);
  return { pall, rest, dust: dustOf(rest), at };
}

export async function pallCheck(): Promise<boolean> {
  const BREAK = process.env.PALL_BREAK === '1', RULE = !BREAK;
  console.log(`\n=== pall: a wall charge, a hand grenade and a 40 mm raise a pall of dust and smoke${BREAK ? ' — PALL_BREAK: the rule never on' : ''} ===`);
  let all = true; const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const knobs0 = knobsCopy(), destr0 = DESTRUCTION.on, rnd0 = Math.random;
  const log = console.log, quiet = async <T>(fn: () => Promise<T>): Promise<T> => { console.log = () => { }; try { return await fn(); } finally { console.log = log; } };
  try {
    // the stand, read off the first stand-up before the check sets anything
    { DESTRUCTION.on = true; await quiet(() => standUp({})); const stood = CHAOS.pall.on;
      const word = process.env.TPS_PALL, shipped = process.env.TPS_PROFILE === 'shipped', want = word !== undefined ? word === '1' : shipped, row = FROZEN_HOLDS['CHAOS.pall.on'];
      verdict(stood === want && typeof row === 'string' && /TPS_PALL=1/.test(row), `the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen digest was recorded'}; FROZEN_HOLDS carries the row and its word`, `after the stand-up: ${stood} · TPS_PALL ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · FROZEN_HOLDS['CHAOS.pall.on'] = ${row ?? 'MISSING'}`); }
    const K = CHAOS.pall;
    // A WALL CHARGE, the rule on and off on a fresh floor each
    { const A = await quiet(async () => charge(await floor(RULE))), st = { ...PALL_STATS }, O = await quiet(async () => charge(await floor(false)));
      const mA = A ? sum(A.pall) : 0, mO = O ? sum(O.dust) : 0, long = A ? Math.min(...A.pall.map(e => e.ttl), 99) : 0;
      verdict(!!A && !!O && A.hole && O.hole && A.near === K.wall.near && A.far === K.wall.far && A.inWall === 0 && long >= 1 && mA >= 2 * mO && mO > 0 && st.palls === 1 && O.pall.length === 0,
        'a wall charge that opens its wall: with the rule the pall stands on both sides of it, seconds long, twice the dust the charge raised before or more; without it none of that is asked',
        `with: hole ${A?.hole}, ${A?.pall.length ?? 0} emitters (${A?.near} on the charge's side, ${A?.far} through the hole), the shortest ${f2(long)} s, mass ${f2(mA)} · without: ${O?.pall.length ?? 0}, the charge's ${O?.dust.length ?? 0} puffs in two seconds mass ${f2(mO)} · ${mO > 0 ? f1(mA / mO) : '∞'}× · counters ${JSON.stringify(st)}`);
      verdict(!!A && !!O && plain(A.rest) === plain(O.rest), 'and everything else the charge asks of the solver is the same emitter for emitter: the rule adds, it changes nothing', `${A?.rest.length ?? 0} other emitters with the rule, ${O?.rest.length ?? 0} without, equal ${!!A && !!O && plain(A.rest) === plain(O.rest)}`); }
    // …the far side only through a hole: blow() told its wall held hands the pall no far side; and on a wall that IS whole (the entry point asked directly)
    // every emitter stands in the charge's room, clear of the wall — the solver lays an emitter down through whatever is thin enough
    { const H = await quiet(async () => charge(await floor(RULE), true));
      const S = await quiet(() => floor(RULE)), g = S.g, w = wallSpot(g); let near = 0, bad = 0, close = 9;
      if (w) { g.destr.pallWall(wallPt(w, 0, 0, 0), w.alongX ? [0, 0, w.side] : [w.side, 0, 0], w.alongX ? [1, 0, 0] : [0, 0, 1], thickOf(w), false); const P = split(S.emits).pall, off = offOf(w);
        near = P.filter(e => off(e) > 0).length; bad = P.filter(e => off(e) <= 0).length; close = Math.min(9, ...P.map(e => off(e) / e.radius)); }
      verdict(!!H && H.near === K.wall.near && H.far === 0 && !!w && near === K.wall.near && bad === 0 && close >= 1.5, 'a charge whose wall held: the pall on its own side alone; on a whole wall every emitter stands in the charge\'s room, a radius and a half or more off the face',
        `blow() told the wall held: ${H?.near} on the charge's side, ${H?.far} beyond · a whole wall: ${near} on the charge's side, ${bad} in or beyond it, the closest ${f2(close)} radii off the face`); }
    // A BURST HARD BY A WALL THAT STANDS (one no blast here opens: not on the walls' own list): a hand grenade lying against it, and a 40 mm fired at it down
    // its own path (he40.ts: the round flies, arms, bursts off the face — its arming run shortened to the lane this floor has)
    { const hardWall = (g: any): any => { const soft = new Set(g.destr.walls.all().map((B: any) => B.id));
        for (let j = 0; j < g.col.boxes.length; j++) { const b = g.col.boxes[j]; if (soft.has(j) || (b.flags & 1) || b.h[1] < 1.2 || Math.min(b.h[0], b.h[2]) > 0.2 || Math.max(b.h[0], b.h[2]) < 1) continue; const ax = b.h[0] >= b.h[2];
          for (const side of [1, -1] as const) { const w = { index: j, box: b, alongX: ax, u: ax ? b.c[0] : b.c[2], side };
            if (!g.col.solidBlocked(wallPt(w, 0, 3.5, 1.3), wallPt(w, 0, 0.05, 1.3)) && !g.col.solidBlocked(wallPt(w, 0, 3.5, 0.3), wallPt(w, 0, 0.05, 0.3)) && g.col.solidBlocked(wallPt(w, 0, 0.3, 1.3), wallPt(w, 0, -thickOf(w) - 0.3, 1.3))) return w; } }
        return null; };
      const stands = (g: any, w: any) => g.col.solidBlocked(wallPt(w, 0, 0.3, 1.3), wallPt(w, 0, -thickOf(w) - 0.3, 1.3));
      const S = await quiet(() => floor(RULE)), g = S.g, w = hardWall(g), n1 = S.emits.length;
      if (w) await quiet(async () => { burst(S, 'frag', wallPt(w, 0, 0.06, 0.1)); });
      const P1 = split(S.emits.slice(n1)).pall, off = w ? offOf(w) : () => 0, bad1 = P1.filter(e => off(e) <= 0).length, close1 = Math.min(9, ...P1.map(e => off(e) / e.radius)), up1 = !!w && stands(g, w), heap1 = heapOf(P1), shut1 = PALL_STATS.shut;
      const S2 = await quiet(() => floor(RULE)), g2 = S2.g, w2 = hardWall(g2), arm0 = HE40.armM, b0 = HE40_STATS.bursts, n2 = S2.emits.length; let P2: any[] = [], bad2 = -1, close2 = 0;
      if (w2) { HE40.armM = 2; try { await quiet(async () => { fireShell(g2, g2.player.char, wallPt(w2, 0, 3.5, 1.3), wallPt(w2, 0, 0, 1.3)); S2.step(90); }); } finally { HE40.armM = arm0; }
        P2 = split(S2.emits.slice(n2)).pall; const o2 = offOf(w2); bad2 = P2.filter(e => o2(e) <= 0).length; close2 = Math.min(9, ...P2.map(e => o2(e) / e.radius)); }
      const up2 = !!w2 && stands(g2, w2);
      verdict(!!w && up1 && P1.length >= 4 && bad1 === 0 && close1 >= 1.5 && heap1 <= 2 && up2 && HE40_STATS.bursts === b0 + 1 && P2.length >= 4 && bad2 === 0 && close2 >= 1.5,
        'a burst hard by a wall that stands — a hand grenade lying against it, a 40 mm fired at it — lays its pall in the room it burst in: no emitter in the wall or beyond it, each a radius and a half or more off the face, no heap of them on one spot (the ring\'s half that fell in the wall is turned back into the room, not laid on the burst)',
        `${w ? `wall #${w.index}, still standing ${up1}` : 'NO such wall on this floor'} · the grenade: ${P1.length} emitters, ${bad1} in or beyond the wall, the closest ${f2(close1)} radii off it, at most ${heap1} within 0.15 m of one another, ${shut1} left out, radii ${f2(Math.min(9, ...P1.map(e => e.radius)))}‥${f2(Math.max(0, ...P1.map(e => e.radius)))} · the 40 mm: fired 3.5 m at it, ${HE40_STATS.bursts - b0} burst, ${P2.length} emitters, ${bad2} in or beyond the wall, the closest ${f2(close2)} radii off it, still standing ${up2}`); }
    // A HAND GRENADE and A 40 MM, the same way
    for (const kind of ['frag', '40 mm'] as const) {
      const A = await quiet(async () => burst(await floor(RULE), kind)), st = { ...PALL_STATS }, O = await quiet(async () => burst(await floor(false), kind));
      const mA = sum(A.pall), mO = sum(O.dust), reach = Math.max(0, ...A.pall.map(e => Math.hypot(e.pos[0] - A.at[0], e.pos[2] - A.at[2]))), dark = A.pall.filter(e => e.tint && e.tint[0] < 0.5).length;
      verdict(A.pall.length >= 4 && dark >= 1 && Math.min(...A.pall.map(e => e.ttl), 99) >= 0.9 && mA >= 2 * mO && reach <= 1.6 && st.palls === 1 && O.pall.length === 0 && plain(A.rest) === plain(O.rest),
        `a ${kind === 'frag' ? 'hand grenade' : '40 mm round'} bursting on the floor: with the rule a ring of dust round it and a darker column over it, twice the dust it raised before or more; without it none of that; every other emitter the same`,
        `with: ${A.pall.length} emitters (${dark} dark), within ${f2(reach)} m of the burst, mass ${f2(mA)} · without: ${O.pall.length}, its ${O.dust.length} puffs mass ${f2(mO)} · ${mO > 0 ? f1(mA / mO) : '∞'}× · others equal ${plain(A.rest) === plain(O.rest)} · counters ${JSON.stringify(st)}`); }
    // A TIGHT SPOT (the block's slot between a locker and the outer walls, a review's find: five of six emitters on one point at 9 a second): what has no
    // room is left out or shrunk, never heaped
    { const S = await quiet(() => floor(RULE)), g = S.g, n0 = S.emits.length; await quiet(async () => { g.destr.pallBurst([35.64, 0.3, 4.75], 1); });
      const P = split(S.emits.slice(n0)).pall, heap = heapOf(P), st = { ...PALL_STATS }, most = K.burst.density * K.maxGain * (1 + K.burst.coreGain), peak = Math.max(0, ...P.map(e => P.filter(o => Math.hypot(o.pos[0] - e.pos[0], o.pos[2] - e.pos[2]) < 0.15).reduce((a, o) => a + o.density, 0)));
      verdict(st.palls === 1 && P.length >= 1 && st.shut >= 1 && heap <= 2 && peak <= most + 1e-6, 'a burst in a tight spot heaps nothing: what has no room is left out, no point is asked for more than a ring emitter and the column together',
        `the slot at (35.64, 4.75): ${P.length} emitters, ${st.shut} left out, at most ${heap} within 0.15 m of one another, the most asked at one point ${f2(peak)} /s (a ring emitter and the column at their most: ${f2(most)})`); }
    // THE PARTICLE LAYER FOLLOWS THE SOLVER'S PART (a stand-in for the GPU particles, there for the pall's own calls alone, that keeps what it is asked:
    // headless there are none): with the pall its long dust goes; over a solver that took none of it, none; with the solver's part switched off, alone
    { const S = await quiet(() => floor(RULE)), g = S.g, asked: any[] = [], E = g.engine, had = { p: E.particles, s: E.settings }, at = openAt(g);
      const fake = new Proxy({}, { get: (_t, k) => k === 'emit' ? (kind: string, _p: any, _d: any, n: number, o: any) => { asked.push({ kind, n, life: o?.life ?? 0 }); return n; } : () => 0 });
      const one = () => { g.destr.pallAt.length = 0; E.settings = { ...(had.s ?? {}), gpuParticles: true }; E.particles = fake; try { g.destr.pallBurst(at, 1); } finally { E.particles = had.p; E.settings = had.s; } };
      const long = () => asked.filter(a => a.kind === 'dust' && a.life >= K.burst.dustLife - 1e-6).length, budget = g.smoke.budget;
      one(); const withIt = long(); g.smoke.budget = () => K.slack - 1; one(); const starved = long() - withIt; g.smoke.budget = budget;
      CHAOS.pall.solver = false; one(); const alone = long() - withIt - starved; CHAOS.pall.solver = true;
      verdict(withIt === 1 && starved === 0 && alone === 1 && PALL_STATS.palls === 3, 'the pall\'s particle layer goes with its solver part, not over a solver that took none of it (a cloud nobody is hidden by), and alone with the solver\'s part switched off', `long dust asked: ${withIt} with the pall · ${starved} over a starved solver · ${alone} with the solver's part off · ${PALL_STATS.palls} palls`); }
    // THE ALLOWANCE: two bursts more than perWindow inside a second raise perWindow palls; once the window has passed the next one goes
    { const S = await quiet(() => floor(RULE)), g = S.g, at = openAt(g);
      const N = K.perWindow + 2; await quiet(async () => { for (let k = 0; k < N; k++) { g.destr.blast([at[0] + k * 0.2, 0.2, at[2]], { who: PLAYER_ID, radius: 2.5 }); S.step(3); } });
      const first = { ...PALL_STATS }; await quiet(async () => { S.step(Math.ceil(K.windowSecs * 60) + 10); g.destr.blast([at[0], 0.2, at[2]], { who: PLAYER_ID, radius: 2.5 }); S.step(2); });
      verdict(first.palls === K.perWindow && first.refused === 2 && PALL_STATS.palls === K.perWindow + 1, `the allowance: ${N} bursts in half a second raise ${K.perWindow} palls and the other two the old dust alone; ${K.windowSecs} s on the next burst raises its own`, `in the window: ${first.palls} palls, ${first.refused} refused · after it: ${PALL_STATS.palls} palls`);
      // …the wall charge is never the one refused; a restart of the floor (the lane's reset) empties the window
      const S2 = await quiet(() => floor(RULE)), g2 = S2.g, at2 = openAt(g2);
      await quiet(async () => { for (let k = 0; k < K.perWindow; k++) { g2.destr.blast([at2[0] + k * 0.3, 0.2, at2[2]], { who: PLAYER_ID, radius: 2.5 }); S2.step(3); } });
      const C2 = await quiet(async () => charge(S2)), afterCharge = PALL_STATS.palls;
      await quiet(async () => { g2.destr.blast([at2[0], 0.2, at2[2]], { who: PLAYER_ID, radius: 2.5 }); }); const full = { ...PALL_STATS };
      await quiet(async () => { g2.destr.reset(); g2.destr.blast([at2[0], 0.2, at2[2]], { who: PLAYER_ID, radius: 2.5 }); });
      verdict(!!C2 && C2.pall.length >= K.wall.near && afterCharge === K.perWindow + 1 && full.palls === K.perWindow + 1 && full.refused === 1 && PALL_STATS.palls === K.perWindow + 2,
        'a wall charge blown inside a full window still raises its pall (the player\'s own set piece is never the one refused) and counts in it; the lane\'s reset empties the window', `after ${K.perWindow} bursts the charge: ${C2?.pall.length ?? 0} emitters, ${afterCharge} palls · one more burst: ${full.palls} palls, ${full.refused} refused · after reset() the same burst: ${PALL_STATS.palls} palls`); }
    // A STARVED SOLVER: under `slack` free slots nothing of the pall is asked; THE PARTICLE LAYER ALONE: `solver` off, no emitter at all
    { const S = await quiet(() => floor(RULE)), g = S.g; g.smoke.budget = () => K.slack - 1; await quiet(async () => { burst(S, 'frag'); }); const starved = split(S.emits).pall.length, st = { ...PALL_STATS };
      const S2 = await quiet(() => floor(RULE)); CHAOS.pall.solver = false; await quiet(async () => { burst(S2, 'frag'); charge(S2); }); const look = split(S2.emits).pall.length, st2 = { ...PALL_STATS }; CHAOS.pall.solver = true;
      verdict(starved === 0 && st.starved >= 4 && look === 0 && st2.palls === 2, `a solver with fewer than ${K.slack} slots free is asked for none of it; with the pall's solver part off (the particle layer alone: ?pall=look) a burst and a charge ask the solver for none either`, `starved: ${starved} emitters, ${st.starved} turned away · look only: ${look} emitters over ${st2.palls} palls (the particles themselves are the GPU's: not seen here)`); }
    // NOTHING at chaos 0, nor with the one switch off
    { const S = await quiet(() => floor(RULE, { chaos: 0 })); await quiet(async () => { burst(S, 'frag'); }); const a = split(S.emits).pall.length, pa = PALL_STATS.palls;
      const S2 = await quiet(() => floor(RULE, { sw: false })); await quiet(async () => { burst(S2, 'frag'); }); const b = split(S2.emits).pall.length, pb = PALL_STATS.palls;
      const S3 = await quiet(() => floor(RULE)); S3.g.destr.showChaos = 0.8; await quiet(async () => { burst(S3, 'frag'); }); const c = split(S3.emits).pall.length, pc = PALL_STATS.palls;
      verdict(a === 0 && pa === 0 && b === 0 && pb === 0 && c === 0 && pc === 0, 'chaos 0, the one switch off, or a level script\'s show running on its own chaos (its cameras keep the picture they were set on): no pall', `chaos 0: ${a} emitters, ${pa} palls · the switch off: ${b}, ${pb} · a show at 0.8: ${c}, ${pc}`);
      CHAOS.pall.on = true; CHAOS.pall.solver = false; const d0 = CHAOS.pall.wall.density; CHAOS.pall.wall.density = 99; resetChaosKnobs(S3.g); const kept = [CHAOS.pall.on, CHAOS.pall.solver, CHAOS.pall.wall.density === d0]; CHAOS.pall.solver = true;
      verdict(kept[0] === true && kept[1] === false && kept[2] === true, 'the panel\'s ↺ (resetChaosKnobs) puts the pall\'s numbers back and leaves its switch as the page opened', `on, solver, the numbers back: ${kept}`); }
    // THE GAME ITSELF IS THE SAME GAME (the solver a null object here): a charge and a grenade, four seconds, the rule on and off — one digest
    { const run = async (rule: boolean) => { Math.random = (() => { let s = 77; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); const S = await floor(rule); charge(S);   // (seeded before the floor stands: the men's own construction draws dice)
        burst(S, 'frag'); S.step(120); const d = digestGame(S.g, true) as any; if (d.player) delete d.player.yaw; return JSON.stringify(d); };
      const dA = await quiet(() => run(RULE)), dB = await quiet(() => run(false));
      const differs = (x: any, y: any, at: string, out: string[]) => { if (out.length >= 4) return out; if (x && y && typeof x === 'object' && typeof y === 'object') { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) differs(x[k], y[k], `${at}.${k}`, out); } else if (x !== y) out.push(`${at}: ${JSON.stringify(x)} / ${JSON.stringify(y)}`); return out; };
      verdict(dA === dB && dA.length > 200, 'with the solver a null object the game digests the same with the rule on and off: the pall draws none of the game\'s dice and touches nothing but the solver', `${dA.length} chars, equal ${dA === dB}${dA === dB ? '' : ` — differs at ${differs(JSON.parse(dA), JSON.parse(dB), '', []).join(' · ')}`}`); }
    // a recording from before the key replays with the rule off; one that carries it plays as it says (journal.ts applyKnobs); the page's own boot
    { const S = await quiet(() => floor(false)), g = S.g, snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      CHAOS.pall.on = true; const old = snap(); delete old.tables.CHAOS.pall; JOURNAL.applyKnobs(g, old); const without = CHAOS.pall.on;
      const own = snap(); own.tables.CHAOS.pall = { ...own.tables.CHAOS.pall, on: true }; JOURNAL.applyKnobs(g, own); const withIt = CHAOS.pall.on;
      verdict(without === false && withIt === true, 'a recording from before the key replays with the rule off; one that carries it on plays with it on', `applyKnobs with no key → ${without} · with the key on → ${withIt}`);
      PROFILE.pageSwitches(new URLSearchParams('')); const a = [CHAOS.pall.on, CHAOS.pall.solver]; PROFILE.pageSwitches(new URLSearchParams('pall=0')); const b = [CHAOS.pall.on, CHAOS.pall.solver]; PROFILE.pageSwitches(new URLSearchParams('pall=look')); const c = [CHAOS.pall.on, CHAOS.pall.solver];
      verdict(a[0] && a[1] && !b[0] && c[0] && !c[1], 'the page\'s boot (pageSwitches): no flag → on, in the solver · ?pall=0 → off · ?pall=look → on, the particle layer alone', `'' → ${a} · 'pall=0' → ${b} · 'pall=look' → ${c}`); }
  } finally { console.log = log; knobsBack(knobs0); DESTRUCTION.on = destr0; Math.random = rnd0; zero(); }   // (pageSwitches and applyKnobs wrote every table: each back as this check found it)
  console.log(`=== pall: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await pallCheck()) ? 0 : 1);
