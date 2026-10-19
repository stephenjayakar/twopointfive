// The OFFICE's scenario data (src/scene/scenarios.ts LevelScenarios): what the night breach, the room clear and the hostage rescue take from this level — the
// tables that lived in game/nightbreach.ts, roomclear.ts, rescue.ts and rescueflow.ts, moved here number for number. Attached to the office at load
// (scene/level.ts withOfficeScript), so levels/office.json itself is unchanged; a level made after this one carries the same block in its own file.
// Plain literals and type-only imports: nothing here is built from another module's exports (src/game is one import cycle — this is imported at its top).
import type { Vec3 } from '../src/math/vec';
import type { LevelScenarios, StructureData, RescueData, NightBreachData, KitViewData, ResponseData } from '../src/scene/scenarios';

/** the night breach: Sam beside the pair on the breach plan's approach marks, in the cubicles' south aisle, facing east down it */
const NIGHT_BREACH: NightBreachData = {
  team: { sam: [9.6, 0, 20.3], samYaw: Math.PI / 2 },
  room: 'break room', lights: 'breakroom',
};

/** THE STRUCTURE: the office's east wing — the break room, and across the corridor from its north door the storage room, the manager's office and the server room.
 *  The team starts where the night breach starts it, in the lobby end of the cubicles' south aisle (the breach plan's `from` marks). Ways in: the break room has
 *  four (west from the cubicles — the door F's breach takes — north from the corridor, and two from outside: the south door off the car park and the fire exit on
 *  the east side); the manager's office and the server room have two each (their corridor doors, and the side door between them); storage has one. Every structure
 *  door is shut at the staging; the locks are the level's own (server, manager and storage locked against Sam — pick or kick; the side door between the server room
 *  and the manager's office is the keypad's, and with no cleaner on the floor to give its code that is a kick; the break room's doors push open). Five men in all:
 *  Sam, the pair and five defenders are the eight characters the shadow-proxy budget holds (guards.ts spawnUnit). */
const STRUCTURE: StructureData = {
  name: 'east wing',
  rooms: [
    { id: 'breakroom', name: 'break room', bounds: { x0: 28.12, x1: 35.88, z0: 12.26, z1: 23.88 }, garrison: 2,
      doors: [{ id: 'breakroom_w', from: 'cubicles' }, { id: 'breakroom_n', from: 'corridor' }, { id: 'breakroom_ext', from: 'south lot' }, { id: 'fire_exit', from: 'east side' }],
      marks: [
        { pos: [32.3, 0, 17.95], watch: 'breakroom_w', aimAt: [28.1, 1.1, 17.6] },    // (marks 0, 2 and 3 are the breach plan's three. The drill's target lists index ITS men
                                                                                       //  in dealt order, not these marks: off the plan's own three it engages whoever is up)
        { pos: [33.6, 0, 15.4], watch: 'breakroom_n', aimAt: [30.6, 1.1, 12.36] },
        { pos: [31.9, 0, 14.9], watch: 'breakroom_w', aimAt: [28.1, 1.1, 17.6] },
        { pos: [33.4, 0, 21.7], watch: 'breakroom_w', aimAt: [28.1, 1.1, 17.6] },
        { pos: [29.4, 0, 21.9], watch: 'breakroom_n', aimAt: [30.6, 1.1, 12.36] },
        { pos: [33.9, 0, 19.2], watch: 'breakroom_ext', aimAt: [31.6, 1.1, 23.84] },
      ] },
    { id: 'storage', name: 'storage', bounds: { x0: 30.12, x1: 35.88, z0: 4.12, z1: 9.94 }, garrison: 1,
      doors: [{ id: 'storage', from: 'corridor' }],
      marks: [
        { pos: [31.8, 0, 5.3], watch: 'storage', aimAt: [32.6, 1.1, 9.84] },         // the far end of the room, west of the stacked cartons, down the aisle at the door
        { pos: [35.1, 0, 8.8], watch: 'storage', aimAt: [32.6, 1.1, 9.5] },          // the hard corner east of the door
        { pos: [31.0, 0, 8.8], watch: 'storage', aimAt: [32.6, 1.1, 9.5] },          // … and west of it
      ] },
    { id: 'manager', name: "manager's office", bounds: { x0: 22.12, x1: 29.94, z0: 4.12, z1: 9.94 }, garrison: 1,
      doors: [{ id: 'manager', from: 'corridor' }, { id: 'server_manager', from: 'server room' }],
      marks: [
        { pos: [28.2, 0, 8.1], watch: 'manager', aimAt: [25.6, 1.1, 9.84] },         // the east end: the corridor door, with the side door in the corner of his eye
        { pos: [23.4, 0, 6.3], watch: 'manager', aimAt: [25.6, 1.1, 9.84] },         // the north-west corner, behind the desk's end
        { pos: [28.6, 0, 6.5], watch: 'server_manager', aimAt: [22.16, 1.1, 8.55] }, // the east wall past the desk's end, down the room at the side door
      ] },
    { id: 'server', name: 'server room', bounds: { x0: 14.12, x1: 21.88, z0: 4.12, z1: 9.94 }, garrison: 1,
      doors: [{ id: 'server', from: 'corridor' }, { id: 'server_manager', from: "manager's office" }],
      marks: [
        { pos: [15.2, 0, 8.4], watch: 'server', aimAt: [17.6, 1.1, 9.84] },          // the west end of the aisle in front of the racks
        { pos: [20.6, 0, 7.9], watch: 'server', aimAt: [17.6, 1.1, 9.84] },          // the east end, beside the side door
        { pos: [16.0, 0, 7.8], watch: 'server_manager', aimAt: [21.84, 1.1, 8.55] }, // the length of the aisle, on the side door
      ] },
  ],
};

/** The hostage rescue: the manager's office through its corridor door (the level's own clear plan for that door carries the room's bounds), the team at the lobby
 *  arch at the corridor's west end, and the marks of everybody the scenario stands on the floor. */
const DOOR_AIM: Vec3 = [25.6, 1.1, 9.9];
const RESCUE: RescueData = {
  team: { sam: [7.6, 0, 13.4], samYaw: 0.9, ops: [[6.6, 0, 14.25], [8.5, 0, 14.3]] },
  room: { name: "manager's office", where: 'far end of the corridor', door: 'manager', lights: 'manager', doorAim: DOOR_AIM,
    outside: [DOOR_AIM[0], 0, DOOR_AIM[2] + 1], hold: [DOOR_AIM[0], 0, DOOR_AIM[2] + 0.4] },
  /** the side door from the server room: its jambs on that side have no floor, so the face's marks are authored (orders.ts doorMarks). The hostage room lies
   *  mostly SOUTH of this door, so the free floor north of the opening — the latch side, where a stack would go by habit — is in plain view of the room once the
   *  leaf swings (the door man's mark looks straight through at it). The stack is behind the cabinet south of the hinge instead: nobody on the defenders' marks
   *  has a line to either man, and a blind burst through the doorway goes past them. The price: the first man opens the leaf and throws from a long arm's reach
   *  (≈ 1.2 m off the hinge edge). The stand-off for a charge is further along the same cover, outside the charge's backblast */
  side: { door: 'server_manager', hold: [22.0, 0, 8.55], from: { door: 'server' },
    stack: [[20.85, 0, 7.55], [20.15, 0, 7.55]], standoff: [[20.5, 0, 7.55], [19.8, 0, 7.55]] },
  hostages: [{ pos: [26.4, 0, 4.9], face: 0 }, { pos: [28.4, 0, 5.45], face: -0.5 }],
  captor: { pos: [27.8, 0, 7.3], aimAt: DOOR_AIM },
  doorMan: { inside: { pos: [23.4, 0, 6.6], aimAt: DOOR_AIM }, outside: { pos: [29.4, 0, 11.1], aimAt: [21, 1.1, 11.1] } },
  roamers: [{ pos: [31.4, 0, 15.2], aimAt: [30.6, 1.1, 12.4] }, { pos: [7.2, 0, 6.4], aimAt: [9.6, 1.1, 9.8] }],
  /** the corridor from the lobby arch to the hostage room, and the four openings onto it, west to east: the conference room's glass and door, the cubicles' west
   *  doorway, the server room's door, the cubicles' east doorway — where a man stands to cover each, and the point his gun is on */
  flow: {
    corridor: { x0: 4.0, x1: 36.0, z0: 10.0, z1: 12.25 },
    regions: [
      { id: 'conference', door: 'conference', rect: { x0: 4.12, x1: 13.94, z0: 4.12, z1: 9.94 } },
      { id: 'server', door: 'server', rect: { x0: 14.12, x1: 21.88, z0: 4.12, z1: 9.94 } },
      { id: 'cubicles', door: null, rect: { x0: 12.2, x1: 27.8, z0: 12.3, z1: 23.9 } },
    ],
    route: [
      { id: 'conference', name: 'conference room', short: 'conf', region: 'conference', kind: 'glass', door: 'conference', at: [9.6, 0, 10.0], mark: [9.0, 0, 11.55], watch: [10.2, 1.1, 7.4], half: 0.55, north: true, call: 'glass left.', side: 'left', look: 0.9 },
      { id: 'cubicles-w', name: 'cubicles west', short: 'cub W', region: 'cubicles', kind: 'doorway', door: null, at: [15.75, 0, 12.2], mark: [14.9, 0, 10.6], watch: [16.0, 1.1, 13.6], half: 0.7, north: false, call: 'opening right.', side: 'right', look: 0.9 },
      { id: 'server', name: 'server room', short: 'server', region: 'server', kind: 'door', door: 'server', at: [17.6, 0, 10.0], mark: [16.7, 0, 11.55], watch: [17.6, 1.05, 10.0], half: 0.55, north: true, call: 'door left.', side: 'left', look: 0.4 },
      { id: 'cubicles-e', name: 'cubicles east', short: 'cub E', region: 'cubicles', kind: 'doorway', door: null, at: [22.75, 0, 12.2], mark: [21.9, 0, 10.6], watch: [23.0, 1.1, 13.6], half: 0.7, north: false, call: 'opening right.', side: 'right', look: 0.9 },
    ],
    hold: { ahead: 9, xMax: 31, z: 11.1 },
  },
};

/** THE TEAM & KIT PICTURE of the office (src/host/kitView.ts; keys: docs/level-format.md `kitView`) — the office's block lives HERE, as every other level's lives
 *  in its own file: one way (the night breach, the room clear, the rescue and the plain night all show way 0). INDOORS: the server room's door from the
 *  corridor, the stack up the corridor's wall under its one lit ceiling panel, the racks behind that stretch of wall. That door and no nearer one to a
 *  mission's own: it stands shut as authored (the break room's west door and the manager's stand open as authored, and a leaf that stands open is no door to
 *  stack on). `ref`: the missions' own starts are in three different places, none at this door. `hide`: the camera stands over the cubicles and looks in
 *  across the corridor, so the corridor's partition goes between its two openings (the long piece and the lintel beside it), with the clock and the
 *  extinguisher that hang on it — written, so nothing else does. The building's own lights stay as the mission has them (`roomLights` 1); the picture's lamp
 *  over the door stays too: the lit panel is at the stack's far end. The third man of the stack is written across the corridor from the second, a step
 *  short of the worked-out place: that one is on the corridor's tripwire (`laser_corridor`, x 14.5). No pane for the gun's row (`pane` false: the nearest glass in that wall is the conference
 *  room's, past the last man). Everything else is measured (src/host/kitViewPlan.ts). */
const KIT_VIEW: KitViewData = { ways: [{ door: 'server', ref: [17.6, 11.1], hide: ['box_0120', 'box_0121', 'box_0380', 'box_0390'], slots: [null, null, null, [15.0, 11.56, 90]], roomLights: 1, pane: false }] };

/** THE RESPONSE TEAM (game/qrf.ts, RESPONSE.on): the building's own. The marks are qrf.ts QRF_MARKS number for number — the landing behind the steel stair
 *  door, the fan just inside it, the four outside posts of the lot and where the gate's own men are stood up — and the words are the lines the office always
 *  had. One way in: the floor has one stair. A run is dealt three or four men, a minute to a minute and a half out. */
const RESPONSE: ResponseData = {
  why: 'One floor of a guarded building at night: the night shift is three men, and the building\'s own response team waits floors below, a stair away.',
  site: 'two-six', at: 'on two-six', team: 'the response team', tag: 'QRF',
  ways: [{ name: 'the west stairwell', door: 'stairwell', stairs: true, coming: 'coming up the west stairs', clear: 'nobody west of the lobby arch',
    muster: [[3.1, 0, 11.25], [2.25, 0, 11.25], [3.1, 0, 10.3], [2.25, 0, 10.3]],
    entry: [[6.7, 0, 11.2], [5.9, 0, 10.55], [5.9, 0, 11.8], [5.4, 0, 11.25]], entryFace: [Math.PI / 2, 2.4, 0.75, Math.PI / 2] }],
  men: [3, 4], eta: [60, 90],
  posts: [
    { name: 'fire exit', pos: [38.9, 0, 24.2], yaw: -2.48, sweep: [[36.15, 1.0, 19.9], [36.15, 1.0, 21.5]] },
    { name: 'break-room door', pos: [27.4, 0, 25.7], yaw: 1.95, sweep: [[30.9, 1.0, 24.15], [32.4, 1.0, 24.15]] },
    { name: 'lobby front', pos: [2.3, 0, 20.6], yaw: Math.PI / 2, sweep: [[3.9, 1.0, 17.6], [3.9, 1.0, 22.4]] },
    { name: 'south lot', pos: [17.4, 0, 26.4], yaw: Math.PI, sweep: [[14.5, 1.2, 24.15], [23.5, 1.2, 24.15]] },
  ],
  outside: [[38.6, 0, 26.6], [37.4, 0, 26.9], [38.8, 0, 25.4], [37.2, 0, 25.6]],
};

/** WHAT THE BREAK ROOM'S TWO INSIDE DOORS ARE CALLED on the squad's rows (game/doornames.ts, WORDS.doors): their ids end in a bearing and the HUD has no
 *  compass, so each is named by what it is taken from, as another level's doors are */
const DOOR_NAMES = [{ door: 'breakroom_n', name: 'corridor-side break room door' }, { door: 'breakroom_w', name: 'cubicles-side break room door' }];
export const OFFICE_SCENARIOS: LevelScenarios & { nightBreach: NightBreachData; roomClear: StructureData; rescue: RescueData } = { nightBreach: NIGHT_BREACH, roomClear: STRUCTURE, rescue: RESCUE, kitView: KIT_VIEW, response: RESPONSE, doorNames: DOOR_NAMES };
