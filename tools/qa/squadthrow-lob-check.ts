// A TEAMMATE WORKS HIS THROW OUT (src/game/squadthrow.ts SQUADTHROW.lob / duck / samCall; src/game/throwplan.ts): X on a spot of floor, G, then 1 / 2.
//   bun run tools/qa/squadthrow-lob-check.ts          (also `probes.ts squadthrow-lob`, and under `squadthrow` / `squadorders`)
//   TPS_PROFILE=shipped bun run tools/qa/squadthrow-lob-check.ts      — the same lines on the page's stand: it passes on both (it raises the switches itself)
// PASS / FAIL each, all headless, on squadthrow-check.ts's rig: the room clear on the office with its four, every hostile off the floor, the squad holding.
// Asked: the flight a man flies in his head IS the item pool's flight (frags and canisters thrown for real from a hand at a velocity, into walls and onto
// floor: where the fuse finds each against where throwplan.ts throwFlight said); the squad has a throw to MORE of the floor with the rule on, and to every
// spot it had one to without it; a throw only the rule finds, ordered by the keys' own row, goes off by the spot asked for and where it was forecast; a
// frag a teammate can duck from is thrown and wounds nobody of ours (their god mode taken off for the line), where the old rule refused it by his name;
// a frag that reaches the player alone is live on its row and names him, and with samCall off is refused as it was; a recording from before the keys
// replays with all three off; a search flies no more than its count of throws and thirty re-reads of one spot fly none; a frag the squad's search
// finds clean is live on the row, and the page opened on it ten times over does not search at every opening.
// SQUADTHROW_LOB_BREAK=1 = the rule left off and the same lines asked: they must fail.   exit 0 = all hold · 1 = one does not
// The flight is throwables.ts's own step, kept apart from it (throwplan.ts): a change to how a thrown thing flies runs this check.
import { ROOT } from './headless.ts';
import { rig } from './squadthrow-check.ts';

const ST: any = await import(`${ROOT}/src/game/squadthrow.ts`);
const TP: any = await import(`${ROOT}/src/game/throwplan.ts`);
const FR: any = await import(`${ROOT}/src/game/frag.ts`);
const J: any = await import(`${ROOT}/src/game/journal.ts`);
const { flashFuse } = await import(`${ROOT}/src/game/combat.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { SQUADTHROW, SQUADTHROW_LOG, FRAG_THERE, STUN_THERE } = ST, { FRAG, FRAG_LOG } = FR;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—');
const p2 = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
type Kind = 'frag' | 'stun';

/** the office's floor, a metre apart, as the order's own target reads it */
function floor(R: any): number[][] {
  const out: number[][] = [];
  for (let x = 2.25; x <= 38; x += 1) for (let z = 2.25; z <= 26; z += 1) { const t = R.O.targetAt([x, 0, z]); if (t.kind === 'floor' && dist(t.at, [x, 0, z]) < 0.3) out.push(t.at); }
  return out;
}
/** the live thing of a kind followed until its fuse finds it: where it was then (null: none flew) */
function goesOff(R: any, kind: Kind, secs = 9): number[] | null {
  let last: number[] | null = null;
  R.until(() => { const it = R.items(kind === 'frag' ? 'frag' : 'flash').find((x: any) => !x.fired); if (it) { last = [...it.pos]; return false; } return last !== null; }, secs);
  return last;
}

export async function squadthrowLobCheck(): Promise<boolean> {
  const BREAK = process.env.SQUADTHROW_LOB_BREAK === '1', LOB = !BREAK; let all = true;
  const kept = { ...SQUADTHROW, frag: FRAG.on, wise: FRAG.fleeWise, squad: NIGHTBREACH.squad, random: Math.random };
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== squadthrow-lob: a teammate works his throw out${BREAK ? ' (SQUADTHROW_LOB_BREAK: the rule left off)' : ''} ===`);
  const guard = async (name: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { verdict(false, `${name}: the line threw`, e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 3).join(' · ') : String(e)); } };
  const rules = (lob: boolean, duck = true, sam = true) => { SQUADTHROW.lob = lob; SQUADTHROW.duck = duck; SQUADTHROW.samCall = sam; };
  try {
    // ───────────── 1 · the flight in his head is the pool's flight ─────────────
    await guard('the flight', async () => {
      const R = await rig(11, true, { walk: true, lob: true }), { game } = R, m = R.team[0], from: number[] = [m.char.pos[0], 1.3, m.char.pos[2]];
      const spots = floor(R).filter(at => dist(at, from) > 3 && dist(at, from) < 10 && !game.col.solidBlocked(from, [at[0], 1.0, at[2]]));
      const rows: string[] = []; let worst = 0, n = 0, walls = 0, moved = 0;
      for (let i = 0; i < 12 && spots.length; i++) {
        const kind: Kind = i % 2 ? 'stun' : 'frag', at = spots[Math.floor((i + 0.5) * spots.length / 12)], u = [10, 7.5, 5][i % 3], d = dist(at, from);
        // (every third one thrown a metre and a half PAST its spot's line, chest high: into whatever stands behind it)
        const k = i % 3 === 0 ? (d + 1.5) / d : 1, aim: number[] = [from[0] + (at[0] - from[0]) * k, i % 3 === 0 ? 0.9 : 0.05, from[2] + (at[2] - from[2]) * k];
        const T = Math.min(1.4, Math.max(0.3, dist(aim, from) / u)), v0 = [(aim[0] - from[0]) / T, (aim[1] - from[1] + 0.5 * 9.81 * T * T) / T, (aim[2] - from[2]) / T];
        const F = TP.throwFlight(game, kind, from, v0);
        game.items.spawn(kind === 'frag' ? 'frag' : 'flash', [...from], [...v0], { fuse: kind === 'frag' ? FRAG.orderFuse : flashFuse(game), who: m.char.id });
        const end = goesOff(R, kind); R.step(40);
        if (!end) { rows.push(`${kind} ${i}: never seen`); worst = 9; continue; }
        const err = Math.hypot(end[0] - F.end[0], end[1] - F.end[1], end[2] - F.end[2]); worst = Math.max(worst, err); n++;
        if (F.land[1] > 0.25) walls++; if (dist(F.land, F.end) > 0.5) moved++;
        rows.push(`${kind} at ${u} m/s${k > 1 ? ' long' : ''}: ${f2(err)}`);
      }
      verdict(n >= 10 && worst <= 0.25 && walls >= 2 && moved >= 4, 'twelve things thrown for real go off where the forecast put them (within 0.25 m), walls and long rolls among them',
        `${n} flown · worst ${f2(worst)} m · first contact off the floor ${walls} · rolled or bounced on over 0.5 m ${moved} · ${rows.join(' · ')}`);
    });

    // ───────────── 2 · more of the floor has a throw, and none of it lost one ─────────────
    let found: { at: number[]; kind: Kind }[] = [];
    await guard('the floor', async () => {
      const R = await rig(11, true, { walk: true, lob: true }), { game } = R, team = R.team, spots = floor(R);
      const ask = (kind: Kind, lob: boolean) => { rules(lob); return spots.map(at => { const th = ST.squadThrowPlan(game, team, at, kind, true); return !th ? 0 : kind === 'frag' && ST.squadFragCatches(game, th.rest, at, { gd: th.gd, at: th.post ?? th.gd.char.pos }, false) ? 1 : 2; }); };
      const out: string[] = []; let ok = true;
      for (const kind of ['frag', 'stun'] as Kind[]) {
        const off = ask(kind, false), on = ask(kind, LOB), has = (a: number[]) => a.filter(x => x > 0).length, good = (a: number[]) => a.filter(x => x === 2).length;
        const lost = off.filter((x, i) => x > 0 && on[i] === 0).length, lostGood = off.filter((x, i) => x === 2 && on[i] !== 2).length;
        ok &&= lost === 0 && lostGood === 0 && good(on) >= good(off) + 5;
        out.push(`${kind}: a throw nobody of ours is caught by ${good(off)} → ${good(on)} of ${spots.length} spots (any throw ${has(off)} → ${has(on)}) · lost ${lost} / ${lostGood}`);
        spots.forEach((at, i) => { if (off[i] === 0 && on[i] === 2) found.push({ at, kind }); });
      }
      rules(LOB);
      verdict(ok, 'the squad has a usable throw to more of the office floor with the rule on, and to every spot it had one to without it', out.join(' · '));
    });

    // ───────────── 3 · a throw only the rule finds, ordered, goes off by the spot ─────────────
    await guard('ordered', async () => {
      const R = await rig(11, true, { walk: true, lob: LOB }), { game, O } = R; rules(LOB);
      const rows: string[] = []; let good = 0, tried = 0;
      for (const kind of ['stun', 'frag', 'stun'] as Kind[]) {
        // (asked again of the floor as it stands NOW: an earlier throw of this line may have moved a man)
        SQUADTHROW.lob = false; const none = found.filter(f => f.kind === kind && !ST.squadThrowPlan(game, R.team, f.at, kind, true)); SQUADTHROW.lob = LOB;
        const mine = none.filter(f => { const th = ST.squadThrowPlan(game, R.team, f.at, kind, true); return !!th && !(kind === 'frag' && ST.squadFragCatches(game, th.rest, f.at, { gd: th.gd, at: th.post ?? th.gd.char.pos }, false)); });
        const c = mine[Math.floor(mine.length * (tried + 1) / 4)]; tried++;
        if (!c) { rows.push(`${kind}: no spot only the rule answers`); continue; }
        R.bag(2, 3); const log0 = SQUADTHROW_LOG.length, n0 = kind === 'frag' ? game.doorTools.frags : game.doorTools.bangs;
        const why = O.give(kind === 'frag' ? FRAG_THERE : STUN_THERE, O.targetAt(c.at)), thrown = R.until(() => SQUADTHROW_LOG.length > log0, 25);
        const L = SQUADTHROW_LOG[SQUADTHROW_LOG.length - 1], end = thrown ? goesOff(R, kind) : null, spent = n0 - (kind === 'frag' ? game.doorTools.frags : game.doorTools.bangs); R.step(60 * 4);
        const ok = !!end && dist(end, c.at) <= SQUADTHROW.lobNearM + 0.3 && dist(end, L.rest) <= 0.35 && spent === 1; if (ok) good++;
        rows.push(`${kind} at ${p2(c.at)}: ${why ?? 'given'} · ${thrown ? `${L.who} threw` : 'nothing thrown'} · went off ${end ? `${f2(dist(end, c.at))} m from the spot, ${f2(dist(end, L.rest))} m from the forecast` : '—'} · spent ${spent}`);
      }
      verdict(good === 3, 'three throws that only the rule finds — a stun, a frag, a stun — ordered by the row\'s own id: each thrown once, each going off by its spot and where it was forecast', rows.join(' · '));
    });

    // ───────────── 4 · a frag a teammate can duck from is thrown, and wounds nobody of ours ─────────────
    await guard('duck', async () => {
      const R = await rig(11, true, { walk: true, lob: LOB }), { game, O } = R, team = R.team; rules(LOB);
      FRAG.fleeWise = true;   // (the flee the duck rule counts on: on in the page, raised here for the frozen stand — the rule is inert without it)
      for (const m of team) m.god = false;
      const named = /^(Red|Blue) (One|Two) is in it\.$/;
      const cands = floor(R).filter(at => {
        const th = ST.squadThrowPlan(game, team, at, 'frag', true); if (!th) return false;
        const mv = { gd: th.gd, at: th.post ?? th.gd.char.pos }; if (ST.squadFragCatches(game, th.rest, at, mv, false)) return false;
        SQUADTHROW.duck = false; const strict = ST.squadFragCatches(game, th.rest, at, mv, false); SQUADTHROW.duck = true; return !!strict && named.test(strict);
      });
      const rows: string[] = []; let hurt = 0, thrownN = 0;
      for (let i = 0; i < 3 && cands.length; i++) {
        const at = cands[Math.floor((i + 0.5) * cands.length / 3)]; R.bag(2, 3);
        const log0 = SQUADTHROW_LOG.length, b0 = FRAG_LOG.length, why = O.give(FRAG_THERE, O.targetAt(at)), thrown = R.until(() => SQUADTHROW_LOG.length > log0, 25);
        if (thrown) { thrownN++; goesOff(R, 'frag'); } R.step(60 * 4);
        const rep = FRAG_LOG.length > b0 ? FRAG_LOG[FRAG_LOG.length - 1] : null, ours = rep ? rep.hits.filter((h: any) => h.team === 'operative' && h.result !== 'shielded') : [];
        hurt += ours.length;
        rows.push(`${p2(at)}: ${why ?? 'given'} · ${thrown ? 'thrown' : 'not thrown — ' + (R.lines[R.lines.length - 1]?.text ?? '')} · ours hit ${ours.map((h: any) => `${h.name} ${h.result}`).join(', ') || 'none'}`);
      }
      verdict(cands.length >= 3 && thrownN >= 2 && hurt === 0, 'frags the old rule refused by a teammate\'s name and the duck rule allows: ordered, thrown, and nobody of ours killed, wounded or stunned (their god mode off)',
        `${cands.length} such spots · ${rows.join(' · ') || 'none to throw at'}`);
    });

    // ───────────── 5 · a frag that reaches the player alone is his call ─────────────
    await guard('his call', async () => {
      const R = await rig(11, true, { walk: true, lob: LOB }), { game } = R, team = R.team; rules(LOB);
      const at = floor(R).find(q => { const th = ST.squadThrowPlan(game, team, q, 'frag', true); if (!th) return false; const mv = { gd: th.gd, at: th.post ?? th.gd.char.pos }; return ST.squadFragCatches(game, th.rest, q, mv, true) === 'you are in it.' && !ST.squadFragCatches(game, th.rest, q, mv, false); });
      if (!at) { verdict(false, 'a spot whose frag reaches the player and nobody else of ours', 'none on the office floor'); return; }
      const on = R.pageAt(at)[0]; R.esc(); SQUADTHROW.samCall = false; R.step(90); const off = R.pageAt(at)[0]; R.esc(); SQUADTHROW.samCall = true;
      verdict(!!on && !on.off && / · too close: you$/.test(on.text) && !!off && off.off, 'the frag row on a spot only the player is in reach of: live and naming him; with samCall off, refused as it was',
        `${p2(at)} · on: "${on?.text}"${on?.off ? ' (off)' : ''} · samCall off: "${off?.text}"${off?.off ? ' (off)' : ' (LIVE)'}`);
    });

    // ───────────── 6 · a recording from before the keys · what a search costs ─────────────
    await guard('journal and cost', async () => {
      const R = await rig(11, true, { walk: true, lob: LOB }), { game } = R, team = R.team; rules(LOB);
      const snap = () => J.knobsSnapshot(game), old = snap(); delete old.tables.SQUADTHROW.lob; delete old.tables.SQUADTHROW.duck; delete old.tables.SQUADTHROW.samCall;
      const own = snap(); rules(true); J.applyKnobs(game, old); const without = [SQUADTHROW.lob, SQUADTHROW.duck, SQUADTHROW.samCall].join();
      rules(false, false, false); J.applyKnobs(game, own); const withIt = [SQUADTHROW.lob, SQUADTHROW.duck, SQUADTHROW.samCall].join(); rules(LOB);
      verdict(without === 'false,false,false' && withIt === [LOB, true, true].join(), 'a recording with no such keys replays with the three rules off; one made with them replays as it was made',
        `no keys → ${without} · its own keys → ${withIt}`);
      const none = floor(R).filter(at => !ST.squadThrowPlan(game, team, at, 'stun', true)); let worstN = 0, sum = 0, worstMs = 0;
      for (const at of none) { const s0 = TP.THROWPLAN_STATS.sims, t0 = performance.now(); ST.squadThrowPlan(game, team, at, 'stun', true); const ms = performance.now() - t0; sum += ms; worstMs = Math.max(worstMs, ms); worstN = Math.max(worstN, TP.THROWPLAN_STATS.sims - s0); }
      const at = none.find(q => { const s0 = TP.THROWPLAN_STATS.sims; ST.squadThrowPlan(game, team, q, 'stun', true); return TP.THROWPLAN_STATS.sims > s0; }); let again = -1;
      if (at) { ST.squadThrowPlan(game, team, at, 'stun', true); const s0 = TP.THROWPLAN_STATS.sims; for (let i = 0; i < 30; i++) ST.squadThrowPlan(game, team, at, 'stun'); again = TP.THROWPLAN_STATS.sims - s0; }
      verdict(none.length > 0 && worstN > 0 && worstN <= SQUADTHROW.lobSims * 1.5 + 8 && again === 0, 'a search that finds nothing flew some throws and no more than its count (half of it again for the men where they stand, + the steps to each side of the last cell); thirty re-reads of that spot flew none',
        `${none.length} spots with no stun throw · most flown in one search ${worstN} of ${SQUADTHROW.lobSims} · thirty re-reads flew ${again} · ${f2(sum / Math.max(1, none.length))} ms a search, worst ${f2(worstMs)} (this machine's clock)`);
    });
    // ───────────── 8 · the row asks what the search asked ─────────────
    await guard('the row', async () => {
      const R = await rig(11, true, { walk: true, lob: LOB }), { game } = R, team = R.team; rules(LOB); R.bag(2, 3);
      // (frag spots only the rule answers, and clean by the squad's own plan: the row is the thrower's alone, and asked of him alone the search is another one)
      const clean = found.filter(f => f.kind === 'frag').filter(f => { const th = ST.squadThrowPlan(game, team, f.at, 'frag', true); return !!th && !ST.squadFragCatches(game, th.rest, f.at, { gd: th.gd, at: th.post ?? th.gd.char.pos }, false); });
      const every = Math.max(1, Math.floor(clean.length / 12)), some = clean.filter((_, i) => i % every === 0).slice(0, 12); let live = 0; const dead: string[] = [];
      for (const f of some) { const row = R.pageAt(f.at).find((r: { text: string }) => r.text.startsWith('frag')); R.esc(); if (row && !row.off) live++; else dead.push(`${p2(f.at)}: ${row?.text ?? 'no row'}`); }
      // (the page opened on one of them ten times inside the answer's keeping: the squad's question and the one man's were one kept slot, each putting the
      //  other out, and every opening searched two or three times over — over a thousand flights for the ten; kept apart, the ten are a search or two)
      let flown = -1; const c = some[0];
      if (c) { R.pageAt(c.at); R.esc(); const s0 = TP.THROWPLAN_STATS.sims; for (let i = 0; i < 10; i++) { R.pageAt(c.at); R.esc(); } flown = TP.THROWPLAN_STATS.sims - s0; }
      verdict(some.length > 0 && live === some.length && flown >= 0 && flown <= SQUADTHROW.lobSims * 4, 'a frag the squad\'s search finds clean is live on the row (the row asks the men the search was asked of); the page opened on it ten times over flies a search or two, not two an opening',
        `${some.length} of ${clean.length} such spots asked · live ${live}${dead.length ? ` · off: ${dead.slice(0, 3).join(' | ')}` : ''} · ten openings flew ${flown} (≤ ${SQUADTHROW.lobSims * 4})`);
    });
  } finally {
    const { frag, wise, squad, random, ...knobs } = kept; Object.assign(SQUADTHROW, knobs); FRAG.on = frag; FRAG.fleeWise = wise; NIGHTBREACH.squad = squad; Math.random = random;
  }
  console.log(all ? '\nsquadthrow-lob: all hold' : '\nsquadthrow-lob: FAILED');
  return all;
}

if (import.meta.main) process.exit((await squadthrowLobCheck()) ? 0 : 1);
