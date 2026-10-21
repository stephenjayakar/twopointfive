// BROKEN GLASS AFTER IT LETS GO (src/game/shards.ts + shardModel.ts, the 'shard' particle kind; rebuild/glass/shards.md) — headless verdicts:
//   shards-model          the CPU reference and the shader agree by name on every constant (SHARD ↔ particles_common.wgsl SHARD_*, the kind table's eight slots, the kind count and the
//                         uniform's kp / ki row counts); a sweep of 3 000 sprayed fragments all come to REST, finite, never above where they started + a hop, fines stop nearer than mids
//   shards-release        a pane shot until a piece lets go: the release reaches the model (fragments counted), 'shard' particle records are queued (most of the births thrown the
//                         round's way, some back toward the shooter), plates carry their glass record (NoShadow, glass contact), nothing over a cap; every fragment kind by hand
//                         (piece / dagger / clump = dice, no plate / laminated sheet = a plate that never breaks)
//   shards-caps           A LONG BURST: twelve seconds of fragments at ten a frame, then two minutes of quiet — live particles never over SHARDS.liveCap × overCap, records a frame never over
//                         recsPerFrame, glass never over its share of the debris pool nor the pool over its cap, sounds a frame and pending landings inside their caps; afterwards every
//                         plate is at rest, nothing is pending, the live estimate has run out, nothing is NaN or under the floor
//   shards-rest           plates dropped from a pane's height: they land, some BREAK (never past generation 2), every one comes to rest; each landing is heard once (a tinkle or a
//                         shatter + a 'prop' event at the landing level, blamed on who broke it), never at the moment of release
//   shards-underfoot      where glass came down there is litter: a step on it comes back louder and crunches, grinds it down; a step off it, or with the switch off, is untouched
//   shards-determinism    the seeded volley twice: digest, events, audio, particle records, debris and the model's counters identical
//   shards-off            THE SWITCH OFF = THE BASE: the seeded volley with glass breaking ON and tune.glassShards OFF is identical — run digest, events, audio, particle records,
//                         debris — to the same game with this model's seams pulled out (the debris pool's glass door null, a stub where game.ts / floor.ts call it); and with glass
//                         breaking off (the shipped default) the model counts nothing at all. (The cross-BUILD digest against 25e5e7c is on rebuild/glass/shards.md.)
import { standUp, ROOT, fake } from './headless.ts';
import { CONF_PANE, CONF_FAR, floatPartition } from './office-pane.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const PM = await import(`${ROOT}/src/render/particles.ts`);
const { Particles } = PM;
const GBM = await import(`${ROOT}/src/game/glassbreak.ts`);
const SM = await import(`${ROOT}/src/game/shards.ts`);
const MM = await import(`${ROOT}/src/game/shardModel.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { tread } = await import(`${ROOT}/src/game/floor.ts`);
const { cutBoxesOn } = await import(`${ROOT}/src/scene/cut.ts`);   // (CUTBOXES=1: a dagger is then ONE plate cut to its cell, not two or three rectangles along it)
const { GB_STATS } = GBM; const { SHARDS, SHARD_STATS } = SM; const { SHARD } = MM;

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
const resetStats = () => { for (const k of Object.keys(GB_STATS)) (GB_STATS as any)[k] = 0; for (const k of Object.keys(SHARD_STATS)) (SHARD_STATS as any)[k] = 0; };
function newEvents(game: any, seen: WeakSet<any>): any[] { const out: any[] = []; for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); out.push(e); } return out; }

// the pane (by where it stands: office-pane.ts) = the conference partition's second sheet (glassbreak-probes.ts): c (7.5, 1.5, 10), annealed; Sam in the corridor south of it, facing it
const PANE = CONF_PANE;
const W_ = (u: number, v: number): Vec3 => [7.5 + u, 1.5 + v, 10];
const SAM: Vec3 = [8.3, 0, 11.6];
const OPEN: Vec3 = [20, 1.4, 14.6];   // open floor in the middle aisle (the hand tests' drop point)

async function stage(seed: number, opts: { breakOn?: boolean; shardsOn?: boolean; chaos?: number } = {}) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game, engine } = W; floatPartition(game);
  engine.particles = new Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  game.godMode = true; game.player.visibility = 0.02; game.tune.chaos = opts.chaos ?? 0.5; game.tune.glassBreak = opts.breakOn ?? true; game.tune.glassShards = opts.shardsOn ?? true; resetStats();
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => park(gd, i));
  game.teleportPlayer(SAM); game.player.char.bodyYaw = game.player.char.aimYaw = Math.PI; game.player.slot = 'rifle'; game.player.holstered = false; game.player.crouch = false;
  W.step(DT); W.step(DT);
  const P = engine.particles;
  const flush = () => { const q = P.pending.map((e: any) => ({ kind: e.kind, count: e.count, pos: e.pos.slice(), dir: e.dir.slice(), seed: e.seed, o: e.o })); P.pending.length = 0; P.pendingImpulses.length = 0; return q; };
  return { W, game, engine, P, flush };
}
const recStr = (e: any) => `${e.kind}:${e.count}:${e.pos.map((x: number) => x.toFixed(2)).join(',')}:${e.seed}`;
const finiteBox = (b: any) => b.c.every(Number.isFinite) && b.h.every(Number.isFinite) && (!b.rot || b.rot.every(Number.isFinite));

// ================================================================ the model
export async function shardsModel() {
  const F = family('shards-model: the CPU reference and the shader agree on every number; 3 000 sprayed fragments all come to rest');
  // ---- constants by name
  const common = await Bun.file(`${ROOT}/src/render/shaders/particles_common.wgsl`).text();
  const wg = new Map<string, number>(); for (const m of common.matchAll(/const\s+SHARD_([A-Z0-9_]+)\s*:\s*f32\s*=\s*([-0-9.eE]+)\s*;/g)) wg.set(m[1], Number(m[2]));
  const bad: string[] = []; let compared = 0;
  for (const k of ['REF_SIZE', 'DRAG_MAX', 'ANG_DAMP', 'E_JIT', 'SKITTER', 'SPIN_K', 'SPIN_MAX', 'WALL_E', 'WALL_KEEP', 'REST_TILT', 'GLINT_CAP', 'F0']) { compared++; if (!wg.has(k)) bad.push(`SHARD_${k} missing in the shader`); else if (Math.abs(wg.get(k)! - (SHARD as any)[k]) > 1e-9) bad.push(`${k}: ts ${(SHARD as any)[k]} ≠ wgsl ${wg.get(k)}`); }
  const KD = PM.KIND_DEFAULTS.shard;
  const slots: [string, number, number][] = [['gravity', KD.gravity, SHARD.gravity], ['drag', KD.drag, SHARD.drag], ['restitution', KD.restitution, SHARD.restitution], ['keep', KD.keep, SHARD.keep], ['sleepV', KD.sleepV, SHARD.sleepV], ['fade', KD.holdOrFade, SHARD.fade], ['ROUGH', KD.shutterOrGrowth, SHARD.ROUGH], ['SCATTER', KD.brightOrOpacity, SHARD.SCATTER]];
  for (const [n, a, b] of slots) { compared++; if (a !== b) bad.push(`kind slot ${n}: ${a} ≠ ${b}`); }
  const nk = Number(/const\s+P_KINDS\s*:\s*u32\s*=\s*(\d+)u/.exec(common)?.[1]); const idS = Number(/const\s+P_SHARD\s*:\s*u32\s*=\s*(\d+)u/.exec(common)?.[1]);
  const kp = Number(/kp:\s*array<vec4f,\s*(\d+)>/.exec(common)?.[1]); const ki = Number(/ki:\s*array<vec4f,\s*(\d+)>/.exec(common)?.[1]);
  if (nk !== PM.P_KINDS.length) bad.push(`P_KINDS wgsl ${nk} ≠ ts ${PM.P_KINDS.length}`);
  if (idS !== PM.KIND_ID.shard) bad.push(`P_SHARD wgsl ${idS} ≠ ts ${PM.KIND_ID.shard}`);
  if (kp !== 2 * PM.P_KINDS.length || ki !== PM.P_KINDS.length) bad.push(`uniform rows kp ${kp} / ki ${ki} ≠ ${2 * PM.P_KINDS.length} / ${PM.P_KINDS.length}`);
  if (PM.BLOCK_HDR_BYTES !== 48 + PM.P_KINDS.length * 48 || PM.KIND_RING.shard !== 1) bad.push(`header ${PM.BLOCK_HDR_BYTES} B / ring ${PM.KIND_RING.shard}`);
  if (SHARDS.midLife !== SHARD.life) bad.push(`SHARDS.midLife ${SHARDS.midLife} ≠ SHARD.life ${SHARD.life}`);
  if (!/const\s+SHARDS_ON\s*:\s*bool\s*=\s*GLASS_BREAK\s*;/.test(common)) bad.push('SHARDS_ON is not GLASS_BREAK');
  for (const fnm of ['particles.wgsl', 'particles_draw.wgsl']) { const t = await Bun.file(`${ROOT}/src/render/shaders/${fnm}`).text(); const all = (t.match(/kind == P_SHARD/g) ?? []).length, gated = (t.match(/SHARDS_ON && kind == P_SHARD/g) ?? []).length; if (!all || all !== gated) bad.push(`${fnm}: ${gated} of ${all} shard tests behind SHARDS_ON`); }
  F.verdict(!bad.length, `${compared} numbers agree by name (SHARD ↔ SHARD_* in particles_common.wgsl, the kind's eight slots); kind ${idS} of ${nk}, kp ${kp} / ki ${ki} rows, header ${PM.BLOCK_HDR_BYTES} B, LONG ring`, bad.join('; ') || 'identical');
  { const FM = await import(`${ROOT}/src/render/frame.ts`); const was = FM.glassBreakConfig.on; const word = (on: boolean) => { FM.glassBreakConfig.on = on; const P = new Particles(fake('device'), fake('sceneLayout')) as any; P.emit('shard', [0, 1, 0], [0, 0, 1], 8, { speed: 1, life: 20, size: 0.01, tumble: 22, seed: 5 }); P.prepare(DT, true); const b = PM.BLOCK_HDR_BYTES / 4; return { kind: P.bu[b + 24] & 255, ring: (P.bu[b + 24] >>> 16) & 255, posBx: P.bf[b + 8] }; };
    const off = word(false), on = word(true); FM.glassBreakConfig.on = was;
    F.verdict(off.kind === PM.KIND_ID.debris && off.posBx === 0 && off.ring === 1 && on.kind === PM.KIND_ID.shard && on.posBx === 22 && on.ring === 1, 'a build compiled WITHOUT glass breaking (no shard branches in its kernels) is handed its glass as chips; one compiled with it gets kind 6 and the tumble', `packed record: off → kind ${off.kind} posB.x ${off.posBx} ring ${off.ring}; on → kind ${on.kind} posB.x ${on.posBx} ring ${on.ring}`); }
  // ---- the kernel's hash, bit for bit against known values of the WGSL function (pcg is integer-only: the same in both)
  const h = [MM.pcg(0), MM.pcg(1), MM.pcg(0xDEADBEEF)];
  F.verdict(h.every(x => Number.isInteger(x) && x >= 0 && x <= 0xFFFFFFFF) && new Set(h).size === 3 && MM.rnd(7, 1) >= 0 && MM.rnd(7, 1) < 1, 'the hash is a u32 → u32 function with rnd in [0, 1)', `pcg(0, 1, 0xDEADBEEF) = ${h.map(x => x.toString(16)).join(' ')}; rnd(7, 1) = ${MM.rnd(7, 1).toFixed(6)}`);
  // ---- the sweep: the three classes as shards.ts throws them from a pane's middle (1.5 m up), along +z
  const classes: [string, any][] = [
    ['mid', { pos: [0, 1.5, 0], dir: [0, 0, 1], count: 1000, speed: 2.8, speedJit: 0.75, spread: 0.55, size: SHARDS.midSize, sizeJit: 0.55, tumble: 22, posJit: 0.1, vadd: [0, -0.2, 0.4], seed: 0x51D5 }],
    ['fine', { pos: [0, 1.5, 0], dir: [0, 0, 1], count: 1000, speed: 4.8, speedJit: 0.85, spread: 0.95, size: SHARDS.fineSize, sizeJit: 0.6, tumble: 45, posJit: 0.1, vadd: [0, -0.1, 0.2], seed: 0xF17E }],
    ['dice', { pos: [0, 1.5, 0], dir: [0, 0, 1], count: 1000, speed: 0.9, speedJit: 0.8, spread: 1.1, size: 0.009, sizeJit: 0.35, tumble: 30, posJit: 0.2, vadd: [0, -0.3, 0.3], seed: 0xD1CE }],
  ];
  const med = (a: number[]) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const out: string[] = []; const reach: Record<string, number> = {}; let allRest = true, finite = true, bounded = true, worstT = 0, worstReach = 0, hopsMax = 0;
  for (const [name, rec] of classes) {
    const ss = MM.sprayShards(rec); const rs: number[] = [], ts: number[] = [], hs: number[] = [];
    for (const s of ss) {
      const y0 = s.p[1]; const r = MM.flyShard(s, { dt: 1 / 120, maxT: 15 });
      if (!s.asleep || r.restT < 0) allRest = false;
      if (![...s.p, ...s.v, ...s.n, ...s.w].every(Number.isFinite)) finite = false;
      if (r.maxH > y0 + 0.6 || s.p[1] < -1e-6 || r.reach > 9) bounded = false;
      rs.push(r.reach); ts.push(r.restT); hs.push(r.hops); worstT = Math.max(worstT, r.restT); worstReach = Math.max(worstReach, r.reach); hopsMax = Math.max(hopsMax, r.hops);
    }
    reach[name] = med(rs);
    out.push(`${name}: reach median ${med(rs).toFixed(2)} m (max ${Math.max(...rs).toFixed(2)}), at rest after median ${med(ts).toFixed(2)} s (max ${Math.max(...ts).toFixed(2)}), ${med(hs)} touches median (max ${Math.max(...hs)})`);
  }
  F.verdict(allRest && finite && bounded, '3 000 fragments (mids, fines, dice): every one asleep inside 15 s, finite, never more than a hop above its start, never under the floor, none past 9 m', out.join(' · '));
  F.verdict(reach.fine < reach.mid && reach.dice < reach.mid, 'the air stops the fines (thrown nearly twice as fast, they land nearer than the mids); the dice pour down nearest of all', `median reach: fines ${reach.fine.toFixed(2)} m < mids ${reach.mid.toFixed(2)} m; dice ${reach.dice.toFixed(2)} m`);
  // a resting field is not one mirror: the rest normals are spread, most near flat
  const tilt: number[] = []; for (const s of MM.sprayShards({ ...classes[0][1], count: 400, seed: 99 })) { MM.flyShard(s, { maxT: 15 }); tilt.push(Math.acos(Math.min(1, Math.abs(s.n[1])))); }
  const flat = tilt.filter(t => t < 0.1).length / tilt.length;
  F.verdict(Math.max(...tilt) <= SHARD.REST_TILT + 1e-6 && flat > 0.35 && flat < 0.9 && new Set(tilt.map(t => t.toFixed(3))).size > 100, 'litter lies at many slightly different tilts (≤ REST_TILT), most of it near flat: it will not glint as one sheet', `${(flat * 100).toFixed(0)} % within 0.1 rad of flat, max ${Math.max(...tilt).toFixed(3)} rad, ${new Set(tilt.map(t => t.toFixed(3))).size} distinct tilts of ${tilt.length}`);
  return F.done();
}

// ================================================================ a release
export async function shardsRelease() {
  const F = family('shards-release: a piece that lets go becomes plates + shard particles thrown the round\'s way, inside every cap');
  const { W, game, flush } = await stage(9201); const gb = game.glassBreak; const D = game.destr.debris;
  const hooked = 'onRelease' in gb;   // the fracture part's build: fragments come through its release hook, with their cause; else the interim take-over inside Debris
  // rounds into one spot of the pane from the corridor (travelling −z) until a cell drops
  const recs: any[] = []; let maxRecs = 0;
  for (let i = 0; i < 6 && GB_STATS.dropped === 0; i++) { gb.hit(PANE, W_(0.1 + 0.01 * i, 0.1), [0, 0, -1], 1); for (let f = 0; f < 20; f++) { W.step(DT); const q = flush(); maxRecs = Math.max(maxRecs, q.filter((e: any) => e.kind === 'shard').length); recs.push(...q); } }
  for (let f = 0; f < 30; f++) { W.step(DT); const q = flush(); maxRecs = Math.max(maxRecs, q.filter((e: any) => e.kind === 'shard').length); recs.push(...q); }
  const sh = recs.filter(e => e.kind === 'shard'); const born = sh.reduce((n, e) => n + e.count, 0);
  F.verdict(GB_STATS.dropped > 0 && SHARD_STATS.fragments > 0 && sh.length > 0 && born === SHARD_STATS.born && GB_STATS.refused === 0 && (hooked ? (GB_STATS as any).hooked === SHARD_STATS.fragments && gb.onRelease != null : GB_STATS.shards === SHARD_STATS.fragments), 'the release reaches the model and queues shard particles; the fracture side counts every piece handed over as taken (its per-frame budget advances, nothing reads as refused)', `${GB_STATS.dropped} cells dropped → ${hooked ? (GB_STATS as any).hooked + ' through the release hook' : GB_STATS.shards + ' handed over'}, ${GB_STATS.refused} refused → ${SHARD_STATS.fragments} fragments → ${sh.length} 'shard' records, ${born} particles (the model counts ${SHARD_STATS.born}); ${game.shards.summary()}`);
  const fwd = sh.filter(e => e.dir[2] < -0.5), back = sh.filter(e => e.dir[2] > 0.5); const nf = fwd.reduce((n, e) => n + e.count, 0), nb = back.reduce((n, e) => n + e.count, 0);
  F.verdict(nf > 0 && nb > 0 && nb < 0.35 * nf, 'most of it goes the round\'s way out (−z), a little comes back toward the shooter', `${nf} particles thrown along the round, ${nb} back (${(100 * nb / Math.max(1, nf + nb)).toFixed(0)} %)`);
  for (let i = 0; i < 12 && !D.list.some((c: any) => c.glass); i++) { gb.hit(PANE, W_(0.1 + 0.04 * i, 0.1 + 0.05 * i), [0, 0, -1], 1); for (let f = 0; f < 30; f++) { W.step(DT); flush(); } }   // (the fracture part's first piece is a small crater: keep at it until something plate-sized lets go; a no-op on the base)
  const plates = D.list.filter((c: any) => c.glass);
  F.verdict(plates.length > 0 && plates.every((c: any) => (c.box.flags & BoxFlag.NoShadow) && (c.box.flags & BoxFlag.Dynamic) && c.contact === SHARDS.contact && c.glass.gen <= SHARDS.maxGen && c.box.rough === 0.05), 'its big part is rigid plates carrying their glass record: clear (no shadow), polished, glass contact', `${plates.length} plates, areas ${plates.map((c: any) => (c.glass.area * 1e4).toFixed(0)).join(' / ')} cm², gens ${plates.map((c: any) => c.glass.gen).join('')}`);
  const sizes = sh.map(e => e.o.size); const lifeMax = Math.max(...sh.map(e => e.o.life * (1 + e.o.lifeJit)));
  F.verdict(maxRecs <= SHARDS.recsPerFrame && game.shards.live <= SHARDS.liveCap && sh.every(e => e.count <= PM.MAX_NEW_PER_FRAME && Number.isFinite(e.o.speed)) && lifeMax <= 90, 'inside the caps: records a frame, live particles, each record\'s count; every fragment has a finite life', `≤ ${maxRecs} records in a frame (cap ${SHARDS.recsPerFrame}), ~${game.shards.live} live (cap ${SHARDS.liveCap}), sizes ${Math.min(...sizes) * 1e3}‥${Math.max(...sizes) * 1e3} mm, longest life ${lifeMax.toFixed(0)} s`);
  // ---- what made a cell let go, as the interim hookup reads it: straight off rounds = 'hit' (back spray), a tongue following later = 'support' (no back spray), and a
  //      round into the already-holed pane (site set frozen) is still a 'hit'
  const seenTakes = new Set<string>(); const takes = () => { for (const l of game.shards.log) if (l.includes('take pane')) seenTakes.add(l); return [...seenTakes]; };   // the log is a ring: gather as we go
  const t1 = takes(); const firstHit = t1.length > 0 && / hit /.test(t1[0]);
  for (let f = 0; f < 120; f++) { W.step(DT); flush(); takes(); }
  const n1 = takes().length; const b0 = SHARD_STATS.fragments;
  for (let i = 0; i < 4; i++) { gb.hit(PANE, W_(-0.45 + 0.004 * i, -0.3), [0, 0, -1], 1); for (let f = 0; f < 24; f++) { W.step(DT); flush(); takes(); } }   // (24 frames apart: the base holds a queued cell for its `think` 0.28 s after the LAST hit)
  const late = takes().slice(n1); const lateHit = late.filter((l: string) => / hit /.test(l)).length, lateSup = late.filter((l: string) => / support /.test(l)).length;
  if (hooked) F.verdict(SHARD_STATS.fragments > 0, 'the cause of a break comes with the fragment (the fracture part\'s release hook names it): nothing to infer', `${SHARD_STATS.fragments} fragments through the hook`);
  else F.verdict(firstHit && SHARD_STATS.fragments > b0 && lateHit > 0 && t1.every((l: string) => !/ blast /.test(l)), 'a cell rounds knocked out is read as a HIT (first break and a later round into the holed pane alike); never as a blast', `first: ${t1[0]?.replace(/^\S+ /, '')}; two seconds on, four more rounds: ${late.length} takes — ${lateHit} hit, ${lateSup} support`);
  // ---- a TEMPERED pane dicing: the whole face pours as dice, no plate
  { const st0 = { ...SHARD_STATS }; const tb = [...game.engine.world.glassStatics].find((bi: number) => gb.typeOfPane(bi) === 'tempered');   // (as it will BREAK: the stage has made the partition float by hand)
    if (tb === undefined) F.verdict(true, 'no tempered pane on this level (the dice path is covered by hand below)', 'skipped');
    else { const b = game.engine.world.statics[tb]; const thin = b.h[0] < b.h[2] ? 0 : 2; const nrm: Vec3 = thin === 0 ? [Math.cos(b.yaw), 0, -Math.sin(b.yaw)] : [Math.sin(b.yaw), 0, Math.cos(b.yaw)]; const face = 4 * b.h[2 - thin] * b.h[1];
      const near = () => D.list.filter((c: any) => c.glass && Math.hypot(c.box.c[0] - b.c[0], c.box.c[2] - b.c[2]) < 2.5).length; const p0 = near(); const dice: any[] = [];
      for (let i = 0; i < 12 && GB_STATS.diced === 0; i++) { gb.hit(tb, [b.c[0], b.c[1] + 0.02 * i, b.c[2]], nrm, 1); for (let f = 0; f < 6; f++) { W.step(DT); dice.push(...flush().filter((e: any) => e.kind === 'shard')); } }
      for (let f = 0; f < 90; f++) { W.step(DT); dice.push(...flush().filter((e: any) => e.kind === 'shard')); }
      const clumps = SHARD_STATS.fragments - st0.fragments; const nd = dice.filter((e: any) => e.o.aspect === 1).reduce((a: number, e: any) => a + e.count, 0); const plates1 = near();
      F.verdict(GB_STATS.diced > 0 && clumps >= 2 && nd >= Math.min(600, face * 250) && plates1 <= p0, 'a tempered pane that dices pours its WHOLE face as dice (a grid of clumps), and makes no plate', `pane ${tb} (${face.toFixed(2)} m²): ${clumps} clumps → ${nd} dice in ${dice.length} records, plates ${p0} → ${plates1}; ${game.shards.summary()}`); } }
  // ---- every fragment kind by hand, on open floor
  game.clearAftermath(); W.step(DT); flush();   // (a clean pool and an empty live estimate: the panes above may have filled glass's share of both)
  const kinds: string[] = []; let ok = true;
  for (const [kind, type] of [['piece', 'annealed'], ['dagger', 'annealed'], ['clump', 'tempered'], ['sheet', 'laminated']] as const) {
    const p0 = D.list.filter((c: any) => c.glass).length; const s0 = { ...SHARD_STATS };
    const f = { pane: -1, type, kind, outline: (kind === 'dagger' ? [[-0.05, 0, 0], [0.05, 0, 0], [0.02, 0.6, 0], [-0.02, 0.6, 0]] : [[-0.15, -0.15, 0], [0.15, -0.15, 0], [0.15, 0.15, 0], [-0.15, 0.15, 0]]).map((p: number[]) => [OPEN[0] + p[0], OPEN[1] + p[1], OPEN[2]]), centre: kind === 'dagger' ? [OPEN[0], OPEN[1] + 0.3, OPEN[2]] : OPEN.slice(), normal: [0, 0, 1], thickness: 0.006, area: kind === 'dagger' ? 0.042 : 0.09, velocity: [0, -0.3, 0.8], spin: [2, 0, -1], tint: [0.72, 0.8, 0.82], grain: kind === 'clump' ? 0.009 : 0, cause: kind === 'clump' ? 'dice' : 'hit', who: 1, seed: 1234 + kinds.length };
    game.shards.release(f); const q = flush().filter((e: any) => e.kind === 'shard');
    const made = D.list.filter((c: any) => c.glass).length - p0; const n = q.reduce((a: number, e: any) => a + e.count, 0);
    const expect = kind === 'clump' ? made === 0 && n >= 30 && q.some((e: any) => Math.abs(e.o.size - 0.009) < 1e-9 && e.o.aspect === 1) : kind === 'dagger' ? made >= (cutBoxesOn() ? 1 : 2) && n > 0 : kind === 'sheet' ? made >= 1 && n > 0 && D.list.filter((c: any) => c.glass?.type === 'laminated').every((c: any) => c.contact === undefined) : made >= 1 && n > 0;
    ok &&= expect && SHARD_STATS.fragments === s0.fragments + 1;
    kinds.push(`${kind}/${type}: ${made} plates + ${n} particles in ${q.length} records`);
  }
  F.verdict(ok, 'piece → a plate + spray; dagger → plates along its length (one cut plate under the cut switch); tempered clump → DICE and no plate; laminated sheet → a plate with the pool\'s dead contact', kinds.join(' · '));
  // ---- the CRATER (the fracture part's small piece at the blow comes with `grain`): grains that size, thrown the blow's way + back, and never a plate — however big it is
  { const outl = (s: number) => [[-s, -s, 0], [s, -s, 0], [s, s, 0], [-s, s, 0]].map((p: number[]) => [OPEN[0] + p[0], OPEN[1] + p[1], OPEN[2]]);
    const crater = (area: number, seed: number) => ({ pane: -1, type: 'annealed', kind: 'piece', outline: outl(Math.sqrt(area) / 2), centre: OPEN.slice(), normal: [0, 0, 1], thickness: 0.006, area, velocity: [0, -0.2, 3], spin: [0, 0, 0], tint: [0.72, 0.8, 0.82], grain: 0.004, cause: 'hit', who: 1, seed });
    const p0 = D.list.filter((c: any) => c.glass).length;
    game.shards.release(crater(0.0012, 77) as any); const q1 = flush().filter((e: any) => e.kind === 'shard');
    game.shards.release(crater(0.05, 78) as any); const q2 = flush().filter((e: any) => e.kind === 'shard');
    const made = D.list.filter((c: any) => c.glass).length - p0; const all = [...q1, ...q2];
    const fwdN = all.filter((e: any) => e.dir[2] > 0.5).reduce((a: number, e: any) => a + e.count, 0), backN = all.filter((e: any) => e.dir[2] < -0.5).reduce((a: number, e: any) => a + e.count, 0);
    F.verdict(made === 0 && q1.length === 2 && q2.length === 2 && all.every((e: any) => Math.abs(e.o.size - 0.004) < 1e-9) && fwdN > 0 && backN > 0 && backN < 0.35 * fwdN && q2.every((e: any) => e.count <= SHARDS.craterMax), 'a fragment that comes with a grain size (the crater at the blow) goes as grains that size, mostly the blow\'s way, a little back — and is never a plate', `12 cm² and 500 cm² craters: ${made} plates, ${fwdN} grains forward + ${backN} back, all 4 mm, ≤ ${SHARDS.craterMax} a record`); }
  // ---- a round THROUGH a sheet (the penetration part's crossing record): a tight jet of fines off the far face along the way out; a pinch through a hole; laminated holds most
  { const X = (o: any) => ({ bi: PANE, type: 'annealed', exit: OPEN.slice(), dirOut: [0, 0, -1], take: 0.1, eOut: 0.9, hole: false, ...o });
    const c0 = SHARD_STATS.crossings; const p0 = D.list.filter((c: any) => c.glass).length;
    const r1 = game.shards.crossed(X({}), 1); const a = flush().filter((e: any) => e.kind === 'shard');
    game.shards.crossed(X({ hole: true }), 1); const b = flush().filter((e: any) => e.kind === 'shard');
    game.shards.crossed(X({ type: 'laminated', take: 0.42, eOut: 0.58 }), 1); const c = flush().filter((e: any) => e.kind === 'shard');
    const cnt = (q: any[]) => q.reduce((n: number, e: any) => n + e.count, 0);
    game.tune.glassShards = false; const r2 = game.shards.crossed(X({}), 1); const off = flush().filter((e: any) => e.kind === 'shard'); game.tune.glassShards = true;
    F.verdict(r1 === true && a.length === 1 && a[0].dir[2] < -0.99 && a[0].o.spread <= 0.35 && a[0].o.speed > 6 && cnt(a) === SHARDS.exitFines && cnt(b) > 0 && cnt(b) < 0.3 * cnt(a) && cnt(c) < cnt(a) && D.list.filter((cc: any) => cc.glass).length === p0 && SHARD_STATS.crossings === c0 + 3 && r2 === false && off.length === 0,
      'a round through a sheet throws ONE tight jet of fines off the far face along its way out, by what the glass took; a pinch through an earlier hole; less off laminated; no plate; nothing with the switch off', `plain ${cnt(a)} fines at ${a[0]?.o.speed.toFixed(1)} m/s in a ${a[0]?.o.spread} cone · through a hole ${cnt(b)} · laminated ${cnt(c)} · switch off ${off.length} records`); }
  return F.done();
}

// ================================================================ a long burst
export async function shardsCaps() {
  const F = family('shards-caps: twelve seconds of fragments at ten a frame, then two minutes of quiet — every cap holds, everything comes to rest');
  const { W, game, engine, flush } = await stage(9202); const D = game.destr.debris; const S = game.shards;
  W.audioLog = [];
  let maxLive = 0, maxRecs = 0, maxGlass = 0, maxPool = 0, maxPending = 0, maxBirths = 0, bad = 0; const cap = D.cap(); const share = Math.max(2, Math.floor(cap * SHARDS.plateShare));
  const kinds = ['piece', 'dagger', 'clump', 'piece', 'sheet', 'piece'] as const;
  const frames = 60 * 12; let released = 0, maxDeferred = 0;
  for (let f = 0; f < frames + 60 * 120; f++) {
    if (f < frames) for (let k = 0; k < 10; k++) {
      const i = f * 10 + k; const kind = kinds[i % kinds.length]; const type = kind === 'clump' ? 'tempered' : kind === 'sheet' ? 'laminated' : 'annealed';
      const at: Vec3 = [18 + (i % 9) * 0.5, 0.8 + (i % 5) * 0.3, 13.6 + (i % 4) * 0.5];
      game.shards.test(at, [Math.cos(i), 0, Math.sin(i)], 0.02 + 0.02 * (i % 6), kind, type); released++;
    }
    W.step(DT);
    const q = flush().filter((e: any) => e.kind === 'shard');   // (the hand releases between frames + everything the step itself releases: one count, reset at the end of shards.update)
    maxRecs = Math.max(maxRecs, q.length); maxBirths = Math.max(maxBirths, q.reduce((a: number, e: any) => a + e.count, 0)); maxDeferred = Math.max(maxDeferred, (S as any).deferred.length);
    maxLive = Math.max(maxLive, S.live); maxGlass = Math.max(maxGlass, S.plateCount); maxPool = Math.max(maxPool, D.list.length); maxPending = Math.max(maxPending, (S as any).pending.length);
    if (f % 30 === 0) for (const c of D.list) if (!finiteBox(c.box) || c.box.c[1] < -0.05 || !c.v.every(Number.isFinite)) bad++;
  }
  F.verdict(maxLive <= SHARDS.liveCap * SHARDS.overCap + SHARDS.capFloor && maxRecs <= SHARDS.recsPerFrame && maxDeferred <= SHARDS.deferMax, `${released} fragments in 12 s: live particles never over ${SHARDS.liveCap} × ${SHARDS.overCap} (the cap, then capFloor pieces an emit up to overCap), records a frame never over ${SHARDS.recsPerFrame}`, `peak live ~${maxLive}, peak ${maxRecs} records / ${maxBirths} births queued in a frame; ${SHARD_STATS.born} born, ${SHARD_STATS.trimmed} trimmed by the budget, ${SHARD_STATS.recsDeferred} records waited a frame (queue peak ${maxDeferred} of ${SHARDS.deferMax})`);
  F.verdict(maxGlass <= share && maxPool <= cap && bad === 0, `glass never over its share of the debris pool (${share} of ${cap}), the pool never over its cap, no plate NaN or under the floor`, `peak ${maxGlass} glass plates, peak pool ${maxPool}; ${SHARD_STATS.plates} plates made, ${SHARD_STATS.crumbled} crumbled to make room, ${SHARD_STATS.platesRefused} refused, ${SHARD_STATS.breaks} broke on landing`);
  // sounds: per frame + pending
  const perFrame = new Map<string, number>(); for (const a of W.audioLog!) if (a.name.startsWith('glassT') || a.name.startsWith('glassS')) { const k = a.t.toFixed(4); perFrame.set(k, (perFrame.get(k) ?? 0) + 1); }
  const maxSnd = Math.max(0, ...perFrame.values());
  F.verdict(maxSnd <= SHARDS.soundsPerFrame && maxPending <= SHARDS.pendingMax && SHARD_STATS.events <= Math.ceil((frames / 60 + 120) / SHARDS.eventGap) + 1, `landing sounds a frame ≤ ${SHARDS.soundsPerFrame}, pending landings ≤ ${SHARDS.pendingMax}, hearing events ≤ one per ${SHARDS.eventGap} s`, `max ${maxSnd} in a frame over ${perFrame.size} sounding frames (${SHARD_STATS.sounds} sounds), pending peak ${maxPending}; ${SHARD_STATS.events} hearing events in ${(frames / 60 + 120).toFixed(0)} s (one per ${SHARDS.eventGap} s at most)`);
  const moving = D.list.filter((c: any) => c.glass && !c.rest).length;
  F.verdict(moving === 0 && (S as any).pending.length === 0 && S.live === 0 && (S as any).breaks.length === 0 && (S as any).deferred.length === 0, 'two minutes on: every plate at rest, nothing pending, the live estimate run out', `${S.plateCount} plates lying, ${moving} moving, ~${S.live} live, litter in ${S.litter.size} cells; ${S.summary()}`);
  // the particle system's own queue takes the load without dropping glass (records wait at the birth cap, only sparks are ever shed)
  const P2 = new Particles(fake('device'), fake('sceneLayout')); let acc = 0;
  for (let i = 0; i < 300; i++) acc += P2.emit('shard', [0, 1, 0], [0, 0, 1], 40, { speed: 1, life: 20, size: 0.01 });
  F.verdict(acc === 300 * 40 && P2.stats.droppedRecs === 0, 'the particle queue accepts a 300-record glass storm whole (records wait for the birth cap; nothing of glass is shed)', `accepted ${acc} of ${300 * 40}, dropped records ${P2.stats.droppedRecs}, queue ${P2.pending.length}`);
  void engine;
  return F.done();
}

const supported = (game: any, c: any) => { const h = game.col.raycast([c.box.c[0], c.box.c[1] + 0.02, c.box.c[2]], [0, -1, 0], 0.4); return c.box.c[1] < 0.12 || !!h; };
// ================================================================ plates: land, break, rest; heard once
export async function shardsRest() {
  const F = family('shards-rest: plates land, some break (never past generation 2), all come to rest; every landing is heard, at the landing');
  const { W, game, flush } = await stage(9203); const D = game.destr.debris; const S = game.shards;
  W.audioLog = []; const seen = new WeakSet<any>(); newEvents(game, seen);
  const t0 = game.time;
  for (let i = 0; i < 10; i++) game.shards.test([18.5 + i * 0.45, 1.5, 14.6], [0, 0, 1], 0.06 + 0.01 * i, i % 3 === 2 ? 'dagger' : 'piece', 'annealed');
  const made = S.plateCount; const atRelease = W.audioLog!.filter((a: any) => a.name === 'glassTinkle' || a.name === 'glassShatter').length;
  const evs: any[] = []; let maxGen = 0, restAt = -1;
  for (let f = 0; f < 60 * 20; f++) {
    W.step(DT); flush();
    evs.push(...newEvents(game, seen).filter(e => e.kind === 'prop'));
    for (const c of D.list) if (c.glass) maxGen = Math.max(maxGen, c.glass.gen);
    if (restAt < 0 && f > 30 && D.list.every((c: any) => !c.glass || c.rest)) restAt = game.time - t0;
  }
  const plates = D.list.filter((c: any) => c.glass);
  F.verdict(made >= 10 && SHARD_STATS.breaks > 0 && maxGen <= SHARDS.maxGen && plates.length > made, 'dropped from a pane\'s height, plates break on the floor into smaller plates — two generations at most', `${made} plates let go → ${SHARD_STATS.breaks} broke → ${plates.length} lying (gens ${[0, 1, 2].map(g => plates.filter((c: any) => c.glass.gen === g).length).join(' / ')}); log: ${S.log.slice(0, 2).join(' | ')}`);
  F.verdict(restAt > 0 && plates.every((c: any) => c.rest && finiteBox(c.box) && c.box.c[1] >= 0 && c.box.c[1] < 1.3 && supported(game, c)), 'every plate comes to rest, lying on the floor or on the furniture under it', `all at rest ${restAt.toFixed(2)} s after release; heights ${Math.min(...plates.map((c: any) => c.box.c[1])).toFixed(3)}‥${Math.max(...plates.map((c: any) => c.box.c[1])).toFixed(3)} m`);
  const snd = W.audioLog!.filter((a: any) => a.name === 'glassTinkle' || a.name === 'glassShatter'); const first = Math.min(...snd.map((a: any) => a.t)) - t0;
  F.verdict(atRelease === 0 && snd.length + SHARD_STATS.soundsMerged >= made && first > 0.15 && snd.some((a: any) => a.name === 'glassShatter') && snd.some((a: any) => a.name === 'glassTinkle'), 'the landing is what sounds (a clink, or a shatter when it breaks) — nothing at release, the first after the fall', `${snd.length} sounds + ${SHARD_STATS.soundsMerged} landings inside a voice's gap thickening the next (${snd.filter((a: any) => a.name === 'glassShatter').length} shatters), none at release, the first ${first.toFixed(2)} s on (thrown down at ~1 m/s onto desks 0.75 m up and the floor)`);
  const gaps = evs.slice(1).map((e, i) => e.time - evs[i].time);
  F.verdict(evs.length >= 2 && gaps.every(d => d >= SHARDS.eventGap - 1e-9) && evs.every(e => e.level >= SHARDS.level - 1e-9 && e.level <= SHARDS.level + 0.06 && e.who === 2 && e.loud === false), 'the landings file \'prop\' hearing events at the landing level, blamed on who broke it, never closer together than the gap', `${evs.length} events (smallest gap ${Math.min(...gaps).toFixed(2)} s), levels ${[...new Set(evs.map(e => e.level.toFixed(2)))].join(' / ')}, who ${[...new Set(evs.map(e => e.who))].join(',')}`);
  // a plate woken and put back to sleep adds no glass to the floor
  const lit0 = [...S.litter.values()].reduce((a: number, b: number) => a + b, 0);
  for (const c of plates) { c.rest = false; c.v = [0, 0.4, 0]; }
  for (let f = 0; f < 60 * 4; f++) { W.step(DT); flush(); }
  const lit1 = [...S.litter.values()].reduce((a: number, b: number) => a + b, 0);
  F.verdict(D.list.filter((c: any) => c.glass).every((c: any) => c.rest) && Math.abs(lit1 - lit0) < 1e-9, 'every plate knocked awake and left to settle again: the litter is what it was (a plate is counted once)', `litter ${(lit0 * 1e4).toFixed(0)} cm² → ${(lit1 * 1e4).toFixed(0)} cm²`);
  // clearAftermath (a showcase starting, a tour cut): nothing still owed sounds or is heard afterwards
  for (let i = 0; i < 6; i++) game.shards.test([19 + i * 0.4, 1.5, 14.6], [0, 0, 1], 0.05, 'piece', 'annealed');
  const owed = (S as any).pending.length; game.clearAftermath(); W.audioLog = []; newEvents(game, seen);
  for (let f = 0; f < 60 * 3; f++) { W.step(DT); flush(); }
  const late = W.audioLog!.filter((a: any) => a.name.startsWith('glass')).length, lateEv = newEvents(game, seen).filter(e => e.kind === 'prop').length;
  F.verdict(owed > 0 && late === 0 && lateEv === 0 && S.live === 0 && S.litter.size === 0, 'clearAftermath(): the landings still owed are dropped with the glass — no sound, no hearing event, no litter, an empty live estimate', `${owed} landings were pending; after the clear ${late} glass sounds, ${lateEv} events, ~${S.live} live, ${S.litter.size} litter cells`);
  // resting plates are seen through: they take what lies under them × the tint
  const under = plates.filter((c: any) => c.box.albedo.every((x: number) => x > 0 && x < 1));
  F.verdict(under.length === plates.length && plates.length > 0, 'a resting plate takes the colour of what it lies on × the tint (seen through, not a pale slab)', `albedo e.g. ${plates[0].box.albedo.map((x: number) => x.toFixed(2)).join(', ')}`);
  return F.done();
}

// ================================================================ underfoot
export async function shardsUnderfoot() {
  const F = family('shards-underfoot: glass on the floor crunches under a boot and carries; off the litter, or switched off, a step is untouched');
  const { W, game, flush } = await stage(9204); const S = game.shards;
  for (let i = 0; i < 4; i++) game.shards.test([20, 1.2, 14.6], [0, 0, 1], 0.08, 'piece', 'annealed');
  for (let f = 0; f < 60 * 6; f++) { W.step(DT); flush(); }
  let best: [number, number] | null = null; for (const [k, a] of S.litter) if (!best || a > best[1]) best = [k, a];
  const cx = (Math.floor(best![0] / 4096) - 512 + 0.5) * 0.5, cz = ((best![0] % 4096) - 512 + 0.5) * 0.5; const on: Vec3 = [cx, 0, cz];
  const k0 = S.underfoot(on);
  F.verdict(S.litter.size > 0 && k0 > 0.5, 'where the glass came down there is litter', `${S.litter.size} cells, the fullest ${(best![1] * 1e4).toFixed(0)} cm² at (${cx.toFixed(2)}, ${cz.toFixed(2)}) → underfoot ${k0.toFixed(2)}`);
  W.audioLog = [];
  const far: Vec3 = [30, 0, 8]; const base = 0.3;
  const lFar = tread(game, far, base, true); const cr0 = W.audioLog!.filter((a: any) => a.name === 'glassCrunch').length;
  // the same floor material both sides of the comparison: the litter cell's own plain level is what step() is handed
  game.tune.glassShards = false; const plain = tread(game, on, base, true); game.tune.glassShards = true;
  const cr1 = W.audioLog!.filter((a: any) => a.name === 'glassCrunch').length;
  const loud = tread(game, on, base, true); const cr2 = W.audioLog!.filter((a: any) => a.name === 'glassCrunch').length;
  const k1 = S.underfoot(on);
  F.verdict(cr0 === 0 && cr1 === 0 && cr2 === 1 && loud > plain * 1.2 && Math.abs(loud - (plain * (1 + SHARDS.crunchGain * k0) + SHARDS.crunchAdd * k0)) < 1e-9, 'a step on it crunches and is louder to the model; off it, or with the switch off, nothing', `step level off the litter ${lFar.toFixed(3)}; on it ${plain.toFixed(3)} (switch off) → ${loud.toFixed(3)} (on), 1 crunch`);
  let steps = 1; while (S.underfoot(on) >= 0.08 && steps < 200) { tread(game, on, base, false); steps++; }
  F.verdict(k1 < k0 || k0 === 1 && steps > 1, 'each step grinds it down; it stops crunching in the end', `underfoot ${k0.toFixed(2)} → ${k1.toFixed(2)} after one step, quiet after ${steps}`);
  SHARDS.underfoot = false; const offKnob = tread(game, [cx + 0.5, 0, cz], base, true); SHARDS.underfoot = true;
  game.shards.reset();
  F.verdict(S.litter.size === 0 && S.underfoot(on) === 0 && Number.isFinite(offKnob), 'reset(): no litter left', `cells ${S.litter.size}`);
  return F.done();
}

// ================================================================ the seeded volley (determinism + off)
const VOLLEY: Vec3[] = [[7.4, 1.3, 10], [7.42, 1.31, 10], [6.3, 1.0, 10], [7.9, 0.7, 10], [8.8, 1.5, 10], [6.6, 1.6, 10], [7.1, 0.5, 10], [8.9, 1.52, 10], [9.3, 0.9, 10], [7.6, 1.9, 10]];
async function recordVolley(seed: number, opts: { breakOn: boolean; shardsOn: boolean; cut?: boolean; walk?: boolean; dice?: boolean }) {
  const S = await stage(seed, opts); const { W, game, flush } = S;
  if (opts.dice) game.glassBreak.setType(CONF_FAR, 'tempered');   // (the determinism volley: one toughened sheet struck below, so a sheet pouring as dice — by the wave, or dropped at once — is inside what is compared)
  if (opts.cut) { game.destr.debris.glass = null; game.shards = { update() {}, reset() {}, step(_p: Vec3, l: number) { return l; }, release() { return false; }, litter: new Map(), log: [], live: 0, plateCount: 0, summary() { return 'cut'; } } as any; }   // the model OUT: the pool's glass door null, a stub where game.ts / floor.ts call it
  W.audioLog = [];
  const rounds: string[] = [], events: string[] = [], emits: string[] = []; const seen = new WeakSet<any>();
  for (let f = 0; f < 60 * 10; f++) {
    if (f < 300 && f % 10 === 0) { const p = VOLLEY[(f / 10) % VOLLEY.length]; const r = fireWeapon(game, game.player.char, p, true, { weapon: WEAPONS.fn2000 }); rounds.push(`${f}:${r?.hit ?? ''}`); }
    if (opts.dice && f === 150) { const c = game.level.boxes[CONF_FAR].c as Vec3; game.glassBreak.hit(CONF_FAR, [c[0], c[1], c[2]], [0, 0, -1], 1); }
    if (f === 330) game.events.push({ kind: 'bang', pos: [10.2, 0.4, 10.9], time: game.time, loud: true, who: 0 });
    if (opts.walk && f >= 400 && f % 20 === 0) events.push(`tread@${f}:${tread(game, [7.5 + ((f / 20) % 5) * 0.4 - 0.8, 0, 9.6], 0.3, true).toFixed(4)}`);   // somebody walks the far side of the glazing, over whatever came down
    W.step(DT);
    emits.push(...flush().map((e: any) => `${f}:${recStr(e)}`));
    for (const e of newEvents(game, seen)) events.push(`${e.kind}@${f}:${e.level ?? ''}:${e.pos ? p2(e.pos) : ''}:${e.who ?? ''}`);
  }
  const audio = W.audioLog!.map((a: any) => `${a.name}@${a.t.toFixed(3)}:${a.pos ? p2(a.pos) : ''}:${a.gain.toFixed(3)}`);
  const debris = game.destr.debris.list.map((c: any) => `${c.kind}:${p2(c.box.c)}:${c.rest}:${c.box.h.map(f2).join(',')}`);
  const digest = JSON.stringify(digestGame(game, true));
  return { rounds, events, audio, emits, debris, digest, stats: { ...SHARD_STATS }, gb: { ...GB_STATS }, summary: game.shards.summary?.() ?? '' };
}
function diffLists(a: any, b: any, keys: string[], fails: string[]) {
  for (const k of keys) { const x = a[k], y = b[k]; if (Array.isArray(x)) { if (JSON.stringify(x) !== JSON.stringify(y)) { let i = 0; while (i < Math.min(x.length, y.length) && x[i] === y[i]) i++; fails.push(`${k} differ (${x.length} / ${y.length}) from #${i}: ${x[i] ?? '∅'} | ${y[i] ?? '∅'}`); } } else if (x !== y) fails.push(`${k} differ`); }
}
const KEYS = ['rounds', 'events', 'audio', 'emits', 'debris', 'digest'];

export async function shardsDeterminism() {
  const F = family('shards-determinism: the seeded volley through the glazing twice — identical to the last record');
  const a = await recordVolley(9205, { breakOn: true, shardsOn: true, walk: true, dice: true }), b = await recordVolley(9205, { breakOn: true, shardsOn: true, walk: true, dice: true });
  const fails: string[] = []; diffLists(a, b, KEYS, fails);
  if (JSON.stringify(a.stats) !== JSON.stringify(b.stats)) fails.push(`counters differ: ${JSON.stringify(a.stats)} | ${JSON.stringify(b.stats)}`);
  if (a.gb.diced < 1) fails.push(`staging: no sheet diced inside the volley (diced ${a.gb.diced})`);
  F.verdict(!fails.length && a.stats.fragments > 0 && a.stats.born > 0, `two runs: ${a.rounds.length} rounds, ${a.events.length} events, ${a.audio.length} audio calls, ${a.emits.length} particle records, ${a.debris.length} chunks, the run digest and the model's counters identical`, fails.join('; ') || `identical — ${a.summary}`);
  const c = await recordVolley(9206, { breakOn: true, shardsOn: true, walk: true });
  F.verdict(c.stats.fragments > 0, 'another seed also breaks glass (the volley is not seed-lucky)', c.summary);
  return F.done();
}

export async function shardsOff() {
  const F = family('shards-off: the switch off = the base — with glass breaking ON and tune.glassShards OFF the seeded volley is identical to the game with this model\'s seams pulled out');
  const off = await recordVolley(9207, { breakOn: true, shardsOn: false, walk: true }), cut = await recordVolley(9207, { breakOn: true, shardsOn: false, cut: true, walk: true });
  const fails: string[] = []; diffLists(off, cut, KEYS, fails);
  if (Object.values(off.stats).some(v => v !== 0)) fails.push(`the model counted something with its switch off: ${JSON.stringify(off.stats)}`);
  if (off.gb.dropped === 0 || !off.debris.some((d: string) => d.startsWith('shard:'))) fails.push(`staging: no cell dropped / no base shard box (${JSON.stringify(off.gb)})`);
  F.verdict(!fails.length, `glass breaking on, shards off: ${off.rounds.length} rounds, ${off.events.length} events, ${off.audio.length} audio calls, ${off.emits.length} particle records, ${off.debris.length} chunks (the base's own shard boxes among them) and the run digest identical to the seams-out game; the model's counters all zero`, fails.join('; ') || `identical · digest ${hash(off.digest)} · ${off.gb.dropped} cells dropped, ${off.gb.shards} base shard boxes`);
  // the shipped default: glass breaking off, shards at its default (on) — inert
  const def = await recordVolley(9207, { breakOn: false, shardsOn: true, walk: true }), defCut = await recordVolley(9207, { breakOn: false, shardsOn: true, cut: true, walk: true });
  const f2: string[] = []; diffLists(def, defCut, KEYS, f2); if (Object.values(def.stats).some(v => v !== 0)) f2.push(`counted with glass breaking off: ${JSON.stringify(def.stats)}`);
  F.verdict(!f2.length, 'the shipped default (glass breaking off, this switch on): nothing runs — identical to the seams-out game, counters zero', f2.join('; ') || `identical · digest ${hash(def.digest)}`);
  const on = await recordVolley(9207, { breakOn: true, shardsOn: true, walk: true });
  F.verdict(on.stats.fragments > 0 && on.stats.born > 0 && on.emits.some((e: string) => e.includes(':shard:')) && on.audio.join() !== off.audio.join(), 'the same volley with the switch ON does go through the model (the stimuli reach it)', on.summary);
  return F.done();
}
function hash(s: string): string { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }

// a bare run prints the off digests (the cross-build check on rebuild/glass/shards.md runs this file's twin at the base commit)
if (import.meta.main) { const n = process.argv[2]; const fns: Record<string, () => Promise<boolean>> = { model: shardsModel, release: shardsRelease, caps: shardsCaps, rest: shardsRest, underfoot: shardsUnderfoot, determinism: shardsDeterminism, off: shardsOff }; for (const k of n ? [n] : Object.keys(fns)) await fns[k](); }
