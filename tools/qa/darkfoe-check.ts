// AN ENEMY ON ALERT DOES NOT SIT BLIND IN THE DARK — the check behind src/game/darkfoe.ts (DARKFOE.on: on in the page, ?nodarkfoe; off on the frozen stand,
// TPS_DARKFOE=1).
//   bun run tools/qa/darkfoe-check.ts        (also `probes.ts darkfoe`; run it on BOTH stands: plain, and with TPS_PROFILE=shipped in front)
// Mousehole's room clear at night (where the maintainer's tape was played: nine defenders, weapon lights dealt off, some rooms lit and some not), Sam out of
// everybody's sight, the switch and the numbers thrown by hand. "Gunfire has reached him" is written into a man's witness record in (a)-(c), (e), (g) — no
// event, so dig-in and the squads sleep and the lamp rule is read alone — and is REAL gunfire (eight 'shot' events where Sam stands) in (d), where they wake:
//   (a) nobody has been told: with the rule on, six seconds in, no man knows, no lamp burns and nobody has left his mark — though some of them are blind;
//   (b) every man carries a light and all have been told: the module's reading of each man's view is the check's own (the same floor read again here); a man
//       whose view has read dark for the dwell burns his lamp and one whose view has read lit for the dwell does not — both really happen; a burning lamp lights
//       the floor down his aim (the estimate with it against without it); no lamp moves twice inside the hold, nor more than six times a minute;
//   (c) the lamps are the word: ONE man told, the rest not — a man who has only the word has a burning lamp of his side before his eyes (inside his cone, a
//       clear line), at least one such man lights his own, and the word never becomes knowing for good; with `byLamp` off nobody else has it and no other lamp burns;
//   (d) nobody carries a light, real gunfire. No authored floor is counted on to hold a walker (the levels are rebuilt under this check), so the walk is
//       read on a floor THE CHECK SETS: once the shots have died away every fixture is shot out and one ceiling lamp is put up in the own room of a man the
//       room fight merely has holding, 4 m or more from him (the first of killhouse / hall / depot where the rule's own search finds him a spot); then on
//       depot.json as it is dealt, and on Mousehole (stay-home squads: dig-in has them). No lamp of a man's burns; every man sent was alert already, was
//       nobody else's the frame before (darkFoeKept null), stood on floor with no light in view, and was sent to floor he can see from INSIDE HIS OWN ROOM; the
//       man the lamp was set for is sent; at no more than the stumbling pace, and those who got there are the room fight's again (holding, pinned); nobody is
//       sent more than `moves` times; on Mousehole a blind man dig-in has is never sent; on depot.json `roam` lets a man out of his room (at least one goes)
//       and sends no fewer; with `seek` off nobody walks on the set floor; the mission's alert count is the same whichever way;
//   (h) only suspicious: a blind man held suspicious by hand (he has heard something, found nobody) for eight seconds never lights his lamp and never knows for
//       good; with `suspect` on (the first cut) the same man lights it;
//   (e) not this rule's: a man the mission dealt a burning light, and every man under a show, is never met;
//   (f) the per-man state round-trips darkFoeSnapshot / darkFoeRestore;
//   (g) the switch off = the base: nobody is met, nothing is asked, no lamp burns, and thirty seeded seconds with every man told digest as the stand that never
//       had the rule on.
// DARKFOE_BREAK=1 = the rule left on for the 'off' lines, and `suspect` left on for (h)'s: (g) and (h) must fail.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: every light here is guards.ts's direct-light estimate (no bounce — it errs dark). Nobody has seen any of this on a GPU.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');

function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

export async function darkfoeCheck(): Promise<boolean> {
  const { standUp } = await import('./headless.ts');
  const { DARKFOE, DARKFOE_STATS, darkFoeOf, darkFoeSnapshot, darkFoeRestore, darkFoeRuled, darkFoeKept, darkFoeBlind, darkFoeSpot } = await import(`${ROOT}/src/game/darkfoe.ts`);
  const { lightEstimateAt, GUARD_EYE } = await import(`${ROOT}/src/game/guards.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const DT = 1 / 60, rnd0 = Math.random, was = { ...DARKFOE }; let all = true;
  const BREAK = process.env.DARKFOE_BREAK === '1';
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== darkfoe: an enemy on alert does not sit blind in the dark ===');
  const levelOf = (file: string) => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
  const stand = async (seed: number, file = 'mousehole.json', deal = 1) => { Math.random = seeded(seed); const W: any = await quiet(() => standUp({ uploadEvery: 4, level: levelOf(file) })); const g = W.game;
    g.playerInvisible = true; g.godMode = true;
    const why = await quiet(async () => g.roomClear.start(deal)); if (why) throw new Error(`the room clear did not start on ${file}: ${why}`);
    await quiet(async () => { for (let i = 0; i < 90; i++) W.step(DT); }); return W; };
  const step = (W: any, n = 1) => quiet(async () => { for (let i = 0; i < n; i++) W.step(DT); });
  const foes = (g: any): any[] => g.guards.filter((x: any) => x.unit && x.team === 'hostile' && x.state !== 'dead');
  const tell = (gd: any) => { gd.witness.heard.shots = Math.max(1, gd.witness.heard.shots); };
  const shots = async (W: any) => { const g = W.game; for (let k = 0; k < 8; k++) { g.events.push({ kind: 'shot', pos: [...g.player.char.pos], time: g.time, loud: true, level: 2 }); await step(W, 6); } };   // (real gunfire where Sam stands: a 'shot' counts as one from level 1)
  const burns = (gd: any) => !!gd.flashlight.enabled;
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  // the check's own readings, off the estimate (not the module's functions)
  const floor = (g: any, x: number, z: number, skip: (o: number) => boolean) => g.visibilityOf(lightEstimateAt(g, [x, 1.2, z], skip, true));
  const ownBlind = (g: any, gd: any) => { const c = gd.char, eye = [c.pos[0], 1.5, c.pos[2]], skip = (o: number) => o === c.id; let n = 0, lit = 0;
    for (const off of [0, -DARKFOE.fanRad, DARKFOE.fanRad]) { const fx = Math.sin(c.aimYaw + off), fz = Math.cos(c.aimYaw + off);
      for (let r = DARKFOE.stepM; r <= DARKFOE.lookM + 1e-6; r += DARKFOE.stepM) { const x = eye[0] + fx * r, z = eye[2] + fz * r; if (g.col.segmentBlocked(eye, [x, 1.5, z])) break; n++; if (floor(g, x, z, skip) >= DARKFOE.litAt) lit++; } }
    return n ? lit / n < DARKFOE.seeShare : floor(g, c.pos[0], c.pos[2], skip) < DARKFOE.litAt; };
  const ownSees = (g: any, p: number[]) => { const place = () => true; if (floor(g, p[0], p[2], place) >= DARKFOE.litAt) return true; const eye = [p[0], 1.5, p[2]];
    for (let ring = 1; ring <= 2; ring++) { const r = DARKFOE.edgeM * ring / 2; for (let k = 0; k < 8; k++) { const a = (k + (ring & 1) * 0.5) * Math.PI / 4, qx = p[0] + Math.sin(a) * r, qz = p[2] + Math.cos(a) * r;
      if (!g.col.segmentBlocked(eye, [qx, 1.5, qz]) && floor(g, qx, qz, place) >= DARKFOE.litAt) return true; } }
    return false; };

  try {
    // (a) nobody has been told
    { const W = await stand(31), g = W.game; Object.assign(DARKFOE, was, { on: true, carry: 1 });
      await step(W, 360); const men = foes(g), blind = men.filter(gd => ownBlind(g, gd)).length;
      const knows = men.filter(gd => darkFoeOf(gd)?.knows).length, lit = men.filter(burns).length, walked = men.filter(gd => (darkFoeOf(gd)?.moves ?? 0) > 0).length;
      line(men.length >= 5 && blind >= 2 && knows === 0 && lit === 0 && walked === 0, 'nobody has been told: six seconds on, no man knows, no lamp burns and nobody has left his mark — though some stand blind',
        `${men.length} defenders · ${blind} with a dark view by the check's own reading · know ${knows} · lamps ${lit} · sent ${walked}`); }

    // (b) every man carries, all told
    { const W = await stand(32), g = W.game; Object.assign(DARKFOE, was, { on: true, carry: 1 }); const men = foes(g); men.forEach(tell);
      const owedOn = Math.ceil((DARKFOE.onSecs + DARKFOE.onJitter + DARKFOE.holdSecs + 2 * DARKFOE.askSecs) / DT) + 2, owedOff = Math.ceil((DARKFOE.offSecs + DARKFOE.holdSecs + 2 * DARKFOE.askSecs) / DT) + 2;
      const run = new Map<any, { blind: number; lit: number; flips: number[]; was: boolean; everLit: boolean; everBlind: boolean }>(men.map(gd => [gd, { blind: 0, lit: 0, flips: [], was: false, everLit: false, everBlind: false }]));
      let reads = 0, readBad = 0, darkOff = 0, litOn = 0; const bad: string[] = [];
      for (let i = 0; i < 60 * 40; i++) {
        const pre = new Map<any, boolean>(); for (const gd of men) { const S = darkFoeOf(gd); if (S && S.knows && gd.state !== 'dead' && S.ask + DT >= DARKFOE.askSecs) pre.set(gd, ownBlind(g, gd)); }   // (the men the rule reads this frame: the check reads the same floor first, as the frame finds it)
        await step(W);
        for (const gd of men) { if (gd.state === 'dead') continue; const S = darkFoeOf(gd), R = run.get(gd)!; if (!S) continue;
          if (S.ask === 0 && pre.has(gd)) { reads++; if (pre.get(gd) !== S.blind) readBad++; }
          if (S.blind) { R.blind++; R.lit = 0; R.everBlind = true; } else { R.lit++; R.blind = 0; }
          const on = burns(gd); if (on !== R.was) { R.flips.push(i); R.was = on; } if (on) R.everLit = true;
          if (R.blind >= owedOn && !on) { darkOff++; if (bad.length < 4) bad.push(`${gd.callsign} dark at ${(i * DT).toFixed(1)} s after ${(R.blind * DT).toFixed(1)} s of a dark view`); }
          if (R.lit >= owedOff && on) { litOn++; if (bad.length < 4) bad.push(`${gd.callsign} burning at ${(i * DT).toFixed(1)} s after ${(R.lit * DT).toFixed(1)} s of a lit view`); } } }
      const lit = men.filter(gd => run.get(gd)!.everLit), never = men.filter(gd => !run.get(gd)!.everLit);
      line(reads > 200 && readBad === 0, 'the module\'s reading of each man\'s view is the check\'s own', `${reads} readings · ${readBad} differ`);
      line(darkOff === 0 && litOn === 0 && lit.length >= 2 && never.length >= 1, 'a man whose view has stood dark for the dwell burns his lamp; one whose view has stood lit does not; both happen',
        `lamps lit: ${lit.map(gd => gd.callsign).join(', ') || 'nobody'} · never lit (no dark view outlasted the dwell): ${never.map(gd => gd.callsign).join(', ') || 'nobody'} · frames dark past the dwell with the lamp off ${darkOff} · lit past the dwell with it on ${litOn}${bad.length ? ' · ' + bad.join(' | ') : ''}`);
      let shown = 0, tried = 0, gain = 0; const beams: string[] = [];
      for (const gd of men) { if (!burns(gd)) continue; const c = gd.char, L = gd.flashlight, d = L.dir, h = Math.hypot(d[0], d[2]) || 1, p = [L.pos[0] + d[0] / h * 4, 1.2, L.pos[2] + d[2] / h * 4];
        if (g.col.segmentBlocked(L.pos, p)) continue; tried++;
        const wth = g.visibilityOf(lightEstimateAt(g, p, undefined, true)), without = g.visibilityOf(lightEstimateAt(g, p, (o: number) => o === c.id, true)); beams.push(`${gd.callsign} ${without.toFixed(2)} → ${wth.toFixed(2)}`);
        if (wth >= DARKFOE.litAt && wth >= without) shown++; if (wth > without + 0.2) gain++; }
      line(tried >= 1 && shown === tried && gain >= 1, 'a burning lamp lights the floor down its beam: four metres out the meter reads lit with it — the same lamp the player\'s meter reads', `${shown} of ${tried} burning lamps with open floor ahead read lit · ${gain} on floor that was dark without it · ${beams.join(' · ')}`);
      let quick = 0, most = 0; for (const R of run.values()) { for (let k = 1; k < R.flips.length; k++) if ((R.flips[k] - R.flips[k - 1]) * DT < DARKFOE.holdSecs - 1e-6) quick++; most = Math.max(most, R.flips.length / (40 / 60)); }
      line(quick === 0 && most <= 6, 'no flicker: no lamp moves twice inside the hold, nor more than six times a minute', `moves inside ${DARKFOE.holdSecs} s: ${quick} · the busiest lamp: ${most.toFixed(1)} a minute`);

      // (f) the state round-trips
      const snap = darkFoeSnapshot(g), before = JSON.stringify(men.map(gd => darkFoeOf(gd)));
      darkFoeRestore(g, null); const gone = men.every(gd => darkFoeOf(gd) === null);
      darkFoeRestore(g, JSON.parse(JSON.stringify(snap))); const after = JSON.stringify(men.map(gd => darkFoeOf(gd)));
      line(!!snap && gone && before === after, 'each man\'s state round-trips its snapshot (who knows, the reading, the lamp and its dwell, the walks)', `a snapshot ${!!snap} · cleared by an empty restore ${gone} · equal after ${before === after}`); }

    // (c) the lamps are the word
    for (const byLamp of [true, false]) { const W = await stand(33), g = W.game; Object.assign(DARKFOE, was, { on: true, carry: 1, byLamp }); const men = foes(g);
      const los = (a: any, b: any) => flat(a.char.pos, b.char.pos) <= DARKFOE.lampM + 0.5 && !g.col.segmentBlocked([a.char.pos[0], 1.5, a.char.pos[2]], [b.char.pos[0], 1.5, b.char.pos[2]]);
      const inCone = (a: any, b: any) => { let d = Math.atan2(b.char.pos[0] - a.char.pos[0], b.char.pos[2] - a.char.pos[2]) - a.char.aimYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) <= (GUARD_EYE.halfDeg + 8) * Math.PI / 180; };
      const first = men.filter(gd => ownBlind(g, gd)).sort((a, b) => men.filter(o => o !== b && los(o, b) && inCone(o, b)).length - men.filter(o => o !== a && los(o, a) && inCone(o, a)).length)[0];
      if (!first) { line(false, 'the lamps are the word: no blind man to tell on this staging'); continue; }
      tell(first); const last = new Map<any, number>(), had = new Set<any>(), litToo = new Set<any>(); let unseen = 0, latched = 0;
      for (let i = 0; i < 60 * 15; i++) { await step(W);
        for (const gd of men) { if (gd === first || gd.state === 'dead') continue; if (men.some(o => o !== gd && burns(o) && darkFoeOf(o)?.knows && los(gd, o) && inCone(gd, o))) last.set(gd, i);   // (the lamp of a man who KNOWS: a lamp lit on the word passes none)
          const S = darkFoeOf(gd), own = gd.state !== 'patrol' || gd.witness.heard.shots + gd.witness.heard.kick + gd.witness.heard.bang > 0 || gd.witness.alertedBy !== null;   // (he has it for himself: not this line's)
          if (own) continue; if (burns(gd)) litToo.add(gd);
          if (S?.knows) latched++;
          if (S?.word) { had.add(gd); if (i - (last.get(gd) ?? -1e9) > 30) unseen++; } } }
      const names = (set: Set<any>) => [...set].map(gd => gd.callsign).join(', ') || 'nobody';
      if (byLamp) line(burns(first) && had.size >= 1 && litToo.size >= 1 && unseen === 0 && latched === 0, 'one man told: his lamp comes on; a man with only the word has a burning lamp before his eyes, lights his own, and never knows for good by it',
        `${first.callsign} told, lamp ${burns(first) ? 'on' : 'OFF'} · had the word: ${names(had)} · lit their own: ${names(litToo)} · frames with the word and no lamp before him: ${unseen} · frames knowing for good: ${latched}`);
      else line(burns(first) && had.size === 0 && litToo.size === 0, '…and with `byLamp` off nobody else has the word and no other lamp burns', `had the word: ${names(had)} · lit: ${names(litToo)}`); }

    // (d) nobody carries a light, real gunfire
    { type Row = { who: string; lvl: string; kept: string | null; state: string; sees: boolean; toSees: boolean; inRoom: boolean };
      const runD = async (file: string, deal: number, mode: 'room' | 'roam' | 'off', set = false) => { const W = await stand(34, file, deal), g = W.game; Object.assign(DARKFOE, was, { on: true, carry: 0, seek: mode !== 'off', roam: mode === 'roam' }); darkFoeRestore(g, null);
        const men = foes(g); await shots(W);
        let lit: any = null;   // the man the check's lamp was set for
        if (set) { const nav = g.col.nav, cs = nav.cell; await step(W, 60 * 7);   // (the shots have died away: nobody is 'in a fight')
          for (const t of g.targets) if (t.kind !== 'breaker') t.broken = true;   // every fixture shot out, by the field: no event, nobody hears it
          await step(W, 30);
          const lamp: any = g.engine.lights.add({ name: 'qa_lamp', group: 'qa', kind: 1, pos: [0, 2.3, 0], dir: [0, -1, 0], color: [1, 0.9, 0.75], intensity: 160, range: 5, innerDeg: 45, outerDeg: 60, radius: 0.05, volumetric: 0, owner: 0, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 160 });
          const seek = DARKFOE.seek; DARKFOE.seek = true;   // (the search for where to hang it is the same with `seek` off)
          for (const gd of men) { if (lit) break; if (gd.state === 'dead' || darkFoeKept(g, gd) !== null) continue; const D = g.fight.defs.find((d: any) => d.gd === gd), c = gd.char; if (!D?.room) continue;
            for (let x = Math.floor(c.pos[0] - 9); x <= c.pos[0] + 9 && !lit; x++) for (let z = Math.floor(c.pos[2] - 9); z <= c.pos[2] + 9 && !lit; z++) { const q = [x + 0.5, 0, z + 0.5];
              if (flat(q, c.pos) < 4 || nav.isBlocked(q[0], q[2]) || !D.room.cells.has(nav.idx(Math.floor(q[0] / cs), Math.floor(q[2] / cs)))) continue;
              lamp.pos[0] = q[0]; lamp.pos[2] = q[2]; lamp.enabled = true;
              if (darkFoeBlind(g, gd) && !ownSees(g, c.pos) && darkFoeSpot(g, D)) lit = gd; else lamp.enabled = false; } }
          DARKFOE.seek = seek; }
        const moves = new Map<any, number>(men.map(gd => [gd, 0])), prev = new Map<any, number[]>(men.map(gd => [gd, [...gd.char.pos]])), rows: Row[] = [], sent = new Set<any>();
        let lamps = 0, fast = 0, top = 0; const cap = g.tune.guardInvestigate * DARKFOE.stumbleK, nav = g.col.nav;
        for (let i = 0; i < 60 * 45; i++) {
          const pre = new Map<any, { kept: string | null; state: string }>(men.map(gd => [gd, { kept: gd.state === 'dead' ? 'dead' : darkFoeKept(g, gd), state: gd.state }]));
          await step(W);
          for (const gd of men) { if (gd.state === 'dead') continue; const S = darkFoeOf(gd); if (burns(gd)) lamps++;
            const D = g.fight.defs.find((d: any) => d.gd === gd), p0 = prev.get(gd)!, v = flat(gd.char.pos, p0) / DT; prev.set(gd, [...gd.char.pos]);
            if (D?.mode === 'move' && S?.to && sent.has(gd)) { top = Math.max(top, v); if (v > cap * 1.25 + 0.05) fast++; }
            if (S && S.moves > moves.get(gd)!) { moves.set(gd, S.moves); sent.add(gd); const P = pre.get(gd)!;
              const calm = g.time - gd.lastSeenT >= DARKFOE.quietSecs && g.time - gd.witness.heard.lastShotT >= DARKFOE.calmSecs && !(gd.sup.v > 0.05);   // (the frame before reads 'in a fight' on the very frame the quiet runs out: asked again here, of the frame he was sent)
              rows.push({ who: gd.callsign, lvl: file, kept: P.kept === 'in a fight' && calm ? null : P.kept, state: P.state, sees: ownSees(g, p0), toSees: ownSees(g, S.to), inRoom: !D?.room || D.room.cells.has(nav.idx(Math.floor(S.to[0] / nav.cell), Math.floor(S.to[2] / nav.cell))) }); } } }
        const there = [...sent].filter(gd => gd.state !== 'dead' && flat(gd.char.pos, darkFoeOf(gd)!.to) < 1.2), theirs = there.filter(gd => { const D = g.fight.defs.find((d: any) => d.gd === gd); return D?.mode === 'hold' && gd.hold && gd.pinned && gd.state === 'alert'; });
        const dug = men.filter(gd => gd.state !== 'dead' && darkFoeOf(gd)?.blind && darkFoeKept(g, gd) === 'dug in');
        return { file, lit, litSent: !!lit && sent.has(lit), rows, sent: sent.size, lamps, fast, top, cap, there: there.length, theirs: theirs.length, over: men.filter(gd => (darkFoeOf(gd)?.moves ?? 0) > DARKFOE.moves).length, alerts: g.mission?.stats?.alerts ?? -1, dug, dugSent: dug.filter(gd => sent.has(gd)).length }; };
      let own: any = null; for (const [f, d] of [['killhouse.json', 1], ['hall.json', 1], ['depot.json', 1]] as [string, number][]) { own = await runD(f, d, 'room', true); if (own.lit) break; }
      const off = await runD(own.file, 1, 'off', true), room = await runD('depot.json', 1, 'room'), roam = await runD('depot.json', 1, 'roam'), mouse = await runD('mousehole.json', 1, 'room');
      const all = [own, room, mouse], rows = all.flatMap(r => r.rows), sum = (rs: any[], k: string) => rs.reduce((a, r) => a + r[k], 0), lvl = (f: string) => f.replace('.json', '');
      const good = (r: Row, inRoom: boolean) => r.kept === null && r.state === 'alert' && !r.sees && r.toSees && (!inRoom || r.inRoom);
      line(sum(all, 'lamps') === 0 && own.litSent && rows.every(r => good(r, true)) && sum(all, 'over') === 0,
        'nobody carries a light, real gunfire: no man\'s lamp burns; the man the check hung a lamp for in his own dark room is sent; every man sent was alert, nobody else\'s, on floor with no light in view, and sent to floor he can see from inside his own room',
        `the lamp was hung for ${own.lit?.callsign ?? 'nobody'} (${lvl(own.file)}) · sent: ${rows.map(r => `${r.who} (${lvl(r.lvl)})`).join(', ') || 'nobody'} · not good: ${rows.filter(r => !good(r, true)).map(r => `${r.who} kept=${r.kept} state=${r.state} sees=${r.sees} toSees=${r.toSees} inRoom=${r.inRoom}`).join(' | ') || 'none'} · lamp frames ${sum(all, 'lamps')} · over ${DARKFOE.moves} walks: ${sum(all, 'over')}`);
      line(own.there >= 1 && own.theirs === own.there && own.fast === 0, 'the walk is at the stumbling pace and ends as the room fight\'s man again: holding where he got to, pinned, alert as he was',
        `got there ${own.there} of ${own.sent} · holding, pinned, alert ${own.theirs} · top pace ${own.top.toFixed(2)} m/s against ${own.cap.toFixed(2)} · frames over it ${own.fast}`);
      line(mouse.dug.length >= 1 && mouse.dugSent === 0, 'on Mousehole (stay-home squads) a blind man dig-in has is never sent', `blind and dug in at the end: ${mouse.dug.map((gd: any) => gd.callsign).join(', ') || 'nobody'} · of them sent ${mouse.dugSent} · sent there in all ${mouse.sent}`);
      line(roam.rows.length >= room.rows.length && roam.rows.some((r: Row) => !r.inRoom) && roam.rows.every((r: Row) => good(r, false)), 'on depot.json as dealt, `roam` lets a man out of his room for it: no fewer are sent, each still alert, nobody else\'s, from floor with no light in view to floor he can see from',
        `sent ${roam.rows.length} (in the room only: ${room.rows.length}) · out of their room ${roam.rows.filter((r: Row) => !r.inRoom).length} · not good: ${roam.rows.filter((r: Row) => !good(r, false)).map((r: Row) => `${r.who} kept=${r.kept} state=${r.state} sees=${r.sees} toSees=${r.toSees}`).join(' | ') || 'none'}`);
      line(!!own.lit && off.lit?.callsign === own.lit.callsign && off.sent === 0 && off.lamps === 0 && off.alerts === own.alerts && roam.alerts === room.alerts, '…with `seek` off nobody walks on the same floor, and the mission\'s alert count is the same whichever way',
        `the lamp was hung for ${off.lit?.callsign ?? 'nobody'} again · walked ${off.sent} · alerts on ${lvl(own.file)}: seek off ${off.alerts}, on ${own.alerts} · on depot: in the room ${room.alerts}, roaming ${roam.alerts}`); }
    // (h) only suspicious
    { const runH = async (suspect: boolean) => { const W = await stand(37), g = W.game; Object.assign(DARKFOE, was, { on: true, carry: 1, suspect }); darkFoeRestore(g, null);
        const men = foes(g); await step(W, 30);
        const gd = men.find(m => m.state === 'patrol' && darkFoeBlind(g, m)); if (!gd) return { who: '', held: 0, lamp: 0, knew: 0, others: 0 };
        let held = 0, lamp = 0, knew = 0, others = 0;
        for (let i = 0; i < 60 * 8; i++) { if (gd.state === 'patrol' || gd.state === 'suspicious') { gd.state = 'suspicious'; gd.searchT = 0; gd.awareness = Math.max(gd.awareness, 0.35); gd.lastKnown ??= [...gd.char.pos]; }   // (held suspicious by hand: he has heard something and found nobody)
          await step(W); if (gd.state === 'suspicious') held++; if (burns(gd)) lamp++; if (darkFoeOf(gd)?.knows) knew++; others += men.filter(m => m !== gd && burns(m)).length; }
        return { who: gd.callsign as string, held, lamp, knew, others }; };
      const off = await runH(BREAK), on = await runH(true);
      line(!!off.who && off.held >= 60 * 6 && off.lamp === 0 && off.knew === 0 && off.others === 0 && on.who === off.who && on.lamp > 0 && on.knew === 0,
        'a blind man who is only suspicious keeps his lamp off (eight seconds of it, and he never knows for good); with `suspect` on, as the first cut had it, the same man lights it',
        `${off.who || 'no blind calm man'}: suspicious ${off.held} frames · lamp frames ${off.lamp} · knew ${off.knew} · other lamps ${off.others} · with \`suspect\`: ${on.who} lamp frames ${on.lamp}, knew ${on.knew}`); }

    // (e) not this rule's
    { const W = await stand(35), g = W.game; Object.assign(DARKFOE, was, { on: true, carry: 1 }); const men = foes(g); men.forEach(tell);
      const dealt = men.find(gd => ownBlind(g, gd)) ?? men[0]; dealt.unit.light = true; darkFoeRestore(g, null); await step(W, 300);
      const A = darkFoeOf(dealt) === null && !darkFoeRuled(g, dealt) && burns(dealt);
      const W2 = await stand(35), g2 = W2.game; Object.assign(DARKFOE, was, { on: true, carry: 1 }); g2.touring = true; darkFoeRestore(g2, null); foes(g2).forEach(tell); await step(W2, 300);
      const B = foes(g2).every(gd => darkFoeOf(gd) === null && !burns(gd)); g2.touring = false;
      line(A && B, 'not this rule\'s: a man the mission dealt a burning light is never met (his light is the mission\'s), and under a show nobody is', `the dealt man ${A ? 'untouched, burning' : 'TOUCHED'} · under a show ${B ? 'nobody met, no lamp' : 'SOMEBODY MET'}`); }

    // (g) off = the base
    { const run = async (W: any) => { const g = W.game, men = foes(g), asks0 = DARKFOE_STATS.asks; men.forEach(tell); let s = '', lamps = 0; Math.random = seeded(361);
        for (let i = 0; i < 1800; i++) { await step(W); for (const gd of men) if (burns(gd)) lamps++; if (i % 60 === 59) s += hashDigest(digestGame(g, true)) + ' '; }
        return { s, lamps, asks: DARKFOE_STATS.asks - asks0, met: men.filter(gd => darkFoeOf(gd)).length }; };
      Object.assign(DARKFOE, was, { on: false }); const Wb = await stand(36); Object.assign(DARKFOE, was, { on: false }); const base = await run(Wb);
      { const W0 = await stand(37); Object.assign(DARKFOE, was, { on: true, carry: 1 }); foes(W0.game).forEach(tell); await step(W0, 240); }   // (the rule has run in this process, on another floor)
      Object.assign(DARKFOE, was, { on: false }); const Wo = await stand(36); Object.assign(DARKFOE, was, { on: BREAK }); darkFoeRestore(Wo.game, null); const off = await run(Wo);   // (the frozen stand writes the switch off as it stands a game up; the shipped one leaves it: thrown again here either way)
      line(off.asks === 0 && off.met === 0 && off.lamps === 0 && base.lamps === 0 && off.s === base.s, 'the switch off: nobody is met, nothing is asked, no lamp burns, and thirty seeded seconds with every man told digest as the stand that never had the rule on',
        `asks ${off.asks} · men met ${off.met} · lamp frames ${off.lamps} (base ${base.lamps}) · thirty digests equal ${off.s === base.s}`); }
  } finally { Object.assign(DARKFOE, was); Math.random = rnd0; }
  console.log(`=== darkfoe: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await darkfoeCheck()) ? 0 : 1);
