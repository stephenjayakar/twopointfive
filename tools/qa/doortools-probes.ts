// The 'doortools' family (game/doortools.ts — a page of rows behind row 5 of the squad's order menu when it is opened on a door: open and clear, bang and clear,
// breach with a charge, and the turn to the threshold's page, where clear from outside now sits), run through probes.ts:
//   bun run tools/qa/probes.ts doortools | doortools-menu | doortools-charge | doortools-bang | doortools-outside | doortools-counts | doortools-lights | doortools-firstman
// PASS / FAIL each, all headless (the Game of headless.ts under the room clear's staging — game.roomClear.start(seed) — unless a probe says the night breach). The
// harness has no light meter: Sam's visibility is planted dark and he is in god mode (a round that finds him ends nothing: these probes are about the pair), and
// what anybody SEES of anybody is guards.ts's direct-light estimate, not the page's. Nothing here looks at a picture: the charge on the leaf, the flash and the
// leaf flying are untested by eye.
//   doortools-menu      with no squad nothing runs and nothing is offered; with one, X pressed on a door lists the order menu's own rows and then 5 door tools ▸ — the page
//                       behind it: 1 open and clear / 2 bang and clear · N left / 3 breach with a charge · N left / 4 work it from the threshold ▸ (no order is on a digit
//                       above 5); a floor's list is as it was; the counts stand on the squad's HUD block; a steel door refuses the charge in words; X, 5 and a
//                       digit runs its row; another order takes the men off it
//   doortools-charge    a charge order ends with a man at the lock, the squad stood off, the charge on the door — and then NOTHING until Sam's trigger (five
//                       seconds: the leaf shut, no blast, nobody touched, nobody over the frame line); the row reads 'blow the charge'; F blows it and the night
//                       breach's F drill does not get the press; the leaf is in, a man within knockM of its far side is down (out cold), the other men in reach
//                       are flash-blind and doubled over, men behind walls are not, the squad is not caught by it, and goes in behind it; steel refused; the row
//                       again blows a set charge on a LOCKED door (keep broken)
//   doortools-bang      bang and clear: stacked → opened → the can out → it goes off INSIDE the room's bounds → 'go' → the first man over the frame line, in that
//                       order; the pair is not blinded by its own can; a bang is spent; the men under the order shoot through the room fight (rounds fired with
//                       the order still theirs, orders.fight null: one mechanism); a locked door gets the boot first; a can in the air when the order is taken
//                       away goes off on a short fuse; the F drill's own can does the same when the pair is lost under it (breach.ts)
//   doortools-outside   clear from outside: the door opened, the men slice it from Sam's side, a defender is seen and shot at from out there, and for the whole of
//                       it NO man of the pair is inside the room's bounds or over the frame line — until an entry order, when they cross
//   doortools-counts    the counts run out: a bang spent, the row is refused in words and greyed, the F drill goes in without one and says so; a charge spent on
//                       being set, a second door is refused while the set one still blows; a restart puts the counts back
//   doortools-lights    the 64-light cap: with every slot of the upload taken by a steady light a charge is blown — nothing throws, the flash's own light is
//                       simply not uploaded (not drawn), and the men are stunned all the same (that is CPU-side); the staged night's own headroom is printed
//   doortools-firstman  the comparison: on an ALERTED floor (a bang heard four seconds before the order) the break room's west door by open and clear, by bang
//                       and clear and by a charge over six seeds — fewer first men lost behind the bang, and behind the charge, than through the plain door.
//                       The quiet floor's numbers are printed as information (there the plain door wins by surprise: that is the point of having three tools)
import { standUp, ROOT } from './headless.ts';
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { SQUADTHROW } = await import(`${ROOT}/src/game/squadthrow.ts`);
const { SILENT } = await import(`${ROOT}/src/game/silent.ts`);
const { killGuard, dropThrowable } = await import(`${ROOT}/src/game/combat.ts`);
const { MAX_LIGHTS } = await import(`${ROOT}/src/render/lights.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const DT_DEFAULTS = JSON.parse(JSON.stringify(DOORTOOLS)), RC_DEFAULTS = { ...ROOMCLEAR }, NB_DEFAULTS = { ...NIGHTBREACH };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** every probe leaves the knob tables as it found them, pass, fail or throw */
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS); } };

// where Sam stands for a door (his side of it is the side the squad works it from): the corridor, off the line of the opening
const SAM: Record<string, number[]> = { breakroom_w: [25.0, 0, 18.9], manager: [24.0, 0, 11.2], storage: [30.8, 0, 11.2], stairwell: [7.5, 0, 17.6] };
const AISLE: number[] = [15, 0, 17.6];

/** One game under a seed: the room clear staged (`stage: 'nb'` = the night breach alone, false = neither), Sam put by `door`, in god mode and dark.
 *  `hot`: a stun canister goes off in the lobby four seconds before the probe starts — the whole floor has heard it (the pair's eyes are given back). */
export async function rig(seed: number, o: { stage?: 'rc' | 'nb' | false; door?: string; hot?: boolean; /** false: squads from the rooms (SQUADDEAL) held off for this floor, by the stand's own word */ deal?: boolean; knobs?: Record<string, unknown>; nb?: Record<string, unknown> } = {}) {
  Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS)), o.knobs ?? {}); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS, o.nb ?? {});
  Math.random = seeded(seed);
  const sd0 = process.env.TPS_SQUADDEAL; if (o.deal === false) process.env.TPS_SQUADDEAL = '0';
  const W: any = await standUp().finally(() => { if (o.deal !== false) return; if (sd0 === undefined) delete process.env.TPS_SQUADDEAL; else process.env.TPS_SQUADDEAL = sd0; }); const game = W.game, input = W.input; const RC = game.roomClear, NB = game.nightBreach, O = game.orders, D = game.doorTools;
  game.godMode = true;
  const said: string[] = []; { const msg = game.msg.bind(game); game.msg = (t: string) => { said.push(t); msg(t); }; }
  const stage = o.stage ?? 'rc';
  const why = stage === 'rc' ? RC.start(seed) : stage === 'nb' ? NB.start() : null;
  const seen = new Set<any>();
  const R = { W, game, input, RC, NB, O, D, why, said, bad: '', t0: 0,
    /** rounds fired, by team · the same, by a man with an order of the menu's on him at that moment · every blast, when and where · who went down, when, by whom */
    shots: {} as Record<string, number>, orderedShots: 0, bangs: [] as { t: number; pos: number[] }[], downs: [] as { who: any; t: number; by: string }[],
    /** the most any man of the pair has been blinded for, as seen on any frame */
    opDazzle: 0,
    /** run after every frame */
    post: null as null | (() => void),
    get ops(): any[] { return NB.ops; }, get hostiles(): any[] { return NB.hostiles; },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        game.player.visibility = 0.05;
        const was = game.guards.map((x: any) => [x, x.state] as const);
        W.step(DT);
        for (const e of game.events) { if (seen.has(e)) continue; seen.add(e);
          if (e.kind === 'guardShot') { const w = game.guards.find((x: any) => x.char.id === e.who); const k = w ? w.team : '?'; R.shots[k] = (R.shots[k] ?? 0) + 1; if (w && w.team === 'operative' && O.of(w)) R.orderedShots++; }
          if (e.kind === 'bang') R.bangs.push({ t: e.time, pos: [...e.pos] }); }
        for (const [x, st] of was) if (st !== 'dead' && x.state === 'dead') R.downs.push({ who: x, t: game.time, by: game.guards.find((k: any) => k.char.id === x.killerId)?.callsign ?? String(x.killerId) });
        for (const x of R.ops) if (x.state !== 'dead') R.opDazzle = Math.max(R.opDazzle, x.dazzledUntil - game.time);
        for (const x of game.guards) if (!R.bad && !x.char.pos.every(Number.isFinite)) R.bad = `${x.callsign} at ${x.char.pos}`;
        R.post?.();
      }
    },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    press(code = 'KeyF') { input.pressed.add(code); R.step(); },
    door(name: string): any { return game.doors.list.find((d: any) => d.def.name === name); },
    target(name: string) { return O.targetAt(R.door(name).frameCentre); },
    /** the order by its id on a door, as the menu's row would give it (null: taken; else the refusal's words) */
    give(id: string, name: string): string | null { return O.give(id, R.target(name)); },
    /** this module's order under way — or the last one that ended */
    get op(): any { return D.ops[0] ?? D.done[D.done.length - 1] ?? null; },
    beatT(op: any, what: string | RegExp): number { const b = op?.beats.find((b: any) => typeof what === 'string' ? b.what === what || b.what.startsWith(what) : what.test(b.what)); return b ? b.t : NaN; },
    beats(op: any): string { return (op?.beats ?? []).map((b: any) => `${f2(b.t - R.t0)} ${b.what}`).join(' | '); },
    room(id: string) { return RC.rooms.find((r: any) => r.def.id === id); },
    /** press X with the cursor on p (the order menu comes up and stays, nothing held), read its order rows, Esc */
    menuOn(p: number[]) {
      W.cursorAt([p[0], p[1], p[2]]); input.pressed.add(ORDERS.key); R.step(); R.step(24);
      const read = () => { const M = O.menu, hud = O.hud().menu; return M ? { ids: M.rows.map((r: any) => r.id).join(' '), why: [...M.why] as (string | null)[], kind: M.target.kind as string,
        rows: (hud?.rows ?? []).slice(1).filter((r: any) => r.kind !== 'cancel').map((r: any) => ({ key: r.opts[0]?.key, text: r.opts[0]?.text, off: r.off })) } : null; };   // (row 0 = who the order goes to)
      const first = read(); if (!first) { input.pressed.add('Escape'); R.step(); return null; }
      // the door tools are a page of the door's menu, behind its row 5: read by that key, then Esc back to the first page (and Esc again: the menu away)
      const opener = O.menu.rows.find((r: any) => r.opens); let tools: ReturnType<typeof read> = null, back = true;
      if (opener) { input.pressed.add(`Digit${opener.key}`); R.step(); R.step(4); tools = O.menu?.page === opener.opens ? read() : null; input.pressed.add('Escape'); R.step(); back = !!O.menu && O.menu.page === null; }
      input.pressed.add('Escape'); R.step();
      return { ...first, tools, back, gone: O.menu === null };
    },
    /** press X on p, then the digit a third of a second later — more digits walk the menu's pages (5, 1 = the door tools' page, its first row) */
    pick(p: number[], ...n: number[]) { W.cursorAt([p[0], p[1], p[2]]); input.pressed.add(ORDERS.key); R.step(); R.step(20); for (const k of n) { input.pressed.add(`Digit${k}`); R.step(); } },
  };
  R.step(30);
  if (o.door) { game.teleportPlayer(SAM[o.door]); R.step(5); }
  if (o.hot) { dropThrowable(game, 'flash', [12, 0, 18]); R.step(60 * 4); for (const x of R.ops) x.dazzledUntil = 0; R.opDazzle = 0; R.bangs.length = 0; }
  R.t0 = game.time;
  return R;
}
const inBounds = (b: { x0: number; x1: number; z0: number; z1: number }, p: number[], m = 0) => p[0] > b.x0 - m && p[0] < b.x1 + m && p[2] > b.z0 - m && p[2] < b.z1 + m;
const isOpen = (d: any) => !d.latched && Math.abs(d.angle) >= 0.6;

// ---------------------------------------------------------------- menu
export const doortoolsMenu = guarded(async () => {
  const { verdict, done } = family('doortools-menu: the four rows of the door tools\' page, their digits, their counts, and nothing at all with no squad');
  { const R = await rig(3, { stage: false, door: 'breakroom_w' }); const { O, D } = R;
    const m = R.menuOn(R.door('breakroom_w').frameCentre); const w = R.give('bangClear', 'breakroom_w'); R.step(30);
    verdict(!O.active && m === null && !!w && D.ops.length === 0 && D.log.length === 0 && D.set.length === 0 && O.hud().status.length === 0,
      'with no squad on the floor: no list on X, the order refused, nothing under way, nothing logged, no HUD block', `orders active ${O.active} · menu ${m} · give: ${w} · ops ${D.ops.length} · log ${D.log.length} · ${D.summary()}`); }
  const R = await rig(3, { door: 'breakroom_w' }); const { O, D } = R; const Wd = R.door('breakroom_w');
  const m = R.menuOn(Wd.frameCentre);
  // (row 4 of the page is read under the stand's own rule, each stand held to its own words: the turn to the threshold's page, or — DOORTOOLS.outsidePlain,
  // a FROZEN_HOLDS row, on in the page — the one plain order 'clear from outside'. The floor's list below likewise: the four orders, then exactly the rows
  // whose switches are on — the squad throw's (SQUADTHROW.on) and go silent (SILENT.on); the frozen stand has neither.)
  const plain = !!DOORTOOLS.outsidePlain, row4 = plain ? { id: 'thresholdHold', text: '4 clear from outside' } : { id: 'thr', text: '4 work it from the threshold ▸' };
  verdict(!!m && m.kind === 'door' && m.ids === 'stack cover fallIn hold tools' && m.rows[4]?.key === '5' && m.rows[4]?.text === 'door tools ▸' && m.tools?.ids === `openClear bangClear charge ${row4.id} fragClear` && m.back && m.gone,
    'X pressed on a door: the order menu\'s own four rows, then row 5 — the door tools, a page of four behind it and the frag row on G at its foot (Esc there steps back to the first page, Esc again closes)', `rows: ${m?.ids} ▸ ${m?.tools?.ids} · row 5 "${m?.rows[4]?.text}" · back ${m?.back} · gone ${m?.gone}`);
  const tools = m?.tools?.rows ?? [];
  verdict(tools.map((r: any) => `${r.key} ${r.text}`).join(' | ') === `1 open and clear | 2 bang and clear · ${DOORTOOLS.bangs} left | 3 breach with a charge · ${DOORTOOLS.charges} left | ${row4.text} | G frag and clear · ${D.frags} left` && D.frags === 2 && tools.every((r: any) => !r.off),
    `digits 1 to 4 on that page, the bangs and the charges counted on their rows, row 4 ${plain ? 'the one order from outside (outsidePlain)' : 'the turn to the threshold\'s page'}, the frags on G below them (no digit taken), none greyed on an ordinary shut door`, tools.map((r: any) => `${r.key} ${r.text}${r.off ? ' (off)' : ''}`).join(' | '));
  const fl = R.menuOn(AISLE);
  const floorIds = `move cover fallIn hold${SQUADTHROW.on ? ' throwThere' : ''}${SILENT.on ? ' silent' : ''}`;
  verdict(!!fl && fl.kind === 'floor' && fl.ids === floorIds && fl.tools === null, 'a floor\'s list is as it was (the four orders, then only the rows whose own switches are on): no door tool is offered off a door, and no page', `rows: ${fl?.ids} · held to: ${floorIds}`);
  const notes = O.hud().status.flatMap((r: any) => r.opts.map((o: any) => o.text));
  verdict(notes.includes(`charges ${DOORTOOLS.charges} · bangs ${DOORTOOLS.bangs}`) && D.charges === DOORTOOLS.charges && D.bangs === DOORTOOLS.bangs, 'the counts stand on the squad\'s HUD block', notes.join(' / '));
  { R.game.teleportPlayer(SAM.stairwell); R.step(5); const st = R.door('stairwell'); const w = R.give('charge', 'stairwell'); R.step(2);
    verdict(!!st?.def.steel && /steel/.test(w ?? '') && D.charges === DOORTOOLS.charges && D.ops.length === 0 && D.set.length === 0,
      'the steel stair door: a charge is refused in words (the row\'s own test — a refusal greys a row with the same words, as doortools-counts shows), none is spent', `give: ${w} · charges ${D.charges} · ${D.summary()}`);
    R.game.teleportPlayer(SAM.breakroom_w); R.step(5); }
  R.pick(Wd.frameCentre, 5, 1); const op = D.ops[0];
  verdict(!!op && op.kind === 'openClear' && op.door === Wd && op.men.length === 2 && op.phase === 'stack' && R.ops.every((x: any) => O.of(x)?.order === 'openClear'),
    'X, 5, 1 on the door runs open and clear: both men are on it, walking to the stack', D.summary());
  O.give('hold', O.targetAt(AISLE)); R.step(3);
  verdict(D.ops.length === 0 && D.done.length === 1 && R.ops.every((x: any) => O.of(x)?.order === 'hold'), 'another order takes the men off it: the door order ends, the men are the new order\'s', `${D.summary()} · ended: ${D.done[0]?.ended}`);
  return done();
});

// ---------------------------------------------------------------- the charge
export const doortoolsCharge = guarded(async () => {
  const { verdict, done } = family('doortools-charge: set, stood off, NOTHING until the trigger, then the door in and the men behind it stunned or down');
  const K = DOORTOOLS; const R = await rig(7, { door: 'breakroom_w' }); const { O, D, NB, game } = R; const Wd = R.door('breakroom_w'); const room = R.room('breakroom');
  const w = R.give('charge', 'breakroom_w'); const op = D.ops[0];
  const armed = R.until(() => op?.phase === 'armed', 45);
  const quietNow = () => Wd.latched && Math.abs(Wd.angle) < 0.02 && R.bangs.length === 0 && R.hostiles.every((h: any) => h.state !== 'dead' && h.dazzledUntil <= game.time && h.staggerUntil <= game.time) && op.crossed.size === 0;
  verdict(w === null && armed && D.set.length === 1 && D.set[0].door === Wd && D.charges === K.charges - 1 && !isNaN(R.beatT(op, 'set')) && R.beatT(op, 'set') < R.beatT(op, 'armed'),
    'the order: a man to the lock, the charge on the door (one spent), the squad stood off and waiting', `${R.beats(op)} · ${D.summary()}`);
  const off = R.ops.map((x: any) => dist(x.char.pos, Wd.frameCentre));
  verdict(armed && off.every(d => d > K.backblastM) && quietNow(), 'armed: the pair is off the door past the backblast, the leaf is shut, no blast, nobody touched', `pair ${off.map(f2).join(' / ')} m from the door (backblast ${K.backblastM}) · latched ${Wd.latched} · blasts ${R.bangs.length}`);
  let still = true; for (let i = 0; i < 5 * 60; i++) { R.step(); still &&= quietNow() && op.phase === 'armed' && D.set.length === 1; }
  verdict(still, 'and NOTHING happens for five more seconds: it waits on Sam', `phase ${op.phase} · set ${D.set.length} · latched ${Wd.latched} · blasts ${R.bangs.length} · over the line ${op.crossed.size}`);
  const row = R.menuOn(Wd.frameCentre)?.tools?.rows.find((r: any) => r.key === '3'); const hud = O.hud().status.flatMap((r: any) => r.opts.map((o: any) => o.text));
  verdict(row?.text === 'blow the charge' && !row.off && hud.some((t: string) => /charge set/.test(t)), 'the row on that door now reads "blow the charge", and the HUD says a charge is set and which key blows it', `tools row 3: ${row?.text} · hud: ${hud.join(' / ')}`);
  // the trigger. One of the room's men is stood a stride inside the door first (the probe's staging, at the last moment: where a man IS when it goes is the rule)
  const near = room.defenders[0], far = room.defenders[1]; near.char.pos[0] = Wd.frameCentre[0] + 1.3; near.char.pos[2] = Wd.frameCentre[2]; R.step(2);
  const nearD = dist(near.char.pos, Wd.frameCentre), farD = dist(far.char.pos, Wd.frameCentre), drill0 = NB.drill?.phase, others = R.hostiles.filter((h: any) => !room.defenders.includes(h));
  R.press('KeyF');
  const blown = D.stats.blown === 1 && D.set.length === 0 && R.bangs.length === 1;
  verdict(blown && !Wd.latched && Wd.lockBroken && NB.drill?.phase === drill0, 'F blows it: one blast, the keep broken, the leaf off its latch — and the night breach\'s F drill never saw the press',
    `blown ${D.stats.blown} · blasts ${R.bangs.length} · latched ${Wd.latched} · lock broken ${Wd.lockBroken} · drill ${drill0} → ${NB.drill?.phase} · said: ${R.said.filter(t => /charge blown/.test(t)).join(' / ')}`);
  const farStun = far.dazzledUntil - game.time, farStag = far.staggerUntil - game.time;
  verdict(nearD < K.knockM && near.state === 'dead' && near.downKind === 'struck' && (farD >= K.stunM || (far.state !== 'dead' && farStun > K.stunSecs[1] - 0.1 && farStag > K.staggerSecs - 0.1)),
    'a man within knockM of the door\'s far side is down (out cold); the room\'s other man, in reach, is flash-blind and doubled over', `near ${f2(nearD)} m: ${near.state} (${near.downKind}) · the other ${f2(farD)} m: blind ${f2(farStun)} s, doubled over ${f2(farStag)} s`);
  verdict(others.every((h: any) => h.state !== 'dead' && h.dazzledUntil <= game.time && h.staggerUntil <= game.time) && R.opDazzle <= 0, 'men in other rooms, behind walls, are untouched; the pair, stood off, is not caught by its own charge',
    `other rooms: ${others.map((h: any) => `${h.callsign} ${h.state} blind ${f2(Math.max(0, h.dazzledUntil - game.time))}`).join(', ')} · pair blinded at most ${f2(Math.max(0, R.opDazzle))} s`);
  const tBlow = R.beatT(op, 'blow'); const crossed = R.until(() => op.crossed.size > 0, 8); const tCross = Math.min(...[...op.crossed.values()] as number[]);
  verdict(crossed && tCross > tBlow && isOpen(Wd), 'the squad goes in behind it: the first man is over the frame line after the blast, through an open door', `${R.beats(op)}`);
  R.until(() => D.ops.length === 0, 12);
  verdict(R.orderedShots > 0 && O.fight === null && !R.bad, 'under the order the men shoot through the room fight (rounds fired with the order still theirs; orders.fight is not used)', `rounds fired under an order ${R.orderedShots} · pair ${R.shots.operative ?? 0} · orders.fight ${O.fight} · ${D.summary()}`);
  // a locked door, and the trigger from the menu's row
  { const R2 = await rig(7, { door: 'manager' }); const D2 = R2.D, Md = R2.door('manager'); const locked0 = Md.locked;
    const w2 = R2.give('charge', 'manager'); const op2 = D2.ops[0]; const armed2 = R2.until(() => op2?.phase === 'armed', 45);
    const shut = Md.latched && R2.bangs.length === 0; const w3 = R2.give('charge', 'manager'); R2.step(2);
    verdict(w2 === null && locked0 && armed2 && shut && w3 === null && D2.stats.blown === 1 && !Md.latched && Md.lockBroken && R2.bangs.length === 1 && D2.charges === K.charges - 1,
      'a LOCKED door: set and waiting the same; the row given again ("blow the charge") is the trigger — the lock is broken, the leaf is in, one charge spent', `locked ${locked0} · ${R2.beats(op2)} · blown ${D2.stats.blown} · lock broken ${Md.lockBroken}`); }
  return done();
});

// ---------------------------------------------------------------- the bang
export const doortoolsBang = guarded(async () => {
  const { verdict, done } = family('doortools-bang: a stun in the room before the first man is over the threshold');
  const K = DOORTOOLS; const R = await rig(7, { door: 'breakroom_w' }); const { O, D, game } = R; const Wd = R.door('breakroom_w'); const room = R.room('breakroom');
  let blindAtBang = -1; R.post = () => { const op = D.ops[0]; if (blindAtBang < 0 && op && !isNaN(op.bangT)) blindAtBang = room.defenders.filter((h: any) => h.dazzledUntil > game.time).length; };
  const w = R.give('bangClear', 'breakroom_w'); const op = D.ops[0];
  R.until(() => D.ops.length === 0, 40);
  const T = (s: string | RegExp) => R.beatT(op, s); const tCross = op.crossed.size ? Math.min(...[...op.crossed.values()] as number[]) : NaN;
  verdict(w === null && T('stacked') <= T('shove') && T('shove') < T('toss') && T('toss') < T('bang') && T('bang') < T('go') && T('go') < tCross,
    'the order of it: stacked, the door opened, the can out, the bang, "go", and only then the first man over the frame line', R.beats(op));
  verdict(!!op.bangAt && inBounds(room.def.bounds, op.bangAt) && R.bangs.length === 1 && Math.abs(R.bangs[0].t - op.bangT) < 0.05 && tCross - op.bangT >= K.afterBang,
    'the can goes off INSIDE the room\'s bounds, and the first man crosses no sooner than afterBang behind it', `bang at ${op.bangAt ? at(op.bangAt) : '—'} (room x ${room.def.bounds.x0}‥${room.def.bounds.x1}) · first man over ${f2(tCross - op.bangT)} s after it`);
  verdict(blindAtBang >= 1 && R.opDazzle <= 0 && D.bangs === K.bangs - 1, 'it blinds the room (not the pair, whose heads are turned), and one bang is spent', `room's men blind at the bang ${blindAtBang}/${room.defenders.length} · pair blinded at most ${f2(Math.max(0, R.opDazzle))} s · bangs left ${D.bangs}`);
  verdict(R.orderedShots > 0 && O.fight === null && !R.bad, 'the men under the order fight through the room fight (rounds fired with the order still theirs; orders.fight is not used)', `rounds under an order ${R.orderedShots} · orders.fight ${O.fight}`);
  // a locked door: the boot first
  // (the SHIPPED stand has the lead TRY a door nobody knew was locked and the order end there, 'found shut' — DOORTOOLS.testDoor, a FROZEN_HOLDS row, held by
  // doortest-check.ts. This line is about the order that boots it and goes on, so it plays the door as it was; `guarded` and the next rig put the knob back.)
  { const R2 = await rig(7, { door: 'manager' }); DOORTOOLS.testDoor = false; const D2 = R2.D, Md = R2.door('manager'); const locked0 = Md.locked; R2.give('bangClear', 'manager'); const op2 = D2.ops[0];
    R2.until(() => D2.ops.length === 0, 40); const T2 = (s: string) => R2.beatT(op2, s); const c2 = op2.crossed.size ? Math.min(...[...op2.crossed.values()] as number[]) : NaN;
    verdict(locked0 && T2('kick') < T2('toss') && T2('toss') < T2('bang') && T2('bang') < c2 && Md.lockBroken && !!op2.bangAt && inBounds(R2.room('manager').def.bounds, op2.bangAt),
      'a locked door: the lead\'s boot, then the can, the bang inside that room, then the first man in', R2.beats(op2)); }
  // the order taken away with the can in the air
  { const R3 = await rig(7, { door: 'breakroom_w' }); const D3 = R3.D; R3.give('bangClear', 'breakroom_w'); const op3 = D3.ops[0];
    const inAir = R3.until(() => op3.phase === 'fuse', 40); const can = op3.can; const fuse0 = can?.fuse;
    R3.O.give('hold', R3.O.targetAt(AISLE)); R3.step(2); const ended = D3.ops.length === 0, fuse1 = can?.fuse, fired0 = !!can?.fired;
    R3.step(Math.round((K.fuseAfterLand + 1.2) * 60));
    verdict(inAir && !!can && fuse0 > 10 && ended && (fired0 || fuse1 <= K.fuseAfterLand + 1e-6) && can.fired && R3.bangs.length === 1,
      'the men re-ordered with the can in the air: the order ends and the can goes off on a short fuse — never a live one left lying on its long fuse', `fuse ${f2(fuse0 ?? NaN)} → ${f2(fuse1 ?? NaN)} · fired ${can?.fired} · blasts ${R3.bangs.length} · ended: ${D3.done[0]?.ended}`); }
  // the same hole in the F drill (breach.ts): the pair lost with its can thrown
  { const R4 = await rig(7, { stage: 'nb', nb: { blindFire: false } }); const { NB } = R4; R4.press('KeyF'); R4.until(() => NB.drill?.phase === 'stack' && !isNaN(NB.drill.tSet), 40); R4.press('KeyF');
    const thrown = R4.until(() => !!(NB.drill as any)?.can, 20); const can = (NB.drill as any)?.can; const early = !!can && !can.fired;
    for (const x of [...R4.ops]) if (x.state !== 'dead') killGuard(R4.game, x, [1, 0, 0], false, 'shot', 'player');
    R4.step(Math.round((K.fuseAfterLand + 1.5) * 60));
    verdict(thrown && early && NB.drill.beats.some((b: any) => b.what === 'can:short-fuse') && can.fired, 'the F drill\'s can, thrown and not yet gone off when the pair is lost: it is put on a short fuse and goes off (it used to stay live for 99 s)',
      `thrown ${thrown} · live at the loss ${early} · beats: ${NB.drill.beats.slice(-5).map((b: any) => b.what).join(' | ')} · fired ${can?.fired}`); }
  return done();
});

// ---------------------------------------------------------------- from outside
const outsideBody = async () => {
  const { verdict, done } = family('doortools-outside: the doorway worked from outside — eyes and rounds in, no man in, until an entry order');
  // The other rooms' men are held out of this one (`ROOMFIGHT.rally` off for its length, by the wrapper below): it is about the door, and since a man who leaves a lost room stays in
  // the building (`ROOMFIGHT.fallBackIn`) the break room's second man is shot from outside too, the fight runs on, and two men from the cubicles walk over and take
  // the pair in the back while it holds (24 s) — the floor's answer to a room falling, counted by the playthroughs, not what is being checked here.
  const R = await rig(1, { door: 'breakroom_w' }); const { O, D, game } = R; const Wd = R.door('breakroom_w'); const room = R.room('breakroom'); const B = room.def.bounds;
  let inside = 0, margin = Infinity, contactT = NaN, contactWho = ''; let watching = true;
  R.post = () => { if (!watching) return;
    for (const x of R.ops) { if (x.state === 'dead') continue; if (inBounds(B, x.char.pos)) inside++; margin = Math.min(margin, B.x0 - x.char.pos[0]); }
    if (isNaN(contactT)) for (const h of room.defenders) { if (h.state === 'dead') continue; const by = game.fight.seenBy(h).filter((x: any) => R.ops.includes(x)); if (by.length) { contactT = game.time; contactWho = `${by[0].callsign} on ${h.callsign}`; break; } } };
  // (the SHIPPED stand plays 'clear from outside' as one plain order that holds the door — DOORTOOLS.outsidePlain, a FROZEN_HOLDS row — and has no 'outside' row:
  // this probe is about the SLICING order, so it asks for the threshold's page as it was; the rows are dealt again on the next frame, `guarded` puts the knob back)
  if (DOORTOOLS.outsidePlain) { DOORTOOLS.outsidePlain = false; R.step(2); }
  const w = R.give('outside', 'breakroom_w'); const op = D.ops[0];
  if (w !== null || !op) { verdict(false, 'the order is taken', `refused: ${w ?? 'no order under way'}`); return done(); }
  const held = R.until(() => op.phase === 'held', 45); const shotsOut = R.shots.operative ?? 0; R.step(60 * 6);
  verdict(w === null && !isNaN(R.beatT(op, 'slice')) && held && isOpen(Wd) && op.phase === 'held' && D.ops[0] === op, 'the order: stacked, the door opened, the opening sliced a station at a time, then held — and it stays held, the door kept open', R.beats(op));
  verdict(!isNaN(contactT) && shotsOut > 0, 'from out there a man of the room is seen and shot at', `first contact ${f2(contactT - R.t0)} s: ${contactWho} · rounds from outside ${shotsOut} · the room's men down ${room.defenders.filter((h: any) => h.state === 'dead').length}/${room.defenders.length}`);
  verdict(inside === 0 && op.crossed.size === 0 && margin > 0, 'and through all of it no man of the pair is inside the room\'s bounds or over the frame line', `frames inside ${inside} · over the line ${op.crossed.size} · nearest any got to the room's floor ${f2(margin)} m short of it`);
  watching = false;
  const alive = R.ops.filter((x: any) => x.state !== 'dead').length; const w2 = R.give('openClear', 'breakroom_w'); const op2 = D.ops[0];
  const crossed = R.until(() => !!op2 && op2.crossed.size > 0, 20);
  verdict(alive > 0 && w2 === null && op2 !== op && op2?.kind === 'openClear' && crossed && !R.bad, 'an entry order on the same door, and they go in', `pair standing ${alive} · ${R.beats(op2)}`);
  return done();
};
export const doortoolsOutside = guarded(async () => {
  const { ROOMFIGHT } = await import(`${ROOT}/src/game/roomfight.ts`); const rally0 = ROOMFIGHT.rally; ROOMFIGHT.rally = false;
  try { return await outsideBody(); } finally { ROOMFIGHT.rally = rally0; }
});

// ---------------------------------------------------------------- the counts
export const doortoolsCounts = guarded(async () => {
  const { verdict, done } = family('doortools-counts: charges and bangs are counted per run, and run out');
  { const R = await rig(7, { door: 'breakroom_w', knobs: { charges: 1, bangs: 1 } }); const { D } = R; const Wd = R.door('breakroom_w');
    verdict(D.charges === 1 && D.bangs === 1, 'a run starts with the knobs\' counts', D.summary());
    D.take('bang'); const w4 = R.give('bangClear', 'breakroom_w'); const row4 = R.menuOn(Wd.frameCentre)?.tools?.rows.find((r: any) => r.key === '2');
    verdict(D.bangs === 0 && D.take('bang') === false && w4 === 'no bangs left.' && !!row4?.off && /0 left — no bangs left/.test(row4.text) && D.ops.length === 0, 'the bang spent: bang and clear is refused in words, its row greyed with them, and there is no taking another', `bangs ${D.bangs} · give: ${w4} · row: ${row4?.text}`);
    R.give('charge', 'breakroom_w'); const op = D.ops[0]; const set = R.until(() => D.set.length === 1, 45);
    const w2 = R.give('charge', 'manager');
    verdict(set && D.charges === 0 && w2 === 'no charges left.' && D.ops.length === 1, 'the one charge is spent on being set: a second door is refused in words', `charges ${D.charges} · give on another door: ${w2}`);
    R.until(() => op.phase === 'armed', 20); const w3 = R.give('charge', 'breakroom_w'); R.step(2);
    verdict(w3 === null && D.stats.blown === 1 && !Wd.latched, 'the set one still blows from its row', `give: ${w3} · blown ${D.stats.blown}`);
    R.game.restartEncounter(); R.step(5);
    verdict(D.charges === 1 && D.bangs === 1 && D.set.length === 0 && D.ops.length === 0, 'a restart is a fresh run: the counts back, nothing set, nothing under way', D.summary()); }
  { const R = await rig(7, { stage: 'nb', knobs: { bangs: 0 }, nb: { blindFire: false } }); const { NB, D } = R;
    R.press('KeyF'); R.until(() => NB.drill?.phase === 'stack' && !isNaN(NB.drill.tSet), 40); R.press('KeyF'); R.until(() => NB.drill?.phase === 'done' || NB.drill?.beats.some((b: any) => /^in/.test(b.what)), 25);
    const tossed = NB.drill.beats.some((b: any) => /^toss/.test(b.what));
    verdict(D.bangs === 0 && !tossed && R.bangs.length === 0 && R.said.some(t => /no bangs left/.test(t)), 'the night breach\'s F drill takes its can from the same count: with none left the pair goes in without one, and says so', `bangs ${D.bangs} · a toss ${tossed} · blasts ${R.bangs.length} · said: ${R.said.filter(t => /bang/.test(t)).join(' / ')}`); }
  { const R = await rig(7, { stage: 'nb', nb: { blindFire: false } }); const { NB, D } = R; const b0 = D.bangs;
    R.press('KeyF'); R.until(() => NB.drill?.phase === 'stack' && !isNaN(NB.drill.tSet), 40); R.press('KeyF'); R.until(() => R.bangs.length > 0, 25);
    verdict(b0 === DOORTOOLS.bangs && D.bangs === b0 - 1 && R.bangs.length === 1, '… and with some left it spends one', `bangs ${b0} → ${D.bangs} · blasts ${R.bangs.length}`); }
  return done();
});

// ---------------------------------------------------------------- the edges (what the review of the first cut found)
export const doortoolsEdges = guarded(async () => {
  const { verdict, done } = family('doortools-edges: a job is done by the man at the door, the counts stay honest, a charge is on a shut leaf');
  { // the setter is given another order half-way through setting: nothing is set by a man who is not at the lock
    const R = await rig(7, { door: 'manager' }); const { D, O } = R; const Md = R.door('manager');
    R.give('charge', 'manager'); const op = D.ops[0]; const first = op.lead; R.until(() => !isNaN(op.setT), 45); R.step(20);
    const who = R.ops.indexOf(first); O.give('fallIn', O.targetAt(R.game.player.char.pos), who);
    let far = ''; R.post = () => { if (D.set.length && !far) { const m = R.ops.find((x: any) => x.callsign === D.set[0].by); far = `${D.set[0].by} at ${f2(dist(m.char.pos, Md.frameCentre))} m`; if (dist(m.char.pos, Md.frameCentre) < 1.6) far = 'ok ' + far; } };
    const tRe = R.game.time; const set = R.until(() => D.set.length === 1, 45); const took = R.game.time - tRe; R.post = null;
    verdict(set && /^ok /.test(far) && D.set[0].by !== first.callsign && took >= DOORTOOLS.setSecs && D.charges === DOORTOOLS.charges - 1, 'the setter called away mid-set: no charge is set until the other man has been at the lock his own two seconds, and it is his', `set ${f2(took)} s after the re-order · ${far} · charges ${D.charges}`); }
  { // an order given the moment a run is staged is not wiped by the module noticing the new cast a frame later
    const R = await rig(7, { door: 'manager' }); const { D } = R;
    R.game.restartEncounter(); const w = R.give('openClear', 'manager'); const n0 = D.ops.length; R.step(3);
    verdict(w === null && n0 === 1 && D.ops.length === 1 && D.ops[0].kind === 'openClear', 'an order given straight after a restart stands', `give: ${w} · orders under way ${n0} → ${D.ops.length}`); }
  { // the bang is the order's from the word: a second order cannot be given on the same last can, and an order that ends before the throw gives it back
    const R = await rig(7, { door: 'manager', knobs: { bangs: 1 } }); DOORTOOLS.testDoor = false; const { D, O } = R;   // (the manager's door is locked: with the handle tried first the order ends 'found shut' and the can goes back unthrown — this line is about the can, so the door is not tried, as below)
    const w1 = O.give('bangClear', R.target('manager'), 0); const b1 = D.bangs; const w2 = O.give('bangClear', R.target('storage'), 1);
    const tossed = R.until(() => R.bangs.length > 0, 45); const crossedFirst = [...D.ops, ...D.done].some((o: any) => !o.beats.some((b: any) => /^bang/.test(b.what)) && o.beats.some((b: any) => /^cross:/.test(b.what)));
    verdict(w1 === null && b1 === 0 && /^no bangs left/.test(w2 ?? '') && tossed && !crossedFirst, 'one can, two doors: the first order has it, the second is refused — nobody goes in behind a bang that is not there', `give 1: ${w1} (bangs → ${b1}) · give 2: ${w2} · blasts ${R.bangs.length}`);
    const R2 = await rig(7, { door: 'manager', knobs: { bangs: 1 } }); const D2 = R2.D;
    R2.give('bangClear', 'manager'); R2.step(30); const held = D2.bangs; R2.give('fallIn', 'manager'); R2.step(5);
    verdict(held === 0 && D2.bangs === 1 && D2.ops.length === 0 && R2.bangs.length === 0, '… and an order called off before the throw puts the can back in the bag', `bangs ${held} while ordered → ${D2.bangs} after the recall`); }
  { // a set charge and the leaf it is on
    const R = await rig(7, { door: 'breakroom_w' }); const { D } = R; const Wd = R.door('breakroom_w');
    R.give('charge', 'breakroom_w'); const op = D.ops[0]; R.until(() => op.phase === 'armed', 60); const c0 = D.charges;
    Wd.latched = false; Wd.angle = -1.2; Wd.vel = 0; Wd.quietT = -30; R.step(3);
    const res = D.blow();
    verdict(c0 === DOORTOOLS.charges - 1 && D.set.length === 0 && D.charges === DOORTOOLS.charges && res === null && D.stats.blown === 0 && R.said.some(t => /came open/.test(t)), 'the charged door comes open: the charge is off it and back in the bag, and F blows nothing', `charges ${c0} → ${D.charges} · set ${D.set.length} · blow: ${JSON.stringify(res)}`); }
  { // the F drill's can and the count
    const R = await rig(7, { stage: 'nb', nb: { blindFire: false } }); const { NB, D, O } = R; const b0 = D.bangs;
    R.press('KeyF'); R.step(20); R.press('KeyF'); const took = D.bangs; const w = O.give('fallIn', O.targetAt(R.game.player.char.pos)); R.step(5);
    verdict(took === b0 - 1 && w === null && D.bangs === b0 && R.bangs.length === 0, 'the F drill called off between "go on set" and the throw: its can goes back', `bangs ${b0} → ${took} → ${D.bangs} · recall: ${w} · state ${NB.state}`); }
  return done();
});

// ---------------------------------------------------------------- the light cap
export const doortoolsLights = guarded(async () => {
  const { verdict, done } = family('doortools-lights: a charge with the light list at its 64-slot cap');
  const R = await rig(7, { door: 'breakroom_w' }); const { D, game } = R; const L = R.W.engine.lights; const Wd = R.door('breakroom_w'); const room = R.room('breakroom');
  const on = () => L.lights.filter((l: any) => l.enabled && l.intensity > 0).length; const staged = on(), listed = L.lights.length;
  const proto = L.lights.find((l: any) => l.enabled && l.intensity > 0 && l.ttl < 0); let pad = 0;
  while (on() < MAX_LIGHTS) { L.add({ ...proto, name: `pad${pad++}`, pos: [2 + pad * 0.1, 2.5, 2], color: [...proto.color], dir: [...proto.dir], slot: -1 }); }
  L.upload(game.time); const full = L.activeCount;
  const near = room.defenders[0]; near.char.pos[0] = Wd.frameCentre[0] + 3.2; near.char.pos[2] = Wd.frameCentre[2]; R.step(1);
  D.set.push({ door: Wd, side: R.target('breakroom_w').side, t: game.time, by: 'probe' });
  let threw = ''; let res: any = null; try { res = D.blow(); L.upload(game.time); } catch (e) { threw = String(e); }
  const flashes = L.lights.filter((l: any) => l.ttl >= 0 || l.transient); const uploaded = flashes.filter((l: any) => l.slot >= 0).length;
  try { R.step(30); L.upload(game.time); } catch (e) { threw ||= String(e); }
  verdict(full === MAX_LIGHTS && !threw && L.activeCount <= MAX_LIGHTS && flashes.length > 0 && uploaded === 0 && !!res && res.stunned + res.knocked >= 1 && near.dazzledUntil > game.time,
    'every upload slot taken by a steady light, then a charge blown: nothing throws, the blast\'s own flash light is not uploaded (it is not drawn), and the men are stunned all the same',
    `staged night: ${staged} lights on of ${listed} listed (cap ${MAX_LIGHTS}: ${MAX_LIGHTS - staged} to spare) · padded to ${full} · threw: ${threw || 'no'} · flash lights ${flashes.length}, uploaded ${uploaded} · stunned ${res?.stunned} down ${res?.knocked}`);
  return done();
});

// ---------------------------------------------------------------- which tool loses the first man
async function tally(kind: string, seeds: number[], hot: boolean, door = 'breakroom_w', roomId = 'breakroom') {
  const out = { n: 0, first: 0, pair: 0, down: 0, of: 0, taken: 0 };
  for (const seed of seeds) {
    const R = await rig(seed, { door, hot, deal: false }); const { D } = R; const room = R.room(roomId);   // (a ROOM-FIGHT floor: with squads dealt from the rooms the room's men are their squad's, still thinking four seconds after the bang and dug in behind wedged doors by twenty-five — the plain door then loses nobody, or nobody gets in, and there is nothing for a bang to beat) out.of += room.defenders.length;
    R.give(kind, door); const op = D.ops[0]; if (!op) { out.n++; continue; }
    for (let i = 0; i < 60 * 45 && D.ops.length; i++) { R.step(); if (kind === 'charge' && op.phase === 'armed') R.press('KeyF'); }
    R.step(60 * 6);
    const first = op.crossed.size ? [...op.crossed.entries()].sort((a: any, b: any) => a[1] - b[1])[0][0] : op.lead;
    if (process.env.TALLY_V) console.log(`  seed ${seed}: ${R.beats(op)}\n    down: ${R.downs.map((x: any) => `${f2(x.t - R.t0)} ${x.who.callsign} (${x.who.team}, ${R.RC.roomAt(x.who.char.pos) ?? 'no room'}) by ${x.by}`).join(' · ') || 'nobody'}`);
    out.n++; if (first.state === 'dead') out.first++; out.pair += R.ops.filter((x: any) => x.state === 'dead').length; out.down += room.defenders.filter((h: any) => h.state === 'dead').length; if (room.cleared) out.taken++;
  }
  return out;
}
export const doortoolsFirstMan = guarded(async () => {
  const { verdict, done } = family('doortools-firstman: behind a bang or a charge fewer first men are lost than through the plain door · a room-fight floor (squads from the rooms held off inside these runs)');
  const seeds = [1, 2, 3, 4, 5, 6], line = (k: string, t: any) => `${k}: first man lost ${t.first}/${t.n} · pair lost ${t.pair}/${t.n * 2} · room's men down ${t.down}/${t.n * 2} · room taken ${t.taken}/${t.n}`;
  const open = await tally('openClear', seeds, true), bang = await tally('bangClear', seeds, true), charge = await tally('charge', seeds, true);
  verdict(bang.first < open.first && charge.first < open.first, `an ALERTED floor (a bang heard four seconds before), the break room's west door, seeds ${seeds.join(' ')}: the first man through is lost less often behind a bang, and behind a charge, than through the plain door`,
    `${line('open and clear', open)}\n    ${line('bang and clear', bang)}\n    ${line('charge', charge)}`);
  verdict(bang.pair < open.pair && charge.pair < open.pair, '… and fewer of the pair altogether', `pair lost: open ${open.pair} · bang ${bang.pair} · charge ${charge.pair}`);
  const cs = [1, 2, 3]; const co = await tally('openClear', cs, false), cb = await tally('bangClear', cs, false), cc = await tally('charge', cs, false);
  console.log(`- INFO — a QUIET floor, seeds ${cs.join(' ')} (no verdict: here the plain door has surprise on its side, and a bang or a charge wakes the floor)\n    ${line('open and clear', co)}\n    ${line('bang and clear', cb)}\n    ${line('charge', cc)}`);
  return done();
});

/** by hand, outside the probe runner: `bun run tools/qa/doortools-probes.ts tally <order id> <door> <room id> <seeds, comma separated> <cold|hot>` — one line of the same count the
 *  first-man probe makes, for any order (clear from outside included: nobody enters, so its 'first man' is the lead) on any door Sam has a spot by (SAM) */
if (import.meta.main && process.argv[2] === 'tally') {
  if (process.env.TALLY_SET) {   // an A/B of the fight's numbers from the command line: TALLY_SET='{"hostile":{"ready":0.5},"ROOMFIGHT":{"preaimDeg":8}}' (the tables roomclear-tally.ts --set writes; the door tools' own table is rig()'s to reset)
    const F = await import(`${ROOT}/src/game/roomfight.ts`); const T: any = { operative: F.FIGHT_SKILL.operative, hostile: F.FIGHT_SKILL.hostile, ROOMFIGHT: F.ROOMFIGHT, BLIND: (await import(`${ROOT}/src/game/nightbreach.ts`)).BLIND };
    for (const [t, row] of Object.entries(JSON.parse(process.env.TALLY_SET) as Record<string, Record<string, unknown>>)) { if (!T[t]) throw new Error(`TALLY_SET: no table '${t}'`); for (const k of Object.keys(row)) if (!(k in T[t])) throw new Error(`TALLY_SET: no knob '${t}.${k}'`); Object.assign(T[t], row); }
  }
  const [, , , kind, door, roomId, seeds, mode] = process.argv; const r = await tally(kind, seeds.split(',').map(Number), mode === 'hot', door, roomId);
  Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS);
  console.log(`${mode} ${kind} ${door} over ${r.n} seeds: first man lost ${r.first} · pair lost ${r.pair}/${r.n * 2} · room's men down ${r.down}/${r.of} · room taken ${r.taken}`);
}
