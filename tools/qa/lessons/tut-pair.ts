// The scripted player for the tutorial's quiet mission for two (levels/tut-pair.json; tools/qa/lesson-run.ts runs it): what each line asks, through the input
// only — walks to the marks the level shows, the cursor on a man, on the ground or on the fuse box, one-frame presses of the squad's key and the word, a tap
// of the interaction key, the right button. Game state is READ to time a press (the partner set, a man down), never the lesson's.
// THE STAND: the mission teaches the page's rules — the right button on a held man (game/close.ts), a teammate sent to work a thing (game/workthings.ts).
// The shipped stand has both on by itself; the frozen stand pins them off while the game is stood up, so the FIRST statement of the first step turns them
// on (nothing has been pressed yet).
import type { Bot } from '../lesson-run';
import { CLOSE } from '../../../src/game/close';
import { WORK } from '../../../src/game/workthings';
import { TP } from '../../levels/tut-pair';

export const query = '?quiet&squad=1';
// the moon on his meter (lesson-run's --moon): the CPU's light estimate leaves it out
export const mode = { moon: true };
/** its steps are a tutorial mission's (game/rails.ts): TPS_RAILS=1 on the frozen stand, or the shipped stand */
export const needs = 'rails';

interface Target { kind: string; man?: unknown; foe?: unknown }
const REACT = Number((globalThis as any).process?.env?.TPS_REACT ?? 0.6);
const flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const at = (p: ArrayLike<number>) => `${p[0].toFixed(1)}, ${p[2].toFixed(1)}`;
const lit = (B: Bot) => B.g.player.visibility.toFixed(2);
const mate = (B: Bot) => B.g.guards.find((x: any) => x.unit && x.team === 'operative');
const man = (B: Bot, route: string) => B.g.guards.find((x: any) => !x.unit && B.g.level.routes[x.routeI]?.name === route);
const chest = (h: any): number[] => [h.char.pos[0], 1.2, h.char.pos[2]];
const under = (B: Bot): Target => B.g.orders.targetUnder(B.I, B.cam, B.W.canvas);
const last = (B: Bot) => { const l = B.g.orders.log; return l.length ? l[l.length - 1] : null; };
/** how many times the shift has had eyes on the pair so far (the chronicle's own rows) */
const seen = (B: Bot): number => B.g.chronicle.events.filter((e: any) => e.kind === 'spotted' || e.kind === 'contact').length;
function calm(B: Bot, n0: number, where: string) {
  const up = B.g.guards.filter((x: any) => !x.unit && x.state !== 'dead' && x.state !== 'patrol' && !x.held);
  if (seen(B) > n0 || up.length) B.fail(`the pair was noticed ${where} (${up.map((x: any) => `${x.callsign} ${x.state}`).join(', ') || 'a sighting'})`);
}
/** the spot `d` metres straight behind a man, as he faces now */
const behind = (gd: any, d: number): number[] => { const p = gd.char.pos, y = gd.char.bodyYaw; return [p[0] - Math.sin(y) * d, 0, p[2] - Math.cos(y) * d]; };
/** crouched up to a standing man's back, the last strides straight at him; true once in reach behind him */
function closeIn(B: Bot, gd: any): boolean {
  B.crouch(true);
  B.go(behind(gd, 1.6), 20, { near: 0.25 });
  B.nudge(behind(gd, 0.8), 6, () => flat(B.pos(), gd.char.pos) < 0.92);
  B.step(6);
  return flat(B.pos(), gd.char.pos) < 1.05;
}
/** the interaction key, TAPPED: the row the line means has to be the lit one */
function tap(B: Bot, kind: string, verb: string, aim?: number[]): boolean {
  const has = () => B.g.nearby.some((r: any) => r.kind === kind && r.verb === verb && r.inReach !== false);
  for (let i = 0; i < 60 && !has(); i++) { if (aim) B.aim(aim); B.step(); }
  const row = B.g.nearby[B.g.player.nearSel];
  if (has() && row && (row.kind !== kind || row.verb !== verb)) B.fail(`a tap of the interaction key here does '${row.verb}', and the line means '${verb}'`);
  return B.verb(kind, verb, aim);
}
/** the squad's key, tapped with the cursor on a man of theirs: the partner is given him */
function onMan(B: Bot, gd: any) {
  B.wait(0.4);
  B.aim(chest(gd)); B.step(2); B.aim(chest(gd));
  const t = under(B); if (t.kind !== 'foe') B.fail(`the cursor on ${gd.callsign} is on '${t.kind}', not on him (is he in view from ${at(B.pos())}?)`);
  B.press('KeyB', 4);
  const l = last(B); if (l?.order !== 'pairMark' || l.target !== `foe:${gd.callsign}`) B.fail(`the squad's key on ${gd.callsign} gave ${l ? `${l.order} on ${l.target}` : 'nothing'}`);
  B.say(`  the squad's key on ${gd.callsign}: ${l.order}`);
}
/** …with the cursor on bare ground beside him: the partner comes back */
function onGround(B: Bot) {
  B.wait(0.3);
  const me = B.pos(), n = B.g.orders.log.length;
  for (const r of [1.4, 2, 2.6]) for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4; B.aim([me[0] + r * Math.cos(a), 0.05, me[2] + r * Math.sin(a)]); B.step();
    const t = under(B); if (t.kind !== 'floor' || t.man) continue;
    B.press('KeyB', 4);
    const l = last(B); if (B.g.orders.log.length === n || l?.order !== 'fallIn') B.fail(`the squad's key on the ground gave ${B.g.orders.log.length === n ? 'nothing' : `${l.order} on ${l.target}`}`);
    B.say(`  the squad's key on the ground: ${l.order}`); return;
  }
  B.fail(`the cursor finds no bare ground beside the player at ${at(me)}`);
}
function together(B: Bot, by: number, secs: number, what: string) { if (!B.until(() => flat(mate(B).char.pos, B.pos()) < by, secs)) B.fail(`the partner did not ${what} (${B.g.orders.statusOf(mate(B))}, ${flat(mate(B).char.pos, B.pos()).toFixed(1)} m off)`); }
function waitSet(B: Bot, gd: any) {
  const m = mate(B), n0 = seen(B), t0 = B.t();
  if (!B.until(() => !!B.g.pair.jobOf(m)?.set || gd.state === 'dead', 70)) B.fail(`the partner never got set behind ${gd.callsign} (${B.g.orders.statusOf(m)}, at ${at(m.char.pos)})`);
  B.say(`  "set" ${(B.t() - t0).toFixed(1)} s on: the partner at ${at(m.char.pos)}, ${flat(m.char.pos, gd.char.pos).toFixed(2)} m from ${gd.callsign} (he stands at ${at(gd.char.pos)}, facing ${gd.char.bodyYaw.toFixed(2)})`);
  calm(B, n0, `while the partner worked round to ${gd.callsign}`);
}

export const steps: Record<string, (B: Bot) => void> = {
  crouch: B => { CLOSE.on = true; WORK.on = true; B.say(`  at the start: lit ${lit(B)}; the partner ${flat(mate(B).char.pos, B.pos()).toFixed(1)} m off`); B.crouch(true); },
  // a few strides in, the partner behind
  lead: B => { const n0 = seen(B); B.go(TP.first, 20, { near: 0.3 }); together(B, 4.2, 20, 'follow to the first mark'); B.wait(0.5); B.say(`  on the first mark: lit ${lit(B)}; the partner at ${mate(B).char.pos[0].toFixed(1)}, ${mate(B).char.pos[2].toFixed(1)} (${B.g.orders.statusOf(mate(B))})`);
    B.say(`  at the first mark: lit ${lit(B)}; the partner ${mate(B).char.crouch || mate(B).crouch ? 'low' : 'standing'}`); calm(B, n0, 'on the way to the first mark'); },
  mark: B => { onMan(B, man(B, 'pickup')); },
  set: B => { waitSet(B, man(B, 'pickup')); },
  word: B => { const A = man(B, 'pickup'), n0 = seen(B);
    B.wait(REACT); B.press('KeyF');
    if (!B.until(() => A.state === 'dead', 15)) B.fail(`the word was given and ${A.callsign} is still up (${B.g.orders.statusOf(mate(B))})`);
    B.wait(1); calm(B, n0, 'when the first man went down'); },
  back: B => { onGround(B); together(B, 2.6, 30, 'come back'); B.wait(0.4); },
  // to the gap: both men of the truck park in view through it
  gap: B => { const n0 = seen(B); B.crouch(true); B.go(TP.gap, 20, { near: 0.3 }); B.wait(0.4); B.say(`  at the gap: lit ${lit(B)}; the partner at ${at(mate(B).char.pos)} (${B.g.orders.statusOf(mate(B))})`); calm(B, n0, 'at the gap'); },
  far: B => { onMan(B, man(B, 'far')); B.wait(1.5); B.say(`  1.5 s on: the partner at ${at(mate(B).char.pos)} (${B.g.orders.statusOf(mate(B))})`); },
  // through the gap to the near man's back, a stride off, and there until the partner is set behind the far one
  near: B => { const n0 = seen(B); B.go(TP.behindB, 15, { near: 0.2 }); B.say(`  behind the near man: lit ${lit(B)}, ${flat(B.pos(), man(B, 'near').char.pos).toFixed(2)} m off`);
    waitSet(B, man(B, 'far')); calm(B, n0, 'behind the near man'); },
  // the grab is the signal: the partner's man drops on the same beat
  hands: B => { const b = man(B, 'near'), c = man(B, 'far');
    B.wait(REACT);
    if (!closeIn(B, b)) B.fail(`could not get behind the near man (${flat(B.pos(), b.char.pos).toFixed(2)} m off, ${b.state})`);
    if (!tap(B, 'guard', 'grab', [b.char.pos[0], 1.35, b.char.pos[2]])) B.fail('no grab row behind the near man');
    const t0 = B.t();
    if (!B.until(() => c.state === 'dead', 15)) B.fail(`the grab did not send the partner (${B.g.orders.statusOf(mate(B))})`);
    B.say(`  the far man down ${(B.t() - t0).toFixed(1)} s after the grab; the near man ${B.g.player.holding ? 'in the arm' : `NOT held (${b.state})`}`);
    if (b.state === 'alert') B.fail('the near man was roused by the double'); },
  sleep: B => { const b = man(B, 'near');
    if (CLOSE.heldClicks) B.click(2); else if (!B.verb('held', 'choke')) B.fail('no choke row with a man held');
    if (!B.until(() => b.state === 'dead' && !B.g.player.holding, 15)) B.fail('the held man did not go out'); B.wait(0.6); },
  // the partner called in, round the second wall's end to the office yard's dark corner
  past: B => { const n0 = seen(B); onGround(B); B.crouch(true); B.go(TP.round, 40); B.go(TP.past, 30, { near: 0.3 }); together(B, 4.2, 30, 'come along past the wall');
    B.say(`  past the wall: lit ${lit(B)}; ${man(B, 'gate').callsign} ${man(B, 'gate').state}, ${flat(B.pos(), man(B, 'gate').char.pos).toFixed(1)} m off`); calm(B, n0, 'coming into the office yard'); },
  hold: B => { const d = man(B, 'gate'), n0 = seen(B);
    if (!closeIn(B, d)) B.fail(`could not get behind the man at the far gate (${flat(B.pos(), d.char.pos).toFixed(2)} m off, he stands at ${at(d.char.pos)}, ${d.state})`);
    calm(B, n0, 'coming up behind the man at the far gate');
    if (!tap(B, 'guard', 'grab', [d.char.pos[0], 1.35, d.char.pos[2]])) B.fail('no grab row behind the man at the far gate');
    if (!B.until(() => B.g.player.holding?.phase === 'held', 4)) B.fail('the grab did not take'); },
  ask: B => { const P = B.g.player; let n = 0;
    for (; n < 8 && !P.codes.has('pad_office'); n++) { if (!tap(B, 'held', 'question')) B.fail('no question row with a man held'); B.until(() => P.codes.has('pad_office'), 5); }
    if (!P.codes.has('pad_office')) B.fail('eight questions and no code'); B.say(`  the code after ${n} question(s)`); },
  // the squad's key on the fuse box, with the man still in his arm
  box: B => { const P = B.g.player;
    if (!P.holding) B.fail('nobody in his arm at the fuse box line');
    B.wait(0.3); B.aim(TP.box); B.step(2); B.aim(TP.box); B.press('KeyB', 4);
    const l = last(B); if (l?.order !== 'work') B.fail(`the squad's key on the fuse box gave ${l ? `${l.order} on ${l.target}` : 'nothing'}`);
    B.say(`  the squad's key on the fuse box: ${l.order} on ${l.target}`); },
  lamps: B => { const t0 = B.t();
    if (!B.until(() => B.g.blackout.active, 40)) B.fail(`the partner did not throw the mains (${B.g.orders.statusOf(mate(B))}, at ${at(mate(B).char.pos)})`);
    B.say(`  the mains went ${(B.t() - t0).toFixed(1)} s after the order; the man ${B.g.player.holding ? 'still held' : 'NOT held'}`); },
  drop: B => { const d = man(B, 'gate');
    B.wait(REACT);
    if (CLOSE.heldClicks) B.click(2); else if (!B.verb('held', 'choke')) B.fail('no choke row with a man held');
    if (!B.until(() => d.state === 'dead' && !B.g.player.holding, 15)) B.fail('the held man did not go out'); B.wait(0.6);
    if (!B.g.blackout.active) B.fail('the mains came back'); },
  nv: B => { B.press('KeyN', 20); },
  code: B => { B.go(TP.padAt, 30, { near: 0.25, noDoors: true });
    if (!tap(B, 'door', 'code', [33.0, 1.0, 9.6])) B.fail(`no row to type the code (at ${at(B.pos())}; rows: ${B.g.nearby.map((r: any) => `${r.kind}:${r.verb}`).join(' ') || 'none'})`);
    if (!B.until(() => !B.door('office').locked || !B.door('office').isClosed(), 10)) B.fail('the office did not open to the code'); },
  take: B => { B.go([33.0, 0, 8.6], 20); B.go([TP.trunkFront[0] - 0.25, 0, TP.trunkFront[2]], 10, { near: 0.2 });
    if (!tap(B, 'objective', 'drive', TP.trunkFront)) B.fail('no row at the trunk'); B.until(() => B.g.mission.stage === 'exfil', 20); },
  out: B => { onGround(B); B.crouch(false); B.go([33.0, 0, 10.8], 20); B.go([37.0, 0, 18.0], 30); B.go([38.45, 0, 18.0], 20, { near: 0.2 }); },
};
/** on out by the far gate */
export function finish(B: Bot) { B.go([39.5, 0, 18.0], 30); }
