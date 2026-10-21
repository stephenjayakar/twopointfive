// The 'pairs' family (the four-man squad's two pairs USED APART — orders.ts men's side / hold arcs / the shy route / the lane rule, doortools.ts the word,
// making room and the pods kept apart; all of it behind 'more than two men', orders.ts `big`), run through probes.ts:
//   bun run tools/qa/probes.ts pairs | pairs-off | pairs-side | pairs-hold | pairs-go | pairs-tool | pairs-haltback | pairs-lanes
// PASS / FAIL each, all headless (the Game of headless.ts under the room clear's staging with NIGHTBREACH.squad = 4). The harness has no light meter: Sam's
// visibility is planted dark and he is in god mode, and what anybody SEES of anybody is guards.ts's direct-light estimate, not the page's. Orders are given
// through the order API (orders.give / doorTools.go) — the menu, the keys and the HUD are not this family's. Nothing here looks at a picture.
//   pairs-off     the pair build is as it was: no 'go' order, hold = the old hold (no arc, low ready, no light), a door order keeps Sam's side; with four the
//                 'go' order is there and refuses when nobody waits
//   pairs-side    a pair is sent to the side of a door IT can reach without crossing the room: Sam in the cubicles (his side of the break room's north door
//                 is the INSIDE) orders red onto it — red stacks on the corridor face, never sets foot in the room, nobody lost; where both sides cost the
//                 same the pair takes Sam's
//   pairs-hold    one pair holds while the other clears: (a) red stacked on the north door keeps its stack while blue opens and clears through the west
//                 door; (b) red told to HOLD in the corridor splits the two ways out between its two men, guns and lights up, and engages what comes down
//                 them unordered while blue bangs and clears — A/B against the plain hold (each man told alone) over seeds
//   pairs-go      two pairs, two doors, one word: both stacked, doorTools.go() / the 'go' order — the two doors are shoved on ONE frame, the pods are dealt
//                 apart, losses counted over seeds; 'go' to one pair sends that pair alone; `onWord` tools (bang at one door, open at the other) wait in
//                 'ready' until the word, then the bang goes first and the quiet door opens on the bang door's go
//   pairs-tool    a door tool given to one pair on a door the other pair is stacked on, all four tools on two doors: the stacked pair steps back to rear
//                 security (its order still 'stack' on that door), the tool's pair takes the jambs, a charge's backblast catches nobody, the tool runs to
//                 its end; a charge on a door with a teammate behind it is refused
//   pairs-haltback  a pair HALTED on a door the other pair is charging (DOORTOOLS.haltBack; the probe sets that key and DOORTOOLS.testDoor itself after the
//                 stand-up, so it asks the same of both stands): blue is given the charge on the locked manager's door, red then 'open and clear' on it —
//                 red's lead tries the handle, the order ends 'found shut'. Key on: red steps back to rear security, to the marks a pair stacked there
//                 BEFORE the charge order is sent to, and the charge catches nobody; key off: red stays stacked inside the blast (the fault, asserted);
//                 no charge on the door: the key moves nobody; Sam at the door (put off it, and as played); a charge left set with
//                 its order gone; the journal. HALTBACK_BREAK=1 = the key left off in the key-on run: must fail
//   pairs-lanes   lines of fire: a posted man lowers his muzzle while a man of the OTHER pair crosses his line; the two pairs working two rooms off one
//                 corridor at once; and the tally over every run of this family in this process — rounds fired through a teammate, teammates down to a
//                 teammate (the game's rule makes that impossible; the lanes are what is measured)
import { standUp, ROOT } from './headless.ts';
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { ORDERS, sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { FRAG } = await import(`${ROOT}/src/game/frag.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const names = (l: any[]) => l.map((g: any) => g.callsign).join(', ');
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const DT_DEFAULTS = JSON.parse(JSON.stringify(DOORTOOLS)), RC_DEFAULTS = { ...ROOMCLEAR }, NB_DEFAULTS = { ...NIGHTBREACH }, ORD_DEFAULTS = { ...ORDERS, followBack: [...ORDERS.followBack] };
/** every probe leaves the knob tables as it found them, pass, fail or throw */
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS); Object.assign(ORDERS, ORD_DEFAULTS, { followBack: [...ORD_DEFAULTS.followBack] }); } };

// where Sam stands: the corridor outside both of the break room's doors · by the manager's door · in the cubicles (west of the break room)
const CORRIDOR: number[] = [25.0, 0, 11.0], MANAGER: number[] = [24.0, 0, 11.2], CUBICLES: number[] = [25.0, 0, 18.9];
/** the corridor spot the holding pair is put on: east of the manager's glass, between the break room's north door and the storage door */
const FLANK: number[] = [28.5, 0, 11.0];
const BREAKROOM = { x0: 28.12, x1: 35.88, z0: 12.26, z1: 23.88 };
const inBounds = (b: { x0: number; x1: number; z0: number; z1: number }, p: number[], m = 0) => p[0] > b.x0 - m && p[0] < b.x1 + m && p[2] > b.z0 - m && p[2] < b.z1 + m;

/** the family's tally over every fighting run made in this process: runs · teammates' rounds · the ones through a teammate · teammates down to a teammate · lost */
const TALLY = { runs: 0, rounds: 0, through: [] as string[], fratricide: [] as string[], lost: 0, heldForFriend: 0 };

/** One game under a seed: the room clear staged with `squad` teammates (default four), Sam in god mode, dark, standing at `sam`.
 *  `quiet`: the defenders kept dazzled every frame (they neither see nor fire) — for the probes that are about feet, not the fight. */
async function rig(seed: number, sam: number[], o: { squad?: 2 | 4; quiet?: boolean; tag?: string } = {}) {
  Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS, { squad: o.squad ?? 4 });
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game; const RC = game.roomClear, NB = game.nightBreach, O = game.orders, D = game.doorTools;
  game.godMode = true; RC.start(seed);
  const seen = new Set<any>(); let tallied = false;
  const R = { W, game, RC, NB, O, D, quiet: !!o.quiet, downs: [] as { who: any; t: number; by: any }[], rounds: 0, through: [] as string[], post: null as null | (() => void),
    get ops(): any[] { return NB.ops; }, get hostiles(): any[] { return NB.hostiles; },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        game.player.visibility = 0.05;
        if (R.quiet) for (const h of NB.hostiles) if (h.state !== 'dead') h.dazzledUntil = game.time + 5;
        const was = game.guards.map((x: any) => [x, x.state] as const);
        W.step(DT);
        for (const e of game.events) { if (seen.has(e)) continue; seen.add(e);
          // LANES: a teammate's round whose line passes through a living teammate's body (combat.ts lets a friend's round through him by rule, so nobody can fall
          // to it — what can be measured is how often a man fires with a friend in his lane)
          if (e.kind !== 'guardShot' || !e.from || !e.to) continue; const sh = R.ops.find((x: any) => x.char.id === e.who); if (!sh) continue; R.rounds++;
          const ax = e.from[0], az = e.from[2], bx = e.to[0] - ax, bz = e.to[2] - az, L2 = bx * bx + bz * bz || 1;
          for (const m of R.ops) { if (m === sh || m.state === 'dead') continue; const k = ((m.char.pos[0] - ax) * bx + (m.char.pos[2] - az) * bz) / L2; if (k <= 0.02 || k >= 1) continue;
            const y = e.from[1] + (e.to[1] - e.from[1]) * k - m.char.pos[1]; if (Math.hypot(ax + bx * k - m.char.pos[0], az + bz * k - m.char.pos[2]) < 0.28 && y > 0 && y < 1.8) { R.through.push(`${sh.callsign} through ${m.callsign} at ${f2(game.time)} s`); break; } } }
        for (const [x, st] of was) if (st !== 'dead' && x.state === 'dead') R.downs.push({ who: x, t: game.time, by: game.guards.find((k: any) => k.char.id === x.killerId) ?? null });
        R.post?.();
      }
    },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(name: string): any { return game.doors.list.find((d: any) => d.def.name === name); },
    target(name: string) { return O.targetAt(R.door(name).frameCentre); },
    give(id: string, name: string, who: any = 'all', opts?: { onWord?: boolean }): string | null { return O.give(id, R.target(name), who, opts); },
    here() { return O.targetAt(game.player.char.pos); },
    men(who: any, down = false): any[] { return O.men(who, { down }); },
    set(who: any = 'all', secs = 30) { return R.until(() => R.men(who).every((m: any) => O.of(m)?.arrived), secs); },
    lost(who: any = 'all'): any[] { return R.men(who, true).filter((m: any) => m.state === 'dead'); },
    killsBy(men: any[]): any[] { return NB.hostiles.filter((h: any) => h.state === 'dead' && men.some((m: any) => m.char.id === h.killerId)); },
    where(who: any = 'all') { return R.men(who, true).map((m: any) => `${m.callsign} ${m.state === 'dead' ? 'DOWN' : at(m.char.pos)} [${O.statusOf(m)}]`).join(' · '); },
    beats(op: any): string { return (op?.beats ?? []).map((b: any) => `${f2(b.t)} ${b.what}`).join(' | '); },
    beatT(op: any, what: string): number { return op?.beats.find((b: any) => b.what === what || b.what.startsWith(what))?.t ?? NaN; },
    /** friendly fire: a teammate down by a teammate's (or Sam's) hand */
    get fratricide(): string[] { return R.downs.filter(x => x.who.team === 'operative' && (x.by?.team === 'operative' || x.who.killerId === game.player.char.id)).map(x => `${x.who.callsign} by ${x.by?.callsign ?? 'Sam'}`); },
    /** file this run under the family's tally (once; the quiet runs are not fights and are left out) */
    tally() { if (tallied || R.quiet) return; tallied = true; TALLY.runs++; TALLY.rounds += R.rounds; TALLY.lost += R.lost().length; TALLY.heldForFriend += game.fight.stats.heldForFriend;
      for (const x of R.through) TALLY.through.push(`${o.tag ?? ''}/${seed}: ${x}`); for (const x of R.fratricide) TALLY.fratricide.push(`${o.tag ?? ''}/${seed}: ${x}`); },
  };
  R.step(30); game.teleportPlayer(sam); R.step(5);
  return R;
}

// ============================================================================================================================ pairs-off
export const pairsOff = guarded(async () => {
  const { verdict, done } = family('pairs-off: the pair build is as it was; the four get the word');
  { const R = await rig(5, CUBICLES, { squad: 2, quiet: true }); const { O } = R; const men = R.men('all');
    const goDef = O.defs.find((d: any) => d.id === 'go'), noGo = !goDef, why = O.give('go', R.here(), 'all');
    // (the small squad's word, DOORTOOLS.wordSmall, on in the page: 'go' is registered for the pair too, on no menu row, and is refused while nobody is stacked — `probes.ts wordsmall`)
    if (DOORTOOLS.wordSmall) verdict(men.length === 2 && !O.big && !!goDef && (goDef.listed ?? []).length === 0 && why === 'nobody waiting.', 'two men, DOORTOOLS.wordSmall on: not a big squad; \'go\' is on the list for the key alone (on no menu row) and giving it with nobody stacked is refused', `${men.length} men · big ${O.big} · go listed [${(goDef?.listed ?? []).join(' ')}] · give('go') → ${why}`);
    else verdict(men.length === 2 && !O.big && noGo && typeof why === 'string', 'two men: not a big squad, no \'go\' order on the list, giving it is refused', `${men.length} men · big ${O.big} · rows ${O.defs.map((d: any) => d.id).join(' ')} · give('go') → ${why}`);
    const t = R.target('breakroom_n'), t2 = O.forMen(t, men);
    verdict(t2.side === t.side && t.side === sideOf(R.door('breakroom_n'), R.game.player.char.pos), 'two men: a door order keeps Sam\'s side of the door (he is in the cubicles: the INSIDE of the north door), as before', `Sam's side ${t.side} · the men's ${t2.side}`);
    R.game.teleportPlayer(CORRIDOR); R.step(5);
    O.give('move', O.targetAt(FLANK), 'all'); R.set('all', 30); O.give('hold', R.here(), 'all'); R.step(60);
    const as = men.map((m: any) => O.of(m)); const plain = as.every((a: any) => a?.order === 'hold' && a.there === 'holding' && !a.watch && !a.door && a.upper !== 'aim' && !a.light);
    verdict(plain, 'two men: hold is the old hold — where they stand, the way they face, low ready, no arc, no light', as.map((a: any, i: number) => `${men[i].callsign} [${a?.there}] upper ${a?.upper} watch ${a?.watch ? at(a.watch) : '-'} light ${!!a?.light}`).join(' · '));
    R.give('stack', 'breakroom_n', 'all'); R.set('all', 30); const said = R.D.go(), ops = R.D.ops.length;
    verdict(typeof said === 'string' && ops === 0, 'two men: doorTools.go() does nothing for a pair on a plain stack', `go() → ${said} · door orders running ${ops}`); }
  { const R = await rig(5, CORRIDOR, { quiet: true }); const { O } = R;
    const has = O.defs.some((d: any) => d.id === 'go'), why = O.give('go', R.here(), 'all'), moved = R.men('all').filter((m: any) => O.of(m)?.order === 'go').length;
    verdict(R.men('all').length === 4 && O.big && has && why === 'nobody waiting.' && moved === 0, 'four men: a big squad, the \'go\' order is on the list, and with nobody waiting it is refused and moves nobody', `${R.men('all').length} men · big ${O.big} · 'go' listed ${has} (key ${O.defs.find((d: any) => d.id === 'go')?.key}) · give('go') → ${why}`); }
  return done();
});

// ============================================================================================================================ pairs-side
export const pairsSide = guarded(async () => {
  const { verdict, done } = family('pairs-side: a pair takes the side of a door it can reach');
  const R = await rig(5, CUBICLES); const { O } = R; const dn = R.door('breakroom_n'), red = R.men('red');
  const t = R.target('breakroom_n'), mine = O.forMen(t, red).side, samSide = sideOf(dn, R.game.player.char.pos);
  verdict(t.side === samSide && mine === -samSide, 'Sam in the cubicles: his side of the break room\'s north door is the inside; red\'s is the other face (the corridor)', `Sam's side ${samSide} · red's ${mine}`);
  let inside = 0; R.post = () => { for (const m of R.men('red')) if (inBounds(BREAKROOM, m.char.pos, -0.3)) inside++; };
  const why = R.give('stack', 'breakroom_n', 'red'); const ok = R.set('red', 35); R.post = null;
  const sides = red.map((m: any) => sideOf(dn, m.char.pos)), near = red.map((m: any) => dist(m.char.pos, dn.frameCentre));
  verdict(why === null && ok && sides.every((s: number) => s === mine) && near.every((x: number) => x < 2.6), 'ordered onto it, red stacks on the corridor face of the door', `give → ${why} · ${R.where('red')} · ${near.map(f2).join(' / ')} m from the frame`);
  verdict(inside === 0 && R.lost().length === 0, 'red never set foot in the break room on the way, and nobody is lost', `man-frames inside the room ${inside} · lost ${names(R.lost()) || 'none'}`);
  const blue = R.men('blue'), tw = R.target('breakroom_w'), bs = O.forMen(tw, blue).side;
  verdict(bs === tw.side, 'the west door from the cubicles: blue takes Sam\'s side (it is the one it can reach)', `Sam's side ${tw.side} · blue's ${bs}`);
  R.game.teleportPlayer(CORRIDOR); R.step(5); const ts = R.target('storage'), ss = O.forMen(ts, blue).side;
  verdict(ss === ts.side, 'a corridor door from the corridor: the pair takes Sam\'s side', `Sam's side ${ts.side} · blue's ${ss}`);
  R.tally(); return done();
});

// ============================================================================================================================ pairs-hold
export const pairsHold = guarded(async () => {
  const { verdict, done } = family('pairs-hold: one pair holds while the other clears');
  // ---- (a) red stacked on the north door, blue opens and clears through the west door
  { const rows: string[] = []; let kept = 0, ended = 0, n = 0, lost = 0, drift = 0; const ff: string[] = [], thr: string[] = [];
    // (the defenders' own frag grenades are pinned off here as in (b) below, and for its reason: a stacked man runs from a grenade that lands by him, as he
    //  should — 1.8 m off his mark on seed 5 the day a walk to the stack took half a second longer — and that run is frag.ts's and `probes.ts frag`'s to
    //  judge. What is asked here is the stack kept and the marks held against the other pair's order)
    const fragWasA = FRAG.defenders; try {
    for (const seed of [2, 5, 9]) { n++; const R = await rig(seed, CORRIDOR, { tag: 'hold-a' }); const { O, D } = R; const dn = R.door('breakroom_n'), red = R.men('red'); FRAG.defenders = false;
      R.give('stack', 'breakroom_n', 'red'); R.set('red', 30); const posts = new Map(red.map((m: any) => [m, [...O.of(m).post]] as const));
      const why = R.give('openClear', 'breakroom_w', 'blue'); const op = D.ops[0], sent = op ? [...op.men] : []; let stayed = true, far = 0;   // (who the order TOOK: a man lost in the room is off op.men by the end)
      R.post = () => { for (const m of R.men('red')) { const a = O.of(m); if (a?.order !== 'stack' || a.door !== dn) stayed = false; far = Math.max(far, dist(m.char.pos, posts.get(m)! as any)); } };
      R.until(() => !D.ops.includes(op), 45); R.step(240); R.post = null; R.tally();
      const good = why === null && !!op && sent.length === 2 && sent.every((m: any) => O.pairOf(m) === 'blue'); if (stayed && good) kept++; if (op?.ended === 'in') ended++;
      lost += R.lost().length; drift = Math.max(drift, far); ff.push(...R.fratricide); thr.push(...R.through);
      rows.push(`seed ${seed}: blue's order → ${why} (${sent.length} men), ended '${op?.ended}' · red kept its stack ${stayed}, most it moved off its marks ${f2(far)} m · lost ${names(R.lost()) || 'none'} · defenders down ${R.hostiles.filter((h: any) => h.state === 'dead').length}`); }
    } finally { FRAG.defenders = fragWasA; }
    verdict(kept === n && ended === n, 'red keeps its stack on the north door from the order to the end while blue — two men, blue alone — opens and clears through the west door', rows.join('\n    '));
    verdict(drift < 0.8, 'red stays on its marks (within 0.8 m) the whole time', `most ${f2(drift)} m`);
    verdict(ff.length === 0 && thr.length === 0, 'no teammate down to a teammate, no round fired through one', `${ff.join(' · ') || 'none'} · through ${thr.length} · ${lost} lost to defenders in ${n} runs`); }
  // ---- (b) red HOLDS a flank in the corridor (arcs dealt) while blue bangs and clears; against the plain hold (each man told alone: no arcs)
  { const SEEDS = [2, 5, 9, 11, 14, 17]; const res: Record<string, { lost: number; kills: number; rows: string[]; ok: number; thr: number; ff: number }> = {};
    let arcsOk = 0, stayed = 0;
    // (the defenders' own frag grenades — FRAG.defenders, on as shipped, held off on the frozen stand — are pinned off for these runs: a man holding an arc
    //  runs from a grenade that lands in his line and walks back to his mark after it, as he should, and that is frag.ts's flee and `probes.ts frag`'s to
    //  judge. What is asked here is the hold itself: the arcs dealt, the men on their marks, what comes down the arcs met)
    const fragWas = FRAG.defenders; try {
    for (const mode of ['arcs', 'plain'] as const) { const r = res[mode] = { lost: 0, kills: 0, rows: [] as string[], ok: 0, thr: 0, ff: 0 };
      for (const seed of SEEDS) { const R = await rig(seed, CORRIDOR, { tag: `hold-${mode}` }); const { O, D } = R; const red = R.men('red'); FRAG.defenders = false;
        O.give('move', O.targetAt(FLANK), 'red'); R.set('red', 25);
        if (mode === 'arcs') O.give('hold', R.here(), 'red'); else for (const m of red) O.give('hold', R.here(), m);
        R.step(60); const as = red.map((m: any) => O.of(m)), spots = red.map((m: any) => [...m.char.pos]);
        if (mode === 'arcs') { const yaws = as.map((a: any, i: number) => a.watch ? Math.atan2(a.watch[0] - spots[i][0], a.watch[2] - spots[i][2]) : NaN);
          if (as.every((a: any) => a.order === 'hold' && a.watch && a.upper === 'aim' && a.light) && Math.abs(wrap(yaws[0] - yaws[1])) > Math.PI / 2) arcsOk++; }
        const words = red.map((m: any, i: number) => `${m.callsign} ${at(spots[i])} [${as[i].there}]`).join(' / ');
        R.give('bangClear', 'breakroom_w', 'blue'); const op = D.ops[0]; let held = true;
        R.post = () => { for (let i = 0; i < red.length; i++) if (red[i].state !== 'dead' && (O.of(red[i])?.order !== 'hold' || dist(red[i].char.pos, spots[i]) > 0.8)) held = false; };
        R.until(() => !D.ops.includes(op), 60); R.step(60 * 25); R.post = null; R.tally();
        const l = R.lost('red').length, k = R.killsBy(red).length; r.lost += l; r.kills += k; r.thr += R.through.length; r.ff += R.fratricide.length; if (mode === 'arcs' && held) stayed++;
        r.rows.push(`${mode} seed ${seed}: ${words} · red lost ${l}, red killed ${k} (${names(R.killsBy(red)) || '-'}) · blue's order ended '${op?.ended}'`); } }
    } finally { FRAG.defenders = fragWas; }
    const A = res.arcs, P = res.plain;
    verdict(arcsOk === SEEDS.length, 'told to hold as a pair, red splits the ways out: each man a watch point, gun and light up, the two arcs more than 90° apart', A.rows.join('\n    '));
    verdict(stayed === SEEDS.length, 'the holding pair stays where it was told (order \'hold\', within 0.8 m) while it lives', `${stayed} of ${SEEDS.length} runs`);
    verdict(A.kills >= SEEDS.length / 2, 'unordered, the holding pair engages what comes down its arcs (defenders killed by red while holding, over the seeds)', `${A.kills} defenders killed by red in ${SEEDS.length} runs`);
    verdict(A.lost <= P.lost && A.kills >= P.kills && A.lost <= 2, 'against the plain hold (each man told alone — no arcs): no more of red lost, no fewer defenders stopped (before the team heard footsteps — roomfight stepEars — the plain hold lost 8 of 12 here and the arcs were what saved them; a man who hears them coming now holds his own)', `arcs: red lost ${A.lost} of ${SEEDS.length * 2}, killed ${A.kills} · plain: lost ${P.lost} of ${SEEDS.length * 2}, killed ${P.kills}\n    ${P.rows.join('\n    ')}`);
    verdict(A.thr + P.thr === 0 && A.ff + P.ff === 0, 'no teammate down to a teammate, no round fired through one', `through ${A.thr + P.thr} · fratricide ${A.ff + P.ff}`); }
  return done();
});

// ============================================================================================================================ pairs-go
export const pairsGo = guarded(async () => {
  const { verdict, done } = family('pairs-go: two pairs, two doors, one word');
  // ---- (a) both stacked on a door each of the break room, the word
  { const SEEDS = [2, 5, 9, 11, 14]; const rows: string[] = []; let same = 0, inAll = 0, apart = 0, lost = 0, cleared = 0, thr = 0, ff = 0;
    for (const seed of SEEDS) { const R = await rig(seed, CORRIDOR, { tag: 'go' }); const { O, D } = R;
      R.give('stack', 'breakroom_n', 'red'); R.give('stack', 'breakroom_w', 'blue'); R.set('all', 35);
      const said = seed === 5 ? O.give('go', R.here(), 'all') : D.go();   // (one of the runs through the order itself, as a menu row would give it)
      const ops = [...D.ops]; R.until(() => !D.ops.length, 45); R.step(240); R.tally();
      const gos = ops.map((op: any) => R.beatT(op, 'go')), pods = ops.flatMap((op: any) => [...op.pod.values()].map((p: any) => p.pos)); let near = Infinity;
      for (let a = 0; a < pods.length; a++) for (let b = a + 1; b < pods.length; b++) near = Math.min(near, dist(pods[a], pods[b]));
      const two = ops.length === 2 && new Set(ops.map((op: any) => op.door.def.name)).size === 2;
      if (two && Math.abs(gos[0] - gos[1]) < 1.5 * DT) same++;
      if (two && ops.every((op: any) => op.ended === 'in' && [...op.pod.keys()].every((m: any) => op.crossed.has(m) || m.state === 'dead'))) inAll++;
      if (pods.length >= 3 && near >= DOORTOOLS.podApart - 0.01) apart++;
      const left = R.hostiles.slice(0, 2).filter((h: any) => h.state !== 'dead').length; if (!left) cleared++;
      lost += R.lost().length; thr += R.through.length; ff += R.fratricide.length;
      rows.push(`seed ${seed}: go → ${said} · ${ops.map((op: any, i: number) => `${op.door.def.name} (${names(op.men)}) go at ${f2(gos[i])}, ended '${op.ended}'`).join(' · ')} · pods ${pods.map(at).join(' ')} (nearest two ${f2(near)} m) · lost ${names(R.lost()) || 'none'} · the room's defenders left ${left}`); }
    verdict(same === SEEDS.length, 'on the word both pairs go through their own door on the SAME frame', rows.join('\n    '));
    verdict(inAll === SEEDS.length, 'every man sent in crosses his frame line (or falls trying) and both orders end \'in\'', `${inAll} of ${SEEDS.length} runs`);
    verdict(apart === SEEDS.length, `the four are dealt places inside that are apart (no two within ${DOORTOOLS.podApart} m)`, `${apart} of ${SEEDS.length} runs`);
    verdict(cleared >= SEEDS.length - 1 && lost <= 2, 'the room is taken (clear in all runs but one at most) for no more than two teammates lost over the seeds', `${cleared} of ${SEEDS.length} rooms clear · ${lost} teammates lost`);
    verdict(thr === 0 && ff === 0, 'two pairs converging in one room: no teammate down to a teammate, no round fired through one', `through ${thr} · fratricide ${ff}`); }
  // ---- (b) the word to ONE pair
  { const R = await rig(9, CORRIDOR, { quiet: true }); const { O, D } = R; const dw = R.door('breakroom_w');
    R.give('stack', 'breakroom_n', 'red'); R.give('stack', 'breakroom_w', 'blue'); R.set('all', 35);
    const said = O.give('go', R.here(), 'red'); const ops = [...D.ops]; R.until(() => !D.ops.length, 30); R.step(60);
    const blue = R.men('blue'), still = blue.every((m: any) => O.of(m)?.order === 'stack' && O.of(m).door === dw && sideOf(dw, m.char.pos) !== 0 && !inBounds(BREAKROOM, m.char.pos, -0.3));
    verdict(said === null && ops.length === 1 && ops[0].door.def.name === 'breakroom_n' && ops[0].men.every((m: any) => O.pairOf(m) === 'red') && ops[0].ended === 'in' && still, 'the word to red alone: red goes in at its door, blue stays stacked on its own', `go → ${said} · ${ops.map((op: any) => `${op.door.def.name} (${names(op.men)}) ended '${op.ended}'`).join(' · ')} · ${R.where('blue')}`); }
  // ---- (c) tools given `onWord`: a bang at the north door, a quiet open at the west door
  { const SEEDS = [2, 5, 9]; const rows: string[] = []; let waited = 0, ordered = 0, noted = 0, lost = 0, thr = 0, ff = 0, inAll = 0;
    for (const seed of SEEDS) { const R = await rig(seed, CORRIDOR, { tag: 'go-bang' }); const { O, D } = R;
      const w1 = R.give('bangClear', 'breakroom_n', 'red', { onWord: true }), w2 = R.give('openClear', 'breakroom_w', 'blue', { onWord: true });
      const ready = R.until(() => D.ops.length === 2 && D.ops.every((o: any) => o.phase === 'ready'), 45); R.step(180);
      const still = D.ops.length === 2 && D.ops.every((o: any) => o.phase === 'ready'), notes = D.hudNotes().filter((s: string) => s.includes('on your word'));
      if (ready && still && w1 === null && w2 === null) waited++; if (notes.length === 2) noted++;
      const said = D.go(); const ops = [...D.ops], red = ops.find((o: any) => o.kind === 'bangClear'), blue = ops.find((o: any) => o.kind === 'openClear');
      R.until(() => !D.ops.length, 45); R.step(240); R.tally();
      const bang = R.beatT(red, 'bang'), rgo = R.beatT(red, 'go'), bshove = R.beatT(blue, 'shove'), bgo = R.beatT(blue, 'go');
      if (bang < bgo && Math.abs(bshove - rgo) < 2.5 * DT && bgo >= rgo) ordered++;
      if (ops.every((op: any) => op.ended === 'in')) inAll++;
      lost += R.lost().length; thr += R.through.length; ff += R.fratricide.length;
      rows.push(`seed ${seed}: both ready ${ready}, still ready 3 s on ${still} · notes ${notes.length} · go → ${said} · red (bang, north) bang ${f2(bang)} go ${f2(rgo)} · blue (open, west) shove ${f2(bshove)} go ${f2(bgo)} · ended ${ops.map((op: any) => `'${op.ended}'`).join(' ')} · lost ${names(R.lost()) || 'none'}`); }
    verdict(waited === SEEDS.length, 'given `onWord`, both pairs stack, call ready and WAIT — three seconds on they are still waiting', rows.join('\n    '));
    verdict(noted === SEEDS.length, 'each waiting pair is on the door tools\' status notes (\'… on your word\')', `${noted} of ${SEEDS.length} runs`);
    verdict(ordered === SEEDS.length && inAll === SEEDS.length, 'on the word the bang goes first; the quiet door is shoved as the bang door\'s men go, so both pairs enter after the bang', `${ordered} of ${SEEDS.length} in order · ${inAll} of ${SEEDS.length} both ended 'in'`);
    verdict(thr === 0 && ff === 0 && lost <= 1, 'no teammate down to a teammate, no round through one, at most one teammate lost over the seeds', `through ${thr} · fratricide ${ff} · lost ${lost}`); }
  // ---- (d) the word to EVERYBODY is only the waiting men's: a pair on another order keeps it, a pair on the F drill keeps its drill
  { const R = await rig(9, CORRIDOR, { quiet: true }); const { O, D } = R; const red = R.men('red');
    O.give('hold', O.targetAt(FLANK), 'red'); R.give('stack', 'breakroom_w', 'blue'); R.set('all', 35);
    const said = O.give('go', R.here(), 'all'), row = O.log[O.log.length - 1]; R.until(() => !D.ops.length, 30);
    verdict(said === null && row.order === 'go' && row.who.join() === names(R.men('blue', true)).split(', ').join() && red.every((m: any) => O.of(m)?.order === 'hold'), 'the word to all with only blue waiting: it is blue\'s alone — red keeps its hold', `go → ${said} · taken by ${row.who.join(', ')} · ${R.where('red')}`); }
  { const R = await rig(9, CORRIDOR, { quiet: true }); const { O, NB } = R; const red = R.men('red'), owned = () => red.every((m: any) => O.owners.some((o: any) => o.owns(m)));
    R.W.input.pressed.add('KeyF'); R.step(); R.step(60); const was = NB.state, own0 = owned();
    R.give('stack', 'storage', 'blue'); R.until(() => R.men('blue').every((m: any) => O.of(m)?.arrived), 35);
    const said = O.give('go', R.here(), 'all'), row = O.log[O.log.length - 1]; R.step(30);
    verdict(own0 && said === null && row.who.every((c: string) => c.startsWith('Blue')) && owned() && NB.state !== 'recalled' && NB.state !== 'off', 'the word to all with red on the F drill and blue stacked: blue goes, the drill is not called off', `F → drill '${was}', owns red ${own0} · go → ${said} · taken by ${row.who.join(', ')} · drill '${NB.state}', still owns red ${owned()}`); }
  // ---- (e) the word while a charge is still being set: it waits for the charge, then the charge goes first
  { const R = await rig(5, CORRIDOR, { quiet: true }); const { O, D } = R;
    R.give('stack', 'breakroom_n', 'red'); R.set('red', 35);
    const w = R.give('charge', 'breakroom_w', 'blue'); R.until(() => D.ops.some((o: any) => o.kind === 'charge' && !isNaN(o.setT)), 30);
    const ch = D.ops.find((o: any) => o.kind === 'charge'), phase = ch?.phase; const said = O.give('go', R.here(), 'all'); const ops = [...D.ops], st = ops.find((o: any) => o.kind === 'openClear');
    R.until(() => !D.ops.length, 45); R.step(60);
    const blow = R.beatT(ch, 'blow'), shove = R.beatT(st, 'shove');
    verdict(w === null && phase === 'place' && said === null && ops.length === 2 && blow > 0 && shove >= blow && ops.every((op: any) => op.ended === 'in'), 'the word given while the charge is still being set: red waits on its door, the charge blows, then both go in', `charge order → ${w}, phase '${phase}' at the word · go → ${said} · blow ${f2(blow)} · red shove ${f2(shove)} · ${ops.map((op: any) => `${op.door.def.name} ended '${op.ended}'`).join(' · ')}`); }
  return done();
});

// ============================================================================================================================ pairs-tool
export const pairsTool = guarded(async () => {
  const { verdict, done } = family('pairs-tool: a door tool on a door the other pair is stacked on');
  const rows: string[] = []; let n = 0, kept = 0, back = 0, clear = 0, ran = 0, lost = 0, blast = 0, charges = 0, thr = 0, ff = 0, threw = '';
  for (const name of ['manager', 'breakroom_w']) for (const tool of ['openClear', 'bangClear', 'charge', 'outside']) { const seed = 5; n++;
    try { const R = await rig(seed, name === 'manager' ? MANAGER : CUBICLES, { tag: `tool-${tool}-${name}` }); const { O, D } = R; const d = R.door(name), red = R.men('red');
      R.give('stack', name, 'red'); R.set('red', 30); const before = red.map((m: any) => [...m.char.pos]), was = D.stats.steppedBack;
      // (the SHIPPED stand has no 'outside' row: 'clear from outside' is there the one plain order that holds the door until told — DOORTOOLS.outsidePlain,
      //  'thresholdHold'. Each stand is given its own order; everything asked of red and of the tool after it is the same)
      const why = R.give(tool === 'outside' && DOORTOOLS.outsidePlain ? 'thresholdHold' : tool, name, 'blue'); const op = D.ops[0]; const good = why === null && !!op && op.men.length === 2 && op.men.every((m: any) => O.pairOf(m) === 'blue'); R.step(2);
      const as = red.map((m: any) => O.of(m)), stepped = D.stats.steppedBack - was;
      const bluePosts = op ? [...op.post.values()].map((p: any) => p.pos) : [], redPosts = as.map((a: any) => a.post);
      let near = Infinity; for (const a of redPosts) for (const b of bluePosts) near = Math.min(near, dist(a, b));
      let stayedStack = true, res: any = null;
      R.post = () => { for (const m of R.men('red')) { const a = O.of(m); if (a?.order !== 'stack' || a.door !== d) stayedStack = false; } };
      for (let i = 0; i < 60 * 70 && op && D.ops.includes(op) && op.phase !== 'held'; i++) { R.step(); if (op.phase === 'armed' && !res) res = D.blow(); }
      const endedAs = op ? (D.ops.includes(op) ? `held outside` : op.ended) : 'no order'; R.step(180); R.post = null; R.tally();
      if (good && stayedStack) kept++;
      if (stepped === 2 && as.every((a: any, i: number) => dist(a.post, before[i]) > 0.5 && String(a.there).startsWith('rear security'))) back++;
      if (near >= 0.8) clear++;
      if (tool === 'outside' ? endedAs === 'held outside' || endedAs === 'in' : endedAs === 'in') ran++;
      if (tool === 'charge') { charges++; blast += res ? res.backblast : 99; }
      lost += R.lost().length; thr += R.through.length; ff += R.fratricide.length;
      rows.push(`${tool} on ${name}: give → ${why} · red ${red.map((m: any, i: number) => `${m.callsign} ${at(before[i])} → ${at(as[i].post)} [${as[i].there}]`).join(', ')} · blue on ${bluePosts.map(at).join(' ')} (nearest red mark ${f2(near)} m)${res ? ` · blown: knocked ${res.knocked}, stunned ${res.stunned}, backblast ${res.backblast}` : ''} · ended '${endedAs}' · red still on 'stack' ${stayedStack} · lost ${names(R.lost()) || 'none'}`);
    } catch (e) { threw = `${tool}/${name}: ${e instanceof Error ? e.stack : e}`; } }
  verdict(!threw, 'nothing threw', threw || `${n} runs`);
  verdict(kept === n, 'the tool is taken by blue alone (two men) and red\'s order stays \'stack\' on that door from start to end', rows.join('\n    '));
  verdict(back === n, 'both of red step back off the jambs to rear security', `${back} of ${n} runs`);
  verdict(clear === n, 'red\'s new marks are clear of the marks blue works from (0.8 m or more)', `${clear} of ${n} runs`);
  verdict(ran === n, 'the tool runs to its end with the other pair there (\'in\'; clear from outside: held outside or in)', `${ran} of ${n} runs`);
  verdict(charges === 2 && blast === 0, 'the charge: nobody of ours inside its backblast when Sam blows it', `${charges} charges · backblast ${blast}`);
  verdict(thr === 0 && ff === 0, 'no teammate down to a teammate, no round fired through one', `through ${thr} · fratricide ${ff} · ${lost} teammates lost to defenders in ${n} runs`);
  // ---- the other pair opens the door under a charge: the setter is not left at the lock reading 'setting the charge'. Twice: with the PLAIN stack (rear
  //      security pinned off: red is on the door first, and it opens with the setter still on his way — 'the door opened'), and as shipped (red's rear man
  //      takes his rear on the way in, so the stack forms later and the charge may already be ON the door when it opens — then it comes off it, back in the
  //      bag: 'the charge is gone'). Either way nobody reads 'setting the charge', no charge is spent, and the setter stands off with his mate
  { const { COVER } = await import(`${ROOT}/src/game/cover.ts`); const was = COVER.stacked;
    for (const plain of [true, false]) { COVER.stacked = plain ? false : was; try {
      const R = await rig(5, MANAGER, { tag: 'tool-under-charge' }); const { O, D } = R; const d = R.door('manager');
      const w1 = R.give('charge', 'manager', 'blue'); const op = D.ops[0], lead = op?.lead, P = lead ? [...op.post.get(lead).pos] : null; R.step(5);
      let w2 = R.give('openClear', 'manager', 'red'); const rop = D.ops.find((x: any) => x !== op);
      // (the manager's door is locked. As shipped an entry halts at a door its lead finds shut — DOORTOOLS.testDoor: "holding on it — your call" — and the same
      //  row again is the order that boots it; so red is told twice, as a player would, and the door opens under blue's charge the second time)
      if (DOORTOOLS.testDoor && w2 === null && rop) { R.until(() => !D.ops.includes(rop), 30); if (rop.ended === 'found shut') w2 = R.give('openClear', 'manager', 'red'); }
      R.until(() => !D.ops.length, 50); R.step(180); R.tally();
      const stale = R.men('all').filter((m: any) => O.statusOf(m) === 'setting the charge'), off = lead && P && lead.state !== 'dead' ? dist(lead.char.pos, P) : NaN;
      // (the door opened with the setter still on his way and his mark across the opening from him: DOORTOOLS.openHand stops him where he is, on a plain stack
      //  with his mate, and that is that rule's own end for him — which end a run gets is a matter of how long the walk in was: seenwalk.ts made it longer)
      const kept = DOORTOOLS.openHand && op?.ended === 'the door opened' && !!lead && String(O.statusOf(lead)).startsWith('stacked');
      const ended = op?.ended === 'the door opened' || op?.ended === 'the charge is gone';   // (either ending in both runs: which comes first, red's hand on the door or blue's charge, is a matter of half a second of walking — doorway.ts moved it in the plain run)
      verdict(w1 === null && w2 === null && ended && stale.length === 0 && (lead.state === 'dead' || off < 0.8 || kept) && D.charges === DOORTOOLS.charges, plain ? 'red opens and clears a door blue was still walking a charge to (the plain stack): blue\'s order ends, the charge stays in the bag, and its setter stands off with his mate — nobody is left reading \'setting the charge\'' : 'the same with rear security as shipped: the door opens under the setter or under his charge — the charge is back in the bag either way, the setter stood off, nobody reading \'setting the charge\'', `charge → ${w1}, open and clear → ${w2} · blue's order ended '${op?.ended}' · ${R.where('blue')} · the setter ${f2(off)} m from his stand-off mark${kept ? ' (stopped on his hand of the opening, on a plain stack: openHand)' : ''}, ${f2(lead ? dist(lead.char.pos, d.frameCentre) : NaN)} m from the frame · charges left ${D.charges}`);
    } finally { COVER.stacked = was; } } }
  // ---- a teammate BEHIND the door: the charge is refused
  { const R = await rig(5, CUBICLES, { quiet: true }); const { O, D } = R;
    O.give('move', O.targetAt([29.6, 0, 17.6]), 'red'); R.set('red', 30); R.step(30); { const d = R.door('breakroom_w'); d.angle = 0; d.vel = 0; d.latched = true; d.place(); } R.step(2);   // (red went in through it: the leaf shut behind them, as the staging had it)
    const inside = R.men('red').filter((m: any) => inBounds(BREAKROOM, m.char.pos, 0)), why = R.give('charge', 'breakroom_w', 'blue'), ops = D.ops.length;
    verdict(inside.length > 0 && typeof why === 'string' && /behind that door/.test(why) && ops === 0, 'a charge on a door with a teammate just behind it is refused, by name', `red inside the room: ${names(inside) || 'none'} · give('charge') → ${why}`); }
  return done();
});

// ============================================================================================================================ pairs-haltback
export const pairsHaltback = guarded(async () => {
  const { verdict, done } = family('pairs-haltback: a pair halted \'found shut\' on a door the other pair is charging steps back out of the blast (DOORTOOLS.haltBack)');
  const BREAK = process.env.HALTBACK_BREAK === '1'; if (BREAK) console.log('  (HALTBACK_BREAK: DOORTOOLS.haltBack is left off in this probe\'s key-on run — the rear security and backblast lines must fail)');
  type Man = { c: string; order: string; door: string; there: string; post: number[]; pos: number[] };
  type Run = { w1: string | null; w2: string | null; ended: string; said: string; halt: Man[]; atBlow: Man[]; blue: number[][]; frame: number[]; res: any; chEnded: string; stale: string[]; stepped: number; notes: string[]; end: Man[]; orphan: string };
  const AWAY: number[] = [19.5, 0, 11.2], EAST: number[] = [34.5, 0, 11.0];
  /** 'halt' = blue's charge first, then red's entry halts on the door · 'ref' = red plain-stacked on it BEFORE blue's charge order (the step back as it has
   *  always been asked) · 'bare' = red's entry halts on the door and nobody has a charge on it. Sam stands down the corridor, off the door: at its lock
   *  rows he would KNOW it locked (doortools.ts testStacks) and no order halts on a door the team knows. `near` = both orders given with Sam AT the door, as
   *  a player gives them — his body is then in the stack's way and the entry's last man is dealt a mark further down the wall. 'leave': he is then put
   *  down the corridor and what he learnt at the lock is taken back, by hand, so that the order halts on either stand; 'stay': he stays, as played —
   *  the order halts or not by the stand's own rules. 'set' = blue's charge set and armed, blue then sent off down the corridor (its charge order ends,
   *  the charge stays on the door), and only then red's entry, which halts on a door with a teammate's charge and no order on it */
  const play = async (mode: 'halt' | 'ref' | 'bare' | 'set', key: boolean, near: false | 'leave' | 'stay' = false): Promise<Run> => {
    const R = await rig(5, near ? MANAGER : AWAY, { quiet: true, tag: `haltback-${mode}` }); const { O, D } = R; const d = R.door('manager'), red = R.men('red');
    DOORTOOLS.testDoor = true; DOORTOOLS.haltBack = key;   // (after the stand-up: the frozen stand pins both off, the page's has both on — here each run is told)
    const snap = (): Man[] => red.map((m: any) => { const a = O.of(m); return { c: m.callsign, order: String(a?.order), door: String(a?.door?.def.name), there: String(a?.there), post: a?.post ? [...a.post] : [NaN, 0, NaN], pos: [...m.char.pos] }; });
    const was = D.stats.steppedBack, log0 = D.log.length; let w1: string | null = null, w2: string | null = null, ended = '', cop: any = null, gone: any = null, orphan = '';
    if (mode === 'ref') { w2 = R.give('stack', 'manager', 'red'); R.set('red', 30); w1 = R.give('charge', 'manager', 'blue'); cop = D.ops[0]; ended = 'stacked beforehand'; R.step(2); }
    else { if (mode === 'halt') { w1 = R.give('charge', 'manager', 'blue'); cop = D.ops[0]; R.step(5); }
      if (mode === 'set') { w1 = R.give('charge', 'manager', 'blue'); gone = D.ops[0]; R.until(() => gone.phase === 'armed' || !D.ops.includes(gone), 45); const ph = gone.phase;
        const wm = O.give('move', O.targetAt(EAST), 'blue'); R.set('blue', 30); const c = D.chargeOn(d);
        orphan = `armed '${ph}' · blue moved off → ${wm} · its charge order ${D.ops.includes(gone) ? 'STILL LIVE' : `ended '${gone.ended}'`} · on the door: ${c ? `a charge set by ${c.by}` : 'NO CHARGE'} · door orders live ${D.ops.length}`; }
      w2 = R.give('openClear', 'manager', 'red'); const rop = D.ops.find((x: any) => x !== cop);
      if (mode === 'halt' && near === 'leave') { R.game.teleportPlayer(AWAY); R.step(2); D.tried.clear(); }
      if (rop) { R.until(() => !D.ops.includes(rop), 30); ended = String(rop.ended); } R.step(2); }
    const said = red.map((m: any) => m.bubble?.text).filter(Boolean).join(' / '), halt = snap();
    let res: any = null, atBlow = halt;
    if (cop) { R.until(() => cop.phase === 'armed' || !D.ops.includes(cop), 45); R.set('red', 20); R.step(30); atBlow = snap(); if (cop.phase === 'armed') res = D.blow(); R.until(() => !D.ops.length, 50); }
    else if (mode === 'set') { R.set('red', 20); R.step(30); atBlow = snap(); const c = D.chargeOn(d); if (c) res = D.blow(c); R.step(180); }
    else R.step(600);
    const blue = cop ? [...cop.post.values()].map((P: any) => [...P.pos]) : []; R.step(180);
    return { w1, w2, ended, said, halt, atBlow, blue, frame: [...d.frameCentre], res, chEnded: cop ? String(cop.ended) : gone ? String(gone.ended) : 'no charge', stale: R.men('all').filter((m: any) => O.statusOf(m) === 'setting the charge').map((m: any) => m.callsign),
      stepped: D.stats.steppedBack - was, notes: D.log.slice(log0).map((l: any) => l.what).filter((w: string) => /made room|no room to stand off/.test(w)), end: snap(), orphan };
  };
  const gap = (a: number[][], b: number[][]) => a.length === b.length && a.length > 0 ? Math.max(...a.map((p, i) => dist(p, b[i]))) : Infinity;
  const row = (r: Run, l: Man[] = r.halt) => l.map(m => `${m.c} ${at(m.post)} ${f2(dist(m.post, r.frame))} m off the frame [${m.there}]`).join(', ');
  const blast = (r: Run) => r.res ? `knocked ${r.res.knocked}, stunned ${r.res.stunned}, backblast ${r.res.backblast}` : 'NOT BLOWN';
  const on = await play('halt', !BREAK), off = await play('halt', false), ref = await play('ref', false);
  const K = DOORTOOLS.backblastM, rear = (m: Man) => m.order === 'stack' && m.door === 'manager' && m.there.startsWith('rear security · ');
  const staged = (r: Run) => r.w1 === null && r.w2 === null && r.ended === 'found shut' && !!r.res;
  verdict(staged(on) && staged(off) && ref.w1 === null && ref.w2 === null && !!ref.res && ref.halt.every(rear) && ref.stepped === 2, 'staged: blue takes the charge on the locked manager\'s door, red\'s \'open and clear\' on it ends \'found shut\' (key on and key off), and each charge is set, armed and blown; the reference — red stacked on it before the charge order — steps back to rear security as it always has',
    `key on: charge → ${on.w1}, open and clear → ${on.w2}, ended '${on.ended}', said "${on.said}" · key off: ended '${off.ended}' · reference: ${row(ref)} · ${blast(ref)}`);
  verdict(on.halt.length === 2 && on.halt.every(rear) && on.stepped === 2 && on.notes.length === 1 && on.end.every(rear), `KEY ON${BREAK ? ' (HALTBACK_BREAK: left off)' : ''} — both of red read 'rear security · <door>' as the order ends, their order still 'stack' on that door, and still do after the blast`,
    `${row(on)} · stepped back ${on.stepped} · log: ${on.notes.join(' | ') || 'nothing'}`);
  verdict(on.halt.every(m => dist(m.post, on.frame) >= K) && on.atBlow.every(m => dist(m.pos, on.frame) >= K), `KEY ON — their marks, and where they stand as Sam blows it, are ${K} m (the backblast) or more from the frame`,
    `marks ${on.halt.map(m => f2(dist(m.post, on.frame))).join(' / ')} m · standing ${on.atBlow.map(m => f2(dist(m.pos, on.frame))).join(' / ')} m`);
  { const g = gap(on.halt.map(m => m.post), ref.halt.map(m => m.post)), sameMen = on.halt.map(m => m.c).join() === ref.halt.map(m => m.c).join();
    verdict(sameMen && g < 1e-6 && on.halt.every((m, i) => m.there === ref.halt[i].there), 'KEY ON — man for man the marks and the words are the reference run\'s: where a pair stacked on the door before the charge order is sent',
      `differ by ${Number.isFinite(g) ? g.toFixed(6) : g} m · halted: ${row(on)} · reference: ${row(ref)}`); }
  verdict(!!on.res && on.res.backblast === 0 && on.stale.length === 0 && on.chEnded === 'in', 'KEY ON — blown: nobody of ours inside the backblast, the charge order runs to its end, nobody is left reading \'setting the charge\'',
    `${blast(on)} · charge order ended '${on.chEnded}' · reading 'setting the charge': ${on.stale.join(', ') || 'nobody'}`);
  verdict(gap(on.blue, off.blue) < 1e-6 && !!on.res && !!off.res && on.res.knocked === off.res.knocked && on.res.stunned === off.res.stunned && on.chEnded === off.chEnded, 'KEY ON against KEY OFF — blue\'s stand-off marks, what the blast does beyond the door and how the charge order ends are the same',
    `blue ${on.blue.map(at).join(' ')} / ${off.blue.map(at).join(' ')} (differ ${gap(on.blue, off.blue).toFixed(6)} m) · on: ${blast(on)}, ended '${on.chEnded}' · off: ${blast(off)}, ended '${off.chEnded}'`);
  verdict(!!off.res && off.res.backblast >= 1 && off.stepped === 0 && off.halt.every(m => m.order === 'stack' && m.there.startsWith('stacked · ')) && off.halt.some(m => dist(m.post, off.frame) < K), 'CONTROL (HALTBACK_BREAK does not touch it) — KEY OFF, the fault as it was: red stays stacked where it halted, a mark inside the backblast, and Sam\'s charge dazzles his own',
    `${row(off)} · ${blast(off)}`);
  { const a = await play('bare', true), b = await play('bare', false), g = Math.max(gap(a.halt.map(m => m.post), b.halt.map(m => m.post)), gap(a.end.map(m => m.pos), b.end.map(m => m.pos)));
    verdict(a.ended === 'found shut' && b.ended === 'found shut' && a.stepped === 0 && b.stepped === 0 && g < 1e-6 && a.halt.every((m, i) => m.there.startsWith('stacked · ') && m.there === b.halt[i].there) && a.end.every((m, i) => m.there === b.end[i].there),
      'CONTROL (HALTBACK_BREAK does not touch it) — no charge on the door: red halts \'found shut\' and stays plain-stacked, marks, words and where it stands ten seconds on the same key on and key off',
      `key on: ended '${a.ended}', ${row(a)} · key off: ended '${b.ended}', ${row(b)} · differ by ${Number.isFinite(g) ? g.toFixed(6) : g} m · stepped back ${a.stepped} / ${b.stepped}`); }
  // the orders given with Sam at the door: the entry's stack is dealt round his body, and its last man may stand further down the wall than the makers count
  // as 'on the door' (doortools.ts holders, 2.6 m) — he is out of the blast and is not asked to step back; his mate must not be sent to stand on him
  { const a = await play('halt', !BREAK, 'leave'), b = await play('halt', false, 'leave'), marks = a.halt.map(m => m.post);
    let apart = Infinity; for (let i = 0; i < marks.length; i++) { for (let j = i + 1; j < marks.length; j++) apart = Math.min(apart, dist(marks[i], marks[j])); for (const q of a.blue) apart = Math.min(apart, dist(marks[i], q)); }
    const each = a.halt.every(m => m.order === 'stack' && m.door === 'manager' && dist(m.post, a.frame) >= K && (rear(m) || (m.there.startsWith('stacked · ') && dist(m.post, a.frame) >= 2.6)));
    verdict(a.ended === 'found shut' && !!a.res && each && a.stepped >= 1 && apart >= 0.85 && a.res.backblast === 0 && a.atBlow.every(m => dist(m.pos, a.frame) >= K) && a.stale.length === 0,
      `KEY ON${BREAK ? ' (HALTBACK_BREAK: left off)' : ''} — the orders given with Sam at the door, Sam then put down the corridor and the lock he read forgotten: every man of red is rear security, or was dealt a stack mark already further off than the makers count as on the door and keeps it; no two marks on one place (0.85 m or more apart, blue's among them); blown, nobody of ours in the backblast`,
      `key on: ended '${a.ended}', ${row(a)} · stepped back ${a.stepped} · nearest two marks ${f2(apart)} m · standing ${a.atBlow.map(m => f2(dist(m.pos, a.frame))).join(' / ')} m off the frame as it blows · ${blast(a)} · key off (not asked, for the reading): ended '${b.ended}', ${row(b)} · ${blast(b)}`); }
  // … and AS PLAYED: Sam stays at the door through the halt and the blow. Where the stand's rules have the order halt there, red steps back; where they do
  // not (the team knows the door from Sam at its lock rows, and the entry goes in), there is no halted pair and the line says so
  { const a = await play('halt', !BREAK, 'stay'), marks = a.halt.map(m => m.post), halted = a.ended === 'found shut';
    let apart = Infinity; for (let i = 0; i < marks.length; i++) { for (let j = i + 1; j < marks.length; j++) apart = Math.min(apart, dist(marks[i], marks[j])); for (const q of a.blue) apart = Math.min(apart, dist(marks[i], q)); }
    const each = a.halt.every(m => m.order === 'stack' && m.door === 'manager' && dist(m.post, a.frame) >= K && (rear(m) || (m.there.startsWith('stacked · ') && dist(m.post, a.frame) >= 2.6)));
    verdict(a.w1 === null && a.w2 === null && (halted ? !!a.res && each && a.stepped >= 1 && apart >= 0.85 && a.res.backblast === 0 && a.stale.length === 0 : a.ended === 'in'),
      `KEY ON${BREAK ? ' (HALTBACK_BREAK: left off)' : ''} — as played, Sam standing at the door throughout: where the order halts red steps back — marks ${K} m or more off the frame and 0.85 m or more apart, blown, nobody of ours in the backblast; where the stand has it go in instead, nobody halted and nothing is asked`,
      halted ? `halted: ${row(a)} · stepped back ${a.stepped} · nearest two marks ${f2(apart)} m · ${blast(a)}` : `DID NOT HALT on this stand: red's order ended '${a.ended}' (Sam at its lock rows: the team knew the door), blue's charge order ended '${a.chEnded}' — no halted pair, the line passes on that`); }
  // a teammate's charge LEFT SET on the door with its order gone: a pair stacked there before the charge order is still stood back from it; so is a halted one
  { const a = await play('set', !BREAK), b = await play('set', false), staged = (r: Run) => r.w1 === null && r.w2 === null && r.ended === 'found shut' && !!r.res && / ended '/.test(r.orphan) && /a charge set by Blue/.test(r.orphan);
    verdict(staged(a) && a.halt.every(rear) && a.stepped === 2 && a.halt.every(m => dist(m.post, a.frame) >= K) && a.atBlow.every(m => dist(m.pos, a.frame) >= K) && a.res.backblast === 0,
      `KEY ON${BREAK ? ' (HALTBACK_BREAK: left off)' : ''} — a teammate's charge left set on the door, its order gone (blue armed it and was sent off): red halts on it and steps back to rear security; blown, nobody of ours in the backblast`,
      `${a.orphan} · red ended '${a.ended}' · ${row(a)} · stepped back ${a.stepped} · ${blast(a)}`);
    verdict(staged(b) && b.stepped === 0 && b.res.backblast >= 1 && b.halt.every(m => m.there.startsWith('stacked · ')), 'CONTROL (HALTBACK_BREAK does not touch it) — the same, KEY OFF: red stays stacked where it halted and the charge dazzles one of ours',
      `${b.orphan} · red ended '${b.ended}' · ${row(b)} · ${blast(b)}`); }
  // the journal: a recording from before the key replays with it off (journal.ts applyKnobs); one that carries it keeps its own word
  { const R = await rig(5, MANAGER, { quiet: true }), g = R.game, J: any = await import(`${ROOT}/src/game/journal.ts`), KN: any = await import(`${ROOT}/src/game/knobs.ts`), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g))), kept = KN.knobsCopy();
    try {
      DOORTOOLS.haltBack = true; const old = snap(); if (old.tables.DOORTOOLS) delete old.tables.DOORTOOLS.haltBack; if (old.flags) delete old.flags.haltBack; J.applyKnobs(g, old); const x = DOORTOOLS.haltBack;
      DOORTOOLS.haltBack = true; const yes = snap(); DOORTOOLS.haltBack = false; J.applyKnobs(g, yes); const y = DOORTOOLS.haltBack;
      DOORTOOLS.haltBack = false; const no = snap(); DOORTOOLS.haltBack = true; J.applyKnobs(g, no); const z = DOORTOOLS.haltBack;
      verdict(x === false && y === true && z === false, 'CONTROL (plumbing: HALTBACK_BREAK does not touch it) — the journal: a recording from before DOORTOOLS.haltBack replays with it off, one made with it on replays on, one made with it off replays off', `old → ${x} · recorded on → ${y} · recorded off → ${z}`);
    } finally { KN.knobsBack(kept); } }
  return done();
});

// ============================================================================================================================ pairs-lanes
export const pairsLanes = guarded(async () => {
  const { verdict, done } = family('pairs-lanes: nobody in the other pair\'s line of fire');
  // ---- a posted gun comes down while a man of the other pair crosses its line
  { const R = await rig(5, CUBICLES, { quiet: true }); const { O } = R; const red = R.men('red');   // (Sam out of the corridor: a muzzle that comes down here comes down for blue)
    O.give('move', O.targetAt(FLANK), 'red'); R.set('red', 25); O.give('hold', R.here(), 'red'); R.step(60); const arcs = red.map((m: any) => O.of(m)?.there).join(' / ');
    let crossed = 0, up = 0, lowSeen = 0;
    R.post = () => { for (const w of red) { const a = O.of(w); if (!a?.watch || !a.arrived) continue; const p = w.char.pos, yaw = Math.atan2(a.watch[0] - p[0], a.watch[2] - p[2]), fx = Math.sin(yaw), fz = Math.cos(yaw), len = dist(p, a.watch);
      const hit = R.men('blue').some((m: any) => { const sx = m.char.pos[0] - p[0], sz = m.char.pos[2] - p[2], al = sx * fx + sz * fz; return al > 0.3 && al < len - 0.1 && Math.abs(sx * fz - sz * fx) < 0.3; });
      if (hit) { crossed++; if (!a.low) up++; } if (a.low) lowSeen++; } };
    O.give('move', O.targetAt([34.5, 0, 11.0]), 'blue'); R.set('blue', 30); R.step(30); const east = R.men('blue').map((m: any) => at(m.char.pos)).join(' '), eastLow = red.map((m: any) => !!O.of(m)?.low);
    O.give('move', O.targetAt([17.5, 0, 11.0]), 'blue'); R.set('blue', 40); R.step(90); const after = red.map((m: any) => !!O.of(m)?.low);
    const end = R.men('blue').map((m: any) => at(m.char.pos)).join(' ');
    verdict(crossed > 10 && up <= 2, 'blue sent down the corridor past red\'s held arc: on every frame a blue man is in a red gun\'s line, that muzzle is down (two frames\' grace as he steps in)', `red ${arcs} · blue east to ${east} (red's muzzles down there: ${eastLow.join(' / ')}), then west to ${end} · man-frames in a red line ${crossed} · with the muzzle still up ${up} · frames a muzzle was down ${lowSeen}`);
    verdict(eastLow.some(Boolean) && after.every((l: boolean) => !l), 'a muzzle stays down while blue stands in its arc, and both are back up once blue is out of the lines', `down with blue stopped east ${eastLow.join(' / ')} · down at the end ${after.join(' / ')}`); }
  // ---- the two pairs on two different rooms off one corridor at the same time
  // (six seeds since the doors went to real size, 7a0e39c3: the first three alone — 2, 9, 5 — had both orders end 'in' behind 1.2 m doors and have none behind
  //  0.9 m ones. Over seeds 1–24 both end 'in' on 22 at the old size and on 12 or 13 at the new, blue's storage pair lost 18 and then 30 to 33 of 48, every man
  //  to the break room's two at the corridor door behind them; red loses nobody at either size. That is the level's door size, not the two orders: the line asks
  //  that both orders CAN end 'in' side by side, so it is asked of the three lowest seeds not already here as well)
  { const rows: string[] = []; let both = 0, n = 0, bothIn = 0;
    for (const seed of [2, 9, 5, 1, 3, 4]) { n++; const R = await rig(seed, [27.0, 0, 11.6], { tag: 'two-rooms' }); const { O, D } = R;
      let w1 = R.give('bangClear', 'manager', 'red'), w2 = R.give('bangClear', 'storage', 'blue'); let ops = [...D.ops];
      // (both doors are locked. As shipped an entry halts at a door its lead finds shut — DOORTOOLS.testDoor — and the same row again boots it: each pair has
      //  tried its door and said so, then both are told again at once, as a player would, and those two orders are the ones read side by side)
      if (DOORTOOLS.testDoor && w1 === null && w2 === null && ops.length === 2) { R.until(() => !D.ops.length, 30);
        if (ops.every((op: any) => op.ended === 'found shut')) { w1 = R.give('bangClear', 'manager', 'red'); w2 = R.give('bangClear', 'storage', 'blue'); ops = [...D.ops]; } }
      const own = ops.length === 2 && ops.every((op: any, i: number) => op.men.length === 2 && op.men.every((m: any) => O.pairOf(m) === (i ? 'blue' : 'red'))), who = ops.map((op: any) => names(op.men));
      R.until(() => !D.ops.length, 60); R.step(240); R.tally();
      const span = ops.map((op: any) => [R.beatT(op, 'ordered'), R.beatT(op, 'end')]), overlap = ops.length === 2 && span[0][0] < span[1][1] && span[1][0] < span[0][1];
      // (an entry now ends when the room has been LOOKED OVER, seconds after the last man is through — at 571b56c it ended on the fixed sweep and the men the
      //  corridor's defenders took were shot seconds AFTER 'in'; now some of them fall inside those seconds and their order ends for want of men. That is the
      //  same loss, not the other pair's doing: an order that ran out of men counts when every man of it fell to a defender)
      const lostTo = (op: any) => op.ended === 'nobody left on it' && op.men.length === 0 && R.downs.filter(x => x.who.team === 'operative').every(x => x.by?.team === 'hostile');
      if (w1 === null && w2 === null && own && overlap && ops.every((op: any) => op.ended === 'in' || lostTo(op))) both++;
      if (ops.length === 2 && ops.every((op: any) => op.ended === 'in')) bothIn++;
      rows.push(`seed ${seed}: red bang and clear the manager's office → ${w1}, blue bang and clear storage → ${w2} · ${ops.map((op: any, i: number) => `${op.door.def.name} (${who[i]}) ${f2(span[i][0])}–${f2(span[i][1])} s, ended '${op.ended}'`).join(' · ')} · rounds ${R.rounds}, through ${R.through.length} · lost ${R.downs.filter(x => x.who.team === 'operative').map(x => `${x.who.callsign} to ${x.by?.callsign ?? '?'}`).join(', ') || 'none'}`); }
    verdict(both === n && bothIn > 0, 'red and blue each take a different room off the same corridor at once: each order is its own pair\'s, the two run side by side, neither calls the other off, and each ends \'in\' or with its men down to a defender — never to the other order (with nobody left on the corridor the men lost go to defenders coming at their backs — printed, not judged; both end \'in\' on at least one seed)', rows.join('\n    ')); }
  // ---- the family's tally
  verdict(TALLY.fratricide.length === 0, 'no teammate went down to a teammate\'s round or Sam\'s in any fighting run of this family (the game\'s rule makes this so; the lanes are counted below)', TALLY.fratricide.join(' · ') || `${TALLY.runs} fighting runs · ${TALLY.lost} teammates lost, every one to a defender`);
  verdict(TALLY.rounds > 0 && TALLY.through.length === 0, 'lanes: no teammate\'s round was fired through another teammate in any of them', `${TALLY.through.length} of ${TALLY.rounds} rounds over ${TALLY.runs} runs${TALLY.through.length ? ` · ${TALLY.through.slice(0, 8).join(' · ')}` : ''} · fire held for a friend in the line ${TALLY.heldForFriend} times`);
  return done();
});
