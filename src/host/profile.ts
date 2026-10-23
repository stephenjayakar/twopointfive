// THE TWO STANDS OF THE QA HARNESS, and the one list of what separates them.
//
//   frozen   (the default)   the stand every frozen digest, tally, probe bound and session fixture was recorded on: tools/qa/headless.ts and standGame's harness block
//                            hold the newer rules off, each by its own line (`pinned()` below is asked by every one of them).
//   shipped  (TPS_PROFILE=shipped in the environment)   the stand the PAGE gives a player who opens it with no URL flag on a machine that has kept nothing: none of
//                            those lines runs, so every table is left at its module's own default — which is what the page plays — and `shippedBoot()` writes the few
//                            rows the page's boot (src/main.ts) writes over those defaults. A pin whose own env word IS given still holds (TPS_PROFILE=shipped
//                            TPS_MOVES=0 = as shipped but for the movement pass), and `--set` rows land after either stand. One exception: a PLAY-THROUGH
//                            (tools/qa/playthrough.ts) writes the door rules and the chaos itself after the stand-up, on either stand — there those rows are
//                            changed with `--set`, never with ONEWAY / QA_DOORSTAY / QA_FRAMEHOLDS / QA_DOORMANNERS / QA_DOORBLAST / QA_EXITSOUT.
//
// The page's own boot writes its URL switches through `pageSwitches` below, the same function the shipped stand calls. What a game module reads off the URL as it
// loads, or keeps per machine, cannot be shared that way, so the page is also HELD to the stand: `node tools/qa/shipped-page.cjs` boots the real page, reads every
// knob table off it (window.__knobs) and compares them with the harness stood up under TPS_PROFILE=shipped (about three minutes a page on the software adapter:
// run it when a boot switch or a page-only default is added); `probes.ts shipped` checks, without a page, that the two harness stands differ in exactly the rows
// FROZEN_HOLDS names. A rule that ships on and is pinned off for the frozen checks is added to
// FROZEN_HOLDS in the same change, or that probe is red.
//
// What 'shipped' still is not: the player (the play-through's commander is scripted and cannot be hurt), the GPU's light meter and smoke sight lines (headless: the
// CPU stand-in, no smoke), a machine's own kept choices (localStorage), V8 (bun runs JavaScriptCore), the game's own die (the page's game owns a seeded die,
// src/math/dice.ts; a harness game on either stand draws the tool's Math.random as every recorded tally did, unless TPS_SEED=n / standUp({ seed }) asks).
//
// Host-neutral, and every game import below is used inside a function only (src/game/ is one import cycle: nothing here may run a game import as this module loads).
import { DESTRUCTION, FURNBLAST, RUBBLE, EVICT } from '../game/destructionSwitch';
import { FURN } from '../game/furnblast';
import { SNOWBOG } from '../game/snowBog';
import { WALLREACT } from '../game/wallreact';
import { WALLCHARGE, WALLSHOT, WALLKILL } from '../game/wallcharge';
import { CHAOS } from '../game/destruction';
import { CASTOR } from '../game/props';
import { DOORTOOLS } from '../game/doortools';
import { SEENWALK } from '../game/seenwalk';
import { ORDERS, ROUND_CAP } from '../game/orders';
import { PAIR } from '../game/pairorders';
import { ROOMFIGHT } from '../game/roomfight';
import { HANDLE } from '../game/handleside';
import { COVER } from '../game/cover';
import { SNEAK } from '../game/sneak';
import { DOORWAY, DOORTHROW } from '../game/doors';
import { WX_OWN, SNOW, SNOW_LOOK } from '../game/weatherKinds';
import { AIR_SIM } from '../game/airSim';
import { GLASS } from '../game/glass';
import { WALLPEN } from '../game/wallpen';
import { DOORSHOT } from '../game/doorblast';
import { DOORPATH } from '../game/doorpath';
import { COVERFIRE } from '../game/coverfire';
import { LIGHTWALL } from '../game/lighting';
import { IRLIGHT } from '../game/irlight';
import { IR } from '../game/irlaser';
import { AIRDUST } from '../game/airDust';
import { WALLSNAP, LEAN_GUN_M } from '../game/wallsnap';
import { HANDSLOT } from '../game/handslot';
import { HANDRING } from '../game/handring';
import { THROWBACK } from '../game/throwback';
import { OWNBLOW } from '../game/ownblow';
import { GUNWALL } from '../game/gunwall';
import { REARWATCH } from '../game/rearwatch';
import { STACKLINE } from '../game/stackline';
import { LANES } from '../game/lanes';
import { HAULHOME } from '../game/digin';
import { HARD } from '../game/difficulty';
import { GUNHOLD } from '../game/gunhold';
import { HOLD, THROW_BY, HARDBREATH } from '../game/character';
import { CLOSE } from '../game/close';
import { FOOTFALL, TWOGEARS } from '../game/player';
import { STALK, stalkPolish } from '../game/stalk';
import { PLAN } from '../game/floorplan';
import { KITANIM } from '../game/kitanim';
import { HANDS } from '../game/hands';
import { WORK } from '../game/workthings';
import { WAND } from '../game/wand';
import { PEEKSIGHT } from '../game/peeksight';
import { CMDRING } from '../game/cmdring';
import { STICKY } from '../game/stickycam';
import { CUES } from '../game/cues';
import { OWNCHARGE } from '../game/owncharge';
import { GUNSLOTS } from '../game/gunslots';
import { GUNLOOK } from '../game/gunlook';
import { GUNROLES } from '../game/gunroles';
import { KITTREE } from '../game/kittree';
import { SQUADTHROW } from '../game/squadthrow';
import { SQUAD40 } from '../game/squad40';
import { AUTOPILOT } from '../game/autopilot';
import { CONDITION } from '../game/condition';
import { INHAND } from '../game/inhand';
import { GUNHAND } from '../game/gunhand';
import { PACKSIDE } from '../game/packside';
import { PLANLAY } from '../game/planlay';
import { START } from '../game/startfile';
import { HOLDFIRE } from '../game/holdfire';
import { SILENT } from '../game/silent';
import { SAMESTART } from '../game/samestart';
import { TAKE } from '../game/takecheck';
import { QUIETFOG } from '../game/quietfog';
import { TOLD } from '../game/told';
import { TORCH } from '../game/calmtorch';
import { BACKKEY } from '../game/backkey';
import { moraleFromQuery } from '../game/morale';
import { RUNNER } from '../game/runner';
import { STARTLE } from '../game/startle';
import { ROWSET } from '../game/rowset';
import { SMOKEBREAK } from '../game/smokebreak';
import { SHOWWHY } from '../game/showwhy';
import { FIRE } from '../game/fire';
import { FLINCH } from '../game/flinch';
import { VERDICT } from '../game/verdict';
import { DARKDOOR } from '../game/darkdoor';
import { DARKFOE } from '../game/darkfoe';
import { POWEROUT } from '../game/powerout';
import { SQUADDEAL } from '../game/squaddeal';
import { STAYASK } from '../game/stayask';
import { KITLOAD } from '../game/kitload';
import { RESCUECHECK } from '../game/rescuecheck';
import { RESCUEEND } from '../game/rescueend';
import { SNATCHOUT } from '../game/snatchout';
import { RESCUEFLUSH } from '../game/rescueflush';
import { EXACT } from '../math/exact';
import { SENSE } from '../game/sense';
import { CMDCHECK } from '../game/cmd';
import { DOZE } from '../game/doze';
import { netQuietFromQuery } from '../game/netquiet';
import { ATTENTION } from '../game/attention';
import { PICTURE } from '../game/picture';
import { RESPONSE } from '../game/qrf';
import { RELOAD } from '../game/autoreload';
import { SAMSTUN } from '../game/samstun';
import { FRAG } from '../game/frag';
import { RECAP } from '../game/deathrecap';
import { TEAMTALLY } from '../game/teamtally';
import { AIMWEIGHT } from '../game/aimweight';
import { AIM } from '../game/aim';
import { SPRINTDOOR } from '../game/sprintdoor';
import { TEAMPACE } from '../game/teampace';
import { NOSHOVE } from '../game/noshove';
import { RAILS } from '../game/rails';
import { DOORFORCE } from '../game/doorforce';
import { SLOTSETUP } from '../game/slotsetup';
import { GLASSREAL } from '../game/glassbreak';
import { AIMCOST } from '../game/aimcost';
import { QUICKTHROW } from '../game/quickthrow';
import { FRIENDS } from '../game/friends';
import { FRIENDLYFIRE } from '../game/friendlyfire';
import { LIGHTSWITCH } from '../game/lightswitch';
import { CARLAMPS } from '../game/carlamps';
import { CLEANRESTART } from '../game/cleanrestart';
import { FIRELINE } from '../game/fireline';
import { SAVETIMELINE } from '../game/savestate';
import { HANDWORK } from '../game/handwork';
import { WORKSTOW } from '../game/workstow';
import { SQUADNET } from '../game/squadnet';
import { TAKEDOWN } from '../game/takedown';
import { STEALTHPOSE } from '../game/stealthpose';
import { GEAR, gearFromQuery } from '../game/gear';
import { GUARD_EYE, LIGHTS } from '../game/guards';
import { wordsFromQuery } from '../game/words';
import { kitLoad, KIT_SOLO, BIGSLOT, KITDEAL, ISSUE } from '../game/kit';
import { squadSenses } from '../game/enemysquads';
import { LOOK, lookOfQuery, suitOfQuery } from '../scene/look';
import { MUSIC } from '../audio/pieces';
import { LIVED, livedOfQuery } from '../scene/lived';
import { UNDERFOOT } from '../scene/collision';
import { ROUND } from '../scene/round';
import { ROOMCLEAR } from '../game/roomclear';
import { FIXEDSTEP } from './loop';
import { AUTOCAM, autoTuneApply } from './autocam';
import { TWEEN } from './tween';

export type Profile = 'frozen' | 'shipped';
const envOf = (): Record<string, string | undefined> => (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

/** the stand this harness run asked for (TPS_PROFILE; unset = frozen). Anything else stops the tool: a mistyped arm must not be counted as the other one. */
export function harnessProfile(): Profile {
  const p = envOf().TPS_PROFILE ?? '';
  if (p === '' || p === 'frozen') return 'frozen';
  if (p === 'shipped') return 'shipped';
  throw new Error(`TPS_PROFILE='${p}' not understood: shipped | frozen`);
}
/** does a harness pin hold on this run? frozen: always. shipped: only where the run's environment names the pin's own word (`env`; a pin with none is the frozen stand's alone) */
export function pinned(env?: string): boolean { return harnessProfile() === 'frozen' || (env !== undefined && envOf()[env] !== undefined); }

/** THE SWITCHES THE PAGE'S BOOT WRITES FROM ITS URL, in one place: src/main.ts calls this with the page's query before the level is built, the harness's shipped
 *  stand calls it with an empty one (shippedBoot below) — so 'the page with no flag' is this function's answer to '', by construction.
 *  (Switches a game module reads off the URL itself as it loads are shared already: under bun there is no `location`, and the module's own default stands.) */
export function pageSwitches(q: URLSearchParams): void {
  DESTRUCTION.on = !q.has('nodestruction');   // THE ONE SWITCH of the destruction goal (game/destructionSwitch.ts): on in the page unless the URL says ?nodestruction — raised before the level loads (its dressing)
  FURNBLAST.on = !q.has('nofurnblast');   // furniture under a blast (game/furnblast.ts; inert without the switch above): ?nofurnblast = charges leave the furniture standing, as before
  FURN.mouth.on = q.get('holeclear') !== '0';   // a hole a blast opens is cleared of what stands in its mouths (furnblast.ts mouth()): ?holeclear=0 = whatever stood by the wall stands in the hole, as before
  FURN.mouth.snow = q.get('holesnow') !== '0';   // lying snow in a blown hole's mouths goes with the blast too (furnblast.ts mouthMine; acts only with the line above): ?holesnow=0 = a snow bank at the wall's foot stands in the hole, as before
  FURN.mouth.base = q.get('holebase') !== '0';   // the bottom layer of a pile a blown hole takes goes with it (furnblast.ts mouth; acts only with a blown hole cleared): ?holebase=0 = the layer stays lying in the hole, as it did
  RUBBLE.on = !q.has('nokickrubble');   // men kick rubble aside as they walk (game/debris.ts feet; nothing to kick without the switch above): ?nokickrubble = pieces lie where they fell, as before
  EVICT.on = !q.has('nopopfix');   // a piece the debris pool evicts is its smallest and goes as chips by its size (game/breakTable.ts pick / dissolve; only under the cut pieces switch): ?nopopfix = the oldest piece, the fixed ball of chips, as before
  WALLREACT.on = !q.has('nowallreact');   // both sides reacting to what breaks (game/wallreact.ts): ?nowallreact = the destruction engine's own build
  WALLREACT.blastFlood = q.get('blastflood') !== '0';   // a blast that opens two walls floods the rooms once, so the defenders keep what they knew of every door (game/wallreact.ts blastFlood; ?blastflood=0 = a flood a row, as it was)
  WALLREACT.everyGone = q.get('everygone') !== '0';   // a man beside a blast is asked about EVERY thing it took, not the newest row alone (game/wallreact.ts everyGone: the defender behind a blown crate with furniture beside it no longer kneels on in the open): ON in the page; ?everygone=0 = the newest row alone, as it was
  if (q.has('nocoverfire')) COVERFIRE.on = false;   // aimed fire at cover that can break (game/coverfire.ts; it reads the flag itself too — here so the table a recording carries says so, and the pressed-muzzle round in combat.ts follows it)
  WALLCHARGE.outer = !q.has('noouterwall');   // a wall charge goes on a building's OUTER wall too (game/wallcharge.ts outerWall; the engine takes that wall on when the charge goes): ON in the page; ?noouterwall = outer walls refused in words, as they were
  WALLCHARGE.safe = !q.has('nowallsafe') && q.get('wallsafe') !== '0';   // the wall charge's larger safety radius (game/wallcharge.ts safeRadius: the squad stands off further and the blast reaches further on its own side, more so indoors; Sam inside it is rocked): ON in the page; ?wallsafe=0 = the radii as they were
  CHAOS.pall.on = q.get('pall') !== '0'; CHAOS.pall.solver = q.get('pall') !== 'look';   // a blast's pall: a wall charge, a frag and a 40 mm raise seconds of real dust and smoke, read by every sight line (game/destruction.ts CHAOS.pall; ?pall=0 = the thin dust as it was, ?pall=look = its particle layer alone, which hides nobody)
  CHAOS.mess.on = q.get('mess') !== '0';   // what a blast and a broken thing leave on the floor: the film of settled dust and grit, the mark of a chunk the pool took (src/game/floormess.ts; marks laid only for the picture — ?mess=0 = the floor as clean as it was)
  WALLCHARGE.hung = q.get('hungcharge') !== '0';   // a wall charge set where something hangs on the wall (a notice board) takes it and the wall: it is no shield to the wall, and goes in pieces (game/wallcharge.ts hung; ?hungcharge=0 = the charge is a dud there, as it was)
  WALLCHARGE.outOfFire = q.get('standfire') !== '0';   // the men who stand off a wall charge take the safe marks no enemy the team knows of can shoot first, then the least under that fire (game/wallcharge.ts underFire; known = the fog's own record: in the picture now, or seen in the last 30 s where he was last seen — and, with the men's own pictures on (PICTURE.wall; ?nopicture off), anybody one of them saw, heard or was told of in that time; acts with the safety radius; ?standfire=0 = the nearest safe marks whatever looks at them, as it was)
  WALLCHARGE.menClear = q.get('menclear') !== '0';   // a man on 'fall in' whose place is in the line of a charge set on a wall, nearer than its stand-off distance, walks to a stand-off mark and keeps it until his place is clear (game/wallcharge.ts clearOf; ?menclear=0 = he keeps his place in the file, in the blast or not; acts with the larger safety radius)
  WALLSHOT.on = q.get('wallshot') !== '0';   // a wall shot's smoke is thinner and its shock fills the room it opens (game/wallcharge.ts WALLSHOT): ON in the page, ?wallshot=0 = the charge as it was
  WALLKILL.on = q.get('wallkill') !== '0';   // a wall charge kills whoever stands at it when it goes, the player among them (game/wallcharge.ts WALLKILL): ON in the page, ?wallkill=0 = dazzled and rocked as it was
  HARDBREATH.on = q.get('hardbreath') !== '0';   // a man who has run breathes hard: the chest heaves deeper and quicker, the steam on a snow level is thrown harder, bigger and more often (game/character.ts HARDBREATH): ON in the page, ?hardbreath=0 = the breath as it was
  WALLCHARGE.farFurn = q.get('wallfurn') !== '0';   // furniture against a wall's far face is no 'no floor behind it' (game/wallcharge.ts mouthAfter: a cot stood against the wall inside goes with the wall): ON in the page; ?wallfurn=0 = refused there as it was
  CASTOR.on = q.get('chairroll') !== '0';   // an office chair rolls and coasts on its castors (game/props.ts CASTOR): ON in the page; ?chairroll=0 = it stops like any other furniture, as it was
  ORDERS.fileSpread = q.get('filespread') !== '0';   // fall in, Sam stopped: a place that fell on the place of a man ahead in the file is dealt again a body's room off it (game/orders.ts apartSlot: two men shoved each other over one spot for as long as he stood); ?filespread=0 = the places as they fall
  ORDERS.fileHold = q.get('filehold') !== '0';   // …and where the spread found no floor and he cannot stop short, he holds where he stands, a step off the mate's place where the floor has one (game/orders.ts apartSlot hold: he was handed the place as it fell, inside a body's room of a mate's, and the two shoved each other in a corner); ?filehold=0 = the place as it fell
  ORDERS.backEnd = q.get('backend') !== '0';   // …and the file's further back off a doorway ends with the floor: a back distance that no longer moves the place is not counted (game/orders.ts clearBack: with no trail beside an open door it was counted in full for every man after the first, the third man's file distance read 8.3 m and a man 8.9 m off in plain sight was taken for one in his place); ?backend=0 = the full count
  ORDERS.retakeGoal = q.get('retakegoal') !== '0';   // a man back from the fight walks for where his order stands, not for a corner of the way he was on before (game/orders.ts tick): ON in the page; ?retakegoal=0 = his goal left as the fight found it
  ORDERS.inWay = q.get('inway') !== '0';   // a stack refused 'no room on that door' only because Sam's own body is on one of its places: the man says "you're in the way." (game/orders.ts noRoomWords: the places asked once more as if he were not there — words only, the order is refused as it was and no place is dealt by it); ?inway=0 = 'no room on that door.', as it was
  ORDERS.walkTries = q.get('walktries') !== '0';   // a 'move there' whose way runs at a door locked against the team that nobody has tried is not refused with the door's name: the men walk up to it, the man on the jamb tries the handle, and the order ends there as a door order ends 'found shut' — the same line, the men left stacked on it; the team knows from then on (game/orders.ts walkStacks, game/doortools.ts walkTried; only where DOORTOOLS.testDoor is on); ?walktries=0 = refused at once, '<door> is locked.', as it was
  ORDERS.roundCap = q.get('roundcap') === '0' ? 0 : ROUND_CAP;   // the way round an uncleared room is taken only when it is worth it (game/orders.ts route / roundRooms: a way round that still crosses floor nobody has been on, or is longer than this many times the short way + 3 m, is refused — the short way, as with no way round); ?roundcap=0 = any way round with less unknown floor on it, however long, as it was
  ORDERS.roundOwn = q.get('roundown') !== '0';   // …and the cap never refuses a pair a way round that keeps it off the door it is to stack on (game/orders.ts route): ?roundown=0 = the cap as it was first made, a pair behind the ordered door walks through it
  ORDERS.sameWay = q.get('sameway') !== '0';   // a pair handed one order on one door from one spot goes round a building by one side (game/orders.ts sameWays): ?sameway=0 = each man his own short way, as it was
  ORDERS.trailDoors = q.get('traildoors') !== '0';   // a follower goes by the doors Sam took where his own short way to his place would take others (game/orders.ts trailWay): ?traildoors=0 = his own short way, as it was
  ROOMFIGHT.coverKeep = q.get('coverkeep') !== '0';   // a man told to cover keeps his angle: an enemy off the way he was given whom a mate is already shooting at is not his (src/game/roomfight.ts)
  PAIR.steady = q.get('pairsteady') !== '0';   // a partner on his way to a man's back does not turn about: never back to a corner he has passed, and a short wait on a watched way does not square him to the man (game/pairorders.ts takeTick): ?pairsteady=0 = as it was
  COVER.rearRead = q.get('rearread') !== '0';   // a rear man on a mark with no door (a wall charge's stand-off, the mate covering a man at work) watches what the ground round him offers — a way in, a long run of floor — not the spot he stood on when the order came (game/cover.ts readRear over roomfit.ts watchablesAt): ON in the page; ?rearread=0 = 'the way he came', as it was
  COVER.backTurn = q.get('backturn') !== '0';   // a man walking backwards whose opening the deal lets go of comes out of it on his feet: the path kept, his body turning to the way he goes (game/cover.ts turnOut): ?backturn=0 = he walks forward along a body still turned to the rear, a quarter of a metre the wrong way, as he did
  ROUND.on = q.get('round') !== '0';   // round things are round (scene/round.ts): a level's drums, tyres, stoves and ovens are stood up as one round shape each — to the picture, every ray, sight and what walks against them — in place of the kit's octagon of four slabs: ON in the page; ?round=0 = the octagons, as they were (main.ts puts it down too when the cut switch, whose pipeline draws a round, is off)
  UNDERFOOT.on = q.get('underfoot') !== '0';   // what the walk grid calls floor, feet cross (scene/collision.ts): a walker is stopped by what the grid's bake calls blocked and by nothing lower — the bottom layer of a pile of sacks a wall charge left in its own hole no longer holds the men ordered through it: ?underfoot=0 = a thing 0.2 m high stops feet the grid routes across
  SNEAK.byEye = q.get('byeye') !== '0'; { const n = Number(q.get('seenrate')); if (q.has('seenrate') && Number.isFinite(n) && n > 0) SNEAK.seenRate = Math.min(1, n); }   // a lit step with a line is SEEN only where that defender's eye would gain on a man there (src/game/sneak.ts; `?seenrate=<n>`: the rate that counts, the guards' own floor 0.05 by default)
  SNEAK.stalkAmbient = q.get('stalkambient') !== '0';   // the partner's way to a man's back is read by the light his OWN meter shows on him over the CPU's estimate (the moon, the bounce), as Sam's crumbs carry Sam's (game/sneak.ts sneakWalk): ON in the page; ?stalkambient=0 = the estimate alone, as it was — a moonlit yard read as dark
  SNEAK.noiseWalk = q.get('noisewalk') !== '0';   // a follower is not left standing on the walk of a man who comes to a sound (game/sneak.ts sneakComing; the breaker man's manners, workthings.ts workComing, for any suspicious man on his way to a place he heard something): ON in the page; ?noisewalk=0 = the breaker man alone, as it was
  DOORTOOLS.testDoor = q.get('doortest') !== '0';   // an entry order HALTS at a door that turns out locked or wedged, the lead says so, and the same row again boots it; a plain 'stack up' tries the handle (game/doortools.ts haltAt / testStacks): ON in the page; ?doortest=0 = straight to the boot as it was
  DOORTOOLS.thrPie = q.get('thrpie') !== '0';   // a room worked from the threshold: both jamb men cut the opening toward its middle, a few degrees a step, until the outside shows no more floor — and only then 'holding on the door' (game/doortools.ts pieSet / pieNext): ON in the page; ?thrpie=0 = a diagonal each, held still, as it was
  DOORTOOLS.thrLean = q.get('thrlean') !== '0';   // … and the man cutting leans (head and gun past the edge, hips behind it) and takes the cuts that look down the door's own line on a knee (character.ts anim.lean): ON in the page; ?thrlean=0 = square on every station
  DOORTOOLS.thrPieOne = q.get('thrpieone') !== '0';   // … ONE man cuts: the lead walks the cuts square while the far jamb's man holds his diagonal, then leans once from his last cut; nobody kneels (the maintainer, 10-19, of the two of them cutting and kneeling in step). ON in the page; ?thrpieone=0 = both men cut, leaned on every cut, a knee on the cuts down the door's line, as it was
  DOORTOOLS.outsidePlain = q.get('outsideplain') !== '0';   // 'clear from outside' is ONE order on the door tools' row 4 — hold the door from outside — and going in is a second order (rows 1 / 2), one can at most: ON in the page; ?outsideplain=0 = the threshold's pages as they were
  DOORTOOLS.wordNoCan = q.get('wordnocan') !== '0';   // the word (F) at a door held from outside steps the men in with NO can; a can goes in only when asked ('bang and clear' given to the holding men): ON in the page; ?wordnocan=0 = the word bangs the blind pockets first, as it was (acts with the one-order outside clear)
  DOORTOOLS.wordCuts = q.get('wordcuts') !== '0';   // the word that spends no can waits for the jamb men to finish slicing the doorway (doortools.ts cutsOwe): ON in the page; ?wordcuts=0 = the word steps them in there and then, as it was
  DOORTOOLS.wordSmall = q.get('wordsmall') !== '0';   // the word (F) sends one or two teammates in from a plain stack, as it does the four: ON in the page; ?wordsmall=0 = with a small squad the key does nothing for a stack, as it was
  SEENWALK.on = q.get('seenwalk') !== '0';   // the walk an order gives a man keeps off lit floor that a room nobody has cleared has a sight line to, through glass as through anything an eye sees through (game/seenwalk.ts): ON in the page; ?seenwalk=0 = the walks as they were
  DOORTOOLS.bangInto = q.get('banginto') !== '0';   // a bang and clear's can leaves the thrower's own hand and is thrown deep into the room (the deepest point its burst lights nearly all the floor from), going off as it gets there (game/doortools.ts bangSpot): ON in the page; ?banginto=0 = it appears in the door frame and goes off 1.6 m inside, as it was
  DOORTOOLS.haltBack = q.get('haltback') !== '0';   // a pair halted 'found shut' on a door the OTHER pair is charging steps back to rear security, out of the backblast, as a pair stacked there before the charge was ordered does (game/doortools.ts haltBack: the same stepBacks / makeRoom; it was asked only as the charge order was given, and the halted pair stood inside the blast): ON in the page; ?haltback=0 = it stays stacked where it halted, as it was
  DOORTOOLS.tossMate = q.get('tossmate') !== '0';   // a bang and clear asks about teammates again as the can is about to leave the hand: one of ours beyond the door, in its reach, and the can stays in the kit and they go in (game/doortools.ts mateBehind): ON in the page; ?tossmate=0 = asked when the row is given and never again, as it was
  DOORTOOLS.behindSam = q.get('behindsam') !== '0';   // Sam beyond a door is one of ours to the squad's own stun can: the word at a held door steps them in with the can kept, and a bang row on it is refused in words (game/doortools.ts samBehind): ON in the page; ?behindsam=0 = only teammates counted, as it was
  DOORTOOLS.podFrames = q.get('podframes') !== '0';   // no point of an entry is dealt in ANOTHER door's frame, or beyond one (game/doortools.ts inFrame; the barracks' n_end entry had a man on n4b's threshold): ON in the page; ?podframes=0 = the points as they were
  DOORTOOLS.thrHand = q.get('thrhand') !== '0';   // a threshold's can is thrown only by a man within reach of the frame, and waits for one (game/doortools.ts thrHand: a frag had run the stack off the door and the can left a doorway nobody stood at): ON in the page; ?thrhand=0 = the thrower wherever he stands
  DOORTOOLS.thrNoCan = q.get('thrnocan') !== '0';   // the can's wait spent with nobody at the door: no can, said why, and they go in keeping it (game/doortools.ts thrNoCan; the maintainer's answer, 10-16): ON in the page; ?thrnocan=0 = thrown from wherever the picked man stands, as it was
  DOORTOOLS.thrDoorsLeaf = q.get('thrdoorsleaf') !== '0';   // a man left on another door of the room is put where that door's own leaf, stood open, does not hide it from him, while there is such floor (game/doortools.ts thrDoorsLeaf): ON in the page; ?thrdoorsleaf=0 = the posts as they were
  DOORTOOLS.fragHold = q.get('fraghold') !== '0';   // a door order waits for its men who ran from a grenade to be back on their marks before its door is opened, `fragHoldCap` s at most (game/doortools.ts fragHold; the maintainer's answer, 10-16): ON in the page; ?fraghold=0 = the order carries on with its men scattered, as it was — at a held doorway too
  DOORTOOLS.thrFragHold = DOORTOOLS.fragHold && q.get('thrfraghold') !== '0';   // … and a threshold waits the same way before a can or the step in (game/doortools.ts thrFragHold): ON in the page; ?thrfraghold=0 = that half alone off
  DOORWAY.sideKick = q.get('sidekick') !== '0';   // a boot from beside the latch jamb (game/doors.ts kickSpotSide): ON in the page; ?sidekick=0 = every kick square in front of the leaf
  DOORWAY.kickGlass = q.get('kickglass') !== '0';   // … never from in front of a pane a round reaches him through: the lead boots from the front there (game/doortools.ts bootSpot): ON in the page; ?kickglass=0 = the side spot wherever there is floor
  DOORWAY.solid = q.get('doorsolid') !== '0';   // a leaf pulled open toward the player is solid to him: it moves him back and aside, or stops on him (game/doors.ts DOORWAY.solid): ON in the page; ?doorsolid=0 = the swing passes him, as it did
  WX_OWN.roofs = q.get('ownroofs') !== '0';   // a level's own night storm rains by that level's own roofs (game/weather.ts syncRoofs: the records office's car park lay inside the OFFICE's no-rain rectangle): ON in the page; ?ownroofs=0 = the office's two rectangles on every level, as it was
  WX_OWN.wind = q.get('wxwind') !== '0';   // … and its storm BLOWS roof by roof: open ground between a level's three or four roofs has the storm's wind — flakes, wisps and smoke on one field (game/wind.ts syncField; it was the roofs' bounding box, so a yard was still): ON in the page; ?wxwind=0 = the bounding box, as it was
  SNOW.on = q.get('snow') !== '0';   // a level built for snow (game/weatherKinds.ts SNOW_LEVELS: the pass) is born in snow — flakes in its open air (game/snowFx.ts), play as under Overcast: ON in the page; ?snow=0 = that level under the weather any level has
  SNOW_LOOK.on = q.get('snowlook') !== '0'; SNOW_LOOK.wisps = q.get('snowwisps') !== '0'; SNOW_LOOK.tracks = q.get('snowtracks') !== '0'; SNOW_LOOK.glow = q.get('snowglow') !== '0'; SNOW_LOOK.sparkle = q.get('snowsparkle') !== '0';   // a snow level's lying snow is one soft surface with a fresh-snow finish, and the wind runs wisps of fine snow over it (weatherKinds.ts SNOW_LOOK; picture only): ON in the page; ?snowlook=0 = the painted boxes as the file has them, ?snowwisps=0 = still air over the ground
  AIR_SIM.on = q.get('air') !== '0';   // THE AIR AS ONE SIMULATED FIELD (game/airSim.ts, render/airField.ts): the wind as a small fluid simulation over every level's floor plan, fed by the wind's own sources, walls and door leaves standing in it — a picture only (today the blown snow rides it): ON in the page; ?air=0 = no field is built or stepped, the build as it was
  SNOW_LOOK.grains = q.get('snowgrains') !== '0';   // … and near the view the blown snow is fine grains riding a small fluid simulation of the wind (render/airField.ts, game/snowFx.ts; picture only): ON in the page; ?snowgrains=0 = the wisps alone, as they were
  SNOW_LOOK.oneAir = q.get('snowair') !== '0';   // … and its snow is ONE SNOW IN ONE AIR: the flakes fall through the simulated wind among the walls, a wisp is snow that wind lifts where it is fast enough, and the grains are no layer of their own (game/snowFx.ts oneAirOn, particles.wgsl snowAir; picture only): ON in the page; ?snowair=0 = flakes on the plain storm wind, wisps in gust patches, grains near the view, as they were
  SNOWBOG.on = q.get('snowbog') !== '0';   // thrown things bog down in lying snow: a grenade that comes down on a snow level's open ground keeps little of its bounce and its slide (game/snowBog.ts; PLAY, not picture): ON in the page; ?snowbog=0 = it bounces and skids there as on a floor
  SNOW_LOOK.marks = q.get('snowmarks') !== '0';   // … every thing that moves over the snow marks it, and a mark forms and kicks loose snow up by how hard it was made (game/snowMarks.ts, snowTracks.ts stampMark; picture only): ON in the page; ?snowmarks=0 = boots and blasts alone mark it, whole at once
  SNOW_LOOK.under = q.get('snowunder') !== '0';   // a flake is hidden from what is under the roofs, whichever slab, and from a partition's top inside (weatherKinds.ts SNOW_LOOK.under; picture only): ?snowunder=0 = each roof's rectangle by itself and every top at the ceiling open, as it was
  SNOW_LOOK.past = q.get('snowpast') !== '0';   // … and its snow goes on falling past the level's rim, so a view by the edge is snowed across (game/snowFx.ts flakeOpen; picture only): ON in the page; ?snowpast=0 = no flake past the world's rectangle
  SNOW_LOOK.blast = q.get('snowblast') !== '0';   // … and a blast over lying snow craters it, throws the loose snow and shoves the simulated wind (game/snowBlast.ts; picture only): ON in the page; ?snowblast=0 = a blast leaves the snow as it lay
  SNOW_LOOK.steam = q.get('breathsteam') !== '0';   // … and that breath is real steam: gas in the smoke solver, off each man's mouth, as the gun's is off its muzzle (game/snowBreath.ts BREATHSTEAM; picture only): ON in the page; ?breathsteam=0 = the puffs of sprite it was
  SNOW_LOOK.breath = q.get('snowbreath') !== '0';   // … and the men's breath steams in its cold (game/snowBreath.ts; picture only): ON in the page; ?snowbreath=0 = no breath shows
  GLASS.bothFaces = q.get('glassears') !== '0';   // a pane's crash is heard from BOTH its faces (game/glass.ts glassEvent, guards.ts glassHeard: a window shot out from the yard reached the men in the room behind it only round by the front door): ON in the page; ?glassears=0 = heard only from the point the round met it, as it was
  DOORSHOT.on = q.get('doorshot') !== '0';   // sustained gunfire splinters a wooden door leaf apart, on its own count, twelve rifle rounds or twenty-four pistol (game/doorblast.ts DOORSHOT): ON in the page; ?doorshot=0 = a round only marks a leaf, as it did
  if (q.get('doorcost') === '0') { DOORSHOT.toll = 1; DOORSHOT.flat = false; }   // shooting a door out is a cost — twelve rifle rounds, twenty-four pistol, whatever the destruction scale (DOORSHOT.toll 2 and .flat, the module's own words): ?doorcost=0 = drywall's own six and twelve, riding the scale, as it was
  DOORTHROW.on = q.get('doorthrow') !== '0';   // a door opened into a man carries him clear and startles him (a defender stops a beat and goes to look at the doorway); one slammed at a run or booted into him folds and blinds him a moment, longer under a boot (game/doors.ts DOORTHROW, game/doorthrow.ts): ON in the page; ?doorthrow=0 = a leaf stops against a standing man, as it did
  WALLPEN.on = q.get('wallpen') !== '0';   // a round carries on through thin walls and wooden door leaves with the energy it has left (game/wallpen.ts: plasterboard partitions, fabric and wood screens, a leaf that is not steel — by the glass rule's energy, a toll by stuff and the length of its path through): ON in the page; ?wallpen=0 = a round stops in the first built thing it meets, as it did
  WALLCHARGE.on = !q.has('nowallcharge'); if (q.get('wallmenu') === 'direct') WALLCHARGE.menu = 'direct';   // the wall charge's own switch (game/wallcharge.ts; it also needs the destruction's) · ?wallmenu=direct: X, 5 instead of X, 5, 3
  // each man of a room entry walks a real path through the door (doorpath.ts) — clear of the leaf, one tight file: ON in the page; ?nodoorpath = the entry as it
  // was; ?doorpath=gun = with the gun rule too (a rifle is not carried through a leaf: it ships off)
  DOORPATH.on = !q.has('nodoorpath') && q.get('doorpath') !== '0'; if (q.get('doorpath') === 'gun') DOORPATH.gun = true;
  WALLSNAP.on = !q.has('nowallsnap');   // back to the wall, the feel pass (game/wallsnap.ts): the take on one eased clock with stepping feet and a settle, the way off keeping his momentum, and Q with the rifle in hand STACKS on the wall (low ready; the cursor round an open end steps him out): ON in the page; ?nowallsnap = the hold as it was
  WALLSNAP.press = q.get('wallpress') !== '0';   // …taken without the key (game/wallsnap.ts `press`, player.ts wallPress): a move key held into a wall takes it as its key does (while this is on the hold has no key on the page's board: host/keymap.ts qFree) — ON in the page (Options ▸ Game has its row, kept per machine); ?wallpress=0 = Q alone, as it was
  WALLSNAP.voice = q.get('wallvoice') !== '0';   // …heard (wallsnap.ts `voice`): his back landing on a wall and his stepping off it each have a sound, the player's ears only; ?wallvoice=0 = the faint scuff alone, as it was
  WALLSNAP.leanGun = q.has('noleangun') ? 0 : LEAN_GUN_M;   // …and the step-out round an end goes as far as the RIFLE needs (wallsnap.ts `leanGun`): round an end on his gun side the eyes' 0.6 m left the rifle in the jamb and its rounds in the wood; ?noleangun = 0.6 m whichever side, as it was
  WALLSNAP.slow = q.get('wallslow') !== '0';   // …and unhurried (wallsnap.ts `slow`): the take runs twice its seconds and the pose comes on and lets go at half its rate; ?wallslow=0 = the take as it was
  RELOAD.lastMag = !q.has('nolastmag');   // the last magazine, seated and not racked, can still be reloaded (game/autoreload.ts): ON in the page; ?nolastmag = that gun never fires again, as it was
  HANDSLOT.on = q.get('handslot') !== '0';   // empty hands are a slot (game/handslot.ts): its key puts away whatever is up and is never the way back, a digit draws; on the page's board it is backtick, the debugger is on backslash and E is spare (host/keymap.ts SLOT) — ON in the page; ?handslot=0 = E puts away and draws, as it was
  HANDRING.near = HANDRING.empty = HANDRING.early = q.get('handring') !== '0';   // …and a digit pressed inside the hold is the ring's wedge at once, never the weapon slot (handring.ts `early`)
  HANDRING.lone = HANDRING.near && q.get('lonepill') !== '0';   // a ring with one row is a pill, on both rings, and the cursor on the pill is on the row (game/ringlone.ts) — these four go with ?handring=0 too, as the rest of his ring does
  HANDRING.onThing = HANDRING.near && q.get('ringonthing') !== '0'; HANDRING.bare = HANDRING.near && q.get('ringbare') !== '0'; HANDRING.turn = HANDRING.near && q.get('ringturn') !== '0'; HANDRING.corner = HANDRING.near && q.get('corner') !== '0';   // his ring stands on the thing its first row is about (or on him), and has no line of words under it
  HANDRING.on = q.get('handring') !== '0';   // his own actions are a ring that stays (game/handring.ts): a tap of the interaction key does the default action, the key kept down a moment puts his rows up as a ring at the cursor that stays with no key held (a digit, a click or the key again does a wedge; a right click or Tab puts it away), the whistle is its last wedge and has no key, the corner shows the default action alone; on the page's board the key is E while empty hands are a slot (host/keymap.ts HAND) — ON in the page; ?handring=0 = the list on a held Space, the corner list and V for the whistle, as it was
  THROWBACK.restMark = !q.has('norestmark');   // the throw preview's ring is where the can comes to REST (game/throwback.ts `restMark`, player.ts throwRest; the overlay's): ?norestmark = the ring on its first touch, as it was
  THROWBACK.on = q.get('throwback') !== '0';   // a can in the wind-up goes back on the belt when a kick, a pick, the wand, hands at work, the keypad or a takedown begins (game/throwback.ts); `?throwback=0` = it freezes in his fist and leaves when the beat ends, as it did
  AUTOCAM.on = q.get('autocam') !== '0'; AUTOCAM.turn = q.get('autoturn') !== '0'; AUTOCAM.zoom = q.get('autozoom') !== '0'; AUTOCAM.sway = q.get('autosway') !== '0'; AUTOCAM.tune = q.get('autotune') !== '0'; autoTuneApply();   // the camera's key tapped twice and the camera frames things itself (host/autocam.ts: the door ahead, the squad's orders, the men he could shoot; the key held with the mouse moved, or with a walk key, takes it back): ON in the page; `?autocam=0` = the double tap is the Options row's, as it was (`?autoturn=0` = it never turns the view, `?autozoom=0` = it never zooms)
  OWNBLOW.on = q.get('ownblow') !== '0';   // a charge his own hands set goes off from his own actions — a row of his list, a wedge of his ring — and the squad's key no longer blows it (game/ownblow.ts); `?ownblow=0` = the squad's key blows any set charge, as it did
  RELOAD.auto = !q.has('noautoreload');   // a dry gun in the player's hands starts its own reload (game/autoreload.ts): ON in the page; ?noautoreload = it waits for R, as it did
  TEAMPACE.on = q.get('teampace') !== '0' && !q.has('noteampace');   // teammates walk at four fifths of the player's walk, run with him when he sprints and they follow, and run on their own only for a reason (game/teampace.ts) — ON in the page; ?teampace=0 = the team's old 2.2 m/s cap and no running, as it was
  GLASSREAL.drop = q.get('glassdrop') !== '0'; GLASSREAL.place = q.get('glassplace') !== '0';   // glass as buildings have it (game/glassbreak.ts GLASSREAL): a toughened sheet goes white and drops at once, no wave across it; and a pane is toughened where it reaches the floor or is a door's panel, float where it starts at a sill — ON in the page; ?glassdrop=0 = the wave, ?glassplace=0 = outside toughened and inside float, as they were
  SLOTSETUP.on = q.get('slotsetup') !== '0';   // the slot in hand pressed again opens its setup (game/slotsetup.ts): 1 or 2 pressed with that gun in the hands lights its rows — 1 semi / auto, 2 the launcher's load, 3 the light — and the Z and L keys give nothing (host/keymap.ts setFree, the same word) — ON in the page; ?slotsetup=0 = 2 again steps the load, Z is the selector and L the light, as they were
  SLOTSETUP.pop = q.get('setuppop') !== '0';   // …and the setup is a mode that pops up above the kit column, with no clock on it (slotsetup.ts `pop`) — ON in the page; ?setuppop=0 = its rows on the box's second line and shut by itself after a second and a half, as the first build had it
  SLOTSETUP.draw = q.get('setupdraw') !== '0';   // …and a gun's digit pressed again while it is still coming to his hands opens the setup at once (slotsetup.ts `draw`): 2 2 off the pistol is the rifle and its setup — ON in the page; ?setupdraw=0 = a double-tapped digit is the draw and no more
  DOORFORCE.on = q.get('doorforce') !== '0';   // an alerted man does not wait at a shut door (game/doorforce.ts): a defender who is sure an enemy is at its far face fires through a wooden leaf and, free to move, ends by booting it in — ON in the page; ?doorforce=0 = he rests his gun on it or goes to its handle, as he did
  RAILS.on = q.get('rails') !== '0';   // a tutorial mission's frame (game/rails.ts): on a level whose lesson carries a rails record, only what the step that is up has unlocked works, the level's script is cued by the steps, the checkpoints are the authored ones and a teammate is never lost — ON in the page; ?rails=0 = such a level plays as a plain lesson
  RAILS.eyeView = q.get('eyeview') !== '0'; RAILS.eyeFirst = q.get('eyefirst') !== '0'; RAILS.lineClear = q.get('lineclear') !== '0'; RAILS.wayRun = q.get('wayrun') !== '0'; RAILS.skyPlan = q.get('skyplan') !== '0'; RAILS.planWalk = q.get('planwalk') !== '0'; RAILS.planDown = q.get('plandown') !== '0';   // seven rules of that frame, each with its own word off (rails.ts RAILS): ?plandown=0 = the tick plan mode comes down is his own, on a step that locks his feet, his sprint or his trigger too; ?planwalk=0 = Shift with the command key does nothing while a walk key is down, on a mission that gives his feet and plan mode and not his sprint (the two words together = the gate as it was before either); ?wayrun=0 = men a step tells to run a leg walk it; ?skyplan=0 = the sky seat is not drawn as plan mode is; ?eyeview=0 = a mission's lookout is one more of the team's eyes, as it was (the squad then knows what only the lookout has); ?eyefirst=0 = a step's lookout takes the last free place among the picture's eyes, not the first; ?lineclear=0 = the big line lies where it lies, over your own men too. On the frozen stand the frame itself is off (TPS_RAILS=1 raises it, these seven with it)
  NOSHOVE.on = q.get('noshove') !== '0';   // teammates falling in never shove the player (game/noshove.ts): a follower whose way lies through him goes round or stops short, and a shove from anybody is not read as his walking — ON in the page; ?noshove=0 = shouldered aside by his own file, as it was
  SPRINTDOOR.on = !q.has('nosprintdoor');   // a sprint into a door has weight (game/sprintdoor.ts): a shoulder through one that opens away costs a quarter of the run, one that opens toward him is booted off its hinges — ON in the page; ?nosprintdoor = every leaf flung at full speed from either face, as it was
  AIMWEIGHT.on = !q.has('noaimweight');   // the player's aim has weight (game/aimweight.ts): his gun turns at a limited rate and the aiming circle trails the cursor, shots going where the circle is — ON in the page; ?noaimweight = the gun eased onto the cursor as it was
  AIM.player.low = q.has('noaimlow') ? 0 : 1;   // a man under the reticle who is low — head down, on a knee, ducked from a blast, doubled over a flash — is aimed at where he is (game/player.ts manAim): ON in the page; ?noaimlow = at a standing chest over his feet, the gun level on him and the rounds over his head, as it was
  FRAG.fleeWise = !q.has('nofleewise');   // nobody runs onto a live grenade (game/frag.ts FRAG.fleeWise): judged from where it will rest, no leg nearer it than he stands, the leg he has kept, no staying put inside its lethal reach — ON in the page; ?nofleewise = the flee as it was
  FRAG.restProps = FRAG.fleeApart = FRAG.fleeOnto = FRAG.fleeSam = FRAG.fleeLook = !q.has('nofleemates');   // the mends to that flee (game/frag.ts): the rest guess counts the loose furniture the grenade will stop at, no leg shoulders a mate (or Sam) out of the corner he is staying in or running for, a man a stride short of his corner comes onto it, and a man left open floor beside a mate's cover looks once more for his own — ON in the page; ?nofleemates = all off, the flee as it was
  FRAG.fleeDoor = !q.has('nofleedoor');   // caught by a grenade with no cover to get behind, a man leaves by a doorway that already stands open (game/frag.ts fleeByDoor; ?nofleedoor = the one straight leg inside the room)
  FRAG.downKill = !q.has('nodownkill');   // a burst kills a man who is down and breathing — out cold from a sponge round, a blow or a choke, or down wounded — where it reaches him (game/frag.ts blast; ?nodownkill = every man already down is passed over, as it was)
  FRAG.wallFlee = !q.has('nowallflee');   // a wall or cover piece the burst would open is no cover to a man reckoning it before it goes off (game/frag.ts exposedTo; ?nowallflee = only the door leaves it would take count)
  AIMCOST.lamp = q.get('lamphit') !== '0';   // a lamp breaks only to a round that MEETS it, and the reticle coming onto a lamp starts the aim's settle over (game/aimcost.ts) — ON in the page; ?lamphit=0 = a round passing within 0.3‥0.45 m breaks it, as it was
  AIMCOST.move = q.get('movecost') !== '0';   // moving feet open the cone, for anybody with a gun: the feet term doubled and remembered a beat after he stops; a guard waits that beat before he starts shooting (game/aimcost.ts) — ON in the page; ?movecost=0 = as it was
  CONDITION.on = !q.has('nocondition');   // a man's condition (game/condition.ts): a blast that leaves a man standing leaves him HURT — no faster than a walk, wider rounds — the same of the player, his men and the defenders; one round still puts anyone down. ?nocondition = nobody is ever hurt
  PACKSIDE.on = q.get('packside') !== '0';   // a hammer, a breaching shotgun or a slung rifle on a man who wears a pack stands strapped upright at the pack's side and moves with it; a breacher who carries a real tool wears the small pack, not his modelled ram (game/packside.ts). Looks only. ?packside=0 = across the back and through the pack, as it was
  INHAND.on = q.get('inhand') !== '0';   // a pistol is drawn in the hand that holds it, and the hand is turned onto the line the gun points (game/inhand.ts): a man crouched with his sidearm out no longer has it floating over his fists, nor a gun that reaches the aim before the arms do. Looks only. ?inhand=0 = every gun laid on the aim line from the wrist, as it was
  GUNHAND.on = q.get('gunhand') !== '0';   // a move keeps to the hand that is free (game/gunhand.ts): the torch hand comes up for a whistle, a man with a long gun throws with his other hand, a long gun reloads with the trigger hand on the grip. ?gunhand=0 = as it was
  SAMSTUN.on = !q.has('nosamstun');   // a blast does to the player what it does to anybody (game/samstun.ts): a frag that leaves him up roots him with his gun down, a stun canister whites his picture out — ON in the page; ?nosamstun = a flinch and ringing ears, as it was
  TEAMTALLY.on = !q.has('noteamtally') && q.get('teamtally') !== '0';   // a partner's men are on Sam's card on a quiet mission as two (game/teamtally.ts): his round a kill, his takedown a knockout, with their timeline rows — ON in the page; ?noteamtally = only the player's own are counted, as it was
  RECAP.on = !q.has('norecap');   // every death explains itself (game/deathrecap.ts + ui/recap.ts): the end card shows who shot whom, from where. Reads only, so it is on on every stand too; ?norecap = the card as it was
  RECAP.live = q.get('recaplive') !== '0';   // …and while the run is on, a lost teammate's row struck with the way the round came from, squad's view only (deathrecap.ts lostLive); ?recaplive=0 = the row as it was
  RECAP.liveArrows = q.get('recaparrows') === '1';   // …with nothing DRAWN for the way it came from: no arrow on his row, no stroke on the ground at him ("we shouldn't show the arrows, feels unrealistic"); ?recaparrows=1 = both drawn, as they were
  QUICKTHROW.on = q.has('quickthrow') && q.get('quickthrow') !== '0';   // the G quick throw (game/quickthrow.ts): GONE from the page — a can is thrown from its slot with a click; ?quickthrow = back for the visit
  FRIENDS.noSnap = !(q.has('friendsnap') && q.get('friendsnap') !== '0');   // the reticle never takes a man of the player's own side (game/friends.ts): ON in the page; ?friendsnap = it snaps to anybody, as it did
  LIGHTSWITCH.on = q.get('lightswitch') !== '0';   // a room's lights have a switch on the wall beside its door: Space at it puts the room's lights out or back, and a calm defender who saw them go comes to the switch and puts them back (game/lightswitch.ts): ON in the page; ?lightswitch=0 = no plates and no row, as it was
  CARLAMPS.on = q.get('carlamps') !== '0';   // a parked vehicle's lamps can be shot out, head and tail, lit or not (game/carlamps.ts): ON in the page; ?carlamps=0 = no lamp is a target, as it was
  CLEANRESTART.on = q.get('cleanrestart') !== '0' && !q.has('kitview');   // a restart gives a clean level: the lights stand as a level just opened has them, the last try's lines and clocks are gone, the camera cuts and the picture starts fresh (game/cleanrestart.ts): ON in the page; ?cleanrestart=0 = the restart as it was
  FRIENDLYFIRE.on = !(q.has('nofriendlyfire') && q.get('nofriendlyfire') !== '0');   // a round of your side finds the men of your side, and a teammate does not press with a friend where his round could go (game/friendlyfire.ts): ON in the page; ?nofriendlyfire = your rounds and theirs pass through your own side, as they did
  SAVETIMELINE.on = q.get('savetimeline') !== '0';   // the saves roll (five by hand on F5 beside five autosaves), each keeps a picture, a team on the floor is saved in memory, and the pause and down cards lay this run's out as a strip (game/savestate.ts): ON in the page; ?savetimeline=0 = one checkpoint to go back to, as it was
  SAVETIMELINE.holds = q.get('saveholds') !== '0';   // a save carries his wall hold and the close-in mode's held gait (savestate.ts SAVETIMELINE.holds): a load plays on as its save did; ?saveholds=0 = no file says either
  FIRELINE.on = !(q.has('nofireline') && q.get('nofireline') !== '0');   // a teammate walking on an order waits short of the lane you are firing down and crosses when you stop (game/fireline.ts): ON in the page; ?nofireline = an order walks him through your fire, as it did
  FRIENDS.lowReady = !(q.has('nomuzzle') && q.get('nomuzzle') !== '0');   // Sam's raised gun comes to the low ready off a teammate in its line while nobody is in a fight (game/friends.ts): ON in the page; ?nomuzzle = his gun is his own, as it was
  QUIETFOG.on = q.get('quietfog') !== '0';   // a quiet mission can be played under the fog of war (game/quietfog.ts): the fog lever is live on a quiet row with a bottom rung of its own, off (every guard shown). ?quietfog=0 = the lever greyed there and no rung read, as it was
  QUIETFOG.def = q.get('quietdef') === 'off' || q.get('quietdef') === '0' ? 'off' : 'team';   // WHERE a quiet mission starts (the maintainer's pick, 10-13): under the fog, lifted round you and your partner, the mission's sticky cameras handed out — a bare quiet link is that. ?quietdef=off = it starts with every guard shown, as it did
  QUIETFOG.solo = q.get('solofog') !== '0';   // the solo night's own link is read as a quiet row's: it opens under the fog of war with the mission's cameras and wand (game/quietfog.ts soloFogLink): ?solofog=0 = the solo night with every guard shown, as it was
  TOLD.on = q.get('told') !== '0';   // the fourth difficulty lever, how much you're told (game/told.ts): guided | standard | bare on the mission sheet, a fading mark where your team last saw an enemy on the first two (standard is the level standard, bare is hard's). ?told=0 = three levers and no mark, as it was
  TOLD.fogOff = q.get('fogoff') !== '0';   // the fog lever on a squad mission has a bottom rung, off: every enemy drawn (game/told.ts, difficulty.ts fogOffNow). ?fogoff=0 = the three rungs it had
  QUIETFOG.wand = q.get('quietwand') !== '0';   // a quiet mission under the fog hands you an optical wand with its cameras, whatever your card carries (game/quietfog.ts quietWand): ?quietwand=0 = only a wand in your own pouch
  TAKE.wired = !(q.has('takecheck') && q.get('takecheck') !== '0');   // on a quiet mission a man is sent to look at the emptied holder only where the level says it is wired (game/takecheck.ts): ON in the page; ?takecheck = a man is sent seven seconds after every take, as it was
  HOLDFIRE.on = !q.has('noholdfire');   // a squad nobody has found never fires first (game/holdfire.ts): a teammate's round at a man who has not noticed anybody is held until the player's own shot or an order of his that means fire, walking or sneaking — ON in the page; ?noholdfire = they shoot on sight unless silent or sneaking, as they did
  SILENT.stackSet = !q.has('nosilentset');   // a silent man told to stack, on his mark with his round held on a man, counts as stacked (game/silent.ts silentOnMan): 'set.' is said and his row reads 'stacked' with his gun still on the man, and no hand goes to the handle while it is. ON in the page; ?nosilentset = he is 'stacking' until his gun is the door's, as it was
  START.fallIn = !q.has('nofallin');   // the team starts a mission fallen in (game/startfile.ts): the night breach and a room clear stage the men on the menu's own 'fall in', unspoken (the rescue's men fall in when its clock starts, as they always have) — ON in the page; ?nofallin = they start with no order, as they did
  { const w = q.get('torchwall'); TORCH.wallLow = w !== '0' && w !== 'dark'; TORCH.wallDark = w === 'dark'; }   // a hand torch whose beam would end on the wall at his hand hangs, its beam on the floor at his feet (game/guards.ts torchLow; the maintainer, 10-22: "another example of character shining flashlight at a small point in front of them"): ON in the page; ?torchwall=0 = the carry as it was; ?torchwall=dark = the other answer, the torch put out instead of tipped
  TORCH.calmOff = q.get('calmtorch') !== '0' && !q.has('nocalmtorch');   // a calm patrol's hand torch burns only where his place is dark (game/calmtorch.ts): ON in the page; ?calmtorch=0 = every patrol torch burns wherever he walks, as it did
  GUARD_EYE.far = !q.has('nofarsight');   // a man standing in light is seen from past the eye's 16 m (game/guards.ts eyeReach: out to 26 m in full light, the notice building slower out there; the dark hides him as before) — ON in the page; ?nofarsight = every eye stops at 16 m whatever the light, as it was
  GUARD_EYE.farCalm = !q.has('nofarcalm');   // …and a glimpse from past those 16 m is no place to walk to until it is what has him looking (game/guards.ts farFaint: a calm man's fix lands the frame the sight tips him) — ON in the page; ?nofarcalm = every far glimpse writes his fix at once, as the far reach first shipped
  PLAN.menuOnly = !q.has('planalways');   // the plan's ways, marks and fans only while the order menu is up (picture only, on on both stands); `?planalways` = for as long as the orders stand
  moraleFromQuery(q);   // shaken (game/morale.ts): a blast makes the men near it duck, and breaks a man alone in the dark — down, back off the hole, a burst into the dust, a call nobody answers: ON in the page; ?nomorale = every man as steady as he was. With it who is green and how brittle they all are: ?training=green|mixed|trained (absent: by the squad's own key and the difficulty), ?nerve=brittle|steady — and a choice made by hand in the debugger's Enemy nerve section, kept for the visit
  VERDICT.loudCard = q.get('loudcard') !== '0';   // a mission that leans loud is not graded as a sneak (game/verdict.ts loudRow): its end card shows no rating word, no score, no badges, and the sneak's numbers stand untoned — ON in the page; ?loudcard=0 = the stealth game's rating on every card it stands on, as it was
  SMOKEBREAK.on = q.get('smokebreak') !== '0';   // a man a level's script told to have a smoke lights one (game/smokebreak.ts: his left hand to his mouth, the lit end, real smoke) — ON in the page; ?smokebreak=0 = he stands there with his hands as they were (one level's one man today: the ledger's)
  SHOWWHY.on = q.get('showwhy') !== '0';   // a teammate shows why he is not acting (game/showwhy.ts): the player in his line gets a wave of his free hand and "you're in my line." for as long as it is true, a stack that is made and waiting passes the squeeze up the file and its lead raises a fist, a man held at a doorway the player stands in raises one and says "after you.", a man a blast hurt says so once, and the man kept on a taken room's far door says he has it — ON in the page; ?showwhy=0 = none of it, as it was (his hands and his words only: nobody's feet, gun or eyes)
  FIRE.on = q.get('fire') !== '0';   // an open fire burns (game/fire.ts: a level's brazier gets a flame, embers, smoke off the solver, a crackle, and its lamp flickers — in the light meter too) — ON in the page; ?fire=0 = the glowing lid and the steady lamp as they were
  FIRE.smoke.on = q.get('firesmoke') !== '0';   // … and its smoke, which keeps the smoke solver awake near a fire (picture only): ?firesmoke=0 = the fire with no smoke, to weigh what the smoke costs
  ROWSET.on = q.get('rowset') !== '0';   // a mission row's own hour and weather (game/rowset.ts): a row that names one is always started in it, over the link's — ON in the page; ?rowset=0 = the link's hour and weather as ever (no row names one: nothing to see either way)
  STARTLE.on = q.get('startle') !== '0';   // enemies startle when they first see you (game/startle.ts): a calm man whose own eyes have just told him it is a man jolts, his gun down for a beat, and only then draws — or, green and alone with you close, runs for it: ON in the page; ?startle=0 = he goes for his gun at once, as he did
  FLINCH.on = q.get('flinch') !== '0'; FLINCH.run = q.get('flinchrun') !== '0';   // a man flinches when fire comes close (game/flinch.ts): every close round of the other side ducks a man, the player's own included, by how near it was and how drilled he is; a green man alone kept under it drops his gun and runs: ON in the page; ?flinch=0 = nobody ducks but on the suppression model's own edge, as it was; ?flinchrun=0 = the duck alone, nobody runs from fire
  RUNNER.anyway = q.get('runanyway') !== '0';   // …and he runs for it no matter what: with no way out round the enemies he knows of he runs for the outside regardless, and a rifleman drops his sidearm too (runner.ts anyway)
  RUNNER.nobody = q.get('runnobody') !== '0';   // …and from then on he is nobody's enemy on the books: no teammate calls 'contact' on him, no room waits on him to be called clear, he is no mate's company and nobody's voice (runner.ts nobody)
  RUNNER.on = !q.has('norunner');   // drops it and runs (game/runner.ts): a broken man alone, his magazine run dry, with an enemy in his eyes at arm's length shouts that he is done, lets the weapon fall and runs — to his mates, then out of the building: ON in the page; ?norunner = he stays and changes his magazine, as he did
  DARKDOOR.on = !q.has('nodarkdoor');   // not in there alone (game/darkdoor.ts): a green man, alarmed and alone, stops at the doorway of a dark room, says so, sweeps the opening and waits for a mate — then they go in together, or nobody comes and he gives it up: ON in the page (it acts only with morale on); ?nodarkdoor = every man walks into the dark as he did
  DOZE.on = !q.has('nodoze');   // dozing in the dark (game/doze.ts): a calm staff man with a long wait in an unlit place sits in the chair there and nods off, and can be woken — ON in the page; ?nodoze = every man stands his wait awake, as it was
  DARKFOE.on = !q.has('nodarkfoe');   // an enemy on alert does not sit blind in the dark (game/darkfoe.ts): a defender who knows and cannot see what he is watching lights the lamp on his gun, and one with no lamp walks to where he can see — ON in the page; ?nodarkfoe = their lights stay off and they stand where they were put, as they did
  POWEROUT.on = !q.has('nopowerout');   // the lights go out and somebody goes to put them back on (game/powerout.ts): a mission's defenders who see the lights die say so on their net and send their nearest free men to the breaker, lamps lit — ON in the page; ?nopowerout = they stand in the dark for as long as the team takes, as they did
  SQUADDEAL.on = !q.has('nosquaddeal');   // squads from the rooms (game/squaddeal.ts): a level whose file names no squads is handed some cut from its rooms, so a loud way in and a quiet one each draw their own move there too — ON in the page; ?nosquaddeal = such a level's defenders are one pool, as they were
  STAYASK.on = !q.has('nostayask');   // squads that stay in their rooms still miss a room that goes silent (game/stayask.ts): on a floor where every squad stays (the block, Mousehole) the net's roll call runs and the nearest squad sends one man to the silent rooms — ON in the page; ?nostayask = nobody there asks after another squad, as it was
  KITLOAD.on = !q.has('nokitload');   // lighter kit moves faster and hides better (game/kitload.ts): what a man's card carries gives him a mobility and a concealment score, and they are his legs' pace, the notice he builds in an eye and his footfall — you and every teammate; an issued card plays as it did — ON in the page; ?nokitload = nobody's card is read, as it was
  SNATCHOUT.on = !q.has('nosnatchout'); SNATCHOUT.hold = !q.has('nosnatchhold');   // how a snatch ends (game/snatchout.ts): tied, the man is led by the player (Space on him: on your feet — with me) to the team's van by its way in, and in it the mission is won, the house taken or not; the squad covers the walk out by bounds, unasked — ON in the page; ?nosnatchout = the house taken with him in hand wins it, as it was (and nobody answers the gunfire: qrf.ts); ?nosnatchhold = the squad does only what it is told
  RESCUEEND.on = !q.has('norescueend');   // how a rescue is won (game/rescueend.ts): the hostages led out the way the team came in (Space on one: on your feet — with me), or nobody of theirs left on the floor — ON in the page; ?norescueend = the room held fifteen seconds wins it, as it was
  RESCUEFLUSH.on = !q.has('norescueflush');   // the men left alive come for the hostages (game/rescueflush.ts): once the team is loud and the room has fallen they are sent for it by its two doors in turn, said on their net, and a man with a line to a hostage has her — ON in the page; ?norescueflush = they stay where the fight left them, as it was
  RESCUECHECK.on = !q.has('norescuecheck');   // the rescue's men check in (game/rescuecheck.ts): a man of a hostage rescue's cast who stops answering their radio check is asked for by name and one man walks to his post, said on their net first; the captor's clock is not touched — ON in the page; ?norescuecheck = nobody there misses anybody, as it was
  EXACT.on = !q.has('noexact');   // the game's own maths (math/exact.ts): sin, cos, atan2 and the rest worked out the same on every JavaScript engine, so a page and a server (or the headless harness) compute one game from one seed and one set of inputs: ON in the page; ?noexact = the engine's own functions, as it was
  SENSE.cpu = q.has('cpusense');   // the senses on the CPU (game/sense.ts): OFF unless the URL says ?cpusense — the men see by the renderer's own light and smoke, as ever; on, by the game's own stand-ins, and a fight is then its seed and its inputs and nothing else (the same on a machine with no GPU). Whether the page plays on them is the maintainer's call.
  CMDCHECK.on = !q.has('nocmdcheck');   // a record from anyone (game/cmd.ts checkCmd): the tick's input record is made one an honest seat could have sent before the tick reads it (finite, bounded, the two matrices worked out again) — an honest record comes through unchanged to the bit; ?nocmdcheck = believed as it comes, as before
  netQuietFromQuery(q);   // the net goes quiet (game/netquiet.ts; it needs the row above): a radio check nobody answers and a body found shake the men, the asker's calls get worse, a jumpy man's beam whips to a noise, and the last man backs to the spot his doors sit in one arc from and goes low: ON in the page; ?nonetquiet = the men as they were
  ATTENTION.on = !q.has('noattention');   // a guard has one attention, and where it is can be seen (game/attention.ts): ON in the page — a small thing that makes a calm man look takes his attention there for a time the floor shows, and his eye for the rest is narrower while it does; ?noattention = every wary man sweeps the room with his whole eye, as it was
  ATTENTION.way = !q.has('straightthread');   // …and its thread on the floor runs the way he will walk to the place, not through the walls (picture only, on on both stands); `?straightthread` = the straight thread it was
  PICTURE.on = !q.has('nopicture');   // each man keeps his own picture of the fight (game/picture.ts): ON in the page — where he believes each enemy to be (seen, heard, told; it goes out of date), and the spot rules that ask it; ?nopicture = no memory kept and every spot picked as it was
  PICTURE.step = q.get('picstep') !== '0';   // (?picstep=0: a man keeps the place the squad chose for itself though he knows it is in an enemy's line, as it was — built on a lean while the maintainer was away: his call 1)
  PICTURE.shot = q.get('picshot') !== '0';   // (?picshot=0: a man who hears a colleague fire is handed the enemy's true place, as it was — his call 3)
  RESPONSE.on = q.get('response') !== '0';   // the response team is the level's own (game/qrf.ts RESPONSE): ON in the page — a level has a team only where its file says who comes and by which way, with its own words; ?response=0 = the office's one stairwell and the gate as they were
  RESPONSE.deal = q.get('responsedeal') !== '0';   // (?responsedeal=0: every call gets the level's first answer — the first way in, its most men, the middle of its time)
  RESPONSE.raid = q.get('responseraid') !== '0';   // (?responseraid=0: no squad's raid ever brings a level's team, as it was)
  RESPONSE.net = q.get('responsenet') !== '0';   // (?responsenet=0: the team goes on every living man's private fix the instant he has it, as it was)
  PICTURE.run = q.get('picrun') !== '0';   // (?picrun=0: a man who drops his gun and runs plans his way round every enemy's true place, as it was)
  if (q.has('picture')) PICTURE.show = q.get('picture') === 'all' ? 'all' : 'cursor';   // (?picture = the floor shows the picture of the man under the cursor; ?picture=all = every teammate's ideas)
  PLAN.on = !q.has('noplan');   // the squad's plan drawn on the floor (game/floorplan.ts): picture only, on on both stands; `?noplan` = nothing drawn
  PLAN.keyLit = q.get('keylit') !== '0';   // …and the key's cap on a door says whether it is live: dark while its men are still on their way or the press would not send it, lit once they stand there and it would (picture only, on on both stands; `?keylit=0` = the cap only on the door the key would send now, the same either way)
  PLAN.thrTold = q.get('thrtold') !== '0';   // …and on a door held from outside the cap lights only once the men have called 'holding · on your word': pressed before that the key cuts their slice short (picture only, on on both stands; `?thrtold=0` = lit with their feet on the jambs, as it was)
  CLOSE.on = !q.has('noclose');   // closer than ever (game/close.ts): the windows round a man drawn on the floor, the ready pose, the ways in from his sides, his front and over a chair — ON in the page; ?noclose = one way in, from behind, in words, as it was
  CLOSE.heldClicks = !q.has('noheldclicks');   // with a man in his arm the two buttons (game/close.ts, player.ts updateHold): left click the knife — he is dead — right click the choke; the arm hold only — ON in the page; ?noheldclicks = neither click does anything there, as it was
  CLOSE.handsLow = q.get('handslow') !== '0';   // crouched in reach behind a standing man his hands stay low until the move: the tell is the hand on the knife, not an open hand held up over his own head (game/close.ts closeReady). ON in the page; ?handslow=0 = the grab's tell reaches from the crouch, as it was
  CLOSE.noKnife = q.get('noknife') !== '0';   // no knife: empty hands knock a man out on the right click and the left click is no blow; nothing draws or names a blade (game/close.ts). ON in the page; ?noknife=0 = the two buttons as they were
  CLOSE.reachUp = !q.has('noreachup');   // crouched behind a standing man the grab's reach goes UP for his neck and the trunk comes up with it (game/close.ts, character.ts READY_UP): ON in the page; ?noreachup = the hand at the small of his back, as it was
  STALK.only = q.get('stalkonly') !== '0';   // …and it is the only way to a staff man: his 'grab him' row is gone (?stalkonly=0 puts the row back beside the stalk)
  STALK.corner = q.get('stalkcorner') !== '0';   // …and with his back on a wall the held button lies in wait: the man who comes past the corner is grabbed (?stalkcorner=0 = the button on a wall does nothing, as it was)
  stalkPolish(q.get('stalkpolish') !== '0');   // …and the stalk's fourth to sixth passes of polish, up in the page and down on the frozen stand (TPS_STALKPOLISH=1 raises them there); ?stalkpolish=0 puts them down together for a look at the move without them (the way in at a part weight, no spring before the lunge, the turn in the step's first frames, no sway and no room between the heads in the hold, the wall stance alone at a corner, no duck when the man turns) — the numbers journal.ts gives a recording from before them, by the same function
  STALK.on = q.get('stalk') !== '0';   // the stalk (game/stalk.ts): the left button held on a man he is close behind walks Sam in to the grab. ON in the page; ?stalk=0 = the last metres are his own keys, as they were
  TWOGEARS.on = q.get('twogears') !== '0';   // two gears, not a dial (game/player.ts TWOGEARS): the wheel is nobody's pace and the crouch-walk is the sneak, at its own quicker pace. ON in the page; ?twogears=0 = the wheel's six notches and the tune's crouch-walk, as it was
  FOOTFALL.once = q.get('footfallonce') !== '0';   // one footfall a step (game/player.ts FOOTFALL): a footfall is filed only once the walk cycle has come a quarter of a turn since the last one filed, so a cycle rocking over one edge (backpedal flipping frame by frame: forwards and backwards keys by turns, or a man walked in the arm) is one footfall and not one a frame. ON in the page; ?footfallonce=0 = every crossing files one, as it always did
  FOOTFALL.owed = q.get('footfallowed') !== '0';   // …and under it, a footfall the legs owe (FOOTFALL.owed): a cycle turned about again and again (the cursor shaken across him) rocks between its edges or crosses one with too little travel to count, and with the first key alone that walk files a third to two thirds of a plain walk's footfalls; on = a step's worth of the cycle walked since the last edge passed files one. ON in the page; ?footfallowed=0 = only an edge files a footfall
  KITANIM.on = !q.has('nokitanim');   // kit animations (game/kitanim.ts): Sam's hands put kit away and bring it out, magazine changes by the gun's state (empty / tactical), the close-in mode's knife hand by distance — ON in the page; ?nokitanim = the kit changing hands on the key's frame, one reload, as it was
  THROW_BY.on = !q.has('nothrowby');   // a throw reads its distance (game/character.ts THROW_BY): an underhand toss close in, the overhand short-armed in the middle, the whole wind-up far out, on one clock — ON in the page; ?nothrowby = one swing for every throw, as before
  TAKEDOWN.on = !q.has('notakedown');   // close-up takedowns as moves (game/takedown.ts): the chop, the palm heel, the hand over the mouth, the slash, the partner's blow and the man it lands on, the fall by the blow, a man out cold who breathes; ?notakedown = every takedown as it was
  TAKEDOWN.haul = !q.has('nohaul');   // …and the choke hauls him up and back off his feet (character.ts HOLD.haul): ON in the page; `?nohaul` = the choke as it was
  STEALTHPOSE.on = !q.has('nostealthpose');   // stealth poses (game/stealthpose.ts): the crouch's hanging arms and sway, the crouch walk's arms, the back unrolling as he stands, the creep's leading hand, the squat at a door with the wand; ?nostealthpose = as it was
  HANDWORK.on = !q.has('nohandwork');   // hands that do the work (game/handwork.ts): a finger on the keypad, hands on a charge, the breaker's lever and the drive; a hand to the radio; a guard's torch ↔ sidearm swap as a move — ON in the page; ?nohandwork = all three on the frame, as they were
  WORKSTOW.on = !q.has('noworkstow');   // the gun is put away for a two-handed job (game/workstow.ts): a charge going on a door or a wall has both of the man's hands — yours, what you held put away first and brought back after; a teammate's gun hung on its sling, no round until it is back up, the job dropped while the fight has him. `?noworkstow` = a charge set with the gun still in the hand, as it was
  SQUADNET.on = q.get('squadnet') !== '0';   // the squad reaches you (game/squadnet.ts): a teammate's line said off your screen is drawn near you on his side with a click, and a teammate going down is called with a sound of its own: ON in the page; ?squadnet=0 = a line over a head off the screen is not drawn, as it was
  SQUADNET.why = q.get('qwhy') !== '0';   // the quick key says why (game/squadnet.ts): its row ends on the reason when the squad's pick is not a plain open, and the man who answers says it: ON in the page; ?qwhy=0 = the row and the answer as they were
  SQUADNET.clear = q.get('honestclear') !== '0';   // 'clear' means clear (game/squadnet.ts): a room is called clear only when its search left no floor unseen, and called quiet otherwise: ON in the page; ?honestclear=0 = the call as it was
  SQUADNET.endCall = q.get('endcall') !== '0';   // every entry ends with a call (game/squadnet.ts): the lead calls a room the mission has no name for too ('room clear.', 'clear so far.' of open floor): ON in the page; ?endcall=0 = such an entry ends with nothing said, as it was
  HANDS.on = !q.has('nohands');   // hands on the world (game/hands.ts): a body is taken up from the end he is at with both hands and laid down again, a door comes round under his hand with him stepped clear of it — ON in the page; ?nohands = bodies snap to the ankle drag and doors are flung, as they were
  OWNCHARGE.on = !q.has('noowncharge');   // the player's own charges (game/owncharge.ts): charge rows on YOUR kit card, 'set a charge' on a shut door, a man alone carries his card's charges only. ?noowncharge = as it was
  GUNSLOTS.on = !q.has('nogunslots');   // a primary and a secondary for every man (game/gunslots.ts): the card's one gun row is two — Primary and Secondary — and a teammate carries both, going to his sidearm when the primary runs dry on a man close in front of him. ?nogunslots = one gun row, and nobody but you has a second gun
  KITTREE.on = !q.has('nokittree');   // the gear screen as a tree (game/kittree.ts): one list of rows for every man, each gun with its own suppressor, the light and the launcher's loads under it and what it is good at drawn on its tile; your card has a teammate's suppressor, light and goggles rows; sponge rounds are a counted row — none as issued, five from a quiet or solo mission; one row of kits. ?nokittree = the card of the build before, row for row
  GUNLOOK.on = !q.has('nogunlook');   // each gun its own look, sound and reload (game/gunlook.ts): the Mk 12, MP7, Mk 46, M1014, HK45 and Glock 18 drawn as themselves, each with its own report, flame and way of being fed. ?nogunlook = each drawn and heard as the issue gun it stood in for
  GUNLOOK.shells = !q.has('nogunshells');   // (…and of 10-19: a tube gun is fed a shell at a time in time and in the books — the M1014 and the pump gun take a lead, so long a shell and a tail, each shell in the gun as it is heard; ?nogunshells = the row's one length and the tube booked at its end)
  GUNROLES.on = !q.has('nogunroles');   // a gun is used for what it is for (game/gunroles.ts): a cast of defenders is dealt an AKMS, one belt-fed PKM for a lane or a big cast and a few pistols off the squad's table, and a teammate's place in the stack, his turn at the door, the opening he covers and his trigger follow the gun in his hands. ?nogunroles = every defender the short carbine and every teammate as with the issue carbine
  PLANLAY.on = !q.has('noplanlay');   // X is where the plan is laid (game/planlay.ts): 'wait for my word' is under every order menu, an order picked with it on is laid — nobody moves — and F sends the plan; Enter puts it back. ON in the page, ?noplanlay = the row is the four's door tools' alone and the men walk to the door at once, as it was; off on the frozen stand (TPS_PLANLAY=1 raises it)
  CMDRING.on = q.get('qring') !== '0';   // THE ORDERS RING (game/cmdring.ts): the squad's command key (Q on the board) let go at once is the quick order, as it was, and kept down a moment puts the order menu up as a ring at the cursor. ON in the page since 10-22 (the maintainer: "longer press for Q opens up squad, doesn't require holding it"); `?qring=0` = the key as it was, its order as it goes down and no ring. Held off on the frozen stand
  CMDRING.stay = CMDRING.on && q.get('qstay') !== '0';   // …and the ring stays up when the key comes up: a digit, a click or the key again gives a wedge, a right click puts it away (`?qstay=0` = the ring only while the key is down, given as it comes up)
  CMDRING.stayDigit = CMDRING.stay;   // …and a digit pressed inside that press, the key still down, puts the ring up at once and gives its wedge: it is not the gun's slot
  CMDRING.pin = CMDRING.on && q.get('ringpin') !== '0';   // …and the ring stays on the place it was opened on as the view moves; a cursor the hand has not moved lights no other wedge (`?ringpin=0` = it stays where it was opened on the screen)
  CMDRING.tapNow = CMDRING.on;   // …and a press already up in its own tick is a tap given on that tick
  CMDRING.hint = q.has('cmdhint') && !q.has('nocmdhint');   // …and the mark at the cursor before the key — a glyph beside it and an outline on the floor for what the key would order there (a picture only). A GAME SETTING, off unless chosen: Options ▸ Game keeps it on this machine (ui/options.ts); `?cmdhint` = on for this visit, with the ring or without
  CMDRING.hands = CMDRING.on && q.has('cmd') && !q.has('nocmdhands');   // …and Space the same way for his own hands (interact.ts): down = his rows as a ring at the cursor, up = the lit one, a tap the tap it was — still only when asked for (`?cmd`; `?nocmdhands` = Space as it was beside the ring)
  CMDRING.plan = CMDRING.on && q.get('qplan') !== '0' && !q.has('nocmdplan');   // …and plan mode (game/planmode.ts): Shift + the key toggles it; the left button picks men, the right button orders them and Shift chains, F at a chain's pauses. ON in the page with the ring since 10-22 (the maintainer: "shift Q for plan mode"); `?qplan=0` (or `?nocmdplan`) = Shift and the key as they were
  CMDRING.planRts = CMDRING.plan && !q.has('nocmdrts');   // …that mode as an RTS's: Sam stands, the walk keys move the view, the right button kept down is the ring (`?nocmdrts` = the mode as it was first built)
  CMDRING.planRun = CMDRING.plan;   // …but Shift + the key out of a sprint (a walk key down, the mode down) is still the key's own order
  CMDRING.planLook = CMDRING.plan && CMDRING.planRts && q.get('planlook') !== '0';   // …a right press dragged is an order with a way to look: on the floor they go there and face it, on a man he covers it from where he stands (`?planlook=0` = a right press is a click or the ring)
  CMDRING.planWaits = CMDRING.plan && q.get('planwaits') !== '0';   // …the word's waits are the plan's own: a left click on a stop steps them on, and the word frees only the chains stood waiting (`?planwaits=0` = the build's own pauses and the early press)
  CMDRING.planKnee = CMDRING.plan && CMDRING.planRts && q.get('planknee') !== '0';   // …he takes a knee at the radio while the mode is up, and the view eases back to him when it comes down (`?planknee=0` = he stands, the view's point jumps)
  CMDRING.planOne = CMDRING.plan && q.get('planone') !== '0';   // …one word that frees two or more doors of a plan puts their entries on one signal: the doors open together and two cans wait each other's burst (`?planone=0` = each chain's entry on its own clock, as it was)
  CMDRING.planNear = CMDRING.plan && CMDRING.planRts && q.get('plannear') !== '0';   // …the view of plan mode stays within a few metres of Sam, a room's worth and not the level's (`?plannear=0` = the reach as it was: 25 m past him and every teammate)
  CMDRING.only = CMDRING.on && q.get('qonly') !== '0';   // the squad's only keys are the command key and the word's: the ring carries every order (a row off a letter on a spare wedge, 'more' where a page has more rows than wedges), the letters are nobody's while it is up, the middle button opens nothing (`?qonly=0` = the wedges and the letters as they were; host/keymap.ts takes the orders key and the who key off the board with it)
  CMDRING.flat = CMDRING.only && q.get('ringflat') !== '0';   // …and the ring is two rings deep at most: every order of the thing it was opened on, wedge 5 the one ring of the rest, the squad's posture row on it (`?ringflat=0` = the menu's pages as they were)
  CMDRING.plainHint = q.get('plainhint') !== '0';   // …no glyph beside the cursor or in the ring's middle: the mark of what the key orders on is the thing's own outline (a picture only; `?plainhint=0` = the glyph as it was)
  AUTOPILOT.on = !q.has('noautopilot');   // B is the squad's autopilot (game/autopilot.ts): on a door the men wait on they go in by the entry they pick, and the plan of a B order is drawn a little longer before it fades. ON in the page, ?noautopilot = B is the target's first row, as it was; off on the frozen stand (TPS_AUTOPILOT=1 raises it)
  SQUADTHROW.on = !q.has('nosquadthrow');   // teammates throw a frag or a stun canister where he points (game/squadthrow.ts): X on a spot of floor, G, then 1 or 2. ON in the page, ?nosquadthrow = no such row; off on the frozen stand (TPS_SQUADTHROW=1)
  SQUAD40.on = !q.has('nosquad40');   // a teammate whose card carries 40 mm grenades fires one where he points (game/squad40.ts): X on a spot of floor, G, then 3. ON in the page, ?nosquad40 = no such row; off on the frozen stand (TPS_SQUAD40=1 raises it). Nothing at all while no teammate's card carries a round
  SQUADTHROW.lob = q.get('throwlob') !== '0';   // … and a man WORKS HIS THROW OUT (game/throwplan.ts): where the one straight arc has no answer he flies a few throws first — flat and hard, a slow lob, off a wall by the spot — and takes the one that goes off by it. ?throwlob=0 = the straight arc or nothing, as it was (and the two rules below off with it); inert on the frozen stand, where the order itself is off
  SQUADTHROW.duck = q.get('throwduck') !== '0';   // … a man of ours who will be off a frag's line before it bursts is not a reason to refuse it (the squad steps off its own frag when it is called: frag.ts fragFlee). ?throwduck=0 = anybody of ours it has a line to refuses it where he stands, as it was
  SQUADTHROW.samCall = q.get('samcall') !== '0';   // … and a frag that reaches the player alone is his call: thrown, and the row names him (' · too close: you'). ?samcall=0 = refused 'you are in it.', as it was
  HANDLE.toolNear = !q.has('notoolnear');   // a door order's lead never stands in the opening to work the handle (game/handleside.ts nearStand): on the face a door opens away from he steps from his mark only as far as his arm needs, his body past the latch jamb. ON in the page; ?notoolnear = he walks to the handle's place in front of the opening, as he did
  PEEKSIGHT.on = q.get('peeksight') !== '0';   // a peek round the end of a wall (back to it, pushed into an open end) lifts the fog of war as a head leaned round it would see (game/peeksight.ts): ?peeksight=0 = the fog's eye stays over his feet, as before
  WAND.on = !q.has('nowand');   // the optical wand (game/wand.ts): a row of YOUR kit card and, carrying it, 'look under it' on a shut door's rows where the fog of war hides the room — ON in the page, ?nowand = no such row on the card or the door; off on the frozen stand (TPS_WAND=1). Before the kit is read (kitLoad): a stored card's wand is read through its row
  WAND.mate = !q.has('nowandmate');   // … and a TEAMMATE's card can carry one, which he uses ONLY on your order (game/wandorder.ts: a door's menu, V): ON in the page, ?nowandmate = yours alone, as it was; off on the frozen stand (TPS_WANDMATE=1)
  WAND.quick = !q.has('nowandquick');   // … and it is set up in the time its animation takes (game/wand.ts `quick`): the lens through as he gets onto his knee, no ring on the row — ON in the page, ?nowandquick = the 1.5 s feed and its ring, as it was; off on the frozen stand (TPS_WANDQUICK=1)
  BIGSLOT.on = !q.has('nobigslot');   // the big slot (game/kit.ts BIGSLOT, game/bigkit.ts): every card has ONE big slot beside its pouches — the wall charge, the breaching shotgun (kit now, not a gun: the man keeps his rifle) or the dynamic hammer — and the last two take a lock from either face, yours on a locked door's row, a teammate's on a door order. ON in the page, ?nobigslot = the cards and the weapon row as they were; off on the frozen stand (TPS_BIGSLOT=1). Before the kit is read from the store: a stored shotgun-as-gun card is read as rifle + shotgun in the big slot.
  KITDEAL.on = !q.has('nokitdeal');   // the squad's kit dealt over the men who come (game/kit.ts KITDEAL): with three or four teammates the issued kit and every named squad kit are shared out among them — a charge and a stun to each pair — where the first two carried it all and the others showed empty pouches. The squad's count is the same at every size (but for the one canister of its key `more`, below), so a run is the run it was. ?nokitdeal = the cards as they were
  KITDEAL.more = !q.has('nokitmore');   // (…and of 10-18, the maintainer's pick "a tool each pair": three or four as issued are lent the breaching shotgun on Red Two and, of four, the hammer on Blue Two — each pair's second man, so its first goes in with a gun up — in big slots that stood empty, and a man a kit leaves with nothing counted is handed a stun canister — the Quiet kit's fourth man; ?nokitmore = big slots empty as issued, that man with his pistol alone)
  KITDEAL.stealth = !q.has('nokitstealth');   // (…and of 10-20, the maintainer's "that should just be defaults": a stealth mission's sponge rounds, cameras and wand are what your stealth card is issued as — rows you change, priced like any other, the sponge rounds five to a pouch — and nothing is handed over a card or written on a tile as the mission's)
  ISSUE.picked = q.get('kitpack') !== '0';   // a lesson the player packs for (game/kit.ts ISSUE.picked; the maintainer, 10-23, of the kit step's walkthrough: "we should attach it to a tutorial mission (and make it bespoke and explain how to plan)"): ON in the page — the tutorial's squad mission shows its cards on Team & kit and its page stages what he packed; ?kitplan=0 = that row as issued too, no card, as before
  ISSUE.whole = !q.has('issuelend');   // (…and of 10-22, the maintainer's play of the solo tutorial: a mission whose level names your card hands nothing over it — that card is the whole kit, so a loud mission of the quiet kind no longer comes up on five sponge rounds; ?issuelend = the hand-overs land over the card again)
  BIGSLOT.moves = !q.has('nobigmoves');   // (…and of 10-15 evening: the hammer rides on a man's back, his gun is put away for it, it is wound up and swung as one move, and you take the row from where a stack stands and WALK to a free place beside either jamb — ?nobigmoves = the tools as they stood that morning)
  BIGSLOT.snug = !q.has('nobigsnug');   // (…and with the moves: his gun and the tool each stay in a hand while they are off him — the gun let go as his hands leave it, the tool changing between his back and his fist while the fist is there; ?nobigsnug = the first-pass shares, the tool drawn part way between the two. Looks, and how long your own gun and its light are away: about a sixth of a second more)
  BIGSLOT.weight = !q.has('nobigweight');   // (…and of 10-18: the tool changes hands with the weight of a gun swap — your gun carried to its place by hand before the hand goes for the tool, the tool out and back in the times a long gun takes; ?nobigweight = the gun let go at once, 0.6 s out and 0.45 s back)
  BIGSLOT.shut = !q.has('nobigshut'); BIGSLOT.beside = !q.has('nobigbeside');   // (its two knobs of 10-15: the tools open any shut door, from beside the frame — each off = the build of 10-14's rule)
  STICKY.on = !q.has('nosticky');   // sticky cameras (game/stickycam.ts): a row of YOUR kit card and, carrying one, a third load for the rifle's launcher — sent to a wall it is one more eye on the fog of war. ON in the page, ?nosticky = no such row and no such load; off on the frozen stand (TPS_STICKY=1). Before the kit is read from the store, like the wand's.
  STICKY.take = q.get('camtake') !== '0';   // a stuck camera of your own is taken back with the use key and goes on the launcher again (game/stickycam.ts takeCam): ?camtake=0 = a camera sent is a camera spent, as before
  CUES.overheard = q.get('overheard') !== '0';   // a shout from a defender the fog hides, where your ears or a living teammate's really get it, is a quiet row on the radio strip: his words alone, no name, no place (game/cues.ts overheard): ?overheard=0 = such a shout is no row, as before
  STICKY.mark = q.get('cammark') !== '0';   // his own stuck sticky cameras show in the fog of war: never taken out of the picture, a small lens on each on the HUD (game/stickycam.ts stickyMarks): ?cammark=0 = a camera on floor nobody sees is not drawn and nothing marks one, as before
  WORK.on = !q.has('noworkthings');   // a teammate works a thing in the level (game/workthings.ts): the orders' menu on the breaker, or on the mission's thing once it is to be taken, carries that thing's own order on digit 1 — ON in the page; ?noworkthings = the menu there is the floor's, and the breaker errand goes to the nearest man whoever he is, as it was
  LIGHTS.wallOff = q.get('walllight') !== '0';   // a teammate's weapon light is dark while its whole beam would end on the wall, the truck or the dirt at his muzzle (game/guards.ts wallDark; the maintainer, 10-22: "weird that they are shining the flashlight on the wall immediately in front of them"): ON in the page; ?walllight=0 = the light as the other light rules have it, as it was
  IR.teamOff = !q.has('teamlasers');   // the team's guns show no laser line (game/irlaser.ts; the maintainer, 10-22: "why do we have the lasers for the guys? i think we can disable"): no infrared line through your goggles, no red one bare-eyed; your own gun keeps its one. A picture only. ON in the page; ?teamlasers = every teammate's laser as it was
  IRLIGHT.on = !q.has('noirlight');   // an infrared light on the goggles (game/irlight.ts): a room with no light of its own shows through night vision, to you and to a goggled teammate and to nobody else — ON in the page; ?noirlight = a tube amplifies only the light that is there, as it was
  IRLIGHT.auto = !q.has('noirauto');   // …and it burns only where the goggles alone show too little (irlight.ts fanDark: the place's own light through the tube, under NVG.blackAt) — ON in the page; ?noirauto = it burns whenever the goggles are down, as it did
  IRLIGHT.meter = !q.has('noirmeter');   // …and what the CPU's direct-light estimate calls too dark is put to the renderer's light meter, which has the bounce (irlight.ts burn): a room with its own bulb off but lit round its door frame is not dark to the tube — ON in the page; ?noirmeter = the CPU's estimate alone, as it was
  IRLIGHT.near = q.get('irnear') !== '0';   // …and it turns itself down for what stands close in front of it, so a wall a pace off reads as one five metres off and not white (irlight.ts nearK): ?irnear=0 = full strength whatever is in front of it, as it was; ?irnear=<metres> and ?irpower=<n> set its two numbers for a visit (irlight.ts irFlags)
  LIGHTWALL.on = !q.has('nolightwall');   // a weapon light stops at the wall its carrier is pressed to (game/lighting.ts lensClear): ON in the page; ?nolightwall = the light at its lens wherever that is, as it was
  AIRDUST.on = !q.has('flatfog');   // a picked weather's dust stands in the rooms where the openings let it (game/airDust.ts): the men's eyes read that field — ON in the page; ?flatfog = the leak under every roof and the picture's flat veil, as it was (main.ts lowers render/frame.ts weatherVolConfig by the same word)
  gearFromQuery(q);   // the 2010s issue kit (game/gear.ts): Sam's rifle and pistol named a Mk 18 and a Glock 19 (the rifle drawn as an M4-pattern carbine), two-tube goggles that do not glow, the ring worded and drawn a 40 mm sponge round — ON in the page; ?oldgear = the Splinter Cell kit, as it was. Words and boxes, and one number: the Glock's magazines hold fifteen
  wordsFromQuery(q);   // the dialogue pass (game/words.ts): hostages with a voice of their own, and every line said by the side and in the place it was written for — ON in the page; ?oldwords = every line as it was. A bubble's time is its length, so a reworded line can move who talks next: the frozen stand keeps the old words
  LOOK.on = lookOfQuery(q);   // the default look, 2010s GWOT (scene/look.ts): the loud levels' second files and the men's dress (the cast file and its material tables; weapons and kit are GEAR's) — ON in the page; ?look=plain = every level and man as before. Look only: headless no run differs by it (on the page the repainted walls' bounce reaches the GPU light meter).
  LOOK.suit = suitOfQuery(q);   // …and under it the black sneaking suit Sam wears on a mission that is not a squad's loud one (game/cast.ts sneakSuit): ?suit=0 = the operators' issue dress on every mission
  MUSIC.pieces = !q.has('onetheme');   // more music than the one theme (audio/pieces.ts): seven newer pieces beside the theme (which of them plays where is MUSIC.byLevel's, next line) — ON in the page; ?onetheme = the theme alone, as it was. The listener's ears only: no rule reads it and a replay holds no sound
  MUSIC.byLevel = !q.has('shuffle');   // the level's own music (audio/setlist.ts): each level plays the two pieces written down for it, the first when play begins and the second after MUSIC.minutes, and the theme is the menu's alone — ON in the page; ?shuffle = the pieces dealt from a shuffled bag, as they were. The listener's ears only
  MUSIC.theirs = !q.has('teamnerves');   // the score's tension is the opposition's nerves (game/guards.ts tension): in live play a teammate counts only while he is in a fight of his own, not for the wariness a blast or a noise left on him under an order (a show's own men read as ever) — ON in the page; ?teamnerves = every man on the floor counts, as it was. The listener's ears only
  LIVED.on = livedOfQuery(q);   // lived-in rooms (scene/lived.ts): the furniture, clutter, floor pieces and lamps that make each room of a level its own place, as the office's rooms are — ON in the page, raised before the level loads; ?lived=0 = every level as it was before there were any
  GUNWALL.mark = !q.has('nogunmark');   // the aim ring wears a bar while his gun cannot get a round out (game/gunwall.ts `mark`, player.ts gunShut; the overlay's): ?nogunmark = the plain ring, as it was
  GUNWALL.on = !q.has('nogunwall');   // a raised gun comes to the low ready at a wall, a jamb or a leaf inside its reach (game/gunwall.ts): ON in the page; ?nogunwall = guns stay up and are drawn through the wall, as they were
  ROOMCLEAR.fresh = q.get('freshstart') !== '0';   // a room clear that names no placement seed deals a fresh one each visit, off the game's own die's seed (game/roomclear.ts): ON in the page; ?freshstart=0 = the authored placement on every load, as before (a row that pins its seed — the Training lessons — is never touched)
  SAMESTART.on = q.get('samestart') !== '0';   // every mission starts the same way on every try (game/samestart.ts): a room clear's defenders on the level's own marks each load and each restart, a rescue's roamers and clock as written, a quiet mission the first of its lists — ON in the page; ?samestart=0 = every staging dealt as before (the line above, the restart's next placement, the quiet deal off the die)
  { const w = q.get('way'); ROOMCLEAR.way = w === 'any' ? -1 : w !== null && /^\d+$/.test(w) ? +w : 0; }   // …and the way in (ROOMCLEAR.way; the mission sheet's 'Way in' row writes it on the link): absent or ?way=1 = the level's own start, ?way=2 … = its other ones, ?way=any = dealt off this visit's die with the marks
  HOLD.disarm = q.get('disarm') !== '0';   // the grab disarms him (game/disarm.ts): Sam's right hand takes the gun out of the man's as the arm goes round him and lets it down beside them, with voices of its own for the catch, the strip and the gun on the floor — ON in the page; ?disarm=0 = knocked out of his hand on the first frame, as it was
  HOLD.dropGun = !q.has('nogundrop');   // a man taken in the arm drops the gun he had in his hand: it lies on the floor like any dropped gun (game/player.ts startGrab)
  BACKKEY.tab = q.get('tabback') !== '0';   // Esc is only the pause; Tab backs out of the order menu, the Space list, a running verb, the launcher's arc (game/backkey.ts): ON in the page; ?tabback=0 = Esc backs out first, as it did
  HOLD.oneFacing = q.get('holdyaw') !== '0';   // a man in the arm faces where the hold faces him — nothing else turns him (game/nightbreach.ts: the calm defenders' marks)
  GUNHOLD.on = !q.has('nogunhold');   // men who see the pistol come out of a hold run for cover and work round him; the line at his back is used once he has fired (game/gunhold.ts)
  LANES.on = !q.has('nolanes');   // a room fight's defenders remember a lane that cost them — fire down a hallway, mates dropped in it — and stop walking into it: they hold its mouth, go round, or put a charge in first (game/lanes.ts): ON in the page; ?nolanes = they come as they did
  HAULHOME.on = !q.has('nohaulhome');   // a defender hauling furniture to a door brings it the last hand home while his haul clock runs (game/digin.ts HAULHOME): ON in the page; ?nohaulhome = he gives it up the frame he stops at the door with it a hand short
  HARD.sweep = !q.has('nosweep');   // hard's defenders go and look: a garrison that has had word of the team and then nothing for a while sends a pair to where they were last seen or heard, called on their net first (game/pressure.ts goLook, game/enemysquads.ts lookOut — read only while the difficulty is hard): ON in the page; ?nosweep = hard as it was, nobody moves once the noise stops
  STACKLINE.on = !q.has('nostackline');   // a man walking up to stack on a door that stands OPEN keeps the brisk walk onto his mark instead of the slow last steps (game/stackline.ts): ON in the page; ?nostackline = the slow last steps whatever the door, as they were
  REARWATCH.on = !q.has('norearwatch');   // a stack's rear man keeps his gun on the open way at its back, through the entry, and follows last (game/rearwatch.ts): ON in the page; ?norearwatch = his eyes as the unasked cover alone dealt them, every gun on the door once it goes
  REARWATCH.room = !q.has('noroomkeep');   // the man an entry left on a taken room's other door keeps it over 'fall in' until the squad is out of the room, then follows last (game/rearwatch.ts roomKeepTick): ON in the page; ?noroomkeep = his gun turns away the frame 'fall in' is given
  FIXEDSTEP.on = !/^(0|off)$/.test(q.get('fixedstep') ?? '');   // the game runs in whole 1/60 s ticks whatever the display's rate (host/loop.ts FIXEDSTEP — the same game on a 60, a 120 and a 144 Hz display): ON in the page; ?fixedstep=0 = one update a frame on the frame's own time, as before (?fixedstep=<hz> = another tick rate: main.ts)
  TWEEN.on = !/^(0|off)$/.test(q.get('tween') ?? '');   // …and a frame between two ticks is drawn at the blend of them (host/tween.ts: keyed boxes, the men, carried lights, the camera's look-at — a part of a tick behind the game, none on a 60 Hz display; acts only with the line above): ON in the page; ?tween=0 = every frame draws the last tick, as the fixed step did
}

/** the harness stood up as the page with no URL flag on a machine that has kept nothing: the page's own boot switches for an empty query, the kit read from an empty
 *  store (the page: ui/kitPreview.ts kitBoot → kitLoad(localStorage, search)), the solo night's Sam in his own card (the page on ?solo), and the one default a game module keeps for the page alone (the defender squads'
 *  senses). Called once, as tools/qa/headless.ts loads and before any level is built, under the shipped profile only. */
export function shippedBoot(): void {
  pageSwitches(new URLSearchParams(''));
  kitLoad(null, '');
  KIT_SOLO.stand = true;   // (kit.ts kitSoloStand: a game stood up plain, or with a quiet mission alone started on it, wears your card as the page's ?solo / quiet-alone Sam does — one of each under the pouches rule, not the eleven things a Player is built with. A flag of the stand, in no knob table)
  if (envOf().SQUADS === undefined) squadSenses('call');   // (enemysquads.ts: the page opens as ?radiocheck=call; a run that names its own SQUADS word keeps what that module made of it as it loaded)
}

/** WHAT THE FROZEN STAND HOLDS OFF: every row the two harness stands differ in, as `Table.key` (or `tune.key` for Game.tune), with the word that turns it on for a
 *  frozen run where there is one. `probes.ts shipped` stands the game up both ways and is red when this list and the measured difference are not the same list. */
export const FROZEN_HOLDS: Record<string, string> = {
  // standGame's harness block (src/host/standup.ts)
  'OPENING.on': 'TPS_OPENING=1',
  'tune.qrfSilent': 'TPS_QRFSILENT=1',
  'tune.qrfSquad': 'TPS_QRFSQUAD=1',
  'tune.chaos': "the tool's own (playthrough.ts plays 0.5, soak.ts --chaos K)",
  'AIM.player.lightSnapPx': 'none: probes.ts aim-snap sets it',
  'AIM.player.level': 'none: probes.ts aimlevel sets it',
  'AIM.player.low': 'none: probes.ts aimlow sets it',
  'MOVES.on': 'TPS_MOVES=1',
  'TURN.on': 'TPS_TURN=1',
  'DOORPATH.on': 'TPS_DOORPATH=1',
  'FOG.things': 'TPS_FOGTHINGS=1',
  'FOG.flat': 'TPS_FOGFLAT=1',
  'FOG.lit': 'TPS_FOGLIT=1',
  'FOG.full': 'TPS_FOGFULL=1',
  'FOG.edge': 'TPS_FOGEDGE=1',
  'FOG.desat': 'TPS_FOGCOLOUR=1',
  'FOG.squadDoors': 'TPS_SQUADDOORS=1',
  'FOG.squadFire': 'TPS_SQUADFIRE=1',
  'SILENT.on': 'none: probes.ts silent sets it',
  'tune.glassBreak': 'GLASSFX=on',
  'tune.glassShards': 'GLASSFX=on',
  'GLASSPEN.on': 'GLASSFX=on',
  'FRAG.defenders': `--set '{"FRAG":{"defenders":true}}'`,
  'FRAG.fleeWise': 'TPS_FLEEWISE=1',
  'FRAG.restProps': 'TPS_FLEEMATES=1',
  'FRAG.fleeApart': 'TPS_FLEEMATES=1',
  'FRAG.fleeOnto': 'TPS_FLEEMATES=1',
  'FRAG.fleeSam': 'TPS_FLEEMATES=1',
  'FRAG.fleeLook': 'TPS_FLEEMATES=1',
  'FRAG.wallFlee': 'TPS_WALLFLEE=1',
  'FRAG.downKill': 'TPS_DOWNKILL=1',
  'FRAG.fleeDoor': 'TPS_FLEEDOOR=1',
  'DOORSTAY.on': 'QA_DOORSTAY=1 (playthrough.ts plays it on)',
  'LIGHTWALL.on': 'TPS_LIGHTWALL=1',
  'IR.teamOff': 'TPS_NOTEAMLASER=1 (a picture only)',
  'LIGHTS.wallOff': 'TPS_WALLLIGHT=1',
  'IRLIGHT.on': 'TPS_IRLIGHT=1',
  'IRLIGHT.auto': 'TPS_IRAUTO=1',
  'IRLIGHT.meter': 'TPS_IRMETER=1',
  'IRLIGHT.near': 'TPS_IRNEAR=1',
  'AIRDUST.on': 'TPS_AIRDUST=1',
  'WALLSNAP.on': 'TPS_WALLSNAP=1',
  'WALLSNAP.press': 'TPS_WALLPRESS=1',
  'WALLSNAP.voice': 'TPS_WALLVOICE=1',
  'WALLSNAP.slow': 'TPS_WALLSLOW=1',
  'WALLSNAP.leanGun': 'TPS_LEANGUN=1',
  'HANDSLOT.on': 'TPS_HANDSLOT=1',
  'HANDRING.on': 'TPS_HANDRING=1',
  'HANDRING.early': 'TPS_HANDRING=1',
  'HANDRING.empty': 'TPS_HANDRING=1',
  'HANDRING.near': 'TPS_HANDRING=1',
  'HANDRING.lone': 'TPS_HANDRING=1',
  'HANDRING.onThing': 'TPS_HANDRING=1',
  'HANDRING.bare': 'TPS_HANDRING=1',
  'HANDRING.turn': 'TPS_HANDRING=1',
  'HANDRING.corner': 'TPS_HANDRING=1',
  'THROWBACK.on': 'TPS_THROWBACK=1',
  'AUTOCAM.on': 'TPS_AUTOCAM=1 (the mode itself is the seat\'s, off until the camera\'s key is tapped twice: read only by a tool that steps through host/loop.ts stepFrame)',
  'AUTOCAM.sway': 'TPS_AUTOSWAY=1 (the mode\'s slow turn in a fight and on the move; nothing with the mode off)',
  'AUTOCAM.tune': 'TPS_AUTOTUNE=1 (the mode\'s numbers are the player\'s: a mode and rows on Options, the gentle mode where nobody has chosen; nothing with the mode off)',
  'AUTOCAM.restAhead': 'TPS_AUTOTUNE=1 (the gentle mode\'s own number, no turn at rest for the thing on the lens\'s side: host/autocam.ts AUTO_MODES)',
  'AUTOCAM.turnCap': 'TPS_AUTOTUNE=1 (the gentle mode\'s own number, a turn of its own eased under a top speed: host/autocam.ts AUTO_MODES)',
  'AUTOCAM.swingCap': 'TPS_AUTOTUNE=1 (the gentle mode\'s own number, the double tap\'s swing eased under a top speed: host/autocam.ts AUTO_MODES)',
  'AUTOCAM.swayFightMax': 'TPS_AUTOTUNE=1 (the gentle mode\'s own number, the fight\'s lean smaller: host/autocam.ts AUTO_MODES)',
  'AUTOCAM.swayMove': 'TPS_AUTOTUNE=1 (the gentle mode\'s own number, no lean for the way he walks: host/autocam.ts AUTO_MODES)',
  'AUTOCAM.swayRate': 'TPS_AUTOTUNE=1 (the gentle mode\'s own number, the lean slower: host/autocam.ts AUTO_MODES)',
  'OWNBLOW.on': 'TPS_OWNBLOW=1',
  'THROWBACK.restMark': 'none: the overlay reads it, nothing headless does',
  'GUNWALL.on': 'TPS_GUNWALL=1',
  'GUNWALL.mark': 'none: the overlay reads it, nothing headless does',
  'REARWATCH.on': 'TPS_REARWATCH=1',
  'STACKLINE.on': 'TPS_STACKLINE=1',
  'LANES.on': 'TPS_LANES=1',
  'HARD.sweep': 'TPS_SWEEP=1',
  'HAULHOME.on': 'TPS_HAULHOME=1',
  'GUNHOLD.on': 'TPS_GUNHOLD=1',
  'HOLD.dropGun': 'TPS_HOLDDROP=1',
  'HOLD.disarm': 'TPS_DISARM=1',
  'HOLD.oneFacing': 'TPS_HOLDYAW=1',
  'BACKKEY.tab': 'TPS_TABBACK=1',
  'WALLSHOT.on': 'TPS_WALLSHOT=1',
  'WALLKILL.on': 'TPS_WALLKILL=1',
  'HARDBREATH.on': 'TPS_HARDBREATH=1',
  'FIXEDSTEP.on': 'TPS_FIXEDSTEP=1 (read only by a tool that steps through host/loop.ts stepFrame: the harness\'s own W.step names its dt)',
  'TWEEN.on': 'TPS_TWEEN=1 (the picture between two ticks: the same)',
  'REARWATCH.room': 'TPS_ROOMKEEP=1',
  'CLOSE.on': 'TPS_CLOSE=1',
  'CLOSE.heldClicks': 'TPS_HELDCLICKS=1',
  'CLOSE.reachUp': 'TPS_REACHUP=1',
  'CLOSE.handsLow': 'TPS_HANDSLOW=1',
  'CLOSE.noKnife': 'TPS_NOKNIFE=1',
  'FOOTFALL.once': 'TPS_FOOTFALL=1',
  'FOOTFALL.owed': 'TPS_FOOTOWED=1 (acts only under FOOTFALL.once: with TPS_FOOTFALL=1)',
  'TWOGEARS.on': 'TPS_TWOGEARS=1',
  'STALK.on': 'TPS_STALK=1',
  'STALK.turnIn': 'TPS_STALKPOLISH=1 (acts only under STALK.on: with TPS_STALK=1)',
  'STALK.cornerShow': 'TPS_STALKPOLISH=1 (acts only under STALK.on: with TPS_STALK=1)',
  'STALK.catchLong': 'TPS_STALKPOLISH=1 (acts only under STALK.on: with TPS_STALK=1)',
  'STALK.jolt': 'TPS_STALKPOLISH=1 (acts only under STALK.on: with TPS_STALK=1)',
  'STALK.yankWith': 'TPS_STALKPOLISH=1 (acts only under STALK.on: with TPS_STALK=1)',
  'HOLD.wayShape': 'TPS_STALKPOLISH=1 (acts only with bare hands, wherever the reach shows: with TPS_NOKNIFE=1)',
  'HOLD.catchShape': 'TPS_STALKPOLISH=1 (acts only in a bare-handed hold: with TPS_NOKNIFE=1)',
  'HOLD.lunge.dip': 'TPS_STALKPOLISH=1 (acts only under STALK.on: with TPS_STALK=1)',
  'HOLD.lunge.back': 'TPS_STALKPOLISH=1 (acts only under STALK.on: with TPS_STALK=1)',
  'HOLD.sway.m': 'TPS_STALKPOLISH=1 (acts only in a bare-handed hold: with TPS_NOKNIFE=1)',
  'HOLD.sway.twist': 'TPS_STALKPOLISH=1 (acts only in a bare-handed hold: with TPS_NOKNIFE=1)',
  'HOLD.apart.side': 'TPS_STALKPOLISH=1 (acts only in a bare-handed hold: with TPS_NOKNIFE=1)',
  'HOLD.apart.tip': 'TPS_STALKPOLISH=1 (acts only in a bare-handed hold: with TPS_NOKNIFE=1)',
  'HOLD.yank.arch': 'TPS_STALKPOLISH=1 (acts only with bare hands on a stalk: with TPS_STALK=1 and TPS_NOKNIFE=1)',
  'GUARD_EYE.far': 'TPS_FARSIGHT=1',
  'GUARD_EYE.farCalm': 'TPS_FARCALM=1',
  'KITANIM.on': 'TPS_KITANIM=1',
  'THROW_BY.on': 'TPS_THROWBY=1',
  'START.fallIn': 'TPS_FALLIN=1',
  'SAMESTART.on': 'TPS_SAMESTART=1',
  'TAKE.wired': 'TPS_TAKECHECK=1',
  'QUIETFOG.on': 'TPS_QUIETFOG=1',
  'QUIETFOG.def': 'TPS_QUIETDEF=team',
  'QUIETFOG.wand': 'TPS_QUIETWAND=1',
  'QUIETFOG.solo': 'TPS_SOLOFOG=1',
  'TOLD.on': 'TPS_TOLD=1',
  'TOLD.fogOff': 'TPS_FOGOFF=1',
  'TORCH.calmOff': 'TPS_CALMTORCH=1',
  'TORCH.wallLow': 'TPS_TORCHWALL=1',
  'MORALE.on': 'TPS_MORALE=1',
  'RUNNER.on': 'TPS_RUNNER=1',
  'RUNNER.anyway': 'TPS_RUNANYWAY=1',
  'RUNNER.nobody': 'TPS_RUNNOBODY=1',
  'STARTLE.on': 'TPS_STARTLE=1',
  'ROWSET.on': 'TPS_ROWSET=1',
  'SMOKEBREAK.on': 'TPS_SMOKEBREAK=1',
  'SHOWWHY.on': 'TPS_SHOWWHY=1',
  'FIRE.on': 'TPS_FIRE=1',
  'FLINCH.on': 'TPS_FLINCH=1',
  'FLINCH.run': 'TPS_FLINCHRUN=1',
  'VERDICT.loudCard': 'TPS_LOUDCARD=1',
  'DARKDOOR.on': 'TPS_DARKDOOR=1',
  'DARKFOE.on': 'TPS_DARKFOE=1',
  'POWEROUT.on': 'TPS_POWEROUT=1',
  'SQUADDEAL.on': 'TPS_SQUADDEAL=1',
  'STAYASK.on': 'TPS_STAYASK=1',
  'KITLOAD.on': 'TPS_KITLOAD=1',
  'RESCUECHECK.on': 'TPS_RESCUECHECK=1',
  'RESCUEEND.on': 'TPS_RESCUEEND=1',
  'SNATCHOUT.on': 'TPS_SNATCHOUT=1',
  'RESCUEFLUSH.on': 'TPS_RESCUEFLUSH=1',
  'EXACT.on': 'TPS_EXACT=1',
  'CMDCHECK.on': 'TPS_CMDCHECK=1',
  'DOZE.on': 'TPS_DOZE=1',
  'NETQUIET.on': 'TPS_NETQUIET=1',
  'ATTENTION.on': 'TPS_ATTENTION=1',
  'PICTURE.on': 'TPS_PICTURE=1',
  'RESPONSE.on': 'TPS_RESPONSE=1',
  'RELOAD.auto': 'TPS_AUTORELOAD=1',
  'RELOAD.lastMag': 'TPS_LASTMAG=1',
  'SAMSTUN.on': 'TPS_SAMSTUN=1',
  'TEAMTALLY.on': 'TPS_TEAMTALLY=1',
  'AIMWEIGHT.on': 'TPS_AIMWEIGHT=1',
  'SPRINTDOOR.on': 'TPS_SPRINTDOOR=1',
  'TEAMPACE.on': 'TPS_TEAMPACE=1',
  'NOSHOVE.on': 'TPS_NOSHOVE=1',
  'RAILS.on': 'TPS_RAILS=1',
  'DOORFORCE.on': 'TPS_DOORFORCE=1',
  'SLOTSETUP.on': 'TPS_SLOTSETUP=1',
  'SLOTSETUP.pop': 'TPS_SLOTSETUP=1',
  'SLOTSETUP.draw': 'TPS_SETUPDRAW=1 (acts only with the rule up: TPS_SLOTSETUP=1)',
  'GLASSREAL.drop': 'TPS_GLASSDROP=1 (acts only with the glass up: GLASSFX=on)',
  'GLASSREAL.place': 'TPS_GLASSPLACE=1 (acts only with the glass up: GLASSFX=on)',
  'AIMCOST.lamp': 'TPS_LAMPHIT=1',
  'AIMCOST.move': 'TPS_MOVECOST=1',
  'QUICKTHROW.on': 'TPS_QUICKTHROW=0',   // (the one row the FROZEN stand has on and the page does not: the word takes it away)
  'FRIENDS.noSnap': 'TPS_FRIENDS=1',
  'FRIENDS.lowReady': 'TPS_MUZZLE=1',
  'FRIENDLYFIRE.on': 'TPS_FRIENDLYFIRE=1',
  'LIGHTSWITCH.on': 'TPS_LIGHTSWITCH=1',
  'CARLAMPS.on': 'TPS_CARLAMPS=1',
  'CLEANRESTART.on': 'TPS_CLEANRESTART=1',
  'FIRELINE.on': 'TPS_FIRELINE=1',
  'SAVETIMELINE.on': 'TPS_SAVETIMELINE=1',
  'SAVETIMELINE.holds': 'TPS_SAVEHOLDS=1',
  'WALLCHARGE.outer': 'TPS_OUTERWALL=1',
  'WALLCHARGE.safe': 'TPS_WALLSAFE=1',
  'WALLCHARGE.farFurn': 'TPS_WALLFURN=1',
  'WALLCHARGE.hung': 'TPS_HUNGCHARGE=1',
  'WALLCHARGE.outOfFire': 'TPS_STANDFIRE=1',
  'WALLCHARGE.menClear': 'TPS_MENCLEAR=1',
  'CHAOS.pall.on': 'TPS_PALL=1',
  'CHAOS.mess.on': 'TPS_MESS=1',
  'WALLREACT.everyGone': 'TPS_EVERYGONE=1',
  'WALLREACT.blastFlood': 'TPS_BLASTFLOOD=1',
  'CASTOR.on': 'TPS_CHAIRROLL=1',
  'ORDERS.fileSpread': 'TPS_FILESPREAD=1',
  'ORDERS.fileHold': 'TPS_FILEHOLD=1',
  'ORDERS.backEnd': 'TPS_BACKEND=1',
  'ORDERS.inWay': 'TPS_INWAY=1',
  'ORDERS.retakeGoal': 'TPS_RETAKEGOAL=1',
  'ORDERS.walkTries': 'TPS_WALKTRIES=1',
  'ORDERS.roundCap': 'TPS_ROUNDCAP=1',
  'ORDERS.sameWay': 'TPS_SAMEWAY=1',
  'ORDERS.trailDoors': 'TPS_TRAILDOORS=1',
  'PAIR.steady': 'TPS_PAIRSTEADY=1',
  'ROOMFIGHT.coverKeep': 'TPS_COVERKEEP=1',
  'COVER.rearRead': 'TPS_REARREAD=1',
  'COVER.backTurn': 'TPS_BACKTURN=1',
  'UNDERFOOT.on': 'TPS_UNDERFOOT=1',
  'ROUND.on': 'TPS_ROUND=1',
  'SNEAK.stalkAmbient': 'TPS_STALKAMBIENT=1',
  'SNEAK.byEye': 'TPS_BYEYE=1',
  'SNEAK.noiseWalk': 'TPS_NOISEWALK=1',
  'DOORTOOLS.testDoor': 'TPS_DOORTEST=1',
  'DOORTOOLS.thrPie': 'TPS_THRPIE=1',
  'DOORTOOLS.thrLean': 'TPS_THRLEAN=1',
  'DOORTOOLS.thrPieOne': 'TPS_THRPIEONE=1',
  'DOORTOOLS.outsidePlain': 'TPS_OUTSIDEPLAIN=1',
  'DOORTOOLS.wordNoCan': 'TPS_WORDNOCAN=1',
  'DOORTOOLS.wordCuts': 'TPS_WORDCUTS=1',
  'DOORTOOLS.wordSmall': 'TPS_WORDSMALL=1',
  'CMDRING.on': 'TPS_QRING=1',
  'CMDRING.tapNow': 'TPS_QRING=1 (with the ring)',
  'CMDRING.stay': 'TPS_QSTAY=1 (needs TPS_QRING=1)',
  'CMDRING.stayDigit': 'TPS_QSTAY=1 (with the ring that stays)',
  'CMDRING.pin': 'TPS_RINGPIN=1 (needs TPS_QRING=1)',
  'CMDRING.plan': 'TPS_QPLAN=1 (needs TPS_QRING=1)',
  'CMDRING.planRts': 'TPS_QPLAN=1 (with the mode)',
  'CMDRING.planRun': 'TPS_QPLAN=1 (with the mode)',
  'CMDRING.planLook': 'TPS_PLANLOOK=1 (needs TPS_QPLAN=1)',
  'CMDRING.planWaits': 'TPS_PLANWAITS=1 (needs TPS_QPLAN=1)',
  'CMDRING.planKnee': 'TPS_PLANKNEE=1 (needs TPS_QPLAN=1)',
  'CMDRING.planOne': 'TPS_PLANONE=1 (needs TPS_QPLAN=1)',
  'CMDRING.planNear': 'TPS_PLANNEAR=1 (needs TPS_QPLAN=1)',
  'CMDRING.flat': 'TPS_RINGFLAT=1 (needs TPS_QRING=1 TPS_QONLY=1)',
  'CMDRING.plainHint': 'TPS_PLAINHINT=1',
  'CMDRING.only': 'TPS_QONLY=1 (needs TPS_QRING=1)',
  'DOORTOOLS.bangInto': 'TPS_BANGINTO=1',
  'SEENWALK.on': 'TPS_SEENWALK=1',
  'DOORTOOLS.haltBack': 'TPS_HALTBACK=1',
  'DOORTOOLS.behindSam': 'TPS_BEHINDSAM=1',
  'DOORTOOLS.tossMate': 'TPS_TOSSMATE=1',
  'DOORTOOLS.podFrames': 'TPS_PODFRAMES=1',
  'DOORTOOLS.thrHand': 'TPS_THRHAND=1',
  'DOORTOOLS.thrNoCan': 'TPS_THRNOCAN=1 (acts only with the can\'s wait for a hand up as well: TPS_THRHAND=1)',
  'DOORTOOLS.thrFragHold': 'TPS_THRFRAGHOLD=1',
  'DOORTOOLS.thrDoorsLeaf': 'TPS_THRDOORSLEAF=1 (asked of one-way doors only: ONEWAY=1)',
  'DOORTOOLS.fragHold': 'TPS_FRAGHOLD=1 (this rule alone: the threshold\'s half has its own word above)',
  'DOORWAY.sideKick': 'TPS_SIDEKICK=1',
  'DOORWAY.kickGlass': 'TPS_KICKGLASS=1 (acts only with the side kick and rounds through glass up as well: TPS_SIDEKICK=1 GLASSFX=on)',
  'DOORWAY.solid': 'TPS_DOORSOLID=1',
  'FURN.mouth.on': 'TPS_HOLECLEAR=1',
  'FURN.mouth.snow': 'TPS_HOLESNOW=1 (acts only with a blown hole cleared: TPS_HOLECLEAR=1)',
  'FURN.mouth.base': 'TPS_HOLEBASE=1 (acts only with a blown hole cleared: TPS_HOLECLEAR=1)',
  'WX_OWN.roofs': 'TPS_OWNROOFS=1',
  'WX_OWN.wind': 'TPS_WXWIND=1 (acts only on a level of three or four roofs of its own in force: a picked weather, a snow level with TPS_SNOW=1, or TPS_OWNROOFS=1)',
  'SNOW.on': 'TPS_SNOW=1',
  'SNOW_LOOK.on': 'TPS_SNOWLOOK=1 (shows only on a snow level: with TPS_SNOW=1)',
  'SNOW_LOOK.wisps': 'TPS_SNOWWISPS=1 (shows only on a snow level: with TPS_SNOW=1)',
  'SNOW_LOOK.tracks': 'TPS_SNOWTRACKS=1 (shows only on a snow level with its surface: TPS_SNOW=1 TPS_SNOWLOOK=1)',
  'SNOW_LOOK.glow': 'TPS_SNOWGLOW=1 (shows only on a snow level with its surface: TPS_SNOW=1 TPS_SNOWLOOK=1)',
  'SNOW_LOOK.sparkle': 'TPS_SNOWSPARKLE=1 (shows only on a snow level with its surface: TPS_SNOW=1 TPS_SNOWLOOK=1)',
  'SNOW_LOOK.breath': 'TPS_SNOWBREATH=1 (shows only on a snow level: with TPS_SNOW=1)',
  'SNOW_LOOK.steam': 'TPS_BREATHSTEAM=1 (the breath as gas in the smoke solver: with TPS_SNOWBREATH=1 on a snow level, and only where a solver draws — the harness has none)',
  'SNOW_LOOK.grains': 'TPS_SNOWGRAINS=1 (shows only on a snow level: with TPS_SNOW=1; they fly only where the air field runs: TPS_AIR=1 on a page with a GPU)',
  'SNOW_LOOK.oneAir': 'TPS_SNOWAIR=1 (shows only on a snow level: with TPS_SNOW=1; it wants the air field: TPS_AIR=1 on a page with a GPU; with it the grains stand down)',
  'SNOWBOG.on': 'TPS_SNOWBOG=1 (acts only on a snow level: with TPS_SNOW=1)',
  'SNOW_LOOK.marks': 'TPS_SNOWMARKS=1 (shows only on a snow level: with TPS_SNOW=1; it wants the prints: TPS_SNOWTRACKS=1)',
  'SNOW_LOOK.past': 'TPS_SNOWPAST=1 (shows only on a snow level: with TPS_SNOW=1)',
  'SNOW_LOOK.under': 'TPS_SNOWUNDER=1 (a prelude const of the page: nothing headless draws it; shows only on a snow level, TPS_SNOW=1)',
  'SNOW_LOOK.blast': 'TPS_SNOWBLAST=1 (shows only on a snow level: with TPS_SNOW=1; the crater wants the prints: TPS_SNOWTRACKS=1; the throw wants the grains: TPS_SNOWGRAINS=1)',
  'AIR_SIM.on': 'TPS_AIR=1 (a picture only, and the harness has no field to feed: it changes what the game would hand one)',
  'GLASS.bothFaces': 'TPS_GLASSEARS=1',
  'WALLPEN.on': 'TPS_WALLPEN=1',
  'DOORSHOT.on': 'TPS_DOORSHOT=1',
  'DOORTHROW.on': 'TPS_DOORTHROW=1',
  'HANDS.on': 'TPS_HANDS=1',
  'WORK.on': 'TPS_WORKTHINGS=1',
  'WAND.on': 'TPS_WAND=1',
  'WAND.mate': 'TPS_WANDMATE=1',
  'WAND.quick': 'TPS_WANDQUICK=1',
  'PEEKSIGHT.on': 'TPS_PEEKSIGHT=1',
  'STICKY.on': 'TPS_STICKY=1',
  'STICKY.take': 'TPS_CAMTAKE=1',
  'CUES.overheard': 'TPS_OVERHEARD=1',
  'STICKY.mark': 'TPS_CAMMARK=1',
  'OWNCHARGE.on': 'TPS_OWNCHARGE=1',
  'GUNSLOTS.on': 'TPS_GUNSLOTS=1 (rides on the card of the big slot: TPS_BIGSLOT=1 with it)',
  'KITTREE.on': 'TPS_KITTREE=1 (rides on the two gun slots\' card: TPS_GUNSLOTS=1 and TPS_BIGSLOT=1 with it)',
  'GUNLOOK.on': 'TPS_GUNLOOK=1 (nothing to see without a man who carries one of the guns: TPS_GUNSLOTS=1 and TPS_BIGSLOT=1 with it)',
  'GUNROLES.on': 'TPS_GUNROLES=1',
  'BIGSLOT.on': 'TPS_BIGSLOT=1',
  'KITDEAL.on': 'TPS_KITDEAL=1 (reads only with the pouches rule on: SLOTS=on)',
  'KITDEAL.more': 'TPS_KITMORE=1 (reads only with the deal and the big slot on: TPS_KITDEAL=1, TPS_BIGSLOT=1)',
  'KITDEAL.stealth': 'TPS_KITSTEALTH=1 (reads only under the card as a tree: TPS_KITTREE=1 and what it needs)',
  'ISSUE.whole': 'TPS_ISSUEWHOLE=1 (the sponge rounds are a row of the card as a tree: TPS_KITTREE=1 and what it needs)',
  'ISSUE.picked': 'TPS_KITPACK=1 (the page\'s and a recording\'s rule: no headless lesson run raises the issued page)',
  'SQUADTHROW.on': 'TPS_SQUADTHROW=1',
  'SQUAD40.on': 'TPS_SQUAD40=1',
  'AUTOPILOT.on': 'TPS_AUTOPILOT=1',
  'CONDITION.on': 'TPS_CONDITION=1',
  'GUNHAND.on': 'TPS_GUNHAND=1',
  'INHAND.on': 'TPS_INHAND=1',
  'PACKSIDE.on': 'TPS_PACKSIDE=1',
  'PLANLAY.on': 'TPS_PLANLAY=1',
  'STACKROOM.on': 'TPS_STACKROOM=1',
  'HANDLE.toolNear': 'TPS_TOOLNEAR=1',
  'HANDWORK.on': 'TPS_HANDWORK=1',
  'WORKSTOW.on': 'TPS_WORKSTOW=1',
  'SQUADNET.on': 'TPS_SQUADNET=1',
  'SQUADNET.why': 'TPS_QWHY=1',
  'SQUADNET.clear': 'TPS_HONESTCLEAR=1',
  'SQUADNET.endCall': 'TPS_ENDCALL=1',
  'TAKEDOWN.on': 'TPS_TAKEDOWN=1',
  'TAKEDOWN.haul': 'TPS_HAUL=1',
  'STEALTHPOSE.on': 'TPS_STEALTHPOSE=1',
  'GEAR.on': 'TPS_GEAR=1',
  'WORDS.on': 'TPS_WORDS=1',
  'WORDS.doors': 'TPS_DOORNAMES=1',
  'WORDS.radioHome': 'TPS_RADIOHOME=1',
  'WORDS.guide': 'TPS_GUIDEWORDS=1',
  'UNSEEN.on': 'TPS_UNSEEN=1',
  'HOLDFIRE.on': 'TPS_HOLDFIRE=1',
  'SILENT.stackSet': 'TPS_SILENTSET=1',
  'LOOK.on': 'TPS_LOOK=1',
  'MUSIC.pieces': 'TPS_MUSIC=1',
  'MUSIC.byLevel': 'TPS_MUSIC=1 (with the pieces: the one word raises both)',
  'MUSIC.theirs': 'TPS_MUSIC=1 (the same word again: whose nerves the tension reads)',
  'LIVED.on': 'TPS_LIVED=1',
  'ROOMCLEAR.fresh': 'none: tools/qa/fresh-start-check.ts sets it (it needs a Game with a die of its own, and playthrough.ts names every seed)',
  // tools/qa/headless.ts, as it loads
  'DOORWAY.oneWay': 'ONEWAY=1 (playthrough.ts plays it on)',
  'DOORWAY.frameHolds': 'QA_FRAMEHOLDS=1 (playthrough.ts plays it on)',
  'DOORMANNERS.on': 'QA_DOORMANNERS=1 (playthrough.ts plays it on)',
  'DOORBLAST.on': 'QA_DOORBLAST=1 (playthrough.ts plays it on)',
  'SLOTS.on': 'SLOTS=on',
  'CUT.on': 'CUTBOXES=1',
  // set by the page's boot, or by a game module for the page alone — never by the harness (shippedBoot above)
  'DESTRUCTION.on': 'PT_DESTR=1 (playthrough.ts)',
  'RUBBLE.on': 'PT_KICK=1 (playthrough.ts)',
  'EVICT.on': 'PT_POP=1 (playthrough.ts)',
  'SQUADS.radioCheck': 'SQUADS=radiocheck-call',
  'SQUADS.noticedEyes': 'SQUADS=radiocheck-call',
  'SQUADS.callBeat': 'SQUADS=radiocheck-call',
};
export { STAND_ENV } from './standEnv';   // (every environment word the two stands read — its own import-free file: a check clears them before the game loads)
