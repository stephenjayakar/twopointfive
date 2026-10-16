// tools/qa/rearread-check.ts — a rear man with no door behind him watches a way in, not a wall
// (cover.ts COVER.rearRead over roomfit.ts watchablesAt).
//
// Found on the maintainer's tape of the floodlit yard (10-13): a wall charge on the guard room's west wall, the four
// stood off south of it, and the two men told to watch the rear had their guns and weapon lights on the yard wall
// 4 m away. With no door at their backs 'the rear' was 'the way I came' = the spot each stood on when the order was
// given. With the rule a door-less rear man, once on his mark, takes the heaviest thing roomfit's read of the floor
// round him finds (a door or gate nobody has been beyond, else the longest open run), and two rear men on one side
// take different things where the floor has two.
//
//   bun run tools/qa/rearread-check.ts [--verbose]        (both stands: it raises the switch itself)
//   REARREAD_BREAK=1 …                                    (the rule left off, the same lines asked: must fail)
import { ROOT } from './headless.ts';
import { guarded, family } from './thresholdmenu-probes.ts';
const { rig } = (await import('./outerwall-probes.ts')) as any;
const { COVER } = await import(`${ROOT}/src/game/cover.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { WALL_ORDER, WALLCHARGE } = await import(`${ROOT}/src/game/wallcharge.ts`);
const BREAK = !!process.env.REARREAD_BREAK, VERBOSE = process.argv.includes('--verbose');
const fmt = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;

interface Man { name: string; pos: number[]; spare: boolean; door: boolean; job: string; rear: boolean; aim: number; open: number; swing: number }
interface Out { ok: boolean; why: string; men: Man[]; reads: number; say: string }
/** what each man of the squad watches, and how far his gun's line runs before it meets the level */
function look(R: any): Man[] {
  const g = R.game, O = R.O;
  return (R.up as any[]).map(m => { const A = O.of(m), J = g.cover.of(m), p = m.char.pos, yaw = m.char.aimYaw;
    const hit = g.col.raycast([p[0], 1.3, p[2]], [Math.sin(yaw), 0, Math.cos(yaw)], 30);
    return { name: m.callsign, pos: [...p], spare: !!A?.spare, door: !!A?.door, job: J ? g.cover.nameOf(J.o, p) : '-', rear: J?.o?.kind === 'rear', aim: yaw, open: hit?.t ?? 30, swing: 0 }; });
}
/** five seconds watched: the men as they stand at the end, each with the widest his aim swung in that time */
function watch(R: any): Man[] {
  const first = look(R); let last = first;
  for (let k = 0; k < 5; k++) { R.step(60); last = look(R); last.forEach((m, i) => { const d = Math.abs(Math.atan2(Math.sin(m.aim - first[i].aim), Math.cos(m.aim - first[i].aim))); first[i].swing = Math.max(first[i].swing, d); }); }
  last.forEach((m, i) => { m.swing = first[i].swing; });
  return last;
}
const say = (men: Man[]) => men.map(m => `${m.name} ${fmt(m.pos)}${m.spare ? ' rear' : ''} · ${m.job} · ${(m.aim * 180 / Math.PI).toFixed(0)}° · ${m.open.toFixed(1)} m open`).join('\n      ');

/** the floodlit yard: the four west of their stand-off as on his tape, a wall charge ordered on the guard room's west
 *  wall, the stand-off let settle; `both` = the north side's rear man then stood on the south side beside the other
 *  (his tape had all four south of the charge; the stand-off deals two a side from this staging) */
async function standOff(on: boolean, both: boolean): Promise<Out> {
  const R = await rig('floodlit-four', 5), g = R.game, O = R.O, C = R.C;
  COVER.rearRead = on;   // (after the stand-up: the frozen stand pins it off)
  for (const h of R.hostiles) if (h.state !== 'dead') R.put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]);
  R.gather([7.6, 0, 12.6], 40); R.step(120);
  const zs = [12.4, 13.3, 14.2, 15.1]; (R.up as any[]).forEach((m, i) => R.put(m, [5.6, 0, zs[i]])); R.step(30);
  const why = O.give(WALL_ORDER, O.targetAt([8.88, 1.05, 9.0]), 'all');
  if (why) return { ok: false, why: `order refused: ${why}`, men: [], reads: 0, say: '' };
  if (!R.until(() => C.ops[0]?.phase === 'armed', 40)) return { ok: false, why: 'the charge was never armed', men: [], reads: 0, say: '' };
  R.step(240);
  if (both) { const n = (R.up as any[]).find(m => O.of(m)?.spare && m.char.pos[2] < 9); if (!n) return { ok: false, why: 'no rear man north of the charge to move', men: [], reads: 0, say: '' };
    const A = O.of(n), at = [8.3, 0, 15.0]; A.post = at; A.goal = at; A.from = [5.6, 0, 14.6]; R.put(n, at); R.step(180); }
  const men = watch(R);
  return { ok: true, why: '', men, reads: g.cover.stats.rearRead, say: say(men) };
}
/** a plain stack on the front door: its rear men have a door (the stack's own), which the rule never touches */
async function stack(on: boolean): Promise<Out> {
  const R = await rig('floodlit-four', 5), g = R.game, O = R.O;
  COVER.rearRead = on;
  for (const h of R.hostiles) if (h.state !== 'dead') R.put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]);
  const d = g.doors.list.find((x: any) => x.def.name === 'front'); if (!d) return { ok: false, why: 'no front door', men: [], reads: 0, say: '' };
  R.gather([17, 0, 15.5], 40); R.step(120);
  const why = O.give('stack', O.targetAt(d.frameCentre), 'all'); if (why) return { ok: false, why: `stack refused: ${why}`, men: [], reads: 0, say: '' };
  R.step(900);
  const men = watch(R);
  return { ok: true, why: '', men, reads: g.cover.stats.rearRead, say: say(men) };
}

export const rearreadCheck = guarded(async () => {
  const F = family('rearread: a rear man with no door behind him watches a way in, not a wall');
  const keep = { r: COVER.rearRead, rnd: Math.random, d: DESTRUCTION.on, w: WALLCHARGE.on, o: WALLCHARGE.outer };   // (the rig seeds Math.random and raises the destruction switches)
  const WALL = 6, FAR = 10, STILL = 0.2;   // metres of open line that is a wall in his face · that is a watch worth having · radians his gun may swing in five seconds
  const south = (o: Out) => o.men.filter(m => m.spare && !m.door && m.pos[2] > 11);
  try {
    // 1 · the stand-off as the wall charge deals it: one rear man south of the charge
    const off = await standOff(false, false), on = await standOff(!BREAK, false);
    if (VERBOSE) console.log(`    off:\n      ${off.say}\n    on:\n      ${on.say}`);
    const so = south(off), sn = south(on);
    F.verdict(off.ok && so.length >= 1 && so.every(m => m.rear && m.open < WALL), 'floodlit, a wall charge on the guard room, rule off: the fault is there (the south rear man\'s gun is on the yard wall)',
      off.ok ? so.map(m => `${m.name} · ${m.job} · ${m.open.toFixed(1)} m of open line`).join(' · ') || 'no rear man south of the charge' : off.why);
    F.verdict(on.ok && sn.length >= 1 && sn.every(m => m.open >= FAR) && on.reads > 0, 'with the rule his gun is on a gate or a long run of open ground',
      on.ok ? `${sn.map(m => `${m.name} · ${m.job} · ${m.open.toFixed(1)} m of open line`).join(' · ')} · read ${on.reads} times` : on.why);
    F.verdict(on.ok && sn.every(m => m.swing < STILL), 'and it stays there: five seconds watched, the gun does not swing between two things', sn.map(m => `${m.name} swung ${(m.swing * 180 / Math.PI).toFixed(1)}°`).join(' · '));
    { const worse = on.men.filter((m, i) => m.spare && off.men[i] && m.open < Math.min(off.men[i].open, FAR) - 0.5), same = on.men.filter((m, i) => !m.spare && off.men[i] && Math.abs(m.aim - off.men[i].aim) < 0.05).length, plain = on.men.filter(m => !m.spare).length;
      F.verdict(on.ok && off.ok && worse.length === 0 && same === plain, 'no rear man has less open line than without the rule, and the men who brace are as they were', `${worse.length} worse · ${same} of ${plain} bracing men on the same line`); }
    // 2 · both rear men on the south side, as on his tape
    const off2 = await standOff(false, true), on2 = await standOff(!BREAK, true);
    if (VERBOSE) console.log(`    both south, off:\n      ${off2.say}\n    both south, on:\n      ${on2.say}`);
    const s2o = south(off2), s2 = south(on2);
    F.verdict(off2.ok && s2o.length === 2 && s2o.every(m => m.open < WALL), 'both rear men stood south of the charge, rule off: both guns on the yard wall', off2.ok ? s2o.map(m => `${m.name} ${m.open.toFixed(1)} m`).join(' · ') : off2.why);
    { const apart = s2.length === 2 ? Math.abs(Math.atan2(Math.sin(s2[0].aim - s2[1].aim), Math.cos(s2[0].aim - s2[1].aim))) : 0;
      // a long line, or a way in he has been dealt by name: the foot gate stands shut eight metres off on this stand, and a gun on a gate is a watch, not a wall
      const watch = (m: typeof s2[number]) => m.open >= FAR || (m.open >= WALL && m.job !== '-' && m.job !== 'the rear');
      F.verdict(on2.ok && s2.length === 2 && s2.every(m => watch(m) && m.swing < STILL) && apart > 0.5, 'with the rule each has a long line or a gate, they hold it, and the two watch different things',
        on2.ok ? `${s2.map(m => `${m.name} · ${m.job} · ${m.open.toFixed(1)} m`).join(' · ')} · ${(apart * 180 / Math.PI).toFixed(0)}° apart` : on2.why); }
    // 3 · a door stack's rear men are the stack's own business
    const st0 = await stack(false), st1 = await stack(true);
    if (VERBOSE) console.log(`    stack, off:\n      ${st0.say}\n    stack, on:\n      ${st1.say}`);
    { const eq = st0.ok && st1.ok && st0.men.length === st1.men.length && st0.men.every((m, i) => m.job === st1.men[i].job && Math.abs(m.aim - st1.men[i].aim) < 1e-9 && Math.hypot(m.pos[0] - st1.men[i].pos[0], m.pos[2] - st1.men[i].pos[2]) < 1e-9);
      F.verdict(eq && st1.reads === 0 && st0.men.some(m => m.spare), 'a plain stack on the front door: every man stands and watches the same with the rule on and off (a rear man with a door is never read)', st0.ok && st1.ok ? `${st0.men.filter(m => m.spare).length} rear men · read ${st1.reads} times` : st0.why || st1.why); }
  } finally { COVER.rearRead = keep.r; Math.random = keep.rnd; DESTRUCTION.on = keep.d; WALLCHARGE.on = keep.w; WALLCHARGE.outer = keep.o; }
  return F.done();
});

if (import.meta.main) process.exit((await rearreadCheck()) ? 0 : 1);
