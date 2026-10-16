// VAULT-RUN: the counting house (levels/vault.json ← tools/levels/vault.ts) played by a scripted player, INPUT ONLY (keys, the cursor, clicks — the lesson
// runner's hands, tools/qa/lesson-run.ts), the light meter fed from the floor's lights as that tool feeds it. The plans, over the same seeds:
//   round   works the devices and touches no man: the OCP on the gate's lens, the dark north strip on a knee under its beam, the OCP on the court's beam,
//           the back door picked, the ledger, out by the east gate with the OCP on its lens
//   code    the other answer to the keypad: the clerk taken from behind where he smokes, asked for the code, put out; the front door, the OCP on the
//           counting room's lens, the code typed, the ledger, out by the west gate
//   pan     `round` with no OCP on a gate's lens: the walk through its picture begun at the moment of its sweep that leaves the least of him in it,
//           and out by the gate he came in by (it stands open)
//   shoot   `round` with a round from the suppressed pistol through each lens and emitter where `round` uses the OCP: it breaks them, and it is heard
//   short   the SAME walk as `round` (the long way round to the back door, NOT the straight line to the front door) by a player just as careful of the
//           men who ignores the devices: no OCP, upright through the beam
//   mains   the breaker played: in by the gate with the OCP on its lens (no way to the breaker misses a gate), to the breaker beside the guard shack,
//           thrown by hand, then `round`'s walk with the mains' devices left to the breaker: no OCP on the court's beam nor on the lens on the way out
// Every plan waits for the men the same way (`clear`: nobody with a line to the next stretch — any man within 22 m of lit floor, 6 m of dark floor).
//   no-gate · no-strip · no-court · no-exit   `round` with ONE device left unanswered (which device bites, and how hard)
//   bun run tools/qa/vault-run.ts [--plan round|code|pan|short|shoot|mains|all|each|<plan>,<plan>]   (all = round, code, pan, short, mains; each = the four no-…) [--seeds 1-24] [--delay 0,15,30] [--deal N] [--jobs 2] [--json out.json] [--trace] [--moon] [--cap secs] [--verbose]
//   an unknown flag or plan exits 2 with the valid ones listed (a mistyped --moon must not hand back the kinder numbers)
//   --delay = seconds the player stands at his start before he moves (the men's rounds are the same on every run of a deal: this shifts him against them)
//   --moon = the moon counted on the player's meter as the page's meter counts it (the headless estimate leaves directional lights out)
//   TPS_PROFILE=shipped in front = the page's stand (what the mission's numbers are quoted on).
// WHAT IS HELD (exit 0 / 1; the summary's head line says it again):
//   round                     EXPECTED CLEAN: every run out with the ledger, no device tripped, nobody roused, the floor never raised, not seen, no wait given up
//   short · no-…              EXPECTED TO FAIL: every run trips a device (no-…: the one it left unanswered)
//   shoot                     EXPECTED TO FAIL: every run broke a device with a round and was noticed for it (a man roused, or the player seen)
//   code · pan · mains        COUNTED, NOT HELD: their numbers are printed (the page quotes them) and never make the exit red
// VAULT_BREAK=1 = the check's own red path: `round` leaves the gate's lens unanswered, so a run of it must come back red.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp } from './headless';
import type { Vec3 } from '../../src/math/vec';
import { VAULT } from '../levels/vault';

const ROOT = resolve(import.meta.dir, '../..'), DT = 1 / 60;
const argv = process.argv.slice(2), has = (f: string) => argv.includes(f), flag = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const at = (p: ArrayLike<number>) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
function seeded(a: number) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
type Plan = 'round' | 'code' | 'short' | 'shoot' | 'pan' | 'mains' | 'no-gate' | 'no-strip' | 'no-court' | 'no-exit';
interface Dev { gate: boolean; strip: boolean; court: boolean; exit: boolean }
const BREAK = process.env.VAULT_BREAK === '1';
const DEV = (p: Plan): Dev => ({ gate: p !== 'short' && p !== 'no-gate' && !(BREAK && p === 'round'), strip: p !== 'short' && p !== 'no-strip', court: p !== 'short' && p !== 'no-court' && p !== 'mains', exit: p !== 'short' && p !== 'no-exit' && p !== 'mains' });
export interface VaultRun {
  plan: Plan; seed: number; delay: number; deal: string; start: string; patrol: number; ok: boolean; why: string; secs: number; stage: string; down: boolean;
  /** device log rows by what happened (suspicion · alarm · trip · dead · code · overheard · deny) */
  devices: Record<string, number>; tripped: string[];
  /** men who left 'patrol' for alert / search, or went suspicious on their own senses, at any point (not: the clerk in the player's own hands, nor a man
   *  SENT on an errand — the game's own look at an emptied holder that is wired, game/takecheck.ts (this safe is not, since 10-12: with the rule on nobody is sent), or a lens's call, which is counted under `tripped`) */
  roused: string[]; alert: string[];
  /** waits the script gave up on and walked on anyway (a look that never came clear, a pan with no moment): a run with one is not counted clean */
  forced: number;
  /** plan `mains`: seconds the mains were out (−1 = the breaker was never thrown) */
  dark: number; escalation: number; seen: number; alarms: number; bodies: number; kos: number; summary: string; lines: string[];
}

async function one(plan: Plan, seed: number, deal: number | null, trace: boolean, delay = 0): Promise<VaultRun> {
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { lightEstimateAt, escalationOf, rollcallState } = await import(`${ROOT}/src/game/guards.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const { sweepYaw } = await import(`${ROOT}/src/game/devices.ts`);
  const { debriefOf } = await import(`${ROOT}/src/game/chronicle.ts`);
  const log = console.log, err = console.error, warn = console.warn;
  const hush = () => { if (!has('--verbose')) console.log = console.error = console.warn = () => { }; }, unhush = () => { console.log = log; console.error = err; console.warn = warn; };
  const lines: string[] = [];
  const out: VaultRun = { plan, seed, delay, deal: '', start: '', patrol: -1, ok: false, why: '', secs: 0, stage: '', down: false, devices: {}, tripped: [], roused: [], alert: [], forced: 0, dark: -1, escalation: 0, seen: 0, alarms: 0, bodies: 0, kos: 0, summary: '', lines };
  Math.random = seeded(0x9137 + seed * 7919);
  hush();
  let W: any;
  try { W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels/vault.json'), 'utf8'))), seed }); } finally { unhush(); }
  const g = W.game, I = W.input, cam = W.cam;
  if (deal === null) (await import(`${ROOT}/src/game/samestart.ts`)).SAMESTART.on = false;   // (this tool walks the level's DEALS by seed: with every mission starting the same — on in the page — an unpinned start is deal 0 on every seed. --deal N plays one deal under the switch as the page has it)
  hush(); const started = startFromQuery(g, `?levelFile=vault.json&quiet${deal === null ? '' : `=${deal}`}`); unhush();
  if (!started.spec || started.why) return { ...out, why: `the mission did not start: ${started.why ?? 'no scenario'}` };
  out.deal = g.quiet.summary(); out.patrol = g.quiet.deal.patrol; out.start = g.level.scenarios.quiet.starts[g.quiet.deal.start].name;

  let t = 0, goal: number[] | null = null, sprint = false, peakEsc = 0;
  const held = new Set<string>(), was = new Map<any, string>(), roused = new Set<string>(), alert = new Set<string>();
  let mine: any = null;   // the man in the player's own hands (his states are the grab's, not a sighting)
  const say = (s: string) => { lines.push(`${t.toFixed(1).padStart(6)}  ${s}`); if (trace) log(lines[lines.length - 1]); };
  class Stop extends Error { }
  const eyeOf = (c: any): Vec3 => c.bones?.head ?? [c.pos[0], c.pos[1] + 1.6, c.pos[2]], chestOf = (c: any): Vec3 => c.bones?.chest ?? [c.pos[0], c.pos[1] + 1.2, c.pos[2]];
  const pos = (): number[] => g.player.char.pos;
  const own = (id: number) => id === PLAYER_ID;
  // --moon: the moonlight the headless estimate leaves out (lightEstimateAt skips directional lights; the page's meter counts them), by pair-sneak.ts's rule:
  // wherever the sky the moon's way is open, colour × intensity × the best of the meter's six normals. On the player's meter and in this player's own reading of the floor.
  const MOON = has('--moon');
  const moonAt = (P: number[]): number => { let E = 0; if (MOON) for (const l of g.engine.lights.lights) { if (l.kind !== 2 || !l.enabled || l.intensity <= 0 || l.transient || l.ttl >= 0) continue;
    if (!g.col.segmentBlocked(P as any, [P[0] - l.dir[0] * 60, P[1] - l.dir[1] * 60, P[2] - l.dir[2] * 60] as any)) E += (0.2126 * l.color[0] + 0.7152 * l.color[1] + 0.0722 * l.color[2]) * l.intensity * Math.max(Math.abs(l.dir[0]), Math.abs(l.dir[1]), Math.abs(l.dir[2])); } return E; };
  const meter = (P: number[]) => lightEstimateAt(g, P, own) + moonAt(P);
  const cap = Number(flag('--cap') ?? 1300);
  function step(n = 1) {
    for (let i = 0; i < n; i++) {
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k);
      const P = g.player;
      if (goal && !P.down) { const dx = goal[0] - pos()[0], dz = goal[2] - pos()[2], d = Math.hypot(dx, dz);
        if (d > 0.1) { const { fwd, right } = cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827; if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); } }
      if (sprint && goal) I.keys.add('ShiftLeft'); else if (!held.has('ShiftLeft')) I.keys.delete('ShiftLeft');
      for (const k of held) I.keys.add(k);
      { const c = P.char; P.visibility = g.visibilityOf(Math.max(meter(chestOf(c)), meter(eyeOf(c)))); }
      W.step(DT); t += DT;
      peakEsc = Math.max(peakEsc, escalationOf(g)); if (g.blackout.active) out.dark = Math.max(0, out.dark) + DT;
      for (const x of g.guards) { const st = x.state, w = was.get(x); if (w !== st) { was.set(x, st);
        if (w !== undefined) { say(`   ${x.callsign ?? 'a man'}: ${w} → ${st} at ${at(x.char.pos)} (player at ${at(pos())}, lit ${g.player.visibility.toFixed(2)})`);
          if (x !== mine && (st === 'alert' || st === 'search' || (st === 'suspicious' && !x.task))) roused.add(x.callsign); else if (st === 'suspicious' && x.task) say(`   (${x.callsign} is SENT to look: ${x.task.kind ?? 'an errand'})`); if (x !== mine && (st === 'alert' || st === 'search')) alert.add(x.callsign); } } }
      // a man SENT on an errand who then hears or glimpses the player turns to where that was and stays 'suspicious' (guards.ts: his fix is no longer his errand's place): roused, with no state change to see it by
      for (const x of g.guards) if (x !== mine && x.state === 'suspicious' && x.task && x.awareness >= 0.45 && x.lastKnown && Math.hypot(x.lastKnown[0] - x.task.pos[0], x.lastKnown[2] - x.task.pos[2]) > 0.5 && !roused.has(x.callsign)) {
        roused.add(x.callsign); say(`   ${x.callsign}: off his errand (${x.task.kind}) toward ${at(x.lastKnown)} (player at ${at(pos())})`); }
      if (g.player.down) throw new Stop(`the player went down at ${at(pos())} (stage ${g.mission.stage})`);
      if (t >= cap) throw new Stop(`time cap (${cap} s) at ${at(pos())}, stage ${g.mission.stage}`);
    }
  }
  const until = (pred: () => boolean, secs: number): boolean => { for (let i = 0; i < secs * 60 && !pred(); i++) step(); return pred(); };
  const aim = (p: number[]) => { W.cursorAt([p[0], p[1], p[2]]); };
  const door = (nm: string) => g.doors.byName(nm);
  const free = (p: number[]): number[] => { const nav = g.col.nav; const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : [p[0], 0, p[2]]; };
  const doorOnPath = (path: number[][]): any | null => { let a = pos(); for (const b of path) { let best: any = null, bk = 2;
      for (const d of g.doors.list) { if (!d.isClosed()) continue; const H = d.def.hinge, th = d.def.closedDir, w = d.def.width + 0.15, hx = H[0] - Math.cos(th) * 0.15, hz = H[1] - Math.sin(th) * 0.15, ux = Math.cos(th) * (w + 0.15), uz = Math.sin(th) * (w + 0.15);
        const rx = b[0] - a[0], rz = b[2] - a[2], den = rx * uz - rz * ux; if (Math.abs(den) < 1e-9) continue;
        const k = ((hx - a[0]) * uz - (hz - a[2]) * ux) / den, m = ((hx - a[0]) * rz - (hz - a[2]) * rx) / den; if (k >= 0 && k <= 1 && m >= 0 && m <= 1 && k < bk) { bk = k; best = d; } }
      if (best) return best; a = b; } return null; };
  function verb(kind: string, v: string, aimAt?: number[], quiet = false): boolean {
    for (let i = 0; i < 60; i++) { if (aimAt) aim(aimAt); step();
      if (g.nearby.some((r: any) => r.kind === kind && r.verb === v) && g.selectVerb(kind, v)) { I.pressed.add('Space'); step(2); say(`  Space: ${kind} ▸ ${v}`); return true; } }
    if (!quiet) say(`  no '${kind} ▸ ${v}' row (rows: ${g.nearby.map((r: any) => `${r.kind}:${r.verb}`).join(' ') || 'none'})`); return false;
  }
  function openDoor(nm: string, v = 'ease'): boolean {
    const d = door(nm); if (!d.isClosed()) return true;
    const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), s = (pos()[0] - c[0]) * nx + (pos()[2] - c[2]) * nz >= 0 ? 1 : -1;
    walk(free([c[0] + nx * s * 0.95, 0, c[2] + nz * s * 0.95]), 25, { stop: () => !d.isClosed(), noDoors: true }); if (!d.isClosed()) return true;
    if (!verb('door', v, [c[0], 1.0, c[2]], true) && !verb('door', 'push', [c[0], 1.0, c[2]])) return false;
    until(() => !d.isClosed(), 6); step(20); return !d.isClosed();
  }
  function walk(p: number[], max: number, w: { stop?: () => boolean; sprint?: boolean; near?: number; noDoors?: boolean } = {}, again = 0): boolean {
    const path: number[][] = g.col.nav.findPath(pos(), p, 8000) ?? [p]; if (!path.length || flat(path[path.length - 1], p) > 0.05) path.push(p);
    if (!w.noDoors) { const d = doorOnPath(path); if (d && flat(pos(), d.frameCentre) < 40) { const ok = openDoor(d.def.name); if (!ok) { say(`  door ${d.def.name} would not open`); return false; } return walk(p, max, w, again); } }
    const t0 = t; let mark = [...pos()], markT = t; sprint = !!w.sprint;
    try {
      for (const wp of path) { goal = [wp[0], 0, wp[2]];
        while (flat(pos(), wp) > (wp === path[path.length - 1] ? (w.near ?? 0.3) : 0.55)) {
          aim([wp[0], 1.1, wp[2]]); step(); if (t - t0 > max) return false; if (w.stop && w.stop()) return false;
          if (flat(pos(), mark) > 0.15) { mark = [...pos()]; markT = t; } else if (t - markT > 1.5) {
            if (again >= 5) { say(`  stuck at ${at(pos())} short of ${at(wp)}`); return false; }
            const dx = wp[0] - pos()[0], dz = wp[2] - pos()[2], Ln = Math.hypot(dx, dz) || 1, sd = again % 2 ? -1 : 1, r = 0.9 + 0.25 * again;
            goal = [pos()[0] + dz / Ln * sd * r, 0, pos()[2] - dx / Ln * sd * r]; step(35);
            return walk(p, max - (t - t0), w, again + 1); } } }
      return true;
    } finally { goal = null; sprint = false; }
  }
  const go = (x: number, z: number, w: Parameters<typeof walk>[2] = {}) => { if (!walk(free([x, 0, z]), 60, w) && !w.stop) throw new Stop(`could not walk to (${x}, ${z}) from ${at(pos())}`); };
  const press = (code: string, after = 1) => { I.pressed.add(code); step(1 + after); };
  const crouch = (on: boolean) => { for (let i = 0; i < 3 && !!g.player.crouch !== on; i++) { I.pressed.add('KeyC'); step(4); } };

  // ---- the men: who has a line to a stretch of floor the player is about to cross ----
  const litMemo = new Map<string, number>(); let litT = -1;   // (the lookahead asks the same few points for every man and every half second of his walk: once a point a frame)
  const litAt = (p: number[]): number => { if (litT !== t) { litMemo.clear(); litT = t; } const k = `${p[0]},${p[2]}`; const m = litMemo.get(k); if (m !== undefined) return m; const v: number = g.visibilityOf(Math.max(meter([p[0], 1.2, p[2]]), meter([p[0], 1.6, p[2]]))); litMemo.set(k, v); return v; };
  /** a calm man standing out a wait on his beat looks the way he stands (his head turns some): a place well behind his shoulders, more than a couple of
   *  strides off, is not in his line — what a player watching him from the gate reads off his back */
  const backTo = (gd: any, p: number[]): boolean => { if (gd.state !== 'patrol' || gd.task || !(gd.wait > 0.5)) return false;
    const f = gd.char.forward(), dx = p[0] - gd.char.pos[0], dz = p[2] - gd.char.pos[2], L = Math.hypot(dx, dz) || 1; return L > 2.5 && (f[0] * dx + f[2] * dz) / L < -0.35; };
  const watchers = (pts: number[][], skip: any = null): any[] => g.guards.filter((gd: any) => gd.state !== 'dead' && gd !== skip && pts.some(p => {
    const d = flat(gd.char.pos, p); if (d > (litAt(p) > 0.12 ? 22 : 6) || backTo(gd, p)) return false;
    return !g.col.segmentBlocked(eyeOf(gd.char), [p[0], 1.2, p[2]]); }));
  /** where a man will be over the next T seconds, every half second: along the path he is on, then (a calm man) round his own route with its waits.
   *  What a player gets by watching a patrol go round once; nothing the men do off their routes is foreseen */
  function ahead(gd: any, T: number): number[][] {
    const calm = gd.state === 'patrol' && !gd.task, R = gd.route, n = R?.points?.length ?? 0, v = calm ? 1.7 : 2.4, spots: number[][] = [];
    let x = gd.char.pos[0], z = gd.char.pos[2], wp = gd.wp, wait = calm ? Math.max(0, gd.wait) : 0, guard = 0;
    const legs: number[][] = (gd.path ?? []).slice(gd.pathI ?? 0).map((q: number[]) => [q[0], q[2]]);
    const next = () => legs.push([R.points[wp][0], R.points[wp][2]]);
    if (calm && n > 1 && wait <= 0 && !legs.length) next();
    for (let s = 0; s <= T + 1e-6; s += 0.5) { spots.push([x, z]); let d = v * 0.5;
      while (d > 1e-6 && guard++ < 400) {
        if (wait > 0) { const w = Math.min(wait, d / v); wait -= w; d -= w * v; if (wait > 0) break; wp = (wp + 1) % n; next(); continue; }
        if (!legs.length) { if (!calm || n < 2) break; wait = R.wait[wp] ?? 0; if (wait <= 0) { wp = (wp + 1) % n; next(); } continue; }
        const L = legs[0], dd = Math.hypot(L[0] - x, L[1] - z);
        if (dd <= d) { x = L[0]; z = L[1]; d -= dd; legs.shift(); } else { x += (L[0] - x) / dd * d; z += (L[1] - z) / dd * d; d = 0; } } }
    return spots;
  }
  const watchersAhead = (pts: number[][], T: number, skip: any = null): any[] => T <= 0 ? watchers(pts, skip) : g.guards.filter((gd: any) => gd.state !== 'dead' && gd !== skip &&
    ahead(gd, T).some(([x, z], k) => pts.some(p => !(k * 0.5 < gd.wait - 0.5 && backTo(gd, p)) && Math.hypot(x - p[0], z - p[2]) <= (litAt(p) > 0.12 ? 22 : 6) && !g.col.segmentBlocked([x, 1.6, z], [p[0], 1.2, p[2]]))));
  /** wait until nobody has a line to any of `pts`, now or (T > 0) in the next T seconds of his walk, for half a second running (≤ secs) */
  function clear(what: string, pts: number[][], secs = 240, skip: any = null, T = 0, look = false): boolean {
    const who = () => watchersAhead(pts, T, skip);
    if (trace) say(`  [men: ${g.guards.map((x: any) => `${x.callsign} ${x.route?.name} ${at(x.char.pos)} ${x.state} wp${x.wp}`).join(' · ')}] watchers of ${what}: ${who().map((x: any) => x.callsign).join(', ') || 'none'}`);
    const t0 = t; let calm = 0;
    while (t - t0 < secs) { step(6); calm = who().length ? 0 : calm + 0.1; if (calm >= 0.5) { if (t - t0 > 1) say(`  waited ${(t - t0).toFixed(0)} s for a clear ${what}`); return true; } }
    if (look) return false;   // (a LOOK: the caller takes another way when it is not clear, nothing is walked into)
    say(`  no clear ${what} in ${secs} s (${who().map((x: any) => x.callsign).join(', ')} has a line) — going anyway`); out.forced++; return false;
  }
  const target = (nm: string) => g.targets.find((x: any) => x.name === nm);
  const isOut = (nm: string) => { const x = target(nm); if (!x) throw new Stop(`no light target named ${nm} on this level`); return x.broken || x.factor <= 0.05; };
  /** the OCP on a device: pistol up, the charge waited for, the right button on it */
  function ocp(nm: string, p: number[]): boolean {
    if (!g.player.pistolUp) press('Digit1', 24);
    if (plan === 'shoot') {   // the other answer to a lens or an emitter: a round from the suppressed pistol (it stays out, and it is a shot on the card)
      if (isOut(nm)) return true;
      for (let k = 0; k < 3; k++) { for (let i = 0; i < 50; i++) { aim(p); step(); } I.clicked |= 1; step(12); if (isOut(nm)) { say(`  a round: ${nm} is out`); return true; } }
      say(`  three rounds did not take ${nm}`); return false; }
    for (let k = 0; k < 3; k++) { until(() => g.player.ocp.ready(), 6); aim(p); step(); aim(p); I.clicked |= 4; step(8); if (isOut(nm)) { say(`  OCP: ${nm} is out`); return true; } }
    say(`  the OCP did not take ${nm} (target ${target(nm) ? 'there' : 'missing'}, aim ${g.aimTarget?.name ?? 'nothing'})`); return false;
  }
  const C = VAULT;
  const W_IN = [[8.8, 0, 13.8], [9.2, 0, 11.4], [9.4, 0, 9.2]], E_IN = [[31.3, 0, 13.8], [30.0, 0, 12.6], [28.7, 0, 11.7]], MOUTH_N = [[25.15, 0, 9.3], [25.15, 0, 11.55], [27.1, 0, 11.7], [27.25, 0, 12.6], [26.2, 0, 13.3]];
  const take = () => {
    go(C.safeFront[0], C.safeFront[2] + 0.5, { near: 0.25 });
    if (!verb('objective', 'drive', C.safeFront)) throw new Stop(`no row at the safe (stage ${g.mission.stage})`);
    if (!until(() => g.mission.stage === 'exfil', 20)) throw new Stop(`the ledger was not taken (stage ${g.mission.stage})`);
    say('  the ledger is his');
  };
  const leave = (gate: 'gate_w' | 'gate_e') => { const x = gate === 'gate_w' ? 5.9 : 34.1; go(x, door(gate).frameCentre[2], { stop: () => g.mission.stage === 'done' }); if (!until(() => g.mission.stage === 'done', 6)) throw new Stop(`out of the gate and the run did not end (stage ${g.mission.stage})`); };

  /** the long way round: gate, north strip, kitchen court, back door. `dev` = the devices are answered (false = the same walk, the devices ignored) */
  // THE LENS ANSWERED BY ITS OWN PAN (plan `pan`): what a walk through its picture begun `start` seconds from now would put on its integrator — the
  // lens's own arithmetic (devices.ts updateCamera / lensGain: the cone about its yaw and pitch, its reach, the light on him, half a lit-second a second
  // draining once he is out of it) run ahead over the sweep — and the walk begun at the first moment that leaves him under BAR of it. KEEP IN STEP with
  // devices.ts updateCamera / lensGain and guards.ts eyeContact (whose cone test dots the look's flat part as it is: × cos pitch); an upright man, clear air
  function lensAhead(c: any, path: number[][], v: number, start: number): number {
    const d = c.def, per = Math.max(0.5, d.sweepPeriod ?? 8), half = (d.fovDeg ?? 60) / 2 * Math.PI / 180, range = d.range ?? 6, pitch = d.pitch ?? -0.3, H = 0.05;
    let seen = c.seen, peak = seen, leg = 0, x = path[0][0], z = path[0][2];
    for (let s = 0; s < start + 30; s += H) {
      if (s >= start) { let dd = v * H; while (dd > 1e-9 && leg < path.length - 1) { const q = path[leg + 1], L = Math.hypot(q[0] - x, q[2] - z);
        if (L <= dd) { x = q[0]; z = q[2]; dd -= L; leg++; } else { x += (q[0] - x) / L * dd; z += (q[2] - z) / L * dd; dd = 0; } } }
      const yaw = sweepYaw(d, (c.phase + s / per) % 1), dx = x - d.pos[0], dy = 1.15 - d.pos[1], dz = z - d.pos[2], dist = Math.hypot(dx, dy, dz), hl = Math.hypot(dx, dz) || 1e-4;
      const inPic = dist < range && (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / hl * Math.cos(pitch) > Math.cos(half) && Math.abs(Math.asin(dy / dist) - pitch) < half
        && !(g.col.segmentBlocked(d.pos, [x, 1.15, z]) && g.col.segmentBlocked(d.pos, [x, 1.6, z]));
      const gain = inPic ? Math.pow(litAt([x, 0, z]), 1.5) * Math.min(1, Math.max(0.2, 1 - (dist - 3) / Math.max(1, range - 3))) : 0;
      seen = gain > 0.02 ? seen + gain * H : Math.max(0, seen - 0.5 * H); if (seen > peak) peak = seen;
      if (leg >= path.length - 1 && s > start && seen <= 0) break; }
    return peak;
  }
  /** would a man have a line to him on that walk: his place each half second of it against where each man will be then (`ahead`), by `watchers`' own reach */
  function menOnWalk(path: number[][], v: number, start: number): boolean {
    let L = 0; for (let i = 1; i < path.length; i++) L += flat(path[i - 1], path[i]);
    const T = start + L / v + 1, at2 = (s: number): number[] => { let d = Math.max(0, s - start) * v; for (let i = 1; i < path.length; i++) { const l = flat(path[i - 1], path[i]); if (d <= l) { const k = l > 0 ? d / l : 0; return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k, 0, path[i - 1][2] + (path[i][2] - path[i - 1][2]) * k]; } d -= l; } return path[path.length - 1]; };
    for (const gd of g.guards) { if (gd.state === 'dead') continue; const sp = ahead(gd, T);
      for (let k = 0; k < sp.length; k++) { const s = k * 0.5; if (s < start - 0.5) continue; const p = at2(s), [x, z] = sp[k];
        if (s < gd.wait - 0.5 && backTo(gd, p)) continue;
        if (Math.hypot(x - p[0], z - p[2]) <= (litAt(p) > 0.12 ? 22 : 6) && !g.col.segmentBlocked([x, 1.6, z], [p[0], 1.2, p[2]])) return true; } }
    return false;
  }
  function pan(nm: string, path: number[][], sprinting = true) {
    if (['gate_w', 'gate_e'].some(nm => g.doors.hasCloser(door(nm)))) throw new Stop('plan pan runs through the gate he left open: it needs doors that stay where they are left (TPS_PROFILE=shipped)');
    const c = g.devices.cameras.find((x: any) => x.def.name === nm), v = sprinting ? 4.2 : 1.45, t0 = t, BAR = 0.45;
    for (;;) { let best = -1, e = 0, least = Infinity, men = 0;
      for (let s = 0; s <= 9.01 && best < 0; s += 0.25) { e = lensAhead(c, path, v, s); least = Math.min(least, e); if (e >= BAR) continue; if (menOnWalk(path, v, s)) { men++; continue; } best = s; }
      if (best >= 0 && best < 0.26) { say(`  the pan of ${nm}: going (waited ${(t - t0).toFixed(1)} s; ${e.toFixed(2)} lit-seconds foreseen, ${g.tune.cameraSuspicionSecs} calls him in)`); break; }
      if (t - t0 > 300) { say(`  the pan of ${nm}: no moment in 300 s (least ${least.toFixed(2)} lit-seconds; a man in the way of ${men} of them) — going anyway`); out.forced++; break; }
      step(Math.round((best < 0 ? 0.5 : Math.min(best - 0.2, 0.5)) * 60)); }
    for (const q of path.slice(1)) go(q[0], q[2], { sprint: sprinting, noDoors: true, near: 0.35 });
    say(`  through ${nm}'s picture: ${c.seen.toFixed(2)} lit-seconds on it, state ${c.state}`);
  }
  /** the gate is open and somebody has, or is about to have, a line to the ground inside it: not waited out standing in the gateway (moonlit, and in the
   *  line of everything in the yard) but beside it, outside the wall, and back when the way will stay empty for the walk */
  function aside(what: string, pts: number[][], side: number[], back: number[]) {
    if (!watchersAhead(pts, 9).length) return;
    go(side[0], side[1]); clear(what, pts, 240, null, 9); go(back[0], back[1]);
  }
  /** plan `mains`: from just inside the gate to the breaker on the guard shack's east wall and back, by the lit lane between house and shack (west) or the
   *  lit south side (east). One wait, at the gate, for the whole walk; the breaker by hand (the row, Space); then back the way he came */
  const breakerWay = (west: boolean): number[][] => { const B = g.level.breaker.pos, stand = free([B[0] + 0.7, 0, B[2]]);
    return west ? [[9.4, 0, 15.8], [10.6, 0, 17.8], [13.2, 0, 18.15], [17.9, 0, 18.3], [18.6, 0, 19.6], stand] : [[30.4, 0, 17.4], [28.8, 0, 20.5], [23.0, 0, 21.0], [19.6, 0, 21.0], stand]; };
  function breaker(west: boolean) {
    const B = g.level.breaker.pos, way = breakerWay(west);
    for (const q of way) go(q[0], q[2], { near: 0.3 });
    if (!verb('breaker', 'breakerOff', [B[0], B[1], B[2]])) throw new Stop('no row at the breaker');
    if (!until(() => g.blackout.active, 6)) throw new Stop('the breaker was not thrown');
    step(60);   // (the beacon spins up 0.8 s after the trip)
    say(`  the mains are out: lit ${litAt([18.0, 0, 7.6]).toFixed(2)} on the north strip, ${litAt([18.3, 0, 13.2]).toFixed(2)} at the strongroom door, ${litAt([31.3, 0, 13.8]).toFixed(2)} inside the east gate, ${litAt([9.0, 0, 13.8]).toFixed(2)} inside the west gate; lenses alive: ${g.devices.cameras.filter((c: any) => !isOut(c.def.name)).map((c: any) => c.def.name).join(', ') || 'none'}`);
    for (const q of [...way].reverse().slice(1)) go(q[0], q[2], { near: 0.3 });
    say(`  back from the breaker: the mains are ${g.blackout.active ? 'still out' : 'back on'} (${Math.max(0, out.dark).toFixed(0)} s dark so far)`);
    const lens = west ? 'cam_yard' : 'cam_east'; if (!isOut(lens)) ocp(lens, west ? C.camYard : C.camEast);   // back through the gate lens's picture: the mains came back, so the OCP again
  }
  function round(dev: Dev) {
    const west = pos()[0] < 20, PAN = plan === 'pan', MAINS = plan === 'mains';
    press('Digit1', 24);
    if (west) {
      go(7.05, 14.0); clear('west yard', W_IN, 240, null, 8); if (!openDoor('gate_w')) throw new Stop('the west gate would not open');
      if (PAN) { go(7.1, 15.4); clear('west yard', W_IN, 240, null, 10); pan('cam_yard', [[7.1, 0, 15.4], [7.45, 0, 14.3], [9.25, 0, 14.3], [9.5, 0, 8.7]]); }
      else { if (MAINS) { go(7.1, 15.4); clear('way to the breaker', [...W_IN, ...breakerWay(true)], 240, null, 14); go(7.05, 14.0); } else aside('west yard', W_IN, [7.1, 15.4], [7.05, 14.0]); if (dev.gate) ocp('cam_yard', C.camYard); go(8.9, 13.2); if (MAINS) { breaker(true); go(8.9, 13.2); } go(9.3, 9.4); }
      go(12.4, 8.0); go(16.0, 7.6);
      if (dev.strip) crouch(true); go(19.6, 7.6); crouch(false);
      go(24.9, 7.9);   // the end of the house's shadow (dark with the moon counted too): look before the corner
      clear('way to the court', MOUTH_N, 240, null, 7); go(25.15, 9.3); go(25.15, 11.55); go(27.1, 11.7);
    } else {
      go(32.95, 14.0); clear('east yard', E_IN, 240, null, 8); if (!openDoor('gate_e')) throw new Stop('the east gate would not open');
      if (PAN) { go(32.9, 15.4); clear('east yard', E_IN, 240, null, 10); pan('cam_east', [[32.9, 0, 15.4], [32.55, 0, 14.0], [31.3, 0, 13.7], [28.7, 0, 11.6]]); }
      else { if (MAINS) { go(32.9, 15.4); clear('way to the breaker', [...E_IN, ...breakerWay(false)], 240, null, 14); go(32.95, 14.0); } else aside('east yard', E_IN, [32.9, 15.4], [32.95, 14.0]); if (dev.gate) ocp('cam_east', C.camEast); go(31.3, 13.7); if (MAINS) { breaker(false); go(31.3, 13.7); } go(28.7, 11.6); }
    }
    go(C.mouth[0], C.mouth[2] + 0.05, { near: 0.2 });
    if (dev.court) ocp('beam_court', C.courtBox);
    const back = door('back'), bz = back.frameCentre[2];
    go(25.4, bz); go(24.85, bz, { noDoors: true, near: 0.25 });
    if (back.locked) { if (!verb('door', 'pick', [24.06, 1.0, bz])) throw new Stop('no pick row at the back door'); if (!until(() => !back.locked, 12)) throw new Stop('the back door did not pick'); say('  the back door is picked'); }
    take();
    go(23.2, bz); go(25.3, bz);   // out of the back door, still in the house's shadow
    clear('the court to its mouth', [[26.4, 0, 14.1], [C.mouth[0], 0, 12.6], [C.mouth[0], 0, 12.1]], 30, null, 4);   // the court's east half is moonlit and its mouth gives on the east yard
    if (dev.court) ocp('beam_court', C.courtBox);   // after the look, not before it: the emitter is dark for seconds, and a wait spends them
    go(C.mouth[0], 12.1, { near: 0.25 });
    // the walk to the gate wants the east yard empty (until 10-12 the game sent a man to look at the safe seven seconds after every take; this safe is not
    // wired, so with game/takecheck.ts's rule on nobody is sent and the men are simply on their beats): if it will not stay empty,
    // out of the court and along the dark north side of the house until it will
    const OUT = [...E_IN, [28.9, 0, 11.5]];
    if (!clear('east yard', OUT, 1.2, null, 9, true)) {
      go(27.1, 11.7); go(25.15, 11.55); go(25.15, 9.3); go(24.9, 7.9); go(20.6, 7.5); say('  waiting on the dark north side');
      clear('east yard', [...OUT, [27.1, 0, 11.7], [25.15, 0, 9.3]], 300, null, 13); go(24.9, 7.9); go(25.15, 9.3); go(25.15, 11.55); go(27.1, 11.7);
    }
    if (PAN && west) {   // out by the gate he left open: back along the north side, under the strip's beam, and through the west lens's picture on its pan
      go(27.1, 11.7); go(25.15, 11.55); go(25.15, 9.3); go(24.9, 7.9); go(19.6, 7.6); crouch(true); go(16.0, 7.6); crouch(false); go(14.6, 7.7);   // still in the house's shadow
      pan('cam_yard', [[14.6, 0, 7.7], [12.4, 0, 8.0], [9.5, 0, 8.7], [9.25, 0, 14.3], [7.45, 0, 14.3], [6.3, 0, 14.25]]); leave('gate_w'); return; }
    go(28.9, 11.5);
    if (PAN) { pan('cam_east', [[28.9, 0, 11.5], [31.3, 0, 13.7], [32.55, 0, 14.0], [33.7, 0, 14.0]]); leave('gate_e'); return; }
    if (dev.exit) ocp('cam_east', C.camEast);
    go(31.3, 14.0); leave('gate_e');
  }

  /** the code from the clerk: taken where he smokes, asked, put out; in by the front door past the room's lens */
  function code() {
    const west = pos()[0] < 20, clerk = g.guards.find((x: any) => /^counting/.test(x.route?.name ?? '')) ?? g.guards[0];
    const spot = out.patrol === 1 ? C.smokeB : C.smokeA, north = spot[2] < 14;
    // either start: round the outside of the wall to the west gate, and wait there with the gate shut
    if (!west) { go(35.2, 22.7); go(5.0, 22.7); }
    go(6.7, 14.0);
    // wait where he is: the clerk standing at his corner, his back this way, nobody else with a line to it
    const here = () => flat(clerk.char.pos, spot) < 0.9 && clerk.state === 'patrol';
    // …and nobody else near enough to hear it: every other man 12 m off, or 7 m with something solid between, and not on his way here
    const far = new Map<any, number>();
    const others = () => g.guards.every((x: any) => { if (x === clerk || x.state === 'dead') return true; const d = flat(x.char.pos, spot), was = far.get(x) ?? d; far.set(x, d);
      return d >= (litAt(spot) > 0.12 ? 22 : 18) || (d >= was - 0.01 && (g.col.segmentBlocked(eyeOf(x.char), [spot[0], 1.2, spot[2]]) ? d >= 7 : d >= (litAt(spot) > 0.12 ? 22 : 12))); });
    // …and the net's radio check just gone by (it is heard on the strip, every minute and a half): a man put out is missed at the next one
    const R = rollcallState(g); let checks = R.checks, checkT = -1e9;
    const t0 = t; let set = 0;
    while (t - t0 < 700) { step(6); if (R.checks !== checks && R.stage === 'idle') { checks = R.checks; checkT = t; }
      set = here() && others() && t - checkT <= 30 ? set + 0.1 : 0; if (set >= 1.0) break; }
    if (set < 1.0) throw new Stop(`the clerk was never alone at his corner inside 30 s of a radio check in 700 s (he is at ${at(clerk.char.pos)}, ${clerk.state})`);
    say(`  the clerk is alone at his corner (waited ${(t - t0).toFixed(0)} s)`);
    const lens = () => { press('Digit1', 24); ocp('cam_yard', C.camYard); press('KeyE', 24); };   // …and the pistol away again: a grab needs empty hands
    if (!openDoor('gate_w')) throw new Stop('the west gate would not open');
    lens(); go(8.7, north ? 12.6 : 15.4);
    crouch(true);
    // close on his back: the last metres on a knee, to a stride behind him
    mine = clerk;
    for (let k = 0; k < 40 && !g.player.holding; k++) {
      const c = clerk.char, f = c.forward(), bx = c.pos[0] - f[0] * 0.75, bz = c.pos[2] - f[2] * 0.75;
      if (flat(pos(), [bx, 0, bz]) > 0.3) walk(free([bx, 0, bz]), 1.2, { noDoors: true, near: 0.25 });
      if (flat(pos(), c.pos) < 1.15 && verb('guard', 'grab', [c.pos[0], 1.35, c.pos[2]], true)) break;
      if (clerk.state !== 'patrol' && !g.player.holding) throw new Stop(`the clerk turned (${clerk.state}) before the grab`);
    }
    if (!until(() => g.player.holding?.phase === 'held', 5)) throw new Stop('the grab did not take');
    crouch(false);
    for (let k = 0; k < 8 && !g.player.codes.has('pad_strongroom'); k++) { verb('held', 'question'); until(() => g.player.codes.has('pad_strongroom'), 7); }
    if (!g.player.codes.has('pad_strongroom')) throw new Stop('held and asked, he did not give the code');
    say('  he gave the code');
    verb('held', 'choke'); if (!until(() => !g.player.holding, 14)) throw new Stop('the choke did not end');
    step(30);
    // the front door. From the north along the house wall, where the lens over the door does not look; from the south a motorbike is parked in that lane,
    // so the OCP first and across the porch
    const fz = door('front').frameCentre[2];
    if (north) { clear('the house wall to the door', [[12.15, 0, 10.2], [12.3, 0, fz]], 25, null, 6); go(12.15, 10.2); }
    else { clear('the west yard to the door', [[9.2, 0, 18.4], [9.8, 0, 17.2], [10.5, 0, 15.8], [11.3, 0, 14.4], [12.3, 0, fz]], 25, null, 7); go(9.8, 17.2); lens(); go(11.3, 14.4); }
    go(12.3, fz, { noDoors: true, near: 0.25 });
    if (!openDoor('front')) throw new Stop('the front door would not open');
    go(13.55, fz, { near: 0.2 });
    ocp('cam_room', C.camRoom);
    go(18.3, fz, { noDoors: true, near: 0.25 });
    const vault = door('strongroom');
    if (vault.locked) { if (!verb('door', 'code', C.pad)) throw new Stop('no code row at the strongroom door'); if (!until(() => !vault.locked || !vault.isClosed(), 8)) throw new Stop('the code did not open the lock'); say('  the code is in'); }
    take();
    go(19.6, fz); ocp('cam_room', C.camRoom);
    go(13.6, fz);   // inside the open front door: look before stepping out under the porch lamp
    clear('west yard', [[12.3, 0, fz], [11.5, 0, 13.4], [9.5, 0, 13.9], [8.6, 0, 14]], 240, null, 8);
    go(12.3, fz, { near: 0.25 });
    press('Digit1', 24); ocp('cam_yard', C.camYard);
    go(8.7, 14.0); leave('gate_w');
  }

  try { step(20 + Math.round(delay * 60)); if (plan === 'code') code(); else round(DEV(plan)); out.ok = g.mission.stage === 'done'; }
  catch (e) { unhush(); out.why = e instanceof Stop ? e.message : `threw: ${(e as Error).stack ?? e}`; say(`!! ${out.why}`); }
  if (trace) { const { fmtEvent } = await import(`${ROOT}/src/game/chronicle.ts`); for (const e of g.chronicle.events) log(`   chron ${e.t.toFixed(1).padStart(6)} ${e.kind} ${fmtEvent(e)}`); for (const r of g.devices.log) log(`   device ${JSON.stringify(r)}`); }
  out.secs = Number(t.toFixed(1)); out.stage = g.mission.stage; out.down = !!g.player.down;
  for (const r of g.devices.log as { device: string; what: string }[]) { out.devices[r.what] = (out.devices[r.what] ?? 0) + 1; if (r.what === 'trip' || r.what === 'suspicion' || r.what === 'alarm') out.tripped.push(`${r.device}:${r.what}`); }
  out.roused = [...roused]; out.alert = [...alert]; out.escalation = peakEsc;
  const D = debriefOf(g); out.seen = D.counts.seen; out.alarms = D.counts.alarms; out.bodies = D.counts.bodies; out.kos = D.counts.kos; out.summary = D.summary.replace(/^twopointsix — /, '');
  return out;
}

/** probe `vault` (tools/qa/probes.ts, family `missions`): on the page's stand, moon counted, one run of each of the four deals, each stood by its PIN (so the
 *  probe holds whatever an unpinned start deals) — the devices plan is clean on every one AND the same walk with the devices ignored is clean on none.
 *  VAULT_BREAK=1 (the red path) reaches the runs through the environment. */
const VAULT_PINS = [7, 0, 3, 2];   // `quiet-pin.ts vault --all`: west track · set A, west · B, east · A, east · B (the smallest pin of each)
export async function vaultCheck(): Promise<boolean> {
  let txt = '', errTxt = '', code = 0; const tails: string[] = [];   // (a red check prints every pin's last lines, not only the last pin's)
  for (const pin of VAULT_PINS) { const pr = Bun.spawn(['bun', 'run', import.meta.path, '--plan', 'round,short', '--seeds', '1', '--deal', String(pin), '--moon', '--jobs', '2'], { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, TPS_PROFILE: 'shipped' } });
    const out = await new Response(pr.stdout).text(); txt += out; tails.push(out.trim().split('\n').slice(-9).join('\n')); errTxt += await new Response(pr.stderr).text(); code = Math.max(code, Math.abs(await pr.exited)); }
  const row = (p: string) => { const R = [...txt.matchAll(new RegExp(`^${p}\\s+(\\d+) runs over \\d+ deal.*clean \\(all of those\\) (\\d+)`, 'gm'))], sum = (k: number) => R.reduce((s, m) => s + Number(m[k]), 0);
    const deals = new Set([...txt.matchAll(new RegExp(`^${p}\\s+seed\\s+\\d+.*? · (\\w+ track · set \\w) · `, 'gm'))].map(m => m[1])).size;
    return R.length === VAULT_PINS.length ? ['', sum(1), deals, sum(2)] : null; };
  const r = row('round'), s = row('short'); let ok = code === 0;
  const line = (pass: boolean, what: string) => { console.log(`  ${pass ? 'PASS' : 'FAIL'}  vault: ${what}`); ok = ok && pass; };
  if (!r || !s) { console.log(txt.trim().split('\n').slice(-6).join('\n')); if (errTxt.trim()) console.log(errTxt.trim().split('\n').slice(-4).join('\n')); line(false, `the runs gave no summary (exit ${code})`); return false; }
  line(Number(r[2]) === 4 && Number(s[2]) === 4, `four pins are the level's four deals (round ${r[2]}, short ${s[2]})`);
  line(Number(r[3]) === Number(r[1]), `the devices plan is clean on every deal (${r[3]} of ${r[1]}: out with the ledger, no device tripped, nobody roused, the floor never raised)`);
  line(Number(s[3]) === 0, `the same walk with the devices ignored is clean on none (${s[3]} of ${s[1]})`);
  line(code === 0, `vault-run's own verdict (exit ${code})`);
  if (!ok) console.log(tails.join('\n'));
  return ok;
}

const cell = (r: VaultRun) => `${r.plan.padEnd(8)} seed ${String(r.seed).padStart(2)}${r.delay ? ` +${r.delay} s` : ''} · ${r.start.replace('the ', '')} · set ${r.patrol === 1 ? 'B' : 'A'} · ${r.ok ? 'OUT with the ledger' : `NOT out (${r.stage}${r.down ? ', down' : ''})`} · ${r.secs.toFixed(0)} s · devices ${r.tripped.length ? r.tripped.join(' ') : 'none tripped'} · roused ${r.roused.length ? r.roused.join(', ') : 'nobody'} · floor ${r.escalation}${r.forced ? ` · gave up ${r.forced} wait(s)` : ''} · ${r.summary}${r.why ? ` · ${r.why}` : ''}`;

if (import.meta.main) {
  { const VAL = ['--plan', '--seeds', '--seed', '--delay', '--deal', '--jobs', '--json', '--cap'], BARE = ['--trace', '--moon', '--one', '--verbose'], odd: string[] = [];
    for (let i = 0; i < argv.length; i++) { if (VAL.includes(argv[i])) i++; else if (!BARE.includes(argv[i])) odd.push(argv[i]); }
    if (odd.length) { console.error(`vault-run: unknown argument ${odd.join(' ')} (flags: ${[...VAL.map(f => `${f} <value>`), ...BARE].join(' · ')})`); process.exit(2); } }
  const plans = ((p) => p === 'all' ? ['round', 'code', 'pan', 'short', 'mains'] : p === 'each' ? ['no-gate', 'no-strip', 'no-court', 'no-exit'] : p.split(','))(flag('--plan') ?? 'all') as Plan[];
  { const KNOWN = ['round', 'code', 'pan', 'short', 'shoot', 'mains', 'no-gate', 'no-strip', 'no-court', 'no-exit'], odd = plans.filter(p => !KNOWN.includes(p)); if (odd.length) { console.error(`vault-run: no plan named ${odd.join(', ')} (plans: ${KNOWN.join(' · ')} · all · each)`); process.exit(2); } }
  const seeds = ((s: string) => { const m = /^(\d+)-(\d+)$/.exec(s); return m ? Array.from({ length: Number(m[2]) - Number(m[1]) + 1 }, (_, i) => Number(m[1]) + i) : s.split(',').map(Number); })(flag('--seeds') ?? flag('--seed') ?? '1-24');
  const delays = (flag('--delay') ?? '0').split(',').map(Number);
  const deal = flag('--deal') === undefined ? null : Number(flag('--deal'));
  if (has('--one')) { const r = await one(plans[0], seeds[0], deal, has('--trace'), delays[0]); process.stdout.write(`\n@@VAULT ${JSON.stringify(r)}\n`); process.exit(0); }
  const jobs = Math.max(1, Number(flag('--jobs') ?? 2)), todo = plans.flatMap(p => seeds.flatMap(s => delays.map(d => ({ p, s, d })))), runs: VaultRun[] = [];
  const worker = async () => { for (;;) { const j = todo.shift(); if (!j) return;
    const pr = Bun.spawn(['bun', 'run', import.meta.path, '--one', '--plan', j.p, '--seed', String(j.s), '--delay', String(j.d), ...(deal === null ? [] : ['--deal', String(deal)]), ...(has('--trace') ? ['--trace'] : []), ...(has('--moon') ? ['--moon'] : []), ...(has('--verbose') ? ['--verbose'] : []), ...(flag('--cap') ? ['--cap', flag('--cap')!] : [])], { stdout: 'pipe', stderr: 'pipe', env: process.env });
    const txt = await new Response(pr.stdout).text(), errTxt = await new Response(pr.stderr).text(); await pr.exited;
    const m = /@@VAULT (.*)/.exec(txt);
    const r: VaultRun = m ? JSON.parse(m[1]) : { plan: j.p, seed: j.s, delay: j.d, deal: '', start: '?', patrol: -1, ok: false, why: `the run died: ${(errTxt || txt).trim().split('\n').slice(-3).join(' | ')}`, secs: 0, stage: '?', down: false, devices: {}, tripped: [], roused: [], alert: [], forced: 0, dark: -1, escalation: 0, seen: 0, alarms: 0, bodies: 0, kos: 0, summary: '', lines: [] };
    if (has('--trace')) console.log(txt.replace(/\n@@VAULT .*\n?/, ''));
    runs.push(r); console.log(cell(r)); } };
  await Promise.all(Array.from({ length: jobs }, worker));
  runs.sort((a, b) => plans.indexOf(a.plan) - plans.indexOf(b.plan) || a.seed - b.seed || a.delay - b.delay);
  console.log(`\n=== vault-run · ${process.env.TPS_PROFILE === 'shipped' ? 'the shipped stand' : 'the frozen stand'} · seeds ${seeds[0]}‥${seeds[seeds.length - 1]} ===`);
  console.log('held: round = every run clean · short, no-… = a device bites every run · shoot = a device broken by a round and noticed every run · code, pan, mains = counted, not held');
  let bad = 0;
  const clean = (r: VaultRun) => r.ok && !r.tripped.length && r.seen === 0 && r.escalation === 0 && !r.forced && !r.roused.length;
  const bit = (r: VaultRun, dev: RegExp) => r.tripped.some(x => dev.test(x));
  for (const p of plans) { const R = runs.filter(r => r.plan === p), n = R.length, cnt = (f: (r: VaultRun) => boolean) => R.filter(f).length;
    const deals = new Set(R.map(r => `${r.start}/${r.patrol}`)).size;
    console.log(`${p.padEnd(8)} ${n} runs over ${deals} deal(s): out with the ledger ${cnt(r => r.ok)} · no device tripped ${cnt(r => !r.tripped.length)} · nobody roused ${cnt(r => !r.roused.length)} · floor never raised ${cnt(r => r.escalation === 0)} · seen 0 ${cnt(r => r.seen === 0)} · no wait given up ${cnt(r => !r.forced)} · clean (all of those) ${cnt(clean)} · player down ${cnt(r => r.down)} · mean ${(R.reduce((s, r) => s + r.secs, 0) / Math.max(1, n)).toFixed(0)} s${p === 'mains' ? ` · breaker thrown ${cnt(r => r.dark >= 0)}, the mains out ${(R.filter(r => r.dark >= 0).reduce((s, r) => s + r.dark, 0) / Math.max(1, cnt(r => r.dark >= 0))).toFixed(0)} s a run` : ''}`);
    if (p === 'shoot') bad += cnt(r => !((r.devices.dead ?? 0) > 0 && (r.roused.length > 0 || r.seen > 0)));   // a round through a lens is HEARD: red if one ever went unnoticed (the page says it does not), and red on a run that ended (down, or died) with no device broken by a round and nobody having noticed
    else if (p === 'round') bad += cnt(r => !clean(r));
    else if (p === 'code' || p === 'pan' || p === 'mains') { /* counted, not held */ }
    else if (p === 'short') bad += cnt(r => !r.tripped.length);
    else if (p === 'no-strip') bad += cnt(r => r.start.includes('west') ? !bit(r, /^beam_strip:/) : !clean(r));   // (the strip's beam is on the west start's way only: from the east gate `no-strip` is `round`, and held to its rule)
    else bad += cnt(r => !bit(r, p === 'no-court' ? /^beam_court:/ : p === 'no-exit' ? /^cam_east:/ : r.start.includes('west') ? /^cam_yard:/ : /^cam_east:/)); }   // the device left unanswered is the one that bit, not some other
  if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify({ stand: process.env.TPS_PROFILE ?? 'frozen', seeds, runs }, null, 1));
  console.log(bad ? `\n=== vault-run: FAIL — ${bad} run(s) off the rule ===` : '\n=== vault-run: ALL PASS ===');
  process.exit(bad ? 1 : 0);
}
