// THE THROW PAGE'S PICTURE WRITES NOTHING OF THE GAME'S (src/game/squadthrow.ts squadThrowPlans, SquadThrowKept; src/scene/collision.ts Collision.aside).
// The page's preview is a whole search — flights, walks, who a frag would catch — and it used to keep its answer in the game's own state and look with the
// game's own tables, so a game that is drawn and the same game not drawn differed in whole state (run digest equal). Each line, with the walk rule on, with
// the worked-out throws on and off, a frag and a stun, on a spot nobody has a throw to from where he stands:
//   state     two games of one seed, the throw page up on the same spot, thirty frames: one is asked for its plans every frame (the overlay's question, its
//             own store), the other never — the whole state hashes the same and so does the run digest, and a preview was drawn.
//   ask       one game with a fight on and the men shifted about under the page, a hundred and fifty frames: the game's state is hashed before each ask of the
//             picture and after it, and the module variables looked at — never a difference (this is the line that sees an answer kept for a walk, a
//             sound's route, a memo of the tick: what the two games of `state`, standing still, both fill in the same way).
//   none      the same with no store handed in (a tool's one-off read): the same verdict.
//   same      the preview is the one the page's question gave before it was asked aside: the same man, the same floor, the same rest.
//   plan      the floor plan asked every frame with its own store (floorplan.ts PlanKept carries the throw's): the same verdict, and the plan shows the throw.
//   kept      the store keeps: thirty frames of the page ask no more searches than a tenth of what thirty asks with no store do.
// THROWVIEW_BREAK=1 = the drawn game is asked the old way (the page's question straight on the game's state): `state` and `ask` must FAIL. (One break
// for all the swaps: it does not prove each of them apart.)   exit 0 = all hold · 1 = one does not
import { ROOT } from './headless.ts';
import { rig, place } from './squadthrow-check.ts';

const ST: any = await import(`${ROOT}/src/game/squadthrow.ts`);
const RB: any = await import(`${ROOT}/src/game/rollback.ts`);
const DG: any = await import(`${ROOT}/src/game/digest.ts`);
const FP: any = await import(`${ROOT}/src/game/floorplan.ts`);
const SD: any = await import(`${ROOT}/src/math/side.ts`);
const { SQUADTHROW, SQUADTHROW_STATS } = ST;
type Kind = 'frag' | 'stun';
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }

export async function throwviewCheck(): Promise<boolean> {
  const BREAK = process.env.THROWVIEW_BREAK === '1', SEED = 7; let all = true;
  const was = { ...SQUADTHROW }, plan = { ...FP.PLAN }, rnd = Math.random;
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== throwview: the throw page's picture writes nothing of the game's${BREAK ? ' (THROWVIEW_BREAK: asked the old way)' : ''} ===`);
  try {
    const rows: Record<'state' | 'ask' | 'none' | 'same' | 'plan' | 'kept', string[]> = { state: [], ask: [], none: [], same: [], plan: [], kept: [] }, bad = { state: 0, ask: 0, none: 0, same: 0, plan: 0, kept: 0 }; let drawn = 0;
    Object.assign(FP.PLAN, { on: true, throws: true });
    for (const lob of [false, true]) for (const kind of ['stun', 'frag'] as Kind[]) {
      const name = `${lob ? 'worked-out throws' : 'straight throws'}, ${kind}`, mk = () => quiet(() => rig(SEED, true, { walk: true, lob }));
      // a spot with the longest walk to a throw, found on a game of its own
      let scout: any = await mk(), at: number[] | null = null, best = 0;
      for (let x = 2.25; x <= 38; x += 1.5) for (let z = 2.25; z <= 26; z += 1.5) {
        const t = scout.O.targetAt([x, 0, z]); if (t.kind !== 'floor' || dist(t.at, [x, 0, z]) > 0.3 || ST.squadThrower(scout.game, scout.team, t.at, kind)) continue;
        const th = ST.squadThrowPlan(scout.game, scout.team, t.at, kind, true); if (!th?.post || (kind === 'frag' && ST.squadFragCatches(scout.game, th.rest, t.at, { gd: th.gd, at: th.post }))) continue;
        const d = dist(th.gd.char.pos, th.post); if (d > best) { best = d; at = t.at; }
      }
      scout = null;   // (a game is big: each is let go as soon as its answer is read, and the collector asked between throws)
      if (!at) { bad.state++; rows.state.push(`${name}: no spot with a walk to a throw`); continue; }
      /** thirty frames of the page on `at`; `ask`: what the drawn game is asked each frame (null: never asked) */
      const run = async (ask: ((R: any) => any[]) | null, ref?: { R: any; hash: string }, keep = false) => {
        const R: any = await mk(); R.pageAt(at); { const M = R.O.menu, i = M.rows.findIndex((r: any) => r.id === (kind === 'frag' ? ST.FRAG_THERE : ST.STUN_THERE)); if (i >= 0) M.sel = i; }   // (the row of this kind highlighted: the picture is of the highlighted row)
        const s0 = SQUADTHROW_STATS.searches; let pre: any = null, sel = true;
        for (let i = 0; i < 30; i++) { if (ask) pre = ask(R).find((p: any) => p.preview) ?? pre; R.step(); sel &&= R.O.menu?.rows[R.O.menu.sel]?.id === (kind === 'frag' ? ST.FRAG_THERE : ST.STUN_THERE); }
        const hash = RB.stateHash(R.game, true, true) as string, dig = DG.hashDigest(DG.digestGame(R.game, true)) as string;
        const diff = !ref || ref.hash === hash ? '' : ' · ' + [...new Set((RB.stateDiff(R.game, ref.R.game, 4000, true) as string[]).map(l => l.split(': ')[0].replace(/\[\d+\]/g, '[]')))].slice(0, 6).join(', ');
        return { R: keep ? R : null, pre: pre ? { callsign: pre.gd.callsign as string, from: [...pre.from] as number[], land: [...pre.land] as number[] } : null, sel, searches: SQUADTHROW_STATS.searches - s0, hash, dig, diff };
      };
      const old = (R: any) => { const M = R.O.menu, th = ST.squadThrowPlan(R.game, M.men, M.target.at, kind, false, true); return th ? [{ preview: true, gd: th.gd, from: th.post ?? th.gd.char.pos, land: th.rest }] : []; };
      const store = ST.squadThrowKept();
      const never = await run(null, undefined, true), kept = await run(BREAK ? old : R => ST.squadThrowPlans(R.game, store), never), none = await run(R => ST.squadThrowPlans(R.game), never), before = await run(old);
      never.R = null; Bun.gc(true);
      { // ask: one game, a fight on, the men shifted about: the state before each ask against the state after it
        const R: any = await quiet(() => rig(SEED, true, { walk: true, lob, keep: true, live: true })), g = R.game, mine = ST.squadThrowKept(), V = SD.sideRegistry().vars;
        R.pageAt(at); { const M = R.O.menu, i = M.rows.findIndex((r: any) => r.id === (kind === 'frag' ? ST.FRAG_THERE : ST.STUN_THERE)); if (i >= 0) M.sel = i; }
        let wrote = 0, vars = 0, drew = 0; const names = new Set<string>(); let what = '';
        for (let i = 0; i < 150; i++) {
          const h0 = RB.stateHash(g, true, true) as string, v0 = V.map((v: any) => v.get()), f0 = i % 10 === 0 ? RB.stateFlat(g, true, true) : null;
          if ((BREAK ? old(R) : ST.squadThrowPlans(g, mine)).some((p: any) => p.preview)) drew++;
          if (RB.stateHash(g, true, true) !== h0) { wrote++; if (f0 && !what) what = (RB.flatDiff(f0, RB.stateFlat(g, true, true), 3) as string[]).map(l => l.split(': ')[0]).join(', '); }
          V.forEach((v: any, k: number) => { if (v.get() !== v0[k]) { vars++; names.add(v.name); } });
          R.step(); if (i % 6 === 5) for (const m of R.team) place(m, [m.char.pos[0] + (Math.floor(i / 48) % 2 ? -0.3 : 0.3), m.char.pos[1], m.char.pos[2]], m.char.bodyYaw);
        }
        if (!(wrote === 0 && vars === 0 && drew >= 30)) bad.ask++;
        rows.ask.push(`${name}: the ask changed the game's state on ${wrote} of 150 frames${what ? ` (${what})` : ''}, a module variable on ${vars}${names.size ? ` (${[...names].join(', ')})` : ''} · the picture was there on ${drew}`);
      }
      const pk = FP.planKept(); let shown = 0;
      const planned = await run(R => { shown = Math.max(shown, FP.floorPlan(R.game, pk).throws.length); return []; });
      if (!(planned.hash === never.hash && planned.dig === never.dig && shown >= 1)) bad.plan++;
      rows.plan.push(`${name}: state ${planned.hash === never.hash ? 'equal' : 'DIFFERS'}, digest ${planned.dig === never.dig ? 'equal' : 'DIFFERS'}, throws on the plan ${shown}`);
      if (kept.pre && kept.sel) drawn++;
      const diffN = none.diff, diff = kept.diff;
      if (!(kept.hash === never.hash && kept.dig === never.dig)) bad.state++;
      rows.state.push(`${name} at (${at[0].toFixed(1)}, ${at[2].toFixed(1)}), a walk of ${best.toFixed(1)} m: state ${kept.hash === never.hash ? 'equal' : 'DIFFERS'}, digest ${kept.dig === never.dig ? 'equal' : 'DIFFERS'}, a preview ${kept.pre ? 'drawn' : 'not drawn'}${diff}`);
      if (!(none.hash === never.hash && none.dig === never.dig)) bad.none++;
      rows.none.push(`${name}: state ${none.hash === never.hash ? 'equal' : 'DIFFERS'}, digest ${none.dig === never.dig ? 'equal' : 'DIFFERS'}${diffN}`);
      const a = kept.pre, b = before.pre, same = !a === !b && (!a || (a.callsign === b!.callsign && dist(a.from, b!.from) < 1e-9 && dist(a.land, b!.land) < 1e-9));
      if (!same) bad.same++;
      rows.same.push(`${name}: ${a ? `${a.callsign} from (${a.from[0].toFixed(2)}, ${a.from[2].toFixed(2)}) to rest (${a.land[0].toFixed(2)}, ${a.land[2].toFixed(2)})` : 'none'} · asked the old way ${b ? `${b.callsign} from (${b.from[0].toFixed(2)}, ${b.from[2].toFixed(2)}) to rest (${b.land[0].toFixed(2)}, ${b.land[2].toFixed(2)})` : 'none'}`);
      if (!(kept.searches - never.searches <= Math.max(1, (none.searches - never.searches) / 10))) bad.kept++;
      Bun.gc(true);
      rows.kept.push(`${name}: searches in the thirty frames — never asked ${never.searches}, asked with a store ${kept.searches}, asked with none ${none.searches}`);
    }
    verdict(bad.state === 0 && drawn === 4, 'state: a game asked for the page\'s picture every frame and the same game never asked hold the same whole state and the same run digest, and the picture was there', rows.state.join('\n    '));
    verdict(bad.ask === 0, 'ask: with a fight on and the men shifted about, no ask of the picture changes the game\'s state or a module variable', rows.ask.join('\n    '));
    verdict(bad.none === 0, 'none: the same with no store handed in', rows.none.join('\n    '));
    verdict(bad.same === 0, 'same: the preview is the one the page\'s question gave before it was asked aside', rows.same.join('\n    '));
    verdict(bad.plan === 0, 'plan: the floor plan asked every frame, on its own store, writes nothing either and shows the throw', rows.plan.join('\n    '));
    verdict(bad.kept === 0, 'kept: the asker\'s store keeps the search between frames', rows.kept.join('\n    '));
  } finally { Object.assign(SQUADTHROW, was); Object.assign(FP.PLAN, plan); Math.random = rnd; }
  console.log(`\n=== throwview: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all;
}
if (import.meta.main) process.exit(await throwviewCheck() ? 0 : 1);
