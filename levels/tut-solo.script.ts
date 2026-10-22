// TUT-SOLO's fights, staged (director.ts): ONE play program, 'tutorial', started with the mission, on a restart and on a checkpoint load. Every beat starts on a
// cue the lesson sends as a step comes up ('lesson:<cue>', the step's `cue` key) and starts CLEAN from it: nothing here is carried from an earlier beat but the
// program's own flags, which a restart empties. The level's five men (the roster's order: Kowalski the sentry, Novak on the gun, Reyes in the shop, Okafor
// and Lindqvist in the store) are held on their marks from the first frame and are let go, or made to shoot, beat by beat. The two who come up the road at the end
// are the only spawned men, and they come after the last checkpoint.
//
// A scripted round is a real round (combat.ts): what the sentry and the gun fire at is a PLACE the player has no reason to stand in once he has done what the
// line asks, never the player. The places the level's generator shares with this file (where the last two come in and stand) are written HERE and read there
// (tools/levels/tut-solo.ts): the page's bundle takes this file and no tool.
import type { LevelScriptFn, UnitRef, Query, BeatCtx } from '../src/game/director';
import type { Vec3 } from '../src/math/vec';

/** the van's flank as the sentry sees it through the yard gate: every line to it clears both jambs and the leaf that stands open along the gate's far
 *  side, and passes a man's width and more from where the player takes the wall beside the gate */
const VAN_FLANK: Vec3[] = [[5.5, 1.35, 13.65], [5.5, 0.85, 14.0], [5.5, 1.5, 14.35], [5.5, 1.1, 13.8]];
/** through the arch, what the gun can reach of the truck court: the parked truck and the drums on its bed */
const TRUCK: Vec3[] = [[12.4, 1.45, 18.6], [11.6, 1.5, 19.2], [13.2, 1.4, 18.3], [12.0, 1.55, 18.9]];
/** along the sandbags, a point every 0.6 m: a hand over their top, so over a crouched head and through a standing chest. The gun walks its fire up and down
 *  this line (traversing fire: no man walks its length standing between two passes) */
const BAGS_TOP: Vec3[] = [16.6, 17.2, 17.8, 18.4, 19.0, 19.6, 20.2, 20.8].map((x): Vec3 => [x, 1.45, 13.6]);
/** the gap between the sandbags and the barrier, where a man crossing it is: hosed without a pause until the smoke is up. Eight lanes a hand apart, shin to
 *  belt (a crouched man is no smaller to them), two rounds a lane: no man is across between two passes. The nearest lane is a man's width east of the
 *  sandbags' end (a round for the gap never crosses the place the line before asked him to crouch in), the farthest clears the barrier's corner */
const GAP_FLOOR: Vec3[] = [[21.55, 0.5, 13.75], [21.95, 0.75, 13.8], [21.75, 0.45, 13.75], [22.1, 0.7, 13.85], [21.65, 0.8, 13.7], [22.05, 0.5, 13.8], [21.85, 0.65, 13.75], [21.6, 0.6, 13.75]];
/** where he was: the sandbags' near end (the gun fires blind once the smoke is up) */
const WAS: Vec3[] = [[17.2, 1.3, 13.2], [18.4, 1.3, 13.4], [16.8, 1.42, 13.6]];
/** THE LAST TWO come through the building behind him once he is back at the arch: where they come onto the floor (the store, 15 m and more from the arch: off
 *  his screen), where they stand (the shop's doorway, one a step behind the other: each has his own line out through it) and what each shoots at until the
 *  grenade or a round finds one of them: the top of the arch's wall either side of its mouth, a man's height and more over anyone standing in it */
export const LAST_IN: Vec3[] = [[32.6, 0, 13.9], [33.6, 0, 14.7]], LAST_MEN: Vec3[] = [[25.7, 0, 13.98], [26.5, 0, 14.5]];
const ARCH_HEAD: Vec3[][] = [[[16.0, 2.2, 12.5], [16.0, 2.1, 12.0], [16.0, 2.25, 12.3]], [[16.0, 2.2, 16.0], [16.0, 2.1, 16.5], [16.0, 2.25, 16.2]]];
/** the shop's doorway and the doorway in the wall between the shop and the store, chest high */
const SHOP_DOORWAY: Vec3 = [25.4, 1.2, 14.25], PART_DOORWAY: Vec3 = [30.5, 1.2, 14.25];

const script: LevelScriptFn = D => {
  const shopLine = D.volume('shop_line'), shopIn = D.volume('shop_in'), storeIn = D.volume('store_in');
  const roadEast = D.volume('road_east'), roadNose = D.volume('road_nose');
  const rifleman = D.loadout('rifleman', { team: 'guard', weapon: 'akms' });
  const STAFF = ['Kowalski', 'Novak', 'Reyes', 'Okafor', 'Lindqvist'];
  const AIMS: Record<string, Vec3> = { Kowalski: VAN_FLANK[1], Novak: TRUCK[0], Reyes: SHOP_DOORWAY, Okafor: PART_DOORWAY, Lindqvist: PART_DOORWAY };

  // a man told to aim somewhere turns his whole body to it (an order's `aimAt` alone is his arms and his eyes: he would shoot over his shoulder)
  const aim = (c: BeatCtx, u: UnitRef, at: Vec3, hot = false) => c.order(u, { aimAt: at, upper: 'aim', face: D.util.yawTo(c.query.pos(u), at), ...(hot ? { hot } : {}) });

  D.program('tutorial', P => {
    P.onStart('hold');
    for (const cue of ['road', 'cease', 'gun', 'bags', 'gap', 'blind', 'shop', 'room', 'trucks', 'loose']) P.onSignal(`lesson:${cue}`, cue);

    // every man on his mark, his gun on the way the player will come, until his own beat lets him go (a man a beat has ordered is the program's until it lets
    // him go, fails or stops: this beat's end hands nobody back)
    P.beat('hold', function* (c) {
      for (const n of STAFF) { const u = c.unit(n); if (u && c.query.alive(u)) c.order(u, { goal: null, aimAt: AIMS[n], upper: 'aim', face: D.util.yawTo(c.query.pos(u), AIMS[n]) }); }
      yield c.frames(1);
    });

    // THE ROAD: the sentry has seen the van's driver run and is putting rounds into it, until the player is at the yard wall ('cease': the gate is then the
    // player's to lean round, and one hit puts a man down). He never looks for anyone else: the first man is a free one.
    P.beat('cease', function* (c) { c.flag.cease = true; yield c.frames(1); });
    P.beat('road', function* (c) {
      const s = c.unit('Kowalski'); if (!s) return;
      // (his rounds cross the road east of the van and nowhere else. Nothing there tells a new player to keep off it, so while the player is on that side,
      //  or coming round the van's nose to it, he holds his fire: three rounds are over before a running man is across the margin the two volumes leave)
      const lane = () => c.query.inside(roadEast, 'sam') || c.query.inside(roadNose, 'sam');
      yield c.wait(0.8);
      for (let i = 0; c.query.alive(s) && !c.flag.cease; i++) {
        if (lane()) { yield c.wait(0.2); continue; }
        const at = VAN_FLANK[i % VAN_FLANK.length]; aim(c, s, at, true);
        yield c.stimulus.burst(s, at, 3, { cadence: 0.12, spread: 0.02 });
        yield c.wait(1.3 + c.rand() * 1.1);
      }
      yield c.until(q => !q.alive(s), 'the sentry is down');
    });

    // THE GUN: one man on a belt-fed gun in the far corner of the next court. What he shoots at is the lesson of the step that is up.
    P.beat('gun', function* (c) {
      const u = c.unit('Novak'); if (!u) return;
      yield c.wait(0.5);
      for (let k = BAGS_TOP.length - 1, dir = -1, i = 0; c.query.alive(u); i++) {
        const mode = c.flag.gun as string | undefined;
        // (the lesson decides nothing here but WHERE the rounds go: every one of them is a real round)
        if (mode === 'bags') {          // the traverse: a short burst a point, there and back along the sandbags' top
          const at = BAGS_TOP[k]; k += dir; if (k <= 0 || k >= BAGS_TOP.length - 1) dir = -dir;
          aim(c, u, at, true);
          yield c.stimulus.burst(u, at, 4, { cadence: 0.08, spread: 0.01 }); yield c.wait(0.1);
        } else if (mode === 'gap') {    // the gap, hosed: nobody is meant to try it before the smoke
          const at = GAP_FLOOR[i % GAP_FLOOR.length]; aim(c, u, at, true);
          yield c.stimulus.burst(u, at, 2, { cadence: 0.08, spread: 0.006 }); yield c.wait(0.08);   // (a burst's first round leaves at once: the pause is the gun's own beat between the last of one and the first of the next)
        } else {                        // the parked truck through the arch, and (blind, slower) where he was before the smoke went up
          const pts = mode === 'blind' ? WAS : TRUCK, at = pts[Math.floor(c.rand() * pts.length) % pts.length];
          aim(c, u, at, true);
          yield c.stimulus.burst(u, at, mode === 'blind' ? 5 : 8, { cadence: 0.1, spread: 0.022 });
          yield c.wait(mode === 'blind' ? 1.6 + c.rand() : 0.7 + c.rand() * 0.7);
        }
      }
    });
    P.beat('bags', function* (c) { c.flag.gun = 'bags'; yield c.frames(1); });
    P.beat('gap', function* (c) { c.flag.gun = 'gap'; yield c.frames(1); });
    P.beat('blind', function* (c) { c.flag.gun = 'blind'; yield c.frames(1); });

    // THE SHOP: the man behind the door, in the doorway's line. The charge folds him; he is held until the player steps into that line (or the shop) and a second
    // more, then he is the AI's own. Nobody is shot at while he reads the line beside the door.
    P.beat('shop', function* (c) {
      const u = c.unit('Reyes'); if (!u) return;
      const down = () => c.until((q: Query) => !q.alive(u), 'he is down');
      const r = yield c.any(c.until((q: Query) => q.inside(shopLine, 'sam') || q.inside(shopIn, 'sam'), 'the player is in his line'), down());
      if (r.index === 0) yield c.any(c.wait(1.0), down());
      if (c.query.alive(u)) c.release(u, 'alert');
    });

    // THE STORE: two men hold the room on its doorway, where the shop cannot see them. A stun can that goes off in their room folds them: they are his until he
    // has been in the room two seconds, or a breath after one of them is hit. A man who walks in with no can gone off is shot from both sides as he comes through.
    const pair = (c: { unit(n: string): UnitRef | null }) => ['Okafor', 'Lindqvist'].map(n => c.unit(n)).filter((u): u is UnitRef => !!u);
    P.beat('room', function* (c) {
      const men = pair(c); if (!men.length) return;
      const hit = () => c.until((q: Query) => men.some(u => !q.alive(u)), 'one of the pair is down');
      const inside = () => c.until((q: Query) => q.inside(storeIn, 'sam'), 'the player is in the store');
      const r = yield c.any(c.on('bang', e => e.pos[0] > PART_DOORWAY[0]), hit(), inside());
      if (r.index === 0) { const r2 = yield c.any(inside(), hit()); yield c.any(c.wait(r2.index === 0 ? 2.0 : 0.6), hit()); }
      else if (r.index === 1) yield c.wait(0.6);
      for (const u of men) if (c.query.alive(u)) c.release(u, 'alert');
    });

    // THE WAY OUT: he is back at the arch with the code book and the launcher loaded when two more come out through the building behind him and stand in the
    // shop's doorway, shooting the head of the arch's wall over him: a doorway with two men in it, 8.5 m and more off, which is what the grenade is for. They
    // are the AI's once one of them is down.
    P.beat('loose', function* (c) { c.flag.loose = true; yield c.frames(1); });
    P.beat('trucks', function* (c) {
      yield c.wait(0.4);
      // (found by name first: a beat starts clean from its cue, and nobody is spawned twice. Each keeps his own place and his own piece of wall)
      const men = LAST_IN.map((p, k) => { const name = ['Brandt', 'Marsh'][k]; return { k, u: c.unit(name) ?? c.spawn(rifleman, p, { yaw: -Math.PI / 2, callsign: name }) }; }).filter(m => c.query.alive(m.u));
      if (!men.length) return;
      const all = men.length, up = () => men.filter(m => c.query.alive(m.u)).length;
      for (const m of men) c.order(m.u, { goal: LAST_MEN[m.k], speed: 3.4, aimAt: ARCH_HEAD[m.k][0], upper: 'aim', hot: true });
      yield c.any(c.until((q: Query) => men.every(m => !q.alive(m.u) || q.arrived(m.u)), 'in the doorway'), c.wait(6));
      // the show: until one of them is hit or the line has gone by ('loose'), however long he takes over the launcher
      for (let i = 0; up() === all && !c.flag.loose; i++) {
        const shots = men.map(m => { const at = ARCH_HEAD[m.k][i % ARCH_HEAD[m.k].length]; c.order(m.u, { aimAt: at, face: D.util.yawTo(c.query.pos(m.u), at) }); return c.stimulus.burst(m.u, at, 4, { cadence: 0.14, spread: 0.008 }); });
        yield c.any(c.all(...shots), c.until(() => up() < all, 'one of them is down'));
        yield c.any(c.wait(0.9 + c.rand() * 0.6), c.until((q: Query) => up() < all || !!q.flag('loose'), 'the show is over'));
      }
      yield c.wait(0.6);
      for (const m of men) if (c.query.alive(m.u)) c.release(m.u, 'alert');
    });
  });
};
export default script;
