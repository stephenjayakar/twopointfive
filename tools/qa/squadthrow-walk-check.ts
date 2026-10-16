// A TEAMMATE WITH NO THROW FROM WHERE HE STANDS WALKS TO ONE (src/game/squadthrow.ts SQUADTHROW.walk): X on a spot of floor, G, then 1 / 2.
//   bun run tools/qa/squadthrow-walk-check.ts          (also `probes.ts squadthrow-walk`, and under `squadthrow` / `squadorders`)
//   TPS_PROFILE=shipped bun run tools/qa/squadthrow-walk-check.ts      — the same lines on the page's stand: it passes on both (it raises the switches itself)
// PASS / FAIL each, all headless, on squadthrow-check.ts's rig: the room clear on the office with its four, every hostile off the floor, the squad holding.
// Asked: a spot nobody has a throw to gets a man who WALKS — the row is live, the order by keys, nothing thrown or spent until he is on his spot, the thing
// then comes to rest by the spot asked for, he goes back to where he stood and to the order he had (a hold, a fall in); the picture's entries
// (squadThrowPlans: the page's preview, then the walk until the thing leaves his hand); another order mid-walk ends it with nothing spent; nobody is
// walked further than walkM; with the walk off the same spot is refused as it was; a man a drill owns or the fight has is not the one walked; thirty
// re-reads of one spot cost one search; the player stepping into a frag's reach mid-walk = refused at the hand, nothing spent; the walk back switched
// off = he holds where he threw; what a search costs (mean and 95th: a single sample's wall clock is the machine's).
// SQUADTHROW_WALK_BREAK=1 = the walk left off and the same lines asked: they must fail.   exit 0 = all hold · 1 = one does not
import { ROOT } from './headless.ts';
import { rig } from './squadthrow-check.ts';

const ST: any = await import(`${ROOT}/src/game/squadthrow.ts`);
const { FRAG } = await import(`${ROOT}/src/game/frag.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { SQUADTHROW, SQUADTHROW_STATS, SQUADTHROW_LOG, FRAG_THERE, STUN_THERE } = ST;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const p2 = (p: number[]) => `(${f1(p[0])}, ${f1(p[2])})`;

/** floor spots nobody of the squad has a throw to from where he stands and one of them has after a walk (a frag: nobody of ours in it), nearest walk first */
function spots(R: any, kind: 'frag' | 'stun', max = 6): { at: number[]; th: any }[] {
  const { game, O } = R, team = R.team, out: { at: number[]; th: any; d: number }[] = [];
  for (let x = 2.25; x <= 38; x += 1) for (let z = 2.25; z <= 26; z += 1) {
    const t = O.targetAt([x, 0, z]); if (t.kind !== 'floor' || dist(t.at, [x, 0, z]) > 0.3) continue;
    if (ST.squadThrower(game, team, t.at, kind)) continue;
    const th = ST.squadThrowPlan(game, team, t.at, kind, true); if (!th?.post) continue;
    if (kind === 'frag' && ST.squadFragCatches(game, th.rest, t.at)) continue;
    out.push({ at: t.at, th, d: dist(th.gd.char.pos, th.post) });
  }
  return out.sort((a, b) => b.d - a.d).slice(0, max);   // (the longest walks first: a walk worth the name)
}

export async function squadthrowWalkCheck(): Promise<boolean> {
  const BREAK = process.env.SQUADTHROW_WALK_BREAK === '1', WALK = !BREAK; let all = true;
  const kept = { ...SQUADTHROW, frag: FRAG.on, squad: NIGHTBREACH.squad, random: Math.random };
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== squadthrow-walk: a teammate walks to where he has a throw${BREAK ? ' (SQUADTHROW_WALK_BREAK: the walk left off)' : ''} ===`);
  const guard = async (name: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { verdict(false, `${name}: the line threw`, e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 3).join(' · ') : String(e)); } };
  /** one walked throw by the keys on `at`; what happened */
  const walked = (R: any, at: number[], kind: 'frag' | 'stun', key: string) => {
    const { game, O } = R, D = game.doorTools, item = kind === 'frag' ? 'frag' : 'flash', id = kind === 'frag' ? FRAG_THERE : STUN_THERE, count = () => kind === 'frag' ? D.frags : D.bangs;
    const n0 = count(), log0 = SQUADTHROW_LOG.length, lines0 = R.lines.length;
    const rows = R.pageAt(at), row = rows[kind === 'frag' ? 0 : 1], pre = ST.squadThrowPlans(game);
    R.press(key); R.step(2);
    const man = R.team.find((m: any) => O.of(m)?.order === id), home = man ? [...man.char.pos] : [0, 0, 0], post = man ? [...O.of(man).post] : [0, 0, 0];
    const live = ST.squadThrowPlans(game), early = R.items(item).length, spentEarly = n0 - count(), saidGo = R.lines.slice(lines0).some((l: any) => /moving to throw/.test(l.text));
    let maxV = 0; const thrown = R.until(() => { if (man) maxV = Math.max(maxV, Math.hypot(man.char.vel[0], man.char.vel[2])); return SQUADTHROW_LOG.length > log0; }, 25);
    const L = SQUADTHROW_LOG[SQUADTHROW_LOG.length - 1], from = thrown ? dist(L.from, post) : NaN, after = ST.squadThrowPlans(game).length, spent = n0 - count();
    const said = R.lines.slice(lines0).map((l: any) => `${l.who}: ${l.text}`).join(' / '), end = man ? [...man.char.pos] : [0, 0, 0];
    return { rows, row, pre, man, home, post, live, early, spentEarly, saidGo, thrown, L, from, after, spent, maxV, id, item, said, end };
  };
  try {
    // ───────────── 1 · the walk, the frag, back to his hold ─────────────
    await guard('walk and frag', async () => {
      const R = await rig(11, true, { walk: WALK }), { game, O } = R, c = spots(R, 'frag')[0];
      if (!c) { verdict(false, 'a spot nobody has a throw to and one man can walk to a throw for', `none found on the office with the four holding at ${R.team.map((m: any) => p2(m.char.pos)).join(' ')}`); return; }
      const w = walked(R, c.at, 'frag', 'Digit1'), m = w.man;
      verdict(!!w.row && !w.row.off && /^frag there · 2 left/.test(w.row.text) && w.pre.length === 1 && w.pre[0].preview === true && (w.pre[0].walk?.length ?? 0) > 1 && w.pre[0].points.length > 2,
        'a spot nobody has a throw to from where he stands: the frag row is live, and the page shows one plan — who, his walk, the arc — before anything is ordered',
        `spot ${p2(c.at)} · row '${w.row?.text}'${w.row?.off ? ' (off)' : ''} · preview ${w.pre.length} (${w.pre[0]?.gd?.callsign}, walk ${w.pre[0]?.walk?.length ?? 0} pts, arc ${w.pre[0]?.points?.length ?? 0} pts)`);
      verdict(!!m && w.saidGo && w.early === 0 && w.spentEarly === 0 && w.live.length === 1 && !w.live[0].preview && w.live[0].gd === m && dist(w.live[0].from, w.post) < 0.05 && dist(w.home, w.post) > 1,
        '1 gives it: one man is walked to the floor he has a throw from under the row\'s own id, he says so, nothing has left a hand and nothing is spent, and the picture carries his walk',
        `${m?.callsign} from ${p2(w.home)} to ${p2(w.post)} (${f1(dist(w.home, w.post))} m) · said: ${w.saidGo} · items ${w.early} · spent ${w.spentEarly} · live plans ${w.live.length} (${w.live[0]?.gd?.callsign}${w.live[0]?.preview ? ', preview' : ''}, from ${w.live[0] ? p2(w.live[0].from) : '—'}, walk ${w.live[0]?.walk?.length ?? 0} pts)`);
      verdict(w.thrown && w.from < 0.7 && w.spent === 1 && dist(w.L.rest, c.at) < 1.3 && w.after === 0 && w.maxV <= 2.3,
        'on his spot he throws: the frag leaves from that floor, one is spent, it is planned to rest by the spot asked for, the picture is gone with the throw, and he never ran',
        `thrown ${w.thrown} · ${f1(w.from)} m from his spot · spent ${w.spent} · rest ${f1(w.thrown ? dist(w.L.rest, c.at) : NaN)} m from the spot · plans after ${w.after} · fastest ${w.maxV.toFixed(2)} m/s · said: ${w.said} · he stood ${p2(w.end)} for a spot ${p2(w.post)}, the throw to ${p2(c.at)}`);
      const item = R.items('frag')[0]; R.until(() => !R.items('frag').length, 8);
      const back = R.until(() => !!m && dist(m.char.pos, w.home) < 0.6 && O.of(m)?.order === 'hold', 20);
      verdict(back && R.team.every((x: any) => x.state !== 'dead') && !!item,
        'thrown, he walks back to where he stood and holds again, as he was ordered before',
        `${m?.callsign} ${f1(m ? dist(m.char.pos, w.home) : NaN)} m from where he stood · order '${m ? O.of(m)?.order : '—'}' · walks ${SQUADTHROW_STATS.walks} walked ${SQUADTHROW_STATS.walked}`);
    });
    // ───────────── 2 · the stun; a man who was following falls in again ─────────────
    await guard('stun and fall in', async () => {
      const R = await rig(12, true, { walk: WALK }), { game, O } = R;
      O.give('fallIn', O.targetAt(game.player.char.pos)); R.step(60 * 3);
      const c = spots(R, 'stun')[0];
      if (!c) { verdict(false, 'a spot for a walked stun with the squad fallen in', 'none found'); return; }
      const w = walked(R, c.at, 'stun', 'Digit2'), m = w.man;
      verdict(!!m && w.thrown && w.spent === 1 && w.spentEarly === 0 && w.from < 0.7 && dist(w.L.rest, c.at) < 1.3,
        '2 on such a spot: a man walks and throws the stun canister from his spot — one can, spent at the throw',
        `${m?.callsign} ${p2(w.home)} → ${p2(w.post)} · thrown ${w.thrown} · ${f1(w.from)} m from his spot · spent ${w.spent} (before the throw ${w.spentEarly}) · rest ${f1(w.thrown ? dist(w.L.rest, c.at) : NaN)} m off`);
      const back = R.until(() => !!m && O.of(m)?.order === 'fallIn', 6);
      verdict(back, 'a man who was following falls in again once it is thrown', `${m?.callsign} order '${m ? O.of(m)?.order : '—'}'`);
    });
    // ───────────── 3 · another order ends it; the limits; off ─────────────
    await guard('re-ordered, limits, off', async () => {
      const R = await rig(13, true, { walk: WALK }), { game, O } = R, D = game.doorTools, c = spots(R, 'frag')[0];
      if (!c) { verdict(false, 'a spot for the re-order line', 'none found'); return; }
      R.pageAt(c.at); R.press('Digit1'); R.step(20);
      const m = R.team.find((x: any) => O.of(x)?.order === FRAG_THERE), n0 = R.items('frag').length;
      O.give('hold', O.targetAt(game.player.char.pos)); R.step(60 * 6);
      verdict(!!m && O.of(m)?.order === 'hold' && R.items('frag').length === n0 && D.frags === 2 && ST.squadThrowPlans(game).length === 0,
        'told to hold while he walks: the throw is off — nothing thrown, nothing spent, nothing drawn',
        `${m?.callsign} order '${m ? O.of(m)?.order : '—'}' · frags ${D.frags} · plans ${ST.squadThrowPlans(game).length}`);
      // the limits: no walk longer than walkM, and with the walk off the spot is refused as it was
      const far = SQUADTHROW.walkM; SQUADTHROW.walkM = 0.4; const short = R.pageAt(c.at); R.esc(); SQUADTHROW.walkM = far;
      SQUADTHROW.walk = false; const off = R.pageAt(c.at), offPlans = ST.squadThrowPlans(game).length; R.press('Digit1'); R.step(5); R.esc(); const offMan = R.team.some((x: any) => O.of(x)?.order === FRAG_THERE); SQUADTHROW.walk = WALK;
      verdict(short.length === 2 && short.every((r: any) => r.off && /no throw from here/.test(r.text)) && off.length === 2 && off.every((r: any) => r.off && /no throw from here/.test(r.text)) && !offMan && offPlans === 0 && D.frags === 2,
        'nobody is walked further than walkM; with the walk off the same spot is "no throw from here." for both kinds, as it was, and 1 sends nobody',
        `walkM 0.4: ${short.map((r: any) => `'${r.text}'${r.off ? ' (off)' : ''}`).join(' | ')} · walk off: ${off.map((r: any) => `'${r.text}'${r.off ? ' (off)' : ''}`).join(' | ')} · sent ${offMan}`);
      // a man a door order has is not walked off it
      R.esc(); const all4 = R.team, c2 = spots(R, 'frag')[0], w0 = c2?.th.gd;
      if (!c2) { verdict(false, 'a spot for the owned / fighting lines', 'none found with the squad where the hold left it'); return; }
      const fakeOwner = { owns: (gd: any) => gd === w0, release: () => true } as any; O.owners.push(fakeOwner);
      const th = ST.squadThrowPlan(game, all4, c2.at, 'frag', true); O.owners.pop();
      verdict(!!w0 && (!th || th.gd !== w0), 'a man a drill owns is never the one walked: with the walker owned, another man is found or nobody',
        `spot ${p2(c2.at)} · free, the walker is ${w0?.callsign} · with him owned: ${th?.gd?.callsign ?? 'nobody'}`);
      // nor a man the fight has
      const F = game.fight, opOf = F.opOf; F.opOf = (gd: any) => gd === w0 ? { ...(opOf.call(F, gd) ?? {}), tgt: {} } : opOf.call(F, gd);
      let tf: any; try { tf = ST.squadThrowPlan(game, all4, c2.at, 'frag', true); } finally { F.opOf = opOf; }
      verdict(!!w0 && (!tf || tf.gd !== w0), 'a man with an enemy in his sights is never walked off his fight', `with ${w0?.callsign} on a man: ${tf?.gd?.callsign ?? 'nobody'}${tf && !tf.post ? ' (a throw from where he stands)' : ''}`);
      // the menu's and the picture's re-reads share one search
      ST.squadThrowPlan(game, all4, c2.at, 'frag', true); const a0 = SQUADTHROW_STATS.arcs; for (let i = 0; i < 30; i++) ST.squadThrowPlan(game, all4, c2.at, 'frag');
      const a1 = SQUADTHROW_STATS.arcs; ST.squadThrowPlan(game, all4, c2.at, 'frag', true); const a2 = SQUADTHROW_STATS.arcs;
      verdict(a1 === a0 && a2 > a1, 'thirty re-reads of one spot at one moment cost no search: the answer is kept, and only a fresh ask searches again', `arcs tried by 30 re-reads ${a1 - a0} · by one fresh ask ${a2 - a1}`);
    });
    // ───────────── 3b · the player steps into the frag while the man walks; told to stay where he throws ─────────────
    await guard('stepped into it', async () => {
      const R = await rig(15, true, { walk: WALK }), { game, O } = R, D = game.doorTools, c = spots(R, 'frag')[0];
      if (!c) { verdict(false, 'a spot for the stepped-into-it line', 'none found'); return; }
      const r0 = SQUADTHROW_STATS.refused, lines0 = R.lines.length; R.pageAt(c.at); R.press('Digit1'); R.step(20);
      const m = R.team.find((x: any) => O.of(x)?.order === FRAG_THERE), home = m ? [...m.char.pos] : [0, 0, 0];
      R.sam(c.at);
      const over = R.until(() => !!m && O.of(m)?.order !== FRAG_THERE, 25), said = R.lines.slice(lines0).map((l: any) => `${l.who}: ${l.text}`).join(' / ');
      R.until(() => !!m && dist(m.char.pos, home) < 0.6, 20);
      verdict(!!m && over && R.items('frag').length === 0 && D.frags === 2 && SQUADTHROW_STATS.refused > r0 && O.of(m)?.order === 'hold' && dist(m.char.pos, home) < 0.6,
        'the player walks onto the spot while the man is on his way: on his floor he looks again, throws nothing, spends nothing, says why and goes back',
        `${m?.callsign} · order '${m ? O.of(m)?.order : '—'}' · frags in the air ${R.items('frag').length} · left ${D.frags} · refused ${SQUADTHROW_STATS.refused - r0} · ${f1(m ? dist(m.char.pos, home) : NaN)} m from where he stood · said: ${said}`);
    });
    await guard('stays where he throws', async () => {
      const R = await rig(16, true, { walk: WALK }), { O } = R, c = spots(R, 'stun')[0];
      if (!c) { verdict(false, 'a spot for the stay line', 'none found'); return; }
      SQUADTHROW.back = false; let w: any; try { w = walked(R, c.at, 'stun', 'Digit2'); R.step(60 * 5); } finally { SQUADTHROW.back = kept.back; }
      const m = w.man;
      verdict(!!m && w.thrown && O.of(m)?.order === 'hold' && dist(m.char.pos, w.post) < 0.8 && dist(w.home, w.post) > 1,
        'with the walk back switched off he holds where he threw from', `${m?.callsign} threw ${w.thrown} · ${f1(m ? dist(m.char.pos, w.post) : NaN)} m from his spot, ${f1(m ? dist(m.char.pos, w.home) : NaN)} m from where he stood · order '${m ? O.of(m)?.order : '—'}'`);
    });
    // ───────────── 4 · what a search costs ─────────────
    await guard('cost', async () => {
      const R = await rig(14, true, { walk: WALK }), { game, O } = R, team = R.team; let n = 0, worst = 0, sum = 0, found = 0, most = 0, arcs0 = SQUADTHROW_STATS.arcs, srch0 = SQUADTHROW_STATS.searches; const all: number[] = [];
      for (let x = 2.25; x <= 38; x += 1.5) for (let z = 2.25; z <= 26; z += 1.5) {
        const t = O.targetAt([x, 0, z]); if (t.kind !== 'floor' || ST.squadThrower(game, team, t.at, 'frag')) continue;
        const a0 = SQUADTHROW_STATS.arcs, t0 = performance.now(), th = ST.squadThrowPlan(game, team, t.at, 'frag', true), ms = performance.now() - t0; n++; sum += ms; all.push(ms); worst = Math.max(worst, ms); most = Math.max(most, SQUADTHROW_STATS.arcs - a0); if (th) found++;
      }
      all.sort((p, q) => p - q); const p95 = all[Math.floor(all.length * 0.95)] ?? 0;
      // THE BOUND IS A COUNT OF WORK, never the wall clock (a loaded box read 9 ms a search where the same run alone read 1.8): the arcs
      // a search may ask are `tries`, and each arc that holds is asked four times more (a stride to each side of the mark). The times
      // are printed for whoever reads the line; nothing is judged by them.
      const cap = SQUADTHROW.tries * 5, each = (SQUADTHROW_STATS.arcs - arcs0) / Math.max(1, n), runs = SQUADTHROW_STATS.searches - srch0;
      verdict(WALK && n > 20 && found > 0 && most <= cap && runs <= n, 'a search for a spot is a bounded cost (asked when the row is read, kept 0.4 s, and once at the order)',
        `${n} spots with no throw from where anybody stands: a walk found for ${found} · ${runs} searches, ${each.toFixed(0)} arcs a search, ${most} at most (the cap ${cap}) · timed here, not judged: mean ${(sum / Math.max(1, n)).toFixed(2)} ms, 95th ${p95.toFixed(1)} ms, worst ${worst.toFixed(1)} ms`);
    });
  } finally {
    const { frag, squad, random, ...knobs } = kept; Object.assign(SQUADTHROW, knobs); FRAG.on = frag; NIGHTBREACH.squad = squad; Math.random = random;
  }
  console.log(`=== squadthrow-walk: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await squadthrowWalkCheck()) ? 0 : 1);
