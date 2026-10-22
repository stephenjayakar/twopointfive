// THE SCENARIO LIST: the curated scenarios the mission list offers (ui/missions.ts renders one row per entry; main.ts boots the one the URL names) and the pure
// helpers between a row and the page's query string. A scenario with a level of its own is ONE NEW ROW here — `level` names its file under levels/, whose own
// `scenarios` block carries the marks (scene/scenarios.ts LevelScenarios) — and no picker code.
//
// PICKING IS A PAGE LOAD. A row's href is scenarioQuery(entry) with the visitor's other flags kept (pickSearch): the page boots on the entry's level and
// game/scenarioRun.ts starts it from the query — the one code path for a click and for a pasted URL. So a level is only ever loaded at boot, and the scenarios'
// module-level team-start knobs (NIGHTBREACH.samAt, RESCUE.opsAt — written once per team start) never meet two levels in one page.
// Types and pure functions: nothing here imports the game (but game/loadout.ts — itself types and pure functions, importing nothing at run time: keep it so) or
// touches the DOM.
import { scenarioQuery, type ScenarioEntry } from './scenarios';
import { squadOfQuery, sizeWords, sizeTag, type SquadSize } from '../game/loadout';   // (pure: the loadout's size, its words and its query key — nothing of the game)

// THE LIST'S GROUPS (scenarios.ts MISSION_GROUPS, ui/missions.ts groupOf): a row may name its own; without one a quiet mission is 'quiet alone' / 'quiet as
// two' by its team, a rescue is 'on the clock' and any other squad's mission a 'raid'. A training level is a row with `group: 'training'` in
// TRAINING_MISSIONS below. (A comment over a row below that says group 'ideas' or 'more' is of the groups before 10-11: the row's own field is the fact.)
export const SCENARIOS: ScenarioEntry[] = [
  // the office (the bundled level). The night breach stays here: it was built and tuned on this floor and its idea is picking your entry. The other three are
  // the office versions of what the levels below were made for, kept beside them
  { id: 'night-breach', title: 'Night breach', kind: 'nightbreach', squad: 2, group: 'raids',
    place: 'The office · the break room', lean: 'either', defenders: 3,
    blurb: 'Three men hold the break room and it has four doors. Stack the pair on one and give the word, or send them in while you come by another.' },
  { id: 'room-clear-pair', title: 'Room clear', kind: 'roomclear', squad: 2,
    place: 'The office · the east wing, room by room', lean: 'loud', defenders: 5,
    blurb: 'Four held rooms in the office, taken one at a time with the order menu and the door tools. The careful game.' },
  { id: 'room-clear-four', title: 'Room clear, four-man squad', kind: 'roomclear', squad: 4, untuned: true, offList: true,
    place: 'The office · the east wing, two pairs', lean: 'loud', defenders: 5,
    blurb: 'The same four rooms with a red pair and a blue pair: two doors at once, one pair covering the other.' },
  { id: 'hostage-rescue', title: 'Hostage rescue', kind: 'rescue', squad: 2,
    place: "The office · the manager's office", lean: 'loud', defenders: 3,
    blurb: 'Two hostages and a captor on a clock. Flow down the corridor, clear only what you must, get in before it runs out.' },
  // a level per scenario (levels/<name>.json, the levels goal's — each row is all it took): the pair's room clear, the four's, the rescue
  { id: 'records-pair', title: 'The records office', kind: 'roomclear', squad: 2, level: 'records.json', ways: ['the south lot', 'the dark west side'], untuned: true, group: 'raids',
    place: 'Three small rooms and a strong room, a dark lot outside', lean: 'loud', defenders: 5,
    blurb: 'The door is the decision. Three rooms offer two doors or three; the strong room has one, locked, off a room you must take first.' },
  { id: 'depot-four', title: 'The depot', kind: 'roomclear', squad: 4, level: 'depot.json', ways: ['the main gate', 'the back gate'], untuned: true,
    place: 'A motor pool at night: three huts round a floodlit yard', lean: 'loud', defenders: 5,
    blurb: 'The yard is floodlit and held from two dark openings: slits in the comms room, a hatch in the store. The mains are behind the comms room.' },
  { id: 'block-four', title: 'The block', kind: 'roomclear', squad: 4, level: 'block.json', ways: ['the loading hall, on the main hall', 'the loading hall, on the tool crib'], untuned: true, group: 'strongholds',
    place: 'Four rooms off one hall, a turn in each', lean: 'loud', defenders: 8, squads: true,
    blurb: 'Every held room turns a corner: a lit leg at the door, its men in the dark past the turn. A second door opens off the small room beside it.' },
  { id: 'block-squads', title: 'The block, three squads', kind: 'roomclear', squad: 4, level: 'block-squads.json', ways: ['the loading hall, on the main hall', 'the loading hall, on the tool crib'], untuned: true, offList: true, group: 'strongholds',
    place: 'The block again, held by three squads', lean: 'loud', defenders: 11, squads: true,
    blurb: 'Five on eleven: the block held by three squads, each in its own rooms. Hit one and listen to what the others do.' },
  { id: 'warehouse-four', title: 'The warehouse', kind: 'roomclear', squad: 4, level: 'warehouse.json', ways: ['the south-west corner', 'the south-east corner'], untuned: true, group: 'strongholds',
    place: 'A racked hall, a loading dock, a ring of small rooms', lean: 'loud', defenders: 11, squads: true,
    blurb: 'Eleven hold a building that is a ring: whichever door you fight at, someone can walk round to your back.' },
  { id: 'compound-four', title: 'The compound', kind: 'roomclear', squad: 4, level: 'compound.json', ways: ['the side yard gate', 'the back gate'], untuned: true, group: 'strongholds',
    place: 'A walled yard, a house of eight rooms, three outbuildings', lean: 'loud', defenders: 11, squads: true,
    blurb: 'Eleven behind a wall. Three gates, two dark. Two open windows on the dark sides. The breaker is in the pantry nobody holds.' },
  { id: 'barracks-four', title: 'The barracks', kind: 'roomclear', squad: 4, level: 'barracks.json', ways: ['the south-east corner', 'the galley back door'], untuned: true, group: 'strongholds',
    place: 'Two wings and a mess hall round an open yard', lean: 'loud', defenders: 11, squads: true,
    blurb: 'Eleven round an open yard. Each gallery looks across at the other. Six rooms stand empty. The breaker is in the duty office.' },
  { id: 'rescue-registry', title: 'The registry', kind: 'rescue', squad: 2, level: 'registry.json', untuned: true,
    place: 'A lit gallery to the hostage room, a dark way round', lean: 'loud', defenders: 3,
    blurb: 'The clock decides what you skip: a lit gallery past two rooms to the hostages, and a gunman waits in one of the two rooms. Read the glass.' },
  { id: 'rescue-consulate', title: 'The consulate', kind: 'rescue', squad: 4, level: 'consulate.json', untuned: true, group: 'clock',
    place: 'A corridor past four rooms to an office in two halves', lean: 'loud', defenders: 6,
    blurb: 'Three hostages, two doors, one word. Four rooms on the way and no time to clear them: cover what you pass, a pair on each door.' },
  // NEW IDEAS: small missions, each built on one idea (group 'ideas'), each on a level made for it. The group is drawn in this table's order: the order to play them in
  // ---- new ideas, one a mission (group 'ideas'): a room clear with one overlay module keyed on a block of the level file
  { id: 'snatch-four', title: 'The snatch', kind: 'roomclear', squad: 4, level: 'snatch.json', group: 'clock', untuned: true,
    place: 'A small walled house, four rooms, a hut on the back gate', lean: 'loud', defenders: 8,
    blurb: 'One unarmed man to take alive and walk out to your van. The first shot, or the sight of you, sends him running for the back gate. Through it he is gone.' },   // (the van: how a snatch ends since game/snatchout.ts; with that switch off the house taken is still the end and the van only stands there)
  // ONE IDEA (group 'ideas'): two timed charges on one clock (game/defuse.ts, the level's scenarios.defuse block), a wing apart, each workshop with a door
  // from its wing and a back door from outside. The blurb is the premise, not the answer (how to split is the player's to find). Four only (`only`): the mission IS two pairs' worth of work.
  { id: 'defuse-four', title: 'The two charges', kind: 'roomclear', squad: 4, level: 'defuse.json', group: 'clock', untuned: true,
    place: 'Two wings off one hall, a workshop at the end of each', lean: 'loud', defenders: 8,
    only: 'Two timed charges and one short clock: this one is played with the four.',
    blurb: 'Two charges on one clock, 1:15, one at the end of each wing. Six seconds at a charge makes it safe. It starts on your first step or order.' },
  { id: 'floodlit-four', title: 'The floodlit yard', kind: 'roomclear', squad: 4, level: 'floodlit.json', untuned: true, group: 'raids',
    place: 'A walled fuel post, eleven metres of lit yard to its door', lean: 'either', defenders: 7,
    blurb: 'Floodlights on the yard, guns in two open windows. The breaker is in a shed outside the wall, and they have no goggles.' },
  { id: 'killhouse-four', title: 'The kill house', kind: 'roomclear', squad: 4, level: 'killhouse.json', ways: ['the ready line, on the front door', 'the dark side, on the back door'], untuned: true, group: 'clock',
    place: 'A five-room shoot house on a range', lean: 'loud', defenders: 6,
    blurb: 'Six men and a clock from your first move. Gold 1:05, silver 1:30, bronze 2:00. Every man lost adds 25 seconds.' },
  // new ideas (group 'ideas': small missions, each built on one idea). Mousehole = the walls are the way in: the level's own room clear issues the squad wall
  // charges for the run (scenarios.roomClear.wallCharges → game/issue.ts), and every room's door opens on one lit corridor a duty-room gun looks down
  { id: 'mousehole-four', title: 'Mousehole', kind: 'roomclear', squad: 4, level: 'mousehole.json', ways: ['the dark yard, on the blank wall', 'the dark side, on the fire exit'], untuned: true, group: 'strongholds',
    place: 'A clinic: three rooms and a duty room off one lit corridor', lean: 'loud', defenders: 9, squads: true,
    blurb: "Every door opens on one lit corridor, and a gun behind a hatch owns it. His room is deeper than a stun can's reach. Five wall charges." },
  { id: 'hall-four', title: 'The long hall', kind: 'roomclear', squad: 4, level: 'hall.json', untuned: true, group: 'raids',
    place: 'One wing: a bare hall 23 metres long, four rooms off it', lean: 'loud', defenders: 7,
    only: 'The kit is issued: this one is played with the four.',
    blurb: 'Two men in the dim far end cover the whole hall, and the one door in opens on it. The kit is issued.' },
  // The glasshouse = glass is not cover: a floodlit forecourt, a glazed front and glass partitions with dark rooms behind (rounds pass panes: game/glasspen.ts), a blank back wall with the back door into the store; both starts are dark and out of sight.
  // FILED UNDER 'more', not 'ideas': the list's own rule is eight rows a group at most (probes.ts missions-list) and 'New ideas' holds eight — the owner's call which row moves.
  // The blurb is the premise and holds for both ways in (the sheet's 'Way in' row names them). The list deals the first way (beside the building: the lit glass is the player's own decision); the back lot is his pick on that row.
  // Two squads hold it since the hand placement (Front stays in the glasshouse, Back moves), and the level issues one wall charge for the blank end wall.
  { id: 'glasshouse-four', title: 'The glasshouse', kind: 'roomclear', squad: 4, level: 'glasshouse.json', ways: ['the dark beside the building, round the corner from the glass', 'the dark back lot, on the back door'], untuned: true, group: 'raids',
    place: 'A seed station: a glazed front, glass between its rooms', lean: 'loud', defenders: 7, squads: true,
    blurb: 'A floodlit forecourt and three dark rooms walled in glass: they shoot through it. Only the store at the back has no glass. One wall charge.' },
  // The pass = a level MADE FOR SNOW (tools/levels/pass.ts: the snow on the ground, the drifts, the caps and the trodden paths are in the level file, laid by hand; what falls
  // is the weather's, keyed on the level's name — game/weatherKinds.ts — so the link carries no `weather=`). A walled teahouse and truck halt at night: the one gate is lit and
  // watched through windows from two sides of the yard; the other way in is the kitchen's back door, outside the wall. Eight men, two squads: filed under 'Strongholds'.
  { id: 'pass-four', title: 'The pass', kind: 'roomclear', squad: 4, level: 'pass.json', ways: ['the road, in the dark beside the gate', "the back of the halt, on the kitchen's door"], untuned: true, group: 'strongholds',
    place: 'A teahouse and truck halt on a pass road, under snow', lean: 'loud', defenders: 8, squads: true,
    blurb: 'One gate under a lamp, a lorry snowed in just inside it. Lit windows on the yard beyond. The kitchen has a back door. A generator.' },
];

// THE QUIET MISSIONS (game/quiet.ts; kind 'quiet'), in a table of their own: a level file with a `scenarios.quiet` block and ONE OR TWO ROWS here — squad 0
// alone, squad 1 with one partner under the pair rules. Each start deals one of the block's starts, spots and patrol sets off the run's seed. They are NOT in
// SCENARIOS: that table is the squad's missions, and every tool that walks it (the scripted commander, the door and order tallies) means a team to command.
// The bazaar row and the police post are levels built for sneaking alone (tools/levels/bazaar.ts, police-post.ts); the last two are the quiet mission's own
// test yard (tools/levels/quiet-yard.ts). A level built for a quiet style adds its rows here the same way.
export const QUIET_MISSIONS: ScenarioEntry[] = [
  { id: 'bazaar-quiet', title: 'The bazaar row', kind: 'quiet', squad: 0, level: 'bazaar.json', untuned: true,
    place: 'A shuttered bazaar under curfew: two blocks, one passage', lean: 'quiet', defenders: 5,
    blurb: 'A patrol walks round each block and both come down the one passage. Move behind a torch or cut through the shops. Take the sat phone, leave by any gate.' },
  { id: 'police-post-quiet', title: 'The police post', kind: 'quiet', squad: 0, level: 'police-post.json', untuned: true,
    place: 'A walled district police post', lean: 'quiet', defenders: 5,
    blurb: 'The keys are on the desk sergeant\'s belt, the armoury\'s code in the men\'s heads. Grab one and ask, or pick a lock. Take the case file, leave by a side gate.' },
  // (tools/levels/vault.ts: a quiet level built round the devices — a lens on each gate and one on a keypad door, as the bazaar and the police post have them, and two tripwire beams, which no level but the office had; tools/qa/vault-run.ts plays it, probe `vault`)
  { id: 'vault-quiet', title: 'The counting house', kind: 'quiet', squad: 0, level: 'vault.json', untuned: true, group: 'quiet-alone',
    place: "A money changer's house in a walled yard", lean: 'quiet', defenders: 3,
    blurb: 'A lens on the lit gate, a keypad on the strongroom. The clerk who knows the code smokes alone in the dark. The back door is past two tripwires.' },
  // (built for two — tools/levels/crossing.ts, quiet-relay.ts: each has one place that wants a second man; the partner is silent from the start)
  { id: 'quiet-crossing-two', title: 'The border crossing, as two', kind: 'quiet', squad: 1, level: 'crossing.json', untuned: true,
    place: 'A border checkpoint, the customs house across the road', lean: 'quiet', defenders: 6,
    blurb: 'A manifest across a lit road. Two sentries watch each other past a seized container: partner behind one, you behind the other. He goes when your hands do.' },
  { id: 'quiet-relay-two', title: 'The relay station, as two', kind: 'quiet', squad: 1, level: 'quiet-relay.json', untuned: true,
    place: 'A hilltop radio relay: mast, comms hut, ops room', lean: 'quiet', defenders: 6,
    blurb: 'A crypto drive in the comms hut. Its door is floodlit, locked and on camera; a picket watches it from the dark behind the mast. Send your partner behind him.' },
  // (tools/levels/lights-out.ts: a quiet level built for two — the breaker and the door it darkens are a courtyard apart, and the dark lasts as long as one man's walk to the panel;
  //  the man at the hall's window is the one the game sends to the panel; tools/qa/lights-out-run.ts plays it as a pair, alone, with the partner left behind and
  //  with the panel shot dead (low, at a sprint, and with the sentry choked out first), probe `lights-out`)
  { id: 'lights-out-two', title: 'Lights out, as two', kind: 'quiet', squad: 1, level: 'lights-out.json', untuned: true, group: 'quiet-two',
    place: 'A walled compound: the generator shed, the radio house', lean: 'quiet', defenders: 3,
    blurb: 'A codebook in the radio house: a lens on its door, beams across the hall, a sentry at its window. The mains are in a shed; the dark lasts until he walks there.' },
  // (the engine's own small yard, last in each quiet group: 'More' is full at eight rows)
  { id: 'quiet-yard-alone', title: 'The yard, alone', kind: 'quiet', squad: 0, level: 'quiet-yard.json', untuned: true, offList: true,
    place: 'A walled yard, a bunkhouse, a store', lean: 'quiet', defenders: 3,
    blurb: 'A ledger to lift from a yard of three rooms. Two gates, a camera on the yard, a night shift walking it. In and out unseen.' },
  { id: 'quiet-yard-two', title: 'The yard, as two', kind: 'quiet', squad: 1, level: 'quiet-yard.json', untuned: true, offList: true,
    place: 'A walled yard, a bunkhouse, a store', lean: 'quiet', defenders: 3,
    blurb: 'The same yard with one partner, silent from the start. He follows low in your steps. X on a guard sends him round behind, F is the mark.' },
];
// THE TRAINING GROUP (game/lesson.ts), in a table of its own for the same reason: short levels, each a real mission of its kind (quiet alone, quiet as two, a
// room clear with a pair or the four) whose file also carries a `scenarios.lesson` block — steps on the objective row, each naming its key, each moving on when
// the player has done the thing. A row here is `group: 'training'` and nothing else special: the page starts it like any row of its kind. Not in SCENARIOS or
// QUIET_MISSIONS, so the squad's and the quiet tools' walks are what they were; tools/qa/lesson-check.ts and lesson-run.ts are this table's.
export const TRAINING_MISSIONS: ScenarioEntry[] = [
  { id: 'train-move', title: '1 · Moving unseen', kind: 'quiet', squad: 0, level: 'train-move.json', group: 'training',
    place: 'The motor pool: three lamps, one guard', lean: 'quiet', defenders: 1,
    blurb: 'Read the light and sound meters, keep to the dark, and take the vehicle log from behind a guard\'s back.' },
  { id: 'train-hands', title: '2 · Hands', kind: 'quiet', squad: 0, level: 'train-hands.json', group: 'training',
    place: 'The kitchen court: a cook, a baker, a watchman', lean: 'quiet', defenders: 3,
    blurb: 'Three men in a kitchen court, taken one at a time with your hands: whistle, grab, question, knock out, hide.' },
  { id: 'train-lights', title: '3 · Lights, locks and devices', kind: 'quiet', squad: 0, level: 'train-lights.json', group: 'training',
    place: 'The generator yard: a camera, a beam, a keypad', lean: 'quiet', defenders: 1,
    blurb: 'Everything that sees you runs on something: lamps, locks, a keypad, a camera, a beam, and the power behind them all.' },
  { id: 'train-kit', title: '4 · Guns and the kit', kind: 'quiet', squad: 0, level: 'train-kit.json', group: 'training',
    place: 'The range: five slots, two men behind a lit door', lean: 'loud', defenders: 2,
    blurb: 'Every slot on the range, quiet ones first, then two men through a lit door into the dark you made.' },
  { id: 'train-orders', title: '5 · Orders and door tools', kind: 'roomclear', squad: 2, level: 'train-orders.json', seed: 1, group: 'training',
    place: 'The quarters: a dark street of four one-room houses', lean: 'loud', defenders: 4, squads: true,
    blurb: 'Command a pair down a dark street: move, cover, hold, fall in, stack up. Then four doors, four ways in.' },
  { id: 'train-pairs', title: '6 · Two pairs, two doors, one word', kind: 'roomclear', squad: 4, level: 'train-pairs.json', seed: 1, group: 'training',
    place: 'The white house: two doors, and its grain store', lean: 'loud', defenders: 3, squads: true,
    blurb: 'Four men as two pairs: all on one door, then a pair on each door of the white house, and one word sends both in.' },
  { id: 'train-silent', title: '7 · Quiet, as two', kind: 'quiet', squad: 1, level: 'train-silent.json', group: 'training',
    place: 'The well court: a well, a lantern, a back gate', lean: 'quiet', defenders: 3,
    blurb: 'A silent partner in the dark: park him, set him behind a guard, and drop two men in one lantern\'s light on one beat.' },
];
/** EVERY MISSION THE LIST HOLDS: the squad's, the quiet ones, the training group — what the missions screen draws, what a query is read back to, what the pause card names */
/** THE TUTORIAL (game/rails.ts): missions played on rails — one new thing a step, everything not yet met switched off, each step's line the one instruction on
 *  screen. The first is a squad led from above, with nobody on the floor the player's own. */
export const TUTORIAL_MISSIONS: ScenarioEntry[] = [
  { id: 'tut-sky', title: 'The tunnel, from above', kind: 'roomclear', squad: 4, level: 'tut-sky.json', group: 'tutorial',
    place: 'A road tunnel\'s station, under snow', lean: 'loud', defenders: 7, squads: true,
    blurb: 'Your squad is pinned on the road. Lead it from above: through the gate, then door by door.',
    scene: 'A fuel convoy drove into the tunnel and never came out of it. Your squad came up the road to the station at its mouth, and into the roadblock in front of it. Tonight nobody on the ground is you: you lead the four from above.',
    teaches: ['Turn, zoom and move the view', 'One key orders the squad', 'Stack on a door, then send them in', 'A charge on a wall', 'Lights out: what the dark does to men'] },
  // alone and loud (tools/levels/tut-solo.ts, levels/tut-solo.script.ts): one man walks one line through a fuel halt, and every piece of cover on it is the
  // lesson for the key that uses it
  { id: 'tut-solo', title: 'The fuel halt, alone', kind: 'quiet', squad: 0, level: 'tut-solo.json', group: 'tutorial',
    place: 'A walled fuel halt on a dust road', lean: 'loud', defenders: 5,
    blurb: 'On your own feet: a sentry, a gun, a locked door, a room, and the way back out.',
    scene: 'The men who hit the convoy keep their code book at a fuel halt down the valley. You go in for it alone, and nobody expects it to stay quiet.',
    teaches: ['Move, sprint, stay low', 'A wall at your back, and leaning out', 'Rifle and pistol, and a gun\'s setup', 'Smoke, a frag, a stun, the launcher', 'A charge on a locked door'] },
  { id: 'tut-squad', title: 'A harder fight', kind: 'roomclear', squad: 4, level: 'tut-squad.json', seed: 1, group: 'tutorial',
    place: 'The post: one street, a gun at its end', lean: 'loud', defenders: 11, squads: true,
    blurb: 'Four men down one street: two easy rooms, then a door they shoot through, a gun, a locked hall, and a picket by two gates.',
    scene: 'The code book names a post one street long. This time you walk in with the four, and the men in it know how to hold a street.',
    teaches: ['Doors, with the squad behind you', 'A doorway a man holds: go round', 'A gun on the street: make it duck, then move', 'Clear a room through its window', 'Turn the squad to cover your back'] },
  { id: 'tut-quiet', title: 'The ledger', kind: 'quiet', squad: 0, level: 'tut-quiet.json', group: 'tutorial',
    place: 'A money changer\'s shop, a night of snow', lean: 'quiet', defenders: 3,
    blurb: 'Alone, and nobody knows you came. Through the dark to the strongroom, and out the way you went in.',
    scene: 'The post was paid through one house in town, and its ledger says by whom. It is in the strongroom. Nobody is to know you were there.',
    teaches: ['Stay low and out of the light', 'A whistle puts a guard where you want him', 'Take a man from behind', 'Locks, the fuse box, night vision', 'Out the way you came in'] },
];
/** every row that is a lesson: the tutorial's missions, then the Training levels */
export const LESSON_MISSIONS: ScenarioEntry[] = [...TUTORIAL_MISSIONS, ...TRAINING_MISSIONS];
export const ALL_MISSIONS: ScenarioEntry[] = [...TUTORIAL_MISSIONS, ...SCENARIOS, ...QUIET_MISSIONS, ...TRAINING_MISSIONS];

/** the query keys a scenario owns: a pick replaces them, a quit drops them, everything else on the URL (?quality=, ?mute, ?hud …) rides along.
 *  (`?level=` is NOT: a scenario on the
 *  relief office or on the editor's own level is a thing to want.) `solo` is the mission list's flag for the plain night straight in (ui/missions.ts): a pick or
 *  a quit drops it like the rest. */
export const SCENARIO_KEYS = ['levelFile', 'nightbreach', 'roomclear', 'rescue', 'quiet', 'squad4', 'squad', 'loadout', 'solo'];   // (`squad=N`: the loadout's size, game/loadout.ts; `loadout=<id>`: its screen, ui/loadout.ts)

/** 'you + the pair' / 'you + four' (and the loadout's other sizes: 'solo', 'you + one', 'you + three'): how many teammates, in the picker's words */
export function teamWords(e: { squad: number }): string { return sizeWords(e.squad); }
/** the short tag beside a title: 'pair' / 'four' ('solo' / 'one' / 'three') */
export function teamTag(e: { squad: number }): string { return sizeTag(e.squad); }
/** what the level is called on the picker: the file's stem, or 'office' for the bundled level */
export function levelWords(e: { level?: string }): string { return e.level ? e.level.replace(/\.json$/, '') : 'office'; }

/** What a query string asks for, read exactly as the page starts it (game/scenarioRun.ts): which scenario, with how many teammates, on which level file and
 *  placement seed — or null when it names none. `?squad4` alone is the room clear with the four; beside `?nightbreach` it is that scenario with four; the rescue
 *  stages its own pair whatever that FLAG says. `?squad=N` (0‥4, game/loadout.ts) is the loadout's size on any of the three, the rescue included, and wins over
 *  the flag; with neither the size is the pair. `?quiet` (`?quiet=N`: the deal pinned) is the quiet mission on the level the URL names: alone, or `squad=1` — `squad4` beside it is not its
 *  flag and is ignored (a stale link is the quiet mission, never a room clear on a level that has none). */
export interface ScenarioSpec { kind: ScenarioEntry['kind']; squad: SquadSize; level?: string; seed?: number }
export function specOfQuery(search: string | URLSearchParams): ScenarioSpec | null {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const four = q.has('squad4');
  const kind: ScenarioEntry['kind'] | null = q.has('roomclear') || (four && !q.has('nightbreach') && !q.has('rescue') && !q.has('quiet')) ? 'roomclear' : q.has('nightbreach') ? 'nightbreach' : q.has('rescue') ? 'rescue' : q.has('quiet') ? 'quiet' : null;
  if (!kind) return null;
  // (a quiet mission, game/quiet.ts: alone unless `squad=1` — any bigger size it is asked for is the one partner; `quiet=N` pins its deal)
  const spec: ScenarioSpec = kind === 'quiet' ? { kind, squad: (squadOfQuery(q, false) ?? 0) > 0 ? 1 : 0 } : { kind, squad: squadOfQuery(q, kind !== 'rescue') ?? 2 };
  const lf = q.get('levelFile'); if (lf && /^[\w.-]+\.json$/.test(lf)) spec.level = lf;
  if (kind === 'roomclear') { const s = q.get('roomclear') || q.get('squad4'); if (s && Number.isFinite(Number(s))) spec.seed = Math.floor(Number(s)); }
  if (kind === 'quiet') { const s = q.get('quiet'); if (s && Number.isFinite(Number(s))) spec.seed = Math.floor(Number(s)); }
  return spec;
}
/** the list's row a query string boots (same kind, team size, level and seed), or null: a hand-typed combination the list does not hold (a row deployed at
 *  another size than its own is one: game/scenarioRun.ts runningScenario still names it) */
export function entryOfQuery(search: string | URLSearchParams, list: ScenarioEntry[] = ALL_MISSIONS): ScenarioEntry | null {
  const s = specOfQuery(search); if (!s) return null;
  return list.find(e => e.kind === s.kind && e.squad === s.squad && (e.level ?? '') === (s.level ?? '') && (e.kind !== 'roomclear' || (e.seed ?? null) === (s.seed ?? null)) && (e.kind !== 'quiet' || e.seed === undefined || e.seed === s.seed)) ?? null;   // (a quiet row with no seed of its own is its row whatever deal the URL pins)
}
/** the visitor's query string with every scenario key dropped ('' or '?a=1&b') */
export function quitSearch(search: string): string {
  const q = new URLSearchParams(search); for (const k of SCENARIO_KEYS) q.delete(k);
  q.delete('way');   // (the way in is ONE mission's pick — ui/missions.ts waySearch puts it on that row's link alone; it names no scenario, so it is not a SCENARIO_KEY)
  if (q.get('quietfog') !== '0') q.delete('quietfog');   // (a rung of the fog lever is a QUIET mission's pick — game/quietfog.ts puts it on a quiet row's link alone; `quietfog=0`, the rule's own off switch, is the visitor's flag and stays)
  for (const k of ['bench', 'benchcap', 'benchrun']) q.delete(k);   // (the benchmark's words, ui/bench.ts and ui/benchrun.ts: one run on the page it was asked on, never carried onto a mission's link)
  q.delete('cams');   // (… and the sticky cameras handed with it: the button beside the lever, on a quiet row's link alone)
  return bare(q);
}
/** the query string a click on `e`'s row loads: scenarioQuery(e), then the visitor's other flags as they stood */
export function pickSearch(e: ScenarioEntry, search = ''): string {
  const rest = quitSearch(search);
  return scenarioQuery(e) + (rest ? '&' + rest.slice(1) : '');
}
/** URLSearchParams back to a query string, bare flags left bare (`?mute`, not `?mute=`) */
function bare(q: URLSearchParams): string {
  const parts: string[] = []; q.forEach((v, k) => parts.push(v === '' ? encodeURIComponent(k) : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`));
  return parts.length ? '?' + parts.join('&') : '';
}
