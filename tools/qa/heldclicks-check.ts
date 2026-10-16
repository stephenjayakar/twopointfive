// IN A HOLD: LEFT CLICK THE KNIFE, RIGHT CLICK THE CHOKE (src/game/close.ts CLOSE.heldClicks — player.ts updateHold / startKill / killOut, interact.ts), headless:
//   bun run tools/qa/heldclicks-check.ts            (probes.ts heldclicks; HELDCLICKS_BREAK=1 = the rule left off in the 'on' arms: must fail)
// THE CONTRACT: one switch, and it is the ARM hold's alone. On: the left click starts the knife (phase 'kill', a commit — no tap, step, Esc or E touches it) and
// he is dead when its clock runs out; the right click chooses the choke as its Space row does. Off: neither click does anything there. The pistol's hold (a round
// past him, the OCP) and a held civilian read the same whichever way the switch stands.
//   a  on · arm · LMB        phase 'kill' on the click's frame, dead (not breathing) by the knife at the clock, the hold over
//      …seen               one man left his eyes, 4.5 m ahead and facing the pair: what he saw done is 'struck' (dropped), not 'shot' — killOut's rewrite
//   b  on · arm · RMB        the choke: out cold and breathing — the same frames and the same sounds as the Space row's choke
//   x  both buttons        on, one frame: nothing is chosen
//   m  an order menu up    on, a squad on the floor: the left click that shuts the menu is not the knife; the next one is
//   c  off · arm             LMB / RMB / no click: one and the same run
//   d  gun hold              LMB = one round past him, RMB = the OCP — the same run with the switch on as off
//   e  a held civilian       on: LMB and RMB change nothing
//   f  the kill is a commit  Space, a step, Esc, E: still 'kill', Sam rooted, dead on the frame the unbothered run has him dead
//   s  Sam shot mid-kill     before the cut (HOLD.kill.hit × the clock; 0.3 until the takedowns' half) the man is loose and alive; past it he dies by the knife
//   g  the row's words       on: the marks; off: the old string; the gun's and the civilian's rows never carry them; under the knife a status line
//   h  a recording           applyKnobs on a CLOSE row with no heldClicks leaves it off
//   i  the stands            the frozen stand's word, FROZEN_HOLDS, STAND_ENV, the page's flag
// It writes the switch itself for every arm (and puts it back), so it asks the same on either stand. Nothing here looks at a picture.
import { standUp, ROOT } from './headless.ts';
import { tapVerb } from './verbs.ts';

const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { isBreathing } = await import(`${ROOT}/src/game/game.ts`);
const { hitPlayer } = await import(`${ROOT}/src/game/combat.ts`);
const { spawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
const KN: any = await import(`${ROOT}/src/game/knobs.ts`);
const JN: any = await import(`${ROOT}/src/game/journal.ts`);

type P3 = [number, number, number];
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const BREAK = process.env.HELDCLICKS_BREAK === '1';
const DT = 1 / 60, EAST = Math.PI / 2, LMB = 1, RMB = 4;
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x)), f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : String(x)), J = (x: unknown) => JSON.stringify(x);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** the knife's clock as player.ts reads it (the takedowns' half brings HOLD.secs.kill; one second until then) */
const KILL_SECS = (): number => HOLD.secs.kill;
const KILL_CUT = (): number => HOLD.kill.hit * KILL_SECS();
const MARKS = 'LMB  knife — lethal  ·  RMB  choke him out', OLD_ROW = 'Space  choke him out — quiet  ·  E  draw — gun to his head';

function place(gd: any, p: P3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; gd.dazzledUntil = 1e9; gd.heardUpTo = 1e12; place(gd, [37.5, 0, 6 + i * 1.5], EAST); }
interface Stage { W: any; g: any; pl: any; A: any; msgs: string[]; ocps: number[]; step: (n?: number) => void;
  /** (witness) the one man with eyes: 4.5 m ahead of the pair in the corridor, facing them, rooted and deaf — blind too until `see()` */
  Wn?: any; see?: () => void;
  /** (squad) the one operative on the floor, parked blind on the verge: there is a squad to order, so X puts the menu up */
  mate?: any }
/** a fresh stand-up on one seed with the switch written right after it: every man parked blind and deaf on the lot but the one to be held — the corridor man
 *  planted calm facing east, or (civ) the first standing civilian where she is — Sam 0.7 m behind with the pistol drawn or holstered, the grab made, the hold settled */
async function held(seed: number, on: boolean, opts: { drawn?: boolean; civ?: boolean; witness?: boolean; squad?: boolean } = {}): Promise<Stage | null> {
  Math.random = seeded(seed);
  const W: any = await hushed(() => standUp()); const g = W.game, pl = g.player; CLOSE.heldClicks = on;
  g.godMode = true; pl.visibility = 0.02; pl.slot = 'pistol'; pl.holstered = !opts.drawn; pl.pistol.lightOn = false;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { W.step(DT); pl.visibility = 0.02; } };
  step(5);
  const men = [...g.guards]; let A = men[0];
  if (opts.civ) { const cv = (g.civilians ?? []).find((x: any) => x.civ && x.state !== 'dead'); if (!cv) return null; A = cv; men.forEach((m: any, i: number) => park(m, i)); place(A, [A.char.pos[0], 0, A.char.pos[2]], EAST); }
  else { men.slice(1).forEach((m: any, i: number) => park(m, i)); place(A, [14, 0, 11.2], EAST); A.wp = 1; }
  const Wn = opts.witness ? men[1] : undefined; if (Wn) place(Wn, [18.5, 0, 11.2], -EAST);   // (parked as the others — rooted, deaf, blind — but stood in the corridor ahead of the pair, looking back down it at them)
  let mate: any; if (opts.squad) { mate = spawnUnit(g, { team: 'operative', pos: [2, 0, 2], yaw: 0, name: 'Probe' }); mate.hold = true; mate.pinned = true; mate.dazzledUntil = 1e9; mate.heardUpTo = 1e12; }
  g.teleportPlayer([A.char.pos[0] - 0.7, 0, A.char.pos[2]]); pl.char.bodyYaw = pl.char.aimYaw = EAST; W.cam.yaw = 0; W.cam.rebuild?.(); step(1);
  const msgs: string[] = []; const msg0 = g.msg.bind(g); g.msg = (t: string) => { msgs.push(t); return msg0(t); };
  const ocps: number[] = []; const ocp0 = g.ocp.bind(g); g.ocp = (t: any) => { ocps.push(g.time); return ocp0(t); };
  W.audioLog = [];
  await hushed(() => startGrab(g, A));
  for (let i = 0; i < 120 && pl.holding && pl.holding.phase !== 'held'; i++) step(1);
  step(30);   // (well past the reach: the hand is on its tool and no question is in the air)
  if (pl.holding?.phase !== 'held' || pl.holding.g !== A) return null;
  W.cursorAt([A.char.pos[0] + 6, 1.3, A.char.pos[2]]);   // (the reticle on open floor ahead of the pair: nothing of anybody's under it)
  return { W, g, pl, A, msgs, ocps, step, Wn, see: () => { if (Wn) Wn.dazzledUntil = 0; }, mate };
}
/** what a run came to, as one line: the hold, the man, Sam, the gun, what was said and heard */
function sig(S: Stage): string {
  const { g, pl, A, W } = S, H = pl.holding, p = pl.char.pos, a = A.char.pos;
  return J({ hold: H ? [H.variant, H.phase, f3(H.t), f3(H.windT)] : null, man: [A.state, A.downKind, A.civ?.state ?? null], sam: [f3(p[0]), f3(p[2]), f3(pl.char.bodyYaw)], at: [f3(a[0]), f3(a[2])],
    gun: [pl.pistol.roundsReady, f3(pl.lastFireT), f3(g.ocpCooldown)], ocps: S.ocps.length, msgs: S.msgs.length, sounds: (W.audioLog as any[]).map(x => x.name).join(','), events: g.eventSeq });
}
const click = (S: Stage, bits: number) => { S.W.input.clicked |= bits; S.step(1); };
/** frames until the hold is over (−1 = not inside `cap`) */
function untilOver(S: Stage, cap: number, each?: (f: number) => void): number { for (let f = 1; f <= cap; f++) { S.step(1); each?.(f); if (!S.pl.holding) return f; } return -1; }
const heldRows = (S: Stage): any[] => S.g.nearby.filter((r: any) => r.kind === 'held');
const rowLines = (S: Stage): string[] => S.g.nearby.filter((r: any) => r.kind === 'held').map((r: any) => String(r.line2));

export async function heldClicksCheck(): Promise<boolean> {
  const F = family("heldclicks: a man in his arm — the left click is the knife (a commit, he is dead), the right click the choke; the gun's hold and a civilian as they were");
  const was = CLOSE.heldClicks, rnd = Math.random, ON = !BREAK, kc = KN.knobsCopy();
  if (BREAK) console.log("HELDCLICKS_BREAK=1: the switch is left OFF in the 'on' arms — a, b, f, s, m and g must fail");
  try {
    // ---- i: the stands (first: it reads what the stand-up itself wrote)
    { const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_HELDCLICKS;
      if (frozen || word !== undefined) CLOSE.heldClicks = word !== '1';   // (the other way up: the stand-up must WRITE it)
      const before = CLOSE.heldClicks; await hushed(() => standUp()); const want = frozen || word !== undefined ? word === '1' : before;
      const P: any = await import(`${ROOT}/src/host/profile.ts`), E: any = await import(`${ROOT}/src/host/standEnv.ts`);
      F.verdict(CLOSE.heldClicks === want, frozen ? 'i · standUp() on the frozen stand puts CLOSE.heldClicks to what TPS_HELDCLICKS says (unset: off — a click in the arm hold does nothing, as every stored probe read)' : "i · standUp() on the shipped stand leaves CLOSE.heldClicks to the page's boot (or to TPS_HELDCLICKS where it is given)",
        `before ${before} · after ${CLOSE.heldClicks} · TPS_HELDCLICKS ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'}`);
      const row = P.FROZEN_HOLDS['CLOSE.heldClicks']; let a: unknown, b: unknown, o: unknown; const c = KN.knobsCopy();
      try { CLOSE.heldClicks = false; P.pageSwitches(new URLSearchParams('')); a = CLOSE.heldClicks; P.pageSwitches(new URLSearchParams('noheldclicks')); b = CLOSE.heldClicks; P.pageSwitches(new URLSearchParams('noclose&nohandwork')); o = CLOSE.heldClicks; } finally { KN.knobsBack(c); }
      F.verdict(row === 'TPS_HELDCLICKS=1' && E.STAND_ENV.includes('TPS_HELDCLICKS') && a === true && b === false && o === true && KN.knobRegistry().CLOSE === CLOSE,
        'i · FROZEN_HOLDS names CLOSE.heldClicks with its word, STAND_ENV carries the word, the page: no flag → on · ?noheldclicks → off · ?noclose leaves it on (its own switch)',
        `FROZEN_HOLDS ${J(row)} · in STAND_ENV ${E.STAND_ENV.includes('TPS_HELDCLICKS')} · '' → ${a} · 'noheldclicks' → ${b} · 'noclose&nohandwork' → ${o} · CLOSE in the knob registry ${KN.knobRegistry().CLOSE === CLOSE}`); }

    // ---- a: on, the arm hold, the left click
    let killFrames = -1;
    { const S = await held(901, ON); if (!S) F.verdict(false, 'a · staging', 'the arm hold never settled'); else {
        const { pl, A } = S; click(S, LMB); const ph = pl.holding?.phase;
        const n = untilOver(S, 300); killFrames = n; const want = Math.ceil(KILL_SECS() / DT - 1e-6), said = S.msgs.filter(m => /knife — dead/.test(m)).length, limp = (S.W.audioLog as any[]).filter(x => x.name === 'chokeLimp').length;
        F.verdict(ph === 'kill' && n >= 0 && Math.abs(killFrames - want) <= 1 && A.state === 'dead' && !isBreathing(A) && A.downKind === 'shot' && A.downBy === 'player' && said === 1 && !A.held && !pl.holding,
          `a · on, the arm hold, LMB: phase 'kill' on the click's frame; ${f2(KILL_SECS())} s on he is dead — not breathing, by the knife — and the hold is over`,
          `phase after the click ${J(ph)} · over ${killFrames} frames after the click (want ${want} ± 1) · ${A.callsign} ${A.state} / ${A.downKind} by ${A.downBy} · breathing ${isBreathing(A)} · 'knife — dead' said ${said}× · chokeLimp ${limp}× · held ${!!A.held} · holding ${!!pl.holding}`);
      } }
    // ---- a, seen: a man with his eyes on the pair as the knife ends it
    { const S = await held(901, ON, { witness: true }); if (!S || !S.Wn) F.verdict(false, 'a · staging (the witness)', 'the arm hold never settled'); else {
        const { pl, A, Wn } = S; click(S, LMB); const ph = pl.holding?.phase; S.see!();   // (his eyes open as the knife starts: he has the second it takes, and nothing before it to break the hold over)
        const n = untilOver(S, 300), saw = Wn.witness?.sawAct, far = v3.distXZ(Wn.char.pos, A.char.pos);
        F.verdict(ph === 'kill' && n === killFrames && A.state === 'dead' && A.downKind === 'shot' && Wn.state !== 'dead' && !!saw && saw.victim === A.callsign && saw.kind === 'struck',
          "a · a man who watched it (eyes open, facing the pair down the corridor) holds a record of it, and it is 'struck' — he saw him DROPPED, not shot (killOut's rewrite, startTakedown's own)",
          `${Wn.callsign} ${f2(far)} m off, ${Wn.state} · sawAct ${J(saw ?? null)} · ${A.callsign} ${A.state} / ${A.downKind} · over ${n} frames after the click (the unwatched run: ${killFrames})`); } }

    // ---- x: both buttons in one frame
    { const S = await held(909, ON); if (!S) F.verdict(false, 'x · staging', 'the arm hold never settled'); else {
        const { pl, A } = S; click(S, LMB | RMB); const p1 = pl.holding?.phase, w1 = pl.holding?.windT; S.step(60);
        F.verdict(p1 === 'held' && w1 < 0 && pl.holding?.phase === 'held' && pl.holding.windT < 0 && A.state !== 'dead',
          'x · on, the arm hold, both buttons in one frame: nothing is chosen — no knife, no choke — and a second on he is still held, alive',
          `after the frame: phase ${J(p1)}, windT ${f3(w1)} · a second on: phase ${J(pl.holding?.phase)}, windT ${f3(pl.holding?.windT)} · ${A.callsign} ${A.state}`); } }

    // ---- m: the left click that shuts an order menu is not the knife
    { const S = await held(910, ON, { squad: true }); if (!S) F.verdict(false, 'm · staging', 'the arm hold never settled'); else {
        const { W, g, pl, A } = S; W.input.pressed.add('KeyX'); S.step(1); const up = !!g.orders.menu, act = g.orders.active;
        click(S, LMB); const shut = !g.orders.menu, p1 = pl.holding?.phase; S.step(20); const p2 = pl.holding?.phase;
        click(S, LMB); const p3 = pl.holding?.phase;
        F.verdict(up && shut && p1 === 'held' && p2 === 'held' && p3 === 'kill' && A.state !== 'dead',
          'm · on, the arm hold, the squad\'s order menu up (X): the left click shuts the menu and is NOT the knife as well; with the menu down the next left click is',
          `a squad to order ${act} · the menu up after X ${up} · after the first click: menu shut ${shut}, phase ${J(p1)} (20 frames on ${J(p2)}) · after the second: phase ${J(p3)}`); } }

    // ---- b: on, the arm hold, the right click = the row's choke
    { const S = await held(902, ON), R = await held(902, ON); if (!S || !R) F.verdict(false, 'b · staging', 'the arm hold never settled'); else {
        const cut = (X: Stage) => { const n0 = (X.W.audioLog as any[]).length; return () => (X.W.audioLog as any[]).slice(n0).map(x => x.name).join(','); };
        const sS = cut(S), sR = cut(R);
        click(S, RMB); const wS = S.pl.holding?.windT ?? -1; let chS = -1; const nS = untilOver(S, 400, f => { if (chS < 0 && S.pl.holding?.phase === 'choke') chS = f; });
        const tapped = tapVerb(R.W, 'held', 'choke', DT); const wR = R.pl.holding?.windT ?? -1; let chR = -1; const nR = untilOver(R, 400, f => { if (chR < 0 && R.pl.holding?.phase === 'choke') chR = f; });
        const A = S.A, B = R.A, soundsS = sS(), soundsR = sR();
        F.verdict(wS >= 0 && chS > 0 && nS > 0 && A.state === 'dead' && isBreathing(A) && A.downKind === 'choked' && !S.pl.holding,
          'b · on, the arm hold, RMB: the choke is chosen on the click, the arm closes, and he is out cold — breathing — with the hold over',
          `windT after the click ${f3(wS)} · 'choke' ${chS} frames on · out ${nS} frames on · ${A.callsign} ${A.state} / ${A.downKind} · breathing ${isBreathing(A)}`);
        F.verdict(tapped && wS >= 0 && chS === chR && nS === nR && soundsS === soundsR && B.downKind === 'choked',
          "b · …exactly as the Space row's choke: the same frames to the arm closing and to him out, the same sounds in the same order",
          `click: closes ${chS}, out ${nS} · row: closes ${chR}, out ${nR} · sounds the same ${soundsS === soundsR} (${soundsS.split(',').length} / ${soundsR.split(',').length}: ${[...new Set(soundsS.split(','))].join(' ')})`); } }

    // ---- c: off, the arm hold — a click is nothing
    { const out: string[] = []; let bad = false;
      for (const bits of [0, LMB, RMB]) { const S = await held(903, false); if (!S) { bad = true; break; } click(S, bits); S.step(90); out.push(sig(S)); }
      F.verdict(!bad && out.length === 3 && out[0] === out[1] && out[0] === out[2] && /"held"/.test(out[0] ?? ''), 'c · off, the arm hold: LMB, RMB and no click at all are one and the same run a second and a half on (still held, nothing chosen)',
        bad ? 'staging: the arm hold never settled' : `none = LMB ${out[0] === out[1]} · none = RMB ${out[0] === out[2]} · ${out[0]}`); }

    // ---- d: the gun hold — LMB a round past him, RMB the OCP, whichever way the switch stands
    for (const [name, bits] of [['LMB', LMB], ['RMB', RMB]] as [string, number][]) {
      const runs: { s: string; shots: number; ocps: number; phase: string; alive: boolean }[] = []; let bad = false;
      for (const on of [false, ON]) { const S = await held(904, on, { drawn: true }); if (!S || S.pl.holding.variant !== 'gun') { bad = true; break; } const r0 = S.pl.pistol.roundsReady; click(S, bits); S.step(60); runs.push({ s: sig(S), shots: r0 - S.pl.pistol.roundsReady, ocps: S.ocps.length, phase: String(S.pl.holding?.phase), alive: S.A.state !== 'dead' }); }
      const [off, on] = runs, did = bits === LMB ? off?.shots === 1 && off.ocps === 0 : off?.ocps === 1 && off.shots === 0;
      F.verdict(!bad && !!off && !!on && did && off.s === on.s && on.phase === 'held' && on.alive, `d · the gun hold, ${name}: ${bits === LMB ? 'one round past him' : 'the OCP'} — and the same run with the switch on as off (still held, the man alive)`,
        bad ? 'staging: the gun hold never settled' : `off: ${off.shots} round(s), ${off.ocps} OCP · on: ${on.shots} round(s), ${on.ocps} OCP · phase ${on.phase} · the two runs the same ${off.s === on.s}`); }

    // ---- e: a held civilian — the knife is never hers
    { const out: string[] = []; let who = '', bad = false, rows: string[] = [];
      for (const bits of [0, LMB, RMB]) { const S = await held(905, ON, { civ: true }); if (!S) { bad = true; break; } who = `${S.A.callsign} (the ${S.A.civ.label})`; if (!bits) rows = rowLines(S); click(S, bits); S.step(90); out.push(sig(S)); }
      F.verdict(!bad && out.length === 3 && out[0] === out[1] && out[0] === out[2] && /"held"/.test(out[0] ?? '') && !rows.some(r => /LMB|RMB/.test(r)), 'e · a held civilian, the switch on: LMB, RMB and no click are one and the same run (still held, alive), and her rows carry no marks',
        bad ? 'staging: no civilian on this stand, or she was never held' : `${who} · none = LMB ${out[0] === out[1]} · none = RMB ${out[0] === out[2]} · ${out[0]}`); }

    // ---- f: the kill is a commit
    { const S = await held(901, ON); if (!S) F.verdict(false, 'f · staging', 'the arm hold never settled'); else {
        const { W, pl, A } = S; click(S, LMB); const p0 = v3.copy(pl.char.pos), seen: string[] = [];
        const poke = (label: string, fn: () => void, n = 1) => { fn(); S.step(n); seen.push(`${label} → ${pl.holding?.phase ?? 'no hold'}`); };
        let frames = 0;
        poke('Space', () => W.input.pressed.add('Space')); frames += 1;
        poke('a step (W held 12 frames)', () => { W.input.keys.add('KeyW'); W.input.pressed.add('KeyW'); }, 12); W.input.keys.delete('KeyW'); frames += 12;
        poke('Esc', () => W.input.pressed.add('Escape')); frames += 1;
        poke('E', () => W.input.pressed.add('KeyE')); frames += 1;
        poke('RMB', () => { W.input.clicked |= RMB; }); frames += 1;
        const moved = v3.distXZ(pl.char.pos, p0), variant = pl.holding?.variant, windT = pl.holding?.windT, n = untilOver(S, 300), total = n < 0 ? -1 : frames + n;
        F.verdict(seen.length === 5 && seen.every(s => / → kill$/.test(s)) && moved < 0.02 && variant === 'arm' && windT === -1 && n >= 0 && total === killFrames && A.state === 'dead' && !isBreathing(A),
          'f · once begun the knife is not eased off: a Space tap, a step, Esc, E and a right click leave it running — Sam rooted, the knife still his tool — and he is dead on the frame the unbothered run has him dead',
          `${seen.join(' · ')} · Sam moved ${f3(moved)} m · variant ${variant} · over ${total} frames after the click (the unbothered run: ${killFrames}) · ${A.callsign} ${A.state} / ${A.downKind}`); } }

    // ---- s: Sam shot down mid-kill, either side of the cut
    { const cutF = Math.ceil(KILL_CUT() / DT - 1e-6), out: string[] = []; const res: { state: string; kind: unknown; breathing: boolean; loose: boolean; pose: boolean; phase: unknown }[] = []; let bad = false;
      for (const n of [Math.max(1, Math.floor(cutF / 2)), cutF + 2]) { const S = await held(908, ON); if (!S) { bad = true; break; } const { g, pl, A } = S;
        click(S, LMB); S.step(n); const phase = pl.holding?.phase; g.godMode = false; pl.hitsLeft = 1; hitPlayer(g, [1, 0, 0]); S.step(2);
        res.push({ state: A.state, kind: A.downKind, breathing: isBreathing(A), loose: !A.held && !pl.holding, pose: pl.char.anim.holdPose == null, phase }); out.push(`${n} frames in (${f2(n * DT)} s, phase ${J(phase)}): Sam down ${pl.down} · ${A.callsign} ${A.state} / ${A.downKind} · held ${!!A.held} · holding ${!!pl.holding} · holdPose ${pl.char.anim.holdPose == null ? 'null' : 'set'}`); }
      const [pre, post] = res;
      F.verdict(!bad && !!pre && pre.phase === 'kill' && pre.state !== 'dead' && pre.loose && pre.pose, `s · Sam shot down BEFORE the cut (${f2(KILL_CUT())} s into the knife's ${f2(KILL_SECS())}): the man is loose and alive, as a hold broken by a round always left him; Sam's hold pose is let go`, bad ? 'staging: the arm hold never settled' : out[0] ?? '');
      F.verdict(!bad && !!post && post.phase === 'kill' && post.state === 'dead' && post.kind === 'shot' && !post.breathing && post.loose && post.pose, 's · Sam shot down PAST the cut: the knife was in — the man is dead by it (not breathing), the hold over, Sam\'s hold pose let go', bad ? 'staging: the arm hold never settled' : out[1] ?? ''); }

    // ---- g: the row's words
    { const lines: Record<string, string[]> = {}; let bad = false;
      for (const [k, on, opts] of [['on', ON, {}], ['off', false, {}], ['gun, on', ON, { drawn: true }]] as [string, boolean, { drawn?: boolean }][]) { const S = await held(906, on, opts); if (!S) { bad = true; break; } lines[k] = rowLines(S); if (k === 'on') { click(S, LMB); S.step(1); lines['under the knife'] = rowLines(S); lines['under the knife, verbs'] = heldRows(S).filter(r => r.verb).map(r => String(r.verb)); } }   // (the rows are built at the head of a frame: the one after the click has them)
      const has = (k: string, t: string | RegExp) => (lines[k] ?? []).some(l => typeof t === 'string' ? l === t : t.test(l));
      const onRow = `Space  choke him out — quiet  ·  ${MARKS}  ·  E  draw — gun to his head`, words = [onRow, ...(lines['under the knife'] ?? [])].join(' ');
      F.verdict(!bad && has('on', onRow) && has('off', OLD_ROW) && !has('off', /LMB|RMB/) && !has('gun, on', /knife — lethal|RMB/),
        "g · the arm hold's row: with the switch on it carries the marks (LMB knife — lethal · RMB choke him out, then E as it was); off it is the old string; the gun's row never carries them",
        bad ? 'staging: a hold never settled' : `on ${J((lines.on ?? []).find(l => /choke/.test(l)))} · off ${J((lines.off ?? []).find(l => /choke/.test(l)))} · gun ${J((lines['gun, on'] ?? []).find(l => /whip/.test(l)))}`);
      F.verdict(!bad && has('under the knife', 'the knife…') && !has('under the knife', /LMB|RMB|Space|breathes|step/) && (lines['under the knife, verbs'] ?? []).length === 0 && !/[6-9]/.test(words) && !/\b(north|south|east|west)\b/i.test(words),
        'g · under the knife the row is a status line: no verb, no way out named, no marks left standing; no digit above 5 and no compass word in any of it',
        `rows under the knife ${J(lines['under the knife'])} · verbs ${J(lines['under the knife, verbs'])}`); }

    // ---- h: a recording from before the key
    { const S = await held(907, false); if (!S) F.verdict(false, 'h · staging', 'the arm hold never settled'); else {
        const c = KN.knobsCopy(); let without: unknown, withOn: unknown, hadKey = false;
        try {
          const snap = JN.knobsSnapshot(S.g); hadKey = typeof snap.tables.CLOSE?.heldClicks === 'boolean';
          const old = JSON.parse(JSON.stringify(snap)); delete old.tables.CLOSE.heldClicks; CLOSE.heldClicks = true; JN.applyKnobs(S.g, old); without = CLOSE.heldClicks;
          const neu = JSON.parse(JSON.stringify(snap)); neu.tables.CLOSE.heldClicks = true; CLOSE.heldClicks = false; JN.applyKnobs(S.g, neu); withOn = CLOSE.heldClicks;
        } finally { KN.knobsBack(c); }
        F.verdict(hadKey && without === false && withOn === true && KN.JOURNAL_KNOBS.includes('CLOSE'), 'h · a recording carries the key (JOURNAL_KNOBS has CLOSE); applyKnobs on a CLOSE row WITHOUT it leaves the switch off whatever this process had on, and with it true turns it on',
          `the snapshot's CLOSE row has the key ${hadKey} · no key (process had it on) → ${without} · key true (process had it off) → ${withOn} · CLOSE in JOURNAL_KNOBS ${KN.JOURNAL_KNOBS.includes('CLOSE')}`); } }
  } finally { KN.knobsBack(kc); CLOSE.heldClicks = was; Math.random = rnd; }
  return F.done();
}

if (import.meta.main) {
  const ok = await heldClicksCheck();
  console.log(ok ? '\n=== heldclicks: ALL PASS ===' : '\n=== heldclicks: FAILED ==='); process.exit(ok ? 0 : 1);
}
