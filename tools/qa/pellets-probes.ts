// The 'pellets' family (`bun run tools/qa/probes.ts pellets | pellets-arm | pellets-rule | pellets-energy | pellets-shield | pellets-identity | pellets-red`):
// A LOAD OF SHOT AND A PANE (src/game/glasspen.ts 'the shell rule', shotgun.ts, glassbreak.ts widen; rebuild/gear-and-glass/pellets.md) — a shell's nine pellets
// leave one honest set of holes in glass. All headless, on the real game stood up with the glass parts ON (each probe raises them by name and the stand-up of the
// next game puts them back), PASS / FAIL each with the numbers.
//   pellets-arm        the muzzle pressed through a pane (shoulder one side, muzzle the other): one shell files ONE crossing at the arm point — one blow in the
//                      fracture model, one hole remembered, one exit jet, one 'glass' event — and all nine pellets fly on from the muzzle (the man beyond drops);
//                      a laminated sheet across the arm takes the shell as one mark and lets nothing by
//   pellets-rule       one shell at a plain (annealed), a toughened (tempered) and a laminated pane from 1, 4 and 8 m, many shells each on a mended pane: every
//                      pellet that met the glass is in the shell's record, through or stopped; the record obeys the rule (a mark is never on another mark of
//                      its shell, a joiner always is); the fracture model was given exactly the marks, the holes and the jets exactly the marks that went
//                      through, one hearing event a pane a shell. A shell with pellets BOTH through and stopped in one pane (toughened glass raked at its
//                      limit) is held to the same rule. Prints the table the page quotes: what a shell does to each glass at each range
//   pellets-energy     GLASSPEN.energy.m870 is written down and means what the page says: one plain or toughened sheet square-on, never a second standing
//                      one, never laminated; other rows untouched; a man behind plain glass is dropped by a shell, a man behind the laminated sidelight is not
//   pellets-shield     shield.ts shieldLost: a round turned in glass on its way to a shield man's flank is logged on the bearing of the LEG it reached him on,
//                      not the muzzle's; a round that crossed no glass logs as it always did
//   pellets-identity   glass parts off, a shell at each pane = the word frozen on 0ee0094; glass on and no shotgun in anybody's hands (rifle rounds through
//                      the same panes) = the word frozen on 0ee0094
//   pellets-red        the red paths: with the rule switched off (GLASSPEN.shellR 0) the arm check DOES go red (nine blows at one point); the record
//                      checker flags a doctored record; with the m870 entry taken out the energy check goes red
//   bun run tools/qa/pellets-probes.ts --words     prints the two identity words (run on the base commit to freeze them)
import { standUp, ROOT, fake } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { glassPanes, isSheet, GLASSFX, GLASS, resetGlass } = await import(`${ROOT}/src/game/glass.ts`);
const PEN = await import(`${ROOT}/src/game/glasspen.ts`);
const { GLASSPEN, GLASSPEN_STATS, GLASSPEN_HOOKS, paneToll, paneType, roundEnergy, holeCount, resetGlassPen, shotPasses } = PEN;
const { GB_STATS, GLASSBREAK } = await import(`${ROOT}/src/game/glassbreak.ts`);
const GB_BREAK: number = GLASSBREAK.breakE.annealed;
const { fireWeapon, armThrough } = await import(`${ROOT}/src/game/combat.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const { SHOTGUN_LAST, SHOTGUN_STATS } = await import(`${ROOT}/src/game/shotgun.ts`);
const SH = await import(`${ROOT}/src/game/shield.ts`);
const PM = await import(`${ROOT}/src/render/particles.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);

type Vec3 = [number, number, number];
type PaneKind = 'annealed' | 'tempered' | 'laminated';
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hashStr = (s: string): number => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x)), f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const PEN_SHIPPED = JSON.parse(JSON.stringify(GLASSPEN)), FX_SHIPPED = GLASSFX.on;
/** every probe leaves the glass switches and numbers as the module ships them, pass, fail or throw */
const guarded = (fn: () => Promise<boolean>) => async () => { const hook = GLASSPEN_HOOKS.crossed, stats = { ...SHOTGUN_STATS }; try { return await fn(); } finally { Object.assign(SHOTGUN_STATS, stats); for (const k of Object.keys(GLASSPEN)) if (!(k in PEN_SHIPPED)) delete (GLASSPEN as any)[k]; Object.assign(GLASSPEN, JSON.parse(JSON.stringify(PEN_SHIPPED))); GLASSFX.on = FX_SHIPPED; GLASSPEN_HOOKS.crossed = hook; } };

interface Pane { bi: number; b: any; kind: PaneKind; /** unit, off the face the shot comes at */ out: Vec3; /** the point of the sheet shot at */ p: Vec3; /** clear metres off that face */ room: number; /** that point is chest high (a man can stand at it), not up in a clerestory */ chest: boolean }
/** One office under a seed, the glass parts as asked (all on by default), Sam unseen, everybody parked well away, AI off. */
async function stage(seed: number, parts: { fx?: boolean; pen?: boolean; brk?: boolean; shards?: boolean } = {}) {
  Math.random = seeded(seed);
  const W: any = await standUp(); const { game, engine } = W;
  engine.particles = new PM.Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  // (the stand-up has just put the three parts off and chaos at 0: what a probe needs goes on here, by name)
  GLASSFX.on = parts.fx ?? true; GLASSPEN.on = parts.pen ?? true; game.tune.glassBreak = parts.brk ?? true; game.tune.glassShards = parts.shards ?? true; game.tune.chaos = 0.5;
  game.godMode = true; game.aiEnabled = false; game.player.visibility = 0.02;
  for (let i = 0; i < 5; i++) W.step(DT);
  const park = () => game.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; gd.flashlight.enabled = false; gd.char.update(0); });
  park();
  const P = engine.particles, seen = new WeakSet<any>(), events: any[] = [];
  const step = (n = 1) => { for (let i = 0; i < n; i++) { game.player.visibility = 0.02; W.step(DT); P.pending.length = 0; P.pendingImpulses.length = 0; for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); events.push(e); } } };
  const jets: any[] = []; const hook = GLASSPEN_HOOKS.crossed; GLASSPEN_HOOKS.crossed = (g: any, x: any, who: number) => { jets.push(x); hook?.(g, x, who); };
  const gb = game.glassBreak;
  /** every pane whole again, nothing remembered */
  const mend = () => { gb.reset(); resetGlassPen(game); resetGlass(game); game.decals.clear(); jets.length = 0; };
  /** ONE PULL from a muzzle put at `from`, aimed at `to`, the shoulder a forearm behind it on the line (or where `shoulder` says): the player's own round, no spread */
  const fire = (from: Vec3, to: Vec3, gun = 'm870', shoulder?: Vec3) => {
    const c = game.player.char, m0 = c.muzzle, a0 = c.bones.upperArmR, d = v3.normalize(v3.sub(to, from));
    c.muzzle = [...from] as Vec3; c.bones.upperArmR = shoulder ?? v3.mad(from, d, -0.3);
    try { fireWeapon(game, c, to, true, { weapon: (WEAPONS as any)[gun] }); } finally { c.muzzle = m0; c.bones.upperArmR = a0; }
    step(1);
  };
  /** a sheet of `kind` with `need` m of clear floor off one face — a chest-high one before a clerestory, then the most room; null if the level has none */
  const pane = (kind: PaneKind, need = 0, skip: number[] = []): Pane | null => {
    let best: Pane | null = null;
    for (const bi of glassPanes(game) as number[]) {
      const b = game.level.boxes[bi]; if (skip.includes(bi) || !isSheet(b) || paneType(game, b) !== kind) continue;
      const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw), n: Vec3 = b.h[0] < b.h[2] ? [cs, 0, -sn] : [sn, 0, cs];
      const chest = b.c[1] - b.h[1] < 1.1 && b.c[1] + b.h[1] > 1.6; const p: Vec3 = [b.c[0], chest ? 1.35 : b.c[1], b.c[2]];
      for (const s of [1, -1]) {
        const out = v3.scale(n, s) as Vec3; let room = 0;
        for (const D of [9, 8.9, 6, 4.9, 3, 2, 1.9]) { const from = v3.mad(p, out, D) as Vec3; const h = game.col.raycast(from, v3.scale(out, -1), D + 1); if (h && h.index === bi && Math.abs(h.t - (D - Math.min(b.h[0], b.h[2]))) < 0.02) { room = D; break; } }
        if (room >= need + 0.85 && (!best || (chest && !best.chest) || (chest === best.chest && room > best.room))) best = { bi, b, kind, out, p, room, chest };
      }
    }
    return best;
  };
  /** a parked man stood `back` m behind the pane on the shot's line, facing it (he notices nothing) */
  const behind = (X: Pane, back: number, i = 0): any => {
    const gd = game.guards[i]; const at = v3.mad([X.p[0], 0, X.p[2]], X.out, -back) as Vec3;
    gd.char.pos = at; gd.char.vel = [0, 0, 0]; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(X.out[0], X.out[2]); gd.char.update(0); gd.char.update(DT);
    return gd;
  };
  return { W, game, engine, gb, step, fire, pane, behind, mend, park, events, jets };
}
type Stage = Awaited<ReturnType<typeof stage>>;

/** what ONE shell did to pane X (read straight after the pull; `settle` frames later for the pane's end state) */
interface ShellOut {
  /** the shell's own record on this pane: [x, y, z, through, mark] per pellet that met it (null: this build keeps none) */ rec: number[] | null;
  met: number; through: number; stopped: number; marks: number; joined: number; marksThrough: number; /** pellets that stopped on a mark of their own shell (their energy is filed on it, nothing else) */ joinedStopped: number;
  /** pellets that flew more than a metre from the muzzle before they ended */ flew: number;
  /** blows the fracture model was given on this pane · crack stars drawn on it · holes remembered · exit jets · 'glass' hearing events · crack voices */ blows: number; stars: number; holes: number; jets: number; events: number;
  /** pellets that ended in this pane (shotgun.ts SHOTGUN_LAST.ends) · that ended beyond its far face */ endIn: number; endBeyond: number;
  energy: number; run: boolean; diced: boolean; open: number;
}
function shellAt(S: Stage, X: Pane, from: Vec3, to: Vec3, settle = 0, shoulder?: Vec3): ShellOut {
  const { game, gb } = S; const st0 = gb.panes.get(X.bi); const starsOn = () => game.decals.list.filter((d: any) => d.kind === 'glassHit' && d.pane === X.bi).length; const s0 = starsOn(); const b0 = st0?.hits ?? 0, h0 = holeCount(game, X.bi), j0 = S.jets.filter((x: any) => x.bi === X.bi).length, half0 = Math.min(X.b.h[0], X.b.h[2]), evOn = () => S.events.filter((e: any) => e.kind === 'glass' && e.level === GLASS.hearLevel && Math.abs(v3.dot(v3.sub(e.pos, X.b.c), X.out)) < half0 + 0.02 && Math.hypot(e.pos[0] - X.b.c[0], e.pos[2] - X.b.c[2]) < Math.max(X.b.h[0], X.b.h[2]) + 0.05).length, e0 = evOn();   // (the HIT events of THIS pane: a wide pattern also finds the sheet next door, and a pane coming down is its own, louder event)
  S.fire(from, to, 'm870', shoulder);
  const st = gb.panes.get(X.bi); const rec: number[] | null = SHOTGUN_LAST.glass ? (SHOTGUN_LAST.glass.get(X.bi) ?? []) : null;
  const rows = rec ? rec.length / 5 : 0; let through = 0, marks = 0, marksThrough = 0, joinedStopped = 0;
  for (let i = 0; rec && i < rec.length; i += 5) { if (rec[i + 3]) through++; if (rec[i + 4]) { marks++; if (rec[i + 3]) marksThrough++; } else if (!rec[i + 3]) joinedStopped++; }
  const half = Math.min(X.b.h[0], X.b.h[2]); const ends: any[] = SHOTGUN_LAST.ends;
  const endIn = ends.filter(e => e.index === X.bi).length, endBeyond = ends.filter(e => e.index !== X.bi && v3.dot(v3.sub(e.at, X.p), X.out) < -half - 1e-4).length;
  const out: ShellOut = { rec, met: rows, through, stopped: rows - through, marks, joined: rows - marks, marksThrough, joinedStopped, flew: ends.filter(e => e.t > 1).length,
    blows: (st?.hits ?? 0) - b0, stars: starsOn() - s0, holes: holeCount(game, X.bi) - h0, jets: S.jets.filter((x: any) => x.bi === X.bi).length - j0, events: evOn() - e0,
    endIn, endBeyond, energy: 0, run: false, diced: false, open: 0 };
  if (settle > 0) S.step(settle);
  const info = gb.paneInfo(X.bi), st2 = gb.panes.get(X.bi);
  out.energy = st2?.energy ?? 0; out.run = !!info?.run; out.diced = !!st2?.dice || !!info?.gone; out.open = info?.openFraction ?? 0;
  return out;
}
/** THE RULE, checked on a shell's record by this file's own reading of it (null = it holds; else the first row that breaks it): in order, a pellet is a MARK iff no
 *  earlier mark of the record lies within r of it that it may join (a pellet that went through joins only a mark that went through) */
function recordBreaks(rec: number[], r: number): string | null {
  for (let i = 0; i < rec.length; i += 5) {
    let near = false;
    for (let k = 0; k < i; k += 5) { if (!rec[k + 4] || (rec[i + 3] && !rec[k + 3])) continue; if (Math.hypot(rec[k] - rec[i], rec[k + 1] - rec[i + 1], rec[k + 2] - rec[i + 2]) < r) { near = true; break; } }
    if (near === !!rec[i + 4]) return `pellet row ${i / 5}: ${rec[i + 4] ? 'filed a mark' : 'joined'} with ${near ? 'a' : 'no'} mark of its shell within ${r} m`;
  }
  return null;
}

// ================================================================ pellets-arm
/** one shell with the shoulder one side of a pane of `kind` and the muzzle 12 cm past its far face, a man two metres beyond; `brk` false = rounds through glass
 *  live but the fracture model switched off (the A/B a pane then never opens, so every pellet finds the glass across the arm) */
async function armCase(seed: number, kind: PaneKind, brk = true) {
  const S = await stage(seed, { brk, shards: brk }); const X = S.pane(kind, 1.2); if (!X || !X.chest) return null;
  const half = Math.min(X.b.h[0], X.b.h[2]);
  const muzzle = v3.mad(X.p, X.out, -(half + 0.12)) as Vec3, shoulder = v3.mad([X.p[0], X.p[1] + 0.07, X.p[2]], X.out, half + 0.33) as Vec3, to = v3.mad(X.p, X.out, -6) as Vec3;
  const man = S.behind(X, 2.0); S.step(2);
  const c = S.game.player.char, m0 = c.muzzle, a0 = c.bones.upperArmR; c.muzzle = muzzle; c.bones.upperArmR = shoulder; const pressed = armThrough(S.game, c); c.muzzle = m0; c.bones.upperArmR = a0;
  const arm0 = GLASSPEN_STATS.viaArm, imp0 = GB_STATS.impacts;
  const o = shellAt(S, X, muzzle, to, 0, shoulder);
  return { S, X, o, pressed, viaArm: GLASSPEN_STATS.viaArm - arm0, impacts: GB_STATS.impacts - imp0, manDown: man.state === 'dead', ends: SHOTGUN_LAST.ends.length as number };
}
export const pelletsArm = guarded(async () => {
  const { verdict, done } = family('pellets-arm: the muzzle pressed through a pane — one shell files ONE crossing at the arm point, not nine, and the nine fly on');
  const pe = (GLASSPEN.energy.m870 ?? GLASSPEN.defaultEnergy) * GLASSPEN.fractureK;
  // (1) everything live. The first pellet's crossing knocks the piece at the arm point out, so the other eight leave by the hole: one crossing by the glass's own doing
  const A = await armCase(31, 'annealed');
  if (!A) { verdict(false, 'a chest-high plain pane with floor both sides', 'none in the level'); return done(); }
  verdict(A.pressed, 'staged: the shoulder one side of a plain (annealed) pane, the muzzle 12 cm past its far face (combat.ts armThrough says so)', `pane ${A.X.bi} · armThrough ${A.pressed}`);
  verdict(A.o.blows === 1 && A.impacts === 1 && A.o.holes === 1 && A.o.jets === 1 && A.o.events === 1 && A.o.stars <= 1, 'GLASS FULLY LIVE: one blow in the fracture model, one hole remembered, one exit jet, one \'glass\' event', `blows on the pane ${A.o.blows} (anywhere ${A.impacts}) · energy filed ${f2(A.o.energy)} (a pellet is ${f2(pe)}) · holes ${A.o.holes} · jets ${A.o.jets} · events ${A.o.events} · stars ${A.o.stars} · pellets that met glass ${A.o.rec ? A.o.met : '?'} (the rest left by the hole the first one made)`);
  verdict(A.manDown && A.o.flew === 9, 'and they are still nine rounds beyond the glass — every one flew on from the muzzle (on 0ee0094 pellets two to nine were put into "the panel" at the muzzle: the arm was through a hole by then) — and the man two metres past it is down', `man down ${A.manDown} · pellets that flew more than a metre ${A.o.flew} of ${A.ends}`);
  { // the same hole, any gun: a rifle pressed through the glass, two rounds — the second leaves by the hole the first made and flies as far
    const R = await stage(33); const X = R.pane('annealed', 1.2)!; const half = Math.min(X.b.h[0], X.b.h[2]);
    const muzzle = v3.mad(X.p, X.out, -(half + 0.12)) as Vec3, shoulder = v3.mad([X.p[0], X.p[1] + 0.07, X.p[2]], X.out, half + 0.33) as Vec3, to = v3.mad(X.p, X.out, -6) as Vec3;
    const flown: number[] = []; for (let k = 0; k < 2; k++) { R.fire(muzzle, to, 'fn2000', shoulder); const e = R.events.filter((x: any) => x.kind === 'shot').pop(); flown.push(e ? v3.dist(e.from, e.to) : -1); }
    verdict(flown[0] > 1 && flown[1] > 1 && holeCount(R.game, X.bi) === 1, 'a rifle through the same glass, two rounds: the second leaves by the hole the first made and flies on (one crossing filed, not two)', `flew ${f2(flown[0])} m, then ${f2(flown[1])} m · holes remembered ${holeCount(R.game, X.bi)}`); }
  // (2) the fracture model off, rounds through glass on: the pane never opens, all nine pellets find it across the arm — the case that stacked nine
  const B = await armCase(31, 'annealed', false);
  if (!B) { verdict(false, 'the same pane, the fracture model off', 'no pane'); return done(); }
  verdict(B.pressed && B.viaArm === 9 && !!B.o.rec && B.o.met === 9 && B.o.through === 9 && B.o.marks === 1 && B.o.joined === 8, 'THE FRACTURE MODEL OFF (the pane cannot open): all nine pellets cross the glass at the arm point — the first is the mark, eight join it', B.o.rec ? `crossed at the arm ${B.viaArm} · met ${B.o.met} · through ${B.o.through} · marks ${B.o.marks} · joined ${B.o.joined}` : `crossed at the arm ${B.viaArm} · this build keeps no record of a shell on glass`);
  verdict(B.o.holes === 1 && B.o.jets === 1 && B.o.stars === 1 && B.o.events === 1, '…and ONE crossing is filed for them: one hole remembered, one exit jet, one crack star, one \'glass\' event (it was nine of each bar the star)', `holes ${B.o.holes} · jets ${B.o.jets} · stars ${B.o.stars} · events ${B.o.events}`);
  verdict(B.manDown && B.o.flew === 9, '…and all nine fly on from the muzzle: the man beyond is down', `man down ${B.manDown} · pellets that flew more than a metre ${B.o.flew} of ${B.ends}`);
  // (3) laminated across the arm: nothing passes, one mark for the shell
  const L = await armCase(32, 'laminated');
  if (!L) console.log('    (no chest-high laminated sheet with floor both sides in this level: the stopped arm case is not run)');
  else {
    verdict(L.pressed && L.o.stars === 1 && L.o.events === 1 && L.o.holes === 0 && L.o.jets === 0 && !L.manDown && L.o.flew === 0, 'a LAMINATED sheet across the arm: the shell is spent in it as ONE mark — one star, one event, no hole, no jet — and the man beyond stands', `pressed ${L.pressed} · stars ${L.o.stars} · events ${L.o.events} · holes ${L.o.holes} · jets ${L.o.jets} · pellets beyond ${L.o.flew} · man down ${L.manDown}`);
    verdict(Math.abs(L.o.energy - 9 * pe) < 1e-6, '…with the whole shell\'s energy in that one star (what stops in the glass stays in the glass)', `energy filed ${f2(L.o.energy)} = 9 × ${f2(pe)}`);
    verdict(!!L.o.rec && L.o.met === 9 && L.o.through === 0 && L.o.marks === 1, 'all nine are in the shell\'s record as stopped, one mark for them', L.o.rec ? `met ${L.o.met} · through ${L.o.through} · marks ${L.o.marks}` : 'no record');
  }
  return done();
});

// ================================================================ pellets-rule
const RANGES = [0.3, 1, 4, 8], SHELLS = 40;
interface Row { kind: PaneKind; D: number; n: number; met: number; through: number; stopped: number; marks: number; joined: number; energy: number; failed: number; open: number; beyond: number; failed2: number; bad: string[] }
/** `SHELLS` shells at one pane from D metres, square on, the pane mended between shells (and a second shell on the same pane for 'after two') */
async function rangeRows(seed: number): Promise<Row[]> {
  const S = await stage(seed); const rows: Row[] = [];
  for (const kind of ['annealed', 'tempered', 'laminated'] as PaneKind[]) for (const D of RANGES) {
    const X = S.pane(kind, D); if (!X) { console.log(`    (no ${kind} sheet with ${D} m of clear floor off a face: row skipped)`); continue; }
    const R: Row = { kind, D, n: SHELLS, met: 0, through: 0, stopped: 0, marks: 0, joined: 0, energy: 0, failed: 0, open: 0, beyond: 0, failed2: 0, bad: [] };
    const from = v3.mad(X.p, X.out, D) as Vec3, to = v3.mad(X.p, X.out, -6) as Vec3;
    for (let k = 0; k < SHELLS; k++) {
      S.mend(); S.park();
      const o = shellAt(S, X, from, to, 150);
      R.met += o.met; R.through += o.through; R.stopped += o.stopped; R.marks += o.marks; R.joined += o.joined; R.energy += o.energy; R.open += o.open; R.beyond += o.endBeyond; if (o.run || o.diced) R.failed++;
      // the wiring, shell by shell
      if (!o.rec) { if (!R.bad.length) R.bad.push('no record of the shell on the glass'); }
      else {
        const why = recordBreaks(o.rec, GLASSPEN.shellR); if (why) R.bad.push(`shell ${k}: ${why}`);
        if (o.blows !== o.marks + o.joinedStopped) R.bad.push(`shell ${k}: ${o.blows} blows filed for ${o.marks} marks and ${o.joinedStopped} pellets stopped on one`);
        if (o.stars !== o.marks) R.bad.push(`shell ${k}: ${o.stars} crack stars drawn for ${o.marks} marks`);
        if (o.holes !== o.marksThrough || o.jets !== o.marksThrough) R.bad.push(`shell ${k}: ${o.holes} holes / ${o.jets} jets for ${o.marksThrough} marks that went through`);
        if (o.stopped !== o.endIn) R.bad.push(`shell ${k}: ${o.endIn} pellets ended in the pane, ${o.stopped} in the record as stopped`);
        if (o.through > o.endBeyond) R.bad.push(`shell ${k}: ${o.endBeyond} pellets ended beyond the pane, ${o.through} in the record as through`);   // (fewer is honest: a pellet that left by the hole an earlier one opened met no glass)
        if (o.events !== (o.marks > 0 ? 1 : 0)) R.bad.push(`shell ${k}: ${o.events} 'glass' events for one shell on one pane`);
      }
      const o2 = shellAt(S, X, from, to, 150); if (o2.run || o2.diced) R.failed2++;
    }
    rows.push(R);
  }
  return rows;
}
export const pelletsRule = guarded(async () => {
  const { verdict, done } = family('pellets-rule: a shell marks a pane once per place — pellets that go through and pellets that stop, by the one rule');
  const rows = await rangeRows(41); const P = WEAPONS.m870.pellets;
  console.log(`    one shell, square on, ${SHELLS} shells a row on a mended pane [pattern ${(2 * P.cone * 100).toFixed(0)} cm wide per metre · a pellet's energy ${GLASSPEN.energy.m870 ?? `${GLASSPEN.defaultEnergy} (no entry)`} · shellR ${GLASSPEN.shellR} m]`);
  console.log('    glass       range   met glass   through   stopped   marks   joined   energy filed   pane fails (1 shell)   (2 shells)   open after   pellets beyond');
  for (const r of rows) console.log(`    ${r.kind.padEnd(10)}  ${String(r.D).padStart(3)} m   ${f1(r.met / r.n).padStart(5)}        ${f1(r.through / r.n).padStart(5)}     ${f1(r.stopped / r.n).padStart(5)}    ${f1(r.marks / r.n).padStart(5)}   ${f1(r.joined / r.n).padStart(5)}      ${f2(r.energy / r.n).padStart(5)}          ${String(r.failed).padStart(2)} of ${r.n}              ${String(r.failed2).padStart(2)} of ${r.n}       ${(100 * r.open / r.n).toFixed(0).padStart(3)} %        ${f1(r.beyond / r.n).padStart(5)}`);
  const bad = rows.flatMap(r => r.bad.map(b => `${r.kind} ${r.D} m, ${b}`));
  verdict(rows.length >= 9 && rows.every(r => r.met > 0), 'shells flown at plain, toughened and laminated glass from arm\'s length, 1, 4 and 8 m, every row with pellets on the pane', `${rows.length} rows · ${rows.reduce((a, r) => a + r.n, 0)} first shells · ${rows.reduce((a, r) => a + r.met, 0)} pellets met glass`);
  verdict(bad.length === 0, 'EVERY shell: its record obeys the rule (a mark never on a mark of its own shell, a joiner always on one); a crack star is drawn for exactly the marks; the fracture model was given the marks and the energy of the pellets that stopped on one, nothing for a pellet through one; holes and exit jets are exactly the marks that went through; every pellet that ended in the pane is in the record as stopped, and none is in it as through that did not end beyond; one hearing event a shell', bad.length ? `${bad.length} breaks, first: ${bad.slice(0, 3).join(' | ')}` : 'no break in any shell');
  const at = (k: PaneKind, D: number) => rows.find(r => r.kind === k && r.D === D);
  const a0 = at('annealed', 0.3), a1 = at('annealed', 1), a4 = at('annealed', 4), l1 = at('laminated', 1);
  if (a0) verdict(a0.failed === 0 && a0.marks / a0.n <= 2.5 && a0.open / a0.n < 0.05, 'PLAIN GLASS AT ARM\'S LENGTH: nine pellets in one spot read as one ragged hole — a blow or two\'s worth, and the pane stands', `a shell: ${f1(a0.met / a0.n)} pellets met glass as ${f1(a0.marks / a0.n)} marks (${f1((a0.beyond - a0.through) / a0.n)} left by the hole already there) · energy filed ${f2(a0.energy / a0.n)} of the ${GB_BREAK} that runs a plain pane · ran in ${a0.failed} of ${a0.n} · ${(100 * a0.open / a0.n).toFixed(1)} % of the sheet open`);
  if (a1) verdict(a1.joined > 0 && a1.marks / a1.n < 9 * 0.6 && a1.failed * 2 < a1.n, 'PLAIN GLASS AT 1 m: the pattern is a hand across — pellets land on each other\'s marks or leave by the hole, and more often than not the pane keeps standing with a ragged hole in it', `a shell: ${f1(a1.met / a1.n)} pellets met glass as ${f1(a1.marks / a1.n)} marks (${f1((a1.beyond - a1.through) / a1.n)} left by the hole) · the pane ran in ${a1.failed} of ${a1.n} (after a second shell ${a1.failed2}) · ${(100 * a1.open / a1.n).toFixed(1)} % of the sheet open`);
  if (a4 && a1) verdict(a4.marks / a4.n > a1.marks / a1.n && a4.joined / a4.n < 1.5, 'PLAIN GLASS AT 4 m: the pellets are a hand apart and each is its own mark — nine pocks are nine blows, and that much runs a plain pane', `marks a shell ${f1(a4.marks / a4.n)} (at 1 m ${f1(a1.marks / a1.n)}) · joined ${f1(a4.joined / a4.n)} · the pane ran in ${a4.failed} of ${a4.n}`);
  if (l1) verdict(l1.through === 0 && l1.stopped === l1.met && l1.marks > l1.n * 1.2 && l1.beyond === 0, 'LAMINATED: nothing goes through, and the pellets that stop are marked by the same rule — not one in three', `stopped ${f1(l1.stopped / l1.n)} a shell · marks ${f1(l1.marks / l1.n)} · through ${l1.through} · beyond ${l1.beyond}`);
  // pellets through AND pellets stopped, one shell, one pane: toughened glass raked at the pellet's limit
  { const S = await stage(43); const X = S.pane('tempered', 3); let mixed: ShellOut | null = null, tries = 0, deg = 0;
    if (X) {
      const e = GLASSPEN.energy.m870 ?? GLASSPEN.defaultEnergy, cosLim = GLASSPEN.cost.tempered / Math.max(1e-6, e - GLASSPEN.minEnergy); deg = Math.acos(Math.min(1, cosLim)) * 180 / Math.PI;
      const tan: Vec3 = [X.out[2], 0, -X.out[0]];
      for (; tries < 40 && !mixed; tries++) { S.mend(); const a = (deg + (tries % 5 - 2) * 0.6) * Math.PI / 180; const from = v3.add(v3.mad(X.p, X.out, 2.2 * Math.cos(a)), v3.scale(tan, 2.2 * Math.sin(a))) as Vec3;
        const o = shellAt(S, X, from, v3.mad(from, v3.normalize(v3.sub(X.p, from)), 8) as Vec3); if (o.through > 0 && o.stopped > 0) mixed = o; }
    }
    const why = mixed?.rec ? recordBreaks(mixed.rec, GLASSPEN.shellR) : 'no record';
    verdict(!!mixed && !why && mixed.blows === mixed.marks + mixed.joinedStopped && mixed.stars === mixed.marks && mixed.holes === mixed.marksThrough && mixed.jets === mixed.marksThrough && mixed.stopped === mixed.endIn,
      'ONE SHELL WITH BOTH — toughened glass raked at the angle a pellet just fails to cross: the pellets that got through and the ones that stopped are in one record under one rule', mixed ? `at ${f1(deg)}° off the normal (try ${tries}): ${mixed.through} through, ${mixed.stopped} stopped · marks ${mixed.marks} (${mixed.marksThrough} through) · stars ${mixed.stars} · blows ${mixed.blows} (${mixed.joinedStopped} stopped on a mark) · holes ${mixed.holes} · jets ${mixed.jets} · ${why ?? 'record holds'}` : `no shell with both in ${tries} tries${X ? '' : ' (no toughened pane with room)'}`); }
  // no shell does less for being closer: toughened glass raked past the angle a pellet crosses at, so every pellet stops — from 0.4 m (one mark, the rest on it) and from 2 m (marks apart)
  { const S = await stage(44); const X = S.pane('tempered', 3); const out: { D: number; o: ShellOut }[] = [];
    if (X) { const tan: Vec3 = [X.out[2], 0, -X.out[0]], a = 40 * Math.PI / 180;
      for (const D of [0.4, 2]) { S.mend(); const from = v3.add(v3.mad(X.p, X.out, D * Math.cos(a)), v3.scale(tan, D * Math.sin(a))) as Vec3; out.push({ D, o: shellAt(S, X, from, v3.mad(from, v3.normalize(v3.sub(X.p, from)), 8) as Vec3, 30) }); } }
    const [near, far] = out;
    verdict(!!near && !!far && near.o.through === 0 && near.o.joinedStopped > 0 && near.o.marks === 1 && near.o.diced && far.o.diced && near.o.energy > near.o.marks * (GLASSPEN.energy.m870 ?? 0.5) * GLASSPEN.fractureK,
      'WHAT STOPS IN THE GLASS STAYS IN IT — toughened glass raked at 40° (no pellet crosses): from 0.4 m the shell lands on one mark, the pellets on it leave their energy in it, and the pane dices — as it does from 2 m (a shell does not do less for being closer)', near && far ? `0.4 m: ${near.o.stopped} stopped as ${near.o.marks} marks, energy ${f2(near.o.energy)}, diced ${near.o.diced} · 2 m: ${far.o.stopped} stopped as ${far.o.marks} marks, energy ${f2(far.o.energy)}, diced ${far.o.diced}` : 'no toughened pane with room'); }
  return done();
});

// ================================================================ pellets-energy
export const pelletsEnergy = guarded(async () => {
  const { verdict, done } = family('pellets-energy: the M870 has its own through-glass value, and it means what the page says');
  const e = GLASSPEN.energy.m870;
  verdict(typeof e === 'number' && roundEnergy(WEAPONS.m870) === e && e < GLASSPEN.energy.guard9mm && e > 0, 'GLASSPEN.energy has an m870 entry, under the 9 mm sidearm\'s, and it is what a pellet leaves the muzzle with', `m870 ${e} · 9 mm ${GLASSPEN.energy.guard9mm} · roundEnergy(m870) ${roundEnergy(WEAPONS.m870)}`);
  verdict(GLASSPEN.energy.fn2000 === 1.0 && GLASSPEN.energy.aks74u === 0.9 && GLASSPEN.energy.fiveseven === 0.6 && GLASSPEN.energy.guard9mm === 0.5 && GLASSPEN.cost.annealed === 0.10 && GLASSPEN.cost.tempered === 0.16 && GLASSPEN.cost.laminated === 0.42, 'no other gun\'s energy and no pane\'s cost was moved', JSON.stringify({ energy: GLASSPEN.energy, cost: GLASSPEN.cost }));
  const S = await stage(51); const en = e ?? GLASSPEN.defaultEnergy;
  const toll = (kind: PaneKind, deg = 0, eIn = en, nth = 0) => { const X = S.pane(kind); if (!X) return undefined; const a = deg * Math.PI / 180, tan: Vec3 = [X.out[2], 0, -X.out[0]]; const d = v3.normalize(v3.add(v3.scale(X.out, -Math.cos(a)), v3.scale(tan, Math.sin(a)))) as Vec3; return paneToll(S.game, X.bi, v3.mad(X.p, X.out, Math.min(X.b.h[0], X.b.h[2])), d, eIn, nth); };
  const an = toll('annealed'), te = toll('tempered'), la = toll('laminated');
  verdict(!!an && !!te && la === null, 'square on: one sheet of plain glass — yes; one of toughened — yes; laminated — no, the pellet is spent in it', `plain ${an ? `through, ${f2(an.eOut)} left` : an === null ? 'spent' : 'no such pane'} · toughened ${te ? `through, ${f2(te.eOut)} left` : te === null ? 'spent' : 'no such pane'} · laminated ${la ? `through, ${f2(la.eOut)} left` : la === null ? 'spent' : 'no such pane'}`);
  const an2 = an ? toll('annealed', 0, an.eOut, 1) : undefined, te2 = te ? toll('annealed', 0, te.eOut, 1) : undefined;
  verdict(an2 === null && te2 === null, 'never a second standing pane: what one sheet leaves a pellet is under what the next asks', `after plain glass ${an ? f2(an.eOut) : '-'} → a second plain pane: ${an2 === null ? 'spent' : 'through'} · after toughened ${te ? f2(te.eOut) : '-'} → a plain pane: ${te2 === null ? 'spent' : 'through'}`);
  const lim = (kind: PaneKind) => { let last = -1; for (let d = 0; d <= 85; d++) { if (toll(kind, d)) last = d; else break; } return last; };
  const la0 = lim('annealed'), lt0 = lim('tempered');
  verdict(la0 >= 45 && la0 <= 65 && lt0 >= 15 && lt0 <= 40, 'on the slant: plain glass lets a pellet through to about 56° off its normal, toughened to about 27° — raked past that, the sheet eats the shell', `plain: through to ${la0}° · toughened: through to ${lt0}°`);
  const rifle = { an: paneToll(S.game, S.pane('annealed')!.bi, S.pane('annealed')!.p, v3.scale(S.pane('annealed')!.out, -1), 1.0, 0), la: S.pane('laminated') ? paneToll(S.game, S.pane('laminated')!.bi, S.pane('laminated')!.p, v3.scale(S.pane('laminated')!.out, -1), 1.0, 0) : undefined };
  verdict(!!rifle.an && Math.abs(rifle.an.eOut - 0.9) < 1e-9 && (rifle.la === undefined || (!!rifle.la && Math.abs(rifle.la.eOut - 0.58) < 1e-9)), 'a rifle round pays what it paid (0.10 in plain glass, 0.42 in laminated)', `rifle through plain: ${rifle.an ? f2(rifle.an.eOut) : 'spent'} left · through laminated: ${rifle.la ? f2(rifle.la.eOut) : rifle.la === null ? 'spent' : 'no such pane'}`);
  { const X = S.pane('annealed')!; const pass = shotPasses(S.game, v3.mad(X.p, X.out, 2), v3.scale(X.out, -1), [{ bi: X.bi, t: 2 - 0.006 }], en); const L = S.pane('laminated'); const passL = L ? shotPasses(S.game, v3.mad(L.p, L.out, 2), v3.scale(L.out, -1), [{ bi: L.bi, t: 2 - 0.006 }], en) : false;
    verdict(pass && !passL, 'the line-of-fire question a shotgun man asks reads the same number: a shot through a plain pane is open to him, through the laminated sidelight it is not', `plain ${pass} · laminated ${passL}`); }
  // real men: behind plain glass a shell from 3 m drops him; behind the laminated sidelight he is untouched
  { const X = S.pane('annealed', 3); let down = false, o: ShellOut | null = null;
    if (X) { S.mend(); const man = S.behind(X, 1.5); S.step(2); o = shellAt(S, X, v3.mad(X.p, X.out, 3) as Vec3, v3.mad(X.p, X.out, -6) as Vec3); down = man.state === 'dead'; }
    verdict(!!X && down, 'a man a stride and a half behind a plain pane, one shell from 3 m: down (a pellet that is through is a round — no hit points, and none added)', o ? `through ${o.through} of ${o.met} on the pane · he is ${down ? 'down' : 'standing'}` : 'no plain pane with 3 m of floor');
    const S2 = await stage(52); const L = S2.pane('laminated', 2); let up = true, o2: ShellOut | null = null;
    if (L) { const man = S2.behind(L, 1.2); S2.step(2); o2 = shellAt(S2, L, v3.mad(L.p, L.out, 2) as Vec3, v3.mad(L.p, L.out, -6) as Vec3); up = man.state !== 'dead' && !(man.staggerUntil > S2.game.time); }
    if (L) verdict(up && o2!.through === 0, 'a man behind the laminated sidelight, one shell from 2 m: untouched', `through ${o2!.through} of ${o2!.met} on the pane · he is ${up ? 'standing' : 'hit'}`);
    else console.log('    (no laminated sheet with 2 m of floor off a face: not run)'); }
  return done();
});

// ================================================================ pellets-shield
export const pelletsShield = guarded(async () => {
  const { verdict, done } = family('pellets-shield: a shield man found by a round that crossed glass is logged on the bearing of the leg that reached him');
  // the turn in the glass made large so the two bearings are whole degrees apart (the shipped turn is a degree or two: the log rounds to one)
  GLASSPEN.deflectDeg = 80; GLASSPEN.bendK = 0;
  const S = await stage(61); const { game } = S; const X = S.pane('annealed', 3);
  if (!X) { verdict(false, 'a plain pane with 3 m of floor', 'none'); return done(); }
  const C = S.behind(X, 1.6); const tan: Vec3 = [X.out[2], 0, -X.out[0]];
  C.team = 'hostile'; C.char.bodyYaw = C.char.aimYaw = Math.atan2(tan[0], tan[2]); C.char.update(0); C.char.update(DT);   // side on to the glass: the round comes at his flank, where no plate is
  SH.giveShield(C); S.step(2);
  const up = SH.plateUp(C), face = SH.shieldBox(C)?.yaw ?? NaN;
  const rel = (from: Vec3, hit: Vec3) => { let d = (Math.atan2(from[0] - hit[0], from[2] - hit[2]) - face) * 180 / Math.PI; d = ((d + 540) % 360) - 180; return d; };
  // find a rifle line through the pane whose turned last leg still finds him, the two bearings ≥ 4° apart
  let pick: { from: Vec3; to: Vec3; path: any } | null = null;
  for (let k = 0; k < 400 && !pick; k++) {
    const u = ((k * 37) % 41 - 20) * 0.03, w = ((k * 13) % 9 - 4) * 0.03; const through: Vec3 = [X.p[0] + tan[0] * u, 1.2 + w, X.p[2] + tan[2] * u];
    const from = v3.mad(through, X.out, 2.5) as Vec3; from[1] = 1.35; const d = v3.normalize(v3.sub(through, from)) as Vec3;
    const path = PEN.roundPath(game, from, d, 60, 1.0); if (!path || path.cross.length !== 1 || path.cross[0].turnDeg < 6) continue;
    const seg = path.segs[1]; const chest: Vec3 = [C.char.pos[0], 1.2, C.char.pos[2]]; const tc = v3.dot(v3.sub(chest, seg.o), seg.d); if (tc < 0.3) continue;
    const miss = v3.len(v3.sub(v3.mad(seg.o, seg.d, tc), chest)); if (miss > 0.1) continue;
    if (SH.shieldStop(game, 'player', seg.o, seg.d, tc)) continue;
    pick = { from, to: v3.mad(from, d, 8) as Vec3, path };
  }
  verdict(up && !!pick, 'staged: a shield man side on behind a plain pane, and a rifle line through it that the glass turns by 6° or more onto his flank (the turn made large for the test)', pick ? `turned ${f1(pick.path.cross[0].turnDeg)}° in pane ${X.bi}` : `plate up ${up} · no such line in 400 tried`);
  if (pick) {
    const last = SH.SHIELD_LOG[SH.SHIELD_LOG.length - 1]; S.fire(pick.from, pick.to, 'fn2000'); const row = SH.SHIELD_LOG[SH.SHIELD_LOG.length - 1];
    const logged = !!row && row !== last && C.state === 'dead';   // (a new row: the log is a ring, its length says nothing once it is full)
    // where it met him is the round's to know — the probe takes the last leg's closest point to his chest column, a hand short of it
    const seg = pick.path.segs[1]; const tc = v3.dot(v3.sub([C.char.pos[0], 1.2, C.char.pos[2]], seg.o), seg.d); const near = v3.mad(seg.o, seg.d, Math.max(0, tc - 0.2)) as Vec3;
    const legDeg = rel(seg.o, near), muzDeg = rel(pick.from, near);
    verdict(logged, 'the round crossed the glass, found his body and the loss was logged', logged ? JSON.stringify(row) : `no new row · he is ${C.state}`);
    if (logged) verdict(Math.abs(row.deg - legDeg) <= 1.5 && Math.abs(muzDeg - legDeg) >= 4 && Math.abs(row.deg - muzDeg) >= 2.5, 'the bearing logged is the last leg\'s (where the glass sent it from), not the muzzle\'s', `logged ${row.deg}° · last leg ${f1(legDeg)}° · muzzle to hit ${f1(muzDeg)}°`);
    if (logged) verdict(Math.abs(row.dist - Math.hypot(pick.from[0] - near[0], pick.from[2] - near[2])) < 0.4, 'and the distance logged is still the muzzle\'s (how far it came)', `logged ${row.dist} m · muzzle to him ${f2(Math.hypot(pick.from[0] - near[0], pick.from[2] - near[2]))} m`);
  }
  // no glass on the way: the bearing is the muzzle's, as ever
  { Object.assign(GLASSPEN, JSON.parse(JSON.stringify(PEN_SHIPPED))); const S2 = await stage(62); const g2 = S2.game; const C2 = g2.guards[0];
    C2.team = 'hostile'; C2.char.pos = [7.5, 0, 14.2]; C2.char.bodyYaw = C2.char.aimYaw = 0; C2.char.update(0); C2.char.update(DT); SH.giveShield(C2); S2.step(2);
    const f = SH.shieldBox(C2)?.yaw ?? NaN; const chest: Vec3 = [C2.char.pos[0], 1.2, C2.char.pos[2]]; let done2 = false, detail = 'no clear flank line';
    for (const a of [90, -90, 120, -120, 150, -150, 180]) { const yaw = f + a * Math.PI / 180; const from: Vec3 = [chest[0] + Math.sin(yaw) * 2, 1.35, chest[2] + Math.cos(yaw) * 2]; if (g2.col.solidBlocked(from, chest)) continue;
      const last = SH.SHIELD_LOG[SH.SHIELD_LOG.length - 1]; S2.fire(from, chest, 'fn2000'); const row = SH.SHIELD_LOG[SH.SHIELD_LOG.length - 1];
      done2 = !!row && row !== last && Math.abs((((row.deg - a) + 540) % 360) - 180) <= 6; detail = `from ${a}° at 2 m: logged ${JSON.stringify(row)}`; break; }
    verdict(done2, 'a round that crossed no glass logs the muzzle\'s bearing, as it always did', detail); }
  return done();
});

// ================================================================ pellets-identity
/** what was left of a few staged shots — the game's own digest, every crack star, the fracture's record of every pane, the holes, the hearing events, the counters */
function wordOf(S: Stage): string {
  const { game, gb } = S; const r3 = (x: number) => Math.round(x * 1000);
  const decals = game.decals.list.filter((d: any) => d.kind === 'glassHit').map((d: any) => `${d.pane}:${d.pos.map(r3)}:${r3(d.radius)}:${d.param}`).join('|');
  const panes = [...gb.panes].map(([bi, st]: [number, any]) => `${bi}:${st.hits}:${r3(st.energy)}:${st.sites.length}:${st.nOpen}:${st.run}:${!!st.dice}`).join('|');
  const holes = (glassPanes(game) as number[]).map(bi => holeCount(game, bi)).join(',');
  const ev = S.events.filter((e: any) => e.kind !== 'step').map((e: any) => `${e.kind}@${e.pos.map(r3)}:${e.level ?? ''}`).join('|');
  return hashStr([hashDigest(digestGame(game)), decals, panes, holes, ev, S.jets.length, JSON.stringify(SHOTGUN_STATS)].join('#')).toString(16);
}
/** the shotgun at glass: a shell at each kind of pane from 1 m and from 4 m, and one with the muzzle pressed through */
async function shotgunWord(seed: number, parts: Parameters<typeof stage>[1]): Promise<string> {
  for (const k of Object.keys(SHOTGUN_STATS)) (SHOTGUN_STATS as any)[k] = 0;
  const A = await stage(seed, parts);
  for (const kind of ['annealed', 'tempered', 'laminated'] as PaneKind[]) { const X = A.pane(kind, 4) ?? A.pane(kind, 1); if (!X) continue;
    for (const D of [1, Math.min(4, X.room - 0.85)]) { A.fire(v3.mad(X.p, X.out, D) as Vec3, v3.mad(X.p, X.out, -6) as Vec3); A.step(20); }
    const half = Math.min(X.b.h[0], X.b.h[2]); A.fire(v3.mad(X.p, X.out, -(half + 0.12)) as Vec3, v3.mad(X.p, X.out, -6) as Vec3, 'm870', v3.mad([X.p[0], X.p[1] + 0.07, X.p[2]], X.out, half + 0.33) as Vec3); A.step(40); }
  return wordOf(A);
}
async function identityWords(): Promise<{ off: string; look: string; on: string }> {
  // (a) every glass part off (?glassfx=0, the harness's stand-up), the shotgun fired at glass · (b) the same with only the look's switch up (rounds through glass and the fracture model off)
  const off = await shotgunWord(71, { fx: false, pen: false, brk: false, shards: false }), look = await shotgunWord(71, { pen: false, brk: false, shards: false });
  // (c) the glass parts on, no shotgun anywhere: rifle and pistol rounds at the same panes, one pressed through
  for (const k of Object.keys(SHOTGUN_STATS)) (SHOTGUN_STATS as any)[k] = 0;
  const B = await stage(72);
  for (const kind of ['annealed', 'tempered', 'laminated'] as PaneKind[]) { const X = B.pane(kind, 4) ?? B.pane(kind, 1); if (!X) continue; const tan: Vec3 = [X.out[2], 0, -X.out[0]];
    // (the pressed round FIRST, into whole glass: a round with the arm through glass that has already fallen is the one thing this build changed for every gun — pellets-arm holds that)
    const half = Math.min(X.b.h[0], X.b.h[2]); B.fire(v3.mad(X.p, X.out, -(half + 0.12)) as Vec3, v3.mad(X.p, X.out, -6) as Vec3, 'fn2000', v3.mad([X.p[0], X.p[1] + 0.07, X.p[2]], X.out, half + 0.33) as Vec3); B.step(20);
    for (let k = 0; k < 6; k++) { const to = v3.add(v3.mad(X.p, X.out, -6), v3.scale(tan, (k - 2.5) * 0.5)) as Vec3; B.fire(v3.mad(X.p, X.out, Math.min(4, X.room - 0.85)) as Vec3, to, k % 2 ? 'fn2000' : 'fiveseven'); B.step(6); }
    B.step(60); }
  return { off, look, on: wordOf(B) };
}
/** frozen on the one build at 0ee0094 (`bun run tools/qa/pellets-probes.ts --words` there, this file copied in) */
const WORDS_0EE0094 = { off: 'bd326bb7', look: 'bd326bb7', on: '5f9627eb', shotgunOn: 'bafe643' };   // (off / look / on TAKEN AGAIN with `--words` on the real-doors step: the word hashes the office's own walls, which that step moved — on 0ee0094's office they were 7538cb56 · 7538cb56 · 1828dc78, and this file passed there until the walls changed; shotgunOn stays 0ee0094's own, the red path's 'not this')
export const pelletsIdentity = guarded(async () => {
  const { verdict, done } = family('pellets-identity: glass parts off, and glass on with no shotgun, are the runs they were on 0ee0094');
  const w = await identityWords();
  verdict(w.off === WORDS_0EE0094.off, 'EVERY GLASS PART OFF, the shotgun fired at every kind of pane from 1 m, from 4 m and pressed through: the word frozen on 0ee0094 (a pane is the starred wall it was, every third pellet stars it)', `now ${w.off} · 0ee0094 ${WORDS_0EE0094.off}`);
  verdict(w.look === WORDS_0EE0094.look, 'the same with only the glass look\'s switch up (rounds through glass and the fracture model off): the word frozen on 0ee0094', `now ${w.look} · 0ee0094 ${WORDS_0EE0094.look}`);
  verdict(w.on === WORDS_0EE0094.on, 'GLASS ON, no shotgun anywhere, a rifle round pressed through each pane and rifle and pistol rounds at it from across the room: the word frozen on 0ee0094', `now ${w.on} · 0ee0094 ${WORDS_0EE0094.on}`);
  // the red path: the same word taken of the one thing this build DID change — the shotgun at glass with the glass parts on — is not 0ee0094's (frozen there too)
  const sg = await shotgunWord(71, {});
  verdict(sg !== WORDS_0EE0094.shotgunOn && sg !== w.off && w.on !== w.off, 'the word is a real one: the shotgun at glass with the glass parts ON — the one thing this build changed — does NOT read as 0ee0094 did', `now ${sg} · 0ee0094 ${WORDS_0EE0094.shotgunOn}`);
  return done();
});

// ================================================================ pellets-red
export const pelletsRed = guarded(async () => {
  const { verdict, done } = family('pellets-red: the red paths — each check above does go red when the thing it checks is taken away');
  GLASSPEN.shellR = 0;
  const A = await armCase(31, 'annealed', false);
  verdict(!!A && A.pressed && A.o.holes === 9 && A.o.jets === 9 && A.o.stars === 9 && A.o.marks === 9, 'the rule switched off (GLASSPEN.shellR 0), the fracture model off: the same pressed shell files NINE crossings at the arm point — nine holes, nine jets — and pellets-arm\'s one-crossing check would be red', A ? `marks ${A.o.marks} · holes ${A.o.holes} · jets ${A.o.jets} · events ${A.o.events} · stars ${A.o.stars}` : 'no pane');
  const L = await armCase(32, 'laminated');
  if (L) verdict(L.o.stars === 9 && L.o.marks === 9, '…and a laminated sheet across the arm is starred nine times at one point', `stars ${L.o.stars} · marks ${L.o.marks}`);
  Object.assign(GLASSPEN, JSON.parse(JSON.stringify(PEN_SHIPPED)));
  const good = [0, 1, 0, 1, 1, 0.01, 1, 0, 1, 0, 0.2, 1, 0, 1, 1], twin = [0, 1, 0, 1, 1, 0.01, 1, 0, 1, 1], lone = [0, 1, 0, 1, 1, 0.2, 1, 0, 1, 0], byStop = [0, 1, 0, 0, 1, 0.01, 1, 0, 1, 0];
  verdict(recordBreaks(good, 0.04) === null && !!recordBreaks(twin, 0.04) && !!recordBreaks(lone, 0.04) && !!recordBreaks(byStop, 0.04), 'the record checker: a good record holds; a second mark a centimetre from the first, a joiner with no mark near it, and a pellet through "by the hole" of one that stopped are each flagged', `good: ${recordBreaks(good, 0.04) ?? 'holds'} · twin marks: ${recordBreaks(twin, 0.04)} · lone joiner: ${recordBreaks(lone, 0.04)} · through by a stopped mark: ${recordBreaks(byStop, 0.04)}`);
  delete GLASSPEN.energy.m870;
  verdict(roundEnergy(WEAPONS.m870) === GLASSPEN.defaultEnergy, 'the m870 entry taken out: a pellet crosses glass as a sidearm round again (0.5) — pellets-energy\'s first check would be red', `roundEnergy(m870) ${roundEnergy(WEAPONS.m870)}`);
  return done();
});

if (import.meta.main && process.argv.includes('--words')) { console.log(JSON.stringify({ ...(await identityWords()), shotgunOn: await shotgunWord(71, {}) })); process.exit(0); }
if (import.meta.main && process.argv.includes('--table')) { (GLASSPEN as any).shellR ??= 0; if (process.env.SHELLR) GLASSPEN.shellR = +process.env.SHELLR; if (process.env.M870E) GLASSPEN.energy.m870 = +process.env.M870E; const rows = await rangeRows(41); for (const r of rows) console.log(JSON.stringify({ ...r, bad: r.bad.length })); process.exit(0); }
