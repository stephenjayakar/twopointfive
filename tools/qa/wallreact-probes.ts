// Both sides react when the level breaks (src/game/wallreact.ts): `bun run tools/qa/wallreact-probes.ts [--level block-squads|compound|warehouse|all] [--verbose]`
// (its own runner: it is not a family of probes.ts — exit 0 all pass, 1 a failure). PASS / FAIL each, all headless: the Game of headless.ts on a loud level, started exactly
// as the page's scenario row starts it (the four against that level's defenders), THE ONE SWITCH of the destruction goal raised by the probe itself, holes
// blown with `g.destr.blast` directly (who decides to blow one is other pieces'). Men are STOOD where a probe needs them (a defender's post moved beside a
// partition, a teammate given a hold there) — what they do after the wall goes is theirs.
//
//   wallreact-cover     a defender holding beside a partition, a teammate holding beside one: the wall is blown from the far side — each leaves the spot,
//                       ends hidden from the hole, and nobody is left standing in its line; with WALLREACT off both stay where they were, open to it
//   wallreact-port      a port knocked in a wall (eyes and rounds, not feet): the defender in the room who hears it has his gun on it inside a second; a
//                       defender out of earshot and out of sight does not know it exists (fog of war); the team's book lists it only once the team knows
//   wallreact-hole      a hole a man fits through between two rooms: for the room fight they are one room (the same Room for the defenders either side,
//                       their evidence as long as its doors), a walk between them goes through it, the team's cleared book keeps the far side UNCLEARED
//                       and the entry points count the hole as a way a round can come; a restart puts every book back
//   wallreact-flank     two defenders hunting a fix round a long wall: a hole blown in it that one of them hears deals their flanking plan again
// Headless there is no renderer: what a man sees is the CPU sight test, the light on him the direct-light estimate; nothing here says anything about the picture.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { WALLS } = await import(`${ROOT}/src/game/wallbreak.ts`);
const { WALLREACT, WALLREACT_STATS, WALLREACT_LOG, WALLREACT_DEBUG, wallReactOf } = await import(`${ROOT}/src/game/wallreact.ts`);
const { planApproach, plansOf } = await import(`${ROOT}/src/game/tactics.ts`);
const { NOBODY_ID } = await import(`${ROOT}/src/game/consts.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
if (process.argv.includes('--debug')) WALLREACT_DEBUG.log = (m: string) => console.log(m);
const LEVELS = (() => { const i = process.argv.indexOf('--level'); const v = i >= 0 ? process.argv[i + 1] : 'all'; return v === 'all' ? ['block-squads', 'compound', 'warehouse'] : [v]; })();
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : String(x)), at = (p: number[]) => `(${f1(p[0])}, ${f1(p[2])})`;
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const KNOBS0 = { ...WALLREACT };

/** the scenario of a level's row stood up under a seed: the four outside, the defenders as dealt, Sam idle and unhurtable */
export async function rig(level: string, seed: number, on = true) {
  Math.random = seeded(seed); Object.assign(WALLREACT, KNOBS0); WALLREACT.on = on; DESTRUCTION.on = true;
  for (const k of Object.keys(WALLREACT_STATS)) (WALLREACT_STATS as any)[k] = 0; WALLREACT_LOG.length = 0;
  const log = console.log, err = console.error, warn = console.warn; let W: any;
  try {
    console.log = console.error = console.warn = () => { };
    W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${level}.json`), 'utf8'))) });
    await startFromQuery(W.game, new URLSearchParams(`?levelFile=${level}.json&roomclear=${seed}&squad4`));
  } finally { console.log = log; console.error = err; console.warn = warn; }
  const g = W.game; g.godMode = true; g.tune.chaos = 0.5;
  const R = { W, g, F: g.fight as any, wr: () => wallReactOf(g),
    step(secs: number) { for (let i = 0; i < Math.round(secs * 60); i++) { g.player.visibility = 0.05; W.step(DT); } },
    defs(): any[] { return R.F.defs.filter((D: any) => D.gd.state !== 'dead'); },
    ops(): any[] { return g.orders.squad().filter((m: any) => m.state !== 'dead'); },
    /** a defender's post moved: he holds at `p`, facing `to`, as the room fight plants a man */
    post(D: any, p: Vec3, to: Vec3) {
      const gd = D.gd, c = gd.char; c.pos[0] = p[0]; c.pos[2] = p[2]; c.bodyYaw = c.aimYaw = v3.yawTo(p, to); gd.path = []; gd.pathGoal = null; if (gd.script) gd.script = null;
      gd.hold = true; gd.pinned = true; D.mode = 'hold'; D.station = [p[0], 0, p[2]]; D.room = R.F.roomAt(p); D.ev = D.room ? D.room.entries.map(() => 0) : []; D.watch = D.want = D.glanceTo = -1; D.glanceUntil = -1; D.glanceNext = g.time + 60;
      D.home = [to[0], 0, to[2]]; D.pt[0] = to[0]; D.pt[2] = to[2]; },
    /** a teammate put on a hold at `p` */
    hold(gd: any, p: Vec3, to: Vec3) { const c = gd.char; c.pos[0] = p[0]; c.pos[2] = p[2]; c.bodyYaw = c.aimYaw = v3.yawTo(p, to); gd.path = []; gd.pathGoal = null;
      g.orders.assign(gd, { order: 'hold', post: [p[0], 0, p[2]], face: v3.yawTo(p, to), going: 'holding', there: 'holding' }); },
  };
  R.step(1.0);
  return R;
}
type Rig = Awaited<ReturnType<typeof rig>>;
interface Spot { id: number; mid: Vec3; n: Vec3; u: Vec3; a: Vec3; b: Vec3; /** how good a stage it is (spotsAt): 2 = out of the team's line from its start and a charge at EITHER face opens this wall alone · 1 = the same of the `b` face, the one `blow` works from · 0 = neither */ rank?: number }
/** partition columns with open floor on both sides, away from doors, the wall's ends and every living man (the engine's own columns: on a column's centre) */
export function spots(R: Rig, clear = 2.6, roomy = false): Spot[] {
  const tiers = [[2.0, 2.5, clear], [1.4, 1.8, Math.min(clear, 2.2)], [1.0, 1.3, Math.min(clear, 1.8)]].map(([end, door, men]) => spotsAt(R, end, door, men));   // (a small building's walls are short and full of doors: the margins are let out a tier at a time)
  // (the best stage first, whatever tier has one — and that tier's places in the order of their rank; a level with none anywhere, an open yard the team looks
  //  across, stages as it always did)
  // (`roomy`: the widest margins first and the rank only within them — the cover probe's ask, which is about a man beside the wall having somewhere to go: a
  //  place a metre from a wall's end in a three-metre room has nowhere out of the hole's line, however alone its wall is)
  const t = (roomy ? undefined : tiers.find(o => o.some(x => x.rank === 2)) ?? tiers.find(o => o.some(x => x.rank === 1))) ?? tiers.find(o => o.length) ?? [];
  return [2, 1, 0].flatMap(k => t.filter(x => (x.rank ?? 0) === k));
}
function spotsAt(R: Rig, END: number, DOOR: number, clear: number): Spot[] {
  const g = R.g, nav = g.col.nav, free = (p: Vec3) => !nav.isBlocked(p[0], p[2]), out: Spot[] = [];
  const men: Vec3[] = [g.player.char.pos, ...g.guards.filter((m: any) => m.state !== 'dead').map((m: any) => m.char.pos)], team: Vec3[] = [g.player.char.pos, ...g.orders.squad().map((m: any) => m.char.pos)];
  for (const w of g.destr.walls.all()) {
    if (w.kind !== 'wall' || w.open) continue; const b = w.box; if (Math.abs(b.yaw ?? 0) > 1e-6) continue; const alongX = b.h[0] >= b.h[2], L = alongX ? b.h[0] : b.h[2];
    if (L < END + 0.3) continue;
    const nCol = Math.min(32, Math.max(1, Math.round(2 * L / WALLS.col))), wCol = 2 * L / nCol, n: Vec3 = alongX ? [0, 0, 1] : [1, 0, 0], u: Vec3 = alongX ? [1, 0, 0] : [0, 0, 1];
    const order = [...Array(nCol).keys()].sort((i, j) => Math.abs(i - (nCol - 1) / 2) - Math.abs(j - (nCol - 1) / 2));   // (the middle of the wall first)
    let best: Spot | null = null;   // (the wall's first place that will do, kept while a better stage is looked for further along it)
    for (const k of order) {
      const s = -L + (k + 0.5) * wCol; if (s < -L + END || s > L - END) continue;   // (a whole blast's width of wall either side: the hole is in a wall, not at its end)
      const mid: Vec3 = alongX ? [b.c[0] + s, 0, b.c[2]] : [b.c[0], 0, b.c[2] + s];
      const a = v3.mad(mid, n, 1.2) as Vec3, bb = v3.mad(mid, n, -1.2) as Vec3;
      if (![a, bb, v3.mad(mid, n, 0.7), v3.mad(mid, n, -0.7), v3.mad(mid, n, 2.4), v3.mad(mid, n, -2.4)].every(p => free(p as Vec3))) continue;
      if (g.col.solidBlocked([a[0], 1.3, a[2]], [mid[0] + n[0] * 0.25, 1.3, mid[2] + n[2] * 0.25]) || g.col.solidBlocked([bb[0], 1.3, bb[2]], [mid[0] - n[0] * 0.25, 1.3, mid[2] - n[2] * 0.25])) continue;
      if (!g.col.segmentBlocked([a[0], 1.3, a[2]], [bb[0], 1.3, bb[2]])) continue;   // (a wall between them today)
      if (g.doors.list.some((d: any) => flat(d.frameCentre, mid) < DOOR)) continue;
      if (men.some(p => flat(p, mid) < clear) || team.some(p => flat(p, mid) < 9)) continue;   // (… and well away from the team: what the men do is to be about the wall, not about a teammate in the hole)
      // HOW GOOD A STAGE, asked for first and done without where a level has none:
      // (out of the team's line from where it starts: a defender stood at a face the squad looks down a bare hall at is shot where he is put, and what he
      //  does about the hole is never seen — the rebuilt block's hall runs from the start to the far end of the floor)
      const seen = team.some(p => [a, bb].some(q => !g.col.shotBlocked([p[0], 1.2, p[2]], [q[0], 1.2, q[2]])));
      // (ONE wall: a charge here, against the face or a stride off it, opens this wall and no other — beside a corner where a second partition meets it the
      //  same blast holes both, and across a narrow room the stride-off charge ports the wall behind it: a 'port' is then a walk-through next door, or the
      //  first breach is not this wall's. Asked ahead of the blast, by the blast's own plan, of each face: `blow` works from the b face)
      const alone = (sd: number) => ![0.3, 1.4].some(off => g.destr.wallsFor([mid[0] + n[0] * sd * off, 1.0, mid[2] + n[2] * sd * off] as Vec3).some((o: any) => o.kind === 'wall' && o.id !== w.id));
      const fromB = alone(-1), fromA = alone(1), rank = seen ? 0 : fromA && fromB ? 2 : fromA || fromB ? 1 : 0;
      const S: Spot = rank === 1 && !fromB ? { id: w.id, mid, n: [-n[0], 0, -n[2]], u, a: bb, b: a, rank } : { id: w.id, mid, n, u, a, b: bb, rank };   // (worked from the face that is alone)
      if (!best || rank > (best.rank ?? 0)) best = S;
      if (rank === 2) break;
    }
    if (best) out.push(best);
  }
  return out;
}
const flip = (s: Spot): Spot => ({ id: s.id, mid: s.mid, u: s.u, n: [-s.n[0], 0, -s.n[2]], a: s.b, b: s.a });
/** blown from the `b` side: against the wall (a hole a man fits through) or stood off it (a port) */
export const blow = (R: Rig, S: Spot, off = 0.3, who = NOBODY_ID) => R.g.destr.blast([S.mid[0] - S.n[0] * off, 1.0, S.mid[2] - S.n[2] * off], { who, chaos: false });
/** is a chest at `h` over `p` open THROUGH a breach to its far side (three points just beyond it) */
function openTo(R: Rig, B: any, p: number[], h: number): boolean {
  const s = (p[0] - B.at[0]) * B.n[0] + (p[2] - B.at[2]) * B.n[1] >= 0 ? 1 : -1;
  for (const k of [0, 0.8, -0.8]) { const q: Vec3 = [B.at[0] + B.u[0] * B.half * k - B.n[0] * s * 0.9, 1.15, B.at[2] + B.u[1] * B.half * k - B.n[1] * s * 0.9]; if (thru(B, q, p) && !R.g.col.segmentBlocked(q, [p[0], h, p[2]])) return true; }
  return false;
}
/** does the plan line p → q cross the wall inside the breach */
function thru(B: any, p: number[], q: number[]): boolean {
  const sp = (p[0] - B.at[0]) * B.n[0] + (p[2] - B.at[2]) * B.n[1], sq = (q[0] - B.at[0]) * B.n[0] + (q[2] - B.at[2]) * B.n[1]; if (sp * sq >= 0) return false;
  const t = sp / (sp - sq), x = p[0] + (q[0] - p[0]) * t, z = p[2] + (q[2] - p[2]) * t; return Math.abs((x - B.at[0]) * B.u[0] + (z - B.at[2]) * B.u[1]) <= B.half + 0.35;
}
const tail = () => VERBOSE ? `\n    log: ${WALLREACT_LOG.join(' | ')}` : '';

export async function wallreactCover(level: string): Promise<boolean> {
  const F = family(`wallreact-cover [${level}]: the wall a man holds beside is blown from the far side — he leaves the spot, ends hidden from the hole; switch off, he stays`);
  for (const on of [true, false]) {
    const R = await rig(level, 3, on), g = R.g; const D = R.defs()[0], op = R.ops()[0];
    // (the far side must not be ground his own mates stand on: a man does not run from a hole onto his mate's room — wallreact.ts threatFor)
    const lone = (s: Spot) => !R.defs().some((x: any) => x !== D && flat(x.gd.char.pos, v3.mad(s.mid, s.n, -2.5)) < 3.5);
    const S = spots(R, 2.6, true).flatMap(s => [s, flip(s)]).find(lone) ?? spots(R, 2.6, true)[0];
    if (!S || !D || !op) { F.verdict(false, 'a partition, a defender and a teammate to stage', `spots ${spots(R).length} · defenders ${R.defs().length} · team ${R.ops().length}`); continue; }
    // the defender beside the wall on the a side; in a second staging further down, the teammate
    R.post(D, S.a, v3.mad(S.a, S.u, 6) as Vec3); R.step(0.5);
    const d0 = [...D.gd.char.pos], res = blow(R, S); R.step(0.1);
    const B = R.wr().breaches[0];
    if (on) F.verdict(res.walls > 0 && !!B && B.walk, 'the blast opens a hole a man fits through and the feed\'s row makes a breach of it', `walls ${res.walls} · nav cells opened ${res.opened} · ${B ? `breach ${at(B.at)} ${f1(B.half * 2)} m ${B.walk ? 'walk-through' : 'port'}` : 'no breach'}`);
    const openAt0 = B ? openTo(R, B, d0, 0.9) : !g.col.segmentBlocked([S.b[0], 1.15, S.b[2]], [d0[0], 0.9, d0[2]]);
    R.step(8);
    const p1 = D.gd.char.pos, moved = flat(p1, d0), still = B ? openTo(R, B, p1, 0.9) : !g.col.segmentBlocked([S.b[0], 1.15, S.b[2]], [p1[0], 0.9, p1[2]]);
    if (on) {
      F.verdict(openAt0 && moved > 1.0 && WALLREACT_STATS.movedDef >= 1, 'the defender, open to the hole where he stood, leaves the spot', `stood ${at(d0)} (open to the far side: ${openAt0}) · now ${at(p1)}, ${f1(moved)} m off · moved as a holding man ${WALLREACT_STATS.movedDef}× · alive ${D.gd.state !== 'dead'}`);
      F.verdict(!still && D.mode === 'hold' && D.gd.state !== 'dead', '… and ends planted where a crouched chest is hidden from the hole', `open to the far side now: ${still} · mode ${D.mode} · pinned ${D.gd.pinned} · room ${D.room?.id ?? '-'}${tail()}`);
    } else F.verdict(moved < 0.5 && openAt0 && still, 'switch off: he stays where he was put, open to the hole (the engine\'s build)', `moved ${f1(moved)} m · open before ${openAt0} · open now ${still} · wallreact rows ${WALLREACT_STATS.rows}`);

    // the teammate: a fresh floor (the first hole would muddle the second), a hold beside the wall
    const R2 = await rig(level, 4, on), g2 = R2.g, S2 = spots(R2, 2.6, true)[0], op2 = R2.ops()[0];
    if (!S2 || !op2) { F.verdict(false, 'a partition and a teammate to stage', `spots ${spots(R2).length} · team ${R2.ops().length}`); continue; }
    for (const m of g2.guards) if (m.team !== 'operative') m.dazzledUntil = g2.time + 1e6; R2.F.blindFire = false;   // (the teammate is stood deep in the building by himself: what is asked is what HE does about the wall — the defenders are left blind for it)
    R2.hold(op2, S2.a, v3.mad(S2.a, S2.u, 6) as Vec3); R2.step(0.5);
    const A0 = g2.orders.of(op2), m0 = [...A0.post]; blow(R2, S2); R2.step(0.1);
    const B2 = R2.wr().breaches[0], open0 = B2 ? openTo(R2, B2, m0, 1.2) : true;
    R2.step(6);
    const A1 = g2.orders.of(op2), q1 = op2.char.pos, mk = A1?.post ?? q1, openNow = B2 ? openTo(R2, B2, q1, 1.2) : !g2.col.segmentBlocked([S2.b[0], 1.15, S2.b[2]], [q1[0], 1.2, q1[2]]);
    if (on) {
      F.verdict(!!A1 && A1.order === 'hold' && flat(mk, m0) > 0.8 && WALLREACT_STATS.movedOp >= 1 && flat(q1, mk) < 0.6, 'the teammate\'s mark is moved off the hole and he walks to it, still on his order', `mark ${at(m0)} → ${at(mk)} (${f1(flat(mk, m0))} m) · he stands ${at(q1)} · order ${A1?.order} · team marks moved ${WALLREACT_STATS.movedOp}`);
      F.verdict(open0 && !openNow, '… out of the hole\'s line: nobody is left standing in it', `open to the far side on the old mark: ${open0} · where he stands now: ${openNow}${tail()}`);
      const O = g2.cover.openings.find((o: any) => o.id === B2?.key), risk = B2 ? g2.entry.riskAt([B2.at[0] + S2.n[0] * 1.2, 0, B2.at[2] + S2.n[2] * 1.2]) : null;
      F.verdict(!!O && B2.ops >= 0 && risk === O, 'the hole is in the squad\'s book: an opening for the unasked cover, and a way a round can come for the entry points', `team knows since ${f1(B2?.ops ?? -1)} s · in cover.openings ${!!O} · entry risk a stride in front of it: ${risk ? risk.id : 'none'} · dealt to: ${g2.orders.squad().filter((m: any) => g2.cover.of(m)?.o === O).map((m: any) => m.callsign).join(', ') || 'nobody free with a line'}`);
    } else F.verdict(flat(mk, m0) < 0.1 && flat(q1, m0) < 0.6 && !g2.cover.openings.some((o: any) => String(o.id).startsWith('breach:')), 'switch off: his mark stands, no opening is added', `mark moved ${f1(flat(mk, m0))} m · he is ${f1(flat(q1, m0))} m off it · open now ${openNow}`);
  }
  return F.done();
}

export async function wallreactPort(level: string): Promise<boolean> {
  const F = family(`wallreact-port [${level}]: a port in a wall is noticed by who hears or sees it — and by nobody else — and takes a defender's gun`);
  const R = await rig(level, 5), g = R.g, S = spots(R)[0], defs = R.defs();
  if (!S || defs.length < 2) { F.verdict(false, 'a partition and two defenders to stage', `spots ${spots(R).length} · defenders ${defs.length}`); return F.done(); }
  // the nearest defender stood in the room on the a side, three strides back, looking along the wall; the far one is whoever the sound model puts furthest
  const D = [...defs].sort((x, y) => flat(x.gd.char.pos, S.mid) - flat(y.gd.char.pos, S.mid))[0];
  const back = [3.4, 2.8, 2.4].map(d => v3.mad(S.mid, S.n, d) as Vec3).find(p => !g.col.nav.isBlocked(p[0], p[2]) && !g.col.segmentBlocked([p[0], 1.55, p[2]], [S.mid[0] + S.n[0] * 0.3, 1.3, S.mid[2] + S.n[2] * 0.3])) ?? S.a;
  R.post(D, back, v3.mad(back, S.u, 6) as Vec3); R.step(0.5);
  const src: Vec3 = [S.mid[0] - S.n[0] * 1.4, 1.3, S.mid[2] - S.n[2] * 1.4];
  const far = defs.filter(x => x !== D).map(x => ({ x, L: g.col.sound.propagate(src, [x.gd.char.pos[0], 1.55, x.gd.char.pos[2]]).pathLen })).sort((p, q) => q.L - p.L)[0];
  const res = blow(R, S, 1.4); R.step(0.05);
  const B = R.wr().breaches[0];
  const sight = !g.col.segmentBlocked([S.a[0], 1.5, S.a[2]], [S.b[0], 1.5, S.b[2]]), feet = g.col.nav.isBlocked(S.mid[0], S.mid[2]);
  F.verdict(res.walls > 0 && !!B && !B.walk && sight && feet, 'a charge a stride off the wall knocks a port in it: eyes pass, feet do not', `walls ${res.walls} · ${B ? `breach ${at(B.at)} ${f1(B.half * 2)} m ${B.walk ? 'WALK-THROUGH' : 'port'}` : 'no breach'} · a line through it at 1.5 m: ${sight} · nav shut in the wall: ${feet}`);
  if (!B) return F.done();
  R.step(1.0);
  const wr = R.wr(), knows = B.men.has(D.gd), on = wr.watching.get(D.gd) === B, ptOn = flat(D.pt, B.at) < 0.2;
  F.verdict(knows && on && ptOn, 'the defender in the room knows it by his own ears and rests his gun on it inside a second', `${D.gd.callsign} knows: ${knows} · watching it: ${on} · his fix point ${at(D.pt)} vs the port ${at(B.at)} · facing off it by ${f1(Math.abs(((v3.yawTo(D.gd.char.pos, B.at) - D.gd.char.aimYaw + 9.42477) % 6.28318) - 3.14159) * 57.3)}° · he stands ${at(D.gd.char.pos)} mode ${D.mode} state ${D.gd.state} · his door ${D.watch} with ${f1(D.watch >= 0 ? D.ev[D.watch] : 0)} against it · the port: ${JSON.stringify((wr as any).minds.get(D.gd)?.get(B) ?? null)} · glancing ${g.time < D.glanceUntil}${tail()}`);
  const farKnows = far ? B.men.has(far.x.gd) : false;
  if (far && far.L > WALLREACT.hearBlastM + WALLREACT.tellM) F.verdict(!farKnows, 'a defender out of earshot and out of sight does not know it is there (fog of war)', `${far.x.gd.callsign} is ${f1(far.L)} m of sound path off (heard inside ${WALLREACT.hearBlastM}) · knows: ${farKnows} · defenders who know: ${[...B.men.keys()].map((m: any) => m.callsign).join(', ')}`);
  else console.log(`    (no defender on this floor is out of earshot of that wall: the furthest is ${far ? f1(far.L) : '-'} m of sound path off — the fog-of-war line is not asked here)`);
  // the team: it knows only if one of them heard or saw it; unknown, their book has no such opening
  const teamHeard = B.ops >= 0, listed = g.cover.openings.some((o: any) => o.id === B.key);
  F.verdict(teamHeard === listed, 'the squad\'s book lists it exactly when the team knows of it', `team knows: ${teamHeard}${teamHeard ? ` (since ${f1(B.ops)} s)` : ''} · in cover.openings: ${listed} · Sam is ${f1(g.col.sound.propagate(src, [g.player.char.pos[0], 1.55, g.player.char.pos[2]]).pathLen)} m of sound path off`);
  // a door with fresh evidence takes him back; the port keeps one gun when nothing else is going on
  R.step(35);
  const on20 = [...wr.watching.entries()].filter(([m, b]: any) => b === B && m.state !== 'dead').map(([m]: any) => m.callsign);
  F.verdict(on20.length === 1, 'half a minute of quiet later (the noise of the bang at the doors forgotten) it has one gun on it, not the room\'s (a port is worth one with nothing else going on)', `watching it: ${on20.join(', ') || 'nobody'} · ${D.gd.callsign} ${at(D.gd.char.pos)} mode ${D.mode} state ${D.gd.state} door ${D.watch} with ${f1(D.watch >= 0 ? D.ev[D.watch] : 0)} · the port in his head: ${JSON.stringify((wr as any).minds.get(D.gd)?.get(B) ?? null)} · defenders who know it ${B.men.size}${tail()}`);
  // a door with something against it takes him back; rounds through the port take him off the door again
  const beyond: Vec3 = [B.at[0] - S.n[0] * 2.0, 0, B.at[2] - S.n[2] * 2.0], di = D.room?.entries.length ? 0 : -1;
  if (di >= 0) {
    for (let i = 0; i < 90; i++) { D.ev[di] = 1.2; R.step(1 / 60); }
    const onDoor = wr.watching.get(D.gd) !== B && D.watch === di;
    for (let i = 0; i < 150; i++) { D.ev[di] = 1.2; D.gd.sup.src = beyond; D.gd.sup.srcT = g.time; R.step(1 / 60); }
    const m = (wr as any).minds.get(D.gd)?.get(B), onPort = wr.watching.get(D.gd) === B;
    F.verdict(onDoor && onPort, 'a door of his room with noise at it takes him off the port; rounds coming through the port take him off that door', `door ${D.room.entries[di].door.def.name} held at 1.2: on the door ${onDoor} · then 2.5 s of rounds from beyond the port: on the port ${onPort} with ${f1(m?.ev ?? NaN)} against it${tail()}`);
  } else console.log('    (his room has no door: the door-against-port line is not asked here)');
  // the wall charge's case (wallcharge.ts flash-blinds every man with a line to its hole): a fresh floor, the same man blind for 4.1 s as the wall goes, a door of his
  // room loud the whole time — what just opened beside him is still the newest thing in the room when his eyes are back, not a thing he heard of four seconds ago
  const R2 = await rig(level, 5), S2 = spots(R2)[0], D2 = S2 ? [...R2.defs()].sort((x, y) => flat(x.gd.char.pos, S2.mid) - flat(y.gd.char.pos, S2.mid))[0] : null;
  if (S2 && D2) {
    const g2 = R2.g, back2 = [3.4, 2.8, 2.4].map(d => v3.mad(S2.mid, S2.n, d) as Vec3).find(p => !g2.col.nav.isBlocked(p[0], p[2]) && !g2.col.segmentBlocked([p[0], 1.55, p[2]], [S2.mid[0] + S2.n[0] * 0.3, 1.3, S2.mid[2] + S2.n[2] * 0.3])) ?? S2.a;
    R2.post(D2, back2, v3.mad(back2, S2.u, 6) as Vec3); R2.step(0.5);
    D2.gd.dazzledUntil = g2.time + 4.1; g2.wallCharge.stats.blown++; blow(R2, S2); const until = D2.gd.dazzledUntil;   // (the rule is the wall charge's own: it stands only once one has gone)
    const loud = () => { if (D2.room?.entries.length) D2.ev[0] = 2.4; }; let blindOn = false;
    while (g2.time < until + 1.0) { loud(); R2.step(1 / 60); if (g2.time < until - 0.1 && R2.wr().watching.has(D2.gd)) blindOn = true; }
    const B2 = R2.wr().breaches[0], m2 = B2 ? (R2.wr() as any).minds.get(D2.gd)?.get(B2) : null, on2 = !!B2 && R2.wr().watching.get(D2.gd) === B2;
    F.verdict(!!B2 && !blindOn && on2 && flat(D2.pt, B2.at) < 0.2, 'a man flash-blind when the wall beside him went (the wall charge\'s stun) turns to the hole when his eyes are back, a loud door or not', `${D2.gd.callsign} blind 4.1 s from the blast · a door of his room held at 2.4 · turned while blind: ${blindOn} · a second after his sight is back: on the hole ${on2}, his fix point ${at(D2.pt)} vs ${B2 ? at(B2.at) : '-'} · state ${D2.gd.state} mode ${D2.mode} · the hole in his head: ${JSON.stringify(m2 ?? null)} at ${f1(g2.time)} s${tail()}`);
  } else console.log('    (nothing to stage the blind man beside)');
  return F.done();
}

/** cover shot away or blown: a man crouched behind a crate that goes, with somebody to hide from, goes to other cover */
/** `orElse`: the level asked when `level` has nothing to stage (probes.ts: the rebuilt block has no crate a man can kneel behind away from the squad's start —
 *  its cover is low benches, things against walls and the loading hall's two panels beside the team — and the line is not to drop out of the gate for it) */
/** for a check that stages the crate line under switches of its own (everygone-check.ts): `stage` runs once the level stands, `seen` gets what the man did */
export interface CrateHook { stage?: (on: boolean) => void; /** `rows`: the change rows the blast files beside the defender (within WALLREACT.nearM of his feet) */ seen?: (x: { on: boolean; rows: number; moved: number; hidden: boolean; open: boolean; near: boolean }) => void; /** the leg with the module on, and no other */ onOnly?: boolean }
export async function wallreactCrate(level: string, orElse?: string, hook?: CrateHook): Promise<boolean> {
  const F = family(`wallreact-crate [${level}]: the crate a man crouches behind is blown — he goes to other cover; switch off, he kneels behind nothing`);
  let asked = false;
  for (const on of hook?.onOnly ? [true] : [true, false]) {
    const R = await rig(level, 8, on), g = R.g, nav = g.col.nav, D = R.defs()[0]; hook?.stage?.(on);
    // a cover object, a spot behind it, and a point a few strides off it hides him from (crouched) while it stands
    let pick: { w: any; P: Vec3; T: Vec3; near: boolean } | null = null;
    // (is there anywhere within a short run that hides a crouched chest from T — asked of the floor, not of the module)
    const offLine = (c: number[], T: Vec3, q: Vec3, d: number) => { const ex = q[0] - T[0], ez = q[2] - T[2], t = Math.max(0, Math.min(1, ((c[0] - T[0]) * ex + (c[2] - T[2]) * ez) / (ex * ex + ez * ez || 1))); return Math.hypot(T[0] + ex * t - c[0], T[2] + ez * t - c[2]) > d; };
    const somewhere = (P: Vec3, T: Vec3, c: number[], rad: number) => { for (let r = 1.5; r <= 7; r += 0.75) for (let a = 0; a < 16; a++) { const q: Vec3 = [P[0] + Math.sin(a * Math.PI / 8) * r, 0, P[2] + Math.cos(a * Math.PI / 8) * r]; if (nav.isBlocked(q[0], q[2]) || !g.col.segmentBlocked([T[0], 1.15, T[2]], [q[0], 0.9, q[2]]) || !offLine(c, T, q, rad + 0.5)) continue; /* (hidden by something other than the crate that is about to go) */ const path = nav.findPath(P, q); let L = 0, z: number[] = P; for (const x of path ?? []) { L += flat(z, x); z = x; } if (path?.length && L < 1.5 * r + 1.5) return true; } return false; };
    for (const w of g.destr.walls.all()) {
      if (w.kind !== 'cover' || w.open || pick?.near) continue; const c = w.box.c, rad = Math.max(w.box.h[0], w.box.h[2]);
      if (R.defs().some((x: any) => x !== D && flat(x.gd.char.pos, c) < 3) || g.orders.squad().some((m: any) => flat(m.char.pos, c) < 9)) continue;
      // (the crate and nothing else: one stood against a partition takes a piece of the wall with it, and the man a stride behind is then hidden again by
      //  shifting along what is left of the wall — a move about the wall, not about the crate. Asked ahead of the blast, by the blast's own plan)
      const goes = g.destr.wallsFor([c[0], 0.6, c[2]] as Vec3, { radius: 1.2 }); if (goes.some((o: any) => o.kind === 'wall')) continue;
      for (let a = 0; a < 8 && !pick?.near; a++) { const d: Vec3 = [Math.sin(a * Math.PI / 4), 0, Math.cos(a * Math.PI / 4)];
        const P = v3.mad(c, d, -(rad + 0.55)) as Vec3; P[1] = 0; if (nav.isBlocked(P[0], P[2])) continue;
        if (g.col.segmentBlocked([P[0], 1.15, P[2]], [c[0], w.box.c[1] + w.box.h[1] + 0.3, c[2]])) continue;   // (he kneels AT it: a long bench against an outer wall has its 'spot behind' out in the yard, the wall between them)
        for (const far of [5, 4, 3.2]) { const T = v3.mad(c, d, far) as Vec3; T[1] = 0; if (nav.isBlocked(T[0], T[2])) continue;
          if (!g.col.segmentBlocked([T[0], 1.15, T[2]], [P[0], 0.9, P[2]])) continue;   // (hidden behind it today)
          if (g.col.segmentBlocked([T[0], 1.15, T[2]], [c[0], w.box.c[1] + w.box.h[1] + 0.3, c[2]])) continue;   // (… by the crate, not by a wall on the way)
          // (… and by the crate ALONE: with what this blast would take of it gone — the blast's own plan, the lines asked as they would then be — he is open.
          //  A box that loses a corner cell in a pile of lived-in things is opened by the furniture rule razing the pile, which is not this module's row)
          if (goes.length && g.destr.withWallsOpen(goes, () => g.col.segmentBlocked([T[0], 1.15, T[2]], [P[0], 0.9, P[2]]))) continue;
          const near = somewhere(P, T, c, rad); if (!pick || near) pick = { w, P, T, near }; break; } }
    }
    if (!pick || !D) { if (on) console.log(`    (no crate on this floor with a spot behind it and a clear line to it: ${g.destr.walls.all().filter((w: any) => w.kind === 'cover').length} cover objects — the cover-shot-away line is not asked here)`); break; }
    asked = true; const { w, P, T, near } = pick;
    for (const m of g.orders.squad()) m.dazzledUntil = g.time + 1e6;   // (what is asked is what HE does about the crate: the team outside is left blind for it)
    R.post(D, P, T); D.gd.char.crouch = true; R.step(0.3);
    D.gd.sightPos = [...T]; D.gd.sightT = g.time;   // (he saw a man there a moment ago: that is who he is hiding from)
    const d0 = [...D.gd.char.pos], hid0 = g.col.segmentBlocked([T[0], 1.15, T[2]], [d0[0], 0.9, d0[2]]);
    let blastRows = 0; const wr0: any = on ? R.wr() : { take() { } }, take0 = wr0.take;   // (the rows this blast files BESIDE HIM — what his question is made of — as the module counts 'beside')
    wr0.take = function (row: any) { if (row.rect) { const p = D.gd.char.pos, dx = Math.max(row.rect[0] - p[0], 0, p[0] - row.rect[2]), dz = Math.max(row.rect[1] - p[2], 0, p[2] - row.rect[3]); if (Math.hypot(dx, dz) <= WALLREACT.nearM) blastRows++; } return take0.call(this, row); };
    const res = g.destr.blast([w.box.c[0], 0.6, w.box.c[2]], { radius: 1.2, who: NOBODY_ID, chaos: false }); R.step(0.1); wr0.take = take0;
    const open1 = !g.col.segmentBlocked([T[0], 1.15, T[2]], [d0[0], 0.9, d0[2]]);
    for (let i = 0; i < 8 * 60; i++) { if (i < 60) { D.gd.sightPos = [...T]; } R.step(1 / 60); }
    const p1 = D.gd.char.pos, moved = flat(p1, d0), hid1 = g.col.segmentBlocked([T[0], 1.15, T[2]], [p1[0], 0.9, p1[2]]);
    hook?.seen?.({ on, rows: blastRows, moved, hidden: hid1, open: open1, near });
    if (on) {
      F.verdict(res.cover > 0 && hid0 && open1, 'the blast takes the crate: the man crouched behind it is open to where he was hiding from', `cover cells gone ${res.cover} (walls ${res.walls}) · crate #${w.id} ${w.surf} at ${at(w.box.c)} · hidden before ${hid0} · open after ${open1} · rows ${WALLREACT_STATS.rows}`);
      if (!near) F.verdict(moved < 0.5 && WALLREACT_STATS.noCover >= 1 && D.gd.state !== 'dead', 'no crate on this floor has anywhere within a run that hides him: he stays and fights from where he is, and is asked again every few seconds', `stood ${at(d0)} · moved ${f1(moved)} m · no cover found ${WALLREACT_STATS.noCover}×${tail()}`);
      else F.verdict(moved > 1.0 && hid1 && WALLREACT_STATS.movedDef + WALLREACT_STATS.movedAI >= 1 && D.gd.state !== 'dead', 'he leaves it for somewhere a crouched chest is hidden from that man again', `stood ${at(d0)} · now ${at(p1)}, ${f1(moved)} m off · hidden from ${at(T)}: ${hid1} · moved holding ${WALLREACT_STATS.movedDef} / in the fight ${WALLREACT_STATS.movedAI} · no cover found ${WALLREACT_STATS.noCover}× · mode ${D.mode} · state ${D.gd.state}${tail()}`);
    } else F.verdict(moved < 0.5 && open1, 'switch off: he stays kneeling where the crate was, open (the engine\'s build)', `moved ${f1(moved)} m · open ${open1} · wallreact rows ${WALLREACT_STATS.rows}`);
  }
  if (!asked) { console.log(`=== wallreact-crate [${level}]: NOT ASKED (nothing to stage)${orElse && orElse !== level ? ` — asked on ${orElse}` : ''} ===`); return orElse && orElse !== level ? wallreactCrate(orElse, undefined, hook) : true; }
  return F.done();
}

export async function wallreactHole(level: string): Promise<boolean> {
  const F = family(`wallreact-hole [${level}]: a hole a man fits through joins the rooms either side for the room fight; the team's book keeps the far side uncleared; a restart puts it all back`);
  const R = await rig(level, 6), g = R.g, Fb = R.F, nav = g.col.nav;
  const len = (a: Vec3, b: Vec3) => { const p = nav.findPath(a, b); if (!p?.length) return Infinity; let L = 0, q: number[] = a; for (const w of p) { L += flat(q, w); q = w; } return L; };
  const S = spots(R).find(s => { const ra = Fb.roomAt(s.a), rb = Fb.roomAt(s.b); return ra && rb && ra !== rb; });
  const defs = R.defs();
  if (!S || defs.length < 2) { F.verdict(false, 'a partition between two rooms and two defenders to stage', `spots between two rooms: ${S ? 1 : 0} of ${spots(R).length} · defenders ${defs.length}`); return F.done(); }
  const [D1, D2] = [...defs].sort((x, y) => flat(x.gd.char.pos, S.mid) - flat(y.gd.char.pos, S.mid));
  const pa = v3.mad(v3.mad(S.mid, S.n, 2.4), S.u, 2.2) as Vec3, pb = v3.mad(v3.mad(S.mid, S.n, -2.4), S.u, -2.2) as Vec3;
  const inRoom = (c: Vec3[], r: any) => c.find(p => !nav.isBlocked(p[0], p[2]) && Fb.roomAt(p) === r) ?? c[c.length - 1];   // (a small building: a stride along the wall can be the next room)
  R.post(D1, inRoom([pa, v3.mad(S.mid, S.n, 2.4) as Vec3, S.a], Fb.roomAt(S.a)), S.a); R.post(D2, inRoom([pb, v3.mad(S.mid, S.n, -2.4) as Vec3, S.b], Fb.roomAt(S.b)), S.b); R.step(0.5);
  D1.ev = D1.room.entries.map((_: any, i: number) => 0.1 * (i + 1));   // (evidence to carry over, a different figure per door)
  const evBy = new Map(D1.room.entries.map((e: any, i: number) => [e.door, D1.ev[i]]));
  const ra0 = Fb.roomAt(S.a), rb0 = Fb.roomAt(S.b), L0 = len(S.a, S.b), ca = g.cleared.roomAt(S.a), cb = g.cleared.roomAt(S.b);
  const res = blow(R, S); R.step(0.1);
  const B = R.wr().breaches[0], ra1 = Fb.roomAt(S.a), rb1 = Fb.roomAt(S.b), L1 = len(S.a, S.b);
  F.verdict(ra0 !== rb0 && ra1 === rb1 && !!ra1, 'two rooms before, one room after — whichever side is asked', `before: rooms ${ra0.id} and ${rb0.id} · after: ${ra1?.id} and ${rb1?.id} (${ra1?.cells.size} cells, doors ${ra1?.entries.map((e: any) => e.door.def.name).join('/')}) · nav cells opened ${res.opened} · ${B ? `${B.walk ? 'walk-through' : 'PORT'} ${f1(B.half * 2)} m` : 'no breach'}`);
  const carried = D1.room.entries.every((e: any, i: number) => (D1.ev[i] ?? NaN) >= ((evBy.get(e.door) as any) ?? 0) - 0.05) && [...evBy.keys()].every((d: any) => D1.room.entries.some((e: any) => e.door === d));   // (at least what he had, door by door: the bang itself is heard through doors and adds its own)
  F.verdict(D1.room === D2.room && D1.room === ra1 && D1.ev.length === D1.room.entries.length && D2.ev.length === D2.room.entries.length && carried, 'the defenders either side hold the SAME room, their evidence carried over door by door', `${D1.gd.callsign} room ${D1.room?.id} ev [${D1.ev.map((x: number) => f1(x)).join(', ')}] over ${D1.room?.entries.length} doors · ${D2.gd.callsign} room ${D2.room?.id} ev ${D2.ev.length} · carried: ${carried} · before ${[...evBy].map(([d, v]: any) => `${d.def.name}=${f1(v)}`).join(' ')} · after ${D1.room.entries.map((e: any, i: number) => `${e.door.def.name}=${f1(D1.ev[i])}`).join(' ')}`);
  F.verdict(L1 < L0 - 1 && L1 < 4.5, 'a walk from one side to the other goes through it', `a → b by the nav grid: ${f1(L0)} m before · ${f1(L1)} m after (2.4 m apart)`);
  const cb1 = g.cleared.roomAt(S.b), ca1 = g.cleared.roomAt(S.a), hole = g.cleared.roomAt(S.mid);
  F.verdict(ca1 === ca && cb1 === cb && hole === 0 && (cb === 0 || !g.cleared.isKnown(cb) || g.cleared.isKnown(cb) === (ca !== cb ? g.cleared.isKnown(cb) : true)), 'the team\'s cleared book: the hole\'s floor is no room\'s (a doorway\'s), and what is beyond it is not cleared by the wall going', `rooms a ${ca} → ${ca1}, b ${cb} → ${cb1} · the hole's own cell: room ${hole} · b known: ${cb ? g.cleared.isKnown(cb) : 'open floor'}`);
  R.step(1.5);
  const k1 = B.men.has(D1.gd), k2 = B.men.has(D2.gd), w = [...R.wr().watching.entries()].filter(([, b]: any) => b === B).map(([m]: any) => m.callsign);
  F.verdict(k1 && k2 && w.length >= 1, 'both know it, and a gun is on it', `${D1.gd.callsign} knows ${k1} · ${D2.gd.callsign} knows ${k2} · watching it: ${w.join(', ') || 'nobody'} · moved off its line: ${WALLREACT_STATS.movedDef} · said: wall barks ${[...B.said].join('/')}${tail()}`);
  // a door off its hinges is the doors' own piece: its row in the feed (the doors goal's charge files { kind: 'door', cause: 'blast' }) is no wall hole here
  { const n0 = R.wr().breaches.length, r0 = Fb.rooms.length, o0 = g.cover.openings.length, rows0 = WALLREACT_STATS.rows; let threw = '';
    try { g.destr.walls.note({ kind: 'door', cause: 'blast', id: -1, pos: [S.mid[0], 0, S.mid[2]], rect: [S.mid[0] - 0.6, S.mid[2] - 0.6, S.mid[0] + 0.6, S.mid[2] + 0.6], opened: [], walkable: true, sight: true, dead: false, who: 1 }); R.step(0.5); } catch (e) { threw = String(e); }
    F.verdict(!threw && R.wr().breaches.length === n0 && Fb.rooms.length === r0 && g.cover.openings.length === o0 && WALLREACT_STATS.rows === rows0, 'a door row in the feed (a leaf blown off its hinges) is left to the doors: no breach, no room flooded, nothing thrown', `breaches ${n0} → ${R.wr().breaches.length} · rooms ${r0} → ${Fb.rooms.length} · openings ${o0} → ${g.cover.openings.length} · rows counted ${rows0} → ${WALLREACT_STATS.rows}${threw ? ` · threw ${threw}` : ''}`); }
  // a restart: the walls are put back and so is every book
  g.restartEncounter(); R.step(0.5);
  const ra2 = Fb.roomAt(S.a), rb2 = Fb.roomAt(S.b);
  F.verdict(R.wr().breaches.length === 0 && !g.cover.openings.some((o: any) => String(o.id).startsWith('breach:')) && ra2 !== rb2 && g.col.segmentBlocked([S.a[0], 1.3, S.a[2]], [S.b[0], 1.3, S.b[2]]) && len(S.a, S.b) > L1 + 1, 'a restart: the wall stands, two rooms again, no breach in anybody\'s book', `breaches ${R.wr().breaches.length} · breach openings ${g.cover.openings.filter((o: any) => String(o.id).startsWith('breach:')).length} · rooms ${ra2?.id} / ${rb2?.id} · a → b ${f1(len(S.a, S.b))} m`);
  return F.done();
}

export async function wallreactFlank(level: string): Promise<boolean> {
  const F = family(`wallreact-flank [${level}]: a flanking plan under way is dealt again when one of its men learns of a hole a man fits through`);
  const R = await rig(level, 7), g = R.g, nav = g.col.nav;
  const len = (a: Vec3, b: Vec3) => { const p = nav.findPath(a, b); if (!p?.length) return Infinity; let L = 0, q: number[] = a; for (const w of p) { L += flat(q, w); q = w; } return L; };
  // the wall whose hole shortens a walk the most: two men one side, their fix the other
  let best: { S: Spot; gain: number } | null = null;
  for (const S of spots(R)) { const from = v3.mad(S.mid, S.n, 2.4) as Vec3, to = v3.mad(S.mid, S.n, -2.4) as Vec3; const L = len(from, to); if (L === Infinity || L < 8) continue; if (!best || L > best.gain) best = { S, gain: L }; }
  const defs = R.defs();
  if (!best || defs.length < 2) { F.verdict(false, 'a long way round a partition and two defenders to stage', `walls with a walk of 8 m or more round them: ${best ? 1 : 0} · defenders ${defs.length}`); return F.done(); }
  const S = best.S, fix = v3.mad(S.mid, S.n, -2.4) as Vec3, [D1, D2] = [...defs].sort((x, y) => flat(x.gd.char.pos, S.mid) - flat(y.gd.char.pos, S.mid));
  const men = [D1.gd, D2.gd], ps = [v3.mad(v3.mad(S.mid, S.n, 2.4), S.u, 0.9), v3.mad(v3.mad(S.mid, S.n, 2.4), S.u, -0.9)] as Vec3[];
  men.forEach((m: any, i: number) => { const p = nav.isBlocked(ps[i][0], ps[i][2]) ? v3.mad(S.mid, S.n, 2.4 + i) as Vec3 : ps[i]; m.char.pos[0] = p[0]; m.char.pos[2] = p[2]; m.script = null; m.hold = false; m.pinned = false; m.state = 'alert'; m.awareness = 1; m.lastKnown = [...fix]; m.fixT = g.time; m.lastSeenT = g.time - 5; m.path = []; m.pathGoal = null; });
  R.F.defs.forEach((D: any) => { if (men.includes(D.gd)) D.mode = 'free'; });
  const P0 = planApproach(g, men, fix, 'probe');
  if (!P0) { F.verdict(false, 'the tactics deal the two a plan on that fix', `no plan: the way round is ${f1(best.gain)} m`); return F.done(); }
  const id0 = P0.id; R.step(1.2);   // (older than the tactics' own gap between deals)
  const had = plansOf(g).some((p: any) => p.id === id0);
  blow(R, S); R.step(0.6);
  const B = R.wr().breaches[0], plans = plansOf(g), again = plans.find((p: any) => p.id !== id0 && p.why === 'a wall opened');
  F.verdict(had && !!B && B.walk && (B.men.has(men[0]) || B.men.has(men[1])) && WALLREACT_STATS.replans >= 1 && !plans.some((p: any) => p.id === id0), 'the plan dealt over the old floor is ended once one of them knows of the hole', `plan #${id0} alive before the blast: ${had} · breach ${B ? (B.walk ? 'walk-through' : 'port') : 'none'} · they know: ${men.map((m: any) => `${m.callsign} ${B?.men.has(m)}`).join(', ')} · replans ${WALLREACT_STATS.replans} · plans now ${plans.map((p: any) => `#${p.id} '${p.why}'`).join(', ') || 'none'}`);
  F.verdict(len(ps[0], fix) < 7, '… and the floor it is dealt over next has the way through', `their walk to the fix: ${f1(best.gain)} m round before · ${f1(len(ps[0], fix))} m now · ${again ? `plan #${again.id} dealt 'a wall opened'` : 'no second plan (the two are inside the tactics\' joining distance of the fix by the new way: they simply go)'}${tail()}`);
  // … and a man comes through it: across the wall's line inside the hole's width
  const side = (q: number[]) => (q[0] - B.at[0]) * B.n[0] + (q[2] - B.at[2]) * B.n[1], s0 = men.map((m: any) => Math.sign(side(m.char.pos))); let through = '';
  for (let i = 0; i < 12 * 60 && !through; i++) { const was = men.map((m: any) => [...m.char.pos]); for (const m of men as any[]) { m.lastKnown = [...fix]; m.lastSeenT = g.time - 5; } R.step(1 / 60);
    men.forEach((m: any, k: number) => { if (!through && m.state !== 'dead' && Math.sign(side(m.char.pos)) === -s0[k] && thru(B, was[k], m.char.pos)) through = `${m.callsign} at ${f1(g.time)} s`; }); }
  F.verdict(!!through, '… and one of them comes through the hole to the fix (a flank through a wall that is no longer there)', `through the hole: ${through || 'nobody in 12 s'} · they stand ${men.map((m: any) => `${m.callsign} ${at(m.char.pos)} ${m.state}`).join(', ')} · fix ${at(fix)}`);
  return F.done();
}

/** the squad: a hole a man fits through is a way in — a teammate sent to the far side walks through it, and stops short of nothing */
export async function wallreactThrough(level: string): Promise<boolean> {
  const F = family(`wallreact-through [${level}]: a teammate ordered to the far side of a blown wall walks through the hole instead of round by the doors`);
  const R = await rig(level, 9), g = R.g, nav = g.col.nav, op = R.ops()[0];
  const len = (a: Vec3, b: Vec3) => { const p = nav.findPath(a, b); if (!p?.length) return Infinity; let L = 0, q: number[] = a; for (const w of p) { L += flat(q, w); q = w; } return L; };
  let best: { S: Spot; L: number } | null = null;
  for (const S of spots(R)) { const L = len(v3.mad(S.mid, S.n, 2.4) as Vec3, v3.mad(S.mid, S.n, -2.4) as Vec3); if (L !== Infinity && L >= 8 && (!best || L > best.L)) best = { S, L }; }
  if (!best || !op) { console.log(`    (no partition here with a walk of 8 m or more round it)\n=== wallreact-through [${level}]: NOT ASKED (nothing to stage) ===`); return true; }
  const S = best.S, from = v3.mad(S.mid, S.n, 2.4) as Vec3, to = v3.mad(S.mid, S.n, -2.4) as Vec3;
  for (const m of g.guards) if (m.team !== 'operative') m.dazzledUntil = g.time + 1e6; R.F.blindFire = false;
  R.hold(op, from, S.mid); R.step(0.3); blow(R, S); R.step(0.5);
  const B = R.wr().breaches[0];
  g.orders.assign(op, { order: 'hold', post: [to[0], 0, to[2]], face: v3.yawTo(to, from), going: 'moving', there: 'holding' });
  const side = (q: number[]) => (q[0] - B.at[0]) * B.n[0] + (q[2] - B.at[2]) * B.n[1]; let crossed = -1, viaHole = false, walked = 0;
  for (let i = 0; i < 14 * 60 && flat(op.char.pos, g.orders.of(op)?.post ?? to) > 0.5; i++) { const was = [...op.char.pos]; R.step(1 / 60); walked += flat(was, op.char.pos);
    if (crossed < 0 && side(was) * side(op.char.pos) < 0) { crossed = g.time; viaHole = thru(B, was, op.char.pos); } }
  const A = g.orders.of(op), endAt = A?.post ?? to;
  F.verdict(!!B && B.walk && B.ops >= 0 && crossed >= 0 && viaHole && walked < best.L - 1 && flat(op.char.pos, endAt) < 0.6, 'he crosses the wall\'s line inside the hole and stands on his mark beyond it', `the walk round was ${f1(best.L)} m · he walked ${f1(walked)} m · crossed at ${f1(crossed)} s ${viaHole ? 'through the hole' : 'ELSEWHERE'} · stands ${at(op.char.pos)}, mark ${at(endAt)}${flat(endAt, to) > 0.3 ? ` (moved ${f1(flat(endAt, to))} m off the hole's line from ${at(to)})` : ''} · order ${A?.order}${tail()}`);
  return F.done();
}

if (import.meta.main) {
  let ok = true; const only = process.argv.slice(2).filter(a => !a.startsWith('--') && !LEVELS.includes(a) && a !== 'all');
  for (const level of LEVELS) for (const [name, fn] of [['cover', wallreactCover], ['crate', wallreactCrate], ['port', wallreactPort], ['hole', wallreactHole], ['flank', wallreactFlank], ['through', wallreactThrough]] as const) {
    if (only.length && !only.includes(name)) continue;
    try { ok = (await fn(level)) && ok; } catch (e) { ok = false; console.log(`- FAIL — wallreact-${name} [${level}] threw\n    ${e instanceof Error ? e.stack : e}`); }
  }
  DESTRUCTION.on = false; Object.assign(WALLREACT, KNOBS0);
  console.log(`\n=== wallreact-probes: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`);
  process.exit(ok ? 0 : 1);
}
