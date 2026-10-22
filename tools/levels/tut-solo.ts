// TUT-SOLO — the tutorial's solo loud mission, "Alone, loud": THE FUEL HALT. One man, a rifle with a launcher, a pistol, a smoke, a stun can, two frags and
// one door charge, walked along ONE LINE: the road and its shot-up van, the yard gate, the truck court, the arch, the gun court, the shop's locked door, the
// store behind it, and back out the way he came with the halt's code book. One new action a step, each inside a fight that is a size bigger than the last:
// a sentry who cannot see him, a gun that can, a gun's nest for a frag, a door for a charge, a room for a stun can, and two men at his back for the launcher.
//
// THE SENTENCE NOBODY COULD SAY OF ANOTHER LEVEL: every piece of cover on it is the lesson for the key that uses it.
// THE HAND PLACEMENT: the fights are the level's script (levels/tut-solo.script.ts): the five men of the roster are held on their marks until their beat, so the
// first of every list here is the only deal there is. The sentry stands in the gate's line and nowhere near cover; the gun's cone through the arch falls on the
// parked truck and never on the way to the arch's near jamb; the sandbags, the gap and the barrier are one crouch, one smoke and one frag long.
//
//        x 0        9          16              25          30.5        36
//   z 5             ┌──────────┬───────────────┬──────────────────────┐
//         pumps     │  truck   │  nest ▒▒ gun  │ (the generator)      │
//         ▢ ▢       │  court   │               ├───────────┬──────────┤ z 10.5
//   road ═ van ═ gate_w  ▮ sentry  ▒▒▒sandbags▒  gap ▓▓ shop door  shop  ·  store ▣ trunk
//                   │   jersey │ arch          │           │          │
//         start     │  pickup  │               ├───────────┴──────────┤ z 17.5
//   z 23            └──────────┴───────────────┴──────────────────────┘
//
//   bun run tools/levels/export.ts tut-solo [--check]      → levels/tut-solo.json
//   bun run tools/qa/lesson-check.ts tut-solo              the lesson block against the built floor
//   bun run tools/qa/lesson-run.ts tut-solo                the scripted player through every step to the debrief
//   page: ?levelFile=tut-solo.json&quiet&hour=dusk&weather=dust
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef, PatrolRoute } from '../../src/scene/level';
import type { LevelScenarios, LessonData, LessonStep, QuietData, Rect, IssueData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS, GW_SHELL } from '../../src/scene/gwotKit';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';
import { findCarLamps } from '../../src/game/carlamps';
import { LAST_IN, LAST_MEN } from '../../levels/tut-solo.script';

export const NAME = 'tut-solo';
export const NOTES = 'The tutorial\'s solo loud mission: a walled fuel halt on a road, walked along one line (road, gate, truck court, arch, gun court, shop, store) and back out. Its fights are staged by levels/tut-solo.script.ts. Regenerate: bun run tools/levels/export.ts tut-solo';
export const MATERIALS = GWOT_MATERIALS;

const HALF = Math.PI / 2;
/** the yard inside its wall, and the two cross walls */
export const YARD: Rect = { x0: 9, x1: 36, z0: 5, z1: 23 };
/** THE LINE the mission is walked along: the yard gate, the arch, the shop's door and the store's doorway are all centred on it (a door's middle sits on a
 *  walk-grid cell: z 14.25, never 14) */
export const AXIS = 14.25;
const DOORWAY = { a: AXIS - 0.6, b: AXIS + 0.6 }, HINGE = AXIS - 0.58;
const ARCH_X = 16, FRONT_X = 25, PART_X = 30.5, ROOM_Z0 = 10.5, ROOM_Z1 = 17.5;

// ---- the marks the level, its script and its scripted player all read ----
/** where he starts: on the road at the van's open back doors, in the light of its load bay, facing up the van to the forecourt. Well inside the world's edge
 *  (the first picture is the van, its lamps on the pumps and the gate's fire, not the dark past the road's end), and the first walk is UP the screen: a mark
 *  toward the camera from him sits under the big line */
export const START: Vec3 = [4.35, 0, 19.0];
/** behind the shot-up van's cab (step 'move') */
export const VAN: Vec3 = [3.0, 0, 13.2];
/** the yard wall beside the gate (the sprint's end, the wall he takes): the side of the gate the road runs along. A rifle is carried on the right, so a
 *  man facing in through the gate from THIS jamb has his gun in the opening; from the other jamb it is behind the frame and stays at the low ready */
export const WALL: Vec3 = [8.35, 0, 12.2];
/** the gate's near corner: the end of that wall, which he leans round */
export const CORNER: Vec3 = [8.9, 1.2, AXIS - 0.6];
/** the sentry, in the gate's line */
export const SENTRY: Vec3 = [13.9, 0, AXIS];
/** beside the blue gate, out of the gun's cone (steps 'arch', 'crouch') */
export const JAMB: Vec3 = [15.1, 0, 11.7];
/** the far end of the sandbags (step 'low') */
export const BAGS_END: Vec3 = [20.2, 0, 13.6];
/** where the smoke goes: the gap itself, on the gun's line to it. On floor he can see from behind the sandbags' end: the ring is the place to click */
export const GAP: Vec3 = [21.9, 0.1, 12.7];
/** the lamp he shoots out with the pistol: on its pole by the shop's front, over where he stands clear of the charge */
export const LAMP: Vec3 = [24.4, 3.2, 17.7];
/** behind the barrier (steps 'cross', 'back') */
export const BARRIER: Vec3 = [23.3, 0, 13.9];
/** beside the shop's door: out of the charge's backblast (1.6 m) and out of the doorway's line, which the man inside is looking down (step 'back') */
export const BACK: Vec3 = [24.45, 0, 16.0];
/** the gun's nest and the man on the gun */
export const NEST: Vec3 = [22.6, 0.4, 7.0];
export const GUNNER: Vec3 = [22.7, 0, 6.9];
/** the shop's door (the charge), the man behind it, the doorway to the store (the stun can), the two men in there */
export const SHOP_DOOR: Vec3 = [FRONT_X, 1.0, AXIS];
export const SHOP_MAN: Vec3 = [27.7, 0, AXIS];
export const STORE_DOORWAY: Vec3 = [31.6, 0.2, AXIS];
/** (neither can be seen, or shot, from outside the shop: the two doorways' cone misses both. The first stands in the near corner, 3 m from where a man
 *  stands at the trunk: a body within arm's reach outranks the trunk on the interaction key's tap, and the line there asks for a tap) */
export const STORE_MEN: Vec3[] = [[31.4, 0, 11.5], [33.6, 0, 16.3]];
/** the trunk the code book is in: the store's far corner, OFF the mission's line (the doorways make that line a gallery the length of the yard) */
export const TRUNK: Vec3 = [35.3, 0, 11.5];
/** THE LAST FIGHT IS BEHIND HIM, AND TO THE RIGHT OF THE SCREEN. The launcher's grenade arms 8 m out, and that is the edge of what the camera shows: only up the
 *  mission's line (east) does the view reach it, clear of the kit panel. So he is sent back to the arch first, and the last two come out through the building
 *  he has just cleared and stand in the shop's doorway, 8.5 m and more from anywhere the arch's line lets him stand: on the screen, armed, one grenade's worth. */
export const ARCH_MOUTH: Vec3 = [16.5, 0, AXIS];
/** the shop's doorway from outside: where the launcher's grenade goes */
export const LAST_COVER: Vec3 = [25.9, 1.0, AXIS];
/** where they stand behind it, and where they come onto the floor: the level's script's own numbers (it is the file the page takes) */
export { LAST_MEN, LAST_IN };
/** the way out: the yard gate he came in by */
export const EXIT = { name: 'the road', door: 'gate_w', x: 8.2, z: AXIS, out: [-1, 0] as [number, number] };

/** THE TUTORIAL FRAME'S KEYS, a step each: `allow` turns actions on for the rest of the mission (from the first step he can walk, and turn and zoom the view as the first mission taught him: `rails.allow`),
 *  `cue` goes to the level's script as the step comes up ('lesson:<cue>'), `checkpoint` names the one save of a beat. Four checkpoints, each where he has
 *  just finished a fight and nobody alive can see him: the gate (the sentry is down), the gun (the nest is out), the shop (its man is down), the store (the
 *  building is his). */
export const FRAME: Record<string, { allow?: string[]; cue?: string; checkpoint?: string }> = {
  move: { cue: 'road' }, ready: { allow: ['slot:rifle'] }, sprint: { allow: ['sprint'] }, wall: { allow: ['wall'], cue: 'cease' }, peek: { allow: ['aim'] }, fire: { allow: ['fire'] },
  reload: { allow: ['reload'], checkpoint: 'the gate' }, auto: { allow: ['mode'] }, arch: { cue: 'gun' }, crouch: { allow: ['crouch'], cue: 'bags' },
  smoke: { allow: ['slot:smoke'], cue: 'gap' }, cross: { cue: 'blind' }, frag: { allow: ['slot:frag'] },
  pistol: { allow: ['slot:pistol'], checkpoint: 'the gun' }, charge: { allow: ['use'] }, blow: { allow: ['word'] }, shop: { cue: 'shop' },
  stun: { allow: ['slot:flash'], cue: 'room', checkpoint: 'the shop' }, store: {},
  take: { checkpoint: 'the store' }, load: { allow: ['alt'], cue: 'trucks' }, last: { cue: 'loose' },
};

const SHOP: Rect = { x0: FRONT_X, x1: PART_X, z0: ROOM_Z0, z1: ROOM_Z1 }, STORE: Rect = { x0: PART_X, x1: YARD.x1, z0: ROOM_Z0, z1: ROOM_Z1 };

/** HIS KIT (game/kit.ts kitIssue): one of each can the steps ask for and one to spare of what a first throw may waste */
export const ISSUE: IssueData = { members: { '0': { weapon: 'rifle', smoke: 2, bangs: 2, frags: 2, shells: 3, charges: 1 } } };

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), P = GWOT_PALETTE, H = WORLD.ceilingY, M = GWOT_MATERIALS, t = GW_SHELL / 2;
  const { grp, add, slab, doorFrame, lights, switchables } = K;
  const doors: LevelDoorDef[] = [];
  const zones: SurfacesData['zones'] = [];

  // ---- the ground: the plain, the road, the forecourt, the yard's three floors ----
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, P.dust, { rough: 1 });
  G.ground(0, 12.3, YARD.x0, 15.7, 'gravel');                       // the road, up to the gate
  G.ground(1.6, 7.6, 8.2, 12.2, 'slab');                            // the forecourt under the pumps
  G.ground(YARD.x0, YARD.z0, ARCH_X, YARD.z1, 'dirt');              // the truck court
  G.ground(ARCH_X, YARD.z0, FRONT_X, YARD.z1, 'gravel');            // the gun court
  G.ground(FRONT_X, YARD.z0, YARD.x1, ROOM_Z0, 'dirt'); G.ground(FRONT_X, ROOM_Z1, YARD.x1, YARD.z1, 'dirt');   // the two back lots
  G.ground(YARD.x1, 12.4, 40, 16.1, 'dirt');                        // the lane behind the halt, at the store's back door: it runs off the map
  G.ruts(9.6, 13.2, 15.6, 14.8); G.ruts(0.4, 13.2, 8.6, 14.8, 'gravel');

  // ---- the yard wall, the gate in it, the two cross walls ----
  grp('walls.yard');
  const gate = [{ ...DOORWAY, y0: 0, y1: 2.2 }];
  G.yardWallX(YARD.z0, YARD.x0 - 0.12, YARD.x1 + 0.12); G.yardWallX(YARD.z1, YARD.x0 - 0.12, YARD.x1 + 0.12);
  G.yardWallZ(YARD.x0, YARD.z0, YARD.z1, 'mud', gate); G.yardWallZ(YARD.x1, YARD.z0, ROOM_Z0, 'mud'); G.yardWallZ(YARD.x1, ROOM_Z1, YARD.z1, 'mud');
  for (const [x, z] of [[9, 5], [9, 23], [36, 5], [36, 23], [16, 5], [16, 23], [25, 5], [25, 23]] as const) G.pier(x, z);
  // the yard gate stands open, out along the road: the sentry's line down it. Hung on the jamb AWAY from the wall he takes, so the corner he leans round is bare
  doors.push({ name: 'gate_w', hinge: [YARD.x0, AXIS + 0.58], closedDir: -HALF, width: 1.16, exterior: true, angle: -1.45, closer: false });
  // the lane's two walls, off the map's edge: nobody walks round the halt from the back door, and nobody comes to it but by the lane
  G.yardWallX(12.4, YARD.x1 + 0.12, 40); G.yardWallX(16.1, YARD.x1 + 0.12, 40);
  grp('walls.arch');
  G.yardWallZ(ARCH_X, YARD.z0, AXIS - 1.6, 'mudLight'); G.yardWallZ(ARCH_X, AXIS + 1.6, YARD.z1, 'mudLight');   // the arch: a truck's width, no leaf
  G.pier(ARCH_X, AXIS - 1.6); G.pier(ARCH_X, AXIS + 1.6);
  G.gate(ARCH_X + 0.06, AXIS, 'z', 3.2, 1, 'paintBlue', 84);
  grp('walls.front');
  G.yardWallZ(FRONT_X, YARD.z0, ROOM_Z0, 'mud'); G.yardWallZ(FRONT_X, ROOM_Z1, YARD.z1, 'mud');

  // ---- the forecourt on the road: two pumps under a tin canopy, the van that was at them ----
  grp('forecourt');
  G.pump(4.0, 9.9, HALF); G.pump(6.2, 9.9, HALF);
  for (const [x, z] of [[2.4, 8.2], [7.6, 8.2], [2.4, 11.6], [7.6, 11.6]] as const) add({ c: [x, 1.6, z], h: [0.05, 1.6, 0.05], ...M.galv });
  slab(2.1, 3.2, 7.9, 7.9, 3.32, 11.9, P.tin, { flags: BoxFlag.NoPrimary, rough: 0.6 });
  G.tube(4.0, 9.9, true, 'exterior', true, true); G.tube(6.2, 9.9, true, 'exterior', true);
  G.drums(2.3, 9.2, 3); G.jerryCan(7.4, 10.6, 0.4); G.jerryCan(7.6, 10.2, -0.2, 'drumRed'); G.tyres(2.2, 11.2, 3);
  G.patch(5.0, 10.4, 3.4, 2.0, 'oil', 0.2, 0.019);
  grp('forecourt.van');
  // across the road, nose to the pumps it was leaving: his first cover, and what the sentry's rounds chew. It is as its driver left it, everything on: two
  // head lamps (beams across the forecourt), the tail lamps, the lamp in the load bay over its open back doors, which is the light he starts in. Each lens
  // is a glowing sliver a hair off the van's own and a little wider, so a round at a lamp meets the sliver first and puts it out; the van's own lens behind
  // it stays the dead glass the lamp check finds (carlamps.ts, whose own search finds the lenses here: the kit's sizes are named in one place)
  const VAN_AT = [4.5, 15.0] as const, van0 = K.boxes.length; G.van(VAN_AT[0], VAN_AT[1], HALF + 0.12);
  { const lenses = findCarLamps(K.boxes.slice(van0)).map(l => ({ what: l.what, b: K.boxes[van0 + l.box] })), heads = lenses.filter(l => l.what === 'head lamp').map(l => l.b), tails = lenses.filter(l => l.what === 'tail lamp').map(l => l.b);
    if (heads.length !== 2 || tails.length !== 2) throw new Error(`tut-solo: the van's lamps were not found (${heads.length} head, ${tails.length} tail): the kit's lenses have moved`);
    const mid = [(heads[0].c[0] + heads[1].c[0]) / 2, (heads[0].c[2] + heads[1].c[2]) / 2], l = Math.hypot(mid[0] - VAN_AT[0], mid[1] - VAN_AT[1]), nx = (mid[0] - VAN_AT[0]) / l, nz = (mid[1] - VAN_AT[1]) / l;
    heads.forEach((b, k) => {
      const fb = add({ c: [b.c[0] + nx * 0.04, b.c[1], b.c[2] + nz * 0.04], h: [0.008, b.h[1] + 0.006, b.h[2] + 0.006], yaw: b.yaw, ...M.plasticWhite, emissive: [34, 31, 24], flags: BoxFlag.NoShadow });
      lights.push({ kind: 'spot', pos: [b.c[0] + nx * 0.08, b.c[1], b.c[2] + nz * 0.08], dir: norm([nx, -0.1, nz]), color: [1.0, 0.93, 0.78], intensity: 150, range: 14, innerDeg: 12, outerDeg: 30, name: `van_lamp_${k}`, group: 'exterior', enabled: true, volumetric: 0.35, fixtureBox: fb, radius: 0.06, mains: false });
    });
    tails.forEach((b, k) => {   // (each a small red light of its own, so a round puts the glow out as it does any lamp's)
      const fb = add({ c: [b.c[0] - nx * 0.03, b.c[1], b.c[2] - nz * 0.03], h: [0.006, b.h[1] + 0.006, b.h[2] + 0.006], yaw: b.yaw, albedo: [0.5, 0.05, 0.04], rough: 0.4, emissive: [7, 0.4, 0.25], flags: BoxFlag.NoShadow });
      lights.push({ kind: 'point', pos: [b.c[0] - nx * 0.1, b.c[1], b.c[2] - nz * 0.1], dir: [0, -1, 0], color: [1.0, 0.12, 0.08], intensity: 1.6, range: 3, innerDeg: 0, outerDeg: 180, name: `van_tail_${k}`, group: 'exterior', enabled: true, volumetric: 0, fixtureBox: fb, radius: 0.04, mains: false });
    });
    const bay: Vec3 = [VAN_AT[0] - nx * 2.3, 1.84, VAN_AT[1] - nz * 2.3];
    const bayLens = add({ c: bay, h: [0.07, 0.012, 0.07], ...M.plasticWhite, emissive: [22, 19, 13], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'point', pos: [bay[0], bay[1] - 0.05, bay[2]], dir: [0, -1, 0], color: [1.0, 0.86, 0.62], intensity: 16, range: 6, innerDeg: 0, outerDeg: 180, name: 'van_bay', group: 'exterior', enabled: true, volumetric: 0.2, fixtureBox: bayLens, radius: 0.05, mains: false });
  }
  G.patch(4.4, 15.3, 3.0, 4.6, 'oil', 0.1, 0.019); G.rubble(5.9, 16.6, 0.5, 5);
  G.lantern(8.55, 11.0, 'lantern_road', 'exterior');                // at the wall's foot beside the gate: the wall he takes is a lit wall

  // ---- the truck court: the sentry's post, a barrier across the gate's line, the parked truck the gun finds ----
  grp('court.truck');
  G.jersey(12.5, AXIS, 2, HALF);
  G.pickup(12.6, 19.2, 0.25, 'truckWhite', { load: 'drums' });
  G.drums(10.2, 21.6, 4); G.tyres(15.2, 21.8, 4); G.crates(10.0, 6.4, 0.1, 3); G.gasBottle(11.0, 6.2); G.gasBottle(11.4, 6.5);
  G.sacks(14.6, 6.5, 0.2, 4); G.patch(12.4, 18.8, 4.2, 2.6, 'oil', 0.3, 0.019);
  G.lantern(14.6, 13.0, 'lantern_sentry', 'yard', 0);
  G.floodLight(15.5, 22.6, [-0.6, -0.8], 'flood_court', true, 3.6);   // (in the corner by the arch's wall, thrown back across the truck court: from the far corner it went over that wall and lit the gun court's south half, the shop's door with it)

  // ---- the gun court: the nest in the far corner, the sandbags inside the arch, the gap, the barrier before the shop ----
  grp('court.gun');
  G.sandbags(22.6, 8.2, 3.0, 0, 4); G.sandbags(21.0, 7.2, 2.0, HALF, 4);            // the nest: two low walls, the gun between them
  G.crates(24.0, 6.2, 0.1, 2); G.patch(22.6, 7.0, 2.6, 2.0, 'damp');
  G.sandbags(18.675, 12.2, 4.75, 0, 6);                                            // inside the arch, chest high: a crouched man behind them is out of the gun's sight (a hand north of the gate's open leaf, which stands along them)
  G.hesco(23.4, 12.6, 2, 0);                                                       // the barrier before the shop's door
  G.drumDown(17.6, 16.8, 0.4); G.tyres(19.4, 17.4, 2); G.handcart(20.6, 20.4, 0.5, 'sacks'); G.woodPile(17.2, 21.8, 0.1); G.drums(24.2, 21.6, 3);
  G.blocks(17.4, 6.4, 0.1, 3); G.jerryCan(18.2, 6.2, 0.6);

  // the gun court's own lamp: a mast by the shop's corner, its arm out over the court, the head between the nest and the gap. It lights the gun, the sandbags'
  // far end and the gap, and stops short of the shop's door: the ground he stands on for the door is lit by the shop's lamp alone (the line that has him shoot it out)
  { const x = 22.3, z = 9.9, h = 4.6, px = 24.6;
    add({ c: [px, (h + 0.11) / 2, z], h: [0.05, (h + 0.11) / 2, 0.05], ...M.galv });
    add({ c: [(px + x) / 2, h + 0.085, z], h: [(px - x) / 2 + 0.1, 0.025, 0.025], ...M.galv });
    add({ c: [x, h + 0.06, z], h: [0.2, 0.05, 0.2], ...M.plasticBlack });
    const fb = add({ c: [x, h, z], h: [0.12, 0.012, 0.12], ...M.plasticWhite, emissive: [40, 34, 22], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x, h - 0.03, z], dir: [0, -1, 0], color: [1.0, 0.8, 0.5], intensity: 120, range: 10, innerDeg: 34, outerDeg: 58, name: 'lamp_gun', group: 'exterior', enabled: true, volumetric: 0.25, fixtureBox: fb, radius: 0.1, mains: false });
  }

  // ---- the shop and the store behind it: one building against the yard's far wall ----
  grp('shop.floor'); G.ground(SHOP.x0, SHOP.z0, STORE.x1, SHOP.z1, 'slab', 0.006);
  grp('shop.roof'); slab(SHOP.x0 - 0.1, H, SHOP.z0 - 0.1, STORE.x1 + 0.1, H + 0.2, SHOP.z1 + 0.1, P.render, { flags: BoxFlag.NoPrimary, rough: 0.95 });
  grp('shop.walls');
  G.wallX(ROOM_Z0, FRONT_X - t, YARD.x1 + t, 'render'); G.wallX(ROOM_Z1, FRONT_X - t, YARD.x1 + t, 'render');
  // (one window, on the door's far side from where the charge's line stands him: the wall he waits against is blank. The maintainer, of a window there:
  //  "weird that we're standing here right in front of the window here he can shoot us")
  G.wallZ(FRONT_X, ROOM_Z0 + t, ROOM_Z1 - t, 'render', [{ a: 11.2, b: 12.5, y0: 0.9, y1: 2.0, glass: 'whole' }, DOORWAY]);
  // the store's back door, on the mission's line: steel, shut and locked from the store's side until the last two come in by it from the lane behind the halt
  // (the maintainer: "it doesn't make sense that the enemies spawn there though. maybe we have another door on the far room and show them coming from
  //  outside of the map and then running at you"). Steel: no boot, pick or charge of his opens it, so it is never his way out
  G.wallZ(YARD.x1, ROOM_Z0 + t, ROOM_Z1 - t, 'render', [DOORWAY]);
  doors.push({ name: 'store', hinge: [YARD.x1, HINGE], closedDir: HALF, width: 1.16, locked: true, keySide: 1, swing: 1, steel: true, exterior: true, closer: false });
  G.wallZ(PART_X, ROOM_Z0 + t, ROOM_Z1 - t, 'render', [DOORWAY]);   // the doorway to the store: no leaf (a full wall, not a partition: a round that misses in the shop stops in it)
  doors.push({ name: 'shop', hinge: [FRONT_X, HINGE], closedDir: HALF, width: 1.16, locked: true, closer: false });   // (no closer: once it is open the doorway is a line of fire for the rest of the mission)
  G.dado('z', FRONT_X, 10.6, AXIS - 0.5, -1, 'paintGreen'); G.dado('z', FRONT_X, AXIS + 0.5, 17.4, -1, 'paintGreen');
  zones.push({ id: 'shop', mat: 'stone', x0: SHOP.x0, z0: SHOP.z0, x1: STORE.x1, z1: SHOP.z1 });
  grp('shop.room');
  G.table(27.2, 16.6, 1.8, 0.7, 0); G.crates(29.6, 11.2, 0.1, 2); G.plasticChair(26.2, 16.4, 0.2); G.sacks(26.0, 11.2, 0.1, 3);
  G.bulb(27.8, AXIS, 'bulb_shop', 'shop');
  grp('store.room');
  G.trunk(TRUNK[0], TRUNK[2], HALF, 'paintGreen');
  G.crates(35.2, 15.75, 0.1, 3); G.crates(31.4, 16.8, 0.2, 2); G.drums(35.2, 16.8, 2); G.jerryCan(33.6, 11.0, 0.3);
  G.bulb(33.4, AXIS, 'bulb_store', 'store');
  grp('lots');
  G.generator(30.0, 7.4, 0.1); G.waterTank(32.6, 20.6);

  // ---- a place somebody lives and works in (the maintainer: a tutorial level has "just as much (if not more! since it's first impression) polish and
  //  [should] really feel great and organic"). ADDITIONS ONLY, every one off the mission's line, off each man's mark and out of every door's sweep: none
  //  of it is cover a line asks for, and none of it changes a fight (tools/qa/tut-solo-check.ts plays every way through it) ----
  grp('dress.road');     // the roadside: a melon stall by the forecourt, scrub along the verge
  G.stall(1.9, 21.8, 0.12, 2.2, 'tarpBlue'); G.bush(1.1, 17.4); G.bush(0.9, 24.4, 0.8); G.bush(7.4, 23.6, 0.9); G.tyres(7.2, 19.8, 2);
  grp('dress.truck');    // the truck court's north corner: where the gate's men sit out a watch
  G.charpoy(10.7, 8.6, 0.12); G.lowTable(11.9, 9.5, 0.3); G.stove(12.9, 8.3); G.plasticChair(12.4, 10.4, 2.6); G.jerryCan(13.6, 8.4, 0.2);
  grp('dress.shop');     // the shop is the room they live in: a stove, a floor mattress and tea, a rug under the table, a hanging on the wall
  G.rug(27.5, 16.2, 3.4, 1.9, 'afghan'); G.toshak(29.3, 16.95, 1.9, 0); G.lowTable(29.2, 16.1, 0.1); G.stove(28.4, 11.15);
  G.wallHanging('x', ROOM_Z0, 27.6, 1, 'baluch', 1.4, 0.9); G.gasBottle(30.0, 12.6);
  grp('dress.store');    // the store: flour and rice against the wall, a mat by the trunk
  G.sacks(32.6, 11.15, 0.1, 4); G.rug(34.4, 12.2, 1.2, 1.6, 'mat', HALF); G.gasBottle(30.95, 16.0);
  grp('dress.lots');     // the two back lots nobody walks into: the cook's yard behind the gun, the wash yard by the tank
  G.tandoor(34.6, 6.5); G.charpoy(33.2, 9.0, 0.08, 'rugNavy'); G.woodPile(27.0, 9.6, 0.1); G.satDish(26.2, 6.2, 0.6); G.bush(35.1, 9.5, 0.8);
  G.wire(30.0, 7.9, 30.0, ROOM_Z0); G.lantern(32.0, 7.8, 'lantern_cook', 'exterior');
  G.washLine(26.6, 19.3, 30.2, 19.3, 5); G.motorbike(34.6, 18.7, 0.5); G.bush(26.0, 22.2); G.bush(35.2, 22.3, 0.8); G.sacks(29.6, 22.2, 0.1, 3);
  G.lantern(30.9, 19.0, 'lantern_wash', 'exterior');

  // ---- light: the moon the hour swaps for its sun, a lamp over the gate and one over the shop's door ----
  grp('lights');
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.62, -0.5, -0.6]), color: [0.55, 0.7, 1.0], intensity: 0.22, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });
  const lamp = (x: number, z: number, name: string, h = 3.4, outerDeg = 52, side = -1) => {
    add({ c: [x, (h + 0.11) / 2, z + side * 0.6], h: [0.04, (h + 0.11) / 2, 0.04], ...M.galv });
    add({ c: [x, h + 0.085, z + side * 0.3], h: [0.025, 0.025, 0.26], ...M.galv });
    add({ c: [x, h + 0.06, z], h: [0.2, 0.05, 0.2], ...M.plasticBlack });
    const fb = add({ c: [x, h, z], h: [0.12, 0.012, 0.12], ...M.plasticWhite, emissive: [40, 34, 22], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x, h - 0.03, z], dir: [0, -1, 0], color: [1.0, 0.8, 0.5], intensity: 90, range: 9, innerDeg: outerDeg - 22, outerDeg, name, group: 'exterior', enabled: true, volumetric: 0.25, fixtureBox: fb, radius: 0.1, mains: false });
  };
  lamp(10.4, 12.2, 'lamp_gate'); lamp(LAMP[0], LAMP[2], 'lamp_shop', LAMP[1], 46, 1);   // (its pole on the far side of its head: clear of the way from beside the door to the doorway, and of a pistol's line to the lamp from behind the barrier)

  // ---- the breaker and the beacon every level carries (the generator's lot, behind the shop: nobody is sent there) ----
  grp('breaker');
  const brk = add({ c: [28.0, 1.35, 10.34], h: [0.28, 0.36, 0.04], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const led = add({ c: [27.82, 1.62, 10.29], h: [0.015, 0.015, 0.015], albedo: P.plasticBlack, rough: 0.5, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  grp('beacons');
  add({ c: [20.5, 2.28, 5.18], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow });
  const dome = add({ c: [20.5, 2.16, 5.2], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow });
  switchables.push({ name: 'beacon0', boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });

  // ---- five men, each on his mark until the script calls his beat (levels/tut-solo.script.ts names them by roster order) ----
  const post = (name: string, p: Vec3, weapon?: PatrolRoute['weapon']): PatrolRoute => ({ name, points: [p, [p[0] + 0.3, 0, p[2] + 0.2]], wait: [600, 600], ...(weapon ? { weapon } : {}) });
  const routes: PatrolRoute[] = [post('sentry', SENTRY), post('gunner', GUNNER, 'pkm'), post('shop', SHOP_MAN), post('store_a', STORE_MEN[0]), post('store_b', STORE_MEN[1])];

  const front: Vec3 = [TRUNK[0] - 0.44, 0.45, TRUNK[2]];
  const quiet: QuietData = {
    thing: 'the code book',
    starts: [{ name: 'the road', sam: START, samYaw: Math.PI }],
    spots: [{ place: 'the store', area: { x0: STORE.x0 + t, x1: STORE.x1 - t, z0: STORE.z0 + t, z1: STORE.z1 - t }, door: 'shop', holder: 'the green trunk', rackIndex: 0, front, halfW: 0.3 }],
    exits: [EXIT],
    patrols: [routes.map(r => r.name)],
    radioCheck: false,
  };

  const DOWN = (n: number) => ({ is: 'men', down: n } as const);
  const BEHIND: Rect = { x0: 22.3, x1: 24.6, z0: 13.3, z1: 15.3 };
  /** where a smoke can hides the gap from the gun: the court between the two, the gap itself included (a can thrown back the way he came does not pass) */
  const SMOKED: Rect = { x0: 21.4, x1: 24.8, z0: 7.6, z1: 14.9 };   // (from past where the line before left him: a can dropped at his own feet behind the sandbags hides nothing)
  const lesson: LessonData = {
    title: 'Alone, loud',
    rails: { allow: ['move', 'camera', 'zoom'], rows: ['charge', 'drive'] },   // (the interaction key's rows in this mission are the two its lines teach: the charge on the shop's door, the code book. No pick, no boot, no dead man to drag)
    steps: ([
      // THE ROAD
      { id: 'move', line: '[W] [A] [S] [D] to move. Get behind the van', done: { is: 'near', at: VAN, r: 1.1 }, at: VAN },
      { id: 'ready', line: '[2]: rifle up', done: { is: 'slot', slot: 'rifle', drawn: true } },
      { id: 'sprint', line: 'Hold [Shift]: sprint to the wall by the gate', done: { is: 'all', of: [{ is: 'near', at: WALL, r: 1.3 }, { is: 'flag', flag: 'sprint' }] }, at: WALL },
      // (the maintainer: "instead of a circle pointer, maybe we need an arrow on the ground": the mark is a pace short of the wall and points into it)
      { id: 'wall', line: 'Walk into the wall: snap to it for cover', done: { is: 'flag', flag: 'wall' }, at: [WALL[0] - 0.35, 0.05, WALL[2]], toward: [YARD.x0, 0.05, WALL[2]],
        explain: { title: 'Walls', text: 'Walk into a wall and you snap to it: your back on it, out of the line of fire. The walk keys slide you along it. At its end, aim past the corner and you lean out to shoot.' } },
      // (the peek is the lesson, the shot its reward: he is at the corner the sentry was firing past a moment ago. The trigger is still locked here, so the
      //  lean is the only way on: a man who walks into the opening instead is shot at by nobody, the sentry's fire having stopped at the line before)
      { id: 'peek', line: 'Slide along to the gate. Aim past the corner: you lean out', done: { is: 'flag', flag: 'lean' }, at: CORNER },
      { id: 'fire', line: 'Left button: shoot the sentry', done: DOWN(1), at: [SENTRY[0], 1.2, SENTRY[2]] },
      // THE TRUCK COURT
      { id: 'reload', line: '[R]: reload', done: { is: 'reload' } },
      // (the gun's own setup, met early and in a quiet moment: the same two presses load the launcher at the end)
      // (the maintainer: "the timer is bad. we should just have it switch a mode. and we should teach earlier that tab exits out of menus": the setup is
      //  opened and shut before anything is picked in it; its rows stay locked until the next line, so Tab is the way out here)
      { id: 'setup', line: '[2] again: the rifle\'s setup', done: { is: 'flag', flag: 'setup' },
        explain: { title: 'A gun\'s setup', text: 'Press the key of the gun in your hands again and its setup opens over the kit: single shots or automatic, what the launcher is loaded with, its light. It stays until you pick a row or close it.' } },
      { id: 'tab', line: '[Tab]: close it. [Tab] closes every menu', done: { is: 'flag', flag: 'setupShut' } },
      { id: 'auto', line: '[Z]: full auto', setupLine: '[2], then [1]: full auto', done: { is: 'any', of: [{ is: 'flag', flag: 'auto' }, DOWN(2)] } },
      { id: 'arch', line: 'Move up beside the blue gate', done: { is: 'near', at: JAMB, r: 1.3 }, hold: 1, at: JAMB },   // (a second there: the gun opens on the truck before the next line, whenever he came)
      { id: 'crouch', line: '[C]: crouch. The fire goes over you', done: { is: 'all', of: [{ is: 'flag', flag: 'crouch' }, { is: 'near', at: JAMB, r: 1.9 }] }, at: JAMB },
      // THE GUN COURT
      { id: 'low', line: 'Stay low: follow the sandbags', done: { is: 'all', of: [{ is: 'flag', flag: 'crouch' }, { is: 'near', at: BAGS_END, r: 1.1 }] }, at: BAGS_END },
      { id: 'smoke', line: '[3], then click the ring: smoke the gap', done: { is: 'any', of: [{ is: 'threw', kind: 'smoke', area: SMOKED }, DOWN(2)] }, hold: 2.5, at: GAP },
      { id: 'cross', line: 'Cross behind the smoke', done: { is: 'in', area: BEHIND }, at: BARRIER },
      { id: 'frag', line: '[5], then click the ring: frag the gun', done: DOWN(2), at: NEST },
      // THE SHOP
      // (what the pistol is for: its shot is the one nobody takes for gunfire, and a lamp is a thing to shoot. The lamp lights where the next line stands him)
      { id: 'pistol', line: '[1]: the pistol. Its shot is quiet', done: { is: 'any', of: [{ is: 'slot', slot: 'pistol', drawn: true }, DOWN(5)] } },
      { id: 'lamp', line: 'Shoot out the lamp: the dark is cover too', done: { is: 'any', of: [{ is: 'target', name: 'lamp_shop', on: false }, DOWN(3)] }, at: LAMP },
      { id: 'charge', line: 'Hold [Space] on the door: pick the charge', done: { is: 'any', of: [{ is: 'door', door: 'shop', state: 'charged' }, { is: 'door', door: 'shop', state: 'open' }] }, at: SHOP_DOOR },
      { id: 'back', line: 'Stand clear: your back to the wall beside the door', done: { is: 'near', at: BACK, r: 0.7 }, at: BACK },
      { id: 'blow', line: '[F]: blow it', done: { is: 'door', door: 'shop', state: 'open' }, at: SHOP_DOOR },
      { id: 'shop', line: 'Lean in: shoot him', done: DOWN(3), at: [SHOP_MAN[0], 1.0, SHOP_MAN[2]] },
      // THE STORE
      { id: 'stun', line: '[4], then left button: stun the store', done: { is: 'any', of: [{ is: 'threw', kind: 'flash', area: STORE }, DOWN(5)] }, at: STORE_DOORWAY },   // (it passes on the bang itself, in the store: the next line is up while they are still folded)
      { id: 'store', line: 'Go in: shoot both', done: DOWN(5), at: [33.6, 1.0, AXIS] },
      { id: 'take', line: '[Space]: take the code book', done: { is: 'stage', stage: 'exfil' }, at: front },
      // THE WAY OUT
      { id: 'rifle', line: '[2]: back to the rifle', done: { is: 'slot', slot: 'rifle', drawn: true } },
      { id: 'leave', line: 'Back to the arch', done: { is: 'any', of: [{ is: 'near', at: ARCH_MOUTH, r: 0.8 }, DOWN(7)] }, at: ARCH_MOUTH },
      // (the maintainer: "weird that we're told to load the grenade long before being told to do anything about it". The two it is for come out as this
      //  line comes up, so the load is asked for with them in the doorway and used on the very next line)
      // (a kit dealt with the grenade already on the launcher makes this line true as it comes up: it goes by, its cue is still sent, and the next line
      //  says where they are by itself)
      { id: 'load', line: 'Two men behind you. [2] again: load the grenade', setupLine: 'Two men behind you. [2], then [2]: load the grenade', done: { is: 'any', of: [{ is: 'launcher', on: 'he40' }, DOWN(7)] } },
      // (a grenade that met something short of the 8 m it arms at is a dud: the line stays until one of the two is down, by the grenade or by anything else)
      { id: 'launch', line: 'Behind you: hold right button, aim at their doorway, let go', done: { is: 'any', of: [{ is: 'all', of: [{ is: 'threw', kind: 'he40' }, DOWN(6)] }, DOWN(7)] }, at: LAST_COVER },
      { id: 'last', line: 'Shoot the rest', done: DOWN(7), at: LAST_COVER },
      { id: 'out', line: 'Sprint out by the gate', done: { is: 'stage', stage: 'done' }, at: [EXIT.x, 0, EXIT.z] },
    ] as LessonStep[]).map(T => ({ ...T, ...FRAME[T.id] })),
  };

  for (const d of doors) doorFrame(d);
  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables, doors, devices: [],
    breaker: { pos: [28.0, 1.35, 10.2], boxes: [brk, led] }, beacons: [{ pos: [20.5, 2.05, 5.3], box: dome }],
    playerSpawn: START, routes, chokepoints: [], clearPlans: [],
    sky: { zenith: [0.003, 0.004, 0.008], horizon: [0.007, 0.008, 0.012] },   // (a dark sky over a thin moon: the plain past the lamps and the dark past the world's edge are one dark)
    // (the script's eyes: a play program may ask of the player only whether he stands in a volume. The shop door's line outside it, the shop, the store)
    volumes: [
      // (the road east of the van's flank, and round its nose: the sentry's rounds cross it, so he holds his fire while the player is anywhere in either)
      { name: 'road_east', kind: 'trigger', c: [7.5, 1, 14.2], h: [1.9, 1, 3.2] }, { name: 'road_nose', kind: 'trigger', c: [4.9, 1, 11.55], h: [0.7, 1, 1.05] },
      { name: 'shop_line', kind: 'trigger', c: [FRONT_X - 1.35, 1, AXIS], h: [1.35, 1, 0.6] },
      { name: 'shop_in', kind: 'trigger', c: [(FRONT_X + PART_X) / 2, 1, (ROOM_Z0 + ROOM_Z1) / 2], h: [(PART_X - FRONT_X) / 2 - 0.05, 1, (ROOM_Z1 - ROOM_Z0) / 2] },
      { name: 'store_in', kind: 'trigger', c: [(PART_X + YARD.x1) / 2 + 0.05, 1, (ROOM_Z0 + ROOM_Z1) / 2], h: [(YARD.x1 - PART_X) / 2 - 0.1, 1, (ROOM_Z1 - ROOM_Z0) / 2] },
    ],
    mission: { serverRoom: { x0: SHOP.x0, x1: STORE.x1, z0: SHOP.z0, z1: SHOP.z1 }, entryDoor: 'shop', rack: { index: 0, front, halfW: 0.3 }, exfilDoor: 'gate_w', exfilX: EXIT.x, exfilZ: EXIT.z, exfilOut: EXIT.out },
  };
  const surfaces: SurfacesData = { building: { ...YARD }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt', zones };
  const scenarios: LevelScenarios = { quiet, lesson, issue: ISSUE, doorNames: [{ door: 'gate_w', name: 'yard gate' }, { door: 'shop', name: 'shop door' }, { door: 'store', name: 'back door' }] };
  return { level, scenarios, groups: trace.groups, surfaces };
}
