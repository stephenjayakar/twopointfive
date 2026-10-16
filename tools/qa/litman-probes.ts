// The 'litman' family: DARK ON A LIT MAN (guards.ts LIGHTS.litMan — onLitMan / darkOnLitMan / teamLit — and its feet half, roomfight.ts holdShort / short()).
// The rule's own contract, asked of the functions themselves on a staged night breach; run through probes.ts:
//   bun run tools/qa/probes.ts litman | litman-rule
// PASS / FAIL each, headless (bang-tally.ts stage(): the Game of headless.ts started as a click on the scenario's row starts it). A teammate and a hostile are
// PUT where the place's own light is read as lit or dark (the floor is scanned for the brightest and the darkest standing room: no coordinate is written
// here), the teammate's eyes are handed the man (Op.tgt), and the rule is asked — no frame is stepped in between, so the fight never takes the staging back.
//   litman-rule  · from the dark on a lit man: the rule holds and his weapon light is off; switch off: it does not hold and his light burns (as it was)
//                · the man in the dark too, or he himself in the light: it does not hold
//                · a round's flash by a man in the dark (nobody's light, on a fuse) lights him by the plain estimate and NOT by the rule's: it does not hold
//                · the man out of his eyes a moment ago (Op.kept): it holds; with a cue turning him to somebody else, or the blink grown old: it does not
//                · FEET: a walk that closes on the man is held (fight.short); one that leads away is not; holdShortSecs 0: never; past the cap: let go;
//                  switch off: never
// What it cannot say: whether any of it is right to look at, or helps — that is playthrough.ts's tally (rebuild/away-build/night-breach-hunt.md).
// The family's own red path: LITMAN_BREAK=1 bun run tools/qa/probes.ts litman-rule must FAIL (the switch taken off under the first check).
import { ROOT } from './headless.ts';
import { stage } from './bang-tally.ts';
const GDM: any = await import(`${ROOT}/src/game/guards.ts`);
const RFM: any = await import(`${ROOT}/src/game/roomfight.ts`);
const LIGHTS = GDM.LIGHTS, ROOMFIGHT = RFM.ROOMFIGHT;
const BREAK = !!process.env.LITMAN_BREAK;

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const f2 = (n: number) => n.toFixed(2), at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;

export async function litmanRule(): Promise<boolean> {
  const F = family('litman-rule: in the dark on a man the place lights — light off, feet held on a closing walk; anything else, as it was');
  const keepL = { ...LIGHTS }, keepR = { holdShortSecs: ROOMFIGHT.holdShortSecs };
  try {
    const S: any = await quiet(() => stage('night-breach', 1)); const { g, step } = S; const O = g.orders, nav = g.col.nav, fight: any = g.fight;
    const sam = g.player.char.pos; await quiet(() => O.give('fallIn', O.targetAt([sam[0], 0, sam[2]]), 'all')); step(30);
    const gd = O.squad().find((x: any) => x.state !== 'dead' && fight.opOf(x) && GDM.lightRuled(g, x) && x.script), h = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead');
    if (!gd || !h) { F.verdict(false, 'a teammate the light rule has, on an order, and a living hostile', `teammate ${gd?.callsign ?? 'none'} · hostile ${h?.callsign ?? 'none'}`); return F.done(); }
    const op = fight.opOf(gd), carried = () => true;
    const E = (p: number[], steady: boolean) => g.visibilityOf(GDM.lightEstimateAt(g, [p[0], 1.2, p[2]], carried, steady));
    // the floor read by the place's steady light: the brightest standing room and the two darkest (well apart, out of every doorway's funnel)
    const spots: { p: number[]; e: number }[] = [];
    for (let z = 1; z < nav.H - 1; z += 2) for (let x = 1; x < nav.W - 1; x += 2) { const p = [(x + 0.5) * nav.cell, 0, (z + 0.5) * nav.cell]; if (nav.isBlocked(p[0], p[2]) || fight.funnelOf(p)) continue; spots.push({ p, e: E(p, true) }); }
    spots.sort((a, b) => b.e - a.e);
    const lit = spots[0], dark = spots[spots.length - 1], dark2 = [...spots].reverse().find(s => Math.hypot(s.p[0] - dark.p[0], s.p[2] - dark.p[2]) > 4 && s.e < LIGHTS.litAt * 0.5)!;
    const lit2 = spots.find(s => s !== lit && s.e >= LIGHTS.litAt) ?? lit;
    F.verdict(lit.e >= LIGHTS.litAt && dark.e < LIGHTS.litAt * 0.5 && !!dark2, 'the floor has standing room the place lights and standing room it leaves dark',
      `${spots.length} places read · brightest ${f2(lit.e)} at ${at(lit.p)} · darkest ${f2(dark.e)} at ${at(dark.p)}${dark2 ? ` and ${f2(dark2.e)} at ${at(dark2.p)}` : ''} · the bar (LIGHTS.litAt) ${LIGHTS.litAt}`);
    if (!(lit.e >= LIGHTS.litAt) || !dark2) return F.done();
    const put = (who: any, p: number[]) => { who.char.pos[0] = p[0]; who.char.pos[2] = p[2]; };
    const later = () => { g.time += 0.3; };   // (the rule's answer is kept a quarter of a second per man: every question here is a fresh one)
    const eyes = (tgt: any, kept: any = null, turn: any = null) => { op.tgt = tgt; op.kept = kept; op.turn = turn; later(); };
    const ask = () => ({ rule: !!GDM.onLitMan(g, gd), light: !!GDM.teamLit(g, gd) });

    // ---- the light
    put(gd, dark.p); put(h, lit.p); eyes(h); if (BREAK) LIGHTS.litMan = false;
    const a = ask();
    F.verdict(a.rule && !a.light, 'from the dark on a lit man: the rule holds and his weapon light is off', `${gd.callsign} at ${at(dark.p)} (${f2(dark.e)}) on ${h.callsign} at ${at(lit.p)} (${f2(lit.e)}) · rule ${a.rule} · light ${a.light ? 'ON' : 'off'}`);
    LIGHTS.litMan = false; eyes(h); const b = ask(); LIGHTS.litMan = true;
    F.verdict(!b.rule && b.light, 'switch off: the rule does not hold and his light burns on the man, as it was', `rule ${b.rule} · light ${b.light ? 'ON' : 'off'}`);
    put(h, dark2.p); eyes(h); const c = ask();
    put(h, lit.p); put(gd, lit2.p); eyes(h); const d = ask();
    F.verdict(!c.rule && !d.rule, 'the man in the dark too, or he himself in the light: it does not hold', `man at ${at(dark2.p)} (${f2(dark2.e)}): rule ${c.rule} · himself at ${at(lit2.p)} (${f2(lit2.e)}): rule ${d.rule}`);
    put(gd, dark.p); put(h, dark2.p);
    g.engine.lights.flash([dark2.p[0] + 0.2, 1.0, dark2.p[2]], [1, 0.8, 0.5], 40, 4, 5, 0); eyes(h);
    const plain = E(dark2.p, false), steady = E(dark2.p, true), e = ask();
    F.verdict(plain >= LIGHTS.litAt && steady < LIGHTS.litAt && !e.rule, "a round's flash by a man in the dark lights him by the plain estimate, not by the rule's: it does not hold",
      `at ${at(dark2.p)}: every light ${f2(plain)} · steady lights only ${f2(steady)} · rule ${e.rule}`);
    for (const l of g.engine.lights.lights) if (l.ttl >= 0 && l.owner === 0) { l.enabled = false; l.intensity = 0; }
    put(h, lit.p);
    eyes(null, { h, track: 0, t: g.time }); const k1 = ask();
    const other = g.guards.find((x: any) => x !== h && x.team === 'hostile') ?? h;
    eyes(null, { h, track: 0, t: g.time }, { to: other, at: g.time, until: g.time + 2, pt: null, t0: g.time }); const k2 = ask();
    eyes(null, { h, track: 0, t: g.time - 2 }); const k3 = ask();
    F.verdict(k1.rule && !k1.light && !k2.rule && !k3.rule, 'the man out of his eyes a moment ago: it holds; a cue turning him to somebody else, or the blink grown old: it does not',
      `a blink: rule ${k1.rule}, light ${k1.light ? 'ON' : 'off'} · with a turn to ${other.callsign}: rule ${k2.rule} · two seconds old: rule ${k3.rule}`);

    // ---- the feet (holdShort is asked as tickOp asks it, with Sam in his line: that test is tickOp's own and is not this one's)
    const s = gd.script, hp = h.char.pos, dp = gd.char.pos, len = Math.hypot(hp[0] - dp[0], hp[2] - dp[2]) || 1, ux = (hp[0] - dp[0]) / len, uz = (hp[2] - dp[2]) / len;
    const walk = (toward: number) => { s.goal = [dp[0] + ux * toward, 0, dp[2] + uz * toward]; s.arrived = false; op.step = null; op.shortT = op.shortSeen = op.shortSince = -100; eyes(h); };
    const held = () => { fight.holdShort(op); return !!fight.short(gd); };
    walk(1.5); const f1 = held();
    walk(-1.5); const f2_ = held();
    walk(1.5); ROOMFIGHT.holdShortSecs = 0; const f3 = held(); ROOMFIGHT.holdShortSecs = keepR.holdShortSecs;
    walk(1.5); op.shortSeen = g.time - 0.1; op.shortSince = g.time - ROOMFIGHT.holdShortSecs - 1; const f4 = held();
    walk(1.5); LIGHTS.litMan = false; const f5 = held(); LIGHTS.litMan = true;
    F.verdict(f1 && !f2_ && !f3 && !f4 && !f5, 'feet: a walk that closes on the man is held; one that leads away, holdShortSecs 0, a hold past its cap, the switch off: not',
      `closing 1.5 m: ${f1 ? 'held' : 'walks'} · away 1.5 m: ${f2_ ? 'held' : 'walks'} · holdShortSecs 0: ${f3 ? 'held' : 'walks'} · ${ROOMFIGHT.holdShortSecs + 1} s into a hold: ${f4 ? 'held' : 'walks'} · switch off: ${f5 ? 'held' : 'walks'}`);
  } catch (err) { F.verdict(false, 'the probe ran', err instanceof Error ? (err.stack ?? err.message) : String(err)); }
  finally { Object.assign(LIGHTS, keepL); Object.assign(ROOMFIGHT, keepR); }
  return F.done();
}
