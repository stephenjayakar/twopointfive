// POSE → MESH: one man of a cast variant put into a named situation by the real animator, stepped until the pose has settled, and the mesh of the parts he WEARS
// skinned on the CPU (render/meshbvh.ts skinVertices — the blend the mesh shadows use) and written out as a PLY for tools/qa/pose-mesh-render.py to draw.
// What the capsule strips (pose-strip.ts) cannot show: fingers, cloth, hats, what a hand does against a vest.
//
//   bun run tools/qa/pose-mesh.ts list
//   bun run tools/qa/pose-mesh.ts <variant> <situation> [--out <dir>] [--moves off] [--id N] [--no-props] [--tag <text>] [--at <secs>] [--set '<json>']
//       → <dir>/<variant>__<situation>[__<tag>].ply + .json      (dir: ./pose-mesh-out unless given)
//       --gunhand: a move keeps to the hand that is free (src/game/gunhand.ts, as the page has it): `rifle-throw` is then the left hand's, the can drawn in it;
//       torch-up brings the torch up in the hand that holds it; a long gun's reload is its own move, not the pistol's clip
//       --inhand: the hands posed to what he holds (src/game/inhand.ts, as the page has it): a pistol drawn in the hand, the hand put to a torch or a long gun
//       --at: that much longer in the situation before the pose is taken (a gait at another point of its cycle);  --set '{"MOVES":{"steady":0}}': character.ts tables written over
//       (and wallsnap.ts's: `--set '{"WALLSNAP":{"pose":false}}'` = the wall hold's poses as they were; WALLSNAP.on is raised for every situation, as the page has it)
//       the wall hold: wall-crouch (parked), wall-sidle, wall-crouch-sidle, wall-crouch-sidle-l (the other way), wall-crouch-creep (half pace)
//   ~/bvenv/bin/python -I tools/qa/pose-mesh-render.py <dir>/<variant>__<situation>.ply      → the contact sheet beside it (.png)
//   REPO=<another checkout> bun run tools/qa/pose-mesh.ts …      → the same situation through THAT tree's animator (a before / after pair)
//
// The PLY (binary, y up, +z the man's front, metres): vertex x y z · red green blue (sRGB bytes of his slot's albedo as charMaterials.ts resolves it for this man) ·
// slot (the material slot id; 15 = a prop box). The JSON beside it: who he is, the switches, and the hand joints the renderer frames its close-ups on.
// The man is a bare Character (as the moves probes stand one up), dealt what game.ts deals his side every frame — training, the long gun's grip point and muzzle —
// with the page's defaults for the motion switches (MOVES and TURN on; `--moves off` = the pose as it was before the motion pass).
// Props (the gun, the torch, the holster — rigProps' boxes, exactly the ones the game draws) are appended as plain boxes so a grip can be judged against what it holds.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(process.env.REPO ?? new URL('../..', import.meta.url).pathname);
type V3 = [number, number, number];
const args = process.argv.slice(2);
const flag = (n: string): string | null => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1] ?? ''; };
const has = (n: string) => args.includes(n);
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--out', '--moves', '--id', '--tag', '--at', '--set'].includes(args[i - 1])));

const H = await import(`${ROOT}/tools/qa/headless.ts`);
const CH: any = await import(`${ROOT}/src/game/character.ts`);
const WS: any = await import(`${ROOT}/src/game/wallsnap.ts`);
const CM: any = await import(`${ROOT}/src/render/charMaterials.ts`);
const RP: any = await import(`${ROOT}/src/game/rigProps.ts`);
const IH: any = await import(`${ROOT}/src/game/inhand.ts`).catch(() => null);   // (a tree from before the rule has no such module: --inhand is then nothing)
const inhand = has('--inhand') && !!IH; if (IH) IH.INHAND.on = inhand;
const GH: any = await import(`${ROOT}/src/game/gunhand.ts`).catch(() => null);   // (likewise: --gunhand is nothing in a tree from before that switch)
if (GH) GH.GUNHAND.on = has('--gunhand');
const { skinVertices } = await import(`${ROOT}/src/render/meshbvh.ts`);
const { sideOfTeam } = await import(`${ROOT}/src/game/charLook.ts`);
const DT = 1 / 60;

// ---- who: one man per cast side, as the game colours and drills them (guards.ts TEAM_TINT / TEAM_TINT2, game.ts `an.trained`)
const SIDES: Record<string, { team: string; trained: boolean; drill: number; tint: V3; tint2: V3; id0: number; rifle: 'sc20k' | 'carbine' | null }> = {
  operator: { team: 'operative', trained: false, drill: 1, tint: [0.07, 0.09, 0.1], tint2: [0.05, 0.07, 0.06], id0: 20, rifle: 'sc20k' },
  defender: { team: 'hostile', trained: false, drill: 0.12, tint: [0.36, 0.33, 0.24], tint2: [0.09, 0.08, 0.05], id0: 24, rifle: 'carbine' },
  responder: { team: 'guard', trained: true, drill: 0.75, tint: [0.42, 0.36, 0.25], tint2: [0.02, 0.02, 0.025], id0: 20, rifle: 'carbine' },
  civilian: { team: 'civilian', trained: false, drill: 0.5, tint: [0.75, 0.62, 0.08], tint2: [0.05, 0.06, 0.1], id0: 40, rifle: null },
};

// ---- the situations: each drives the animator the way the game's controllers do (upper / stance / speed / crouchTarget and the one-shots), nothing poses a bone
interface Ctx { c: any; side: string; run(secs: number): void; arm(kind: 'rifle' | 'pistol' | 'torch' | 'can' | null): void; walk(speed: number): void; }
const FN = { dur: 2.4, out: 0.5, in_: 1.5, rack: 2.0 }, AK = { dur: 2.6, out: 0.7, in_: 1.7, rack: 2.2 };
const SITS: Record<string, { say: string; go(x: Ctx): void }> = {
  'idle': { say: 'standing, nothing in the hands', go: x => { x.arm(null); x.run(2); } },
  'walk': { say: 'walking at 1.4 m/s, nothing in the hands, mid-stride', go: x => { x.arm(null); x.walk(1.4); x.run(2.3); } },
  'run': { say: 'running at 3.4 m/s, nothing in the hands', go: x => { x.arm(null); x.walk(3.4); x.run(2.15); } },
  'sprint': { say: 'sprinting at 4.7 m/s, nothing in the hands (the player, hands empty or the pistol holstered)', go: x => { x.arm(null); x.c.anim.upper = 'none'; x.walk(4.7); x.run(2); } },
  'sprint-rifle': { say: 'sprinting at 4.7 m/s with the long gun in both hands at the low carriage (the player sprinting with the rifle)', go: x => { x.arm('rifle'); const a = x.c.anim; a.upper = 'none'; if ('longStance' in a) { a.longStance = 'lowLong'; a.longSteady = 1; } x.walk(4.7); x.run(2); } },
  'sprint-pistol': { say: 'sprinting at 4.7 m/s with the pistol in both hands at the low ready (the player sprinting with the pistol out: character.ts RUNREADY)', go: x => { x.arm('pistol'); const a = x.c.anim; a.upper = 'none'; a.runReady = true; x.walk(4.7); x.run(2); } },
  'sprint-pistol-old': { say: 'sprinting at 4.7 m/s with the pistol in a pumping fist (the player with RUNREADY off)', go: x => { x.arm('pistol'); x.c.anim.upper = 'none'; x.walk(4.7); x.run(2); } },
  'crouch': { say: 'crouched, still, nothing in the hands', go: x => { x.arm(null); x.c.anim.crouchTarget = 1; x.run(2); } },
  'crouch-walk': { say: 'crouched, moving at 0.9 m/s, nothing in the hands', go: x => { x.arm(null); x.c.anim.crouchTarget = 1; x.walk(0.9); x.run(2.3); } },
  'rifle-carry': { say: 'the long gun carried: an operator at the low ready, anybody else on patrol', go: x => { x.arm('rifle'); const a = x.c.anim; if (x.side === 'operator') { a.upper = 'none'; a.stance = 'lowReady'; } else a.upper = 'relaxed'; x.run(2); } },
  'crouch-rifle-walk': { say: 'crouched and moving at 1.3 m/s with the long gun shouldered (the player sneaking, rifle up)', go: x => { x.arm('rifle'); const a = x.c.anim; a.upper = 'aim'; a.crouchTarget = 1; if ('longStance' in a) { a.longStance = 'shoulder'; a.longSteady = 1; } x.walk(1.3); x.run(2); } },
  'rifle-walk': { say: 'the long gun carried at a walk (1.3 m/s)', go: x => { x.arm('rifle'); const a = x.c.anim; if (x.side === 'operator') { a.upper = 'none'; a.stance = 'lowReady'; } else a.upper = 'relaxed'; x.walk(1.3); x.run(2.3); } },
  'rifle-aim': { say: 'the long gun shouldered, on a man', go: x => { x.arm('rifle'); x.c.anim.upper = 'aim'; x.run(2); } },
  'rifle-throw': { say: 'the long gun up, an overhand throw 0.2 s in (the hand at the top of the swing; --gunhand: the free hand\'s)', go: x => { x.arm('rifle'); x.c.anim.upper = 'aim'; x.run(2); x.c.anim.throwItem(); x.run(0.2); } },
  'rifle-fire': { say: 'the long gun shouldered, 0.05 s after a round', go: x => { x.arm('rifle'); x.c.anim.upper = 'aim'; x.run(2); x.c.anim.fire(); x.run(0.05); } },
  'rifle-crouch': { say: 'the long gun shouldered, crouched', go: x => { x.arm('rifle'); x.c.anim.upper = 'aim'; x.c.anim.crouchTarget = 1; x.run(2); } },
  'pistol-carry': { say: 'the pistol out, lowered', go: x => { x.arm('pistol'); x.c.anim.upper = 'relaxed'; x.run(2); } },
  'pistol-aim': { say: 'the pistol up in both hands', go: x => { x.arm('pistol'); x.c.anim.upper = 'aim'; x.run(2); } },
  'pistol-crouch': { say: 'the pistol up in both hands, crouched (a teammate on the rear of a sneaking pair)', go: x => { x.arm('pistol'); x.c.anim.upper = 'aim'; x.c.anim.crouchTarget = 1; x.run(2); } },
  'pistol-crouch-walk': { say: 'the pistol up in both hands, crouched and moving at 1.2 m/s', go: x => { x.arm('pistol'); x.c.anim.upper = 'aim'; x.c.anim.crouchTarget = 1; x.walk(1.2); x.run(2.2); } },
  'pistol-crouch-up': { say: 'the pistol coming up, crouched: 0.07 s after the aim was called from the low ready', go: x => { x.arm('pistol'); const a = x.c.anim; a.upper = 'none'; a.stance = 'lowReady'; a.crouchTarget = 1; x.run(2); a.upper = 'aim'; a.stance = 'none'; x.run(0.07); } },
  'pistol-aside': { say: 'the pistol up in both hands, crouched, on a point 70 degrees to his left', go: x => { x.arm('pistol'); x.c.anim.upper = 'aim'; x.c.anim.crouchTarget = 1; x.c.aimYaw = x.c.bodyYaw + 70 * Math.PI / 180; x.run(2); } },
  'torch': { say: 'a calm patrol: the torch in the right fist at his side (no upper layer: the walk clip\'s own hand)', go: x => { x.arm('torch'); x.walk(1.2); x.run(2.3); } },
  'torch-up': { say: 'answering a whistle with the torch still in the hand (upper \'torch\': the Idle_Torch clip)', go: x => { x.arm('torch'); x.c.anim.upper = 'torch'; x.run(2); } },
  'smoke-up': { say: 'having a smoke (smokebreak.ts): the left hand at his mouth, the torch down in the right', go: x => { x.arm('torch'); x.run(2); x.c.anim.smoke = 1; x.run(1.4); } },
  'smoke-rest': { say: 'having a smoke: between draws, the hand down with the end lit', go: x => { x.arm('torch'); x.run(2); x.c.anim.smoke = 1; x.run(1.4); x.c.anim.smoke = 0; x.run(1.6); } },
  'can': { say: 'a canister in the right fist (Sam with a can selected)', go: x => { x.arm('can'); x.run(2); } },
  'reload': { say: 'the long gun\'s magazine change, the fresh one on its way to the well', go: x => { x.arm('rifle'); const a = x.c.anim, B = x.side === 'operator' ? FN : AK; a.reloadBack = x.side === 'operator'; a.upper = 'none'; a.stance = 'lowReady'; x.run(1.5); a.reload(x.side === 'operator' ? 2.4 : 1.6, B); x.run((B.out + B.in_) / 2 + 0.06); } },
  'reload-miss': { say: 'the long gun\'s magazine change, an untrained man backing the fresh one off the lip he hit (a drilled man: on its way in)', go: x => { x.arm('rifle'); const a = x.c.anim, B = x.side === 'operator' ? FN : AK; a.reloadBack = x.side === 'operator'; a.upper = 'none'; a.stance = 'lowReady'; x.run(1.5); a.reload(x.side === 'operator' ? 2.4 : 1.6, B); x.run(B.in_ - 0.1); } },
  'reload-slap': { say: 'the long gun\'s magazine change, an untrained man winding up the slap that seats it (a drilled man: the hand on its way to the handle)', go: x => { x.arm('rifle'); const a = x.c.anim, B = x.side === 'operator' ? FN : AK; a.reloadBack = x.side === 'operator'; a.upper = 'none'; a.stance = 'lowReady'; x.run(1.5); a.reload(x.side === 'operator' ? 2.4 : 1.6, B); x.run(B.in_ + 0.19); } },
  'reload-mag': { say: 'the long gun\'s magazine change, the hand at the magazine', go: x => { x.arm('rifle'); const a = x.c.anim, B = x.side === 'operator' ? FN : AK; a.reloadBack = x.side === 'operator'; a.upper = 'none'; a.stance = 'lowReady'; x.run(1.5); a.reload(x.side === 'operator' ? 2.4 : 1.6, B); x.run(B.out); } },
  'blinded': { say: 'a stun charge went off in front of him: bent away, the forearm over the eyes', go: x => { x.arm(x.side === 'civilian' ? null : 'rifle'); const a = x.c.anim; if (a.longGun) a.upper = 'aim'; x.run(1.5); a.dazzle = { from: [0.4, 1, 2.5], k: 1 }; x.run(0.9); } },
  'bound': { say: 'a hostage: kneeling, wrists behind the back', go: x => { x.arm(null); const a = x.c.anim; a.crouchTarget = 1; x.run(1); a.bound = 1; x.run(1.2); } },
  'stay-down': { say: 'told to stay down: kneeling, hands on the head', go: x => { x.arm(null); const a = x.c.anim; a.crouchTarget = 1; x.run(1); a.bound = 2; x.run(1.2); } },
  'clutch': { say: 'knocked about and still up: the support hand to the ribs', go: x => { x.arm(x.side === 'civilian' ? null : 'rifle'); const a = x.c.anim; if (a.longGun) { a.upper = 'none'; a.stance = 'lowReady'; } x.run(1.5); a.clutch = 1; x.run(1); } },
  'sit': { say: 'seated at a desk (the late worker\'s clip)', go: x => { x.arm(null); x.c.anim.act = { clip: 'Sitting_Idle_Loop' }; x.run(2); } },
  'talk': { say: 'telling somebody what she saw (the civilians\' talking clip)', go: x => { x.arm(null); x.c.anim.act = { clip: 'Idle_Talking_Loop' }; x.run(2); } },
  'signal-hold': { say: 'the left fist up: hold', go: x => { x.arm(x.side === 'civilian' ? null : 'rifle'); const a = x.c.anim; if (a.longGun) { a.upper = 'none'; a.stance = 'highReady'; } x.run(1.5); a.signal('hold'); x.run(0.5); } },
  'signal-aside': { say: 'the left hand off the gun, pushed out wide to his own left: you are in my line, go that way (the push at its widest)', go: x => { x.arm(x.side === 'civilian' ? null : 'rifle'); const a = x.c.anim; if (a.longGun) { a.upper = 'none'; a.stance = 'lowReady'; } x.run(1.5); a.signal('aside'); x.run(0.4); } },
  'signal-aside-in': { say: '… the same wave between its two pushes (the hand back in front of his chest)', go: x => { x.arm(x.side === 'civilian' ? null : 'rifle'); const a = x.c.anim; if (a.longGun) { a.upper = 'none'; a.stance = 'lowReady'; } x.run(1.5); a.signal('aside'); x.run(0.58); } },
  'signal-aside-right': { say: '… the wave the other way: the left hand swept across his front to his right (the push at its widest)', go: x => { x.arm(x.side === 'civilian' ? null : 'rifle'); const a = x.c.anim; if (a.longGun) { a.upper = 'none'; a.stance = 'lowReady'; } x.run(1.5); a.signal('aside', -1); x.run(0.4); } },
  'nv-reach': { say: 'night vision by hand: the left hand at the goggles, still up on the brow', go: x => { x.arm(null); x.run(1.5); x.c.anim.nvFlip(true, true); x.run(0.38); } },
  'nv-hand': { say: 'night vision by hand: the goggles half way down in the left hand', go: x => { x.arm(null); x.run(1.5); x.c.anim.nvFlip(true, true); x.run(0.45); } },
  'nv-down': { say: 'night vision by hand: the goggles down, the hand about to leave', go: x => { x.arm(null); x.run(1.5); x.c.anim.nvFlip(true, true); x.run(0.54); } },
  'nv-nod': { say: 'night vision by a nod: the long gun shouldered, the head at the bottom of its dip', go: x => { x.arm('rifle'); x.c.anim.upper = 'aim'; x.run(1.5); x.c.anim.nvFlip(true, false); x.run(0.18); } },
  'wall': { say: 'back to a wall, hands flat on it', go: x => { x.arm(null); const a = x.c.anim; a.stance = 'wall'; x.run(1.5); } },
  'wall-crouch': { say: 'back to a wall, crouched, parked', go: x => wallHold(x, 1, 0, 1) },
  'wall-sidle': { say: 'back to a wall, sidling to his right at the wall pace (1.4 m/s), the legs turned 55 degrees as player.ts turns them', go: x => wallHold(x, 0, 1.4, 1) },
  'wall-crouch-sidle': { say: 'back to a wall, crouched, sidling to his right at the crouch pace (1.3 m/s)', go: x => wallHold(x, 1, 1.3, 1) },
  'wall-crouch-sidle-l': { say: 'back to a wall, crouched, sidling to his LEFT at the crouch pace', go: x => wallHold(x, 1, 1.3, -1) },
  'wall-crouch-creep': { say: 'back to a wall, crouched, sidling at half the crouch pace (the legs part turned)', go: x => wallHold(x, 1, 0.65, 1) },
};
/** the back-to-the-wall hold as player.ts drives it: stance 'wall', the lead side, and the legs turned toward the way he sidles by the share of his pace (WALL_TURN 55 deg x smoothstep(0.1, 0.9, v / pace)) —
 *  the figure's front stays model +z, so the WALL swings round behind him (anim.wallYaw) and he travels along it */
function wallHold(x: Ctx, crouch: 0 | 1, speed: number, side: -1 | 1): void {
  x.arm(null); const a = x.c.anim; a.stance = 'wall'; a.stackSide = side; a.crouchTarget = crouch; x.run(1.2);
  if (speed > 0) {
    const pace = crouch ? 1.3 : 1.4, u = Math.min(1, Math.max(0, (speed / pace - 0.1) / 0.8)), k = u * u * (3 - 2 * u), ny = side * 55 * Math.PI / 180 * k;
    a.wallYaw = ny; a.speed = speed; x.c.vel = [-Math.cos(ny) * side * speed, 0, Math.sin(ny) * side * speed]; x.run(2);
  }
}

const ch: any = await H.loadCastCharacter();
const cast = ch.cast, mesh = ch.mesh;
if (!cast || !mesh.part) { console.error('pose-mesh: no cast loaded (public/assets/chars/cast.gltf)'); process.exit(2); }
if (pos[0] === 'list' || pos.length < 2) {
  console.log('variants:   ' + cast.variants.map((v: any) => `${v.name} (${v.side})`).join(' · '));
  console.log('situations:'); for (const [k, s] of Object.entries(SITS)) console.log(`  ${k.padEnd(13)} ${s.say}`);
  console.log('\n  bun run tools/qa/pose-mesh.ts <variant> <situation> [--out <dir>] [--moves off] [--id N] [--no-props] [--tag <text>]');
  process.exit(pos[0] === 'list' ? 0 : 2);
}
const variant = cast.variants.find((v: any) => v.name === pos[0]); const sit = SITS[pos[1]];
if (!variant || !sit) { console.error(`pose-mesh: unknown ${variant ? `situation '${pos[1]}'` : `variant '${pos[0]}'`} — \`bun run tools/qa/pose-mesh.ts list\``); process.exit(2); }
const S = SIDES[variant.side] ?? SIDES.defender;
const movesOn = flag('--moves') !== 'off';
if (CH.MOVES) CH.MOVES.on = movesOn ? 1 : 0;
if (CH.TURN) CH.TURN.on = movesOn ? 1 : 0;
WS.WALLSNAP.on = true;   // the wall hold as the page has it (the feel pass + its mended poses); --set '{"WALLSNAP":{"pose":false}}' = the poses before the mend
if (flag('--set')) for (const [t, o] of Object.entries(JSON.parse(flag('--set')!))) Object.assign(CH[t] ?? WS[t], o);
// his id: the first from the side's base that the by-id deal (cast.ts castVariantOf's `pick`: list[skip + id % (n − skip)] — a teammate in play is dealt by his place among the team instead, `operatorAt`) hands this variant — the per-man dice hang on it
const sameSide = cast.variants.filter((v: any) => v.side === variant.side), skip = variant.side === 'operator' && sameSide.length > 1 ? 1 : 0;
let id = flag('--id') ? +flag('--id')! : S.id0;
if (!flag('--id')) for (let k = 0; k < 64; k++) { const v = sameSide.length > skip ? sameSide[skip + (S.id0 + k) % (sameSide.length - skip)] : sameSide[0]; if (v === variant) { id = S.id0 + k; break; } }

const c: any = new CH.Character(ch, { id, tint: S.tint, tint2: S.tint2, pos: [0, 0, 0], yaw: 0 });
c.parts = variant.mask; c.anim.phase = 0; c.anim.trained = S.drill; c.anim.upper = 'none'; c.anim.stance = 'none';
let held: 'rifle' | 'pistol' | 'torch' | 'can' | null = null;
const x: Ctx = {
  c, side: variant.side,
  run(secs) { for (let i = 0; i < Math.round(secs * 60); i++) { if (c.vel) c.pos = [c.pos[0] + c.vel[0] * DT, c.pos[1], c.pos[2] + c.vel[2] * DT]; c.update(DT); } },
  walk(speed) { c.anim.speed = speed; c.vel = [0, 0, speed]; },
  arm(kind) {
    const a = c.anim; held = kind === 'rifle' && !S.rifle ? null : kind;
    if (held === 'rifle') { a.longGun = true; a.longSteady = S.rifle === 'sc20k' ? 1 : 0; a.longGrip = S.rifle === 'sc20k' ? RP.sc20kGrip(undefined, has('--fit')) : RP.carbineGrip(); c.muzzleAhead = S.rifle === 'sc20k' ? RP.sc20kMuzzleAhead() : RP.carbineMuzzleAhead(); }
    c.inHand = !inhand ? null : held === 'pistol' ? IH.IN_PISTOL : held === 'torch' ? RP.torchHold([0, 0, 1]) : held === 'rifle' && !has('--fit') ? RP.longHold(S.rifle) : null;   // (the drawer's words — combat.ts handProps deals them every frame; a patrol's beam lies level ahead of him: rigProps torchCarryDir)
    if (has('--fit')) a.gripCan = held === 'can';   // (--fit: held things drawn in the hand, as the page draws Sam's under kit handling — rigProps GRIPFIT)
    if (a.grip) a.grip[1] = held === 'can' || held === 'torch';   // (the hand pass's input — combat.ts handProps deals it for Sam's canister, game.ts for whatever a guard has in his hand; a tree without the pass has no such field)
  },
};
for (let i = 0; i < 30; i++) c.update(DT);
sit.go(x); if (flag('--at')) x.run(+flag('--at')!);
c.pos = [0, 0, 0]; c.update(0);   // re-baked at the origin (a walk carried him off it): the renderer's cameras are placed about the origin

// ---- the mesh he wears, skinned at this pose, coloured by slot
const P = skinVertices(mesh.positions, mesh.joints, mesh.weights, c.skel.jointData), I = mesh.indices as Uint32Array | Uint16Array, part = mesh.part as Uint8Array;
const sd = CM.charSlots(ch); const SLOTN: string[] = [...CM.CHAR_SLOTS];
const side = sideOfTeam(S.team, S.trained);
const pal = new Float32Array(CM.CHAR_MAT_FLOATS); CM.writeCharPalette(pal, 0, side, S.tint, S.tint2, id, !sd.authored);
const worn = (v: number) => ((variant.mask >>> part[v]) & 1) === 1;
const remap = new Int32Array(mesh.vertexCount).fill(-1); const verts: number[] = [], cols: number[] = [], faces: number[] = [];
const srgb = (l: number) => Math.round(255 * Math.min(1, Math.max(0, l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055)));
for (let t = 0; t < I.length; t += 3) {
  const tri = [I[t], I[t + 1], I[t + 2]]; if (!tri.every(worn)) continue;
  for (const v of tri) {
    if (remap[v] < 0) { remap[v] = verts.length / 3; verts.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); const s = Math.min(sd.slot[v], 10), p = 8 + s * 8; cols.push(srgb(pal[p]), srgb(pal[p + 1]), srgb(pal[p + 2]), s); }
    faces.push(remap[v]);
  }
}
const bodyVerts = verts.length / 3, bodyTris = faces.length / 3;

// ---- the props the game draws on him in this situation (rigProps' boxes): gun, torch, holster, canister
let propBoxes = 0; const notes: string[] = [];
if (!has('--no-props')) {
  try {
    const out: any[] = [];
    if (variant.side === 'operator') RP.rigBoxes(c, { goggles: c.anim.nvShown !== undefined, nv: false, ...(c.anim.nvShown !== undefined ? { nvK: c.anim.nvShown } : null), slot: held === 'pistol' ? 1 : 0, lightOn: false, isGuard: false, holster: held !== 'pistol', held: held === 'can' ? 'smoke' : null, rifle: held === 'rifle' ? 'hand' : null, ...(has('--fit') || (inhand && held !== 'rifle') ? { fit: true } : null), ...(inhand ? { inHand: true } : null) }, out);
    else if (variant.side === 'civilian') { if (c.anim.bound === 1) RP.wristTieBoxes?.(c, out); }   // (empty hands, nothing worn — but a bound hostage's wrist tie, combat.ts handProps)
    else if (held === 'rifle' || held === 'pistol' || held === 'torch') RP.rigBoxes(c, { goggles: false, nv: false, slot: 1, lightOn: false, isGuard: true, torch: held === 'torch', ...(inhand && held === 'torch' ? { beamDir: [0, 0, 1] } : null), weapon: held === 'rifle' ? 'carbine' : 'pistol', ...(inhand && held === 'pistol' ? { inHand: true } : null) }, out);
    else RP.holsterBoxes(c, out, { slide: RP.RIG.guardPistol.slide, grip: RP.RIG.guardPistol.grip });
    if (c.anim.throwOff && c.anim.throwing) RP.freeCanBoxes?.(c, 'frag', out);   // (a throw off the free hand: the grenade in that fist, as combat.ts guardKit draws it)
    for (const b of out) {
      const q: number[] = b.rot ?? [0, Math.sin(b.yaw / 2), 0, Math.cos(b.yaw / 2)], [qx, qy, qz, qw] = q;
      const rot = (v: V3): V3 => { const tx = 2 * (qy * v[2] - qz * v[1]), ty = 2 * (qz * v[0] - qx * v[2]), tz = 2 * (qx * v[1] - qy * v[0]); return [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx]; };
      const base = verts.length / 3; const lum = Math.max(b.albedo[0], b.albedo[1], b.albedo[2]) < 0.02 ? 0.035 : 0;   // (a near-black gun is lifted a shade so its edges read against a dark glove)
      for (let k = 0; k < 8; k++) { const l: V3 = [(k & 1 ? 1 : -1) * b.h[0], (k & 2 ? 1 : -1) * b.h[1], (k & 4 ? 1 : -1) * b.h[2]], w = rot(l); verts.push(b.c[0] + w[0], b.c[1] + w[1], b.c[2] + w[2]); cols.push(srgb(b.albedo[0] + lum), srgb(b.albedo[1] + lum), srgb(b.albedo[2] + lum), 15); }
      for (const f of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) faces.push(base + f[0], base + f[1], base + f[2], base + f[0], base + f[2], base + f[3]);
      propBoxes++;
    }
  } catch (e) { notes.push(`props not drawn: ${String(e).slice(0, 200)}`); }
}

// ---- write: binary PLY + the JSON the renderer frames by
const nV = verts.length / 3, nF = faces.length / 3;
const head = `ply\nformat binary_little_endian 1.0\ncomment twopointsix pose-mesh ${variant.name} ${pos[1]}\nelement vertex ${nV}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nproperty uchar slot\nelement face ${nF}\nproperty list uchar int vertex_indices\nend_header\n`;
const hb = new TextEncoder().encode(head), buf = new ArrayBuffer(hb.length + nV * 16 + nF * 13), dv = new DataView(buf); new Uint8Array(buf).set(hb, 0);
let o = hb.length;
for (let i = 0; i < nV; i++) { dv.setFloat32(o, verts[i * 3], true); dv.setFloat32(o + 4, verts[i * 3 + 1], true); dv.setFloat32(o + 8, verts[i * 3 + 2], true); dv.setUint8(o + 12, cols[i * 4]); dv.setUint8(o + 13, cols[i * 4 + 1]); dv.setUint8(o + 14, cols[i * 4 + 2]); dv.setUint8(o + 15, cols[i * 4 + 3]); o += 16; }
for (let i = 0; i < nF; i++) { dv.setUint8(o, 3); dv.setInt32(o + 1, faces[i * 3], true); dv.setInt32(o + 5, faces[i * 3 + 1], true); dv.setInt32(o + 9, faces[i * 3 + 2], true); o += 13; }
const outDir = resolve(flag('--out') || './pose-mesh-out'); mkdirSync(outDir, { recursive: true });
const tag = flag('--tag'); const stem = `${variant.name}__${pos[1]}${movesOn ? '' : '__movesoff'}${tag ? `__${tag}` : ''}`;
writeFileSync(`${outDir}/${stem}.ply`, new Uint8Array(buf));
const np = (name: string): V3 | null => { const i = ch.nodeByName.get(name); if (i === undefined) return null; const p = c.skel.nodePos(i); return [p[0], p[1], p[2]]; };
const hand = (s: 'L' | 'R') => ({ wrist: np(`DEF-hand.${s}`), index1: np(`DEF-f_index.01.${s}`), middle1: np(`DEF-f_middle.01.${s}`), pinky1: np(`DEF-f_pinky.01.${s}`),
  tips: ['f_index', 'f_middle', 'f_ring', 'f_pinky', 'thumb'].map(f => np(`DEF-${f}.03.${s}`)) });
let commit = ''; try { commit = execSync(`git -C "${ROOT}" rev-parse --short HEAD`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a checkout */ }
writeFileSync(`${outDir}/${stem}.json`, JSON.stringify({ variant: variant.name, side: variant.side, parts: variant.parts, situation: pos[1], says: sit.say, id, moves: movesOn, tag: tag ?? '', held, repo: ROOT, commit,
  slots: SLOTN, bodyVerts, bodyTris, propBoxes, notes, joints: { head: np('DEF-head'), hips: np('DEF-hips'), chest: np('DEF-spine.003'), footL: np('DEF-foot.L'), footR: np('DEF-foot.R') }, hands: { L: hand('L'), R: hand('R') } }, null, 1));
console.log(`pose-mesh: ${variant.name} (${variant.side}, id ${id}) · ${pos[1]} — ${sit.say} · moves ${movesOn ? 'on' : 'off'} · ${bodyTris} tris worn + ${propBoxes} prop boxes @ ${commit}\n  ${outDir}/${stem}.ply`);
for (const n of notes) console.log('  NOTE ' + n);
