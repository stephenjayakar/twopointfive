// standGame — THE ONE STAND-UP: the level into the host's world + light set, the mannequin, `new Game(host, level, ch, smoke)`, the harness's
// three settings when asked, the follow camera on the spawn. src/main.ts (the browser), tools/qa/headless.ts (the QA harness), tools/qa/replay.ts and the native entry all
// come through here, so the ORDER in which the level is added and the Game constructed — the Math.random draws of the guards' construction dice among it — is one order.
// Host-neutral: no DOM, no window; every import below is used inside a function only (src/game/'s import cycle: nothing here runs a game import at module load).
import { OPENING } from '../game/opening';
import type { HostApi } from './api';
import type { Level } from '../scene/level';
import type { GltfCharacter } from '../anim/gltf';
import type { SmokeSystemLike } from '../smoke/types';
import type { GameAudioLike } from '../game/audio_iface';
import { buildLevel } from '../scene/level';
import { UNDERFOOT } from '../scene/collision';
import { lightFromDef } from '../render/lights';
import { loadGltfCharacter } from '../anim/gltf';
import { Game } from '../game/game';
import { memoryStore } from '../game/savestate';
import { AIM, SNAP_PX } from '../game/aim';
import { SILENT } from '../game/silent';
import { LIGHTWALL } from '../game/lighting';
import { IRLIGHT } from '../game/irlight';
import { IR } from '../game/irlaser';
import { AIRDUST } from '../game/airDust';
import { WALLSNAP, LEAN_GUN_M } from '../game/wallsnap';
import { HANDSLOT } from '../game/handslot';
import { HANDRING } from '../game/handring';
import { THROWBACK } from '../game/throwback';
import { OWNBLOW } from '../game/ownblow';
import { WALLCHARGE, WALLSHOT, WALLKILL } from '../game/wallcharge';
import { CHAOS } from '../game/destruction';
import { WALLREACT } from '../game/wallreact';
import { CASTOR } from '../game/props';
import { DOORTOOLS } from '../game/doortools';
import { ORDERS, ROUND_CAP } from '../game/orders';
import { PAIR } from '../game/pairorders';
import { ROOMFIGHT } from '../game/roomfight';
import { COVER } from '../game/cover';
import { SNEAK } from '../game/sneak';
import { FURN } from '../game/furnblast';
import { SNOWBOG } from '../game/snowBog';
import { WX_OWN, SNOW, SNOW_LOOK } from '../game/weatherKinds';
import { AIR_SIM } from '../game/airSim';
import { GUNWALL } from '../game/gunwall';
import { REARWATCH } from '../game/rearwatch';
import { STACKLINE } from '../game/stackline';
import { LANES } from '../game/lanes';
import { HAULHOME } from '../game/digin';
import { HARD } from '../game/difficulty';
import { GUNHOLD } from '../game/gunhold';
import { CLOSE } from '../game/close';
import { FOOTFALL } from '../game/player';
import { KITANIM } from '../game/kitanim';
import { HANDS } from '../game/hands';
import { WORK } from '../game/workthings';
import { WAND } from '../game/wand';
import { PEEKSIGHT } from '../game/peeksight';
import { BIGSLOT, KITDEAL, ISSUE } from '../game/kit';
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
import { CMDRING } from '../game/cmdring';
import { STACKROOM } from '../game/stackroom';
import { HANDLE } from '../game/handleside';
import { HANDWORK } from '../game/handwork';
import { TAKEDOWN } from '../game/takedown';
import { STEALTHPOSE } from '../game/stealthpose';
import { GEAR } from '../game/gear';
import { GUARD_EYE, LIGHTS } from '../game/guards';
import { WORDS } from '../game/words';
import { UNSEEN } from '../game/unseen';
import { SEENWALK } from '../game/seenwalk';
import { HOLDFIRE } from '../game/holdfire';
import { FOG, FOG_DESAT_WAS, FOG_EDGE_ON, FOG_FLAT_ON, FOG_LIT_ON } from '../game/fogofwar';
import { START } from '../game/startfile';
import { SAMESTART } from '../game/samestart';
import { TAKE } from '../game/takecheck';
import { QUIETFOG } from '../game/quietfog';
import { TORCH } from '../game/calmtorch';
import { BACKKEY } from '../game/backkey';
import { FIXEDSTEP } from './loop';
import { TWEEN } from './tween';
import { MORALE } from '../game/morale';
import { RUNNER } from '../game/runner';
import { STARTLE } from '../game/startle';
import { ROWSET } from '../game/rowset';
import { SMOKEBREAK } from '../game/smokebreak';
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
import { NETQUIET } from '../game/netquiet';
import { ATTENTION } from '../game/attention';
import { PICTURE } from '../game/picture';
import { RESPONSE } from '../game/qrf';
import { RELOAD } from '../game/autoreload';
import { SAMSTUN } from '../game/samstun';
import { TEAMTALLY } from '../game/teamtally';
import { AIMWEIGHT } from '../game/aimweight';
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
import { hostAfterPutBack } from './putback';
import { kitSoloStand } from '../game/kit';
import { glassPenHarness } from '../game/glasspen';
import { glassFxForced, GLASS } from '../game/glass';
import { WALLPEN } from '../game/wallpen';
import { DOORSHOT } from '../game/doorblast';
import { FRAG } from '../game/frag';
import { HOUR, applyHour } from '../game/hours';
import { DOORPATH } from '../game/doorpath';
import { HOLD, MOVES, TURN, TURN_FEEL, THROW_BY, HARDBREATH } from '../game/character';
import { WOUND } from '../game/wounds';
import { DOORSTAY, DOORWAY, DOORTHROW } from '../game/doors';
import { FollowCamera } from '../game/camera';
import { pinned } from './profile';
import { newDice, useDice } from '../math/dice';
import { v3 } from '../math/vec';

export interface StandOpts {
  /** the level; absent = buildLevel() (the bundled office) */
  level?: Level;
  /** the mannequin, already loaded; absent = loadGltfCharacter(gltfUrl) */
  ch?: GltfCharacter;
  /** where the glTF is when `ch` is absent (the page: new URL('assets/ual/…', document.baseURI).href; bun: file://<root>/public/assets/ual/…) */
  gltfUrl?: string;
  /** the smoke solver the Game emits into; absent = nullSmoke() (emit / push / clearAll dropped, inSmokeDomain false — the harness's) */
  smoke?: SmokeSystemLike;
  /** the audio the Game plays through; absent = the Game's own null object (main.ts hands the AudioEngine over once the pipelines are in) */
  audio?: GameAudioLike;
  /** add the level's boxes to host.world and its lights to host.lights before the Game is built (default true; main.ts populates earlier by populateHost — the smoke solver is
   *  constructed between — and passes false) */
  populate?: boolean;
  /** the QA HARNESS's stand (tools/qa/headless.ts) — FROZEN unless the run says TPS_PROFILE=shipped (src/host/profile.ts: under 'shipped' none of the lines below that
   *  hold a newer rule off runs, and the game stands as the page's does): chaos 0 (the game byte for byte as it was before the destruction lane — what every frozen digest was recorded against),
   *  the autosave slots in a Map (no localStorage in bun), the level script strict (a throwing beat fails the probe). Off = the page's game */
  harness?: boolean;
  /** THE GAME'S OWN DIE (src/math/dice.ts): a number = the Game owns a die seeded with it, from its construction draws on — the page always passes one (?seed=N, else a
   *  fresh one); absent / null = the game draws Math.random as it always did (the harness: its tools seed Math.random, and every frozen digest was rolled that way —
   *  `TPS_SEED=n` in front of a tool, or standUp({ seed }), gives a harness game its own) */
  seed?: number | null;
}

export interface Stood {
  game: Game; level: Level; ch: GltfCharacter; smoke: SmokeSystemLike;
  /** the follow camera, on the level's player spawn (aspect / rebuild are the caller's — the browser sets aspect per render, the harness once) */
  cam: FollowCamera;
}

/** the harness's smoke stand-in: everything accepted and dropped, no smoke anywhere (`params` may be set on it — a replayed recording's canister row) */
export function nullSmoke(): SmokeSystemLike & { params?: Record<string, unknown> } {
  return { emit() { /* dropped */ }, push() { /* dropped */ }, inSmokeDomain() { return false; }, clearAll() { /* nothing */ }, budget() { return 64; } };
}

/** the level's statics into the host's box world and its lights into the light set — the two loops main.ts and headless.ts ran before `new Game` */
export function populateHost(host: HostApi, level: Level): void {
  for (const b of level.boxes) host.world.addStatic(b);
  for (const ld of level.lights) host.lights.add(lightFromDef(ld));
}

/** THE GAME'S OWN MATHS (src/math/exact.ts) on the harness: off on the frozen stand, so every frozen digest, tally and fixture runs on the functions it was recorded
 *  on (TPS_EXACT=1 raises it); the shipped stand keeps the page's (on), and TPS_EXACT=0 there is the page's ?noexact. Written BEFORE anything is built — a level's
 *  boxes and a Game's constructor keep what they work out — so a tool that builds a level itself calls this first. */
export function pinMaths(): void { if (pinned('TPS_EXACT')) EXACT.on = String((globalThis as any).process?.env?.TPS_EXACT ?? '') === '1'; }
/** THE SENSES ON THE CPU (src/game/sense.ts) on the harness: off on both stands, as the page (TPS_CPUSENSE=1 raises it, the page's ?cpusense) */
export function pinSenses(): void { if (pinned('TPS_CPUSENSE')) SENSE.cpu = String((globalThis as any).process?.env?.TPS_CPUSENSE ?? '') === '1'; }
/** A RECORD FROM ANYONE (src/game/cmd.ts checkCmd) on the harness: off on the frozen stand (TPS_CMDCHECK=1 raises it); the shipped stand keeps the page's (on) */
export function pinCmdCheck(): void { if (pinned('TPS_CMDCHECK')) CMDCHECK.on = String((globalThis as any).process?.env?.TPS_CMDCHECK ?? '') === '1'; }

export async function standGame(host: HostApi, opts: StandOpts = {}): Promise<Stood> {
  if (opts.harness) { pinMaths(); pinSenses(); pinCmdCheck(); }   // (first: the level and the Game's constructor work out sines and cosines)
  const level = opts.level ?? buildLevel();
  let ch = opts.ch;
  if (!ch) { if (!opts.gltfUrl) throw new Error('standGame: neither ch nor gltfUrl given'); ch = await loadGltfCharacter(opts.gltfUrl); }
  const smoke = opts.smoke ?? nullSmoke();
  if (opts.populate !== false) populateHost(host, level);
  if (opts.harness && pinned('TPS_OPENING')) OPENING.on = String((globalThis as any).process?.env?.TPS_OPENING ?? '') === '1';   // THE NIGHT'S OPENING (src/game/opening.ts): off, so every man of the shift starts on his route's first waypoint as when every frozen digest, tally and session fixture was recorded — set before the Game exists (its constructor places them); `TPS_OPENING=1` runs any harness tool with it on, tools/qa/solo-night.ts raises it for its as-shipped stand (the shipped default is ON)
  if (opts.harness && pinned('TPS_GEAR')) GEAR.on = String((globalThis as any).process?.env?.TPS_GEAR ?? '') === '1';   // the 2010s issue kit (src/game/gear.ts): off, so the kit's names in every frozen probe's HUD, message and debrief text are the ones they were written against, and Sam's pistol holds the ten it held; `TPS_GEAR=1` turns it on (the shipped default). Words, drawn boxes and the Glock's fifteen-round magazines — set before the Game exists (its constructor loads Sam's pistol)
  if (opts.harness && pinned('TPS_AIRDUST')) AIRDUST.on = String((globalThis as any).process?.env?.TPS_AIRDUST ?? '') === '1';   // THE WEATHER'S DUST IN THE ROOMS (src/game/airDust.ts): off, so a sight line under a picked weather is cut by the leak under every roof, as when every frozen digest and tally was recorded; `TPS_AIRDUST=1` runs any tool with it (before the Game exists: its constructor seeds the field)
  if (opts.harness && pinned('TPS_SNOW')) SNOW.on = String((globalThis as any).process?.env?.TPS_SNOW ?? '') === '1';   // a level built for snow is born in snow (src/game/weatherKinds.ts SNOW_LEVELS, weather.ts levelKind): off, so such a level stands under the weather any level has; `TPS_SNOW=1` raises it — set before the Game exists: the Weather picks its kind in its constructor
  if (opts.harness && pinned('TPS_SNOWLOOK')) SNOW_LOOK.on = String((globalThis as any).process?.env?.TPS_SNOWLOOK ?? '') === '1';   // the snow's look (weatherKinds.ts SNOW_LOOK; picture only): off, so a snow level is drawn as its painted boxes
  if (opts.harness && pinned('TPS_SNOWWISPS')) SNOW_LOOK.wisps = String((globalThis as any).process?.env?.TPS_SNOWWISPS ?? '') === '1';   // … and no wisps run over its ground
  if (opts.harness && pinned('TPS_SNOWTRACKS')) SNOW_LOOK.tracks = String((globalThis as any).process?.env?.TPS_SNOWTRACKS ?? '') === '1';   // … no boot presses a trail into it
  if (opts.harness && pinned('TPS_SNOWGLOW')) SNOW_LOOK.glow = String((globalThis as any).process?.env?.TPS_SNOWGLOW ?? '') === '1';   // … and no lamp's light glows through it
  if (opts.harness && pinned('TPS_SNOWSPARKLE')) SNOW_LOOK.sparkle = String((globalThis as any).process?.env?.TPS_SNOWSPARKLE ?? '') === '1';   // … and no grain of it flashes a lamp back at the eye
  if (opts.harness && pinned('TPS_AIR')) AIR_SIM.on = String((globalThis as any).process?.env?.TPS_AIR ?? '') === '1';   // the air as one simulated field (game/airSim.ts; picture only): off, so nothing is drawn into its map or handed to an engine
  if (opts.harness && pinned('TPS_SNOWGRAINS')) SNOW_LOOK.grains = String((globalThis as any).process?.env?.TPS_SNOWGRAINS ?? '') === '1';   // … no fine grains ride a simulated wind near the view
  if (opts.harness && pinned('TPS_SNOWAIR')) SNOW_LOOK.oneAir = String((globalThis as any).process?.env?.TPS_SNOWAIR ?? '') === '1';   // … its snow is not one snow in one air
  if (opts.harness && pinned('TPS_SNOWMARKS')) SNOW_LOOK.marks = String((globalThis as any).process?.env?.TPS_SNOWMARKS ?? '') === '1';   // … things leave no mark on it and a mark is whole at once
  if (opts.harness && pinned('TPS_SNOWPAST')) SNOW_LOOK.past = String((globalThis as any).process?.env?.TPS_SNOWPAST ?? '') === '1';   // … and no flake falls past the level's rim
  if (opts.harness && pinned('TPS_SNOWUNDER')) SNOW_LOOK.under = String((globalThis as any).process?.env?.TPS_SNOWUNDER ?? '') === '1';   // … and the roofs asked as one by the flakes' splat (the seam between two slabs, a partition's top inside)
  if (opts.harness && pinned('TPS_SNOWBLAST')) SNOW_LOOK.blast = String((globalThis as any).process?.env?.TPS_SNOWBLAST ?? '') === '1';   // … no blast marks the snow
  if (opts.harness && pinned('TPS_SNOWBREATH')) SNOW_LOOK.breath = String((globalThis as any).process?.env?.TPS_SNOWBREATH ?? '') === '1';   // … and nobody's breath steams in its cold
  if (opts.harness && pinned('TPS_BREATHSTEAM')) SNOW_LOOK.steam = String((globalThis as any).process?.env?.TPS_BREATHSTEAM ?? '') === '1';   // … and where it does, it is the puffs of sprite, not gas in the smoke solver
  if (opts.harness && pinned('TPS_CARLAMPS')) CARLAMPS.on = String((globalThis as any).process?.env?.TPS_CARLAMPS ?? '') === '1';   // a vehicle's lamps are light targets (src/game/carlamps.ts; read when the Game is built, so written before it): off, so no level has one and no round breaks one
  const dice = opts.seed == null ? null : newDice(opts.seed); useDice(dice);   // (before the Game exists: its constructor rolls the men's construction dice)
  const game = new Game(host, level, ch, smoke); game.dice = dice;
  if (opts.audio) game.audio = opts.audio;
  if (!opts.harness) game.saves.onPutBack = () => hostAfterPutBack(game);   // (a save kept in memory put back — savestate.ts SAVETIMELINE: the GPU's buffers are told so; host/putback.ts)
  if (opts.harness) {
    if (pinned('TPS_QRFSILENT')) game.tune.qrfSilent = String((globalThis as any).process?.env?.TPS_QRFSILENT ?? '') === '1';   // THE SILENT NET (src/game/qrf.ts silentNet): off, so the response team's trigger is the one every frozen probe, tally and session fixture was written against — `TPS_QRFSILENT=1` turns it on for any harness tool (the shipped default is ON)
    if (pinned('TPS_QRFSQUAD')) game.tune.qrfSquad = String((globalThis as any).process?.env?.TPS_QRFSQUAD ?? '') === '1';   // THE RESPONSE TEAM ON THE SQUAD'S DOOR AND ROOM CODE (src/game/qrf.ts startDrill, squadcast.ts): off, so the element takes a room by its own drill on the level's marks, as every frozen probe, tally and session fixture was recorded — `TPS_QRFSQUAD=1` turns it on for any harness tool (the shipped default is ON)
    if (pinned()) game.tune.chaos = 0;   // DESTRUCTION (src/game/destruction.ts): the harness stands the game up at chaos 0 — the destruction probes and `soak.ts --chaos K` raise it themselves (the shipped default is 0.5)
    game.saves.store = memoryStore();   // (the autosave slots live in a Map the probes can read — game.saves.store.map)
    if (pinned()) AIM.player.lightSnapPx = SNAP_PX;    // the reticle takes a light from the men's 60 px, as it did when every frozen digest, tally and session fixture was recorded with the cursor parked mid-view (the shipped default is the light's own dot — aim-snap puts that back and holds it)
    if (pinned()) AIM.player.level = 0;                // …and his gun is on the world point under that parked cursor, floor included, as it was for every one of those (the shipped default is level along the cursor's heading — player.ts levelOn; `probes.ts aimlevel` turns it on)
    if (pinned()) AIM.player.low = 0;                  // …and a man under his reticle is aimed at a standing chest over his feet whatever his pose, as he was for every one of those (the shipped default goes to a low man's own chest — player.ts manAim; `probes.ts aimlow` turns it on)
    if (pinned('TPS_MOVES')) MOVES.on = String((globalThis as any).process?.env?.TPS_MOVES ?? '').split(',')[0] === '1' ? 1 : 0;                        // the loud demo's motion pass (src/game/character.ts MOVES): off, so every pose — and with it every muzzle, hit column and frozen digest — is what it was; `probes.ts moves` and tools/qa/pose-strip.ts turn it on, `TPS_MOVES=1` runs any harness tool (the tour, the soak, a family) with it on (the shipped default is on)
    if (pinned('TPS_TURN')) { const h = String((globalThis as any).process?.env?.TPS_TURN ?? '').split(',')[0]; TURN.on = h === '1' || Object.hasOwn(TURN_FEEL, h) ? 1 : 0; }                                    // … and the turn weight (character.ts TURN): off, so every yaw is the one the AI wrote; `TPS_TURN=1` (or a setting's name: `TPS_TURN=heavy` — tools/qa/headless.ts reads the numbers) turns it on
    if (pinned('TPS_WOUNDS')) WOUND.on = String((globalThis as any).process?.env?.TPS_WOUNDS ?? '') === '1';   // wounds (src/game/wounds.ts): off, so every round that finds a man kills him, as in every frozen digest; `TPS_WOUNDS=1` runs any tool with the rule on
    if (pinned('TPS_DOORPATH')) DOORPATH.on = String((globalThis as any).process?.env?.TPS_DOORPATH ?? '').split(',')[0] === '1';   // the room entry's real paths through the door (src/game/doorpath.ts): off, so every entry — and every frozen digest — walks as it did; `TPS_DOORPATH=1` turns it on
    if (pinned('TPS_FOGTHINGS')) FOG.things = String((globalThis as any).process?.env?.TPS_FOGTHINGS ?? '') === '1';   // nothing moves in the fog (src/game/fogofwar.ts things()): off, so the list the cursor's ray meets is the game's own — a remembered thing under the cursor turned Sam's facing a few degrees in 2 of 26 frozen play-throughs; `probes.ts fog-things` turns it on, `TPS_FOGTHINGS=1` for any harness tool (the shipped default is ON)
    if (pinned('TPS_FOGFLAT')) FOG.flat = String((globalThis as any).process?.env?.TPS_FOGFLAT ?? '') === '1' ? FOG_FLAT_ON : 0;   // the fog's own light (src/game/fogofwar.ts FOG.flat; the picture only): off, so the fog block handed to the renderer is the one every stored frame was drawn with
    if (pinned('TPS_FOGLIT')) FOG.lit = String((globalThis as any).process?.env?.TPS_FOGLIT ?? '') === '1' ? FOG_LIT_ON : 0;   // the fog lit as the team last knew it (src/game/fogofwar.ts FOG.lit; the picture only): off, so the fog block handed to the renderer is the one every stored frame was drawn with
    if (pinned('TPS_FOGFULL')) FOG.full = String((globalThis as any).process?.env?.TPS_FOGFULL ?? '') === '1';   // the full picture under the fog (src/game/fogofwar.ts FOG.full; the picture only): off, so the fog block and the lights handed to the renderer are the ones every stored frame was drawn with
    if (pinned('TPS_FOGEDGE')) FOG.edge = String((globalThis as any).process?.env?.TPS_FOGEDGE ?? '') === '1' ? FOG_EDGE_ON : 0;   // the fog's soft edge (src/game/fogofwar.ts FOG.edge; the picture only): off, so the fog block handed to the renderer is the one every stored frame was drawn with
    if (pinned('TPS_FOGCOLOUR')) FOG.desat = String((globalThis as any).process?.env?.TPS_FOGCOLOUR ?? '') === '1' ? 0 : FOG_DESAT_WAS;   // the fog keeps its colour (src/game/fogofwar.ts FOG.desat 0; the picture only): greyed as it was, so the fog block handed to the renderer is the one every stored frame was drawn with
    if (pinned('TPS_SQUADDOORS')) FOG.squadDoors = String((globalThis as any).process?.env?.TPS_SQUADDOORS ?? '') === '1';   // a door the squad works is seen (src/game/fogofwar.ts doorSeen): off, so a leaf out of the eyes' sight is drawn — and met by the cursor's ray — where every stored run had it
    if (pinned('TPS_SQUADFIRE')) FOG.squadFire = String((globalThis as any).process?.env?.TPS_SQUADFIRE ?? '') === '1';   // a man the squad is shooting at is in the picture (src/game/fogofwar.ts firedOn): off, so the reticle takes only the men every stored run had in the picture
    if (pinned('TPS_WALLSNAP')) WALLSNAP.on = String((globalThis as any).process?.env?.TPS_WALLSNAP ?? '') === '1';   // back to the wall, the feel pass (src/game/wallsnap.ts): off, so Q takes the wall on the old clock and slings the rifle, as every frozen probe and digest has it; `TPS_WALLSNAP=1` turns it on (the shipped default)
    if (pinned('TPS_WALLPRESS')) WALLSNAP.press = String((globalThis as any).process?.env?.TPS_WALLPRESS ?? '') === '1';   // the wall taken without the key (src/game/wallsnap.ts `press`): off, so only Q takes a wall, as every frozen probe and digest has it; `TPS_WALLPRESS=1` turns it on (the shipped default; it acts only with the feel pass on)
    if (pinned('TPS_WALLVOICE')) WALLSNAP.voice = String((globalThis as any).process?.env?.TPS_WALLVOICE ?? '') === '1';   // the hold's two sounds (wallsnap.ts `voice`): off on the frozen stand, where only the old scuff is asked for; `TPS_WALLVOICE=1` turns them on (the shipped default)
    if (pinned('TPS_LEANGUN')) WALLSNAP.leanGun = String((globalThis as any).process?.env?.TPS_LEANGUN ?? '') === '1' ? LEAN_GUN_M : 0;   // the step-out's share for the rifle (wallsnap.ts `leanGun`): 0, so a step-out is 0.6 m whichever side the end is on, as every frozen probe has it; `TPS_LEANGUN=1` turns it on (the shipped default)
    if (pinned('TPS_WALLSLOW')) WALLSNAP.slow = String((globalThis as any).process?.env?.TPS_WALLSLOW ?? '') === '1';   // the unhurried take (wallsnap.ts `slow`): off, so every frozen probe and digest has the take's seconds as they were; `TPS_WALLSLOW=1` turns it on (the shipped default)
    if (pinned('TPS_HANDSLOT')) HANDSLOT.on = String((globalThis as any).process?.env?.TPS_HANDSLOT ?? '') === '1';   // empty hands are a slot (game/handslot.ts): off, so the frozen stand's kit keys are as every probe and digest has them; `TPS_HANDSLOT=1` raises it
    if (pinned()) THROWBACK.restMark = false;   // the throw preview's rest mark (throwback.ts `restMark`): the overlay's, held off here like every newer rule
    if (pinned('TPS_THROWBACK')) THROWBACK.on = String((globalThis as any).process?.env?.TPS_THROWBACK ?? '') === '1';   // a can in the wind-up goes back on the belt when another beat begins (game/throwback.ts): off, so the frozen stand's throws are as every probe has them; `TPS_THROWBACK=1` raises it
    if (pinned('TPS_OWNBLOW')) OWNBLOW.on = String((globalThis as any).process?.env?.TPS_OWNBLOW ?? '') === '1';   // his own charge goes off from his own actions, not the squad's key (game/ownblow.ts): off, so the frozen stand's charges by hand blow on the key as every probe has them; `TPS_OWNBLOW=1` raises it
    if (pinned('TPS_HANDRING')) HANDRING.near = HANDRING.empty = HANDRING.early = HANDRING.on = String((globalThis as any).process?.env?.TPS_HANDRING ?? '') === '1';   // his own actions are a ring that stays (game/handring.ts): off, so the frozen stand's Space list, its rows and the whistle's key are as every probe has them; `TPS_HANDRING=1` raises it
    if (pinned('TPS_LIGHTWALL')) LIGHTWALL.on = String((globalThis as any).process?.env?.TPS_LIGHTWALL ?? '') === '1';   // a weapon light stops at the wall its carrier is pressed to (src/game/lighting.ts lensClear): off, so every carried light is at its lens — and the CPU light estimate reads what it read in every frozen digest and tally; `TPS_LIGHTWALL=1` turns it on (the shipped default)
    if (pinned('TPS_WALLLIGHT')) LIGHTS.wallOff = String((globalThis as any).process?.env?.TPS_WALLLIGHT ?? '') === '1';   // a teammate's light is dark into the wall at his muzzle (src/game/guards.ts wallDark): off, so his light is what the other light rules make it, as in every frozen probe, tally and digest; `TPS_WALLLIGHT=1` turns it on
    if (pinned('TPS_NOTEAMLASER')) IR.teamOff = String((globalThis as any).process?.env?.TPS_NOTEAMLASER ?? '') === '1';   // the team's guns show no laser line (src/game/irlaser.ts; a picture only): off, so every teammate's laser is drawn as the laser probes read it; TPS_NOTEAMLASER=1 raises it
    if (pinned('TPS_IRLIGHT')) IRLIGHT.on = String((globalThis as any).process?.env?.TPS_IRLIGHT ?? '') === '1';   // an infrared light on the goggles (src/game/irlight.ts): off, so a teammate's tube reads the light the meter reads and nothing else, and a room with none is too dark for it
    if (pinned('TPS_IRAUTO')) IRLIGHT.auto = String((globalThis as any).process?.env?.TPS_IRAUTO ?? '') === '1';   // the infrared light burns only where it is too dark for the tube (src/game/irlight.ts): off, so a light raised by TPS_IRLIGHT=1 burns whenever the goggles are down, as every check of it was written
    if (pinned('TPS_IRMETER')) IRLIGHT.meter = String((globalThis as any).process?.env?.TPS_IRMETER ?? '') === '1';   // …and puts what the CPU calls dark to the renderer's meter where that answers (headless it never does: the CPU's rule is the whole rule, at once)
    if (pinned('TPS_IRNEAR')) IRLIGHT.near = String((globalThis as any).process?.env?.TPS_IRNEAR ?? '') === '1';   // …and turns itself down for what stands close in front of it (src/game/irlight.ts nearK): off, so a frozen run that raises the light has it at full strength as it was; TPS_IRNEAR=1 raises it
    if (pinned()) GUNWALL.mark = false;   // the barred aim ring (gunwall.ts `mark`): the overlay's, held off here like every newer rule
    if (pinned('TPS_GUNWALL')) GUNWALL.on = String((globalThis as any).process?.env?.TPS_GUNWALL ?? '') === '1';   // a raised gun comes to the low ready at a wall (src/game/gunwall.ts): off, so every man carries and fires as in every frozen digest and tally; `TPS_GUNWALL=1` turns it on (the shipped default)
    if (pinned('TPS_REARWATCH')) REARWATCH.on = String((globalThis as any).process?.env?.TPS_REARWATCH ?? '') === '1';   // the rear man covers the door behind (src/game/rearwatch.ts): off, so a stack's spare eyes are the unasked cover's deal alone and every gun is on the door once it goes, as in every frozen digest and tally; `TPS_REARWATCH=1` turns it on (the shipped default)
    if (pinned('TPS_LANES')) LANES.on = String((globalThis as any).process?.env?.TPS_LANES ?? '') === '1';   // defenders respect a lane that cost them (src/game/lanes.ts): off, so every frozen room-fight digest and tally plays the defenders who walk in
    if (pinned('TPS_HAULHOME')) HAULHOME.on = String((globalThis as any).process?.env?.TPS_HAULHOME ?? '') === '1';   // a hauling man brings his furniture the last hand to the door (src/game/digin.ts HAULHOME): off, so every frozen dig-in digest and tally plays the haul given up the frame he stopped
    if (pinned('TPS_SWEEP')) HARD.sweep = String((globalThis as any).process?.env?.TPS_SWEEP ?? '') === '1';   // hard's defenders go and look when the team goes quiet (src/game/pressure.ts goLook, src/game/enemysquads.ts lookOut): off, so every frozen hard digest and tally plays the garrison that holds where the noise left it
    if (pinned('TPS_HOLDDROP')) HOLD.dropGun = String((globalThis as any).process?.env?.TPS_HOLDDROP ?? '') === '1';   // a held man drops his gun: off on the frozen stand (its hold probes and digests were recorded with the gun in his fist)
    if (pinned('TPS_TABBACK')) BACKKEY.tab = String((globalThis as any).process?.env?.TPS_TABBACK ?? '') === '1';   // Esc is only the pause and Tab backs out (src/game/backkey.ts): off on the frozen stand, where a Tab in the tick does nothing
    if (pinned('TPS_WALLSHOT')) WALLSHOT.on = String((globalThis as any).process?.env?.TPS_WALLSHOT ?? '') === '1';   // a wall shot's thinner smoke and its room-wide shock (src/game/wallcharge.ts WALLSHOT): off on the frozen stand, where a charge's pall and stun are the ones every tally was recorded on
    if (pinned('TPS_WALLKILL')) WALLKILL.on = String((globalThis as any).process?.env?.TPS_WALLKILL ?? '') === '1';   // a wall charge kills whoever stands at it, the player among them (src/game/wallcharge.ts WALLKILL): off on the frozen stand, where the man at the charge was dazzled
    if (pinned('TPS_HARDBREATH')) HARDBREATH.on = String((globalThis as any).process?.env?.TPS_HARDBREATH ?? '') === '1';   // a man who has run breathes hard, chest and steam (src/game/character.ts HARDBREATH): off on the frozen stand, where a blown man's chest heaved by the life layer's own numbers
    if (pinned('TPS_FIXEDSTEP')) FIXEDSTEP.on = String((globalThis as any).process?.env?.TPS_FIXEDSTEP ?? '') === '1';   // the fixed 60 Hz game step (src/host/loop.ts): off on the frozen stand — a tool that steps through stepFrame gets one update a frame on the frame's own time, as every frozen digest was recorded
    if (pinned('TPS_TWEEN')) TWEEN.on = String((globalThis as any).process?.env?.TPS_TWEEN ?? '') === '1';   // drawing between ticks (src/host/tween.ts): off on the frozen stand — picture only, and only under the line above
    if (pinned('TPS_HOLDYAW')) HOLD.oneFacing = String((globalThis as any).process?.env?.TPS_HOLDYAW ?? '') === '1';   // a held man keeps the hold's facing: off on the frozen stand (its showcase digests were recorded with the marks turning him)
    if (pinned('TPS_GUNHOLD')) GUNHOLD.on = String((globalThis as any).process?.env?.TPS_GUNHOLD ?? '') === '1';   // the pistol in a hold sends men to cover and round him: off on the frozen stand (its standoff probes and digests were recorded with men walking the ring in the open)
    if (pinned('TPS_STACKLINE')) STACKLINE.on = String((globalThis as any).process?.env?.TPS_STACKLINE ?? '') === '1';   // brisk through an open door's line on the walk up (src/game/stackline.ts): off, so a man ordered to stack takes the slow last steps onto his mark whatever the door, as in every frozen digest and tally; `TPS_STACKLINE=1` turns it on (the shipped default)
    if (pinned('TPS_ROOMKEEP')) REARWATCH.room = String((globalThis as any).process?.env?.TPS_ROOMKEEP ?? '') === '1';   // a taken room's other door kept over 'fall in' (src/game/rearwatch.ts roomKeepTick): off, so the man on it turns away the frame the order is given, as in every frozen digest
    if (pinned('TPS_FARSIGHT')) GUARD_EYE.far = String((globalThis as any).process?.env?.TPS_FARSIGHT ?? '') === '1';   // a lit man is seen from past 16 m (src/game/guards.ts eyeReach): off, so every frozen sighting, digest and recording has the eye that stops at 16 m
    if (pinned('TPS_FARCALM')) GUARD_EYE.farCalm = String((globalThis as any).process?.env?.TPS_FARCALM ?? '') === '1';   // a far glimpse is no place to walk to (src/game/guards.ts farFaint): off, the frozen stand has no far reach for it to act on
    if (pinned('TPS_CLOSE')) CLOSE.on = String((globalThis as any).process?.env?.TPS_CLOSE ?? '') === '1';   // closer than ever (src/game/close.ts): off, so a man has the one way in from behind and Sam's rows are what every frozen probe and digest read; `TPS_CLOSE=1` turns it on (the shipped default)
    if (pinned('TPS_HELDCLICKS')) CLOSE.heldClicks = String((globalThis as any).process?.env?.TPS_HELDCLICKS ?? '') === '1';   // the two buttons with a man in the arm (src/game/close.ts, player.ts updateHold): off, so a click in the arm hold does nothing, as every frozen probe and digest read; `TPS_HELDCLICKS=1` turns them on (the shipped default)
    if (pinned('TPS_REACHUP')) CLOSE.reachUp = String((globalThis as any).process?.env?.TPS_REACHUP ?? '') === '1';   // the grab's reach up for a man who stands over him (src/game/close.ts): off, so the tell's pose is the one every frozen run was made with
    if (pinned('TPS_KITANIM')) KITANIM.on = String((globalThis as any).process?.env?.TPS_KITANIM ?? '') === '1';   // kit animations (src/game/kitanim.ts): off, so every draw, reload beat, lock-out and pose is what every frozen probe and digest read; `TPS_KITANIM=1` turns them on (the shipped default)
    if (pinned('TPS_THROWBY')) THROW_BY.on = String((globalThis as any).process?.env?.TPS_THROWBY ?? '') === '1';   // a throw reads its distance (src/game/character.ts THROW_BY): off, so every throw is the one overhand every frozen pose, strip and digest was read on; `TPS_THROWBY=1` turns it on (the shipped default)
    if (pinned('TPS_TEAMPACE')) TEAMPACE.on = String((globalThis as any).process?.env?.TPS_TEAMPACE ?? '') === '1';   // teammates slower than the player, running only for a reason (src/game/teampace.ts): off, so the team walks every leg at the pace every frozen probe, digest and tape has it
    if (pinned('TPS_GLASSDROP')) GLASSREAL.drop = String((globalThis as any).process?.env?.TPS_GLASSDROP ?? '') === '1';   // toughened glass drops at once (src/game/glassbreak.ts GLASSREAL): off, so a diced sheet lets go in the wave every frozen glass probe, tally and tape timed
    if (pinned('TPS_GLASSPLACE')) GLASSREAL.place = String((globalThis as any).process?.env?.TPS_GLASSPLACE ?? '') === '1';   // a pane's glass by where it sits (the same table): off, so outside glass is toughened and inside float, the kinds every frozen glass probe and stack mark was dealt on
    if (pinned('TPS_SLOTSETUP')) SLOTSETUP.pop = SLOTSETUP.on = String((globalThis as any).process?.env?.TPS_SLOTSETUP ?? '') === '1';   // the slot in hand pressed again opens its setup (src/game/slotsetup.ts): off, so 2 pressed with the rifle up steps the launcher's load, as every frozen probe, tape and lesson run has it; TPS_SLOTSETUP=1 raises it
    if (pinned('TPS_SETUPDRAW')) SLOTSETUP.draw = String((globalThis as any).process?.env?.TPS_SETUPDRAW ?? '') === '1';   // a gun's digit pressed again during its own draw opens the setup (src/game/slotsetup.ts `draw`): off, so a double-tapped digit is the draw and no more, as TPS_SLOTSETUP=1 alone has always stood the rule up; TPS_SETUPDRAW=1 raises it
    if (pinned('TPS_DOORFORCE')) DOORFORCE.on = String((globalThis as any).process?.env?.TPS_DOORFORCE ?? '') === '1';   // an alerted man does not wait at a shut door (src/game/doorforce.ts): off, so a defender who knows a man is behind a shut leaf rests his gun on it or goes to its handle, as in every frozen probe, digest and tally; TPS_DOORFORCE=1 raises it
    if (pinned('TPS_RAILS')) RAILS.on = String((globalThis as any).process?.env?.TPS_RAILS ?? '') === '1';   // a tutorial mission's frame (src/game/rails.ts): off, so a level whose lesson carries a rails record plays as a plain lesson on the frozen stand (no shipped level but the tutorial group's carries one)
    if (pinned('TPS_NOSHOVE')) NOSHOVE.on = String((globalThis as any).process?.env?.TPS_NOSHOVE ?? '') === '1';   // teammates falling in never shove the player (src/game/noshove.ts): off, so a follower walks into him and the squad reads the shove as his walking, as every frozen probe, digest and tape has it
    if (pinned('TPS_SPRINTDOOR')) SPRINTDOOR.on = String((globalThis as any).process?.env?.TPS_SPRINTDOOR ?? '') === '1';   // a sprint into a door has weight (src/game/sprintdoor.ts): off, so a scripted player who runs through a door is where every frozen probe, digest and tape has him a second later
    if (pinned('TPS_AIMWEIGHT')) AIMWEIGHT.on = String((globalThis as any).process?.env?.TPS_AIMWEIGHT ?? '') === '1';   // the player's gun turns at a limited rate and trails the cursor (src/game/aimweight.ts): off, so a scripted player who puts the cursor on a man and clicks on the same frame hits him as every frozen probe, digest and tally expects; `TPS_AIMWEIGHT=1` turns it on
    if (pinned('TPS_LAMPHIT')) AIMCOST.lamp = String((globalThis as any).process?.env?.TPS_LAMPHIT ?? '') === '1';   // a lamp needs a real hit (src/game/aimcost.ts): off, so every older probe's round that passes a fixture breaks it as it did
    if (pinned('TPS_MOVECOST')) AIMCOST.move = String((globalThis as any).process?.env?.TPS_MOVECOST ?? '') === '1';   // moving feet cost the shot, remembered a beat (src/game/aimcost.ts): off, so every frozen digest's cones are the ones it was recorded with
    if (pinned('TPS_SAMSTUN')) SAMSTUN.on = String((globalThis as any).process?.env?.TPS_SAMSTUN ?? '') === '1';   // a blast folds or blinds the player as it does a man (src/game/samstun.ts): off, so a scripted player near a canister or a grenade keeps his feet and his reticle as every frozen probe, digest and tally expects; `TPS_SAMSTUN=1` turns it on
    if (pinned('TPS_TEAMTALLY')) TEAMTALLY.on = String((globalThis as any).process?.env?.TPS_TEAMTALLY ?? '') === '1';   // a partner's men are on Sam's card on a quiet mission as two (src/game/teamtally.ts): off, so a quiet run as two keeps the numbers every tally was recorded with
    if (pinned('TPS_LASTMAG')) RELOAD.lastMag = String((globalThis as any).process?.env?.TPS_LASTMAG ?? '') === '1';   // the last magazine seated and not racked is still a reload (src/game/autoreload.ts): off, so R refuses it as every frozen probe and digest expects; `TPS_LASTMAG=1` turns it on
    if (pinned('TPS_AUTORELOAD')) RELOAD.auto = String((globalThis as any).process?.env?.TPS_AUTORELOAD ?? '') === '1';   // a dry gun reloads itself (src/game/autoreload.ts): off, so a dry gun waits for R as every frozen probe, digest and scripted player expects; `TPS_AUTORELOAD=1` turns it on
    if (pinned('TPS_QUICKTHROW')) QUICKTHROW.on = String((globalThis as any).process?.env?.TPS_QUICKTHROW ?? '') !== '0';   // the G quick throw (src/game/quickthrow.ts): ON here — the page plays without it, but the frozen probes and a recorded session press G (the soak does not); `TPS_QUICKTHROW=0` takes it away
    if (pinned('TPS_FRIENDS')) FRIENDS.noSnap = String((globalThis as any).process?.env?.TPS_FRIENDS ?? '') === '1';   // the reticle passes over men of the player's own side (src/game/friends.ts): off, so a scripted cursor near a teammate snaps as every frozen probe and digest saw it; `TPS_FRIENDS=1` = as the page
    if (pinned('TPS_LIGHTSWITCH')) LIGHTSWITCH.on = String((globalThis as any).process?.env?.TPS_LIGHTSWITCH ?? '') === '1';   // a room's wall switch (src/game/lightswitch.ts): off, so no level has a plate, Space has no row for one and no light-out says where a hand was, as every frozen probe and digest saw it; `TPS_LIGHTSWITCH=1` = as the page
    if (pinned('TPS_CLEANRESTART')) CLEANRESTART.on = String((globalThis as any).process?.env?.TPS_CLEANRESTART ?? '') === '1';   // a restart gives a clean level (src/game/cleanrestart.ts): off, so a restart mends the mains as a hand on the breaker does, keeps the last try's lines and clocks and flies the camera back, as every frozen probe and digest saw it; `TPS_CLEANRESTART=1` = as the page
    if (pinned('TPS_FRIENDLYFIRE')) FRIENDLYFIRE.on = String((globalThis as any).process?.env?.TPS_FRIENDLYFIRE ?? '') === '1';   // a round of Sam's side finds the men of Sam's side (src/game/friendlyfire.ts): off, so a scripted player's round passes a teammate and a teammate's passes him, as every frozen probe and digest saw it; `TPS_FRIENDLYFIRE=1` = as the page
    if (pinned('TPS_SAVETIMELINE')) SAVETIMELINE.on = String((globalThis as any).process?.env?.TPS_SAVETIMELINE ?? '') === '1';   // the saves roll and a team on the floor is saved in memory (src/game/savestate.ts): off, so a frozen run keeps what it always kept
    if (pinned('TPS_SAVEHOLDS')) SAVETIMELINE.holds = String((globalThis as any).process?.env?.TPS_SAVEHOLDS ?? '') === '1';   // a save carries the wall hold and the close-in gait (savestate.ts)
    if (pinned('TPS_FIRELINE')) FIRELINE.on = String((globalThis as any).process?.env?.TPS_FIRELINE ?? '') === '1';   // a teammate on an order waits short of the lane the player is firing down (src/game/fireline.ts): off, so an ordered man walks through a scripted player's fire as every frozen probe, digest and tally saw him; `TPS_FIRELINE=1` = as the page
    if (pinned('TPS_MUZZLE')) FRIENDS.lowReady = String((globalThis as any).process?.env?.TPS_MUZZLE ?? '') === '1';   // Sam's gun down for a teammate in its line out of a fight (src/game/friends.ts): off, so a scripted player's click fires whoever stands ahead of him, as it did; `TPS_MUZZLE=1` = as the page
    if (pinned('TPS_QUIETFOG')) QUIETFOG.on = String((globalThis as any).process?.env?.TPS_QUIETFOG ?? '') === '1';   // quiet missions under the fog of war (src/game/quietfog.ts): off, so a quiet mission's query reads no rung of the fog lever, as every frozen run was made
    if (pinned('TPS_QUIETDEF')) QUIETFOG.def = String((globalThis as any).process?.env?.TPS_QUIETDEF ?? '') === 'team' ? 'team' : 'off';   // where a quiet mission starts (src/game/quietfog.ts): 'off', every guard shown, as every frozen quiet digest and tally was played — the page starts one under the fog
    if (pinned('TPS_QUIETWAND')) QUIETFOG.wand = String((globalThis as any).process?.env?.TPS_QUIETWAND ?? '') === '1';   // the mission's own wand (src/game/quietfog.ts quietWand): off, so a quiet mission hands out no wand
    if (pinned('TPS_SOLOFOG')) QUIETFOG.solo = String((globalThis as any).process?.env?.TPS_SOLOFOG ?? '') === '1';   // the solo night under the fog of war (src/game/quietfog.ts soloFogLink): off, so a `solo` link raises no fog and hands out nothing
    if (pinned('TPS_TAKECHECK')) TAKE.wired = String((globalThis as any).process?.env?.TPS_TAKECHECK ?? '') === '1';   // only a wired holder sends a man when it is emptied (src/game/takecheck.ts): off, so every quiet mission sends its man seven seconds after the take, as every frozen run was made; `TPS_TAKECHECK=1` turns it on (the shipped default)
    if (pinned('TPS_SAMESTART')) SAMESTART.on = String((globalThis as any).process?.env?.TPS_SAMESTART ?? '') === '1';   // every mission starts the same way on every try (src/game/samestart.ts): off, so a room clear re-deals on a restart, a rescue draws its roamers and clock and an unpinned quiet mission its deal, as every frozen probe, digest and tally was recorded
    if (pinned('TPS_FALLIN')) START.fallIn = String((globalThis as any).process?.env?.TPS_FALLIN ?? '') === '1';   // the team starts fallen in (src/game/startfile.ts): off, so a staging leaves the men with no order of Sam's, as every frozen probe and digest of the night breach, the room clear and the rescue was made; `TPS_FALLIN=1` turns it on (the shipped default)
    if (pinned('TPS_TORCHWALL')) { TORCH.wallLow = String((globalThis as any).process?.env?.TPS_TORCHWALL ?? '') === '1'; TORCH.wallDark = false; }   // a hand torch hangs when the wall is at his hand (src/game/guards.ts torchLow): off, so a patrol's torch is carried level whatever it lands on, as in every frozen probe, tally and digest; `TPS_TORCHWALL=1` turns it on
    if (pinned('TPS_CALMTORCH')) TORCH.calmOff = String((globalThis as any).process?.env?.TPS_CALMTORCH ?? '') === '1';   // a calm patrol's torch burns only in the dark (src/game/calmtorch.ts): off, so every patrol torch burns wherever he walks, as every frozen digest, tour beat and light-meter bound was made; `TPS_CALMTORCH=1` turns it on (the shipped default)
    if (pinned('TPS_MORALE')) MORALE.on = String((globalThis as any).process?.env?.TPS_MORALE ?? '') === '1';   // shaken (src/game/morale.ts): off, so a blast leaves every man it does not hurt standing where he stood, no man is met and no die is drawn, as every frozen digest and tally was made; `TPS_MORALE=1` turns it on (the shipped default)
    if (pinned('TPS_LOUDCARD')) VERDICT.loudCard = String((globalThis as any).process?.env?.TPS_LOUDCARD ?? '') === '1';   // a mission that leans loud is not graded as a sneak (src/game/verdict.ts loudRow): off, so every card the stealth game stands on carries its rating, as every frozen probe reads it; TPS_LOUDCARD=1 raises it
    if (pinned('TPS_SMOKEBREAK')) SMOKEBREAK.on = String((globalThis as any).process?.env?.TPS_SMOKEBREAK ?? '') === '1';   // a man told to have a smoke (src/game/smokebreak.ts): off, so he stands where the script sent him with his hands as they were
    if (pinned('TPS_ROWSET')) ROWSET.on = String((globalThis as any).process?.env?.TPS_ROWSET ?? '') === '1';   // a mission row's own hour and weather (src/game/rowset.ts): off, so a row that names one starts at the query's, as every row did
    if (pinned('TPS_STARTLE')) STARTLE.on = String((globalThis as any).process?.env?.TPS_STARTLE ?? '') === '1';   // enemies startle when they first see you (src/game/startle.ts): off, so a man who sees you goes for his gun the frame he knows, as in every frozen probe, tally and digest; `TPS_STARTLE=1` turns it on (the shipped default)
    if (pinned('TPS_FLINCH')) FLINCH.on = String((globalThis as any).process?.env?.TPS_FLINCH ?? '') === '1';   // a man flinches when fire comes close (src/game/flinch.ts): off, so nobody ducks but on the suppression model's own edge and no green man breaks under fire, as in every frozen probe, tally and digest; `TPS_FLINCH=1` turns it on (the shipped default)
    if (pinned('TPS_FLINCHRUN')) FLINCH.run = String((globalThis as any).process?.env?.TPS_FLINCHRUN ?? '') === '1';   // …and a green man alone kept under close fire drops it and runs (flinch.ts FLINCH.run): off with it; `TPS_FLINCHRUN=1` turns it on (the shipped default), and under TPS_PROFILE=shipped `TPS_FLINCHRUN=0` leaves the duck alone
    if (pinned('TPS_RUNANYWAY')) RUNNER.anyway = String((globalThis as any).process?.env?.TPS_RUNANYWAY ?? '') === '1';   // a man who has dropped it runs for it no matter what (runner.ts anyway): off, so one idea of an enemy on the only door out corners him, and a rifleman keeps his sidearm
    if (pinned('TPS_RUNNER')) RUNNER.on = String((globalThis as any).process?.env?.TPS_RUNNER ?? '') === '1';   // drops it and runs (src/game/runner.ts): off, so a broken man with an empty gun changes his magazine where he is, no man is taken and no die is drawn, as every frozen digest and tally was made; `TPS_RUNNER=1` turns it on (the shipped default; it acts only with TPS_MORALE=1 beside it)
    if (pinned('TPS_DARKDOOR')) DARKDOOR.on = String((globalThis as any).process?.env?.TPS_DARKDOOR ?? '') === '1';   // not in there alone (src/game/darkdoor.ts): off, so an alarmed man walks through a dark doorway as he always did, no man is met and no room is read, as every frozen digest and tally was made; `TPS_DARKDOOR=1` turns it on (the shipped default — it acts only with TPS_MORALE=1 as well)
    if (pinned('TPS_DOZE')) DOZE.on = String((globalThis as any).process?.env?.TPS_DOZE ?? '') === '1';   // a calm man dozes a long dark wait out in a chair (src/game/doze.ts): off, so every man stands his waits awake with his eyes and ears as every frozen run had them; `TPS_DOZE=1` turns it on (the shipped stand has it on)
    if (pinned('TPS_DARKFOE')) DARKFOE.on = String((globalThis as any).process?.env?.TPS_DARKFOE ?? '') === '1';   // an alerted enemy lights his lamp or walks to where he can see (src/game/darkfoe.ts): off, so every defender's weapon light stays as the mission dealt it and he holds where he was put, as every frozen digest and tally was made; `TPS_DARKFOE=1` turns it on
    if (pinned('TPS_POWEROUT')) POWEROUT.on = String((globalThis as any).process?.env?.TPS_POWEROUT ?? '') === '1';   // a mission's defenders answer a blackout (src/game/powerout.ts): off, so nobody of theirs walks to the breaker and the dark is no word to anybody, as every frozen digest and tally was made; `TPS_POWEROUT=1` turns it on (the shipped stand has it on)
    if (pinned('TPS_SQUADDEAL')) SQUADDEAL.on = String((globalThis as any).process?.env?.TPS_SQUADDEAL ?? '') === '1';   // squads from the rooms (src/game/squaddeal.ts): off, so a level with no squads block is one pool, as every frozen digest and tally was made
    if (pinned('TPS_STAYASK')) STAYASK.on = String((globalThis as any).process?.env?.TPS_STAYASK ?? '') === '1';   // squads that stay in their rooms still miss a silent room (src/game/stayask.ts): off, so nobody on such a floor asks after another squad, as every frozen digest and tally was made
    if (pinned('TPS_KITLOAD')) KITLOAD.on = String((globalThis as any).process?.env?.TPS_KITLOAD ?? '') === '1';   // lighter kit moves faster and hides better (src/game/kitload.ts): off, so nobody's pace, notice or footfall reads his card, as every frozen digest and tally was made
    if (pinned('TPS_SNATCHOUT')) SNATCHOUT.on = String((globalThis as any).process?.env?.TPS_SNATCHOUT ?? '') === '1';   // how a snatch ends (src/game/snatchout.ts): off, so the house taken with the man in hand ends it, as every frozen digest and tally was made
    if (pinned('TPS_RESCUEEND')) RESCUEEND.on = String((globalThis as any).process?.env?.TPS_RESCUEEND ?? '') === '1';   // how a rescue is won (src/game/rescueend.ts): off, so the hostage room held fifteen seconds ends it, as every frozen digest and tally was made
    if (pinned('TPS_RESCUEFLUSH')) RESCUEFLUSH.on = String((globalThis as any).process?.env?.TPS_RESCUEFLUSH ?? '') === '1';   // the men left alive come for the hostages (src/game/rescueflush.ts): off, so they stay where the fight left them, as every frozen digest and tally was made
    if (pinned('TPS_RESCUECHECK')) RESCUECHECK.on = String((globalThis as any).process?.env?.TPS_RESCUECHECK ?? '') === '1';   // the rescue's men check in (src/game/rescuecheck.ts): off, so nobody of a rescue's cast misses a man taken quietly, as every frozen digest and tally was made
    if (pinned('TPS_NETQUIET')) NETQUIET.on = String((globalThis as any).process?.env?.TPS_NETQUIET ?? '') === '1';   // the net goes quiet (src/game/netquiet.ts): off, so a check nobody answers and a body found shake nobody, no line of its is said, no man whips to a noise and the last man holds his room as he did, as every frozen digest and tally was made; `TPS_NETQUIET=1` turns it on (it needs TPS_MORALE=1 to do anything)
    if (pinned('TPS_ATTENTION')) ATTENTION.on = String((globalThis as any).process?.env?.TPS_ATTENTION ?? '') === '1';   // a guard's attention can be taken (src/game/attention.ts): off, so a wary man sweeps the room with his whole eye, no hold narrows it and no mark is drawn, as every frozen digest and tally was
    if (pinned('TPS_PICTURE')) PICTURE.on = String((globalThis as any).process?.env?.TPS_PICTURE ?? '') === '1';   // each man's own picture of the fight (src/game/picture.ts): off, so no man keeps a memory of where his enemies were and every spot is picked as every frozen digest and tally had it
    if (pinned('TPS_RESPONSE')) RESPONSE.on = String((globalThis as any).process?.env?.TPS_RESPONSE ?? '') === '1';   // the response team is the level's own (src/game/qrf.ts RESPONSE): off, so the team is the office's one stairwell behind the gate every frozen digest and tally was made on
    if (pinned('TPS_OUTERWALL')) WALLCHARGE.outer = String((globalThis as any).process?.env?.TPS_OUTERWALL ?? '') === '1';   // a wall charge on an OUTER wall (src/game/wallcharge.ts outerWall): off, so every outer wall is refused in words as in every frozen probe; TPS_OUTERWALL=1 = on
    if (pinned('TPS_WALLSAFE')) WALLCHARGE.safe = String((globalThis as any).process?.env?.TPS_WALLSAFE ?? '') === '1';   // the wall charge's larger safety radius (src/game/wallcharge.ts safeRadius): off, so the squad stands off where it did and the blast reaches the door charge's 1.6 m on its own side, as in every frozen probe; TPS_WALLSAFE=1 = on (the shipped default)
    if (pinned('TPS_PALL')) CHAOS.pall.on = String((globalThis as any).process?.env?.TPS_PALL ?? '') === '1';   // a blast's pall (src/game/destruction.ts CHAOS.pall): off, so the frozen stand's blasts raise the dust they were recorded with
    if (pinned('TPS_MESS')) CHAOS.mess.on = String((globalThis as any).process?.env?.TPS_MESS ?? '') === '1';   // what a blast leaves on the floor (src/game/floormess.ts CHAOS.mess): off, so the frozen stand lays the marks it always laid
    if (pinned('TPS_HUNGCHARGE')) WALLCHARGE.hung = String((globalThis as any).process?.env?.TPS_HUNGCHARGE ?? '') === '1';   // a charge set on what hangs on the wall takes it and the wall (src/game/wallcharge.ts hung): off, so the frozen stand's charge on a notice board is the dud it was recorded as
    if (pinned('TPS_STANDFIRE')) WALLCHARGE.outOfFire = String((globalThis as any).process?.env?.TPS_STANDFIRE ?? '') === '1';   // the stand-off marks out of known fire first (src/game/wallcharge.ts underFire): off, so the frozen stand's squads stand off on the nearest safe marks as recorded (it acts only with the safety radius, itself held: TPS_WALLSAFE=1 TPS_STANDFIRE=1 raises both)
    if (pinned('TPS_MENCLEAR')) WALLCHARGE.menClear = String((globalThis as any).process?.env?.TPS_MENCLEAR ?? '') === '1';   // the men with Sam step back from a set wall charge (src/game/wallcharge.ts clearOf): off, so the frozen stand's followers keep their places in the file
    if (pinned('TPS_WALLFURN')) WALLCHARGE.farFurn = String((globalThis as any).process?.env?.TPS_WALLFURN ?? '') === '1';   // furniture against a wall's far face is no 'no floor behind it' (src/game/wallcharge.ts mouthAfter): off, so a charge is refused and settles where it was in every frozen probe; TPS_WALLFURN=1 = on (the shipped default)
    if (pinned('TPS_BLASTFLOOD')) WALLREACT.blastFlood = String((globalThis as any).process?.env?.TPS_BLASTFLOOD ?? '') === '1';   // one blast, one flood of the rooms (src/game/wallreact.ts blastFlood): off, so the frozen stand floods a row at a time as it was recorded
    if (pinned('TPS_EVERYGONE')) WALLREACT.everyGone = String((globalThis as any).process?.env?.TPS_EVERYGONE ?? '') === '1';   // a man beside a blast is asked about every thing it took (src/game/wallreact.ts everyGone): off, so the one question kept for him is the newest row's, as in every frozen probe; TPS_EVERYGONE=1 = on (the shipped default)
    if (pinned('TPS_CHAIRROLL')) CASTOR.on = String((globalThis as any).process?.env?.TPS_CHAIRROLL ?? '') === '1';   // office chairs coast on their castors (src/game/props.ts CASTOR): off, so furniture a frozen probe shoves stops where it did; TPS_CHAIRROLL=1 = as the page
    if (pinned('TPS_FILESPREAD')) ORDERS.fileSpread = String((globalThis as any).process?.env?.TPS_FILESPREAD ?? '') === '1';   // no two fall-in places on one spot (src/game/orders.ts apartSlot): off, so every frozen probe's file stands where it stood; TPS_FILESPREAD=1 raises it
    if (pinned('TPS_FILEHOLD')) ORDERS.fileHold = String((globalThis as any).process?.env?.TPS_FILEHOLD ?? '') === '1';   // no floor for his place and no stopping short: he holds where he stands (src/game/orders.ts apartSlot hold): off, so every frozen probe's file stands where it stood; TPS_FILEHOLD=1 raises it
    if (pinned('TPS_BACKEND')) ORDERS.backEnd = String((globalThis as any).process?.env?.TPS_BACKEND ?? '') === '1';   // the file's further back off a doorway ends with the floor (src/game/orders.ts clearBack): off, so every frozen probe's near band is as wide as it was; TPS_BACKEND=1 raises it
    if (pinned('TPS_RETAKEGOAL')) ORDERS.retakeGoal = String((globalThis as any).process?.env?.TPS_RETAKEGOAL ?? '') === '1';   // a man back from the fight walks for where his order stands (src/game/orders.ts tick): off, so every frozen run walks as it did; TPS_RETAKEGOAL=1 raises it
    if (pinned('TPS_INWAY')) ORDERS.inWay = String((globalThis as any).process?.env?.TPS_INWAY ?? '') === '1';   // a stack refused only for Sam's own body says so (src/game/orders.ts noRoomWords): off, so every frozen probe's refusal reads 'no room on that door.' as it did; TPS_INWAY=1 raises it
    if (pinned('TPS_WALKTRIES')) ORDERS.walkTries = String((globalThis as any).process?.env?.TPS_WALKTRIES ?? '') === '1';   // a walk whose way runs at a door nobody has tried walks up and tries it (src/game/orders.ts walkStacks): off, so every frozen probe's 'move' at a lock is refused '<door> is locked.' as it was; TPS_WALKTRIES=1 raises it
    if (pinned('TPS_SAMEWAY')) ORDERS.sameWay = String((globalThis as any).process?.env?.TPS_SAMEWAY ?? '') === '1';   // a pair goes round a building by one side (src/game/orders.ts sameWays): off, so every frozen probe's men walk each his own short way as they did; TPS_SAMEWAY=1 raises it
    if (pinned('TPS_TRAILDOORS')) ORDERS.trailDoors = String((globalThis as any).process?.env?.TPS_TRAILDOORS ?? '') === '1';   // a follower goes by the doors Sam took (src/game/orders.ts trailWay): off, so every frozen probe's followers walk each his own short way as they did; TPS_TRAILDOORS=1 raises it
    if (pinned('TPS_COVERKEEP')) ROOMFIGHT.coverKeep = String((globalThis as any).process?.env?.TPS_COVERKEEP ?? '') === '1';   // a man told to cover keeps his angle (src/game/roomfight.ts)
    if (pinned('TPS_PAIRSTEADY')) PAIR.steady = String((globalThis as any).process?.env?.TPS_PAIRSTEADY ?? '') === '1';   // a partner on his way to a man does not turn about (src/game/pairorders.ts takeTick): off, so every frozen pair probe's partner walks and waits as he did; TPS_PAIRSTEADY=1 raises it
    if (pinned('TPS_ROUNDCAP')) ORDERS.roundCap = String((globalThis as any).process?.env?.TPS_ROUNDCAP ?? '') === '1' ? ROUND_CAP : 0;   // the way round an uncleared room only when it is worth it (src/game/orders.ts ORDERS.roundCap): 0, so every frozen probe's men walk the ways round they walked; TPS_ROUNDCAP=1 raises it to the page's value
    if (pinned('TPS_REARREAD')) COVER.rearRead = String((globalThis as any).process?.env?.TPS_REARREAD ?? '') === '1';   // a rear man on a door-less mark reads the ground for what to watch (src/game/cover.ts readRear): off, his rear is the way he came, as every frozen digest was recorded
    if (pinned('TPS_BACKTURN')) COVER.backTurn = String((globalThis as any).process?.env?.TPS_BACKTURN ?? '') === '1';   // a back-pedalling man the deal lets go of keeps his path while his body comes round (src/game/cover.ts turnOut): off, he walks forward along his body, as every frozen digest was made
    if (pinned('TPS_UNDERFOOT')) UNDERFOOT.on = String((globalThis as any).process?.env?.TPS_UNDERFOOT ?? '') === '1';   // a walker's feet are asked from where the walk grid's bake begins (src/scene/collision.ts UNDERFOOT): off, a thing 0.2 m high stops them, as every frozen digest was made
    if (pinned('TPS_BYEYE')) SNEAK.byEye = String((globalThis as any).process?.env?.TPS_BYEYE ?? '') === '1';   // a lit step is seen only where that defender's eye gains on a man there (src/game/sneak.ts)
    if (pinned('TPS_STALKAMBIENT')) SNEAK.stalkAmbient = String((globalThis as any).process?.env?.TPS_STALKAMBIENT ?? '') === '1';   // the stalk's light takes the walker's own meter over the estimate (src/game/sneak.ts sneakWalk): off, the estimate alone, as every frozen probe of the pair read it; TPS_STALKAMBIENT=1 raises it
    if (pinned('TPS_NOISEWALK')) SNEAK.noiseWalk = String((globalThis as any).process?.env?.TPS_NOISEWALK ?? '') === '1';   // a follower is not left standing on the walk of a man who comes to a sound (src/game/sneak.ts sneakComing): off, the breaker man alone, as every frozen probe of the pair read it; TPS_NOISEWALK=1 raises it
    if (pinned('TPS_DOORTEST')) DOORTOOLS.testDoor = String((globalThis as any).process?.env?.TPS_DOORTEST ?? '') === '1';   // an entry order halts at a door found locked or wedged (src/game/doortools.ts haltAt): off, so every frozen probe's entry goes straight to its boot; TPS_DOORTEST=1 raises it
    if (pinned('TPS_THRPIE')) DOORTOOLS.thrPie = String((globalThis as any).process?.env?.TPS_THRPIE ?? '') === '1';   // the jamb men slice the doorway before they call it held (src/game/doortools.ts pieSet): off, so every frozen threshold holds its two diagonals still; TPS_THRPIE=1 raises it
    if (pinned('TPS_THRLEAN')) DOORTOOLS.thrLean = String((globalThis as any).process?.env?.TPS_THRLEAN ?? '') === '1';   // … leaning, the cuts down the door's own line on a knee: off with it; TPS_THRLEAN=1 raises it
    if (pinned('TPS_THRPIEONE')) DOORTOOLS.thrPieOne = String((globalThis as any).process?.env?.TPS_THRPIEONE ?? '') === '1';   // … one man cuts while the other holds his diagonal, one lean at the end, no knee: off, both men cut as the slice's frozen probes read it; TPS_THRPIEONE=1 raises it
    if (pinned('TPS_OUTSIDEPLAIN')) DOORTOOLS.outsidePlain = String((globalThis as any).process?.env?.TPS_OUTSIDEPLAIN ?? '') === '1';   // 'clear from outside' as one order, no threshold pages: off, the menu every frozen probe presses; TPS_OUTSIDEPLAIN=1
    if (pinned('TPS_WORDNOCAN')) DOORTOOLS.wordNoCan = String((globalThis as any).process?.env?.TPS_WORDNOCAN ?? '') === '1';   // the word at a door held from outside spends no can (src/game/doortools.ts wordSteps): off, the word bangs the pockets as every frozen probe has it; acts with TPS_OUTSIDEPLAIN=1
    if (pinned('TPS_WORDSMALL')) DOORTOOLS.wordSmall = String((globalThis as any).process?.env?.TPS_WORDSMALL ?? '') === '1';   // the word sends one or two teammates in from a plain stack (src/game/doortools.ts stackWaits): off, a small squad's stack has no word, as every frozen probe has it; TPS_WORDSMALL=1 raises it
    if (pinned('TPS_QRING')) { CMDRING.on = String((globalThis as any).process?.env?.TPS_QRING ?? '') === '1'; CMDRING.tapNow = CMDRING.on; }   // the orders ring on the squad's command key (src/game/cmdring.ts): off, so the quick key gives its order as it goes down and no ring opens, as every frozen probe presses it; TPS_QRING=1 raises it (a press already up in its own tick is then a tap given on that tick)
    if (pinned('TPS_QSTAY')) { CMDRING.stay = CMDRING.on && String((globalThis as any).process?.env?.TPS_QSTAY ?? '') === '1'; CMDRING.stayDigit = CMDRING.stay; }   // … and the ring staying up when its key comes up: off; TPS_QSTAY=1 raises it beside TPS_QRING=1
    if (pinned('TPS_RINGPIN')) CMDRING.pin = CMDRING.on && String((globalThis as any).process?.env?.TPS_RINGPIN ?? '') === '1';   // … and the ring staying on its point as the view moves: off; TPS_RINGPIN=1 raises it (the page: ?ringpin=0 off)
    if (pinned('TPS_QPLAN')) { CMDRING.plan = CMDRING.on && String((globalThis as any).process?.env?.TPS_QPLAN ?? '') === '1'; CMDRING.planRts = CMDRING.plan; CMDRING.planRun = CMDRING.plan; }   // … and plan mode on Shift + the key (src/game/planmode.ts): off; TPS_QPLAN=1 raises it beside TPS_QRING=1, as the page has it (Sam parked, the view on the walk keys, a sprint's Shift not the mode's)
    if (pinned('TPS_PLANLOOK')) CMDRING.planLook = CMDRING.plan && CMDRING.planRts && String((globalThis as any).process?.env?.TPS_PLANLOOK ?? '') === '1';   // … plan mode's right drag (a way to look): off; TPS_PLANLOOK=1 raises it (the page: ?planlook=0 off)
    if (pinned('TPS_PLANWAITS')) CMDRING.planWaits = CMDRING.plan && String((globalThis as any).process?.env?.TPS_PLANWAITS ?? '') === '1';   // … the plan's own waits, the word freeing only the men stood waiting: off; TPS_PLANWAITS=1 raises it (the page: ?planwaits=0 off)
    if (pinned('TPS_PLANKNEE')) CMDRING.planKnee = CMDRING.plan && CMDRING.planRts && String((globalThis as any).process?.env?.TPS_PLANKNEE ?? '') === '1';   // … the knee at the radio and the view easing back: off; TPS_PLANKNEE=1 raises it (the page: ?planknee=0 off)
    if (pinned('TPS_PLANONE')) CMDRING.planOne = CMDRING.plan && String((globalThis as any).process?.env?.TPS_PLANONE ?? '') === '1';   // … one word freeing two or more doors of a plan puts their entries on one signal: off; TPS_PLANONE=1 raises it (the page: ?planone=0 off)
    if (pinned('TPS_QONLY')) CMDRING.only = CMDRING.on && String((globalThis as any).process?.env?.TPS_QONLY ?? '') === '1';   // … and the ring carrying every order, the letters nobody's while it is up: off; TPS_QONLY=1 raises it (the page: ?qonly=0 off)
    if (!CMDRING.on) { CMDRING.stay = false; CMDRING.stayDigit = false; CMDRING.pin = false; CMDRING.plan = false; CMDRING.planRts = false; CMDRING.planRun = false; CMDRING.hands = false; CMDRING.only = false; }
    if (!CMDRING.plan) { CMDRING.planLook = false; CMDRING.planWaits = false; CMDRING.planKnee = false; CMDRING.planOne = false; }   // (TPS_QRING=0 on the page's stand is the page's ?qring=0: what rides on the ring goes with it)
    if (pinned('TPS_SEENWALK')) SEENWALK.on = String((globalThis as any).process?.env?.TPS_SEENWALK ?? '') === '1';   // an ordered walk keeps off lit floor in view of an uncleared room (src/game/seenwalk.ts): off, the walks as every frozen tally walked them
    if (pinned('TPS_BANGINTO')) DOORTOOLS.bangInto = String((globalThis as any).process?.env?.TPS_BANGINTO ?? '') === '1';   // a bang and clear's can thrown into the room from the hand (src/game/doortools.ts bangSpot): off, the can as every frozen tally threw it
    if (pinned('TPS_HALTBACK')) DOORTOOLS.haltBack = String((globalThis as any).process?.env?.TPS_HALTBACK ?? '') === '1';   // a pair halted on a door the other pair is charging steps back off it (src/game/doortools.ts haltBack): off, so every frozen probe's halted pair stands where it stood; TPS_HALTBACK=1 raises it
    if (pinned('TPS_BEHINDSAM')) DOORTOOLS.behindSam = String((globalThis as any).process?.env?.TPS_BEHINDSAM ?? '') === '1';   // Sam beyond a door counted as one of ours by the squad's own stun can (src/game/doortools.ts samBehind): off, so the word at a held door bangs its pockets wherever he stands, as every frozen probe and digest was made; TPS_BEHINDSAM=1 raises it
    if (pinned('TPS_TOSSMATE')) DOORTOOLS.tossMate = String((globalThis as any).process?.env?.TPS_TOSSMATE ?? '') === '1';   // a bang and clear asking about teammates again as the can leaves the hand (src/game/doortools.ts mateBehind): off, so a can goes into a room a pair entered since the row was given, as every frozen probe and digest was made; TPS_TOSSMATE=1 raises it
    if (pinned('TPS_PODFRAMES')) DOORTOOLS.podFrames = String((globalThis as any).process?.env?.TPS_PODFRAMES ?? '') === '1';   // no entry point dealt in another door's frame (src/game/doortools.ts inFrame): off, the points every frozen run walked to; TPS_PODFRAMES=1 raises it
    if (pinned('TPS_THRHAND')) DOORTOOLS.thrHand = String((globalThis as any).process?.env?.TPS_THRHAND ?? '') === '1';   // a threshold's can only from a hand at the door (src/game/doortools.ts thrHand): off, the thrower every frozen run had; TPS_THRHAND=1 raises it
    if (pinned('TPS_THRNOCAN')) DOORTOOLS.thrNoCan = String((globalThis as any).process?.env?.TPS_THRNOCAN ?? '') === '1';   // the can's wait spent with nobody at the door: no can (src/game/doortools.ts thrNoCan; acts only under thrHand): off, the can as every frozen run threw it; TPS_THRNOCAN=1 raises it
    if (pinned('TPS_THRDOORSLEAF')) DOORTOOLS.thrDoorsLeaf = String((globalThis as any).process?.env?.TPS_THRDOORSLEAF ?? '') === '1';   // a man left on another door is put where its own open leaf does not hide it, while there is such floor (src/game/doortools.ts thrDoorsLeaf): off, the posts as every frozen run had them; TPS_THRDOORSLEAF=1 raises it (with ONEWAY=1: it asks nothing of a double-acting leaf)
    if (pinned('TPS_THRFRAGHOLD')) DOORTOOLS.thrFragHold = String((globalThis as any).process?.env?.TPS_THRFRAGHOLD ?? '') === '1';   // a threshold waits for its men who ran from a grenade (src/game/doortools.ts thrFragHold): off, the hold and the pockets as every frozen run had them; TPS_THRFRAGHOLD=1 raises it
    if (pinned('TPS_FRAGHOLD')) DOORTOOLS.fragHold = String((globalThis as any).process?.env?.TPS_FRAGHOLD ?? '') === '1';   // every door order waits for its men who ran from a grenade before its door is opened (src/game/doortools.ts fragHold): off, the orders as every frozen run had them; TPS_FRAGHOLD=1 raises it (a word for this rule alone: the page's ?fraghold=0 puts the threshold's half off with it, here that is TPS_THRFRAGHOLD=0)
    if (pinned('TPS_SIDEKICK')) DOORWAY.sideKick = String((globalThis as any).process?.env?.TPS_SIDEKICK ?? '') === '1';   // a boot from beside the latch jamb (src/game/doors.ts kickSpotSide): off, every kick from the square spot; TPS_SIDEKICK=1
    if (pinned('TPS_KICKGLASS')) DOORWAY.kickGlass = String((globalThis as any).process?.env?.TPS_KICKGLASS ?? '') === '1';   // … never from in front of a pane (src/game/doortools.ts bootSpot): off, the side spot wherever there is floor; TPS_KICKGLASS=1
    if (pinned('TPS_DOORSOLID')) DOORWAY.solid = String((globalThis as any).process?.env?.TPS_DOORSOLID ?? '') === '1';   // a leaf pulled open is solid to the player (src/game/doors.ts DOORWAY.solid): off, so the swing passes him, as in every frozen probe, digest and tally; TPS_DOORSOLID=1 raises it
    if (pinned('TPS_HOLECLEAR')) FURN.mouth.on = String((globalThis as any).process?.env?.TPS_HOLECLEAR ?? '') === '1';   // a blown hole is cleared of what stands in its mouths (src/game/furnblast.ts mouth()): off, so every frozen count of what a blast breaks stands
    if (pinned('TPS_SNOWBOG')) SNOWBOG.on = String((globalThis as any).process?.env?.TPS_SNOWBOG ?? '') === '1';   // thrown things bog down in lying snow (src/game/snowBog.ts): off, so a frozen throw on a snow level bounces as it was recorded
    if (pinned('TPS_HOLESNOW')) FURN.mouth.snow = String((globalThis as any).process?.env?.TPS_HOLESNOW ?? '') === '1';   // lying snow in a blown hole's mouths goes too (src/game/furnblast.ts mouthMine): off, so a frozen count of what a blast breaks on a snow level stands
    if (pinned('TPS_HOLEBASE')) FURN.mouth.base = String((globalThis as any).process?.env?.TPS_HOLEBASE ?? '') === '1';   // the bottom layer of a pile a blown hole takes goes too (src/game/furnblast.ts mouth): off, so a frozen count of what a hole leaves is as recorded
    if (pinned('TPS_OWNROOFS')) WX_OWN.roofs = String((globalThis as any).process?.env?.TPS_OWNROOFS ?? '') === '1';   // a level's own night storm under that level's own roofs (src/game/weather.ts syncRoofs): off, so every level is rained on by the office's two rectangles as in every frozen probe; TPS_OWNROOFS=1 raises it
    if (pinned('TPS_WXWIND')) WX_OWN.wind = String((globalThis as any).process?.env?.TPS_WXWIND ?? '') === '1';   // … and that storm's WIND roof by roof (src/game/wind.ts syncField): off, so three or four roofs keep the storm out of their bounding box — no wind in a yard, for a flake or for smoke — as in every frozen probe; TPS_WXWIND=1 raises it
    if (pinned('TPS_GLASSEARS')) GLASS.bothFaces = String((globalThis as any).process?.env?.TPS_GLASSEARS ?? '') === '1';   // a pane's crash heard from both its faces (src/game/glass.ts glassEvent, guards.ts glassHeard): off, so a window shot from outside is heard only from the shooter's side of it, as in every frozen probe; TPS_GLASSEARS=1 raises it
    if (pinned('TPS_DOORSHOT')) DOORSHOT.on = String((globalThis as any).process?.env?.TPS_DOORSHOT ?? '') === '1';   // gunfire splinters a door leaf apart (src/game/doorblast.ts DOORSHOT): off, so a leaf hangs whatever is fired into it, as in every frozen probe, digest and tally; TPS_DOORSHOT=1 raises it
    if (String((globalThis as any).process?.env?.TPS_DOORCOST ?? '') === '0') { DOORSHOT.toll = 1; DOORSHOT.flat = false; }   // … and what shooting one out costs: the module's own twelve rifle rounds at any destruction scale on either stand; TPS_DOORCOST=0 = six, riding the scale, the build as it was (the page's ?doorcost=0)
    if (pinned('TPS_DOORTHROW')) DOORTHROW.on = String((globalThis as any).process?.env?.TPS_DOORTHROW ?? '') === '1';   // a door opened into a man moves and startles him, one slammed or booted throws him (src/game/doors.ts DOORTHROW): off, so a leaf stops against a standing man, as in every frozen probe, tally and digest
    if (pinned('TPS_WALLPEN')) WALLPEN.on = String((globalThis as any).process?.env?.TPS_WALLPEN ?? '') === '1';   // rounds through thin walls and doors (src/game/wallpen.ts): off, so a round stops in the first built thing it meets, as in every frozen probe, digest and tally; TPS_WALLPEN=1 raises it
    if (pinned('TPS_TAKEDOWN')) TAKEDOWN.on = String((globalThis as any).process?.env?.TPS_TAKEDOWN ?? '') === '1';   // takedowns as moves (src/game/takedown.ts): off, so a man taken down falls and lies as every stored digest has him
    if (pinned('TPS_HAUL')) TAKEDOWN.haul = String((globalThis as any).process?.env?.TPS_HAUL ?? '') === '1';   // the choke's haul (character.ts HOLD.haul; a half of TAKEDOWN with a switch of its own): off, so the choke is posed as it was
    if (pinned('TPS_FOOTFALL')) FOOTFALL.once = String((globalThis as any).process?.env?.TPS_FOOTFALL ?? '') === '1';   // one footfall a step (src/game/player.ts): off, so every crossing of the walk cycle's half files one, as on every frozen recording
    if (pinned('TPS_STEALTHPOSE')) STEALTHPOSE.on = String((globalThis as any).process?.env?.TPS_STEALTHPOSE ?? '') === '1';   // stealth poses (src/game/stealthpose.ts): off, so his arms and head are where every stored digest has them
    if (pinned('TPS_HANDWORK')) HANDWORK.on = String((globalThis as any).process?.env?.TPS_HANDWORK ?? '') === '1';   // hands that do the work (src/game/handwork.ts): off, so the breaker flips on the frame, a code runs on its old clock and Sam is not planted at the rack — as every frozen probe and digest read them; `TPS_HANDWORK=1` turns it on
    if (pinned('TPS_HANDS')) HANDS.on = String((globalThis as any).process?.env?.TPS_HANDS ?? '') === '1';   // hands on the world (src/game/hands.ts): off, so a body is the ankle drag on its old clock and a door row flings the leaf, as every frozen probe and digest read them; `TPS_HANDS=1` turns it on (the shipped default)
    if (pinned('TPS_WORDS')) WORDS.on = String((globalThis as any).process?.env?.TPS_WORDS ?? '') === '1';   // the dialogue pass (src/game/words.ts): off, so every man says what he said in every frozen probe, digest and session fixture (a bubble's time is its length); `TPS_WORDS=1` turns it on (the shipped default)
    if (pinned('TPS_DOORNAMES')) WORDS.doors = String((globalThis as any).process?.env?.TPS_DOORNAMES ?? '') === '1';   // a door called what its level calls it (src/game/doornames.ts, scenarios.doorNames): off, so every frozen probe's row and call names a door as it did; `TPS_DOORNAMES=1` raises it
    if (pinned('TPS_RADIOHOME')) WORDS.radioHome = String((globalThis as any).process?.env?.TPS_RADIOHOME ?? '') === '1';   // the handler's asides said on the office night only (src/game/words.ts): off, so every frozen run on another level hears her as it did
    if (pinned('TPS_OWNCHARGE')) OWNCHARGE.on = String((globalThis as any).process?.env?.TPS_OWNCHARGE ?? '') === '1';   // the player's own charges (src/game/owncharge.ts): off, so your card has no charge rows and no door offers 'set a charge'
    if (pinned('TPS_GUNSLOTS')) GUNSLOTS.on = String((globalThis as any).process?.env?.TPS_GUNSLOTS ?? '') === '1';   // a primary and a secondary for every man (src/game/gunslots.ts): off, so a card has its one gun row and a teammate one gun
    if (pinned('TPS_KITTREE')) KITTREE.on = String((globalThis as any).process?.env?.TPS_KITTREE ?? '') === '1';   // the gear screen as a tree (src/game/kittree.ts): off, so a card has the rows of the build before and every launcher its five sponge rounds
    if (pinned('TPS_GUNLOOK')) GUNLOOK.on = String((globalThis as any).process?.env?.TPS_GUNLOOK ?? '') === '1';   // each gun its own look, sound and reload (src/game/gunlook.ts): off, so every row is drawn, heard and fed as its stand-in
    if (pinned('TPS_GUNROLES')) GUNROLES.on = String((globalThis as any).process?.env?.TPS_GUNROLES ?? '') === '1';   // a gun used for what it is for (src/game/gunroles.ts): off, so every defender carries the short carbine and no stack, entry, cover deal or trigger reads a man's gun
    if (pinned('TPS_PLANLAY')) PLANLAY.on = String((globalThis as any).process?.env?.TPS_PLANLAY ?? '') === '1';   // X is where the plan is laid (src/game/planlay.ts): off, so 'wait for my word' is the four's door tools' row on every frozen probe; TPS_PLANLAY=1 raises it
    if (pinned('TPS_CONDITION')) CONDITION.on = String((globalThis as any).process?.env?.TPS_CONDITION ?? '') === '1';   // a man's condition (src/game/condition.ts): off, so a blast that leaves a man up folds him for its seconds and then he is as he was, as every frozen probe, digest and tally was recorded
    if (pinned('TPS_PACKSIDE')) PACKSIDE.on = String((globalThis as any).process?.env?.TPS_PACKSIDE ?? '') === '1';   // a long thing on a back that wears a pack stands at the pack's side (src/game/packside.ts): off, so every back box and part mask is what every frozen probe read; looks only, no digest moves either way
    if (pinned('TPS_INHAND')) INHAND.on = String((globalThis as any).process?.env?.TPS_INHAND ?? '') === '1';   // a pistol drawn in the hand, the hand turned onto the aim line (src/game/inhand.ts): off, so every held box and joint palette is what every frozen probe read; looks only, no digest moves either way
    if (pinned('TPS_GUNHAND')) GUNHAND.on = String((globalThis as any).process?.env?.TPS_GUNHAND ?? '') === '1';   // a move keeps to the hand that is free (src/game/gunhand.ts): off, so every pose a frozen probe read is the pose it read
    if (pinned('TPS_AUTOPILOT')) AUTOPILOT.on = String((globalThis as any).process?.env?.TPS_AUTOPILOT ?? '') === '1';   // B is the squad's autopilot (src/game/autopilot.ts): off, so the quick key is the target's first row on every frozen probe; TPS_AUTOPILOT=1 raises it
    if (pinned('TPS_SQUADTHROW')) SQUADTHROW.on = String((globalThis as any).process?.env?.TPS_SQUADTHROW ?? '') === '1';   // frags and stun canisters thrown on order (src/game/squadthrow.ts): off, so the floor's menu has no 'throw' row
    if (pinned('TPS_SQUAD40')) SQUAD40.on = String((globalThis as any).process?.env?.TPS_SQUAD40 ?? '') === '1';   // a teammate's 40 mm grenade fired on order (src/game/squad40.ts): off, so the throws' page has no such row whatever a card carries
    if (pinned('TPS_BIGSLOT')) BIGSLOT.on = String((globalThis as any).process?.env?.TPS_BIGSLOT ?? '') === '1';   // the big slot (src/game/kit.ts BIGSLOT): off, so the shotgun is a weapon row, a wall charge is pouches, and nobody carries a hammer
    if (pinned('TPS_KITMORE')) KITDEAL.more = String((globalThis as any).process?.env?.TPS_KITMORE ?? '') === '1';   // (…and its key `more`: off, so three or four as issued come with every big slot empty and the Quiet kit's fourth man with his pistol alone)
    if (pinned('TPS_KITSTEALTH')) KITDEAL.stealth = String((globalThis as any).process?.env?.TPS_KITSTEALTH ?? '') === '1';   // (…and its key `stealth`: off, so a stealth mission hands its sponge rounds, cameras and wand over your card and a sponge round costs a pouch)
    if (pinned('TPS_ISSUEWHOLE')) ISSUE.whole = String((globalThis as any).process?.env?.TPS_ISSUEWHOLE ?? '') === '1';   // a mission's own card for you is the whole kit (src/game/kit.ts ISSUE.whole): off, so a quiet kind's sponge rounds and a fog's cameras and wand are handed over it
    if (pinned('TPS_KITDEAL')) KITDEAL.on = String((globalThis as any).process?.env?.TPS_KITDEAL ?? '') === '1';   // the squad's kit dealt over the men who come (src/game/kit.ts KITDEAL): off, so with three or four teammates the first two carry all of it
    if (pinned('TPS_PEEKSIGHT')) PEEKSIGHT.on = String((globalThis as any).process?.env?.TPS_PEEKSIGHT ?? '') === '1';   // a peek round the end of a wall lifts the fog (src/game/peeksight.ts): off, so the fog's eye stays over his feet
    if (pinned('TPS_WAND')) WAND.on = String((globalThis as any).process?.env?.TPS_WAND ?? '') === '1';   // the optical wand (src/game/wand.ts): off, so your kit card has no such row and no door offers the look
    if (pinned('TPS_WANDMATE')) WAND.mate = String((globalThis as any).process?.env?.TPS_WANDMATE ?? '') === '1';   // a teammate's wand, used on order (src/game/wandorder.ts): off, so no teammate's card has the row and no door's menu the order
    if (pinned('TPS_WANDQUICK')) WAND.quick = String((globalThis as any).process?.env?.TPS_WANDQUICK ?? '') === '1';   // the wand's quick set-up (src/game/wand.ts `quick`): off, so the lens is through after the 1.5 s feed and its row draws the ring
    if (pinned('TPS_STICKY')) STICKY.on = String((globalThis as any).process?.env?.TPS_STICKY ?? '') === '1';   // sticky cameras (src/game/stickycam.ts): off, so your kit card has no such row and the rifle's launcher no third load
    if (pinned('TPS_CAMTAKE')) STICKY.take = String((globalThis as any).process?.env?.TPS_CAMTAKE ?? '') === '1';   // a stuck camera taken back onto the launcher (stickycam.ts takeCam): off, so a camera sent stays on its wall
    if (pinned('TPS_OVERHEARD')) CUES.overheard = String((globalThis as any).process?.env?.TPS_OVERHEARD ?? '') === '1';   // a hidden defender's shout as a row on the strip (src/game/cues.ts overheard): off, so a shout nobody sees is no row
    if (pinned('TPS_CAMMARK')) STICKY.mark = String((globalThis as any).process?.env?.TPS_CAMMARK ?? '') === '1';   // his own stuck cameras shown in the fog of war (stickycam.ts stickyMarks): off, so a camera on floor nobody sees is not in the picture
    if (pinned('TPS_WORKTHINGS')) WORK.on = String((globalThis as any).process?.env?.TPS_WORKTHINGS ?? '') === '1';   // a teammate works a thing (src/game/workthings.ts): off, so the menu on the breaker is the floor's and lighting.ts deals the breaker errand as every frozen probe read it; `TPS_WORKTHINGS=1` turns it on
    if (pinned('TPS_UNSEEN')) UNSEEN.on = String((globalThis as any).process?.env?.TPS_UNSEEN ?? '') === '1';   // a squad nobody has found sneaks when Sam sneaks (src/game/unseen.ts): off, so teammates beside a crouched, slow or wall-hugging Sam stand, walk and shoot as in every frozen probe and digest; `TPS_UNSEEN=1` runs any tool with it on, tools/qa/unseen-probes.ts raises it itself
    if (pinned('TPS_HOLDFIRE')) HOLDFIRE.on = String((globalThis as any).process?.env?.TPS_HOLDFIRE ?? '') === '1';   // an unfound squad never fires first (src/game/holdfire.ts): off, so a loud teammate shoots the first man he has a line to, as in every frozen probe, tally and digest; `TPS_HOLDFIRE=1` runs any tool with it on, tools/qa/holdfire-check.ts raises it itself
    if (pinned('TPS_SILENTSET')) SILENT.stackSet = String((globalThis as any).process?.env?.TPS_SILENTSET ?? '') === '1';   // a silent man held on a man, on his stack mark, is stacked (src/game/silent.ts silentOnMan): off, so a silent stack beside unaware men reads 'stacking' and never says 'set.', as in every frozen probe; `TPS_SILENTSET=1` runs any tool with it on, `probes.ts silent-set` raises it itself
    if (pinned('TPS_STACKROOM')) STACKROOM.on = String((globalThis as any).process?.env?.TPS_STACKROOM ?? '') === '1';   // a door stack keeps every man inside the room (src/game/stackroom.ts): off, so every door order deals the marks every frozen probe and digest was recorded on; `TPS_STACKROOM=1` turns it on (the shipped default)
    if (pinned('TPS_TOOLNEAR')) HANDLE.toolNear = String((globalThis as any).process?.env?.TPS_TOOLNEAR ?? '') === '1';   // a door order's lead works the handle from past the latch jamb (src/game/handleside.ts nearStand): off, so he walks to the handle's place in front of the opening as every frozen probe's lead did; TPS_TOOLNEAR=1 raises it
    if (pinned()) SILENT.on = false;                   // the squad's silent / loud order (src/game/silent.ts): off the menu and off the squad block, which is what every older menu probe and frozen digest was written against — `probes.ts silent` turns it on (the shipped default)
    const genv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
    if (glassFxForced() !== true && !/^(on|shipped)$/i.test(genv.GLASSPARTS ?? (pinned() ? '' : 'shipped'))) { game.tune.glassBreak = false; game.tune.glassShards = false; glassPenHarness(); }   // GLASS (src/game/glass.ts GLASSFX): the parts off — a pane a starred wall — as when every frozen digest and tally was recorded; their probes turn them on by name, and GLASSFX=on stands the whole of it as shipped (GLASSPEN=off / GLASSBREAK=off / GLASSSHARDS=off then take one part back out)
    else {   // (GLASSPARTS=shipped: the parts left as the page ships them whatever the master switch says — with GLASSFX=off that is the page under ?glassfx=0, the stand-up the off-equals-the-base runs are made on)
      const env = genv; const off = (v?: string) => /^(0|off|false|no)$/i.test(v ?? '');
      if (off(env.GLASSBREAK)) game.tune.glassBreak = false;
      if (off(env.GLASSSHARDS)) game.tune.glassShards = false;   // (the falling-glass model alone out: the fracture model's stand-in boxes take its fragments)
    }
    if (pinned()) FRAG.defenders = false;              // the defenders' own frag grenades (src/game/frag.ts fragThrowTick): nobody on their side carries one, which is the room fight every older probe, tally and frozen digest was recorded against — `probes.ts frag` and the play-through's --set '{"FRAG":{"defenders":true}}' turn them on (the shipped default is ON)
    if (pinned('TPS_FLEEWISE')) FRAG.fleeWise = String((globalThis as any).process?.env?.TPS_FLEEWISE ?? '') === '1';   // nobody runs onto a live grenade (src/game/frag.ts FRAG.fleeWise): off, so a man's flee is scored and dealt as in every frozen probe, tally and digest; `TPS_FLEEWISE=1` turns it on (the shipped default)
    if (pinned('TPS_FLEEMATES')) FRAG.restProps = FRAG.fleeApart = FRAG.fleeOnto = FRAG.fleeSam = FRAG.fleeLook = String((globalThis as any).process?.env?.TPS_FLEEMATES ?? '') === '1';   // the mends to that flee (src/game/frag.ts FRAG.restProps / fleeApart / fleeOnto / fleeSam / fleeLook): off, so the rest guess asks the walls alone and a leg may end in a mate's corner, as in every frozen probe and digest; `TPS_FLEEMATES=1` turns them all on (the shipped default; they act only with TPS_FLEEWISE=1)
    if (pinned('TPS_FLEEDOOR')) FRAG.fleeDoor = String((globalThis as any).process?.env?.TPS_FLEEDOOR ?? '') === '1';   // out by the open door (src/game/frag.ts FRAG.fleeDoor): off, so a man caught with no cover is dealt the one straight leg inside the room
    if (pinned('TPS_WALLFLEE')) FRAG.wallFlee = String((globalThis as any).process?.env?.TPS_WALLFLEE ?? '') === '1';   // a wall the burst would open is no cover to the flee (src/game/frag.ts FRAG.wallFlee): off, so only the walls as they stand and the door leaves count
    if (pinned('TPS_DOWNKILL')) FRAG.downKill = String((globalThis as any).process?.env?.TPS_DOWNKILL ?? '') === '1';   // a burst kills a man who is down and breathing (src/game/frag.ts FRAG.downKill): off, so a blast passes over every man already down
    if (pinned('QA_DOORSTAY')) DOORSTAY.on = false;                 // doors stay where they are left (src/game/doors.ts): every leaf has its closer, which is what every older probe, frozen digest and session fixture was staged against — `probes.ts stay-open` and playthrough.ts turn it on (the shipped default); QA_DOORSTAY=1 turns it on for any harness run
    game.director.strict = true;         // the level script (src/game/director.ts): a beat that throws fails its PROBE — in the page it fails the beat and the frame goes on
    kitSoloStand(game);                  // the solo night's Sam (src/game/kit.ts): under the SHIPPED stand a game stood up plain wears your card as the page's ?solo does; the frozen stand: this line does nothing
  }
  if (HOUR.id !== 'night') applyHour(game, HOUR.id);   // the visit's hour (?hour= / PT_HOUR — src/game/hours.ts) laid over the level's own night; night = this line does nothing
  const cam = new FollowCamera(); cam.target = v3.copy(level.playerSpawn);
  return { game, level, ch, smoke, cam };
}
