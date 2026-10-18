// tools/qa/gunhand-throw-check.ts — a man with a long gun in his hands throws with the hand that is not on its grip
// (src/game/gunhand.ts GUNHAND.on + GUNHAND.throwFree; character.ts throwItem / throwLayer / throwOff; frag.ts fragThrowTick, fragInFist; rigProps.ts freeCanBoxes;
//  combat.ts guardKit).
//
// The fault: the throw is one move for everybody and its throwing arm is the right one. A defender with a carbine threw overhand with the carbine still drawn off
// the throwing fist — the gun went up behind his head and over the top with the grenade.
//
// THE BENCH (no game: a defender's figure with the carbine, driven the way the controllers drive the animator; two figures stepped by the same calls, the rule off
// and on; IN HAND's long hold on for both, as the page has it):
//   (1) the stand: the switch as the stand says, FROZEN_HOLDS carries its row and word, the word is in STAND_ENV;
//   (2) rule off, the fault is there: in the overhand the carbine's grip rides up over the shoulder with the throwing wrist;
//   (3) rule on, THE GUN STAYS IN THE TRIGGER HAND, LOWERED: through every frame of every throw the carbine's grip is within 1.5 cm of that hand's palm and that
//       wrist stays below its shoulder;
//   (4) rule on, THE OTHER HAND THROWS: the left wrist goes up over its shoulder in the overhand and is out ahead of him at the release in every one;
//   (5) rule on, THE CAN IS IN THAT HAND: until the release the throw is the free hand's by the animator's own word (throwOff: what the drawer asks before it
//       draws one) and the can's box (rigProps freeCanBoxes) is in the left fist;
//   (6) THE SAME THROW: which swing, the frame it lets go and the frame it ends are the same with the rule off and on;
//   (7) THE KEY: the switch on and `throwFree` off poses him, and everything the game reads off him, bit for bit as the switch off does.
// THE GAME (frag-theirs' corridor: a defender dealt the carbine, alert on two of the team bunched in his view):
//   (8) rule off and on the same man throws, the grenade leaves him the same time after his shout and comes down in the same place;
//   (9) rule on it starts within a hand's breadth of the hand that threw it (off: from the point ahead of his chest it always did), the grenade is drawn in that
//       fist until it leaves, and the trigger hand's wrist stays below its shoulder through the throw;
//   (10) a recording from before the switch replays with it off, one that carries it keeps it; the page opens with it on and ?gunhand=0 puts it off.
//
//   bun run tools/qa/gunhand-throw-check.ts [--verbose]     (both stands: it raises the switch itself)
//   GUNHAND_BREAK=1 …                                       (the key left off for the 'on' lines: (3), (4), (5) and (9) must fail)
// Headless: poses and boxes are measured, nothing here is a picture. Never seen on a GPU or in play.
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
/** a joint as the picture has it, in the world (the look-only pass may have moved a hand off bones.*) */
const drawn = (c: any, node: number): V3 => { const w = c.world, p = c.skel.nodePos(node); return [w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]]; };
/** the hollow of a fist: 9 cm along the fingers from the wrist, 3 cm out of the palm */
const hollow = (wrist: V3, hf: { fingers: V3; back: V3 }): V3 => [0, 1, 2].map(i => wrist[i] + hf.fingers[i] * 0.09 - hf.back[i] * 0.03) as V3;
const FRAG_BODY = [0.13, 0.17, 0.08];   // (rigProps heldCanBoxes: the grenade's body)

export async function gunhandThrowCheck(): Promise<boolean> {
  const H: any = await import('./headless.ts');
  const { GUNHAND } = await import(`${ROOT}/src/game/gunhand.ts`);
  const { INHAND } = await import(`${ROOT}/src/game/inhand.ts`);
  const CH: any = await import(`${ROOT}/src/game/character.ts`);
  const RP: any = await import(`${ROOT}/src/game/rigProps.ts`);
  const CB: any = await import(`${ROOT}/src/game/combat.ts`);
  const FR: any = await import(`${ROOT}/src/game/frag.ts`);
  const KN: any = await import(`${ROOT}/src/game/knobs.ts`);
  const JO: any = await import(`${ROOT}/src/game/journal.ts`);
  const PROFILE: any = await import(`${ROOT}/src/host/profile.ts`);
  const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);
  const VERBOSE = process.argv.includes('--verbose'), BREAK = process.env.GUNHAND_BREAK === '1', KEY = !BREAK;
  let all = true; const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2), cm = (x: number) => f1(x * 100);
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  console.log(`\n=== gunhand-throw: a man with a long gun in his hands throws with the hand that is not on its grip${BREAK ? ' (GUNHAND_BREAK: the key left off)' : ''} ===`);
  const knobs0 = KN.knobsCopy();
  try {
    // (1) the stand — asked first, before anything here writes the switch
    { const W: any = await hushed(() => H.standUp({ uploadEvery: 4, seed: 1 })); void W; const stood = GUNHAND.on;
      const shipped = process.env.TPS_PROFILE === 'shipped', env = process.env.TPS_GUNHAND, want = env !== undefined ? env === '1' : shipped, row = PROFILE.FROZEN_HOLDS['GUNHAND.on'];
      line(stood === want && GUNHAND.throwFree === true && typeof row === 'string' && row.includes('TPS_GUNHAND=1') && (STAND_ENV as readonly string[]).includes('TPS_GUNHAND'), `(1) the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen probe was recorded'}; FROZEN_HOLDS carries the row and its word`, `after the stand-up: ${stood} · throwFree ${GUNHAND.throwFree} · row '${row}'`); }

    // ------------------------------------------------------------ the bench
    const ch: any = await H.loadCastCharacter(); const DT = 1 / 60, REL = CH.THROW_RELEASE as number;
    const man = (): any => { const c = new CH.Character(ch, { id: 24, tint: [0.1, 0.1, 0.1], tint2: [0.05, 0.05, 0.05], pos: [0, 0, 0], yaw: 0 }), a = c.anim;
      a.phase = 0; a.trained = 0.12; a.upper = 'none'; a.stance = 'none'; a.longGun = true; a.longSteady = 0; a.longGrip = RP.carbineGrip(); c.muzzleAhead = RP.carbineMuzzleAhead(); return c; };
    interface Rule { on: boolean; key: boolean }
    const set = (r: Rule) => { GUNHAND.on = r.on; GUNHAND.throwFree = r.key; INHAND.on = true; INHAND.long = true; };
    const step = (c: any, r: Rule) => { set(r); c.inHand = RP.longHold('carbine'); if (c.vel) c.pos = [c.pos[0] + c.vel[0] * DT, c.pos[1], c.pos[2] + c.vel[2] * DT]; c.update(DT); };
    const simOf = (c: any) => JSON.stringify([c.bones, c.gunDir, c.muzzle, c.pos, c.bodyYaw, c.aimYaw]);
    const palette = (c: any) => Array.from(c.skel.jointData as Float32Array).reduce((a: number, x: number) => (Math.imul(a, 31) + Math.round(x * 1e5)) | 0, 7);
    interface Row { t: number; held: boolean; free: boolean; read: string | null; gap: number; wrR: number; gripUp: number; wrL: number; aheadL: number; can: number; sim: string; pal: number }
    const read = (c: any): Row => { const n = c.anim.nodes, a = c.anim, meta: any[] = [], bx: any[] = [];
      RP.rigBoxes(c, { goggles: false, nv: false, slot: 1, lightOn: false, isGuard: true, holster: false, weapon: 'carbine' }, bx, RP.RIG, meta);
      const gm = meta.find(x => /\.grip$/.test(x.path)), grip: V3 = gm ? bx[gm.boxStart].c : [0, 0, 0];
      const wR = drawn(c, n.handR), sR = drawn(c, n.upperArmR), wL = drawn(c, n.handL), sL = drawn(c, n.upperArmL), f = c.forward();
      const cans: any[] = [], cm2: any[] = []; RP.freeCanBoxes(c, 'frag', cans, cm2); const body = cans[cm2.find(x => x.path === 'can.body')?.boxStart ?? 0];
      return { t: a.throwTime, held: a.throwing && a.throwTime < REL, free: a.throwOff, read: a.throwRead, gap: len(sub(grip, hollow(wR, c.handFrameR()))), wrR: wR[1] - sR[1], gripUp: grip[1] - sR[1], wrL: wL[1] - sL[1],
        aheadL: (wL[0] - sL[0]) * f[0] + (wL[2] - sL[2]) * f[2], can: body ? len(sub(body.c, hollow(wL, c.handFrameL()))) : 9, sim: simOf(c), pal: palette(c) }; };
    interface Script { name: string; over: boolean; pre: (c: any) => void; dist?: number; by?: boolean }
    const aim = (c: any) => { c.anim.upper = 'aim'; }, low = (c: any) => { c.anim.stance = 'lowReady'; };
    const SCRIPTS: Script[] = [
      { name: 'aimed', over: true, pre: aim }, { name: 'low ready', over: true, pre: low }, { name: 'calm carry', over: true, pre: () => { } },
      { name: 'crouched', over: true, pre: c => { aim(c); c.anim.crouchTarget = 1; } }, { name: 'walking', over: true, pre: c => { aim(c); c.anim.speed = 1.4; c.vel = [0, 0, 1.4]; } },
      { name: 'a short one', over: true, pre: aim, dist: 5, by: true }, { name: 'a toss', over: false, pre: aim, dist: 1.5, by: true },
    ];
    /** one script on three figures stepped by the same calls: the switch off · on with the key (as asked: BREAK leaves it off) · on with the key off */
    const play = (S: Script): { off: Row[]; on: Row[]; keyOff: Row[] } => {
      const rules: Rule[] = [{ on: false, key: true }, { on: true, key: KEY }, { on: true, key: false }], men = rules.map(() => man()), rows: Row[][] = [[], [], []];
      CH.THROW_BY.on = !!S.by;
      for (const c of men) S.pre(c);
      for (let i = 0; i < 60; i++) men.forEach((c, k) => step(c, rules[k]));
      men.forEach((c, k) => { set(rules[k]); c.anim.throwItem(S.dist); });
      for (let i = 0; i < 90 && (i < 2 || men.some(c => c.anim.inThrow)); i++) { men.forEach((c, k) => { step(c, rules[k]); if (c.anim.inThrow) rows[k].push(read(c)); }); }
      return { off: rows[0], on: rows[1], keyOff: rows[2] };
    };
    const runs = SCRIPTS.map(S => ({ S, ...play(S) }));
    const mx = (rs: Row[], f: (r: Row) => number) => rs.reduce((a, r) => Math.max(a, f(r)), -9), mn = (rs: Row[], f: (r: Row) => number) => rs.reduce((a, r) => Math.min(a, f(r)), 9);
    const atRel = (rs: Row[]) => rs.reduce((b, r) => Math.abs(r.t - REL) < Math.abs(b.t - REL) ? r : b, rs[0]);
    // (2) the fault
    { const ov = runs.filter(r => r.S.over && !r.S.by), say = ov.map(r => `${r.S.name}: the grip ${cm(mx(r.off, x => x.gripUp))} cm over the shoulder joint at its highest, the throwing wrist ${cm(mx(r.off, x => x.wrR))} cm over · grip to palm up to ${cm(mx(r.off, x => x.gap))} cm`);
      line(ov.every(r => mx(r.off, x => x.gripUp) > 0.1 && mx(r.off, x => x.wrR) > 0.1), '(2) rule off, the fault is there: in the overhand the carbine\'s grip rides up over the shoulder with the throwing wrist', say.join('\n    ')); }
    // (3) the gun stays in the trigger hand, lowered
    { const say = runs.map(r => `${r.S.name}: grip to the palm's hollow ${cm(mx(r.on, x => x.gap))} cm at worst · the trigger wrist ${cm(-mx(r.on, x => x.wrR))} cm below its shoulder at its highest · ${r.on.length} frames`);
      line(runs.every(r => r.on.length > 30 && mx(r.on, x => x.gap) <= 0.015 && mx(r.on, x => x.wrR) < 0), '(3) rule on: through every frame of every throw the carbine\'s grip is within 1.5 cm of the trigger hand\'s palm and that wrist stays below its shoulder', say.join('\n    ')); }
    // (4) the other hand throws
    { const say = runs.map(r => `${r.S.name} (${atRel(r.on).read}): the left wrist ${cm(mx(r.on, x => x.wrL))} cm over its shoulder at its highest (rule off ${cm(mx(r.off, x => x.wrL))}), ${cm(atRel(r.on).aheadL)} cm ahead of it at the release (rule off ${cm(atRel(r.off).aheadL)})`);
      line(runs.every(r => atRel(r.on).aheadL > 0.3 && (!r.S.over || r.S.by || mx(r.on, x => x.wrL) > 0.1)), '(4) rule on, the other hand throws: the left wrist goes up over its shoulder in the overhand, and is out ahead of him at the release in every one', say.join('\n    ')); }
    // (5) the can is in that hand
    { const held = (rs: Row[]) => rs.filter(r => r.held), say = runs.map(r => `${r.S.name}: ${cm(mx(held(r.on), x => x.can))} cm from the left fist's hollow at worst over ${held(r.on).length} frames (rule off, that fist is not where the throw is: the right wrist is ${cm(mx(held(r.off), x => x.wrR))} cm over its shoulder)`);
      line(runs.every(r => held(r.on).length >= 12 && held(r.on).every(x => x.free) && mx(held(r.on), x => x.can) <= 0.06) && runs.every(r => r.off.every(x => !x.free)), '(5) rule on: until the release the throw is the free hand\'s by the animator\'s own word (what the drawer asks) and the can\'s box is in the left fist', say.join('\n    ')); }
    // (6) the same throw
    { const sig = (rs: Row[]) => rs.map(r => `${r.read}${r.held ? 'h' : '-'}`).join(''), say = runs.map(r => `${r.S.name}: ${atRel(r.off).read} / ${atRel(r.on).read} · in the hand ${r.off.filter(x => x.held).length} / ${r.on.filter(x => x.held).length} frames · the swing ${r.off.length} / ${r.on.length} frames`);
      line(runs.every(r => sig(r.off) === sig(r.on) && r.off.length === r.on.length && r.off.every((x, i) => x.t === r.on[i].t)), '(6) the same throw: which swing, the frame it lets go and the frame it ends are the same with the rule off and on', say.join('\n    ')); }
    // (7) the key
    { const same = runs.every(r => r.off.length === r.keyOff.length && r.off.every((x, i) => x.sim === r.keyOff[i].sim && x.pal === r.keyOff[i].pal)), moved = runs.filter(r => r.off.some((x, i) => x.pal !== r.on[i]?.pal)).length;
      line(same && (BREAK || moved === runs.length), '(7) the key: the switch on and throwFree off poses him, and all the game reads off him, bit for bit as the switch off does', `${runs.reduce((a, r) => a + r.off.length, 0)} frames over ${runs.length} throws · with the key on the pose differs in ${moved} of ${runs.length}`); }
    if (VERBOSE) for (const r of runs) console.log(`    [${r.S.name}] t / wrR off→on / wrL off→on / gap on / can on\n` + r.on.filter((_x, i) => i % 4 === 0).map((x, i) => `      ${f2(x.t)}  ${cm(r.off[i * 4].wrR)}→${cm(x.wrR)}  ${cm(r.off[i * 4].wrL)}→${cm(x.wrL)}  ${cm(x.gap)}  ${cm(x.can)}`).join('\n'));

    // ------------------------------------------------------------ the game
    const FP: any = await import('./frag-probes.ts');
    const game = async (rule: boolean, seed: number) => {
      const S: any = await hushed(() => FP.theirsCorridor(seed, true)); const g = S.g, C = S.C, R = S.R; set({ on: rule, key: rule ? KEY : true });   // (after the stand-up: the frozen stand pins the switch off, the shipped one on)
      try {
        let shoutT = NaN; { const say = g.say.bind(g); g.say = (gd: any, text: string, radio?: boolean) => { if (gd === C && isNaN(shoutT) && /out|hole/i.test(text)) shoutT = g.time; return say(gd, text, radio); }; }
        let out: { t: number; from: V3; hl: V3; hr: V3; who: number } | null = null;
        { const sp = g.items.spawn.bind(g.items); g.items.spawn = (kind: string, from: V3, v0: V3, o: any) => { if (kind === 'frag' && !out) out = { t: g.time, from: [...from] as V3, hl: [...C.char.bones.handL] as V3, hr: [...C.char.bones.handR] as V3, who: o?.who }; return sp(kind, from, v0, o); }; }
        let frames = 0, fist = 0, canWorst = 0, wrR = -9, wrL = -9, long = true; const n0 = FR.FRAG_LOG.length;
        await hushed(() => { for (let i = 0; i < 14 * 60 && FR.FRAG_LOG.length === n0; i++) { R.step();
          const c = C.char, a = c.anim; if (!a.inThrow) continue; frames++; long &&= a.longGun;
          const b = c.bones; wrR = Math.max(wrR, b.handR[1] - b.upperArmR[1]); wrL = Math.max(wrL, b.handL[1] - b.upperArmL[1]);
          if (!FR.fragInFist(g, C)) continue;
          const bx: any[] = []; CB.handProps(g, bx); const can = bx.find(x => (x.owner & 0xff) === (c.id & 0xff) && FRAG_BODY.every((v, k) => Math.abs(x.albedo[k] - v) < 1e-6));
          if (can) { fist++; canWorst = Math.max(canWorst, len(sub(can.c, hollow(drawn(c, a.nodes.handL), c.handFrameL())))); } } });
        const rep = FR.FRAG_LOG[n0] ?? null, o = out as { t: number; from: V3; hl: V3; hr: V3; who: number } | null;
        return { who: C.callsign as string, long, lead: o ? o.t - shoutT : NaN, out: o, at: rep ? [...rep.at] as V3 : null, frames, fist, canWorst, wrR, wrL };
      } finally { S.restore(); }
    };
    type Run = Awaited<ReturnType<typeof game>>; const runsG: { a: Run; b: Run | null }[] = []; let seed = 0;
    for (const s of [3, 5, 8, 11]) { seed = s; const x = await game(false, s); if (!x.out || !x.at) { runsG.push({ a: x, b: null }); continue; } const y = await game(true, s); runsG.push({ a: x, b: y }); if (y.out && y.at) break; }
    const { a, b } = runsG[runsG.length - 1];
    if (!a.out || !a.at || !b || !b.out || !b.at) line(false, '(8) staging: a defender with the carbine throws', `rule off: ${a.out ? 'thrown' : 'no throw'} · rule on: ${b?.out ? 'thrown' : 'no throw'} · seeds tried ${runsG.length}`);
    else {
      const flat = (p: V3, q: V3) => Math.hypot(p[0] - q[0], p[2] - q[2]);
      line(a.who === b.who && a.long && b.long && a.out.who === b.out.who && Math.abs(a.lead - b.lead) < 1e-6 && Math.abs(a.lead - FR.FRAG.defWind) < 0.05 && flat(a.at, b.at) <= 1 && a.frames === b.frames,
        '(8) in the game, rule off and on: the same man throws, the grenade leaves him the same time after his shout and comes down in the same place', `seed ${seed}: ${a.who} / ${b.who}, the carbine in his hands · ${f2(a.lead)} / ${f2(b.lead)} s after the shout (${FR.FRAG.defWind} asked) · bursts ${f2(flat(a.at, b.at))} m apart · the swing ${a.frames} / ${b.frames} frames`);
      line(len(sub(b.out.from, b.out.hl)) <= 0.1 && b.fist >= 10 && b.canWorst <= 0.06 && b.wrR < 0 && b.wrL > 0.1 && a.fist === 0,
        '(9) rule on: it starts within a hand\'s breadth of the hand that threw it, the grenade is drawn in that fist until it leaves, and the trigger hand\'s wrist stays below its shoulder',
        `rule on: starts ${cm(len(sub(b.out.from, b.out.hl)))} cm from the left hand (${cm(len(sub(b.out.from, b.out.hr)))} from the right) · in the left fist ${b.fist} frames, ${cm(b.canWorst)} cm from its hollow at worst · the trigger wrist ${cm(-b.wrR)} cm below its shoulder at its highest, the left ${cm(b.wrL)} cm over its own\n    rule off: starts ${cm(len(sub(a.out.from, a.out.hr)))} cm from the right hand (${cm(len(sub(a.out.from, a.out.hl)))} from the left) · no can drawn (${a.fist} frames) · the right wrist ${cm(a.wrR)} cm over its shoulder, the carbine in it`);
    }
    // (10) recordings and the page
    { const W: any = await hushed(() => H.standUp({ uploadEvery: 4, seed: 1 })), g = W.game, snap = () => JSON.parse(JSON.stringify(JO.knobsSnapshot(g)));
      GUNHAND.on = true; const old = snap(); delete old.tables.GUNHAND; JO.applyKnobs(g, old); const without = GUNHAND.on;
      GUNHAND.on = true; const own = snap(); GUNHAND.on = false; JO.applyKnobs(g, own); const withIt = GUNHAND.on;
      PROFILE.pageSwitches(new URLSearchParams('')); const p1 = GUNHAND.on; PROFILE.pageSwitches(new URLSearchParams('gunhand=0')); const p0 = GUNHAND.on;
      line(without === false && withIt === true && p1 === true && p0 === false, '(10) a recording from before the switch replays with it off, one that carries it keeps it; the page opens with it on and ?gunhand=0 puts it off', `applyKnobs with no table → ${without} · with it on → ${withIt} · '' → ${p1} · gunhand=0 → ${p0}`); }
  } finally { KN.knobsBack(knobs0); }
  console.log(`=== gunhand-throw: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await gunhandThrowCheck()) ? 0 : 1);
