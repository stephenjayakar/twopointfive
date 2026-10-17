// THE ONE LIST OF KNOB TABLES. A knob table is a module-level object of switches and numbers that changes how the game plays (AIM, DOORWAY, ROOMFIGHT,
// SQUADS …): flipped by a Tab row, a URL flag, a probe, a play-through's --set. Hand-kept lists of them used to stand side by side — what a session recording
// carries (journal.ts), what a play-through's --set reaches and puts back (tools/qa/playthrough.ts), what the probe runner snapshots round every probe
// (tools/qa/probes.ts, plus nine tables named by hand) — and a table added to one was missing from the others. Those three read this file now:
//   knobRegistry()   every table by name (LAZY — see below)
//   JOURNAL_KNOBS    the names a recording carries and a replay applies (journal.ts knobTables), in the order the file has always listed them
//   knobsCopy()      a deep copy of the tables · knobsBack() puts one back IN PLACE (the probe runner's and the play-through's: what a run changed is undone)
//   assignDeep()     the journal's rule for laying a FILE's tables over the live ones (only keys the build still has, type for type)
// A NEW TABLE takes an import line here, an entry in knobRegistry()'s literal, and its name in JOURNAL_KNOBS when a replay needs it. STILL ITS OWN LIST: the
// squad's feel panel (teamfeel.ts feelTables + KEPT — which rows a machine keeps, with their ranges; left alone, it is where merges collide most) — and
// tools/qa/knobs-check.ts (`probes.ts journal-knobs`) fails when the feel panel or a recording names a table that is not here, and lists the switch tables
// under src/game the registry does not hold yet. A few tally tools keep purpose-built --set lists of their own (pairsneak.ts, bang-tally.ts, roomclear-tally.ts).
// (src/game is one import cycle and the browser bundle hoists module bindings: nothing here is built from another game module's exports at module load — the
// registry is made on each call. The imports keep journal.ts's old order first, so the modules a recording names evaluate in the order they always did.)
import { DESTRUCTION, FURNBLAST, RUBBLE, EVICT } from './destructionSwitch';
import { CKPT } from './savestate';
import { AIM, TRAINED } from './aim';
import { AI_TUNE, BODY_LIGHT, GUARD_EYE, PACE, LIGHTS } from './guards';
import { NEEDS } from './needs';
import { WHISTLE } from './whistle';
import { WET } from './wet';
import { WIND } from './wind';
import { CIV } from './civilians';
import { CHAOS } from './destruction';
import { WALLS } from './wallbreak';
import { WALLCHARGE } from './wallcharge';
import { WALLREACT } from './wallreact';
import { COVERFIRE } from './coverfire';
import { RING } from './launcher';
import { HE40 } from './he40';
import { SHOTGUN } from './shotgun';
import { SHIELD } from './shield';
import { FRAG } from './frag';
import { LAUNCHER, LAUNCHER40 } from './weapons';
import { GLASS, GLASSFX } from './glass';
import { GLASSBREAK } from './glassbreak';
import { GLASSPEN } from './glasspen';
import { SHARDS } from './shards';
import { TALK_TUNE } from './dialogue';
import { HOLD, MOVES, MV, TURN } from './character';
import { SUPPRESSION } from './suppression';
import { RIFLE_SPREAD } from './player';
import { OVERHEAR } from './devices';
import { SCORE, BADGE } from './chronicle';
import { WOUND } from './wounds';
import { DOORPATH } from './doorpath';
import { FOG } from './fogofwar';
import { DOORWAY, DOORSTAY } from './doors';
import { DOORBLAST } from './doorblast';
import { HANDLE } from './handleside';
import { DOORMANNERS } from './doorway';
import { OPENING } from './opening';
// (the squad's feel tables — teamfeel.ts's — and the ones a play-through's --set reaches: after the journal's, in teamfeel.ts's and playthrough.ts's order)
import { FLASH, LASER } from './combat';
import { DOORTOOLS } from './doortools';
import { ROOMFIGHT, DRILLED } from './roomfight';
import { ORDERS } from './orders';
import { COVER, REAR } from './cover';
import { ROOMFIT } from './roomfit';
import { NVG } from './nvg';
import { IR } from './irlaser';
import { IRLIGHT } from './irlight';
import { WALLPEN } from './wallpen';
import { ENTRY } from './entrypoints';
import { SILENT } from './silent';
import { PAIR } from './pairorders';
import { RESCUE } from './rescue';
import { DIGIN, HAULHOME } from './digin';
import { PRESSURE } from './pressure';
import { LANES } from './lanes';
import { GUNHOLD } from './gunhold';
import { HARD, HARD_AT } from './difficulty';
import { WX_SIM } from './weather';
import { WX_OWN, SNOW, SNOW_LOOK } from './weatherKinds';
import { AIR_SIM } from './airSim';
import { SQUADS, DRILL_AT } from './enemysquads';
import { CUES } from './cues';
import { BUDDY } from './buddy';
import { LASTSTAND } from './laststand';
import { CLEARLINE } from './clearline';
import { STACKROOM } from './stackroom';
import { REARWATCH } from './rearwatch';
import { STACKLINE } from './stackline';
import { SNEAK } from './sneak';
import { UNSEEN } from './unseen';
import { SEENWALK } from './seenwalk';
import { HOLDFIRE } from './holdfire';
import { PAIRUP } from './pairup';
import { LESSON } from './lesson';
import { PAR } from './par';
import { VERDICT } from './verdict';
import { SNATCH } from './snatch';
import { DEFUSE } from './defuse';
import { SPOTTED } from './spotted';
import { SLOTS, ISSUE, BIGSLOT } from './kit';
import { NIGHTBREACH } from './nightbreach';
import { ROOMCLEAR } from './roomclear';
import { BREAKS } from './breakTable';
import { FURN } from './furnblast';
import { SNOWBOG } from './snowBog';
import { LIGHTWALL } from './lighting';
import { AIRDUST } from './airDust';
import { WALLSNAP } from './wallsnap';
import { cutConfig } from '../scene/cut';   // (the cut-pieces switch: not a game module, no cycle)

/** the names a recording carries and a replay applies, in the order journal.ts has always written them (a session file's `knobs.tables` keys) */
export const JOURNAL_KNOBS: readonly string[] = ['AIM', 'TRAINED', 'AI_TUNE', 'BODY_LIGHT', 'GUARD_EYE', 'NEEDS', 'WHISTLE', 'WET', 'WIND', 'CIV', 'CHAOS', 'RING', 'LAUNCHER', 'HE40', 'LAUNCHER40', 'FRAG', 'SHOTGUN', 'SHIELD', 'GLASS', 'GLASSFX', 'GLASSBREAK', 'GLASSPEN', 'SHARDS', 'TALK_TUNE', 'HOLD', 'SUPPRESSION', 'RIFLE_SPREAD', 'OVERHEAR', 'SCORE', 'BADGE', 'CKPT', 'FOG', 'MOVES', 'MV', 'TURN', 'WOUND', 'DOORPATH', 'WALLS', 'WALLCHARGE', 'WALLREACT', 'COVERFIRE', 'FURNBLAST', 'DOORWAY', 'DOORBLAST', 'OPENING', 'DOORSTAY', 'HANDLE', 'DOORMANNERS', 'BREAKS', 'FURN', 'LIGHTWALL', 'GUNWALL', 'RUBBLE', 'EVICT', 'WALLSNAP', 'CLOSE', 'GEAR', 'START', 'SAMESTART', 'TAKE', 'RELOAD', 'QUICKTHROW', 'FRIENDS', 'SAMSTUN', 'AIMWEIGHT', 'AIMCOST', 'TORCH', 'DOZE', 'KITANIM', 'KIT', 'THROW_BY', 'HANDS', 'HANDWORK', 'WORDS', 'WORK', 'WAND', 'OWNCHARGE', 'BIGSLOT', 'SQUADTHROW', 'STICKY', 'AIRDUST', 'STACKROOM', 'WX_OWN', 'SNOW', 'SNOW_LOOK', 'AIR_SIM', 'LANES', 'GUNHOLD', 'QUIETFOG', 'ISSUE', 'TAKEDOWN', 'STEALTHPOSE', 'CASTOR', 'HOLDFIRE', 'MORALE', 'DARKFOE', 'DARKDOOR', 'RUNNER', 'NETQUIET', 'ATTENTION', 'PICTURE', 'POWEROUT',
  // the squad's tables the page's boot writes a key of (host/profile.ts pageSwitches), and SNEAK: a recording made on the page used to replay them at the
  // stand's values. A recording cannot START with a squad on the floor, but men who work by the squad's code can come once it runs. A file from before
  // these names carries none of them and replays on the stand's values, as it always did. tools/qa/knobs-check.ts holds the rule for the next one.
  'ORDERS', 'DOORTOOLS', 'SNEAK', 'COVER', 'STACKLINE', 'REARWATCH', 'ROOMCLEAR', 'HARD', 'TEAMTALLY', 'SPRINTDOOR', 'HAULHOME', 'AUTOPILOT', 'PLANLAY', 'SILENT', 'SNOWBOG', 'IRLIGHT', 'CUES', 'CONDITION', 'BACKKEY', 'WALLPEN', 'PEEKSIGHT', 'SQUADDEAL', 'STAYASK', 'SEENWALK', 'RESCUECHECK'];
import { GUNWALL } from './gunwall';
import { CLOSE } from './close';
import { PLAN } from './floorplan';
import { KITANIM } from './kitanim';
import { KIT, THROW_BY } from './character';
import { HANDS } from './hands';
import { WORK } from './workthings';
import { WAND } from './wand';
import { PEEKSIGHT } from './peeksight';
import { STICKY } from './stickycam';
import { OWNCHARGE } from './owncharge';
import { SQUADTHROW } from './squadthrow';
import { AUTOPILOT } from './autopilot';
import { CONDITION } from './condition';
import { PLANLAY } from './planlay';
import { START } from './startfile';
import { SAMESTART } from './samestart';
import { TAKE } from './takecheck';
import { QUIETFOG } from './quietfog';
import { TORCH } from './calmtorch';
import { BACKKEY } from './backkey';
import { FIXEDSTEP } from '../host/loop';
import { TWEEN } from '../host/tween';
import { MORALE } from './morale';
import { RUNNER } from './runner';
import { DARKDOOR } from './darkdoor';
import { DARKFOE } from './darkfoe';
import { POWEROUT } from './powerout';
import { SQUADDEAL } from './squaddeal';
import { STAYASK } from './stayask';
import { RESCUECHECK } from './rescuecheck';
import { DOZE } from './doze';
import { NETQUIET } from './netquiet';
import { ATTENTION } from './attention';
import { PICTURE } from './picture';
import { RELOAD } from './autoreload';
import { QUICKTHROW } from './quickthrow';
import { FRIENDS } from './friends';
import { SAMSTUN } from './samstun';
import { RECAP } from './deathrecap';
import { TEAMTALLY } from './teamtally';
import { AIMWEIGHT } from './aimweight';
import { SPRINTDOOR } from './sprintdoor';
import { AIMCOST } from './aimcost';
import { HANDWORK } from './handwork';
import { TAKEDOWN } from './takedown';
import { STEALTHPOSE } from './stealthpose';
import { GEAR } from './gear';
import { WORDS } from './words';
import { LOOK } from '../scene/look';
import { MUSIC } from '../audio/pieces';   // (the score's pieces switch: not a game module, no cycle)
import { LIVED } from '../scene/lived';
import { CASTOR } from './props';

/** A table's keys that are NOT knobs: data it was loaded with, or what it found at load. knobsCopy leaves them out, so putting a copy back never touches them.
 *  SLOTS (kit.ts): `on` is the rule's switch; `ok` / `why` / `table` are slots.json as read. DESTRUCTION is its one switch whole.
 *  (NOT here, on purpose: the team-start rows NIGHTBREACH.samAt / samYaw and RESCUE.samAt / samYaw / opsAt. A level with its own start writes them once per
 *  team-start object — rescue.ts / nightbreach.ts keep which object they last wrote — and the office reads them as they stand, so a run on another level must
 *  have them put back or the next office run in the same process starts at that level's coordinates. Every tool stands a fresh level up per run, so the
 *  'already written' memo never meets a put-back table; a tool that staged ONE level object twice round a knobsBack would have to write them itself.) */
export const NOT_KNOBS: Record<string, readonly string[]> = { SLOTS: ['ok', 'why', 'table'] };
/** Tables that are the VISIT's own and never a tape's: how this viewer asked to hear or see the page, with nothing in the run turning on it. A run tape carries
 *  every registry table and its player puts each back over the page's (replay/engineplay.ts) — all but these: MUSIC (audio/pieces.ts) is read at every deal of
 *  a piece, so a tape made with the pieces on would play them to a viewer who opened it with `?onetheme`, and one made under `?onetheme` would take the pieces
 *  from everybody who plays it. FIXEDSTEP and TWEEN (host/loop.ts, host/tween.ts) are how this page's frame loop steps and draws: a tape replays the updates it
 *  holds whatever stepped them, and the viewer's loop is the viewer's. */
export const VISIT_OWN: string[] = ['MUSIC', 'FIXEDSTEP', 'TWEEN'];

/** every knob table by name — made on each call (see the head: never at module load) */
export function knobRegistry(): Record<string, object> {
  const all: Record<string, object | undefined> = {
    // what a recording carries (JOURNAL_KNOBS)
    AIM, TRAINED, AI_TUNE, BODY_LIGHT, GUARD_EYE, NEEDS, WHISTLE, WET, WIND, CIV, CHAOS, RING, LAUNCHER, HE40, LAUNCHER40, FRAG, SHOTGUN, SHIELD, GLASS, GLASSFX, GLASSBREAK, GLASSPEN, SHARDS,
    TALK_TUNE, HOLD, SUPPRESSION, RIFLE_SPREAD, OVERHEAR, SCORE, BADGE, CKPT, FOG, MOVES, MV, TURN, WOUND, DOORPATH, WALLS, WALLCHARGE, CASTOR, WALLREACT, COVERFIRE, FURNBLAST, DOORWAY, DOORBLAST, OPENING,
    DOORSTAY, HANDLE, DOORMANNERS,
    // what breaks into what, by material (breakTable.ts), and how a blast treats furniture (furnblast.ts): the sim reads both, so a recording carries them
    BREAKS, FURN,
    // thrown things bog down in lying snow (snowBog.ts): the item step reads it, so a recording carries it
    SNOWBOG,
    // men kicking rubble aside (debris.ts feet): its switch and numbers — a recording carries them (the pieces a blast then throws lie where boots left them)
    RUBBLE, EVICT,
    // where a carried light is when its lens is through a wall (lighting.ts lensClear): the light estimate and the lamp's glare read that place
    LIGHTWALL,
    // the weather's dust in the rooms (airDust.ts): whether the men's eyes read the field, and how fast it moves — a sight line through a doorway reads them
    AIRDUST,
    // back to the wall, the feel pass (wallsnap.ts): the take's clock and reach, the way off, the stack with the rifle — where the player stands and when a round may leave
    WALLSNAP,
    // a raised gun comes to the low ready at a wall (gunwall.ts): its switch and distances — who fires from where reads them
    GUNWALL,
    // closer than ever (close.ts): the windows round a man, the ways in they give and the noise each makes — Sam's rows and what his hands do read them
    CLOSE, PLAN, GEAR, START, SAMESTART, TAKE, RELOAD, QUICKTHROW, SAMSTUN, RECAP, AIMWEIGHT, AIMCOST, FRIENDS, TEAMTALLY,
    // a sprint into a door has weight (sprintdoor.ts): the switch, what a shoulder through it keeps of his run, how the leaf leaves him, the boot (or the handle) at the face it opens toward — where the player is a second later reads them
    SPRINTDOOR,
    // quiet missions under the fog of war (quietfog.ts): whether a quiet mission's query is read for a rung of the fog lever — a run tape's start reads it
    QUIETFOG,
    // the dialogue pass (words.ts): which words every mouth has — a bubble's time is its length, and who is still talking gates the calm floor's small talk
    WORDS,
    // kit animations (kitanim.ts; character.ts KIT): the switch, the magazine changes' beats and the lengths of the draws — when a round may leave a gun coming up reads them
    KITANIM, KIT,
    // a throw reads its distance (character.ts THROW_BY): which swing the right arm makes — never when the can leaves it, where from or how it flies
    THROW_BY,
    // hands on the world (hands.ts): a body taken up by its beats from the end he is at, a door worked by hand with him stepped clear — what Sam's body and door rows DO reads them
    HANDS, WORK, WAND, STICKY, PEEKSIGHT,
    // the player's own charges (owncharge.ts): his card's charge rows, the door charge by hand, what a man alone carries, the squad standing off on his charge
    OWNCHARGE,
    // teammates' frags and stun canisters thrown on order (squadthrow.ts): whether the floor's menu has the rows, and the arc a frag is aimed by
    SQUADTHROW,
    // the quick key is the squad's autopilot (autopilot.ts): on a door the men wait on they go in by the entry they pick; how long its plan is drawn
    AUTOPILOT,
    // the order menu's 'wait for my word' row lays an order: nobody moves until the word's key sends the plan; a restart puts it back (planlay.ts)
    PLANLAY,
    // a calm patrol's hand torch burns only where his place is dark (calmtorch.ts): the light meter reads the torch, so who is seen where reads these
    TORCH,
    // Esc is only the pause; Tab backs out of the order menu, the Space list, a running verb, the launcher's arc (backkey.ts): what a Tab in a tick does reads this
    BACKKEY,
    // the frame loop's two (host/loop.ts, host/tween.ts — not game rules, and no recording's to set: not in JOURNAL_KNOBS, and VISIT_OWN above keeps a tape's player off them): the game in
    // whole 1/60 s ticks, and a frame between two ticks drawn at the blend of them. Here so that the two stands' difference and a probe's put-back cover them
    FIXEDSTEP, TWEEN,
    // shaken (morale.ts): what a blast does to the men it does not hurt — who ducks, who breaks, the rounds a broken man puts into the dust — reads these
    MORALE,
    // a man's condition (condition.ts): whether a blast that leaves a man standing leaves him hurt, the pace and the spread that costs him, how long
    CONDITION,
    // drops it and runs (runner.ts): who lets his weapon go and runs, where to, and when he stops counting as a living hostile — reads these
    RUNNER,
    // not in there alone (darkdoor.ts): who stops at the doorway of a dark room, how dark is dark, how long he waits for a mate and when he goes in anyway
    DARKDOOR,
    // an enemy on alert does not sit blind in the dark (darkfoe.ts): whose weapon light burns and who leaves his post read these — the meter reads the lamps
    DARKFOE,
    // the lights go out and somebody goes to put them back on (powerout.ts): which defenders walk to the breaker, when, and what their side makes of the dark read these
    POWEROUT,
    // squads from the rooms (squaddeal.ts): a level whose file names no squads is handed some cut from its rooms when its men are dealt
    SQUADDEAL,
    // squads that stay in their rooms still miss a room that goes silent (stayask.ts): the net's ask on a floor where every squad stays, and the one man who goes
    STAYASK,
    RESCUECHECK,
    // dozing in the dark (doze.ts): who sits a long dark wait out asleep in a chair, how dull his ears are and what wakes him — who hears and sees whom reads these
    DOZE,
    // the net goes quiet (netquiet.ts): what an unanswered check, a body found and a mate seen to fall add to a man's dread, the whip to a noise, the last man's spot — read these
    NETQUIET,
    // a guard's attention can be taken, and shows where it is (attention.ts): who is seen from the edge of a held eye, and how long a look lasts, read these
    ATTENTION,
    // each man's own picture of the fight (picture.ts): where he believes each enemy to be and how old that is, what he counts safe, the rules that ask it
    PICTURE,
    // hands that do the work (handwork.ts): the keypad's, the breaker's and the drive's clocks and Sam's plant at them read its switch
    HANDWORK,
    TAKEDOWN,
    STEALTHPOSE,
    // the default look (scene/look.ts): which FILE a level with a second file is loaded from, and the men's kit — look only (no run differs by it), here so a stand's dump and the page's __knobs say which look it was
    LOOK,
    // more music than the one theme (audio/pieces.ts): whether the score deals its newer pieces, and the two times the deal reads — the listener's ears only (no rule
    // reads it, a replay holds no sound), here so a stand's dump and the page's __knobs say which score it was
    MUSIC,
    // lived-in rooms (scene/lived.ts): whether a level's lived things — the furniture that makes a room its own place — are loaded; read when a level loads
    LIVED,
    // the squad's feel (teamfeel.ts keeps rows of these per machine; FOG, FRAG and DOORMANNERS are above)
    FLASH, PACE, LIGHTS, NVG, IR, IRLIGHT, WALLPEN, LASER, DOORTOOLS, ROOMFIGHT, ORDERS, COVER, ROOMFIT, ENTRY, REAR, SILENT, PAIR,
    // the scenario's and the defenders' tables (a play-through's --set reaches them)
    RESCUE, DIGIN, HAULHOME, PRESSURE, LANES, GUNHOLD, HARD, HARD_AT, DRILLED, SQUADS, DRILL_AT, CUES, BUDDY, WX_SIM, WX_OWN, SNOW, SNOW_LOOK, AIR_SIM, LASTSTAND, CLEARLINE, STACKROOM, REARWATCH, STACKLINE,
    // the team's own rules that no other list named (found by tools/qa/knobs-check.ts), and the two scenarios' own tables
    SNEAK, PAIRUP, SPOTTED, NIGHTBREACH, ROOMCLEAR, LESSON, SNATCH, DEFUSE,
    // a room clear against a clock (par.ts): reads only — off = the level's room clear alone
    PAR, ISSUE,
    // how a run went, said at its end (verdict.ts): reads only — off = no verdict, the end card as it was
    VERDICT,
    // a squad nobody has found sneaks when Sam sneaks (unseen.ts): who is low, how fast, how loud, and whose round is held
    UNSEEN,
    // an ordered walk keeps off lit floor that a room nobody has cleared can see (seenwalk.ts): the bar for lit, the price, where the eyes stand
    SEENWALK,
    // a squad nobody has found never fires first (holdfire.ts): whose round is held until the player's shot or his order starts the fight
    HOLDFIRE,
    // switches that stand alone
    SLOTS, DESTRUCTION,
    // the big slot (kit.ts BIGSLOT, bigkit.ts): the switch — one big thing a man, the shotgun kit and not a gun, the hammer — and the hammer's and the kit shotgun's beats: what a locked door costs reads them
    BIGSLOT,
    // the cut-pieces switch (scene/cut.ts cutConfig: `on` read at boot, `swap` = two sets of ray programs). A recording carries it in its env (env.cutBoxes), not here
    CUT: cutConfig,
  };
  const out: Record<string, object> = {}; for (const [k, T] of Object.entries(all)) if (T && typeof T === 'object') out[k] = T; return out;
}

/** the registry's tables under `names` (all of them when absent), in that order; a name with no table is passed over */
export function knobsNamed(names?: readonly string[]): Record<string, object> {
  const R = knobRegistry(); if (!names) return R;
  const out: Record<string, object> = {}; for (const n of names) if (R[n]) out[n] = R[n]; return out;
}

const plain = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
/** plain objects and arrays copied all the way down (`skip`: top-level keys left out); everything else (a number, Infinity, undefined, a function, a Map) as it is */
const copyOf = (v: unknown, skip?: readonly string[]): unknown => Array.isArray(v) ? v.map(x => copyOf(x)) : plain(v) ? Object.fromEntries(Object.keys(v).filter(k => !skip?.includes(k)).map(k => [k, copyOf(v[k])])) : v;
/** the tables a tape's player may write: the registry without VISIT_OWN */
export function knobsPlayed(): Record<string, object> { const R = knobRegistry(); for (const n of VISIT_OWN) delete R[n]; return R; }
/** a deep copy of the tables under `names` (all when absent), each without its NOT_KNOBS keys — for putting back (knobsBack), not for a file: a recording takes
 *  its own JSON copy (journal.ts knobsSnapshot) */
export function knobsCopy(names?: readonly string[]): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [k, T] of Object.entries(knobsNamed(names))) out[k] = copyOf(T, NOT_KNOBS[k]) as Record<string, unknown>;
  return out;
}
/** the live value `a` made equal to the copy `b`, IN PLACE where both are plain objects or both arrays (whoever holds the live object or array still holds
 *  it); otherwise a fresh copy of `b` is what goes in its place */
function backValue(a: unknown, b: unknown): unknown {
  if (plain(a) && plain(b)) { putBack(a, b); return a; }
  if (Array.isArray(a) && Array.isArray(b)) { a.length = b.length; for (let i = 0; i < b.length; i++) a[i] = backValue(a[i], b[i]); return a; }
  return copyOf(b);
}
/** dst made equal to src IN PLACE: a key added since is deleted, every value put back (backValue), `skip` keys left alone */
function putBack(dst: Record<string, unknown>, src: Record<string, unknown>, skip?: readonly string[]): void {
  for (const k of Object.keys(dst)) if (!Object.hasOwn(src, k) && !skip?.includes(k)) delete dst[k];
  for (const k of Object.keys(src)) { const v = backValue(dst[k], src[k]); if (dst[k] !== v || !Object.hasOwn(dst, k)) dst[k] = v; }
}
/** a knobsCopy put back over the live tables: whatever a probe or a play-through changed, added or dropped since the copy was taken is undone (a table the copy
 *  does not hold is left alone) */
export function knobsBack(copy: Record<string, Record<string, unknown>>): void {
  for (const [k, T] of Object.entries(knobRegistry())) { const s = copy[k]; if (s) putBack(T as Record<string, unknown>, s, NOT_KNOBS[k]); }
}

/** dst ← src over the keys dst already has, type for type (an object recursed into, a number / boolean / string / array copied): a knob renamed since the recording is let be */
export function assignDeep(dst: Record<string, unknown>, src: Record<string, unknown>): void {
  for (const k of Object.keys(src)) {
    if (!(k in dst)) continue; const a = dst[k], b = src[k];
    if (a !== null && typeof a === 'object' && !Array.isArray(a) && b !== null && typeof b === 'object' && !Array.isArray(b)) assignDeep(a as Record<string, unknown>, b as Record<string, unknown>);
    else if (typeof a === typeof b || a === null) dst[k] = b !== null && typeof b === 'object' ? JSON.parse(JSON.stringify(b)) : b;
  }
}
