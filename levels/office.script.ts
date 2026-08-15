// The OFFICE's level script (docs/design/level-scripting.md; run by src/game/director.ts — the notebook is docs/internal/director.md). One file, several PROGRAMS
// (decision 7); today it has two: 'breach', the daytime Door Kickers-style showcase that game/breach.ts used to stage by hand — the same cast on the same marks
// (level.breach: the plan authored in office.json), the same drill (game/breach.ts BreachDrill, driven through c.drill.breach), the same five pinned camera
// set-ups cut on the drill's own cues, the same captions, the same cut and restore. tools/qa/fixtures/breach-beats-main.json holds it to the pre-port beat log
// frame for frame (probes.ts director-breach-digest). And 'night' — the NIGHT SHOWCASE (docs/design/showcases.md, docs/internal/night-showcase.md): the office
// after dark as one continuous infiltration told in chapters, the real player driven through the real verbs, the shift's own three men ordered on cue, then the
// end (a veil, the night restored, the start card back — no 'Your turn' hand-over since 08-13). tools/qa/night-probes.ts holds it to its beat log, to Sam never being hit or seen, and to the floor it gives back.
// RULES OF THIS FILE: it imports NOTHING at run time — `import type` only, the API arrives as `D` (so the dev server can transpile-serve and hot-swap it, and its
// define pass runs under bun with no Game: the lint); every name it uses of the level is a define-time HANDLE (D.plan / D.mark / D.loadout / D.variant …) checked
// against office.json when the level loads; captions, camera and staging are legal here only because the program is declared showcase: true (decision 4).
import type { LevelScriptFn, CameraShotSpec, DrillRef, UnitRef, Query, BeatCtx, BeatFn, Cond, CondResult, DoorRef, LoadoutRef } from '../src/game/director';

type Vec3 = [number, number, number];

// ---------------------------------------------------------------- the breach: what only the show knows (the drill's doctrine and timings live with the drill)
/** where Sam waits it out (attract mode's spot): the grass off the north-west corner of the lot — in no shot, on no route */
const PARK: Vec3 = [1.5, 0, 1.5];
/** the operatives wear Sam's suit (game.ts Player); the opposition dark olive over black — neither is the shift's tan / blue-grey / maroon */
const OP_TINT: Vec3 = [0.05, 0.06, 0.07], OP_TINT2: Vec3 = [0.1, 0.32, 0.18];
const HOSTILE_TINT: Vec3 = [0.17, 0.19, 0.1], HOSTILE_TINT2: Vec3 = [0.03, 0.03, 0.03];
/** The camera programme. Yaw is the FollowCamera's (0 looks north, 90 west, −90 east, ±180 south; the eye sits dist back along it, pitch up). Every set-up was
 *  placed against the level: the establishing shot up-sun of the pair so the window shafts slant across behind them; the stack low from the north-west over
 *  the last cubicle block's desks (its partitions and end-cap all below the sight line), three-quarters onto the men's fronts and the leaf beside them, the
 *  room showing through the doorway the moment it opens; the inside shot from beside the fridge in the room's east-south-east, back up the entry line at the
 *  doorway — the middle man on its right, the charge's cloud beyond him, not between the lens and the men coming through; the overhead from high over the east
 *  wall so the west side of the room, where both men move, is laid open and the table hides nobody; the last low from the room's south-west onto the corridor
 *  door and the two men on it. Each is held at least minDur and at most dur seconds, cut early by `until` (a drill cue); every cut is hard but the show's ends. */
interface ShotDef extends Omit<CameraShotSpec, 'look' | 'title'> { title: string; caption: string; sub?: string; minDur?: number; look: Vec3 | ((q: Query) => Vec3); until?: (drill: DrillRef) => boolean }
// ================================================================ GAMEPLAY FRAMING (the designer, 08-13: 'our graphics don't really stand up to close-up shots — rework the frames of our demos
// to be closer to regular gameplay'). Every pinned shot of both showcases goes through frameShot(): its yaw and look-at (what it is ABOUT) stay, its height comes up toward the follow
// camera's own three-quarter view (camera.ts: pitch 55°, distance 21, fov 28°) — pitch into [pitchMin, pitchMax], the eye pulled back ×distK into [distMin, distMax], the look-at dropped
// to the floor the way play frames it. One table to tune; `on: false` = the authored close framings exactly as they were.
const FRAMING = { on: true, pitchMin: 44, pitchMax: 54, distK: 2.1, distMin: 12, distMax: 18, lookYMax: 0.5 };
function frameShot<T extends { pitch: number; dist: number; distTo?: number; lookY?: number }>(sh: T): T {
  if (!FRAMING.on) return sh;
  const F = FRAMING; const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const pitch = clamp(F.pitchMin + (sh.pitch / 60) * (F.pitchMax - F.pitchMin), F.pitchMin, F.pitchMax);   // (a low shot comes up to pitchMin, an already-high one toward pitchMax — their ORDER kept)
  const dist = clamp(sh.dist * F.distK, F.distMin, F.distMax);
  const out = { ...sh, pitch, dist, lookY: Math.min(sh.lookY ?? 0.8, F.lookYMax) };
  if (sh.distTo !== undefined) out.distTo = clamp(sh.distTo * F.distK, F.distMin, F.distMax);
  return out;
}
function breachShots(ops: [UnitRef, UnitRef]): ShotDef[] {
  const pair = (q: Query): Vec3 => { const a = q.pos(ops[0]), b = q.pos(ops[1]); return [a[0] + (b[0] - a[0]) * 0.45, 0, a[2] + (b[2] - a[2]) * 0.45]; };
  const shots: ShotDef[] = [
    { title: 'Ten a.m.', caption: 'Ten a.m. — the same floor by daylight: two operatives, FN2000s at the low ready.',
      dur: 24, minDur: 4, pitch: 21, dist: 10.5, distTo: 9, yaw: 138, yawTo: 116, lookY: 0.7, track: 5,
      look: q => { const p = pair(q); return [Math.min(25.2, p[0] + 1.6), 0, Math.min(19.2, Math.max(18.1, p[2]))]; },   // a stride ahead of the pair down the aisle, clamped short of the partition so the shot never swings into the wall
      until: d => d.phase !== 'approach' && d.phase !== 'wait' },
    { title: 'Stack', caption: 'Stack — the boot beside the handle, the charge in as the leaf clears.',
      dur: 16, minDur: 3, pitch: 14, dist: 5.1, yaw: -132, yawTo: -128, lookY: 0.92, look: [27.3, 0, 18.3],
      until: d => d.since('toss') > 0.42 },
    { title: 'Entry', caption: 'Entry — through the funnel, check the centre, drop what stands in it.',
      dur: 12, minDur: 3, pitch: 13, dist: 5.3, yaw: 72, yawTo: 68, lookY: 0.9, look: [29.9, 0, 17.45],
      until: d => d.since('corner1') > 0.9 || d.since('corner2') > 0.9 },
    { title: 'Corners', caption: 'Corners — each clears his own; they end in an L, number two on the next door.',
      dur: 14, minDur: 3, pitch: 52, dist: 13.5, yaw: 104, yawTo: 98, lookY: 0, look: [30.1, 0, 16.9],
      until: d => d.since('next') > 1.4 },
    { title: 'Clear', caption: 'Room clear, three down — stack on the corridor door. Cut.',
      dur: 12, pitch: 10, dist: 4.7, distTo: 4.2, yaw: -27, yawTo: -21, lookY: 0.95, look: [31.75, 0, 12.95] },
  ];
  return shots.map(frameShot);
}

// ================================================================ THE DAY'S LOUD HALF — 'it goes loud' (docs/design/showcases.md DAY 0:55‥2:25, docs/internal/day-showcase.md): the corridor door goes in,
// Control puts four armed men in the lobby, Blue One holds the corridor from the kicked leaf while Blue Two takes the cubicle farm's east end; the fight is REAL ROUNDS both ways —
// the operatives' bursts laid where they are ordered (into the glass beside a man, into the partition he is behind, and into him when he shows), the opposition's laid by
// doctrine into the cover the operatives kneel at (a place, never the man: their rounds cannot find an operative, and every one of them shreds, splinters, puffs and stars
// what it stops in) — with the program's own destruction knob at 0.8 for its length (c.chaos: partitions shred, paper goes up, monitors die, the charge drops a tile);
// then smoke across the sunlit aisle, the pair peel back by bounds through the break room and out of its south door into the lot, smoke rolling out behind them. Cut.
// Every place below was walked and every line of fire traced headlessly (tools/qa/day-probes.ts trace); the framings were placed by eye on the lane's page.
const LOUD = {
  // ---- THE CORRIDOR (z 10‥12.2 the length of the building; the break room's north door at x 30.0‥31.2 in its south wall, kicked from the room side: the leaf flies north into the corridor and its closer brings
  // it back; the manager's office door further west stands ajar into the corridor's north side, its tip at (25.9, 10.75) — a screen for a man kneeling north of centre, and a plank the far end's rounds splinter)
  oneCorr: [29.55, 0, 11.35] as Vec3,            // Blue One hull-down in the corridor a stride west of the kicked door's hinge (out of the leaf's swing), on a knee, muzzle west the length of it — south of the ajar leaf's tip, so his line to the arch is clear
  oneCorrVia: [30.62, 0, 11.72] as Vec3,         // (through the doorway first, square)
  twoDoor: [29.65, 0, 12.95] as Vec3,            // Blue Two off his kick to the HINGE side of the opening (out of One's way through it), muzzle north-east across it, until he is sent west
  corrFar: [7.6, 1.05, 11.0] as Vec3,            // where a muzzle holding the corridor rests: the arch at its far end
  // ---- THE OPPOSITION'S ENTRY: the lobby (out of every line from the corridor's east end and from the cubicles), then two up the corridor, two through the cubicle farm's middle aisle
  spawn: [[5.3, 0, 13.5], [5.5, 0, 14.8], [6.2, 0, 20.6], [5.4, 0, 21.9]] as Vec3[],
  spawnYaw: [Math.PI * 0.75, Math.PI * 0.75, Math.PI / 2, Math.PI / 2],
  h1Run: [[7.4, 0, 12.6], [8.6, 0, 10.75], [12.7, 0, 10.5]] as Vec3[],      // Red 1: through the arch and up the corridor's north side to a knee in front of the conference room's glass
  h2Run: [[7.7, 0, 12.9], [9.2, 0, 11.7], [11.2, 0, 11.75]] as Vec3[],     // Red 2: the south side, a stride behind
  h2Duck: [[15.65, 0, 11.65], [15.7, 0, 13.05]] as Vec3[],                // …and when the man beside him drops: into the cubicles' north-west doorway
  h2ToCap: [[19.4, 0, 13.1], [20.0, 0, 14.3], [20.08, 0, 15.3]] as Vec3[], // along the north aisle and down behind the north-east block's WEST end cap (x 20.6, z 14.3‥16.1: 1.4 m of fabric — gone on a knee, head over standing)
  h2Peek: [20.3, 0, 17.3] as Vec3,               // out past that cap's end into the middle aisle to lay them low: shown down the aisle for a second and a half — where One takes him
  h34In: [[9.5, 0, 19.2], [12.6, 0, 18.5]] as Vec3[],                     // Red 3 and 4: across the lobby and through the opening in its east wall onto the middle aisle
  h4Run: [[16.2, 0, 17.95], [18.55, 0, 17.9]] as Vec3[],                  // Red 4: straight up the middle aisle at a run to a knee at the west blocks' east end line — in the open, trading on speed
  h4ToCap: [[19.7, 0, 19.3], [20.08, 0, 20.5]] as Vec3[],                 // then across the aisle's mouth and down behind the south-east block's west end cap (z 19.7‥21.5)
  h4Peek: [20.3, 0, 18.5] as Vec3,               // its north end: out into the aisle to fire (his and Red 2's shows never overlap: their loops hand the aisle to each other)
  h3Run: [[13.3, 0, 19.8], [13.9, 0, 22.9], [17.2, 0, 23.05]] as Vec3[],   // Red 3, the long way: down the west aisle and east along the SOUTH aisle — through the sun off the frontage glass
  h3Post: [19.35, 0, 22.8] as Vec3,              // a knee at the south-west block's south-east corner, the desk end at his shoulder, the shaft on him
  h3Peek: [19.65, 0, 23.35] as Vec3,             // out south of the desk end into the aisle to fire up it: shown
  // ---- THE OPERATIVES' POSTS (facing west; every lane a middle- or south-aisle line — the blocks' spines stop anything crossing a block under 1.4 m): One in the break room's west DOORWAY, on a knee a stride
  // inside it, the middle aisle the length of the farm in front of him; Two at the south-east block's north-east corner on that aisle, then its south-east corner on the SOUTH aisle — the frontage sun across the floor at his feet
  oneToDoor: [[30.62, 0, 12.05], [30.4, 0, 13.6], [29.9, 0, 16.6], [29.75, 0, 17.6]] as Vec3[],   // One's peel off the corridor: back through the north doorway and across the break room, coming at the west doorway square from the east (so he settles onto its middle line, not its jamb)
  oneDoor: [28.85, 0, 17.6] as Vec3,
  twoVia: [[29.5, 0, 14.2], [29.4, 0, 16.4], [29.1, 0, 17.6], [28.1, 0, 17.65], [27.05, 0, 18.4]] as Vec3[],   // Two sent west at once: down the room's west wall and square out through its west door ahead of One
  twoMid: [26.35, 0, 18.85] as Vec3,
  twoSouthVia: [[26.75, 0, 20.6], [27.25, 0, 23.4]] as Vec3[], twoSouth: [26.2, 0, 23.45] as Vec3,   // (come at from the east so he settles onto its line; a hand south of the aisle's middle — from its centre the block's spine end takes the low line onto the far desk)
  // ---- WHAT THE OPPOSITION'S ROUNDS ARE LAID ON: places on the walls, jambs and floor about the operatives — traced (tools/qa/day-probes.ts): every one of these lines from where it is fired stops in something
  // solid without meeting an operative on his post, and stops or passes inside suppression's reach of him; nothing is ever laid THROUGH an opening a man of ours stands beyond
  inOneCorr: [[35.86, 1.6, 11.05], [35.86, 1.7, 10.5], [25.55, 1.05, 10.42]] as Vec3[],   // the corridor's east end wall high (Red 1's line, Red 2's); the manager's ajar leaf between them and him (wood: splinters, four metres in front of him)
  inOneDoor: [[27.94, 1.15, 16.72], [27.94, 1.25, 18.48], [27.15, 0.02, 17.6]] as Vec3[],  // the west door's north jamb; its south jamb; the carpet in front of its threshold — from the aisle's mouth
  inOneDoorHi: [27.94, 1.7, 15.7] as Vec3,       // over everything into the wall north of the door: Red 2 standing behind his cap (nothing low from there clears the block between)
  inTwoMid: [[24.7, 0.02, 18.9], [27.94, 1.7, 19.75], [23.4, 0.02, 18.6]] as Vec3[],       // the carpet a stride and a half in front of Two; the wall high past his shoulder; the carpet further out (nothing at the south jamb from the aisle's south end: that line runs up Two's own)
  inTwoSouth: [[24.9, 0.02, 23.45], [27.94, 1.7, 22.3], [23.6, 0.02, 23.1], [25.44, 0.9, 21.3]] as Vec3[],   // the sunlit floor a stride in front of Two's south post (dust in the shaft); the wall high past his shoulder; the floor further out; the block's south-east cap end (stops in the spine short of it: shreds there)
  // ---- WHAT THE OPERATIVES LAY THEIRS ON when they are not laying them on a man
  glassByH1: [[11.6, 1.35, 10.02], [11.2, 1.55, 10.02], [11.9, 1.2, 10.02]] as Vec3[],   // the conference room's glass beside and over the kneeling man's head: it stars (glass.ts) — and comes apart if the page booted with glassbreak. (Laid on the panes' middles: at this graze a hair of spread walks a round a metre along the wall, and the glazing runs x 10.2‥13.5 but for its mullions)
  wallByDoorNW: [16.45, 1.2, 12.16] as Vec3,     // the corridor's south wall beside the doorway Red 2 ducks into
  aisleFloor: [[19.4, 0.02, 18.35], [20.9, 0.02, 17.45], [20.9, 0.02, 18.5], [21.6, 0.02, 17.9]] as Vec3[],   // the middle aisle's carpet: beside Red 4's first knee; at the mouth the two lean out of, north end / south end; between
  carton: [19.8, 0.28, 17.9] as Vec3,            // the carton standing in the aisle a stride short of the mouth (props cardboard21): rounds hop it about beside whoever kneels there
  seChairN: [21.8, 0.55, 19.25] as Vec3,         // the chair pulled out of the south-east block's north cubicle onto the aisle's edge (chair15): a round spins it
  swDeskSE: [[18.86, 0.9, 21.85], [17.7, 0.86, 21.43], [16.9, 0.95, 21.75]] as Vec3[],   // from Two's south post past the south-west block's east cap end into its south-east cubicle behind Red 3's shoulder: the desk end, the paper stack (the line skims the cap's south end and passes a hand over the stack: up it goes), the spine beyond
  seDeskS8: [21.85, 1.08, 20.99] as Vec3,        // the LIT monitor in the south-east block's south-west cubicle (monitor8): Red 3's opening burst goes wide left of Two's post, in past the west cap's south end and across that desk — it dies in a fizz of sparks
  neDeskS: [21.8, 1.05, 15.6] as Vec3,           // the monitor in the north-east block's south-west cubicle facing the aisle: Red 4's opening burst from his knee climbs wide left into it
  bangAt: [20.9, 0, 18.05] as Vec3,              // Two's charge from the aisle corner: down the middle aisle onto its mouth, between the two caps the last men use — the tile over it comes down
  // ---- SMOKE AND OUT
  smokeAt: [22.5, 0, 22.9] as Vec3,              // Two's smoke: the south aisle between them and the west, in the shafts off the frontage — a white sunlit wall
  twoBackVia: [[26.65, 0, 20.6], [26.7, 0, 18.7], [27.55, 0, 17.65]] as Vec3[], twoCoverW: [28.4, 0, 18.15] as Vec3,   // Two back up the block's east side and onto the west door's room-side south jamb, covering the aisle past One
  oneCoverS: [30.3, 0, 21.9] as Vec3,            // One first to the room's middle covering back on the west door while Two comes off it for the south door
  breakS: [[30.6, 0, 21.2], [31.55, 0, 23.15]] as Vec3[],   // Two across the break room to its south door (breakroom_ext, x 31.0‥32.2 in the south wall)
  smoke2At: [31.55, 0, 23.7] as Vec3,            // One's own can bowled onto the south door's threshold as he turns for it: the plume stands in the sunlit doorway they leave by and rolls out into the lot
  outTwo: [[31.65, 0, 24.75], [33.6, 0, 24.8], [35.9, 0, 25.15]] as Vec3[],   // out (the leaf off his shoulder) and east along the wall behind the parked van, then down on a knee covering back
  outOne: [[31.6, 0, 24.7], [33.0, 0, 24.85], [34.3, 0, 24.95]] as Vec3[],
};
/** the loud half's clocks — seconds from the moment it goes loud (L = the drill's cut + LT.after) */
const LT = {
  after: 0.35,           // breath between the drill's cut on the held stack and the word to take the door
  kick: 1.3,             // Two's boot goes in about here (+ the kick's own 0.38 to impact)
  radio1: 2.8, control: 5.8, radio2: 10.4,   // 'corridor open' · Control's warning · 'copy — Two, west door'
  spawn: 7.0,            // the four stood up in the lobby (out of every line) as Control speaks
  hGo: 10.6,             // …and they move: two for the arch, two for the cubicles
  h2KillAt: 37,          // Red 2's shows down the aisle are traded with until here; the next one after is his last
  bangAt: 45,            // One calls the charge down the aisle here (Red 2 down or not)
  h3KillAfter: 9.5,      // seconds of the south aisle's trading (Two's rounds walked across the desk behind the man) before his next lean-out is the one Two waits on
};
/** the words — the net and the men's barks only (decision 2) */
const LL = {
  oneOpen: 'Control, Blue One — corridor door is open, corridor clear to the lobby. Moving on the offices.',
  control1: "Blue One, Control — hold there. Four armed men just came through the front: they're in the lobby and coming your way. You are cleared hot.",
  oneCopy: 'Copy, four. Two — take the west door, get on the aisles. I have the corridor.',
  twoSet: 'Two set, middle aisle.',
  oneContact: 'Contact front — two in the corridor!',
  oneShift: "One down in the corridor. Second man's into the cubicles — coming to you.",
  twoContact: 'Two — contact, middle aisle! And one working round the south side.',
  oneSetDoor: 'One set on the door.',
  twoShiftS: 'Two shifting south.',
  twoBang: 'Banging the aisle —',
  oneClear: (n: number) => n >= 4 ? 'Control, Blue One — four down, no friendly casualties. Breaking contact south.' : `Control, Blue One — ${['no', 'one', 'two', 'three'][n] ?? n} down and they've gone quiet. Breaking contact south while we can.`,
  control2: 'Blue One, Control copies all. Exfil south side into the lot — your vehicle is two minutes out. Go now.',
  twoSmoke: 'Smoke out —', twoMoving: 'Two moving!', oneCovering: 'Covering!',
  twoSetDoor: 'Set on the door — come to me.', oneMove: 'One moving!', oneLast: 'Last man — go, get the door.', twoOut: 'Door! Coming out —',
  oneOut: 'Control, Blue One — both out, south side, moving to the pickup. Nobody followed us out.',
};
/** The loud half's framings (the breach's grammar: pinned set-ups cut hard on cues, slow push-ins; yaw 0 looks north, 90 west, −90 east, ±180 south — the eye dist back along it, pitch up).
 *  Placed by eye on the lane's page (:5264) against what each beat does; docs/shots/day_loud_*.jpg are these. */
type LoudShot = Omit<CameraShotSpec, 'look' | 'chapter'> & { look: Vec3; title: string };
const LS = {
  // (eye = look + dist·cosP·(sin yaw, ·, cos yaw), lookY + dist·sinP — kept under the 2.9 m ceiling indoors and inside the walls it looks along)
  door:     { look: [29.6, 0, 11.55], lookY: 1.05, yaw: 98, yawTo: 95, pitch: 5, dist: 5.2, distTo: 4.7, dur: 15, title: '10:03 · corridor' },   // low in the corridor east of the door, west along it: the leaf flies across the corridor at the lens in a burst of splinters, One out past it to his knee, the corridor away to the arch behind
  corridor: { look: [23.0, 0, 10.7], lookY: 1.05, yaw: 84, yawTo: 86, pitch: 2.5, dist: 9.5, distTo: 8.4, dur: 20, title: 'contact front' },     // over One's shoulder the length of the corridor: his laser on the two kneeling at the far end, theirs coming back into the ajar leaf and the end wall
  glass:    { look: [12.3, 0, 11.0], lookY: 0.95, yaw: -165, yawTo: -168, pitch: 4, dist: 3.4, dur: 7, title: 'the glass' },                    // the insert: from inside the conference room out through its glazing at the two men kneeling against it — the pane stars over them, then the near one goes down against it
  aisles:   { look: [21.5, 0, 18.0], lookY: 1.0, yaw: 93, yawTo: 95, pitch: 6, dist: 8.6, distTo: 8.0, dur: 12, title: '10:04 · cubicles' },    // from inside the break room west through its west door, the door frame the frame's edge: Two on the block corner beyond it, the man at the carton down the aisle — and One comes past the lens onto his knee in the doorway
  reverse:  { look: [26.5, 0, 17.95], lookY: 1.0, yaw: -90, yawTo: -87, pitch: 2.5, dist: 9.0, distTo: 8.2, dur: 13, title: 'the aisle' },      // THE REVERSE: from behind the man kneeling at the west blocks' line, up the aisle at the doorway — One backlit in it, Two on the corner, both lasers down the aisle at the lens, their rounds puffing the wall
  aislesHi: { look: [21.6, 0, 18.1], lookY: 0.8, yaw: 96, yawTo: 99, pitch: 16, dist: 6.8, distTo: 6.2, dur: 12, title: 'the mouth' },         // high from outside the door over the east blocks onto the aisle's mouth: the caps' ends the two lean out of, the sun in the shafts beyond — the second show is the last
  bang:     { look: [21.6, 0, 18.3], lookY: 0.7, yaw: 100, yawTo: 94, pitch: 17, dist: 6.6, distTo: 6.0, dur: 12, title: 'the charge' },       // the same height swung onto the mouth: the can down the aisle, the flash, the tile out of the grid, the last man reeling out and dropped
  south:    { look: [21.8, 0, 22.95], lookY: 0.85, yaw: 82, yawTo: 85, pitch: 8, dist: 5.6, distTo: 5.0, dur: 22, title: 'the south aisle' },   // (the swing runs AWAY from the south wall: at yaw 80 the eye is a hand off its inner face)   // low behind Two's shoulder up the south aisle INTO the sun: the shafts off the frontage raking the aisle, the man kneeling in one by the carton, brass in the light, the floor puffing between them
  room:     { look: [21.4, 0, 19.0], lookY: 0.5, yaw: 104, yawTo: 93, pitch: 18, dist: 6.8, distTo: 6.2, dur: 14, title: 'four down' },        // a slow swing over the wrecked farm: the two by the carton where they fell, a rifle beside a hand, the tile, the scorch, the shreds in the caps, sheets on the floor, dust still hanging in the shafts
  smoke:    { look: [22.4, 0, 22.8], lookY: 1.25, yaw: 83, yawTo: 86, pitch: 6, dist: 5.0, distTo: 5.5, dur: 14, title: 'smoke' },              // the south aisle again, pulling out as the plume climbs white through the shafts and fills it
  peel:     { look: [29.0, 0, 19.5], lookY: 1.0, yaw: 40, yawTo: 46, pitch: 6, dist: 5.2, dur: 14, title: 'bounds' },                          // from the break room's south end north-west across it: One on his knee covering the west door, Two on its jamb — then off it, past One and the lens for the south door
  lot:      { look: [32.5, 0, 24.6], lookY: 1.2, yaw: 75, yawTo: 79, pitch: 6, dist: 5.6, distTo: 7.6, dur: 26, title: '10:05 · south lot' },  // outside, low off the asphalt behind the van: the pair out of the south door into the sun and along the wall toward the lens, down on their knees covering back, the smoke rolling out of the door behind them
} satisfies Record<string, LoudShot>;   // (keyed by name: shot('typo') is a compile error, not a BeatFailure that ends the show)
for (const k of Object.keys(LS) as (keyof typeof LS)[]) (LS as Record<string, LoudShot>)[k] = frameShot(LS[k]);   // gameplay framing (FRAMING above)
const LOUD_CHAPTERS = [{ title: '10:03 · corridor', dur: 21 }, { title: '10:04 · cubicles', dur: 57 }, { title: 'smoke and out', dur: 12 }, { title: '10:05 · south lot', dur: 14 }];   // (as built: L 0‥20.7 · ‥78 · ‥89.7 · ‥104 — the progress bar's segments)
const WEST = -Math.PI / 2, EAST = Math.PI / 2, NORTH = Math.PI, SOUTH = 0;
type Upper2 = NonNullable<Parameters<BeatCtx['order']>[1]['upper']>;
/** walk / run a unit through `pts` (straight legs, each begun as the last comes within `pass`), the LAST leg's order carrying `end` (his facing, crouch, stance, aim there); → whether he made it (false: down, or a leg capped — logged, never fatal) */
function* legs(c: BeatCtx, u: UnitRef, pts: Vec3[], o: { speed: number; stance?: Parameters<BeatCtx['order']>[1]['stance']; upper?: Upper2; aimAt?: Vec3 | UnitRef | null; crouch?: boolean; pass?: number; cap?: number; end?: Parameters<BeatCtx['order']>[1] }): Generator<Cond, boolean, CondResult> {
  for (let i = 0; i < pts.length; i++) {
    const last = i === pts.length - 1;
    c.order(u, { goal: pts[i], speed: o.speed, face: null, strafe: false, stance: o.stance ?? 'none', upper: o.upper ?? 'none', crouch: o.crouch ?? false, ...(o.aimAt !== undefined ? { aimAt: o.aimAt } : {}), ...(last ? (o.end ?? {}) : {}) });
    const t0 = c.query.t; const cap = o.cap ?? 10;
    yield c.until(q => !q.alive(u) || (last ? q.arrived(u) || flat2(q.pos(u), pts[i]) < 0.32 : flat2(q.pos(u), pts[i]) < (o.pass ?? 0.75)) || q.t - t0 > cap);   // (unlabelled: a hundred legs a run would be a hundred rows in the log)
    if (!c.query.alive(u)) return false;
    if (c.query.t - t0 > cap) { c.note('leg:capped', { who: u.callsign, to: [+pts[i][0].toFixed(2), +pts[i][2].toFixed(2)], at: c.query.pos(u).map(x => +x.toFixed(2)) }); return false; }
  }
  return true;
}
/** the gun onto `at` (a place, or a man — a man is tracked) and `n` REAL rounds at it at `cadence`, laid with `spread` (director.ts stimulus.burst → combat.ts fireWeapon); → the burst's condition (yield it to wait it out, or let it run) */
function shoot(c: BeatCtx, u: UnitRef, at: Vec3 | UnitRef, n: number, o: { cadence?: number; spread?: number; crouch?: boolean; face?: number } = {}): Cond {
  c.order(u, { aimAt: at, upper: 'aim', hot: true, flinch: /^Red /.test(u.callsign), stance: 'none', ...(o.crouch !== undefined ? { crouch: o.crouch } : {}), ...(o.face !== undefined ? { face: o.face } : {}) });   // (the opposition START at rounds past them — the animator's flinch throws a muzzle about for half a second, which is what amateurs' rounds do; the pair kneel steady under it, and their rounds go where they are laid)
  return c.stimulus.burst(u, at, n, { cadence: o.cadence ?? 0.16, spread: o.spread ?? 0.012 });
}
/** a man's head, for a round meant to end it */
const headOf = (q: Query, u: UnitRef, crouched = false): Vec3 => { const p = q.pos(u); return [p[0], crouched ? 1.08 : 1.6, p[2]]; };
/** DROP `u`: `by`'s burst into him (his chest — tracked — then, should he somehow still stand, his head); → whether he went. The one place the loud half means rounds for a man. */
function* drop(c: BeatCtx, by: UnitRef, u: UnitRef, o: { crouched?: boolean; label: string }): Generator<Cond, boolean, CondResult> {
  const q = c.query; if (!q.alive(u)) return true;
  yield shoot(c, by, u, 4, { cadence: 0.1, spread: 0.006 });
  yield* untilT(c, qq => !qq.alive(u), o.label, 1.4);
  if (q.alive(u)) { yield shoot(c, by, headOf(q, u, o.crouched), 4, { cadence: 0.1, spread: 0.004 }); yield* untilT(c, qq => !qq.alive(u), o.label + ' (2nd)', 1.4); }
  return !q.alive(u);
}

/** THE LOUD HALF's spine — Blue One's thread, the radio, the camera — from the drill's cut on the held stack to the cut outside. Blue Two and the four have beats of their own (loudBeats),
 *  cued off this one by flags and signals; nothing here waits on a system's answer without a clock on it (untilT), so the show never hangs. */
function* loudHalf(c: BeatCtx, ops: [UnitRef, UnitRef], tangos: UnitRef[], H: { door: DoorRef; west: DoorRef; tango: LoadoutRef }): NGen {
  const [one, two] = ops; const q = c.query;
  yield c.wait(LT.after);
  const L0 = q.t; const L = () => q.t - L0; const Lr = () => +L().toFixed(2);
  const atL = function* (t: number): NGen { if (L() < t) yield c.until(() => L() >= t, `L≥${t}`); };
  const reds: UnitRef[] = [];
  const shot = (key: keyof typeof LS, chapter: number) => { const s: LoudShot = LS[key]; c.camera.pin({ ...s, chapter, title: s.title }); };
  const downs = () => reds.filter(r => !q.alive(r)).length;
  c.note('loud', { t: +q.t.toFixed(2) }); c.chaos(0.8);   // decision 6: the loud minute breaks things at 0.8 whatever the player keeps (put back by the runtime as the program ends)
  c.doors.open(H.west, 1.9);   // the west door's leaf laid back flat against the cubicle side of the wall north of its frame (it has no closer: the breach's boot left it swinging) — out of the doorway One will kneel in and fire through, and out of everybody's way through it
  c.caption('10:03 · corridor'); shot('door', 5);

  // ---------------------------------------------------------------- 10:03 · THE DOOR — Two, point on the jamb, steps square to the leaf by the lock and boots it; One covers over him; the leaf flies north across the corridor
  c.order(one, { goal: null, face: WEST, stance: 'highReady', upper: 'aim', aimAt: [30.6, 1.15, 12.2], hot: true, crouch: false, strafe: false });
  const ks = c.doors.kickSpot(H.door, two);
  c.order(two, { goal: ks.pos, speed: 1.2, face: ks.yaw, stance: 'highReady', upper: 'none', crouch: false, strafe: false, aimAt: null });
  yield* untilT(c, qq => qq.arrived(two), 'two square to the leaf', 3);
  yield* atL(LT.kick);
  c.doors.kick(H.door, two, { leg: 'right' });
  yield* untilT(c, qq => Math.abs(qq.door(H.door).angle) > 0.8, 'leaf flung', 1.6); c.note('door:kicked', { t: Lr(), angle: +q.door(H.door).angle.toFixed(2) });
  c.start('two');   // Two's thread from here: off the kick to the hinge side of the opening, then west through the break room to the aisles on One's word
  yield c.wait(0.1);
  yield* legs(c, one, [LOUD.oneCorrVia, LOUD.oneCorr], { speed: 3.0, stance: 'highReady', end: { face: WEST, crouch: true, upper: 'aim', aimAt: LOUD.corrFar, hot: true, stance: 'none' } });   // straight through on the boot while the leaf is still flying (its closer wakes two seconds after the last touch: a man in the opening then wears the leaf)
  c.note('one:corridor', { t: Lr(), at: q.pos(one).map(x => +x.toFixed(2)) });
  yield* atL(LT.radio1); c.say(one, LL.oneOpen, { radio: true });
  yield* atL(LT.control); c.control(LL.control1);
  yield* atL(LT.spawn);
  // the four, stood up in the lobby out of every line — the budgets are eight characters (Sam included) and 64 steady lights (every man's weapon light is one, lit or not): the room's three dead
  // leave the world here, unseen (no later shot frames the room's floor where they lay: the bounds back through it are framed on its west door and cut outside)
  for (const tg of tangos) c.despawn(tg);
  LOUD.spawn.forEach((p, i) => reds.push(c.spawn(H.tango, p, { callsign: `Red ${i + 1}`, yaw: LOUD.spawnYaw[i] })));
  c.note('hostiles', { n: reds.length, t: Lr() });
  yield* atL(LT.radio2); c.say(one, LL.oneCopy, { radio: true }); c.flag.goWest = true; c.signal('twoWest');   // (every cue to another beat is a FLAG the beat polls, the signal only its name in the log: c.on() sees a signal on the one tick it is fresh, and a beat inside a burst's wait that tick would never hear it)
  yield* atL(LT.hGo); for (const b of ['red1', 'red2', 'red3', 'red4']) c.start(b);

  // ---------------------------------------------------------------- CONTACT FRONT — two at the arch and up the corridor; One's rounds star the glass beside the first as he kneels, then take him; the second puts a burst up the corridor and ducks into the cubicles
  yield* untilT(c, qq => !!qq.flag('h1Seen'), 'two in the arch', 8);
  c.note('contact', { t: Lr() }); shot('corridor', 5); c.say(one, LL.oneContact, { radio: true });
  yield* untilT(c, qq => !!qq.flag('h1Set'), 'the first kneels at the glass', 7);
  yield c.wait(0.3); shot('glass', 5); yield c.wait(0.3);   // the insert: from inside the conference room, out through the pane they kneel against
  yield shoot(c, one, LOUD.glassByH1[0], 2, { cadence: 0.16, spread: 0.005 }); yield c.wait(0.25); yield shoot(c, one, LOUD.glassByH1[1], 2, { cadence: 0.16, spread: 0.005 }); yield c.wait(0.35); yield shoot(c, one, LOUD.glassByH1[2], 3, { cadence: 0.14, spread: 0.005 });
  c.note('glass', { t: Lr() });
  yield c.wait(1.1);
  { const ok = yield* drop(c, one, reds[0], { crouched: true, label: 'red 1 down' }); c.note('h1:down', { t: Lr(), ok }); c.flag.h1Down = true; }
  yield c.wait(1.1); shot('corridor', 5);   // back over One's shoulder: the second man's burst up the corridor and his dash for the cubicles' doorway
  yield* untilT(c, qq => !!qq.flag('h2Ducked') || !qq.alive(reds[1]), 'the second out of the corridor', 6);
  yield shoot(c, one, LOUD.wallByDoorNW, 3, { cadence: 0.13 });   // chasing him into the wall by the doorway
  yield c.wait(1.0);
  c.say(one, LL.oneShift, { radio: true }); c.note('one:shift', { t: Lr() });
  yield c.wait(0.6);

  // ---------------------------------------------------------------- 10:04 · THE CUBICLES — cut to the farm's east end where Two already trades down the middle aisle from the block corner; One back through the room onto its west doorway behind him
  c.caption('10:04 · cubicles'); shot('aisles', 6);
  yield* legs(c, one, [...LOUD.oneToDoor, LOUD.oneDoor], { speed: 3.3, stance: 'lowReady', end: { face: WEST, crouch: true, upper: 'aim', aimAt: LOUD.aisleFloor[1], hot: true, stance: 'none' } });
  c.flag.oneSet = true; c.say(one, LL.oneSetDoor, { radio: true }); c.note('one:door', { t: Lr(), at: q.pos(one).map(x => +x.toFixed(2)) });
  c.start('aisleCuts');   // the trading's cuts (below): the reverse from behind the kneeling man up the aisle at the doorway, then high over the blocks onto the mouth for the last show
  // the aisle's mouth: the two behind the west caps lean out of their ends by turns to lay them low; One and Two put theirs into the carpet at those ends, over Red 4's cap into the desk behind him, and — when a man shows a second time — into him
  yield c.wait(0.5); yield shoot(c, one, LOUD.aisleFloor[1], 3, { cadence: 0.14 });
  yield* untilT(c, qq => !!qq.flag('h4Cap') || (reds[3] && !qq.alive(reds[3])), 'red 4 behind the south cap', 8);
  yield c.wait(0.4); yield shoot(c, one, LOUD.carton, 3, { cadence: 0.13 });        // the carton in the aisle beside the mouth hops
  yield c.wait(0.9); yield shoot(c, one, LOUD.aisleFloor[2], 3, { cadence: 0.14 }); // the carpet at the cap's end he went behind
  // trade: a burst into the carpet at the mouth's end a man has just leaned out of, down again while theirs come back into the jambs about him — until Red 2 has shown once too often
  while (L() < LT.h2KillAt && q.alive(reds[1])) {
    const r = yield c.any(c.until(qq => !!qq.flag('h2Out') || !!qq.flag('h4Out'), 'a man shows'), c.wait(1.6));
    if (r.index === 0) { yield c.wait(0.55); yield shoot(c, one, LOUD.aisleFloor[q.flag('h2Out') ? 1 : 2], 3, { cadence: 0.13 }); yield c.wait(1.3); }
  }
  c.flag.h2Kill = true;   // Red 2's next show down the aisle is his last
  yield* untilT(c, qq => (!!qq.flag('h2Out') && !qq.flag('h4Out')) || !qq.alive(reds[1]), 'red 2 shows', 9);
  yield c.wait(0.3);
  { const ok = yield* drop(c, one, reds[1], { crouched: true, label: 'red 2 down' }); c.note('h2:down', { t: Lr(), ok }); c.flag.h2Down = true; c.flag.h2Out = false; c.flag.h2Claim = false; }
  yield c.wait(0.8); yield shoot(c, one, LOUD.aisleFloor[2], 2, { cadence: 0.18 });

  // ---------------------------------------------------------------- THE CHARGE — Two rolls the stun charge down the aisle onto its mouth: the flash, the bang the floor hears, the tile out of the grid over it; Red 4 reels out from his cap blind and One drops him
  yield* atL(LT.bangAt - 1.2);
  c.cancel('aisleCuts'); shot('bang', 6); yield c.wait(1.2);
  c.flag.goBang = true; c.signal('bang');   // Two throws it (his beat), says so
  { const got = yield c.any(c.on('bang'), c.wait(4.5, 'bang (≤ 4.5 s)')); c.note('bang', { t: Lr(), heard: got.index === 0 }); c.flag.banged = true; }
  yield c.wait(0.6);
  c.order(one, { crouch: true, upper: 'aim', aimAt: LOUD.h4Peek, hot: true });
  yield* untilT(c, qq => !!qq.flag('h4Out') || !reds[3] || !qq.alive(reds[3]), 'red 4 reels out', 5);
  { const ok = yield* drop(c, one, reds[3], { label: 'red 4 down' }); c.note('h4:down', { t: Lr(), ok }); c.flag.h4Down = true; c.flag.h4Out = false; }
  yield c.wait(0.8);
  c.flag.goSouth = true; c.signal('twoSouth');   // the aisle is done: Two shifts to the block's south corner for the man round the south side

  // ---------------------------------------------------------------- THE SOUTH AISLE — Two on the block's south-east corner, the sun across the floor in front of him and Red 3 at the far desk end in the shaft: rounds into the sunlit floor short of Two and the wall behind him, Two's into the desk behind the man's shoulder — the monitor dies, the paper goes up — and into him when he leans out
  yield* untilT(c, qq => !!qq.flag('twoSouth'), 'two on the south aisle', 8);
  shot('south', 6);
  c.order(one, { crouch: true, upper: 'aim', aimAt: LOUD.aisleFloor[3], hot: true });   // One keeps the middle aisle
  yield* untilT(c, qq => !!qq.flag('h3Down'), 'red 3 down', 22);
  yield c.wait(0.9);
  c.note('downs', { n: downs(), t: Lr() });

  // ---------------------------------------------------------------- FOUR DOWN — a slow swing over the wrecked farm; the count on the net; Control sends them out south
  shot('room', 6);
  yield c.wait(2.2); c.say(one, LL.oneClear(downs()), { radio: true }); c.note('radio:clear', { n: downs(), t: Lr() });
  yield c.wait(5.0); c.control(LL.control2);
  yield c.wait(3.6);

  // ---------------------------------------------------------------- SMOKE AND OUT — Two's can into the south aisle's sun; the pair peel back by bounds (one covers, one moves) through the break room; One's own can at their heels; out of the south door into the lot
  c.caption('smoke and out');
  c.flag.goSmoke = true; c.signal('smoke');   // Two throws it (his beat) from the south post
  yield* untilT(c, qq => !!qq.flag('smoked'), 'smoke out', 3); c.note('smoke', { t: Lr() });
  shot('smoke', 7);
  yield c.wait(1.0); c.say(one, LL.oneCovering); yield shoot(c, one, LOUD.aisleFloor[2], 2, { cadence: 0.22 });
  yield c.wait(6.0);   // held: the plume climbs white into the shafts and fills the aisle; Two comes back up the block's east side onto the west door's jamb (his beat, on 'smoke')
  yield* untilT(c, qq => !!qq.flag('twoAtDoor'), 'two on the west door', 9);
  shot('peel', 7);
  yield c.wait(0.7); c.say(one, LL.oneMove);
  yield* legs(c, one, [[29.6, 0, 19.2], LOUD.oneCoverS], { speed: 3.0, stance: 'lowReady', end: { face: WEST + 0.45, crouch: true, upper: 'aim', aimAt: [28.0, 1.1, 17.7], hot: true, stance: 'none' } });   // One off the doorway past Two to the room's middle, down on a knee covering back on the west door
  c.flag.oneIn = true; c.note('one:in', { t: Lr() }); c.say(one, LL.oneLast);
  yield* untilT(c, qq => !!qq.flag('twoAtExt'), 'two at the south door', 9);
  // One's can at their heels as he turns for the door: the plume fills the room's south end and the doorway they leave by
  c.order(one, { upper: 'none', aimAt: LOUD.smoke2At });
  yield c.wait(0.3); c.stimulus.charge(LOUD.smoke2At, { by: one, kind: 'smoke', fuse: 0.9 }); c.note('smoke2', { t: Lr() });
  yield c.wait(0.7);
  c.caption('10:05 · south lot'); shot('lot', 8);
  yield* untilT(c, qq => !!qq.flag('twoOutside'), 'two outside', 7);
  yield* legs(c, one, [LOUD.breakS[1], ...LOUD.outOne], { speed: 3.0, stance: 'lowReady', pass: 0.6, cap: 7, end: { face: WEST + 0.55, crouch: true, upper: 'aim', aimAt: [31.5, 1.2, 24.35], hot: true, stance: 'none' } });   // out and along the wall behind the van; turns and covers the door they came out of
  c.note('out', { t: Lr(), one: q.alive(one), two: q.alive(two), at: [q.pos(one), q.pos(two)].map(p => p.map(x => +x.toFixed(1))) });
  yield c.wait(1.2); c.say(one, LL.oneOut, { radio: true });
  yield c.wait(7.5);   // held: the smoke rolling out of the door into the sun behind the two men on their knees
  c.note('exfil:cut', { t: Lr(), show: +q.t.toFixed(2), downs: downs() });
}

/** Blue Two's thread and the four's, cued off the spine's flags / signals (declared as beats of 'breach' below; started by the spine), and the trading's camera cuts. Each ends when its man is down or the show cuts. */
const loudBeats = (H: { ext: DoorRef }): Record<'two' | 'red1' | 'red2' | 'red3' | 'red4' | 'aisleCuts', BeatFn> => ({
  /** the trading's cuts, off One's word that he is set: the reverse from behind the man kneeling at the west blocks' line up the aisle at the doorway; then, once Red 2's next show is to be his last, high over the blocks onto the mouth */
  aisleCuts: function* (c) {
    const pin = (key: 'reverse' | 'aislesHi') => { const sh: LoudShot = LS[key]; c.camera.pin({ ...sh, chapter: 6, title: sh.title }); };
    yield c.wait(3.4); pin('reverse');
    yield* untilT(c, qq => !!qq.flag('h2Kill'), 'the last show armed', 20); yield c.wait(0.8); pin('aislesHi');
  },
  /** BLUE TWO — the room side of the kicked door over One; west through the break room and out of its west door to the south-east block's aisle corner on One's word; Red 4 up the middle aisle at
   *  him (rounds into the carpet by the man's knee, then chasing him into the aisle's mouth); the charge down the aisle on One's cue; south to the block's far corner for the man round the south side
   *  — the south aisle and the sun in front of him — trading into the desk behind the man's shoulder until he shows; the smoke; back onto the west door's jamb covering One through; the south door; out. */
  two: function* (c) {
    const two = c.unit('Blue Two')!; const q = c.query;
    c.order(two, { goal: LOUD.twoDoor, speed: 2.2, face: NORTH - 0.35, stance: 'none', upper: 'aim', aimAt: [28.2, 1.3, 10.6], hot: false, crouch: true, strafe: false });   // (west of the opening on his knee, muzzle out across it north-west, lowered while One goes through it: squad.ts's own muzzle rule, hot off)
    yield c.until(qq => !!qq.flag('goWest'), "one's word: the west door");
    yield c.wait(0.5);
    yield* legs(c, two, [...LOUD.twoVia, LOUD.twoMid], { speed: 3.3, stance: 'lowReady', end: { face: WEST, crouch: true, upper: 'aim', aimAt: LOUD.aisleFloor[0], hot: true, stance: 'none' } });
    c.flag.twoSet = true; c.say(two, LL.twoSet, { radio: true }); c.note('two:set', { t: +q.t.toFixed(2), at: q.pos(two).map(x => +x.toFixed(2)) });
    yield* untilT(c, qq => !!qq.flag('h4Knee'), 'a man on the middle aisle', 30);
    c.say(two, LL.twoContact, { radio: true }); c.note('two:contact', { t: +q.t.toFixed(2) });
    yield c.wait(0.45); yield shoot(c, two, LOUD.aisleFloor[0], 4, { cadence: 0.12 });   // into the carpet at his knee (never the carton beside him: cardboard is concealment, not cover — combat.ts — and the round would go on into the man behind it)
    yield* untilT(c, qq => !!qq.flag('h4Cap'), 'he dives for the cap', 6);
    yield shoot(c, two, LOUD.aisleFloor[2], 3, { cadence: 0.12 }); yield c.wait(0.9); yield shoot(c, two, LOUD.seChairN, 2, { cadence: 0.16 }); yield c.wait(0.4); yield shoot(c, two, LOUD.aisleFloor[3], 3, { cadence: 0.14 });
    c.order(two, { crouch: true, aimAt: LOUD.aisleFloor[2] });
    // trade down the aisle (a burst into the mouth's carpet whenever a man has just shown there) until One calls the charge
    for (;;) {
      const r = yield c.any(c.until(qq => !!qq.flag('goBang'), 'the charge called'), c.wait(1.7 + 0.8 * c.rand())); if (r.index === 0) break;
      if (q.flag('h4Out') || q.flag('h2Out')) yield shoot(c, two, LOUD.aisleFloor[q.flag('h2Out') ? 1 : 2], 3, { cadence: 0.14 });
      if (q.flag('goBang')) break;   // (called while the burst went out)
    }
    // THE CHARGE: up off the knee and bowled down the aisle onto its mouth
    c.order(two, { crouch: false, upper: 'none', stance: 'none', aimAt: LOUD.bangAt }); c.say(two, LL.twoBang);
    yield c.wait(0.45); c.stimulus.charge(LOUD.bangAt, { by: two, kind: 'flash', fuse: 1.1 }); c.note('bang:thrown', { t: +q.t.toFixed(2) });
    yield c.wait(0.3); c.order(two, { crouch: true, upper: 'aim', aimAt: [LOUD.twoMid[0] - 1.4, 0.05, LOUD.twoMid[2] + 0.9] });   // down, eyes off it, muzzle to the floor
    yield c.until(qq => !!qq.flag('goSouth'), "one's word: south");
    // SOUTH: down the block's east side to its far corner — the south aisle in front of him, the sun across the floor at his feet, Red 3 at the far desk end in the shaft
    c.say(two, LL.twoShiftS, { radio: true });
    yield* legs(c, two, [...LOUD.twoSouthVia, LOUD.twoSouth], { speed: 2.9, stance: 'lowReady', end: { face: WEST, crouch: true, upper: 'aim', aimAt: LOUD.swDeskSE[0], hot: true, stance: 'none' } });
    c.flag.twoSouth = true; c.note('two:south', { t: +q.t.toFixed(2), at: q.pos(two).map(x => +x.toFixed(2)) });
    yield* untilT(c, qq => !!qq.flag('h3Post'), 'red 3 at his corner', 6);
    const tS = q.t;
    yield c.wait(0.6); c.order(two, { crouch: false }); yield c.wait(0.45); yield shoot(c, two, LOUD.swDeskSE[0], 3, { cadence: 0.14, crouch: false });   // up, and into the desk end over the man's shoulder
    c.order(two, { crouch: true }); yield c.wait(1.4);
    c.order(two, { crouch: false }); yield c.wait(0.45); yield shoot(c, two, LOUD.swDeskSE[1], 5, { cadence: 0.11, crouch: false, spread: 0.004 });   // the paper stack behind him — up it goes (laid tight: the line has the cap's end to skim and a hand's height over the stack to keep)
    c.order(two, { crouch: true }); yield c.wait(1.5);
    c.order(two, { crouch: false }); yield c.wait(0.45); yield shoot(c, two, LOUD.swDeskSE[2], 3, { cadence: 0.14, crouch: false });   // the desk beyond
    c.order(two, { crouch: true });
    yield* untilT(c, () => q.t - tS >= LT.h3KillAfter, 'the trading', LT.h3KillAfter);
    c.flag.h3Kill = true;   // the next time he leans out to fire up the aisle, Two is waiting on it
    const r3 = c.unit('Red 3');
    yield* untilT(c, qq => !!qq.flag('h3Out') || !r3 || !qq.alive(r3), 'red 3 shows', 8);
    { const ok = r3 ? yield* drop(c, two, r3, { crouched: true, label: 'red 3 down' }) : false; c.note('h3:down', { t: +q.t.toFixed(2), ok }); c.flag.h3Down = true; }
    c.order(two, { crouch: true, aimAt: LOUD.swDeskSE[2] });
    yield c.until(qq => !!qq.flag('goSmoke'), 'the smoke called');
    // SMOKE: up, and his can bowled into the south aisle between them and the west — into the shafts
    c.order(two, { crouch: false, upper: 'none', stance: 'none', aimAt: LOUD.smokeAt });
    yield c.wait(0.4); c.stimulus.charge(LOUD.smokeAt, { by: two, kind: 'smoke', fuse: 1.0 }); c.say(two, LL.twoSmoke, { radio: true }); c.flag.smoked = true;
    yield c.wait(0.9); c.say(two, LL.twoMoving);
    // BOUNDS: back up the block's east side and onto the west door's room-side jamb, past One kneeling in the doorway, covering the aisle over him
    yield* legs(c, two, [...LOUD.twoBackVia, LOUD.twoCoverW], { speed: 3.1, stance: 'lowReady', end: { face: WEST, crouch: false, upper: 'aim', aimAt: [21.5, 1.05, 18.0], hot: true, stance: 'highReady' } });
    c.flag.twoAtDoor = true; c.note('two:door', { t: +q.t.toFixed(2), at: q.pos(two).map(x => +x.toFixed(2)) }); c.say(two, LL.twoSetDoor);
    yield* untilT(c, qq => !!qq.flag('oneIn'), 'one through', 10);
    yield c.wait(0.9);
    yield* legs(c, two, LOUD.breakS, { speed: 3.1, stance: 'lowReady', end: { face: SOUTH, crouch: false, upper: 'none', stance: 'highReady' } });
    c.flag.twoAtExt = true; c.note('two:ext', { t: +q.t.toFixed(2) }); c.say(two, LL.twoOut);
    yield c.wait(0.6);
    yield* legs(c, two, LOUD.outTwo.slice(0, 1), { speed: 2.0, stance: 'highReady', cap: 6 });   // through the south door, the leaf off his shoulder…
    c.doors.open(H.ext, 1.7, { hold: true });   // …and left standing out into the lot on its stay (its closer would have it shut in One's face and on the smoke)
    c.flag.twoOutside = true; c.note('two:outside', { t: +q.t.toFixed(2), at: q.pos(two).map(x => +x.toFixed(2)) });
    yield* legs(c, two, LOUD.outTwo.slice(1), { speed: 2.8, stance: 'lowReady', pass: 0.6, end: { face: NORTH - 0.7, crouch: true, upper: 'aim', aimAt: [33.6, 1.2, 22.8], hot: true, stance: 'none' } });   // along the wall past the van's nose and down on a knee covering back up it
  },
  /** RED 1 — through the arch and up the corridor's north side at a run to a knee in front of the conference room's glass; his rounds go high up the corridor into its east end wall and into the manager's leaf standing ajar between him and the man at the far door. He is the first to go. */
  red1: function* (c) {
    const u = c.unit('Red 1')!; const q = c.query;
    if (!(yield* legs(c, u, LOUD.h1Run.slice(0, 2), { speed: 3.7 }))) return;
    c.flag.h1Seen = true;
    if (!(yield* legs(c, u, LOUD.h1Run.slice(2), { speed: 3.9, end: { face: EAST, crouch: true, upper: 'aim', aimAt: LOUD.inOneCorr[0], flinch: true } }))) return;
    c.flag.h1Set = true; c.note('h1:set', { t: +q.t.toFixed(2), at: q.pos(u).map(x => +x.toFixed(2)) });
    yield c.wait(0.45); yield shoot(c, u, LOUD.inOneCorr[0], 4, { cadence: 0.1, crouch: true });
    yield c.wait(0.8); yield shoot(c, u, LOUD.inOneCorr[2], 3, { cadence: 0.1, crouch: true });
    for (let i = 0; q.alive(u); i++) { yield c.wait(0.9 + 0.5 * c.rand()); if (!q.alive(u)) return; yield shoot(c, u, LOUD.inOneCorr[i % 2 ? 2 : 0], 2 + (i % 2), { cadence: 0.1, crouch: true }); }
  },
  /** RED 2 — the corridor's south side a stride behind Red 1, a knee, a burst up it; when the man beside him drops, another into the ajar leaf and he ducks into the cubicles' north-west doorway, along the north
   *  aisle and down behind the north-east block's west end cap. From there: up to fire high over everything into the wall north of the door, or out past the cap's end into the aisle to lay them low at the
   *  doorway's jambs and carpet — shown down the aisle each time; the second show after One is set is the one One is waiting on. */
  red2: function* (c) {
    const u = c.unit('Red 2')!; const q = c.query;
    if (!(yield* legs(c, u, LOUD.h2Run, { speed: 3.5, end: { face: EAST, crouch: true, upper: 'aim', aimAt: LOUD.inOneCorr[1], flinch: true } }))) return;
    yield c.wait(0.7); yield shoot(c, u, LOUD.inOneCorr[1], 4, { cadence: 0.1, crouch: true });
    yield* untilT(c, qq => !!qq.flag('h1Down'), 'red 1 down', 8);
    yield c.wait(0.3); yield shoot(c, u, LOUD.inOneCorr[2], 3, { cadence: 0.1, crouch: true });   // into the leaf, covering his own move
    if (!(yield* legs(c, u, LOUD.h2Duck, { speed: 4.0 }))) return;
    c.flag.h2Ducked = true; c.note('h2:ducked', { t: +q.t.toFixed(2) });
    if (!(yield* legs(c, u, LOUD.h2ToCap, { speed: 3.4, end: { face: EAST, crouch: true, upper: 'aim', aimAt: LOUD.inOneDoorHi, flinch: true } }))) return;
    c.flag.h2Cap = true; c.note('h2:cap', { t: +q.t.toFixed(2), at: q.pos(u).map(x => +x.toFixed(2)) });
    for (let i = 0; q.alive(u); i++) {
      // up behind the cap, high over everything into the wall north of the door
      yield c.wait(0.7 + 0.5 * c.rand()); if (!q.alive(u)) return;
      yield shoot(c, u, LOUD.inOneDoorHi, 3, { cadence: 0.1, crouch: false }); c.order(u, { crouch: true });
      // out past the cap's end into the aisle (once Red 4 is not out in it), low at the door's jambs and the carpet before it — shown for a second and a half
      yield c.wait(0.8 + 0.4 * c.rand()); if (!q.alive(u)) return;
      if (!(yield* untilT(c, qq => !qq.flag('h4Claim'), 'the aisle free', 8))) continue;   // (still Red 4's after eight seconds: stay behind the cap, fire high again, ask again — never two in the mouth)
      c.flag.h2Claim = true;   // (the mouth is his: Red 4 waits behind his cap until he is back)
      yield* legs(c, u, [LOUD.h2Peek], { speed: 2.6, cap: 3, end: { face: EAST, crouch: true, upper: 'aim', aimAt: LOUD.inOneDoor[i % 3], flinch: true } });
      c.flag.h2Out = true;     // shown down the aisle NOW (One's cue is this, not the start of the move: a burst at a man still behind the block goes into its spine)
      if (q.flag('h2Kill') && q.flag('oneSet')) yield* untilT(c, qq => !qq.alive(u), 'the burst that ends it', 2.2);   // (One is up waiting on this one: the beat idles into the burst that ends it — and lets go of the mouth the frame he is down)
      else { yield c.wait(0.25); if (q.alive(u)) yield shoot(c, u, LOUD.inOneDoor[i % 3], 4, { cadence: 0.1, crouch: true }); yield c.wait(0.3); }
      c.flag.h2Out = false;
      if (!q.alive(u)) { c.flag.h2Claim = false; return; }
      yield* legs(c, u, [LOUD.h2ToCap[2]], { speed: 2.6, cap: 3, end: { face: EAST, crouch: true, upper: 'aim', aimAt: LOUD.inOneDoorHi, flinch: true } });
      c.flag.h2Claim = false;
    }
  },
  /** RED 3 — the long way round: across the lobby behind Red 4, down the cubicle farm's west aisle and east along the SOUTH aisle through the sun off the frontage, to a knee at the south-west block's far corner
   *  with the desk end at his shoulder; his rounds go into the sunlit floor short of Two's south post and high into the wall behind it (whether or not Two is on it yet); he leans out south of the desk to fire up
   *  the aisle — and the time he does it after Two has walked his rounds across the desk behind him, he is dropped in the shaft. */
  red3: function* (c) {
    const u = c.unit('Red 3')!; const q = c.query;
    yield c.wait(0.6);
    if (!(yield* legs(c, u, [...LOUD.h34In, ...LOUD.h3Run.slice(0, 2)], { speed: 3.5 }))) return;
    c.flag.h3South = true; c.note('h3:south', { t: +q.t.toFixed(2) });
    if (!(yield* legs(c, u, [...LOUD.h3Run.slice(2), LOUD.h3Post], { speed: 3.3, end: { face: EAST, crouch: true, upper: 'aim', aimAt: LOUD.inTwoSouth[0], flinch: true } }))) return;
    c.flag.h3Post = true; c.note('h3:post', { t: +q.t.toFixed(2), at: q.pos(u).map(x => +x.toFixed(2)) });
    yield c.wait(0.5); yield shoot(c, u, LOUD.seDeskS8, 4, { cadence: 0.1, crouch: true, spread: 0.02 });   // his first goes wide left across the block's south desks: the lit monitor there dies
    for (let i = 0; q.alive(u); i++) {
      yield c.wait(0.8 + 0.6 * c.rand()); if (!q.alive(u)) return;
      yield shoot(c, u, LOUD.inTwoSouth[i % LOUD.inTwoSouth.length], 3 + (i % 2), { cadence: 0.1, crouch: true });
      if (i % 2 === 1 || q.flag('h3Kill')) {   // out south of the desk end into the aisle to fire up it: shown
        yield c.wait(0.5); if (!q.alive(u)) return;
        yield* legs(c, u, [LOUD.h3Peek], { speed: 2.2, cap: 3, end: { face: EAST, crouch: true, upper: 'aim', aimAt: LOUD.inTwoSouth[1], flinch: true } });
        c.flag.h3Out = true;
        if (q.flag('h3Kill')) yield c.wait(2.4); else { yield c.wait(0.25); if (q.alive(u)) yield shoot(c, u, LOUD.inTwoSouth[1], 3, { cadence: 0.1, crouch: true }); yield c.wait(0.4); }
        if (!q.alive(u)) return;
        c.flag.h3Out = false; yield* legs(c, u, [LOUD.h3Post], { speed: 2.2, cap: 3, end: { face: EAST, crouch: true, upper: 'aim', aimAt: LOUD.inTwoSouth[0], flinch: true } });
      }
    }
  },
  /** RED 4 — through the lobby's east opening and straight up the middle aisle at a run to a knee at the west blocks' east end line, in the open, a long burst at the doorway and the corner; then across the aisle's
   *  mouth and down behind the south-east block's west end cap, leaning out of its north end to fire by turns with Red 2; the charge lands at that mouth — he reels out into the aisle, blind, and One drops him. */
  red4: function* (c) {
    const u = c.unit('Red 4')!; const q = c.query;
    if (!(yield* legs(c, u, [...LOUD.h34In, ...LOUD.h4Run], { speed: 3.8, end: { face: EAST, crouch: true, upper: 'aim', aimAt: LOUD.inTwoMid[0], flinch: true } }))) return;
    c.flag.h4Knee = true; c.note('h4:knee', { t: +q.t.toFixed(2), at: q.pos(u).map(x => +x.toFixed(2)) });
    yield c.wait(0.35); yield shoot(c, u, LOUD.neDeskS, 3, { cadence: 0.1, crouch: true, spread: 0.02 });   // the first climbs wide left into the block's aisle-side desk (its monitor cracks)
    yield c.wait(0.3); yield shoot(c, u, LOUD.inTwoMid[0], 4, { cadence: 0.1, crouch: true });
    yield c.wait(0.6); yield shoot(c, u, LOUD.inTwoMid[2], 3, { cadence: 0.1, crouch: true });
    yield c.wait(0.4);
    if (!(yield* legs(c, u, LOUD.h4ToCap, { speed: 4.0, end: { face: EAST, crouch: true, upper: 'aim', aimAt: LOUD.inTwoMid[1], flinch: true } }))) return;
    c.flag.h4Cap = true; c.note('h4:cap', { t: +q.t.toFixed(2), at: q.pos(u).map(x => +x.toFixed(2)) });
    for (let i = 0; q.alive(u) && !q.flag('banged'); i++) {
      const r = yield c.any(c.until(qq => !!qq.flag('banged'), 'banged'), c.wait(1.2 + 0.6 * c.rand())); if (r.index === 0 || !q.alive(u)) break;
      const free = yield* untilT(c, qq => !qq.flag('h2Claim') || !!qq.flag('banged'), 'the aisle free', 8);
      if (q.flag('banged') || !q.alive(u)) break;
      if (!free) continue;   // (still Red 2's after eight seconds: wait on behind the cap and ask again — never two in the mouth)
      c.flag.h4Claim = true;
      yield* legs(c, u, [LOUD.h4Peek], { speed: 2.6, cap: 3, end: { face: EAST, crouch: true, upper: 'aim', aimAt: LOUD.inTwoMid[i % 3], flinch: true } });
      c.flag.h4Out = true;
      if (q.flag('banged') || !q.alive(u)) break;
      const tgt = q.flag('oneSet') && i % 2 ? LOUD.inOneDoor[(i >> 1) % 2 ? 2 : 0] : LOUD.inTwoMid[i % 3];   // (never the south jamb from this end of the mouth: that line runs up Two's own)
      yield c.wait(0.25); yield shoot(c, u, tgt, 4, { cadence: 0.1, crouch: true }); yield c.wait(0.35);
      c.flag.h4Out = false;
      if (q.flag('banged') || !q.alive(u)) break;
      yield* legs(c, u, [LOUD.h4ToCap[1]], { speed: 2.6, cap: 3, end: { face: EAST, crouch: true, upper: 'aim', aimAt: LOUD.inTwoMid[1], flinch: true } });
      c.flag.h4Claim = false;
    }
    c.flag.h4Claim = false; c.flag.h4Out = false;
    if (!q.alive(u)) return;
    yield* untilT(c, qq => !!qq.flag('banged'), 'the charge', 20);
    // the flash at the aisle's mouth beside him: he reels up and out into it, gun down, a hand's pace — shown, blind
    yield c.wait(0.45); if (!q.alive(u)) return;
    c.order(u, { goal: LOUD.h4Peek, speed: 0.75, face: EAST + 0.7, crouch: false, upper: 'none', stance: 'none', aimAt: [LOUD.h4Peek[0] + 1.5, 0.15, LOUD.h4Peek[2] - 0.8], strafe: true, flinch: true });
    yield c.wait(0.9); c.flag.h4Out = true;
    yield c.until(qq => !qq.alive(u), 'red 4 down');
  },
});

// ================================================================ THE NIGHT: places, clocks, words, framings — every number below is a taste constant (docs/internal/night-showcase.md §5)
// The floor (x east, z south; FollowCamera yaw: 0 looks north, 90 west, −90 east, ±180 south — the eye `dist` back along it, `pitch`° up; a character's yaw: 0 faces
// south (+z), π/2 east, π north, −π/2 west): corridor z 10‥12.2 across the building; north of it the server room (x 14‥22), the manager's office (22‥30) with the
// KEYPAD side door between them at x 22, the storage room (30‥36) with the BREAKER on its wall; south of it the cubicle farm (x 12‥28, doorways off the corridor at
// x 15.7 and 22.7) and the break room (28‥36: vending machines in its north-west corner, the counter and its coffee machine along the east wall, the fire exit in
// the east wall at z 20.6 onto the east lot and its sodium lamp). Every mark was walked headlessly (tools/qa/night-probes.ts) — clear straight lines between
// consecutive goals, reach of the row each beat taps, out of every leaf's sweep.
const NIGHT = {
  // ---- Sam's marks
  lot: [36.85, 0, 19.7] as Vec3, lotYaw: 0.35,          // crouched against the east wall a hand north of the fire exit's frame, in reach of its leaf (it swings INTO the room off him)
  inDoor: [35.0, 0, 20.75] as Vec3,                       // a stride and a half inside, square through the opening's latch half
  pullSpot: [34.7, 0, 21.5] as Vec3,                      // out of the leaf's inward sweep (hinge (36, 20.02), r 1.16), a hand from where its tip comes to: where he pulls it shut from
  hide: [35.1, 0, 22.35] as Vec3, hideAim: [31.2, 1.2, 13.4] as Vec3,   // the dark south-east corner beyond the fire exit's sweep (its leaf swings in, north of him) — eyes on the north door across the room
  creep: [[34.5, 0, 17.4], [33.7, 0, 15.3]] as Vec3[],   // up past the fridge along the counter's edge and round to the west of the man at the machine (his back)
  dragTo: [34.3, 0, 18.1] as Vec3,                        // backing off south along the counter with him by the ankles: into the fridge's shadow, out of the machines' light
  toNorthDoor: [[33.6, 0, 17.2], [31.4, 0, 13.6], [30.72, 0, 12.95]] as Vec3[],   // round the table's corner to the north door's push side
  ocpSpot: [30.72, 0, 12.55] as Vec3,                     // in the doorway he has just eased open, under the corridor camera's fixture
  corridorWest: [[30.3, 0, 11.3], [27.6, 0, 11.2], [24.6, 0, 11.2], [23.1, 0, 11.7], [22.72, 0, 12.5]] as Vec3[],   // down the middle of the corridor in the pool that has just died (between the manager's leaf standing ajar and the bench opposite), then across into the cubicles' east doorway
  cubHide: [23.85, 0, 12.85] as Vec3, cubAim: [17.0, 1.1, 13.35] as Vec3,   // tucked against the corridor wall a step east of that doorway, eyes down the north aisle
  smokeAt: [20.7, 0.05, 13.35] as Vec3,                   // the canister lands short of the centre aisle's mouth and rolls into it
  cubOut: [[22.85, 0, 12.6], [22.72, 0, 11.35], [24.4, 0, 10.75], [25.72, 0, 10.75]] as Vec3[],   // back out through the doorway three metres from the man staring at the plume, across the corridor to the manager's door
  intoOffice: [[25.72, 0, 9.1], [23.4, 0, 8.7], [22.72, 0, 8.68]] as Vec3[],   // through the manager's door (it stands ajar) and over to the side door's keypad
  padAim: [22.05, 1.15, 9.36] as Vec3,
  intoServer: [[21.1, 0, 8.62], [19.9, 0, 8.3], [19.58, 0, 7.86]] as Vec3[],   // through the side door as it swings, along the rack fronts to the marked rack, planted at its face
  backToSide: [[20.9, 0, 8.55], [21.35, 0, 8.6]] as Vec3[],   // back to the side door's room face (a thumb-turn this side)
  officeWait: [24.2, 0, 9.15] as Vec3, officeAim: [26.2, 1.2, 10.6] as Vec3,   // behind the office wall west of its doorway while the torch goes past outside
  toStorage: [[25.72, 0, 9.5], [25.72, 0, 10.75], [31.6, 0, 10.7], [32.45, 0, 10.72]] as Vec3[],   // out, and east along the corridor's north wall to the storage door's keyed face
  breakerSpot: [30.55, 0, 10.5] as Vec3,                  // hugging the north wall two strides west of that doorway: the middle of the one band of floor with a line through it onto the breaker panel (walked at head heights 1.0‥1.6, tools/qa)
  toBreakN: [[30.66, 0, 11.5]] as Vec3[],                 // across to the break room's north door again (its closer has long shut it)
  throughBreak: [[30.72, 0, 13.3], [33.2, 0, 17.3], [35.05, 0, 20.72]] as Vec3[],   // through the dark break room to the fire exit's push side
  outside: [37.5, 0, 20.85] as Vec3, outsideAim: [34.5, 1.2, 20.6] as Vec3,
  // ---- the men's marks
  kowPark: [34.0, 0, 11.25] as Vec3,                      // the corridor's east end: his route's own dwell (he stands here 0:28‥0:31 every night)
  kowIn: [[31.35, 0, 11.5], [30.62, 0, 12.95], [32.4, 0, 13.7], [34.55, 0, 14.4]] as Vec3[], kowFace: Math.PI / 2,   // in through the north door and over to the counter, facing the machine
  reyesPark: [6.95, 0, 17.9] as Vec3, reyesParkFace: 1.7, // the lobby's west seating: his route's own dwell at 0:58
  reyesEast: [[9.5, 0, 17.35], [10.55, 0, 13.6], [14.2, 0, 11.35], [29.6, 0, 11.32]] as Vec3[],   // under the arch and the length of the corridor eastward, torch up
  reyesStore: [[32.58, 0, 10.7], [32.62, 0, 9.0], [33.8, 0, 6.9]] as Vec3[], reyesStoreFace: -Math.PI / 2,   // into the storage room on his key (its closer shuts it locked behind him) — checking the shelves
  novakPark: [13.55, 0, 13.3] as Vec3, novakFace: Math.PI / 2,   // the cubicles' north-west corner: his route's own dwell at 1:33
  novakEast: [19.45, 0, 13.35] as Vec3, novakWhatX: 16.6, novakStop: [18.55, 0, 13.35] as Vec3,   // his own next leg east along the north aisle; where the light of it stops him; where he ends up, a stride short of the plume
  reyesDark: [16.2, 0, 11.3] as Vec3, reyesDarkFace: -Math.PI / 2,   // once the rack is looked at: the corridor's west half, facing the beam's end — his torch the one white light left when the mains go
};
/** the clocks (show seconds): when each man is taken in hand and let go — the rest of the show keys off what Sam has actually done */
const NT = {
  stroke1: 1.6,          // the opening stroke (the storm's dice are pinned at 0: the rest of the night's strokes land on the same seconds every run)
  easeDoor: 16.5,        // Sam's hand goes to the fire exit
  kowPark: 28.3, kowGo: 29.2,   // Kowalski held at the corridor's east end the moment his route puts him there; his radio line and his walk in
  reyesPark: 58.0,       // Reyes held in the lobby (his route has him there); walked up the corridor once Sam has put the corridor light out (below)
  novakPark: 62.0,       // Novak held in the cubicles' north-west corner from here (off screen) so 'his' leg east starts on cue, not on his dice
  endVeil: 0.6,          // seconds of veil before the program ends and the start card comes back (no hand-over since 08-13)
  watchdog: 260,         // whatever happened, the floor is the visitor's by here (the spine ends ~188 s in): the watchdog beat cancels the spine and makes the hand-over itself
};
/** the words — radio and barks only (decision 2): every line here is somebody's voice */
const NL = {
  kowCoffee: 'Kowalski — two minutes, coffee.',                                             // (game/dialogue.ts NEEDS_LINES.radio's own shape)
  samAsk: 'The side door. The code.',
  kowCode: "…All right. Side door's on the pad — 7-3-9-1. Same four digits for all of us.",   // (INTEL 'code', a steady man's grudging lead; the digits ARE pad_side's — the probe holds that the pad takes what he learned)
  novakWhat: '…what is that?',
  controlRack: 'Rack 6 just went dark on my board. Nearest man — go and put eyes on it.',    // (mission.ts sendRackCheck answers it: the man sent radios his own line)
  controlDark: "Negative — stay on your loop. That's a mains trip: emergency lighting's up, it resets itself in a few seconds.",
};
/** the framings, by chapter and cue (yaw / pitch in degrees, see the note above; `look` a floor point, lookY its height). Placed against the level by eye on :5262. */
type NShot = Omit<CameraShotSpec, 'look' | 'chapter'> & { look: Vec3 | 'sam' | 'kowalski' | 'reyes' | 'novak' };
const NS: Record<string, NShot> = {
  lot:        { look: [37.0, 0, 20.2], lookY: 0.9, yaw: 110, yawTo: 104, pitch: 11, dist: 9.5, distTo: 7.2, dur: 17, title: 'east lot' },     // from the east-north-east of the lot: Sam against the wall, the door beside him, the lamp's post and its rain at the frame's edge
  doorIn:     { look: [35.2, 0, 20.5], lookY: 0.5, yaw: -68, yawTo: -74, pitch: 11, dist: 6.2, dur: 13, title: 'fire exit' },              // inside, low off the lino from the west-south-west: the wedge fans toward the lens
  breakWide:  { look: [32.4, 0, 14.6], lookY: 1.0, yaw: -8, yawTo: -14, pitch: 15, dist: 7.2, dur: 12, title: 'break room' },              // from the room's middle at the table, north onto the door and the machines: the torch comes through the haze
  hold:       { look: 'kowalski', lookY: 1.25, track: 6, yaw: -86, yawTo: -80, pitch: 12, dist: 3.9, dur: 20, title: 'the hold' },     // tight from the west: the pair turned off the counter toward the door and the machines' glow, the knife, the goggles
  drag:       { look: 'sam', lookY: 0.7, track: 4, yaw: -28, pitch: 24, dist: 6.5, dur: 12, title: 'the body' },
  corrDoor:   { look: [30.9, 0, 11.35], lookY: 0.7, yaw: 100, yawTo: 96, pitch: 25, dist: 4.5, dur: 12, title: 'corridor' },             // from up under the corridor camera at the east end, west along the corridor over the leaf easing out: Sam in the doorway, the pool dying, both beams' red lines
  corrWest:   { look: 'sam', lookY: 1.0, track: 3, yaw: 90, yawTo: 87, pitch: 15, dist: 4.3, dur: 12, title: 'the crossing' },           // over Sam's shoulder from the east as he goes west in the dark: the laser's line and a torch far down
  cubAisle:   { look: [21.2, 0, 13.35], lookY: 0.9, yaw: 96, yawTo: 90, pitch: 17, dist: 4.4, dur: 12, title: 'cubicles' },                 // down the north aisle from the east: Sam near, the plume, the torch coming
  cubCross:   { look: [21.6, 0, 12.9], lookY: 0.9, yaw: 58, pitch: 33, dist: 6.6, dur: 10, title: 'three metres' },                        // higher from the north-east: the man, the plume, Sam going behind it for the doorway
  officePad:  { look: [22.7, 0, 8.6], lookY: 1.15, yaw: 96, yawTo: 91, pitch: 13, dist: 3.4, dur: 12, title: 'server room' },              // from inside the manager's office west onto the pad and the side door — south of the tip of the office's own door, which Sam has just walked open into the room
  serverRack: { look: [19.7, 0, 7.5], lookY: 0.95, yaw: 42, yawTo: 34, pitch: 16, dist: 3.5, dur: 16, title: 'the drive' },               // inside the server room from the south-east corner, along the rack fronts
  corrTorch:  { look: 'reyes', lookY: 1.05, track: 5, yaw: -90, pitch: 14, dist: 6.5, dur: 14, title: 'the torch' },                    // ahead of Reyes looking back east at him coming up the corridor
  storeDoor:  { look: [32.1, 0, 10.5], lookY: 0.9, yaw: 72, yawTo: 66, pitch: 12, dist: 4.6, dur: 14, title: 'going dark' },              // low from the west-south-west onto the storage door: the pick under the beam, the corridor away to the west with the torch at its end
  blackout:   { look: [30.4, 0, 11.15], lookY: 1.0, yaw: 84, yawTo: 79, pitch: 14, dist: 5.4, dur: 12, title: 'blackout' },               // from the corridor's east end westward: the beacon over the lens, the beam, the exit sign far down, two seconds of the tube
  breakDark:  { look: [33.0, 0, 16.8], lookY: 0.9, yaw: -40, yawTo: -46, pitch: 22, dist: 6.0, dur: 14, title: 'the restrike' },          // from the break room's south-west corner: Sam under the sweeping beacon for the fire exit
  lotOut:     { look: [36.6, 0, 20.5], lookY: 0.9, yaw: 108, yawTo: 100, pitch: 11, dist: 7.8, distTo: 9.4, dur: 16, title: 'east lot' }, // outside again from the east-north-east, pulling out: the leaf swinging to, the room behind it, the lamp's rain
};
for (const k of Object.keys(NS)) NS[k] = frameShot(NS[k]);   // gameplay framing (FRAMING above)
// ---- beat helpers (generators composed with yield*: a beat is a generator, and so is a stretch of one)
type NGen = Generator<Cond, void, CondResult>;
const flat2 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** hold until show second `t` (a cue that has passed continues at once) */
function* at(c: BeatCtx, t: number): NGen { if (c.query.t < t) yield c.until(q => q.t >= t, `t≥${t}`); }
/** walk Sam through `pts` in order — straight at each, on to the next inside `within` of it — looking at `aim` (default: ahead along the leg at chest height), crouched or not, at `walk` × his pace */
function* walk(c: BeatCtx, pts: Vec3[], o: { crouch?: boolean; walk?: number; aim?: Vec3 | null; within?: number; fixtures?: boolean; cap?: number } = {}): NGen {
  let from = c.view.pos;
  for (const p of pts) {
    // no aim given = eyes down the leg: a point 4 m PAST its end at chest height (aiming at the mark itself tips the gun at the ceiling as he arrives on it)
    const L = Math.hypot(p[0] - from[0], p[2] - from[2]) || 1, k = 1 + 4 / L;
    const aim = o.aim === undefined ? [from[0] + (p[0] - from[0]) * k, o.crouch === false ? 1.5 : 1.1, from[2] + (p[2] - from[2]) * k] as Vec3 : o.aim;
    c.puppet({ goal: p, aim, crouch: o.crouch ?? true, walk: o.walk, fixtures: o.fixtures });
    const t0 = c.query.t; const cap = o.cap ?? 14;
    yield c.until(() => flat2(c.view.pos, p) < (o.within ?? 0.28) || c.query.t - t0 > cap, 'walk');
    if (c.query.t - t0 > cap) c.note('walk:capped', { to: [+p[0].toFixed(2), +p[2].toFixed(2)], at: c.view.pos.map(x => +x.toFixed(2)) });   // (a mark he could not make costs a line in the log, never the show)
    from = p;
  }
  c.puppet({ goal: null, ...(o.aim !== undefined ? { aim: o.aim } : {}), crouch: o.crouch ?? true, fixtures: o.fixtures });   // (stands where he got to, eyes where they were)
}
/** tap Space on the row (kind, verb) the moment it is on offer and in reach — waiting up to `secs` for it; → whether it was tapped. The press lands next frame (director.ts injectInput). */
function* tap(c: BeatCtx, kind: Parameters<BeatCtx['select']>[0], verb: Parameters<BeatCtx['select']>[1], secs = 4, label = `${kind}:${verb}`): Generator<Cond, boolean, CondResult> {
  const t0 = c.query.t;
  for (;;) {
    if (c.select(kind, verb)) { const h = c.view.hover; if (h && h.inReach && !h.running) { c.press('Space'); c.note(`tap ${label}`); yield c.frames(2); return true; } }
    if (c.query.t - t0 > secs) { c.note(`tap:missed ${label}`, { rows: [...c.view.rows] }); return false; }
    yield c.frames(1);
  }
}
/** …until a predicate holds but never longer than `secs`: true if it came, false — and a 'late' note the probes count — if the clock ran out. A show never
 *  hangs on a system's answer: the beat carries on to the next thing it can do and the log says what did not come. */
function* untilT(c: BeatCtx, pred: (q: Query) => boolean, label: string, secs: number): Generator<Cond, boolean, CondResult> {
  const r = yield c.any(c.until(pred, label), c.wait(secs, `${label} (≤ ${secs} s)`));
  if (r.index === 0) return true;
  c.note('late', { what: label, secs, t: +c.query.t.toFixed(2) }); return false;
}

const script: LevelScriptFn = D => {
  const { yawTo } = D.util;
  // ---- handles (the manifest: every one is checked against office.json when the level loads — a miss and nothing here is armed)
  const conf = D.plan('breach');                    // level.breach: the break room by its side door — approach and stack marks, the kick, the toss, the flows, the next door, the lines
  const day = D.variant('daylight');                // level.daylight: the sun, the sky, the groups lit / out
  const park = D.mark('park', PARK);                // (LevelData has no marks[] yet: declared here with its literal — M3 moves it into office.json)
  const BLUE = D.loadout('blue', { team: 'operative', weapon: 'fn2000', tint: OP_TINT, tint2: OP_TINT2, light: false, god: true });   // (god: the loud half's net — the opposition's rounds are laid on the pair's cover and traced clear of them; a stray still cannot end the show)
  const TANGO = D.loadout('tango', { team: 'hostile', weapon: 'aks74u', tint: HOSTILE_TINT, tint2: HOSTILE_TINT2, light: false });
  D.expect.order('breach', ['start', 'go', 'approach-done', 'stacked', 'squeeze', 'kick', 'kickL', 'door-flung', 'retreat', 'toss', 'bang', 'enter1', 'enter2', 'clear', 'next', 'stack2', 'cut', 'done']);
  D.expect.within('breach', 'door-flung', 'toss', 0.2);
  D.expect.never('samHit');
  /** …and its loud half's own beats (notes of the spine and of the men's threads), in order — tools/qa/day-probes.ts holds the run to these */
  D.expect.order('breach', ['loud', 'door:kicked', 'one:corridor', 'hostiles', 'contact', 'glass', 'h1:down', 'one:shift', 'one:door', 'h2:down', 'bang', 'h4:down', 'h3:down', 'radio:clear', 'smoke', 'one:in', 'smoke2', 'out', 'exfil:cut']);
  const corrDoor = D.door('breakroom_n');            // the break room's corridor door: the restack's, and the one the loud half boots (= level.breach.next.door; the lint holds the level to it)
  const westDoor = D.door('breakroom_w');            // …and its west door onto the cubicle farm: the breach's (= level.breach.door), One's post in the loud half
  const extDoor = D.door('breakroom_ext');           // …and its south door into the lot: the way out

  // ================================================================ program 'breach' — THE DAY SHOWCASE (start card ▸ Day showcase, ?breach, __breach.start(); P stops it): the drill, then it goes loud
  D.program('breach', P => {
    P.onStart('show');

    /** The show: day in, the shift benched, Sam parked, the cast stood on the plan's marks, the drill begun and the camera programme started beside it; then wait
     *  for the drill's own 'done' (or a man of ours going down) — and from that cut on the held stack, THE LOUD HALF (loudHalf above: the door, the four, the fight,
     *  the smoke, the bounds out); then cut — the veil, and the night encounter back under it, are the showcase runtime's. Everything up to the drill's cut is
     *  what it was, frame for frame (tools/qa/fixtures/breach-beats-main.json). */
    P.beat('show', function* (c) {
      c.fade(1, 0);                                  // opens out of black (the camera beat brings it up)
      c.variant(day, true);                          // ten in the morning (logs 'daylight')
      c.shift(false);                                // the level's own men off the floor for the show's length, torches out — the cast has it to itself (Sam + 5 ≤ the capsule budget's 8)
      c.stage('sam', park);
      const B = c.query.plan(conf); const from = B.from ?? B.stack;
      const ops: [UnitRef, UnitRef] = [
        c.spawn(BLUE, from[0], { callsign: 'Blue One', yaw: yawTo(from[0], B.stack[0]) }),
        c.spawn(BLUE, from[1], { callsign: 'Blue Two', yaw: yawTo(from[1], B.stack[1]) }),
      ];
      const tangos = B.hostiles.map((h, i) => c.spawn(TANGO, h.pos, { callsign: `Tango ${i + 1}`, yaw: h.yaw }));
      c.note('cast');
      const drill = c.drill.breach(conf, ops, { hostiles: tangos });   // battle drill six: run in → stack → kick (left) → the step back → the charge in as the leaf clears → bang → the flows → clear → the next door
      c.start('camera');
      yield c.until(() => drill.since('done') > 0.05 || drill.aborted, 'drill done');   // the cut on the held stack (or straight away if a man of ours went down)
      if (!drill.aborted) yield* loudHalf(c, ops, tangos, { door: corrDoor, west: westDoor, tango: TANGO });   // IT GOES LOUD — from the held stack on the corridor door to the cut outside (a man of ours down in the room: no second act)
      c.finish();
    });
    { const LB = loudBeats({ ext: extDoor }); for (const name of ['two', 'red1', 'red2', 'red3', 'red4', 'aisleCuts'] as const) P.beat(name, LB[name]); }   // Blue Two's thread, the four's and the trading's cuts, started by the loud half's spine

    /** The camera programme: five fixed, pinned framings, each held minDur‥dur seconds and cut early on its drill cue; the first comes up out of black. (The loud half pins its own from the spine.) */
    P.beat('camera', function* (c) {
      const ops = [c.unit('Blue One'), c.unit('Blue Two')] as [UnitRef, UnitRef];   // (the show beat has hired them and begun the drill before it starts this beat)
      const drill = (): DrillRef | null => c.drillOf(conf);
      const shots = breachShots(ops); c.chapters([...shots.map(s => ({ title: s.title, dur: s.dur })), ...LOUD_CHAPTERS]);
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i]; const look = s.look, cue = s.until;
        c.camera.pin({ ...s, chapter: i, look: typeof look === 'function' ? () => look(c.query) : look });
        c.caption(s.caption, s.sub);
        if (i === 0) c.start('veil');
        yield c.any(c.wait(s.dur), c.all(c.wait(s.minDur ?? 0), c.until(() => { const d = drill(); return !!d && !!cue && cue(d); })));
      }
      yield c.until(() => false, 'held');   // the last shot holds until the show beat cuts
    });

    /** the opening: held black a moment, then up over 0.45 s — every later cut is hard, the action carries across it */
    P.beat('veil', function* (c) { yield c.wait(0.1); c.fade(0, 0.45); });
  }, { showcase: true, lowerThird: true, endVeil: 0.35, endHold: 0.5 });

  // ================================================================ program 'night' — THE NIGHT SHOWCASE (start card ▸ Night showcase, ?demo, P; P stops it) — docs/design/showcases.md
  // One continuous infiltration in eight chapters and a hand-over. Sam is the real player on Game.puppet's strings pressing his own keys (a row is tapped when it is on offer and in reach,
  // as a player taps it); the shift's three men walk their authored routes until the show takes each in hand at a spot his route has already put him (NT), so every cue finds its man; the
  // camera is pinned set-ups cut hard on what has actually happened; the only words are the radio and two barks; the lower third is the time and the place. What is scripted rather than
  // sensed: Sam is unseen by the AI throughout (the showcase runtime's flag, as the tour's beats had it — the aisle crossing is staged inside the plume's edge, not tested by Novak's eyes),
  // a man in hand perceives nothing (Kowalski at the machine, Reyes on his walk east and in the storage room, Novak from his corner on), and the exchange in the hold is written (its answer
  // teaches Sam the pad's real code through devices.ts learnCode: the code row that opens the side door a minute later is the game's own).
  const fireExit = D.door('fire_exit'), breakN = D.door('breakroom_n'), sideDoor = D.door('server_manager'), storeDoor = D.door('storage');
  const pad = D.device('pad_side');
  const gServer = D.lightGroup('server');
  D.expect.order('night', ['ch:lot', 'stroke1', 'ch:door', 'door:eased', 'inside', 'ch:breakroom', 'kow:coffee', 'kow:counter', 'grab', 'held', 'code', 'choke', 'kow:down', 'dragged', 'ch:corridor', 'ocp:panel', 'ch:cubicles', 'smoke:thrown', 'novak:what', 'crossed', 'ch:server', 'code:entered', 'drive:start', 'drive:pulled', 'reyes:sent', 'ch:dark', 'picked', 'ocp:breaker', 'blackout', 'nv:on', 'nv:off', 'mains:back', 'ch:out', 'outside', 'stroke2', 'end']);
  D.expect.never('samHit');

  D.program('night', P => {
    P.onStart('night');

    /** THE SPINE: chapter after chapter — stage, cue the men's beats, drive Sam, cut the camera on what he has done. Every c.note is a beat the probes assert on. */
    P.beat('night', function* (c) {
      const V = () => c.view;
      const kow = c.unit('Kowalski'), reyes = c.unit('Reyes'), novak = c.unit('Novak');
      if (!kow || !reyes || !novak) throw new Error('night: the shift is not Kowalski / Novak / Reyes');
      const lookOf = (s: NShot): CameraShotSpec['look'] => s.look === 'sam' ? (() => c.query.pos('sam')) : s.look === 'kowalski' ? (() => c.query.pos(kow)) : s.look === 'reyes' ? (() => c.query.pos(reyes)) : s.look === 'novak' ? (() => c.query.pos(novak)) : s.look;
      const shot = (key: keyof typeof NS & string, chapter: number) => { const s = NS[key]; c.camera.pin({ ...s, look: lookOf(s), chapter, title: s.title }); c.note(`shot:${key}`); };
      const lower = (text: string) => c.caption(text);
      c.chapters([{ title: '02:14 · east lot', dur: 17 }, { title: 'the fire exit', dur: 13 }, { title: '02:15 · break room', dur: 32 }, { title: '02:16 · corridor', dur: 22 }, { title: '02:16 · cubicles', dur: 21 }, { title: '02:17 · server room', dur: 47 }, { title: '02:18 · going dark', dur: 34 }, { title: '02:19 · out', dur: 18 }]);

      // ---------------------------------------------------------------- 0 · 02:14 · EAST LOT — the storm pinned, a stroke on cue, Sam crouched soaked by the fire exit
      c.fade(1, 0);
      c.weather({ storm: 0.7, rain: 0.55, seed: 214 });
      c.lights.group(gServer, false);   // the server room by its racks' green wash alone (as the tour's drive stop had it); the rest of the floor as authored (freshEncounter)
      c.stage('sam', NIGHT.lot, { yaw: NIGHT.lotYaw });
      c.puppet({ goal: null, aim: [36.3, 0.9, 21.2], crouch: true });
      c.note('ch:lot'); lower('02:14 · east lot'); shot('lot', 0); c.start('veil');
      c.start('kowalski'); c.start('reyes'); c.start('novak');   // the men's beats arm themselves on their own clocks and cues (below)
      yield* at(c, NT.stroke1); c.weather({ strike: { bearing: 1.75, elevDeg: 34, distKm: 1.1 } }); c.note('stroke1');
      yield* at(c, NT.easeDoor);

      // ---------------------------------------------------------------- 1 · THE FIRE EXIT — eased open a hand's width, then through: the sodium wedge fans across the lino and folds shut behind him
      c.note('ch:door'); shot('doorIn', 1);
      if (yield* tap(c, 'door', 'ease', 3)) c.note('door:eased');
      yield c.until(() => c.query.door(fireExit).angle > 0.5 || !V().easing, 'leaf ajar'); yield c.wait(0.35);
      yield* walk(c, [NIGHT.inDoor], { crouch: true, walk: 0.8, aim: [33.0, 1.0, 19.6] });   // (walking into the half-open leaf takes it the rest of the way under his hand — game.ts handsOnDoors)
      c.note('inside', { t: +c.query.t.toFixed(2) });
      yield* walk(c, [NIGHT.pullSpot], { crouch: true, walk: 0.9, aim: [36.2, 1.0, 20.5] });   // a step on, out of the leaf's inward sweep, turned back to it …
      if (yield* tap(c, 'door', 'pull', 2)) c.note('door:pulled');                              // … his hand goes to it (the row) …
      // … and it comes to behind him on the pull's own spring (doors.ts pullTo — the designer, 08-13: left to its closer 'it looks like it closes itself'; pulled from inside the sweep it stalls on his own capsule)
      yield* untilT(c, () => Math.abs(c.query.door(fireExit).angle) < 0.15, 'fire exit shut', 4);
      yield* walk(c, [NIGHT.hide], { crouch: true, walk: 0.8, aim: NIGHT.hideAim });
      c.flag.samHidden = true;
      yield* at(c, NT.kowGo);

      // ---------------------------------------------------------------- 2 · 02:15 · BREAK ROOM — Kowalski's coffee run (his torch through the doorway haze), the hold from behind, the code, the choke, the body hauled into the dark
      c.note('ch:breakroom'); lower('02:15 · break room'); shot('breakWide', 2);
      yield* untilT(c, q => !!q.flag('kowAtCounter'), 'kowalski at the machine', 30);
      yield c.wait(1.2);
      shot('hold', 2);
      // up the counter behind him — holstered (both hands for him: the arm and its quiet options), rising out of the crouch for the last stride
      yield* walk(c, [NIGHT.creep[0]], { crouch: true, walk: 0.9, aim: [34.6, 1.3, 14.4] });
      { const kp = c.query.pos(kow); yield* walk(c, [NIGHT.creep[1], [kp[0] - 0.74, 0, kp[2] + 0.02]], { crouch: true, walk: 0.75, aim: [kp[0], 1.35, kp[2]], within: 0.2 }); }
      if (yield* tap(c, 'guard', 'grab', 4)) c.note('grab');
      yield* untilT(c, () => V().holding?.phase === 'held', 'held', 4); c.note('held', { t: +c.query.t.toFixed(2) });
      c.puppet({ goal: null, aim: [32.0, 1.3, 12.5], crouch: false });   // the pair comes round off the counter to face the door he came in by — and the machines' glow (his front lit, Sam's arm and the knife reading against it). (A puppet aim must sit in FRONT of the pinned lens: the cursor is that point projected.)
      yield c.wait(1.4); c.say('sam', NL.samAsk);
      yield c.wait(2.3); c.say(kow, NL.kowCode); yield c.wait(0.5);
      if (c.learnCode(pad, kow)) c.note('code'); else c.note('code', { news: false });
      yield c.wait(3.6);
      if (yield* tap(c, 'held', 'choke', 3)) c.note('choke');
      yield* untilT(c, q => q.state(kow) === 'dead' || !V().holding, 'out cold', 8); c.note('kow:down', { t: +c.query.t.toFixed(2) });
      yield c.wait(1.0);
      shot('drag', 2);
      // the body: Space on him takes the ankles; back off south along the counter into the fridge's shadow, and let go
      { const kp = c.query.pos(kow); c.puppet({ goal: null, aim: [kp[0], 0.3, kp[2]], crouch: true }); }
      yield c.wait(0.5);
      if (yield* tap(c, 'body', 'drag', 5)) c.note('drag');
      yield* untilT(c, () => !!V().dragging, 'by the ankles', 4);
      c.puppet({ goal: NIGHT.dragTo, aim: null, crouch: true });
      yield* untilT(c, () => flat2(V().pos, NIGHT.dragTo) < 0.35 || !V().dragging, 'hauled', 12);
      if (V().dragging) { yield* tap(c, 'body', 'drop', 2); } c.note('dragged', { at: c.query.pos(kow).map(x => +x.toFixed(2)) });
      c.puppet({ goal: null, aim: NIGHT.hideAim, crouch: true }); yield c.wait(1.2);

      // ---------------------------------------------------------------- 3 · 02:16 · CORRIDOR — the north door eased, the camera's pool put out with the OCP, west along the dark side of the corridor; the laser glows further down, a torch beyond it
      c.note('ch:corridor'); lower('02:16 · corridor');
      yield* walk(c, NIGHT.toNorthDoor, { crouch: true, walk: 1.0 });
      shot('corrDoor', 3);
      if (yield* tap(c, 'door', 'ease', 3)) c.note('door2:ease');
      yield c.until(() => Math.abs(c.query.door(breakN).angle) > 1.3 || !V().easing, 'north door open'); c.note('door2:eased', { angle: +c.query.door(breakN).angle.toFixed(2) });
      c.press('Digit1');   // the Five-seveN into the hand: the OCP is the pistol's
      yield* walk(c, [NIGHT.ocpSpot], { crouch: true, walk: 0.7, aim: [32.0, 2.98, 11.1], fixtures: true, within: 0.22 });
      yield* untilT(c, () => V().aimTarget === 'panel_corridor_20' && !V().holstered, 'reticle on the fixture', 4); yield c.wait(0.6);
      c.click(2); yield c.frames(3);
      c.note('ocp:panel', { t: +c.query.t.toFixed(2), fired: V().ocp < 0.5 });   // (the charge reads empty the frame after a burst; night-probes reads the pool itself off the fixture's supply)
      c.signal('corridorDark');   // Reyes's cue: his torch starts up the corridor from the lobby end
      yield c.wait(0.8);
      c.start('corrWestCut');   // (the westward over-the-shoulder cuts in once he is past the leaf he eased into the corridor — from behind it the lens would sit on wood)
      yield* walk(c, NIGHT.corridorWest, { crouch: true, walk: 1.0, aim: [14.5, 0.5, 11.1] });   // eyes on the beam's red line down the corridor as he goes
      yield* walk(c, [NIGHT.cubHide], { crouch: true, walk: 0.9, aim: NIGHT.cubAim });
      c.flag.samInCubicles = true; c.note('crossed:corridor', { t: +c.query.t.toFixed(2), reyesX: +c.query.pos(reyes)[0].toFixed(1) });

      // ---------------------------------------------------------------- 4 · 02:16 · CUBICLES — the canister rolled to the aisle mouth, the plume up through Novak's beam, his walk toward it, Sam out behind it three metres from him
      c.note('ch:cubicles'); lower('02:16 · cubicles'); shot('cubAisle', 4);
      c.signal('novakGo');
      c.press('Digit3'); c.puppet({ goal: null, aim: NIGHT.smokeAt, throwAt: NIGHT.smokeAt, crouch: true });
      yield c.wait(1.1); c.click(0); c.note('smoke:thrown', { t: +c.query.t.toFixed(2) });
      yield c.wait(1.0); c.press('Digit1'); c.puppet({ goal: null, aim: NIGHT.cubAim, crouch: true });
      yield* untilT(c, q => !!q.flag('novakStopped'), 'novak stops', 25);
      yield* untilT(c, q => q.pos(reyes)[0] > 25.3 || !!q.flag('reyesEastEnd'), 'the torch past the doorway', 30);   // Reyes's light sweeps past the opening on its way east; Sam goes out behind it, never into it
      yield c.wait(0.8);
      shot('cubCross', 4);
      yield c.wait(0.6);
      yield* walk(c, NIGHT.cubOut.slice(0, 2), { crouch: true, walk: 0.85, aim: [17.8, 1.2, 13.35] });   // eyes on him the whole way past the doorway
      c.note('crossed', { t: +c.query.t.toFixed(2), novak: c.query.pos(novak).map(x => +x.toFixed(2)), gap: +flat2(c.query.pos(novak), c.query.pos('sam')).toFixed(2) });
      yield* walk(c, NIGHT.cubOut.slice(2), { crouch: true, walk: 1.0 });

      // ---------------------------------------------------------------- 5 · 02:17 · SERVER ROOM — the keypad takes the code, the racks' green wash, hands on the marked rack until its LEDs die, Control sends the nearest man
      c.note('ch:server'); lower('02:17 · server room');
      c.mission(true);   // the mission thread live under the puppet: the room announces itself, the rack's row is offered, the pull runs, the errand fires
      c.press('KeyL');   // the rail light under the Five-seveN: the office ahead is unlit, and the light on the gun means the gun on the pad
      yield* walk(c, NIGHT.intoOffice.slice(0, 1), { crouch: true, walk: 0.9 });
      shot('officePad', 5);
      yield* walk(c, NIGHT.intoOffice.slice(1), { crouch: true, walk: 0.9, aim: NIGHT.padAim });
      c.puppet({ goal: null, aim: NIGHT.padAim, crouch: false });
      if (yield* tap(c, 'door', 'code', 4)) c.note('code:start');
      yield* untilT(c, () => !c.query.door(sideDoor).latched || (!V().coding && c.query.t > 0 && V().hover?.verb !== 'code'), 'pad accepts', 8); c.note('code:entered', { open: !c.query.door(sideDoor).latched, t: +c.query.t.toFixed(2) });
      yield c.wait(0.9);
      yield* walk(c, NIGHT.intoServer.slice(0, 2), { crouch: true, walk: 0.9 });
      shot('serverRack', 5);
      yield* walk(c, NIGHT.intoServer.slice(2), { crouch: true, walk: 0.8, aim: [19.55, 1.1, 7.13], within: 0.2 });
      c.puppet({ goal: null, aim: [19.55, 1.1, 7.13], crouch: true });
      if (yield* tap(c, 'objective', 'drive', 5)) c.note('drive:start', { t: +c.query.t.toFixed(2) });
      yield* untilT(c, () => V().pulled || (V().driveT < 0 && c.query.t > 0 && !V().rows.some(r => r.startsWith('objective'))), 'drive out', 10);
      c.note('drive:pulled', { t: +c.query.t.toFixed(2), pulled: V().pulled });
      const tPulled = c.query.t;
      yield c.wait(1.0); c.press('KeyL');   // the light off again: from here he waits in the dark for a torch to go by
      yield c.wait(0.5);
      yield* walk(c, NIGHT.backToSide, { crouch: true, walk: 1.0, aim: [22.6, 1.1, 8.6] });
      if (!(yield* tap(c, 'door', 'push', 2.5))) yield* tap(c, 'door', 'ease', 1.5);   // the room side is a thumb-turn: it swings back into the office off his hand
      yield* untilT(c, () => Math.abs(c.query.door(sideDoor).angle) > 0.9, 'side door open', 5); yield c.wait(0.3);
      yield* walk(c, [[22.75, 0, 8.65], NIGHT.officeWait], { crouch: true, walk: 1.0, aim: NIGHT.officeAim });
      c.signal('reyesFree');   // Reyes let go of in the storage room: the errand that is about to fire finds him calm and free (Novak, in hand, it passes over)
      yield* at(c, tPulled + 5.2); c.control(NL.controlRack); c.note('control:rack');
      yield c.until(q => q.state(reyes) === 'suspicious' || q.t > tPulled + 12, 'reyes sent'); c.note('reyes:sent', { state: c.query.state(reyes), t: +c.query.t.toFixed(2) });
      c.mission(false);   // (the thread has done its work; left live, walking out through the fire exit would end the 'run' and raise its card)
      yield c.wait(2.0);
      shot('corrTorch', 5);
      yield c.until(q => q.pos(reyes)[0] < 21.5 || q.t > tPulled + 30, 'torch past the office');   // his torch up the corridor and past the office door; he lets himself into the server room on his key
      yield c.wait(2.2);

      // ---------------------------------------------------------------- 6 · 02:18 · GOING DARK — the storage lock picked, the leaf eased, the breaker put out through the doorway: mains down floor-wide, beacons, two seconds of the tube, out along the wall
      c.note('ch:dark'); lower('02:18 · going dark'); c.flag.chDark = true;   // (Reyes's cue to walk the corridor's west half: his torch the one white light left)
      yield* walk(c, NIGHT.toStorage.slice(0, 2), { crouch: true, walk: 1.0 });
      shot('storeDoor', 6);
      yield* walk(c, NIGHT.toStorage.slice(2), { crouch: true, walk: 1.0, aim: [32.6, 1.0, 10.0] });
      c.puppet({ goal: null, aim: [32.6, 1.0, 10.0], crouch: true }); yield c.frames(2);
      c.puppet(null);   // the pick is worked with the strings OFF (player.ts updatePicking breaks off under Game.puppet: a scripted walk must never drag him off the keyway) — the cursor stays where it was put
      if (yield* tap(c, 'door', 'pick', 4)) c.note('pick:start', { t: +c.query.t.toFixed(2) });
      { const t0 = c.query.t; yield c.until(() => !c.query.door(storeDoor).locked || c.query.t - t0 > 9, 'picked'); }
      c.note('picked', { locked: c.query.door(storeDoor).locked, t: +c.query.t.toFixed(2) });
      c.puppet({ goal: null, aim: [32.6, 1.0, 10.0], crouch: true }); yield c.wait(0.4);
      if (yield* tap(c, 'door', 'ease', 3)) c.note('door3:ease');
      yield c.until(() => Math.abs(c.query.door(storeDoor).angle) > 1.38 || (!V().easing && c.query.t > 0), 'storage door eased'); c.note('door3:eased', { angle: +c.query.door(storeDoor).angle.toFixed(2) });
      yield* walk(c, [NIGHT.breakerSpot], { crouch: true, walk: 1.0, aim: [34.3, 1.35, 9.8], fixtures: true, within: 0.15 });   // (briskly: the leaf's closer wakes three seconds and a half after his hand came off it)
      c.puppet({ goal: null, aim: [34.3, 1.35, 9.8], crouch: true, fixtures: true });
      { const t0 = c.query.t; yield c.until(() => (V().aimTarget === 'breaker' && V().ocp > 0.99) || c.query.t - t0 > 1.5, 'reticle on the breaker'); }
      yield c.wait(0.25);
      c.click(2); c.note('ocp:breaker', { t: +c.query.t.toFixed(2), on: V().aimTarget, door: +c.query.door(storeDoor).angle.toFixed(2) });
      yield c.frames(2);
      shot('blackout', 6);
      { const t0 = c.query.t; yield c.until(q => !q.mainsOn || q.t - t0 > 1.2, 'mains drop'); }
      { const ok = !c.query.mainsOn; c.note('blackout', { ok, t: +c.query.t.toFixed(2) }); if (!ok) { c.lights.mains(false); c.note('blackout:byHand'); } }   // (net: the line onto the panel failed — the show goes dark all the same, and says so in its log)
      const tDark = c.query.t;
      c.puppet({ goal: null, aim: [30.6, 1.0, 12.4], crouch: true, fixtures: false });
      yield c.wait(1.8); c.press('KeyN'); c.note('nv:on', { t: +c.query.t.toFixed(2) });   // two seconds of the tube as he goes (decision 3)
      yield c.wait(0.4);
      yield* walk(c, NIGHT.toBreakN, { crouch: true, walk: 0.9, aim: [30.6, 1.0, 12.4] });
      yield* at(c, tDark + 3.8); c.press('KeyN'); c.note('nv:off', { t: +c.query.t.toFixed(2) });
      yield* at(c, tDark + 4.6); c.control(NL.controlDark);   // (control answering the man the trip sent to the breaker — lighting.ts setBlackout radios the nearest calm one)
      if (!(yield* tap(c, 'door', 'push', 3))) yield* tap(c, 'door', 'ease', 2);
      yield* untilT(c, () => Math.abs(c.query.door(breakN).angle) > 0.9, 'north door open again', 5);
      shot('breakDark', 6);
      yield* walk(c, NIGHT.throughBreak.slice(0, 2), { crouch: true, walk: 1.0 });
      yield* at(c, tDark + 11.0); c.lights.mains(true); c.note('mains:back', { t: +c.query.t.toFixed(2) });   // the trip resets: the contactor groups restrike one after another behind him — the break room's machines last, as he reaches the door
      yield* walk(c, NIGHT.throughBreak.slice(2), { crouch: true, walk: 1.0, aim: [36.2, 1.0, 20.7] });
      if (!(yield* tap(c, 'door', 'push', 3))) yield* tap(c, 'door', 'ease', 2);
      yield* untilT(c, () => Math.abs(c.query.door(fireExit).angle) > 0.8, 'fire exit open', 5);

      // ---------------------------------------------------------------- 7 · 02:19 · OUT — through the fire exit into the rain, the door closing on the wedge, a far stroke
      c.note('ch:out'); lower('02:19 · east lot'); shot('lotOut', 7);
      yield* walk(c, [NIGHT.outside], { crouch: true, walk: 1.0, aim: [40, 1.0, 21] });
      c.puppet({ goal: null, aim: NIGHT.outsideAim, crouch: true }); c.press('KeyE'); c.note('outside', { t: +c.query.t.toFixed(2) });   // (holstered: it is over)
      yield c.wait(3.0); c.weather({ strike: { bearing: -2.3, elevDeg: 22, distKm: 3.4 } }); c.note('stroke2');
      yield c.wait(7.5);

      // ---------------------------------------------------------------- THE END — no hand-over (the designer, 08-13: both showcases simply return to the start card): a veil, and the
      // Director's showcase finish puts the night back bit for bit; main.ts opens the start card on the program's end
      c.flag.ended = true; c.note('end', { t: +c.query.t.toFixed(2) });
      c.fade(1, NT.endVeil); yield c.wait(NT.endVeil + 0.1);
      c.finish();
    });

    /** WATCHDOG — whatever a system does or does not answer, the start card is back inside NT.watchdog seconds: the spine cancelled, a veil, the end. */
    P.after(NT.watchdog, 'watchdog');
    P.beat('watchdog', function* (c) {
      if (c.query.flag('ended')) return;
      c.note('watchdog', { t: +c.query.t.toFixed(2) }); c.cancel('night');
      c.fade(1, NT.endVeil); yield c.wait(NT.endVeil + 0.1); c.finish();
    });

    /** the corridor's second set-up, on Sam's progress: past x 26.2 the eased north leaf is behind the lens */
    P.beat('corrWestCut', function* (c) { if (!(yield* untilT(c, q => q.pos('sam')[0] < 25.3, 'past the leaf', 20))) return; const s = NS.corrWest; c.camera.pin({ ...s, look: () => c.query.pos('sam'), chapter: 3, title: s.title }); c.note('shot:corrWest'); });

    /** KOWALSKI — held at the corridor's east end the moment his route stands him there, then on cue: the radio line, in through the north door with his torch up, over to the machine. In Sam's
     *  arm the game takes him off this script itself (player.ts startGrab); the beat only reports him at the counter. */
    P.beat('kowalski', function* (c) {
      const kow = c.unit('Kowalski')!;
      yield* at(c, NT.kowPark);
      c.order(kow, { goal: null, face: Math.PI / 2, upper: 'none', light: true, stance: 'none', speed: 0 });
      yield* at(c, NT.kowGo); yield c.until(q => !!q.flag('samHidden') || q.t > NT.kowGo + 20, 'sam hidden');
      c.say(kow, NL.kowCoffee, { radio: true }); c.note('kow:coffee', { t: +c.query.t.toFixed(2), from: c.query.pos(kow).map(x => +x.toFixed(2)) });
      yield c.wait(1.4);
      for (let i = 0; i < NIGHT.kowIn.length; i++) {
        const last = i === NIGHT.kowIn.length - 1;
        c.order(kow, { goal: NIGHT.kowIn[i], speed: 1.15, upper: 'none', light: true, stance: 'none', face: last ? NIGHT.kowFace : null });
        const t0 = c.query.t;
        yield c.until(q => q.arrived(kow) || flat2(q.pos(kow), NIGHT.kowIn[i]) < (last ? 0.25 : 0.6) || q.t - t0 > 12, 'kowalski walks');
        if (i === 1) c.note('kow:in', { t: +c.query.t.toFixed(2) });
      }
      c.flag.kowAtCounter = true; c.note('kow:counter', { t: +c.query.t.toFixed(2), at: c.query.pos(kow).map(x => +x.toFixed(2)) });
    });

    /** REYES — his route empties the break room by 0:19 and has him in the lobby's west seating at 0:58: held there; on the corridor going dark, walked under the arch and the length of the
     *  corridor eastward with his torch (the light Sam sees coming), and into the storage room on his key, where he stays in hand — blind — until the drive is out; let go then, he is the
     *  calm free man the rack errand finds (mission.ts sendRackCheck), and everything after is his own: the radio line, the walk to the rack, the torch in the dark. */
    P.beat('reyes', function* (c) {
      const reyes = c.unit('Reyes')!;
      yield* at(c, NT.reyesPark);
      c.order(reyes, { goal: null, face: NIGHT.reyesParkFace, upper: 'none', light: true, stance: 'none', speed: 0 }); c.note('reyes:parked', { at: c.query.pos(reyes).map(x => +x.toFixed(2)) });
      yield c.on('signal', 'corridorDark');
      for (let i = 0; i < NIGHT.reyesEast.length; i++) {
        c.order(reyes, { goal: NIGHT.reyesEast[i], speed: 1.15, upper: 'none', light: true, stance: 'none', face: null });
        const t0 = c.query.t; yield c.until(q => q.arrived(reyes) || flat2(q.pos(reyes), NIGHT.reyesEast[i]) < 0.6 || q.t - t0 > 22, 'reyes east');
        if (i === 2) { c.note('reyes:corridor', { t: +c.query.t.toFixed(2) }); if (!c.query.flag('samInCubicles')) { c.order(reyes, { goal: null, face: Math.PI / 2, upper: 'none', light: true, stance: 'none', speed: 0 }); yield c.until(q => !!q.flag('samInCubicles') || q.t - t0 > 12, 'sam in the cubicles'); } }   // (belt and braces: his walk east past the doorway waits for Sam to be inside it — on time, it never waits)
      }
      c.flag.reyesEastEnd = true; c.note('reyes:eastEnd', { t: +c.query.t.toFixed(2) });
      for (let i = 0; i < NIGHT.reyesStore.length; i++) {
        const last = i === NIGHT.reyesStore.length - 1;
        c.order(reyes, { goal: NIGHT.reyesStore[i], speed: 1.0, upper: 'none', light: true, stance: 'none', face: last ? NIGHT.reyesStoreFace : null });
        const t0 = c.query.t; yield c.until(q => q.arrived(reyes) || flat2(q.pos(reyes), NIGHT.reyesStore[i]) < (last ? 0.3 : 0.55) || q.t - t0 > 12, 'reyes into storage');
      }
      c.note('reyes:storage', { t: +c.query.t.toFixed(2), at: c.query.pos(reyes).map(x => +x.toFixed(2)), latched: c.query.door(storeDoor).latched });
      yield c.on('signal', 'reyesFree');
      c.release(reyes, 'patrol'); c.note('reyes:released', { t: +c.query.t.toFixed(2) });   // free and calm in the storage room: the rack errand about to fire is his (mission.ts sendRackCheck) — the radio line, the walk, the look round the rack are the game's
      yield* untilT(c, q => !!q.flag('chDark'), 'going dark', 150);
      c.order(reyes, { goal: NIGHT.reyesDark, speed: 1.15, upper: 'none', light: true, stance: 'none', face: NIGHT.reyesDarkFace }); c.note('reyes:west', { t: +c.query.t.toFixed(2), from: c.query.pos(reyes).map(x => +x.toFixed(2)) });
    });

    /** NOVAK — walks his own loop until 1:02, then held in the cubicles' north-west corner (his route's own dwell there) so the leg east along the north aisle starts on the show's cue, not his
     *  dice: on it he walks into the plume's light with his torch, stops — '…what is that?' — and goes a stride nearer at a creep, where he stays, staring, in hand to the end. */
    P.beat('novak', function* (c) {
      const novak = c.unit('Novak')!;
      yield* at(c, NT.novakPark);
      c.order(novak, { goal: NIGHT.novakPark, speed: 1.15, upper: 'none', light: true, stance: 'none', face: NIGHT.novakFace });
      yield c.on('signal', 'novakGo'); c.note('novak:go', { t: +c.query.t.toFixed(2), from: c.query.pos(novak).map(x => +x.toFixed(2)) });
      c.order(novak, { goal: NIGHT.novakEast, speed: 1.15, upper: 'none', light: true, stance: 'none', face: null });
      yield* untilT(c, q => q.pos(novak)[0] > NIGHT.novakWhatX || q.arrived(novak), 'into the light of it', 20);
      c.order(novak, { goal: null, face: Math.PI / 2, upper: 'none', light: true, stance: 'none', speed: 0 });
      yield c.wait(0.5); c.say(novak, NL.novakWhat); c.note('novak:what', { t: +c.query.t.toFixed(2), at: c.query.pos(novak).map(x => +x.toFixed(2)) });
      c.flag.novakStopped = true;
      yield c.wait(1.6);
      c.order(novak, { goal: NIGHT.novakStop, speed: 0.5, upper: 'none', light: true, stance: 'none', face: Math.PI / 2 });
      yield* untilT(c, q => q.arrived(novak), 'a stride nearer', 20); c.note('novak:stopped', { at: c.query.pos(novak).map(x => +x.toFixed(2)) });
    });

    /** the opening: held black a moment, then up — every later cut is hard */
    P.beat('veil', function* (c) { yield c.wait(0.15); c.fade(0, 0.6); });
  }, { showcase: true, lowerThird: true, endVeil: 0.35, endHold: 0.4, freshEncounter: true });
};

export default script;
