// DEFENDER SQUADS (the Door Kickers maps goal): on a level whose room clear structure declares `squads` (scene/scenarios.ts SquadData — who and where, never
// what they do when), the defenders are not one pool. Each squad holds its rooms until the team is on it; when the team is heard or met ELSEWHERE, each other
// squad makes ONE choice a player can read, said on their net before anybody moves:
//
//   BARRICADE  hold the rooms and get ready: the men stay, shut and wedge the squad's doors and take cover on them (digin.ts does the furniture — run for the
//              squad's men whatever the difficulty row says; only doors of the squad's `barricade` list are wedged). '<Squad>: holding — lock the doors!'
//   FLANK      a PAIR runs round to a door of the room under attack that the team is not known to be at — never across that room, never past where the team
//              was last seen or heard — and goes in from there (a fix out on open floor: by another way than the straight one); the rest of the squad
//              barricades. '<Squad>: two going round — keep them there!', their boots on the way (hearing events the team's ears take), '<Squad>: in
//              position — on them!'.
//   HELP       up to `helpMen` go straight at the fight on the fight AI's own hunt (the stock rally's hand-over: pursuit tactics, doors and all), a man kept
//              in every room the squad holds. '<Squad>: moving to <Ally>!'
//
// WHICH is the situation, never a die: `mayLeave: false` barricades; a squad with fewer than two men to spare past one a room barricades; a squad with men
// still out barricades. A squad in contact that still has two or more men up can hold the team where it is: the first squad to answer sends its pair ROUND;
// one down to its last man (or with no way round to it) gets men STRAIGHT; the second squad to answer does the other thing, a third locks down. A squad
// that has stopped answering: a strong squad (four at home) sends a pair round to where it was, anybody else locks down. The team heard on open floor with
// nobody in contact (surprise lost before the first door): nobody walks out at a noise he cannot place — every squad gets on its doors ('heard it — on the
// doors, call it when you see them!'), and STANDS TO: the next contact call on the net is answered after `readyBeat`, with no thinking beat (`openPair` =
// the first cut, a pair sent round to the noise: it walked onto the team's guns). So several squads hearing one fight neither all pile onto it nor all sit. What varies run to run is the men's own beats (a squad's thinking time is drawn like
// every reaction in the room fight), who is still up when the beat ends, and where the team is. A squad decides again when the fight moves to another squad.
//
// GOING ROUND WHERE A WAY ROUND EXISTS (SQUADS.goRound, on; off = everything above exactly, run for run — the squads-go-round goal: on the small-room maps a
// pair went round in 7, 19 and 11 of 144 scripted runs). Four things the rule above could not do in a room 5 m across whose two men are down before any
// squad has spoken: (1) the LAST-MAN gate is gone — a way round is asked for whatever the squad in contact has left, and men go straight only when there is
// none; (2) the team's door is the one the CONTACT CALL named (the men in the room know which door went in; ears through two walls do not), and a place the
// team was seen or heard closes a path, a spot or a door only with no wall between (roundCtx, wayRound2) — never a bare radius through the wall of the room
// the bang went off in; the search keeps out of every line of fire it knows of, a doorway's own lane included, and every spot outside a door is tried;
// (3) a man sent round WALKS THE WAY HE WAS GIVEN, mark by mark — handed the spot alone he ran to it by the shortest path, which is the one past the team's
// door; (4) a room the team already HAS (the squad that held it has one man up in it, or none) is not gone into by two men through its other door: the
// pair HOLDS that door from outside — '<Squad>: two going round — cut them off!', '<Squad>: in position — we have the door!' — from beside it, or from
// short of the open ground in front of it where the way there has to cross that; they are their squad's men there (digin.ts leaves them be) until the room
// fight moves them, their own rooms are hit, or `holdSecs` of quiet. The timeline says what became of each man sent ('met', 'lost').
//
// WHAT A SQUAD KNOWS is what its men see and hear, and what the net says (one model for the picture and the AI): it is in CONTACT when a man of it at home
// has eyes on the team, hears a loud thing inside the squad's own rooms (a boot on its door, a charge, a round), or drops there with a mate at home to know
// it; its call ('<Squad>: contact — <room>!') needs a man able to make it, and is what the other squads act on after `netLag`. Where the team IS, for a way
// round, is where defenders last saw or heard it — never its true position.
//
// A hit squad's men in its OTHER rooms come to the room under attack after their own beat. A man who gives ground (roomfight.ts breakOff) goes to the squad's
// `rally` point when it is in a room of the squad's the team is not known to be in; a `mayLeave: false` squad's men never leave its rooms (but, stayask.ts: on a floor
// where EVERY squad stays, one man of a squad walks to the posts of a squad that has gone silent on the net).
//
// WHAT THIS FILE OWNS: who of a squad may leave his room, and when. So on a squads level the stock rally (roomfight.ts) and the harder defenders' press
// (pressure.ts consider) do not take a squad's man — one clause each — and digin.ts waits for the squad's word before a man starts on his door. Everything
// else of both files runs as it does (the fall-backs, the wedge, the cover, the cues). No squads block, or SQUADS.on false: nothing here runs, no die is
// drawn, and every seam returns on its first line — the game as it was, run for run.
//
// NOT BUILT: `arrive` squads (they validate and load; nobody comes — sixteen skinned characters are all on the floor with eleven defenders, and taking
// bodies away mid-run is the room clear's bookkeeping to change first).
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap, rollbackVar } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import { dieOf, roll, type Die } from '../math/dice';   // (dice kept in state carry their word on an object: a rollback snapshot holds it — a mulberry32 closure's it cannot)
import type { Game, Guard } from './game';
import type { Door } from './doors';
import type { RoomFight, FightSkill } from './roomfight';
import type { SquadData, StructureData, StructureRoom } from '../scene/scenarios';
import { squadBarricade } from '../scene/scenarios';
import { frameOf, bodySeen, bodyPos, offNet, gunfireDue } from './guards';
import { runnerFled, runnerOwns } from './runner';   // (asked inside `alive`, `fit` and contact() only: false with its switch off)
import { chronRadio } from './chronicle';
import { cueClass } from './cues';
import { inBounds, order, endGuardScript } from './squad';
import { PRESSURE, run, loose, boots } from './pressure';
import { laneHolds, laneWarns } from './lanes';
import { digInPhase } from './digin';
import { lastStandMan } from './laststand';
import { wayName } from './dialogue';
import { WORDS } from './words';
import { netFeedAsked, netFeedBody, netFeedHolds } from './netquietfeed';   // (a leaf: netquiet.ts itself is not to be imported from here — see that file's head)
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise
import { STAYASK, stayAskHere } from './stayask';   // (squads that stay in their rooms still miss a room that goes silent: read at staging and in netSend)

export const SQUADS = {
  /** off = a squads block is ignored: the level's defenders are one pool, as on any level without one */
  on: true,
  /** s between a squad learning where the team is and its word on the net (drawn once per decision) */
  think: [2, 4.5] as [number, number],
  /** s between a squad's contact call and the other squads acting on it */
  netLag: 0.8,
  /** men a squad sends to help, at most · the men of a flank */
  helpMen: 3, flankMen: 2,
  /** s before a squad that has made its choice weighs the same fight again · s after a choice before ANY news is weighed */
  againSecs: 20, settleSecs: 8,
  /** s with nothing of the team seen or heard in its rooms before a squad in contact is holding again · s between two calls of one contact */
  quietSecs: 8, recallSecs: 20,
  /** a hit squad's men in its other rooms: their beat before they come */
  reinforce: [1, 2.5] as [number, number],
  /** the team heard on open floor, nobody in contact. Off (shipped): no squad sends men at a noise — every squad gets on its doors, and the next contact call
   *  on the net is answered after `readyBeat` instead of a thinking beat. On = the first cut: the squad next to the nearest one sends its pair round to the
   *  noise (measured: the pair walks onto the team's guns in the open — 42 of 144 scripted runs lost two men that way before the first door) */
  openPair: false, readyBeat: 0.4,
  /** GOING ROUND WHERE A WAY ROUND EXISTS. On (shipped): (1) a squad asks for a way round when the squad in contact is down to its LAST man too (off: it went
   *  straight to him without asking — and a two-man room is down to its last man before any squad has spoken); (2) which door of the room is the team's is
   *  what the NET said (the contact call names the door the team was met at), and a place the team was seen or heard counts against a path, a spot or a door
   *  only with NO WALL between them (col.shotBlocked — off: three bare radii, 3 / 5 / 4 m, through walls: nothing outside a room 5 m across is 5 m from a
   *  flashbang inside it): a place somebody SAW the team, or heard it through open air, has a line of fire `fireM` long, one heard through a wall `softM`,
   *  the stack outside the team's own door `rearM`, an open doorway of the room `fireM` from a man's place inside it — and a doorway's lane out to `mouthM`
   *  is dear to the search whether its leaf is shut or not; (3) every spot outside a door is tried, not the first alone; (4) the man walks the way that was
   *  picked for him, not the shortest path to its end; (5) `holdLost`: a room its own squad has one man up in, or none, is not gone into by the pair — its
   *  other door is held from outside: from beside it, or — the way to it crossing open ground in a doorway's lane — from short of that ground, where he has
   *  a line on the door inside `holdBackM`; he holds it `holdSecs` of quiet at most; (6) the squad's timeline says what became of each man sent ('met' = he
   *  ran into them short of his spot, 'lost' = he went down, and where). Off = the rule as it was, run for run. */
  goRound: true, fireM: 10, rearM: 6, softM: 3, mouthM: 18, holdLost: true, holdBackM: 16, holdSecs: 40,
  /** HARD ON A SQUADS LEVEL: A DRILLED GARRISON. Read only with harder defenders on (pressure.ts PRESSURE.on — the difficulty row's hard — and its row
   *  `squadDrill`) and squads staged: standard, and hard on a level with no squads, never reach a row of it. The same eleven, the same three choices, the
   *  same words on the net; what changes is how well drilled they are, each rule its own switch (record
   *  rebuild/hard-everywhere/round2-squad-maps.md — which of them bite, and which are shipped off):
   *  `drillNet`    THEY LET THE TEAM COMMIT: × `netK` (2) the thinking beat (`think`) and the net's lag (`netLag`) of a squad that could send men out
   *                (`mayGo`: allowed to leave, nobody of its own still out, two to spare), and × `reinforceK` the beat of a hit squad's men in its
   *                other rooms before they come (`reinforce`). A drilled garrison does not run at the first noise: a squad that hears of a fight and could go says so
   *                ('<Squad>: hold — let them come in. Wait for my word!', cues.ts) and takes twice the beat before it chooses and goes, stood to or not,
   *                so the pair that goes round is set at the other door while the team is going in, instead of being met on its way. A squad that
   *                stays in its rooms whatever is called answers as at standard. THE ONE RULE SHIPPED ON. (netK under 1, the first cut — quicker on
   *                the net — measured in the TEAM's favour: sent sooner, the pair walks onto guns that are still up.)
   *  `drillAngles` THEY HOLD THEIR ANGLES: a man's eyes do not wander off the door he watches (roomfight.ts FIGHT_SKILL.hostile `hold` / `glance`, the
   *                untrained man's habit: every 5 to 11 s a look of 1.2 to 2.6 s at another door).
   *  `drillReact`  QUICKER OFF THE MARK: × `reactK` his beat from 'that is a man' to lining him up (`react` 0.4‥1.1 s) and the extra beat of a man caught
   *                looking the other way (`surprise` 0.5‥0.9 s). The team's own row is 0.12‥0.22 s and is not touched; how well he shoots is not touched.
   *  `drillNerve`  STEADIER UNDER A BANG: × `nerveK` the chance a flash makes him duck for its length instead of firing blind down the door he watched
   *                (`bangBreak` 0.3) and the daze once his eyes clear (`daze` 1‥2 s). He is blind exactly as long and doubled over exactly as long.
   *  `drillFollow` THE PAIR FOLLOWS: two men holding the other door of a room the team has taken ('in position — we have the door!') hear the team's next
   *                entry go in somewhere else (a boot, a charge, gunfire: `followM` or more from their door, not in that room nor within 3 m of it) and come after it together
   *                — '<Squad>: they've moved on — after them!', then their boots.
   *  `drillOwn`    NO MAN FED INTO A LOST ROOM: a hit squad's man in another of its rooms does not walk into the room under attack once fewer than `ownUp` (1: nobody; 2 was a wall on the compound) of
   *                his squad are up in it — he gets ready on his own door ('<Squad>: <room>'s gone — stay on your doors, make them come!'). */
  drillNet: true, netK: 2, reinforceK: 2, drillAngles: false, drillReact: false, reactK: 0.75, drillNerve: false, nerveK: 0.5, drillFollow: false, followM: 6, drillOwn: false, ownUp: 1,
  /** BACK ON THEIR OWN DOORS (off; a map's own row — DRILL_AT): two men holding the other door of a room the team took hear the team go on somewhere else (the
   *  loud thing `drillFollow` waits for: `followM` or more from their door, not in that room) and give the door up — back to the posts they left, in their own
   *  rooms, their eyes toward the noise; or the squad they went round for stops answering (every man of it down, `backBeat` s of silence), and they do the same. Standard's pair stays on a door nobody is behind, out in the open, until the team comes on it from the side. Said
   *  once on their net: '<Squad>: they've left it — back on our doors!'. With `drillFollow` on as well, this one has them */
  drillBack: false, backBeat: 3,
  /** GO AND LOOK (on; read only with pressure.ts `PRESSURE.sweep` up as well — hard's row HARD.sweep, the one switch of the rule on every kind of level): the
   *  garrison has had word of the team — a call on the net, one of them properly in a man's sight, a loud thing in a man's ears — and then nothing for
   *  `sweepSecs`. Standard's squads sit on their doors from there for as long as the team cares to take. A drilled garrison sends a pair to look: of the
   *  squads that have nobody out and can spare two (a man left in every room that had one; `sweepMen` is never fewer than two), the one nearest the place
   *  that word put the team calls it on the net — '<Squad>: gone quiet — two of us go and look!', the cue, `sweepBeat` before either moves — and lets the
   *  two go at it on the fight AI's own hunt (the stock rally's hand-over: their boots are theirs to be heard). Calm again out there with nothing found,
   *  they walk back to the posts they left ('<Squad>: no sign of them — back on our doors!'). One look per word, never oftener than every `sweepSecs`;
   *  nobody goes to a room a man of theirs holds, while any squad is in contact, deciding or has men out, on his way to cover or wedging a door, or with a
   *  covered lane known that way; and A LOOK THAT LOSES A MAN IS THE LAST — no squad sends another that fight.
   *  `sweepStayers` (on): a squad the level tells to stay in its rooms (`mayLeave: false` — it answers no other squad's fight) still sends its look: the pair
   *  is the squad finding out where the team went, not a walk to somebody else's fight. Off = such a squad never leaves, hard or not (Mousehole, the lessons). */
  drillLook: true, sweepSecs: 20, sweepMen: 2, sweepBeat: 1.5, sweepStayers: true,
  /** EACH MAP ITS OWN SET (on): the rows `DRILL_AT` names for the structure the game stands on are read in place of the ones above — what bites on one
   *  squad map helps the team on another (measured), so hard is not the same rule on all four. Off = the rows above on every squad map */
  drillByMap: true,
  /** THE WAY HE COMES BY (on; words only — nobody walks, waits or shoots differently): a hit squad's man who answers 'coming to you' from another of its
   *  rooms says by which of the level's own rooms or places his walk comes in ('Alpha: coming to you through the north gallery — hold on!', or 'from bunks 2'
   *  when he walks straight in from where he stands) — dialogue.ts wayName, read off the plain nav path to the place the squad was hit. With the Defender
   *  cues off, on the office, or on a level that names none of its floor: the line as it was. Off = the line as it was */
  way: true,
  /** UNSEEN DROPS ARE FOUND BY RADIO CHECK OR BODY (off; `?radiocheck`, harness `SQUADS=radiocheck`; record rebuild/quiet-squad-maps/change.md).
   *  Off = the rule as it was, run for run: a squad is in contact the frame a man of it drops in its rooms with a mate at home, whether or not anybody saw
   *  or heard it. On: the drop itself tells nobody. A squad that is not already in contact learns of a man down in its rooms one of three ways —
   *  (a) A MATE'S EYES: a fit man of the squad has the body in his open view (the floor's own body test: 12 m, his cone, a line, the light on it — guards.ts
   *      bodyInView's, per body) — on the frame he drops or any frame after: contact, exactly as before ('<Squad>: contact — <room>!', its other men coming);
   *  (b) THE NET'S CHECK: every `checkEvery` s (± `checkJitter` of itself, × `checkAlertK` once the squad has heard of the team;
   *      each squad its own clock, the first inside one beat of the staging) a man of the squad at home calls '<Squad>: radio check — sound off'; `checkAsk` s on, a man who has not
   *      answered (down unknown to them, or in Sam's arm) is asked for by name ('<Squad>: Tango 8? … Tango 8, sound off' — the cue); `checkSend` s after
   *      the call up to `lookMen` of its men at home WALK to where he stood ('<Squad>: nothing from Tango 8 — two moving to his post!', their boots filed
   *      for the team's ears). No call goes out on the net: no other squad moves. The man who gets there looks about him for a second: the body seen is (a). No body
   *      to see (it was carried off, or he is in Sam's arm somewhere else): '<Squad>: no sign of Tango 8 — back on our doors!', they walk back to their
   *      posts and hold them as before, wary but not roused, and the squad is ready: its answer to the next contact call comes without the thinking
   *      beat (Squad.ready);
   *  (c) A MATE'S EARS: a man of the squad at home who hears a small thing (the body going down, a suppressed round) within `checkHearM` of where he
   *      dropped does not know a man is down — he asks for him by name after his own beat (`checkHeard` s) instead of at the next check, and (b) runs
   *      from there. `heardKnows` on = that sound alone is contact at once (the rule as it was, for a drop somebody heard); `heardAsks` off = it leads
   *      nowhere but his own turn of the head (the ordinary hearing model) and the next routine check.
   *  A drop a mate at home heard GUNFIRE with, or a stun charge or a door blown in (in the second and a half before it, or the second after), is contact at once, as it was.
   *  Not covered (as before the switch): a man who drops outside his squad's rooms, or out on a squad's errand — nobody misses him.
   *  A squad already in contact knows its men as before (a drop there is the old rule). A loud thing in its rooms and eyes on the team are untouched. */
  radioCheck: false, checkEvery: 40, checkJitter: 0.2, checkAlertK: 0.5, checkAsk: 4, checkSend: 8, checkHeard: [1, 2] as [number, number], checkHearM: 4, lookMen: 2, heardKnows: false, heardAsks: true,
  /** A GLIMPSE NOBODY HAS MADE OUT IS NOT CONTACT (off; the second piece under `?radiocheck`). Off = the rule as it was: a squad is in contact the frame one
   *  of its men at home has a hard sighting of the team (guards.ts stamps `lastSeenT` once his sight gain passes 0.25/s — whatever his awareness: 0.01 and
   *  still on patrol will do). On: the squad calls it on his eyes only once HE has noticed — his own state is 'alert' (his awareness passed 0.85, where he
   *  himself shouts and starts to fight) or 'search' (he had a man and lost him). Nothing about the man changes: he notices exactly as fast as before; the
   *  squad only stops running ahead of him. A loud thing in its rooms is untouched. */
  noticedEyes: false,
  /** A CONTACT CALL TAKES A BEAT AND CAN BE CUT OFF (off — and off under plain `?radiocheck`: `?radiocheck=call`, harness `SQUADS=radiocheck-call`, turn both
   *  pieces above on and this one; record rebuild/quiet-squad-maps/call-beat.md). Off = the rule as it was: a squad is in contact the frame
   *  ONE of its men has noticed the team, or has a mate's body in his eye — what he alone knows, the whole net knows that frame. On, ON A QUIET FLOOR (the
   *  squad has never been in contact, has had no word of the team on the net or by its own ears, and no man of it up has heard gunfire, a boot on a door
   *  or a charge): what one man's eyes found is HIS until he has said it. He keys up — '<Squad>: <callsign> — I've got—', a row on the strip and a cue
   *  over him, never his own bubble — and the squad is in contact when his call ends, `callSecs` later (drawn on the squad's own dice, never the game's):
   *  the contact call as it always was, said by him. Dropped, taken, blinded or reeling before that, the call is cut off and the squad has been told
   *  nothing of the team — but half a sentence went out on its own net: with the radio check on and a fit mate left, a caller who is off the net (down or
   *  taken) is asked for BY NAME `callCutAsk` 1‥2 s later, and men go to where he was if he does not answer (the check's own ask; a check already under
   *  way, men out looking or the squad's word due: he is asked for as soon as that is done; [0, 0] = no ask at all, the knob as it was first built — a
   *  drop in its rooms is then the next routine check's to find, one outside them nobody's). A mate who saw or heard it happen goes by his own senses and the rules above. Every man
   *  who notices has his own call and his own clock; the first to end is the squad's. THE MAN HIMSELF IS NOT TOUCHED: he notices, moves and shoots exactly
   *  as he did — and his first round is gunfire a living mate in earshot hears, which ends the quiet: from the frame the floor is not quiet any call on
   *  the air is through at once, and every later one is instant, as it was (a man does not hear his own shot: one with no living mate in earshot says
   *  his call to its end). A loud thing in the squad's rooms and a drop with gunfire are untouched.
   *  `callBody` (on): a mate's body SEEN (the radio check's eyes, a man sent to look included) is one man's knowledge too and takes the same beat;
   *  off (`?radiocheck=call-eyes`, `SQUADS=radiocheck-call-eyes`) = only eyes on the team do, a body seen is the squad's at once. */
  callBeat: false, callSecs: [1.5, 2.5] as [number, number], callBody: true, callCutAsk: [1, 2] as [number, number],
  /** THE NET ASKS AFTER A SQUAD THAT HAS GONE SILENT (off — and off under every other value: `?radiocheck=net`, harness `SQUADS=radiocheck-net`, turn the
   *  three pieces above on, the cut-off ask, and this one; record rebuild/quiet-squad-maps/net-ask.md). Off = each squad counts its own men
   *  and no squad ever asks about ANOTHER: a whole squad can be taken, quietly, and nobody is told. On, while no squad is in a fight or has its word due:
   *  (a) THE NET'S OWN CHECK: every `netEvery` s (± `checkJitter` of itself, × `checkAlertK` once anybody is wary; its own dice) a man at home of the
   *      first squad with one calls '<Squad>: all squads — radio check'. A squad with a man on the net has answered. `checkAsk` s on, a squad nobody
   *      answered for is asked for BY NAME ('<Squad>: Dock? … Dock, sound off' — the cue), by a man of the squad nearest it.
   *  (b) TROUBLE HEARD AND NOTHING AFTER: a squad's own trouble on the air — a call that broke off, a man asked for by name, men sent to a post — with no
   *      word of how it ended is asked about `netBeat` s later ('<Squad>: Dock — what's going on?'). A man of it on the net answers a breath later with
   *      what he knows ('<Dock>: still looking — stand by' · '<Dock>: still nothing from Tango 9' — and every squad is wary · '<Dock>: all up here —
   *      nothing more'); a squad is asked that twice at the most. Nobody left to answer: the ask by name of (a), at once.
   *  (c) NO ANSWER: `checkAsk` s after the ask by name every squad is WARY — stood to (Squad.ready: its answer to a contact call comes without the
   *      thinking beat) and counting its own men at the quicker beat — and `netLookMen` men of the nearest squad that can spare them WALK to that
   *      squad's posts, one after the other ('<Squad>: nothing from Dock — two moving to their rooms!', their boots filed for the team's ears). A squad
   *      can spare them when it is allowed out of its rooms and holding, has no trouble of its own (nobody of it asked for, out, cut off, or sent and
   *      not heard of since), and has that many past a man in every room and one at home on the net (not a man still standing on a door he went round
   *      to): never fewer than `netLookMen`. No such squad: '<Squad>: nothing from Dock — nobody to send, stay on your doors!', and Dock is asked for
   *      once more at a later roll call (not at all if only one squad is left to ask). Not in contact: nobody has seen anything. A body of that squad
   *      in a looker's eye, or the team in it, is his to call like any man's (the call beat: it can be cut off); nothing at the posts: '<Squad>: no
   *      sign of Dock — back on our doors!' and nobody asks after that squad again.
   *  (d) THE LAST MAN DOES NOT WALK OFF ALONE: a man who is the last of his squad at home as far as he knows (every other is out, known down, or was
   *      asked for and did not answer), whose ask by name got no answer, says so on the net ('<Dock>: nothing from Tango 10 — I'm alone here, somebody
   *      look!') and the men of (c) go to that post in his place ('copy, Dock — two moving to you!', a breath later; a second man missing while they
   *      are on their way: 'nothing from Tango 9 either — his post too!'). No squad able to send: he says that ('… I'm alone here, going myself!'),
   *      the squads go wary, and he goes.
   *  (e) A MAN THE NET SENT WHO KEYS UP AND IS CUT OFF IS THE ALARM (`netCutAlarm`, read only with the net's ask on): he was sent to find out why a
   *      squad is silent, his squad heard him start to say what he had found, and then nothing. A man of it at home calls it: '<Squad>: Tango 5 cut
   *      off at Dock — contact, Dock!'. The place on the net is the post the squad sent him to — its own knowledge, not where the team is. Off: his
   *      broken call is one more man to ask for by name, as any cut-off caller's is.
   *  Nobody is told where the team is, by any of it: the places are the squads' own posts. A squad that has put a contact call on the net is not asked
   *  after (everybody knows what became of it: the squads' own words handle it, as they did). */
  netAsk: false, netEvery: 60, netBeat: [6, 9] as [number, number], netLookMen: 2, netStops: 3, netCutAlarm: true,
};
export const SQUADS_DEFAULTS: typeof SQUADS = JSON.parse(JSON.stringify(SQUADS));
try { if (new URLSearchParams(location.search).has('nosquads')) SQUADS.on = false; } catch { /* no page (the harness) */ }   // ?nosquads: one pool for the visit
/** the one flag over the two pieces: '' / anything = both, 'drop' = unseen drops only, 'eyes' = unnoticed glimpses only, '0' = neither */
const senses = (v: string | null) => { SQUADS.radioCheck = v !== '0' && v !== 'eyes'; SQUADS.noticedEyes = v !== '0' && v !== 'drop'; SQUADS.callBeat = v === 'call' || v === 'call-eyes' || v === 'call-noask' || v === 'net'; SQUADS.netAsk = v === 'net'; if (SQUADS.callBeat) { SQUADS.callBody = v !== 'call-eyes'; if (v === 'call-noask') SQUADS.callCutAsk = [0, 0]; } };   // (the third piece, the call's beat, only by its own value: 'call' = both pieces and it, 'call-eyes' = the same with a body seen left instant, 'call-noask' = 'call' with nobody asking after a call that broke off — callCutAsk [0, 0]; 'net' = 'call' and the net asking after a squad that has gone silent — netAsk: everything on)
try { const q = new URLSearchParams(location.search); senses(q.has('radiocheck') ? q.get('radiocheck') : 'call'); } catch { /* no page (the harness) */ }   // THE PAGE OPENS AS ?radiocheck=call (the quiet maps goal's pick for the one build; the harness and SQUADS_DEFAULTS stay off): a squad knows only what its men's senses and its net's check tell it, and a contact call takes a beat. ?radiocheck=0 = off for the visit; ?radiocheck (plain) / =drop / =eyes / =call-noask / =net: that value
/** the page's opening, for a harness stood up as the page is (src/host/profile.ts shippedBoot): `squadSenses('call')` is the line above with no ?radiocheck in the URL */
export const squadSenses = senses;
try { const e = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SQUADS; const t = e ? e.toLowerCase().split(/[\s,+]+/) : [];   // (the harness: SQUADS=radiocheck in the environment — a tool with no --set of its own; radiocheck-drop / radiocheck-eyes: one piece)
  if (t.includes('radiocheck-net')) senses('net'); else if (t.includes('radiocheck-call')) senses('call'); else if (t.includes('radiocheck-call-eyes')) senses('call-eyes'); else if (t.includes('radiocheck-call-noask')) senses('call-noask'); else if (t.includes('radiocheck')) senses(''); else if (t.includes('radiocheck-drop')) senses('drop'); else if (t.includes('radiocheck-eyes')) senses('eyes'); } catch { /* no process (the page) */ }

type Def = RoomFight['defs'][number];
type Room = NonNullable<Def['room']>;
export type SquadChoice = 'barricade' | 'flank' | 'help';
type SquadState = 'hold' | 'alerted' | 'contact' | SquadChoice | 'down';
interface Fix { at: Vec3; t: number; ally: Squad | null; by: 'net' | 'ears' }
interface Sent { gd: Guard; role: 'help' | 'flank' | 'reinforce' | /** (drillLook) one of a pair gone to look where the team was last put */ 'look'; phase: 'run' | 'set' | 'loose'; /** (goRound) the room is lost: he holds the door from his spot, he does not go in */ hold?: boolean; spot: Vec3 | null; door: Door | null; fixAt: Vec3; tries: number; stepT: number; t0: number; /** when he got to his spot unseen (goRound) */ there?: number; /** (goRound) the marks of his way still ahead of him, his spot the last */ way?: Vec3[]; /** (goRound) what he watches, holding a door */ aim?: Vec3; /** (goRound) since when he has held where he is */ setT?: number; /** the post he left when he was sent */ from: Vec3; /** (drillBack) the squad he went round for, when he first knew it was not answering, and that he is on his way back to his post */ ally?: Squad | null; goneT?: number; back?: boolean }
/** one row of a squad's timeline (the tally's and the page's): what it did, when, with how many men at home, and why in a few words */
export interface SquadEvent { t: number; what: 'contact' | 'reinforce' | SquadChoice | 'in position' | 'met' | 'lost' | 'quiet' | 'down' | 'rally' | 'stays' | 'follows' | 'back' | 'sweep' | 'check' | 'asks' | 'looks' | 'found' | 'no sign' | 'glimpse' | 'calls' | 'cut off' | 'said' | 'net check' | 'net query' | 'net asks' | 'net looks' | 'net help'; n: number; why: string }
/** (radioCheck) a squad's net check: when the next is due, the one running (called → asked by name), the men who went quiet in its rooms (where, when, and
 *  what small sounds each mate had heard by then), the ones whose fate it knows (`known`: seen down) or has given up asking for (`looked`: looked for at his
 *  post and not found — a body seen later is still seen), and the men out looking */
interface Check { nextAt: number; stage: 'idle' | 'called' | 'asked'; t0: number; caller: Guard | null; who: Guard | null; silent: Quiet[]; known: Set<Guard>; looked: Set<Guard>; look: Looker[]; n: number; /** its own dice (checkDice) */ die: Die; /** (callCutAsk) men whose call broke off, still to be asked for by name: no sooner than `at` */ cut?: { who: Guard; at: number }[]; /** (callCutAsk) the routine check's own time, kept while `nextAt` is pulled in for a man on `cut` — put back if he comes on the net again before he is asked for */ beat?: number; /** (callCutAsk) a mate's call held up an ask that was due: the men go no sooner after it than after any ask */ late?: boolean; /** (callCutAsk) men a 'cut off' row has said will be asked for and who have not been yet: the trace says so if contact comes first */ promised?: Set<Guard>; /** (callCutAsk) men who stopped being lookers by their own eyes, away from the post they left (`from`): taken there, they are filed there */ afield?: Map<Guard, Vec3>; /** (netAsk) men of its own it has sent to look (for a mate, or at another squad's posts): one of them off the net with his end unknown is a man it is still waiting for */ out?: Set<Guard>; /** (netAsk) men of its own asked for by name who did not answer */ asked?: Set<Guard>; /** (netAsk) men the net has sent from this squad: the squad they went to look at, the post they were sent to, when */ netOut?: Map<Guard, { about: Squad; at: Vec3; t: number }>;
  /** the one running was started by `caller`'s own ears (he heard something where `who` stands): it is his to ask, and it dies with him */ byEar: boolean; /** when it last ran (a gap = the switch was off meanwhile: the check starts over) */ tickT: number }
interface Quiet { gd: Guard; at: Vec3; t: number; heard: boolean; /** filed alive, in somebody's arm (dropped later, he is a new silence) */ held: boolean; small0: Map<Guard, number> }
/** a man walking to a silent mate's post, or back from it: `calm` = his post and how he held it when he left (he is put back on it as he was, wary — he saw nobody) */
interface Looker { gd: Guard; who: Guard; spot: Vec3; from: Vec3; back: boolean; tries: number; stepT: number; t0: number; /** the squad's news (Squad.newsT) as he set off */ news0: number; /** since when he has been looking about him at the post (or as near it as he got) */ lookT?: number; calm: Calm;
  /** (netAsk) he is another squad's man, sent by the net to look at THIS squad's posts: any body of it in his eye is what he has found */ about?: Squad; /** (netAsk) the whole squad is not answering (not one man of it asked for by its last man): he turns back when anybody of it answers */ all?: boolean; /** (netAsk) the posts still ahead of him after `spot` */ stops?: Vec3[]; /** (netAsk) frames walked (his eyes on the way are asked ten times a second) */ n?: number }
/** (callBeat) one man's contact call on the air: the squad's when it ends (`end`), nobody's if he is cut off first. `at` / `room` = where he puts the team
 *  (kept to his latest sighting), or where the body lies; `body` = the mate he has seen down; `eyes` = he has had the team itself in his eye */
interface Call { by: Guard; t0: number; end: number; at: Vec3; room: StructureRoom | null; body: Guard | null; eyes: boolean }
interface Calm { state: Guard['state']; awareness: number; hold: boolean; pinned: boolean; station: Vec3; home: Vec3; room: Def['room']; ev: number[]; watch: number; want: number; pt: Vec3 }
interface Squad {
  def: SquadData; name: string; rooms: StructureRoom[]; men: Guard[]; barricade: Set<string>;
  state: SquadState; /** its last choice, whatever has happened to it since */ state0: SquadChoice | null; fix: Fix | null;
  newsT: number; decideAt: number; decidedAt: number; contactT: number; calledT: number; calledRoom: StructureRoom | null; fallen: Set<Guard>;
  /** stood to on a noise nobody could place: its next word, on a contact call, comes without the thinking beat */
  ready: boolean;
  /** (drillOwn) when it last said a room of its own is gone */ ownSaid?: number; stayed?: Set<string>;
  /** the room of its own the team was last met in (where a squad coming round to it is going) */ hitRoom: StructureRoom | null;
  /** (radioCheck) made on the squad's first tick with the switch on */ rc?: Check;
  /** (callBeat) the calls its men have on the air, and the dice their lengths are drawn on (made at the first call) */ calls?: Call[]; callDie?: Die;
  /** (callCutAsk) men whose call broke off while they were blinded or reeling — on the net still, so nobody asked: one who goes off it inside HUNG_SECS without having keyed up again is asked for after all */ hung?: { who: Guard; t: number }[];
  /** when its trouble was last on the air with no word of how it ended (a call cut off, a man asked for by name, men sent to a post) — what the other squads heard (read only by netAsk) */ trouble?: number;
  /** (netAsk) a squad is not answering the net: stood to, and counting its own men at the quicker beat */ wary?: boolean; /** (callCutAsk) the dice the beat before a cut-off caller is asked for is drawn on — its own, so the call lengths of a run do not depend on whether anybody asks */ askDie?: Die;
  sent: Sent[]; /** (goRound) men who went round and are home again, wherever that is: the timeline still says if one goes down */ went: Sent[]; due: { gd: Guard; at: Vec3; t: number; /** the room of the squad's he is wanted in */ room?: StructureRoom | null }[]; events: SquadEvent[];
}
interface State { /** (stayask.ts) every squad here stays in its rooms: the net's ask runs whatever its switch says, and a squad that stays sends one man to a silent squad's posts */ stayAsk?: boolean; S: StructureData; squads: Squad[]; of: Map<Guard, Squad>; net: { t: number; squad: Squad; at: Vec3; /** the door of its room the team was met at (goRound; null: a man dropped and nobody saw by which) */ door: Door | null }[]; /** (netAsk) made on the first tick with the switch on */ nc?: NetCheck; /** (drillLook) the newest word the garrison has of the team — when, where — and the word the last look went out on */ word?: { t: number; at: Vec3; done: number; /** when a look was last called · a man of a look went down out there (no squad sends another this fight) · the men of the last look while any is still out · the look called and not yet gone */ saidT: number; lost: boolean; out: Guard[] | null; call: { Q: Squad; go: Def[]; at: Vec3; goT: number; w: number } | null } }
/** (netAsk) the net's check of the SQUADS: when the next roll call is due, the one running (called → a squad asked for by name), who asks, the squad asked
 *  about, the squads nobody asks after again (`done`: men went to its posts — whatever they found — or a body of it was said on the net with nobody of it left to answer) */
interface NetCheck { nextAt: number; stage: 'idle' | 'called' | 'asked'; t0: number; caller: Guard | null; about: Squad | null; done: Set<Squad>; /** squads asked for by name with nobody sent after (nobody free, or a fight took the net): asked for once more at a later check, and no oftener */ tried: Map<Squad, number>; /** how often a squad that answers has been asked what is going on */ queried: Map<Squad, number>; /** lines said a breath after what they answer */ say: { t: number; gd: Guard; text: string; cls?: number }[]; die: Die; tickT: number }
const STATES = new SideMap<Game, State>('enemysquads.STATES');
/** the net's ask runs on this floor: its own switch, or (stayask.ts) a floor whose every squad stays in its rooms */
const netAsks = (g: Game): boolean => SQUADS.netAsk || !!STATES.get(g)?.stayAsk;
/** hard on a squads level (SQUADS.drill*): the table while harder defenders are on, their `squadDrill` row is, and squads are staged in this game — else null */
/** WHAT HARD IS ON ONE SQUAD MAP, by its structure's name (`scenarios.roomClear.name`): rows of the drill read in place of SQUADS' own while
 *  `SQUADS.drillByMap` is on. A map not named here gets the table's rows. Record: rebuild/hard-everywhere/round2-squad-maps.md */
export const DRILL_AT: Record<string, Partial<Pick<typeof SQUADS, 'drillNet' | 'netK' | 'reinforceK' | 'drillAngles' | 'drillReact' | 'reactK' | 'drillNerve' | 'nerveK' | 'drillFollow' | 'followM' | 'drillOwn' | 'ownUp' | 'drillBack' | 'backBeat' | 'drillLook' | 'sweepSecs' | 'sweepMen' | 'sweepBeat' | 'sweepStayers'>>> = {
  // the squads let the team commit: the pair is set at the other door while the team is still going in (from the threshold 223 of 576 teammates up against 293)
  'the block, three squads': { drillNet: true, netK: 2, reinforceK: 2, drillOwn: false, drillBack: false },
  // nothing on: standard is the floor here already (from the threshold 103 of 576 up, 55 of 144 won), and the squads' wait helps the team (a waiting squad is slower onto its own doors)
  'the warehouse': { drillNet: false, drillOwn: false, drillBack: false },
  // nothing on: four squads of two, each in its one room and none may leave it, so there is nobody to hold back on the net and no pair to send (hard was standard's run
  // on every seed measured with these rows at the defaults too: the row says what the card says)
  'the block': { drillNet: false, drillOwn: false, drillBack: false },
  // a hit squad's men come quicker (x0.75), and nobody is fed into a room with none of his squad up in it: the rooms are held when the team gets to them
  'the compound': { drillNet: true, netK: 1, reinforceK: 0.75, drillOwn: true, ownUp: 1, drillBack: false },
  // a pair holding a lost room's other door goes back to its own posts when the squad it went round for stops answering (at standard it died on that door,
  // in the open, 96 times of 96 and killed 2 teammates of 100); the slow net does nothing here, its pair is set in time at standard already
  'the barracks': { drillNet: false, drillOwn: false, drillBack: true, backBeat: 3 },
};
/** where the game stands: its room clear structure's name ('' = no squads staged) */
export function squadsWhere(g: Game): string { return STATES.get(g)?.S.name ?? ''; }
export function squadDrill(g: Game): typeof SQUADS | null {
  const st = STATES.get(g); if (!st || !PRESSURE.on || !PRESSURE.squadDrill) return null;
  const at = SQUADS.drillByMap ? DRILL_AT[st.S.name] : undefined; if (!at) return SQUADS;
  return { ...SQUADS, ...at };   // (made per read: either table may be edited in place by a probe or the panel)
}
/** the panel's line: which of the drill's rules hard has on where the game stands ('' = no squads staged) */
export function squadDrillWords(g: Game): string {
  const st = STATES.get(g); if (!st) return '';
  const K = squadDrill(g); if (!K) return `${st.S.name}: standard squads`;
  const on = [K.drillNet && K.netK !== 1 && `let you commit first (× ${K.netK} net)`, K.drillNet && K.reinforceK !== 1 && `own men's beat × ${K.reinforceK}`, K.drillOwn && `no man fed into a lost room (mates up ${K.ownUp})`, K.drillAngles && 'hold their angles', K.drillReact && `quicker off the mark (× ${K.reactK})`, K.drillNerve && `steadier under a bang (× ${K.nerveK})`, K.drillFollow && !K.drillBack && 'pair follows the next entry', K.drillBack && 'pair gets back on its own doors', K.drillLook && PRESSURE.sweep && 'a pair goes to look when you go quiet'].filter(Boolean);
  return `${st.S.name}: hard = ${on.length ? on.join(' · ') : 'standard (no rule on here)'}${SQUADS.drillByMap && DRILL_AT[st.S.name] ? ' — this map\'s own set' : ''}`;
}
/** roomfight.ts: the defenders' row of FIGHT_SKILL as a drilled garrison has it (drillReact · drillNerve) — `base` itself, the same object, whenever
 *  squadDrill is null or neither is on. (drillAngles is read where the wandering eye is rolled: roomfight.ts applyWatch) */
export function squadSkill(g: Game, base: FightSkill): FightSkill {
  const K = squadDrill(g); if (!K || !(K.drillReact || K.drillNerve)) return base;
  const rk = K.drillReact ? K.reactK : 1, nk = K.drillNerve ? K.nerveK : 1, x = (r: [number, number], k: number): [number, number] => [r[0] * k, r[1] * k];
  return { ...base, react: x(base.react, rk), surprise: x(base.surprise, rk), bangBreak: base.bangBreak * nk, daze: x(base.daze, nk) };   // (made per read: the table under it may be edited in place by a probe or the panel)
}

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const pick = (r: [number, number]) => r[0] + simRandom() * (r[1] - r[0]);
const alive = (gd: Guard) => gd.state !== 'dead' && !runnerFled(gd);   // (runner.ts: a man who dropped it and ran is no man of his squad's any more)
const grown = (b: StructureRoom['bounds'], m: number) => ({ x0: b.x0 - m, x1: b.x1 + m, z0: b.z0 - m, z1: b.z1 + m });
const roomOf = (Q: Squad, p: Vec3, m = 0) => Q.rooms.find(r => inBounds(p, m ? grown(r.bounds, m) : r.bounds)) ?? null;
const note = (g: Game, gd: Guard | null, what: string) => { const L = g.fight.log; L.push({ t: g.time, who: gd ? gd.callsign : '-', what: `[squads] ${what}` }); if (L.length > 600) L.splice(0, 200); };
/** every half metre along a path, its corners included (a path's waypoints are corners: what a leg passes is asked of the leg); returns its length */
function along(from: Vec3, path: Vec3[], each: (p: Vec3, s: number) => void): number {
  let q = from, run0 = 0;
  for (const w of path) { const L = flat(q, w), n = Math.max(1, Math.ceil(L / 0.5)); for (let i = 1; i <= n; i++) each([q[0] + (w[0] - q[0]) * i / n, 0, q[2] + (w[2] - q[2]) * i / n], run0 + L * i / n); run0 += L; q = w; }
  return run0;
}
const pathLen = (from: Vec3, path: Vec3[]) => along(from, path, () => { });

// ---------------------------------------------------------------- staging
/** roomclear.ts onStaged: the squads of this staging — each defender is the squad's whose room he was dealt into (`rooms[i]` = defender i's room id). A
 *  structure with no squads block, or the switch off, stages none (and drops any from the last staging). */
export function squadsStage(g: Game, S: StructureData | null, hostiles: Guard[], rooms: string[]) {
  STATES.delete(g);
  if (!SQUADS.on || !S?.squads?.length) return;
  const squads: Squad[] = [], of = new Map<Guard, Squad>();
  for (const def of S.squads) {
    if (def.arrive) continue;   // (late squads: not built — see the file head)
    const mine = S.rooms.filter(r => def.rooms?.includes(r.id)), men = hostiles.filter((_, i) => def.rooms?.includes(rooms[i]));
    const Q: Squad = { def, name: def.name ?? def.id, rooms: mine, men, barricade: new Set(squadBarricade(def, S.rooms)),
      state: 'hold', state0: null, fix: null, newsT: -100, decideAt: 0, decidedAt: -100, contactT: -100, calledT: -100, calledRoom: null, fallen: new Set(), ready: false, hitRoom: null, sent: [], went: [], due: [], events: [] };
    squads.push(Q); for (const m of men) of.set(m, Q);
  }
  if (squads.length) STATES.set(g, { S, squads, of, net: [], stayAsk: stayAskHere(g, squads.map(Q => Q.def)) });
}
/** the staging is gone (roomclear.ts clear) */
export function squadsStop(g: Game) {
  // (radioCheck: its body tests ask the light meter and the smoke about the squad's own men by id, and unit ids are dealt again — the next cast is not read by
  // the light, or through the smoke, the last one's bodies lay in. Only a staging the switch ran in: with it off these keys are left as they always were)
  const st0 = STATES.get(g);
  for (const Q of st0?.squads ?? []) if (Q.rc) for (const a of Q.men) { g.lightForget(`bodyL${a.char.id}`); for (const b of Q.men) if (b !== a) g.lightForget(`bodyS${b.char.id}_${a.char.id}`); }
  if (st0?.nc) for (const Q of st0.squads) for (const a of Q.men) { g.lightForget(`bodyL${a.char.id}`); for (const X of st0.squads) if (X !== Q) for (const b of X.men) g.lightForget(`bodyS${b.char.id}_${a.char.id}`); }   // (netAsk: a man sent to another squad's posts asked the same of ITS bodies)
  STATES.delete(g); CTX = null;
}
/** squads are on the floor in this game right now */
export function squadsLive(g: Game): boolean { return STATES.has(g); }
/** the squad a man is of — its record as the level wrote it and its men in their staged order (morale.ts: who is green, who leads); null = not a squad's man */
export function squadOf(g: Game, gd: Guard): { def: SquadData; men: Guard[] } | null { return STATES.get(g)?.of.get(gd) ?? null; }

// ---------------------------------------------------------------- the seams (each a return on its first line with no squads staged)
/** roomfight.ts rally · pressure.ts consider: he is a squad's man — whether he leaves his room for a fight elsewhere is his squad's call, not his own */
export function squadOwns(g: Game, gd: Guard): boolean { const st = STATES.get(g); return !!st && st.of.has(gd); }
/** digin.ts think: his squad has heard and not yet said what it does, or he is one of its men about to go — he does not start on his door yet */
export function squadDefers(g: Game, gd: Guard): boolean {
  const Q = STATES.get(g)?.of.get(gd); if (!Q) return false;
  return Q.state === 'alerted' || Q.due.some(d => d.gd === gd) || SQUADS.goRound && Q.sent.some(s => s.gd === gd && s.role === 'flank' && s.phase !== 'loose') || !!Q.rc?.look.some(l => l.gd === gd);   // (goRound: on his way round, or holding the door he was sent to hold — his squad's man, not his room's)
}
/** digin.ts startBrace: may his squad wedge this door (its `barricade` list; a man of no squad: yes, as ever) */
export function squadMayWedge(g: Game, gd: Guard, d: Door): boolean { const Q = STATES.get(g)?.of.get(gd); return !Q || Q.barricade.has(d.def.name); }
/** roomfight.ts breakOff · pressure.ts lastMan: his squad's men stay in its rooms (`mayLeave: false`) — he gives no room up through a door */
export function squadStaysIn(g: Game, gd: Guard): boolean { return STATES.get(g)?.of.get(gd)?.def.mayLeave === false; }
/** roomfight.ts breakOff: where a man who gives ground goes when his squad has a rally point in ANOTHER room of its own than the one he is in, the team is
 *  not known to be in that room, and he can reach it without passing what he is giving ground to — the spot (a free one beside it when a mate is on it), or
 *  null: the room fight's own answer */
export function squadRally(g: Game, gd: Guard, threat: Vec3): Vec3 | null {
  const st = STATES.get(g), Q = st?.of.get(gd); if (!st || !Q || !Q.def.rally) return null;
  const c = gd.char, R = Q.def.rally, here = roomOf(Q, c.pos), there = roomOf(Q, R);
  if (!there || here === there || flat(R, threat) < 4 || teamKnown(g).some(p => inBounds(p, grown(there.bounds, 1)))) return null;
  const nav = g.col.nav;
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
    const p: Vec3 = [R[0] + dx * 0.9, 0, R[2] + dz * 0.9];
    if (nav.isBlocked(p[0], p[2]) || !inBounds(p, there.bounds) || Q.men.some(m => m !== gd && alive(m) && flat(m.char.pos, p) < 0.8)) continue;
    const path = nav.findPath(c.pos, p); if (!path?.length) continue;
    let toward = false; const L = along(c.pos, path, q => { if (flat(q, threat) < 2) toward = true; });
    if (toward || L > 30) continue;
    event(g, Q, 'rally', `${gd.callsign} gives ground to the rally point`);
    return p;
  }
  return null;
}

// ---------------------------------------------------------------- the men
const defOf = (g: Game, gd: Guard): Def | undefined => g.fight.defs.find(D => D.gd === gd);
/** his own wits about him: alive, not in Sam's arm, not blinded or reeling */
const fit = (g: Game, m: Guard) => alive(m) && !m.held && g.time >= m.dazzledUntil && g.time >= m.staggerUntil && !runnerOwns(m);   // (runner.ts, false with its switch off: from his shout on he makes no call on the squad's net — his own words stand)
/** laststand.ts: his squad has him out on a leg, or is about to send him (he is not free to be sent anywhere else) */
/** (the dialogue pass, tactics.ts flankCall) when this man was sent to look where the team was last put (drillLook: his `sent` row's `t0`), or null. Words only. */
export function squadLookSince(g: Game, gd: Guard): number | null { const s = STATES.get(g)?.of.get(gd)?.sent.find(x => x.gd === gd && x.role === 'look'); return s ? s.t0 : null; }
export function squadBusy(g: Game, gd: Guard): boolean { const Q = STATES.get(g)?.of.get(gd); return !!Q && (Q.sent.some(s => s.gd === gd) || Q.due.some(d => d.gd === gd)); }
/** laststand.ts: is this point in one of his squad's rooms (a squad whose men stay in its rooms gathers only inside them; no squad = anywhere) */
export function squadHolds(g: Game, gd: Guard, p: Vec3): boolean { const Q = STATES.get(g)?.of.get(gd); return !Q || Q.rooms.some(r => p[0] >= r.bounds.x0 && p[0] <= r.bounds.x1 && p[2] >= r.bounds.z0 && p[2] <= r.bounds.z1); }
/** a squad's men at home and free to be told something: fit, holding a post, nobody of the team in their sight these two seconds, not already sent */
function home(g: Game, Q: Squad): Def[] {
  const out: Def[] = [];
  for (const m of Q.men) { if (!fit(g, m) || g.time - m.lastSeenT < 2 || Q.sent.some(s => s.gd === m) || lastStandMan(g, m) || Q.rc?.look.some(l => l.gd === m)) continue;   // (laststand.ts: a man of the last stand is not the squad's to send)
    if (netFeedHolds(m)) continue;   // (netquiet.ts, through netquietfeed.ts — false on its first line with its switch off: the last man up, at his act, is not the squad's to send to a room nobody of his is left in)
    const D = defOf(g, m); if (D && D.mode === 'hold' && D.rallyAt !== Infinity) out.push(D); }
  return out;
}
// (a man is sent with pressure.ts's own two hand-overs: `loose` = off his post onto the fight AI's hunt, as the stock rally hands him over; `run` = a leg on a
// script with his own senses under it — roomfight.ts tickMove: an enemy seen close stops him to fight; there, or going nowhere, he plants)
/** what the net told a man who did not hear it himself: where the team is — the room fight's own record of a noise outside his room, which is what digin.ts
 *  reads to get him ready (his own ears' record, when it is fresh, is left as it is) */
function tell(g: Game, D: Def, at: Vec3) {
  if (D.noiseAt && D.noiseOut && g.time - D.noiseT < 4) return;
  D.noiseAt = v3.copy(at); D.noiseT = g.time; D.noiseOut = true;
}
/** WHERE THE TEAM IS, as far as the defenders know: where each living man of theirs last had one of the team in his sight, or last heard a loud thing —
 *  these few seconds. Never the team's true positions */
function teamKnown(g: Game): Vec3[] {
  const out: Vec3[] = [];
  for (const D of g.fight.defs) {
    const gd = D.gd; if (!alive(gd)) continue;
    if (g.time - gd.lastSeenT < 4 && gd.lastKnown && gd.lastKnown !== D.pt) out.push(gd.lastKnown);
    if (D.noiseAt && g.time - D.noiseT < 4) out.push(D.noiseAt);
  }
  return out;
}

// ---------------------------------------------------------------- the way round
interface Way { spot: Vec3; door: Door | null; L: number; /** (goRound) the way itself, a mark every few metres: he is walked along IT — a bare goal is run to by the shortest path, which is the one past the team */ path?: Vec3[]; /** (goRound) the outside of the door it leads to: what a man holding that door watches */ aim?: Vec3 }
/** A flanker's way to a fix: to a door of the room it is in that the team is NOT known to be at, on a path that neither crosses that room nor passes where
 *  the team was last seen or heard — the shortest such, off any spot in `used`; for a fix on open floor, a way that keeps off the straight one, to a spot a
 *  few strides short of it. null = no such way inside the limits (pressure.ts's own: flankMaxM, flankK, flankSlackM). */
function wayRound(g: Game, D: Def, at: Vec3, known: Vec3[], taken: Door[], used: Vec3[]): Way | null {
  const nearFoe = (p: Vec3, m: number) => known.some(f => flat(f, p) < m);
  const nav = g.col.nav, F = g.fight, c = D.gd.char, K = PRESSURE;
  const T = F.roomAt(at) as Room | null, cell = (p: Vec3) => nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell));
  const within = (L: number, L0: number) => L <= Math.min(K.flankMaxM, Math.max(K.flankK * L0, L0 + K.flankSlackM));
  // nav.idx does not check its column: a cell off the grid's east or west edge is another row's cell at the far edge, and got that cell's price. Kept out
  // with goRound on; off, the rule is left exactly as it was, that included (a place known within 4 m of the edge prices a strip of the far edge)
  const inG = (ix: number, iz: number) => !SQUADS.goRound || ix >= 0 && iz >= 0 && ix < nav.W && iz < nav.H;
  if (T && T !== D.room && T.cells.size <= 500 && T.entries.length > 1) {
    const cost = new Map<number, number>();   // the fight's room is not a corridor · where the team is known to be is not a way · a room his side holds (and may have wedged) is one only for want of another
    for (const X of F.defs) if (alive(X.gd) && X.mode === 'hold' && X.room && X.room !== T && X.room !== D.room && X.room.cells.size <= 500) for (const i of X.room.cells) cost.set(i, 5);
    for (const f of known) { const fx = Math.floor(f[0] / nav.cell), fz = Math.floor(f[2] / nav.cell), r = Math.ceil(4 / nav.cell); for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (dx * dx + dz * dz <= r * r && inG(fx + dx, fz + dz)) cost.set(nav.idx(fx + dx, fz + dz), 12); }
    for (const i of T.cells) cost.set(i, 40);
    const dear = (ix: number, iz: number) => cost.get(nav.idx(ix, iz)) ?? 1, ways: Way[] = [];
    let L0 = Infinity;   // his shortest way to any door of it, the team's own included: what 'round' is measured against
    for (const e of T.entries) {
      if (e.door.def.steel) continue;
      const fr = frameOf(e.door);
      for (const [depth, lat] of [[2.4, 1.2], [2.4, -1.2], [3.0, 1.6], [3.0, -1.6], [1.2, 1.7], [1.2, -1.7], [2.6, 0]]) {
        const p: Vec3 = [e.at[0] + e.out[0] * depth + fr.ux * lat, 0, e.at[2] + e.out[1] * depth + fr.uz * lat];
        if (nav.isBlocked(p[0], p[2]) || T.cells.has(cell(p)) || used.some(u => flat(u, p) < 1.2)) continue;
        const path = nav.findPath(c.pos, p, 6000, dear); if (!path?.length || flat(path[path.length - 1], p) > 0.8) continue;
        let bad = false; const L = along(c.pos, path, q => { if (T.cells.has(cell(q)) || nearFoe(q, 3)) bad = true; }); L0 = Math.min(L0, L);
        if (!bad && !nearFoe(p, 5) && !nearFoe([e.at[0] + e.out[0], 0, e.at[2] + e.out[1]], 4)) ways.push({ spot: p, door: e.door, L });
        break;
      }
    }
    ways.sort((a, b) => a.L - b.L);
    return ways.find(w => !taken.includes(w.door!) && within(w.L, L0)) ?? ways.find(w => within(w.L, L0)) ?? null;
  }
  // open floor: the straight way's middle is made dear, and what the search then finds is the way round — if it is one
  const P0 = nav.findPath(c.pos, at, 6000); if (!P0?.length) return null;
  const mid = new Set<number>(), r = 2;
  const L0 = pathLen(c.pos, P0); if (L0 < 12) return null;
  along(c.pos, P0, (p, s) => { if (s < 5 || s > L0 - 5) return; const x = Math.floor(p[0] / nav.cell), z = Math.floor(p[2] / nav.cell); for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (inG(x + dx, z + dz)) mid.add(nav.idx(x + dx, z + dz)); });
  const P1 = nav.findPath(c.pos, at, 8000, (ix, iz) => mid.has(nav.idx(ix, iz)) ? 8 : 1); if (!P1?.length) return null;
  const L1 = pathLen(c.pos, P1); if (!within(L1, L0)) return null;
  let on = 0, all = 0; const spots: Vec3[] = [];
  along(c.pos, P1, (p, s) => { all++; if (mid.has(cell(p))) on++; if (s <= L1 - 6 && !nav.isBlocked(p[0], p[2]) && !used.some(u => flat(u, p) < 1.2)) spots.push(p); });
  if (!spots.length || on / Math.max(1, all) > 0.35) return null;
  return { spot: spots[spots.length - 1], door: null, L: L1 };
}

/** teamKnown, each place with how well it is known (goRound): FIRM = a man of theirs had one of the team in his sight there, or heard a loud thing there
 *  through open air (his ears put that at its source: guards.ts hearingCheck); not firm = heard round a corner or through a wall (placed metres loose), or
 *  told over the net */
interface Known { p: Vec3; firm: boolean }
function teamKnownHow(g: Game): Known[] {
  const out: Known[] = [];
  for (const D of g.fight.defs) {
    const gd = D.gd; if (!alive(gd)) continue;
    if (g.time - gd.lastSeenT < 4 && gd.lastKnown && gd.lastKnown !== D.pt) out.push({ p: gd.lastKnown, firm: true });
    if (D.noiseAt && g.time - D.noiseT < 4) { const c = gd.char.pos; out.push({ p: D.noiseAt, firm: !g.col.solidBlocked([c[0], 1.5, c[2]], [D.noiseAt[0], 1, D.noiseAt[2]]) }); }
  }
  return out;
}
/** What a way round is judged against, built once a decision and shared by the men it sends (goRound): where the team's guns are as far as this side
 *  knows — the places it was seen or heard (`known`), the stack outside the door the net named (`rear`), and the room's own doorways from a man's place well
 *  inside (`mouths`: a door is a line of fire out of a room the team is in). `hot` = a man standing there is in front of one of them; `lane` = in a doorway's
 *  line whether its leaf is shut or not (a leaf is not a wall: the door a pair set off towards shut was open three seconds later, and the first man was shot
 *  11 m down its line by a man at the back of the room); `cost` = the search's price list (the fight's room all but shut, 4 m round every known place and
 *  the stack dear, a doorway's lane dear, a room somebody else of theirs holds a little dear — wayRound's, plus the lanes). */
interface RoundCtx { t: number; T: Room; key: string; rear: Vec3[]; mouths: Vec3[]; fire: (a: Vec3, b: Vec3) => boolean; hot: (p: Vec3) => boolean; hotCell: (ix: number, iz: number) => boolean; lane: (p: Vec3) => boolean; cost: Map<number, number>; held: Map<number, Room> }
let CTX: RoundCtx | null = null;
rollbackVar('enemysquads.CTX', () => CTX, v => { CTX = v; });   // (a memo keyed by the game's clock: a tick played again must not be handed the first playing's)
function roundCtx(g: Game, T: Room, known: Known[], theirs: Door[]): RoundCtx {
  const key = theirs.map(d => d.def.name).join('|') + '#' + known.length;
  if (CTX && CTX.t === g.time && CTX.T === T && CTX.key === key) return CTX;
  const nav = g.col.nav, F = g.fight, Q = SQUADS;
  const inGrid = (ix: number, iz: number) => ix >= 0 && iz >= 0 && ix < nav.W && iz < nav.H;
  const line = (a: Vec3, b: Vec3, y: number) => !g.col.shotBlocked([a[0], y, a[2]], [b[0], y, b[2]]);
  const fire = (a: Vec3, b: Vec3) => line(a, b, 1.5) || line(a, b, 1);   // (a head or a chest in the line)
  const open = (a: Vec3, b: Vec3) => { const dyn = g.col.dynamicBoxes; g.col.dynamicBoxes = []; try { return line(a, b, 1.5); } finally { g.col.dynamicBoxes = dyn; } };   // (the line with every leaf out of it)
  // where the team's own men stand outside the door it was met at: on its axis and either side of it, as a stack does (a place a man can stand, in view of the door)
  const rear: Vec3[] = [];
  for (const e of T.entries) if (theirs.includes(e.door)) {
    const fr = frameOf(e.door), o1: Vec3 = [e.at[0] + e.out[0], 0, e.at[2] + e.out[1]];
    for (const [depth, lat] of [[1, 0], [2.4, 0], [2.4, 1.2], [2.4, -1.2]]) { const r: Vec3 = [e.at[0] + e.out[0] * depth + fr.ux * lat, 0, e.at[2] + e.out[1] * depth + fr.uz * lat]; if (!nav.isBlocked(r[0], r[2]) && (depth === 1 || fire(o1, r))) rear.push(r); }
  }
  const cellOf = (p: Vec3) => { const ix = Math.floor(p[0] / nav.cell), iz = Math.floor(p[2] / nav.cell); return inGrid(ix, iz) ? nav.idx(ix, iz) : -1; };
  const mouths: Vec3[] = T.entries.map(e => { for (const d of [3, 2, 1.2]) { const m: Vec3 = [e.at[0] - e.out[0] * d, 0, e.at[2] - e.out[1] * d]; if (T.cells.has(cellOf(m))) return m; } return [e.at[0] - e.out[0] * 0.8, 0, e.at[2] - e.out[1] * 0.8]; });
  const ajar = mouths.filter((m, k) => { const e = T.entries[k]; return fire(m, [e.at[0] + e.out[0], 0, e.at[2] + e.out[1]]); });   // (the doorways with a line out through them now)
  const hot = (p: Vec3) => known.some(k => { const d = flat(k.p, p); return d < (k.firm ? Q.fireM : Q.softM) && (d < 0.6 || fire(k.p, p)); }) || rear.some(r => { const d = flat(r, p); return d < Q.rearM && (d < 0.6 || fire(r, p)); })
    || ajar.some(m => flat(m, p) < Q.fireM && fire(m, p));   // (a door standing OPEN: a shut one's lane is dear to the search, not shut to it)
  const hotAt = new Map<number, boolean>();   // (asked once a cell, as a search reaches it)
  const hotCell = (ix: number, iz: number) => { if (!inGrid(ix, iz)) return false; const i = nav.idx(ix, iz); let h = hotAt.get(i); if (h === undefined) { h = hot([(ix + 0.5) * nav.cell, 0, (iz + 0.5) * nav.cell]); hotAt.set(i, h); } return h; };
  const lane = (p: Vec3) => mouths.some(m => flat(m, p) < Q.mouthM && open(m, p));
  const cost = new Map<number, number>(), dearer = (ix: number, iz: number, c: number) => { if (!inGrid(ix, iz)) return; const i = nav.idx(ix, iz); if ((cost.get(i) ?? 1) < c) cost.set(i, c); };
  for (const f of [...known.map(k => k.p), ...rear]) { const fx = Math.floor(f[0] / nav.cell), fz = Math.floor(f[2] / nav.cell), r = Math.ceil(4 / nav.cell); for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (dx * dx + dz * dz <= r * r) dearer(fx + dx, fz + dz, 12); }
  T.entries.forEach((e, k) => {   // the fan a man 3 m inside has through the opening, out to mouthM
    const fr = frameOf(e.door), m = mouths[k];
    for (let d = 0.5; d <= Q.mouthM; d += nav.cell) { const w = 0.75 + 0.2 * d; for (let l = -w; l <= w; l += nav.cell) { const q: Vec3 = [e.at[0] + e.out[0] * d + fr.ux * l, 0, e.at[2] + e.out[1] * d + fr.uz * l]; if (!nav.isBlocked(q[0], q[2]) && open(m, q)) dearer(Math.floor(q[0] / nav.cell), Math.floor(q[2] / nav.cell), flat(m, q) < Q.fireM ? 25 : 8); } }
  });
  for (const i of T.cells) cost.set(i, 40);
  const held = new Map<number, Room>();   // (a room somebody of theirs holds: ×5 to everybody but its own men)
  for (const X of F.defs) if (alive(X.gd) && X.mode === 'hold' && X.room && X.room !== T && X.room.cells.size <= 500) for (const i of X.room.cells) held.set(i, X.room as Room);
  return CTX = { t: g.time, T, key, rear, mouths, fire, hot, hotCell, lane, cost, held };
}
/** wayRound with SQUADS.goRound on. A door of the fight's room is the TEAM'S when the net named it (`theirs`), or when a firm place is within 4 m of its
 *  outside with nothing between; nobody named a door: the old 4 m from anything known, walls or not (by ear alone two doors of a small room cannot be told
 *  apart). A SPOT outside another door is no good in front of a gun (RoundCtx.hot); the PATH to it is searched with every such cell all but shut, and is no
 *  good if it still crosses one. Every spot outside a door is tried. `back` > 0 (the room is lost: he is to hold the door, not go in by it): where his way
 *  would cross open ground in a doorway's lane he stops short of it, with a line on the door. The length limits are wayRound's, against the plain way's
 *  length. The way itself comes back as marks a few metres apart: he is walked along it. */
function wayRound2(g: Game, D: Def, at: Vec3, known: Known[], theirs: Door[], taken: Door[], used: Vec3[], back = 0): Way | null {
  const nav = g.col.nav, c = D.gd.char, K = PRESSURE;
  const T = g.fight.roomAt(at) as Room | null, cell = (p: Vec3) => nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell));
  if (!(T && T !== D.room && T.cells.size <= 500 && T.entries.length > 1)) return wayRound(g, D, at, known.map(k => k.p), taken, used);   // (open floor: as it was)
  const within = (L: number, L0: number) => L <= Math.min(K.flankMaxM, Math.max(K.flankK * L0, L0 + K.flankSlackM));
  const X = roundCtx(g, T, known, theirs), { fire, hot, hotCell, lane } = X, ways: Way[] = [];
  const dear0 = (ix: number, iz: number) => { const i = nav.idx(ix, iz), h = X.held.get(i); return Math.max(X.cost.get(i) ?? 1, h && h !== D.room ? 5 : 1); };
  const dear = (ix: number, iz: number) => hotCell(ix, iz) ? 200 : dear0(ix, iz);
  // how far the room is by the plain way, guns or no guns, to the door that way comes in by: what 'too far round' is measured against
  let L0 = Infinity; { const p0 = nav.findPath(c.pos, at, 6000, dear0); if (p0?.length) { let inT = false; L0 = 0; along(c.pos, p0, (q, s) => { if (!inT) { if (T.cells.has(cell(q))) inT = true; else L0 = s; } }); } }
  const outOf = (e: Room['entries'][number]): Vec3 => [e.at[0] + e.out[0], 0, e.at[2] + e.out[1]];
  for (const e of [...T.entries].sort((a, b) => flat(c.pos, outOf(a)) - flat(c.pos, outOf(b)))) {   // (nearest first, and a way by a door his mate has not taken is enough: each is a search of the floor)
    if (e.door.def.steel) continue; if (ways.some(w => !taken.includes(w.door!))) break;
    const fr = frameOf(e.door), outside = outOf(e);
    if (theirs.includes(e.door) || known.some(k => k.firm && flat(k.p, outside) < 4 && fire(k.p, outside)) || !theirs.length && known.some(k => flat(k.p, outside) < 4)) continue;   // (the team's door)
    for (const [depth, lat] of [[2.4, 1.2], [2.4, -1.2], [3.0, 1.6], [3.0, -1.6], [1.2, 1.7], [1.2, -1.7], [2.6, 0]]) {
      const p: Vec3 = [e.at[0] + e.out[0] * depth + fr.ux * lat, 0, e.at[2] + e.out[1] * depth + fr.uz * lat];
      if (nav.isBlocked(p[0], p[2]) || T.cells.has(cell(p)) || used.some(u => flat(u, p) < 1.2)) continue;
      if (hot(p)) continue;
      const path = nav.findPath(c.pos, p, 6000, dear); if (!path?.length || flat(path[path.length - 1], p) > 0.8) continue;
      let bad = false; const pts: { q: Vec3; s: number }[] = [];
      const L = along(c.pos, path, (q, s) => { pts.push({ q, s }); if (T.cells.has(cell(q)) || s > 1 && hotCell(Math.floor(q[0] / nav.cell), Math.floor(q[2] / nav.cell))) bad = true; });   // (his first metre is where he stands now)
      if (bad) continue;
      // the room is lost and he is to HOLD its door, not go in by it. His way to the place beside it keeps out of every doorway's lane: that is his spot.
      // It does not (open ground in front of the door, no other way to it): he stops SHORT of the lane, at the last place before it with a line on the door
      // inside `back` metres — else the first such place in it — and covers the way out from there; he does not cross the ground in front of it
      let spot = p, Ls = L;
      if (back > 0) {
        const ok = (q: Vec3, s: number) => s >= 2 && L - s >= 3 && flat(q, outside) <= back && !nav.isBlocked(q[0], q[2]) && !used.some(u => flat(u, q) < 1.2) && fire(q, outside);
        const k = pts.findIndex(x => x.s > 1 && lane(x.q));
        if (k >= 0) {
          let j = -1; for (let i = k - 1; i >= 0 && pts[k].s - pts[i].s < 4; i--) if (ok(pts[i].q, pts[i].s)) { j = i; break; }
          if (j < 0) j = pts.findIndex((x, i) => i >= k && ok(x.q, x.s));
          if (j >= 0) { spot = pts[j].q; Ls = pts[j].s; }
        }
      }
      const marks = pts.filter((x, i) => x.s < Ls - 1.5 && x.s > 1.5 && i % 5 === 4).map(x => x.q); marks.push(spot);
      ways.push({ spot, door: e.door, L: Ls, path: marks, aim: outside }); break;
    }
  }
  ways.sort((a, b) => a.L - b.L);
  return ways.find(w => !taken.includes(w.door!) && within(w.L, L0)) ?? ways.find(w => within(w.L, L0)) ?? null;
}

// ---------------------------------------------------------------- the squad's word
function event(g: Game, Q: Squad, what: SquadEvent['what'], why: string, by: Guard | null = null) {
  Q.events.push({ t: g.time, what, n: home(g, Q).length, why }); if (Q.events.length > 240) Q.events.splice(0, 80);
  if (netAsks(g)) { if (what === 'asks' || what === 'looks' || what === 'cut off' || what === 'net help') Q.trouble = g.time; else if (what === 'no sign' || what === 'found' || what === 'contact' || what === 'said') Q.trouble = undefined; }   // (what the other squads heard of it, and whether they heard how it ended: a field nothing reads but netAsk)
  note(g, by, `${Q.name} ${what}: ${why}`);
  if (what === 'found') netFeedBody(g, by, Q.men);   // (netquiet.ts, filed through netquietfeed.ts — a return on its first line with its switch off: a body found shakes the finder, and less the men he tells)
}
/** the men who go: nearest the fight first, a man left in every room of the squad's that had one while that can be done */
function goers(H: Def[], at: Vec3, k: number): Def[] {
  const by = [...H].sort((a, b) => flat(a.gd.char.pos, at) - flat(b.gd.char.pos, at)), left = new Map<Room | null, number>(), out: Def[] = [];
  for (const D of H) left.set(D.room, (left.get(D.room) ?? 0) + 1);
  for (const D of by) { if (out.length >= k) break; if ((left.get(D.room) ?? 0) > 1) { out.push(D); left.set(D.room, left.get(D.room)! - 1); } }
  return out;
}
const COUNT = ['nobody', 'one', 'two', 'three', 'four'];
/** a mate's name IN THEIR MOUTHS (the dialogue pass, words.ts): 'Tango 8' is the team's word for a target, not what his own squad calls him — on their net he is his
 *  number ('Eight? … Eight, sound off'). Spoken strings only: the logs, the strip's own 'Tango 8:' prefix and every event row keep the callsign; a man the level named keeps his name */
const NUMBER = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen'];
export const mate = (m: Guard): string => WORDS.on ? m.callsign.replace(/^Tango (\d+)$/, (_s, n: string) => NUMBER[+n] ?? n) : m.callsign;
/** × a squad's beats on the net (SQUADS.drillNet: a drilled garrison's `netK`; 1 for anybody else) */
const stayKey = (gd: Guard, room: { name: string }) => `${gd.char.id}|${room.name}`;
const netK = (g: Game) => { const K = squadDrill(g); return K && K.drillNet ? K.netK : 1; };
/** × the beat of a hit squad's own men in its other rooms before they come (SQUADS.drillNet: `reinforceK`; 1 for anybody else) */
const ownK = (g: Game) => { const K = squadDrill(g); return K && K.drillNet ? K.reinforceK : 1; };
/** a squad that could send men out on a call now (decide()'s own first three tests): only such a squad has anything to wait FOR, so only it takes a drilled
 *  garrison's longer beat on the net and says so. One that stays in its rooms whatever is called answers as fast as at standard. */
function mayGo(g: Game, Q: Squad): boolean {
  if (Q.def.mayLeave === false || Q.sent.some(s => alive(s.gd))) return false;
  const H = home(g, Q); return H.length - new Set(H.map(D => D.room)).size >= 2;
}
function decide(g: Game, st: State, Q: Squad) {
  const K = SQUADS, fix = Q.fix!, H = home(g, Q), n = H.length;
  const before = Q.state0; Q.decidedAt = g.time; Q.state = 'hold'; Q.ready = false;
  if (!n) return;
  // WHO is being hit is the net's to say, not one man's ears: a squad in contact now (the one whose call is nearest what was heard), else the squad whose
  // room the noise was IN (it has not called it — yet, or ever); neither: the team is out on open floor
  let room: StructureRoom | null = null;   // the room a pair going round is going to: what the call named, or where the noise was
  { const live = st.squads.filter(X => X !== Q && X.state !== 'down' && (X.state === 'contact' || g.time - X.contactT < 6) && st.net.some(c => c.squad === X));
    const callOf = (X: Squad) => { for (let i = st.net.length - 1; i >= 0; i--) if (st.net[i].squad === X) return st.net[i].at; return fix.at; };
    if (live.length) { live.sort((a, b) => flat(callOf(a), fix.at) - flat(callOf(b), fix.at)); fix.ally = live[0]; fix.at = v3.copy(callOf(live[0])); room = live[0].hitRoom; }
    else if (fix.by === 'ears') { fix.ally = st.squads.find(X => X !== Q && !!roomOf(X, fix.at)) ?? null; room = fix.ally ? roomOf(fix.ally, fix.at) : null; }
    else room = fix.ally?.hitRoom ?? null; }
  const lead = H[0].gd, ally = fix.ally, allyUp = ally ? ally.men.filter(alive).length : 0;
  // which OTHER squads already have men out on this fight, and as what
  const near = (s: Sent) => s.role !== 'reinforce' && s.role !== 'look' && alive(s.gd) && flat(s.fixAt, fix.at) < 12;
  const there = st.squads.filter(X => X !== Q && X.sent.some(near)), theirs = there.length ? there[0].sent.find(near)!.role : null;
  const out = Q.sent.filter(s => alive(s.gd)).length;
  const rooms = new Set(H.map(D => D.room)).size, spare = n - rooms;   // (the men past one a room)
  const roundTo: Vec3 = room ? [(room.bounds.x0 + room.bounds.x1) / 2, 0, (room.bounds.z0 + room.bounds.z1) / 2] : fix.at;
  // (goRound) the room the fight is in is LOST, or as good as: nobody of the squad that held it is up in it, or one man is — the team has it, and its
  // other door is held from outside, not gone in by (two men through a door into four guns: 29 of 34 such men went down at it)
  const inRoom = room && ally ? ally.men.filter(m => alive(m) && roomOf(ally, m.char.pos, 0.05) === room).length : 0;
  const lost = K.goRound && K.holdLost && !!room && !!ally && inRoom < 2;
  const pair = () => {
    const go = goers(H, fix.at, Math.min(K.flankMen, spare)), taken: Door[] = [], used: Vec3[] = [];
    const known = K.goRound ? [] : teamKnown(g), how = K.goRound ? teamKnownHow(g) : [];
    // (goRound) the team's door: what the squad in contact said on the net, these thirty seconds
    const named = K.goRound && ally ? [...new Set(st.net.filter(c => c.squad === ally && c.door && g.time - c.t < 30).map(c => c.door!))] : [];
    const ways = go.map(D => { const w = K.goRound ? wayRound2(g, D, roundTo, how, named, taken, used, lost ? K.holdBackM : 0) : wayRound(g, D, roundTo, known, taken, used); if (w) { used.push(w.spot); if (w.door) taken.push(w.door); } return w; });
    const any = ways.find((w): w is Way => !!w);   // (a man with no way round of his own goes his mate's: they end up side by side, not on one cell)
    return any ? { go, ways: ways.map(w => w ?? any) } : { go: [], ways: [] };
  };
  let choice: SquadChoice = 'barricade', why = '', go: Def[] = [], ways: Way[] = [], stoodTo = false;
  if (Q.def.mayLeave === false) why = 'its men stay in its rooms';
  else if (out) why = 'its own men are still out';
  else if (spare < 2) why = `${n} at home in ${rooms} room${rooms > 1 ? 's' : ''}: nobody to spare`;
  else if (there.length >= 2) why = `${there.map(X => X.name).join(' and ')} are already out on it`;
  else if (ally && allyUp > 0) {
    // somebody to help. They can still hold the team where it is: a pair goes round. They are down to their last man, or there is no way round: straight to
    // them. A squad already on its way: this one does the other thing.
    const P = theirs !== 'flank' && (allyUp >= 2 || theirs === 'help' || K.goRound) ? pair() : null;
    if (P && P.go.length >= 2) { choice = 'flank'; go = P.go; ways = P.ways; why = theirs ? `${there[0].name} is going straight to ${ally.name}: this pair goes round` : lost ? `${ally.name} ${inRoom ? 'has one man left in' : 'has lost'} ${room!.name}: a pair goes round to hold its other door` : allyUp < 2 ? `${ally.name} is down to its last man: a pair goes round behind them` : `${ally.name} has ${allyUp} up to hold them: a pair goes round`; }
    else if (theirs === 'help') why = `${there[0].name} is already going to ${ally.name}, and no way round`;
    else { choice = 'help'; go = goers(H, fix.at, Math.min(K.helpMen, spare)); why = theirs ? `${there[0].name} is going round: this one goes straight to ${ally.name}` : allyUp < 2 ? `${ally.name} is down to its last man${K.goRound ? ', and no way round' : ''}` : `${ally.name} has ${allyUp} up, and no way round`; }
  } else if (ally) {
    const P = !there.length && n >= 4 ? pair() : null;
    if (P && P.go.length >= 2) { choice = 'flank'; go = P.go; ways = P.ways; why = `${ally.name} is not answering: a pair goes round to where it was, the rest lock down`; }
    else why = `${ally.name} is not answering${there.length ? ' and men are already out' : ''}`;
  } else {
    // the team heard on open floor, nobody in contact: the squad nearest the noise is the one it is coming to. Nobody walks out at a noise he cannot place
    // (two men against whoever made it, in the open): every squad gets on its doors, and has its answer ready for the call that says where they are
    let first: Squad | null = null, nd = Infinity;
    for (const X of st.squads) { const XH = X === Q ? H : home(g, X); if (!XH.length) continue; const d = Math.min(...XH.map(D => flat(D.gd.char.pos, fix.at))); if (d < nd) { nd = d; first = X; } }
    const P = K.openPair && first !== Q && !there.length ? pair() : null;
    if (!K.openPair) { Q.ready = true; stoodTo = first !== Q; why = first === Q ? 'the noise is nearest its own rooms: it is next' : `nobody has them in sight${first ? ` (nearest ${first.name})` : ''}: on its doors until somebody calls it`; }
    else if (first === Q) why = 'the noise is nearest its own rooms: it is next';
    else if (P && P.go.length >= 2) { choice = 'flank'; go = P.go; ways = P.ways; why = `the team is outside${first ? ' ' + first.name + "'s rooms" : ''}: a pair goes round to it`; }
    else why = there.length ? 'men are already out' : 'no way round to them';
  }
  if (choice !== 'barricade' && go.length < 2) { choice = 'barricade'; go = []; why += ' (nobody free to go)'; }
  Q.state = choice;
  const send = (D: Def, role: 'help' | 'flank', w: Way | null) => {
    Q.sent.push({ gd: D.gd, from: v3.copy(D.station), ally, role, phase: w ? 'run' : 'loose', spot: w ? w.spot : null, door: w ? w.door : null, fixAt: v3.copy(fix.at), tries: 0, stepT: -100, t0: g.time, hold: role === 'flank' && lost && !!w?.door, way: w?.path ? [...w.path] : undefined, aim: w?.aim });   // (his own copy: two men may have been given one way)
    if (w) run(g, D, w.path?.[0] ?? w.spot, w.door, 0.3); else loose(g, D, fix.at);
  };
  if (choice === 'help') {
    for (const D of go) send(D, 'help', null);
    g.say(go[0].gd, `${Q.name}: moving to ${ally ? ally.name : 'them'} — ${go.length} of us!`, true);
  } else if (choice === 'flank') {
    go.forEach((D, i) => send(D, 'flank', ways[i]));
    g.say(go[0].gd, `${Q.name}: ${COUNT[go.length] ?? go.length} going round — ${lost ? 'cut them off' : 'keep them there'}!`, true);
    why += ` (by ${[...new Set(ways.map(w => w.door ? w.door.def.name : 'the long way'))].join(' and ')})`;
  }
  // whoever stays gets ready: the net's word is what digin.ts acts on
  for (const D of H) if (!go.includes(D)) tell(g, D, fix.at);
  Q.state0 = choice;
  if (choice === 'barricade' && before === 'barricade') { note(g, lead, `${Q.name} stays on its doors: ${why}`); return; }   // (said once: a squad already locked down has nothing new to tell anybody)
  if (choice === 'barricade') g.say(lead, stoodTo ? `${Q.name}: heard it — on the doors, call it when you see them!` : ally && !allyUp ? `${Q.name}: ${ally.name}'s not answering — lock the doors!` : `${Q.name}: holding — lock the doors, let them come!`, true);
  event(g, Q, choice, why, lead);
}

/** the door of the room that was hit (or, no room: of the room the point is in) nearest the place the team was seen or heard, inside 4.5 m: where the men
 *  who met it there met it */
function doorAt(g: Game, room: StructureRoom | null, at: Vec3): Door | null {
  const T = g.fight.roomAt(room ? [(room.bounds.x0 + room.bounds.x1) / 2, 0, (room.bounds.z0 + room.bounds.z1) / 2] : at) as Room | null; let best: Door | null = null, bd = 4.5;
  for (const e of T?.entries ?? []) { const d = flat(e.at, at); if (d < bd) { bd = d; best = e.door; } }
  return best;
}
/** a squad that has the team on it: said on the net by a man able to say it (which is what the other squads act on), and its men in its other rooms are on
 *  their way after their own beat */
function contact(g: Game, st: State, Q: Squad, at: Vec3, room: StructureRoom | null, byDrop = false, by: Guard | null = null, words?: { say: string; why: string }) {
  const was = Q.state, fresh = was !== 'contact'; Q.state = 'contact'; Q.contactT = g.time; Q.ready = false; if (room) Q.hitRoom = room;
  if (netAsks(g)) Q.rc?.netOut?.clear();   // (the errand the net sent its men on is over: a squad in contact counts its men as a squad in a fight does)
  const caller = (by && !runnerOwns(by) ? by : null) ?? Q.men.find(m => fit(g, m) && !Q.sent.some(s => s.gd === m)) ?? null;   // (`by`, callBeat: the man whose call it is ends it himself)
  if (caller && (g.time - Q.calledT > SQUADS.recallSecs || fresh && g.time - Q.calledT > 6 || !!room && room !== Q.calledRoom)) {
    const door = byDrop || !SQUADS.goRound ? null : doorAt(g, room, at);
    Q.calledT = g.time; Q.calledRoom = room; st.net.push({ t: g.time, squad: Q, at: v3.copy(at), door }); if (st.net.length > 40) st.net.splice(0, 20);
    g.say(caller, words?.say ?? `${Q.name}: contact — ${room ? room.name : 'here'}!`, true);
    event(g, Q, 'contact', `${words?.why ?? (room ? room.name : 'its men')}${was === 'hold' || was === 'contact' ? '' : was === 'alerted' ? ' (before it had said what it would do)' : ` (it had chosen: ${was})`}${door ? ` · met at ${door.def.name}` : ''}`, caller);
  } else if (caller && SQUADS.goRound && !byDrop) {   // (its call went out before anybody had seen by which door — a man dropped: the men who see it now say so to whoever asks next)
    let last = null; for (const c of st.net) if (c.squad === Q) last = c;
    if (last && !last.door && g.time - last.t < 30) last.door = doorAt(g, room, at);
  } else if (!caller && fresh) note(g, null, `${Q.name} is in contact and has nobody able to call it`);
  if (!room) return;
  for (const D of home(g, Q)) {
    const his = roomOf(Q, D.gd.char.pos); if (!his || his === room || Q.due.some(d => d.gd === D.gd)) continue;   // (a man who gave ground out of it is the room fight's: not sent back in)
    if (Q.stayed?.has(stayKey(D.gd, room)) && squadDrill(g)?.drillOwn) continue;   // (drillOwn: he was told that room is gone)
    Q.due.push({ gd: D.gd, at: v3.copy(at), t: g.time + pick(SQUADS.reinforce) * ownK(g), room });
  }
}

/** A DRILLED GARRISON (SQUADS.drillFollow): a man holding the other door of a room the team has taken hears the team's next entry go in somewhere else — a
 *  loud thing (a boot, a charge, a round: the room fight's own record of his ears) that is not in the room behind his door and is `followM` or more from
 *  that door, these last moments, nobody of the team in his sight — and he and his mate on that door go after it together on the fight AI's own hunt (the
 *  stock rally's hand-over: their boots are theirs to be heard). Said once on the net, by the man who heard it. */
function follow(g: Game, Q: Squad, s: Sent, D: Def) {
  const M = movedOn(g, Q, s, D, 8); if (!M) return;
  const gd = s.gd, { at, pair } = M;
  for (const x of pair) { const X = defOf(g, x.gd); if (!X || X.mode !== 'hold') continue; x.phase = 'loose'; x.hold = false; loose(g, X, at); }
  g.say(gd, `${Q.name}: they've moved on — after them!`, true);
  event(g, Q, 'follows', `${pair.map(x => x.gd.callsign).join(' and ')} leave${pair.length > 1 ? '' : 's'} ${s.door ? s.door.def.name : 'the door'} for the noise ${flat(at, gd.char.pos).toFixed(0)} m off, ${(g.time - (s.setT ?? s.t0)).toFixed(1)} s after setting`, gd);
}
/** drillFollow's and drillBack's ears: a holding man hears the team go on somewhere else, and nobody of the pair (his mates on that door within `reach`) has one of them in sight */
function movedOn(g: Game, Q: Squad, s: Sent, D: Def, reach: number): { at: Vec3; pair: Sent[] } | null {
  const gd = s.gd, at = D.noiseAt;
  if (!at || g.time - D.noiseT > 1 || g.time - (s.setT ?? s.t0) < 4 || g.time - gd.lastSeenT < 3 || !fit(g, gd)) return null;
  if (flat(at, s.aim ?? gd.char.pos) < (squadDrill(g) ?? SQUADS).followM || lostRoomHas(g, s, at)) return null;
  const pair = Q.sent.filter(x => x.role === 'flank' && x.phase === 'set' && x.hold && alive(x.gd) && fit(g, x.gd) && (x === s || flat(x.gd.char.pos, gd.char.pos) < reach));
  return pair.some(x => g.time - x.gd.lastSeenT < 3) ? null : { at, pair };   // (his mate has a man in sight: nobody leaves)
}
/** A DRILLED GARRISON (SQUADS.drillBack): the door they hold has nobody behind it any more, and out here they are in the open on the way the team is
 *  coming. Two things tell them: the squad they went round for has stopped answering (every man of it down: `backBeat` s of nothing on the net), or
 *  `drillFollow`'s ears — the team heard going in somewhere else. Every man of the squad still holding that room's doors, nobody of the team in his sight,
 *  goes back to the post he left (a scripted leg, his boots filed for the team's ears), and the room fight plants him there facing where they were last
 *  heard. Said once on the net, by the man who knew. */
function back(g: Game, Q: Squad, s: Sent, D: Def) {
  const gd = s.gd, K = squadDrill(g) ?? SQUADS, gone = !!s.ally && s.ally.state === 'down';
  let at: Vec3, pair: Sent[];
  if (gone) {
    s.goneT ??= g.time;
    if (g.time - s.goneT < K.backBeat || g.time - (s.setT ?? s.t0) < 4 || !fit(g, gd)) return;
    pair = Q.sent.filter(x => x.role === 'flank' && !x.back && x.hold && (x.phase === 'set' || x.phase === 'run') && alive(x.gd) && fit(g, x.gd));   // (a mate still on his way to that door turns round with him)
    if (pair.some(x => g.time - x.gd.lastSeenT < 3)) return;   // (one of them has a man in sight: nobody leaves)
    at = D.noiseAt ?? s.fixAt;
  } else { const M = movedOn(g, Q, s, D, Infinity); if (!M) return; ({ at, pair } = M); }
  const names: string[] = [], door = s.door ? s.door.def.name : 'the door';
  for (const x of pair) {
    const X = defOf(g, x.gd); if (!X || X.mode === 'free') continue;
    x.phase = 'run'; x.back = true; x.hold = false; x.spot = x.from; x.door = null; x.way = undefined; x.tries = 0;
    X.ev.fill(0); X.pt[0] = at[0]; X.pt[2] = at[2];   // (what he faces when he is planted again: where they were last heard, not the door he gave up)
    run(g, X, x.from, null, 0.3); names.push(x.gd.callsign);
  }
  if (!names.length) return;
  g.say(gd, gone ? `${Q.name}: ${s.ally!.name} is not answering — back on our doors!` : `${Q.name}: they've left it — back on our doors!`, true);
  event(g, Q, 'back', `${names.join(' and ')} leave${names.length > 1 ? '' : 's'} ${door}: ${gone ? `${s.ally!.name} is not answering` : `the team was heard ${flat(at, s.aim ?? gd.char.pos).toFixed(0)} m off, going on`}, ${(g.time - (s.setT ?? s.t0)).toFixed(1)} s after setting`, gd);
}
/** A DRILLED GARRISON (SQUADS.drillLook, with PRESSURE.sweep): GO AND LOOK — once a tick, after every squad has had its own say. The word is kept from
 *  what their side can know (the net's last call, one of the team properly in a living man's sight, a loud thing in a living man's ears: never the team's
 *  true place, and nothing from the dead); gone quiet for `sweepSecs` with no squad in contact, deciding or with men out, the nearest squad that can spare
 *  a pair calls it and, `sweepBeat` later, sends it. No die is drawn. */
function lookOut(g: Game, st: State) {
  const K = squadDrill(g); if (!K || !K.drillLook || !PRESSURE.sweep) return;
  const W = st.word ??= { t: -Infinity, at: [0, 0, 0], done: -Infinity, saidT: -Infinity, lost: false, out: null, call: null };
  const c = st.net[st.net.length - 1]; if (c && c.t > W.t) { W.t = c.t; W.at = c.at; }
  for (const D of g.fight.defs) {
    const m = D.gd; if (!alive(m)) continue;
    if (!m.held && m.lastSeenT >= 0 && m.lastSeenT > W.t) { W.t = m.lastSeenT; W.at = m.sightPos; }   // (lastSeenT: a man of the team properly in his sight; every writer of these three places replaces the array, so what is kept here is the place as it was)
    if (D.noiseAt && D.noiseT > W.t) { W.t = D.noiseT; W.at = D.noiseAt; }
  }
  // the men of the last look: one of them down while he was out, and no squad sends another this fight; all of them home again, and that look is over
  if (W.out) { if (W.out.some(m => !alive(m))) { W.lost = true; W.out = null; note(g, null, 'go and look: a man of the look is down — no squad sends another'); } else if (!st.squads.some(Q => Q.sent.some(s => s.role === 'look'))) W.out = null; }
  if (W.lost) return;
  const C = W.call;
  const busy = st.squads.some(Q => Q.state === 'contact' || Q.state === 'alerted' || Q.due.length > 0 || !!Q.calls?.length || !!Q.rc?.look.length || Q.sent.some(s => alive(s.gd)));
  if (C) {
    const H = home(g, C.Q);
    if (W.t > C.w || busy || !C.go.every(D => H.includes(D))) { W.call = null; if (W.t <= C.w) W.done = -Infinity; return; }   // (word of them in the beat, a fight, or a man of the pair taken: nobody goes on the old call)
    if (g.time < C.goT) return;
    W.call = null; W.out = C.go.map(D => D.gd);
    for (const D of C.go) { C.Q.sent.push({ gd: D.gd, from: v3.copy(D.station), role: 'look', phase: 'loose', spot: null, door: null, fixAt: C.at, tries: 0, stepT: -100, t0: g.time }); loose(g, D, C.at); }
    event(g, C.Q, 'sweep', `${C.go.map(D => D.gd.callsign).join(' and ')} go to where the team was last seen or heard, ${(g.time - C.w).toFixed(0)} s after the last word of them`, C.go[0].gd);
    return;
  }
  if (W.t === -Infinity || W.done >= W.t || g.time - W.t < K.sweepSecs || g.time - W.saidT < K.sweepSecs || busy) return;
  if (g.fight.defs.some(D => alive(D.gd) && D.mode === 'free')) return;   // (a man is out on a hunt of his own: his look is the look)
  const R = g.fight.roomAt(W.at);
  if (R && g.fight.defs.some(D => alive(D.gd) && D.mode === 'hold' && D.room === R)) return;   // (a man of theirs holds the room that word is of: he is looking at it)
  const may = (D: Def) => { const ph = digInPhase(g, D.gd); return (ph === 'idle' || ph === 'set') && !laneHolds(g, D.gd, W.at) && !laneWarns(g, D.gd, W.at); };   // (not a man on his way to cover or wedging a door; not one who knows a covered lane lies that way)
  let best: { Q: Squad; go: Def[]; d: number } | null = null;
  for (const Q of st.squads) {
    if (Q.state === 'down' || (Q.def.mayLeave === false && !K.sweepStayers)) continue;
    const H = home(g, Q), spare = H.length - new Set(H.map(D => D.room)).size;
    const go = spare >= 2 ? goers(H.filter(may), W.at, Math.min(Math.max(2, K.sweepMen), spare)) : [];
    if (go.length < 2) continue;   // (nobody walks out alone)
    const d = Math.min(...go.map(D => flat(D.gd.char.pos, W.at)));
    if (!best || d < best.d) best = { Q, go, d };
  }
  if (!best) return;
  W.done = W.t; W.saidT = g.time; W.call = { Q: best.Q, go: best.go, at: v3.copy(W.at), goT: g.time + K.sweepBeat, w: W.t };
  g.say(best.go[0].gd, `${best.Q.name}: gone quiet — ${COUNT[best.go.length] ?? best.go.length} of us go and look!`, true);
}
/** is that place in or within three metres of the room a holding man's door leads to (the room the team took): a noise in its other doorway, in the corridor
 *  along its wall or heard a few metres off through the wall is still the fight for THAT room — the team working it from its other door has not moved on */
function lostRoomHas(g: Game, s: Sent, at: Vec3): boolean {
  if (!s.door) return false;
  const F = g.fight, here = F.roomAt(s.gd.char.pos), p: Vec3 = [0, 0, 0];
  for (const r of [0, 1.5, 3]) for (let k = 0; k < (r ? 8 : 1); k++) {
    p[0] = at[0] + Math.cos(k * Math.PI / 4) * r; p[2] = at[2] + Math.sin(k * Math.PI / 4) * r;
    const there = F.roomAt(p); if (there && there !== here && (there as Room).entries.some(e => e.door === s.door)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- unseen drops: a mate's eyes, the net's check (SQUADS.radioCheck)
/** the check's OWN dice, never the game's: with the switch on a run stays the run it was until the first frame the switch changes something (a drop it does not
 *  call). Seeded off the squad's name and its men's stride phases — dealt differently every run, and reading them disturbs nothing */
function checkDice(Q: Squad, salt = 0): Die {
  let h = 0x811c9dc5 ^ salt; for (let i = 0; i < Q.name.length; i++) h = Math.imul(h ^ Q.name.charCodeAt(i), 0x01000193);
  return dieOf((h ^ Math.floor(Q.men.reduce((s, m) => s + m.char.anim.phase, 0) * 0x7fffff)) >>> 0);
}
const checkBeat = (Q: Squad, die: Die) => SQUADS.checkEvery * (Q.newsT > -100 || Q.contactT > -100 || Q.wary ? SQUADS.checkAlertK : 1) * (1 + (roll(die) * 2 - 1) * SQUADS.checkJitter);   // (a squad that has heard of the team, or met it, counts its men oftener, as the staff's net does once alarmed)
function rcOf(g: Game, Q: Squad): Check { if (Q.rc) return Q.rc; const die = checkDice(Q); return Q.rc = { nextAt: g.time + roll(die) * checkBeat(Q, die), stage: 'idle', t0: 0, caller: null, who: null, silent: [], known: new Set(), looked: new Set(), look: [], n: 0, die, byEar: false, tickT: g.time }; }
/** a man of the squad has gone quiet: where he stood, when, and what each mate's ears had counted by then. Nobody is told by it */
function wentSilent(g: Game, Q: Squad, m: Guard, at: Vec3 = m.char.pos, broke = false) {
  const C = rcOf(g, Q), small0 = () => new Map(Q.men.map(x => [x, x.witness.heard.small])), was = C.silent.find(r => r.gd === m);
  if (was) {   // (filed in somebody's arm and dropped since: a new silence — where he fell, from now, and asked for again though his post was looked at)
    if (was.held && !alive(m)) {
      was.held = false; was.at = [at[0], 0, at[2]]; was.t = g.time; was.heard = false; was.small0 = small0(); C.looked.delete(m);
      note(g, m, `${Q.name}: ${m.callsign}, not answering since he was taken, is down in its rooms: a new silence, looked for where he fell`);
      for (const X of C.look) { if (X.who !== m || X.back) continue; X.spot = v3.copy(was.at); X.tries = 0; X.lookT = undefined; const D = defOf(g, X.gd); if (D && D.mode === 'move') walk(g, D, X.spot); }   // (men already walking to his post go where he fell: 'no sign' at the post he was taken from would close the book on him)
    }
    return;
  }
  C.silent.push({ gd: m, at: [at[0], 0, at[2]], t: g.time, heard: false, held: alive(m), small0: small0() });
  note(g, m, `${Q.name}: ${m.callsign} goes quiet (${alive(m) ? 'taken' : 'down'}) ${broke ? 'with his call broken off: his mates heard that much, and no more' : 'and nobody of the squad knows it'}`);   // (the log's row only: a trace shows where a run with the switch on leaves the run with it off)
}
/** a line of the check on the squad's net, said the way laststand.ts's voice() says one: the log's row, the debrief's, and the strip's row under the squad's
 *  name (cues.ts net) — never Guard.bubble. The men's own barks wait behind a radio line in their bubble (suppression.ts supBark, guards.ts standoffBark
 *  and the 'CONTACT!' bark) and each of them draws the game's dice: a check that changes nothing must leave the run the run it was. `cls` = the line's row
 *  of the strip's ranking (cues.ts CLASSES) */
function onNet(g: Game, gd: Guard, text: string, cls = cueClass(text), chron = true) {
  if (gd.held) return;
  g.cues?.net(gd, text, cls); if (chron) chronRadio(g, gd, text); g.msg(`${gd.callsign} (radio): ${text}`);
}
/** a mate at home has gunfire in his ears with a drop: heard in the second and a half before it — or filed this frame and not through his ears yet (the
 *  player's round and the drop it makes come before the squads' tick in a frame, the men's hearing after it: guards.ts gunfireDue) */
const heardFire = (g: Game, Q: Squad, up: Guard[]) => up.some(x => !!roomOf(Q, x.char.pos, 1) && ((x.witness.heard.lastShotT >= 0 && g.time - x.witness.heard.lastShotT < 1.5) || g.time - bangT(g, x) < 1.5 || gunfireDue(g, x, true)));
/** when a stun charge, or a door blown in, last reached this man's ears — as loud with a drop as gunfire is (a charge that fells the man behind the door is
 *  no silent drop). His Witness counts them and does not time them: the count is read once a frame for every man of a squad with the switch on (radioCheck),
 *  so it is seen to move the frame after he heard it; a gap in the reading (the switch was off meanwhile) starts over */
const BANGS = new SideMap<Guard, { n: number; t: number; read: number }>('enemysquads.BANGS');
function bangT(g: Game, x: Guard): number {
  const H = x.witness.heard, b = BANGS.get(x);
  if (!b || g.time - b.read > 0.5 || g.time < b.read || H.bang < b.n) { BANGS.set(x, { n: H.bang, t: -100, read: g.time }); return -100; }
  if (H.bang > b.n) { b.n = H.bang; b.t = H.lastT; }
  b.read = g.time; return b.t;
}
/** a looker's leg: pressure.ts's scripted leg (his own senses under it: an enemy seen close stops him to fight), at the pace of a man going to look — not of
 *  one going to a fight. looks() ends the leg itself, before the room fight's `plant` would: a man who found nothing is not a man who met the team */
function walk(g: Game, D: Def, to: Vec3) { run(g, D, to, null); order(D.gd, { speed: g.tune.guardInvestigate }); }
/** once a frame for a squad with the switch on: what its men's eyes and ears make of the men who went quiet, and the net's check. Returns where a man was
 *  SEEN down (or his drop heard as gunfire) this frame by a squad not already in contact — the caller makes that the contact it always was — else null.
 *  `busy`: the squad is in contact (or will be this frame): it knows its men as before the switch, and nobody runs a check over a fight */
function radioCheck(g: Game, Q: Squad, busy: boolean): { at: Vec3; room: StructureRoom | null } | null {
  const K = SQUADS, C = rcOf(g, Q); C.n++;
  if (g.time - C.tickT > 1) { C.stage = 'idle'; C.who = null; C.byEar = false; C.cut = undefined; C.beat = undefined; C.late = false; C.nextAt = g.time + checkBeat(Q, C.die); }   // (the switch was off a while: no check half run is taken up again, the next one is a beat from now)
  C.tickT = g.time;
  for (const x of Q.men) if (alive(x)) bangT(g, x);
  let H: Def[] | null = null; const atHome = () => H ??= home(g, Q);
  let seen: { at: Vec3; room: StructureRoom | null } | null = null;
  for (let i = C.silent.length - 1; i >= 0; i--) {
    const r = C.silent[i], m = r.gd, age = g.time - r.t;
    if (!offNet(m)) { C.silent.splice(i, 1); C.looked.delete(m); continue; }   // (let go of: he is on the net again)
    if (C.known.has(m) || alive(m)) continue;
    // (a) a mate's eyes — every frame for the first second, ten times a second after (a body nobody finds is looked for as long as it lies there)
    const by = age < 1 || (C.n + i) % 6 === 0 ? Q.men.find(x => x !== m && fit(g, x) && bodySeen(g, x, m)) : undefined;
    if (by) {
      const at = bodyPos(m);
      if (K.callBeat && K.callBody && !busy && keyUp(g, Q, by, at, roomOf(Q, at, 1), m)) continue;   // (callBeat, a quiet floor: the body is HIS until he has said it — callsTick files it found when his call ends)
      C.known.add(m);
      event(g, Q, 'found', `${by.callsign} has ${m.callsign} in sight, down ${flat(by.char.pos, at).toFixed(1)} m from him, ${age.toFixed(1)} s after he dropped`, by);
      seen = { at, room: roomOf(Q, at, 1) }; continue;
    }
    if (age > 3) continue;
    // gunfire (or a charge going off) a mate at home heard in the second after he dropped (the report reached him a frame late, or from outside the wall): the drop was heard — contact, as it was
    // (callCutAsk files men who fall OUTSIDE the squad's rooms: a shot from out there is news from outside, by the mates' own ears (squadsTick 2) — not
    // 'contact — here!' said by a man at home, at a spot he cannot see. The man stays filed and is asked for by name)
    const shot = age < 1.5 && (!(K.callBeat && K.callCutAsk[1] > 0) || !!roomOf(Q, r.at, 1)) ? Q.men.find(x => x !== m && fit(g, x) && (x.witness.heard.lastShotT >= r.t - 0.2 || bangT(g, x) >= r.t - 0.2) && !!roomOf(Q, x.char.pos, 1)) : undefined;
    if (shot) { C.known.add(m); event(g, Q, 'found', `${shot.callsign} heard the ${shot.witness.heard.lastShotT >= r.t - 0.2 ? 'shot' : 'blast'} that dropped ${m.callsign}`, shot); seen = { at: v3.copy(r.at), room: roomOf(Q, r.at, 1) }; continue; }
    if (r.heard || !(K.heardAsks || K.heardKnows)) continue;
    // (c) a mate's ears: a small thing heard SINCE he dropped, where he stood
    //     (any fit man of the squad, the men it sent to a door included: a man posted three metres off hears his mate fall as well as one in the room does)
    const ear = Q.men.find(x => { const E = x.witness.heard; return x !== m && fit(g, x) && E.small > (r.small0.get(x) ?? Infinity) && !!E.smallWhere && flat(E.smallWhere, r.at) < K.checkHearM; });
    if (!ear) continue;
    r.heard = true;
    if (K.heardKnows) { C.known.add(m); event(g, Q, 'found', `${ear.callsign} heard ${m.callsign} go down: that is enough`, ear); seen = { at: v3.copy(r.at), room: roomOf(Q, r.at, 1) }; }
    else if (C.stage === 'idle' && !busy && !C.look.length && Q.state !== 'alerted') {   // (not with the squad's word due: its check would be dropped the same frame)
      C.stage = 'called'; C.byEar = true; C.caller = ear; C.who = m; C.t0 = g.time + K.checkHeard[0] + roll(C.die) * (K.checkHeard[1] - K.checkHeard[0]) - K.checkAsk;
      event(g, Q, 'check', `${ear.callsign} heard something where ${m.callsign} stands: he asks for him in ${(C.t0 + K.checkAsk - g.time).toFixed(1)} s`, ear);
    }
  }
  if (busy) for (const r of C.silent) if (!alive(r.gd)) C.known.add(r.gd);   // (a squad in a fight counts its men, as it always did: a body come upon afterwards is no new contact)
  if (busy || seen) {
    if (C.promised?.size) { for (const m of C.promised) note(g, m, `${Q.name}: nobody asks for ${m.callsign} after all — ${busy ? 'the squad is in contact' : 'a man of it is seen down'} first, and counts its men as a squad in a fight does`); C.promised = undefined; }
    C.stage = 'idle'; C.who = null; C.byEar = false; C.cut = undefined; C.beat = undefined; C.late = false; C.nextAt = Math.max(C.nextAt, g.time + 5); return busy ? null : seen; }
  if (C.stage === 'idle' && (Q.newsT > -100 || Q.contactT > -100 || Q.wary)) C.nextAt = Math.min(C.nextAt, g.time + K.checkEvery * K.checkAlertK * (1 + K.checkJitter));   // (the beat it was on shortens the moment it hears of the team)
  if (C.stage === 'idle' && g.time < C.nextAt) return null;
  if (Q.calls?.length) { if (C.stage === 'called' && g.time - C.t0 >= K.checkAsk) C.late = true; return null; }   // (callBeat) a man of the squad is on the air: one net — nobody calls a check or asks for a man over his call
  if (C.cut && !(K.callBeat && K.callCutAsk[1] > 0)) { C.cut = undefined; C.promised = undefined; if (C.beat !== undefined) { C.nextAt = Math.max(C.nextAt, C.beat); C.beat = undefined; } }   // (the knob or its ask switched off on the panel mid-run: nobody is owed an ask)
  // (b) the net's check
  for (const m of Q.men) if (alive(m) && m.held && !C.looked.has(m) && !Q.sent.some(s => s.gd === m)) wentSilent(g, Q, m, defOf(g, m)?.station);   // (in Sam's arm: he cannot answer either)
  const missing = () => { let best: Guard | null = null, bt = Infinity; for (const r of C.silent) if (!C.known.has(r.gd) && !C.looked.has(r.gd) && r.t < bt) { bt = r.t; best = r.gd; } return best; };
  const owed = (x: { who: Guard }) => owedOf(C, x.who);
  // (`poll`: not a new beat — the check could not be called or asked just now and is tried again shortly. The routine check's own time, kept in `beat` while
  // a man on `cut` has `nextAt` pulled in, outlives any number of polls: it comes when it was due, or at the first poll after that)
  const idle = (after: number, poll = false) => { C.stage = 'idle'; C.who = null; C.byEar = false; C.late = false; C.nextAt = poll && C.beat !== undefined ? Math.max(C.beat, g.time + after) : g.time + after; C.beat = undefined;
    if (C.cut) { C.cut = C.cut.filter(owed); if (!C.cut.length) C.cut = undefined; }
    if (C.cut) { C.beat = C.nextAt; C.nextAt = Math.min(C.nextAt, Math.max(g.time + Math.min(after, 1), Math.min(...C.cut.map(x => x.at)))); }   // (callCutAsk: a man whose call broke off is still to be asked for — not a whole beat from now; the first of them sets the time)
    return null; };
  // the squad has heard of the team since the check was called and its word is due: its men belong on their doors — nobody is asked for over that and nobody
  // walks off to look. The check is called again once its word is out (tried every 5 s: `idle` below waits while it is still due), and the missing man asked
  // for then. Only news that reopens its choice drops one: more of a fight it has already answered (Squad.newsT moves on every loud thing heard outside its
  // rooms) drops nothing — and a fight sputtering somewhere else, which reopens that choice every `againSecs`, no longer leaves a missing man unlooked-for
  // for as long as it lasts (a beat's wait after each drop was longer than the gap between two of them)
  if (C.stage !== 'idle' && Q.state === 'alerted') {
    note(g, C.caller, `${Q.name} check dropped${C.who ? `, ${C.who.callsign} ${C.stage === 'asked' ? 'asked for and nobody sent' : 'not asked for'}` : ''}: the squad has heard of the team since it was called`);
    if (C.stage === 'called' && C.who && !C.byEar && K.callBeat && K.callCutAsk[1] > 0) (C.cut ??= []).unshift({ who: C.who, at: g.time });   // (callCutAsk: the man whose call broke off was named and not yet asked for — he is asked for by name once the word is out, not after a whole 'sound off' round)
    return idle(5, true);
  }
  switch (C.stage) {
    case 'idle': {
      if (Q.state === 'alerted' || !atHome().length || C.look.length) return idle(5, true);   // (its word is due, nobody free to call it, or men are out looking already: asked again shortly)
      if (C.cut || C.beat !== undefined) { const x = C.cut?.filter(owed).shift(), b = C.beat; C.cut = C.cut?.filter(y => owed(y) && y !== x); if (!C.cut?.length) C.cut = undefined; C.beat = undefined;
        if (!x && b !== undefined && g.time < b) { C.nextAt = b; return null; }   // (he is on the net again, or found since: nobody to ask for — the routine check comes when it was due, not now)
        if (x) {   // (callCutAsk) the man whose call broke off while the check had its hands full: asked for by name now — no 'sound off' round first
          C.stage = 'called'; C.byEar = false; C.caller = atHome()[0].gd; C.who = x.who; C.t0 = Math.max(g.time, x.at) - K.checkAsk;
          event(g, Q, 'check', `${C.caller.callsign} has not forgotten the call that broke off: he asks for ${x.who.callsign}${x.at > g.time ? ` in ${(x.at - g.time).toFixed(1)} s` : ''}`, C.caller);
          return null;
        } }
      if (!missing() && Q.men.filter(m => !offNet(m)).length < 2) return idle(checkBeat(Q, C.die));   // (a man alone with nobody to count in does not call into the dark)
      C.stage = 'called'; C.t0 = g.time; C.caller = atHome()[0].gd; C.who = null;
      onNet(g, C.caller, `${Q.name}: radio check — sound off`, 6); event(g, Q, 'check', `${C.caller.callsign} calls the squad's radio check`, C.caller);
      return null;
    }
    case 'called': {
      if (C.byEar && (!C.caller || offNet(C.caller))) {   // (what only he heard goes with him: nobody else asks on his clock for a man they heard nothing of)
        note(g, C.caller, `${Q.name} check dropped: ${C.caller?.callsign ?? 'the man'} who heard something where ${C.who?.callsign ?? 'a mate'} stands is off the net before he asked`);
        const q = C.who ? C.silent.find(x => x.gd === C.who) : undefined; if (q) q.heard = false;   // (a mate who heard it as well asks on his own ears, from the next frame; nobody did: the routine check comes when it was due)
        C.stage = 'idle'; C.who = null; C.byEar = false; C.late = false; return null;
      }
      if (g.time - C.t0 < K.checkAsk) return null;
      const who = C.who && offNet(C.who) && !C.known.has(C.who) && !C.looked.has(C.who) ? C.who : missing();
      if (!who) return idle(checkBeat(Q, C.die));   // every man answered
      if (C.byEar) { if (!fit(g, C.caller!)) return null; C.t0 = Math.max(C.t0, g.time - K.checkAsk); }   // (his to ask, once he can — and the men go no sooner after it than after any ask)
      else if (!C.caller || !fit(g, C.caller) || g.time - C.caller.lastSeenT < 2) C.caller = atHome()[0]?.gd ?? null;   // (the man who called it is down, held or in a fight: a man at home goes on with it)
      if (!C.caller) return idle(5, true);   // (the man who called it cannot go on with it and nobody else can: asked again shortly)
      if (C.late && K.callBeat && K.callCutAsk[1] > 0 && !C.byEar) C.t0 = Math.max(C.t0, g.time - K.checkAsk);   // (callCutAsk: an ask a mate's call HELD UP — one net; only that one, a check nobody talked over keeps its clock to the frame — is still followed by the breath it gives him to answer before men go)
      C.late = false;
      if (netAsks(g) && !C.byEar && !C.who) for (const m of Q.men) if (offNet(m) && !C.known.has(m)) (C.asked ??= new Set()).add(m);   // (netAsk: a 'sound off' round — every man who did not answer it is a man the squad knows it has not heard from)
      C.who = who; C.stage = 'asked'; C.promised?.delete(who);
      onNet(g, C.caller!, `${Q.name}: ${mate(who)}? … ${mate(who)}, sound off`, 2); event(g, Q, 'asks', `no answer from ${who.callsign}: ${C.caller.callsign} asks for him by name`, C.caller);
      netFeedAsked(g, C.caller, who, Q.men);   // (netquiet.ts, filed through netquietfeed.ts — a return on its first line with its switch off: a mate who does not answer shakes the man who asked and the men who heard him ask)
      return null;
    }
    case 'asked': {
      const who = C.who, r = who ? C.silent.find(x => x.gd === who) : undefined;
      if (!who || !r || C.known.has(who)) return idle(checkBeat(Q, C.die));   // (he answers — let go of — or his fate is known since)
      const send = Math.max(K.checkSend, K.checkAsk + 1);   // (never before he has been asked for by name and given a breath to answer)
      if (g.time - C.t0 < send) return null;
      const A = atHome(), go = [...A].sort((a, b) => flat(a.gd.char.pos, r.at) - flat(b.gd.char.pos, r.at)).slice(0, Math.max(1, Math.min(K.lookMen, A.length - 1)));   // (a man stays on the net at home while two can be found)
      if (!go.length) return g.time - C.t0 > send + 20 ? idle(5, true) : null;   // (nobody free to go: kept trying a while, then asked again)
      let alone = false;
      // (netAsk) he is the last of his squad at home AS FAR AS HE KNOWS (every other man of it is out, known down, or has been asked for and did not answer): he
      // says so on the net and stays on it — two of the nearest squad that can spare them go to the post in his place
      if (K.netAsk && A.length === 1 && !Q.men.some(m => m !== who && offNet(m) && !C.known.has(m) && !C.looked.has(m) && !C.asked?.has(m) && !C.out?.has(m) && !Q.sent.some(s => s.gd === m) && !Q.went.some(s => s.gd === m))) {
        const st = STATES.get(g)!, me = go[0].gd;
        const coming = st.squads.flatMap(S => S.rc?.look.filter(L => L.about === Q && !L.all && !L.back) ?? []);
        if (coming.length) {   // (men are on their way to him already: this post is theirs to look at too — he does not call for help twice)
          for (const L of coming) (L.stops ??= []).push(v3.copy(r.at));
          onNet(g, me, `${Q.name}: nothing from ${mate(who)} either — his post too!`, 2);
          event(g, Q, 'net help', `${me.callsign}, the last of ${Q.name} at home, has ${who.callsign} missing too: ${coming.map(L => L.gd.callsign).join(' and ')}, on their way to him, look at that post as well`, me);
          C.looked.add(who); (C.asked ??= new Set()).add(who); return idle(checkBeat(Q, C.die));
        }
        const more = C.silent.filter(x => x.gd !== who && !!C.asked?.has(x.gd) && offNet(x.gd) && !C.known.has(x.gd) && !C.looked.has(x.gd)).slice(0, Math.max(0, K.netStops - 1));   // (the others he has not heard from: their posts are looked at on the same trip)
        const sent = netSend(g, st, Q, who, [v3.copy(r.at), ...more.map(x => v3.copy(x.at))], false);
        if (sent) {
          for (const x of more) C.looked.add(x.gd);
          onNet(g, me, `${Q.name}: nothing from ${mate(who)} — I'm alone here, somebody look!`, 2);
          event(g, Q, 'net help', `${me.callsign}, the last of ${Q.name} at home, does not walk off alone: ${sent.go.map(D => D.gd.callsign).join(' and ')} of ${sent.Q.name} go to where ${who.callsign} stood${more.length ? ` and ${more.map(x => x.gd.callsign).join(', ')} after him` : ''}, ${(g.time - r.t).toFixed(1)} s after he went quiet`, me);
          netSay(g, st, NET_BREATH, sent.go[0].gd, `${sent.Q.name}: copy, ${Q.name} — ${COUNT[sent.go.length] ?? sent.go.length} moving to you!`);
          C.looked.add(who); (C.asked ??= new Set()).add(who); netWary(g, st, `${who.callsign} of ${Q.name}`);   // (the net has him: his own squad does not ask for him again)
          return idle(checkBeat(Q, C.die));
        }
        alone = true; netWary(g, st, `${who.callsign} of ${Q.name}`);   // (nobody can come: he goes himself, and says that he is alone — the squads hear that much)
      }
      if (netAsks(g)) { (C.asked ??= new Set()).add(who); for (const D of go) (C.out ??= new Set()).add(D.gd); }
      for (const D of go) { C.look.push(looker(g, Q, D, who, r.at)); walk(g, D, r.at); }
      onNet(g, go[0].gd, alone ? `${Q.name}: nothing from ${mate(who)} — I'm alone here, going myself!` : `${Q.name}: nothing from ${mate(who)} — ${COUNT[go.length] ?? go.length} moving to his post!`);
      event(g, Q, 'looks', `${go.map(D => D.gd.callsign).join(' and ')} walk${go.length > 1 ? '' : 's'} to where ${who.callsign} stood, ${flat(go[0].gd.char.pos, r.at).toFixed(0)} m off, ${(g.time - r.t).toFixed(1)} s after he went quiet${K.netAsk ? alone ? ': the last of the squad at home, and no squad has two to send' : '' : ': nothing is said to the other squads'}`, go[0].gd);
      return idle(checkBeat(Q, C.die));
    }
  }
}
/** a man of squad Q set off to look for `who` at `at`: his record, with the post he leaves and how he held it */
function looker(g: Game, Q: Squad, D: Def, who: Guard, at: Vec3): Looker {
  const gd = D.gd;
  return { gd, who, spot: v3.copy(at), from: v3.copy(D.station), back: false, tries: 0, stepT: -100, t0: g.time, news0: Q.newsT,
    calm: { state: gd.state, awareness: gd.awareness, hold: gd.hold, pinned: gd.pinned, station: v3.copy(D.station), home: v3.copy(D.home), room: D.room, ev: [...D.ev], watch: D.watch, want: D.want, pt: v3.copy(D.pt) } };
}
/** how near the post a looker has to get before he has looked, how near is as near as he gets when the way is shut, and how far round his feet a man who
 *  has come to look sees a body in any light (guards.ts bodySeen's `around`: the furthest he stops from the post + the metre a round throws a body) */
const LOOK_AT_M = 1.2, LOOK_NEAR_M = 2.5, LOOK_ROUND_M = 3.5;
/** how long a man who has got to the post (or as near it as he can) looks about him before he says there is nothing to see: his eyes are asked every frame of
 *  it, and he walks on to the spot itself meanwhile — one glance on the frame he arrives is taken from the doorway, through the leaf he is pushing */
const LOOK_SECS = 1.2;
/** every looker out for `who` turns for the post he left */
function turnBack(g: Game, Q: Squad, who: Guard) {
  for (const X of Q.rc!.look) { if (X.who !== who || X.back) continue; X.back = true; X.tries = 0; const D = defOf(g, X.gd); if (D && D.mode === 'move') walk(g, D, X.from); }
}
/** back on the post he left, as he held it — wary (he knows a man is missing) and no more: he has seen nobody */
function settle(g: Game, L: Looker, D: Def) {
  const gd = D.gd, c = L.calm, roused = c.state === 'alert' || c.state === 'search';
  const heard = gd.witness.heard.lastShotT > L.t0 || gd.awareness >= 0.85;   // (gunfire on the walk, or his own senses past his bar: he is not calmed back down for having been on an errand)
  if (gd.script) endGuardScript(gd, roused ? c.state as 'alert' | 'search' : 'suspicious');
  gd.awareness = roused ? Math.max(gd.awareness, c.awareness) : heard ? Math.max(gd.awareness, c.awareness, 0.35) : Math.min(0.45, Math.max(gd.awareness, c.awareness, 0.35)); gd.hold = c.hold; gd.pinned = c.pinned;   // (wary at the least: a man who heard fire far off on the walk is no less so than one who heard nothing)
  D.mode = 'hold'; D.station = c.station; D.home = c.home; D.room = c.room; D.ev = c.ev; D.watch = c.watch; D.want = c.want; D.pt[0] = c.pt[0]; D.pt[1] = c.pt[1]; D.pt[2] = c.pt[2];
  D.glanceUntil = -1; D.fixKeep = -1; D.rallyAt = NaN; D.lastState = gd.state; D.lastSeen = gd.lastSeenT; gd.lastKnown = D.pt;
}
/** a man out looking, once a frame (before the room fight's own tick: his leg is ended here, not by its `plant`); true = no longer a looker */
function looks(g: Game, st: State, Q: Squad, L: Looker): boolean {
  const gd = L.gd, C = Q.rc!, who = L.who, D = defOf(g, gd);
  if (!alive(gd)) { wentSilent(g, Q, gd); C.nextAt = Math.min(C.nextAt, g.time + SQUADS.checkAsk); return true; }   // (down out there: one more who will not answer, asked for sooner than the next check)
  if (!D) return true;
  if (gd.held) { wentSilent(g, Q, gd); return true; }   // (taken on his way: where he was is where they will look)
  L.stepT = boots(g, gd, L.stepT);
  if (Q.state === 'contact') {   // his squad is hit: the room fight's man. Still on his leg he ends it at a run — on to the post he was sent to if that is the nearer (his mate has
    // found the body there), else back to the one he left: a leg at a walk left to itself is cut short at ten seconds, wherever that is
    if (D.mode === 'move') run(g, D, !L.back && flat(gd.char.pos, L.spot) < flat(gd.char.pos, L.from) ? L.spot : L.from, null);
    return true;
  }
  const eyes = g.time - gd.lastSeenT < 1 && (!SQUADS.noticedEyes || noticed(gd));
  if (eyes || D.mode !== 'move') {   // (he has one of them in his sight, or the room fight has stopped him where he is: its man, roused, as any man it plants)
    if (eyes && !roomOf(Q, gd.char.pos, 1) && !(SQUADS.callBeat && noticed(gd) && keyUp(g, Q, gd, gd.lastKnown ?? gd.char.pos, null, null))) contact(g, st, Q, gd.lastKnown ?? gd.char.pos, null);   // (met out on the floor between its rooms: he is on the squad's errand with its radio — he calls it; inside its rooms the squad's own eyes rule already has)
    return true;
  }
  const X = L.about;   // (netAsk: he is looking at ANOTHER squad's posts — `who` is a man of it)
  if (!L.back && (L.all ? X!.men.some(m => !offNet(m)) : !offNet(who))) { turnBack(g, Q, who); onNet(g, gd, `${Q.name}: ${L.all ? X!.name : mate(who)}'s answering — back on our doors!`); event(g, Q, 'no sign', L.all ? `somebody of ${X!.name} is on the net again: the men who went to its posts go back` : `${who.callsign} is on the net again: the men who went for him go back`, gd); return false; }
  if (!L.back && Q.state === 'alerted' && Q.newsT > L.news0) { turnBack(g, Q, who); return false; }   // (the squad has heard of the team since they set off and its word is due: back to their doors, the missing man asked for again at the next check. More of a fight it has already answered turns nobody round)
  const goal = L.back ? L.from : L.spot, d = flat(gd.char.pos, goal), there = !!gd.script?.arrived || d < (L.back ? 0.5 : LOOK_AT_M), stuck = D.stallT > 1.3, close = d < LOOK_NEAR_M;
  const looking = !L.back && L.lookT !== undefined;
  // what he finds: the mate he was sent for — or, sent to another squad's posts, any man of it lying there. `found`: true = no longer a looker (the squad is in contact)
  const found = (body: Guard): boolean => {
    const at = bodyPos(body);
    if (SQUADS.callBeat && SQUADS.callBody && keyUp(g, Q, gd, at, roomOf(Q, at, 1), body)) return false;   // (callBeat: he keys up over the body. He is a man out looking only while his leg lasts: once he has arrived the room fight plants him where he stands and he leaves the look list — his call runs on to its end, or is cut off, either way)
    C.known.add(body); if (X) seenTo(st, X, body);
    event(g, Q, 'found', `${gd.callsign}, sent to look${X ? ` at ${X.name}'s posts` : ''}, has ${body.callsign} down ${flat(gd.char.pos, at).toFixed(1)} m from him, ${(g.time - L.t0).toFixed(1)} s after he set off`, gd);
    contact(g, st, Q, at, roomOf(Q, at, 1), true, X ? gd : null);   // (another squad's rooms: 'contact — here!' is his own to say, standing over it)
    return true;
  };
  const lying = (around: boolean) => X ? X.men.find(m => m.state === 'dead' && !C.known.has(m) && bodySeen(g, gd, m, around ? LOOK_ROUND_M : false)) : who.state === 'dead' && !C.known.has(who) && around && bodySeen(g, gd, who, LOOK_ROUND_M) ? who : undefined;
  if (X && !L.back && !looking && (L.n = (L.n ?? 0) + 1) % 6 === 0) { const body = lying(false); if (body) return found(body); }   // (on his way through rooms that are not his squad's: a body in his open view, by the light on it — nobody else's eyes are on that squad's dead)
  if (!there && !looking) {
    if (!stuck && D.moveT <= 8) return false;   // on his way
    if (!(stuck && close) && L.tries < 8) { L.tries++; walk(g, D, goal); return false; }   // (the room fight ends a leg at ten seconds, or a second and a half of going nowhere: a longer way is walked in legs, a shut way tried again)
  }
  const reached = there || close;
  if (L.back) { if (reached) settle(g, L, D); return true; }   // (not reached: left where he is, the room fight's to plant)
  // at the post — or as near it as there is a way — looking about him: the body at his feet in any light, further off by the light on it, asked of his eyes
  // every frame for LOOK_SECS while he walks on to the spot itself
  L.lookT ??= g.time;
  { const body = lying(true); if (body) return found(body); }
  if (g.time - L.lookT < LOOK_SECS) {
    // (still his leg: the room fight plants a man who has arrived, or stood a second and a half — on the spot itself he stands and looks)
    if (gd.script?.arrived && flat(gd.char.pos, L.spot) < 0.5) { gd.script.arrived = false; D.stallT = 0; D.moveT = 0; }
    else if (gd.script?.arrived || D.stallT > 1 || D.moveT > 8) walk(g, D, L.spot);
    return false;
  }
  if (X ? !!Q.calls?.some(c => !!c.body && X.men.includes(c.body)) : callAbout(Q, who)) return false;   // (callBeat: his mate is on the air over the body — nobody turns for home or says 'no sign' under that)
  if (L.stops?.length) { L.spot = L.stops.shift()!; L.lookT = undefined; L.tries = 0; walk(g, D, L.spot); return false; }   // (netAsk: nothing at this post of the squad he was sent to — on to its next)
  // his mate is still on his way to look: this man has seen nothing from where he got to and goes back to his post; what the squad makes of it is his mate's to say
  if (C.look.some(Y => Y !== L && Y.who === who && !Y.back && alive(Y.gd) && !Y.gd.held && defOf(g, Y.gd)?.mode === 'move')) {
    L.back = true; L.tries = 0; walk(g, D, L.from);
    note(g, gd, `${Q.name}: ${gd.callsign} ${reached ? 'sees nothing of' : 'finds no way to'} ${who.callsign} and goes back; his mate is still on his way to look`);
    return false;
  }
  // no body to see (carried off, or the man is in somebody's arm elsewhere), or no way to his post: they go back to the posts they left, he is not asked for
  // again, and the squad is READY — its answer to the first call that says where they are comes without the thinking beat, as for a squad stood to on a
  // noise (Squad.ready). Nothing goes out on the net and no door is locked: a man missing is not a fight anybody can place. (Not decide() with a fix at
  // his post: a fix inside the squad's own rooms reads as a noise in them — contact)
  C.looked.add(who); turnBack(g, Q, who);
  onNet(g, gd, `${Q.name}: ${reached ? 'no sign of' : "can't get to"} ${L.all ? X!.name : mate(who)} — back on our doors!`);
  event(g, Q, 'no sign', `${L.all ? (reached ? `nobody of ${X!.name} is at its posts` : `no way to ${X!.name}'s posts`) : reached ? `${who.callsign} is not where he stood` : `no way to ${who.callsign}'s post`}: ${gd.callsign} and whoever came with him go back to their posts, the squad ready for a call`, gd);
  if (X) X.trouble = undefined;   // (netAsk: what the men sent found of X's trouble was said on the net)
  if (Q.state === 'hold') Q.ready = true;
  return false;
}

// ---------------------------------------------------------------- eyes: the squad calls what its man has noticed, not what crossed his eye (SQUADS.noticedEyes)
/** he has noticed the team by his own bar: 'alert' is where guards.ts puts him once his awareness passes 0.85 (he shouts and fights), 'search' is a man
 *  who had one of them and lost him. 'suspicious' (0.3: he turns to look) is a man who thinks he saw something — not a man who calls contact */
const noticed = (m: Guard) => m.state === 'alert' || m.state === 'search';
const GLIMPSED = new SideMap<Guard, number>('enemysquads.GLIMPSED');
/** the trace's row for a sighting the squad does not call (once per sighting: again only after 3 s without one). Always false: nothing is called */
function glimpse(g: Game, Q: Squad, m: Guard): boolean {
  const last = GLIMPSED.get(m) ?? -100; GLIMPSED.set(m, g.time);
  if (g.time - last > 3) event(g, Q, 'glimpse', `${m.callsign} has one of them in his eye and has not made him out (awareness ${m.awareness.toFixed(2)}, ${m.state}): nothing is called`, m);
  return false;
}

// ---------------------------------------------------------------- a contact call takes a beat and can be cut off (SQUADS.callBeat)
/** the floor is QUIET as far as this squad knows: it has never been in contact, no word of the team has reached it (the net's, or its own ears on a loud
 *  thing outside its rooms), and no man of it up has heard gunfire, a boot on a door or a charge. Only then is a call a thing with a length */
const callQuiet = (Q: Squad) => Q.state !== 'contact' && Q.state !== 'alerted' && Q.contactT <= -100 && Q.newsT <= -100 && !Q.men.some(x => { const H = x.witness.heard; return alive(x) && H.shots + H.kick + H.bang > 0; });
/** a man of the squad has something only he knows — the team in his eye, noticed (`body` null), or a mate down in it (`body`): on a quiet floor he keys up
 *  and it is his to say. true = the squad is NOT told this frame: his call is on the air (begun now, or already running: an eyes call keeps its place to his
 *  latest sighting), or he is in no state to make one; false = the floor is not quiet: the squad knows at once, as it always did */
function keyUp(g: Game, Q: Squad, m: Guard, at: Vec3, room: StructureRoom | null, body: Guard | null): boolean {
  if (!callQuiet(Q)) return false;
  if (!fit(g, m)) return true;   // (taken, blinded or reeling: he has it and cannot say it — no call, no line, nothing drawn; fit again with it still in his eye, he keys up)
  const L = Q.calls ??= [], c = L.find(x => x.by === m);
  if (c) { if (!body) { c.eyes = true; c.at = v3.copy(at); c.room = room; } return true; }
  const die = Q.callDie ??= checkDice(Q, 0x2545f491), [lo, hi] = SQUADS.callSecs, secs = lo + roll(die) * (hi - lo);
  L.push({ by: m, t0: g.time, end: g.time + secs, at: v3.copy(at), room, body, eyes: !body });
  onNet(g, m, `${Q.name}: ${mate(m)} — I've got—`, 2);
  event(g, Q, 'calls', `${m.callsign} keys up (${body ? `${body.callsign} down in his sight` : `one of them in his sight, ${m.state}`}): the squad has it in ${secs.toFixed(2)} s unless he is cut off`, m);
  return true;
}
/** is a man of the squad on the air about this mate's body (a man sent to look does not say 'no sign' over his mate's call) */
const callAbout = (Q: Squad, body: Guard) => !!Q.calls?.some(c => c.body === body);
/** once a frame for a squad with calls on the air, in two steps. callsCut (first thing in the squad's tick, its last man's call included): a caller dropped,
 *  taken, blinded or reeling is CUT OFF — his call is gone and nobody was told what he had. His mates heard it break off, though (`callCutAsk`, [0, 0] =
 *  none of this): with the radio check on, a caller off the net (down, taken), the squad not in contact and a fit mate left, he is FILED as a man who does
 *  not answer where he is (in the squad's rooms or out on its floor — as a man sent to look who drops on his way is) and asked for by name `callCutAsk`
 *  later: through the check's own 'called' stage with him named when the check is free (or has only just been called), so its ask, its men to where he
 *  was and its 'found' / 'no sign' follow as for any man who does not answer; with the check's hands full (another man being asked for, men out looking,
 *  the squad's word due) he waits on `Check.cut` and is asked for as soon as that is done — `idle()` keeps the next check from sliding a whole beat. A
 *  blinded or reeling caller is on the net still: nobody asks for him, and he keys up again only if he has it in his eye once he is fit. callsTick, after
 *  the squad's own senses have had the frame: `busy`
 *  (the squad is in contact by another road this frame): nobody finishes a sentence over a fight. Else the first call to END — or every call, the moment the
 *  floor is no longer quiet (gunfire heard: his own first round, by his mates) — is the squad's: returned for the caller to make the contact it always was */
function callsCut(g: Game, Q: Squad) {
  const L = Q.calls!;
  for (let i = L.length - 1; i >= 0; i--) {
    const c = L[i]; if (fit(g, c.by)) continue;
    L.splice(i, 1);
    const m = c.by;
    // (netCutAlarm) the net sent him to find out why a squad is silent; his squad heard him key up, and then nothing: that IS what he found. A man of it at
    // home calls contact at the post he was sent to (what the squad knows — not where the team is), and the net has its answer about that squad
    const sentBy = netAsks(g) && SQUADS.netCutAlarm && offNet(m) && Q.state !== 'contact' ? Q.rc?.netOut?.get(m) : undefined, st = sentBy ? STATES.get(g) : undefined;
    const says = sentBy && st && g.time - sentBy.t < NET_OUT_SECS ? home(g, Q).find(D => D.gd !== m)?.gd ?? null : null;
    if (sentBy && st && says) {
      const X = sentBy.about;
      event(g, Q, 'cut off', `${m.callsign}'s call is cut off ${(g.time - c.t0).toFixed(1)} s in, ${(c.end - g.time).toFixed(1)} s short (${!alive(m) ? 'down' : 'taken'}): he was sent to look at ${X.name}, and his breaking off is what he found — ${says.callsign} calls it`, m);
      Q.rc!.netOut!.delete(m); Q.rc!.known.add(m); if (!alive(m)) Q.fallen.add(m); if (!X.men.some(x => !offNet(x))) st.nc?.done.add(X); X.trouble = undefined;   // (… and where he fell is not a second call: nobody saw it)
      contact(g, st, Q, sentBy.at, null, true, says, { say: `${Q.name}: ${mate(m)} cut off at ${X.name} — contact, ${X.name}!`, why: `${X.name}'s posts: ${m.callsign}, sent there to look, keyed up and was cut off` });
      continue;
    }
    const tail = cutAsk(g, Q, m);
    // (blinded or reeling, on the net still: nobody asks — but half a sentence went out, and if he goes OFF the net before he has keyed up again his mates ask after all: callsHung)
    if (!offNet(m) && SQUADS.callBeat && SQUADS.radioCheck && SQUADS.callCutAsk[1] > 0 && Q.state !== 'contact') (Q.hung ??= []).push({ who: m, t: g.time });
    event(g, Q, 'cut off', `${m.callsign}'s call is cut off ${(g.time - c.t0).toFixed(1)} s in, ${(c.end - g.time).toFixed(1)} s short (${!alive(m) ? 'down' : m.held ? 'taken' : 'blinded or reeling'}): the squad has been told nothing${tail}`, m);
  }
}
/** how long a man the net sent counts as out on that errand (he is struck off sooner when he is home again, or his squad is in contact) */
const NET_OUT_SECS = 90;
/** how long after a call broke off under a blinded or reeling man his mates still hold his silence against it (callsHung) */
const HUNG_SECS = 10;
/** (callCutAsk) the mates of a man whose call broke off, he being off the net (down, taken): he is filed where he is and asked for by name — callsCut's
 *  comment has the three roads. Returns the trace row's tail: '' = nobody asks (the ask is off, the squad is in contact, he is on the net, or no fit mate) */
function cutAsk(g: Game, Q: Squad, m: Guard): string {
  const K = SQUADS, [lo, hi] = K.callCutAsk;
  const mate = K.callBeat && K.radioCheck && hi > 0 && offNet(m) && Q.state !== 'contact' ? home(g, Q).find(D => D.gd !== m)?.gd ?? Q.men.find(x => x !== m && fit(g, x)) ?? null : null;
  if (!mate) return '';
  const C = rcOf(g, Q), ask = lo + roll(Q.askDie ??= checkDice(Q, 0x3c6ef372)) * (hi - lo), D0 = defOf(g, m);
  // (a man out looking or sent to a door, or one the room fight has not planted — a looker who keyed up by his eyes on his way: his station is the post he LEFT)
  const from = C.afield?.get(m); if (from && flat(m.char.pos, from) <= 3) C.afield!.delete(m);
  const out = C.look.some(X => X.gd === m) || Q.sent.some(x => x.gd === m) || !D0 || !!from && flat(m.char.pos, from) > 3;
  wentSilent(g, Q, m, alive(m) && !out ? D0!.station : undefined, true);   // (the one who does not answer: taken at home, at his station, as the check files a man in Sam's arm; taken on an errand or down, where he is — in the squad's rooms or out on its floor)
  (C.promised ??= new Set()).add(m);
  const free = Q.state !== 'alerted';   // (its word due: the check would drop an ask the same frame — he waits for the word to be out)
  if (free && C.stage === 'idle' && !C.look.length) { C.stage = 'called'; C.byEar = false; C.caller = mate; C.who = m; C.t0 = g.time + ask - K.checkAsk; return ` — ${mate.callsign} heard it break off and asks for him in ${ask.toFixed(1)} s`; }
  const was = C.who !== m ? C.who : null, twin = !!was && !C.byEar && C.silent.find(x => x.gd === was)?.t === g.time;   // (two calls cut off on ONE frame: the first keeps its ask, the second waits its turn)
  if (free && C.stage === 'called' && !twin) {   // (a check just called, or one about to ask for another man: the voice that has just stopped is the one it asks for first, no later than this)
    const wasEar = C.byEar;
    if (was && wasEar) { const q = C.silent.find(x => x.gd === was); if (q) q.heard = false; }   // (the man a mate's ears were about to ask for: those ears ask again once this is done, or the routine check does)
    else if (was && owedOf(C, was)) (C.cut ??= []).unshift({ who: was, at: g.time });   // (an older call that broke off, not yet asked for: next)
    if (wasEar || !C.caller || C.caller === m || !fit(g, C.caller)) C.caller = mate;
    C.byEar = false; C.who = m; C.t0 = Math.min(C.t0, g.time + ask - K.checkAsk);
    return ` — heard to break off: the check ${C.caller?.callsign ?? 'a mate'} ${was ? `was about to ask for ${was.callsign} with` : 'has just called'} asks for him first, within ${ask.toFixed(1)} s`;
  }
  (C.cut ??= []).push({ who: m, at: g.time + ask }); C.beat ??= C.nextAt; C.nextAt = Math.min(C.nextAt, g.time + ask);
  return ` — heard to break off: he is asked for by name once ${!free ? "the squad's word is out" : C.look.length ? 'the men out looking are home' : 'the check under way is done'}`;
}
const owedOf = (C: Check, who: Guard) => offNet(who) && !C.known.has(who) && !C.looked.has(who);
/** (callCutAsk) the men whose call broke off while they were blinded or reeling: one who goes off the net (dropped, taken) inside HUNG_SECS of it, without
 *  having keyed up again, is asked for as if his call had been cut by that — his mates heard half a sentence and then nothing. Fit again and on the air, the
 *  squad in contact, or the time up: nobody holds it against his silence any more */
function callsHung(g: Game, Q: Squad) {
  const L = Q.hung!;
  for (let i = L.length - 1; i >= 0; i--) {
    const h = L[i], m = h.who;
    if (g.time - h.t > HUNG_SECS || g.time < h.t || Q.state === 'contact' || Q.calls?.some(c => c.by === m)) { L.splice(i, 1); continue; }
    if (!offNet(m)) continue;
    L.splice(i, 1);
    const tail = cutAsk(g, Q, m); if (!tail) continue;
    note(g, m, `${Q.name}: ${m.callsign}, whose call broke off ${(g.time - h.t).toFixed(1)} s ago, is ${alive(m) ? 'taken' : 'down'} and has said nothing since${tail}`);
  }
}
function callsTick(g: Game, Q: Squad, busy: boolean): Call | null {
  const L = Q.calls!; let done: Call | null = null;
  if (busy) { L.length = 0; return null; }
  const loud = !callQuiet(Q);
  for (const c of L) if ((loud || g.time >= c.end) && (!done || c.end < done.end)) done = c;
  if (!done) return null;
  L.length = 0;
  if (done.body && Q.rc) { Q.rc.known.add(done.body); if (netAsks(g)) { const st = STATES.get(g), X = st?.of.get(done.body); if (st && X && X !== Q) seenTo(st, X, done.body); } event(g, Q, 'found', `${done.by.callsign} has said it: ${done.body.callsign} is down${loud && g.time < done.end ? ' (the floor went loud under his call)' : ''}, ${(g.time - done.t0).toFixed(1)} s after he keyed up`, done.by); }
  else event(g, Q, 'said', `${done.by.callsign}'s call is through${loud && g.time < done.end ? ' at once (the floor went loud under it)' : ''}, ${(g.time - done.t0).toFixed(1)} s after he keyed up`, done.by);
  return done;
}
/** tools and the panel: the calls on the air in this game right now (who, since when, until when, about what) */
export function squadCalls(g: Game): { squad: string; by: Guard; t0: number; end: number; body: Guard | null }[] {
  return (STATES.get(g)?.squads ?? []).flatMap(Q => (Q.calls ?? []).map(c => ({ squad: Q.name, by: c.by, t0: c.t0, end: c.end, body: c.body })));
}

// ---------------------------------------------------------------- the net asks after a squad that has gone silent (SQUADS.netAsk)
/** every squad has heard that one of them is not answering: stood to (its answer to a contact call comes without the thinking beat) and counting its own
 *  men at the quicker beat. Nobody is in contact by it and nobody is told where anybody is */
function netWary(g: Game, st: State, about: string) {
  for (const Q of st.squads) { if (Q.state === 'down') continue;
    if (!Q.wary) note(g, null, `${Q.name} is wary (${about} is not answering): stood to, its own men counted oftener`);
    Q.wary = true; if (Q.state === 'hold') Q.ready = true; }
}
/** a man of squad X has been seen down by a man of another squad, and it is on the net: X's own check knows it too, and the net has its answer about X */
function seenTo(st: State, X: Squad, body: Guard) { X.rc?.known.add(body); if (!X.men.some(m => !offNet(m))) st.nc?.done.add(X); X.trouble = undefined; }
/** a line said a breath after the one it answers (the net's check says it when its time comes, if the man is still on the net) */
const NET_BREATH = 1.2;
function netSay(g: Game, st: State, after: number, gd: Guard, text: string, cls?: number) { if (st.nc) st.nc.say.push({ t: g.time + after, gd, text, cls }); else onNet(g, gd, text, cls); }
/** men a squad has asked for or sent, with no answer and no end heard: a squad waiting on one of its own has nobody to spare, and says so when asked */
function waitsOn(Q: Squad): Guard[] { const C = Q.rc; return C ? Q.men.filter(m => (C.looked.has(m) || !!C.asked?.has(m) || !!C.out?.has(m)) && offNet(m) && !C.known.has(m)) : []; }
/** men of the nearest squad that can spare them set off for squad X's posts (`stops`, in the order walked; `who` = the man of X the first is the post of):
 *  a squad allowed out of its rooms and HOLDING (not in a fight, its word not due, and not on a word it has given: a squad that has locked its doors or sent men round keeps them there), nobody of its own out on a leg or looking, its men past one a room and one left at
 *  home on the net — and not a man still standing where a way round left him (the door he was set on). A squad that can send two before one that can send one,
 *  the nearer first. `all`: the whole of X is not answering (they turn back if anybody of it does). null = nobody anywhere can go */
function netSend(g: Game, st: State, X: Squad, who: Guard, stops: Vec3[], all: boolean): { Q: Squad; go: Def[] } | null {
  const K = SQUADS, at = stops[0]; let best: { Q: Squad; go: Def[]; d: number } | null = null;
  for (const Q of st.squads) {
    const stays = Q.def.mayLeave === false, n = stays ? STAYASK.men : K.netLookMen;   // (stayask.ts: on a floor where every squad stays, one that stays sends its one man)
    if (Q === X || n < 1 || Q.state !== 'hold' || (stays && !st.stayAsk) || Q.sent.some(s => alive(s.gd)) || Q.calls?.length) continue;
    const C0 = Q.rc; if (C0 && (C0.look.length || C0.stage === 'asked' || C0.cut?.length) || Q.trouble !== undefined || C0?.out && [...C0.out].some(m => offNet(m) && !C0.known.has(m))) continue;   // (trouble of its own: a man asked for, men out, a call that broke off, or men it sent who have not been heard of since)
    const H = home(g, Q), free = H.filter(D => !Q.went.some(s => s.gd === D.gd));
    const go = goers(free, at, Math.min(n, H.length - 1)); if (go.length < n) continue;   // (the number is the rule: nobody is sent across the floor short of it)
    const d = Math.min(...go.map(D => flat(D.gd.char.pos, at)));
    if (!best || d < best.d) best = { Q, go, d };
  }
  if (!best) return null;
  const C = rcOf(g, best.Q);
  for (const D of best.go) { C.look.push({ ...looker(g, best.Q, D, who, at), about: X, all, stops: stops.slice(1).map(p => v3.copy(p)) }); (C.out ??= new Set()).add(D.gd); (C.netOut ??= new Map()).set(D.gd, { about: X, at: v3.copy(at), t: g.time }); walk(g, D, at); }
  return best;
}
/** once a frame with the switch on, after every squad's own senses and words have had the frame: the net's roll call of the squads, the question that
 *  follows a squad's trouble nobody heard the end of, the ask by name, and the men who go (SQUADS.netAsk has the rule). What it reads of a squad it asks
 *  about is whether anybody of it ANSWERS (a man not down and not in somebody's arm), as a squad's own check reads its men */
/** how often a squad that does not answer is asked for by name with nobody sent (once, when the squad asking is the only one left on the net) */
const NET_TRIES = 2;
function netCheck(g: Game, st: State) {
  const K = SQUADS;
  const N: NetCheck = st.nc ??= (() => { const die = checkDice(st.squads[0], 0x1b873593); return { nextAt: g.time + (0.5 + 0.5 * roll(die)) * K.netEvery, stage: 'idle' as const, t0: 0, caller: null, about: null, done: new Set<Squad>(), tried: new Map<Squad, number>(), queried: new Map<Squad, number>(), say: [], die, tickT: g.time }; })();
  const beat = () => K.netEvery * (st.squads.some(Q => Q.wary || Q.newsT > -100 || Q.contactT > -100) ? K.checkAlertK : 1) * (1 + (roll(N.die) * 2 - 1) * K.checkJitter);
  const idle = (after: number) => { N.stage = 'idle'; N.about = null; N.caller = null; N.nextAt = g.time + after; };
  if (g.time - N.tickT > 1) idle(beat());   // (the switch was off a while: no check half run is taken up again)
  N.tickT = g.time;
  for (let i = 0; i < N.say.length; i++) { const l = N.say[i]; if (g.time < l.t) continue; N.say.splice(i--, 1); if (!offNet(l.gd)) onNet(g, l.gd, l.text, l.cls); }
  const answers = (X: Squad) => X.men.some(m => !offNet(m));
  /** X was asked for by name and nobody went: once more at a later check, then the net lets it be (the squads stay wary) */
  const failed = (X: Squad, why: string) => { const n = (N.tried.get(X) ?? 0) + 1, cap = st.squads.filter(answers).length < 2 ? 1 : NET_TRIES; N.tried.set(X, n); X.trouble = undefined;
    if (n >= cap) N.done.add(X);
    note(g, N.caller, `${why} ${X.name}: ${n >= cap ? 'the net does not ask for it again — the squads stay wary' : 'asked for once more at a later check'}`); };
  // a floor in a fight, a squad's word due, a contact call these last seconds: the net has its own traffic — nobody calls a roll over it, one half run is
  // dropped (the squads' own words say who is not answering in a fight: decide()), and a squad that answers has nothing left to be asked about
  const lastCall = st.net.length ? st.net[st.net.length - 1].t : -100;
  if (st.squads.some(Q => Q.state === 'contact' || Q.state === 'alerted') || g.time - lastCall < K.settleSecs) {
    if (N.stage === 'asked' && N.about) failed(N.about, 'the net has a fight on it, and nobody is sent to look for');
    else if (N.stage !== 'idle') note(g, N.caller, `the net's check is dropped: the net has a fight on it`);
    for (const X of st.squads) if (X.trouble !== undefined && answers(X)) X.trouble = undefined;
    N.stage = 'idle'; N.about = null; N.caller = null; N.nextAt = Math.max(N.nextAt, g.time + 5); return;
  }
  if (st.squads.some(Q => !!Q.calls?.length)) return;   // (a man on the air: the net waits for him — what he says, or his breaking off, is news of its own)
  const sq = (m: Guard) => st.of.get(m)!;
  const outFor = (X: Squad) => st.squads.some(Q => !!Q.rc?.look.some(L => L.about === X && !L.back));
  /** not answering, and nobody knows why: it never put a contact call on the net, nobody has been to its posts, nobody is on his way */
  const silent = (X: Squad) => !answers(X) && X.calledT <= -100 && !N.done.has(X) && !outFor(X);
  const posts = (X: Squad) => { const P: { at: Vec3; m: Guard }[] = []; for (const m of X.men) { const s = defOf(g, m)?.station; if (s && !P.some(p => flat(p.at, s) < 2.5)) P.push({ at: v3.copy(s), m }); } return P; };
  /** the man who asks: the man at home nearest X's posts, of any other squad */
  const asker = (X: Squad): Guard | null => { const P = posts(X); let best: Guard | null = null, bd = Infinity;
    for (const Q of st.squads) { if (Q === X) continue; for (const D of home(g, Q)) { const d = P.length ? Math.min(...P.map(p => flat(p.at, D.gd.char.pos))) : 0; if (d < bd) { bd = d; best = D.gd; } } }
    return best; };
  const askFor = (X: Squad, by: Guard, why: string) => { N.stage = 'asked'; N.about = X; N.caller = by; N.t0 = g.time;
    onNet(g, by, `${sq(by).name}: ${X.name}? … ${X.name}, sound off`, 2); event(g, sq(by), 'net asks', why, by); };
  switch (N.stage) {
    case 'idle': {
      // (b) a squad's trouble on the air, and nothing after
      for (const X of st.squads) {
        if (X.trouble === undefined) continue;
        if (X.calledT > -100 || N.done.has(X) || answers(X) && st.squads.some(Q => Q.contactT > -100 && g.time - Q.contactT < K.againSecs)) { X.trouble = undefined; continue; }   // (… or the floor has had a contact call since: the team is what is going on)
        const [lo, hi] = K.netBeat, due = X.trouble + lo + ((X.trouble * 7.31) % 1) * (hi - lo);   // (the beat is the trouble's own: no die is drawn for a question that may never be asked)
        if (g.time < due || outFor(X)) continue;
        const by = asker(X); if (!by) continue;
        if (answers(X) && (N.queried.get(X) ?? 0) >= NET_TRIES) { X.trouble = undefined; continue; }   // (asked twice already: its own check has it, and the squads are wary)
        if (!answers(X)) { askFor(X, by, `nothing from ${X.name} since the trouble on its net ${(g.time - X.trouble).toFixed(1)} s ago: ${by.callsign} asks for the squad by name`); return; }
        const ans = home(g, X)[0]?.gd ?? X.men.find(m => fit(g, m)) ?? null, C = X.rc, busy = !!C && (C.look.length > 0 || C.stage !== 'idle' || !!C.cut?.length);
        const gone = waitsOn(X), n = (N.queried.get(X) ?? 0) + 1;   // (what the man answering knows: who was asked for or sent, and has not been heard of)
        onNet(g, by, `${sq(by).name}: ${X.name} — what's going on?`, 4);
        if (ans) netSay(g, st, NET_BREATH, ans, busy ? `${X.name}: ${C!.look.length ? 'still looking' : 'checking our own'} — stand by` : gone.length ? `${X.name}: still nothing from ${gone.length > 1 ? `${COUNT[gone.length] ?? gone.length} of ours` : mate(gone[0])}` : `${X.name}: all up here — nothing more`, 4);
        event(g, sq(by), 'net query', `${by.callsign} asks ${X.name} what became of the trouble on its net: ${ans ? `${ans.callsign} answers${busy ? ', still at it' : gone.length ? `: ${gone.map(m => m.callsign).join(', ')} not heard of` : ''}` : 'a man of it is on the net and cannot speak yet'}`, by);
        N.queried.set(X, n);
        X.trouble = (busy || !ans) && n < NET_TRIES ? g.time + hi : undefined;   // (still at it: asked once more later if nothing more is heard — and no oftener)
        if (ans && !busy && gone.length || (busy || !ans) && n >= NET_TRIES) netWary(g, st, `${gone[0]?.callsign ?? 'a man'} of ${X.name}`);   // (men missing and nothing found, or still no end to it: the squads stand to)
      }
      // (a) the net's own check
      if (g.time < N.nextAt) return;
      if (st.squads.some(Q => answers(Q) && !!Q.rc && Q.rc.stage !== 'idle')) return;   // (a squad is counting its own men: the roll waits for it — not for one that went down in the middle of its count, whose count nobody finishes)
      if (st.squads.filter(answers).length < 2 && !st.squads.some(silent)) return idle(beat());   // (one squad left and nobody unaccounted for: it has its own check)
      const lead = st.squads.filter(Q => Q.trouble === undefined).map(Q => home(g, Q)[0]?.gd).find(m => !!m) ?? st.squads.map(Q => home(g, Q)[0]?.gd).find(m => !!m) ?? null;   // (a squad with no trouble of its own, if there is one)
      if (!lead) { N.nextAt = g.time + 5; return; }   // (nobody free to call it: tried again shortly)
      N.stage = 'called'; N.t0 = g.time; N.caller = lead;
      onNet(g, lead, `${sq(lead).name}: all squads — radio check`, 6, false);   // (a routine line, like a squad's own 'sound off': no row of the run's chronicle)
      event(g, sq(lead), 'net check', `${lead.callsign} calls the net's check of the squads`, lead);
      return;
    }
    case 'called': {
      if (g.time - N.t0 < K.checkAsk) return;
      const X = st.squads.filter(silent).sort((a, b) => (N.tried.get(a) ?? 0) - (N.tried.get(b) ?? 0))[0]; if (!X) return idle(beat());   // (every squad answered, or is accounted for; of two that did not, the one not asked for yet)
      const by = asker(X); if (!by) return idle(5);
      askFor(X, by, `no answer from ${X.name} to the net's check: ${by.callsign} asks for the squad by name`);
      return;
    }
    case 'asked': {
      const X = N.about!;
      if (answers(X) || X.calledT > -100) { note(g, N.caller, `${X.name} is on the net again: nobody goes`); return idle(beat()); }
      if (g.time - N.t0 < K.checkAsk) return;   // (the breath it is given to answer)
      // its posts, as its own side knows them: the one nearest the man who asked first, each next the nearest to the last
      const P = posts(X), stops: Vec3[] = []; let who: Guard | null = null, cur: Vec3 = N.caller?.char.pos ?? P[0]?.at;
      while (P.length && stops.length < K.netStops) { P.sort((a, b) => flat(a.at, cur) - flat(b.at, cur)); const p = P.shift()!; who ??= p.m; cur = p.at; stops.push(p.at); }
      if (!who) { N.done.add(X); return idle(beat()); }
      const sent = netSend(g, st, X, who, stops, true);
      if (!sent) {   // (no squad has the men to spare: that is said too, and every squad stands to all the same)
        if (N.caller && !offNet(N.caller)) onNet(g, N.caller, `${sq(N.caller).name}: nothing from ${X.name} — nobody to send, stay on your doors!`);
        netWary(g, st, X.name); failed(X, 'nobody free to go and look for'); return idle(beat());
      }
      N.done.add(X); X.trouble = undefined;
      onNet(g, sent.go[0].gd, `${sent.Q.name}: nothing from ${X.name} — ${COUNT[sent.go.length] ?? sent.go.length} moving to their rooms!`);
      event(g, sent.Q, 'net looks', `${sent.go.map(D => D.gd.callsign).join(' and ')} walk${sent.go.length > 1 ? '' : 's'} to ${X.name}'s posts (${stops.length} of them), ${flat(sent.go[0].gd.char.pos, stops[0]).toFixed(0)} m off: nobody knows what became of it, and every squad is wary`, sent.go[0].gd);
      netWary(g, st, X.name);
      return idle(beat());
    }
  }
}

// ---------------------------------------------------------------- once a frame
/** roomclear.ts tick, while the room clear is live: every squad's contact, news, choice and men on the move */
export function squadsTick(g: Game) {
  const st = STATES.get(g); if (!st) return;
  const F = g.fight, K = SQUADS;
  if (!F.defs.length) return;   // (the room fight has not taken the men up yet, or a show has the floor)
  // 1 · contact, by its own men's senses: one of them at home with eyes on the team, a loud thing heard INSIDE its rooms, a man of it dropped there
  for (const Q of st.squads) {
    const up = Q.men.filter(alive);
    if (Q.calls?.length) callsCut(g, Q);   // (callBeat) a caller dropped, taken or reeling says no more
    if (Q.hung?.length) callsHung(g, Q);   // (callCutAsk) … and one who was reeling when it broke off, and has gone off the net since
    if (!up.length) { if (Q.state !== 'down') { Q.state = 'down'; Q.due.length = 0; Q.events.push({ t: g.time, what: 'down', n: 0, why: 'every man of it is down' }); note(g, null, `${Q.name} down`); } continue; }
    let at: Vec3 | null = null, room: StructureRoom | null = null, byDrop = false;
    for (const m of up) {
      if (Q.sent.some(s => s.gd === m)) continue;
      const D = defOf(g, m), mine = roomOf(Q, m.char.pos, 1); if (!D || !mine) continue;   // (a man of it out on the floor is his own fight, not the squad's rooms')
      if (g.time - m.lastSeenT < 1 && (!K.noticedEyes || noticed(m) || glimpse(g, Q, m))) {
        const p = m.lastKnown && m.lastKnown !== D.pt ? m.lastKnown : m.char.pos, r = roomOf(Q, p, 0.75) ?? mine;
        if (!(K.callBeat && noticed(m) && keyUp(g, Q, m, p, r, null))) { at = p; room = r; break; }   // (callBeat, a quiet floor: what he has noticed is his to say first — the squad has it when his call ends)
      }
      if (D.noiseAt && g.time - D.noiseT < 1) { const r = roomOf(Q, D.noiseAt);   // (no margin: a man's ears are a few metres out, and a shot outside the wall is not a fight in the room)
        if (r) { at = D.noiseAt; room = r; break; } }
    }
    for (const m of Q.men) {
      if (alive(m) || Q.fallen.has(m)) continue;
      Q.fallen.add(m);
      const r = Q.sent.some(s => s.gd === m) ? null : roomOf(Q, m.char.pos, 1);
      if (K.radioCheck && r && !at && Q.state !== 'contact' && !heardFire(g, Q, up)) { wentSilent(g, Q, m); continue; }   // (radioCheck: a drop no mate at home heard gunfire with tells nobody — a mate's eyes or the net's check find it out)
      if (r && !at && up.some(x => !!roomOf(Q, x.char.pos, 1))) { at = m.char.pos; room = r; byDrop = true; }   // (dropped at home, with a mate at home to know it)
    }
    if (K.radioCheck) { const f = radioCheck(g, Q, !!at || Q.state === 'contact'); if (f) { at = f.at; room = f.room; byDrop = true; } }
    else if (Q.rc) for (const q of Q.rc.silent) {   // (the switch turned off under it, on the panel: the drops it was keeping quiet are known the way they are with it off — a mate at home knows)
      if (alive(q.gd) || Q.rc.known.has(q.gd)) continue;
      Q.rc.known.add(q.gd);
      const r = roomOf(Q, q.at, 1); if (r && !at && up.some(x => !!roomOf(Q, x.char.pos, 1))) { at = q.at; room = r; byDrop = true; }   // (at home only, as the rule with it off)
    }
    let by: Guard | null = null;
    if (Q.calls?.length) { const c = callsTick(g, Q, !!at || Q.state === 'contact'); if (c) { at = c.at; room = c.room; byDrop = !c.eyes; by = c.by; } }   // (callBeat) a call that has ended is the squad's contact, said by the man who made it
    if (at) contact(g, st, Q, at, room, byDrop, by);
    else if (Q.state === 'contact' && g.time - Q.contactT > K.quietSecs) { Q.state = 'hold'; Q.fix = null; event(g, Q, 'quiet', 'nothing of the team seen or heard in its rooms'); }
    // its men in its other rooms, their beat up
    for (let i = Q.due.length - 1; i >= 0; i--) {
      const d = Q.due[i]; if (g.time < d.t) continue;
      Q.due.splice(i, 1);
      const D = home(g, Q).find(X => X.gd === d.gd); if (!D || Q.state !== 'contact') continue;   // (blinded, grabbed, down or in a fight of his own since: not sent)
      const lost = d.room ?? Q.hitRoom;
      const upIn = lost ? Q.men.filter(m => alive(m) && roomOf(Q, m.char.pos, 0.05) === lost).length : 0;
      if (squadDrill(g)?.drillOwn && lost && upIn < squadDrill(g)!.ownUp) {   // (a drilled garrison: the room under attack is as good as gone — he is not fed into it alone. He keeps his own doors; contact() does not ask him again for that room)
        if (!Q.ownSaid || g.time - Q.ownSaid > 20) { Q.ownSaid = g.time; g.say(d.gd, `${Q.name}: ${lost.name}'s ${upIn ? 'hit' : 'gone'} — stay on your doors, make them come!`, true); }
        (Q.stayed ??= new Set()).add(stayKey(d.gd, lost)); event(g, Q, 'stays', `${d.gd.callsign} does not go to ${lost.name}: ${upIn === 1 ? 'one man' : upIn ? COUNT[upIn] + ' men' : 'nobody'} of the squad is up in it`, d.gd);
        continue;
      }
      Q.sent.push({ gd: d.gd, from: v3.copy(D.station), role: 'reinforce', phase: 'loose', spot: null, door: null, fixAt: d.at, tries: 0, stepT: -100, t0: g.time }); loose(g, D, d.at);
      const way = K.way ? wayName(g.level, g.col.nav, d.gd.char.pos, d.gd.lastKnown ?? d.at, lost ? lost.name : null) : null;   // (loose() has just set where he goes: the squad's fix, or the place he saw them himself a moment ago)
      g.say(d.gd, `${Q.name}: coming to you${way ? ` ${way}` : ''} — hold on!`, true); event(g, Q, 'reinforce', `${d.gd.callsign} goes to the squad's room under attack`, d.gd);
    }
  }
  // 2 · news: the net's word of another squad's contact, or its own men's ears on a loud thing outside its rooms
  for (const Q of st.squads) {
    if (Q.state === 'down' || Q.state === 'contact' || Q.state === 'alerted') continue;
    const settled = g.time - Q.decidedAt >= K.settleSecs;   // (a squad that stood to on a noise nobody could place takes a CALL at once: that is what it was waiting for)
    if (!settled && !Q.ready) continue;
    let fix: Fix | null = null; const nk = netK(g), beat = nk !== 1 && mayGo(g, Q) ? nk : 1, waits = beat > 1;
    for (let i = st.net.length - 1; i >= 0 && !fix; i--) { const c = st.net[i]; if (g.time - c.t > 10) break; if (c.squad !== Q && c.t > Q.newsT && g.time - c.t >= K.netLag * beat) fix = { at: c.at, t: c.t, ally: c.squad, by: 'net' }; }
    if (!fix && settled) for (const D of home(g, Q)) {
      if (!D.noiseAt || !D.noiseOut || D.noiseT <= Q.newsT || g.time - D.noiseT > 1.5 || roomOf(Q, D.noiseAt)) continue;
      fix = { at: v3.copy(D.noiseAt), t: D.noiseT, ally: null, by: 'ears' }; break;   // (whose fight it is: settled when the squad decides — the net may know by then)
    }
    if (!fix) continue;
    Q.newsT = Math.max(Q.newsT, fix.t);
    const same = !!Q.fix && (fix.by === 'net' ? Q.fix.ally === fix.ally : flat(Q.fix.at, fix.at) < 10);
    if (same && Q.state !== 'hold' && g.time - Q.decidedAt < K.againSecs) continue;   // the fight it has already answered
    // (a drilled garrison that could go waits its longer beat even when it had stood to: the pair it sends is meant to be late. cues.ts words ', holds' as
    // '<Squad>: hold — let them come in. Wait for my word!' in place of '… stand by')
    Q.decideAt = g.time + (Q.ready && fix.by === 'net' && !waits ? K.readyBeat : pick(K.think) * beat);
    Q.fix = fix; Q.state = 'alerted';
    note(g, null, `${Q.name} hears of them (${fix.by === 'net' ? fix.ally!.name + "'s call" : 'its own ears'})${waits ? ', holds' : ''}: its word in ${(Q.decideAt - g.time).toFixed(1)} s`);
  }
  for (const Q of st.squads) if (Q.state === 'alerted' && g.time >= Q.decideAt) decide(g, st, Q);
  if (netAsks(g) && K.radioCheck) netCheck(g, st);   // (netAsk) the net's check of the squads: one that has gone silent is asked after
  lookOut(g, st);   // (drillLook) a drilled garrison that has lost the team sends a pair to look
  // 3 · the men who were sent
  const lostWhy = (s: Sent) => `${s.gd.callsign} down ${s.back ? 'on his way back to his post' : s.phase === 'run' ? 'on the way' : s.there !== undefined && s.spot && flat(s.gd.char.pos, s.spot) < 4 ? 'at his spot' : s.there !== undefined ? (s.hold ? 'after leaving his spot' : 'after going in') : s.phase === 'set' ? 'where he stopped' : 'in the fight he ran into'}${s.door ? ' (' + s.door.def.name + ')' : ''}, ${(g.time - s.t0).toFixed(1)} s after the word`;
  for (const Q of st.squads) {
    if (Q.rc) for (let i = Q.rc.look.length - 1; i >= 0; i--) if (looks(g, st, Q, Q.rc.look[i])) { const L = Q.rc.look[i];
      if (K.callBeat && K.callCutAsk[1] > 0 && !L.back && alive(L.gd)) (Q.rc.afield ??= new Map()).set(L.gd, L.from);   // (callCutAsk: no longer a man out looking — by his eyes, on his way — and not at his post either: cutAsk files him where he is)
      if (L.back && !offNet(L.gd)) { Q.rc.netOut?.delete(L.gd); Q.rc.out?.delete(L.gd); }   // (netAsk: home again from the errand — no longer a man out)
      Q.rc.look.splice(i, 1); }   // (radioCheck) its men out looking for one who does not answer
    // (goRound) a man who went round and is no longer out: what became of him is still his squad's to say
    for (let i = Q.went.length - 1; i >= 0; i--) if (!alive(Q.went[i].gd)) { event(g, Q, 'lost', lostWhy(Q.went[i])); Q.went.splice(i, 1); }
    for (let i = Q.sent.length - 1; i >= 0; i--) {
      const s = Q.sent[i], gd = s.gd, D = defOf(g, gd);
      const home = () => { Q.sent.splice(i, 1); if (K.goRound && s.role === 'flank') { Q.went.push(s); if (Q.went.length > 8) Q.went.shift(); } };
      if (!alive(gd) || !D) { if (K.goRound && s.role === 'flank' && !alive(gd)) event(g, Q, 'lost', lostWhy(s)); Q.sent.splice(i, 1); continue; }
      if (s.phase === 'run') {
        s.stepT = boots(g, gd, s.stepT);   // (a script's tread is sound only: his boots are filed so the team's ears get them — pressure.ts's own rule)
        if (D.mode === 'move') {   // (a mark of his way reached, or passed wide of, on the move: the next one is his goal)
          const w = s.way, at = gd.char.pos; if (w && w.length > 1 && (flat(at, w[0]) < 1.4 || flat(at, w[1]) < flat(w[0], w[1]))) { w.shift(); run(g, D, w[0], s.door, 0.3); }
          continue; }
        const there = !!s.spot && flat(gd.char.pos, s.spot) < 2, seen = g.time - gd.lastSeenT < 1;
        if (s.back) {   // (drillBack) home again, or stopped by the fight on his way: his squad's man at home either way
          if (D.mode === 'hold' && !there && !seen && s.tries < 3 && s.spot && fit(g, gd)) { s.tries++; run(g, D, s.spot, null, 0.3); continue; }
          Q.sent.splice(i, 1); continue; }   // (not `went`: he came home — what becomes of him now is his room's story, not the pair's)
        if (D.mode === 'hold' && !there && !seen && s.tries < 3 && s.spot && fit(g, gd)) { s.tries++; run(g, D, s.way?.[0] ?? s.spot, s.door, 0.3); continue; }   // (the room fight's move is ten seconds long: a longer way round is run in legs)
        if (K.goRound && s.role === 'flank' && D.mode === 'hold' && (s.hold ? there || seen : seen && !there)) {
          // he HOLDS where he has got to (planted there by the room fight: roomfight.ts plant): on his spot, his gun on the door he was sent to hold — or, the
          // team in his sight on the way, where he stopped to fight (he does not charge the rest of the way at them)
          s.phase = 'set'; s.setT = g.time;
          if (s.hold && there && s.door) {   // what he watches is the door he holds, not the way he came
            const e = D.room ? D.room.entries.findIndex(x => x.door === s.door) : -1;
            if (e >= 0) { D.ev[e] = Math.max(D.ev[e], 1.5); D.watch = D.want = e; D.home = v3.copy(D.room!.entries[e].at); } else if (s.aim) { D.watch = D.want = -1; D.home = v3.copy(s.aim); }
            D.pt[0] = D.home[0]; D.pt[2] = D.home[2]; if (!seen) gd.lastKnown = D.pt;
          }
          if (there && !seen) { s.there = g.time; g.say(gd, `${Q.name}: in position — we have the door!`, true); event(g, Q, 'in position', `${gd.callsign}${s.door ? ' holding ' + s.door.def.name : ''}, ${(g.time - s.t0).toFixed(1)} s after the word`, gd); }
          else event(g, Q, 'met', `${gd.callsign} has them in sight ${there ? 'from his spot' : 'on his way'}${s.door ? (there ? ' at ' : ' to ') + s.door.def.name : ''} and holds where he is, ${(g.time - s.t0).toFixed(1)} s after the word`, gd);
          continue; }
        s.phase = 'loose'; if (D.mode !== 'free') loose(g, D, s.fixAt);
        if (there && !seen) { s.there = g.time; g.say(gd, `${Q.name}: in position — on them!`, true); event(g, Q, 'in position', `${gd.callsign}${s.door ? ' at ' + s.door.def.name : ''}, ${(g.time - s.t0).toFixed(1)} s after the word`, gd); }
        else if (K.goRound && s.role === 'flank') event(g, Q, 'met', `${gd.callsign} ${seen ? 'has them in sight' : 'is stopped'}${s.spot ? ` ${flat(gd.char.pos, s.spot).toFixed(0)} m short` : ''}${s.door ? ' of ' + s.door.def.name : ''}, ${(g.time - s.t0).toFixed(1)} s after the word`, gd);
        continue;
      }
      if (s.phase === 'set') {   // still out, as far as his squad counts: he is holding a door that is not its own — until the room fight moves him, his squad's own rooms are hit, or it has been quiet long enough
        if (D.mode !== 'hold') s.phase = 'loose';
        else if (Q.state === 'contact' || g.time - (s.setT ?? s.t0) > K.holdSecs && g.time - gd.lastSeenT > 8) home();
        else if (s.hold && s.there !== undefined && squadDrill(g)?.drillBack) back(g, Q, s, D);
        else if (s.hold && s.there !== undefined && squadDrill(g)?.drillFollow) follow(g, Q, s, D);
        continue; }
      if (s.role === 'look' && D.mode === 'hold' && g.time - s.t0 > 6 && fit(g, gd) && g.time - gd.lastSeenT > 8 && !roomOf(Q, gd.char.pos, 1)) {
        // (drillLook) calm again out there with nothing found: back to the post he left (drillBack's own leg, his boots filed for the team's ears), said once for the pair
        if (!Q.sent.some(x => x !== s && x.role === 'look' && x.back)) { g.say(gd, `${Q.name}: no sign of them — back on our doors!`, true); event(g, Q, 'back', `${gd.callsign} and his mate found nothing where the team was last put, ${(g.time - s.t0).toFixed(1)} s after the word`, gd); }
        s.phase = 'run'; s.back = true; s.spot = s.from; s.door = null; s.way = undefined; s.tries = 0; run(g, D, s.from, null, 0.3);
        continue; }
      if (D.mode === 'hold' && g.time - s.t0 > 6) home();   // calm again and holding where he ended up (roomfight.ts tickFree): at home, wherever that now is
    }
  }
}

// ---------------------------------------------------------------- what a tally and the panel read
export interface SquadReport { id: string; name: string; men: number; up: number; state: string; out: number; events: SquadEvent[] }
export function squadsReport(g: Game): SquadReport[] {
  const st = STATES.get(g); if (!st) return [];
  return st.squads.map(Q => ({ id: Q.def.id, name: Q.name, men: Q.men.length, up: Q.men.filter(alive).length, state: Q.state, out: Q.sent.filter(s => alive(s.gd)).length, events: Q.events.map(e => ({ ...e, t: Math.round(e.t * 10) / 10 })) }));
}
export function squadsSummary(g: Game): string {
  const st = STATES.get(g); if (!st) return SQUADS.on ? 'no squads on this floor' : 'off';
  return st.squads.map(Q => { const out = Q.sent.filter(s => alive(s.gd)).length; return `${Q.name} ${Q.men.filter(alive).length}/${Q.men.length} ${Q.state}${out ? ` (${out} out)` : ''}`; }).join(' · ');
}
/** a squad's men by its name, the fallen among them (cues.ts: who speaks for it on the net) */
export function squadMen(g: Game, name: string): Guard[] { return STATES.get(g)?.squads.find(Q => Q.name === name)?.men ?? []; }
