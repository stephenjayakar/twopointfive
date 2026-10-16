// The 'burstglass' family (game/frag.ts × game/glassbreak.ts — what a fragmentation burst, a hand grenade's or the 40 mm round's, does to glass and to the men
// behind it), run through probes.ts:
//   bun run tools/qa/probes.ts burstglass | burst-whole | burst-breaks | burst-open | burst-theirs | burst-off | burst-red
// PASS / FAIL each, all headless (the Game of headless.ts stood up with the glass parts ON, whatever the harness default: the fracture model, rounds through
// glass, chaos 0.5). No picture and no sound: the pane coming down, the shards and the burst are untested by eye and ear. Staged on the conference room's
// glazing (three 1 × 2 m panes over a half-metre sill, the corridor south of them), each pane given the glass type a check needs (GlassBreak.setType).
//   burst-whole    a man behind a pane the burst left WHOLE is not hurt and not even folded — toughened glass 3 m off the burst, float glass 3.9 m off,
//                  laminated 2.5 m off, for a grenade on its fuse and for the blast as the 40 mm round hands it over; the pane still stands two seconds later
//   burst-breaks   the pane beside a burst takes it by the glass rules: float glass runs and its pieces fall, toughened glass dices and comes down, a
//                  laminated sheet leaves its frame — each pane ending EXACTLY where a lone GlassBreak.blast of the burst's size puts it; ONE blow a burst
//                  (the fracture model's own count), also with a destruction engine's blast feeding the same entry point; a real 40 mm round down the corridor;
//                  and the grenade thrown with Sam's own keys
//   burst-open     one burst, three panes, three men: the man behind the pane it broke is hit through the part that went, the men behind the two it left
//                  whole are not; what the blast judged open is what is open two seconds later, line for line
//   burst-theirs   the defenders' throw: a carrier whose men are behind standing glass, on a side told not to shoot through glass (?glassfoes=0), reckons his
//                  rifle cannot follow them AND finds no spot for a grenade on his own side of the pane — nothing leaves his hand; told it may (the default),
//                  his rifle has the line. Whatever a thrower COUNTS on a burst opening, a burst there does open; nobody's cover is glass a burst would break
//   burst-off      the glass parts off: a burst beside the same panes touches none of them, the fracture model is never asked, and every view of the glass
//                  is the one solid walk
//   burst-red      THE RED PATH: the same stagings under the base build's two numbers (a fragment given a pistol round's energy for a pane, the burst sending
//                  glass nothing of its own) put the man behind whole glass down and leave the pane beside the burst standing — burst-whole and burst-breaks
//                  come back FALSE there. `BURSTGLASS_BASE=1 bun run tools/qa/probes.ts burstglass` runs the whole family that way and exits 1.
import { standUp, ROOT } from './headless.ts';
import { CONF_PANES } from './office-pane.ts';
const { FRAG, FRAG_LOG, FRAG_STATS, FRAG_WHY, fragStatsReset, blast, exposure, burstLine, fragCarriers } = await import(`${ROOT}/src/game/frag.ts`);
const { GLASSBREAK, GB_STATS } = await import(`${ROOT}/src/game/glassbreak.ts`);
const { GLASSPEN, shotEnergy } = await import(`${ROOT}/src/game/glasspen.ts`);
const { GLASSFX } = await import(`${ROOT}/src/game/glass.ts`);
const { HE40_LOG, he40StatsReset, fireShell } = await import(`${ROOT}/src/game/he40.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}

/** the conference room's glazing along z = 10 (its three sheets: x 6‥7, 7‥8, 8‥9; y 0.5‥2.5), the room north of it, the corridor south */
const [PW, PM, PE] = CONF_PANES, PANES = [PW, PM, PE], GZ = 10;   // (by where they stand, office-pane.ts: the door-size export moved each index up one)
/** the base build's burst (0ee0094): a fragment crosses a pane as a pistol round does, and the glass gets nothing but the stun-sized 'bang' */
const BASE = { paneEnergy: 0.5, glassPower: 0 };
const baseEnv = () => /^(1|on|true|yes)$/i.test(((globalThis as any).process?.env ?? {}).BURSTGLASS_BASE ?? '');

const FRAG_DEFAULTS = JSON.parse(JSON.stringify(FRAG));
const SWITCHES = { pen: GLASSPEN.on, foes: GLASSPEN.foesThrough, fx: GLASSFX.on, random: Math.random };
/** every probe leaves the module switches and knobs as it found them (the runner's next probe stands up on them) */
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { Object.assign(FRAG, JSON.parse(JSON.stringify(FRAG_DEFAULTS))); GLASSPEN.on = SWITCHES.pen; GLASSPEN.foesThrough = SWITCHES.foes; GLASSFX.on = SWITCHES.fx; Math.random = SWITCHES.random; } };

async function rig(seed: number, opts: { glass?: boolean; base?: boolean; pen?: boolean } = {}) {
  const glass = opts.glass !== false;
  Object.assign(FRAG, JSON.parse(JSON.stringify(FRAG_DEFAULTS))); if (opts.base ?? baseEnv()) Object.assign(FRAG, BASE);
  fragStatsReset(); he40StatsReset(); for (const k of Object.keys(GB_STATS)) (GB_STATS as any)[k] = 0;
  Math.random = seeded(seed);
  const W: any = await standUp(); const g = W.game;
  GLASSFX.on = true; GLASSPEN.on = opts.pen ?? glass; GLASSPEN.foesThrough = true; g.tune.glassBreak = glass; g.tune.chaos = 0.5;
  g.aiEnabled = false; g.godMode = true; g.teleportPlayer([24, 0, 17.6]);   // Sam: out of it
  const gb = g.glassBreak;
  const R = { W, g, gb,
    step(n = 1) { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } },
    settle(secs: number) { R.step(Math.round(secs * 60)); },
    types(t: Record<number, string>) { for (const bi of PANES) gb.setType(bi, t[bi] ?? null); },
    put(gd: any, p: number[], face?: number[]) { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.lastPos = [p[0], 0, p[2]]; if (face) { const y = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.char.bodyYaw = y; gd.char.aimYaw = y; } },
    park(...keep: any[]) { let k = 0; for (const x of g.guards) if (!keep.includes(x)) R.put(x, [60 + 2 * k++, 0, 60]); },
    /** a grenade on a short fuse at p; the blast's report once it has gone */
    frag(p: number[]): any { const n0 = FRAG_LOG.length; g.items.spawn('frag', [p[0], 0.05, p[2]], [0, 0, 0], { fuse: 0.2, who: 1 }); for (let i = 0; i < 120 && FRAG_LOG.length === n0; i++) R.step(); R.step(1); return FRAG_LOG[n0] ?? null; },
    pane(bi: number) { const i = gb.paneInfo(bi); return i ? `${bi} ${i.type} ${Math.round(100 * i.openFraction)}% open${i.gone ? ' GONE' : ''}${i.run ? ' run' : ''}` : `${bi} —`; },
    open(bi: number): number { const i = gb.paneInfo(bi); return i ? (i.gone ? 1 : i.openFraction) : 0; },
    /** the fracture model's state of a pane, as one comparable line */
    state(bi: number): string { const i = gb.paneInfo(bi), st = gb.panes.get(bi); return i ? `${i.type} open ${i.openFraction.toFixed(4)} gone ${i.gone} run ${i.run} sites ${i.sites} energy ${i.energy.toFixed(4)} damage ${(st?.damage ?? 0).toFixed(4)}` : 'none'; },
  };
  R.step(2);
  return R;
}
const hitOf = (rep: any, gd: any) => rep?.hits.find((h: any) => h.id === gd.char.id) ?? null;
const hitLine = (rep: any, gd: any) => { const h = hitOf(rep, gd); return h ? `${gd.callsign} ${f2(h.d)} m e${h.exposed} ${h.result}` : `${gd.callsign} not in the report`; };
/** the burst point of a grenade lying at p (blast() judges from FRAG.lift over it) */
const lifted = (p: number[]): Vec3 => [p[0], 0.05 + FRAG.lift, p[2]];
/** metres from a burst at p to the nearest point of a conference pane, and the blast strength it has there (these panes are square to the axes: no yaw here) */
function strengthAt(g: any, bi: number, p: number[]): { d: number; k: number } { const b = g.level.boxes[bi], c = b.c, h = b.h, q = lifted(p); const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const n = [cl(q[0], c[0] - h[0], c[0] + h[0]), cl(q[1], c[1] - h[1], c[1] + h[1]), cl(q[2], c[2] - h[2], c[2] + h[2])]; const d = Math.hypot(n[0] - q[0], n[1] - q[1], n[2] - q[2]); return { d, k: FRAG.glassPower * (1 - d / FRAG.glassM) }; }

// ---------------------------------------------------------------- burst-whole
/** one man behind the middle pane, the three panes of one type, a burst `off` metres south of the glass: [the man's line in the report, hurt?, pane still whole?] */
async function wholeCase(seed: number, type: string, off: number, how: 'frag' | '40mm', base?: boolean) {
  const R = await rig(seed, { base }); const g = R.g; const [A] = g.guards; R.park(A);
  R.types({ [PW]: type, [PM]: type, [PE]: type });
  const man = [7.5, 0, 9.3], p = [7.5, 0, GZ + off]; R.put(A, man, p); R.step(2);
  const stag0 = A.staggerUntil; const { d, k } = strengthAt(g, PM, p);
  const rep = how === 'frag' ? R.frag(p) : blast(g, [p[0], 0.05, p[2]], { who: g.player.char.id, name: '40 mm grenade' });   // (he40.ts burst(): frag.ts's blast and nothing else, no glass size of its own)
  R.settle(2);
  const h = hitOf(rep, A); const hurt = A.state === 'dead' || A.staggerUntil !== stag0 || (!!h && h.result !== 'shielded');
  const whole = PANES.every(bi => R.open(bi) === 0);
  return { R, A, rep, h, hurt, whole, d, k, apart: dist(man, p), line: `${type} ${f2(d)} m off the burst (strength ${f2(k)}) · man ${f2(dist(man, p))} m from it: ${rep ? hitLine(rep, A) : 'NO BLAST'}, ${A.state}${A.staggerUntil !== stag0 ? ', folded' : ''} · panes ${PANES.map(bi => R.pane(bi)).join(' | ')}` };
}
const WHOLE: [string, number, string][] = [['tempered', 3.0, `toughened glass dices past ${GLASSBREAK.blastDiceK}`], ['annealed', 3.9, `float glass is not touched under 0.05 and runs past ${GLASSBREAK.blastRunK}`], ['laminated', 2.5, `a laminated sheet leaves its frame past ${GLASSBREAK.blastSheetK}`]];
export const burstWhole = guarded(async () => {
  const F = family('burst-whole: a burst never hurts a man through a pane it left whole');
  let n = 0;
  for (const how of ['frag', '40mm'] as const) for (const [type, off, rule] of WHOLE) {
    const c = await wholeCase(21 + n, type, off, how); n++;
    F.verdict(!!c.rep && c.whole && !c.hurt && c.h?.result === 'shielded', `(${String.fromCharCode(96 + n)}) ${how === 'frag' ? 'a grenade' : 'the 40 mm round\'s blast'}, ${type} glass that stands (${rule}): the man behind it is untouched`, c.line);
  }
  // …and the same man with no glass in the frame is NOT untouched: the staging has a line (the pane, not a wall, is what saved him)
  { const R = await rig(29); const g = R.g; const [A] = g.guards; R.park(A); R.types({ [PW]: 'tempered', [PM]: 'tempered', [PE]: 'tempered' });
    const man = [7.5, 0, 9.3], p = [7.5, 0, GZ + 1.0]; R.put(A, man, p); R.step(2); const rep = R.frag(p); R.settle(2);
    F.verdict(!!rep && hitOf(rep, A)?.result !== 'shielded' && R.open(PM) === 1, '(g) the same man with the burst a metre off the same glass: it comes down and he is hit (the stagings above have a line to him)', `${rep ? hitLine(rep, A) : 'NO BLAST'} · ${R.pane(PM)}`); }
  return F.done();
});

// ---------------------------------------------------------------- burst-breaks
export const burstBreaks = guarded(async () => {
  const F = family('burst-breaks: the pane beside a burst breaks by the glass rules, and takes ONE blow');
  const size = () => ({ radius: FRAG.glassM, power: FRAG.glassPower, who: 1 });
  const CASES: [string, number, (R: any) => boolean, string][] = [
    ['annealed', 1.0, R => R.open(PM) > 0.3 && !!R.gb.paneInfo(PM)?.run, 'float glass runs and its pieces fall'],
    ['tempered', 1.5, R => R.open(PM) === 1, 'toughened glass dices and comes down'],
    ['laminated', 0.6, R => R.open(PM) === 1, 'the laminated sheet leaves its frame'],
  ];
  let n = 0;
  for (const [type, off, broke, what] of CASES) {
    const p = [7.5, 0, GZ + off]; n++;
    // the grenade, as played …
    const R = await rig(31 + n); R.park(); R.types({ [PW]: type, [PM]: type, [PE]: type }); const rep = R.frag(p); const blows = GB_STATS.blasts; R.settle(2.5);
    const mine = PANES.map(bi => R.state(bi));
    // … and the fracture model's own blast at the burst's size, alone, in a fresh floor
    const L = await rig(31 + n); L.park(); L.types({ [PW]: type, [PM]: type, [PE]: type }); L.step(13); L.gb.blast(rep ? [rep.at[0], rep.at[1] + FRAG.lift, rep.at[2]] : lifted(p), size()); L.settle(2.5);
    const lone = PANES.map(bi => L.state(bi));
    const { d, k } = strengthAt(R.g, PM, p);
    F.verdict(!!rep && broke(R), `(${n}a) ${type}, a grenade ${off} m off it (strength ${f2(k)} at ${f2(d)} m): ${what}`, PANES.map(bi => R.pane(bi)).join(' | '));
    F.verdict(mine.join() === lone.join() && FRAG.glassPower > 0, `(${n}b) …each pane ending exactly where GlassBreak.blast of that size alone puts it`, `grenade: ${mine[1]}\n    alone:   ${lone[1]}${mine.join() === lone.join() ? '' : `\n    grenade ${mine.join(' / ')}\n    alone   ${lone.join(' / ')}`}`);
    F.verdict(blows === 1, `(${n}c) …as ONE blow (the burst's own, and the stun-sized 'bang' of the same charge arriving behind it)`, `${blows} blow(s) counted by the fracture model`);
  }
  // a destruction engine's blast entry point feeding the glass too (the build that has one calls GlassBreak.blast from its own blast(): stood in for here)
  { const p = [7.5, 0, GZ + 1.0];
    const R = await rig(41); R.park(); let fed = 0;
    R.g.destr.blast = (a: Vec3, o: any = {}) => { fed++; const power = o.power ?? 1; R.gb.blast(a, { radius: (o.radius ?? 2.2) * power, power, who: o.who }); R.g.destr.bang(a, o.who); };
    const rep = R.frag(p); const blows = GB_STATS.blasts; R.settle(2.5); const withEngine = PANES.map(bi => R.state(bi));
    const L = await rig(41); L.park(); L.frag(p); L.settle(2.5); const without = PANES.map(bi => L.state(bi));
    F.verdict(!!rep && fed === 1 && blows === 1 && withEngine.join() === without.join(), '(4) with a destruction engine\'s blast feeding the same glass entry point: still one blow, the panes where the burst alone puts them', `engine called ${fed}× · ${blows} blow(s) · ${withEngine[1]}${withEngine.join() === without.join() ? '' : `\n    without: ${without.join(' / ')}\n    with:    ${withEngine.join(' / ')}`}`); }
  // the 40 mm round itself, fired down the corridor to burst on the floor by the glass
  { const R = await rig(43); const g = R.g; const [A] = g.guards; R.park(A); const man = [7.5, 0, 9.2]; R.put(A, man, [7.5, 0, 11]); R.step(2);
    g.teleportPlayer([17.5, 0, 11.2]); R.step(2);
    fireShell(g, g.player.char, [17.0, 1.4, 11.2], [7.6, 0.05, 11.1]); for (let i = 0; i < 240 && !HE40_LOG.length; i++) R.step();
    const end = HE40_LOG[0]; const blows = GB_STATS.blasts; R.settle(2.5); const rep = end?.report;
    const broke = PANES.filter(bi => R.open(bi) > 0);
    F.verdict(!!end && end.armed && !!rep && broke.length > 0 && blows === 1 && !!hitOf(rep, A) && hitOf(rep, A).result !== 'shielded', '(5) a 40 mm round fired 9 m down the corridor bursts by the glass: the panes by it break, one blow, and the man behind them is hit', end ? `burst ${at(end.at)} (${end.met}, armed ${end.armed}) · ${blows} blow(s) · ${PANES.map(bi => R.pane(bi)).join(' | ')} · ${rep ? hitLine(rep, A) : 'no report'}` : 'the round never ended'); }
  // played: Sam's own keys — 5 puts the grenade in the fist, a click throws it down the corridor to the floor by the glazing
  { const R = await rig(45); const g = R.g, input = R.W.input, pl = g.player; const [A] = g.guards; R.park(A); const man = [7.5, 0, 9.0]; R.put(A, man, [7.5, 0, 11]);
    g.teleportPlayer([14.5, 0, 11.2]); pl.char.bodyYaw = -Math.PI / 2; pl.char.aimYaw = -Math.PI / 2; R.step(5);
    input.pressed.add('Digit5'); R.step(2); const target = [7.6, 0.1, 11.2]; for (let i = 0; i < 6; i++) { R.W.cursorAt(target); R.step(); }
    const n0 = pl.frags; R.W.cursorAt(target); input.buttons |= 1; input.clicked |= 1; R.step(); input.buttons = 0;
    for (let i = 0; i < (FRAG.fuse + 3) * 60 && !FRAG_LOG.length; i++) { R.put(A, man, [7.5, 0, 11]); R.step(); }   // (the man kept where he was stood: the fuse is long enough for his patrol to walk him off)
    const rep = FRAG_LOG[0] ?? null; const blows = GB_STATS.blasts; R.settle(2.5);
    const broke = PANES.filter(bi => R.open(bi) > 0); const h = rep ? hitOf(rep, A) : null;
    F.verdict(!!rep && pl.frags === n0 - 1 && broke.length > 0 && blows === 1 && !!h && h.result !== 'shielded', '(6) played with Sam\'s own keys (5, a click) from 7 m down the corridor: the grenade bursts by the glazing, the glass comes down, one blow, the man behind it is hit', rep ? `frags ${n0}→${pl.frags} · burst ${at(rep.at)} · ${blows} blow(s) · ${PANES.map(bi => R.pane(bi)).join(' | ')} · ${hitLine(rep, A)}` : `no blast (slot ${pl.slot}, frags ${pl.frags})`); }
  return F.done();
});

// ---------------------------------------------------------------- burst-open
/** one burst in the corridor west of the glazing: float glass nearest it (breaks), laminated next (crazes, stands), toughened farthest (untouched) — a man behind each */
async function openCase(seed: number, base?: boolean) {
  const R = await rig(seed, { base }); const g = R.g; const [A, B, C] = g.guards;
  R.types({ [PW]: 'annealed', [PM]: 'laminated', [PE]: 'tempered' });
  const p = [5.2, 0, 11.2]; const men: [any, number[], number][] = [[A, [7.0, 0, 9.0], PW], [B, [9.2, 0, 8.6], PM], [C, [10.15, 0, 9.4], PE]];
  for (const [m, q] of men) R.put(m, q, p); R.step(2);
  const stag0 = men.map(([m]) => m.staggerUntil);
  const body = men.map(([m]) => ({ feet: [...m.char.pos] as Vec3, head: [...(m.char.bones.head ?? [m.char.pos[0], 1.6, m.char.pos[2]])] as Vec3 }));
  const rep = R.frag(p); R.settle(2.5);
  return { R, g, p, men, stag0, body, rep };
}
export const burstOpen = guarded(async () => {
  const F = family('burst-open: a man behind the pane the burst broke is judged by what is open, the men behind the panes it left whole are not hurt');
  const c = await openCase(51); const { R, g, p, men, rep } = c; const [A, B, C] = men.map(m => m[0]);
  if (!rep) { F.verdict(false, 'staging', 'no blast'); return F.done(); }
  const ks = men.map(([, , bi]) => strengthAt(g, bi, p));
  F.verdict(R.open(PW) > 0 && R.open(PM) === 0 && R.open(PE) === 0, '(a) the float pane nearest the burst has broken; the laminated pane beside it and the toughened pane beyond stand', `${PANES.map((bi, i) => `${R.pane(bi)} (strength ${f2(ks[i].k)})`).join(' | ')}`);
  const hA = hitOf(rep, A);
  F.verdict(!!hA && hA.result !== 'shielded' && hA.exposed > 0 && (A.state === 'dead' || A.staggerUntil !== c.stag0[0]), `(b) ${A.callsign}, behind the broken pane, is hit through the part that went`, hitLine(rep, A));
  F.verdict([B, C].every((m, i) => hitOf(rep, m)?.result === 'shielded' && m.state !== 'dead' && m.staggerUntil === c.stag0[i + 1]), `(c) ${B.callsign} behind the laminated pane and ${C.callsign} behind the toughened one, both inside the wound radius, are untouched`, `${hitLine(rep, B)} · ${hitLine(rep, C)}`);
  // what the blast judged open (the report's share of each man) is what is open now that the glass has finished falling
  { const now = c.body.map(b => exposure(g, lifted(p), b.feet, b.head, 'whole')); const then = men.map(([m]) => hitOf(rep, m)?.exposed ?? NaN);
    F.verdict(now.every((e, i) => Math.abs(e - then[i]) < 1e-9), '(d) the share of each man the blast judged in its line is the share really open two and a half seconds later (nothing judged through glass that then stood, nothing missed that then fell)', men.map(([m], i) => `${m.callsign} judged ${then[i]} · open now ${now[i]}`).join(' · ')); }
  // every line through the glazing from this burst, on a grid of points north of it: judged at the burst ≡ open afterwards
  { const R2 = await rig(52); R2.park(); R2.types({ [PW]: 'annealed', [PM]: 'laminated', [PE]: 'tempered' }); R2.step(13);
    const from = lifted(p); R2.gb.blast(from, { radius: FRAG.glassM, power: FRAG.glassPower, who: 1 });
    const pts: Vec3[] = []; for (let x = 5.6; x <= 12.4; x += 0.4) for (const z of [9.5, 9.0, 8.4]) for (const y of [0.7, 1.1, 1.6, 2.1]) pts.push([x, y, z]);
    const judged = pts.map(q => burstLine(R2.g, from, q, 'blown')); R2.settle(2.5); const after = pts.map(q => burstLine(R2.g, from, q, 'whole'));
    const wrong = pts.filter((_, i) => judged[i] !== after[i]);
    F.verdict(wrong.length === 0 && judged.some(Boolean) && judged.some(x => !x), '(e) over a grid of points beyond the glazing: a line the blast takes as open is open once the glass has fallen, and no other', `${pts.length} points · ${judged.filter(Boolean).length} open · ${wrong.length} disagree${wrong.length ? ` (first ${wrong.slice(0, 4).map(q => q.map(f2).join(',')).join(' ; ')})` : ''}`); }
  return F.done();
});

/** every free spot on a grid north of the glazing as a burst point, the chest of a man in the corridor south of it as its mark: the three reckonings of the glass
 *  between them (frag.ts GlassView) against what a real blast there then does to it */
async function spotGrid(type: string, base?: boolean) {
  const CHEST: Vec3 = [7.4, 1.1, 11.3]; const R = await rig(61, { base }); R.park(); const g = R.g; const T = { [PW]: type, [PM]: type, [PE]: type }; R.types(T); R.step(13);
  let counted = 0, stood = 0, wary = 0, sheltered = 0, whole = 0, n = 0;
  for (let x = 5.4; x <= 9.0; x += 0.3) for (let z = 6.0; z <= 9.4; z += 0.3) { if (g.col.nav.isBlocked(x, z)) continue; n++;
    const from: Vec3 = [x, FRAG.lift + 0.05, z];
    const cnt = burstLine(g, from, CHEST, 'counted'), wry = burstLine(g, from, CHEST, 'wary'), wh = burstLine(g, from, CHEST, 'whole');
    R.gb.blast(from, { radius: FRAG_DEFAULTS.glassM, power: FRAG_DEFAULTS.glassPower, who: 1 }); const now = burstLine(g, from, CHEST, 'blown'); R.settle(2.2); const later = burstLine(g, from, CHEST, 'whole'); R.gb.reset(); R.types(T);
    if (cnt) counted++; if (cnt && !(now && later)) stood++; if (wry) wary++; if (!wry && (now || later)) sheltered++; if (wh) whole++; }
  return { n, counted, stood, wary, sheltered, whole, line: `${n} spots · counted on ${counted} (of which the pane then stood: ${stood}) · wary of ${wary} (cover that then broke: ${sheltered}) · a line with the glass taken as a wall: ${whole}` };
}

// ---------------------------------------------------------------- burst-theirs
export const burstTheirs = guarded(async () => {
  const F = family("burst-theirs: the defenders' throw obeys their side's rule on glass");
  // (1) the reckonings, on a grid of throw spots on the thrower's side of the glazing, a man in the corridor behind it
  for (const type of ['annealed', 'tempered', 'laminated']) { const c = await spotGrid(type);
    F.verdict(c.n > 20 && c.stood === 0 && c.sheltered === 0 && c.whole === 0 && c.counted > 0, `(1 ${type}) what a thrower counts on the burst opening, it opens; no cover is glass the burst would break; standing glass is a wall to a side told so`, c.line); }
  // (2) the carrier himself, in a room fight, a lit man in the corridor behind standing float glass and nobody else near. Every gun on the floor is kept empty, so
  // nothing but a grenade could open the glass; the carrier is kept where he was stood (told he has no shot he would otherwise walk round through the door).
  const stage = async (seed: number, foes: boolean, base = false) => {
    const R = await rig(seed, { base }); const g = R.g; g.aiEnabled = true; g.godMode = true; FRAG.defenders = true; GLASSPEN.foesThrough = foes;
    g.roomClear.start(seed); R.step(32); const deal: any[] = fragCarriers(g); const C = deal[0] ?? g.nightBreach.hostiles[0];
    const CAR = [7.4, 0, 5.3], T1 = [7.3, 0, 11.2];
    g.guards.filter((x: any) => x !== C).forEach((x: any, i: number) => R.put(x, [60 + 2 * i, 0, 60]));
    C.god = true; R.put(C, CAR, T1); g.teleportPlayer(T1);
    const dry = () => { for (const x of g.guards) if (x.weapon) { x.weapon.chamber = 0; x.weapon.mag = 0; x.weapon.reloadT = -1; } };
    for (const k of Object.keys(FRAG_WHY)) delete FRAG_WHY[k];
    let item: any = null, energy: number | undefined = NaN, alertT = 0;
    for (let i = 0; i < 10 * 60 && !FRAG_LOG.length; i++) { dry(); if (!item) { C.char.pos = [CAR[0], 0, CAR[2]]; C.char.vel = [0, 0, 0]; }
      g.player.visibility = 1; R.W.step(DT); if (C.state === 'alert') { alertT += DT; energy = shotEnergy(g, C.char, C.weapon.def); }
      if (!item) item = g.items.items.find((x: any) => x.kind === 'frag') ?? null; }
    for (let i = 0; i < 60; i++) { dry(); R.step(); } const rep = FRAG_LOG[0] ?? null;
    return { R, g, C, item, energy, alertT, rep, whyNot: { ...FRAG_WHY }, theirs: FRAG_STATS.theirs, rounds: GB_STATS.impacts, whole: PANES.every(bi => R.open(bi) === 0), panes: PANES.map(bi => R.pane(bi)).join(' | '),
      line: `${C.callsign} ${C.state} (alert ${f2(alertT)} s) · his gun's energy for a pane ${energy === undefined ? 'the default' : f2(energy)} · thrown ${FRAG_STATS.theirs}${rep ? ` → burst ${at(rep.at)}, ${rep.at[2] < GZ ? 'HIS side of the glass' : 'the far side'}` : ''} · why not ${JSON.stringify(FRAG_WHY)} · rounds into glass ${GB_STATS.impacts}` };
  };
  const SEEDS = [3, 5, 8];
  { let none = 0, wanted = 0, zero = 0, clean = 0; const lines: string[] = [];
    for (const s of SEEDS) { const a = await stage(s, false);
      if (!a.item && a.theirs === 0) none++; if ((a.whyNot.arc ?? 0) > 0) wanted++; if (a.energy === 0) zero++; if (a.rounds === 0 && a.whole) clean++;
      lines.push(`seed ${s}: ${a.line} · ${a.panes}`); }
    F.verdict(clean === SEEDS.length && none === SEEDS.length && zero === SEEDS.length, '(2a) ?glassfoes=0: his rifle has nothing for the pane (the man is where it cannot follow) and no grenade leaves his hand for a spot on his own side of it', `${none}/${SEEDS.length} threw nothing · ${zero}/${SEEDS.length} guns at energy 0 · glass untouched in ${clean}\n    ${lines.join('\n    ')}`);
    F.verdict(wanted === SEEDS.length, '(2b) …not for want of trying: he looked for a spot with a line to the man and found none — the glass, taken as the wall his rifle takes it for', `${wanted}/${SEEDS.length} came to 'arc' (no spot)`); }
  { let through = 0, noAsk = 0; const lines: string[] = [];
    for (const s of SEEDS) { const a = await stage(s, true);
      if ((a.energy ?? 0) > 0) through++; if (!a.theirs && !(a.whyNot.arc ?? 0) && (a.whyNot.line ?? 0) > 0) noAsk++;
      lines.push(`seed ${s}: ${a.line} · ${a.panes}`); }
    F.verdict(through === SEEDS.length && noAsk === SEEDS.length, '(2c) the default (?glassfoes=1): the question is asked with his own gun\'s energy, as every round of his asks it — his rifle has the line through the glass, so no grenade is looked for', `${through}/${SEEDS.length} with energy · ${noAsk}/${SEEDS.length} never looked for a spot\n    ${lines.join('\n    ')}`); }
  return F.done();
});

// ---------------------------------------------------------------- burst-off
export const burstOff = guarded(async () => {
  const F = family('burst-off: with the glass parts off a burst asks the fracture model nothing');
  const R = await rig(71, { glass: false }); const g = R.g; const [A] = g.guards; R.park(A);
  const man = [7.5, 0, 9.3], p = [7.5, 0, GZ + 1.0]; R.put(A, man, p); R.step(2);
  let asked = 0; for (const k of ['seeThrough', 'goingAt', 'wouldGive']) { const f = R.gb[k].bind(R.gb); R.gb[k] = (...a: any[]) => { asked++; return f(...a); }; }
  const from = lifted(p); const views = ['blown', 'wary', 'counted', 'whole'].map(v => exposure(g, from, man as Vec3, [7.5, 1.65, 9.3], v as any));
  const rep = R.frag(p); R.settle(2);
  F.verdict(!!rep && GB_STATS.blasts === 0 && R.gb.panes.size === 0 && PANES.every(bi => R.open(bi) === 0), '(a) a grenade a metre off the glazing: no pane has a record, no blow counted', `${GB_STATS.blasts} blows · ${R.gb.panes.size} pane records · ${rep ? hitLine(rep, A) : 'NO BLAST'}`);
  F.verdict(asked === 0 && views.every(v => v === views[0]), '(b) every view of the glass is the one solid walk, and the fracture model is never asked', `asked ${asked}× · exposure by view ${views.join(' / ')}`);
  F.verdict(hitOf(rep, A)?.result === 'shielded' && A.state !== 'dead', '(c) the pane is the wall it was: the man behind it is untouched', rep ? hitLine(rep, A) : 'NO BLAST');
  // glass that cannot break but that rounds go through (a host without the fracture model, chaos 0): the burst is to a pane what it was on the base build
  { const one = async (base: boolean) => { const R2 = await rig(72, { glass: false, pen: true, base }); const [B] = R2.g.guards; R2.park(B); R2.put(B, man, p); R2.step(2); const r = R2.frag(p); R2.settle(1); return `${r ? hitLine(r, B) : 'NO BLAST'} · ${GB_STATS.blasts} blows · ${R2.gb.panes.size} pane records`; };
    const mine = await one(false), was = await one(true);
    F.verdict(mine === was && /killed|wounded/.test(mine), '(d) rounds through glass on, the fracture model off: a burst is to a pane what it was before (a pistol round\'s toll) — the same result under the base build\'s numbers', `now: ${mine}\n    base numbers: ${was}`); }
  return F.done();
});

// ---------------------------------------------------------------- burst-red
/** the probe's own red path: under the base build's numbers the stagings above FAIL (so a pass above is not a staging that cannot fail) */
export const burstRed = guarded(async () => {
  const F = family('burst-red: under the base build\'s numbers the same stagings come back red');
  if (baseEnv()) { F.verdict(true, '(skipped) BURSTGLASS_BASE=1: the whole family is already on the base\'s numbers', '—'); return F.done(); }
  { const c = await wholeCase(21, 'tempered', 3.0, 'frag', true);
    F.verdict(!!c.rep && c.hurt, '(a) burst-whole (a) with a fragment given a pistol round\'s energy for a pane: the man behind the standing toughened pane IS hit', c.line); }
  { const c = await wholeCase(22, 'annealed', 3.9, 'frag', true);
    F.verdict(!!c.rep && c.hurt, '(b) burst-whole (b) likewise, through standing float glass', c.line); }
  { const R = await rig(32, { base: true }); R.park(); R.types({ [PW]: 'tempered', [PM]: 'tempered', [PE]: 'tempered' }); const rep = R.frag([7.5, 0, GZ + 1.5]); R.settle(2.5);
    F.verdict(!!rep && R.open(PM) === 0, '(c) burst-breaks (2a) with the burst sending glass nothing of its own: toughened glass 1.5 m off a grenade stands', R.pane(PM)); }
  { const c = await spotGrid('annealed', true);
    F.verdict(c.whole > 0, '(d) burst-theirs (1): the defenders\' spot test, a fragment given a pistol round\'s energy, has a line to a man THROUGH standing float glass (the throw the base build made onto its own side of a window)', c.line); }
  return F.done();
});
