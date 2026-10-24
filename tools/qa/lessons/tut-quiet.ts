// The scripted player for the tutorial's quiet mission (levels/tut-quiet.json; tools/qa/lesson-run.ts runs it): what each line asks, through the input only.
// THE STAND: the mission teaches the page's buttons (Left = the knife, Right = the knockout: the close-in mode, src/game/close.ts). The shipped stand has that
// mode on by itself; the frozen stand pins it off while the game is stood up, so the FIRST statement of the first step turns it on (nothing has been pressed yet;
// the same in both arms, lesson on / off).
import type { Bot } from '../lesson-run';
import { CLOSE } from '../../../src/game/close';
import { HANDRING } from '../../../src/game/handring';
import { TQ } from '../../levels/tut-quiet';
import { handCarry } from '../../../src/game/guards';
import { HANDSLOT, HANDSLOT_KEY } from '../../../src/game/handslot';
import { kitTreeOn } from '../../../src/game/kit';
import { WHISTLE_STATS } from '../../../src/game/whistle';

export const query = '?quiet';
// he wears what the mission's page deals him (the level's own card: one grenade and five sponge rounds on the launcher, the grenade up): the swap's line leans on it
export const pageKit = true;
// the moon on his meter (lesson-run's --moon): the CPU's light estimate leaves it out, and the lane is lit by nothing else
export const mode = { moon: true };

const ROUTES = ['hall', 'court', 'table'];
const man = (B: Bot, route: string) => B.g.guards.find((x: any) => x.route?.name === route) ?? B.g.guards[ROUTES.indexOf(route)];
/** how many times the shift has had eyes on him so far (the chronicle's own rows: a sighting, a man gone to alert) */
const seen = (B: Bot): number => B.g.chronicle.events.filter((e: any) => e.kind === 'spotted' || e.kind === 'contact').length;
/** a person's beat between seeing a man come through and moving */
export const needs = 'rails';
const REACT = Number((globalThis as any).process?.env?.TPS_REACT ?? 0.6);
/** THE BREAK PATHS of the staged man (the level's script walks him, so what he sees and hears is the script's to say: levels/tut-quiet.script.ts). Each
 *  of these has the player do what a man with eyes and ears would catch, and the run must FAIL on it:
 *  TQSMOKE_BREAK=front    after the whistle he stands on the walk, in front of the gap the man comes to
 *  TQSMOKE_BREAK=beam     he stays on the whistle's own mark, where the man's light is put
 *  TQSMOKE_BREAK=upright  he hides, then walks up behind the smoking man on his feet instead of crouched
 *  TQSMOKE_BREAK=hands    in the store he goes for the hall's man by hand after all: the chest beam at the man's back is broken */
const WRONG = String((globalThis as any).process?.env?.TQSMOKE_BREAK ?? '');
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
/** a slot's key, and the half second the thing takes to come into the hand */
const take = (B: Bot, code: string) => { B.press(code, 5); B.until(() => B.g.player.equipT <= 0, 3); B.step(3); };
/** a mouse button pressed, held on a world point for `secs` and let go (with the rifle up the right one shows the arc): Input's bits are 1 left · 2 middle · 4 right */
const holdButton = (B: Bot, bit: number, p: number[], secs = 0.5) => { B.aim(p); B.step(); B.I.clicked |= bit; for (let i = 0; i < secs * 60; i++) { B.aim(p); B.I.buttons |= bit; B.step(); } B.I.buttons &= ~bit; B.aim(p); B.step(3); };
const leftHold = (B: Bot, p: number[], secs = 0.5) => holdButton(B, 1, p, secs), rightHold = (B: Bot, p: number[], secs = 0.5) => holdButton(B, 4, p, secs);
const head = (x: any): number[] => x.char.bones?.head ?? [x.char.pos[0], 1.6, x.char.pos[2]];
const loadName = (a: string | null) => a === 'ring' ? 'the sponge round' : a === 'he40' ? 'the grenade' : String(a);
/** how many times a beam has been broken this run */
const trips = (B: Bot): number => (B.g.devices?.lasers ?? []).reduce((n: number, l: any) => n + l.trips, 0);
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
    if (WRONG === 'front') B.go([24.4, 0, 17.75], 8, { near: 0.25 }); else if (WRONG === 'beam') B.wait(1.5); else { B.go([22.7, 0, 19.1], 8, { near: 0.25 }); B.go(TQ.hide, 8, { near: 0.15 }); }
    B.say(`  behind the wall ${(B.t() - t0).toFixed(1)} s after the whistle: lit ${lit(B)}; ${A.callsign} ${A.state} at ${at(A.char.pos)}, ${A.script ? 'the script has him' : 'his own man'}`);
    if (A.state === 'patrol') B.fail(`the whistle moved nobody (${A.callsign} at ${at(A.char.pos)})`);
    if (!A.script) B.fail(`the level's script did not take the man who heard the whistle (${A.callsign} ${A.state})`);
    unseen(B, n0, A, 'going behind the wall');
    (B as any).whistledAt = t0;
  },
  // nothing pressed while he comes round, looks through the gap and turns away; once he stands by the crate with his back to the gap, a person's beat,
  // round the wall's end, up the walk, through the gap, to his back
  grab: B => {
    const A = man(B, 'court'), n0 = seen(B), t0 = (B as any).whistledAt ?? B.t();
    // (what his light does while he looks: the most it puts on the place the whistle came from, and on the player behind the wall)
    let onSpot = 0, onMe = 0, lookedFrom: number[] | null = null, lookT = 0;
    const watch = () => { const L = A.flashlight, d = A.beamDir; if (L?.enabled && d) { const to = [TQ.whistle[0] - A.char.pos[0], TQ.whistle[2] - A.char.pos[2]], n = Math.hypot(to[0], to[1]) || 1, cos = (to[0] * d[0] + to[1] * d[2]) / n;
        if (flat(A.char.pos, TQ.look) < 0.4 && cos > onSpot) { onSpot = cos; lookedFrom = [...A.char.pos]; lookT = B.t(); } }
      onMe = Math.max(onMe, B.g.player.visibility); };
    const there = B.until(() => { watch(); return (!!A.script && flat(A.char.pos, TQ.smoke) < 0.35 && Math.abs(Math.atan2(Math.sin(A.char.bodyYaw - Math.PI / 2), Math.cos(A.char.bodyYaw - Math.PI / 2))) < 0.3) || A.state === 'alert' || !A.script; }, 45);
    B.say(`  ${A.callsign} ${lookedFrom ? `looked from ${at(lookedFrom)}, ${flat(lookedFrom, TQ.whistle).toFixed(1)} m from the whistle's mark, his light within ${(Math.acos(Math.min(1, onSpot)) * 57.3).toFixed(0)}° of it, ${(lookT - t0).toFixed(1)} s after the whistle` : 'never looked'}; the most light on the player behind the wall ${onMe.toFixed(2)}`);
    B.say(`  ${there && A.script ? 'he is' : 'he never got'} at his smoke ${(B.t() - t0).toFixed(1)} s after the whistle (${at(A.char.pos)}, facing ${A.char.bodyYaw.toFixed(2)}, ${A.state}${A.script ? '' : ', his own man'})`);
    unseen(B, n0, A, 'behind the wall');
    const from = lookedFrom as number[] | null;
    if (!from || onSpot < 0.96) B.fail(`${A.callsign} did not put his light on the place the whistle came from`);
    else if (flat(from, TQ.whistle) < 4) B.fail(`${A.callsign} looked from ${flat(from, TQ.whistle).toFixed(1)} m: close enough to read the prints`);
    if (!there || !A.script) B.fail(`${A.callsign} was not there to be taken (${A.state}, at ${at(A.char.pos)})`);
    B.wait(REACT);
    B.go([22.75, 0, 19.0], 8, { near: 0.25 }); B.go([23.6, 0, 17.8], 8, { near: 0.25 });
    B.say(`  on the walk: ${A.callsign} at ${at(A.char.pos)}, facing ${A.char.bodyYaw.toFixed(2)}, ${A.state}, ${flat(B.pos(), A.char.pos).toFixed(1)} m off; lit ${lit(B)}`);
    // his torch has come down for the smoke: still the hand's, still lit, and under his shoulder (the look through the gap carries it up at his head)
    const low = A.char.bones.upperArmR ? A.char.bones.upperArmR[1] - A.flashlight.pos[1] : -1;
    B.say(`  his torch: ${handCarry(A)} in the hand, ${A.flashlight.enabled ? 'lit' : 'out'}, ${low.toFixed(2)} m under his shoulder`);
    if (A.script && (handCarry(A) !== 'torch' || !A.flashlight.enabled || low < 0.2)) B.fail(`${A.callsign} does not smoke with his torch lit and low (${handCarry(A)}, ${A.flashlight.enabled ? 'lit' : 'out'}, ${low.toFixed(2)} m under the shoulder)`);
    if (WRONG === 'upright') { B.crouch(false); B.go(behind(A, 1.2), 20, { near: 0.25, stop: () => A.state === 'alert' || !A.script }); B.say(`  upright behind him: ${A.callsign} ${A.state}${A.script ? ', still at his smoke' : ', his own man'}, ${flat(B.pos(), A.char.pos).toFixed(1)} m off`); B.crouch(true); }
    if (!closeIn(B, A, [25.5, 0, 17.75])) B.fail(`could not get behind the first man (${flat(B.pos(), A.char.pos).toFixed(2)} m off, he stands at ${at(A.char.pos)}, ${A.state})`);
    unseen(B, n0, A, 'coming up behind him');
    if (!A.script) B.fail(`${A.callsign} turned from his smoke as the player came up crouched (${A.state})`);
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
  // the back door is three strides on from where the man was taken, past him
  door: B => {
    B.crouch(true); B.go(TQ.backDoor, 15, { near: 0.2 });
    B.say(`  at the back door: lit ${lit(B)}`);
  },
  // the key at the lock, then nothing until the cylinder goes over (the card that comes up with this line is the page's: a headless run has none)
  pick: B => {
    // a stray left click here, nobody in an arm and nobody in reach: the button is on since the last step, and it must do nothing a man could hear
    { const P = B.g.player, shots = () => (P.rifle?.shotsFired ?? 0) + (P.pistol?.shotsFired ?? 0), n = shots(); B.click(1, [26.0, 0, 18.6]); B.step(20);
      if (shots() > n || !P.holstered) B.fail(`a stray left click at the lock ${shots() > n ? 'fired a round' : 'drew the gun'}`);
      B.say(`  a stray left click: no round fired (${P.holstered ? 'holstered' : 'in hand'}; ${n} fired so far)`); }
    if (!tap(B, 'door', 'pick', [27.9, 1.0, 16.5])) B.fail('no row to pick the back door');
    if (!B.until(() => !B.door('back').locked, 14)) B.fail('the back door did not pick');
  },
  nook: B => {
    if (!B.openDoor('back')) B.fail('the back door did not open');
    B.until(() => !B.door('back').isClosed(), 4);
    B.go([27.9, 0, 15.7], 15);
  },
  // the first line inside the door names the laser: the dark corner, on a knee
  corner: B => {
    const H = man(B, 'hall'), n0 = seen(B);
    // (the interaction key is his on this line: the back door, open behind him, has its row from inside and the row moves the leaf. The first build took
    //  the key here to shut the stalk's click, and a tap at this door did nothing and said nothing. Not asked on the break's run: he goes for the man there)
    if (!WRONG) { const d = B.door('back'), a0 = d.angle, AIM = [27.9, 1.0, 16.5];
      for (let i = 0; i < 20; i++) { B.aim(AIM); B.step(); }
      const row = B.g.nearby.find((r: any) => r.kind === 'door' && r.door === d && r.verb && r.inReach !== false);
      if (!row) B.fail(`no row for the open back door from inside it (rows: ${B.g.nearby.map((r: any) => `${r.kind}:${r.verb ?? '-'}`).join(' | ') || 'none'}): the interaction key is dead on this line`);
      else { B.verb('door', row.verb, AIM); B.until(() => Math.abs(d.angle - a0) > 0.1, 4); B.step(60);   // (how far it swings is the stand's: a hand walks it shut on the page's, he stands in its way on the frozen one)
        if (Math.abs(d.angle - a0) < 0.1) B.fail(`the back door's row '${row.verb}' did not move the leaf from inside (${a0.toFixed(2)} → ${d.angle.toFixed(2)})`);
        B.say(`  inside the back door: '${row.verb}' moves the leaf (${a0.toFixed(2)} → ${d.angle.toFixed(2)}, ${d.isClosed() ? 'shut behind him' : 'not shut'})`); } }
    // (the break: the man gone for by hand after all, his hands empty, on a knee the whole way. On the page's stand the hand that reaches for him is in the
    //  beam; where no hand comes up by itself and no row takes him, he stands up behind the man)
    if (WRONG === 'hands') { const t0 = trips(B); closeIn(B, H, [25.3, 0, 12.7]); B.step(20);
      if (trips(B) === t0 && B.verb('guard', 'grab', [H.char.pos[0], 1.35, H.char.pos[2]])) { B.until(() => trips(B) > t0, 3); B.say(`  the grab's row taken: ${B.g.player.holding ? 'he is held' : 'nobody held'}`); }
      if (trips(B) === t0) { B.crouch(false); B.step(40); B.say('  no row to grab him by: he stands up behind the man'); }
      B.say(`  by hand: ${trips(B) > t0 ? 'the chest beam broken' : 'the beam not broken'} from ${at(B.pos())}, ${flat(B.pos(), H.char.pos).toFixed(2)} m behind him; he ${H.state}`);
      if (trips(B) > t0) B.fail('the chest beam at his back is broken by a man who comes up behind him'); }
    B.go(TQ.nook, 10, { near: 0.12 }); B.wait(0.4);
    // (the whistle is not his in the store: it would bring the man round to him. Its own code does nothing — the gate takes it, on either stand — and where
    //  his actions are a ring, the interaction key held on open floor puts none up, with no wedge to pick, and a click whistles nobody)
    { const w0 = WHISTLE_STATS.blown; B.press('KeyV', 6); B.hold(['Space'], 0.6); const ring = !!B.g.player.sel?.open; B.click(1, [H.char.pos[0], 1.2, H.char.pos[2]]); B.step(20);
      if (ring || WHISTLE_STATS.blown > w0) B.fail(`in the store ${WHISTLE_STATS.blown > w0 ? 'he whistled' : 'the interaction key held put the hand\'s ring up'} (a whistle would bring the hall's man round to him)`);
      if (B.g.player.sel?.open) B.press('Escape', 3); }
    B.say(`  in the corner: lit ${lit(B)}; ${H.callsign} ${H.state}, aware ${H.awareness.toFixed(2)}, ${flat(B.pos(), H.char.pos).toFixed(1)} m off`);
    unseen(B, n0, H, 'coming into the store');
  },
  // THE RIFLE'S LAUNCHER (the level file's head: THE SPONGE ROUND). The rifle off his back by its own key
  rifle: B => {
    const P = B.g.player, rf = P.rifle;
    B.say(`  on him: ${rf.shells} grenade, ${rf.rings} sponge rounds, the launcher up on ${loadName(rf.attachment)}; ${P.canisters} smoke, ${P.flashbangs} stun, ${P.frags} frag`);
    if (rf.attachment !== 'he40' || rf.shells !== 1 || rf.rings !== (kitTreeOn() ? 5 : rf.rings)) B.fail(`the mission's card is not on him: the launcher is up on ${loadName(rf.attachment)} with ${rf.shells} grenade and ${rf.rings} sponge rounds (one grenade, five sponge rounds, the grenade up)`);
    // (his hands are empty, the interaction key is his and the man is in reach of a held left click: the frame gives that click to the stalk unless a
    //  step denies `stalk`, and `nook` does — the level file's head, WHY NOT HANDS. Held from the doorway's line, where a stalk would have a way to him)
    { const H = man(B, 'hall'), t0 = trips(B); B.crouch(true); B.go(TQ.shot, 10, { near: 0.15 }); const from = B.pos().slice(); leftHold(B, [H.char.pos[0], 1.2, H.char.pos[2]], 1.5);
      if (P.holding || trips(B) > t0 || flat(B.pos(), from) > 0.1) B.fail(`a left click held on the hall's man took him or walked the player at him (held ${!!P.holding}, moved ${flat(B.pos(), from).toFixed(2)} m, the beam ${trips(B) > t0 ? 'broken' : 'whole'})`);
      B.say(`  a left click held on him from the doorway's line: nobody stalked, nobody held`); B.go(TQ.nook, 10, { near: 0.15 }); }
    take(B, 'Digit2');
    if (!P.rifleUp) B.fail('the rifle\'s key did not bring it into his hands');
  },
  // the swap: 2 with the rifle up steps what is on the right button (the setup's load row where the setup is a mode). The right button is not his yet:
  // held on the man before the swap, nothing leaves the tube. (Tried from the doorway's line, where the launcher HAS a line to him: from the corner no
  // round reaches him whatever the frame says, and the check passed with the frame's locks broken. Then back to the corner for the swap)
  load: B => {
    const P = B.g.player, rf = P.rifle, H = man(B, 'hall'), had = `${rf.shells}/${rf.rings}`;
    B.crouch(true); B.go(TQ.shot, 10, { near: 0.15 }); rightHold(B, head(H)); B.wait(0.5);
    if (`${rf.shells}/${rf.rings}` !== had || H.state !== 'patrol') B.fail(`the right button fired on the line that swaps the load (${had} → ${rf.shells}/${rf.rings}; ${H.callsign} ${H.state})`);
    B.go(TQ.nook, 10, { near: 0.15 });
    B.press('Digit2', 20); if (rf.attachment !== 'ring') B.press('Digit2', 10);
    B.say(`  the launcher: ${loadName(rf.attachment)} up (a right click held on him from the doorway's line before the swap sent nothing)`);
    if (rf.attachment !== 'ring') B.fail(`the rifle's key did not put the sponge round up (${loadName(rf.attachment)})`);
  },
  // out of the corner to the mark on the doorway's line, crouched: the corner itself has no line to him
  // (the reason this line exists is asked of the level itself, with no round spent: from the corner a straight line to his head meets a wall, from the
  //  mark it does not. A round let go down the blocked line is spent on the wall, where one leaves the tube at all, and its knock is one he looks at)
  behind: B => {
    const H = man(B, 'hall'), n0 = seen(B);
    const line = (from: number[]) => { const to = head(H), p = [from[0], 1.0, from[2]], d = [to[0] - p[0], to[1] - p[1], to[2] - p[2]], len = Math.hypot(d[0], d[1], d[2]), dir = d.map(v => v / len);
      return !B.g.col.raycast(p, dir, len - 0.3) && !B.g.props.raycast(p, dir, len - 0.3); };
    if (line(TQ.nook) || !line(TQ.shot)) B.fail(`the corner ${line(TQ.nook) ? 'has' : 'has no'} line to his head and the mark ${line(TQ.shot) ? 'has one' : 'has none'}: the line that sends him out of the corner rests on the first having none and the second having one`);
    B.say(`  ${H.callsign} ${H.state} at ${at(H.char.pos)}, facing ${H.char.bodyYaw.toFixed(2)}, the chest beam ${(TQ.beamHigh - H.char.pos[0]).toFixed(2)} m behind him; no line to his head from the corner, a clear one from the mark`);
    B.crouch(true); B.go(TQ.shot, 10, { near: 0.15 }); B.step(10);
    B.say(`  on the doorway's line: lit ${lit(B)}, ${flat(B.pos(), H.char.pos).toFixed(1)} m behind him; he ${H.state}, aware ${H.awareness.toFixed(2)}`);
    unseen(B, n0, H, 'stepping out to the doorway\'s line');
  },
  // the ring let go at the back of his head
  sponge: B => {
    const rf = B.g.player.rifle, H = man(B, 'hall'), C = man(B, 'table'), n0 = seen(B), trips0 = trips(B), had = rf.rings;
    rightHold(B, head(H));
    if (rf.rings !== had - 1) B.fail(`the right button let no sponge round go (${rf.rings} left of ${had})`);
    if (!B.until(() => H.state === 'dead', 3)) B.fail(`the sponge round did not put the hall's man out (${H.state}, aware ${H.awareness.toFixed(2)})`);
    B.wait(1.5);
    if (trips(B) > trips0) B.fail('the ring broke the chest beam');
    const ko = B.g.chronicle.events.some((e: any) => e.kind === 'ko' && e.data?.method === 'ring');
    if (!ko) B.fail('the hall\'s man is down and the night\'s record has no man put out by a ring');
    if (seen(B) > n0) B.fail('the shift had eyes on him at the shot');
    const up = B.g.guards.filter((x: any) => x.state !== 'dead' && x.state !== 'patrol');
    if (up.length) B.fail(`${up.map((x: any) => `${x.callsign} ${x.state}`).join(', ')} after the hall's man went down`);
    B.say(`  out cold at ${at(H.char.pos)}; ${C.callsign} at his table (${C.state}, aware ${C.awareness.toFixed(2)}); the beam unbroken`);
  },
  // the rifle away again: the hands' own key (the page's backtick gives the slot's code; E's old code where the slot is off)
  sling: B => {
    const P = B.g.player;
    B.press(HANDSLOT.on ? HANDSLOT_KEY : 'KeyE', 10); B.until(() => P.holstered, 3);
    if (!P.holstered) B.fail('the hands\' key did not put the rifle away');
  },
  // through the doorway into the lit hall and under the chest beam on a knee
  under: B => {
    const alarms = () => B.g.chronicle.events.filter((e: any) => e.kind === 'alarm').length, a0 = alarms(), t0 = trips(B);
    B.crouch(true); B.go([26.2, 0, 12.6], 10); B.go([24.4, 0, 13.0], 10); B.go(TQ.under, 10, { near: 0.2 });
    if (alarms() > a0 || trips(B) > t0) B.fail('the chest beam was tripped on a knee');
    B.say(`  under the beam on a knee, past the man on the floor: not broken`);
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
  gate: B => { B.go([9.0, 0, 14.0], 20); B.go([7.5, 0, 14.0], 30, { near: 0.25 }); },
};
/** out by the track gate */
export function finish(B: Bot) { B.go([6.0, 0, 14.0], 30); }
