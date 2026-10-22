// THE FIRST TUTORIAL MISSION'S SCRIPT (levels/tut-sky.json; game/director.ts): what the road does while the player learns the view and the command key.
// One play program, 'tutorial' (game/rails.ts starts it with the mission, after a restart and after a checkpoint is put back). Every beat starts on a
// lesson step's cue and can start clean from it: the men of the roadblock are found by name, and only spawned when nobody by that name is in the world.
// Scripted rounds are real rounds (the Director's burst): while the squad is on its knees behind its tails they are WALKED over everything a round from the
// roadblock can reach around it — both trucks' noses and screens, the road in front of them, the wall beside one file and the lane past the other, the air
// over the tails — two or three rounds to a place, never a burst into one spot (ZONES: each is a box a post has a clear line into, measured, and none is
// nearer a kneeling man than a truck's width); once the squad's smoke is out, into the smoke and the south lane, never down the lane along the wall the
// squad runs to the gate. Imports nothing from src at run time.
import type { LevelScriptFn, BeatCtx, UnitRef, Query } from '../src/game/director';
import type { Vec3 } from '../src/math/vec';

/** the roadblock's three posts (behind the sandbags tools/levels/tut-sky.ts lays across the road) and the names its men answer to */
const POSTS: { name: string; at: Vec3 }[] = [{ name: 'Tango 6', at: [30.0, 0, 23.6] }, { name: 'Tango 7', at: [30.9, 0, 25.6] }, { name: 'Tango 8', at: [28.4, 0, 25.2] }];
/** WHERE THE ROADBLOCK'S ROUNDS GO while the squad is behind its trucks: boxes to aim into (`by`: the posts with a clear line into it — the trucks, the
 *  sandbags and the gun truck stand in the others' — · `w`: its share of the bursts). The maintainer, playing: "would be nice if the fire wasn't at a
 *  single point, was spread around" — the old list was fifteen points and most of them lay behind a truck's nose from where the round came, so four
 *  rounds in seven hit one bonnet. A round aimed into a box in the air goes on to what is behind it: the wall, the snow, the road out west */
interface Zone { lo: Vec3; hi: Vec3; w: number; by?: string[] }
const ZONES: Zone[] = [
  { lo: [14.2, 0.4, 23.6], hi: [15.2, 1.7, 24.9], w: 3 },                                    // the north truck: nose, bonnet, screen
  { lo: [12.8, 0.4, 25.9], hi: [14.0, 1.7, 27.2], w: 3, by: ['Tango 6'] },                   // the south truck's
  { lo: [15.8, 0.05, 23.6], hi: [19.5, 0.05, 25.0], w: 3 },                                  // the road in front of them
  { lo: [14.5, 0.05, 25.6], hi: [19.0, 0.05, 26.4], w: 2, by: ['Tango 6'] },
  { lo: [6.5, 0.7, 22.5], hi: [12.5, 1.6, 22.5], w: 3, by: ['Tango 7', 'Tango 8'] },        // past the north truck's flank: the wall beside that file
  { lo: [11.0, 0.7, 27.9], hi: [14.5, 1.1, 28.5], w: 3, by: ['Tango 6'] },                   // past the south truck's: the lane beside the other
  { lo: [5.0, 2.05, 24.0], hi: [5.0, 2.35, 27.0], w: 2 },                                    // over the tails, a knee's height over a kneeling man
];
/** what the men behind the trucks call while they are pinned, in turn */
const PINNED: [string, string][] = [['Blue Two', 'Taking fire! Stay down!'], ['Red Two', 'Rounds coming past the trucks!'], ['Blue One', 'We can not stay here!']];
/** where the squad's two smokes land (between the trucks and the roadblock) · seconds before more goes out while no order has come (a can burns about 32) */
const SMOKES: Vec3[] = [[19.8, 0, 24.8], [21.6, 0, 26.4]], SMOKE_AGAIN = 27;
/** …and once the smoke is out: into it, and the south lane behind it (the squad's lane is the wall's) */
const AT_SMOKE: Vec3[] = [[19.5, 0.9, 25.6], [18.2, 0.6, 26.6], [16.6, 1.0, 26.4], [20.6, 1.1, 26.9], [14.0, 0.9, 26.6]];
const SQUAD = ['Red One', 'Red Two', 'Blue One', 'Blue Two'];
const YARD = { x0: 12.3, x1: 21.6, z0: 17.4, z1: 21.9 };
/** seconds after the squad breaks before the roadblock comes for the gate whether or not the squad has reached the yard */
const PUSH_LATEST = 14;
const WEST: Vec3 = [8, 1.1, 25.6];

const script: LevelScriptFn = D => {
  const rifle = D.loadout('roadblock', { team: 'hostile', weapon: 'akms', light: false });
  const yaw = -Math.PI / 2;
  D.systems.qrf(false);   // nobody is called: every man on this floor is one the mission put there

  /** the men of the roadblock on their feet, by name (spawned once: a checkpoint put back has them already) */
  const block = (c: BeatCtx, spawn: boolean): UnitRef[] => {
    const out: UnitRef[] = [];
    for (const P of POSTS) { let u = c.unit(P.name); if (!u && spawn) u = c.spawn(rifle, P.at, { callsign: P.name, yaw, light: false }); if (u && c.query.alive(u)) out.push(u); }
    return out;
  };
  const squad = (c: BeatCtx): UnitRef[] => SQUAD.map(n => c.unit(n)).filter((u): u is UnitRef => !!u && c.query.alive(u));
  const inYard = (q: Query, u: UnitRef) => { const p = q.pos(u); return p[0] > YARD.x0 && p[0] < YARD.x1 && p[2] > YARD.z0 && p[2] < YARD.z1; };
  const pick = <T,>(c: BeatCtx, a: T[]): T => a[Math.min(a.length - 1, Math.floor(c.rand() * a.length))];
  /** the roadblock fires in turns, each burst WALKED over one of `zones` — two or three rounds to a place in it, then another place — until `stop` */
  function* rake(c: BeatCtx, zones: Zone[], stop: () => boolean, o: { rounds: [number, number]; gap: [number, number]; spread: number }) {
    const total = zones.reduce((a, z) => a + z.w, 0), mix = (a: number, b: number) => a + c.rand() * (b - a);
    while (!stop()) {
      const men = block(c, false); if (!men.length) return;
      let r = c.rand() * total, Z = zones[0]; for (const z of zones) { r -= z.w; if (r <= 0) { Z = z; break; } }
      const can = men.filter(m => !Z.by || Z.by.includes(m.callsign ?? '')); if (!can.length) { yield c.wait(0.05); continue; }   // (its posts are down: another box)
      const u = pick(c, can), heavy = u.callsign === 'Tango 7';
      let left = Math.round(mix(o.rounds[0], o.rounds[1])) * (heavy ? 2 : 1);
      while (left > 0 && !stop() && c.query.alive(u)) {
        const at: Vec3 = [mix(Z.lo[0], Z.hi[0]), mix(Z.lo[1], Z.hi[1]), mix(Z.lo[2], Z.hi[2])], n = Math.min(left, c.rand() < 0.5 ? 2 : 3); left -= n;
        c.order(u, { goal: null, aimAt: at, upper: 'aim', hot: true });
        yield c.stimulus.burst(u, at, n, { cadence: heavy ? 0.085 : 0.11, spread: o.spread });
        yield c.wait(mix(0.05, 0.16));
      }
      yield c.wait(mix(o.gap[0], o.gap[1]));
    }
  }
  /** the roadblock fires in turns at `marks` until `stop` */
  function* harass(c: BeatCtx, marks: Vec3[], stop: () => boolean, o: { rounds: [number, number]; gap: [number, number]; spread: number }) {
    while (!stop()) {
      const men = block(c, false); if (!men.length) return;
      // (a mark in the south lane is the north post's: from the other two the gun truck stands in the line)
      const at = pick(c, marks), north = men.find(m => m.callsign === 'Tango 6'), u = at[2] > 26 && north ? north : pick(c, men), heavy = u.callsign === 'Tango 7';
      c.order(u, { goal: null, aimAt: at, upper: 'aim', hot: true });
      const n = Math.round(o.rounds[0] + c.rand() * (o.rounds[1] - o.rounds[0])) * (heavy ? 2 : 1);
      yield c.stimulus.burst(u, at, n, { cadence: heavy ? 0.085 : 0.11, spread: o.spread });
      yield c.wait(o.gap[0] + c.rand() * (o.gap[1] - o.gap[0]));
    }
  }

  D.program('tutorial', P => {
    P.onSignal('lesson:ambush', 'ambush'); P.onSignal('lesson:smoke', 'smoke'); P.onSignal('lesson:break', 'break'); P.onSignal('lesson:indoors', 'indoors'); P.onSignal('lesson:wall', 'wall'); P.onSignal('lesson:dark', 'dark'); P.onSignal('lesson:nv', 'nv'); P.onSignal('lesson:out', 'out');

    // THE ROAD: the roadblock opens up on the two trucks and keeps it up, its rounds walked over the noses and screens, the road, the wall and the lane
    // beside the two files, the air over their heads (rake, ZONES).
    // The squad is on its knees behind its tails (the frame holds it there: rails.sky.low) and says so, until its smoke is out
    P.beat('ambush', function* (c) {
      for (const u of block(c, true)) c.order(u, { goal: null, aimAt: WEST, upper: 'aim', crouch: false, hot: true, flinch: false });
      for (const u of squad(c)) c.order(u, { goal: null, crouch: true, hot: false, flinch: true });
      yield c.wait(0.6);
      const red = c.unit('Red One'); if (red) c.say(red, 'Contact front! Roadblock!', { radio: true });
      c.start('pinned');
      yield* rake(c, ZONES, () => c.flag.smoke === true || c.flag.broke === true, { rounds: [5, 9], gap: [0.2, 0.7], spread: 0.014 });
    });
    P.beat('pinned', function* (c) {
      for (let k = 0; !c.flag.smoke && !c.flag.broke; k++) {
        yield c.any(c.wait(5.5 + c.rand() * 2), c.until(() => c.flag.smoke === true || c.flag.broke === true)); if (c.flag.smoke || c.flag.broke) return;
        const [who, line] = PINNED[k % PINNED.length], u = c.unit(who); if (u && c.query.alive(u)) c.say(u, line, { radio: true });
      }
    });

    // THE SMOKE, THEN THE BREAK: the squad's own smoke goes out while the player is still looking down the road (the step before the first order), so the
    // line that asks for the move comes up with it standing, and the move is made behind it (more goes out while no order comes). The roadblock fires blind
    // into the smoke — and, the squad gone through the gate, comes on for it, as men would: that fight is the game's own
    P.beat('smoke', function* (c) {
      if (c.flag.smoke) return; c.flag.smoke = true;
      const smoke = () => { const men = squad(c), by = [c.unit('Red Two') ?? men[0], c.unit('Blue One') ?? men[1] ?? men[0]];
        SMOKES.forEach((at, i) => { const u = by[i]; if (u && c.query.alive(u)) c.stimulus.charge(at, { by: u, kind: 'smoke', fuse: 0.8 + i * 0.2 }); }); };
      c.start('ordered');   // (before the wait: an order given in it is still the one that breaks them out)
      yield c.wait(0.5);
      { const by = c.unit('Red Two') ?? squad(c)[0]; if (by) c.say(by, 'Smoke out!', { radio: true }); }
      smoke(); c.start('blind');
      while (!c.flag.broke) { yield c.any(c.wait(SMOKE_AGAIN), c.until(() => c.flag.broke === true)); if (!c.flag.broke) smoke(); }
    });
    P.beat('break', function* (c) {
      if (!c.flag.smoke) c.start('smoke');
      yield c.until(() => c.flag.broke === true);
      yield c.wait(0.25);
      for (const u of squad(c)) c.release(u, 'patrol');
      yield c.any(c.wait(2.2), c.until(q => squad(c).every(u => inYard(q, u))));
      c.flag.through = true;
      c.start('push');
    });
    P.beat('ordered', function* (c) { yield c.on('signal', e => !!e.name && e.name.startsWith('order:')); c.flag.broke = true; });
    // (the fire stops while the squad runs the wall's lane for the gate: kept up south of that lane it still put a man of the squad on a knee one seed in
    //  six, and the squad then never set in the yard. Scripted rounds are real rounds)
    P.beat('blind', function* (c) { yield* harass(c, AT_SMOKE, () => c.flag.through === true, { rounds: [3, 5], gap: [0.5, 1.2], spread: 0.05 }); });
    // …the roadblock's men come on for the gate AS THE SQUAD SETS in the yard, one after another through the gap in their own sandbags and down the road
    // into its mouth, and each is his own man there (the maintainer, playing: "this beat is too long, unclear what to do" — they were first left to come
    // when they would, their sandbags were shut and the road is a lane their side knows the squad covers, so the two behind them went round the whole halt:
    // twenty seconds of a line that asks for nothing. `direct` is the script's word for the short way).
    // The fight at the gate is the game's own; whoever is still on his feet after it is walked in again, further each time
    P.beat('push', function* (c) {
      yield c.any(c.wait(PUSH_LATEST), c.until(q => { const men = squad(c); return men.filter(u => inYard(q, u)).length >= Math.min(3, men.length); }));
      { const u = c.unit('Red One') ?? squad(c)[0]; if (u) c.say(u, 'They are coming for the gate. We have it.', { radio: true }); }
      for (let k = 0; block(c, false).length; k++) {
        const left = block(c, false);
        for (const [i, u] of left.entries()) {
          c.order(u, { goal: [19.6 + i * 0.7 - Math.min(1, k) * 0.9, 0, 21.2 - i * 0.5 - Math.min(1, k) * 0.6], speed: 3.4, aimAt: [17.6, 1.1, 20.0], upper: 'aim', hot: true, direct: true });
          if (i < left.length - 1) yield c.any(c.wait(0.7), c.until(() => block(c, false).length === 0));
        }
        yield c.any(c.wait(k ? 5 : 7), c.until(q => left.every(u => !q.alive(u) || q.arrived(u))));
        for (const u of block(c, false)) c.release(u, 'alert');
        yield c.any(c.wait(4), c.until(() => block(c, false).length === 0));
      }
      c.signal('done:roadblock');
    });

    // INDOORS (and the checkpoint in the yard put back): the road is quiet. Whoever of the roadblock is somehow left is held where he stands
    P.beat('indoors', function* (c) {
      c.flag.broke = true; c.flag.smoke = true; c.flag.through = true;
      for (const u of block(c, false)) c.order(u, { goal: null, aimAt: [21.5, 1.1, 23.4], upper: 'aim', hot: false });
      yield c.wait(0.1);
      c.signal('done:roadblock');
    });

    // THE WALL, THE MAINS and THE DARK: one man says what the squad has found, a breath after the line comes up (each starts clean: a checkpoint put back says it again)
    P.beat('wall', function* (c) {
      c.flag.broke = true;
      yield c.wait(0.8);
      const u = c.unit('Blue One') ?? squad(c)[0]; if (u) c.say(u, 'Store is locked. Charge on the wall.', { radio: true });
    });
    P.beat('dark', function* (c) {
      c.flag.broke = true;
      yield c.wait(0.6);
      const u = c.unit('Red One') ?? squad(c)[0]; if (u) c.say(u, 'Mains box, on the yard wall. We can kill the lights.', { radio: true });
    });
    P.beat('nv', function* (c) {
      c.flag.broke = true;
      yield c.wait(0.4);
      const u = c.unit('Red Two') ?? squad(c)[0]; if (u) c.say(u, 'Lights are out. Goggles on.', { radio: true });
    });
    P.beat('out', function* (c) {
      c.flag.broke = true;
      yield c.wait(0.4);
      const u = c.unit('Red One') ?? squad(c)[0]; if (u) c.say(u, 'House is clear.', { radio: true });
    });
  });
};
export default script;
