// EVERY THING THAT WENT (src/game/wallreact.ts WALLREACT.everyGone): one blast can file two rows beside a man — the crate he kneels behind, then the
// furniture round it — and the one question kept for him was the newest row's: he was asked about the cupboard, never about his crate, and knelt on in the
// open. With the rule the question he is still owed keeps what went before the newest too, and where the newest has nothing to say to him the one before it
// is asked, exactly as a row alone is asked.
//
//   bun run tools/qa/everygone-check.ts            the warehouse's crate line (wallreact-probes.ts wallreactCrate) with the furniture rule ON and the lived-in
//                                                  rooms in, so the blast files both rows on either stand, and the rule raised by the check itself
//   TPS_PROFILE=shipped …                          the same on the stand the page opens on
//   EVERYGONE_BREAK=1 …                            the rule never switched on and the same lines asked: must fail
import { ROOT } from './headless.ts';
import { wallreactCrate, rig } from './wallreact-probes.ts';
const { WALLREACT } = await import(`${ROOT}/src/game/wallreact.ts`);
const { FURNBLAST, DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { PLAYER_ID, NOBODY_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { LIVED } = await import(`${ROOT}/src/scene/lived.ts`);
const PROFILE = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);

export async function everygoneCheck(): Promise<boolean> {
  const BREAK = process.env.EVERYGONE_BREAK === '1', RULE = !BREAK, LEVEL = 'warehouse';
  console.log(`\n=== everygone: a man beside a blast is asked about every thing it took, not the newest row alone (${LEVEL})${BREAK ? ' — EVERYGONE_BREAK: the rule never on' : ''} ===`);
  let all = true; const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const knobs0 = knobsCopy(), furn0 = FURNBLAST.on, rule0 = WALLREACT.everyGone, on0 = WALLREACT.on, destr0 = DESTRUCTION.on, rnd0 = Math.random; let stood: boolean | null = null;
  type Seen = { on: boolean; rows: number; moved: number; hidden: boolean; open: boolean; near: boolean };
  // (the furniture that files the second row is the lived-in rooms' — a row of the frozen stand's holds — so on that stand the stage is stood up with them in)
  const lived0 = LIVED.on;
  const run = async (rule: boolean, quiet: boolean) => { let got: Seen | null = null; const log = console.log; if (quiet) console.log = () => { }; LIVED.on = true;
    try { const ok = await wallreactCrate(LEVEL, undefined, { onOnly: quiet, stage: () => { if (stood === null) stood = WALLREACT.everyGone; FURNBLAST.on = true; WALLREACT.everyGone = rule; }, seen: x => { if (x.on) got = x; } }); return { ok, got: got as Seen | null }; }
    finally { console.log = log; FURNBLAST.on = furn0; WALLREACT.everyGone = rule0; LIVED.on = lived0; WALLREACT.on = on0; DESTRUCTION.on = destr0; Math.random = rnd0; } };   // (everything the rig it drives leaves set)
  const A = await run(RULE, false), B = await run(false, true);
  // the stand: held off where every frozen digest was recorded, on as the page opens, and the row that says so
  { const word = process.env.TPS_EVERYGONE, shipped = process.env.TPS_PROFILE === 'shipped', want = word !== undefined ? word === '1' : shipped, row = FROZEN_HOLDS['WALLREACT.everyGone'];
    verdict(stood === want && typeof row === 'string' && /TPS_EVERYGONE=1/.test(row), `the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen digest was recorded'}; FROZEN_HOLDS carries the row and its word`, `after the stand-up: ${stood} · TPS_EVERYGONE ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · row ${JSON.stringify(row)}`); }
  verdict(!!A.got && A.got.rows >= 2 && A.got.open && A.got.near, 'the staging: the one blast files two rows beside him (within WALLREACT.nearM of his feet) — his crate, then the furniture round it — he is open, and there is cover within a run', A.got ? `rows beside him ${A.got.rows} · open ${A.got.open} · cover within a run ${A.got.near}` : 'the crate line was not asked on this floor');
  verdict(A.ok && !!A.got && A.got.moved > 1 && A.got.hidden, 'with the rule: he leaves where the crate was for somewhere he is hidden again', A.got ? `moved ${A.got.moved.toFixed(1)} m · hidden ${A.got.hidden} · the crate line ${A.ok ? 'passes' : 'FAILS'}` : '—');
  verdict(!!B.got && B.got.rows >= 2 && B.got.moved < 0.5 && !B.got.hidden, 'without it, on the same stage: he kneels on in the open (the fault, as it was — the staging tells the two apart)', B.got ? `moved ${B.got.moved.toFixed(1)} m · hidden ${B.got.hidden} · rows ${B.got.rows}` : '—');
  // THE QUESTION'S OWN BOOK (rows handed to the module as the feed hands them): the things behind the newest are bounded, the one beside him is never the one
  // let go, each keeps its own doer and its own breach, one row is one thing
  try { const R = await rig(LEVEL, 8, true); WALLREACT.everyGone = RULE; const g = R.g, wr: any = R.wr(), D = R.defs()[0], p = D.gd.char.pos;
    const row = (k: number, at: number[], who: number) => ({ serial: 90000 + k, t: g.time, kind: 'cover', id: -1, cause: 'blast', who, rect: [at[0] + 0.3 * k, at[2] + 0.8, at[0] + 0.3 * k + 0.2, at[2] + 1.0], opened: [], dead: false });
    const things = (gd: any) => { const P = wr.pend.find((x: any) => x.gd === gd); return P ? [P, ...(P.also ?? [])] : []; };
    wr.pend.length = 0; const N = WALLREACT.goneMax + 3; wr.take(row(0, p, PLAYER_ID)); for (let k = 1; k < N; k++) wr.take(row(k, p, NOBODY_ID));
    const T = things(D.gd), first = row(0, p, PLAYER_ID).rect, own = T.find((x: any) => x.rect.every((v: number, i: number) => Math.abs(v - first[i]) < 1e-9));
    verdict(T.length === WALLREACT.goneMax && !!own && own.who === PLAYER_ID && T[0].rect[0] > first[0] + 0.3 * (N - 1) - 1e-6, `${N} rows beside a man while he is owed the question: it holds goneMax things, the newest in front, and the thing nearest him — the first that went — is still one of them, its own rect and its own doer`, `things ${T.length} (goneMax ${WALLREACT.goneMax}) · the first row's thing held ${!!own}${own ? `, its doer ${own.who === PLAYER_ID ? 'the player' : own.who}` : ''} · doers ${[...new Set(T.map((x: any) => x.who))].join(',')}`);
    // (the order they are asked in: the newest first — where it has something to say to him the answer is its own, as it always was; only where it has not, the one before it)
    { let T: number[] | null = null; for (let a = 0; a < 16 && !T; a++) { const q = [p[0] + Math.sin(a * Math.PI / 8) * 3.5, 0, p[2] + Math.cos(a * Math.PI / 8) * 3.5]; if (!g.col.nav.isBlocked(q[0], q[2]) && !g.col.segmentBlocked([q[0], 1.15, q[2]], [p[0], 0.9, p[2]])) T = q; }
      if (!T) verdict(false, 'a point 3.5 m off the defender with a clear line to him', 'none');
      else { D.gd.sightPos = [...T]; D.gd.sightT = g.time; const mid = [(p[0] + T[0]) / 2, 0, (p[2] + T[2]) / 2], on = (d: number) => [mid[0] - 0.3 + d, mid[2] - 0.3 + d, mid[0] + 0.3 + d, mid[2] + 0.3 + d];
        const older = { rect: on(0.05), b: null, who: NOBODY_ID }, mk = (rect: number[]) => ({ gd: D.gd, rect, b: null, who: NOBODY_ID, also: [older], until: g.time + 5, next: g.time });
        const both = mk(on(0)), aside = mk([p[0] + 30, p[2] + 30, p[0] + 30.4, p[2] + 30.4]), q1: any = wr.asks(D.gd, both, p, 0.9), q2: any = wr.asks(D.gd, aside, p, 0.9);
        verdict(typeof q1 !== 'string' && q1.X === both && typeof q2 !== 'string' && q2.X === older, 'asked newest first: where the newest thing and an older one both leave him open, the newest answers; where the newest has nothing to say, the one before it does', `both on the line → ${typeof q1 === 'string' ? `'${q1}'` : q1.X === both ? 'the newest' : 'an older thing'} · the newest off the line → ${typeof q2 === 'string' ? `'${q2}'` : q2.X === older ? 'the one before it' : 'the newest'}`); } }
    g.orders.give('hold', g.orders.targetAt(g.player.char.pos), 'all'); R.step(0.5); const A = wr.posts().find((x: any) => Math.hypot(x.gd.char.pos[0] - x.A.post[0], x.gd.char.pos[2] - x.A.post[2]) < 1);
    if (A) { wr.pend.length = 0; wr.take({ ...row(0, A.gd.char.pos, NOBODY_ID), serial: 90050 }); const n = things(A.gd).length; verdict(n === 1, 'a teammate standing on his mark is beside a row by his feet and by his mark: one row is one thing in his question', `things ${n}`); }
    else verdict(false, 'a teammate standing on his mark to ask', 'none of the squad holds a mark he stands on');
    // (three rows of one wall, the third growing the first two breaches into one: the older things' breach is the one that is left, not the one that was merged away)
    { const W = g.destr.walls.all().find((w: any) => Math.abs(w.box.yaw ?? 0) < 1e-6 && Math.max(w.box.h[0], w.box.h[2]) >= 2.6);
      if (!W) verdict(false, 'a straight wall 5 m long to file three rows on', 'none on this floor');
      else { const c = W.box.c, alongX = W.box.h[0] >= W.box.h[2], at0 = [p[0], p[1], p[2]], n0 = wr.breaches.length;
        const seg = (k: number, s0: number, s1: number) => ({ serial: 90100 + k, t: g.time, kind: 'hole', walkable: false, id: W.id, cause: 'blast', who: NOBODY_ID, pos: [alongX ? c[0] + (s0 + s1) / 2 : c[0], 1, alongX ? c[2] : c[2] + (s0 + s1) / 2], rect: alongX ? [c[0] + s0, c[2] - 0.1, c[0] + s1, c[2] + 0.1] : [c[0] - 0.1, c[2] + s0, c[0] + 0.1, c[2] + s1], opened: [], dead: false });
        p[0] = c[0] + (alongX ? 0 : 1); p[2] = c[2] + (alongX ? 1 : 0); wr.pend.length = 0;
        wr.take(seg(0, -2.0, -1.4)); wr.take(seg(1, 1.4, 2.0)); const two = wr.breaches.length - n0; wr.take(seg(2, -1.5, 1.5));
        const T3 = things(D.gd), live = T3.every((x: any) => x.b && wr.breaches.includes(x.b));
        verdict(two === 2 && wr.breaches.length - n0 === 1 && T3.length === 3 && live, 'three rows of one wall beside him, the third growing two breaches into one: three things, and the breach each is about is the one that is left', `breaches after two rows ${two}, after the third ${wr.breaches.length - n0} · things ${T3.length} · every thing's breach still in the book ${live}`);
        p[0] = at0[0]; p[2] = at0[2]; wr.pend.length = 0; } }
    // a recording from before the key replays with the rule off; one that carries it plays as it says (journal.ts applyKnobs)
    { const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      WALLREACT.everyGone = true; const old = snap(); delete old.tables.WALLREACT.everyGone; JOURNAL.applyKnobs(g, old); const without = WALLREACT.everyGone;
      const own2 = snap(); own2.tables.WALLREACT.everyGone = true; JOURNAL.applyKnobs(g, own2); const withIt = WALLREACT.everyGone;
      verdict(without === false && withIt === true, 'a recording from before the key replays with the rule off; one that carries it on plays with it on', `applyKnobs with no key → ${without} · with the key on → ${withIt}`); }
    // the page's own boot: on with no flag, ?everygone=0 puts it off, another flag leaves it on
    { PROFILE.pageSwitches(new URLSearchParams('')); const a = WALLREACT.everyGone; PROFILE.pageSwitches(new URLSearchParams('everygone=0')); const b = WALLREACT.everyGone; PROFILE.pageSwitches(new URLSearchParams('nofurnblast')); const c = WALLREACT.everyGone;
      verdict(a === true && b === false && c === true, 'the page\'s boot (pageSwitches): no flag → on · ?everygone=0 → off · another flag leaves it on', `'' → ${a} · 'everygone=0' → ${b} · 'nofurnblast' → ${c}`); } }
  finally { knobsBack(knobs0); FURNBLAST.on = furn0; WALLREACT.everyGone = rule0; LIVED.on = lived0; WALLREACT.on = on0; DESTRUCTION.on = destr0; Math.random = rnd0; }   // (pageSwitches and applyKnobs wrote every table: each back as this check found it)
  console.log(`=== everygone: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await everygoneCheck()) ? 0 : 1);
