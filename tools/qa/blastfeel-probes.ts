// The 'blastfeel' probes (src/game/blastFeel.ts — what a wall charge going off sounds like, throws about and does to the camera), run as their own program or as
// probes.ts family 'blastfeel':   bun run tools/qa/blastfeel-probes.ts [--scn block-squads]
// Headless = the Proxy device: nothing is drawn or heard. What can be held here: WHICH sounds would play and when (headless.ts W.audioLog), what is handed to the
// particle system (a recording stand-in for render/particles.ts Particles), what is written to the camera — and that none of it is play:
//   (report)   the squad sets a charge, Sam blows it: 'wallCrack' + 'wallThump' at the blast's place as late as sound takes to reach Sam, 'wallDebris' a tenth of a
//              second behind them, each with a rate of its own (the mixer draws no dice), NO 'stunBang'; the 'bang' hearing event is filed as ever;
//              FEEL.on false: 'stunBang' at gain 1 and none of the three — the report as it was;
//   (wave)     the particle records it hands over: dust on ten or more frames running (the ring going out), every ring puff with a clear line back to the wall's
//              face and within the ring's reach, soot and ceiling dust after the first frame, impulses on three frames; every record brings its own seed — the
//              count of records WITHOUT one (the ones that step the particle system's serial) is the same with FEEL on and off;
//   (kick)     the camera's kick: there on the blast frame, never more than FEEL.kickM, gone inside FEEL.kickSecs + two frames; kickIn() moves the picture,
//              kickOut() puts target, eye and all three matrices back TO THE BIT; FEEL.kick 0: none;
//   (identity) the same staged blast and five seconds after it digest identically with FEEL on and off (the game reads none of it).
import { ROOT } from './headless.ts';
import { rig, partitions, family, f2 } from './wallcharge-probes.ts';
const { WALL_ORDER } = await import(`${ROOT}/src/game/wallcharge.ts`);
const { FEEL } = await import(`${ROOT}/src/game/blastFeel.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
type Vec3 = [number, number, number];
interface Rec { f: number; what: 'emit' | 'impulse'; kind?: string; pos: Vec3; count: number; seeded: boolean; radius?: number; /** dust only: metres to each face of the blown wall, or -1 with something solid between — asked on the frame the record was made */ los?: [number, number] }
/** a point 0.35 m off one face of the wall the charge is on, at the charge (side 1 = the charge's own face) */
const faceOf = (wall: any, side: number): Vec3 => wall.alongX ? [wall.u, 0.3, wall.box.c[2] + side * wall.side * (wall.box.h[2] + 0.35)] : [wall.box.c[0] + side * wall.side * (wall.box.h[0] + 0.35), 0.3, wall.u];

/** stage one blast: the squad's charge on the first partition, armed; then Sam's trigger and `secs` after it. Returns what was heard, handed to the particles and written to the camera. */
async function blast(scn: string, on: boolean, kick = 1, secs = 5) {
  const R = await rig(scn, 13); const { O, C, game, W } = R;
  FEEL.on = on; FEEL.kick = kick;
  const recs: Rec[] = []; let frame = 0, blown: any = null;
  const los = (pos: Vec3): [number, number] | undefined => blown ? [1, -1].map(sd => { const o = faceOf(blown, sd), p: Vec3 = [pos[0], 0.3, pos[2]]; return game.col.solidBlocked(o, p) ? -1 : Math.hypot(p[0] - o[0], p[2] - o[2]); }) as [number, number] : undefined;
  // a recording stand-in for the GPU particle system (what blastFeel.ts, blastLook.ts and particleFx.ts call of it)
  const anything = (): any => new Proxy(function () { }, { get: (_t, k) => k === Symbol.toPrimitive ? () => 0 : anything(), apply: () => anything(), set: () => true });
  const own: Record<string, unknown> = { emit(kind: string, pos: Vec3, _d: Vec3, count: number, o: any) { recs.push({ f: frame, what: 'emit', kind, pos: [pos[0], pos[1], pos[2]], count, seeded: o?.seed !== undefined, los: kind === 'dust' ? los(pos) : undefined }); return count; },
    impulse(pos: Vec3, radius: number, _strength: number, o: any) { recs.push({ f: frame, what: 'impulse', pos: [pos[0], pos[1], pos[2]], count: 1, seeded: o?.seed !== undefined, radius }); return true; } };
  const fake = new Proxy({}, { get: (_t, k) => (typeof k === 'string' && k in own ? own[k] : anything()), set: () => true });
  game.engine.particles = fake; game.engine.settings.gpuParticles = true;
  const P = partitions(R)[0]; if (!P) throw new Error('no partition');
  R.gather(P.near, 75, P.p); O.give(WALL_ORDER, O.targetAt(P.p), 'all');
  if (!R.until(() => C.ops[0]?.phase === 'armed', 60)) throw new Error('the charge was never armed');
  const wall = C.set[0].wall, log: any[] = []; W.audioLog = log; recs.length = 0; blown = wall;
  const ev0 = game.events.length, t0 = game.time, ear = game.player.char.bones.head ?? [game.player.char.pos[0], 1.6, game.player.char.pos[2]];
  C.blow();
  const bang = game.events.slice(ev0).find((e: any) => e.kind === 'bang');
  const kicks: (Vec3 | null)[] = []; let pic: { moved: boolean; same: boolean } | null = null;
  for (let i = 0; i < secs * 60; i++) { R.step(); frame++; const k = W.cam.kick as Vec3 | null; kicks.push(k ? [k[0], k[1], k[2]] : null);
    if (k && !pic) { const cam = W.cam, snap = () => JSON.stringify([cam.target, cam.pos, Array.from(cam.view), Array.from(cam.viewProj), Array.from(cam.invViewProj)]); const a = snap(); cam.kickIn(); const b = snap(); cam.kickOut(); pic = { moved: a !== b, same: a === snap() }; } }
  W.audioLog = null;
  return { R, game, wall, log, recs, kicks, pic, t0, ear, bang, digest: hashDigest(digestGame(game, true)) };
}

export async function blastfeelFamily(scn = 'block-squads'): Promise<boolean> {
  const keep = { on: FEEL.on, kick: FEEL.kick }, rnd = Math.random;
  try {
    const F = family(`blastfeel: a wall charge's report, its wave in particles, the camera's kick — and none of it play (${scn})`);
    const A = await blast(scn, true), B = await blast(scn, false), Z = await blast(scn, true, 0, 1);
    const names = (L: any[]) => L.map(c => c.name), at = (L: any[], n: string) => L.find(c => c.name === n);
    // (report)
    { const cr = at(A.log, 'wallCrack'), th = at(A.log, 'wallThump'), de = at(A.log, 'wallDebris'), src = cr?.pos as Vec3 | undefined;
      const d = src ? Math.hypot(src[0] - A.ear[0], src[1] - A.ear[1], src[2] - A.ear[2]) : NaN, late = Math.min(FEEL.sound.lateMax, d / FEEL.sound.c);
      const onTime = !!cr && !!th && !!de && Math.abs(cr.t - A.t0 - late) <= 1.5 / 60 && Math.abs(th.t - cr.t - FEEL.sound.thumpAfter) <= 0.5 / 60 && Math.abs(de.t - cr.t - FEEL.sound.debrisAfter) <= 1.5 / 60;
      const rated = [th, de].every(c => typeof c?.opts?.rate === 'number') && cr?.opts?.rate === undefined;   // (the crack takes the mixer's own draw off the system die: the one the can's bang took)
      F.verdict(onTime && rated && !names(A.log).includes('stunBang') && th.gain >= FEEL.sound.thump && th.gain <= FEEL.sound.thump * (1 + FEEL.sound.carry) && cr.gain <= FEEL.sound.crack * (1 + FEEL.sound.carry), 'the charge\'s own report: crack + thump as late as sound takes to reach Sam, the patter behind them, thump and patter at rates of their own and the crack on the mixer\'s one draw, no stun can\'s bang',
        `Sam ${f2(d)} m off → ${f2(late * 1000)} ms late · crack +${f2(((cr?.t ?? NaN) - A.t0) * 1000)} ms gain ${f2(cr?.gain)} · thump gain ${f2(th?.gain)} · debris +${f2(((de?.t ?? NaN) - A.t0) * 1000)} ms gain ${f2(de?.gain)} · rates ${[cr, th, de].map(c => f2(c?.opts?.rate)).join(' / ')} · heard: ${[...new Set(names(A.log).filter(n => n !== 'footstep'))].join(' ')}`);
      F.verdict(!!A.bang && !!B.bang && A.bang.loud === B.bang.loud && JSON.stringify(A.bang.pos) === JSON.stringify(B.bang.pos), 'the hearing event is the stun charge\'s, as ever: one loud \'bang\' at the same place with the feel on and off', `on: ${JSON.stringify(A.bang?.pos?.map((x: number) => +x.toFixed(2)))} loud ${A.bang?.loud} · off: ${JSON.stringify(B.bang?.pos?.map((x: number) => +x.toFixed(2)))} loud ${B.bang?.loud}`);
      const sb = at(B.log, 'stunBang');
      F.verdict(!!sb && sb.gain === 1 && !names(B.log).some(n => n.startsWith('wall')), 'FEEL.on false: the stun can\'s report at gain 1 and none of the three — as it was', `heard: ${[...new Set(names(B.log).filter(n => n !== 'footstep'))].join(' ')}`); }
    // (wave)
    { const mine = A.recs.filter(r => r.seeded), dustFrames = [...new Set(mine.filter(r => r.what === 'emit' && r.kind === 'dust').map(r => r.f))].sort((a, b) => a - b);
      let run = 1, best = 1; for (let i = 1; i < dustFrames.length; i++) { run = dustFrames[i] - dustFrames[i - 1] <= 2 ? run + 1 : 1; best = Math.max(best, run); }
      const R0 = FEEL.ring, reach = R0.r0 + R0.stages * R0.step + 0.5, T = 2 * (A.wall.alongX ? A.wall.box.h[2] : A.wall.box.h[0]);
      const ring = mine.filter(r => r.what === 'emit' && r.kind === 'dust' && Math.abs(r.pos[1] - R0.y) < 1e-6);
      const bad = ring.filter(r => !r.los || !r.los.some(d => d >= 0 && d <= reach));   // (the line asked on the frame the puff was made, as the ring asks it: five seconds on a man, a leaf or a thrown desk may stand in it)
      const imps = [...new Set(A.recs.filter(r => r.what === 'impulse' && (r.radius ?? 0) !== 4).map(r => r.f))], sparks = mine.filter(r => r.kind === 'spark').reduce((a, r) => a + r.count, 0), high = mine.filter(r => r.what === 'emit' && r.pos[1] > 2).length;
      const perFrame = (L: Rec[]) => { const m = new Map<number, number>(); for (const r of L) if (r.what === 'emit') m.set(r.f, (m.get(r.f) ?? 0) + r.count); return m; };
      const on = perFrame(A.recs), off = perFrame(B.recs); let total = 0, worst = 0, at0 = (on.get(0) ?? 0) - (off.get(0) ?? 0), all0 = on.get(0) ?? 0; for (const [f, n] of on) { const d = n - (off.get(f) ?? 0); total += d; worst = Math.max(worst, d); }
      const highOff = B.recs.filter(r => r.what === 'emit' && r.pos[1] > 2).length;
      F.verdict(best >= 8 && ring.length >= 40 && bad.length === 0 && imps.length >= 3 && sparks >= 20 && high - highOff >= 4, 'the wave in particles: the dust ring over eight or more frames, every puff of it in line of the wall\'s face and inside its reach; the push on three frames; a fireball; dust off the ceiling',
        `ring: ${ring.length} records over ${best} frames running, ${bad.length} out of line or reach (wall ${f2(T)} m thick) · impulses on frames ${imps.join(', ')} · fat sparks ${sparks} · ceiling records ${high - highOff} · births this module adds (on − off): ${total} in all, ${worst} on its worst frame, ${at0} on the blast frame (where the blast already makes ${all0 - at0})`);
      const un = (L: Rec[]) => L.filter(r => r.what === 'emit' && !r.seeded).length;
      F.verdict(un(A.recs) === un(B.recs), 'the particle system\'s own serial moves as it did: as many records without a seed of their own with the feel on as off', `unseeded records: on ${un(A.recs)} · off ${un(B.recs)} (seeded: on ${A.recs.filter(r => r.what === 'emit' && r.seeded).length} · off ${B.recs.filter(r => r.what === 'emit' && r.seeded).length})`); }
    // (kick)
    { const mag = A.kicks.map(k => k ? Math.hypot(k[0], k[1], k[2]) : 0), first = mag.findIndex(m => m > 0), last = mag.length - 1 - [...mag].reverse().findIndex(m => m > 0), peak = Math.max(...mag);
      F.verdict(first === 0 && peak > 0.02 && peak <= FEEL.kickM * 1.2 && (last + 1) / 60 <= FEEL.kickSecs + 2 / 60 && A.kicks[A.kicks.length - 1] === null, 'the kick: there on the blast frame, bounded, over inside its time', `first on frame +${first} · peak ${f2(peak * 100)} cm (cap ${f2(FEEL.kickM * 100)}) · last on frame +${last} (${f2((last + 1) / 60)} s; allowed ${FEEL.kickSecs} s) · by frame: ${mag.slice(0, 12).map(m => (m * 100).toFixed(1)).join(' ')} cm`);
      F.verdict(!!A.pic && A.pic.moved && A.pic.same, 'picture only: kickIn() moves the camera, kickOut() puts its look-at, eye and three matrices back to the bit', `moved by kickIn: ${A.pic?.moved} · identical after kickOut: ${A.pic?.same}`);
      F.verdict(Z.kicks.every(k => k === null) && B.kicks.every(k => k === null), 'FEEL.kick 0, or the feel off: no kick is written', `kick 0: ${Z.kicks.filter(k => k).length} frames with one · off: ${B.kicks.filter(k => k).length}`); }
    // (identity)
    F.verdict(A.digest === B.digest, 'the staged blast and five seconds after it digest identically with the feel on and off', `on ${A.digest} · off ${B.digest}`);
    return F.done();
  } finally { FEEL.on = keep.on; FEEL.kick = keep.kick; Math.random = rnd; }
}

if (import.meta.main) {
  const i = process.argv.indexOf('--scn'); const ok = await blastfeelFamily(i >= 0 ? process.argv[i + 1] : 'block-squads');
  console.log(`\n=== blastfeel-probes: ${ok ? 'ALL PASS' : 'FAILED'} ===`); process.exit(ok ? 0 : 1);
}
