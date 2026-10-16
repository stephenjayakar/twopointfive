// EVERY MISSION STARTS THE SAME WAY ON EVERY TRY — the check behind `SAMESTART.on` (src/game/samestart.ts).
// The fault it holds shut: a row of the mission list opened on other marks each visit (a room clear's placement read off the visit's die, the next one on a
// restart; a rescue's roamers and clock drawn at each staging; a quiet mission's start, spot and patrol drawn on every load and every restart), so a level was
// never the same puzzle twice.
//   bun run tools/qa/samestart-check.ts [id …] [--verbose]   ·   bun run tools/qa/probes.ts samestart (family missions)
// Every mission of the list (scene/scenarioList.ts ALL_MISSIONS) and the solo night, each started the page's way (game/scenarioRun.ts startFromQuery on the row's
// own query) on a Game with a die of its own, the room clear's fresh-visit rule on as the page has it. What it holds:
//   1. on: two Games on two different dice stand the same people on the same spots — Sam, every teammate, every defender, every civilian and hostage — with the
//      same quiet deal and the same captor's clock
//   2. on: a restart of either stands them there again
//   3. off (the way back, `?samestart=0`): over the list, room clears and quiet missions DO open differently on other dice or after a restart — the switch is what
//      holds them, not the levels
//   4. on, what a start names is still its own: `roomclear=3` deals seed 3's placement, `quiet=5` pin 5's deal, `way=2` the second way in; `way=any` (a dealt
//      way) is the level's own
//   5. the page's boot: on for an empty query, off under ?samestart=0; FROZEN_HOLDS carries the row
//   SAMESTART_BREAK=1  the switch is left off where the lines above want it on: the check must FAIL (exit 1) — the proof that it can
// exit 0 = all hold · 1 = one does not · 2 = bad flags
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

export async function sameStartCheck(only: string[] = [], verbose = false): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { SAMESTART } = await import(`${ROOT}/src/game/samestart.ts`);
  const { ROOMCLEAR, placeDefenders } = await import(`${ROOT}/src/game/roomclear.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
  const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`), { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
  const P = await import(`${ROOT}/src/host/profile.ts`);
  const brk = process.env.SAMESTART_BREAK === '1', knobs0 = knobsCopy();

  let failed = false, checks = 0;
  const line = (ok: boolean, s: string) => { checks++; if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(f: () => Promise<T> | T): Promise<T> => { const l = console.log, w = console.warn, e = console.error; console.log = console.warn = console.error = () => { }; try { return await f(); } finally { console.log = l; console.warn = w; console.error = e; } };
  const levelOf = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
  interface Row { id: string; kind: string; level?: string; query: string }
  const rows: Row[] = [{ id: 'solo', kind: 'solo', query: 'solo' }, ...(ALL_MISSIONS as { id: string; kind: string; level?: string }[]).map(e => ({ id: e.id, kind: e.kind, level: e.level, query: scenarioQuery(e) as string }))]
    .filter(r => !only.length || only.includes(r.id));
  if (!rows.length) { console.log(`no mission of that name (${only.join(', ')})`); return false; }

  /** who stands where: everybody on the floor to the nearest 5 cm, the quiet deal, the captor's clock */
  const sig = (g: any): string => {
    const r = (v: number) => (Math.round(v * 20) / 20).toFixed(2), at = (p: number[]) => `${r(p[0])},${r(p[2])}`;
    const men = [...g.guards, ...(g.civilians ?? [])].map((gd: any) => `${gd.team}:${gd.callsign}@${at(gd.char.pos)}${gd.state === 'dead' ? ':down' : ''}`).sort();
    const out = [`sam@${at(g.player.char.pos)}`, ...men];
    if (g.quiet?.active) out.push(`quiet ${g.quiet.deal.start}/${g.quiet.deal.spot}/${g.quiet.deal.patrol}`);
    if (g.rescue?.active) out.push(`clock ${g.rescue.resolveSecs.toFixed(3)}`);
    if (g.roomClear?.active) out.push(`placement ${g.roomClear.seed}/${g.roomClear.attempt} way ${g.roomClear.way}`);
    return out.join(' | ');
  };
  /** a Game on the row's level with its own die, the mission started the page's way; `extra` = more of the query (`way=2`) */
  async function stage(R: Row, dice: number, same: boolean, extra = '') {
    const W: any = await quiet(() => standUp({ uploadEvery: 4, ...(R.level ? { level: levelOf(R.level) } : {}), seed: dice }));
    SAMESTART.on = same && !brk; ROOMCLEAR.fresh = true; ROOMCLEAR.seed = 0; ROOMCLEAR.reroll = true;   // (after the stand-up: the frozen stand writes the switch off as it stands a Game)
    { const w = new URLSearchParams(extra).get('way'); ROOMCLEAR.way = w === 'any' ? -1 : w !== null && /^\d+$/.test(w) ? +w : 0; }   // (the page's own reading of ?way=, host/profile.ts)
    const g = W.game, q = new URLSearchParams(R.query + (extra ? `&${extra}` : ''));
    const { why } = await quiet(() => startFromQuery(g, q)) as { why: string | null }; if (why) throw new Error(`${R.id} did not start: ${why}`);
    return { W, g, sig: sig(g) };
  }
  const again = async (g: any) => { await quiet(() => g.restartEncounter()); return sig(g); };
  const diff = (a: string, b: string) => { const A = a.split(' | '), B = new Set(b.split(' | ')); return A.filter(x => !B.has(x)).slice(0, 3).join(' · '); };

  try {
    // ---- 1 + 2: on — the same floor on two dice, and after a restart of each
    const moved: string[] = [], restartMoved: string[] = [], offMoved: Record<string, string[]> = {}, offSame: string[] = [];
    for (const R of rows) {
      const A = await stage(R, 7, true), B = await stage(R, 8, true);
      if (A.sig !== B.sig) moved.push(`${R.id} (${diff(A.sig, B.sig)})`);
      const A2 = await again(A.g), A3 = await again(A.g), B2 = await again(B.g);
      if (A2 !== A.sig || A3 !== A.sig || B2 !== A.sig) restartMoved.push(`${R.id} (${diff(A.sig, A2 !== A.sig ? A2 : A3 !== A.sig ? A3 : B2)})`);
      // ---- 3: off — does this row open differently on another die, or after a restart?
      const C = await stage(R, 7, false), D = await stage(R, 8, false), E = await stage(R, 9, false), C2 = await again(C.g);
      if (C.sig !== D.sig || C.sig !== E.sig || C.sig !== C2) (offMoved[R.kind] ??= []).push(R.id); else offSame.push(R.id);
      if (verbose) console.log(`  ${R.id}: on ${A.sig === B.sig ? 'same' : 'MOVED'} · restart ${A2 === A.sig && A3 === A.sig ? 'same' : 'MOVED'} · off ${C.sig !== D.sig || C.sig !== E.sig ? 'other dice differ' : C.sig !== C2 ? 'a restart differs' : 'the same anyway'}`);
    }
    line(!moved.length, `on: ${rows.length} missions each stand the same people on the same spots on two different dice${moved.length ? ` — NOT: ${moved.join('; ')}` : ''}`);
    line(!restartMoved.length, `on: a restart (two of one Game, one of the other) stands them there again${restartMoved.length ? ` — NOT: ${restartMoved.join('; ')}` : ''}`);
    if (!only.length) {
      const n = (k: string) => offMoved[k]?.length ?? 0;
      line(n('roomclear') > 0 && n('quiet') > 0 && n('rescue') > 0, `off (?samestart=0): the old deals are back — ${Object.entries(offMoved).map(([k, v]) => `${v.length} ${k}`).join(', ') || 'none'} open differently on another die or after a restart (the same anyway: ${offSame.join(', ') || 'none'})`);
    } else console.log(`  (off: ${Object.values(offMoved).flat().join(', ') || 'none'} open differently; the list-wide line needs the whole list)`);

    // ---- 4: what a start names is its own
    if (!only.length) {
      const rc = rows.find(r => r.id === 'compound-four') ?? rows.find(r => r.kind === 'roomclear' && r.level)!, qt = rows.find(r => r.kind === 'quiet' && !/squad=1/.test(r.query))!;
      { const N = await stage({ ...rc, query: rc.query.replace(/(^|[?&])roomclear(=[^&]*)?/, '$1roomclear=3') }, 7, true), S = N.g.roomClear.structure;
        const marks = (pl: { room: string; mark: number }[]) => pl.map(p => `${p.room}:${p.mark}`).join(' ');
        line(N.g.roomClear.seed === 3 && marks(N.g.roomClear.placement) === marks(placeDefenders(3, 1, S)), `on: ${rc.id} started with roomclear=3 deals seed 3's placement`);
        const s0 = N.sig, s1 = await again(N.g);
        line(s1 === s0, 'on: … and a restart keeps seed 3\'s first placement (no next attempt)'); }
      { const base = await stage(rc, 7, true), n = 1 + (base.g.roomClear.structure.starts?.length ?? 0);
        if (n > 1) {
          const W2 = await stage(rc, 7, true, 'way=2'), Any7 = await stage(rc, 7, true, 'way=any'), Any8 = await stage(rc, 8, true, 'way=any'), Any9 = await stage(rc, 9, true, 'way=any');
          line(W2.g.roomClear.way === 1 && W2.sig !== base.sig, `on: ${rc.id} with way=2 stands the team on the second way in`);
          line([Any7, Any8, Any9].every(x => x.g.roomClear.way === 0 && x.sig === base.sig), 'on: way=any (a dealt way) is the level\'s own way in on every die');
        } else console.log(`  (${rc.id} has one way in: the way lines are skipped)`); }
      { const pinQ = qt.query.replace(/(^|[?&])quiet(=[^&]*)?/, '$1quiet=5'), P7 = await stage({ ...qt, query: pinQ }, 7, true), P8 = await stage({ ...qt, query: pinQ }, 8, true), off = await stage({ ...qt, query: pinQ }, 7, false);
        line(P7.sig === P8.sig && P7.sig === off.sig, `on: ${qt.id} with quiet=5 is pin 5's deal (${P7.g.quiet.deal.start}/${P7.g.quiet.deal.spot}/${P7.g.quiet.deal.patrol}) on any die, the same as with the switch off`);
        const U = await stage(qt, 7, true), d = U.g.quiet.deal;
        line(d.start === 0 && d.spot === 0 && d.patrol <= 0, `on: ${qt.id} with no pin is the first start, spot and patrol of its lists (${d.start}/${d.spot}/${d.patrol})`); }
      // a restart is a fresh try of the RUN too, not only of the marks: the captor's clock, once started, is not running when the floor is staged again
      { const rs = rows.find(r => r.kind === 'rescue');
        if (rs) { const R = await stage(rs, 7, true), g = R.g, p = g.player.char.pos, secs = g.rescue.resolveSecs;
          await quiet(async () => { g.teleportPlayer([p[0] + 1.2, 0, p[2]]); for (let i = 0; i < 20; i++) R.W.step(1 / 60); }); const ran = g.rescue.dynamic;
          await quiet(() => g.restartEncounter()); const fresh = !g.rescue.dynamic && g.rescue.resolve === 0;
          await quiet(async () => { for (let i = 0; i < 30; i++) R.W.step(1 / 60); });
          line(ran && fresh && !g.rescue.dynamic && g.rescue.resolveSecs === secs, `on: ${rs.id}'s clock, started by a step (${ran}), is stopped and at 0 after a restart and stays so until he moves again; its length is the same ${secs} s`); } }
    }

    // ---- 5: the page's boot
    { P.pageSwitches(new URLSearchParams('')); const on = SAMESTART.on; P.pageSwitches(new URLSearchParams('samestart=0')); const off = SAMESTART.on;
      line(on === true && off === false, `the page's boot: on for an empty query (${on}), off under ?samestart=0 (${off})`);
      line('SAMESTART.on' in P.FROZEN_HOLDS, 'FROZEN_HOLDS carries the row SAMESTART.on (the frozen stand holds it off)'); }
  } catch (e) { failed = true; console.log(`- FAIL — threw: ${e instanceof Error ? e.stack ?? e.message : String(e)}`); }
  finally { knobsBack(knobs0); }   // (pageSwitches wrote the page's whole boot: every table back as this check found it)
  const ok = !failed && checks > 0;
  console.log(ok ? '=== samestart-check: ALL PASS ===' : '=== samestart-check: FAILED ===');
  return ok;
}

if (import.meta.main) {
  const args = process.argv.slice(2), bad = args.filter(a => a.startsWith('--') && a !== '--verbose');
  if (bad.length) { console.error(`unknown flag ${bad.join(' ')} (valid: --verbose)`); process.exit(2); }
  const ok = await sameStartCheck(args.filter(a => !a.startsWith('--')), args.includes('--verbose'));
  process.exit(ok ? 0 : 1);
}
