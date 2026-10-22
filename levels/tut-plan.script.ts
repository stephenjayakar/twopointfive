// The tutorial's plan mode mission (levels/tut-plan.json), its staged moments: ONE play program, 'tutorial', started by the lesson with the run and started
// over at a checkpoint's load (game/rails.ts). Both beats begin with the program and start clean from it: each finds its men by callsign and takes only
// the ones still up, so a checkpoint put back in the middle of the mission stages what is left of it.
//
// What is scripted is only what the plan is FOR: the hall's gun stays on the front door until a door of the hall opens — and when both open on one word it
// is still on the wrong one; the men outside stay outside until the squad has been faced to the two gates, and then come by both at once.
import type { BeatCtx, DoorRef, LevelScriptFn, Query, UnitRef } from '../src/game/director';

/** the roster's men by the order the level places them: the guardroom's two are the game's own; the hall's gunner and the man beside him; two up the road,
 *  two in the lane behind the back gate */
const GUNNER = 'Tango 3', MATE = 'Tango 4', ROAD = ['Tango 5', 'Tango 6'], LANE = ['Tango 7', 'Tango 8'];

/** seconds the gun stays on the front door after the back door has opened behind it; seconds the men who came by a gate stand in it, rifles up, before their first round (the squad, faced that way, has them first); seconds after that before men nobody has shot walk on into the yard */
const LATE_SECS = 2.4, GATE_SECS = 4, ON_SECS = 9;
/** seconds the back door has to follow the front one for it to be the plan · bursts the gun lays on a doorway one stack came through alone */
const BACK_SECS = 1.5, ALONE_BURSTS = 5;

const script: LevelScriptFn = D => {
  const front = D.door('hall'), back = D.door('hall_back'), roadGate = D.door('gate_e'), backGate = D.door('gate_n'), trackGate = D.door('gate_w');
  const GUN_MARK = D.mark('hall.gun', [31.2, 0, 15.2]), MATE_MARK = D.mark('hall.mate', [31.4, 0, 14.2]);
  const JAMB = D.mark('hall.jamb', [27.5, 0, 13.3]);          // the front wall's inside face, a metre along from the doorway: where the gun's rounds go while the plan is working
  const DOORWAY_AT: [number, number, number] = [26.0, 0, 13.5], DOORWAY = D.mark('hall.doorway', DOORWAY_AT);    // the doorway itself: where they go when one stack came alone
  const ROAD_CAMP = [D.mark('road.camp0', [38.4, 0, 8.2]), D.mark('road.camp1', [38.6, 0, 11.8])], LANE_CAMP = [D.mark('lane.camp0', [19.6, 0, 1.6]), D.mark('lane.camp1', [24.4, 0, 1.6])];
  const ROAD_IN = [D.mark('road.in0', [33.4, 0, 9.5]), D.mark('road.in1', [34.0, 0, 10.6])], LANE_IN = [D.mark('lane.in0', [21.6, 0, 6.9]), D.mark('lane.in1', [22.5, 0, 6.2])];
  const POST_A = D.mark('post.a', [29.25, 0, 10.25]), POST_B = D.mark('post.b', [23.25, 0, 10.75]);
  // where a man nobody has shot yet walks on to, in the open on either side of the cover the squad was put behind
  const ROAD_ON = [D.mark('road.on0', [31.2, 0, 7.6]), D.mark('road.on1', [31.4, 0, 12.2])], LANE_ON = [D.mark('lane.on0', [22.2, 0, 8.0]), D.mark('lane.on1', [24.9, 0, 8.0])];

  // nobody on their side throws a grenade here, and nobody else is coming: what comes is the two gates' men, when the lesson says
  D.systems.theirFrags(false); D.systems.qrf(false);

  D.program('tutorial', P => {
    const alive = (c: BeatCtx, u: UnitRef | null): u is UnitRef => !!u && c.query.alive(u);
    const isOpen = (q: Query, d: DoorRef) => { const s = q.door(d); return s.open || s.broken; };

    // THE GUN ON THE FRONT DOOR. Both men of the hall are the script's from the first tick (a man the script holds neither hears the guardroom go nor
    // turns to a stack he could hear through a leaf): the gunner up behind his bags with the gun on the front doorway, his mate low beside him.
    //   · the back door opens while the gun is on the front one, or first: THE PLAN. The gun stays where it was pointed for LATE_SECS — a burst into the
    //     wall beside the front door when that one opens — and the pair at his shoulder has him.
    //   · the front door opens with no stack on the back one: ONE STACK, ALONE. The gun is laid on the doorway they are coming through, and then both
    //     men are the game's own. (A teammate the gun would put down is on a knee for a few seconds: game/rails.ts respawn.)
    P.onStart('gun');
    P.beat('gun', function* (c) {
      const m = c.unit(GUNNER), n = c.unit(MATE);
      const up = (q: Query) => [m, n].filter((u): u is UnitRef => !!u && q.alive(u));
      if (!up(c.query).length) return;
      if (alive(c, m)) { c.order(m, { goal: GUN_MARK, aimAt: DOORWAY, face: D.util.yawTo(c.query.pos(m), DOORWAY_AT), upper: 'aim' }); }
      if (alive(c, n)) c.order(n, { goal: MATE_MARK, aimAt: DOORWAY, crouch: true, upper: 'relaxed' });
      const gone = c.until(q => !up(q).length, 'the hall is down'), hit = c.until(q => up(q).length < 2 && !isOpen(q, front) && !isOpen(q, back), 'one of them is hit through a wall');
      const r = yield c.any(c.until(q => isOpen(q, back), 'the back door opens'), c.until(q => isOpen(q, front), 'the front door opens'), gone, hit);
      // (the lesson says when a stack stands on EACH door — the cue `breach` — but the gun goes by what the doors do: with the cue, a front door that moved
      //  first gets one burst into the wall beside it and BACK_SECS for the back door to swing; a front door nobody followed by the back is one stack, alone)
      const laid = c.query.signalled('lesson:breach');
      c.note(`the hall's wait ends: ${['the back door', 'the front door', 'both down', 'a man hit'][r.index]}${laid ? ', a stack on each door' : ''}`);
      let alone = r.index === 1 && !laid;
      if (r.index === 1 && laid) {
        const too = () => c.until(q => isOpen(q, back), 'the back door opens too');
        if (alive(c, m)) yield c.any(c.stimulus.burst(m, JAMB, 4, { cadence: 0.1, spread: 0.02 }), too(), gone);
        if (!isOpen(c.query, back)) yield c.any(too(), c.wait(BACK_SECS), gone);
        alone = !isOpen(c.query, back);
      }
      if (alone) {
        // ONE STACK, ALONE, by the door the gun is on: it is laid on the doorway from the moment the leaf moves and stays on it, burst after burst, until
        // the gunner is hit or somebody does come by the back
        c.note('one stack, alone: the gun is laid on its doorway');
        if (alive(c, n)) c.order(n, { goal: MATE_MARK, aimAt: DOORWAY, crouch: false, upper: 'aim' });   // (and the man beside it is up with his rifle on the same doorway)
        for (let k = 0; k < ALONE_BURSTS && alive(c, m) && !isOpen(c.query, back); k++) { yield c.any(c.stimulus.burst(m, DOORWAY, 6, { cadence: 0.09, spread: 0.03 }), c.wait(1.4), gone); yield c.any(c.wait(0.35), gone); }
        for (const u of up(c.query)) c.release(u, 'alert');
        return;
      }
      // THE PLAN (or the back door alone, which is the same thing to the gunner): he is on the front door with a pair at his shoulder, and stays on it
      // LATE_SECS — one more burst into the wall where he heard a stack — before either man of the hall is the game's own
      c.signal('done:turned');
      if (r.index < 2) {
        if (alive(c, m)) yield c.any(c.stimulus.burst(m, JAMB, 4, { cadence: 0.1, spread: 0.02 }), c.wait(1.0), gone);
        yield c.any(c.wait(LATE_SECS), gone);
      }
      // (the low man is handed back on his feet: a man left crouched behind the bags sees nobody and is seen by nobody, and the room is never taken)
      if (alive(c, n)) { c.order(n, { goal: MATE_MARK, aimAt: DOORWAY, crouch: false, upper: 'aim' }); yield c.any(c.wait(0.3), gone); }
      for (const u of up(c.query)) c.release(u, 'alert');
    });

    // THE TWO GATES. The yard's gates are shut until the men outside use them, and those men wait behind their blast walls in nobody's hands but this
    // beat's. On the cue (the squad has been faced to both gates) each pair walks in by its gate with rifles up and stands GATE_SECS in it before it is
    // the game's own: whoever was laid on that gate has them first. The last man of the four drops it and runs (runner.ts, where that rule is on).
    P.onStart('gates');
    P.beat('gates', function* (c) {
      for (const g of [roadGate, backGate, trackGate]) c.doors.lock(g, true);
      const road = ROAD.map(cs => c.unit(cs)), lane = LANE.map(cs => c.unit(cs));
      road.forEach((u, i) => { if (alive(c, u)) c.order(u, { goal: ROAD_CAMP[i], upper: 'relaxed' }); });
      lane.forEach((u, i) => { if (alive(c, u)) c.order(u, { goal: LANE_CAMP[i], upper: 'relaxed' }); });
      yield c.on('signal', 'lesson:gates');
      const men = [...road, ...lane].filter((u): u is UnitRef => alive(c, u));
      const left = (q: Query) => men.filter(u => q.alive(u) && !q.routed(u));
      let off = false;
      const one = () => c.until(q => left(q).length <= (off ? 0 : 1), 'one of them is left');
      const broke = (): boolean => { const l = left(c.query); if (!l.length) return true; if (l.length > 1 || off) return false; if (c.rout(l[0])) { c.note(`${l[0].callsign} is the last: he drops it and runs`); return true; } off = true; return false; };
      // (each gate stands open before its men are near it: a leaf swung into a man takes him out of anybody's hands — doorthrow.ts)
      for (const g of [roadGate, backGate]) { c.doors.lock(g, false); c.doors.open(g, undefined, { hold: true }); }
      yield c.wait(0.8);
      // (the man nearer his gate leads and takes the farther mark inside it, so the one behind never has to pass him between the walls)
      const walk = (us: (UnitRef | null)[], gate: [number, number], inn: typeof ROAD_IN, at: typeof POST_A) => us.filter((u): u is UnitRef => alive(c, u))
        .sort((a, b) => Math.hypot(c.query.pos(a)[0] - gate[0], c.query.pos(a)[2] - gate[1]) - Math.hypot(c.query.pos(b)[0] - gate[0], c.query.pos(b)[2] - gate[1]))
        .forEach((u, i) => c.order(u, { goal: inn[i], aimAt: at, upper: 'aim' }));
      walk(road, [35, 10], ROAD_IN, POST_A); walk(lane, [22, 5], LANE_IN, POST_B);
      yield c.any(c.until(q => left(q).every(u => q.arrived(u)), 'they are inside their gates'), one(), c.wait(25));
      c.signal('done:gates');
      if (broke()) return;
      yield c.any(one(), c.wait(GATE_SECS));
      if (broke()) return;
      for (const u of left(c.query)) c.release(u, 'alert');
      // (men still up ON_SECS later have found nobody and been found by nobody: they are walked on into the open, each pair by its own side, and let go there)
      yield c.any(one(), c.wait(ON_SECS));
      if (broke()) return;
      const on = (us: (UnitRef | null)[], to: typeof ROAD_ON, at: typeof POST_A) => us.filter((u): u is UnitRef => !!u && left(c.query).includes(u)).forEach((u, i) => c.order(u, { goal: to[i], aimAt: at, upper: 'aim' }));
      on(road, ROAD_ON, POST_A); on(lane, LANE_ON, POST_B);
      c.note('nobody has them yet: they walk on into the yard');
      yield c.any(c.until(q => left(q).every(u => q.arrived(u)), 'they are in the open'), one(), c.wait(12));
      if (broke()) return;
      for (const u of left(c.query)) c.release(u, 'alert');
      yield one();
      broke();
    });
  });
};
export default script;
