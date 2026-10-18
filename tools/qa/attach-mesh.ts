// ATTACHMENTS AGAINST THE MESH: every thing a man holds, wears or carries (rigProps' boxes, the belt torch, the shield, a hostage's tie), measured against the skinned
// mesh of the cast variant that carries it, in the poses the animator really makes. What tools/qa/pose-mesh.ts shows one sheet at a time, as numbers over the whole cast.
//
//   TPS_PROFILE=shipped bun run tools/qa/attach-mesh.ts [--variant <name,…>] [--loadout <name,…>] [--sit <name,…>] [--json <file>] [--md <file>] [--ply <dir>] [--inhand] [--list]
//       (shipped: the cast, the issue kit and the hands as the page has them; without it the frozen stand's)
//       --inhand: with IN HAND on (src/game/inhand.ts, as the page has it): the look-only pass has put his hands to what they hold, a pistol is drawn in the
//       hand and the worn things are where that rule hangs them. Without: the build with the rule off.
//       --ply: also write <dir>/<variant>__<loadout>__<sit>.ply + .json for every case run, in pose-mesh.ts's format (tools/qa/pose-mesh-render.py draws them)
//
// One man of a variant is stood up bare (as pose-mesh.ts does), put into a situation by the real animator, the parts he wears are skinned on the CPU, and the boxes the
// game would draw on him are built by the game's own builders. Per GROUP of boxes (a gun in the hand, the holster, the goggles, a rifle across the back …):
//   gap    the smallest distance from the part of the group that should touch him (a grip, or the whole group) to the vertices of the body part it sits on, cm —
//          vertices are picked by their dominant skin joint (hand + fingers, the right thigh, the head, the trunk …). A thing that floats has a large gap.
//   sink   how deep vertices of THAT body part stand inside the group's boxes, cm (the deepest one), and how many do. A hand round a grip is in it by a finger's
//          thickness; a goggle housing through a brow is buried.
//   other  the same for every OTHER vertex he wears (a gun through his chest, a slung rifle through the pack on his back), with the joint the deepest one hangs on.
//   grip   for a held thing: the grip part's centre in the hand's own frame (along the fingers / out of the palm / toward the thumb, cm, off the wrist) and the
//          angle between the thing's long axis and the fingers (°). The fist's hollow is about 9 along the fingers and 3 out of the palm.
//          and the palm's and the four fingers' own gaps to the grip (a grip held in the fingertips, off the palm, shows here).
//   under  how much of the group lies UNDER his surface: 27 points of each box against the nearest worn vertex and its normal — the deepest, cm, and the share of the
//          points. (A box's own thickness caps `sink`: a rifle wholly inside a pack reads 2 cm there and 60% here.)
//   left   for a thing two hands hold: the support hand's gap to the part it takes (the foregrip post, the handguard, the pistol's grip), cm.
// Measured unscaled against unscaled: stature.ts draws the man and his boxes scaled together.
// Sampled at every worn vertex, edge midpoint and triangle centroid: good to under a centimetre on this mesh.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(process.env.REPO ?? new URL('../..', import.meta.url).pathname);
type V3 = [number, number, number];
const args = process.argv.slice(2);
const flag = (n: string): string | null => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1] ?? ''; };
const has = (n: string) => args.includes(n);
const pick = (n: string): string[] | null => { const f = flag(n); return f ? f.split(',') : null; };

const H = await import(`${ROOT}/tools/qa/headless.ts`);
const CH: any = await import(`${ROOT}/src/game/character.ts`);
const WS: any = await import(`${ROOT}/src/game/wallsnap.ts`);
const CM: any = await import(`${ROOT}/src/render/charMaterials.ts`);
const RP: any = await import(`${ROOT}/src/game/rigProps.ts`);
const GL: any = await import(`${ROOT}/src/anim/gltf.ts`);
const HW: any = await import(`${ROOT}/src/game/handwork.ts`);
const IH: any = await import(`${ROOT}/src/game/inhand.ts`).catch(() => null);   // (a tree from before the rule has no such module)
if (IH) IH.INHAND.on = has('--inhand');
const SH: any = await import(`${ROOT}/src/game/shield.ts`);
const GE: any = await import(`${ROOT}/src/game/gear.ts`);
const { skinVertices } = await import(`${ROOT}/src/render/meshbvh.ts`);
const { sideOfTeam } = await import(`${ROOT}/src/game/charLook.ts`);
const DT = 1 / 60;
if (CH.MOVES) CH.MOVES.on = 1; if (CH.TURN) CH.TURN.on = 1; WS.WALLSNAP.on = true;   // (pose-mesh.ts's own: the motion pass as the page has it)

const SIDES: Record<string, { team: string; trained: boolean; drill: number; tint: V3; tint2: V3; id0: number; rifle: 'sc20k' | 'carbine' | null }> = {
  operator: { team: 'operative', trained: false, drill: 1, tint: [0.07, 0.09, 0.1], tint2: [0.05, 0.07, 0.06], id0: 20, rifle: 'sc20k' },
  defender: { team: 'hostile', trained: false, drill: 0.12, tint: [0.36, 0.33, 0.24], tint2: [0.09, 0.08, 0.05], id0: 24, rifle: 'carbine' },
  responder: { team: 'guard', trained: true, drill: 0.75, tint: [0.42, 0.36, 0.25], tint2: [0.02, 0.02, 0.025], id0: 20, rifle: 'carbine' },
  civilian: { team: 'civilian', trained: false, drill: 0.5, tint: [0.75, 0.62, 0.08], tint2: [0.05, 0.06, 0.1], id0: 40, rifle: null },
};
type Held = 'rifle' | 'pistol' | 'torch' | 'can' | null;
interface Ctx { c: any; side: string; sam: boolean; run(secs: number): void; arm(kind: Held, rifle?: 'sc20k' | 'carbine'): void; walk(speed: number): void; }
const FN = { dur: 2.4, out: 0.5, in_: 1.5, rack: 2.0 };
const carry = (x: Ctx) => { const a = x.c.anim; if (x.side === 'operator') { a.upper = 'none'; a.stance = 'lowReady'; } else a.upper = 'relaxed'; };
/** the situations: each drives the animator the way the game's controllers do (pose-mesh.ts's, plus the crouched ones a quiet mission is played in). The loadout arms him first. */
const SITS: Record<string, { say: string; go(x: Ctx): void }> = {
  'idle': { say: 'standing', go: x => { x.run(2); } },
  'walk': { say: 'walking at 1.4 m/s, mid-stride', go: x => { x.walk(1.4); x.run(2.3); } },
  'run': { say: 'running at 3.4 m/s', go: x => { x.walk(3.4); x.run(2.15); } },
  'crouch': { say: 'crouched, still', go: x => { x.c.anim.crouchTarget = 1; x.run(2); } },
  'crouch-walk': { say: 'crouched, moving at 0.9 m/s', go: x => { x.c.anim.crouchTarget = 1; x.walk(0.9); x.run(2.3); } },
  'carry': { say: 'the gun carried: an operator at the low ready, anybody else relaxed', go: x => { carry(x); x.run(2); } },
  'carry-walk': { say: 'the gun carried at a walk (1.3 m/s)', go: x => { carry(x); x.walk(1.3); x.run(2.3); } },
  'carry-crouch': { say: 'the gun carried, crouched', go: x => { carry(x); x.c.anim.crouchTarget = 1; x.run(2); } },
  'carry-crouch-walk': { say: 'the gun carried, crouched, moving at 1.2 m/s', go: x => { carry(x); x.c.anim.crouchTarget = 1; x.walk(1.2); x.run(2.3); } },
  'aim': { say: 'the gun up, on a man', go: x => { x.c.anim.upper = 'aim'; x.run(2); } },
  'aim-walk': { say: 'the gun up at a walk (1.3 m/s)', go: x => { x.c.anim.upper = 'aim'; x.walk(1.3); x.run(2.3); } },
  'aim-crouch': { say: 'the gun up, crouched', go: x => { x.c.anim.upper = 'aim'; x.c.anim.crouchTarget = 1; x.run(2); } },
  'aim-crouch-walk': { say: 'the gun up, crouched, moving at 1.2 m/s', go: x => { x.c.anim.upper = 'aim'; x.c.anim.crouchTarget = 1; x.walk(1.2); x.run(2.3); } },
  'aim-fire': { say: 'the gun up, 0.05 s after a round', go: x => { x.c.anim.upper = 'aim'; x.run(2); x.c.anim.fire(); x.run(0.05); } },
  'torch-up': { say: 'the torch raised (upper torch)', go: x => { x.c.anim.upper = 'torch'; x.run(2); } },
  'reload': { say: 'the long gun\'s magazine change, the fresh one on its way to the well', go: x => { const a = x.c.anim; a.reloadBack = true; a.upper = 'none'; a.stance = 'lowReady'; x.run(1.5); a.reload(2.4, FN); x.run((FN.out + FN.in_) / 2 + 0.06); } },
  'bound': { say: 'a hostage: kneeling, wrists behind the back', go: x => { const a = x.c.anim; a.crouchTarget = 1; x.run(1); a.bound = 1; x.run(1.2); } },
  'hammer-ready': { say: 'the hammer out of his back and in both hands, no blow asked yet', go: x => { carry(x); x.run(1); big(x, 'hammer', [], 1.3); } },
  'hammer-wound': { say: 'the hammer wound up, a quarter second before it lands', go: x => { carry(x); x.run(1); big(x, 'hammer', [1.6], 1.35); } },
  'shotgun-up': { say: 'the breaching shotgun in the shoulder, on the lock', go: x => { carry(x); x.run(1); big(x, 'shotgun', [], 1.3); } },
};
/** the big slot's beat as bigkit.ts hands it to the animator (a function of the record: `t` is the game's clock, stepped here) */
function big(x: Ctx, kind: 'hammer' | 'shotgun', blows: number[], until: number) {
  const a = x.c.anim; const B = { kind, t: 0, equip: 0.7, windup: 0.5, stow: 0.6, blows, end: -1, at: [0, 1.0, 0.8] as V3 };
  for (let t = 0; t < until; t += DT) { B.t = t; a.bigTool = B; x.run(DT); }
}

// ---- the loadouts: what combat.ts handProps / guardKit draws on each kind of man
interface Grp { label: string; on: Part; start: number; count: number; grip?: number; left?: number; hand?: 'R' | 'L' }
type Part = 'handR' | 'handL' | 'hands' | 'thighR' | 'head' | 'chest' | 'trunk' | 'hip' | 'armL';
interface Built { boxes: any[]; groups: Grp[] }
interface Loadout { name: string; say: string; who(v: any): boolean; arm: Held; rifle?: 'sc20k' | 'carbine'; sits: string[]; mask?: 'boxes' | 'suit'; pre?(x: Ctx): void; build(x: Ctx, sit: string): Built }
const isOp = (v: any) => v.side === 'operator', isSam = (v: any) => v.name === 'operator_1', isMate = (v: any) => isOp(v) && !isSam(v), isGuard = (v: any) => v.side === 'defender' || v.side === 'responder';
/** rigBoxes' own groups (its meta sink's depth-1 nodes) → what each should sit on, and which of its parts the hands take */
const RIGMAP: Record<string, { on: Part; grip?: string; left?: string }> = {
  'pistol': { on: 'handR', grip: 'pistol.grip', left: 'pistol.grip' }, 'guardPistol': { on: 'handR', grip: 'guardPistol.grip', left: 'guardPistol.grip' },
  'torch': { on: 'hands', grip: 'torch.body' }, 'can': { on: 'handR', grip: 'can.body' }, 'knife': { on: 'handR', grip: 'knife.handle' },
  'holster': { on: 'thighR' }, 'goggles.on': { on: 'head' }, 'goggles.off': { on: 'head' }, 'sheath': { on: 'chest' },
  'sc20k': { on: 'handR', grip: 'sc20k.grip', left: 'sc20k.foregrip' }, 'sc20k.slung': { on: 'trunk' }, 'carbine': { on: 'handR', grip: 'carbine.grip', left: 'carbine.handguard' },
  'big.hammer': { on: 'trunk' },
};
function viaMeta(out: any[], n0: number, meta: any[], rename: (path: string) => string = p => p, twoHands = true): Grp[] {
  const gs: Grp[] = []; const covered = new Set<number>();
  for (const m of meta) if (m.depth === 1 && RIGMAP[m.path] && m.boxCount > 0) {
    const R = RIGMAP[m.path]; const sub = (p?: string) => { const s = p ? meta.find(k => k.path === p && k.boxCount === 1) : null; return s ? s.boxStart : undefined; };
    gs.push({ label: rename(m.path), on: R.on, start: m.boxStart, count: m.boxCount, grip: sub(R.grip), left: twoHands ? sub(R.left) : undefined, hand: R.on === 'handR' || R.on === 'hands' ? 'R' : undefined });
    for (let i = m.boxStart; i < m.boxStart + m.boxCount; i++) covered.add(i);
  }
  let s = -1; for (let i = n0; i <= out.length; i++) { const free = i < out.length && !covered.has(i); if (free && s < 0) s = i; if (!free && s >= 0) { gs.push({ label: 'unnamed', on: 'handL', start: s, count: i - s }); s = -1; } }
  return gs;
}
/** …with the drawer's word for what is in his right hand said first, as combat.ts handProps says it every frame, while the stand has IN HAND on (src/game/inhand.ts:
 *  the figure's look-only pass then puts that hand to the thing — re-baked here, dt 0) */
function rig(x: Ctx, o: any, rename?: (p: string) => string, twoHands = true): Built { const boxes: any[] = [], meta: any[] = [];
  if (o.isGuard && o.torch) o = { ...o, beamDir: [Math.sin(x.c.bodyYaw), 0, Math.cos(x.c.bodyYaw)] };   // (a patrol's beam: level, ahead of him — the game hands the drawer the guard's own)
  if (IH?.INHAND.on) { const w = o.isGuard ? (o.torch ? RP.torchHold(o.beamDir) : o.weapon === 'carbine' ? RP.longHold('carbine') : IH.IN_PISTOL) : o.slot === 1 ? IH.IN_PISTOL : o.rifle === 'hand' && !o.fit ? RP.longHold('sc20k') : null;
    x.c.inHand = w; x.c.update(0); if (w?.kind === 'pistol') o = { ...o, inHand: true }; if (o.isGuard && x.side === 'defender') o = { ...o, holsterOut: IH.INHAND.holsterOut }; }
  RP.rigBoxes(x.c, o, boxes, RP.RIG, meta); return { boxes, groups: viaMeta(boxes, 0, meta, rename, twoHands) }; }
function add(b: Built, label: string, on: Part, fn: (out: any[]) => void, extra: Partial<Grp> = {}): Built { const s = b.boxes.length; fn(b.boxes); if (b.boxes.length > s) b.groups.push({ label, on, start: s, count: b.boxes.length - s, ...extra }); return b; }
const aiming = (sit: string) => sit.startsWith('aim');
const samKit = (x: Ctx) => (x.sam ? { fit: true } : null);   // (Sam's held things are drawn in the hand — kitanim.ts KITANIM.grips; a teammate's hands are put to his by inhand.ts, in rig() below)
const OPS_PISTOL = ['carry', 'carry-walk', 'carry-crouch', 'carry-crouch-walk', 'aim', 'aim-walk', 'aim-crouch', 'aim-crouch-walk', 'aim-fire'];
const OPS_RIFLE = ['carry', 'carry-walk', 'carry-crouch', 'carry-crouch-walk', 'aim', 'aim-walk', 'aim-crouch', 'aim-crouch-walk', 'aim-fire'];
const EMPTY = ['idle', 'walk', 'run', 'crouch', 'crouch-walk'];
const LOADOUTS: Loadout[] = [
  { name: 'op-pistol', say: 'an operator with the suppressed pistol in his hand, goggles up (a teammate whose card hands him the pistol; Sam with no rifle)', who: isOp, arm: 'pistol', sits: OPS_PISTOL, mask: 'boxes',
    build: (x, sit) => rig(x, { goggles: true, nv: false, slot: 1, lightOn: false, isGuard: false, ...samKit(x) }, undefined, aiming(sit)) },
  { name: 'op-pistol-nv', say: '… goggles down', who: isOp, arm: 'pistol', sits: ['aim', 'aim-crouch'], mask: 'boxes',
    build: (x, sit) => rig(x, { goggles: true, nv: true, slot: 1, lightOn: false, isGuard: false, ...samKit(x) }, undefined, aiming(sit)) },
  { name: 'op-pistol-suit', say: '… in the sneaking suit (no helmet, no back kit), goggles up', who: isOp, arm: 'pistol', sits: ['aim', 'aim-crouch', 'carry-crouch'], mask: 'suit',
    build: (x, sit) => rig(x, { goggles: true, nv: false, slot: 1, lightOn: false, isGuard: false, ...samKit(x) }, undefined, aiming(sit)) },
  { name: 'op-pistol-suit-nv', say: '… in the sneaking suit, goggles down', who: isOp, arm: 'pistol', sits: ['aim', 'aim-crouch'], mask: 'suit',
    build: (x, sit) => rig(x, { goggles: true, nv: true, slot: 1, lightOn: false, isGuard: false, ...samKit(x) }, undefined, aiming(sit)) },
  { name: 'op-rifle', say: 'an operator with the rifle in both hands, the sidearm on his thigh, goggles up', who: isOp, arm: 'rifle', sits: OPS_RIFLE, mask: 'boxes',
    build: x => rig(x, { goggles: true, nv: false, slot: 0, lightOn: false, isGuard: false, holster: true, rifle: 'hand', ...samKit(x) }) },
  { name: 'op-rifle-suit', say: '… in the sneaking suit', who: isOp, arm: 'rifle', sits: ['carry-crouch', 'aim-crouch'], mask: 'suit',
    build: x => rig(x, { goggles: true, nv: false, slot: 0, lightOn: false, isGuard: false, holster: true, rifle: 'hand', rifleBlack: true, ...samKit(x) }) },
  { name: 'sam-pistol-slung', say: 'Sam: the pistol in his hand, the rifle across his back', who: isSam, arm: 'pistol', sits: ['carry', 'aim', 'aim-crouch', 'carry-crouch-walk'], mask: 'boxes',
    build: (x, sit) => rig(x, { goggles: true, nv: false, slot: 1, lightOn: false, isGuard: false, rifle: 'slung', fit: true }, p => (p === 'sc20k.slung' ? 'rifle on the back' : p), aiming(sit)) },
  { name: 'sam-empty-slung', say: 'Sam: hands empty, the pistol on his thigh, the rifle across his back', who: isSam, arm: null, sits: EMPTY, mask: 'boxes',
    build: x => rig(x, { goggles: true, nv: false, slot: 0, lightOn: false, isGuard: false, holster: true, rifle: 'slung' }, p => (p === 'sc20k.slung' ? 'rifle on the back' : p)) },
  { name: 'sam-empty-slung-suit', say: '… in the sneaking suit', who: isSam, arm: null, sits: ['idle', 'crouch', 'crouch-walk'], mask: 'suit',
    build: x => rig(x, { goggles: true, nv: false, slot: 0, lightOn: false, isGuard: false, holster: true, rifle: 'slung', rifleBlack: true }, p => (p === 'sc20k.slung' ? 'rifle on the back' : p)) },
  { name: 'sam-sling-front', say: 'Sam on a loud mission: the rifle let down on its sling in front', who: isSam, arm: null, sits: ['idle', 'walk', 'crouch', 'crouch-walk'], mask: 'boxes',
    build: x => rig(x, { goggles: true, nv: false, slot: 0, lightOn: false, isGuard: false, holster: true, rifle: 'slung', slingFront: true }, p => (p === 'sc20k.slung' ? 'rifle slung in front' : p)) },
  { name: 'sam-can', say: 'Sam: a canister in the right fist', who: isSam, arm: 'can', sits: ['idle', 'walk', 'crouch'], mask: 'boxes',
    build: x => rig(x, { goggles: true, nv: false, slot: 0, lightOn: false, isGuard: false, holster: true, held: 'smoke', rifle: 'slung', fit: true }, p => (p === 'sc20k.slung' ? 'rifle on the back' : p)) },
  { name: 'sam-sheath', say: 'Sam: the knife in its sheath on his chest', who: isSam, arm: null, sits: ['idle', 'walk', 'crouch'], mask: 'boxes',
    build: x => rig(x, { goggles: false, nv: false, slot: 0, lightOn: false, isGuard: false, sheath: true }) },
  { name: 'sam-reload', say: 'Sam: the rifle\'s magazine change, the fresh magazine in the support hand', who: isSam, arm: 'rifle', sits: ['reload'], mask: 'boxes',
    build: x => { const b = rig(x, { goggles: false, nv: false, slot: 0, lightOn: false, isGuard: false, rifle: 'hand', fit: true, kit: { magL: 'rifle', noMag: true } }, undefined, false); for (const g of b.groups) if (g.label === 'unnamed') { g.label = 'magazine in the left hand'; g.on = 'handL'; g.grip = g.start; g.hand = 'L'; } return b; } },
  { name: 'big-back', say: 'the hammer / the breaching shotgun on a man\'s back (a teammate: his rifle in his hands; Sam: over his slung rifle)', who: isOp, arm: 'rifle', sits: ['carry', 'carry-walk', 'carry-crouch', 'aim-crouch'], mask: 'boxes',
    build: x => { const b: Built = { boxes: [], groups: [] }; add(b, 'hammer on the back', 'trunk', o => RP.bigBoxes(x.c, 'hammer', 0, o)); add(b, 'shotgun on the back', 'trunk', o => RP.bigBoxes(x.c, 'shotgun', 0, o)); return b; } },
  { name: 'sam-big-over-rifle', say: 'Sam: the hammer / shotgun on his back OVER the slung rifle (it rides clear of it)', who: isSam, arm: null, sits: ['idle', 'walk', 'crouch'], mask: 'boxes',
    build: x => { const b: Built = { boxes: [], groups: [] }; add(b, 'hammer over the rifle', 'trunk', o => RP.bigBoxes(x.c, 'hammer', 0, o, RP.RIG, true)); add(b, 'shotgun over the rifle', 'trunk', o => RP.bigBoxes(x.c, 'shotgun', 0, o, RP.RIG, true)); return b; } },
  { name: 'big-hammer-hands', say: 'the hammer in both hands (his own rifle hung down his front)', who: isOp, arm: 'rifle', sits: ['hammer-ready', 'hammer-wound'], mask: 'boxes',
    build: x => { const b: Built = { boxes: [], groups: [] }; const k = x.c.anim.bigK ?? 0; add(b, `hammer in the hands (k ${k.toFixed(2)})`, 'hands', o => RP.bigBoxes(x.c, 'hammer', k, o), { hand: 'R' }); b.groups[b.groups.length - 1].grip = b.groups[b.groups.length - 1].start; b.groups[b.groups.length - 1].left = b.groups[b.groups.length - 1].start;
      add(b, 'own rifle hung in front', 'trunk', o => RP.hungBoxes(x.c, 'sc20k', o)); return b; } },
  { name: 'big-shotgun-hands', say: 'the breaching shotgun in the hands', who: isOp, arm: 'rifle', sits: ['shotgun-up'], mask: 'boxes',
    build: x => { const b: Built = { boxes: [], groups: [] }; const k = x.c.anim.bigK ?? 0; const meta: any[] = []; const s = b.boxes.length; RP.bigBoxes(x.c, 'shotgun', k, b.boxes, RP.RIG, false, meta);
      const sub = (p: string) => meta.find(m => m.path === p)?.boxStart; b.groups.push({ label: `shotgun in the hands (k ${k.toFixed(2)})`, on: 'handR', start: s, count: b.boxes.length - s, grip: sub('carbine.grip'), left: sub('carbine.handguard'), hand: 'R' });
      add(b, 'own rifle hung in front', 'trunk', o => RP.hungBoxes(x.c, 'sc20k', o)); return b; } },
  { name: 'mate-shield', say: 'a teammate with the shield on his left arm, the pistol in his right hand', who: isMate, arm: 'pistol', sits: ['carry', 'aim', 'aim-crouch', 'carry-walk'], mask: 'boxes', pre: x => { fakeGuard(x.c); },
    build: x => { const b = rig(x, { goggles: true, nv: false, slot: 1, lightOn: false, isGuard: false }, undefined, false); add(b, 'shield', 'armL', o => SH.shieldBoxes(fakeGuard(x.c), o)); return b; } },
  { name: 'gd-pistol', say: 'a guard with his 9 mm drawn, the torch on his belt', who: isGuard, arm: 'pistol', sits: ['carry', 'carry-walk', 'aim', 'aim-walk', 'aim-crouch', 'aim-fire'],
    build: (x, sit) => { const b = rig(x, { goggles: false, nv: false, slot: 1, lightOn: false, isGuard: true, torch: false, weapon: 'pistol' }, undefined, aiming(sit)); add(b, 'belt torch', 'hip', o => HW.beltTorch(x.c, o)); return b; } },
  { name: 'gd-torch', say: 'a guard on a calm patrol: the torch in his right fist, the sidearm on his thigh', who: isGuard, arm: 'torch', sits: ['idle', 'walk', 'torch-up'],
    build: x => rig(x, { goggles: false, nv: false, slot: 1, lightOn: false, isGuard: true, torch: true, weapon: 'pistol' }) },
  { name: 'gd-carbine', say: 'a rifleman: the carbine in both hands, the sidearm on his thigh', who: isGuard, arm: 'rifle', sits: ['carry', 'carry-walk', 'aim', 'aim-walk', 'aim-crouch', 'aim-fire'],
    build: x => rig(x, { goggles: false, nv: false, slot: 1, lightOn: false, isGuard: true, weapon: 'carbine' }) },
  { name: 'gd-empty', say: 'a guard with empty hands, the sidearm on his thigh', who: isGuard, arm: null, sits: EMPTY,
    build: x => { const b: Built = { boxes: [], groups: [] }; const meta: any[] = []; RP.holsterBoxes(x.c, b.boxes, { slide: RP.RIG.guardPistol.slide, grip: RP.RIG.guardPistol.grip }, meta, IH?.INHAND.on && x.side === 'defender' ? { ...RP.RIG.holster, out: RP.RIG.holster.out + IH.INHAND.holsterOut } : undefined); b.groups = viaMeta(b.boxes, 0, meta); return b; } },
  { name: 'mate-9mm', say: 'a teammate whose card hands him the 9 mm: the guards\' pistol, his own goggles', who: isMate, arm: 'pistol', sits: ['carry-crouch', 'aim', 'aim-crouch'], mask: 'boxes',
    build: (x, sit) => { const b = rig(x, { goggles: false, nv: false, slot: 1, lightOn: false, isGuard: true, torch: false, weapon: 'pistol' }, undefined, aiming(sit)); const meta: any[] = []; const s = b.boxes.length; RP.gogglesBoxes(x.c, false, b.boxes, RP.RIG.goggles, meta); b.groups.push(...viaMeta(b.boxes, s, meta).filter(g => g.label !== 'unnamed')); return b; } },
  { name: 'mate-carbine', say: 'a teammate whose card hands him the carbine', who: isMate, arm: 'rifle', rifle: 'carbine', sits: ['carry-crouch', 'aim', 'aim-crouch'], mask: 'boxes',
    build: x => rig(x, { goggles: false, nv: false, slot: 1, lightOn: false, isGuard: true, weapon: 'carbine' }) },
  { name: 'civ-bound', say: 'a hostage: the tie round her wrists', who: v => v.side === 'civilian', arm: null, sits: ['bound'],
    build: x => { const b: Built = { boxes: [], groups: [] }; add(b, 'wrist tie', 'hands', o => RP.wristTieBoxes(x.c, o)); return b; } },
];
const shieldMen = new Map<any, any>();
function fakeGuard(c: any) { let g = shieldMen.get(c); if (!g) { g = { char: c, state: 'patrol' }; SH.giveShield(g); shieldMen.set(c, g); } return g; }

// --rig holster.out=0.13,goggles.adj.off.2=0.01 : try RIG numbers without editing the table (the run's first line says so)
const tried: string[] = [];
for (const kv of pick('--rig') ?? []) { const [path, val] = kv.split('='); const ks = path.split('.'); let o: any = RP.RIG; for (const k of ks.slice(0, -1)) o = o?.[k];
  if (!o || !(ks[ks.length - 1] in o) || !Number.isFinite(Number(val))) { console.error(`attach-mesh: no RIG number at ${path}`); process.exit(2); }
  tried.push(`RIG.${path} ${o[ks[ks.length - 1]]} → ${val}`); o[ks[ks.length - 1]] = Number(val); }
const ch: any = await H.loadCastCharacter();
const cast = ch.cast, mesh = ch.mesh;
if (!cast || !mesh.part) { console.error('attach-mesh: no cast loaded'); process.exit(2); }
if (has('--list')) {
  console.log('variants:  ' + cast.variants.map((v: any) => v.name).join(' · '));
  console.log('loadouts:'); for (const L of LOADOUTS) console.log(`  ${L.name.padEnd(22)} ${L.say}  [${L.sits.join(' ')}]`);
  process.exit(0);
}

// ---- the mesh: every vertex's dominant joint → the body part it belongs to
const JN: string[] = ch.skin.joints.map((n: number) => ch.nodes[n].name as string);
const partOfJoint = (name: string): Part[] => {
  const p: Part[] = [];
  if (/^DEF-(hand|f_|thumb).*\.R$/.test(name)) p.push('handR', 'hands'); if (/^DEF-(hand|f_|thumb).*\.L$/.test(name)) p.push('handL', 'hands', 'armL');
  if (name === 'DEF-forearm.L') p.push('armL'); if (name === 'DEF-thigh.R') p.push('thighR', 'hip'); if (name === 'DEF-hips') p.push('hip', 'trunk');
  if (name === 'DEF-head') p.push('head'); if (/^DEF-spine\.00[23]$/.test(name)) p.push('chest'); if (/^DEF-(spine|shoulder)/.test(name)) p.push('trunk');
  return p;
};
const JPARTS = JN.map(partOfJoint);
const dom = new Uint8Array(mesh.vertexCount);
for (let v = 0; v < mesh.vertexCount; v++) { let b = 0; for (let k = 1; k < 4; k++) if (mesh.weights[v * 4 + k] > mesh.weights[v * 4 + b]) b = k; dom[v] = mesh.joints[v * 4 + b]; }
const I = mesh.indices as Uint32Array | Uint16Array, partOfVert = mesh.part as Uint8Array;

// ---- geometry: a point against an oriented box
const qOf = (b: any): number[] => b.rot ?? [0, Math.sin(b.yaw / 2), 0, Math.cos(b.yaw / 2)];
function toLocal(b: any, q: number[], px: number, py: number, pz: number): V3 {   // conj(q) · (p − c)
  const vx = px - b.c[0], vy = py - b.c[1], vz = pz - b.c[2], qx = -q[0], qy = -q[1], qz = -q[2], qw = q[3];
  const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
  return [vx + qw * tx + qy * tz - qz * ty, vy + qw * ty + qz * tx - qx * tz, vz + qw * tz + qx * ty - qy * tx];
}
/** > 0: metres outside the box; < 0: minus the depth inside it */
function sd(b: any, q: number[], px: number, py: number, pz: number): number {
  const l = toLocal(b, q, px, py, pz), dx = Math.abs(l[0]) - b.h[0], dy = Math.abs(l[1]) - b.h[1], dz = Math.abs(l[2]) - b.h[2];
  if (dx <= 0 && dy <= 0 && dz <= 0) return Math.max(dx, dy, dz);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
}
const rotV = (q: number[], v: V3): V3 => { const [qx, qy, qz, qw] = q; const tx = 2 * (qy * v[2] - qz * v[1]), ty = 2 * (qz * v[0] - qx * v[2]), tz = 2 * (qx * v[1] - qy * v[0]); return [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx]; };
const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

interface Row { under: number; underPct: number; underAt: string; variant: string; side: string; loadout: string; sit: string; group: string; on: Part; gap: number; sink: number; sinkN: number; other: number; otherN: number; otherAt: string;
  gripF?: number; gripP?: number; gripT?: number; ang?: number; left?: number; palm?: number; fing?: number; verdict: string; why: string }
const rows: Row[] = [];
const cm = (m: number) => Math.round(m * 1000) / 10;

function stand(variant: any, L: Loadout, sitName: string): { c: any; x: Ctx; mask: number; id: number; S: typeof SIDES[string] } {
  const S = SIDES[variant.side] ?? SIDES.defender;
  const sameSide = cast.variants.filter((v: any) => v.side === variant.side), skip = variant.side === 'operator' && sameSide.length > 1 ? 1 : 0;
  let id = S.id0; for (let k = 0; k < 64; k++) { const v = sameSide.length > skip ? sameSide[skip + (S.id0 + k) % (sameSide.length - skip)] : sameSide[0]; if (v === variant) { id = S.id0 + k; break; } }
  const c: any = new CH.Character(ch, { id, tint: S.tint, tint2: S.tint2, pos: [0, 0, 0], yaw: 0 });
  const mask = L.mask === 'suit' ? GL.castSuit(cast, variant.mask) : L.mask === 'boxes' ? GL.castGoggles(cast, variant.mask, true) : variant.mask;
  c.parts = mask; c.anim.phase = 0; c.anim.trained = S.drill; c.anim.upper = 'none'; c.anim.stance = 'none';
  const sam = variant.name === 'operator_1';
  const x: Ctx = {
    c, side: variant.side, sam,
    run(secs) { for (let i = 0; i < Math.round(secs * 60); i++) { if (c.vel) c.pos = [c.pos[0] + c.vel[0] * DT, c.pos[1], c.pos[2] + c.vel[2] * DT]; c.update(DT); } },
    walk(speed) { c.anim.speed = speed; c.vel = [0, 0, speed]; },
    arm(kind, rifle = S.rifle ?? 'carbine') {
      const a = c.anim;
      if (kind === 'rifle') { a.longGun = true; a.longSteady = rifle === 'sc20k' ? 1 : 0; a.longGrip = rifle === 'sc20k' ? RP.sc20kGrip(undefined, sam) : RP.carbineGrip(); c.muzzleAhead = rifle === 'sc20k' ? RP.sc20kMuzzleAhead() : RP.carbineMuzzleAhead(); }
      if (sam) a.gripCan = kind === 'can';
      if (a.grip) a.grip[1] = kind === 'can' || kind === 'torch';
    },
  };
  for (let i = 0; i < 30; i++) c.update(DT);
  L.pre?.(x); x.arm(L.arm, L.rifle); SITS[sitName].go(x);
  c.pos = [0, 0, 0]; c.update(0);
  return { c, x, mask, id, S };
}

/** a joint where the picture has it, in the world (the look-only hand pass may have moved a wrist off `bones`) */
const drawnAt = (c: any, node: number): V3 => { const w = c.world, p = c.skel.nodePos(node); return [w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]]; };
function measure(variant: any, L: Loadout, sitName: string) {
  if (IH) IH.INHAND.on = has('--inhand');   // (said per case: standing a figure up may put the stand's own word back)
  const { c, x, mask, id, S } = stand(variant, L, sitName);
  let built: Built; try { built = L.build(x, sitName); } catch (e) { rows.push({ variant: variant.name, side: variant.side, loadout: L.name, sit: sitName, group: '(not built)', on: 'trunk', under: NaN, underPct: 0, underAt: '', gap: NaN, sink: NaN, sinkN: 0, other: NaN, otherN: 0, otherAt: '', verdict: 'not measured', why: String(e).slice(0, 160) }); return; }   // (built BEFORE he is skinned: with IN HAND on, rig() re-poses his hands to what they hold)
  const P = skinVertices(mesh.positions, mesh.joints, mesh.weights, c.skel.jointData) as Float32Array;
  // the sample points: every vertex he wears, and every worn triangle's centroid and edge midpoints (a thin box can pass between vertices), each with the joint it hangs on
  const SP: number[] = [], SJ: number[] = []; const wornV = (v: number) => ((mask >>> partOfVert[v]) & 1) === 1;
  for (let v = 0; v < mesh.vertexCount; v++) if (wornV(v)) { SP.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); SJ.push(dom[v]); }
  for (let t = 0; t < I.length; t += 3) { const a = I[t], b = I[t + 1], d = I[t + 2]; if (!wornV(a) || !wornV(b) || !wornV(d)) continue;
    const mid = (u: number, w: number, j: number) => { SP.push((P[u * 3] + P[w * 3]) / 2, (P[u * 3 + 1] + P[w * 3 + 1]) / 2, (P[u * 3 + 2] + P[w * 3 + 2]) / 2); SJ.push(j); };
    mid(a, b, dom[a]); mid(b, d, dom[b]); mid(d, a, dom[d]); SP.push((P[a * 3] + P[b * 3] + P[d * 3]) / 3, (P[a * 3 + 1] + P[b * 3 + 1] + P[d * 3 + 1]) / 3, (P[a * 3 + 2] + P[b * 3 + 2] + P[d * 3 + 2]) / 3); SJ.push(dom[a]); }
  const nS = SJ.length;
  // the worn surface's own normals in this pose (area-weighted face normals at each vertex), for the under-the-surface test
  const N = new Float32Array(mesh.vertexCount * 3);
  for (let t = 0; t < I.length; t += 3) { const a = I[t], b = I[t + 1], d = I[t + 2]; if (!wornV(a) || !wornV(b) || !wornV(d)) continue;
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[d * 3] - P[a * 3], vy = P[d * 3 + 1] - P[a * 3 + 1], vz = P[d * 3 + 2] - P[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const k of [a, b, d]) { N[k * 3] += nx; N[k * 3 + 1] += ny; N[k * 3 + 2] += nz; } }
  const WV: number[] = []; for (let v = 0; v < mesh.vertexCount; v++) if (wornV(v)) { const l = Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) || 1; N[v * 3] /= l; N[v * 3 + 1] /= l; N[v * 3 + 2] /= l; WV.push(v); }
  const B = built.boxes, Q = B.map(qOf);
  for (const G of built.groups) {
    const idx = Array.from({ length: G.count }, (_, k) => G.start + k);
    const touch = G.grip !== undefined ? [G.grip] : idx;   // (a held thing touches him at its grip; a worn thing anywhere)
    let gap = Infinity, sink = 0, sinkN = 0, other = 0, otherN = 0, otherAt = '', left = Infinity, palm = Infinity, fing = Infinity;
    const palmJ = G.hand ? JN.indexOf(`DEF-hand.${G.hand}`) : -1, fingRe = G.hand ? new RegExp(`^DEF-f_.*\\.${G.hand}$`) : null;
    for (let s = 0; s < nS; s++) {
      const px = SP[s * 3], py = SP[s * 3 + 1], pz = SP[s * 3 + 2], j = SJ[s], parts = JPARTS[j], mine = parts.includes(G.on);
      if (mine) for (const i of touch) { const d = sd(B[i], Q[i], px, py, pz); if (d < gap) gap = Math.max(0, d); }
      if (G.grip !== undefined && G.hand) { if (j === palmJ) { const d = Math.max(0, sd(B[G.grip], Q[G.grip], px, py, pz)); if (d < palm) palm = d; } else if (fingRe!.test(JN[j])) { const d = Math.max(0, sd(B[G.grip], Q[G.grip], px, py, pz)); if (d < fing) fing = d; } }
      if (G.left !== undefined && parts.includes('handL')) { const d = Math.max(0, sd(B[G.left], Q[G.left], px, py, pz)); if (d < left) left = d; }
      let deep = 0; for (const i of idx) { const d = sd(B[i], Q[i], px, py, pz); if (d < 0 && -d > deep) deep = -d; }
      if (deep > 0) { const inHands = parts.includes('hands') && (G.hand !== undefined || G.on === 'hands');   // (either hand round a held thing counts as the hand's)
        if (mine || inHands) { sinkN++; if (deep > sink) sink = deep; } else { otherN++; if (deep > other) { other = deep; otherAt = JN[j].replace('DEF-', ''); } } }
    }
    // 27 points of every box (corners, edge and face middles, the centre): each against the nearest worn vertex — under the surface when it lies behind that vertex's normal
    let under = 0, underN = 0, underAll = 0, underAt = '';
    for (const i of idx) { const b = B[i], q = Q[i];
      for (let k = 0; k < 27; k++) { const w = rotV(q, [((k % 3) - 1) * b.h[0], ((Math.floor(k / 3) % 3) - 1) * b.h[1], (Math.floor(k / 9) - 1) * b.h[2]]), px = b.c[0] + w[0], py = b.c[1] + w[1], pz = b.c[2] + w[2];
        let best = Infinity, bv = -1; for (const v of WV) { const dx = px - P[v * 3], dy = py - P[v * 3 + 1], dz = pz - P[v * 3 + 2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < best) { best = d2; bv = v; } }
        underAll++; if (bv < 0) continue; const dep = -((px - P[bv * 3]) * N[bv * 3] + (py - P[bv * 3 + 1]) * N[bv * 3 + 1] + (pz - P[bv * 3 + 2]) * N[bv * 3 + 2]);
        if (dep > 0.005 && best < 0.12 * 0.12) { underN++; if (dep > under) { under = dep; underAt = JN[dom[bv]].replace('DEF-', ''); } } } }
    const row: Row = { under: cm(under), underPct: Math.round(100 * underN / Math.max(1, underAll)), underAt, variant: variant.name, side: variant.side, loadout: L.name, sit: sitName, group: G.label, on: G.on, gap: cm(gap), sink: cm(sink), sinkN, other: cm(other), otherN, otherAt, verdict: 'fine', why: '' };
    if (G.hand && G.grip !== undefined) {
      const hf = G.hand === 'R' ? c.handFrameR() : c.handFrameL(), w = drawnAt(c, G.hand === 'R' ? c.anim.nodes.handR : c.anim.nodes.handL), g = B[G.grip], d: V3 = [g.c[0] - w[0], g.c[1] - w[1], g.c[2] - w[2]];
      row.gripF = cm(dot(d, hf.fingers)); row.gripP = cm(-dot(d, hf.back)); row.gripT = cm(dot(d, hf.thumb));
      const lead = B[G.start], axis = rotV(Q[G.start], [0, 0, 1]);   // the group's first box lies along the thing's own line (a slide, a receiver, a torch body, a can, a handle)
      void lead; const ref = /can|hammer|knife/.test(G.label) || (/torch/.test(G.label) && IH?.INHAND.on) ? hf.thumb : hf.fingers;   // (a thing stood in the fist lies along the thumb's line; a gun along the fingers — and a torch, as it was fitted, until IN HAND puts the fist round it)
      if (!/magazine/.test(G.label)) row.ang = Math.round(Math.acos(Math.min(1, Math.abs(dot(axis, ref)))) * 180 / Math.PI);
    }
    if (G.left !== undefined && Number.isFinite(left)) row.left = cm(left);
    if (Number.isFinite(palm)) row.palm = cm(palm); if (Number.isFinite(fing)) row.fing = cm(fing);
    judge(row); rows.push(row);
  }
  if (flag('--ply')) writePly(variant, L, sitName, c, P, mask, id, S, B);
}
/** the one-line verdict. Held: the hand's skin should be on (or a finger's thickness into) the grip, the thing along the hand, nothing else of him inside it. Worn: on him, not in him. */
function judge(r: Row) {
  const why: string[] = []; let v = 'fine';
  const held = r.gripF !== undefined;
  if (held) {
    if (r.gap > 1.5) { v = 'floats'; why.push(`the hand is ${r.gap} cm off the grip`); }
    else if ((r.palm ?? 0) > 1.5) { v = 'floats'; why.push(`the palm is ${r.palm} cm off the grip (the fingers reach it)`); }
    else if ((r.fing ?? 0) > 1.5) { v = 'floats'; why.push(`the fingers are ${r.fing} cm off the grip (the palm is on it)`); }
    if ((r.ang ?? 0) > 15) { v = v === 'fine' ? 'wrong place' : v; why.push(`${r.ang}° off the hand's line`); }
    if (r.left !== undefined && r.left > 2.5) { v = v === 'fine' ? 'floats' : v; why.push(`the support hand is ${r.left} cm off it`); }
    if (r.sink > 3.5) { v = v === 'fine' ? 'buried' : v; why.push(`${r.sink} cm into the hand`); }
    if (r.other > 2) { v = v === 'fine' ? 'buried' : v; why.push(`${r.other} cm into his ${r.otherAt}`); }
    if (r.underPct >= 20 && r.under >= 2.5) { v = v === 'fine' ? 'buried' : v; why.push(`${r.underPct}% of it is under his surface, up to ${r.under} cm (${r.underAt})`); }
  } else {
    if (r.gap > 2.5) { v = 'floats'; why.push(`${r.gap} cm off his ${r.on}`); }
    const deep = /wrist tie/.test(r.group) ? 0 : Math.max(r.sink, r.other);
    if (r.underPct >= 25 && r.under >= 2) { v = v === 'fine' ? 'buried' : v; why.push(`${r.underPct}% of it is under his surface, up to ${r.under} cm (${r.underAt})`); }
    else if (deep > 2) { v = v === 'fine' ? 'buried' : v; why.push(`${deep} cm into his ${r.sink >= r.other ? r.on : r.otherAt}`); }
  }
  r.verdict = v; r.why = why.join('; ');
}

function writePly(variant: any, L: Loadout, sitName: string, c: any, P: Float32Array, mask: number, id: number, S: typeof SIDES[string], boxes: any[]) {
  const sdl = CM.charSlots(ch); const SLOTN: string[] = [...CM.CHAR_SLOTS];
  const side = sideOfTeam(S.team, S.trained); const pal = new Float32Array(CM.CHAR_MAT_FLOATS); CM.writeCharPalette(pal, 0, side, S.tint, S.tint2, id, !sdl.authored);
  const wornV = (v: number) => ((mask >>> partOfVert[v]) & 1) === 1;
  const remap = new Int32Array(mesh.vertexCount).fill(-1); const verts: number[] = [], cols: number[] = [], faces: number[] = [];
  const srgb = (l: number) => Math.round(255 * Math.min(1, Math.max(0, l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055)));
  for (let t = 0; t < I.length; t += 3) {
    const tri = [I[t], I[t + 1], I[t + 2]]; if (!tri.every(wornV)) continue;
    for (const v of tri) { if (remap[v] < 0) { remap[v] = verts.length / 3; verts.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); const s = Math.min(sdl.slot[v], 10), p = 8 + s * 8; cols.push(srgb(pal[p]), srgb(pal[p + 1]), srgb(pal[p + 2]), s); } faces.push(remap[v]); }
  }
  const bodyVerts = verts.length / 3, bodyTris = faces.length / 3;
  for (const b of boxes) {
    const q = qOf(b); const base = verts.length / 3; const lum = Math.max(b.albedo[0], b.albedo[1], b.albedo[2]) < 0.02 ? 0.035 : 0;
    for (let k = 0; k < 8; k++) { const w = rotV(q, [(k & 1 ? 1 : -1) * b.h[0], (k & 2 ? 1 : -1) * b.h[1], (k & 4 ? 1 : -1) * b.h[2]]); verts.push(b.c[0] + w[0], b.c[1] + w[1], b.c[2] + w[2]); cols.push(srgb(b.albedo[0] + lum), srgb(b.albedo[1] + lum), srgb(b.albedo[2] + lum), 15); }
    for (const f of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) faces.push(base + f[0], base + f[1], base + f[2], base + f[0], base + f[2], base + f[3]);
  }
  const nV = verts.length / 3, nF = faces.length / 3;
  const head = `ply\nformat binary_little_endian 1.0\ncomment twopointsix attach-mesh ${variant.name} ${L.name} ${sitName}\nelement vertex ${nV}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nproperty uchar slot\nelement face ${nF}\nproperty list uchar int vertex_indices\nend_header\n`;
  const hb = new TextEncoder().encode(head), buf = new ArrayBuffer(hb.length + nV * 16 + nF * 13), dv = new DataView(buf); new Uint8Array(buf).set(hb, 0);
  let o = hb.length;
  for (let i = 0; i < nV; i++) { dv.setFloat32(o, verts[i * 3], true); dv.setFloat32(o + 4, verts[i * 3 + 1], true); dv.setFloat32(o + 8, verts[i * 3 + 2], true); dv.setUint8(o + 12, cols[i * 4]); dv.setUint8(o + 13, cols[i * 4 + 1]); dv.setUint8(o + 14, cols[i * 4 + 2]); dv.setUint8(o + 15, cols[i * 4 + 3]); o += 16; }
  for (let i = 0; i < nF; i++) { dv.setUint8(o, 3); dv.setInt32(o + 1, faces[i * 3], true); dv.setInt32(o + 5, faces[i * 3 + 1], true); dv.setInt32(o + 9, faces[i * 3 + 2], true); o += 13; }
  const outDir = resolve(flag('--ply')!); mkdirSync(outDir, { recursive: true });
  const tag = flag('--tag'); const stem = `${variant.name}__${L.name}__${sitName}${tag ? `__${tag}` : ''}`;
  writeFileSync(`${outDir}/${stem}.ply`, new Uint8Array(buf));
  const np = (name: string): V3 | null => { const i = ch.nodeByName.get(name); if (i === undefined) return null; const p = c.skel.nodePos(i); return [p[0], p[1], p[2]]; };
  const hand = (s: 'L' | 'R') => ({ wrist: np(`DEF-hand.${s}`), index1: np(`DEF-f_index.01.${s}`), middle1: np(`DEF-f_middle.01.${s}`), pinky1: np(`DEF-f_pinky.01.${s}`), tips: ['f_index', 'f_middle', 'f_ring', 'f_pinky', 'thumb'].map(f => np(`DEF-${f}.03.${s}`)) });
  let commit = ''; try { commit = execSync(`git -C "${ROOT}" rev-parse --short HEAD`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a checkout */ }
  writeFileSync(`${outDir}/${stem}.json`, JSON.stringify({ variant: variant.name, side: variant.side, parts: variant.parts, situation: `${L.name} · ${sitName}`, says: `${L.say} — ${SITS[sitName].say}`, id, moves: true, tag: tag ?? '', held: L.arm, commit,
    slots: SLOTN, bodyVerts, bodyTris, propBoxes: boxes.length, notes: [], joints: { head: np('DEF-head'), hips: np('DEF-hips'), chest: np('DEF-spine.003'), footL: np('DEF-foot.L'), footR: np('DEF-foot.R') }, hands: { L: hand('L'), R: hand('R') } }, null, 1));
}

// ---- run
const wantV = pick('--variant'), wantL = pick('--loadout'), wantS = pick('--sit');
const log = console.log, mute = () => { console.log = console.warn = () => { }; }, unmute = () => { console.log = log; };
let cases = 0;
for (const L of LOADOUTS) { if (wantL && !wantL.includes(L.name)) continue;
  for (const variant of cast.variants) { if (!L.who(variant) || (wantV && !wantV.includes(variant.name))) continue;
    for (const s of L.sits) { if (wantS && !wantS.includes(s)) continue; mute(); try { measure(variant, L, s); } finally { unmute(); } cases++; } } }

const bad = (r: Row) => (r.verdict === 'fine' ? 0 : 1);
const score = (r: Row) => (Number.isFinite(r.gap) ? Math.max(r.gap, r.underPct >= 20 ? r.under : 0, r.sink > 3.5 || r.gripF === undefined ? r.sink : 0, r.other, r.left ?? 0, (r.ang ?? 0) / 5) : 99);
rows.sort((a, b) => bad(b) - bad(a) || score(b) - score(a));
const line = (r: Row) => `| ${r.variant} | ${r.loadout} | ${r.sit} | ${r.group} | ${r.gap} | ${r.sink} (${r.sinkN}) | ${r.other}${r.otherN ? ` (${r.otherN}, ${r.otherAt})` : ''} | ${r.under}${r.underPct ? ` (${r.underPct}%, ${r.underAt})` : ''} | ${r.gripF !== undefined ? `${r.gripF} / ${r.gripP} / ${r.gripT} · ${r.ang ?? '–'}° · palm ${r.palm ?? '–'} fingers ${r.fing ?? '–'}` : ''} | ${r.left ?? ''} | ${r.verdict}${r.why ? `: ${r.why}` : ''} |`;
const HEAD = '| variant | loadout | situation | group | gap cm | sink cm (verts) | other cm (verts, where) | under cm (share, where) | grip in the hand: along fingers / out of palm / to thumb cm · angle · gaps of the palm and of the fingers | left hand cm | verdict |\n|---|---|---|---|---|---|---|---|---|---|---|';
if (flag('--json')) writeFileSync(resolve(flag('--json')!), JSON.stringify(rows, null, 1));
if (flag('--md')) writeFileSync(resolve(flag('--md')!), `${HEAD}\n${rows.map(line).join('\n')}\n`);
const off = rows.filter(bad);
console.log(`attach-mesh: ${cases} cases, ${rows.length} groups measured, ${off.length} not fine (${harnessWord()})`);
// per group and verdict: how many, and the worst of them
const by = new Map<string, Row[]>(); for (const r of rows) { const k = `${r.group.replace(/ \(k [\d.]+\)/, '')} · ${r.verdict}`; (by.get(k) ?? by.set(k, []).get(k)!).push(r); }
for (const [k, rs] of [...by].sort((a, b) => a[0].localeCompare(b[0]))) { const w = rs[0]; console.log(`  ${k.padEnd(44)} ${String(rs.length).padStart(4)}   worst: ${w.variant} ${w.loadout} ${w.sit} — gap ${w.gap} sink ${w.sink} other ${w.other}${w.otherAt ? ` (${w.otherAt})` : ''} under ${w.under}/${w.underPct}%${w.underAt ? ` (${w.underAt})` : ''}${w.gripF !== undefined ? ` grip ${w.gripF}/${w.gripP}/${w.gripT} ${w.ang}°` : ''}${w.left !== undefined ? ` left ${w.left}` : ''}${w.palm !== undefined ? ` palm ${w.palm} fing ${w.fing}` : ''}`); }
function harnessWord(): string { return `${process.env.TPS_PROFILE === 'shipped' ? 'the shipped stand' : 'the frozen stand'}, issue kit ${GE.GEAR.on ? 'on' : 'off'}, cast of ${cast.variants.length}${tried.length ? `; TRIED ${tried.join(', ')}` : ''}`; }
