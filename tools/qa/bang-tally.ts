// WHAT A FLASHBANG BUYS ON A DOOR, IN EVERY SCENARIO ON THE START CARD — counted headless, one door at a time:
//   bun run tools/qa/bang-tally.ts [--seeds 1-8] [--jobs 4] [--scn night-breach,records-pair] [--arms open,bang,hand] [--set '{…}'] [--json out.json] [--md]
//   bun run tools/qa/bang-tally.ts list                                      the doors it would work, per scenario
//   bun run tools/qa/bang-tally.ts trace <scenario id>:<door>:<arm>:<seed>   one run with its timeline
// For every scenario of scene/scenarioList.ts SCENARIOS (its own level, started by game/scenarioRun.ts startFromQuery as its row starts it) and every door of
// every room a defender holds there (the room fight's own rooms: roomfight.ts), the SAME staged situation is played per seed under each ARM:
//   open   the order menu's 'open and clear' on that door
//   bang   'bang and clear' (the squad's own canister)
//   hand   SAM'S OWN CAN: the team stacked ('stack up'), the door pushed open, one of his canisters landing inside (combat.ts dropThrowable), and 'open and
//          clear' given the moment it goes off — the player's two hands doing what the order does
// THE SITUATION: the room is HOT — a loud noise at this door four seconds before the order, so its men are on it (the case a bang is for; behind a door nobody
// is watching the plain door has surprise and needs nothing). The team starts a few steps outside the door. The rest of the floor stays in its rooms
// (ROOMFIGHT.rally off for the run) and any other defender with a line to where the team gathers is taken off the floor first: this counts the ENTRY, not the
// building. Sam commands unseen and unhurt (the 'hand' arm's can is his; he does not fight).
// COUNTED per arm: teammates lost · the room's men down · room taken (all its men down, a teammate standing; 'emptied' = the rest fell back out of it) · hostile rounds in the three seconds after the
// bang (what comes back through the doorway) · seconds from the order to the last of the room's men down.
// --set '{"table":{"knob":value}}' writes the game's knob tables for the run (operative / hostile = FIGHT_SKILL rows, ROOMFIGHT, BLIND, DOORTOOLS, ORDERS,
// bang = effects.ts fx.bang, and any table this build exports beside them — unknown names are an error).
// EXIT: 0 with the table printed (and, per scenario, whether the bang beat the plain door); 1 when --verdict is given and some scenario's bang arm loses
// more teammates than its plain door or takes (or empties) fewer rooms; 2 on a bad flag. THE HARNESS HAS NO GPU: sight is the CPU's direct-light estimate, no smoke lines.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const DTM: any = await import(`${ROOT}/src/game/doortools.ts`);
const RFM: any = await import(`${ROOT}/src/game/roomfight.ts`);
const NBM: any = await import(`${ROOT}/src/game/nightbreach.ts`);
const ORM: any = await import(`${ROOT}/src/game/orders.ts`);
const FXM: any = await import(`${ROOT}/src/game/effects.ts`);
const GDM: any = await import(`${ROOT}/src/game/guards.ts`);
const CBM: any = await import(`${ROOT}/src/game/combat.ts`);
const NVM: any = await import(`${ROOT}/src/game/nvg.ts`);
const DWM: any = await import(`${ROOT}/src/game/doorway.ts`).catch(() => null);   // (doorway manners: null in a checkout from before the module)
const IRM: any = await import(`${ROOT}/src/game/irlaser.ts`).catch(() => null);   // (null in a checkout from before the module: irlaser-probes.ts `digest` runs there too)
const EPM: any = await import(`${ROOT}/src/game/entrypoints.ts`);
const CUM: any = await import(`${ROOT}/src/game/cues.ts`).catch(() => null);   // (null in a checkout from before the defenders' cues)
const SLM: any = await import(`${ROOT}/src/game/silent.ts`).catch(() => null);   // (null in a checkout from before the module)
const ILM: any = await import(`${ROOT}/src/game/irlight.ts`).catch(() => null);   // (the infrared light on the goggles: null in a checkout from before the module)
const CVM: any = await import(`${ROOT}/src/game/cover.ts`);
const BDM: any = await import(`${ROOT}/src/game/buddy.ts`).catch(() => null);   // (null in a checkout from before the lone defender's radio call)
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);

const DT = 1 / 60;
type Arm = 'open' | 'bang' | 'hand';
export interface Spec { scn: string; door: string; room: string; arm: Arm; seed: number }
/** `still`: the room's own men alive and STILL IN IT at the end with the team alive — walked past, not gone off to another room */
interface Result extends Spec { lost: number; team: number; down: number; of: number; taken: boolean; held: boolean; still: number; after: number; secs: number; bangs: number; pre: number; outside: number; note: string }
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clone = (o: any) => JSON.parse(JSON.stringify(o));
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
/** the knob tables --set may write (a table this build does not have is simply absent: the same file runs on the build before the change) */
const TABLES: Record<string, any> = {};
{ const put = (k: string, t: any) => { if (t && typeof t === 'object') TABLES[k] = t; };
  put('operative', RFM.FIGHT_SKILL?.operative); put('hostile', RFM.FIGHT_SKILL?.hostile); put('ROOMFIGHT', RFM.ROOMFIGHT); put('BLIND', NBM.BLIND); put('NIGHTBREACH', NBM.NIGHTBREACH);
  put('DOORTOOLS', DTM.DOORTOOLS); put('ORDERS', ORM.ORDERS); put('bang', FXM.bang); put('FLASH', CBM.FLASH); put('PACE', GDM.PACE); put('LIGHTS', GDM.LIGHTS); put('NVG', NVM.NVG); put('IR', IRM?.IR); put('IRLIGHT', ILM?.IRLIGHT); put('ENTRY', EPM.ENTRY); put('REAR', CVM.REAR); put('COVER', CVM.COVER); put('CUES', CUM?.CUES); put('BUDDY', BDM?.BUDDY); put('SILENT', SLM?.SILENT); put('DOORMANNERS', DWM?.DOORMANNERS); }
const DEFAULTS: Record<string, any> = Object.fromEntries(Object.entries(TABLES).map(([k, t]) => [k, clone(t)]));
let SET: Record<string, Record<string, unknown>> = {};
/** knob overrides every later stage() applies over the defaults (the --set flag; a probe's red path) — {} = the build's own */
export function setKnobs(set: Record<string, Record<string, unknown>>) { SET = set; }
/** has this build that knob table (a pin for a switch that shipped later is only set where it exists) */
export const hasKnobs = (k: string) => k in TABLES;
function resetKnobs() {
  for (const [k, t] of Object.entries(TABLES)) Object.assign(t, clone(DEFAULTS[k]));
  for (const [k, row] of Object.entries(SET)) { if (!TABLES[k]) throw new Error(`--set: no table '${k}' (have ${Object.keys(TABLES).join(', ')})`); for (const key of Object.keys(row)) if (!(key in TABLES[k])) throw new Error(`--set: no knob '${k}.${key}'`); Object.assign(TABLES[k], clone(row)); }
}
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
const quiet = async <T>(on: boolean, fn: () => T | Promise<T>): Promise<T> => { if (!on) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

/** a scenario stood up as its row starts it, stepped until the room fight has its defenders in their rooms */
export async function stage(scnId: string, seed: number) {
  const E = SCENARIOS.find((e: any) => e.id === scnId); if (!E) throw new Error(`no scenario '${scnId}' — ${SCENARIOS.map((e: any) => e.id).join(', ')}`);
  resetKnobs(); RFM.ROOMFIGHT.rally = false;
  Math.random = seeded(0xba46 + seed * 7919);
  const W: any = await standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) }); const g = W.game;
  g.godMode = true; g.playerInvisible = true;
  let q = scenarioQuery(E) as string; if (E.kind === 'roomclear') q = q.replace(/roomclear(=\d+)?/, `roomclear=${seed}`);
  const { why } = startFromQuery(g, new URLSearchParams(q)); if (why) throw new Error(`${scnId}: start refused — ${why}`);
  const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
  step(20);
  const defs: any[] = g.fight.defs.filter((d: any) => d.room && d.room.entries.length && d.room.cells.size <= 500 && d.gd.state !== 'dead');   // (past 500 cells it is open floor or a corridor, not a room a door lets into)
  const roomKey = (r: any) => r.entries.map((e: any) => e.door.def.name).sort().join('+');
  return { W, g, E, step, defs, roomKey };
}
/** the doors worth working in a scenario: every entry of every room that has a defender, by door name and the room's own key */
export async function discover(scnId: string): Promise<{ door: string; room: string; men: number }[]> {
  const S = await quiet(true, () => stage(scnId, 1)); const out: { door: string; room: string; men: number }[] = [];
  const rooms = new Map<any, number>(); for (const d of S.defs) rooms.set(d.room, (rooms.get(d.room) ?? 0) + 1);
  for (const [room, men] of rooms) for (const e of room.entries) out.push({ door: e.door.def.name, room: S.roomKey(room), men });
  return out;
}

export async function run(X: Spec, verbose = false): Promise<Result> {
  const S = await quiet(!verbose, () => stage(X.scn, X.seed)); const { W, g, step } = S; const O = g.orders, D = g.doorTools, nav = g.col.nav;
  const out: Result = { ...X, lost: 0, team: 0, down: 0, of: 0, taken: false, held: false, still: 0, after: 0, secs: NaN, bangs: 0, pre: 0, outside: 0, note: '' };
  const mine = S.defs.filter((d: any) => S.roomKey(d.room) === X.room); if (!mine.length) { out.note = 'no defender dealt to this room on this seed'; return out; }
  const room = mine[0].room, ent = room.entries.find((e: any) => e.door.def.name === X.door); if (!ent) { out.note = 'door is not an entry of the room'; return out; }
  const d = ent.door, ox = ent.out[0], oz = ent.out[1], lx = -oz, lz = ox;
  const men: any[] = mine.map((m: any) => m.gd); out.of = men.length;
  const free = (p: number[]): number[] | null => { const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : null; };
  const outPt = (back: number, lat: number): number[] => [ent.at[0] + ox * back + lx * lat, 0, ent.at[2] + oz * back + lz * lat];
  const gate = outPt(0.7, 0);
  const clearTo = (p: number[]) => !g.col.solidBlocked([p[0], 1.1, p[2]], [gate[0], 1.1, gate[2]]);
  // the team a few steps outside, off the line of the opening where the floor allows; Sam beside them
  const team: any[] = O.squad().filter((x: any) => x.state !== 'dead'); out.team = team.length;
  const spots: number[][] = [];
  for (const back of [3.2, 4.2, 2.4, 5.2, 6.2]) for (const lat of [1.1, -1.1, 0.4, -0.4, 1.9, -1.9]) { const p = free(outPt(back, lat)); if (p && clearTo(p) && flat(p, ent.at) > 1.8 && !spots.some(s => flat(s, p) < 0.8)) spots.push(p); }
  if (spots.length < team.length + 1) { out.note = `no floor outside for the team (${spots.length} spots)`; return out; }
  team.forEach((gd, i) => { const p = spots[i]; gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(-ox, -oz); });
  await quiet(!verbose, () => g.teleportPlayer(spots[team.length] as any));
  // anybody else with a line to where they gather is off the floor before a sound is made (a room this door is INSIDE counts as taken)
  for (const x of g.guards) { if (x.state === 'dead' || x.team !== 'hostile' || men.includes(x)) continue;
    const c = [x.char.pos[0], 1.5, x.char.pos[2]]; if ([...spots.slice(0, team.length + 1), gate].some(p => !g.col.solidBlocked(c as any, [p[0], 1.3, p[2]]))) await quiet(!verbose, () => CBM.killGuard(g, x, [0, 0, 1], true)); }
  step(10);
  // HOT: a loud noise at this door (the hearing model's own event: the room's men put it at this entry and come round to it)
  const t0h = g.time; g.events.push({ kind: 'bang', pos: [gate[0], 0.3, gate[2]], time: g.time, loud: true });
  step(240);
  const lostBefore = team.filter(x => x.state === 'dead').length; if (lostBefore) out.note = `${lostBefore} lost before the order`;
  const log: string[] = []; const t0 = g.time; const T = (s: string) => { if (verbose) log.push(`${(g.time - t0).toFixed(2).padStart(6)}  ${s}`); };
  const seen = new Set<any>(); for (const e of g.events) seen.add(e);
  let bangT = NaN, lastDown = NaN; const was = new Map<any, string>(g.guards.map((x: any) => [x, x.state]));
  const watch = () => {
    for (const e of g.events) { if (seen.has(e)) continue; seen.add(e);
      if (e.kind === 'bang') { if (isNaN(bangT)) { bangT = e.time; out.pre = team.filter(x => x.state === 'dead').length - lostBefore; } out.bangs++; T(`BANG at (${e.pos[0].toFixed(1)}, ${e.pos[2].toFixed(1)}) · dazzled: ${men.filter(m => m.state !== 'dead' && m.dazzledUntil > g.time).map(m => `${m.callsign} ${(m.dazzledUntil - g.time).toFixed(1)}s`).join(', ') || 'nobody'} · of ours: ${team.filter(m => m.state !== 'dead' && m.dazzledUntil > g.time).map(m => m.callsign).join(', ') || 'nobody'}`); }
      if (e.kind === 'guardShot') { const w = g.guards.find((x: any) => x.char.id === e.who); if (w && w.team === 'hostile') { if (!isNaN(bangT) && e.time - bangT <= 3) out.after++; T(`${w.callsign} fires${e.blind ? ' blind' : ''}`); } else if (w) T(`${w.callsign} fires`); } }
    for (const x of g.guards) { const st = was.get(x); if (st !== 'dead' && x.state === 'dead') { T(`DOWN ${x.callsign} (${x.team}) by ${g.guards.find((k: any) => k.char.id === x.killerId)?.callsign ?? x.killerId}`); if (men.includes(x)) lastDown = g.time - t0; } was.set(x, x.state); }
  };
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { step(); watch(); } };
  const target = () => O.targetAt(d.frameCentre);
  const give = (id: string) => { const why = O.give(id, target(), 'all'); T(`order ${id}${why ? ` REFUSED: ${why}` : ''}`); return why; };
  if (X.arm === 'hand') {
    give('stack');
    for (let i = 0; i < 60 * 20; i++) { tick(); if (team.every(x => x.state === 'dead' || O.of(x)?.arrived)) break; }
    // Sam's hand on the door, then his can through it: the leaf pushed away from him, the canister landing a couple of strides inside
    const s = -g.doors.side(d, outPt(0.6, 0)); d.latched = false; d.closing = false; d.vel = s * 5.5; d.quietT = -1; d.lastWho = g.player.char.id; if (d.locked && !d.lockBroken) { d.lockBroken = true; }
    T('Sam pushes the door'); tick(18);
    let land: number[] | null = null; for (const b of [2.4, 2.1, 1.8, 1.5, 1.2]) { const p = outPt(-b, 0); if (!nav.isBlocked(p[0], p[2])) { land = p; break; } }
    land ??= free(outPt(-1.5, 0)) ?? outPt(-1.2, 0);
    CBM.dropThrowable(g, 'flash', land as any); T('Sam\'s can lands inside');
    for (let i = 0; i < 60 * 4 && isNaN(bangT); i++) tick();
    tick(6); give('openClear');
  } else give(X.arm === 'bang' ? 'bangClear' : 'openClear');
  const alive = () => team.some(x => x.state !== 'dead'), roomUp = () => men.some(x => x.state !== 'dead');
  let idle = 0;
  for (let i = 0; i < 60 * 50 && alive() && roomUp(); i++) { tick(); if (!D.ops.length) { if (++idle > 60 * 8) break; } else idle = 0; }
  tick(60 * 2);
  out.lost = team.filter(x => x.state === 'dead').length; out.down = men.filter(x => x.state === 'dead').length; out.taken = out.down === out.of && alive(); out.secs = out.taken ? lastDown : NaN;
  out.still = alive() && !D.ops.length ? men.filter(x => x.state !== 'dead' && g.fight.roomAt(x.char.pos) === room).length : 0;
  out.held = out.taken || (alive() && !D.ops.length && out.still === 0);   // the room is the team's: its men down — or the last of them fallen back out of it (ROOMFIGHT.fallBack) with a teammate standing and the entry over
  for (const op of [...D.done, ...D.ops]) for (const b of (op.beats ?? [])) if (/^bang · OUTSIDE/.test(b.what)) out.outside++;
  if (verbose) { console.log(`${X.scn} · ${X.door} (room ${X.room}) · ${X.arm} · seed ${X.seed} — hot ${f1(t0 - t0h)} s before the order`); for (const l of log) console.log(l); for (const x of [...team, ...men]) { if (x.state === 'dead') continue; const c = x.char, A = O.of?.(x); console.log(`   END ${x.callsign.padEnd(9)} at (${c.pos[0].toFixed(1)}, ${c.pos[2].toFixed(1)}) ${x.state}${x.script ? '/script' : ''} aim ${(c.aimYaw * 57.3).toFixed(0)}° light ${x.flashlight?.enabled ? 'on' : 'off'}${A ? ` · ${A.order}${A.arrived ? ' (there)' : ''}` : ''} · room ${g.fight.roomAt(c.pos)?.id ?? '—'}` + (men.includes(x) ? ` · seen by: ${team.filter(o => o.state !== 'dead').map(o => { const r = g.fight.sightOn(o, x); return `${o.callsign} ${r.visible ? `line, rate ${r.rate.toFixed(2)}` : 'no line/cone'}`; }).join('; ')} · sees: ${team.filter(o => o.state !== 'dead').map(o => { const r = g.fight.sightOn(x, o); return `${o.callsign} ${r.visible ? `rate ${r.rate.toFixed(2)}` : 'no'}`; }).join('; ')}` : '')); } for (const op of [...D.done, ...D.ops]) console.log(`   op ${op.kind} ${op.door.def.name}: ${(op.beats ?? []).map((b: any) => `${(b.t - t0).toFixed(2)} ${b.what}`).join(' | ')}`); }
  return out;
}

// ───────────────────────────────────────────────────────────── the command line ─────────────────────────────────────────────────────────────
function parseSeeds(s: string): number[] { const out: number[] = []; for (const part of s.split(',')) { const m = part.match(/^(\d+)-(\d+)$/); if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i); else if (/^\d+$/.test(part)) out.push(+part); else throw new Error(`bad seeds '${s}'`); } return out; }
const pct = (n: number, dn: number) => (dn ? `${Math.round(100 * n / dn)} %` : '—');
interface Row { scn: string; door: string; room: string; arm: Arm; n: number; lost: number; team: number; down: number; of: number; taken: number; held: number; after: number; pre: number; outside: number; secs: number[]; skipped: number }
function tabulate(rs: Result[]): Row[] {
  const rows = new Map<string, Row>();
  for (const r of rs) { const k = `${r.scn}|${r.door}|${r.room}|${r.arm}`; let R = rows.get(k); if (!R) rows.set(k, R = { scn: r.scn, door: r.door, room: r.room, arm: r.arm, n: 0, lost: 0, team: 0, down: 0, of: 0, taken: 0, held: 0, after: 0, pre: 0, outside: 0, secs: [], skipped: 0 });
    if (r.note && !r.of || /no floor|before the order/.test(r.note)) { R.skipped++; continue; }
    R.n++; R.lost += r.lost; R.team += r.team; R.down += r.down; R.of += r.of; if (r.taken) { R.taken++; R.secs.push(r.secs); } if (r.held ?? r.taken) R.held++; R.after += r.after; R.pre += r.pre ?? 0; R.outside += r.outside ?? 0; }
  return [...rows.values()];
}
function report(rs: Result[], md: boolean): { ok: boolean; lines: string[] } {
  const rows = tabulate(rs), lines: string[] = []; let ok = true;
  const arms = [...new Set(rows.map(r => r.arm))];
  const sum = (l: Row[]) => l.reduce((a, r) => ({ n: a.n + r.n, lost: a.lost + r.lost, team: a.team + r.team, down: a.down + r.down, of: a.of + r.of, taken: a.taken + r.taken, held: a.held + r.held, after: a.after + r.after }), { n: 0, lost: 0, team: 0, down: 0, of: 0, taken: 0, held: 0, after: 0 });
  const cell = (s: ReturnType<typeof sum>) => s.n ? `${s.lost}/${s.team} lost · ${s.down}/${s.of} down · taken ${s.taken}/${s.n}${s.held > s.taken ? ` (+${s.held - s.taken} emptied)` : ''}` : '—';
  const head = ['scenario', 'doors', ...arms.map(a => a === 'open' ? 'open and clear' : a === 'bang' ? 'bang and clear' : "Sam's own can, then open and clear"), 'rounds back in 3 s after the bang (bang arm, per run)'];
  const body: string[][] = [];
  for (const E of SCENARIOS as any[]) { const mine = rows.filter(r => r.scn === E.id); if (!mine.length) continue;
    const per = Object.fromEntries(arms.map(a => [a, sum(mine.filter(r => r.arm === a))])) as Record<Arm, ReturnType<typeof sum>>;
    const doors = new Set(mine.filter(r => r.n).map(r => `${r.door}|${r.room}`)).size;
    body.push([E.title, String(doors), ...arms.map(a => cell(per[a])), per.bang?.n ? f1(per.bang.after / per.bang.n) : '—']);
    if (per.open?.n && per.bang?.n) { const better = per.bang.lost / per.bang.team < per.open.lost / per.open.team && per.bang.held / per.bang.n >= per.open.held / per.open.n; if (!better) ok = false;   // (a room is the team's when its men are down OR the last of them has fallen back out of it — 'taken' alone called a room lost whose one unflashed man ran)
      lines.push(`${better ? 'PASS' : 'FAIL'} — ${E.title}: behind the bang ${pct(per.bang.lost, per.bang.team)} of the team lost and ${pct(per.bang.held, per.bang.n)} of rooms taken or emptied, through the plain door ${pct(per.open.lost, per.open.team)} and ${pct(per.open.held, per.open.n)}${per.hand?.n ? ` · Sam's own can ${pct(per.hand.lost, per.hand.team)} and ${pct(per.hand.held, per.hand.n)}` : ''}`); } }
  const table = (h: string[], b: string[][]) => md ? [`| ${h.join(' | ')} |`, `|${h.map(() => '---').join('|')}|`, ...b.map(r => `| ${r.join(' | ')} |`)] : (() => { const w = h.map((x, i) => Math.max(x.length, ...b.map(r => r[i].length))); return [h, ...b].map(r => r.map((c, i) => c.padEnd(w[i])).join('  ')); })();
  const perDoor: string[][] = rows.filter(r => r.n).sort((a, b) => SCENARIOS.findIndex((e: any) => e.id === a.scn) - SCENARIOS.findIndex((e: any) => e.id === b.scn) || a.room.localeCompare(b.room) || a.door.localeCompare(b.door) || a.arm.localeCompare(b.arm))
    .map(r => [r.scn, r.door, String(Math.round(r.of / r.n)), r.arm, String(r.n), `${r.lost}/${r.team}`, `${r.down}/${r.of}`, `${r.taken}/${r.n}`, f1(r.after / r.n), r.arm === 'open' ? '—' : String(r.pre), r.arm === 'bang' ? String(r.outside) : '—', r.secs.length ? f1(r.secs.reduce((a, b) => a + b, 0) / r.secs.length) : '—']);
  const skipped = rows.reduce((a, r) => a + r.skipped, 0);
  return { ok, lines: [...table(head, body), '', ...lines, '', ...table(['scenario', 'door', 'men in the room', 'arm', 'runs', 'team lost', "room's men down", 'room taken', 'rounds back in 3 s', 'lost before the bang', 'cans that went off outside', 's to the last man down'], perDoor), ...(skipped ? ['', `(${skipped} runs not counted: no defender dealt to the room on that seed, no floor outside the door for the team, or a man lost before the order)`] : [])] };
}

if (import.meta.main) {
  const argv = process.argv.slice(2); const mode = argv[0] && !argv[0].startsWith('--') ? argv.shift()! : 'run';
  const flag = (k: string) => { const i = argv.indexOf(`--${k}`); if (i < 0) return undefined; const v = argv[i + 1]; argv.splice(i, 2); return v; };
  const bool = (k: string) => { const i = argv.indexOf(`--${k}`); if (i < 0) return false; argv.splice(i, 1); return true; };
  try {
    const set = flag('set'); if (set) SET = JSON.parse(set); resetKnobs();
    if (mode === 'worker') { const specs: Spec[] = JSON.parse(readFileSync(argv[0], 'utf8')); for (const X of specs) { let r: Result; try { r = await run(X); } catch (e) { r = { ...X, lost: 0, team: 0, down: 0, of: 0, taken: false, after: 0, secs: NaN, bangs: 0, note: `no floor: threw ${e instanceof Error ? e.message : e}` } as Result; } process.stdout.write(`@@${JSON.stringify(r)}\n`); } process.exit(0); }
    if (mode === 'trace') { const [scn, door, arm, seed, room] = argv[0].split(':'); const ds = (await discover(scn)).filter(x => x.door === door && (!room || x.room === room));   // (a door between two held rooms: name the room's key — its doors joined by + — as a fifth field)
      if (!ds.length) throw new Error(`no such door in ${scn}: ${(await discover(scn)).map(x => x.door).join(', ')}`); const r = await run({ scn, door, room: ds[0].room, arm: arm as Arm, seed: +seed }, true); console.log(JSON.stringify(r)); process.exit(0); }
    const seeds = parseSeeds(flag('seeds') ?? '1-8'), jobs = +(flag('jobs') ?? 4), md = bool('md'), verdict = bool('verdict'), json = flag('json');
    const only = flag('scn')?.split(','), arms = (flag('arms') ?? 'open,bang,hand').split(',') as Arm[];
    if (argv.length && mode !== 'list') throw new Error(`unknown flag ${argv.join(' ')} (have --seeds --jobs --scn --arms --set --json --md --verdict)`);
    const specs: Spec[] = [];
    for (const E of SCENARIOS as any[]) { if (only && !only.includes(E.id)) continue;
      const ds = await discover(E.id); if (mode === 'list') { console.log(`${E.id} (${E.title}): ${ds.map(x => `${x.door} [${x.men}]`).join(' · ') || 'no held room with a door'}`); continue; }
      for (const x of ds) for (const arm of arms) for (const seed of seeds) specs.push({ scn: E.id, door: x.door, room: x.room, arm, seed }); }
    if (mode === 'list') process.exit(0);
    console.error(`bang-tally: ${specs.length} runs over ${jobs} jobs…`);
    const chunks: Spec[][] = Array.from({ length: jobs }, () => []); specs.forEach((s, i) => chunks[i % jobs].push(s));
    const tmp = process.env.TMPDIR ?? '/tmp'; const results: Result[] = [];
    await Promise.all(chunks.map(async (chunk, i) => { if (!chunk.length) return; const file = `${tmp}/bang-tally-${process.pid}-${i}.json`; writeFileSync(file, JSON.stringify(chunk));
      const p = Bun.spawn(['bun', 'run', import.meta.path, 'worker', file, ...(set ? ['--set', set] : [])], { stdout: 'pipe', stderr: 'ignore' });
      const text = await new Response(p.stdout).text(); await p.exited;
      for (const line of text.split('\n')) if (line.startsWith('@@')) results.push(JSON.parse(line.slice(2))); }));
    if (results.length !== specs.length) console.error(`bang-tally: ${specs.length - results.length} runs gave no result (a worker died)`);
    if (json) writeFileSync(json, JSON.stringify({ seeds, set: SET, results }, null, 1));
    const R = report(results, md); for (const l of R.lines) console.log(l);
    process.exit(verdict && (!R.ok || results.length !== specs.length) ? 1 : 0);
  } catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exit(2); }
}
