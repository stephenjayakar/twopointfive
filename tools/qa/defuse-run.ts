#!/usr/bin/env bun
// THE TWO CHARGES, PLAYED SEVERAL WAYS (levels/defuse.json, src/game/defuse.ts) on the same seeds:
//   split       red through the west wing to charge 1, blue through the east wing to charge 2, at once (the hall doors, a wing's room, then its workshop)
//   whole       all four through the west wing to charge 1, then back through the hall and the east wing to charge 2
//   split-back  red round the outside to the west workshop's back door, blue round to the east one, at once (one door each, the wing's room not taken first)
//   whole-back  all four to the west back door, then round the outside to the east one
//   sam         the squad whole through the west wing, and THE PLAYER HIMSELF round to the east back door and his own Space row on charge 2
// The mission's idea is that the clock decides how the four are split; this tool is the number behind the clock.
//   TPS_PROFILE=shipped bun run tools/qa/defuse-run.ts [--arm <arm>|both|backs|all] [--seeds 1-24] [--jobs 4] [--cap 300] [--json f] [--set '{"DEFUSE":{…}}'] [--secs N] [--clocks 60,75,90] [--md]
//   … --trace <arm>:<seed>     one run, every order and beat printed
// THE COMMANDER gives orders only (the order menu's own: a door tool on each door on the way, then 'work' on the charge) and is not in the fight: he is parked out
// on the lot, unseen and unhurt, and stood where an order is given from only for the instant it is read (roomclear-tally.ts's way). So the table measures the
// plan, not anybody's aim. In arm `sam` he is on the floor and seen, but still cannot be hurt and never fires: he is stood at charge 2 when his walk round the
// outside would have got him there, so that arm measures THE TIME that road takes — the two men in that workshop are a real player's own to deal with.
// A run ends: both charges safe AND the house taken (`won`), a charge gone off (`failed`), the squad down (`wiped`), or the cap (`stalled`, exit 1).
// --clocks: ONE run on a long clock (--secs 100) says how the same seed ends on every shorter one — a run is the same game until its clock is at zero — so the
// table is printed per clock: won there = both charges safe by then and the run won; the squad down before it = squad down; else a charge goes off at that
// second, with the teammates up COUNTED THEN (before the blast). The clock that ships is then played directly once to hold the reading.
// Exit 0 = every run ended, 1 = a throw or a stall. No GPU: what a man sees is the CPU's light estimate.
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { standUp, ROOT } from './headless.ts';
const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { DOORWAY, DOORSTAY } = await import(`${ROOT}/src/game/doors.ts`);
const { DOORBLAST } = await import(`${ROOT}/src/game/doorblast.ts`);
const { knobRegistry } = await import(`${ROOT}/src/game/knobs.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { lookLevelFile } = await import(`${ROOT}/src/scene/look.ts`);

type Vec3 = [number, number, number];
type Arm = 'split' | 'whole' | 'split-back' | 'whole-back' | 'sam';
const ARMS: Arm[] = ['split', 'whole', 'split-back', 'whole-back', 'sam'];
const DT = 1 / 60, LEVEL = 'defuse.json', PARK: Vec3 = [3, 0, 25];
const ARGV = process.argv.slice(2), FLAG = (n: string) => { const i = ARGV.indexOf(n); return i >= 0 ? ARGV[i + 1] : undefined; };
const SECS = Number(FLAG('--secs') ?? 0), GARRISON: Record<string, number> = Object.fromEntries((FLAG('--garrison') ?? '').split(',').filter(Boolean).map(x => { const [k, v] = x.split('='); return [k, Number(v)]; }));
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const levelOf = (file: string) => { const look = resolve(ROOT, 'levels', lookLevelFile(file)); return loadLevel(parseLevelData(readFileSync(existsSync(look) ? look : resolve(ROOT, 'levels', file), 'utf8'))); };

export interface DefuseRun {
  arm: Arm; seed: number; end: 'won' | 'failed' | 'wiped' | 'stalled' | 'error'; why: string;
  t: number;                    // seconds of the run
  safe: number;                 // charges made safe (of 2)
  safeAt: (number | null)[];    // seconds on the clock when each was made safe
  left: number;                 // seconds left on the clock when the last one was safe (0 = it ran out)
  team: number; of: number; hostiles: number; hostilesOf: number;
  teamPre: number;              // teammates up on the last frame before any charge went off (= team where none did)
  up: number[];                 // teammates up at each whole second on the clock (index = seconds run)
  wipedAt: number | null;       // seconds on the clock when the last teammate went down
  taken: boolean;               // the room clear's own end
  orders: number; refused: string[]; trace: string[];
}

type Step = { k: 'door'; door: string; room: string } | { k: 'work'; dev: number } | { k: 'go' };   // (go: the men are sent to where the nearest defender still up stands — the hunt for one who has left the house)
interface Group { who: 'all' | 'red' | 'blue'; plan: Step[]; i: number; st: 'give' | 'wait' | 'settle'; t: number; t0: number; tries: number; bang: boolean; idle: number; }

const BACK = {
  west: [{ k: 'door', door: 'back_1', room: 'wshop' }, { k: 'work', dev: 0 }] as Step[],
  east: [{ k: 'door', door: 'back_2', room: 'eshop' }, { k: 'work', dev: 1 }] as Step[],
};
const WING = {
  west: [{ k: 'door', door: 'hall_1', room: 'wroom' }, { k: 'door', door: 'shop_1', room: 'wshop' }, { k: 'work', dev: 0 }] as Step[],
  east: [{ k: 'door', door: 'hall_2', room: 'eroom' }, { k: 'door', door: 'shop_2', room: 'eshop' }, { k: 'work', dev: 1 }] as Step[],
};
/** where an order on a door is given from: a stride and a half out of it, on the side the team comes to it from */
const FROM: Record<string, Vec3> = { front: [20, 0, 18.6], hall_1: [15, 0, 14.6], hall_2: [25, 0, 14.6], shop_1: [13.6, 0, 10], shop_2: [26.4, 0, 10], back_1: [4.4, 0, 10.5], back_2: [35.6, 0, 10.5] };

async function play(arm: Arm, seed: number, cap: number, verbose: boolean, set: Record<string, Record<string, unknown>>): Promise<DefuseRun> {
  const out: DefuseRun = { arm, seed, end: 'error', why: '', t: 0, safe: 0, safeAt: [null, null], left: 0, team: 0, of: 0, hostiles: 0, hostilesOf: 0, teamPre: 0, up: [], wipedAt: null, taken: false, orders: 0, refused: [], trace: [] };
  const say = (x: string) => { out.trace.push(x); if (verbose) console.log(x); };
  const T: Record<string, any> = knobRegistry(), back: [any, string, unknown][] = [];
  const put = (name: string, o: Record<string, unknown>) => { if (!T[name]) throw new Error(`--set: no table '${name}'`); for (const [k, v] of Object.entries(o)) { if (!(k in T[name])) throw new Error(`--set: ${name} has no '${k}'`); back.push([T[name], k, T[name][k]]); T[name][k] = v; } };
  const log = console.log; if (!verbose) console.log = () => {};
  try {
    Math.random = seeded(0x9137 + seed * 7919);
    const level: any = levelOf(LEVEL); if (SECS > 0) level.scenarios.defuse = { ...level.scenarios.defuse, secs: SECS };   // (--secs: another clock for this run — the level's own is the file's)
    for (const r of level.scenarios.roomClear.rooms) if (GARRISON[r.id] != null) r.garrison = GARRISON[r.id];   // (--garrison wroom=2,…)
    const W: any = await standUp({ uploadEvery: 4, level }); const g = W.game;
    if (!T.WORK.on) throw new Error("the squad's work order is off on this stand: run under TPS_PROFILE=shipped (or TPS_WORKTHINGS=1) — the pairs are ordered to the charges through it");
    // (the doors as the page ships them — playthrough.ts writes the same on either stand)
    for (const [t, k, v] of [[DOORWAY, 'oneWay', true], [DOORWAY, 'exitsOut', false], [DOORWAY, 'frameHolds', true], [DOORSTAY, 'on', true], [T.DOORMANNERS, 'on', true], [DOORBLAST, 'on', true]] as [any, string, unknown][]) { back.push([t, k, t[k]]); t[k] = v; }
    for (const [name, o] of Object.entries(set)) put(name, o);
    g.godMode = true; g.playerInvisible = arm !== 'sam'; g.tune.chaos = 0.5;
    const { why } = startFromQuery(g, new URLSearchParams(`levelFile=${LEVEL}&roomclear=${seed}&squad4`)); if (why) throw new Error(`start refused — ${why}`);
    console.log = log;
    const O = g.orders, DTL = g.doorTools, RC = g.roomClear, DF = g.defuse, NB = g.nightBreach;
    const ops: any[] = NB.ops.slice(); out.of = ops.length; const hostiles = () => g.guards.filter((x: any) => x.unit && x.team === 'hostile'); out.hostilesOf = hostiles().length;
    const up = (m: any) => m.state !== 'dead';
    let stand: Vec3 = [g.player.char.pos[0], 0, g.player.char.pos[2]]; const ghost = arm !== 'sam';
    if (ghost) g.teleportPlayer(PARK);
    W.step(DT); if (!DF.active) throw new Error('the defuse overlay is not live on this staging');
    const here = <X>(at: Vec3, fn: () => X): X => { if (!ghost) return fn(); g.teleportPlayer(at); try { return fn(); } finally { g.teleportPlayer(PARK); } };
    const door = (name: string) => { const d = g.doors.byName(name); if (!d) throw new Error(`no door '${name}'`); return d; };
    const give = (id: string, target: any, who: any, at: Vec3): string | null => { const r = here(at, () => O.give(id, target, who)); out.orders++; say(`${clock()} ▸ ${id} → ${who}${target?.door ? ` on ${target.door.def?.name ?? target.door.name ?? '?'}` : ''}${r ? ` — REFUSED: ${r}` : ''}`); if (r) out.refused.push(`${id}: ${r}`); return r; };
    const clock = () => `${out.t.toFixed(1).padStart(6)} s [${Number.isFinite(DF.left) ? DF.left.toFixed(0).padStart(3) : '  –'}]`;
    // (the face a door order is given on: the side the plan comes to it from — or, `auto`, the side the men it is for are standing on: the hunt after the charges)
    const middle = (who: Group['who']): Vec3 => { const m = O.men(who); return m.length ? [m.reduce((a: number, x: any) => a + x.char.pos[0], 0) / m.length, 0, m.reduce((a: number, x: any) => a + x.char.pos[2], 0) / m.length] : stand; };
    const doorT = (name: string, auto?: Group['who']) => { const d = door(name); return { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side: sideOf(d, auto ? middle(auto) : FROM[name] ?? stand) }; };
    const devPos = (i: number): Vec3 => DF.data.devices[i].pos;
    const mk = (who: Group['who'], plan: Step[]): Group => ({ who, plan, i: 0, st: 'give', t: 0, t0: 0, tries: 0, bang: true, idle: 0 });
    let groups: Group[] = arm === 'whole' ? [mk('all', [...WING.west, ...WING.east])] : arm === 'whole-back' ? [mk('all', [...BACK.west, ...BACK.east])]
      : arm === 'split-back' ? [mk('red', BACK.west), mk('blue', BACK.east)] : arm === 'sam' ? [mk('all', WING.west)] : [mk('red', WING.west), mk('blue', WING.east)];
    const byBack = arm === 'split-back' || arm === 'whole-back'; let hunting = false;
    let hunt = 0, prevUp = ops.length, lastStates = DF.states.join(), lastMsg = g.messages?.length ?? 0, samAt = -1, samSpace = 0;
    const tickGroup = (G: Group) => {
      const men = O.men(G.who); if (!men.length || G.i >= G.plan.length) return;
      const S = G.plan[G.i];
      if (S.k === 'go') {
        const left = hostiles().filter(up);
        if (G.st === 'give') {
          if (out.t < G.t) return; if (!left.length) { G.i++; return; }
          const m = middle(G.who), h = left.reduce((a: any, b: any) => Math.hypot(b.char.pos[0] - m[0], b.char.pos[2] - m[2]) < Math.hypot(a.char.pos[0] - m[0], a.char.pos[2] - m[2]) ? b : a);
          const r = give('move', { kind: 'floor', at: [h.char.pos[0], 0, h.char.pos[2]] }, G.who, m);
          if (r) { if (++G.tries > 3) { G.i++; G.tries = 0; } G.t = out.t + 1.5; return; }
          G.st = 'wait'; G.t0 = out.t; G.tries = left.length;
        } else if (left.length < G.tries || out.t - G.t0 > 12) { G.i++; G.st = 'give'; G.tries = 0; G.t = 0; }
        return;
      }
      if (S.k === 'door') {
        const d = door(S.door);
        if (G.st === 'give') {
          if (out.t < G.t) return;
          const from = hunting ? middle(G.who) : FROM[S.door], T = () => doorT(S.door, hunting ? G.who : undefined);
          let r = G.bang ? give('bangClear', T(), G.who, from) : 'x';
          if (r) { G.bang = false; r = give('openClear', T(), G.who, from); }
          if (r) { if (++G.tries > 5) { say(`${clock()}   ${G.who}: giving up on ${S.door}`); G.i++; G.tries = 0; G.bang = true; } G.t = out.t + 1.5; return; }
          G.st = 'wait'; G.t0 = out.t;
        } else if (G.st === 'wait') {
          const op = DTL.ops.find((o: any) => o.door === d && o.men?.some?.((m: any) => men.includes(m))) ?? DTL.ops.find((o: any) => o.door === d);
          if (!op || out.t - G.t0 > 70) { G.st = 'settle'; G.t = out.t + 1.2; }
        } else if (RC.rooms.find((r: any) => r.def.id === S.room)?.cleared || out.t >= G.t) { G.i++; G.st = 'give'; G.tries = 0; G.bang = true; G.t = 0; }
      } else {
        if (DF.states[S.dev] !== 'armed') { G.i++; G.st = 'give'; G.t = 0; return; }
        const at = men.some((m: any) => g.work.working(m));
        if (at) { G.idle = out.t; return; }
        if (out.t < G.t || out.t - G.idle < 2.5) return;
        const near = g.work.near(devPos(S.dev)); if (!near) { say(`${clock()}   ${G.who}: no work target at charge ${S.dev + 1} — ${g.work.summary()}`); G.t = out.t + 2; return; }
        const p = devPos(S.dev); give('work', near.target, G.who, [p[0], 0, p[2] + 1.6]); G.idle = out.t; G.t = out.t + 2;
      }
    };
    const cap60 = Math.round(cap * 60);
    for (let f = 0; f < cap60; f++) {
      g.player.visibility = ghost ? 0.05 : g.player.visibility;
      // (arm `sam`: the player himself goes round the outside to the east back door and works charge 2 with his own Space row, from the first order on)
      const keys: string[] = [];
      if (!ghost && DF.states[1] === 'armed' && DF.started) {
        const p = devPos(1), goal: Vec3 = [p[0], 0, p[2] + 0.75], me = g.player.char.pos, dist = Math.hypot(goal[0] - me[0], goal[2] - me[2]);
        if (samAt < 0) { const len = (a: Vec3, b: Vec3) => { const path = [a, ...(g.col.nav.findPath(a, b) ?? [b])]; let L = 0; for (let k = 1; k < path.length; k++) L += Math.hypot(path[k][0] - path[k - 1][0], path[k][2] - path[k - 1][2]); return L; };   // (the path comes back without its first point)
          const corner: Vec3 = [35.4, 0, 18.4], out2: Vec3 = FROM.back_2, L = len(me, corner) + len(corner, out2) + len(out2, goal);   // (round the east end, never through the house)
          samAt = out.t + L / 1.55 + 1.5; say(`${clock()}   Sam goes round to the east back door: ${L.toFixed(1)} m at his walk and a door to open, at charge 2 at ${samAt.toFixed(1)} s`); }
        if (dist > 0.5 && !DF.working) { if (out.t >= samAt) { const d = door('back_2'); if (Math.abs(d.angle) < 0.3) g.doors.use(d, FROM.back_2, 0); g.teleportPlayer(goal); } }   // (the walk itself is not what is under test: he is stood at the bench when it would have got him there, the door opened by his hand)
        else if (!DF.working && f >= samSpace) { const ok = g.selectVerb?.('objective', 'defuse'); if (f % 60 === 0) say(`${clock()}   Sam at charge 2 — row ${ok ? 'up' : 'not offered'}`); if (ok) { keys.push('Space'); samSpace = f + 30; } }
      }
      if (keys.length) for (const k of keys) W.input.pressed.add(k);
      W.step(DT); out.t = (f + 1) * DT;
      if (DF.states.join() !== lastStates) { lastStates = DF.states.join(); say(`${clock()}   charges: ${lastStates}${DF.safeBy.some((x: any) => x) ? ` (by ${DF.safeBy.map((x: any) => x ?? '–').join(', ')})` : ''}`); for (let i = 0; i < 2; i++) if (DF.states[i] === 'safe' && out.safeAt[i] == null) out.safeAt[i] = +(DF.data.secs - DF.left).toFixed(1); }
      if (f % 15 === 0) {
        for (const G of groups) tickGroup(G);
        // (a pair that is down leaves its charge to the other pair, once that one has done its own: what a commander would say next)
        if (!DF.end && groups.length === 2) for (const [a, b] of [[0, 1], [1, 0]]) { const dead = groups[a], live = groups[b], S = dead.plan[dead.plan.length - 1];
          if (!O.men(dead.who).length && O.men(live.who).length && live.i >= live.plan.length && S?.k === 'work' && DF.states[S.dev] === 'armed') { say(`${clock()}   ${dead.who} is down: ${live.who} goes for charge ${S.dev + 1}`); groups[b] = mk(live.who, (byBack ? BACK : WING)[S.dev === 0 ? 'west' : 'east']); groups[a] = mk(dead.who, []); } }
        // (once both charges are settled the house is still to take: whoever is up goes round the rooms nobody has cleared)
        if (DF.end === 'safe' && !RC.end && groups.every(G => G.i >= G.plan.length || !O.men(G.who).length) && hunt < 12) {
          const todo = (['wroom', 'wshop', 'eroom', 'eshop'] as const).filter(id => !RC.rooms.find((r: any) => r.def.id === id)?.cleared);
          const has = (id: string) => !!RC.rooms.find((r: any) => r.def.id === id)?.cleared;   // (a wing's room is taken from its workshop where that is the team's already)
          const doorOf: Record<string, string> = { wroom: has('wshop') ? 'shop_1' : 'hall_1', wshop: has('wroom') || !byBack ? 'shop_1' : 'back_1', eroom: has('eshop') ? 'shop_2' : 'hall_2', eshop: has('eroom') || !byBack ? 'shop_2' : 'back_2' };
          // (a defender who has walked out of the rooms still to take — into the hall, or out of the house by a back door — is gone to, as a player would: no door order finds him)
          const inTodo = (h: any) => todo.some(id => { const b = RC.rooms.find((r: any) => r.def.id === id)?.def.bounds; return b && h.char.pos[0] > b.x0 && h.char.pos[0] < b.x1 && h.char.pos[2] > b.z0 && h.char.pos[2] < b.z1; });
          const out2 = hostiles().filter(up).some((h: any) => !inTodo(h)), go = !todo.length || (out2 && hunt >= 1) || hunt >= 3;
          hunt++; hunting = true; say(`${clock()}   hunt ${hunt}: ${go ? 'to where the nearest defender stands' : todo.join(' ')}`);
          groups = [mk('all', go ? [{ k: 'go' }] : todo.map(id => ({ k: 'door', door: doorOf[id], room: id } as Step)))];
        }
      }
      if (verbose && g.messages && g.messages.length !== lastMsg) { for (const m of g.messages.slice(lastMsg)) say(`${clock()}   · ${typeof m === 'string' ? m : m.text ?? JSON.stringify(m)}`); lastMsg = g.messages.length; }
      const teamUp = ops.filter(up).length;
      if (DF.started && !DF.end) { const sec = Math.floor(DF.data.secs - DF.left); while (out.up.length <= sec) out.up.push(teamUp); }
      if (teamUp === 0 && out.wipedAt == null && DF.started && !DF.end) out.wipedAt = +(DF.data.secs - DF.left).toFixed(1);
      if (DF.end !== 'failed') prevUp = teamUp; else out.teamPre = prevUp;
      if (DF.end === 'failed') { out.end = 'failed'; out.why = `a charge went off (${DF.states.join(', ')})`; for (let k = 0; k < 90; k++) W.step(DT); break; }
      if (DF.end === 'safe' && RC.end === 'taken') { out.end = 'won'; out.why = RC.endWhy ?? ''; break; }
      if (teamUp === 0 || RC.end === 'wiped') { out.end = 'wiped'; out.why = 'the squad down'; break; }
      if (f === cap60 - 1) { out.end = 'stalled'; out.why = `time cap · charges ${DF.states.join(', ')} · room clear ${RC.end ?? 'running'} · ${hostiles().filter(up).map((h: any) => `${h.callsign} at ${h.char.pos[0].toFixed(1)},${h.char.pos[2].toFixed(1)} ${h.state}`).join(' · ') || 'no'} defenders up · rooms left ${RC.rooms.filter((r: any) => !r.cleared).map((r: any) => r.def.id).join(' ') || 'none'} · team ${ops.filter(up).map((o: any) => `${o.callsign} at ${o.char.pos[0].toFixed(1)},${o.char.pos[2].toFixed(1)}`).join(' · ')}`; }
    }
    out.safe = DF.states.filter((s: string) => s === 'safe').length; out.left = DF.end === 'safe' ? +(DF.data.secs - Math.max(...out.safeAt.map(x => x ?? 0))).toFixed(1) : 0;
    out.team = ops.filter(up).length; if (out.end !== 'failed') out.teamPre = out.team; out.hostiles = hostiles().filter((x: any) => !up(x)).length; out.taken = RC.end === 'taken';
    say(`${clock()} END ${out.end} — ${out.why} · team ${out.team}/${out.of} · defenders down ${out.hostiles}/${out.hostilesOf} · ${DF.summary()}`);
  } catch (e: any) { out.end = 'error'; out.why = String(e?.stack ?? e); }
  finally { console.log = log; for (const [t, k, v] of back.reverse()) t[k] = v; }
  return out;
}

if (import.meta.main) {
  const known = ['--arm', '--seeds', '--jobs', '--cap', '--json', '--set', '--secs', '--clocks', '--garrison', '--trace', '--one', '--md'];
  for (const a of ARGV) if (a.startsWith('--') && !known.includes(a)) { console.error(`unknown flag ${a} (${known.join(' ')})`); process.exit(2); }
  const cap = Number(FLAG('--cap') ?? 300), set = JSON.parse(FLAG('--set') ?? '{}') as Record<string, Record<string, unknown>>;
  if (FLAG('--trace')) { const [a, s] = FLAG('--trace')!.split(':'); if (!ARMS.includes(a as Arm)) { console.error(`defuse-run: unknown arm '${a}' — one of ${ARMS.join(', ')}`); process.exit(2); } const r = await play(a as Arm, Number(s), cap, true, set); if (r.end === 'error') console.error(r.why); process.exit(r.end === 'error' || r.end === 'stalled' ? 1 : 0); }
  if (FLAG('--one')) { const [a, s] = FLAG('--one')!.split(':'); if (!ARMS.includes(a as Arm)) { console.error(`defuse-run: unknown arm '${a}' — one of ${ARMS.join(', ')}`); process.exit(2); } const r = await play(a as Arm, Number(s), cap, false, set); process.stdout.write(`\n@@RUN ${JSON.stringify({ ...r, trace: r.end === 'error' || r.end === 'stalled' ? r.trace.slice(-12) : [] })}\n`); process.exit(0); }
  const armArg = FLAG('--arm') ?? 'both', arms: Arm[] = armArg === 'both' ? ['split', 'whole'] : armArg === 'backs' ? ['split-back', 'whole-back'] : armArg === 'all' ? [...ARMS] : armArg.split(',') as Arm[];
  const badArm = (x: string | undefined | null) => { if (x != null && !ARMS.includes(x as Arm)) { console.error(`defuse-run: unknown arm '${x}' — one of ${ARMS.join(', ')} (--arm also takes a list, both, backs, all)`); process.exit(2); } };
  for (const x of arms) badArm(x);
  const seeds: number[] = []; for (const part of (FLAG('--seeds') ?? '1-24').split(',')) { const [a, b] = part.split('-').map(Number); for (let s = a; s <= (b ?? a); s++) seeds.push(s); }
  const jobs = Number(FLAG('--jobs') ?? Math.max(1, Math.min(4, cpus().length)));
  const todo = arms.flatMap(a => seeds.map(s => ({ a, s }))), runs: DefuseRun[] = [];
  const worker = async () => { for (;;) { const j = todo.shift(); if (!j) return;
    const pr = Bun.spawn(['bun', 'run', import.meta.path, '--one', `${j.a}:${j.s}`, '--cap', String(cap), '--set', JSON.stringify(set), ...(SECS > 0 ? ['--secs', String(SECS)] : []), ...(FLAG('--garrison') ? ['--garrison', FLAG('--garrison')!] : [])], { stdout: 'pipe', stderr: 'pipe', env: process.env });
    const [o, e] = await Promise.all([new Response(pr.stdout).text(), new Response(pr.stderr).text()]); await pr.exited;
    const m = /@@RUN (.*)/.exec(o); const r: DefuseRun = m ? JSON.parse(m[1]) : { arm: j.a, seed: j.s, end: 'error', why: e.trim().split('\n').slice(-3).join(' / '), t: 0, safe: 0, safeAt: [null, null], left: 0, team: 0, of: 0, hostiles: 0, hostilesOf: 0, teamPre: 0, up: [], wipedAt: null, taken: false, orders: 0, refused: [], trace: [] };
    runs.push(r); console.log(`  ${r.arm.padEnd(10)} seed ${String(r.seed).padStart(2)}: ${r.end.padEnd(7)} at ${r.t.toFixed(0).padStart(3)} s · safe ${r.safe}/2 ${JSON.stringify(r.safeAt)} · team ${r.team}/${r.of}${r.end === 'failed' ? ` (${r.teamPre} before the blast)` : ''} · down ${r.hostiles}/${r.hostilesOf}${r.end === 'error' || r.end === 'stalled' ? ` — ${r.why.split('\n')[0].slice(0, 200)}` : ''}`); } };
  await Promise.all(Array.from({ length: jobs }, worker));
  runs.sort((x, y) => x.arm.localeCompare(y.arm) || x.seed - y.seed);
  const md = ARGV.includes('--md'), mean = (xs: number[]) => xs.length ? (xs.reduce((p, q) => p + q, 0) / xs.length).toFixed(1) : '–';
  const first = (r: DefuseRun) => { const xs = r.safeAt.filter(x => x != null) as number[]; return xs.length ? Math.min(...xs) : Infinity; }, last = (r: DefuseRun) => r.safe === 2 ? Math.max(...(r.safeAt as number[])) : Infinity;
  /** how a run made on a longer clock ends on a clock of C seconds: its end there and the teammates up (before any blast) */
  const at = (r: DefuseRun, C: number): { end: DefuseRun['end']; team: number } => {
    if (r.end === 'error' || r.end === 'stalled') return { end: r.end, team: r.team };
    if (last(r) <= C) return { end: r.end, team: r.teamPre };                                  // (both safe in time: the same game to its end)
    if (r.wipedAt != null && r.wipedAt <= C) return { end: 'wiped', team: 0 };
    return { end: 'failed', team: r.up[Math.min(Math.floor(C), r.up.length - 1)] ?? r.teamPre };   // (a charge goes off at C)
  };
  const table = (C: number | null) => {
    const rows: string[] = [];
    for (const a of arms) { const R = runs.filter(r => r.arm === a), n = R.length, E = R.map(r => C == null ? { end: r.end, team: r.teamPre } : at(r, C)), c = (e: string) => E.filter(x => x.end === e).length, lim = C ?? Infinity;
      const line = { won: c('won'), failed: c('failed'), wiped: c('wiped'), other: c('stalled') + c('error'), team: `${E.reduce((p, x) => p + x.team, 0)}/${R.reduce((p, r) => p + r.of, 0)}`, firstSafeAt: mean(R.map(first).filter(x => Number.isFinite(x) && x <= lim)), lastSafeAt: mean(R.map(last).filter(x => Number.isFinite(x) && x <= lim)), both: R.filter(r => Number.isFinite(last(r)) && last(r) <= lim).length };   // (means over the runs that got there)
      rows.push(md ? `| ${a} | ${n} | ${line.won} | ${line.both} | ${line.failed} | ${line.wiped} | ${line.other} | ${line.team} | ${line.firstSafeAt} | ${line.lastSafeAt} |`
        : `${a.padEnd(10)}: ${n} runs · won ${line.won} · both safe in time ${line.both} · a charge went off ${line.failed} · squad down ${line.wiped} · stalled or error ${line.other} · teammates up ${line.team} (before any blast) · first charge safe at ${line.firstSafeAt} s, last at ${line.lastSafeAt} s (mean, on the clock)`); }
    if (md) console.log('| arm | runs | won | both safe in time | a charge went off | squad down | stalled / error | teammates up, before any blast | first safe at (s) | last safe at (s) |\n|---|---|---|---|---|---|---|---|---|---|');
    for (const r of rows) console.log(r);
    const won = (a: Arm, s: number) => { const r = runs.find(x => x.arm === a && x.seed === s); return !!r && (C == null ? r.end : at(r, C).end) === 'won'; };
    for (const [x, y] of [['split', 'whole'], ['split-back', 'whole-back'], ['split', 'split-back']] as [Arm, Arm][]) if (arms.includes(x) && arms.includes(y)) { let xy = 0, yx = 0; for (const s of seeds) { if (won(x, s) && !won(y, s)) xy++; if (won(y, s) && !won(x, s)) yx++; } console.log(`paired by seed: ${x} won where ${y} did not on ${xy} seeds, ${y} won where ${x} did not on ${yx}`); }
  };
  const clocks = (FLAG('--clocks') ?? '').split(',').filter(Boolean).map(Number);
  if (!clocks.length) table(null);
  const ran = SECS > 0 ? SECS : Number((levelOf(LEVEL) as any).scenarios?.defuse?.secs ?? 0);   // (the clock the runs were really made on: --secs, else the level's own)
  for (const C of clocks) { console.log(`\n=== on a clock of ${C} s${ran < C ? ` (the runs were made on ${ran} s: too short to say)` : ''} ===`); table(C); }
  if (FLAG('--json')) writeFileSync(FLAG('--json')!, JSON.stringify({ level: LEVEL, profile: process.env.TPS_PROFILE ?? 'frozen', set, runs }, null, 1));
  process.exit(runs.some(r => r.end === 'error' || r.end === 'stalled') ? 1 : 0);
}
