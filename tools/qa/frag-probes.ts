// The 'frag' family (game/frag.ts — the fragmentation grenade: the item on its fuse, the one blast function, men getting off a live one, the squad's
// 'frag and clear'), run through probes.ts:
//   bun run tools/qa/probes.ts frag | frag-blast | frag-player | frag-react | frag-order | frag-own | frag-identity
// PASS / FAIL each, all headless (the Game of headless.ts). The harness has no picture and no sound: the flash, the burst, the scorch, the grenade in the fist and
// the stand-in bang are untested by eye and ear.
//   frag-blast     a man in the open inside the lethal radius dies; a man the same distance off behind a wall does not, and is not even staggered; a man in the
//                  open beyond the wound radius is untouched; the blast is ONE 'bang' event flagged frag that every living man on the floor hears; the destruction
//                  lane is called exactly once per blast; the wound band between the two radii only ever kills or folds a man (no third state), by a dice that is
//                  the same on a second run; the blast function called bare (no item) does the same
//   frag-player    no digit above 5 selects anything; 5 puts the grenade in the fist, a click throws it along the arc, the count drops, the fuse runs from the
//                  hand, it goes off and is gone; G never throws one; Sam inside his own blast goes down (and does not in god mode); a checkpoint keeps the count
//   frag-react     a live grenade landing by defenders with the AI on: one shouts 'grenade!', the men in its line move, and fewer of them are down than with the
//                  reaction off (FRAG.fleeM 0) under the same seeds; a man behind a wall stays where he is; a blinded man does not move; nobody is left running
//                  after it has gone off. NOBODY RUNS ONTO IT (FRAG.fleeWise, lines g–k; the owner's tape 'the depot' 052901): the depot's own stack of four
//                  on a held room's door (found on the level, as the marks and every roll are), at the squad's pace, and a grenade that lands behind it and ROLLS — nobody ends nearer where it rests than he
//                  began, no leg passes nearer it, nobody is turned about mid-leg more than once (never back toward it), nobody stands inside the lethal radius with a leg open.
//                  FLEEWISE_BREAK=1 = the rule left off and the same lines asked: they must fail. FLEE_GOALS=1 prints each man's goals.
import { standUp, ROOT } from './headless.ts';
const { FRAG, FRAG_LOG, FRAG_STATS, FRAG_WHY, fragStatsReset, blast, exposure, exposedTo } = await import(`${ROOT}/src/game/frag.ts`);
const { KIT_ORDER } = await import(`${ROOT}/src/game/game.ts`);
const { QUICKTHROW } = await import(`${ROOT}/src/game/quickthrow.ts`);   // (the G quick throw: on on the frozen stand, off in the page — (c) and (d2) read it)
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : String(x));
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const FRAG_DEFAULTS = JSON.parse(JSON.stringify(FRAG));
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { Object.assign(FRAG, JSON.parse(JSON.stringify(FRAG_DEFAULTS))); } };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** the corridor outside the break room: open floor east-west, rooms through walls north and south */
const P0: number[] = [22, 0, 17.6];

export async function rig(seed: number) {
  Object.assign(FRAG, JSON.parse(JSON.stringify(FRAG_DEFAULTS))); fragStatsReset();
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game, input = W.input;
  const said: string[] = []; { const msg = game.msg.bind(game); game.msg = (t: string) => { said.push(t); msg(t); }; }
  let destr = 0; { const b = game.destr.bang.bind(game.destr); game.destr.bang = (...a: any[]) => { destr++; return b(...a); }; }
  const R = { W, game, input, said, get destr() { return destr; },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; W.step(DT); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    /** a spot `r` metres from p (± 0.4) that is free floor and, as asked, in the blast's line at every height or at none (at none: as a man reckons it before
     *  the burst where FRAG.wallFlee is on — behind a wall the burst will leave standing; frag-wallflee asks the wall it will not) */
    spot(p: number[], r: number, open: boolean, not: number[][] = []): number[] | null {
      const from = [p[0], p[1] + FRAG.lift, p[2]];
      for (let k = 0; k < 720; k++) { const a = k * 2.399963, rr = r + ((k % 5) - 2) * 0.2; const q = [p[0] + Math.sin(a) * rr, 0, p[2] + Math.cos(a) * rr];
        if (game.col.nav.isBlocked(q[0], q[2]) || not.some(n => dist(n, q) < 1.2)) continue;
        const e = exposure(game, from, q, [q[0], 1.65, q[2]]); if (open ? e === 1 : e === 0 && (!FRAG.wallFlee || exposedTo(game, from, q, [q[0], 1.65, q[2]]) === 0)) return q; }
      return null;
    },
    /** stand a man of the shift at p, still, facing `face` */
    put(gd: any, p: number[], face?: number[]) { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.lastPos = [p[0], 0, p[2]]; if (face) { const y = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.char.bodyYaw = y; gd.char.aimYaw = y; } },
    frag(p: number[], fuse: number, who = 1) { return game.items.spawn('frag', [p[0], 0.05, p[2]], [0, 0, 0], { fuse, who }); },
  };
  return R;
}

// ---------------------------------------------------------------- frag-blast
export const fragBlast = guarded(async () => {
  const F = family('frag-blast: a man in the open inside the lethal radius dies, one behind a wall does not');
  const R = await rig(11); const g = R.game; g.aiEnabled = false; g.godMode = true;
  g.teleportPlayer([8, 0, 17.6]);   // Sam: far down the corridor, out of it
  const [A, B, C] = g.guards;
  const open = R.spot(P0, 2.6, true), wall = R.spot(P0, 2.6, false, [open!]), far = R.spot(P0, FRAG.woundM + 2.5, true, [open!, wall!]);
  if (!open || !wall || !far) { F.verdict(false, 'staging', `no spots: open ${open} wall ${wall} far ${far}`); return F.done(); }
  R.put(A, open); R.put(B, wall); R.put(C, far); R.step(2);
  const stag0 = B.staggerUntil; const ev0 = g.events.length; const d0 = R.destr;
  R.frag(P0, 0.2); R.until(() => FRAG_LOG.length > 0, 2); R.step(1);
  const rep = FRAG_LOG[0];
  F.verdict(!!rep && A.state === 'dead' && rep.hits.some((h: any) => h.id === A.char.id && h.result === 'killed'), `(a) ${A.callsign}, standing in the open ${f2(dist(open, P0))} m from it, is dead`, rep ? `state ${A.state} · report ${JSON.stringify(rep.hits.map((h: any) => `${h.name} ${f2(h.d)}m e${h.exposed} ${h.result}`))}` : 'no blast');
  F.verdict(B.state !== 'dead' && B.staggerUntil === stag0 && !!rep?.hits.some((h: any) => h.id === B.char.id && h.result === 'shielded'), `(b) ${B.callsign}, ${f2(dist(wall, P0))} m from it with a wall between, is alive and not even folded`, `state ${B.state} · stagger ${f2(B.staggerUntil)} (was ${f2(stag0)}) at ${at(wall)}`);
  F.verdict(C.state !== 'dead' && C.staggerUntil < g.time && !rep?.hits.some((h: any) => h.id === C.char.id), `(c) ${C.callsign}, in the open ${f2(dist(far, P0))} m off (past the ${FRAG.woundM} m wound radius), is untouched`, `state ${C.state}`);
  const bangs = g.events.slice(ev0).filter((e: any) => e.kind === 'bang');
  F.verdict(bangs.length === 1 && bangs[0].frag === true && bangs[0].loud === true && bangs[0].who === 1, '(d) one loud bang event, flagged frag, carrying the thrower', JSON.stringify(bangs.map((e: any) => ({ frag: e.frag, loud: e.loud, who: e.who, level: e.level }))));
  F.verdict(R.destr - d0 === 1, '(e) the destruction lane was called exactly once', `${R.destr - d0} call(s)`);
  F.verdict(!g.items.items.some((it: any) => it.kind === 'frag'), '(f) the grenade is gone from the floor', `${g.items.items.filter((it: any) => it.kind === 'frag').length} left`);
  // (g) the floor hears it: with the AI on, a far man who was calm is not calm a second later
  { const R2 = await rig(12); const g2 = R2.game; g2.godMode = true; g2.teleportPlayer([8, 0, 17.6]); R2.step(30);
    const calm = g2.guards.filter((x: any) => x.state === 'patrol'); R2.frag(P0, 0.2); R2.step(90);
    const heard = calm.filter((x: any) => x.state !== 'patrol' || x.awareness > 0.5 || x.state === 'dead');
    F.verdict(calm.length > 0 && heard.length === calm.length, '(g) every calm man on the floor has heard it a second and a half later', `${heard.length}/${calm.length} · ${g2.guards.map((x: any) => `${x.callsign} ${x.state} ${f2(x.awareness)}`).join(', ')}`); }
  // (h) the wound band: only killed / wounded for exposed men, and the same on a second run
  { const run = async () => { const R3 = await rig(13); const g3 = R3.game; g3.aiEnabled = false; g3.godMode = true; g3.teleportPlayer([8, 0, 17.6]); const out: string[] = [];
      for (let k = 0; k < 6; k++) { const q = R3.spot(P0, FRAG.lethalM + 0.6 + k * 0.5, true); if (!q) continue; for (const x of g3.guards) R3.put(x, [60, 0, 60]); const m = g3.guards.find((x: any) => x.state !== 'dead'); if (!m) break; R3.put(m, q);
        const rep3 = blast(g3, [P0[0], 0.05, P0[2]], { who: 0, serial: 100 + k, fx: false }); const h = rep3.hits.find((h: any) => h.id === m.char.id); out.push(`${f2(dist(q, P0))}m ${h ? h.result : 'none'}`); }
      return out; };
    const a = await run(), b = await run();
    F.verdict(a.length >= 3 && a.every(s => /killed|wounded/.test(s)) && a.join() === b.join(), '(h) between the radii an exposed man is killed or folded, nothing else, and a second run rolls the same', a.join(' · ')); }
  return F.done();
});

// ---------------------------------------------------------------- frag-player
export const fragPlayer = guarded(async () => {
  const F = family('frag-player: 5 then a click throws it; the fuse runs from the hand; Sam is not exempt');
  const R = await rig(21); const g = R.game, input = R.input, pl = g.player; g.aiEnabled = false;
  for (const x of g.guards) R.put(x, [60, 0, 60]);
  g.teleportPlayer([12, 0, 17.6]); pl.char.bodyYaw = Math.PI / 2; pl.char.aimYaw = Math.PI / 2; R.step(5);
  F.verdict(KIT_ORDER.length === 5 && KIT_ORDER[4] === 'frag', '(a) the kit is five rows, the frag on 5: no digit above 5', KIT_ORDER.join(' · '));
  const s0 = pl.slot; for (const k of ['Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0']) { input.pressed.add(k); R.step(); }
  F.verdict(pl.slot === s0, '(b) 6‥0 select nothing', `slot ${pl.slot}`);
  // G with the pistol up: a smoke can, never a frag
  { const n0 = pl.frags, c0 = pl.canisters; R.W.cursorAt([18, 0.1, 17.6]); input.keys.add('KeyG'); input.pressed.add('KeyG'); R.step(4); input.keys.delete('KeyG'); R.step(40);
    F.verdict(pl.frags === n0 && pl.canisters === c0 - (QUICKTHROW.on ? 1 : 0), QUICKTHROW.on ? '(c) G quick-throws a smoke can, the frags untouched' : '(c) the G quick throw is off (quickthrow.ts): G throws nothing, the frags untouched', `frags ${n0}→${pl.frags} · smoke ${c0}→${pl.canisters}`); g.items.items.length = 0; }
  input.pressed.add('Digit5'); R.step(2);
  F.verdict(pl.slot === 'frag' && pl.canisterSel === 'frag' && !pl.holstered, '(d) 5 puts the grenade in the fist', `slot ${pl.slot} · ${R.said[R.said.length - 1]}`);
  { const f0 = pl.frags, c0 = pl.canisters + pl.flashbangs; R.W.cursorAt([18, 0.1, 17.6]); input.keys.add('KeyG'); input.pressed.add('KeyG'); R.step(4); input.keys.delete('KeyG'); R.step(45);
    F.verdict(pl.frags === f0 && pl.canisters + pl.flashbangs === c0 - (QUICKTHROW.on ? 1 : 0) && pl.slot === 'frag' && !g.items.items.some((x: any) => x.kind === 'frag'), QUICKTHROW.on ? '(d2) G with the grenade in the fist still throws a can, never the grenade' : '(d2) G with the grenade in the fist throws nothing with the quick throw off: never the grenade', `frags ${f0}→${pl.frags} · cans ${c0}→${pl.canisters + pl.flashbangs} · slot ${pl.slot}`); g.items.items.length = 0; }
  const n0 = pl.frags; const target = [19, 0.1, 17.6]; for (let i = 0; i < 6; i++) { R.W.cursorAt(target); R.step(); }
  F.verdict(!!pl.throwPreview, '(e) the arc is previewed while it is up', pl.throwPreview ? `${pl.throwPreview.points?.length ?? '?'} points` : 'no preview');
  R.W.cursorAt(target); input.buttons |= 1; input.clicked |= 1; R.step(); input.buttons = 0;
  const out = R.until(() => g.items.items.some((it: any) => it.kind === 'frag'), 1.5); const it = g.items.items.find((x: any) => x.kind === 'frag'); const tOut = g.time;
  F.verdict(out && pl.frags === n0 - 1 && it?.who === 1 && Math.abs(it.fuse - FRAG.fuse) < 0.05, '(f) a click throws it: one fewer on the belt, the item in the air with its whole fuse, his', `frags ${n0}→${pl.frags} · fuse ${f2(it?.fuse)} · said ${JSON.stringify(R.said.slice(-2))}`);
  const went = R.until(() => FRAG_LOG.length > 0, FRAG.fuse + 1); const rep = FRAG_LOG[0];
  F.verdict(went && Math.abs((g.time - tOut) - FRAG.fuse) < 0.1 && dist(rep.at, target) < 2.5, `(g) it goes off ${FRAG.fuse}s after leaving the hand, near where it was thrown`, went ? `${f2(g.time - tOut)}s · at ${at(rep.at)} (aimed ${at(target)}) · Sam ${f2(dist(rep.at, pl.char.pos))} m off, ${rep.player ?? 'untouched'}` : 'never went off');
  // a burst that does not put him down STUNS him (FRAG.samStun): no round for the seconds a man there is folded, the frame flashes, his aim is thrown wide
  for (const on of [true, false]) { FRAG.samStun = on; g.godMode = true; pl.fireCd = 0; pl.hitFlash = 0; pl.sup.v = 0; R.said.length = 0;
    input.pressed.add('Digit1'); R.step(2); if (!pl.pistolUp) { input.pressed.add('KeyE'); R.step(); } R.step(50); R.W.cursorAt(target);
    const hits0 = pl.hitsLeft, n0r = pl.pistol.roundsReady, logs0 = FRAG_LOG.length, st0 = FRAG_STATS.samStunned; R.frag([pl.char.pos[0] + 1, 0, pl.char.pos[2]], 0.1); R.until(() => FRAG_LOG.length > logs0, 1);
    const cd = pl.fireCd, flash = pl.hitFlash, sup = pl.sup.v, line = R.said.join(' | ');
    let firedAt = -1; for (let i = 0; i < 300 && firedAt < 0; i++) { R.W.cursorAt(target); input.buttons |= 1; input.clicked |= 1; R.step(); input.buttons = 0; if (pl.pistol.roundsReady < n0r) firedAt = i / 60; }
    if (on) F.verdict(pl.pistolUp && !pl.down && pl.hitsLeft === hits0 && cd > 2.4 && cd <= FRAG.stagger[0] && flash > 0.5 && sup >= 0.9 && /stunned/.test(line) && firedAt > 2.3 && FRAG_STATS.samStunned === st0 + 1,
      '(k) a grenade a metre off under god mode stuns him: up, no hit taken, the frame flashes, aim thrown wide, and a held trigger fires nothing for the seconds a man there is folded',
      `up ${!pl.down} · hits ${hits0}→${pl.hitsLeft} · no round for ${f2(cd)} s (first round after ${f2(firedAt)} s) · flash ${f2(flash)} · suppression ${f2(sup)} · "${line}"`);
    else F.verdict(!pl.down && cd < 0.3 && firedAt >= 0 && firedAt < 0.4 && /fragments past you/.test(line) && FRAG_STATS.samStunned === st0, '(l) FRAG.samStun off: a flinch and the old line, the trigger free at once', `no round for ${f2(cd)} s (first round after ${f2(firedAt)} s) · "${line}"`);
    R.step(120); }
  FRAG.samStun = true;
  // his own grenade at his feet
  { g.godMode = true; const hits0 = pl.hitsLeft; R.frag([pl.char.pos[0] + 1, 0, pl.char.pos[2]], 0.1); R.step(20);
    const safe = !pl.down && pl.hitsLeft === hits0; g.godMode = false; R.frag([pl.char.pos[0] + 1, 0, pl.char.pos[2]], 0.1); R.step(20);
    F.verdict(safe && pl.down, '(h) his own grenade a metre off: nothing in god mode, down without it', `god: ${safe ? 'up' : 'DOWN'} · plain: ${pl.down ? 'down' : 'UP'}`); }
  // a checkpoint keeps the count
  { const R2 = await rig(22); const g2 = R2.game; g2.aiEnabled = false; g2.player.frags = 1; R2.step(5); const s = R2.W.snapshot('frag', true); g2.player.frags = 0; R2.W.restore(s);
    F.verdict(s.player?.frags === 1 && g2.player.frags === 1, '(i) a checkpoint keeps the count', `file ${s.player?.frags} · after load ${g2.player.frags}`);
    const dg = JSON.stringify(digestGame(g2, true)); const R3 = await rig(22); R3.step(5);
    // (the digest leaves the field out while he carries FRAG.issue — the frozen stand, whose digests it must not move; the page's kit card hands him
    //  another count, and there the field is in from the start, naming it)
    const d3 = JSON.stringify(digestGame(R3.game, true)), n3 = R3.game.player.frags;
    F.verdict((n3 === FRAG.issue ? !d3.includes('"frags"') : d3.includes(`"frags":${n3}`)) && dg.includes('"frags":1'), '(j) the digest names the frags only once his count is not the issue (a run without them digests as before)', `fresh, carrying ${n3} of an issue of ${FRAG.issue}: ${d3.includes('"frags"') ? 'field' : 'no field'} · one left: frags 1`); }
  return F.done();
});

// ---------------------------------------------------------------- frag-react
export const fragReact = guarded(async () => {
  const F = family('frag-react: defenders shout and get off a live grenade');
  const { fragFlee } = await import(`${ROOT}/src/game/frag.ts`);
  const AIR = 1.0;
  const PLACES: number[][] = [[22, 0, 17.6], [15, 0, 17.6], [30, 0, 17.6], [8.4, 0, 17], [19.8, 0, 14.6], [34.6, 0, 15.5]];
  const run = async (seed: number, react: boolean, P: number[] = P0) => {
    const R = await rig(seed); const g = R.game; g.godMode = true; if (!react) { FRAG.fleeM = 0; FRAG.seeM = 0; FRAG.hearM = 0; }
    g.teleportPlayer([2, 0, 2]);
    const [A, B, C] = g.guards; const pA = R.spot(P, 2.2, true), pB = pA && R.spot(P, 3.4, true, [pA]), pC = pA && pB && R.spot(P, 2.6, false, [pA, pB]);
    if (!pA || !pB || !pC) return null;
    R.put(A, pA, P); R.put(B, pB, P); R.put(C, pC, P); for (const x of [A, B, C]) { x.state = 'suspicious'; x.awareness = 0.6; x.lastKnown = [P[0], 0, P[2]]; x.reactT = 0; x.hold = true; }   // (hold: the AI's own legs keep them on their marks — whatever moves them is the grenade)
    R.step(2); const a0 = [...A.char.pos], b0 = [...B.char.pos];
    const it = R.frag(P, FRAG.fuse - AIR); it.bounces = 1; const said: string[] = []; let cFled = false;   // (as a throw leaves it: a second of its fuse spent in the air)
    for (let i = 0; i < (FRAG.fuse + 0.5) * 60 && !FRAG_LOG.length; i++) { R.step(); for (const x of [A, B, C]) if (x.bubble && !said.includes(`${x.callsign}: ${x.bubble.text}`)) said.push(`${x.callsign}: ${x.bubble.text}`); if (fragFlee(g, C)?.goal) cFled = true; }
    const moved = Math.min(dist(A.char.pos, a0), dist(B.char.pos, b0));
    const rep = FRAG_LOG[0]; R.step(90);
    return { R, g, A, B, C, said, rep, moved, cFled, down: [A, B].filter(x => x.state === 'dead').length, stats: { ...FRAG_STATS } };
  };
  let on = 0, off = 0, n = 0; const lines: string[] = []; let shout = 0, movedAll = true, wallStays = true;
  for (let k = 0; k < PLACES.length; k++) {
    const P = PLACES[k]; const a = await run(31 + k, true, P), b = await run(31 + k, false, P); if (!a || !b) { lines.push(`${at(P)}: no staging here`); continue; }
    n++; on += a.down; off += b.down; if (a.said.some(s => /grenade/.test(s))) shout++; if (a.moved < 1.0) movedAll = false; if (a.cFled || a.C.state === 'dead') wallStays = false;
    lines.push(`${at(P)}: reacting ${a.down}/2 down (each moved ≥ ${f2(a.moved)} m; ${a.rep?.hits.filter((h: any) => h.team === 'guard').map((h: any) => `${h.name} ${h.result}`).join(', ') || 'nobody touched'}) · not reacting ${b.down}/2 down`);
  }
  F.verdict(n >= 4 && shout === n, '(a) somebody shouts "grenade!" every time', `${shout}/${n}`);
  F.verdict(movedAll, '(b) both men in its line move (over a metre) before it goes', lines.join('\n    '));
  F.verdict(on < off, '(c) fewer of them are down than with the reaction off, same places', `reacting ${on}/${2 * n} down · not reacting ${off}/${2 * n} down`);
  F.verdict(wallStays, '(d) the man with a wall between him and it is never sent anywhere by it, and is never down', wallStays ? 'no leg of a flee script on him on any frame; alive every time' : 'he was sent somewhere, or went down');
  // a blinded man cannot
  { const R = await rig(41); const g = R.game; g.godMode = true; g.teleportPlayer([8, 0, 17.6]); const A = g.guards[0]; const pA = R.spot(P0, 2.2, true)!; R.put(A, pA, P0); A.state = 'alert'; A.awareness = 1; A.dazzledUntil = g.time + 10; A.staggerUntil = g.time + 10; R.step(2);
    const it = R.frag(P0, FRAG.fuse); it.bounces = 1; R.until(() => FRAG_LOG.length > 0, FRAG.fuse + 0.5);
    F.verdict(A.state === 'dead', '(e) a man blind and folded from a stun charge does not get off it', `state ${A.state} · ${f2(dist(A.char.pos, pA))} m moved`); }
  // nobody is left running
  { const a = (await run(37, true))!; const alive = [a.A, a.B, a.C].filter(x => x.state !== 'dead'); a.R.step(1);
    F.verdict(alive.every(x => fragFlee(a.g, x) === null), '(f) once it has gone off nobody is still under its script', `${alive.length} alive checked`); }
  // NOBODY RUNS ONTO IT (FRAG.fleeWise): operatives, their own pace, a grenade that ROLLS — the depot's four stacked on a held room's door (the owner's tape 052901:
  // a defender's grenade came through the door they were stacked on, landed behind the four and rolled two metres on) and two more rolls past the same stack. The rule is set here on
  // either stand (FLEEWISE_BREAK=1 leaves it off: the lines are asked all the same and must fail).
  { const BREAK = process.env.FLEEWISE_BREAK === '1';
    const BT: any = await import('./bang-tally.ts'); const { killGuard } = await import(`${ROOT}/src/game/combat.ts`); const { PACE } = await import(`${ROOT}/src/game/guards.ts`); const { TEAMPACE } = await import(`${ROOT}/src/game/teampace.ts`);
    /** the pace a teammate gets off a grenade at: the squad's cap — or, with teampace.ts on, the flee's own run */
    const fleeTop = () => (TEAMPACE.on && TEAMPACE.own ? Math.max(PACE.max, FRAG.runSpeed) : PACE.max);
    const hush = async <T>(fn: () => T | Promise<T>): Promise<T> => { const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
    /** THE STAGING IS READ OFF THE LEVEL, never written here (the depot's floor is being rebuilt; the tape's own door, `cc`, is not on the new one): the first
     *  held-room door of DOORS the floor has, the stack on the marks the game deals for it, and every roll laid out from the door's own centre, its face (ACROSS:
     *  from the frame toward the side the four stand on) and its wall (ALONG). A roll = [name, metres across / along it leaves the air from, its speed across /
     *  down / along, the fuse left]: in through the doorway at knee height and on behind the stack (the tape's), the same thrown short, and one along the wall
     *  from beyond the stack's end (whichever end has the floor for it). The last flag marks one that does NOT roll (left out of (g)'s shortest roll): there the
     *  first pair is how far in front of the men it lies. */
    const DOORS = ['a_s', 'a_e', 'b_n', 'c_n', 'c_w'];
    const ROLLS: [string, [number, number], [number, number, number], number, boolean?][] = [
      ['through the door, on', [0.5, 0.03], [7.3, -3.5, -0.3], 3.2],
      ['through the door, short', [0.5, 0.03], [3.6, -3.0, 0.5], 3.2],
      ['along the wall past the stack', [1.25, -4.35], [-0.15, -3.0, 6.4], 3.4],
      // … and one AT REST, for (k): on the open floor in front of the pair at one end of the stack (3.7 m in front of them where the floor is that deep, as near as
      // 1.8 m where it is not), the stack's wall at their backs and under two seconds on it. As it was, no spot in their reach beat staying put by the old margin and
      // both got down where they stood, inside lethalM; a leg along the wall takes each toward its edge.
      ['at rest in front of the stack, its wall at their backs', [3.7, 0], [0, 0, 0], 1.9, true],
    ];
    const out: string[] = []; let staged = 0, fled = 0, rolled = 99, nearer = 0, passed = 0, redealt = 0, stood = 0, sprint = 0, worstEnd = 99, worstPass = 99, mostGoals = 0, mostMid = 0;
    for (const [name, off, speed, fuse, atRest] of ROLLS) {
      const S: any = await hush(() => BT.stage('depot-four', 1)); const g = S.g, O = g.orders; FRAG.fleeWise = !BREAK;
      const thrower = g.guards.find((x: any) => x.team === 'hostile')?.char.id ?? 0;
      for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile') await hush(() => killGuard(g, x, [0, 0, 1], true));   // (the room is quiet: whatever moves the four is the grenade)
      const door = DOORS.map(n => g.doors.list.find((d: any) => d.def.name === n)).find(Boolean); if (!door) { out.push(`${name}: none of the doors ${DOORS.join(' ')} on the depot (it has ${g.doors.list.map((d: any) => d.def.name).join(' ')})`); continue; }
      const c: number[] = door.frameCentre, th: number = door.def.closedDir, N = [-Math.sin(th), 0, Math.cos(th)], A = [Math.cos(th), 0, Math.sin(th)];   // (the frame's normal and the wall's run)
      const spot = (across: number, along: number, y = 0) => [c[0] + N[0] * across + A[0] * along, y, c[2] + N[2] * across + A[2] * along];
      const floor = (p: number[]) => !g.col.nav.isBlocked(p[0], p[2]);
      const sam0 = [4, -4, 3, -3, 5, -5, 2.5, -2.5].filter(k => floor(spot(k, 0)) && !g.col.solidBlocked(spot(Math.sign(k) * 0.6, 0, 1), spot(k, 0, 1))).map(k => spot(k, 0))[0];   // (Sam square to the frame, on whichever side has the floor: the order is given from there)
      if (!sam0) { out.push(`${name}: no floor square to door ${door.def.name} for Sam`); continue; }
      g.teleportPlayer(sam0); S.step(5); const no = await hush(() => O.give('stack', O.targetAt(c), 'all')); if (no) { out.push(`${name}: stack on ${door.def.name} refused — ${no}`); continue; }
      await hush(() => S.step(60 * 14));
      const men: any[] = O.squad().filter((x: any) => x.state !== 'dead'); if (men.length < 4 || men.some((m: any) => !O.of(m)?.arrived)) { out.push(`${name}: the stack on ${door.def.name} never formed (${men.length} men)`); continue; }
      // the side the game stood them on, and how far along the wall the stack reaches: the rolls are laid out from these
      const across = (p: number[]) => (p[0] - c[0]) * N[0] + (p[2] - c[2]) * N[2], along = (p: number[]) => (p[0] - c[0]) * A[0] + (p[2] - c[2]) * A[2];
      const side = Math.sign(men.reduce((a: number, m: any) => a + across(m.char.pos), 0)) || 1; if (men.some((m: any) => across(m.char.pos) * side < 0.2)) { out.push(`${name}: the stack on ${door.def.name} is not on one side of it`); continue; }
      const reachA = Math.max(...men.map((m: any) => Math.abs(along(m.char.pos))));   // (the far man of the stack, metres along the wall from the frame)
      // the end a roll along the wall comes from: beyond the last man by what the tape's stack left (2.5 m), from the end that has the floor and a clear run
      const run = (e: number, d: number) => { const p = spot(side * off[0], e * d); return floor(p) && !g.col.solidBlocked(spot(side * off[0], 0, 0.3), [p[0], 0.3, p[2]]); };
      const far = off[1] < -1 ? [[-1, reachA + 2.5], [1, reachA + 2.5], [-1, reachA + 1.2], [1, reachA + 1.2]].find(([e, d]) => run(e, d)) : null;
      if (off[1] < -1 && !far) { out.push(`${name}: no floor along the wall beyond the stack on ${door.def.name}`); continue; }
      // the one at rest lies square in front of the middle of the men on one side of the frame, as far out (up to off[0]) as there is floor in their sight
      let lie: number[] | null = null;
      if (atRest) { const acM = men.reduce((a: number, m: any) => a + Math.abs(across(m.char.pos)), 0) / men.length;
        for (const d of [off[0], 3.2, 2.7, 2.2, 1.8]) { for (const s of [-1, 1]) { const pair = men.filter((m: any) => along(m.char.pos) * s > 0); if (!pair.length) continue;
          const aM = pair.reduce((a: number, m: any) => a + along(m.char.pos), 0) / pair.length, p = spot(side * (acM + d), aM, 0.1);
          if (floor(p) && !g.col.solidBlocked(spot(side * acM, aM, 0.3), [p[0], 0.3, p[2]])) { lie = p; break; } } if (lie) break; }
        if (!lie) { out.push(`${name}: no open floor in front of the stack on ${door.def.name}`); continue; } }
      const e = far ? far[0] : 1, from = lie ?? (far ? spot(side * off[0], e * far[1], 0.9) : spot(side * off[0], off[1], 0.9));
      const vel = [N[0] * side * speed[0] + A[0] * e * speed[2] * (far ? -1 : 1), speed[1], N[2] * side * speed[0] + A[2] * e * speed[2] * (far ? -1 : 1)];   // (from the far end it comes back TOWARD the frame)
      // Sam out of it (the lines are the four's): the first free floor 9 m or more from the frame, looked for on the stack's side and then anywhere square to it
      { const away = [9, 11, 13, 15].flatMap(d => [spot(side * 1.25, d), spot(side * 1.25, -d), spot(side * d, 0), spot(-side * d, 0)]).find(floor); if (away) { g.teleportPlayer(away); S.step(2); } }
      staged++; const n0 = FRAG_LOG.length, fled0 = FRAG_STATS.fled;
      const it = g.items.spawn('frag', from, vel, { fuse, who: thrower });
      const T = men.map((m: any) => ({ m, start: [...m.char.pos] as number[], trail: [] as number[][], leg: [] as boolean[], goals: [] as number[][], /** goals dealt while the last was still being walked to */ mid: 0, onLeg: false, fast: 0 }));
      let rest: number[] = [...it.pos], touch: number[] | null = null; const gren: number[][] = [];
      for (let i = 0; i < (fuse + 0.5) * 60 && FRAG_LOG.length === n0; i++) {
        await hush(() => S.step(1)); if (it.fired) break; rest = [...it.pos]; gren.push(rest); if (!touch && it.bounces > 0) touch = [...it.pos];
        for (const t of T) { const fs = fragFlee(g, t.m), p = t.m.char.pos; t.trail.push([...p]); t.fast = Math.max(t.fast, t.m.speed ?? 0);
          if (fs?.goal && !t.goals.some(q => dist(q, fs.goal) < 0.3)) { t.goals.push([...fs.goal]); if (t.onLeg) t.mid++; }
          t.onLeg = !!fs?.goal && !fs.arrived; t.leg.push(t.onLeg); }
      }
      fled += FRAG_STATS.fled - fled0; if (!atRest) rolled = Math.min(rolled, touch ? dist(touch, rest) : 0);
      /** a straight leg of 1.2 to 3 m from p that free floor allows, never nearer the rest point than p is, not ending where a mate stands, and WORTH A SECOND'S RUN: its end a metre
       *  farther off than p, or outside the lethal radius (a corner 0.3 m farther off is no leg) — the probe's own walk */
      const legOpen = (p: number[], others: number[][]): number[] | null => { const d0 = dist(p, rest);
        for (let k = 0; k < 32; k++) for (const r of [1.2, 2, 3]) { const a = k * Math.PI / 16, q = [p[0] + Math.sin(a) * r, 0, p[2] + Math.cos(a) * r];
          if ((dist(q, rest) < d0 + 1.0 && dist(q, rest) <= FRAG.lethalM) || dist(q, rest) <= d0 + 0.3 || others.some(o => dist(o, q) < 0.7) || g.col.nav.isBlocked(q[0], q[2]) || g.col.solidBlocked([p[0], 0.45, p[2]], [q[0], 0.45, q[2]])) continue;
          let ok = true; for (let s = 0.3; s < r && ok; s += 0.3) { const x = p[0] + Math.sin(a) * s, z = p[2] + Math.cos(a) * s; if (g.col.nav.isBlocked(x, z) || Math.hypot(x - rest[0], z - rest[2]) < d0 - 0.05) ok = false; }
          if (ok) return q; }
        return null; };
      const rows: string[] = [];
      for (const t of T) { const d0 = dist(t.start, rest), end = t.trail[t.trail.length - 1] ?? t.start, d1 = dist(end, rest); let near = d0; for (const p of t.trail) near = Math.min(near, dist(p, rest));
        // …and the floor it had yet to roll over: on a leg, never nearer what was still ahead of the grenade than he was when the leg began (asked inside 1.5 m of it)
        const ahead = (i: number) => { let m = 1.5; for (let j = i; j < gren.length; j++) m = Math.min(m, dist(t.trail[i], gren[j])); return m; };
        let legFrom = -1, legNear = 0; for (let i = 0; i < t.trail.length; i++) if (t.leg[i]) { const a = ahead(i); if (legFrom < 0) legFrom = a; legNear = Math.min(legNear, a - legFrom); }
        const was = t.trail[Math.max(0, t.trail.length - 61)] ?? t.start, still = dist(was, end) < 0.25, open = d1 < FRAG.lethalM && still ? legOpen(end, T.filter(o => o !== t).map(o => o.trail[o.trail.length - 1] ?? o.start)) : null;
        if (d1 < d0 - 0.15) nearer++; if (near < d0 - 0.5 || legNear < -0.5) passed++; const back = t.goals.some((q, i) => i > 0 && dist(q, rest) < dist(t.goals[i - 1], rest) - 0.3); if (t.mid > 1 || back || t.goals.length - t.mid > 3) redealt++; mostMid = Math.max(mostMid, t.mid); if (open) stood++; if (t.fast > fleeTop() + 0.25) sprint++;
        worstEnd = Math.min(worstEnd, d1 - d0); worstPass = Math.min(worstPass, near - d0, legNear); mostGoals = Math.max(mostGoals, t.goals.length);
        rows.push(`${t.m.callsign} ${f1(d0)} → ${f1(d1)} m (nearest ${f1(near)}, ${t.goals.length} goal${t.goals.length === 1 ? '' : 's'}${process.env.FLEE_GOALS === '1' ? ' ' + t.goals.map(q => at(q) + ' ' + f1(dist(q, rest))).join(' > ') : ''}${open ? `, STOOD at ${at(end)} with a leg open to ${at(open)}` : ''})`); }
      out.push(`${name} (door ${door.def.name} at ${at(c)}, the stack ${side > 0 ? 'before' : 'behind'} its face, thrown from ${at(from)}): rolled ${f1(touch ? dist(touch, rest) : 0)} m to ${at(rest)} · ${rows.join(' · ')}`);
    }
    const detail = out.join('\n    ');
    F.verdict(staged === ROLLS.length && fled >= 2 * staged && rolled >= 0.6 && sprint === 0, `(g) CONTROL (the staging and the pace, not the rule: holds under FLEEWISE_BREAK too) — the depot's stack of four, a grenade that rolls on behind it: men get off it at the squad's pace${BREAK ? ' (FLEEWISE_BREAK: the rule left off)' : ''}`, `${staged}/${ROLLS.length} staged · ${fled} men dealt legs · shortest roll after its first touch ${f1(rolled)} m · ${sprint} over the pace ${fleeTop()}\n    ${detail}`);
    F.verdict(staged > 0 && nearer === 0, '(h) CONTROL (it held in these stagings before the rule: holds under FLEEWISE_BREAK too; (i) is the line that asks about the WAY) — nobody ends nearer where it rests than he began', `${nearer} did (worst end − start ${f2(worstEnd)} m; 0.15 m of slack)`);
    F.verdict(staged > 0 && passed === 0, '(i) no leg passes nearer the rest point than he started, nor nearer the floor it has yet to roll over', `${passed} did (worst ${f2(worstPass)} m against his own start; 0.5 m of slack: a body's width and the steering round a mate)`);
    F.verdict(staged > 0 && redealt === 0, '(j) nobody is turned about: at most one new goal while he is on a leg, every goal farther from where it rests than his last', `${redealt} were (most goals ${mostGoals}, most dealt mid-leg ${mostMid}; a goal past his second is one dealt on ARRIVAL at the last with the fuse still running — a straight leg at a time round a corner, three at most)`);
    F.verdict(staged > 0 && stood === 0, '(k) at the burst nobody has stood a second inside the lethal radius with a straight leg open to him that ends a metre farther off or out of it (the grenade at rest in front of the stack is staged for this)', `${stood} did (lethalM ${FRAG.lethalM})`);
  }
  return F.done();
});

// ---------------------------------------------------------------- the squad's order: frag and clear

// ---------------------------------------------------------------- frag-mates: the rest guess flies off loose furniture, and no leg ends in a mate's corner
// (FRAG.restProps / FRAG.fleeApart: they act only with FRAG.fleeWise; all three are raised here on either stand). FRAGMATES_BREAK=1 = the two left off and the
// same lines asked: (a), (b), (b2), (b4) and, on the page's stand, (b5) must fail. FLEELOOK_BREAK=1 = FRAG.fleeLook alone left off: (b7) must fail, and on the page's stand (b8). The stagings are read off the level: the furniture a rolling grenade meets, and the corner the flee itself deals.
export const fragMates = guarded(async () => {
  const BREAK = process.env.FRAGMATES_BREAK === '1';
  const F = family(`frag-mates: where it will rest counts the furniture, and a mate's corner is his${BREAK ? ' (FRAGMATES_BREAK: both rules left off)' : ''}${process.env.FLEELOOK_BREAK === '1' ? ' (FLEELOOK_BREAK: the second look left off)' : ''}`);
  const FR: any = await import(`${ROOT}/src/game/frag.ts`); const J: any = await import(`${ROOT}/src/game/journal.ts`);
  const { fragRestGuess, fleeSpot, fragFlee } = FR;
  const LOOK_BREAK = process.env.FLEELOOK_BREAK === '1';   // (FRAG.fleeLook left off: (b7) and (b8) must fail)
  const set = () => { FRAG.fleeWise = true; FRAG.restProps = !BREAK; FRAG.fleeApart = !BREAK; FRAG.fleeOnto = !BREAK; FRAG.fleeLook = !BREAK && !LOOK_BREAK; };
  // ───────────── (a) a grenade a chair stops is reckoned to rest where it does ─────────────
  { const R = await rig(41), g = R.game; set(); g.godMode = true; g.aiEnabled = false; g.teleportPlayer([2, 0, 2]);
    const rows: string[] = []; let n = 0, worst = 0, tried = 0;
    const guess = (it: any, props: boolean): number[] => { const k = FRAG.restProps; FRAG.restProps = props; try { return fragRestGuess(g, it); } finally { FRAG.restProps = k; } };
    for (const P of [...g.props.props]) {
      if (n >= 4) break;
      for (let d = 0; d < 8 && n < 4; d++) {
        const a = d * Math.PI / 4, from = [P.x - Math.sin(a) * 3, 0.9, P.z - Math.cos(a) * 3];
        if (g.col.nav.isBlocked(from[0], from[2]) || g.col.solidBlocked(from, [P.x, 0.9, P.z])) continue;
        const it = R.frag(from, 3.2); it.pos = [from[0], 0.9, from[2]]; it.vel = [Math.sin(a) * 6.5, -1.5, Math.cos(a) * 6.5]; it.settled = false;
        const walls = guess(it, false), both = guess(it, true), drop = () => { const i = g.items.items.indexOf(it); if (i >= 0) g.items.items.splice(i, 1); };
        if (dist(walls, both) < 1.2) { drop(); continue; }   // (the furniture does not stand in this one's way)
        tried++; const asSet = fragRestGuess(g, it), p0 = [P.x, 0, P.z];
        R.until(() => it.settled || it.fuse < 0.1 || it.fired, 4); const end = [...it.pos]; drop(); R.step(30);
        if (dist(end, walls) < 1.0) continue;   // (it got by the furniture after all: nothing to tell the two guesses apart by)
        n++; worst = Math.max(worst, dist(asSet, end));
        rows.push(`thrown from ${at(from)} at the ${P.def?.kind ?? 'prop'} at ${at(p0)}: lay at ${at(end)} · reckoned at ${at(asSet)}, ${f2(dist(asSet, end))} m off · by the walls alone ${at(walls)}, ${f2(dist(walls, end))} m off`);
        break;
      }
    }
    F.verdict(n >= 2 && worst <= 0.6, '(a) a grenade thrown at loose furniture is reckoned, as it leaves the hand, to rest where it then lies (within 0.6 m; the walls alone put it a metre or more on)', `${n} throws of ${tried} flown · worst ${f2(worst)} m\n    ${rows.join('\n    ')}`);
  }
  // ───────────── (b) the corner the flee would deal him has a mate in it: he is dealt another, and the mate keeps his ─────────────
  { const PLACES: number[][] = [[22, 0, 17.6], [15, 0, 17.6], [30, 0, 17.6], [8.4, 0, 17], [19.8, 0, 14.6], [34.6, 0, 15.5], [26, 0, 17.6], [11, 0, 17.6], [18, 0, 17.6], [33, 0, 17.6], [13, 0, 17.6], [24, 0, 17.6], [28, 0, 17.6]];   // (the last five since FRAG.wallFlee: where it is on, fewer corners stand a burst)
    const rows: string[] = []; let n = 0, inHis = 0, shoved = 0, hurt = 0, noLeg = 0, manHit = 0, listed = 0, fIn = 0, fNone = 0, fOff = 0; const fRows: string[] = [];
    for (let k = 0; k < PLACES.length; k++) {
      const P = PLACES[k], R = await rig(51 + k), g = R.game; set(); g.godMode = true; g.teleportPlayer([2, 0, 2]);
      const [A, M] = g.guards, G = [P[0], 0.05, P[2]], from = [P[0], 0.05 + FRAG.lift, P[2]]; let pA: number[] | null = null, X: number[] | null = null;
      for (const r of [2.6, 3.2, 2.0, 3.8]) { const q = R.spot(P, r, true); if (!q) continue;
        const x = fleeSpot(g, { pos: q }, G, FRAG.runSpeed, FRAG.fuse - 1, Infinity, { path: [], keep: null });
        if (x && exposure(g, from, x, [x[0], 1.65, x[2]]) === 0 && (!FRAG.wallFlee || FR.exposedTo(g, from, x, [x[0], 1.65, x[2]]) === 0) && dist(x, q) > 1.4) { pA = q; X = x; break; } }   // (a corner a standing man is hidden in as the deal reckons it: where FRAG.wallFlee is on, behind a wall the burst will leave)
      if (!pA || !X) { rows.push(`${at(P)}: no corner to run to here`); continue; }
      for (const o of g.guards.slice(2)) R.put(o, [2 + g.guards.indexOf(o) * 0.9, 0, 3.5]);   // (the rest of the shift out of it)
      R.put(A, pA, P); R.put(M, X, P); for (const x of [A, M]) { x.state = 'suspicious'; x.awareness = 0.6; x.lastKnown = [P[0], 0, P[2]]; x.reactT = 0; x.hold = true; }
      R.step(2); const m0 = [...M.char.pos], n0 = FRAG_LOG.length; n++;
      // (the forecast's list, asked before the throw: FR.fleeMates is what a planner hands fleeSpot so that its answer is the deal's)
      const ap = FR.fleeMates(g, A, G), fc = fleeSpot(g, { pos: [...A.char.pos] }, G, FRAG.runSpeed, FRAG.fuse - 1, Infinity, { path: [], keep: null, apart: ap }, A); let first: number[] | null = null;
      if (ap === undefined) fOff++; else { if (ap.stay.some((q: number[]) => dist(q, m0) < 0.1)) listed++; if (!fc) fNone++; else if (dist(fc, m0) < FRAG.fleeApartM) fIn++; }
      const it = R.frag(P, FRAG.fuse - 1); it.bounces = 1; let near = 99, moved = 0, goals = 0, last: any = null, mLeg: number[] | null = null, gap = 99;
      for (let i = 0; i < (FRAG.fuse + 0.5) * 60 && FRAG_LOG.length === n0; i++) { R.step(); const s = fragFlee(g, A)?.goal; if (s && s !== last) { last = s; first ??= [...s]; goals++; near = Math.min(near, dist(s, m0)); } moved = Math.max(moved, dist(M.char.pos, m0)); gap = Math.min(gap, dist(M.char.pos, A.char.pos)); mLeg ??= fragFlee(g, M)?.goal ?? null; }
      const rep = FRAG_LOG[n0], mHit = rep?.hits.find((h: any) => h.id === M.char.id && h.result !== 'shielded' && h.result !== 'stunned');   // (stunned behind cover the burst broke is FRAG.wallStun's doing on the page's stand, whoever's leg came by)
      const aHit = rep?.hits.find((h: any) => h.id === A.char.id && h.result !== 'shielded'); if (aHit) manHit++; if (near < FRAG.fleeApartM) inHis++; if (moved > 0.15) shoved++; if (mHit) hurt++; if (!goals) noLeg++;
      rows.push(`${at(P)}: a man at ${at(pA)}, his mate down at ${at(X)} with no line to it · ${goals ? `dealt ${goals} leg${goals > 1 ? 's' : ''}, the nearest ${f2(near)} m from the mate` : 'dealt no leg'} · the mate moved ${f2(moved)} m${mLeg ? `, dealt a leg of his own to ${at(mLeg)}` : ''}${mHit ? `, ${mHit.result}` : ''} · the two never nearer than ${f2(gap)} m · the man himself ${aHit ? aHit.result : 'untouched'}`);
      fRows.push(`${at(P)}: ${ap === undefined ? 'no list (the rule is off)' : `${ap.stay.length} staying, ${ap.go.length} going`} · forecast ${fc ? `${at(fc)}, ${f2(dist(fc, m0))} m from the mate` : 'no leg'} · the deal's first leg ${first ? `${at(first)}${fc ? `, ${f2(dist(first, fc))} m from the forecast` : ''}` : 'none'}`);
    }
    F.verdict(n >= 4 && inHis === 0 && shoved === 0 && hurt === 0 && noLeg <= 1, `(b) no leg ends within ${FRAG.fleeApartM} m of the mate behind his cover, who is not moved a hand's width (0.15 m), killed or wounded (and the man still gets a leg)`, `${n} stagings · legs into his corner ${inHis} · mates moved over 0.15 m ${shoved} · mates hit ${hurt} · men left with no leg ${noLeg} · for the record, the men themselves hit ${manHit}\n    ${rows.join('\n    ')}`);
    F.verdict(n >= 4 && (FRAG.fleeApart ? listed === n && fIn === 0 && fNone <= 1 : fOff === n), '(b6) the list a forecast asks for before the throw (fleeMates) names the mate behind his cover as staying, and fleeSpot with it deals no leg into his corner (with the rule off it is no list, as the deal passes none: holds under FRAGMATES_BREAK too)', `${n} stagings · the mate listed ${listed} · forecast legs into his corner ${fIn} · no forecast leg ${fNone} · no list ${fOff}\n    ${fRows.join('\n    ')}`);
  }
  // ───────────── (b2) two men in its line and one corner between them: one has it, the other is dealt somewhere else ─────────────
  { const PLACES: number[][] = [[22, 0, 17.6], [15, 0, 17.6], [30, 0, 17.6], [19.8, 0, 14.6], [11, 0, 17.6], [26, 0, 17.6], [8.4, 0, 17], [34.6, 0, 15.5]];
    const rows: string[] = []; let n = 0, both = 0, noLeg = 0;
    for (let k = 0; k < PLACES.length; k++) {
      const P = PLACES[k], R = await rig(81 + k), g = R.game; set(); g.godMode = true; g.teleportPlayer([2, 0, 2]);
      const [A, B] = g.guards, G = [P[0], 0.05, P[2]], from = [P[0], 0.05 + FRAG.lift, P[2]], hid = (x: number[]) => exposure(g, from, x, [x[0], 1.65, x[2]]) === 0;
      const alone = (q: number[]) => fleeSpot(g, { pos: q }, G, FRAG.runSpeed, FRAG.fuse - 1, Infinity, { path: [], keep: null });
      let pA: number[] | null = null, pB: number[] | null = null;
      for (const r of [2.6, 3.2, 2.0, 3.8]) { const q = R.spot(P, r, true); if (!q) continue; const x = alone(q); if (!x || !hid(x) || dist(x, q) < 1.4) continue;
        for (let i = 0; i < 24 && !pB; i++) { const a = i * Math.PI / 6, rr = i < 12 ? 1.0 : 1.4, b = [q[0] + Math.sin(a) * rr, 0, q[2] + Math.cos(a) * rr];
          if (g.col.nav.isBlocked(b[0], b[2]) || g.col.solidBlocked([q[0], 0.9, q[2]], [b[0], 0.9, b[2]]) || exposure(g, from, b, [b[0], 1.65, b[2]]) !== 1) continue;
          const y = alone(b); if (y && hid(y) && dist(y, x) < 0.8) pB = b; }
        if (pB) { pA = q; break; } }
      if (!pA || !pB) { rows.push(`${at(P)}: no two men to one corner here`); continue; }
      for (const o of g.guards.slice(2)) R.put(o, [2 + g.guards.indexOf(o) * 0.9, 0, 3.5]);
      R.put(A, pA, P); R.put(B, pB, P); for (const x of [A, B]) { x.state = 'suspicious'; x.awareness = 0.6; x.lastKnown = [P[0], 0, P[2]]; x.reactT = 0; x.hold = true; }
      R.step(2); const n0 = FRAG_LOG.length; n++; const it = R.frag(P, FRAG.fuse - 1); it.bounces = 1; let gA: number[] | null = null, gB: number[] | null = null;
      for (let i = 0; i < (FRAG.fuse + 0.5) * 60 && FRAG_LOG.length === n0; i++) { R.step(); gA = fragFlee(g, A)?.goal ?? gA; gB = fragFlee(g, B)?.goal ?? gB; }
      const one = !!gA && !!gB && hid(gA) && hid(gB) && dist(gA, gB) < FRAG.fleeApartM && !g.col.solidBlocked([gA[0], 0.45, gA[2]], [gB[0], 0.45, gB[2]]);
      if (one) both++; if (!gA || !gB) noLeg++;
      rows.push(`${at(P)}: men at ${at(pA)} and ${at(pB)} · dealt ${gA ? at(gA) : 'no leg'} and ${gB ? at(gB) : 'no leg'}${gA && gB ? `, ${f2(dist(gA, gB))} m apart` : ''}${one ? ' — one corner' : ''}`);
    }
    F.verdict(n >= 3 && both === 0 && noLeg === 0, `(b2) two men a grenade would send to one corner are dealt spots it has no line to at least ${FRAG.fleeApartM} m apart, or one of them open floor (each still gets a leg)`, `${n} stagings · both to one corner ${both} · a man left with no leg ${noLeg}\n    ${rows.join('\n    ')}`);
  }
  // ───────────── (b3) a man who stands beside mates who are staying still gets off it ─────────────
  { const R = await rig(91), g = R.game; set(); g.aiEnabled = false; let n = 0, lost = 0; const rows: string[] = [];
    for (const P of [[22, 0, 17.6], [15, 0, 17.6], [30, 0, 17.6], [19.8, 0, 14.6], [11, 0, 17.6], [26, 0, 17.6]]) for (const r of [2.0, 2.6, 3.2]) {
      const q = R.spot(P, r, true); if (!q) continue; const G = [P[0], 0.05, P[2]], leg = (stay: number[][]) => fleeSpot(g, { pos: q }, G, FRAG.runSpeed, 2.0, Infinity, { path: [], keep: null, apart: { stay, go: [] } });
      if (!fleeSpot(g, { pos: q }, G, FRAG.runSpeed, 2.0, Infinity, { path: [], keep: null })) continue;
      const d = dist(q, P), ax = (q[0] - P[0]) / d, az = (q[2] - P[2]) / d; n++;   // (mates 0.7 m off him: one either side of his way off it, one before and one behind, one behind alone)
      const none = [[[q[0] - az * 0.7, 0, q[2] + ax * 0.7], [q[0] + az * 0.7, 0, q[2] - ax * 0.7]], [[q[0] + ax * 0.7, 0, q[2] + az * 0.7], [q[0] - ax * 0.7, 0, q[2] - az * 0.7]], [[q[0] + ax * 0.7, 0, q[2] + az * 0.7]]].filter(st => !leg(st)).length;
      if (none) { lost++; rows.push(`${at(P)}, the man at ${at(q)}: no leg in ${none} of 3 layouts`); }
    }
    F.verdict(n >= 12 && lost === 0, '(b3) CONTROL (asked of fleeSpot with the list handed in: holds under FRAGMATES_BREAK too) — a man with staying mates 0.7 m either side of him, before and behind him, or behind him alone is still dealt a leg wherever he had one without them', `${n} stagings · left with no leg ${lost}${rows.length ? '\n    ' + rows.join('\n    ') : ''}`);
  }
  // ───────────── (b4) (b5) the two throws the claims came from, staged without the order: the hand and the velocity its repro run recorded ─────────────
  { const BT: any = await import('./bang-tally.ts'); const P: any = await import(`${ROOT}/src/host/profile.ts`);
    const hush = async <T>(fn: () => T | Promise<T>): Promise<T> => { const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
    const fly = async (scn: string, prep: (g: any, S: any, ours: any[]) => any, pos: number[], vel: number[]) => {
      const S: any = await hush(() => BT.stage(scn, 1)); const g = S.g; set(); const ours: any[] = g.guards.filter((x: any) => x.team === 'operative'); for (const x of ours) x.god = false;
      const who = await hush(() => prep(g, S, ours)); const n0 = FRAG_LOG.length; g.items.spawn('frag', pos, vel, { fuse: 2.4, who: who.char.id });
      const legs = new Map<any, string[]>(), where = new Map<any, number[]>();
      await hush(() => { for (let i = 0; i < 60 * 4 && FRAG_LOG.length === n0; i++) { for (const x of ours) where.set(x, [...x.char.pos]); S.step(1); for (const x of ours) { const s = fragFlee(g, x), k = s ? (s.goal ? at(s.goal) : 'down') : ''; const L = legs.get(x) ?? []; if (k && L[L.length - 1] !== k) { L.push(k); legs.set(x, L); } } } });
      const rep = FRAG_LOG[n0], bad = (rep?.hits ?? []).filter((h: any) => h.team === 'operative' && (h.result === 'killed' || h.result === 'wounded'));
      return { rep, bad, text: `burst ${rep ? at(rep.at) : 'never'} · ${ours.map((x: any) => { const h = rep?.hits.find((q: any) => q.id === x.char.id); return `${x.callsign} ${(legs.get(x) ?? ['no leg']).join(' → ')}, at ${at(where.get(x) ?? x.char.pos)}${h ? ` ${h.result}` : ''}`; }).join(' · ')}` };
    };
    // the barracks, a frag ordered at (33.5, 16.5): the thrower, on his post, was dealt a corner 1.2 m off, 'arrived' 0.27 m short of it and still in its line, and was told to get down there
    { const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
      const r = await fly('barracks-four', (g, _S, ours) => { for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile') killGuard(g, x, [0, 0, 1], true);
        const m = ours.find((x: any) => x.callsign === 'Red Two'); m.char.pos = [38.75, 0, 13.79]; m.char.vel = [0, 0, 0]; m.path = []; m.pathGoal = null; m.speed = 0; m.lastPos = [38.75, 0, 13.79]; return m; }, [38.44, 1.19, 13.95], [-6.66, 0.52, 3.44]);
      F.verdict(!!r.rep && r.bad.length === 0, '(b4) the barracks throw: the thrower comes onto the corner he was dealt and nobody of ours is killed or wounded (their god mode off)', r.text); }
    // the depot, a frag ordered at (7.5, 14.5) with the team coming after Sam: a man ducked to a corner 0.82 m from a mate who was down behind cover on fall in; the mate's own order walked him off his spot and into its line
    if (P.harnessProfile() !== 'shipped') F.verdict(true, '(b5) the depot throw: NOT ASKED on this stand (the team does not come after Sam from the start here, and nobody is moved either way)', 'asked under TPS_PROFILE=shipped');
    else { let bad = 0; const rows: string[] = [];
      // (the two moments are places on the walk the claim's run recorded — the orders' own pace; teampace.ts's slower walk is held off for them)
      const { TEAMPACE } = await import(`${ROOT}/src/game/teampace.ts`); const pace0 = TEAMPACE.on;
      for (const wait of [50, 60]) { const r = await fly('depot-four', (g, S, ours) => { TEAMPACE.on = false; g.teleportPlayer([3.5, 0, 10.5]); S.step(wait); return ours.find((x: any) => x.callsign === 'Blue One'); }, [2.71, 1.14, 15.40], [7.37, -0.20, -1.38]); TEAMPACE.on = pace0; bad += r.rep ? r.bad.length : 1; rows.push(`${f2(wait / 60)} s after Sam moved: ${r.text}`); }
      F.verdict(bad === 0, '(b5) the depot throw, at two moments of the team\'s walk: nobody of ours is killed or wounded (their god mode off)', rows.join('\n    ')); }
    // (b7) (b8) FRAG.fleeLook — A SECOND LOOK BEFORE A MAN SETTLES FOR OPEN FLOOR. The same throw, found by sweeping it over the walk: the thrower 5 m from where
    //      it would rest, a mate staying between him and the nearest cover, every covered spot the ring walk asked that mate's — dealt open floor 7.5 m off it
    //      and wounded there. (b7), either stand: the four and Sam stood by hand where that deal found them, and the deal asked with the key off and on.
    //      (b8), the page's stand: the throw at ten moments of the walk at the page's pace, counted. FLEELOOK_BREAK=1 = the key left off: both must fail.
    { const { PACE } = await import(`${ROOT}/src/game/guards.ts`); const S: any = await hush(() => BT.stage('depot-four', 1)); const g = S.g; set(); const sam0 = FRAG.fleeSam; FRAG.fleeSam = true; g.aiEnabled = false;
      const ours: any[] = g.guards.filter((x: any) => x.team === 'operative'), PUT: Record<string, number[]> = { 'Red One': [2.20, 0, 11.80], 'Red Two': [2.20, 0, 10.60], 'Blue One': [2.40, 0, 15.31], 'Blue Two': [2.29, 0, 16.52] };
      const place = () => { for (const x of ours) { const p = PUT[x.callsign]; if (!p) continue; x.char.pos = [...p]; x.char.vel = [0, 0, 0]; x.path = []; x.pathGoal = null; x.speed = 0; x.lastPos = [...p]; } };
      await hush(() => { g.teleportPlayer([3.46, 0, 10.50]); place(); S.step(2); place(); });
      const A = ours.find((x: any) => x.callsign === 'Blue One'), G = [7.40, 0.05, 14.52], from = [G[0], G[1] + FRAG.lift, G[2]], ap = FR.fleeMates(g, A, G);
      const ask = (on: boolean) => { FRAG.fleeLook = on; return fleeSpot(g, { pos: [...A.char.pos] }, G, FRAG.runSpeed, 2.3, PACE.accel, { path: [], keep: null, apart: ap }, A); };
      const off = ask(false), on = ask(!LOOK_BREAK), open = (p: number[] | null) => !p || exposedTo(g, from, p, [p[0], 1.15, p[2]]) > 0;
      const segD = (a: number[], b: number[], q: number[]) => { const dx = b[0] - a[0], dz = b[2] - a[2], L = dx * dx + dz * dz, t = L > 1e-6 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[2] - a[2]) * dz) / L)) : 0; return Math.hypot(a[0] + dx * t - q[0], a[2] + dz * t - q[2]); };
      const near = on ? Math.min(...(ap?.stay ?? []).map((q: number[]) => Math.min(dist(q, on), segD(A.char.pos, on, q)))) : 0;
      FRAG.fleeSam = sam0; set();
      F.verdict(open(off) && !!on && !open(on) && near >= FRAG.fleeLaneM, '(b7) the thrower with a mate between him and the cover, stood by hand: the ring walk alone deals him open floor (or none); with the second look he is dealt floor the burst has no line to, and no nearer a staying mate than a leg may pass',
        `key off → ${off ? `${at(off)} ${open(off) ? 'in its line' : 'covered'}, ${f2(dist(off, G))} m off it` : 'no spot'} · key on → ${on ? `${at(on)} ${open(on) ? 'in its line' : 'covered'}, ${f2(near)} m from the nearest staying mate` : 'no spot'} · staying: ${(ap?.stay ?? []).map(at).join(' ')}`); }
    if (P.harnessProfile() !== 'shipped') F.verdict(true, '(b8) the depot throw at ten moments of the walk: NOT ASKED on this stand (as (b5))', 'asked under TPS_PROFILE=shipped');
    else { let hurt = 0; const rows: string[] = [], MOST = 1;
      for (let wait = 20; wait <= 155; wait += 15) { const r = await fly('depot-four', (g, S, ours) => { g.teleportPlayer([3.5, 0, 10.5]); S.step(wait); return ours.find((x: any) => x.callsign === 'Blue One'); }, [2.71, 1.14, 15.40], [7.37, -0.20, -1.38]); const n = r.rep ? r.bad.length : 1; if (n) { hurt++; rows.push(`${f2(wait / 60)} s after Sam moved: ${r.text}`); } }
      F.verdict(hurt <= MOST, `(b8) the depot throw at ten moments of the walk, the team at the page\'s pace: one of ours killed or wounded at no more than ${MOST} of them (4 of the ten with the key off)`, `${hurt} of 10${rows.length ? `\n    ${rows.join('\n    ')}` : ''}`); }
    { const g = (await rig(63)).game, was = FRAG.fleeLook; FRAG.fleeLook = true; const old = J.knobsSnapshot(g), own = J.knobsSnapshot(g); delete old.tables.FRAG.fleeLook; J.applyKnobs(g, old); const without = FRAG.fleeLook; FRAG.fleeLook = false; J.applyKnobs(g, own); const withIt = FRAG.fleeLook; FRAG.fleeLook = was;
      F.verdict(without === false && withIt === true && P.FROZEN_HOLDS['FRAG.fleeLook'] === 'TPS_FLEEMATES=1', '(b8) … a recording from before the key replays with it off, one that carries it on plays with it on; FROZEN_HOLDS carries its row under the flee mends\' word', `applyKnobs with no key → ${without} · with it on → ${withIt} · row ${P.FROZEN_HOLDS['FRAG.fleeLook']}`); }
  }
  // ───────────── (c) a recording from before the keys replays with them off ─────────────
  { const R = await rig(61), g = R.game; FRAG.restProps = true; FRAG.fleeApart = true; FRAG.fleeOnto = true;
    const old = J.knobsSnapshot(g), own = J.knobsSnapshot(g); delete old.tables.FRAG.restProps; delete old.tables.FRAG.fleeApart; delete old.tables.FRAG.fleeOnto;
    J.applyKnobs(g, old); const without = [FRAG.restProps, FRAG.fleeApart, FRAG.fleeOnto].join(); FRAG.restProps = false; FRAG.fleeApart = false; FRAG.fleeOnto = false; J.applyKnobs(g, own); const withIt = [FRAG.restProps, FRAG.fleeApart, FRAG.fleeOnto].join();
    F.verdict(without === 'false,false,false' && withIt === 'true,true,true', '(c) a recording from before the three keys replays with all off, one that carries them with them as recorded', `without the keys ${without} · with them ${withIt}`);
  }
  // ───────────── (d) the two stands ─────────────
  { await rig(95); const P: any = await import(`${ROOT}/src/host/profile.ts`), word = process.env.TPS_FLEEMATES, shipped = P.harnessProfile() === 'shipped', want = word !== undefined ? word === '1' : shipped;
    F.verdict(FRAG.restProps === want && FRAG.fleeApart === want && FRAG.fleeOnto === want && FRAG.fleeLook === want && P.FROZEN_HOLDS['FRAG.fleeOnto'] === 'TPS_FLEEMATES=1' && P.FROZEN_HOLDS['FRAG.restProps'] === 'TPS_FLEEMATES=1' && P.FROZEN_HOLDS['FRAG.fleeApart'] === 'TPS_FLEEMATES=1' && P.STAND_ENV.includes('TPS_FLEEMATES'),
      `(d) the stand: ${want ? 'all on, as the page opens' : 'all held off, as every frozen digest was recorded'}; the two stands' list carries their word`, `restProps ${FRAG.restProps} · fleeApart ${FRAG.fleeApart} · fleeOnto ${FRAG.fleeOnto} · fleeLook ${FRAG.fleeLook} · word ${word ?? 'none'} · ${shipped ? 'shipped' : 'frozen'}`);
  }
  return F.done();
});

const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const DT_DEFAULTS = JSON.parse(JSON.stringify(DOORTOOLS)), RC_DEFAULTS = { ...ROOMCLEAR };
const SAM: Record<string, number[]> = { breakroom_w: [25.0, 0, 18.9], manager: [24.0, 0, 11.2], storage: [30.8, 0, 11.2] };
const inBounds = (b: { x0: number; x1: number; z0: number; z1: number }, p: number[], m = 0) => p[0] > b.x0 - m && p[0] < b.x1 + m && p[2] > b.z0 - m && p[2] < b.z1 + m;

/** the room clear staged under a seed (the pair and a held floor), Sam by `door` in god mode and dark */
async function orderRig(seed: number, door: string) {
  Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS);
  const R0 = await rig(seed); const { W, game, input } = R0; game.godMode = true;
  const RC = game.roomClear, NB = game.nightBreach, O = game.orders, D = game.doorTools; const why = RC.start(seed);
  const seen = new Set<any>(); const bangs: any[] = []; const downs: { who: any; t: number }[] = [];
  const R = { ...R0, RC, NB, O, D, why, bangs, downs, t0: 0,
    get ops(): any[] { return NB.ops; }, get hostiles(): any[] { return NB.hostiles; },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; const was = game.guards.map((x: any) => [x, x.state] as const); W.step(DT);
      for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind === 'bang') bangs.push({ t: e.time, pos: [...e.pos], frag: !!e.frag, who: e.who }); }
      for (const [x, st] of was) if (st !== 'dead' && x.state === 'dead') downs.push({ who: x, t: game.time }); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(name: string): any { return game.doors.list.find((d: any) => d.def.name === name); },
    give(id: string, name: string): string | null { return O.give(id, O.targetAt(R.door(name).frameCentre)); },
    room(id: string) { return RC.rooms.find((r: any) => r.def.id === id); },
    beats(op: any): string { return (op?.beats ?? []).map((b: any) => `${f2(b.t - R.t0)} ${b.what}`).join(' | '); },
    /** X on p: the menu's first page, then its door tools' page, as rows of key + text (left up on the tools' page) */
    toolsPage(p: number[]) { W.cursorAt([p[0], p[1], p[2]]); input.pressed.add(ORDERS.key); R.step(); R.step(24);
      const opener = O.menu?.rows.find((r: any) => r.opens); if (!opener) return null; const first = (O.hud().menu?.rows ?? []).slice(1).map((r: any) => `${r.opts[0]?.key} ${r.opts[0]?.text}`);
      input.pressed.add(`Digit${opener.key}`); R.step(); R.step(4);
      const rows = (O.hud().menu?.rows ?? []).slice(1).filter((r: any) => r.kind !== 'cancel').map((r: any) => ({ key: r.opts[0]?.key as string, text: r.opts[0]?.text as string, off: !!r.off }));
      return { first, rows, ids: O.menu?.rows.map((r: any) => r.id).join(' ') }; },
  };
  R.step(30); game.teleportPlayer(SAM[door]); R.step(5); R.t0 = game.time;
  return R;
}
const guardedOrder = (fn: () => Promise<boolean>) => guarded(async () => { try { return await fn(); } finally { Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); } });

// ================================================================ frag-wallflee: a wall the burst will open is no cover
// (FRAG.wallFlee: `exposedTo` asks the destruction engine which walls and cover the burst would open — Destruction.wallsFor — and reads the man's line with
// them open — withWallsOpen). Raised here on either stand, with FRAG.fleeWise and walls that break; WALLFLEE_BREAK=1 = left off and the same lines asked:
// (a) and (b) must fail. The site is read off the level: a whole drywall partition with floor both sides (the wall-stun check's).
export const fragWallFlee = guarded(async () => {
  const BREAK = process.env.WALLFLEE_BREAK === '1';
  const F = family(`frag-wallflee: a wall the burst will open is no cover to a man getting off it${BREAK ? ' (WALLFLEE_BREAK: the rule left off)' : ''}`);
  const FR: any = await import(`${ROOT}/src/game/frag.ts`); const J: any = await import(`${ROOT}/src/game/journal.ts`); const { fragFlee } = FR;
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`); const sw0 = DESTRUCTION.on;   // (the destruction switch and dial are raised here, as the wall-stun check raises them: the row is the same on either stand)
  try {
  type Site = { id: number; c: number[]; n: number[]; thin: number };
  const off = (S: Site, side: 1 | -1, along: number, y = 0): number[] => [S.c[0] + S.n[0] * side * (S.thin + along), y, S.c[2] + S.n[2] * side * (S.thin + along)];
  const up = async (seed: number) => { DESTRUCTION.on = true; const R = await rig(seed), g = R.game; FRAG.fleeWise = true; FRAG.wallStun = true; FRAG.wallFlee = !BREAK; g.tune.chaos = 0.5; g.tune.wallBreak = true; g.godMode = true; g.teleportPlayer([2, 0, 2]); R.step(10); return R; };
  const find = (g: any): Site | null => {
    for (const B of g.destr.walls.all().filter((B: any) => B.kind === 'wall' && B.surf === 'drywall' && B.open === 0).sort((a: any, b: any) => a.id - b.id)) { const b = B.box, cs = Math.cos(b.yaw), sn = Math.sin(b.yaw), x = b.h[0] < b.h[2]; if (Math.max(b.h[0], b.h[2]) < 1) continue;
      for (const sgn of [1, -1]) { const S: Site = { id: B.id, c: [b.c[0], 0, b.c[2]], n: x ? [cs * sgn, 0, -sn * sgn] : [sn * sgn, 0, cs * sgn], thin: Math.min(b.h[0], b.h[2]) };
        const G = off(S, 1, 0.3, 0.05), from = [G[0], G[1] + FRAG.lift, G[2]], m = off(S, -1, 1.0);
        if (!g.col.nav.isBlocked(G[0], G[2]) && !g.col.nav.isBlocked(m[0], m[2]) && exposure(g, from, m, [m[0], 1.65, m[2]], 'whole') === 0) return S; } }
    return null; };
  const flags = (g: any) => g.col.boxes.map((b: any) => b.flags).join('');
  // ───────────── (a) the man a stride behind the partition: hidden as the walls stand, in its line as the burst will leave them ─────────────
  { const R = await up(71), g = R.game, S = find(g);
    if (!S) F.verdict(false, '(a) a partition with floor both sides', 'none found');
    else { const G = off(S, 1, 0.3, 0.05), from = [G[0], G[1] + FRAG.lift, G[2]], m = off(S, -1, 1.0), head = [m[0], 1.65, m[2]];
      const w0 = [flags(g), g.col.dynamicBoxes.length, g.destr.walls.serial, JSON.stringify(digestGame(g, true))].join('|'), dyn0 = g.col.dynamicBoxes;
      const plain = exposure(g, from, m, head), reck = exposedTo(g, from, m, head), again = exposedTo(g, from, m, head), fc = g.destr.wallsFor(from, { radius: FRAG.destrM, power: 1 });
      const farD = [5, 4.5, 5.5, 4, 6, 6.5, 7].find(a => { const q = off(S, 1, a, 0.05); return !g.col.nav.isBlocked(q[0], q[2]) && !g.destr.wallsFor([q[0], q[1] + FRAG.lift, q[2]], { radius: FRAG.destrM, power: 1 }).length; }) ?? 5, farG = off(S, 1, farD, 0.05), farFrom = [farG[0], farG[1] + FRAG.lift, farG[2]], farFc = g.destr.wallsFor(farFrom, { radius: FRAG.destrM, power: 1 }).length, farPlain = exposure(g, farFrom, m, head), farReck = exposedTo(g, farFrom, m, head);
      const same = [flags(g), g.col.dynamicBoxes.length, g.destr.walls.serial, JSON.stringify(digestGame(g, true))].join('|') === w0 && g.col.dynamicBoxes === dyn0;
      const rep = blast(g, G, { who: 0, name: 'frag grenade', destr: { radius: FRAG.destrM, power: 1 } }), after = exposure(g, from, m, head, 'whole');
      F.verdict(plain === 0 && reck > 0 && again === reck && fc.some((w: any) => w.id === S.id), '(a) a man a stride behind a partition, a grenade lying a hand off its other face: hidden as the wall stands, reckoned in its line (the burst will open that wall)',
        `wall ${S.id} at ${at(S.c)} · as it stands ${plain} · reckoned ${reck} · the plan lists ${fc.map((w: any) => `#${w.id} ${w.kind} ${w.cells} cells`).join(', ') || 'nothing'} · the same burst then really left him ${after} in its line`);
      F.verdict(same, '(a2) CONTROL — asking changes nothing: every box flag, the moving boxes, the walls\' serial and the run digest as they were', same ? 'unchanged' : 'CHANGED');
      F.verdict(farFc === 0 && farReck === farPlain, '(a3) CONTROL — a grenade whose plan opens nothing: the reckoning is the plain line test', `${f1(farD)} m off its face: the plan lists ${farFc} · as it stands ${farPlain} · reckoned ${farReck}`);
      void rep; } }
  // ───────────── (b) the flee itself: the man behind the partition gets off it ─────────────
  { const R = await up(72), g = R.game, S = find(g);
    if (!S) F.verdict(false, '(b) a partition with floor both sides', 'none found');
    else { const G = off(S, 1, 0.3, 0.05), m = off(S, -1, 1.0), T = g.guards.find((x: any) => x.state !== 'dead' && !x.civ);
      for (const o of g.guards) if (o !== T) R.put(o, [2 + g.guards.indexOf(o) * 0.9, 0, 3.5]);
      R.put(T, m, G); T.state = 'suspicious'; T.awareness = 0.6; T.lastKnown = [G[0], 0, G[2]]; T.reactT = 0; T.hold = true; T.god = false; R.step(2);
      const mate = g.guards.find((x: any) => x !== T && x.state !== 'dead' && !x.civ && x.team === T.team);   // (his own side's grenade, called as it left the hand: through the wall he would not hear the other side's land)
      const n0 = FRAG_LOG.length, it = R.frag(G, FRAG.fuse - 1, mate.char.id); it.bounces = 1; const legs: string[] = []; let where = [...T.char.pos];
      for (let i = 0; i < (FRAG.fuse + 0.5) * 60 && FRAG_LOG.length === n0; i++) { where = [...T.char.pos]; R.step(); const s = fragFlee(g, T), k = s ? (s.goal ? at(s.goal) : 'down') : ''; if (k && legs[legs.length - 1] !== k) legs.push(k); }
      const rep = FRAG_LOG[n0], h = rep?.hits.find((q: any) => q.id === T.char.id), ran = legs.some(k => k !== 'down'), bad = !!h && h.result !== 'shielded';
      F.verdict(!!rep && ran && !bad, '(b) the man behind it, his own side\'s grenade live on the other face: he is dealt a leg off it, and the burst that opens the wall neither folds nor hits him', `${legs.join(' → ') || 'no leg'} · stood at ${at(m)}, was at ${at(where)} at the burst, ${f2(dist(where, G))} m from it · ${h ? `${h.result}${h.behind ? ` (behind ${h.behind})` : ''}, exposed ${h.exposed}` : 'not in the report'}`); } }
  // ───────────── (b2) never a stun traded for a wound: from behind a wall the burst will take, no leg to floor in its plain line ─────────────
  { const R = await up(75), g = R.game, S = find(g);
    if (!S) F.verdict(false, '(b2) a partition with floor both sides', 'none found');
    else if (BREAK) F.verdict(true, '(b2) NOT ASKED with the rule off (a man behind a wall is never dealt a leg then: (b) says so)', 'asked with the rule on');
    else { let n = 0, legs = 0, open = 0, better = 0, flat2 = 0; const rows: string[] = [];
      for (const left of [FRAG.fuse - 1, 0.8]) for (const along of [0.3, 1.2, 2.2]) for (const side of [-1.2, 0, 1.2]) { const G0 = off(S, 1, along, 0.05), G = [G0[0] - S.n[2] * side, 0.05, G0[2] + S.n[0] * side], from = [G[0], G[1] + FRAG.lift, G[2]]; if (g.col.nav.isBlocked(G[0], G[2])) continue;
        for (let k = 0; k < 40; k++) { const a = k * 2.399963, r = 1 + (k % 6) * 0.6, q = [G[0] + Math.sin(a) * r, 0, G[2] + Math.cos(a) * r]; if (g.col.nav.isBlocked(q[0], q[2])) continue;
          const lo = [q[0], 1.15, q[2]]; if (exposure(g, from, q, lo) !== 0 || FR.exposedTo(g, from, q, lo) <= 0) continue;   // (behind something the burst will take, crouched)
          FRAG.wallStun = false; const y = FR.fleeSpot(g, { pos: q }, G, FRAG.runSpeed, left, Infinity, { path: [], keep: null }); FRAG.wallStun = true; if (y && exposure(g, from, y, [y[0], 1.15, y[2]]) > 0) flat2++;   // (for the record: the two kinds of floor the flee knew before)
          n++; const x = FR.fleeSpot(g, { pos: q }, G, FRAG.runSpeed, left, Infinity, { path: [], keep: null }); if (!x) continue; legs++;
          const xl = [x[0], 1.15, x[2]]; if (exposure(g, from, x, xl) > 0) { open++; if (rows.length < 4) rows.push(`grenade ${at(G)}, a man at ${at(q)}: dealt ${at(x)}, in its plain line`); } else if (FR.exposedTo(g, from, x, xl) <= 0) better++; } }
      F.verdict(n >= 12 && open === 0, '(b2) a man behind a wall the burst will take (folded there, not hit: FRAG.wallStun) is never dealt floor in its plain line — a spot it has no line to even then, farther along behind what it takes, or he stays down', `${n} men behind what a burst would take, with ${f1(FRAG.fuse - 1)} s and with 0.8 s left · dealt a leg ${legs} (to a spot it has no line to even with the wall open: ${better}) · stayed down ${n - legs} · dealt floor in its plain line ${open} (with only two kinds of floor known: ${flat2})${rows.length ? '\n    ' + rows.join('\n    ') : ''}`); } }
  // ───────────── (c) a recording from before the key replays with it off ─────────────
  { DESTRUCTION.on = sw0; const R = await rig(73), g = R.game; FRAG.wallFlee = true; const old = J.knobsSnapshot(g), own = J.knobsSnapshot(g); delete old.tables.FRAG.wallFlee;
    J.applyKnobs(g, old); const without = FRAG.wallFlee; FRAG.wallFlee = false; J.applyKnobs(g, own); const withIt = FRAG.wallFlee;
    F.verdict(without === false && withIt === true, '(c) a recording from before the key replays with it off, one that carries it with it as recorded', `without the key ${without} · with it ${withIt}`); }
  // ───────────── (d) the two stands ─────────────
  { await rig(74); const P: any = await import(`${ROOT}/src/host/profile.ts`), word = process.env.TPS_WALLFLEE, shipped = P.harnessProfile() === 'shipped', want = word !== undefined ? word === '1' : shipped;
    F.verdict(FRAG.wallFlee === want && P.FROZEN_HOLDS['FRAG.wallFlee'] === 'TPS_WALLFLEE=1' && P.STAND_ENV.includes('TPS_WALLFLEE'), `(d) the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen digest was recorded'}; the two stands' list carries its word`, `wallFlee ${FRAG.wallFlee} · word ${word ?? 'none'} · ${shipped ? 'shipped' : 'frozen'}`); }
  return F.done();
  } finally { DESTRUCTION.on = sw0; }
});

//   frag-order     the door tools' page keeps its four rows on 1‥4 and gains 'frag and clear · N left' on G at its foot (no digit above 5, nothing held); G with
//                  that page up gives the order and is not Sam's quick-throw; the order runs stacked → opened → 'frag out' → the grenade goes off INSIDE the room
//                  → the first man over the frame line, in that order; one frag is spent; nobody of the team is touched by it; with none left the row is greyed
//                  with its reason; a restart puts the count back
export const fragOrder = guardedOrder(async () => {
  const F = family('frag-order: frag and clear from the door tools, on G');
  const R = await orderRig(7, 'breakroom_w'); const { O, D, game, input } = R; const Wd = R.door('breakroom_w'), room = R.room('breakroom'), pl = game.player;
  if (R.why) { F.verdict(false, 'staging', String(R.why)); return F.done(); }
  // (what the page's stand changes of this probe's premises and the frozen one does not: row 4 is the one order 'clear from outside' — DOORTOOLS.outsidePlain —
  //  and Sam's frags are his kit card's, not FRAG.issue: both are read here, as staged, and held to that)
  const row4 = DOORTOOLS.outsidePlain ? 'clear from outside' : 'work it from the threshold', sam0 = pl.frags;
  const pg = R.toolsPage(Wd.frameCentre); const rows = pg?.rows ?? [];
  const digits = rows.filter((r: any) => /^[0-9]$/.test(r.key)).map((r: any) => `${r.key} ${r.text.split(' · ')[0]}`).join(' | ');
  const fr = rows.find((r: any) => /frag and clear/.test(r.text));
  F.verdict(digits.startsWith(`1 open and clear | 2 bang and clear | 3 breach with a charge | 4 ${row4}`) && !!fr && fr.key === 'G' && fr.text === `frag and clear · ${FRAG.squad} left` && !fr.off && rows.every((r: any) => !/^[6-9]$/.test(r.key)) && rows.indexOf(fr) >= 4,
    '(a) the page: 1‥4 as they were, then G frag and clear · N left at the foot; no digit above 5', rows.map((r: any) => `${r.key} ${r.text}${r.off ? ' (off)' : ''}`).join(' | '));
  F.verdict(!!pg && !pg.first.some((t: string) => /frag/.test(t)), '(b) the first page says nothing of it (the row that opens the page reads as before)', (pg?.first ?? []).join(' | '));
  // G with the page up: the order, not a thrown can
  const cans0 = pl.canisters, bangs0 = pl.flashbangs, frags0 = pl.frags, n0 = D.frags, items0 = game.items.items.length;
  input.keys.add('KeyG'); input.pressed.add('KeyG'); R.step(20); input.keys.delete('KeyG'); R.step(30);   // (the key stays down a third of a second, as a finger's does on the page: the rest of the press is not a quick-throw either)
  const op = D.ops[0];
  F.verdict(!!op && op.kind === 'bangClear' && op.frag === true && D.frags === n0 - 1 && pl.canisters === cans0 && pl.flashbangs === bangs0 && pl.frags === frags0 && !pl.pendingThrow && game.items.items.length === items0 && O.menu === null,
    '(c) G with that page up gives the order (one frag reserved, the menu away) and throws nothing of Sam\'s', `op ${op?.kind}${op?.frag ? ' frag' : ''} · squad frags ${n0}→${D.frags} · Sam smoke ${cans0}→${pl.canisters} frags ${frags0}→${pl.frags} · items ${items0}→${game.items.items.length}`);
  const defs0 = room.defenders.filter((h: any) => h.state !== 'dead').length; let firstIn = NaN; const opsMen = [...R.ops]; let opHurt = '';
  const stag0 = new Map(opsMen.map((m: any) => [m, m.staggerUntil]));
  for (let i = 0; i < 45 * 60 && D.ops.length; i++) { R.step(); if (isNaN(firstIn) && opsMen.some((m: any) => inBounds(room.def.bounds, m.char.pos, -0.3))) firstIn = game.time; }
  const beats = R.beats(op), fb = R.bangs.find(b => b.frag); const order = ['stacked', 'opened|open|kick', 'toss:', 'frag ·'].map(k => (op?.beats ?? []).findIndex((b: any) => new RegExp(k).test(b.what)));
  for (const m of opsMen) if (m.state === 'dead' && R.downs.find(d => d.who === m && fb && Math.abs(d.t - fb.t) < 0.05)) opHurt += `${m.callsign} killed by it; `; else if (fb && m.staggerUntil > (stag0.get(m) ?? -1) && m.staggerUntil - fb.t > 1.1 && m.staggerUntil - fb.t < 3.3) opHurt += `${m.callsign} folded by it; `;
  const rep = FRAG_LOG[0];
  F.verdict(!!fb && inBounds(room.def.bounds, fb.pos, 0) && (op?.beats ?? []).some((b: any) => /^toss:/.test(b.what)) && (op?.beats ?? []).some((b: any) => /^frag · inside/.test(b.what)), '(d) the grenade is thrown through the opened door and goes off inside the room', `${beats}`);
  F.verdict(!!fb && (isNaN(firstIn) || firstIn > fb.t), '(e) nobody of the team is over the frame line before it has gone off', `blast ${f2((fb?.t ?? NaN) - R.t0)} · first man in ${f2(firstIn - R.t0)}`);
  F.verdict(!!rep && !rep.hits.some((h: any) => h.team === 'operative' && h.result !== 'shielded') && rep.player !== 'killed' && !opHurt && FRAG_STATS.own === 0, '(f) nobody of the team is touched by it', rep ? rep.hits.map((h: any) => `${h.name}(${h.team}) ${f2(h.d)}m ${h.result}`).join(', ') + (opHurt ? ` · ${opHurt}` : '') : 'no blast');
  const hit = rep ? rep.hits.filter((h: any) => h.team === 'hostile' && h.result !== 'shielded').length : 0;
  F.verdict(D.frags === n0 - 1 && D.stats.frags === 1, '(g) one frag spent, counted', `squad frags ${D.frags} · stats ${D.stats.frags} · room: ${defs0} defenders, ${hit} killed or folded by it (${rep?.killed} down, ${rep?.wounded} hit)`);
  // none left: greyed with its reason; a restart puts them back
  { D.frags = 0; const pg2 = R.toolsPage(Wd.frameCentre); const r2 = pg2?.rows.find((r: any) => /frag and clear/.test(r.text)); input.pressed.add('Escape'); R.step(); input.pressed.add('Escape'); R.step();
    const w = R.give('fragClear', 'breakroom_w');
    F.verdict(!!r2 && r2.off && /no frags left/.test(r2.text) && /no frags left/.test(w ?? ''), '(h) with none left the row is greyed with its reason and the order refused in the same words', `${r2?.key} ${r2?.text} · give: ${w}`);
    game.restartEncounter(); R.RC.start(7); R.step(10);
    F.verdict(game.doorTools.frags === FRAG.squad && game.player.frags === sam0 && sam0 > 0, '(i) a restart puts the counts back', `squad ${game.doorTools.frags} · Sam ${game.player.frags}`); }
  return F.done();
});

//   frag-own       'a teammate never frags his own': the order on three doors over six seeds each — in every run no man of the team is killed or folded by
//                  the squad's grenade (FRAG_STATS.own stays 0 and no report names an operative), and a teammate stood in the doorway's line when it is thrown
//                  is moved off it before it goes; the order is refused while a teammate is behind the door, and with hostages on the floor
export const fragOwn = guardedOrder(async () => {
  const F = family('frag-own: a teammate never frags his own');
  const lines: string[] = []; let own = 0, runs = 0, blasts = 0, hitRoom = 0;
  for (const door of ['breakroom_w', 'manager', 'storage']) for (const seed of [3, 7, 11, 19, 23, 31]) {
    const R = await orderRig(seed, door); if (R.why) { lines.push(`${door} ${seed}: ${R.why}`); continue; }
    const w = R.give('fragClear', door); if (w) { lines.push(`${door} ${seed}: refused — ${w}`); continue; }
    runs++; R.until(() => R.D.ops.length === 0, 45);
    // A menu order at a locked door the team did not know of halts on it ('found shut': the page's rule, DOORTOOLS.testDoor) and the row given
    // again boots it — what a player does. The grenade is this check's subject, so the row is given that second time.
    if (!FRAG_LOG[0] && /end: found shut/.test(R.beats(R.D.done[R.D.done.length - 1]))) { const w2 = R.give('fragClear', door); if (w2) { lines.push(`${door} ${seed}: refused once found shut — ${w2}`); continue; } R.until(() => R.D.ops.length === 0, 45); }
    const rep = FRAG_LOG[0]; if (!rep) { lines.push(`${door} ${seed}: no blast (${R.beats(R.D.done[R.D.done.length - 1])})`); continue; }
    blasts++; const bad = rep.hits.filter((h: any) => (h.team === 'operative' || h.team === 'player') && h.result !== 'shielded'); own += bad.length + (FRAG_STATS.own > bad.length ? FRAG_STATS.own - bad.length : 0);
    const foes = rep.hits.filter((h: any) => h.team === 'hostile' && h.result !== 'shielded').length; hitRoom += foes;
    lines.push(`${door} ${seed}: ${rep.killed} down ${rep.wounded} hit ${rep.shielded} behind cover${bad.length ? ' · OWN: ' + bad.map((h: any) => `${h.name} ${h.result} ${f2(h.d)}m e${h.exposed}`).join(', ') : ''}`);
  }
  F.verdict(runs >= 12 && blasts === runs, '(a) the order runs and the grenade goes off every time', `${blasts}/${runs} runs`);
  F.verdict(own === 0, '(b) no man of the team (Sam included) is killed or folded by the squad\'s grenade', lines.join('\n    '));
  F.verdict(hitRoom > 0, '(c) and it does reach the room: defenders killed or folded across the runs', `${hitRoom} over ${blasts} blasts`);
  // (b3) FRAG.fleeSam — SAM'S PLACE IS A MATE'S WHO IS STAYING. Found on (b) above, the manager's door: the kicker's leg off the squad's own grenade was dealt
  //      onto the floor Sam stood on, he stalled against him in its line and was killed (or was dealt again with a twentieth of a second to spare: which, was
  //      a matter of when the stack had formed). Staged still, the flee's rules raised on either stand: the spot the deal gives a teammate with Sam elsewhere,
  //      then Sam stood ON that spot and the deal asked again. FLEESAM_BREAK=1 = the rule left off for the second ask: he is dealt the floor Sam stands on.
  { const SB = process.env.FLEESAM_BREAK === '1', FR: any = await import(`${ROOT}/src/game/frag.ts`), rows: string[] = []; let n = 0, listed = 0, onHim = 0, by = 0;
    const R = await orderRig(7, 'manager'), g = R.game; g.aiEnabled = false; FRAG.fleeWise = true; FRAG.fleeApart = true;
    const segD = (a: number[], b: number[], q: number[]) => { const dx = b[0] - a[0], dz = b[2] - a[2], L = dx * dx + dz * dz, t = L > 1e-6 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[2] - a[2]) * dz) / L)) : 0; return Math.hypot(a[0] + dx * t - q[0], a[2] + dz * t - q[2]); };
    const open = (a: number[], b: number[]) => !g.col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]]);
    for (const A of R.ops) for (let k = 0; k < 8 && n < 6; k++) { const ang = k * Math.PI / 4, p = [...A.char.pos], G = [p[0] + Math.sin(ang) * 2.5, 0.05, p[2] + Math.cos(ang) * 2.5];
      if (g.col.nav.isBlocked(G[0], G[2]) || exposedTo(g, [G[0], G[1] + FRAG.lift, G[2]], p, [p[0], 1.6, p[2]]) <= 0) continue;
      g.teleportPlayer([2, 0, 2]); FRAG.fleeSam = false;
      const s0 = FR.fleeSpot(g, { pos: [...p] }, G, FRAG.runSpeed, FRAG.fuse - 1, Infinity, { path: [], keep: null, apart: FR.fleeMates(g, A, G) }, A); if (!s0) continue;
      g.teleportPlayer([s0[0], 0, s0[2]]); FRAG.fleeSam = !SB; const sam = [...g.player.char.pos], d0 = dist(sam, p) - 0.05;
      const ap = FR.fleeMates(g, A, G), s1 = FR.fleeSpot(g, { pos: [...p] }, G, FRAG.runSpeed, FRAG.fuse - 1, Infinity, { path: [], keep: null, apart: ap }, A);
      n++; const isListed = !!ap?.stay.some((q: number[]) => dist(q, sam) < 0.1), on = !!s1 && dist(s1, sam) < Math.min(FRAG.fleeApartM, d0) && open(s1, sam), past = !!s1 && !on && segD(p, s1, sam) < Math.min(FRAG.fleeLaneM, d0) && open(p, sam);
      if (isListed) listed++; if (on) onHim++; if (past) by++;
      rows.push(`${A.callsign} at ${at(p)}, a grenade at ${at(G)}: dealt ${at(s0)} with Sam elsewhere · Sam stood there: ${isListed ? 'his place is listed' : 'HIS PLACE IS NOT LISTED'}, dealt ${s1 ? `${at(s1)}, ${f2(dist(s1, sam))} m from him, the leg ${f2(segD(p, s1, sam))} m by him` : 'no leg (he gets down)'}${on ? ' — ON HIM' : past ? ' — PAST HIS SHOULDER' : ''}`); }
    g.teleportPlayer([2, 0, 2]);
    { const J: any = await import(`${ROOT}/src/game/journal.ts`), P: any = await import(`${ROOT}/src/host/profile.ts`);
      FRAG.fleeSam = true; const old = J.knobsSnapshot(g), own = J.knobsSnapshot(g); delete old.tables.FRAG.fleeSam; J.applyKnobs(g, old); const without = FRAG.fleeSam; FRAG.fleeSam = false; J.applyKnobs(g, own); const withIt = FRAG.fleeSam;
      F.verdict(without === false && withIt === true && P.FROZEN_HOLDS['FRAG.fleeSam'] === 'TPS_FLEEMATES=1', '(b3) … a recording from before the key replays with it off, one that carries it on plays with it on; FROZEN_HOLDS carries its row under the flee mends\' word', `applyKnobs with no key → ${without} · with it on → ${withIt} · row ${P.FROZEN_HOLDS['FRAG.fleeSam']}`); }
    F.verdict(n >= 3 && listed === n && onHim === 0 && by === 0, `(b3) Sam's place is a mate's who is staying: with Sam stood on the spot a teammate's leg off a grenade would end at, the deal lists his place and gives a spot ${FRAG.fleeApartM} m or more from him by a leg ${FRAG.fleeLaneM} m or more off his shoulder, or none${SB ? ' (FLEESAM_BREAK: the rule left off)' : ''}`, `${n} stagings · listed ${listed} · dealt onto him ${onHim} · past his shoulder ${by}\n    ${rows.join('\n    ')}`); }
  // a teammate in the doorway's line when one lands gets off it
  { const R = await orderRig(5, 'breakroom_w'); const g = R.game; const Wd = R.door('breakroom_w'); Wd.latched = false; Wd.angle = 1.4; R.step(5);
    const m = R.ops[0]; const c = Wd.frameCentre; const inside = [c[0] + 3.0, 0, c[2]], P = g.col.nav.isBlocked(inside[0], inside[2]) ? [c[0] - 3.0, 0, c[2]] : inside;
    const s = R.spot(P, 2.4, true); if (!s) F.verdict(false, '(d) staging', 'no open spot by the door');
    else { g.orders.clear(); m.script = null; R.put(m, s, P); R.step(2); const p0 = [...m.char.pos]; const it = R.frag(P, FRAG.orderFuse - 0.6, R.ops[1]?.char.id ?? m.char.id); it.bounces = 1;
      R.until(() => FRAG_LOG.length > 0, 4); const rep = FRAG_LOG[0]; const h = rep?.hits.find((x: any) => x.id === m.char.id);
      F.verdict(dist(m.char.pos, p0) > 0.8 && m.state !== 'dead', '(d) a teammate caught in the open by one of his own side\'s grenades moves off it (at his own pace, never a sprint) and lives — he may still be hit at its edge', `moved ${f2(dist(m.char.pos, p0))} m · ${h ? h.result + ' at ' + f2(h.d) + ' m' : 'out of its reach'} · state ${m.state}`); } }
  // refused with a mate behind the door
  { const R = await orderRig(5, 'breakroom_w'); const room = R.room('breakroom'); const b = room.def.bounds; const m = R.ops[1] ?? R.ops[0]; R.put(m, [(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2]); R.step(2);
    const w = R.O.defs.find((d: any) => d.id === 'fragClear').valid(R.O, R.O.targetAt(R.door('breakroom_w').frameCentre), [R.ops[0]]);   // (the row's own test, for the one man still outside)
    F.verdict(typeof w === 'string' && /behind that door/.test(w), '(e) refused while a teammate is behind that door', `give: ${w}`); }
  // … and when somebody of ours gets into its reach AFTER the order (the door already open): no grenade, the frag back on the belt, and they go in without it
  { const R = await orderRig(7, 'breakroom_w'); const g = R.game; g.godMode = true; const n0 = g.doorTools.frags; const w = R.give('fragClear', 'breakroom_w');
    if (w) F.verdict(false, '(f) staging', `refused — ${w}`);
    else { const op0 = R.D.ops[0]; const room = R.room('breakroom'); const b = room.def.bounds;
      const got = R.until(() => R.D.ops[0]?.phase === 'toss' || R.D.ops.length === 0, 40); if (R.D.ops.length) g.teleportPlayer([(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2]);
      R.until(() => R.D.ops.length === 0, 30); const beats = R.beats(op0 ?? R.D.done[R.D.done.length - 1]);
      F.verdict(got && !FRAG_LOG.length && g.doorTools.frags === n0 && /frag held/.test(beats) && !g.items.items.some((x: any) => x.kind === 'frag'), '(f) Sam in the room by the time of the toss: no grenade thrown, the frag back in the count, and the entry goes on without it', `frags ${n0}→${g.doorTools.frags} · blasts ${FRAG_LOG.length} · ${beats}`); } }
  return F.done();
});

// ---------------------------------------------------------------- the defenders' own frags (FRAG.defenders — frag.ts fragThrowTick)
/** frag-theirs' corridor, staged for another check (gunhand-throw-check.ts): the carrier at its east end, alert on two of the team bunched ten metres west of
 *  him, the rest of his side out of it, nobody hurt by rounds; `carbine` = he is dealt the carbine before anything moves. The caller steps it. */
export async function theirsCorridor(seed: number, carbine: boolean) {
  const { fragCarriers } = await import(`${ROOT}/src/game/frag.ts`);
  const CAR = [27, 0, 17.6], T1 = [17, 0, 17.4], T2 = [17.9, 0, 18.3], SAMP = [16.4, 0, 18.4];
  const d0 = FRAG_DEFAULTS.defenders; FRAG_DEFAULTS.defenders = true; let R!: Awaited<ReturnType<typeof orderRig>>; try { R = await orderRig(seed, 'breakroom_w'); } finally { FRAG_DEFAULTS.defenders = d0; }
  const g = R.game; FRAG.defenders = true; g.godMode = true;
  R.step(2); const deal: any[] = fragCarriers(g); const C = deal[0] ?? R.hostiles[0];
  if (carbine) { if (C.unit) C.carbine = true; else g.tune.carbineGuards = 'all'; }
  for (const h of R.hostiles) if (h !== C) R.put(h, [2 + R.hostiles.indexOf(h) * 1.5, 0, 2]);
  for (const x of [C, ...R.ops]) x.god = true;
  R.put(C, CAR, T1); R.put(R.ops[0], T1, CAR); R.put(R.ops[1], T2, CAR); g.teleportPlayer(SAMP);
  C.state = 'alert'; C.awareness = 1; C.lastKnown = [...T1]; C.lastSeenT = g.time;
  return { R, g, C, restore: () => { Object.assign(FRAG, JSON.parse(JSON.stringify(FRAG_DEFAULTS))); Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); } };
}
/** frag-theirs: a few defenders carry one; a carrier with two of the team bunched in his view shouts, takes his second, and throws it with the whole fuse on;
 *  the team hears the cue and is off it when it goes; a player who moves on the cue lives where one who stands may not; switched off, nobody throws. */
export const fragTheirs = guardedOrder(async () => {
  const F = family("frag-theirs: defenders' own frags — a cue first, a fuse the team can beat");
  const { fragCarriers, fragStepOff, fragMarks, comeDown } = await import(`${ROOT}/src/game/frag.ts`);
  // the corridor: the carrier at its east end, two teammates bunched ten metres west of him, Sam beside them
  // (THE CARRIER IS STAGED ALERT ON THE PAIR — state, awareness and a seen fix at T1, once; every tick after that is his own eyes. The page's stand needs it:
  //  there the team holds its fire while nobody has seen it, and a carrier nobody wakes stood calm for all 14 s ('calm' 1754 frames a seed, 0 of 4 throws,
  //  measured 10-13 on seeds 3, 5, 8, 11). Before the fire hold the same staging failed the other way: two immortal guns pinned him on a hold off the lane, the
  //  room fight wrote his watch point into his fix (roomfight.ts `gd.lastKnown = D.pt`, 0.8 m from his feet) and the thrower answered 'near'. Awake from the
  //  first frame he has two men bunched in his view for defBunchSecs before any of that, on both stands.)
  const CAR = [27, 0, 17.6], T1 = [17, 0, 17.4], T2 = [17.9, 0, 18.3], SAMP = [16.4, 0, 18.4];
  const stage = async (seed: number, on: boolean, samMoves: boolean) => {
    // (the switch as asked BEFORE the game is stood — the rig puts the table back as it was read, and on the page's stand that is ON: a deal made in the rig's own frames stays on the books)
    const d0 = FRAG_DEFAULTS.defenders; FRAG_DEFAULTS.defenders = on; let R!: Awaited<ReturnType<typeof orderRig>>; try { R = await orderRig(seed, 'breakroom_w'); } finally { FRAG_DEFAULTS.defenders = d0; }
    const g = R.game; FRAG.defenders = on; g.godMode = false;
    R.step(2); const deal: any[] = fragCarriers(g); const C = deal[0] ?? R.hostiles[0];
    for (const h of R.hostiles) if (h !== C) R.put(h, [2 + R.hostiles.indexOf(h) * 1.5, 0, 2]);   // (the rest of them out of it)
    for (const x of [C, ...R.ops]) x.god = true;   // (rounds pass through all three: this is about the grenade, not the gunfight round it)
    R.put(C, CAR, T1); R.put(R.ops[0], T1, CAR); R.put(R.ops[1], T2, CAR); g.teleportPlayer(SAMP);
    C.state = 'alert'; C.awareness = 1; C.lastKnown = [...T1]; C.lastSeenT = g.time;
    const said: { t: number; who: string; text: string }[] = []; { const say = g.say.bind(g); g.say = (gd: any, text: string, radio?: boolean) => { said.push({ t: g.time, who: gd.callsign, text }); return say(gd, text, radio); }; }
    const t0 = g.time; let item: any = null, tOut = NaN, fuse0 = NaN, cueT = NaN, markN = 0, samFrom = [...g.player.char.pos];
    const drive = () => { for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) R.input.keys.delete(k);
      const goal = samMoves ? fragStepOff(g) : null; if (!goal) return; const p = g.player.char.pos, dx = goal[0] - p[0], dz = goal[2] - p[2], d = Math.hypot(dx, dz); if (d < 0.2) return;
      const { fwd, right } = R.W.cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827;
      if (a > T) R.input.keys.add('KeyW'); if (a < -T) R.input.keys.add('KeyS'); if (b > T) R.input.keys.add('KeyD'); if (b < -T) R.input.keys.add('KeyA'); R.input.keys.add('ShiftLeft'); };
    for (let i = 0; i < 14 * 60 && !FRAG_LOG.length; i++) {
      drive(); R.step();
      if (!item) { item = g.items.items.find((x: any) => x.kind === 'frag'); if (item) { tOut = g.time; fuse0 = item.fuse + DT; } }
      if (isNaN(cueT) && R.said.some(s => /GRENADE/.test(s))) cueT = g.time; markN = Math.max(markN, fragMarks(g).length);
    }
    const rep = FRAG_LOG[0] ?? null; const shout = said.find(s => s.who === C.callsign && /frag out|grenade out|fire in the hole/.test(s.text));
    const lift = rep ? [rep.at[0], rep.at[1] + FRAG.lift, rep.at[2]] : null;
    const team = R.ops.map((m: any) => ({ who: m.callsign, d: rep ? dist(m.char.pos, rep.at) : NaN, e: lift ? exposure(g, lift, m.char.pos, m.char.bones.head ?? [m.char.pos[0], 1.6, m.char.pos[2]]) : NaN }));
    const pc = g.player.char; const sam = { down: g.player.down, d: rep ? dist(pc.pos, rep.at) : NaN, moved: dist(pc.pos, samFrom) };
    return { R, g, C, deal, said, item, tOut, fuse0, cueT, markN, rep, shout, team, sam, t0, heard: R.said.filter(s => /grenade/i.test(s)), calls: said.filter(s => /grenade!/.test(s.text) && s.who !== C.callsign) };
  };
  const SEEDS = [3, 5, 8, 11];
  let threw = 0, cued = 0, wound = 0, fuseOk = 0, called = 0, clear = 0, of = 0, lived = 0, ownHit = 0, marks = 0; const lines: string[] = [];
  for (const s of SEEDS) {
    const a = await stage(s, true, true); if (!a.item || !a.rep) { lines.push(`seed ${s}: no throw (${a.deal.length} carriers · ${a.C.callsign} ${a.C.state} at (${f1(a.C.char.pos[0])}, ${f1(a.C.char.pos[2])}) · team lit ${a.R.ops.map((m: any) => f2(m.visibility)).join(' / ')} · why not ${JSON.stringify(FRAG_WHY)} · said ${a.said.slice(-3).map(x => x.text).join(' / ')})`); continue; }
    threw++; const lead = a.shout ? a.tOut - a.shout.t : NaN;
    if (a.shout && lead > FRAG.defWind - 0.1) wound++; if (Math.abs(a.fuse0 - FRAG.defFuse) < 0.06) fuseOk++; if (!isNaN(a.cueT) || a.heard.length) cued++; if (a.calls.length) called++; if (a.markN) marks++;
    for (const m of a.team) { of++; if (m.d > FRAG.lethalM || m.e === 0) clear++; }
    if (!a.sam.down) lived++; ownHit += a.rep.hits.filter((h: any) => h.team === 'hostile' && h.result !== 'shielded').length;
    lines.push(`seed ${s}: ${a.C.callsign} "${a.shout?.text ?? '—'}" ${f2(lead)} s before it left his hand · fuse ${f2(a.fuse0)} · burst ${at(a.rep.at)}, ${f2(dist(a.rep.at, T1))} m off the pair's spot, ${f2(dist(a.rep.at, a.C.char.pos))} m from him · team ${a.team.map((m: any) => `${m.who} ${f2(m.d)} m${m.e === 0 ? ' behind cover' : ''}`).join(', ')} · Sam ${a.sam.down ? 'DOWN' : 'up'} at ${f2(a.sam.d)} m (moved ${f2(a.sam.moved)}) · HUD ${JSON.stringify(a.heard)} · mates called: ${a.calls.map(c => c.who).join(', ') || 'nobody'}`);
  }
  F.verdict(threw >= 3, '(a) a carrier with two of the team bunched in his view throws', `${threw}/${SEEDS.length}\n    ${lines.join('\n    ')}`);
  F.verdict(threw > 0 && wound === threw, `(b) he shouts first, and the grenade leaves his hand ${FRAG.defWind} s later`, `${wound}/${threw}`);
  F.verdict(threw > 0 && fuseOk === threw, `(c) with the whole ${FRAG.defFuse} s fuse on it (never cooked)`, `${fuseOk}/${threw}`);
  F.verdict(threw > 0 && cued === threw && marks === threw, '(d) the player is told: a HUD line, and the overlay has the grenade to mark', `HUD line ${cued}/${threw} · marked ${marks}/${threw}`);
  F.verdict(threw > 0 && called === threw, '(e) a teammate calls "grenade!"', `${called}/${threw}`);
  F.verdict(of > 0 && clear === of, '(f) every teammate is outside the lethal ring or behind cover when it goes', `${clear}/${of}`);
  F.verdict(threw > 0 && lived === threw, '(g) a player who moves on the cue is up (no god mode)', `${lived}/${threw}`);
  F.verdict(ownHit === 0, '(h) no thrower fragged his own side', `${ownHit} of theirs hit by their own`);
  // the player who stands still: reported, not judged (the scatter decides how near it falls)
  { let down = 0, n = 0; const ds: string[] = []; for (const s of SEEDS) { const a = await stage(s, true, false); if (!a.rep) continue; n++; if (a.sam.down) down++; ds.push(`${f2(a.sam.d)} m ${a.sam.down ? 'down' : 'up'}`); }
    F.verdict(true, '(i) for the record: a player who stands where he was', `${down}/${n} down — ${ds.join(' · ')}`); }
  // the deal, and the switch
  { const a = await stage(3, true, true), b = await stage(3, true, true); const n = a.R.hostiles.length, want = Math.min(FRAG.defMax, Math.ceil(n / FRAG.defShare));
    F.verdict(a.deal.length === want && a.deal.map((x: any) => x.callsign).join() === b.deal.map((x: any) => x.callsign).join(), `(j) one defender in ${FRAG.defShare} carries one (at most ${FRAG.defMax}), the same men on the same seed`, `${n} defenders · carriers ${a.deal.map((x: any) => x.callsign).join(', ')}`); }
  { let thrown = 0, carriers = 0; for (const s of SEEDS) { const a = await stage(s, false, true); thrown += a.item ? 1 : 0; carriers += a.deal.length; thrown += FRAG_STATS.theirs; }
    F.verdict(thrown === 0 && carriers === 0, '(k) switched off: nobody carries one, nobody throws', `${carriers} carriers · ${thrown} thrown over ${SEEDS.length} stagings`); }
  void comeDown;
  return F.done();
});

// ================================================================ frag-fleedoor: out by the open door
// (FRAG.fleeDoor: a man caught by a grenade with no cover to get behind is dealt the floor's own path out through a doorway that already stands open —
// frag.ts fleeByDoor. Raised here on either stand, with FRAG.fleeWise and the flee's manners; FLEEDOOR_BREAK=1 = left off and the same lines asked: (a) must
// fail. THE STAGING IS READ OFF THE LEVEL, never written here: the first door of the four-man floodlit scenario with a bare room on one side of it — four
// men by the frame, a grenade three metres in, and with the door shut no floor for any of them that it has no line to — and floor beyond it that two of
// them make through the doorway when it stands open.)
export const fragFleeDoor = guarded(async () => {
  const BREAK = process.env.FLEEDOOR_BREAK === '1';
  const F = family(`frag-fleedoor: caught by a grenade with no cover, a man leaves by a doorway that already stands open${BREAK ? ' (FLEEDOOR_BREAK: the rule left off)' : ''}`);
  const FR: any = await import(`${ROOT}/src/game/frag.ts`); const J: any = await import(`${ROOT}/src/game/journal.ts`); const BT: any = await import('./bang-tally.ts');
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`); const { PACE } = await import(`${ROOT}/src/game/guards.ts`); const { TEAMPACE } = await import(`${ROOT}/src/game/teampace.ts`); const { fragFlee, fleeSpot, fleeByDoor } = FR;
  const hush = async <T>(fn: () => T | Promise<T>): Promise<T> => { const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  const { ROOMFIGHT } = await import(`${ROOT}/src/game/roomfight.ts`); const rally0 = ROOMFIGHT.rally;   // (the staging helper puts the rally off: put back at the end)
  try {
  const LEFT = 3.2;
  type Site = { d: any; side: 1 | -1; G: number[]; marks: number[][] };
  const frame = (d: any) => { const fc = d.frameCentre, th = d.def.closedDir; return { fc, u: [Math.cos(th), Math.sin(th)], n: [-Math.sin(th), Math.cos(th)] }; };
  const pt = (d: any, side: number, across: number, along: number, y = 0): number[] => { const { fc, u, n } = frame(d); return [fc[0] + n[0] * side * across + u[0] * along, y, fc[2] + n[1] * side * across + u[1] * along]; };
  const across = (d: any, p: number[]) => { const { fc, n } = frame(d); return (p[0] - fc[0]) * n[0] + (p[2] - fc[2]) * n[1]; };
  const open = (d: any, side: number) => { d.latched = false; d.locked = false; d.angle = 1.5 * side; d.vel = 0; d.quietT = -30; };   // (swung to the grenade's side where the leaf is free to: the harder room to leave)
  const shut = (d: any) => { d.angle = 0; d.vel = 0; d.latched = true; };
  const put = (x: any, p: number[]) => { x.char.pos = [p[0], 0, p[2]]; x.char.vel = [0, 0, 0]; x.path = []; x.pathGoal = null; x.speed = 0; x.lastPos = [p[0], 0, p[2]]; };
  const legOf = () => (PACE.on && !(TEAMPACE.on && TEAMPACE.own) ? Math.min(FRAG.runSpeed, PACE.max) : FRAG.runSpeed),   // (teampace.ts on: a teammate runs from a blast)
    accOf = () => (PACE.on ? PACE.accel : Infinity);
  const lineTo = (g: any, G: number[], p: number[]) => exposedTo(g, [G[0], G[1] + FRAG.lift, G[2]], p, [p[0], 1.15, p[2]]);
  /** the scenario stood up, its defenders out of it but the farthest (the grenade is his), the four where the game put them */
  const up = async () => { const S: any = await hush(() => BT.stage('floodlit-four', 5)); const g = S.g;
    FRAG.fleeWise = true; FRAG.restProps = FRAG.fleeApart = FRAG.fleeOnto = true; FRAG.fleeDoor = !BREAK; fragStatsReset();
    const ours: any[] = g.guards.filter((x: any) => x.team === 'operative' && x.state !== 'dead').slice(0, 4); for (const x of ours) x.god = false;
    const theirs: any[] = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead').sort((a: any, b: any) => dist(b.char.pos, ours[0].char.pos) - dist(a.char.pos, ours[0].char.pos));
    await hush(() => { for (const x of theirs.slice(1)) killGuard(g, x, [0, 0, 1], true); S.step(5); });
    return { S, g, ours, thrower: theirs[0] }; };
  const find = async (S: any, g: any): Promise<Site | null> => {
    for (const d of [...g.doors.list].filter((x: any) => !x.off).sort((a: any, b: any) => (a.def.name < b.def.name ? -1 : 1))) for (const side of [1, -1] as const) {
      const G = pt(d, side, 3.0, 0, 0.05), marks = [pt(d, side, 1.2, 1.0), pt(d, side, 1.2, -1.0), pt(d, side, 2.0, 1.7), pt(d, side, 2.0, -1.7)];
      if ([G, ...marks].some(p => g.col.nav.isBlocked(p[0], p[2])) || marks.some(m => g.col.solidBlocked([G[0], 0.6, G[2]], [m[0], 0.6, m[2]]))) continue;
      const was = [d.angle, d.latched, d.locked, d.vel, d.quietT];
      shut(d); await hush(() => S.step(2));
      const bare = marks.every(m => { const s = fleeSpot(g, { pos: m }, G, legOf(), LEFT, accOf(), { path: [], keep: null }); return !s || lineTo(g, G, s) > 0; });
      let outs = 0; if (bare) { open(d, side); await hush(() => S.step(2)); outs = marks.filter(m => { const r = fleeByDoor(g, { pos: m }, G, legOf(), LEFT, accOf(), { path: [], keep: null }); return r && !r.via && across(d, r.goal) * side < 0; }).length; }
      [d.angle, d.latched, d.locked, d.vel, d.quietT] = was; await hush(() => S.step(2));
      if (bare && outs >= 2) return { d, side, G, marks };
    }
    return null; };
  /** the four on their marks, the grenade down, run to the burst */
  const live = async (state: 'open' | 'shut') => { const { S, g, ours, thrower } = await up(), site = await find(S, g); if (!site) return null;
    const { d, side, G, marks } = site; const place = () => ours.forEach((x, i) => put(x, marks[i]));
    place(); if (state === 'open') open(d, side); else shut(d); await hush(() => S.step(3)); place(); fragStatsReset();
    const n0 = FRAG_LOG.length; g.items.spawn('frag', G, [0, 0, 0], { fuse: LEFT, who: thrower.char.id });
    const where = new Map<any, number[]>(), last = new Map<any, number[]>(ours.map(x => [x, [...x.char.pos]])); let fastest = 0, swung = 0, unlatched = false;
    await hush(() => { for (let i = 0; i < (LEFT + 0.5) * 60 && FRAG_LOG.length === n0; i++) { for (const x of ours) where.set(x, [...x.char.pos]); swung = Math.max(swung, Math.abs(d.angle)); unlatched ||= !d.latched; S.step(1);
      for (const x of ours) if (x.state !== 'dead' && fragFlee(g, x)) { fastest = Math.max(fastest, dist(x.char.pos, last.get(x)!) * 60); } for (const x of ours) last.set(x, [...x.char.pos]); } });
    const rep = FRAG_LOG[n0], rows = ours.map(x => { const p = where.get(x) ?? x.char.pos, h = rep?.hits.find((q: any) => q.id === x.char.id); return { x, p, out: across(d, p) * side < -0.2, hit: !!h && (h.result === 'killed' || h.result === 'wounded'), res: h?.result ?? 'not in it' }; });
    return { site, rep, rows, byDoor: FRAG_STATS.byDoor, out: rows.filter(r => r.out).length, hitOut: rows.filter(r => r.out && r.hit).length, fastest, swung, unlatched,
      text: `door ${d.def.name}, the grenade ${at(G)} · ${rows.map(r => `${r.x.callsign} from ${at(marks[ours.indexOf(r.x)])} to ${at(r.p)}${r.out ? ' (out)' : ''} ${r.res}`).join(' · ')}` }; };
  // ───────────── (a) the door stands open: men leave by it, and the ones who do are out of its line ─────────────
  { const r = await live('open');
    if (!r) F.verdict(false, '(a) a door with a bare room on one side', 'none found on the floor');
    else { const cap = legOf();
      F.verdict(!!r.rep && r.byDoor >= 2 && r.out >= 2 && r.hitOut === 0, '(a) four men by an open door, a grenade three metres into a room with no cover: the way out through the doorway is dealt, at least two men are beyond it at the burst, and none of those is hit', `${r.text} · deals of the way out ${r.byDoor} · beyond the frame at the burst ${r.out} (hit there ${r.hitOut})`);
      F.verdict(r.fastest <= cap + 0.1, '(a2) CONTROL (holds with the rule off) — nobody getting off it moves faster than the flee\'s own pace', `fastest step ${f2(r.fastest)} m/s · the pace ${f2(cap)} m/s`); } }
  // ───────────── (b) the door is shut: nobody is dealt it, and nobody opens it ─────────────
  { const r = await live('shut');
    if (!r) F.verdict(false, '(b) a door with a bare room on one side', 'none found on the floor');
    else F.verdict(!!r.rep && r.byDoor === 0 && r.swung < 0.02 && !r.unlatched, '(b) CONTROL (holds with the rule off) — the same four, the door shut: nobody is dealt a way out by it, and the leaf is on its latch until the burst', `${r.text} · deals of the way out ${r.byDoor} · the leaf swung ${f2(r.swung)} rad before the burst, ${r.unlatched ? 'OFF its latch' : 'on its latch'}`); }
  // ───────────── (c) behind the open leaf: never straight through it ─────────────
  { const { S, g } = await up(), site = await find(S, g);
    if (!site) F.verdict(false, '(c) a door with a bare room on one side', 'none found on the floor');
    else { const { d, side, G, marks } = site; open(d, side); await hush(() => S.step(3));
      const { fc } = frame(d), h = d.def.hinge, ud = d.dir(), W = d.def.width, tip = [h[0] + ud[0] * W, h[1] + ud[1] * W];
      /** the straight line from p to the middle of the doorway runs through the leaf as it stands */
      const behind = (p: number[]) => { const x = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), A = [p[0], p[2]], B = [fc[0], fc[2]]; return x(A, B, h) * x(A, B, tip) < 0 && x(h, tip, A) * x(h, tip, B) < 0; };
      const men = marks.filter(behind), ask = (m: number[], left: number) => fleeByDoor(g, { pos: m }, G, legOf(), left, accOf(), { path: [], keep: null });
      if (!men.length) F.verdict(false, '(c) the staging has a man the open leaf stands in front of', `none: leaf ${f2(d.angle)} rad (the floor has changed: read the site again)`);
      else { const got = men.map(m => ask(m, LEFT)), long = men.map(m => ask(m, 8)); const keep = FRAG.fleeDoorLeaf; FRAG.fleeDoorLeaf = 0; const blind = men.map(m => ask(m, 8)); FRAG.fleeDoorLeaf = keep;
        const say = (r: any) => (r ? `${at(r.goal)}${r.via ? ' (round its end)' : ' STRAIGHT'}` : 'nothing');
        F.verdict([...got, ...long].every(r => !r || (r.via && across(d, r.goal) * side > 0)) && long.some(r => r && r.via) && blind.some(r => r && !r.via), '(c) CONTROL (asked of the pick itself: holds with the rule off) — the men the open leaf stands in front of are never dealt the way straight through it: round the leaf\'s end first, to floor in front of the doorway (one of them at least, with time to spare), or no way out; with the leaf not reckoned the same pick does send one straight through',
          `leaf ${f2(d.angle)} rad · ${men.map((m, i) => `the man at ${at(m)}: ${say(got[i])}, with time to spare ${say(long[i])}, the leaf not reckoned ${say(blind[i])}`).join(' · ')}`); } } }
  // ───────────── (d) a recording from before the key replays with it off ─────────────
  { const R = await rig(81), g = R.game; FRAG.fleeDoor = true; const old = J.knobsSnapshot(g), own = J.knobsSnapshot(g); const carried = 'fleeDoor' in old.tables.FRAG; delete old.tables.FRAG.fleeDoor;
    J.applyKnobs(g, old); const without = FRAG.fleeDoor; FRAG.fleeDoor = false; J.applyKnobs(g, own); const withIt = FRAG.fleeDoor;
    F.verdict(carried && without === false && withIt === true, '(d) a recording from before the key replays with it off, one that carries it with it as recorded', `the journal carries the key ${carried} · without it ${without} · with it ${withIt}`); }
  // ───────────── (e) the two stands ─────────────
  { await rig(82); const P: any = await import(`${ROOT}/src/host/profile.ts`), word = process.env.TPS_FLEEDOOR, shipped = P.harnessProfile() === 'shipped', want = word !== undefined ? word === '1' : shipped;
    F.verdict(FRAG.fleeDoor === want && P.FROZEN_HOLDS['FRAG.fleeDoor'] === 'TPS_FLEEDOOR=1' && P.STAND_ENV.includes('TPS_FLEEDOOR'), `(e) the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen digest was recorded'}; the two stands' list carries its word`, `fleeDoor ${FRAG.fleeDoor} · word ${word ?? 'none'} · ${shipped ? 'shipped' : 'frozen'}`); }
  return F.done();
  } finally { ROOMFIGHT.rally = rally0; }
});
