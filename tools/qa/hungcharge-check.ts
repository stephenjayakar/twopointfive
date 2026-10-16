// A CHARGE SET ON WHAT HANGS ON THE WALL TAKES IT AND THE WALL (src/game/wallcharge.ts WALLCHARGE.hung; wallbreak.ts BlastOpts.hung, hungAt; furnblast.ts
// hungGoes). A board hung on a wall's face (a notice board, a whiteboard) stood between the charge set on it and the wall: the blast's plan found every column
// shielded, the row was offered, the charge went off and opened nothing. With the rule the board is the charge's too — the wall opens as the same wall bare
// would, and the board goes with it in pieces.
//
//   bun run tools/qa/hungcharge-check.ts          every board hung on a breakable wall of the block, the office and the warehouse (found by the engine's own
//                                                 `hungAt` along both faces of every wall), a charge set on each — at the place on it the game itself offers
//                                                 (settled, a man's standing room, floor behind) where there is one, else staged at its middle: the block's
//                                                 notice board, three places, behind the mess table on this floor — blown three ways on a fresh floor each:
//                                                 without the rule (the fault, as it was), with it, and without it on the same wall with the board taken
//                                                 off first (what 'as the bare wall would' is measured against). Then the board re-cut in the level's data
//                                                 before the floor stands: a long one with the charge under its end, and a sign too small to be a board.
//   TPS_PROFILE=shipped …                         the same on the stand the page opens on (one road on both: the wall's own rule for what hangs on an opened
//                                                 stretch takes the board, so the hole's row is filed with the board already down)
//   HUNGCHARGE_BREAK=1 …                          the rule never switched on and the same lines asked: must fail
// Rigid pieces only: the splinters are GPU particles this harness has no eyes for, and nothing here looks at a picture.
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { WALLCHARGE, wallAt, wallPt } = await import(`${ROOT}/src/game/wallcharge.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const PROFILE = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
type Vec3 = [number, number, number];
const f2 = (x: number) => x.toFixed(2), HIDE = 3 /* BoxFlag.NoPrimary | BoxFlag.NoShadow */;

/** a floor stood up with its room clear running (the loud levels' rules live), the rule as asked */
async function floor(level: string, rule: boolean, cut?: (boxes: any[]) => void) {
  DESTRUCTION.on = true; const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${level}.json`), 'utf8'))); cut?.(lvl.boxes);
  const W: any = await standUp({ level: lvl }); const g = W.game; DESTRUCTION.on = true; WALLCHARGE.on = true; g.tune.chaos = 0.5; g.godMode = true;
  if (lvl.scenarios?.roomClear) await startFromQuery(g, new URLSearchParams('roomclear&squad4'));
  const step = (n: number) => { for (let i = 0; i < n; i++) W.step(1 / 60); }; step(30); WALLCHARGE.hung = rule;
  return { g, step };
}
interface Place { level: string; board: number; wall: number; p: Vec3; side: number; ax: boolean; what: string; offered: boolean }
const fromOf = (P: { p: Vec3; side: number; ax: boolean }): Vec3 => P.ax ? [P.p[0], 0, P.p[2] + P.side] : [P.p[0] + P.side, 0, P.p[2]];
/** does the plan of a charge at the spot hole its wall (a sill gone), asked plain or with the charge's wall named */
const plans = (g: any, w: any, named: boolean): boolean => g.destr.walls.wouldOpen(wallPt(w, 0, 0.06, WALLCHARGE.height), named ? { hung: { wall: w.index, r: WALLCHARGE.hungM } } : {}).some((o: any) => o.id === w.index && o.hole);
/** every board hung on a breakable wall of this floor — by the engine's own `hungAt` — with the place a charge goes on it: the one the game offers (settled,
 *  standing room, floor behind, still on the board, a dud by the plain plan) nearest its middle, else its middle staged; and how many such places it offers */
function boards(level: string, g: any): { places: Place[]; offered: number; fixed: number } {
  const H = WALLCHARGE.height, C = g.wallCharge, found = new Map<number, Place & { d: number }>(), seen = new Set<string>(); let offered = 0, fixed = 0;
  for (const B of g.destr.walls.all()) { if (B.kind !== 'wall') continue; const b = B.box, ax = b.h[0] >= b.h[2], L = ax ? b.h[0] : b.h[2], T = ax ? b.h[2] : b.h[0];
    for (const side of [1, -1]) for (let u = -L + 0.2; u <= L - 0.2; u += 0.125) { const p: Vec3 = ax ? [b.c[0] + u, H, b.c[2] + side * (T + 0.06)] : [b.c[0] + side * (T + 0.06), H, b.c[2] + u];
      for (const j of g.destr.walls.hungAt(B.id, p, WALLCHARGE.hungM)) { const x = g.col.boxes[j], what = `${level} #${j} (${f2(2 * Math.max(x.h[0], x.h[2]))} × ${f2(2 * x.h[1])} m) on wall #${B.id}`;
        const staged = { level, board: j, wall: B.id, p, side, ax, what: `${what}, staged`, offered: false, d: 100 + Math.hypot(x.c[0] - p[0], x.c[2] - p[2]) };
        const w0 = wallAt(g, [p[0], 0, p[2]], fromOf(staged)), w = w0 && w0.ok && !w0.outer && w0.index === B.id ? C.settle(w0) : null; let best: Place & { d: number } = staged;
        if (w && w.ok && C.setSpot(w) && !C.openAt(w) && C.farFloor(w)) { const q = wallPt(w, 0, 0.06, H) as Vec3;
          if (g.destr.walls.hungAt(B.id, q, WALLCHARGE.hungM).includes(j) && !plans(g, w, false)) { const key = `${j}:${q[0].toFixed(2)}:${q[2].toFixed(2)}`;
            if (!seen.has(key)) { seen.add(key); offered++; if (plans(g, w, true)) fixed++; }
            best = { ...staged, p: q, what: `${what}, offered`, offered: true, d: Math.hypot(x.c[0] - q[0], x.c[2] - q[2]) }; } }
        const o = found.get(j); if (!o || best.d < o.d) found.set(j, best); } } }
  return { places: [...found.values()].sort((a, b) => a.board - b.board), offered, fixed };
}
/** the same place `du` metres along the wall */
const along = (P: Place, du: number): Place => ({ ...P, p: P.ax ? [P.p[0] + du, P.p[1], P.p[2]] : [P.p[0], P.p[1], P.p[2] + du] });
const spotOf = (g: any, P: Place) => wallAt(g, [P.p[0], 0, P.p[2]], fromOf(P));
const cellsOf = (g: any, wall: number): string => (g.destr.walls.snapshot()?.b ?? []).find((r: any) => r[0] === wall)?.[1] ?? '';
/** a charge set at the place and blown: did the wall hole, is the board gone, where are the pieces of its colour a second and a half on */
function blowAt(S: { g: any; step: (n: number) => void }, P: Place, bare = false) {
  const g = S.g, C = g.wallCharge, w = spotOf(g, P), b = g.col.boxes[P.board], col = [...b.albedo]; if (!w || !w.ok || w.index !== P.wall) return null;
  if (bare) b.flags |= HIDE;   // (the same wall with nothing hung on it)
  const mine = (c: any) => c.box.albedo.every((v: number, k: number) => Math.abs(v - col[k]) < 0.004) && Math.min(c.box.h[0], c.box.h[2]) <= Math.min(b.h[0], b.h[2]) + 0.002;
  const had = new Set(g.destr.debris.list), flags0 = b.flags; let walk = false; const un = g.destr.walls.onChange((c: any) => { if (c.kind === 'hole' && c.id === P.wall && c.walkable) walk = true; });
  const forecast = plans(g, w, WALLCHARGE.hung), pure = b.flags === flags0;
  C.set.push({ wall: w, t: g.time, by: 'probe', paid: 0 }); const r = C.blow(C.set[C.set.length - 1]); un(); S.step(2);
  const fresh = g.destr.debris.list.filter((c: any) => !had.has(c) && mine(c)), born = fresh.length; S.step(88);
  const off = (c: any) => ((P.ax ? c.box.c[2] - w.box.c[2] : c.box.c[0] - w.box.c[0]) * P.side);
  const live = fresh.filter((c: any) => g.destr.debris.list.includes(c));
  return { hole: !!r?.hole && !!C.holeAt(w), gone: !bare && (b.flags & 1) !== 0, cells: cellsOf(g, P.wall), born, back: live.filter((c: any) => off(c) > 0.2).length, through: live.filter((c: any) => off(c) < -0.2).length,
    forecast, pure, walk, kept: (g.destr.walls.snapshot()?.h ?? []) as [number, number][] };
}

export async function hungchargeCheck(): Promise<boolean> {
  const BREAK = process.env.HUNGCHARGE_BREAK === '1', RULE = !BREAK;
  console.log(`\n=== hungcharge: a wall charge set on a board that hangs on the wall takes the board and the wall${BREAK ? ' — HUNGCHARGE_BREAK: the rule never on' : ''} ===`);
  let all = true; const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const knobs0 = knobsCopy(), destr0 = DESTRUCTION.on, rnd0 = Math.random;
  const log = console.log, quiet = async <T>(fn: () => Promise<T>): Promise<T> => { console.log = () => { }; try { return await fn(); } finally { console.log = log; } };
  try {
    // the stand, read off the first stand-up before the check sets anything
    { DESTRUCTION.on = true; const W: any = await quiet(() => standUp({})); void W; const stood = WALLCHARGE.hung;
      const word = process.env.TPS_HUNGCHARGE, shipped = process.env.TPS_PROFILE === 'shipped', want = word !== undefined ? word === '1' : shipped, row = FROZEN_HOLDS['WALLCHARGE.hung'];
      verdict(stood === want && typeof row === 'string' && /TPS_HUNGCHARGE=1/.test(row), `the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen digest was recorded'}; FROZEN_HOLDS carries the row and its word`, `after the stand-up: ${stood} · TPS_HUNGCHARGE ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · FROZEN_HOLDS['WALLCHARGE.hung'] = ${row ?? 'MISSING'}`); }
    // THE PLACES: every board on a breakable wall where the wall's row is offered, and the block's notice board at the three places of the neighbour's count
    const places: Place[] = []; const seen: string[] = []; let offered = 0, fixed = 0;
    for (const level of ['block', 'office', 'warehouse']) { const S = await quiet(() => floor(level, false)); const B = boards(level, S.g); offered += B.offered; fixed += B.fixed;
      const ok = B.places.filter(P => { const w = spotOf(S.g, P); return !!w && w.ok && w.index === P.wall && !w.outer; });
      seen.push(`${level} ${ok.length} (${B.offered} offered places on them are duds by the plain plan)`);
      for (const P of ok) { places.push(P); if (level === 'block' && S.g.col.boxes[P.board].h[1] >= 0.39) places.push({ ...along(P, -0.25), what: `${P.what} 0.25 m along` }, { ...along(P, 0.25), what: `${P.what} 0.25 m back` }); } }
    // three floors a place: the fault, the rule, the bare wall. A place the same board was already blown at on this floor needs a floor of its own.
    const run = async (rule: boolean, bare: boolean) => { const out: (ReturnType<typeof blowAt>)[] = []; let S: Awaited<ReturnType<typeof floor>> | null = null, lvl = '', used = new Set<number>();
      for (const P of places) { if (!S || lvl !== P.level || used.has(P.board)) { S = await quiet(() => floor(P.level, rule)); lvl = P.level; used = new Set(); } used.add(P.board); out.push(blowAt(S, P, bare)); }
      return out; };
    const off = await run(false, false), on = await run(RULE, false), bareW = await run(false, true);
    // (a place is FAIR where the same wall with the board taken off does hole: elsewhere the wall holds for a reason of its own, and no rule about boards is asked there)
    const fair = places.filter((_, k) => bareW[k]?.hole), dud = fair.filter(P => !off[places.indexOf(P)]?.hole), opens = fair.filter(P => on[places.indexOf(P)]?.hole);
    const tell = (P: Place) => { const k = places.indexOf(P); return `${P.what}: ${off[k]?.hole ? 'hole' : 'none'} → ${on[k]?.hole ? 'hole' : 'NONE'}${bareW[k]?.hole ? '' : ' (the bare wall holds too)'}`; };
    { const mine = dud.filter(P => P.offered), block = places.filter(P => P.level === 'block');
      verdict(mine.length >= 3 && block.length >= 3 && block.every(P => dud.includes(P)) && offered >= 10 && fixed === offered,
        'the staging: without the rule a charge set on a board opens nothing (the fault, as it was) — at places the game itself offers (a man\'s standing room, floor behind) on three boards or more, and on the block\'s notice board at all three places; by the plan, every offered place that is a dud holes once the charge\'s wall is named',
        `boards: ${seen.join(' · ')} → ${places.length} places blown, ${fair.length} where the bare wall holes · without the rule ${dud.length} of those open nothing, ${mine.length} of them offered: ${dud.map(P => P.what).join(' | ')} · offered duds over the three floors ${offered}, holed by the plan with the wall named ${fixed}`); }
    verdict(dud.length > 0 && opens.length === fair.length, 'with the rule: at every one of them the charge opens a hole a man fits through', places.map(tell).join(' | '));
    { const same = places.filter((_, k) => on[k] && bareW[k] && on[k]!.cells === bareW[k]!.cells), bad = places.filter(P => !same.includes(P));
      verdict(same.length === places.length && fair.every(P => on[places.indexOf(P)]?.cells.includes('1')), 'with the rule: the wall opens cell for cell as the same wall does with the board taken off it first', `${same.length} of ${places.length} the same${bad.length ? ` · differ: ${bad.map(P => P.what).join(' | ')}` : ''}`); }
    { const at = (P: Place) => on[places.indexOf(P)], went = fair.filter(P => at(P)?.gone), inBits = fair.filter(P => (at(P)?.born ?? 0) >= 4), both = fair.filter(P => (at(P)?.back ?? 0) >= 1 && (at(P)?.through ?? 0) >= 1);
      verdict(fair.length > 0 && went.length === fair.length && inBits.length === fair.length && both.length === fair.length, 'with the rule: the board goes with the wall, in pieces — four or more rigid slabs of it, some through the hole and some back in the room a second and a half on',
        places.map((P, k) => `#${P.board}: gone ${on[k]?.gone} · ${on[k]?.born} slabs, ${on[k]?.back} back, ${on[k]?.through} through`).join(' | ')); }
    { const k0 = places.findIndex(P => dud.includes(P)), F = k0 >= 0 ? on[k0] : null, O = k0 >= 0 ? off[k0] : null;
      verdict(!!F && !!O && F.forecast === RULE && F.pure && !O.forecast && O.pure, 'the plan asked ahead with the charge\'s wall named lists that wall, and asking leaves the board as it hangs; asked plain it lists nothing, as it did',
        `with \`hung\`: lists the wall ${F?.forecast}, board untouched ${F?.pure} · plain: lists the wall ${O?.forecast}`); }
    // a wall with nothing hung at the charge: the rule changes nothing at all — the same cells, the same pieces in the same places
    { const sig = async (rule: boolean) => { const S = await quiet(() => floor('block', rule)), g = S.g; const Bs = boards('block', g).places.map(P => P.wall);
        const W = g.destr.walls.all().filter((B: any) => B.kind === 'wall' && !Bs.includes(B.id)); let done = 0; const where: string[] = [];
        for (const B of W) { if (done >= 2) break; const b = B.box, ax = b.h[0] >= b.h[2], T = ax ? b.h[2] : b.h[0], p: Vec3 = ax ? [b.c[0], 0, b.c[2] + T + 0.06] : [b.c[0] + T + 0.06, 0, b.c[2]];
          const w = wallAt(g, p, ax ? [p[0], 0, p[2] + 1] : [p[0] + 1, 0, p[2]]); if (!w || !w.ok || w.outer || w.index !== B.id || g.destr.walls.hungAt(B.id, [p[0], WALLCHARGE.height, p[2]], 1.5).length) continue;
          g.wallCharge.set.push({ wall: w, t: g.time, by: 'probe', paid: 0 }); g.wallCharge.blow(g.wallCharge.set[g.wallCharge.set.length - 1]); S.step(60); done++; where.push(`#${B.id}`); }
        return { done, where, sig: JSON.stringify(g.destr.walls.snapshot()) + '|' + JSON.stringify(g.destr.furn.snapshot() ?? null) + '|' + g.destr.debris.list.map((c: any) => c.box.c.map((v: number) => v.toFixed(3)).join(',')).join(';') }; };
      const A = await sig(RULE), B = await sig(false);
      verdict(A.done === 2 && A.sig === B.sig, 'a wall with no board at the charge: with the rule and without it the same cells go and the same pieces lie in the same places', `block, walls ${A.where.join(' ')} · the same ${A.sig === B.sig} (${A.sig.length} bytes of walls, furniture and debris compared)`); }
    // a checkpoint's slices, filed after the blast and re-applied on the level put back: the hole and the board's going are both in them
    { const k0 = places.findIndex(P => P.level === 'block'), P = places[k0]; let detail = 'no block place', ok = false;
      if (P) { const S = await quiet(() => floor('block', RULE)), g = S.g, r = blowAt(S, P), b = g.col.boxes[P.board];
        const sw = g.destr.walls.snapshot(), sf = g.destr.furn.snapshot(); await quiet(async () => { g.destr.reset(); }); const back = (b.flags & 1) === 0 && cellsOf(g, P.wall) === '';
        await quiet(async () => { g.destr.walls.restore(sw); g.destr.furn.restore(sf); }); const again = (b.flags & 1) !== 0, cells = cellsOf(g, P.wall);
        ok = !!r?.hole && back && again && cells === r.cells; detail = `blown: hole ${r?.hole}, board gone ${r?.gone} · the level put back: board and wall whole ${back} · slices re-applied: board gone ${again}, the same cells ${cells === r?.cells}`; }
      verdict(ok, 'a checkpoint keeps it: the walls\' and the furniture\'s slices filed after the blast, re-applied on the level put back, leave the same hole and the board gone', detail); }
    // THE BOARD RE-CUT in the level's data before the floor stands (the block's notice board; the charge where it was staged above)
    { const P0 = places.find(P => P.level === 'block' && !/0\.25 m/.test(P.what)); type Cut = (boxes: any[]) => void;
      const stage = async (rule: boolean, cut: Cut, P = P0!) => { const S = await quiet(() => floor('block', rule, cut)), g = S.g, r = blowAt(S, P), b = g.col.boxes[P.board];
        const sw = g.destr.walls.snapshot(), sf = g.destr.furn.snapshot(); await quiet(async () => { g.destr.reset(); }); const back = (b.flags & 1) === 0;
        // (the level as a later blast left it, the board taken by the furniture's rule this time: the same slice must still read as sound before the load)
        g.destr.furn.hidden.set(P.board, b.flags); b.flags |= HIDE; const later = g.destr.walls.check(sw) === null; await quiet(async () => { g.destr.reset(); });
        await quiet(async () => { g.destr.walls.restore(sw); g.destr.furn.restore(sf); }); const bad = { ...sw, h: [[P0!.wall, P0!.wall]] };
        return { r, kept: (sw?.h ?? []) as [number, number][], back, again: (b.flags & 1) !== 0, cells: cellsOf(g, P0!.wall), sound: g.destr.walls.check(sw) === null && later, refused: typeof g.destr.walls.check(bad) === 'string' }; };
      // …LONG, the charge a metre inside its end: the hole takes under half the cells behind it, so the hangers' own rule leaves it up — the charge's board goes all the same
      const long: Cut = boxes => { const b = boxes[P0!.board], k = b.h[0] >= b.h[2] ? 0 : 2; b.c[k] -= 1.3; b.h[k] = 3.3; b.c[1] = 1.3; b.h[1] = 0.55; };
      if (P0) { const P1 = { ...along(P0, 1.0 - (P0.p[P0.ax ? 0 : 2] - 9.2)), what: 'the long board' }, A = await stage(RULE, long, P1), O = await stage(false, long, P1);
        verdict(!!A.r?.hole && !!A.r.gone && A.r.walk && A.kept.some(r => r[0] === P0.board && r[1] === P0.wall) && A.sound && A.refused && A.back && A.again && A.cells === A.r.cells && !O.r?.hole && !O.r?.gone,
          'a long board with the charge a metre inside its end (6.6 × 1.1 m, re-cut in the level\'s data): the hole is under less than half of it and it goes with the wall all the same, before the hole\'s row is filed (the row says feet pass) — and a checkpoint keeps that (the walls\' slice names it with its wall and reads as sound, also on a level where the furniture\'s rule has since taken the board; one that names a wall as a board is refused; re-applied on the level put back, the board is gone again and the cells are the same)',
          `with the rule: hole ${A.r?.hole}, board gone ${A.r?.gone}, ${A.r?.born} slabs (${A.r?.through} through) · the hole's row walkable ${A.r?.walk} · the slice's boards [${A.kept.map(r => `#${r[0]} on #${r[1]}`).join(', ')}], sound ${A.sound}, a wall named as a board refused ${A.refused} · the level put back: board up ${A.back} · re-applied: gone ${A.again}, the same cells ${A.cells === A.r?.cells} · without the rule: hole ${O.r?.hole}, board gone ${O.r?.gone}`); }
      // …SMALL, a sign no bigger than a face: not a board (it is let down whole, by the hangers' rule), and still no shield — the charge's wall goes at the charge
      const sign: Cut = boxes => { const b = boxes[P0!.board], k = b.h[0] >= b.h[2] ? 0 : 2; b.h[k] = 0.2; b.c[1] = 1.35; b.h[1] = 0.2; };
      if (P0) { const S1 = await quiet(() => floor('block', RULE, sign)), listed = S1.g.destr.walls.hungAt(P0.wall, P0.p, WALLCHARGE.hungM).includes(P0.board), A = blowAt(S1, P0), S0 = await quiet(() => floor('block', false, sign)), O = blowAt(S0, P0);
        verdict(!listed && !!A?.hole && !!A.gone && !O?.hole, 'a sign too small to be a board (0.4 × 0.4 m at the blast\'s eye, re-cut the same way): no board of the charge\'s, and no shield either — with the rule the wall holes at the charge and the sign comes down with it; without it the charge opens no way through',
          `listed as a board ${listed} · with the rule: hole ${A?.hole}, sign gone ${A?.gone} · without: hole ${O?.hole}`); }
      if (!P0) verdict(false, 'the board re-cut', 'no block place to stage it on'); }
    // a recording from before the key replays with the rule off; one that carries it plays as it says (journal.ts applyKnobs); the page's own boot
    { const S = await quiet(() => floor('block', false)), g = S.g, snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      WALLCHARGE.hung = true; const old = snap(); delete old.tables.WALLCHARGE.hung; JOURNAL.applyKnobs(g, old); const without = WALLCHARGE.hung;
      const own = snap(); own.tables.WALLCHARGE.hung = true; JOURNAL.applyKnobs(g, own); const withIt = WALLCHARGE.hung;
      verdict(without === false && withIt === true, 'a recording from before the key replays with the rule off; one that carries it on plays with it on', `applyKnobs with no key → ${without} · with the key on → ${withIt}`);
      PROFILE.pageSwitches(new URLSearchParams('')); const a = WALLCHARGE.hung; PROFILE.pageSwitches(new URLSearchParams('hungcharge=0')); const b = WALLCHARGE.hung; PROFILE.pageSwitches(new URLSearchParams('wallfurn=0')); const c = WALLCHARGE.hung;
      verdict(a === true && b === false && c === true, 'the page\'s boot (pageSwitches): no flag → on · ?hungcharge=0 → off · another flag leaves it on', `'' → ${a} · 'hungcharge=0' → ${b} · 'wallfurn=0' → ${c}`); }
  } finally { console.log = log; knobsBack(knobs0); DESTRUCTION.on = destr0; Math.random = rnd0; }   // (pageSwitches and applyKnobs wrote every table: each back as this check found it)
  console.log(`=== hungcharge: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await hungchargeCheck()) ? 0 : 1);
