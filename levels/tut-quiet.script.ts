// The ledger's own voices, and the one man it stages.
//
// THE VOICES hold, move and spawn nobody: a beat is a few words said by men who are still at their work. So a beat can start fresh from its cue (a
// checkpoint load plays it again), and a man who is down, in an arm or looking for the player says nothing. `lane` puts a voice behind the wall the player
// creeps along (a man is THERE, and has not looked up); `store` tells him by ear, from the dark, that the lit room ahead holds two men and that the near
// one is talking the other way. (When the mains go the clerk's calls to a man who will not answer are the game's own: nothing here adds to them.)
//
// THE MAN WHO COMES TO THE WHISTLE (`night`). The game's own rule sends the court's man to stand where the sound was. Here that is on the player's own
// prints in the snow, his light on them and his back a stride from the wall the player hides behind. So this file takes him as he sets off: he comes
// round the long wall as he would have, stops a stride short of the gap in the cross wall, puts his light through it and over the place, five metres off,
// finds nothing, turns round, walks back up the strip to his chair at its far end, clicks his torch off and has a smoke there with his back to the gap. Then he goes back to
// his fire, the game's own man again.
// A man a script walks sees and hears nothing by himself (squad.ts runGuardScript), so what he would have seen and heard is written here: the player in
// front of him or in his light, or past him the way he faces; boots on the snow behind him; a second whistle. Any of them hands him back to the game with
// his gun out. The places are the level's (tools/levels/tut-quiet.ts: TQ.look, TQ.smoke, TQ.whistle and its three volumes).
import type { LevelScriptFn, BeatCtx, UnitRef, Query } from '../src/game/director';
import type { Vec3 } from '../src/math/vec';

/** where he looks from, where he smokes, and the lane's side of the level: a whistle blown east of the cross wall is the game's own business */
const LOOK: Vec3 = [26.4, 0, 17.75], SMOKE: Vec3 = [30.6, 0, 17.7], CROSS_WALL_X = 25.5;
/** how long he looks, how long the smoke lasts, and how far off boots are heard by a man with his back turned: a run, and a walk upright (a crouched
 *  step is under both lines: `level` is the gait's times the floor's, player.ts) */
const LOOK_SECS = 3.6, SMOKE_SECS = 50, RUN = { level: 0.34, within: 6 }, WALK = { level: 0.14, within: 2.4 };

const script: LevelScriptFn = D => {
  const walk = D.volume('tq_walk'), beam = D.volume('tq_beam'), past = D.volume('tq_past');
  D.program('tutorial', P => {
    /** the man by name, if he is still at his work */
    const calm = (c: BeatCtx, callsign: string): UnitRef | null => {
      const u = c.unit(callsign); if (!u) return null;
      return c.query.state(u) === 'patrol' ? u : null;
    };
    P.onSignal('lesson:lane', 'lane');
    P.beat('lane', function* (c) {
      yield c.wait(1.2);
      const a = calm(c, 'Novak'); if (!a) return;
      c.say(a, 'cold tonight');
      yield c.wait(3.6);
      if (!calm(c, 'Novak') || !calm(c, 'Kowalski')) return;
      c.radio('Kowalski', 'anything out back?');
      yield c.wait(2.4);
      const b = calm(c, 'Novak'); if (b) c.say(b, 'nothing. quiet');
    });

    P.onStart('night');
    P.beat('night', function* (c) {
      const u = c.unit('Novak'); if (!u) return;
      /** he is the player's (grabbed, or down): nothing more is asked of him */
      const taken = (q: Query) => !q.alive(u) || q.signalled('lesson:held');
      const gone = () => c.until(taken, 'he is taken');
      /** he has come round the long wall's end: from here the walk and the lane are in front of him */
      const inStrip = (q: Query) => q.pos(u)[2] < 18.5;
      /** the player on the walk or in the strip as he comes down it, his torch ahead of him; and, once he has his light through the gap, in the lane too */
      const met = () => c.until(q => inStrip(q) && q.inside(walk, 'sam'), 'the player is in front of him');
      const lit = () => c.until(q => q.inside(walk, 'sam') || q.inside(beam, 'sam'), 'the player is in his light');
      let at: Vec3 | null = null;
      for (;;) {
        if (!at) {   // a whistle from the lane, and the game's own rule has sent him to look (it sends the nearest calm man who hears it, once)
          const w = yield c.any(c.on('whistle', e => e.pos[0] < CROSS_WALL_X), gone());
          if (w.index !== 0 || !w.event) return;
          yield c.any(c.wait(0.9), gone());   // (his start and his word at it are the game's)
          if (taken(c.query)) return;
          if (c.query.state(u) !== 'suspicious') continue;
          at = [w.event.pos[0], 0.1, w.event.pos[2]];
        }
        // round the wall to the gap, his torch up
        c.order(u, { goal: LOOK, face: D.util.yawTo(LOOK, at), aimAt: null, upper: 'torch', light: true, smoke: false });
        let r = yield c.any(c.until(q => q.arrived(u), 'he is at the gap'), met(), gone(), c.wait(40));
        if (r.index === 2) return;
        if (r.index === 1) { c.release(u, 'alert'); return; }
        if (r.index === 3) { c.release(u, 'patrol'); at = null; continue; }   // (he never got there: his own man again)
        // his light through the gap and over the place
        c.order(u, { aimAt: at });
        r = yield c.any(c.wait(LOOK_SECS), lit(), gone());
        if (r.index === 2) return;
        if (r.index === 1) { c.release(u, 'alert'); return; }
        c.say(u, 'nothing. wind');
        // his back to the gap, and a smoke
        c.order(u, { goal: SMOKE, face: Math.PI / 2, aimAt: null, upper: 'none', light: true, smoke: true });   // (the torch comes down to his side, as a calm man carries it; smokebreak.ts: his left hand, the lit end and the smoke are that file's, once he stands there)
        const heard = (e: { level: number; near(p: Vec3, within: number): boolean }) => { const p = c.query.pos(u);
          return (e.level >= RUN.level && e.near(p, RUN.within)) || (e.level >= WALK.level && e.near(p, WALK.within)); };
        const turns = () => [c.until(q => q.inside(past, 'sam'), 'the player is past him'), gone(), c.on('step', heard), c.on('whistle')];
        // at his chair he clicks the torch off: a man having a smoke does not stand there lighting the wall. It burns again the moment he moves off:
        // a second whistle's order above asks for it, and let go he is the game's own man with the game's own light
        r = yield c.any(c.until(q => q.arrived(u), 'he is at his chair'), ...turns(), c.wait(SMOKE_SECS));
        if (r.index === 0) { c.order(u, { light: false }); r = yield c.any(c.wait(SMOKE_SECS), ...turns()); }
        if (r.index === 2) return;
        if (r.index === 1 || r.index === 3) { c.release(u, 'alert'); return; }
        if (r.index === 4 && r.event) { at = [r.event.pos[0], 0.1, r.event.pos[2]]; continue; }   // a second whistle: he looks again, and at where THIS one was
        // the smoke is done: his own man again, back to his fire
        c.release(u, 'patrol'); at = null;
      }
    });

    P.onSignal('lesson:store', 'store');
    P.beat('store', function* (c) {
      yield c.wait(1.4);
      const a = calm(c, 'Kowalski'); if (!a) return;
      c.say(a, 'Reyes. how long?');
      yield c.wait(2.4);
      const b = calm(c, 'Reyes'); if (b && calm(c, 'Kowalski')) c.say(b, 'still counting');
    });
  });
};
export default script;
