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
import { WALLCHARGE, WALLSHOT, WALLKILL } from './wallcharge';
import { WALLREACT } from './wallreact';
import { COVERFIRE } from './coverfire';
import { RING } from './launcher';
import { HE40 } from './he40';
import { SHOTGUN } from './shotgun';
import { FRAG } from './frag';
import { LAUNCHER, LAUNCHER40 } from './weapons';
import { GLASS, GLASSFX } from './glass';
import { GLASSBREAK, GLASSREAL } from './glassbreak';
import { GLASSPEN } from './glasspen';
import { SHARDS } from './shards';
import { TALK_TUNE } from './dialogue';
import { HOLD, MOVES, MV, TURN, HARDBREATH } from './character';
import { SUPPRESSION } from './suppression';
import { RIFLE_SPREAD, FOOTFALL, TWOGEARS } from './player';
import { OVERHEAR } from './devices';
import { SCORE, BADGE } from './chronicle';
import { WOUND } from './wounds';
import { DOORPATH } from './doorpath';
import { FOG } from './fogofwar';
import { DOORWAY, DOORSTAY, DOORTHROW } from './doors';
import { DOORBLAST, DOORSHOT } from './doorblast';
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
import { SLOTS, ISSUE, BIGSLOT, KITDEAL } from './kit';
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
export const JOURNAL_KNOBS: readonly string[] = ['AIM', 'TRAINED', 'AI_TUNE', 'BODY_LIGHT', 'GUARD_EYE', 'NEEDS', 'WHISTLE', 'WET', 'WIND', 'CIV', 'CHAOS', 'RING', 'LAUNCHER', 'HE40', 'LAUNCHER40', 'FRAG', 'SHOTGUN', 'GLASS', 'GLASSFX', 'GLASSBREAK', 'GLASSPEN', 'SHARDS', 'TALK_TUNE', 'HOLD', 'SUPPRESSION', 'RIFLE_SPREAD', 'OVERHEAR', 'SCORE', 'BADGE', 'CKPT', 'FOG', 'MOVES', 'MV', 'TURN', 'WOUND', 'DOORPATH', 'WALLS', 'WALLCHARGE', 'WALLREACT', 'COVERFIRE', 'FURNBLAST', 'DOORWAY', 'DOORBLAST', 'OPENING', 'DOORSTAY', 'HANDLE', 'DOORMANNERS', 'BREAKS', 'FURN', 'LIGHTWALL', 'GUNWALL', 'RUBBLE', 'EVICT', 'WALLSNAP', 'CLOSE', 'GEAR', 'START', 'SAMESTART', 'TAKE', 'RELOAD', 'QUICKTHROW', 'FRIENDS', 'FRIENDLYFIRE', 'FIRELINE', 'LIGHTSWITCH', 'SAMSTUN', 'AIMWEIGHT', 'AIMCOST', 'TORCH', 'DOZE', 'KITANIM', 'KIT', 'THROW_BY', 'HANDS', 'HANDWORK', 'WORDS', 'WORK', 'WAND', 'OWNCHARGE', 'BIGSLOT', 'KITDEAL', 'SQUADTHROW', 'STICKY', 'AIRDUST', 'STACKROOM', 'WX_OWN', 'SNOW', 'SNOW_LOOK', 'AIR_SIM', 'LANES', 'GUNHOLD', 'QUIETFOG', 'ISSUE', 'TAKEDOWN', 'STEALTHPOSE', 'FOOTFALL', 'TWOGEARS', 'CASTOR', 'HOLDFIRE', 'MORALE', 'DARKFOE', 'DARKDOOR', 'RUNNER', 'NETQUIET', 'ATTENTION', 'PICTURE', 'POWEROUT',
  // the squad's tables the page's boot writes a key of (host/profile.ts pageSwitches), and SNEAK: a recording made on the page used to replay them at the
  // stand's values. A recording cannot START with a squad on the floor, but men who work by the squad's code can come once it runs. A file from before
  // these names carries none of them and replays on the stand's values, as it always did. tools/qa/knobs-check.ts holds the rule for the next one.
  'ORDERS', 'DOORTOOLS', 'SNEAK', 'COVER', 'STACKLINE', 'REARWATCH', 'ROOMCLEAR', 'HARD', 'TEAMTALLY', 'SPRINTDOOR', 'HAULHOME', 'AUTOPILOT', 'PLANLAY', 'CMDRING', 'SILENT', 'SNOWBOG', 'IRLIGHT', 'CUES', 'CONDITION', 'INHAND', 'GUNHAND', 'PACKSIDE', 'BACKKEY', 'WALLSHOT', 'WALLKILL', 'HARDBREATH', 'WALLPEN', 'PEEKSIGHT', 'SQUADDEAL', 'STAYASK', 'SEENWALK', 'RESCUECHECK', 'UNDERFOOT', 'RESCUEEND', 'RESCUEFLUSH', 'SNATCHOUT', 'KITLOAD', 'SQUAD40',
  // the game's own maths (math/exact.ts): which sin and cos the whole simulation computes on — a recording made on one replays on that one
  'EXACT',
  // the senses on the CPU (sense.ts): a recording made with it on replays with it on — its sensor stream is the game's own answers
  'SENSE',
  // a record from anyone (cmd.ts): a recording made with the check on replays with it on
  'CMDCHECK', 'GUNSLOTS', 'GUNLOOK', 'GUNROLES', 'KITTREE',
  // the response team as level design (qrf.ts RESPONSE): a recording made with the level's own team replays with it
  'RESPONSE',
  // gunfire splinters a wooden door leaf apart (doorblast.ts DOORSHOT): a recording made with it on replays its doors going, one from before hangs them
  'DOORSHOT',
  // a door opened into a man moves and startles him, one slammed or booted into him throws him (doors.ts DOORTHROW): a recording made with it on replays its men moved, one from before has every leaf stop against them
  'DOORTHROW',
  // enemies startle when they first see you (startle.ts): a recording made with it on replays its men's beat before the gun, and who ran; one from before has every man go for his gun at once
  'STARTLE',
  // a mission row's own hour and weather (rowset.ts): a recording made on such a row with it on was started in them, one from before at its query's
  'ROWSET',
  // a man a level's script told to have a smoke (smokebreak.ts): the lit end's light is the meter's too, so a recording made with it on carries it
  'SMOKEBREAK',
  // a teammate shows why he is not acting (showwhy.ts): a recording made with it on replays its men's signals and lines; one from before has nobody show anything
  'SHOWWHY',
  // a man flinches when fire comes close (flinch.ts): a recording made with it on replays its men's ducks and the green man who broke under fire; one from before has nobody duck but on the suppression model's own edge
  'FLINCH',
  // a parked vehicle's lamps are light targets (carlamps.ts CARLAMPS): a recording made with it on has them on its floor, one from before has none
  'CARLAMPS',
  // a restart gives a clean level (cleanrestart.ts CLEANRESTART): a recording made with it on replays its restarts clean, one from before as they were
  'CLEANRESTART',
  // the saves roll and one is kept in memory with a team on the floor (savestate.ts SAVETIMELINE): a recording from before it has no such save to go back to
  'SAVETIMELINE',
  // empty hands are a slot (handslot.ts HANDSLOT): a recording made with it on replays its key as the slot, one from before reads no such key
  'HANDSLOT',
  // his own actions are a ring that stays (handring.ts HANDRING): a recording made with it on replays its presses as that ring's, one from before as the list's
  'HANDRING',
  // a can in the wind-up goes back on the belt when another beat begins (throwback.ts THROWBACK): a recording made with it on replays those cans kept, one from before as thrown late
  'THROWBACK',
  // the camera frames things itself once its key is tapped twice (host/autocam.ts AUTOCAM): the seat's view rides every record, so a recording replays the view it was made with
  // either way — the name is here so that a file from before the key puts the switch off for the hand that takes over when it ends
  'AUTOCAM',
  // his own charge goes off from his own actions, not the squad's key (ownblow.ts OWNBLOW): a recording made with it on replays its interaction-key row as the blast, one from before the squad's key as it was
  'OWNBLOW',
  // the gun is put away for a two-handed job (workstow.ts WORKSTOW): a recording made with it on replays a charge's longer clock and the draw after it, one from before the gun in the hand as it was
  'WORKSTOW',
  // the squad reaches you and the quick key says why (squadnet.ts SQUADNET): a recording made with it on replays the reason a man answers with and the honest room call, one from before the lines as they were
  'SQUADNET',
  // teammates are slower than the player and run only for a reason (teampace.ts TEAMPACE): a recording made with it on replays its team at those paces, one from before under the old cap
  'TEAMPACE',
  // teammates falling in never shove the player (noshove.ts NOSHOVE): a recording made with it on replays its file going round him, one from before shouldering him aside
  'NOSHOVE',
  // a tutorial mission's frame (rails.ts RAILS): a recording made with it on replays its locked keys dropped and its spared teammates up again, one from before as a plain lesson
  'RAILS',
  // an alerted man does not wait at a shut door (doorforce.ts DOORFORCE): a recording made with it on replays its defenders firing through a leaf and booting it in, one from before has them wait or use the handle
  'DOORFORCE',
  // the slot in hand pressed again opens its setup (slotsetup.ts SLOTSETUP): a recording made with it on replays its second press of a gun's digit as the setup, one from before as the launcher's next load
  'SLOTSETUP',
  // glass as buildings have it (glassbreak.ts GLASSREAL): a recording made with it on replays its toughened sheets dropping at once and its panes typed by where they sit, one from before with the wave and the wall's typing
  'GLASSREAL',
  // a mission that leans loud is not graded as a sneak (verdict.ts VERDICT.loudCard): the two lines the mission says at its end are worded by it, so a recording
  // made with it on replays them without the grade, and one from before the key (or the table) with it
  'VERDICT', 'IR', 'LIGHTS', 'PAIR', 'ROOMFIGHT'];
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
import { GUNSLOTS } from './gunslots';
import { GUNLOOK } from './gunlook';
import { GUNROLES } from './gunroles';
import { KITTREE } from './kittree';
import { SQUADTHROW } from './squadthrow';
import { SQUAD40 } from './squad40';
import { AUTOPILOT } from './autopilot';
import { CONDITION } from './condition';
import { INHAND } from './inhand';
import { GUNHAND } from './gunhand';
import { PACKSIDE } from './packside';
import { PLANLAY } from './planlay';
import { CMDRING } from './cmdring';
import { START } from './startfile';
import { SAMESTART } from './samestart';
import { TAKE } from './takecheck';
import { QUIETFOG } from './quietfog';
import { TORCH } from './calmtorch';
import { BACKKEY } from './backkey';
import { FIXEDSTEP } from '../host/loop';
import { AUTOCAM } from '../host/autocam';
import { TWEEN } from '../host/tween';
import { MORALE } from './morale';
import { RUNNER } from './runner';
import { STARTLE } from './startle';
import { ROWSET } from './rowset';
import { SMOKEBREAK } from './smokebreak';
import { SHOWWHY } from './showwhy';
import { FLINCH } from './flinch';
import { DARKDOOR } from './darkdoor';
import { DARKFOE } from './darkfoe';
import { POWEROUT } from './powerout';
import { SQUADDEAL } from './squaddeal';
import { STAYASK } from './stayask';
import { KITLOAD } from './kitload';
import { RESCUECHECK } from './rescuecheck';
import { RESCUEEND } from './rescueend';
import { SNATCHOUT } from './snatchout';
import { RESCUEFLUSH } from './rescueflush';
import { EXACT } from '../math/exact';
import { SENSE } from './sense';
import { CMDCHECK } from './cmd';
import { DOZE } from './doze';
import { NETQUIET } from './netquiet';
import { ATTENTION } from './attention';
import { PICTURE } from './picture';
import { RESPONSE } from './qrf';
import { RELOAD } from './autoreload';
import { QUICKTHROW } from './quickthrow';
import { FRIENDS } from './friends';
import { FRIENDLYFIRE } from './friendlyfire';
import { LIGHTSWITCH } from './lightswitch';
import { CARLAMPS } from './carlamps';
import { CLEANRESTART } from './cleanrestart';
import { FIRELINE } from './fireline';
import { SAVETIMELINE } from './savestate';
import { HANDSLOT } from './handslot';
import { HANDRING } from './handring';
import { THROWBACK } from './throwback';
import { OWNBLOW } from './ownblow';
import { SAMSTUN } from './samstun';
import { RECAP } from './deathrecap';
import { TEAMTALLY } from './teamtally';
import { AIMWEIGHT } from './aimweight';
import { SPRINTDOOR } from './sprintdoor';
import { TEAMPACE } from './teampace';
import { NOSHOVE } from './noshove';
import { RAILS } from './rails';
import { DOORFORCE } from './doorforce';
import { SLOTSETUP } from './slotsetup';
import { AIMCOST } from './aimcost';
import { HANDWORK } from './handwork';
import { WORKSTOW } from './workstow';
import { SQUADNET } from './squadnet';
import { TAKEDOWN } from './takedown';
import { STEALTHPOSE } from './stealthpose';
import { GEAR } from './gear';
import { WORDS } from './words';
import { LOOK } from '../scene/look';
import { MUSIC } from '../audio/pieces';   // (the score's pieces switch: not a game module, no cycle)
import { LIVED } from '../scene/lived';
import { UNDERFOOT } from '../scene/collision';   // (a scene table: no cycle)
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
    AIM, TRAINED, AI_TUNE, BODY_LIGHT, GUARD_EYE, NEEDS, WHISTLE, WET, WIND, CIV, CHAOS, RING, LAUNCHER, HE40, LAUNCHER40, FRAG, SHOTGUN, GLASS, GLASSFX, GLASSBREAK, GLASSPEN, SHARDS,
    TALK_TUNE, HOLD, SUPPRESSION, RIFLE_SPREAD, FOOTFALL, TWOGEARS, OVERHEAR, SCORE, BADGE, CKPT, FOG, MOVES, MV, TURN, WOUND, DOORPATH, WALLS, WALLCHARGE, WALLSHOT, WALLKILL, HARDBREATH, CASTOR, WALLREACT, COVERFIRE, FURNBLAST, DOORWAY, DOORBLAST, DOORSHOT, DOORTHROW, OPENING,
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
    // friendly fire (friendlyfire.ts): whether a round of Sam's side finds the men of Sam's side, and the cone a teammate keeps his friends out of — every round fired reads them
    FRIENDLYFIRE,
    // a room's wall switch (lightswitch.ts): the plates, Sam's row, a defender who puts a room back
    LIGHTSWITCH,
    // a parked vehicle's lamps can be shot out (carlamps.ts): the switch, the broken lens's paint, how a lamp box is told from the level
    CARLAMPS,
    CLEANRESTART,
    // off the line of his fire (fireline.ts): whether a teammate on an order waits short of the lane the player is firing down, how long, and the way round — where every ordered man walks reads them
    FIRELINE,
    SAVETIMELINE,
    // empty hands are a slot (handslot.ts): the switch and the code the game asks for it by
    HANDSLOT,
    // his own actions are a ring that stays (handring.ts): the switch and the press that opens it
    HANDRING,
    // a can in the wind-up goes back on the belt when another beat begins (throwback.ts): the switch
    THROWBACK,
    OWNBLOW,
    // a sprint into a door has weight (sprintdoor.ts): the switch, what a shoulder through it keeps of his run, how the leaf leaves him, the boot (or the handle) at the face it opens toward — where the player is a second later reads them
    SPRINTDOOR,
    // teammates are slower than the player and run only for a reason (teampace.ts): the switch, the walk's share of the player's, a follower's closing pace and his run, the reasons — where every teammate is a second later reads them
    TEAMPACE,
    // teammates falling in never shove the player (noshove.ts): the switch, its two halves, the squeeze past, the ring a man keeps and his step back out — where every follower and the player are a second later reads them
    NOSHOVE,
    // a tutorial mission's frame (rails.ts): the switch, the sky seat's pan and how long a spared teammate is on his knee — what the tick's input and a teammate's fall read
    RAILS,
    // an alerted man does not wait at a shut door (doorforce.ts): the switch, its two halves, how sure he must be and how long before the boot — when a defender's rounds go through a leaf and when it is kicked in reads them
    DOORFORCE,
    // the slot in hand pressed again opens its setup (slotsetup.ts): the switch, how long it stays up unused, and whether a pick shuts it — what a digit pressed with a gun in the hands does reads them
    SLOTSETUP,
    // glass as buildings have it (glassbreak.ts): toughened glass drops at once, and which glass a pane is comes from where it sits — which panes a round opens, and when
    GLASSREAL,
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
    // a primary and a secondary for every man (gunslots.ts): the card's two gun rows, a teammate's second gun, and the beats of his going to it when the primary runs dry
    GUNSLOTS,
    // each gun its own look, sound and reload (gunlook.ts): which model, voice and flame a row is, where its muzzle is, how it is fed
    GUNLOOK,
    // a gun used for what it is for (gunroles.ts): the defenders' deal off the weapons table, and the stack, the door, the cover's deal and the room fight's trigger by a man's gun
    GUNROLES,
    // the gear screen as a tree (kittree.ts): one list of rows for every man — each gun's own suppressor, your light and goggles, the sponge rounds a card carries and a quiet mission hands out
    KITTREE,
    // teammates' frags and stun canisters thrown on order (squadthrow.ts): whether the floor's menu has the rows, and the arc a frag is aimed by
    SQUADTHROW,
    // a teammate's 40 mm grenade fired on order (squad40.ts): whether the throws' page has the row, and what counts as a shot
    SQUAD40,
    // the quick key is the squad's autopilot (autopilot.ts): on a door the men wait on they go in by the entry they pick; how long its plan is drawn
    AUTOPILOT,
    // the order menu's 'wait for my word' row lays an order: nobody moves until the word's key sends the plan; a restart puts it back (planlay.ts)
    PLANLAY,
    // the order menu as a ring on one key — a prototype, off unless asked for (cmdring.ts)
    CMDRING,
    // a calm patrol's hand torch burns only where his place is dark (calmtorch.ts): the light meter reads the torch, so who is seen where reads these
    TORCH,
    // Esc is only the pause; Tab backs out of the order menu, the Space list, a running verb, the launcher's arc (backkey.ts): what a Tab in a tick does reads this
    BACKKEY,
    // the frame loop's two (host/loop.ts, host/tween.ts — not game rules, and no recording's to set: not in JOURNAL_KNOBS, and VISIT_OWN above keeps a tape's player off them): the game in
    // whole 1/60 s ticks, and a frame between two ticks drawn at the blend of them. Here so that the two stands' difference and a probe's put-back cover them
    FIXEDSTEP, TWEEN,
    // the camera running itself (host/autocam.ts): the switch, what it frames and by how much, when it may turn
    AUTOCAM,
    // shaken (morale.ts): what a blast does to the men it does not hurt — who ducks, who breaks, the rounds a broken man puts into the dust — reads these
    MORALE,
    // a man's condition (condition.ts): whether a blast that leaves a man standing leaves him hurt, the pace and the spread that costs him, how long
    CONDITION, INHAND, PACKSIDE,
    // the gun hand (gunhand.ts): which hand comes up for a whistle, which throws, and how a long gun reloads — these move the pose the game reads
    GUNHAND,
    // drops it and runs (runner.ts): who lets his weapon go and runs, where to, and when he stops counting as a living hostile — reads these
    RUNNER,
    // enemies startle when they first see you (startle.ts): how long a calm man's start holds his gun down, and who runs after it — reads these
    STARTLE,
    // a mission row's own hour and weather (rowset.ts): the one switch
    ROWSET,
    // a man told to have a smoke (smokebreak.ts): the switch, his clock, the lights and the smoke's numbers
    SMOKEBREAK,
    // a teammate shows why he is not acting (showwhy.ts): the switch, each case's own, and the clocks of the wave, the squeeze, the fist and the lines
    SHOWWHY,
    // a man flinches when fire comes close (flinch.ts): how close a round ducks him, how much by training, and how long under fire breaks a green man alone — reads these
    FLINCH,
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
    // lighter kit moves faster and hides better (kitload.ts): the switch, what each thing on a card takes off the two scores, and what a point of each is worth in pace, notice and footfall
    KITLOAD,
    RESCUEEND, RESCUEFLUSH,
    // a snatch ends with the man in the team's van, the squad covering the walk out by bounds (snatchout.ts)
    SNATCHOUT,
    // the game's own maths (math/exact.ts EXACT.on: a setter — writing it puts the functions in Math's place or takes them out)
    EXACT,
    // the senses on the CPU (sense.ts SENSE.cpu, and its smoke model's numbers)
    SENSE,
    // a record from anyone (cmd.ts checkCmd: the switch and its bounds)
    CMDCHECK,
    // dozing in the dark (doze.ts): who sits a long dark wait out asleep in a chair, how dull his ears are and what wakes him — who hears and sees whom reads these
    DOZE,
    // the net goes quiet (netquiet.ts): what an unanswered check, a body found and a mate seen to fall add to a man's dread, the whip to a noise, the last man's spot — read these
    NETQUIET,
    // a guard's attention can be taken, and shows where it is (attention.ts): who is seen from the edge of a held eye, and how long a look lasts, read these
    ATTENTION,
    // each man's own picture of the fight (picture.ts): where he believes each enemy to be and how old that is, what he counts safe, the rules that ask it
    PICTURE,
    // the response team is the level's own (qrf.ts): which levels have one, what a run is dealt, what the team goes on — who comes, where and when read these
    RESPONSE,
    // hands that do the work (handwork.ts): the keypad's, the breaker's and the drive's clocks and Sam's plant at them read its switch
    HANDWORK,
    // the gun is put away for a two-handed job (workstow.ts): the switch, a teammate's beats down and up
    WORKSTOW,
    // the squad reaches you and the quick key says why (squadnet.ts): the three switches, where a far line is drawn, its click and a man down's
    SQUADNET,
    TAKEDOWN,
    STEALTHPOSE,
    // the default look (scene/look.ts): which FILE a level with a second file is loaded from, and the men's kit — look only (no run differs by it), here so a stand's dump and the page's __knobs say which look it was
    LOOK,
    // more music than the one theme (audio/pieces.ts): whether the score deals its newer pieces, and the two times the deal reads — the listener's ears only (no rule
    // reads it, a replay holds no sound), here so a stand's dump and the page's __knobs say which score it was
    MUSIC,
    // lived-in rooms (scene/lived.ts): whether a level's lived things — the furniture that makes a room its own place — are loaded; read when a level loads
    LIVED,
    // what the walk grid calls floor, feet cross (scene/collision.ts): a walker's circle test begins where the grid's bake begins
    UNDERFOOT,
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
    // the squad's kit dealt over the men who come (kit.ts KITDEAL): with three or four teammates the issued and the named kits are shared out, nobody comes with empty pouches; the squad's count is the same
    KITDEAL,
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
