// LYING SNOW IN A BLOWN HOLE'S MOUTH GOES WITH THE BLAST — the check behind FURN.mouth.snow (src/game/furnblast.ts mouthMine; on in the page, ?holesnow=0;
// off in the module and on the frozen stand, TPS_HOLESNOW=1; acts only with FURN.mouth.on).
//   bun run tools/qa/probes.ts holesnow        (family `furnblast`)        HOLESNOW_BREAK=1 = the rule off and the same lines asked: must FAIL
// the maintainer, 10-15, of a wall charge on the pass (levels/pass.json, the level made for snow): "couldn't path through a hole from a wall breach". His tape: the charge
// cut 1.56 m out of the tea room's outer wall and two snow banks at its foot (tops 0.22 and 0.36 m: over the 0.2 m a body and the walk grid meet) stood in the
// gap — he slid along it, the path went 12.8 m round by the door, and the charge's own 'is it a hole' ray met the bank and said "it held".
// THE SITES: his own (the wall by the floor point 11.4, 7.7, set from the side he stood on) and up to five more places on the level (the biggest banks first) where a snow bank that stops feet
// lies at the foot of a wall the game offers a charge on, and the first of those once more with its bank DRAWN OUT TO 15 M by the check itself (the level's own
// long banks left the walls' feet on 10-15: without this nothing here is over the furniture's size bar, and no feed row could be longer than its hole). At each, a fresh stand of the level with the page's destruction switches, a charge set as the order
// sets it and blown as F blows it; then the charge's own verdict, a body as wide as the player pushed through the gap with the player's own collision call, and
// the walk grid asked for the way from one side to the other.
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
type Vec3 = [number, number, number];
export async function holeSnowCheck(): Promise<boolean> {
  const BRK = process.env.HOLESNOW_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== holesnow: lying snow in a blown hole's mouth goes with the blast${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`); const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { FURN, FURN_STATS } = await import(`${ROOT}/src/game/furnblast.ts`); const { DESTRUCTION, FURNBLAST } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { WALLCHARGE, wallAt } = await import(`${ROOT}/src/game/wallcharge.ts`); const { snowPaintOf } = await import(`${ROOT}/src/render/snowField.ts`);
  const was = { d: DESTRUCTION.on, f: FURNBLAST.on, m: FURN.mouth.on, s: FURN.mouth.snow, w: WALLCHARGE.on, o: WALLCHARGE.outer }, log = console.log;
  const data = readFileSync(`${ROOT}/levels/pass.json`, 'utf8'), R = 0.42, Y0 = 0.2, Y1 = 1.7;
  const raise = (rule: boolean) => { DESTRUCTION.on = true; FURNBLAST.on = true; FURN.mouth.on = true; FURN.mouth.snow = rule; WALLCHARGE.on = true; WALLCHARGE.outer = true; };
  /** the pass as the file has it (its banks stop feet: the step that would have made the deep tiers picture-only was withdrawn), with a site's own staging laid
   *  on the loaded level first */
  const level = (edit?: (L: any) => void) => { const L: any = loadLevel(parseLevelData(data)); edit?.(L); return L; };
  const stand = async (rule: boolean, edit?: (L: any) => void) => { raise(rule); console.log = () => { }; try { const W: any = await standUp({ level: level(edit), seed: 1 }); raise(rule); const g = W.game; g.godMode = true; g.aiEnabled = false; g.tune.chaos = 0.5; for (let i = 0; i < 4; i++) W.step(1 / 60); return W; } finally { console.log = log; } };
  const top = (b: any) => b.c[1] + b.h[1], hx = (b: any) => Math.abs(Math.sin(b.yaw ?? 0)) > 0.7 ? b.h[2] : b.h[0], hz = (b: any) => Math.abs(Math.sin(b.yaw ?? 0)) > 0.7 ? b.h[0] : b.h[2];
  /** lying snow that stops feet: a box in a snow paint on the ground, a body's and a ray's to meet, its top over the 0.2 m a body is stopped from */
  const bank = (b: any) => !(b.flags & 3) && snowPaintOf(b) !== null && b.c[1] - b.h[1] < Y0 && top(b) > Y0;
  /** the banks that stop feet within `m` of the point, by index */
  const banksBy = (g: any, p: Vec3, m: number): number[] => { const out: number[] = [], B = g.col.boxes, n = Math.min(B.length, g.destr.walls.authored); for (let i = 0; i < n; i++) { const b = B[i]; if (bank(b) && Math.abs(p[0] - b.c[0]) < hx(b) + m && Math.abs(p[2] - b.c[2]) < hz(b) + m) out.push(i); } return out; };
  interface Site { at: Vec3; from: Vec3; what: string; edit?: (L: any) => void }
  /** one site on a fresh stand: the charge set and blown, and what the gap is then */
  const blow = async (S: Site, rule: boolean) => {
    const W = await stand(rule, S.edit), g = W.game, col = g.col, w = wallAt(g, S.at, S.from); if (!w || !w.ok) return null;
    const ax = w.alongX ? 2 : 0, lx = w.alongX ? 0 : 2, plane = w.box.c[ax], near = Math.sign(S.from[ax] - plane) || 1, banks = banksBy(g, S.at, 0.9), took0 = FURN_STATS.mouth;
    const bankLen = Math.max(0, ...banks.map(i => 2 * Math.max(col.boxes[i].h[0], col.boxes[i].h[2]))), bankVol = Math.max(0, ...banks.map(i => 8 * col.boxes[i].h[0] * col.boxes[i].h[1] * col.boxes[i].h[2]));
    console.log = () => { }; let res: any; try { g.wallCharge.set.push({ wall: w, t: g.time, by: 'probe', paid: 0 }); res = g.wallCharge.blow(g.wallCharge.set[g.wallCharge.set.length - 1]); for (let i = 0; i < 60; i++) W.step(1 / 60); } finally { console.log = log; }
    // a body pushed through, at every eighth of a metre along the wall round the charge
    let through = 0; for (let k = -8; k <= 8; k++) { const p: Vec3 = [0, 0, 0]; p[lx] = S.at[lx] + k * 0.125; p[ax] = plane + near * 1.1; const a0 = p[lx]; for (let s = 0; s < 150; s++) { p[ax] -= near * 0.02; col.collideCircle(p, R, Y0, Y1, 4); } if ((plane - p[ax]) * near > 0.6 && Math.abs(p[lx] - a0) < 0.6) through++; }
    const A: Vec3 = [0, 0, 0], B: Vec3 = [0, 0, 0]; A[lx] = B[lx] = S.at[lx]; A[ax] = plane + near * 1.6; B[ax] = plane - near * 1.6;
    const path: Vec3[] | null = col.nav.findPath(A, B); let len = -1; if (path) { len = Math.hypot(path[0][0] - A[0], path[0][2] - A[2]); for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]); }
    const left = banks.filter(i => bank(col.boxes[i])).length, br = g.destr.walls.breakableAt(w.index), cut: number = typeof br?.open === 'number' ? br.open : 0;
    const slabs: number = g.destr.debris.list.filter((c: any) => snowPaintOf(c.box) !== null).length, rowLen = (() => { const rows = [...(g.destr.walls.changes ?? [])] as any[]; let m = 0; for (const r of rows) if (r?.kind === 'cover' && r.rect) m = Math.max(m, r.rect[2] - r.rect[0], r.rect[3] - r.rect[1]); return m; })();
    return { W, w, slabs, rowLen, bankLen, bankVol, wall: w.index, outer: !!w.outer, cut, hole: !!res?.hole, through, len, banks: banks.length, left, took: FURN_STATS.mouth - took0, msg: String(g.messages[g.messages.length - 1]?.text ?? '') };
  };
  try {
    const his: Site = { at: [12.0, 0, 7.45], from: [10.5, 0, 7.45], what: "his: the tea room's outer wall" };   // (his tape: the order at floor 11.4, 7.7, the bang at 11.73, 7.42 — the wall is at x 12)
    // more places: a bank that stops feet, and a wall the game offers a charge on right by it, asked from the bank's own side
    const more: Site[] = []; let drawn: Site | null = null;
    { const W = await stand(false), g = W.game, B = g.col.boxes, n = Math.min(B.length, g.destr.walls.authored), seen = new Set<string>();
      const order = [...Array(n).keys()].filter(i => bank(B[i])).sort((i, j) => B[j].h[0] * B[j].h[1] * B[j].h[2] - B[i].h[0] * B[i].h[1] * B[i].h[2]);   // (the biggest banks first)
      for (const i of order) { if (more.length >= 5) break; const b = B[i];
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const at: Vec3 = [b.c[0] + dx * (hx(b) + 0.06), 0, b.c[2] + dz * (hz(b) + 0.06)], from: Vec3 = [at[0] - dx * 1.5, 0, at[2] - dz * 1.5]; const w = wallAt(g, at, from); if (!w || !w.ok || w.alongX !== (dz !== 0)) continue;
          const key = `${w.index}:${Math.round(at[w.alongX ? 0 : 2])}`; if (seen.has(key) || (w.index === 40 && Math.abs(at[2] - his.at[2]) < 2.5)) continue; seen.add(key);
          more.push({ at, from, what: `wall ${w.index} by bank ${i} (${(8 * b.h[0] * b.h[1] * b.h[2]).toFixed(1)} m³)` });
          // the same place with that bank drawn out along its wall: 15 m of it, over the furniture's size bar (FURN.mouth.vol) and ten times the hole
          if (!drawn) { const c: Vec3 = [b.c[0], b.c[1], b.c[2]], alongX: boolean = w.alongX; drawn = { at, from, what: `wall ${w.index} by bank ${i} drawn out to 15 m`, edit: (L: any) => {
            const t = L.boxes.find((x: any) => snowPaintOf(x) !== null && Math.hypot(x.c[0] - c[0], x.c[1] - c[1], x.c[2] - c[2]) < 1e-4); if (t) t.h[(Math.abs(Math.sin(t.yaw ?? 0)) > 0.7) === alongX ? 2 : 0] = 7.5; } }; }
          break; } } }
    // the fault as it was: the rule off, his site
    { const O = await blow(his, false);
      verdict(!!O && O.banks >= 1 && O.cut >= 4 && !O.hole && O.through === 0 && O.left === O.banks && /it held/.test(O.msg), 'the staging: without the rule his charge cuts the wall and the banks at its foot stand in the gap — no body through, the charge says it held',
        O ? `wall ${O.wall}${O.outer ? ' (outer)' : ''}, ${O.cut} cells cut · banks that stop feet at the foot ${O.banks}, standing after ${O.left} · hole by the charge's own ray ${O.hole} · body through at ${O.through} of 17 places · the way across ${O.len < 0 ? 'none' : O.len.toFixed(1) + ' m'} · "${O.msg}"` : 'no charge offered at his place'); }
    const rule = !BRK, H = await blow(his, rule);
    verdict(!!H && H.banks >= 1 && H.hole && H.through >= 6 && H.left === 0 && H.len >= 0 && H.len < 5 && !/it held/.test(H.msg) && H.slabs === 0, 'with the rule: the banks go with the blast (as a spray: no rigid piece of snow), the charge reads a hole, a body walks through it and the way across is straight',
      H ? `banks at the foot ${H.banks}, standing after ${H.left} (the mouths took ${H.took}) · rigid pieces in a snow paint ${H.slabs} · hole ${H.hole} · body through at ${H.through} of 17 places · the way across ${H.len < 0 ? 'none' : H.len.toFixed(1) + ' m'} · "${H.msg}"` : 'no charge offered at his place');
    // the same wall charged from its other side: the mouths are both faces'
    { const F = await blow({ at: his.at, from: [13.5, 0, 7.45], what: 'his wall, from the far side' }, rule);
      verdict(!!F && F.hole && F.through >= 6 && F.left === 0 && F.slabs === 0, 'with the rule: the same wall charged from its other side opens the same way', F ? `hole ${F.hole} · banks standing after ${F.left} of ${F.banks} · body through at ${F.through} of 17 places · "${F.msg}"` : 'no charge offered from that side'); }
    // a checkpoint carries the banks that went; a restart stands them up, a load takes them again — and with the switch put off since (a visit under ?holesnow=0)
    if (H?.hole) { const W = H.W, g = W.game, B = g.col.boxes; console.log = () => { }; let file: any, m: number[] = [], back = false, again = false, okOn: unknown = '', okOff: unknown = '';
      try { file = JSON.parse(JSON.stringify(W.snapshot('hole', true))); m = (file.furn?.m ?? []).filter((i: number) => snowPaintOf(B[i]) !== null);
        g.restartEncounter(); back = m.length > 0 && m.every(i => bank(B[i]));
        okOn = g.destr.furn.check(file.furn); FURN.mouth.snow = false; okOff = g.destr.furn.check(file.furn); W.restore(file); W.step(1 / 60); again = m.every(i => !bank(B[i])); } finally { FURN.mouth.snow = rule; console.log = log; }
      verdict(m.length >= 2 && back && again && okOn === null && okOff === null, 'a checkpoint files the banks that went, a restart stands them up again, a load takes them again — with the switch put off since, too', `banks in the file ${m.join(', ') || 'none'} · back on a restart ${back} · the slice is taken with the switch on: ${okOn === null} · off: ${okOff === null}${typeof okOff === 'string' ? ` (${okOff})` : ''} · gone again on the load ${again}`); }
    else verdict(false, 'a checkpoint files the banks that went', 'no hole to save');
    { const rows: string[] = []; let holes = 0, walked = 0, asked = 0;
      let slabs = 0, long = 0;
      for (const S of more) { const M = await blow(S, rule); if (!M) continue; asked++; if (M.hole) holes++; if (M.hole && M.through >= 4) walked++; slabs += M.slabs; long = Math.max(long, M.rowLen); rows.push(`${S.what}: ${M.hole ? `hole, body through at ${M.through}, banks left ${M.left} of ${M.banks}` : `no hole (banks left ${M.left} of ${M.banks})`}`); }
      verdict(BRK ? walked === holes : more.length >= 4 && asked === more.length && holes === asked && walked === holes && slabs === 0 && long > 0 && long < 3, 'elsewhere on the level: every charge by a bank opens a hole a body walks through (a bank left is one by the place, not in the gap); no rigid piece of snow, and the feed\'s row is the hole\'s size, not the bank\'s length', `${more.length} more places with a bank at a wall's foot (the biggest banks first), ${asked} charged, ${holes} holes, ${walked} walked · rigid snow pieces ${slabs} · the longest 'cover' row ${long.toFixed(1)} m · ${rows.join(' | ') || 'none found'}`); }
    { const M = drawn ? await blow(drawn, rule) : null;
      verdict(!!M && M.bankLen >= 14 && M.bankVol > FURN.mouth.vol && M.hole && M.through >= 4 && M.left === 0 && M.slabs === 0 && M.rowLen > 0 && M.rowLen < 3, 'a bank 15 m long at a wall\'s foot (the check\'s own: over the furniture\'s size bar) goes with the blast too, as a spray, and the feed\'s row is the hole\'s size, not the bank\'s length',
        M ? `${drawn!.what}: the bank ${M.bankLen.toFixed(1)} m, ${M.bankVol.toFixed(1)} m³ (the bar ${FURN.mouth.vol}) · hole ${M.hole} · body through at ${M.through} of 17 places · banks left ${M.left} of ${M.banks} · rigid snow pieces ${M.slabs} · the 'cover' row ${M.rowLen.toFixed(1)} m` : 'no place with a bank at a chargeable wall\'s foot to draw out'); }
  } finally { console.log = log; DESTRUCTION.on = was.d; FURNBLAST.on = was.f; FURN.mouth.on = was.m; FURN.mouth.snow = was.s; WALLCHARGE.on = was.w; WALLCHARGE.outer = was.o; }
  console.log(`=== holesnow: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
