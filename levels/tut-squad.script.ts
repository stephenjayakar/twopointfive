// The tutorial's squad mission (levels/tut-squad.json), its staged moments: ONE play program, 'tutorial', started by the lesson with the run and started
// over at a checkpoint's load (game/lesson.ts). A beat begins on the cue of the step that came up (`lesson:<cue>`) and starts clean from it; where a step
// waits on a beat, the beat says it is over with `done:<name>`.
//
// What is scripted is only what must be SEEN at a known moment: the workshop's man putting rounds through the door he heard the stack at, the nest's first
// burst down the street, and the picket coming by two gates. Each man is the level's own (the room clear's roster, by callsign) and is handed back to the
// game's AI the moment his show is over: the fights themselves are never scripted.
import type { BeatCtx, DoorRef, LevelScriptFn, Query, UnitRef } from '../src/game/director';

/** the roster's men by the order the level places them: the workshop's one, the nest's gunner and the man beside him, the picket's three */
const SHOP_MAN = 'Tango 4', GUNNER = 'Tango 5', LOADER = 'Tango 6', PICKET = ['Tango 9', 'Tango 10', 'Tango 11'];

/** seconds the two who came round stand in the street, rifles up at the bags, before their first round; the longest they wait outside the wall for the
 *  cover order before they come anyway; and how long men walked out into the open a second time are kept there before they are the game's own again */
const STREET_SECS = 4, COVER_SECS = 40, OPEN_SECS = 6;
/** the nest's gun once it has been answered: seconds it stays down behind its bags between bursts, seconds from the frag leaving a hand to the
 *  nest's men being the game's own (its fuse and a breath), and how much longer a man the frag left alone stands dazed in the script's hand */
const DOWN_SECS = 5, FRAG_SECS = 3.5, SHOCK_SECS = 40;

/** THE LAST MAN OF A STAGED GROUP BREAKS (runner.ts, the game's own rule, started from the script): with his mates down he shouts that he is done, drops
 *  his rifle and runs, whoever's hands he is in, and a man who has dropped it is nobody left to take. So the last man of the picket is
 *  never a rifle the player must walk up on alone. `up()`: the group's men still to be fought (one who has broken by himself is not one). `one()`: a
 *  wait's other way out. `broke()`: asked after each wait, true = the group is finished and the beat is over. Where that rule will not take the last
 *  man (`rout` false: the frozen stand, ?norunner, a man in the player's arm) the beat goes on as it was written before the rule: `one()` then waits
 *  for nobody to be left, and the last man is staged and let go like any other */
function lastMan(c: BeatCtx, men: UnitRef[], what: string) {
  let off = false;
  const left = (q: Query) => men.filter(u => q.alive(u) && !q.routed(u));
  return {
    up: () => left(c.query),
    one: () => c.until(q => left(q).length <= (off ? 0 : 1), `one of ${what} is left`),
    broke: (): boolean => {
      const l = left(c.query); if (!l.length) return true; if (l.length > 1 || off) return false;
      if (c.rout(l[0])) { c.note(`${l[0].callsign} is the last of ${what}: he drops it and runs`); return true; }
      off = true; return false;
    },
  };
}

const script: LevelScriptFn = D => {
  const shopDoor = D.door('workshop'), sideDoor = D.door('workshop_side'), roadGate = D.door('gate_e'), backGate = D.door('gate_n'), trackGate = D.door('gate_w');
  const SHOP_MARK = D.mark('shop.mark', [18.2, 0, 7.3]), SHOP_LEAF = D.mark('shop.leaf', [18.45, 0, 10.9]);
  const LANE = D.mark('nest.lane', [23.7, 0, 13.0]);                                               // the wall's own face, mid street: the first burst lands on concrete, well up the street from whoever is about to step round its end
  const CAMP = [D.mark('picket.camp0', [38.4, 0, 11.6]), D.mark('picket.camp1', [38.8, 0, 9.8]), D.mark('picket.camp2', [38.4, 0, 8.0])];
  const GATE_POST = D.mark('picket.gate', [35.9, 0, 14.0]), BAGS = D.mark('picket.bags', [31.0, 0, 13.8]);
  const ROUND = [D.mark('picket.round0', [26.6, 0, 4.2]), D.mark('picket.round1', [28.0, 0, 4.2])];   // outside the wall, short of the back gate and clear of its leaf: the leader's, then the man behind him
  const OPEN = D.mark('picket.open0', [34.0, 0, 14.0]);                                              // in the open, inside the road gate: the front man's, when he has to be brought out
  const OUT = [D.mark('picket.out0', [27.8, 0, 12.3]), D.mark('picket.out1', [27.0, 0, 13.0])];           // the street off the alley's mouth, in plain sight of the bags and of the squad: the leader's, then the man behind him

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
      const { up, one, broke } = lastMan(c, men, 'the picket');
      const out = (u: UnitRef) => c.order(u, { goal: u === front ? OPEN : OUT[lane.indexOf(u)], aimAt: BAGS, upper: 'aim' });
      const there = (us: UnitRef[], label: string) => c.until(q => us.every(u => !q.alive(u) || q.routed(u) || q.arrived(u)), label);
      // (the back gate stands open before either of them is near it: a leaf swung into a man takes him out of anybody's hands — doorthrow.ts — and the
      //  one it caught was the game's own in the alley, unseen, on two dice of eight. The man nearer the corner leads and takes the farther mark at
      //  each stop, so the one behind never has to pass him in a lane a metre wide: passed, he went back round by the road gate)
      for (const g of [roadGate, backGate]) c.doors.lock(g, false);
      c.doors.open(backGate, undefined, { hold: true });
      const lane = round.slice().sort((a, b) => c.query.pos(a)[2] - c.query.pos(b)[2]);
      lane.forEach((u, i) => c.order(u, { goal: ROUND[i], upper: 'aim' }));
      if (front) {
        c.doors.open(roadGate, undefined, { hold: true });
        c.order(front, { goal: GATE_POST, aimAt: BAGS, upper: 'aim' });
        yield c.any(there([front], 'the front man is in the gate'), c.wait(6));
        if (broke()) { c.signal('done:flank'); c.signal('done:picket'); return; }
        if (alive(c, front)) c.release(front, 'alert');   // (no scripted round here: the player was sent behind those bags, and a scripted round is a real round. He is the fight's from the gate)
        yield c.wait(1.2);
      }
      c.signal('done:flank');   // the line turns to the alley while the two are still outside the wall
      yield c.any(there(lane, 'the two are at the back gate'), one(), c.wait(30));
      if (broke()) { c.signal('done:picket'); return; }
      // THEY WAIT FOR THE ORDER THE LINE ASKS FOR: outside the wall, where nobody sees them, until the squad has been turned to the alley (the last step
      // coming up is the cue `covered`), or a long while for a reader of any pace. A man who reads slowly is not shot in the back while he reads
      yield c.any(c.until(q => q.signalled('lesson:covered'), 'the squad is turned to the alley'), one(), c.wait(COVER_SECS));
      if (broke()) { c.signal('done:picket'); return; }
      // DOWN THE ALLEY AND OUT INTO THE STREET, in the script's hand: a man the script holds does not fight, and they step out with their rifles up at
      // the bags into the rifles of whoever was turned to cover the alley. THE SQUAD HAS THEM FIRST: a few seconds in the open before their first round.
      // One of the two down in it and the other is the last (above). Both still up when it is over: nobody covered the alley, nobody shot, and they
      // are the game's own, three metres behind the bags
      for (const u of lane) if (alive(c, u)) out(u);
      yield c.any(there(lane, 'the two are in the street'), one(), c.wait(16));
      c.signal('done:picket');
      if (broke()) return;
      yield c.any(one(), c.wait(STREET_SECS));
      if (broke()) return;
      for (const u of lane) if (alive(c, u)) c.release(u, 'alert');
      // NOBODY IS LEFT TO BE HUNTED: men of the picket still up a while into the fight have gone to ground where the bags cannot see them (the gate's
      // jamb, the alley's corner, the camp). They break cover instead: out into the open in the script's hand, where the squad's rifles are already
      // laid, kept there a few seconds, and then the game's own again IN the open. Whenever one of them is left after that, he drops it and runs
      yield c.any(one(), c.wait(12));
      if (broke()) return;
      for (const u of up()) out(u);
      yield c.any(there(up(), 'they are in the open'), one(), c.wait(10));
      if (broke()) return;
      yield c.any(one(), c.wait(OPEN_SECS));
      if (broke()) return;
      for (const u of up()) c.release(u, 'alert');
      yield one();
      broke();
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

    // A GUN ON THE STREET, AND IT IS THE SCRIPT'S UNTIL THE FRAG IS THROWN. Its first burst chips the wall's face, up the street from whoever is about
    // to walk round its end, and it goes on laying short bursts on that same face (never on a line the lesson sends a man to stand in: a scripted round
    // is a real round) until it is shot back at: the step's three rounds bring up the next line, whose cue (`ducks`) is the gun going DOWN behind its
    // bags. From then it is a gun that has been answered: down for DOWN_SECS, up for one short burst down the same lane, down again — so there is a
    // gap to run in, and the middle of the street stays a place to be shot in. Neither man of the nest is the game's own while a line is being read at
    // the wall's end or at the blocks: they are let go a fuse's length after the frag leaves his hand (`fragged`, the cue of the step after it), and a
    // man the frag left alone stands dazed in the script's hand SHOCK_SECS longer. So the man who shoots back from the wall's end, runs to the blocks and
    // throws, as the lines ask, is never the gun's target; one who walks up the middle of the street is in its rounds, and a frag that misses both
    // leaves him two men to fight. (The nest's last man is NOT made to drop it and run as the picket's is: he ran to his mates in the hall and opened
    // its locked door on the way, and the door's lesson went by with nobody shooting it.)
    // (Before: the gunner was the game's own from his first burst, and an unprotected player shooting back from the wall's end was hit on one die of
    //  eight; let go a second after the player reached the blocks, the nest shot a slow reader there on one die of two.)
    P.onSignal('lesson:gun', 'gun');
    P.beat('gun', function* (c) {
      const m = c.unit(GUNNER), n = c.unit(LOADER);
      const cue = (k: string) => c.query.signalled(`lesson:${k}`), on = (k: string) => c.until(q => q.signalled(`lesson:${k}`), `the cue '${k}'`);
      const left = (q: Query) => [m, n].filter((u): u is UnitRef => !!u && q.alive(u) && !q.routed(u)), fewer = (k: number, label: string) => c.until(q => left(q).length < k, label);
      const gun = () => alive(c, m) && !c.query.routed(m), gunDown = () => c.until(q => !(m && q.alive(m) && !q.routed(m)), 'the gunner is down');
      const burst = (rounds: number) => c.stimulus.burst(m!, LANE, rounds, { cadence: 0.1, spread: rounds > 3 ? 0.035 : 0.03 });
      const up = () => { if (gun()) c.order(m!, { goal: null, aimAt: LANE, upper: 'aim', crouch: false, flinch: true }); };
      const down = () => { if (gun()) c.order(m!, { goal: null, aimAt: null, crouch: true, upper: 'relaxed', flinch: true }); };
      if (alive(c, n)) c.order(n, { goal: null, crouch: true, upper: 'relaxed' });   // the man beside the gun keeps his head under the bags
      if (gun()) { up(); yield c.wait(0.4); yield c.any(burst(5), c.wait(3)); }
      c.signal('done:gun');
      // UNANSWERED: a burst on the wall's face every second or so
      while (gun() && !cue('ducks')) {
        yield c.any(on('ducks'), gunDown(), c.wait(1.3));
        if (!gun() || cue('ducks')) break;
        yield c.any(burst(3), on('ducks'), gunDown(), c.wait(2));
      }
      // ANSWERED: it ducks (a burst already in the air finishes on its own line), and comes up between long gaps for one burst down the lane
      while (gun() && !cue('fragged')) {
        down();
        yield c.any(on('fragged'), gunDown(), c.wait(DOWN_SECS));
        if (!gun() || cue('fragged')) break;
        up();
        yield c.any(c.wait(0.5), on('fragged'), gunDown());
        if (!gun() || cue('fragged')) break;
        yield c.any(burst(3), on('fragged'), gunDown(), c.wait(2));
      }
      // THE FRAG: both stay down under it (a man's legs still take him off a grenade he knows of: frag.ts, whoever's hands he is in). Both still up when
      // it has gone off: it missed, and they are the game's own. ONE left: he has had a grenade go off beside him and his mate is dead. He gets to
      // his feet DAZED, rifle down, his head over the bags and still the script's: the squad's rifles and the player's have him first, so 'Take the
      // nest' is not a walk onto a rifle. (Kept flat behind his bags instead, nobody could reach him: forty-five seconds a run, and one die not at all. Nor can he be hit from the blocks: he is taken from the nest's open side, and the wait is long enough for a slow walk round to it)
      down();
      yield c.any(on('fragged'), fewer(1, 'the nest is down'));
      yield c.any(c.wait(FRAG_SECS), fewer(1, 'the nest is down'));
      const last = left(c.query);
      if (last.length === 1) { c.order(last[0], { goal: null, aimAt: null, crouch: false, upper: 'relaxed', flinch: true }); yield c.any(c.wait(SHOCK_SECS), fewer(1, 'the nest is down')); }
      for (const u of left(c.query)) c.release(u, 'alert');
    });
  });
};
export default script;
