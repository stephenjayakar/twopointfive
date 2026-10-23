// The scripted player for the tutorial's plan mode mission (levels/tut-plan.json; tools/qa/lesson-run.ts runs it as the page opens it: a tutorial mission is
// always stood up on the shipped stand). He has no trigger here: Shift with the command key, the mode's own walk keys on the view, the left button dragged
// round men, the right button on a door or the floor (clicked, or dragged for a way to face), the word — and, from the first walk step on, the back key to
// put the mode away and the walk keys to the next marked spot. Game state is READ to time a press and to find where a thing is on the picture, never to do
// the deed. The spots and the points the view is asked to are the lesson's own, read from the level.
import type { Bot } from '../lesson-run';
import { CMDRING } from '../../../src/game/cmdring';
import { DOORTOOLS } from '../../../src/game/doortools';

export const query = '?roomclear=1&squad4';
/** the frozen stand's arm of the gate: the lines name the back key (Tab closes the mode) and every plan is laid inside the view held near him */
export const raises = { TPS_TABBACK: '1', TPS_PLANNEAR: '1' };
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

/** the mode up (Shift held over a tap of the command key), if it is not */
function modeUp(B: Bot) {
  if (P(B).up) return;
  B.hold(['ShiftLeft'], 2 / 60); B.I.pressed.add('KeyB'); B.hold(['ShiftLeft', 'KeyB'], 2 / 60); B.hold(['ShiftLeft'], 2 / 60); B.step(2);
  if (!P(B).up) B.fail('Shift + the command key did not put plan mode up');
}
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
  // (the view stays near him — planmode.ts planNear — so a place may stop short of the picture's middle; a place that cannot be brought ONTO the picture
  //  from where he stands is the mission's own break: a line asked for a click he cannot make from the spot it walked him to)
  reach(B);
  const off = ps.filter(p => { const [x, y] = px(B, p); return x < 40 || x > w - 40 || y < 40 || y > h - 40; });
  if (off.length) { const s = B.g.player.char.pos; B.fail(`from (${s[0].toFixed(1)}, ${s[2].toFixed(1)}) the view cannot bring ${off.map(p => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`).join(' and ')} onto the picture`); }
  B.step(30);
}
/** THE VIEW STAYS NEAR HIM (cmdring.ts `planNear`, the squad's own rule; it holds only where the frame leaves him his feet — planmode.ts planNear): how far
 *  the view's point has been from him is kept, said at the end, and the run fails when the rule is on and the view went further than its box's far corner */
let far = 0, downs: string[] = [];
/** he has no trigger here: a spot the mission walks him to is one no round puts him down on (one round does: asked after each walk, before a checkpoint is put back over it, and at the end) */
function up(B: Bot, when: string) { if (B.g.player.down && !downs.includes(when)) downs.push(when); }
function reach(B: Bot) { const L = P(B).look, s = B.g.player.char.pos; if (P(B).up && L) far = Math.max(far, Math.hypot(L[0] - s[0], L[2] - s[2])); }
function reached(B: Bot) {
  const K = CMDRING as any, on = !!K.planNear, corner = Math.hypot(K.planNearSideM ?? 0, Math.max(K.planNearAwayM ?? 0, K.planNearBackM ?? 0)), held = on && !B.g.rails.locks('move');
  if (on && !held) B.fail("the view's rule is on and does not hold here: the frame has taken his feet (planmode.ts planNear)");
  if (held && far > corner + 0.3) B.fail(`the view went ${far.toFixed(1)} m from him: its box's far corner is ${corner.toFixed(1)} m`);
  up(B, 'at the end'); if (downs.length) B.fail(`a round put him down on a spot the lines walked him to: ${downs.join(' · ')}`);
  B.say('  he was never put down on his spots (asked after each walk, before the checkpoint is put back, and at the end)');
  B.say(`  the view's point was never more than ${far.toFixed(1)} m from him (the view held near him: ${held ? `on, a box whose far corner is ${corner.toFixed(1)} m` : 'off'})`);
}
/** a step of the lesson by its id · the place its mark stands on · the point its view test wants the view near */
const stepOf = (B: Bot, id: string): any => (B.g.level.scenarios.lesson.steps as any[]).find(T => T.id === id);
const find = (t: any, is: string): any => !t ? null : t.is === is ? t : (t.of ?? []).map((x: any) => find(x, is)).find(Boolean) ?? null;
/** the mode's walk keys until the step that asks for the view is done: toward the point its own test names */
function viewTo(B: Bot, id: string) {
  const at: number[] = find(stepOf(B, id).done, 'planView').at; panTo(B, at);
  for (let i = 0; i < 300 && B.g.lesson.step?.id === id; i++) { const L = P(B).look, k = [L[0] < at[0] - 0.4 ? 'KeyD' : L[0] > at[0] + 0.4 ? 'KeyA' : '', L[2] < at[2] - 0.4 ? 'KeyS' : L[2] > at[2] + 0.4 ? 'KeyW' : ''].filter(Boolean); if (k.length) B.hold(k, 2 / 60); else B.step(); reach(B); }
}
/** the mode put away with the back key, and the walk keys to the spot the step marks: in the mode they are the view's */
function walkTo(B: Bot, id: string, what: string) {
  const at = stepOf(B, id).at as number[], p = [at[0], 0, at[2]];
  if (P(B).up) { B.press('Tab', 3); if (P(B).up) B.fail('the back key did not put plan mode away'); }
  // (the mode down, the view comes back to him: where the ring he is asked to walk to is then. Off the picture, the page pins the step's mark to the
  //  picture's edge on that side with the metres to it — ui/overlay.ts, the objective's mark — and that it does is the page run's to see)
  B.wait(1.2); const [x, y] = px(B, p), w = B.W.canvas.clientWidth, h = B.W.canvas.clientHeight, edge = Math.min(x, y, w - x, h - y);
  if (B.g.objectivePos?.() && Math.hypot(B.g.objectivePos()[0] - p[0], B.g.objectivePos()[2] - p[2]) > 0.1) B.fail(`${what}: the step's mark is not the place the walk is to`);
  const s0 = [...B.g.player.char.pos], t0 = B.t();
  if (!B.go(p, 40, { noDoors: true, near: 0.5 })) B.fail(`he did not walk to ${what}: stopped at (${B.g.player.char.pos[0].toFixed(1)}, ${B.g.player.char.pos[2].toFixed(1)})`);
  up(B, `at ${what}`);
  B.say(`  walked ${Math.hypot(p[0] - s0[0], p[2] - s0[2]).toFixed(1)} m to ${what} in ${(B.t() - t0).toFixed(1)} s (when he closed the mode its ring was ${edge >= 0 ? `${edge.toFixed(0)} px inside the picture` : `${(-edge).toFixed(0)} px past the picture's edge: the mark pinned to the edge points the way`})`);
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
/** a left click on bare ground in the yard's middle: everyone is picked again */
function allAgain(B: Bot) {
  const at = [20, 0, 15]; panTo(B, at); cursor(B, px(B, at)); B.step(2); B.I.clicked |= 1; B.I.buttons |= 1; B.step(); B.I.buttons &= ~1; B.step(3);
  if (O(B).recipients().length !== squad(B).length) B.fail(`a left click on bare ground picked ${O(B).recipients().length} of ${squad(B).length}`);
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
 *  outside in its hand, both gates shut and locked, the mode put down (a plan nobody finished laying is not kept) */
function putBack(B: Bot) {
  B.step(3); const slot = B.g.saves.slots().find((x: { label: string }) => x.label === 'the gates');
  if (!slot) { if (process.env.TPS_PROFILE === 'shipped') B.fail(`no checkpoint 'the gates' was written as its step came up (slots: ${B.g.saves.slots().map((x: { label: string }) => x.label).join(' · ') || 'none'})`); return; }
  const i = B.g.lesson.i; B.wait(1.0); const why = B.g.saves.load(B.g, slot.key); B.step(4);
  const held = ['Tango 5', 'Tango 6', 'Tango 7', 'Tango 8'].map(cs => (B.g.guards as any[]).find(x => x.callsign === cs)).filter(x => x && x.state !== 'dead'), gates = [B.door('gate_e'), B.door('gate_n')];
  if (why || B.g.lesson.i !== i || B.g.director.running !== 'tutorial' || held.length !== 4 || !held.every(x => x.script) || !gates.every(d => d.locked && d.isClosed()))
    B.fail(`the checkpoint 'the gates' did not come back whole: ${why ?? ''} step ${B.g.lesson.i + 1} (was ${i + 1}), program ${B.g.director.running}, the men outside in hand ${held.filter(x => x.script).length} of ${held.length}, gates locked ${gates.map(d => d.locked)}`);
  B.say(`  loaded the checkpoint 'the gates': the same step, the script running again, the four outside held, both gates shut (plan mode ${P(B).up ? 'still up' : 'down'})`);
}
export const steps: Record<string, (B: Bot) => void> = {
  mode: B => { far = 0; downs = []; modeUp(B); },
  view: B => viewTo(B, 'view'),
  send: B => { rclick(B, WALL); B.until(() => B.g.lesson.step?.id !== 'send', 40); B.wait(1.5); },
  up1: B => walkTo(B, 'up1', 'the spot behind his squad'),
  pick: B => { boxMen(B, twoOf(B, [16, 0, 12])); },
  door1: B => { rdoor(B, 'guard'); },
  pick2: B => { boxMen(B, free(B)); },
  door2: B => { rdoor(B, 'guard_side'); B.until(() => B.g.lesson.step?.id !== 'door2', 60); },
  all: B => allAgain(B),
  word: B => { word(B, ['guard', 'guard_side'], 'guardroom'); B.wait(1.5); },
  up2: B => walkTo(B, 'up2', 'the spot beside the hall'),
  hall: B => viewTo(B, 'hall'),
  front: B => { if (ALONE) { allAgain(B); rdoor(B, 'hall'); return; } boxMen(B, twoOf(B, [26, 0, 12])); rdoor(B, 'hall'); },
  back: B => { if (ALONE) { B.until(() => setOn(B, ['hall']), 60); const n0 = B.g.rails.log.length; word(B, ['hall'], 'hall'); told(B, n0); return; } boxMen(B, free(B)); rdoor(B, 'hall_back'); B.until(() => B.g.lesson.step?.id !== 'back', 70); },
  all2: B => allAgain(B),
  word2: B => { const n0 = B.g.rails.log.length; word(B, ['hall', 'hall_back'], 'hall'); told(B, n0); B.wait(1.5); },
  up3: B => walkTo(B, 'up3', 'the spot in the hall'),
  gates: B => { up(B, 'in the hall, before its checkpoint is put back'); putBack(B); viewTo(B, 'gates'); },
  faceA: B => { pairA = twoOf(B, POST_A); boxMen(B, pairA); rdrag(B, POST_A, GATE_E); B.until(() => B.g.lesson.step?.id !== 'faceA', 60); facing(B, pairA, 'the bags', true); },
  faceB: B => { const men = squad(B).filter(m => !pairA.includes(m)); boxMen(B, men); rdrag(B, POSTB ?? POST_B, GATE_N); B.until(() => B.g.lesson.step?.id !== 'faceB', 60); facing(B, men, 'the barrier', !POSTB); },
  hold: B => { B.until(() => cleared(B, 'road') && cleared(B, 'lane'), 120); B.wait(1); },
  'back-in': B => { checkpoints(B); reached(B); modeUp(B); boxPx(B, [3, 3], [5, 5]); const s = B.g.player.char.pos; rclick(B, [s[0], 1.0, s[2]]); B.until(() => B.g.lesson.finished, 30); },
};
