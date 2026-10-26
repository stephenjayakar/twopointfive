import { kitViewOn, kitViewStart, kitViewFatal, kitViewQuietOf, type KitView } from './host/kitView';   // (FIRST on purpose: under ?kitview its load makes this window's storage read-only before any module below reads or writes a store — it imports no module at run time, so nobody's load order changes)
import { Menu, loadSandbox, bootCard } from './ui/menu';
import { optionsOpen, openOptions, walkInNow } from './ui/options';
import { LOADBRIEF, loadBrief } from './ui/loadbrief';
import { CMDRING } from './game/cmdring';   // (a prototype: with the orders ring on, Tab is its key and nothing else's)
import { TABKEY, tabFromQuery, tabSettle, tabNow } from './ui/tabkey';
import { tabCardOf, tabCardHtml } from './ui/tabcard';
import { bootTextSize } from './ui/textsize';
import { BACKKEY } from './game/backkey';
import { loadoutFromQuery, wireMissions } from './ui/loadout';
import { sneakLabAsked, sneakLabBoot, sneakLabFrame } from './host/sneaklab';
import { fireLabAsked, fireLabBoot, fireLabFrame } from './host/firelab';
import { kitSoloIf, kitFresh, kitShow, kitPlayer, kitGun, kitLessonPage, kitLoad, kitRows, KIT, ISSUE, SUITS, TRIMS } from './game/kit';
import { kitBoot } from './ui/kitPreview';
import { missionsBusy, reopenMissionsAfterLoad, openMissionsIfAsked, OFFLIST_UI } from './ui/missions';
import { START_PAGE, startPage, openStartPage, openList } from './ui/startpage';
import { setFigureCast } from './ui/kitFigure';
import { PICKS, PICKS_UI, pickRedirect, pickQuitSearch, pickOfQuery, pickHref } from './scene/picks';
import { initGpu, showFatal, pipelineProgress, gpuStory, pipeQueue } from './gpu/device';
import * as boot from './ui/boot';
import { rigTable } from './render/sdfrig';
import { rigDebugTrace } from './render/rigDebug';
import { Engine } from './engine';
import type { HostApi } from './host/api';
import type { IrradianceProbe } from './render/probe';
import { buildLevel, buildBundledLevel, bootedLocalLevel, withOfficeScript, isOfficeFamily, OFFICE_DATA, OFFICE_SCENARIOS } from './scene/level';
import { loadLevel, levelFileOf, levelNameOf } from './scene/levelLoad';
import { parseLevelData, type LevelData } from './scene/levelData';
import { kitViewSetLevel, kitViewAddLevel, kitViewWayOfLink, kitViewSetQuery, kitViewSetDress } from './host/kitViewSet';   // (pure, no game module: ?kitview's bespoke set, laid over the level's file before it is built)
import { KITANIM } from './game/kitanim';   // (written once, in ?kitview's own window on a quiet mission's set: where the rifle hangs — host/kitViewSet.ts kitViewSetDress)
import { Input } from './game/input';
import type { FollowCamera } from './game/camera';
import { standGame, populateHost } from './host/standup';
import { pageSwitches } from './host/profile';
import { LOOK, LOOK_DOORS, lookLevelFile, placeOfQuery, setLookPlace, setSuitAs } from './scene/look';
import { lookTidy, lookDoors } from './scene/lookTidy';
import { stepFrame, showCaption, FIXEDSTEP, type LoopCtx } from './host/loop';
import { bindFindMe, watchCtrlTaps, FINDME, setFindMe } from './host/findme';
import { findMeOutline } from './ui/findme';
import { planRings, setPlanRings } from './ui/planlook';
import { makeOutlineFrame } from './render/outline';
import { SavePicture } from './render/savepic';
import { SAVEPIC } from './host/savepic';
import { TWEEN, Tween } from './host/tween';
import { v3, Vec3, quat } from './math/vec';
import { loadCharacterSet, castUrlFor } from './anim/gltf';
import * as charMatsMod from './render/charMaterials';
import * as charLookMod from './game/charLook';
import { scenePrelude, traceConfig, commonSource, glassBreakConfig, weatherKindConfig, weatherEdgeConfig, weatherVolConfig, rainShadowConfig, rainScaleConfig, rainWallsConfig, bounceWallsConfig, reflWallsConfig, snowConfig, snowLookConfig } from './render/frame';
import { smokeGridConfig } from './smoke/smokeGrid';
import * as cutMod from './scene/cut';
import { cutConfig, initCutSwitch, type CutPlane } from './scene/cut';
import { ROUND, ROUND_STATS, roundConfig } from './scene/round';
import { cutSwap } from './render/cutSwap';
import { makeBox, BoxFlag, MKEY } from './scene/boxes';
import { GLASSBREAK, GB_STATS, glassBreakPersisted, glassBreakLive, saveGlassBreak } from './game/glassbreak';
import { SHARDS, SHARD_STATS, shardsLive, saveShards } from './game/shards';
import lightingCommonSrc from './render/shaders/lighting_common.wgsl' with { type: 'text' };
import { setDaylight, isDaylight } from './game/lighting';
import { Game } from './game/game';
import { SQUADTHROW, SQUADTHROW_STATS, squadThrowPlan, squadThrowPlans } from './game/squadthrow';
import { AUTOPILOT, AUTOPILOT_STATS, autoPick } from './game/autopilot';
import { PLANLAY, PLANLAY_STATS, laySummary, laySend, layClear } from './game/planlay';
import { PAIRUP, PAIRUP_STATS, pairUpApply, pairUpSummary } from './game/pairup';
import { SILENT, squadSilent } from './game/silent';
import { DESTRUCTION, FURNBLAST, RUBBLE, BLAST_PACE } from './game/destructionSwitch';
import { LIFE, FEET, setTurn } from './game/character';
import { killGuard, fireWeapon, firearmOf, LASER } from './game/combat';
import { WEAPONS } from './game/weapons';
import { Overlay } from './ui/overlay';
import { Bubbles } from './ui/bubbles';
import { SmokeSystem } from './smoke/smoke';
import { Panel } from './ui/panel';
import { AudioEngine, SFX_TABLE, SFX_WARM, warmSfx, warmState } from './audio/audio';
import { setlistOfQuery, setlistOf, setlistLevel } from './audio/setlist';
import { MUSIC } from './audio/pieces';
import { Demo } from './game/demo';
import { REACH_PACE } from './render/reach';
import { PerfRecorder } from './ui/perfrec';
import { PerfSweep } from './ui/perfsweep';
import { Bench, benchView, machineFacts, type BenchScene } from './ui/bench';
import { benchBegin, benchLegOfPage, BENCH_RUN_KEY } from './ui/benchrun';
import { BENCH_SCENES } from './host/benchScenes';
import { HandsOff } from './host/handsoff';
import { oneAirFlip, wispMotesFlip } from './ui/sweepSnow';
import { SessionRec } from './ui/sessionrec';
import { ReplayKey } from './ui/replaykey';
import { checkSessionFile, hudExpireBubbles } from './game/journal';
import * as digestMod from './game/digest';
import { requestQrf, callPerimeter, qrfStandDown } from './game/qrf';
import { needsSend, needsTrip, NEEDS, NEEDS_STATS, NEEDS_LOG, type NeedKind } from './game/needs';
import { WOUND, WOUND_STATS, woundedMen } from './game/wounds';
import { WALLSNAP } from './game/wallsnap';
import { SLOTSETUP } from './game/slotsetup';
import { HANDSLOT } from './game/handslot';
import { HANDRING } from './game/handring';
import * as keymap from './host/keymap';
import { GEAR } from './game/gear';
import { civPanic, setCivilians, CIV, CIV_STATS, CIV_LOG, civSpots, checkCivSpots } from './game/civilians';
import { Attract } from './game/attract';
import { startFromQuery, quitScenario, runningScenario, plainFog, refusalWords, teamOf } from './game/scenarioRun';
import { sideOf } from './game/orders';   // (in game/game.ts's cycle, loaded above: no load order moves)
import { LIGHTSWITCH, LIGHTSWITCH_STATS, wallSwitches, switchLit } from './game/lightswitch';
import { CARLAMPS, CARLAMPS_STATS, VEHICLE_GROUP } from './game/carlamps';
import { CLEANRESTART, CLEANRESTART_STATS } from './game/cleanrestart';
import { SQUAD40, SQUAD40_STATS, SQUAD40_LOG, squad40Left, squad40Brought, squad40Of, squad40Plans, squad40Stage, squad40Summary } from './game/squad40';
import { squadSmokeStage } from './game/squadsmoke';   // (the same: game/kit.ts has loaded it)
import { checkQuiet } from './game/quiet';
import { LESSON, LESSON_STATS, checkLesson } from './game/lesson';
import { PAR, type ParResult } from './game/par';
import { parBest } from './ui/parBest';
import { VERDICT } from './game/verdict';
import { verdictKey, recordOf, tryStarted, runEnded, APPROACHES, type MissionRecord } from './ui/verdictStore';
import { watchMissionRows } from './ui/verdictRows';
import { SOLO_ID } from './scene/picks';
import { SNATCH, checkSnatch } from './game/snatch';
import { SNATCHOUT } from './game/snatchout';
import { SCENARIOS, ALL_MISSIONS, LESSON_MISSIONS, pickSearch, quitSearch } from './scene/scenarioList';
import { lessonGroup } from './scene/scenarios';
import { COVER } from './game/cover';
import { ROOMFIT } from './game/roomfit';
import { DOORSTAY, DOORWAY } from './game/doors';
import { HANDLE, HANDLE_STATS } from './game/handleside';
import { DOORMANNERS } from './game/doorway';
import { initDifficulty, difficultyNow, keptLevers } from './game/difficulty';
import { initWeather, WX_OWN, WEATHER_BOOT, snowLevelOfQuery, SNOW_LOOK } from './game/weatherKinds';
import { SNOW_SURF, snowCfgRows } from './render/snowField';
import { SNOWTRACKS, TRACK_RES } from './game/snowTracks';
import { rowSettings } from './game/rowset';
import { HOUR, HOURS, HOUR_IDS, initHour, applyHour, hourOf, hourSummary, hourLightAt, setSunStrength, sunStrength, sunToCloud, hourSun, hourWorldChanged } from './game/hours';
import { lightEstimateAt } from './game/guards';
import { STRESS, standExtra, stressTick, stressSummary, extraSpots } from './game/stress';
import { Quality, QUALITY_NAMES, QualityName, ladderAimOf, smokeKeepOf, rtVeto, p5Veto, sharpForce, gbaaForce, iqForce, gimVeto, froxelVeto, froxelForce } from './ui/quality';
import { buildPanel } from './ui/bindings';
import { SceneTweak } from './ui/sceneTweak';
import { sceneLayers } from './ui/sceneLayers';
import { frameCanvas, postShot } from './ui/capture';
import { reachBinding } from './render/frame';
import { decalDebug } from './render/decals';
import { sprayTestPattern, sprayRandom, bangScorch, kickScuff } from './game/marks';
import { testBurst } from './game/particleFx';
import type { PKind, EmitOpts, ImpulseOpts } from './render/particles';
import * as glassMod from './game/glass';
import { resetGlassPen } from './game/glasspen';
import * as doorBlastMod from './game/doorblast';
import * as wetMod from './game/wet';
import * as rainMod from './game/rainFx';
import * as snowMod from './game/snowFx';
import * as fireMod from './game/fire';
import * as snowBlastMod from './game/snowBlast';
import { SNOWMARKS } from './game/snowMarks';
import { SNOWBOG } from './game/snowBog';
import * as airMod from './game/airSim';
import { AIR } from './render/airField';
import * as breathMod from './game/snowBreath';
import * as destrMod from './game/destruction';
import * as windMod from './game/wind';
import { DOZE, DOZE_STATS, DOZE_LOG, dozeOf, dozeSummary, dozeAsleep, dozeAt } from './game/doze';
import { CLOSE, CLOSE_STATS, CLOSE_LOG, closeAt, closeWindows, closeMarks, closeSeat, closeUnseat, closeSeated, closeSummary, closeMode } from './game/close';
import * as mothsMod from './game/moths';
import * as saveMod from './game/savestate';
import { PICTURE, PICTURE_STATS, pictureSummary, pictureViews, pictureTell, ideasOf } from './game/picture';
import { RUNNER, RUNNER_STATS, runnerOf, runnerBreak } from './game/runner';
import { knobRegistry, knobsCopy, knobsBack } from './game/knobs';   // (last on purpose: every game module above is already loaded, so this import changes nobody's load order)
import type { Gpu } from './gpu/device';
import { PLAYTAPE, tapeFromUrl } from './replay/engineplay';
import { soundLanes } from './replay/soundlanes';

/** The top-left GPU / pass / guard read-out: opt-in in play (persisted), always off during the tour. */
const readout = { on: localStorage.getItem('twopointsix.readout') === '1', set(v: boolean) { this.on = v; try { localStorage.setItem('twopointsix.readout', v ? '1' : '0'); } catch { /* */ } } };
(window as any).__readout = readout;

// THE READINESS CONTRACT for scripts: `await window.__ready` — a Promise that exists from this module's first tick and resolves once the boot has finished (every kernel compiled,
// the Game built, EVERY automation hook below assigned, the start card live); it rejects if the boot dies. The hooks themselves (__engine, __game, __runFrames …) are only put
// on window at that point, so the older wait loops that poll for them + #view.clientWidth stay correct. window.__boot has the boot's timeline (ui/boot.ts).
let readyResolve!: () => void, readyReject!: (e: unknown) => void;
(window as any).__ready = new Promise<void>((res, rej) => { readyResolve = res; readyReject = rej; });
(window as any).__ready.catch(() => { /* surfaced by main().catch → the fatal card */ });
boot.expose();

async function main() {
  const q = new URLSearchParams(location.search);
  keymap.KEYMAP.handWhen = () => HANDRING.on;   // (…and his own actions on the key that leaves spare, the whistle's row with no key: host/keymap.ts HAND, the rule game/handring.ts)
  keymap.KEYMAP.slotWhen = () => HANDSLOT.on;   // (empty hands are a slot on backtick, the debugger on backslash, E spare: host/keymap.ts SLOT, the rule game/handslot.ts)
  keymap.KEYMAP.freeWhen = () => WALLSNAP.on && walkInNow();   // (the wall hold's row has no key while walking into a wall takes it: host/keymap.ts qFree)
  keymap.KEYMAP.setWhen = () => SLOTSETUP.on;   // (…and the selector's and the light's while a gun's key again opens its setup: host/keymap.ts setFree)
  keymap.keysBoot(q);   // the player's own keys (host/keymap.ts): live on this page from before anything is drawn; ?keybinds=0 = the build's
  bootTextSize(q, kitViewOn);   // the page's words at the window's size, the browser's zoom keys the game's (ui/textsize.ts; ?textsize=0 = the page as it was) — before anything is drawn
  // `?pick=<id | place>` alone (scene/picks.ts): a link to a row of the short list that stays right when the row's settings change — answered with ONE replace to
  // the row's own URL before anything boots (that URL names its mission, so it is never answered twice). Off under ?nopicks.
  { const to = PICKS_UI.on ? pickRedirect(location.search) : null; if (to !== null) { location.replace(location.pathname + to + location.hash); return; } }
  // `?bench` (ui/benchrun.ts): the benchmark asked for on the address — the way in for a machine nobody here can sit at. Its first scene is a mission's own page, so the
  // page goes there BEFORE anything boots: that scene's load is then this machine's first, and it is the one the report times. Never in ?kitview's own window.
  let benchRefused: string | null = null;
  if (q.has('bench') && !q.has(BENCH_RUN_KEY) && !kitViewOn) { benchRefused = benchBegin(false); if (benchRefused === null) return; console.info(`benchmark: ${benchRefused}`); }   // (a refusal — a tab with no session store — is said on the HUD's line once the page is up)
  // `?playtape=<shelf id | file>` (replay/engineplay.ts): a saved replay played on THIS page — the real renderer and mixer — off its run tape. The page is first sent to
  // the tape's own query (so this boot is the recording's boot); `tape` then lays the tape's knob tables and kit over this machine's at each point below. Absent = nothing.
  const tapePlay = q.has(PLAYTAPE) ? await tapeFromUrl(q) : null; if (tapePlay === 'moved') return;
  const tape = tapePlay && !tapePlay.refuse ? tapePlay : null;
  pageSwitches(q);   // the switches this boot writes from the URL — the destruction goal's (?nodestruction ?nofurnblast ?nowallreact ?nocoverfire ?nowallcharge ?wallmenu=direct) and the room entry's door walk (?nodoorpath ?doorpath=0|gun) — in src/host/profile.ts, which the QA harness's shipped stand calls too with an empty query: one function, so the two cannot drift. Before the level loads (the destruction's dressing)
  setLookPlace(placeOfQuery(q));   // the men's dress follows the place (scene/look.ts): on the office family the first cast and its tables, dressed for a building — said before the cast is fetched below
  OFFLIST_UI.on = q.get('offlist') !== '0';   // the rows cut from the mission list are drawn on no list (ui/missions.ts listedMissions; ?offlist=0 = every row drawn, as before the cut)
  LOADBRIEF.on = q.get('loadbrief') !== '0';   // a mission's page loads behind that mission's brief and waits for the player's Start (ui/loadbrief.ts; ?loadbrief=0 = the boot card and the straight start, as before)
  wireMissions();   // one flow: a pick on the mission list is the loadout screen, whose Deploy is the page load (ui/loadout.ts)
  kitBoot(q);   // each member's kit and uniform read from this machine's store; ?kit = the cards' preview (ui/kitPreview.ts, game/kit.ts)
  const lessonRow = LESSON_MISSIONS.find(e => e.level === q.get('levelFile')) ?? null; kitLessonPage(lessonRow && lessonGroup(lessonRow.group) ? lessonRow : null);   // …but a TRAINING level is played with the kit AS ISSUED (game/loadout.ts kitAsIssued): the page names its lesson's row (kit.ts kitLessonPage) and every staging on it puts the issue cards on the men — all but the one lesson he packs for (kit.ts ISSUE.picked), whose stagings wear the kept cards —, since a lesson's steps ask for the issue kit's own things (a card with no rifle left 'press 2' a step that could never pass; your own four counts stay what a Player is built with — the kit lesson throws more than the one of each the pouches rule issues). The table and the store stay this machine's: the lesson neither wears nor writes the kept cards, and the loadout screen opened from this page for ANOTHER mission shows and keeps them
  tape?.tables();
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const loading = document.getElementById('loading')!;
  // The start card's look-alike goes up FIRST (menu.ts bootCard: the real layout with Start / Tour / Breach disabled and a status line), so the visitor reads the controls while the
  // GPU process compiles the renderer's ~100 kernels on its worker threads (engine.init below — gpu/device.ts has why they must never be compiled synchronously); the real Menu
  // re-renders over it, buttons live, when everything is ready. `tick()` yields to the event loop between the CPU-heavy phases so the card and its status line actually paint.
  // THE DIFFICULTY SWITCH (game/difficulty.ts) before the card paints its row: the level this machine keeps, then ?hard / ?hard=0 / ?difficulty=hard|standard for
  // the visit, then ?pressure / ?pressure=0 and ?digin — the two tables under the switch (game/pressure.ts, game/digin.ts) one at a time — over that
  initDifficulty(q, lessonGroup(lessonRow?.group));   // (…and the LEVERS this machine keeps over the level — fog of war, enemy AI, enemy kit — but not on a Training lesson's page: it is taught on the level as it is)
  if (q.has('noverdict')) VERDICT.on = false;   // ?noverdict: no verdict at a run's end — the end card as it was, no tries or ways kept (game/verdict.ts reads only: the run is the same either way)
  watchMissionRows();   // each mission's card on the start page shows the ways it has been won (ui/verdictRows.ts: this machine's record at the difficulty picked; none under ?noverdict) — here, before the boot card paints: the start page is live long before the renderer is
  { const n = parseInt(q.get('smokepool') || q.get('sparsesmoke') || '', 10); if (n >= 256) smokeGridConfig.cap = Math.min(8192, Math.ceil(n / 256) * 256); }   // ?smokepool=N: the smoke solver's pool in bricks (smoke/smokeGrid.ts; 4096 ships) — buffer sizes and shader constants, so it is read at boot. (?sparsesmoke[=N] = the flag the pool was tried behind: still read for its N, otherwise nothing)
  rowSettings(q);   // a mission row's own hour and weather (game/rowset.ts; ScenarioEntry.hour / weather: a tutorial level is built for them) written over this visit's query, never the address — ?rowset=0 = the link's as ever
  if (initWeather(q)) weatherKindConfig.on = true;   // ?weather=<kind> (game/weatherKinds.ts): the weather the level is STARTED in — read before the Game exists (its Weather is born in it); absent = the level as it has always been
  if (snowLevelOfQuery(q)) { WEATHER_BOOT.kind = 'snow'; weatherKindConfig.on = true; snowConfig.on = true; }   // a level BUILT FOR SNOW (game/weatherKinds.ts SNOW_LEVELS; ?snow=0 = not so): the page is that level's for its life, so its weather is snow whatever ?weather= said, and the particle shaders are compiled with the flake's half (render/frame.ts snowConfig)
  if (snowLevelOfQuery(q)) { snowLookConfig.surface = SNOW_LOOK.on; snowLookConfig.wisps = SNOW_LOOK.wisps; snowLookConfig.tracks = SNOW_LOOK.on && SNOW_LOOK.tracks; snowLookConfig.glow = SNOW_LOOK.on && SNOW_LOOK.glow; snowLookConfig.sparkle = SNOW_LOOK.on && SNOW_LOOK.sparkle; snowLookConfig.under = SNOW_LOOK.under; snowLookConfig.grains = (SNOW_LOOK.grains || SNOW_LOOK.oneAir) && airMod.AIR_SIM.on; }   // … and its look (weatherKinds.ts SNOW_LOOK; ?snowlook=0, ?snowwisps=0): the lying snow as one surface, wisps over it — picture only, compiled in at boot like the flakes
  if (WX_OWN.roofs && placeOfQuery(q)) weatherKindConfig.on = true;   // a level of its own shape with no weather picked: its night storm is cut by ITS roofs (game/weather.ts syncRoofs), and a level of three or four roofs needs the shaders' packed-roof reads for the third and fourth (the two plain rectangles carry the first two either way; with nothing packed the reads are dead code)
  WEATHER_BOOT.packed = weatherKindConfig.on;   // (…and where they are not compiled in — the office family, ?ownroofs=0 — the rule stands down: the two rectangles as ever)
  if (q.has('nowallfog')) weatherEdgeConfig.on = false;   // ?nowallfog: a picked weather's fog classed by the surface point alone — outside walls unveiled, the picture as it was (render/frame.ts weatherEdgeConfig)
  if (q.has('flatfog')) weatherVolConfig.on = false;   // ?flatfog: a picked weather's dust / fog as the flat veil composite laid over the outdoors, the picture as it was (render/frame.ts weatherVolConfig; the men's eyes: game/airDust.ts AIRDUST.on, host/profile.ts)
  if (q.has('norainwalls')) rainWallsConfig.on = false;   // ?norainwalls: the rain hidden from every pixel whose surface is inside a roof's rectangle — it stops dead at an outer wall's face and top, as it was (render/frame.ts rainWallsConfig)
  if (q.has('nobouncewalls')) bounceWallsConfig.on = false;   // ?nobouncewalls: the radiance cache read a probe spacing along a man's normal whatever stands there — a man by a lit room's outer wall takes the room's bounce and mirrors its lamps, as it was (render/frame.ts bounceWallsConfig)
  if (q.has('noreflwalls')) reflWallsConfig.on = false;   // ?noreflwalls: a metal's reflection rays read the cache a probe spacing along the hit's normal whatever stands there, as it was (render/frame.ts reflWallsConfig; the picture from before both rules is ?nobouncewalls&noreflwalls: with this one on, a man mirrored in steel takes the walled read whatever the other word says)
  if (q.has('norainscale')) rainScaleConfig.on = false;   // ?norainscale: a splash ring as bright however wide the volumetric pass's texel draws it — blobs on the lit ground with the camera pulled back, as it was (render/frame.ts rainScaleConfig)
  if (q.has('norainshadow')) rainShadowConfig.on = false;   // ?norainshadow: the rain lit by the reach masks alone — through a shut door, through the wall a weapon light is pointed at — as it was (render/frame.ts rainShadowConfig)
  initHour(q);   // ?hour=dawn|midday|overcast|dusk (+ ?sun=0‥1): the level at another hour than its own night (src/game/hours.ts) — standGame lays it over the level; no flag = the level as authored
  tape?.tables();
  const brief = tape || kitViewOn || q.has('paused') || q.has(BENCH_RUN_KEY) ? null : loadBrief(location.search);   // THE LOAD BRIEF (ui/loadbrief.ts): a page that boots a mission of the list shows that mission, not the old card's controls list — never a page nobody sits at (a replay, ?kitview's window, the automation boot, a benchmark's scene)
  const card = brief ?? bootCard(); loading.textContent = '';
  const tick = () => document.hidden ? Promise.resolve() : new Promise<void>(r => setTimeout(r, 0));   // (a hidden pane / background tab services timers about once a second and paints nothing anyway: no yield there)
  await tick();
  const tGpu = performance.now();
  const rigPage = q.has('bench') || q.has(BENCH_RUN_KEY) || navigator.webdriver === true;   // a measurement or a driven page: it keeps its own page and its own timings
  const gpu = await initGpu(canvas, { retry: !kitViewOn && !rigPage, canvasRead: SAVEPIC.on && saveMod.SAVETIMELINE.on && !kitViewOn });   // (a real loss of the device loads this page again — gpu/device.ts GPU_LOST; never the kit picture's window: the start page is told below and draws its standing man; never a benchmark or a driven page, which must see the card)
  if (kitViewOn) void gpu.device.lost.then(() => kitViewFatal());   // (?kitview: the device's own card — gpu/device.ts — is seen by nobody in there: the start page is told there is no picture)
  boot.span('gpu', tGpu); boot.mark('gpu');
  // GPU errors during the boot: every uncaptured error still prints its own console line (gpu/device.ts); this only COLLECTS them until the pipelines are in, so the boot line
  // and __boot.gpuInitErrors can say 'clean' or name them (an error scope would fold N distinct errors into its first and hide them from the console)
  const gpuErr = (ev: Event) => { bootGpuErrors.push((ev as GPUUncapturedErrorEvent).error.message); };
  gpu.device.addEventListener('uncapturederror', gpuErr);
  urlFlagsBeforeEngine(q);
  const engine = new Engine(gpu);
  { const _host: HostApi = engine; void _host; }   // the WebGPU Engine IS a HostApi (src/host/api.ts): the one place the structural conformance is asserted — the game takes the interface
  boot.mark('engine');
  // every boot pipeline, in flight from here (createComputePipelineAsync — resolved when READY, compiled off the thread that composites the browser): the level, the glTF and the Game
  // are built meanwhile and the lot is awaited before the first frame. The sharp-direct trio + GBAA kernel are prepared too unless the URL vetoes them (a preset switches them on at
  // any tier; otherwise they would compile synchronously inside the first frame that wants them).
  const tPipe = performance.now();
  const noSharp = q.has('nosharp') || q.has('noiq') || q.has('notaau');
  const status = () => { gpuStory.stage = `while compiling shaders, ${pipelineProgress.done} of ${pipelineProgress.total}`; card.status(pipelineProgress.total ? `compiling shaders ${pipelineProgress.done} / ${pipelineProgress.total} …` : 'compiling shaders …'); };
  pipelineProgress.onChange = status; status();
  const group = (name: string) => boot.span('pipelines_' + name, tPipe);   // per-group marks: when each module's last pipeline resolved, from the moment the first was requested
  const timed = <T,>(name: string, p: Promise<T> | undefined) => p?.then(v => { group(name); return v; });
  const engineInit = engine.init({ sharp: !noSharp, gbaa: !noSharp || q.has('gbaa'), onGroup: group });
  engineInit.catch(() => { /* awaited below */ });
  sfxSwitches(); (window as any).__sfxWarm = warmState;   // (the table's own switches first: the warm-up makes the table they name)
  if (q.has('bench') || q.has(BENCH_RUN_KEY)) SFX_WARM.on = false;   // (a benchmark's frames are measured: its table is made whole at its click, as it was)
  if (!pageMuted() && !kitViewOn) warmSfx();   // the sounds, a voice at a time in idle moments from here (audio/audio.ts SFX_WARM): the first click no longer makes the whole table
  const tGl = performance.now();   // the mannequin's glTF: fetched + parsed alongside the compiles and the level (it used to wait for both)
  const chP = loadCharacterSet(new URL('assets/ual/AnimationLibrary_Godot_Standard.gltf', document.baseURI).href, castUrlFor(location.search, document.baseURI)).then(c => { boot.span('gltf', tGl); boot.mark('gltf'); return c; });
  chP.catch(() => { /* awaited below */ });
  void chP.then(setFigureCast, () => { /* the menus' figure of a man stays undrawn */ });
  urlFlagsOnEngine(engine);
  let level = await bootLevel(q, engine, tick);

  await tick();
  const ch = await chP;
  const smoke = new SmokeSystem(engine);
  engine.setSmoke(smoke.binding);
  const smokeInit = timed('smoke', smoke.init())!; smokeInit.catch(() => { /* awaited below */ });   // (its kernels join the ones in flight)
  await tick();
  const tGame = performance.now();   // the Game: collision / nav grid / reach masks / the wear map / characters / mesh-shadow trees / props … (main-thread work; the compiles carry on underneath)
  let game: Game, cam: FollowCamera;
  // THE GAME'S OWN DIE (math/dice.ts): ?seed=N plays that seed (the same N and the same inputs roll the same numbers), no flag = a fresh one each visit (read it back
  // as __game.dice.seed), ?seed=off = the game on Math.random as before. A script that puts its own die in Math.random's place still gets the game's dice, as ever.
  const seed = ((): number | null => { const v = q.get('seed'); if (v === 'off') return null; const n = v === null || v === '' ? NaN : Number(v); return Number.isFinite(n) ? n >>> 0 : (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0); })();
  tape?.tables(); tape?.env(engine.settings as never);
  try { ({ game, cam } = await standGame(engine, { level, ch, smoke, populate: false, seed })); }   // the ONE stand-up (src/host/standup.ts) — the world / lights were populated above; the harness and the native entry come through the same call
  catch (e) {   // ?level=local: an editor stash the file validator passed but the game cannot stand on (level.ts bootedLocalLevel) — say so, and boot the bundled office instead of dying on every reload
    if (!bootedLocalLevel) throw e;
    console.error('?level=local: the game could not be built on the editor level — falling back to the bundled office —', e);
    level = buildBundledLevel(); engine.world.statics.length = 0; engine.lights.lights.length = 0;
    populateHost(engine, level); engine.settings.skyZenith = level.sky.zenith; engine.settings.skyHorizon = level.sky.horizon;
    ({ game, cam } = await standGame(engine, { level, ch, smoke, populate: false, seed }));
  }
  boot.span('gameCtor', tGame); boot.mark('game');
  if (LOOK.on) lookDoors(game.doors.list, engine.world.statics, LOOK_DOORS[(q.get('levelFile') ?? '').replace(/-gwot(?=\.json$)/, '')]);   // (picture only: under the default look a level that wears it has its door leaves in its own paint and weathered wood, not the office's veneer — scene/lookTidy.ts)
  if (q.has('noweather')) game.weather.setEnabled(false);   // ?noweather: the storm experiment off from boot (weather.ts) — the plain night, byte for byte
  const probe = game.probe as IrradianceProbe;   // (the game holds a ProbeLike — src/game/sensors.ts; on this host it is the WebGPU kernel the Game built, whose encode / readback the frame drives)
  engine.extraPasses.push((enc, sceneBG, diceView, ts) => { if (probe.hasPending) probe.encode(enc, sceneBG, diceView, ts('probe')); });
  engine.afterSubmit.push(() => probe.afterSubmit());
  engine.afterSubmit.push(() => smoke.afterSubmit());
  // ---- everything the first frame dispatches must exist: the engine's kernels, the smoke solver's, the Game's own three GPU modules (mesh-shadow skin / refit, the particles, the light
  // probe) and the skinned-mesh raster for this glTF's joint format — all compiled off the browser's compositing thread, counted in on the card meanwhile
  await tick(); status();
  await Promise.all([engineInit, smokeInit, timed('meshShadows', game.meshShadows.init()), timed('particles', engine.particles?.init()), timed('probe', probe.init()), timed('skin', engine.gbuffer.prepareSkin(game.chars.jointsFormat))]);
  boot.span('pipelines', tPipe); boot.mark('pipelines');
  pipelineProgress.onChange = null; boot.freezePipelines(); gpuStory.stage = 'while setting up';
  pipeQueue.settle();   // THE COMPILE QUEUE (gpu/device.ts PIPE_QUEUE): from here the background set compiles two at a time, leaving the browser's GPU workers free to draw the page
  void cutSwap.build();   // CUT BOXES (render/cutSwap.ts): the second set of the tracing pipelines — the ones with the cut rule — compiled in the background from here, AFTER the boot's count is frozen (they are not the boot's); nothing waits on it, and a calm frame never dispatches it
  card.status(`${pipelineProgress.done} shaders ready — setting up`);
  gpu.device.queue.onSubmittedWorkDone().then(() => gpu.device.removeEventListener('uncapturederror', gpuErr)).catch(() => { /* device lost: its own card */ });   // (errors from work queued so far still arrive; later ones are the frame's, not the boot's)
  weatherHourHooks(game, smoke);

  const { audio, testMute } = pageAudio(game);
  worldHooks(engine, game, audio);
  const input = new Input(canvas);
  (window as any).__findme = { table: FINDME, set: setFindMe };   // (host/findme.ts: the Options rows for finding your own man, for a page check to move without the screen)
  (window as any).__planlook = { get: planRings, set: setPlanRings };   // (ui/planlook.ts: how strongly plan mode's circles are drawn, for a page check to move without the screen)
  bindFindMe(cam); const ctrlTwice = watchCtrlTaps(window, () => !!input.lockExcept, keymap.camKey);   // (host/findme.ts: the player's kept aim pan onto the follow camera; the camera key tapped twice)
  window.__cam = cam;   // (the follow camera standGame put on the spawn)
  const overlay = new Overlay(); if (tape || q.get('cards') === '0') overlay.cards = false;   // (a replay's tape shows no tutorial card, nor does `?cards=0`: ui/railcard.ts)
  overlay.cardClosed = () => input.focusGame();
  const bubbles = new Bubbles(document.getElementById('overlay')!);
  const demo = new Demo(game, cam, smoke, input); window.__demo = demo;
  // THE DIRECTOR (game/director.ts): level scripting. No shipped level has a script today — the office's two showcases, its only programs, were removed — so it idles, which
  // is the game exactly. It is handed the camera and the input a program would pin and lock; __director is the Director itself (log, run, manifest, problems, start(name), stop(), summary()).
  game.director.attach({ cam, input }); (window as any).__director = game.director;
  squadFlagsAndHooks(q, engine, game);
  // game/demo.ts (the old 13-stop tour) stays in the tree for tools/qa/tour.ts's regression lap: __demo.start() by console, reachable from no button.
  /** END whatever hands-off programme has the floor — the old tour, or a level-script program should a level ever carry one — back to the start card (Esc / P while it runs) */
  const endShow = () => { if (demo.active) demo.stop(); if (game.director.showing || game.director.handedOver) game.director.stop(true); if (menu.mode !== 'start') menu.open('start'); };
  soloNightHooks(game);
  /** whichever hands-off programme is running (the tour, or a showcase program of a level script), for the veil / captions / timeline / hotkeys below — never both:
   *  each refuses to start over the other */
  const show = (): { caption: string; sub: string; fade: number } | null => demo.active ? demo : game.director.showing ? (game.director.frame ?? { caption: '', sub: '', fade: 0 }) : null;
  // WGSL compile check against the live device (Chrome/Tint is the compiler we ship to; naga is not available on this machine):
  // __wgsl(source, { prelude: 'scene' | 'lighting' }) prepends what the scene passes get (world consts + common.wgsl [+ lighting_common.wgsl]),
  // so a worktree's edited pass shader can be checked in seconds without booting its build. Resolves to the compiler messages.
  window.__wgsl = async (code: string, opts: { prelude?: boolean | 'scene' | 'lighting'; label?: string } = {}) => {
    const pre = opts.prelude === 'scene' ? scenePrelude() : opts.prelude ? scenePrelude() + lightingCommonSrc : '';   // 'scene' = what direct/softblur/temporal get; true|'lighting' = + lighting_common (gather, rc, probe, volumetrics)
    const full = pre + code;
    const mod = gpu.device.createShaderModule({ code: full, label: opts.label ?? 'lint' }); const info = await mod.getCompilationInfo();
    const off = pre ? pre.split('\n').length - 1 : 0;
    return info.messages.map(x => ({ type: x.type, line: x.lineNum - off, col: x.linePos, msg: x.message, src: (full.split('\n')[x.lineNum - 1] ?? '').trim() }));
  };
  // __wgslRun(src, inputs, opts?): RUN a WGSL kernel against the live device and read its floats back — a golden-vector recorder's hook (what THIS device computes for pure
  // functions with no CPU reference — AgX, Fresnel / refract, GGX-VNDF, lightWindow / evalLight, the marking cells).
  // The hook prepends the prelude (opts.prelude 'scene' = world consts + common.wgsl [+ the SDF rig], the default; 'lighting' = + lighting_common.wgsl; 'none' = bare) and then
  //   @group(1) @binding(0) var<storage, read> gin: array<f32>;  @group(1) @binding(1) var<storage, read_write> gout: array<f32>;
  // — group 0 is the SCENE group (frame / boxes / lights / …, bound live, so evalLight & co. read the real records; 'none' binds nothing there), group 1 the two arrays.
  // `src` must define `@compute @workgroup_size(1) fn <opts.entry ?? 'main'>(@builtin(global_invocation_id) id: vec3u)` reading gin[…] and writing gout[…] (row i = query i is the
  // caller's convention: id.x = i, inStride / outStride theirs); dispatched opts.n (default 1) workgroups; resolves to a Float32Array of opts.out (default 256) floats. Throws with
  // the compiler messages on a bad module. Renders one unpresented frame first if the scene group does not exist yet (a ?paused boot before its first frame).
  (window as any).__wgslRun = async (code: string, inputs: ArrayLike<number>, opts: { prelude?: 'scene' | 'lighting' | 'none'; entry?: string; n?: number; out?: number; label?: string } = {}): Promise<Float32Array> => {
    const dev = gpu.device; const which = opts.prelude ?? 'scene';
    const pre = which === 'none' ? '' : which === 'lighting' ? scenePrelude() + lightingCommonSrc : scenePrelude();
    const io = '@group(1) @binding(0) var<storage, read> gin: array<f32>;\n@group(1) @binding(1) var<storage, read_write> gout: array<f32>;\n';
    const full = pre + io + code; const label = opts.label ?? 'wgslRun';
    const mod = dev.createShaderModule({ code: full, label }); const info = await mod.getCompilationInfo();
    const off = pre.split('\n').length - 1 + io.split('\n').length - 1;
    const errs = info.messages.filter(m => m.type === 'error'); if (errs.length) throw new Error('__wgslRun: ' + errs.map(m => `${m.lineNum - off}:${m.linePos} ${m.message}`).join(' · '));
    if (which !== 'none' && !engine.sceneBG) engine.render(cam, timeAcc, 1 / 60, false);   // (the scene group is built by the first render)
    const ioLayout = dev.createBindGroupLayout({ label, entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }] });
    const g0 = which === 'none' ? dev.createBindGroupLayout({ label: label + ':g0', entries: [] }) : engine.sceneLayout;
    const pipe = await dev.createComputePipelineAsync({ label, layout: dev.createPipelineLayout({ bindGroupLayouts: [g0, ioLayout] }), compute: { module: mod, entryPoint: opts.entry ?? 'main' } });
    const nIn = Math.max(4, inputs.length), nOut = Math.max(4, opts.out ?? 256);
    const inBuf = dev.createBuffer({ label: label + ':in', size: nIn * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(inBuf, 0, Float32Array.from(inputs as ArrayLike<number>));
    const outBuf = dev.createBuffer({ label: label + ':out', size: nOut * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const rb = dev.createBuffer({ label: label + ':rb', size: nOut * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const bg1 = dev.createBindGroup({ label, layout: ioLayout, entries: [{ binding: 0, resource: { buffer: inBuf } }, { binding: 1, resource: { buffer: outBuf } }] });
    const bg0 = which === 'none' ? dev.createBindGroup({ label: label + ':g0', layout: g0, entries: [] }) : engine.sceneBG!;
    const enc = dev.createCommandEncoder({ label }); const pass = enc.beginComputePass({ label }); pass.setPipeline(pipe); pass.setBindGroup(0, bg0); pass.setBindGroup(1, bg1); pass.dispatchWorkgroups(Math.max(1, opts.n ?? 1)); pass.end();
    enc.copyBufferToBuffer(outBuf, 0, rb, 0, nOut * 4); dev.queue.submit([enc.finish()]);
    await rb.mapAsync(GPUMapMode.READ); const out = new Float32Array(rb.getMappedRange().slice(0)); rb.unmap(); rb.destroy(); inBuf.destroy(); outBuf.destroy();
    return out;
  };
  rendererFlagsAndHotSwaps(engine);   // (holds URL flags written BEFORE the preset is applied, as they were: it stays above `new Quality`)
  traceLabHooks(engine, game);
  giMotionHooks(engine);
  let benchOn: () => boolean = () => false;   // (a benchmark is running: set where it is built, below — ui/bench.ts)
  { let lastHint = -10; input.onLockedInput = () => { const now = performance.now() / 1000; if (show() && !benchOn() && now - lastHint > 3) { lastHint = now; game.msg(demo.active ? 'hands-off tour — P to stop · Esc to pause' : 'hands-off showcase — P to stop · Esc to pause'); } }; }
  { const sk = new URLSearchParams(location.search).get('smokekeep'); if (sk !== null) engine.settings.smokeKeep = smokeKeepOf(sk); }   // ?smokekeep=0|1|2: the smoke under high as each preset had it / high's smoke at half size (the page) / high's whole path (ui/quality.ts SMOKE KEEP) — before the Quality below puts its first preset on
  { const og = new URLSearchParams(location.search).get('onegrid'); if (og !== null) engine.settings.oneCacheGrid = !(og === '0' || og === 'off' || og === 'false'); }   // ?onegrid=0: low and verylow back on their coarser light-cache grid (ui/quality.ts ONE CACHE GRID) — before the Quality below applies its first preset and parks the ladder's grids
  { const os = new URLSearchParams(location.search).get('onesolve'); if (os !== null) engine.settings.oneSmokeSolve = !(os === '0' || os === 'off' || os === 'false'); }   // ?onesolve=0: each preset back on its own smoke pressure pairs (ui/quality.ts ONE SMOKE SOLVE) — before the Quality below applies its first preset
  { const fs = new URLSearchParams(location.search).get('fireshed'); if (fs !== null) engine.settings.fireSmokeShed = !(fs === '0' || fs === 'off' || fs === 'false'); }   // ?fireshed=0: verylow keeps an open fire's smoke, as every other preset does (ui/quality.ts FIRE SMOKE SHED) — before the Quality below applies its first preset
  const quality = new Quality(engine, smoke); window.__quality = quality;
  { const qp = new URLSearchParams(location.search).get('quality'); if (qp && (QUALITY_NAMES as string[]).includes(qp)) { quality.auto = false; quality.climbAllowed = false; quality.apply(qp as QualityName); } }   // ?quality= pins for this visit without touching the remembered choice
  { const ap = new URLSearchParams(location.search).get('aim'); const aim = ap === null ? null : ladderAimOf(ap); if (aim !== null) engine.settings.ladderAim = aim; else if (ap !== null) console.warn(`?aim=${ap}: not one of asnow | 0 | 60 | 90 | 120 | display — the ladder keeps its default (${engine.settings.ladderAim === 60 ? 'hold 60' : 'settings.ladderAim ' + engine.settings.ladderAim})`); if (engine.settings.ladderAim) quality.watchDisplay(); }   // the frame rate the ladder works to (ui/quality.ts HOLD): settings.ladderAim's default is HOLD 60; ?aim= sets it for this visit, ?aim=asnow (or ?aim=0) = the ladder as it was before the aim
  { const lh = new URLSearchParams(location.search).get('ladderheld'); if (lh !== null) engine.settings.ladderHeld = !(lh === '0' || lh === 'off' || lh === 'false'); }   // ?ladderheld=0: the paced check off under an aim (ui/quality.ts, under PACED) = hold 60 cuts a held page on the union's size alone, as before
  { const ls = new URLSearchParams(location.search).get('laddershed'); if (ls !== null) engine.settings.ladderShed = !(ls === '0' || ls === 'off' || ls === 'false'); }   // ?laddershed=0: auto cuts resolution with sharp direct left on (ui/quality.ts SHED), as before
  { const lp = new URLSearchParams(location.search).get('ladderpaced'); if (lp !== null) engine.settings.ladderPaced = !(lp === '0' || lp === 'off' || lp === 'false'); }   // ?ladderpaced=0: the as-now ladder's paced check off (ui/quality.ts PACED) = a slow page with the union over 11 ms is cut whatever paces it, as before
  characterRigFlagsAndHooks(engine, game);   // (this and the three *FlagsAndHooks below write URL flags AFTER the preset is applied, as they did: they stay below it)
  quality.applyMotionCalm(!new URLSearchParams(location.search).has('nomotioncalm'));   // the motion-calm bundle is the DEFAULT since 08-12 (the maintainer: 'seems to fix a lot of the direct lighting noise issues tbh. looks great'); ?nomotioncalm / Tab ▸ Frame / __gimo.calm(false) = every row as the preset has it (?motioncalm still parses, now a no-op)   // ?motioncalm: the GI-in-motion lane's opt-in bundle of direct-chain / resolve rows that calm the picture under camera motion (quality.ts MOTION_CALM, docs/internal/gi-motion.md §5) — for the maintainer to judge by eye; re-applied after preset changes   // ?quality= pins for this visit without touching the remembered choice — and holds the ladder's headroom climb off (the rows the harnesses / A/B pages measure stay the preset's; a menu pin keeps the climb)
  marksParticlesFlagsAndHooks(engine, game);
  destructionWeatherFlagsAndHooks(engine, game);
  resolveGlassFlagsAndHooks(engine, gpu);
  const panel = new Panel();
  buildPanel(panel, engine, game, smoke, cam, overlay, audio, quality, () => ({ fps: fpsSm, union: unionSm }));   // (the status strip reads the frame loop's own smoothed numbers — only ever called from the panel's refresh, long after they exist)
  if (sneakLabAsked(new URLSearchParams(location.search))) sneakLabBoot(game, panel);   // ?sneaklab: the lab's own system in the panel, open (host/sneaklab.ts) — without the word nothing of it is made
  if (fireLabAsked(new URLSearchParams(location.search))) fireLabBoot(game, panel);   // ?firelab: the fire's numbers live in the panel (host/firelab.ts), nothing of it made without the word
  // ?tweak: the one off scene tweak panel (ui/sceneTweak.ts) — the picture's layers with their switches and numbers, live; without the word nothing of it is made or read
  if (new URLSearchParams(location.search).has('tweak')) (window as any).__tweak = new SceneTweak(sceneLayers(engine, game), { scene: levelNameOf(game.level) ?? 'office' });
  input.keyVeto = e => (overlay.cardUp && !menu.isOpen && overlay.cardKey(e)) || panel.onKey(e);   // (a tutorial step's card first: the Enter or Space that closes it is no game key — ui/railcard.ts)
    // ← / → and [ / ] over the open panel walk its systems, a typed letter opens its search — before the game reads the key
  (window as any).__panel = panel;
  const hud = document.getElementById('hud')!;
  const tourVeil = document.getElementById('veil')!;   // black fade the tour raises around its cuts
  // start card now, pause menu on Esc (settings + controls); the simulation freezes while it is open, the frame keeps rendering
  let gestured = false;   // a real person has touched the page (audio may start; an autoplay-blocked context would otherwise queue every sound of an unattended tour at t=0 and fire them all on the first key)
  for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, () => { gestured = true; }, { capture: true, passive: true });
  // checkpoints (game/savestate.ts): loading a stored slot from a card / the panel / the console — any show stopped first (its beat must not puppet the loaded
  // encounter), attract put back in its box, then the load, the camera cut onto Sam where the file has him (the follow cam's cut rule drops the TAA history)
  const cutToHim = () => { cam.target = v3.copy(game.followPos()); cam.pin = null; input.keys.clear(); input.buttons = 0; };
  const loadCheckpoint = (key: string): string | null => { attract.poke(); if (demo.active) demo.stop(); if (game.director.showing) game.director.stop(); const why = game.saves.load(game, key); if (!why) cutToHim(); return why; };
  // THE SAVE TIMELINE (game/savestate.ts SAVETIMELINE): F5 is the game's; every save written asks for a picture, taken off the canvas straight after the next
  // frame that is drawn (the frame of the save: the update that wrote it is the one that frame shows) and handed back small — the simulation never sees a canvas,
  // and a picture that cannot be taken or kept is simply not there; a save kept in memory put back cuts the camera onto the man, as a file's load does
  input.saveKey = () => saveMod.SAVETIMELINE.on && !tape && !kitViewOn && !input.lockExcept && menu.mode !== 'start' && !brief?.up && document.getElementById('fatal')?.style.display !== 'flex';   // (a run the player is playing is up, or its pause / end card: on the start page, behind a mission's brief, over a broken frame, on a replay — its keys are the tape's, nothing reads a watcher's F5 — under a show's key lock, which lets no F5 through to the game, and in the kit picture's own window F5 is the browser's reload)
  let savePend: { m: unknown; time: number } | null = null;   // F5 came on the pause card: the world is held there, so the press is kept and handed to the first live tick as a press of the key (the hotkeys below)
  const savePending = () => !!savePend && game.mission === savePend.m && game.time === savePend.time;   // (…of the SAME moment: a restart or a save loaded while the card is up drops it)
  const picsDue: saveMod.SlotInfo[] = []; let picCanvas: HTMLCanvasElement | null = null;
  game.saves.picture = info => { picsDue.push(info); if (picsDue.length > 4) picsDue.shift(); };
  // (SAVEPIC, host/savepic.ts and render/savepic.ts: the frame is boxed down on the GPU and read back with no wait, the picture handed over a frame or a few
  // later — setPicture drops one whose save has gone from its slot by then, and a card already showing the saves is handed the picture for its tile. With the
  // switch off, the canvas not readable or the pass not built yet: the canvas drawn into the 2D one in this frame, as it was — which makes the page wait for
  // the GPU to hand the whole frame back.)
  const savePic = gpu.canvasRead ? new SavePicture(gpu.device, gpu.linearSampler) : null;
  let picLost = false;   // (a late picture came to nothing on this page: the old road from here, which always gave one)
  const picLate = () => !!savePic?.ready && SAVEPIC.on && !picLost;
  let lateCanvas: HTMLCanvasElement | null = null;
  const takeSavePictures = () => {
    const due = picsDue.splice(0);
    try {
      const W = Math.max(16, Math.round(saveMod.SAVETIMELINE.picPx)), H = Math.max(9, Math.round(W * canvas.height / Math.max(1, canvas.width)));
      const jpeg = (c: HTMLCanvasElement, cx: CanvasRenderingContext2D | null, draw: (cx: CanvasRenderingContext2D) => void) => {
        if (!cx) return; draw(cx);
        const url = c.toDataURL('image/jpeg', saveMod.SAVETIMELINE.picQ);
        for (const info of due) if (game.saves.setPicture(info, url)) menu.pictureCame(info, url);
      };
      if (savePic && picLate()) {
        // (its own small canvas, kept on the CPU: the pixels are put in and read straight out as a JPEG, and a canvas the browser backs with the GPU would wait for it again)
        savePic.take(gpu.ctx.getCurrentTexture(), W, H).then(px => {
          if (!px) { if (!picLost) console.warn('save picture: the late road came to nothing; pictures are taken the old way from here'); picLost = true; picsDue.push(...due); return; }   // (…and these saves' pictures are the next presented frame's, a moment late)
          try { const c = lateCanvas ??= document.createElement('canvas'); c.width = W; c.height = H; jpeg(c, c.getContext('2d', { willReadFrequently: true }), cx => { const im = cx.createImageData(W, H); im.data.set(px); cx.putImageData(im, 0, 0); }); } catch { /* no picture */ }
        });
        return;
      }
      picCanvas ??= document.createElement('canvas'); picCanvas.width = W; picCanvas.height = H;
      jpeg(picCanvas, picCanvas.getContext('2d'), cx => cx.drawImage(canvas, 0, 0, W, H));
    } catch { /* no picture: the save stands without one */ }
  };
  { const host = game.saves.onPutBack; game.saves.onPutBack = info => { host?.(info); cutToHim(); vRun = null; }; }   // (…and the run's books below start over: the Mission is the same OBJECT put back, and a load is another try, as a file's is — an end already filed must not stand for the end to come)
  loadSandbox(game);   // the start card's sandbox row (god mode / no AI / unlimited ammo) as this machine last left it
  try { const v = localStorage.getItem('twopointsix.ocpNotice'); if (v === 'glance' || v === 'investigate') game.tune.ocpNotice = v; } catch { /* */ }   // the OCP'd-light rule (Tab ▸ Sandbox ▸ Detection) as this machine last left it
  let viewReplay: (() => void) | null = null;   // (the end card's Replay button: set once the replay key is made, below)
  let startBench: () => void = () => {};   // (set where the benchmark is built, below: ui/bench.ts)
  TABKEY.whoGone = () => CMDRING.wholeSquad; TABKEY.first = navigator.webdriver === true ? 'off' : 'brief'; tabFromQuery(q); tabSettle();   // (what Tab does where nobody has chosen: before the menu is made, whose Options read it — ui/tabkey.ts, and the card's own lines below)
  const menu = new Menu({ engine, game, quality, audio, overlay, saveDue: () => savePending() && !game.saves.handNo(game), stopTour: () => { if (demo.active) demo.stop(); if (game.director.showing) game.director.stop(); }, focusGame: () => input.focusGame(), onStart: () => { attract.poke(); kitFresh(game); if (gestured) audio.start(); }, replay: () => viewReplay,
    startBench: () => startBench(), loadCheckpoint });
  window.__menu = menu;
  // __save: the checkpoints for the console / automation — save now (manual slot; force lets go of Sam's hands in the file), load the newest / a slot key / a
  // parsed state, the slot list, export (the newest slot's JSON text), import (text → the manual slot), clear, autosave on/off, the controller's line and log
  (window as any).__save = {
    /** a save's picture (host/savepic.ts SAVEPIC): is the late road up, how many are in flight / were handed back / came to nothing, and a slot's picture */
    pic: () => ({ late: picLate(), canvasRead: !!gpu.canvasRead, pending: savePic?.pending ?? 0, taken: savePic?.taken ?? 0, lost: savePic?.lost ?? 0 }),
    pictureOf: (info: saveMod.SlotInfo) => game.saves.pictureOf(info),
    /** for a check: the late road's takes come to nothing from here, as on a device that refuses the pass (tools/qa/savepic-page.cjs) */
    picLose: () => { if (savePic) savePic.take = () => Promise.resolve(null); },
    save: (label = 'by hand', force = false) => { automated = true; return game.saves.write(game, 'manual', label, force); },
    load: (what?: string | object) => { automated = true; const key = typeof what === 'string' ? what : what ? null : game.saves.newest(false)?.key; if (what && typeof what === 'object') return loadCheckpoint2(what); return key ? loadCheckpoint(key) : 'nothing stored'; },
    slots: () => game.saves.slots(), newest: () => game.saves.newest(false),
    export: (key?: string) => { const k = key ?? game.saves.newest(false)?.key; return k ? game.saves.store.get(k) : null; },
    import: (text: string) => game.saves.importText(game, text), clear: () => game.saves.clear(),
    get auto() { return game.saves.enabled; }, set auto(v: boolean) { game.saves.setEnabled(!!v); },
    get state() { return game.saves; }, get log() { return game.saves.log; }, summary: () => game.saves.summary(game),
    canSave: (force = false) => saveMod.canSave(game, force), snapshot: (force = true) => saveMod.saveState(game, { label: 'console', kind: 'harness', force }),
  };
  const loadCheckpoint2 = (state: object): string | null => { attract.poke(); if (demo.active) demo.stop(); if (game.director.showing) game.director.stop(); const why = game.saves.load(game, state as never); if (!why) { cam.target = v3.copy(game.followPos()); cam.pin = null; } return why; };
  quality.onCalibrated = () => menu.refreshQualityNote();   // 'auto' picked on the pause card calibrates behind it: the card's note follows when it settles
  // attract mode (game/attract.ts): the start card left alone for a few seconds shows the place off by itself — the camera cuts round a loop of the tour's framings
  // while the patrols walk through them — and the first key, click, wheel tick or real mouse movement puts the card's own still view straight back (a fresh
  // encounter, the camera on Sam) and restarts the clock. Start card only: never over the pause / debrief card, never while the tour runs or auto quality is still
  // calibrating behind the card, never on a hidden tab, and never on a page automation is driving (?paused / __testVisible / any scripted hook below).
  let automated = testMute;   // any scripted hook used once (or the automation profile's mute flag): this page is a test rig, not a visitor
  // attract mode: with nobody touching anything on the start card it cuts round the level, pass after pass, until somebody does (it handed over to a showcase after its first pass
  // while there was one to hand over to)
  const attract = new Attract(game, cam, () => menu.mode === 'start' && !missionsBusy() && !optionsOpen() && !demo.active && !game.director.showing && !game.nightBreach.active && !game.rescue.active && !game.quiet.active && !quality.calibrating && !automated && !benchOn() && !window.__pauseLoop && !window.__testVisible && !document.hidden,
    undefined,
    () => { refreshStill = true; });   // onStop: attract has just put the fresh encounter and the card's own camera back with no fade — the next frozen frame must show THAT, settled (step() below)
  { // the console's entry point obeys the rule a button would: never over a running programme, and attract is put back in its box first
    const rawD = demo.start.bind(demo) as (...x: unknown[]) => void; (demo as unknown as { start: (...x: unknown[]) => void }).start = (...a: unknown[]) => { if (demo.active || game.director.showing) return; attract.poke(); rawD(...a); };
  }
  let refreshStill = false;
  (window as any).__attract = attract;
  for (const ev of ['keydown', 'mousedown', 'pointerdown', 'wheel', 'touchstart']) window.addEventListener(ev, () => { attract.poke(); }, { capture: true, passive: true });   // (someone is here)
  { let mx: number | null = null, my: number | null = null;   // (a real change of position: a still mouse can still deliver mousemove on focus and layout changes, and movementX is not reliable everywhere; the first event only takes the reading)
    let mAcc = 0, mT = 0;
    window.addEventListener('mousemove', e => { if (mx !== null && my !== null) { const dd = Math.abs(e.clientX - mx) + Math.abs(e.clientY - my); const now = performance.now(); mAcc = now - mT > 300 ? dd : mAcc + dd; mT = now; if (mAcc >= 3) { mAcc = 0; attract.poke(); } } mx = e.clientX; my = e.clientY; }, { capture: true, passive: true }); }   // (3 px inside 0.3 s: a sensor's 1 px jitter is not a person)
  window.addEventListener('keydown', e => { if (e.code === 'Escape' && !e.repeat) { if (tabUp) { tabShow(false); input.pressed.delete('Escape'); e.preventDefault(); return; }   // (Tab's card, ui/tabcard.ts: Esc puts it away, and is that press's whole job)
    if (benchOn()) { input.pressed.delete('Escape'); return; }   // (Esc is the benchmark's while it runs: it stops itself, and puts the picture back BEFORE its scene is stopped — ui/bench.ts finish. Out of the frame's keys too: on a floor opened straight in, the world runs again the frame after, and its tick is not to read the key)
    if (!menu.isOpen && panelWantsEsc()) { const a = document.activeElement as HTMLElement; a.dataset.esc = '1'; a.blur(); delete a.dataset.esc; return; }   // (the mark: a field that takes Esc as 'never mind' reads it in the change its blur fires)
    if (!menu.isOpen && (demo.active || game.director.showing || game.director.handedOver)) { endShow(); e.preventDefault(); return; } if (!menu.isOpen && !show() && !BACKKEY.tab && game.escape()) { e.preventDefault(); return; } if (BACKKEY.tab) input.pressed.delete('Escape'); menu.toggle(); e.preventDefault(); } }, { capture: true });   // (BACKKEY.tab, game/backkey.ts: Esc is only the pause — nothing backs out on it; Tab does that, in the tick)   // (Esc over a running tour ends it to the start card)   // (Esc first backs out of an open Space selector / stops a running verb — the leaf being eased, the pick, the choke, the drive: game/interact.ts — and only then pauses)
  const panelWantsEsc = () => { const a = document.activeElement; return !!a && (a instanceof HTMLInputElement || a instanceof HTMLSelectElement) && !!a.closest('#panel, #sndcard'); };   // first Esc just releases a focused tweak-panel control; controls inside the menu never block it
  tape?.stood(game);   // (a tape: the game's tune, flags and tables as the recording's stood, round the mission's staging — tools/qa/rerun.ts's order)
  { const dress = kitSetUp ? kitViewSetDress(q) : null; if (dress) { setSuitAs(dress.suit); KITANIM.sling = dress.sling; } else if (kitViewOn && kitViewQuietOf(q)) KITANIM.sling = 2; }   // (?kitview on a bespoke set of a QUIET mission or the solo night: the men dressed as that mission's are, the rifle across the back — this window's own modules, an iframe's; a loud mission's set and every other page: nothing said)
  const booted = scenarioFromUrl(kitSetUp ? kitViewSetQuery(q) : q, game);   // (?kitview on a bespoke set: the picture is a room clear whatever the mission's kind — host/kitViewSet.ts; never otherwise)
  tape?.tables();
  // Esc ▸ 'Quit to scenarios' (and the down card's): the scenario stopped — its cast gone, the shift back, a fresh night — its flags off the URL, the start
  // card's picker up. On a level file of its own the picker's floor is the office's: a page load of the bare URL instead.
  const levelFileQ = (() => { const lf = q.get('levelFile'); return lf && /^[\w.-]+\.json$/.test(lf) ? lf : null; })();
  const scenario = {
    current: () => runningScenario(game, levelFileQ),
    refused: () => booted.spec && booted.why && !runningScenario(game, levelFileQ) ? refusalWords(booted.spec, booted.why) : null,
    quit: () => {
      if (!runningScenario(game, levelFileQ)) return;   // (the cards only offer it with a scenario up; the console hook gets the same rule)
      const pick = PICKS_UI.on ? pickOfQuery(location.search) : null, next = PICKS_UI.on ? pickQuitSearch(location.search) : quitSearch(location.search); booted.why = null;   // (pickQuitSearch off a pick's page = quitSearch, less a row's name left on the URL)
      if (pick) { if (START_PAGE.on) reopenMissionsAfterLoad(); location.assign(location.pathname + next + location.hash); return; }   // (a short-list pick: its settings leave the URL with the scenario's, ALWAYS by a page load — its difficulty / hour / weather were read at boot and only a load puts the machine's own back — and onto the start card's rows, not the list)
      if (q.has('levelFile')) { reopenMissionsAfterLoad(); location.assign(location.pathname + next + location.hash); return; }
      attract.poke();
      quitScenario(game, plainFog(q));
      try { history.replaceState(null, '', location.pathname + next + location.hash); } catch { /* a sandboxed frame: the URL keeps the flag, a reload re-enters */ }
      cam.target = v3.copy(game.followPos()); cam.pin = null; input.keys.clear(); input.buttons = 0;
      menu.open('start'); openList(); refreshStill = true;   // (the frozen frame behind the card: the night floor it has just put back, not the scenario's last frame; the mission list up over the card — 'to scenarios')
    },
  };
  menu.setScenario(scenario);
  (window as any).__picks = { ui: PICKS_UI, list: PICKS, current: () => pickOfQuery(location.search), href: (id: string) => { const p = PICKS.find(x => x.id === id); return p ? pickHref(p, location.search) : null; }, silent: () => ({ start: SILENT.start, squad: squadSilent(game) }), difficulty: () => difficultyNow() };   // the short list (scene/picks.ts): the table, the row this page is, a row's URL, the team's posture (?silentstart) and the difficulty in force
  (window as any).__scenarios = { list: SCENARIOS, all: ALL_MISSIONS, current: scenario.current, quit: scenario.quit, pick: (id: string) => { const e = ALL_MISSIONS.find(x => x.id === id); if (e) { const to = location.pathname + pickSearch(e, location.search) + location.hash; if (to === location.pathname + location.search + location.hash) location.reload(); else location.assign(to); } return !!e; } };   // the picker for the console / automation: .list, .current(), .pick(id) (a page load), .quit()
  (window as any).__quiet = { get on() { return game.quiet.active; }, get deal() { return game.quiet.deal; }, get ops() { return game.quiet.ops; }, summary: () => game.quiet.summary(), log: game.quiet.log, check: () => checkQuiet(game), restage: () => game.quiet.restage() };   // the quiet mission (game/quiet.ts): what this run was dealt, the level's block against its floor
  if (q.has('nopar')) PAR.on = false;   // ?nopar: a par level plays as its room clear alone — no clock (game/par.ts reads only: the run is the same either way)
  if (q.has('noissue')) ISSUE.on = false;   // ?noissue: a mission that issues kit of its own (scenarios.issue — game/kit.ts kitIssue) is staged with the cards this machine keeps
  if (q.has('nosnatch')) SNATCH.on = false;   // ?nosnatch: a snatch level plays as its room clear alone (game/snatch.ts)
  (window as any).__snatch = { knobs: SNATCH, get man() { return game.snatch.man; }, get end() { return game.snatch.end; }, get log() { return game.snatch.log; }, summary: () => game.snatch.summary(), check: () => checkSnatch(game), out: SNATCHOUT, get exfil() { return game.snatch.out; } };
  if (q.has('nolesson')) LESSON.on = false;   // ?nolesson: a Training level plays as its mission alone — no step lines (game/lesson.ts; the lesson only ever reads the game, so the run is the same either way)
  (window as any).__lesson = { get on() { return LESSON.on; }, set on(v: boolean) { LESSON.on = v; }, get step() { return game.lesson.step; }, get i() { return game.lesson.i; }, summary: () => game.lesson.summary(), log: game.lesson.log, stats: LESSON_STATS, check: () => checkLesson(game) };   // a training lesson (game/lesson.ts): the step that is up, the level's block against its floor
  kitSoloIf(game, q.has('solo') || !game.quiet.active);   // the plain night — off the loadout screen (?solo) or off the card's own Start —, or a quiet mission alone, and no squad scenario up: your own card on the plain night's player, and on every fresh one after a restart (game/kit.ts — one function, which the harness's shipped stand asks of a game stood up plain too: Start no longer hands him the eleven things the pouches rule took off every other Sam)
  const openStartCard = !q.has('solo') && !game.nightBreach.active && !game.rescue.active && !game.quiet.active && !tape && !kitViewOn;   // (?solo: the mission list's solo night — ui/missions.ts — is the plain night straight in)   // (opened below, once every hook is on window: that is the moment the card's buttons come alive and __ready resolves)

  let last = performance.now(); let lastTs = -1, vsDt = -1; let timeAcc = 0; let fpsSm = 60; let frameCount = 0; let unionSm = 0; let simSm = 0;
  const debugNames = ['final', 'albedo', 'normals', 'direct', 'indirect', 'volumetrics', 'depth', 'dice', 'lighting', 'denoise hints', 'specular', 'restir history', 'restir rays', 'denoise state', 'rt reflections', 'material', 'gi reservoirs', 'rt raw'];   // (16 = phase 5's gather reservoirs: r M ÷ cap, g temporal taken, b spatial taps; 17 = the reflection pass's output as fetched, before the cutoff fade)   // (specular = the glossy floors' reflection term + what the glass panes add, + the ray-traced reflections, composite debug view 10; rt reflections = the traced term alone, view 14; restir history / rays = views 11 / 12, restir.wgsl's diagnostics; 13 = the v3 shadow client's σ per class + history length)

  // scripted stepping for automated testing: __runFrames(n, dt, keys[]) runs n fixed steps with the given keys held
  let scripted = false;
  // (THE LOAD BRIEF, ui/loadbrief.ts: up and live it holds the world still as a card does; a script that takes the page over meanwhile is not held by a screen it cannot press — the brief goes, unstarted)
  const briefHolds = (): boolean => { if (!brief?.held) return false; if (automated || scripted) { brief.off(); return false; } return true; };
  // (draw = 'none': no step of the burst is rendered at all — a page played by a script on the software adapter, where one drawn frame is half a minute; the
  //  GPU's senses then stand as the last drawn frame left them, so such a script draws one now and then)
  // (draw = false: only the burst's last step is rendered; the steps before it pack the world a draw would have packed and draw nothing. For a long scripted run
  //  on a slow adapter: the game steps the same, the GPU's senses are answered at the bursts' ends)
  let leanBurst = false;
  window.__runFrames = (n: number, dtFixed = 1 / 60, keys: string[] = [], draw: boolean | 'none' = true) => { automated = true; attract.poke(); scripted = true; leanBurst = draw !== true; for (const k of keys) input.keys.add(k); try { for (let i = 0; i < n; i++) step(dtFixed, draw !== 'none' && i === n - 1); } finally { for (const k of keys) input.keys.delete(k); leanBurst = false; scripted = false; } };   // (`draw` false: only the burst's last step is drawn — the others pack the world and go on; a step that throws leaves no key held and no burst open)
  // __stage(pin | null, opts?): automation framing + staging in one call — pin = { look:[x,y,z], yaw, pitch, dist } fixes the camera verbatim (FollowCamera.pin:
  // no damping / aim lead), null releases it; opts.park = true parks every guard far away, torches off, held + pinned (the usual capture hygiene);
  // opts.guards = [{ i, pos, yaw?, torch?, aimPitch?, state? }] then places the listed ones; opts.player = { pos, yaw?, crouch?, holstered?, invisible? }.
  // Returns what it did. Pair with ?paused + __runFrames. (Renderer notes and pose checks kept framing walls because the follow cam drifted under scripts.)
  window.__stage = (pin: { look: Vec3; yaw: number; pitch: number; dist: number } | null, opts: { park?: boolean; guards?: { i: number; pos: Vec3; yaw?: number; torch?: boolean; aimPitch?: number }[]; player?: { pos?: Vec3; yaw?: number; crouch?: boolean; holstered?: boolean; invisible?: boolean } } = {}) => {
    automated = true; attract.poke();
    cam.setPin(pin);   // (validated + clamped; a release puts the free camera's yaw / pitch / zoom back — camera.ts setPin)
    if (opts.park) game.guards.forEach((gd, k) => { gd.char.pos = [-40 - k * 3, 0, -40]; gd.flashlight.enabled = false; gd.hold = true; gd.pinned = true; });
    for (const s of opts.guards ?? []) { const gd = game.guards[s.i]; if (!gd) continue; gd.char.pos = v3.copy(s.pos); if (s.yaw !== undefined) { gd.char.bodyYaw = s.yaw; gd.char.aimYaw = s.yaw; } if (s.aimPitch !== undefined) gd.char.aimPitch = s.aimPitch; if (s.torch !== undefined) gd.flashlight.enabled = s.torch; gd.hold = true; gd.pinned = true; }
    const P = opts.player; if (P) { if (P.pos) game.teleportPlayer(v3.copy(P.pos)); if (P.yaw !== undefined) { game.player.char.bodyYaw = P.yaw; game.player.char.aimYaw = P.yaw; } if (P.crouch !== undefined) { game.player.crouch = P.crouch; game.player.char.anim.crouchTarget = P.crouch ? 1 : 0; } if (P.holstered !== undefined) game.player.holstered = P.holstered; if (P.invisible !== undefined) game.playerInvisible = P.invisible; }
    return { pinned: !!cam.pin, pin: cam.pin ? { look: v3.copy(cam.pin.look), yaw: cam.pin.yaw, pitch: cam.pin.pitch, dist: cam.pin.dist } : null, parked: !!opts.park, guards: (opts.guards ?? []).length, player: !!P };   // (pin: the framing AS APPLIED — clamped)
  };
  window.__mouse = (x: number, y: number, buttons?: number) => { automated = true; attract.poke(); input.mouseX = x; input.mouseY = y; if (buttons !== undefined) input.buttons = buttons; };   // buttons: 1 LMB, 4 RMB (held)
  window.__click = (button = 0) => { automated = true; attract.poke(); input.clicked |= 1 << button; };
  window.__input = input;

  // __shot(name): render one offscreen frame, read it back and POST a JPEG to the capture server (tools/shot-server.ts) — for docs/board images
  window.__shot = async (name: string, quality = 0.86, scale = 1) => {
    engine.render(cam, timeAcc, 1 / 60, false);
    const c2 = await frameCanvas(engine); if (!c2) return 'no frame';
    let out: HTMLCanvasElement = c2;
    if (scale !== 1) { out = document.createElement('canvas'); out.width = Math.round(c2.width * scale); out.height = Math.round(c2.height * scale); const cx = out.getContext('2d')!; cx.imageSmoothingQuality = 'high'; cx.drawImage(c2, 0, 0, out.width, out.height); }
    const blob: Blob = await new Promise(res => out.toBlob(b => res(b!), 'image/jpeg', quality));
    return `${c2.width}x${c2.height} ${(blob.size / 1024).toFixed(0)} KB → ${await postShot(name, blob)}`;
  };
  // __panelShot(name, { frame, quality }): the tweak PANEL is HTML, not part of the frame __shot reads back — rasterise #panel (editor/domshot.ts: computed styles inlined into an SVG
  // foreignObject) and, unless frame:false, lay it at its own place over the rendered frame + whatever the overlay's canvases hold (the wind field's arrows), then post the JPEG
  (window as any).__panelShot = async (name: string, opts: { frame?: boolean; quality?: number; scale?: number } = {}) => {
    const { snapshotElement } = await import('./editor/domshot');
    const root = document.getElementById('panel')!; const scale = opts.scale ?? 2;
    root.classList.add('rastering'); let pc: HTMLCanvasElement; try { pc = await snapshotElement(root, scale); } finally { root.classList.remove('rastering'); }   // (index.html #panel.rastering: native sliders for the raster — their custom track / thumb are pseudo-elements it cannot carry)
    let out: HTMLCanvasElement = pc;
    if (opts.frame !== false) {
      engine.render(cam, timeAcc, 1 / 60, false); const fc = await frameCanvas(engine);
      const W = canvas.clientWidth, H = canvas.clientHeight; out = document.createElement('canvas'); out.width = Math.round(W * scale); out.height = Math.round(H * scale);
      const cx = out.getContext('2d')!; cx.imageSmoothingQuality = 'high'; cx.scale(scale, scale); cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
      if (fc) cx.drawImage(fc, 0, 0, W, H);
      for (const c of Array.from(document.querySelectorAll('#overlay canvas')) as HTMLCanvasElement[]) if (c.style.display !== 'none' && c.width > 0) cx.drawImage(c, 0, 0, W, H);
      if (!root.classList.contains('hidden')) { const r = root.getBoundingClientRect(); cx.drawImage(pc, r.left, r.top, r.width, r.height); }
    }
    const blob: Blob = await new Promise(res => out.toBlob(b => res(b!), 'image/jpeg', opts.quality ?? 0.9));
    return `${out.width}x${out.height} ${(blob.size / 1024).toFixed(0)} KB → ${await postShot(name, blob)}`;
  };
  // __png(name): like __shot but lossless PNG (for pixel-exact A/B of renderer changes; pair with __pauseLoop for determinism)
  window.__png = async (name: string) => {
    engine.render(cam, timeAcc, 1 / 60, false);
    const c2 = await frameCanvas(engine); if (!c2) return 'no frame';
    const blob: Blob = await new Promise(res => c2.toBlob(b => res(b!), 'image/png'));
    return `${c2.width}x${c2.height} png ${(blob.size / 1024).toFixed(0)} KB → ${await postShot(name, blob)}`;
  };
  // __resetClock(): zero every per-frame counter that feeds jitter / seeds / flicker, snap the camera — so a scripted capture sequence
  // renders the same frames whatever ran during boot (pair with __pauseLoop)
  window.__resetClock = () => { engine.frameIdx = 0; engine.passes.resetClocks(); cam.distance = cam.desiredDistance; cam.target = v3.copy(game.followPos()); };
  if (tape) automated = true;   // (a replay: no attract reel under it)
  if (new URLSearchParams(location.search).has('paused')) { window.__pauseLoop = true; automated = true; }   // ?paused: nothing runs until a script steps it (deterministic captures from frame 0) — and attract mode never, even if the loop is let go later
  window.__timeScale = 1;
  if (new URLSearchParams(location.search).has('hud')) readout.set(true);
  // F9: the perf recorder (ui/perfrec.ts) — a stress-test dump the maintainer hands back: per-frame GPU passes + CPU sections + state + events → download + shot server
  const perfrec = new PerfRecorder(engine, game, cam, quality, s => { perfNote = s; perfNoteT = 4; try { game.msg(s); } catch { /* */ } });   // (also on the message line, so REC start / saved shows without the debug read-out)
  let perfNote = '', perfNoteT = 0;
  let lastTimerResolved = -1;   // engine.timer.resolved when the ladder was last fed a GPU union (a sample gets 0 = 'no timings' unless a NEW readback resolved since)
  (window as any).__perfrec = perfrec;
  // F8: the perf SWEEP (ui/perfsweep.ts) — a measurement take over the recorder: the world frozen where it stands (Shift+F8: left running), auto quality held, one heavy feature
  // flipped at a time and put back, each flip a recorder event; the take downloads as any F9 one does. Its own key listener, not one of the loop's hotkeys: F8 must stop a frozen sweep, and a frozen frame shows the hotkeys at most the recorder keys (F9 there stops the recorder and with it the sweep).
  const perfsweep: PerfSweep = new PerfSweep(engine, game, quality, smoke, perfrec, s => { perfNote = s; perfNoteT = 6; try { game.msg(s); } catch { /* */ } },
    () => bench.active && !bench.sweeping ? 'the benchmark is running' : quality.calibrating ? 'auto quality is still measuring this machine' : menu.isOpen && menu.mode === 'start' && !bench.sweeping ? 'start a run first' : null);
  perfsweep.oneAir = () => oneAirFlip(game); perfsweep.wispMotes = () => wispMotesFlip(game);
  (window as any).__perfsweep = perfsweep;
  window.addEventListener('keydown', e => { if (e.code === 'F8' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement | null)?.tagName ?? '')) { e.preventDefault(); perfsweep.toggle(e.shiftKey); } });
  // THE BENCHMARK (ui/bench.ts; title ▸ Extras ▸ Benchmark, or ?bench on the address): hands off, a page per scene of host/benchScenes.ts (ui/benchrun.ts carries the run
  // from page to page), each a real mission played through the game's own keys by host/handsoff.ts. The first page's opening picture is timed, every scene live, and the
  // last one's fight is held still and timed under each preset and each sweep row; then a short text to copy (the GPU by name, the boot's timings, a line per window and
  // per scene) and the take's json in the downloads. Nothing is sent anywhere. ?bench=N = N seconds a window. Unasked, nothing of it runs
  const benchPage = !kitViewOn && !tape ? benchLegOfPage() : null;   // (this page is a scene's page of a run under way: its part of it — else null, a plain page)
  // the hands-off player of this page's scene: its keys go on the input before each game tick (the loop's beforeTick), Sam cannot go down while it plays (as the scene says)
  let hands: HandsOff | null = null, handsHeld = false, handsGod = false, shotAt = -9; const shotsSeen = new WeakSet<object>();
  const handsOff = () => { if (hands) { hands.stop(); hands.tick(0); } if (handsHeld) { handsHeld = false; game.godMode = handsGod; input.lockExcept = null; } };
  const handsTick = (dt: number) => { const H = hands; if (!H || !handsHeld) return;
    for (const e of game.events as readonly { kind: string; loud?: boolean }[]) if (((e.kind === 'shot' && e.loud !== false) || e.kind === 'guardShot') && !shotsSeen.has(e)) { shotsSeen.add(e); shotAt = H.t; }
    try { H.tick(dt); } catch (e) { console.error(e); H.stop('spent'); } };   // (a throw in his script ends his scene, not the run)
  const benchScene: BenchScene | null = benchPage ? {
    start: () => { if (!game.roomClear.active) return 'the mission did not start'; const S = benchPage.scene;
      handsGod = game.godMode; handsHeld = true; game.godMode = S.god; shotAt = -9;
      input.lockExcept = new Set(); input.keys.clear(); input.buttons = 0;   // (the real keyboard is out of the scene: a visitor's key would make it another fight. His own keys go straight onto the input)
      hands = new HandsOff(game, input, cam, canvas, { ...S.plan, seed: S.seed, cap: benchPage.cap }); return null; },
    active: () => !!hands && !hands.end, stop: () => handsOff(),
    heavy: () => !!hands && hands.t >= 12 && hands.t - shotAt < 0.4,   // (rounds in the air, a dozen seconds in: the stack is through its first door by then)
    said: () => { const H = hands; if (!H) return ''; const sq = game.orders.squad(), up = sq.filter(m => (m as { state: string }).state !== 'dead').length;
      return `${H.end === 'taken' ? 'taken in' : H.end === 'sam' ? 'Sam down at' : 'fighting at'} ${Math.round(H.t)} s, ${up} of ${sq.length} up`; },
  } : null;
  let benchAway = false; document.addEventListener('visibilitychange', () => { if (document.hidden) benchAway = true; });
  const benchBlocked = () => perfsweep.active ? 'the sweep is running' : tape ? 'a replay is playing' : demo.active || game.director.showing ? 'the tour is running' : missionsBusy() || optionsOpen() ? 'a screen is open' : null;
  const bench: Bench = new Bench(engine, quality, perfrec, { boot: () => boot.summary(), machine: () => machineFacts(gpu.adapterInfo, gpu.adapterFallback, quality.displayHzPin || quality.displayHz), hz: () => quality.displayHzPin || quality.displayHz, view: benchView(() => missionsBusy() || optionsOpen()), smoke,
    blocked: () => benchBlocked(),
    covered: () => missionsBusy() || optionsOpen() ? 'a screen came up over it' : null,
    scene: benchScene,
    away: () => { const a = benchAway; benchAway = false; return a; },
    sweep: { start: o => perfsweep.start(o), active: () => perfsweep.active, flipped: () => perfsweep.flipped, progress: () => perfsweep.progress, stop: why => perfsweep.stop(why), settled: () => perfsweep.settled } });
  (window as any).__bench = Object.defineProperties(bench, { hands: { get: () => hands }, sceneDefs: { value: BENCH_SCENES }, begin: { value: (o?: Parameters<typeof benchBegin>[2]) => benchBegin(true, location, o) } });   // (+ for the checks: the scene's hands-off player, the set, a run begun with options of the caller's)
  const benchOpts = (b: string | null) => { const secs = parseFloat(b ?? ''); return isFinite(secs) && secs > 0 ? { measureMs: Math.min(60, secs) * 1000, settleMs: Math.min(2000, Math.max(300, secs * 500)) } : {}; };
  benchOn = () => bench.active;   // (no attract reel under a measurement, and the page's Esc and hotkeys stand down)
  // the row: a run begins as a page load of its first scene (this page has booted the game: that load is a second one, and the report says so). A refusal is said, on the HUD's line and the console
  startBench = () => { attract.poke(); const no = bench.active ? 'it is running' : perfrec.recording ? 'a recording is running' : benchBlocked() ?? benchBegin(true); if (no) { perfNote = `benchmark not now: ${no}`; perfNoteT = 6; console.info(perfNote); } };
  // a scene's page of a run under way: its part starts by itself (the wait for the page to settle, then the scene)
  if (benchPage) { if (benchPage.leg.index === 0 && Object.keys(keptLevers()).length) benchPage.leg.notes.push('this machine keeps difficulty levers of its own: its fights are not the set\'s as dealt');
    const said = bench.start({ ...benchOpts(benchPage.secs), sceneCapMs: benchPage.cap * 1250, heavyCapMs: Math.min(45, benchPage.cap * 0.6) * 1000, ...benchPage.opts }, benchPage.leg);
    if (!bench.active) { benchPage.leg.over(); perfNote = `benchmark ${said}`; perfNoteT = 6; console.info(perfNote); } }   // (sceneCapMs: the scene's own cap is the hands-off player's, on the game's clock; the benchmark's cut on the wall's clock stands a quarter behind it)
  else if (benchRefused) { perfNote = `benchmark not now: ${benchRefused}`; perfNoteT = 10; }
  (window as any).__knobs = { registry: knobRegistry, copy: knobsCopy, back: knobsBack };   // THE list of knob tables (game/knobs.ts): every switch table by name, a copy, a copy put back
  // F10: the SESSION JOURNAL (game/journal.ts + ui/sessionrec.ts) — a checkpoint of the moment, then every frame's dt / camera / input and every value the game took off the GPU
  // (the sensors), so tools/qa/replay.ts can play the session again headless and hold the deterministic simulation to it; the file downloads (+ the shot server's /session sink)
  const sessionrec = new SessionRec(game, s => { perfNote = s; perfNoteT = 5; try { game.msg(s); } catch { /* */ } });
  (window as any).__journal = {
    start: (opts: { seed?: number; note?: string } = {}) => { automated = true; if (game.journal.state !== 'idle') return game.journal.summary(); game.journal.request({ ...opts, commit: sessionrec.commit, userAgent: navigator.userAgent, hud: true }); return game.journal.why ? `pending — ${game.journal.why}` : 'starts on the next frame'; },
    stop: (immediate = false) => game.journal.stop('stopped (console)', immediate) ?? (game.journal.stopping ? 'stops at the end of the next frame (step one, or F10 / stop(true) forces it now)' : null),   // (deferred by default: the closing digest is taken straight after an update, where a replay compares it)
    toggle: () => sessionrec.toggle(),
    save: () => { const f = game.journal.last; if (!f) return 'nothing recorded'; sessionrec.deliver(f, f.meta.stopped); return sessionrec.lastName; },
    get state() { return game.journal.state; }, get file() { return game.journal.last; }, get stats() { return { ...game.sensors.stats, frame: game.journal.frame, bytes: game.journal.approxBytes(), lastName: sessionrec.lastName, lastBytes: sessionrec.lastBytes }; },
    check: (f?: unknown) => checkSessionFile((f ?? game.journal.last) as never), get sensors() { return game.sensors; },
    summary: () => game.journal.summary(),
  };
  // F7: the REPLAY BUFFER (game/replaybuf.ts + ui/replaykey.ts) — the last minutes of play, always kept, nothing to start: F7 puts them on this browser's replay shelf after the fact,
  // Shift+F7 also opens the viewer (replay.html: a map with a scrubber, and notes that stay in the file); ?noreplay = no buffer, the build as it was
  const replaykey = new ReplayKey(game, cam, s => { perfNote = s; perfNoteT = 6; try { game.msg(s); } catch { /* */ } }, () => ({ levelFile: levelFileQ ?? undefined, scenario: runningScenario(game, levelFileQ)?.title, fp: saveMod.levelFingerprint(game) }));
  (window as any).__replay = replaykey.hook();
  (window as any).__digest = { game: () => digestMod.hashDigest(digestMod.digestGame(game)), bits: (from?: number) => digestMod.rawBits(game, from), chain: (every?: number, detail?: number) => digestMod.chainBits(game, every, detail) };   // the game's state as one word (game/digest.ts): rounded, raw, and raw chained over every step from now — what tools/qa/samefight-page.cjs holds against a headless re-run
  viewReplay = replaykey.canView ? () => replaykey.openViewer('card') : null;
  // First-use warm-up behind the start card (renderer v3 P0-B, measured 08-11 on the M4 Max with the box solver of the day): the smoke solver's first live smoke touches its buffers and 3D textures and runs
  // the sim's JS cold (≈ 10 ms GPU + 35 ms JS the first time then, nothing after), the GPU particles' first burst binds their pool and pipelines — paid on the first presented frames
  // under the card (a throwaway canister in the lattice's corner and one spark 60 m outside the level, cleared a dozen frames on; the calibration skips its first 24 frames anyway) instead of on the
  // first shot of the night. Everything else tried (night vision, a lightning stroke, decals, glass cracks, debug views) costs nothing extra the first time: Metal compiles at
  // pipeline creation, which all happens at boot. Not under ?paused — scripts own every frame there; __prewarm() does it by hand — and never twice.
  let prewarmAt = -3;   // −3 never asked · ≥ 0 the frame it ran · −2 done
  (window as any).__prewarm = () => { if (prewarmAt !== -3) return false; smoke.spawnCanister([0.7, 0, 0.7], 0.05); engine.particles?.emit('spark', [-60, 0.3, -60], [0, 1, 0], 1, { speed: 1, life: 0.25, size: 0.01 }); prewarmAt = frameCount; return true; };
  function frame(ts?: number) {
    try {
      if (window.__pauseLoop || kitView?.rest()) { last = performance.now(); lastTs = -1; requestAnimationFrame(frame); return; }   // (…and ?kitview's picture at rest — a still one held, the live one paused off its step: nothing stepped or drawn until it is asked again — host/kitView.ts)   // test hook: only scripted __runFrames advance anything (deterministic captures)
      if (kitView?.skip(ts)) { requestAnimationFrame(frame); return; }   // (?kitview's even pace on a fast display: this display frame is passed over whole — `last` is not touched, so the next step takes the real time since the last one)
      if (prewarmAt === -3 && frameCount >= 1) (window as any).__prewarm();
      const now = performance.now(); const rawDt = (now - last) / 1000; const dt = Math.min(1 / 20, rawDt) * (window.__timeScale ?? 1); last = now;
      vsDt = typeof ts === 'number' && lastTs >= 0 && ts > lastTs ? Math.min(1 / 20, (ts - lastTs) / 1000) * (window.__timeScale ?? 1) : -1; if (typeof ts === 'number') lastTs = ts;   // (the display's own frame time, for the fixed step: host/loop.ts)
      if (rawDt > 0) fpsSm = fpsSm * 0.95 + (1 / rawDt) * 0.05;   // HUD frame rate from wall-clock, not the clamped / time-scaled game dt
      if (quality.calibrating) { if (!bench.timing) quality.calibrateTick(rawDt); }                            // boot calibration reads GPU pass timings behind the start card (the live scene renders there)
      else if (!(document.hidden && !window.__testVisible) && rawDt < 0.5 && (!menu.isOpen || attract.live) && !brief?.held && !overlay.cardUp && !tabUp && !perfsweep.active && !bench.freezing) {   // a frozen pause frame says nothing about gameplay load (attract mode's live rooms do: the ladder settles before Start is ever pressed)
        const fresh = engine.timer.resolved !== lastTimerResolved; lastTimerResolved = engine.timer.resolved;   // + the compute passes' GPU UNION of the last resolved frame — what the headroom-aware climb and auto's hop test read: 0 = 'no timings' (no timestamp queries), NaN = 'no verdict' (timings exist but no NEW readback resolved since the last sample — a stalled readback must neither feed the ladder a frozen number nor hand it the blind rule)
        quality.sample(rawDt, !engine.timer.enabled ? 0 : fresh ? engine.timer.unionMs(['composite', 'post', 'fxaa', 'gbuffer', 'pdraw', 'present']) : NaN);
      }
      perfrec.cpuFrameStart = performance.now();
      if (!kitView) attract.tick(rawDt);   // (never under ?kitview: the world runs there with no card up) idle seconds on the start card → the attract programme (its opening veil on the wall clock, then live; and off again the moment it may not run)
      step(dt);
      perfrec.frame(rawDt, fpsSm); perfsweep.tick(); bench.tick(rawDt); if (handsHeld && !bench.active) handsOff(); if (perfNoteT > 0) perfNoteT -= rawDt;
      requestAnimationFrame(frame);
    } catch (e) { console.error(e); replaykey.crashed(e); fatalOnce('The frame loop threw and has been stopped:', e); }   // no re-arm: stepping on with broken state would only bury this message under a cascade (scripted __runFrames still works for poking at it)
  }
  // Attract mode has just stopped under the start card with no fade (a poke): the world is a fresh encounter again and the camera is back on Sam, rooms away from the
  // last vantage — but a frozen frame steps nothing, so nothing of that reaches the GPU (the picture would stay the level as attract left it, patrols frozen
  // mid-stride, until Start), and the passes' temporal history is still the vantage's (the tour hides that frame of wholesale-rejected history under its veil;
  // there is no veil here). So, once, before the frame is drawn: one zero-length game step with the hands off the controls — nothing advances, nothing fires, it
  // only puts the fresh men, Sam, doors and props where they now are — and two unpresented renders from the restored view (as __shot renders), the first of which
  // replaces the vantage's history outright (reprojected from the old view it is rejected everywhere) and the second accumulates on it: the frame presented next
  // is a settled still of exactly what Start will hand over, not one frame of raw estimates over a stale room.
  function refreshFrozenStill() {
    const held = [...input.keys], btn = input.buttons; input.keys.clear(); input.buttons = 0;   // (the key that poked is still down: it must not pose Sam mid-stride or light his rail lamp in the still)
    for (let i = 0; i < 2; i++) {
      cam.update(0, game.followPos(), null);              // 1st: prevViewProj ← the vantage last drawn, the view itself snaps to the card's; 2nd: prev ← that view, so its history is taken up
      if (i === 0) game.update(0, input, cam, canvas);
      engine.render(cam, timeAcc, 0, false);
    }
    for (const k of held) input.keys.add(k); input.buttons = btn;
  }
  // THE FRAME: src/host/loop.ts stepFrame runs the one order main.ts always ran (the native entry runs the same function); what is DOM here — the menu / panel / recorder hotkeys, the
  // attract-stop still refresh, the show class + debrief card, the boot marks round the first render, perfrec's timings — goes in through the closures below.
  // THE FIXED STEP (host/loop.ts FIXEDSTEP; ON in the page — host/profile.ts pageSwitches raised it with the other boot switches): the game stepped in whole 1/60 s ticks
  // whatever the display's rate, ?fixedstep=0 = off (one update a frame, as before), ?fixedstep=<hz> = at another tick rate (30‥240); and a frame between two ticks drawn at
  // the blend of them (host/tween.ts TWEEN; ?tween=0 = every frame draws the last tick). Tab ▸ Frame ▸ 'fixed 60 Hz game step' / 'draw between ticks' flip them live;
  // __fixedstep = the knobs + what the last frame ran and drew.
  { const n = Number(q.get('fixedstep')); if (n >= 30 && n <= 240) FIXEDSTEP.hz = n; }
  const tween = new Tween(engine);
  let lastOfBurstNow = true;
  // Tab, while it is on trial (ui/tabkey.ts): 'run' = the pause card on 'Run so far' and back, 'keys' = Options ▸ Controls over a paused run and back. Never under a show.
  // 'brief' = a card of the objective in full and the squad over a held game, and back (ui/tabcard.ts) — what Tab does where nobody has chosen, on a page
  // somebody sits at (a page a script drives keeps Tab as it was: its checks press the key for other things).
  const tabEl = document.getElementById('tabcard'); let tabUp = false;
  const tabShow = (on: boolean) => { if (!tabEl) return; tabUp = on; tabEl.classList.toggle('on', on); if (on) tabEl.innerHTML = tabCardHtml(tabCardOf(game)); };   // (painted once: the game is held under it)
  const tabKey = (frozen: boolean) => {
    if (demo.active || game.director.showing || attract.live) return;
    const free = !frozen && !menu.isOpen;
    if (tabNow() === 'brief') { if (tabUp) tabShow(false); else if (free && !game.backable()) tabShow(true); return; }   // (never over a list, the order menu or a running verb, whatever backs out of those)
    if (tabNow() === 'run') { if (free) menu.openRun(); else if (menu.mode === 'pause' && !optionsOpen() && !missionsBusy()) { if (menu.runOpen) menu.close(); else menu.openRun(); } }   // (from a pause card Esc opened: the run first, then back to the game)
    else if (tabNow() === 'keys') { if (free) menu.open('pause'); if (free || (menu.mode === 'pause' && !optionsOpen() && !missionsBusy())) openOptions({ tab: 'controls', onTab: () => menu.close() }); }   // (from a pause card — one Esc opened, or the one left when Esc put the list away — the list first, then back to the game)
  };
  // THE LEVEL IS NOT DRAWN BEHIND A PAGE THAT HIDES ALL OF IT. The one starting page (ui/startpage.ts: `#missions.one`) and the options layer (`#options`) paint the menu's
  // own ground over the whole view, and the world under them is frozen: the frame behind is a still nobody sees, and drawing it again every display frame was the whole
  // renderer's cost for nothing (the maintainer on Team & kit, 10-12: "framerate isn't great here -- are we rendering this + the level?"). So once the still has settled
  // (`behind.warm` frames drawn since the page went up: the denoiser's and the resolve's histories) the render is skipped until the page comes down; the canvas keeps the
  // last frame presented. Still drawn: the title and the pause card (the level shows beside them), attract's live rooms, a script's frames, the boot calibration, a perf
  // recording or sweep, a replay. `?menurender` = drawn every frame as it was. `__behind` = the counts (tools/qa/menu-idle-page.cjs).
  const behind = { on: !q.has('menurender'), warm: 90, drawn: 0, skipped: 0, get hidden() { return viewHidden(); } };
  let behindSince = -1;   // (frames drawn when the page that hides the view went up; -1 = none is up)
  // (the options layer opened over a PAUSED run lets the frame show through on purpose — ui/options.ts `.over-game`: Brightness and the tier are judged against it — so it is drawn as ever)
  const viewCovered = (): boolean => !!brief?.held || menu.isOpen && !attract.live && (!!startPage() || (optionsOpen() && !document.getElementById('options')?.classList.contains('over-game')));
  const viewHidden = (): boolean => {
    if (!behind.on || !rendered || scripted || tape || !viewCovered() || quality.calibrating || perfsweep.active || perfsweep.freezing || bench.active || perfrec.recording) { behindSince = -1; return false; }
    if (behindSince < 0) behindSince = behind.drawn;
    return behind.drawn - behindSince >= behind.warm;
  };
  (window as any).__behind = behind;
  let scoreMission: unknown = game.mission;   // (the Mission the score last saw: a new one = a mission began)
  const loop: LoopCtx = {
    game, input, cam, view: canvas,
    host: engine, smoke, demo, attract, hud: overlay, bubbles,
    audio: { setListener: (p, f) => audio.setListener(p, f), update: (dt, t) => { audio.update(dt, t); audio.scoreMenu = menu.mode === 'start'; if (audio.music && !window.__forcedTension) audio.music.intensity = game.tension(MUSIC.theirs); if (game.mission !== scoreMission) { scoreMission = game.mission; audio.scoreSet = setlistOf(setlistLevel(levelFileQ), runningScenario(game, levelFileQ)?.kind ?? null); if (game.mission.stats.elapsed < 0.5) audio.music?.mission(); } } },   // (a fresh encounter is a fresh Mission with nothing on its clock: the score's cue that a mission began — audio/music.ts mission() — and, a scenario quit or started in the page being another kind of mission on the same level, where the level's own music is said again: audio/setlist.ts. A load, a recording's start and a show's scratch copy are new objects too, with a clock already run: not a cue. And while the main menu is up the score is the theme alone: music.ts `menu`)
    get time() { return timeAcc; }, set time(v: number) { timeAcc = v; },
    updateMs: 0,
    fixedStep: () => !scripted && !kitViewOn,   // (the fixed 60 Hz game step, host/loop.ts FIXEDSTEP: live frames only — a script's __runFrames names its own dt and gets exactly that; and never ?kitview's picture: host/kitView.ts stands its men round EVERY update from two hooks the loop calls once a frame, and a frame of two ticks or of none would leave updates unattended — it keeps one update a drawn frame under its own pacer, as it was built)
    betweenTicks: () => { hudExpireBubbles(game); engine.world.upload(true); },
    ctrlTwice,
    tween,
    vsyncDt: () => vsDt >= 0 ? vsDt : undefined,
    beforeTick: dt => handsTick(dt),
    timeScale: () => window.__timeScale ?? 1,
    frozen: () => (briefHolds() || (menu.isOpen && !attract.live) || perfsweep.freezing || bench.freezing || overlay.cardUp || tabUp) && !scripted,   // paused / start card: the world holds still, the picture stays live behind the card, hotkeys are off — unless attract mode has let the world go behind the start card (only once its opening veil is fully up): then the patrols walk
    present: () => !scripted || (lastOfBurstNow && !document.hidden),
    afterFreeze: (frozen) => { if (refreshStill) { refreshStill = false; if (frozen && canvas.clientWidth > 0 && canvas.clientHeight > 0) refreshFrozenStill(); } },   // (set by attract's onStop — refreshFrozenStill above; a stop that closed the card, i.e. the hand-over to the tour, needs none of it: that frame is live and under the tour's own veil)
    hotkeys: (frozen) => {
      if (bench.active) return;   // (hands off: P would quit its scene, F9 its recording)
      if (tabUp && (menu.isOpen || optionsOpen() || overlay.cardUp || scripted || tabNow() !== 'brief')) tabShow(false);   // (Tab's card, ui/tabcard.ts: a menu or a lesson's card over it, or a script taking the page, puts it away)
      if (!frozen && input.hit('BracketLeft')) engine.settings.exposure /= 1.25;
      if (!frozen && input.hit('BracketRight')) engine.settings.exposure *= 1.25;
      if (tabNow() !== 'off' && !(CMDRING.on && CMDRING.key === 'Tab') && input.hit('Tab') && !(BACKKEY.tab && !frozen && game.backable())) {   // (…unless Tab is backing out of something this frame: game/backkey.ts)
        if (tabNow() === 'who') { if (!frozen) input.pressed.add(game.orders.knobs.whoKey); } else tabKey(frozen); }   // (what Tab does, on trial: ui/tabkey.ts — 'who' = a press of the orders' own key, handed to this frame's tick)
      if (!frozen && input.hit('Backquote')) panel.toggle();   // the debugger (the tweak panel) is on backtick's code: the backslash key while empty hands are a slot (host/keymap.ts SLOT); Tab is left to the game, and the debug views are a row on its Frame page (no key steps them)
      if (frozen) { if ((menu.mode === 'pause' || tabUp) && !missionsBusy() && !optionsOpen() && input.hit('F5') && input.saveKey?.()) { savePend = { m: game.mission, time: game.time }; if (tabUp) tabShow(false); else menu.saveAsked(); } }   // (F5 on the pause card itself, no screen over it: the save by hand is written as play goes on — it is the recording's own input, so it goes through a tick like any press; a refusal is said on the feed there as ever)
      else if (savePend) { if (savePending()) input.pressed.add('F5'); else savePend = null; }   // (…handed over on every live frame until a tick has moved the clock: a frame with no tick keeps the press for the next one — host/loop.ts — and a card that came up again before any tick still has it)
      if (input.hit('F9')) perfrec.toggle();   // the perf recorder: works frozen or not (a pause-menu frame is data too)
      if (input.hit('F10')) sessionrec.toggle();   // the session journal: asks now, starts at the top of the next live update it may (a paused card holds it pending), stops at the end of one
      if (!frozen && input.hit('KeyP') && (demo.active || game.director.showing || game.director.handedOver)) endShow();   // P: over a running tour (by console; or a level-script program) stops it to the start card — and starts nothing: the showcases it once started are gone
      if (!frozen && demo.active) { if (input.hit('ArrowRight')) demo.jump(+1); if (input.hit('ArrowLeft')) demo.jump(-1); }   // tour: arrows step between stops (the timeline at the bottom is clickable too)
    },
    postUpdate: () => {
      vBooks();   // (what this machine keeps of the run that just ended, before its card is drawn)
      if (game.mission.debrief) { game.mission.debrief = false; menu.open('debrief'); }   // out with the drive: the end card (freezes the world like the pause menu; Esc / Keep playing resume, Again restarts)
      else if (game.verdict.takeDue()) menu.open('debrief');   // a squad's mission ended (taken, wiped, rescued, lost): the same card, a beat after — game/verdict.ts says when
    },
    render: (camR, t, dt, present) => {
      if (viewHidden() || (leanBurst && !lastOfBurstNow)) { if (leanBurst) engine.world.upload(true); behind.skipped++; perfrec.cpuRender = 0; return; }   // (an undrawn step of a lean burst still packs the world its tick left, as a draw would have: the cursor's ray reads that pack)
      behind.drawn++;
      const firstRender = !rendered;
      { const bc = document.body.classList; findMeOutline(engine.outline ??= makeOutlineFrame(), game, dt, !kitViewOn && !bc.contains('attract') && !bc.contains('blinded')); }   // the outline in the dark (host/findme.ts → render/outline.ts): off unless his Options ask, and never where the HUD's own marks of him stand down
      const tR = performance.now(); engine.render(camR, t, dt, present); perfrec.cpuRender = performance.now() - tR;
      if (picsDue.length && present) takeSavePictures();
      if (firstRender) {   // the boot timeline's last two marks: the first frame encoded + submitted (its CPU side, incl. every target's allocation), and the GPU through with it ('GPU ready')
        rendered = true; boot.span('firstFrameCpu', tR); boot.mark('firstSubmit');
        gpu.device.queue.onSubmittedWorkDone().then(() => { boot.span('firstFrameGpu', tR); boot.mark('gpuReady'); bootLine(); }).catch(() => { /* device lost */ });
      }
    },
  };
  (window as any).__fixedstep = { knobs: FIXEDSTEP, tween: TWEEN, get ticks() { return loop.ticks ?? 0; }, get owed() { return loop.fixed?.acc ?? 0; }, get drew() { return tween.stale ? null : { ...tween.last, lag: tween.lag }; } };
  // ?kitview (host/kitView.ts): this page is the start page's PICTURE of the team at the mission's way-in door, in an iframe there — staged once the scenario above
  // has stood its team, then live (the open card's man uses his kit at the door) or, `&stillkit`, frozen, drawn for a warm window and held; it takes the
  // loop's `frozen`, `render` and two seams over and is read-only on storage
  const kitView: KitView | null = kitViewOn ? kitViewStart({ game, engine, cam, input, view: canvas, loop, audio, team: () => teamOf(game), doorSide: sideOf, file: () => levelFileOf.get(game.level) ?? null, lampsOut: () => { const h = hourOf(game); return h !== 'night' && !HOURS[h].lamps; }, glowBox: (c, h, yaw, glow) => makeBox({ c, h, yaw, albedo: [0.04, 0.04, 0.04], emissive: glow, flags: BoxFlag.Emissive | BoxFlag.AreaLit }),   // (dark under its glow: at 0.9 a weapon light crossing it lit a hard white box on the wall — the owner's recording, 10-14; a guess at what that was, never seen on a GPU)
    kitCards: members => kitLoad({ getItem: () => JSON.stringify({ v: 2, own: true, stealth: true, members }), setItem: () => { /* nothing kept */ } }, location.search),
    kit: () => KIT.members, tiles: i => kitRows(i).map(r => r.field), smoke: n => squadSmokeStage(game, n),
    gun: i => kitGun(KIT.members[i]), tints: i => { const m = KIT.members[i]; return { suit: m.suit === 'issued' ? null : SUITS[m.suit].tint, trim: m.trim === 'issued' ? null : TRIMS[m.trim].tint }; },   // (written on the live men: a card changed under the picture's eye)
    samCard: () => { kitShow(game); kitPlayer(game); }, turn: spec => { setTurn(spec); },
    fire: (man, at) => { const c = man ? man.char : game.player.char, w = firearmOf(game, c, !man); if (!w.fire()) { w.rearm(); w.fire(); }   // (as every fire site: Firearm.fire() cycles the round out FIRST — the gun's own counters are what tracers.ts isTracerRound reads; a dry or reloading gun is stood up fresh for it. The view tops the magazine up as the row ends)
      fireWeapon(game, c, at, !man, { steady: true }); }, panes: () => glassMod.glassPanes(game).map(i => game.level.boxes[i]),
    mendGlass: () => { glassMod.resetGlass(game); resetGlassPen(game); } }) : null;
  let parSeen: ParResult | null = null;   // (the par result the page last saw: filed once, the frame it first appears)
  let parCheat = false;   // (a sandbox flag was on at some frame while this run's par clock ran: its time is not filed)
  // the verdict's bookkeeping (game/verdict.ts names how a run went; what this MACHINE keeps of it is the page's: ui/verdictStore.ts): `vRun` = the run the
  // three below belong to, `vKey` = the key it is kept under (mission + difficulty, read when the try starts), `vStreak` = which try of the streak it is
  // (0: not counted), `vDone` = its end has been filed
  let vRun: object | null = null, vKey = '', vStreak = 0, vCounted = false, vDone = false;
  const vNote = (rec: MissionRecord | null, streak: number, fresh: boolean) => { const ways: Record<string, { first: boolean; clean: boolean }> = {}; let n = 0; if (rec) for (const a of APPROACHES) { const w = rec.w[a]; if (w) { ways[a] = { first: w.tries === 1, clean: w.clean }; n++; } } return { streak, fresh, gold: n >= 2, ways }; };
  // a try started / a run ended (game/verdict.ts): counted and kept here, the page's side. A try is counted the frame it STARTS (so one given up is a
  // try all the same) and never under a cheat; a run loaded from a checkpoint is ANOTHER try (the load is the retry). The card is told what was kept
  // (`kept`) — so this runs before the card is opened (postUpdate: the stealth game's card opens on the very frame its run ends).
  const vBooks = () => { if (tape || kitViewOn) return; const VD = game.verdict;   // (?kitview: a beat at the door is nobody's run — no try counted, no end filed, no par below)
    if (VD.current !== vRun) { vRun = VD.current; vKey = ''; vStreak = 0; vCounted = false; vDone = false; }
    const lesson = () => lessonGroup(runningScenario(game, levelFileQ)?.entry?.group);   // a Training lesson is not a run to be won: no try counted, no way kept, and its card grades nothing
    if (VD.live && VD.started && !vCounted) { vCounted = true;
      vKey = verdictKey(runningScenario(game, levelFileQ)?.entry?.id ?? (levelFileQ ? `night:${levelFileQ}` : SOLO_ID), difficultyNow());
      vStreak = VD.cheat || lesson() ? 0 : tryStarted(vKey); }
    const R = VD.result;
    if (R && !vDone) { vDone = true;
      if (lesson()) VD.kept = { streak: 0, fresh: false, gold: false, ways: {}, lesson: true };
      else if (R.void || !vStreak) VD.kept = vNote(vKey ? recordOf(vKey) : null, 0, false);
      else { const K = runEnded(vKey, vStreak, { won: R.won, approach: R.approach, clean: R.clean, secs: R.secs }); VD.kept = vNote(K.rec, K.streak, K.fresh); } } };
  function step(dt: number, lastOfBurst = true) {
    sneakLabFrame(game, cam);   // (?sneaklab: the lab's two sandbox flags as its panel has them; a return on its first line otherwise)
    fireLabFrame(game);   // (?firelab: its two sandbox flags; a return on its first line otherwise)
    lastOfBurstNow = lastOfBurst;
    stressTick(game);   // (?extra=N / the panel's stress row: the asked-for extra enemies stood again after a restart — a return on its first line while off)
    lookTidy(engine.world);   // (picture only: a dado / damp foot the default look laid on a wall goes with that wall when it is holed — scene/lookTidy.ts)
    if (tape) tape.frame(dt); else stepFrame(loop, dt);   // (a replay owns the frame: the tape's steps, then the picture — replay/engineplay.ts)
    perfrec.cpuUpdate = loop.updateMs;
    // a par run just ended (game/par.ts): this machine's best for THIS run — level file, way in, squad size, difficulty — is filed here, the page's side,
    // and its words go on the HUD line the game already said. Never under a sandbox flag (god mode, no AI, unlimited ammo): that time is not a record —
    // and the flag counts if it was on at ANY frame while the clock ran (`parCheat`), not only on the frame the result appears.
    if (!tape && !kitViewOn) { const R = game.par.result();
      if (!game.par.started) parCheat = false; else if (game.godMode || !game.aiEnabled || game.infiniteAmmo) parCheat = true;
      if (R !== parSeen) { parSeen = R; if (R && !parCheat) game.par.best(parBest(`${levelFileQ ?? 'office'}|way${(game.roomClear.way ?? 0) + 1}|squad${game.nightBreach.ops.length}|${difficultyNow()}`, R.shown)); } }
    vBooks();   // (the verdict's bookkeeping again, for a try that started this frame and an end no card followed)
    simSm = simSm * 0.95 + loop.updateMs * 0.05;   // (the read-out's 'sim ms': Game.update on the CPU, eased as the fps row is)

    frameCount++;
    if (prewarmAt >= 0 && frameCount >= prewarmAt + 12) { smoke.clearAll(); engine.particles?.clear(); prewarmAt = -2; }   // the warm-up's throwaway can / spark (above; the can goes in the smoke lattice's own far corner — off the lattice nothing would be made and no reader would meet smoke): everything they touch has been touched
    hudReadout();
    tourVeil.style.opacity = String(demo.active ? demo.fade : game.director.showing ? (game.director.frame?.fade ?? 0) : attract.fade); document.body.classList.toggle('touring', !!show()); document.body.classList.toggle('attract', attract.active);   // (attract mode cuts under the same veil — its fade is 0 whenever it is not running — and thins the card's vignette while it runs: index.html body.attract)
  }
  /** the debug read-out's lines, every tenth frame (step() above calls it). NOT only text: `unionSm`, which the Tab panel's status strip reads, is eased in here */
  function hudReadout() {
    if (frameCount % 10 === 0) {
      const t = engine.timer; const lines: string[] = [];
      // one stat per line (a narrow column down the left edge reads better than three long rows across the picture)
      const row = (k: string, v: string) => k.padEnd(11) + v;
      lines.push(gpu.adapterInfo);
      if (perfrec.recording || perfNoteT > 0) lines.push(perfrec.recording ? (perfsweep.active ? '● REC (the sweep; F8 stops)' : bench.active ? '● REC (the benchmark; Esc stops)' : '● REC (F9 stops)') : perfNote);
      lines.push(row('res', `${engine.width}×${engine.height} ×${engine.settings.renderScale.toFixed(2)}${engine.capScale < 0.999 ? ` of ${engine.settings.maxInternalHeight}p` : ''}${engine.settings.taau ? ` → ${engine.outWidth}×${engine.outHeight} taau${engine.sharpOn ? ' sharp' : ''}` : ''}`));   // the render scale is relative to the cap: '1368×770 ×0.77 of 1000p → 1777×1000 taau' = 770 rows rendered under the 1000-row cap, resolved to 1000; no 'of' = the window itself is under the cap; no '→' = TAAU off (the canvas IS the internal size)
      lines.push(row('quality', `${quality.label}${quality.adaptive ? ' +adapt' : ''}`));
      lines.push(row('fps', `${fpsSm.toFixed(0)}`));
      lines.push(row('gpu ms', `${t.total(['composite', 'post', 'fxaa', 'gbuffer']).toFixed(2)}`));
      unionSm = unionSm * 0.9 + t.unionMs(['composite', 'post', 'fxaa', 'gbuffer', 'pdraw']) * 0.1;   // the UNION of the compute passes' intervals: what the frame really cost on the GPU — the Σ above double-counts passes Metal ran side by side (direct beside the cascade chain is normal at play cadence: docs/internal/p0a-cascades.md)
      lines.push(row('gpu ∪ ms', `${unionSm.toFixed(2)}`));
      lines.push(row('sim ms', `${simSm.toFixed(2)} · ${1 + game.guards.length + game.civilians.length} characters`));   // (the CPU's half: Game.update, and how many men it is stepping — bodies count; tools/qa/enemy-ceiling.ts measures the same call headless)
      const order = ['smoke', 'air', 'mesh', 'rc c4', 'rc c3', 'rc c2', 'rc c1', 'rc c0', 'rc dice', 'direct', 'dtemporal', 'softblur', 'gather', 'temporal', 'reflect', 'rdenoise', 'volFroxel', 'volInject', 'volTemporal', 'volInteg', 'volumetrics', 'particles', 'pdraw', 'sharpEdge', 'sharpU', 'compS', 'gbaa', 'taau', 'bloom', 'probe'];   // compute passes only (+ sharp direct's kernels while it is live: the edge mask (edge rays only), U, the composite) ('volFroxel' = the froxel kernels, or volInject / volTemporal / volInteg with passes.froxelSplitTiming; 'volumetrics' = the 2D pass): render-pass timestamps (gbuffer / composite / post / fxaa) on Metal span the wait for the drawable and read as ~one frame each, so they are left out rather than mislead ('mesh' = the mesh-shadow skin + refit, only while settings.meshShadows is on)
      for (const k of order) if (t.results.has(k) && t.ranThisFrame(k)) lines.push(row('  ' + k, t.results.get(k)!.toFixed(2)));   // (only passes that actually ran this frame: a dormant one — particles with nothing alive — used to sit here at its last busy value)
      lines.push(row('boxes', `${engine.world.all.length} (dyn ${engine.world.dynamics.length})`));
      lines.push(row('lights', `${engine.lights.activeCount}`));
      lines.push(row('smoke', `${smoke.stats.pool}/${smoke.grid.cap} bricks · ${smoke.stats.stepped} stepped · ${smoke.stats.emitters} em · ${smoke.stats.steps} disp`));
      lines.push(row('rc rays', `${(engine.rc.stats.intervals / 1e6).toFixed(2)}M`));
      lines.push(row('view', `${debugNames[engine.settings.debugView]} · exp ${engine.settings.exposure.toFixed(2)}`));
      lines.push(row('player', `vis ${(game.player.visibility * 100) | 0}% E=${game.player.irradiance.toFixed(3)}`));
      { const MEN = 8, rest = new Map<string, number>();   // every man of game.guards by CALLSIGN (the list holds the shift, Sam's own teammates and every spawned unit: 'guard 0‥3' was the squad), a side that is not the shift's named; the first MEN rows, then the others as counts per state — a squad mission's eleven defenders do not run the column off the screen
        game.guards.forEach((gd, i) => { if (i < MEN) lines.push(row((gd.callsign || `man ${i}`).slice(0, 10), `${gd.state} ${(gd.awareness * 100) | 0}${gd.team === 'operative' ? ' · team' : gd.team !== 'guard' ? ` · ${gd.team}` : ''}`)); else rest.set(gd.state, (rest.get(gd.state) ?? 0) + 1); });
        if (rest.size) lines.push(row(`+${game.guards.length - MEN} more`, [...rest].map(([st, n]) => `${n} ${st}`).join(' · '))); }
      lines.push(row('AI', game.aiEnabled ? 'on' : 'off'));
      hud.textContent = show() || !readout.on ? '' : lines.join('\n');   // the showcases keep the screen clean; in play the read-out is opt-in (Tab ▸ Frame ▸ debug read-out, or ?hud) now that the kit and the interaction panel live on the left
    }
  }
  // ---- READY: every hook above is on window. The real start card replaces the boot card (or the boot card goes, for a boot that opens no card: ?solo, a scenario, a replay), __ready resolves, the loop starts.
  tape?.attach({ game, canvas, cam, input, loop, engine: engine as never, smoke: smoke as never, audio, pre: () => { stressTick(game); lookTidy(engine.world); }, fingerprint: () => saveMod.levelFingerprint(game).fp });
  if (tape) soundLanes(tape, audio);   // the replay page's sound lanes: what the mixer was asked for, laid under the timeline (replay/soundlanes.ts)
  boot.mark('hooks');
  // THE LOAD BRIEF stays up, the world held still behind it (`frozen` below), until the player starts the run — on a page a person sits at. A page a script
  // drives, a benchmark, a show, or a mission whose start was refused (the start card says why) drops it here and goes on as before.
  const briefGo = !openStartCard && !automated && !benchOn() && !demo.active && !game.director.showing;
  if (openStartCard) { brief?.off(); menu.open('start');
    if (START_PAGE.on) { if (openMissionsIfAsked() && !startPage()) openStartPage(); }   // (ui/startpage.ts: the one page was put up by the boot card — `?loadout=` included; left on the list across a load: the page again)
    else if (missionsBusy() || !loadoutFromQuery(q)) openMissionsIfAsked(); } else if (brief && briefGo) brief.live(() => { audio.start(); input.focusGame(); }); else card.off();   // (?loadout=<mission id>: that mission's loadout screen over the card — ui/loadout.ts; else the mission list if the page was left on it. A screen the visitor opened off the boot card meanwhile stays the one that is up)
  loading.style.display = 'none';   // (the backdrop went before the first frame in the old boot too; the card is over the canvas until Start, and ?paused / a script that only __shot()s must not keep it)
  boot.mark('interactive'); boot.span('toInteractive', 0, performance.now()); gpuStory.stage = '';
  setTimeout(() => bootLine(), 5000);   // (the line prints at 'GPU ready'; a paused / hidden page that renders nothing still gets it, first-frame columns blank)
  readyResolve();
  boot.stopRafProbe();
  requestAnimationFrame(frame);
}

// ---- main()'s parts: each is a run of main()'s own lines moved out whole and called where it stood, in the same order; nothing inside one was rewritten. What still
// shares main()'s frame state (the shows, the menus, the automation hooks, the loop) stays in main().
/** the URL flags the Engine reads while it builds its pipelines — set before `new Engine` */
function urlFlagsBeforeEngine(q: URLSearchParams) {
  if (q.get('blastpace') === 'old') BLAST_PACE.on = false;   // ?blastpace=old: everything a wall going sets off is done on the frame it goes, as before (game/destructionSwitch.ts BLAST_PACE; same play, same masks and drip lines — one longer frame)
  if (q.get('reachpace') === 'old') REACH_PACE.whole = true;   // ?reachpace=old: reach masks after a wall changes land at the pace before the per-frame shares (render/reach.ts REACH_PACE; same masks, fewer and longer ticks)
  if (q.has('reachUniform')) reachBinding.storage = false;   // A/B only: force the reach rows' uniform binding (the adapter fallback itself is the Engine's decision — render/frame.ts, engine.ts)
  { const tv = Number(q.get('trace')); if (q.has('trace') && Number.isFinite(tv) && tv >= 0) traceConfig.variant = tv | 0; }
  if (glassMod.glassFxBoot() && (q.has('glassbreak') ? q.get('glassbreak') !== '0' : glassBreakPersisted())) glassBreakConfig.on = true;   // GLASS BREAKING (game/glassbreak.ts): the renderer's half is the scene prelude's compile-time const — raised here, before the Engine builds a pipeline, from the switch kept on this machine (Tab ▸ Destruction ▸ Glass; ?glassbreak / ?glassbreak=0 force it for one boot without touching the stored switch); off = every shader is main's program   // ?trace=N: the ray-traversal lab's compile-time variant const in every scene shader (render/frame.ts traceConfig, docs/internal/trace-perf.md; only 0 = today's walk exists on main) — must be set before the Engine builds any pipeline
  initCutSwitch(); roundConfig.gpu = ROUND.on && cutConfig.on;   // (ROUND THINGS, scene/round.ts: the GPU's half — the prelude's ROUND_BOXES const, the round bit, the prism's rows — set once, before the first pipeline. It needs the cut switch, whose table and pipeline draw a round: without that one a round is drawn and traced as the box round it, and the game meets the cylinder all the same)   // CUT BOXES (scene/cut.ts): on in the page unless ?nocutboxes / ?cutboxes=0 / localStorage twopointsix.cutboxes = '0' — the scene prelude's CUT_BOXES const, the cut table's rows in boxMat and the second g-buffer pipeline all follow it, so it is read before the Engine exists (a reload flips it)
  { const ds = Number(q.get('decalStress')); if (ds > 1) decalDebug.repeat = Math.min(64, ds | 0); }   // measurement only (?decalStress=N): the decal lookup N× per g-buffer fragment (render/decals.ts decalDebug), so its cost can be read above the timer's noise; must be set before the Engine builds the g-buffer shader
}

/** the URL flags written onto the fresh Engine's settings (before the level loads and any preset applies), and __sharp */
function urlFlagsOnEngine(engine: Engine) {
  if (new URLSearchParams(location.search).has('legacydenoise')) engine.settings.denoiser = 'legacy';   // ?legacydenoise: renderer v3 phase 3 off from boot — dtemporal + softblur, temporal + giblur, the gloss chain: the three old denoisers byte for byte
  if (new URLSearchParams(location.search).has('noleakfix')) engine.settings.dnShadowOccl = false;   // ?noleakfix: the shadow denoiser's occluded-light reading off from boot (settings.dnShadowOccl) — a hidden torch's cone can show faintly on a lit floor behind its wall, as it did
  if (new URLSearchParams(location.search).has('notaau')) engine.settings.taau = false;   // ?notaau: renderer v3 phase 1 off from boot — no jitter, output = internal, FXAA + the browser's bilinear: the old chain byte for byte (decided before the presets apply: they start at their TAAU scale only with it on)
  if (new URLSearchParams(location.search).has('nosharp')) { sharpForce.v = false; engine.settings.sharpDirect = false; }   // ?nosharp: sharp direct (decoupled resolution — engine.ts RenderSettings.sharpDirect) off from boot AND for every preset applied: main's frame under TAAU, for A/B and the identity hashes
  else if (new URLSearchParams(location.search).has('sharp')) { sharpForce.v = true; engine.settings.sharpDirect = true; }
  if (new URLSearchParams(location.search).has('gbaa')) { gbaaForce.on = true; engine.settings.gbaa = true; engine.settings.taauPhases = 0; }
  if (new URLSearchParams(location.search).has('noiq')) { iqForce.off = true; engine.settings.sharpDirect = false; engine.settings.sharpDecouple = false; engine.settings.gbaa = false; engine.settings.taauHistSharp = 0; }   // ?noiq: the image-quality program's resolve configuration all off = the resolve as it was (the identity A/B against main)   // ?gbaa: geometric edge AA on + the TAA's jitter off (the image-quality program's C3 by hand; the presets' own placement otherwise)
  if (new URLSearchParams(location.search).has('nomv')) engine.settings.motionIds = false;   // ?nomv: motion identity off — the g-buffer index-matches dynamic boxes as before (identity A/B)   // ?sharp: forced ON at every tier for the visit (the presets' own placement: ui/quality.ts Preset.iq)
  (window as any).__sharp = {   // sharp direct from the console: on / off, what it runs at, its memory
    get on() { return engine.settings.sharpDirect; }, set on(v: boolean) { engine.settings.sharpDirect = !!v; },
    get live() { return engine.sharpOn; },
    get edgeRays() { return engine.settings.sharpEdgeRays; }, set edgeRays(v: boolean) { engine.settings.sharpEdgeRays = !!v; },
    knobs: () => { const S = engine.settings; return { edgeRays: S.sharpEdgeRays, edgeSpread: S.sharpEdgeSpread, edgeHintPx: S.sharpEdgeHintPx, planeK: S.sharpPlaneK, sliver: S.sharpSliver, sliverCap: S.sharpSliverCap, diag: S.sharpDiag, gbaaClamp: S.gbaaClamp, heldRays: S.heldRays, hueSplit: S.restirHueSplit }; },
    set: (k: Partial<{ edgeRays: boolean; edgeSpread: number; edgeHintPx: number; planeK: number; sliver: number; sliverCap: number; diag: number; gbaaClamp: boolean; heldRays: number; hueSplit: boolean }>) => { const S = engine.settings; if (k.edgeRays !== undefined) S.sharpEdgeRays = !!k.edgeRays; if (k.edgeSpread !== undefined) S.sharpEdgeSpread = k.edgeSpread; if (k.edgeHintPx !== undefined) S.sharpEdgeHintPx = k.edgeHintPx; if (k.planeK !== undefined) S.sharpPlaneK = k.planeK;
      if (k.sliver !== undefined) S.sharpSliver = k.sliver; if (k.sliverCap !== undefined) S.sharpSliverCap = k.sliverCap; if (k.diag !== undefined) S.sharpDiag = k.diag; if (k.gbaaClamp !== undefined) S.gbaaClamp = !!k.gbaaClamp; if (k.heldRays !== undefined) S.heldRays = k.heldRays; if (k.hueSplit !== undefined) S.restirHueSplit = !!k.hueSplit; return (window as any).__sharp.knobs(); },   // (+ the direct-quality lane's knobs: the sliver rule / cap / paint, GBAA's clamp, the hybrid estimator's K — docs/internal/direct-quality.md)
    /** the sliver census of the LAST frame: sharpE[0]'s alpha carries the fallback code per output pixel (sharp_direct.wgsl SLIVERS) → counts {px, live, ring, sliver, traced, unshadowedDefault} + the per-row mask if asked (harness: tools/qa/dq-scenes.js) */
    census: async (mask = false) => { const t = engine.passes.sharpE[0]; if (!engine.sharpOn || !t) return null; const dev = engine.device; const w = t.width, h = t.height; const bpr = Math.ceil(w * 8 / 256) * 256; const buf = dev.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); const enc = dev.createCommandEncoder(); enc.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: bpr }, [w, h]); dev.queue.submit([enc.finish()]); await buf.mapAsync(GPUMapMode.READ); const u16 = new Uint16Array(buf.getMappedRange().slice(0)); buf.unmap(); buf.destroy();
      const f16 = (x: number) => { const e = (x >> 10) & 31, m = x & 1023; return e === 0 ? m * 5.960464477539063e-8 : (1 + m / 1024) * Math.pow(2, e - 15); }; let ring = 0, sliver = 0, traced = 0, unsh = 0; const m8 = mask ? new Uint8Array(w * h) : null;
      for (let y = 0; y < h; y++) { const row = y * bpr / 2; for (let x = 0; x < w; x++) { const c = Math.round(f16(u16[row + x * 4 + 3])); const k = c & 3; if (k === 1) ring++; else if (k === 2) sliver++; if (c & 4) traced++; if (c & 8) unsh++; if (m8) m8[y * w + x] = c; } }
      return { w, h, px: w * h, ring, sliver, traced, unshadowedDefault: unsh, sliverPct: +(100 * sliver / (w * h)).toFixed(3), tracedPct: +(100 * traced / (w * h)).toFixed(3), mask: m8 }; },
    summary: () => `sharp direct ${engine.settings.sharpDirect ? 'ON' : 'off'}${engine.sharpOn ? ` — live: g-buffer / U / composite / TAA at ${engine.outWidth}×${engine.outHeight}, stochastic terms at ${engine.width}×${engine.height} (+${((engine.passes.sharpBytes + engine.gbuffer.sharpBytes) / 1048576).toFixed(0)} MB: the output-size raster, the direct pair, the larger HDR target, the edge mask)` : engine.settings.sharpDirect ? ` — idle (${!engine.settings.taau ? 'TAAU off' : engine.settings.debugView ? 'debug view' : 'render scale 1.0: nothing to decouple'})` : ''}`,
  };
  if (new URLSearchParams(location.search).has('nortreflect')) { rtVeto.on = true; engine.settings.rtReflect = false; }
  if (new URLSearchParams(location.search).has('nogim')) { gimVeto.on = true; engine.settings.giFullRes = false; engine.settings.giYoungRays = 1; engine.settings.ladderClimb = false; engine.settings.capClimb = false; }   // ?nogim: GI-in-motion's switches off from boot AND its two renderer switches vetoed for the presets — the frame as it was before the lane (the identity hashes, A/B); the Tab rows still flip them by hand
  if (new URLSearchParams(location.search).has('nop5')) { p5Veto.on = true; engine.settings.giResample = 'off'; engine.settings.rtMeshHits = false; engine.settings.rtHitReuse = false; }   // ?nop5: renderer v3 phase 5's ultra extras off from boot AND vetoed for the presets — ultra's frame as it was before the phase (the identity hashes, A/B); the Tab rows still flip them by hand   // ?nortreflect: renderer v3 phase 4's reflection pass off from boot AND vetoed for the presets (auto's ladder re-applies them) — with ?detail=0 the untouched frame for A/B; the Tab row still flips it by hand
  { const dv = new URLSearchParams(location.search).get('detail'); if (dv !== null && isFinite(parseFloat(dv))) engine.settings.detail = Math.max(0, Math.min(1, parseFloat(dv))); }
  if (new URLSearchParams(location.search).has('nomarkings')) engine.settings.markings = false;   // ?nomarkings: the markings lane's pixel-art signifiers off from boot — nothing evaluated, no marking lights registered (with ?level=relief the frame main draws)
}

/** ?kitview only: the level that was built is a bespoke set's (bootLevel) */
let kitSetUp = false;
/** the boot's level: the bundled office or ?levelFile=, its boxes and lights into the host */
async function bootLevel(q: URLSearchParams, engine: Engine, tick: () => Promise<void>) {
  // ?levelFile=office-t20.json: boot on a level file fetched from the dev server's /levels/ (tools/levels-api.ts) instead of the bundled office — the review page's world-resolution
  // variants (tools/level-export.ts --texel) live there and nowhere in the bundle; a bad name falls back to the bundled office with a console error   // ?detail=0‥1: the g-buffer's detail layer amount from boot (0 = off: fsBox as it was)
  await tick();
  const tLv = performance.now();   // the level: parse + validate + load (the bundled office, or ?levelFile= off the dev server)
  let level = null as ReturnType<typeof buildLevel> | null;
  { const lf = q.get('levelFile');
    if (lf && /^[\w.-]+\.json$/.test(lf)) { try { /* (scene/look.ts: the level's file in the default look where it has one — ?look=plain = the file named; a look file that is not there = the file named) */ const lk = lookLevelFile(lf); let r = await fetch(`/levels/${lk}`, { cache: 'no-store' }); if (!r.ok && lk !== lf) { console.warn(`?levelFile=${lf}: its file in the default look (${lk}) did not load (HTTP ${r.status}) — the plain file`); r = await fetch(`/levels/${lf}`, { cache: 'no-store' }); } if (!r.ok) throw new Error(`HTTP ${r.status}`); const data0 = parseLevelData(await r.text(), kitViewOn ? {} : { kitView: 'drop' }) /* (a mission to PLAY is not refused for its Team & kit picture's block — left out, said once; the picture's own page and every tool refuse it) */, kvWay = kitViewOn ? kitViewWayOfLink(q, data0) /* (the way the mission the link starts stages its team on — a room clear's `way`, every other kind's one start: the child's stagedWay) */ : 0, data1 = kitViewOn ? kitViewSetLevel(data0, kvWay) : data0, data = kitViewOn && data1 === data0 ? kitViewAddLevel(data0, kvWay) /* (…or the level's own way with the pieces and lamps its `add` writes laid in after the level's: the picture's only, the mission as it is) */ : data1; kitSetUp = data1 !== data0;   /* (?kitview, and the way being staged names a bespoke SET: its boxes, doors and lamps instead of the level's, the level's paint, sky, moon and name kept — host/kitViewSet.ts. No set, or no ?kitview: the very data that was parsed) */ level = !kitSetUp && isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data);   /* (a level that is not the office: no office script, its scenarios are its own file's) */ } catch (e) { if (kitViewOn) throw e;   /* (?kitview: no picture of ANOTHER place — main()'s catch tells the start page there is none) */ console.error(`?levelFile=${lf}: falling back to the bundled office —`, e); } } }
  // (?kitview on the BUNDLED office — a mission with no ?levelFile=: its scenario data is code (levels/office.scenarios.ts), so a way of its block that names a
  //  bespoke SET goes through the same loader here. No block, no set on that way, or no ?kitview: buildLevel() exactly as before)
  if (!level && kitViewOn && OFFICE_SCENARIOS.kitView && q.get('level') === null) { try { const data0: LevelData = { ...OFFICE_DATA, scenarios: OFFICE_SCENARIOS }, kvWay = kitViewWayOfLink(q, data0), data = kitViewSetLevel(data0, kvWay); if (data !== data0) { level = loadLevel(data); kitSetUp = true; } else { const more = kitViewAddLevel(data0, kvWay); if (more !== data0) level = withOfficeScript(loadLevel({ ...OFFICE_DATA, boxes: more.boxes, lights: more.lights })); /* (the office's own way with its `add`: the office as buildLevel loads it, the pieces after its boxes — its scenarios are the script's, so THIS Level's block carries no `laid` word: the child never lays, kitView.ts planFor) */ } } catch (e) { console.error('?kitview: the office\'s set did not load — the office itself —', e); } }
  if (!level) level = buildLevel();
  if (level.markTexel) engine.settings.markingTexel = level.markTexel;   // the base texel the level's marking bitmaps were generated for (absent = 2.5 cm)
  populateHost(engine, level);   // the level's boxes into the world, its lights into the set (src/host/standup.ts — the same two loops the harness runs)
  engine.settings.skyZenith = level.sky.zenith; engine.settings.skyHorizon = level.sky.horizon;
  boot.span('level', tLv); boot.mark('level');
  return level;
}

/** __weather, __hour, __smoke */
function weatherHourHooks(game: Game, smoke: SmokeSystem) {
  (window as any).__weather = game.weather;
  // the hour (hours.ts): __hour.set('dusk') live, .sun(0.4) = the one number a cloud dims, .at([x,y,z]) = the hour's light the meter's stand-in adds there, .est(p, skipOwner) = that
  // stand-in whole (guards.ts lightEstimateAt: what the harness and the team's rules read) — beside `__game.sensors.read('playerChest')` it is the stand-in against the renderer's own meter
  HOUR.live = () => hourOf(game);   // (the mission sheet's no-load shortcut asks which hour the page is standing at: a checkpoint or the panel may have moved it off the visit's)
  (window as any).__hour = { ids: HOUR_IDS, table: HOURS, visit: HOUR, get id() { return hourOf(game); }, set: (id: string) => { applyHour(game, HOUR_IDS.includes(id as any) ? id as any : 'night'); return hourOf(game); },
    sun: (k?: number) => { if (k !== undefined) setSunStrength(game, k); return sunStrength(game); }, cloud: () => { sunToCloud(game); return sunStrength(game); }, light: () => hourSun(game), at: (p: [number, number, number]) => hourLightAt(game, p), est: (p: [number, number, number], skip = 0) => lightEstimateAt(game, p, skip ? (o: number) => o === skip : undefined), changed: () => hourWorldChanged(game), summary: () => hourSummary(game) };
  window.__smoke = smoke;
}

/** the sound table's own switches, from the address: `?oldsounds` · `?newsounds` (audio.ts SFX_TABLE) */
function sfxSwitches() { const q = new URLSearchParams(location.search); SFX_TABLE.was = q.has('oldsounds'); SFX_TABLE.redone = q.has('newsounds'); }
/** this page is kept silent: `?mute`, or the automation profile's localStorage twopointsix.testMute=1 */
function pageMuted(): boolean { return new URLSearchParams(location.search).has('mute') || (() => { try { return localStorage.getItem('twopointsix.testMute') === '1'; } catch { return false; } })(); }
/** the audio engine, the test-rig mute, and the gesture that starts it */
function pageAudio(game: Game) {
  const audio = new AudioEngine(game.col); game.audio = audio;   // col includes the door leaves as dynamic occluders
  audio.scoreSet = setlistOfQuery(location.search);   // the level's own music (audio/setlist.ts): which pieces of the score this page's level plays, in their order (as the URL names it; the frame loop says it again from the running game at every new mission)
  sfxSwitches();   // every sound as it was before they were redone · every redone one, the ones he picked the old of too (audio.ts SFX_TABLE; the mixer only: no rule reads it)
  // test-rig mute: '?mute' or localStorage twopointsix.testMute=1 (set once in the automation browser's profile) keeps this page silent —
  // master pinned at 0 and the context never started — so headless runs never come out of the maintainer's speakers
  const testMute = pageMuted();
  if (testMute) { audio.volume.master = 0; const sv = audio.setVolumes.bind(audio); audio.setVolumes = () => { audio.volume.master = 0; sv(); }; audio.start = () => {}; }
  // audio needs a user gesture: any click / key starts it (the start card's button is usually the first)
  window.addEventListener('pointerdown', () => audio.start(), { once: false }); window.addEventListener('keydown', () => audio.start(), { capture: true });   // (capture: Input claims game keys at window-capture and stops them there)
  return { audio, testMute };
}

/** __engine / __game / __audio, and the console hooks of what breaks: __anim, __killGuard, __glass, __shards, __doorblast (with ?nooffhinges), __glassbreak, __cut */
function worldHooks(engine: Engine, game: Game, audio: AudioEngine) {
  window.__engine = engine; window.__game = game; window.__audio = audio;
  (window as any).__anim = { LIFE, FEET };   // the animation's life layer / foot lock constants (character.ts): renderer noise measurements zero LIFE.on / FEET.on so a still man's silhouette holds still to the pixel (tools/qa/perf-harness.js)
  (window as any).__killGuard = (i: number, how: 'shot' | 'struck' | 'wounded' = 'shot', zone?: 'side' | 'leg', dir: Vec3 = [1, 0, 0]) => { const gd = game.guards[i]; if (!gd || gd.state === 'dead') return false; killGuard(game, gd, dir, how === 'struck', how, 'player', undefined, how === 'wounded' ? zone ?? 'side' : undefined); return true; };   // staging: drop guard i where he stands (a body on the floor for renderer captures — the torch-shadow boil scene)
  // __glass: the glass panes' console handles — on/off (the renderer's pane list), the knobs, a crack on the pane under the cursor or on a named pane, the numbers
  (window as any).__glass = {
    get on() { return engine.settings.glass; }, set on(v: boolean) { engine.settings.glass = !!v; },
    get reflect() { return engine.settings.glassReflect; }, set reflect(v: number) { engine.settings.glassReflect = v; },
    get tintDepth() { return engine.settings.glassTintDepth; }, set tintDepth(v: number) { engine.settings.glassTintDepth = v; },
    get dust() { return engine.settings.glassDust; }, set dust(v: number) { engine.settings.glassDust = v; },
    get refract() { return engine.settings.glassRefract; }, set refract(v: boolean) { engine.settings.glassRefract = !!v; },   // refraction through the glass boxes on / off (composite.wgsl glassRefractPath) and its index
    get ior() { return engine.settings.glassIor; }, set ior(v: number) { engine.settings.glassIor = v; },
    crack: () => game.crackTest(), summary: () => game.glassSummary(),
    hit: (bi: number, p: Vec3, dir: Vec3 | null = null) => glassMod.glassHit(game, bi, p, dir, 0, 'hand'),   // star pane bi at world point p as a round from `dir`'s side would (deterministic: the pattern is seeded off bi + p)
    get cracks() { return glassMod.crackCount(game); }, get listed() { return [...engine.world.glassList]; }, get panes() { return [...engine.world.glassStatics]; },
    state: () => glassMod.glassState(game), knobs: glassMod.GLASS,
    get fx() { return glassMod.GLASSFX.on; }, set fx(v: boolean) { glassMod.GLASSFX.on = !!v; glassMod.saveGlassFx(); },   // THE ONE SWITCH over fracture + rounds through + shards (glass.ts GLASSFX; the picture follows at the next boot)
  };
  // __shards: broken glass after it lets go (game/shards.ts) — the switch (persisted), the knobs, the counters, the live estimate, a hand test at a point
  (window as any).__shards = {
    get on() { return (game.tune as { glassShards?: boolean }).glassShards !== false; }, set on(v: boolean) { (game.tune as { glassShards?: boolean }).glassShards = !!v; saveShards(game); },
    get live() { return shardsLive(game); }, knobs: SHARDS, stats: SHARD_STATS, get log() { return game.shards.log; }, get particles() { return game.shards.live; }, get plates() { return game.shards.plateCount; },
    litter: () => [...game.shards.litter.entries()], underfoot: (p: Vec3) => game.shards.underfoot(p),
    test: (at: Vec3, dir: Vec3 = [0, 0, 1], area = 0.06, kind: 'piece' | 'dagger' | 'clump' | 'sheet' = 'piece', type: 'annealed' | 'tempered' | 'laminated' = 'annealed') => game.shards.test(at, dir, area, kind, type),
    save: () => saveShards(game), reset: () => game.shards.reset(), summary: () => game.shards.summary(),
  };
  // __doorblast: a blast takes a door off its hinges (game/doorblast.ts) — the switch (?nooffhinges = off from boot), the knobs, the counters, the log, which doors are off,
  // `blast(p, tearM?)` = the doors' side of a blast at p (no flash, no noise of its own), `tear(name, from?)` = that one leaf off away from `from` (default: Sam), `hang()` = all back
  if (new URLSearchParams(location.search).has('nooffhinges')) doorBlastMod.DOORBLAST.on = false;
  (window as any).__doorblast = {
    get on() { return doorBlastMod.DOORBLAST.on; }, set on(v: boolean) { doorBlastMod.DOORBLAST.on = !!v; },
    knobs: doorBlastMod.DOORBLAST, stats: doorBlastMod.DOORBLAST_STATS, log: doorBlastMod.DOORBLAST_LOG,
    off: () => game.doors.list.filter(d => d.off).map(d => ({ name: d.def.name, rest: !!d.slab?.rest, at: [...d.box.c] })),
    blast: (p: Vec3 = game.aimPoint, tearM = doorBlastMod.DOORBLAST.tearM.frag) => game.doors.blast([p[0], Math.max(p[1], 0.9), p[2]], tearM, 0).map(d => d.def.name),
    tear: (name: string, from: Vec3 = game.player.char.pos, k = 1) => { const d = game.doors.byName(name); return !!d && doorBlastMod.tearOff(game, d, from, 0, k); },
    hang: () => { for (const d of game.doors.list) if (d.off) d.reset(); }, summary: () => doorBlastMod.doorBlastSummary(game),
  };
  // __glassbreak: glass that comes apart into rigid shards (game/glassbreak.ts) — the switch (persisted; the GPU half follows at the next boot: `gpu`), the knobs, the counters, the pane
  // records, the same open-cell test the CPU raycast takes, the panel's break test, reset
  (window as any).__glassbreak = {
    get on() { return !!(game.tune as { glassBreak?: boolean }).glassBreak; }, set on(v: boolean) { (game.tune as { glassBreak?: boolean }).glassBreak = !!v; saveGlassBreak(game); },
    get gpu() { return glassBreakConfig.on; }, get live() { return glassBreakLive(game); },
    knobs: GLASSBREAK, stats: GB_STATS, get log() { return game.glassBreak.log; },
    panes: () => [...game.glassBreak.panes.values()].map(st => ({ bi: st.bi, type: st.type, exterior: st.exterior, sites: st.sites.length, run: st.run, hits: st.hits, energy: st.energy, out: st.nOpen, gone: st.gone, open: game.glassBreak.openFraction(st.bi), walkable: st.walkable, log: st.log.slice(-6) })),
    openAt: (p: Vec3, bi?: number) => { if (bi !== undefined) return game.glassBreak.openAt(bi, p); for (const i of engine.world.glassStatics) if (game.glassBreak.openAt(i, p)) return true; return false; },   // (no pane given: any pane whose fallen cell holds p — the CPU rule raycast / segmentBlocked use)
    hit: (bi: number, p: Vec3, dir: Vec3 = [0, 0, -1], n = 1) => { for (let k = 0; k < n; k++) glassMod.glassHit(game, bi, p, dir, 0, 'hand'); return game.glassBreak.panes.get(bi) ?? null; },   // n rounds' worth at p through glass.ts (star + noise + the impact)
    blast: (p: Vec3, opts: { radius?: number; power?: number; who?: number } = {}) => game.glassBreak.blast(p, opts), impact: (bi: number, p: Vec3, dir: Vec3 = [0, 0, -1], energy = 1) => glassMod.glassImpact(game, bi, p, dir, energy, 0, 'hand'), setType: (bi: number, t: 'annealed' | 'tempered' | 'laminated' | null) => game.glassBreak.setType(bi, t), info: (bi: number) => game.glassBreak.paneInfo(bi), test: () => game.glassBreak.breakTest(), reset: () => game.glassBreak.reset(), summary: () => game.glassBreak.summary(),
  };
  // __cut: cut boxes (scene/cut.ts; the contract: docs/internal/cut-boxes-contract.md) — the boot switch, what the last upload listed, and test pieces: `test(at, kind)` stands a
  // wedge / shard / snapped plank / faceted lump at `at` as a dynamic box (kept until `clear()`); with the switch off the same call stands the whole boxes (the record is ignored)
  const CUT_TEST_KEY = MKEY.test + 0x8000; let cutSerial = 0;   // (clear of the moths' 0x4000s and of a broken fixture's 0x5000‥0x6FFF, game/fixtureBreak.ts: one key, one box — the fog's thing rule reads a fixture's low parts as one body)
  (window as any).__cut = {
    get on() { return cutConfig.on; }, set on(v: boolean) { try { localStorage.setItem('twopointsix.cutboxes', v ? '1' : '0'); } catch { /* no storage */ } },   // (persisted; the build follows at the next boot)
    get stats() { return { ...engine.world.cutStats, drawn: engine.world.visibleCutCount, drawnWhole: engine.cutWhole, traced: engine.world.cutTraced }; },
    /** A CALM ROOM PAYS NOTHING (render/cutSwap.ts): which ray programs the frame dispatches — `live` true = the set with the cut rule (taken while a cut piece a ray can meet is alive), false = the boot's;
     *  `ready` resolves once the second set is compiled; `force` 'cut' | 'base' | null pins a set by hand (the cost lab's rows) */
    programs: { get swap() { return cutSwap.enabled; }, get state() { return cutSwap.state; }, get live() { return cutSwap.live; }, get ready() { return cutSwap.ready ?? Promise.resolve(false); }, get force() { return cutSwap.force; }, set force(v: 'cut' | 'base' | null) { cutSwap.force = v === 'cut' || v === 'base' ? v : null; },
      get info() { return { swap: cutSwap.enabled, state: cutSwap.state, live: cutSwap.live, force: cutSwap.force, pipelines: cutSwap.pipelines, owners: cutSwap.built, buildMs: Math.round(cutSwap.buildMs), swaps: cutSwap.swaps, traced: engine.world.cutTraced, drawnWhole: engine.cutWhole, hot: cutSwap.hotPinned, error: cutSwap.error }; } },
    mod: cutMod,
    test: (at: Vec3, kind: 'wedge' | 'shard' | 'snap' | 'lump' = 'wedge', opts: { yaw?: number; scale?: number; albedo?: Vec3; core?: Vec3; rot?: [number, number, number, number] } = {}) => {
      const k = opts.scale ?? 1, yaw = opts.yaw ?? 0, albedo: Vec3 = opts.albedo ?? [0.62, 0.6, 0.56];
      let h: Vec3, cut: CutPlane[] | undefined, off: Vec3 = [0, 0, 0];
      if (kind === 'wedge') {          // a ramp: the box sliced corner to corner across its x–y section — floor face, back face, the slope
        h = [0.5 * k, 0.4 * k, 0.35 * k]; cut = cutMod.cutRecord(h, [cutMod.cutThrough3([-h[0], -h[1], -h[2]], [h[0], h[1], -h[2]], [h[0], h[1], h[2]])]).cut;
        if (cut && cutMod.cutContains(h, cut, [-h[0] * 0.5, h[1] * 0.5, 0])) cut = [{ n: [-cut[0].n[0], -cut[0].n[1], -cut[0].n[2]], d: -cut[0].d }];   // keep the half under the slope (thick end at +x)
      } else if (kind === 'shard') {   // a triangular pane fragment standing on edge
        const pr = cutMod.cutPrism(2, 0.012 * k, [[-0.3 * k, 0], [0.26 * k, 0], [0.05 * k, 0.75 * k]]); h = pr.h; cut = pr.cut; off = pr.off;
      } else if (kind === 'snap') {    // a plank whose end broke off on two skew planes
        h = [0.7 * k, 0.03 * k, 0.09 * k]; cut = cutMod.cutRecord(h, [cutMod.cutThrough([0.45 * k, 0, 0], [1, 0.25, 0.5]), cutMod.cutThrough([0.5 * k, 0, 0], [1, -0.3, -0.6])]).cut;
      } else {                         // a rubble lump: a cube with its corners knocked off
        h = [0.22 * k, 0.18 * k, 0.2 * k]; const pl: CutPlane[] = [];
        for (let i = 0; i < 8; i++) { const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1, sz = i & 4 ? 1 : -1, f = 0.55 + 0.3 * (((i * 2654435761) >>> 0) % 97) / 97; pl.push(cutMod.cutThrough([sx * h[0] * f, sy * h[1] * f, sz * h[2] * f], [sx / h[0], sy / h[1], sz / h[2]])); }
        cut = cutMod.cutRecord(h, pl).cut;
      }
      const o = opts.rot ? quat.rotate(opts.rot, [off[0], 0, off[2]]) : [off[0] * Math.cos(yaw) + off[2] * Math.sin(yaw), 0, -off[0] * Math.sin(yaw) + off[2] * Math.cos(yaw)];   // (the prism's fit offset, in the box's frame)
      const box = makeBox({ c: [at[0] + o[0], at[1] + h[1] + o[1], at[2] + o[2]], h, yaw, rot: opts.rot, albedo, flags: BoxFlag.Dynamic, cut }); if (opts.core) box.cutCore = opts.core;   // (core: the colour the cut faces show)
      box.mkey = CUT_TEST_KEY + (cutSerial++ & 0xFFF);
      game.fx.push({ box, ttl: 1e12 });
      return box;
    },
    clear: () => { for (let i = game.fx.length - 1; i >= 0; i--) { const m = game.fx[i].box.mkey ?? 0; if (m >= CUT_TEST_KEY && m < CUT_TEST_KEY + 0x1000) game.fx.splice(i, 1); } },
    ray: (o: Vec3, d: Vec3, max = 100) => engine.world.raycast(o, d, max),   // the CPU's answer along a ray (BoxWorld.raycast: cut-aware under the switch; like the game's own lines it passes a blown wall's look pieces, MKEY.look)
  };
}

/** the squad's switches off the URL (cover, door closers, handle side, door manners, enemy lasers), the fog frame, and the hooks of the squad's modules and scenarios */
function squadFlagsAndHooks(q: URLSearchParams, engine: Engine, game: Game) {
  (window as any).__pairup = { get on() { return PAIRUP.on; }, set on(v: boolean) { PAIRUP.on = v; pairUpApply(!v); }, rules: PAIRUP, stats: PAIRUP_STATS, summary: pairUpSummary };   // the pair's one switch (game/pairup.ts): .on = true turns the three parts on
  (window as any).__pair = game.pair;   // quiet orders for one partner (game/pairorders.ts): .up / .mark() / .jobOf(gd) / .stage(foe) / .darkSpot(p) / .litAt(p) / .summary()
  (window as any).__orders = game.orders;   // squad orders (game/orders.ts): .give(id, target?, who?) / .targetAt(p) / .who / .cycleWho() / .address(gd) / .open(target?) / .pick(i?) / .turn(page) / .pageBack() / .close() / .menu (.page: null = the first page, 'tools' = a door's tools) / .log / .summary() / .knobs
  // FOG OF WAR (game/fogofwar.ts — a try at the Door Kickers rule): on under the room-clear flag, ?fow (or ?fogofwar) forces it on and ?nofow (?nofogofwar) off; the renderer's pass
  // reads the game's FogFrame through engine.fogFrame. __fow = the object: .on, .knobs, .eyes, .seen(guard), .drawn(guard), .hiddenChars, .stats, .summary()
  engine.fogFrame = game.fogOfWar.frame;
  // ?squad4[=seed]: the FOUR-MAN SQUAD (nightbreach.ts NIGHTBREACH.squad — a red pair and a blue pair where the playtests stage the one pair) in the room clear;
  // beside ?nightbreach it is that playtest with four instead. Without it both stage the pair exactly as they always did. The hostage rescue stages its own pair
  // (rescue.ts), so beside ?rescue the flag changes nothing: the rescue wins and says so.
  // (the squad's size and fog of war are written where the scenario is started: game/scenarioRun.ts startFromQuery, below)
  // ?nocover: the teammates' unasked cover off (cover.ts) — followers and holders look where their order alone has them look, as before it
  if (q.has('nocover')) COVER.on = false;
  // ?noroomfit: the squad sent to a spot stands in a line abreast across the way Sam pointed, all facing it, as before roomfit.ts dealt each man a place and
  // a watch that fit the room (for a visit: not kept)
  if (q.has('noroomfit')) ROOMFIT.on = false;
  // ?doorclosers: every leaf has its hydraulic closer again and swings to behind whoever went through it, as before doors.ts DOORSTAY (for a visit: not kept).
  // __doors: the switch (`stay`), and where every leaf stands
  if (q.has('doorclosers')) DOORSTAY.on = false;
  // ?nohandleside: the AI's men open doors with their bodies wherever their walk meets the leaf, as before handleside.ts (for a visit: not kept). __handle: the switch, its rules, the counters
  if (q.has('nohandleside')) HANDLE.on = false;
  if (q.get('leafround') === '0') DOORMANNERS.leafRound = false;   // ?leafround=0: a teammate walks into the back of a leaf standing open across his walk, as before (for a visit: not kept; its Tab row keeps its own)
  if (q.has('nodoormanners')) DOORMANNERS.on = false;   // ?nodoormanners: nobody waits or steps aside at a doorway, as before doorway.ts (for a visit: not kept; the Tab rows under the squad's feel keep theirs)
  (window as any).__handle = { get on() { return HANDLE.on; }, set on(v: boolean) { HANDLE.on = !!v; }, knobs: HANDLE, stats: HANDLE_STATS };
  (window as any).__doors = { get stay() { return DOORSTAY.on; }, set stay(v: boolean) { DOORSTAY.on = !!v; }, get exitsOut() { return DOORWAY.exitsOut; }, set exitsOut(v: boolean) { DOORWAY.exitsOut = !!v; }, swings: () => game.doorSwings, list: () => game.doors.list.map(d => ({ name: d.def.name, angle: +d.angle.toFixed(3), latched: d.latched, locked: d.locked, closing: d.closing })) };
  // (?hard / ?difficulty= / ?pressure / ?digin — the harder defenders — were read before the boot card went up: initDifficulty above)
  // ?enemylasers: enemies carry their visible weapon lasers again, as before combat.ts LASER (for a visit: not kept)
  if (q.has('enemylasers')) LASER.enemy = true;
  Object.defineProperty((window as any).__doors, 'frameHolds', { get: () => DOORWAY.frameHolds, set: (v: boolean) => { DOORWAY.frameHolds = !!v; }, enumerable: true });   // __doors.frameHolds: the frame holds a boot from the face a door opens toward (doors.ts DOORWAY.frameHolds — also ?frameholds=0)
  (window as any).__fow = game.fogOfWar;
  (window as any).__nightbreach = game.nightBreach;   // ?nightbreach: the night TEAM breach playtest (game/nightbreach.ts) — .start() / .stop() / .restage() / .order() / .knobs / .state / .summary() / .log
  (window as any).__roomclear = game.roomClear;   // ?roomclear[=seed]: the room clear (game/roomclear.ts) — the night breach on a structure of four held rooms — .start(seed?) / .stop() / .restage() / .rooms / .end / .state / .team / .placement / .knobs / .summary() / .log
  (window as any).__wallcharge = game.wallCharge;   // the wall charge (game/wallcharge.ts): .set / .ops / .blow() / .order(at) / .summary() / .log / .knobs
  (window as any).__doortools = game.doorTools;   // the squad's door tools (game/doortools.ts): .charges / .bangs / .ops / .set / .blow() / .summary() / .log / .knobs
  (window as any).__picture = { knobs: PICTURE, stats: PICTURE_STATS, summary: () => pictureSummary(game), views: () => pictureViews(game), ideas: (i: number) => ideasOf(game, game.guards[i]).map(I => ({ who: I.who === 'player' ? -1 : game.guards.indexOf(I.who), at: I.at, age: game.time - I.t, how: I.how, lost: I.lost })), tell: (i: number, who: number, at: [number, number, number], age = 0) => pictureTell(game, game.guards[i], who < 0 ? 'player' : game.guards[who], at, age) };   // each man's own picture of the fight (game/picture.ts): .knobs / .stats / .summary() / .views() = what the floor view draws / .ideas(i) = guard i's ideas / .tell(i, who, at, age) = hand guard i an idea (tests)
  (window as any).__runner = { knobs: RUNNER, stats: RUNNER_STATS, of: (i: number) => runnerOf(game.guards[i]), break: (i: number) => runnerBreak(game, game.guards[i]) };   // drops it and runs (game/runner.ts): .knobs / .stats / .of(i) = guard i's run, null when he has none / .break(i) = break guard i into it (tests)
  (window as any).__planlay = { knobs: PLANLAY, stats: PLANLAY_STATS, get laid() { return game.orders.lay.laid; }, get kept() { return game.orders.lay.kept; }, summary: () => laySummary(game), send: () => laySend(game), clear: () => layClear(game) };
  (window as any).__autopilot = { knobs: AUTOPILOT, stats: AUTOPILOT_STATS, pick: (at: [number, number, number]) => autoPick(game, game.orders.targetAt(at)) };
  (window as any).__squadthrow = { knobs: SQUADTHROW, stats: SQUADTHROW_STATS, plans: () => squadThrowPlans(game), plan: (at: [number, number, number], kind: 'frag' | 'stun', who: 'all' | 'red' | 'blue' = 'all') => squadThrowPlan(game, game.orders.men(who), at, kind, true) };   // teammates' throws on order (game/squadthrow.ts): .plans() = what the overlay draws (who, his walk, the arc), .plan(at, kind) = who would throw there and from where
  (window as any).__lightswitch = { knobs: LIGHTSWITCH, stats: LIGHTSWITCH_STATS, list: () => wallSwitches(game), lit: (i: number) => { const sw = wallSwitches(game)[i]; return sw ? switchLit(sw) : null; } };   // a room's wall switches (game/lightswitch.ts): tools/qa/lightswitch-page.cjs reads the plates and works one through the page's own Space
  (window as any).__round = { knobs: ROUND, config: roundConfig, stats: ROUND_STATS, list: () => engine.world.statics.map((b, i) => ({ i, b })).filter(e => e.b.round === true) };   // round things (scene/round.ts): the switch, its GPU half, and the level's round boxes
  (window as any).__carlamps = { knobs: CARLAMPS, stats: CARLAMPS_STATS, list: () => game.targets.filter(t => t.group === VEHICLE_GROUP) };   // a parked vehicle's lamps as light targets (game/carlamps.ts): what the level gave and how many a round has met
  (window as any).__cleanrestart = { knobs: CLEANRESTART, stats: CLEANRESTART_STATS };   // a restart gives a clean level (game/cleanrestart.ts): tools/qa/cleanrestart-page.cjs reads what a restart did
  (window as any).__squad40 = { knobs: SQUAD40, stats: SQUAD40_STATS, log: SQUAD40_LOG, left: () => squad40Left(game), brought: () => squad40Brought(game), of: (i: number) => squad40Of(game, game.orders.squad()[i]), plans: () => squad40Plans(game), summary: () => squad40Summary(game),
    stage: (rounds: number[]) => squad40Stage(game, game.orders.squad().map((gd, i) => [gd, rounds[i] ?? 0] as const)) };   // a teammate's 40 mm grenade on order (game/squad40.ts)
  (window as any).__fight = game.fight;   // the room fight (game/roomfight.ts): .summary() / .log / .stats / .knobs / .skill (FIGHT_SKILL) / .watchOf(guard) / .teamSees(guard)
  (window as any).__rescue = game.rescue;   // ?rescue: the HOSTAGE RESCUE playtest (game/rescue.ts) — .start() / .stop() / .restage() / .press() (= F) / .orderDoor() / .callOff() / .entry / .knobs / .state / .summary() / .log
}

/** __qrf, __civ, __wounds, __needs */
function soloNightHooks(game: Game) {
  (window as any).__qrf = { request: (why = 'panel') => requestQrf(game, why as never), perimeter: (why = 'panel') => callPerimeter(game, why), standDown: () => qrfStandDown(game), get state() { return game.qrf; } };   // automation / console: force the response team without going loud (qrf.ts)
  (window as any).__civ = { get list() { return game.civilians; }, panic: (i = 0, what: 'panic' | 'phone' = 'panic') => civPanic(game, game.civilians[i], what), set: (on: boolean) => setCivilians(game, on), knobs: CIV, stats: CIV_STATS, log: CIV_LOG, get spots() { return civSpots(game); }, check: () => checkCivSpots(game), summary: () => game.civiliansSummary() };   // automation / console: the civilians (civilians.ts) — __civ.panic(0) frightens the cleaner where she stands, .panic(0, 'phone') sends her to ring it in, .set(false) clears them off the floor, .log the last things that happened, .check() the marks / spots against the nav grid
  (window as any).__keys = keymap;   // the player's own keys (host/keymap.ts): the table, a row put on a key, Reset
  (window as any).__wallsnap = WALLSNAP;   // the wall hold's feel pass: every number live (wallsnap.ts)
  (window as any).__gear = GEAR;           // the 2010s issue kit: the switch, live (gear.ts — words and drawn boxes only)
  (window as any).__wounds = { get on() { return WOUND.on; }, set on(v: boolean) { WOUND.on = !!v; }, knobs: WOUND, get stats() { return WOUND_STATS; }, men: () => woundedMen(game).map(x => ({ who: x.callsign, team: x.team, ...x.wound })) };   // ?wounds (game/wounds.ts): where a round lands decides — dead, or down wounded and out of the fight
  // __doze: dozing in the dark (game/doze.ts) — the switch and numbers, what the rule has of each man, every wake in order
  (window as any).__doze = { DOZE, DOZE_STATS, DOZE_LOG, of: (i = 0) => dozeOf(game.guards[i]), summary: () => dozeSummary(game), asleep: () => game.guards.filter(dozeAsleep).map(x => x.callsign), atScreen: () => game.guards.filter(x => dozeAt(x) === 'screen').map(x => x.callsign) };
  (window as any).__needs = { send: (i = 0, kind: NeedKind = 'coffee') => needsSend(game, game.guards.filter(x => x.team === 'guard' && !x.unit)[i], kind), trip: (i = 0) => needsTrip(game.guards.filter(x => x.team === 'guard' && !x.unit)[i]), knobs: NEEDS, stats: NEEDS_STATS, log: NEEDS_LOG, summary: () => game.needsSummary() };   // automation / console: the needs (needs.ts) — __needs.send(0) = 'send Kowalski for a coffee' with the whole telegraph, .trip(0) his trip record, .log the last things that happened
}

/** the renderer URL flags that stood above `new Quality` (?norestir ?norestirmotion ?restirmotion ?nofroxel ?froxel ?nosmokediffuse ?gatherStrata ?nogatherstrata) and the __hot* shader swaps they sat among, __froxel, __rt, __gs */
function rendererFlagsAndHotSwaps(engine: Engine) {
  // __hotVol(src?): recompile the volumetric pass from a volumetrics.wgsl variant against the live device and swap it in (passes.hotSwapVol) — no src = refetch
  // the file as it is on disk from the dev server (/qa/shader/volumetrics.wgsl), so an edit can be timed against a staged stress scene without rebooting it
  (window as any).__hotVol = async (src?: string) => engine.passes.hotSwapVol(src ?? await (await fetch('/qa/shader/volumetrics.wgsl', { cache: 'no-store' })).text());
  const hotCommon = async () => (await fetch('/qa/shader/direct_common.wgsl', { cache: 'no-store' })).text();   // both direct-light estimators get direct_common.wgsl prepended, as passes.ts builds them
  (window as any).__hotDirect = async (src?: string) => engine.passes.hotSwapDirect(src ?? await (await fetch('/qa/shader/direct.wgsl', { cache: 'no-store' })).text(), 'direct', await hotCommon());   // the same for the direct-light pass (direct.wgsl variants — the settings.restir OFF path)
  (window as any).__hotRestir = async (src?: string) => engine.passes.hotSwapDirect(src ?? await (await fetch('/qa/shader/restir.wgsl', { cache: 'no-store' })).text(), 'restir', await hotCommon());   // … and for restir.wgsl (the ON path)
  (window as any).__hotSharp = async (src?: string) => engine.passes.hotSwapSharp(src ?? await (await fetch('/qa/shader/sharp_direct.wgsl', { cache: 'no-store' })).text(), await hotCommon());   // … sharp_direct.wgsl (both variants; direct-quality lane)
  (window as any).__hotGbaa = async (src?: string) => engine.passes.hotSwapGbaa(src ?? await (await fetch('/qa/shader/gbaa.wgsl', { cache: 'no-store' })).text());   // … gbaa.wgsl
  if (new URLSearchParams(location.search).has('norestir')) engine.settings.restir = false;   // ?norestir: the leader / tail direct-light estimator (direct.wgsl) from boot — renderer v3 Phase 2a's untouched path, for A/B
  { const q = new URLSearchParams(location.search); if (q.has('norestirmotion')) engine.settings.restirMotion = 0; const rm = q.get('restirmotion'); if (rm !== null && rm !== '') engine.settings.restirMotion = Math.max(0, Math.min(7, parseInt(rm, 10) || 0)); }   // ?norestirmotion / ?restirmotion=N: the direct-motion lane's reservoir-reprojection levers from boot (docs/internal/direct-motion.md; 0 = the estimator's program byte for byte)
  // __hotFroxel(src?): the same for the froxel kernels (froxel.wgsl → render/froxels.ts hotSwap; the cull / inject / temporal / integrate pipelines swapped together)
  (window as any).__hotFroxel = async (src?: string) => engine.passes.froxels.hotSwap(src ?? await (await fetch('/qa/shader/froxel.wgsl', { cache: 'no-store' })).text());
  if (new URLSearchParams(location.search).has('nofroxel')) { froxelVeto.on = true; engine.settings.froxelVol = false; }
  if (new URLSearchParams(location.search).get('nvoval') === '1') engine.passes.nvOval = 1;   // ?nvoval=1: the goggles' dark oval over the picture, as it was (off by default: it hid too much of the screen — picture only, nothing reads it)
  if (new URLSearchParams(location.search).has('nosmokediffuse')) engine.passes.smokeDiffuse = 0;   // ?nosmokediffuse: smoke attenuates only, nothing behind it blurred (the final blit as it was)
  if (new URLSearchParams(location.search).has('froxel')) { froxelForce.on = true; engine.settings.froxelVol = true; }   // ?froxel: the froxel path forced even at ultra / high (their presets ship the classic per-pixel march since 08-12) — the A/B   // ?nofroxel: froxel volumetrics off from boot — the per-pixel volumetric march exactly as it was (Tab ▸ Volumetrics — froxels flips it live)
  // __froxel: the froxel volume for the console / automation — the grid, memory, history state, the knobs by name, a history restart
  (window as any).__froxel = {
    get on() { return engine.settings.froxelVol; }, set on(v: boolean) { engine.settings.froxelVol = !!v; },
    get grid() { return { ...engine.passes.froxels.grid, clusters: engine.passes.froxels.clusterDims(), k: engine.settings.froxelK, mb: +(engine.passes.froxels.bytes / 1048576).toFixed(1) }; },
    get state() { const f = engine.passes.froxels; return { allocated: f.allocated, histValid: f.histValid, age: f.age, idle: f.idle, remakes: f.remakes, last: f.lastRemake, split: engine.passes.froxelSplitTiming }; },
    set(k: string, v: number | boolean) { const S = engine.settings as unknown as Record<string, unknown>; const key = k.startsWith('froxel') ? k : 'froxel' + k[0].toUpperCase() + k.slice(1); if (!(key in S)) return false; S[key] = v; return true; },
    split(on = true) { engine.passes.froxelSplitTiming = !!on; return engine.passes.froxelSplitTiming; },
    restart() { engine.passes.froxels.restartHistory(); return true; },
    summary() { const f = engine.passes.froxels, S = engine.settings; return `froxels ${S.froxelVol ? 'on' : 'OFF'} · ${f.grid.w}×${f.grid.h}×${f.grid.d} k ${S.froxelK} strata ${S.froxelTopRays} hist ${S.froxelHistory} · ${f.allocated ? (f.bytes / 1048576).toFixed(1) + ' MB' : 'no grid'} · near ${S.froxelNear} far ${S.froxelFar} curve ${S.froxelCurve} bias ${S.froxelBias}${f.lastRemake ? ' · last: ' + f.lastRemake : ''}`; },
  };
  // __hotDenoise(src?): the same for the v3 denoiser core (render/denoise.ts hotSwap ← /qa/shader/denoise.wgsl)
  (window as any).__hotDenoise = async (src?: string) => engine.passes.den.hotSwap(src ?? await (await fetch('/qa/shader/denoise.wgsl', { cache: 'no-store' })).text());
  // __hotReflect(src?): … and for the reflection pass (passes.hotSwapReflect ← /qa/shader/reflect_p5.wgsl while the phase-5 variant is the one dispatched, else reflect.wgsl; a given src goes to whichever its bindings say)
  (window as any).__hotReflect = async (src?: string) => engine.passes.hotSwapReflect(src ?? await (await fetch(engine.passes.rtP5 ? '/qa/shader/reflect_p5.wgsl' : '/qa/shader/reflect.wgsl', { cache: 'no-store' })).text());
  // __rt: materials + reflections (renderer v3 phase 4) for the console / automation (+ phase 5's mesh / reuse switches)
  (window as any).__rt = {
    get on() { return engine.settings.rtReflect; }, set on(v: boolean) { engine.settings.rtReflect = !!v; },
    get detail() { return engine.settings.detail; }, set detail(v: number) { engine.settings.detail = Math.max(0, Math.min(1, v)); },
    get mesh() { return engine.settings.rtMeshHits; }, set mesh(v: boolean) { engine.settings.rtMeshHits = !!v; },
    get reuse() { return engine.settings.rtHitReuse; }, set reuse(v: boolean) { engine.settings.rtHitReuse = !!v; },
    knobs: () => { const S = engine.settings; return { on: S.rtReflect, div: S.rtReflectDiv, rays: S.rtRays, maxRough: S.rtMaxRough, atrous: S.rtAtrous, aniso: S.rtAniso, strength: S.rtStrength, glints: S.rtGlints, detail: S.detail, history: S.rtHistory, specClampK: S.dnSpecClampK, mesh: S.rtMeshHits, reuse: S.rtHitReuse }; },
    set: (k: Partial<{ on: boolean; div: number; rays: number; maxRough: number; atrous: number; aniso: number; strength: number; glints: number; detail: number; history: number; specClampK: number; mesh: boolean; reuse: boolean }>) => { const S = engine.settings; if (k.on !== undefined) S.rtReflect = k.on; if (k.div !== undefined) S.rtReflectDiv = k.div; if (k.rays !== undefined) S.rtRays = k.rays; if (k.maxRough !== undefined) S.rtMaxRough = k.maxRough; if (k.atrous !== undefined) S.rtAtrous = k.atrous; if (k.aniso !== undefined) S.rtAniso = k.aniso; if (k.strength !== undefined) S.rtStrength = k.strength; if (k.glints !== undefined) S.rtGlints = k.glints; if (k.detail !== undefined) S.detail = k.detail; if (k.history !== undefined) S.rtHistory = k.history; if (k.specClampK !== undefined) S.dnSpecClampK = k.specClampK; if (k.mesh !== undefined) S.rtMeshHits = k.mesh; if (k.reuse !== undefined) S.rtHitReuse = k.reuse; return (window as any).__rt.knobs(); },
    summary: () => { const S = engine.settings, P = engine.passes; return `rt ${S.rtReflect ? `on ÷${P.rtDiv} ${P.rw}×${P.rh} · ${S.rtRays} ray/px · rough ≤ ${S.rtMaxRough} · ${S.rtAtrous} à-trous` : 'off'} · detail ${S.detail.toFixed(2)} · gloss row ${S.gloss ? (S.rtReflect ? 'set, superseded' : 'on') : 'off'} · mesh hits ${S.rtMeshHits ? (engine.meshShadowsOn ? 'on' : 'wanted (mesh shadows off)') : 'off'} · hit reuse ${S.rtHitReuse ? 'on' : 'off'}`; },
  };
  // __hotGather(src?): recompile both gather pipeline pairs (fgather.wgsl main + mainGi, × GATHER_STRATA ← /qa/shader/fgather.wgsl) against the staged scene
  (window as any).__hotGather = async (src?: string) => engine.passes.hotSwapGather(src ?? await (await fetch('/qa/shader/fgather.wgsl', { cache: 'no-store' })).text(), await (await fetch('/qa/shader/gather_common.wgsl', { cache: 'no-store' })).text());   // (gather_common.wgsl from disk too: the two move together)
  // ?gatherStrata / __gs: the gather's tile-coherent STRATIFIED directions (settings.gatherStrata, ported from exp/trace-perf E8 — unbiased, −13‥16 % gather, not hash-identical: default off; flips live)
  { const q = new URLSearchParams(location.search); if (q.has('gatherStrata')) engine.settings.gatherStrata = true; if (q.has('nogatherstrata')) engine.settings.gatherStrata = false; }   // (default ON since 08-12; ?nogatherstrata = the iid gather, hash-identical to the pre-port frame)
  (window as any).__gs = {
    get on() { return engine.settings.gatherStrata; }, set on(v: boolean) { engine.settings.gatherStrata = !!v; },
    summary: () => `gather strata ${engine.settings.gatherStrata ? 'ON (stratified, tile-coherent directions: pFGs / pFGRs)' : 'off (iid cosine directions, the gather as it was)'} · gather ${engine.passes.gw}×${engine.passes.gh}${engine.settings.giResample !== 'off' ? ' · resampling ' + engine.settings.giResample : ''}`,
  };
}

/** the ray-traversal lab: __daylight, __scenePrelude, __traceConfig, __commonSource, __hotCommon */
function traceLabHooks(engine: Engine, game: Game) {
  // ---- RAY-TRAVERSAL LAB (ported from exp/trace-perf; tools/qa/trace-lab.js drives these — docs/internal/trace-perf.md §0): __scenePrelude(lighting?) = the prelude every scene shader is
  // compiled behind RIGHT NOW (world consts + TRACE_VARIANT + common.wgsl [+ lighting_common]); __traceConfig = render/frame.ts traceConfig; __commonSource() = the common.wgsl text in
  // use; __hotCommon(src?, variant?) installs an edited common.wgsl text (no arg / null = refetch the file from disk; '' = back to the bundled text) and/or a TRACE_VARIANT, then rebuilds
  // EVERY pipeline that traces rays — direct + restir, the four gathers, the live reflection kernel, the volumetric march, the froxel kernels, the three cascade kernels, the particles'
  // sim — against the staged scene, so a traversal change is timed and pixel-compared without a reboot (composite's wet-coat side ray, the light probe and the bounce cards keep the boot
  // prelude: reboot with ?trace=N for whole-frame identity). __daylight(on?) = the level's daylight swap by hand (lighting.ts setDaylight, bit for bit) for the lab's sun-shadow scene B5.
  (window as any).__daylight = (on?: boolean) => { if (on !== undefined && !!on !== isDaylight(game)) setDaylight(game, !!on); return isDaylight(game); };
  (window as any).__scenePrelude = (lighting = false) => scenePrelude() + (lighting ? lightingCommonSrc : '');
  (window as any).__traceConfig = traceConfig;
  (window as any).__commonSource = commonSource;
  (window as any).__hotCommon = async (src?: string | null, variant?: number) => {
    const shader = async (n: string) => (await fetch(`/qa/shader/${n}.wgsl`, { cache: 'no-store' })).text();
    if (src === undefined || src === null) traceConfig.common = await shader('common'); else traceConfig.common = src === '' ? null : src;
    if (variant !== undefined && Number.isFinite(variant)) traceConfig.variant = variant | 0;
    const t0 = performance.now(); const P = engine.passes; const out: Record<string, { ok: boolean; messages: string[] }> = {};
    const dc = await shader('direct_common');
    const jobs: [string, Promise<{ ok: boolean; messages: string[] }>][] = [
      ['direct', P.hotSwapDirect(await shader('direct'), 'direct', dc)],
      ['restir', P.hotSwapDirect(await shader('restir'), 'restir', dc)],
      ['gather', P.hotSwapGather(await shader('fgather'), await shader('gather_common'))],
      ['reflect', P.hotSwapReflect(await shader(P.rtP5 ? 'reflect_p5' : 'reflect'))],
      ['vol', P.hotSwapVol(await shader('volumetrics'))],
      ['froxel', P.froxels.hotSwap(await shader('froxel'))],
      ['rc', engine.rc.hotSwap()],
    ];
    if (engine.particles) jobs.push(['particles', engine.particles.hotSwapSim()]);
    const rs = await Promise.all(jobs.map(j => j[1].catch(e => ({ ok: false, messages: [String((e as Error)?.message ?? e)] }))));
    jobs.forEach((j, i) => { out[j[0]] = rs[i]; });
    const bad = Object.entries(out).filter(([, r]) => !r.ok);
    return { ok: bad.length === 0, variant: traceConfig.variant, commonChars: (traceConfig.common ?? '').length, ms: Math.round(performance.now() - t0), failed: Object.fromEntries(bad.map(([k, r]) => [k, r.messages.slice(0, 6)])), warnings: Object.fromEntries(Object.entries(out).filter(([, r]) => r.ok && r.messages.length).map(([k, r]) => [k, r.messages.slice(0, 4)])) };
  };
}

/** __gi, __gimo, __dmo */
function giMotionHooks(engine: Engine) {
  // __gi: the gather's reservoir resampling (renderer v3 phase 5, ultra) for the console / automation — mode + knobs in one object
  (window as any).__gi = {
    get mode() { return engine.settings.giResample; }, set mode(v: 'off' | 'temporal' | 'full') { engine.settings.giResample = v === 'full' ? 'full' : v === 'temporal' ? 'temporal' : 'off'; },
    knobs: () => { const S = engine.settings; return { mode: S.giResample, rays: S.giResampleRays, cap: S.giResampleCap, taps: S.giResampleTaps, radius: S.giResampleRadius, revalidate: S.giResampleRevalidate }; },
    set: (k: Partial<{ mode: 'off' | 'temporal' | 'full'; rays: number; cap: number; taps: number; radius: number; revalidate: boolean }>) => { const S = engine.settings; if (k.mode !== undefined) S.giResample = k.mode; if (k.rays !== undefined) S.giResampleRays = k.rays; if (k.cap !== undefined) S.giResampleCap = k.cap; if (k.taps !== undefined) S.giResampleTaps = k.taps; if (k.radius !== undefined) S.giResampleRadius = k.radius; if (k.revalidate !== undefined) S.giResampleRevalidate = k.revalidate; return (window as any).__gi.knobs(); },
    summary: () => { const S = engine.settings, P = engine.passes; return `gi resampling ${S.giResample}${S.giResample !== 'off' ? ` · ${S.giResampleRays} fresh · M ≤ ${S.giResampleCap}${S.giResampleRevalidate ? ' · revalidate' : ''}${S.giResample === 'full' ? ` · ${S.giResampleTaps} taps r ${S.giResampleRadius}` : ''} · ${P.gw}×${P.gh} · ${(P.p5Bytes / 1048576).toFixed(0)} MB` : ''}`; },
  };
  // __gimo: GI IN MOTION (docs/internal/gi-motion.md) — the internal-res diffuse chain, the young-history gather rays, the ladder's climb, in one object for the console / automation
  (window as any).__gimo = {
    knobs: () => { const S = engine.settings; return { fullRes: S.giFullRes, fullIters: S.giFullIters, youngRays: S.giYoungRays, youngCap: S.giYoungCap, youngLen: S.giYoungLen, ladderClimb: S.ladderClimb, capClimb: S.capClimb }; },
    set: (k: Partial<{ fullRes: boolean; fullIters: number; youngRays: number; youngCap: number; youngLen: number; ladderClimb: boolean; capClimb: boolean }>) => { const S = engine.settings; if (k.fullRes !== undefined) S.giFullRes = !!k.fullRes; if (k.fullIters !== undefined) S.giFullIters = k.fullIters; if (k.youngRays !== undefined) S.giYoungRays = k.youngRays; if (k.youngCap !== undefined) S.giYoungCap = k.youngCap; if (k.youngLen !== undefined) S.giYoungLen = k.youngLen; if (k.ladderClimb !== undefined) S.ladderClimb = !!k.ladderClimb; if (k.capClimb !== undefined) S.capClimb = !!k.capClimb; return (window as any).__gimo.knobs(); },
    get live() { return engine.passes.giFullLive; },
    young: () => engine.passes.readYoungCount(),
    calm: (on?: boolean) => { if (on !== undefined) (window.__quality as any)?.applyMotionCalm(!!on); return !!(window.__quality as any)?.motionCalm; },   // the motion-calm rows on / off (quality.ts MOTION_CALM)
    summary: () => { const S = engine.settings, P = engine.passes; return `gi in motion: full-res ${S.giFullRes ? (P.giFullLive ? `LIVE ${P.width}×${P.height} · ${S.giFullIters} à-trous · ${(P.giFullBytes / 1048576).toFixed(0)} MB` : 'wanted (not live)') : 'off'} · young rays ${S.giYoungRays > 1 ? `×${S.giYoungRays} (cap ${(S.giYoungCap * 100).toFixed(0)} % · len < ${S.giYoungLen})` : 'off'} · climb ${S.ladderClimb ? 'on' : 'off'}${S.capClimb ? ' + cap' : ''} · motion-calm rows ${(window.__quality as any)?.motionCalm ? 'ON' : 'off'}`; },
  };
  // __dmo: DIRECT LIGHT IN MOTION (docs/internal/direct-motion.md) — ReSTIR's temporal reuse under a moving camera: settings.restirMotion (bitmask 1 = stochastic-bilinear reprojection, 2 = motion-scaled
  // confidence, 4 = spatial reuse under motion; 0 = the estimator as it was) and its three knobs, for the console / the harnesses (`__gim.run(tag, {extra: {restirMotion: 3}})` measures it)
  (window as any).__dmo = {
    knobs: () => { const S = engine.settings; return { motion: S.restirMotion, v: S.restirMotionV, min: S.restirMotionMin, px: S.restirMotionPx, dither: S.restirMotionDither, taps: S.restirMotionTaps, static: S.restirMotionStatic, live: engine.passes.restirMotionLive }; },
    set: (k: Partial<{ motion: number; v: number; min: number; px: number; dither: boolean; taps: number; static: boolean }>) => { const S = engine.settings; if (k.motion !== undefined) S.restirMotion = Math.max(0, Math.min(7, k.motion | 0)); if (k.v !== undefined) S.restirMotionV = k.v; if (k.min !== undefined) S.restirMotionMin = k.min; if (k.px !== undefined) S.restirMotionPx = k.px; if (k.dither !== undefined) S.restirMotionDither = !!k.dither; if (k.taps !== undefined) S.restirMotionTaps = k.taps; if (k.static !== undefined) S.restirMotionStatic = !!k.static; return (window as any).__dmo.knobs(); },
    get on() { return engine.settings.restirMotion; }, set on(v: number) { engine.settings.restirMotion = Math.max(0, Math.min(7, v | 0)); },
    summary: () => { const S = engine.settings; const m = S.restirMotion; return m ? `restir motion ${m} = ${[m & 1 ? 'stochastic-bilinear reprojection' : '', m & 2 ? `confidence whole under ${S.restirMotionV} px @1000 rows, × ${S.restirMotionMin} past ${(S.restirMotionV * 1.6).toFixed(2)}` : '', m & 4 ? `spatial past ${S.restirMotionPx} px${S.restirMotionTaps ? ` × ≥ ${S.restirMotionTaps} taps` : ''}` : ''].filter(Boolean).join(' + ')} · ${engine.passes.restirMotionLive ? 'LIVE this frame' : S.restirMotionStatic ? 'live' : 'the camera is still: main\'s program'}${S.restir ? '' : ' (restir itself is OFF)'}` : 'restir motion off — the reservoir reprojection as it was (nearest texel, full confidence)'; },
  };
}

/** the SDF rig's and the character materials' URL flags (written over the applied preset, as they were), __charmat, __sdfrig */
function characterRigFlagsAndHooks(engine: Engine, game: Game) {
  { // the SDF CHARACTER RIG's two extras from the URL (the fitted round cones themselves are every ray's character test, no switch): ?sdfsmooth = the smooth-union closest hit in reflections ·
    // ?charsoft = the analytic soft-shadow character visibility in the direct estimators (?charsoftmarch = its sphere-marched form). No preset touches either, so they hold for the visit.
    const q = new URLSearchParams(location.search); const S = engine.settings;
    if (q.has('sdfsmooth')) S.sdfRigSmooth = true;
    if (q.has('charsoft') || q.has('charsoftmarch')) { S.charSoftShadow = true; S.charSoftAnalytic = !q.has('charsoftmarch'); }
    if (q.has('noselfshadow')) S.charSelfShadow = false;   // ?noselfshadow: a man's own body never shadows him (the owner skip whole) — the frame as it was before the self-shadow rule, for A/B
    // CHARACTER MATERIALS (render/charMaterials.ts): on by itself for a mesh that carries slot-named materials (the contract with the models), off for the shipped mannequin —
    // ?charmats dresses that one by joint as a stand-in, ?nocharmats holds the two tints whatever the mesh says
    if ((charMatsMod.meshAuthored(game.ch.mesh) || q.has('charmats')) && !q.has('nocharmats')) S.charMats = true;
    if (S.charMats) charMatsMod.charSlots(game.ch);   // (the slot data + cavity bake solved here, at boot, as the cast's proxy fits are — otherwise Game.update's first draw block solves it, and the world holds still behind the card until Start, so that was the first frame of play; cached per mesh, the same rows either way)
  }
  // __charmat: the character materials for the console / automation — the switch, the slot data of the loaded mesh, any man's resolved rows, the tables (edit, then bump())
  (window as any).__charmat = {
    get on() { return engine.settings.charMats; }, set on(v: boolean) { engine.settings.charMats = !!v; },
    slots: charMatsMod.CHAR_SLOTS, get tables() { return { ...Object.fromEntries((['operator', 'defender', 'responder', 'civilian'] as const).map(k => [k, charMatsMod.charMatsOf(k)])), suit: charMatsMod.SNEAK_SUIT }; } /* (the tables the men are DRAWN from: the look's rows where the look has them — edit a row, then bump()) */, data: () => charMatsMod.charSlots(game.ch),
    /** i: −1 / 'sam' = Sam, else Game.guards[i] → { side, slot: { albedo, rough, gain, soak, grime, wear } … } as the shader gets them */
    get: (i: number | 'sam' = 'sam') => { const c = i === 'sam' || i < 0 ? game.player.char : game.guards[i]?.char; if (!c) return null; const gd = game.guards.find(x => x.char === c); const side = gd ? charLookMod.sideOfTeam(gd.team, gd.trained) : 'operator', suit = charLookMod.sneakSuit(game, c) /* (the black sneaking suit: its rows are `tables.suit`) */; return { ...charMatsMod.describePalette(side, c.tint, c.tint2, c.id, !charMatsMod.meshAuthored(game.ch.mesh), suit), suit }; },
    bump: () => charMatsMod.bumpCharMats(), reset: () => charMatsMod.resetCharMats(), summary: () => charMatsMod.charMatsSummary(game.ch, engine.settings.charMats),
  };
  // __sdfrig: the SDF character rig for the console / automation — the extras' switches, the knobs, the fit table
  (window as any).__sdfrig = {
    get smooth() { return engine.settings.sdfRigSmooth; }, set smooth(v: boolean) { engine.settings.sdfRigSmooth = !!v; },
    get soft() { return engine.settings.charSoftShadow; }, set soft(v: boolean) { engine.settings.charSoftShadow = !!v; },
    get analytic() { return engine.settings.charSoftAnalytic; }, set analytic(v: boolean) { engine.settings.charSoftAnalytic = !!v; },
    get self() { return engine.settings.charSelfShadow; }, set self(v: boolean) { engine.settings.charSelfShadow = !!v; },   // character self-shadow (rigCfg bit 64; default on)
    /** are the proxies the FITTED cones? (a fit attached; false = the game's hand capsules traced as untapered cones) */
    get live() { return engine.sdfRigOn; },
    fit: () => engine.rigFit, table: () => engine.rigFit ? rigTable(engine.rigFit) : '(no fit attached)',
    knobs: () => { const S = engine.settings; return { smooth: S.sdfRigSmooth, k: S.sdfRigK, steps: S.sdfRigSteps, soft: S.charSoftShadow, analytic: S.charSoftAnalytic, softSteps: S.charSoftSteps, softK: S.charSoftK, minDeg: S.charSoftMinDeg, softSmooth: S.charSoftSmooth, broad: S.charSoftBroad, self: S.charSelfShadow }; },
    set: (k: Partial<{ smooth: boolean; k: number; steps: number; soft: boolean; analytic: boolean; softSteps: number; softK: number; minDeg: number; softSmooth: boolean; broad: boolean; self: boolean }>) => { const S = engine.settings; if (k.self !== undefined) S.charSelfShadow = !!k.self; if (k.broad !== undefined) S.charSoftBroad = !!k.broad; if (k.smooth !== undefined) S.sdfRigSmooth = !!k.smooth; if (k.k !== undefined) S.sdfRigK = k.k; if (k.steps !== undefined) S.sdfRigSteps = k.steps; if (k.soft !== undefined) S.charSoftShadow = !!k.soft; if (k.analytic !== undefined) S.charSoftAnalytic = !!k.analytic; if (k.softSteps !== undefined) S.charSoftSteps = k.softSteps; if (k.softK !== undefined) S.charSoftK = k.softK; if (k.minDeg !== undefined) S.charSoftMinDeg = k.minDeg; if (k.softSmooth !== undefined) S.charSoftSmooth = !!k.softSmooth; return (window as any).__sdfrig.knobs(); },
    summary: () => { const S = engine.settings; return `sdf rig: round cones ${engine.sdfRigOn ? 'FITTED' : 'unfitted (no fit attached: hand radii, untapered)'} · reflections ${S.sdfRigSmooth ? `smooth union (k ×${S.sdfRigK}, ${S.sdfRigSteps} steps${engine.settings.rtMeshHits && engine.meshShadowsOn ? ' — superseded by mesh hits' : ''})` : engine.settings.rtMeshHits && engine.meshShadowsOn ? 'mesh hits' : 'round cones'} · direct-light character shadows ${S.charSoftShadow ? `SOFT QUERY (${S.charSoftAnalytic ? 'analytic' : `march ${S.charSoftSteps} steps${S.charSoftSmooth ? ', smooth union' : ''}`}, angular ×${S.charSoftK}, ≥ ${S.charSoftMinDeg}°)` : engine.meshShadowsOn ? 'ray-traced (mesh)' : 'ray-traced'}${S.charSelfShadow ? ' + self-shadow' : ''}`; },
  };
}

/** ?meshShadows / ?nodecals / ?noparticles / ?nosparkbounce (written over the applied preset, as they were), __mark, __marks, __particles */
function marksParticlesFlagsAndHooks(engine: Engine, game: Game) {
  if (new URLSearchParams(location.search).has('meshShadows')) engine.settings.meshShadows = true;   // ?meshShadows: on by hand whatever the preset (ultra carries it anyway; auto's ladder re-applies presets and will clear it — pin ?quality= to keep it)
  if (new URLSearchParams(location.search).has('nodecals')) { engine.settings.decals = false; game.decals.enabled = false; }   // ?nodecals: the decal experiment (E1, on by default in its branch) off from boot — nothing recorded, nothing uploaded, the g-buffer as it was
  // __mark: the MARKINGS lane (scene/markings.ts) for the console / automation — on/off, the knobs, a box's packed records, the table's stats, the lights registered for emissive markings
  (window as any).__mark = {
    get on() { return engine.settings.markings; }, set on(v: boolean) { engine.settings.markings = !!v; },
    get texel() { return engine.settings.markingTexel; }, set texel(v: number) { engine.settings.markingTexel = v; },
    knobs: () => { const S = engine.settings; return { on: S.markings, texel: S.markingTexel, contrast: S.markingContrast, emissive: S.markingEmissive, reflect: S.markingReflect, cone: S.markingReflCone, pattern: S.markingReflPattern }; },
    set: (k: Partial<{ on: boolean; texel: number; contrast: number; emissive: number; reflect: boolean; cone: number; pattern: boolean }>) => { const S = engine.settings; if (k.on !== undefined) S.markings = k.on; if (k.texel !== undefined) S.markingTexel = k.texel; if (k.contrast !== undefined) S.markingContrast = k.contrast; if (k.emissive !== undefined) S.markingEmissive = k.emissive; if (k.reflect !== undefined) S.markingReflect = k.reflect; if (k.cone !== undefined) S.markingReflCone = k.cone; if (k.pattern !== undefined) S.markingReflPattern = k.pattern; return (window as any).__mark.knobs(); },
    /** the markings + packed records of static box i (or of the box under the cursor with no argument) */
    list: (i?: number) => { const w = engine.world; let b = i === undefined ? null : w.statics[i] ?? null; if (i === undefined) { const cam = window.__cam; const hit = cam ? w.raycast(cam.pos, v3.normalize(v3.sub(game.aimPoint, cam.pos)), 200) : null; b = hit ? w.all[hit.index] : null; } if (!b) return null; return { name: b.name, c: b.c, h: b.h, marks: b.marks ?? [], records: w.markRecordsOf(b) }; },
    /** every static box index that carries markings, with its kinds */
    marked: () => engine.world.statics.map((b, i) => b.marks?.length ? { i, name: b.name, marks: b.marks.map(m => `${m.size[0]}×${m.size[1]}${m.res ? ' ' + m.res : ''}@${m.face}`) } : null).filter(Boolean),
    /** print a box's markings as ASCII art (static index, or the box under the cursor) */
    art: (i?: number) => { const L = (window as any).__mark.list(i); if (!L) return null; return L.marks.map((m: any) => `${m.face} ${m.res ?? 'base'} at ${m.at} ${m.size[0]}×${m.size[1]}\n${m.cells.join('\n')}`).join('\n\n'); },
    get stats() { return engine.world.markStatsInfo; }, get lights() { return game.markLights; },
    summary: () => { const S = engine.settings, st = engine.world.markStatsInfo; return `markings ${S.markings ? 'on' : 'off'} · texel ${(S.markingTexel * 100).toFixed(1)} cm · contrast ${S.markingContrast} · emissive ×${S.markingEmissive}${S.markingReflect ? ` · in reflections (cone +${S.markingReflCone}·α)` : ''} · ${st.lists} lists / ${st.records} records / ${st.rows} rows / ${st.boxes} marked boxes this frame${st.dropped ? ` · ${st.dropped} DROPPED` : ''} · ${game.markLights.length} marking light(s)`; },
  };
  window.__marks = { test: () => sprayTestPattern(game), random: (n = 100, seed = 1) => sprayRandom(game, n, seed), clear: () => game.decals.clear(),   // automation: the panel's decal buttons by hand (E1) …
    bang: (p: Vec3) => bangScorch(game, p), scuff: (door: string, from?: Vec3) => { const d = game.doors.byName(door); if (d) kickScuff(game, d, from ?? game.player.char.pos); return !!d; } };   // … and the two staged marks a capture script cannot easily cause for real: a stun scorch at p, the kick's scuff on a named leaf from `from`'s side
  if (new URLSearchParams(location.search).has('noparticles')) engine.settings.gpuParticles = false;   // ?noparticles: the E4 experiment off at boot — the CPU box sparks exactly as they were (Tab ▸ 'Renderer — particles (EXP)' flips it live)
  if (engine.particles && new URLSearchParams(location.search).has('nosparkbounce')) engine.particles.sparkBounce = false;   // ?nosparkbounce: sparks off surfaces off from boot — a spark's touch and birth as they were (Tab ▸ particles ▸ 'sparks bounce off surfaces' flips it live)
  // __particles: the GPU particle system for the console / automation — stats (alive / asleep / windows / rates), the live per-kind numbers, a test burst at a world
  // point (or the cursor's), and the raw emit (kind, pos, dir, count, opts) — see render/particles.ts / game/particleFx.ts
  (window as any).__particles = {
    get sys() { return engine.particles; }, get stats() { return engine.particles?.stats; }, get params() { return engine.particles?.params; },
    get on() { return engine.particlesOn; }, set on(v: boolean) { engine.settings.gpuParticles = !!v; },
    get bounce() { return !!engine.particles?.sparkBounce; }, set bounce(v: boolean) { if (engine.particles) engine.particles.sparkBounce = !!v; },
    test: (kind: 'sparks' | 'debris' | 'dust' | 'casings' | 'bang' | 'sheets' = 'sparks', at?: Vec3) => testBurst(game, kind, at ?? game.aimPoint),
    emit: (kind: PKind, pos: Vec3, dir: Vec3, count: number, o: EmitOpts) => engine.particles?.emit(kind, pos, dir, count, o) ?? 0,
    /** the raw impulse (render/particles.ts impulse: pos, radius m, strength m/s, { up, bias, kinds, occlude, eye }) — the destruction lane's game events go through __destr.kick */
    impulse: (pos: Vec3, radius: number, strength: number, o?: ImpulseOpts) => engine.particles?.impulse(pos, radius, strength, o) ?? false,
    get impulseResponse() { return engine.particles?.impulseResponse; }, get pendingImpulses() { return engine.particles?.pendingImpulses; },
    clear: () => engine.particles?.clear(),
  };
}

/** __destr, __wind, __wet, the particle rain's URL flags (?norain2 ?prain ?rainv1: after the preset, as they were), __hotRain, __rain */
function destructionWeatherFlagsAndHooks(engine: Engine, game: Game) {
  // __destr: the destruction lane (game/destruction.ts) for the console / automation — the knob, the counters, the log, the debris pool, the index, a staged bang / burst
  { const dm = destrMod;
    (window as any).__destr = {
      get chaos() { return game.tune.chaos; }, set chaos(v: number) { game.tune.chaos = Math.max(0, Math.min(1, Number(v) || 0)); },   // (NOT persisted: a measurement script's chaos must not become this profile's default — save() does that on purpose)
      save: () => dm.saveChaos(game),
      get stats() { return dm.DESTR_STATS; }, get log() { return dm.DESTR_LOG; }, get knobs() { return dm.CHAOS; },
      get debris() { const D = game.destr.debris; return { n: D.list.length, moving: D.moving, cap: D.cap(), stats: D.stats, kinds: D.list.map(c => c.kind) }; },
      inventory: () => game.destr.inventory(), summary: () => game.destr.summary(),
      heat: (p?: Vec3) => game.destr.heatAt(p ?? game.aimPoint), escalation: (p?: Vec3) => game.destr.escalationAt(p ?? game.aimPoint),
      /** a stun charge's worth of destruction at p (no flash, no dazzle): the desk cleared, papers up, the tile above down */
      bang: (p?: Vec3) => game.destr.bang(p ?? game.aimPoint),
      /** THE BLAST ENTRY POINT at p (a charge on the floor there: walls holed, cover gone, doors / glass told, then the bang's chaos) — game/destruction.ts blast */
      blast: (p?: Vec3, opts?: { radius?: number; power?: number; who?: number; chaos?: boolean }) => { const a = p ?? game.aimPoint; return game.destr.blast([a[0], Math.max(a[1], 0.3), a[2]], opts); },
      /** wall breaking (game/wallbreak.ts): the engine (inventory(), all(), serial, changes, since(n), onChange(fn), summary()) and the goal's one switch */
      get walls() { return game.destr.walls; }, get on() { return DESTRUCTION.on; }, set on(v: boolean) { DESTRUCTION.on = !!v; }, get furn() { return game.destr.furn; }, get furnOn() { return FURNBLAST.on; }, set furnOn(v: boolean) { FURNBLAST.on = !!v; }, get rubble() { return RUBBLE; }, get rubbleStats() { return { ...game.destr.debris.feetStats, heap: game.destr.edgeLook.footBook.stats }; },
      /** the IMPULSE of an event alone at p (kind 'bang' | 'impact' | 'thud'; dir = the round's travel for 'impact'): only what already lies about moves */
      kick: (p?: Vec3, kind: 'bang' | 'impact' | 'thud' = 'bang', dir?: Vec3) => game.destr.testImpulse(p ?? [...game.aimPoint] as Vec3, kind, dir),
      get impulses() { return game.tune.debrisImpulses !== false; }, set impulses(v: boolean) { game.tune.debrisImpulses = !!v; },
      /** `n` FN2000 rounds from Sam's muzzle at p, one per `every` frames of stepped game time (a scripted burst for captures / cost takes; god mode advised) */
      burst: (p?: Vec3, n = 12, every = 6) => { const tgt = p ?? [...game.aimPoint] as Vec3; for (let k = 0; k < n; k++) { if (k) window.__runFrames!(every, 1 / 60); fireWeapon(game, game.player.char, tgt, true, { weapon: WEAPONS.fn2000 }); } return n; },
      reset: () => game.destr.reset(), defaults: () => dm.resetChaosKnobs(game),
    }; }
  // __close: closer than ever (game/close.ts) — the switch and knobs, what Sam could do to a man from where he stands, the windows as drawn, a man sat down
  (window as any).__close = {
    get on() { return CLOSE.on; }, set on(v: boolean) { CLOSE.on = !!v; }, knobs: CLOSE, stats: CLOSE_STATS, log: CLOSE_LOG,
    at: (i: number, p?: Vec3) => { const o = closeAt(game, game.guards[i], p ?? game.player.char.pos); return { kind: o.win?.kind ?? null, id: o.win?.id ?? null, dist: o.dist, bearingDeg: o.bearing * 180 / Math.PI, inReach: o.inReach, clear: o.clear, grab: o.grab, strike: o.strike, can: o.can, why: o.why }; },
    windows: (i: number) => closeWindows(game, game.guards[i]), marks: () => closeMarks(game).map(m => ({ who: m.guard.callsign, id: m.id, kind: m.kind, state: m.state, label: m.label, pts: m.pts.length, alpha: m.alpha })),
    seat: (i: number, at?: Vec3, face?: number) => closeSeat(game, game.guards[i], at, face), unseat: (i: number) => closeUnseat(game, game.guards[i]), seated: (i: number) => closeSeated(game, game.guards[i]),
    mode: () => closeMode(game)?.callsign ?? null,
    summary: () => closeSummary(game),
  };
  // __wind: the wind (game/wind.ts) for the console / automation — the master, the field at a point, every source's numbers, the knobs, the moths beside it
  (window as any).__wind = {
    get on() { return game.tune.wind; }, set on(v: number | boolean) { game.tune.wind = Math.max(0, Math.min(1, Number(v) || 0)); },   // (NOT persisted: a script's still air must not become the profile's default — save() does that on purpose)
    /** the air's velocity (m/s) at p — the cursor's point 5 cm up by default — summed over every active source (the CPU copy of what both GPU consumers evaluate) */
    at: (p?: Vec3) => game.wind.at(p ?? v3.add(game.aimPoint, [0, 0.05, 0])),
    sources: () => game.wind.all.map(s => ({ name: s.name, why: s.why, kind: s.kind, on: s.on, gust: s.gust, base: s.base, speed: s.speed, pos: [...s.pos], dir: [...s.dir], reach: s.reach, dMax: s.dMax, r0: s.r0, tanSpread: s.tanSpread })),
    active: () => game.wind.active.map(s => s.name), describe: () => game.wind.describe(), byName: (n: string) => game.wind.byName(n),
    get knobs() { return windMod.WIND; }, get field() { return windMod.WIND_FIELD; }, get stats() { return windMod.WIND_STATS; },
    set: (k: Record<string, number | boolean>) => { for (const [key, v] of Object.entries(k)) if (key in windMod.WIND && typeof (windMod.WIND as any)[key] === typeof v) (windMod.WIND as any)[key] = v; return windMod.WIND; },
    save: () => windMod.saveWind(game), defaults: () => windMod.resetWindKnobs(game), summary: () => game.wind.summary(),
    /** the CPU field of ONE jet by hand (pos, dir, speed, reach, tanSpread, r0, dMax, floorY, p) — the probes' cross-check against the WGSL text */
    jet: windMod.jetVel, storm: windMod.stormVel,
    get moths() { return { on: game.tune.moths !== false, knobs: mothsMod.MOTHS, stats: mothsMod.MOTH_STATS, summary: game.moths.summary() }; },
    setMoths: (on: boolean) => { game.tune.moths = !!on; },
  };
  // __wet: the wet characters (game/wet.ts) for the console / automation — everybody's numbers, soak / dry by hand, the knobs, the renderer's switch
  (window as any).__wet = {
    get on() { return engine.settings.wetChars; }, set on(v: boolean) { engine.settings.wetChars = !!v; },
    /** i: −1 / 'sam' = Sam, else Game.guards[i] → { wet, beads, rain, inRain, openSky } */
    get: (i: number | 'sam' = 'sam') => { const c = i === 'sam' || i < 0 ? game.player.char : game.guards[i]?.char; return c ? { wet: c.wet, beads: c.beads, rain: c.wetRain, line: c.wetLine, inRain: wetMod.inRain(game, c), openSky: wetMod.openSky(game, c) } : null; },
    /** soak one man through as if he had just stepped in out of a downpour (wet, beads default = wet); `line` (bind-pose m above the sole) = wet only up to there, as if he had waded — set('sam', 1, 0, 0, 0.55) = to the knee */
    set: (i: number | 'sam' = 'sam', wet = 1, beads = wet, rain = 0.8, line = Infinity) => { const c = i === 'sam' || (i as number) < 0 ? game.player.char : game.guards[i as number]?.char; if (!c) return false; wetMod.soak(game, c, wet, beads, rain, line); return true; },
    soakAll: (wet = 1) => { for (const c of wetMod.everyCharacter(game)) wetMod.soak(game, c, wet); }, dry: () => wetMod.dryAll(game),
    knobs: wetMod.WET, save: () => wetMod.saveWet(), reset: () => wetMod.resetWet(), stats: wetMod.WET_STATS, prints: () => wetMod.wetPrints(game), summary: () => game.wetSummary(),
  };
  // PARTICLE RAIN (game/rainFx.ts + the 'rain' particle kind; Tab ▸ Weather & wind ▸ Rain — particles flips it live) — the near-field layer of real GPU drops over the lattice rain is ON by default:
  // ?norain2 boots without it (the lattice rain alone, the frame as it was before the layer); ?rainv1 boots the layer with its v1 LOOK (grey isotropic scatter, no glint / refraction / spread,
  // plumb fall — for the visit only, nothing saved); ?prain (the prototype's switch) still forces it on
  { const qs = new URLSearchParams(location.search);
    if (qs.has('norain2')) engine.settings.particleRain = false;
    if (qs.has('prain')) engine.settings.particleRain = true;
    rainMod.loadPrain();   // its v2 look / wind knobs kept per machine (the Rain — particles rows)
    if (qs.has('rainv1')) rainMod.setPrain(rainMod.PRAIN_V1_LOOK); }
  // __hotRain(): rebuild the particles' three pipelines from particles_common / particles / particles_draw.wgsl as they are on disk (the rain look's kernels + splat under a staged storm, no reboot)
  (window as any).__hotRain = async () => { const P = engine.particles; if (!P) return { ok: false, messages: ['no particles'] }; const f = (n: string) => fetch('/qa/shader/' + n, { cache: 'no-store' }).then(r => r.text()); const [c, a, d, rf] = await Promise.all([f('particles_common.wgsl'), f('particles.wgsl'), f('particles_draw.wgsl'), f('refract_common.wgsl')]); return P.hotSwapAll(c, a, d, rf); };
  // __rain: particle rain for the console / automation — on/off, the knobs by name, the recycler's numbers, the ring's, the drip lines, a reseed; v2: .look / .setLook({}) / .resetLook() (PRAIN), .wind (the air it rides + the lattice's lean)
  (window as any).__rain = {
    get look() { return rainMod.PRAIN; }, setLook: (k: Record<string, number>) => { const r = rainMod.setPrain(k as any); rainMod.savePrain(); return r; }, resetLook: () => { rainMod.resetPrain(); return rainMod.PRAIN; }, get lookDefaults() { return rainMod.PRAIN_DEFAULTS; },
    get wind() { return rainMod.rainWind(game); }, get sceneCopy() { return engine.particles?.rainSceneCopy ?? 'none'; },
    get on() { return engine.settings.particleRain; }, set on(v: boolean) { engine.settings.particleRain = !!v; },
    knobs: () => { const S = engine.settings; return { on: S.particleRain, count: S.particleRainCount, radius: S.particleRainRadius, density: S.particleRainDensity, bright: S.particleRainBright, drips: S.particleRainDrips, lattice: S.particleRainLattice, react: S.particleRainReact }; },
    set: (k: Partial<{ on: boolean; count: number; radius: number; density: number; bright: number; drips: boolean; lattice: number; react: number }>) => { const S = engine.settings; if (k.on !== undefined) S.particleRain = !!k.on; if (k.count !== undefined) S.particleRainCount = k.count; if (k.radius !== undefined) S.particleRainRadius = k.radius; if (k.density !== undefined) S.particleRainDensity = k.density; if (k.bright !== undefined) S.particleRainBright = k.bright; if (k.drips !== undefined) S.particleRainDrips = !!k.drips; if (k.lattice !== undefined) S.particleRainLattice = k.lattice; if (k.react !== undefined) S.particleRainReact = k.react; return (window as any).__rain.knobs(); },
    get stats() { return rainMod.rainStats(game); }, get ring() { return engine.particles?.rainStats ?? null; }, get fx() { return rainMod.RAIN_FX; },
    drips: () => rainMod.rainDripPoints(game), seed: (n = 1) => rainMod.seedRain(game, n), summary: () => rainMod.rainSummary(game),
  };
  // __fire: the open fires (game/fire.ts) — the numbers live, the counts, what the renderer was handed this frame, a line
  (window as any).__fire = { get knobs() { return fireMod.FIRE; }, get stats() { return fireMod.fireStats(game); }, get shown() { return fireMod.fireShown(game); }, get drawn() { return engine.fires; }, get targets() { return game.targets.filter(fireMod.isFire); }, summary: () => fireMod.fireSummary(game) };
  // __snow: a snow level's flakes (game/snowFx.ts) — the numbers live, the recycler's count, the ring's, a reseed
  (window as any).__snow = { get fx() { return snowMod.SNOWFX; }, get stats() { return snowMod.snowStats(game); }, get wisps() { return snowMod.SNOWWISPS; }, get wispStats() { return snowMod.wispStats(game); }, get ring() { return engine.particles?.rainStats ?? null; }, seed: (n = 1) => snowMod.seedSnow(game, n), summary: () => snowMod.snowSummary(game),
    // … and its lying snow's look (render/snowField.ts SNOW_SURF): change a number, then relook()
    get look() { return SNOW_SURF; }, get field() { return game.snowField?.stats ?? null; }, relook: () => { engine.gbuffer.setSnowCfg(snowCfgRows(game.snowField, game.snowTracks ? TRACK_RES : 0)); },
    // … and the prints boots press into it (game/snowTracks.ts): the numbers (they reach the next print), the counts
    get tracks() { return SNOWTRACKS; }, get trackStats() { const T = game.snowTracks; return T ? { prints: T.prints, hollows: T.hollows, craters: T.craters, w: T.w, h: T.h, unseen: T.kept, found: T.found, lost: T.lost } : null; } };
  Object.defineProperties((window as any).__snow, { grains: { get: () => snowMod.SNOWGRAINS }, grainStats: { get: () => snowMod.grainStats(game) } });   // … and the fine grains that ride the air near the view (game/snowFx.ts): the numbers live
  Object.defineProperty((window as any).__snow, 'oneAir', { get: () => snowMod.oneAirActive(game) });   // … is the snow one snow in one air this frame (SNOW_LOOK.oneAir, with a field to read)
  Object.defineProperties((window as any).__snow, { blast: { get: () => snowBlastMod.SNOWBLAST }, blastStats: { get: () => snowBlastMod.snowBlastStats(game) }, blastAt: { value: (x: number, z: number, radius = 2.5, y = 0.2) => snowBlastMod.snowBlastAt(game, [x, y, z], radius) } });   // … and what a blast does to it (game/snowBlast.ts): the numbers live; blastAt marks the snow as a blast there would, with no blast
  Object.defineProperties((window as any).__snow, { bog: { get: () => SNOWBOG }, marks: { get: () => SNOWMARKS }, markStats: { get: () => { const T = game.snowTracks; return T ? { marks: T.marks, forming: T.forming.length, kicked: snowMod.marksKicked(), on: SNOW_LOOK.marks } : null; } } });   // … and what every thing that moves over it leaves (game/snowMarks.ts): the numbers live, the counts
  // __air: the air as one simulated field (game/airSim.ts, render/airField.ts) — the game's numbers and what it handed over, the solver's numbers (live), the map, the field read back
  (window as any).__air = { get sim() { return airMod.AIR_SIM; }, get stats() { return airMod.airSimStats(game); }, get solver() { return AIR; }, get field() { return engine.air; }, mask: () => airMod.airMask(game),
    readBack: () => (engine.air as unknown as { readBack?: () => Promise<Float32Array> } | null)?.readBack?.() ?? null };
  Object.defineProperties((window as any).__snow, { breath: { get: () => breathMod.SNOWBREATH }, steam: { get: () => breathMod.BREATHSTEAM }, breathStats: { get: () => breathMod.breathStats(game) }, breathSummary: { value: () => breathMod.breathSummary(game) } });   // … and the men's breath in its cold (game/snowBreath.ts): the numbers live with the next breath; `steam` = that breath as gas in the smoke solver, BREATHSTEAM
}

/** __taa, __dn, ?noglass / ?norefract (after the preset, as they were), __rigTrace, __meshTrace */
function resolveGlassFlagsAndHooks(engine: Engine, gpu: Gpu) {
  // __taa: the TAAU resolve for the console / automation — on/off, the knobs, this frame's jitter, the reset count and why, the sizes
  (window as any).__taa = {
    get on() { return engine.settings.taau; }, set on(v: boolean) { engine.settings.taau = !!v; },
    get jitter() { return [...engine.jitter]; }, get resets() { return engine.taaResets; }, get lastReset() { return engine.lastTaaReset; }, get stats() { return engine.passes.taaStats; },
    reset: (why = 'by hand') => engine.resetTaa(why), knobs: () => { const S = engine.settings; return { alpha: S.taauAlpha, clipGamma: S.taauClipGamma, phases: S.taauPhases, sharpen: S.taauSharpen, reactive: S.taauReactive, kernel: S.taauKernel, velK: S.taauVelK, lightJump: S.taauLightJump, motionAlpha: S.taauMotionAlpha, motionClip: S.taauMotionClip, sharpenMotion: S.taauSharpenMotion }; },
    set: (k: Partial<{ alpha: number; clipGamma: number; phases: number; sharpen: number; reactive: number; kernel: number; velK: number; lightJump: number; motionAlpha: number; motionClip: number; sharpenMotion: number }>) => { const S = engine.settings; if (k.alpha !== undefined) S.taauAlpha = k.alpha; if (k.clipGamma !== undefined) S.taauClipGamma = k.clipGamma; if (k.phases !== undefined) S.taauPhases = k.phases; if (k.sharpen !== undefined) S.taauSharpen = k.sharpen; if (k.reactive !== undefined) S.taauReactive = k.reactive; if (k.kernel !== undefined) S.taauKernel = k.kernel; if (k.velK !== undefined) S.taauVelK = k.velK; if (k.lightJump !== undefined) S.taauLightJump = k.lightJump; if (k.motionAlpha !== undefined) S.taauMotionAlpha = k.motionAlpha; if (k.motionClip !== undefined) S.taauMotionClip = k.motionClip; if (k.sharpenMotion !== undefined) S.taauSharpenMotion = k.sharpenMotion; return (window as any).__taa.knobs(); },
    summary: () => `taau ${engine.settings.taau ? 'on' : 'off'} · ${engine.width}×${engine.height} → ${engine.outWidth}×${engine.outHeight} · jitter ${engine.jitter.map(v => v.toFixed(3)).join(',')} · ${engine.passes.taaStats.frames} resolves, ${engine.taaResets} resets (last: ${engine.lastTaaReset || '—'})`,
  };
  // __dn: the denoiser (renderer v3 phase 3) for the console / automation — which core, the v3 clients' knobs in one object, the last frame's dispatch counts
  (window as any).__dn = {
    get mode() { return engine.settings.denoiser; }, set mode(v: 'v3' | 'legacy') { engine.settings.denoiser = v === 'legacy' ? 'legacy' : 'v3'; },
    get stats() { return engine.passes.den.stats; },
    knobs: () => { const S = engine.settings; return { shadowIters: S.dnShadowIters, shadowCap: S.dnShadowCap, shadowClampK: S.dnShadowClampK, shadowSigmaL: S.dnShadowSigmaL, shadowPrior: S.dnShadowPrior, shadowLitAlike: S.dnShadowLitAlike, shadowOccl: S.dnShadowOccl, shadowMoveCap: S.dnShadowMoveCap, shadowMoveThresh: S.dnShadowMoveThresh, giIters: S.dnGiIters, giCap: S.dnGiCap, giClampK: S.dnGiClampK, giSigmaL: S.dnGiSigmaL, giFast: S.dnGiFast, giFirefly: S.dnGiFirefly, specIters: S.dnSpecIters, specCap: S.dnSpecCap, specClampK: S.dnSpecClampK, specSigmaL: S.dnSpecSigmaL, specRough: S.dnSpecRough, depthK: S.dnDepthK, normalPow: S.dnNormalPow, motionVectors: S.dnMotionVectors }; },
    set: (k: Record<string, number | boolean>) => { const S = engine.settings as unknown as Record<string, unknown>; for (const [key, v] of Object.entries(k)) { const name = 'dn' + key[0].toUpperCase() + key.slice(1); if (name in S) S[name] = v; } return (window as any).__dn.knobs(); },
    summary: () => { const S = engine.settings, st = engine.passes.den.stats; return `denoiser ${S.denoiser} · shadow ${S.dnShadowIters} it / cap ${S.dnShadowCap} · gi ${S.dnGiIters} it / cap ${S.dnGiCap} (fast ${S.dnGiFast}) · spec ${S.dnSpecIters} it / cap ${S.dnSpecCap} · mv ${S.dnMotionVectors && S.taau ? 'on' : 'off'} · last frame ${st.shadow}+${st.gi}+${st.spec} dispatches`; },
  };
  if (new URLSearchParams(location.search).has('noglass')) engine.settings.glass = false;   // ?noglass: the glass panes off from boot (the panes become the empty openings the level had) — for A/B against a plain boot
  if (new URLSearchParams(location.search).has('nobeamreflect')) engine.settings.beamReflect = false;   // ?nobeamreflect: no laser / tracer in the reflections (no segment handed to the reflection pass: its frame as it was)
  if (new URLSearchParams(location.search).has('nobeamair')) engine.settings.beamAir = false;   // ?nobeamair: the squad's lasers as the glowing boxes they were (settings.beamAir)
  if (new URLSearchParams(location.search).has('nowetmirror')) engine.settings.wetMirror = false;   // ?nowetmirror: the wet ground's traced reflections at the weight they had (settings.wetMirror)
  if (new URLSearchParams(location.search).has('nowetbreak')) engine.settings.wetBreakup = 0;   // ?nowetbreak: wet ground one even film of water, the frame as it was (rtCfg.z = the anisotropy alone)
  if (new URLSearchParams(location.search).has('norefract')) engine.settings.glassRefract = false;   // ?norefract: the glass boxes' refraction off from boot (the panes' old tint rule, the read under the pixel — the frame byte for byte as it was) for A/B
  // __rigTrace(rays): the SDF character rig's production WGSL over the live scene for a list of rays (render/rigDebug.ts): rays = [[Po.xyz, tmax, L.xyz, tanHalf], …] →
  // per ray { vis (charSoftVis), resA / resM (the analytic / marched raw ratios), occ (occludedCapsules), t / idx (traceCapsules), tRig / ch (rigClosest) } — the CPU twin's check
  (window as any).__rigTrace = async (rays: number[][]) => {
    const flat = new Float32Array(rays.length * 8); rays.forEach((r, i) => flat.set(r.slice(0, 8), i * 8));
    const out = await rigDebugTrace(gpu.device, engine.sceneLayout, engine.sceneBindGroup(), flat);
    return rays.map((_, i) => ({ vis: out[i * 8], resA: out[i * 8 + 1], resM: out[i * 8 + 2], occ: out[i * 8 + 3], t: out[i * 8 + 4], idx: out[i * 8 + 5], tRig: out[i * 8 + 6], ch: out[i * 8 + 7] }));
  };
  // __meshTrace(fixture): replay tools/qa/mesh-shadow-fixture.json on the GPU — poses skin slot 0 with the fixture's joint matrices, refits, runs the PRODUCTION
  // WGSL walk (common.wgsl meshAnyHitChar via a tiny kernel on the scene bind group) over its 64 rays and compares with the CPU reference's answers ray for
  // ray. Use on a ?paused page (it borrows character slot 0's joints until the next stepped frame rewrites them). Resolves to a summary + the mismatching rays.
  window.__meshTrace = async (fixture: { digest: string; joints: number[]; rays: number[][]; expect: number[]; nodes: number }) => {
    const ms = engine.meshShadows; if (!ms) return { error: 'no MeshShadows attached' };
    if (!engine.meshShadowsAvailable) return { error: 'mesh binding unavailable on this adapter (storage-buffer budget)' };
    const out = await ms.debugTrace(engine.sceneLayout, engine.sceneBindGroup(), new Float32Array(fixture.joints), new Float32Array(fixture.rays.flat()));
    const rows = fixture.rays.map((_, i) => ({ i, expect: fixture.expect[i], got: out[i * 4], all: out[i * 4 + 1] }));
    const blockedMismatch = rows.filter(r => (r.expect >= 0) !== (r.got >= 0));
    const tMismatch = rows.filter(r => r.expect >= 0 && r.got >= 0 && Math.abs(r.expect - r.got) > 1e-3);
    return { digestOk: fixture.digest === ms.digest, digest: ms.digest, nodesGpu: out[2], nodesFixture: fixture.nodes, rays: rows.length, blockedExpected: rows.filter(r => r.expect >= 0).length, blockedGot: rows.filter(r => r.got >= 0).length, blockedMismatch, tMismatch, maxAbsDt: Math.max(0, ...rows.filter(r => r.expect >= 0 && r.got >= 0).map(r => Math.abs(r.expect - r.got))) };
  };
}

/** the scenario the URL asks for, staged (game/scenarioRun.ts), ?silentstart before it, ?extra / __extra after */
function scenarioFromUrl(q: URLSearchParams, game: Game) {
  // ?nightbreach / ?roomclear[=seed] / ?squad4[=seed] / ?rescue (and ?levelFile= beside them): straight into that SCENARIO, staged and waiting — no start card,
  // nothing moves until the first order. ONE code path for a typed URL and for a pick on the mission list (ui/missions.ts: each row is a link
  // to its entry's own query, scene/scenarioList.ts pickSearch — a page load): game/scenarioRun.ts startFromQuery. A refusal keeps the card and says why.
  // (the room clear IS the night breach on its own layout: nightBreach.active below keeps the card shut for it too)
  if (q.has('silentstart')) SILENT.start = true;   // ?silentstart: a freshly staged team stands up SILENT for this visit (game/silent.ts SILENT.start, read at the first tick with a cast; set here, after the Game has read this machine's kept rows, and not stored) — for a quiet row of the short list (none today)
  const booted = startFromQuery(game, q);
  // ?extra=N (game/stress.ts): N more hostile men stood on whatever floor is up, as many as the character budget takes — the one-minute check of what more
  // enemies cost on THIS machine's GPU (read fps / gpu ∪ off ?hud or the Tab panel's strip). Absent = nothing: stressTick below returns on its first line.
  { const n = Math.floor(Number(q.get('extra'))); if (n > 0) STRESS.want = Math.min(n, 15); }
  (window as any).__extra = { get want() { return STRESS.want; }, set want(n: number) { STRESS.want = Math.max(0, Math.min(15, Math.floor(n) || 0)); }, get men() { return STRESS.men; }, stand: (n: number) => standExtra(game, n), spots: (n: number) => extraSpots(game, n), summary: () => stressSummary(game), get last() { return STRESS.last; } };
  return booted;
}
let rendered = false, bootPrinted = false; const bootGpuErrors: string[] = [];
/** the boot's one console line (ui/boot.ts line) + the GPU-error collector's verdict, once */
function bootLine() {
  if (bootPrinted) return; bootPrinted = true;
  console.log(boot.line() + (bootGpuErrors.length ? ` · ${bootGpuErrors.length} GPU ERROR(S) DURING BOOT: ${bootGpuErrors[0]}` : ' · no GPU errors during boot'));
  Object.defineProperty(window, '__boot', { configurable: true, get: () => ({ ...boot.summary(), line: boot.line(), gpuInitErrors: [...bootGpuErrors] }) });
}

// Runtime error surface. Boot failures already land on the #fatal card (main().catch below, device.lost in gpu/device.ts); this catches what
// happens afterwards — a throw inside the frame loop (frame()'s try/catch, which also stops the loop), or an uncaught exception / rejected
// promise from any other callback — and puts the FIRST one on the same card instead of leaving a silently frozen picture. Later ones, and
// anything arriving while a card is already up, only reach the console; the browser's ResizeObserver loop notices are not errors at all.
let crashed = false;
function fatalOnce(head: string, err: unknown) {
  if (crashed) return; crashed = true;
  if (kitViewOn) kitViewFatal();   // (?kitview: nobody can see a card in there — the start page is told there is no picture and puts the standing man back)
  const card = document.getElementById('fatal'); if (card && card.style.display === 'flex') return;   // showFatal already has something up (device loss…): that is the message that matters
  showFatal(`${head}\n\n${err instanceof Error ? (err.stack || String(err)) : String(err)}`);
}
window.addEventListener('error', ev => { if (/ResizeObserver loop/.test(ev.message)) return; fatalOnce('Uncaught error:', ev.error ?? ev.message); });
window.addEventListener('unhandledrejection', ev => fatalOnce('Unhandled promise rejection:', ev.reason));

main().catch(e => { console.error(e); if (kitViewOn) kitViewFatal(); showFatal(String(e?.stack ?? e)); readyReject(e); });
