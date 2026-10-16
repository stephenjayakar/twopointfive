// A HOLD READS AS ONE HOLD THROUGH A TURN — the check behind HOLD.oneFacing (src/game/character.ts HOLD; the rule is one clause in nightbreach.ts; on in the page,
// ?holdyaw=0; off in the module and on the frozen stand, TPS_HOLDYAW=1).
//   bun run tools/qa/probes.ts holdturn        (family `grab`)        HOLDTURN_BREAK=1 = the rule off and the same lines asked: must FAIL
// the maintainer, 10-15, of a man in his arm on the pass: "weird pose after rotating after grabbing someone". Measured: with the room fight owning the defenders the pair
// is rigid through any turn (his place 0.27 m ahead, his chest on Sam's facing to the degree); where it does NOT own them (the room fight's switch off, the
// sandbox's AI off, a director run) the night mission turned every calm defender to his mark each frame — the man in the arm too, after the hold had placed
// him: his feet followed Sam and his chest stayed on the mark, up to half a circle off.
// THE STAGING: the pass, `roomclear&squad4&difficulty=hard` as he opened it, a calm defender taken from behind, the cursor walked a half circle round the pair
// in three seconds each way (the page's own input road), then a fast flick back.
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
type V = [number, number, number];
const DT = 1 / 60, DEG = 180 / Math.PI;
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export async function holdTurnCheck(): Promise<boolean> {
  const BRK = process.env.HOLDTURN_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== holdturn: a hold reads as one hold through a turn${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`); const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`); const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
  const { HOLD } = await import(`${ROOT}/src/game/character.ts`); const { ROOMFIGHT } = await import(`${ROOT}/src/game/roomfight.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const was = { f: HOLD.oneFacing, r: ROOMFIGHT.on }, log = console.log, data = readFileSync(`${ROOT}/levels/pass.json`, 'utf8');
  /** one hold turned through a half circle each way and a flick; `owned` = the room fight owns the defenders (its switch on) */
  const turn = async (rule: boolean, owned: boolean) => {
    HOLD.oneFacing = rule; ROOMFIGHT.on = owned; console.log = () => { };
    try {
      const W: any = await standUp({ level: loadLevel(parseLevelData(data)), seed: 1 }); HOLD.oneFacing = rule; ROOMFIGHT.on = owned; const g = W.game; g.godMode = true;
      startFromQuery(g, '?levelFile=pass.json&roomclear&squad4&difficulty=hard');
      for (let i = 0; i < 30; i++) { g.player.visibility = 0.05; W.step(DT); }
      const gd = g.guards.filter((x: any) => x.team === 'hostile')[0], hc = gd.char, pl = g.player, c = pl.char;
      for (const o of g.guards) if (o !== gd) { o.hold = true; o.pinned = true; o.heardUpTo = 1e12; }
      const y0 = hc.bodyYaw; g.teleportPlayer([hc.pos[0] - Math.sin(y0) * 0.8, 0, hc.pos[2] - Math.cos(y0) * 0.8]); pl.slot = 'pistol'; pl.holstered = true; c.bodyYaw = c.aimYaw = y0;
      let ang = y0; const step = () => { W.cursorAt([c.pos[0] + Math.sin(ang) * 3, 0, c.pos[2] + Math.cos(ang) * 3]); pl.visibility = 0.05; W.step(DT); };
      step(); step(); const calm = gd.state === 'patrol' && gd.awareness < 0.3; startGrab(g, gd);
      for (let i = 0; i < 150 && pl.holding; i++) step();
      let dyaw = 0, lat = 0, fwd = 0, turned = 0, held = !!pl.holding; const s0 = c.bodyYaw;
      const run = (secs: number, to: number) => { const a0 = ang, n = Math.round(secs / DT); for (let i = 1; i <= n && pl.holding; i++) { ang = a0 + to * (i / n); step();
        const dx = hc.pos[0] - c.pos[0], dz = hc.pos[2] - c.pos[2], s = Math.sin(c.bodyYaw), k = Math.cos(c.bodyYaw);
        dyaw = Math.max(dyaw, Math.abs(wrap(hc.bodyYaw - c.bodyYaw)) * DEG); lat = Math.max(lat, Math.abs(dx * k - dz * s)); fwd = Math.max(fwd, Math.abs(dx * s + dz * k - HOLD.dist)); turned = Math.max(turned, Math.abs(wrap(c.bodyYaw - s0)) * DEG); } };
      run(3, Math.PI * 0.95); run(1.5, 0); run(3, -Math.PI * 1.9); run(1.5, 0); run(0.2, Math.PI * 0.9); run(2, 0);
      return { g, calm, held: held && !!pl.holding, own: !!g.fight?.on, dyaw, lat, fwd, turned, who: gd.callsign as string };
    } finally { console.log = log; }
  };
  const line = (R: any) => `${R.who}, calm ${R.calm}, the room fight owns him ${R.own}: Sam turned ${R.turned.toFixed(0)}° · his chest off Sam's facing by at most ${R.dyaw.toFixed(1)}° · his place off by ${R.lat.toFixed(3)} m sideways, ${R.fwd.toFixed(3)} m along`;
  try {
    const rule = !BRK;
    const off = await turn(false, false);
    verdict(off.calm && off.held && !off.own && off.turned > 120 && off.dyaw > 60, 'staging, the rule off, the room fight not owning the defenders: the held man\'s chest stays on his mark while Sam turns (the fault)', line(off));
    const on = await turn(rule, false);
    verdict(on.calm && on.held && !on.own && on.turned > 120 && on.dyaw < 2 && on.lat < 0.02 && on.fwd < 0.02, 'the rule on: he turns with Sam — chest on Sam\'s facing, 0.27 m ahead, through a half circle each way and a flick', line(on));
    const own = await turn(rule, true), own0 = await turn(false, true);
    verdict(own.held && own.own && own.turned > 120 && own.dyaw < 2 && own.lat < 0.02 && own0.dyaw < 2 && Math.abs(own.dyaw - own0.dyaw) < 1e-9 && Math.abs(own.lat - own0.lat) < 1e-9,
      'as he played it (the room fight owning the defenders): one hold through the turn, and the rule changes nothing there', `${line(own)} · with the rule off the same to the last digit: ${Math.abs(own.dyaw - own0.dyaw) < 1e-9}`);
    { HOLD.oneFacing = true; const snap = JSON.parse(JSON.stringify(knobsSnapshot(on.g))), has = typeof snap.tables?.HOLD?.oneFacing === 'boolean';
      const old = JSON.parse(JSON.stringify(snap)); delete old.tables.HOLD.oneFacing; console.log = () => { }; let oldOff = false, newOn = false;
      try { applyKnobs(on.g, old); oldOff = HOLD.oneFacing === false; applyKnobs(on.g, snap); newOn = HOLD.oneFacing === true; } finally { console.log = log; }
      verdict(has && oldOff && newOn && FROZEN_HOLDS['HOLD.oneFacing'] === 'TPS_HOLDYAW=1', 'the switch rides the journal (a recording from before the key replays with it off) and has its row on the stands\' list',
        `in the journal's tables ${has} · a recording without the key → ${oldOff ? 'off' : 'ON'} · one with it on → ${newOn ? 'on' : 'OFF'} · FROZEN_HOLDS row ${FROZEN_HOLDS['HOLD.oneFacing'] ?? 'missing'}`); }
  } finally { console.log = log; HOLD.oneFacing = was.f; ROOMFIGHT.on = was.r; }
  console.log(`=== holdturn: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) { const ok = await holdTurnCheck(); (globalThis as any).process.exit(ok ? 0 : 1); }
