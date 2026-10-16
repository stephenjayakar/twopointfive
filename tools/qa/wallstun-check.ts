// A BURST THAT HOLES A WALL STUNS THE MEN BEHIND IT (src/game/frag.ts FRAG.wallStun; the maintainer's replay dump, 10-13: his own 40 mm aimed at a man outside the
// break room killed a teammate 4 m inside it, and a defender's frag did the same through drywall — while a door a burst tears off only stuns the man behind it).
// Standalone and through probes.ts:
//   bun run tools/qa/wallstun-check.ts          bun run tools/qa/probes.ts wallstun
// The destruction engine opens the wall on the burst's own call and the men were judged after it, through the hole. Headless, PASS / FAIL each; the 40 mm's burst
// is asked as he40.ts asks it (frag.ts blast() a hand off the wall), the hand grenade's as detonateFrag asks it, on a drywall partition of the office.
//   (1) a 40 mm on the wall, a man a stride behind it: the wall opens and he is 'stunned' — folded for the wound band's seconds, alive, nobody down
//   (2) a hand grenade at the foot of the same wall: the same
//   (3) the man about 2.5 m behind it: the same
//   (4) the NEXT burst there, a frame later: judged through the hole — a hole is a hole from then on
//   (5) walls that do not break (the wall dial off): shielded and not a beat lost, as ever
//   (6) FRAG.wallStun off: (1) again is judged through the fresh hole — the blast as it was
//   (7) the player behind the wall somebody else's burst holes: stunned (his trigger dead for the seconds, a line saying why), never hurt
//   (8) a man in the open on the burst's own side: the rule changes nothing for him
//   (9) the log's count names the man folded behind what it broke, seen by the player through the hole
// It raises what it needs itself (the destruction switch and dial), so it passes on the frozen stand and under TPS_PROFILE=shipped.
// WALLSTUN_BREAK=1 = the rule left off where the lines want it on: they are asked all the same and must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
type V3 = [number, number, number];
const DT = 1 / 60, f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export async function wallstunCheck(): Promise<boolean> {
  const { standUp } = (await import('./headless.ts')) as any;
  const { DOORBLAST } = await import(`${ROOT}/src/game/doorblast.ts`);
  const { FRAG, FRAG_STATS, blast, exposure } = await import(`${ROOT}/src/game/frag.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { HE40 } = await import(`${ROOT}/src/game/he40.ts`);
  const BREAK = process.env.WALLSTUN_BREAK === '1', ON = !BREAK; let all = true;
  const was = { frag: JSON.parse(JSON.stringify(FRAG)), door: DOORBLAST.on, sw: DESTRUCTION.on, rnd: Math.random };
  const line = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== wallstun: a burst that holes a wall stuns the men behind it${BREAK ? ' (WALLSTUN_BREAK: the rule left off)' : ''} ===`);
  type Site = { id: number; c: V3; n: V3; thin: number; /** metres behind the wall the far man stands, metres in front of it the man in the open does */ back: number; open: number };
  let site = null as Site | null;   // the wall every line is asked on: found once, on the first floor stood up
  /** a fresh office floor with walls that break (or not: `walls`), the rule as told */
  const rig = async (rule: boolean, walls = true) => {
    Math.random = seeded(7); DOORBLAST.on = true; DESTRUCTION.on = true; FRAG.wallStun = rule;   // (raised before the floor stands up: every rig is the same floor)
    const W: any = await standUp({}); const g = W.game; g.tune.chaos = 0.5; g.tune.wallBreak = walls;
    g.aiEnabled = false; g.godMode = false;
    const said: string[] = []; { const msg = g.msg.bind(g); g.msg = (t: string) => { said.push(t); msg(t); }; }
    const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
    step(10);
    const put = (gd: any, p: number[]) => { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.lastPos = [p[0], 0, p[2]]; };
    const free = (p: number[]) => !g.col.nav.isBlocked(p[0], p[2]);
    /** the point `along` metres out from the wall's face on `side` (the burst's is +1), `y` up */
    const off = (S: Site, side: 1 | -1, along: number, y = 0): V3 => [S.c[0] + S.n[0] * side * (S.thin + along), y, S.c[2] + S.n[2] * side * (S.thin + along)];
    if (!site) {   // a whole drywall partition, a burst a hand off its middle: floor a stride and about 2.5 m behind it (neither in the burst's line with the wall standing), floor in the open in front of it
      const cands = g.destr.walls.all().filter((B: any) => B.kind === 'wall' && B.surf === 'drywall' && B.open === 0).sort((a: any, b: any) => a.id - b.id);
      for (const B of cands) { const b = B.box, cs = Math.cos(b.yaw), sn = Math.sin(b.yaw), x = b.h[0] < b.h[2]; if (Math.max(b.h[0], b.h[2]) < 1) continue;
        for (const sgn of [1, -1]) { const S: Site = { id: B.id, c: [b.c[0], 0, b.c[2]], n: x ? [cs * sgn, 0, -sn * sgn] : [sn * sgn, 0, cs * sgn], thin: Math.min(b.h[0], b.h[2]), back: 0, open: 0 };
          const at = off(S, 1, 0.3, 1.0), m1 = off(S, -1, 1.0), up = (p: V3): V3 => [p[0], 1.0, p[2]];
          const hid = (m: V3) => free(m) && exposure(g, at, m, [m[0], 1.65, m[2]], 'whole') === 0;
          if (!hid(m1)) continue;
          S.back = [2.5, 2.25, 2.75, 2.0, 3.0].find(a => { const m = off(S, -1, a); return hid(m) && !g.col.solidBlocked(up(m1), up(m)); }) ?? 0;
          S.open = [3.0, 2.5, 2.0, 1.5].find(a => { const o = off(S, 1, a); return free(o) && !g.col.solidBlocked(at, up(o)); }) ?? 0;
          if (S.back && S.open) { site = S; break; } }
        if (site) break; }
    }
    /** everybody but `T` (and the player unless `keep`) well out of this burst */
    const clear = (T: any, at: V3, keep = false) => { const far = [[8, 0, 17.6], [30, 0, 8], [34, 0, 20], [6, 0, 6]].filter(free).sort((a, b) => Math.hypot(b[0] - at[0], b[2] - at[2]) - Math.hypot(a[0] - at[0], a[2] - at[2]))[0];
      for (const o of [...g.guards, ...(g.civilians ?? [])]) if (o !== T) put(o, far); if (!keep) g.teleportPlayer([far[0], 0, far[2]]); };
    const wall = (S: Site) => g.destr.walls.all().find((B: any) => B.id === S.id);
    /** the 40 mm's burst (he40.ts: its own stand-off from what it met; the engine's default reach) or the hand grenade's (detonateFrag's reach), on the wall's burst face */
    const burst = (S: Site, kind: 'he40' | 'frag', who: number, along = kind === 'he40' ? Math.max(HE40.standoff + 0.03, 0.3) : 0.3) => { const pt = off(S, 1, along, kind === 'he40' ? 1.0 : 0.05);
      return blast(g, [pt[0], pt[1] - (kind === 'he40' ? FRAG.lift : 0), pt[2]], kind === 'he40' ? { who, name: '40 mm grenade' } : { who, name: 'frag grenade', destr: { radius: FRAG.destrM, power: 1 } }); };
    return { W, g, said, step, put, off, clear, wall, burst, free };
  };
  const words = (rep: any, gd: any, g: any) => `${rep.hits.filter((h: any) => h.id === gd.char.id).map((h: any) => `${h.name} ${h.result}${h.behind ? ` (behind ${h.behind})` : ''} at ${f2(h.d)} m, exposed ${h.exposed}`).join('') || 'not in the report'} · ${gd.state} · folded ${f2(Math.max(0, gd.staggerUntil - g.time))} s · report ${rep.killed} down ${rep.wounded} hit ${rep.stunned} stunned ${rep.shielded} behind cover`;
  const hit = (rep: any, gd: any) => rep.hits.find((h: any) => h.id === gd.char.id);
  /** one man `back` metres behind the wall, one burst on its other face */
  const one = async (rule: boolean, kind: 'he40' | 'frag', far: boolean, walls = true) => {
    const R = await rig(rule, walls), g = R.g, S = site; if (!S) return null;
    const T = g.guards.find((x: any) => x.state !== 'dead' && !x.civ), at = R.off(S, 1, 0.3, 1.0);
    R.clear(T, at); R.put(T, R.off(S, -1, far ? S.back : 1.0)); R.step(3); R.said.length = 0;
    const st0 = T.staggerUntil, n0 = FRAG_STATS.stunned, open0 = R.wall(S).open; const rep = R.burst(S, kind, 0);
    return { R, g, S, T, rep, st0, counted: FRAG_STATS.stunned - n0, opened: R.wall(S).open - open0 };
  };
  try {
    { const c = await one(ON, 'he40', false), h = c && hit(c.rep, c.T), secs = c ? c.T.staggerUntil - c.g.time : 0;
      line(!!c && !!h && c.opened > 0 && h.result === 'stunned' && h.behind === 'cover' && h.d < FRAG.lethalM && c.T.state !== 'dead' && secs > 2 && secs <= FRAG.stagger[0] && c.rep.killed === 0 && c.rep.stunned === 1 && c.counted === 1 && c.T.awareness >= 0.92,
        '(1) a 40 mm on the wall, a man a stride behind it: the wall opens and he is stunned — folded, alive, nobody down', c ? `wall ${c.S.id} at (${f2(c.S.c[0])}, ${f2(c.S.c[2])}) · cells opened ${c.opened} · ${words(c.rep, c.T, c.g)}` : 'NO WALL with floor both sides found'); }
    { const c = await one(ON, 'frag', false), h = c && hit(c.rep, c.T);
      line(!!c && !!h && c.opened > 0 && h.result === 'stunned' && h.behind === 'cover' && c.T.state !== 'dead' && c.T.staggerUntil - c.g.time > 2 && c.rep.killed === 0,
        '(2) a hand grenade at the foot of the same wall: the same', c ? `cells opened ${c.opened} · ${words(c.rep, c.T, c.g)}` : 'NO WALL'); }
    { const c = await one(ON, 'he40', true), h = c && hit(c.rep, c.T);
      line(!!c && !!h && c.opened > 0 && h.result === 'stunned' && c.T.state !== 'dead' && c.T.staggerUntil > c.st0 && c.rep.killed === 0,
        '(3) the man 2.5 m behind it: stunned too, never killed — the wall took the fragments', c ? `${c.S.back} m behind · cells opened ${c.opened} · ${words(c.rep, c.T, c.g)}` : 'NO WALL');
      if (c) { c.R.step(1); const again = c.R.burst(c.S, 'he40', 0), h2 = hit(again, c.T);
        line(!!h2 && h2.exposed > 0 && !h2.behind && (h2.result === 'killed' || h2.result === 'wounded'),
          '(4) the next burst there, a frame later: judged through the hole — a hole is a hole from then on', words(again, c.T, c.g)); }
      else line(false, '(4) the next burst there, a frame later', 'NO WALL'); }
    { const c = await one(true, 'he40', false, false), h = c && hit(c.rep, c.T);
      line(!!c && !!h && c.opened === 0 && h.result === 'shielded' && c.T.staggerUntil === c.st0 && c.rep.stunned === 0,
        '(5) walls that do not break: shielded and not a beat lost, as ever', c ? `cells opened ${c.opened} · ${words(c.rep, c.T, c.g)}` : 'NO WALL'); }
    { const c = await one(false, 'he40', false), h = c && hit(c.rep, c.T);
      line(!!c && !!h && c.opened > 0 && h.exposed > 0 && !h.behind && (h.result === 'killed' || h.result === 'wounded') && c.rep.stunned === 0 && c.counted === 0,
        '(6) FRAG.wallStun off: the same burst, the same man — judged through the fresh hole, the blast as it was', c ? `cells opened ${c.opened} · ${words(c.rep, c.T, c.g)}` : 'NO WALL'); }
    { const R = await rig(ON), g = R.g, S = site, pl = g.player;
      if (S) { const at = R.off(S, 1, 0.3, 1.0), p = R.off(S, -1, 1.0); R.clear(null, at, true); g.teleportPlayer([p[0], 0, p[2]]); R.step(3); R.said.length = 0;
        const hits0 = pl.hitsLeft, open0 = R.wall(S).open; const rep = R.burst(S, 'he40', 0); const secs = pl.staggerUntil - g.time;
        line(R.wall(S).open > open0 && rep.player === 'stunned' && rep.stunned === 0 && !pl.down && pl.hitsLeft === hits0 && secs > 2 && pl.fireCd > 2 && R.said.some((s: string) => /broke through your cover, stunned/.test(s)),
          '(7) the player behind a wall a burst holes: stunned like anybody — trigger dead for the seconds, not hurt, a line saying why', `cells opened ${R.wall(S).open - open0} · player ${rep.player} · down ${pl.down} · hits left ${pl.hitsLeft} of ${hits0} · stagger ${f2(secs)} s · fireCd ${f2(pl.fireCd)} · "${R.said[0] ?? ''}"`); }
      else line(false, '(7) the player behind a wall a burst holes', 'NO WALL'); }
    { const open = async (rule: boolean) => { const R = await rig(rule), g = R.g, S = site; if (!S) return null;
        const T = g.guards.find((x: any) => x.state !== 'dead' && !x.civ), at = R.off(S, 1, 0.3, 1.0); R.clear(T, at); R.put(T, R.off(S, 1, S.open)); R.step(3);
        const rep = R.burst(S, 'he40', 0), h = hit(rep, T); return { h, text: words(rep, T, g) }; };
      const a = await open(ON), b = await open(false);
      line(!!a?.h && !!b?.h && a.h.result === b.h.result && a.h.exposed === b.h.exposed && a.h.exposed > 0 && !a.h.behind,
        '(8) a man in the open on the burst\'s own side: the rule changes nothing for him', a && b ? `rule on: ${a.text}\n    rule off: ${b.text}` : 'NO WALL'); }
    { const R = await rig(ON), g = R.g, S = site;
      if (S) { const T = g.guards.find((x: any) => x.state !== 'dead' && !x.civ), at = R.off(S, 1, 0.3, 1.0); R.clear(T, at); R.put(T, R.off(S, -1, 1.0));
        const stand = R.off(S, 1, S.open); g.godMode = true; g.teleportPlayer([stand[0], 0, stand[2]]); R.step(3); R.said.length = 0;   // (the player square on to the wall in front of the burst, kept on his feet to read the line)
        const rep = R.burst(S, 'he40', 0), eye = g.player.char.bones.head ?? [g.player.char.pos[0], 1.6, g.player.char.pos[2]];
        const seen = !g.player.down && Math.hypot(eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]) < 30 && !g.col.segmentBlocked(eye, at), inView = seen && !g.col.segmentBlocked(eye, T.char.bones.chest ?? [T.char.pos[0], 1.2, T.char.pos[2]]);
        const last = R.said[R.said.length - 1] ?? '';
        line(rep.stunned === 1 && inView && /1 stunned behind what it broke/.test(last) && !/behind the door/.test(last),
          '(9) the log counts the man folded behind what it broke, seen through the hole', `player ${f2(Math.hypot(stand[0] - at[0], stand[2] - at[2]))} m off on the burst's side · ${inView ? 'sees' : 'does not see'} him · "${last}"`); }
      else line(false, '(9) the log line', 'NO WALL'); }
  } catch (e) { all = false; console.log(`- FAIL — the check threw\n    ${e instanceof Error ? e.stack : String(e)}`); }
  finally { Object.assign(FRAG, was.frag); DOORBLAST.on = was.door; DESTRUCTION.on = was.sw; Math.random = was.rnd; }
  console.log(`=== wallstun: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await wallstunCheck()) ? 0 : 1);
