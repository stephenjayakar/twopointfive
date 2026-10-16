// The 'gearglass' family (`bun run tools/qa/probes.ts gearglass | gearglass-joined | gearglass-pinned`): what the three gear-and-glass parts could not check
// alone — BOTH records of a pane live at once (the fracture model's, which a burst writes: game/frag.ts → glassbreak.ts blast; and a shell's own, which a load
// of shot writes: shotgun.ts Shell.glass → glasspen.ts, the shell rule) — and the one line a pinned defender is asked about under ?glassfoes=0.
// PASS / FAIL each, all headless on the real game with the glass parts ON (raised by name, put back after); staged on the conference room's glazing (three
// 1 × 2 m panes over a half-metre sill along z = 10, the room north of them, the corridor south). No picture and no sound.
//   gearglass-joined   (a) a shell at a frame a burst has EMPTIED (toughened glass, diced): nothing is filed — no row in the shell's record, no blow, no hole
//                      remembered, no 'glass' event — and the nine fly on to the man beyond. (b) a shell at a float pane a burst has PARTLY taken: every row
//                      of the shell's record lies on glass that stood before the pull, the record obeys the shell rule, the fracture model was given exactly
//                      its marks and the holes exactly the marks that went through, and all nine still end beyond the glass. (c) a burst beside a pane a
//                      shell has HOLED: one blow, the pane ending exactly where the fracture model's own blast puts that holed pane; the burst has a line
//                      through the shell's hole before it goes off; and over a grid of points beyond the glazing a line the blast takes as open is open
//                      once the glass has fallen, and no other. Also: the same shell four frames behind the burst (pieces still queued), a shell on a laminated sheet a
//                      burst has starred (marks and joins, the energy on top of the blast's), and the grenade's own report of a man behind a shell's hole
//   gearglass-pinned   ?glassfoes=0, a room defender held on his post (pinned: the alert branch never asks him clearShot) with a lit man in plain view
//                      behind standing glass and nothing else in the line: no round leaves his gun, the glass is untouched, and he stays on his man (he is
//                      not sent to search for somebody he can see). The default (his side shoots through glass): he fires through it, as before
import { standUp, ROOT } from './headless.ts';
import { CONF_PANES } from './office-pane.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { FRAG, FRAG_LOG, fragStatsReset, burstLine, exposure } = await import(`${ROOT}/src/game/frag.ts`);
const { GB_STATS } = await import(`${ROOT}/src/game/glassbreak.ts`);
const { GLASSPEN, GLASSPEN_STATS, holeCount, shotEnergy } = await import(`${ROOT}/src/game/glasspen.ts`);
const { GLASSFX, GLASS } = await import(`${ROOT}/src/game/glass.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const { SHOTGUN_LAST } = await import(`${ROOT}/src/game/shotgun.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}

/** the conference room's glazing along z = 10 (its three sheets: x 6‥7, 7‥8, 8‥9; y 0.5‥2.5) */
const [PW, PM, PE] = CONF_PANES, PANES = [PW, PM, PE], GZ = 10;   // (by where they stand, office-pane.ts: the door-size export moved each index up one)
const FRAG_DEFAULTS = JSON.parse(JSON.stringify(FRAG));
const SWITCHES = { pen: GLASSPEN.on, foes: GLASSPEN.foesThrough, fx: GLASSFX.on, random: Math.random };
/** every probe leaves the module switches and knobs as it found them (the runner's next probe stands up on them) */
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { Object.assign(FRAG, JSON.parse(JSON.stringify(FRAG_DEFAULTS))); GLASSPEN.on = SWITCHES.pen; GLASSPEN.foesThrough = SWITCHES.foes; GLASSFX.on = SWITCHES.fx; Math.random = SWITCHES.random; } };

/** One office under a seed with the glass parts on (fracture, rounds through glass, shards as the stand-up leaves them), AI off, Sam out of it. */
async function rig(seed: number) {
  Object.assign(FRAG, JSON.parse(JSON.stringify(FRAG_DEFAULTS))); fragStatsReset(); for (const k of Object.keys(GB_STATS)) (GB_STATS as any)[k] = 0;
  Math.random = seeded(seed);
  const W: any = await standUp(); const g = W.game;
  GLASSFX.on = true; GLASSPEN.on = true; GLASSPEN.foesThrough = true; g.tune.glassBreak = true; g.tune.chaos = 0.5;
  g.aiEnabled = false; g.godMode = true; g.teleportPlayer([24, 0, 17.6]);
  const gb = g.glassBreak; const seen = new WeakSet<any>(), events: any[] = [];
  const R = { W, g, gb, events,
    step(n = 1) { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); for (const e of g.events) { if (!seen.has(e)) { seen.add(e); events.push(e); } } } },
    settle(secs: number) { R.step(Math.round(secs * 60)); },
    types(t: string) { for (const bi of PANES) gb.setType(bi, t); },
    put(gd: any, p: number[], face?: number[]) { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.lastPos = [p[0], 0, p[2]]; if (face) { const y = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.char.bodyYaw = y; gd.char.aimYaw = y; } },
    park(...keep: any[]) { let k = 0; for (const x of g.guards) if (!keep.includes(x)) R.put(x, [60 + 2 * k++, 0, 60]); },
    /** a grenade on a short fuse at p; the blast's report once it has gone */
    frag(p: number[]): any { const n0 = FRAG_LOG.length; g.items.spawn('frag', [p[0], 0.05, p[2]], [0, 0, 0], { fuse: 0.2, who: 1 }); for (let i = 0; i < 120 && FRAG_LOG.length === n0; i++) R.step(); R.step(1); return FRAG_LOG[n0] ?? null; },
    /** ONE PULL of the M870 from a muzzle put at `from`, aimed at `to`, the shoulder a forearm behind it on the line: the player's own round */
    shell(from: Vec3, to: Vec3) { const c = g.player.char, m0 = c.muzzle, a0 = c.bones.upperArmR, d = v3.normalize(v3.sub(to, from));
      c.muzzle = [...from] as Vec3; c.bones.upperArmR = v3.mad(from, d, -0.3);
      try { fireWeapon(g, c, to, true, { weapon: (WEAPONS as any).m870 }); } finally { c.muzzle = m0; c.bones.upperArmR = a0; }
      R.step(1); },
    open(bi: number): number { const i = gb.paneInfo(bi); return i ? (i.gone ? 1 : i.openFraction) : 0; },
    pane(bi: number) { const i = gb.paneInfo(bi); return i ? `${bi} ${i.type} ${Math.round(100 * i.openFraction)}% open${i.gone ? ' GONE' : ''}${i.run ? ' run' : ''}` : `${bi} —`; },
    /** the fracture model's state of a pane, as one comparable line */
    state(bi: number): string { const i = gb.paneInfo(bi), st = gb.panes.get(bi); return i ? `${i.type} open ${i.openFraction.toFixed(4)} gone ${i.gone} run ${i.run} sites ${i.sites} energy ${i.energy.toFixed(4)} damage ${(st?.damage ?? 0).toFixed(4)}` : 'none'; },
    hits(): number { let n = 0; for (const bi of PANES) n += gb.panes.get(bi)?.hits ?? 0; return n; },
    holes(): number { let n = 0; for (const bi of PANES) n += holeCount(g, bi); return n; },
    glassEvents(): number { return events.filter((e: any) => e.kind === 'glass' && e.level === GLASS.hearLevel).length; },
  };
  R.step(2);
  return R;
}
type Rig = Awaited<ReturnType<typeof rig>>;
const lifted = (p: number[]): Vec3 => [p[0], 0.05 + FRAG.lift, p[2]];
/** the shell's own record over the three panes: [pane, x, y, z, through, mark] per pellet that met glass */
function rows(): number[][] { const out: number[][] = []; for (const bi of PANES) { const r: number[] = SHOTGUN_LAST.glass.get(bi) ?? []; for (let i = 0; i < r.length; i += 5) out.push([bi, r[i], r[i + 1], r[i + 2], r[i + 3], r[i + 4]]); } return out; }
/** THE SHELL RULE read off one pane's record (null = it holds): in order, a pellet is a MARK iff no earlier mark it may join lies within r of it */
function recordBreaks(rec: number[], r: number): string | null {
  for (let i = 0; i < rec.length; i += 5) {
    let near = false;
    for (let k = 0; k < i; k += 5) { if (!rec[k + 4] || (rec[i + 3] && !rec[k + 3])) continue; if (Math.hypot(rec[k] - rec[i], rec[k + 1] - rec[i + 1], rec[k + 2] - rec[i + 2]) < r) { near = true; break; } }
    if (near === !!rec[i + 4]) return `pellet row ${i / 5}: ${rec[i + 4] ? 'filed a mark' : 'joined'} with ${near ? 'a' : 'no'} mark of its shell within ${r} m`;
  }
  return null;
}
/** pellets of the last shell that ended north of the glazing (beyond it, fired from the corridor) */
const beyond = () => (SHOTGUN_LAST.ends as any[]).filter(e => e.at[2] < GZ - 0.05).length;

// ================================================================ gearglass-joined
/** a burst `off` m south of the glazing (all three panes of `type`), everybody parked, then `wait` seconds for the glass (2.5: it has finished falling; a few frames: it is still on its way out) */
async function burstThen(seed: number, type: string, off: number, wait = 2.5) {
  const R = await rig(seed); const g = R.g; R.park(); R.types(type); R.step(2);
  const rep = R.frag([7.5, 0, GZ + off]); R.settle(wait);
  return { R, g, rep };
}
/** one man stood 1.5 m north of the glazing at x, facing it */
function behind(R: Rig, x: number): any { const B = R.g.guards[1]; R.put(B, [x, 0, 8.5], [x, 0, 12]); B.char.update(0); B.char.update(DT); return B; }
const paneAt = (x: number) => (x < 7 ? PW : x < 8 ? PM : PE);
export const gearglassJoined = guarded(async () => {
  const F = family('gearglass-joined: a shell at glass a burst has broken, a burst beside glass a shell has holed — both records live at once');
  const pe = (GLASSPEN.energy.m870 ?? GLASSPEN.defaultEnergy) * GLASSPEN.fractureK;
  // (a) the frame emptied
  { const from: Vec3 = [7.5, 1.35, GZ + 4], to: Vec3 = [7.5, 1.35, GZ - 3];
    const { R, rep } = await burstThen(61, 'tempered', 1.5); const B = behind(R, 7.5);
    const gone = PANES.every(bi => R.open(bi) === 1); const h0 = R.hits(), o0 = R.holes(), e0 = R.glassEvents(), i0 = GB_STATS.impacts, c0 = GLASSPEN_STATS.crossed + GLASSPEN_STATS.spent;
    R.shell(from, to); R.step(2); const rec = rows();
    F.verdict(!!rep && gone, '(a) staged: a grenade 1.5 m off toughened glazing dices all three panes; the frames stand empty', PANES.map(bi => R.pane(bi)).join(' | '));
    F.verdict(rec.length === 0 && R.hits() === h0 && GB_STATS.impacts === i0 && R.holes() === o0 && R.glassEvents() === e0 && GLASSPEN_STATS.crossed + GLASSPEN_STATS.spent === c0, '(a) a shell through the emptied frames files NOTHING: no row in its record, no blow in the fracture model, no hole remembered, no \'glass\' event, no crossing counted', `rows ${rec.length} · blows ${R.hits() - h0} (impacts ${GB_STATS.impacts - i0}) · holes ${R.holes() - o0} · events ${R.glassEvents() - e0} · crossings ${GLASSPEN_STATS.crossed + GLASSPEN_STATS.spent - c0}`);
    F.verdict(beyond() === 9 && B.state === 'dead', '(a) …and it is nine rounds beyond: the man 1.5 m behind the frame is down', `pellets ended beyond the glazing ${beyond()} of ${SHOTGUN_LAST.ends.length} · ${B.callsign} ${B.state}`); }
  // (b) the panes partly taken: the shell on the SAME floor as the burst, its rows read against a twin floor that had the burst and no shell. The shell is aimed
  // at the edge of what the burst left — the point of the glazing with nearest to half of the glass round it (a pattern's width at 4 m) gone. Twice: with the
  // glass done falling (2.5 s on), and FOUR FRAMES after the burst (its pieces still queued to leave: the fracture model mid-break under the shell)
  for (const [tag, wait] of [['b', 2.5], ['b\'', 4 / 60]] as [string, number][]) {
    const OFF = 3.3;
    const { R, rep } = await burstThen(62, 'annealed', OFF, wait);
    const T = await burstThen(62, 'annealed', OFF, wait);   // (the twin: what stood before the pull)
    const was = (x: number, y: number) => T.R.gb.openAt(paneAt(x), [x, y, GZ]);
    const queued = PANES.reduce((n, bi) => n + (R.gb.panes.get(bi)?.pending.length ?? 0), 0);
    let aim: [number, number] = [7.5, 1.35], best = 1;
    for (let x = 6.3; x <= 8.71; x += 0.1) for (let y = 0.8; y <= 2.21; y += 0.1) { let n = 0, o = 0; for (let dx = -0.2; dx <= 0.201; dx += 0.1) for (let dy = -0.2; dy <= 0.201; dy += 0.1) { n++; if (was(x + dx, y + dy)) o++; } const off = Math.abs(o / n - 0.5); if (off < best - 1e-9) { best = off; aim = [x, y]; } }
    const from: Vec3 = [aim[0], aim[1], GZ + 4], to: Vec3 = [aim[0], aim[1], GZ - 3]; const B = behind(R, aim[0]);
    const same = PANES.every(bi => R.state(bi) === T.R.state(bi)); const part = wait > 1 ? PANES.every(bi => R.open(bi) > 0.02 && R.open(bi) < 0.98) : PANES.some(bi => R.open(bi) > 0) && PANES.every(bi => R.open(bi) < 0.98);
    F.verdict(!!rep && same && part && best < 0.3 && (wait > 1 ? queued === 0 : queued > 0), `(${tag}) staged: a grenade ${OFF} m off float glazing takes PART of each pane, ${wait > 1 ? 'the glass done falling' : `the shell ${Math.round(wait * 60)} frames behind it, ${queued} pieces still queued to leave`} (a twin floor stands the same, for what stood before the pull); the shell is aimed at the edge of what is left`, `${PANES.map(bi => R.pane(bi)).join(' | ')} · aim (${f2(aim[0])}, ${f2(aim[1])}), ${Math.round(100 * (0.5 - best))}–${Math.round(100 * (0.5 + best))}% of the glass round it gone${same ? '' : ` · TWIN DIFFERS ${PANES.map(bi => T.R.pane(bi)).join(' | ')}`}`);
    const h0 = R.hits(), o0 = R.holes(), blasts0 = GB_STATS.blasts;
    R.shell(from, to); const rec = rows(); const marks = rec.filter(r => r[5]).length, marksThrough = rec.filter(r => r[5] && r[4]).length, joinedStopped = rec.filter(r => !r[5] && !r[4]).length;
    const onOpen = rec.filter(r => T.R.gb.openAt(r[0], [r[1], r[2], r[3]])).length;
    // the pellets with no row, each on its straight line from the muzzle: where it passed the glazing was open before the pull (the burst's doing) or is open now
    // (a piece an earlier pellet of this shell took out with it) — never glass that stood and still stands
    let byBurst = 0, byShell = 0, ghost = 0;
    for (const e of SHOTGUN_LAST.ends as any[]) { const k = (GZ - from[2]) / (e.at[2] - from[2]); if (!(k > 0 && k < 1)) continue; const X: Vec3 = [from[0] + (e.at[0] - from[0]) * k, from[1] + (e.at[1] - from[1]) * k, GZ];
      if (X[0] < 6 || X[0] > 9 || X[1] < 0.5 || X[1] > 2.5 || rec.some(r => Math.hypot(r[1] - X[0], r[2] - X[1]) < 0.03)) continue;
      if (was(X[0], X[1])) byBurst++; else if (R.gb.openAt(paneAt(X[0]), X)) byShell++; else ghost++; }
    F.verdict(rec.length > 0 && rec.length < 9 && onOpen === 0 && ghost === 0 && byBurst > 0, `(${tag}) every row of the shell's record lies on glass that STOOD before the pull; a pellet with no row went by a hole — the burst's, or the piece an earlier pellet of its own shell took out — and none passed glass that stands`, `${rec.length} of 9 pellets met glass · ${onOpen} of those rows on a place the burst had already opened · no row: ${byBurst} by the burst's hole, ${byShell} by the shell's own, ${ghost} through standing glass`);
    const broke = PANES.map(bi => recordBreaks(SHOTGUN_LAST.glass.get(bi) ?? [], GLASSPEN.shellR)).find(Boolean) ?? null;
    F.verdict(!broke && R.hits() - h0 === marks + joinedStopped && R.holes() - o0 === marksThrough && GB_STATS.blasts === blasts0, `(${tag}) the fracture model was given exactly the shell's marks, the holes exactly the marks that went through (float glass a burst has run comes away a piece at a time: the record is short, the laminated case below is the one with joins)`, `${broke ?? 'rule holds'} · marks ${marks} (through ${marksThrough}) · blows filed ${R.hits() - h0} · holes remembered ${R.holes() - o0}`);
    R.step(2);
    F.verdict(beyond() === 9 && B.state === 'dead', `(${tag}) …and all nine end beyond the glass, by the hole or through the sheet: the man behind it is down`, `pellets ended beyond the glazing ${beyond()} of ${SHOTGUN_LAST.ends.length} · ${B.callsign} ${B.state}`); }
  // (l) a laminated sheet a burst has starred and left in its frame, then a shell from a metre: nine pellets in a hand's breadth, most of them ON a mark of
  // their own shell — the rule's joins, on glass the fracture model already holds a blast's energy for
  { const { R, rep } = await burstThen(63, 'laminated', 2.5); const B = behind(R, 7.5);
    const st = () => R.gb.panes.get(PM), eBurst = st()?.energy ?? 0, stood = PANES.every(bi => R.open(bi) === 0);
    const h0 = R.hits(), o0 = R.holes(), from: Vec3 = [7.5, 1.35, GZ + 1], to: Vec3 = [7.5, 1.35, GZ - 3];
    R.shell(from, to); const rec = rows(); const marks = rec.filter(r => r[5]).length, joined = rec.length - marks, through = rec.filter(r => r[4]).length;
    const broke = PANES.map(bi => recordBreaks(SHOTGUN_LAST.glass.get(bi) ?? [], GLASSPEN.shellR)).find(Boolean) ?? null; R.step(2);
    F.verdict(!!rep && stood && eBurst > 0, '(l) staged: a grenade 2.5 m off laminated glazing stars it and leaves it in its frame — the fracture model holds the blast\'s energy for the pane', `${PANES.map(bi => R.pane(bi)).join(' | ')} · energy on the middle pane ${f2(eBurst)}`);
    F.verdict(rec.length === 9 && through === 0 && marks >= 1 && joined >= 1 && !broke, '(l) a shell from 1 m on that pane: all nine pellets stop in it, some on a mark of their own shell — the record has marks AND joins, and obeys the shell rule', `${rec.length} met the glass · through ${through} · marks ${marks} · joined ${joined} · ${broke ?? 'rule holds'}`);
    F.verdict(R.hits() - h0 === 9 && Math.abs((st()?.energy ?? 0) - eBurst - 9 * pe) < 1e-6 && R.holes() === o0, '(l) …every pellet\'s energy stays in the sheet ON TOP of what the burst left there (nothing reset, nothing counted twice), and no hole is remembered', `blows filed ${R.hits() - h0} · energy ${f2(eBurst)} → ${f2(st()?.energy ?? 0)} (+${f2((st()?.energy ?? 0) - eBurst)}, nine pellets are ${f2(9 * pe)}) · holes ${R.holes() - o0}`);
    F.verdict(beyond() === 0 && B.state !== 'dead' && R.open(PM) === 0, '(l) …nothing gets beyond it, the pane stays in its frame, the man behind it stands', `pellets ended beyond the glazing ${beyond()} · ${R.pane(PM)} · ${B.callsign} ${B.state}`); }
  // (c) a shell first (1 m: a ragged hole, the pane standing), then a burst 3 m off
  { const near: Vec3 = [7.5, 1.35, GZ + 1], to: Vec3 = [7.5, 1.35, GZ - 3], P = [7.5, 0, GZ + 3.0], size = () => ({ radius: FRAG.glassM, power: FRAG.glassPower, who: 1 });
    const holed = async (seed: number) => { const R = await rig(seed); R.park(); R.types('annealed'); R.step(2); R.shell(near, to); const rec = rows(); R.settle(1); return { R, rec }; };
    let seed = 0; for (const s of [71, 72, 73, 74, 75, 76, 77, 78]) { const t = await holed(s); if (t.rec.some(r => r[0] === PM && r[4] && r[5]) && !t.R.gb.paneInfo(PM)?.run && t.R.open(PM) > 0) { seed = s; break; } }
    if (!seed) { F.verdict(false, '(c) staging: a shell from 1 m that holes the middle float pane and leaves it standing', 'none of eight seeds did'); return F.done(); }
    const A = await holed(seed); const R = A.R, g = R.g; const before = PANES.map(bi => R.state(bi)), holes0 = R.holes();
    const hole = A.rec.find(r => r[0] === PM && r[4] && r[5])!; const hp: Vec3 = [hole[1], hole[2], hole[3]];
    const src = lifted(P), d = v3.normalize(v3.sub(hp, src)), q = v3.mad(hp, d, 0.7) as Vec3;
    F.verdict(R.gb.openAt(PM, hp) && burstLine(g, src, q, 'whole'), `(c) staged (seed ${seed}): one shell from 1 m leaves a hole in the middle float pane, which stands; a burst point 3 m off has a line through that hole before anything goes off`, `${R.pane(PM)} · holes remembered ${holes0} · the shell's first through-mark at (${f2(hp[0])}, ${f2(hp[1])}) open ${R.gb.openAt(PM, hp)} · line to 0.7 m beyond it ${burstLine(g, src, q, 'whole')}`);
    const b0 = GB_STATS.blasts; const rep = R.frag(P); const blows = GB_STATS.blasts - b0; R.settle(2.5); const mine = PANES.map(bi => R.state(bi));
    // the twin: the same shell, then the fracture model's own blast of the burst's size, alone
    const L = await holed(seed); const same0 = PANES.every((bi, i) => L.R.state(bi) === before[i]);
    L.R.step(13); const at: Vec3 = rep ? [rep.at[0], rep.at[1] + FRAG.lift, rep.at[2]] : src; L.R.gb.blast(at, size());
    const pts: Vec3[] = []; for (let x = 5.6; x <= 9.4; x += 0.2) for (const z of [9.5, 9.0, 8.4]) for (const y of [0.7, 1.1, 1.35, 1.6, 2.1]) pts.push([x, y, z]);
    const judged = pts.map(p => burstLine(L.R.g, at, p, 'blown')); L.R.settle(2.5); const after = pts.map(p => burstLine(L.R.g, at, p, 'whole')); const lone = PANES.map(bi => L.R.state(bi));
    F.verdict(!!rep && blows === 1 && mine.join() !== before.join(), '(c) the burst beside the holed pane is ONE blow on the glass, and the glass takes it', `${blows} blow(s) · before ${before[1]}\n    after  ${mine[1]}`);
    F.verdict(same0 && mine.join() === lone.join(), '(c) …each pane ending exactly where the fracture model\'s own blast of that size puts the same holed pane (the shell\'s record changes nothing of the burst\'s)', `grenade: ${mine[1]}\n    alone:   ${lone[1]}${mine.join() === lone.join() ? '' : `\n    grenade ${mine.join(' / ')}\n    alone   ${lone.join(' / ')}`}${same0 ? '' : ' · THE TWIN\'S SHELL DIFFERED'}`);
    const wrong = pts.filter((_, i) => judged[i] && !after[i]), later = pts.filter((_, i) => !judged[i] && after[i]).length;
    F.verdict(wrong.length === 0 && judged.some(Boolean) && judged.some(x => !x), '(c) the blast\'s view of that holed pane (GlassBreak.goingAt — what frag.ts judges men through), over a grid of points beyond the glazing: no line it takes as open is through glass that then stood (the shell\'s hole among them); a pane that ran goes on falling after the fragments have flown, and those later openings hurt nobody', `${pts.length} points · ${judged.filter(Boolean).length} judged open at the burst · ${wrong.length} of them shut afterwards${wrong.length ? ` (first ${wrong.slice(0, 4).map(p => p.map(f2).join(',')).join(' ; ')})` : ''} · ${later} more opened in the 2.5 s after (pieces of the run pane falling)`); }
  // (d) the grenade's OWN judgment (frag.ts blast: the glass first, then the men) of a man behind a pane shells have holed: his share in the burst's line, as
  // its report has it, is the share the shells' hole leaves open — between what was open before the grenade and what ends open after
  { const near: Vec3 = [7.5, 1.1, GZ + 1], to: Vec3 = [7.5, 1.1, GZ - 3], P = [7.5, 0, GZ + 3.7];
    const R = await rig(81); const g = R.g; const [A] = g.guards; R.park(); R.types('annealed'); R.step(2);
    R.shell(near, to); R.settle(1); R.shell(near, to); R.settle(2.5);
    const from = lifted(P); let x = 7.5, share0 = -1;
    for (let k = 0; k <= 24 && !(share0 > 0 && share0 < 1); k++) { x = 7.5 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.1; share0 = exposure(g, from, [x, 0, 9.3], [x, 1.65, 9.3], 'whole'); }
    R.put(A, [x, 0, 9.3], P); A.char.update(0); A.char.update(DT); R.step(2);
    const feet = [...A.char.pos] as Vec3, head = [...(A.char.bones.head ?? [A.char.pos[0], 1.65, A.char.pos[2]])] as Vec3;
    const fr = () => PANES.map(bi => R.gb.paneInfo(bi)?.openFraction.toFixed(4)).join(); const open0 = fr(); share0 = exposure(g, from, feet, head, 'whole');
    const o0 = R.open(PM); const rep = R.frag(P); const h = rep?.hits.find((q: any) => q.id === A.char.id) ?? null; R.settle(2.5); const open1 = fr();
    const share1 = exposure(g, from, feet, head, 'whole');   // (what ends open, once the glass the grenade loosened has fallen)
    F.verdict(!!rep && o0 > 0 && R.open(PM) >= o0 && R.open(PM) < 1, '(d) staged: two shells from 1 m take a hole out of the middle float pane; a grenade 3.7 m off reaches the glass (it loosens a little more of a pane already run) and most of it stands', `${R.pane(PM)} · open fractions before the grenade ${open0} · 2.5 s after ${open1}`);
    F.verdict(!!h && share0 > 0 && h.exposed >= share0 - 1e-9 && h.exposed <= share1 + 1e-9 && h.exposed < 1 && h.result !== 'shielded', '(d) the grenade\'s own report has the man behind that pane in its line by the share the shells\' hole leaves open — part of him: no less than was open before it went off, no more than ends open after', h ? `${A.callsign} at x ${f2(x)}, ${f2(h.d)} m off · open through the hole before ${share0} · the report's share ${h.exposed} · open once the glass has fallen ${share1} · ${h.result}` : `he is not in the report (share before ${share0})`); }
  return F.done();
});

// ================================================================ gearglass-pinned
/** a room defender put north of the conference glazing and held there, a lit Sam in the corridor south of it in plain view, nobody else near; six seconds */
async function pinnedCase(seed: number, foes: boolean, type = 'annealed') {
  const R = await rig(seed); const g = R.g; g.aiEnabled = true; g.godMode = true; GLASSPEN.foesThrough = foes;
  g.roomClear.start(seed); R.step(32); R.types(type);
  const C = g.nightBreach.hostiles[0]; const CAR = [7.4, 0, 5.3], T1 = [7.3, 0, 11.2];
  g.guards.filter((x: any) => x !== C).forEach((x: any, i: number) => R.put(x, [60 + 2 * i, 0, 60]));
  C.god = true; R.put(C, CAR, T1); g.teleportPlayer(T1);
  let shots = 0, alertT = 0, searchT = 0, pinnedT = 0, energy: number | undefined = NaN, firstT = NaN; const t0 = g.time, n0 = R.events.length, imp0 = GB_STATS.impacts, x0 = GLASSPEN_STATS.crossed;
  for (let i = 0; i < 6 * 60; i++) {
    C.char.pos = [CAR[0], 0, CAR[2]]; C.char.vel = [0, 0, 0]; g.player.visibility = 1; R.W.step(DT);
    for (const e of g.events) { if (R.events.includes(e)) continue; R.events.push(e); if (e.kind === 'guardShot' && e.who === C.char.id) { shots++; if (!(firstT === firstT)) firstT = g.time - t0; } }
    if (C.state === 'alert') { alertT += DT; energy = shotEnergy(g, C.char, C.weapon.def); if (C.pinned) pinnedT += DT; } else if (C.state === 'search') searchT += DT;
  }
  void n0;
  return { R, g, C, shots, alertT, searchT, pinnedT, energy, firstT, impacts: GB_STATS.impacts - imp0, crossed: GLASSPEN_STATS.crossed - x0, whole: PANES.every(bi => R.open(bi) === 0),
    line: `${C.callsign} ${C.state} (alert ${f2(alertT)} s, pinned ${f2(pinnedT)} s of it, searching ${f2(searchT)} s) · his gun's energy for a pane ${energy === undefined ? 'the default' : f2(energy as number)} · rounds fired ${shots}${shots ? ` (first at ${f2(firstT)} s)` : ''} · panes crossed ${GLASSPEN_STATS.crossed - x0} · blows on glass ${GB_STATS.impacts - imp0} · ${PANES.map(bi => R.pane(bi)).join(' | ')}` };
}
export const gearglassPinned = guarded(async () => {
  const F = family('gearglass-pinned: ?glassfoes=0 holds a PINNED defender\'s fire through standing glass');
  const SEEDS = [3, 5, 8];
  { let held = 0, staged = 0, calm = 0; const lines: string[] = [];
    for (const s of SEEDS) { const a = await pinnedCase(s, false);
      if (a.pinnedT > 3 && a.energy === 0) staged++; if (a.shots === 0 && a.crossed === 0 && a.impacts === 0 && a.whole) held++; if (a.searchT === 0) calm++;
      lines.push(`seed ${s}: ${a.line}`); }
    F.verdict(staged === SEEDS.length, '(1) staged: the defender is alert on a lit man he sees through the glazing, pinned on his post, his gun at energy 0 for a pane', `${staged}/${SEEDS.length}\n    ${lines.join('\n    ')}`);
    F.verdict(held === SEEDS.length, '(2) ?glassfoes=0: no round leaves his gun, no pane is crossed, the glass is untouched (without the one condition in guards.ts he puts rounds through it inside three seconds)', `${held}/${SEEDS.length} held their fire for the six seconds`);
    F.verdict(calm === SEEDS.length, '(3) …and he stays on his man: never sent to search for somebody he can see', `${calm}/${SEEDS.length} never left alert`); }
  { let through = 0; const lines: string[] = [];
    for (const s of SEEDS) { const a = await pinnedCase(s, true); if (a.shots > 0 && a.crossed > 0 && (a.energy ?? 0) > 0) through++; lines.push(`seed ${s}: ${a.line}`); }
    F.verdict(through === SEEDS.length, '(4) the default (his side shoots through glass): the same man fires through the pane, as before — the staging has the line', `${through}/${SEEDS.length}\n    ${lines.join('\n    ')}`); }
  return F.done();
});
