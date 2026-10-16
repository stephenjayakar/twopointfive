// A DOOR AN ENEMY OPENS IS LOOKED AT — src/game/roomfight.ts ROOMFIGHT.doorEars (on). The barricaded rooms goal's trace of the compound on hard: the squad had
// taken the garage, a defender pulled its forecourt door open from outside, stood at the jamb for three seconds and shot three of the four in the back. The
// man posted on that door had no line to the jamb; the man who had one never turned.
//   [TPS_PROFILE=shipped] bun run tools/qa/doorlook-check.ts [--seed N] [--verbose]        exit 0 = holds, 1 = it does not
// The compound's room clear with four, every defender but one off the floor (the one left stands far off: he is only the name on the door's noise). Three of
// the four are stood in the garage with a line to its forecourt door `g_e`, their backs to it; the fourth stands where he has no line to it. Then the door's
// creak is FILED as worked by that defender (the 'door' event game.ts files for a real hand on a leaf) and the leaf is stood ajar, off its latch.
//   (1) rule ON: every man with a line to the doorway has his gun on it inside a second and a half
//   (2) rule ON: the man with no line to it is not turned by it (his gun ends where it does with the rule off)
//   (3) rule ON: the look ends by itself (`doorLookSecs` and a second)
//   (4) rule ON, the same creak filed as a TEAMMATE's hand: nobody is turned (every gun where it is with the rule off)
//   (5) rule OFF, the same staging: nobody is turned by it and at least one man with a line keeps his back to the door — the fault
//   (6) rule ON, the same noise from a leaf that stays SHUT on its latch (a rattle, a pick, a slam to): nobody is turned
//   (7) rule ON, the leaf's second noise 0.3 s later (off its stop): no man's look is started again — one note a man, and it ends when the first would
// (with the rule off the cover's own deal still brings SOME guns onto a door of the room: the lines are asked rule on against rule off)
// DOORLOOK_BREAK=1 runs (1) with the rule off: must fail.
import { ROOT } from './headless.ts';
import { stage } from './bang-tally.ts';
const { ROOMFIGHT } = await import(`${ROOT}/src/game/roomfight.ts`);
const { doorPt } = await import(`${ROOT}/src/game/doortools.ts`);
const CBM = await import(`${ROOT}/src/game/combat.ts`);

const args = process.argv.slice(2), flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const VERBOSE = args.includes('--verbose'), SEED = Number(flag('--seed') ?? 1), BREAK = process.env.DOORLOOK_BREAK === '1';
const SCN = 'compound-four', DOOR = 'g_e', DEG = 180 / Math.PI, NEAR = 25, AWAY = 70;
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

interface Man { name: string; line: boolean; before: number; best: number; at15: number; after: number; turned: boolean }
interface Arm { note: string; men: Man[]; notes: number }

async function arm(on: boolean, ours: boolean, shut = false, twice = false): Promise<Arm> {
  const keep = ROOMFIGHT.doorEars, A: Arm = { note: '', men: [], notes: 0 };
  try {
    const S: any = await quiet(() => stage(SCN, SEED)); ROOMFIGHT.doorEars = on; const g = S.g, O = g.orders, nav = g.col.nav, step = S.step;
    const d = g.doors.list.find((x: any) => x.def.name === DOOR); if (!d) { A.note = `no door ${DOOR}`; return A; }
    const W = d.def.width, mid = (side: 1 | -1) => doorPt(d, W / 2, 1.0, side), cells = (side: 1 | -1) => g.fight.roomAt(mid(side))?.cells.size ?? Infinity;
    const inSide: 1 | -1 = cells(1) < cells(-1) ? 1 : -1, room = g.fight.roomAt(mid(inSide)); if (!room) { A.note = 'no room behind the door'; return A; }   // (the garage's face of the door)
    const inRoom = (p: number[]) => room.cells.has(Math.floor(p[2] / nav.cell) * nav.W + Math.floor(p[0] / nav.cell));
    const hostiles: any[] = g.guards.filter((x: any) => x.state !== 'dead' && x.team === 'hostile').sort((a: any, b: any) => flat(b.char.pos, d.frameCentre) - flat(a.char.pos, d.frameCentre));
    const by = hostiles.find(h => flat(h.char.pos, d.frameCentre) > 12); if (!by) { A.note = 'no defender far from the garage to name on the door'; return A; }
    for (const x of hostiles) if (x !== by) await quiet(() => CBM.killGuard(g, x, [0, 0, 1], true));
    // where each man would see the doorway from: a hand's width his side of the leaf (the rule's own point)
    const leaf: number[] = [d.pos[0], 0, d.pos[2]];
    const seenFrom = (p: number[]) => { const dd = flat(leaf, p), k = 0.35 / dd, at = [leaf[0] + (p[0] - leaf[0]) * k, 1.1, leaf[2] + (p[2] - leaf[2]) * k]; return !g.col.segmentBlocked([p[0], 1.6, p[2]], at); };
    const inside: number[][] = [], outside: number[][] = [];
    for (let cz = 0; cz < nav.H; cz++) for (let cx = 0; cx < nav.W; cx++) { const p = [(cx + 0.5) * nav.cell, 0, (cz + 0.5) * nav.cell], dd = flat(p, leaf);
      if (dd < 2.2 || dd > 7 || nav.isBlocked(p[0], p[2])) continue;
      if (inRoom(p) && seenFrom(p) && !inside.some(q => flat(q, p) < 1.2)) inside.push(p);
      else if (!inRoom(p) && !seenFrom(p) && dd > 3.5 && !outside.some(q => flat(q, p) < 1.2)) outside.push(p); }
    const team: any[] = O.squad().filter((x: any) => x.state !== 'dead');
    if (team.length < 4 || inside.length < 4 || !outside.length) { A.note = `staging: ${team.length} men, ${inside.length} spots in the garage with a line, ${outside.length} without one`; return A; }
    const spots = [inside[0], inside[1], inside[2], outside[0]];
    team.slice(0, 4).forEach((gd, i) => { const p = spots[i]; gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null;
      gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(p[0] - leaf[0], p[2] - leaf[2]); });   // (his back to the door)
    await quiet(() => g.teleportPlayer(inside[3] as any));
    await quiet(() => { for (const gd of team.slice(0, 4)) O.give('hold', { kind: 'none' }, gd); });   // (man by man: a hold told to one man deals him no arc)
    await quiet(() => step(20));
    const offOf = (gd: any) => Math.abs(wrap(gd.char.aimYaw - Math.atan2(leaf[0] - gd.char.pos[0], leaf[2] - gd.char.pos[2]))) * DEG;
    team.slice(0, 4).forEach((gd, i) => { const p = spots[i]; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(p[0] - leaf[0], p[2] - leaf[2]); });
    await quiet(() => step(6));
    const men: Man[] = team.slice(0, 4).map((gd, i) => ({ name: gd.callsign, line: i < 3, before: offOf(gd), best: 999, at15: 999, after: 999, turned: false }));
    const noise = () => g.events.push({ kind: 'door', pos: [d.pos[0], 0, d.pos[2]], time: g.time, loud: false, level: 0.3, who: ours ? team[0].char.id : by.char.id });
    const ajar = () => { if (!shut) { d.latched = false; d.vel = 0; d.angle = 0.7 * (d.maxA > 0.5 ? 1 : -1); d.quietT = 0; } };   // (a leaf an enemy's hand has swung: off its latch, well round; held there against a closer)
    const log0 = g.fight.log.length; ajar(); noise();
    const secs = ROOMFIGHT.doorLookSecs ?? 3.5;
    await quiet(() => { for (let k = 0; k < Math.round(60 * (secs + 1.5)); k++) { ajar(); if (twice && k === 18) noise(); step();
      team.slice(0, 4).forEach((gd, i) => { const o = offOf(gd), m = men[i]; if (k < 90) m.best = Math.min(m.best, o); if (k === 89) m.at15 = o;
        if (g.fight.opOf?.(gd)?.turn) m.turned = true; if (k === Math.round(60 * (secs + 1.5)) - 1) m.after = g.fight.opOf?.(gd)?.turn ? 1 : 0; }); } });
    A.men = men; A.notes = g.fight.log.slice(log0).filter((r: any) => String(r.what).includes('a door has come open')).length; return A;
  } finally { ROOMFIGHT.doorEars = keep; }
}

const show = (A: Arm) => A.note ? A.note : A.men.map(m => `${m.name}${m.line ? '' : ' (no line)'} ${m.before.toFixed(0)}° → ${m.at15.toFixed(0)}°${m.turned ? '' : ' ·'}`).join('  ');
export async function doorlookCheck(): Promise<boolean> {
  let fails = 0; const line = (ok: boolean, what: string) => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}`); if (!ok) fails++; };
  console.log(`=== doorlook-check · ${SCN} ${DOOR} · seed ${SEED}${BREAK ? ' · DOORLOOK_BREAK: the rule off where it should be on' : ''} ===`);
  const on = await arm(!BREAK, false), off = await arm(false, false), mate = await arm(true, true), shut = await arm(true, false, true), twice = await arm(true, false, false, true);
  console.log(`  on:   ${show(on)}\n  off:  ${show(off)}\n  ours: ${show(mate)}\n  shut: ${show(shut)}\n  twice: ${show(twice)} · notes ${twice.notes} (once: ${on.notes})`);
  const seen = (A: Arm) => A.men.filter(m => m.line), blind = (A: Arm) => A.men.filter(m => !m.line), left = (A: Arm) => seen(A).filter(m => m.at15 > AWAY);
  const same = (m: Man) => { const o = off.men.find(x => x.name === m.name); return !!o && Math.abs(o.at15 - m.at15) < 5; }, say = (ms: Man[]) => ms.map(m => `${m.name} ${m.at15.toFixed(0)}°`).join(', ');
  line(!on.note && seen(on).length === 3 && seen(on).every(m => m.turned && m.at15 <= NEAR), `rule on: every man with a line to the doorway has his gun on it a second and a half after an enemy's hand works the door (${say(seen(on)) || on.note})`);
  line(!on.note && blind(on).length === 1 && blind(on).every(m => !m.turned && same(m)), `rule on: the man with no line to the doorway is not turned by it: his gun is where it is with the rule off (${say(blind(on))})`);
  line(!on.note && on.men.every(m => m.after === 0), `rule on: the look is over a second after its time is up`);
  line(!mate.note && mate.men.every(m => !m.turned && same(m)), `a door a teammate's hand works turns nobody: every gun is where it is with the rule off (${say(mate.men) || mate.note})`);
  line(!off.note && off.men.every(m => !m.turned) && left(off).length >= 1, `rule off: nobody is turned by the door, and a man with a line to it is left with his back to it — the fault (${say(left(off)) || off.note})`);
  const offShut = await arm(false, false, true), sameShut = (m: Man) => { const o = offShut.men.find(x => x.name === m.name); return !!o && Math.abs(o.at15 - m.at15) < 5; };
  line(!shut.note && shut.men.every(m => !m.turned && sameShut(m)), `the same noise from a leaf that stays shut on its latch turns nobody (${say(shut.men) || shut.note})`);
  line(!twice.note && !on.note && twice.notes === on.notes && on.notes === seen(on).length && twice.men.every(m => m.after === 0), `the leaf's second noise 0.3 s on starts no look again: ${twice.notes} looks begun, one a man with a line, all over on time`);
  console.log(fails ? `=== doorlook-check: ${fails} FAILED ===` : '=== doorlook-check: ALL PASS ===');
  return fails === 0;
}
if (import.meta.main) process.exit((await doorlookCheck()) ? 0 : 1);
