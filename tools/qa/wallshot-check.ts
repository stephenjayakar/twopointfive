// A WALL SHOT'S SMOKE IS THINNER AND ITS SHOCK FILLS THE ROOM — the check behind WALLSHOT (src/game/wallcharge.ts; on in the page, ?wallshot=0; off in the
// module and on the frozen stand, TPS_WALLSHOT=1).
//   bun run tools/qa/probes.ts wallshot        (family `wallcharge`)        WALLSHOT_BREAK=1 = the rule off and the same lines asked: must FAIL
// the maintainer, 10-19, of a room clear on the mousehole taken through blown walls: "the smoke after a wall shot makes it too hard -- we should probably (1)
// turn down its density a little and (2) make it so everyone in the room gets more of a shock". In his run the one man in the first room was folded 2.0 s,
// came up still blind inside the pall and shot the first man through the hole 2.7 s after the blast.
// THE SITES: his own level and two of the walls he blew (the long wall of the row of rooms, by the floor points 12.7, 7.0 and 24.9, 7.0, set from the yard),
// each on a fresh stand with its room clear dealt for four. Headless: the smoke solver is a null object here, so the pall is read as what the game ASKS of it
// (every emitter handed to g.smoke.emit); what the cloud then hides is the page's to say.
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
type Vec3 = [number, number, number];
export async function wallShotCheck(): Promise<boolean> {
  const BRK = process.env.WALLSHOT_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== wallshot: a wall shot's smoke is thinner and its shock fills the room${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`); const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`); const { CHAOS } = await import(`${ROOT}/src/game/destruction.ts`);
  const { WALLCHARGE, WALLSHOT, wallAt } = await import(`${ROOT}/src/game/wallcharge.ts`); const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
  const { SAMSTUN } = await import(`${ROOT}/src/game/samstun.ts`); const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`); const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const knobs0 = knobsCopy(), destr0 = DESTRUCTION.on, log = console.log, data = readFileSync(`${ROOT}/levels/mousehole.json`, 'utf8');
  const raise = (rule: boolean) => { DESTRUCTION.on = true; WALLCHARGE.on = true; WALLCHARGE.outer = true; SAMSTUN.on = true; CHAOS.pall.on = true; CHAOS.pall.solver = true; WALLSHOT.on = rule && !BRK; };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t)), near = (a: number, b: number, e = 0.02) => Math.abs(a - b) <= e, f = (v: number) => v.toFixed(2);
  type Man = { who: string; at?: Vec3 };
  /** a charge on the wall by `at`, set from `from`, the named men stood where asked first; blown as F blows it. What each man and the player then carry, and
   *  every emitter the blast asked of the solver (`pall`: by the pall's own call). */
  const shot = async (rule: boolean, at: Vec3, from: Vec3, men: Man[], sam?: Vec3, opt: { tune?: () => void; watch?: string } = {}) => { raise(rule); opt.tune?.(); console.log = () => { };
    try { const W: any = await standUp({ level: loadLevel(parseLevelData(data)), seed: 1 }); raise(rule); const g = W.game; g.godMode = true; g.tune.chaos = 0.5;
      await startFromQuery(g, new URLSearchParams('roomclear&squad4')); raise(rule); g.aiEnabled = false; for (let i = 0; i < 4; i++) W.step(1 / 60);
      const emits: any[] = []; let inPall = false; const pe = g.destr.pallEmit.bind(g.destr); g.destr.pallEmit = (...a: any[]) => { inPall = true; try { return pe(...a); } finally { inPall = false; } };
      g.smoke.emit = (e: any) => { emits.push({ ...e, pall: inPall }); };
      const of = (who: string) => g.guards.find((x: any) => x.callsign === who);
      for (const m of men) { const gd = of(m.who); if (!gd) return null; if (m.at) { gd.char.pos[0] = m.at[0]; gd.char.pos[2] = m.at[2]; } gd.dazzledUntil = 0; gd.staggerUntil = 0; }
      if (sam) { g.player.char.pos[0] = sam[0]; g.player.char.pos[2] = sam[2]; } g.player.dazzledUntil = 0;
      const w = wallAt(g, at, from); if (!w || !w.ok) return null;
      g.wallCharge.set.push({ wall: w, t: g.time, by: 'probe', paid: 0 }); const res: any = g.wallCharge.blow(g.wallCharge.set[g.wallCharge.set.length - 1]);
      const row = (who: string) => { const gd = of(who), p = gd.char.pos; return { who, dead: gd.state === 'dead', blind: Math.max(0, gd.dazzledUntil - g.time), folded: Math.max(0, gd.staggerUntil - g.time), room: g.cleared.roomAt(p), dist: Math.hypot(p[0] - w.u, p[2] - at[2]), state: gd.state as string }; };
      const rows = men.map(m => row(m.who)), samT = Math.max(0, g.player.dazzledUntil - g.time); let walked = -1, state = '';
      if (opt.watch) { const gd = of(opt.watch), p0 = [...gd.char.pos], until = gd.staggerUntil - 0.1; g.aiEnabled = true; walked = 0; while (g.time < until) { W.step(1 / 60); walked = Math.max(walked, Math.hypot(gd.char.pos[0] - p0[0], gd.char.pos[2] - p0[2])); } state = gd.state; }
      return { g, hole: !!res?.hole, walked, state, men: rows, sam: samT, pall: emits.filter(e => e.pall), rest: emits.filter(e => !e.pall), big: !!g.orders.big };
    } finally { console.log = log; } };
  const K = DOORTOOLS, S = WALLSHOT, roomM0: number = WALLSHOT.roomM;
  try {
    // (1) his first wall: the one man in the room, where his run had him, a line to the hole
    { const at: Vec3 = [12.7, 0, 7.0], from: Vec3 = [12.7, 0, 6.0], men: Man[] = [{ who: 'Tango 1', at: [13.6, 0, 9.8] }, { who: 'Tango 9', at: [12.7, 0, 8.4] }];
      const on = await shot(true, at, from, men), off = await shot(false, at, from, men);
      if (!on || !off) verdict(false, 'the long wall takes a charge where his first was set', 'no wall place or no such man there: the level changed, and this check needs its site again');
      else { const a = on.men[0], b = off.men[0], t = a.dist / K.stunM, wantOn = lerp(S.stunSecs[0], S.stunSecs[1], t), wantOff = lerp(K.stunSecs[0], K.stunSecs[1], t);
        verdict(on.hole && off.hole && !a.dead && !b.dead && near(a.folded, S.staggerSecs) && near(a.blind, wantOn, 0.1) && near(b.folded, K.staggerSecs) && near(b.blind, wantOff, 0.1) && a.folded > b.folded + 1 && a.blind > b.blind + 1 && a.state === b.state,
          'his first room: the man with a line to the hole is folded and blind longer with the rule on, by the table\'s own numbers; with it off he gets what he got in the run; he is no more hurt either way',
          `${f(a.dist)} m from the charge · rule on: folded ${f(a.folded)} s (the table ${S.staggerSecs}), blind ${f(a.blind)} s (${f(wantOn)}) · rule off: folded ${f(b.folded)} s (${K.staggerSecs}), blind ${f(b.blind)} s (${f(wantOff)}) · he is '${a.state}' / '${b.state}'`);
        const k1 = on.men[1], k0 = off.men[1];
        verdict(k1.dist < K.knockM && k1.dead && k0.dead, 'the reach that kills is as it was: a man with a line inside it, behind the wall when it goes, is killed with the rule on as with it off',
          `${f(k1.dist)} m from the charge (the reach ${K.knockM} m): dead ${k1.dead} / ${k0.dead} (rule on / off)`); } }
    // (1b) his second wall: the room's own furniture stands against its far face (no floor to the room map for a metre in), and one of its men, at his own
    //      post, has no line to the hole
    { const at: Vec3 = [19.2, 0, 7.0], from: Vec3 = [19.2, 0, 6.0], men: Man[] = [{ who: 'Tango 3' }, { who: 'Tango 2' }];
      const on = await shot(true, at, from, men, undefined, { watch: 'Tango 3' }), off = await shot(false, at, from, men);
      if (!on || !off) verdict(false, 'the long wall takes a charge where his second was set', 'no wall place or no such man there: the level changed, and this check needs its site again');
      else { const [c1, l1] = on.men, [c0, l0] = off.men;
        verdict(on.hole && off.hole && c1.room > 0 && c1.room === l1.room && near(c0.folded, 0) && near(c0.blind, 0) && near(c1.folded, S.staggerSecs) && near(c1.blind, 0) && near(l1.folded, S.staggerSecs) && near(l0.folded, K.staggerSecs) && on.walked >= 0 && on.walked < 0.05 && on.state !== 'patrol',
          'his second room, furniture against the wall\'s far face: the room is still named, and its man with no line to the hole, untouched with the rule off, is folded with it on — and with the game running on he stands rooted through it, alerted',
          `the man with no line ${f(c1.dist)} m off (room ${c1.room}): folded ${f(c1.folded)} s / ${f(c0.folded)} s, blind ${f(c1.blind)} s / ${f(c0.blind)} s (rule on / off) · the room's lined man: folded ${f(l1.folded)} s / ${f(l0.folded)} s · the game run on to the end of his fold: he moved ${f(on.walked)} m, '${on.state}'`); } }
    // (2) his third wall: a room with a corner the hole cannot see. A man there, a man with a line, a man in the next room, one of ours and the player beyond the wall
    { const at: Vec3 = [24.9, 0, 7.0], from: Vec3 = [24.9, 0, 6.0];
      const men: Man[] = [{ who: 'Tango 5', at: [26.2, 0, 9.8] }, { who: 'Tango 6', at: [22.25, 0, 10.75] }, { who: 'Tango 2', at: [20.3, 0, 9.8] }, { who: 'Blue Two', at: [25.6, 0, 9.4] }], sam: Vec3 = [24.4, 0, 9.6];
      // (the corner: found on the room as the blast leaves it — a floor cell of the lined man's room that no point of the hole's mouth sees, the nearest such)
      const scout = await shot(false, at, from, men.slice(0, 1)); let corner: Vec3 | null = null;
      if (scout?.hole) { const g = scout.g, nav = g.col.nav, room = scout.men[0].room, mouth: Vec3[] = [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2].flatMap(du => [0.45, 0.9].map(d => [at[0] + du, 1.1, 7.12 + d] as Vec3)); let best = 1e9;
        for (let z = 0; z < nav.H; z++) for (let x = 0; x < nav.W; x++) { const p: Vec3 = [(x + 0.5) * nav.cell, 0, (z + 0.5) * nav.cell], d = Math.hypot(p[0] - at[0], p[2] - at[2]);
          if (!room || g.cleared.roomAt(p) !== room || d < 2.6 || d >= best || !mouth.every(m => g.col.solidBlocked(m, [p[0], 1.1, p[2]]))) continue; best = d; corner = p; } }
      if (corner) men[1].at = corner;
      const on = corner ? await shot(true, at, from, men, sam) : null, off = corner ? await shot(false, at, from, men, sam) : null;
      if (!on || !off) verdict(false, 'the long wall takes a charge where his third was set, and its room has a corner the hole cannot see', `no wall place, no such man or no such corner there (a corner: ${!!corner}): the level changed, and this check needs its site again`);
      else { const [l1, c1, n1, o1] = on.men, [l0, c0, n0, o0] = off.men;
        verdict(on.hole && off.hole && c1.room === l1.room && c1.room > 0 && near(c0.folded, 0) && near(c0.blind, 0) && near(c1.folded, S.staggerSecs) && near(c1.blind, 0) && !c1.dead && c1.state === c0.state,
          'everyone in the room: a defender in the room with NO line to the hole, untouched with the rule off, is folded the table\'s seconds with it on — and not blinded (the flash needs the line), not hurt',
          `the corner man ${f(c1.dist)} m off, in room ${c1.room} with the lined man (room ${l1.room}) · rule off: folded ${f(c0.folded)} s, blind ${f(c0.blind)} s · rule on: folded ${f(c1.folded)} s (the table ${S.staggerSecs}), blind ${f(c1.blind)} s · he is '${c1.state}' / '${c0.state}'`);
        verdict(near(l1.folded, S.staggerSecs) && l1.blind > l0.blind + 1 && near(l0.folded, K.staggerSecs) && n1.room !== l1.room && near(n1.folded, 0) && near(n1.blind, 0) && near(n0.folded, 0) && near(n0.blind, 0),
          'the room and no further: the man with a line gets the longer numbers, and a man in the NEXT room is untouched with the rule on as with it off',
          `the lined man ${f(l1.dist)} m off: folded ${f(l1.folded)} s / ${f(l0.folded)} s, blind ${f(l1.blind)} s / ${f(l0.blind)} s (rule on / off) · the next room's man (room ${n1.room}, ${f(n1.dist)} m off): folded ${f(n1.folded)} s, blind ${f(n1.blind)} s with the rule on`);
        verdict(on.big && near(o1.blind, S.oursSecs) && near(o0.blind, K.backblastSecs) && near(o1.folded, 0) && near(on.sam, S.oursSecs) && near(off.sam, K.backblastSecs),
          'ours and the player the same: one of ours beyond the wall with a line is blind the same seconds as the player standing there, both by the table, and neither is folded',
          `one of ours ${f(o1.dist)} m off: blind ${f(o1.blind)} s / ${f(o0.blind)} s (rule on / off; the tables ${S.oursSecs} / ${K.backblastSecs}), folded ${f(o1.folded)} s · the player: blind ${f(on.sam)} s / ${f(off.sam)} s`);
        const short = await shot(true, at, from, men, sam, { tune: () => { WALLSHOT.roomM = Math.max(1, c1.dist - 1); } }), cs = short?.men[1]; WALLSHOT.roomM = roomM0;
        verdict(!!cs && c1.dist < roomM0 && near(cs.folded, 0) && near(short!.men[0].folded, S.staggerSecs), 'the room\'s shock has a reach: with the table\'s reach drawn in short of the corner man he is untouched again, the lined man folded as before',
          `the reach ${roomM0} m, the corner man ${f(c1.dist)} m off: folded ${f(c1.folded)} s · the reach set to ${f(Math.max(1, c1.dist - 1))} m: folded ${f(cs?.folded ?? -1)} s, the lined man ${f(short?.men[0].folded ?? -1)} s`);
        // (3) the pall: the same cloud asked at the table's share of its density, nothing else the blast asks of the solver changed
        const shape = (E: any[]) => JSON.stringify(E.map(e => [e.kind, +e.radius.toFixed(4), +e.ttl.toFixed(4), +e.speed.toFixed(4)])), dens = (E: any[]) => E.reduce((a, e) => a + e.density, 0);
        const ratio = off.pall.length ? Math.max(...on.pall.map((e: any, i: number) => Math.abs(e.density / off.pall[i].density - S.pall))) : 9, plain = (E: any[]) => JSON.stringify(E.map(e => [e.kind, e.radius, e.density, e.ttl]));
        verdict(off.pall.length >= 4 && on.pall.length === off.pall.length && shape(on.pall) === shape(off.pall) && ratio < 1e-6 && S.pall < 1 && S.pall >= 0.5 && plain(on.rest) === plain(off.rest),
          'the smoke: the charge\'s pall is the same puffs in the same places, each asked at the table\'s share of its density; the rest of what the blast asks of the solver (its own report) is unchanged',
          `${on.pall.length} pall emitters / ${off.pall.length} · each one's density ×${f(dens(on.pall) / Math.max(1e-9, dens(off.pall)))} of the rule-off one (the table ${S.pall}; CHAOS.pall.wall.density ${CHAOS.pall.wall.density} → ${f(CHAOS.pall.wall.density * S.pall)}) · the blast's other emitters ${on.rest.length} / ${off.rest.length}, the same ${plain(on.rest) === plain(off.rest)}`);
        // (4) the switch
        { WALLSHOT.on = true; const g = on.g, snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), has = typeof snap.tables?.WALLSHOT?.on === 'boolean'; const old = JSON.parse(JSON.stringify(snap)); delete old.tables.WALLSHOT;
          console.log = () => { }; let offOld = false; try { applyKnobs(g, old); offOld = WALLSHOT.on === false; applyKnobs(g, snap); offOld &&= WALLSHOT.on === true; } finally { console.log = log; }
          verdict(has && offOld && typeof FROZEN_HOLDS['WALLSHOT.on'] === 'string' && /TPS_WALLSHOT=1/.test(FROZEN_HOLDS['WALLSHOT.on']), 'a recording carries the switch, one from before the key replays with it off, and the frozen stand holds it off by name',
            `in the file ${has} · off for an old file ${offOld} · FROZEN_HOLDS ${FROZEN_HOLDS['WALLSHOT.on']}`); } } }
  } finally { knobsBack(knobs0); DESTRUCTION.on = destr0; console.log = log; }
  console.log(`=== wallshot: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
