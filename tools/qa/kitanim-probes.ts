// KIT ANIMATIONS (game/kitanim.ts KITANIM.on; character.ts KIT; rigProps KitDraw) — Sam's hands carry his kit to where it lives and back, magazine changes differ
// by the gun's state, and the close-in carriage goes by distance. `bun run tools/qa/probes.ts kitanim` (or this file alone, optionally with probe names).
//   kitanim-off       switch OFF: nothing is dealt (kitHold undefined, closeK −1, no errand, on every frame of draws, a reload, swaps AND a walk-up on a parked man's
//                     back with the close-in mode on — the mode must really take, or the probe is red), the pistol has no lock-out and the rifle the build's
//                     0.45 s, a reload runs on the weapon row's own beat
//   kitanim-equip     switch ON, every change of what is in the fist: pistol out of the holster and back, rifle off the back and onto it, rifle ↔ pistol, gun ↔ can,
//                     the next can after a throw. What the hand holds goes  old … nothing … new  in that order; a gun fires nothing until it is up (a click a frame
//                     through the draw: no round before the lock-out ends, one after — and on that frame the hand holds the gun or no errand runs) and the
//                     lock-out is the swap's own length; no wrist moves more than HAND_STEP a frame; and the gun that is the SUBJECT of the change is CARRIED,
//                     measured on ITS OWN boxes (the pistol's slide, found by shape; the rifle's, by tag): it starts and ends where it should (holster / fist,
//                     back / hands — read against where rigProps would draw it on the same pose), its body's step, the change of that step and its step on
//                     the frame it leaves or reaches where it lives are bounded (PROP_STEP / PROP_JOLT / PROP_LEAP: a jump between hand and holster or back
//                     is red), the other gun never leaves its place, a can is drawn at the wrist
//   kitanim-midswap   a change asked for in the middle of another: what the hand actually has goes away first, the thing asked back for comes up from where the hand
//                     is, locked for no longer than THAT errand takes and fireable within 3 frames of its end; and a quick throw mid-change really throws (a can
//                     leaves, the errand was still running) and drops the errand within a frame
//   kitanim-reload    pistol and rifle × EMPTY / DRY / TACTICAL: the kind is read off the gun (rounds left + one up = tactical, nothing up = empty, a round up over a
//                     dry magazine = dry), the weapon's beat is that kind's (tactical the longest, dry the shortest, no slide / handle unless empty), the books
//                     (the build's own, untouched: a part magazine goes back among the spares, an empty one is dropped), a magazine is shown in the support hand both ways on a
//                     tactical change and once otherwise — as the animator says AND AS DRAWN: the box count against the count before R (+1 with a magazine in
//                     the support hand, the rifle's own magazine box gone while it is out of the well), the hand's magazine box at the wrist, in one stretch
//                     (two on a tactical change) —, the hand goes by the hip (the dump pouch) only on a tactical change, nothing jumps, and the support hand
//                     does not snap round its wrist as the change ends (knuckle about wrist, the last quarter second and the half second after)
//   kitanim-close     closer than ever by distance (CLOSE.on): walking in on a man's back the closeness is kitCloseness() of the distance to his chest (finite,
//                     strictly inside 0‥1 at every distance tried), it rises with every step, the pelvis sinks with it, the knife hand (its mean place over the
//                     still stretch) closes on the hilt with it — and stood still each wrist travels further than on the same stand with the switch off; the
//                     knife stays in its sheath. Switch off: one carriage at every distance, as it was
//   kitanim-edges     the errand cut short or asked the awkward thing: (a) a draw called off with the hand still empty — no wrist jumps; (b) Sam put down
//                     mid-change — no errand on him, one pistol in the world, no rifle in dead hands; (c) off a wall with the pistol — never in the fist before
//                     it is drawn; (d) R mid-draw — no reload until the gun is up; (e) a can asked for mid-reload — the change is called off within the frame;
//                     (f) canSave refuses mid-change and only then; (g) can for can — the kind shown changes only in the empty hand; (h) rounds in the
//                     magazine and nothing chambered (a sprint cut an empty change short) — the tactical change with the slide on its end, the books whole;
//                     (i) KIT.swapK 1.5 — the lock-out never past kitLockMax(KIT)
//   kitanim-harness   the frozen stand holds the switch off, the page turns it on unless ?nokitanim, the tables are registered knob tables; a seeded run with the
//                     switch on digests the same twice
// THE HARNESS HAS NO GPU: the picture is not measured here (tools/qa/kitanim-strip.ts draws it as stick figures with the props) — what is measured is what kitanim.ts
// tells the animator, what the animator reports back (kitHold / kitStow, reloadShow, the bones), the props' BOXES as combat.ts handProps makes them (which, where,
// how many) and the game's own books. Every switch and table a probe writes (KITANIM, KIT, MOVES.on, CLOSE.on, Math.random) is put back by keep(); KITANIM_STATS /
// KITANIM_LOG are the process's: no probe reads their totals — only whether the counters moved over its own run, and the log's newest row by identity.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const { KITANIM, KITANIM_STATS, KITANIM_LOG, kitInHand, kitLockMax, kitCloseness, kitSlingFront, kitSlingRest } = await import(`${ROOT}/src/game/kitanim.ts`);
const { MOVES, KIT } = await import(`${ROOT}/src/game/character.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`);
const { handProps, hitPlayer } = await import(`${ROOT}/src/game/combat.ts`);
const { RIG, SC20K_TAG, rigBoxes } = await import(`${ROOT}/src/game/rigProps.ts`);
const { canSave } = await import(`${ROOT}/src/game/savestate.ts`);
const { RIFLE_EQUIP_SECS } = await import(`${ROOT}/src/game/player.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
type Vec3 = [number, number, number];
const DT = 1 / 60, f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3), cm = (x: number) => (x * 100).toFixed(1) + ' cm';
/** m a frame: a wrist (5.7 m/s — a fast hand; the build's own throw is 11 m/s) · a gun's body while it is carried: the CENTRE of the pistol's slide box / the centroid of
 *  the rifle's boxes, as STEP (measured on the build: the pistol 13.7 cm coming round out of the holster — its body is 12 cm off a wrist that is turning —, the rifle
 *  9.1 cm), as JOLT = the change of that step between two frames (measured 14.4 cm: the pistol's path turns a corner as it leaves the holster's frame) and as LEAP =
 *  its step on the frame it leaves or reaches where it lives (measured 5.1 cm; from the holster to a raised fist is 60 cm, from his back to his hands 30) · the knuckle about its wrist (the hand's own turn: the middle knuckle is 9 cm off the wrist, so 5 cm is a third of a radian in a frame) */
const HAND_STEP = 0.095, PROP_STEP = 0.16, PROP_JOLT = 0.17, PROP_LEAP = 0.07, TURN_STEP = 0.05;
/** m a frame: a rifle hanging on its sling, against the chest it hangs from (measured: 6.4 cm standing up out of a crouch into a sprint, 4.4 in a crouched walk; the
 *  one across his back 3.5 in the same run; before its swing onto the thighs was eased, 12 to 17) */
const SLING_STEP = 0.08;
/** his props by SHAPE (rigProps lays every part as a box of half-extents [thick, tall, half length]): the pistol's slide — the gun's body, one on him wherever the
 *  pistol is, hand or thigh —, a magazine in the support hand (rigProps magBoxL), the body of a can in the fist */
const SLIDE_H: Vec3 = [RIG.pistol.slide.thick, RIG.pistol.slide.tall, (RIG.pistol.slide.l1 - RIG.pistol.slide.l0) / 2], MAG_H: Record<string, Vec3> = { pistol: [0.008, 0.055, 0.016], rifle: [0.012, 0.085, 0.03] };
const CAN_H: Vec3 = [RIG.can.body.thick, RIG.can.body.tall, (RIG.can.body.l1 - RIG.can.body.l0) / 2];
const shaped = (b: any, h: Vec3) => !b.name && Math.abs(b.h[0] - h[0]) < 2e-4 && Math.abs(b.h[1] - h[1]) < 2e-4 && Math.abs(b.h[2] - h[2]) < 2e-4;
const mid = (bs: any[]): Vec3 => { const m: Vec3 = [0, 0, 0]; for (const b of bs) { m[0] += b.c[0] / bs.length; m[1] += b.c[1] / bs.length; m[2] += b.c[2] / bs.length; } return m; };
let allPass = true;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
/** the newest row of what kitanim.ts has played (compared by identity: the log is a ring, and the whole process's — no probe reads its length or the counters' totals) */
const logEnd = () => KITANIM_LOG[KITANIM_LOG.length - 1];
const bad = (fails: string[]) => fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : '';
function putBack(T: any, was: any) { for (const k of Object.keys(was)) { if (was[k] && typeof was[k] === 'object' && !Array.isArray(was[k])) putBack(T[k], was[k]); else T[k] = was[k]; } }
/** every switch this file sets put back as it was found, whatever the probe did */
/** the middle of a can in the fist is this far from the wrist joint at the most (the fist's hollow is ~11 cm along the hand: rigProps GRIPFIT.can) */
const CAN_IN_FIST = 0.14;
async function keep<T>(fn: () => Promise<T>): Promise<T> {
  const was = { K: JSON.parse(JSON.stringify(KITANIM)), T: JSON.parse(JSON.stringify(KIT)), M: MOVES.on, C: CLOSE.on }, rnd = Math.random;
  try { return await fn(); } finally { putBack(KITANIM, was.K); putBack(KIT, was.T); MOVES.on = was.M; CLOSE.on = was.C; Math.random = rnd; }
}

/** Sam alone on the lobby's open floor facing +z (`cursor` = where he aims: a probe that moves him moves it), the shift parked on the lot, nobody perceiving; MOVES as the page ships it (the hands' magazine change is its layer) */
export async function world(on: boolean, seed = 31) {
  Math.random = mulberry32(seed);
  const W: any = await standUp(); const g = W.game, input = W.input;
  KITANIM.on = on; MOVES.on = 1;
  // other parts' rules that change what a KEY does — a dry gun reloading itself, G thrown away in the page — are held at the frozen stand's values, so on any stand these
  // checks ask about the hands alone (R is the player's, G quick-throws). Guarded: the same file runs in a checkout that has neither table. Put back by the runner.
  for (const [f, k, v] of [['autoreload', 'RELOAD', { auto: false }], ['quickthrow', 'QUICKTHROW', { on: true }]] as const) { const m: any = await import(`../../src/game/${f}.ts`).catch(() => null); if (m?.[k]) Object.assign(m[k], v); }
  g.playerInvisible = true; g.godMode = true; g.aiEnabled = false; W.cam.yaw = 0; W.cam.rebuild();
  for (let i = 0; i < 5; i++) W.step(DT);
  g.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.char.pos = [38.5, 0, 1.5 + i * 1.2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.update(0); });
  const pl = g.player, c = pl.char, an = c.anim;
  g.teleportPlayer([10, 0, 19]); c.bodyYaw = c.aimYaw = 0; const cursor: Vec3 = [10, 1.2, 45];   // (the lobby's open floor, six metres of room in front, the cursor far out so his aim is near level — on the floor close by, every round snaps the gun a hand down onto its line: at a wall the guns-at-walls rule — on in the page — keeps his gun down and nothing here could fire)
  const rel = (p: ArrayLike<number>): Vec3 => [p[0] - c.pos[0], p[1] - c.pos[1], p[2] - c.pos[2]];
  /** his own props this frame */
  const props = () => { const out: any[] = []; handProps(g, out); return out.filter((b: any) => (b.owner & 0xff) === (c.id & 0xff)); };
  /** WHERE HIS KIT IS DRAWN this frame, read off the boxes: the pistol's slide(s) and whether it hangs in the holster (within 2 cm of where rigProps hangs a holstered
   *  one on this pose) or lies in the fist's frame (within 2 cm of a drawn one's) — neither = on its way —, the rifle's boxes (SC20K_TAG) and which of the two places
   *  they are in, a magazine in the support hand, the can in the fist */
  const kit = (mine = props()) => {
    const slides = mine.filter((b: any) => shaped(b, SLIDE_H)), rb = mine.filter((b: any) => b.name === SC20K_TAG), ref = (o: any) => { const out: any[] = []; rigBoxes(c, { isGuard: false, slot: 0, goggles: false, ...(KITANIM.on && KITANIM.grips ? { fit: true } : null), ...(kitSlingFront(g) ? { slingFront: true, slingRest: kitSlingRest(g) } : null), ...o }, out); return out; };   // (as the page draws him: held things in the hand — rigProps GRIPFIT)
    const sl: Vec3 | null = slides.length ? slides[0].c : null, rc: Vec3 | null = rb.length ? mid(rb) : null; let pistol: 'holster' | 'hand' | 'between' | null = null, rifle: 'hand' | 'slung' | 'between' | null = null;
    if (sl) { const h = ref({ holster: true }).find((b: any) => shaped(b, SLIDE_H)), u = c.bones.handR ? ref({ slot: 1 }).find((b: any) => shaped(b, SLIDE_H)) : null; pistol = h && v3.len(v3.sub(sl, h.c)) < 0.02 ? 'holster' : u && v3.len(v3.sub(sl, u.c)) < 0.02 ? 'hand' : 'between'; }
    if (rc) { const at = (w: string) => { const r = ref({ rifle: w }).filter((b: any) => b.name === SC20K_TAG); return r.length ? mid(r) : null; }, a = at('slung'), b = at('hand'); rifle = a && v3.len(v3.sub(rc, a)) < 0.02 ? 'slung' : b && v3.len(v3.sub(rc, b)) < 0.02 ? 'hand' : 'between'; }
    const mag = mine.find((b: any) => shaped(b, MAG_H.pistol) || shaped(b, MAG_H.rifle)), can = mine.find((b: any) => shaped(b, CAN_H));
    return { n: mine.length, slides: slides.length, sl, pistol, nRifle: rb.length, rc, rifle, mag: mag ? { kind: shaped(mag, MAG_H.rifle) ? 'rifle' : 'pistol', off: c.bones.handL ? v3.len(v3.sub(mag.c, c.bones.handL)) : 9 } : null, can: can ? { tint: can.albedo.map((x: number) => x.toFixed(3)).join(), off: v3.len(v3.sub(can.c, c.bones.handR)) } : null };
  };
  /** most in one frame: both wrists, the PISTOL's body and the RIFLE's (each tracked by its own boxes: T.prop = the larger; `jolt` = the most its step CHANGED from
   *  one frame to the next — a carried gun speeds up and slows down, a gun that changes places does it in one frame; `leap` = its step on the frame it LEFT or
   *  REACHED the place it lives, thigh or back: a carried gun eases out of it and into it; `places` = every place each was drawn in), each hand's knuckle about its
   *  wrist (`trail` = the support hand's, frame by frame);
   *  boxes drawn; what the hand held in order; a magazine in the support hand / out of the gun as the ANIMATOR says (magL / noMag) and as DRAWN (magDrawn, in `magRuns`
   *  separate stretches, at most `magOff` from the wrist; `drawBad` = frames on which the drawn boxes are not the animator's word: counted only once `count0` is set) */
  const T = { hand: 0, handL: 0, prop: 0, pistol: 0, rifle: 0, jolt: { pistol: 0, rifle: 0 }, leap: { pistol: 0, rifle: 0 }, places: { pistol: new Set<string>(), rifle: new Set<string>() }, trail: [] as number[], turnL: 0, turnR: 0, nan: 0, holds: [] as string[], frames: 0, minLz: 9, magL: 0, noMag: 0, magDrawn: 0, magRuns: 0, magOff: 0, drawBad: 0, drawWhy: '', count0: null as null | { n: number; nRifle: number; long: boolean }, canOff: 0 };
  let pr: Vec3 | null = null, pL: Vec3 | null = null, pp: Vec3 | null = null, pf: Vec3 | null = null, vp: Vec3 | null = null, vf: Vec3 | null = null, cp: string | null = null, cf: string | null = null, kL: Vec3 | null = null, kR: Vec3 | null = null, lastHold = '', magWas = false;
  const reset = () => { T.jolt.pistol = T.jolt.rifle = T.leap.pistol = T.leap.rifle = 0; T.places.pistol.clear(); T.places.rifle.clear(); T.trail = []; T.hand = T.handL = T.prop = T.pistol = T.rifle = T.turnL = T.turnR = T.nan = 0; T.holds = []; T.frames = 0; T.minLz = 9; T.magL = T.noMag = T.magDrawn = T.magRuns = T.magOff = T.drawBad = T.canOff = 0; T.drawWhy = ''; T.count0 = null; lastHold = ''; magWas = false; };
  const step = (n = 1, each?: (f: number, k: ReturnType<typeof kit>) => void) => { for (let f = 0; f < n; f++) { W.cursorAt(cursor); W.step(DT);
    const hr = rel(c.bones.handR), hl = rel(c.bones.handL), mine = props(), k = kit(mine), sl = k.sl ? rel(k.sl) : null, rc = k.rc ? rel(k.rc) : null;
    const tl: Vec3 = v3.sub(c.bones.fingerL, c.bones.handL), tr: Vec3 = v3.sub(c.bones.fingerR, c.bones.handR);
    for (const b of mine) if (!b.c.every(Number.isFinite) || !b.h.every(Number.isFinite)) T.nan++;
    if (![...hr, ...hl, ...tl, ...tr].every(Number.isFinite)) T.nan++;
    if (pr) { T.hand = Math.max(T.hand, v3.len(v3.sub(hr, pr))); T.handL = Math.max(T.handL, v3.len(v3.sub(hl, pL!))); T.turnL = Math.max(T.turnL, v3.len(v3.sub(tl, kL!))); T.trail.push(v3.len(v3.sub(tl, kL!))); T.turnR = Math.max(T.turnR, v3.len(v3.sub(tr, kR!)));
      const dp: Vec3 | null = sl && pp ? v3.sub(sl, pp) : null, df: Vec3 | null = rc && pf ? v3.sub(rc, pf) : null;
      if (dp) { T.pistol = Math.max(T.pistol, v3.len(dp)); if (vp) T.jolt.pistol = Math.max(T.jolt.pistol, v3.len(v3.sub(dp, vp))); } if (df) { T.rifle = Math.max(T.rifle, v3.len(df)); if (vf) T.jolt.rifle = Math.max(T.jolt.rifle, v3.len(v3.sub(df, vf))); }
      if (dp && cp !== k.pistol && (cp === 'holster' || k.pistol === 'holster')) T.leap.pistol = Math.max(T.leap.pistol, v3.len(dp)); if (df && cf !== k.rifle && (cf === 'slung' || k.rifle === 'slung')) T.leap.rifle = Math.max(T.leap.rifle, v3.len(df));
      vp = dp; vf = df; T.prop = Math.max(T.pistol, T.rifle); }
    cp = k.pistol; cf = k.rifle; T.places.pistol.add(String(cp)); T.places.rifle.add(String(cf));
    pr = hr; pL = hl; pp = sl; pf = rc; kL = tl; kR = tr; T.frames++; T.minLz = Math.min(T.minLz, hl[2] - rel(c.bones.hips)[2]);
    const sh = an.reloadShow; if (sh?.hand) T.magL++; if (sh?.out) T.noMag++;
    if (k.mag) { T.magDrawn++; T.magOff = Math.max(T.magOff, k.mag.off); if (!magWas) T.magRuns++; } magWas = !!k.mag; if (k.can) T.canOff = Math.max(T.canOff, k.can.off);
    if (T.count0) { const C = T.count0, wantN = C.n + (sh?.hand ? 1 : 0) - (C.long && sh?.out ? 1 : 0), wantR = C.nRifle - (C.long && sh?.out ? 1 : 0);
      if (k.n !== wantN || k.nRifle !== wantR || !!k.mag !== !!sh?.hand || (k.mag && k.mag.kind !== (C.long ? 'rifle' : 'pistol'))) { T.drawBad++; T.drawWhy ||= `frame ${T.frames}: ${k.n} boxes (want ${wantN}), ${k.nRifle} of the rifle's (want ${wantR}), ${k.mag ? 'a ' + k.mag.kind + ' magazine' : 'no magazine'} in the hand with reloadShow ${JSON.stringify(sh)}`; } }
    const h = String(an.kitHold); if (h !== lastHold) { T.holds.push(h); lastHold = h; }
    each?.(f, k); } };
  const tap = (k: string) => input.pressed.add(k), click = () => { input.clicked |= 1; };
  const rounds = (gun: any) => (gun.mag ?? 0) + gun.chamber;
  /** until nothing is being changed (≤ n frames) → frames taken */
  const settle = (n = 240) => { let f = 0; for (; f < n; f++) { step(); if (!an.kitBusy && an.kitHold === undefined && pl.equipT <= 0) break; } return f + 1; };
  return { W, g, input, pl, c, an, cursor, step, tap, click, rounds, settle, T, reset, props, kit, rel };
}
type Wd = Awaited<ReturnType<typeof world>>;
/** the pistol up and settled / the rifle in the hands and settled, by the keys */
function toPistol(S: Wd) { if (S.pl.slot !== 'pistol') S.tap('Digit1'); else if (S.pl.holstered) S.tap('KeyE'); S.step(1); S.settle(); S.step(20); }
function toRifle(S: Wd) { if (S.pl.slot !== 'rifle') S.tap('Digit2'); else if (S.pl.holstered) S.tap('KeyE'); S.step(1); S.settle(); S.step(20); }

export async function kitOff(): Promise<boolean> { return keep(async () => {
  console.log('\n=== kitanim-off: with the switch off nothing is dealt — no errand, no lock-out but the build\'s, the weapon rows\' own reloads ===');
  allPass = true; const S = await world(false), { pl, an, T } = S, fails: string[] = []; const s0 = JSON.stringify(KITANIM_STATS);
  let dealt = 0, eqPistol = 0, eqRifle = 0; const seen = (f: number) => { if (an.kitHold !== undefined || an.closeK !== -1 || an.kitBusy || pl.kitWas !== undefined) dealt++; };
  S.step(20, seen); S.tap('KeyE'); S.step(1, seen); eqPistol = pl.equipT; S.step(40, seen);
  S.click(); S.step(20, seen); const p = pl.pistol, before = [p.mag, JSON.stringify(p.spare)];
  S.tap('KeyR'); S.step(1, seen); const row = p.reloadRow; S.step(130, seen);
  if (row.dur !== p.def.reload.dur || row.out !== p.def.reload.out) fails.push(`the pistol's reload ran on ${JSON.stringify(row)}, not its row ${JSON.stringify(p.def.reload)}`);
  S.tap('Digit2'); S.step(1, seen); eqRifle = pl.equipT; S.step(60, seen); S.tap('Digit3'); S.step(60, seen); S.tap('Digit1'); S.step(60, seen);
  // the walk-up: the close-in mode ON (close.ts), a man parked with his back to Sam four metres down the corridor, Sam walks in on him — the mode takes (anim.creep) and
  // with this switch off no closeness is dealt on any frame of it
  CLOSE.on = true; const A = S.g.guards[0], c = S.c; A.char.pos = [c.pos[0] + 4, 0, c.pos[2]]; A.char.vel = [0, 0, 0]; A.char.bodyYaw = A.char.aimYaw = Math.PI / 2; A.char.update(0); A.char.update(DT);
  S.tap('KeyE'); S.step(30, seen); let crept = 0, walked = 0, nearest = 9; const x0 = c.pos[0]; S.input.keys.add('KeyD');   // (the camera looks down −z here: D is +x, along the corridor)
  for (let f = 0; f < 420; f++) { pl.visibility = 0.02; S.step(1, seen); pl.visibility = 0.02; if (an.creep) crept++; const d = Math.hypot(A.char.pos[0] - c.pos[0], A.char.pos[2] - c.pos[2]); nearest = Math.min(nearest, d); if (d < 1.25) S.input.keys.delete('KeyD'); if (d < 1.25 && ++walked > 45) break; }
  S.input.keys.delete('KeyD');
  if (!(crept > 30)) fails.push(`the walk-up never put him in the close-in mode (${crept} frames of anim.creep, nearest ${f2(nearest)} m, walked ${f2(c.pos[0] - x0)} m): nothing was asked of the switch`);
  if (dealt) fails.push(`${dealt} frames with something dealt (kitHold / closeK / kitBusy / kitWas)`);
  if (eqPistol !== 0) fails.push(`the pistol's draw locked fire for ${f3(eqPistol)} s`); if (Math.abs(eqRifle - (RIFLE_EQUIP_SECS - DT)) > 0.02 && Math.abs(eqRifle - RIFLE_EQUIP_SECS) > 0.02) fails.push(`the rifle's lock-out is ${f3(eqRifle)} s (the build's is ${RIFLE_EQUIP_SECS})`);
  if (JSON.stringify(KITANIM_STATS) !== s0) fails.push('KITANIM_STATS moved'); if (T.nan) fails.push(`${T.nan} non-finite`);
  verdict(!fails.length, 'OFF: draws, a reload, three swaps and a walk-up on a man\'s back in the close-in mode deal nothing (closeK −1 on every frame); the kit is where the slot says on the key\'s frame', `frames ${T.frames} · the walk-up: ${f2(c.pos[0] - x0)} m to ${f2(nearest)} m of him, ${crept} frames in the mode · pistol lock-out ${f3(eqPistol)} s · rifle ${f3(eqRifle)} s · reload row ${JSON.stringify(row)} · spares ${before[1]} → ${JSON.stringify(p.spare)}${bad(fails)}`);
  return allPass;
}); }

export async function kitEquip(): Promise<boolean> { return keep(async () => {
  console.log('\n=== kitanim-equip: every change of what is in the fist is carried, in order, and a gun fires only once it is up ===');
  allPass = true; const S = await world(true), { pl, an, T } = S;
  S.step(30);
  /** one change: press, run it out; the order of what the hand held, the lock-out, the steps */
  const change = (label: string, key: string, want: string[], gun: 'pistol' | 'rifle' | null, eqWant: number | null) => {
    S.reset(); const from = kitInHand(S.g), l0 = logEnd(), at0 = S.kit(); S.tap(key); S.step(1); const eq0 = pl.equipT; let fired = -1, firedHold: unknown = 'none';
    const G = gun === 'pistol' ? pl.pistol : gun === 'rifle' ? pl.rifle : null, r0 = G ? S.rounds(G) : 0;
    let f = 1; for (; f < 240; f++) { if (G && fired < 0) { S.click(); } S.step(1); if (G && fired < 0 && S.rounds(G) < r0) { fired = f; firedHold = an.kitHold; } if (!an.kitBusy && an.kitHold === undefined && (!G || fired >= 0)) break; }
    S.step(25); const to = kitInHand(S.g), fails: string[] = [], row = logEnd(), at1 = S.kit();
    // the subject of the change, by its OWN boxes: the pistol's slide where the pistol leaves or comes, the rifle's where the rifle does — and each must really have
    // changed places over it (holster ↔ hand, back ↔ hands), or the step measured nothing
    const subj: ('pistol' | 'rifle')[] = (['pistol', 'rifle'] as const).filter(w => from === w || to === w);
    for (const w of subj) { const d = T[w], a = at0[w], b = at1[w], wantA = from === w ? 'hand' : w === 'pistol' ? 'holster' : 'slung', wantB = to === w ? 'hand' : w === 'pistol' ? 'holster' : 'slung';
      if (a !== wantA || b !== wantB) fails.push(`the ${w} is drawn ${a} before and ${b} after (want ${wantA} → ${wantB})`);
      if (d > PROP_STEP) fails.push(`the ${w}'s body moved ${cm(d)} in one frame (bound ${cm(PROP_STEP)}: it is carried, not moved)`); if (T.jolt[w] > PROP_JOLT) fails.push(`the ${w}'s body changed its step by ${cm(T.jolt[w])} between two frames (bound ${cm(PROP_JOLT)}: a jump)`); if (T.leap[w] > PROP_LEAP) fails.push(`the ${w} left or reached ${w === 'pistol' ? 'the holster' : 'his back'} with a step of ${cm(T.leap[w])} (bound ${cm(PROP_LEAP)}: it eases out of where it lives and into it)`); if (!(d > 0.01)) fails.push(`the ${w}'s body moved only ${cm(d)} in any frame of a change that carries it between two places`); }
    for (const w of ['pistol', 'rifle'] as const) if (!subj.includes(w) && [...T.places[w]].join() !== (w === 'pistol' ? 'holster' : 'slung')) fails.push(`the ${w} is no part of this change and was drawn [${[...T.places[w]].join(', ')}] over it`);
    if (at0.slides !== 1 || at1.slides !== 1) fails.push(`${at0.slides} → ${at1.slides} pistols drawn on him`);
    if ((from === 'can' || to === 'can') && !(T.canOff > 0 && T.canOff < CAN_IN_FIST)) fails.push(`the can is drawn ${cm(T.canOff)} from the wrist at the most (it is in the fist or it is not drawn)`);
    if (T.turnR > 2 * TURN_STEP || T.turnL > 2 * TURN_STEP) fails.push(`a hand turned about its wrist by ${cm(T.turnR)} (right) / ${cm(T.turnL)} (left) at the knuckle in one frame`);
    if (G && fired >= 0 && firedHold !== undefined && firedHold !== gun) fails.push(`on the frame the first round left the hand held ${firedHold}, not the ${gun}`);
    const holds = T.holds.filter(h => h !== 'undefined');
    if (holds.join(' ') !== want.join(' ')) fails.push(`the hand held [${holds.join(' ')}], want [${want.join(' ')}]`);
    if (T.hand > HAND_STEP) fails.push(`a wrist moved ${cm(T.hand)} in one frame`); if (T.handL > HAND_STEP + 0.02) fails.push(`the support wrist moved ${cm(T.handL)} in one frame`);
    if (T.nan) fails.push(`${T.nan} non-finite`);
    if (G) { const lockF = Math.round(eq0 / DT); if (fired < lockF - 1) fails.push(`a round left the ${gun} ${fired} frames in, ${f3(eq0)} s (${lockF} frames) of lock-out dealt`); if (fired < 0 || fired > lockF + 4) fails.push(`no round within 4 frames of the lock-out's end (first at ${fired}, lock-out ${lockF} frames)`); }
    if (eqWant !== null && Math.abs(eq0 - eqWant) > 0.03) fails.push(`lock-out ${f3(eq0)} s, want ${f3(eqWant)}`);
    if (row === l0 && want.length) fails.push('no swap logged');
    verdict(!fails.length, `${label}: ${from ?? 'nothing'} → ${to ?? 'nothing'}`, `held [${holds.join(' → ')}] over ${f} frames${row ? ` (${f2(row.secs)} s)` : ''} · lock-out ${f3(eq0)} s${G ? `, first round at frame ${fired} with the hand holding ${firedHold === undefined ? 'it, no errand' : firedHold}` : ''} · most in a frame: wrist ${cm(T.hand)}, support wrist ${cm(T.handL)}, the pistol's body ${cm(T.pistol)} (step change ${cm(T.jolt.pistol)}, ${cm(T.leap.pistol)} at the holster's edge), the rifle's ${cm(T.rifle)} (${cm(T.jolt.rifle)}, ${cm(T.leap.rifle)} at his back), knuckles about the wrists ${cm(T.turnR)} / ${cm(T.turnL)}${bad(fails)}`);
  };
  const q = KIT.swapK, e = KITANIM.early;
  change('E, the pistol out of the holster', 'KeyE', ['null', 'pistol'], 'pistol', KIT.reach.pistol + KIT.draw.pistol - e);
  change('E, the pistol back in the holster', 'KeyE', ['pistol', 'null'], null, null);
  change('2, the rifle off his back', 'Digit2', ['null', 'rifle'], 'rifle', KIT.reach.rifle + KIT.draw.rifle - e);
  change('E, the rifle onto his back', 'KeyE', ['rifle', 'null'], null, null);
  change('E, the rifle off his back again', 'KeyE', ['null', 'rifle'], 'rifle', KIT.reach.rifle + KIT.draw.rifle - e);
  change('1, the rifle for the pistol', 'Digit1', ['rifle', 'null', 'pistol'], 'pistol', (KIT.stow.rifle + KIT.reach.pistol + KIT.far + KIT.draw.pistol) * q - e);
  change('2, the pistol for the rifle', 'Digit2', ['pistol', 'null', 'rifle'], 'rifle', (KIT.stow.pistol + KIT.reach.rifle + KIT.far + KIT.draw.rifle) * q - e);
  change('3, the rifle for a smoke can', 'Digit3', ['rifle', 'null', 'can'], null, null);
  change('1, the can for the pistol', 'Digit1', ['can', 'null', 'pistol'], 'pistol', (KIT.stow.can + KIT.reach.pistol + KIT.draw.pistol) * q - e);
  change('4, the pistol for a stun can', 'Digit4', ['pistol', 'null', 'can'], null, null);
  { // a can thrown: the arm's own throw, then the next one fetched from the belt
    S.reset(); const n0 = S.g.throwCount('flash'); S.click(); let f = 0, fetched = false, threw = false;
    for (; f < 130; f++) { S.step(1); if (an.inThrow) threw = true; if (threw && an.kitHold === null) fetched = true; }
    const left = S.g.throwCount('flash'), holds = T.holds.filter(h => h !== 'undefined');
    verdict(threw && n0 - left === 1 && (left === 0 || (fetched && holds.join(' ') === 'null can')) && !T.nan, 'a can thrown: the throw is the build\'s own, and the next can is FETCHED from the belt once the arm is back',
      `cans ${n0} → ${left} · after the throw the hand held [${holds.join(' → ')}] · ${f} frames · ${T.nan} non-finite`); }
  const max = kitLockMax(KIT);
  verdict(max < 1.35 && max > 0.5, 'the longest any change can hold a gun\'s fire (kitLockMax: the soak\'s bound on equipT)', `${f3(max)} s — the build's rifle lock-out was ${RIFLE_EQUIP_SECS}`);
  return allPass;
}); }

export async function kitMidswap(): Promise<boolean> { return keep(async () => {
  console.log('\n=== kitanim-midswap: a change in the middle of a change, and the arms taken by something else ===');
  allPass = true;
  { const S = await world(true), { pl, an, T } = S; toPistol(S); S.reset();
    S.tap('Digit2'); S.step(10); const had = an.kitHold, stow = an.kitStow, l0 = logEnd(); S.tap('Digit1'); S.step(1); const eq = pl.equipT, row = logEnd(), r0 = S.rounds(pl.pistol);
    // run it out: no click while the errand has the hand, then one a frame — the gun asked back for is up when the errand ends, not a lock-out later
    let n = 1, busyEnd = -1, fired = -1; for (; n < 240 && fired < 0; n++) { if (busyEnd >= 0) S.click(); S.step(1); if (busyEnd < 0 && !an.kitBusy) busyEnd = n; if (busyEnd >= 0 && S.rounds(pl.pistol) < r0) fired = n; } S.step(20);
    const fails: string[] = []; if (had !== 'pistol') fails.push(`10 frames into pistol → rifle the hand holds ${had}`);
    if (kitInHand(S.g) !== 'pistol' || !pl.pistolUp) fails.push('he does not end with the pistol up'); if (T.hand > HAND_STEP || T.pistol > PROP_STEP || T.jolt.pistol > PROP_JOLT || T.leap.pistol > PROP_LEAP) fails.push(`a step of ${cm(T.hand)} (wrist) / ${cm(T.pistol)} (the pistol's body; its step changed by ${cm(T.jolt.pistol)}, ${cm(T.leap.pistol)} at the holster's edge)`);
    if (T.holds.includes('rifle') || [...T.places.rifle].join() !== 'slung') fails.push(`the rifle came off his back on the way (drawn [${[...T.places.rifle].join(', ')}])`); if (T.nan) fails.push('non-finite');
    if (row === l0 || row?.what !== 'swap' || row.to !== 'pistol') fails.push(`the second key logged no swap to the pistol (newest row ${JSON.stringify(row)})`);
    else if (!(eq <= row.secs + 1e-9) || !(eq > 0)) fails.push(`the lock-out right after the second key is ${f3(eq)} s; the errand that brings the pistol back up is ${f3(row.secs)} s`);
    if (busyEnd < 0 || fired < 0 || fired - busyEnd > 3) fails.push(`the errand ended at frame ${busyEnd}; a click a frame from there, the first round left at frame ${fired} (want within 3 frames)`);
    verdict(!fails.length, 'pistol → rifle, and 10 frames in back to the pistol: the pistol comes up again from where the hand had it (it never reaches the rifle), locked for no longer than that takes', `held [${T.holds.join(' → ')}] · at the turn: ${had}, ${f2(stow)} of the way to the holster · the errand back up ${f3(row?.secs ?? NaN)} s, lock-out ${f3(eq)} s, over at frame ${busyEnd}, first round at frame ${fired} · most in a frame: wrist ${cm(T.hand)}, the pistol's body ${cm(T.pistol)}${bad(fails)}`); }
  { const S = await world(true), { pl, an, T } = S; toRifle(S); S.reset();
    S.tap('Digit1'); S.step(22); const had = an.kitHold; S.tap('Digit3'); S.settle(); S.step(30);
    const fails: string[] = []; if (kitInHand(S.g) !== 'can') fails.push(`he ends with ${kitInHand(S.g)} in the hand`); if (T.hand > HAND_STEP || T.prop > PROP_STEP || Math.max(T.jolt.pistol, T.jolt.rifle) > PROP_JOLT || Math.max(T.leap.pistol, T.leap.rifle) > PROP_LEAP) fails.push(`a step of ${cm(T.hand)} (wrist) / ${cm(T.rifle)} (the rifle's body; step change ${cm(T.jolt.rifle)}, ${cm(T.leap.rifle)} at his back) / ${cm(T.pistol)} (the pistol's; ${cm(T.jolt.pistol)}, ${cm(T.leap.pistol)} at the holster)`); if (T.nan) fails.push('non-finite');
    { const k = S.kit(); if (k.rifle !== 'slung' || k.pistol !== 'holster' || !k.can) fails.push(`drawn at the end: the rifle ${k.rifle}, the pistol ${k.pistol}, ${k.can ? 'a' : 'no'} can in the fist`); }
    verdict(!fails.length, 'rifle → pistol, and 22 frames in a can instead: he ends with the can, both guns where they live, nothing jumps', `held [${T.holds.join(' → ')}] · at the turn the hand held ${had} · most in a frame: wrist ${cm(T.hand)}, the rifle's body ${cm(T.rifle)}, the pistol's ${cm(T.pistol)}${bad(fails)}`); }
  { const S = await world(true), { pl, an, T } = S; toPistol(S); S.tap('Digit3'); S.step(1); S.settle(); S.step(10); S.reset();
    const cans = () => S.g.throwCount('smoke') + S.g.throwCount('flash'), c0 = cans();
    S.tap('Digit1'); S.step(8); const busy = an.kitBusy; S.tap('KeyG'); let began = -1, busyThen = false, dropped = -1;
    for (let f = 0; f < 90; f++) { const was = an.kitBusy; S.step(1); if (began < 0 && an.inThrow) { began = f; busyThen = was; } if (began >= 0 && dropped < 0 && !an.kitBusy) dropped = f; }
    S.settle(); S.step(20); const fails: string[] = [], k = S.kit();
    if (!busy) fails.push('8 frames into can → pistol no errand was running (the staging moved)');
    if (began < 0 || c0 - cans() !== 1) fails.push(`G threw nothing (a throw began: ${began >= 0}, cans ${c0} → ${cans()})`);
    else { if (!busyThen) fails.push('the errand had already ended when the throw began: nothing was dropped FOR it'); if (dropped < 0 || dropped - began > 1) fails.push(`the throw began at frame ${began} and the errand was still running ${dropped < 0 ? 'to the end' : dropped - began + ' frames on'} (want gone within 1 frame)`); }
    if (T.nan) fails.push('non-finite'); if (an.kitHold !== undefined || an.kitBusy) fails.push(`an errand is left over (kitHold ${an.kitHold})`);
    if (k.slides !== 1 || k.pistol !== (kitInHand(S.g) === 'pistol' ? 'hand' : 'holster')) fails.push(`he ends with ${kitInHand(S.g) ?? 'nothing'} by the game and the pistol drawn ${k.pistol} (${k.slides} of them)`);
    verdict(!fails.length, 'a quick throw (G) in the middle of a change: a can really leaves, the errand is dropped within a frame of the throw beginning, and the kit is where the game says after', `mid-change: ${busy} · cans ${c0} → ${cans()} · the throw began at frame ${began} with the errand ${busyThen ? 'running' : 'over'}, the errand gone at frame ${dropped} · ends with ${kitInHand(S.g) ?? 'nothing'} in the hand, the pistol drawn ${k.pistol}, kitHold ${an.kitHold}${bad(fails)}`); }
  { // a click that comes a moment early is kept (KITANIM.clickKeep): one round, on the frame the gun is up; a click long before is not; nor one whose errand is called off
    const fails: string[] = []; const keep0 = KITANIM.clickKeep;
    /** E draws the pistol; ONE click `back` frames before the lock-out is over (or at frame `at` of the change); → rounds gone, and the frame the first left counted from the lock-out's end */
    const one = async (back: number, o: { off?: boolean; away?: boolean; long?: boolean } = {}) => { const S = await world(true), { pl } = S; if (o.off) KITANIM.clickKeep = 0;
      if (o.long) { toRifle(S); S.tap('Digit1'); } else S.tap('KeyE'); S.step(1); const lockF = Math.ceil(pl.equipT * 60 - 1e-6), r0 = S.rounds(pl.pistol); let first = -1, clicked = false;
      for (let f = 1; f < lockF + 40; f++) { if (!clicked && f === (o.long ? 3 : lockF - back)) { S.click(); clicked = true; if (o.away) S.tap('KeyE'); } S.step(1); if (first < 0 && S.rounds(pl.pistol) < r0) first = f - lockF; }
      KITANIM.clickKeep = keep0; return { gone: r0 - S.rounds(pl.pistol), first, lockF, clicked }; };
    const A = await one(8), B = await one(8, { off: true }), C = await one(0, { long: true }), D = await one(8, { away: true });
    if (!A.clicked || A.gone !== 1 || A.first < 0 || A.first > 2) fails.push(`a click 8 frames before the drawn pistol is up: ${A.gone} round(s), the first ${A.first} frames after the lock-out ended (want exactly 1, within 2 frames)`);
    if (B.gone !== 0) fails.push(`clickKeep 0: the same click fired ${B.gone} round(s) (want none: dropped, as the build had it)`);
    if (C.gone !== 0) fails.push(`a click at frame 3 of rifle → pistol (lock-out ${C.lockF} frames): ${C.gone} round(s) (want none: too early to be meant for the gun coming)`);
    if (D.gone !== 0) fails.push(`a click, then E on the same frame (the pistol sent back to its holster): ${D.gone} round(s) (want none)`);
    // …and it is that GUN's click: the rifle coming up, a click in its last frames, then 1 — the pistol he changed to never fires it (clickKeep wide, so age alone would not drop it)
    const E = await (async () => { const S = await world(true), { pl } = S; KITANIM.clickKeep = 0.6; toPistol(S); S.tap('Digit2'); S.step(1); const lockF = Math.ceil(pl.equipT * 60 - 1e-6), p0 = S.rounds(pl.pistol), r0 = S.rounds(pl.rifle);
      S.step(lockF - 4); S.click(); S.step(1); const owed = pl.kitOwed >= 0; S.tap('Digit1'); S.step(120); KITANIM.clickKeep = keep0; return { owed, pistol: p0 - S.rounds(pl.pistol), rifle: r0 - S.rounds(pl.rifle), up: pl.pistolUp }; })();
    if (!E.owed || !E.up || E.pistol !== 0 || E.rifle !== 0) fails.push(`a click for the rifle coming up, then 1: kept ${E.owed}, the pistol up ${E.up}, rounds gone pistol ${E.pistol} / rifle ${E.rifle} (want kept, then nothing fired by the gun he changed to)`);
    // …the other way: the pistol being drawn, a click in its last frames (kept), then 3 on the next frame — the can he changed to is not thrown by it, and no round leaves
    const E2 = await (async () => { const S = await world(true), { pl } = S; S.tap('KeyE'); S.step(1); const lockF = Math.ceil(pl.equipT * 60 - 1e-6), p0 = S.rounds(pl.pistol), n0 = S.g.throwCount('smoke');
      S.step(lockF - 8); S.click(); S.step(1); const owed = pl.kitOwed >= 0; S.tap('Digit3'); S.step(140); return { owed, pistol: p0 - S.rounds(pl.pistol), smoke: n0 - S.g.throwCount('smoke'), can: pl.canisterSel }; })();
    if (!E2.owed || E2.can !== 'smoke' || E2.pistol !== 0 || E2.smoke !== 0) fails.push(`a click for the pistol being drawn, then 3: kept ${E2.owed}, the slot ${E2.can}, rounds gone ${E2.pistol}, smoke cans thrown ${E2.smoke} (want kept, then nothing fired and nothing thrown)`);
    // …and a can's click is that KIND's: 3, a click two frames on, then 5 while the hand is still fetching — the frag he changed to is not thrown by the smoke's click
    const E3 = await (async () => { const S = await world(true), { pl } = S; toRifle(S); const s0 = S.g.throwCount('smoke'), f0 = S.g.throwCount('frag'); S.tap('Digit3'); S.step(2); S.click(); S.step(1); const owed = pl.kitOwed >= 0, busy = S.an.kitBusy;
      S.step(5); S.tap('Digit5'); S.step(160); return { owed, busy, smoke: s0 - S.g.throwCount('smoke'), frag: f0 - S.g.throwCount('frag'), can: pl.canisterSel }; })();
    if (!E3.owed || !E3.busy || E3.can !== 'frag' || E3.smoke !== 0 || E3.frag !== 0) fails.push(`3, a click, then 5 mid-fetch: kept ${E3.owed} with the fetch running ${E3.busy}, the slot ${E3.can}, thrown smoke ${E3.smoke} / frag ${E3.frag} (want kept, then nothing thrown: the click was the smoke's)`);
    // …a smoke settled in the fist, 5, a click two frames on: nothing leaves while the fist still shows the smoke — the frag is thrown once IT is the can in the fist
    const E4 = await (async () => { const S = await world(true), { pl } = S; S.tap('Digit3'); S.step(1); S.settle(); S.step(20); const f0 = S.g.throwCount('frag'), s0 = S.g.throwCount('smoke'); S.tap('Digit5'); let at = -1, fist: string | null = '';
      for (let f = 0; f < 160; f++) { if (f === 2) S.click(); const was = S.g.throwCount('frag'), had = pl.kitCan; S.step(1); if (at < 0 && S.g.throwCount('frag') < was) { at = f; fist = had; } } return { frag: f0 - S.g.throwCount('frag'), smoke: s0 - S.g.throwCount('smoke'), at, fist }; })();
    if (E4.frag !== 1 || E4.smoke !== 0 || E4.fist !== 'frag' || E4.at < 6) fails.push(`the smoke in the fist, 5, a click two frames on: thrown frag ${E4.frag} / smoke ${E4.smoke}, at frame ${E4.at} with the fist showing the ${E4.fist} (want one frag, once the frag is the can in the fist)`);
    // …and the LAST can thrown hands the slot to the pistol mid-swing: clicks through the swing fire nothing — the pistol is still on his thigh — and the first round leaves once it is drawn
    const E5 = await (async () => { const S = await world(true), { pl } = S; pl.canisters = 1; pl.flashbangs = 0; pl.frags = 0; S.tap('Digit3'); S.step(1); S.settle(); S.step(20); const r0 = S.rounds(pl.pistol); S.click(); let slotAt = -1, shotAt = -1, where: string | null = '', swing = false, tries = 0;
      for (let f = 0; f < 140 && shotAt < 0; f++) { const ck = slotAt >= 0 && (f - slotAt) % 6 === 3; if (ck) { S.click(); if (S.an.inThrow) tries++; } const thr = S.an.inThrow; S.step(1); if (slotAt < 0 && pl.slot === 'pistol') slotAt = f; if (S.rounds(pl.pistol) < r0) { shotAt = f; where = S.kit().pistol; swing = thr; } } return { slotAt, shotAt, where, swing, tries }; })();
    if (E5.slotAt < 0 || E5.tries < 2 || E5.shotAt < 0 || E5.swing || E5.where !== 'hand') fails.push(`the last can thrown, then clicks: the slot went to the pistol at frame ${E5.slotAt}, ${E5.tries} clicks inside the swing, the first round at frame ${E5.shotAt} with the pistol drawn ${E5.where}${E5.swing ? ', the throw still running' : ''} (want none until it is in the hand)`);
    // …and R, or a right click, through that same swing and the draw after it: no magazine change begins and no OCP goes until the pistol is in his hand; R once it is up reloads
    const E6 = await (async () => { const S = await world(true), { pl } = S; toPistol(S); for (let i = 0; i < 3; i++) { S.click(); S.step(20); } const part = S.rounds(pl.pistol); pl.canisters = 1; pl.flashbangs = 0; pl.frags = 0; S.tap('Digit3'); S.step(1); S.settle(); S.step(20);
      let ocps = 0, ocpEarly = 0; const ocp0 = S.g.ocp; S.g.ocp = (t: any) => { ocps++; if (S.kit().pistol !== 'hand') ocpEarly++; return ocp0.call(S.g, t); };
      S.click(); let slotAt = -1, early = 0, asked = 0, upAt = -1;
      for (let f = 0; f < 160 && upAt < 0; f++) { if (slotAt >= 0) { S.tap('KeyR'); S.input.clicked |= 4; asked++; } S.step(1); if (slotAt < 0 && pl.slot === 'pistol') slotAt = f; if (pl.pistol.reloading) { if (S.kit().pistol !== 'hand') early++; upAt = f; } }
      S.g.ocp = ocp0; return { part, slotAt, early, asked, upAt, where: S.kit().pistol, ocps, ocpEarly }; })();
    if (E6.slotAt < 0 || E6.asked < 10 || E6.upAt < 0 || E6.early || E6.where !== 'hand' || E6.ocpEarly || E6.ocps < 1) fails.push(`the last can thrown, then R and a right click every frame: the slot went to the pistol at frame ${E6.slotAt}, ${E6.asked} frames asked, the magazine change began at frame ${E6.upAt} with the pistol drawn ${E6.where} (${E6.early} began before it was in the hand), the OCP went ${E6.ocps} time(s), ${E6.ocpEarly} before it was in the hand (want neither until it is up, both once it is)`);
    // a can the hand is still fetching: the digit, then a click two frames on — thrown as the can reaches the fist (throwKeep); at 0 the click is dropped as it was
    const can = async (from: 'rifle' | 'pistol', off = false) => { const S = await world(true), { pl } = S, keepT = KITANIM.throwKeep; if (off) KITANIM.throwKeep = 0; if (from === 'rifle') toRifle(S); else toPistol(S);
      const n0 = S.g.throwCount('smoke'); S.tap('Digit3'); S.step(2); S.click(); let at = -1, fist = -1; for (let f = 0; f < 110; f++) { S.step(1); if (fist < 0 && (S.an.kitHold === 'can' || S.an.kitHold === undefined)) fist = f; if (at < 0 && S.g.throwCount('smoke') < n0) at = f; }
      KITANIM.throwKeep = keepT; return { gone: n0 - S.g.throwCount('smoke'), at, fist }; };
    const F = await can('rifle'), Gp = await can('pistol'), H = await can('rifle', true);
    for (const [n, r] of [['rifle', F], ['pistol', Gp]] as const) if (r.gone !== 1 || r.at < 0 || r.fist < 0 || r.at - r.fist > 2) fails.push(`${n} up, 3, a click two frames on: ${r.gone} can(s) thrown, at frame ${r.at}, the can in the fist at frame ${r.fist} (want exactly one, within 2 frames of the can arriving)`);
    if (H.gone !== 0) fails.push(`throwKeep 0: the same click threw ${H.gone} can(s) (want none: dropped, as it was)`);
    verdict(!fails.length, 'a click a moment before the drawn gun is up is kept and fires once as it arrives — that gun only; one long before, one with the part at 0, one whose draw is called off: nothing; a click while a can is being fetched throws it as it arrives', `kept: ${A.gone} round, ${A.first} frame(s) after the ${A.lockF}-frame lock-out · clickKeep 0: ${B.gone} · at frame 3 of a ${C.lockF}-frame change: ${C.gone} · draw called off: ${D.gone} · a click for the rifle, then 1: pistol ${E.pistol} / rifle ${E.rifle} rounds · for the pistol, then 3: ${E2.pistol} rounds, ${E2.smoke} cans · for the smoke, then 5: smoke ${E3.smoke} / frag ${E3.frag} thrown · smoke in the fist, 5, click: the frag at frame ${E4.at} · last can, then clicks: first round at frame ${E5.shotAt}, pistol in the ${E5.where} · '3, click': from the rifle thrown at frame ${F.at} (in the fist at ${F.fist}), from the pistol at ${Gp.at} (${Gp.fist}), throwKeep 0: ${H.gone}${bad(fails)}`);
  }
  return allPass;
}); }

export async function kitReloadProbe(): Promise<boolean> { return keep(async () => {
  console.log('\n=== kitanim-reload: the magazine change goes by the gun\'s state — empty, dry, tactical ===');
  allPass = true; const got: Record<string, any> = {};
  for (const which of ['pistol', 'rifle'] as const) for (const kind of ['tactical', 'empty', 'dry'] as const) {
    const S = await world(true), { pl, an, T } = S; if (which === 'pistol') toPistol(S); else toRifle(S);
    const G = which === 'pistol' ? pl.pistol : pl.rifle;
    if (kind === 'tactical') { S.click(); S.step(24); S.click(); S.step(24); } else { for (let i = 0; i < 60 && (kind === 'empty' ? G.chamber : G.mag > 0); i++) { S.click(); S.step(14); } }
    const b = { mag: G.mag, ch: G.chamber, spare: [...G.spare] }, l0 = logEnd(); S.reset(); const k0 = S.kit(); T.count0 = { n: k0.n, nRifle: k0.nRifle, long: which === 'rifle' };
    S.tap('KeyR'); S.step(1); const row = { ...G.reloadRow }, log = logEnd() === l0 ? undefined : logEnd(); let f = 1; for (; f < 300 && (G.reloading || an.reloading); f++) S.step(1);
    S.step(30); const endTurn = Math.max(...T.trail.slice(-45));   // (the hand going back to the gun, and the frames after: where a pop at the END of a change would be — its last quarter second and the half second after)
    const secs = f * DT, B = (KITANIM.beats as any)[which], want = B[kind], k = G.def.reload.dur / B.ref, fails: string[] = [];
    if (log?.kind !== kind) fails.push(`dealt '${log?.kind}'`);
    if (Math.abs(row.dur - want.dur * k) > 1e-9 || Math.abs(row.out - want.out * k) > 1e-9 || Math.abs(row.in_ - want.in_ * k) > 1e-9 || (row.rack !== undefined) !== (kind === 'empty')) fails.push(`the weapon's beat ${JSON.stringify(row)} is not the ${kind} row × ${f2(k)}`);
    if (Math.abs(secs - row.dur) > 0.08) fails.push(`it took ${f2(secs)} s (the beat: ${f2(row.dur)})`);
    if (G.chamber !== 1 || G.mag === null || G.mag <= 0) fails.push(`after: magazine ${G.mag}, chamber ${G.chamber}`);
    const keptPart = G.spare.includes(b.mag as number) && b.mag! > 0 && G.spare.length === b.spare.length;
    if (kind === 'tactical' ? !keptPart : G.spare.length !== b.spare.length - 1) fails.push(`spares ${JSON.stringify(b.spare)} → ${JSON.stringify(G.spare)} (${kind === 'tactical' ? 'the part magazine is kept' : 'the old magazine is dropped'})`);
    if (!T.magL) fails.push('no magazine was ever shown in the support hand'); if (!T.noMag) fails.push('the magazine was never shown out of the gun');
    // …and as DRAWN (the boxes handProps makes, counted against the count just before R): +1 while a magazine is in the support hand, the rifle's own magazine box gone
    // while it is out of the well — on exactly the animator's frames —, the hand's magazine at the hand, in one stretch (two on a tactical change: the old one away, the fresh one up)
    if (T.drawBad) fails.push(`the drawn boxes are not the animator's word on ${T.drawBad} frames — ${T.drawWhy}`);
    if (!T.magDrawn || T.magRuns !== (kind === 'tactical' ? 2 : 1)) fails.push(`a magazine box was drawn in the support hand on ${T.magDrawn} frames in ${T.magRuns} stretches (want ${kind === 'tactical' ? 2 : 1})`); if (T.magOff > 0.14) fails.push(`the magazine in the hand is drawn ${cm(T.magOff)} from the wrist`);
    if (endTurn > TURN_STEP) fails.push(`as the change ended the support hand turned about its wrist by ${cm(endTurn)} at the knuckle in one frame (bound ${cm(TURN_STEP)}: a pop)`); if (T.turnL > 2 * TURN_STEP || T.turnR > TURN_STEP) fails.push(`a hand turned about its wrist by ${cm(T.turnL)} (support, bound ${cm(2 * TURN_STEP)}) / ${cm(T.turnR)} (trigger, ${cm(TURN_STEP)}) at the knuckle in one frame`);
    if (kind === 'tactical' ? T.minLz > 0.03 : T.minLz < 0.08) fails.push(`the support wrist's rearmost point is ${cm(T.minLz)} off the pelvis (${kind === 'tactical' ? 'never went back to the dump pouch on the hip' : 'went behind the hip with nothing to put away'})`);
    if (T.handL > HAND_STEP || T.hand > HAND_STEP) fails.push(`a step of ${cm(T.handL)} (support wrist) / ${cm(T.hand)} (trigger wrist) in one frame`); if (T.nan) fails.push('non-finite');
    got[which + kind] = { dur: row.dur, magL: T.magL };
    verdict(!fails.length, `${which}, ${kind.toUpperCase()} (magazine ${b.mag}, ${b.ch ? 'a round up' : 'nothing up'})`, `beat ${JSON.stringify(row)} · took ${f2(secs)} s · spares ${JSON.stringify(b.spare)} → ${JSON.stringify(G.spare)}, magazine ${G.mag} + ${G.chamber} · a magazine in the support hand on ${T.magL} frames, out of the gun on ${T.noMag} · support wrist rearmost ${cm(T.minLz)} off the pelvis, most in a frame ${cm(T.handL)}, its knuckle about the wrist ${cm(T.turnL)} (${cm(endTurn)} as the change ended) · drawn: ${k0.n} boxes before R, a magazine box in the hand on ${T.magDrawn} frames in ${T.magRuns} stretches, ≤ ${cm(T.magOff)} from the wrist, ${T.drawBad} frames off the animator's word${bad(fails)}`);
  }
  for (const w of ['pistol', 'rifle']) verdict(got[w + 'tactical'].dur > got[w + 'empty'].dur && got[w + 'empty'].dur > got[w + 'dry'].dur && got[w + 'tactical'].magL > got[w + 'empty'].magL,
    `${w}: tactical is the slow one (a magazine put away), dry the quick one (nothing to run), and the hand carries a magazine for longer on a tactical change`, `tactical ${f2(got[w + 'tactical'].dur)} s (${got[w + 'tactical'].magL} frames in hand) · empty ${f2(got[w + 'empty'].dur)} s (${got[w + 'empty'].magL}) · dry ${f2(got[w + 'dry'].dur)} s`);
  { // the switch's part off alone: the reload is the row's
    const S = await world(true), { pl } = S; KITANIM.reload = false; toPistol(S); S.click(); S.step(24); S.tap('KeyR'); S.step(1); const row = pl.pistol.reloadRow, sp = pl.pistol.spare.length; S.step(140);
    verdict(row.dur === pl.pistol.def.reload.dur && pl.pistol.spare.length === sp - 0 && S.T.nan === 0, 'KITANIM.reload off alone: the weapon row\'s own beat', `beat ${JSON.stringify(row)}`); }
  return allPass;
}); }

export async function kitClose(): Promise<boolean> { return keep(async () => {
  console.log('\n=== kitanim-close: closer than ever goes by distance — the carriage, the knife hand; and the hands are alive ===');
  allPass = true; const AT: Vec3 = [9.5, 0, 19.5], EAST = Math.PI / 2, DS = [2.4, 2.1, 1.8, 1.5, 1.2], ALIVE = 0.005;
  const run = async (on: boolean) => {
    Math.random = mulberry32(44); const W: any = await standUp(); const g = W.game; KITANIM.on = on; MOVES.on = 1; CLOSE.on = true;
    g.godMode = true; g.player.visibility = 0.02; g.aiEnabled = false; for (let i = 0; i < 5; i++) W.step(DT);
    const place = (gd: any, p: Vec3, yaw: number) => { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); };
    const [A, B, C] = g.guards; [B, C].forEach((gd: any, i: number) => { gd.hold = true; place(gd, [37.5, 0, 6 + i * 1.5], EAST); }); A.hold = true; place(A, AT, EAST);
    const pl = g.player, c = pl.char, an = c.anim;
    const rel = (p: ArrayLike<number>): Vec3 => { const dx = p[0] - c.pos[0], dz = p[2] - c.pos[2], cy = Math.cos(c.bodyYaw), sy = Math.sin(c.bodyYaw); return [dx * cy - dz * sy, p[1], dx * sy + dz * cy]; };
    const offChest = (): Vec3 => v3.sub(rel(c.bones.handR), rel(c.bones.chest));   // (kitTick measures to the man's CHEST, level: closeness is checked against that distance)
    const at = (d: number, frames: number) => { g.teleportPlayer([AT[0] - d, 0, AT[2]]); c.bodyYaw = c.aimYaw = EAST; pl.crouch = false; let trR = 0, trL = 0, pr: Vec3 | null = null, pL: Vec3 | null = null, knife = 0, nan = 0, hand: Vec3 = [0, 0, 0], left: Vec3 = [0, 0, 0];
      for (let f = 0; f < frames; f++) { W.cursorAt([AT[0], 1.2, AT[2]]); W.step(DT); pl.visibility = 0.02; if (an.knifeShown) knife++;
        const r = rel(c.bones.handR), l = rel(c.bones.handL); if (![...r, ...l].every(Number.isFinite)) nan++; if (f >= frames - 45) { hand = v3.mad(hand, offChest(), 1 / 45); left = v3.mad(left, v3.sub(l, rel(c.bones.chest)), 1 / 45); if (pr) { trR += v3.len(v3.sub(r, pr)); trL += v3.len(v3.sub(l, pL!)); } pr = r; pL = l; } }
      return { d, dNow: Math.hypot(A.char.bones.chest[0] - c.pos[0], A.char.bones.chest[2] - c.pos[2]), creep: an.creep, ready: an.ready, k: an.closeK, hips: c.bones.hips[1], hand, left, trR, trL, knife, nan }; };
    const hiltRow = at(1.0, 90), hilt = hiltRow.hand;   // in reach: the fist is on the handle (the ready pose) — the mark the hand travels to
    const rows = DS.map(d => at(d, 150));
    // the last step into reach, frame by frame: how far the knife hand still is from the hilt, how far the free hand has left where the walk-in had it
    at(1.3, 90); const l0 = v3.sub(rel(c.bones.handL), rel(c.bones.chest)); g.teleportPlayer([AT[0] - 1.0, 0, AT[2]]); c.bodyYaw = c.aimYaw = EAST;
    const reach: { r: number; l: number }[] = [];
    for (let f = 0; f < 90; f++) { W.cursorAt([AT[0], 1.2, AT[2]]); W.step(DT); pl.visibility = 0.02; reach.push({ r: v3.len(v3.sub(offChest(), hilt)), l: v3.len(v3.sub(v3.sub(rel(c.bones.handL), rel(c.bones.chest)), l0)) }); }
    return { rows, hilt, hiltRow, an, reach };
  };
  const on = await run(true), off = await run(false);
  { const fails: string[] = [], R = on.rows, dist = (r: any) => v3.len(v3.sub(r.hand, on.hilt));
    for (const r of R) { if (!r.creep) fails.push(`${r.d} m: not in the mode`); if (r.knife) fails.push(`${r.d} m: the knife is out`); if (r.nan) fails.push(`${r.d} m: non-finite`);
      const want = kitCloseness(r.dNow); if (!Number.isFinite(want) || !Number.isFinite(r.k) || !(Math.abs(r.k - want) < 0.005) || !(want > 0.02 && want < 0.99)) fails.push(`${r.d} m (${f2(r.dNow)} m to his chest): closeness ${f3(r.k)}, kitCloseness says ${f3(want)} (and every distance here is to lie strictly between the mode's edge and the knife's reach)`); }
    for (let i = 1; i < R.length; i++) { if (!(R[i].k > R[i - 1].k)) fails.push(`closeness does not rise ${R[i - 1].d} → ${R[i].d} m`); if (!(R[i].hips < R[i - 1].hips + 0.002)) fails.push(`the pelvis rises ${R[i - 1].d} → ${R[i].d} m (${f3(R[i - 1].hips)} → ${f3(R[i].hips)})`); if (!(dist(R[i]) < dist(R[i - 1]) - 0.01)) fails.push(`the knife hand is no nearer the hilt ${R[i - 1].d} → ${R[i].d} m (${cm(dist(R[i - 1]))} → ${cm(dist(R[i]))})`); }
    if (!(R[0].hips - R[R.length - 1].hips > 0.02)) fails.push(`the pelvis sinks only ${cm(R[0].hips - R[R.length - 1].hips)} over the approach`);
    if (!(dist(R[R.length - 1]) < 0.12)) fails.push(`at ${R[R.length - 1].d} m the hand is still ${cm(dist(R[R.length - 1]))} off the hilt`); if (!(dist(R[0]) > 0.14)) fails.push(`at ${R[0].d} m the hand is already ${cm(dist(R[0]))} off the hilt`);
    if (on.hiltRow.ready == null) fails.push('at 1.0 m behind him no ready pose is told (the staging moved)');
    verdict(!fails.length, 'ON: walking in on his back, every step shows — the closeness rises, the pelvis sinks, the knife hand closes on the hilt; the knife stays sheathed', R.map(r => `${r.d} m: closeness ${f2(r.k)} (kitCloseness ${f2(kitCloseness(r.dNow))}), pelvis ${f3(r.hips)}, hand ${cm(dist(r))} off the hilt`).join(' · ') + bad(fails)); }
  { // the FREE hand: with the crouch on the way in, out for the man only once the knife hand is on the hilt
    const R = on.rows, O = off.rows, fails: string[] = [];
    R.forEach((r: any, i: number) => { if (!(r.left[1] < O[i].left[1] - 0.15)) fails.push(`${r.d} m: the free hand is ${cm(r.left[1] - O[i].left[1])} off the height the old carriage held it up at (want 15 cm lower at least)`); if (!(r.left[2] < 0.12)) fails.push(`${r.d} m: the free hand is ${cm(r.left[2])} out ahead of his chest`); });
    const end = on.hiltRow.left, was = off.hiltRow.left; if (!(v3.len(v3.sub(end, was)) < 0.05)) fails.push(`in reach the free hand ends ${cm(v3.len(v3.sub(end, was)))} from where the tell's reach had it`);
    const onHilt = on.reach.findIndex((x: any) => x.r < 0.02), goes = on.reach.findIndex((x: any) => x.l > 0.05), out = on.reach[on.reach.length - 1].l;
    if (onHilt < 0) fails.push('stepping into reach the knife hand never gets within 2 cm of the hilt'); if (goes < 0 || !(out > 0.3)) fails.push(`stepping into reach the free hand never goes out (${cm(out)} from where the walk-in had it)`); else if (!(goes >= onHilt)) fails.push(`the free hand leaves at frame ${goes}, before the knife hand is on the hilt (frame ${onHilt})`);
    verdict(!fails.length, 'ON: the free hand stays with the crouch on the way in and goes out for the man only once the knife hand is on the hilt', `walk-in, free hand below / ahead of the chest: ${R.map((r: any, i: number) => `${r.d} m ${cm(-r.left[1])} / ${cm(r.left[2])} (was ${cm(-O[i].left[1])} / ${cm(O[i].left[2])})`).join(' · ')} · into reach: knife hand on the hilt at frame ${onHilt}, free hand leaves at frame ${goes} and ends ${cm(out)} out` + bad(fails)); }
  { const R = on.rows, O = off.rows, fails: string[] = [];
    R.forEach((r, i) => { if (!(r.trR >= O[i].trR + ALIVE && r.trL >= O[i].trL + ALIVE)) fails.push(`${r.d} m: stood still for 0.75 s the wrists travel ${cm(r.trR)} / ${cm(r.trL)}; with the switch off ${cm(O[i].trR)} / ${cm(O[i].trL)} (want ${cm(ALIVE)} more, each)`); });
    verdict(!fails.length, 'ON: stood still in the mode the hands are alive — each wrist\'s path over 0.75 s is longer than the same stand with the switch off, at every distance (the fingers work as well — not measured here)', R.map((r, i) => `${r.d} m: right ${cm(r.trR)}, left ${cm(r.trL)} (off: ${cm(O[i].trR)}, ${cm(O[i].trL)})`).join(' · ') + bad(fails)); }
  { const O = off.rows.filter(r => r.creep), fails: string[] = [], spread = Math.max(...O.map(r => r.hips)) - Math.min(...O.map(r => r.hips)), hs = O.map(r => v3.len(v3.sub(r.hand, O[0].hand)));
    if (off.rows.some(r => r.k !== -1)) fails.push('closeness was dealt'); if (spread > 0.012) fails.push(`the pelvis differs by ${cm(spread)} across the distances`); if (Math.max(...hs) > 0.03) fails.push(`the right hand differs by ${cm(Math.max(...hs))}`);
    verdict(!fails.length && O.length >= 3, 'OFF (the mode on, the switch off): one carriage at every distance, as it was', `${O.length} distances in the mode · pelvis spread ${cm(spread)} · right hand spread ${cm(Math.max(...hs))}${bad(fails)}`); }
  return allPass;
}); }

export async function kitEdges(): Promise<boolean> { return keep(async () => {
  console.log('\n=== kitanim-edges: the errand cut short, taken over or asked the impossible — cancel, death, a wall, R and a save mid-swap, can for can, a half-done reload, the slider ===');
  allPass = true;
  { // (a) the EMPTY hand called back: the rifle asked for, and 13 frames on (and again 5 frames on) — the hand still on its way to the shoulder — put away again
    const S = await world(true), { an, T } = S; S.step(30);
    for (const at of [13, 5]) { const fails: string[] = []; S.reset();
      S.tap('Digit2'); S.step(at); const had = an.kitHold, busy = an.kitBusy; let worst = 0, when = -1; S.tap('KeyE'); S.step(1, () => { worst = T.handL; when = 0; }); let n = 1; for (; n < 240; n++) { const w = T.handL; S.step(1); if (T.handL > w) { worst = T.handL; when = n; } if (!an.kitBusy && an.kitHold === undefined && S.pl.equipT <= 0) break; } S.step(20); const k = S.kit();
      if (!busy || had !== null) fails.push(`${at} frames into the rifle's draw the hand holds ${had} (errand running: ${busy}) — the staging wants the empty hand on its way`);
      if (T.hand > HAND_STEP || T.handL > HAND_STEP) fails.push(`a wrist moved ${cm(T.hand)} (right) / ${cm(T.handL)} (support) in one frame (bound ${cm(HAND_STEP)}; the support wrist's largest step in the E stretch: ${cm(worst)}, ${when} frames after E)`);
      if (kitInHand(S.g) !== null || an.kitHold !== undefined || an.kitBusy) fails.push(`he ends with ${kitInHand(S.g)} in the hand, kitHold ${an.kitHold}`); if (k.rifle !== 'slung' || k.pistol !== 'holster') fails.push(`drawn at the end: the rifle ${k.rifle}, the pistol ${k.pistol}`);
      if (T.rifle > PROP_STEP || T.jolt.rifle > PROP_JOLT || T.leap.rifle > PROP_LEAP) fails.push(`the rifle's body: ${cm(T.rifle)} in a frame, step change ${cm(T.jolt.rifle)}, ${cm(T.leap.rifle)} at his back`); if (T.nan) fails.push('non-finite');
      verdict(!fails.length, `the rifle asked for and, ${at} frames on, E: the empty hand comes back from where it is — no wrist jumps, nothing ends in the hand`, `held [${T.holds.join(' → ')}] · settled ${n} frames after E · most in a frame: wrist ${cm(T.hand)}, support wrist ${cm(T.handL)}, the rifle's body ${cm(T.rifle)} (drawn [${[...T.places.rifle].join(', ')}])${bad(fails)}`); } }
  for (const v of ['pistol', 'rifle'] as const) { // (b) DOWN in the middle of a change: no errand on a dead man, one pistol in the world, no rifle in dead hands
    const S = await world(true), { g, pl, an, T } = S, fails: string[] = []; if (v === 'rifle') toRifle(S); else S.step(30);
    const floor = () => g.items.items.filter((it: any) => it.kind === 'pistol').length, f0 = floor();
    S.tap(v === 'pistol' ? 'KeyE' : 'Digit1'); S.step(v === 'pistol' ? 5 : 8); const had = an.kitHold, busy = an.kitBusy;
    g.godMode = false; for (let i = 0; i < 8 && !pl.down; i++) hitPlayer(g, [1, 0, 0]);
    let errand = 0, two = 0, none = 0, inHands = 0, onHim = '', rifleBad = 0, rifleAt = '';
    S.step(60, (_f, k) => { if (an.kitHold !== undefined || an.kitBusy) errand++; const dropped = floor() - f0, tot = k.slides + dropped; if (tot > 1) two++; if (tot < 1) none++; if (dropped > 0 && k.slides > 0 && k.pistol !== 'holster') inHands++; onHim = `${k.slides} on him (${k.pistol}), ${dropped} on the floor`;
      if (k.nRifle && k.rifle !== 'slung') rifleBad++; rifleAt = k.nRifle ? String(k.rifle) : 'not drawn'; });
    if (!pl.down) fails.push('eight rounds did not put him down (the staging moved)'); if (!busy) fails.push('no errand was running when he was hit (the staging moved)');
    if (errand) fails.push(`${errand} of 60 frames with an errand on a man who is down (kitHold / kitBusy)`); if (inHands) fails.push(`${inHands} frames with the pistol drawn in his hand while a pistol lies on the floor`);
    if (two || none) fails.push(`pistols in the world (drawn on him + dropped): more than one on ${two} frames, none on ${none}`); if (rifleBad) fails.push(`${rifleBad} frames with the rifle drawn in the dead man's hands or between (it is on its sling, or it was dropped)`); if (T.nan) fails.push('non-finite');
    verdict(!fails.length, v === 'pistol' ? 'down 5 frames into the pistol\'s draw: no errand on him, and one pistol in the world — on the floor or on his thigh, never both, never in the fist' : 'down 8 frames into rifle → pistol: no errand on him, the rifle not in his hands, one pistol in the world',
      `when hit the hand held ${had} · for 60 frames after: errand frames ${errand} · the pistol: ${onHim} · the rifle: ${rifleAt}${bad(fails)}`); }
  { // (c) off a wall with the pistol: on the wall it is on his thigh; stepping off, it is DRAWN — never in the fist before the errand that brings it
    const S = await world(true), { g, pl, an, T } = S, fails: string[] = []; toPistol(S);
    g.teleportPlayer([21.5, 0, 10.7]); S.cursor[0] = 21; S.cursor[2] = 16; S.c.bodyYaw = S.c.aimYaw = 0; S.step(10); S.tap('KeyQ'); S.step(50); const onWall = !!pl.wall, kw = S.kit(); S.reset();
    S.tap('KeyQ'); let ran = false, flash = 0, first = -1, why = '';
    S.step(90, (f, k) => { if (an.kitBusy) { ran = true; if (first < 0) first = f; } if (!ran && !pl.wall && k.pistol !== 'holster' && an.kitHold === undefined) { flash++; why ||= `frame ${f}: the pistol drawn ${k.pistol}, kitHold undefined, equipT ${f3(pl.equipT)}`; } });
    const k = S.kit();
    if (!onWall) fails.push('Q did not take the wall (the staging moved)'); else if (kw.pistol !== 'holster') fails.push(`on the wall the pistol is drawn ${kw.pistol}`);
    if (pl.wall) fails.push('Q did not let go of the wall'); if (flash) fails.push(`${flash} frames with the pistol in the fist before any errand had run — ${why}`);
    if (kitInHand(g) === 'pistol' && (!ran || k.pistol !== 'hand')) fails.push(`the game has the pistol up again and ${ran ? 'it is drawn ' + k.pistol : 'no errand ever drew it'}`);
    if (T.hand > HAND_STEP || T.pistol > PROP_STEP || T.jolt.pistol > PROP_JOLT || T.leap.pistol > PROP_LEAP) fails.push(`stepping off: wrist ${cm(T.hand)}, the pistol's body ${cm(T.pistol)} in a frame (step change ${cm(T.jolt.pistol)}, ${cm(T.leap.pistol)} at the holster's edge)`); if (T.nan) fails.push('non-finite');
    verdict(!fails.length, 'off a wall with the pistol: no frame shows it in the fist before the hand has drawn it', `on the wall: ${onWall}, the pistol drawn ${kw.pistol} · Q again: the draw's errand began at frame ${first}, held [${T.holds.join(' → ')}] · ends with ${kitInHand(g) ?? 'nothing'} in the hand, drawn ${k.pistol} · most in a frame: wrist ${cm(T.hand)}, the pistol's body ${cm(T.pistol)}${bad(fails)}`); }
  { // (c2) ONTO a wall with the pistol: the hand carries it to the thigh as he takes the wall — it never changes place in a frame
    const S = await world(true), { g, pl, an, T } = S, fails: string[] = []; toPistol(S);
    g.teleportPlayer([21.5, 0, 10.7]); S.cursor[0] = 21; S.cursor[2] = 16; S.c.bodyYaw = S.c.aimYaw = 0; S.step(10); S.reset(); S.tap('KeyQ'); let busy = 0;
    S.step(60, () => { if (an.kitBusy) busy++; }); const k = S.kit();
    if (!pl.wall) fails.push('Q did not take the wall (the staging moved)'); if (!busy) fails.push('no errand ran: the pistol changed place on the frame'); if (an.kitBusy || an.kitHold !== undefined) fails.push(`an errand is still on him after a second (kitHold ${an.kitHold})`);
    if (k.pistol !== 'holster') fails.push(`on the wall the pistol is drawn ${k.pistol}`); if (T.holds.join('>') !== 'pistol>null>undefined') fails.push(`the hand held [${T.holds.join(' → ')}], want pistol → null → —`);
    if (T.hand > HAND_STEP || T.pistol > PROP_STEP || T.jolt.pistol > PROP_JOLT || T.leap.pistol > PROP_LEAP) fails.push(`taking the wall: wrist ${cm(T.hand)}, the pistol's body ${cm(T.pistol)} in a frame (step change ${cm(T.jolt.pistol)}, ${cm(T.leap.pistol)} at the holster's edge)`); if (T.nan) fails.push('non-finite');
    verdict(!fails.length, 'onto a wall with the pistol: the hand carries it to the thigh as he takes the wall', `errand frames ${busy}, held [${T.holds.join(' → ')}] · on the wall drawn ${k.pistol} · most in a frame: wrist ${cm(T.hand)}, the pistol's body ${cm(T.pistol)}${bad(fails)}`); }
  { // (c3) stacked on a wall with the rifle, E: it is slung by hand (the hold becomes the back hold) — the rifle never changes place in a frame
    const was = WALLSNAP.on; const S = await world(true), { g, pl, an, T } = S, fails: string[] = []; WALLSNAP.on = true;   // (after the stand-up: the frozen stand pins it off)
    try { toRifle(S); g.teleportPlayer([21.5, 0, 10.7]); S.cursor[0] = 21; S.cursor[2] = 16; S.c.bodyYaw = S.c.aimYaw = 0; S.step(10); S.tap('KeyQ'); S.step(50); const stacked = pl.wall?.kind === 'stack'; S.reset(); S.tap('KeyE'); let busy = 0;
      S.step(80, () => { if (an.kitBusy) busy++; }); const k = S.kit();
      if (!stacked) fails.push('Q with the rifle did not stack (the staging moved)'); if (!pl.wall || pl.wall.kind === 'stack') fails.push('E on the stack did not leave him on the back hold'); if (!busy) fails.push('no errand ran: the rifle changed place on the frame');
      if (k.rifle !== 'slung') fails.push(`after E the rifle is drawn ${k.rifle}`); if (an.kitBusy || an.kitHold !== undefined) fails.push(`an errand is still on him (kitHold ${an.kitHold})`);
      if (T.hand > HAND_STEP || T.rifle > PROP_STEP || T.jolt.rifle > PROP_JOLT || T.leap.rifle > PROP_LEAP) fails.push(`slinging on the wall: wrist ${cm(T.hand)}, the rifle's body ${cm(T.rifle)} in a frame (step change ${cm(T.jolt.rifle)}, ${cm(T.leap.rifle)} at the sling's edge)`); if (T.nan) fails.push('non-finite');
      verdict(!fails.length, 'stacked on a wall, E: the rifle is slung by hand and the hold becomes the back hold', `stacked ${stacked} · errand frames ${busy}, held [${T.holds.join(' → ')}] · ends drawn ${k.rifle}, wall ${pl.wall ? pl.wall.kind ?? 'back hold' : 'none'} · most in a frame: wrist ${cm(T.hand)}, the rifle's body ${cm(T.rifle)}${bad(fails)}`); } finally { WALLSNAP.on = was; } }
  { // (d) R in the middle of a draw: no magazine change on a gun that is not up — and R works once it is
    const S = await world(true), { pl, an } = S, fails: string[] = []; toPistol(S); S.click(); S.step(24); S.click(); S.step(24); S.tap('KeyE'); S.step(1); S.settle(); S.step(10);
    S.tap('KeyE'); S.step(3); const busy = an.kitBusy; S.tap('KeyR'); let early = 0, n = 0; for (; n < 120 && an.kitBusy; n++) { S.step(1); if (an.kitBusy && (pl.pistol.reloading || an.reloading)) early++; }
    S.settle(); S.step(5); const idle = !pl.pistol.reloading; S.tap('KeyR'); S.step(2); const after = pl.pistol.reloading;
    if (!busy) fails.push('3 frames into the draw no errand was running (the staging moved)'); if (early) fails.push(`${early} frames reloading while the errand still had the hand`); if (!idle) fails.push('the R pressed mid-draw started a reload once the gun was up (it is not remembered)'); if (!after) fails.push('R with the pistol up and two rounds gone started no reload: the first R had nothing to refuse');
    verdict(!fails.length, 'E, and R three frames later: no magazine change while the hand is still drawing — R works once the pistol is up', `the errand ran ${n} more frames, reloading on ${early} of them · up and idle: ${idle} · R then: reloading ${after}${bad(fails)}`); }
  { // (e) a magazine change under way, and a can asked for: the change goes with the gun, at once
    const S = await world(true), { pl, an, T } = S, fails: string[] = []; toPistol(S); for (let i = 0; i < 3; i++) { S.click(); S.step(20); }
    S.tap('KeyR'); S.step(10); const was = pl.pistol.reloading && an.reloading, mag = pl.pistol.mag; S.reset(); S.tap('Digit3'); S.step(1); const gun = pl.pistol.reloading, hands = an.reloading, held = an.kitHold; S.settle(); S.step(20); const k = S.kit();
    if (!was) fails.push('10 frames after R nothing was reloading (the staging moved)'); if (gun || hands) fails.push(`one frame after the can's key: the pistol reloading ${gun}, the hands' change ${hands}`);
    if (kitInHand(S.g) !== 'can' || !k.can || k.pistol !== 'holster' || k.mag) fails.push(`he ends with ${kitInHand(S.g)} by the game; drawn: ${k.can ? 'a' : 'no'} can, the pistol ${k.pistol}, ${k.mag ? 'a magazine still in the support hand' : 'no magazine'}`);
    if (pl.pistol.mag !== mag) fails.push(`the pistol's magazine went ${mag} → ${pl.pistol.mag} over a change that was called off before the magazine was out`); if (T.magDrawn > 1) fails.push(`a magazine box stayed in the support hand ${T.magDrawn} frames after the change was called off`);
    if (T.hand > HAND_STEP || T.handL > HAND_STEP || T.pistol > PROP_STEP || T.leap.pistol > PROP_LEAP) fails.push(`wrist ${cm(T.hand)} / support ${cm(T.handL)} / the pistol's body ${cm(T.pistol)} in a frame (${cm(T.leap.pistol)} at the holster's edge)`); if (T.nan) fails.push('non-finite');
    verdict(!fails.length, 'R, and 10 frames in a can: the pistol\'s magazine change is called off within the frame, weapon and hands both, and the pistol is carried to the holster', `reloading before: ${was} · one frame after the key: weapon ${gun}, hands ${hands}, the hand holds ${held} · held [${T.holds.join(' → ')}] · magazine ${mag} → ${pl.pistol.mag} · most in a frame: wrist ${cm(T.hand)}, support wrist ${cm(T.handL)}, the pistol's body ${cm(T.pistol)}${bad(fails)}`); }
  { // (f) no plain checkpoint in the middle of a change (the swap is the animator's, not the file's)
    const S = await world(true), { g, an } = S; S.step(30); const before = canSave(g, false); S.tap('KeyE'); S.step(6); const busy = an.kitBusy, mid = canSave(g, false), forced = canSave(g, true); S.settle(); S.step(30); const after = canSave(g, false);
    verdict(busy && mid !== null && mid !== before && after === before && forced === canSave(g, true), 'canSave: refused while a change is under way, back to what it said before once it has settled (a forced save is not held by it)', `before: ${JSON.stringify(before)} · 6 frames into the draw: ${JSON.stringify(mid)} (forced: ${JSON.stringify(forced)}) · settled: ${JSON.stringify(after)}`); }
  { // (g) a can for a can: the smoke in the fist goes to the belt, the stun comes out — the kind shown changes only in the empty hand
    const S = await world(true), { pl, an, T } = S, fails: string[] = []; S.step(30); S.tap('Digit3'); S.step(1); S.settle(); S.step(20); const c0 = pl.kitCan, t0 = S.kit().can?.tint; S.reset();
    S.tap('Digit4'); let kindBad = 0, tintBad = 0, wasCan = pl.kitCan, wasTint: string | null = t0 ?? null, gap = false, n = 0, holdWas: unknown = an.kitHold;
    for (; n < 200; n++) { S.step(1); const k = S.kit(); if (pl.kitCan !== wasCan && !(an.kitHold === null || holdWas === null)) kindBad++; wasCan = pl.kitCan; holdWas = an.kitHold;
      if (!k.can) gap = true; else { if (wasTint !== null && k.can.tint !== wasTint && !gap) tintBad++; wasTint = k.can.tint; gap = false; } if (n > 3 && !an.kitBusy && an.kitHold === undefined) break; }
    S.step(20); const holds = T.holds.filter(h => h !== 'undefined'), t1 = S.kit().can?.tint;
    if (c0 !== 'smoke' || pl.kitCan !== 'flash') fails.push(`the fist's can went ${c0} → ${pl.kitCan} (want smoke → flash)`); if (holds.join(' ') !== 'can null can') fails.push(`the hand held [${holds.join(' ')}], want [can null can]`);
    if (kindBad) fails.push(`the kind of can in the fist changed on ${kindBad} frames with the hand not empty`); if (tintBad || !t0 || !t1 || t0 === t1) fails.push(`the can DRAWN went ${t0} → ${t1}, changing colour in the fist on ${tintBad} frames (want another can, after a frame with none drawn)`);
    if (T.hand > HAND_STEP || T.canOff > CAN_IN_FIST) fails.push(`wrist ${cm(T.hand)} in a frame; the can drawn ≤ ${cm(T.canOff)} from the wrist`); if (T.nan) fails.push('non-finite');
    verdict(!fails.length, 'smoke in the fist, 4: the smoke goes to the belt, the hand is empty, the stun comes out — the can shown never changes kind in the fist', `held [${holds.join(' → ')}] over ${n} frames · kitCan ${c0} → ${pl.kitCan} · drawn colour ${t0} → ${t1} · most in a frame: wrist ${cm(T.hand)}${bad(fails)}`); }
  { // (h) a change a sprint cut short between the fresh magazine and the slide: rounds in the gun, nothing up — R is the KEPT change with the slide run on its end
    const S = await world(true), { pl, an, T } = S, fails: string[] = [], G = pl.pistol; toPistol(S); for (let i = 0; i < 40 && (G.chamber || G.mag); i++) { S.click(); S.step(14); }
    S.tap('KeyR'); S.step(1); let seated = false; for (let f = 0; f < 120 && G.reloading; f++) { S.step(1); if (G.mag !== null && G.mag > 0 && G.chamber === 0) { seated = true; break; } }
    S.input.keys.add('ShiftLeft'); S.input.keys.add('KeyD'); S.step(6); S.input.keys.delete('ShiftLeft'); S.input.keys.delete('KeyD'); S.step(50); S.settle();
    let staged = seated && !G.reloading && G.mag !== null && G.mag > 0 && G.chamber === 0 && pl.pistolUp; const how = staged ? 'a sprint cut an EMPTY change short after the fresh magazine went in' : 'set by hand (the sprint did not leave it so)';
    if (!staged) { G.cancelReload(); an.cancelReload(); G.mag = 7; G.chamber = 0; if (!pl.pistolUp) toPistol(S); S.step(10); }
    const b = { mag: G.mag as number, spare: [...G.spare] }, all = (x: any) => (x.mag ?? 0) + x.chamber + x.spare.reduce((a: number, r: number) => a + r, 0), sum0 = all(G), l0 = logEnd(); S.reset();
    S.tap('KeyR'); S.step(1); const row = { ...G.reloadRow }, log = logEnd() === l0 ? undefined : logEnd(), began = G.reloading; let f = 1; for (; f < 300 && (G.reloading || an.reloading); f++) S.step(1); S.step(20);
    if (!began) fails.push('R started no reload'); if (log?.what !== 'reload' || log.kind !== 'tactical') fails.push(`the change dealt is ${JSON.stringify(log)} (want a reload of kind 'tactical')`);
    if (row.rack === undefined || !(row.rack > row.in_ && row.rack < row.dur)) fails.push(`the weapon's beat ${JSON.stringify(row)} runs no slide after the magazine`);
    if (G.chamber !== 1 || G.mag === null) fails.push(`after: magazine ${G.mag}, chamber ${G.chamber}`); if (all(G) !== sum0 || G.spare.length !== b.spare.length) fails.push(`the books: ${sum0} rounds in ${b.spare.length} spares + the gun before, ${all(G)} in ${G.spare.length} after (a magazine with rounds in it is kept)`);
    if (b.mag !== G.def.magCapacity && !G.spare.includes(b.mag) && (G.mag ?? 0) + G.chamber !== b.mag) fails.push(`the part magazine of ${b.mag} is neither among the spares ${JSON.stringify(G.spare)} nor in the gun (${G.mag} + ${G.chamber})`);
    if (T.handL > HAND_STEP || T.hand > HAND_STEP || T.nan) fails.push(`a step of ${cm(T.handL)} (support wrist) / ${cm(T.hand)} (trigger wrist), ${T.nan} non-finite`);
    verdict(!fails.length, 'rounds in the magazine and nothing chambered: R is the tactical change — the magazine kept — with the slide run on its end', `staged: ${how} · before: magazine ${b.mag} + 0, spares ${JSON.stringify(b.spare)} · dealt '${log?.kind}', beat ${JSON.stringify(row)}, took ${f2(f * DT)} s · after: magazine ${G.mag} + ${G.chamber}, spares ${JSON.stringify(G.spare)}${bad(fails)}`); }
  { // (i) the slider: every change slowed (KIT.swapK 1.5), and the lock-out never past the bound the soak holds it to
    const S = await world(true), { pl } = S; KIT.swapK = 1.5; const max = kitLockMax(KIT); let most = 0, at = ''; const eqs: string[] = [];
    for (const key of ['Digit2', 'Digit1', 'Digit2', 'Digit3', 'Digit1']) { S.tap(key); S.step(170, f => { if (!f) eqs.push(`${key.slice(5)}: ${f3(pl.equipT)}`); if (pl.equipT > most) { most = pl.equipT; at = key.slice(5); } }); }
    const first = (KIT.stow.rifle + KIT.reach.pistol + KIT.far + KIT.draw.pistol) * 1.5 - KITANIM.early;
    verdict(most <= max + 1e-9 && most > first - 0.05 && S.T.nan === 0, 'KIT.swapK 1.5: the lock-out follows the slowed changes and never exceeds kitLockMax(KIT)', `lock-outs on the key's frame — ${eqs.join(' · ')} · the most on any frame ${f3(most)} s (after the key ${at}) · rifle → pistol by the table ${f3(first)} s · kitLockMax ${f3(max)} s`); }
  return allPass;
}); }

export async function kitHarness(): Promise<boolean> { return keep(async () => {
  console.log('\n=== kitanim-harness: the two stands, the page switch, the knob tables, determinism ===');
  allPass = true; const P = await import(`${ROOT}/src/host/profile.ts`), K = await import(`${ROOT}/src/game/knobs.ts`), E = await import(`${ROOT}/src/host/standEnv.ts`);
  { const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_KITANIM;
    if (frozen || word !== undefined) KITANIM.on = word !== '1';
    const before = KITANIM.on; await standUp(); const want = frozen || word !== undefined ? word === '1' : before;
    verdict(KITANIM.on === want, frozen ? 'standUp() on the frozen stand puts KITANIM.on to what TPS_KITANIM says (unset: off — every stored row and digest read the kit as it was)' : 'standUp() on the shipped stand leaves KITANIM.on to the page\'s boot (or to TPS_KITANIM where it is given)', `before ${before} · after standUp: ${KITANIM.on} · TPS_KITANIM ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'}`); }
  { const row = P.FROZEN_HOLDS['KITANIM.on']; verdict(typeof row === 'string' && /TPS_KITANIM=1/.test(row) && E.STAND_ENV.includes('TPS_KITANIM'), 'FROZEN_HOLDS names KITANIM.on with the word that turns it on, and STAND_ENV carries the word', `FROZEN_HOLDS['KITANIM.on'] = ${JSON.stringify(row)}`); }
  { const keepK = K.knobsCopy(); let onEmpty: unknown, onNo: unknown, onOther: unknown;
    try { KITANIM.on = false; P.pageSwitches(new URLSearchParams('')); onEmpty = KITANIM.on; P.pageSwitches(new URLSearchParams('nokitanim')); onNo = KITANIM.on; P.pageSwitches(new URLSearchParams('noclose&nodestruction')); onOther = KITANIM.on; }
    finally { K.knobsBack(keepK); }
    verdict(onEmpty === true && onNo === false && onOther === true, 'the page\'s boot (pageSwitches): no flag → on · ?nokitanim → off · other flags leave it on', `'' → ${onEmpty} · 'nokitanim' → ${onNo} · 'noclose&nodestruction' → ${onOther}`); }
  { const reg = K.knobRegistry(), inJ = K.JOURNAL_KNOBS.includes('KITANIM') && K.JOURNAL_KNOBS.includes('KIT'), same = reg.KITANIM === KITANIM && reg.KIT === KIT; let back = false;
    { const c = K.knobsCopy(), a = KITANIM.early, b = KIT.stow.rifle, d = KITANIM.beats.pistol.tactical.dur; KITANIM.early = a + 1; KIT.stow.rifle = b + 1; KITANIM.beats.pistol.tactical.dur = d + 1; K.knobsBack(c); back = KITANIM.early === a && KIT.stow.rifle === b && KITANIM.beats.pistol.tactical.dur === d; }
    verdict(same && inJ && back, 'knobRegistry() carries KITANIM and KIT, JOURNAL_KNOBS names both, and knobsCopy / knobsBack restore them (nested rows too)', `registry is the tables: ${same} · in JOURNAL_KNOBS: ${inJ} · changed rows put back: ${back}`); }
  { const play = async () => { const S = await world(true, 77), { pl } = S; S.step(20); S.tap('KeyE'); S.step(50); S.click(); S.step(20); S.tap('KeyR'); S.step(130); S.tap('Digit2'); S.step(80); S.click(); S.step(10); S.tap('KeyR'); S.step(190); S.tap('Digit3'); S.step(70); S.click(); S.step(100); S.tap('Digit1'); S.step(70);
      S.input.keys.add('KeyW'); S.step(60); S.input.keys.delete('KeyW'); S.step(20); return { d: JSON.stringify(digestGame(S.g, true)), eq: pl.equipT, nan: S.T.nan, stats: JSON.stringify(KITANIM_STATS) }; };
    const s0 = JSON.parse(JSON.stringify(KITANIM_STATS)); const a = await play(); putBack(KITANIM_STATS, s0); const b = await play(); putBack(KITANIM_STATS, s0);
    verdict(a.d === b.d && a.stats === b.stats && !a.nan, 'a seeded run of draws, both reloads, swaps, a throw and a walk with the switch ON digests the same twice (no dice, no clock of its own)', `digest ${a.d.length} chars, equal: ${a.d === b.d} · what was played: ${a.stats}`); }
  return allPass;
}); }

/** every change of kit, joint by joint: no elbow folded past what one folds, no wrist bent past what one bends, no hand, elbow, long gun or chest moving faster
 *  than a man moves one (tools/qa/kitanim-joints.ts: its table is the same run, `--trace 'rifle>frag'` the frames) */
export async function kitJoints(): Promise<boolean> { return keep(async () => {
  console.log('\n=== kitanim-joints: every change of kit stays inside what an arm does — elbow, wrist, the speed of hand, elbow, long gun and chest ===');
  const { jointsOf, jointFaults, ALL_CHANGES, LIMITS } = await import('./kitanim-joints.ts'); let ok = true;
  for (const [a, b] of ALL_CHANGES) { const w = await jointsOf(a, b, {}), fl = jointFaults(w); ok = ok && !fl.length;
    console.log(`- ${fl.length ? 'FAIL' : 'PASS'} — ${a} → ${b}: ${w.secs.toFixed(2)} s`);
    console.log(`    elbow ≥ ${w.elbowR[0].toFixed(0)}° (bound ${LIMITS.elbow}) · wrist ≤ ${w.wristR[0].toFixed(0)}° (${LIMITS.wrist}) · hand ${w.handR[0].toFixed(1)} m/s (${LIMITS.hand}) · elbow joint ${w.jointR[0].toFixed(1)} m/s (${LIMITS.joint}) · long gun ${w.gun[0].toFixed(0)}°/s (${LIMITS.gun}) · chest ${w.chest[0].toFixed(0)}°/s (${LIMITS.chest})`);
    for (const f of fl) console.log(`    ✗ ${f}`); }
  return ok;
}); }
/** the rifle on its sling in FRONT for a loud kit (the maintainer: "for "loud builds" … unequipping rifle should be putting it down in a sling, not over the back"):
 *  which missions get it, where it is drawn, the errand's order and lock-out, the joints, and the hanging rifle through a crouched walk (rigProps SLING_REST swings
 *  it off a raised thigh: no pop) */
export async function kitSling(): Promise<boolean> { return keep(async () => {
  console.log('\n=== kitanim-sling: a loud mission slings the rifle in front, a quiet one on his back ===');
  allPass = true;
  const { startFromQuery, activeScenario } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { jointsOf, jointFaults } = await import('./kitanim-joints.ts');
  /** how far AHEAD of his trunk line (hips → neck, along his facing) the slung rifle's middle is: + in front, − behind */
  const ahead = (S: Wd) => { const k = S.kit(), c = S.c; if (!k.rc) return NaN; const t = v3.scale(v3.add(c.bones.hips, c.bones.spine2), 0.5), d = v3.sub(k.rc, t); return d[0] * Math.sin(c.bodyYaw) + d[2] * Math.cos(c.bodyYaw); };
  { // (a) the rule
    const S = await world(true), g = S.g, fails: string[] = []; KITANIM.sling = 0;
    const solo = kitSlingFront(g); if (solo) fails.push('the plain solo night (no scenario) slings in front');
    KITANIM.sling = 1; if (!kitSlingFront(g)) fails.push("'in front' forced: still the back"); KITANIM.sling = 2; if (kitSlingFront(g)) fails.push("'on his back' forced: still in front");
    KITANIM.sling = 1; KITANIM.equip = false; if (kitSlingFront(g)) fails.push('equip off: in front'); KITANIM.equip = true; KITANIM.on = false; if (kitSlingFront(g)) fails.push('switch off: in front'); KITANIM.on = true; KITANIM.sling = 0;
    Math.random = mulberry32(31); const W2: any = await standUp(), g2 = W2.game; KITANIM.on = true; const r = startFromQuery(g2, '?roomclear'); for (let i = 0; i < 6; i++) W2.step(DT);
    const kind = activeScenario(g2), loud = kitSlingFront(g2); if (!loud) fails.push(`a room clear (scenario '${kind}', ${r?.why ?? 'started'}) slings on his back`);
    KITANIM.sling = 2; if (kitSlingFront(g2)) fails.push("a room clear with 'on his back' forced: in front"); KITANIM.sling = 0;
    verdict(!fails.length, 'the mission decides: a squad\'s loud mission = in front, the solo night = on his back; the row forces either; off with the switch', `solo night ${solo ? 'front' : 'back'} · room clear ('${kind}') ${loud ? 'front' : 'back'}${bad(fails)}`);
  }
  { // (b) drawn, in order, locked out for the errand
    const run = async (sling: 1 | 2, crouch = false) => { const S = await world(true); KITANIM.sling = sling; toRifle(S); if (crouch) { S.pl.crouch = true; S.step(50); } S.reset(); S.tap('KeyE'); S.step(1); const lock = S.pl.equipT, len = S.an.kitBusy ? 1 : 0; const f = S.settle(); S.step(30); const a = ahead(S), k = S.kit(), holds = S.T.holds.join(' → '), stow = { step: S.T.rifle, leap: S.T.leap.rifle, nan: S.T.nan };
      S.reset(); S.tap('KeyE'); S.step(1); const lock2 = S.pl.equipT; const f2r = S.settle(); S.step(20); return { a, place: k.rifle, holds, stow, lock, f, lock2, f2r, draw: { step: S.T.rifle, leap: S.T.leap.rifle, nan: S.T.nan, holds: S.T.holds.join(' → ') }, up: S.kit().rifle, len }; };
    const F = await run(1), B = await run(2), fails: string[] = [];
    const C = await run(1, true);   // crouched, the rifle lies swung up on his thighs: the hand must carry it to where it LIES (anim.kitRest), not to where it would hang
    if (!(F.a > 0.1)) fails.push(`in front: the slung rifle's middle is ${cm(F.a)} ahead of his trunk line (want > 10 cm)`); if (!(B.a < -0.08)) fails.push(`on his back: ${cm(B.a)} ahead (want behind)`);
    for (const [n, R] of [['front', F], ['back', B], ['front, crouched', C]] as const) { if (R.place !== 'slung') fails.push(`${n}: at rest the rifle is drawn '${R.place}', not where a slung one hangs`); if (R.up !== 'hand') fails.push(`${n}: drawn again it is '${R.up}'`);
      if (R.stow.step > PROP_STEP || R.draw.step > PROP_STEP) fails.push(`${n}: the rifle moves ${cm(Math.max(R.stow.step, R.draw.step))} in a frame (bound ${cm(PROP_STEP)})`); if (R.stow.leap > PROP_LEAP || R.draw.leap > PROP_LEAP) fails.push(`${n}: it leaves / reaches the sling at ${cm(Math.max(R.stow.leap, R.draw.leap))} a frame (bound ${cm(PROP_LEAP)})`);
      if (R.stow.nan || R.draw.nan) fails.push(`${n}: NaN`); if (!(R.lock2 > 0.2 && R.lock2 <= kitLockMax(KIT))) fails.push(`${n}: lock-out off the sling ${f2(R.lock2)} s`); }
    if (!(F.lock2 < B.lock2 - 0.1)) fails.push(`off the front sling the rifle is up in ${f2(F.lock2)} s, off the back ${f2(B.lock2)} s: the front should be the quicker`);
    verdict(!fails.length, 'the slung rifle hangs in front / on the back, is carried there and back without a jump, and comes up sooner off the front', `ahead of the trunk: front ${cm(F.a)}, back ${cm(B.a)} · first round after: front ${f2(F.lock2)} s, back ${f2(B.lock2)} s · most in a frame: front ${cm(Math.max(F.stow.step, F.draw.step))}, back ${cm(Math.max(B.stow.step, B.draw.step))} · crouched, front: ${cm(Math.max(C.stow.step, C.draw.step))} a frame, ${cm(Math.max(C.stow.leap, C.draw.leap))} at the sling · front holds ${F.holds} then ${F.draw.holds}${bad(fails)}`);
  }
  { // (c) joints
    const fails: string[] = [], rows: string[] = [];
    for (const [a, b] of [['none', 'rifle'], ['rifle', 'none'], ['rifle', 'pistol'], ['pistol', 'rifle'], ['rifle', 'frag'], ['frag', 'rifle']] as const) { const w = await jointsOf(a, b, { loud: true }), fl = jointFaults(w); rows.push(`${a}>${b} ${w.secs.toFixed(2)} s`); for (const f of fl) fails.push(`${a} → ${b}: ${f}`); }
    verdict(!fails.length, 'every rifle change on the front sling stays inside what an arm does', rows.join(' · ') + bad(fails));
  }
  { // (d) it hangs through a crouched walk and a run without popping
    const S = await world(true), fails: string[] = []; KITANIM.sling = 1; toRifle(S); S.tap('KeyE'); S.step(1); S.settle(); S.step(30);
    /** the rifle's middle in his CHEST's own frame (it hangs off his chest: a turn of the man, or of his chest onto a new aim, is not a move of the rifle) */
    const loc = (p: Vec3): Vec3 => { const F = S.c.chestFrame()!, d = v3.sub(p, F.o); return [v3.dot(d, F.left), v3.dot(d, F.up), v3.dot(d, F.fwd)]; };
    const leg = (label: string, keys: string[], crouch: boolean, n: number) => { S.pl.crouch = crouch; let prev: Vec3 | null = null, pv: Vec3 | null = null, step = 0, jolt = 0;
      const see = (_f: number, k: ReturnType<typeof S.kit>) => { if (!k.rc) return; const q = loc(k.rc), dv: Vec3 | null = prev ? v3.sub(q, prev) : null; if (dv) { step = Math.max(step, v3.len(dv)); if (pv) jolt = Math.max(jolt, v3.len(v3.sub(dv, pv))); } prev = q; pv = dv; };
      S.reset(); S.step(30, see); for (const k of keys) S.input.keys.add(k); S.step(n, see); for (const k of keys) S.input.keys.delete(k); S.step(40, see); const kr = S.kit().rc, CF = S.c.chestFrame()!, r = { label, step, jolt, a: kr ? v3.dot(v3.sub(kr, v3.scale(v3.add(S.c.bones.hips, S.c.bones.spine2), 0.5)), CF.fwd) : NaN /* (ahead of the trunk along his CHEST: after a strafe his hips stand a radian round from it) */, nan: S.T.nan, n: S.kit().nRifle, rest: S.pl.slingRest?.a ?? 0 };
      if (r.step > SLING_STEP) fails.push(`${label}: the hanging rifle moves ${cm(r.step)} against his chest in a frame (bound ${cm(SLING_STEP)})`); if (r.jolt > SLING_STEP) fails.push(`${label}: its step changes ${cm(r.jolt)} between frames (bound ${cm(SLING_STEP)})`); if (r.nan || !r.n) fails.push(`${label}: ${r.nan} NaN, ${r.n} rifle boxes`); if (!(r.a > 0.08)) fails.push(`${label}: ends ${cm(r.a)} ahead of the trunk`); return r; };
    const R = [leg('standing walk', ['KeyD'], false, 120), leg('crouched walk', ['KeyA'], true, 150), leg('stood up, a run', ['KeyD', 'ShiftLeft'], false, 90), leg('crouch and stand on the spot', [], true, 40)];
    verdict(!fails.length, 'slung in front it rides him through a walk, a crouched walk, a run and a crouch with no pop (it swings off a raised thigh)', R.map(r => `${r.label}: ${cm(r.step)} a frame, change ${cm(r.jolt)}, ends swung ${(r.rest * 57.3).toFixed(0)}°`).join(' · ') + bad(fails));
    const up = R[1].rest, down = R[2].rest; verdict(up > 0.5 && down < 0.35, 'crouched it lies up on his thighs, stood up it hangs', `swung ${(up * 57.3).toFixed(0)}° after the crouched walk, ${(down * 57.3).toFixed(0)}° after the run`);
  }
  return allPass;
}); }
/** NIGHT VISION by hand or by a nod (the maintainer: "should have animations for putting on and taking off night vision. if hands are busy it's a nod of the head
 *  for flicking on and off. otherwise hand does it."): N switches the tube on its own frame as ever; the goggles TRAVEL between their two places, the left hand
 *  at them when it is free, the head nodding when it is not; the picture follows the goggles to his eyes */
export async function kitNvProbe(): Promise<boolean> { return keep(async () => {
  console.log('\n=== kitanim-nv: the goggles go down and up by hand, or by a nod with the hands busy ===');
  allPass = true;
  const { gogglesBoxes } = await import(`${ROOT}/src/game/rigProps.ts`);
  const { quat } = await import(`${ROOT}/src/math/vec.ts`);
  /** the goggles as DRAWN: the first box rigProps lays for them (found in his props by its half-extents), in the HEAD's own frame — and where rigProps would lay it up / down on this pose */
  const gog = (S: Wd) => { const c = S.c, ref = (nv: boolean) => { const o: any[] = []; gogglesBoxes(c, nv, o, RIG.goggles); return o[0]; }, up = ref(false), dn = ref(true), b = S.props().find((x: any) => shaped(x, up.h));
    const q = quat.conj(c.headRot()), loc = (p: Vec3): Vec3 => quat.rotate(q, v3.sub(p, c.bones.head)); return b ? { at: loc(b.c), w: b.c as Vec3, dUp: v3.len(v3.sub(b.c, up.c)), dDn: v3.len(v3.sub(b.c, dn.c)) } : null; };
  /** one press of N followed to its end: what the game says on the key's frame, then frame by frame the goggles, the left hand against them, the head's pitch, the picture */
  const flip = (S: Wd, during?: (f: number) => void) => { const c = S.c, an = S.an, pl = S.pl, was = pl.nv, h0 = S.rel(c.bones.handL), pitch0 = Math.asin(Math.max(-1, Math.min(1, c.headDir()[1]))), st0 = { ...KITANIM_STATS.nv };
    S.reset(); S.tap('KeyN'); let prev: Vec3 | null = null, pk = an.nvShown as number | undefined, gStep = 0, near = 9, nearK = 9, mono = true, dip = 0, toss = 0, early = 0, frames = 0, keyNv: boolean | null = null, started = false, far0 = 0, shown0: number | undefined;
    for (let f = 0; f < 90; f++) { S.step(1); during?.(f); if (f === 0) { keyNv = pl.nv; started = an.nvShown !== undefined; shown0 = an.nvShown; far0 = (was ? gog(S)?.dDn : gog(S)?.dUp) ?? 9; }
      const G = gog(S), k = an.nvShown as number | undefined; if (!G) break;
      if (prev) gStep = Math.max(gStep, v3.len(v3.sub(G.at, prev))); prev = G.at;
      if (k !== undefined) { frames++; if (pk !== undefined && (pl.nv ? k < pk - 1e-9 : k > pk + 1e-9)) mono = false; pk = k;
        if (k > 0.02 && k < 0.98) { near = Math.min(near, v3.len(v3.sub(c.bones.handL, G.w))); nearK = Math.min(nearK, v3.len(v3.sub(c.bones.fingerL, G.w))); }
        if (pl.nvAmount > 0.5 ? k < 0.3 : k > 0.999) early++; }
      const p = Math.asin(Math.max(-1, Math.min(1, c.headDir()[1]))) - pitch0; dip = Math.max(dip, -p); toss = Math.max(toss, p);
      if (k === undefined && f > 2) { S.step(20); break; } }
    const G = gog(S); return { keyNv, started, shown0, far0, frames, gStep, near, nearK, mono, dip: dip * 57.3, toss: toss * 57.3, early, end: G ? (pl.nv ? G.dDn : G.dUp) : 9, back: v3.len(v3.sub(S.rel(c.bones.handL), h0)), hand: S.T.handL, turn: S.T.turnL, nan: S.T.nan, by: KITANIM_STATS.nv.hand > st0.hand ? 'hand' : KITANIM_STATS.nv.nod > st0.nod ? 'nod' : 'nothing', busy: an.nvShown !== undefined, amount: pl.nvAmount, nv: pl.nv }; };
  const GOG_STEP = 0.04, AT_GOGGLES = 0.17, KNUCKLE = 0.11;
  const common = (n: string, R: ReturnType<typeof flip>, want: boolean, fails: string[]) => {
    if (R.keyNv !== want) fails.push(`${n}: on the key's frame Player.nv is ${R.keyNv}`); if (!R.started) fails.push(`${n}: no flip started on the key's frame`); if (!(R.far0 < 0.012)) fails.push(`${n}: on the key's frame the goggles are already ${cm(R.far0)} from where they were`);
    if (!R.mono) fails.push(`${n}: the goggles go back on themselves`); if (R.gStep > GOG_STEP) fails.push(`${n}: the goggles move ${cm(R.gStep)} in a frame against his head (bound ${cm(GOG_STEP)})`);
    if (!(R.end < 1e-6)) fails.push(`${n}: at the end they are ${cm(R.end)} from where the game says`); if (R.busy) fails.push(`${n}: the flip never ended`); if (R.nan) fails.push(`${n}: NaN`);
    if (R.early > 4) fails.push(`${n}: the picture and the goggles disagree on ${R.early} frames (the tube's picture with them still up, or bare eyes with them down)`); if ((R.amount > 0.5) !== want) fails.push(`${n}: at the end the picture amount is ${f2(R.amount)}`);
    if (R.hand > HAND_STEP) fails.push(`${n}: the left wrist moves ${cm(R.hand)} in a frame (bound ${cm(HAND_STEP)})`); };
  { // (a) hands empty: by hand, down then up
    const S = await world(true), fails: string[] = []; S.step(30);
    const D = flip(S), U = flip(S);
    for (const [n, R, want] of [['down', D, true], ['up', U, false]] as const) { common(n, R, want, fails); if (R.by !== 'hand') fails.push(`${n}: hands empty, done by ${R.by}`);
      if (!(R.near < AT_GOGGLES)) fails.push(`${n}: the left wrist never comes within ${cm(AT_GOGGLES)} of the goggles while they move (nearest ${cm(R.near)})`); if (!(R.nearK < KNUCKLE)) fails.push(`${n}: the knuckles stay ${cm(R.nearK)} off them (want < ${cm(KNUCKLE)})`);
      if (!(R.back < 0.07)) fails.push(`${n}: afterwards the hand is ${cm(R.back)} from where it hung`); }
    verdict(!fails.length, 'hands empty: N is the tube on its frame, the left hand goes up, carries the goggles down (and up again) and comes away', `down: ${D.frames} frames, wrist ${cm(D.near)} / knuckles ${cm(D.nearK)} from the goggles at the nearest, goggles ${cm(D.gStep)} a frame, wrist ${cm(D.hand)} a frame · up: ${U.frames} frames, wrist ${cm(U.near)}, knuckles ${cm(U.nearK)}${bad(fails)}`);
  }
  { // (b) hands busy: a nod
    const fails: string[] = [], rows: string[] = [];
    for (const [n, stage] of [['rifle up', (S: Wd) => toRifle(S)], ['pistol at the aim', (S: Wd) => { toPistol(S); S.pl.pistol.lightOn = true; S.step(30); }]] as const) {
      const S = await world(true); stage(S); S.step(20);
      const D = flip(S), U = flip(S); common(`${n}, down`, D, true, fails); common(`${n}, up`, U, false, fails);
      if (D.by !== 'nod' || U.by !== 'nod') fails.push(`${n}: done by ${D.by} / ${U.by}`); if (!(D.dip > 6)) fails.push(`${n}: down, the head dips ${D.dip.toFixed(1)}° (want > 6)`); if (!(U.toss > 4)) fails.push(`${n}: up, the head tosses ${U.toss.toFixed(1)}° (want > 4)`);
      if (D.hand > 0.03 || U.hand > 0.03) fails.push(`${n}: the left hand moves ${cm(Math.max(D.hand, U.hand))} in a frame: it should stay on the gun`);
      rows.push(`${n}: down ${D.frames} frames, dip ${D.dip.toFixed(0)}°; up ${U.frames} frames, toss ${U.toss.toFixed(0)}°; left wrist ${cm(Math.max(D.hand, U.hand))} a frame`); }
    { const S = await world(true); toPistol(S); S.step(20); const R = flip(S); if (R.by !== 'hand') fails.push(`pistol at the relaxed carry (upper '${S.an.upper}'): done by ${R.by}`); common('pistol relaxed', R, true, fails); rows.push(`pistol relaxed: by ${R.by}`); }
    verdict(!fails.length, 'the rifle in his hands or the pistol at the aim: a nod throws them, the hands stay on the gun; the pistol at its carry: the support hand', rows.join(' · ') + bad(fails));
  }
  { // (c) turned round mid-flip, and the arm taken mid-flip
    const fails: string[] = [];
    const S = await world(true); S.step(30); const R = flip(S, f => { if (f === 26) S.tap('KeyN'); });   // (N again with the goggles half way: back up from where they are)
    if (R.nv !== false) fails.push(`N twice: night vision ends ${R.nv}`); if (R.gStep > GOG_STEP) fails.push(`N twice: the goggles jump ${cm(R.gStep)}`); if (R.hand > HAND_STEP) fails.push(`N twice: the wrist jumps ${cm(R.hand)}`); if (!(R.end < 1e-6) || R.busy) fails.push('N twice: not home at the end');
    const S2 = await world(true); S2.step(30); const R2 = flip(S2, f => { if (f === 6) S2.tap('Digit1'); });   // (the pistol asked for with the hand on its way up: the kit change has the arms)
    const S3 = await world(true); S3.step(30); S3.reset(); S3.step(7); S3.tap('Digit1'); S3.step(80); const base = S3.T.handL;   // (the same draw at the same moment with no flip under it)
    if (R2.nv !== true || !(R2.end < 1e-6) || R2.busy) fails.push(`a draw mid-flip: night vision ${R2.nv}, goggles ${cm(R2.end)} off, flip ${R2.busy ? 'still running' : 'over'}`); if (R2.hand > base + 0.06) fails.push(`a draw mid-flip: the left wrist moves ${cm(R2.hand)} in a frame; the same draw with no flip under it ${cm(base)} (allowed: 6 cm over it, the arm coming off the goggles)`); if (R2.gStep > GOG_STEP) fails.push(`a draw mid-flip: the goggles jump ${cm(R2.gStep)}`); if (R2.nan) fails.push('a draw mid-flip: NaN');
    verdict(!fails.length, 'N again half way turns them round from where they are; a kit change asked mid-flip takes the arm and the goggles still arrive', `N twice: goggles ${cm(R.gStep)} a frame, wrist ${cm(R.hand)} · draw mid-flip: wrist ${cm(R2.hand)} (the draw alone ${cm(base)}), goggles ${cm(R2.gStep)}${bad(fails)}`);
  }
  { // (d) off: they jump on the key, as the build had them
    const fails: string[] = [], rows: string[] = [];
    for (const [n, set] of [['part off', () => { KITANIM.nv = false; }], ['switch off', () => { KITANIM.on = false; }]] as const) {
      const S = await world(true); set(); S.step(30); let any = false; S.tap('KeyN'); S.step(1); const G = gog(S), amt: number[] = [];
      for (let f = 0; f < 40; f++) { if (S.an.nvShown !== undefined) any = true; amt.push(S.pl.nvAmount); S.step(1); }
      if (any) fails.push(`${n}: a flip ran`); if (!G || !(G.dDn < 1e-6)) fails.push(`${n}: on the key's frame the goggles are ${G ? cm(G.dDn) : '?'} from down`); if (!(amt[10] > 0.5)) fails.push(`${n}: the picture amount after 10 frames is ${f2(amt[10])}`);
      rows.push(`${n}: down on the key's frame, picture past half way in ${amt.findIndex(a => a > 0.5) + 1} frames`); KITANIM.nv = true; KITANIM.on = true; }
    verdict(!fails.length, 'the part off, or the switch: the goggles jump on the key and the picture with them', rows.join(' · ') + bad(fails));
  }
  { // (e) what the game reads is the same with the part on and off
    const run = async (nv: boolean) => { const S = await world(true, 77); KITANIM.nv = nv; const g = S.g; const out: string[] = []; const press = [20, 50, 58, 130, 200];
      for (let f = 0; f < 260; f++) { if (press.includes(f)) S.tap('KeyN'); if (f === 90) S.tap('Digit1'); if (f > 150 && f < 190) S.input.keys.add('KeyD'); else S.input.keys.delete('KeyD'); S.step(1); if (f % 20 === 19) out.push(JSON.stringify(digestGame(g, true))); }
      return { d: out.join('|'), nv: S.pl.nv }; };
    const A = await run(true), B = await run(false); KITANIM.nv = true;
    verdict(A.d === B.d && A.nv === B.nv, 'a run with five presses of N (hands empty, then the pistol) digests the same with the part on and off', `${A.d.length} characters of digest, ${A.d === B.d ? 'equal' : 'DIFFERENT'}; night vision ends ${A.nv} / ${B.nv}`);
  }
  { // (f) what the game READS off his head is the same under a nod: the joint stays put and his gaze on the plan does not turn
    const run = async (nv: boolean) => { const S = await world(true, 41); KITANIM.nv = nv; toPistol(S); S.pl.pistol.lightOn = true; S.step(50); const out: { h: Vec3; yaw: number; pitch: number }[] = [];
      for (let f = 0; f < 70; f++) { if (f === 4 || f === 34) S.tap('KeyN'); S.step(1); const d = S.c.headDir(); out.push({ h: [...S.c.bones.head] as Vec3, yaw: Math.atan2(d[0], d[2]), pitch: Math.asin(Math.max(-1, Math.min(1, d[1]))) }); }
      return { out, by: { ...KITANIM_STATS.nv } }; };
    const n0 = { ...KITANIM_STATS.nv }, A = await run(true), nods = A.by.nod - n0.nod, B = await run(false); KITANIM.nv = true; let dh = 0, dy = 0, dp = 0;
    for (let i = 0; i < A.out.length; i++) { dh = Math.max(dh, v3.len(v3.sub(A.out[i].h, B.out[i].h))); dy = Math.max(dy, Math.abs(Math.atan2(Math.sin(A.out[i].yaw - B.out[i].yaw), Math.cos(A.out[i].yaw - B.out[i].yaw)))); dp = Math.max(dp, Math.abs(A.out[i].pitch - B.out[i].pitch)); }
    const fails: string[] = []; if (nods !== 2) fails.push(`${nods} nods played (want 2)`); if (!(dh < 0.001)) fails.push(`the head joint moves ${(dh * 1000).toFixed(1)} mm under the nod`); if (!(dy * 57.3 < 1)) fails.push(`his gaze on the plan turns ${(dy * 57.3).toFixed(1)}° under the nod`); if (!(dp * 57.3 > 6)) fails.push(`the nod pitches the head only ${(dp * 57.3).toFixed(1)}°`);
    // …and at a SPRINT, where the gaze stabiliser holds his head level: it does not take the nod back out through the neck
    const runS = async (nv: boolean) => { const S = await world(true, 41); KITANIM.nv = nv; S.input.keys.add('KeyW'); S.input.keys.add('ShiftLeft'); S.step(12); const out: { h: Vec3; pitch: number }[] = []; let spr = 0;
      for (let f = 0; f < 44; f++) { if (f === 2) S.tap('KeyN'); S.step(1); if (S.pl.sprinting) spr++; const d = S.c.headDir(); out.push({ h: [...S.c.bones.head] as Vec3, pitch: Math.asin(Math.max(-1, Math.min(1, d[1]))) }); }
      S.input.keys.delete('KeyW'); S.input.keys.delete('ShiftLeft'); return { out, spr, by: { ...KITANIM_STATS.nv } }; };
    const s0 = { ...KITANIM_STATS.nv }, As = await runS(true), sNods = As.by.nod - s0.nod, Bs = await runS(false); KITANIM.nv = true; let sh = 0, sp = 0;
    for (let i = 0; i < As.out.length; i++) { sh = Math.max(sh, v3.len(v3.sub(As.out[i].h, Bs.out[i].h))); sp = Math.max(sp, Math.abs(As.out[i].pitch - Bs.out[i].pitch)); }
    if (As.spr < 40 || sNods !== 1) fails.push(`staging: sprinting on ${As.spr} of 44 frames, ${sNods} nod(s) played`); if (!(sh < 0.0015)) fails.push(`at a sprint the head joint moves ${(sh * 1000).toFixed(1)} mm under the nod`); if (!(sp * 57.3 > 14)) fails.push(`at a sprint the nod pitches the head only ${(sp * 57.3).toFixed(1)}° (the stabiliser takes it back)`);
    verdict(!fails.length, 'a nod with the pistol at the aim, and at a sprint: the head joint stays where it is and the gaze does not turn on the plan — a pitch in the plane of his gaze, nothing else', `against the same frames with the part off: head joint ${(dh * 1000).toFixed(2)} mm, gaze on the plan ${(dy * 57.3).toFixed(2)}°, pitch ${(dp * 57.3).toFixed(0)}° · at a sprint: head joint ${(sh * 1000).toFixed(2)} mm, pitch ${(sp * 57.3).toFixed(0)}°` + bad(fails));
  }
  { // (g) N again inside a nod: no pop; down mid-flip: the flip is let go of; a save waits for it
    const fails: string[] = [], pitchOf = (S: Wd) => Math.asin(Math.max(-1, Math.min(1, S.c.headDir()[1]))) * 57.3;
    const nod = async (again: number[]) => { const S = await world(true); toRifle(S); S.step(20); let p = pitchOf(S), worst = 0; S.tap('KeyN'); for (let f = 0; f < 70; f++) { if (again.includes(f)) S.tap('KeyN'); S.step(1); const q = pitchOf(S); worst = Math.max(worst, Math.abs(q - p)); p = q; } return { worst, busy: S.an.nvBusy, nv: S.pl.nv }; };
    const one = await nod([]), two = await nod([6]), three = await nod([4, 9]);
    if (!(two.worst < one.worst + 2.5) || !(three.worst < one.worst + 2.5)) fails.push(`N again inside a nod turns the head ${two.worst.toFixed(1)}° / ${three.worst.toFixed(1)}° in a frame (one nod alone: ${one.worst.toFixed(1)}°)`); if (two.busy || three.busy || two.nv !== false || three.nv !== true) fails.push(`after the presses: flip ${two.busy || three.busy ? 'still running' : 'over'}, night vision ${two.nv} / ${three.nv}`);
    // a nod cut short by a HAND flip (the pistol let down to its carry) whose arm is then taken again (the pistol back at the aim): the nod that was carried is not played a second time
    // (staged so the hand flip really RUNS some frames before its arm is taken: the pistol let down a frame after the first N, the second N once the aim has eased out of his arms)
    const turn = await (async () => { const S = await world(true, 41); toPistol(S); S.pl.pistol.lightOn = true; S.step(50); let p = pitchOf(S), worst = 0, handF = 0, conv = -1; S.tap('KeyN');
      for (let f = 0; f < 80; f++) { if (f === 1) S.pl.pistol.lightOn = false; if (f === 12) S.tap('KeyN'); if (f === 17) S.pl.pistol.lightOn = true; const was = (S.an as any).nv?.hand === true; S.step(1); const n = (S.an as any).nv; if (n?.hand) handF++; if (was && n && !n.hand && conv < 0) conv = f;
        const q = pitchOf(S); if (f >= 12) worst = Math.max(worst, Math.abs(q - p)); p = q; } return { worst, busy: S.an.nvBusy, handF, conv }; })();
    if (turn.handF < 3 || turn.conv < 0) fails.push(`staging: the hand flip over the nod ran ${turn.handF} frames by hand and ${turn.conv < 0 ? 'was never turned into a nod' : 'became a nod at frame ' + turn.conv} (want some frames by hand, then a nod)`);
    if (!(turn.worst < one.worst + 2.5) || turn.busy) fails.push(`a nod, a hand flip over it, the arm taken again: the head turns ${turn.worst.toFixed(1)}° in a frame (one nod alone: ${one.worst.toFixed(1)}°)${turn.busy ? ', the flip still running' : ''}`);
    const S = await world(true); S.step(30); S.tap('KeyN'); S.step(27); const mid = S.an.nvShown, why = canSave(S.g, false); S.g.godMode = false; for (let i = 0; i < 8 && !S.pl.down; i++) hitPlayer(S.g, [1, 0, 0]); S.step(3); const G = gog(S);
    if (!(mid !== undefined && mid > 0.02 && mid < 0.98)) fails.push(`staging: 27 frames into a hand flip the goggles are at ${mid}`); if (!/goggles/.test(String(why))) fails.push(`a save 27 frames into a flip: ${why === null ? 'allowed' : `refused for '${why}'`} (want it to wait for the goggles)`);
    if (!S.pl.down) fails.push('staging: he did not go down'); if (S.an.nvBusy || S.an.nvShown !== undefined) fails.push(`down mid-flip: the flip runs on (goggles at ${S.an.nvShown})`); if (!G || !(G.dDn < 1e-6)) fails.push(`down mid-flip: the goggles lie ${G ? cm(G.dDn) : '?'} from where the game says`);
    verdict(!fails.length, 'N again inside a nod does not pop the head; shot down mid-flip the goggles are where the game says; no checkpoint mid-flip', `most in a frame: one nod ${one.worst.toFixed(1)}°, N again at frame 6 ${two.worst.toFixed(1)}°, at frames 4 and 9 ${three.worst.toFixed(1)}°, a hand flip over a nod (${turn.handF} frames by hand) turned back into a nod ${turn.worst.toFixed(1)}° · down at ${f2(mid ?? -1)} of the way: flip over · save: '${why}'` + bad(fails));
  }
  { // (h) the hand at his goggles when R is pressed: the arm is the reload's before the magazine leaves, and the game is the same game
    const run = async (nv: boolean, at: number) => { const S = await world(true, 53), G = S.pl.pistol; KITANIM.nv = nv; toPistol(S); for (let i = 0; i < 40 && (G.chamber || G.mag); i++) { S.click(); S.step(14); } S.step(90); const up = S.an.upper, h0 = KITANIM_STATS.nv.hand, out: string[] = [];
      S.tap('KeyN'); S.step(at); S.tap('KeyR'); for (let f = 0; f < 160; f++) { S.step(1); if (f % 8 === 7) out.push(JSON.stringify(digestGame(S.g, true))); }
      return { d: out.join('|'), hand: KITANIM_STATS.nv.hand - h0, up, mag: G.mag, wrist: S.T.handL }; };
    const fails: string[] = [], rows: string[] = [];
    for (const at of [16, 24, 34]) { const A = await run(true, at), B = await run(false, at); KITANIM.nv = true;
      if (A.hand !== 1) fails.push(`R ${at} frames after N: the flip was not by hand (upper '${A.up}')`); if (A.d !== B.d) fails.push(`R ${at} frames after N: the game digests differently with the part on`); if (!(A.mag! > 0)) fails.push(`R ${at} frames after N: the magazine ends ${A.mag}`);
      rows.push(`${at} frames after N: ${A.d === B.d ? 'equal' : 'DIFFERENT'}`); }
    verdict(!fails.length, 'R with the hand still at his goggles (pistol empty at its carry): the dropped magazine falls from the same place with the part on and off', rows.join(' · ') + bad(fails));
  }
  { // (h') hands empty, N, then he walks into a leaf: the hand that goes out to the door is the door's — the goggle arm is clear of it quickly, and the goggles still arrive
    const S = await world(true, 41), g = S.g, an: any = S.an, d = g.doors.byName('conference')!, sw = g.doors.swingOf(d), fails: string[] = [];
    const L = Math.hypot(sw.handle[0] - sw.hinge[0], sw.handle[2] - sw.hinge[2]), nx = -(sw.handle[2] - sw.hinge[2]) / L, nz = (sw.handle[0] - sw.hinge[0]) / L, mx = (sw.hinge[0] + sw.handle[0]) / 2, mz = (sw.hinge[2] + sw.handle[2]) / 2;
    d.angle = 0; d.vel = 0; g.teleportPlayer([mx + nx * 0.85, 0, mz + nz * 0.85]); const yaw = Math.atan2(-nx, -nz);   // (the leaf shut: a hand goes out to a shut leaf)
    S.c.bodyYaw = S.c.aimYaw = yaw; S.W.cam.yaw = Math.PI + yaw; S.W.cam.rebuild(); S.step(20); S.tap('KeyN');
    let on = -1, off = -1, armOn = 0; for (let f = 0; f < 70; f++) { if (f === 6) S.input.keys.add('KeyW'); S.step(1); const wl = an.dp.wL.x; if (on < 0 && wl >= 0.5) { on = f; armOn = an.nvArm; } if (on >= 0 && off < 0 && an.nvArm < 0.01) off = f; }
    S.input.keys.delete('KeyW'); S.step(30); const G = gog(S);
    if (on < 0 || !(armOn > 0.3)) fails.push(`staging: the left hand ${on < 0 ? 'never went out to the leaf' : `went out at frame ${on} with the goggle arm at ${f2(armOn)}`} (want it out while the arm is still at the goggles)`);
    else if (off < 0 || off - on > 12) fails.push(`the door hand was out at frame ${on} and the goggle arm ${off < 0 ? 'never let go' : `let go ${off - on} frames on`} (want within 12)`);
    if (S.pl.nv !== true || S.an.nvBusy || !G || !(G.dDn < 1e-6)) fails.push(`after: night vision ${S.pl.nv}, the flip ${S.an.nvBusy ? 'still running' : 'over'}, the goggles ${G ? cm(G.dDn) : '?'} from down`);
    verdict(!fails.length, 'N with empty hands, then a leaf walked into: the arm is the door\'s within a fifth of a second, the goggles still come down', `the door hand out at frame ${on} (goggle arm at ${f2(armOn)}), the arm clear ${off - on} frames on · the door at ${f2(d.angle)} rad${bad(fails)}`);
  }
  { // (i) a lock picked a moment after N: the picture still follows the goggles
    const S = await world(true), g = S.g, d = g.doors.byName('server'), fails: string[] = []; d.reset(); g.teleportPlayer([17.6, 0, 10.75]); S.pl.crouch = true; S.c.bodyYaw = Math.PI; S.W.step(DT); S.W.cursorAt(d.pos); S.W.step(DT);
    S.input.pressed.add('KeyN'); S.W.cursorAt(d.pos); S.W.step(DT); g.selectVerb('door', 'pick'); S.input.pressed.add('Space'); let picking = false, amt = 0; for (let f = 0; f < 90; f++) { S.W.cursorAt(d.pos); S.W.step(DT); picking ||= S.pl.picking === d; amt = S.pl.nvAmount; }
    if (!picking) fails.push('staging: the pick never started'); if (!S.pl.nv) fails.push('staging: night vision is off'); if (!(amt > 0.9)) fails.push(`1.5 s into the pick the tube's picture is at ${f2(amt)} with night vision on`);
    verdict(!fails.length, 'N, then a lock: the tube\'s picture comes in while he works the lock', `picking ${picking}, picture ${f2(amt)}` + bad(fails));
  }
  return allPass;
}); }
export const KITANIM_PROBES = [['kitanim-off', kitOff], ['kitanim-equip', kitEquip], ['kitanim-midswap', kitMidswap], ['kitanim-reload', kitReloadProbe], ['kitanim-close', kitClose], ['kitanim-edges', kitEdges], ['kitanim-harness', kitHarness], ['kitanim-joints', kitJoints], ['kitanim-sling', kitSling], ['kitanim-nv', kitNvProbe]] as const;
export async function kitanimAll(only?: string[]): Promise<boolean> {
  let ok = true; const t0 = performance.now();
  for (const [name, fn] of KITANIM_PROBES) { if (only?.length && !only.includes(name)) continue;
    let r = false; try { r = await fn(); } catch (e: any) { console.log(`error: probe '${name}' threw — ${e?.stack ?? e}`); } ok &&= r; }
  console.log(`\n=== kitanim: ${ok ? 'ALL PASS' : 'FAILURES above'} === (${((performance.now() - t0) / 1000).toFixed(1)} s)`); return ok;
}
if (import.meta.main) process.exit((await kitanimAll(process.argv.slice(2).filter(a => a.startsWith('kitanim-')))) ? 0 : 1);
