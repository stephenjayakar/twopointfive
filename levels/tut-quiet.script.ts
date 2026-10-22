// The ledger's own voices. Nobody is held, moved or spawned: every man does what the game's rules make him do, and a beat
// is a few words said by men who are still at their work. So a beat can start fresh from its cue (a checkpoint load plays
// it again), and a man who is down, in an arm or looking for the player says nothing.
//
// What each is for: `lane` puts a voice behind the wall the player creeps along (a man is THERE, and has not looked up);
// `store` tells him by ear, from the dark, that the lit room ahead holds two men and that the near one is talking the
// other way; `dark` is the clerk calling a man who will not answer.
import type { LevelScriptFn, BeatCtx, UnitRef } from '../src/game/director';

const script: LevelScriptFn = D => {
  D.program('tutorial', P => {
    /** the man by name, if he is still at his work */
    const calm = (c: BeatCtx, callsign: string): UnitRef | null => {
      const u = c.unit(callsign); if (!u) return null;
      return c.query.state(u) === 'patrol' ? u : null;
    };
    /** the man by name, if he is on his feet and not hunting anybody (the clerk on his errand to the box) */
    const unworried = (c: BeatCtx, callsign: string): UnitRef | null => {
      const u = c.unit(callsign); if (!u) return null;
      const s = c.query.state(u); return s === 'patrol' || s === 'suspicious' ? u : null;
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

    P.onSignal('lesson:store', 'store');
    P.beat('store', function* (c) {
      yield c.wait(1.4);
      const a = calm(c, 'Kowalski'); if (!a) return;
      c.say(a, 'Reyes. how long?');
      yield c.wait(2.4);
      const b = calm(c, 'Reyes'); if (b && calm(c, 'Kowalski')) c.say(b, 'still counting');
    });

    P.onSignal('lesson:dark', 'dark');
    P.beat('dark', function* (c) {
      yield c.wait(3.2);
      const a = unworried(c, 'Reyes'); if (!a) return;
      c.say(a, 'Kowalski? the lights');
      yield c.wait(4.2);
      const b = unworried(c, 'Reyes'); if (b) c.say(b, '... Kowalski?');
    });
  });
};
export default script;
