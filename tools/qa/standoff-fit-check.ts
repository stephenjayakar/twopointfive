// THE CHARGE ROW'S STAND-OFF TEST ASKS THE DEALING THE ORDER MAKES (src/game/doortools.ts standoffFits / standoffDeal / startCharge).
//   bun run tools/qa/probes.ts standofffit        (family `doortools`)        STANDOFFFIT_BREAK=1 = line 2's refusal is never said: must FAIL
// The order deals its marks by standoffDeal: the man nearest the door's frame takes the first mark, the rest are paired with the others. The row's test asked
// that deal only of three men or more; of one or two it asked the least total walk (orders.ts pair), which for two men can hand the marks the other way round:
// the row then passed on a walk the order never makes (a man sent to a mark he cannot reach), or refused for one it would never ask. No switch: a mend of a
// test that disagreed with its own order. Staged on the office floor (roomclear, the squad of four, every defender far away): two men stood so that the two
// dealings differ, then `orders.reach` refused for exactly one (man, mark) and the test asked. Headless; no page, nothing drawn; nothing is stepped but the start.
import { standUp, ROOT } from './headless.ts';
export async function standoffFitCheck(): Promise<boolean> {
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const BRK = process.env.STANDOFFFIT_BREAK === '1'; let all = true;
  const log = console.log, quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = e; console.warn = w; } };
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  log(`\n=== standofffit: the charge row's stand-off test asks the dealing the order makes${BRK ? ' (line 2 refuses nothing: must fail)' : ''} ===`);
  const W: any = await quiet(() => standUp({ seed: 1 })); const g = W.game; g.godMode = true;
  const why = await quiet(async () => startFromQuery(g, new URLSearchParams('roomclear=1&squad4')).why); if (why) { verdict(false, 'the office floor with the squad of four stands up', `start refused — ${why}`); return false; }
  await quiet(() => { for (let i = 0; i < 20; i++) W.step(1 / 60); });
  const O = g.orders, D = g.doorTools as any, nav = g.col.nav, flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]), f = (p: number[]) => `${p[0].toFixed(2)},${p[2].toFixed(2)}`;
  const put = (gd: any, p: number[]) => { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; };
  for (const h of g.guards) if (h.team === 'hostile') put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]);   // (nobody to walk round: a refusal here is the check's own)
  const squad: any[] = O.squad().filter((x: any) => x.state !== 'dead'), men = squad.slice(0, 2), home = squad.map(m => [...m.char.pos]);
  if (squad.length < 4) { verdict(false, 'the squad of four is on the floor', `${squad.length} teammates`); return false; }
  const same = (a: number[], b: number[]) => flat(a, b) < 1e-6, idx = (posts: any[], p: number[]) => posts.findIndex(P => same(P.pos, p));
  const words = (l: [any, number[]][], posts: any[]) => l.map(([m, p]) => `${m.callsign} → mark ${idx(posts, p) + 1}`).sort().join(', ');
  const dealOf = (m: any[], d: any, posts: any[]): [any, number[]][] => D.standoffDeal(m, d, posts).map(([gd, P]: any) => [gd, P.pos]);
  // ---- 1: two men stood so that the deal and the least walk differ — the lead part-way from the frame to the SECOND mark, the other man on the first
  let S: { d: any; side: 1 | -1; t: any; posts: any[]; lead: any; other: any; at: number[] } | null = null;
  find: for (const d of g.doors.list) for (const side of [1, -1] as const) { const p0 = D.standoffPosts(d, side, 2, men); if (!p0) continue;
    for (const k of [0.6, 0.5, 0.7, 0.4, 0.3]) { const c = d.frameCentre, q = p0[1].pos, at = [c[0] + (q[0] - c[0]) * k, 0, c[2] + (q[2] - c[2]) * k]; if (nav.isBlocked(at[0], at[2])) continue;
      const [lead, other] = men; put(lead, at); put(other, p0[0].pos);
      const posts = D.standoffPosts(d, side, 2, men), t = { kind: 'door', at: [c[0], 0, c[2]], door: d, side };   // (asked again with the men where they now stand: the marks are theirs)
      if (posts && words(dealOf(men, d, posts), posts) !== words(O.pair(men, posts.map((x: any) => x.pos)), posts) && D.standoffDeal(men, d, posts)[0][0] === lead
        && men.every((m: any) => posts.every((P: any) => O.reach(m, P.pos) === null)) && D.standoffFits(men, t) === true) { S = { d, side, t, posts, lead, other, at }; break find; }
      men.forEach((m, i) => put(m, home[i])); } }
  if (!S) { verdict(false, 'two men are stood at a door so that the deal and the least walk hand the marks differently', 'no door of the office floor gave such a staging'); return false; }
  const { d, side, t, posts, lead, other } = S, m0 = posts[0].pos, m1 = posts[1].pos, deal = dealOf(men, d, posts), least: [any, number[]][] = O.pair(men, posts.map((x: any) => x.pos));
  const walk = (l: [any, number[]][]) => l.reduce((s, [m, p]) => s + flat(m.char.pos, p), 0);
  verdict(idx(posts, deal.find(([m]) => m === lead)![1]) === 0 && idx(posts, least.find(([m]) => m === lead)![1]) === 1 && flat(lead.char.pos, d.frameCentre) < flat(other.char.pos, d.frameCentre),
    'staged: the man nearest the frame is dealt the first mark, and the least total walk would hand him the second',
    `office floor, door ${d.def.name} face ${side > 0 ? '+' : '−'} · marks 1 ${f(m0)} 2 ${f(m1)} · ${lead.callsign} at ${f(lead.char.pos)} (${flat(lead.char.pos, d.frameCentre).toFixed(2)} m off the frame), ${other.callsign} at ${f(other.char.pos)} (${flat(other.char.pos, d.frameCentre).toFixed(2)} m)\n    the deal: ${words(deal, posts)} (${walk(deal).toFixed(2)} m walked) · the least walk: ${words(least, posts)} (${walk(least).toFixed(2)} m)`);
  // ---- 2 + 3: reach refuses for exactly one (man, mark); everything else is passed through
  const reach0 = O.reach, WORD = 'the check stands in his way.', asked: string[] = [];
  const refuse = (who: any, mark: number[] | null) => { asked.length = 0; O.reach = (gd: any, to: number[]) => { asked.push(`${gd.callsign} → mark ${idx(posts, to) + 1}`); return mark && gd === who && same(to, mark) ? WORD : reach0.call(O, gd, to); }; };
  try {
    refuse(lead, BRK ? null : m0); const a = D.standoffFits(men, t), askedA = asked.join(', ');
    verdict(a === WORD, `${lead.callsign} cannot reach the first mark — the one the order sends him to: the row is refused, in reach's own words`, `standoffFits → ${JSON.stringify(a)} · asked of reach: ${askedA || 'nothing'}`);
    refuse(lead, m1); const b = D.standoffFits(men, t), askedB = asked.join(', ');
    verdict(b === true, `${lead.callsign} cannot reach the second mark — one the order never gives him: the row stands`, `standoffFits → ${JSON.stringify(b)} · asked of reach: ${askedB || 'nothing'}`);
  } finally { O.reach = reach0; }
  // ---- 4: reach as it is — the deal's own reaches, for two, three and four men
  { const byHand = (m: any[]): true | string => { const P = D.standoffPosts(d, side, m.length, m); if (!P) return 'no room to stand off.';
      const mate = D.behind(d, side, m); if (mate) return `${mate.callsign} is behind that door.`;
      if (D.stepBacks(d, side, m, P.map((x: any) => x.pos), true) === null) return 'no room to stand off.';
      for (const [gd, p] of dealOf(m, d, P)) { const w = O.reach(gd, p); if (w) return w; } return true; };
    const rows = [2, 3, 4].map(n => { const m = squad.slice(0, n); return { n, fits: D.standoffFits(m, t), hand: byHand(m) }; });
    verdict(rows.every(r => r.fits === r.hand) && rows[0].fits === true, `reach as it is: the answer is the deal's own, asked by hand — two men (an open floor: it fits), three and four`, rows.map(r => `${r.n} men: standoffFits ${JSON.stringify(r.fits)} · by hand ${JSON.stringify(r.hand)}`).join(' · ')); }
  // ---- 5: and the order itself makes that deal
  { const got = await quiet(() => D.startCharge(men, t)), op = D.ops.find((o: any) => o.kind === 'charge' && o.door === d), pl = op?.post.get(lead), po = op?.post.get(other);
    verdict(typeof got !== 'string' && !!pl && !!po && same(pl.pos, m0) && same(po.pos, m1) && op.lead === lead, 'the order, given: the lead is dealt the first mark and the other man the second — the dealing the row now asks',
      typeof got === 'string' ? `REFUSED: ${got}` : `${lead.callsign} → mark ${pl ? idx(posts, pl.pos) + 1 : '?'}, ${other.callsign} → mark ${po ? idx(posts, po.pos) + 1 : '?'} · the setter: ${op?.lead?.callsign ?? 'nobody'}`); }
  squad.forEach((m, i) => put(m, home[i]));
  log(`=== standofffit: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
