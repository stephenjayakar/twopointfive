// A PANE'S CRASH IS HEARD FROM BOTH ITS FACES — the check behind glass.ts glassEvent and guards.ts glassHeard (GLASS.bothFaces). The fault (a replay of Mousehole, 3:43): the
// player shot a window out from the yard; of nine defenders the three in the room behind that window, 5 to 9 m off, heard nothing, and one man 12 m off behind a
// shut door went to look. The 'glass' event stood at the point the round met the pane — the shooter's side of a sheet that is a wall to sound — so the crash was
// routed from OUTSIDE, round by the front door: 29 to 39 m of path, past the 30 m the glass rule reaches.
//   bun run tools/qa/glass-ears-check.ts            (GLASSEARS_BREAK=1 = the switch left off and the same lines asked: must fail)
// Mousehole's room clear is staged, that window struck from outside by glass.ts glassImpact with the rule off and then on (a fresh game each), and asked:
//   the event carries a point off each face only with the rule on · who hears it by the glass rule's own weight · who is roused once the game has run on ·
//   nobody hears it worse for the rule · an event on the office's glazing rides a checkpoint with its two points.
// The check raises the switch itself, so it says the same on the frozen stand and under TPS_PROFILE=shipped. exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

type Vec3 = [number, number, number];
const BREAK = process.env.GLASSEARS_BREAK === '1';

export async function glassEarsCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { GLASS, glassImpact, isSheet } = await import(`${ROOT}/src/game/glass.ts`), { glassHeard } = await import(`${ROOT}/src/game/guards.ts`);
  const { hearPath } = await import(`${ROOT}/src/game/weather.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const DT = 1 / 60;
  let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const levelOf = (file: string) => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
  const was = GLASS.bothFaces;
  const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
  /** the glass rule's own weight of a path (guards.ts hearingCheck; heard past 0.06) */
  const weight = (p: { pathLen: number; carry: number }, level: number) => p.pathLen < GLASS.hearM ? level * clamp(1 - p.pathLen / GLASS.hearM, 0.15, 1) * p.carry : 0;

  /** one arm: Mousehole's room clear, the south corridor window struck from the yard */
  const arm = async (on: boolean) => {
    const W: any = await quiet(() => standUp({ uploadEvery: 4, level: levelOf('mousehole.json') }));
    const g = W.game; const why = await quiet(async () => g.roomClear.start(0)); if (why) throw new Error(`the room clear did not start on mousehole.json: ${why}`);
    GLASS.bothFaces = on && !BREAK;
    const AT: Vec3 = [19.6, 1.3, 19.0];   // where the tape's round met the glass
    let pane = -1, best = Infinity;
    g.level.boxes.forEach((b: any, i: number) => { if (!isSheet(b)) return; const d = Math.hypot(b.c[0] - AT[0], b.c[2] - AT[2]); if (d < best) { best = d; pane = i; } });
    const b = g.level.boxes[pane]; const thinX = b.h[0] < b.h[2]; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
    const n: Vec3 = thinX ? [cs, 0, -sn] : [sn, 0, cs]; const half = Math.min(b.h[0], b.h[2]);
    const yard: Vec3 = [19.4, 0, 20.6]; const out = (yard[0] - b.c[0]) * n[0] + (yard[2] - b.c[2]) * n[2] >= 0 ? 1 : -1;   // the face the yard is on
    const along: Vec3 = [-n[2], 0, n[0]]; const u = clamp((AT[0] - b.c[0]) * along[0] + (AT[2] - b.c[2]) * along[2], -Math.max(b.h[0], b.h[2]) + 0.1, Math.max(b.h[0], b.h[2]) - 0.1);
    const point: Vec3 = [b.c[0] + along[0] * u + n[0] * out * half, AT[1], b.c[2] + along[2] * u + n[2] * out * half];
    g.teleportPlayer([point[0] + n[0] * out * 1.6, 0, point[2] + n[2] * out * 1.6]); g.playerInvisible = true;
    const men = g.guards.filter((gd: any) => gd.unit && gd.team === 'hostile' && gd.state !== 'dead');
    const near = men.filter((gd: any) => Math.hypot(gd.char.pos[0] - point[0], gd.char.pos[2] - point[2]) < 10);
    const before = g.events.length;
    glassImpact(g, pane, point, [-n[0] * out, 0, -n[2] * out], 1, PLAYER_ID, 'shot');
    const e = g.events[g.events.length - 1]; const filed = g.events.length > before && e?.kind === 'glass';
    const side = (q: Vec3) => (q[0] - b.c[0]) * n[0] + (q[2] - b.c[2]) * n[2];
    const ear = (gd: any): Vec3 => [gd.char.pos[0], gd.char.pos[1] + 1.5, gd.char.pos[2]];
    const plain = (gd: any) => weight(hearPath(g, [e.pos[0], e.pos[1] + 1, e.pos[2]], ear(gd)), e.level);
    const ruled = (gd: any) => weight(glassHeard(g, e, ear(gd)), e.level);
    const wPlain = new Map<any, number>(men.map((gd: any) => [gd, plain(gd)])), wRuled = new Map<any, number>(men.map((gd: any) => [gd, ruled(gd)]));
    for (let i = 0; i < 45; i++) W.step(DT);
    const roused = (set: any[]) => set.filter((gd: any) => gd.awareness >= 0.4).length;
    return { g, e, filed, half, side, men, near, wPlain, wRuled, heard: (set: any[], m: Map<any, number>) => set.filter(gd => (m.get(gd) ?? 0) > 0.06).length, rousedNear: roused(near), rousedAll: roused(men), dist: best };
  };

  try {
    const off = await arm(false), on = await arm(true);
    line(off.filed && on.filed && off.dist < 1.5 && off.near.length >= 2 && on.near.length === off.near.length,
      `Mousehole staged twice, the south corridor window found (${off.dist.toFixed(2)} m from the tape's point) and struck from the yard: a 'glass' event each time; ${off.men.length} defenders up, ${off.near.length} of them within 10 m of the pane`);
    { const ears = on.e.ears as [Vec3, Vec3] | undefined; const r = on.half + GLASS.earOff;
      line(!off.e.ears && !!ears && on.side(ears[0]) * on.side(ears[1]) < 0 && Math.abs(Math.abs(on.side(ears[0])) - r) < 1e-6 && Math.abs(Math.abs(on.side(ears[1])) - r) < 1e-6,
        `rule off: the event carries its point alone; on: a point ${GLASS.earOff} m off EACH face of the pane (${ears ? ears.map(q => `${on.side(q) > 0 ? '+' : ''}${on.side(q).toFixed(2)}`).join(' / ') : 'none'} m off its mid-plane)`); }
    line(off.heard(off.near, off.wRuled) === 0 && on.heard(on.near, on.wRuled) === on.near.length,
      `the men within 10 m who hear it by the glass rule's own weight (> 0.06): ${off.heard(off.near, off.wRuled)} of ${off.near.length} with the rule off (the fault), ${on.heard(on.near, on.wRuled)} of ${on.near.length} on; of all ${on.men.length}: ${off.heard(off.men, off.wRuled)} off, ${on.heard(on.men, on.wRuled)} on`);
    line(off.rousedNear === 0 && on.rousedNear === on.near.length,
      `0.75 s of the game later, awareness ≥ 0.4 among those ${on.near.length}: ${off.rousedNear} off, ${on.rousedNear} on (all nine: ${off.rousedAll} off, ${on.rousedAll} on)`);
    { let worse = 0, better = 0; for (const gd of on.men) { const a = on.wPlain.get(gd) ?? 0, r = on.wRuled.get(gd) ?? 0; if (r < a - 1e-9) worse++; if (r > a + 1e-9) better++; }
      line(worse === 0 && better >= on.near.length, `with the rule on nobody hears the pane worse than from the event's own point: ${worse} worse, ${better} better of ${on.men.length}`); }
    { const same = [...off.men].every((gd: any) => Math.abs((off.wPlain.get(gd) ?? 0) - (off.wRuled.get(gd) ?? 0)) < 1e-12);
      line(same, `rule off: glassHeard is hearPath of the event's point for every man (the build as it was)`); }

    // an event rides a checkpoint with its two points (the office alone: a checkpoint is refused with a squad on the floor)
    { const W: any = await quiet(() => standUp({ uploadEvery: 4 })); const g = W.game; GLASS.bothFaces = !BREAK;
      const pane = g.level.boxes.findIndex((b: any) => isSheet(b)); const b = g.level.boxes[pane];
      for (let i = 0; i < 5; i++) W.step(DT);
      glassImpact(g, pane, [b.c[0], b.c[1], b.c[2]], null, 1, PLAYER_ID, 'shot');
      const e = g.events[g.events.length - 1]; const snap = W.snapshot('glass ears', true); const kept = (snap.events ?? []).filter((x: any) => x.kind === 'glass').pop();   // (the last: with glass breaking live the blow's falling pieces file events of their own)
      await quiet(() => W.restore(snap)); const back = g.events.filter((x: any) => x.kind === 'glass').pop();
      const eq = (a: any, c: any) => !!a && !!c && [0, 1].every(k => [0, 1, 2].every(j => Math.abs(a[k][j] - c[k][j]) < 1e-9));
      line(!!e?.ears && eq(kept?.ears, e.ears) && eq(back?.ears, e.ears), `the office: a 'glass' event saved and loaded keeps its two points (${kept?.ears ? 'in the file' : 'NOT in the file'}, ${back?.ears ? 'back on the floor' : 'NOT back'})`);
      GLASS.bothFaces = false; glassImpact(g, pane, [b.c[0], b.c[1] + 0.3, b.c[2]], null, 1, PLAYER_ID, 'shot');
      const e2 = g.events[g.events.length - 1]; const snap2 = W.snapshot('glass plain', true); const k2 = (snap2.events ?? []).filter((x: any) => x.kind === 'glass').pop();
      line(!e2.ears && !!k2 && !('ears' in k2), `rule off: neither the event nor its row in a checkpoint has the field`); }
  } catch (err) { line(false, `threw: ${(err as Error)?.stack ?? err}`); }
  finally { GLASS.bothFaces = was; }
  console.log(failed ? '=== glass-ears-check: FAIL ===' : '=== glass-ears-check: ALL PASS ===');
  return !failed;
}
if (import.meta.main) process.exit((await glassEarsCheck()) ? 0 : 1);
