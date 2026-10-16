// EVERY RUN ENDS ON A VERDICT — the check behind src/game/verdict.ts (`VERDICT.on`), ui/verdictCard.ts + verdictPips.ts (the end card) and
// ui/verdictStore.ts (what this machine keeps).
//   bun run tools/qa/verdict-check.ts
// What it holds (the game stood up by the harness):
//   1. a try: staged and standing on the mark nothing has started; a stride starts it; a restart before that starts nothing
//   2. a room clear's ends: every defender down = won, said once, the men's rows and the defenders counted; a teammate lost is in his row; a player down = lost;
//      a cheat during the try voids it; the card is due a beat after a win (the page's poll), and the stealth mission's own card is left to raise a loss
//   3. the way a win was won, read off the run: nobody ever found = quiet · the mains cut before the team was found = dark · a man through a hole a blast
//      opened = walls · else doors
//   4. every mission kind gives a verdict: the night breach alone, the hostage rescue, the stealth night (and a run loaded from a checkpoint is the same try)
//   5. off = the same game: two games on one die, the same keys, VERDICT.on true and false, digest for digest
//   6. the card: on a fake document the squad's card leads with the word, the clock, four pips and one tick a try, a row a man, where a man fell on the
//      map — and the stealth game's card keeps what the debrief probe holds
//   7. the kept record: a try is counted at its start, a win keeps its way (fewest tries, nobody lost), two ways = gold, a loss changes nothing
//   8. a mission's card on the start page (ui/verdictRows.ts): four pips a card, the ways won lit, none on a training lesson, made again only on a change
//   VERDICT_BREAK=1  the switch is left off where the lines above want it on: the check must FAIL (exit 1)
// exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const FILE = 'killhouse.json';

export async function verdictCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { VERDICT, verdictLine } = await import(`${ROOT}/src/game/verdict.ts`);
  const { PAR_START_M } = await import(`${ROOT}/src/game/par.ts`);
  const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
  const { hostileTo } = await import(`${ROOT}/src/game/teams.ts`);
  const { saveState, loadState } = await import(`${ROOT}/src/game/savestate.ts`);
  const store = await import(`${ROOT}/src/ui/verdictStore.ts`);
  const brk = process.env.VERDICT_BREAK === '1', knobs0 = knobsCopy();

  let failed = false, checks = 0;
  const line = (ok: boolean, s: string) => { checks++; if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(f: () => Promise<T> | T): Promise<T> => { const l = console.log, w = console.warn; console.log = console.warn = () => { }; try { return await f(); } finally { console.log = l; console.warn = w; } };
  const text = readFileSync(resolve(ROOT, 'levels', FILE), 'utf8');
  /** a Game with a mission staged: 'clear' = the kill house's room clear (four), 'breach' / 'rescue' = the office's, 'night' = the plain stealth night */
  async function stage(what: 'clear' | 'breach' | 'rescue' | 'night' = 'clear', on = true, squad: 2 | 4 = 4, dice: number | null = 5) {
    VERDICT.on = on && !brk; ROOMCLEAR.seed = 0; ROOMCLEAR.way = 0;
    const W: any = await quiet(() => standUp({ uploadEvery: 4, level: what === 'clear' ? loadLevel(parseLevelData(text)) : undefined, seed: dice }));
    const g = W.game; g.nightBreach.knobs.squad = what === 'clear' ? squad : 2;
    const why = await quiet(() => what === 'clear' ? g.roomClear.start(0) : what === 'breach' ? g.nightBreach.start() : what === 'rescue' ? g.rescue.start() : null);
    if (why) throw new Error(`${what} did not start: ${why}`);
    const step = (n = 1) => quiet(() => { for (let i = 0; i < n; i++) W.step(1 / 60); });
    await step(3);
    const foes = () => g.guards.filter((x: any) => x.team !== 'operative' && hostileTo(x, 'player') && x.state !== 'dead');
    const drop = (list: any[], by: 'player' | 'guard' = 'player') => quiet(() => { for (const h of list) killGuard(g, h, [1, 0, 0], false, 'shot', by); });
    const nudge = (m = PAR_START_M + 0.5) => quiet(() => { const p = g.player.char.pos; g.teleportPlayer([p[0] + m, 0, p[2]]); });
    const found = async () => { const h = foes()[0]; for (let i = 0; i < 3; i++) { h.state = 'alert'; await step(1); } };
    return { W, g, V: g.verdict, step, foes, drop, nudge, found };
  }
  const way = async (set: (S: Awaited<ReturnType<typeof stage>>) => Promise<void>) => { const S = await stage(); await S.nudge(); await S.step(5); await set(S); await S.drop(S.foes()); await S.step(4); return S.V.result?.approach ?? null; };

  try {
    // 1. a try
    { const A = await stage(); await A.step(90);
      line(A.V.live && !A.V.started && A.V.result === null, 'staged: a second and a half on the mark, nothing ordered — no try has started');
      await quiet(() => A.g.restartEncounter()); await A.step(5);
      line(!A.V.started, 'a restart before anything was done starts nothing');
      await A.nudge(PAR_START_M * 0.6); await A.step(2); const shuffled = A.V.started;
      await A.nudge(PAR_START_M * 0.8); await A.step(60);
      line(!shuffled && A.V.started && Math.abs(A.V.secs - 1) < 0.1, `a stride past ${PAR_START_M} m starts the try (${A.V.secs.toFixed(2)} s after a second)`);

      // 2. the end
      const ops = A.g.nightBreach.ops; await A.drop([ops[1]], 'guard'); await A.step(30);
      const n = A.foes().length; await A.drop(A.foes()); await A.step(4);
      const R = A.V.result;
      line(!!R && R.won && R.word === 'CLEAR' && R.kind === 'roomclear' && !R.void, `every defender down: ${R ? verdictLine(R) : 'no verdict'}`);
      line(!!R && R.men.length === ops.length + 1 && R.men[0].human && R.men[0].name === 'Player' && R.of === R.men.length && R.lost === 1 && !R.clean, `a row a man (${R?.men.map((m: any) => m.name).join(', ')}), one lost`);
      const lost = R?.men.find((m: any) => m.state !== 'up');
      line(!!lost && lost.name === ops[1].callsign && lost.downAt > 0 && lost.downAt <= R.secs && !!lost.downPos && !!lost.downRoom, `the lost man's row says when and where: ${lost?.name} · ${lost?.downAt.toFixed(1)} s · ${lost?.downRoom}`);
      line(!!R && R.foes.of === n && R.foes.down === n && R.foes.fell.length === 2 * n && R.men[0].drops.length === n, `${n} defenders, all down, each with a place; the drops are on the row of the man whose they were`);
      line(!!R && R.men.every((m: any) => m.path.length >= 3 && m.path.length % 3 === 0), 'every man has a path');
      line(!!R && R.men.slice(1).every((m: any) => m.tone === 'red' || m.tone === 'blue'), 'four in two pairs: each teammate carries his pair\'s colour');
      const due0 = A.V.takeDue(); await A.step(Math.ceil(VERDICT.winSecs * 60) + 2); const due1 = A.V.takeDue(), due2 = A.V.takeDue();
      line(!due0 && due1 && !due2 && !A.g.mission.debrief, `the card is due ${VERDICT.winSecs} s after the win, once`);
      await A.step(120);
      line(A.V.result === R, 'the verdict is made once and stands');
      await quiet(() => A.g.restartEncounter()); await A.step(5);
      line(A.V.result === null && !A.V.started, 'a restart: no verdict, no try');

      const B = await stage(); await B.nudge(); await B.step(20); await quiet(() => { B.g.player.down = true; }); await B.step(4);
      const L = B.V.result;
      line(!!L && !L.won && L.word === 'DOWN' && L.approach === null && L.men[0].state === 'dead', `the player down: ${L ? verdictLine(L) : 'no verdict'}`);
      let raised = false; for (let i = 0; i < 240 && !raised; i++) { await B.step(1); raised = !!B.g.mission.debrief; }
      line(raised && !B.V.takeDue(), 'that card is the mission\'s own to raise (it does, and the verdict asks for no second one)');

      const C = await stage(); await C.nudge(); await C.step(5); C.g.godMode = true; await C.step(2); C.g.godMode = false; await C.drop(C.foes()); await C.step(4);
      line(!!C.V.result && C.V.result.won && C.V.result.void, 'a cheat on at any frame of the try: the verdict is void');
      const D = await stage(); D.g.godMode = true; await D.step(30); D.g.godMode = false; await D.step(2); await D.nudge(); await D.step(5); await D.drop(D.foes()); await D.step(4);
      line(!!D.V.result && !D.V.result.void, 'a cheat on only before the try started does not void it'); }

    // 3. the way it was won
    { const q = await way(async () => { });
      const d = await way(async S => { await S.found(); });
      const k = await way(async S => { await quiet(() => S.g.setBlackout(86400, 'hand')); await S.step(2); await S.found(); });
      const late = await way(async S => { await S.found(); await quiet(() => S.g.setBlackout(86400, 'hand')); await S.step(2); });
      const hole = (S: any, at: number[]) => quiet(() => S.g.destr.walls.note({ kind: 'hole', cause: 'blast', id: -1, pos: [at[0], 0, at[2]], rect: [at[0] - 0.5, at[2] - 0.5, at[0] + 0.5, at[2] + 0.5], opened: 4, walkable: true, sight: true, dead: false, who: 'check' } as any));
      const w = await way(async S => { await S.found(); await hole(S, S.g.player.char.pos); await S.step(3); });
      const far = await way(async S => { await S.found(); const p = S.g.player.char.pos; await hole(S, [p[0] + 30, 0, p[2] + 30]); await S.step(3); });
      line(q === 'quiet' && d === 'doors' && k === 'dark' && late === 'doors' && w === 'walls' && far === 'doors',
        `nobody found = ${q} · found = ${d} · the mains cut first = ${k} · cut only after = ${late} · through a blown hole = ${w} · a hole nobody used = ${far}`); }

    // 4. every kind
    { const N = await stage('breach'); await N.nudge(); await N.step(5); await N.found(); await N.drop(N.foes()); await N.step(4);
      line(!!N.V.result && N.V.result.won && N.V.result.kind === 'nightbreach' && N.V.result.men.length === 3 && N.V.result.men[1].tone === null, `the night breach: ${N.V.result ? verdictLine(N.V.result) : 'no verdict'} (one pair: no pair colours)`);
      const H = await stage('rescue'); await H.nudge(); await H.step(5); await H.found(); await H.drop([H.g.rescue.hostages[0]], 'guard');
      for (let i = 0; i < 600 && !H.V.result; i++) await H.step(1);
      const R = H.V.result, G = H.g.rescue.result;
      line(!!R && !!G && R.kind === 'rescue' && R.won === (G.state === 'rescued') && !!R.hostages && R.hostages.of === H.g.rescue.hostages.length && R.hostages.alive === G.hostages && R.hostages.alive < R.hostages.of && R.word === 'LOST' && !!R.why, `the rescue (${G?.state}): ${R ? verdictLine(R) : 'no verdict'}`);
      const S = await stage('night'); await S.nudge(); await S.step(30); const snap = await quiet(() => saveState(S.g, { label: 'x', kind: 'manual', force: true })); await S.step(30);
      await quiet(() => loadState(S.g, snap)); await S.step(3);
      line(S.V.resumed && S.V.started, 'a run loaded from a checkpoint is already started, its clock the mission\'s (the page counts the load as another try)');
      S.g.mission.stage = 'done'; await S.step(2);
      line(!!S.V.result && S.V.result.won && S.V.result.word === 'OUT' && S.V.result.kind === null && S.V.result.approach === 'quiet' && !S.V.takeDue(), `the stealth night, out unseen: ${S.V.result ? verdictLine(S.V.result) : 'no verdict'}`);
      // an alarm nobody was seen hunting for (a camera, a frightened civilian) found the run all the same: not a quiet win
      const A = await stage('night'); await A.nudge(); await A.step(20); A.g.mission.stats.alerts = 1; A.g.mission.stage = 'done'; await A.step(2);
      line(!!A.V.result && A.V.result.won && A.V.result.approach !== 'quiet' && !A.V.resumed, `the stealth night, out after an alarm: not quiet (${A.V.result?.approach})`); }

    // 5. off = the same game
    { const play = async (on: boolean) => { const S = await stage('clear', on); const hs: string[] = [];
        await S.step(20); await quiet(() => S.g.orders.give('fallIn', S.g.orders.targetAt(S.g.player.char.pos), 'all'));
        S.W.input.keys.add('KeyD');
        for (let i = 0; i < 20; i++) { await S.step(30); hs.push(hashDigest(digestGame(S.g, true))); }
        S.W.input.keys.clear(); await S.drop(S.foes()); await S.step(30); hs.push(hashDigest(digestGame(S.g, true)));
        return { hs, res: S.V.result, started: S.V.started as boolean }; };
      const on = await play(true), off = await play(false), at = on.hs.findIndex((h, i) => h !== off.hs[i]);
      line(at < 0 && on.hs.length === 21, `on and off digest the same over ten seconds and the end (${on.hs.length} digests${at < 0 ? '' : `; first differs at ${at}`})`);
      line(!!on.res && off.res === null && !off.started, 'with it off no try starts and no verdict is made');
      VERDICT.on = !brk; }

    // 6. the card
    { const { withDom, El } = await import('./scenario-picker-probes.ts'), { renderDebrief } = await import(`${ROOT}/src/ui/debrief.ts`), { verdictPanels } = await import(`${ROOT}/src/ui/verdictCard.ts`);
      const A = await stage(); await A.nudge(); await A.step(20); await A.found(); await A.drop([A.g.nightBreach.ops[0]], 'guard'); await A.step(20); await A.drop(A.foes()); await A.step(4);
      const R = A.V.result; A.V.kept = { streak: 3, fresh: true, gold: true, ways: { doors: { first: false, clean: false }, quiet: { first: true, clean: true } } };
      await withDom('', async () => { const host = new El('DIV'); const ui = renderDebrief(host as any, A.g); const root: any = host.children[0], has = (c: string) => root.all((e: any) => e.cls.has(c));
        line(root.cls.has('db') && root.cls.has('vd-squad') && root.children[0].cls.has('vd') && has('vd-word')[0]?.textContent === 'CLEAR' && /^\d:\d\d$/.test(has('vd-time')[0]?.textContent ?? ''), `the squad's card leads with the word and the clock: ${has('vd-word')[0]?.textContent} ${has('vd-time')[0]?.textContent}`);
        const pips = has('vpip');
        line(pips.length === 4 && pips.filter((p: any) => p.cls.has('won')).length === 2 && pips.filter((p: any) => p.cls.has('now')).length === 1 && pips.find((p: any) => p.cls.has('now')).cls.has('w-doors') && has('vpips')[0].cls.has('gold'), 'four pips: two won, the one this run was won by marked, two won = the gold frame');
        line(has('try').length === 3 && has('try').filter((t: any) => t.cls.has('win')).length === 1, 'one tick a try, the last one the win');
        const rows = has('vd-man');
        line(rows.length === R.men.length + 1 && rows.filter((r: any) => r.cls.has('vd-count')).length === 1 && has('fell').length === 1 && has('vfell').length === 1 && has('drop').length === R.men[0].drops.length, `a row a man and one for the defenders (${rows.length}); the lost man has his cross on his row and on the map`);
        line(ui.copyText === verdictLine(R, A.V.kept) && has('mark').filter((e: any) => e.tagName === 'I').length === 3 && has('st').length >= 14, `the copy line is the verdict's: '${ui.copyText}'`);
        verdictPanels.push((slot: any) => { const d = new El('DIV'); d.className = 'recap'; slot.appendChild(d); }); verdictPanels.push(() => { throw new Error('x'); });
        const host2 = new El('DIV'); renderDebrief(host2 as any, A.g); const r2: any = host2.children[0];
        line(r2.all((e: any) => e.cls.has('vd-slot')).length === 1 && r2.all((e: any) => e.cls.has('recap')).length === 1, 'another panel can draw in the card\'s slot; one that throws is left out');
        verdictPanels.length = 0;
        A.V.kept = null; const host3 = new El('DIV'); renderDebrief(host3 as any, A.g); const r3: any = host3.children[0];
        line(r3.all((e: any) => e.cls.has('try')).length === 0 && r3.all((e: any) => e.cls.has('vpip')).length === 4 && r3.all((e: any) => e.cls.has('vd-slot')).length === 0, 'nothing kept (a cheat, no storage): no ticks, the pips dim, no empty slot'); });
      const S = await stage('night'); await S.nudge(); await S.step(10); S.g.mission.stage = 'done'; await S.step(2);
      await withDom('', async () => { const host = new El('DIV'); const ui = renderDebrief(host as any, S.g); const root: any = host.children[0], has = (c: string) => root.all((e: any) => e.cls.has(c));
        line(root.cls.has('vd-solo') && has('vd-word')[0]?.textContent === 'OUT' && has('db-rating').length === 1 && has('vd-man').length === 0 && ui.copyText === ui.debrief.summary, 'the stealth game\'s card: the verdict\'s head over its own rating, numbers and timeline; no men\'s rows alone'); });
      const O = await stage('clear', false); await O.nudge(); await O.step(5); await O.drop(O.foes()); await O.step(4);
      await withDom('', async () => { const host = new El('DIV'); renderDebrief(host as any, O.g); const root: any = host.children[0];
        line(root.className === 'db' && root.all((e: any) => e.cls.has('vd') || e.cls.has('vd-man') || e.cls.has('vfell')).length === 0 && !brk, 'the switch off: the card as it was'); });
      VERDICT.on = !brk; }

    // 7. the kept record
    { const G = globalThis as any, had = 'localStorage' in G, prev = G.localStorage, mem = new Map<string, string>();
      G.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } };
      try { const key = store.verdictKey('killhouse-four', 'hard'), other = store.verdictKey('killhouse-four', 'standard');
        const t1 = store.tryStarted(key), l1 = store.runEnded(key, t1, { won: false, approach: null, clean: false, secs: 40 });
        const t2 = store.tryStarted(key), w2 = store.runEnded(key, t2, { won: true, approach: 'doors', clean: false, secs: 95.7 });
        line(t1 === 1 && t2 === 2 && l1.streak === 1 && !l1.fresh && w2.fresh && !w2.gold && w2.rec.w.doors.tries === 2 && !w2.rec.w.doors.clean && w2.rec.w.doors.secs === 95 && w2.rec.s === 0 && w2.rec.n === 2, 'a loss then a win by the doors: the way is kept at two tries, the streak closed');
        const t3 = store.tryStarted(key), w3 = store.runEnded(key, t3, { won: true, approach: 'doors', clean: true, secs: 120 });
        line(t3 === 1 && !w3.fresh && w3.rec.w.doors.tries === 1 && w3.rec.w.doors.clean && w3.rec.w.doors.secs === 95 && w3.rec.w.doors.wins === 2, 'won again by the doors at the first try, nobody lost: the fewest tries, the clean mark and the best time are kept');
        const t4 = store.tryStarted(key), w4 = store.runEnded(key, t4, { won: true, approach: 'walls', clean: false, secs: 80 });
        line(w4.fresh && w4.gold && store.waysWon(store.recordOf(key)) === 2, 'a second way won: gold');
        const v = store.runEnded(key, 0, { won: true, approach: 'quiet', clean: true, secs: 10 });
        line(v.rec === null && !store.recordOf(key).w.quiet && store.waysWon(store.recordOf(other)) === 0, 'a try that was not counted keeps nothing; another difficulty is another record');
        mem.set('twopointsix.verdicts', '{"x|hard":{"n":"a","s":9,"w":{"doors":7,"dark":{"tries":0}}},'); const bad = store.recordOf('x|hard');
        mem.set('twopointsix.verdicts', '{"x|hard":{"n":3,"s":9,"w":{"doors":7,"dark":{"tries":0}}}}'); const odd = store.recordOf('x|hard');
        line(bad.n === 0 && odd.n === 3 && odd.s === 3 && !odd.w.doors && odd.w.dark.tries === 1, 'a spoiled entry is read as far as it makes sense, never thrown on');
      } finally { if (had) G.localStorage = prev; else delete G.localStorage; }
      line(store.tryStarted('a|b') === 0 && store.recordOf('a|b').n === 0, 'with nowhere to keep it (headless) nothing is counted'); }

    // 8. a mission's card on the start page
    { const { withDom, El } = await import('./scenario-picker-probes.ts'), { dressMissionRows, rowEarns } = await import(`${ROOT}/src/ui/verdictRows.ts`);
      const P: any = El.prototype;   // (the checks' fake element has no removeChild / replaceChild: the two the dresser needs, for this check only)
      P.removeChild ??= function (this: any, c: any) { this.children = this.children.filter((x: any) => x !== c); return c; };
      P.replaceChild ??= function (this: any, n: any, o: any) { this.children = this.children.map((x: any) => x === o ? n : x); n.parentElement = this; return o; };
      await withDom('', async () => { const root: any = new El('DIV'), rows: Record<string, any> = {};
        for (const id of ['killhouse-four', 'solo-night', 'train-move', 'bazaar-quiet']) { const a = new El('A'); a.className = 'mrow'; a.setAttribute('data-mission', id); const t = new El('SPAN'); t.className = 'mtitle'; a.appendChild(t); root.appendChild(a); rows[id] = a; }
        root.querySelectorAll = () => root.all((e: any) => e.cls.has('mrow'));
        const kept: Record<string, any> = { 'killhouse-four': { doors: { first: false, clean: true }, quiet: { first: true, clean: false } } }, ways = (id: string) => kept[id] ?? {};
        const pipsOf = (id: string) => rows[id].children.filter((c: any) => c.cls.has('vpips'));
        const n1 = dressMissionRows(root, ways), k = pipsOf('killhouse-four')[0], first = k;
        line(n1 === 3 && pipsOf('train-move').length === 0 && !rowEarns('train-move') && rowEarns('solo-night') && pipsOf('solo-night').length === 1 && pipsOf('bazaar-quiet').length === 1, 'every mission\'s card gets its four pips; a training lesson gets none');
        line(!!k && k.cls.has('gold') && k.all((e: any) => e.cls.has('vpip')).length === 4 && k.all((e: any) => e.cls.has('won')).length === 2 && k.all((e: any) => e.cls.has('v1') && e.cls.has('on')).length === 1 && k.all((e: any) => e.cls.has('vall') && e.cls.has('on')).length === 1 && k.all((e: any) => e.cls.has('now')).length === 0
          && pipsOf('solo-night')[0].cls.has('none') && pipsOf('solo-night')[0].all((e: any) => e.cls.has('won')).length === 0, 'two ways won: both lit in the gold frame, first try and nobody lost marked each on its own way; nothing won: four dim marks');
        dressMissionRows(root, ways);
        line(pipsOf('killhouse-four')[0] === first && pipsOf('killhouse-four').length === 1, 'dressed again with nothing changed: the same element, never a second strip');
        kept['solo-night'] = { quiet: { first: true, clean: true } }; dressMissionRows(root, ways);
        line(pipsOf('solo-night').length === 1 && !pipsOf('solo-night')[0].cls.has('none') && pipsOf('solo-night')[0].all((e: any) => e.cls.has('won')).length === 1 && pipsOf('killhouse-four')[0] === first, 'a way newly won: that card\'s strip is made again, the others are left');
        VERDICT.on = false; const n0 = dressMissionRows(root, ways); VERDICT.on = !brk;
        line(n0 === 0 && Object.keys(rows).every(id => pipsOf(id).length === 0) && rows['killhouse-four'].children.length === 1 && !brk, 'the switch off: every strip is taken off again, the rows as the list drew them'); });
      line(store.keptWays({ n: 3, s: 0, w: { doors: { tries: 1, clean: false, secs: 9, wins: 1 }, dark: { tries: 4, clean: true, secs: 9, wins: 2 } } }).doors!.first === true && store.keptWays({ n: 3, s: 0, w: { dark: { tries: 4, clean: true, secs: 9, wins: 2 } } }).dark!.first === false && Object.keys(store.keptWays(null)).length === 0, 'the record read as pips: first try = the fewest tries a win by that way took is one'); }
  } catch (e) { line(false, `threw: ${(e as Error).stack ?? e}`); }
  finally { knobsBack(knobs0); }
  console.log(failed ? `verdict-check: FAILED (${checks} checks)` : `verdict-check: all ${checks} hold`);
  return !failed;
}

if (import.meta.main) { const ok = await verdictCheck(); process.exit(ok ? 0 : 1); }
