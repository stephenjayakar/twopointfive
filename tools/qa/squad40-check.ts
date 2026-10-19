// A TEAMMATE FIRES A 40 mm GRENADE ON ORDER (src/game/squad40.ts): X on a spot of floor, G, then 3 = 40 mm there.
//   bun run tools/qa/squad40-check.ts            (also `probes.ts squad40`, and under `squadorders`)
//   TPS_PROFILE=shipped bun run tools/qa/squad40-check.ts      — the same lines on the page's stand: it passes on both (it raises the switch itself)
// PASS / FAIL each, all headless, on squadthrow-check.ts's rig: the room clear on the office with its squad of four, every hostile off the floor unless a
// line wants one, the squad holding. A teammate's card is given its rounds here (the card's own row is the kit screen's: where the pouches table lets a
// teammate carry none, this file raises that one number for the run and puts it back) and the team staged again, as a restart stages it.
// Asked: with every card as issued there is no row, no line on the HUD, and a run digests as it does with the switch off; with a round on a card the
// throw page's third row by KEYS, who fires (the man with the round, never a nearer man without), that he turns to it first and is handed back, the round
// (whose it is, armed, where it goes off), the count, the words, the squad block; a man whose gun is on the spot already fires at once; every refusal,
// with nothing spent; a man of the other side in the line; the switch thrown live; and the row alone changes no digest.
// SQUAD40_BREAK=1 = the order broken in the module and the same lines asked: they must fail.   exit 0 = all hold · 1 = one does not
import { ROOT } from './headless.ts';
import { rig, place, floorAt } from './squadthrow-check.ts';

const S40: any = await import(`${ROOT}/src/game/squad40.ts`);
const ST: any = await import(`${ROOT}/src/game/squadthrow.ts`);
const K: any = await import(`${ROOT}/src/game/kit.ts`);
const HE: any = await import(`${ROOT}/src/game/he40.ts`);
const { FRAG } = await import(`${ROOT}/src/game/frag.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { WEAPONS, Firearm } = await import(`${ROOT}/src/game/weapons.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { SQUAD40, SQUAD40_LOG, SQUAD40_STATS, SHELL_THERE } = S40;
const { SQUADTHROW } = ST;
const { HE40, HE40_LOG } = HE;

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const p2 = (p: number[]) => `(${f1(p[0])}, ${f1(p[2])})`;
interface Row { key: string; text: string; off: boolean }
const show = (rows: Row[]) => rows.map(r => `${r.key || '·'} ${r.text}${r.off ? ' (off)' : ''}`).join(' | ');
const yawTo = (a: number[], b: number[]) => Math.atan2(b[0] - a[0], b[2] - a[2]);

/** the cards as they stood, to put back */
const cards0 = JSON.stringify(K.KIT.members), own0 = K.kitOwn();
const maxOf = () => K.SLOTS.table.items.shells?.max as number[] | undefined, max0 = maxOf()?.slice();
function cardsBack() { K.KIT.members.splice(0, K.KIT.members.length, ...JSON.parse(cards0)); K.kitOwn(own0); const m = maxOf(); if (m && max0) m.splice(0, m.length, ...max0); }
/** teammate i's card carries n rounds (his stun canisters left behind for the pouches), and the team is staged again */
function arm(R: any, counts: Record<number, number>) {
  cardsBack(); K.kitOwn(true);
  for (const [i, n] of Object.entries(counts)) { const m = K.KIT.members[+i]; m.shells = n; m.bangs = 0; const mx = maxOf(); if (mx) mx[+i] = Math.max(mx[+i], n); }
  K.kitStage(R.game, R.team); R.step(3);
}
/** the men by what the order knows of them */
const armed = (R: any) => R.team.filter((m: any) => S40.squad40Of(R.game, m) > 0);
const def = (R: any) => R.O.defs.find((d: any) => d.id === SHELL_THERE);
/** why the row is refused on p for `men` (null: it is live) */
const why = (R: any, p: number[], men = R.team) => { const d = def(R); return d ? R.O.whyNot(d, R.O.targetAt(p), men) as string | null : 'no row'; };
/** floor spots the row is live on, the camera's view of each asked (`far`: at least so far from the man who would fire) */
function spots(R: any, far = 0): number[][] {
  const out: number[][] = [];
  for (let x = 2.25; x <= 38; x += 0.5) for (let z = 2.25; z <= 26; z += 0.5) {
    const t = R.O.targetAt([x, 0, z]); if (t.kind !== 'floor' || dist(t.at, [x, 0, z]) > 0.3) continue;
    if (why(R, t.at) !== null) continue;
    if (far && Math.min(...armed(R).map((m: any) => dist(m.char.pos, t.at))) < far) continue;
    out.push(t.at);
  }
  return out;
}
/** X on p from code, G, the page left up */
const page = (R: any, p: number[]): Row[] => R.pageAt(p);
/** a spot of plain floor a few metres from the player: a floor menu's target */
function anyFloor(R: any): number[] {
  const p = R.game.player.char.pos;
  for (const d of [3, 2, 4, 5]) for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, q = [p[0] + Math.sin(a) * d, 0, p[2] + Math.cos(a) * d], t = R.O.targetAt(q); if (t.kind === 'floor' && !t.thing && dist(t.at, q) < 0.3) return t.at; }
  throw new Error('no plain floor by the player');
}

export async function squad40Check(): Promise<boolean> {
  const BREAK = process.env.SQUAD40_BREAK === '1'; let all = true;
  const kept = { on: SQUAD40.on, st: { ...SQUADTHROW }, frag: FRAG.on, squad: NIGHTBREACH.squad, random: Math.random };
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== squad40: a teammate fires a 40 mm grenade on a floor order${BREAK ? ' (SQUAD40_BREAK: the order broken in the module)' : ''} ===`);
  const guard = async (name: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { verdict(false, `${name}: the line threw`, e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 3).join(' · ') : String(e)); } };
  /** a rig with the throws' page on and this order's switch as asked */
  const stand = async (on: boolean, o: any = {}) => { cardsBack(); HE.he40StatsReset(); SQUAD40.on = on; const R = await rig(7, true, o); SQUAD40.on = on; return R; };   // (the round's log is capped: each stand counts from none)
  try {
    // ───────────── 1 · nothing carried: nothing there, and the run is the run it was ─────────────
    await guard('nothing carried', async () => {
      const run = async (on: boolean) => { const R = await stand(on), out: string[] = []; const rows = page(R, anyFloor(R)); R.esc();
        for (let f = 0; f < 240; f++) { R.step(); if (f % 30 === 0) out.push(JSON.stringify(digestGame(R.game))); }
        return { rows, out: out.join('\n'), has: !!def(R), note: R.notes().some((n: string) => /40 mm/.test(n)), brought: S40.squad40Brought(R.game) }; };
      const a = await run(true), b = await run(false);
      verdict(!a.has && !a.note && a.brought === 0 && a.rows.length === 2 && !a.rows.some((r: Row) => /40 mm/.test(r.text)) && a.out === b.out,
        'every card as issued: no row on the throw page, no line in the squad block, and four seconds of the run digest as with the switch off', `switch on: row ${a.has} · note ${a.note} · brought ${a.brought} · page: ${show(a.rows)} · digests equal ${a.out === b.out} (${a.out.length} chars)`);
    });

    // ───────────── 2 · the row by keys; the man with the round turns, fires, and is handed back ─────────────
    await guard('the row and the shot', async () => {
      const R = await stand(true), { O, game } = R;
      arm(R, { 2: 2 });
      const men = armed(R), who = men[0];
      const others = R.team.filter((m: any) => m !== who);
      verdict(men.length === 1 && S40.squad40Left(game) === 2 && S40.squad40Brought(game) === 2 && R.notes().includes('40 mm 2'),
        'two rounds on one teammate\'s card: the staging puts them on that man alone, and the squad block says so', `armed: ${men.map((m: any) => `${m.callsign} ${S40.squad40Of(game, m)}`).join(', ') || 'nobody'} · left ${S40.squad40Left(game)} · block: ${R.notes().filter((n: string) => /40 mm/.test(n)).join(' | ') || '—'}`);
      if (!who) return;
      // he looks away from every spot, and a man with no round is put nearer each one than he is: the nearest man is not the answer
      const ok = spots(R).filter(at => Math.abs(yawTo(who.char.pos, at) - who.char.aimYaw) > 0.5);
      const spot = ok.find(at => !!floorAt(R, at)) ?? ok[0];
      if (!spot) { verdict(false, 'a spot of floor the man with the rounds has an armed shot to, with nobody of ours in its burst', `none on the office from ${who.callsign} ${p2(who.char.pos)} · Sam ${p2(game.player.char.pos)}`); return; }
      const first = R.menu(spot), opener = first.find((r: Row) => r.text.startsWith('throw'));
      R.press(FRAG.orderKey); R.step(2); const rows: Row[] = R.rows(), row = rows[2];
      verdict(!!opener && / · 40 mm 2( ▸)?$/.test(opener.text) && rows.length === 3 && !!row && row.key === '3' && row.text === '40 mm there · 2 left' && !row.off && !rows.some(r => /^[6-9]$|^0$/.test(r.key)),
        'X on the spot: the throw row names the rounds; G: the page\'s third row is "40 mm there · 2 left" on 3, live, no digit above 5', `first page: ${show(first)} · page: ${show(rows)}`);
      const home = [...who.char.pos], order0 = O.of(who)?.order, log0 = SQUAD40_LOG.length, he0 = HE40_LOG.length, olog0 = O.log.length, lines0 = R.lines.length;
      R.press('Digit3'); R.step(1);
      const turning = O.of(who)?.order === SHELL_THERE, early = SQUAD40_LOG.length > log0, othersKept = others.every((m: any) => O.of(m)?.order !== SHELL_THERE);
      let shell: any = null; const fired = R.until(() => { shell ??= game.shells[0] ?? null; return SQUAD40_LOG.length > log0; }, 4);
      const L = SQUAD40_LOG.at(-1), onIt = fired && Math.abs(Math.atan2(Math.sin(who.char.aimYaw - yawTo(who.char.pos, spot)), Math.cos(who.char.aimYaw - yawTo(who.char.pos, spot)))) < SQUAD40.aimRad + 0.05;
      verdict(turning && !early && othersKept && fired && L.who === who.callsign && L.turned && onIt && !!shell && shell.shooter === who.char,
        'the pick on 3: the man with the rounds — and nobody else — is turned to the spot, and the round leaves HIS launcher only once his gun is on it', `under the row at once ${turning} · fired before he turned ${early} · the others kept their order ${othersKept} · fired ${fired} by ${L?.who ?? '—'} (turned ${L?.turned}) · gun on the spot ${onIt} · the round is his ${!!shell && shell.shooter === who.char}`);
      R.until(() => HE40_LOG.length > he0, 3); const E = HE40_LOG.at(-1);
      const said = R.lines.slice(lines0).some((l: any) => l.who === who.callsign && l.text === 'forty out!'), logged = O.log.slice(olog0).some((r: any) => r.order === SHELL_THERE && r.who[0] === who.callsign);
      verdict(HE40_LOG.length > he0 && E.armed && !!E.report && dist(E.at, spot) <= SQUAD40.nearM && E.flown >= HE40.armM && S40.squad40Left(game) === 1 && S40.squad40Of(game, who) === 1 && said && logged && R.notes().includes(`${who.callsign} · 40 mm out`) && R.notes().includes('40 mm 1'),
        'the round is the launcher\'s own: armed, it bursts by the spot; the count falls by one; he calls it; the order is logged; the squad block names it', `end: armed ${E?.armed} · burst ${!!E?.report} · ${E ? f1(dist(E.at, spot)) : '—'} m from the spot after ${E ? f1(E.flown) : '—'} m · left ${S40.squad40Left(game)} · "forty out!" ${said} · logged ${logged} · block: ${R.notes().filter((n: string) => /40 mm/.test(n)).join(' | ')}`);
      const ours = [...R.team, null].map((m: any) => m ? (m.state === 'dead' || game.time < m.staggerUntil) : game.player.down);
      R.step(90); const back = O.of(who)?.order === order0 && dist(who.char.pos, home) < 0.5;
      verdict(!ours.some(Boolean) && back && R.held === 0, 'nobody of ours is touched by it, he is handed back to the order he had where he stood, and no key was held for any of it', `hurt: ${ours.some(Boolean)} · his order ${order0} → ${O.of(who)?.order}, ${f1(dist(who.char.pos, home))} m from where he stood · keys held ${R.held}`);

      // ───── a man whose gun is on the spot already fires at once ─────
      R.step(Math.ceil(60 * 3));   // (the tube closed again)
      O.of(who).face = yawTo(who.char.pos, spot); O.of(who).watch = [spot[0], 1.2, spot[2]]; R.step(90);   // (his hold now looks that way)
      const log1 = SQUAD40_LOG.length, was = O.of(who)?.order; R.pageAt(spot); R.press('Digit3');
      const now = SQUAD40_LOG.length === log1 + 1, M = SQUAD40_LOG.at(-1);
      verdict(now && !M.turned && O.of(who)?.order === was && S40.squad40Left(game) === 0, 'his gun already on the spot: the round goes on the frame of the pick and he is never taken off his order', `fired on the pick ${now} (turned ${M?.turned}) · his order ${was} → ${O.of(who)?.order} · left ${S40.squad40Left(game)}`);
      R.until(() => HE40_LOG.length > he0 + 1, 3); R.step(30);
      // ───── none left ─────
      const spent = page(R, spot), sr = spent[2], gave = O.give(SHELL_THERE, O.targetAt(spot)); R.esc();
      verdict(!!sr && sr.off && sr.text.startsWith('40 mm there · 0 left') && gave === 'no 40 mm left.' && SQUAD40_LOG.length === log1 + 1, 'both fired: the row stays, greyed, and the order is refused "no 40 mm left."', `row: ${sr ? show([sr]) : '—'} · given from code: ${gave}`);
    });

    // ───────────── 3 · the refusals: nothing fired, nothing spent ─────────────
    await guard('refusals', async () => {
      const R = await stand(true), { O, game } = R;
      arm(R, { 1: 1, 2: 1 });
      const men = armed(R), t0 = S40.squad40Left(game), log0 = SQUAD40_LOG.length;
      const spot = spots(R)[0];
      if (men.length !== 2 || !spot) { verdict(false, 'two men with a round each and a spot the row is live on', `armed ${men.length} · spot ${spot ? p2(spot) : 'none'}`); return; }
      const give = (p: number[], who = R.team) => O.give(SHELL_THERE, O.targetAt(p), undefined, { men: who }) as string | null;
      // too close: a spot with a line, well inside what it arms at
      const m = men[0], p = m.char.pos; let near: number[] | null = null;
      for (let k = 0; k < 24 && !near; k++) { const a = k * Math.PI / 12, q = [p[0] + Math.sin(a) * 5, 0, p[2] + Math.cos(a) * 5], t = O.targetAt(q);
        if (t.kind === 'floor' && dist(t.at, q) < 0.3 && men.every((x: any) => dist(x.char.pos, t.at) < HE40.armM - 1) && !game.col.solidBlocked([p[0], 1.3, p[2]], [t.at[0], 0.2, t.at[2]])) near = t.at; }
      const wNear = near ? why(R, near) : '—', gNear = near ? give(near) : '—';
      verdict(!!near && wNear === 'too close to arm.' && gNear === 'too close to arm.', 'a spot five metres off with a clear line: "too close to arm." — on the row and when given', `spot ${near ? p2(near) : 'none'} · row: ${wNear} · given: ${gNear}`);
      // behind a wall from everybody with a round
      let walled: number[] | null = null;
      for (let x = 2.25; x <= 38 && !walled; x += 1) for (let z = 2.25; z <= 26 && !walled; z += 1) { const t = O.targetAt([x, 0, z]);
        if (t.kind === 'floor' && men.every((x: any) => dist(x.char.pos, t.at) > HE40.armM + 2 && game.col.solidBlocked([x.char.pos[0], 1.3, x.char.pos[2]], [t.at[0], 0.5, t.at[2]]))) walled = t.at; }
      const wWall = walled ? why(R, walled) : '—';
      verdict(!!walled && wWall === 'no shot from here.', 'a spot with a wall between it and every man with a round: "no shot from here." — nobody walks for it', `spot ${walled ? p2(walled) : 'none'} · row: ${wWall}`);
      // the player in its burst, then a teammate, then a civilian
      const sam0 = [...game.player.char.pos], by = (d: number): number[] | null => { for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, q = [spot[0] + Math.sin(a) * d, 0, spot[2] + Math.cos(a) * d], t = O.targetAt(q);
        if (t.kind === 'floor' && dist(t.at, q) < 0.3 && !game.col.solidBlocked([q[0], 1.1, q[2]], [spot[0], 0.9, spot[2]]) && !game.col.solidBlocked([q[0], 0.3, q[2]], [spot[0], 0.4, spot[2]])) return q; } return null; };
      const in4 = by(4);
      if (!in4) { verdict(false, 'floor four metres from the spot with a line to it', `none round ${p2(spot)}`); return; }
      R.sam(in4); const wSam = why(R, spot), gSam = give(spot); R.sam(sam0);
      verdict(wSam === 'you are in it.' && gSam === 'you are in it.', 'the player four metres from where it would burst, with a line: refused "you are in it." — the round is no gentler on him, so it is not sent', `row: ${wSam} · given: ${gSam}`);
      const mate = R.team.find((x: any) => !men.includes(x)), mate0 = [...mate.char.pos]; place(mate, in4); R.step(2);
      const wMate = why(R, spot); place(mate, mate0); R.step(2);
      verdict(wMate === `${mate.callsign} is in it.`, 'a teammate four metres from it: refused by his name — nobody is counted on to duck a round that bursts as it lands', `row: ${wMate}`);
      // the player IN THE LINE, clear of the burst: a spot far enough that a body two metres in front of the tube is outside the reach
      const far = spots(R, FRAG.woundM + SQUAD40.reachSlack + 3.5)[0];
      if (far) {
        const sh = men.slice().sort((a: any, b: any) => dist(a.char.pos, far) - dist(b.char.pos, far)).find((x: any) => why(R, far, [x]) === null)!, q = sh.char.pos, d = dist(q, far);
        const inLine = [q[0] + (far[0] - q[0]) * 2 / d, 0, q[2] + (far[2] - q[2]) * 2 / d];
        R.sam(inLine); const wLine = why(R, far, [sh]); R.sam(sam0);
        verdict(wLine === 'no shot from here.', 'the player stood in the line of the shot, clear of its burst: that man has no shot — a round in flight stops on him', `${sh.callsign} ${p2(q)} → ${p2(far)} (${f1(d)} m) · Sam at ${p2(inLine)} · row for him: ${wLine}`);
      } else console.log('- NOTE — no live spot on the office far enough to stand the player in the line and clear of the burst: that line is not asked here');
      // the men addressed carry none (another man does)
      const wNone = why(R, spot, [mate]);
      verdict(wNone === 'none with them.', 'the order put to a man who carries none while another does: "none with them." — the round is the man\'s whose card brought it', `row for ${mate.callsign}: ${wNone} · the squad has ${S40.squad40Left(game)}`);
      // his sidearm in his hands: no launcher under it
      const one = men.find((x: any) => why(R, spot, [x]) === null);
      if (one) { const gun = one.weapon; one.weapon = new Firearm(WEAPONS.fiveseven); const wGun = why(R, spot, [one]); one.weapon = gun;
        verdict(wGun === 'not ready.' && why(R, spot, [one]) === null, 'the man with the round has his sidearm up: no launcher in his hands, "not ready." — and a shot again with his long gun back', `with the pistol: ${wGun} · with the long gun: ${why(R, spot, [one])}`); }
      // the man with the round is down: his rounds went with him
      const left0 = S40.squad40Left(game); men[1].god = false; killGuard(game, men[1], [0, 0, 1], true); R.step(2);
      verdict(left0 === 2 && S40.squad40Left(game) === 1 && R.notes().includes('40 mm 1'), 'a man down takes his round with him: the count is what the men on their feet carry', `left ${left0} → ${S40.squad40Left(game)} · block: ${R.notes().filter((n: string) => /40 mm/.test(n)).join(' | ')}`);
      verdict(SQUAD40_LOG.length === log0 && S40.squad40Of(game, men[0]) === 1 && t0 === 2 && game.shells.length === 0, 'through every refusal nothing was fired and nothing spent', `fired ${SQUAD40_LOG.length - log0} · ${men[0].callsign} still has ${S40.squad40Of(game, men[0])} · rounds in the air ${game.shells.length}`);
    });

    // ───────────── 4 · a man of the other side in the line: it goes off on him ─────────────
    await guard('a foe in the line', async () => {
      const R = await stand(true, { keep: true }), { O, game } = R;
      arm(R, { 1: 2, 2: 1 });
      const who = armed(R)[0], far = who ? spots(R, HE40.armM + 4) : [];
      const spot = far[0];
      if (!who || !spot || !R.foe) { console.log(`- NOTE — no spot on the office ${HE40.armM + 4} m from the man with the rounds (or no hostile kept): the foe-in-the-line case is not asked here`); return; }
      const p = who.char.pos, d = dist(p, spot), back = 2.5, at = [spot[0] - (spot[0] - p[0]) * back / d, 0, spot[2] - (spot[2] - p[2]) * back / d];
      place(R.foe, at, yawTo(at, p)); R.step(3);
      // one man's round would go off on the hostile with the player in it; the next man's arc is clear to the spot, the player outside it: the next man is asked
      const other = armed(R).find((x: any) => x !== who), ux = (spot[0] - p[0]) / d, uz = (spot[2] - p[2]) / d, sam0 = [...game.player.char.pos]; let asked = false; const tries: string[] = [];
      if (other) for (const side of [1.5, -1.5, 2.5, -2.5, 3.5, -3.5]) { const q = [at[0] - ux * 6.5 - uz * side, 0, at[2] - uz * 6.5 + ux * side], t = O.targetAt(q); if (asked || t.kind !== 'floor' || dist(t.at, q) > 0.3) continue;
        R.sam(q); const w1 = why(R, spot, [who]), w3 = why(R, spot, [other]), w2 = why(R, spot, [who, other]); R.sam(sam0); tries.push(`${p2(q)}: ${w1} / ${w3}`);
        if (w1 === 'you are in it.' && w3 === null) { asked = true; verdict(w2 === null, 'the nearer man\'s round would go off on a hostile with the player in it, the next man\'s is clean: the row is live and the next man is the one asked', `Sam at ${p2(q)} · ${who.callsign} alone: ${w1} · ${other.callsign} alone: ${w3} · both: ${w2}`); } }
      if (!asked) console.log('- NOTE — no place on the office to stand the player in one man\'s burst and out of the next man\'s: the pass-over is not asked here (' + (other ? tries.join(' · ') || 'no floor beside the line' : 'one man armed') + ')');
      R.step(20);
      const w = why(R, spot, [who]), he0 = HE40_LOG.length, log0 = SQUAD40_LOG.length;
      const gave = O.give(SHELL_THERE, O.targetAt(spot), undefined, { men: [who] });
      R.until(() => HE40_LOG.length > he0, 5); const E = HE40_LOG.at(-1), L = SQUAD40_LOG.at(-1);
      verdict(w === null && gave === null && SQUAD40_LOG.length === log0 + 1 && HE40_LOG.length > he0 && E.armed && E.met === 'man' && dist(E.at, at) < 1 && dist(L.burst, at) < 1,
        'a hostile stood in the line, short of the spot and past where it arms: the order is good and the round goes off on HIM', `foe ${p2(at)}, ${f1(dist(p, at))} m out · row: ${w} · given: ${gave} · end: met ${E?.met}, armed ${E?.armed}, ${E ? f1(dist(E.at, at)) : '—'} m from him`);
    });

    // ───────────── 5 · the switch, thrown live; the row alone moves no digest ─────────────
    await guard('the switch', async () => {
      const R = await stand(true), { game } = R;
      arm(R, { 1: 1 });
      const on = !!def(R) && S40.squad40Here(); SQUAD40.on = false; R.step(2);
      const off = !def(R) && !S40.squad40Here() && !R.notes().some((n: string) => /40 mm/.test(n)) && page(R, anyFloor(R)).length === 2; R.esc();
      SQUAD40.on = true; R.step(2); const again = !!def(R) && page(R, anyFloor(R)).length === 3; R.esc();
      verdict(on && off && again, 'the switch thrown off in play: the row and its line are gone from the next frame, the rounds stay on the man; on again: back', `on ${on} · off ${off} · on again ${again} · left ${S40.squad40Left(game)}`);
      const run = async (sw: boolean) => { const Q = await stand(sw); arm(Q, { 1: 1 }); const out: string[] = []; for (let f = 0; f < 240; f++) { Q.step(); if (f % 30 === 0) out.push(JSON.stringify(digestGame(Q.game))); } return { out: out.join('\n'), has: !!def(Q) }; };
      const a = await run(true), b = await run(false);
      verdict(a.has && !b.has && a.out === b.out, 'a round on a card with the switch on and off: the row is there and not there, and with no order given the run digests the same', `row on ${a.has} · row off ${b.has} · digests equal ${a.out === b.out}`);
    });
  } finally {
    cardsBack(); SQUAD40.on = kept.on; Object.assign(SQUADTHROW, kept.st); FRAG.on = kept.frag; NIGHTBREACH.squad = kept.squad; Math.random = kept.random;
  }
  console.log(`    (the order's tally over the run: ${JSON.stringify(SQUAD40_STATS)})`);
  console.log(`=== squad40: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await squad40Check()) ? 0 : 1);
