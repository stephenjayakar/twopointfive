// The tutorial's squad mission (levels/tut-squad.json), its staged moments: ONE play program, 'tutorial', started by the lesson with the run and started
// over at a checkpoint's load (game/lesson.ts). A beat begins on the cue of the step that came up (`lesson:<cue>`) and starts clean from it; where a step
// waits on a beat, the beat says it is over with `done:<name>`.
//
// What is scripted is only what must be SEEN at a known moment: the workshop's man holding his open doorway with rounds out of it, the nest's first
// burst down the street, and the picket coming by two gates. Each man is the level's own (the room clear's roster, by callsign) and is handed back to the
// game's AI the moment his show is over: the fights themselves are never scripted.
import type { BeatCtx, Cond, DoorRef, LevelScriptFn, Query, UnitRef } from '../src/game/director';
import type { Vec3 } from '../src/math/vec';

/** the roster's men by the order the level places them: the workshop's one, the nest's gunner and the man beside him, the picket's three */
const SHOP_MAN = 'Tango 4', GUNNER = 'Tango 5', LOADER = 'Tango 6', PICKET = ['Tango 9', 'Tango 10', 'Tango 11'], HALL_MEN = ['Tango 7', 'Tango 8'];

/** seconds the two who came round stand in the street, rifles up at the bags, before their first round; the longest they wait outside the wall for the
 *  cover order before they come anyway; and how long men walked out into the open a second time are kept there before they are the game's own again */
const STREET_SECS = 4, COVER_SECS = 40, OPEN_SECS = 6;
/** the workshop's man: how long the player stands in his line before he is seen there · how late he is to the door at his back */
const SEEN_SECS = 1.5, SIDE_SECS = 2.0;
/** the workshop's lane door as the mission opens: swung in square to its wall (rad), out of the doorway and of its man's line through it */
const SHOP_OPEN = 1.55;
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
  const shopDoor = D.door('workshop'), sideDoor = D.door('workshop_side'), hallDoor = D.door('hall'), roadGate = D.door('gate_e'), backGate = D.door('gate_n'), trackGate = D.door('gate_w');
  // the workshop's man: his mark at the far end of the room, on the line through the middle of the open lane doorway · where that line ends, on the guard
  // hut's wall across the lane (tools/levels/tut-squad.ts SHOP_FIRE / SHOP_AIM: the level's volumes are laid along the same line)
  const SHOP_FIRE = D.mark('shop.fire', [19.3, 0, 8.52]), SHOP_AIM: Vec3 = [13.0, 1.0, 8.9], IN_HALL: Vec3 = [31.4, 1.1, 19.75], HALL_WINDOW: Vec3 = [31.1, 1.4, 17.0];   // (… and the hall's doorway from inside, which its two men watch, and its street window)
  const shopLane = D.volume('shop_lane'), shopLine = D.volume('shop_line'), shopIn = D.volume('shop_in');
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

    // A DOORWAY HE HOLDS. The workshop's lane door stands open and he is on it from the far end of the room, in this beat's hand from the first tick (a
    // man the AI had would be at that doorway on the first shot of the first room). When the store falls he is IN THE PICTURE THROUGH THE FOG, and his
    // rounds go out of the doorway onto the guard hut's wall across the lane: where the squad went in first. He, the doorway and the rounds are there
    // to be looked at from the mouth of the lane, where that step's ring walks the player (from inside the store none of it is on his screen), and they say which door not to use. The way to the other door is along the street, and no part of it is in
    // his line. NO ROUND IS PUT WHILE ANY OF THE TEAM IS IN THAT LINE (a scripted round is a real round: a man who goes round by the lane crosses it
    // between bursts). Who is seen: a player who STAYS in the line SEEN_SECS, and anybody who comes into his room by the doorway he holds: he is the
    // game's own from then. The side door is at his back, and he is late to it
    // (Before: both doors were shut, he fired through the street door's leaf at a stack sent to it, and nobody could see him or where the rounds came
    //  from. A doorway on the street was tried first: every way east crosses its line, and the squad shot him through it as they went by.)
    P.onStart('shop');
    P.beat('shop', function* (c) {
      const m = c.unit(SHOP_MAN);
      if (!alive(c, m)) { c.signal('done:shop'); return; }
      let since = -1;
      const down = () => c.until(q => !q.alive(m), 'he is down'), side = () => open(c, sideDoor), room = () => c.until(q => q.inside(shopIn, 'team'), 'one of them is in his room');
      const seen = () => c.until(q => { if (!q.inside(shopLine, 'sam')) { since = -1; return false; } if (since < 0) since = q.t; return q.t - since >= SEEN_SECS; }, 'the player stays in his line');
      /** a wait that any of the four ways his hold ends cuts short: → 0 the wait itself, 1 the side door, 2 his room, 3 seen in his line, 4 down */
      const hold = (x: Cond) => c.any(x, side(), room(), seen(), down());
      const ends = (i: number) => {
        if (!alive(c, m)) return;
        c.note(`his hold ends: ${['', 'the side door', 'one of them in his room', 'the player in his line', 'he is down'][i]}`);
        c.show(m, false); c.release(m, 'alert');
      };
      c.doors.open(shopDoor, (c.query.door(shopDoor).swing || 1) * SHOP_OPEN, { hold: true });   // (the lane door stands open from the first tick, whatever the staging did to the leaves: swung in square, clear of his line)
      c.order(m, { goal: SHOP_FIRE, aimAt: SHOP_AIM, upper: 'aim' });
      // (end: 0 he still holds his doorway · 1 the side door · 2 one of them in his room · 3 the player seen in his line · 4 down)
      let end = (yield hold(c.until(q => q.signalled('lesson:shop'), "the cue 'shop'"))).index, said = false;
      if (!end) { c.show(m); end = (yield hold(c.wait(0.6))).index; }
      while (!end) {
        for (let k = 0; k < 3 && !end; k++) {
          if (!c.query.inside(shopLane, 'team')) {
            // one round, and the beat waits on nothing else of his: a round he could not put in half a second is not put later, whoever stands in the lane by then
            const b = (yield c.any(c.stimulus.burst(m, SHOP_AIM, 1, { spread: 0.03 }), c.wait(0.5), side(), room(), seen(), down())).index;
            c.stimulus.cease(m);
            if (!b && !said) { said = true; c.signal('done:shop'); }   // his first round is out: the doorway has been shown for what it is
            end = b > 1 ? b - 1 : 0;
          }
          if (!end) end = (yield hold(c.wait(0.13))).index;
        }
        if (!end) end = (yield hold(c.wait(1.5 + c.rand() * 0.9))).index;
      }
      if (!said) c.signal('done:shop');   // (his hold ended before a round of his: there is nothing left to wait for)
      if (end === 1) yield c.any(c.wait(SIDE_SECS), down());   // the side door, at his back: he is late to it (at 0.9 s an unhurried player who stepped through the doorway was shot on two dice of four)
      ends(end);
    });

    // TWO WAIT EITHER SIDE OF THE HALL'S DOOR, AND THEY WATCH THE DOOR. Both are this beat's from the first tick, on their marks in the corners of the
    // door's wall, rifles on the doorway: that is the ambush the window's line shows, and it is why the window is the answer. One of them hit, the
    // other turns his rifle to the window and stays where he is, still this beat's: a man let go there went to the room's far corner, out of the
    // window's sight, and the line 'Shoot through the window' had nobody left to shoot (a slow reader's run, twice, after the first had been shot
    // through the glass from far off). They are the game's own when their door gives or the player is in their room.
    // (Before, they were the game's own from the first shot of the first room, one of them stands a step from the window, and the way round to the
    //  nest's open side passes that window a metre off: an unprotected scripted player walking it was shot through the glass on one die of eight.)
    P.onStart('hall');
    P.beat('hall', function* (c) {
      const men = HALL_MEN.map(n => c.unit(n)).filter((u): u is UnitRef => alive(c, u));
      const up = () => men.filter(u => c.query.alive(u));
      const ends = (k: number) => c.any(open(c, hallDoor), c.until(q => q.room('sam') === 'hall', 'the player is in the hall'), c.until(q => men.filter(u => q.alive(u)).length < k, 'one of the hall is down'));
      // (the one by the street window kneels: standing, he was shot through it from the alley, twelve metres off, before the player had come near. The other stands, out of
      //  that line: kneeling in the far corner he could not be hit from the window on the frozen stand)
      const hold = (u: UnitRef, aimAt: Vec3) => c.order(u, { goal: null, aimAt, upper: 'aim', crouch: u.callsign === HALL_MEN[0] });
      for (const u of men) hold(u, IN_HALL);
      while (up().length && (yield ends(up().length)).index === 2) for (const u of up()) hold(u, HALL_WINDOW);
      for (const u of up()) c.release(u, 'alert');
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
    // its locked door on the way, and the door's lesson went by with nobody at it.)
    // (Before: the gunner was the game's own from his first burst, and an unprotected player shooting back from the wall's end was hit on one die of
    //  eight; let go a second after the player reached the blocks, the nest shot a slow reader there on one die of two.)
    // BEFORE ITS STEP both men of the nest are down behind their bags, in this beat's hand from the first tick: the way from the workshop's side door to
    // the wall's end passes the wall's NORTH end a step away, and a man who came round that end was in the nest's sight before any line had said there
    // was a gun (they were the game's own until the gun's cue: a slow reader's scripted player, jostled by the four in the gap, was shot there on one die of four).
    P.onStart('gun');
    P.beat('gun', function* (c) {
      const m = c.unit(GUNNER), n = c.unit(LOADER);
      const cue = (k: string) => c.query.signalled(`lesson:${k}`), on = (k: string) => c.until(q => q.signalled(`lesson:${k}`), `the cue '${k}'`);
      const left = (q: Query) => [m, n].filter((u): u is UnitRef => !!u && q.alive(u) && !q.routed(u)), fewer = (k: number, label: string) => c.until(q => left(q).length < k, label);
      const gun = () => alive(c, m) && !c.query.routed(m), gunDown = () => c.until(q => !(m && q.alive(m) && !q.routed(m)), 'the gunner is down');
      const burst = (rounds: number) => c.stimulus.burst(m!, LANE, rounds, { cadence: 0.1, spread: rounds > 3 ? 0.035 : 0.03 });
      const up = () => { if (gun()) c.order(m!, { goal: null, aimAt: LANE, upper: 'aim', crouch: false, flinch: true }); };
      const down = () => { if (gun()) c.order(m!, { goal: null, aimAt: null, crouch: true, upper: 'relaxed', flinch: true }); };
      for (const u of [m, n]) if (alive(c, u)) c.order(u, { goal: null, aimAt: null, crouch: true, upper: 'relaxed' });   // both under the bags until the gun's step; the man beside the gun stays there
      if (!cue('gun')) yield c.any(on('gun'), fewer(1, 'the nest is empty'));
      if (gun()) c.show(m!);   // (the gunner is in the picture through the fog while he is the script's: the line says shoot back, and there is no ring on him)
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
      if (alive(c, m)) c.show(m, false);
      for (const u of left(c.query)) c.release(u, 'alert');
    });
  });
};
export default script;
