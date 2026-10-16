// The 'loudchaos' probe family — destruction's CHAOS on the loud levels (game/destructionSwitch.ts on: destruction.ts's loud rules, the levels' dressing —
// tools/levels/dress.ts; glass is NOT this part's — it is left as the base has it), run through probes.ts:
//   bun run tools/qa/probes.ts loudchaos | loudchaos-levels | loudchaos-firefight | loudchaos-blast | loudchaos-fixtures | loudchaos-sight | loudchaos-off | loudchaos-base [--verbose]
// Headless = the Proxy device, a recording smoke stand-in, a probe that never answers; what is asserted is every CPU-side promise:
//   (levels)     each loud level file carries its dressing LAST under the group 'dressing'; with the switch OFF loadLevel leaves it out and the level is the generator's
//                own, box for box; ON, destruction's index finds paper, clutter, binders and screens on it — all under a roof, none of them a fixture;
//   (firefight)  per level, a burst over a dressed table into the wall behind it and into the things on it: paper up, things knocked off as debris, dust into the
//                smoke — every count inside its cap (puffs a second / a frame, knocks a second, the debris pool), nothing NaN, and restartEncounter puts it all back;
//   (blast)      per level, a charge beside a dressed surface: paper up in a ring, the ceiling over it answers (a tile down, or the light panel in that square out),
//                dust off the ceiling AND off the floor, fixtures within reach and in view dark; out of doors no tile and no ceiling dust; `power` scales the reach;
//   (fixtures)   a round that is not the player's puts out a fixture only when it is IN it (its box, or within 18 cm of its flight), a guard with a line to it notices
//                (the 'lightOut' event the OCP always filed); the per-encounter cap and the gap hold; breakers, devices and scenery never; switch off: none of it;
//   (sight)      the AI's sight through dust is the rule it always was: guards.ts reads ONE number per sight line off the Sensors segment query and blocks under
//                0.3 / scales to 0.8 — planted answers move it exactly so with the switch on and off; the harness's CPU dust stand-in (dust-standin.ts) feeds that
//                same query (a cloud between two points dims the line, a cloud behind a wall does not, no puff = no answer);
//   (off)        the switch off = destruction.ts as it was: the office rectangle decides 'indoors', the player-only fixture rule stands alone, bang ignores `power`,
//                glass does not come apart under a scenario, the module's new counters never move;
//   (base)       the switch off digests as the one build: four seeded playthroughs (PT_DESTR=0) fold to the digests frozen from e6188f6
//                (tools/qa/fixtures/loudchaos-base-digests.json — the build before any of this), run in child processes.
import { standUp, ROOT } from './headless.ts';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { DESTRUCTION, DRESS_GROUP } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { fireWeapon, detonateStun } = await import(`${ROOT}/src/game/combat.ts`);
const fx = await import(`${ROOT}/src/game/effects.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const D = await import(`${ROOT}/src/game/destruction.ts`);
const { glassBreakLive } = await import(`${ROOT}/src/game/glassbreak.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { NOBODY_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { structuralDiff } = await import(`${ROOT}/src/scene/levelData.ts`);
const { installDustStandin } = await import('./dust-standin.ts');

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
/** the loud levels: file, generator, the query that stages its scenario — tools/levels/dress.ts's own list (what export.ts dresses by) */
const { LOUD_LEVELS } = await import(`${ROOT}/tools/levels/dress.ts`);
export const LOUD: { file: string; gen: string; q: string }[] = LOUD_LEVELS;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2);
const p2 = (p: Vec3) => `(${f2(p[0])}, ${f2(p[1])}, ${f2(p[2])})`;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { const ok = all; console.log(`=== ${title.split(':')[0]}: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) process.exitCode = 1; return ok; } };
}
const resetStats = () => { for (const k of Object.keys(D.DESTR_STATS)) (D.DESTR_STATS as any)[k] = 0; D.DESTR_LOG.length = 0; };
const dataOf = (file: string) => parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'));
async function quiet<T>(fn: () => Promise<T> | T): Promise<T> { if (VERBOSE) return await fn(); const l = console.log, w = console.warn, e = console.error; console.log = console.warn = console.error = () => {}; try { return await fn(); } finally { console.log = l; console.warn = w; console.error = e; } }

interface Stage { W: any; game: any; smokeLog: any[]; items: { i: number; kind: string; box: any }[] }
/** A loud level stood up with the switch as given, chaos 0.5 (the page's), god mode, the AI off, a smoke stand-in that RECORDS emits (stamped with the game clock) — and,
 *  with the switch on (or `scn`), its SCENARIO started (the loud rules are live only under one: destruction.ts loudNow), everybody standing where he was staged. */
async function stage(file: string, on: boolean, seed = 4401, chaos = 0.5, scn = on): Promise<Stage> {
  Math.random = seeded(seed); DESTRUCTION.on = on; resetStats();
  const W: any = await quiet(() => standUp({ uploadEvery: 1, level: loadLevel(dataOf(file)) })); const game = W.game;
  game.tune.chaos = chaos; game.godMode = true; game.aiEnabled = false; game.playerInvisible = true;
  const smokeLog: any[] = []; const emit0 = W.smoke.emit.bind(W.smoke); W.smoke.emit = (e: any) => { smokeLog.push({ ...e, t: game.time }); emit0(e); };
  const items: Stage['items'] = []; for (let i = 0; i < game.col.boxes.length; i++) { const d = game.destr.itemOf(i); if (d) items.push({ i, kind: d.kind, box: d.box }); }
  if (scn) { const L = LOUD.find(l => l.file === file)!; game.aiEnabled = true; await quiet(() => startFromQuery(game, new URLSearchParams(`levelFile=${file}&${L.q}`))); game.aiEnabled = false; }
  for (let f = 0; f < 5; f++) W.step(DT);
  return { W, game, smokeLog, items };
}
/** a floor point 2 to 4.5 m from `p` with a clear line (at gun height) to just over it, nothing solid where a man would stand: where the probe's shooter stands */
function standNear(game: any, p: Vec3, min = 2, max = 4.5, lift = 0.12): Vec3 | null {
  for (let r = min; r <= max; r += 0.5) for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8 + r; const q: Vec3 = [p[0] + Math.cos(a) * r, 0, p[2] + Math.sin(a) * r];
    if (q[0] < 1 || q[0] > 39 || q[2] < 1 || q[2] > 27) continue;
    if (game.col.solidBlocked([q[0], 1.4, q[2]], [p[0], p[1] + lift, p[2]]) || game.col.solidBlocked([q[0], 0.2, q[2]], [q[0], 1.7, q[2]])) continue;
    let clear = true; for (const [dx, dz] of [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) if (game.col.solidBlocked([q[0], 0.9, q[2]], [q[0] + dx, 0.9, q[2] + dz])) clear = false;
    if (clear) return q;
  }
  return null;
}
/** the most crowded dressed spot: the paper stack with the most other destructibles within 1.2 m of it */
function busiest(items: Stage['items']): Stage['items'][number] | null {
  let best: Stage['items'][number] | null = null, bn = -1;
  for (const it of items) { if (it.kind !== 'paper') continue; let n = 0; for (const o of items) if (o !== it && Math.hypot(o.box.c[0] - it.box.c[0], o.box.c[2] - it.box.c[2]) < 1.2) n += o.kind === 'clutter' || o.kind === 'binder' ? 2 : 1; if (n > bn) { bn = n; best = it; } }
  return best;
}
/** stand Sam at `at` facing `to` */
function face(S: Stage, at: Vec3, to: Vec3) { const { W, game } = S; game.teleportPlayer(at); const pc = game.player.char; pc.bodyYaw = pc.aimYaw = Math.atan2(to[0] - at[0], to[2] - at[2]); for (let f = 0; f < 30; f++) { W.cursorAt(to); W.step(DT); } }   // (the cursor on the thing: his gun comes round to it, not into the wall beside him)
/** where a charge beside the dressing does the most: the floor point 0.9 to 1.6 m from a paper stack with the most stacks in the blast's own view (from just over desk height, as the module judges it) */
function chargeSpot(game: any, items: Stage['items']): Vec3 | null {
  let best: Vec3 | null = null, bn = 0; const papers = items.filter(o => o.kind === 'paper');
  for (const it of papers) { const q = standNear(game, it.box.c, 0.9, 1.6); if (!q) continue; const eye: Vec3 = [q[0], 0.95, q[2]]; let n = 0; for (const o of papers) if (v3.dist(o.box.c, q) < 2.4 && !game.col.solidBlocked(eye, [o.box.c[0], o.box.c[1] + o.box.h[1] + 0.05, o.box.c[2]])) n++; if (n > bn) { bn = n; best = q; } }
  return best;
}
const capsHeld = (smokeLog: any[], game: any): string[] => {
  const bad: string[] = []; const puffs = smokeLog.filter(e => e.kind === 'puff').map(e => e.t);
  for (let i = 0; i < puffs.length; i++) { let n = 0; for (let j = i; j < puffs.length && puffs[j] - puffs[i] < 1 - 1e-9; j++) n++; if (n > D.CHAOS.puffsPerSec) { bad.push(`${n} puffs inside one second at t ${f2(puffs[i])}`); break; } }
  const perFrame = new Map<string, number>(); for (const t of puffs) perFrame.set(t.toFixed(4), (perFrame.get(t.toFixed(4)) ?? 0) + 1); for (const [t, n] of perFrame) if (n > D.CHAOS.puffsPerFrame) { bad.push(`${n} puffs in the frame at ${t}`); break; }
  if (game.destr.debris.list.length > game.destr.debris.cap()) bad.push(`debris ${game.destr.debris.list.length} > cap ${game.destr.debris.cap()}`);
  for (const c of game.destr.debris.list) if (![...c.box.c, ...c.v].every(Number.isFinite)) { bad.push('a NaN in a debris chunk'); break; }
  if (D.DESTR_STATS.tiles > D.CHAOS.tilesPerEncounter) bad.push(`tiles ${D.DESTR_STATS.tiles} > ${D.CHAOS.tilesPerEncounter}`);
  if (D.DESTR_STATS.fixtures > D.CHAOS.loud.fixturesPerEncounter) bad.push(`fixtures ${D.DESTR_STATS.fixtures} > ${D.CHAOS.loud.fixturesPerEncounter}`);
  return bad;
};

// ================================================================ levels
export async function loudLevels() {
  const F = family('loudchaos-levels: every loud level carries dressing to wreck — last in its file, left out with the switch off, found by destruction\'s index with it on');
  for (const L of LOUD) {
    const data = dataOf(L.file); const fails: string[] = [];
    const first = data.boxes.findIndex((b: any) => b.group === DRESS_GROUP), nDress = data.boxes.filter((b: any) => b.group === DRESS_GROUP).length;
    if (nDress < 20) fails.push(`only ${nDress} dressing boxes`);
    if (first < 0 || data.boxes.slice(first).some((b: any) => b.group !== DRESS_GROUP)) fails.push('the dressing is not the tail of the box list');
    if (data.boxes.slice(first).some((b: any) => b.emissive || (b.flags ?? []).some((f: string) => f !== 'NoShadow'))) fails.push('a dressing box is emissive or carries a flag besides NoShadow');
    const refd = new Set<string>(); for (const s of data.switchables) for (const id of s.boxes) refd.add(id); for (const l of data.lights) if ((l as any).fixture) refd.add((l as any).fixture);
    if (data.boxes.slice(first).some((b: any) => refd.has(b.id))) fails.push('a switchable / light refers to a dressing box');
    DESTRUCTION.on = false; const off = loadLevel(data, { lived: true }); DESTRUCTION.on = true; const on = loadLevel(data, { lived: true });   // (lived: the generator builds the lived-in rooms' furniture, src/scene/lived.ts — it sits before the dressing)
    if (off.boxes.length !== data.boxes.length - nDress || on.boxes.length !== data.boxes.length) fails.push(`loadLevel: ${off.boxes.length} boxes off / ${on.boxes.length} on, the file has ${data.boxes.length} with ${nDress} dressing`);
    // off = the generator's own level (the one build's): box for box, and everything else
    const gen = (await import(`${ROOT}/tools/levels/${L.gen}.ts`)).build(); if (gen.scenarios) gen.level.scenarios = gen.scenarios; { const DS = await import(`${ROOT}/src/scene/doorSize.ts`); DS.fitDoors(gen.level.doors); DS.fitWaysOut(gen.level, gen.scenarios?.quiet); }   // (as tools/levels/export.ts writes it)
    { const FL = await import('../levels/flatLayers.ts'), LV = await import('../../src/scene/lived.ts'), BX = await import('../../src/scene/boxes.ts'); FL.layGeneratedFloor(gen.level.boxes, gen.groups, LV.isLived, BX.BoxFlag); }   // (… and its floor swept into order, as the export sweeps it before it writes: flatLayers.ts)
    const diffs: string[] = []; const nd = structuralDiff(gen.level, off, diffs); if (nd) fails.push(`switch off: ${nd} diff(s) from the generator's level — ${diffs.slice(0, 2).join('; ')}`);
    const S = await stage(L.file, true); const inv = S.game.destr.inventory();
    const small = (inv.clutter ?? 0) + (inv.binder ?? 0);
    if ((inv.paper ?? 0) < 6 || small < 6) fails.push(`the index finds ${inv.paper ?? 0} paper, ${small} clutter + binders`);
    // what dress.ts put under a roof, destruction's own roof rule keeps (every dressing paper indexed), and the dressing moves nobody's feet (the nav grid is the undressed level's)
    const dressPaper = data.boxes.filter((b: any) => b.group === DRESS_GROUP && (b.flags ?? []).includes('NoShadow') && b.h[1] <= 0.02).length; const allPaper = S.items.filter(it => it.kind === 'paper').length;
    const basePaper = (() => { let n = 0; for (const b of data.boxes) if (b.group !== DRESS_GROUP && (b.flags ?? []).includes('NoShadow') && b.h[1] <= 0.02) n++; return n; })();
    if (allPaper < dressPaper) fails.push(`${dressPaper} dressing paper boxes in the file, the index holds ${allPaper} (${basePaper} more could be the level's own)`);
    { const Soff = await stage(L.file, false); const a = S.game.col.nav.blocked, b = Soff.game.col.nav.blocked; let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; if (d) fails.push(`${d} nav cells differ between the dressed and the undressed level`); DESTRUCTION.on = true; }
    const lit = new Set<number>(); for (const t of S.game.targets) for (const bi of t.boxes) lit.add(bi);
    if (S.items.some(it => lit.has(it.i) && it.kind !== 'screen' && it.kind !== 'tv' && it.kind !== 'housing')) fails.push('a fixture box indexed as clutter / paper');
    const total = S.game.col.boxes.length + S.game.props.props.reduce((n: number, p: any) => n + p.boxes.length, 0);
    F.verdict(!fails.length, `${L.file}: ${nDress} dressing boxes at the tail, off = the generator's level (${off.boxes.length} boxes, 0 diffs), on the index holds ${JSON.stringify(inv)}`, fails.join('; ') || `${total} static + prop boxes of the 4096 a frame may draw; lights untouched (${data.lights.length} + ${data.switchables.length} switchables)`);
  }
  DESTRUCTION.on = false; return F.done();
}

// ================================================================ firefight
/** THE MERGE'S SEAM with the wall engine (src/game/wallbreak.ts): the dressing is small things ON tables and shelves — none of it may be taken by the engine's
 *  partition / cover rule (it would then be chewed as cover and a man could be dealt it), and all of it stays the chaos lane's to knock about. */
export async function loudDressing() {
  const F = family('loudchaos-dressing: none of the dressing is the wall engine\'s cover or partition');
  for (const L of LOUD) {
    const data = dataOf(L.file); const dress: number[] = []; data.boxes.forEach((b: any, i: number) => { if (b.group === DRESS_GROUP) dress.push(i); });
    const S = await stage(L.file, true); const walls = S.game.destr.walls; const list: any[] = walls.list; const taken = dress.filter(i => walls.owner.has(i) || list.some(B => B.id === i));
    const inv = walls.inventory(); const items = new Set(S.items.map(d => d.i)); const found = dress.filter(i => items.has(i)).length;
    F.verdict(dress.length > 0 && taken.length === 0 && inv.walls + inv.cover > 0, `${L.file}: ${dress.length} dressing boxes, none a breakable of the wall engine`,
      `engine: ${inv.walls} partitions, ${inv.cover} cover · dressing taken as cover / wall: ${taken.length}${taken.length ? ' (' + taken.slice(0, 6).join(', ') + ')' : ''} · the chaos lane indexes ${found} of them`);
    DESTRUCTION.on = false;
  }
  return F.done();
}
export async function loudFirefight() {
  const F = family('loudchaos-firefight: a burst over a dressed table on each loud level — paper up, things knocked off, dust into the smoke, every count inside its cap');
  for (const L of LOUD) {
    const S = await stage(L.file, true); const { W, game, smokeLog, items } = S; const it = busiest(items);
    if (!it) { F.verdict(false, `${L.file}: a dressed spot`, 'no paper stack in the index'); continue; }
    const at = standNear(game, it.box.c);
    if (!at) { F.verdict(false, `${L.file}: somewhere to stand`, `nowhere within 4.5 m of ${p2(it.box.c)} has a line to it`); continue; }
    face(S, at, it.box.c); const pc = game.player.char; const hidden0 = game.destr.inventory().hidden;
    // 0.6 s of automatic fire into the stack, a second over it into whatever stands behind …
    for (let r = 0; r < 6; r++) { fireWeapon(game, pc, [it.box.c[0] + ((r % 3) - 1) * 0.05, it.box.c[1], it.box.c[2] + ((r % 2) - 0.5) * 0.06], true, { weapon: WEAPONS.fn2000 }); for (let f = 0; f < 6; f++) W.step(DT); }
    const aim = v3.normalize(v3.sub([it.box.c[0], it.box.c[1] + 0.3, it.box.c[2]], [at[0], 1.4, at[2]])); const far: Vec3 = v3.mad(it.box.c, aim, 6);
    for (let r = 0; r < 10; r++) { fireWeapon(game, pc, [far[0] + ((r % 5) - 2) * 0.12, far[1] + ((r % 3) - 1) * 0.1, far[2] + ((r % 4) - 1.5) * 0.12], true, { weapon: WEAPONS.fn2000 }); for (let f = 0; f < 6; f++) W.step(DT); }
    // … then into the small things near it, each from where it can be seen (a thing is knocked off once its square is hot: the fifth round into it at chaos 0.5)
    const smalls = items.filter(o => o.kind === 'clutter' || o.kind === 'binder').sort((a, b) => v3.dist(a.box.c, it.box.c) - v3.dist(b.box.c, it.box.c)).slice(0, 4);
    for (const o of smalls) { const q = standNear(game, o.box.c, 2, 4.5, o.box.h[1] + 0.05); if (!q) continue; face(S, q, o.box.c); for (let r = 0; r < 7; r++) { fireWeapon(game, pc, v3.copy(o.box.c), true, { weapon: WEAPONS.fn2000 }); for (let f = 0; f < 6; f++) { W.cursorAt(o.box.c); W.step(DT); } } }
    for (let f = 0; f < 90; f++) W.step(DT);
    const s = { ...D.DESTR_STATS }; const fails = capsHeld(smokeLog, game);
    if (s.papers < 1) fails.push('no paper went up'); if (smalls.length && s.knocks < 1) fails.push(`nothing knocked off (${smalls.length} small things shot at)`);
    if (s.rounds < 20) fails.push(`only ${s.rounds} rounds reached the module`); if (s.puffs < 1) fails.push('no dust');
    const hid = game.destr.inventory().hidden; await quiet(() => game.restartEncounter()); const back = game.destr.inventory().hidden === 0 && game.destr.debris.list.length === 0;
    if (!back) fails.push('restartEncounter left something hidden / in the pool');
    F.verdict(!fails.length, `${L.file}: from ${p2(at)} over the stack at ${p2(it.box.c)} — ${s.rounds} rounds: ${s.papers} stacks up (${s.sheets} sheets), ${s.knocks} knocked off (${s.knocksDemoted} demoted), ${s.puffs} dust puffs (−${s.puffsRefused} refused by the caps), ${s.bursts} bursts, ${s.tiles} tiles`,
      fails.join('; ') || `${hid - hidden0} statics hidden then restored by the restart; debris peak ${game.destr.debris.stats.peakLive} of ${game.destr.debris.cap()}; puffs ≤ ${D.CHAOS.puffsPerSec}/s and ≤ ${D.CHAOS.puffsPerFrame}/frame held`);
  }
  DESTRUCTION.on = false; return F.done();
}

// ================================================================ blast
export async function loudBlast() {
  const F = family('loudchaos-blast: a charge beside a dressed surface on each loud level — paper up, the ceiling answers, dust off ceiling and floor, fixtures in reach dark');
  for (const L of LOUD) {
    const S = await stage(L.file, true); const { W, game, smokeLog, items } = S; const it = busiest(items);
    const at0 = it && (chargeSpot(game, items) ?? standNear(game, it.box.c, 0.9, 1.6)); if (!it || !at0) { F.verdict(false, `${L.file}: a spot for the charge`, 'none found beside a dressed surface'); continue; }
    const at: Vec3 = [at0[0], 0.06, at0[2]];
    const lit0 = game.targets.filter((t: any) => !t.broken).length;
    game.destr.bang(at, NOBODY_ID); for (let f = 0; f < 120; f++) W.step(DT);
    const s = { ...D.DESTR_STATS }; const fails = capsHeld(smokeLog, game);
    const puffs = smokeLog.filter(e => e.kind === 'puff'); const high = puffs.filter(e => e.pos[1] > 2).length, low = puffs.filter(e => e.pos[1] < 0.5).length;
    if (s.papers < 1) fails.push('no paper went up'); if (high < 1) fails.push('no dust off the ceiling');
    if (s.tiles + s.fixtures < 1) fails.push('neither a tile nor a panel came down over it');
    if (low < D.CHAOS.loud.blastDustPuffs) fails.push(`${low} puff(s) off the floor, a charge raises ${D.CHAOS.loud.blastDustPuffs}`);
    const dark = lit0 - game.targets.filter((t: any) => !t.broken).length;
    // out of doors: the same charge under the open sky drops nothing and shakes no ceiling
    let outdoors = 'no open ground found';
    { let op: Vec3 | null = null; for (let x = 1.5; x < 39 && !op; x += 1.5) for (let z = 1.5; z < 27 && !op; z += 1.5) if (!game.col.raycast([x, 2.3, z], [0, 1, 0], 6) && !game.col.solidBlocked([x, 0.1, z], [x, 2.2, z])) op = [x, 0.06, z];
      if (op) { const t0 = D.DESTR_STATS.tiles, n0 = smokeLog.length; game.destr.bang(op, NOBODY_ID); W.step(DT); const up = smokeLog.slice(n0).filter(e => e.kind === 'puff' && e.pos[1] > 2).length; if (D.DESTR_STATS.tiles !== t0 || up) fails.push(`a charge in the open at ${p2(op)} dropped a tile / shook a ceiling`); outdoors = `in the open at ${p2(op)}: no tile, no ceiling dust`; } }
    F.verdict(!fails.length, `${L.file}: a charge at ${p2(at)} — ${s.papers} stacks up, ${s.knocks} knocked off, ${s.tiles} tile down, ${dark} fixture(s) dark (${s.fixtures} by the blast / the ceiling), dust: ${high} off the ceiling, ${low} off the floor`, fails.join('; ') || `${outdoors}; debris ${game.destr.debris.list.length} of ${game.destr.debris.cap()}`);
  }
  // dustBurst (the seam for whatever else breaks things): far more asked than the caps allow → let out at ≤ 2 a frame, ≤ 8 a second, the queue bounded, the rest refused; nothing at chaos 0
  { const S = await stage('warehouse.json', true); const { W, game, smokeLog } = S; const at: Vec3 = [20, 0.06, 14]; const fails: string[] = [];
    game.destr.dustBurst(at, [0, 1, 0], 60, 1, 'concrete', 1.5); for (let f = 0; f < 60 * 5; f++) W.step(DT);
    const n = smokeLog.filter(e => e.kind === 'puff').length; fails.push(...capsHeld(smokeLog, game));
    if (n < 16 || n > D.CHAOS.loud.burstQueue) fails.push(`${n} puffs out of 60 asked (queue ${D.CHAOS.loud.burstQueue}, ${D.CHAOS.loud.burstSecs} s at ${D.CHAOS.puffsPerSec}/s)`);
    const last = Math.max(...smokeLog.filter(e => e.kind === 'puff').map(e => e.t)), first = Math.min(...smokeLog.filter(e => e.kind === 'puff').map(e => e.t));
    if (last - first > D.CHAOS.loud.burstSecs + 0.1) fails.push(`still puffing ${f2(last - first)} s on`);
    const far = smokeLog.filter(e => e.kind === 'puff').some(e => Math.hypot(e.pos[0] - at[0], e.pos[2] - at[2]) > 1.5 + 1e-6); if (far) fails.push('a puff outside the spread');
    game.tune.chaos = 0; const n0 = smokeLog.length; game.destr.dustBurst(at, [0, 1, 0], 10, 1, 'concrete', 1); for (let f = 0; f < 30; f++) W.step(DT); if (smokeLog.length !== n0) fails.push('a burst at chaos 0 raised dust');
    F.verdict(!fails.length, `dustBurst of 60 puffs: ${n} let out over ${f2(last - first)} s inside the per-frame and per-second caps, ${D.DESTR_STATS.puffsRefused} refused, all within the 1.5 m spread; nothing at chaos 0`, fails.join('; ') || `queue ≤ ${D.CHAOS.loud.burstQueue}, patience ${D.CHAOS.loud.burstSecs} s`); }
  // `power` reaches further (switch on) and is ignored with it off
  { const S = await stage('warehouse.json', true); const { game, items } = S; const papers = items.filter(o => o.kind === 'paper');
    const reachOf = async (on: boolean, power: number) => { const T = await stage('warehouse.json', on, 4401, 0.5, true); const c = papers[0].box.c; const at = standNear(T.game, c, 3.2, 3.6); if (!at) return -1; T.game.destr.bang([at[0], 0.06, at[2]], NOBODY_ID, power); return D.DESTR_STATS.papers; };
    void game; const a = await reachOf(true, 1), b = await reachOf(true, 4), c = await reachOf(false, 4);
    F.verdict(a === 0 && b >= 1 && c === 0, 'a charge 3.4 m from a stack leaves it (power 1), takes it at power 4 with the switch on, and leaves it at power 4 with the switch off (the argument is not read)', `stacks up: ${a} / ${b} / ${c}`); }
  DESTRUCTION.on = false; return F.done();
}

// ================================================================ fixtures
export async function loudFixtures() {
  const F = family('loudchaos-fixtures: anybody\'s round that is IN a fixture puts it out, a near miss does not, the caps hold, breakers / devices / scenery never; a stun canister is not a blast; switch off: none of it');
  const liveOf = (game: any) => game.targets.filter((t: any) => !t.broken && t.interactive && (t.kind === 'emissive' || t.kind === 'analytic') && (t.on || t.factor > 0));
  { const S = await stage('barracks.json', true); const { W, game } = S; const ts = liveOf(game); const fails: string[] = [];
    const t = ts[0]; const below: Vec3 = [t.pos[0] + 0.6, 1.2, t.pos[2] + 0.4]; const dir = v3.normalize(v3.sub(t.pos, below)), L = v3.dist(t.pos, below);
    const ev0 = game.events.length;
    game.destr.fixtureRound(below, v3.normalize(v3.sub([t.pos[0] + 0.45, t.pos[1], t.pos[2]], below)), L, undefined); const miss = t.broken;
    game.destr.fixtureRound(below, dir, L, undefined); const hit = t.broken; W.step(DT);
    if (miss) fails.push('a round passing 0.4 m from the fixture put it out'); if (!hit) fails.push('a round through the fixture left it lit');
    if (!game.events.slice(ev0).some((e: any) => e.kind === 'lightOut')) fails.push('no lightOut event filed (nobody could notice)');
    if (t.factor > 0.01 && (W.step(DT), t.factor > 0.01)) fails.push(`its light is still up (factor ${t.factor})`);
    // the gap, then the cap: every other fixture shot dead-on, 1 s apart
    const t2 = liveOf(game)[0]; game.destr.fixtureRound([t2.pos[0], 1.2, t2.pos[2]], [0, 1, 0], t2.pos[1] - 1.2, undefined); if (t2.broken) fails.push(`a second fixture inside the ${D.CHAOS.loud.fixtureGapSecs} s gap went too`);
    for (const x of liveOf(game)) { for (let f = 0; f < 60; f++) W.step(DT); game.destr.fixtureRound([x.pos[0], 1.2, x.pos[2]], [0, 1, 0], Math.max(0.1, x.pos[1] - 1.2), undefined); }
    const dead = D.DESTR_STATS.fixtures; if (dead > D.CHAOS.loud.fixturesPerEncounter) fails.push(`${dead} fixtures out, the cap is ${D.CHAOS.loud.fixturesPerEncounter}`);
    if (ts.length > D.CHAOS.loud.fixturesPerEncounter && dead !== D.CHAOS.loud.fixturesPerEncounter) fails.push(`${dead} out of ${ts.length} shot dead-on, expected the cap exactly`);
    const never = game.targets.filter((x: any) => x.broken && (x.kind === 'breaker' || x.kind === 'device' || !x.interactive)); if (never.length) fails.push(`${never.map((x: any) => x.name)} broken`);
    await quiet(() => game.restartEncounter()); if (game.targets.some((x: any) => x.broken)) fails.push('a fixture still broken after the restart');
    F.verdict(!fails.length, `barracks: ${t.name} survives a round 0.45 m wide and dies to one through it (lightOut filed); then ${ts.length} live fixtures shot dead-on a second apart → ${dead} out, ${D.DESTR_STATS.fixturesRefused} refused by the cap / gap; a restart relights them all`, fails.join('; ') || `cap ${D.CHAOS.loud.fixturesPerEncounter} an encounter, gap ${D.CHAOS.loud.fixtureGapSecs} s`); }
  { // through fireWeapon: a staged teammate's round into a panel's own box (not the player's) — and the same with the switch off
    const run = async (on: boolean) => { const S = await stage('barracks.json', on, 4401, 0.5, true); const { W, game } = S;
      const op = game.nightBreach.ops[0]; if (!op) return { ok: false, why: 'no teammate staged' };
      let best: any = null, bd = 1e9; for (const t of liveOf(game)) { const d = v3.dist(t.pos, op.char.pos); if (d < bd && t.boxes.length && !game.col.solidBlocked(v3.add(op.char.pos, [0, 1.5, 0]), [t.pos[0], t.pos[1] - 0.15, t.pos[2]])) { bd = d; best = t; } }
      if (!best) return { ok: false, why: 'no fixture in the teammate\'s view' };
      for (let r = 0; r < 3; r++) { fireWeapon(game, op.char, v3.copy(best.pos), false, { weapon: WEAPONS[op.weapon?.def?.id ?? 'aks74u'] ?? WEAPONS.aks74u }); W.step(DT); }
      return { ok: true, broken: best.broken, name: best.name, d: bd }; };
    const a: any = await run(true), b: any = await run(false);
    F.verdict(a.ok && b.ok && a.broken === true && b.broken === false, 'a staged teammate\'s rounds at a panel he can see: out with the switch on, untouched with it off (the player-only rule alone)', a.ok && b.ok ? `${a.name} at ${f2(a.d)} m — on: broken ${a.broken}; off: broken ${b.broken}` : `${a.why ?? b.why}`); }
  { // A STUN CANISTER IS NOT A BLAST (CHAOS.loud.stunFixtureM / stunPanels): on the floor under a lit fixture it leaves the light on, however many go off there; right
    // beside the lamp it puts it out; a door or wall charge borrowing the canister's report (detonateStun's `borrowed`) and the old knob values put it out from the
    // floor, as every bang did; and with stunPanels alone back on, the panel is shaken out of the ceiling once a can's tile square is the panel's own
    const run = async (how: 'stun' | 'beside' | 'charge' | 'old' | 'panels', cans = 1) => { const S = await stage('barracks.json', true, 4401, 0.5, true); const { W, game } = S; const L = D.CHAOS.loud, keep = { m: L.stunFixtureM, p: L.stunPanels };
      if (how === 'old') { L.stunFixtureM = L.fixtureBlastM; L.stunPanels = true; } if (how === 'panels') L.stunPanels = true;
      try {
        let best: any = null, bd = 1e9; const H = 0.1 + fx.bang.height;   // (where a can lying on the floor goes off)
        for (const t of liveOf(game)) { const eye: Vec3 = [t.pos[0], 0.95, t.pos[2]], d = t.pos[1] - H; if (d < 1.2 || d > 2.9 || d >= bd || !t.boxes.length) continue;
          const hit = game.col.raycast(eye, [0, 1, 0], t.pos[1] - 0.95); if (hit && hit.t < t.pos[1] - 0.95 - 0.06 && !(hit.index !== undefined && t.boxes.includes(hit.index))) continue;
          if (game.col.solidBlocked([t.pos[0], 0.1, t.pos[2]], eye)) continue; bd = d; best = t; }
        if (!best) return { ok: false, why: 'no lit fixture with clear floor under it' };
        const dark0 = game.targets.filter((x: any) => x.broken).length, log0 = D.DESTR_LOG.length, tiles0 = D.DESTR_STATS.tiles;
        const at: Vec3 = how === 'beside' ? [best.pos[0], best.pos[1] - 0.45 - fx.bang.height, best.pos[2]] : [best.pos[0], 0.1, best.pos[2]];
        let n = 0; for (; n < cans && !best.broken; n++) { const it = game.items.spawn('flash', at, [0, 0, 0], { fuse: 9, heading: 0, who: NOBODY_ID }); it.fired = true; detonateStun(game, it, how === 'charge'); for (let f = 0; f < 6; f++) W.step(DT); }
        return { ok: true, name: best.name, d: bd, n, out: !!best.broken, dark: game.targets.filter((x: any) => x.broken).length - dark0, tiles: D.DESTR_STATS.tiles - tiles0, shaken: D.DESTR_LOG.slice(log0).some((l: string) => l.includes(`fixture ${best.name} out (shaken)`)) };
      } finally { L.stunFixtureM = keep.m; L.stunPanels = keep.p; } };
    const a: any = await run('stun', 6), b: any = await run('beside'), c: any = await run('charge'), d: any = await run('old'), e: any = await run('panels', 6);
    const all = a.ok && b.ok && c.ok && d.ok && e.ok;
    const ok = all && !a.out && a.dark === 0 && a.tiles >= 1 && b.out && c.out && d.out && d.dark === c.dark && e.out && e.shaken;
    F.verdict(ok, 'a stun canister on the floor under a lit fixture leaves every light on, six of them running (tiles beside the panel let go); one that goes off right beside the lamp puts it out; a door or wall charge there, and a stun with the knobs at their old values, put it out as a blast does; with stunPanels alone back on the panel is shaken out',
      all ? `${a.name}, ${f2(a.d)} m over the can — stun ×${a.n}: out ${a.out}, ${a.dark} dark, ${a.tiles} tiles · beside (0.45 m): out ${b.out} · charge: out ${c.out}, ${c.dark} dark · old knobs (stunFixtureM ${D.CHAOS.loud.fixtureBlastM}, stunPanels on): out ${d.out}, ${d.dark} dark · stunPanels on alone: out ${e.out} after ${e.n} can(s), shaken ${e.shaken}` : `${a.why ?? b.why ?? c.why ?? d.why ?? e.why}`); }
  DESTRUCTION.on = false; return F.done();
}

// ================================================================ sight
export async function loudSight() {
  const F = family('loudchaos-sight: the AI sees through dust by the one rule it always did — one transmittance per sight line off the Sensors query — switch on or off');
  const G = await import(`${ROOT}/src/game/guards.ts`);
  const run = async (on: boolean) => {
    Math.random = seeded(4410); DESTRUCTION.on = on; const W: any = await quiet(() => standUp({ uploadEvery: 1 })); const game = W.game; game.godMode = true; game.tune.chaos = 0.5;
    const gd = game.guards[0]; for (let i = 1; i < game.guards.length; i++) { const o = game.guards[i]; o.hold = true; o.pinned = true; o.char.pos = [37.5, 0, 6 + i * 1.5]; o.flashlight.enabled = false; }
    gd.hold = true; gd.pinned = true; gd.char.pos = [14, 0, 14.5]; gd.char.bodyYaw = gd.char.aimYaw = Math.PI / 2; gd.char.update(0); gd.char.update(DT);
    game.teleportPlayer([19, 0, 14.5]); game.player.visibility = 1;
    const out: number[] = [];
    for (const T of [undefined, 1, 0.8, 0.55, 0.31, 0.29, 0.1]) {
      gd.awareness = 0; gd.state = 'patrol'; gd.smokeTrans = 1;
      game.probe.results.delete('smoke0'); if (T !== undefined) game.probe.results.set('smoke0', [T, T, T]);
      for (let f = 0; f < 3; f++) { game.player.visibility = 1; if (T !== undefined) game.probe.results.set('smoke0', [T, T, T]); W.step(DT); }
      out.push(+gd.smokeTrans.toFixed(3), G.canSee(game, gd).visible ? 1 : 0);
    }
    return out;
  };
  const a = await run(true), b = await run(false);
  const seen = (o: number[]) => o.filter((_, i) => i % 2 === 1).join(''), trans = (o: number[]) => o.filter((_, i) => i % 2 === 0).join(' ');
  F.verdict(JSON.stringify(a) === JSON.stringify(b) && seen(a) === '1111100', 'a guard five metres from a lit Sam, the segment answer planted at none / 1 / 0.8 / 0.55 / 0.31 / 0.29 / 0.1: he sees down to 0.31 and not under 0.3 — identically with the switch on and off', `smokeTrans ${trans(a)} · seen ${seen(a)} (on) / ${seen(b)} (off)`);
  // the harness's dust stand-in answers that same query: a cloud on the line dims it, a cloud behind a wall does not, no puff = no answer at all
  { Math.random = seeded(4411); DESTRUCTION.on = true; const W: any = await quiet(() => standUp({ uploadEvery: 1 })); const game = W.game; game.godMode = true; game.aiEnabled = false; game.tune.chaos = 0.5;
    const dust = installDustStandin(W); const a0: Vec3 = [14, 1.6, 14.5], b0: Vec3 = [19, 1.1, 14.5];
    game.sensors.segment('probeT', a0, b0); dust.tick(); W.step(DT); const none = game.sensors.read('probeT');
    for (let k = 0; k < 6; k++) { game.destr.dustPuff([16.5, 1.2, 14.2 + k * 0.1], [0, 0, 1], 1.5, 'drywall'); for (let f = 0; f < 8; f++) { dust.tick(); W.step(DT); } }
    game.sensors.segment('probeT', a0, b0); dust.tick(); W.step(DT); game.sensors.segment('probeT', a0, b0); dust.tick(); const thru = game.sensors.read('probeT');
    const wallA: Vec3 = [16.5, 1.4, 9.0], wallB: Vec3 = [16.5, 1.4, 11.0];   // (a line in the corridor, the far side of the cubicles' north wall from the cloud)
    const behind = dust.transmittance(wallA, wallB), blocked = game.col.solidBlocked([16.5, 1.2, 14.5], [16.5, 1.4, 10]);
    for (let f = 0; f < 60 * 50; f++) { dust.tick(); W.step(DT); } game.sensors.segment('probeT', a0, b0); dust.tick(); W.step(DT); game.sensors.segment('probeT', a0, b0); dust.tick(); const later = game.sensors.read('probeT');
    F.verdict(none === undefined && thru !== undefined && thru < 0.9 && (!blocked || behind === 1) && later === undefined, 'the dust stand-in: no puff → the query reads undefined (the bare harness); six puffs on the line → it dims; the corridor line behind the wall is untouched; fifty seconds on it has cleared', `before ${none} · through the cloud ${thru?.toFixed(3)} · behind the wall ${behind.toFixed(3)} (wall between: ${blocked}) · 50 s later ${later} · ${dust.stats.puffs} puffs`); }
  DESTRUCTION.on = false; return F.done();
}

// ================================================================ off
export async function loudOff() {
  const F = family('loudchaos-off: the switch off = destruction as it was — the office rectangle, the player-only fixture rule, no power, glass as it was, no new counter moving');
  { const S = await stage('warehouse.json', false, 4401, 0.5, true); const { W, game, smokeLog } = S; const fails: string[] = [];
    if (glassBreakLive(game)) fails.push('glass comes apart under a scenario');
    const t = game.targets.find((x: any) => !x.broken && x.interactive && x.kind === 'emissive' && (x.on || x.factor > 0));
    if (t) { game.destr.fixtureRound([t.pos[0], 1.2, t.pos[2]], [0, 1, 0], t.pos[1] - 1.2, t.boxes[0]); if (t.broken) fails.push('fixtureRound put a light out'); }
    const lit0 = game.targets.filter((x: any) => x.broken).length;
    if (t) game.destr.bang([t.pos[0], 0.06, t.pos[2]], NOBODY_ID, 4); W.step(DT);
    if (game.targets.filter((x: any) => x.broken).length !== lit0) fails.push('a blast put a light out');
    if (smokeLog.some(e => e.kind === 'puff' && e.pos[1] < 0.5)) fails.push('a blast raised floor dust');
    if (D.DESTR_STATS.fixtures || D.DESTR_STATS.fixturesRefused) fails.push('the fixture counters moved');
    F.verdict(!fails.length, 'warehouse, switch off, a scenario up: glass does not come apart, fixtureRound and a power-4 blast under a lit panel leave every light on, no floor dust', fails.join('; ') || `glassBreakLive ${glassBreakLive(game)}; fixtures ${D.DESTR_STATS.fixtures}`); }
  { const S = await stage('warehouse.json', true); const { game } = S;
    const live = glassBreakLive(game);
    F.verdict(!live, 'switch on, a scenario up: glass is left exactly as the base has it (its own goal owns it) — the destruction switch does not make a pane come apart', `glassBreakLive ${live} with tune.glassBreak ${!!game.tune.glassBreak}`); }
  { // the switch on but NO scenario up (the plain night floor): the loud rules stay down — heat as tuned, the player-only fixture rule, no power
    const S = await stage('warehouse.json', true, 4401, 0.5, false); const { W, game, smokeLog } = S; const fails: string[] = [];
    if (D.loudNow(game)) fails.push('loudNow without a scenario'); if (glassBreakLive(game)) fails.push('glass comes apart');
    const t = game.targets.find((x: any) => !x.broken && x.interactive && x.kind === 'emissive' && (x.on || x.factor > 0));
    if (t) { game.destr.fixtureRound([t.pos[0], 1.2, t.pos[2]], [0, 1, 0], t.pos[1] - 1.2, t.boxes[0]); game.destr.bang([t.pos[0], 0.06, t.pos[2]], NOBODY_ID, 4); for (let f = 0; f < 30; f++) W.step(DT); if (t.broken) fails.push('a light went out'); }
    if (smokeLog.some(e => e.kind === 'puff' && e.pos[1] < 0.5)) fails.push('a blast raised floor dust');
    const p: Vec3 = [20, 1.2, 14]; const e0 = game.destr.escalationAt(p); game.destr.round(game.player.char, p, [1, 0, 0], { kind: 'static', index: 0, n: [-1, 0, 0] } as any, WEAPONS.fn2000); const e1 = game.destr.escalationAt(p);
    if (Math.abs((e1 - e0) - 2 * 0.5) > 0.05) fails.push(`one round raised the escalation by ${f2(e1 - e0)}, the office's own is 1.00 at chaos 0.5`);
    F.verdict(!fails.length, 'warehouse, switch on, NO scenario: loudNow false — a round stokes the office\'s heat (E +1.00 at chaos 0.5), fixtureRound and a power-4 blast leave the lights, no floor dust, glass whole', fails.join('; ') || `E ${f2(e0)} → ${f2(e1)}`); }
  DESTRUCTION.on = false; return F.done();
}

// ================================================================ base
/** The switch off digests as the one build: seeded playthroughs with PT_DESTR=0 fold to the digests frozen from e6188f6 (the fixture's own provenance line says how). */
export async function loudBase() {
  const F = family('loudchaos-base: the switch off, seeded playthroughs digest as the one build (e6188f6) did');
  const fx = resolve(ROOT, 'tools/qa/fixtures/loudchaos-base-digests.json');
  if (!existsSync(fx)) { F.verdict(false, 'the frozen digests', `${fx} is missing`); return F.done(); }
  const base = JSON.parse(readFileSync(fx, 'utf8')) as { commit: string; runs: Record<string, { digest: string; end: string; t: number }> };
  const ALL = process.argv.includes('--all-digests'); const keys = Object.keys(base.runs).filter(k => ALL || k.endsWith(':1')).filter(k => ALL || /^(warehouse-four|compound-four|barracks-four|block-squads):/.test(k));
  const out = resolve(ROOT, `.loudchaos-base-${process.pid}.json`);
  const scn = [...new Set(keys.map(k => k.split(':')[0]))].join(','), seeds = [...new Set(keys.map(k => k.split(':')[1]))].join(',');
  const pr = Bun.spawn(['bun', 'run', resolve(ROOT, 'tools/qa/playthrough.ts'), '--scn', scn, '--seeds', seeds, '--jobs', '4', '--json', out], { env: { ...process.env, PT_DESTR: '0', PT_DIGEST: '1' }, stdout: 'ignore', stderr: 'pipe' });
  const code = await pr.exited; const err = await new Response(pr.stderr).text();
  if (code !== 0 && !existsSync(out)) { F.verdict(false, 'the playthroughs ran', `exit ${code}: ${err.slice(0, 300)}`); return F.done(); }
  const got = JSON.parse(readFileSync(out, 'utf8')); (await import('node:fs')).unlinkSync(out);
  const runs: any[] = got.runs ?? got; const bad: string[] = []; let n = 0;
  for (const r of runs) { const k = `${r.scn}:${r.seed}`; const b = base.runs[k]; if (!b) continue; n++; if (r.digest !== b.digest) bad.push(`${k}: ${r.digest} ≠ ${b.digest} (ended ${r.end} at ${r.t} vs ${b.end} at ${b.t})`); }
  F.verdict(n >= keys.length && !bad.length, `${n} seeded playthroughs with PT_DESTR=0 (${scn}; seeds ${seeds}) against the digests frozen from ${base.commit}`, bad.join('; ') || 'every run folds to the same word, half second by half second (game/digest.ts)');
  return F.done();
}
