// tools/qa/gunhand-whistle-check.ts — a guard answering a whistle brings the torch up in the hand that holds it
// (src/game/gunhand.ts GUNHAND.on + .whistle; character.ts torchUpLayer and the torch branch of inHandWord; whistle.ts WHISTLE_SOFT_UPPER 'torch').
//
// The fault: the library's raised-torch clip is keyed for a torch in the LEFT hand and ours is in the right. A man answering a whistle put an empty left fist
// out ahead of his chest while the torch, and the light placed off its lens, stayed down in the hanging right hand.
//
// THE BENCH (no game: three figures stepped by the same calls — the legs' clip alone, the answer with the rule off, the answer with it on; standing, walking,
// and looking off to one side and down; the picture's in-hand pass on for all three, as the page has it):
//   (1) the stand: the switch as the stand says, FROZEN_HOLDS carries its row and word, the word is in STAND_ENV, the key is on;
//   (2) rule off, the fault is there: the left wrist is up, the right — the torch's — hangs at his thigh, and the light is far from the raised fist;
//   (3) rule on, THE FREE HAND IS FREE: the left wrist stays within a few centimetres of where the legs' clip has it;
//   (4) rule on, THE TORCH IS UP: the right wrist is at shoulder height, ahead of the shoulder;
//   (5) rule on, IN THE FIST: the torch's body runs through the hollow of the right fist, the fist turned along it — the in-hand pass on;
//   (6) rule on, THE LIGHT: at the torch's lens, ahead of the fist along the beam; the beam is the line it was with the rule off;
//   (7) nothing in one frame: coming up and going down, the right hand turns no faster than a hand does; down again it is where the legs' clip has it;
//   (8) ONLY THE ANSWER: every other carry (none, the pistol's two) is bit for bit the pose it was, and so is the answer with the rule's key off.
// THE GAME (the whistle staging of whistle-torch: a calm man 6 m up the corridor, V, a second on):
//   (9) rule off he answers with the left wrist up and his light at his thigh; on, the torch hand is up, the left is down, his light is at the lens of the
//       torch as it is drawn and the torch is in the fist;
//   (10) a recording from before the key replays with the rule off, one that carries it keeps it; the page opens with it on and ?gunhand=0 puts it off.
//
//   bun run tools/qa/gunhand-whistle-check.ts           (both stands: it raises the switch itself)
//   bun run tools/qa/probes.ts gunhand-whistle          (the same, as a probe of the 'gunhand' family; --verbose here prints each bench set)
//   GUNHAND_BREAK=1 …                                   (the rule left off for the 'on' lines: (3), (4) and (9) must fail — (5) and (6) hold of the low carry too)
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const deg = (c: number) => Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
const qrot = (q: number[], v: V3): V3 => { const [x, y, z, w] = q, ux = y * v[2] - z * v[1], uy = z * v[0] - x * v[2], uz = x * v[1] - y * v[0]; return [v[0] + 2 * (w * ux + y * uz - z * uy), v[1] + 2 * (w * uy + z * ux - x * uz), v[2] + 2 * (w * uz + x * uy - y * ux)]; };
const qang = (a: number[], b: number[]) => 2 * deg(Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
const longAxis = (b: any): V3 => qrot(b.rot, (b.h[0] >= b.h[1] && b.h[0] >= b.h[2] ? [1, 0, 0] : b.h[1] >= b.h[2] ? [0, 1, 0] : [0, 0, 1]) as V3);
/** a joint of the DRAWN skeleton in the world (the look-only in-hand pass may have moved the wrist off bones.handR) */
const drawn = (c: any, node: number): V3 => { const w = c.world, p = c.skel.nodePos(node); return [w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]]; };
const hollowOf = (c: any): V3 => { const h = drawn(c, c.anim.nodes.handR), hf = c.handFrameR(); return [0, 1, 2].map(i => h[i] + hf.fingers[i] * 0.09 - hf.back[i] * 0.03) as V3; };
/** the torch in a list of boxes: its body (the long one) and its lens (the short one after it) — rigProps RIG.torch */
const torchOf = (boxes: any[]): { body: any; lens: any } | null => { const i = boxes.findIndex(b => b.rot && Math.abs(Math.max(b.h[0], b.h[1], b.h[2]) - 0.105) < 0.002 && Math.min(b.h[0], b.h[1], b.h[2]) < 0.03); return i < 0 || !boxes[i + 1] ? null : { body: boxes[i], lens: boxes[i + 1] }; };
/** the fist on a torch: `off` m from the fist's hollow to the body's line · `along` m along it from the body's middle · `thumb` degrees between the fist's thumb line and the body's */
const fistOn = (c: any, body: any) => { const ax = longAxis(body), d = sub(hollowOf(c), body.c), al = dot(d, ax); return { off: len([d[0] - ax[0] * al, d[1] - ax[1] * al, d[2] - ax[2] * al]), along: Math.abs(al), thumb: deg(Math.abs(dot(c.handFrameR().thumb, ax))) }; };

export async function gunhandWhistleCheck(): Promise<boolean> {
  const H: any = await import('./headless.ts');
  const { GUNHAND } = await import(`${ROOT}/src/game/gunhand.ts`);
  const { INHAND } = await import(`${ROOT}/src/game/inhand.ts`);
  const CH: any = await import(`${ROOT}/src/game/character.ts`);
  const RP: any = await import(`${ROOT}/src/game/rigProps.ts`);
  const CB: any = await import(`${ROOT}/src/game/combat.ts`);
  const GU: any = await import(`${ROOT}/src/game/guards.ts`);
  const KN: any = await import(`${ROOT}/src/game/knobs.ts`);
  const JO: any = await import(`${ROOT}/src/game/journal.ts`);
  const PROFILE: any = await import(`${ROOT}/src/host/profile.ts`);
  const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);
  const BREAK = process.env.GUNHAND_BREAK === '1', ON = !BREAK;
  let all = true; const f1 = (x: number) => x.toFixed(1);
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  console.log('\n=== gunhand-whistle: a guard answering a whistle brings the torch up in the hand that holds it ===');
  const knobs0 = KN.knobsCopy();
  try {
    // (1) the stand
    { await hushed(() => H.standUp({ uploadEvery: 4, seed: 1 })); const stood = GUNHAND.on;
      const shipped = process.env.TPS_PROFILE === 'shipped', env = process.env.TPS_GUNHAND, want = env !== undefined ? env === '1' : shipped, row = PROFILE.FROZEN_HOLDS['GUNHAND.on'];
      line(stood === want && GUNHAND.whistle === true && typeof row === 'string' && row.includes('TPS_GUNHAND=1') && (STAND_ENV as readonly string[]).includes('TPS_GUNHAND'), `(1) the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen probe was recorded'}; the key is on; FROZEN_HOLDS carries the row and its word`, `after the stand-up: on ${stood}, whistle ${GUNHAND.whistle} · row '${row}'`); }

    // ------------------------------------------------------------ the bench
    const ch: any = await H.loadCastCharacter(); const DT = 1 / 60;
    type Upper = 'none' | 'relaxed' | 'aim' | 'torch';
    interface Man { c: any; beam: V3; rule: boolean; key: boolean; last: number[] | null; sim: number[] | null }
    const man = (rule: boolean, key = true): Man => { const c = new CH.Character(ch, { id: 24, tint: [0.1, 0.1, 0.1], tint2: [0.05, 0.05, 0.05], pos: [0, 0, 0], yaw: 0 });
      c.anim.phase = 0; c.anim.trained = 0.12; c.anim.upper = 'none'; c.anim.stance = 'none'; c.anim.grip[1] = true; return { c, beam: [0, 0, 1], rule, key, last: null, sim: null }; };   // (grip: the torch is in his right fist — game.ts)
    /** one frame, as guards.ts and combat.ts drive him: the animator, the relaxed carry's beam, and what the in-hand pass is told for the next frame */
    const step = (m: Man, upper: Upper, speed: number, yaw: number, pitch: number) => { GUNHAND.on = m.rule; GUNHAND.whistle = m.key; INHAND.on = true; const c = m.c;
      c.anim.upper = upper; c.anim.speed = speed; c.aimYaw = yaw; c.aimPitch = pitch; c.inHand = RP.torchHold(m.beam); c.update(DT); m.beam = RP.torchCarryDir(c, m.beam, DT); };
    const boxes = (m: Man) => { const out: any[] = []; RP.rigBoxes(m.c, { goggles: false, nv: false, slot: 1, lightOn: true, isGuard: true, holster: false, torch: true, beamDir: m.beam, weapon: 'pistol' }, out, RP.RIG); return torchOf(out); };
    const simOf = (c: any) => JSON.stringify([c.bones, c.gunDir, c.muzzle]);
    interface Row { late: boolean; lUpOff: number; rDownOff: number; farOff: number; lStay: number; rUp: number; rAhead: number; off: number; along: number; thumb: number; lens: number; ahead: number; beam: number; turn: number; simTurn: number; back: number }
    const SETS: [string, number, number, number][] = [['standing', 0, 0, 0], ['walking', 1.2, 0, 0], ['looking aside and down', 0, 0.6, -0.25], ['walking, looking aside', 1.2, -0.5, 0]];
    const rows: Row[] = []; let frames = 0;
    for (const [name, speed, yaw, pitch] of SETS) { const r0 = rows.length;
      const N = man(ON), A = man(false), B = man(ON);
      for (let i = 0; i < 330; i++) {
        const up: Upper = i >= 60 && i < 210 ? 'torch' : 'none', k = Math.max(0, Math.min(1, (i - 60) / 45)), ay = yaw * k, ap = pitch * k;   // (he looks round as he answers: over three quarters of a second, as his AI eases it)
        step(N, 'none', speed, ay, ap); step(A, up, speed, ay, ap); step(B, up, speed, ay, ap); frames++;
        const n = B.c.anim.nodes, sh = B.c.skel.nodePos(n.upperArmR) as V3, tb = boxes(B), ta = boxes(A); if (!tb || !ta) { rows.push({ late: true } as Row); continue; }
        const fb = fistOn(B.c, tb.body), light = RP.rigTorchPos(B.c, B.beam, true) as V3, lightA = RP.rigTorchPos(A.c, A.beam, true) as V3;
        const r = B.c.skel.globalRot[n.handR], hs = B.c.handFrameR(true), s = [...hs.fingers, ...hs.back], turn = B.last ? qang(B.last, r) : 0, simTurn = B.sim ? Math.max(deg(dot(B.sim.slice(0, 3) as V3, hs.fingers)), deg(dot(B.sim.slice(3) as V3, hs.back))) : 0; B.last = [...r]; B.sim = s;
        rows.push({ late: i >= 120 && i < 210, lUpOff: A.c.bones.handL[1] - N.c.bones.handL[1], rDownOff: A.c.bones.handR[1] - (A.c.skel.nodePos(n.upperArmR) as V3)[1], farOff: len(sub(lightA, A.c.bones.handL)),
          lStay: len(sub(B.c.bones.handL, N.c.bones.handL)), rUp: B.c.bones.handR[1] - sh[1], rAhead: dot(sub(B.c.bones.handR, sh), [Math.sin(B.c.bodyYaw), 0, Math.cos(B.c.bodyYaw)]),
          off: fb.off, along: fb.along, thumb: fb.thumb, lens: len(sub(light, tb.lens.c)), ahead: dot(sub(light, hollowOf(B.c)), B.beam), beam: deg(dot(A.beam, B.beam)), turn, simTurn,
          back: i >= 300 ? len(sub(B.c.bones.handR, N.c.bones.handR)) : 0 });
      }
      if (process.argv.includes('--verbose')) { const L = rows.slice(r0).filter(r => r.late), M = (f: (r: Row) => number) => Math.max(...L.map(f)), m = (f: (r: Row) => number) => Math.min(...L.map(f));
        console.log(`    · ${name}: off — left up ${f1(m(r => r.lUpOff) * 100)} cm, right ${f1(M(r => r.rDownOff) * 100)} against its shoulder · on — left off the clip's ${f1(M(r => r.lStay) * 100)}, right ${f1(m(r => r.rUp) * 100)} up ${f1(m(r => r.rAhead) * 100)} ahead, hollow ${f1(M(r => r.off) * 100)}, thumb ${f1(M(r => r.thumb))}°, lens ${f1(M(r => r.lens) * 100)} · turn ${f1(Math.max(...rows.slice(r0).map(r => r.simTurn || 0)))}° / ${f1(Math.max(...rows.slice(r0).map(r => r.turn || 0)))}°`); }
    }
    const late = rows.filter(r => r.late), mx = (rs: Row[], f: (r: Row) => number) => rs.reduce((a, r) => Math.max(a, f(r)), 0), mn = (rs: Row[], f: (r: Row) => number) => rs.reduce((a, r) => Math.min(a, f(r)), Infinity);
    const whole = late.length === SETS.length * 90 && late.every(r => r.off !== undefined);
    // (2)
    line(whole && mn(late, r => r.lUpOff) > 0.25 && -mn(late, r => -r.rDownOff) < -0.35 && mn(late, r => r.farOff) > 0.3,
      '(2) rule off, the fault is there: the left wrist is up, the right — the torch\'s — hangs at his thigh, and the light is far from the raised fist',
      `left wrist above the legs' clip's: ${f1(mn(late, r => r.lUpOff) * 100)} cm at least · right wrist against its shoulder joint: ${f1(-mn(late, r => -r.rDownOff) * 100)} cm at most · the light from the raised fist: ${f1(mn(late, r => r.farOff) * 100)} cm at least · ${late.length} frames, ${SETS.map(s => s[0]).join(' · ')}`);
    // (3)
    line(whole && mx(late, r => r.lStay) <= 0.06, '(3) rule on, the free hand is free: the left wrist stays within a few centimetres of where the legs\' clip has it', `worst ${f1(mx(late, r => r.lStay) * 100)} cm (the clip still gives the trunk; 6 allowed) · ${late.length} frames`);
    // (4)
    line(whole && mn(late, r => r.rUp) >= -0.08 && mx(late, r => r.rUp) <= 0.15 && mn(late, r => r.rAhead) >= 0.12, '(4) rule on, the torch is up: the right wrist is at shoulder height, ahead of the shoulder',
      `wrist against the shoulder joint: ${f1(mn(late, r => r.rUp) * 100)} to ${f1(mx(late, r => r.rUp) * 100)} cm up · ${f1(mn(late, r => r.rAhead) * 100)} cm ahead at least`);
    // (5)
    line(whole && mx(late, r => r.off) <= 0.025 && mx(late, r => r.along) <= 0.105 && mx(late, r => r.thumb) <= 10, '(5) rule on, in the fist: the torch\'s body runs through the hollow of the right fist, the fist turned along it (the in-hand pass on)',
      `the hollow to the torch's line: worst ${f1(mx(late, r => r.off) * 100)} cm (2.5 allowed) · along it from the body's middle: ${f1(mx(late, r => r.along) * 100)} cm (the body is 21 long) · the fist's thumb line off the torch's: ${f1(mx(late, r => r.thumb))}°`);
    // (6)
    line(whole && mx(late, r => r.lens) <= 0.03 && mn(late, r => r.ahead) > 0.05 && mx(late, r => r.ahead) < 0.3 && mx(rows, r => r.beam || 0) < 0.01, '(6) rule on, the light: at the torch\'s lens, ahead of the fist along the beam; the beam is the line it was with the rule off',
      `the light to the lens: worst ${f1(mx(late, r => r.lens) * 100)} cm · ahead of the fist: ${f1(mn(late, r => r.ahead) * 100)} to ${f1(mx(late, r => r.ahead) * 100)} cm · the beam off the rule-off beam: ${mx(rows, r => r.beam || 0).toFixed(3)}°`);
    // (7)
    line(mx(rows, r => r.simTurn || 0) <= 12 && mx(rows, r => r.turn || 0) <= 16 && mx(rows, r => r.back || 0) <= 0.01, '(7) nothing in one frame: coming up and going down the right hand turns no faster than a hand does; down again it is where the legs\' clip has it',
      `the hand the game reads: ${f1(mx(rows, r => r.simTurn || 0))}° a frame at most (12 allowed) · as drawn: ${f1(mx(rows, r => r.turn || 0))}° (16) · back down, off the legs' clip's wrist: ${f1(mx(rows, r => r.back || 0) * 1000)} mm · ${frames} frames`);
    // (8)
    { let same = true, n = 0; const two = (upper: Upper, key: boolean) => { const A = man(false), B = man(true, key);
        for (let i = 0; i < 150; i++) { const u: Upper = i >= 30 && i < 110 ? upper : 'none', sp = i < 75 ? 0 : 1.2; step(A, u, sp, 0.3, 0); step(B, u, sp, 0.3, 0); n++; same &&= simOf(A.c) === simOf(B.c) && JSON.stringify(Array.from(A.c.skel.jointData as Float32Array)) === JSON.stringify(Array.from(B.c.skel.jointData as Float32Array)); } };
      two('none', true); two('relaxed', true); two('aim', true); two('torch', false);
      line(same, '(8) only the answer: every other carry is bit for bit the pose it was with the rule on, and so is the answer with the rule\'s key off', `none, the pistol's carry and its aim with the rule on, and the answer with whistle: false — against the rule off, ${n} frames, what the game reads and every drawn joint: ${same ? 'equal' : 'DIFFER'}`); }

    // ------------------------------------------------------------ the game
    const game = async (rule: boolean) => {
      const W: any = await hushed(() => H.standUp({ uploadEvery: 4, seed: 760 })); const g = W.game; GUNHAND.on = rule; GUNHAND.whistle = true; INHAND.on = true;   // (after the stand-up: the frozen stand pins both off)
      g.godMode = true; g.aiEnabled = true; g.playerInvisible = false; g.teleportPlayer([14, 0, 11.1]); g.player.visibility = 0; g.player.crouch = false;
      for (let i = 0; i < 10; i++) W.step(DT); g.player.visibility = 0;
      g.guards.slice(1).forEach((o: any, i: number) => { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [4.5, 0, 19 + i * 1.2]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; o.char.update(0); });
      const gd = g.guards[0], c = gd.char; c.pos = [20, 0, 11.1]; c.vel = [0, 0, 0]; gd.speed = 0; c.bodyYaw = c.aimYaw = Math.PI / 2; c.aimPitch = 0;
      gd.state = 'patrol'; gd.awareness = 0; gd.lastKnown = null; gd.reactT = 0; gd.searchT = 0; gd.task = null; gd.bodyDuty = null; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.pinned = false; gd.dazzledUntil = -1;
      c.update(0); c.update(DT); for (let i = 0; i < 3; i++) W.step(DT);
      W.input.pressed.add('KeyV'); W.step(DT);
      let got = 0, lUp = -Infinity, rUp = Infinity, lens = 0, off = 0, thumb = 0, carry = '', upper = '';
      for (let i = 0; i < 90; i++) { W.step(DT); const out: any[] = []; CB.handProps(g, out); if (i < 60) continue;
        const t = torchOf(out.filter(b => (b.owner & 0xff) === (c.id & 0xff))); carry = GU.handCarry(gd); upper = c.anim.upper; if (!t) continue; got++;
        const sh = c.bones.upperArmR, fo = fistOn(c, t.body); lUp = Math.max(lUp, c.bones.handL[1] - sh[1]); rUp = Math.min(rUp, c.bones.handR[1] - sh[1]);
        lens = Math.max(lens, len(sub(gd.flashlight.pos, t.lens.c))); off = Math.max(off, fo.off); thumb = Math.max(thumb, fo.thumb); }
      return { got, lUp, rUp, lens, off, thumb, carry, upper, g };
    };
    const g0 = await game(false), g1 = await game(ON);
    // (9)
    line(g0.got >= 25 && g1.got >= 25 && g1.carry === 'torch' && g1.upper === 'torch' && g0.lUp > -0.25 && g0.rUp < -0.35 && g1.lUp < -0.35 && g1.rUp > -0.08 && g1.lens <= 0.05 && g1.off <= 0.025 && g1.thumb <= 10,
      '(9) in the game, a whistle answered: rule off the left wrist is up and the torch hand hangs; on, the torch hand is up and the left is down, his light is at the lens of the torch as drawn and the torch is in the fist',
      `rule off: left wrist ${f1(g0.lUp * 100)} cm against the gun shoulder, right ${f1(g0.rUp * 100)} · rule on: left ${f1(g1.lUp * 100)}, right ${f1(g1.rUp * 100)} · his light to the drawn lens ${f1(g1.lens * 100)} cm (off: ${f1(g0.lens * 100)}) · the fist's hollow to the torch's line ${f1(g1.off * 100)} cm, thumb line ${f1(g1.thumb)}° off it · carrying ${g1.carry}, upper '${g1.upper}' · ${g1.got} frames each`);
    // (10)
    { const g = g1.g, snap = () => JSON.parse(JSON.stringify(JO.knobsSnapshot(g)));
      GUNHAND.on = true; const old = snap(); delete old.tables.GUNHAND; JO.applyKnobs(g, old); const without = GUNHAND.on;
      GUNHAND.on = true; const own = snap(); GUNHAND.on = false; JO.applyKnobs(g, own); const withIt = GUNHAND.on;
      PROFILE.pageSwitches(new URLSearchParams('')); const a = GUNHAND.on; PROFILE.pageSwitches(new URLSearchParams('gunhand=0')); const b = GUNHAND.on;
      line(without === false && withIt === true && a === true && b === false, '(10) a recording from before the key replays with the rule off, one that carries it keeps it; the page opens with it on and ?gunhand=0 puts it off', `applyKnobs with no key → ${without} · with it on → ${withIt} · '' → ${a} · 'gunhand=0' → ${b}`); }
  } finally { KN.knobsBack(knobs0); }
  return all;
}

if (import.meta.main) process.exit((await gunhandWhistleCheck()) ? 0 : 1);
