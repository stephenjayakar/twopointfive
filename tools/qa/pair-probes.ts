// The 'pair' family (game/pairorders.ts — the quiet orders for ONE partner: two person stealth). Headless: the whole Game over the fake device, the room clear
// on the office (placement seed 10) with a squad of one — Blue One — beside Sam, the silent order on (as it ships), PAIR.on raised by the rig.
//
//   pair-menu      X on a defender opens the menu ON HIM: 1 take him · on your mark, 2 watch him, 3 fall in, 4 hold position, 5 take him now — no digit above 5,
//                  nothing held; B gives the first; the floor's 1 is 'move there' loud and 'move there · hold in the dark' silent; a DOOR's menu is the same
//                  rows with the switch on and off; switch off, or a squad of two or four: a defender is no target and no menu lists a row of these
//   pair-wait      'wait here' / 'on me' = hold position (4) / fall in (3), given from a person's menu and from the floor's: obeyed (he stays while Sam walks
//                  off; he comes), each cancels the other and both cancel a take job; with the partner down there is nobody to order (the cue)
//   pair-dark      silent: 1 on lit floor with dark floor beside it → he ends on DARK floor near the point, on a knee, 'set.'; on dark floor → the point
//                  itself; nothing dark in reach → greyed, and given by B refused in his own words, he does not move; behind a locked door → refused;
//                  cancelled by fall in; `darkRefuse` off → he goes and says it is lit; the spot lit under him → 'lit up here.'
//   pair-mark      take him on your mark: given (B on the man), obeyed (round to his back unseen, 'set.', WAITS — the man still unaware — then F: hands, the
//                  man out cold with no round fired and nobody else roused, the partner holding), the mark by Sam's own takedown (two men down on one
//                  beat), F before he is set, cancelled (hold: the job is gone and F is nobody's), refused with a cue (a locked door between; the man
//                  already down; the man already roused) and called off under way with a cue (the man turned on him)
//   pair-now       take him now: no mark — the same job done at once
//   pair-watch     watch him: gun on the man, not one round while the man has not noticed (the silent order's own fire hold switched off for the probe:
//                  this row's alone) — and rounds the moment he has; a plain hold beside it for the contrast
//   pair-identity  the switch on and never used digests the same scripted minute as the switch off, frame for frame (one partner; the squad of four, where
//                  the rows are not offered at all); used, the minute differs (the probe can tell)
// The cross-commit identity (switch off = the base build 25e5e7c) is the play-through digests, run in this checkout and in one of the base: the same lines.
import { standUp, ROOT } from './headless.ts';
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { startTakedown } = await import(`${ROOT}/src/game/player.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const SLM: any = await import(`${ROOT}/src/game/silent.ts`);
const PM: any = await import(`${ROOT}/src/game/pairorders.ts`);
const SILENT: any = SLM.SILENT, PAIR: any = PM.PAIR;

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const clone = (o: any) => JSON.parse(JSON.stringify(o));
const DEFAULTS = { NIGHTBREACH: { ...NIGHTBREACH }, SILENT: clone(SILENT), PAIR: clone(PAIR) };
const reset = () => { Object.assign(NIGHTBREACH, DEFAULTS.NIGHTBREACH); Object.assign(SILENT, clone(DEFAULTS.SILENT)); Object.assign(PAIR, clone(DEFAULTS.PAIR)); };
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { reset(); } };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—'), f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—');
const at = (p: number[]) => `(${f1(p[0])}, ${f1(p[2])})`;
/** open floor in the office's main aisle, well clear of every room's door: where the staged scenes stand their men */
const AISLE_W: number[] = [13, 0, 17.6], AISLE_MID: number[] = [22, 0, 17.6], EAST = Math.PI / 2;

interface RigOpts { squad?: 1 | 2 | 4; pair?: Record<string, unknown>; silent?: Record<string, unknown>; quiet?: boolean; seed?: number }
/** the room clear on the office with ONE teammate (or `squad`), the silent order on the menu, the pair orders' switch as `pair.on` (default on) */
async function rig(o: RigOpts = {}) {
  reset(); Object.assign(NIGHTBREACH, { squad: o.squad ?? 1 });
  const seed = o.seed ?? 10; Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game, input = W.input;
  Object.assign(SILENT, { on: true }, o.silent ?? {}); Object.assign(PAIR, { on: true }, o.pair ?? {});
  PM.PAIR_LOG.length = 0; for (const k of Object.keys(PM.PAIR_STATS)) PM.PAIR_STATS[k] = 0;
  const O = game.orders, P = game.pair; game.godMode = true;
  const said: string[] = [];
  { const msg = game.msg.bind(game); game.msg = (t: string) => { said.push(t); msg(t); }; }
  { const say = game.say.bind(game); game.say = (gd: any, t: string, r?: boolean) => { said.push(`[${gd.callsign}] ${t}`); return say(gd, t, r); }; }
  const why = game.roomClear.start(seed);
  const seen = new Set<any>();
  const R = { W, game, input, O, P, why, said, held: 0, opShots: 0, post: null as null | (() => void),
    get mate(): any { return O.squad()[0]; }, get hostiles(): any[] { return game.guards.filter((h: any) => h.team === 'hostile'); },
    tango(n: number): any { return game.guards.find((h: any) => h.callsign === `Tango ${n}`); },
    step(n = 1) { for (let i = 0; i < n; i++) {
      game.player.visibility = 0.05;
      R.held = Math.max(R.held, input.keys.size + (input.buttons ? 1 : 0));
      W.step(DT);
      for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind === 'guardShot' && game.guards.some((x: any) => x.team === 'operative' && x.char.id === e.who)) R.opShots++; }
      R.post?.(); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    cursor(p: number[]) { W.cursorAt([p[0], p[1], p[2]]); },
    press(code: string) { input.pressed.add(code); R.step(); },
    last(): any { return O.log[O.log.length - 1] ?? null; },
    /** X with the cursor on p: the menu's order rows as the panel draws them (the who row and the cancel row left out) — the menu left UP */
    menu(p: number[]) { R.cursor(p); R.press(ORDERS.key); R.step(2);
      const hud = O.hud().menu; return { kind: O.menu?.target.kind as string | undefined, rows: (hud?.rows ?? []).slice(1).filter((r: any) => r.kind !== 'cancel').map((r: any) => ({ head: r.label as string, key: r.opts[0]?.key as string, text: r.opts[0]?.text as string, off: !!r.off })) }; },
    esc() { for (let i = 0; i < 3 && O.menu; i++) R.press('Escape'); },
    /** a man stood somewhere by hand, facing `yaw` */
    put(gd: any, p: number[], yaw: number) { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.lastPos = [p[0], 0, p[2]]; gd.path = []; gd.pathGoal = null; },
    chest(h: any): number[] { return [h.char.pos[0], 1.2, h.char.pos[2]]; },
    foe(h: any) { return { kind: 'foe', at: [h.char.pos[0], 0, h.char.pos[2]], foe: h }; },
    silent(): boolean { return SLM.squadSilent(game); },
    status(): string { return O.statusOf(R.mate); },
    log(): string { return PM.PAIR_LOG.map((x: any) => `${f1(x.t)} ${x.what}`).join(' | '); },
    roused(): any[] { return R.hostiles.filter((h: any) => h.state !== 'dead' && (h.state === 'alert' || h.state === 'search' || h.awareness >= 0.5)); },
  };
  R.step(30);
  if (o.quiet !== false) { SLM.setSilent(game, true); R.step(2); }
  return R;
}
/** THE STAGED SCENE: one defender (Tango 1) stood on the open aisle facing east, the partner nine metres behind him, Sam behind the partner; the other
 *  defenders where the staging left them, behind their rooms' doors */
export async function scene(o: RigOpts = {}) {
  const R = await rig(o); const foe = R.tango(1);
  R.put(foe, AISLE_MID, EAST); R.put(R.mate, AISLE_W, EAST); R.game.teleportPlayer([11, 0, 18.5]); R.step(30);
  return { R, foe, mate: R.mate };
}
const digitAbove5 = (rows: { key: string }[]) => rows.some(r => /^[6-9]$|^0$/.test(r.key));
const show = (rows: { key: string; text: string; off: boolean }[]) => rows.map(r => `${r.key || '·'} ${r.text}${r.off ? ' (greyed)' : ''}`).join(' | ');

// ---------------------------------------------------------------- the menu
export const pairMenu = guarded(async () => {
  const { verdict, done } = family('pair-menu: a defender is a target, with five rows on five digits — and nothing else on the menu has moved');
  const { R, foe, mate } = await scene({ quiet: false }); const { O, game, P } = R;
  verdict(R.why === null && O.squad().length === 1 && P.up && !R.silent(), 'the room clear stands ONE teammate up beside Sam, loud, and the pair orders are offered', `start: ${R.why} · squad ${O.squad().map((x: any) => x.callsign).join(', ')} · ${P.summary()}`);
  const m = R.menu(R.chest(foe)); const want = ['take him · on your mark', 'watch him', 'fall in', 'hold position', 'take him now'];
  verdict(m.kind === 'foe' && m.rows.length === 5 && m.rows.every((r: any, i: any) => r.key === String(i + 1) && r.text.startsWith(want[i])) && !digitAbove5(m.rows) && m.rows.every((r: any) => r.head === `on ${foe.callsign}`),
    'X with the cursor on a defender opens the menu on HIM: 1 take him · on your mark, 2 watch him, 3 fall in, 4 hold position, 5 take him now', `target ${m.kind} · ${show(m.rows)}`);
  R.esc();
  const n0 = O.log.length; R.cursor(R.chest(foe)); R.press(ORDERS.quickKey); R.step(2);
  verdict(O.log.length === n0 + 1 && R.last().order === 'pairMark' && R.last().target === `foe:${foe.callsign}` && O.of(mate)?.order === 'pairMark' && O.of(mate)?.foe === foe && R.silent(),
    `${ORDERS.quickKey.replace('Key', '')} on him gives the first row at once — and a loud squad goes silent on it, with its line`, `log ${JSON.stringify(R.last())} · ${mate.callsign}: ${R.status()} · said: ${R.said.slice(-3).join(' / ')}`);
  O.give('hold', O.targetAt(mate.char.pos)); R.step(5);
  // the floor's 1: loud and silent
  const spot = [12, 0, 18.2];
  const fs = R.menu(spot); R.esc(); SLM.setSilent(game, false); R.step(2); const fl = R.menu(spot); R.esc();
  verdict(fl.kind === 'floor' && fl.rows[0]?.key === '1' && fl.rows[0].text.startsWith('move there') && !fl.rows[0].text.includes('dark') && fs.rows[0]?.key === '1' && fs.rows[0].text.startsWith('move there · hold in the dark') && fs.rows.length === fl.rows.length && !digitAbove5(fs.rows),
    "the floor's menu: 1 is 'move there' while loud and 'move there · hold in the dark' while silent — the same count of rows, no digit above 5", `loud: ${show(fl.rows)}  ·  silent: ${show(fs.rows)}`);
  // a door's menu: the same with the switch on and off
  const door = game.doors.list.find((d: any) => d.def.name === 'breakroom_w') ?? game.doors.list[0], dp = [door.frameCentre[0], 1.0, door.frameCentre[2]];
  const tools = (): string => { const a = R.menu(dp); let s = show(a.rows); const i = (O.menu?.rows ?? []).findIndex((d: any) => d.opens); if (i >= 0) { O.pick(i); R.step(2); s += '  ▸  ' + show((O.hud().menu?.rows ?? []).slice(1).filter((r: any) => r.kind !== 'cancel').map((r: any) => ({ key: r.opts[0]?.key, text: r.opts[0]?.text, off: !!r.off }))); } R.esc(); return s; };
  const dOn = tools(); PAIR.on = false; R.step(2); const dOff = tools(); PAIR.on = true; R.step(2);
  verdict(dOn === dOff && dOn.length > 20, `a door's menu and its tools page read the same with the switch on and off (${door.def.name})`, `on:  ${dOn}\n    off: ${dOff}`);
  verdict(R.held === 0, 'nothing was held: every act above was a press', `most keys / buttons down in any frame: ${R.held}`);
  // off, and a bigger squad
  PAIR.on = false; R.step(2); const tOff = O.targetAt(foe.char.pos), ids = O.defs.map((d: any) => d.id);
  verdict(tOff.kind !== 'foe' && !ids.some((id: string) => id.startsWith('pair')) && !O.defs.find((d: any) => d.id === 'hold').targets.includes('foe') && !O.defs.find((d: any) => d.id === 'fallIn').targets.includes('foe') && O.give('pairMark', R.foe(foe)) !== null,
    'switch off: a defender is no target, no row of these is on the table, the built-in rows fit what they fitted, and the order is not there to give', `targetAt(a defender) → ${tOff.kind} · rows: ${ids.join(' ')}`);
  const out: string[] = []; let okBig = true;
  for (const squad of [2, 4] as const) { const B = await rig({ squad, quiet: false }), h = B.tango(1); B.put(h, AISLE_MID, EAST); B.step(10);
    const t = B.O.targetAt(h.char.pos), has = B.O.defs.some((d: any) => d.id.startsWith('pair')); okBig &&= !B.P.up && t.kind !== 'foe' && !has; out.push(`squad of ${squad}: up ${B.P.up} · targetAt(a defender) → ${t.kind} · rows of these ${has ? 'listed' : 'none'}`); }
  verdict(okBig, 'switch on with a squad of two or of four: not offered — these are one partner\'s orders', out.join(' · '));
  return done();
});

// ---------------------------------------------------------------- wait here / on me
export const pairWait = guarded(async () => {
  const { verdict, done } = family("pair-wait: 'wait here' and 'on me' — hold position and fall in, from a person's menu and from the floor's");
  const { R, foe, mate } = await scene(); const { O, game } = R; const sam = game.player.char;
  // hold, from the floor's menu
  R.menu([mate.char.pos[0] + 1.5, 0, mate.char.pos[2] + 0.8]); R.press('Digit4'); R.step(5); const p0 = [...mate.char.pos];
  const given1 = R.last()?.order === 'hold' && O.of(mate)?.order === 'hold';
  game.teleportPlayer([8, 0, 20]); R.step(60 * 4);
  verdict(given1 && flat(mate.char.pos, p0) < 0.4, "'wait here' (4 on the floor's menu): given, and he stays where he is while Sam goes six metres off for four seconds", `log ${JSON.stringify(R.last())} · moved ${f2(flat(mate.char.pos, p0))} m · ${R.status()} · said: ${R.said.slice(-2).join(' / ')}`);
  // fall in, from the floor's menu
  R.menu([sam.pos[0] + 1, 0, sam.pos[2]]); R.press('Digit3'); R.step(5);
  const given2 = R.last()?.order === 'fallIn' && O.of(mate)?.order === 'fallIn'; const came = R.until(() => flat(mate.char.pos, sam.pos) < 2.6, 12);
  verdict(given2 && came, "'on me' (3): given — the hold is cancelled — and he comes to Sam", `log ${JSON.stringify(R.last())} · ${f1(flat(mate.char.pos, sam.pos))} m from Sam · ${R.status()}`);
  // from a PERSON's menu, over a take job
  R.put(mate, AISLE_W, EAST); game.teleportPlayer([11, 0, 18.5]); R.step(20);
  const g1 = O.give('pairMark', R.foe(foe)); R.step(60 * 2); const onJob = !!R.P.jobOf(mate);
  R.menu(R.chest(foe)); R.press('Digit4'); R.step(5); const p1 = [...mate.char.pos]; R.step(60 * 3);
  verdict(g1 === null && onJob && R.last()?.order === 'hold' && R.last()?.target === `foe:${foe.callsign}` && !R.P.jobOf(mate) && O.of(mate)?.order === 'hold' && flat(mate.char.pos, p1) < 0.4 && PM.PAIR_LOG.some((x: any) => x.what.startsWith('cancel:')),
    "4 on the defender's own menu, the partner on his way to him: the take job is cancelled and he holds where he stands", `log ${JSON.stringify(R.last())} · job ${R.P.jobOf(mate) ? 'still on' : 'gone'} · moved ${f2(flat(mate.char.pos, p1))} m · ${R.log()}`);
  O.give('pairMark', R.foe(foe)); R.step(60); R.menu(R.chest(foe)); R.press('Digit3'); R.step(5);
  const back = R.until(() => flat(mate.char.pos, sam.pos) < 2.6, 12);
  verdict(R.last()?.order === 'fallIn' && !R.P.jobOf(mate) && back && foe.state !== 'dead', "3 on the defender's menu: the job is cancelled and he comes back to Sam — the man untouched", `log ${JSON.stringify(R.last())} · ${f1(flat(mate.char.pos, sam.pos))} m from Sam · ${foe.callsign} ${foe.state}`);
  verdict(R.held === 0 && R.opShots === 0 && R.roused().length === 0, 'no key held, no round fired, nobody roused by any of it', `held ${R.held} · rounds ${R.opShots} · roused ${R.roused().length}`);
  // the cue with nobody to order
  killGuard(game, mate, [0, 0, 1], true); R.step(30); const opened = O.open(O.targetAt(foe.char.pos)), w = O.give('hold', O.targetAt(sam.pos));
  verdict(!opened && w !== null, 'with the partner down there is nobody to order: the menu does not open and the order comes back with the reason', `open → ${opened} · give('hold') → ${w}`);
  return done();
});

// ---------------------------------------------------------------- go there and hold in the dark
export const pairDark = guarded(async () => {
  const { verdict, done } = family('pair-dark: go to that spot and hold in the dark');
  const R = await rig(); const { O, game, P } = R; const mate = R.mate, nav = game.col.nav, K = PAIR.darkVis;
  // three kinds of floor the partner can walk to, found by reading the place: lit with dark beside it · dark · lit with no dark in reach
  let beside: number[] | null = null, dark: number[] | null = null, lit: number[] | null = null;
  for (let x = 6; x < 30 && !(beside && dark && lit); x += 0.5) for (let z = 13; z < 23; z += 0.5) { const p = [x, 0, z];
    if (nav.isBlocked(x, z) || flat(p, mate.char.pos) < 2 || O.reach(mate, p) !== null) continue;
    const v = P.litAt(p), d = P.darkSpot(p);
    if (!dark && v <= K - 0.1) dark = p; else if (!beside && v > K + 0.15 && d && flat(d, p) > 0.3) beside = p; else if (!lit && v > K + 0.15 && !d) lit = p; }
  verdict(!!beside && !!dark && !!lit, 'the office has all three kinds of floor in the partner\'s reach (read off the light estimate)', `lit with dark beside it ${beside ? `${at(beside)} lit ${f2(P.litAt(beside))}` : 'none'} · dark ${dark ? `${at(dark)} lit ${f2(P.litAt(dark))}` : 'none'} · lit, no dark within ${PAIR.darkM} m ${lit ? `${at(lit)} lit ${f2(P.litAt(lit))}` : 'none'} · dark at ≤ ${K}`);
  if (!beside || !dark || !lit) return done();
  // obeyed: lit floor with dark beside it
  const m = R.menu(beside); R.press('Digit1'); R.step(5);
  const A1 = O.of(mate), post = A1?.post ? [...A1.post] : [0, 0, 0];
  const there = R.until(() => !!O.of(mate)?.arrived, 25); R.step(90);
  verdict(m.rows[0]?.text === 'move there · hold in the dark' && !m.rows[0].off && R.last()?.order === 'pairDark' && there && P.litAt(mate.char.pos) <= K + 0.05 && flat(mate.char.pos, beside) <= PAIR.darkM + 0.5 && flat(post, beside) > 0.3 && mate.char.anim.crouch > 0.5 && R.said.includes(`[${mate.callsign}] set.`),
    'given on lit floor with dark beside it (X, 1): he takes the DARK floor nearest the point, on a knee, and says set', `point ${at(beside)} lit ${f2(P.litAt(beside))} → he stands at ${at(mate.char.pos)} lit ${f2(P.litAt(mate.char.pos))}, ${f2(flat(mate.char.pos, beside))} m from the point · crouch ${f1(mate.char.anim.crouch)} · ${R.status()} · said: ${R.said.slice(-3).join(' / ')}`);
  // obeyed: dark floor
  const w2 = O.give('pairDark', O.targetAt(dark)); const there2 = R.until(() => !!O.of(mate)?.arrived, 25);
  verdict(w2 === null && there2 && flat(mate.char.pos, dark) < 0.6 && R.status() === 'holding in the dark', 'given on dark floor: the point itself', `point ${at(dark)} → ${at(mate.char.pos)} · ${R.status()}`);
  // refused: nothing dark in reach — greyed on the menu, and said when given by the quick key
  const m3 = R.menu(lit); R.esc(); const p3 = [...mate.char.pos], n3 = O.log.length;
  R.cursor(lit); R.press(ORDERS.quickKey); R.step(60 * 2);
  verdict(m3.rows[0]?.off && /nowhere dark there\.|no dark spot there\./.test(m3.rows[0].text) && O.log.length === n3 && (R.said.includes(`[${mate.callsign}] nowhere dark there.`) || R.said.includes(`[${mate.callsign}] no dark spot there.`)) && flat(mate.char.pos, p3) < 0.3 && O.of(mate)?.order === 'pairDark',
    'on lit floor with no dark in reach the row is greyed with the reason — and given by B it is refused in his own words; he stays on the order he had', `menu: ${show(m3.rows.slice(0, 1))} · said: ${R.said.slice(-1).join('')} · moved ${f2(flat(mate.char.pos, p3))} m · ${R.status()}`);
  // refused: no way there
  const t5 = R.tango(5), inRoom = [t5.char.pos[0] + 0.6, 0, t5.char.pos[2] + 0.6], w4 = O.give('pairDark', { kind: 'floor', at: inRoom });
  verdict(w4 !== null && /locked|get there/.test(w4), 'a spot behind a locked door: refused with the reason', `give → ${w4}`);
  // the place lit under him (the probe moves the bar, not a lamp: the spot now reads over it)
  const lit0 = PM.PAIR_STATS.lit; PAIR.darkVis = -1; R.step(60 * 4); const saidLit = R.said.includes(`[${mate.callsign}] lit up here.`), st = R.status(); PAIR.darkVis = K;
  verdict(saidLit && PM.PAIR_STATS.lit === lit0 + 1 && st === 'holding · LIT' && flat(mate.char.pos, p3) < 0.3, 'his spot no longer dark (the bar moved under him): he says so once, his line on the squad block says LIT, and he stays — where next is Sam\'s call', `said: lit up here. ${saidLit} · status then: ${st}`);
  // cancelled
  O.give('fallIn', O.targetAt(game.player.char.pos)); R.step(60 * 3);
  verdict(O.of(mate)?.order === 'fallIn' && mate.char.anim.crouch < 0.5, 'cancelled by fall in: he is up off his knee and on Sam again', `${R.status()} · crouch ${f1(mate.char.anim.crouch)}`);
  // the knob: go anyway
  PAIR.darkRefuse = false; R.step(65); const w6 = O.give('pairDark', O.targetAt(lit)); const there6 = R.until(() => !!O.of(mate)?.arrived, 25);
  verdict(w6 === null && there6 && flat(mate.char.pos, lit) < 0.7 && R.said.includes(`[${mate.callsign}] it's lit there.`), "`darkRefuse` off: he goes to the lit point anyway and says it is lit", `give → ${w6} · at ${at(mate.char.pos)} lit ${f2(P.litAt(mate.char.pos))} · said: it's lit there. ${R.said.includes(`[${mate.callsign}] it's lit there.`)}`);
  verdict(R.held === 0 && R.opShots === 0, 'no key held, no round fired', `held ${R.held} · rounds ${R.opShots}`);
  return done();
});

// ---------------------------------------------------------------- take that guard on my mark
export const pairMark = guarded(async () => {
  const { verdict, done } = family('pair-mark: take that guard on my mark');
  { const { R, foe, mate } = await scene(); const { O, game, P } = R;
    // given
    R.cursor(R.chest(foe)); R.press(ORDERS.quickKey); R.step(3);
    verdict(R.last()?.order === 'pairMark' && P.jobOf(mate)?.foe === foe && ['your', 'my'].some(w => R.said.some(s => s.startsWith(`you: ${mate.callsign} — take him · on ${w} mark`))), 'given (B on the man): the partner has the job and answers', `log ${JSON.stringify(R.last())} · said: ${R.said.slice(-2).join(' / ')}`);
    // obeyed: round to his back, set, and WAITS
    let seenFront = 0; R.post = () => { const [lx, lz] = [Math.sin(foe.char.bodyYaw), Math.cos(foe.char.bodyYaw)], dx = mate.char.pos[0] - foe.char.pos[0], dz = mate.char.pos[2] - foe.char.pos[2]; if (foe.state !== 'dead' && Math.hypot(dx, dz) < 2.6 && dx * lx + dz * lz > 0) seenFront++; };
    const set = R.until(() => !!P.jobOf(mate)?.set, 30), tSet = game.time, dSet = flat(mate.char.pos, foe.char.pos), crouched = mate.char.anim.crouch;
    R.step(60 * 5);
    const still = !!P.jobOf(mate)?.set && foe.state !== 'dead' && flat(mate.char.pos, foe.char.pos) > PAIR.reach, note = O.hud().status[0]?.opts.find((o: any) => o.key === 'F')?.text ?? '';
    verdict(set && still && R.said.includes(`[${mate.callsign}] set.`) && foe.awareness < 0.3 && seenFront === 0 && crouched > 0.5 && /mark/.test(note),
      "obeyed: he works round to the man's back on a knee, never in front of him, says set — and WAITS there five seconds, the man none the wiser; the squad block says what F does", `set at ${f1(tSet)} s, ${f2(dSet)} m behind him · still set ${still} · ${foe.callsign} awareness ${f2(foe.awareness)} · frames in front of him inside 2.6 m: ${seenFront} · crouch ${f1(crouched)} · status: ${R.status()} · note: F ${note}`);
    // the mark
    const m = R.menu([12, 0, 18.2]), row = m.rows.find((r: any) => r.key === 'F'); R.esc();
    const t0 = game.time; R.press('KeyF'); const went = !!P.jobOf(mate)?.go; const down = R.until(() => foe.state === 'dead', 6), tDown = game.time - t0; R.step(60 * 3);
    verdict(!!row && row.text.startsWith('mark') && went && down && foe.downKind === 'struck' && foe.downBy === 'guard' && R.opShots === 0 && R.roused().length === 0 && R.silent() && !SLM.silentCompromised(game) && O.of(mate)?.order === 'hold' && !P.jobOf(mate) && R.said.includes(`[${mate.callsign}] he's down.`),
      'F is the mark (also a row under "on your word" on any menu while he waits): he closes, the man is out cold — struck, not shot, not on Sam\'s card — no round fired, nobody else roused, the squad still silent; he says so and holds', `menu row: ${row ? `${row.key} ${row.text}` : 'none'} · down ${f2(tDown)} s after F · ${foe.callsign}: ${foe.state} ${foe.downKind} by ${foe.downBy} · rounds ${R.opShots} · roused ${R.roused().length} · ${R.status()} · ${R.log()}`);
    R.input.pressed.add('KeyF'); P.input(R.input); const fLeft = R.input.pressed.has('KeyF'); R.input.pressed.delete('KeyF');
    verdict(fLeft && !P.mark() && !O.defs.some((d: any) => d.id === 'pairGo') && R.held === 0, 'with nobody waiting on it F is not this module\'s (the press is left for whoever else reads it) and its row is off the menu; nothing was held', `F left in the frame's input: ${fLeft} · held ${R.held}`); }
  // the mark by Sam's own hands: two men on one beat
  { const { R, foe, mate } = await scene(); const { O, game, P } = R; const two = R.tango(2);
    R.put(two, [AISLE_MID[0], 0, AISLE_MID[2] + 2.2], EAST); R.step(20);
    O.give('pairMark', R.foe(foe)); const set = R.until(() => !!P.jobOf(mate)?.set, 30);
    // Sam is put down by a teleport two metres from the marked man, in the cubicles' flickering light: whether that man noticed HIM in the half second before the
    // partner's hands landed hung on the frame the partner happened to set on (the check passed or failed by the game clock, with the rules as they were too).
    // The check is about the mark, not Sam's own sneaking, so nobody senses him here.
    game.playerInvisible = true;
    game.teleportPlayer([two.char.pos[0] - 0.6, 0, two.char.pos[2]]); R.step(2); const t0 = game.time; startTakedown(game, two);
    const both = R.until(() => foe.state === 'dead' && two.state === 'dead', 6), gap = Math.abs((foe.diedAt ?? 0) - (two.diedAt ?? 0)); R.step(60 * 2);
    verdict(set && both && foe.downKind === 'struck' && foe.downBy === 'guard' && PM.PAIR_LOG.some((x: any) => x.what === 'go:hands') && R.opShots === 0 && R.roused().length === 0 && R.silent() && !SLM.silentCompromised(game),
      "Sam's own takedown on the man beside is the mark: both men down, no round, nobody else roused, the squad still silent", `set ${set} · ${two.callsign} down at +${f2((two.diedAt ?? 0) - t0)} s (Sam), ${foe.callsign} at +${f2((foe.diedAt ?? 0) - t0)} s (${mate.callsign}, ${foe.downKind}): ${f2(gap)} s apart · rounds ${R.opShots} · roused ${R.roused().map((h: any) => h.callsign).join(', ') || 'nobody'} · silent ${R.silent()}${SLM.silentCompromised(game) ? ' (compromised)' : ''} · ${R.log()}`); }
  // F before he is set
  { const { R, foe, mate } = await scene(); const { O, game, P } = R;
    O.give('pairMark', R.foe(foe)); R.step(60 * 2); const early = !P.jobOf(mate)?.set; R.press('KeyF');
    const down = R.until(() => foe.state === 'dead', 25);
    verdict(early && R.said.includes(`[${mate.callsign}] moving. not set yet.`) && down && !PM.PAIR_LOG.some((x: any) => x.what.startsWith('set:')) && R.opShots === 0, 'F before he is set: he says so and takes the man as soon as he gets there, without stopping to wait', `${R.log()} · ${foe.callsign} ${foe.state} at ${f1(game.time)} s`); }
  // cancelled
  { const { R, foe, mate } = await scene(); const { O, P } = R;
    O.give('pairMark', R.foe(foe)); R.until(() => !!P.jobOf(mate)?.set, 30); O.give('hold', O.targetAt(mate.char.pos)); R.step(5);
    const gone = !P.jobOf(mate); R.press('KeyF'); R.step(60 * 4);
    verdict(gone && foe.state !== 'dead' && O.of(mate)?.order === 'hold' && PM.PAIR_LOG.some((x: any) => x.what.startsWith('cancel:')) && !PM.PAIR_LOG.some((x: any) => x.what.startsWith('go:')), 'cancelled while he waits (hold position): the job is gone, and F afterwards sends nobody', `${R.log()} · ${foe.callsign} ${foe.state} · ${R.status()}`); }
  // the switch flicked off under way
  { const { R, foe, mate } = await scene(); const { O, P } = R;
    O.give('pairMark', R.foe(foe)); R.step(60 * 2); const onJob = !!P.jobOf(mate); PAIR.on = false; R.step(10); const p0 = [...mate.char.pos]; R.step(60 * 3);
    verdict(onJob && !P.jobOf(mate) && O.of(mate)?.order === 'hold' && flat(mate.char.pos, p0) < 0.3 && !O.defs.some((d: any) => d.id.startsWith('pair')) && foe.state !== 'dead',
      'the switch flicked off with the partner on his way: the rows are gone and he holds where he stands — he is not left walking an order nothing runs', `${R.status()} · moved ${f2(flat(mate.char.pos, p0))} m · ${foe.callsign} ${foe.state}`); }
  // refused with a cue, before it starts
  { const R = await rig(); const { O, game, P } = R; const mate = R.mate, t5 = R.tango(5), t1 = R.tango(1);
    const p0 = [...mate.char.pos], w1 = O.give('pairMark', R.foe(t5)); R.step(30);
    verdict(w1 !== null && /locked/.test(w1) && R.said.includes(`[${mate.callsign}] ${w1}`) && !P.jobOf(mate) && flat(mate.char.pos, p0) < 0.2, 'a man behind a locked door: refused, the partner says why, and he has not moved', `give → ${w1} · said: ${R.said.slice(-1).join('')}`);
    R.put(t1, AISLE_MID, EAST); R.put(mate, AISLE_W, EAST); R.step(20);
    t1.awareness = 0.9; const m = R.menu(R.chest(t1)); R.esc(); const w2 = O.give('pairMark', R.foe(t1)), w2b = O.give('pairTake', R.foe(t1)); t1.awareness = 0;
    verdict(m.rows[0]?.off && /he's fighting\. (no hands|can't grab him)\./.test(m.rows[0].text) && m.rows[4]?.off && /^he's fighting\. (no hands|can't grab him)\.$/.test(String(w2)) && w2b === w2 && !m.rows[1].off, 'a man who has already noticed: both take rows greyed with the reason (watch him is not), and given anyway they are refused in those words', `menu: ${show(m.rows)} · give → ${w2}`);
    const stale = R.foe(t1); killGuard(game, t1, [0, 0, 1], true); R.step(10); const w3 = O.give('pairMark', stale), tk = O.targetAt(t1.char.pos).kind;
    verdict(w3 === "he's down already." && tk !== 'foe', 'a man already down is no target, and an order still pointing at him is refused: he\'s down already', `targetAt(the body) → ${tk} · give → ${w3}`); }
  // called off under way with a cue: the man rouses before the hands are on him
  { const { R, foe, mate } = await scene(); const { O, P } = R;
    O.give('pairMark', R.foe(foe)); R.until(() => flat(mate.char.pos, foe.char.pos) < 5.5, 20); const n0 = R.said.length;
    foe.awareness = 0.9; R.post = () => { if (foe.state !== 'dead' && foe.awareness < 0.9) foe.awareness = 0.9; };   // (something has his attention, and keeps it)
    const off = R.until(() => !P.jobOf(mate), 3), cue = R.said.slice(n0).filter(s => s.startsWith(`[${mate.callsign}]`)).join(' / '), A = O.of(mate); R.step(30);
    verdict(off && /he's seen me!|he's onto us\./.test(cue) && PM.PAIR_STATS.blown === 1 && PM.PAIR_LOG.some((x: any) => x.what === 'off:blown') && foe.downKind !== 'struck' && (mate.state === 'alert' || (A?.order === 'hold' && !!A.watch)),
      'the man rouses while the partner is still on his way: no hands — he says so, stops where he is and puts his gun on the man', `said: ${cue} · ${R.log()} · ${mate.callsign}: ${R.status()} (${mate.state})`); }
  // … or there is no way to that back without crossing somebody's eyes (the staging's own man, his back to a wall and his face to the door)
  { const R = await rig({ pair: { stalkWait: 4 } }); const { O, P } = R; const mate = R.mate, foe = R.tango(1);
    const w = O.give('pairMark', R.foe(foe)); const waited = R.until(() => /no way to/.test(R.status()), 40), aw = foe.awareness; const off = R.until(() => !P.jobOf(mate), 30); R.step(30);
    verdict(w === null && waited && off && (R.said.includes(`[${mate.callsign}] no way to his back unseen.`) || R.said.includes(`[${mate.callsign}] can't get behind him unseen.`)) && PM.PAIR_LOG.some((x: any) => x.what === 'off:noway') && foe.state !== 'dead' && R.roused().length === 0 && R.opShots === 0 && O.of(mate)?.order === 'hold',
      'the only way to his back lies across his eyes: the partner WAITS short of it (his line on the squad block says so), and after a few seconds of no way says it and holds — nobody roused, no round', `give → ${w} · said: ${R.said.filter(s => s.startsWith(`[${mate.callsign}]`)).slice(-2).join(' / ')} · ${foe.callsign} awareness ${f2(aw)} · ${R.log()} · ${R.status()}`); }
  return done();
});

// ---------------------------------------------------------------- he's watched
/** a second defender stood in front of the man, facing him — put there AFTER the partner is set, and (the rule under test is the partner's) his own noticing held at nought */
function witness(R: any, foe: any, yaw: number, m = 4.5) { const w = R.tango(2); w.__yaw = yaw; w.hold = true; R.put(w, [foe.char.pos[0] + m, 0, foe.char.pos[2]], yaw); return w; }
export const pairWatched = guarded(async () => {
  const { verdict, done } = family("pair-watched: the mark with another defender looking — he says who, waits for a clear moment, or goes on a second mark");
  // (… and his feet and his facing held where the probe put them: a defender of this staging turns back to his own door within a second)
  const calm = (R: any, w: any) => { const at = [w.char.pos[0], 0, w.char.pos[2]]; R.post = () => { if (w.state !== 'dead') { w.awareness = 0; if (w.state !== 'patrol') w.state = 'patrol'; R.put(w, at, w.__yaw); w.char.chestDir = [Math.sin(w.__yaw), 0, Math.cos(w.__yaw)]; } }; };
  const staged = async (o: any = {}) => { const { R, foe, mate } = await scene(o); R.O.give('pairMark', R.foe(foe), 'all'); const set = R.until(() => !!R.P.jobOf(mate)?.set, 30); return { R, foe, mate, set }; };
  { const { R, foe, mate, set } = await staged(); const { P, O } = R;
    const none = P.watcher(foe, mate);
    const w = witness(R, foe, -Math.PI / 2); calm(R, w); R.step(20);
    const who = P.watcher(foe, mate), n0 = R.said.length;
    R.press('KeyF');
    R.step(60 * 3);
    const J = P.jobOf(mate), said = R.said.slice(n0), note = O.hud().status[0]?.opts.find((x: any) => x.key === 'F')?.text ?? '', line = O.statusOf?.(mate) ?? '';
    verdict(set && none === null && who === w && said.includes(`[${mate.callsign}] hold. ${w.callsign} has eyes on him.`) && !said.includes(`[${mate.callsign}] moving.`) && foe.state !== 'dead' && J?.watcher === w && J.t0 < 0 && /anyway/.test(note),
      "the mark with a second defender looking at the man (by the defenders' own eye test): no hands — he says who has eyes on him and stays set; the squad block says F again sends him anyway",
      `set ${set} · watcher before ${none?.callsign ?? 'nobody'}, after ${who?.callsign ?? 'nobody'} · said: ${said.join(' / ')} · F: ${note} · ${foe.callsign} ${foe.state} · ${line}`);
    // the watcher looks away: he goes by himself
    const n1 = R.said.length; w.__yaw = Math.PI / 2; const t0 = R.game.time;
    const down = R.until(() => foe.state === 'dead', 8);
    verdict(down && R.said.slice(n1).includes(`[${mate.callsign}] clear. moving.`) && R.opShots === 0, 'the watcher turns away: "clear. moving." and the man is out cold with no second mark and no round', `down ${down} after ${f2(R.game.time - t0)} s · said: ${R.said.slice(n1).join(' / ')} · rounds ${R.opShots}`);
  }
  { const { R, foe, mate } = await staged(); const { P } = R;
    const w = witness(R, foe, -Math.PI / 2); calm(R, w); R.step(20);
    R.press('KeyF'); R.step(60); const held = foe.state !== 'dead' && P.jobOf(mate)?.watcher === w, n0 = R.said.length;
    R.press('KeyF'); const down = R.until(() => foe.state === 'dead', 6);
    verdict(held && down && R.said.slice(n0).includes(`[${mate.callsign}] going anyway.`) && PM.PAIR_STATS.anyway === 1, 'a second mark while he is held up: "going anyway." and he takes the man whoever is looking', `held ${held} · down ${down} · said: ${R.said.slice(n0).join(' / ')} · anyway ${PM.PAIR_STATS.anyway}`);
  }
  { const { R, foe, mate } = await staged({ pair: { watched: false } });
    const w = witness(R, foe, -Math.PI / 2); calm(R, w); R.step(20); const n0 = R.said.length;
    R.press('KeyF'); R.step(60 * 2); const said = R.said.slice(n0), J = R.P.jobOf(mate);
    verdict(said.includes(`[${mate.callsign}] moving.`) && !said.some((x: string) => /has eyes on him/.test(x)) && !J?.watcher && PM.PAIR_STATS.watched === 0, 'the rule switched off (PAIR.watched): the mark is the mark, as it was — nobody is asked who is looking (the way to his back is still read for eyes, as it always was)', `said: ${said.join(' / ')} · ${R.O.statusOf?.(mate) ?? ''}`);
  }
  // held up for longer than the whole job's own clock: the seconds he was held are not the job's — he still takes the man once it is clear
  { const { R, foe, mate } = await staged(); const { P } = R; const keep = PM.PAIR.takeSecs;
    const w = witness(R, foe, -Math.PI / 2); calm(R, w); R.step(20);
    PM.PAIR.takeSecs = 3; R.press('KeyF'); R.step(60 * 6); const held = foe.state !== 'dead' && P.jobOf(mate)?.watcher === w, n0 = R.said.length;
    w.__yaw = Math.PI / 2; const down = R.until(() => foe.state === 'dead', 8), said = R.said.slice(n0);
    PM.PAIR.takeSecs = keep;
    verdict(held && down && !said.some((x: string) => /can't get (to his back|behind him)\./.test(x)), "held up for longer than the job's own time limit, then clear: he takes the man — the wait is not counted against the job", `held ${held} · down ${down} · said: ${said.join(' / ')}`);
  }
  // Sam's own hands as the mark, the partner set: he goes whoever is looking (the beat is not missed) …
  { const { R, foe, mate } = await staged(); const { P } = R;
    const w = witness(R, foe, -Math.PI / 2); calm(R, w); R.step(20); const n0 = R.said.length;
    P.mark('hands'); const down = R.until(() => foe.state === 'dead', 6), said = R.said.slice(n0);
    verdict(down && !said.some((x: string) => /has eyes on him/.test(x)) && PM.PAIR_STATS.watched === 0, "your own hands as the mark, the partner set at his man: he goes with you whoever is looking — no 'hold'", `down ${down} · said: ${said.join(' / ')}`);
  }
  // … but with the rule off, hands force nothing: the mark is the mark as it was
  { const { R, foe, mate } = await staged({ pair: { watched: false } }); const { P } = R;
    const w = witness(R, foe, -Math.PI / 2); calm(R, w); R.step(20);
    P.mark('hands'); R.step(30); const J = P.jobOf(mate);
    verdict(!!J && J.go && !J.force && !J.watcher && PM.PAIR_STATS.anyway === 0, 'the rule off, hands as the mark: nothing is forced — he is going, by the way to his back as it always was', `go ${J?.go} · force ${J?.force} · ${R.O.statusOf?.(mate) ?? ''}`);
  }
  // HE'LL LOOK BACK (PAIR.lookBack): the watcher has stood there a while, the partner is held on the mark, and the man only turns his head `turn` rad
  const back = async (o: any, turn: number) => { const { R, foe, mate } = await staged(o); const w = witness(R, foe, -Math.PI / 2); calm(R, w); R.step(60 * 20);   // (long enough for the way he mostly faces to BE this way: he came from facing his own door)
    R.press('KeyF'); R.step(60); const held = foe.state !== 'dead' && R.P.jobOf(mate)?.watcher === w; w.__yaw = -Math.PI / 2 + turn; return { R, foe, mate, w, held, n0: R.said.length, t0: R.game.time }; };
  { const { R, foe, mate, w, held, n0 } = await back({}, 1.3); const { P, O } = R;
    R.step(60 * 3); const J = P.jobOf(mate), still = foe.state !== 'dead' && J?.watcher === w && J.t0 < 0 && P.watcher(foe, mate) === null, said = R.said.slice(n0);
    const note = O.hud().status[0]?.opts.find((x: any) => x.key === 'F')?.text ?? '', line = O.statusOf?.(mate) ?? '', n1 = R.said.length;
    R.press('KeyF'); const down = R.until(() => foe.state === 'dead', 6);
    verdict(held && still && said.includes(`[${mate.callsign}] he'll look back. your call.`) && /anyway/.test(note) && down && R.said.slice(n1).includes(`[${mate.callsign}] going anyway.`),
      'the watcher only turns his head: three seconds on the partner is still held ("he\'ll look back. your call."), F is still on the squad block, and F sends him',
      `held ${held} · still ${still} · F: ${note} · ${line} · down ${down} · said: ${R.said.slice(n0).join(' / ')}`);
  }
  { const { R, foe, mate, held, n0, t0 } = await back({}, 2.1);
    R.step(60 * 2); const still = foe.state !== 'dead' && !!R.P.jobOf(mate)?.watcher; const down = R.until(() => foe.state === 'dead', 14);
    verdict(held && still && down && R.said.slice(n0).includes(`[${mate.callsign}] clear. moving.`), 'the watcher turns for good (and stays turned): the hold lets go by itself once the way he mostly faces has come round — no second mark',
      `held ${held} · still at 2 s ${still} · down ${down} after ${f2(R.game.time - t0)} s · said: ${R.said.slice(n0).join(' / ')}`);
  }
  { const { R, foe, mate, held, n0, t0 } = await back({}, 1.3); const { P } = R;
    R.step(60 * 2); const still = foe.state !== 'dead' && !!P.jobOf(mate)?.watcher;
    P.litAt = () => 0; const post = R.post; R.post = () => { post?.(); foe.visibility = 0; mate.visibility = 0; }; foe.visibility = 0; mate.visibility = 0;   // (the lamp goes out)
    const down = R.until(() => foe.state === 'dead', 6);
    verdict(held && still && down && R.said.slice(n0).includes(`[${mate.callsign}] clear. moving.`), 'the light goes off the man and the partner while the watcher\'s head is turned: nothing is there for him to look back to — the hold lets go',
      `held ${held} · still at 2 s ${still} · down ${down} after ${f2(R.game.time - t0)} s · said: ${R.said.slice(n0).join(' / ')}`);
  }
  { const { R, foe, mate, held, n0, t0 } = await back({ pair: { lookBack: false } }, 1.3);
    R.step(60 * 2); const J = R.P.jobOf(mate);
    verdict(held && !J?.watcher && R.said.slice(n0).includes(`[${mate.callsign}] clear. moving.`) && !R.said.slice(n0).some((x: string) => /look back/.test(x)), 'the rule off (PAIR.lookBack): a turned head is a clear moment, as it was',
      `held ${held} · watcher ${J?.watcher?.callsign ?? 'nobody'} ${f2(R.game.time - t0)} s on · ${R.O.statusOf?.(mate) ?? ''} · said: ${R.said.slice(n0).join(' / ')}`);
  }
  { const { R, foe, mate } = await scene({ pair: { heelWait: 3 } }); const { P } = R;
    const w = witness(R, foe, -Math.PI / 2); calm(R, w); R.step(5);
    R.O.give('pairTake', R.foe(foe), 'all'); const n0 = R.said.length;
    R.step(60 * 40); const said = R.said.slice(n0);
    verdict(foe.state !== 'dead' && !P.jobOf(mate) && R.opShots === 0 && said.some((x: string) => /no clean moment|no way to his back unseen|can't get behind him unseen/.test(x)), 'take him now, with a watcher who never looks away: no hands — he calls it off in words and holds', `${foe.callsign} ${foe.state} · said: ${said.filter((x: string) => x.startsWith('[')).join(' / ')}`);
  }
  return done();
});

// ---------------------------------------------------------------- take him now
export const pairNow = guarded(async () => {
  const { verdict, done } = family('pair-now: take him now — the same job with no mark');
  const { R, foe, mate } = await scene(); const { O, game, P } = R;
  R.menu(R.chest(foe)); R.press('Digit5'); R.step(3); const t0 = game.time;
  const given = R.last()?.order === 'pairTake' && P.jobOf(mate)?.mode === 'now';
  const down = R.until(() => foe.state === 'dead', 45); R.step(60 * 2);
  verdict(given && down && foe.downKind === 'struck' && R.opShots === 0 && R.roused().length === 0 && !PM.PAIR_LOG.some((x: any) => x.what.startsWith('go:')) && O.of(mate)?.order === 'hold' && R.held === 0,
    'X, 5 on the man: he goes round to his back and takes him with no mark given — out cold, no round, nobody roused, then holds', `log ${JSON.stringify(R.last())} · down ${f1(game.time - 2 - t0)} s after the order · ${R.log()} · ${R.status()}`);
  return done();
});

// ---------------------------------------------------------------- watch him
export const pairWatch = guarded(async () => {
  const { verdict, done } = family('pair-watch: watch him — the gun on the man, no round while he has not noticed');
  const run = async (order: 'pairWatch' | 'hold') => { const { R, foe, mate } = await scene(); const { O } = R;
    R.put(mate, [AISLE_MID[0] - 6, 0, AISLE_MID[2]], EAST); R.step(5);
    const w = order === 'pairWatch' ? (R.menu(R.chest(foe)), R.press('Digit2'), R.last()?.order === 'pairWatch' ? null : 'not given') : O.give('hold', O.targetAt(mate.char.pos));
    R.step(3); SILENT.holdFire = false;   // (from here on only this row holds his fire)
    R.step(60 * 6); const quiet = { shots: R.opShots, foe: foe.state, onHim: Math.abs(Math.atan2(Math.sin(mate.char.aimYaw - Math.atan2(foe.char.pos[0] - mate.char.pos[0], foe.char.pos[2] - mate.char.pos[2])), Math.cos(mate.char.aimYaw - Math.atan2(foe.char.pos[0] - mate.char.pos[0], foe.char.pos[2] - mate.char.pos[2])))), status: R.status(), held: PM.PAIR_STATS.held };
    if (foe.state !== 'dead') { foe.state = 'alert'; foe.awareness = 1; foe.foe = mate; } R.step(60 * 4);
    return { w, quiet, after: { shots: R.opShots, foe: foe.state }, name: foe.callsign, held: R.held }; };
  const a = await run('pairWatch'), b = await run('hold');
  verdict(a.w === null && a.quiet.shots === 0 && a.quiet.foe !== 'dead' && a.quiet.onHim < 0.2 && a.quiet.held > 0 && a.quiet.status === `watching ${a.name}` && a.held === 0,
    'X, 2 on the man (the silent order\'s own fire hold switched off): six seconds with his gun on him and not one round', `rounds ${a.quiet.shots} · ${a.name} ${a.quiet.foe} · gun off him by ${f2(a.quiet.onHim)} rad · rounds held by this row ${a.quiet.held} · ${a.quiet.status}`);
  verdict(a.after.shots > 0, 'the moment the man has noticed, he shoots', `rounds after: ${a.after.shots} · ${a.name} ${a.after.foe}`);
  { const R = await rig(); const t5 = R.tango(5), w = R.O.give('pairWatch', R.foe(t5)); R.step(20);
    verdict(w === 'no line from here.' && R.said.includes(`[${R.mate.callsign}] no line from here.`) && R.O.of(R.mate)?.order !== 'pairWatch', 'a man he cannot see (a wall between): refused — no line from here', `give → ${w} · said: ${R.said.slice(-1).join('')}`); }
  verdict(b.quiet.shots > 0 || b.quiet.foe === 'dead', 'the contrast — a plain hold in the same place, the same fire hold off: he shoots the man on sight (the probe can tell)', `rounds ${b.quiet.shots} · ${b.name} ${b.quiet.foe}`);
  return done();
});

// ---------------------------------------------------------------- off / never used
/** a scripted minute with one partner — fall in, two moves, the silent order, a stack, cover, fall in, an entry — hashed every frame: the digest, and every man's place, aim and words */
async function minute(o: RigOpts, use: false | 'move' | 'pairDark' = false): Promise<string> {
  const R = await rig({ quiet: false, ...o }); const { game, O } = R; let h = 0x811c9dc5 >>> 0;
  const eat = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } };
  const frame = (n: number) => { for (let f = 0; f < n; f++) { R.step(); eat(JSON.stringify(digestGame(game, true))); for (const x of game.guards) eat(`${x.state[0]}${x.char.pos[0].toFixed(4)},${x.char.pos[2].toFixed(4)},${x.char.aimYaw.toFixed(4)},${x.bubble?.text ?? ''}`); } };   // (the squad block's own words are NOT in it: silent, its B hint reads 'hold in the dark' with the switch on — the row's name, by design)
  const sam = game.player.char.pos, door = (n: string) => O.targetAt(game.doors.list.find((d: any) => d.def.name === n).frameCentre);
  O.give('fallIn', O.targetAt([sam[0], 0, sam[2]]), 'all'); frame(120);
  // (the second move is given LOUD when nothing of these is to be used: silent, with the switch on, the floor's 1 IS 'hold in the dark' — that is the feature)
  O.give('move', O.targetAt([15, 0, 17.6])); frame(60 * 8);
  if (use) { O.give('silent', O.targetAt([15, 0, 17.6])); frame(60 * 2); O.give(use, O.targetAt([18, 0, 17.6])); frame(60 * 6); }
  else { O.give('move', O.targetAt([18, 0, 17.6])); frame(60 * 6); O.give('silent', O.targetAt([15, 0, 17.6])); frame(60 * 2); }
  O.give('stack', door('breakroom_w')); frame(60 * 12); O.give('cover', door('breakroom_w')); frame(60 * 4); game.teleportPlayer([20, 0, 18.4]); O.give('fallIn', O.targetAt([20, 0, 18.4])); frame(60 * 8);
  O.give('openClear', door('breakroom_w')); frame(60 * 20);
  return `${(h >>> 0).toString(16).padStart(8, '0')} · ${game.guards.filter((x: any) => x.state !== 'dead').length} standing at ${game.time.toFixed(2)} s · orders ${O.log.length}`;
}
export const pairIdentity = guarded(async () => {
  const { verdict, done } = family('pair-identity: the switch on and never used is the game with it off');
  const off = await minute({ pair: { on: false } }), on = await minute({}), knobs = await minute({ pair: { stageM: 3, pace: 0.7, darkVis: 0.6, markOnHands: false } });
  verdict(off === on && on === knobs, 'one partner, a scripted minute (fall in, move, go silent, move, stack, cover, fall in, open and clear) with no row of these given (the moves given loud): the same hash every frame with the switch off, on, and on with its numbers moved', `off ${off} · on ${on} · numbers moved ${knobs}`);
  const used = await minute({}, 'pairDark'), plain = await minute({}, 'move');
  verdict(used !== plain, "the same minute with the second move given SILENT, once as the plain move and once as 'hold in the dark': the hashes differ (the probe can tell)", `hold in the dark ${used} · the plain move ${plain}`);
  const off4 = await minute({ squad: 4, pair: { on: false } }), on4 = await minute({ squad: 4 });
  verdict(off4 === on4, 'the squad of four, the same minute: the same hash with the switch off and on (the rows are not offered to four)', `off ${off4} · on ${on4}`);
  return done();
});

if (import.meta.main) {
  const all: Record<string, () => Promise<boolean>> = { 'pair-menu': pairMenu, 'pair-wait': pairWait, 'pair-dark': pairDark, 'pair-mark': pairMark, 'pair-now': pairNow, 'pair-watched': pairWatched, 'pair-watch': pairWatch, 'pair-identity': pairIdentity };
  const want = process.argv.slice(2).filter(a => !a.startsWith('--')); let ok = true;
  for (const [name, fn] of Object.entries(all)) if (!want.length || want.includes(name)) ok = (await fn()) && ok;
  process.exit(ok ? 0 : 1);
}
