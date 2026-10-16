// A bang / frag order on a door that STANDS OPEN walks nobody across the front of the opening (game/doortools.ts DOORTOOLS.openHand).
//   bun run tools/qa/openhand-check.ts [scenario id …] [--verbose]      (probes.ts openhand, in family doortools; OPENHAND_BREAK=1 must FAIL)
// The maintainer's replay, 10-12: "after being ordered to frag after externally clearing, blue one crosses across a dangerous threshold". Staged as he played
// it, by keys: 'clear from outside' on a door (X, 5, 4), the men on both jambs of the open door, then 'frag and clear' (X, 5, G). Counted from the order to
// the burst: a man of the squad standing IN FRONT of the opening (between the jambs, on the team's face, within 3 m of the frame). Rule off, then on.
//   1. the office's break room west door, the pair (his tape's door): off = a man crosses, on = nobody, the frag still goes in and bursts inside, and they
//      then go in
//   2. the same door with the four
//   3. every squad room clear of the Missions list, on its first held room's door: on = nobody in front of the opening that the rule off did not also have
//      there, and never more men than off; the frag is thrown and they go in, as with the rule off
//   4. a door found SHUT is dealt as ever (the same marks with the rule on and off)
// Headless: nothing here says how it looks.
import { ROOT } from './headless.ts';
import { stage, spotOf, quiet, guarded, family } from './thresholdmenu-probes.ts';
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { FRAG } = await import(`${ROOT}/src/game/frag.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const CBM = await import(`${ROOT}/src/game/combat.ts`);
const { stackViewOpen } = await import(`${ROOT}/src/game/stackroom.ts`);
const BREAK = !!process.env.OPENHAND_BREAK, VERBOSE = process.argv.includes('--verbose');
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const alongOf = (d: any, p: number[]) => { const th = d.def.closedDir; return (p[0] - d.def.hinge[0]) * Math.cos(th) + (p[2] - d.def.hinge[1]) * Math.sin(th); };
const offOf = (d: any, p: number[], side: number) => { const th = d.def.closedDir; return (Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0])) * side; };
const fmt = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;

interface Out { held: boolean; open: boolean; given: boolean; lead: string; crossed: string[]; hands: string; marks: string; thrown: boolean; inside: boolean | null; went: boolean; lost: number; beats: string[]; why: string }
/** the scenario staged, the defenders off the floor, the door held from outside by keys, then the frag order by keys; watched to the burst and the entry */
async function play(E: any, spot: { door: string; sam: number[] }, on: boolean, outside = true, lone = false): Promise<Out> {
  const R = await stage(E, 1), g = R.g, d = g.doors.byName(spot.door), W = d.def.width as number;
  DOORTOOLS.outsidePlain = true; DOORTOOLS.openHand = on; FRAG.on = true;   // (after the stand-up: the frozen stand pins them)
  for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile') await quiet(() => CBM.killGuard(g, x, [0, 0, 1], true));
  if (!(await quiet(() => R.place(spot.sam, d)))) return { held: false, open: false, given: false, lead: '', crossed: [], hands: '', marks: '', thrown: false, inside: null, went: false, lost: 0, beats: [], why: `X does not open on ${spot.door}` };
  let side = g.orders.targetUnder(R.input, R.W.cam, R.W.canvas).side as 1 | -1; let men0 = R.team.filter((m: any) => m.state !== 'dead');
  const ops = () => R.D.ops.filter((o: any) => o.door === d);
  let held = true;
  if (outside) { await quiet(() => { R.openX(); R.digit(5); R.digit(4); });
    held = await quiet(() => R.until(() => ops().some((o: any) => o.kind === 'threshold' && o.phase === 'thr'), 45)); await quiet(() => R.step(150)); }
  const hand = (p: number[]) => offOf(d, p, side) <= 0 ? 0 : alongOf(d, p) >= W + 0.3 ? 1 : alongOf(d, p) <= -0.3 ? -1 : 0;
  // (lone: the man on the HINGE hand is left alone on the door — the others lost — so the order's one man is dealt with nobody else's jamb to read)
  if (lone) { const keep = men0.find((m: any) => hand(m.char.pos) < 0); if (!keep) return { held, open: false, given: false, lead: '', crossed: [], hands: '', marks: '', thrown: false, inside: null, went: false, lost: 0, beats: [], why: 'nobody holds the hinge hand' };
    for (const m of men0) if (m !== keep) await quiet(() => CBM.killGuard(g, m, [0, 0, 1], true)); men0 = [keep]; await quiet(() => R.step(30)); }
  const hands = men0.map((m: any) => `${m.callsign} ${hand(m.char.pos) > 0 ? 'far' : hand(m.char.pos) < 0 ? 'near' : 'front'} ${fmt(m.char.pos)}`).join(' · ');
  if (R.D.frags < 1) R.D.frags = 1;
  const open = stackViewOpen(d);   // (does the leaf stand open as the order is given: a door found locked is a shut door, and a walk past a shut leaf is nobody's fault)
  await quiet(() => { R.openX(); R.digit(5); R.press(FRAG.orderKey); R.step(2); });
  const op = ops().find((o: any) => o.kind === 'bangClear'), given = !!op; if (op) side = op.side;   // (the face the order really works)
  const crossed = new Set<string>(); let thrown = false, insideBurst: boolean | null = null;
  const front = (m: any) => { const a = alongOf(d, m.char.pos), o = offOf(d, m.char.pos, side); return a > 0.05 && a < W - 0.05 && o > 0.1 && o < 3; };
  const marks = op ? op.men.map((m: any) => `${m.callsign} → ${fmt(op.post.get(m)?.pos ?? m.char.pos)}`).join(' · ') : '';
  if (op) await quiet(() => R.until(() => { for (const m of men0) if (m.state !== 'dead' && front(m)) crossed.add(m.callsign);
    const b = op.beats.map((x: any) => x.what as string); thrown ||= b.some((x: string) => /^toss|frag out|^frag ·/.test(x)) || op.phase === 'fuse' || op.phase === 'wait';
    const burst = b.find((x: string) => /^frag · /.test(x)); if (burst) insideBurst = /inside/.test(burst);
    return op.phase === 'wait' || op.phase === 'enter' || !R.D.ops.includes(op); }, 30));
  const across = () => men0.filter((m: any) => m.state !== 'dead' && offOf(d, m.char.pos, side) < -0.15);
  const went = op ? await quiet(() => R.until(() => { const b = op.beats.map((x: any) => x.what as string), burst = b.find((x: string) => /^frag · /.test(x)); if (burst) insideBurst = /inside/.test(burst); return across().length > 0; }, 25)) : false;
  return { held, open, given, lead: op?.lead?.callsign ?? '', crossed: [...crossed], hands, marks, thrown, inside: insideBurst, went, lost: men0.filter((m: any) => m.state === 'dead').length, beats: op ? op.beats.map((x: any) => x.what) : [], why: '' };
}
const say = (o: Out) => `${o.why || `held ${o.held}${o.open ? '' : ' · LEAF SHUT'} · given ${o.given} · lead ${o.lead} · in front of the opening: ${o.crossed.join(', ') || 'nobody'} · frag ${o.thrown ? (o.inside === null ? 'thrown' : o.inside ? 'burst inside' : 'BURST OUTSIDE') : 'NOT THROWN'} · ${o.went ? 'went in' : 'NOBODY IN'} · lost ${o.lost}`}`;

export const openhandCheck = guarded(async () => {
  const F = family('openhand: a bang / frag order on a door that stands open walks nobody across the front of it');
  const keep = { p: DOORTOOLS.outsidePlain, h: DOORTOOLS.openHand, f: FRAG.on };
  const only = process.argv.slice(2).filter(a => !a.startsWith('--') && SCENARIOS.some((s: any) => s.id === a));
  try {
    // ---- 1, 2. his tape's door: the office's break room west door
    for (const id of ['room-clear-pair', 'room-clear-four']) { if (only.length && !only.includes(id)) continue;
      const E = SCENARIOS.find((s: any) => s.id === id), R0 = await stage(E, 1);
      const d = [...R0.g.doors.list].sort((a: any, b: any) => flat(a.frameCentre, [28, 0, 17.75]) - flat(b.frameCentre, [28, 0, 17.75]))[0];
      const spot = { door: d.def.name as string, sam: [24.6, 0, 16.2] };
      const off = await play(E, spot, false), on = await play(E, spot, !BREAK);
      if (VERBOSE) for (const [n, o] of [['off', off], ['on', on]] as const) console.log(`    ${id} ${n}: ${o.hands}\n      marks ${o.marks}\n      ${o.beats.join(' | ')}`);
      // (the four never had the fault: with more than two men the other jamb's file keeps its own wall; the pair's second man was filed behind the lead)
      if (id === 'room-clear-pair') F.verdict(off.held && off.open && off.given && off.crossed.length > 0, `${id}: the fault is there with the rule off (${spot.door}, held from outside, then 'frag and clear')`, say(off));
      else F.verdict(off.held && off.given && off.crossed.length === 0, `${id}: nobody crossed with the rule off either (${spot.door})`, say(off));
      F.verdict(on.held && on.given && on.crossed.length === 0 && on.open && on.thrown && on.inside === true && on.went && on.lost === 0, `${id}: with the rule nobody is in front of the open door before the burst, the frag bursts inside, they go in`, say(on));
      // (one man left on the door, on the hinge hand: a lone man is dealt the latch jamb, the one mark of the face — across the opening from where he stands)
      if (id === 'room-clear-pair') { const lo = await play(E, spot, false, true, true), ln = await play(E, spot, !BREAK, true, true);
        if (VERBOSE) for (const [n, o] of [['lone off', lo], ['lone on', ln]] as const) console.log(`    ${id} ${n}: ${o.hands}\n      marks ${o.marks}\n      ${o.beats.join(' | ')}`);
        F.verdict(lo.held && lo.open && lo.given && lo.crossed.length > 0, `${id}: one man left, on the hinge hand: sent across the open door with the rule off`, say(lo));
        F.verdict(ln.held && ln.open && ln.given && ln.crossed.length === 0 && ln.thrown && ln.inside === true && ln.went && ln.lost === 0, `${id}: one man left: with the rule he keeps his own hand's jamb, the frag bursts inside, he goes in`, say(ln)); }
    }
    // ---- 3. every squad room clear, its first held room's door
    let offN = 0, onN = 0, n = 0, real = 0; const bad: string[] = [], rows: string[] = [];
    for (const E of SCENARIOS.filter((s: any) => s.kind === 'roomclear')) { if (only.length && !only.includes(E.id)) continue;
      DOORTOOLS.outsidePlain = false;   // (spotOf looks for the threshold's own page, which the one-order form takes off the menu; play() raises it again)
      const spot = await spotOf(E); if (typeof spot === 'string') { rows.push(`${E.id}: ${spot}`); continue; }
      const off = await play(E, spot, false), on = await play(E, spot, !BREAK); n++;
      if (off.open) offN += off.crossed.length; if (on.open) onN += on.crossed.length;
      if (on.held && on.open && on.given && on.thrown && on.went) real++;   // (a row that really asked the question: held from outside, the leaf open at the order, the frag thrown, the entry made)
      rows.push(`${E.id} ${spot.door}: off ${off.crossed.length} (${say(off)}) · on ${on.crossed.length} (${say(on)})`);
      if (VERBOSE) console.log(`    ${rows[rows.length - 1]}\n      off: ${off.hands} → ${off.marks}\n      on:  ${on.hands} → ${on.marks}`);
      if ((on.open && (on.crossed.some(c => !off.crossed.includes(c)) || on.crossed.length > off.crossed.length)) || (off.thrown && !on.thrown) || (off.went && !on.went) || on.lost > off.lost || (off.inside !== false && on.inside === false)) bad.push(E.id);
    }
    F.verdict(bad.length === 0 && real >= Math.min(only.length || 6, n) && onN === 0, `every squad room clear's first door (${n}, ${real} held open and entered): with the rule nobody in front of the opening, the frag and the entry as with it off`,
      `men in front of the opening before the burst: off ${offN}, on ${onN}${bad.length ? ` · WORSE: ${bad.join(', ')}` : ''}${VERBOSE ? '' : `\n    ${rows.join('\n    ')}`}`);
    // ---- 4. a door found shut: the same marks either way
    { DOORTOOLS.outsidePlain = false; const E = SCENARIOS.find((s: any) => s.id === 'room-clear-pair'), spot = await spotOf(E);
      if (typeof spot !== 'string') { const a = await play(E, spot, false, false), b = await play(E, spot, true, false);
        F.verdict(a.given && b.given && !a.open && !b.open && a.marks === b.marks && a.lead === b.lead, `a shut door is dealt as ever: the same marks and lead with the rule on and off`, `off ${a.marks} lead ${a.lead} · on ${b.marks} lead ${b.lead}`); }
      else F.verdict(false, 'a shut door to deal', spot); }
  } finally { DOORTOOLS.outsidePlain = keep.p; DOORTOOLS.openHand = keep.h; FRAG.on = keep.f; }
  return F.done();
});

if (import.meta.main) process.exit((await openhandCheck()) ? 0 : 1);
