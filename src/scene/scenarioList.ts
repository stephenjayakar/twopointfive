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
// two' by its team, a rescue is 'on the clock' and any other squad's mission a 'raid'. (A comment over a row below that says group 'ideas' or 'more' is of the groups before 10-11: the row's own field is the fact.)
export const SCENARIOS: ScenarioEntry[] = [
  // the office (the bundled level). The night breach stays here: it was built and tuned on this floor and its idea is picking your entry. The other three are
  // the office versions of what the levels below were made for, kept beside them
  { id: 'night-breach', title: 'Night breach', kind: 'nightbreach', squad: 2, group: 'raids',
    place: 'The office · the break room', lean: 'either', defenders: 3,
    blurb: 'Enemies hold a break room with four doors. Stack your pair up on one door and send them in while you come through another.' },
  { id: 'room-clear-pair', title: 'Room clear', kind: 'roomclear', squad: 2,
    place: 'The office · the east wing, room by room', lean: 'loud', defenders: 5,
    blurb: 'Clear four held rooms in the office one at a time with the order menu and the door tools. This is the careful way to play.' },
  { id: 'room-clear-four', title: 'Room clear, four-man squad', kind: 'roomclear', squad: 4, untuned: true, offList: true,
    place: 'The office · the east wing, two pairs', lean: 'loud', defenders: 5,
    blurb: 'Clear the same four rooms with a red pair and a blue pair. Hit two doors at once, or have one pair cover the other.' },
  { id: 'hostage-rescue', title: 'Hostage rescue', kind: 'rescue', squad: 2,
    place: "The office · the manager's office", lean: 'loud', defenders: 3,
    blurb: 'Two hostages are held by a captor on a clock. Move down the corridor, clear only what you have to, and get in before time runs out.' },
  // a level per scenario (levels/<name>.json, the levels goal's — each row is all it took): the pair's room clear, the four's, the rescue
  { id: 'records-pair', title: 'The records office', kind: 'roomclear', squad: 2, level: 'records.json', ways: ['the south lot', 'the dark west side'], untuned: true, group: 'raids',
    place: 'Three small rooms and a strong room, a dark lot outside', lean: 'loud', defenders: 5,
    blurb: 'The choice here is which door. Most rooms have two or three, but the strong room has one locked door off a room you have to take first.' },
  { id: 'depot-four', title: 'The depot', kind: 'roomclear', squad: 4, level: 'depot.json', ways: ['the main gate', 'the back gate'], untuned: true,
    place: 'A motor pool at night: three huts round a floodlit yard', lean: 'loud', defenders: 5,
    blurb: 'The yard is floodlit, and enemies cover it from two dark openings in the comms room and the store. The breaker is behind the comms room.' },
  { id: 'block-four', title: 'The block', kind: 'roomclear', squad: 4, level: 'block.json', ways: ['the loading hall, on the main hall', 'the loading hall, on the tool crib'], untuned: true, group: 'strongholds',
    place: 'Four rooms off one hall, a turn in each', lean: 'loud', defenders: 8, squads: true,
    blurb: 'Every held room turns a corner, so the enemies wait in the dark past a lit doorway. Each has a second door from the small room beside it.' },
  { id: 'block-squads', title: 'The block, three squads', kind: 'roomclear', squad: 4, level: 'block-squads.json', ways: ['the loading hall, on the main hall', 'the loading hall, on the tool crib'], untuned: true, offList: true, group: 'strongholds',
    place: 'The block again, held by squads', lean: 'loud', defenders: 11, squads: true,
    blurb: 'The enemies hold the block in squads, and each squad has its own rooms. Hit one squad and listen to what the others do.' },
  { id: 'warehouse-four', title: 'The warehouse', kind: 'roomclear', squad: 4, level: 'warehouse.json', ways: ['the south-west corner', 'the south-east corner'], untuned: true, group: 'strongholds',
    place: 'A racked hall, a loading dock, a ring of small rooms', lean: 'loud', defenders: 11, squads: true,
    blurb: 'The building is laid out as a ring, so whichever door you fight at, someone can walk around behind you.' },
  { id: 'compound-four', title: 'The compound', kind: 'roomclear', squad: 4, level: 'compound.json', ways: ['the side yard gate', 'the back gate'], untuned: true, group: 'strongholds',
    place: 'A walled yard, a house of eight rooms, three outbuildings', lean: 'loud', defenders: 11, squads: true,
    blurb: 'The enemies are behind a wall. Two of its three gates are dark, two windows are open, and the breaker is in a pantry nobody\'s guarding.' },
  { id: 'barracks-four', title: 'The barracks', kind: 'roomclear', squad: 4, level: 'barracks.json', ways: ['the south-east corner', 'the galley back door'], untuned: true, group: 'strongholds',
    place: 'Two wings and a mess hall round an open yard', lean: 'loud', defenders: 11, squads: true,
    blurb: 'Enemies hold two galleries that look across an open yard at each other. Six rooms are empty, and the breaker is in the duty office.' },
  { id: 'rescue-registry', title: 'The registry', kind: 'rescue', squad: 2, level: 'registry.json', untuned: true,
    place: 'A lit gallery to the hostage room, a dark way round', lean: 'loud', defenders: 3,
    blurb: 'You\'re on a clock. A lit gallery passes two rooms on the way to the hostages, and a gunman waits in one of them. Check the glass.' },
  { id: 'rescue-consulate', title: 'The consulate', kind: 'rescue', squad: 4, level: 'consulate.json', untuned: true, group: 'clock',
    place: 'A corridor past four rooms to an office in two halves', lean: 'loud', defenders: 6,
    blurb: 'Three hostages are behind two doors, and you\'ll want to hit both at once. There\'s no time to clear the four rooms you pass, so cover them.' },
  // NEW IDEAS: small missions, each built on one idea (group 'ideas'), each on a level made for it. The group is drawn in this table's order: the order to play them in
  // ---- new ideas, one a mission (group 'ideas'): a room clear with one overlay module keyed on a block of the level file
  { id: 'snatch-four', title: 'The snatch', kind: 'roomclear', squad: 4, level: 'snatch.json', group: 'clock', untuned: true,
    place: 'A small walled house, four rooms, a hut on the back gate', lean: 'loud', defenders: 8,
    blurb: 'Take one unarmed man alive and walk him out to your van. He\'ll run for the back gate at the first shot or the moment he sees you.' },   // (the van: how a snatch ends since game/snatchout.ts; with that switch off the house taken is still the end and the van only stands there)
  // ONE IDEA (group 'ideas'): two timed charges on one clock (game/defuse.ts, the level's scenarios.defuse block), a wing apart, each workshop with a door
  // from its wing and a back door from outside. The blurb is the premise, not the answer (how to split is the player's to find). Four only (`only`): the mission IS two pairs' worth of work.
  { id: 'defuse-four', title: 'The two charges', kind: 'roomclear', squad: 4, level: 'defuse.json', group: 'clock', untuned: true,
    place: 'Two wings off one hall, a workshop at the end of each', lean: 'loud', defenders: 8,
    only: 'With two timed charges and one short clock, this one is played with the full squad of four.',
    blurb: 'Two charges share one 1:15 clock, one at the end of each wing. Each takes six seconds to make safe. The clock starts on your first move.' },
  { id: 'floodlit-four', title: 'The floodlit yard', kind: 'roomclear', squad: 4, level: 'floodlit.json', untuned: true, group: 'raids',
    place: 'A walled fuel post, eleven metres of lit yard to its door', lean: 'either', defenders: 7,
    blurb: 'The yard is floodlit, with guns in two open windows. The breaker is in a shed outside the wall, and the enemies don\'t have night vision.' },
  { id: 'killhouse-four', title: 'The kill house', kind: 'roomclear', squad: 4, level: 'killhouse.json', ways: ['the ready line, on the front door', 'the dark side, on the back door'], untuned: true, group: 'clock',
    place: 'A five-room shoot house on a range', lean: 'loud', defenders: 6,
    blurb: 'The clock starts on your first move. Gold is 1:05, silver 1:30 and bronze 2:00. Every teammate you lose adds 25 seconds.' },
  // new ideas (group 'ideas': small missions, each built on one idea). Mousehole = the walls are the way in: the level's own room clear issues the squad wall
  // charges for the run (scenarios.roomClear.wallCharges → game/issue.ts), and every room's door opens on one lit corridor a duty-room gun looks down
  { id: 'mousehole-four', title: 'Mousehole', kind: 'roomclear', squad: 4, level: 'mousehole.json', ways: ['the dark yard, on the blank wall', 'the dark side, on the fire exit'], untuned: true, group: 'strongholds',
    place: 'A clinic: three rooms and a duty room off one lit corridor', lean: 'loud', defenders: 9, squads: true,
    blurb: 'Every door opens onto one lit corridor, and a gunner behind a hatch covers it. A flashbang can\'t reach him, but you have wall charges.' },
  { id: 'hall-four', title: 'The long hall', kind: 'roomclear', squad: 4, level: 'hall.json', untuned: true, group: 'raids',
    place: 'One wing: a bare hall 23 metres long, four rooms off it', lean: 'loud', defenders: 7,
    only: 'Your kit is issued for this one, so it\'s played with the full squad of four.',
    blurb: 'Two enemies at the dim far end cover the whole hall, and the only door in opens onto it. Your kit is issued for this one.' },
  // The glasshouse = glass is not cover: a floodlit forecourt, a glazed front and glass partitions with dark rooms behind (rounds pass panes: game/glasspen.ts), a blank back wall with the back door into the store; both starts are dark and out of sight.
  // FILED UNDER 'more', not 'ideas': the list's own rule is eight rows a group at most (probes.ts missions-list) and 'New ideas' holds eight — the owner's call which row moves.
  // The blurb is the premise and holds for both ways in (the sheet's 'Way in' row names them). The list deals the first way (beside the building: the lit glass is the player's own decision); the back lot is his pick on that row.
  // Two squads hold it since the hand placement (Front stays in the glasshouse, Back moves), and the level issues one wall charge for the blank end wall.
  { id: 'glasshouse-four', title: 'The glasshouse', kind: 'roomclear', squad: 4, level: 'glasshouse.json', ways: ['the dark beside the building, round the corner from the glass', 'the dark back lot, on the back door'], untuned: true, group: 'raids',
    place: 'A seed station: a glazed front, glass between its rooms', lean: 'loud', defenders: 7, squads: true,
    blurb: 'The enemies in three dark, glass-walled rooms will shoot right through the glass. Only the back store has none. You get one wall charge.' },
  // The pass = a level MADE FOR SNOW (tools/levels/pass.ts: the snow on the ground, the drifts, the caps and the trodden paths are in the level file, laid by hand; what falls
  // is the weather's, keyed on the level's name — game/weatherKinds.ts — so the link carries no `weather=`). A walled teahouse and truck halt at night: the one gate is lit and
  // watched through windows from two sides of the yard; the other way in is the kitchen's back door, outside the wall. Eight men, two squads: filed under 'Strongholds'.
  { id: 'pass-four', title: 'The pass', kind: 'roomclear', squad: 4, level: 'pass.json', ways: ['the road, in the dark beside the gate', "the back of the halt, on the kitchen's door"], untuned: true, group: 'strongholds',
    place: 'A teahouse and truck halt on a pass road, under snow', lean: 'loud', defenders: 8, squads: true,
    blurb: 'The only gate is lit, with a truck snowed in just inside. Lit windows watch the yard, the kitchen has a back door, and there\'s a generator.' },
];

// THE QUIET MISSIONS (game/quiet.ts; kind 'quiet'), in a table of their own: a level file with a `scenarios.quiet` block and ONE OR TWO ROWS here — squad 0
// alone, squad 1 with one partner under the pair rules. Each start deals one of the block's starts, spots and patrol sets off the run's seed. They are NOT in
// SCENARIOS: that table is the squad's missions, and every tool that walks it (the scripted commander, the door and order tallies) means a team to command.
// The bazaar row and the police post are levels built for sneaking alone (tools/levels/bazaar.ts, police-post.ts); the last two are the quiet mission's own
// test yard (tools/levels/quiet-yard.ts). A level built for a quiet style adds its rows here the same way.
export const QUIET_MISSIONS: ScenarioEntry[] = [
  { id: 'bazaar-quiet', title: 'The bazaar row', kind: 'quiet', squad: 0, level: 'bazaar.json', untuned: true,
    place: 'A shuttered bazaar under curfew: two blocks, one passage', lean: 'quiet', defenders: 5,
    blurb: 'Two patrols circle the blocks and share one passage. Move behind their flashlights or cut through the shops. Take the sat phone and leave through any gate.' },
  { id: 'police-post-quiet', title: 'The police post', kind: 'quiet', squad: 0, level: 'police-post.json', untuned: true,
    place: 'A walled district police post', lean: 'quiet', defenders: 5,
    blurb: 'The desk sergeant carries the keys, and the guards know the armory code. Grab one and ask, or pick a lock. Take the case file and leave through a side gate.' },
  // (tools/levels/vault.ts: a quiet level built round the devices — a lens on each gate and one on a keypad door, as the bazaar and the police post have them, and two tripwire beams, which no level but the office had; tools/qa/vault-run.ts plays it, probe `vault`)
  { id: 'vault-quiet', title: 'The counting house', kind: 'quiet', squad: 0, level: 'vault.json', untuned: true, group: 'quiet-alone',
    place: "A money changer's house in a walled yard", lean: 'quiet', defenders: 3,
    blurb: 'There\'s a camera on the lit gate and a keypad on the strongroom. The clerk who knows the code smokes alone in the dark. Two tripwires guard the back door.' },
  // (built for two — tools/levels/crossing.ts, quiet-relay.ts: each has one place that wants a second man; the partner is silent from the start)
  { id: 'quiet-crossing-two', title: 'The border crossing, as two', kind: 'quiet', squad: 1, level: 'crossing.json', untuned: true,
    place: 'A border checkpoint, the customs house across the road', lean: 'quiet', defenders: 6,
    blurb: 'The manifest is across a lit road, past two sentries who watch each other. Put your partner behind one and grab the other, and he\'ll go when you do.' },
  { id: 'quiet-relay-two', title: 'The relay station, as two', kind: 'quiet', squad: 1, level: 'quiet-relay.json', untuned: true,
    place: 'A hilltop radio relay: mast, comms hut, ops room', lean: 'quiet', defenders: 6,
    blurb: 'The crypto drive is in the comms hut. Its door is lit, locked and on camera, and a guard watches it from the dark behind the mast. Send your partner behind him.' },
  // (tools/levels/lights-out.ts: a quiet level built for two — the breaker and the door it darkens are a courtyard apart, and the dark lasts as long as one man's walk to the panel;
  //  the man at the hall's window is the one the game sends to the panel; tools/qa/lights-out-run.ts plays it as a pair, alone, with the partner left behind and
  //  with the panel shot dead (low, at a sprint, and with the sentry choked out first), probe `lights-out`)
  { id: 'lights-out-two', title: 'Lights out, as two', kind: 'quiet', squad: 1, level: 'lights-out.json', untuned: true, group: 'quiet-two',
    place: 'A walled compound: the generator shed, the radio house', lean: 'quiet', defenders: 3,
    blurb: 'The codebook is in the radio house, behind a camera, beams and a sentry. The breaker is in a shed, and the dark only lasts until he walks over to it.' },
  // (the engine's own small yard, last in each quiet group: 'More' is full at eight rows)
  { id: 'quiet-yard-alone', title: 'The yard, alone', kind: 'quiet', squad: 0, level: 'quiet-yard.json', untuned: true, offList: true,
    place: 'A walled yard, a bunkhouse, a store', lean: 'quiet', defenders: 3,
    blurb: 'Steal a ledger from a yard with three rooms, two gates, a camera and a night shift on patrol. Get in and out without being seen.' },
  { id: 'quiet-yard-two', title: 'The yard, as two', kind: 'quiet', squad: 1, level: 'quiet-yard.json', untuned: true, offList: true,
    place: 'A walled yard, a bunkhouse, a store', lean: 'quiet', defenders: 3,
    blurb: 'It\'s the same yard, with a silent partner who follows you and stays low. With X on a guard you can send him around behind, and F tells him to go.' },
];
/** EVERY MISSION THE LIST HOLDS: the tutorial's, the squad's, the quiet ones — what the missions screen draws, what a query is read back to, what the pause card names */
/** THE TUTORIAL (game/rails.ts): missions played on rails — one new thing a step, everything not yet met switched off, each step's line the one instruction on
 *  screen. The first is a squad led from above, with nobody on the floor the player's own. */
export const TUTORIAL_MISSIONS: ScenarioEntry[] = [
  { id: 'tut-sky', title: 'The tunnel, from above', kind: 'roomclear', squad: 4, level: 'tut-sky.json', group: 'tutorial',
    place: 'A road tunnel\'s station, under snow', lean: 'loud', defenders: 7, squads: true, hour: 'night',   // (its last third is the mains going out: built for the dark)
    blurb: 'Your squad is pinned down on the road. Lead them from above, through the gate and then door by door.',
    scene: 'A fuel convoy drove into the tunnel and never came out, and your squad ran straight into a roadblock at the station by the tunnel\'s mouth. Tonight you\'re not on the ground with them, so you\'ll lead them from above.',
    teaches: ['Turn, zoom and move the view', 'Order the squad with one key', 'Stack the squad up on a door, then send them in', 'Put a charge on a wall', 'Cut the lights and fight in the dark'] },
  // plan mode (tools/levels/tut-plan.ts, levels/tut-plan.script.ts): nobody of his is on the floor and the mode is up from the first frame, and every stop is a thing one order to all
  // four cannot do and a plan can
  { id: 'tut-plan', title: 'On the radio', kind: 'roomclear', squad: 4, level: 'tut-plan.json', seed: 1, group: 'tutorial', hour: 'dusk', weather: 'clear',   // (a plan is laid in the last light: a low sun, long shadows across the yard and every door still plain from above. It was midday until 10-23, and at midday the pale walls and the ground were one flat wash)
    place: 'A walled relay post in the hills', lean: 'loud', defenders: 8, squads: true,
    blurb: "You'll lead your squad from above again, but this time you'll plan first. Hit two doors at once, beat a gunner, and cover two gates.",
    scene: "The enemies who hit the convoy use this relay post to talk to each other. You're not on the ground for this one either, so you'll lead your squad over the radio and plan each move before they make it.",
    teaches: ['Plan mode', 'Give each pair its own door', 'Send both pairs in at once', "Get behind a gunner who's watching a door", 'Choose which way a pair faces'] },
  // alone and loud (tools/levels/tut-solo.ts, levels/tut-solo.script.ts): one man walks one line through a fuel halt, and every piece of cover on it is the
  // lesson for the key that uses it
  { id: 'tut-solo', title: 'The fuel stop, alone', kind: 'quiet', squad: 0, level: 'tut-solo.json', group: 'tutorial',
    place: 'A walled fuel stop on a dust road', lean: 'loud', defenders: 5,
    blurb: 'You\'re on your own. Get past a sentry, a machine gun and a locked door, clear a room, and get back out.',
    scene: 'The people who hit the convoy keep their code book at a fuel stop down the valley. You\'re going in alone to get it, and nobody expects it to stay quiet.',
    teaches: ['Move, sprint and stay low', 'Take cover on a wall and lean out', 'Use your rifle, its launcher and your pistol', 'Throw smoke, a frag and a stun grenade', 'Blow a locked door with a charge'] },
  // (packs: the one lesson whose kit is the player's to plan — its Team & kit step walks him through reading this street and packing for it, ui/kitPlan.ts;
  //  one frag is his whatever he packs: the men behind the sandbags are held down until his lands)
  { id: 'tut-squad', title: 'A harder fight', kind: 'roomclear', squad: 4, level: 'tut-squad.json', seed: 1, group: 'tutorial', packs: { frags: 1 },
    // (its own hour and sky: the post was lit for the night — the street the player stands in is dark, the gates the picket comes through are under lamps
    //  the photocell puts out by day — and measured dry and still)
    hour: 'night', weather: 'clear',
    place: 'The post: one street, a gun at its end', lean: 'loud', defenders: 11, squads: true,
    blurb: 'Take your squad down one street. There are two easy rooms, then a watched doorway, a gunner, a locked hall, and more enemies at two gates.',
    scene: 'The code book points to an outpost that\'s one street long. This time you\'re walking in with your squad, and the enemies there know how to hold a street.',
    teaches: ['Go through doors with the squad behind you', 'Go around a doorway an enemy is watching', 'Make a gunner duck, then move', 'Clear a room through its window', 'Send part of the squad to cover your back'] },
  { id: 'tut-quiet', title: 'The ledger', kind: 'quiet', squad: 0, level: 'tut-quiet.json', group: 'tutorial',
    place: 'A money changer\'s shop on a snowy night', lean: 'quiet', defenders: 3, hour: 'night',   // (its light IS the lesson: a midday left on the link put the lamps out and the lane in sun)
    blurb: 'You go in alone. Slip through the dark to the strongroom, then leave the way you came in.',
    scene: 'The post was paid through a money changer\'s shop in town, and his ledger shows who paid. The ledger is in the strongroom. Nobody can know you were there.',
    teaches: ['Stay low and out of the light', 'Whistle to lure a guard', 'Grab a guard from behind', 'Locks, the breaker box and night vision', 'Leave the way you came in'] },
  // quiet, as two (tools/levels/tut-pair.ts): one partner under the pair rules, and each stretch of a truck park is one thing a second man makes possible
  { id: 'tut-pair', title: 'The truck park, as two', kind: 'quiet', squad: 1, level: 'tut-pair.json', group: 'tutorial',
    place: 'A walled truck park, at night', lean: 'quiet', defenders: 4,
    blurb: 'There are two of you, and nobody can know you were here. Take a guard each at the same moment, cut the lights, and leave together through the far gate.',
    scene: 'The ledger shows payments to a truck park at the edge of town, and the convoy\'s fuel went through it. Two of you are going in to get the manifest from the office, and nobody can know.',
    teaches: ['A partner who follows you quietly', 'Send him around behind a guard', 'Take down two guards at once', 'Have him cut the power while your hands are full', 'Move through the dark together'] },
];
/** every row that is a lesson: the tutorial's missions (the seven older Training lessons were taken out 2026-10-23) */
export const LESSON_MISSIONS: ScenarioEntry[] = TUTORIAL_MISSIONS;
export const ALL_MISSIONS: ScenarioEntry[] = [...TUTORIAL_MISSIONS, ...SCENARIOS, ...QUIET_MISSIONS];

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
