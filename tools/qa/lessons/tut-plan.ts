// The scripted player for the tutorial's plan mode mission (levels/tut-plan.json; tools/qa/lesson-run.ts runs it as the page opens it: a tutorial mission is
// always stood up on the shipped stand). Nobody on the floor is his: the frame's sky seat holds plan mode up (rails.ts RAILS.skyUp) and he has the mode's
// own hands and nothing else — its walk keys on the view, the digits that pick men (1 to 4 a man, Shift + a digit adds him, 5 everyone: the lines teach
// them), the left button dragged round men (the hall and the gates: a line there says only "pick two"), the right button on a door or the floor (clicked,
// or dragged for a way to face), the word. No left click on bare ground: the mission no longer names it. Game state is READ to time a press and to find where a thing is on the picture, never to do the deed. The points the
// view is asked to are the lesson's own, read from the level.
import type { Bot } from '../lesson-run';
import { CMDRING } from '../../../src/game/cmdring';
import { DOORTOOLS } from '../../../src/game/doortools';
import { planView } from '../../../src/game/planmode';

export const query = `?roomclear=1&squad4${process.env.TUTPLAN_HOUR ? `&hour=${process.env.TUTPLAN_HOUR}` : ''}`;   // (TUTPLAN_HOUR=dusk: the level at another hour — the page's row gives the mission its own)
/** the frozen stand's arm of the gate: the mission is played in plan mode, which that stand holds off — the mode's own words (the gate gives them to a
 *  level whose STEPS allow `plan`; here the frame allows it for the whole mission) */
export const raises = { TPS_QRING: '1', TPS_QPLAN: '1', TPS_PLANLOOK: '1', TPS_PLANWAITS: '1', TPS_PLANKNEE: '1', TPS_PLANDIGITS: '1', TPS_PLANCLEAR: '1', TPS_RAILDIGITS: '1' };
export const ended = (g: any) => g.lesson.finished;
/** `TUTPLAN_ALONE=1`: the wrong plan, played on purpose — all four on the hall's front door and the word. The steps still end (the room taken is every
 *  step's other way), and the line printed says what it cost: the men the gun put on a knee. It takes the hall on the step before the one that asks for the word */
const ALONE = process.env.TUTPLAN_ALONE === '1';
/** TWO STACKS ON ONE WORD GO IN TOGETHER, and the run FAILS when they do not: the first men of two stacks more than a second apart into the room, or a
 *  teammate dazzled by the team's own can — what a player's tape showed of this mission (10-22: one pair was in and done before the other opened its door,
 *  and the late pair's can went off on the first). Both are the squad's own entry rules (cmdring.ts `planOne`, doortools.ts `tossMate`), and the bar is
 *  the run's own wherever both are on (the page; a frozen run without `TPS_PLANONE=1 TPS_TOSSMATE=1` only says the line). `TUTPLAN_LOOSE=1`: only said, anywhere.
 *  A room that fell BEFORE the word (a stack that did not wait for it) fails the run too: nothing could be measured, and that is the break the bar is for.
 *  `TUTPLAN_POSTB=x,z`: the barrier's order is clicked there instead of on its mark (a hand does not land on the mark: where it may land is swept with this) */
const LOOSE = process.env.TUTPLAN_LOOSE === '1', POSTB = process.env.TUTPLAN_POSTB ? ((a: number[]) => [a[0], 0, a[1]])(process.env.TUTPLAN_POSTB.split(',').map(Number)) : null;
export const idleOk = ALONE ? ['all2', 'word2'] : [];

const WALL = [13.9, 0, 9.25], POST_A = [29.25, 0, 10.25], POST_B = [24.0, 0, 10.3], GATE_E = [35.0, 0, 10.0], GATE_N = [22.0, 0, 5.0];
const O = (B: Bot) => B.g.orders, P = (B: Bot) => B.g.orders.plan;
const squad = (B: Bot): any[] => O(B).men('all');
const px = (B: Bot, p: number[]): number[] => { const [x, y] = B.W.cam.project([p[0], p[1] ?? 0, p[2]], B.W.canvas.clientWidth, B.W.canvas.clientHeight); return [x, y]; };
const cursor = (B: Bot, s: number[]) => { B.I.mouseX = s[0]; B.I.mouseY = s[1]; };
const stackedOn = (B: Bot, m: any): string | null => { const A = O(B).of(m); return A?.order === 'stack' && A.door ? A.door.def.name : null; };
const cleared = (B: Bot, id: string) => !!B.g.roomClear.rooms.find((r: any) => r.def.id === id)?.cleared;

/** the mode is up: the seat holds it (nothing of his puts it up, and nothing takes it down) */
function modeUp(B: Bot) { if (!P(B).up) B.fail(`plan mode is not up on step '${B.g.lesson.step?.id}': the seat holds it up from the first tick (rails.ts RAILS.skyUp)`); }
/** the mode's walk keys until every one of the places is on the picture, clear of its edges and of the panels (as a hand would before clicking) */
function panTo(B: Bot, ...ps: number[][]) {
  modeUp(B);
  const w = B.W.canvas.clientWidth, h = B.W.canvas.clientHeight, MX = 260, MY = 150;
  for (let i = 0; i < 500; i++) {
    const q = ps.map(p => px(B, p)), x0 = Math.min(...q.map(v => v[0])), x1 = Math.max(...q.map(v => v[0])), y0 = Math.min(...q.map(v => v[1])), y1 = Math.max(...q.map(v => v[1]));
    const ks = [y0 < MY && y1 < h - MY ? 'KeyW' : y1 > h - MY && y0 > MY ? 'KeyS' : '', x0 < MX && x1 < w - MX ? 'KeyA' : x1 > w - MX && x0 > MX ? 'KeyD' : ''].filter(Boolean);
    if (!ks.length) break;
    B.hold(ks, 2 / 60);
  }
  // (a place that cannot be brought onto the picture is the mission's own break: a line asked for a click nobody can make)
  const off = ps.filter(p => { const [x, y] = px(B, p); return x < 40 || x > w - 40 || y < 40 || y > h - 40; });
  if (off.length) B.fail(`the view cannot bring ${off.map(p => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`).join(' and ')} onto the picture`);
  B.step(30);
}
/** NOBODY OF HIS IS ON THE FLOOR, AND THE MODE CANNOT BE PUT DOWN: asked once the first plan is under way and again at the end. The player stands parked
 *  where the level says, unseen; the pair, the back key and Esc are pressed as a hand would try them, and the mode is still up with no order gone out */
let seatAsked = 0;
function seat(B: Bot, when: string) {
  const R = B.g.rails, park = B.g.level.scenarios.lesson.rails.sky?.park as number[] | undefined, s = B.g.player.char.pos, n0 = (O(B).log as unknown[]).length;
  if (!R.planSeat || !R.skyOn || !park) B.fail(`${when}: the seat that holds plan mode up is not on (rails.sky.plan, RAILS.skyUp)`);
  if (Math.hypot(s[0] - park![0], s[2] - park![2]) > 0.3 || !B.g.playerInvisible) B.fail(`${when}: the player is not parked out of the picture: at (${s[0].toFixed(1)}, ${s[2].toFixed(1)}), unseen ${B.g.playerInvisible}`);
  B.hold(['ShiftLeft'], 2 / 60); B.I.pressed.add('KeyB'); B.hold(['ShiftLeft', 'KeyB'], 2 / 60); B.hold(['ShiftLeft'], 2 / 60); B.step(2); const pair = P(B).up;
  B.press('Tab', 3); const tab = P(B).up; B.press('Escape', 3); const esc = P(B).up;
  if (!pair || !tab || !esc || (O(B).log as unknown[]).length !== n0) B.fail(`${when}: a key took the mode down or gave an order: after Shift + the command key ${pair ? 'up' : 'DOWN'}, after Tab ${tab ? 'up' : 'DOWN'}, after Esc ${esc ? 'up' : 'DOWN'}, orders ${(O(B).log as unknown[]).length - n0}`);
  if (planView(O(B))?.sam) B.fail(`${when}: the mode's picture still marks the player`);
  seatAsked++; B.say(`  ${when}: the player parked at (${s[0].toFixed(1)}, ${s[2].toFixed(1)}), unseen and unmarked · Shift + the command key, Tab and Esc leave the mode up and give no order`);
}
/** a step of the lesson by its id · the place its mark stands on · the point its view test wants the view near */
const stepOf = (B: Bot, id: string): any => (B.g.level.scenarios.lesson.steps as any[]).find(T => T.id === id);
const find = (t: any, is: string): any => !t ? null : t.is === is ? t : (t.of ?? []).map((x: any) => find(x, is)).find(Boolean) ?? null;
/** the mode's walk keys until the step that asks for the view is done: toward the point its own test names */
function viewTo(B: Bot, id: string) {
  const at: number[] = find(stepOf(B, id).done, 'planView').at; panTo(B, at);
  for (let i = 0; i < 300 && B.g.lesson.step?.id === id; i++) { const L = P(B).look, k = [L[0] < at[0] - 0.4 ? 'KeyD' : L[0] > at[0] + 0.4 ? 'KeyA' : '', L[2] < at[2] - 0.4 ? 'KeyS' : L[2] > at[2] + 0.4 ? 'KeyW' : ''].filter(Boolean); if (k.length) B.hold(k, 2 / 60); else B.step(); }
}
/** the left button dragged from one corner of a box on the picture to the other */
function boxPx(B: Bot, a: number[], b: number[]) {
  cursor(B, a); B.step(2); B.I.clicked |= 1; B.I.buttons |= 1; B.step();
  for (let k = 1; k <= 5; k++) { cursor(B, [a[0] + (b[0] - a[0]) * k / 5, a[1] + (b[1] - a[1]) * k / 5]); B.step(); }
  B.I.buttons &= ~1; B.step(2);
}
/** a box round these men and nobody else of the squad: grown from their own feet on the picture */
function boxMen(B: Bot, men: any[]) {
  panTo(B, ...men.map(m => m.char.pos));
  // (round their feet, as a hand boxes men stood among others; a man walking through it is waited out)
  const feet = (m: any) => px(B, [m.char.pos[0], 0, m.char.pos[2]]), pad = 12;
  const rect = () => { const q = men.map(feet); return [Math.min(...q.map(v => v[0])) - pad, Math.min(...q.map(v => v[1])) - pad, Math.max(...q.map(v => v[0])) + pad, Math.max(...q.map(v => v[1])) + pad]; };
  const crowded = () => { const r = rect(); return squad(B).some(m => !men.includes(m) && (f => f[0] >= r[0] && f[0] <= r[2] && f[1] >= r[1] && f[1] <= r[3])(feet(m))); };
  for (let k = 0; k < 24 && crowded(); k++) B.step(10);
  // (a hand boxes men who have stopped, and boxes again when one walked out from under it)
  const same = (got: any[]) => got.length === men.length && men.every(m => got.includes(m));
  for (let k = 0; k < 3; k++) {
    for (let w = 0; w < 30; w++) { const p0 = men.map(m => [m.char.pos[0], m.char.pos[2]]); B.step(6); if (men.every((m, i) => Math.hypot(m.char.pos[0] - p0[i][0], m.char.pos[2] - p0[i][1]) < 0.02)) break; }
    const r = rect(); boxPx(B, [r[0], r[1]], [r[2], r[3]]);
    if (same(O(B).recipients())) break;
  }
  const got: any[] = O(B).recipients();
  if (got.length !== men.length || !men.every(m => got.includes(m))) {
    // (a third man stood inside the box, or one of the two outside it: Shift and a click takes him out or adds him, as a hand would)
    for (const m of [...got.filter(x => !men.includes(x)), ...men.filter(x => !got.includes(x))]) { cursor(B, px(B, [m.char.pos[0], 1.0, m.char.pos[2]])); B.hold(['ShiftLeft'], 2 / 60); B.I.clicked |= 1; B.I.buttons |= 1; B.hold(['ShiftLeft'], 1 / 60); B.I.buttons &= ~1; B.hold(['ShiftLeft'], 2 / 60); B.step(); }
  }
  const now: any[] = O(B).recipients();
  if (now.length !== men.length || !men.every(m => now.includes(m))) B.fail(`the box picked ${now.map(m => m.callsign).join(', ') || 'nobody'}, not ${men.map(m => m.callsign).join(', ')}`);
}
/** two of the four that a box can take without the others: the two at one end of the group as the picture shows it (the end nearer `p` first) */
function twoOf(B: Bot, p: number[]): any[] {
  const all = squad(B); panTo(B, ...all.map(m => m.char.pos));
  const f = new Map(all.map(m => [m, px(B, [m.char.pos[0], 0, m.char.pos[2]])] as [any, number[]]));
  const by = (k: 0 | 1) => [...all].sort((a, b) => f.get(a)![k] - f.get(b)![k]);
  const ends = [by(0).slice(0, 2), by(0).slice(-2), by(1).slice(0, 2), by(1).slice(-2)];
  const clean = (men: any[]) => { const q = men.map(m => f.get(m)!), x0 = Math.min(...q.map(v => v[0])) - 12, x1 = Math.max(...q.map(v => v[0])) + 12, y0 = Math.min(...q.map(v => v[1])) - 12, y1 = Math.max(...q.map(v => v[1])) + 12;
    return all.every(m => men.includes(m) || !(f.get(m)![0] >= x0 && f.get(m)![0] <= x1 && f.get(m)![1] >= y0 && f.get(m)![1] <= y1)); };
  const far = (men: any[]) => men.reduce((a, m) => a + Math.hypot(m.char.pos[0] - p[0], m.char.pos[2] - p[2]), 0);
  return ends.filter(clean).sort((a, b) => far(a) - far(b))[0] ?? nearest(B, all, p);
}
/** the right button clicked on a place */
function rclick(B: Bot, p: number[]) { panTo(B, p); cursor(B, px(B, p)); B.step(3); B.I.clicked |= 4; B.I.buttons |= 4; B.step(); B.I.buttons &= ~4; B.step(3); }
/** the right button pressed on one place of the floor, dragged toward another, let go */
function rdrag(B: Bot, a: number[], toward: number[]) {
  const l = Math.hypot(toward[0] - a[0], toward[2] - a[2]), b = [a[0] + (toward[0] - a[0]) / l * 3, 0, a[2] + (toward[2] - a[2]) / l * 3];
  panTo(B, a, b); const s = px(B, a), e = px(B, b);
  cursor(B, s); B.step(3); B.I.clicked |= 4; B.I.buttons |= 4; B.step();
  for (let k = 1; k <= 5; k++) { cursor(B, [s[0] + (e[0] - s[0]) * k / 5, s[1] + (e[1] - s[1]) * k / 5]); B.step(); }
  B.I.buttons &= ~4; B.step(3);
}
/** the right button on a door: on the part of its doorway the cursor's own pick calls that door */
function rdoor(B: Bot, name: string) {
  const d = B.door(name), c = d.frameCentre; panTo(B, [c[0], 0, c[2]]);
  for (const y of [1.0, 2.0, 0.1, 1.6]) { cursor(B, px(B, [c[0], y, c[2]])); B.step(2); const t = O(B).targetUnder(B.I, B.cam, B.W.canvas); if (t.kind === 'door' && t.door === d) { B.I.clicked |= 4; B.I.buttons |= 4; B.step(); B.I.buttons &= ~4; B.step(3); return; } }
  B.fail(`the cursor finds no way onto the door '${name}'`);
}
/** the two the first door was not given to (nearest the door they are to have) */
const free = (B: Bot) => squad(B).filter(m => stackedOn(B, m) === null);
/** two of the squad, the nearest to a place */
const nearest = (B: Bot, men: any[], p: number[], n = 2) => [...men].sort((a, b) => Math.hypot(a.char.pos[0] - p[0], a.char.pos[2] - p[2]) - Math.hypot(b.char.pos[0] - p[0], b.char.pos[2] - p[2])).slice(0, n);
const setOn = (B: Bot, doors: string[]) => doors.every(d => squad(B).some(m => stackedOn(B, m) === d)) && squad(B).filter(m => stackedOn(B, m) !== null).every(m => O(B).of(m)?.arrived);
/** the word, once every stack stands on its door; again while the room is not theirs */
function word(B: Bot, doors: string[], room: string) {
  if (!B.until(() => setOn(B, doors) || cleared(B, room), 60)) B.say('  the stacks never all stood on their doors: the word anyway');
  if (cleared(B, room)) { if (!ALONE) B.fail(`${room} fell before the word: a stack went in without it, and nothing of the word could be measured`); return; }
  // ONE press: every chain that waited on the word is through its door after it (the wrong plan has one chain, and may press again)
  B.wait(0.4); const waited = P(B).chains.filter((c: any) => c.phase === 'wait').length;
  const stacks: Record<string, any[]> = {}; for (const d of doors) stacks[d] = squad(B).filter(m => stackedOn(B, m) === d);
  B.press('KeyF', 3); B.step(6);
  const still = P(B).chains.filter((c: any) => c.phase === 'wait').length;
  if (!ALONE && (waited < doors.length || still)) B.fail(`one word did not send every stack: ${waited} chains waited on it (${doors.length} doors), ${still} still wait after it`);
  // what the word did, said (a player's tape, 10-22: one stack was in and done before the other opened its door, and the late stack's can went off on the first):
  // when the first man of each stack was inside the room, and the teammates dazzled after the word (nobody on the other side throws anything here: a dazzled teammate is the team's own can)
  const t0 = B.t(), inAt: Record<string, number> = {}, daz0 = new Map(squad(B).map(m => [m, m.dazzledUntil as number])), hit = new Set<string>();
  const R = B.g.roomClear.rooms.find((r: any) => r.def.id === room)?.def.bounds, inside = (m: any) => !!R && m.char.pos[0] > R.x0 + 0.2 && m.char.pos[0] < R.x1 - 0.2 && m.char.pos[2] > R.z0 + 0.2 && m.char.pos[2] < R.z1 - 0.2;
  const watch = () => { for (const d of doors) if (!(d in inAt) && (stacks[d] ?? []).some(inside)) inAt[d] = B.t() - t0; for (const [m, u] of daz0) if (m.dazzledUntil > u + 1e-6) hit.add(m.callsign); return false; };
  B.until(() => watch() || cleared(B, room), 40); for (let i = 0; i < 180; i++) { watch(); B.step(); }
  // (a stack that never went in has no time: nothing is said of how far apart they were, and the run FAILS — every stack through its door is the mission's own
  //  claim, whatever the squad's entry rules are)
  const ts = doors.map(d => inAt[d]), out = doors.filter((_, i) => ts[i] === undefined), apart = doors.length > 1 && !out.length ? Math.max(...ts) - Math.min(...ts) : NaN;
  const said = `the word at ${room}: ${doors.map((d, i) => `${d} ${ts[i] === undefined ? 'NOBODY IN' : `first man in at ${ts[i].toFixed(1)} s`}`).join(' · ')}${doors.length < 2 ? '' : out.length ? ' · not together: a stack never went in' : ` · ${apart.toFixed(1)} s apart`} · teammates dazzled as they went in: ${hit.size}${hit.size ? ` (${[...hit].join(', ')})` : ''}`;
  if (!ALONE && (out.length || (!LOOSE && CMDRING.planOne && DOORTOOLS.tossMate && (apart > 1 || hit.size)))) B.fail(said);
  B.say(`  ${said}`);
  for (let k = 0; k < 2 && !cleared(B, room); k++) { B.wait(0.6); B.press('KeyF', 3); B.until(() => cleared(B, room), 40); }
}
/** THE DIGITS, as the lines teach them: the first digit pressed picks that man alone, each one after it with Shift held adds its man. The men picked must
 *  be those men of the squad's own order and nobody else — a digit the frame dropped, or one that reached a slot, fails here */
function digits(B: Bot, ...ds: number[]) {
  modeUp(B); const slot = B.g.player.slot;
  ds.forEach((d, i) => { if (!i) B.press(`Digit${d}`, 3); else { B.hold(['ShiftLeft'], 2 / 60); B.I.pressed.add(`Digit${d}`); B.hold(['ShiftLeft', `Digit${d}`], 2 / 60); B.hold(['ShiftLeft'], 2 / 60); B.step(2); } });
  const want: any[] = ds.map(d => O(B).squad()[d - 1]), got: any[] = O(B).recipients();
  if (got.length !== want.length || !want.every(m => got.includes(m))) B.fail(`the digits ${ds.join(', then Shift + ')} picked ${got.map(m => m.callsign).join(', ') || 'nobody'}, not ${want.map(m => m?.callsign).join(', ')}`);
  if (B.g.player.slot !== slot) B.fail(`a digit pressed in plan mode changed what the parked player holds: ${slot} to ${B.g.player.slot}`);
}
/** [5]: everyone is picked again */
function allAgain(B: Bot) {
  modeUp(B); B.press('Digit5', 3);
  if (O(B).recipients().length !== squad(B).length) B.fail(`[5] picked ${O(B).recipients().length} of ${squad(B).length}`);
}
let pairA: any[] = [];
/** a place and a way to face, given: EVERY man of the pair took the way to face (the same tape: one of the two was put behind a corner where the order had
 *  no line for him, and he stood looking at a wall). On the mark that is the level's to keep (`must`); off it, it is said */
function facing(B: Bot, men: any[], where: string, must: boolean) {
  const has = () => men.every(m => O(B).of(m)?.order === 'cover'); if (!has()) B.until(has, 6);
  const told = men.map(m => `${m.callsign} (${m.char.pos[0].toFixed(1)}, ${m.char.pos[2].toFixed(1)}) ${O(B).of(m)?.order === 'cover' ? 'faces that way' : `does not: ${O(B).of(m)?.order ?? 'no order'}`}`).join(' · ');
  if (!has() && must) B.fail(`${where}: a man sent there with a way to face did not take it — ${told}`);
  B.say(`  ${where}: ${told}`);
}
/** what the hall cost, said: the script's own notes for it and the teammates the frame spared a down */
function told(B: Bot, n0: number) {
  const notes = (B.g.director.log as { kind: string; what: string }[]).filter(r => r.kind === 'note' && /hall|stack|plan|gun/.test(r.what) && !r.what.startsWith('signal:lesson')).map(r => r.what);
  B.say(`  the hall: ${notes.join(' · ') || '(no note)'} · teammates put on a knee: ${(B.g.rails.log as string[]).slice(n0).filter(l => l.includes('spared')).length}`);
}

/** the three authored checkpoints, each written as its step came up (the page's stand: a squad's run is kept in memory there, and nowhere on the frozen one) */
function checkpoints(B: Bot) {
  const wrote = ['the gate', 'the hall', 'the gates'].filter(n => B.g.saves.log.some((l: { what: string }) => l.what.includes(`: ${n} (in memory)`)));
  if (process.env.TPS_PROFILE === 'shipped' && wrote.length !== 3) B.fail(`authored checkpoints written: ${wrote.join(' · ') || 'none'} of three (${B.g.saves.log.slice(-6).map((l: { what: string }) => l.what).join(' | ')})`);
  B.say(`  authored checkpoints written: ${wrote.join(' · ') || "none (this stand keeps no save of a squad's run)"}`);
}
/** the checkpoint 'the gates', LOADED as its step comes up and before anything is done: the same step must be up, the script's program running again, the men
 *  outside in its hand, both gates shut and locked — and the mode up again at once (a save put back takes it down: the seat puts it up on the next tick) */
function putBack(B: Bot) {
  B.step(3); const slot = B.g.saves.slots().find((x: { label: string }) => x.label === 'the gates');
  if (!slot) { if (process.env.TPS_PROFILE === 'shipped') B.fail(`no checkpoint 'the gates' was written as its step came up (slots: ${B.g.saves.slots().map((x: { label: string }) => x.label).join(' · ') || 'none'})`); return; }
  const i = B.g.lesson.i; B.wait(1.0); const why = B.g.saves.load(B.g, slot.key); B.step(4);
  const held = ['Tango 5', 'Tango 6', 'Tango 7', 'Tango 8'].map(cs => (B.g.guards as any[]).find(x => x.callsign === cs)).filter(x => x && x.state !== 'dead'), gates = [B.door('gate_e'), B.door('gate_n')];
  if (why || B.g.lesson.i !== i || B.g.director.running !== 'tutorial' || held.length !== 4 || !held.every(x => x.script) || !gates.every(d => d.locked && d.isClosed()))
    B.fail(`the checkpoint 'the gates' did not come back whole: ${why ?? ''} step ${B.g.lesson.i + 1} (was ${i + 1}), program ${B.g.director.running}, the men outside in hand ${held.filter(x => x.script).length} of ${held.length}, gates locked ${gates.map(d => d.locked)}`);
  if (!P(B).up) B.fail("after the checkpoint 'the gates' was put back plan mode is down: the seat holds it up");
  B.say("  loaded the checkpoint 'the gates': the same step, the script running again, the four outside held, both gates shut, plan mode up");
}
export const steps: Record<string, (B: Bot) => void> = {
  view: B => { seatAsked = 0; modeUp(B); viewTo(B, 'view'); },
  send: B => { rclick(B, WALL); B.until(() => B.g.lesson.step?.id !== 'send', 40); B.wait(1.5); },
  pick: B => { seat(B, 'with the squad at the guardroom wall'); digits(B, 1, 2); },
  door1: B => { rdoor(B, 'guard'); },
  pick2: B => { const d = free(B).map(m => O(B).squad().indexOf(m) + 1); digits(B, ...d); },   // ("the other two": whoever is on no door, by their own numbers)
  door2: B => { rdoor(B, 'guard_side'); B.until(() => B.g.lesson.step?.id !== 'door2', 60); },
  all: B => allAgain(B),
  word: B => { word(B, ['guard', 'guard_side'], 'guardroom'); B.wait(1.5); },
  hall: B => viewTo(B, 'hall'),
  front: B => { if (ALONE) { allAgain(B); rdoor(B, 'hall'); return; } boxMen(B, twoOf(B, [26, 0, 12])); rdoor(B, 'hall'); },
  back: B => { if (ALONE) { B.until(() => setOn(B, ['hall']), 60); const n0 = B.g.rails.log.length; word(B, ['hall'], 'hall'); told(B, n0); return; } boxMen(B, free(B)); rdoor(B, 'hall_back'); B.until(() => B.g.lesson.step?.id !== 'back', 70); },
  all2: B => allAgain(B),
  word2: B => { const n0 = B.g.rails.log.length; word(B, ['hall', 'hall_back'], 'hall'); told(B, n0); B.wait(1.5); },
  gates: B => { putBack(B); viewTo(B, 'gates'); },
  faceA: B => { pairA = twoOf(B, POST_A); boxMen(B, pairA); rdrag(B, POST_A, GATE_E); B.until(() => B.g.lesson.step?.id !== 'faceA', 60); facing(B, pairA, 'the bags', true); },
  faceB: B => { const men = squad(B).filter(m => !pairA.includes(m)); boxMen(B, men); rdrag(B, POSTB ?? POST_B, GATE_N); B.until(() => B.g.lesson.step?.id !== 'faceB', 60); facing(B, men, 'the barrier', !POSTB); },
  hold: B => { checkpoints(B); seat(B, 'with both gates covered'); if (seatAsked !== 2) B.fail(`the seat was asked ${seatAsked} times, not twice`); B.until(() => (cleared(B, 'road') && cleared(B, 'lane')) || B.g.lesson.finished, 120); B.wait(1); },
};
