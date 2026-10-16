// GLASS FRACTURE probes (game/glassbreak.ts + glassPattern.ts, rebuild/glass/fracture.md) — `bun run tools/qa/probes.ts glassbreak` (the family; every probe also answers to its
// own name and, but for the two long ones, runs under `glass`):
//   glassbreak-off          the switch OFF = the game byte for byte: a seeded corridor volley into the conference glazing + a charge beside it at chaos 0.5 digests identically with
//                           tune.glassBreak false and with the module's hooks pulled out altogether (rounds, events, audio, particle records, decals, statics' flags); its counters stay 0
//   glassbreak-gate         nothing at chaos 0, nothing under the tour, nothing with the switch off; the same stimuli register at chaos 0.5 with it on
//   glassbreak-pattern      BY TYPE: annealed = a star of 9‥12 radials with nested chords, the crater punched, pieces that tile the pane exactly (areas sum, convex, point-in-piece ≡
//                           classify), the cracks RUN at breakE and daggers appear (forked, some snapped); a soft blow cracks without punching; tempered dices whole in a ragged wave outward from the blow;
//                           laminated webs (10‥12 radials) and never opens to rounds
//   glassbreak-support      RELEASE BY SUPPORT: after a pane runs and settles nothing intact is unheld and every intact piece is joined to the frame; knocking out the piece others
//                           stand on brings them down LATER (staggered, cause 'support'); holes only grow
//   glassbreak-release      THE RELEASE HOOK: one call per fragment — a convex outline on the pane's middle plane, anticlockwise from the side it leaves by, 3‥12 points, the area
//                           and centre its own, leaving away from the blow; the areas handed over = the area open; with the hook set no stand-in shard is spawned, without it they are
//   glassbreak-open         ONE MODEL: openAt (the CPU rule) ≡ what raycast / solidBlocked do through the pane ≡ the rule common.wgsl runs over the very rows handed to the GPU —
//                           on a starred pane, a run pane with daggers out, and a tempered pane mid-wave
//   glassbreak-blast        blast(at, {radius, power}): panes in reach break by type and by strength (tempered dices, annealed runs and loses what is near, laminated crazes, and
//                           leaves its frame whole when close), a pane out of reach keeps no record, pieces fly away from the blast; a stun charge's 'bang' arrives weaker
//   glassbreak-seams        THE SIBLING SEAMS: glassImpact's `through` verdict (a caller that judged the round itself: true = a hole / dices, false = cracks only, absent = the energy
//                           decides; laminated never opens); one blast fed twice (blast() + its own 'bang' event, or g.destr.onBlast + 'bang') is one blow; a GlassBreak built over a
//                           destr with onBlast listens and adds its panes to res.panes; outside glass found per level from open sky over one face (office 15 / 22, records 7 / 7, registry 6 / 7)
//   glassbreak-walk         the movement rule: a pane pushes a walker's circle out until every piece below 1.9 m has gone (teeth in the frame aside), then lets it through; solidBlocked agrees; the nav grid is untouched
//   glassbreak-caps         ≤ 8 sites a pane, queued pieces ≤ releasesPerFrame a frame, clumps ≤ clumpsPerFrame (+ ties), the debris pool never over its cap, every record finite
//   glassbreak-reset        reset() / a restart: every pane whole, the gust sources out of the wind, the shards gone with the debris; levelFingerprint untouched by holes
//   glassbreak-gust         a diced EXTERIOR pane in the storm registers one 'glass' wind source whose base follows the storm × the open share; an interior pane never does
//   glassbreak-determinism  the same seeded volley + charge twice → identical pane records, fragment streams, debris rest poses, events, particle records, log
import { standUp, ROOT, fake } from './headless.ts';
import { CONF_PANE, CONF_FAR } from './office-pane.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const { Particles } = await import(`${ROOT}/src/render/particles.ts`);
const GBM = await import(`${ROOT}/src/game/glassbreak.ts`);
const GP = await import(`${ROOT}/src/game/glassPattern.ts`);
const { glassImpact } = await import(`${ROOT}/src/game/glass.ts`);
const { levelFingerprint } = await import(`${ROOT}/src/game/savestate.ts`);
const { GB_STRIDE } = await import(`${ROOT}/src/scene/boxes.ts`);
const { GLASSBREAK, GB_STATS, GB_RECORD_ROWS } = GBM;

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

// the pane = the conference partition's second sheet (by where it stands: office-pane.ts): c (7.5, 1.5, 10), h (0.5, 1, 0.006), yaw 0 → annealed; u = x − 7.5, v = y − 1.5. Sam stands in the corridor south of it.
const PANE = CONF_PANE; const FAR = CONF_FAR;
const W_ = (u: number, v: number): Vec3 => [7.5 + u, 1.5 + v, 10];
const IN: Vec3 = [0, 0, -1];   // a round from the corridor into the room
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
  const frags: any[] = []; const hook = () => { game.glassBreak.onRelease = (f: any) => frags.push({ ...f, t: game.time }); };
  const settle = (s = 2) => { for (let i = 0; i < Math.round(s * 60); i++) W.step(DT); };
  return { W, game, engine, P, flush, gb: game.glassBreak, frags, hook, settle };
}
const fragSig = (f: any) => `${f.t.toFixed(3)}:${f.pane}:${f.kind}:${f.cause}:${f.area.toFixed(5)}:${f.outline.map((p: Vec3) => p.map(x => x.toFixed(3)).join(',')).join(';')}:${f.velocity.map((x: number) => x.toFixed(3)).join(',')}:${f.seed}`;
const paneSig = (st: any) => `${st.bi}:${st.type}:${st.hits}:${st.energy.toFixed(2)}:${st.run ? 'run' : ''}:${st.gone ? 'gone' : ''}:${st.nOpen}:${Array.from(st.open as Uint8Array).map((x, i) => x ? i : -1).filter(i => i >= 0).join(',')}:${st.sites.map((s: any) => `${s.u.toFixed(4)},${s.v.toFixed(4)},${s.n},${s.seed},${s.rz.toFixed(4)},${s.e.toFixed(2)}`).join(';')}:${st.dice ? `dice${st.dice.next}/${st.dice.clumps.length}` : ''}`;
/** the volley: 30 rounds walked over panes 109‥111 from the corridor (some spots twice), then a stun charge's bang event beside pane 112 — 8 s in all */
const VOLLEY: Vec3[] = [[7.4, 1.3, 10], [7.42, 1.31, 10], [6.3, 1.0, 10], [7.9, 0.7, 10], [8.8, 1.5, 10], [6.6, 1.6, 10], [7.1, 0.5, 10], [8.9, 1.52, 10], [9.3, 0.9, 10], [7.6, 1.9, 10]];
async function recordVolley(seed: number, on: boolean, cut = false) {
  const S = await stage(seed, 0.5, on); const { W, game, engine, flush } = S;
  if (cut) {   // the module OUT: its seams null (collision / boxes as before the port), a stub where glass.ts / game.ts call it
    game.col.glassOpen = null; game.col.glassWalkable = null; engine.world.glassCellFill = null; engine.world.glassOpen = null;
    game.glassBreak = { impact: () => ({ pane: true, live: false, type: 'laminated', thickness: 0.012, wasOpen: false, punched: false, diced: false, released: 0, cracked: false }), typeOfPane: () => 'laminated', hit() {}, blast: () => 0, bang: () => 0, update() {}, reset() {}, openAt: () => false, walkable: () => false, panes: new Map() } as any;
  }
  const frags: any[] = []; if (!cut) game.glassBreak.onRelease = null;
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
  const panes = [...(game.glassBreak.panes?.values?.() ?? [])].map(paneSig).join('|');
  void frags;
  return { rounds, events, audio, emits, decals, props, flags, debris, panes, log: [...game.glassBreak.log ?? []], stats: { ...GB_STATS }, sam: p2(game.player.char.pos) };
}
function diffLists(a: any, b: any, keys: string[], fails: string[]) {
  for (const k of keys) { const x = a[k], y = b[k]; if (Array.isArray(x)) { if (JSON.stringify(x) !== JSON.stringify(y)) { let i = 0; while (i < Math.min(x.length, y.length) && x[i] === y[i]) i++; fails.push(`${k} differ (${x.length} / ${y.length}) from #${i}: ${x[i] ?? '∅'} | ${y[i] ?? '∅'}`); } } else if (x !== y) fails.push(`${k} differ`); }
}
const inPoly = (pts: [number, number][], u: number, v: number) => { let s = 0; for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; const c = (b[0] - a[0]) * (v - a[1]) - (b[1] - a[1]) * (u - a[0]); if (c < -1e-9) return false; s++; } return s >= 3; };
const convexCCW = (pts: [number, number][]) => { for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length], c = pts[(k + 2) % pts.length]; if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -1e-9) return false; } return true; };

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
  F.verdict(took, 'the same volley with the switch ON does take glass out (the probe\'s stimuli reach the module)', `stats ${JSON.stringify(on.stats)}`);
  return F.done();
}

// ================================================================ the gate
export async function glassbreakGate() {
  const F = family('glassbreak-gate: chaos 0, the tour and the switch each make impact / blast inert; chaos 0.5 with the switch on registers');
  const { game, gb } = await stage(9102, 0.5, true);
  const g0 = { ...GB_STATS }; let last: any = null;
  const poke = () => { last = gb.impact(PANE, W_(0.1, 0.1), IN, 1, 1); gb.blast([7.5, 0.6, 10.8], { who: 1 }); gb.bang([7.5, 0.6, 10.8], 1); };
  const quiet = () => gb.panes.size === 0 && GB_STATS.impacts === g0.impacts && GB_STATS.blasts === g0.blasts && last.pane === true && last.live === false && !last.punched;
  game.tune.chaos = 0; poke();
  F.verdict(quiet(), 'chaos 0: impact / blast / bang do nothing, the answer says not live', `panes ${gb.panes.size} impacts +${GB_STATS.impacts - g0.impacts} blasts +${GB_STATS.blasts - g0.blasts} answer ${JSON.stringify(last)}`);
  game.tune.chaos = 0.5; game.touring = true; poke();
  F.verdict(quiet(), 'under the tour at chaos 0.5: nothing', `panes ${gb.panes.size}`);
  game.touring = false; game.tune.glassBreak = false; poke();
  F.verdict(quiet(), 'the switch off at chaos 0.5: nothing', `panes ${gb.panes.size} live ${GBM.glassBreakLive(game)}`);
  const notPane = gb.impact(0, [0, 0, 0], IN, 1, 1);
  F.verdict(notPane.pane === false, 'a box that is not glass answers pane: false', JSON.stringify(notPane));
  game.tune.glassBreak = true; const r = gb.impact(PANE, W_(0.1, 0.1), IN, 1, 1);
  F.verdict(gb.panes.size === 1 && GB_STATS.impacts === g0.impacts + 1 && GBM.glassBreakLive(game) && r.live && r.punched && r.type === 'annealed' && Math.abs(r.thickness - 0.012) < 1e-9, 'chaos 0.5, switch on, no tour: the same blow registers and punches', `panes ${gb.panes.size} impacts +${GB_STATS.impacts - g0.impacts} answer ${JSON.stringify(r)}`);
  return F.done();
}

// ================================================================ the pattern, by type
export async function glassbreakPattern() {
  const F = family('glassbreak-pattern: annealed stars, runs and leaves daggers; a soft blow only cracks; tempered dices whole in a wave; laminated webs and holds');
  const { W, game, gb, frags, hook, settle } = await stage(9110, 0.5, true); hook();
  // ---- annealed: one round
  const r1 = glassImpact(game, PANE, W_(-0.1, -0.2), IN, 1, 1); const st = gb.panes.get(PANE)!; const S0 = st.sites[0];
  let nest = true, fan = true; for (let k = 0; k < S0.n; k++) { for (let b = 0; b < 2; b++) nest &&= GP.gpRho(S0, k, b) < GP.gpRho(S0, k, b + 1) && GP.gpRho(S0, k + 1, b) < GP.gpRho(S0, k, b + 1); const w = GP.gpBound(S0, k + 1) - GP.gpBound(S0, k); fan &&= w > 0.3 && w < S0.n / 2; }
  // the crack picture round the site: walking a circle between chords 0 and 1 crosses exactly n radial cracks
  let crossings = 0, was = false; const rr = (S0.rho[0] * (GP.GP_RHO_LO + GP.GP_RHO_SPAN) + S0.rho[1] * GP.GP_RHO_LO) / 2;
  for (let a = 0; a < 3600; a++) { const t = a / 3600 * Math.PI * 2; const d = GP.gpCrackAt(st.sites, st.run, false, S0.u + rr * Math.cos(t), S0.v + rr * Math.sin(t)).d; const on = d < rr * 0.004; if (on && !was) crossings++; was = on; }
  const fr1 = GP.gpFragments(st.sites, st.run, st.hu, st.hv); let merged = 0; for (let k = 0; k < S0.n; k++) if (GP.gpMerged(S0, k)) merged++;
  F.verdict(r1.live && r1.punched && !r1.diced && st.sites.length === 1 && S0.n >= 9 && S0.n <= 12 && nest && fan && !st.run, 'annealed, one round: ONE star of 9‥12 radials at hashed bearings (no sector over 180°), its three chords nested on every radial, the pane not run',
    `radials ${S0.n}, chord base radii ${S0.rho.map((x: number) => (x * 100).toFixed(1)).join(' / ')} cm, ring zone ${(S0.rz * 100).toFixed(1)} cm, nest ${nest}, fan ${fan}, answer ${JSON.stringify(r1)}`);
  F.verdict(crossings === S0.n, 'the crack picture (gpCrackAt, the shader\'s reference): a circle between the first two chords crosses exactly as many radial cracks as the site has', `${crossings} crossings at r ${(rr * 100).toFixed(1)} cm for ${S0.n} radials`);
  const craterOpen = gb.openAt(PANE, W_(-0.1, -0.2)), ringShut = !gb.openAt(PANE, W_(-0.1 + S0.rho[1], -0.2)), farShut = !gb.openAt(PANE, W_(0.3, 0.6));
  F.verdict(craterOpen && ringShut && farShut && gb.openFraction(PANE) < 0.01 && frags.length === 1 && frags[0].kind === 'piece' && frags[0].grain > 0 && fr1.length === 3 * S0.n - merged && fr1.every((f: any) => f.b <= 2), 'the round punched the crater (one fragment, powder) and nothing else: the rings of pieces stand round the hole (a merged sector has one piece where its neighbours have two), no daggers yet',
    `crater open ${craterOpen}, ring piece shut ${ringShut}, far glass shut ${farShut}, open ${(100 * gb.openFraction(PANE)).toFixed(2)}%, pieces ${fr1.length} (= 3 × ${S0.n} − ${merged} merged), fragments out ${frags.length} (${frags[0]?.kind}, grain ${frags[0]?.grain})`);
  // ---- a second and third round: the pane runs at breakE.annealed
  glassImpact(game, PANE, W_(0.2, 0.3), IN, 1, 1); const run2 = st.run; glassImpact(game, PANE, W_(-0.25, 0.5), IN, 1, 1);
  const fr3 = GP.gpFragments(st.sites, st.run, st.hu, st.hv); const area = fr3.reduce((a: number, f: any) => a + f.area, 0);
  const rnd = seeded(5); let mis = 0, n = 0; const by = new Map<number, any>(fr3.map((f: any) => [f.fid, f]));
  for (let k = 0; k < 4000; k++) { const u = (rnd() * 2 - 1) * st.hu, v = (rnd() * 2 - 1) * st.hv; const fid = GP.gpClassify(st.sites, st.run, u, v); const f = by.get(fid); n++; if (!f || !inPoly(f.pts, u, v)) mis++; }
  const daggers = fr3.filter((f: any) => f.b >= 3); const longest = Math.max(...daggers.map((f: any) => Math.max(...f.pts.map((p: number[]) => Math.hypot(p[0] - st.sites[f.i].u, p[1] - st.sites[f.i].v)))));
  F.verdict(!run2 && st.run && st.sites.length === 3 && Math.abs(area - 4 * st.hu * st.hv) < 1e-6 && mis === 0 && fr3.every((f: any) => convexCCW(f.pts) && f.area > 0) && daggers.length >= 12 && daggers.some((f: any) => f.b >= 5) && daggers.every((f: any) => f.frame.bottom + f.frame.top + f.frame.left + f.frame.right > 0 || f.nb.length > 0), `three rounds (breakE.annealed ${GLASSBREAK.breakE.annealed}): not run after two, RUN after the third — the pieces now tile the whole pane, every one convex, daggers out to the frame`,
    `run after 2: ${run2}, after 3: ${st.run}; ${fr3.length} pieces, areas sum ${area.toFixed(6)} of ${(4 * st.hu * st.hv).toFixed(6)} m²; ${mis} of ${n} seeded points land outside the piece classify names; ${daggers.length} daggers (${daggers.filter((f: any) => f.b >= 5).length} snapped-off far ends), the longest reaching ${longest.toFixed(2)} m from its site`);
  settle(2);
  F.verdict(st.nOpen > 3 * 7 && frags.some((f: any) => f.kind === 'dagger' && f.cause === 'support') && gb.openFraction(PANE) > 0.02 && gb.openFraction(PANE) < 0.9, 'settled: daggers have let go by the support rule, and glass is left in the frame (neither whole nor gone)', `open ${(100 * gb.openFraction(PANE)).toFixed(0)}%, fragments out ${frags.length}: ${frags.filter((f: any) => f.kind === 'dagger').length} daggers (${frags.filter((f: any) => f.cause === 'support').length} by support)`);
  // ---- a soft blow cracks, does not punch; one hard blow runs a pane by itself
  gb.setType(FAR, 'annealed'); const fc = game.level.boxes[FAR].c as Vec3; const soft = glassImpact(game, FAR, [fc[0] + 0.1, fc[1], fc[2]], IN, 0.3, 1); const stF = gb.panes.get(FAR)!;
  F.verdict(soft.live && !soft.punched && soft.released === 0 && stF.sites.length === 1 && stF.nOpen === 0, `a blow under punchE (${GLASSBREAK.punchE}): a star, nothing out`, `answer ${JSON.stringify(soft)}; sites ${stF.sites.length}, open pieces ${stF.nOpen}`);
  gb.setType(FAR, 'annealed'); const hard = glassImpact(game, FAR, [fc[0] + 0.1, fc[1], fc[2]], IN, GLASSBREAK.runSingleE, 1);
  F.verdict(hard.punched && gb.panes.get(FAR)!.run, `one blow of runSingleE (${GLASSBREAK.runSingleE}) runs the pane at once`, `answer ${JSON.stringify(hard)}; run ${gb.panes.get(FAR)!.run}`);
  // ---- tempered: dices whole, as a wave outward
  settle(2); gb.setType(PANE, 'tempered'); frags.length = 0;   // (the far pane's daggers have come down by now: only this pane's clumps follow)
  const t0 = game.time; const rt = glassImpact(game, PANE, W_(0.1, -0.3), IN, 1, 1); const stT = gb.panes.get(PANE)!;
  const immediate = gb.openAt(PANE, W_(0.1, -0.3)), cornerShut = !gb.openAt(PANE, W_(-0.45, 0.95));
  W.step(DT); W.step(DT); const part = gb.openFraction(PANE); settle(1);
  let mono = true; for (let k = 1; k < frags.length; k++) mono &&= frags[k].t >= frags[k - 1].t;
  const dist = (f: any) => Math.hypot(f.centre[0] - 7.6, f.centre[1] - 1.2); const third = Math.floor(frags.length / 3); const mean = (a: any[]) => a.reduce((x, f) => x + dist(f), 0) / Math.max(1, a.length); const keys = stT.dice!.clumps.map((c: any) => c.key); let sorted = true; for (let k = 1; k < keys.length; k++) sorted &&= keys[k] >= keys[k - 1];
  const wave = sorted && frags.length === keys.length && mean(frags.slice(0, third)) < mean(frags.slice(third, 2 * third)) && mean(frags.slice(third, 2 * third)) < mean(frags.slice(-third)) && new Set(frags.map((f: any) => f.outline.length)).size >= 2;
  const aT = frags.reduce((a: number, f: any) => a + f.area, 0); const span = frags[frags.length - 1].t - t0;
  F.verdict(rt.diced && rt.punched && immediate && cornerShut && part > 0 && part < 1 && stT.gone && gb.openFraction(PANE) === 1 && frags.every((f: any) => f.kind === 'clump' && f.grain === GLASSBREAK.diceGrain && f.cause === 'dice') && Math.abs(aT - 4 * stT.hu * stT.hv) < 1e-6 && wave && mono && span > 0.15 && span < 1.2, `tempered, one round (breakE.tempered ${GLASSBREAK.breakE.tempered}): the WHOLE pane dices — open under the round at once, the far corner a moment later, irregular clumps leaving in a ragged wave outward from the blow (in order of distance + a hashed delay)`,
    `answer ${JSON.stringify(rt)}; open at the blow at once ${immediate}, far corner still in ${cornerShut}, ${(100 * part).toFixed(0)}% open two frames on, gone after ${span.toFixed(2)} s; ${frags.length} clumps (grain ${GLASSBREAK.diceGrain} m) totalling ${aT.toFixed(4)} m²; outward wave ${wave} (mean distance by thirds ${f2(mean(frags.slice(0, third)))} / ${f2(mean(frags.slice(third, 2 * third)))} / ${f2(mean(frags.slice(-third)))} m)`);
  // ---- laminated: a web that never opens to rounds
  gb.setType(PANE, 'laminated'); frags.length = 0; const rnd2 = seeded(11); let anyPunch = false;
  for (let k = 0; k < 25; k++) { const r = glassImpact(game, PANE, W_((rnd2() * 2 - 1) * 0.45, (rnd2() * 2 - 1) * 0.95), IN, k % 5 === 4 ? 2.6 : 1, 1); anyPunch ||= r.punched || r.diced || r.released > 0; }
  settle(1); const stL = gb.panes.get(PANE)!; let shut = true; for (let k = 0; k < 400; k++) shut &&= !gb.openAt(PANE, W_((rnd2() * 2 - 1) * 0.49, (rnd2() * 2 - 1) * 0.99));
  const through = game.col.raycast([7.5, 1.5, 10.3], IN, 0.6);
  F.verdict(!anyPunch && shut && frags.length === 0 && stL.sites.length >= 3 && stL.sites.length <= GLASSBREAK.maxSites && stL.sites.every((s: any) => s.n >= 10 && s.n <= 12) && !stL.run && through?.index === PANE && !gb.walkable(PANE), 'laminated, 25 rounds (five of rifle weight): a web of stars with 10‥12 radials each, nothing ever opens, a ray still stops in it',
    `sites ${stL.sites.length} (radials ${stL.sites.map((s: any) => s.n).join(',')}), energy ${stL.energy.toFixed(1)}, punched/released ${anyPunch}, 400 points all shut ${shut}, fragments ${frags.length}, raycast hits ${through?.index}`);
  return F.done();
}

// ================================================================ release by support
export async function glassbreakSupport() {
  const F = family('glassbreak-support: after a pane runs, what nothing holds falls a beat later; what is left is held and joined to the frame; shooting out a piece others stand on brings them down');
  const { W, game, gb, frags, hook, settle } = await stage(9111, 0.5, true); hook();
  const fracs: number[] = [];
  for (const [u, v] of [[-0.1, -0.2], [0.2, 0.3], [-0.25, 0.5]] as [number, number][]) { glassImpact(game, PANE, W_(u, v), IN, 1, 1); fracs.push(gb.openFraction(PANE)); }
  const st = gb.panes.get(PANE)!; const tRun = game.time; const before = frags.length;
  W.step(DT); const sameFrame = frags.length - before;
  settle(3);
  const fell = frags.slice(before).filter((f: any) => f.cause === 'support'); const times = fell.map((f: any) => f.t - tRun);
  F.verdict(st.run && fell.length >= 2 && sameFrame === 0 && Math.min(...times) >= GLASSBREAK.think - 1e-6 && new Set(times.map((t: number) => t.toFixed(3))).size >= 2, 'the pane runs on the third round: unheld daggers let go LATER (after the support think) and staggered, not with the round',
    `${fell.length} pieces by support, the first ${Math.min(...times).toFixed(2)} s and the last ${Math.max(...times).toFixed(2)} s after the round; ${sameFrame} in the round's own frame`);
  const all = GP.gpFragments(st.sites, st.run, st.hu, st.hv); const intact = all.filter((f: any) => !st.open[f.fid]); const held = gb.heldSet(st);
  // joined to the frame: flood from pieces on the frame through shared cracks (an independent test from the held rule)
  const by = new Map<number, any>(intact.map((f: any) => [f.fid, f])); const seen = new Set<number>(); const q: any[] = intact.filter((f: any) => f.frame.bottom + f.frame.top + f.frame.left + f.frame.right > 1e-6); q.forEach(f => seen.add(f.fid));
  while (q.length) { const f = q.pop(); for (const nb of f.nb) { const o = by.get(nb.fid); if (o && !seen.has(o.fid)) { seen.add(o.fid); q.push(o); } } }
  F.verdict(intact.length > 5 && intact.every((f: any) => held.has(f.fid)) && seen.size === intact.length && st.pending.length === 0, 'settled: every piece still in is HELD by the rule, none is queued, and every one is joined to the frame through pieces still in (nothing floats)',
    `${intact.length} of ${all.length} pieces in (${(100 * gb.openFraction(PANE)).toFixed(0)}% open), held ${intact.filter((f: any) => held.has(f.fid)).length}, joined to the frame ${seen.size}, pending ${st.pending.length}`);
  // independent of heldSet's walk: a piece with no footing at all (not on the sill, nothing intact under it) must be within the hanging limit for the MOST grip it could have
  const K = GLASSBREAK; const maxGrip = (f: any) => (f.frame.left + f.frame.right + f.frame.bottom) * K.grip.side + f.frame.top * K.grip.top + f.nb.filter((nb: any) => by.has(nb.fid)).reduce((a: number, nb: any) => a + nb.len, 0) * K.grip.wedged;
  const bigHang = intact.filter((f: any) => !f.foot && !f.nb.some((nb: any) => nb.ny < -K.standNy && by.has(nb.fid)) && f.area > K.hangArea * maxGrip(f) + 1e-9);
  F.verdict(bigHang.length === 0, 'no big piece is left hanging: anything still in with no footing under it is within the hanging limit for its grip on the frame and its neighbours', `hanging limit ${K.hangArea} m² per metre of grip; ${intact.filter((f: any) => !f.foot && !f.nb.some((nb: any) => nb.ny < -K.standNy && by.has(nb.fid))).length} pieces hang, ${bigHang.length} over the limit${bigHang.length ? ': ' + bigHang.map((f: any) => `${f.i}:${f.b}:${f.s} ${f.area.toFixed(3)} m² on ${maxGrip(f).toFixed(2)} m`).join(', ') : ''}`);
  // a piece others stand on: find a held piece Q whose loss leaves ≥ 1 other piece unheld, knock it out, and see them follow
  let pick: any = null, deps: number[] = [];
  for (const f of intact) { st.open[f.fid] = 1; const h2 = gb.heldSet(st); st.open[f.fid] = 0; const lost = intact.filter((o: any) => o.fid !== f.fid && !h2.has(o.fid)).map((o: any) => o.fid); if (lost.length > deps.length) { deps = lost; pick = f; } }
  if (!pick) { F.verdict(false, 'staging: some piece holds another up', 'none found'); return F.done(); }
  const f0 = gb.openFraction(PANE); const n0 = frags.length; const tHit = game.time;
  const rk = glassImpact(game, PANE, W_(pick.cen[0], pick.cen[1]), IN, 1, 1); const atOnce = gb.openAt(PANE, W_(pick.cen[0], pick.cen[1])); const depsAtOnce = deps.filter(fid => st.open[fid]).length;
  settle(3);
  const depsOut = deps.filter(fid => st.open[fid]).length; const later = frags.slice(n0).filter((f: any) => f.cause === 'support');
  F.verdict(rk.punched && rk.released >= 1 && atOnce && depsAtOnce === 0 && depsOut === deps.length && later.length >= deps.length && later.every((f: any) => f.t > tHit) && gb.openFraction(PANE) > f0, `a round on piece ${pick.i}:${pick.b}:${pick.s} (the footing of ${deps.length} other${deps.length > 1 ? 's' : ''}): it goes at once, the pieces that stood on it follow a beat later`,
    `answer ${JSON.stringify(rk)}; open at the round at once ${atOnce}; dependents out in the same call ${depsAtOnce}, after settling ${depsOut} of ${deps.length}; ${later.length} more by support; open ${(100 * f0).toFixed(0)}% → ${(100 * gb.openFraction(PANE)).toFixed(0)}%`);
  // holes only grow
  const rnd = seeded(3); let grew = true, prev = gb.openFraction(PANE); const openPts: [number, number][] = []; for (let k = 0; k < 600; k++) { const u = (rnd() * 2 - 1) * 0.49, v = (rnd() * 2 - 1) * 0.99; if (gb.openAt(PANE, W_(u, v))) openPts.push([u, v]); }
  for (let k = 0; k < 8; k++) { glassImpact(game, PANE, W_((rnd() * 2 - 1) * 0.45, (rnd() * 2 - 1) * 0.95), IN, 1, 1); settle(0.8); const f = gb.openFraction(PANE); grew &&= f >= prev - 1e-9; prev = f; }
  const closed = openPts.filter(([u, v]) => !gb.openAt(PANE, W_(u, v))).length;
  F.verdict(grew && closed === 0 && fracs[0] < fracs[2] && prev > f0, 'holes only grow: eight more rounds never lower the open share and close no point that was open', `open share after rounds 1‥3 ${fracs.map(x => (100 * x).toFixed(1)).join(' / ')}%, now ${(100 * prev).toFixed(0)}%; ${openPts.length} open points re-tested, ${closed} closed`);
  return F.done();
}

// ================================================================ the release hook
export async function glassbreakRelease() {
  const F = family('glassbreak-release: one onRelease call per fragment, with an outline the shards part can build from; the stand-in runs only while nobody is attached');
  const { game, gb, frags, hook, settle } = await stage(9112, 0.5, true); hook();
  for (const [u, v] of [[-0.1, -0.2], [0.2, 0.3], [-0.25, 0.5], [0.1, -0.6]] as [number, number][]) { glassImpact(game, PANE, W_(u, v), IN, 1, 1); settle(1.5); }
  const st = gb.panes.get(PANE)!; const bad: string[] = []; let area = 0;
  for (const f of frags) {
    const uv = f.outline.map((p: Vec3) => [p[0] - 7.5, p[1] - 1.5] as [number, number]); area += f.area;
    const tag = `${f.kind}@${f.t.toFixed(2)}`;
    if (f.outline.length < 3 || f.outline.length > 12) bad.push(`${tag}: ${f.outline.length} points`);
    if (f.outline.some((p: Vec3) => Math.abs(p[2] - 10) > 1e-6)) bad.push(`${tag}: off the middle plane`);
    if (Math.abs(v3.len(f.normal) - 1) > 1e-6 || Math.abs(Math.abs(f.normal[2]) - 1) > 1e-6 || f.normal[2] > 0) bad.push(`${tag}: normal ${p2(f.normal)} (the rounds flew −z)`);
    // anticlockwise seen from the side the normal points to (−z here): looking along +z, x runs to the LEFT — so in (x, y) the polygon reads clockwise
    if (!convexCCW(uv.slice().reverse())) bad.push(`${tag}: not convex / not anticlockwise from the normal's side`);
    const A = GP.gpPolyArea(uv); if (Math.abs(A.area - f.area) > 1e-6) bad.push(`${tag}: area ${f.area} vs its outline's ${A.area}`);
    if (Math.hypot(A.cen[0] - (f.centre[0] - 7.5), A.cen[1] - (f.centre[1] - 1.5)) > 1e-6) bad.push(`${tag}: centre off its outline's centroid`);
    if (!f.velocity.every(Number.isFinite) || !f.spin.every(Number.isFinite) || f.velocity[2] >= 0) bad.push(`${tag}: velocity ${p2(f.velocity)}`);
    if (f.pane !== PANE || f.type !== 'annealed' || Math.abs(f.thickness - 0.012) > 1e-9 || f.who !== 1 || !(f.seed >= 0)) bad.push(`${tag}: header`);
    if (f.tint[0] !== st.box.albedo[0]) bad.push(`${tag}: tint`);
  }
  F.verdict(frags.length >= 6 && bad.length === 0, `${frags.length} fragments through the hook: each a convex outline of 3‥12 points on the pane's middle plane, anticlockwise from the side it leaves by, its area and centre its own, leaving on the far side from the shooter`, bad.slice(0, 4).join('; ') || `kinds ${[...new Set(frags.map((f: any) => f.kind))].join(', ')}; causes ${[...new Set(frags.map((f: any) => f.cause))].join(', ')}; points ${Math.min(...frags.map((f: any) => f.outline.length))}‥${Math.max(...frags.map((f: any) => f.outline.length))}`);
  const openA = gb.openFraction(PANE) * 4 * st.hu * st.hv;
  F.verdict(Math.abs(area - openA) < 2e-3, 'the areas handed over add up to the area open (craters go as one fragment each: their hull, within a few cm² of their wedges)', `fragments ${area.toFixed(4)} m², open ${openA.toFixed(4)} m²`);
  F.verdict(GB_STATS.shards === 0 && GB_STATS.hooked === frags.length && game.destr.debris.list.filter((c: any) => c.kind === 'shard').length === 0, 'with a consumer attached the stand-in spawns nothing', `stand-in shards ${GB_STATS.shards}, hooked ${GB_STATS.hooked}`);
  gb.onRelease = null; gb.setType(FAR, 'annealed'); const fc = game.level.boxes[FAR].c as Vec3;
  for (let k = 0; k < 3; k++) glassImpact(game, FAR, [fc[0] - 0.2 + 0.2 * k, fc[1] - 0.3 + 0.3 * k, fc[2]], IN, 1, 1); settle(2);
  const shards = game.destr.debris.list.filter((c: any) => c.kind === 'shard').length;
  F.verdict(GB_STATS.shards > 0 && shards > 0 && GB_STATS.chips > 0, 'with nobody attached the stand-in runs: rigid shards in the debris pool + chips', `shards spawned ${GB_STATS.shards} (in the pool ${shards}), chips ${GB_STATS.chips}, refused ${GB_STATS.refused}`);
  return F.done();
}

// ================================================================ one model: openAt ≡ raycast / solidBlocked ≡ the GPU table's rule
/** common.wgsl gbOpenUV, over the rows fill() hands the GPU (as f32) */
function tableOpen(rows: Float32Array, u: number, v: number): boolean {
  const fl = Math.round(rows[1]); if (!(fl & 1)) return false; if (fl & 8) return true;
  const hu = rows[4], hv = rows[5];
  if (fl & 4) { const D = { u: rows[8], v: rows[9], cols: Math.max(1, Math.round(rows[12])), rows: Math.max(1, Math.round(rows[13])), seed: Math.round(rows[14]), hu, hv }; const k = GP.gpDiceClump(D, u, v); return GP.gpDiceKey(D, k % D.cols, Math.floor(k / D.cols)) < rows[10]; }
  const n = Math.min(8, Math.round(rows[0])); if (!n) return false;
  const sites: any[] = []; const masks: number[][] = [];
  for (let i = 0; i < n; i++) { const o = (GBM.GB_HEADER_ROWS + i * GBM.GB_SITE_ROWS) * 4; sites.push({ u: rows[o], v: rows[o + 1], rot: rows[o + 2], rz: rows[o + 3], n: Math.round(rows[o + 4]), seed: Math.round(rows[o + 5]), e: rows[o + 6], merge: rows[o + 7], rho: [rows[o + 8], rows[o + 9], rows[o + 10], rows[o + 11]], hits: 1 }); masks.push([Math.round(rows[o + 12]), Math.round(rows[o + 13]), Math.round(rows[o + 14]), Math.round(rows[o + 15])]); }
  const i = GP.gpNearest(sites, u, v); const { s, b } = GP.gpSectorBand(sites[i], u, v);
  if (b >= 3 && !(fl & 2)) return false;
  return ((masks[i][b >> 1] >>> (s + 12 * (b & 1))) & 1) === 1;
}
export async function glassbreakOpen() {
  const F = family('glassbreak-open: the CPU open rule, the collision queries through the pane and the rule the shaders run over the uploaded rows agree point for point');
  const { W, game, engine, gb, settle } = await stage(9104, 0.5, true);
  const sweep = (label: string, minOpen: number) => {
    const st = gb.panes.get(PANE)!; const rows = new Float32Array(GB_STRIDE * 4); engine.world.glassCellFill(PANE, rows, 0);
    let nOpen = 0, rayMis = 0, segMis = 0, tabMis = 0, n = 0, framed = 0; const ex: string[] = [];
    for (let u = -0.47; u <= 0.47; u += 0.0173) for (let v = -0.97; v <= 0.97; v += 0.0231) {
      const a: Vec3 = [7.5 + u, 1.5 + v, 10.3], b: Vec3 = [7.5 + u, 1.5 + v, 9.94];   // square through the pane from the corridor side, ending just inside the room (the room's blinds hang 9 cm behind the glass at its west end)
      const hit = game.col.raycast(a, IN, 0.36);
      if (hit && hit.index !== PANE && hit.t < 0.29) { framed++; continue; }           // the mullion / sill / header stands nearer than the sheet here: not a point ON the glass
      n++; const open = gb.openAt(PANE, W_(u, v)); if (open) nOpen++;
      const rayOpen = !(hit && hit.index === PANE); const segOpen = !game.col.solidBlocked(a, b); const tab = tableOpen(rows, u, v);
      if (rayOpen !== open) { rayMis++; if (ex.length < 3) ex.push(`ray (${f2(u)},${f2(v)}) open ${open} hit ${hit?.index}`); }
      if (segOpen !== open) { segMis++; if (ex.length < 6) ex.push(`seg (${f2(u)},${f2(v)}) open ${open}`); }
      if (tab !== open) { tabMis++; if (ex.length < 6) ex.push(`table (${u.toFixed(4)},${v.toFixed(4)}) open ${open}`); }
    }
    F.verdict(nOpen >= minOpen && nOpen < n - 20 && rayMis === 0 && segMis === 0 && tabMis === 0, `${label}: raycast, solidBlocked and the uploaded rows' rule each agree with openAt at every grid point on the glass`,
      `${nOpen} of ${n} points open (${framed} behind the frame skipped); disagreements ray ${rayMis}, segment ${segMis}, table ${tabMis}${ex.length ? ' — ' + ex.join('; ') : ''}; rows: n ${rows[0]} flags ${rows[1]} uAxis ${rows[2]}`);
    return st;
  };
  F.verdict(GB_STRIDE === GB_RECORD_ROWS, 'boxes.ts GB_STRIDE = the record fill() writes', `${GB_STRIDE} rows vs ${GB_RECORD_ROWS}`);
  glassImpact(game, PANE, W_(-0.25, -0.2), IN, 1, 1); glassImpact(game, PANE, W_(0.2, 0.3), IN, 1, 1); settle(0.5);
  sweep('two craters, the pane not run', 4);
  for (const [u, v] of [[0.05, -0.6], [-0.1, 0.7], [0.3, -0.7]] as [number, number][]) glassImpact(game, PANE, W_(u, v), IN, 1, 1);
  settle(2); const st = sweep('run, daggers out', 200);
  F.verdict(st.run && st.nOpen > 10, 'staging: the pane ran and shed pieces', `run ${st.run}, ${st.nOpen} pieces out, ${st.sites.length} sites, open ${(100 * gb.openFraction(PANE)).toFixed(0)}%`);
  const eye: Vec3 = [7.5, 1.6, 11.5]; let sightAll = true; for (const v of [-0.6, 0, 0.6]) sightAll &&= !game.col.segmentBlocked(eye, [7.5, 1.5 + v, 8.5]);
  F.verdict(sightAll, 'sight through the pane is what it always was (segmentBlocked passes glass, hole or not)', `three eye lines through intact and open parts: all clear = ${sightAll}`);
  gb.setType(PANE, 'tempered'); glassImpact(game, PANE, W_(0.15, -0.4), IN, 1, 1); for (let i = 0; i < 9; i++) W.step(DT);
  const stT = sweep('tempered, mid-wave', 100);
  F.verdict(!!stT.dice && !stT.gone, 'staging: the tempered pane is caught part of the way out', `${stT.dice?.next} of ${stT.dice?.clumps.length} clumps out`);
  return F.done();
}

// ================================================================ blast
export async function glassbreakBlast() {
  const F = family('glassbreak-blast: a blast breaks the panes in reach by type and by strength, flings pieces away from itself, leaves panes out of reach alone; a stun charge arrives weaker');
  const { game, gb, frags, hook, settle } = await stage(9113, 0.5, true); hook();
  const at: Vec3 = [7.6, 1.0, 10.9];   // in the corridor, 0.9 m off the pane
  const far = game.engine.world.glassStatics.filter((bi: number) => { const b = game.level.boxes[bi]; return Math.hypot(b.c[0] - at[0], b.c[2] - at[2]) > GLASSBREAK.blastM + Math.max(b.h[0], b.h[2]) + 0.5; });
  const n = gb.blast(at, { who: 1 }); const st = gb.panes.get(PANE)!; const ranAtOnce = st.run; settle(2.5);
  const mine = frags.filter((f: any) => f.pane === PANE); const awayOK = mine.filter((f: any) => f.cause === 'blast').every((f: any) => v3.dot(f.velocity, v3.sub(f.centre, at)) > 0 && f.velocity[2] < 0);
  F.verdict(n >= 1 && ranAtOnce && mine.filter((f: any) => f.cause === 'blast').length >= 4 && awayOK && gb.openFraction(PANE) > 0.15, 'a full blast 0.9 m off an annealed pane: it runs at once, the pieces nearest the blast go with it — thrown AWAY from the blast, through to the far side — and the support rule takes what that leaves unheld',
    `panes changed ${n}; pane ${PANE}: run ${ranAtOnce}, ${st.sites.length} stars, ${mine.filter((f: any) => f.cause === 'blast').length} pieces by the blast + ${mine.filter((f: any) => f.cause === 'support').length} by support, away ${awayOK}, open ${(100 * gb.openFraction(PANE)).toFixed(0)}%`);
  F.verdict(far.length > 3 && far.every((bi: number) => !gb.panes.get(bi)), 'panes out of reach keep no record at all', `${far.length} panes beyond ${GLASSBREAK.blastM} m: ${far.filter((bi: number) => gb.panes.get(bi)).length} with a record`);
  // strength: the same charge as a stun 'bang' (bangPower) takes less
  const fullOpen = gb.openFraction(PANE); gb.reset(); frags.length = 0;
  game.events.push({ kind: 'bang', pos: [at[0], at[1], at[2]], time: game.time, loud: true, who: 1 }); settle(2.5);
  const stB = gb.panes.get(PANE);
  F.verdict(!!stB && stB.sites.length >= 1 && gb.openFraction(PANE) < fullOpen, `a stun charge at the same spot (the 'bang' event → blast at power ${GLASSBREAK.bangPower}) stars the pane and takes less of it`, `open ${(100 * gb.openFraction(PANE)).toFixed(0)}% against the full blast's ${(100 * fullOpen).toFixed(0)}%; run ${stB?.run}, stars ${stB?.sites.length}`);
  // by type: tempered dices; laminated crazes at range and leaves whole when close
  gb.reset(); frags.length = 0; gb.setType(PANE, 'tempered'); gb.blast(at, { who: 1 }); settle(1.5);
  F.verdict(!!gb.panes.get(PANE)?.gone && frags.filter((f: any) => f.pane === PANE).every((f: any) => f.kind === 'clump'), 'tempered in reach: dices whole', `gone ${gb.panes.get(PANE)?.gone}, ${frags.filter((f: any) => f.pane === PANE).length} clumps`);
  gb.reset(); frags.length = 0; gb.setType(PANE, 'laminated'); gb.blast([7.6, 1.0, 11.4], { who: 1 }); settle(1);
  const stL = gb.panes.get(PANE)!; const crazed = stL.sites.length >= 1 && !stL.gone && frags.filter((f: any) => f.pane === PANE).length === 0;
  gb.blast([7.6, 1.2, 10.3], { who: 1 }); settle(0.5); const sheet = frags.filter((f: any) => f.pane === PANE);
  F.verdict(crazed && stL.gone && sheet.length === 1 && sheet[0].kind === 'sheet' && Math.abs(sheet[0].area - 4 * stL.hu * stL.hv) < 1e-9 && gb.walkable(PANE), 'laminated: crazed and whole at 1.4 m; at 0.3 m the whole sheet leaves its frame as ONE fragment', `at range: ${stL.sites.length} stars, crazed-not-open ${crazed}; close: gone ${stL.gone}, fragments ${sheet.map((f: any) => f.kind + ' ' + f.area.toFixed(2) + ' m²').join(', ')}`);
  // options + the gate
  gb.reset(); gb.setType(PANE, null); const none = gb.blast(at, { radius: 0.5 }); const zero = gb.blast(at, { power: 0 });
  game.tune.glassBreak = false; const off = gb.blast(at); game.tune.glassBreak = true;
  F.verdict(none === 0 && zero === 0 && off === 0 && gb.panes.size === 0, 'a radius that reaches no pane, zero power, or the switch off: 0 panes, no record', `radius 0.5 → ${none}, power 0 → ${zero}, switch off → ${off}; records ${gb.panes.size}`);
  return F.done();
}

// ================================================================ the movement rule
export async function glassbreakWalk() {
  const F = family('glassbreak-walk: a pane is a wall to a walker\'s circle until every piece below 1.9 m has gone, then it is walked through; solidBlocked agrees; the nav grid is untouched');
  const { game, gb, settle } = await stage(9105, 0.5, true); const col = game.col;
  // a full-height TEMPERED sheet on the facade (the lobby frontage): one round dices it whole → walkable
  const cand = game.engine.world.glassStatics.map((i: number) => ({ i, b: game.level.boxes[i] })).filter((x: any) => gb.typeOfPane(x.i) === 'tempered' && x.b.c[1] - x.b.h[1] < 0.6 && x.b.c[1] + x.b.h[1] > 1.9);   // (every sheet in the office stands on a sill: the frontage's foot is at 0.5 m — the circle below is tested over a span above the sill so the PANE's part is what is measured)
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
  glassImpact(game, bi, face, inward, 1, 1); const mid = gb.walkable(bi);
  settle(1.5);
  const st = gb.panes.get(bi);
  F.verdict(!mid && !!st?.gone && gb.walkable(bi), 'one round dices the tempered sheet: not walkable while it is still coming down, walkable once it has gone', `walkable in the round's frame ${mid}; gone ${st?.gone} open ${Math.round(100 * gb.openFraction(bi))}% walkable ${gb.walkable(bi)}`);
  const push1 = pushed(pOut); const solid1 = col.solidBlocked(v3.add(pOut, [0, 1.0, 0]), v3.add(pIn, [0, 1.0, 0]));
  F.verdict(push1 < 1e-6 && !solid1, 'diced: the same circle is left where it stands and the segment passes — feet and solidBlocked agree', `pushed ${push1.toExponential(1)} m, solidBlocked ${solid1}`);
  // an ANNEALED pane holed at head height only: still a wall to the circle, shins blocked, the hole itself open
  glassImpact(game, PANE, W_(0.1, 0.75), IN, 1, 1); settle(0.7);
  const stC = gb.panes.get(PANE)!; const q: Vec3 = [7.6, 0, 10.2]; const q2 = v3.copy(q); col.collideCircle(q2, 0.34, 0.7, 1.5, 3);
  const shin = col.solidBlocked([7.6, 0.8, 10.3], [7.6, 0.8, 9.7]), head = col.solidBlocked([7.6, 2.25, 10.3], [7.6, 2.25, 9.7]);
  F.verdict(stC.nOpen > 0 && !gb.walkable(PANE) && v3.distXZ(q, q2) > 0.1 && shin && !head, 'a pane holed at head height only: not walkable, the circle still pushed, shins still blocked, the hole itself open', `pieces out ${stC.nOpen} walkable ${gb.walkable(PANE)} pushed ${f2(v3.distXZ(q, q2))} shin blocked ${shin} head-height blocked ${head}`);
  // the same pane run and beaten until nothing reaches below the clear height
  const isTooth = (f: any) => f.area < GLASSBREAK.toothArea && f.frame.bottom + f.frame.left + f.frame.right + f.frame.top > 1e-4; const lowLeft = () => GP.gpFragments(stC.sites, stC.run, stC.hu, stC.hv).filter((f: any) => f.vMin < GLASSBREAK.walkClearH - 1.5 && !stC.open[f.fid] && !isTooth(f));
  const rnd = seeded(8); let rounds = 1; for (; rounds < 120 && !gb.walkable(PANE); rounds++) { let u = (rnd() * 2 - 1) * 0.46, v = -0.95 + rnd() * 1.35; if (rounds > 12) { const f = lowLeft()[0]; if (f) { u = f.cen[0]; v = f.cen[1]; } }   // (a dozen scattered rounds, then one at a time into whatever still stands low)
    if (!gb.openAt(PANE, W_(u, v))) glassImpact(game, PANE, W_(u, v), IN, 1, 1); settle(0.4); }
  const q3 = v3.copy(q); col.collideCircle(q3, 0.34, 0.7, 1.5, 3); const lowAll = GP.gpFragments(stC.sites, stC.run, stC.hu, stC.hv).filter((f: any) => f.vMin < GLASSBREAK.walkClearH - 1.5 && !stC.open[f.fid]); const low = lowAll.filter((f: any) => !(f.area < GLASSBREAK.toothArea && f.frame.bottom + f.frame.left + f.frame.right + f.frame.top > 1e-4)).length;
  F.verdict(gb.walkable(PANE) && low === 0 && v3.distXZ(q, q3) < 1e-6 && !col.solidBlocked([7.6, 0.8, 10.3], [7.6, 0.8, 9.7]), 'beaten out below head height: walkable exactly when nothing but teeth in the frame reaches under 1.9 m, and then the circle passes', `after ${rounds} rounds: walkable ${gb.walkable(PANE)}, low pieces left ${low} (+ ${lowAll.length - low} teeth under ${GLASSBREAK.toothArea} m² in the frame), pushed ${f2(v3.distXZ(q, q3))}, open ${(100 * gb.openFraction(PANE)).toFixed(0)}%`);
  const navAfter = col.nav.blocked ? Array.from(col.nav.blocked as Uint8Array).join('') : '';
  F.verdict(navBefore === navAfter && navBefore.length > 0, 'the nav grid is not rebaked (documented: A* keeps routing round the frame)', `${navBefore.length} cells, identical`);
  return F.done();
}

// ================================================================ caps
export async function glassbreakCaps() {
  const F = family('glassbreak-caps: sites per pane, pieces and clumps let go per frame and the shared debris pool stay inside their bounds however hard the glazing is hit');
  const { W, game, engine, gb, frags } = await stage(9106, 1.0, true);
  let perFrame: Record<string, number> = {}; let maxQueued = 0, maxClumps = 0;
  const count = () => { gb.onRelease = (f: any) => { frags.push(f); perFrame[f.cause] = (perFrame[f.cause] ?? 0) + 1; }; };
  const stepCount = (n: number) => { for (let i = 0; i < n; i++) { perFrame = {}; W.step(DT); maxQueued = Math.max(maxQueued, (perFrame.support ?? 0) + (perFrame.blast ?? 0)); maxClumps = Math.max(maxClumps, perFrame.dice ?? 0); } };
  count();
  const rnd = seeded(77); for (let k = 0; k < 60; k++) glassImpact(game, PANE, W_((rnd() * 2 - 1) * 0.47, (rnd() * 2 - 1) * 0.97), IN, 1, 1);
  const st = gb.panes.get(PANE)!;
  F.verdict(st.sites.length <= GLASSBREAK.maxSites && st.sites.length <= GP.GP_MAX_SITES && st.sites.every((s: any) => s.n <= GP.GP_MAX_SECTORS), `60 scattered rounds into one pane in one frame: ≤ ${GLASSBREAK.maxSites} sites, ≤ ${GP.GP_MAX_SECTORS} radials each`, `sites ${st.sites.length}, hits ${st.hits}, pending ${st.pending.length}`);
  stepCount(180);
  for (const at of [[7.0, 0.8, 9.2], [10.5, 0.8, 9.2], [13.0, 0.8, 9.2]] as Vec3[]) gb.blast(at, { who: 1 });
  for (const i of engine.world.glassStatics) if (gb.typeOfPane(i) === 'tempered') { const b = game.level.boxes[i]; glassImpact(game, i, v3.copy(b.c), IN, 1, 1); }
  stepCount(240);
  F.verdict(maxQueued <= GLASSBREAK.releasesPerFrame && maxQueued > 0, `queued pieces (support / blast) let go a frame ≤ releasesPerFrame ${GLASSBREAK.releasesPerFrame}`, `max ${maxQueued} in a frame`);
  const diced = [...gb.panes.values()].filter((s: any) => s.type === 'tempered').length;
  F.verdict(maxClumps <= diced * (GLASSBREAK.clumpsPerFrame + 8) && maxClumps > 0, `clumps a frame ≤ clumpsPerFrame ${GLASSBREAK.clumpsPerFrame} (+ ties) per dicing pane`, `max ${maxClumps} in a frame across ${diced} dicing panes`);
  // the stand-in under the same load: the debris pool must never pass its cap; refusals are counted, not thrown
  gb.reset(); gb.onRelease = null; let over = 0; const cap = engine.settings.debrisCap ?? 64;
  for (let k = 0; k < 40; k++) glassImpact(game, PANE, W_((rnd() * 2 - 1) * 0.47, (rnd() * 2 - 1) * 0.97), IN, 1, 1);
  for (const at of [[7.0, 0.8, 9.2], [10.5, 0.8, 9.2], [13.0, 0.8, 9.2]] as Vec3[]) gb.blast(at, { who: 1 });
  for (const i of engine.world.glassStatics) if (gb.typeOfPane(i) === 'tempered') { const b = game.level.boxes[i]; glassImpact(game, i, v3.copy(b.c), IN, 1, 1); }
  for (let i = 0; i < 300; i++) { W.step(DT); if (game.destr.debris.list.length > cap) over++; }
  const holed = [...gb.panes.values()].filter((s: any) => s.nOpen || s.gone).length;
  F.verdict(over === 0 && holed >= 6 && GB_STATS.shards > 0, `stand-in: the debris pool never over its cap (${cap}) through ${holed} panes coming apart`, `pool now ${game.destr.debris.list.length}, spawned ${game.destr.debris.stats.spawned}, evicted ${game.destr.debris.stats.evicted}, pool refusals ${game.destr.debris.stats.refused}, glass refused ${GB_STATS.refused}, shards ${GB_STATS.shards}`);
  const finite = [...gb.panes.values()].every((s: any) => s.sites.every((p: any) => [p.u, p.v, p.rot, p.rz, p.e, ...p.rho].every(Number.isFinite) && p.rz > 0 && p.rho[0] > 0) && Number.isFinite(s.damage) && Number.isFinite(s.energy));
  const rows = new Float32Array(GB_STRIDE * 4); let rowsFinite = true; for (const bi of gb.panes.keys()) { rows.fill(0); engine.world.glassCellFill(bi, rows, 0); rowsFinite &&= rows.every(Number.isFinite) && rows[0] <= 8 && rows.subarray(16).every((x, k) => (k % 16 < 12) || x < 16777216); }
  F.verdict(finite && rowsFinite, 'every pane record finite, every uploaded row finite and every mask an exact float', `${gb.panes.size} records`);
  return F.done();
}

// ================================================================ reset + fingerprint
export async function glassbreakReset() {
  const F = family('glassbreak-reset: reset() and a restart put every pane back whole and take the gusts out of the wind; holes never touch the checkpoint fingerprint');
  const { W, game, engine, gb, settle } = await stage(9107, 0.5, true);
  const fp0 = JSON.stringify(levelFingerprint(game));
  game.weather.setEnabled?.(true); if (game.weather.wind) { game.weather.wind[0] = 6; game.weather.wind[1] = 2; }
  const ext = engine.world.glassStatics.find((i: number) => gb.typeOfPane(i) === 'tempered')!; glassImpact(game, ext, v3.copy(game.level.boxes[ext].c), IN, 1, 1);
  for (const [u, v] of [[0.1, 0.1], [-0.2, 0.5], [0.2, -0.4]] as [number, number][]) glassImpact(game, PANE, W_(u, v), IN, 1, 1);
  for (let i = 0; i < 120; i++) { if (game.weather.wind) { game.weather.wind[0] = 6; game.weather.wind[1] = 2; } W.step(DT); }
  const gusts0 = game.wind.all.filter((s: any) => s.why === 'glass').length; const holed0 = [...gb.panes.values()].filter((s: any) => s.nOpen || s.gone).length; const shards0 = game.destr.debris.list.filter((c: any) => c.kind === 'shard').length;
  const fp1 = JSON.stringify(levelFingerprint(game));
  F.verdict(holed0 >= 2 && shards0 > 0 && gusts0 >= 1, 'staging: two panes holed (one exterior, diced, in a storm), shards in the pool, a gust source registered', `holed ${holed0}, shards ${shards0}, glass gusts ${gusts0}`);
  F.verdict(fp0 === fp1 && game.level.boxes.length === JSON.parse(fp0).boxes, 'levelFingerprint identical with holes open (no static appended, none resized)', `boxes ${game.level.boxes.length}`);
  gb.reset();
  let anyOpen = false; for (const i of engine.world.glassStatics) { const b = game.level.boxes[i]; anyOpen ||= gb.openAt(i, b.c) || gb.walkable(i); }
  const rows = new Float32Array(GB_STRIDE * 4); const filled = engine.world.glassCellFill(PANE, rows, 0);
  F.verdict(gb.panes.size === 0 && !anyOpen && !filled && game.wind.all.filter((s: any) => s.why === 'glass').length === 0, 'reset(): no pane record, nothing open or walkable, the record rows empty, no glass gust in the wind', `panes ${gb.panes.size}, anyOpen ${anyOpen}, fill ${filled}, gusts ${game.wind.all.filter((s: any) => s.why === 'glass').length}`);
  // a restart: holes again, then restartEncounter → resetLevelState → glassBreak.reset + destr.reset (the shards go with the pool)
  for (const [u, v] of [[-0.2, 0.2], [0.2, 0.5], [0.1, -0.5]] as [number, number][]) glassImpact(game, PANE, W_(u, v), IN, 1, 1); settle(1);
  const shards1 = game.destr.debris.list.filter((c: any) => c.kind === 'shard').length;
  game.restartEncounter(); W.step(DT);
  const shards2 = game.destr.debris.list.filter((c: any) => c.kind === 'shard').length;
  F.verdict(shards1 > 0 && shards2 === 0 && gb.panes.size === 0 && !gb.openAt(PANE, W_(-0.2, 0.2)), 'restartEncounter(): panes whole, shards gone with the debris pool', `shards ${shards1} → ${shards2}, panes ${gb.panes.size}`);
  return F.done();
}

// ================================================================ gusts
export async function glassbreakGust() {
  const F = family('glassbreak-gust: a shot-out EXTERIOR pane in the storm becomes one wind source along its inward normal; interior panes never do');
  const { W, game, engine, gb } = await stage(9108, 0.5, true);
  game.weather.setEnabled?.(true); const hasWind = !!game.weather.wind; if (hasWind) { game.weather.wind[0] = 7; game.weather.wind[1] = 1; }
  const ext = engine.world.glassStatics.find((i: number) => gb.typeOfPane(i) === 'tempered' && game.level.boxes[i].h[1] > 0.5)!;
  const b = game.level.boxes[ext];
  glassImpact(game, ext, v3.copy(b.c), IN, 1, 1);
  for (const [u, v] of [[0.1, 0.1], [-0.2, 0.5], [0.2, -0.4], [0, 0.8]] as [number, number][]) glassImpact(game, PANE, W_(u, v), IN, 1, 1);
  for (let i = 0; i < 180; i++) { if (hasWind) { game.weather.wind[0] = 7; game.weather.wind[1] = 1; } W.step(DT); }
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
  const F = family('glassbreak-determinism: the same seeded volley + charge twice → identical pane records, debris rest poses, events, particle records, log; the same blows through the hook → the same fragments');
  const a = await recordVolley(9109, true), b = await recordVolley(9109, true);
  const fails: string[] = []; diffLists(a, b, ['panes', 'debris', 'events', 'emits', 'log', 'decals', 'audio'], fails);
  if (!a.panes || a.stats.dropped < 2) fails.push(`staging: panes '${a.panes.slice(0, 40)}', dropped ${a.stats.dropped}`);
  F.verdict(!fails.length, `${a.panes.split('|').length} pane records, ${a.debris.split('|').filter(Boolean).length} chunks, ${a.events.length} events, ${a.emits.length} particle records, ${a.log.length} log lines — identical both runs`, fails.join('; ') || `stats ${JSON.stringify(a.stats)}`);
  const stream = async (seed: number) => { const S = await stage(seed, 0.5, true); S.hook(); for (const [u, v, e] of [[-0.1, -0.2, 1], [0.2, 0.3, 1], [-0.25, 0.5, 1.8], [0.1, -0.6, 1]] as number[][]) { glassImpact(S.game, PANE, W_(u, v), IN, e, 1); S.settle(0.7); } S.gb.blast([8.4, 1.0, 10.8], { who: 1 }); S.settle(2); return { frags: S.frags.map(fragSig), panes: [...S.gb.panes.values()].map(paneSig) }; };
  const x = await stream(1), y = await stream(987654);   // (different Math.random seeds on purpose: the model draws none)
  const f2s: string[] = []; diffLists(x, y, ['frags', 'panes'], f2s);
  F.verdict(!f2s.length && x.frags.length > 8, `${x.frags.length} fragments (time, kind, cause, area, outline, velocity, seed) and ${x.panes.length} pane records identical across two stand-ups with DIFFERENT Math.random seeds: the pattern hangs on the pane and the point alone`, f2s.join('; ') || 'identical');
  return F.done();
}

// ================================================================ the seams with the sibling parts: the caller's verdict, the type per level, the blast feed
export async function glassbreakSeams() {
  const F = family('glassbreak-seams: a caller that has decided whether its round went through is obeyed; outside glass is found from the level, not the office\'s rectangle; one charge fed twice is one blow');
  const { W, game, gb, settle } = await stage(9131, 0.5, true);
  const { BUILDING } = await import(`${ROOT}/src/game/floor.ts`);
  const glassOf = (g: any) => g.level.boxes.map((_: any, bi: number) => bi).filter((bi: number) => g.glassBreak.typeOfPane(bi));
  // (1) the caller's verdict (the penetration part judges the round by its own toll before it calls)
  const soft = glassImpact(game, PANE, W_(0.1, 0.1), IN, 0.2, 1, 'shot', false, { through: true });
  F.verdict(soft.live && soft.punched && gb.openAt(PANE, W_(0.1, 0.1)), 'annealed, energy 0.2 (under the punch threshold) but the caller says it went THROUGH: the hole is there where it passed', JSON.stringify({ punched: soft.punched, open: gb.openAt(PANE, W_(0.1, 0.1)) }));
  gb.reset(); const held = glassImpact(game, PANE, W_(0.1, 0.1), IN, 0.9, 1, 'shot', true, { through: false });
  F.verdict(held.live && !held.punched && held.cracked && !gb.openAt(PANE, W_(0.1, 0.1)) && gb.openFraction(PANE) === 0, 'annealed, energy 0.9 (over it) but the caller says it STOPPED: cracks, no hole anywhere', JSON.stringify({ punched: held.punched, cracked: held.cracked, open: gb.openFraction(PANE) }));
  gb.reset(); const plain = glassImpact(game, PANE, W_(0.1, 0.1), IN, 0.9, 1, 'shot', true);
  F.verdict(plain.punched, 'no verdict given: the energy decides, as before', JSON.stringify({ punched: plain.punched }));
  // no room for a star of its own: beside an existing star, and on a pane whose eight sites are taken — through still leaves a hole (the cracks run, the piece under it goes)
  gb.reset(); glassImpact(game, PANE, W_(0, 0), IN, 0.2, 1, 'shot', true, { through: false }); const rz = gb.panes.get(PANE)!.sites[0].rz;
  const beside = glassImpact(game, PANE, W_(rz + 0.02, 0), IN, 0.2, 1, 'shot', true, { through: true });
  F.verdict(beside.punched && gb.openAt(PANE, W_(rz + 0.02, 0)) && gb.panes.get(PANE)!.run, 'through, 2 cm outside an existing star\'s zone (no room for a second star): the cracks run and the piece under the round goes', JSON.stringify({ rz: +rz.toFixed(3), punched: beside.punched, run: gb.panes.get(PANE)!.run }));
  gb.reset(); const spots: [number, number][] = [[-0.35, 0.7], [0.35, 0.7], [-0.35, 0.25], [0.35, 0.25], [-0.35, -0.25], [0.35, -0.25], [-0.35, -0.7], [0.35, -0.7]];
  for (const [u, v] of spots) glassImpact(game, PANE, W_(u, v), IN, 0.2, 1, 'shot', true, { through: false });
  const full = gb.panes.get(PANE)!.sites.length; const ninth = glassImpact(game, PANE, W_(0, 0), IN, 0.2, 1, 'shot', true, { through: true });
  F.verdict(full === 8 && ninth.punched && gb.openAt(PANE, W_(0, 0)), 'through on a pane whose eight sites are taken: still a hole where it passed', JSON.stringify({ sites: full, punched: ninth.punched, run: gb.panes.get(PANE)!.run }));
  gb.reset(); gb.setType(PANE, 'tempered'); const temp = glassImpact(game, PANE, W_(0.1, 0.1), IN, 0.3, 1, 'shot', true, { through: true }); settle(1.5);
  F.verdict(temp.diced && !!gb.panes.get(PANE)?.gone, 'tempered, energy 0.3 (under its break energy) and through: it dices', JSON.stringify({ diced: temp.diced, gone: gb.panes.get(PANE)?.gone }));
  gb.reset(); gb.setType(PANE, 'laminated'); const lam = glassImpact(game, PANE, W_(0.1, 0.1), IN, 2, 1, 'shot', true, { through: true });
  F.verdict(!lam.punched && gb.openFraction(PANE) === 0, 'laminated and through: a web, never a hole (the interlayer holds whatever passed)', JSON.stringify({ punched: lam.punched, open: gb.openFraction(PANE) }));
  gb.reset(); gb.setType(PANE, null);
  // (2) one charge, one blow
  const at: Vec3 = [7.6, 1.0, 10.9]; const b0 = GB_STATS.blasts;
  const n1 = gb.blast(at, { who: 1 }); const n2 = gb.blast([at[0], at[1], at[2]], { who: 1 });
  game.events.push({ kind: 'bang', pos: [at[0], at[1], at[2]], time: game.time, loud: true, who: 1 }); settle(0.1);
  F.verdict(n1 >= 1 && n2 === 0 && GB_STATS.blasts === b0 + 1, 'the same blast again, and its own bang event a frame later: dropped, one blow counted', `first ${n1} panes, again ${n2}, blasts +${GB_STATS.blasts - b0}`);
  settle(0.4); const n3 = gb.blast(at, { who: 1 });
  F.verdict(n3 >= 1 && GB_STATS.blasts === b0 + 2, 'a second charge at the same spot half a second later is its own blow', `${n3} panes, blasts +${GB_STATS.blasts - b0}`);
  // a can lying on the floor: the feed gives the true point (y 0.12), the bang event is lifted to 0.3 — still one blow
  const low: Vec3 = [7.6, 0.12, 10.9]; gb.reset(); settle(0.4); gb.blast(low, { who: 1 }); const eLone = gb.panes.get(PANE)!.energy;
  gb.reset(); settle(0.4); const b1 = GB_STATS.blasts; gb.blast(low, { who: 1 }); game.events.push({ kind: 'bang', pos: [low[0], low[1], low[2]], time: game.time, loud: true, who: 1 }); settle(0.1);
  F.verdict(GB_STATS.blasts === b1 + 1 && Math.abs(gb.panes.get(PANE)!.energy - eLone) < 1e-9, 'a charge on the floor (blast at y 0.12, its bang event lifted to 0.3): one blow, the pane takes the blast\'s energy once', `blasts +${GB_STATS.blasts - b1}, pane energy ${gb.panes.get(PANE)!.energy.toFixed(2)} against a lone blast's ${eLone.toFixed(2)}`);
  // the other order: the weaker arrival (the bang event, power bangPower) first, the charge's own blast a frame later — the pane ends where the blast alone puts it
  { const lone = { e: eLone, stars: 0 }; gb.reset(); settle(0.4); gb.blast(low, { who: 1 }); lone.stars = gb.panes.get(PANE)!.sites.length;
    gb.reset(); settle(0.4); const b2 = GB_STATS.blasts; game.events.push({ kind: 'bang', pos: [low[0], low[1], low[2]], time: game.time, loud: true, who: 1 }); settle(DT * 2); const eBang = gb.panes.get(PANE)?.energy ?? 0; gb.blast(low, { who: 1 });
    const st = gb.panes.get(PANE)!;
    F.verdict(GB_STATS.blasts === b2 + 1 && eBang > 0 && eBang < lone.e && Math.abs(st.energy - lone.e) < 1e-9 && st.sites.length <= lone.stars, 'the bang event first, the blast a frame later: still one blow, and the pane takes only the STRONGER of the two (the blast\'s energy, no star more than a lone blast leaves)', `blasts +${GB_STATS.blasts - b2} · after the bang ${eBang.toFixed(2)} · after both ${st.energy.toFixed(2)} against a lone blast's ${lone.e.toFixed(2)} · stars ${st.sites.length} against ${lone.stars}`); }
  // a first arrival too short to reach a pane does not swallow a second that does
  const off2: Vec3 = [7.6, 1.0, 12.0]; gb.reset(); settle(0.4); const short = gb.blast(off2, { radius: 1.0, who: 1 });
  game.events.push({ kind: 'bang', pos: [off2[0], off2[1], off2[2]], time: game.time, loud: true, who: 1 }); settle(0.1);
  F.verdict(short === 0 && (gb.panes.get(PANE)?.sites.length ?? 0) >= 1, 'a short blast that reached no pane, then the same charge\'s wider bang: the pane it reaches is still starred', `short blast ${short} panes; pane ${PANE} stars ${gb.panes.get(PANE)?.sites.length ?? 0}`);
  // (3) the type per level: the office exactly as the rectangle had it; a level with another footprint gets its outside glass found from open sky over one face
  const off = glassOf(game); const onRect = (b: any) => Math.abs(b.c[0] - BUILDING.x0) < 0.2 || Math.abs(b.c[0] - BUILDING.x1) < 0.2 || Math.abs(b.c[2] - BUILDING.z0) < 0.2 || Math.abs(b.c[2] - BUILDING.z1) < 0.2;
  const differ = off.filter((bi: number) => gb.paneInfo(bi)!.exterior !== onRect(game.level.boxes[bi])); const offExt = off.filter((bi: number) => gb.paneInfo(bi)!.exterior);
  F.verdict(off.length === 22 && offExt.length === 15 && differ.length === 0 && gb.typeOfPane(PANE) === 'annealed' && offExt.every((bi: number) => gb.typeOfPane(bi) !== 'annealed'), 'the office: the same 15 of its 22 panes are outside glass as the rectangle rule had (tempered / laminated), the conference partition annealed', `${off.length} panes, ${offExt.length} exterior, ${differ.length} differ from the rectangle${differ.length ? ' (' + differ.join(',') + ')' : ''}, pane ${PANE} ${gb.typeOfPane(PANE)}`);
  // …and the wind through a shot-out outside pane blows INTO the building on a level the office's interior rectangle knows nothing of
  const { levelOf } = await import('./scenario-level-probes.ts');
  for (const [file, want, wantExt] of [['records', 7, 7], ['registry', 7, 6]] as [string, number, number][]) {
    const W2 = await standUp({ level: levelOf(`levels/${file}.json`) }); const g2 = W2.game; const ps = glassOf(g2); const ext = ps.filter((bi: number) => g2.glassBreak.paneInfo(bi).exterior);
    F.verdict(ps.length === want && ext.length === wantExt && ext.every((bi: number) => g2.glassBreak.typeOfPane(bi) !== 'annealed'), `${file}: ${wantExt} of ${want} panes found to be outside glass, none of them annealed`, `${ps.length} panes, ${ext.length} exterior: ${ps.map((bi: number) => `${bi} ${g2.glassBreak.typeOfPane(bi)}`).join(', ')}`);
    if (file !== 'records') continue;
    g2.tune.chaos = 0.5; g2.tune.glassBreak = true; g2.touring = false; g2.wind.stormWind = () => [3, 0, 2];
    const bad: string[] = []; let made = 0;
    for (const bi of ext) {
      const b = g2.level.boxes[bi]; g2.glassBreak.setType(bi, 'tempered'); g2.glassBreak.impact(bi, [b.c[0], b.c[1], b.c[2]], null, 2, 1, true); for (let k = 0; k < 150; k++) W2.step(DT);
      const src = g2.wind.all.find((x: any) => x.name === `glass:${bi}`); if (!src) continue; made++;
      const p: Vec3 = [b.c[0] + src.dir[0] * 1.0, b.c[1], b.c[2] + src.dir[2] * 1.0];   // a metre along the jet: under a roof = indoors
      if (!g2.col.solidBlocked(p, [p[0], 12, p[2]], 0.02)) bad.push(`${bi}`);
    }
    F.verdict(made >= 3 && bad.length === 0, 'records, the storm on: every shot-out outside pane\'s gust points to the roofed side', `${made} gust sources, ${bad.length} pointing outdoors${bad.length ? ' (' + bad.join(',') + ')' : ''}`);
  }
  // the destruction engine's feed, when the build has one: a GlassBreak built over a destr with onBlast listens, breaks panes, and adds its count to res.panes
  // (LAST: the second instance takes the game's glass hooks over)
  const L: ((b: any) => void)[] = []; const had = Object.prototype.hasOwnProperty.call(game.destr, 'onBlast'); const d0 = game.destr.onBlast; game.destr.onBlast = (fn: any) => { L.push(fn); };
  const gb2 = new GBM.GlassBreak(game); game.glassBreak = gb2; if (had) game.destr.onBlast = d0; else delete game.destr.onBlast;
  const res = { panes: 0 }; for (const fn of L) fn({ at, radius: GLASSBREAK.blastM, power: 1, who: 1, res });
  F.verdict(L.length === 1 && res.panes >= 1 && !!gb2.panes.get(PANE)?.run, 'g.destr.onBlast present: one listener registered; fed a blast it breaks the panes in reach and adds them to res.panes', `listeners ${L.length}, res.panes ${res.panes}, pane ${PANE} run ${gb2.panes.get(PANE)?.run}`);
  void W;
  return F.done();
}

export async function glassbreakFamily(): Promise<boolean> { let ok = true; for (const f of [glassbreakOff, glassbreakGate, glassbreakPattern, glassbreakSupport, glassbreakRelease, glassbreakOpen, glassbreakBlast, glassbreakSeams, glassbreakWalk, glassbreakCaps, glassbreakReset, glassbreakGust, glassbreakDeterminism]) ok = (await f()) && ok; return ok; }
if (import.meta.main) { const only = process.argv[2]; const all: Record<string, () => Promise<boolean>> = { off: glassbreakOff, gate: glassbreakGate, pattern: glassbreakPattern, support: glassbreakSupport, release: glassbreakRelease, open: glassbreakOpen, blast: glassbreakBlast, seams: glassbreakSeams, walk: glassbreakWalk, caps: glassbreakCaps, reset: glassbreakReset, gust: glassbreakGust, determinism: glassbreakDeterminism };
  const ok = only && all[only] ? await all[only]() : await glassbreakFamily(); console.log(ok ? '=== glassbreak-probes: ALL PASS ===' : '=== glassbreak-probes: FAILED ==='); process.exit(ok ? 0 : 1); }
