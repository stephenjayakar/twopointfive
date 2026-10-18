// tools/qa/inhand-check.ts — a pistol is drawn in the hand that holds it, and the hand is turned onto the line the gun points
// (src/game/inhand.ts INHAND.on; character.ts inHandPass / gripFrameR; rigProps.ts pistolFrame, RigOpts.inHand).
//
// Seen in play: a teammate crouched on the rear of a sneaking pair, his sidearm out — the gun stood on the simulation's aim line and his two fists where the
// crouch had leaned the aim clip, a hand's breadth apart. And for the fifth of a second the aim clip takes to come up, the gun was on the line before his arms.
//
// THE BENCH (no game: one figure of each side, driven the way the controllers drive the animator; the same script run twice, the rule off and on):
//   (1) the stand: the switch as the stand says, FROZEN_HOLDS carries its row and word, the word is in STAND_ENV;
//   (2) rule off, the fault is there: crouched on an aim the grip stands off the fist's hollow and the bore across the hand; worse while the aim comes up;
//   (3) rule on, IN THE HAND: in every frame of every script (stand, walk, crouch, crouch-walk, a point to the side, up, down, the aim coming up and let go)
//       the grip is in the fist's hollow and the bore lies along the hand's own knuckle line — both sides' pistols;
//   (4) rule on, ON THE LINE: once the aim shows, the drawn bore is the simulation's own (gunDir) to three degrees (the 9 mm's own rake in its group is 2.6);
//   (5) a HOLD stays a hold: a support hand that was on the gun is as far from the gun hand as it was, its arm no longer or shorter than its bones;
//   (6) nothing in one frame: neither hand's turn from frame to frame is faster than a hand moves;
//   (7) LOOKS ONLY: every joint the simulation reads, gunDir and the muzzle are bit for bit the same with the rule off and on, in every frame;
//   (8) nothing where it does not belong: empty hands — the skeleton is posed once;
//   (12) a TORCH: rule off the fist is a hand's breadth from it; on, the fist is round its body and turned along it — the torch itself where it was;
//   (13) a LONG GUN: rule off its grip is 4 cm short of the palm; on, the palm is on it — a teammate's rifle and a defender's carbine — the gun, the hand on its
//        fore-end and every box where they were, the arm no longer or shorter than its bones;
//   (14) worn: a defender's holster stands 3 cm further off his thigh, the torch on his belt outside his shirt (both where they were with the rule off);
//   (15) a SHOT: fired as the gun comes up from a crouched low ready, the drawn gun is on the round's line and in the hand on the frame it fires;
//   (16) it STANDS DOWN: through a reload, a flinch, a blow and a kit errand the gun hand is the animator's own again within a fifth of a second.
// THE GAME (the mission the maintainer's shot was taken in, a teammate with his sidearm, the player walked about standing and crouched):
//   (9) the teammate's pistol is in his hand in every frame he holds it; (10) the run is the same run with the rule off and on (the game's own digest) — the player's own pistol drawn, aimed, swapped for a can and back, reloaded and fired on the way;
//   (11) a recording from before the key replays with it off, one that carries it keeps it; the page opens with it on and ?inhand=0 puts it off.
//
//   bun run tools/qa/inhand-check.ts [--verbose]        (both stands: it raises the switch itself)
//   INHAND_BREAK=1 …                                    (the rule left off for the 'on' lines: (3), (9), (12), (13), (14) and (15) must fail)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const deg = (c: number) => Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
const qrot = (q: number[], v: V3): V3 => { const [x, y, z, w] = q, ux = y * v[2] - z * v[1], uy = z * v[0] - x * v[2], uz = x * v[1] - y * v[0]; return [v[0] + 2 * (w * ux + y * uz - z * uy), v[1] + 2 * (w * uy + z * ux - x * uz), v[2] + 2 * (w * uz + x * uy - y * ux)]; };
const qang = (a: number[], b: number[]) => 2 * deg(Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
const longAxis = (b: any): V3 => qrot(b.rot, (b.h[0] >= b.h[1] && b.h[0] >= b.h[2] ? [1, 0, 0] : b.h[1] >= b.h[2] ? [0, 1, 0] : [0, 0, 1]) as V3);
/** the DRAWN wrist (the skeleton as the picture has it — the look-only pass may have moved it off bones.handR) */
const wristOf = (c: any): V3 => { const w = c.world, p = c.skel.nodePos(c.anim.nodes.handR); return [w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]]; };
const hollowOf = (c: any): V3 => { const h = wristOf(c), hf = c.handFrameR(); return [0, 1, 2].map(i => h[i] + hf.fingers[i] * 0.09 - hf.back[i] * 0.03) as V3; };

/** what one frame of a drawn pistol reads: `gap` m from the grip's middle to the fist's hollow · `across` degrees between the slide's long axis and the hand's own
 *  knuckle line · `off` degrees between it and the simulation's line. `boxes[0]` the slide, `boxes[1]` the grip (rigProps: both rigs lay them out in that order) */
function read(c: any, boxes: any[]): { gap: number; across: number; off: number } | null {
  const slide = boxes[0], grip = boxes[1], h = c.bones.handR; if (!slide?.rot || !grip || !h) return null;
  const hf = c.handFrameR(), gf = c.gripFrameR();
  const hollow: V3 = [0, 1, 2].map(i => h[i] + hf.fingers[i] * 0.09 - hf.back[i] * 0.03) as V3;
  const ax = slide.h[0] >= slide.h[1] && slide.h[0] >= slide.h[2] ? [1, 0, 0] : slide.h[1] >= slide.h[2] ? [0, 1, 0] : [0, 0, 1]; let bore = qrot(slide.rot, ax as V3); if (dot(bore, c.gunDir) < 0) bore = [-bore[0], -bore[1], -bore[2]];
  return { gap: len(sub(grip.c, hollow)), across: deg(dot(bore, gf.bore)), off: deg(dot(bore, c.gunDir)) };
}

export async function inhandCheck(): Promise<boolean> {
  const H: any = await import('./headless.ts');
  const { INHAND, IN_PISTOL } = await import(`${ROOT}/src/game/inhand.ts`);
  const CH: any = await import(`${ROOT}/src/game/character.ts`);
  const RP: any = await import(`${ROOT}/src/game/rigProps.ts`);
  const CB: any = await import(`${ROOT}/src/game/combat.ts`);
  const KT: any = await import(`${ROOT}/src/game/kit.ts`);
  const KN: any = await import(`${ROOT}/src/game/knobs.ts`);
  const JO: any = await import(`${ROOT}/src/game/journal.ts`);
  const PROFILE: any = await import(`${ROOT}/src/host/profile.ts`);
  const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);
  const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const VERBOSE = process.argv.includes('--verbose'), BREAK = process.env.INHAND_BREAK === '1', ON = !BREAK;
  let all = true; const f1 = (x: number) => x.toFixed(1);
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  console.log('\n=== inhand: a pistol is drawn in the hand that holds it, and the hand is turned onto the line the gun points ===');
  const knobs0 = KN.knobsCopy(), kit0 = JSON.parse(JSON.stringify(KT.KIT.members));
  try {
    // (1) the stand — asked first, before anything here writes the switch
    { const W: any = await hushed(() => H.standUp({ uploadEvery: 4, seed: 1 })); void W; const stood = INHAND.on;
      const shipped = process.env.TPS_PROFILE === 'shipped', env = process.env.TPS_INHAND, want = env !== undefined ? env === '1' : shipped, row = PROFILE.FROZEN_HOLDS['INHAND.on'];
      line(stood === want && typeof row === 'string' && row.includes('TPS_INHAND=1') && (STAND_ENV as readonly string[]).includes('TPS_INHAND'), `(1) the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen probe was recorded'}; FROZEN_HOLDS carries the row and its word`, `after the stand-up: ${stood} · row '${row}'`); }

    // ------------------------------------------------------------ the bench
    const ch: any = await H.loadCastCharacter(); const DT = 1 / 60;
    type Held = 'pistol' | 'torch' | 'rifle' | null;
    interface Man { c: any; side: 'operator' | 'defender'; held: Held }
    const man = (side: 'operator' | 'defender'): Man => { const c = new CH.Character(ch, { id: side === 'operator' ? 21 : 24, tint: [0.1, 0.1, 0.1], tint2: [0.05, 0.05, 0.05], pos: [0, 0, 0], yaw: 0 });
      c.anim.phase = 0; c.anim.trained = side === 'operator' ? 1 : 0.12; c.anim.upper = 'none'; c.anim.stance = 'none'; return { c, side, held: null }; };
    const arm = (m: Man, held: Held) => { const a = m.c.anim; m.held = held; a.longGun = held === 'rifle';
      if (held === 'rifle') { a.longSteady = m.side === 'operator' ? 1 : 0; a.longGrip = m.side === 'operator' ? RP.sc20kGrip() : RP.carbineGrip(); m.c.muzzleAhead = m.side === 'operator' ? RP.sc20kMuzzleAhead() : RP.carbineMuzzleAhead(); }
      if (a.grip) a.grip[1] = held === 'torch'; };
    /** his boxes this frame, the way combat.ts deals them (handPropsRaw's teammate row / guardKit's defender row), the rule as `on` */
    const beamOf = (c: any): V3 => [Math.sin(c.bodyYaw), 0, Math.cos(c.bodyYaw)];   // (a patrol's beam: level, ahead of him — rigProps torchCarryDir)
    const draw = (m: Man, on: boolean, meta?: any[]): any[] => { const out: any[] = [], ih = on && m.held === 'pistol';
      if (m.side === 'operator') RP.rigBoxes(m.c, { goggles: false, nv: false, slot: m.held === 'pistol' ? 1 : 0, lightOn: false, isGuard: false, holster: false, rifle: m.held === 'rifle' ? 'hand' : null, ...(ih ? { inHand: true, ...(INHAND.fit ? { fit: true } : null) } : null) }, out, RP.RIG, meta);
      else if (m.held) RP.rigBoxes(m.c, { goggles: false, nv: false, slot: 1, lightOn: false, isGuard: true, holster: false, torch: m.held === 'torch', ...(m.held === 'torch' ? { beamDir: beamOf(m.c) } : null), weapon: m.held === 'rifle' ? 'carbine' : 'pistol', ...(ih ? { inHand: true } : null) }, out, RP.RIG, meta);
      return out; };
    const simOf = (c: any) => JSON.stringify([c.bones, c.gunDir, c.muzzle, c.pos, c.bodyYaw, c.aimYaw]);
    const palette = (c: any) => Array.from(c.skel.jointData as Float32Array).reduce((a: number, x: number) => (Math.imul(a, 31) + Math.round(x * 1e5)) | 0, 7);
    /** `each`: a call made on both figures apart (an animator's one-shot, or anything that reads the figure it is called on) */
    type Script = (m: Man, run: (secs: number) => void, each: (fn: (c: any) => void) => void) => void;
    interface Row { apart: number; busy: boolean; fire: boolean; boxes: boolean; gap: number; across: number; off: number; shown: number; twoHand: number; twoHandPre: number; armErr: number; turnR: number; turnL: number; sim: boolean; same: boolean; thing: number; line: number; fist: number; lgrip: number }
    /** one script, both stands of the rule side by side: two figures of one id stepped by the same calls, one posed with the rule off and one with it as `on` */
    const play = (side: 'operator' | 'defender', held: Held, script: Script, on: boolean): Row[] => {
      const A = man(side), B = man(side), rows: Row[] = []; let lastR: number[] | null = null, lastL: number[] | null = null;
      const step = (m: Man, rule: boolean) => { INHAND.on = rule; m.c.inHand = !rule ? null : m.held === 'pistol' ? IN_PISTOL : m.held === 'torch' ? RP.torchHold(beamOf(m.c)) : m.held === 'rifle' ? RP.longHold(m.side === 'operator' ? 'sc20k' : 'carbine') : null; const c = m.c; if (c.vel) c.pos = [c.pos[0] + c.vel[0] * DT, c.pos[1], c.pos[2] + c.vel[2] * DT]; c.update(DT); };
      const run = (secs: number) => { for (let i = 0; i < Math.round(secs * 60); i++) {
        step(A, false); step(B, on); const n = B.c.anim.nodes, sk = B.c.skel;
        const meta: any[] = [], bx = draw(B, on, meta), r = held === 'pistol' ? read(B.c, bx) : null, dist = (x: any, a: number, b: number) => len(sub(x.skel.nodePos(a), x.skel.nodePos(b)));
        let thing = 0, lineOff = 0, fist = 0, lgrip = 0;
        if (held === 'torch' && bx[0]?.rot) { const ax = longAxis(bx[0]), d = sub(hollowOf(B.c), bx[0].c), al = dot(d, ax); thing = len([d[0] - ax[0] * al, d[1] - ax[1] * al, d[2] - ax[2] * al]); lineOff = deg(Math.abs(dot(ax, beamOf(B.c)))); fist = deg(Math.abs(dot(B.c.handFrameR().thumb, ax))); }
        if (held === 'rifle') { const gm = meta.find(x => /\.grip$/.test(x.path)), gl = meta.find(x => /gripL$/.test(x.path)); if (gm) thing = len(sub(bx[gm.boxStart].c, hollowOf(B.c)));
          if (gl) { const w = B.c.world, p = sk.nodePos(n.handL), Lw: V3 = [w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]]; lgrip = len(sub(Lw, gl.frame.o)); } }
        const bl = (a: number, b: number) => Math.abs(dist(B.c, a, b) - dist(A.c, a, b)), bone = Math.max(bl(n.upperArmL, n.forearmL), bl(n.forearmL, n.handL), bl(n.upperArmR, n.forearmR), bl(n.forearmR, n.handR));
        const ba = draw(A, false).map(b => JSON.stringify([b.c, b.h, b.rot])).join(), bb = held === 'pistol' ? ba : bx.map(b => JSON.stringify([b.c, b.h, b.rot])).join();
        const qR = [...sk.globalRot[n.handR]], qL = [...sk.globalRot[n.handL]];
        rows.push({ apart: qang([...A.c.skel.globalRot[n.handR]], qR), busy: !B.c.anim.gunArmOwn, fire: !!B.c.anim.shooting, boxes: ba === bb, gap: r?.gap ?? 0, across: r?.across ?? 0, off: r?.off ?? 0, shown: B.c.anim.aimShown, twoHand: dist(B.c, n.handR, n.handL), twoHandPre: dist(A.c, n.handR, n.handL), armErr: bone,
          turnR: lastR ? qang(lastR, qR) : 0, turnL: lastL ? qang(lastL, qL) : 0, thing, line: lineOff, fist, lgrip, sim: simOf(A.c) === simOf(B.c), same: palette(A.c) === palette(B.c) && JSON.stringify(draw(A, false)) === JSON.stringify(draw(B, false)) });
        lastR = qR; lastL = qL; } };
      for (const m of [A, B]) arm(m, held); for (let i = 0; i < 30; i++) { step(A, false); step(B, on); }
      const both: Man = { c: null, side, held }; void both;
      script(new Proxy(A, { get: (_t, k) => k === 'c' ? twin(A.c, B.c) : (A as any)[k] }) as Man, run, fn => { INHAND.on = false; fn(A.c); INHAND.on = on; fn(B.c); });
      return rows; };
    /** writes to one figure land on both (the scripts set animator fields and yaws; they read none back but bodyYaw) */
    const twin = (a: any, b: any): any => new Proxy(a, { get: (_t, k) => { const v = a[k]; return v && typeof v === 'object' && !Array.isArray(v) ? twin(v, b[k]) : v; }, set: (_t, k, v) => { a[k] = v; b[k] = Array.isArray(v) ? [...v] : v; return true; } });
    const aim = (m: Man) => { m.c.anim.upper = 'aim'; m.c.anim.stance = 'none'; }, low = (m: Man) => { m.c.anim.upper = 'none'; m.c.anim.stance = 'lowReady'; };
    const walk = (m: Man, v: number) => { m.c.anim.speed = v; m.c.vel = [0, 0, v]; };
    const SCRIPTS: Record<string, Script> = {
      'stand': (m, run) => { aim(m); run(1.5); },
      'walk': (m, run) => { aim(m); walk(m, 1.4); run(2); },
      'crouch': (m, run) => { aim(m); m.c.anim.crouchTarget = 1; run(2); },
      'crouch-walk': (m, run) => { aim(m); m.c.anim.crouchTarget = 1; walk(m, 1.2); run(2.2); },
      'aside': (m, run) => { aim(m); m.c.anim.crouchTarget = 1; m.c.aimYaw = m.c.bodyYaw + 70 * Math.PI / 180; run(2); m.c.aimYaw = m.c.bodyYaw - 60 * Math.PI / 180; run(1.5); },
      'up-down': (m, run) => { aim(m); m.c.aimPitch = 0.35; run(1.2); m.c.aimPitch = -0.35; run(1.2); m.c.anim.crouchTarget = 1; run(1.2); },
      'coming-up': (m, run) => { low(m); m.c.anim.crouchTarget = 1; run(1.5); aim(m); run(0.6); low(m); run(0.6); aim(m); run(0.5); m.c.anim.crouchTarget = 0; run(0.8); },
    };
    /** …and the things that take the gun arm from the aim: the turn stands down for them, and a shot has the hand on the line at once */
    const BUSY: Record<string, Script> = {
      'reload': (m, run, each) => { aim(m); m.c.anim.crouchTarget = 1; run(1); each(c => c.anim.reload()); run(2.2); },
      'flinch': (m, run, each) => { aim(m); m.c.anim.crouchTarget = 1; run(1); each(c => c.anim.hit()); run(1.2); },
      'blow': (m, run, each) => { aim(m); m.c.anim.crouchTarget = 1; run(1); each(c => c.anim.strike()); run(1.2); },
      'errand': (m, run, each) => { aim(m); m.c.anim.crouchTarget = 1; run(1); each(c => c.anim.kitSwap('pistol', 'can', { r: c.bones.handR, l: c.bones.handL, ...c.handFrameR(true) })); run(1.6); },
    };
    const SHOT: Record<string, Script> = { 'shot': (m, run, each) => { low(m); m.c.anim.crouchTarget = 1; run(1.2); aim(m); each(c => c.anim.fire()); run(0.8); } };
    const sides: ('operator' | 'defender')[] = ['operator', 'defender'];
    const runSet = (S: Record<string, Script>, on: boolean) => { const o: Record<string, Row[]> = {}; for (const s of sides) for (const [k, fn] of Object.entries(S)) o[`${s} ${k}`] = play(s, 'pistol', fn, on); return o; };
    const runAll = (on: boolean) => runSet(SCRIPTS, on);
    const worst = (R: Record<string, Row[]>, f: (r: Row) => number, pick: (k: string, r: Row) => boolean = () => true) => { let w = 0, at = ''; for (const [k, rs] of Object.entries(R)) rs.forEach((r, i) => { if (pick(k, r) && f(r) > w) { w = f(r); at = `${k} @${(i / 60).toFixed(2)} s`; } }); return { w, at }; };
    const off = runAll(false), on = runAll(ON), busyOff = runSet(BUSY, false), busyOn = runSet(BUSY, ON), shotOff = runSet(SHOT, false), shotOn = runSet(SHOT, ON);
    const offAll = { ...off, ...busyOff }, onAll = { ...on, ...busyOn };
    if (VERBOSE) for (const [name, R] of [['off', off], ['on', on]] as const) for (const [k, rs] of Object.entries(R)) console.log(`    ${name} ${k.padEnd(22)} gap worst ${f1(Math.max(...rs.map(r => r.gap)) * 100)} cm · across ${f1(Math.max(...rs.map(r => r.across)))}° · off the line (aim shown) ${f1(Math.max(0, ...rs.filter(r => r.shown > 0.97).map(r => r.off)))}°`);

    // (2) off: the fault
    { const set = (k: string, r: Row) => / crouch$/.test(k) && r.shown > 0.97, settled = worst(off, r => r.gap, set), acr = worst(off, r => r.across, set), up = worst(off, r => r.gap, k => /coming-up/.test(k)), upA = worst(off, r => r.across, k => /coming-up/.test(k));
      line(settled.w > 0.028 && acr.w > 12 && up.w > 0.06 && upA.w > 30 && !Object.values(off).some(rs => rs.some(r => !r.same)), '(2) rule off, the fault is there: crouched on an aim the grip stands off the fist and the gun across the hand; worse while the aim comes up',
        `crouched, the aim settled: ${f1(settled.w * 100)} cm (${settled.at}), ${f1(acr.w)}° across the hand (${acr.at}) · coming up: ${f1(up.w * 100)} cm (${up.at}), ${f1(upA.w)}° (${upA.at})`); }

    // (3) in the hand
    { const g = worst(on, r => r.gap), a = worst(on, r => r.across), gOp = worst(on, r => r.gap, k => k.startsWith('operator')), gDef = worst(on, r => r.gap, k => k.startsWith('defender'));
      const busy = (k: string) => !/errand/.test(k), gB = worst(busyOn, r => r.gap, busy), aB = worst(busyOn, r => r.across, busy), gB0 = worst(busyOff, r => r.gap, busy);   // (an errand takes the gun to its holster: kit handling's own drawing)
      line(g.w <= 0.024 && a.w <= 3 && gB.w <= 0.024 && aB.w <= 3, '(3) rule on, in the hand: in every frame of every script the grip is in the fist\'s hollow and the bore lies along the hand\'s knuckle line, both sides\' pistols — through a reload, a flinch and a blow too',
        `grip to hollow: worst ${f1(g.w * 100)} cm (${g.at}) — a teammate's ${f1(gOp.w * 100)} cm, a defender's ${f1(gDef.w * 100)} cm · bore across the hand: worst ${a.w.toFixed(2)}° (${a.at}) · ${Object.values(on).reduce((n, r) => n + r.length, 0)} frames · reload / flinch / blow: ${f1(gB.w * 100)} cm (${gB.at}), ${aB.w.toFixed(2)}° — rule off ${f1(gB0.w * 100)} cm (${gB0.at})`); }

    // (4) on the line
    { const o = worst(on, r => r.off, (_k, r) => r.shown > 0.97), n = Object.values(on).reduce((s, rs) => s + rs.filter(r => r.shown > 0.97).length, 0);
      const o0 = worst(off, r => r.off, (_k, r) => r.shown > 0.97);
      line(o.w <= 3 && o.w <= o0.w + 0.5 && n > 500, '(4) rule on, on the line: once the aim shows, the drawn bore is the simulation\'s own to three degrees and no further off it than the build drew it (standing, crouched, moving, to a side, up and down)', `worst ${o.w.toFixed(2)}° (${o.at}) over ${n} frames · rule off, laid on the line by construction: ${o0.w.toFixed(2)}° (the 9 mm's own rake in its group)`); }

    // (5) a hold stays a hold
    { const held = (r: Row) => r.twoHandPre < INHAND.both * 0.5; const d = worst(on, r => Math.abs(r.twoHand - r.twoHandPre), (_k, r) => held(r)), b = worst(on, r => r.armErr), n = Object.values(on).reduce((s, rs) => s + rs.filter(held).length, 0);
      line(d.w <= 0.004 && b.w <= 0.002 && n > 300, '(5) a hold stays a hold: a support hand that was on the gun is as far from the gun hand as it was (4 mm), and its arm is no longer or shorter than its bones (2 mm)', `hands apart: worst change ${f1(d.w * 1000)} mm (${d.at}) over ${n} two-hand frames · the left arm's bones: worst ${f1(b.w * 1000)} mm (${b.at})`); }

    // (6) nothing in one frame
    { const more = (f: (x: Row) => number) => { let w = 0, at = ''; for (const [k, rs] of Object.entries(onAll)) rs.forEach((r, i) => { const d = f(r) - f(offAll[k][i]); if (d > w) { w = d; at = `${k} @${(i / 60).toFixed(2)} s`; } }); return { w, at }; };
      const r = more(x => x.turnR), l = more(x => x.turnL);
      line(r.w <= 12 && l.w <= 12, '(6) nothing in one frame: the rule adds no more than 12° to what either hand turns from one frame to the next — through a reload, a flinch, a blow and a kit errand too', `gun hand +${f1(r.w)}° a frame (${r.at}) · support hand +${f1(l.w)}° (${l.at})`); }

    // (7) looks only
    { const A7 = { ...onAll, ...shotOn }, bad = Object.entries(A7).flatMap(([k, rs]) => rs.some(r => !r.sim) ? [k] : []), n = Object.values(A7).reduce((s, rs) => s + rs.length, 0);
      line(bad.length === 0, '(7) looks only: every joint the simulation reads, gunDir, the muzzle and where he stands are the same with the rule off and on, in every frame — an errand started from a turned hand and a shot fired from one included', bad.length ? `differ in: ${bad.join(', ')}` : `${n} frames, ${Object.keys(A7).length} scripts`); }

    // (8) nothing where it does not belong
    { const bad: string[] = []; let n = 0;
      for (const side of sides) for (const k of ['crouch', 'coming-up', 'walk']) { const rs = play(side, null, SCRIPTS[k], true); n += rs.length; if (rs.some(r => !r.same || !r.sim)) bad.push(`${side} (${k})`); }
      line(bad.length === 0, '(8) nothing where it does not belong: with empty hands and the rule on, the joints handed to the picture are the build\'s', bad.length ? `moved: ${bad.join(', ')}` : `${n} frames`); }

    // (12) a torch
    { const T: Record<string, (m: Man, run: (s: number) => void) => void> = { 'patrol walk': (m, run) => { walk(m, 1.2); run(2.5); }, 'stood': (_m, run) => { run(1.5); }, 'turning': (m, run) => { walk(m, 1.2); run(1); m.c.bodyYaw += 1.2; m.c.aimYaw += 1.2; run(1.5); } };
      const o: Row[] = [], w: Row[] = []; for (const fn of Object.values(T)) { o.push(...play('defender', 'torch', fn, false)); w.push(...play('defender', 'torch', fn, ON)); }
      const mx = (rs: Row[], f: (r: Row) => number) => rs.reduce((a, r) => Math.max(a, f(r)), 0), mean = (rs: Row[], f: (r: Row) => number) => rs.reduce((a, r) => a + f(r), 0) / Math.max(1, rs.length), late = (rs: Row[]) => rs.filter((_r, i) => i % 150 > 40 || i > 150);
      line(mean(o, r => r.thing) > 0.05 && mx(late(w), r => r.thing) <= 0.015 && w.every(r => r.boxes) && mx(w, r => r.armErr) <= 0.002 && mean(late(w), r => r.fist) < mean(late(o), r => r.fist) - 5 && w.every(r => r.sim),
        '(12) a torch: rule off the fist is beside it; on, the fist is round its body, turned along it, the arm no longer or shorter than its bones — the torch, its lens and everything the game reads where they were',
        `the fist's hollow to the torch's line: off mean ${f1(mean(o, r => r.thing) * 100)} cm, worst ${f1(mx(o, r => r.thing) * 100)} · on worst ${f1(mx(late(w), r => r.thing) * 100)} cm · the fist's thumb line off the torch's: ${f1(mean(late(o), r => r.fist))}° → ${f1(mean(late(w), r => r.fist))}° (a wrist turns ${INHAND.wrist}° at most) · arm bones ${f1(mx(w, r => r.armErr) * 1000)} mm · ${w.length} frames`); }

    // (13) a long gun
    { const L: Record<string, (m: Man, run: (s: number) => void) => void> = { 'aim': (m, run) => { aim(m); run(1.5); }, 'low ready': (m, run) => { low(m); run(1.5); }, 'crouch walk': (m, run) => { aim(m); m.c.anim.crouchTarget = 1; walk(m, 1.2); run(2); }, 'aside': (m, run) => { aim(m); m.c.aimYaw = m.c.bodyYaw + 0.9; run(1.5); } };
      const say: string[] = []; let ok = true;
      for (const side of sides) { const o: Row[] = [], w: Row[] = []; for (const fn of Object.values(L)) { o.push(...play(side, 'rifle', fn, false).slice(20)); w.push(...play(side, 'rifle', fn, ON).slice(20)); }
        const mx = (rs: Row[], f: (r: Row) => number) => rs.reduce((a, r) => Math.max(a, f(r)), 0), mn = (rs: Row[], f: (r: Row) => number) => rs.reduce((a, r) => Math.min(a, f(r)), 9);
        const foreMoved = w.reduce((a, r, i) => Math.max(a, Math.abs(r.lgrip - o[i].lgrip)), 0);
        const good = mn(o, r => r.thing) > 0.035 && mx(w, r => r.thing) <= 0.015 && foreMoved <= 0.001 && w.every(r => r.boxes) && mx(w, r => r.armErr) <= 0.002 && w.every(r => r.sim);
        ok &&= good; say.push(`${side === 'operator' ? 'a teammate\'s rifle' : 'a defender\'s carbine'}: grip to the palm's hollow ${f1(mn(o, r => r.thing) * 100)}‥${f1(mx(o, r => r.thing) * 100)} cm → ${f1(mx(w, r => r.thing) * 100)} cm at worst · the hand on the fore-end moved ${f1(foreMoved * 1000)} mm · arm bones ${f1(mx(w, r => r.armErr) * 1000)} mm · ${w.length} frames`); }
      line(ok, '(13) a long gun: rule off its grip is short of the palm; on, the palm is on it — the gun, its light, the hand on the fore-end and everything the game reads where they were, the arm no longer or shorter than its bones', say.join('\n    ')); }

    // (14) worn
    { const HW: any = await import(`${ROOT}/src/game/handwork.ts`); const m = man('defender'); INHAND.on = false; for (let i = 0; i < 30; i++) m.c.update(DT);
      const belt = (rule: boolean) => { INHAND.on = rule; const out: any[] = []; HW.beltTorch(m.c, out); const hp = m.c.bones.hips; return Math.hypot(out[0].c[0] - hp[0], out[0].c[2] - hp[2]); };
      const hol = (by: number) => { const out: any[] = []; RP.rigBoxes(m.c, { goggles: false, nv: false, slot: 1, lightOn: false, isGuard: true, torch: true, weapon: 'pistol', ...(by ? { holsterOut: by } : null) }, out); const b = out[out.length - 1], hp = m.c.bones.hips; return Math.hypot(b.c[0] - hp[0], b.c[2] - hp[2]); };
      const b0 = belt(false), b1 = belt(ON), h0 = hol(0), h1 = hol(ON ? INHAND.holsterOut : 0);
      line(b1 - b0 > 0.06 && h1 - h0 > 0.02 && h1 - h0 < 0.04, '(14) worn: a defender\'s holster stands further off his thigh and the torch on his belt hangs outside his shirt; both where they were with the rule off', `belt torch ${f1(b0 * 100)} → ${f1(b1 * 100)} cm from his hips · holster ${f1(h0 * 100)} → ${f1(h1 * 100)} cm`); }

    // (15) a shot
    { const pick = (R: Record<string, Row[]>) => Object.values(R).flatMap(rs => rs.filter(r => r.fire)), a = pick(shotOff), b = pick(shotOn), mx = (rs: Row[], f: (r: Row) => number) => rs.reduce((m, r) => Math.max(m, f(r)), 0);
      line(b.length > 20 && mx(b, r => r.off) <= 3 && mx(b, r => r.gap) <= 0.024 && (BREAK || mx(a, r => r.gap) > 0.05), '(15) a shot fired as the gun comes up from a crouched low ready: the drawn gun is on the round\'s line AND in the hand from the frame it fires',
        `rule on: bore ${mx(b, r => r.off).toFixed(2)}° off the round's line, grip ${f1(mx(b, r => r.gap) * 100)} cm from the fist's hollow at worst, ${b.length} frames · rule off: on the line by construction, grip ${f1(mx(a, r => r.gap) * 100)} cm from the fist`); }

    // (16) it stands down
    { const say: string[] = []; let ok = true;
      for (const [k, rs] of Object.entries(busyOn)) { let since = 0, worst = 0, n = 0; for (const r of rs) { since = r.busy ? since + 1 : 0; if (since > 12) { n++; worst = Math.max(worst, r.apart); } } ok &&= n >= 5 && worst <= 1; say.push(`${k} ${worst.toFixed(2)}° (${n})`); }
      line(ok, '(16) it stands down: a fifth of a second into a reload, a flinch, a blow or a kit errand the gun hand is the animator\'s own again (to 1°)', `the gun hand off the animator's, worst (frames): ${say.join(' · ')}`); }

    // ------------------------------------------------------------ the game
    const level = () => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels/lights-out.json'), 'utf8')));
    const game = async (rule: boolean) => {
      const W: any = await hushed(() => H.standUp({ uploadEvery: 4, level: level(), seed: 1 })); const g = W.game, I = W.input; INHAND.on = rule;   // (after the stand-up: the frozen stand pins it off, the shipped one on)
      KT.KIT.members[1].weapon = 'pistol';
      await hushed(() => startFromQuery(g, '?levelFile=lights-out.json&quiet&squad=1&difficulty=hard&quietfog=cones'));
      const mate = g.guards.find((x: any) => x.team === 'operative' && x.char && x.weapon?.def?.cls === 'pistol') ?? g.guards.find((x: any) => x.team === 'operative' && x.char);
      const rows: { gap: number; across: number; tag: string }[] = [];
      const run = (secs: number, tag: string, keys: string[] = []) => { for (const k of keys) I.keys.add(k); for (let i = 0; i < secs * 60; i++) { W.step(1 / 60);
        const out: any[] = []; CB.handProps(g, out); const mine = out.filter(b => (b.owner & 0xff) === (mate.char.id & 0xff)), a = mate.char.anim;
        if (mate.state !== 'dead' && !a.hideHeldItem && !a.kitBusy && mine.length >= 2) { const r = read(mate.char, mine); if (r) rows.push({ gap: r.gap, across: r.across, tag }); } }
        for (const k of keys) I.keys.delete(k); };
      run(2, 'stand'); run(3, 'walk', ['KeyW']); run(2, 'walk', ['KeyD']); run(1, 'stand');
      I.keys.add('KeyC'); I.pressed.add('KeyC'); W.step(1 / 60); I.keys.delete('KeyC');
      run(2, 'crouch'); run(3, 'crouch-walk', ['KeyS']); run(3, 'crouch-walk', ['KeyA']); run(2, 'crouch');
      // the player's own pistol, crouched: drawn, aimed, swapped for a can and back, reloaded, fired — kit handling starts its errands from the hand's frame (kitanim.ts)
      const tap = (k: string, frames: number) => { I.pressed.add(k); for (let i = 0; i < frames; i++) W.step(1 / 60); };
      tap('Digit1', 90); tap('Digit3', 100); tap('Digit1', 100); tap('KeyR', 150); I.clicked |= 1; tap('Digit2', 100); tap('Digit1', 100);
      return { g, W, rows, mate, digest: JSON.stringify(digestGame(g)) };
    };
    const g0 = await game(false), g1 = await game(ON);
    // (9)
    { const w = (G: typeof g0) => G.rows.reduce((a, r) => r.gap > a.gap ? r : a, { gap: 0, across: 0, tag: '-' }), wa = (G: typeof g0) => G.rows.reduce((a, r) => Math.max(a, r.across), 0), a = w(g0), b = w(g1);
      line(g1.mate?.weapon?.def?.cls === 'pistol' && g1.rows.length > 600 && b.gap <= 0.024 && wa(g1) <= 3 && (BREAK || a.gap > 0.05),
        '(9) in the mission the shot was taken in, the teammate\'s pistol is in his hand in every frame he holds it — standing, walking, crouched and creeping behind the player', `rule on: worst ${f1(b.gap * 100)} cm (${b.tag}), ${wa(g1).toFixed(2)}° across the hand, ${g1.rows.length} frames · rule off: worst ${f1(a.gap * 100)} cm (${a.tag}), ${f1(wa(g0))}°`); }
    // (10)
    line(g0.digest === g1.digest && g0.digest.length > 200, '(10) the run is the same run with the rule off and on (the game\'s own digest after it)', `digest ${g0.digest.length} chars · ${g0.digest === g1.digest ? 'equal' : 'DIFFER'}`);
    // (11)
    { const g = g1.g, snap = () => JSON.parse(JSON.stringify(JO.knobsSnapshot(g)));
      INHAND.on = true; const old = snap(); delete old.tables.INHAND; JO.applyKnobs(g, old); const without = INHAND.on;
      INHAND.on = true; const own = snap(); INHAND.on = false; JO.applyKnobs(g, own); const withIt = INHAND.on;
      PROFILE.pageSwitches(new URLSearchParams('')); const a = INHAND.on; PROFILE.pageSwitches(new URLSearchParams('inhand=0')); const b = INHAND.on;
      line(without === false && withIt === true && a === true && b === false, '(11) a recording from before the key replays with the rule off, one that carries it keeps it; the page opens with it on and ?inhand=0 puts it off', `applyKnobs with no key → ${without} · with it on → ${withIt} · '' → ${a} · 'inhand=0' → ${b}`); }
  } finally { KN.knobsBack(knobs0); KT.KIT.members.splice(0, KT.KIT.members.length, ...kit0); }
  return all;
}

if (import.meta.main) process.exit((await inhandCheck()) ? 0 : 1);
