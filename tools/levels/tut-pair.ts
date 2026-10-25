// THE TRUCK PARK — the tutorial's quiet mission for TWO: the player and one partner through a haulier's yard at night, and each stretch of it is one thing a
// second man makes possible. Its own ground (nothing shared with another level but the GWOT kit's pieces): a walled yard 33 × 23 m with a truck gate chained
// shut, a way in through a fallen stretch of its wall, two shipping containers end to end across it (a third stood across the mouth of the gap between
// them), the watch's camp in the truck park beyond them, walled on its south side, and an
// office court with a fuel point at the far end. The rules are the quiet pair's (game/pairorders.ts, workthings.ts) on the frame (game/rails.ts), in an
// order a first-time player can follow, with the mains and the dark added.
//
//        x 5         16  18.4      24      29                38
//   z 3  ┌───────────────────────────────────┬────────────────┐
//        │  van        ╎   pickup van pickup │  ┌─ office ─┐  │   the gate yard    one man at a pickup just inside the truck gate, under a lamp, his back
//        │             ╎        ☼            │  │   trunk  │  │                    to the yard; the two come in by the fallen wall, behind a low wall
//  truck │ pickup      █                     │  └pad─door──┘  │   the truck park   two men either side of the watch's lantern, the near one watching the
//  gate  │  A ↑ ☼      █ container           │    ☼ camera    │                    far one's back; a stub of old wall a pace behind the far one
//        │         ▓   █      ☼lantern       │      ☼ pump    │   the office court a lamp and a camera over the office door, a lamp on the fuel point and
//        │         ▓ gap→ B →     C ↗        │               gate_e                one on the far gate, all on the mains; a man watching the far gate;
//        │   first ▓   █          ╎stub      │         ☼      │                    the fuse box on the wall behind him
//        │─────┐       █ container╎          ┘     D ↗        │   ▓ the third container, across the gap's mouth: the two come round its end
// start→ fallen       █▔▔▔▔▔▔▔▔▔▔╎               ▣ box       │   ▔ the camp's south wall: the partner's way round goes behind it
//        │             ← the strip round the south container's end is open
//   z 26 └───────────────────────────────────────────────────┘
//
// THE LINE (scenarios.lesson; tools/qa/lessons/tut-pair.ts plays it by input alone):
//   the gate yard     the partner follows, low when the player is low. The squad's key on a man: the partner works round to that man's back, says "set" and
//                     waits; the word (F) sends him, and he falls in again by himself.
//   the truck park    two men who see each other. The squad's key on the far one; the player goes to the near one's back himself; his own grab is the
//                     partner's signal, and both go down on one beat. The man in his arm is put out.
//   the office court  the office door is on a keypad, under a lamp and a camera. The man who watches the far gate knows the code: held from behind and
//                     asked, he gives it. With that man still in the player's arm, the squad's key on the fuse box: the partner throws the mains. Every
//                     lamp in the yard and the camera die, and the yard's red beacons turn.
//   the dark          night vision, the pad, the manifest out of the office trunk; the squad's key on the ground calls the partner from the box, and out
//                     by the far gate with him.
//
// WHY THE PIECES STAND WHERE THEY DO
//   · THE DOUBLE is the old Training lesson's geometry for it (the men 4.6 m apart, the near one looking straight at the far one's back, the far one looking
//     out past him, an old wall a pace behind the far one that hides the partner's last strides): those numbers were found over many seeds. Two calm men
//     inside 4.5 m of each other turn and talk (dialogue.ts AMBIENT.pairM), which is why they are not nearer.
//   · THE START is more than ten metres by walking from every man: opening.ts moves on any man of the shift who starts nearer the spawn than that, and a man
//     moved on comes back to his post facing the way he came. It is outside the wall, on the road by their pickup, where the moon shows the two of them and
//     no man has a line (tools/qa/quiet-check.ts).
//   · THE MOON AND THE PARTNER. On the page the partner reads the way to a man's back by the light on himself (sneak.ts stalkAmbient): stood in the moon, he
//     takes the whole way for lit, and will not cross it in front of a man who looks that way. So the moon is low in the south-west and every mark the
//     player is led to is in a moon shadow.
//   · NO SHADOW HERE IS DARK ON A REAL GPU, SO THE PARTNER'S WAYS ARE OUT OF EVERY LINE. The maintainer's first play (10-22, hard): the light meter read 14
//     in the gap and 27 behind the low wall, where the software adapter had read 0 to 3: the moon's bounce. To the partner 10 is lit, and he will not walk a
//     lit stretch a man has a line to, nor stand in one. The two lantern men looked straight down the gap and their line ran the length of the gate yard:
//     he stopped by the van and was never going to come, and the step waited on him. The same fault stood one step on: his way to the far man went through
//     the gap and down the container's side a stride behind the near man, whose head swings. So the level no longer leans on dark for him:
//       – THE THIRD CONTAINER (SCREEN) stands across the gap's mouth, a stride and a half off. Nothing west of it is in either lantern man's line; the two
//         come round its end into the alley, and only the last strides to the mark are in the line. He stops short of them, three metres from the player.
//       – THE STRIP ROUND THE SOUTH CONTAINER'S END IS OPEN (SOUTH_Z: that container ends 0.8 m short), and THE CAMP HAS A SOUTH WALL (PEN) from that
//         container to the stub. His way to the far man is down the alley, round the container's end, along the yard wall behind the camp's wall and up
//         the far side of the stub: the near man has no line to any step of it, wherever he looks.
//       – NO 'LEAD HIM' STEP BUT THE FIRST WAITS ON WHERE THE PARTNER IS. He stands back out of a line by his own rule; a step that waited on him was a
//         dead end the day he judged the way lit.
//     The scripted run plays at that light (tools/qa/lessons/tut-pair.ts mode.floor; lesson-run's --floor reaches the partner's own meter).
//   · A MAN'S POST is on the middle of a nav cell (x and z ending .25 or .75) where his facing matters to a stride: a man put on a cell's edge takes one step
//     onto it and stands as that step turned him.
//   · NOBODY IS LEFT TO MEND THE MAINS. The game sends the nearest calm man to the box when the lights die (lighting.ts). Here the last man on his feet is in
//     the player's arm when they do, so the dark stays dark: the dark is for the lamps and the camera, and for the picture.
//   · A CAMERA sees only what is lit (devices.ts): the lamp over the door is what feeds it. Both are on the mains.
//   · THE WORLD is 40 × 28 m (scene/world.ts): the yard is as big as that leaves a road on either side of it.
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef, DeviceDef } from '../../src/scene/level';
import type { LevelScenarios, LessonData, QuietData, Rect } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, type GeneratorTrace } from '../../src/scene/officeGen';
import { gwotKit, gwotOfOffice, GWOT_PALETTE, GWOT_MATERIALS, GW_SHELL } from '../../src/scene/gwotKit';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';

export const NAME = 'tut-pair';
export const NOTES = 'The tutorial\'s quiet mission for two, the truck park: a haulier\'s yard at night with one partner, on its own ground. One line: a man taken by the partner on the word, two men who watch each other taken on one beat (the partner\'s and the player\'s own), a man held and asked for a door code while the partner throws the mains, then the office in the dark and out by the far gate. Generated by tools/levels/tut-pair.ts.';
export const MATERIALS = GWOT_MATERIALS;

type P3 = [number, number, number];
const P = (x: number, z: number): P3 => [x, 0, z];
const HALF = Math.PI / 2;
/** the yard inside its wall */
export const YARD: Rect = { x0: 5, x1: 38, z0: 3, z1: 26 };
/** the way out: the foot gate in the far wall */
export const EXIT = { name: 'the far gate', door: 'gate_e', x: 38.8, z: 18.25, out: [1, 0] as [number, number] };   // (z: the middle of the gate AS FITTED — see TP.gate)
/** the container stood across the mouth of the gap: its middle (it lies along z, 6.06 long and 2.44 wide) */
const SCREEN = { x: 12.9, z: 16.9 };
/** the south container's middle: it ends 0.8 m short of where a container stood end to end with the north one would, which leaves the strip along the yard
 *  wall open. THE GAP PAYS FOR IT: 1.8 m now (z 16.2 to 18.0, it was 2.6), which is two nav cells. Nothing may stand in its mouth, and a nudge to SCREEN or
 *  to this number wants the scripted run after it: one cell less and the way to the mark and to the near man's back is shut */
const SOUTH_Z = 21.03;
/** the wall along the south of the watch's camp: its line, and where it starts (the south container's east face) */
const PEN = { z: 22.5, x0: 18.42 };
/** the places the scripted player and the lesson name (tools/qa/lessons/tut-pair.ts imports these, so a moved wall moves the script) */
export const TP = {
  start: P(3.5, 24.9), mate: P(2.6, 25.8),   // outside the wall, on the road by their pickup, in the moon: the first picture has both of them in it
  first: P(9.4, 20.0),             // the first mark: round the end of the low wall, in its moon shadow, at the first man's back
  A: P(9.75, 15.25),               // the man at the pickup, looking at its load
  gap: P(17.3, 17.1),              // in the gap between the containers (z 16.2 to 18.0), in their moon shadow: both men of the truck park are in view through it
  B: P(20.8, 17.6),                // the near man: looks across the lantern at the far man's back
  C: P(25.4, 17.6),                // the far man: looks out past the parked trucks
  lantern: P(23.5, 16.3),
  behindB: P(19.6, 17.75),         // where the player waits for "set": at the near man's back, a stride off
  round: P(26.6, 20.2),            // the way on from the lantern, past the far man's post
  past: P(29.9, 23.6),             // round the court wall's end, in its moon shadow
  D: P(34.6, 22.4),                // the man who watches the far gate
  box: [32.6, 1.35, 25.7] as P3,   // the fuse box, on the yard's wall behind him
  pad: [31.95, 1.3, 9.735] as P3,
  padAt: P(32.3, 10.35),
  trunkFront: [35.6, 1.0, 6.8] as P3,
  // the two doorways' middles as build() fits them (a real-size leaf stands at the latch end of its 1.2 m slot, so the middle of the way through is not the
  // slot's): every mark and every scripted stride that goes through a door is written off these, and build() throws if a fitted door is not on them
  door: P(33.25, 9.6), gate: P(38.0, 18.25),
  out: { x0: 38.1, x1: 38.75, z0: 17.45, z1: 19.05 } as Rect,
};
const LOW = 1.8;

const PLACES = { areas: [
  { name: 'office', bounds: { x0: 30.32, x1: 36.88, z0: 4.12, z1: 9.48 } },
  { name: 'gate yard', bounds: { x0: 5.12, x1: 17.2, z0: 3.12, z1: 25.88 } },
  { name: 'truck park', bounds: { x0: 17.2, x1: 29, z0: 3.12, z1: 25.88 } },
  { name: 'office court', bounds: { x0: 29, x1: 37.88, z0: 3.12, z1: 25.88 } },
  { name: 'road', bounds: { x0: 0, x1: 5.12, z0: 0, z1: 28 } },
] };

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), G = gwotKit(gwotOfOffice(K)), PAL = GWOT_PALETTE, H = WORLD.ceilingY, t = GW_SHELL / 2;
  const { grp, add, slab, doorFrame, lights, switchables } = K;
  const doors: LevelDoorDef[] = [];
  const zones: SurfacesData['zones'] = [];

  // ---- the ground, the yard's wall, the truck gate (chained: no part of this night), the fallen stretch they came in by, the far gate ----
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, PAL.dust, { rough: 1 });
  G.ground(YARD.x0, YARD.z0, YARD.x1, YARD.z1, 'dirt');
  G.ground(0, 11.6, 5, 14.4, 'gravel'); G.ground(38, 16.6, 40, 19.4, 'gravel');
  grp('walls.yard');
  G.yardWallX(YARD.z0, 4.88, 38.12); G.yardWallX(YARD.z1, 4.88, 38.12);
  G.yardWallZ(YARD.x0, YARD.z0, YARD.z1, 'mud', [{ a: 11.5, b: 14.5, y0: 0, y1: 2.4 }, { a: 23.6, b: 25.2, y0: 0, y1: 2.4 }]);
  G.yardWallZ(YARD.x1, YARD.z0, YARD.z1, 'mud', [{ a: 17.4, b: 18.6, y0: 0, y1: 2.2 }]);
  for (const [x, z] of [[5, 3], [5, 26], [38, 3], [38, 26], [16, 3], [27, 3], [16, 26], [27, 26], [5, 19], [38, 12], [38, 23]] as const) G.pier(x, z);
  G.gate(5, 13.0, 'z', 3.0, 1, 'paintBlue', 0);
  G.rubble(4.1, 24.5, 0.9, 9); G.rubble(5.45, 23.2, 0.35, 3);
  doors.push({ name: 'gate_e', hinge: [38.0, 17.42], closedDir: HALF, width: 1.16, exterior: true });
  grp('lights');
  // a thin moon, low in the south-west: shadows fall north-east, so the south wall, the containers and the old wall each keep a dark lane on the side the
  // two work along, and the faces the camera sees are the lit ones
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.3, -0.34, -0.7]), color: [0.55, 0.7, 1.0], intensity: 0.5, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  /** A yard LAMP: a pole with a shaded head throwing a pool straight down (about 7 m across) and little past it: a thing to walk round. Every one here is on
   *  the mains. The pole stands 0.6 m north of the head, so the light has nothing solid round it. */
  const lamp = (x: number, z: number, name: string, outerDeg = 52) => {
    const h = 3.4, ARM = 0.6;
    add({ c: [x, (h + 0.11) / 2, z - ARM], h: [0.04, (h + 0.11) / 2, 0.04], ...GWOT_MATERIALS.galv });
    add({ c: [x, h + 0.085, z - ARM / 2], h: [0.025, 0.025, ARM / 2 - 0.04], ...GWOT_MATERIALS.galv });
    add({ c: [x, h + 0.06, z], h: [0.2, 0.05, 0.2], ...GWOT_MATERIALS.plasticBlack });
    const fb = add({ c: [x, h, z], h: [0.12, 0.012, 0.12], ...GWOT_MATERIALS.plasticWhite, emissive: [40, 34, 22], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x, h - 0.03, z], dir: [0, -1, 0], color: [1.0, 0.86, 0.6], intensity: 90, range: 9, innerDeg: outerDeg - 22, outerDeg, name, group: 'exterior', enabled: true, volumetric: 0.2, fixtureBox: fb, radius: 0.1, mains: true });
  };
  /** an emergency BEACON on a wall face (the red lamp that turns when the mains are down): `out` = the way off the wall, into the yard */
  const beacons: Level['beacons'] = [];
  const beacon = (x: number, z: number, out: [number, number]) => {
    add({ c: [x, 2.28, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow });
    const dome = add({ c: [x, 2.16, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow });
    switchables.push({ name: `beacon${beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
    beacons.push({ pos: [x + out[0] * 0.12, 2.05, z + out[1] * 0.12], box: dome });
  };

  // ---- the gate yard: a pickup being loaded just inside the truck gate, under the gate's lamp; a man at its tail ----
  grp('walls.inner');
  // the old pen's low wall: the two start behind it, out of every man's line and in its moon shadow, and come round its end
  G.yardWallX(21.0, 5.12, 10.0, 'mud', [], LOW); G.pier(10.0, 21.0, LOW - 0.1);
  grp('yard.gate');
  lamp(10.9, 14.8, 'lamp_gate', 46);
  G.pickup(9.6, 13.0, 0, 'truckWhite', { load: 'drums' });
  G.drums(7.0, 15.6, 3); G.jerryCan(10.9, 16.1, 0.3); G.jerryCan(11.15, 16.4, -0.2);
  G.patch(9.6, 14.9, 4.2, 1.6, 'damp'); G.ruts(5.4, 12.3, 15.4, 13.9, 'damp');
  G.van(12.6, 5.2, 0.03, 'truckWhite'); G.tyres(9.2, 4.2, 3); G.tyres(8.4, 4.3, 2); G.woodPile(6.2, 8.4, HALF, 1.6);
  G.crates(13.4, 24.9, 0.1, 3, 'olive'); G.sacks(11.4, 25.1, 0.05, 3); G.handcart(11.6, 23.8, 0.4, 'sacks'); G.tyres(13.7, 23.0, 3);
  G.drums(6.2, 5.0, 3); G.crates(7.3, 9.9, 0.2, 2, 'ply'); G.crates(13.9, 12.4, -0.1, 3, 'olive'); G.jerryCan(8.1, 18.3, 0.6);
  G.drumDown(7.4, 19.9, 0.4); G.blocks(14.6, 9.6, 0.2, 2); G.bush(5.7, 9.6, 1.1); G.bush(5.6, 17.4, 0.9);
  G.pickup(2.3, 20.9, HALF + 0.08, 'truckWhite');                                       // outside the wall, off the road: how the two came
  G.bush(1.2, 25.9, 1.2); G.bush(4.3, 26.9, 0.9); G.bush(0.9, 17.2, 1);

  // ---- two containers end to end across the yard, and the gap between them ----
  grp('yard.containers');
  G.container(17.2, 13.17, HALF, 'paintRust'); G.container(17.2, SOUTH_Z, HALF, 'paintBlue');
  // a third, stood across the mouth of the gap a stride off (SCREEN: see WHY THE PIECES STAND WHERE THEY DO). Both lantern men look straight down the gap:
  // without it their line ran the length of the gate yard, and a partner who will not walk a lit stretch a man has a line to never came up to the gap
  G.container(SCREEN.x, SCREEN.z, HALF, 'paintGreen');
  // (the strip between the south container's end and the yard wall is OPEN, two strides wide: the partner's way round to the far man — see PEN)
  G.drums(15.4, 11.0, 2); G.jerryCan(12.7, 21.5, 0.5);

  // ---- the truck park: the trucks along the far wall under their lamp, the watch's camp round its lantern, the stub of old wall behind the far man ----
  grp('yard.park');
  G.pickup(21.4, 6.0, HALF, 'truckRed', { load: 'crates' }); G.van(24.6, 6.2, HALF, 'truckWhite'); G.pickup(27.3, 6.0, -HALF, 'truckWhite', { load: 'sacks' });
  lamp(23.0, 9.6, 'lamp_park', 46);
  G.ruts(18.8, 9.6, 28.4, 11.0, 'damp'); G.patch(22.0, 10.4, 3.6, 1.2, 'damp', 0.1); G.patch(25.3, 12.3, 1.6, 1.2, 'damp', -0.2);
  G.lowTable(TP.lantern[0] + 0.3, TP.lantern[2], 0); G.lantern(TP.lantern[0], TP.lantern[2], 'lantern_watch', 'exterior', 0.3);
  G.plasticChair(23.9, 15.45, Math.PI); G.rug(23.5, 16.5, 3.0, 2.0, 'mat', 0.06);
  G.charpoy(22.2, 13.4, 0.08); G.jerryCan(24.9, 14.2, 0.2); G.woodPile(25.6, 13.6, 0.3);
  G.van(27.7, 13.2, HALF - 0.04, 'truckWhite'); G.tyres(27.9, 16.6, 3); G.crates(27.8, 19.4, 0.15, 2, 'ply');
  G.yardWallZ(24.0, 17.95, 23.0, 'mud', [], 2.4); G.pier(24.0, 23.0); G.pier(24.0, 20.4); G.rubble(23.9, 23.9, 0.6, 7);
  // the old pen's south side: a wall from the south container to the stub. The near man's head swings, and on a real GPU no shadow in this yard reads
  // dark to the partner (the moon's bounce): a way through the gap and down the container's side, a stride behind that man, was refused on every look
  // south. Behind this wall the partner's way round (down the west side of the south container, round its end, along the yard wall, up the far side of
  // the stub) has no line from the near man at all, whatever the light and wherever he looks
  G.yardWallX(PEN.z, PEN.x0, 24.0, 'mud', [], 2.4);
  G.drums(27.2, 25.2, 3); G.tyres(22.6, 20.4, 2); G.sacks(22.9, 21.6, 0.3, 2); G.jerryCan(26.7, 23.9, 0.4); G.bush(28.3, 25.3, 1);

  // ---- the ground between the pieces: wheel ruts where the trucks turn, gravel shed off the road, dust drifted against what stands, a few stones. Decals and
  //      walk-over stones only (nothing a foot, a round or a line of sight meets), so the play is as it was. The maintainer, 10-22: "ground looks pretty flat"
  grp('yard.ground');
  G.ruts(5.6, 17.9, 11.0, 19.3, 'damp'); G.patch(7.4, 23.3, 3.2, 1.4, 'gravel', 0.2); G.patch(11.9, 22.7, 2.6, 1.8, 'dust', -0.3); G.patch(6.7, 17.5, 2.2, 1.2, 'damp', 0.4);
  G.rubble(8.3, 21.7, 0.5, 5); G.patch(10.6, 8.6, 3.0, 1.6, 'dust', 0.15); G.patch(7.2, 11.4, 1.8, 1.1, 'damp', -0.3); G.rubble(14.9, 14.0, 0.4, 4);
  G.patch(14.95, 20.9, 1.1, 3.4, 'gravel', 0.04); G.patch(16.4, 25.0, 3.2, 0.9, 'dust', 0.03); G.rubble(18.9, 25.0, 0.45, 5); G.patch(21.6, 24.3, 4.2, 1.1, 'gravel', -0.04);
  G.patch(20.3, 14.3, 2.8, 1.6, 'dust', 0.3); G.ruts(19.0, 12.5, 26.4, 13.1, 'damp'); G.patch(21.4, 19.6, 2.4, 1.5, 'damp', -0.2); G.rubble(19.4, 20.9, 0.5, 5);
  G.patch(26.2, 21.6, 1.9, 2.6, 'dust', 0.1); G.rubble(28.3, 22.3, 0.45, 5);
  G.ruts(7.6, 7.3, 15.4, 8.0, 'damp'); G.patch(14.3, 6.6, 2.4, 1.3, 'gravel', 0.2); G.rubble(15.7, 5.0, 0.5, 5); G.patch(11.2, 9.9, 2.0, 1.1, 'dust', -0.25); G.rubble(13.2, 8.9, 0.4, 4);
  G.ruts(29.6, 17.5, 37.5, 18.3, 'damp'); G.patch(31.6, 16.1, 2.8, 1.8, 'dust', 0.3); G.patch(30.7, 21.3, 2.2, 1.4, 'gravel', -0.2); G.rubble(29.7, 19.2, 0.4, 4);
  // (the verge outside the south wall: the ruts of whatever drives round the yard, and what the road sheds)
  G.ruts(5.6, 26.98, 38.4, 26.92, 'dirt'); G.patch(12.2, 26.9, 4.6, 0.9, 'gravel', 0.02); G.patch(23.4, 27.2, 5.8, 0.8, 'gravel', -0.02); G.patch(31.0, 26.8, 3.4, 0.7, 'dirt', 0.03);
  G.bush(9.4, 27.3, 0.9); G.bush(20.2, 26.9, 1.0); G.bush(27.6, 27.4, 0.8); G.bush(34.8, 27.0, 1.1); G.rubble(16.2, 27.0, 0.5, 5);

  // ---- the office court: the office with its pad, the lamp and the camera over its door, the fuel point, the far gate's lamp, the fuse box ----
  grp('walls.inner');
  G.yardWallZ(29.0, 3.12, 22.0, 'mud'); G.pier(29.0, 22.0); G.pier(29.0, 12.6);
  const OX0 = 30.2, OX1 = 37.0, OZ0 = 4.0, OZ1 = 9.6, DOOR_AT = 32.4;
  grp('office.floor'); G.ground(OX0, OZ0, OX1, OZ1, 'slab', 0.006);
  grp('office.roof'); slab(OX0 - 0.1, H, OZ0 - 0.1, OX1 + 0.1, H + 0.2, OZ1 + 0.1, PAL.render, { flags: BoxFlag.NoPrimary, rough: 0.95 });
  grp('office.walls');
  G.wallX(OZ0, OX0 - t, OX1 + t, 'render'); G.wallX(OZ1, OX0 - t, OX1 + t, 'render', [{ a: DOOR_AT, b: DOOR_AT + 1.2 }, { a: 34.6, b: 35.6, y0: 1.0, y1: 2.0 }]);
  G.wallZ(OX0, OZ0 + t, OZ1 - t, 'render'); G.wallZ(OX1, OZ0 + t, OZ1 - t, 'render');
  doors.push({ name: 'office', hinge: [DOOR_AT + 0.02, OZ1], closedDir: 0, width: 1.16, locked: true, lock: 'pad_office', keySide: 1 });
  zones.push({ id: 'office', mat: 'stone', x0: OX0, z0: OZ0, x1: OX1, z1: OZ1 });
  const OFFICE: Rect = { x0: OX0 + t, x1: OX1 - t, z0: OZ0 + t, z1: OZ1 - t };
  grp('office.room');
  G.bulb(33.4, 6.8, 'bulb_office', 'office', true);
  G.table(31.6, 4.62, 1.6, 0.7); G.plasticChair(31.6, 5.4, 0); G.rug(33.2, 7.0, 2.2, 1.4, 'felt');
  G.trunk(36.15, 6.8, HALF, 'paintRust'); G.crates(36.3, 4.8, 0.05, 2, 'ply'); G.sacks(30.9, 8.8, 0.1, 2);
  { const led = add({ c: [35.86, 0.36, 6.8], h: [0.006, 0.012, 0.03], ...GWOT_MATERIALS.iron, emissive: [3, 0.4, 0.2], flags: BoxFlag.NoShadow });
    switchables.push({ name: 'rack0_leds', boxes: [led], group: 'objective', on: true, baseEmissive: [3, 0.4, 0.2], mains: false }); }
  G.dado('x', OZ1, 30.3, 31.7, 1, 'paintBlue'); G.dado('x', OZ1, 35.9, 36.9, 1, 'paintBlue');
  grp('yard.office');
  lamp(31.5, 11.9, 'lamp_office');
  lamp(35.3, 15.0, 'lamp_pump', 46);
  lamp(36.5, 19.7, 'lamp_far', 46);
  G.ground(30.2, 9.8, 37.0, 13.2, 'slab');
  G.waterTank(36.9, 14.4); G.pump(36.2, 15.6, HALF); G.drums(37.2, 16.1, 2); G.jerryCan(35.6, 16.3, 0.2);
  G.generator(30.5, 24.9, 0); G.jerryCan(31.3, 25.4, 0.2); G.drums(36.9, 24.9, 3); G.hesco(37.0, 21.6, 1, HALF);
  G.jersey(35.4, 10.6, 1, 0); G.tyres(29.7, 10.5, 2); G.motorbike(37.2, 11.6, HALF + 0.2); G.washLine(29.7, 13.6, 29.7, 17.2, 4);
  G.patch(33.4, 20.4, 3.4, 1.4, 'damp', 0.1); G.patch(34.2, 24.2, 2.6, 1.2, 'damp', -0.1); G.bush(37.4, 25.4, 1.1);

  // ---- the fuse box on the inside of the yard's wall, behind the man who watches the far gate; and five beacons, one for each side of the yard ----
  grp('breaker');
  const brk = add({ c: [TP.box[0], 1.35, 25.84], h: [0.28, 0.36, 0.04], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [TP.box[0] - 0.18, 1.62, 25.79], h: [0.015, 0.015, 0.015], albedo: PAL.plasticBlack, rough: 0.5, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  grp('beacons');
  beacon(19.0, 3.2, [0, 1]); beacon(36.2, 9.8, [0, 1]); beacon(22.6, 25.8, [0, -1]); beacon(5.2, 16.4, [1, 0]);
  beacon(35.6, 25.8, [0, -1]);   // (…and one on the wall by the fuse box, a few strides from the last man: it is in the picture at the moment the lamps go out)

  // ---- the devices: the office's pad, and the camera over its door (it sees what the lamp lights; both die with the mains) ----
  const devices: DeviceDef[] = [
    { kind: 'keypad', name: 'pad_office', pos: TP.pad, yaw: 0, door: 'office', code: '3124' },
    { kind: 'camera', name: 'cam_office', pos: [TP.door[0], 2.6, 9.82], yaw: 0, pitch: -0.5, sweep: [-0.55, 0.55], sweepPeriod: 9, fovDeg: 60, range: 5.5, mains: true },
  ];

  // ---- four men, each ON A POST: he stands at the first point looking at the second (a stride out and back once an hour) ----
  const post = (name: string, at: P3, look: [number, number]) => ({ name, points: [at, P(look[0], look[1])], wait: [3600, 0], keys: [] as string[] });
  const routes = [
    post('pickup', TP.A, [TP.A[0], TP.A[2] - 0.75]),                         // looks at the pickup's load, his back to the yard
    post('near', TP.B, [TP.B[0] + 1.4, TP.B[2]]),                            // looks across the lantern, straight at the far man's back
    post('far', TP.C, [TP.C[0] + 1.0, TP.C[2] - 1.0]),                       // looks out past the parked trucks
    post('gate', TP.D, [TP.D[0] + 1.0, TP.D[2] - 1.3]),                      // looks at the far gate under its lamp, the fuse box behind him
  ];

  const front = TP.trunkFront;
  const quiet: QuietData = {
    thing: 'the manifest',
    radioCheck: false,   // nobody is missed on a clock here: a first night is read at a reader's pace
    starts: [{ name: 'the fallen wall', sam: TP.start, samYaw: HALF, mate: TP.mate }],
    spots: [{ place: 'the office', area: { ...OFFICE }, door: 'office', holder: 'the trunk', rackIndex: 0, front, halfW: 0.3 }],
    exits: [EXIT],
    patrols: [['pickup', 'near', 'far', 'gate']],
  };
  const down = (n: number) => ({ is: 'men', down: n });
  const did = (what: string) => ({ is: 'did', what });
  const any = (...of: object[]) => ({ is: 'any', of });
  const all = (...of: object[]) => ({ is: 'all', of });
  const near = (at: P3, r: number) => ({ is: 'near', at, r });
  const flag = (f: string) => ({ is: 'flag', flag: f });
  const pair = (what: string) => ({ is: 'pair', what });
  const mark = (p: P3): P3 => [p[0], 1, p[2]], chest = (p: P3): P3 => [p[0], 1.2, p[2]];
  // (the far man's name on the net: the roster's third, as the routes are written — game.ts CALLSIGNS. lesson-check refuses a name nobody on the floor has)
  const FAR_MAN = 'Reyes';
  const opened = (door: string) => [{ is: 'door', door, state: 'open' }, { is: 'door', door, state: 'broken' }];
  const lesson: LessonData = {
    title: 'As two',
    // THE FRAME (game/rails.ts). From the first step: the walk, the view, the aim, the knee. Each key is switched on by the step that teaches it and stays on.
    // `orders` = the squad's rows this night: his key on a man, on a thing to work, and anywhere else (the partner comes back). `rows` = the verbs the
    // interaction key offers: no row for the fuse box (the partner's work here), none for a lock, a body or a light plate.
    rails: { allow: ['move', 'camera', 'zoom', 'aim'], orders: ['pairMark', 'work', 'fallIn'], rows: ['grab', 'question', 'choke', 'push', 'pull', 'code', 'nocode', 'drive'] },
    steps: [
      // ---- the gate yard: he follows; a man on the word ----
      { id: 'crouch', line: 'Press [C] to crouch. Your partner will copy you', allow: ['crouch'], done: any(flag('crouch'), down(1)) },
      { id: 'lead', line: 'Lead him to the mark', cue: 'gate', done: any(all(near(TP.first, 1.0), { is: 'mate', by: 5 }), down(1)), hold: 0.3, at: mark(TP.first) },
      // (an order step's `after` is the line while the partner is on his way: it never asks twice, and it is drawn as a thing to watch. The step is done by
      //  what the order was FOR: "set", the dark. The double's order names its man (a deed's '@foe:<callsign>'): his key on the NEAR man of the two leaves
      //  the ask up, for the partner behind the near man is the take the card has just said shouts)
      { id: 'mark', line: 'Press [B] on that guard to send your partner after him', after: { line: 'He\'s working his way around behind the guard', on: ['pairMark'] }, allow: ['order'], at: chest(TP.A), atMan: 'pickup',
        done: any(pair('set'), pair('go'), down(1)),
        explain: { title: 'Two of you', text: 'Your partner follows you and stays as quiet as you do.\nPress [B] on a guard to send your partner around behind him. He\'ll say "set" when he\'s there, and then he\'ll wait for you to say go.' } },
      { id: 'word', line: 'Press [F] to say go, and he\'ll take the guard down', after: { word: 'He\'s taking the guard down, then he\'ll come back to you' }, allow: ['word'], at: chest(TP.A), atMan: 'pickup', done: down(1) },
      // ---- the truck park: two men on one beat ----
      // (he falls in again by himself when his man is down — pairup.ts `rejoin` — so no line asks for it)
      { id: 'gap', line: 'Lead him to the gap between the containers', cue: 'park', checkpoint: 'the gate yard', done: any(near(TP.gap, 1.0), down(2)), hold: 0.3, at: mark(TP.gap) },   // (not on where the partner is: he stands back out of the two men's line by his own rule, and a step that waited on him was a dead end the day he judged the way lit)
      // (the word is shut from here on: this beat's signal is the player's own grab, and a second key lit by the partner asked 'what is F here' again. A
      //  press of it with the near man looking was 'hold', then 'going anyway' in his sight)
      { id: 'far', line: 'Press [B] on the far guard to send your partner after him', deny: ['word'], at: chest(TP.C), atMan: 'far', done: any(did(`order:pairMark@foe:${FAR_MAN}`), down(2)),
        explain: { title: 'Two guards at once', text: 'These two can see each other, so if you take down just one, the other will shout.\nGive your partner the far one, then get behind the near one yourself. When you grab yours, he\'ll take his.' } },
      { id: 'near', line: 'Get behind the near guard and wait for "set"', allow: ['use'], at: mark(TP.behindB), done: any(pair('set'), pair('go'), flag('holding'), down(2)) },
      { id: 'hands', line: '{Grab him from behind}, and your partner will take his', at: chest(TP.B), atMan: 'near', done: any(all(flag('holding'), down(2)), down(3)) },
      // (the interaction key is shut while the line is the right button: a tap of it in the hold is a question, and ANY held man gives the office code —
      //  learnt here, the last man would have nothing left to say and his step no way to pass)
      { id: 'sleep', line: '{Knock him out}', allow: ['alt'], deny: ['use'], done: down(3) },
      // ---- the office yard: a man held and asked while the partner throws the mains ----
      // (the last man is the only way to the code: until he has given it the right button is shut, and so are the squad's key and the word — a taught "[B]
      //  on the man, then [F]" would put him out through the partner. The squad's key comes back for the fuse box, and is shut again while the dark is
      //  walked: a second order on the box would put the mains back on)
      { id: 'past', line: 'Keep going past the wall', cue: 'yard', deny: ['alt', 'order', 'word'], checkpoint: 'the truck park', done: any(near(TP.past, 1.4), flag('holding'), down(4)), hold: 0.3, at: mark(TP.past) },   // (nor this one on where the partner is: the last man has a line down this strip, and the partner stands a few strides back out of it)
      { id: 'hold', line: 'He knows the door code. {Grab him from behind}', allow: ['use'], at: chest(TP.D), atMan: 'gate', done: any(flag('holding'), did('chron:codeLearned'), down(4)) },
      { id: 'ask', line: 'Press [Space] to ask him for the code', done: any(did('chron:codeLearned'), down(4)) },
      { id: 'box', line: 'Your hands are full. Press [B] on the breaker box', after: { line: 'He\'s going for the breaker box. Watch the lights', on: ['work'] }, allow: ['order'], at: [TP.box[0], 1.35, TP.box[2]], done: flag('dark'),
        explain: { title: 'Your partner can use things too', text: 'Press [B] on anything you could use yourself, and your partner will go use it.\nThe light and the camera over the office door both run off this breaker box.' } },
      { id: 'drop', line: '{Knock him out}', allow: ['alt'], deny: ['order'], done: down(4) },
      // ---- the dark ----
      { id: 'nv', line: 'Press [N] to turn on night vision', allow: ['nvg'], checkpoint: 'the dark', done: flag('nv') },
      { id: 'code', line: 'Press [Space] at the keypad to enter his code', at: [TP.pad[0], 1.3, TP.pad[2] + 0.2], done: any(did('chron:codeEntered'), ...opened('office')) },
      { id: 'take', line: 'Press [Space] at the trunk to take the manifest', at: front, done: { is: 'stage', stage: 'exfil' } },
      // (the partner stood where his work ended, at the box: here the squad's key on the ground is a call he has not already answered)
      { id: 'out', line: 'Press [B] on the ground to call your partner, then leave through the far gate', allow: ['order'], done: any(all({ is: 'in', area: TP.out }, { is: 'mate', by: 6 }), { is: 'stage', stage: 'done' }), at: [37.6, 1, EXIT.z] },
    ],
  };
  for (const d of doors) doorFrame(d);
  for (const [id, m] of [['office', TP.door], ['gate_e', TP.gate]] as const) { const d = doors.find(x => x.name === id)!, c = [d.hinge[0] + Math.cos(d.closedDir) * d.width / 2, d.hinge[1] + Math.sin(d.closedDir) * d.width / 2];
    if (Math.hypot(c[0] - m[0], c[1] - m[2]) > 0.03) throw new Error(`tut-pair: door '${id}' is fitted with its middle at ${c[0].toFixed(2)}, ${c[1].toFixed(2)}, and TP has it at ${m[0]}, ${m[2]}`); }
  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables, doors, devices,
    breaker: { pos: TP.box, boxes: [brk, brkLed] }, beacons,
    playerSpawn: TP.start, routes, chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.045, 0.05, 0.07] },
    mission: { serverRoom: { ...OFFICE }, entryDoor: 'office', rack: { index: 0, front, halfW: 0.3 }, exfilDoor: 'gate_e', exfilX: EXIT.x, exfilZ: EXIT.z, exfilOut: EXIT.out },
  };
  const surfaces: SurfacesData = { building: { ...YARD }, grassEdge: 0, inside: 'asphalt', outside: 'asphalt', verge: 'asphalt', zones };
  // the partner comes for a quiet night: a suppressed gun, night vision, nothing that bangs
  const issue = { members: { '1': { suppressed: true, nvg: true, bangs: 0, frags: 0, charges: 0 } } };
  const scenarios: LevelScenarios = { quiet, lesson, issue, places: PLACES, doorNames: [{ door: 'gate_e', name: 'far gate' }, { door: 'office', name: 'office door' }] };
  return { level, scenarios, groups: trace.groups, surfaces };
}
