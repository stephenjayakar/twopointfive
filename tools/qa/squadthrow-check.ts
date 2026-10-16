// TEAMMATES THROW A FRAG OR A STUN CANISTER ON ORDER (src/game/squadthrow.ts): X on a spot of floor, G, then 1 = frag there / 2 = bang there.
//   bun run tools/qa/squadthrow-check.ts            (also `probes.ts squadthrow`, and under `squadorders`)
//   TPS_PROFILE=shipped bun run tools/qa/squadthrow-check.ts      — the same lines on the page's stand: it passes on both (it raises the switch itself)
// PASS / FAIL each, all headless: the room clear on the office with its squad of four (the rescue for the hostage line), every hostile off the floor
// unless a line wants one. What is checked is the menu's rows by KEYS, who throws, the item (whose it is, where its fuse finds it), the count, the words,
// the squad block, and every refusal — nothing here looks at a picture.
// SQUADTHROW_BREAK=1 = the switch left off and the same lines asked: they must fail.   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const ST: any = await import(`${ROOT}/src/game/squadthrow.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const SLM: any = await import(`${ROOT}/src/game/silent.ts`);
const { FRAG } = await import(`${ROOT}/src/game/frag.ts`);
const { SAMSTUN } = await import(`${ROOT}/src/game/samstun.ts`);
const { WORDS } = await import(`${ROOT}/src/game/words.ts`);
const { QUICKTHROW } = await import(`${ROOT}/src/game/quickthrow.ts`);
const { SQUADTHROW, THROW_OPEN, FRAG_THERE, STUN_THERE } = ST;

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const p2 = (p: number[]) => `(${f1(p[0])}, ${f1(p[2])})`;
interface Row { key: string; text: string; off: boolean }
const show = (rows: Row[]) => rows.map(r => `${r.key || '·'} ${r.text}${r.off ? ' (off)' : ''}`).join(' | ');
const digitAbove5 = (rows: Row[]) => rows.some(r => /^[6-9]$|^0$/.test(r.key));
export function place(gd: any, p: number[], yaw = 0) { gd.char.pos = [p[0], p[1], p[2]]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }

/** a squad mission on the office, stood up with the switch as `on`; every hostile off the floor (`keep`: but the first, held where he is and not to be hurt) */
export async function rig(seed: number, on: boolean, o: { rescue?: boolean; squad?: 2 | 4; keep?: boolean; live?: boolean; silent?: boolean; walk?: boolean; lob?: boolean } = {}) {
  const squad0 = NIGHTBREACH.squad; Object.assign(NIGHTBREACH, { squad: o.squad ?? 4 });
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game, input = W.input, O = game.orders;
  SQUADTHROW.on = on; SQUADTHROW.walk = !!o.walk; SQUADTHROW.lob = !!o.lob; FRAG.on = true; if (o.silent) SLM.SILENT.on = true;   // (walk: a man with no throw walks to one — squadthrow-walk-check.ts asks about that; every line here is about the throw from where he stands)
  game.godMode = true;
  const said: string[] = []; { const msg = game.msg.bind(game); game.msg = (t: string) => { said.push(t); msg(t); }; }
  const lines: { who: string; text: string }[] = []; { const say = game.say.bind(game); game.say = (gd: any, t: string, ...a: any[]) => { lines.push({ who: gd?.callsign ?? '?', text: t }); return say(gd, t, ...a); }; }
  const why = o.rescue ? game.rescue.start() : game.roomClear.start(seed);
  Object.assign(NIGHTBREACH, { squad: squad0 });
  const R = { W, game, input, O, why, said, lines, held: 0, foe: null as any,
    get team(): any[] { return O.squad(); },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; R.held = Math.max(R.held, input.keys.size + (input.buttons ? 1 : 0)); W.step(DT); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    cursor(p: number[]) { W.cursorAt([p[0], p[1], p[2]]); },
    press(code: string) { input.pressed.add(code); R.step(); },
    /** the menu's order rows as the panel draws them now (the who row and the cancel row left out) */
    rows(): Row[] { const hud = O.hud().menu; return (hud?.rows ?? []).slice(1).filter((r: any) => r.kind !== 'cancel').map((r: any) => ({ key: r.opts[0]?.key ?? '', text: r.opts[0]?.text ?? '', off: !!r.off })); },
    /** X with the cursor on p: the first page — the menu left UP */
    menu(p: number[]): Row[] { R.esc(); R.cursor(p); R.press(ORDERS.key); R.step(2); return R.rows(); },
    /** X on p, then G: the throw page — the menu left UP */
    page(p: number[]): Row[] { R.menu(p); R.press(FRAG.orderKey); R.step(2); return R.rows(); },
    /** the same page with the menu opened from code on p (the camera, settled over Sam, may have a wall's top between it and the spot) — G is still a key */
    pageAt(p: number[]): Row[] { R.esc(); O.open(O.targetAt(p)); R.step(2); R.press(FRAG.orderKey); R.step(2); return R.rows(); },
    esc() { for (let i = 0; i < 4 && O.menu; i++) R.press('Escape'); },
    notes(): string[] { return (O.hud().status ?? []).flatMap((r: any) => r.opts.map((x: any) => x.text as string)); },
    items(kind: string): any[] { return game.items.items.filter((x: any) => x.kind === kind); },
    /** the squad's own bag, written (the frozen stand issues no frags) */
    bag(frags: number, bangs: number) { game.doorTools.frags = frags; game.doorTools.bangs = bangs; },
    /** Sam put on the floor at p (the camera with him), the squad left holding where it stands */
    sam(p: number[]) { game.teleportPlayer([p[0], 0, p[2]]); R.step(20); },
  };
  R.step(30);
  for (const m of R.team) m.god = true;
  if (!o.live) { for (const h of game.guards) if (h.team === 'hostile' && h.state !== 'dead') { if (o.keep && !R.foe) { R.foe = h; h.god = true; continue; } killGuard(game, h, [0, 0, 1], true); } }
  if (R.foe) place(R.foe, [2, 0, 2]);
  if (!o.live) { O.give('hold', O.targetAt(game.player.char.pos)); R.step(60 * 3); }
  R.bag(2, 3);
  return R;
}
/** p is floor the menu takes for itself, and the cursor put on it finds it (no wall's top between the camera and the spot) */
export function floorAt(R: any, p: number[]): number[] | null {
  const t = R.O.targetAt(p); if (t.kind !== 'floor' || dist(t.at, p) > 0.3) return null;
  R.cursor(t.at); const u = R.O.targetUnder(R.input, R.W.cam, R.W.canvas); return u.kind === 'floor' && dist(u.at, t.at) < 0.3 ? u.at : null;
}
/** the first spot on rings round the squad's men that `ok` takes */
function find(R: any, ds: number[], ok: (at: number[]) => boolean): number[] | null {
  for (const d of ds) for (const gd of R.team) { const p = gd.char.pos;
    for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12, at = floorAt(R, [p[0] + Math.sin(a) * d, 0, p[2] + Math.cos(a) * d]); if (at && ok(at)) return at; } }
  return null;
}
/** a floor point for Sam: `far` = more than 10 m from `spot` or with something solid between, else within `near` m of it with a line; never on a man */
function samSpot(R: any, spot: number[], near: number | null): number[] | null {
  const g = R.game, clear = (a: number[], b: number[]) => !g.col.solidBlocked([a[0], 1.1, a[2]], [b[0], 1.1, b[2]]) && !g.col.solidBlocked([a[0], 0.3, a[2]], [b[0], 0.3, b[2]]);
  if (near !== null) { for (const d of [near, near * 0.75, near * 1.25]) for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, p = [spot[0] + Math.sin(a) * d, 0, spot[2] + Math.cos(a) * d], t = R.O.targetAt(p);
      if (t.kind === 'floor' && dist(t.at, p) < 0.3 && clear(p, spot) && R.team.every((m: any) => dist(m.char.pos, p) > 1)) return p; } return null; }
  for (let x = 3; x <= 37; x += 1.5) for (let z = 3; z <= 25; z += 1.5) { const p = [x, 0, z], t = R.O.targetAt(p); if (t.kind === 'floor' && dist(t.at, p) < 0.3 && dist(p, spot) > 11 && R.team.every((m: any) => dist(m.char.pos, p) > 1.5)) return p; }
  return null;
}

export async function squadthrowCheck(): Promise<boolean> {
  const BREAK = process.env.SQUADTHROW_BREAK === '1', ON = !BREAK; let all = true;
  const kept = { on: SQUADTHROW.on, walk: SQUADTHROW.walk, lob: SQUADTHROW.lob, again: SQUADTHROW.againSecs, frag: FRAG.on, samstun: SAMSTUN.on, silent: JSON.parse(JSON.stringify(SLM.SILENT)), squad: NIGHTBREACH.squad, random: Math.random };
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== squadthrow: teammates throw a frag or a stun canister on a floor order${BREAK ? ' (SQUADTHROW_BREAK: the switch left off)' : ''} ===`);
  const guard = async (name: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { verdict(false, `${name}: the line threw`, e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 3).join(' · ') : String(e)); } };
  try {
    // ───────────── 1 · the rows, by keys; the frag ─────────────
    await guard('rows and the frag', async () => {
      const R = await rig(7, ON), { O, game } = R, team = R.team;
      // a spot a man has a frag throw to with nobody of ours inside it; Sam stood well away from it first
      const fragOk = (at: number[]) => { const th = ST.squadThrower(game, team, at, 'frag'); return !!th && !ST.squadFragCatches(game, th.rest, at); };
      let spot = find(R, [10, 10.5, 11, 9.5, 11.5], at => { const th = ST.squadThrower(game, team, at, 'frag'); if (!th) return false; const inIt = team.some((m: any) => dist(m.char.pos, at) < 9.5 && !game.col.solidBlocked([at[0], 0.9, at[2]], [m.char.pos[0], 1.1, m.char.pos[2]])); return !inIt; });
      if (!spot) { verdict(false, 'a spot of floor a teammate has a frag throw to with no teammate inside its reach', `none found round ${team.map((m: any) => `${m.callsign} ${p2(m.char.pos)}`).join(' ')}`); return; }
      const away = samSpot(R, spot, null); if (away) R.sam(away);
      if (!floorAt(R, spot) || (ON && !fragOk(spot))) { verdict(false, 'the spot is in the camera\'s view with Sam stood away from it, and still a clear frag', `spot ${p2(spot)} · Sam ${p2(game.player.char.pos)} · ${ST.squadThrower(game, team, spot, 'frag') ? ST.squadFragCatches(game, spot, spot) : 'no throw'}`); return; }
      // the first page, with the switch off and on (thrown live)
      SQUADTHROW.on = false; R.step(2); const off = R.menu(spot), offDefs = O.defs.some((d: any) => [THROW_OPEN, FRAG_THERE, STUN_THERE].includes(d.id)); R.esc();
      SQUADTHROW.on = ON; R.step(2); const first = R.menu(spot), open = first.find(r => r.text.startsWith('throw')), plain = first.filter(r => r !== open);
      const same = plain.length === off.length && plain.every((r, i) => r.key === off[i].key && r.text === off[i].text);
      verdict(R.why === null && team.length === 4 && !offDefs && !off.some(r => /throw|frag there|bang there/.test(r.text)) && !!open && open.key === 'G' && open.text === 'throw · frag 2 · bang 3 ▸' && !open.off && same && !digitAbove5(first) && O.defs.filter((d: any) => d.id === THROW_OPEN).length === 1,
        'X on a spot of floor: with the switch off there is no such row and no such order; thrown on, the next menu lists "throw · frag 2 · bang 3 ▸" on G, every other row keeps its key and words, and no digit is above 5',
        `off: ${show(off)} · on: ${show(first)}`);
      // G: the page
      const th0 = ST.squadThrower(game, team, spot, 'frag'), nearestWithArc = team.filter((m: any) => ST.squadThrower(game, [m], spot, 'frag')).sort((a: any, b: any) => dist(a.char.pos, spot!) - dist(b.char.pos, spot!))[0];
      const items0 = game.items.items.length; R.press(FRAG.orderKey); R.step(2); const page = R.rows();
      verdict(!!O.menu && O.menu.page === 'throw' && page.length === 2 && page[0].key === '1' && page[0].text === 'frag there · 2 left' && !page[0].off && page[1].key === '2' && page[1].text === 'bang there · 3 left' && !page[1].off && !digitAbove5(page) && game.items.items.length === items0,
        'G turns the menu to the throws: 1 "frag there · 2 left", 2 "bang there · 3 left", no other row, no digit above 2, and nothing has left anybody\'s hand', `page: ${show(page)} · menu page ${O.menu?.page}`);
      // 1: the frag
      const asg0 = new Map(team.map((m: any) => [m, O.of(m)])), log0 = O.log.length, pos0 = team.map((m: any) => [...m.char.pos]);
      R.press('Digit1');
      const it = R.items('frag')[0], who = it ? team.find((m: any) => m.char.id === it.who) : null, block = R.notes();
      const saidIt = R.lines.some(l => l.who === who?.callsign && l.text === 'frag out!'), logged = O.log.length === log0 + 1 && O.log.at(-1)?.order === FRAG_THERE && O.log.at(-1)?.who.join() === who?.callsign;
      verdict(!!it && !!who && who === th0?.gd && who === nearestWithArc && game.doorTools.frags === 1 && game.doorTools.bangs === 3 && !O.menu && saidIt && logged && team.every((m: any) => O.of(m) === asg0.get(m)) && R.held <= 1 && block.includes(`${who.callsign} · frag out`) && Math.abs(it.fuse - FRAG.orderFuse) < 0.1,
        'X, G, 1 (three presses, nothing held): the nearest man with a throw tosses a frag — the item is his, on the order\'s fuse; he says "frag out!"; the squad\'s frags are one fewer and its bangs untouched; the menu is away; every man keeps the order he was on; the throw is on the order log and the squad block names it',
        `${who?.callsign ?? 'nobody'} at ${who ? p2(who.char.pos) : '—'}, spot ${p2(spot)} (${who ? f1(dist(who.char.pos, spot)) : '—'} m) · item ${it ? `'${it.kind}' who ${it.who} fuse ${it.fuse.toFixed(2)}` : 'none'} · frags ${game.doorTools.frags} bangs ${game.doorTools.bangs} · said ${saidIt} · logged ${logged} · block ${JSON.stringify(block.filter(t => /out/.test(t)))} · most keys held at once ${R.held}`);
      let last = it ? [...it.pos] : [NaN, 0, NaN]; const t0 = game.time;
      R.until(() => { if (it && game.items.items.includes(it) && !it.fired) last = [...it.pos]; return !it || it.fired || !game.items.items.includes(it); }, 6); const burstAt = game.time - t0; R.step(60 * 3);
      const moved = Math.max(...team.map((m: any, i: number) => dist(m.char.pos, pos0[i]))), up = team.filter((m: any) => m.state !== 'dead').length, gone = !R.notes().some(t => /frag out/.test(t));
      verdict(!!it && dist(last, spot) < 1 && Math.abs(burstAt - FRAG.orderFuse) < 0.3 && moved < 0.3 && up === 4 && !game.player.down && gone,
        'the frag is within a metre of the spot when its fuse runs out, and bursts there; nobody walked for it, nobody of ours is down, and the squad block has let the line go again', `at the burst ${p2(last)}, ${dist(last, spot).toFixed(2)} m from the spot, ${burstAt.toFixed(2)} s after the hand · furthest any man moved ${moved.toFixed(2)} m · up ${up}/4 · line gone ${gone}`);
      // the same man again in the same breath; none left
      const th1 = ST.squadThrower(game, [th0?.gd], spot, 'frag'); SQUADTHROW.againSecs = 1e9; R.bag(2, 3); const again = O.give(FRAG_THERE, O.targetAt(spot), team.indexOf(th0?.gd)); SQUADTHROW.againSecs = kept.again;
      R.bag(0, 0); const none = R.page(spot), n0 = game.items.items.length; R.press('Digit1'); R.step(3); const still = !!O.menu; R.press('Digit2'); R.step(3); R.esc();
      const g1 = O.give(FRAG_THERE, O.targetAt(spot)), g2 = O.give(STUN_THERE, O.targetAt(spot));
      verdict(!!th1 && again === 'no throw from here.' && none.length === 2 && none.every(r => r.off) && /no frags left/.test(none[0].text) && /no bangs left/.test(none[1].text) && game.items.items.length === n0 && g1 === 'no frags left.' && g2 === 'no bangs left.' && game.doorTools.frags === 0 && game.doorTools.bangs === 0,
        'a man whose toss has not finished has no second throw (told alone: "no throw from here."); with none left both rows stay, greyed with their reasons, 1 and 2 throw nothing, and the orders given by name are refused in the same words',
        `again at once: '${again}' · page: ${show(none)} · given: '${g1}' / '${g2}' · items ${n0} → ${game.items.items.length} · menu still up after 1: ${still}`);
      // no arc: a spot far from every man
      R.bag(2, 3); let far: number[] | null = null;
      for (let x = 3; x <= 37 && !far; x += 1.5) for (let z = 3; z <= 25 && !far; z += 1.5) { const t = O.targetAt([x, 0, z]); if (t.kind === 'floor' && team.every((m: any) => dist(m.char.pos, t.at) > 14)) far = t.at; }
      const gf = far ? O.give(FRAG_THERE, O.targetAt(far)) : '—', gs = far ? O.give(STUN_THERE, O.targetAt(far)) : '—';
      // …and one close by with a wall between it and every man
      let walled: number[] | null = null;
      for (let x = 2; x <= 38 && !walled; x += 0.5) for (let z = 2; z <= 26 && !walled; z += 0.5) { const t = O.targetAt([x, 0, z]); if (t.kind !== 'floor') continue; const d = Math.min(...team.map((m: any) => dist(m.char.pos, t.at)));
        if (d > 3 && d < 8 && team.every((m: any) => game.col.solidBlocked([m.char.pos[0], 1.3, m.char.pos[2]], [t.at[0], 0.3, t.at[2]]) && game.col.solidBlocked([m.char.pos[0], 2.3, m.char.pos[2]], [t.at[0], 2.3, t.at[2]])) && !ST.squadThrower(game, team, t.at, 'stun')) walled = t.at; }
      const gw = walled ? O.give(STUN_THERE, O.targetAt(walled)) : '—';
      verdict(!!far && gf === 'no throw from here.' && gs === 'no throw from here.' && !!walled && gw === 'no throw from here.' && game.doorTools.frags === 2 && game.doorTools.bangs === 3 && game.items.items.length === n0,
        'a spot more than 14 m from every man, and one a few metres off behind a wall floor to ceiling: "no throw from here." for both kinds, nothing thrown, nothing spent',
        `far ${far ? p2(far) : 'none'}: '${gf}' / '${gs}' · walled ${walled ? p2(walled) : 'none'}: '${gw}' · frags ${game.doorTools.frags} bangs ${game.doorTools.bangs}`);
      // a teammate inside it
      const close = find(R, [4, 5, 3.5], at => !!ST.squadThrower(game, team, at, 'frag') && dist(game.player.char.pos, at) > 10);
      const pc = close ? R.page(close) : [], n1 = game.items.items.length; if (close) { R.press('Digit1'); R.step(3); } const upC = !!O.menu; R.esc();
      const def = O.defs.find((d: any) => d.id === FRAG_THERE), forced = close && def ? def.issue(O, team, O.targetAt(close)) : '—';
      verdict(!!close && pc.length === 2 && pc[0].off && /^frag there · 2 left.*(Red|Blue) (One|Two) is in it\.?$/.test(pc[0].text) && !pc[1].off && game.items.items.length === n1 && game.doorTools.frags === 2 && typeof forced === 'string' && /is in it\.$/.test(forced),
        'a spot four metres from the squad: the frag row is greyed naming the teammate inside it, 1 throws nothing, the stun row is live; the order\'s own `issue`, called past the menu, refuses in the same words and spends nothing',
        `spot ${close ? p2(close) : 'none'} · page: ${show(pc)} · forced: '${forced}' · frags ${game.doorTools.frags} · items ${n1} → ${game.items.items.length} · menu up ${upC}`);
      // the player inside it (the first spot: no teammate is)
      const by = samSpot(R, spot, 4); if (by) R.sam(by); SAMSTUN.on = true;
      const ps = by && floorAt(R, spot) ? R.page(spot) : [], n2 = game.items.items.length; if (ps.length) { R.press('Digit1'); R.step(3); } R.esc();
      const forcedS = def && by ? def.issue(O, team, O.targetAt(spot)) : '—';
      verdict(!!by && ps.length === 2 && ps[0].off && /you are in it/.test(ps[0].text) && game.items.items.length === n2 && game.doorTools.frags === 2 && forcedS === 'you are in it.' && !ps[1].off && /^bang there · 3 left · too close: you$/.test(ps[1].text),
        'Sam stood four metres from the first spot with a line to it: the frag row is greyed "you are in it.", 1 throws nothing and `issue` called past the menu refuses and spends nothing; the stun row is live and says "· too close: you"',
        `Sam ${by ? p2(by) : 'no place'} · spot ${p2(spot)} · page: ${show(ps)} · forced: '${forcedS}' · frags ${game.doorTools.frags}`);
      SAMSTUN.on = false; R.step(2); const psOff = by ? R.pageAt(spot) : []; R.esc(); SAMSTUN.on = true;
      if (away) R.sam(away); const psAway = R.pageAt(spot); R.esc();
      verdict(psOff.length === 2 && psOff[1].text === 'bang there · 3 left' && psAway.length === 2 && psAway[1].text === 'bang there · 3 left' && !psAway[0].off,
        'the stun row warns of nobody where nobody would be caught: with blasts not stunning the player (the frozen stand\'s rule) it does not name him, and with him stood away again it names nobody and the frag row is live', `player not stunned by blasts: ${show(psOff)} · Sam away: ${show(psAway)}`);
    });

    // ───────────── 2 · the stun: a defender with a line to it is blinded ─────────────
    await guard('the stun', async () => {
      const R = await rig(7, ON, { keep: true }), { O, game } = R, team = R.team, foe = R.foe;
      const spot = find(R, [7, 8, 6, 9], at => { const th = ST.squadThrower(game, team, at, 'stun'); return !!th && ST.squadStunCatches(game, th.rest, at).length === 0; });
      if (!spot || !foe) { verdict(false, 'a spot a teammate has a stun throw to that would catch nobody of ours, and a defender to stand by it', `spot ${spot ? p2(spot) : 'none'} · defender ${!!foe}`); return; }
      // the defender: within three metres of the spot with a line to it, where no man of the squad sees him
      let at: number[] | null = null;
      for (const d of [2, 2.5, 1.5, 3]) { for (let k = 0; k < 24 && !at; k++) { const a = k * Math.PI / 12, p = [spot[0] + Math.sin(a) * d, 0, spot[2] + Math.cos(a) * d], t = O.targetAt(p);
          if (t.kind !== 'floor' || dist(t.at, p) > 0.3 || game.col.segmentBlocked([spot[0], 0.5, spot[2]], [p[0], 1.6, p[2]])) continue;
          if ([...team.map((m: any) => m.char.pos), game.player.char.pos].every((q: number[]) => game.col.segmentBlocked([q[0], 1.6, q[2]], [p[0], 1.6, p[2]]) && game.col.segmentBlocked([q[0], 1.6, q[2]], [p[0], 0.9, p[2]]))) at = p; } if (at) break; }
      if (!at) at = [spot[0] + 1.5, 0, spot[2]];
      place(foe, at, Math.atan2(spot[0] - at[0], spot[2] - at[2])); foe.hold = true; foe.pinned = true; R.step(5);
      const before = foe.dazzledUntil ?? 0, th0 = ST.squadThrower(game, team, spot, 'stun');
      const page = floorAt(R, spot) ? R.page(spot) : []; R.press('Digit2');
      const it = R.items('flash')[0], who = it ? team.find((m: any) => m.char.id === it.who) : null, word = WORDS.on ? 'bang out!' : 'bang out.';
      const saidIt = R.lines.some(l => l.who === who?.callsign && l.text === word), block = R.notes();
      verdict(page.length === 2 && !page[1].off && page[1].text === 'bang there · 3 left' && !!it && !!who && who === th0?.gd && game.doorTools.bangs === 2 && game.doorTools.frags === 2 && saidIt && !O.menu && O.log.at(-1)?.order === STUN_THERE && block.includes(`${who.callsign} · bang out`),
        `X, G, 2: the nearest man with a throw tosses a stun canister — the item is his; he says "${word}"; the squad's bangs are one fewer and its frags untouched; the order log and the squad block have it`,
        `${who?.callsign ?? 'nobody'}, spot ${p2(spot)} (${who ? f1(dist(who.char.pos, spot)) : '—'} m) · page: ${show(page)} · item ${it ? `'${it.kind}' who ${it.who}` : 'none'} · bangs ${game.doorTools.bangs} · said ${saidIt} · block ${JSON.stringify(block.filter(t => /out/.test(t)))}`);
      let last = it ? [...it.pos] : [NaN, 0, NaN];
      R.until(() => { if (it && !it.fired) last = [...it.pos]; return !it || it.fired; }, 6); R.step(3);
      const blind = (foe.dazzledUntil ?? 0) - game.time, mates = team.filter((m: any) => (m.dazzledUntil ?? 0) > game.time).map((m: any) => m.callsign);
      verdict(!!it && it.fired && dist(last, spot) < 1.5 && blind > 1 && (foe.dazzledUntil ?? 0) > before && mates.length === 0,
        'the canister goes off within a metre and a half of the spot (its fuse runs from where it lands); the defender stood by the spot with a line to it is blinded for seconds; no teammate is (the row named nobody)',
        `went off at ${p2(last)}, ${dist(last, spot).toFixed(2)} m from the spot · defender at ${p2(foe.char.pos)} (${f1(dist(foe.char.pos, last))} m) blind for ${f1(blind)} s · teammates blinded: ${mates.join(', ') || 'none'}`);
      // one pair addressed: only that pair's men are asked
      R.step(120); const pairOf = (m: any) => m.unit?.pair;
      const two = find(R, [6, 7, 5, 8, 9], q => { const th = ST.squadThrower(game, team, q, 'stun'); if (!th) return false; const other = team.filter((m: any) => pairOf(m) !== pairOf(th.gd)); return !!ST.squadThrower(game, other, q, 'stun'); });
      if (!two) { verdict(false, 'a spot men of both pairs have a throw to', 'none found'); return; }
      const first = ST.squadThrower(game, team, two, 'stun').gd, otherPair = pairOf(first) === 'red' ? 'blue' : 'red', n0 = R.items('flash').length;
      const g = O.give(STUN_THERE, O.targetAt(two), otherPair); const it2 = R.items('flash').at(-1), who2 = team.find((m: any) => m.char.id === it2?.who);
      verdict(g === null && R.items('flash').length === n0 + 1 && !!who2 && pairOf(who2) === otherPair && who2 !== first && O.log.at(-1)?.who.join() === who2.callsign,
        'a spot the nearest man of ALL has a throw to, the order given to the other pair: a man of THAT pair throws it', `spot ${p2(two)} · nearest of all ${first.callsign} (${pairOf(first)}) · told ${otherPair}: '${g}' · thrown by ${who2?.callsign ?? 'nobody'}`);
    });

    // ───────────── 3 · a hostage inside (the rescue) ─────────────
    await guard('a hostage', async () => {
      const R = await rig(5, ON, { rescue: true, squad: 2 }), { O, game } = R, team = R.team, hostages: any[] = game.rescue?.hostages ?? [];
      const h = hostages.find((x: any) => x.state !== 'dead');
      if (!h || R.why) { verdict(false, 'the rescue staged with a living hostage', `start: ${R.why} · hostages ${hostages.length}`); return; }
      // a spot two metres from her with a line; Sam and the squad taken well away from it (the far end of the floor)
      let spot: number[] | null = null; const hp = h.char.pos;
      for (const d of [2, 1.5, 2.5]) for (let k = 0; k < 16 && !spot; k++) { const a = k * Math.PI / 8, p = [hp[0] + Math.sin(a) * d, 0, hp[2] + Math.cos(a) * d], t = O.targetAt(p); if (t.kind === 'floor' && dist(t.at, p) < 0.3 && !game.col.solidBlocked([p[0], 0.9, p[2]], [hp[0], 1.1, hp[2]])) spot = t.at; }
      if (!spot) { verdict(false, 'a spot of floor two metres from a hostage with a line to her', 'none'); return; }
      const direct = ST.squadFragCatches(game, spot, spot);
      const ours = [...team.map((m: any) => m.callsign), 'you'], oursIn = /you are in it|is in it/.test(direct ?? '');
      // (who of ours is inside it is asked first: taken out of the question, the hostage is what is left)
      let alone = direct; if (oursIn) { const away = samSpot(R, spot, null); if (away) R.sam(away); for (const m of team) { const q = samSpot(R, spot, null); if (q) place(m, [q[0] + 0.8, 0, q[2]]); } alone = ST.squadFragCatches(game, spot, spot); }
      // …and through the order: a thrower with an arc is stood for it, if the floor has such a place more than nine metres off
      let viaOrder: string | null = '—';
      { const m = team[0]; outer: for (let x = 2; x <= 38; x += 0.75) for (let z = 2; z <= 26; z += 0.75) { const t = O.targetAt([x, 0, z]); if (t.kind !== 'floor' || dist(t.at, spot) < 9.3 || dist(t.at, spot) > 12.5) continue;
          const keep = [...m.char.pos]; place(m, t.at); if (ST.squadThrower(game, [m], spot, 'frag') && ST.squadFragCatches(game, spot, spot) === 'hostages. no frag.') { const frags = game.doorTools.frags, def = O.defs.find((d: any) => d.id === FRAG_THERE); viaOrder = def ? def.issue(O, [m], O.targetAt(spot)) : 'no order'; if (game.doorTools.frags !== frags || R.items('frag').length) viaOrder = 'SPENT'; break outer; } place(m, keep); } }
      verdict(alone === 'hostages. no frag.' && (viaOrder === '—' || viaOrder === 'hostages. no frag.'),
        'the rescue: a frag asked two metres from a living hostage with a line to her is refused "hostages. no frag." once nobody of ours is inside it (and, where the floor has a place to throw it from, the order itself refuses in those words and spends nothing)',
        `hostage ${h.callsign ?? ''} at ${p2(hp)}, spot ${p2(spot)} · as staged: '${direct}' (${ours.length} of ours asked first) · ours away: '${alone}' · through the order: '${viaOrder}'${viaOrder === '—' ? ' (NOT ASKED: no floor a man has an arc from, more than nine metres off, into her room)' : ''}`);
    });

    // ───────────── 4 · a silent squad ─────────────
    await guard('silent', async () => {
      const R = await rig(7, ON, { silent: true }), { O, game } = R, team = R.team;
      SLM.setSilent(game, true); R.step(5); const was = SLM.squadSilent(game);
      const spot = find(R, [7, 8, 6, 9], at => !!ST.squadThrower(game, team, at, 'stun'));
      if (!spot) { verdict(false, 'a spot a teammate has a stun throw to', 'none'); return; }
      const page = R.page(spot); R.press('Digit2'); R.step(3); const now = SLM.squadSilent(game), it = R.items('flash')[0];
      verdict(was && page.length === 2 && page.every(r => / · LOUD/.test(r.text)) && !!it && !now,
        'a squad told to go silent: both rows are marked LOUD, and giving one takes the squad out of silent (the canister is thrown)', `silent before ${was} · page: ${show(page)} · thrown ${!!it} · silent after ${now}`);
    });

    // ───────────── 5 · off = the build; on with nothing ordered = the same run ─────────────
    await guard('the digest', async () => {
      const minute = async (on: boolean) => { const Q = await rig(23, on, { live: true }); const out: string[] = []; let rowSeen = false, pageSeen = false;
        for (let f = 0; f < 60 * 45; f++) { if (f === 200) { const p = Q.game.player.char.pos; Q.cursor([p[0] + 1.8, 0, p[2] + 0.4]); Q.input.pressed.add(ORDERS.key); }
          if (on && f === 206) Q.input.pressed.add(FRAG.orderKey); if (on && f === 220) Q.input.pressed.add('Escape'); if (f === 230) Q.input.pressed.add('Escape');
          Q.step(); if (f === 205) rowSeen = Q.rows().some((r: Row) => r.text.startsWith('throw')); if (f === 212) pageSeen = Q.O.menu?.page === 'throw'; if (f % 30 === 0) out.push(JSON.stringify(digestGame(Q.game))); }
        return { out, rowSeen, pageSeen, up: !!Q.O.menu, items: Q.game.items.items.length }; };
      const a = await minute(false), b = await minute(ON), diff = a.out.findIndex((x, i) => x !== b.out[i]);
      verdict(a.out.length === 90 && diff < 0 && !a.rowSeen && b.rowSeen && b.pageSeen && !b.up && !a.up,
        'forty-five scripted seconds of the room clear as it stages (X on the floor and Esc with the switch off; X, G, Esc, Esc with it on — the row seen, the page opened, nothing ordered) digest the same at every sampled frame',
        `${a.out.length} digests · first difference ${diff < 0 ? 'none' : `sample ${diff}`} · off: row ${a.rowSeen} · on: row ${b.rowSeen}, page ${b.pageSeen}`);
    });
    // ───────────── 6 · busy hands, G twice, a man down and breathing ─────────────
    await guard('hands, the key twice, a man down', async () => {
      const R = await rig(7, ON), { O, game } = R, team = R.team, quick = QUICKTHROW.on;
      try {
        const clear = (at: number[]) => { const th = ST.squadThrower(game, team, at, 'frag'); return !!th && !ST.squadFragCatches(game, th.rest, at); };
        const spot = find(R, [10, 10.5, 11, 9.5, 11.5], at => !!ST.squadThrower(game, team, at, 'frag') && !team.some((m: any) => dist(m.char.pos, at) < 9.5 && !game.col.solidBlocked([at[0], 0.9, at[2]], [m.char.pos[0], 1.1, m.char.pos[2]])));
        if (!spot) { verdict(false, 'a spot of floor a teammate has a frag throw to with no teammate inside its reach', 'none found'); return; }
        const away = samSpot(R, spot, null); if (away) R.sam(away);
        if (!floorAt(R, spot) || !clear(spot)) { verdict(false, 'the spot is in the camera\'s view with Sam stood away from it, and still a clear frag', `spot ${p2(spot)}`); return; }
        // (a) the man whose hands are on something else is passed over — asked of the picker itself, nothing stepped between the asks
        const th0 = ST.squadThrower(game, team, spot, 'frag').gd, who = (x: any) => x ? x.gd.callsign : 'nobody';
        const withOp = (list: any[], phase: string) => { list.push({ lead: th0, phase }); const th = ST.squadThrower(game, team, spot, 'frag'); list.pop(); return th; };
        const door = withOp(game.doorTools.ops, 'place'), boot = withOp(game.doorTools.ops, 'kick'), wall = withOp(game.wallCharge.ops, 'place'), stacked = withOp(game.doorTools.ops, 'stack');
        const r0 = th0.reloadT; th0.reloadT = 1; const mag = ST.squadThrower(game, team, spot, 'frag'); th0.reloadT = r0;
        const back = ST.squadThrower(game, team, spot, 'frag');
        verdict([door, boot, wall, mag].every(x => !x || x.gd !== th0) && stacked?.gd === th0 && back?.gd === th0,
          'the thrower is never the man setting a charge on a door or a wall, the man on a door\'s boot, or a man changing a magazine: another man throws or nobody does (a man only stacked may throw, and with his hands free again it is him)',
          `picked ${th0.callsign} · setting a door charge: ${who(door)} · on the boot: ${who(boot)} · setting a wall charge: ${who(wall)} · mid-reload: ${who(mag)} · stacked: ${who(stacked)} · after: ${who(back)}`);
        // (b) G again on the throw page: the press is the menu's, never Sam's own quick throw (asked with the quick throw ON, as the frozen stand has it)
        QUICKTHROW.on = true; game.player.canisters = Math.max(2, game.player.canisters ?? 0);
        R.page(spot); const pageUp = O.menu?.page === 'throw', n0 = game.items.items.length, bag0 = game.doorTools.frags + game.doorTools.bangs, cans0 = game.player.canisters + (game.player.flashbangs ?? 0);
        R.press(FRAG.orderKey); R.step(30);
        const n1 = game.items.items.length, cans1 = game.player.canisters + (game.player.flashbangs ?? 0);
        verdict(pageUp && O.menu?.page === 'throw' && n1 === n0 && cans1 === cans0 && game.doorTools.frags + game.doorTools.bangs === bag0 && !game.player.throwHeld,
          'G pressed again on the throw page: the page stays up, nothing is thrown by anybody, and Sam\'s own cans are untouched (with the G quick throw on)',
          `page before ${pageUp} · page after ${O.menu?.page ?? 'no menu'} · items ${n0} → ${n1} · Sam's cans ${cans0} → ${cans1}`);
        R.esc(); QUICKTHROW.on = quick;
        // (c) a teammate down and breathing by the spot is still one of ours; a dead one is not asked
        const m = team.find((x: any) => x !== th0), keepPos = [...m.char.pos], keepState = m.state, keepKind = m.downKind;
        let by: number[] | null = null;
        for (const d of [1.5, 2, 1]) for (let k = 0; k < 12 && !by; k++) { const a = k * Math.PI / 6, p = [spot[0] + Math.sin(a) * d, 0, spot[2] + Math.cos(a) * d], t = O.targetAt(p); if (t.kind === 'floor' && dist(t.at, p) < 0.3 && !game.col.solidBlocked([spot[0], 0.9, spot[2]], [p[0], 1.1, p[2]])) by = t.at; }
        if (!by) { verdict(false, 'floor beside the spot to lay a man on', 'none'); return; }
        place(m, by); const up = ST.squadFragCatches(game, spot, spot);
        m.state = 'dead'; m.downKind = 'struck'; const cold = ST.squadFragCatches(game, spot, spot);
        m.downKind = 'wounded'; const hurt = ST.squadFragCatches(game, spot, spot);
        m.downKind = 'shot'; const dead = ST.squadFragCatches(game, spot, spot);
        m.state = keepState; m.downKind = keepKind; place(m, keepPos);
        const his = `${m.callsign} is in it.`;
        verdict(up === his && cold === his && hurt === his && dead !== his && clear(spot),
          'a teammate lying out cold or wounded beside the spot refuses the frag by his name, as when he stood there; one shot dead does not (and with him back on his feet elsewhere the spot is clear again)',
          `${m.callsign} ${f1(dist(by, spot))} m from the spot · standing: '${up}' · out cold: '${cold}' · wounded: '${hurt}' · dead: '${dead}'`);
      } finally { QUICKTHROW.on = quick; }
    });
  } finally {
    SQUADTHROW.on = kept.on; SQUADTHROW.walk = kept.walk; SQUADTHROW.lob = kept.lob; SQUADTHROW.againSecs = kept.again; FRAG.on = kept.frag; SAMSTUN.on = kept.samstun; Object.assign(SLM.SILENT, kept.silent); NIGHTBREACH.squad = kept.squad; Math.random = kept.random;
  }
  console.log(`=== squadthrow: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await squadthrowCheck()) ? 0 : 1);
