// GLASS TUNING INSTRUMENT (rebuild/glass/tuning.md) — the three glass parts together (fracture + rounds through + falling glass) staged headless, one scene a run,
// and what a player would see and hear of it written down frame by frame: how much of the pane is open, when it runs / dices / is walked through, what each round
// kept after the pane, the glass that let go (fragments, plates, shard particles born, trimmed at the caps), every sound by name and every hearing event.
//
//   bun run tools/qa/glass-tune.ts [--scene id,id | all] [--out DIR] [--tag r1] [--set '{"GLASSBREAK":{"breakE":{"tempered":2}}}'] [--secs 6] [--quiet]
//   bun run tools/qa/glass-tune.ts list
//
// A scene id is <pane>-<gun>-<volume>: pane annealed | tempered | laminated, gun pistol (Five-seveN) | rifle (FN2000) | nine (the guards' 9 mm) | carbine (AKS-74U),
// volume one | burst (5 at the gun's automatic cadence) | mag (30 walked across the pane) | tight (30 into one hand's breadth); plus stun-annealed | stun-tempered |
// stun-laminated (a stun charge 1.2 m from the pane). --set takes the glass tables by name (GLASSFX GLASS GLASSBREAK GLASSPEN SHARDS), deep-assigned over the shipped values.
// Output: one JSON a scene in --out (default the scratch dir printed), a summary row a scene on stdout. Nothing here is a verdict: `probes.ts glass` is.
import { standUp, ROOT, fake } from './headless.ts';
import { TUNE_PANE } from './office-pane.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon, detonateStun } = await import(`${ROOT}/src/game/combat.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const PM = await import(`${ROOT}/src/render/particles.ts`);
const GM = await import(`${ROOT}/src/game/glass.ts`);
const GBM = await import(`${ROOT}/src/game/glassbreak.ts`);
const GPM = await import(`${ROOT}/src/game/glasspen.ts`);
const SM = await import(`${ROOT}/src/game/shards.ts`);
const { GB_STATS, GLASSBREAK } = GBM; const { SHARDS, SHARD_STATS } = SM; const { GLASSPEN, GLASSPEN_HOOKS } = GPM; const { GLASS, GLASSFX } = GM;

type Vec3 = [number, number, number];
const DT = 1 / 60;
const argv = process.argv.slice(2);
const arg = (k: string, d: string | null = null) => { const i = argv.indexOf(k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const QUIET = argv.includes('--quiet');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash01 = (n: number) => { let x = (n | 0) * 0x9E3779B1; x ^= x >>> 15; x = Math.imul(x, 0x85EBCA6B); x ^= x >>> 13; return ((x >>> 0) % 100000) / 100000; };

const PANES = ['annealed', 'tempered', 'laminated'] as const;
const GUNS: Record<string, { id: string; every: number }> = { pistol: { id: 'fiveseven', every: 0.25 }, rifle: { id: 'fn2000', every: 0.1 }, nine: { id: 'guard9mm', every: 0.3 }, carbine: { id: 'aks74u', every: 0.1 } };
const VOLS: Record<string, { n: number; spread: 'point' | 'hand' | 'walk' }> = { one: { n: 1, spread: 'point' }, burst: { n: 5, spread: 'hand' }, mag: { n: 30, spread: 'walk' }, tight: { n: 30, spread: 'hand' } };
function sceneIds(): string[] {
  const out: string[] = [];
  for (const p of PANES) { for (const g of ['pistol', 'rifle']) for (const v of ['one', 'burst', 'mag']) out.push(`${p}-${g}-${v}`); out.push(`${p}-nine-burst`, `${p}-rifle-tight`, `stun-${p}`); }
  out.push('annealed-rifle-burst-walkin', 'annealed-rifle-mag-walkin', 'annealed-pistol-mag-walkin');   // … then Sam walks at what is left (the raking rule)
  return out;
}
if (argv[0] === 'list') { console.log(sceneIds().join('\n')); process.exit(0); }

function deepAssign(dst: any, src: any, path: string) {   // a nested object merges key by key; an EMPTY object replaces (--set '{"SHARDS":{"soundGap":{}}}' = no gaps)
  for (const [k, v] of Object.entries(src)) {
    if (!(k in dst)) throw new Error(`--set: no key ${path}.${k}`);
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length && dst[k] && typeof dst[k] === 'object') deepAssign(dst[k], v, `${path}.${k}`); else dst[k] = v;
  }
}
/** the parts as THIS run asked for them: all on, less what the env (GLASSFX / GLASSBREAK / GLASSPEN / GLASSSHARDS = off) or --set ({"GLASSFX":{"on":false}}, {"GLASSPEN":{"on":false}}) took out */
const ENV_OFF = (n: string) => /^(0|off|false|no)$/i.test(process.env[n] ?? '');
function partsOn(game: any) {
  const fx = !ENV_OFF('GLASSFX') && SET.GLASSFX?.on !== false;
  GLASSFX.on = fx; GLASSPEN.on = fx && !ENV_OFF('GLASSPEN') && SET.GLASSPEN?.on !== false; game.tune.glassBreak = fx && !ENV_OFF('GLASSBREAK'); game.tune.glassShards = fx && !ENV_OFF('GLASSSHARDS');
}
const TABLES: Record<string, any> = { GLASSFX, GLASS, GLASSBREAK, GLASSPEN, SHARDS };
const setRaw = arg('--set'); const SET = setRaw ? JSON.parse(setRaw) : {};
for (const [name, o] of Object.entries(SET)) { if (!TABLES[name]) throw new Error(`--set: no table ${name} (have ${Object.keys(TABLES).join(' ')})`); deepAssign(TABLES[name], o, name); }

interface Row { f: number; t: number; open: number; run: boolean; gone: boolean; walk: boolean; sites: number; energy: number; debris: number; plates: number; live: number; born: number }
async function runScene(id: string, secs: number) {
  const parts = id.split('-'); const stun = parts[0] === 'stun'; const paneKind = (stun ? parts[1] : parts[0]) as typeof PANES[number];
  const gun = stun ? null : GUNS[parts[1]]; const vol = stun ? null : VOLS[parts[2]]; const walkin = parts[3] === 'walkin';
  if (!PANES.includes(paneKind) || (!stun && (!gun || !vol))) throw new Error(`unknown scene ${id}`);
  Math.random = seeded(4242);
  const W = await standUp(); const { game, engine } = W;
  engine.particles = new PM.Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  partsOn(game); game.tune.chaos = 0.5; game.godMode = true; game.player.visibility = 0.02;
  for (const k of Object.keys(GB_STATS)) (GB_STATS as any)[k] = 0; for (const k of Object.keys(SHARD_STATS)) (SHARD_STATS as any)[k] = 0;
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.char.bodyYaw = gd.char.aimYaw = Math.PI / 2; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; gd.flashlight.enabled = false; gd.char.update(0); });
  const gb = game.glassBreak;
  // the pane: the conference partition's second sheet (annealed), the first full-height facade sheet (tempered), the manager's sidelight (laminated)
  const bi = TUNE_PANE[paneKind], b = game.level.boxes[bi];   // (by where it stands, office-pane.ts: a box index moves with every level export)
  if (gb.typeOfPane(bi) === null) throw new Error(`the office's ${paneKind} pane (box ${bi}) is no sheet of glass: the level has moved`);
  if (gb.typeOfPane(bi) !== paneKind) gb.setType(bi, paneKind);   // (a scene is a KIND of glass in a known frame; which pane is which kind is the type rule's, and moves with GLASSREAL.place)
  const wide = b.h[0] >= b.h[2] ? 0 : 2; const cs = Math.cos(b.yaw ?? 0), sn = Math.sin(b.yaw ?? 0);
  const nrm: Vec3 = wide === 0 ? [sn, 0, cs] : [cs, 0, -sn]; const tan: Vec3 = wide === 0 ? [cs, 0, -sn] : [-sn, 0, cs];
  // the shooter stands on the side with floor under him 1.7 m out (inside the building for the facade; the corridor side of the partitions)
  let side = 1; { const p = v3.mad([b.c[0], 0, b.c[2]], nrm, 1.7) as Vec3; const q = v3.mad([b.c[0], 0, b.c[2]], nrm, -1.7) as Vec3; const inB = (x: Vec3) => x[0] > 4 && x[0] < 36 && x[2] > 4 && x[2] < 24; if (paneKind === 'tempered') side = inB(p) ? 1 : -1; else side = (p[2] > q[2]) ? 1 : -1; }
  const out: Vec3 = v3.scale(nrm, side) as Vec3; const sam: Vec3 = v3.mad([b.c[0], 0, b.c[2]], out, 1.7) as Vec3;
  game.teleportPlayer(sam); const yaw = Math.atan2(-out[0], -out[2]); game.player.char.bodyYaw = game.player.char.aimYaw = yaw; game.player.slot = gun && (gun.id === 'fiveseven' || gun.id === 'guard9mm') ? 'pistol' : 'rifle'; game.player.holstered = false; game.player.crouch = false;
  W.step(DT); W.step(DT);
  const hu = wide === 0 ? b.h[0] : b.h[2], hv = b.h[1];
  const aim = (k: number): Vec3 => {
    let u = 0.11, v = 0.17;   // (off the sheet's centre: the manager's sidelight carries a placard there)
    if (vol!.spread === 'hand') { u = 0.11 + (hash01(k * 7 + 1) - 0.5) * 0.12; v = 0.17 + (hash01(k * 7 + 2) - 0.5) * 0.12; }
    else if (vol!.spread === 'walk') { u = (-0.7 + 1.4 * k / Math.max(1, vol!.n - 1)) * hu * 0.9 + (hash01(k * 7 + 1) - 0.5) * 0.1; v = (hash01(k * 7 + 2) - 0.5) * Math.min(0.8, hv * 1.2); }
    return [b.c[0] + tan[0] * u - out[0] * 0.5, b.c[1] + v * 1 - (b.c[1] - 1.35) * (paneKind === 'tempered' ? 1 : 0), b.c[2] + tan[2] * u - out[2] * 0.5];   // a point half a metre BEHIND the pane, about chest height on a full-height sheet
  };
  const t0 = game.time; const P = engine.particles; const seen = new WeakSet<any>(); W.audioLog = [];
  const rows: Row[] = []; const rounds: any[] = []; const events: any[] = []; const emits: Record<string, number> = {}; const cross: any[] = [];
  let beyond = 0;   // panes crossed past the one under test (the facade behind the manager's office)
  const prevCrossed = GLASSPEN_HOOKS.crossed;
  GLASSPEN_HOOKS.crossed = (g_: any, x: any, who: number) => { prevCrossed?.(g_, x, who); if (x.bi !== bi) { beyond++; return; } cross.push({ t: +(game.time - t0).toFixed(3), eIn: +x.eIn.toFixed(3), eOut: +x.eOut.toFixed(3), hole: !!x.hole, turn: +x.turnDeg.toFixed(2) }); };
  const shootFrames = Math.round(secs * 60); const frames = shootFrames + (walkin ? 300 : 0); let fired = 0; let crossedAt: number | null = null; let nextAt = 0.2; let emitPerFrameMax = 0;
  const marks: Record<string, number> = {};
  for (let f = 0; f < frames; f++) {
    const t = game.time - t0;
    if (stun) { if (f === 12) { const at: Vec3 = v3.mad([b.c[0], 0.4, b.c[2]], out, 1.2) as Vec3; detonateStun(game, { kind: 'flash', pos: at, vel: [0, 0, 0], age: 1, fuse: 0, fired: true, who: 0 } as any); rounds.push({ t: +t.toFixed(3), stun: at }); } }
    else while (fired < vol!.n && t >= nextAt) {
      const p = aim(fired); const r = fireWeapon(game, game.player.char, p, true, { weapon: (WEAPONS as any)[gun!.id] });
      void r; rounds.push({ k: fired, t: +t.toFixed(3), aim: p.map(x => +x.toFixed(2)) }); fired++; nextAt += gun!.every;
      const fa = game.player.firearm; if (fa) { fa.chamber = 1; fa.mag = Math.max(fa.mag ?? 0, 5); fa.cool = 0; }
    }
    if (walkin && f === shootFrames) game.puppet = { goal: v3.mad([b.c[0], 0, b.c[2]], out, -1.5) as Vec3, aim: null, walk: 1.55 };
    W.step(DT);
    if (walkin && crossedAt == null && v3.dot(v3.sub(game.player.char.pos, b.c), out) < -0.3) crossedAt = +(game.time - t0).toFixed(3);
    let n = 0; for (const e of P.pending as any[]) { emits[e.kind] = (emits[e.kind] ?? 0) + e.count; n += e.count; } P.pending.length = 0; P.pendingImpulses.length = 0; emitPerFrameMax = Math.max(emitPerFrameMax, n);
    for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind !== 'step') events.push({ t: +(e.time - t0).toFixed(3), kind: e.kind, level: e.level ?? null, who: e.who ?? null }); }
    const info = gb.paneInfo(bi)!;
    const row: Row = { f, t: +(game.time - t0).toFixed(3), open: +info.openFraction.toFixed(4), run: info.run, gone: info.gone, walk: info.walkable, sites: info.sites, energy: +info.energy.toFixed(2), debris: game.destr.debris.list.length, plates: game.shards.plateCount ?? 0, live: game.shards.live ?? 0, born: SHARD_STATS.born };
    rows.push(row);
    if (info.run && marks.run == null) marks.run = row.t; if (info.gone && marks.gone == null) marks.gone = row.t; if (info.walkable && marks.walk == null) marks.walk = row.t;
    if (info.openFraction > 0 && marks.firstOpen == null) marks.firstOpen = row.t; if (info.openFraction >= 0.5 && marks.half == null) marks.half = row.t;
  }
  GLASSPEN_HOOKS.crossed = prevCrossed; game.puppet = null;
  const NOT_GLASS = /^(footstep|heldProtest|propScrape|propThud|click|magDrop|earRing)$/;   // (the staging's own noise: parked men, the furniture Sam was teleported into)
  const audio = (W.audioLog as any[]).map(a => ({ t: +(a.t - t0).toFixed(3), name: a.name, gain: +a.gain.toFixed(3), rate: +(a.opts?.rate ?? 1).toFixed(3), d: a.pos ? +v3.dist(a.pos, game.player.char.pos).toFixed(2) : 0 })).filter(a => !NOT_GLASS.test(a.name));
  // what is left in the frame (annealed): every piece still in, its area, how low it reaches, whether the support rule calls it held, whether it is a tooth
  const stP = (gb as any).panes?.get?.(bi); const left: any[] = [];
  if (stP && stP.type === 'annealed' && stP.sites.length) {
    const held: Set<number> = (gb as any).heldSet(stP);
    for (const f of (gb as any).fragsOf(stP)) if (!stP.open[f.fid]) left.push({ fid: f.fid, band: f.b, area: +f.area.toFixed(4), vMin: +(f.vMin + b.c[1]).toFixed(2), tooth: f.area < GLASSBREAK.toothArea && f.frame.bottom + f.frame.left + f.frame.right + f.frame.top > 1e-4, held: held.has(f.fid), pts: f.pts.map((q: number[]) => [+q[0].toFixed(3), +q[1].toFixed(3)]) });
  }
  const by = <T,>(xs: T[], key: (x: T) => string) => { const m: Record<string, number> = {}; for (const x of xs) m[key(x)] = (m[key(x)] ?? 0) + 1; return m; };
  const last = rows[rows.length - 1];
  const lastMove = (() => { let t = 0; for (let i = 1; i < rows.length; i++) if (rows[i].open !== rows[i - 1].open) t = rows[i].t; return t; })();
  const sum = {
    id, pane: bi, type: paneKind, gun: gun?.id ?? 'stun', rounds: fired, ...(walkin ? { walkin: { from: +(shootFrames / 60).toFixed(2), through: crossedAt, raked: GB_STATS.raked } } : {}), size: [+(2 * hu).toFixed(2), +(2 * hv).toFixed(2)],
    open: last.open, run: last.run, gone: last.gone, walk: last.walk, sites: last.sites, energy: last.energy, marks, settled: lastMove,
    crossed: cross.length, beyond, left: left.length, leftBlocking: left.filter(f => !f.tooth && f.vMin < GLASSBREAK.walkClearH).length, leftArea: +left.reduce((a, f) => a + f.area, 0).toFixed(3), eOutMean: cross.length ? +(cross.reduce((a, x) => a + x.eOut, 0) / cross.length).toFixed(3) : null, byHole: cross.filter(x => x.hole).length,
    fragments: SHARD_STATS.fragments, plates: SHARD_STATS.plates, platesRefused: SHARD_STATS.platesRefused, breaks: SHARD_STATS.breaks, born: SHARD_STATS.born, trimmed: SHARD_STATS.trimmed, peakLive: SHARD_STATS.peakLive, peakPlates: SHARD_STATS.peakPlates,
    emitPerFrameMax, emits, audio: by(audio, a => a.name), events: by(events, e => e.kind), glassEvents: events.filter(e => e.kind === 'glass').length,
    gb: { ...GB_STATS }, set: SET,
  };
  return { sum, rows, rounds, events, audio, cross, left, hu, hv, log: (gb as any).panes?.get?.(bi)?.log ?? [] };
}

const want = (arg('--scene', 'all') as string); const ids = want === 'all' ? sceneIds() : want.split(',');
const outDir = arg('--out', `${process.env.TMPDIR ?? '/tmp'}/glass-tune`) as string; const tag = arg('--tag', 'run') as string; const secs = Number(arg('--secs', '6'));
await Bun.$`mkdir -p ${outDir}`.quiet();
const table: any[] = [];
for (const id of ids) {
  const snap = JSON.stringify({ GLASSBREAK, GLASSPEN, SHARDS, GLASS });
  const r = await runScene(id, secs); table.push(r.sum);
  await Bun.write(`${outDir}/${tag}.${id}.json`, JSON.stringify(r));
  const back = JSON.parse(snap); for (const k of Object.keys(back)) deepAssign(TABLES[k], back[k], k);
  const s = r.sum; const m = s.marks;
  if (!QUIET) console.log(`${id.padEnd(26)} pane ${String(s.pane).padStart(3)} · open ${(s.open * 100).toFixed(0).padStart(3)} %${s.gone ? ' GONE' : s.run ? ' run' : ''}${s.walk ? ' walk' : ''} · first hole ${m.firstOpen ?? '—'} s · half ${m.half ?? '—'} · walk ${m.walk ?? '—'} · settled ${s.settled} s · crossed ${s.crossed}/${s.rounds} (e ${s.eOutMean ?? '—'}, ${s.byHole} by hole)${s.left ? ` · left ${s.left} pieces ${s.leftArea} m² (${s.leftBlocking} in the way)` : ''} · frags ${s.fragments} plates ${s.plates} (${s.breaks} broke) born ${s.born} trimmed ${s.trimmed} peak ${s.peakLive} · sounds ${Object.entries(s.audio).map(([k, v]) => `${k}×${v}`).join(' ') || '—'} · heard ${Object.entries(s.events).map(([k, v]) => `${k}×${v}`).join(' ') || '—'}`);
}
await Bun.write(`${outDir}/${tag}.summary.json`, JSON.stringify(table, null, 1));
console.log(`\n${table.length} scenes → ${outDir}/${tag}.*.json`);
process.exit(0);
