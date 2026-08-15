// GLASS BREAKING probes (game/glassbreak.ts, docs/internal/glassbreak.md) — `bun run tools/qa/probes.ts glassbreak` (the family; every probe also answers to its own name and,
// but for the two long ones, runs under `glass`):
//   glassbreak-off          the switch OFF = the game byte for byte: a seeded corridor volley into the conference glazing + a charge beside it at chaos 0.5 digests identically with
//                           tune.glassBreak false and with the module's three hooks pulled out altogether (rounds, events, audio, particle records, decals, statics' flags); its counters stay 0
//   glassbreak-gate         nothing at chaos 0, nothing under the tour, nothing with the switch off; the same stimuli register at chaos 0.5 with it on
//   glassbreak-frozen       a holed pane's site set is FROZEN: a hit beside the hole / a charge near it add no site and close no point that was open; the cell table's site rows stay;
//                           a through-hole round files nothing; an unholed pane still gains a site per impact (the physics lane's probe, on the localised cells)
//   glassbreak-open         ONE MODEL: openAt (the CPU rule) ≡ what raycast / solidBlocked do through the pane ≡ the nearest-site rule run over the very rows handed to the GPU (common.wgsl gbCell)
//   glassbreak-walk         the movement rule: a pane pushes a walker's circle out until every cell below 1.9 m has gone (a diced frontage pane), then lets it through; solidBlocked agrees; the nav grid is untouched
//   glassbreak-caps         ≤ 16 sites a pane, ≤ shardsPerFrame (+ the per-cell overshoot) rigid spawns a frame, the debris pool never over its cap however many panes a charge takes, refusals counted
//   glassbreak-reset        reset() / a restart: every pane whole (openAt false everywhere, walkable false), the gust sources out of the wind, the shards gone with the debris; levelFingerprint untouched by holes
//   glassbreak-gust         a diced EXTERIOR pane in the storm registers one 'glass' wind source whose base follows the storm × the open share; an interior pane never does
//   glassbreak-determinism  the same seeded volley + charge twice → identical pane records (sites, energies, dropped masks), debris rest poses, events, particle records, log
import { standUp, ROOT, fake } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const { Particles } = await import(`${ROOT}/src/render/particles.ts`);
const GBM = await import(`${ROOT}/src/game/glassbreak.ts`);
const { levelFingerprint } = await import(`${ROOT}/src/game/savestate.ts`);
const { BoxFlag, GB_STRIDE } = await import(`${ROOT}/src/scene/boxes.ts`);
const { GLASSBREAK, GB_STATS } = GBM;

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2);
const p2 = (p: Vec3) => `(${f2(p[0])}, ${f2(p[1])}, ${f2(p[2])})`;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { const ok = all; console.log(`=== ${title.split(':')[0]}: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) process.exitCode = 1; return ok; } };
}
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; gd.flashlight.enabled = false; }
const resetStats = () => { for (const k of Object.keys(GB_STATS)) (GB_STATS as any)[k] = 0; };
function newEvents(game: any, seen: WeakSet<any>): any[] { const out: any[] = []; for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); out.push(e); } return out; }

// pane 110 = the conference partition's second sheet: c (7.5, 1.5, 10), h (0.5, 1, 0.006), yaw 0 → annealed; u = x − 7.5, v = y − 1.5. Sam stands in the corridor south of it.
const PANE = 110; const FAR = 114;
const W_ = (u: number, v: number): Vec3 => [7.5 + u, 1.5 + v, 10];
const SAM: Vec3 = [8.3, 0, 11.6];

/** The harness Game with a Particles attached, everyone parked deaf and blind on the lot, god mode, Sam in the corridor facing the glazing, chaos + the switch as given. */
async function stage(seed: number, chaos: number, on: boolean, at: Vec3 = SAM, yaw = Math.PI) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game, engine } = W;
  engine.particles = new Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  game.godMode = true; game.player.visibility = 0.02; game.tune.chaos = chaos; game.tune.glassBreak = on; resetStats();
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => park(gd, i));
  game.teleportPlayer(at); game.player.char.bodyYaw = game.player.char.aimYaw = yaw; game.player.slot = 'rifle'; game.player.holstered = false; game.player.crouch = false;
  W.step(DT); W.step(DT);
  const P = engine.particles;
  const flush = () => { const q = P.pending.map((e: any) => `${e.kind}:${e.count}:${e.pos.map((x: number) => x.toFixed(2)).join(',')}:${e.seed}`); P.pending.length = 0; P.pendingImpulses.length = 0; return q; };
  return { W, game, engine, P, flush };
}
/** the volley: 30 rounds walked over panes 109‥111 from the corridor (some spots twice), then a stun charge's bang event beside pane 112 — 8 s in all */
const VOLLEY: Vec3[] = [[7.4, 1.3, 10], [7.42, 1.31, 10], [6.3, 1.0, 10], [7.9, 0.7, 10], [8.8, 1.5, 10], [6.6, 1.6, 10], [7.1, 0.5, 10], [8.9, 1.52, 10], [9.3, 0.9, 10], [7.6, 1.9, 10]];
async function recordVolley(seed: number, on: boolean, cut = false) {
  const S = await stage(seed, 0.5, on); const { W, game, engine, flush } = S;
  if (cut) { game.col.glassOpen = null; game.col.glassWalkable = null; engine.world.glassCellFill = null; game.glassBreak = { hit() {}, blast() {}, update() {}, reset() {}, openAt() { return false; }, walkable() { return false; }, panes: new Map() } as any; }   // the module OUT: its three seams null (collision / boxes as before the port), a stub where glass.ts / game.ts call it
  const audio: string[] = []; W.audioLog = [];
  const rounds: string[] = []; const events: string[] = []; const emits: string[] = []; const seen = new WeakSet<any>();
  for (let f = 0; f < 60 * 8; f++) {
    if (f < 300 && f % 10 === 0) { const p = VOLLEY[(f / 10) % VOLLEY.length]; const r = fireWeapon(game, game.player.char, p, true, { weapon: WEAPONS.fn2000 }); rounds.push(`${f}:${r?.hit ?? ''}:${p2(r?.point ?? r?.hitP ?? [0, 0, 0])}`); }
    if (f === 330) game.events.push({ kind: 'bang', pos: [10.2, 0.4, 10.9], time: game.time, loud: true, who: 0 });   // (the bang EVENT is what glass.ts / glassbreak read; detonateStun's flash and destruction are not the question here)
    W.step(DT);
    emits.push(...flush().map((s: string) => `${f}:${s}`));
    for (const e of newEvents(game, seen)) events.push(`${e.kind}@${f}:${e.level ?? ''}:${e.pos ? p2(e.pos) : ''}`);
  }
  for (const a of W.audioLog!) audio.push(`${a.name}@${a.t.toFixed(3)}:${a.pos ? p2(a.pos) : ''}`);
  const decals = game.decals.list.map((d: any) => `${d.kind}:${p2(d.pos)}:${d.param.toFixed(3)}`).join('|');
  const props = game.props.list ? game.props.list.map((p: any) => p2(p.body?.pos ?? p.pos ?? [0, 0, 0])).join('|') : String(game.props);
  const flags = game.level.boxes.map((b: any) => b.flags).join(',');
  const debris = game.destr.debris.list.map((c: any) => `${c.kind}:${p2(c.box.c)}:${c.rest}`).join('|');
  const panes = [...(game.glassBreak.panes?.values?.() ?? [])].map((st: any) => `${st.bi}:${st.type}:${st.hits}:${st.dropped}:${st.impacts.map((p: any) => `${p.u.toFixed(4)},${p.v.toFixed(4)},${p.e.toFixed(3)}`).join(';')}`).join('|');
  return { rounds, events, audio, emits, decals, props, flags, debris, panes, log: [...game.glassBreak.log ?? []], stats: { ...GB_STATS }, sam: p2(game.player.char.pos) };
}
function diffLists(a: any, b: any, keys: string[], fails: string[]) {
  for (const k of keys) { const x = a[k], y = b[k]; if (Array.isArray(x)) { if (JSON.stringify(x) !== JSON.stringify(y)) { let i = 0; while (i < Math.min(x.length, y.length) && x[i] === y[i]) i++; fails.push(`${k} differ (${x.length} / ${y.length}) from #${i}: ${x[i] ?? '∅'} | ${y[i] ?? '∅'}`); } } else if (x !== y) fails.push(`${k} differ`); }
}

// ================================================================ off = the game as it was
export async function glassbreakOff() {
  const F = family('glassbreak-off: with the switch OFF a seeded volley into the glazing + a charge beside it is byte for byte the game with the module\'s seams pulled out');
  const off = await recordVolley(9101, false), cut = await recordVolley(9101, false, true);
  const fails: string[] = []; diffLists(off, cut, ['rounds', 'events', 'audio', 'emits', 'decals', 'props', 'flags', 'debris'], fails);
  if (Object.values(off.stats).some(v => v !== 0) || off.panes) fails.push(`the module counted something with the switch off: ${JSON.stringify(off.stats)} panes '${off.panes}'`);
  const glassEv = off.events.filter(e => e.startsWith('glass@')).length;
  if (off.rounds.length < 30 || glassEv < 20) fails.push(`staging: ${off.rounds.length} rounds, ${glassEv} glass events`);
  F.verdict(!fails.length, `${off.rounds.length} rounds, ${off.events.length} events (${glassEv} glass), ${off.audio.length} audio calls, ${off.emits.length} particle records, ${off.decals.split('|').length} marks, the furniture, the debris and every static's flags identical; counters zero, no pane record`, fails.join('; ') || 'identical');
  const on = await recordVolley(9101, true);
  const took = on.stats.dropped > 0 && on.panes.length > 0;
  F.verdict(took, 'the same volley with the switch ON does take cells out (the probe\'s stimuli reach the module)', `stats ${JSON.stringify(on.stats)}`);
  return F.done();
}

// ================================================================ the gate
export async function glassbreakGate() {
  const F = family('glassbreak-gate: chaos 0, the tour and the switch each make hit / blast inert; chaos 0.5 with the switch on registers');
  const { game } = await stage(9102, 0.5, true); const gb = game.glassBreak;
  const g0 = { ...GB_STATS };
  const poke = () => { gb.hit(PANE, W_(0.1, 0.1), [0, 0, -1], 1); gb.blast([7.5, 0.6, 10.8], 1); };
  const quiet = () => gb.panes.size === 0 && GB_STATS.impacts === g0.impacts && GB_STATS.blasts === g0.blasts;
  game.tune.chaos = 0; poke();
  F.verdict(quiet(), 'chaos 0: hit / blast do nothing', `panes ${gb.panes.size} impacts +${GB_STATS.impacts - g0.impacts} blasts +${GB_STATS.blasts - g0.blasts}`);
  game.tune.chaos = 0.5; game.touring = true; poke();
  F.verdict(quiet(), 'under the tour at chaos 0.5: nothing', `panes ${gb.panes.size}`);
  game.touring = false; game.tune.glassBreak = false; poke();
  F.verdict(quiet(), 'the switch off at chaos 0.5: nothing', `panes ${gb.panes.size} live ${GBM.glassBreakLive(game)}`);
  game.tune.glassBreak = true; gb.hit(PANE, W_(0.1, 0.1), [0, 0, -1], 1);
  F.verdict(gb.panes.size === 1 && GB_STATS.impacts === g0.impacts + 1 && GBM.glassBreakLive(game), 'chaos 0.5, switch on, no tour: the same hit registers', `panes ${gb.panes.size} impacts +${GB_STATS.impacts - g0.impacts}`);
  return F.done();
}

// ================================================================ frozen sites (the physics lane's probe, on the localised cells)
export async function glassbreakFrozen() {
  const F = family('glassbreak-frozen: a holed pane\'s site set is frozen — later impacts merge into the cell they land in, holes only grow');
  const { W, game, engine } = await stage(9103, 0.5, true); const gb = game.glassBreak;
  gb.hit(PANE, W_(-0.3, -0.5), [0, 0, -1], 1); gb.hit(PANE, W_(0.3, -0.5), [0, 0, -1], 1); gb.hit(PANE, W_(0, 0.5), [0, 0, -1], 1);   // A, B, C: the third takes the pane to failHits → C's cell (localised: crack tips seeded round it) falls a think later
  for (let i = 0; i < 40; i++) W.step(DT);
  const st = gb.panes.get(PANE)!;
  F.verdict(!!st && st.dropped === 0b100 && st.impacts.length >= 3 + 4, 'three impacts: the third drops its own (localised) cell and only that', `impacts ${st?.impacts.length} (3 + ${(st?.impacts.length ?? 3) - 3} crack tips) dropped mask ${st?.dropped.toString(2)} open ${Math.round(100 * gb.openFraction(PANE))}% shards ${GB_STATS.shards}`);
  const grid: [number, number][] = []; for (let u = -0.48; u <= 0.48; u += 0.025) for (let v = -0.98; v <= 0.98; v += 0.025) grid.push([u, v]);
  const openBefore = grid.map(([u, v]) => gb.openAt(PANE, W_(u, v))); const nOpen0 = openBefore.filter(Boolean).length;
  const rows0 = new Float32Array(GB_STRIDE * 4); engine.world.glassCellFill(PANE, rows0, 0); const n0 = st.impacts.length;
  const hits0 = st.hits, dmg0 = st.damage, imp0 = GB_STATS.impacts;
  gb.hit(PANE, W_(0, 0.55), [0, 0, -1], 1);
  F.verdict(gb.openAt(PANE, W_(0, 0.55)) && st.hits === hits0 && st.damage === dmg0 && GB_STATS.impacts === imp0 && st.impacts.length === n0, 'a round through the open cell files nothing', `openAt(0, 0.55) ${gb.openAt(PANE, W_(0, 0.55))}; hits ${hits0} → ${st.hits}, damage ${dmg0.toFixed(2)} → ${st.damage.toFixed(2)}, impacts stat ${imp0} → ${GB_STATS.impacts}`);
  F.verdict(!gb.openAt(PANE, W_(0, -0.10)) && gb.openAt(PANE, W_(0, 0.5)), 'the test points sit where claimed (v −0.10 intact, v 0.5 open)', `openAt(0,−0.10) ${gb.openAt(PANE, W_(0, -0.10))} openAt(0,0.5) ${gb.openAt(PANE, W_(0, 0.5))}`);
  gb.hit(PANE, W_(0, -0.10), [0, 0, -1], 1);
  const closedNow = grid.filter(([u, v], k) => openBefore[k] && !gb.openAt(PANE, W_(u, v)));
  F.verdict(st.impacts.length === n0 && closedNow.length === 0, 'a hit beside the hole adds no site and closes nothing (same frame)', `impacts ${st.impacts.length}, open points ${nOpen0} before, closed again ${closedNow.length}${closedNow.length ? ' e.g. ' + closedNow.slice(0, 3).map(p => p.map(x => x.toFixed(2)).join(',')).join(' ') : ''}`);
  const rows1 = new Float32Array(GB_STRIDE * 4); engine.world.glassCellFill(PANE, rows1, 0);
  let same = rows1[0] === rows0[0]; for (let i = 8; i < 40; i++) same &&= rows1[i] === rows0[i];
  F.verdict(same, 'the GPU cell table keeps its site count and site rows', `n ${rows0[0]} → ${rows1[0]}, dropped mask ${rows0[1]} → ${rows1[1]}`);
  for (let i = 0; i < 40; i++) W.step(DT);
  const closedLater = grid.filter(([u, v], k) => openBefore[k] && !gb.openAt(PANE, W_(u, v)));
  F.verdict(closedLater.length === 0 && st.impacts.length === n0, 'nothing that was open has closed a think later (more may have opened)', `closed ${closedLater.length}, dropped mask now ${st.dropped.toString(2)}, open ${Math.round(100 * gb.openFraction(PANE))}%`);
  const openMid = grid.map(([u, v]) => gb.openAt(PANE, W_(u, v)));
  gb.blast([7.5, 0.6, 11.2], 1); for (let i = 0; i < 40; i++) W.step(DT);
  const closedByBlast = grid.filter(([u, v], k) => openMid[k] && !gb.openAt(PANE, W_(u, v)));
  F.verdict(st.impacts.length === n0 && closedByBlast.length === 0, 'a charge beside the holed pane adds no site and closes nothing', `impacts ${st.impacts.length}, closed ${closedByBlast.length}, dropped mask ${st.dropped.toString(2)}, blasts ${GB_STATS.blasts}`);
  const fc = game.level.boxes[FAR].c as Vec3;
  F.verdict(!gb.panes.get(FAR), 'the far pane (out of the charge\'s reach) has no record at all', `pane ${FAR} at x ${fc[0]}: ${gb.panes.get(FAR) ? 'has a record' : 'none'}`);
  gb.hit(FAR, [fc[0] - 0.2, 1.2, fc[2]], [0, 0, -1], 1); gb.hit(FAR, [fc[0] + 0.2, 1.9, fc[2]], [0, 0, -1], 1);
  const st2 = gb.panes.get(FAR);
  F.verdict(!!st2 && st2.impacts.length === 2 && st2.dropped === 0, 'an intact pane still gains a site per distinct impact', `pane ${FAR} impacts ${st2?.impacts.length} dropped ${st2?.dropped}`);
  return F.done();
}

// ================================================================ one model: openAt ≡ raycast / solidBlocked ≡ the GPU table's rule
/** the nearest-site rule common.wgsl gbCell runs, over the rows fill() hands the GPU (row 0 = n / mask / uAxis / damage, sites from float 8 two a row) */
function tableOpen(rows: Float32Array, u: number, v: number): boolean {
  const n = Math.min(16, Math.round(rows[0])); if (!n || rows[1] < 0.5) return false;
  let best = -1, bd = Infinity; for (let i = 0; i < n; i++) { const du = rows[8 + i * 2] - u, dv = rows[9 + i * 2] - v; const d = du * du + dv * dv; if (d < bd) { bd = d; best = i; } }
  return ((Math.round(rows[1]) >>> best) & 1) === 1;
}
export async function glassbreakOpen() {
  const F = family('glassbreak-open: the CPU open-cell rule, the collision queries through the pane and the GPU table\'s rule agree point for point');
  const { W, game, engine } = await stage(9104, 0.5, true); const gb = game.glassBreak;
  for (const [u, v] of [[-0.25, -0.2], [0.2, 0.3], [0.05, -0.6], [-0.1, 0.7], [0.3, -0.7]]) { gb.hit(PANE, W_(u, v), [0, 0, -1], 1); }
  for (let i = 0; i < 60; i++) W.step(DT);
  gb.hit(PANE, W_(-0.25, -0.2), [0, 0, -1], 1); gb.hit(PANE, W_(0.3, -0.7), [0, 0, -1], 1); for (let i = 0; i < 60; i++) W.step(DT);   // two more cells by hits on a holed pane
  const st = gb.panes.get(PANE)!; const rows = new Float32Array(GB_STRIDE * 4); engine.world.glassCellFill(PANE, rows, 0);
  let nOpen = 0, rayMis = 0, segMis = 0, tabMis = 0, n = 0, framed = 0; const ex: string[] = [];
  for (let u = -0.47; u <= 0.47; u += 0.031) for (let v = -0.97; v <= 0.97; v += 0.043) {
    const a: Vec3 = [7.5 + u, 1.5 + v, 10.3], b: Vec3 = [7.5 + u, 1.5 + v, 9.94];   // square through the pane from the corridor side, ending just inside the room (the room's blinds hang 9 cm behind the glass at its west end)
    const hit = game.col.raycast(a, [0, 0, -1], 0.36);
    if (hit && hit.index !== PANE && hit.t < 0.29) { framed++; continue; }           // the mullion / sill / header stands nearer than the sheet here: not a point ON the glass
    n++; const open = gb.openAt(PANE, W_(u, v)); if (open) nOpen++;
    const rayOpen = !(hit && hit.index === PANE);
    const segOpen = !game.col.solidBlocked(a, b);
    const tab = tableOpen(rows, u, v);
    if (rayOpen !== open) { rayMis++; if (ex.length < 3) ex.push(`ray (${f2(u)},${f2(v)}) open ${open} hit ${hit?.index}`); }
    if (segOpen !== open) { segMis++; if (ex.length < 6) ex.push(`seg (${f2(u)},${f2(v)}) open ${open}`); }
    if (tab !== open) { tabMis++; if (ex.length < 3) ex.push(`table (${f2(u)},${f2(v)}) open ${open}`); }
  }
  F.verdict(st.dropped !== 0 && nOpen > 20 && nOpen < n - 20, 'staging: a pane with several cells out and most of it standing', `dropped mask ${st.dropped.toString(2)}, ${nOpen} of ${n} grid points on the glass open (${framed} behind the frame skipped), ${st.impacts.length} sites`);
  F.verdict(rayMis === 0, 'raycast square through the pane stops in it exactly where openAt says glass, flies on exactly where it says hole', `${rayMis} disagreements of ${n}${ex.length ? ' — ' + ex.join('; ') : ''}`);
  F.verdict(segMis === 0, 'solidBlocked (sound / a step / a line of fire) through the pane agrees point for point', `${segMis} disagreements of ${n}${ex.length ? ' — ' + ex.join('; ') : ''}`);
  F.verdict(tabMis === 0, 'the nearest-site rule over the rows uploaded for common.wgsl gbCell agrees point for point (the renderer opens the same cells)', `${tabMis} disagreements of ${n}; table n ${rows[0]} mask ${rows[1]} uAxis ${rows[2]}`);
  const eye: Vec3 = [7.5, 1.6, 11.5]; let sightAll = true; for (const v of [-0.6, 0, 0.6]) sightAll &&= !game.col.segmentBlocked(eye, [7.5, 1.5 + v, 8.5]);
  F.verdict(sightAll, 'sight through the pane is what it always was (segmentBlocked passes glass, hole or not)', `three eye lines through intact and open parts: all clear = ${sightAll}`);
  return F.done();
}

// ================================================================ the movement rule
export async function glassbreakWalk() {
  const F = family('glassbreak-walk: a pane is a wall to a walker\'s circle until every cell below 1.9 m has gone, then it is walked through; solidBlocked agrees; the nav grid is untouched');
  const { W, game } = await stage(9105, 0.5, true); const gb = game.glassBreak; const col = game.col;
  // a full-height TEMPERED sheet on the facade (the lobby frontage): five rounds dice it whole → every cell out → walkable
  const cand = game.engine.world.glassStatics.map((i: number) => ({ i, b: game.level.boxes[i] })).filter((x: any) => gb.typeOf(x.b) === 'tempered' && x.b.c[1] - x.b.h[1] < 0.6 && x.b.c[1] + x.b.h[1] > 1.9 && Math.min(x.b.h[0], x.b.h[2]) <= 0.05);   // (every sheet in the office stands on a sill: the frontage's foot is at 0.5 m — the circle below is tested over a span above the sill so the PANE's part is what is measured)
  const pick = cand[0]; if (!pick) { F.verdict(false, 'staging: a full-height tempered facade pane exists', `none among ${game.engine.world.glassStatics.length} glass statics`); return F.done(); }
  const b = pick.b; const bi = pick.i; const wide = b.h[0] >= b.h[2] ? 0 : 2; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  const nrm: Vec3 = wide === 0 ? [sn, 0, cs] : [cs, 0, -sn];   // the pane's normal
  const inside = (p: Vec3) => p[0] > 4 && p[0] < 36 && p[2] > 4 && p[2] < 24; const inward: Vec3 = inside(v3.mad(b.c, nrm, 0.5)) ? nrm : v3.scale(nrm, -1);
  const pIn: Vec3 = v3.mad([b.c[0], 0, b.c[2]], inward, 0.6), pOut: Vec3 = v3.mad([b.c[0], 0, b.c[2]], inward, -0.6);
  const navBefore = col.nav.blocked ? Array.from(col.nav.blocked as Uint8Array).join('') : '';
  const pushed = (from: Vec3) => { const p = v3.copy(from); p[0] = b.c[0] - inward[0] * 0.2; p[2] = b.c[2] - inward[2] * 0.2; const q = v3.copy(p); col.collideCircle(q, 0.34, 0.7, 1.5, 3); return v3.distXZ(p, q); };
  const push0 = pushed(pOut); const solid0 = col.solidBlocked(v3.add(pOut, [0, 1.0, 0]), v3.add(pIn, [0, 1.0, 0]));
  F.verdict(push0 > 0.1 && solid0 && !gb.walkable(bi), 'intact: the circle straddling the pane is pushed out, the chest-height segment through it is blocked, walkable false', `pane ${bi} ${p2(b.c)} h ${p2(b.h)}: pushed ${f2(push0)} m, solidBlocked ${solid0}`);
  const face: Vec3 = [b.c[0] - inward[0] * b.h[wide === 0 ? 2 : 0], 1.2, b.c[2] - inward[2] * b.h[wide === 0 ? 2 : 0]];
  for (let k = 0; k < GLASSBREAK.failHits.tempered; k++) { gb.hit(bi, v3.add(face, [wide === 0 ? 0.15 * k - 0.3 : 0, 0.1 * k, wide === 2 ? 0.15 * k - 0.3 : 0]), inward, 1); }
  for (let i = 0; i < 90; i++) W.step(DT);
  const st = gb.panes.get(bi);
  F.verdict(!!st && st.impacts.length > 0 && st.dropped === (st.impacts.length >= 31 ? -1 : (1 << st.impacts.length) - 1) && gb.walkable(bi), 'five rounds dice the tempered sheet: every cell out → walkable', `impacts ${st?.impacts.length} dropped ${st?.dropped.toString(2)} open ${Math.round(100 * gb.openFraction(bi))}% walkable ${gb.walkable(bi)} diced ${GB_STATS.diced}`);
  const push1 = pushed(pOut); const solid1 = col.solidBlocked(v3.add(pOut, [0, 1.0, 0]), v3.add(pIn, [0, 1.0, 0]));
  F.verdict(push1 < 1e-6 && !solid1, 'diced: the same circle is left where it stands and the segment passes — feet and solidBlocked agree', `pushed ${push1.toExponential(1)} m, solidBlocked ${solid1}`);
  // an ANNEALED pane holed at head height only: still a wall to the circle, and solidBlocked at shin height still blocked (agree), open at the hole (as it must)
  gb.hit(PANE, W_(0.1, 0.75), [0, 0, -1], 1); gb.hit(PANE, W_(0.1, 0.75), [0, 0, -1], 1); for (let i = 0; i < 40; i++) W.step(DT);
  const stC = gb.panes.get(PANE)!; const q: Vec3 = [7.6, 0, 10.2]; const q2 = v3.copy(q); col.collideCircle(q2, 0.34, 0.7, 1.5, 3);
  const shin = col.solidBlocked([7.6, 0.8, 10.3], [7.6, 0.8, 9.7]), head = col.solidBlocked([7.6, 2.25, 10.3], [7.6, 2.25, 9.7]);
  F.verdict(stC.dropped !== 0 && !gb.walkable(PANE) && v3.distXZ(q, q2) > 0.1 && shin && !head, 'a pane holed at head height only: not walkable, the circle still pushed, shins still blocked, the hole itself open', `dropped ${stC.dropped.toString(2)} walkable ${gb.walkable(PANE)} pushed ${f2(v3.distXZ(q, q2))} shin blocked ${shin} head-height blocked ${head}`);
  const navAfter = col.nav.blocked ? Array.from(col.nav.blocked as Uint8Array).join('') : '';
  F.verdict(navBefore === navAfter && navBefore.length > 0, 'the nav grid is not rebaked (documented: A* keeps routing round the frame)', `${navBefore.length} cells, identical`);
  return F.done();
}

// ================================================================ caps
export async function glassbreakCaps() {
  const F = family('glassbreak-caps: sites per pane, rigid spawns per frame and the shared debris pool stay inside their bounds however hard the glazing is hit');
  const { W, game, engine } = await stage(9106, 1.0, true); const gb = game.glassBreak;
  const rnd = seeded(77); for (let k = 0; k < 60; k++) gb.hit(PANE, W_((rnd() * 2 - 1) * 0.47, (rnd() * 2 - 1) * 0.97), [0, 0, -1], 1);
  const st = gb.panes.get(PANE)!;
  F.verdict(st.impacts.length <= GLASSBREAK.maxImpacts, `60 scattered rounds into one pane: ≤ ${GLASSBREAK.maxImpacts} sites`, `sites ${st.impacts.length}, hits ${st.hits}, pending ${st.pending.length}`);
  let maxPerFrame = 0, over = 0; const cap = engine.settings.debrisCap ?? 64;
  for (let i = 0; i < 120; i++) { const s0 = GB_STATS.shards; W.step(DT); const d = GB_STATS.shards - s0; maxPerFrame = Math.max(maxPerFrame, d); if (game.destr.debris.list.length > cap) over++; }
  F.verdict(maxPerFrame <= GLASSBREAK.shardsPerFrame + 2, `rigid spawns a frame ≤ shardsPerFrame ${GLASSBREAK.shardsPerFrame} (+ ≤ 2: the last cell taken may add up to three)`, `max ${maxPerFrame} in a frame; ${GB_STATS.shards} shards, ${GB_STATS.refused} refused, dropped mask ${st.dropped.toString(2)}`);
  // every conference pane blasted from the room + the lobby frontage diced: the pool must never pass its cap; refusals are counted, not thrown
  for (const at of [[7.0, 0.5, 9.2], [10.5, 0.5, 9.2], [13.0, 0.5, 9.2]] as Vec3[]) gb.blast(at, 1);
  for (const i of engine.world.glassStatics) { const b = game.level.boxes[i]; if (gb.typeOf(b) === 'tempered') for (let k = 0; k < 5; k++) gb.hit(i, v3.add(b.c, [0.1 * k, 0.1 * k - 0.2, 0.05 * k]), [0, 0, -1], 1); }
  for (let i = 0; i < 240; i++) { W.step(DT); if (game.destr.debris.list.length > cap) over++; }
  const holed = [...gb.panes.values()].filter((s: any) => s.dropped).length;
  F.verdict(over === 0 && holed >= 6, `the debris pool never over its cap (${cap}) through ${holed} panes coming apart`, `pool now ${game.destr.debris.list.length}, spawned ${game.destr.debris.stats.spawned}, evicted ${game.destr.debris.stats.evicted}, pool refusals ${game.destr.debris.stats.refused}, glass refused ${GB_STATS.refused}, shards ${GB_STATS.shards}, diced ${GB_STATS.diced}`);
  const finite = [...gb.panes.values()].every((s: any) => s.impacts.every((p: any) => Number.isFinite(p.u) && Number.isFinite(p.v) && Number.isFinite(p.e)) && Number.isFinite(s.damage));
  F.verdict(finite, 'every pane record finite', `${gb.panes.size} records`);
  return F.done();
}

// ================================================================ reset + fingerprint
export async function glassbreakReset() {
  const F = family('glassbreak-reset: reset() and a restart put every pane back whole and take the gusts out of the wind; holes never touch the checkpoint fingerprint');
  const { W, game, engine } = await stage(9107, 0.5, true); const gb = game.glassBreak;
  const fp0 = JSON.stringify(levelFingerprint(game));
  game.weather.setEnabled?.(true); if (game.weather.wind) { game.weather.wind[0] = 6; game.weather.wind[1] = 2; }
  for (const i of engine.world.glassStatics) { const b = game.level.boxes[i]; if (gb.typeOf(b) === 'tempered') { for (let k = 0; k < 5; k++) gb.hit(i, v3.add(b.c, [0.1 * k, 0.1 * k - 0.2, 0.05 * k]), [0, 0, -1], 1); break; } }
  gb.hit(PANE, W_(0.1, 0.1), [0, 0, -1], 1); gb.hit(PANE, W_(0.1, 0.1), [0, 0, -1], 1);
  for (let i = 0; i < 120; i++) W.step(DT);
  const gusts0 = game.wind.all.filter((s: any) => s.why === 'glass').length; const holed0 = [...gb.panes.values()].filter((s: any) => s.dropped).length; const shards0 = game.destr.debris.list.filter((c: any) => c.kind === 'shard').length;
  const fp1 = JSON.stringify(levelFingerprint(game));
  F.verdict(holed0 >= 2 && shards0 > 0 && gusts0 >= 1, 'staging: two panes holed (one exterior, diced, in a storm), shards in the pool, a gust source registered', `holed ${holed0}, shards ${shards0}, glass gusts ${gusts0}`);
  F.verdict(fp0 === fp1 && game.level.boxes.length === JSON.parse(fp0).boxes, 'levelFingerprint identical with holes open (no static appended, none resized)', `boxes ${game.level.boxes.length}`);
  gb.reset();
  let anyOpen = false; for (const i of engine.world.glassStatics) { const b = game.level.boxes[i]; anyOpen ||= gb.openAt(i, b.c) || gb.walkable(i); }
  const rows = new Float32Array(GB_STRIDE * 4); const filled = engine.world.glassCellFill(PANE, rows, 0);
  F.verdict(gb.panes.size === 0 && !anyOpen && !filled && game.wind.all.filter((s: any) => s.why === 'glass').length === 0, 'reset(): no pane record, nothing open or walkable, the cell table rows empty, no glass gust in the wind', `panes ${gb.panes.size}, anyOpen ${anyOpen}, fill ${filled}, gusts ${game.wind.all.filter((s: any) => s.why === 'glass').length}`);
  // a restart: holes again, then restartEncounter → resetLevelState → glassBreak.reset + destr.reset (the shards go with the pool)
  gb.hit(PANE, W_(-0.2, 0.2), [0, 0, -1], 1); gb.hit(PANE, W_(-0.2, 0.2), [0, 0, -1], 1); for (let i = 0; i < 60; i++) W.step(DT);
  const shards1 = game.destr.debris.list.filter((c: any) => c.kind === 'shard').length;
  game.restartEncounter(); W.step(DT);
  const shards2 = game.destr.debris.list.filter((c: any) => c.kind === 'shard').length;
  F.verdict(shards1 > 0 && shards2 === 0 && gb.panes.size === 0 && !gb.openAt(PANE, W_(-0.2, 0.2)), 'restartEncounter(): panes whole, shards gone with the debris pool', `shards ${shards1} → ${shards2}, panes ${gb.panes.size}`);
  return F.done();
}

// ================================================================ gusts
export async function glassbreakGust() {
  const F = family('glassbreak-gust: a shot-out EXTERIOR pane in the storm becomes one wind source along its inward normal; interior panes never do');
  const { W, game, engine } = await stage(9108, 0.5, true); const gb = game.glassBreak;
  game.weather.setEnabled?.(true); const hasWind = !!game.weather.wind; if (hasWind) { game.weather.wind[0] = 7; game.weather.wind[1] = 1; }
  let ext = -1; for (const i of engine.world.glassStatics) { const b = game.level.boxes[i]; if (gb.typeOf(b) === 'tempered' && b.h[1] > 0.5) { ext = i; break; } }
  const b = game.level.boxes[ext];
  for (let k = 0; k < 5; k++) gb.hit(ext, v3.add(b.c, [0.1 * k, 0.1 * k - 0.2, 0.05 * k]), [0, 0, -1], 1);
  gb.hit(PANE, W_(0.1, 0.1), [0, 0, -1], 1); gb.hit(PANE, W_(0.1, 0.1), [0, 0, -1], 1);
  for (let i = 0; i < 120; i++) { if (hasWind) { game.weather.wind[0] = 7; game.weather.wind[1] = 1; } W.step(DT); }
  const gl = game.wind.all.filter((s: any) => s.why === 'glass');
  const src = gl[0]; const inside = (p: Vec3) => p[0] > 4 && p[0] < 36 && p[2] > 4 && p[2] < 24;
  F.verdict(gl.length === 1 && src.name === `glass:${ext}`, 'exactly one glass source, named for the diced exterior pane (none for the holed interior pane)', `sources ${gl.map((s: any) => s.name).join(', ')} (interior pane ${PANE} open ${Math.round(100 * gb.openFraction(PANE))}%)`);
  F.verdict(!!src && inside(v3.mad(src.pos, src.dir, 1.0)) && src.base > 0 && Number.isFinite(src.base), 'it blows INTO the building with a positive base speed off the storm', `dir ${src ? p2(src.dir) : '-'} base ${src?.base?.toFixed(2)} speed ${src?.speed?.toFixed?.(2)} storm ${hasWind ? p2([game.weather.wind[0], 0, game.weather.wind[1]]) : 'none'}`);
  if (hasWind) { game.weather.wind[0] = 0; game.weather.wind[1] = 0; } for (let i = 0; i < 5; i++) W.step(DT);
  F.verdict(src.base === 0, 'the storm still → the source\'s base drops to 0 (kept, silent)', `base ${src.base}`);
  return F.done();
}

// ================================================================ determinism
export async function glassbreakDeterminism() {
  const F = family('glassbreak-determinism: the same seeded volley + charge twice → identical pane records, debris rest poses, events, particle records, log');
  const a = await recordVolley(9109, true), b = await recordVolley(9109, true);
  const fails: string[] = []; diffLists(a, b, ['panes', 'debris', 'events', 'emits', 'log', 'decals', 'audio'], fails);
  if (!a.panes || a.stats.dropped < 2) fails.push(`staging: panes '${a.panes.slice(0, 40)}', dropped ${a.stats.dropped}`);
  F.verdict(!fails.length, `${a.panes.split('|').length} pane records, ${a.debris.split('|').filter(Boolean).length} chunks, ${a.events.length} events, ${a.emits.length} particle records, ${a.log.length} log lines — identical both runs`, fails.join('; ') || `stats ${JSON.stringify(a.stats)}`);
  return F.done();
}

export async function glassbreakFamily(): Promise<boolean> { let ok = true; for (const f of [glassbreakOff, glassbreakGate, glassbreakFrozen, glassbreakOpen, glassbreakWalk, glassbreakCaps, glassbreakReset, glassbreakGust, glassbreakDeterminism]) ok = (await f()) && ok; return ok; }
if (import.meta.main) { const ok = await glassbreakFamily(); console.log(ok ? '=== glassbreak-probes: ALL PASS ===' : '=== glassbreak-probes: FAILED ==='); process.exit(ok ? 0 : 1); }
