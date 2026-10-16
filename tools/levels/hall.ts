// HALL — 'The long hall': one wing of a police barracks, a room clear for the four built on ONE idea: a hall that is HELD. Four rooms open off one bare
// hall 23 m long, lit but for its far end, and two men stand in that dim end with their guns down its length. Nothing stands in the hall, the one door of
// the wing opens onto its near end, and every room but one has the hall for its only way in: the entry, and every stack after it, is made in those men's
// view. The hall is itself a ROOM of the structure (its door: 'front') — a room clear shuts every door a structure room lists, so a gun put behind an open
// door at the hall's end would be staged behind a shut one. One teammate carries the ballistic shield (shield.ts) AS ISSUED — the file's `scenarios.issue`
// block (game/kit.ts kitIssue), no visit to the loadout screen.
//
//        x 9              20          22              32        37
//   z 8  ┌────────────────┬───────────────────────────┬─────────┐
//        │     bunks      │          kit room         │         │      each room's hall door carries the room's own name, so a
//  z 12.8├──────▯─────────┴────────────▯──────────────┤  guard  │      teammate says 'kit room door': 'bunks', 'kit_room', 'store', 'ready_room'
//  front           t h e   l o n g   h a l l   ✕ ✕   post room  │ ▮    ✕: where the hall's two stand · 'post': the guardroom's door, shut; nobody
//  z 15.2├───────────▯───────────┬─────────▯──────────┤         │      holds the guardroom (the breaker is in it)
//        │      store          link     ready room    │         │      'link' joins the store and the ready room: the one
//   z 20 └───────────────────────┴────────────────────┴─────────┘      second way in on the floor
//
//   way in: the porch west of 'front' (the one door of the wing)
//   lights: the hall's first 16 m and the four rooms lit, the hall's far end and the guardroom dark · garrison: hall 2 · bunks 1 · kit room 1 · store 1 · ready room 2
//
//   bun run tools/levels/export.ts hall [--check]      → levels/hall.json
//   page: ?levelFile=hall.json&roomclear&squad4        (&noissue: the squad's kit as this machine keeps it, no shield unless a card carries one)
import type { Vec3 } from '../../src/math/vec';
import type { Level, LevelDoorDef } from '../../src/scene/level';
import type { IssueData, KitViewData, LevelScenarios, Rect, StructureData } from '../../src/scene/scenarios';
import type { SurfacesData } from '../../src/scene/levelData';
import { officeKit, normalize3 as norm, OFFICE_PALETTE, type GeneratorTrace } from '../../src/scene/officeGen';
import { WORLD } from '../../src/scene/world';
import { BoxFlag } from '../../src/scene/boxes';
import { livedKit } from './livedKit';

export const NAME = 'hall';
export const NOTES = 'The long hall: four rooms off one bare hall that two men hold from its dim far end; a room clear for the four, one teammate issued the shield (scenarios.issue). Regenerate: bun run tools/levels/export.ts hall';

/** THE ISSUE (game/kit.ts kitIssue): the first teammate — place '1': Red One of the four (the size the row deploys at), Blue One when a URL stages a
 *  pair or one — carries the shield and two stun canisters — four pouches, the rule's most for one man (slots.json); the charge
 *  and the grenade his issue card carries stay home. Everybody else as issued. */
export const ISSUE: IssueData = { members: { '1': { shield: true, bangs: 2, charges: 0, frags: 0 } } };

// THE TEAM & KIT PICTURE (scenarios.kitView): the level's own front door with the hall lit (the range card's lines run out of it under the stack). The
// porch's bench stood in the lane beside the stack and its sandbag line was cut by the frame's edge: the group steps out. The porch lamp is pale and low, so the card's pale blue holds on the ground.
const HALL_KITVIEW: KitViewData = { ways: [{ door: 'front', hide: ['porch'], roomLights: 1, light: { porch: { intensity: 9, color: [0.9, 0.95, 1] } } }] };

export function build(): { level: Level; scenarios: LevelScenarios; groups: string[]; surfaces: SurfacesData } {
  const trace: GeneratorTrace = { groups: [] };
  const K = officeKit(trace), C = OFFICE_PALETTE, H = WORLD.ceilingY;
  const { grp, add, slab, wallX, wallZ, desk, monitor, chair, cabinet, shelf, bench, cardboardBox, ceilingPanel, doorFrame, lights, switchables } = K;

  // ---- ground, floors, roof ----
  grp('ground');
  slab(0, -0.25, 0, 40, 0, 28, C.asphalt);
  grp('floors');
  slab(9, 0, 8, 37, 0.004, 20, C.lino);
  grp('ceiling');
  slab(8.9, H, 7.9, 37.1, H + 0.2, 20.1, C.ceiling, { flags: BoxFlag.NoPrimary });

  // ---- walls: a blockwork shell 0.24 thick, blockwork along the hall too (0.12), painted partitions between the rooms ----
  grp('walls.exterior');
  // ANOTHER WAY IN (tools/qa/second-way-check.ts): one WINDOW, in the bunks' outside wall round the corner from the porch — glass from a 0.15 m kerb (a walker is
  // stopped by anything standing 0.2 m high) to just under door-head height (tools/qa/door-size.ts reads a taller hole with no sill as a doorway without a leaf),
  // so once it is shot out a man steps through it. 'front' is the wing's one outside door and the hall's men can wedge it; no wedge shuts a pane. The bunks'
  // own door opens into the bunks, so from inside that room it opens by hand, and the walk comes out into the hall beside the front door: still in the far guns' view.
  wallX(8, 8.88, 37.12, 0.24, C.concrete, [{ a: 11.0, b: 12.2, y0: 0.15, y1: 1.88, glass: 'whole' }]);   // north: the bunks' window
  wallX(20, 8.88, 37.12, 0.24, C.concrete);                                                        // south
  wallZ(9, 8, 20, 0.24, C.concrete, [{ a: 13.4, b: 14.6, y0: 0, y1: 2.2 }]);                       // west: the front door, on the hall's own line
  wallZ(37, 8, 20, 0.24, C.concrete);                                                              // east
  grp('walls.interior');
  wallX(12.8, 9.12, 31.94, 0.12, C.concrete, [{ a: 14, b: 15.2 }, { a: 25, b: 26.2 }]);            // hall | bunks, kit room
  wallX(15.2, 9.12, 31.94, 0.12, C.concrete, [{ a: 18, b: 19.2 }, { a: 28, b: 29.2 }]);            // hall | store, ready room
  wallZ(20, 8.12, 12.74, 0.12, C.wall);                                                            // bunks | kit room
  wallZ(22, 15.26, 19.88, 0.12, C.wall, [{ a: 17, b: 18.2 }]);                                     // store | ready room: the door 'link'
  wallZ(32, 8.12, 19.88, 0.12, C.concrete, [{ a: 13.4, b: 14.6 }]);                                // the hall's end: the guardroom's door 'post'

  // ---- what stands in each room. NOTHING stands in the hall: that is the level ----
  grp('room.bunks');
  bench(10.2, 9.0, Math.PI / 2); bench(10.2, 11.2, Math.PI / 2); bench(13.4, 8.7, 0); bench(17.6, 8.7, 0);
  cabinet(19.4, 9.2, -Math.PI / 2); cardboardBox(18.8, 11.9, 0.45, 0.3);
  grp('room.kit');
  shelf(23.6, 8.5, 2.4, 0.45, 0, 4, 1.9); shelf(28.6, 8.5, 2.4, 0.45, 0, 4, 1.9);
  add({ c: [22.2, 0.45, 11.4], h: [0.55, 0.45, 0.55], albedo: C.wood });                            // a crate of webbing
  bench(30.6, 10.6, Math.PI / 2); cardboardBox(31.2, 8.7, 0.5, 0.2);
  grp('room.store');
  shelf(11.4, 19.5, 2.4, 0.45, 0, 4, 1.9); shelf(15.6, 19.5, 2.4, 0.45, 0, 4, 1.9);
  add({ c: [10.2, 0.5, 16.6], h: [0.6, 0.5, 0.6], albedo: C.wood }); add({ c: [19.4, 0.4, 19.2], h: [0.5, 0.4, 0.5], albedo: C.wood });
  cardboardBox(13.2, 16.2, 0.5, 0.6); cardboardBox(20.4, 15.9, 0.45, 0.2);
  grp('room.ready');
  desk(24.6, 18.6, 1.8, 0.8, 0); chair(24.6, 17.7, 0); desk(30.9, 17.9, 1.6, 0.8, Math.PI / 2); chair(30.0, 17.9, Math.PI / 2);
  cabinet(28.4, 19.4, Math.PI); bench(26.6, 15.9, 0);
  grp('room.guard');
  desk(35.9, 10.4, 1.6, 0.8, Math.PI / 2); monitor(36.1, 10.4, Math.PI / 2, true); chair(34.9, 10.4, Math.PI / 2);
  cabinet(36.3, 18.6, -Math.PI / 2); shelf(34.4, 19.5, 2.2, 0.45, 0, 4, 1.9);
  add({ c: [33.0, 0.4, 9.0], h: [0.5, 0.4, 0.5], albedo: C.wood });
  // ---- the porch: a bench and a sandbag line off to one side of the door's line ----
  grp('porch');
  bench(6.4, 10.4, 0);
  add({ c: [5.2, 0.4, 17.6], h: [1.4, 0.4, 0.3], albedo: C.partTan });

  // ---- lights: three lit panels down the hall and a fourth, at its far end, that is out; a panel in each room; the guardroom's is off; a porch lamp, the moon ----
  grp('lights');
  for (const x of [12, 17.5, 23]) ceilingPanel(x, 14, true, 'hall', false, 1.2, 0.3);
  ceilingPanel(28.5, 14, false, 'hall_end', false, 1.2, 0.3);                                       // the far end's panel is out: whoever holds the hall stands in the dim
  ceilingPanel(14.6, 10.4, true, 'room_bunks'); ceilingPanel(26, 10.4, true, 'room_kit');
  ceilingPanel(15.6, 17.6, true, 'room_store'); ceilingPanel(27, 17.6, true, 'room_ready', false, 1.2, 0.6, [7, 6.8, 6.4]);
  ceilingPanel(34.5, 14, false, 'room_guard');
  grp('exterior.lamps');
  { const x = 2.6, z = 14, dir: Vec3 = [1, 0, 0], yawL = Math.atan2(dir[0], dir[2]);
    add({ c: [x, 2.6, z], h: [0.06, 2.6, 0.06], albedo: C.metal });
    add({ c: [x + dir[0] * 0.28, 5.24, z], h: [0.04, 0.04, 0.32], yaw: yawL, albedo: C.metal });
    const head = add({ c: [x + dir[0] * 0.55, 5.15, z], h: [0.13, 0.025, 0.22], yaw: yawL, albedo: C.metal, emissive: [40, 24, 7], flags: BoxFlag.NoShadow });
    lights.push({ kind: 'spot', pos: [x + dir[0] * 0.55, 5.05, z], dir: [dir[0] * 0.35, -1, 0], color: [1.0, 0.62, 0.22], intensity: 160, range: 12, innerDeg: 30, outerDeg: 55, name: 'porch_lamp', group: 'exterior', enabled: true, volumetric: 0.12, fixtureBox: head, radius: 0.18, mains: false, broad: true }); }
  lights.push({ kind: 'dir', pos: [0, 0, 0], dir: norm([0.45, -0.5, -0.74]), color: [0.55, 0.7, 1.0], intensity: 0.9, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });

  // ---- the breaker (the guardroom's east wall) and one emergency beacon over the hall ----
  grp('breaker');
  const brk = add({ c: [36.84, 1.35, 14], h: [0.04, 0.36, 0.28], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const brkLed = add({ c: [36.79, 1.62, 13.82], h: [0.01, 0.015, 0.015], albedo: C.black, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  grp('beacons');
  add({ c: [20.5, H - 0.06, 14], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  const dome = add({ c: [20.5, H - 0.19, 14], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  switchables.push({ name: 'beacon0', boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });

  // ---- doors (closedDir 0: the leaf runs +x from the hinge along a z-wall; π/2: +z along an x-wall). Every room door is hinged at its WEST end, so its
  //      latch — where the lead of a stack stands — is the jamb nearer the hall's far end. 'post' is a plain shut door ----
  const doors: LevelDoorDef[] = [
    { name: 'front', hinge: [9.0, 13.42], closedDir: Math.PI / 2, width: 1.16, exterior: true },
    { name: 'bunks', hinge: [14.02, 12.8], closedDir: 0, width: 1.16 },
    // (the kit room's and the ready room's doors open OUT INTO THE HALL: a wedge or hauled furniture inside holds neither (doors.ts wedgeHolds), so from the
    // hall they open by hand; 'link' opens into the ready room and so by hand from there into the store — tools/qa/second-way-check.ts)
    { name: 'kit_room', hinge: [25.02, 12.8], closedDir: 0, width: 1.16, swing: 1 },
    { name: 'store', hinge: [18.02, 15.2], closedDir: 0, width: 1.16 },
    { name: 'ready_room', hinge: [28.02, 15.2], closedDir: 0, width: 1.16, swing: -1 },   // opens out into the hall: the ready room's men can wedge 'link' alone (tools/qa/second-way-check.ts)
    { name: 'link', hinge: [22.0, 17.02], closedDir: Math.PI / 2, width: 1.16 },
    { name: 'post', hinge: [32.0, 13.42], closedDir: Math.PI / 2, width: 1.16 },
  ];
  for (const d of doors) doorFrame(d);

  // ---- LIVED IN (src/scene/lived.ts: boxes in group `lived.<room>`, props `lived.*`, the tail of both lists; left out by the loader with the switch off).
  // The four rooms only: THE HALL STAYS BARE, that is the mission. Everything stands against a wall, 1.1 m and more off every door's line, off every
  // defender's mark and out of his line to his door; nothing taller than a table stands free of a wall. No light, nothing emissive.
  {
    const L = livedKit(K), LP = L.P, Q = Math.PI / 2;
    const BLANKET: Vec3 = [0.3, 0.33, 0.27], LOCKER: Vec3 = [0.33, 0.36, 0.38];
    /** an iron cot: frame, blanket, pillow at its `head` end (+1 / -1 along its length); 1.9 x 0.7, 0.46 to the blanket */
    const cot = (x: number, z: number, alongX: boolean, head: 1 | -1) => {
      const h = (l: number, w: number): [number, number] => alongX ? [l, w] : [w, l];
      const [fx, fz] = h(0.95, 0.35), [bx, bz] = h(0.92, 0.32), [px, pz] = h(0.14, 0.24);
      L.thing(x, 0, z, fx, 0.18, fz, C.metal);
      L.thing(x, 0.36, z, bx, 0.05, bz, BLANKET);
      L.thing(x + (alongX ? head * 0.74 : 0), 0.46, z + (alongX ? 0 : head * 0.74), px, 0.035, pz, C.white);
    };
    /** a footlocker, 0.4 tall: `alongX` = its long side */
    const footlocker = (x: number, z: number, alongX: boolean) => L.thing(x, 0, z, alongX ? 0.33 : 0.2, 0.2, alongX ? 0.2 : 0.33, LP.oliveDrab);
    /** a kit bag or a sack lying on the floor (0.28 to its top, a bulge over that) */
    const sack = (x: number, z: number, yaw: number, albedo: Vec3 = LP.canvas) => {
      L.thing(x, 0, z, 0.31, 0.14, 0.2, albedo, yaw);
      L.thing(x, 0.28, z, 0.2, 0.045, 0.14, albedo, yaw);
    };

    // the bunks: four cots against the walls, footlockers at the foot of two
    L.room('bunks');
    cot(9.52, 9.15, false, -1); footlocker(9.5, 10.33, true); cot(9.52, 11.5, false, 1);
    cot(15.3, 8.48, true, -1);
    cot(19.57, 11.3, false, 1); footlocker(19.6, 9.9, true);

    // the kit room: steel lockers in the far corner, a rifle rack on the hall wall well along from the door, a cleaning table between the shelves
    L.room('kit');
    L.thing(31.69, 0, 12.1, 0.23, 0.9, 0.6, LOCKER);
    L.thing(29.6, 0, 12.57, 0.8, 0.15, 0.14, C.woodDark);
    for (const dx of [-0.5, 0, 0.5]) L.thing(29.6 + dx, 0.3, 12.62, 0.03, 0.4, 0.05, C.black);
    L.table(26.1, 8.48, 1.6, 0.6);
    L.thing(25.9, 0.74, 8.46, 0.3, 0.025, 0.04, C.black);
    L.stool(25.7, 9.1);
    sack(20.44, 11.0, Q); sack(20.46, 11.76, Q + 0.12, LP.oliveDrab);
    L.mat(25.2, 8.85, 27.0, 9.55, LP.rubberMat);

    // the store: drums on an oil-dark patch of floor, a packing crate, sacks between the shelves, fuel cans
    L.room('store');
    L.drumFixed(14.55, 15.68); L.drumFixed(15.22, 15.67, LP.enamelBlue);
    L.mat(14.0, 15.3, 15.9, 16.3, LP.oilDark);
    L.crate(9.57, 18.15, 0.8, 1.0, 0.55);
    L.looseCrate(10.5, 18.3, 0.45, 0.35, 0.3, 0.2);
    sack(13.1, 19.56, 0); sack(13.85, 19.58, 0.1);
    L.jerryCans(17.7, 19.68, 2);
    L.drum(9.57, 19.33);

    // the ready room: the briefing table with its bench against the hall wall and two stools, a map spread on it, the map board on the back wall
    L.room('ready');
    L.table(24.5, 16.2, 1.6, 0.8);
    L.table(24.5, 15.5, 1.5, 0.3, 0, C.woodDark, 0.44, C.woodDark);
    L.sheet(24.4, 0.74, 16.2, 1.0, 0.6, 0.04, [0.7, 0.66, 0.52]);
    L.sheet(24.75, 0.75, 16.3, 0.3, 0.21, -0.3);
    L.mug(25.1, 0.74, 15.98); L.mug(23.92, 0.74, 16.45, LP.enamelBlue);
    L.thing(25.12, 0.74, 16.45, 0.07, 0.08, 0.07, C.metal);
    L.stool(24.1, 17.0); L.stool(24.95, 16.95);
    L.thing(26.5, 0.8, 19.85, 0.8, 0.55, 0.02, C.woodDark);
    L.hung(26.5, 19.82, true, 1.3, 0.95, 1.8, [0.7, 0.66, 0.52], 0.01);
    L.hung(30.9, 15.28, true, 0.9, 1.0, 1.7, C.black, 0.02);
  }

  const BUNKS: Rect = { x0: 9.12, x1: 19.94, z0: 8.12, z1: 12.74 }, KIT: Rect = { x0: 20.06, x1: 31.94, z0: 8.12, z1: 12.74 };
  const STORE: Rect = { x0: 9.12, x1: 21.94, z0: 15.26, z1: 19.88 }, READY: Rect = { x0: 22.06, x1: 31.94, z0: 15.26, z1: 19.88 };
  const GUARD: Rect = { x0: 32.06, x1: 36.88, z0: 8.12, z1: 19.88 }, HALL: Rect = { x0: 9.12, x1: 31.94, z0: 12.86, z1: 15.14 };

  // (TRIED AND TAKEN OUT, 10-11: a clear plan for 'front' with both points of domination on the door's own line — doortools.ts pods2 reads a plan's two for the
  //  first two men in. The first two then stand in file and only the shield's pistol answers the far guns, while the third and fourth still fan out and one
  //  goes on up the hall alone (Blue Two lost 7 m in, in 15 of 24 runs): 24 seeds as shipped, 40 of 96 teammates up against 60 without the plan, the far guns' kills 38 against 12.)

  const level: Level = {
    boxes: K.boxes, props: K.props, lights, switchables,
    doors,
    devices: [],
    breaker: { pos: [36.7, 1.35, 14], boxes: [brk, brkLed] },
    beacons: [{ pos: [20.5, H - 0.3, 14], box: dome }],
    playerSpawn: [6.4, 0, 12.2],
    routes: [], chokepoints: [], clearPlans: [],
    sky: { zenith: [0.015, 0.025, 0.05], horizon: [0.04, 0.05, 0.08] },
    // the stealth mission's three places, because the level format wants them (the room clear stands the mission still)
    mission: { serverRoom: { ...GUARD }, entryDoor: 'post', rack: { index: 0, front: [36.6, 1.0, 16.4], halfW: 0.3 }, exfilDoor: 'front', exfilX: 7.5, exfilZ: 14.25 },
  };

  // ---- the room clear: seven men. The hall's two stand at its far end, guns on the front door; four marks, so a fresh visit deals them differently ----
  const D_BUNKS: Vec3 = [14.75, 1.1, 12.7], D_KIT: Vec3 = [25.75, 1.1, 12.7], D_STORE: Vec3 = [18.75, 1.1, 15.3], D_READY: Vec3 = [28.75, 1.1, 15.3], FRONT: Vec3 = [9.3, 1.1, 14.25];
  const roomClear: StructureData = {
    name: 'barracks wing', maxMen: 7,
    // the porch: every start mark is off the door's own line, so nobody stands in the hall's view when 'front' opens
    team: { sam: [6.4, 0, 12.2], samYaw: Math.PI / 2, ops: [[7.6, 0, 12.0], [7.6, 0, 16.0], [5.4, 0, 11.4], [5.4, 0, 16.6]], opsYaw: Math.PI / 2 },
    rooms: [
      { id: 'hall', name: 'long hall', bounds: HALL, garrison: 2,
        doors: [{ id: 'front', from: 'porch' }],
        marks: [
          { pos: [31.0, 0, 14.25], watch: 'front', aimAt: FRONT },
          { pos: [30.2, 0, 13.4], watch: 'front', aimAt: FRONT },
          { pos: [30.2, 0, 14.6], watch: 'front', aimAt: FRONT },
          { pos: [29.2, 0, 14.25], watch: 'front', aimAt: FRONT },
        ] },
      { id: 'bunks', name: 'bunks', bounds: BUNKS, garrison: 1,
        doors: [{ id: 'bunks', from: 'hall' }],
        marks: [
          { pos: [11.4, 0, 10.2], watch: 'bunks', aimAt: D_BUNKS },
          { pos: [18.6, 0, 10.4], watch: 'bunks', aimAt: D_BUNKS },
          { pos: [15.6, 0, 9.4], watch: 'bunks', aimAt: D_BUNKS },
        ] },
      { id: 'store', name: 'store', bounds: STORE, garrison: 1,
        doors: [{ id: 'store', from: 'hall' }, { id: 'link', from: 'ready room' }],
        marks: [
          { pos: [12.0, 0, 17.6], watch: 'store', aimAt: D_STORE },
          { pos: [20.6, 0, 17.2], watch: 'store', aimAt: D_STORE },
          { pos: [17.6, 0, 18.4], watch: 'store', aimAt: D_STORE },
        ] },
      { id: 'kit', name: 'kit room', bounds: KIT, garrison: 1,
        doors: [{ id: 'kit_room', from: 'hall' }],
        marks: [
          { pos: [21.2, 0, 9.8], watch: 'kit_room', aimAt: D_KIT },
          { pos: [29.4, 0, 10.2], watch: 'kit_room', aimAt: D_KIT },
          { pos: [26.4, 0, 9.6], watch: 'kit_room', aimAt: D_KIT },
        ] },
      { id: 'ready', name: 'ready room', bounds: READY, garrison: 2,
        doors: [{ id: 'ready_room', from: 'hall' }, { id: 'link', from: 'store' }],
        marks: [
          { pos: [23.2, 0, 17.0], watch: 'ready_room', aimAt: D_READY },
          { pos: [31.0, 0, 16.0], watch: 'ready_room', aimAt: D_READY },
          { pos: [27.4, 0, 19.0], watch: 'ready_room', aimAt: D_READY },
          { pos: [26.0, 0, 17.4], watch: 'link', aimAt: [22.1, 1.1, 17.6] },
        ] },
    ],
  };
  const surfaces: SurfacesData = {
    building: { x0: 9, x1: 37, z0: 8, z1: 20 }, grassEdge: 0, inside: 'lino', outside: 'asphalt', verge: 'asphalt', zones: [],
  };
  return { level, scenarios: { roomClear, places: { areas: [{ name: 'guardroom', bounds: GUARD }, { name: 'porch', bounds: { x0: 3, x1: 8.88, z0: 9, z1: 19 } }] }, issue: ISSUE, kitView: HALL_KITVIEW }, groups: trace.groups, surfaces };
}
