// THE FIRST TUTORIAL MISSION'S SCRIPT (levels/tut-sky.json; game/director.ts): what the road does while the player learns the view and the command key.
// One play program, 'tutorial' (game/rails.ts starts it with the mission, after a restart and after a checkpoint is put back). Every beat starts on a
// lesson step's cue and can start clean from it: the men of the roadblock are found by name, and only spawned when nobody by that name is in the world.
// Scripted rounds are real rounds (the Director's burst): they are AIMED at the squad's two trucks and the road beside them, never down the lane along
// the wall the squad runs to the gate. Imports nothing from src at run time.
import type { LevelScriptFn, BeatCtx, UnitRef, Query } from '../src/game/director';
import type { Vec3 } from '../src/math/vec';

/** the roadblock's three posts (behind the sandbags tools/levels/tut-sky.ts lays across the road) and the names its men answer to */
const POSTS: { name: string; at: Vec3 }[] = [{ name: 'Tango 6', at: [30.0, 0, 23.6] }, { name: 'Tango 7', at: [30.9, 0, 25.6] }, { name: 'Tango 8', at: [28.4, 0, 25.2] }];
/** what they shoot at while the squad is behind its trucks: the two bonnets and cabs, the road in front of them */
const AT_TRUCKS: Vec3[] = [[15.2, 0.9, 24.2], [14.4, 1.3, 24.5], [13.6, 0.7, 26.4], [12.6, 1.25, 26.5], [16.4, 0.05, 25.6], [15.6, 0.05, 27.0], [14.9, 1.0, 26.1]];
/** …and once the smoke is out: into it, and the south lane behind it (the squad's lane is the wall's) */
const AT_SMOKE: Vec3[] = [[19.5, 0.9, 25.6], [18.2, 0.6, 26.6], [16.6, 1.0, 26.4], [20.6, 1.1, 26.9], [14.0, 0.9, 26.6]];
const SQUAD = ['Red One', 'Red Two', 'Blue One', 'Blue Two'];
const YARD = { x0: 12.3, x1: 21.6, z0: 17.4, z1: 21.9 };
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
  /** the roadblock fires in turns at `marks` until `stop` */
  function* harass(c: BeatCtx, marks: Vec3[], stop: () => boolean, o: { rounds: [number, number]; gap: [number, number]; spread: number }) {
    while (!stop()) {
      const men = block(c, false); if (!men.length) return;
      const u = pick(c, men), heavy = u.callsign === 'Tango 7';
      c.order(u, { goal: null, aimAt: pick(c, marks), upper: 'aim', hot: true });
      const n = Math.round(o.rounds[0] + c.rand() * (o.rounds[1] - o.rounds[0])) * (heavy ? 2 : 1);
      yield c.stimulus.burst(u, pick(c, marks), n, { cadence: heavy ? 0.085 : 0.11, spread: o.spread });
      yield c.wait(o.gap[0] + c.rand() * (o.gap[1] - o.gap[0]));
    }
  }

  D.program('tutorial', P => {
    P.onSignal('lesson:ambush', 'ambush'); P.onSignal('lesson:break', 'break'); P.onSignal('lesson:indoors', 'indoors');

    // THE ROAD: the roadblock opens up on the two trucks and keeps it up; the squad is down behind them, heads in, until it is told to move
    P.beat('ambush', function* (c) {
      for (const u of block(c, true)) c.order(u, { goal: null, aimAt: WEST, upper: 'aim', crouch: false, hot: true, flinch: false });
      for (const u of squad(c)) c.order(u, { goal: null, crouch: true, hot: false, flinch: true });
      yield c.wait(0.6);
      const red = c.unit('Red One'); if (red) c.say(red, 'Contact front! Roadblock!', { radio: true });
      yield* harass(c, AT_TRUCKS, () => c.flag.broke === true, { rounds: [4, 7], gap: [0.35, 1.1], spread: 0.02 });
    });

    // THE BREAK: the first order. The squad's own smoke goes out, it is its own again, and the roadblock fires blind into the smoke — then comes on for
    // the gate, as men would, and the fight for it is the game's own
    P.beat('break', function* (c) {
      yield c.on('signal', e => !!e.name && e.name.startsWith('order:'));
      c.flag.broke = true;
      const by = c.unit('Red Two') ?? squad(c)[0];
      if (by) { c.say(by, 'Smoke out!', { radio: true }); c.stimulus.charge([19.8, 0, 24.8], { by, kind: 'smoke', fuse: 0.8 }); }
      const by2 = c.unit('Blue One'); if (by2 && c.query.alive(by2)) c.stimulus.charge([21.6, 0, 26.4], { by: by2, kind: 'smoke', fuse: 1.0 });
      yield c.wait(0.25);
      for (const u of squad(c)) c.release(u, 'patrol');
      const t0 = c.query.time;
      yield* harass(c, AT_SMOKE, () => c.query.time - t0 > 2.2 || squad(c).every(u => inYard(c.query, u)), { rounds: [3, 5], gap: [0.5, 1.2], spread: 0.05 });
      c.start('push');
    });
    // …the roadblock's men come on for the gate, one after another; whoever is left after a while is sent into its mouth
    P.beat('push', function* (c) {
      for (const u of block(c, false)) c.release(u, 'alert');
      yield c.any(c.wait(12), c.until(() => block(c, false).length === 0));
      // whoever is left is walked into the gate's mouth (a man who never comes is a fight nobody sees), and is his own man again once he is there
      while (block(c, false).length) {
        const left = block(c, false);
        for (const [i, u] of left.entries()) c.order(u, { goal: [19.6 + i * 0.7, 0, 21.2 - i * 0.5], speed: 2.6, aimAt: [17.6, 1.1, 20.0], upper: 'aim', hot: true });
        yield c.any(c.wait(14), c.until(q => left.every(u => !q.alive(u) || q.arrived(u))));
        for (const u of block(c, false)) c.release(u, 'alert');
        yield c.any(c.wait(8), c.until(() => block(c, false).length === 0));
      }
      c.signal('done:roadblock');
    });

    // INDOORS (and the checkpoint in the yard put back): the road is quiet. Whoever of the roadblock is somehow left is held where he stands
    P.beat('indoors', function* (c) {
      c.flag.broke = true;
      for (const u of block(c, false)) c.order(u, { goal: null, aimAt: [21.5, 1.1, 23.4], upper: 'aim', hot: false });
      yield c.wait(0.1);
      c.signal('done:roadblock');
    });
  });
};
export default script;
