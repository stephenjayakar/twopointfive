// A MISSION ISSUES ITS OWN WALL CHARGES — the check behind src/game/issue.ts (`scenarios.roomClear.wallCharges`).
//   bun run tools/qa/wallissue-check.ts            (passes on the frozen stand and under TPS_PROFILE=shipped)
// What it holds:
//   1. a room clear staged on a level that carries the field (levels/mousehole.json) has that many wall charges in the bag
//   2. a restart with NOTHING spent is issued again (the count is read after the run's own reset, not before it)
//   3. a restart after some were spent is back at the level's count
//   4. a count the kit gave that is larger stands (the issue raises, never lowers)
//   5. a level without the field (levels/block-squads.json) is not touched: issueStage answers null and the count is what the kit left
//   6. the plain night with no room clear staged: issueStage answers null
//   WALLISSUE_BREAK=1 bun run tools/qa/wallissue-check.ts   = the field taken off the level before it is staged and the same lines asked: must FAIL (exit 1)
// exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

export async function wallIssueCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { issueStage } = await import(`${ROOT}/src/game/issue.ts`);
  let failed = false;
  const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(f: () => Promise<T>): Promise<T> => { const l = console.log, w = console.warn; console.log = console.warn = () => { }; try { return await f(); } finally { console.log = l; console.warn = w; } };
  const BREAK = process.env.WALLISSUE_BREAK === '1';   // the red path: the level's file without its `wallCharges`
  const levelOf = (file: string) => { const data = JSON.parse(readFileSync(resolve(ROOT, 'levels', file), 'utf8'));
    if (BREAK && data.scenarios?.roomClear) delete data.scenarios.roomClear.wallCharges;
    return loadLevel(parseLevelData(JSON.stringify(data))); };
  async function stage(file: string | null) {
    const W: any = await quiet(() => standUp(file ? { uploadEvery: 4, level: levelOf(file) } : { uploadEvery: 4 }));
    const g = W.game;
    if (file) { const why = await quiet(async () => g.roomClear.start(0)); if (why) throw new Error(`the room clear did not start on ${file}: ${why}`); }
    const step = (n = 3) => quiet(async () => { for (let i = 0; i < n; i++) W.step(1 / 60); });
    await step();
    return { W, g, step };
  }

  { const { g, step } = await stage('mousehole.json'), want = g.roomClear.structure.wallCharges as number;
    line(want === 5 && g.wallCharge.carried === want, `staged: the level asks for ${want}, the bag holds ${g.wallCharge.carried}`);
    await quiet(async () => g.restartEncounter()); await step();
    line(g.wallCharge.carried === want, `a restart with nothing spent: the bag holds ${g.wallCharge.carried}`);
    g.wallCharge.carried = want - 3; await quiet(async () => g.restartEncounter()); await step();
    line(g.wallCharge.carried === want, `a restart with three spent: the bag holds ${g.wallCharge.carried}`);
    g.wallCharge.setCarried(want + 2); const r = issueStage(g);
    line(r === want + 2 && g.wallCharge.carried === want + 2, `the kit gave ${want + 2}: the issue leaves ${g.wallCharge.carried}`); }

  { const { g } = await stage('block-squads.json'), has = g.wallCharge.carried, r = issueStage(g);
    line(g.roomClear.active && g.roomClear.structure.wallCharges === undefined && r === null && g.wallCharge.carried === has, `a level without the field: issueStage answers ${r}, the bag is the kit's own (${has === null ? 'the cost rule' : has})`); }

  { const { g } = await stage(null), has = g.wallCharge.carried, r = issueStage(g);
    line(!g.roomClear.active && r === null && g.wallCharge.carried === has, `no room clear staged: issueStage answers ${r}, the bag untouched`); }

  console.log(failed ? '=== wallissue-check: FAILURES above ===' : '=== wallissue-check: ALL PASS ===');
  return !failed;
}

if (import.meta.main) process.exit((await wallIssueCheck()) ? 0 : 1);
