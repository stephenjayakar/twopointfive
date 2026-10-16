// Three door rules from the 10-11 play notes on barricaded doors, each behind its own switch (on in the page, off on the frozen stand):
//   DOORTOOLS.testDoor      an entry order HALTS at a door that turns out locked or wedged — the lead tries the handle, says what he found, the men stay
//                           stacked — and the same row again (worded 'kick and clear · …' from then on) boots it; a plain 'stack up' tries the handle too
//   DOORWAY.sideKick        a boot is thrown from beside the latch jamb: the squad's lead, and the player when he stands there
//   DOORTOOLS.outsidePlain  'clear from outside' is ONE order on the door tools' row 4 (hold the door from outside); going in is a second order — rows 1 / 2
//                           of the same page — with one can at most
//   bun run tools/qa/doortest-check.ts            (probes.ts doortest; DOORTEST_BREAK=1 must FAIL — the halt's switch is left off where it is asked for)
// Headless, everything given by KEYS (X on the door, one-frame digits) on thresholdmenu-probes.ts's rig: the office room clear with the four and with the
// pair, the defenders taken off the floor so that a door's own story is all that plays. Each line stages afresh. Nothing here says how any of it LOOKS.
import { ROOT } from './headless.ts';
import { stage, spotOf, quiet, guarded, family, rowsOf, textOf } from './thresholdmenu-probes.ts';
const { DOORTOOLS, TOOLS_PAGE } = await import(`${ROOT}/src/game/doortools.ts`);
const { DOORWAY, SIDE_KICK } = await import(`${ROOT}/src/game/doors.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const CBM = await import(`${ROOT}/src/game/combat.ts`);
const PL = await import(`${ROOT}/src/game/player.ts`);

const BREAK = !!process.env.DOORTEST_BREAK;
const alongOf = (d: any, p: number[]) => { const th = d.def.closedDir; return (p[0] - d.def.hinge[0]) * Math.cos(th) + (p[2] - d.def.hinge[1]) * Math.sin(th); };
const offOf = (d: any, p: number[], side: number) => { const th = d.def.closedDir; return (Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0])) * side; };

interface Knobs { test?: boolean; side?: boolean; plain?: boolean }
/** a scenario staged with the commander on his spot, the cursor on the door, the defenders off the floor, every line anybody says kept */
async function rig(E: any, spot: any, K: Knobs, lock: 'wedge' | 'none') {
  const R = await stage(E, 1), g = R.g, d = g.doors.byName(spot.door);
  DOORTOOLS.testDoor = !!K.test; DOORWAY.sideKick = !!K.side; DOORTOOLS.outsidePlain = !!K.plain;   // (after the stand-up: the frozen stand pins all three off)
  for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile') await quiet(() => CBM.killGuard(g, x, [0, 0, 1], true));
  const said: string[] = []; const say0 = g.say.bind(g); g.say = (gd: any, text: string, radio = false) => { said.push(`${gd.callsign}: ${text}`); return say0(gd, text, radio); };
  const on = await quiet(() => R.place(spot.sam, d)); if (!on) throw new Error(`${E.id}: X does not open on ${spot.door} from the spot`);
  const side = g.orders.targetUnder(R.input, R.W.cam, R.W.canvas).side as 1 | -1;
  if (lock === 'wedge') {   // digin.ts wedge(), by hand: locked against the team's face (keySide = the face it will not open from), to a lock no ring fits
    d.keySide = g.doors.side(d, spot.sam); d.lockId = `wedge:${d.def.name}`; d.locked = true; d.pick = 0; }
  else d.locked = false;
  const keys = async (...ks: (number | 'X' | 'F')[]) => { await quiet(() => { for (const k of ks) { if (k === 'X') R.openX(); else if (k === 'F') { R.press('KeyF'); R.step(2); } else R.digit(k); } }); };
  const opsOn = () => R.D.ops.filter((o: any) => o.door === d);
  const run = async (secs: number, until: () => boolean) => quiet(() => R.until(until, secs));
  const across = () => R.team.filter((m: any) => m.state !== 'dead' && offOf(d, m.char.pos, side) < -0.15);
  return { R, g, d, side, said, keys, opsOn, run, across };
}
const shut = (d: any) => !d.off && d.latched && Math.abs(d.angle) < 0.05;

export const doortestCheck = guarded(async () => {
  const F = family('doortest: a door found shut halts the order · a kick from beside the door · clear from outside is one order');
  const keep = { t: DOORTOOLS.testDoor, s: DOORWAY.sideKick, p: DOORTOOLS.outsidePlain };
  try {
    for (const id of ['room-clear-four', 'room-clear-pair']) {
      const E = SCENARIOS.find((s: any) => s.id === id); DOORTOOLS.testDoor = false; DOORWAY.sideKick = false; DOORTOOLS.outsidePlain = false;
      const spot = await spotOf(E); if (typeof spot === 'string') { F.verdict(false, `${id}: a door to give the orders on`, spot); continue; }
      const W = (d: any) => d.def.width as number;

      // ---- 1. an entry order at a door nobody knew was wedged: halted, said, nothing booted, the men left stacked
      { const T = await rig(E, spot, { test: !BREAK }, 'wedge'); await T.keys('X', 5, 1); await T.run(3, () => T.opsOn().length > 0); await T.run(40, () => T.opsOn().length === 0);
        const st = T.R.D.stats, men = T.R.team.filter((m: any) => m.state !== 'dead'), stacked = men.filter((m: any) => T.R.O.of(m)?.order === 'stack' && T.R.O.of(m)?.door === T.d);
        const line = T.said.find(s => /wedged from inside\. holding on it/.test(s));
        F.verdict(st.halted === 1 && st.kicks === 0 && shut(T.d) && !T.d.lockBroken && !!line && stacked.length === men.length && T.across().length === 0,
          `${id}: 'open and clear' at a door nobody knew was wedged stops at the handle`,
          `halted ${st.halted} · boots ${st.kicks} · the door ${shut(T.d) ? 'still shut' : 'OPEN'} · said: ${line ?? '(nothing)'} · ${stacked.length} of ${men.length} left stacked on it · ${T.across().length} across the frame`);
        // ---- 2. the menu then says so, and the same row boots it
        await T.keys('X', 5); const pg = T.R.read(), r1 = pg?.rows.find((r: any) => r.id === 'openClear'), r2 = pg?.rows.find((r: any) => r.id === 'bangClear');
        const worded = /^kick and clear · wedged from inside$/.test(r1?.text ?? '') && /^kick, bang and clear · \d+ left$/.test(r2?.text ?? '');
        await T.keys(1); await T.run(3, () => T.opsOn().length > 0); await T.run(25, () => !shut(T.d));
        F.verdict(BREAK || (worded && T.R.D.stats.kicks === 1 && T.R.D.stats.halted === 1 && !shut(T.d)),
          `${id}: the door's tools then read 'kick and clear', and that row boots it`,
          `rows: ${textOf(pg)} · after 1: boots ${T.R.D.stats.kicks} · halted ${T.R.D.stats.halted} · the door ${shut(T.d) ? 'STILL SHUT' : 'open'}`);
      }
      // ---- 3. a plain stack tries the handle: the lead says it, and the entry after it is not halted
      { const T = await rig(E, spot, { test: true }, 'wedge'); await T.keys('X', 1); await T.run(30, () => T.R.D.stats.tested > 0);
        const line = T.said.find(s => /: wedged from inside\.$/.test(s)), known = T.R.D.knownShut(T.d, T.side);
        await T.keys('X', 5, 1); await T.run(3, () => T.opsOn().length > 0); await T.run(25, () => !shut(T.d));
        F.verdict(!!line && known && T.R.D.stats.halted === 0 && T.R.D.stats.kicks === 1 && !shut(T.d),
          `${id}: 'stack up' tries the handle — the lead reports the wedge, and the entry order after it goes straight to the boot`,
          `tried ${T.R.D.stats.tested} · said: ${line ?? '(nothing)'} · known ${known} · then: halted ${T.R.D.stats.halted} · boots ${T.R.D.stats.kicks} · the door ${shut(T.d) ? 'STILL SHUT' : 'open'}`);
      }
      // ---- 4. a door that is not locked: the stack says so once, the entry opens it by hand
      { const T = await rig(E, spot, { test: true }, 'none'); await T.keys('X', 1); await T.run(30, () => T.R.D.stats.tested > 0); await T.run(2, () => false);
        const n = T.said.filter(s => /it's not locked\./.test(s)).length;
        await T.keys('X', 5); const r1 = T.R.read()?.rows.find((r: any) => r.id === 'openClear');
        await T.keys(1); await T.run(3, () => T.opsOn().length > 0); await T.run(25, () => !shut(T.d));
        F.verdict(n === 1 && r1?.text === 'open and clear' && T.R.D.stats.halted === 0 && T.R.D.stats.kicks === 0 && !shut(T.d),
          `${id}: an unlocked door — 'it's not locked.' once, the row reads as ever, the entry opens it by hand`,
          `said ${n} time(s) · row 1 '${r1?.text}' · halted ${T.R.D.stats.halted} · boots ${T.R.D.stats.kicks} · the door ${shut(T.d) ? 'STILL SHUT' : 'open'}`);
      }
      // ---- 5. the switch off, and an order given by code with it on: straight to the boot, as it was
      { const A = await rig(E, spot, { test: false }, 'wedge'); await A.keys('X', 5, 1); await A.run(3, () => A.opsOn().length > 0); await A.run(30, () => !shut(A.d));
        const B = await rig(E, spot, { test: true }, 'wedge'); const op = await quiet(() => B.R.D.order('openClear', B.R.team, B.d, B.side)); await B.run(30, () => !shut(B.d));
        F.verdict(A.R.D.stats.halted === 0 && A.R.D.stats.kicks === 1 && !shut(A.d) && typeof op !== 'string' && B.R.D.stats.halted === 0 && B.R.D.stats.kicks === 1 && !shut(B.d),
          `${id}: switch off, or the order given by code (a scenario's own entry): no halt, the boot as it was`,
          `off: halted ${A.R.D.stats.halted} · boots ${A.R.D.stats.kicks} · ${shut(A.d) ? 'STILL SHUT' : 'open'} | by code: ${typeof op === 'string' ? `refused (${op})` : `halted ${B.R.D.stats.halted} · boots ${B.R.D.stats.kicks} · ${shut(B.d) ? 'STILL SHUT' : 'open'}`}`);
      }
      // ---- 6. the squad's boot from beside the door: out of the opening on the frame the leaf goes; off = square to the leaf
      { const where = async (sideKick: boolean) => { const T = await rig(E, spot, { side: sideKick }, 'wedge'); await T.keys('X', 5, 1);
          let at: number[] | null = null; await T.run(30, () => { if (!at && T.R.D.stats.kicks > 0) { const op = T.opsOn()[0] ?? T.R.D.done[T.R.D.done.length - 1]; at = [...(op?.lead?.char.pos ?? [NaN, 0, NaN])]; } return !!at; });
          return { T, at: at as number[] | null }; };
        const on = await where(true), off = await where(false);
        const aOn = on.at ? alongOf(on.T.d, on.at) : NaN, aOff = off.at ? alongOf(off.T.d, off.at) : NaN, w = W(on.T.d);
        F.verdict(aOn > w && aOn < w + SIDE_KICK.past + 0.45 && !shut(on.T.d) && aOff > w * 0.5 - 0.3 && aOff < w - 0.05 && !shut(off.T.d),
          `${id}: the lead boots a wedged door from beside its latch jamb — out of the opening — and it gives; switch off = from in front of the leaf`,
          `leaf ${w.toFixed(2)} m · on: the kicker ${aOn.toFixed(2)} m along from the hinge, ${on.at ? offOf(on.T.d, on.at, on.T.side).toFixed(2) : '?'} m off the frame, door ${shut(on.T.d) ? 'STILL SHUT' : 'open'} · off: ${aOff.toFixed(2)} m along, door ${shut(off.T.d) ? 'STILL SHUT' : 'open'}`);
      }
      // ---- 7. clear from outside: one row, one order; the jambs held; rows 1 / 2 are then the order to go in; one can at most
      { const T = await rig(E, spot, { plain: true }, 'none'); await T.keys('X', 5); const pg = T.R.read();
        const r4 = pg?.rows.find((r: any) => r.key === '4');
        await T.keys(4); const held = await T.run(40, () => T.opsOn().some((o: any) => o.kind === 'threshold' && o.phase === 'thr'));
        const none = T.across().length, bangs0 = T.R.D.bangs;
        await T.keys('X'); const first = T.R.read(), r5 = first?.rows.find((r: any) => r.key === '5');
        await T.keys(5); const pg2 = T.R.read(), g1 = pg2?.rows.find((r: any) => r.id === 'openClear'), g2 = pg2?.rows.find((r: any) => r.id === 'bangClear'), g4 = pg2?.rows.find((r: any) => r.id === 'thresholdHold');
        await T.keys(1); const went = await T.run(25, () => T.across().length > 0);
        F.verdict(r4?.id === 'thresholdHold' && r4?.text === 'clear from outside' && !pg?.rows.some((r: any) => r.opens && r.id !== TOOLS_PAGE) && held && none === 0
            && r5?.id === TOOLS_PAGE && g1?.text === 'go in and clear · no bang' && /^bang, then go in · \d+ left$/.test(g2?.text ?? '') && !!g4?.off && went && T.R.D.bangs === bangs0,
          `${id}: row 4 of the door tools is 'clear from outside', one order: they hold the door from outside; rows 1 / 2 are then the order to go in (1 = no can)`,
          `tools: ${textOf(pg)} · jambs held ${held}, ${none} across · then X: row 5 '${r5?.text}' · tools: ${textOf(pg2)} · after 1: ${went ? 'in' : 'NOBODY IN'}, cans spent ${bangs0 - T.R.D.bangs}`);
        const U = await rig(E, spot, { plain: true }, 'none'); await U.keys('X', 5, 4); await U.run(40, () => U.opsOn().some((o: any) => o.kind === 'threshold' && o.phase === 'thr'));
        const b0 = U.R.D.bangs; await U.keys('X', 5, 2); const in2 = await U.run(30, () => U.across().length > 0); await U.run(6, () => false);
        const V = await rig(E, spot, { plain: true }, 'none'); await V.keys('X', 5, 4); await V.run(40, () => V.opsOn().some((o: any) => o.kind === 'threshold' && o.phase === 'thr'));
        const v0 = V.R.D.bangs; await V.keys('F'); const in3 = await V.run(30, () => V.across().length > 0); await V.run(6, () => false);
        F.verdict(in2 && b0 - U.R.D.bangs === 1 && in3 && v0 - V.R.D.bangs <= 1,
          `${id}: 'bang, then go in' spends exactly one can, the word (F) at most one`,
          `row 2: ${in2 ? 'in' : 'NOBODY IN'}, ${b0 - U.R.D.bangs} can(s) · F: ${in3 ? 'in' : 'NOBODY IN'}, ${v0 - V.R.D.bangs} can(s)`);
        const O = await rig(E, spot, { plain: false }, 'none'); await O.keys('X', 5); const old = O.R.read();
        F.verdict(rowsOf(old) === '1 openClear · 2 bangClear · 3 charge · 4 thr ▸ · G fragClear' || /4 thr ▸/.test(rowsOf(old)),
          `${id}: switch off = the threshold's page on row 4, as it was`, `tools: ${rowsOf(old)}`);
      }
    }
    // ---- 8. the player's own kick from beside the door (the four's office door)
    { const E = SCENARIOS.find((s: any) => s.id === 'room-clear-four'); DOORTOOLS.testDoor = false; DOORWAY.sideKick = false; DOORTOOLS.outsidePlain = false;
      const spot = await spotOf(E);
      if (typeof spot !== 'string') {
        const kick = async (sideKick: boolean, beside: boolean) => { const T = await rig(E, spot, { side: sideKick }, 'wedge'), g = T.g, d = T.d;
          for (const m of T.R.team) g.orders.clear([m]);
          const sq = g.doors.kickSpot(d, spot.sam), sd = g.doors.kickSpotSide(d, spot.sam), from = beside ? [sd.pos[0], 0, sd.pos[2]] : [sq.pos[0], 0, sq.pos[2]];
          await quiet(() => { g.teleportPlayer(from); T.R.aim = null; T.R.step(10); PL.startKick(g, d); });
          const planned = g.player.kick ? alongOf(d, g.player.kick.spot) : NaN; let at = NaN;
          await T.run(3, () => { if (g.player.char.anim.kickImpact) at = alongOf(d, g.player.char.pos); return !g.player.kick; });
          return { planned, at, open: !shut(d), w: d.def.width as number }; };
        const a = await kick(true, true), b = await kick(true, false), c = await kick(false, true);
        F.verdict(a.planned > a.w && a.at > a.w - 0.05 && a.open && b.planned < b.w && b.open && c.planned < c.w && c.open,
          `the player beside the latch jamb kicks from there and the door gives; in front of the leaf, or with the switch off, it is the square kick`,
          `leaf ${a.w.toFixed(2)} m · beside, on: planned ${a.planned.toFixed(2)} m along, at impact ${a.at.toFixed(2)}, ${a.open ? 'open' : 'STILL SHUT'} · in front, on: ${b.planned.toFixed(2)}, ${b.open ? 'open' : 'STILL SHUT'} · beside, off: ${c.planned.toFixed(2)}, ${c.open ? 'open' : 'STILL SHUT'}`);
      } else F.verdict(false, 'the player\'s kick: a door to stage it on', spot);
      if (typeof spot !== 'string') {
        // ---- 9. what the team knows is PER FACE: the player at the locked face's prompts, a man stacked on the free face — said once, not every frame
        { const T = await rig(E, spot, { test: true }, 'none'), g = T.g, d = T.d;
          d.keySide = -g.doors.side(d, spot.sam); d.lockId = `wedge:${d.def.name}`; d.locked = true; d.pick = 0;   // (locked against the FAR face only)
          await T.keys('X', 1);
          const th = d.def.closedDir, o = offOf(d, spot.sam, 1), far = [spot.sam[0] + 2 * o * Math.sin(th), 0, spot.sam[2] - 2 * o * Math.cos(th)], ks = g.doors.kickSpot(d, far);
          await quiet(() => { g.teleportPlayer([ks.pos[0], 0, ks.pos[2]]); T.R.aim = null; });
          let rows = false; await T.run(30, () => { rows ||= g.nearby.some((it: any) => it.door === d && it.inReach && ['pick', 'kick', 'rattle', 'nocode', 'code'].includes(it.verb)); return T.R.D.stats.tested > 0; });
          await T.run(3, () => { rows ||= g.nearby.some((it: any) => it.door === d && it.inReach && ['pick', 'kick', 'rattle', 'nocode', 'code'].includes(it.verb)); return false; });
          const n = T.said.filter(s => /it's not locked\./.test(s)).length;
          F.verdict(rows && n === 1 && T.R.D.stats.tested === 1 && T.R.D.knownShut(d, -T.side as 1 | -1) && !T.R.D.knownShut(d, T.side),
            `a door locked from the far face only, the player at that face's lock rows, a man stacked on the free face: 'it's not locked.' once`,
            `the player's lock rows up ${rows} · said ${n} time(s) · tried ${T.R.D.stats.tested} · known shut: far face ${T.R.D.knownShut(d, -T.side as 1 | -1)}, the men's face ${T.R.D.knownShut(d, T.side)}`);
        }
        // ---- 10. 'wait for my word' on a door held from outside: row 1 then waits, and F steps them in with no can
        { const T = await rig(E, spot, { plain: true }, 'none'); await T.keys('X', 5, 4); const held = await T.run(40, () => T.opsOn().some((o: any) => o.kind === 'threshold' && o.phase === 'thr'));
          const b0 = T.R.D.bangs; await T.keys('X', 5, 5); const pg = T.R.read(), r1 = pg?.rows.find((r: any) => r.id === 'openClear');
          await T.keys(1); await T.run(4, () => false);
          const op = T.opsOn().find((o: any) => o.kind === 'threshold'), waited = T.across().length === 0 && op?.phase === 'thr';
          await T.keys('F'); const went = await T.run(25, () => T.across().length > 0); await T.run(4, () => false);
          F.verdict(held && /^wait · go in and clear/.test(r1?.text ?? '') && waited && went && T.R.D.bangs === b0,
            `a held door, 'wait for my word' on, row 1: they keep the jambs until F, and F then steps them in with no can`,
            `held ${held} · row 1 '${r1?.text}' · after 1: ${waited ? 'still on the jambs' : `NOT WAITING (${T.across().length} across, phase ${op?.phase ?? 'gone'})`} · after F: ${went ? 'in' : 'NOBODY IN'}, cans spent ${b0 - T.R.D.bangs}`);
        }
        // ---- 11. the menu does not read a lock for them: a steel door nobody has tried is not greyed; the man at the handle says it, and then it is
        { const T = await rig(E, spot, { test: true }, 'wedge'), was = T.d.def.steel;
          try { T.d.def.steel = true;
            await T.keys('X', 5); const r0 = T.R.read()?.rows.find((r: any) => r.id === 'openClear');
            await T.keys(1); await T.run(3, () => T.opsOn().length > 0); await T.run(40, () => T.opsOn().length === 0);
            const line = T.said.find(s => /steel, and locked\. holding on it/.test(s));
            await T.keys('X', 5); const r1 = T.R.read()?.rows.find((r: any) => r.id === 'openClear');
            F.verdict(!!r0 && !r0.off && T.R.D.stats.halted === 1 && T.R.D.stats.kicks === 0 && !!line && !!r1?.off && shut(T.d),
              `a locked steel door nobody has tried: the row is not greyed, the lead tries it and says so, and only then is the row greyed`,
              `before: row 1 ${r0?.off ? 'GREYED' : 'given'} · halted ${T.R.D.stats.halted} · boots ${T.R.D.stats.kicks} · said: ${line ?? '(nothing)'} · after: row 1 ${r1?.off ? 'greyed' : 'NOT GREYED'}`);
          } finally { T.d.def.steel = was; }
        }
      }
    }
  } finally { DOORTOOLS.testDoor = keep.t; DOORWAY.sideKick = keep.s; DOORTOOLS.outsidePlain = keep.p; }
  return F.done();
});

if (import.meta.main) process.exit((await doortestCheck()) ? 0 : 1);
