// The truck park's own voices. Nobody is held, moved or spawned: every man does what the game's rules make him do, and a
// beat is a few words said by men who are still at their work. So a beat can start fresh from its cue (a checkpoint load
// plays it again), and a man who is down, in an arm or looking for the pair says nothing.
//
// What each is for: `gate` tells the player by ear that the man at the pickup is one of several; `park` that the two at
// the lantern talk to each other (each knows where the other stands); `yard` that the last man is alone and has noticed
// nothing.
import type { LevelScriptFn, BeatCtx, UnitRef } from '../src/game/director';

const script: LevelScriptFn = D => {
  D.program('tutorial', P => {
    /** the man by name, if he is still at his work */
    const calm = (c: BeatCtx, callsign: string): UnitRef | null => {
      const u = c.unit(callsign); if (!u) return null;
      return c.query.state(u) === 'patrol' ? u : null;
    };
    P.onSignal('lesson:gate', 'gate');
    P.beat('gate', function* (c) {
      yield c.wait(1.5);
      if (!calm(c, 'Kowalski') || !calm(c, 'Novak')) return;
      c.radio('Novak', 'Kowalski. tea is up');
      yield c.wait(2.6);
      const a = calm(c, 'Kowalski'); if (a) c.say(a, 'in a minute');
    });

    P.onSignal('lesson:park', 'park');
    P.beat('park', function* (c) {
      yield c.wait(1.2);
      const a = calm(c, 'Novak'); if (!a || !calm(c, 'Reyes')) return;
      c.say(a, 'anything out there?');
      yield c.wait(2.4);
      const b = calm(c, 'Reyes'); if (b && calm(c, 'Novak')) c.say(b, 'nothing. cold');
    });

    P.onSignal('lesson:yard', 'yard');
    P.beat('yard', function* (c) {
      yield c.wait(1.4);
      const a = calm(c, 'Okafor'); if (a) c.say(a, 'long night');
    });
  });
};
export default script;
