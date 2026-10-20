// A MAN'S BREATH IS REAL STEAM: GAS IN THE SMOKE SOLVER, NOT SPRITES — the check behind SNOW_LOOK.steam (src/game/weatherKinds.ts; the numbers
// src/game/snowBreath.ts BREATHSTEAM; on in the page, ?breathsteam=0 = the puffs; off in the module and on the frozen stand, TPS_BREATHSTEAM=1).
//
// The maintainer, 10-20: "is breath proper volumetrics or some particle effects? … seems like it'd be cool if proper", then "actually the smoke from the gun
// muzzle is fine so maybe breath should just work like that".
//
//   bun run tools/qa/probes.ts breathsteam      (families `snow`, `weather`)      BREATHSTEAM_BREAK=1 = the switch never raised and the same lines asked: must FAIL
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's).
//
// WHAT THIS CAN AND CANNOT SAY. No GPU: the solver, its light and its shadows are the page's. What is read here is what the game HANDS the solver — a recording
// stand-in that says it is drawing, as tools/qa/snowbreath-check.ts reads the puffs off a recording stand-in for the particle pool — and what the game's own
// reads of smoke make of it. How the steam looks, how long it hangs and what a frame of it costs is nobody's to say from here.
//   steam     the pass's room clear, a squad of four: every living man under the open sky hands the solver one source a breath — on the fine lattice, at his
//             mouth, look-only — and files no puff
//   late      a man who was under a roof (or in the fog) as his breath began and steps out in the middle of it still steams: one source for what is left
//   follows   a source rides the mouth and takes its velocity from where the head faces and how he walks, turn by turn; it lets go of a man who dies, lies down
//             or goes into the fog, and when the switch goes off
//   sprint    the sprint rule holds on it: a man held at a run breathes more often, wider, denser and thrown harder — more so with the hard breath rule on than
//             off — and at rest the rule changes nothing
//   who       none off a dead man, a man lying down, a man the fog of war hides or a man under a roof
//   falls     with no solver drawing (the harness's null one, one that says it is not), with the steam's density at nothing, or past `reach` from where the
//             view looks, the breath is the puffs it was, record for record; with the switch off not one source
//   unread    the game's own smoke takes nothing of a breath; the solver's own code (smoke.ts, its CPU half run here on a bare object) counts none against
//             `budget`, cuts breaths before anything else when a step is over-full, takes a breath's velocity from its track, keeps a fine-only shove off the
//             coarse lattice, and says it is not drawing when switched off, frozen or not rendered
//   digest    the game does not know: 300 frames of the pass STEPPED BY THE GAME with a solver that takes the sources, on and off — one game digest; the same
//             with the senses on the CPU, where the game's own smoke ends the run holding nothing
//   switch    a recording carries the key, one from before it replays with it off, the frozen stand holds it off by name
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const DT = 1 / 60;

export async function breathSteamCheck(): Promise<boolean> {
  const BRK = process.env.BREATHSTEAM_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== breathsteam: a man's breath is gas in the smoke solver${BRK ? ' (the switch never raised: must fail)' : ''} ===`);
  const { SNOW_LOOK } = await import(`${ROOT}/src/game/weatherKinds.ts`); const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`); const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { updateSnowBreath, seedBreath, breathStats, steamOn, SNOWBREATH, BREATHSTEAM } = await import(`${ROOT}/src/game/snowBreath.ts`); const { HARDBREATH } = await import(`${ROOT}/src/game/character.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`); const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`); const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const { CpuSmoke, ownSmoke, SENSE } = await import(`${ROOT}/src/game/sense.ts`);
  const knobs0 = knobsCopy(), was = { breath: SNOW_LOOK.breath, steam: SNOW_LOOK.steam, cpu: SENSE.cpu, env: { ...process.env } }, log = console.log, K = SNOWBREATH, B = BREATHSTEAM, H = HARDBREATH, f = (v: number, n = 2) => v.toFixed(n);
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  /** the pass in snow, its room clear begun with a squad of four, the breath's switch up; the steam's where `on` says, by the stand's own word and held there */
  async function rig(on: boolean, hard = true) { const sw = on && !BRK;
    process.env.TPS_SNOW = '1'; process.env.TPS_SNOWBREATH = '1'; process.env.TPS_BREATHSTEAM = sw ? '1' : '0'; SNOW_LOOK.steam = !sw;   // (the module's switch left the WRONG way round: only the stand's word can put it right)
    const W: any = await quiet(() => standUp({ level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'pass.json'), 'utf8'))), seed: 7 }));
    const g = W.game, stood = SNOW_LOOK.steam; const hold = () => { SNOW_LOOK.breath = true; SNOW_LOOK.steam = sw; HARDBREATH.on = hard; };
    hold(); await quiet(() => startFromQuery(g, '?levelFile=pass.json&roomclear=0&squad4'));
    const step = (n = 1) => { for (let i = 0; i < n; i++) { hold(); W.step(DT); } };
    step(120); return { W, g, step, sw, stood, hold }; }
  /** a recording stand-in for the solver that says it is drawing, and one for the particle pool */
  const solver = (draws = true) => { const ems: any[] = [], pushes: any[] = []; let frame = 0; return { ems, pushes, tick() { frame++; }, S: { drawing() { return draws; }, emit(e: any) { ems.push({ ...e, pos: [...e.pos], dir: [...e.dir], frame }); }, push(p: any) { pushes.push({ ...p, frame }); }, inSmokeDomain() { return false; }, clearAll() { }, budget() { return 64; } } as any }; };
  const pool = () => { const recs: any[] = []; let frame = 0; return { recs, tick() { frame++; }, P: { emit(kind: string, pos: number[], dir: number[], count: number, opts: any) { recs.push({ kind, pos: [...pos], dir: [...dir], count, opts: { ...opts }, frame }); return count; } } as any }; };
  /** the breath run `frames` frames, reseeded, against a recording solver and a recording pool — on the game only for the breath's own call. `play`: the game is
   *  stepped a frame before each; `pre(i)` = what the line holds the men to; `smoke` = the solver to hand it (null = the harness's own null one) */
  const fly = (R: any, frames: number, o: { play?: boolean; own?: boolean; pre?: (i: number) => void; smoke?: any; focus?: number[] } = {}) => {
    const sv = o.smoke === undefined ? solver() : o.smoke, pl = pool(), g = R.g, e = g.engine as any, had = { p: e.particles, gp: e.settings.gpuParticles, smoke: g.smoke, vf: e.viewFocus };
    seedBreath(g, 1);
    if (o.own) {   // (the GAME's own step hands the sources over: the solver is the game's for the whole run, as the page's is — and under the CPU senses the game's own smoke stands in front of it)
      try { g.smoke = sv.S; for (let i = 0; i < frames; i++) { o.pre?.(i); R.step(1); sv.tick(); } } finally { g.smoke = had.smoke; }
      return { ems: sv.ems as any[], pushes: sv.pushes as any[], recs: pl.recs, S: { ...breathStats(g) } };
    }
    try { for (let i = 0; i < frames; i++) {
      if (o.play) R.step(1);
      o.pre?.(i); R.hold();
      e.particles = pl.P; e.settings.gpuParticles = true; if (sv) g.smoke = sv.S; if (o.focus) e.viewFocus = o.focus;
      updateSnowBreath(g, DT); pl.tick(); sv?.tick();
      e.particles = had.p; e.settings.gpuParticles = had.gp; g.smoke = had.smoke; if (o.focus) { if (had.vf === undefined) delete e.viewFocus; else e.viewFocus = had.vf; }
    } } finally { e.particles = had.p; e.settings.gpuParticles = had.gp; g.smoke = had.smoke; }
    return { ems: sv ? sv.ems as any[] : [], pushes: sv ? sv.pushes as any[] : [], recs: pl.recs, S: { ...breathStats(g) } };
  };
  const near = (e: any, cs: any[]) => cs.find(c => { const h = c.bones.head; return h && Math.hypot(e.pos[0] - h[0], e.pos[1] - h[1], e.pos[2] - h[2]) < 0.2 && e.pos[1] < h[1]; });
  const pkey = (r: any) => `${r.frame}:${r.opts.owner}:${r.opts.seed}:${r.count}:${r.pos.map((v: number) => v.toFixed(4)).join(',')}:${r.opts.steam}:${r.opts.size}:${r.opts.speed.toFixed(4)}`;
  try {
    const A = await rig(true), g = A.g;
    const ops: any[] = g.guards.filter((gd: any) => gd.team === 'operative'), foes: any[] = g.guards.filter((gd: any) => gd.team !== 'operative');
    const open = (c: any) => !!c.bones.head && !g.weather.underRoof(c.bones.head[0], c.bones.head[2]);
    const out: any[] = [g.player.char, ...ops.map(gd => gd.char)].filter(open);
    const still = () => { for (const c of out) { c.vel[0] = 0; c.vel[2] = 0; } };
    // ---- steam
    const on = fly(A, 600, { pre: still });
    { const who = on.ems.map(e => near(e, out)), per = out.map(c => on.ems.filter((_, i) => who[i] === c).length);
      const shape = on.ems.every(e => e.kind === 'breath' && e.lattice === 'fine' && e.confined === true && e.look === true && e.trackVel === true && typeof e.track === 'function' && e.age === 0 && e.ttl > 0.1 && e.ttl <= K.out + 1e-9
        && e.density === B.density && e.radius === B.radius && e.minVoxels === B.cells && e.temperature === B.temp && Math.abs(e.speed - B.speed) < 1e-9 && e.dir[1] < 0.3 * B.speed && Math.abs(Math.hypot(e.dir[0], e.dir[1], e.dir[2]) - e.speed) < 1e-9);
      verdict(A.stood === true && steamOn({ smoke: solver().S } as any) && out.length >= 5 && on.ems.length > 0 && on.recs.length === 0 && shape && who.every(Boolean) && per.every(n => n >= 2 && n <= 4) && on.S.steam === on.ems.length && on.S.breaths === on.ems.length && on.S.steaming === out.length,
        'steam — on the pass every living man under the open sky hands the solver one source a breath, and files no puff',
        `the stand's word raised the switch before the Game was built: ${A.stood} · ${on.S.why} · ${on.ems.length} sources in ten seconds for ${on.S.breaths} breaths, ${on.recs.length} puff records · a man: ${per.join(', ')} (two to four) · each a 'breath' on the fine lattice, confined to its track, look-only, ${B.density} /s through ${B.radius} m at ${B.speed} m/s for ${f(on.ems[0]?.ttl ?? 0)} s: ${shape} · each inside 0.2 m of its man's head bone and under it: ${who.every(Boolean)} · ${on.S.steaming} men steaming`); }
    // ---- late: the same breath twice off the same seed — in the open, to learn the frame it starts on; then with his head under a roof (by hand) until a few
    //      frames after that, so its first record has gone by unseen
    { const sam = g.player.char, had = g.smoke, wx = g.weather as any, roof = wx.underRoof; let under = false;
      const run = (until: number, frames: number) => { const sv = solver(); seedBreath(g, 1); still(); const mine = () => sv.ems.filter(x => near(x, [sam]));
        for (let i = 0; i < frames; i++) { under = i < until; A.hold(); g.smoke = sv.S; updateSnowBreath(g, DT); g.smoke = had; sv.tick(); } return mine(); };
      let first: any = null, got: any[] = [];
      try {
        wx.underRoof = (x: number, z: number) => (under && Math.hypot(x - sam.bones.head[0], z - sam.bones.head[2]) < 0.05) || roof.call(wx, x, z);
        first = run(0, 600)[0]; if (first) got = run(first.frame + 3, first.frame + 40);
      } finally { wx.underRoof = roof; g.smoke = had; under = false; }
      const late = got[0];
      verdict(!!first && got.length === 1 && late.frame > first.frame + 2 && late.frame <= first.frame + 3 + 12 && late.ttl > 0.05 && late.ttl < first.ttl - 1e-6 && late.look === true, 'late — a man under a roof as his breath began steams for what is left of it when he steps out',
        `in the open his breath starts on frame ${first?.frame} and its source runs ${first ? f(first.ttl) : '—'} s · under the roof until frame ${first ? first.frame + 3 : '—'}: ${got.length} source, on frame ${late?.frame ?? '—'}, for ${late ? f(late.ttl) : '—'} s`); }
    // ---- follows
    { const sam = g.player.char, sv = solver(); let e0: any = null; const keep = { x: sam.pos[0], hx: sam.bones.head[0], alive: sam.alive, hy: sam.bones.head[1] };
      // (his breath's first source, then the same closure asked as he is moved, walked, killed)
      const r = fly(A, 600, { pre: still, smoke: sv }); e0 = r.ems.find(e => near(e, [sam]));
      let moved = false, walked = false, down = false, dead = false, off = false, stale = false, fogged = false;
      if (e0) {
        // a fresh breath of his, caught on the frame it starts: step the breath alone until his next source appears
        const sv2 = solver(); let e1: any = null; const e = g.engine as any, had = { p: e.particles, gp: e.settings.gpuParticles, smoke: g.smoke };
        const tick = () => { A.hold(); g.smoke = sv2.S; updateSnowBreath(g, DT); g.smoke = had.smoke; };
        seedBreath(g, 1); still();
        for (let i = 0; i < 600 && !e1; i++) { tick(); e1 = sv2.ems.find(x => near(x, [sam])); }
        if (e1) {
          const a = e1.track(); sam.bones.head[0] += 0.5; const b = e1.track(); moved = !!a && !!b && Math.abs(b.pos[0] - a.pos[0] - 0.5) < 1e-9;
          sam.vel[0] = 2; const c = e1.track(); sam.vel[0] = 0; const cv = K.carry * B.carryK; walked = !!b && !!c && Math.abs(c.dir[0] - b.dir[0] - 2 * cv) < 1e-9 && Math.abs(c.dir[1] - b.dir[1]) < 1e-12;
          sam.bones.head[0] = keep.hx;
          sam.bones.head[1] = sam.pos[1] + 0.25; tick(); down = e1.track() === null; sam.bones.head[1] = keep.hy; tick();
          // (a breath on from there: a new source, asked the same things)
          const next = () => { const n0 = sv2.ems.length; let x: any = null; for (let i = 0; i < 600 && !x; i++) { tick(); x = sv2.ems.slice(n0).find(y => near(y, [sam])); } return x; };
          const e2 = next(); if (e2) { sam.alive = false; dead = e2.track() === null; sam.alive = keep.alive; }
          const e3 = next(); if (e3) { SNOW_LOOK.steam = false; off = e3.track() === null; SNOW_LOOK.steam = A.sw; }
          const e4 = next(); if (e4) { const live = e4.track() !== null; seedBreath(g, 1); tick(); tick(); stale = live && e4.track() === null; }
          const mate = ops[0], e5 = (() => { const n0 = sv2.ems.length; let x: any = null; for (let i = 0; i < 600 && !x; i++) { tick(); x = sv2.ems.slice(n0).find(y => near(y, [mate.char])); } return x; })();
          if (e5) { const fog = g.fogOfWar as any; fog.hidden = (gd: any) => gd === mate; tick(); fogged = e5.track() === null; delete fog.hidden; }
        }
      }
      verdict(!!e0 && moved && walked && down && dead && off && stale && fogged, 'follows — a source rides the mouth and its velocity is his head\'s facing and his walk; it lets go of a man who lies down, dies or goes into the fog, and when the switch goes off',
        `his head moved half a metre: the source with it ${moved} · walking at 2 m/s: the gas leaves with ${f(K.carry * B.carryK)} of it ${walked} · his head at the ground: let go ${down} · dead: ${dead} · the switch off: ${off} · the breath reseeded under it: ${stale} · a teammate the fog of war hides: ${fogged}`); }
    // ---- sprint
    { const sam = g.player.char; const run = (R: any, v: number) => { const c = R.g.player.char, mates = R.g.guards.filter((gd: any) => gd.team === 'operative').map((gd: any) => gd.char); return fly(R, 600, { pre: () => { for (const m of mates) { m.vel[0] = 0; m.vel[2] = 0; } c.vel[0] = v; c.vel[2] = 0; } }).ems.filter(e => near(e, [c])); };
      const Bq = await rig(true, false);   // (the hard breath rule off)
      const ra = run(A, 4.7), rb = run(Bq, 4.7), sa = run(A, 0), sb = run(Bq, 0); sam.vel[0] = 0; Bq.g.player.char.vel[0] = 0;
      const la = ra[ra.length - 1], lb = rb[rb.length - 1], s0 = sa[0];
      const same = sa.length > 0 && sa.length === sb.length && sa.every((e, i) => e.frame === sb[i].frame && e.density === sb[i].density && e.radius === sb[i].radius && e.speed === sb[i].speed);
      const jet = (e: any) => Math.hypot(e.dir[0] - 4.7 * (H.carry * B.carryK), e.dir[1], e.dir[2]);
      verdict(!!la && !!lb && !!s0 && ra.length >= sa.length + 3 && ra.length > rb.length && la.radius > s0.radius * 1.3 && la.density > s0.density * 1.8 && la.radius > lb.radius * 1.1 && la.density > lb.density * 1.2 && jet(la) > B.speed * 2.5 && la.speed > lb.speed * 1.5 && same,
        'sprint — the sprint rule holds on the steam: held at 4.7 m/s he breathes more often, wider, denser and thrown harder, more so with the hard breath rule on than off; at rest the rule changes nothing',
        `ten seconds: sources ${ra.length} running / ${sa.length} standing (rule on), ${rb.length} / ${sb.length} (rule off) · his last breath of the run: through ${f(la?.radius ?? 0, 3)} m / ${f(lb?.radius ?? 0, 3)} (at rest ${f(s0?.radius ?? 0, 3)}) · ${f(la?.density ?? 0, 1)} /s / ${f(lb?.density ?? 0, 1)} (at rest ${s0?.density}) · gas at ${f(la?.speed ?? 0)} m/s / ${f(lb?.speed ?? 0)}, of which the jet ${f(la ? jet(la) : 0)} (at rest ${B.speed}) · standing, rule on and off the same sources one for one: ${same}`); }
    // ---- who (it kills a man: late on this game)
    { const dead = ops[1], lying = ops[2], fogged = ops[3]; const fog = g.fogOfWar as any;
      const keep = { state: dead.state, alive: dead.char.alive, y: lying.char.bones.head[1] };
      dead.state = 'dead'; dead.char.alive = false; lying.char.bones.head[1] = lying.char.pos[1] + 0.25; fog.hidden = (gd: any) => gd === fogged;
      const w = fly(A, 600, { pre: still });
      delete fog.hidden; dead.state = keep.state; dead.char.alive = keep.alive; lying.char.bones.head[1] = keep.y;
      const roofed = foes.filter(gd => gd.state !== 'dead' && !open(gd.char)); const n = (c: any) => w.ems.filter(e => near(e, [c])).length;
      const rest = n(g.player.char) + n(ops[0].char), under = roofed.reduce((s, gd) => s + w.ems.filter(e => Math.hypot(e.pos[0] - gd.char.pos[0], e.pos[2] - gd.char.pos[2]) < 0.5).length, 0);
      verdict(n(dead.char) === 0 && n(lying.char) === 0 && n(fogged.char) === 0 && roofed.length > 0 && under === 0 && rest >= 4 && w.ems.length === rest && w.recs.length === 0,
        'who — not the dead, not a man lying down, not a man in the fog, not a man under a roof', `sources in ten seconds: the dead man ${n(dead.char)} · the man with his head at the ground ${n(lying.char)} · the man the fog of war hides ${n(fogged.char)} · ${roofed.length} living defenders under a roof, the fog bared: ${under} · the player and the teammate beside them: ${rest} of ${w.ems.length} in all`); }
    // ---- falls
    { const off = await rig(false); const base = fly(off, 600, { pre: () => { } }), k0 = base.recs.map(pkey).join('|');
      const cases: [string, any, number[] | undefined, (() => void)?][] = [['the harness\'s null solver', null, undefined], ['a solver that is not drawing', solver(false), undefined], ['the steam\'s density at nothing', solver(), undefined, () => { B.density = 0; }], ['every man past `reach` from where the view looks', solver(), [g.player.char.pos[0] + B.reach + 40, 0, g.player.char.pos[2]]]];
      const d0 = B.density; const got = cases.map(([name, sv, focus, set]) => { set?.(); let r: any; try { r = fly(A, 600, { pre: () => { }, smoke: sv, focus }); } finally { B.density = d0; } return { name, ems: r.ems.length, pushes: r.pushes.length, same: r.recs.map(pkey).join('|') === k0, n: r.recs.length }; });
      const inView = fly(A, 600, { pre: () => { }, focus: [g.player.char.pos[0], 0, g.player.char.pos[2]] });
      verdict(off.stood === false && base.ems.length === 0 && base.recs.length > 10 && base.S.steam === 0 && got.every(x => x.ems === 0 && x.pushes === 0 && x.same) && inView.ems.length > 0,
        'falls — with no solver drawing, no steam to let out, or past `reach` from the view, the breath is the puffs it was, record for record; with the switch off not one source',
        `the switch off (as the stand left it: ${off.stood}): ${base.ems.length} sources, ${base.recs.length} puff records · ${got.map(x => `${x.name}: ${x.ems} sources, ${x.n} records, the same ${x.same}`).join(' · ')} · the view on the player: ${inView.ems.length} sources`); }
    // ---- unread
    { const own = new CpuSmoke(), em = on.ems[0] ?? { kind: 'breath', look: true, trackVel: true, pos: [0, 0, 0], dir: [0, 0, 1], radius: 0.034, density: 9, ttl: 0.5 }; const b0 = own.budget();
      for (let i = 0; i < 30; i++) own.emit({ ...em, density: 1e6, radius: 1, ttl: 30 });   // (even a breath the size of a canister)
      const wrapped = solver(); const undo = ownSmoke(wrapped.S, own); wrapped.S.emit({ ...em, density: 1e6, radius: 1, ttl: 30 }); const viaWrap = own.blobs.length === 0 && own.lives.length === 0 && wrapped.ems.length === 1 && wrapped.S.budget() === b0; undo();
      own.emit({ ...em, look: false, kind: 'jet', density: 1e6, radius: 1, ttl: 30 }); const counted = own.blobs.length === 1 && own.budget() === b0 - 1;
      // the solver's own CPU half, on a bare object with its prototype (no device): what it counts, what it cuts, what a track gives it, which lattice a shove stirs
      const { SmokeSystem } = await import(`${ROOT}/src/smoke/smoke.ts`); const { FrameFlags } = await import(`${ROOT}/src/render/frame.ts`); const P = SmokeSystem.prototype as any;
      const bare = (o: any = {}) => Object.assign(Object.create(P), { params: { enabled: true, frozen: false }, emitters: [], pushes: [], boxes: [], grid: { levels: [{ voxel: 0.055 }, { voxel: 0.022 }] }, quiet: 9, emitStep: 0, stepNo: 0, time: 0, stats: {}, binding: {}, sealed: new Map(), engine: { settings: { flags: FrameFlags.Smoke }, world: null } }, o);
      const sys = bare(); const jet = { pos: [0, 0, 0], dir: [0, 0, 1], speed: 1, radius: 0.05, density: 1, temperature: 0, ttl: 5, age: 0, kind: 'jet' };
      sys.emit({ ...jet }); const bJet = sys.budget(); for (let i = 0; i < 5; i++) sys.emit({ ...em, track: undefined }); const bBreath = sys.budget();
      let vel = [3, 0, 4]; sys.emit({ ...em, track: () => ({ pos: [1, 2, 3], dir: vel }) }); sys.update(1 / 60); const tracked = sys.emitters[sys.emitters.length - 1];
      const took = Math.abs(tracked.speed - 5) < 1e-9 && Math.abs(tracked.dir[0] - 0.6) < 1e-9 && Math.abs(tracked.dir[2] - 0.8) < 1e-9 && tracked.pos[1] === 2;
      for (let i = 0; i < 200; i++) sys.emit({ ...jet, prio: 0 }); const flood = sys.emitters.filter((x: any) => x.look).length;   // (past twice a step's worth the list sheds: breaths first)
      const two = bare({ boxes: [{ level: 0, lo: [-1, -1, -1], hi: [1, 1, 1] }, { level: 1, lo: [-1, -1, -1], hi: [1, 1, 1] }] });
      two.push({ pos: [0, 0, 0], dir: [1, 0, 0], speed: 1, radius: 0.2 }); const both = two.pushes.map((x: any) => x.level).join(','); two.pushes.length = 0;
      two.push({ pos: [0, 0, 0], dir: [1, 0, 0], speed: 1, radius: 0.2, lattice: 'fine' }); const fine = two.pushes.map((x: any) => x.level).join(',');
      const draws = [bare().drawing(), bare({ params: { enabled: false, frozen: false } }).drawing(), bare({ params: { enabled: true, frozen: true } }).drawing(), bare({ engine: { settings: { flags: 0 } } }).drawing()].join(',');
      const txt = readFileSync(resolve(ROOT, 'src/smoke/smoke.ts'), 'utf8'), cut = /const prioOf = \(e: Packed\) => e\.look \? -1 :/.test(txt);
      verdict(viaWrap && counted && bBreath === bJet && bJet === 64 - 12 - 1 && took && flood === 0 && both === '0,1' && fine === '1' && draws === 'true,false,false,false' && cut, 'unread — the game\'s own smoke takes nothing of a breath; the solver counts none, cuts them first, follows their velocity, and keeps a fine-only shove off a screen',
        `thirty breaths, each made as thick as a canister, into the game's own smoke: no blob, its budget unmoved, through the solver's wrapper too: ${viaWrap} · the same source as a jet: one blob and one off the budget ${counted} · the solver's budget with one jet ${bJet}, with five breaths beside it ${bBreath} · a breath's track giving 5 m/s: speed ${f(tracked.speed)} along ${tracked.dir.map((x: number) => f(x, 1)).join(' ')} ${took} · 200 more emitters than a step packs: ${flood} breaths left in the list · a shove where both lattices hold smoke stirs levels ${both}, a fine-only one ${fine} · drawing (on / switched off / frozen / not rendered): ${draws} · the pack's sort puts a look-only source under every prio, by its text: ${cut}`); }
    // ---- digest
    { const dig = async (cpu: boolean) => { process.env.TPS_CPUSENSE = cpu ? '1' : '0'; const D1 = await rig(true), D0 = await rig(false);
        const d1 = fly(D1, 300, { own: true }), d0 = fly(D0, 300, { own: true }); const own = D1.g.cpuSmoke;
        return { h1: hashDigest(digestGame(D1.g)), h0: hashDigest(digestGame(D0.g)), n1: d1.ems.length, n0: d0.ems.length, cpu: SENSE.cpu, held: own.blobs.length + own.lives.length, wrapped: !!(D1.g as any).smokeOwned }; };
      const a = await dig(false), b = await dig(true); delete process.env.TPS_CPUSENSE; SENSE.cpu = was.cpu;
      verdict(a.h1 === a.h0 && b.h1 === b.h0 && a.n1 > 5 && a.n0 === 0 && b.n1 > 5 && b.cpu === true && a.cpu === false && b.wrapped && b.held === 0, 'digest — the game does not know: one digest with the sources handed over by its own step and without, and the same with the senses on the CPU',
        `300 frames of the pass's room clear, the game's own step: ${a.h1} with ${a.n1} sources, ${a.h0} with ${a.n0} · the senses on the CPU (${b.cpu}, the game's own smoke in front of the solver: ${b.wrapped}): ${b.h1} with ${b.n1}, ${b.h0} with ${b.n0} · what the game's own smoke holds after them: ${b.held}`); }
    // ---- switch
    { SNOW_LOOK.steam = true; const snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), has = typeof snap.tables?.SNOW_LOOK?.steam === 'boolean'; const old = JSON.parse(JSON.stringify(snap)); delete old.tables.SNOW_LOOK.steam;
      let offOld = false; await quiet(() => { applyKnobs(g, old); offOld = SNOW_LOOK.steam === false; applyKnobs(g, snap); offOld &&= SNOW_LOOK.steam === true; });
      const row = FROZEN_HOLDS['SNOW_LOOK.steam'];
      verdict(has && offOld && typeof row === 'string' && /TPS_BREATHSTEAM=1/.test(row), 'switch — a recording carries the key, one from before it replays with it off, and the frozen stand holds it off by name', `in the file ${has} · off for an old file ${offOld} · FROZEN_HOLDS ${row}`); }
  } finally {
    knobsBack(knobs0); SNOW_LOOK.breath = was.breath; SNOW_LOOK.steam = was.steam; SENSE.cpu = was.cpu; console.log = log;
    for (const k of ['TPS_SNOW', 'TPS_SNOWBREATH', 'TPS_BREATHSTEAM', 'TPS_CPUSENSE']) { if (was.env[k] === undefined) delete process.env[k]; else process.env[k] = was.env[k]; }
  }
  console.log(`=== breathsteam: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await breathSteamCheck()) ? 0 : 1);
