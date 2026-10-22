// The tutorial's squad mission (levels/tut-squad.json), its staged moments: ONE play program, 'tutorial', started by the lesson with the run and started
// over at a checkpoint's load (game/lesson.ts). A beat begins on the cue of the step that came up (`lesson:<cue>`) and starts clean from it; where a step
// waits on a beat, the beat says it is over with `done:<name>`.
//
// What is scripted is only what must be SEEN at a known moment: the workshop's man putting rounds through the door he heard the stack at, the nest's first
// burst down the street, and the picket coming by two gates. Each man is the level's own (the room clear's roster, by callsign) and is handed back to the
// game's AI the moment his show is over: the fights themselves are never scripted.
import type { BeatCtx, DoorRef, LevelScriptFn, UnitRef } from '../src/game/director';

/** the roster's men by the order the level places them: the workshop's one, the nest's gunner, the picket's three */
const SHOP_MAN = 'Tango 4', GUNNER = 'Tango 5', PICKET = ['Tango 9', 'Tango 10', 'Tango 11'];

const script: LevelScriptFn = D => {
  const shopDoor = D.door('workshop'), sideDoor = D.door('workshop_side'), roadGate = D.door('gate_e'), backGate = D.door('gate_n'), trackGate = D.door('gate_w');
  const SHOP_MARK = D.mark('shop.mark', [18.2, 0, 7.3]), SHOP_LEAF = D.mark('shop.leaf', [18.45, 0, 10.9]);
  const LANE = D.mark('nest.lane', [23.7, 0, 13.0]);                                               // the wall's own face, mid street: the first burst lands on concrete, well up the street from whoever is about to step round its end
  const CAMP = [D.mark('picket.camp0', [38.4, 0, 11.6]), D.mark('picket.camp1', [38.8, 0, 9.8]), D.mark('picket.camp2', [38.4, 0, 8.0])];
  const GATE_POST = D.mark('picket.gate', [35.9, 0, 14.0]), BAGS = D.mark('picket.bags', [31.0, 0, 13.8]);
  const ROUND = [D.mark('picket.round0', [24.6, 0, 4.1]), D.mark('picket.round1', [26.0, 0, 4.1])];   // outside the back gate
  const OPEN = [D.mark('picket.open0', [34.0, 0, 14.0]), D.mark('picket.open1', [27.0, 0, 13.0]), D.mark('picket.open2', [27.8, 0, 12.3])];   // in the open: inside the road gate, and in the street off the alley's mouth
  const MOUTH = [D.mark('picket.mouth0', [24.7, 0, 11.4]), D.mark('picket.mouth1', [26.0, 0, 11.6])];   // the alley's last metre, where the street first sees a man: behind whoever is at the bags

  // nobody on their side throws a grenade here: the mission's own HE lesson is the player's, and a grenade nobody has been shown yet is not a lesson
  D.systems.theirFrags(false);

  D.program('tutorial', P => {
    const alive = (c: BeatCtx, u: UnitRef | null): u is UnitRef => !!u && c.query.alive(u);
    const open = (c: BeatCtx, d: DoorRef) => c.until(q => { const s = q.door(d); return s.open || s.broken; }, 'a door of his opens');

    // THE RAILS, AND THEN THE PICKET. The yard's gates are shut on the player until the picket uses them, and the picket waits in its camp in nobody's
    // hands but this beat's (a man a beat took in hand is the AI's again when the beat ends: so this one waits, for the cue of the last fight).
    // MORE COME, AND NOT ALL BY ONE WAY: one man shows himself in the road gate; the other two walk round outside the wall to the back gate and come
    // down the alley, behind whoever is still looking at the road
    P.onStart('picket');
    P.beat('picket', function* (c) {
      for (const g of [roadGate, backGate, trackGate]) c.doors.lock(g, true);
      PICKET.forEach((cs, i) => { const u = c.unit(cs); if (alive(c, u)) c.order(u, { goal: CAMP[i], upper: 'relaxed' }); });
      yield c.on('signal', 'lesson:picket');
      const men = PICKET.map(cs => c.unit(cs)).filter((u): u is UnitRef => alive(c, u)), front = men[0] ?? null, round = men.slice(1);
      for (const g of [roadGate, backGate]) c.doors.lock(g, false);
      round.forEach((u, i) => c.order(u, { goal: ROUND[i], upper: 'aim' }));
      if (front) {
        c.doors.open(roadGate, undefined, { hold: true });
        c.order(front, { goal: GATE_POST, aimAt: BAGS, upper: 'aim' });
        yield c.any(c.until(q => !q.alive(front) || q.arrived(front), 'the front man is in the gate'), c.wait(6));
        if (alive(c, front)) c.release(front, 'alert');   // (no scripted round here: the player was sent behind those bags, and a scripted round is a real round. He is the fight's from the gate)
        yield c.wait(1.2);
      }
      c.signal('done:flank');   // the line turns to the alley while the two are still outside the wall
      yield c.any(c.until(q => round.every(u => !q.alive(u) || q.arrived(u)), 'the two are at the back gate'), c.wait(30));
      c.doors.open(backGate, undefined, { hold: true });
      // (down the alley in the script's hand, where nobody can see them, and the game's own the moment they stand in its mouth: a man the script holds
      // does not fight, and the street is a fight)
      round.forEach((u, i) => { if (alive(c, u)) c.order(u, { goal: MOUTH[i], aimAt: BAGS, upper: 'aim' }); });
      yield c.any(c.until(q => round.every(u => !q.alive(u) || q.arrived(u)), 'the two are in the alley\'s mouth'), c.wait(14));
      for (const u of round) if (alive(c, u)) c.release(u, 'alert');
      c.signal('done:picket');
      // NOBODY IS LEFT TO BE HUNTED: a man of the picket still up a while into the fight has gone to ground where the bags cannot see him (the gate's jamb,
      // the alley's corner, the camp), and a last man the player must walk up on alone is no end for a lesson. He breaks cover instead: out into the street
      // in the script's hand, where the squad's rifles are already laid, and the game's own again where he stops
      yield c.any(c.until(q => men.every(u => !q.alive(u)), 'the picket is down'), c.wait(12));
      const left = men.filter(u => alive(c, u)); if (!left.length) return;
      left.forEach(u => c.order(u, { goal: OPEN[men.indexOf(u)], aimAt: BAGS, upper: 'aim' }));
      yield c.any(c.until(q => left.every(u => !q.alive(u) || q.arrived(u)), 'the last of them are in the street'), c.wait(12));
      for (const u of left) if (alive(c, u)) c.release(u, 'alert');
    });

    // THEY KNOW WHERE YOU WERE: two short bursts through the leaf the stack stands at. He stays on that door until one of his doors opens
    P.onSignal('lesson:shop', 'shop');
    P.beat('shop', function* (c) {
      const m = c.unit(SHOP_MAN);
      if (!alive(c, m)) { c.signal('done:shop'); return; }
      c.order(m, { goal: SHOP_MARK, aimAt: SHOP_LEAF, upper: 'aim' });
      yield c.wait(0.6);
      for (let k = 0; k < 2 && alive(c, m); k++) { yield c.any(c.stimulus.burst(m, SHOP_LEAF, 2, { cadence: 0.14, spread: 0.02 }), c.wait(3)); yield c.wait(1.1); }
      c.signal('done:shop');
      const r = yield c.any(open(c, shopDoor), open(c, sideDoor), c.until(q => !q.alive(m), 'he is down'), c.wait(90));
      c.note(`his wait ends: ${['the street door', 'the side door', 'he is down', 'time'][r.index]}`);
      if (r.index === 1) yield c.wait(2.0);   // the side door, at his back: he is late to it (at 0.9 s an unhurried player who stepped through the doorway was shot on two dice of four)
      if (alive(c, m)) c.release(m, 'alert');
    });

    // A GUN ON THE STREET: its first burst chips the wall's face, up the street from whoever is about to walk round its end (never laid on a line a
    // man may be standing in: a scripted round is a real round)
    P.onSignal('lesson:gun', 'gun');
    P.beat('gun', function* (c) {
      const m = c.unit(GUNNER);
      if (alive(c, m)) {
        c.order(m, { goal: null, aimAt: LANE, upper: 'aim' });
        yield c.wait(0.4);
        yield c.any(c.stimulus.burst(m, LANE, 5, { cadence: 0.1, spread: 0.035 }), c.wait(3));
        if (alive(c, m)) c.release(m, 'alert');
      }
      c.signal('done:gun');
    });
  });
};
export default script;
