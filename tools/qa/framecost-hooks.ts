// FRAME COST, THE HOOKS — a bun PRELOAD (`bun --preload tools/qa/framecost-hooks.ts run tools/qa/<any harness tool>.ts …`) that times where a frame of the headless game goes,
// split by system, WITHOUT a line of src/ or of the harness changed on disk: a Bun.plugin `onLoad` rewrites two files AS THEY ARE LOADED —
//   src/game/game.ts     a `__FC.m(k)` statement in front of each top-level statement of Game.update that starts another system (the MARKS table below: 'from here on the
//                        clock is on bucket k'), so the update's wall time is split exactly, nothing sampled;
//   tools/qa/headless.ts  W.step bracketed (`__FC.begin()` … `__FC.end()`), the camera / the light set's ageing / the box list's upload each on its own bucket, and
//                        `__FC.stood(W)` on the freshly stood game — which (FC_DEEP, on by default) wraps the cross-cutting SERVICES every system calls into, on their
//                        prototypes: the animator + skeleton (Character.update), A* (NavGrid.findPath), sound propagation, the static line tests (sight / fire / reach), the
//                        circle collide. A service's time comes OUT of the system that called it and into its own bucket (outermost call only: a path's own line tests
//                        are the path's).
// Markers call performance.now() and add into a Float64Array: no dice drawn, nothing the simulation reads written — a run's PT_DIGEST is the same with the preload and
// without it (tools/qa/framecost.ts --verify makes that check). A mark whose line is gone (somebody re-wrote Game.update) is reported in the output's `missing`, and its
// time simply stays on the bucket before it: the tool keeps working, the split gets coarser there, and the table says so.
// At exit the per-frame matrix goes to $FC_OUT (JSON: bucket names, frames × buckets in ms as base64 Float32, the services' call counts) — tools/qa/framecost.ts is the
// one command that runs the missions under this and prints the tables. FC_DEEP=0: no service wraps (the cheapest clock: ~60 timestamps a frame).
import { plugin } from 'bun';
import { writeFileSync } from 'node:fs';

const MAXB = 64;
const NAMES: string[] = [];
const bucket = (n: string): number => { let i = NAMES.indexOf(n); if (i < 0) { i = NAMES.length; NAMES.push(n); if (i >= MAXB - 1) throw new Error('framecost: too many buckets'); } return i; };

// ── the buckets, in the order the tables print them. 'step:' rows are outside Game.update (the harness's W.step); 'svc:' rows are the services (FC_DEEP)
const B_PRE = bucket('update: head (journal, clocks)');
/** Game.update's statements, by how their line STARTS (trimmed) → the bucket that line and everything after it is charged to, up to the next mark */
const MARKS: [string, string][] = [
  ['useDice(this.dice);', 'update: head (the record loaded, clocks)'],
  ['updateAim(this', 'player (aim, interact, move, fire)'],
  ['this.orders.input(', 'squad: order menu + orders'],
  ['if (this.doorTools.menuKey(', 'squad: door tools'],
  ['updateInteract(this', 'player (aim, interact, move, fire)'],
  ['updateSuppression(this', 'suppression'],
  ['updatePlayer(this', 'player (aim, interact, move, fire)'],
  ['if (this.rings.length) updateRings(', 'gear: rings, 40 mm, frags'],
  ['this.searchProbeN = 0', 'guards: weapons dealt, anim flags'],
  ['this.director.tick(', 'scenario (director, breach, room clear, rescue)'],
  ['this.pair.input(', 'pair (two person stealth)'],
  ['this.doorTools.input(', 'squad: door tools'],
  ['this.nightBreach.tick(', 'scenario (director, breach, room clear, rescue)'],
  ['this.entry.tick()', 'squad: entry points, cleared rooms, cover'],
  ['this.doorTools.tick()', 'squad: door tools'],
  ['this.cover.tick()', 'squad: entry points, cleared rooms, cover'],
  ['silentTick(this)', 'squad: order menu + orders'],
  ['this.pair.tick(', 'pair (two person stealth)'],
  ['this.orders.tick()', 'squad: order menu + orders'],
  ['this.fight.tick(', 'room fight (both sides: watch, fear, shoot)'],
  ['nvgTick(this)', 'squad: order menu + orders'],
  ['tacticsTick(this', 'tactics (flank, lone corner, doorways)'],
  ['needsTick(this', 'needs (patrol variation)'],
  ['fragThrowTick(this', 'gear: rings, 40 mm, frags'],
  ['for (const g of this.guards) updateGuard(', 'guards: updateGuard (senses, state, feet)'],
  ['updateCivilians(this', 'civilians'],
  ['updateEscalation(this', 'escalation + QRF'],
  ['this.updateDoors(', 'doors'],
  ['updateMission(this', 'mission'],
  ['this.updateProps(', 'props (furniture)'],
  ['this.destr.update(', 'destruction (heat, debris)'],
  ['this.wallCharge.input(', 'destruction: wall charge, fire at cover'],
  ['wallReactTick(this', 'destruction: both sides react to a break'],
  ['coverfireTick(this', 'destruction: wall charge, fire at cover'],
  ['this.events = this.events.filter(', 'fixtures + devices'],
  ['this.weather.update(', 'weather, wet, wind, moths, rain fx (game half)'],
  ['updateItems(this', 'items (throwables, drops)'],
  ['updateGlass(this)', 'glass (stars, breaking, shards)'],
  ['this.fogOfWar.update(', 'fog of war'],
  ['const all: Character[] =', 'dynamic boxes (leaves, props, debris, rig props, fx)'],
  ['if (!this.tune.tracers && this.tracers.live)', 'tracers + sparks'],
  ['// characters wading through smoke', 'smoke pushes'],
  ['const world = this.engine.world; world.resetCapsules();', 'characters → skin instances + shadow proxies'],
  ['// light meter queries', 'sensors (meter + smoke line asks)'],
  ['this.player.hitFlash =', 'update: tail (cues, checkpoints, journal)'],
];
for (const [, n] of MARKS) bucket(n);
const B_CAM = bucket('step: camera'), B_LIGHTS = bucket('step: lights.update'), B_UPLOAD = bucket('step: box list pack + trace grid (world.upload)');
// FC_GPU=1 (tools/qa/framecost-gpu.ts: the real Engine on a recording device): the engine's own CPU half of a frame, which the stub harness never runs
const GPU = process.env.FC_GPU === '1';
// destruction as the page raises it (src/main.ts: on unless ?nodestruction): the play-through reads PT_DESTR itself, the soak does not — so the switch is raised here for both
if (process.env.PT_DESTR === '1') { const m: any = await import('../../src/game/destructionSwitch.ts').catch(() => null); if (m?.DESTRUCTION) m.DESTRUCTION.on = true; }
const B_SMOKE = bucket('step: smoke solver update (CPU half)'), B_RENDER = bucket('render: frame uniforms, probe, submit (the rest of Engine.render)'),
  R_LIGHTS = bucket('render: light list + reach / glass masks upload'), R_DECALS = bucket('render: decal list'), R_PART = bucket('render: particles (births → GPU records, update encode; the splat encode is under the lighting passes)'),
  R_SMOKE = bucket('render: smoke solver encode'), R_GB = bucket('render: g-buffer + mesh shadows encode, motion snapshot'), R_RC = bucket('render: cascades encode'), R_ENC = bucket('render: lighting passes encode');
const S_ANIM = bucket('svc: animation + skeleton (Character.update)'), S_PATH = bucket('svc: nav paths (A*, walkable, nearest free)'), S_SOUND = bucket('svc: sound propagation'),
  S_LINE = bucket('svc: static line tests (sight, fire, reach)'), S_COLLIDE = bucket('svc: circle collide (feet vs walls)'), S_RAY = bucket('svc: box world raycast (cursor, lasers, rounds)'),
  S_REACH = bucket('destruction: light reach masks re-decided after a wall breaks (Game.reachTick)'),
  S_WALL = bucket('destruction: a wall or cover breaking (rounds and blasts on it: holes, pieces, re-baked paths)');   // (the wall engine's two ways in, wherever in the frame a round or a blast lands)
// HEADLESS ONLY — left OUT of the frame by tools/qa/framecost.ts: where the light probe has not answered, four meters fall back to a CPU estimate of the same direct light
// (guards.ts lightEstimateAt: every light × a line test). Headless the probe NEVER answers, so that estimate runs for every armed man every frame; on the page the GPU answers
// within a frame or two and it does not run at all. Its time (its line tests included) is taken out of the system that asked and kept apart under this name.
const X_STANDIN = bucket('headless only: CPU light estimate standing in for the GPU light probe');
const B_FIRST_STEP = B_CAM, B_FIRST_SVC = S_ANIM;

const now = () => performance.now();
const acc = new Float64Array(MAXB);
let cur = B_PRE, last = 0, inFrame = false, svc = 0, game: any = null;
const frames: Float32Array[] = [];
const calls = new Float64Array(MAXB), callsOuter = new Float64Array(MAXB), lineBy = new Float64Array(MAXB);   // (lineBy: the static line tests' ms by the bucket that asked)
const missing: string[] = [], matched: string[] = [];
let uploads = 0;

const FC = {
  B_SMOKE, B_RENDER, B_CAM, B_LIGHTS,
  begin() { acc.fill(0); cur = B_PRE; inFrame = true; svc = 0; last = now(); },
  m(i: number) { if (!inFrame) return; const t = now(); acc[cur] += t - last; last = t; cur = i; },
  up() { uploads++; },
  end() { if (!inFrame) return; const t = now(); acc[cur] += t - last; inFrame = false; const row = new Float32Array(NAMES.length + 1); for (let i = 0; i < NAMES.length; i++) row[i] = acc[i]; row[NAMES.length] = game ? game.time : 0; frames.push(row); },
  /** one of the four stand-in sites (see X_STANDIN): `fn` runs as it would, its time on the headless-only bucket */
  standIn(fn: () => number): number {
    if (!inFrame) return fn();
    calls[X_STANDIN]++;
    if (svc) return fn();
    svc = 1; callsOuter[X_STANDIN]++; const t = now(); acc[cur] += t - last; last = t; const prev = cur; cur = X_STANDIN;
    try { return fn(); } finally { const t2 = now(); acc[X_STANDIN] += t2 - last; last = t2; cur = prev; svc = 0; }
  },
  /** the game is stood: wrap the services (FC_DEEP) on their prototypes — each a pass-through that moves the clock onto its bucket for the OUTERMOST call */
  stood(W: any) {
    game = W.game;
    // CHARACTER MATERIALS, as the page raises them (main.ts: on by itself for a mesh that carries slot-named materials = the cast): the per-man palette + proxy rows are part of 'characters → skin'
    if (process.env.FC_CHARMATS !== '0') { try { const cm = W.__fcCharMats; if (cm?.meshAuthored?.(W.game.ch?.mesh) && W.engine?.settings) { W.engine.settings.charMats = true; cm.charSlots?.(W.game.ch); } } catch { } }   // (+ the slot data solved now, as the page's boot does)
    if (process.env.FC_DEEP === '0') return;
    const wrap = (obj: any, name: string, b: number) => {
      let proto = obj; while (proto && !Object.hasOwn(proto, name)) proto = Object.getPrototypeOf(proto);   // (where the method lives: a prototype, or the object itself for a plain-object service)
      const fn = proto?.[name];
      if (typeof fn !== 'function' || fn.__fc) { if (typeof fn !== 'function') missing.push(`svc ${NAMES[b]} · ${name}`); return; }
      const w = function (this: any) {
        if (!inFrame) return fn.apply(this, arguments);   // (the driving script's own calls between frames are not the game's)
        calls[b]++;
        if (svc) return fn.apply(this, arguments);
        svc = 1; callsOuter[b]++; const t = now(); acc[cur] += t - last; last = t; const prev = cur; cur = b;
        try { return fn.apply(this, arguments); }
        finally { const t2 = now(); acc[b] += t2 - last; if (b === S_LINE) lineBy[prev] += t2 - last; last = t2; cur = prev; svc = 0; }
      };
      (w as any).__fc = true; proto[name] = w;
    };
    const g = W.game;
    wrap(g.player.char, 'update', S_ANIM);
    wrap(g.col.nav, 'findPath', S_PATH); wrap(g.col.nav, 'walkable', S_PATH); wrap(g.col.nav, 'nearestFreePoint', S_PATH);
    wrap(g.col.sound, 'propagate', S_SOUND);
    wrap(g.col, 'segmentBlocked', S_LINE); wrap(g.col, 'segmentBlockedDynamic', S_LINE); wrap(g.col, 'shotBlocked', S_LINE); wrap(g.col, 'raycast', S_LINE);
    wrap(g.col, 'collideCircle', S_COLLIDE);
    wrap(W.engine.world, 'raycast', S_RAY);
    if (g.destr?.walls) { wrap(g.destr.walls, 'round', S_WALL); wrap(g.destr.walls, 'blast', S_WALL); if (typeof g.reachTick === 'function') wrap(g, 'reachTick', S_REACH); }   // (a build with the wall engine)
    if (GPU) {   // the engine's CPU half, by part (each comes out of 'render: … the rest')
      const e = W.engine;
      wrap(e.world, 'upload', B_UPLOAD); wrap(e.lights, 'upload', R_LIGHTS); wrap(e, 'glassLightMasks', R_LIGHTS);
      if (e.decals) wrap(e.decals, 'frame', R_DECALS);
      if (e.particles) { wrap(e.particles, 'prepare', R_PART); wrap(e.particles, 'encodeUpdate', R_PART); wrap(e.particles, 'encodeDraw', R_PART); }
      if (e.smoke?.encode) wrap(e.smoke, 'encode', R_SMOKE);
      wrap(e.gbuffer, 'encode', R_GB); wrap(e.gbuffer, 'encodeDown', R_GB); wrap(e.gbuffer, 'snapshotPrev', R_GB); if (e.meshShadows) wrap(e.meshShadows, 'encode', R_GB);
      wrap(e.rc, 'encode', R_RC); wrap(e.passes, 'encode', R_ENC);
    }
  },
};
(globalThis as any).__FC = FC;

/** `mark` in front of the first line of `text` (from line `from` to `to`) that starts with `head` once trimmed; false when no line does */
function insertBefore(lines: string[], from: number, to: number, head: string, mark: string): number {
  for (let i = from; i < to; i++) if (lines[i].trimStart().startsWith(head)) { lines.splice(i, 0, mark); return i; }
  return -1;
}

function instrumentGame(src: string): string {
  const lines = src.split('\n');
  const a = lines.findIndex(l => /^  step\(dt: number, cmd: PlayerCmd\) \{/.test(l));   // (the tick's body: Game.update only samples the input record and calls it)
  if (a < 0) { missing.push('game.ts: Game.step not found — nothing split'); return src; }
  let end = lines.findIndex((l, i) => i > a && l === '  }'); if (end < 0) end = lines.length;
  // update()'s PARTS are searched too: runs of its lines stand in private methods right after it (called where they stood), and a mark sits where its line went
  for (;;) { let j = end + 1; while (j < lines.length && /^  (\/\/|\/\*\*)/.test(lines[j])) j++; if (j >= lines.length || !/^  private \w+\(.*\) \{$/.test(lines[j])) break; const e = lines.findIndex((l, i) => i > j && l === '  }'); if (e < 0) break; end = e; }
  for (const [head, name] of MARKS) {
    const at = insertBefore(lines, a + 1, end, head, `globalThis.__FC.m(${bucket(name)});`);
    if (at < 0) missing.push(`game.ts mark · ${head}`); else { matched.push(head); end++; }
  }
  return lines.join('\n');
}

/** the four places a meter falls back to the CPU light estimate when the probe has no answer (guards.ts ×3, civilians.ts ×1): the fallback expression wrapped, nothing else */
const STANDINS: [string, string][] = [
  [': Math.max(lightEstimateAt(g, pc), lightEstimateAt(g, ph));', ': (globalThis as any).__FC.standIn(() => Math.max(lightEstimateAt(g, pc), lightEstimateAt(g, ph)));'],
  [': lightEstimateAt(g, at);', ': (globalThis as any).__FC.standIn(() => lightEstimateAt(g, at));'],
];
let standInSites = 0;
function instrumentStandIns(src: string): string {
  for (const [a, b] of STANDINS) { const n = src.split(a).length - 1; if (n) { standInSites += n; src = src.replaceAll(a, b); } }
  return src;
}

function instrumentHarness(src: string): string {
  const lines = src.split('\n');
  const a = lines.findIndex(l => l.trimStart().startsWith('step(dt: number, follow: Vec3 | null = null) {'));
  if (a < 0) { missing.push('headless.ts: W.step not found — no frames'); return src; }
  let end = lines.findIndex((l, i) => i > a && l.trim() === '},'); if (end < 0) end = lines.length;
  const put = (head: string, mark: string) => { const at = insertBefore(lines, a + 1, end, head, mark); if (at < 0) missing.push(`headless.ts mark · ${head}`); else end++; };
  put('game.update(dt, input, cam, canvas);', 'globalThis.__FC.begin();');
  if (GPU) put('cam.update(dt, follow ??', 'if (globalThis.__FCG) { globalThis.__FCG.frame(W, dt, follow); globalThis.__FC.end(); input.endFrame(); return; }');   // the page's order from here: smoke → camera → lights → Engine.render
  put('cam.update(dt, follow ??', `globalThis.__FC.m(${B_CAM});`);
  put('engine.lights.update(dt, game.time);', `globalThis.__FC.m(${B_LIGHTS});`);
  put('input.endFrame();', 'globalThis.__FC.end();');
  { const i = lines.findIndex((l, k) => k > a && l.trimStart().startsWith('if (frame++ % uploadEvery === 0) engine.world.upload();'));   // (count the frames that did upload: the page uploads every frame, the play-through every 4th — the tables give the cost per upload)
    if (i >= 0) lines[i] = lines[i].replace('engine.world.upload();', `{ globalThis.__FC.up(); globalThis.__FC.m(${B_UPLOAD}); engine.world.upload(); }`); else missing.push('headless.ts: the upload line'); }
  const r = lines.findIndex((l, k) => k > end && l === '  return W;');
  // (which of the harness's two stands this game stood on, as the harness itself says — src/host/profile.ts; a build from before the stands has no such function: none filed)
  if (r >= 0) lines.splice(r, 0, "  (globalThis as any).__FC_STAND = typeof harnessProfile === 'function' ? harnessProfile() : undefined;", "  (W as any).__fcCharMats = await import('../../src/render/charMaterials').catch(() => null);   /* (a build from before the cast has no such module) */", GPU ? '  (globalThis as any).__FCG_W = W; await (globalThis as any).__FCG.ready(W); globalThis.__FC.stood(W);' : '  globalThis.__FC.stood(W);'); else missing.push('headless.ts: return W (no service wraps)');
  if (GPU) {   // standUp takes its engine and its smoke solver from tools/qa/framecost-gpu.ts instead of the stub
    const swap = (head: string, from: string, to: string) => { const i = lines.findIndex(l => l.trimStart().startsWith(head)); if (i >= 0 && lines[i].includes(from)) lines[i] = lines[i].replace(from, to); else missing.push(`headless.ts: ${head}`); };
    swap('const engine: any = stubMod.stubHost();', 'stubMod.stubHost()', '(await (globalThis as any).__FCG.engine())');
    swap('const smoke: any = standMod.nullSmoke();', 'standMod.nullSmoke()', '(await (globalThis as any).__FCG.smoke(engine))');
  }
  return lines.join('\n');
}

plugin({
  name: 'framecost',
  setup(build) {
    build.onLoad({ filter: /[\\/]src[\\/]game[\\/](guards|civilians)\.ts$/ }, async (args: any) => ({ contents: instrumentStandIns(await Bun.file(args.path).text()), loader: 'ts' }));
    build.onLoad({ filter: /[\\/]src[\\/]game[\\/]game\.ts$/ }, async (args: any) => ({ contents: instrumentGame(await Bun.file(args.path).text()), loader: 'ts' }));
    if (GPU) build.onLoad({ filter: /[\\/]src[\\/]engine\.ts$/ }, async (args: any) => ({ contents: (await Bun.file(args.path).text()).replaceAll('window.devicePixelRatio', '(globalThis as any).__FC_DPR'), loader: 'ts' }));   // (the one DOM read in the renderer)
    build.onLoad({ filter: /[\\/]tools[\\/]qa[\\/]headless\.ts$/ }, async (args: any) => ({ contents: instrumentHarness(await Bun.file(args.path).text()), loader: 'ts' }));
  },
});

if (GPU) await import('./framecost-gpu.ts');

process.on('exit', () => {
  const out = process.env.FC_OUT; if (!out) return;
  if (standInSites !== 4) missing.push(`the probe's CPU stand-in: ${standInSites} of 4 fallback sites found in guards.ts / civilians.ts — its time is (partly) inside the systems that asked`);
  const nb = NAMES.length, mat = new Float32Array(frames.length * (nb + 1));
  frames.forEach((r, i) => mat.set(r.length === nb + 1 ? r : Float32Array.from({ length: nb + 1 }, (_, k) => k < r.length - 1 ? r[k] : k === nb ? r[r.length - 1] : 0), i * (nb + 1)));
  try {
    writeFileSync(out, JSON.stringify({ v: 1, runtime: `bun ${Bun.version}`, stand: (globalThis as any).__FC_STAND, deep: process.env.FC_DEEP !== '0', names: NAMES, firstStep: B_FIRST_STEP, firstSvc: B_FIRST_SVC, upload: B_UPLOAD,
      frames: frames.length, uploads, missing, marks: matched.length, calls: Array.from(calls.subarray(0, nb)), callsOuter: Array.from(callsOuter.subarray(0, nb)), lineBy: Array.from(lineBy.subarray(0, nb)),
      gpu: GPU ? (globalThis as any).__FCG?.report() : undefined,
      ms: Buffer.from(mat.buffer).toString('base64') }));
  } catch (e) { console.error(`framecost: could not write ${out} — ${e}`); }
});
