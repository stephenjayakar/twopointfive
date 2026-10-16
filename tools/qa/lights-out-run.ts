// LIGHTS OUT, AS TWO — a scripted player on the quiet level built for a pair (tools/levels/lights-out.ts → levels/lights-out.json; row `lights-out-two`).
//
//   TPS_PROFILE=shipped bun run tools/qa/lights-out-run.ts [--plan pair,alone,…|all] [--seeds 1-24] [--delay s,…] [--deal N] [--jobs 3] [--moon] [--json f]
//                                                          [--cap secs] [--trace] [--verbose]
//
// INPUT ONLY, with one hook: the walk keys, C, Space on the game's own rows (the row is highlighted through `g.selectVerb`, the game's own scripting
// hook for the wheel, then a one-frame Space), the cursor, X and a digit for the partner's orders (the order menu opened on what the cursor is on), the
// left button for a round. Nothing is teleported, nobody's state is written; the one thing the script hands the game is the player's light
// meter (headless has no GPU meter: the CPU stand-in, plus the moon under --moon — the page's meter counts the moon, the stand-in leaves it out).
//
// THE LEVEL'S IDEA: the mains and the door they guard are in two places. The breaker is in the generator shed in the outer yard; the house's front door
// is under a lamp and a lens, and behind it a grille of four beams (more than the OCP holds dark at once) crosses the hall. Thrown, the breaker takes all
// of it — until the man the game sends to the panel has walked there and put it back. That dark is shorter than one man's walk from the panel to the door.
// AND THE HALL HAS A WINDOW: the north side's sentry stands at it looking in, and a lantern on its own fuel lights the hall for him whatever the mains do.
// He is the man the game sends to the panel (the nearest by the straight line the rule measures) — so a breaker THROWN takes the grille and the watcher off
// the hall together for a quarter of a minute, and a panel SHOT dead takes the grille for good and gives the watcher back.
// AND THE INNER DOOR IS LOCKED on its hall face: four seconds on a knee at its keyway, in the lantern's light, in the window's view. In the pair's dark
// that is done with seconds to spare; under the sentry's eye it is not done at all (a sprint on his turn crossed the hall before the lock was there).
//
// PLANS (each a whole run from the west track to out of the east gate with the codebook):
//   pair    as built for (squad 1). The partner is sent to wait in the fuel cage ('hold in the dark'), Sam goes on alone through the gap and down the lane
//           to the wood store beside the house's door; X on the panel, 1 = 'throw the breaker'; the moment it is dark the partner is sent back into the
//           cage (the man coming to the panel must not find him) and Sam goes in through the dead grille once the window's sentry has walked off it.
//   stay    the pair without its second order: the partner stands at the panel where the order left him.
//   alone   Sam by himself (squad 0), the same route: he throws the breaker by hand and walks straight for the door (upright, no wait at the gap, no
//           wait at the wood store: the dark is on the clock from the moment his hand leaves the lever).
//   dash    alone, and he SPRINTS from the panel to the door.
//   shot    alone: a round through the panel (the game's rule: nobody can put that back), wait in the fuel cage for the floor to settle, then the walk; the
//           front door opened from beside it, and into the hall low and quiet the moment the window's sentry turns from it.
//   rush    `shot`, but upright at a sprint on the sentry's turn (this got out, GHOST 100 on the card, before the inner door was locked).
//   kick    `rush`, and the inner door booted in, not picked: a second in place of four, and heard across the yard.
//   choke   `shot`, then up the north side behind the sentry while he looks in at his window, an arm round his neck, and in with nobody watching the
//           hall. The best lone way found; it leaves a man out cold for the shift's radio check to miss (every 90 s). THE SCRIPT'S STALK IS CLUMSY
//           (it waits for him in the moon's light and never moves the body), so its count is a floor for what a careful player would get.
//   left    the partner brought and left behind (squad 1): told to wait in the fuel cage, then Sam does `alone`.
//   tail    the partner brought and never spoken to (squad 1): he follows Sam through `alone`.
//
// 'CLEAN' = out with the codebook, no device tripped, nobody roused (a man the game SENDS — to the panel; to the strongbox after the take only under the old rule, `?takecheck`: the strongbox is not wired, game/takecheck.ts — is not counted
// unless he leaves his errand toward the player), the floor never raised, nothing seen on the card, no wait given up, no order given past the menu,
// nobody put out cold and no round fired — so `shot`, `rush`, `kick` and `choke`, which all open with a round through the panel, are never clean BY
// DEFINITION: read their 'out' column. 'Roused' is read off state changes: a man who hears a step and only turns his head is not in it.
// WHAT THE SCRIPT READS THAT A PLAYER WOULD HAVE TO WATCH FOR: where each man is, his state, whether he is on an errand (`task`), how long he will stand
// where he is (`wait`) and the way he is walking (`path`) — every plan times its moves off those, the lone arms as much as the pair. --moon adds the moon
// to the PLAYER's meter only (the partner's is the stand-in's: he waits in the cage's shadow either way).
// LIGHTSOUT_BREAK=1 = the check's own red path: `pair` never gives the breaker order and walks at the live door.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp } from './headless';
import type { Vec3 } from '../../src/math/vec';
import { LIGHTS } from '../levels/lights-out';

const ROOT = resolve(import.meta.dir, '../..'), DT = 1 / 60;
const argv = process.argv.slice(2), has = (f: string) => argv.includes(f), flag = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const at = (p: ArrayLike<number>) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
function seeded(a: number) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const PLANS = ['pair', 'stay', 'alone', 'dash', 'shot', 'rush', 'kick', 'choke', 'left', 'tail'] as const;
type Plan = typeof PLANS[number];
const SQUAD = (p: Plan) => p === 'pair' || p === 'stay' || p === 'left' || p === 'tail';
const BREAK = process.env.LIGHTSOUT_BREAK === '1';
export interface DuoRun {
  plan: Plan; seed: number; delay: number; deal: string; start: string; patrol: number; ok: boolean; why: string; secs: number; stage: string; down: boolean;
  /** device log rows by what happened (suspicion · alarm · trip · dead · …) */
  devices: Record<string, number>; tripped: string[];
  /** men who left 'patrol' for alert / search, or went suspicious on their own senses (not a man SENT on an errand, unless he leaves it toward the player) */
  roused: string[]; alert: string[];
  /** waits the script gave up on and walked on anyway: a run with one is not counted clean */
  forced: number;
  /** seconds the mains were out in all (−1 = never) · the clock when they went · when they came back (−1 = never) · when Sam was past the last beam (−1 = never) */
  dark: number; thrown: number; back: number; past: number; picked: number;
  /** who the game sent to the panel · orders given by X and a digit · orders that had to be given past the menu (0 on every run counted) */
  sent: string; orders: number; fallback: number;
  escalation: number; seen: number; alarms: number; bodies: number; kos: number; summary: string; lines: string[];
}

async function one(plan: Plan, seed: number, deal: number | null, trace: boolean, delay = 0): Promise<DuoRun> {
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { lightEstimateAt, escalationOf } = await import(`${ROOT}/src/game/guards.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const { debriefOf } = await import(`${ROOT}/src/game/chronicle.ts`);
  const log = console.log, err = console.error, warn = console.warn;
  const hush = () => { if (!has('--verbose')) console.log = console.error = console.warn = () => { }; }, unhush = () => { console.log = log; console.error = err; console.warn = warn; };
  const lines: string[] = [];
  const out: DuoRun = { plan, seed, delay, deal: '', start: '', patrol: -1, ok: false, why: '', secs: 0, stage: '', down: false, devices: {}, tripped: [], roused: [], alert: [], forced: 0, dark: -1, thrown: -1, back: -1, past: -1, picked: -1, sent: '', orders: 0, fallback: 0, escalation: 0, seen: 0, alarms: 0, bodies: 0, kos: 0, summary: '', lines };
  Math.random = seeded(0x9137 + seed * 7919);
  hush();
  let W: any;
  try { W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels/lights-out.json'), 'utf8'))), seed }); } finally { unhush(); }
  const g = W.game, I = W.input, cam = W.cam;
  if (deal === null) (await import(`${ROOT}/src/game/samestart.ts`)).SAMESTART.on = false;   // (this tool walks the level's DEALS by seed: with every mission starting the same — on in the page — an unpinned start is deal 0 on every seed. --deal N plays one deal under the switch as the page has it)
  hush(); const started = startFromQuery(g, `?levelFile=lights-out.json&quiet${deal === null ? '' : `=${deal}`}${SQUAD(plan) ? '&squad=1' : ''}`); unhush();
  if (!started.spec || started.why) return { ...out, why: `the mission did not start: ${started.why ?? 'no scenario'}` };
  out.deal = g.quiet.summary(); out.patrol = g.quiet.deal.patrol; out.start = g.level.scenarios.quiet.starts[g.quiet.deal.start].name;

  let t = 0, goal: number[] | null = null, sprint = false, peakEsc = 0;
  const held = new Set<string>(), was = new Map<any, string>(), roused = new Set<string>(), alert = new Set<string>();
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
      peakEsc = Math.max(peakEsc, escalationOf(g)); if (g.blackout.active) { out.dark = Math.max(0, out.dark) + DT; if (out.thrown < 0) out.thrown = t; } else if (out.thrown >= 0 && out.back < 0) { out.back = t; say(`   the mains are back on, ${(t - out.thrown).toFixed(1)} s after they went (player at ${at(pos())})`); }
      if (!out.sent) { const s = g.guards.find((x: any) => x.task?.kind === 'breaker'); if (s) { out.sent = `${s.callsign} (${s.route?.name})`; say(`   ${s.callsign} (${s.route?.name}) is sent to the breaker from ${at(s.char.pos)}`); } }
      for (const x of g.guards) { if (x.team === 'operative') continue; const st = x.state, w = was.get(x); if (w !== st) { was.set(x, st);
        // (every calm man looks up the moment the mains go — the breaker's own effect, not a sighting: not counted unless he goes on to alert / search)
        if (w !== undefined) { say(`   ${x.callsign ?? 'a man'}: ${w} → ${st} at ${at(x.char.pos)} (player at ${at(pos())}, lit ${g.player.visibility.toFixed(2)})`);
          if ((st === 'alert' || st === 'search' || (st === 'suspicious' && !x.task && !(out.thrown >= 0 && t - out.thrown < 0.3)))) roused.add(x.callsign); else if (st === 'suspicious' && x.task) say(`   (${x.callsign} is SENT to look: ${x.task.kind ?? 'an errand'})`); if ((st === 'alert' || st === 'search')) alert.add(x.callsign); } } }
      // a man SENT on an errand who then hears or glimpses the player turns to where that was and stays 'suspicious' (guards.ts: his fix is no longer his errand's place): roused, with no state change to see it by
      for (const x of g.guards) if (x.team !== 'operative' && x.state === 'suspicious' && x.task && x.awareness >= 0.45 && x.lastKnown && Math.hypot(x.lastKnown[0] - x.task.pos[0], x.lastKnown[2] - x.task.pos[2]) > 0.5 && !roused.has(x.callsign)) {
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
  const watchers = (pts: number[][], skip: any = null): any[] => g.guards.filter((gd: any) => gd.state !== 'dead' && gd.team !== 'operative' && gd !== skip && pts.some(p => {
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
  const watchersAhead = (pts: number[][], T: number, skip: any = null): any[] => T <= 0 ? watchers(pts, skip) : g.guards.filter((gd: any) => gd.state !== 'dead' && gd.team !== 'operative' && gd !== skip &&
    ahead(gd, T).some(([x, z], k) => pts.some(p => !(k * 0.5 < gd.wait - 0.5 && backTo(gd, p)) && Math.hypot(x - p[0], z - p[2]) <= (litAt(p) > 0.12 ? 22 : 6) && !g.col.segmentBlocked([x, 1.6, z], [p[0], 1.2, p[2]]))));
  /** wait until nobody has a line to any of `pts`, now or (T > 0) in the next T seconds of his walk, for half a second running (≤ secs) */
  function clear(what: string, pts: number[][], secs = 240, skip: any = null, T = 0, look = false): boolean {
    const who = () => watchersAhead(pts, T, skip);
    if (trace) say(`  [men: ${g.guards.filter((x: any) => x.team !== 'operative').map((x: any) => `${x.callsign} ${x.route?.name} ${at(x.char.pos)} ${x.state} wp${x.wp}`).join(' · ')}] watchers of ${what}: ${who().map((x: any) => x.callsign).join(', ') || 'none'}`);
    const t0 = t; let calm = 0;
    while (t - t0 < secs) { step(6); calm = who().length ? 0 : calm + 0.1; if (calm >= 0.5) { if (t - t0 > 1) say(`  waited ${(t - t0).toFixed(0)} s for a clear ${what}`); return true; } }
    if (look) return false;   // (a LOOK: the caller takes another way when it is not clear, nothing is walked into)
    say(`  no clear ${what} in ${secs} s (${who().map((x: any) => x.callsign).join(', ')} has a line) — going anyway`); out.forced++; return false;
  }
  const C = LIGHTS, O = g.orders, mate: any = g.quiet.ops?.[0] ?? null;
  const Bp: number[] = g.level.breaker.pos, gateZ = (nm: string): number => door(nm).frameCentre[2];
  const panel = (): number[] => [...g.engine.world.statics[g.level.breaker.boxes[0]].c];
  const mateIs = () => mate ? `${O.of(mate)?.order ?? 'no order'} at ${at(mate.char.pos)}${mate.state !== 'patrol' ? ` (${mate.state})` : ''}` : 'no partner';
  /** an order to the partner by the keys: the cursor on a place, X (the menu opens on what the cursor is on), the row's digit. `want` = the order the row
   *  must be; `alt` = a second place to point at for the same thing (the floor at a panel's foot). Past the menu only if the keys fail four times, and counted */
  function order(what: string, p: number[], want: string, alt?: number[]): boolean {
    for (let k = 0; k < 4; k++) {
      const q = k % 2 && alt ? alt : p, n0 = O.log.length;
      aim(q); step(2); aim(q); I.pressed.add('KeyX'); step(2);
      const M = O.menu;
      if (!M) { say(`  ${what}: X opened no menu on ${at(q)}`); step(10); continue; }
      const i = M.rows.findIndex((r: any) => r.id === want);
      if (i < 0 || M.why[i]) { say(`  ${what}: the menu on ${M.target.kind}${M.target.thing ? ` ▸ ${M.target.thing.name}` : ''} at ${at(M.target.at)} ${i < 0 ? `has no '${want}' row (rows: ${M.rows.map((r: any) => r.id).join(' ')})` : `refuses it: ${M.why[i]}`}`); I.pressed.add('KeyX'); step(14); continue; }
      const key = M.rows[i].key ?? i + 1; aim(q); I.pressed.add(`Digit${key}`); step(2);
      if (O.log.length === n0 || O.log[O.log.length - 1].order !== want) { say(`  ${what}: ${key} was pressed and no '${want}' order was logged`); if (O.menu) { I.pressed.add('KeyX'); step(2); } continue; }
      say(`  X, ${key}: ${what} (he is ${mateIs()})`); out.orders++; return true;
    }
    const why = want === 'work' ? O.give('work', (() => { const th = g.work?.things?.().find((x: any) => x.kind === 'breaker'); return th ? { kind: 'floor', at: th.stand, thing: th } : O.targetAt(p as any); })()) : O.give(want, O.targetAt(p as any), 'all');
    say(`  ${what}: GIVEN PAST THE MENU (${why ?? 'taken'})`); out.fallback++; return !why;
  }
  const northMan = () => g.guards.find((x: any) => x.route?.name?.startsWith('north')), eastMan = () => g.guards.find((x: any) => x.route?.name?.startsWith('east'));
  const GAP = [C.gapWest, C.gapEast, C.laneTop] as number[][], HALL = [C.hallIn, [22.75, 0, 16.25], C.hallFar] as number[][];
  /** the west gate and a step into the outer yard */
  const intoYard = () => { go(9.2, gateZ('gate_w')); go(9.6, 13.2); };
  /** through the gap in the inner wall — open, moonlit ground — when nobody has a line to it for the seconds the crossing takes, then low down the inner
   *  wall's shadow into the lane and round to the wood store. `wait` false = no wait at the gap (a plan on the clock) */
  function toDoorSide(wait: boolean, fast = false, nook = true) {
    const w = { sprint: fast };
    if (wait) { go(C.gapWait[0], C.gapWait[2]); clear('gap in the inner wall', GAP, 240, null, 4.5); }
    go(C.gapWest[0], C.gapWest[2], w); go(C.gapEast[0], C.gapEast[2], w); go(C.laneTop[0], C.laneTop[2], w);
    if (wait) crouch(true);
    go(16.8, 13.3, w); go(C.laneFoot[0], C.laneFoot[2], w); go(C.stubEnd[0], C.stubEnd[2], w);
    if (nook) { go(C.nookMouth[0], C.nookMouth[2], w); go(C.nook[0], C.nook[2], { near: 0.25 }); }
  }
  /** from beside the door: in by the front door, through the grille, the inner door, the back room */
  function inside(fast = false, watch: 'no' | 'gone' | 'turned' = 'no', boot = false) {
    const w = { sprint: fast };
    crouch(false);
    go(C.doorFront[0], C.doorFront[2], { ...w, near: 0.3 });
    say(`  at the front door: mains ${g.blackout.active ? `out (${(t - out.thrown).toFixed(1)} s so far)` : 'ON'}, lit ${g.player.visibility.toFixed(2)}`);
    // the hall's window: the door is opened from beside it (the door's own front is not in the window's view), and the hall is entered when the sentry has
    // no line into it ('gone': he has walked off to the breaker) or, a lone man with no end to the dark, the moment he turns from the window ('turned')
    if (watch !== 'no') { openDoor('front'); const N = northMan(), t0 = t;
      if (watch === 'gone') clear('front hall', HALL, 12);
      else if (!until(() => !N || N.state === 'dead' || (N.state === 'patrol' && !N.task && N.char.forward()[2] < -0.5), 60)) { say(`  the window's sentry never turned from it in 60 s — going anyway`); out.forced++; }
      else say(`  waited ${(t - t0).toFixed(0)} s for the window's sentry to turn from it`);
      say(`  into the hall: lit ${litAt(C.hallIn).toFixed(2)} at the grille by the lantern, the sentry ${N ? `${N.state}${N.task ? ' (sent)' : ''} at ${at(N.char.pos)}` : 'gone'}`); }
    if (watch === 'turned' && !fast) crouch(true);   // (low and quiet under the window while the sentry's back is to it; `fast` = upright, at a sprint)
    go(C.hallIn[0], C.hallIn[2], w); go(C.hallFar[0], C.hallFar[2], w);
    out.past = t; say(`  past the grille: mains ${g.blackout.active ? `still out, ${(t - out.thrown).toFixed(1)} s after they went` : 'ON'}`);
    // the inner door is LOCKED on its hall face: four seconds on a knee at its keyway, in the lantern's light and in the window's view
    const D = door('inner');
    if (boot && D.locked && D.isClosed()) { const c = D.frameCentre;   // the loud way: a second of a boot in place of four on a knee
      if (!verb('door', 'kick', [c[0], 1.0, c[2]])) throw new Stop(`no row to kick the inner door from ${at(pos())}`);
      if (!until(() => !D.isClosed(), 4)) throw new Stop('the inner door stood the boot');
      out.picked = t; say(`  the inner door is booted in: mains ${g.blackout.active ? 'out' : 'ON'}`); }
    else if (D.locked && D.isClosed()) { const c = D.frameCentre, t0 = t;
      if (!verb('door', 'pick', [c[0], 1.0, c[2]])) throw new Stop(`no row to pick the inner door from ${at(pos())}`);
      if (!until(() => !D.locked, 12)) throw new Stop(`the inner door's lock did not give (${Math.round(D.pick * 100)} %${g.player.picking ? '' : ', he was taken off it'})`);
      out.picked = t; say(`  the inner door's lock is picked (${(t - t0).toFixed(1)} s on a knee): mains ${g.blackout.active ? `still out, ${(t - out.thrown).toFixed(1)} s after they went` : 'ON'}`);
      if (!(watch === 'turned' && !fast)) crouch(false); }
    go(C.backIn[0], C.backIn[2], w);
  }
  /** the codebook, then out by the fire door and the east gate — begun when the man on the east strip is walking away up it */
  function takeAndLeave() {
    go(C.safeStand[0], C.safeStand[2], { near: 0.25 });
    const E = eastMan(), away = () => !E || E.state === 'dead' || (E.state === 'patrol' && !E.task && !(E.wait > 0) && E.char.forward()[2] < -0.5 && E.char.pos[2] > 14.3 && E.char.pos[2] < 17.8);
    const t0 = t; if (!until(away, 150)) { say(`  the east strip's man never walked away up it in 150 s (he is ${E?.state} at ${at(E.char.pos)}) — going anyway`); out.forced++; } else if (t - t0 > 1) say(`  waited ${(t - t0).toFixed(0)} s for the east strip's man to walk away`);
    if (!verb('objective', 'drive', C.safeFront)) throw new Stop(`no row at the strongbox (stage ${g.mission.stage})`);
    if (!until(() => g.mission.stage === 'exfil', 20)) throw new Stop(`the codebook was not taken (stage ${g.mission.stage})`);
    say('  the codebook is his');
    go(C.fireIn[0], C.fireIn[2]); go(C.fireOut[0], C.fireOut[2]);
    go(34.1, gateZ('gate_e'), { stop: () => g.mission.stage === 'done' }); if (!until(() => g.mission.stage === 'done', 6)) throw new Stop(`out of the gate and the run did not end (stage ${g.mission.stage})`);
  }
  const dark = (secs: number) => { if (!until(() => g.blackout.active, secs)) throw new Stop(`the mains never went (the partner is ${mateIs()})`); say(`  the mains are out (the partner is ${mateIs()})`); };

  /** AS BUILT FOR. `second` = the partner is sent back into the cage once it is dark (false: plan `stay`) */
  function pair(second: boolean) {
    intoYard();
    if (!order('wait in the fuel cage', C.cage, 'pairDark')) throw new Stop('the partner could not be sent to the fuel cage');
    toDoorSide(true);
    if (!until(() => flat(mate.char.pos, C.cage) < 1.2, 40)) say(`  the partner is not in the cage yet (${mateIs()})`);
    if (BREAK) { say('  LIGHTSOUT_BREAK: no breaker order — walking at the live door'); step(120); }
    else {
      if (!order('throw the breaker', panel(), 'work', [Bp[0] - 0.35, 0, Bp[2]])) throw new Stop('the partner could not be sent to the breaker');
      dark(40);
      if (second) order('back into the fuel cage', C.cage, 'pairDark');
    }
    go(C.nookMouth[0], C.nookMouth[2]); inside(false, BREAK ? 'no' : 'gone'); takeAndLeave();
  }
  /** Sam's own hand on the lever, then the same walk. `fast` = sprinting; `left` = the partner told to wait first */
  function alone(fast: boolean, left: boolean) {
    intoYard();
    if (left && !order('wait in the fuel cage', C.cage, 'pairDark')) throw new Stop('the partner could not be sent to the fuel cage');
    go(9.3, 16.25); go(11.2, 16.3); go(Bp[0] - 0.75, Bp[2], { near: 0.25 });
    if (!verb('breaker', 'breakerOff', [Bp[0], Bp[1], Bp[2]])) throw new Stop('no row at the breaker');
    dark(8);
    toDoorSide(false, fast, false); inside(fast); takeAndLeave();
  }
  /** a round through the panel from the shed's doorway side, the fuel cage until the floor has settled, then round to the wood store with nothing on the clock */
  function panelShot(toDoor = true) {
    intoYard(); go(9.3, 16.25); go(11.3, 16.3, { near: 0.25 });
    press('Digit1', 30);
    for (let k = 0; k < 4 && !g.blackout.active; k++) { for (let i = 0; i < 45; i++) { aim(panel()); step(); } I.clicked |= 1; step(20); }
    dark(2); say(`  a round through the panel: the blackout is ${g.blackout.permanent ? 'for good' : 'timed'}`);
    press('KeyE', 20);
    go(C.cage[0], C.cage[2]); crouch(true);
    // … and until the man sent to the panel has walked back through the gap to his own side of the inner wall
    const busy = () => g.guards.some((x: any) => x.team !== 'operative' && x.state !== 'dead' && (x.task || x.state !== 'patrol' || x.char.pos[0] < 17.5));
    step(240); const t0 = t; until(() => !busy(), 240); say(`  waited ${(t - t0 + 4).toFixed(0)} s in the cage: ${busy() ? 'the floor has NOT settled' : 'every man is back on his own side, on his beat'}`);
    if (toDoor) { toDoorSide(true); go(C.nookMouth[0], C.nookMouth[2]); }
  }
  /** the lone ways through a hall that is dark of its mains for good, lit by its lantern and watched from its window:
   *  'low' = crouched down the middle as the sentry turns from the window · 'rush' = the same moment, upright at a sprint ·
   *  'kick' = `rush`, and the inner door booted in, not picked (loud) ·
   *  'choke' = the sentry put out cold from behind first (a man touched: never counted clean) */
  function shot(how: 'low' | 'rush' | 'kick' | 'choke') {
    if (how === 'choke') {   // the sentry himself: up the north side behind him while he looks in at his window, an arm round his neck, and then nobody watches the hall
      panelShot(false); const N = northMan();
      go(C.gapWait[0], C.gapWait[2]); clear('gap in the inner wall', GAP, 240, null, 4.5);
      go(C.gapWest[0], C.gapWest[2]); go(C.gapEast[0], C.gapEast[2]); go(C.laneTop[0], C.laneTop[2]); crouch(true); go(19.3, 9.9);
      const t0 = t; if (!until(() => N.state === 'patrol' && !N.task && N.wait > 9 && N.char.pos[2] > C.sentry[2] - 0.25, 90)) { say(`  the sentry never settled at his window in 90 s (${N.state} at ${at(N.char.pos)}) — going anyway`); out.forced++; }
      else say(`  waited ${(t - t0).toFixed(0)} s for the sentry to settle at his window (${N.wait.toFixed(0)} s of his look left)`);
      go(N.char.pos[0], N.char.pos[2] - 0.85, { near: 0.12 });
      if (!verb('guard', 'grab', [N.char.pos[0], 1.35, N.char.pos[2]])) throw new Stop(`no row to grab the sentry from ${at(pos())} (he is ${N.state} at ${at(N.char.pos)})`);
      step(40); if (!verb('held', 'choke')) throw new Stop('no row to choke the held sentry');
      if (!until(() => N.state === 'dead', 15)) throw new Stop('the choke did not put the sentry out');
      say(`  the sentry is out cold at ${at(N.char.pos)}`); step(60);
      crouch(true); go(19.3, 9.9); go(C.laneTop[0], C.laneTop[2]); go(16.8, 13.3); go(C.laneFoot[0], C.laneFoot[2]); go(C.stubEnd[0], C.stubEnd[2]); go(C.nookMouth[0], C.nookMouth[2]);
      inside(false, 'no'); takeAndLeave(); return;
    }
    panelShot();
    inside(how !== 'low', 'turned', how === 'kick'); takeAndLeave();
  }

  try {
    step(20 + Math.round(delay * 60));
    if (plan === 'pair' || plan === 'stay') pair(plan === 'pair'); else if (plan === 'shot' || plan === 'rush' || plan === 'kick' || plan === 'choke') shot(plan === 'shot' ? 'low' : plan); else alone(plan === 'dash', plan === 'left');
    out.ok = g.mission.stage === 'done';
  }
  catch (e) { unhush(); out.why = e instanceof Stop ? e.message : `threw: ${(e as Error).stack ?? e}`; say(`!! ${out.why}`); }
  if (trace) { const { fmtEvent } = await import(`${ROOT}/src/game/chronicle.ts`); for (const e of g.chronicle.events) log(`   chron ${e.t.toFixed(1).padStart(6)} ${e.kind} ${fmtEvent(e)}`); for (const r of g.devices.log) log(`   device ${JSON.stringify(r)}`); for (const r of O.log) log(`   order ${JSON.stringify(r)}`); }
  out.secs = Number(t.toFixed(1)); out.stage = g.mission.stage; out.down = !!g.player.down;
  for (const r of g.devices.log as { device: string; what: string }[]) { out.devices[r.what] = (out.devices[r.what] ?? 0) + 1; if (r.what === 'trip' || r.what === 'suspicion' || r.what === 'alarm') out.tripped.push(`${r.device}:${r.what}`); }
  out.roused = [...roused]; out.alert = [...alert]; out.escalation = peakEsc;
  const D = debriefOf(g); out.seen = D.counts.seen; out.alarms = D.counts.alarms; out.bodies = D.counts.bodies; out.kos = D.counts.kos; out.summary = D.summary.replace(/^twopointsix — /, '');
  return out;
}

const clean = (r: DuoRun) => r.ok && !r.tripped.length && r.seen === 0 && r.escalation === 0 && !r.forced && !r.roused.length && !r.fallback && r.kos === 0 && /shots 0/.test(r.summary);
const cell = (r: DuoRun) => `${r.plan.padEnd(6)} seed ${String(r.seed).padStart(2)}${r.delay ? ` +${r.delay} s` : ''} · set ${r.patrol === 1 ? 'B' : 'A'} · ${r.ok ? 'OUT with the codebook' : `NOT out (${r.stage}${r.down ? ', down' : ''})`} · ${r.secs.toFixed(0)} s · mains ${r.thrown < 0 ? 'never out' : `out ${r.dark.toFixed(1)} s${r.past >= 0 ? `, past the grille at +${(r.past - r.thrown).toFixed(1)} s` : ''}${r.sent ? `, sent ${r.sent}` : ''}`} · devices ${r.tripped.length ? r.tripped.join(' ') : 'none tripped'} · roused ${r.roused.length ? r.roused.join(', ') : 'nobody'} · floor ${r.escalation}${r.forced ? ` · gave up ${r.forced} wait(s)` : ''}${r.fallback ? ` · ${r.fallback} order(s) past the menu` : ''} · ${r.summary}${r.why ? ` · ${r.why}` : ''}`;

/** probes.ts `lights-out` (family `missions`): as shipped, the moon counted, on the level's two deals, each stood by its PIN (so the probe holds whatever
 *  an unpinned start deals: `quiet-pin.ts lights-out --all` — quiet=3 = patrol set A [north, east, cook], quiet=0 = set B, the `_b` routes; seed 1 on A
 *  and seed 3 on B, the seeds that dealt those sets when the check left the deal to the die) — the pair gets
 *  out clean having crossed the grille while the mains were dead; alone, and with the partner told to wait and never used, the breaker is thrown and
 *  the player is shot; a panel shot and a sprint on the sentry's turn crosses the grille and is shot; the sentry choked out first is run and its count
 *  printed, not judged. LIGHTSOUT_BREAK=1 (the pair never gives the breaker order and walks at the live door) must turn it red: the pair's two lines. */
const LIGHTS_PINS: [pin: number, seed: number][] = [[3, 1], [0, 3]];   // `quiet-pin.ts lights-out --all`: set A, set B (the smallest pin of each)
export async function lightsOutCheck(): Promise<boolean> {
  let txt = '', errTxt = '', code = 0; const tails: string[] = [];   // (a red check prints every pin's last lines, not only the last pin's)
  for (const [pin, seed] of LIGHTS_PINS) { const pr = Bun.spawn(['bun', 'run', import.meta.path, '--plan', 'pair,alone,left,rush,choke', '--seeds', String(seed), '--deal', String(pin), '--moon', '--jobs', '3'], { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, TPS_PROFILE: 'shipped' } });
    const out = await new Response(pr.stdout).text(); txt += out; tails.push(out.trim().split('\n').slice(-14).join('\n')); errTxt += await new Response(pr.stderr).text(); code = Math.max(code, Math.abs(await pr.exited)); }
  // 1 runs · 2 deals · 3 out · 4 clean · 5 nobody roused · 6 player down · 7 mains out · 8 past the grille · 9 of those in the dark · 10 orders past the menu · 11 a round fired · 12 a man put out cold
  // one summary row a pin and plan: the counts are summed over the pins, and 2 = the patrol sets the plan's own run lines name
  const row = (p: string): string[] | null => { const R = [...txt.matchAll(new RegExp(`^${p}\\s+(\\d+) runs over (\\d+) deal.*?out with the codebook (\\d+) · clean (\\d+) .*?nobody roused (\\d+) .*?player down (\\d+) .*?mains out on (\\d+) .*?past the grille on (\\d+) at \\S+ s, in the dark on (\\d+) · orders past the menu (\\d+) .*?a round fired (\\d+) · a man put out cold (\\d+)`, 'gm'))];
    const sets = new Set([...txt.matchAll(new RegExp(`^${p}\\s+seed\\s+\\d+.*? · set (\\w) · `, 'gm'))].map(m => m[1])).size;
    return R.length === LIGHTS_PINS.length ? R[0].map((_, k) => k === 0 ? '' : String(k === 2 ? sets : R.reduce((s, m) => s + Number(m[k]), 0))) : null; };
  const P = row('pair'), A = row('alone'), L = row('left'), H = row('rush'), K = row('choke'); let ok = true;
  const line = (pass: boolean, what: string) => { console.log(`  ${pass ? 'PASS' : 'FAIL'}  lights-out: ${what}`); ok = ok && pass; };
  if (!P || !A || !L || !H || !K) { console.log(txt.trim().split('\n').slice(-8).join('\n')); if (errTxt.trim()) console.log(errTxt.trim().split('\n').slice(-4).join('\n')); line(false, `the runs gave no summary (exit ${code})`); return false; }
  const n = (m: string[], i: number) => Number(m[i]);
  /** a lone plan really played and really stopped by the game: on every run the mains went out, no order was given past the menu, and the player was shot */
  const stopped = (m: string[]) => n(m, 3) === 0 && n(m, 7) === n(m, 1) && n(m, 10) === 0 && n(m, 6) === n(m, 1);
  const how = (m: string[]) => `out ${m[3]} of ${m[1]}, mains out on ${m[7]}, player down ${m[6]}, nobody roused ${m[5]}`;
  line([P, A, L, H, K].every(m => n(m, 2) === 2), `two pins are the level's two deals on every plan (pair ${P[2]}, alone ${A[2]}, left ${L[2]}, rush ${H[2]}, choke ${K[2]})`);
  line(n(P, 4) === n(P, 1), `the pair is clean on both (${P[4]} of ${P[1]}: out with the codebook, no device tripped, nobody roused or touched, the floor never raised, never seen, no round fired)`);
  line(n(P, 9) === n(P, 1) && n(P, 7) === n(P, 1), `the pair is past the grille while the mains are still out on both (${P[9]} of ${P[1]})`);
  line([P, A, L, H, K].every(m => n(m, 10) === 0), `every order went through the menu: X on the place, then its digit (past it: pair ${P[10]}, left ${L[10]})`);
  line(stopped(A), `alone, the breaker thrown by hand and straight for the door: stopped on both (${how(A)})`);
  line(stopped(L), `the partner brought, told to wait and never used: stopped on both (${how(L)})`);
  line(stopped(H) && n(H, 8) === n(H, 1), `a round through the panel, then the hall at a sprint as the window's sentry turns: past the grille on both (${H[8]} of ${H[1]}) and stopped on both (${how(H)})`);
  line(n(K, 7) === n(K, 1) && n(K, 11) === n(K, 1) && n(K, 10) === 0, `the lone way that can get out (the panel shot, the window's sentry choked out, then in) really ran: the mains shot out on both, by a round (out ${K[3]} of ${K[1]} — NOT judged: the level does not stop it; a man out cold on ${K[12]})`);
  line(code === 0, `no run died (lights-out-run's own exit ${code})`);
  if (!ok) console.log(tails.join('\n'));
  return ok;
}

if (import.meta.main) {
  { const VAL = ['--plan', '--seeds', '--seed', '--delay', '--deal', '--jobs', '--json', '--cap'], BARE = ['--trace', '--moon', '--one', '--verbose'], odd: string[] = [];
    for (let i = 0; i < argv.length; i++) { if (VAL.includes(argv[i])) i++; else if (!BARE.includes(argv[i])) odd.push(argv[i]); }
    if (odd.length) { console.error(`lights-out-run: unknown argument ${odd.join(' ')} (flags: ${[...VAL.map(f => `${f} <value>`), ...BARE].join(' · ')})`); process.exit(2); } }
  const plans = ((p) => p === 'all' ? ['pair', 'alone', 'left'] : p === 'every' ? [...PLANS] : p.split(','))(flag('--plan') ?? 'all') as Plan[];
  { const odd = plans.filter(p => !(PLANS as readonly string[]).includes(p)); if (odd.length) { console.error(`lights-out-run: no plan named ${odd.join(', ')} (plans: ${PLANS.join(' · ')} · all · every)`); process.exit(2); } }
  const seeds = ((s: string) => { const m = /^(\d+)-(\d+)$/.exec(s); return m ? Array.from({ length: Number(m[2]) - Number(m[1]) + 1 }, (_, i) => Number(m[1]) + i) : s.split(',').map(Number); })(flag('--seeds') ?? flag('--seed') ?? '1-24');
  const delays = (flag('--delay') ?? '0').split(',').map(Number);
  const deal = flag('--deal') === undefined ? null : Number(flag('--deal'));
  if (has('--one')) { const r = await one(plans[0], seeds[0], deal, has('--trace'), delays[0]); process.stdout.write(`\n@@LIGHTS ${JSON.stringify(r)}\n`); process.exit(0); }
  const jobs = Math.max(1, Number(flag('--jobs') ?? 2)), todo = plans.flatMap(p => seeds.flatMap(s => delays.map(d => ({ p, s, d })))), runs: DuoRun[] = [];
  const worker = async () => { for (;;) { const j = todo.shift(); if (!j) return;
    const pr = Bun.spawn(['bun', 'run', import.meta.path, '--one', '--plan', j.p, '--seed', String(j.s), '--delay', String(j.d), ...(deal === null ? [] : ['--deal', String(deal)]), ...(has('--trace') ? ['--trace'] : []), ...(has('--moon') ? ['--moon'] : []), ...(has('--verbose') ? ['--verbose'] : []), ...(flag('--cap') ? ['--cap', flag('--cap')!] : [])], { stdout: 'pipe', stderr: 'pipe', env: process.env });
    const txt = await new Response(pr.stdout).text(), errTxt = await new Response(pr.stderr).text(); await pr.exited;
    const m = /@@LIGHTS (.*)/.exec(txt);
    const r: DuoRun = m ? JSON.parse(m[1]) : { plan: j.p, seed: j.s, delay: j.d, deal: '', start: '?', patrol: -1, ok: false, why: `the run died: ${(errTxt || txt).trim().split('\n').slice(-3).join(' | ')}`, secs: 0, stage: '?', down: false, devices: {}, tripped: [], roused: [], alert: [], forced: 0, dark: -1, thrown: -1, back: -1, past: -1, picked: -1, sent: '', orders: 0, fallback: 0, escalation: 0, seen: 0, alarms: 0, bodies: 0, kos: 0, summary: '', lines: [] };
    if (has('--trace')) console.log(txt.replace(/\n@@LIGHTS .*\n?/, ''));
    runs.push(r); console.log(cell(r)); } };
  await Promise.all(Array.from({ length: jobs }, worker));
  runs.sort((a, b) => plans.indexOf(a.plan) - plans.indexOf(b.plan) || a.seed - b.seed || a.delay - b.delay);
  console.log(`\n=== lights-out-run · ${process.env.TPS_PROFILE === 'shipped' ? 'the shipped stand' : 'the frozen stand'} · seeds ${seeds[0]}‥${seeds[seeds.length - 1]} ===`);
  let bad = 0;
  for (const p of plans) { const R = runs.filter(r => r.plan === p), n = R.length, cnt = (f: (r: DuoRun) => boolean) => R.filter(f).length, T = R.filter(r => r.thrown >= 0), mean = (f: (r: DuoRun) => number, of = T) => (of.reduce((s, r) => s + f(r), 0) / Math.max(1, of.length)).toFixed(1);
    const deals = new Set(R.map(r => `${r.start}/${r.patrol}`)).size, P = T.filter(r => r.past >= 0);
    console.log(`${p.padEnd(6)} ${n} runs over ${deals} deal(s): out with the codebook ${cnt(r => r.ok)} · clean ${cnt(clean)} · no device tripped ${cnt(r => !r.tripped.length)} · nobody roused ${cnt(r => !r.roused.length)} · floor never raised ${cnt(r => r.escalation === 0)} · seen 0 ${cnt(r => r.seen === 0)} · no wait given up ${cnt(r => !r.forced)} · player down ${cnt(r => r.down)} · mean ${mean(r => r.secs, R)} s · mains out on ${T.length} for ${mean(r => r.dark)} s · past the grille on ${P.length} at +${mean(r => r.past - r.thrown, P)} s, in the dark on ${P.filter(r => r.back < 0 || r.past < r.back).length} · orders past the menu ${cnt(r => r.fallback > 0)} · GHOST on the card ${cnt(r => r.ok && /^GHOST/.test(r.summary))} · a round fired ${cnt(r => !/shots 0/.test(r.summary))} · a man put out cold ${cnt(r => r.kos > 0)}`);
    if (R.some(r => /died|threw/.test(r.why))) bad += cnt(r => /died|threw/.test(r.why));   // a run that died is red whatever the plan
  }
  if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify({ stand: process.env.TPS_PROFILE ?? 'frozen', seeds, runs }, null, 1));
  console.log(bad ? `\n=== lights-out-run: FAIL — ${bad} run(s) died ===` : '\n=== lights-out-run: ALL PASS (nothing died; the counts above are the result) ===');
  process.exit(bad ? 1 : 0);
}
