// GLASS IN A FIGHT — the measuring instrument for rounds going BOTH ways through glass (glass-tune.ts measures one shooter and one pane; this one a defender who
// decides for himself, and two sides trading fire across a run of panes). Headless, deterministic (Math.random seeded per scene; every scripted choice is a hash),
// one JSON per scene in glass-tune.ts's shape (sum, rows, rounds, events, audio, cross, left, hu, hv, log — plus keys of its own) so the same plots read both.
//
//   GLASSFX=on bun run tools/qa/glass-fight.ts [--scene id,id | all | list] [--out DIR] [--tag f0] [--set '{"GLASSBREAK":{…},"SHARDS":{…},"GLASSPEN":{…},"GLASS":{…}}'] [--secs 8] [--quiet]
//
// Scenes:
//   shoot-<conf|lobby|side>-<carbine|nine>   ONE live defender (a hostile with the AKS-74U / a staff-side man with the 9 mm — both `spawnUnit` men so they stand where
//        they are put instead of walking a patrol route; his AI is the game's, nothing scripted) 3–5 m behind the conference partition (annealed) / a lobby frontage
//        sheet (tempered) / the manager's sidelight (laminated), Sam lit and visible 2–4 m beyond it in god mode, everybody else parked. `def` in the summary: when he
//        first noticed, went suspicious / alert, first fired, rounds, how each round met the glass, hits on Sam, and a track (state, place, clearShot) every half second.
//   fight-conf / fight-lobby   ~4 s of Sam's FN2000 in bursts of 3 every 0.5 s walked across three adjacent panes while two SCRIPTED men on the far side fire the
//        AKS-74U back through `fireWeapon` on a hashed schedule, aimed beside him. Rows are SUMMED over the panes (`open` = open area ∕ all area; `openBy` per pane).
//   stun-fight-conf            fight-conf with a stun charge detonated 1.2 m from the middle pane at t = 0.5 s first (the fight starts at 1.0 s).
// The scripted men are fixtures: Sam's rounds pass them (their side is switched to his for the length of his own fireWeapon call), and their rounds are laid
// `steady` (no dice) on hashed points.  Per side `sides.sam / sides.far`: fired · glass (crossed a sheet) · hole (through an earlier bullet hole) · open (through
// where the glass has fallen out) · spent (stopped in a pane) · none (never reached a pane: a frame, furniture).
// Three bounds per scene: the most sounds started in any 100 ms (all, and by sfx name), the most 'glass' + 'prop' hearing events in any 1 s, peak live particles
// against SHARDS.liveCap.
import { standUp, ROOT, fake } from './headless.ts';
import { CONF_PANES, LOBBY_PANES, TUNE_PANE } from './office-pane.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon, detonateStun } = await import(`${ROOT}/src/game/combat.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const { spawnUnit, clearShot, canSee } = await import(`${ROOT}/src/game/guards.ts`);
const { order } = await import(`${ROOT}/src/game/squad.ts`);
const PM = await import(`${ROOT}/src/render/particles.ts`);
const GM = await import(`${ROOT}/src/game/glass.ts`);
const GBM = await import(`${ROOT}/src/game/glassbreak.ts`);
const GPM = await import(`${ROOT}/src/game/glasspen.ts`);
const SM = await import(`${ROOT}/src/game/shards.ts`);
const { GB_STATS, GLASSBREAK } = GBM; const { SHARDS, SHARD_STATS } = SM; const { GLASSPEN, GLASSPEN_HOOKS, GLASSPEN_STATS } = GPM; const { GLASS, GLASSFX } = GM;

type Vec3 = [number, number, number];
const DT = 1 / 60;
const argv = process.argv.slice(2);
const arg = (k: string, d: string | null = null) => { const i = argv.indexOf(k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const QUIET = argv.includes('--quiet');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash01 = (n: number) => { let x = (n | 0) * 0x9E3779B1; x ^= x >>> 15; x = Math.imul(x, 0x85EBCA6B); x ^= x >>> 13; return ((x >>> 0) % 100000) / 100000; };
const r2 = (x: number) => +x.toFixed(2), r3 = (x: number) => +x.toFixed(3);
const rv = (p: number[]) => p.map(r2);

// ---- the stagings (office.json; the panes by where they stand — office-pane.ts — the ones glass-tune.ts shoots and their neighbours) ----
/** scene 1: the pane the two men face each other through, the defender's spot and Sam's (floor on both sides, nothing but the sheet between their chests) */
const SHOOT: Record<string, { pane: number; def: Vec3; sam: Vec3; what: string }> = {
  conf: { pane: CONF_PANES[0], def: [6.4, 0, 6.6], sam: [6.5, 0, 12.0], what: 'conference partition (annealed): he is in the room, Sam in the corridor' },
  lobby: { pane: LOBBY_PANES[1], def: [7.6, 0, 19.25], sam: [1.6, 0, 19.25], what: 'lobby frontage (tempered): he is in the lobby, Sam on the lot' },
  side: { pane: TUNE_PANE.laminated, def: [26.45, 0, 7.1], sam: [26.5, 0, 11.5], what: "the manager's sidelight (laminated): he is in the office, Sam in the corridor (2 m wide there: Sam is 1.5 m off the sheet)" },
};
const DEFENDERS: Record<string, { team: 'hostile' | 'guard'; weapon: string; name: string }> = {
  carbine: { team: 'hostile', weapon: 'aks74u', name: 'Tango' },
  nine: { team: 'guard', weapon: 'guard9mm', name: 'Staff' },
};
/** scenes 2–4: the panes fired across, Sam's spot, the two scripted men's */
const FIGHT: Record<string, { panes: number[]; sam: Vec3; far: [Vec3, Vec3]; stun?: boolean; what: string }> = {
  'fight-conf': { panes: CONF_PANES, sam: [7.5, 0, 12.0], far: [[6.2, 0, 6.8], [8.8, 0, 5.8]], what: 'across the conference glazing (3 annealed sheets)' },
  'fight-lobby': { panes: LOBBY_PANES, sam: [1.9, 0, 19.25], far: [[7.4, 0, 18.1], [7.8, 0, 20.5]], what: 'across the lobby frontage (3 tempered sheets), Sam on the lot' },
  'stun-fight-conf': { panes: CONF_PANES, sam: [7.5, 0, 12.0], far: [[6.2, 0, 6.8], [8.8, 0, 5.8]], stun: true, what: 'a stun charge at the middle sheet, then fight-conf' },
};
function sceneIds(): string[] { const out: string[] = []; for (const g of Object.keys(SHOOT)) for (const d of Object.keys(DEFENDERS)) out.push(`shoot-${g}-${d}`); out.push(...Object.keys(FIGHT)); return out; }
if (argv[0] === 'list' || arg('--scene') === 'list') { console.log(sceneIds().join('\n')); process.exit(0); }

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

// ---- the stand-up every scene shares (glass-tune.ts's, with the shift parked away from every pane) ----
async function stage() {
  Math.random = seeded(4242);
  const W = await standUp(); const { game, engine } = W;
  engine.particles = new PM.Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  partsOn(game); game.tune.chaos = 0.5;
  game.godMode = true; game.infiniteAmmo = true; game.aiEnabled = true;
  for (const T of [GB_STATS, SHARD_STATS, GLASSPEN_STATS]) for (const k of Object.keys(T)) (T as any)[k] = 0;
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 25 + i * 1.2]; gd.char.vel = [0, 0, 0]; gd.char.bodyYaw = gd.char.aimYaw = Math.PI / 2; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; gd.flashlight.enabled = false; gd.char.update(0); });
  for (const cv of (game.civilians ?? []) as any[]) { if (cv.civ) cv.civ.state = 'gone'; cv.heardUpTo = 1e12; }   // (the cleaner and the late worker out of the building: no scream, no report in the tallies)
  return W;
}
const chestOf = (c: any): Vec3 => [c.bones?.spine2?.[0] ?? c.pos[0], c.pos[1] + 1.25, c.bones?.spine2?.[2] ?? c.pos[2]];
const yawTo = (a: Vec3, b: Vec3) => Math.atan2(b[0] - a[0], b[2] - a[2]);
function frameOf(b: any) { const wide = b.h[0] >= b.h[2] ? 0 : 2; const cs = Math.cos(b.yaw ?? 0), sn = Math.sin(b.yaw ?? 0); const nrm: Vec3 = wide === 0 ? [sn, 0, cs] : [cs, 0, -sn]; const tan: Vec3 = wide === 0 ? [cs, 0, -sn] : [-sn, 0, cs]; return { nrm, tan, hu: wide === 0 ? b.h[0] : b.h[2], hv: b.h[1] }; }
/** where the straight line a → b goes through the sheet's rectangle (null: beside it / not across its plane) */
function throughRect(b: any, a: Vec3, c: Vec3): boolean {
  const F = frameOf(b); const d0 = v3.dot(v3.sub(a, b.c), F.nrm), d1 = v3.dot(v3.sub(c, b.c), F.nrm); if (d0 * d1 >= 0) return false;
  const s = d0 / (d0 - d1); const p = v3.lerp(a, c, s) as Vec3; const q = v3.sub(p, b.c);
  return Math.abs(v3.dot(q, F.tan)) <= F.hu && Math.abs(q[1]) <= F.hv;
}
/** the most timestamps inside any window of `w` seconds (and where it starts) */
function maxWindow(ts: number[], w: number): { n: number; at: number | null } {
  const s = [...ts].sort((a, b) => a - b); let best = 0, at: number | null = null;
  for (let i = 0, j = 0; i < s.length; i++) { while (s[i] - s[j] >= w) j++; if (i - j + 1 > best) { best = i - j + 1; at = s[j]; } }
  return { n: best, at };
}

interface Row { f: number; t: number; open: number; run: boolean; gone: boolean; walk: boolean; sites: number; energy: number; debris: number; plates: number; live: number; born: number; openBy?: number[] }
type Fate = 'glass' | 'hole' | 'open' | 'spent' | 'none';
interface Tally { fired: number; glass: number; hole: number; open: number; spent: number; none: number; panes: number; eOut: number; hitSam: number }
const tally = (): Tally => ({ fired: 0, glass: 0, hole: 0, open: 0, spent: 0, none: 0, panes: 0, eOut: 0, hitSam: 0 });

/** everything recorded the same way in every scene: the panes' rows summed, sounds, hearing events, crossings, particle births, and each round's fate */
function recorder(W: any, panes: number[]) {
  const { game, engine } = W; const gb = game.glassBreak; const P = engine.particles; const t0: number = game.time;
  const boxes = panes.map(bi => game.level.boxes[bi]); const areas = boxes.map((b: any) => { const F = frameOf(b); return 4 * F.hu * F.hv; }); const A = areas.reduce((a: number, x: number) => a + x, 0);
  const seen = new WeakSet<any>(); W.audioLog = [];
  const rows: Row[] = []; const events: any[] = []; const emits: Record<string, number> = {}; const cross: any[] = []; const rounds: any[] = []; const marks: Record<string, number> = {};
  let beyond = 0, emitPerFrameMax = 0, hits = 0, firstHit: number | null = null;
  const now = () => r3(game.time - t0);
  const prev = GLASSPEN_HOOKS.crossed;
  GLASSPEN_HOOKS.crossed = (g: any, x: any, who: number) => { prev?.(g, x, who); if (!panes.includes(x.bi)) { beyond++; return; } cross.push({ t: now(), pane: x.bi, who, eIn: r3(x.eIn), eOut: r3(x.eOut), hole: !!x.hole, turn: r2(x.turnDeg) }); };
  const mark = () => ({ cross: cross.length, spent: GLASSPEN_STATS.spent, audio: (W.audioLog as any[]).length });
  /** what became of one round, from the counters either side of it and its own flown line */
  const fate = (m: ReturnType<typeof mark>, from: Vec3, to: Vec3, side: Tally, row: any) => {
    const mine = cross.slice(m.cross); const spent = GLASSPEN_STATS.spent > m.spent;
    const hitSam = (W.audioLog as any[]).slice(m.audio).some(a => a.name === 'bodyHit' && a.gain > 0.85);
    const f: Fate = spent ? 'spent' : mine.some(x => !x.hole) ? 'glass' : mine.length ? 'hole' : boxes.some((b: any) => throughRect(b, from, to)) ? 'open' : 'none';
    side.fired++; side[f]++; side.panes += mine.length; for (const x of mine) side.eOut += x.eOut; if (hitSam) { side.hitSam++; hits++; firstHit ??= now(); }
    rounds.push({ ...row, fate: f, panes: mine.length, eOut: mine.length ? mine[mine.length - 1].eOut : null, hitSam });
    return f;
  };
  /** after W.step: the frame's births, hearing events and the panes' row; returns the new shot events (for an AI man's rounds) */
  const frame = (f: number): any[] => {
    let n = 0; for (const e of P.pending as any[]) { emits[e.kind] = (emits[e.kind] ?? 0) + e.count; n += e.count; } P.pending.length = 0; P.pendingImpulses.length = 0; emitPerFrameMax = Math.max(emitPerFrameMax, n);
    const shots: any[] = [];
    for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind === 'step') continue; events.push({ t: r3(e.time - t0), kind: e.kind, level: e.level ?? null, who: e.who ?? null }); if (e.kind === 'guardShot' || e.kind === 'shot') shots.push(e); }
    const infos = panes.map(bi => gb.paneInfo(bi)!); const open = infos.reduce((a: number, x: any, i: number) => a + x.openFraction * areas[i], 0) / A;
    const row: Row = { f, t: now(), open: +open.toFixed(4), run: infos.some((x: any) => x.run), gone: infos.every((x: any) => x.gone), walk: infos.some((x: any) => x.walkable), sites: infos.reduce((a: number, x: any) => a + x.sites, 0), energy: r2(infos.reduce((a: number, x: any) => a + x.energy, 0)), debris: game.destr.debris.list.length, plates: game.shards.plateCount ?? 0, live: game.shards.live ?? 0, born: SHARD_STATS.born };
    if (panes.length > 1) row.openBy = infos.map((x: any) => +x.openFraction.toFixed(3));
    rows.push(row);
    if (row.run && marks.run == null) marks.run = row.t; if (row.gone && marks.gone == null) marks.gone = row.t; if (row.walk && marks.walk == null) marks.walk = row.t;
    if (row.open > 0 && marks.firstOpen == null) marks.firstOpen = row.t; if (row.open >= 0.5 && marks.half == null) marks.half = row.t;
    return shots;
  };
  const finish = (id: string, extra: Record<string, unknown>) => {
    GLASSPEN_HOOKS.crossed = prev;
    const NOT_GLASS = /^(footstep|heldProtest|propScrape|propThud|click|magDrop|earRing)$/;   // (the staging's own noise, as glass-tune.ts leaves it out)
    const audio = (W.audioLog as any[]).map(a => ({ t: r3(a.t - t0), name: a.name, gain: r3(a.gain), rate: r3(Number(a.opts?.rate ?? 1)), d: a.pos ? r2(v3.dist(a.pos, game.player.char.pos)) : 0 })).filter(a => !NOT_GLASS.test(a.name));
    W.audioLog = null;
    // the group's own frame: u along the first pane's tangent from the middle of the run, so several sheets' pieces plot side by side
    const F0 = frameOf(boxes[0]); const us = boxes.map((b: any) => v3.dot(b.c, F0.tan)); const lo = Math.min(...us.map((u: number, i: number) => u - frameOf(boxes[i]).hu)), hi = Math.max(...us.map((u: number, i: number) => u + frameOf(boxes[i]).hu)); const mid = (lo + hi) / 2;
    const left: any[] = []; const log: any[] = []; const types: string[] = [];
    panes.forEach((bi, i) => {
      const b = boxes[i]; types.push(gb.typeOfPane(bi) ?? '?'); const stP = (gb as any).panes?.get?.(bi); if (!stP) return;
      for (const l of stP.log ?? []) log.push(panes.length > 1 ? (typeof l === 'string' ? `[${bi}] ${l}` : { pane: bi, ...l }) : l);
      if (stP.type !== 'annealed' || !stP.sites?.length || typeof (gb as any).heldSet !== 'function' || typeof (gb as any).fragsOf !== 'function') return;
      const held: Set<number> = (gb as any).heldSet(stP); const du = us[i] - mid;
      for (const f of (gb as any).fragsOf(stP)) if (!stP.open[f.fid]) left.push({ pane: bi, fid: f.fid, band: f.b, area: +f.area.toFixed(4), vMin: r2(f.vMin + b.c[1]), tooth: f.area < GLASSBREAK.toothArea && f.frame.bottom + f.frame.left + f.frame.right + f.frame.top > 1e-4, held: held.has(f.fid), pts: f.pts.map((q: number[]) => [r3(q[0] + du), r3(q[1])]) });
    });
    const by = <T,>(xs: T[], key: (x: T) => string) => { const m: Record<string, number> = {}; for (const x of xs) m[key(x)] = (m[key(x)] ?? 0) + 1; return m; };
    const last = rows[rows.length - 1];
    const settled = (() => { let t = 0; for (let i = 1; i < rows.length; i++) if (rows[i].open !== rows[i - 1].open) t = rows[i].t; return t; })();
    // the three bounds
    const names = [...new Set(audio.map(a => a.name))].sort(); const w100 = maxWindow(audio.map(a => a.t), 0.1);
    const byName100: Record<string, number> = {}; for (const n of names) byName100[n] = maxWindow(audio.filter(a => a.name === n).map(a => a.t), 0.1).n;
    const heard = maxWindow(events.filter(e => e.kind === 'glass' || e.kind === 'prop').map(e => e.t), 1);
    const bounds = { sounds100ms: w100.n, sounds100msAt: w100.at, sounds100msByName: byName100, heard1s: heard.n, heard1sAt: heard.at, peakLive: SHARD_STATS.peakLive, liveCap: SHARDS.liveCap };
    const hu = (hi - lo) / 2, hv = Math.max(...boxes.map((b: any) => frameOf(b).hv));
    const sum = {
      id, pane: panes[0], panes, type: types[0], types, gun: '', rounds: rounds.length, size: [r2(2 * hu), r2(2 * hv)],
      open: last.open, openBy: last.openBy ?? [last.open], run: last.run, gone: last.gone, walk: last.walk, sites: last.sites, energy: last.energy, marks, settled,
      crossed: cross.length, beyond, left: left.length, leftBlocking: left.filter(f => !f.tooth && f.vMin < GLASSBREAK.walkClearH).length, leftArea: +left.reduce((a, f) => a + f.area, 0).toFixed(3), eOutMean: cross.length ? r3(cross.reduce((a, x) => a + x.eOut, 0) / cross.length) : null, byHole: cross.filter(x => x.hole).length,
      fragments: SHARD_STATS.fragments, plates: SHARD_STATS.plates, platesRefused: SHARD_STATS.platesRefused, breaks: SHARD_STATS.breaks, born: SHARD_STATS.born, trimmed: SHARD_STATS.trimmed, peakLive: SHARD_STATS.peakLive, peakPlates: SHARD_STATS.peakPlates,
      peakDebris: rows.reduce((a, r) => Math.max(a, r.debris), 0), emitPerFrameMax, emits, audio: by(audio, a => a.name), events: by(events, e => e.kind), glassEvents: events.filter(e => e.kind === 'glass').length,
      hitsOnSam: hits, firstHitOnSam: firstHit, bounds, pen: { ...GLASSPEN_STATS }, gb: { ...GB_STATS }, set: SET, ...extra,
    };
    return { sum, rows, rounds, events, audio, cross, left, hu, hv, log };
  };
  return { t0, now, mark, fate, frame, finish, cross };
}
const perSide = (s: Tally) => ({ fired: s.fired, glass: s.glass, hole: s.hole, open: s.open, spent: s.spent, none: s.none, panes: s.panes, eOutMean: s.panes ? r3(s.eOut / s.panes) : null, hitSam: s.hitSam });

// ---- scene 1: a defender who decides for himself ----
async function runShoot(id: string, secs: number) {
  const [, gk, dk] = id.split('-'); const S = SHOOT[gk], D = DEFENDERS[dk]; if (!S || !D) throw new Error(`unknown scene ${id}`);
  const W = await stage(); const { game } = W; const b = game.level.boxes[S.pane];
  game.playerInvisible = false; game.teleportPlayer(S.sam); const pc = game.player.char; pc.bodyYaw = pc.aimYaw = yawTo(S.sam, S.def); game.player.slot = 'pistol'; game.player.holstered = false; game.player.crouch = false; game.player.visibility = 0.85;
  const gd: any = spawnUnit(game, { team: D.team, pos: S.def, yaw: yawTo(S.def, S.sam), weapon: D.weapon as any, name: D.name, light: false });
  gd.hold = false; gd.pinned = false; gd.wait = 1e6;   // (spawnUnit stands a unit held for its choreographer: this one is his own man — a sentry WAITING at his one-point post, so he stands facing the glass and scans as any man at a waypoint does, instead of turning to walk a route he has not got)
  W.step(DT); W.step(DT); game.player.visibility = 0.85;
  const sight0 = !game.col.segmentBlocked(chestOf(gd.char), chestOf(pc)), solid0 = game.col.solidBlocked(chestOf(gd.char), chestOf(pc)), shot0 = !!clearShot(game, gd.char, chestOf(pc));
  const R = recorder(W, [S.pane]); const side = tally(); const track: any[] = []; const when: Record<string, number> = {}; const who = gd.char.id; const home: Vec3 = v3.copy(gd.char.pos); let peakAw = 0, far = 0;
  const frames = Math.round(secs * 60);
  for (let f = 0; f < frames; f++) {
    game.player.visibility = 0.85;   // (the light meter is the harness's knob: Sam stands lit)
    const m = R.mark(); W.step(DT);
    const shots = R.frame(f).filter((e: any) => e.kind === 'guardShot' && e.who === who);
    for (const e of shots) { R.fate(m, e.from, e.to, side, { k: side.fired, t: R.now(), who, from: rv(e.from), to: rv(e.to) }); when.firstShot ??= R.now(); }
    const t = R.now(); peakAw = Math.max(peakAw, gd.awareness); far = Math.max(far, v3.dist(gd.char.pos, home));
    if (gd.state !== 'dead' && canSee(game, gd).visible) when.inView ??= t; if (gd.awareness >= 0.3) when.noticed ??= t; if (gd.state === 'suspicious') when.suspicious ??= t; if (gd.state === 'alert') when.alert ??= t; if (gd.state === 'search') when.search ??= t; if (gd.state === 'dead') when.down ??= t;
    if (when.moved == null && v3.dist(gd.char.pos, home) > 0.6) when.moved = t;
    { const F = frameOf(b); const d = v3.dot(v3.sub(gd.char.pos, b.c), F.nrm), d0 = v3.dot(v3.sub(home, b.c), F.nrm); if (when.sameSideAsSam == null && d * d0 < 0) when.sameSideAsSam = t; }
    if (f % 30 === 0) track.push({ t, state: gd.state, aw: r2(gd.awareness), pos: rv(gd.char.pos), toSam: r2(v3.dist(gd.char.pos, pc.pos)), sees: !game.col.segmentBlocked(chestOf(gd.char), chestOf(pc)), clearShot: gd.state === 'dead' ? null : !!clearShot(game, gd.char, chestOf(pc)), drawn: !!gd.drawn, bubble: gd.bubble?.text ?? gd.bubble ?? null });
  }
  const what = side.fired === 0 ? (far > 1.5 ? 'never fired · moved off' : peakAw > 0.3 ? 'never fired · stood and watched' : 'never fired · never noticed')
    : side.glass + side.hole + side.open > 0 ? 'fired through the glass' : side.spent > 0 ? 'fired INTO the glass (rounds spent in it)' : 'fired, never at the pane';
  const def = { gun: D.weapon, team: D.team, id: who, at: rv(home), sam: rv(pc.pos), paneDist: [r2(Math.abs(v3.dot(v3.sub(home, b.c), frameOf(b).nrm))), r2(Math.abs(v3.dot(v3.sub(pc.pos, b.c), frameOf(b).nrm)))],
    start: { sees: sight0, solidBetween: solid0, clearShot: shot0 }, when, peakAwareness: r2(peakAw), ...perSide(side), did: what, endState: gd.state, endPos: rv(gd.char.pos), farthest: r2(far), track };
  const out = R.finish(id, { def, sides: { far: perSide(side) }, what: S.what });
  out.sum.gun = D.weapon;
  return out;
}

// ---- scenes 2–4: two sides trading fire across a run of panes ----
async function runFight(id: string, secs: number) {
  const S = FIGHT[id]; if (!S) throw new Error(`unknown scene ${id}`);
  const W = await stage(); const { game } = W; const boxes = S.panes.map(bi => game.level.boxes[bi]); const midB = boxes[boxes.length >> 1]; const F = frameOf(midB);
  const sideOfSam = Math.sign(v3.dot(v3.sub(S.sam, midB.c), F.nrm)) || 1; const out: Vec3 = v3.scale(F.nrm, sideOfSam) as Vec3;   // (the pane's normal on Sam's side)
  game.playerInvisible = true; game.player.visibility = 0.02; game.teleportPlayer(S.sam); const pc = game.player.char; pc.bodyYaw = pc.aimYaw = Math.atan2(-out[0], -out[2]); game.player.slot = 'rifle'; game.player.holstered = false; game.player.crouch = false;
  const men: any[] = S.far.map((p, i) => { const gd: any = spawnUnit(game, { team: 'hostile', pos: p, yaw: yawTo(p, S.sam), weapon: 'aks74u' as any, name: `Far${i + 1}`, light: false }); gd.pinned = true; gd.heardUpTo = 1e12; order(gd, { goal: null, aimAt: [S.sam[0], 1.3, S.sam[2]], hot: true }); return gd; });
  W.step(DT); W.step(DT);
  const R = recorder(W, S.panes); const sam = tally(), farT = tally();
  // the run of panes along the tangent, for Sam's walk
  const us = boxes.map((b: any) => v3.dot(v3.sub(b.c, midB.c), F.tan)); const lo = Math.min(...us.map((u: number, i: number) => u - frameOf(boxes[i]).hu)) + 0.25, hi = Math.max(...us.map((u: number, i: number) => u + frameOf(boxes[i]).hu)) - 0.25;
  const start = S.stun ? 1.0 : 0.2; const BURSTS = 8;
  // Sam: bursts of three, one burst every half second, the group walked from one end of the glazing to the other; chest height on the far side
  const samPlan: { t: number; p: Vec3 }[] = [];
  for (let k = 0; k < BURSTS; k++) for (let j = 0; j < 3; j++) { const n = k * 3 + j; const u = lo + (hi - lo) * k / (BURSTS - 1) + (hash01(n * 7 + 1) - 0.5) * 0.14; const y = 1.3 + (hash01(n * 7 + 2) - 0.5) * 0.5; samPlan.push({ t: start + k * 0.5 + j * 0.1, p: [midB.c[0] + F.tan[0] * u - out[0] * 0.5, y, midB.c[2] + F.tan[2] * u - out[2] * 0.5] }); }
  // the far men: bursts of two or three at a tenth apart on a hashed timetable, laid on a point 0.6–1.1 m to one side of Sam at his own depth (never at him; the round flies on past)
  const farPlan: { t: number; i: number; p: Vec3 }[] = [];
  men.forEach((gd, i) => { let t = start + 0.15 + i * 0.27 + hash01(900 + i) * 0.2; for (let k = 0; t < start + 4; k++) { const n = 2 + (hash01(i * 131 + k * 17 + 3) < 0.5 ? 0 : 1); const sgn = hash01(i * 131 + k * 17 + 5) < 0.5 ? -1 : 1; for (let j = 0; j < n; j++) { const off = sgn * (0.6 + hash01(i * 977 + k * 31 + j * 7) * 0.5); const y = 1.0 + hash01(i * 977 + k * 31 + j * 7 + 1) * 0.6; farPlan.push({ t: t + j * 0.1, i, p: [S.sam[0] + F.tan[0] * off, y, S.sam[2] + F.tan[2] * off] }); } t += 0.55 + hash01(i * 131 + k * 17 + 9) * 0.35; } });
  farPlan.sort((a, b) => a.t - b.t || a.i - b.i);
  const homes = men.map(gd => v3.copy(gd.char.pos) as Vec3); let si = 0, fi = 0, drift = 0; let stunAt: Vec3 | null = null;
  const frames = Math.round(secs * 60);
  for (let f = 0; f < frames; f++) {
    const t = game.time - R.t0;
    if (S.stun && !stunAt && t >= 0.5) { stunAt = v3.mad([midB.c[0], 0.4, midB.c[2]], out, 1.2) as Vec3; detonateStun(game, { kind: 'flash', pos: stunAt, vel: [0, 0, 0], age: 1, fuse: 0, fired: true, who: 0 } as any); }
    while (si < samPlan.length && t >= samPlan[si].t) {
      const q = samPlan[si]; const m = R.mark(); const teams = men.map(gd => gd.team); men.forEach(gd => { gd.team = 'operative'; });   // (the fixtures are not targets: his rounds fly past them)
      fireWeapon(game, pc, q.p, true, { weapon: (WEAPONS as any).fn2000 }); men.forEach((gd, i) => { gd.team = teams[i]; });
      const e = game.events[game.events.length - 1]; R.fate(m, e?.from ?? pc.muzzle, e?.to ?? q.p, sam, { k: si, t: r3(t), who: 'sam', aim: rv(q.p) });
      const fa = game.player.firearm; if (fa) { fa.chamber = 1; fa.mag = Math.max(fa.mag ?? 0, 5); fa.cool = 0; }
      si++;
    }
    while (fi < farPlan.length && t >= farPlan[fi].t) {
      const q = farPlan[fi]; const gd = men[q.i]; const m = R.mark();
      if (gd.state !== 'dead') { fireWeapon(game, gd.char, q.p, false, { weapon: (WEAPONS as any).aks74u, steady: true }); const e = game.events[game.events.length - 1]; R.fate(m, e?.from ?? gd.char.muzzle, e?.to ?? q.p, farT, { k: fi, t: r3(t), who: gd.callsign ?? `far${q.i + 1}`, aim: rv(q.p) }); }
      fi++;
    }
    W.step(DT); R.frame(f);
    men.forEach((gd, i) => { drift = Math.max(drift, v3.dist(gd.char.pos, homes[i])); });
  }
  const res = R.finish(id, { sides: { sam: perSide(sam), far: perSide(farT) }, stun: stunAt ? rv(stunAt) : null, fixtures: { at: homes.map(rv), drift: r2(drift), down: men.filter(gd => gd.state === 'dead').length }, sam: rv(pc.pos), what: S.what });
  res.sum.gun = 'fn2000 ⇄ aks74u';
  return res;
}

const want = (arg('--scene', 'all') as string); const ids = want === 'all' ? sceneIds() : want.split(',');
const outDir = arg('--out', `${process.env.TMPDIR ?? '/tmp'}/glass-fight`) as string; const tag = arg('--tag', 'run') as string; const secsArg = arg('--secs');
await Bun.$`mkdir -p ${outDir}`.quiet();
const table: any[] = [];
const fmtSide = (n: string, s: any) => `${n} ${s.fired}: glass ${s.glass} hole ${s.hole} open ${s.open} spent ${s.spent} none ${s.none}${s.eOutMean != null ? ` (e ${s.eOutMean})` : ''}`;
for (const id of ids) {
  const snap = JSON.stringify({ GLASSFX, GLASSBREAK, GLASSPEN, SHARDS, GLASS });
  const shoot = id.startsWith('shoot-'); const secs = Number(secsArg ?? (shoot ? 12 : 8));
  const r = shoot ? await runShoot(id, secs) : await runFight(id, secs); table.push(r.sum);
  await Bun.write(`${outDir}/${tag}.${id}.json`, JSON.stringify(r));
  const back = JSON.parse(snap); for (const k of Object.keys(back)) deepAssign(TABLES[k], back[k], k);
  if (QUIET) continue;
  const s: any = r.sum; const m = s.marks; const B = s.bounds;
  console.log(`${id.padEnd(20)} pane${s.panes.length > 1 ? 's' : ''} ${s.panes.join('+')} (${s.types[0]}) · open ${(s.open * 100).toFixed(0).padStart(3)} %${s.panes.length > 1 ? ` [${s.openBy.map((x: number) => (x * 100).toFixed(0)).join(' ')}]` : ''}${s.gone ? ' GONE' : s.run ? ' run' : ''}${s.walk ? ' walk' : ''} · first hole ${m.firstOpen ?? '—'} s · half ${m.half ?? '—'} · walk ${m.walk ?? '—'} · settled ${s.settled} s · ${Object.entries(s.sides).map(([k, v]) => fmtSide(k, v)).join(' | ')} · hits on Sam ${s.hitsOnSam}${s.left ? ` · left ${s.left} pieces ${s.leftArea} m² (${s.leftBlocking} in the way)` : ''} · frags ${s.fragments} plates ${s.plates} (${s.breaks} broke) debris ≤ ${s.peakDebris} born ${s.born} trimmed ${s.trimmed}`);
  if (s.def) { const d = s.def, w = d.when; console.log(`    ${d.gun} · ${d.did} · start: sees ${d.start.sees} clearShot ${d.start.clearShot} · in view ${w.inView ?? '—'} s · noticed ${w.noticed ?? '—'} s · suspicious ${w.suspicious ?? '—'} · alert ${w.alert ?? '—'} · first shot ${w.firstShot ?? '—'} · first hit ${s.firstHitOnSam ?? '—'} · moved ${w.moved ?? '—'} · round the glass ${w.sameSideAsSam ?? '—'} · search ${w.search ?? '—'} · end ${d.endState} at (${d.endPos[0]}, ${d.endPos[2]}), ${d.farthest} m from his spot at most`); }
  console.log(`    bounds: sounds in 100 ms ≤ ${B.sounds100ms}${B.sounds100msAt != null ? ` (at ${B.sounds100msAt} s)` : ''} [${Object.entries(B.sounds100msByName).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}] · glass+prop heard in 1 s ≤ ${B.heard1s} · live particles ≤ ${B.peakLive} of ${B.liveCap} · sounds ${Object.entries(s.audio).map(([k, v]) => `${k}×${v}`).join(' ') || '—'} · heard ${Object.entries(s.events).map(([k, v]) => `${k}×${v}`).join(' ') || '—'}`);
}
await Bun.write(`${outDir}/${tag}.summary.json`, JSON.stringify(table, null, 1));
console.log(`\n${table.length} scenes → ${outDir}/${tag}.*.json`);
process.exit(0);
