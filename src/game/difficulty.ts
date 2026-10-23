// THE DIFFICULTY SWITCH for the loud squad scenarios: ONE row (Tab ▸ Sandbox ▸ Difficulty, the start card, ?hard / ?difficulty=) over the two tables that hold
// the harder defenders — pressure.ts (press · flank · fall back) and digin.ts (far rooms get ready). It owns no behaviour, and no state of its own but the levers moved by hand (THE LEVERS, below):
//   STANDARD (shipped) = both tables at their build values, both switches off: the room fight exactly as it was before either file existed, run for run.
//   HARD               = both tables at their build values with both switches ON and the rows of the `HARD` table below written over them, joined by REACH (`HARD.reachM`): a defender whose way on foot to the fight he
//                        hears is shorter than that is the press's (he comes, with the others, round by a second door); a man farther off holds his room and
//                        digs in. What the join adds beside the two files (all inside them, each one clause): the press never takes a man the reach rule holds
//                        (pressure.ts consider), a man on his beat toward a press does not start on his room (digin.ts think), a man SET on his door does not
//                        give his room up at boots outside it (pressure.ts lastMan · DIGIN.holdSet), and a man who gives ground falls back INTO a dug-in room
//                        when his side has one (pressure.ts hooked → digin.ts digInRefuge).
//                        And one row of its own (`HARD.keeperDigs`, off): the man a press leaves to keep his room does NOT dig in — so at reach 0 hard is
//                        the press with almost no barricades (a man digs in only on a noise the press finds nothing in to go to).
//                        The table's other rows are rules of the press, each one switch from b8ffda2's hard: stand to (a team heard before its
//                        first entry), stand and fight (a team that goes straight on), far rooms by one door (the depot). What each measures:
//                        rebuild/hard-everywhere/numbers.md.
// What is kept per machine is the LEVEL'S NAME (`twopointsix.difficulty`), not a copy of the rows: a machine on hard takes the build's hard at every boot, so a
// later build that retunes a row or the reach carries it. The row shown is READ OFF the tables (`difficultyNow`): both switches off = standard whatever the rows
// under them say (nothing in either file runs); both on at the build's hard rows = hard; anything else = custom — a row under the switch moved by hand, which
// drops the stored name and keeps the two tables through their own stores instead (`difficultyCustom`, the Tab rows' save). Nothing here touches hit points,
// aim, reaction tables or dice.
//
//
// THE LEVERS (the maintainer, 10-10: 'let's actually unbundle difficulty a bit now since i think we'll need some play testing' · 'so fog of war has three rungs'
// · 'can have other levers for enemy ai and kit etc.'): what the level's name wrote as one bundle is three LEVERS, each set on its own before a mission
// (ui/levers.ts: the mission sheet and the loadout screen) — `fog` (team all round · team in cones · your own eyes), `ai` (the defenders standard · hard: every
// rule of theirs above) and `kit` (what they carry: nothing · a stun charge each). STANDARD and HARD are the two settings of all three the build was measured
// at (`presetLevers`): a level's name is a shortcut that puts every lever on its rung, and with no lever moved off it this file is what it was, run for run.
// A lever moved by hand (`setLever`) is kept on this machine (`twopointsix.levers`) and stands OVER whichever level a page starts at — the kept name, a
// `difficulty=` on the URL, a short-list row's own — until a level is picked again (the sheet's Standard | Hard: every lever back on that level's rung);
// `?fog=team|cones|own`, `?enemyai=standard|hard`, `?enemykit=none|stuns` are the same for a visit, over the kept ones. The rows shown are READ OFF the
// tables like the name (`leversShown`). No lever touches hit points, aim, reaction tables or dice either.
//
// IMPORT CYCLE (src/game is one): nothing at module level uses another game module's exports.
import { PRESSURE, PRESSURE_DEFAULTS, savePressure, resetPressure } from './pressure';
import { DIGIN, DIGIN_DEFAULTS, saveDigIn, resetDigIn } from './digin';
import { FOG } from './fogofwar';   // (the one row hard writes outside the two tables: the fog of war's cone — read inside setDifficulty only)
import { TOLD, toldNow, toldOfLevel, type ToldRung } from './told';   // (the fourth lever's table: read and written inside functions only — told.ts imports nothing)
import { SQUADDEAL } from './squaddeal';   // (read inside squadsHeld only: squaddeal.ts imports nothing but types)

export type Difficulty = 'standard' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['standard', 'hard'];
/** what HARD is beside 'both switches on': the reach that joins them (m on foot; 0 = no reach rule — the press takes whom it wants; whether the men it leaves
 *  at home dig in is `keeperDigs`). Picked by measurement (record rebuild/harder-defenders/numbers.md): 18 left the office EASIER than standard, 0 clearly harder */
export const HARD = {
  reachM: 0,
  /** THE KEEPER IS NOT DUG IN (record rebuild/hard-everywhere/block-and-six.md; true = b8ffda2's hard run for run): the man a press leaves
   *  to keep his room does not dig in (written to digin.ts `DIGIN.keeper`). Dug in, he was hard's one measured cost off the office: a man who at standard came
   *  hunting, kept behind the one door a stun canister comes through. He keeps the room as the press alone has him, and goes out by another door when the
   *  team's boots reach his. At reach 0 that leaves hard nearly without barricades: a man still digs in on a noise the press finds nothing in for him */
  keeperDigs: false,
  /** STAND TO (pressure.ts `PRESSURE.warned`; record rebuild/hard-everywhere/lost-surprise.md): a team heard before its first entry is
   *  reported on their net, nobody walks off to the report alone, and when a room is hit it is all hands. false = b8ffda2's hard for a team that gave itself away */
  warned: true,
  /** STAND AND FIGHT (pressure.ts `PRESSURE.second`; record rebuild/hard-everywhere/straight-on.md): a hunter a press called who meets the
   *  team out of the room he was sent at stops and fights from where he stands. false = b8ffda2's hard for a team that goes straight on */
  second: true,
  /** THE RULES THAT MAKE HARD BITE OFF THE OFFICE (record rebuild/hard-everywhere/depot-and-pairs.md) — each one row here written to its
   *  pressure.ts row of the same name, both off = 51ce9c3's hard run for run, none reached at standard:
   *  `byWay`  ON: a fight that is not next door: the men of one room go together, by one door, and nobody is kept; next door, as before
   *  `picket` OFF (built, measured, not shipped: nothing gained on the depot beside `byWay`, men lost to it on The block, where the first room's pair
   *           is worth more inside its room): the first room's two do not share one flash — one of them stands outside its far door */
  picket: false, byWay: true,
  /** THE RESCUES (pressure.ts `PRESSURE.rescueCrew`; record rebuild/hard-everywhere/round2-rescues.md): on a hostage rescue the captor calls
   *  the assault on their net and his two men act on it, each saying what he does (rescue.ts crew()). false = f6cf931's hard on a rescue: nothing */
  rescueCrew: true,
  /** THE WAY OUT (pressure.ts `PRESSURE.wayOut`; record rebuild/hard-everywhere/round2-records-pair.md): on a floor whose structure asks
   *  for it (levels/records.json) the men a lost room draws form up on one door of it and hold that from out of a can's reach instead of walking in one at a
   *  time. false = f6cf9316's hard run for run; a level without the row is that either way */
  wayOut: true,
  /** `stuns` 0: stun charges a defender carries (pressure.ts `PRESSURE.stuns`). None in the build's hard; The block's hard gives one each — `HARD_AT` below */
  stuns: 0,
  /** THE NIGHT BREACH (pressure.ts `PRESSURE.drilled`; record rebuild/hard-everywhere/round2-night-breach.md): its three are drilled —
   *  half as shaken by a stun canister or a boot, so they fire blind down the door they were covering instead of folding (roomfight.ts DRILLED: nerves only,
   *  no reaction, aim or hit-point number). false = f6cf931's hard on the night breach: standard, run for run */
  drilled: true,
  /** THE TEAM SEES IN CONES (fogofwar.ts `FOG.cone`; the maintainer after playing, 10-10: 'fog of war being 360 degrees around the players isn't quite
   *  realistic. it really should just be the cone they're looking at' · 'i think the status quo is fine for normal difficulty' · 'but we should have more
   *  realistic vision cones on hard'): where a scenario runs under the fog of war, each eye of the team lifts it only in the cone he looks down (FOG.coneDeg,
   *  with FOG.coneNearM all round him) — the floor behind every back goes dark and a man there is not drawn. Not a rule of the defenders: nobody's AI reads the
   *  fog, and standard never raises the row. false = hard's fog as standard's, every eye all round (the build before it, run for run) */
  cone: true,
  /** GO AND LOOK (pressure.ts `PRESSURE.sweep`, enemysquads.ts `SQUADS.drillLook`; the maintainer, 10-13: harder settings have men who are 'more proactive'):
   *  a side that has had word of the team and then nothing for a while sends two to look where they were last put, on a word on their net. OFF HERE, ON IN
   *  THE PAGE (host/profile.ts pageSwitches; ?nosweep puts it off; the frozen stand keeps it off — TPS_SWEEP=1 raises it there): false = hard before it, run
   *  for run — once the noise stops every man holds the spot it left him on until the team comes to him */
  sweep: false,
};
/** WHAT HARD IS ON ONE LEVEL beside the table above: rows of the press written over hard's while the game stands on that level's structure (the name of its
 *  `scenarios.roomClear` block), so a rule measured on one level leaves every other level's hard as it was, run for run. roomclear.ts start() says where the
 *  game stands (`difficultyHere`); the row the card shows still reads hard there, since `tablesOf` carries these.
 *  The block: A STUN CHARGE EACH. Step three of the order the maintainer set (smarter enemies, then where they start, then kit, then more of them): the first two were
 *  measured there and neither showed. Record: rebuild/hard-everywhere/round2-block.md */
export const HARD_AT: Record<string, Partial<Pick<typeof PRESSURE, 'stuns'>>> = {
  'the block': { stuns: 1 },
};
let HERE = '';
/** the structure a level FILE's room clear stands on, for the levels HARD_AT has rows for (the mission sheet shows a level's own kit before its page exists) */
const LEVEL_STRUCTURE: Record<string, string> = { 'block.json': 'the block' };
export function structureOfLevel(file: string | null | undefined): string { return LEVEL_STRUCTURE[file ?? ''] ?? ''; }

// ─────────────────────────────────────────────────────────────── the levers ───────────────────────────────────────────────────────────────
export type FogRung = 'team' | 'cones' | 'own';
export type AiRung = 'standard' | 'hard';
export type KitRung = 'none' | 'stuns';
/** the fog lever's bottom rung on a squad mission (told.ts TOLD.fogOff): no fog of war at all. Not a FogRung: no level has it, and nothing of the fog's rows says it */
export type FogOff = 'off';
export interface Levers { fog: FogRung | FogOff; ai: AiRung; kit: KitRung; /** how much you're told (told.ts): there only while that lever is on */ told?: ToldRung }
export type LeverKey = keyof Levers;
/** one lever as the screens show it: its name on the URL, its label, and its rungs from the easiest up (each with the one line that says what it does) */
export interface LeverDef { key: LeverKey; param: string; label: string; rungs: { id: string; label: string; words: string }[] }
export const LEVERS: LeverDef[] = [
  { key: 'fog', param: 'fog', label: 'Fog of war', rungs: [
    { id: 'team', label: 'all round', words: 'everyone on your team sees all around them, and you see what they see' },
    { id: 'cones', label: 'cones', words: "each teammate sees only the cone he's looking down, and you see what they see. The floor behind everyone's back is dark, and they call out what you can't see" },
    { id: 'own', label: 'own eyes', words: "only the cone you're looking down lifts the fog, and your teammates call out what they see" } ] },
  { key: 'ai', param: 'enemyai', label: 'Enemy AI', rungs: [
    { id: 'standard', label: 'standard', words: 'the usual defenders. A defender who hears the fight will come to it on his own' },
    { id: 'hard', label: 'hard', words: "they work together. When you hit a room they'll come at it as a group and around through a second door. They'll get ready if they hear you early, and they'll stand and fight where they meet you" } ] },
  { key: 'kit', param: 'enemykit', label: 'Enemy kit', rungs: [
    { id: 'none', label: 'guns', words: 'the defenders carry their guns and nothing else' },
    { id: 'stuns', label: 'stuns', words: "each defender carries a stun charge, and he'll throw it through the door first when he comes at a room you're in" } ] },
];
/** THE FOURTH LEVER (told.ts; the maintainer, 10-23: 'how do we communicate friendly and enemy AI state to the player (especially on easier difficulties)'):
 *  how much you're told, from the easiest up. Not a row of LEVERS: it is a lever only while its switch is on (TOLD.on) — `leversNow()` is the list the
 *  screens, the links and the store go by */
export const TOLD_LEVER: LeverDef = { key: 'told', param: 'told', label: "You're told", rungs: [
  { id: 'guided', label: 'guided', words: "a mark stays for a while where your team last saw an enemy, so you'll know where he went out of sight" },
  { id: 'standard', label: 'standard', words: 'a mark stays for a few seconds where your team last saw an enemy' },
  { id: 'bare', label: 'bare', words: "an enemy who goes out of your team's sight leaves no mark" } ] };
/** the fog lever's bottom rung on a squad mission (TOLD.fogOff): no fog is no fog for the team too — with it down the squad's own code knows every enemy (fogofwar.ts
 *  sighting / hidden answer for all of them), and the words say so */
export const FOG_OFF_RUNG: { id: FogOff; label: string; words: string } = { id: 'off', label: 'off', words: "there's no fog of war, so you and your team know where every enemy on the floor is, even the ones nobody can see" };
/** THE LEVERS AS THE BUILD HAS THEM NOW: LEVERS, the fog's with its bottom rung where that is offered, and the fourth while it is on. With both switches off it IS `LEVERS` */
export function leversNow(): LeverDef[] {
  if (!TOLD.on && !TOLD.fogOff) return LEVERS;
  const out = LEVERS.map(L => (L.key === 'fog' && TOLD.fogOff ? { ...L, rungs: [FOG_OFF_RUNG, ...L.rungs] } : L));
  if (TOLD.on) out.push(TOLD_LEVER);
  return out;
}
/** the fog lever stands on its bottom rung: a squad mission is started with no fog of war (scenarioRun.ts fogOfQuery asks) */
export const fogOffNow = (): boolean => TOLD.fogOff && SET.fog === 'off';
/** the stun charges a defender carries on the kit lever's upper rung (The block's hard is the same one each — HARD_AT) */
export const LEVER_STUNS = 1;
/** the level the levers start from (what setDifficulty was last given) and the levers moved off it (setLever). Both empty-handed = the file as it was */
let BASE: Difficulty = 'standard';
const SET: Partial<Levers> = {};
const anySet = () => SET.fog !== undefined || SET.ai !== undefined || SET.kit !== undefined || SET.told !== undefined;
const isRung = (k: LeverKey, v: unknown): boolean => typeof v === 'string' && !!leversNow().find(l => l.key === k)?.rungs.some(r => r.id === v);
/** WHERE A LEVEL PUTS EVERY LEVER, on the structure the game stands on (the kit is hard's on one level: HARD_AT) */
export function presetLevers(level: Difficulty, structure = HERE): Levers {
  const L: Levers = level === 'hard' ? { fog: HARD.cone ? 'cones' : 'team', ai: 'hard', kit: (HARD_AT[structure]?.stuns ?? HARD.stuns) > 0 ? 'stuns' : 'none' } : { fog: 'team', ai: 'standard', kit: 'none' };
  if (TOLD.on) L.told = toldOfLevel(level);   // (the fourth lever: standard's is Standard, hard's is Bare — told.ts)
  return L;
}
/** the structure the game stands on now ('' = one with no rows of its own). Tables standing at hard are written again for it; standard and custom are left as they are */
export function difficultyHere(structure: string) {
  if (structure === HERE) return;
  const was = difficultyNow(), levers = anySet() && tablesStand() && fogStands(); HERE = structure;
  if (anySet()) { if (levers) write(); }   // (levers moved by hand: the same rungs on this structure — a level's own kit follows it where the kit lever was left alone. Tables another road has moved since — a harness's put-back, rows moved in the Tab panel — are left as they stand)
  else if (was === 'hard') setDifficulty('hard', false);
}
const LS = 'twopointsix.difficulty', LS_LEVERS = 'twopointsix.levers';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function tablesOf(level: Difficulty, set: Partial<Levers> = {}): { P: typeof PRESSURE; D: typeof DIGIN } {
  const P = JSON.parse(JSON.stringify(PRESSURE_DEFAULTS)) as typeof PRESSURE, D = JSON.parse(JSON.stringify(DIGIN_DEFAULTS)) as typeof DIGIN;
  if ((set.ai ?? level) === 'hard') { P.on = true; P.warned = HARD.warned; P.second = HARD.second; P.picket = HARD.picket; P.byWay = HARD.byWay; P.rescueCrew = HARD.rescueCrew; P.wayOut = HARD.wayOut; P.drilled = HARD.drilled; P.sweep = HARD.sweep; D.on = true; D.reachM = HARD.reachM; D.keeper = HARD.keeperDigs; }
  if (level === 'hard') { P.stuns = HARD.stuns; Object.assign(P, HARD_AT[HERE] ?? {}); }   // (the kit is the LEVEL's where its lever was left alone — one each on The block — whatever the AI lever says)
  if (set.kit) P.stuns = set.kit === 'stuns' ? LEVER_STUNS : 0;
  return { P, D };
}
/** the level the two tables stand at now (with a lever moved: the level whose rungs the levers shown ARE, here — else custom) */
export function difficultyNow(): Difficulty | 'custom' {
  if (anySet()) { const S = leversShown(); return DIFFICULTIES.find(lv => same(presetLevers(lv), S)) ?? 'custom'; }
  if (!PRESSURE.on && !DIGIN.on) return PRESSURE.stuns > 0 ? 'custom' : 'standard';   // (the stun charges are carried with the press off too — the kit lever's row: set by hand under standard, it is no level's)
  const T = tablesOf('hard'); return same(T.P, PRESSURE) && same(T.D, DIGIN) ? 'hard' : 'custom';
}
/** THE LEVERS AS THEY STAND, each read off its table (null: a row under it was moved by hand in the debugger and it stands on no rung) */
export function leversShown(structure?: string): { fog: FogRung | FogOff | null; ai: AiRung | null; kit: KitRung | null; told?: ToldRung } {
  const noKit = (P: typeof PRESSURE) => ({ ...P, stuns: 0 }), H = tablesOf('hard');
  if (structure !== undefined && structure !== HERE && SET.kit === undefined && tablesStand()) { const S = leversShown(); return S.kit ? { ...S, kit: presetLevers(BASE, structure).kit } : S; }   // (a mission sheet's row: the kit the LEVEL carries on that mission's structure — one each on The block's hard — where the lever was left alone)
  return { fog: fogOffNow() ? 'off' : FOG.cone ? (FOG.own ? 'own' : 'cones') : FOG.own ? null : 'team',   // (the bottom rung is the lever's own word, read first: a mission starts with no fog under it whatever the fog's two rows say)
    ai: !PRESSURE.on && !DIGIN.on ? 'standard' : same(noKit(H.P), noKit(PRESSURE)) && same(H.D, DIGIN) ? 'hard' : null,
    kit: PRESSURE.stuns === 0 ? 'none' : PRESSURE.stuns === LEVER_STUNS ? 'stuns' : null,
    ...(TOLD.on ? { told: toldNow() } : {}) };
}
/** the two tables still stand where the level and the levers last wrote them (false: another road has moved them since — rows in the Tab panel, a ?flag, a
 *  harness's --set or its put-back), and the fog's cone where the fog lever put it */
const tablesStand = () => { const T = tablesOf(BASE, SET); return same(T.P, PRESSURE) && same(T.D, DIGIN); };
const coneOf = (rung: FogRung | FogOff) => rung === 'cones' || rung === 'own';
/** the level whose fog, AI and kit rungs the levers stand on as set (the level under them where those three are no level's) */
function levelOfThree(): Difficulty {
  if (SET.fog === undefined && SET.ai === undefined && SET.kit === undefined) return BASE;
  const three = (L: Levers) => `${L.fog}|${L.ai}|${L.kit}`, B = presetLevers(BASE), mine = three({ fog: SET.fog ?? B.fog, ai: SET.ai ?? B.ai, kit: SET.kit ?? B.kit });
  return DIFFICULTIES.find(lv => three(presetLevers(lv)) === mine) ?? BASE;
}
const fogStands = () => !SET.fog || FOG.cone === (coneVisit ?? coneOf(SET.fog));
const shownWhole = () => { const S = leversShown(); return !!S.fog && !!S.ai && !!S.kit; };   // (the fourth lever always stands on a rung: it has no rows under it to be moved by hand)
/** the levers moved off the level by hand (a copy; {} = none: the level's own on every one) and the level they stand over */
export function leversSet(): Partial<Levers> { return { ...SET }; }
export function leversBase(): Difficulty { return BASE; }
/** levers are moved and every one stands on a rung, but on no level's: 'your own mix' (false at a level's own setting, and with rows moved under a lever by hand) */
export function leversMixed(): boolean { return anySet() && shownWhole() && difficultyNow() === 'custom'; }
let coneVisit: boolean | null = null;   // (setConeVisit, below: the fog's cone for this visit; null = the level decides)
let ownWas: boolean | null = null;      // (FOG.own as it stood before the fog lever wrote it — the kept option, teamfeel.ts — put back when the lever lets go)
let ownFor: FogRung | FogOff | null = null;      // (the rung FOG.own was last written for: written again only when the lever MOVES, so a ?fogown visit or the Tab row flipped over the lever stands through a later write of the tables — a scenario's start)
/** the tables written whole from the level and the levers over it, the fog's two rows with them (`fogOnly`: the fog's rows alone — the fog lever moves nothing of the defenders') */
function write(fogOnly = false) {
  if (!fogOnly) { const T = tablesOf(BASE, SET); Object.assign(PRESSURE, T.P); Object.assign(DIGIN, T.D); }
  TOLD.rung = SET.told ?? toldOfLevel(levelOfThree());   // (the fourth lever's rung, written with every level and lever — told.ts: read only while its switch is on. Left alone it follows the level the other three stand on, so hard's rungs set lever by lever are still Hard, as they were with three)
  FOG.cone = coneVisit ?? (SET.fog ? coneOf(SET.fog) : BASE === 'hard' && HARD.cone);   // (the fog's cone is hard's: the level's own row, written with it — not part of what `difficultyNow` reads with no lever moved, so the Tab row flipped by hand leaves the level's name alone. FOG.own is nobody's level: an option of its own, and the fog lever's top rung)
  if (SET.fog) { if (SET.fog !== ownFor) { if (ownWas === null) ownWas = FOG.own; FOG.own = SET.fog === 'own'; ownFor = SET.fog; } }
  else if (ownFor !== null) { if (ownWas !== null) FOG.own = ownWas; ownWas = null; ownFor = null; }
}
function storeName(level: Difficulty) { try { if (level === 'standard') globalThis.localStorage?.removeItem(LS); else globalThis.localStorage?.setItem(LS, level); } catch { /* no store */ } }
/** the kept rungs this visit's switches hide (told.ts: ?told=0, ?fogoff=0): a lever moved on such a visit keeps them, a level picked drops them with the rest */
function keptHidden(): Partial<Levers> {
  const out: Partial<Levers> = {}; if (TOLD.on && TOLD.fogOff) return out;
  try { const o = JSON.parse(globalThis.localStorage?.getItem(LS_LEVERS) ?? 'null'); if (o && typeof o === 'object') { if (!TOLD.on && TOLD_LEVER.rungs.some(r => r.id === o.told)) out.told = o.told; if (!TOLD.fogOff && o.fog === 'off') out.fog = 'off'; } } catch { /* no store, or not ours */ }
  return out;
}
function storeLevers(all = false) { try { const S = all ? SET : { ...keptHidden(), ...SET }; if (Object.keys(S).length) globalThis.localStorage?.setItem(LS_LEVERS, JSON.stringify(S)); else globalThis.localStorage?.removeItem(LS_LEVERS); } catch { /* no store */ } }
/** set the level: both tables written whole, at the build's rows, EVERY LEVER BACK ON THE LEVEL'S OWN RUNG. `keep` (the UI) stores the level's NAME on this
 *  machine and drops the two tables' own stored copies and the kept levers (standard stores nothing: a fresh machine and a machine put back to standard are
 *  the same thing); the harness and a ?flag visit pass false */
export function setDifficulty(level: Difficulty, keep = true) {
  BASE = level; delete SET.fog; delete SET.ai; delete SET.kit; delete SET.told; if (keep) HELD = null;
  if (keep) { resetPressure(); resetDigIn(); storeLevers(true); storeName(level); }
  write();
}
/** THE LEVEL UNDER THE LEVERS, for this page only (a short-list row opened on its own difficulty — ui/loadout.ts): the levers moved by hand stay over it.
 *  With none moved it is setDifficulty(level, false) */
export function setBase(level: Difficulty) { BASE = level; write(); }
/** THE LEVEL UNDER THE LEVERS AS THE TABLES STAND, before a lever is moved: BASE is what setDifficulty was last given, and the tables can have been moved by
 *  another road since (the Tab rows, their section's ↺, a ?flag). Where they no longer stand on BASE and the levers, the level and the kit are read back OFF
 *  them (leversShown). Returns whether they stand on a level and levers now (false: rows under a lever were moved by hand — custom) */
function adopt(): boolean {
  if (!fogStands()) delete SET.fog;
  if (tablesStand()) return true;
  const S = leversShown(); delete SET.ai; delete SET.kit;
  BASE = S.ai ?? 'standard';
  if (S.ai && S.kit && S.kit !== presetLevers(BASE).kit) SET.kit = S.kit;
  return tablesStand();
}
let HELD: Partial<Levers> | null = null;   // (the kept levers a `plain` page did not put on — initDifficulty: a lever moved on that page is moved among them)
/** MOVE ONE LEVER (null: back to the level's own). `keep` (the UI) stores the moved levers on this machine; a ?flag visit and the harness pass false. The
 *  other levers stay where they were. The FOG lever writes the fog's rows alone; the AI and kit levers write both defenders' tables whole — over rows moved
 *  under them by hand (custom) — and drop those tables' own stored copies. `structure` (the screens: the structure of the mission the row is shown for):
 *  a lever put on the rung the level itself has there is let go of, not pinned — its row reads as the level's again and follows the next level picked */
/** a lever that writes nothing of the defenders' two tables: the fog's, and how much you're told */
const own = (key: LeverKey) => key === 'fog' || key === 'told';
export function setLever<K extends LeverKey>(key: K, rung: Levers[K] | null, keep = true, structure?: string) {
  if (rung !== null && !isRung(key, rung)) return;
  if (keep && HELD) { for (const L of leversNow()) if (HELD[L.key] !== undefined && SET[L.key] === undefined) (SET as Record<string, string>)[L.key] = HELD[L.key]!; write(HELD.ai === undefined && HELD.kit === undefined); HELD = null; }
  const stood = adopt();
  if (rung === null || (structure !== undefined && rung === presetLevers(BASE, structure)[key])) delete SET[key]; else SET[key] = rung as Levers[K];
  if (keep) { if (!own(key)) { resetPressure(); resetDigIn(); } storeLevers(); if (stood || !own(key)) storeName(BASE); }   // (the level's name with them: what the screen showed under the lever is what the next plain page load starts from)
  write(own(key));
}
/** game.ts, ROUND the kept feel rows being read back (`load` — teamfeel.ts loadTeamFeel writes FOG.own as this machine keeps it): the fog lever's rung over it again, the kept one remembered for when the lever lets go */
export function leversFog(load: () => void) {
  if (ownFor !== null && ownWas !== null) FOG.own = ownWas;   // (the lever's hand off the row while the kept copy is read: it only writes the keys it keeps)
  load();
  if (SET.fog) { ownWas = FOG.own; FOG.own = SET.fog === 'own'; ownFor = SET.fog; }
}
/** THE CONE FOR THIS VISIT, whatever the level and through every later write of it (a scenario's start writes hard's rows again — difficultyHere; the mission
 *  sheet's click writes a level): ?fogcone / ?fogcone=0, and the Tab row flipped by hand. null = the level decides (HARD.cone). Not stored: the next page load asks again. */
export function setConeVisit(v: boolean | null) { coneVisit = v; FOG.cone = v ?? (SET.fog ? coneOf(SET.fog) : (anySet() ? BASE : difficultyNow()) === 'hard' && HARD.cone); }
/** the fog's cone as pinned for this visit (null: the level decides) — for a caller that lays its own pin over it for a while and must put this one back (quietfog.ts) */
export const coneVisitNow = (): boolean | null => coneVisit;
/** a row UNDER the switch was moved by hand (the Tab rows' save, a section's ↺): the stored name no longer says what this machine plays — both tables go to
 *  their own stores as they stand (a table standing at the build's rows stores nothing), and the name is dropped */
export function difficultyCustom() {
  if (same(PRESSURE, PRESSURE_DEFAULTS)) resetPressure(); else savePressure();
  if (same(DIGIN, DIGIN_DEFAULTS)) resetDigIn(); else saveDigIn();
  try { globalThis.localStorage?.removeItem(LS); } catch { /* no store */ }
  if (SET.ai !== undefined || SET.kit !== undefined || HELD) { delete SET.ai; delete SET.kit; if (HELD) { delete HELD.ai; delete HELD.kit; } const fog = SET.fog ?? HELD?.fog, told = SET.told ?? HELD?.told;   // (…and the AI and kit levers with it: the rows as they stand are what this machine plays now. The fog lever is its own)
    try { if (fog || told) globalThis.localStorage?.setItem(LS_LEVERS, JSON.stringify({ ...(fog ? { fog } : {}), ...(told ? { told } : {}) })); else globalThis.localStorage?.removeItem(LS_LEVERS); } catch { /* no store */ } }   // (…and how much you're told, which has no rows under it either)
}
/** main.ts, BEFORE the boot card paints (both tables have read their own stores at import): the level this machine keeps, then the visit's flags over it —
 *  (not on a `plain` page, unless ?lessonhard) — ?hard / ?hard=0 / ?difficulty=hard|standard (not stored) — then THE LEVERS over the level: the ones this machine keeps, and ?fog= / ?enemyai= /
 *  ?enemykit= for the visit over those (neither on a page that is `plain` — a Training lesson is taught on the level as it is) — and the two older single-switch flags last,
 *  over whatever the level wrote (?hard&pressure=0 = hard without the press, as the harness's --set reads it) */
export function initDifficulty(q: URLSearchParams, plain = false) {
  let kept: string | null = null; try { kept = globalThis.localStorage?.getItem(LS) ?? null; } catch { /* no store */ }
  if (kept === 'hard' && (!plain || q.has('lessonhard'))) setDifficulty('hard', false);   // (a `plain` page — a Training lesson — is taught on standard whatever this machine keeps, as its levers are held off below: hard's men come looking while a line is being read. ?lessonhard = as it was: the kept level on a lesson too; ?hard still sets it for the visit)
  const v = q.has('hard') ? (q.get('hard') === '0' ? 'standard' : 'hard') : q.get('difficulty');
  if (v === 'hard' || v === 'standard') setDifficulty(v, false);
  HELD = null;
  if (plain) { const kept = keptLevers(); if (Object.keys(kept).length) HELD = kept; }
  else for (const [k, r] of Object.entries(keptLevers())) setLever(k as LeverKey, r as never, false);
  if (!plain) for (const L of leversNow()) { const r = q.get(L.param); if (r !== null && isRung(L.key, r)) setLever(L.key, r as never, false); }   // (`told=0`, that lever's own off switch, is no rung: host/profile.ts reads it)
  if (q.has('digin')) DIGIN.on = true;
  if (q.has('pressure')) PRESSURE.on = q.get('pressure') !== '0';
  // ?fogcone / ?fogcone=0 — the fog of war's cone for this visit whatever the level (setConeVisit).   (?fogown / ?fogcalls are the fog's own flags: fogofwar.ts
  // fogFlags, read where the kept rows are — the Game's constructor)
  if (q.has('fogcone')) setConeVisit(q.get('fogcone') !== '0');
}
/** the levers this machine keeps (only rungs the build still has) */
export function keptLevers(): Partial<Levers> {
  const out: Partial<Levers> = {};
  try { const o = JSON.parse(globalThis.localStorage?.getItem(LS_LEVERS) ?? 'null'); if (o && typeof o === 'object') for (const L of leversNow()) if (isRung(L.key, o[L.key])) (out as Record<string, string>)[L.key] = o[L.key]; } catch { /* no store, or not ours */ }
  return out;
}
/** the store took the levers (false: nothing can be kept here — a link then carries them itself, as it carries the level) */
function leversKept(): boolean { const K = keptLevers(); return leversNow().every(L => K[L.key] === SET[L.key]); }
/** a scenario link with the level the tables stand at on it (the start card: a pick is a page load, and the flag carries the choice across it even where
 *  nothing can be stored — and over a ?hard the visitor arrived with). Standard on a link that names no level is left alone, and so is any link while the tables read
 *  custom (whatever made them so — the visit's flags, or stored rows — is still there after the load). WITH LEVERS MOVED the link names the level they stand
 *  over, drops whatever levers it carried, and carries the moved ones itself only where this machine could not keep them (kept, the page it loads reads them back) */
export function difficultyHref(href: string): string {
  const now = difficultyNow(), [path, query = ''] = href.split('?'), all = query.split('&').filter(k => k), keys = all.filter(k => !/^(hard|difficulty)(=|$)/.test(k));
  if (anySet()) return shownWhole() ? leversHref(`${path}?${[...keys, `difficulty=${BASE}`].join('&')}`) : href;
  if (now === 'custom') return href;
  if (now === 'standard' && keys.length === all.length) return leversHref(href);
  return leversHref(`${path}?${[...keys, `difficulty=${now}`].join('&')}`);
}
/** a link that names its OWN level (a short-list row: scene/picks.ts) with the moved levers put right on it: whatever levers it carried are dropped, and the
 *  moved ones ride on it only where this machine could not keep them. No lever moved = the link with no lever on it (one the visitor arrived with — ?fog= — and has since let go of does not ride on) */
export function leversHref(href: string): string {
  if (anySet() && !shownWhole()) return href;
  const [path, query = ''] = href.split('?'), all = query.split('&').filter(k => k), now = leversNow(), keys = all.filter(k => !now.some(L => k.split('=')[0] === L.param));   // (`told=0`, the fourth lever's off switch, rides on: with it the lever is not in this list)
  if (!anySet() && keys.length === all.length) return href;
  const levers = !anySet() || leversKept() ? [] : now.filter(L => SET[L.key] !== undefined).map(L => `${L.param}=${SET[L.key]}`);
  const q = [...keys, ...levers].join('&');
  return q ? `${path}?${q}` : path;
}
/** IS THIS MISSION HELD BY SQUADS (scenarios.ts `squads`), as `difficultyWords` wants it said: its level file (a squad map), true (one with no file named), false
 *  (one pool). What hard is on a squad map is its own thing (enemysquads.ts SQUADS.drill*), so the card words it apart. THE ROW SAYS SO — `ScenarioEntry.squads`,
 *  written beside the level's name by whoever adds the mission and held against the level file by tools/qa/levers-probes.ts — so a new squad level needs nothing
 *  in this file: without a sentence of its own in `SQUAD_HARD` its Hard reads 'the squads are a drilled garrison' */
export function squadsOf(e: { level?: string; squads?: boolean } | null | undefined): string | boolean { return e?.squads ? e.level || true : false; }
/** what the screens word a row's Hard by: the row's own fact, or (squaddeal.ts) squads cut from the rooms of a room clear whose file names none — 'held by
 *  squads, not said which', so the drilled garrison's sentence and not the one pool's */
export function squadsHeld(e: { level?: string; squads?: boolean; kind?: string } | null | undefined): string | boolean { return squadsOf(e) || (SQUADDEAL.on && e?.kind === 'roomclear'); }
/** what hard is on each squad map, in a sentence (enemysquads.ts DRILL_AT is the rows; record rebuild/hard-everywhere/round2-squad-maps.md),
 *  by level file and by structure name: the mission sheet knows the one, a running game the other */
const SQUAD_HARD: { file: string; structure: string; words: string }[] = [
  { file: 'block-squads.json', structure: 'the block, three squads', words: "They don't run at the first noise. You'll hear them hold on the radio and let you commit to a room, and then the pair that comes around will be set at its other door while you're still going in" },
  { file: 'compound.json', structure: 'the compound', words: "A squad gets to one of its rooms faster when you hit it, and nobody walks into a room that's already lost. You'll hear them call it gone on the radio, and they'll be on their own doors when you get there" },
  { file: 'barracks.json', structure: 'the barracks', words: 'A pair sent around to hold a lost room\'s other door won\'t stay out there once the squad it went to help stops answering. You\'ll hear them call "back on our doors", and they\'ll be in their own rooms again and come at you when you take the next one' },
  { file: 'warehouse.json', structure: 'the warehouse', words: '' },
  { file: 'block.json', structure: 'the block', words: '' },   // (the rebuilt block: eight men, four stay-put squads of two, a room each. Scripted team, seeds 1–12 by the go-round route and 1–8 by the hall doors: hard is standard's run, save one where a man put his stun charge down a covered lane)
];
/** `squads`: the level file or the structure's name of a squad map (false / '' = not one; true = one, not said which) */
export function difficultyWords(level: Difficulty | 'custom' = difficultyNow(), squads: string | boolean = false): string {
  if (level === 'custom' && leversMixed()) return `your own mix: ${leversLine(true)}`;   // (levers moved by hand to no level's setting: each said by its rung)
  const cone = HARD.cone ? "under the fog of war each teammate sees only the cone he's looking down, so the floor behind everyone's back is dark, and they call out what you can't see" : '';   // (the fog of war's cone: hard's on every level the fog is up on)
  const Cone = cone && ` ${cone[0].toUpperCase()}${cone.slice(1)}`;
  if (squads && level === 'hard') { const w = SQUAD_HARD.find(x => x.file === squads || x.structure === squads)?.words;
    // (the kit a floor's hard carries is said on a squad map too — HARD_AT by the structure the level file stands for, or the one named, or the running game's:
    //  on the rebuilt block, eight men as four stay-put squads, it is the one thing of hard's that acts — the man who knows a way is covered puts his charge down it)
    const at = typeof squads === 'string' ? structureOfLevel(squads) || squads : HERE, kit = HARD_AT[at]?.stuns ? ". Here each defender carries a stun charge, and he'll throw it down a hallway he knows you're holding" : '';   // (said as the men of such a floor use it today: nobody leaves his room on the block, so the charge goes down a lane that cost them — lanes.ts — not ahead of a man coming at you)
    return w ? `hard: the squads are a drilled garrison. ${w}${kit}${Cone && '.' + Cone}` : w === '' ? `hard: the squads here are the standard ones, because this floor is hard enough as it is${kit}${Cone && '.' + Cone}` : `hard: the squads are a drilled garrison${kit}${Cone && '.' + Cone}`; }
  return level === 'standard' ? 'standard: the usual defenders' : level === 'hard' ? "hard: the defenders come at you together and around through a second door, a far room's defenders come as a group, and they stand and fight where they meet you in the open. If they hear you before your first entry, they'll get ready. The last defender in a room will slip out through another door before you reach his door. At the records office, the defenders who come to a lost room will watch its door from out of a flashbang's reach and let you come out to them. On a hostage rescue the captor calls your assault on the radio and his guards act on it. On the night breach the defenders are drilled, half as shaken by a flashbang, and they'll fire blind through the door they were watching" + (HARD_AT[HERE]?.stuns ? ". Here each defender carries a stun charge, and he'll throw it through a door before he comes in" : '') + (Cone && '.' + Cone) : 'custom: rows under the switch were moved by hand (the Enemy AI page of the debugger)';
}

/** the rung of one lever in a line (its `words`; '' = it stands on none) — the screens' note beside a lever's buttons */
export function leverWords(key: LeverKey, rung: string | null): string { return leversNow().find(L => L.key === key)?.rungs.find(r => r.id === rung)?.words ?? ''; }
/** the levers in a line — 'fog of war: your own eyes · enemy AI: standard · enemy kit: stun charges'. `all` false: only the ones moved by hand ('' = none) */
export function leversLine(all = false): string {
  const S = leversShown() as Record<LeverKey, string | null>;
  return leversNow().filter(L => all || SET[L.key] !== undefined).map(L => `${L.label[0].toLowerCase()}${L.label.slice(1)}: ${L.rungs.find(r => r.id === S[L.key])?.label ?? 'custom'}`).join(' · ');
}
