// THE NEW GLASS, LEVEL BY LEVEL (rebuild/glass/build.md) — does the glass the page ships with really come alive on every scenario the mission list offers, with no
// flag, and does the one switch take all of it back out? Per scenario: the game stood up as playthrough.ts stands it, the glass switches left AS SHIPPED (this file
// says GLASSPARTS=shipped to the harness's stand-up before anything loads: src/host/standup.ts then touches none of them, and the master switch is whatever the
// module ships — a GLASSFX in the caller's environment is dropped, it would make that line true by construction), chaos at the page's own default, the scenario
// started through the page's own start (game/scenarioRun.ts startFromQuery). Then, for one pane of each kind the level holds: one rifle round, a burst, and what
// the three models say — the fracture's record of the pane, rounds counted through it, fragments handed to the falling-glass model. Then the same shots with the
// master switch off (as the page has it under ?glassfx=0: the parts still on): nothing may be live, no pane may hold a record, no round may cross.
//
//   bun run tools/qa/glass-levels.ts [--scn id,id]        exit 0 = every level PASS, 1 = a FAIL line, 2 = an unknown scenario id (the known ones listed; nothing ran)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
delete process.env.GLASSFX; process.env.GLASSPARTS = 'shipped';
const { standUp, ROOT, fake } = await import('./headless.ts');
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const PM = await import(`${ROOT}/src/render/particles.ts`);
const { GLASSFX } = await import(`${ROOT}/src/game/glass.ts`);
const { GB_STATS, glassBreakLive } = await import(`${ROOT}/src/game/glassbreak.ts`);
const { GLASSPEN, GLASSPEN_STATS, glassPenLive } = await import(`${ROOT}/src/game/glasspen.ts`);
const { SHARD_STATS, shardsLive } = await import(`${ROOT}/src/game/shards.ts`);
const { CHAOS } = await import(`${ROOT}/src/game/destruction.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60, FX_SHIPPED: boolean = GLASSFX.on;   // (the master switch as the module ships it: nothing has written it yet)
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
const zero = (o: Record<string, number>) => { for (const k of Object.keys(o)) o[k] = 0; };

let allOk = true;
const verdict = (ok: boolean, label: string, detail: string) => { allOk &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

/** one scenario stood up and started as the page would, the glass parts as shipped; `fx` = the master switch for this pass */
async function stage(E: any, fx: boolean) {
  Math.random = seeded(4242);
  const W: any = await quiet(() => standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) })); const g = W.game, engine = W.engine;
  engine.particles = new PM.Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  const shipped = { glassBreak: g.tune.glassBreak, glassShards: g.tune.glassShards, pen: GLASSPEN.on, fx: FX_SHIPPED };   // (what the stand-up left: the page's own defaults)
  g.tune.chaos = CHAOS.def; g.godMode = true; GLASSFX.on = fx;
  const { why } = await quiet(() => startFromQuery(g, new URLSearchParams(scenarioQuery(E) as string))); if (why) throw new Error(`start refused — ${why}`);
  zero(GB_STATS); zero(GLASSPEN_STATS); zero(SHARD_STATS);
  const step = (n = 1) => { for (let i = 0; i < n; i++) { W.step(DT); engine.particles.pending.length = 0; } };
  await quiet(() => step(5));
  return { W, g, engine, step, shipped };
}
/** one sheet of each kind the fracture model names in this level, with the side a shooter has a clear look at it from */
function panesOf(g: any, engine: any) {
  const out: { bi: number; kind: string; cands: { from: Vec3; aim: Vec3 }[] }[] = [], seen = new Set<string>();
  for (const bi of engine.world.glassStatics as number[]) {
    const kind = g.glassBreak.typeOfPane(bi); if (!kind || seen.has(kind)) continue;
    const b = g.level.boxes[bi], wide = b.h[0] >= b.h[2] ? 0 : 2, cs = Math.cos(b.yaw ?? 0), sn = Math.sin(b.yaw ?? 0);
    const nrm: Vec3 = wide === 0 ? [sn, 0, cs] : [cs, 0, -sn], tan: Vec3 = wide === 0 ? [cs, 0, -sn] : [sn, 0, cs], hu = wide === 0 ? b.h[0] : b.h[2];
    const cands: { from: Vec3; aim: Vec3 }[] = [];
    for (const u of [0.45, -0.45, 0.2, -0.2, 0]) for (const s of [1, -1]) {   // (off the sheet's middle first: a window's mullion stands there)
      const mid = v3.mad(b.c, tan, u * hu) as Vec3, from = v3.mad([mid[0], 0, mid[2]], nrm, 1.7 * s) as Vec3, eye: Vec3 = [from[0], 1.4, from[2]];
      if (g.col.solidBlocked([from[0], 0.3, from[2]], [from[0], 1.7, from[2]])) continue;   // (the spot is inside something)
      if ([-0.4, -0.2, 0, 0.2, 0.4].some(o => { const e = v3.mad(eye, tan, o) as Vec3, hit = g.col.raycast(e, v3.normalize(v3.sub(mid, e)), 4); return !hit || hit.index !== bi; })) continue;   // (something else is met first from here, or from where his gun hangs a hand to either side: a mullion, a frame)
      cands.push({ from, aim: v3.mad(mid, v3.normalize(v3.sub(mid, eye)), 0.5) as Vec3 });   // (half a metre on along the line from his shoulder through that point of the sheet: a high transom is met where it was aimed at)
    }
    if (cands.length) { out.push({ bi, kind, cands }); seen.add(kind); }
  }
  return out;
}
function shootAll(S: Awaited<ReturnType<typeof stage>>, rounds: number) {
  const { g, engine, step } = S, res: any[] = [];
  for (const P of panesOf(g, engine)) {
    // the first spot from which the SHOULDERED rifle's own muzzle has a clear line to the sheet (a gun still on its way up fires from half a metre to the side; a mullion or a frame may stand in that line)
    let X: { bi: number; kind: string; from: Vec3; aim: Vec3 } | null = null, met = -1;
    for (const C of P.cands) {
      g.puppet = null; g.teleportPlayer(C.from); const yaw = Math.atan2(C.aim[0] - C.from[0], C.aim[2] - C.from[2]); g.player.char.bodyYaw = g.player.char.aimYaw = yaw; g.player.slot = 'rifle'; g.player.holstered = false; g.player.crouch = false; for (let i = 0; i < 40; i++) { S.W.cursorAt(C.aim); step(1); }   // (facing the sheet, the cursor on it: the rifle comes up onto the pane)
      const mz = g.player.char.muzzle as Vec3, h = g.col.raycast(mz, v3.normalize(v3.sub(C.aim, mz)), 6); if (h && h.index === P.bi) { X = { bi: P.bi, kind: P.kind, ...C }; break; } met = h ? h.index : -1;
    }
    if (!X) { res.push({ bi: P.bi, kind: P.kind, blocked: met }); continue; }
    const c0 = GLASSPEN_STATS.crossed, f0 = SHARD_STATS.fragments;
    const fire = (k: number) => { const j = (k % 5) - 2; fireWeapon(g, g.player.char, [X.aim[0], X.aim[1] + j * 0.04, X.aim[2]] as Vec3, true, { weapon: (WEAPONS as any).fn2000 }); const fa = g.player.firearm; if (fa) { fa.chamber = 1; fa.mag = Math.max(fa.mag ?? 0, 5); fa.cool = 0; } };
    fire(0); step(60); const one = g.glassBreak.paneInfo(X.bi), rec1 = g.glassBreak.panes.has(X.bi);
    for (let k = 1; k < rounds; k++) { fire(k); step(6); } step(120);
    res.push({ ...X, one, rec1, after: g.glassBreak.paneInfo(X.bi), rec: g.glassBreak.panes.has(X.bi), crossed: GLASSPEN_STATS.crossed - c0, fragments: SHARD_STATS.fragments - f0 });
  }
  return res;
}

const only = (() => { const i = process.argv.indexOf('--scn'); return i > 0 ? (process.argv[i + 1] ?? '').split(',').filter(Boolean) : null; })();
{ const known = (SCENARIOS as any[]).map(E => E.id as string), bad = only ? only.filter(id => !known.includes(id)) : [];
  if (only && (!only.length || bad.length)) { console.error(`glass-levels: ${only.length ? `unknown scenario ${bad.join(', ')}` : '--scn wants an id'} — known: ${known.join(', ')}`); process.exit(2); } }
const rnd = Math.random, byLevel = new Map<string, any>();
for (const E of SCENARIOS as any[]) { if (only && !only.includes(E.id)) continue; if (!byLevel.has(E.level ?? 'office.json')) byLevel.set(E.level ?? 'office.json', E); }   // (one scenario a level: the glass is the level's)
for (const [file, E] of byLevel) {
  console.log(`\n=== glass-levels ${file} (${E.id}) ===`);
  try {
    // ---- as shipped
    const S = await stage(E, FX_SHIPPED), { g, engine } = S;
    const sheets = (engine.world.glassStatics as number[]).map(bi => g.glassBreak.typeOfPane(bi)).filter(Boolean) as string[], n = (k: string) => sheets.filter(x => x === k).length;
    console.log(`  panes: ${engine.world.glassStatics.length} (${n('annealed')} float, ${n('tempered')} toughened, ${n('laminated')} laminated${engine.world.glassStatics.length - sheets.length ? `, ${engine.world.glassStatics.length - sheets.length} solid` : ''}) · chaos ${g.tune.chaos} · touring ${g.touring}`);
    verdict(S.shipped.fx && S.shipped.glassBreak === true && S.shipped.glassShards !== false && S.shipped.pen, 'the parts are on as shipped', `GLASSFX ${S.shipped.fx} · tune.glassBreak ${S.shipped.glassBreak} · tune.glassShards ${S.shipped.glassShards} · GLASSPEN.on ${S.shipped.pen} · CHAOS.def ${CHAOS.def}`);
    verdict(glassBreakLive(g) && glassPenLive(g) && shardsLive(g), 'all three are live once the scenario has started', `fracture ${glassBreakLive(g)} · rounds through ${glassPenLive(g)} · falling glass ${shardsLive(g)}`);
    const R = await quiet(() => shootAll(S, 12));
    if (!sheets.length) console.log('  (no sheet glass in this level: nothing to shoot)');
    else if (!R.length) verdict(false, 'a pane can be shot', 'no pane with a clear spot 1.7 m off either face');
    for (const r of R) {
      if (r.blocked !== undefined) { verdict(false, `${r.kind} pane ${r.bi}: a clear line from the muzzle`, `static ${r.blocked} is met first`); continue; }
      const a = r.after, o = r.one;
      const ok = r.rec && (r.kind === 'laminated' ? a.sites > 0 && a.openFraction === 0 : r.kind === 'tempered' ? (o.gone || o.openFraction > 0.5) : a.sites > 0 && a.openFraction > 0) && r.crossed > 0 && (r.kind === 'laminated' || r.fragments > 0);   // (toughened: the whole sheet dices on the first round; float: the burst opens it; laminated: a web that never opens)
      verdict(ok, `${r.kind} pane ${r.bi}: one rifle round, then twelve`, `after one: open ${o.openFraction.toFixed(2)} gone ${o.gone} sites ${o.sites} · after twelve: open ${a.openFraction.toFixed(2)} walkable ${a.walkable} sites ${a.sites} · rounds through ${r.crossed} · fragments to the falling-glass model ${r.fragments}`);
    }
    // ---- the master switch off, the parts still on (the page under ?glassfx=0)
    const O = await stage(E, false);
    const live = glassBreakLive(O.g) || glassPenLive(O.g) || shardsLive(O.g);
    const RO = await quiet(() => shootAll(O, 12));
    const touched = RO.filter(r => r.blocked === undefined && (r.rec || r.crossed > 0 || r.fragments > 0 || (r.after && (r.after.sites > 0 || r.after.openFraction > 0))));
    verdict(!live && !touched.length && O.g.glassBreak.panes.size === 0 && Object.values(GB_STATS).every(v => v === 0) && GLASSPEN_STATS.crossed === 0 && SHARD_STATS.fragments === 0, 'switch off: nothing is live and the same shots leave every pane whole', `live ${live} · panes with a record ${O.g.glassBreak.panes.size} · fracture counters ${Object.values(GB_STATS).reduce((s: number, v: any) => s + v, 0)} · rounds through ${GLASSPEN_STATS.crossed} · fragments ${SHARD_STATS.fragments} · panes shot ${RO.length}`);
  } catch (e) { verdict(false, 'the level stands up and starts', (e as Error).stack?.split('\n').slice(0, 3).join(' / ') ?? String(e)); }
  finally { GLASSFX.on = FX_SHIPPED; Math.random = rnd; }
}
console.log(`\n=== glass-levels: ${allOk ? 'ALL PASS' : 'FAIL'} ===`);
process.exit(allOk ? 0 : 1);
