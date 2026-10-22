// The scripted player for the tutorial's quiet mission (levels/tut-quiet.json; tools/qa/lesson-run.ts runs it): what each line asks, through the input only.
// THE STAND: the mission teaches the page's buttons (Left = the knife, Right = the knockout: the close-in mode, src/game/close.ts). The shipped stand has that
// mode on by itself; the frozen stand pins it off while the game is stood up, so the FIRST statement of the first step turns it on (nothing has been pressed yet;
// the same in both arms, lesson on / off).
import type { Bot } from '../lesson-run';
import { CLOSE } from '../../../src/game/close';
import { HANDRING } from '../../../src/game/handring';
import { TQ } from '../../levels/tut-quiet';

export const query = '?quiet';
// the moon on his meter (lesson-run's --moon): the CPU's light estimate leaves it out, and the lane is lit by nothing else
export const mode = { moon: true };

const ROUTES = ['hall', 'court', 'table'];
const man = (B: Bot, route: string) => B.g.guards.find((x: any) => x.route?.name === route) ?? B.g.guards[ROUTES.indexOf(route)];
/** how many times the shift has had eyes on him so far (the chronicle's own rows: a sighting, a man gone to alert) */
const seen = (B: Bot): number => B.g.chronicle.events.filter((e: any) => e.kind === 'spotted' || e.kind === 'contact').length;
/** a person's beat between seeing a man come through and moving */
export const needs = 'rails';
const REACT = Number((globalThis as any).process?.env?.TPS_REACT ?? 0.6);
const flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const at = (p: ArrayLike<number>) => `${p[0].toFixed(1)}, ${p[2].toFixed(1)}`;
const lit = (B: Bot) => B.g.player.visibility.toFixed(2);
/** the spot `d` metres straight behind a man, as he faces now */
const behind = (gd: any, d: number): number[] => { const p = gd.char.pos, y = gd.char.bodyYaw; return [p[0] - Math.sin(y) * d, 0, p[2] - Math.cos(y) * d]; };
/** he has stood still for `secs` */
function settled(B: Bot, gd: any, secs: number, max: number): boolean {
  let p = [...gd.char.pos], since = B.t();
  return B.until(() => { if (flat(gd.char.pos, p) > 0.05) { p = [...gd.char.pos]; since = B.t(); } return B.t() - since > secs; }, max);
}
/** crouched up to a standing man's back, the last strides straight at him; true once in reach behind him */
function closeIn(B: Bot, gd: any, via: number[] | null): boolean {
  B.crouch(true);
  if (via) B.go(via, 40);
  B.go(behind(gd, 1.6), 20, { near: 0.25 });
  B.nudge(behind(gd, 0.8), 6, () => flat(B.pos(), gd.char.pos) < 0.92);
  B.step(6);
  return flat(B.pos(), gd.char.pos) < 1.05;
}
/** Space, TAPPED: the row the line means has to be the lit one (a line here says 'Space', never 'hold it and choose') */
function tap(B: Bot, kind: string, verb: string, aim?: number[]): boolean {
  const has = () => B.g.nearby.some((r: any) => r.kind === kind && r.verb === verb && r.inReach !== false);
  for (let i = 0; i < 60 && !has(); i++) { if (aim) B.aim(aim); B.step(); }
  const lit = B.g.nearby[B.g.player.nearSel];
  if (has() && lit && (lit.kind !== kind || lit.verb !== verb)) B.fail(`a tap of Space here does '${lit.verb}', and the line means '${verb}'`);
  return B.verb(kind, verb, aim);
}
function unseen(B: Bot, n0: number, gd: any, where: string) { if (seen(B) > n0 || gd.state === 'alert') B.fail(`${gd.callsign} noticed the player ${where} (${gd.state}, aware ${gd.awareness.toFixed(2)})`); }

export const steps: Record<string, (B: Bot) => void> = {
  crouch: B => { CLOSE.on = true; B.say(`  at the start: lit ${lit(B)}`); B.crouch(true);
  },
  // out of the porch lamp's pool, round the house's corner into its shadow
  dark: B => { B.go([11.4, 0, 16.6], 20); B.go(TQ.dark, 20, { near: 0.3 }); B.wait(0.6); B.say(`  round the corner: lit ${lit(B)}`); },
  // along the house's wall, round the first buttress, to the whistle's mark: never out of its shadow
  creep: B => {
    const A = man(B, 'court'), n0 = seen(B); let worst = 0;
    const look = () => { worst = Math.max(worst, B.g.player.visibility); return false; };
    B.go([19.0, 0, 17.4], 40, { stop: look }); B.go(TQ.whistle, 10, { near: 0.2, stop: look });
    B.say(`  along the wall: the most light on him ${worst.toFixed(2)}; ${A.callsign} ${A.state}, aware ${A.awareness.toFixed(2)}, ${flat(B.pos(), A.char.pos).toFixed(1)} m off`);
    unseen(B, n0, A, 'in the lane');
  },
  // the whistle at the mark, a person's beat, then round the near end of the long wall to the lane's side of it, while he comes the long way round on the
  // house's side
  whistle: B => {
    const A = man(B, 'court'), n0 = seen(B);
    // (the page's way: the interaction key kept down puts the ring up, on open floor its one wedge is the whistle, and its digit does it; the frozen
    // stand's: the whistle's own key)
    if (HANDRING.on) { B.I.pressed.add('Space'); B.hold(['Space'], HANDRING.holdSecs + 0.1); if (!B.g.sel?.ring && !B.g.player.sel?.ring) B.fail('the interaction key kept down put no ring up'); B.press('Digit5', 0); } else B.press('KeyV', 0);
    const t0 = B.t();
    B.wait(REACT);
    B.go([22.7, 0, 19.1], 8, { near: 0.25 }); B.go(TQ.hide, 8, { near: 0.15 });
    B.say(`  behind the wall ${(B.t() - t0).toFixed(1)} s after the whistle: lit ${lit(B)}; ${A.callsign} ${A.state} at ${at(A.char.pos)}, going to ${A.lastKnown ? at(A.lastKnown) : '—'}`);
    if (A.state === 'patrol') B.fail(`the whistle moved nobody (${A.callsign} at ${at(A.char.pos)})`);
    unseen(B, n0, A, 'going behind the wall');
    (B as any).whistledAt = t0;
  },
  // nothing pressed while he walks the other side of the wall; once he stands where the sound was, a person's beat, round the wall's end, to his back
  grab: B => {
    const A = man(B, 'court'), n0 = seen(B), t0 = (B as any).whistledAt ?? B.t();
    let nearest = 99;
    const there = B.until(() => { nearest = Math.min(nearest, flat(B.pos(), A.char.pos)); return flat(A.char.pos, TQ.whistle) < 1.3 || A.state === 'alert' || A.state === 'patrol'; }, 30);
    B.say(`  ${A.callsign} passed ${nearest.toFixed(2)} m off; ${there ? 'he is' : 'he never got'} at the mark ${(B.t() - t0).toFixed(1)} s after the whistle (${at(A.char.pos)}, ${A.state}); lit ${lit(B)}`);
    unseen(B, n0, A, 'behind the wall');
    if (!there || A.state === 'patrol') B.fail(`${A.callsign} was not there to be taken (${A.state}, at ${at(A.char.pos)})`);
    settled(B, A, 0.3, 3);
    B.wait(REACT);
    B.go([22.75, 0, 19.0], 8, { near: 0.25 });
    B.say(`  at the wall's end: ${A.callsign} at ${at(A.char.pos)}, facing ${A.char.bodyYaw.toFixed(2)}, ${A.state}, ${flat(B.pos(), A.char.pos).toFixed(1)} m off`);
    if (!closeIn(B, A, null)) B.fail(`could not get behind the first man (${flat(B.pos(), A.char.pos).toFixed(2)} m off, he stands at ${at(A.char.pos)}, ${A.state})`);
    unseen(B, n0, A, 'coming up behind him');
    if (!tap(B, 'guard', 'grab', [A.char.pos[0], 1.35, A.char.pos[2]])) B.fail('no grab row behind the first man');
    if (!B.until(() => B.g.player.holding?.phase === 'held', 4)) B.fail('the grab did not take');
    B.say(`  held ${(B.t() - t0).toFixed(1)} s after the whistle`);
  },
  ask: B => {
    const P = B.g.player;
    for (let i = 0; i < 8 && !P.codes.has('pad_strong'); i++) { if (!tap(B, 'held', 'question')) B.fail('no question row with a man held'); B.until(() => P.codes.has('pad_strong'), 5); }
    if (!P.codes.has('pad_strong')) B.fail('eight questions and no code');
  },
  drop: B => { const A = man(B, 'court'); if (CLOSE.heldClicks) B.click(2); else if (!B.verb('held', 'choke'))   // (the frozen stand has no buttons for a held man: the list's second row)
      B.fail('no choke row with a man held');
    if (!B.until(() => A.state === 'dead', 15)) B.fail('the choke did not put him out'); B.wait(1); },
  // through the gap into the back court, to the door under its lamp
  pick: B => {
    B.crouch(true); B.go([24.6, 0, 17.5], 20); B.go([26.4, 0, 17.5], 10); B.go(TQ.backDoor, 15, { near: 0.2 });
    B.say(`  at the back door: lit ${lit(B)}`);
    // a stray left click here, nobody in an arm and nobody in reach: the button is on since the last step, and it must do nothing a man could hear
    { const P = B.g.player, shots = () => (P.rifle?.shotsFired ?? 0) + (P.pistol?.shotsFired ?? 0), n = shots(); B.click(1, [26.0, 0, 18.6]); B.step(20);
      if (shots() > n || !P.holstered) B.fail(`a stray left click at the lock ${shots() > n ? 'fired a round' : 'drew the gun'}`);
      B.say(`  a stray left click: no round fired (${P.holstered ? 'holstered' : 'in hand'}; ${n} fired so far)`); }
    if (!tap(B, 'door', 'pick', [27.9, 1.0, 16.5])) B.fail('no row to pick the back door');
    if (!B.until(() => !B.door('back').locked, 14)) B.fail('the back door did not pick');
  },
  nook: B => {
    const H = man(B, 'hall'), n0 = seen(B);
    if (!B.openDoor('back')) B.fail('the back door did not open');
    B.until(() => !B.door('back').isClosed(), 4);
    B.go([27.9, 0, 15.7], 15); B.go(TQ.nook, 10, { near: 0.12 }); B.wait(0.4);
    B.say(`  in the corner: lit ${lit(B)}; ${H.callsign} ${H.state}, aware ${H.awareness.toFixed(2)}, ${flat(B.pos(), H.char.pos).toFixed(1)} m off`);
    unseen(B, n0, H, 'coming into the store');
  },
  // out of the dark, through the doorway into the hall's light at his back, on a knee the whole way: the LEFT button
  strike: B => {
    const H = man(B, 'hall'), n0 = seen(B);
    B.say(`  ${H.callsign} ${H.state} at ${at(H.char.pos)}, facing ${H.char.bodyYaw.toFixed(2)}`);
    if (!closeIn(B, H, [26.3, 0, 12.9])) B.fail(`could not get behind the hall's man (${flat(B.pos(), H.char.pos).toFixed(2)} m off, he stands at ${at(H.char.pos)}, ${H.state})`);
    B.say(`  at his back: lit ${lit(B)}; he ${H.state}, aware ${H.awareness.toFixed(2)}`);
    unseen(B, n0, H, 'coming up behind him in the light');
    B.click(1);
    if (!B.until(() => H.state === 'dead', 4)) B.fail(`the left button did not put the hall's man down (${flat(B.pos(), H.char.pos).toFixed(2)} m off, ${H.state})`);
    B.wait(1);
    const up = B.g.guards.filter((x: any) => x.state !== 'dead' && x.state !== 'patrol');
    if (up.length) B.fail(`${up.map((x: any) => `${x.callsign} ${x.state}`).join(', ')} after the hall's man went down`);
    B.say(`  down at ${at(H.char.pos)}; the clerk at his table`);
  },
  // through the doorway into the lit hall and under the chest beam on a knee
  under: B => {
    const trips = () => B.g.chronicle.events.filter((e: any) => e.kind === 'alarm').length, t0 = trips();
    B.crouch(true); B.go([26.2, 0, 12.6], 10); B.go([24.4, 0, 13.0], 10); B.go(TQ.under, 10, { near: 0.2 });
    if (trips() > t0) B.fail('the chest beam was tripped on a knee');
  },
  nv: B => { B.press('KeyN', 20); },
  // along the hall to the box on its wall, a stride inside the counting room's doorway
  box: B => {
    B.go(TQ.boxAt, 12, { near: 0.2 });
    B.say(`  at the box: lit ${lit(B)}; ${B.g.guards.filter((x: any) => x.state !== 'dead').map((x: any) => `${x.callsign} ${x.state} ${x.awareness.toFixed(2)}`).join(', ')}`);
    if (!tap(B, 'breaker', 'breakerOff', TQ.box)) B.fail('no row at the mains box');
    if (!B.until(() => B.g.blackout.active, 2)) B.fail('the mains did not go');
    // a person's beat, then round the end of the niche's wall and in behind it
    B.wait(REACT + 0.5); B.crouch(true); B.go([21.0, 0, 14.6], 10); B.go([21.0, 0, 14.1], 10); B.go(TQ.wait, 10, { near: 0.15 }); B.say(`  in the niche ${(B.t() - B.g.blackout.since).toFixed(1)} s after the mains went: lit ${lit(B)}`);
  },
  // whoever is sent comes through the doorway to the box, and is taken at it from behind
  boxman: B => {
    const n0 = seen(B), sent = () => B.g.guards.find((x: any) => x.state !== 'dead' && x.task?.kind === 'breaker');
    const C = sent() ?? man(B, 'table');
    const came = B.until(() => (C.char.pos[0] > 20.2 && flat(C.char.pos, [TQ.box[0], 0, TQ.box[2] - 0.6]) < 1.3) || C.state === 'alert' || C.state === 'dead' || !B.g.blackout.active, 40);
    settled(B, C, 0.25, 4);   // he stops at the box, his back to the room: only then does anything move
    const t0 = B.t();
    B.say(`  ${C.callsign} ${came ? 'came' : 'did not come'}: ${C.state}, at ${at(C.char.pos)}, facing ${C.char.bodyYaw.toFixed(2)}, ${flat(C.char.pos, B.pos()).toFixed(2)} m off, ${(B.t() - B.g.blackout.since).toFixed(1)} s after the mains went; lit ${lit(B)}`);
    if (!came || !B.g.blackout.active) B.fail(`${C.callsign} ${came ? 'had the mains back in before he could be reached' : 'did not come to the box'} (${C.state}, at ${at(C.char.pos)})`);
    unseen(B, n0, C, 'in the niche');
    B.wait(REACT);
    B.go([21.0, 0, 14.15], 8, { near: 0.2 });   // round the end of the niche's wall: he stands a stride on, his back to it
    for (let i = 0; i < 8 && flat(B.pos(), C.char.pos) >= 0.8; i++) B.nudge([C.char.pos[0], 0, C.char.pos[2]], 0.4, () => flat(B.pos(), C.char.pos) < 0.8);   // (he may still be stepping up to the lever)
    B.step(4);
    B.say(`  in reach ${flat(B.pos(), C.char.pos).toFixed(2)} m off, ${(B.t() - t0).toFixed(1)} s after he got to the box (the mains ${B.g.blackout.active ? 'still out' : 'BACK'}); he ${C.state}`);
    B.click(2);
    if (!B.until(() => C.state === 'dead', 4)) B.fail(`the right button did not put the man at the box down (${C.state}, ${flat(B.pos(), C.char.pos).toFixed(2)} m off)`);
    if (!B.g.blackout.active) B.fail('he had the mains back in before he went down');
    B.wait(1);
  },
  code: B => {
    B.go([13.25, 0, 14.6], 20); B.go([13.25, 0, 12.85], 10); B.go([16.9, 0, 12.85], 10); B.go([17.3, 0, 10.5], 20, { near: 0.2 });
    if (!tap(B, 'door', 'code', [16.5, 1.0, 10.3])) B.fail('no row to type the code');
    if (!B.until(() => !B.door('strong').locked || !B.door('strong').isClosed(), 10)) B.fail('the strongroom did not open to the code');
  },
  safe: B => {
    B.go([15.4, 0, 10.3], 20); B.go([14.5, 0, 9.9], 10, { near: 0.2 });
    if (!tap(B, 'objective', 'drive', TQ.safeFront)) B.fail('no row at the safe'); B.until(() => B.g.mission.stage === 'exfil', 20);
  },
  out: B => { B.crouch(false); B.go([16.9, 0, 12.85], 20); B.go([13.25, 0, 12.85], 10); B.go([13.4, 0, 15.0], 20); B.go([11.4, 0, 15.1], 20); },
};
/** out by the track gate */
export function finish(B: Bot) { B.go([9.0, 0, 14.0], 20); B.go([6.0, 0, 14.0], 30); }
