// A WALL CHARGE KILLS WHOEVER STANDS AT IT — the check behind WALLKILL (src/game/wallcharge.ts; on in the page, ?wallkill=0; off in the module and on the
// frozen stand, TPS_WALLKILL=1).
//   bun run tools/qa/probes.ts wallkill        (family `wallcharge`)        WALLKILL_BREAK=1 = the rule off and the same lines asked: must FAIL
// the maintainer, 10-19, god mode off, 0.9 m from a charge he had set on a wall when he blew it — the log said 'you were too close' and he walked on:
// "blowing a wall charge with me right next to it should kill me". And his standing rule: a blast does to the player what it does to anyone.
// THE SITE: the mousehole's long wall by the floor point 12.7, 7.0, the charge set from the yard (the wall shot check's first site), each blast on a fresh
// stand with its room clear dealt. Headless: who is down and who is blind is the game's own state; the body thrown and the frame are the page's to show.
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
type Vec3 = [number, number, number];
export async function wallKillCheck(): Promise<boolean> {
  const BRK = process.env.WALLKILL_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== wallkill: a wall charge kills whoever stands at it${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`); const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { WALLCHARGE, WALLSHOT, WALLKILL, wallAt, wallPt, safeRadius } = await import(`${ROOT}/src/game/wallcharge.ts`); const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
  const { SAMSTUN } = await import(`${ROOT}/src/game/samstun.ts`); const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`); const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const knobs0 = knobsCopy(), destr0 = DESTRUCTION.on, log = console.log, data = readFileSync(`${ROOT}/levels/mousehole.json`, 'utf8');
  const raise = (rule: boolean) => { DESTRUCTION.on = true; WALLCHARGE.on = true; WALLCHARGE.outer = true; WALLCHARGE.safe = true; SAMSTUN.on = true; WALLSHOT.on = true; WALLKILL.on = rule && !BRK; };
  const f = (v: number) => v.toFixed(2), near = (a: number, b: number, e = 0.05) => Math.abs(a - b) <= e, lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
  const AT: Vec3 = [12.7, 0, 7.0], FROM: Vec3 = [12.7, 0, 6.0];
  type Man = { who: string; at: Vec3 };
  /** a charge on the wall, the named men and the player stood where asked first; blown as F blows it. Who is down, who is blind, and what the trigger's row
   *  said of them before it went. */
  const shot = async (rule: boolean, men: Man[], sam: Vec3, opt: { god?: boolean; team?: string; held?: boolean; plan?: boolean } = {}) => { raise(rule); console.log = () => { };
    try { const W: any = await standUp({ level: loadLevel(parseLevelData(data)), seed: 1 }); raise(rule); const g = W.game; g.tune.chaos = opt.held ? 0 : 0.5;   // (chaos 0: the engine opens no wall — the charge goes off and the wall holds)
      await startFromQuery(g, new URLSearchParams(opt.team ?? 'roomclear&squad4')); raise(rule); g.aiEnabled = false; g.godMode = !!opt.god; for (let i = 0; i < 4; i++) W.step(1 / 60);
      const of = (who: string) => g.guards.find((x: any) => x.callsign === who), pl = g.player;
      // (everybody the line does not name stands off the map: nobody wanders into the blast)
      g.guards.forEach((gd: any, i: number) => { if (!men.some(m => m.who === gd.callsign)) { gd.char.pos[0] += 300 + i; } });
      for (const m of men) { const gd = of(m.who); if (!gd) return null; gd.char.pos[0] = m.at[0]; gd.char.pos[2] = m.at[2]; gd.dazzledUntil = 0; gd.staggerUntil = 0; }
      pl.char.pos[0] = sam[0]; pl.char.pos[2] = sam[2]; pl.dazzledUntil = 0; pl.fireCd = 0;
      const w = wallAt(g, AT, FROM); if (!w || !w.ok) return null;
      const c0w = wallPt(w, 0, 0), d0 = new Map(men.map(m => [m.who, Math.hypot(m.at[0] - c0w[0], m.at[2] - c0w[2])])), dS = Math.hypot(sam[0] - c0w[0], sam[2] - c0w[2]);   // (from the charge's own place on the wall, as the blast measures — and where each stood as it went: a body is thrown)
      const c = { wall: w, t: g.time, by: 'probe', paid: 0 }; g.wallCharge.set.push(c); const hits0 = pl.hitsLeft, warned: string[] = [...g.wallCharge.tooClose(c), ...g.wallCharge.behind(c)];
      const res: any = opt.plan ? g.wallCharge.blow(c, false) : g.wallCharge.blow(c), R = safeRadius(g, w), last = { ...g.wallCharge.lastBlow };
      const row = (who: string) => { const gd = of(who); return { who, team: gd.team as string, dead: gd.state === 'dead', kind: gd.downKind as string | null, blind: Math.max(0, gd.dazzledUntil - g.time), folded: Math.max(0, gd.staggerUntil - g.time), dist: d0.get(who)! }; };
      const out = { g, hole: !!res?.hole, res, reach: R.reach as number, men: men.map(m => row(m.who)), big: !!g.orders.big, warned, said: g.messages.slice(-2).map((m: any) => m.text as string).join(' / '),
        sam: { down: !!pl.down, hits: pl.hitsLeft as number, hits0, blind: Math.max(0, pl.dazzledUntil - g.time), cd: pl.fireCd as number, dist: dS, last }, later: true };
      for (let i = 0; i < 45; i++) W.step(1 / 60);   // (the game runs on over whoever it put down: nothing throws, and three quarters of a second on the down are down)
      out.later = out.sam.down === !!pl.down && out.men.every(m => m.dead === (of(m.who).state === 'dead'));
      return out;
    } finally { console.log = log; } };
  const K = DOORTOOLS, nearM: number = WALLKILL.nearM, CLEAR: Vec3 = [5.0, 0, 3.0];
  const nearSecs = (dist: number, reach: number) => lerp(WALLCHARGE.safeSecs[0], WALLCHARGE.safeSecs[1], dist / reach);
  try {
    // (1) his run: the player 0.9 m from the charge on its own side, god mode off
    { const sam: Vec3 = [12.7 + 0.37, 0, 7.0 - 0.9];
      const on = await shot(true, [], sam), off = await shot(false, [], sam), god = await shot(true, [], sam, { god: true });
      if (!on || !off || !god) verdict(false, 'the long wall takes a charge where the wall shot check sets its first', 'no wall place there: the level changed, and this check needs its site again');
      else {
        verdict(on.sam.dist < nearM && on.sam.down && on.sam.hits === 0 && on.sam.last.samDown === true && on.later && !off.sam.down && off.sam.hits === off.sam.hits0 && off.sam.cd > 0 && /you were too close/.test(off.said) && !/too close/.test(on.said) && on.warned.includes('you') && on.hole && off.hole,
          'his run: the player right at his own charge when it goes is killed; with the rule off he is rocked and told he was too close, as he was in the run; the trigger\'s row named him before it went',
          `${f(on.sam.dist)} m from the charge (the reach that kills on its own side ${nearM} m) · rule on: down ${on.sam.down} · rule off: down ${off.sam.down}, no round for ${f(off.sam.cd)} s, blind ${f(off.sam.blind)} s, the log '${off.said}' · warned: ${on.warned.join(', ') || 'nobody'} · the log, rule on: '${on.said}' · still down three quarters of a second on ${on.later}`);
        verdict(!god.sam.down && god.sam.hits === god.sam.hits0 && god.sam.cd > 0 && near(god.sam.blind, off.sam.blind), 'god mode keeps him up, the rule on: he is rocked and blind as a living man there is',
          `down ${god.sam.down} · no round for ${f(god.sam.cd)} s · blind ${f(god.sam.blind)} s (rule off ${f(off.sam.blind)} s)`); } }
    // (2) a step and a half back he lives, and gets what he got
    { const sam: Vec3 = [12.7, 0, 7.0 - (nearM + 0.5)]; const on = await shot(true, [], sam), off = await shot(false, [], sam);
      if (!on || !off) verdict(false, 'the same wall, the player further back', 'no wall place there');
      else verdict(on.sam.dist >= nearM && on.sam.dist < on.reach && !on.sam.down && near(on.sam.blind, off.sam.blind) && near(on.sam.cd, off.sam.cd) && near(on.sam.blind, nearSecs(on.sam.dist, on.reach), 0.1),
        'past that reach and inside the safety radius the player lives: blind the seconds the radius gives a man there and rocked, the rule on as off',
        `${f(on.sam.dist)} m from the charge (kills inside ${nearM} m, the radius ${on.reach} m) · down ${on.sam.down} / ${off.sam.down} · blind ${f(on.sam.blind)} s / ${f(off.sam.blind)} s (the radius's ${f(nearSecs(on.sam.dist, on.reach))} s) · no round ${f(on.sam.cd)} s / ${f(off.sam.cd)} s`); }
    // (3) what it does to the player it does to anyone: one of ours and a defender at the charge, one of ours a step and a half back
    { const men: Man[] = [{ who: 'Red One', at: [12.7 - 0.5, 0, 7.0 - 0.8] }, { who: 'Tango 1', at: [12.7 + 0.6, 0, 7.0 - 0.9] }, { who: 'Red Two', at: [12.7, 0, 7.0 - (nearM + 0.6)] }];
      const on = await shot(true, men, CLEAR), off = await shot(false, men, CLEAR);
      if (!on || !off) verdict(false, 'the same wall, three men staged on the charge\'s side', 'no wall place or no such men: the level changed');
      else { const [a, b, c] = on.men, [a0, b0, c0] = off.men;
        verdict(a.team === 'operative' && b.team !== 'operative' && a.dist < nearM && b.dist < nearM && a.dead && b.dead && a.kind === 'shot' && b.kind === 'shot' && on.later && !a0.dead && !b0.dead && a0.blind > 0 && b0.blind > 0 && on.res.lost === 1 && on.sam.last.lost === 1 && off.res.lost === 0 && on.warned.includes('Red One'),
          'anyone: one of ours and a defender standing at the charge are killed with the rule on, as the player is — dead, not out cold; with it off both are blind and up; the row named ours before it went',
          `${a.who} ${f(a.dist)} m: dead ${a.dead} / ${a0.dead} (rule on / off; went down '${a.kind}'), blind off ${f(a0.blind)} s · ${b.who} ${f(b.dist)} m: dead ${b.dead} / ${b0.dead} ('${b.kind}'), blind off ${f(b0.blind)} s · ours it killed, by the blast's own count: ${on.res.lost} / ${off.res.lost} · warned: ${on.warned.join(', ')}`);
        verdict(c.dist >= nearM && !c.dead && !c0.dead && near(c.blind, c0.blind) && c.blind > 0 && !on.sam.down && on.sam.blind === 0,
          'one of ours a step and a half back is blind as he was and no worse, and the player clear of the radius feels nothing',
          `${c.who} ${f(c.dist)} m: dead ${c.dead} / ${c0.dead}, blind ${f(c.blind)} s / ${f(c0.blind)} s · the player ${f(on.sam.dist)} m off: down ${on.sam.down}, blind ${f(on.sam.blind)} s`); } }
    // (4) behind the wall it opens: the player and one of ours inside the reach that always killed a defender there; one of ours past it
    { const men: Man[] = [{ who: 'Red One', at: [12.7 + 0.5, 0, 8.3] }, { who: 'Tango 1', at: [12.7 - 0.6, 0, 8.4] }, { who: 'Red Two', at: [13.6, 0, 9.8] }], sam: Vec3 = [12.7, 0, 8.4];
      const on = await shot(true, men, sam), off = await shot(false, men, sam);
      if (!on || !off) verdict(false, 'the same wall, men staged in the room behind it', 'no wall place or no such men: the level changed');
      else { const [a, b, c] = on.men, [a0, b0, c0] = off.men;
        verdict(on.hole && on.big && a.dist < K.knockM && b.dist < K.knockM && on.sam.dist < K.knockM && on.sam.down && a.dead && b.dead && b0.dead && a.kind === b.kind && b.kind === b0.kind && on.later && !a0.dead && !off.sam.down && a0.blind > 0 && off.sam.blind > 0 && on.warned.includes('you') && on.warned.includes('Red One'),
          'behind the wall, inside the reach that puts a defender there down: the player and one of ours go down with him with the rule on, ours by the same knock as his; with it off the defender alone did, ours and the player blind; the row named both before it went',
          `the reach ${K.knockM} m · the player ${f(on.sam.dist)} m: down ${on.sam.down} / ${off.sam.down} (rule on / off) · ${a.who} ${f(a.dist)} m: down ${a.dead} / ${a0.dead} ('${a.kind}') · ${b.who} ${f(b.dist)} m: down ${b.dead} / ${b0.dead} ('${b.kind}' / '${b0.kind}') · warned: ${on.warned.join(', ')}`);
        verdict(c.dist >= K.knockM && !c.dead && !c0.dead && near(c.blind, WALLSHOT.oursSecs) && near(c0.blind, WALLSHOT.oursSecs) && c.folded === 0,
          'past that reach one of ours behind the wall is blind as one of ours and not folded, the rule on as off (a team of four)',
          `${c.who} ${f(c.dist)} m: blind ${f(c.blind)} s / ${f(c0.blind)} s (the table ${WALLSHOT.oursSecs}), folded ${f(c.folded)} s`); } }
    // (4b) a wall that held is still a wall: the man behind it lives, the man at the charge does not
    { const men: Man[] = [{ who: 'Red One', at: [12.7 - 0.5, 0, 7.0 - 0.8] }, { who: 'Red Two', at: [12.7 + 0.5, 0, 8.3] }], sam: Vec3 = [12.7, 0, 8.4]; const on = await shot(true, men, sam, { held: true });
      if (!on) verdict(false, 'the same wall, with the engine told to open nothing', 'no wall place or no such men');
      else verdict(!on.hole && !on.sam.down && !on.men[1].dead && on.men[0].dead, 'a wall that held: the player and one of ours behind it are untouched, the rule on; one of ours at the charge on its own side is killed all the same',
        `a hole ${on.hole} · the player behind it ${f(on.sam.dist)} m: down ${on.sam.down} · ${on.men[1].who} behind it ${f(on.men[1].dist)} m: dead ${on.men[1].dead} · ${on.men[0].who} at the charge ${f(on.men[0].dist)} m: dead ${on.men[0].dead}`); }
    // (4c) a plan's own clock is no press of the player's: its blast is the blast as it was
    { const men: Man[] = [{ who: 'Red One', at: [12.7 - 0.5, 0, 7.0 - 0.8] }], sam: Vec3 = [12.7 + 0.37, 0, 7.0 - 0.9]; const on = await shot(true, men, sam, { plan: true }), prs = await shot(true, men, sam);
      if (!on || !prs) verdict(false, 'the same wall, blown as a plan\'s clock blows it', 'no wall place or no such men');
      else verdict(!on.sam.down && !on.men[0].dead && on.men[0].blind > 0 && on.sam.cd > 0 && prs.sam.down && prs.men[0].dead, 'blown by a plan\'s own clock (no press of the player\'s) the charge does what it did: the player and the man at it are rocked and blind, up; the same two under his own press are killed',
        `the plan's clock: the player down ${on.sam.down}, ${on.men[0].who} dead ${on.men[0].dead} (blind ${f(on.men[0].blind)} s) · his press: down ${prs.sam.down}, dead ${prs.men[0].dead}`); }
    // (5) a team of two: its one man behind the wall, past the reach that kills, is one of ours too
    { const team = 'roomclear', probe = await shot(true, [], CLEAR, { team }), mate = probe?.g.guards.find((x: any) => x.team === 'operative')?.callsign as string | undefined;
      const men: Man[] = mate ? [{ who: mate, at: [13.6, 0, 9.8] }] : [], on = mate ? await shot(true, men, CLEAR, { team }) : null, off = mate ? await shot(false, men, CLEAR, { team }) : null;
      if (!on || !off) verdict(false, 'the room clear deals a team of two on this level', `no teammate found (${mate ?? 'none'})`);
      else { const a = on.men[0], a0 = off.men[0];
        verdict(!on.big && a.dist >= K.knockM && !a.dead && near(a.blind, WALLSHOT.oursSecs) && a.folded === 0 && a0.blind > WALLSHOT.oursSecs + 1 && a0.folded > 0,
          'a team of two: its man behind the wall past the reach that kills is blind as one of ours and not folded; with the rule off he took a defender\'s stun and fold',
          `${a.who} ${f(a.dist)} m, a team of more than two ${on.big}: blind ${f(a.blind)} s / ${f(a0.blind)} s (rule on / off; ours ${WALLSHOT.oursSecs}), folded ${f(a.folded)} s / ${f(a0.folded)} s`); }
      // (6) the switch
      if (on) { WALLKILL.on = true; const g = on.g, snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), has = typeof snap.tables?.WALLKILL?.on === 'boolean'; const old = JSON.parse(JSON.stringify(snap)); delete old.tables.WALLKILL;
        console.log = () => { }; let offOld = false; try { applyKnobs(g, old); offOld = WALLKILL.on === false; applyKnobs(g, snap); offOld &&= WALLKILL.on === true; } finally { console.log = log; }
        verdict(has && offOld && typeof FROZEN_HOLDS['WALLKILL.on'] === 'string' && /TPS_WALLKILL=1/.test(FROZEN_HOLDS['WALLKILL.on']), 'a recording carries the switch, one from before the key replays with it off, and the frozen stand holds it off by name',
          `in the file ${has} · off for an old file ${offOld} · FROZEN_HOLDS ${FROZEN_HOLDS['WALLKILL.on']}`); } }
  } finally { knobsBack(knobs0); DESTRUCTION.on = destr0; console.log = log; }
  console.log(`=== wallkill: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
