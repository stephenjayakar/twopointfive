// The viewer's stage runtime: the game's Engine on the procedural stage (scene/stage.ts) with ONE mannequin, an orbit camera, the hand lights, the game's
// smoke / sparks / dropped-item systems, and the per-frame step that drives the Character through exactly the fields game.ts writes (anim.speed /
// crouchTarget / upper / stance / holdPose …), emits its props with rigBoxes() and feeds the Engine the way main.ts + Game.update do (world statics,
// dynamic prop boxes, capsule shadow proxies, skinned instance, LightSet, SmokeSystem, FollowCamera). No Game / AI / audio. Everything the UI shows or
// sets is either the plain state object (state.ts) or an action method here; the UI never touches the engine.
import { CHAR_MAT_FLOATS, TINTS_AS_IS, charSlots, meshAuthored, placeholderTints, proxyAlbedos, writeCharPalette, type CharSide } from '../render/charMaterials';
import { GEAR, gearText } from '../game/gear';
import { QRF_TINT, QRF_TINT2 } from '../game/consts';
import { Gpu } from '../gpu/device';
import { Engine } from '../engine';
import { buildStage, Stage } from '../scene/stage';
import { lightFromDef, RtLight } from '../render/lights';
import { FollowCamera } from '../game/camera';
import { Input } from '../game/input';
import { Vec3, v3, DEG, clamp, wrapAngle, approachAngle } from '../math/vec';
import { StaticCollision } from '../scene/collision';
import { loadCharacterSet, castUrlFor, castSide, castGoggles, GltfCharacter } from '../anim/gltf';
import { CharacterRenderer } from '../anim/characters';
import { MeshShadows } from '../render/meshShadows';
import { fitRig } from '../render/sdfrig';
import { Character, SignalKind, Stance, UpperMode, THROW_RELEASE, THROW_BY, HOLD, LONG_STANCES, LongStance, defaultAnimParams } from '../game/character';
import { SmokeSystem } from '../smoke/smoke';
import { Quality, QUALITY_NAMES, QualityName, smokeKeepOf } from '../ui/quality';
import { Box, BoxFlag, makeBox } from '../scene/boxes';
import { INHAND, IN_PISTOL } from '../game/inhand';
import { RIG, longHold, torchHold, rigBoxes, holsterBoxes, rigLightPose, rigTorchPos, torchCarryDir, railLightDef, torchLightDef, RigNodeMeta, carbineGrip, carbineMuzzleAhead, carbineLightPose, sc20kGrip, sc20kMuzzleAhead, sc20kLightPose } from '../game/rigProps';
import { RigGizmo } from '../viewerGizmo';
import * as fxm from '../game/effects';
import { Sparks } from '../game/sparks';
import { Tracers } from '../game/tracers';
import { Firearm, WEAPONS, WeaponId } from '../game/weapons';
import { Throwables, ItemKind } from '../game/throwables';
import { PropSystem } from '../game/props';
import { frameCanvas, postShot } from '../ui/capture';
import { ViewerState, makeState, PLAYER_TINT, GUARD_TINT, CHAR_ID, UPPERS, STANCES, WALL_TURN, WALL_PEEK_LOOK, HOLD_PHASES, HOLD_VARIANTS, DRIVES } from './state';
import { GaitMeter, floorMarks } from './gait';

export type FrameKind = 'body' | 'back' | 'head' | 'hand' | 'feet' | 'profile' | 'threeq' | 'front' | 'top' | 'backTop';
/** How a page HOSTS the runtime (the workbench): a shared Input and camera it already drives, and 'hosted' = the page composes the frame itself
 *  (simulate() then its own camera / render) — step() with its orbit-from-input and its own render is the standalone viewer's. */
export interface RuntimeHost { input?: Input; cam?: FollowCamera; hosted?: boolean }
export type TossKind = 'pistol' | 'torch' | 'smoke' | 'flash' | 'mag' | 'rifle' | 'ring';
const CIRCLE_R = 2, LEG = 2.5;
/** the two tints an outfit of each side is tried on in (`wear` names a variant): Sam's, the shift's, the response element's, and for a civilian a pale shirt over dark trousers
 *  (a level's civilians each bring their own two: levels/office.json has Owen in this pair) */
const WEAR_TINT: Record<CharSide, { tint: Vec3; tint2: Vec3 }> = { operator: PLAYER_TINT, defender: GUARD_TINT, responder: { tint: [...QRF_TINT], tint2: [...QRF_TINT2] }, civilian: { tint: [0.5, 0.56, 0.7], tint2: [0.11, 0.11, 0.13] } };
const holdDur = (ph: string) => ph === 'grab' ? HOLD.secs.grab : ph === 'choke' ? HOLD.secs.choke : ph === 'whip' ? HOLD.secs.whip + 0.5 : ph === 'kill' ? HOLD.secs.kill + 0.8 : 4;   // (a beat past the whip's / the kill's end so the way out shows; 'held' just runs)

export class Runtime {
  private matPal = new Float32Array(CHAR_MAT_FLOATS);   // the staged figure's material rows (character materials)
  st: ViewerState = makeState();
  char!: Character;
  readonly cam: FollowCamera;
  readonly input: Input; readonly gizmo: RigGizmo; readonly quality: Quality;
  /** true when a page composes the frame round simulate() (the workbench); the standalone page runs step() */
  readonly hosted: boolean;
  /** the mark the figure stands on and the paths are laid about: the studio's centre, or a spot in the level (state.home; setHome) */
  home: Vec3;
  /** false = the rig gizmo neither reads the mouse nor draws (the workbench's level modes own the left button) */
  gizmoLive = true;
  readonly railLight: RtLight; readonly torchLight: RtLight; readonly stageLights: RtLight[];
  /** the studio's own collision set (floor, back wall, cube, post) and the one the figure's physics use RIGHT NOW (`col`): the studio's, or — stood in a level by a host —
   *  that level's statics (useCollision), so a ragdoll, K's traced round, sparks and tossed cans meet the office's walls instead of the invisible studio's (review T4.11) */
  readonly stageCol: StaticCollision; col: StaticCollision; stageItems: Throwables; readonly sparks = new Sparks(fxm.sparks);
  /** tracers (R6): the game's streaks on the stage — K's round is traced against the floor / back wall / cube / post and, when the kit's row and its stand-in
   *  gun's counters say so (tracers.ts isTracerRound: the carbine's every third + the last three of a thirty-round box; the pistols never) or 'tracer every
   *  round' forces it, flies as the game draws it, head light and ember included */
  readonly tracers: Tracers;
  private readonly guns = new Map<WeaponId, Firearm>();
  readonly clipNames: string[]; readonly gait: GaitMeter; readonly marks: Box[];
  /** this frame's rig node metadata (rigBoxes' meta sink) and dynamic boxes */
  readonly meta: RigNodeMeta[] = []; readonly dyn: Box[] = [];
  focus: Vec3; time = 0; simT = 0; fpsSm = 60;
  /** transient read-outs for the HUD: seconds left on the 'KICK IMPACT' / 'THROW RELEASE' flashes */
  kickFlashT = 0; relFlashT = 0;
  readonly messages: { text: string; t: number }[] = [];
  private wallBox: Box; private lastMX: number; private lastMY: number;
  private tacT = 0; private autoFireT = 0; private prevThrowT = -1; private wallTurn = 0; private beamDir: Vec3 = [0, -0.3, 1];
  private circPhi = Math.PI / 2; private legT = 0; private legDir = 1; private turnT = 0; private turnTarget = 0;
  private doorAng = 0; private doorVel = 0; private driveIdx = 0;
  private fx: { box: Box; ttl: number }[] = []; private fxSeed = 1;
  private skyScale0 = { z: [0, 0, 0] as number[], h: [0, 0, 0] as number[] }; skyScale = 1;
  /** shot emitter anchors as gizmo nodes: the Adj's `off` IS the live fxm.shot vector, so dragging an arrow edits the effect directly (rot accepted and ignored) */
  private emitterAdjs = new Map<string, { off: Vec3; rot: Vec3 }>(); private emitterRootAdj = { off: [0, 0, 0] as Vec3, rot: [0, 0, 0] as Vec3 };

  private meshShadowsRt: MeshShadows;
  /** THE CAST (anim/gltf.ts loadGltfCast; absent under ?mannequin): the variant the figure wears, by name — '' = the first operator, or the first defender with the guard kit on */
  wear = '';
  /** the side of the outfit the staged figure wears (a cast variant's own; with the mannequin, the scene's: the guard kit = a defender, else an operator) — his material table */
  wornSide: CharSide = 'operator';
  private rigFits = new Map<number, { r0: Float32Array; r1: Float32Array }>();
  /** the runtime on an Engine (and Input / camera) a HOST page made — the workbench: it composes the frame itself round simulate() */
  static async attach(canvas: HTMLCanvasElement, gpu: Gpu, engine: Engine, loading: HTMLElement | null, host: RuntimeHost): Promise<Runtime> {
    if (loading) loading.textContent = 'loading character rig…';
    const ch = await loadCharacterSet(new URL('assets/ual/AnimationLibrary_Godot_Standard.gltf', document.baseURI).href, castUrlFor(location.search, document.baseURI));
    const rt = new Runtime(canvas, gpu, engine, ch, buildStage(), host);
    await Promise.all([rt.smoke.init(), rt.meshShadowsRt.init(), engine.gbuffer.prepareSkin(rt.chars.jointsFormat)]);   // (async-boot: the stage's own GPU modules through the async path — the host has already run engine.init())
    return rt;
  }
  private constructor(readonly canvas: HTMLCanvasElement, readonly gpu: Gpu, readonly engine: Engine, readonly ch: GltfCharacter, readonly stage: Stage = buildStage(), host: RuntimeHost = {}) {
    this.hosted = !!host.hosted; this.cam = host.cam ?? new FollowCamera(); this.home = v3.copy(stage.center);
    for (const b of stage.boxes) engine.world.addStatic(b);
    this.stageLights = stage.lights.map(ld => engine.lights.add(lightFromDef(ld)));
    const S = engine.settings; S.skyZenith = stage.sky.zenith; S.skyHorizon = stage.sky.horizon;
    S.exposure = 1.4; S.hazeDensity = 0.006;   // a studio, not the office at night: little haze (the beam still reads), moderate exposure — otherwise a rail light pointed at the camera whites the stage out
    this.skyScale0 = { z: [...S.skyZenith], h: [...S.skyHorizon] };
    this.wallBox = stage.boxes[stage.wall];   // same object the BoxWorld holds (addStatic keeps the reference), so cutHeight edits take effect on the next frame
    this.stageCol = this.col = new StaticCollision(stage.boxes);   // what a dying mannequin's ragdoll collides with: the floor, the back wall, the cube and the post (the game hands it the office's)
    this.stageItems = new Throwables(this.stageCol, new PropSystem([], this.stageCol, () => {}));   // the game's throwable / dropped-item physics + models on the stage (dropped pistol / torch, canister bodies)
    this.tracers = new Tracers(engine.lights, this.sparks);   // the game's tracer streaks (their head lights in this engine's LightSet, their embers in these sparks)
    this.smoke = new SmokeSystem(engine); engine.setSmoke(this.smoke.binding); engine.afterSubmit.push(() => this.smoke.afterSubmit());   // same attachments as main.ts (gun smoke on 'shoot')
    this.chars = new CharacterRenderer(engine.device, ch); engine.skin = this.chars;
    engine.setMeshShadows(this.meshShadowsRt = new MeshShadows(engine.device, ch, this.chars.jointMats, this.chars.charInsts));   // the mesh-shadow experiment is available on the stage too (settings.meshShadows / ?meshShadows): the close-ups are where a limb's silhouette shows
    try { const fit = fitRig(ch); engine.setRigFit(ch.cast ? { ...fit, byOwner: this.rigFits } : fit); } catch (e) { console.warn('SDF rig: the round-cone fit failed, characters keep their hand capsules (traced untapered)', e); engine.setRigFit(null); }   // + the SDF character rig's radius fit (render/sdfrig.ts): the stage's proxies are the fitted round cones like the game's — the close-ups are where a limb's taper shows
    this.clipNames = [...ch.clips.keys()].sort((a, b) => a.localeCompare(b));
    // the two hand lights from the same definitions game.ts uses (its tune defaults: playerLight 60 · flashIntensity 70, inner 7°, outer 19°)
    this.railLight = engine.lights.add(railLightDef(CHAR_ID, 60));
    this.torchLight = engine.lights.add(torchLightDef('flashlight0', CHAR_ID, 70, 7, 19)); this.torchLight.enabled = false;
    this.gait = new GaitMeter(ch); this.marks = floorMarks(stage.center);
    this.spawn();
    // camera: the game's FollowCamera driven as an orbit camera (a host's camera is left as the host set it up)
    const cam = this.cam; this.focus = v3.add(stage.center, [0, 1, 0]);
    if (!host.cam) { cam.fov = 40 * DEG; cam.near = 0.1; cam.far = 80; cam.aimLead = 0; this.frame('body'); cam.distance = cam.desiredDistance; cam.target = v3.copy(this.focus); cam.desired = v3.copy(this.focus); cam.rebuild(); }
    this.input = host.input ?? new Input(canvas);
    if (!host.input) canvas.addEventListener('mousedown', () => { const ae = document.activeElement; if (ae instanceof HTMLElement && ae.closest('.pnl, #topbar')) ae.blur(); this.input.focusGame(); });   // a field that had focus lets go of the keyboard: a click in the view hands the hotkeys back (Input ignores keys while an input / select has focus)
    this.lastMX = this.input.mouseX; this.lastMY = this.input.mouseY;
    this.gizmo = new RigGizmo(canvas, cam, this.input);
    { const sk = new URLSearchParams(location.search).get('smokekeep'); if (sk !== null) engine.settings.smokeKeep = smokeKeepOf(sk); }   // ?smokekeep=0|1|2: the smoke under high as each preset had it / high's smoke at half size (the page) / high's whole path (ui/quality.ts SMOKE KEEP) — before the Quality below puts its first preset on
    { const og = new URLSearchParams(location.search).get('onegrid'); if (og !== null) engine.settings.oneCacheGrid = !(og === '0' || og === 'off' || og === 'false'); }   // ?onegrid=0, as on the game page (main.ts): before the Quality below puts its first preset on
    { const os = new URLSearchParams(location.search).get('onesolve'); if (os !== null) engine.settings.oneSmokeSolve = !(os === '0' || os === 'off' || os === 'false'); }   // ?onesolve=0, as on the game page (main.ts)
    this.quality = new Quality(engine, this.smoke);
    { const qp = new URLSearchParams(location.search).get('quality'); if (qp && (QUALITY_NAMES as string[]).includes(qp)) { this.quality.auto = false; this.quality.apply(qp as QualityName); } }
    { const q = new URLSearchParams(location.search); if ((meshAuthored(ch.mesh) || q.has('charmats')) && !q.has('nocharmats')) engine.settings.charMats = true; }   // character materials: as on the game page (main.ts) — on for a mesh with slot-named materials, ?charmats dresses the mannequin, ?nocharmats holds the two tints
    if (new URLSearchParams(location.search).has('meshShadows')) engine.settings.meshShadows = true;   // (AFTER the Quality construction and the ?quality pin: every preset writes settings.meshShadows — ultra on, the rest off — so set earlier it was dead; review 08-10 #23)
    // compat: __viewer.drive = i (a DRIVES index) writes speed / crouch / reverse off the natural clip speeds × speedMul
    Object.defineProperty(this.st, 'drive', { enumerable: false, configurable: true, get: () => this.driveIdx, set: (i: number) => { const D = DRIVES[i]; if (!D) return; this.driveIdx = i; this.st.speed = D.speed(defaultAnimParams) * this.st.speedMul; this.st.crouch = D.crouch; this.st.reverse = D.reverse; } });
  }
  readonly smoke: SmokeSystem; readonly chars: CharacterRenderer;

  msg(text: string) { this.messages.push({ text, t: performance.now() / 1000 }); if (this.messages.length > 4) this.messages.shift(); }

  // ---------------------------------------------------------------- figure
  /** a fresh mannequin on the centre mark (keeps the heading of the one it replaces) */
  spawn() {
    const keepYaw = this.char ? this.char.bodyYaw : this.st.bodyYawDeg * DEG;
    this.char = new Character(this.ch, { id: CHAR_ID, tint: v3.copy(PLAYER_TINT.tint), tint2: v3.copy(PLAYER_TINT.tint2), pos: v3.copy(this.home), yaw: keepYaw });
    this.char.aimYaw = keepYaw; this.char.update(0); this.gait.reset();
  }
  /** unit vector from the camera to the figure on the floor: 'die (shot)' throws the ragdoll along it like Game.killGuard does along the round */
  camShotDir(): Vec3 { const d = v3.sub(this.char.pos, this.cam.pos); d[1] = 0; return v3.normalize(d); }
  /** death = the game's ragdoll (Character.ragdollize): 'shot' shoved along the camera's view, 'takedown' folds it forward quietly */
  die(kind: 'shot' | 'takedown') { if (!this.char.alive) this.spawn(); if (kind === 'shot') this.char.ragdollize(this.col, this.camShotDir(), false); else this.char.ragdollize(this.col, this.char.forward(), true); }
  /** switch what the figure's physics collide with: a host's level statics while he is staged in it, null = the studio's own set again. Items in flight belonged
   *  to the other world and go with it (Throwables / PropSystem hold their collision for life, so a fresh pair is stood up over the new set). */
  useCollision(col: StaticCollision | null) {
    const next = col ?? this.stageCol; if (next === this.col) return;
    this.col = next; this.stageItems = new Throwables(next, new PropSystem([], next, () => {}));
  }
  /** put the root back on the centre mark and restart the path clocks (variant switch, path change) */
  resetMotion() {
    this.home = this.st.home ? v3.copy(this.st.home) : v3.copy(this.stage.center);   // (the variant's mark: a spot in the level, or the studio's centre)
    const c = this.char; c.pos = v3.copy(this.home); c.vel = [0, 0, 0];
    this.circPhi = Math.PI / 2 + this.st.legYawDeg * DEG; this.legT = 0; this.legDir = 1; this.turnT = 0; this.turnTarget = c.bodyYaw; this.wallTurn = 0;
    this.tacT = 0.3; this.autoFireT = 0.3; this.doorAng = 0; this.doorVel = 0; this.st.cans.t = 0; c.anim.doorPush = null;
    this.gait.reset();
  }
  setPath(i: number) { this.st.path = i; this.resetMotion(); if (i !== 1) { this.char.bodyYaw = this.st.bodyYawDeg * DEG; } }
  /** stand the figure on another mark (null = the studio centre) — the workbench's staging scenes set state.home; this is the by-hand mirror */
  setHome(p: Vec3 | null) { this.st.home = p ? v3.copy(p) : null; this.resetMotion(); if (this.st.path !== 1) this.char.bodyYaw = this.st.bodyYawDeg * DEG; }
  setBodyYaw(deg: number) { this.st.bodyYawDeg = deg; this.char.bodyYaw = deg * DEG; this.turnTarget = deg * DEG; }

  // ---------------------------------------------------------------- camera
  frame(kind: FrameKind) {
    const st = this.st, cam = this.cam;
    if (kind === 'body') { st.track = 1; cam.yaw = 0; cam.pitch = 12 * DEG; cam.desiredDistance = 2.8; }
    if (kind === 'back') { st.track = 1; cam.yaw = Math.PI; cam.pitch = 14 * DEG; cam.desiredDistance = 2.8; }
    if (kind === 'head') { st.track = 2; cam.pitch = 8 * DEG; cam.desiredDistance = 0.9; }
    if (kind === 'hand') { st.track = 3; cam.pitch = 25 * DEG; cam.desiredDistance = 0.9; }
    if (kind === 'feet') { st.track = 0; this.focus = v3.add(this.char.pos, [0, 0.25, 0]); cam.pitch = 20 * DEG; cam.desiredDistance = 1.8; }
    this.onFrame?.(kind);
    if (kind === 'profile') { st.track = 1; cam.yaw = -Math.PI / 2; cam.pitch = 8 * DEG; cam.desiredDistance = 3.4; }   // the gait lab's views
    if (kind === 'front') { st.track = 1; cam.yaw = 0; cam.pitch = 10 * DEG; cam.desiredDistance = 3.0; }
    if (kind === 'threeq') { st.track = 1; cam.yaw = -0.7; cam.pitch = 18 * DEG; cam.desiredDistance = 3.6; }
    if (kind === 'top') { st.track = 1; cam.yaw = 0; cam.pitch = 55 * DEG; cam.desiredDistance = 7; }   // ≈ the game's camera
    if (kind === 'backTop') { st.track = 1; cam.yaw = Math.PI; cam.pitch = 50 * DEG; cam.desiredDistance = 4.2; }   // behind and well above: the slung rifle across the back as the game's camera sees it, close enough to judge how flat it lies
  }
  /** a host hears of a framing (the workbench mirrors focus / distance onto its own view) */
  onFrame: ((kind: FrameKind) => void) | null = null;
  setSky(v: number) { this.skyScale = v; const S = this.engine.settings, z0 = this.skyScale0.z, h0 = this.skyScale0.h; S.skyZenith = [z0[0] * v, z0[1] * v, z0[2] * v]; S.skyHorizon = [h0[0] * v, h0[1] * v, h0[2] * v]; }

  // ---------------------------------------------------------------- one-shots
  shoot() {
    const char = this.char, st = this.st;
    if (!char.anim.rawClip) char.anim.fire();   // (the raw-clip bypass never advances the shot layer, so don't arm it there — the flash still goes off at the muzzle)
    const muzzle = v3.copy(char.muzzle), dir = v3.copy(char.gunDir);
    // the game's own graded shot (src/game/effects.ts spawnShot + Sparks): bore + port gas, wisps, powder sparks, the warm flash lights, a 1-frame flame card —
    // driven by the same numbers the Effects group edits, so what you tune here IS what the game fires
    const track = () => ({ pos: char.muzzle, dir: char.gunDir });
    const port = () => ({ pos: v3.add(v3.mad(char.bones.handR ?? char.muzzle, char.gunDir, 0.06), [0, 0.06, 0]), dir: [0, 1, 0] as Vec3 });
    // the flame card and the flash's gain / reach are the muzzle block of the kit in the hands (effects.ts muzzleFx, what fireWeapon reads off the weapon's row):
    // the carbine's fireball for the guard kit's long gun, the bare 9 mm's for his sidearm, the Five-seveN's through its can for the player, the FN2000's out of
    // its integral suppressor with the rifle in Sam's hands (× suppressedGain like the pistol's: both rows are suppressed) — grade them here (R2 / R5)
    const M = fxm.muzzleFx[st.guard && st.carbine ? 'carbine' : st.guard ? 'pistolBare' : this.samRifle() ? 'sc20k' : 'pistolSuppressed'];
    this.fx.push({ box: makeBox({ c: v3.mad(muzzle, dir, M.cardAhead), h: v3.copy(M.cardHalf), yaw: v3.yawOf(dir), albedo: v3.copy(fxm.muzzleCard.albedo), emissive: v3.copy(M.cardEmissive), flags: BoxFlag.Dynamic | BoxFlag.NoShadow }), ttl: 0.035 });   // 1-frame flame card (fireWeapon's)
    for (const L of fxm.spawnShot(st.gunSmoke ? this.smoke : { emit: () => {} } as unknown as SmokeSystem, this.sparks, muzzle, dir, { seed: this.fxSeed++, lightGain: M.lightGain * (st.guard ? 1 : fxm.shot.suppressedGain), lightRange: M.lightRange, track, eject: port }))
      this.engine.lights.flash(L.pos, L.color, L.intensity, L.range, L.ttl, CHAR_ID);
    // tracers (R6): the round traced against the stage (floor, back wall, cube, post — 60 m of nothing past them) and cycled out of the kit's stand-in gun, so the
    // game's rule decides exactly as it does off a guard's carbine (every third + the last three of thirty; a dry box is changed on the spot); the pistols' rows
    // carry no tracer. 'tracer every round' (Effects) forces one whatever the row — for grading the streak, not the rule
    { const gun = this.gunFor(st.guard && st.carbine ? 'aks74u' : st.guard ? 'guard9mm' : 'fiveseven');
      if (!gun.fire()) { gun.rearm(); gun.fire(); this.msg(`${gun.def.short}: fresh box`); }
      const hit = this.col.raycast(muzzle, dir, 60); const tHit = hit ? hit.t : 60;
      if (this.tracers.round(gun, gun.def, muzzle, dir, tHit, hit ? 'solid' : 'none', CHAR_ID, st.tracerAll) && !UPPERS[st.upper].autoFire) this.msg(`tracer — round ${gun.spent} of ${gun.def.magCapacity}${gun.roundsReady < (gun.def.tracer?.lastN ?? 0) ? ' (last three: box nearly out)' : ''}`); }
    if (st.hold.on) st.hold.shotT = 0;   // holder: the recoil kick on the gun hand (gun variant, gun out); held man: the duck off a round past his ear (HeldPose.shot)
  }
  /** the stand-in gun whose counters the tracer rule reads for K's rounds (one per row, made on first use; the pistols' rows only ever say no) */
  private gunFor(id: WeaponId): Firearm { let g = this.guns.get(id); if (!g) { g = new Firearm(WEAPONS[id]); this.guns.set(id, g); } return g; }
  /** the stand-in carbine's counters, for the sheet: 'AKS-74U 27/30' */
  gunLine(): string { const g = this.guns.get('aks74u'); return g ? `${g.def.short} ${g.roundsReady}/${g.def.magCapacity} · round ${g.spent} out` : 'AKS-74U — (fire the carbine: G + C, K)'; }
  /** fire one of TAC_SHOTS (state.ts) by index */
  fireTac(i = this.st.tacShot) {
    const an = this.char.anim, st = this.st; if (an.rawClip) return;
    switch (i) {
      case 0: an.kickDoor(); break;
      case 1: case 2: case 3: an.signal((['hold', 'go', 'rally'] as SignalKind[])[i - 1]); break;
      case 4: an.flinch(); break;
      case 5: if (st.throwDist > 0) { const was = THROW_BY.on; THROW_BY.on = true; an.throwItem(st.throwDist); THROW_BY.on = was; } else an.throwItem(); break;   // (the sheet's 'throw distance m': the swing that reads that far, whatever the switch says)
      case 6: { const R = this.samRifle() ? WEAPONS.fn2000.reload : st.guard && st.carbine ? WEAPONS.aks74u.reload : null; if (R) an.reload(this.samRifle() ? R.dur : undefined, R); else an.reload(); break; }   // (a long gun: the weapon's own beat for the moves' support hand, as the game deals it)
      case 7: this.shoot(); break;
      case 8: an.strike(); break;
      case 9: if (st.hold.on) { st.hold.variant = st.hold.variant ? 0 : 1; if (st.hold.variant === 1 && st.hold.who === 0) st.slot = 1; this.msg(`hold: E → ${HOLD_VARIANTS[st.hold.variant]} (the layers hand the tools over, HOLD.secs.swap ${HOLD.secs.swap} s)`); } break;
      case 10: st.hold.on = !st.hold.on; st.hold.t = 0; if (st.hold.on) { st.hold.phase = 0; st.hold.chain = true; } this.msg(st.hold.on ? 'hold: taken again (the reach, then held)' : 'hold: let go (the layers ease out)'); break;
      case 11: st.doorHand.w = st.doorHand.w > 0.5 ? 0 : 1; this.msg(st.doorHand.w ? 'door hand: pushing (w 1)' : 'door hand: off the leaf (w 0, easing out)'); break;
      case 12: an.signal('squeeze'); break;   // (the stack's 'set': appended, the three older signals keep 1‥3)
      case 13: an.signal('aside'); break;     // (showwhy.ts 'off my line': the hand pushed out to his left)
      case 14: an.signal('aside', -1); break; // (… and across his front to his right)
    }
  }
  /** Pose the figure at an exact instant of a one-shot for a still: pauses the character clock, pushes the state into the animator, runs out anything still
   *  playing and lets the layers settle (0.8 s), fires `shot` (if given) and advances the animator alone to `t` in 1/120 s steps. The frame loop keeps
   *  rendering the frozen pose (props, lights, camera live), so orbit / __shot afterwards; un-pause to carry on. */
  poseAt(t: number, shot?: 'kick' | SignalKind | 'flinch' | 'throw'): string {
    const char = this.char, an = char.anim, st = this.st; st.paused = true;
    an.stance = STANCES[st.stance]; an.stackSide = st.stackSide; an.lockpick = st.lockpick; an.speed = st.speed; an.crouchTarget = st.crouch; an.upper = this.upperMode(); an.wallPeek = st.peek; an.deliberate = st.deliberate;
    this.armLong(false);
    for (let i = 0; i < 400 && (an.kicking || an.signalling || an.inThrow); i++) char.update(1 / 60);
    for (let i = 0; i < 48; i++) char.update(1 / 60);
    if (shot) this.fireTac(shot === 'kick' ? 0 : shot === 'flinch' ? 4 : shot === 'throw' ? 5 : shot === 'squeeze' ? 12 : shot === 'aside' ? 13 : ['hold', 'go', 'rally'].indexOf(shot) + 1);   // (squeeze sits at the END of TAC_SHOTS: indexOf's −1 used to make it the door kick)
    for (let i = 0, n = Math.max(0, Math.round(t * 120)); i < n; i++) char.update(1 / 120);
    return `${shot ?? 'settled'} @ ${t.toFixed(3)} s${an.kicking ? ` (kick t=${an.kickTime.toFixed(3)})` : ''}${an.inThrow ? ` (throw t=${an.throwTime.toFixed(3)}${an.throwTime >= THROW_RELEASE ? ', released' : ', can in hand'}, ${an.throwRead})` : ''} — viewer paused`;
  }
  /** the upper-body mode the state comes to: as player.ts has it, the relaxed two-hand carry only with the pistol actually in the hand (holstered or a can up →
   *  the arms follow the legs; the rifle in the hands → the long-gun solve has the arms, 'relaxed' comes to none); the guard kit always has something in the hand */
  upperMode(): UpperMode { const st = this.st; const m = UPPERS[st.upper].mode; return !st.guard && (st.slot !== 1 || this.samRifle()) && m === 'relaxed' ? 'none' : m; }
  /** Sam's FN2000 is in his hands (player kit, rifle 2, no raw clip): the long-gun solve with RIG.sc20k's grip point, the pistol on the thigh whatever the slot says */
  samRifle(): boolean { const st = this.st; return !st.guard && st.rifle === 2 && !this.char.anim.rawClip; }
  /** rifles: arm the animator's long gun from the state — the guard kit's carbine or Sam's FN2000 in the hands (each with its own support-hand grip point off RIG and
   *  its own muzzle length; game.ts / player.ts do the same per frame), the carriage forced by longStance or derived; `busy` = the hands are on the lock tools / a held
   *  man this frame (Sam's rifle then goes to the sling, as player.ts has it) */
  armLong(busy: boolean) {
    const st = this.st, c = this.char, an = c.anim; const raw = !!an.rawClip;
    const guardLong = st.guard && st.carbine && !raw, samLong = this.samRifle() && !busy && c.alive;
    an.longGun = guardLong || samLong; an.reloadBack = samLong && !GEAR.on; an.longStance = an.longGun && st.longStance ? LONG_STANCES[st.longStance - 1] : null;
    an.longSteady = st.longSteady === 1 ? 0 : st.longSteady === 2 ? 1 : samLong ? 1 : 0;   // steadied against the gait as the game has it (player.ts armRifle: Sam 1; the guards' riflemen 0), or forced either way for the A/B
    if (samLong) { an.longGrip = sc20kGrip(RIG); c.muzzleAhead = sc20kMuzzleAhead(RIG); }
    else if (guardLong) { an.longGrip = carbineGrip(RIG); c.muzzleAhead = carbineMuzzleAhead(RIG); }
    else c.muzzleAhead = 0.26;
  }
  /** scripted stance by name (the __tac hook) */
  setStance(name: Stance, side?: -1 | 1) { const i = STANCES.indexOf(name); if (i < 0) throw new Error(`stance: one of ${STANCES.join(' ')}`); this.st.stance = i; if (side) this.st.stackSide = side; }
  /** rifles: the carbine in the guard kit's hands (true = guard kit + carbine) and which carriage — null = derived, else forced */
  setLong(on: boolean, name?: LongStance | null) { const st = this.st; st.carbine = on; if (on) st.guard = true; if (name !== undefined) { const i = name ? LONG_STANCES.indexOf(name) : -1; if (name && i < 0) throw new Error(`long: one of ${LONG_STANCES.join(' ')} (or null = derived)`); st.longStance = i + 1; } }

  // ---------------------------------------------------------------- items / canisters
  /** the game's item models + physics tossed from the hand — the pistol / torch / rifle a dying hand lets go of (rifle: fill 0 = a guard's AKS-74U, `suppressed` /
   *  fill 1 = Sam's FN2000), the canister bodies, a magazine, a spent ring airfoil */
  toss(kind: TossKind, suppressed = false) {
    const char = this.char; const h = char.bones.handR ?? v3.add(char.pos, [0, 1.1, 0]); const f = char.forward();
    const it = this.stageItems.spawn(kind as ItemKind, [h[0], Math.max(0.3, h[1]), h[2]], [f[0] * 1.4 + (Math.random() - 0.5) * 0.5, 1.0, f[2] * 1.4 + (Math.random() - 0.5) * 0.5], { fill: suppressed ? 1 : 0, fuse: 1e9, life: 600 });
    if (kind === 'rifle') { it.tumbleRate *= 0.55; it.spin *= 0.5; }   // (as combat.ts dropFromHand: 0.7 m of it turns over, it does not flick round)
    this.msg(`tossed: ${kind === 'rifle' ? (suppressed ? gearText('FN2000') : 'AKS-74U') : kind}${suppressed && kind === 'pistol' ? ' (suppressed)' : ''}`);
  }
  /** the floor mark 1.6 m ahead of the figure where the canisters go off */
  dropPoint(): Vec3 { const c = this.char, f = c.forward(); return [c.pos[0] + f[0] * 1.6, 0.05, c.pos[2] + f[2] * 1.6]; }
  smokeCan() {
    const at = this.dropPoint(); const yaw = this.char.bodyYaw;
    if (this.st.cans.plume) this.smoke.spawnCanister(at);                       // the shipped plume (upward jet: the Smoke panel numbers)
    else fxm.spawnVent(this.smoke, fxm.ventMouth(at, yaw), yaw);                 // the ported floor vent (effects.ts `vent`)
    this.msg(this.st.cans.plume ? 'smoke canister: plume' : 'smoke canister: floor vent');
  }
  stunCan() {
    const at = this.dropPoint(); const B = fxm.bang; const L = fxm.spawnBurst(this.smoke, this.sparks, [at[0], at[1] + B.height, at[2]], this.fxSeed++);
    const light = this.engine.lights.flash(L.pos, L.color, L.intensity, L.range, L.ttl, 0); if (L.radius) light.radius = L.radius; this.msg('stun canister');
  }
  emitterAdj(key: string, off: Vec3) { let a = this.emitterAdjs.get(key); if (!a || a.off !== off) { a = { off, rot: [0, 0, 0] }; this.emitterAdjs.set(key, a); } return a; }

  /** engine readback → JPEG → capture sink (:5174), like the game page's (headless grading of the stage) */
  async shot(name: string, quality = 0.86): Promise<string> {
    this.engine.render(this.cam, this.time, 1 / 60, false);
    const c2 = await frameCanvas(this.engine); if (!c2) return 'no frame';
    const blob: Blob = await new Promise(res => c2.toBlob(b => res(b!), 'image/jpeg', quality));
    return `${c2.width}x${c2.height} ${(blob.size / 1024).toFixed(0)} KB → ${await postShot(name, blob)}`;
  }

  // ---------------------------------------------------------------- frame
  /** One viewer frame: orbit camera off the mouse, drive the character through the game's fields, emit props / lights / markers, feed the engine, render.
   *  Hotkeys are the UI's (main.ts) — this only reads the mouse. */
  /** ONE standalone frame: the orbit camera off the mouse, the figure and everything round it (simulate), the camera + render (present) */
  step(dt: number) {
    const { input, canvas } = this;
    this.orbitFromInput();
    if (canvas.clientWidth > 0 && canvas.clientHeight > 0) { this.simulate(dt); this.present(dt); }
    input.endFrame();
    this.fpsSm = this.fpsSm * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
  }
  /** the standalone page's orbit camera (mouse deltas from the game's Input; the panels swallow their own events) — a host drives its own camera instead */
  orbitFromInput() {
    const { st, input, cam, gizmo } = this;
    const dx = input.mouseX - this.lastMX, dy = input.mouseY - this.lastMY; this.lastMX = input.mouseX; this.lastMY = input.mouseY;
    const shiftPan = input.lmb() && (input.down('ShiftLeft') || input.down('ShiftRight'));
    if (input.lmb() && !gizmo.busy && !shiftPan) { cam.yaw -= dx * 0.008; cam.pitch = clamp(cam.pitch + dy * 0.006, -8 * DEG, 85 * DEG); }   // 'grab the mannequin' sense (unless a gizmo handle has the drag)
    if (input.rmb() || input.mmb() || (shiftPan && !gizmo.busy)) { const { right } = cam.planarBasis(); const kp = cam.distance * 0.0017; this.focus = v3.mad(this.focus, right, -dx * kp); this.focus[1] = clamp(this.focus[1] + dy * kp, 0.03, 2.8); st.track = 0; }
    if (input.wheel) cam.desiredDistance = clamp(cam.desiredDistance * Math.exp(input.wheel * 0.0012), 0.5, 12);
  }
  /** Drive the figure through the game's own fields and lay out everything round it for THIS frame: props + hand lights (world.dynamics = this.dyn), the skin
   *  instance, the capsule proxies, the camera's tracked focus (this.focus), the studio wall's cut, the smoke. No camera update, no render — present() or the host does that. */
  simulate(dt: number) {
    const { st, cam, gizmo, engine, stage, canvas } = this; const S = engine.settings;
    this.time += dt;
    {
      // ---- drive the character exactly through the fields game.ts writes
      const c = this.char; const U = UPPERS[st.upper]; const time = this.time;
      const cdt = st.paused ? 0 : dt * st.rate; this.simT += cdt;
      { const P = c.anim.params; P.walkSpeed = defaultAnimParams.walkSpeed; P.jogSpeed = defaultAnimParams.jogSpeed; P.crouchSpeed = defaultAnimParams.crouchSpeed; P.sprintSpeed = defaultAnimParams.sprintSpeed; }   // the gait lab's clip-speed knobs turn defaultAnimParams: the figure follows live
      if (st.clip > 0) { const clip = this.ch.clips.get(this.clipNames[st.clip - 1])!; if (c.anim.rawClip?.clip !== clip) c.anim.rawClip = { clip, time: 0, rate: 1, loop: true }; }
      else c.anim.rawClip = null;
      const raw = !!c.anim.rawClip;
      c.anim.crouchTarget = st.crouch; c.anim.reverse = st.reverse; c.anim.deliberate = st.deliberate;
      const onWall = STANCES[st.stance] === 'wall' && !raw; const pk = onWall ? st.peek * st.peek * (3 - 2 * st.peek) : 0;
      c.anim.upper = raw ? 'none' : this.upperMode(); c.anim.lookYawExtra = st.lookYawDeg * DEG - st.stackSide * WALL_PEEK_LOOK * pk;   // ('aim' would pull gunDir toward the analytic aim while the raw clip's hand is elsewhere)   // (+ the game's peek crane: player.ts moveOnWall)
      c.anim.stance = STANCES[st.stance]; c.anim.stackSide = st.stackSide; c.anim.lockpick = st.lockpick; c.anim.wallPeek = st.peek;
      { // the hold: one figure of the pair (player.ts holdTail sets exactly these fields; upper / stance / crane off as it does)
        const Hs = st.hold; const ph = HOLD_PHASES[Hs.phase], variant = HOLD_VARIANTS[Hs.variant];
        if (Hs.on && !raw) {
          if (Hs.auto) { Hs.t += cdt; if (ph !== 'held' && Hs.t > holdDur(ph)) { Hs.t = 0; if (ph === 'grab' && Hs.chain) Hs.phase = 1; } }   // (the one-shots loop; a chained grab runs on into the hold)
          if (Hs.shotT >= 0) { Hs.shotT += cdt; if (Hs.shotT > 1.5) Hs.shotT = -1; }
          c.anim.upper = 'none'; c.anim.stance = 'none'; c.anim.lookYawExtra = 0;
          const live = ph === 'held' || Hs.t <= holdDur(ph) - (ph === 'whip' ? 0.5 : ph === 'kill' ? 0.8 : 0);   // past the whip's / the kill's end the controller has let go: show the layer's own way out
          c.anim.holdPose = Hs.who === 0 && live ? { phase: ph, t: Hs.t, variant, gunOut: Hs.gunOut, gunPitch: Hs.gunPitchDeg * DEG, kill: true, beats: true } : null;   // (kill / beats: takedown.ts's two hold halves shown — no Game here to switch them)
          c.anim.heldPose = Hs.who === 1 && live ? { phase: ph, t: Hs.t, agitation: Hs.agitation, variant, shot: Hs.shotT, armed: !st.guardTorch, kill: true, beats: true } : null;   // (armed: the guard kit's drawn pistol stays in the raised fist, as a man grabbed with it out keeps his)
        } else { c.anim.holdPose = null; c.anim.heldPose = null; }
      }
      if (st.tacLoop && !st.paused) { this.tacT -= cdt; if (this.tacT <= 0) { this.tacT = st.tacEvery; this.fireTac(); } }
      if (U.autoFire && !st.paused && !raw) { this.autoFireT -= cdt; if (this.autoFireT <= 0) { this.autoFireT = 0.6; this.shoot(); } }
      if (st.turntable && !st.paused && c.alive) { c.bodyYaw = wrapAngle(c.bodyYaw + st.turnRate * DEG * cdt); st.bodyYawDeg = Math.round(c.bodyYaw / DEG); }
      // ---- root motion: the path decides where the root goes and which way it heads; `speed` is what the legs are told (a body on the floor is the ragdoll's: left alone)
      let speed = st.speed;
      const turnWas = this.wallTurn; const wallTurn = this.wallTurn = approachAngle(this.wallTurn, onWall && speed > 0.3 ? -st.stackSide * WALL_TURN : 0, 10 * cdt);   // the game's sidle: legs turned toward travel, the wall staying where it was (behind the un-turned heading)
      if (!c.alive) { speed = 0; }
      else if (st.path === 1) {   // walk a 2 m circle about the mark (analytic, no drift): real foot planting to judge against the floor marks; a backpedal faces against
        this.circPhi += (speed / CIRCLE_R) * cdt;   // the travel; heading comes from the tangent itself so it holds when the speed drops to 0 (turntable / body yaw only apply on the treadmill)
        c.pos = [this.home[0] + CIRCLE_R * Math.cos(this.circPhi), 0, this.home[2] + CIRCLE_R * Math.sin(this.circPhi)];
        c.vel = [-Math.sin(this.circPhi) * speed, 0, Math.cos(this.circPhi) * speed];             // tangent × speed (d pos / dt)
        c.bodyYaw = wrapAngle(Math.atan2(-Math.sin(this.circPhi), Math.cos(this.circPhi)) + (st.reverse ? Math.PI : 0) + wallTurn); st.bodyYawDeg = Math.round(c.bodyYaw / DEG);
      } else if (st.path === 2) {   // back and forth along the leg's heading (legYawDeg, 0 = +z; LEG each way of the mark, or the variant's legM): accelerate like player.ts (rate 6 up / 12 down), stop 0.8 s at each end, turn round, go again
        const legM = st.legM > 0 ? st.legM : LEG; const legYaw = st.legYawDeg * DEG;
        this.legT += cdt; const legS = legM / Math.max(0.3, st.speed); const cyc = legS + 0.8 + 0.6; const tIn = this.legT % cyc; const moving = tIn < legS;
        const want = moving ? st.speed : 0; const cur = v3.len(c.vel); const nv = cur + (want - cur) * (1 - Math.exp(-(want > cur ? 6 : 12) * cdt)); speed = nv;
        if (!moving && tIn > legS + 0.8 && this.legDir === (Math.floor(this.legT / cyc) % 2 === 0 ? 1 : -1)) this.legDir = -this.legDir;
        const yawWant = legYaw + (this.legDir > 0 ? 0 : Math.PI); c.bodyYaw = wrapAngle(c.bodyYaw + clamp(wrapAngle(yawWant - c.bodyYaw), -7 * cdt, 7 * cdt));
        const f = c.forward(); c.vel = [f[0] * nv, 0, f[2] * nv]; c.pos = v3.mad(c.pos, c.vel, cdt);
        { const ax: Vec3 = [Math.sin(legYaw), 0, Math.cos(legYaw)]; const along = (c.pos[0] - this.home[0]) * ax[0] + (c.pos[2] - this.home[2]) * ax[2]; if (Math.abs(along) > legM + 0.5) { const cl = Math.sign(along) * (legM + 0.5); c.pos = [this.home[0] + ax[0] * cl, c.pos[1], this.home[2] + ax[2] * cl]; } }   // (never past the leg's ends, whatever the turn took)
        st.bodyYawDeg = Math.round(c.bodyYaw / DEG);
      } else if (st.path === 3) {   // turn on the spot: 90° every 2 s at the player's standing turn rate (7 rad/s)
        this.turnT += cdt; if (this.turnT > 2) { this.turnT = 0; this.turnTarget = wrapAngle(this.turnTarget + Math.PI / 2); } speed = 0; c.vel = [0, 0, 0]; c.pos = v3.copy(this.home);
        c.bodyYaw = wrapAngle(c.bodyYaw + clamp(wrapAngle(this.turnTarget - c.bodyYaw), -7 * cdt, 7 * cdt)); st.bodyYawDeg = Math.round(c.bodyYaw / DEG);
      } else {   // treadmill: the root stays on the mark, the floor is taken to slide back under him at his speed
        if (wallTurn !== turnWas) { c.bodyYaw = wrapAngle(c.bodyYaw + wallTurn - turnWas); st.bodyYawDeg = Math.round(c.bodyYaw / DEG); }
        const f = c.forward(); const s = speed * (st.reverse ? -1 : 1); c.vel = [f[0] * s, 0, f[2] * s];
      }
      const awayYaw = c.bodyYaw - wallTurn; c.anim.wallYaw = -wallTurn;   // (the wall's normal off his front)
      c.aimYaw = awayYaw + st.aimYawDeg * DEG; c.aimPitch = st.aimPitchDeg * DEG;   // (on the wall the aim offset reads off the wall's normal, as the game's cursor aim does)
      if (st.sweep && !raw) { c.aimYaw += Math.sin(this.simT * 1.1) * 1.1; c.anim.lookYawExtra += Math.sin(this.simT * 1.9) * 0.4; }   // guards.ts search: the torso sweeps the beam about, the head hunts on top of it
      if (st.hold.on && !raw) {   // the hold has no chest twist of its own (player.ts updateHold: aimYaw = bodyYaw) and its own pitch
        c.aimYaw = c.bodyYaw;
        c.aimPitch = st.hold.who === 0 ? (HOLD_VARIANTS[st.hold.variant] === 'gun' ? st.hold.gunPitchDeg * DEG * st.hold.gunOut : -0.05)   // (the game presents the gun at the aim's pitch: the drawn prop rides aimDir while a shot plays)
          : 0.55 + 0.25 * Math.sin(time * 1.3 + 2) + 0.1 * Math.sin(time * 3.1);                                                              // (the held man's torch wanders over the ceiling: player.ts holdTail)
      }
      c.anim.speed = speed;
      let T = st.guard ? GUARD_TINT : PLAYER_TINT; this.wornSide = st.guard ? 'defender' : 'operator';
      if (this.ch.cast) {   // THE CAST: what he wears — `wear` (a variant by name: __vrt.wear = 'defender_2') or, unset, the first defender as the guard kit / the first operator as Sam; + that kit's own proxy fit
        const cast = this.ch.cast; const named = cast.variants.find(x => x.name === this.wear); const v = named ?? castSide(cast, st.guard ? 'defender' : 'operator')[0];
        if (named) { this.wornSide = named.side; T = WEAR_TINT[named.side]; }   // an outfit put on BY NAME: its own side's table and tints, whatever the scene (unnamed, the scene's kit keeps the scene's side, as the game dresses a man by his team)
        const mask = castGoggles(cast, v.mask, !st.guard && st.showProps && st.goggles);   // (the rig's box goggles drawn on him: no mesh pair as well — the game's rule, game/cast.ts)
        if (c.parts !== mask) { c.parts = mask; try { this.rigFits.set(c.id & 0xff, fitRig(this.ch, mask)); } catch { this.rigFits.delete(c.id & 0xff); } }   // (solved when what he wears changes; a fit that throws leaves him the shared one)
      }
      c.tint = T.tint; c.tint2 = T.tint2;
      this.armLong(c.anim.hideHeldItem);   // rifles: the carbine in the guard kit's hands or the FN2000 in Sam's — the animator's long-gun solve, its support-hand grip point off RIG (live: the rows / gizmo move the hand), the muzzle out where the prop's is (game.ts / player.ts do the same per frame; last frame's hideHeldItem, as player.ts reads it)
      { // a hand on the door leaf (game.ts handsOnDoors feeds exactly this): the palm's spot on the marker leaf's face in front of that shoulder at chest height, the face's normal back at him
        const D = st.doorHand;
        if (D.on && !raw && c.alive) {
          const f = c.forward(); const rgt: Vec3 = [-Math.cos(c.bodyYaw), 0, Math.sin(c.bodyYaw)];   // his right on the floor (model −X)
          const sh = (D.hand ? c.bones.upperArmR : c.bones.upperArmL) ?? v3.add(c.pos, [0, 1.4, 0]);
          const face = st.door.dist - 0.02; const side = D.hand ? 0.16 : -0.16;
          const p: Vec3 = [c.pos[0] + f[0] * face + rgt[0] * side, clamp(sh[1] - 0.1, 0.85, 1.36), c.pos[2] + f[2] * face + rgt[2] * side];
          c.anim.doorPush = { p, n: [-f[0], 0, -f[2]], w: D.w, hand: D.hand };
        } else c.anim.doorPush = null;
      }
      c.update(cdt);
      if (cdt > 0) { const f = c.forward(); const gs = st.speed * (c.anim.reverse ? -1 : 1); this.gait.sample(c, this.simT, st.path === 0 ? [-f[0] * gs, 0, -f[2] * gs] : null); }   // treadmill: the floor slides back under him at his speed
      if (c.anim.kickImpact) { this.kickFlashT = 0.25; this.doorVel = 9; this.msg(st.door.show ? 'kick: impact — the leaf goes' : 'kick: impact (door goes here)'); } this.kickFlashT = Math.max(0, this.kickFlashT - dt);
      if (c.anim.kicking && c.anim.kickTime < 0.05) { this.doorAng = 0; this.doorVel = 0; }   // a fresh kick finds the leaf shut
      { const tt = c.anim.throwTime;
        if (this.prevThrowT >= 0 && this.prevThrowT < THROW_RELEASE && tt >= THROW_RELEASE) {
          this.relFlashT = 0.25; this.msg('throw: release (the can leaves the hand here)');
          if (st.throwSpawn && !st.guard && st.slot === 2) { const h = c.bones.handR ?? v3.add(c.pos, [0, 1.5, 0]); const f = c.forward(); this.stageItems.spawn('smoke', v3.copy(h), [f[0] * 6.5, 2.4, f[2] * 6.5], { fuse: 1e9, life: 20, who: CHAR_ID }); }   // (the game's pendingThrow puts the item in the air at exactly this instant; a dead fuse: it is the arc being judged, not the plume)
        }
        this.prevThrowT = tt; this.relFlashT = Math.max(0, this.relFlashT - dt); }

      // ---- props + hand lights: the functions game.ts uses, fed from the state
      const dyn = this.dyn, meta = this.meta; dyn.length = 0; meta.length = 0;
      const handsBusy = c.anim.hideHeldItem;   // the animator says the hands are on the lock tools / round a man: draw an empty hand (sidearm holstered, no can, no hand light) whatever the kit says
      const railLight = this.railLight, torchLight = this.torchLight;
      if (st.guard) {
        let dir = c.gunDir; const torch = st.guardTorch && c.alive && !st.carbine;   // game: only a patrolling (hence living) guard carries the torch; a body keeps a lit weapon light; a rifleman's light is on the carbine
        if (torch) { this.beamDir = torchCarryDir(c, this.beamDir); dir = this.beamDir; }   // attachFlashlight's relaxed carry (same helper)
        else this.beamDir = v3.copy(dir);
        torchLight.enabled = st.lightOn && !handsBusy;
        if (st.carbine) { const lp = carbineLightPose(c, RIG); torchLight.pos = lp.pos; torchLight.dir = lp.dir; } else { torchLight.pos = rigTorchPos(c, dir, torch); torchLight.dir = dir; }
        railLight.enabled = false;
        // IN HAND (game/inhand.ts), as combat.ts guardKit says it: the figure is told what its right hand holds (its look-only pass poses the hand to it next update), a pistol is
        // laid out in the hand's own frame and a defender's holster hangs clear of his shirt. A raw clip is shown as the clip is: nothing is said.
        const ih = INHAND.on, HO = ih && this.wornSide === 'defender' ? INHAND.holsterOut : 0, HR = HO ? { ...RIG.holster, out: RIG.holster.out + HO } : undefined;
        c.inHand = !ih || handsBusy || c.anim.rawClip ? null : st.carbine ? (INHAND.long ? longHold('carbine') : null) : torch ? (INHAND.torch ? torchHold(this.beamDir) : null) : IN_PISTOL;
        if (st.showProps) { if (handsBusy && !st.carbine) holsterBoxes(c, dyn, { slide: RIG.guardPistol.slide, grip: RIG.guardPistol.grip }, meta, HR); else rigBoxes(c, { goggles: false, nv: false, slot: 1, lightOn: st.lightOn, isGuard: true, torch, beamDir: this.beamDir, lensColor: torchLight.color, weapon: st.carbine ? 'carbine' : 'pistol', ...(ih && !st.carbine && !torch ? { inHand: true } : null), ...(HO ? { holsterOut: HO } : null) }, dyn, RIG, meta); }
      } else {
        torchLight.enabled = false;
        const rifleHand = this.samRifle() && !handsBusy && c.alive;   // the FN2000 in both hands (else, if carried at all, across his back)
        railLight.enabled = st.lightOn && (st.slot === 1 || rifleHand) && !handsBusy;   // the one weapon light: the rail light under the Five-seveN or the fore-end light on the rifle (player.ts poseGunLight)
        if (railLight.enabled) { const lp = rifleHand ? sc20kLightPose(c) : rigLightPose(c); railLight.pos = lp.pos; railLight.dir = lp.dir; }
        const thrown = c.anim.inThrow && c.anim.throwTime >= THROW_RELEASE;   // the can has left the hand: draw it empty for the rest of the throw
        const knife = st.hold.knife || (st.hold.on && st.hold.who === 0 && HOLD_VARIANTS[st.hold.variant] === 'arm' && !!c.anim.holdPose);   // as combat.ts handProps: the knife is out for the life of an arm hold
        const ih = INHAND.on && c.alive;   // (IN HAND, as combat.ts handProps says it of Sam: his pistol in the hand's own frame, and the hand moved onto a rifle's grip)
        c.inHand = !ih || handsBusy || c.anim.rawClip ? null : rifleHand ? (INHAND.long ? longHold('sc20k') : null) : st.slot === 1 ? IN_PISTOL : null;
        if (st.showProps) rigBoxes(c, { goggles: st.goggles, nv: st.nv, slot: handsBusy || rifleHand ? 0 : st.slot, lightOn: st.lightOn, isGuard: false, ...(ih ? { inHand: true } : null), holster: handsBusy || rifleHand || c.alive || st.slot !== 1, held: handsBusy || thrown || rifleHand ? null : st.slot === 2 ? 'smoke' : st.slot === 3 ? 'flash' : null, knife, rifle: rifleHand ? 'hand' : st.rifle ? 'slung' : null, rifleLight: rifleHand && st.lightOn }, dyn, RIG, meta);   // (as game.ts: can up → gun on the thigh + can in the fist; picking → empty hands, gun on the thigh; slot 0 = holstered, hands free; the rifle in the hands → the pistol on the thigh whatever the slot, or slung on his back)
      }
      if (st.emitterGizmos && !st.guard && (st.slot === 1 || this.samRifle()) && !handsBusy && st.showProps) {   // shot emitter anchors ride the muzzle frame; a tiny bright cube marks each so it can be picked like a rig part
        const MF = fxm.muzzleFrame(c.muzzle, c.gunDir); const SH = fxm.shot;
        meta.push({ path: 'emitters', label: 'shot emitters (muzzle frame)', depth: 0, parent: MF, frame: MF, boxStart: dyn.length, boxCount: 0, getAdj: () => this.emitterRootAdj });
        for (const [key, label, col] of [['jetOff', 'bore jet', [1, 0.55, 0.2]], ['portOff', 'side ports (base)', [0.3, 0.7, 1]], ['wispOff', 'muzzle wisp', [0.7, 0.7, 0.7]]] as [keyof typeof SH, string, Vec3][]) {
          const off = SH[key] as Vec3; const o = v3.mad(v3.mad(v3.mad(MF.o, MF.x, off[0]), MF.y, off[1]), MF.z, off[2]);
          meta.push({ path: 'emitters.' + key, label, depth: 1, parent: MF, frame: { ...MF, o }, boxStart: dyn.length, boxCount: 1, getAdj: () => this.emitterAdj(key as string, off) });
          dyn.push(makeBox({ c: o, h: [0.006, 0.006, 0.006], yaw: 0, albedo: col, emissive: v3.scale(col, 3), flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));
        }
      }
      if (this.gizmoLive) gizmo.update(meta, dyn);
      if (st.hold.on && st.hold.marker) {   // the invisible partner: a stick at his root (HOLD.dist ahead of the holder / behind the held man on the body's facing) and a cube for his skull
        const fw = c.forward(); const sgn = st.hold.who === 0 ? 1 : -1; const root = v3.mad(c.pos, fw, sgn * HOLD.dist);
        const grey: Vec3 = [0.35, 0.36, 0.38];
        dyn.push(makeBox({ c: v3.add(root, [0, 0.72, 0]), h: [0.012, 0.72, 0.012], yaw: c.bodyYaw, albedo: grey, flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));
        dyn.push(makeBox({ c: v3.add(root, [0, 1.61, -0.005]), h: [0.075, 0.095, 0.09], yaw: c.bodyYaw, albedo: grey, flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));   // (skull centre ≈ 1.61 up, 15 wide × 19 tall × 18 deep — where the standing man's head measures in the held pose)
        dyn.push(makeBox({ c: v3.add(root, [0, 1.43, 0]), h: [0.05, 0.06, 0.05], yaw: c.bodyYaw, albedo: grey, flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));         // (neck)
        dyn.push(makeBox({ c: v3.add(root, [0, 1.25, -0.02]), h: [0.17, 0.12, 0.09], yaw: c.bodyYaw, albedo: grey, flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));     // (upper chest / shoulders)
      }
      if (st.door.show) this.doorBoxes(c, cdt, dyn);
      if (st.marks) for (const m of this.marks) dyn.push(m);
      { const cs = st.cans; if (cs.loop) { cs.t -= dt; if (cs.t <= 0) { cs.t = cs.loopEvery; (Math.floor(performance.now() / 1000 / cs.loopEvery) % 2 === 0 ? this.smokeCan() : this.stunCan()); } } }
      this.tracers.update(dt, dyn, 2 * cam.distance * Math.tan(cam.fov / 2) / Math.max(200, canvas.height * (engine.effectiveScale || 1)));   // tracer streaks in flight (game.ts: before the sparks, so an ember shows the frame it lands; widened to ~a pixel by the game's mPerPx rule)
      this.sparks.update(dt, this.col); this.sparks.boxes(dyn); this.stageItems.update(dt); this.stageItems.boxes(dyn);   // (fast sparks glance off the back wall / the cube like they do off the office's walls; slow ones only see the floor)
      for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; dyn.push(f.box); f.ttl -= dt; if (f.ttl <= 0) this.fx.splice(i, 1); }
      engine.world.dynamics = dyn;
      // ---- skin instance + capsule shadow proxies (Game.update's per-character block)
      const mats = engine.settings.charMats;   // CHARACTER MATERIALS (render/charMaterials.ts): the staged figure in his side's table — the side of the outfit he wears (the guard scenes' default the defenders', the rest the operators')
      const side = this.wornSide;   // (the outfit's own side: a defender's or a civilian's clothes tried on in Sam's scene shade from THEIR table)
      if (mats) writeCharPalette(this.matPal, 0, side, c.tint, c.tint2, c.id, !charSlots(this.ch).authored);
      const po = c.parts ? placeholderTints(side) : TINTS_AS_IS;   // (game.ts: the placeholder's two colours, by the side's table)
      this.chars.setInstance(0, c.skel.jointData, po & 1 ? c.tint2 : c.tint, po & 2 ? c.tint2 : c.tint, c.id, undefined, c.parts); this.chars.setMaterials(0, mats ? (f, o) => f.set(this.matPal, o) : undefined); this.chars.finish(1);
      engine.world.resetCapsules(); { const { caps, bound } = c.capsules(); engine.world.addCharacterCapsules(c.id, mats ? proxyAlbedos(charSlots(this.ch), this.matPal, 0, 1, (engine.settings.rtMeshHits && engine.meshShadowsOn) || engine.settings.sdfRigSmooth, (c as typeof c & { parts?: number }).parts ?? 0) : v3.lerp(c.tint, [0.5, 0.5, 0.5], 0.3), caps, bound); }

      // ---- the camera's tracked focus + the studio round it
      if (st.track === 1) this.focus = v3.add(c.pos, [0, 1, 0]);
      else if (st.track === 2 && c.bones.head) this.focus = v3.add(c.bones.head, [0, 0.07, 0]);
      else if (st.track === 3 && c.bones.handR) this.focus = v3.mad(c.bones.handR, c.gunDir, 0.12);
      else if (st.track === 4 && c.bones.chest) this.focus = v3.copy(c.bones.chest);
      else if (st.track === 5 && c.bones[st.trackBone]) this.focus = v3.copy(c.bones[st.trackBone]);
      { const minP = Math.asin(clamp((0.06 - this.focus[1]) / Math.max(cam.distance, 0.1), -0.99, 0.99)); if (cam.pitch < minP) cam.pitch = minP; }   // never orbit into the floor slab
      this.wallBox.cutHeight = st.wall && cam.pos[2] > stage.wallZ + 0.15 ? 100 : 0.12;   // cut the back wall down to a lip when the orbit goes behind it (or when switched off)
      S.nvAmount = st.nvScreen && st.nv ? Math.min(1, S.nvAmount + dt * 5) : Math.max(0, S.nvAmount - dt * 9);
      this.smoke.update(dt);
    }
  }
  /** the standalone page's back half of a frame: the orbit camera onto its focus, the lights, the render, the gizmo's overlay */
  present(dt: number) {
    const { cam, engine, gizmo } = this; const time = this.time;
    cam.update(dt, this.focus, null);
    engine.lights.update(dt, time);
    window.__vtime = time; engine.render(cam, time, dt, true);
    gizmo.draw();
  }
  /** the lights this runtime OWNS in the shared LightSet (the studio's key / fill / rim + the two hand lights): a host that rebuilds the set (the editor's scene) puts them back */
  ownLights(studio: boolean): RtLight[] { return studio ? [...this.stageLights, this.railLight, this.torchLight] : [this.railLight, this.torchLight]; }
  /** the door marker: two jamb posts on the closed line `dist` ahead and a 0.9 m leaf hinged on `hinge` side, flung open by a kick's impact (eases to a stop by ~100°) */
  private doorBoxes(c: Character, cdt: number, dyn: Box[]) {
    const D = this.st.door; const W = D.width, T = 0.04, Hh = 1.02;
    this.doorAng = Math.min(100 * DEG, this.doorAng + this.doorVel * cdt); this.doorVel *= Math.exp(-3 * cdt); if (this.doorAng >= 100 * DEG) this.doorVel = 0;
    const f = c.forward(); const rgt: Vec3 = [-Math.cos(c.bodyYaw), 0, Math.sin(c.bodyYaw)];   // (his right on the floor: model −X)
    const base: Vec3 = c.alive ? c.pos : this.home;                                             // (a body's pos rides its pelvis: keep the doorway where it stood)
    const hinge: Vec3 = [base[0] + f[0] * D.dist + rgt[0] * D.hinge * W / 2, 0, base[2] + f[2] * D.dist + rgt[2] * D.hinge * W / 2];
    const u0: Vec3 = [-rgt[0] * D.hinge, 0, -rgt[2] * D.hinge];                                   // closed: from the hinge across his front to the other jamb
    const u: Vec3 = v3.normalize(v3.mad(v3.scale(u0, Math.cos(this.doorAng)), f, Math.sin(this.doorAng)));   // opening away from him
    const wood: Vec3 = [0.36, 0.24, 0.14], frame: Vec3 = [0.2, 0.2, 0.21];
    dyn.push(makeBox({ c: [hinge[0] + u[0] * W / 2, Hh, hinge[2] + u[2] * W / 2], h: [T / 2, Hh, W / 2], yaw: Math.atan2(u[0], u[2]), albedo: wood, flags: BoxFlag.Dynamic }));
    for (const k of [-0.04, W + 0.04]) dyn.push(makeBox({ c: [hinge[0] + u0[0] * k, 1.06, hinge[2] + u0[2] * k], h: [0.035, 1.06, 0.035], yaw: Math.atan2(u0[0], u0[2]), albedo: frame, flags: BoxFlag.Dynamic }));
    dyn.push(makeBox({ c: [hinge[0] + u0[0] * W / 2, 2.15, hinge[2] + u0[2] * W / 2], h: [0.035, 0.03, W / 2 + 0.075], yaw: Math.atan2(u0[0], u0[2]), albedo: frame, flags: BoxFlag.Dynamic }));   // header
    if (this.st.lockpick) dyn.push(makeBox({ c: [hinge[0] + u0[0] * (W - 0.08) - f[0] * 0.03, 1.0, hinge[2] + u0[2] * (W - 0.08) - f[2] * 0.03], h: [0.012, 0.012, 0.05], yaw: Math.atan2(u0[0], u0[2]), albedo: [0.5, 0.5, 0.48], flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));   // a lever handle by the free edge at 1.0 m (doors.ts), the keyway just under it
  }

  /** the HUD's three lines (main.ts paints them every 10 frames) */
  hudLines(): string[] {
    const { st, engine, cam, char, quality } = this; const S = engine.settings; const t = engine.timer; const lines: string[] = [];
    lines.push(`character / prop viewer · ${this.gpu.adapterInfo} | ${engine.width}x${engine.height} (${quality.current}${quality.adaptive ? ', adaptive' : ''} ×${S.renderScale.toFixed(2)}) | ${this.fpsSm.toFixed(0)} fps | gpu ~${t.total(['composite', 'post', 'fxaa', 'gbuffer']).toFixed(2)} ms`);
    const r = char.anim.rawClip;
    const animLine = r ? `raw clip ${r.clip.name} (${r.clip.duration.toFixed(2)} s) t=${(((r.time % r.clip.duration) + r.clip.duration) % r.clip.duration).toFixed(2)}` : `graph: ${st.speed.toFixed(2)} m/s${st.crouch ? ' crouched' : ''}${st.reverse ? ' backpedal' : ''}${st.path ? ` (${['', 'circle', 'back & forth', 'turn on spot'][st.path]})` : ''}${st.deliberate > 0 ? ` · deliberate ${st.deliberate.toFixed(2)}` : ''} · upper ${char.anim.upper} · phase ${char.anim.phase.toFixed(2)}`;
    lines.push(`${animLine} · stance ${STANCES[st.stance]}${st.lockpick ? ' · lockpick' : ''}${st.hold.on ? ` · ${st.hold.who ? 'held' : 'hold'} ${HOLD_VARIANTS[st.hold.variant]} ${HOLD_PHASES[st.hold.phase]}` : ''}${this.kickFlashT > 0 ? ' · ▮▮ KICK IMPACT ▮▮' : ''}${this.relFlashT > 0 ? ' · ▮▮ THROW RELEASE ▮▮' : char.anim.inThrow ? ` · throw ${char.anim.throwTime.toFixed(2)}s ${char.anim.throwRead}` : ''} · aim pitch ${st.aimPitchDeg}° · body yaw ${Math.round(wrapAngle(char.bodyYaw) / DEG)}°${st.allOff ? ' · ALL TWEAKS OFF' : ''}${st.paused ? ' · PAUSED' : ''}`);
    lines.push(`kit: ${st.guard ? `guard, ${st.carbine ? `carbine (${char.anim.longShown ?? '—'})` : st.guardTorch ? 'torch' : 'pistol drawn'}` : `player, ${st.rifle === 2 ? `${gearText('FN2000')} in the hands (${char.anim.longShown ?? '—'})` : (['holstered', 'slot 1', 'slot 2 (can)'][st.slot] ?? `slot ${st.slot}`) + (st.rifle === 1 ? ` + ${gearText('FN2000')} slung` : '')}, goggles ${st.goggles ? (st.nv ? 'down (NV on)' : 'up') : 'off'}`} · light ${st.lightOn ? 'on' : 'off'} · props ${this.dyn.length} boxes · lights ${engine.lights.activeCount} · cam yaw ${Math.round(wrapAngle(cam.yaw) / DEG)}° pitch ${Math.round(cam.pitch / DEG)}° dist ${cam.distance.toFixed(2)} m · view ${S.debugView} · exp ${S.exposure.toFixed(2)}`);
    return lines;
  }
}
