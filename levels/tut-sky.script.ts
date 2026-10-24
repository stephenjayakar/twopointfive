// THE FIRST TUTORIAL MISSION'S SCRIPT (levels/tut-sky.json; game/director.ts): what the road does while the player learns the view and the command key.
// One play program, 'tutorial' (game/rails.ts starts it with the mission, after a restart and after a checkpoint is put back). Every beat starts on a
// lesson step's cue and can start clean from it: the men of the roadblock are found by name, and only spawned when nobody by that name is in the world.
// Scripted rounds are real rounds (the Director's burst): while the squad is on its knees behind its tails they are WALKED over everything a round from the
// roadblock can reach around it — both trucks' noses and screens, the road in front of them, the wall beside one file and the rail's bank past the other, the air
// over the tails — two or three rounds to a place, never a burst into one spot (ZONES: each is a box a post has a clear line into, measured, and none is
// nearer a kneeling man than a truck's width); once the squad's smoke is out, into the smoke and the south lane, never down the lane along the wall the
// squad runs to the gate. And what the bunkhouse does when the lights go: two men and two torches. Imports nothing from src at run time.
import type { LevelScriptFn, BeatCtx, UnitRef, Query } from '../src/game/director';
import type { Vec3 } from '../src/math/vec';

/** the roadblock's three posts (behind the sandbags tools/levels/tut-sky.ts lays across the road at the tunnel's mouth) and the names its men answer to
 *  (the station's own seven are Tango 1 to 7, down its rooms: game/roomclear.ts) */
const POSTS: { name: string; at: Vec3 }[] = [{ name: 'Tango 8', at: [34.0, 0, 21.6] }, { name: 'Tango 9', at: [34.9, 0, 23.6] }, { name: 'Tango 10', at: [32.4, 0, 23.2] }];
/** WHERE THE ROADBLOCK'S ROUNDS GO while the squad is behind its trucks: boxes to aim into (`by`: the posts with a clear line into it — the trucks, the
 *  sandbags and the gun truck stand in the others' — · `w`: its share of the bursts). The maintainer, playing: "would be nice if the fire wasn't at a
 *  single point, was spread around". A round aimed into a box in the air goes on to what is behind it: the wall, the snow, the road out west. Measured on
 *  this floor from each post's eye (fifteen points a box, all but the last stretch of each line clear), and none is nearer a kneeling man than a truck's width */
interface Zone { lo: Vec3; hi: Vec3; w: number; by?: string[] }
const ZONES: Zone[] = [
  { lo: [10.9, 0.4, 21.6], hi: [11.9, 1.7, 22.9], w: 3 },                                    // the north truck: nose, bonnet, screen
  { lo: [9.3, 0.4, 23.9], hi: [10.5, 1.7, 25.2], w: 3, by: ['Tango 8', 'Tango 10'] },        // the south truck's
  { lo: [12.3, 0.05, 21.6], hi: [16.0, 0.05, 23.0], w: 3, by: ['Tango 9', 'Tango 10'] },     // the road in front of them
  { lo: [11.0, 0.05, 23.6], hi: [15.5, 0.05, 24.4], w: 2, by: ['Tango 8'] },
  { lo: [3.0, 0.7, 20.5], hi: [9.0, 1.6, 20.5], w: 3 },                                      // past the north truck's flank: the road wall beside that file
  { lo: [7.5, 0.7, 25.7], hi: [11.0, 1.1, 26.1], w: 3, by: ['Tango 8'] },                    // past the south truck's: the rail's bank beside the other
  { lo: [1.5, 2.05, 22.0], hi: [1.5, 2.35, 25.0], w: 2, by: ['Tango 8', 'Tango 10'] },       // over the tails, a knee's height over a kneeling man
];
/** what the men behind the trucks call while they are pinned, in turn */
const PINNED: [string, string][] = [['Blue Two', 'Taking fire! Stay down!'], ['Red Two', 'Rounds coming past the trucks!'], ['Blue One', 'We can not stay here!']];
/** where the squad's two smokes land (between the trucks and the roadblock) · seconds before more goes out while no order has come (a can burns about 32) */
const SMOKES: Vec3[] = [[15.6, 0, 22.4], [17.8, 0, 24.2]], SMOKE_AGAIN = 27;
/** what each thrower calls, the first cans and the cans after them · seconds from a man's call to his can leaving his hand · seconds from one man's call to the next man's */
const SMOKE_CALLS = [['Throwing smoke!', 'Smoke out!'], ['More smoke!', 'Smoke out!']], SMOKE_CALLED = 0.7, SMOKE_APART = 0.45;
/** …and once the smoke is out: into it, and the south lane behind it (the squad's lane is the wall's) */
const AT_SMOKE: Vec3[] = [[15.4, 0.9, 23.6], [14.0, 0.6, 24.6], [12.4, 1.0, 24.4], [16.8, 1.1, 24.9], [9.6, 0.9, 24.6]];
const SQUAD = ['Red One', 'Red Two', 'Blue One', 'Blue Two'];
const YARD = { x0: 4.4, x1: 20.5, z0: 12.2, z1: 19.7 };
/** seconds after the squad breaks before the roadblock comes for the gate whether or not the squad has reached the yard */
const PUSH_LATEST = 14;
const WEST: Vec3 = [4.5, 1.1, 23.6];
/** the two of the bunkhouse who come out to the mains box when the lights go, the door they come by, and where each is walked to: short of the box (a
 *  hand of theirs on its lever would put the lights back), in the open yard, one behind the other */
const BUNK_MEN = ['Tango 5', 'Tango 6', 'Tango 7'], BUNK_DOOR: Vec3 = [28.6, 1.1, 16.25];
/** seconds the run back inside is given */
const TORCH_BACK = 12;
const TORCH_MEN = ['Tango 5', 'Tango 6'], TORCH_TO: Vec3[] = [[23.2, 0, 13.4], [25.6, 0, 13.5]], TORCH_LOOK: Vec3 = [27.9, 1.2, 13.2];   // (round the lorry's tail and up the lane between it and the store's wall: their lights go before them)

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
  const bunkDoor = D.door('bunk');
  const torchMen = (c: BeatCtx): UnitRef[] => TORCH_MEN.map(n => c.unit(n)).filter((u): u is UnitRef => !!u && c.query.alive(u));
  const squad = (c: BeatCtx): UnitRef[] => SQUAD.map(n => c.unit(n)).filter((u): u is UnitRef => !!u && c.query.alive(u));
  /** inside the bunkhouse's own walls · near enough to its door to be at it */
  const inBunk = (q: Query, u: UnitRef) => { const p = q.pos(u); return p[0] > 29.1 && p[0] < 35.9 && p[2] > 13.6 && p[2] < 19.9; };
  const atBunk = (q: Query, u: UnitRef) => { const p = q.pos(u); return Math.hypot(p[0] - BUNK_DOOR[0], p[2] - BUNK_DOOR[2]) < 3.6; };
  const inYard = (q: Query, u: UnitRef) => { const p = q.pos(u); return p[0] > YARD.x0 && p[0] < YARD.x1 && p[2] > YARD.z0 && p[2] < YARD.z1; };
  const pick = <T,>(c: BeatCtx, a: T[]): T => a[Math.min(a.length - 1, Math.floor(c.rand() * a.length))];
  /** the roadblock fires in turns, each burst WALKED over one of `zones` — two or three rounds to a place in it, then another place — until `stop` */
  function* rake(c: BeatCtx, zones: Zone[], stop: () => boolean, o: { rounds: [number, number]; gap: [number, number]; spread: number }) {
    const total = zones.reduce((a, z) => a + z.w, 0), mix = (a: number, b: number) => a + c.rand() * (b - a);
    while (!stop()) {
      const men = block(c, false); if (!men.length) return;
      let r = c.rand() * total, Z = zones[0]; for (const z of zones) { r -= z.w; if (r <= 0) { Z = z; break; } }
      const can = men.filter(m => !Z.by || Z.by.includes(m.callsign ?? '')); if (!can.length) { yield c.wait(0.05); continue; }   // (its posts are down: another box)
      const u = pick(c, can), heavy = u.callsign === 'Tango 9';
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
      const at = pick(c, marks), north = men.find(m => m.callsign === 'Tango 8'), u = at[2] > 24 && north ? north : pick(c, men), heavy = u.callsign === 'Tango 9';
      c.order(u, { goal: null, aimAt: at, upper: 'aim', hot: true });
      const n = Math.round(o.rounds[0] + c.rand() * (o.rounds[1] - o.rounds[0])) * (heavy ? 2 : 1);
      yield c.stimulus.burst(u, at, n, { cadence: heavy ? 0.085 : 0.11, spread: o.spread });
      yield c.wait(o.gap[0] + c.rand() * (o.gap[1] - o.gap[0]));
    }
  }

  D.program('tutorial', P => {
    P.onStart('hold');
    P.onSignal('lesson:ambush', 'ambush'); P.onSignal('lesson:smoke', 'smoke'); P.onSignal('lesson:break', 'break'); P.onSignal('lesson:indoors', 'indoors'); P.onSignal('lesson:wall', 'wall'); P.onSignal('lesson:dark', 'dark'); P.onSignal('lesson:nv', 'nv'); P.onSignal('lesson:torches', 'torches'); P.onSignal('lesson:out', 'out');

    // THE BUNKHOUSE KEEPS TO ITSELF (from the start, and again after every checkpoint, kept or put back): its three hold their marks beside their own door
    // through the whole fight for the range across the yard, which is what lets the dark be the first the squad sees of them. They are the game's own men
    // from the moment the squad comes to their door, whenever that is — the room is then a fight like any other. Only a man still INSIDE his room is held:
    // one who has been let go and is out in the yard stays his own man when the program starts again
    P.beat('hold', function* (c) {
      if (squad(c).some(u => atBunk(c.query, u) || inBunk(c.query, u))) return;
      const held = BUNK_MEN.map(n => c.unit(n)).filter((u): u is UnitRef => !!u && c.query.alive(u) && inBunk(c.query, u));
      for (const u of held) c.order(u, { goal: null, aimAt: BUNK_DOOR, upper: 'aim', hot: false });
      yield c.frames(1);
      yield c.until(q => squad(c).some(u => atBunk(q, u)));
      for (const u of held) if (c.query.alive(u) && inBunk(c.query, u)) c.release(u, 'alert');   // (still inside: one of the two with flashlights, out in the yard or on his run back, is that beat's)
    });

    // THE ROAD: the roadblock opens up on the two trucks and keeps it up, its rounds walked over the noses and screens, the road, the wall and the bank
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
    // EVERY CAN IS CALLED BY THE MAN WHO THROWS IT, a beat before it leaves his hand, and he is seen to throw it (the maintainer, playing: "guys should
    // announce that they're throwing out a smoke grenade" — one line went up before this, for the first two cans alone, on the tick they flew and the tick
    // the step's new line came up, with no sound and no arm moved; the cans that went out later came with no word). The call is the man's bubble (at the
    // view's edge with an arrow his way when the view has been panned off him), a row on the radio strip and the net's click (at his head: faint with the
    // view panned far off him). His hand is on the handset when the can leaves it. A volley once begun is finished: an order given inside it finds both cans out
    P.beat('smoke', function* (c) {
      if (c.flag.smoke) return; c.flag.smoke = true;
      const smoke = function* (again: boolean) {
        const men = squad(c), by = [c.unit('Red Two') ?? men[0], c.unit('Blue One') ?? men[1] ?? men[0]];
        const call = (i: number) => { const u = by[i]; if (u && c.query.alive(u)) c.radio(u.callsign, SMOKE_CALLS[again ? 1 : 0][i]); };   // (c.radio, not c.say: his bubble, the net's click at his head and a row under his name on the HUD's radio strip — the squad's `say` lines are a bubble alone, and one of those was missed)
        const toss = (i: number) => { const u = by[i]; if (u && c.query.alive(u)) c.stimulus.charge(SMOKES[i], { by: u, kind: 'smoke', fuse: 0.8, toss: true }); };
        call(0); yield c.wait(SMOKE_APART); call(1); yield c.wait(SMOKE_CALLED - SMOKE_APART); toss(0); yield c.wait(SMOKE_APART); toss(1);
      };
      c.start('ordered');   // (before the wait: an order given in it is still the one that breaks them out)
      yield c.wait(0.4);
      c.start('blind'); yield* smoke(false);   // (the roadblock's fire goes on through the call and the throw: started after them it left the road silent for a second and a half before any smoke was out)
      while (!c.flag.broke) { yield c.any(c.wait(SMOKE_AGAIN - SMOKE_CALLED - SMOKE_APART), c.until(() => c.flag.broke === true)); if (!c.flag.broke) yield* smoke(true); }
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
    // when they would, their sandbags were shut and the road is a lane their side knows the squad covers, so on the floor this mission had then the two behind them went round the whole halt:
    // twenty seconds of a line that asks for nothing. `direct` is the script's word for the short way).
    // The fight at the gate is the game's own; whoever is still on his feet after it is walked in again, further each time
    P.beat('push', function* (c) {
      yield c.any(c.wait(PUSH_LATEST), c.until(q => { const men = squad(c); return men.filter(u => inYard(q, u)).length >= Math.min(3, men.length); }));
      { const u = c.unit('Red One') ?? squad(c)[0]; if (u) c.say(u, 'They\'re coming for the gate. We\'ve got it.', { radio: true }); }
      for (let k = 0; block(c, false).length; k++) {
        const left = block(c, false);
        for (const [i, u] of left.entries()) {
          c.order(u, { goal: [14.6 + i * 0.7 - Math.min(1, k) * 0.9, 0, 19.2 - i * 0.5 - Math.min(1, k) * 0.6], speed: 3.4, aimAt: [11.4, 1.1, 16.4], upper: 'aim', hot: true, direct: true });
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
      for (const u of block(c, false)) c.order(u, { goal: null, aimAt: [16.5, 1.1, 21.4], upper: 'aim', hot: false });
      yield c.wait(0.1);
      c.signal('done:roadblock');
    });

    // THE WALL, THE MAINS and THE DARK: one man says what the squad has found, a breath after the line comes up (each starts clean: a checkpoint put back says it again)
    P.beat('wall', function* (c) {
      c.flag.broke = true;
      yield c.wait(0.8);
      const u = c.unit('Blue One') ?? squad(c)[0]; if (u) c.say(u, 'Store\'s locked. We need a charge on the wall.', { radio: true });
    });
    P.beat('dark', function* (c) {
      c.flag.broke = true;
      yield c.wait(0.6);
      const u = c.unit('Red One') ?? squad(c)[0]; if (u) c.say(u, 'There\'s a breaker box on the yard wall. We can kill the lights.', { radio: true });
    });
    P.beat('nv', function* (c) {
      c.flag.broke = true;
      yield c.wait(0.4);
      const u = c.unit('Red Two') ?? squad(c)[0]; if (u) c.say(u, 'Lights are out. Goggles on.', { radio: true });
    });
    // THE TORCHES (the goggles are on): the bunkhouse, which has just lost its lamps, says on its own net what men in the dark do, its door opens and the
    // two come out behind their weapon lights at a walk, for the mains box. THE PLOUGH LORRY STANDS BETWEEN THEIR DOOR AND THE YARD (the level's own
    // placement): from the box and from most of the yard the first thing seen of them is their light on the snow round its tail, then the men. Nothing is
    // done to anybody's eyes or trigger: a lit torch in a dark yard is seen by everybody, and the men with goggles on see it first. Out there they are the
    // script's until they are where they were going or one of them is hit, then the game's own — but for the one whose mate is down: THE WAY BACK below. A squad already at the bunkhouse's door has made that room a fight:
    // nothing is staged then, and the step goes by
    // THE WAY BACK (a recorded play of the maintainer's: one of the two was shot, the other was let go where he stood and stood there for the rest of the
    // mission — alert, pinned to a post he was not on, on no roster, behind the lorry where nobody had him). The one left when his mate goes down RUNS BACK
    // IN, whenever that is — on the way out, or later at the corner — and is let go inside his own room, as the men who never left it are (the 'hold'
    // beat); the door is shut behind him, never on a squad that has come to it. That is the 'inside' beat's, so the lesson's step is not kept waiting.
    // Nobody down, the two are let go at the corner as they always were: the game's own men there, who fight what their lights show them
    P.beat('torches', function* (c) {
      c.flag.broke = true;
      const men = torchMen(c).filter(u => inBunk(c.query, u));
      if (men.length && !squad(c).some(u => atBunk(c.query, u) || inBunk(c.query, u))) {
        const down = () => men.some(u => !c.query.alive(u)), gone = () => men.every(u => !c.query.alive(u));
        c.flag.torchHome = men.map(u => { const p = c.query.pos(u); return [u.callsign, p[0], p[1], p[2]]; });
        c.say(men[0], men.length > 1 ? 'Power\'s out! Two of us are going to the breaker box!' : 'Power\'s out! I\'m going to the breaker box!', { radio: true });
        for (const u of men) c.order(u, { goal: null, aimAt: BUNK_DOOR, upper: 'aim', light: true, hot: false });
        yield c.wait(1.3);
        c.doors.open(bunkDoor, undefined, { hold: true });
        for (const [i, u] of men.entries()) { c.order(u, { goal: TORCH_TO[i], speed: 1.6, aimAt: TORCH_LOOK, upper: 'aim', light: true, crouch: false, hot: false, flinch: true }); yield c.wait(0.9); }
        c.start('inside');
        yield c.any(c.wait(12), c.until(q => men.some(u => !q.alive(u)) || men.every(u => q.arrived(u))));
        if (!down()) for (const u of men) c.release(u, 'alert');   // (one down already: the other is the 'inside' beat's, on his way back)
        yield c.any(c.wait(7), c.until(gone));
        yield c.wait(0.8);
        const by = c.unit('Blue One') ?? squad(c)[0]; if (by && gone()) c.say(by, men.length > 1 ? 'Two down. They never saw us.' : 'He never saw us.', { radio: true });
      }
      c.signal('done:torches');
    });
    P.beat('inside', function* (c) {
      const men = ((c.flag.torchHome ?? []) as [string, number, number, number][]).map(([n, x, y, z]) => ({ u: c.unit(n), to: [x, y, z] as Vec3 })).filter((m): m is { u: UnitRef; to: Vec3 } => !!m.u);
      const taken = () => squad(c).some(u => atBunk(c.query, u) || inBunk(c.query, u));
      const shut = () => { if (men.every(m => !c.query.alive(m.u) || inBunk(c.query, m.u)) && !taken()) c.doors.shut(bunkDoor); };   // (the last room is a shut door again, and its third man is not left standing in an open one)
      yield c.until(q => men.some(m => !q.alive(m.u)));
      const left = men.filter(m => c.query.alive(m.u));
      // (WHOEVER IS NOT RUN BACK IS LET GO HERE: the `torches` beat lets nobody go once one of them is down, so a man this beat returned on without a
      //  word stayed the script's for good — walking to his mark by the breaker box and fighting nobody. Shot before either had left: the other is
      //  still in his room. The squad at the bunkhouse: he is in a fight where he stands)
      const free = () => { for (const m of left) c.release(m.u, 'alert'); };
      if (!left.length || left.every(m => inBunk(c.query, m.u))) { free(); shut(); return; }
      if (taken()) { free(); c.note('the bunkhouse is a fight already: the man left in the yard is the game\'s own where he stands'); return; }
      c.say(left[0].u, left.length > 1 ? 'Man down! Get back inside!' : 'Man down! I\'m going back inside!', { radio: true });
      for (const m of left) c.order(m.u, { goal: m.to, speed: 3.4, aimAt: null, upper: 'aim', light: true, crouch: false, hot: false, flinch: true });
      const pending = new Set(left);
      for (let t = 0; t < TORCH_BACK && pending.size; t += 0.2) {
        yield c.wait(0.2);
        for (const m of pending) if (!c.query.alive(m.u)) pending.delete(m); else if (c.query.arrived(m.u)) { pending.delete(m); c.release(m.u, 'alert'); }
      }
      for (const m of pending) { c.release(m.u, 'alert'); c.note(`${m.u.callsign} was not back inside in ${TORCH_BACK} s: let go where he is`); }
      shut();
    });
    P.beat('out', function* (c) {
      c.flag.broke = true;
      yield c.wait(0.4);
      const u = c.unit('Red One') ?? squad(c)[0]; if (u) c.say(u, 'House is clear.', { radio: true });
    });
  });
};
export default script;
