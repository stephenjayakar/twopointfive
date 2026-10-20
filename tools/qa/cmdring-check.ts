// THE ORDERS RING, A PROTOTYPE (src/game/cmdring.ts, CMDRING.on — off unless asked for on the page and on both stands): the ring's key through the
// game's own input, headless.
//   bun run tools/qa/cmdring-check.ts            (also `probes.ts cmdring`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/cmdring-check.ts      — the same lines on the page's stand
// PASS / FAIL each: the room clear on the office with its squad of four, everybody under god mode (the lines are about what is ORDERED, not who wins).
// The check raises the switch itself (no stand has it on) and the quick key's autopilot with it, so the first wedge has something to choose. The key is
// HELD the way a hand holds it: in `input.keys` from the frame it goes down to the frame it comes up; a tap is down for one frame.
// Lines 11 on are Sam's own hands on the same ring (CMDRING.hands, src/game/interact.ts): Space at a shut door.
// CMDRING_BREAK=1 = the switches left off and the same lines asked: they must fail (the ones that hold are those that say 'as it was': the switch-off line,
// the old keys' line, a tap of Space, and Space's own key off).
//   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const CR: any = await import(`${ROOT}/src/game/cmdring.ts`);
const AP: any = await import(`${ROOT}/src/game/autopilot.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const IA: any = await import(`${ROOT}/src/game/interact.ts`);
const { CMDRING, CMDRING_STATS } = CR, { AUTOPILOT } = AP;

const DT = 1 / 60, HOLD = Math.ceil(CMDRING.tapSecs * 60) + 1, HOLD_SECS = 0.2;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const BREAK = process.env.CMDRING_BREAK === '1';

async function rig(seed: number, on = !BREAK) {
  const squad0 = NIGHTBREACH.squad; let W: any, why: any;
  try {
    Object.assign(NIGHTBREACH, { squad: 4 });
    Math.random = seeded(seed);
    W = await standUp();
    CMDRING.on = on; CMDRING.hint = on; CMDRING.hands = on; CMDRING.plan = false; CMDRING.planRts = false; CMDRING.holdSecs = HOLD_SECS; AUTOPILOT.on = true;
    W.game.godMode = true;
    why = W.game.roomClear.start(seed);
  } finally { Object.assign(NIGHTBREACH, { squad: squad0 }); }
  const game = W.game, O = game.orders, input = W.input, KEY = CMDRING.key;
  const R = { W, game, O, why, input,
    get team(): any[] { return O.squad(); },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; W.step(DT); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    /** the cursor on p, as the game's own input reads it */
    aim(p: number[]) { W.cursorAt([p[0], p[1], p[2]]); R.step(2); return O.hover?.() ?? null; },
    /** the ring's key goes down and stays down */
    down() { input.keys.add(KEY); input.pressed.add(KEY); R.step(); R.step(Math.ceil(CMDRING.holdSecs * 60) + HOLD); },   // (… past the hold that puts the ring up, CMDRING.holdSecs, and its tap guard, CMDRING.tapSecs: the cursor counts from here)
    /** … and comes up: the frame it is read in */
    up() { input.keys.delete(KEY); R.step(); },
    /** a tap: down for one frame */
    tap() { input.keys.add(KEY); input.pressed.add(KEY); R.step(); R.up(); },
    press(code: string) { input.pressed.add(code); R.step(); },
    tail() { return O.log[O.log.length - 1]; },
    stacked() { return R.team.filter((m: any) => m.state !== 'dead').every((m: any) => O.of(m)?.order === 'stack' && O.of(m)?.arrived); },
    home() { input.keys.delete(KEY); O.cmdRing = null; O.close(); O.who = 'all'; O.give('fallIn', O.targetAt(game.player.char.pos), 'all'); R.until(() => game.doorTools.ops.length === 0, 40); R.until(() => R.team.every((m: any) => dist(m.char.pos, game.player.char.pos) < 4.5), 25); R.step(30); },   // (… and the men back round Sam, in the view)
  };
  R.step(30);
  for (const m of R.team) m.god = true;
  return R;
}
function doorsNear(R: any): { d: any; t: any }[] {
  const s = R.game.player.char.pos, out: { d: any; t: any }[] = [];
  for (const d of [...R.game.doors.list].sort((a: any, b: any) => dist(a.frameCentre, s) - dist(b.frameCentre, s))) { const t = R.O.targetAt(d.frameCentre); if (t.kind === 'door' && t.door === d) out.push({ d, t }); }
  return out;
}
function aimOf(R: any, d: any): number[] | null {
  const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th);
  for (const y of [c[1], 0.05, 1.0, 1.8]) for (const k of [0, 0.35, -0.35]) { const p = [c[0] + nx * k, y, c[2] + nz * k]; const h = R.aim(p); if (h?.kind === 'door' && h.door === d) return p; }
  return null;
}
/** a spot of open floor a few metres from Sam the cursor on which is the floor */
function floorSpot(R: any): number[] | null {
  const s = R.game.player.char.pos;
  for (const [dx, dz] of [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5], [2, 2], [-2, -2], [2, -2], [-2, 2]]) { const p = [s[0] + dx, 0.04, s[2] + dz]; const h = R.aim(p); if (h?.kind === 'floor' && !h.wall && !h.thing && R.team.every((m: any) => dist(m.char.pos, p) > 1.2)) return p; }
  return null;
}
const farRoom = (g: any, t: any) => g.cleared.roomBy(t.door, t.side > 0 ? -1 : 1);

let fails = 0;
const line = (ok: boolean, name: string, detail: string) => { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); };

export async function cmdringCheck(): Promise<boolean> {
  fails = 0;
  const keep = { on: CMDRING.on, hint: CMDRING.hint, hands: CMDRING.hands, plan: CMDRING.plan, rts: CMDRING.planRts, hold: CMDRING.holdSecs, ap: AUTOPILOT.on, rnd: Math.random };
  console.log(`cmdring-check: the orders ring on one key (a prototype)${BREAK ? '  (CMDRING_BREAK: the switch is left off — the lines must fail)' : ''}`);
  try {
    const R = await rig(5), g = R.game, O = R.O, T = g.doorTools, S = CMDRING_STATS;
    if (R.why) { line(false, 'the room clear stands up', String(R.why)); return false; }
    const all = () => O.men('all'), stackDef = O.defs.find((d: any) => d.id === 'stack');
    let pick: { d: any; t: any } | null = null, w: string | null = 'no door';
    for (const x of doorsNear(R)) { const far = farRoom(g, x.t); if (!far || g.cleared.isKnown(far)) continue; w = O.whyNot(stackDef, O.forMen(x.t, all()), all()); if (!w && !aimOf(R, x.d)) w = 'the cursor on it is not on it'; if (!w) { pick = x; break; } }
    if (!pick) { line(false, 'a door to stack on with an unknown room behind it', `none: ${w}`); return false; }
    const D = pick.d, onDoor = () => aimOf(R, D) ?? D.frameCentre;
    const spot = floorSpot(R);
    if (!spot) { line(false, 'a spot of open floor to point at', 'none round Sam'); return false; }

    // 1. the key down: the ring is up at the cursor, the first wedge lit in the quick key's words, the panel lists no menu — and nobody has been told anything
    {
      R.aim(spot); const n0 = O.log.length, mx = R.input.mouseX, my = R.input.mouseY; R.down(); R.step(20);
      const V = O.ringView(), hud = O.hud(), keys = (V?.wedges ?? []).map((x: any) => x.key).join(''), mark = O.mark();
      line(!!O.cmdRing && !!O.menu && !!V && !!V.caption && mark === null && V.lit === 1 && V.wedges[0]?.key === 1 && !!V.wedges[0].text && Math.abs(V.x - mx) < 1 && Math.abs(V.y - my) < 1 && hud.menu === null && O.log.length === n0 && V.wedges.every((x: any) => x.key >= 1 && x.key <= 5),
        'the key down: the ring is up at the cursor, its first wedge lit, nobody told anything yet', `ring ${!!O.cmdRing} · wedges ${keys} · lit ${V?.lit} · first '${V?.wedges[0]?.text}' · under it '${V?.caption}', the menu's own mark ${mark ? 'drawn too' : 'not drawn'} · the panel's menu ${hud.menu ? 'listed' : 'not listed'} · order book +${O.log.length - n0}`);
      // 2. … and the key up gives the lit wedge: on the floor, the quick key's own 'move there'
      const q0 = S.quick; R.up(); const row = R.tail();
      line(!O.cmdRing && !O.menu && O.log.length === n0 + 1 && row?.order === 'move' && S.quick === q0 + 1, 'the key up gives the lit wedge: held on the floor and let go, the squad moves there', `ring ${!!O.cmdRing} · menu ${!!O.menu} · order book +${O.log.length - n0} · ${row?.order}`);
      R.home();
    }

    // 3. a tap on a door nobody is on is the quick key: stack up — and, stacked on it, the entry the squad picks (autopilot.ts)
    {
      onDoor(); const n0 = O.log.length; R.tap(); const row1 = R.tail(), k1 = O.log.length - n0;
      const set = R.until(() => R.stacked(), 40);
      onDoor(); const want = AP.autoPick(g, O.targetAt(D.frameCentre)).id; R.tap(); const row2 = R.tail(), op = T.ops.find((o: any) => o.door === D);
      line(k1 === 1 && row1?.order === 'stack' && set && row2?.order === want && row2.auto === true && !!op, 'a tap is the quick key: stack up on a door nobody is on, and from the stack the entry the squad picks', `first tap: ${row1?.order} (+${k1}) · stacked ${set} · second tap: ${row2?.order} (the pick: ${want}) · a door op ${!!op}`);
      R.until(() => T.ops.length === 0, 40); R.home();
    }

    // 4. held, a digit lights its wedge and gives nothing until the key comes up
    {
      R.aim(spot); const n0 = O.log.length; R.down();
      const rowOf = (k: number) => O.menu?.rows.find((r: any) => r.key === k), r3 = rowOf(3);
      R.press('Digit3'); const lit = O.cmdRing?.lit, mid = O.log.length - n0; R.step(15); const still = O.log.length - n0;
      R.up(); const row = R.tail();
      line(!!r3 && lit === 3 && mid === 0 && still === 0 && O.log.length === n0 + 1 && row?.order === r3.id && !O.menu, 'held, a digit lights its wedge; the order goes when the key comes up', `wedge 3 is '${r3?.id}' · lit ${lit} · order book while held +${still} · on the key up: ${row?.order}`);
      R.home();
    }

    // 5. held, the cursor out of the ring's middle lights the wedge it is out toward — not inside the middle — and a digit after it stands until the cursor
    //    has been back to the middle and out again; the ring stays where it opened
    {
      R.aim(spot); const n0 = O.log.length; R.down();
      const r2 = O.menu?.rows.find((r: any) => r.key === 2), a = (-90 + 72) * Math.PI / 180, x0 = O.cmdRing?.ax ?? 0, y0 = O.cmdRing?.ay ?? 0, c0 = R.input.mouseX;
      const at = (r: number, ang = a) => { R.input.mouseX = x0 + Math.cos(ang) * r; R.input.mouseY = y0 + Math.sin(ang) * r; R.step(); return O.cmdRing?.lit; };
      const near = at(CMDRING.flickPx - 6), far = at(CMDRING.flickPx + 14), V = O.ringView(), sel = O.menu?.rows[O.menu.sel]?.key;
      R.press('Digit4'); R.step(6); const dig = O.cmdRing?.lit;   // (the cursor still rests out toward wedge 2: the digit must stand)
      const round = at(CMDRING.flickPx + 14, (-90 + 144) * Math.PI / 180), mid = at(0), again = at(CMDRING.flickPx + 14);
      R.up(); const row = R.tail();
      line(!!r2 && near === 1 && far === 2 && sel === 2 && dig === 4 && round === 4 && mid === 4 && again === 2 && !!V && Math.abs(V.x - x0) < 1 && Math.abs(c0 - x0) < 1 && O.log.length === n0 + 1 && row?.order === r2.id,
        'held, the cursor out of the ring\'s middle lights the wedge it is out toward; a digit after it stands until the cursor has been back to the middle', `wedge 2 is '${r2?.id}' · lit ${near} inside the middle, ${far} out of it (the menu's highlight on ${sel}) · then the digit 4: lit ${dig}, ${round} with the cursor moved round outside, ${mid} back in the middle, ${again} out again · ring moved ${V ? Math.abs(V.x - x0).toFixed(0) : '?'} px · on the key up: ${row?.order}`);
      R.home();
    }

    // 6. a wedge that opens a page turns the ring to it and lights nothing — by its digit, by the cursor (whose way back to the middle picks nothing), or
    //    turned from outside the ring: let go there and nothing is given; a digit on the page, and its tool is
    {
      onDoor(); const n0 = O.log.length; R.down();
      const opener = O.menu?.rows.find((r: any) => !!r.opens && r.key >= 1 && r.key <= 5);
      if (opener) R.press(`Digit${opener.key}`);
      const page = O.menu?.page ?? null, lit = O.cmdRing?.lit, V = O.ringView(), c0 = S.cancelled; R.up(); const none = O.log.length - n0, canc = S.cancelled - c0;
      // … by the cursor: out toward the opener's wedge, then back the way it came
      onDoor(); R.down(); const x0 = O.cmdRing?.ax ?? 0, y0 = O.cmdRing?.ay ?? 0, a = (-90 + ((opener?.key ?? 1) - 1) * 72) * Math.PI / 180; R.input.mouseX = x0; R.input.mouseY = y0; R.step();   // (from the ring's own middle: a door near the view's edge has the ring stood in from the cursor)
      const at = (r: number) => { R.input.mouseX = x0 + Math.cos(a) * r; R.input.mouseY = y0 + Math.sin(a) * r; R.step(); return O.cmdRing?.lit; };
      const fOut = at(CMDRING.flickPx + 8), fPage = O.menu?.page ?? null, fRest = (R.step(4), O.cmdRing?.lit), fBack = at(3); R.step(3); const fStill = O.cmdRing?.lit;
      R.up(); const fNone = O.log.length - n0;
      // … from outside (as a letter key of the menu's own turns it): the wedge that was lit is not carried over
      onDoor(); R.down(); const before = O.cmdRing?.lit; if (opener) O.turn(opener.opens); const outLit = O.cmdRing?.lit; R.up(); const oNone = O.log.length - n0;
      onDoor(); R.down(); if (opener) R.press(`Digit${opener.key}`);
      const tool = O.menu?.rows.find((r: any, i: number) => r.key >= 1 && r.key <= 5 && !r.opens && !O.menu.why[i]);
      if (tool) R.press(`Digit${tool.key}`); R.up(); R.step(5); const row = R.tail();
      line(!!opener && page === opener.opens && lit === 0 && !!V && V.wedges.length > 0 && none === 0 && canc === 1 && fPage === opener.opens && fOut === 0 && fRest === 0 && fBack === 0 && fStill === 0 && fNone === 0
        && before === 1 && outLit === 0 && oNone === 0 && !!tool && O.log.length === n0 + 1 && row?.order === tool.id,
        'a wedge that opens a page turns the ring to it and lights nothing, by digit or by the cursor; a digit there picks the tool', `opener '${opener?.id}' on ${opener?.key} · page '${page}' · lit ${lit} · let go there: order book +${none} · by the cursor: page '${fPage}', lit ${fOut} out, ${fRest} at rest, ${fStill} back in the middle, +${fNone} · turned from outside: lit ${before} then ${outLit}, +${oNone} · then '${tool?.id}' on ${tool?.key}: ${row?.order}`);
      R.until(() => T.ops.length === 0, 40); R.home();
    }

    // 7. who it goes to: the wheel steps it; a left click on a man — his feet or his body — makes it his, is not Sam's trigger, and starts the ring again
    //    with its first wedge lit, which the cursor out on him does not change; the order is his alone. A ring opened ON a man goes to whoever is clicked
    {
      R.aim(spot); R.down();
      R.input.wheel = 70; R.step(); const w1 = O.who; R.input.wheel = -70; R.step(); const w2 = O.who;
      const k = 2, man = R.team[k]; R.W.cursorAt([man.char.pos[0], man.char.pos[1], man.char.pos[2]]); R.step(); const onWay = O.cmdRing?.lit;
      const shots0 = g.mission.stats.shots, f0 = S.fired; R.input.clicked |= 1; R.input.buttons |= 1; R.step(); R.input.buttons &= ~1; R.step(4);
      const w3 = O.who, lit3 = O.cmdRing?.lit, up3 = !!O.cmdRing, n0 = O.log.length;
      R.up(); const row = R.tail(), who = (row?.who ?? []).join('+');
      // … his body, not his feet: still him (the who key's own reading of the cursor)
      const other = R.team[0]; R.aim(spot); R.down(); R.W.cursorAt([other.char.pos[0], other.char.pos[1] + 1.2, other.char.pos[2]]); R.step();
      R.input.clicked |= 1; R.input.buttons |= 1; R.step(); R.input.buttons &= ~1; const wBody = O.who, upBody = !!O.cmdRing; R.press('Escape'); R.up(); O.who = 'all';
      // … a ring opened with the cursor ON a man is his; another clicked, it is the other's
      let on: any = null;
      for (const c of R.team) { if (c === man || on) continue; for (const y of [1.2, 0.9, 0.5, 1.6, 0]) { const h = R.aim([c.char.pos[0], c.char.pos[1] + y, c.char.pos[2]]); if (h?.kind === 'none' && h.man === c) { on = c; break; } } }
      R.down(); const menOn = (O.menu?.men ?? []).map((m: any) => m.callsign).join('+');
      R.W.cursorAt([man.char.pos[0], man.char.pos[1], man.char.pos[2]]); R.step(); R.input.clicked |= 1; R.input.buttons |= 1; R.step(); R.input.buttons &= ~1;
      const r4 = O.menu?.rows.find((r: any) => r.key === 4); R.press('Digit4'); const n1 = O.log.length; R.up(); const row2 = R.tail(), who2 = (row2?.who ?? []).join('+');
      line(w1 !== 'all' && w2 === 'all' && w3 === k && up3 && lit3 === 1 && S.fired === f0 && g.mission.stats.shots === shots0 && O.log.length >= n0 + 1 && row?.order === 'move' && row?.who?.length === 1 && row.who[0] === man.callsign
        && wBody === 0 && upBody && !!on && menOn === on.callsign && !!r4 && O.log.length === n1 + 1 && row2?.order === r4.id && who2 === man.callsign,
        'who: the wheel steps it; a click on a man makes it his, is not the trigger, and starts the ring again; the order is his alone', `wheel: ${w1}, back: ${w2} · on the way to ${man.callsign} lit ${onWay}; clicked: who ${w3}, ring ${up3}, lit ${lit3} · on the key up: ${row?.order} to ${who} · a click on ${other.callsign}'s body: who ${wBody}, ring ${upBody} · the cursor on ${on?.callsign ?? 'nobody'}: opened on ${menOn}, ${man.callsign} clicked, 4: ${row2?.order} to ${who2}`);
      R.home();
    }

    // 8. gives nothing: Esc as the page gives it (Game.escape) — on the first page and on a page behind it, with a wedge lit · Esc as a key in the frame ·
    //    a right click on the first page · a left click on nobody (Sam's trigger: the ring goes)
    {
      const n0 = O.log.length; const out: string[] = []; let ok = true;
      const cases: [string, () => void, (() => void)?][] = [['Esc (the page\'s)', () => { g.escape(); R.step(); }], ['Esc on a page, a wedge lit', () => { g.escape(); R.step(); }, () => { const op = O.menu?.rows.find((r: any) => !!r.opens && r.key <= 5); if (op) { R.press(`Digit${op.key}`); R.press('Digit3'); } }],
        ['Esc (in the frame)', () => R.press('Escape')], ['the pause card (the Paused tick)', () => R.press('Paused')], ['right click', () => { R.input.clicked |= 4; R.step(); }], ['left click on the floor', () => { R.input.clicked |= 1; R.step(); }]];
      for (const [name, act, pre] of cases) {
        if (pre) onDoor(); else R.aim(spot); R.down(); pre?.(); const up = !!O.cmdRing; act(); const gone = !O.cmdRing && !O.menu; R.up(); R.step(3);
        ok &&= up && gone && O.log.length === n0; out.push(`${name}: ring ${up ? 'up' : 'not up'} then ${gone ? 'gone' : 'still up'}`);
      }
      line(ok, 'Esc, a right click and a left click on nobody each put the ring away with nothing given', `${out.join(' · ')} · order book +${O.log.length - n0}`);
      R.home();
    }

    // 8b. opened at the view's edge the ring stands whole just inside it, and the cursor — out of its middle from the start — lights nothing until it has
    //     been to the middle
    {
      R.aim(spot); R.input.mouseX = 6; R.input.mouseY = 6; R.step(2); const n0 = O.log.length; R.down(); R.step(3);
      const V = O.ringView(), lit0 = O.cmdRing?.lit; R.input.mouseX = 40; R.input.mouseY = 30; R.step(2); const lit1 = O.cmdRing?.lit;
      R.input.mouseX = CMDRING.edgeX; R.input.mouseY = CMDRING.edgeY; R.step(); R.input.mouseX = CMDRING.edgeX + Math.cos(-18 * Math.PI / 180) * 40; R.input.mouseY = CMDRING.edgeY + Math.sin(-18 * Math.PI / 180) * 40; R.step(); const lit2 = O.cmdRing?.lit;
      R.press('Escape'); R.up();
      const zs: number[] = [CR.ringZoom(1600, 1000), CR.ringZoom(2560, 1440), CR.ringZoom(3840, 2160), CR.ringZoom(960, 540)];
      line(!!V && V.x === CMDRING.edgeX && V.y === CMDRING.edgeY && V.zoom === 1 && lit0 === 1 && lit1 === 1 && lit2 === 2 && O.log.length === n0 && zs[0] === 1 && Math.abs(zs[1] - 4 / 3) < 1e-9 && zs[2] === 2 && zs[3] === 1, 'opened at the view\'s edge the ring stands whole inside it, and the cursor lights nothing until it has been to its middle; a window larger than its px are for stands it larger, never smaller', `the ring's zoom at 1600 × 1000, 2560 × 1440, 3840 × 2160, 960 × 540: ${zs.map(z => z.toFixed(2)).join(', ')} · cursor at 6,6: ring at ${V?.x},${V?.y} · lit ${lit0}, ${lit1} with the cursor moved outside the middle, ${lit2} once out of the middle toward wedge 2`);
      R.home();
    }

    // 8c. before the key: the hint names what the ring would open on and outlines it — a door by its doorway's line, a man by a ring at his feet, the floor
    //     by a ring on the spot — beside the cursor; with the ring up it is the ring's own target, in its middle; with the order menu up, or its knob off, none
    {
      R.aim(spot); const hf = O.hintView(), cx = R.input.mouseX, cy = R.input.mouseY, tf = O.hover();
      const okFloor = !!hf && hf.kind === 'floor' && !hf.held && !!hf.ring && !hf.seg && Math.abs(hf.x - cx) < 1 && Math.abs(hf.y - cy) < 1 && tf?.kind === 'floor' && dist(hf.ring.at, tf.at) < 0.01;
      onDoor(); const hd = O.hintView(), mid = hd?.seg ? [(hd.seg[0][0] + hd.seg[1][0]) / 2, 0, (hd.seg[0][2] + hd.seg[1][2]) / 2] : null;
      const okDoor = !!hd && hd.kind === 'door' && !!mid && dist(mid, D.frameCentre) < 0.05 && Math.abs(dist(hd.seg![0], hd.seg![1]) - D.def.width) < 0.01;
      R.down(); R.aim(spot); const hh = O.hintView(), rv = O.ringView();
      const okHeld = !!hh && hh.kind === 'door' && hh.held && !!rv && hh.x === rv.x && hh.y === rv.y; R.press('Escape'); R.up();
      let man: any = null, hm: any = null; for (const c of R.team) { if (man) break; for (const y of [1.2, 0.9, 0.5]) { const h = R.aim([c.char.pos[0], c.char.pos[1] + y, c.char.pos[2]]); if (h?.kind === 'none' && h.man === c) { man = c; hm = O.hintView(); break; } } }
      // (… in the colour the ring then opens in: the man's own element, not the standing one)
      let toneUp: any; if (man) { R.down(); toneUp = O.ringView()?.tone; R.press('Escape'); R.up(); }
      const okMan = !!hm && hm.kind === 'man' && !!hm.ring && dist(hm.ring.at, man.char.pos) < 0.05 && hm.tone === toneUp && toneUp !== undefined;
      // (a wall a charge can go on, where this stand has them: its own stretch drawn, never past the wall's ends, and the spot)
      let wall: any = null, hw: any = null; for (let gy = 100; gy <= 900 && !wall; gy += 100) for (let gx = 100; gx <= 1500 && !wall; gx += 100) { R.input.mouseX = gx; R.input.mouseY = gy; R.step(2); const h = O.hover(); if (h?.kind === 'floor' && h.wall && !h.thing) { wall = h.wall; hw = O.hintView(); } }
      const wlen = wall ? 2 * (wall.alongX ? wall.box.h[0] : wall.box.h[2]) : 0, slen = hw?.seg ? dist(hw.seg[0], hw.seg[1]) : -1;
      const okWall = !wall || (!!hw && hw.kind === 'wall' && !!hw.seg && !!hw.ring && slen > 0.3 && slen <= Math.min(2 * CMDRING.hintWallM, wlen) + 0.01);
      // (where the key would open no ring — Shift down with plan mode on, whose toggle Shift + the key then is — no hint; that mode off, Shift is only his
      //  sprint and the hint stays; on Sam himself, the squad's own menu: a glyph and no outline)
      R.aim(spot); R.input.keys.add('ShiftLeft'); R.step(1); const hrun = O.hintView(); CMDRING.plan = true; const hs = O.hintView(); CMDRING.plan = false; R.input.keys.delete('ShiftLeft'); R.step(1);
      const sp = R.game.player.char.pos, hq = (R.aim([sp[0], sp[1] + 1.0, sp[2]]), O.hintView()), tq = O.hover();
      const okSquad = tq?.kind === 'none' && !tq.man ? (!!hq && hq.kind === 'squad' && !hq.seg && !hq.ring) : true;
      R.aim(spot); R.press(ORDERS.key); const hx = O.hintView(), menuUp = !!O.menu; R.press(ORDERS.key);
      const was = CMDRING.hint; CMDRING.hint = false; R.aim(spot); const hk = O.hintView(); CMDRING.hint = was;
      line(okFloor && okDoor && okHeld && okMan && okWall && okSquad && hs === null && hrun?.kind === 'floor' && menuUp && hx === null && hk === null, 'before the key the hint names what the ring would open on and outlines it; with the ring up it is the ring\'s own, in its middle',
        `floor: ${hf?.kind}${hf?.ring ? ' ring' : ''} at the cursor ${okFloor} · door: ${hd?.kind}, its line ${mid ? dist(mid, D.frameCentre).toFixed(2) : '?'} m off the doorway's middle ${okDoor} · held on the door, cursor moved off: ${hh?.kind}, held ${hh?.held}, in the ring's middle ${okHeld} · ${man?.callsign ?? 'nobody'}: ${hm?.kind}, ${hm?.tone} as the ring's ${toneUp} ${okMan} · a wall: ${wall ? `${hw?.kind}, ${slen.toFixed(2)} m of a ${wlen.toFixed(2)} m wall ${okWall}` : 'none to charge on this stand'} · Shift down: ${hs ? hs.kind : 'none'} · on Sam: ${hq ? hq.kind : 'none'} (${tq?.kind}) ${okSquad} · order menu up: ${hx ? hx.kind : 'none'} · knob off: ${hk ? hk.kind : 'none'}`);
      R.home();
    }

    // 9. the old keys beside it: the quick key gives, the menu's key lists the menu in the panel, the who key steps
    {
      R.aim(spot); const n0 = O.log.length; R.press(ORDERS.quickKey); const b = R.tail()?.order, kb = O.log.length - n0; R.home();
      R.aim(spot); R.press(ORDERS.key); const listed = !!O.hud().menu && !O.cmdRing; R.press(ORDERS.key); const shut = !O.menu;
      R.aim(spot); R.press(ORDERS.whoKey); const w = O.who; O.who = 'all';
      line(kb === 1 && b === 'move' && listed && shut && w !== 'all', 'the old keys work beside it: B gives, X lists the menu in the panel, T steps who', `B: ${b} (+${kb}) · X: ${listed ? 'listed, no ring' : 'not listed'} then ${shut ? 'shut' : 'still up'} · T: ${w}`);
      R.home();
    }

    // 10. the switch off: the key is nobody's — no ring, no menu, nothing given
    {
      const was = CMDRING.on; CMDRING.on = false;
      R.aim(spot); const n0 = O.log.length; R.down(); const up = !!O.cmdRing || !!O.menu; R.step(10); R.up(); R.step(3);
      line(!up && O.log.length === n0, 'the switch off: the key is nobody\'s', `ring or menu ${up ? 'up' : 'not up'} · order book +${O.log.length - n0}`);
      CMDRING.on = was;
    }

    // 15 to 20. A TAP OPENS NO RING (CMDRING.holdSecs): the key let go inside the hold is the quick key's order and no menu was ever up; the ring is the
    //            key kept down
    {
      const inp = R.input, KEY = CMDRING.key, N = Math.ceil(CMDRING.holdSecs * 60);
      const keyDown = () => { inp.keys.add(KEY); inp.pressed.add(KEY); R.step(); };
      const floorOf = (t: any) => `floor:${t.at[0].toFixed(1)},${t.at[2].toFixed(1)}`;
      // 15. a tap that lasts most of the hold: no ring, no menu, nothing listed — only the hint, brighter, on what the key went down on — and let go, the order
      {
        R.home(); R.aim(spot); const n0 = O.log.length, q0 = S.quick, o0 = S.opened; keyDown();
        let never = true, press = true;
        for (let i = 0; i < N - 3; i++) { const h = O.hintView(); never &&= !O.cmdRing && !O.menu && O.ringView() === null && O.hud().menu === null; press &&= !!h && h.press === true && h.held && h.kind === 'floor' && Math.abs(h.x - inp.mouseX) < 1 && Math.abs(h.y - inp.mouseY) < 1; R.step(); }
        const mid = O.log.length - n0; R.up(); const row = R.tail(), hAfter = O.hintView();
        line(never && press && mid === 0 && O.log.length === n0 + 1 && row?.order === 'move' && S.quick === q0 + 1 && S.opened === o0 && !O.cmdRing && !O.menu && hAfter?.press === false,
          'a tap opens no ring: the key down most of the hold shows no menu, only the hint brighter on the spot; let go, the squad moves there', `${N - 2} frames down of a ${N}-frame hold: ring or menu ${never ? 'never up' : 'UP'}, the hint ${press ? 'pressed, at the cursor' : 'not as a press'} · order book while down +${mid} · on the key up: ${row?.order} (+${O.log.length - n0}), rings opened +${S.opened - o0}`);
      }
      // 16. the hand moving, his trigger pulled and the menu's key pressed inside the tap: the order still goes, to where the cursor was as the key went down
      {
        R.home(); R.aim(spot); const tgt = O.hover(), n0 = O.log.length, x0 = inp.mouseX, y0 = inp.mouseY; keyDown();
        inp.mouseX = x0 + 150; inp.mouseY = y0 + 70; R.step(); inp.clicked |= 1; R.step(); inp.mouseX = x0 + 300; inp.mouseY = y0 + 140; R.step(); const ringUp = !!O.cmdRing;
        R.up(); const row = R.tail(), k = O.log.length - n0;
        R.home(); R.aim(spot); const n1 = O.log.length; keyDown(); R.press(ORDERS.key); const menuUp = !!O.menu && !O.cmdRing; R.up(); const k2 = O.log.length - n1, row2 = R.tail(); O.close(); R.step(N + 4); const late = !!O.cmdRing;
        line(!ringUp && k === 1 && row?.order === 'move' && tgt?.kind === 'floor' && row.target === floorOf(tgt) && menuUp && k2 === 1 && row2?.order === 'move' && !late,
          'a tap is never lost: the cursor swept away, a left click and the menu\'s key inside it, and the order still goes to where the key went down', `swept 330 px with a left click: ${row?.order} to ${row?.target} (the key went down on ${tgt?.kind === 'floor' ? floorOf(tgt) : tgt?.kind}), +${k}, ring ${ringUp ? 'up' : 'never up'} · the menu's key inside the tap: the menu ${menuUp ? 'listed' : 'not listed'}, on the key up ${row2?.order} (+${k2}) · a ring afterwards: ${late ? 'UP' : 'none'}`);
      }
      // 17. kept down: nothing until the hold is over, then the ring — for what the key went down on, where the cursor now is — and nothing given until it is
      //     let go; out toward wedge 2 and let go, wedge 2's order
      {
        R.home(); R.aim(spot); const tgt = O.hover(), n0 = O.log.length, sx = inp.mouseX, sy = inp.mouseY; keyDown(); R.step(N - 2); const early = !!O.cmdRing || !!O.menu;
        inp.mouseX = sx + (sx > 800 ? -160 : 160); inp.mouseY = sy + (sy > 500 ? -90 : 90); R.step(4);   // (well inside the view: at its edge the ring would stand off the cursor, line 8b)
        const V = O.ringView(), t = O.menu?.target, lit0 = O.cmdRing?.lit, held = O.log.length - n0, moved = Math.hypot(inp.mouseX - sx, inp.mouseY - sy);
        const r2 = O.menu?.rows.find((r: any) => r.key === 2), a = (-90 + 72) * Math.PI / 180, x0 = O.cmdRing?.ax ?? 0, y0 = O.cmdRing?.ay ?? 0, here = Math.abs(x0 - inp.mouseX) < 1 && Math.abs(y0 - inp.mouseY) < 1;
        inp.mouseX = x0 + Math.cos(a) * (CMDRING.flickPx + 14); inp.mouseY = y0 + Math.sin(a) * (CMDRING.flickPx + 14); R.step(); const lit1 = O.cmdRing?.lit;
        R.up(); const row = R.tail();
        line(!early && !!V && t?.kind === 'floor' && tgt?.kind === 'floor' && moved > 150 && here && lit0 === 1 && held === 0 && !!r2 && lit1 === 2 && O.log.length === n0 + 1 && row?.order === r2.id && row.target === floorOf(tgt),
          'kept down, the ring comes up when the hold is over: for the spot the key went down on, at the cursor; out toward wedge 2 and let go, its order', `${N - 1} frames down: ${early ? 'UP ALREADY' : 'nothing up'} · then the ring ${V ? 'up' : 'NOT up'} on the ${t?.kind} with the cursor moved ${moved.toFixed(0)} px on, ${here ? 'at the cursor' : 'NOT at the cursor'}, lit ${lit0}, order book +${held} · toward wedge 2 ('${r2?.id}'): lit ${lit1} · on the key up: ${row?.order} at ${row?.target} (the key went down on ${tgt?.kind === 'floor' ? floorOf(tgt) : tgt?.kind})`);
      }
      // 18. Shift is only his sprint with plan mode off: a tap with it down orders; with that mode on, Shift + the key is its toggle and no order
      {
        R.home(); R.aim(spot); const n0 = O.log.length; inp.keys.add('ShiftLeft'); R.step(); keyDown(); R.step(2); R.up(); const run = O.log.length - n0, row = R.tail();
        CMDRING.plan = true; R.home(); R.aim(spot); const n1 = O.log.length; inp.keys.add('ShiftLeft'); R.step(); keyDown(); R.step(2); R.up(); const planUp = O.plan.up, k = O.log.length - n1;
        if (O.plan.up) { keyDown(); R.up(); } const planDown = !O.plan.up; inp.keys.delete('ShiftLeft'); R.step(); CMDRING.plan = false;
        line(run === 1 && row?.order === 'move' && planUp && k === 0 && planDown, 'Shift down is only his sprint: the tap still orders — and with plan mode on, Shift and the key toggle that mode and order nothing', `plan mode off, Shift down: ${row?.order} (+${run}) · plan mode on: the mode ${planUp ? 'up' : 'NOT up'}, order book +${k}, then ${planDown ? 'down again' : 'STILL UP'}`);
      }
      // 19. the hold at 0 is the ring as first built: up on the frame the key goes down — and a recording from before the hold replays so
      {
        R.home(); R.aim(spot); const n0 = O.log.length; CMDRING.holdSecs = 0; keyDown(); const atOnce = !!O.cmdRing && !!O.menu; R.step(HOLD); R.up(); const k = O.log.length - n0; CMDRING.holdSecs = HOLD_SECS;
        const J: any = await import(`${ROOT}/src/game/journal.ts`), snap = J.knobsSnapshot(g), old = JSON.parse(JSON.stringify(snap));
        delete old.tables.CMDRING.holdSecs; J.applyKnobs(g, old); const oldHold = CMDRING.holdSecs; J.applyKnobs(g, snap); const back = CMDRING.holdSecs;
        line(atOnce && k === 1 && oldHold === 0 && back === HOLD_SECS, 'the hold at 0 is the ring as first built, and a recording from before the hold replays with it at 0', `holdSecs 0: the ring ${atOnce ? 'up on the frame the key went down' : 'NOT up at once'}, on the key up +${k} · a recording with no holdSecs: ${oldHold} · one with it: ${back}`);
      }
      R.home();
    }

    // 11 to 14. HIS OWN HANDS ON THE SAME RING (CMDRING.hands, interact.ts): Sam at a shut door that offers two rows (push, ease)
    {
      const g = R.game, pl = g.player, S = pl.sel, inp = R.input, SP = 'Space';
      const at = (d: any, k: number) => { const c = d.frameCentre, th = d.def.closedDir; g.teleportPlayer([c[0] - Math.sin(th) * k, 0, c[2] + Math.cos(th) * k]); R.step(4); };
      const verbs = () => g.nearby.filter((r: any) => r.verb && r.kind !== 'cancel').map((r: any) => r.verb as string);
      let door: any = null, side = 0.9;
      for (const d of [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, pl.char.pos) - dist(b.frameCentre, pl.char.pos))) { if (door) break; if (!d.isClosed()) continue;
        for (const k of [0.9, -0.9]) { at(d, k); const v = verbs(); if (v[0] === 'push' && v[1] === 'ease') { door = d; side = k; break; } } }
      const sdown = () => { inp.keys.add(SP); inp.pressed.add(SP); R.step(); }, sup = () => { inp.keys.delete(SP); R.step(); };
      const rest = () => { inp.keys.delete(SP); inp.keys.delete('KeyW'); R.step(2); if (IA.runningVerb(g)) IA.cancelSustained(g); R.step(2); pl.fHeld = false; };
      if (!door) line(false, 'his own hands: a shut door with two rows to stand at', 'none found on this floor');
      else {
        // 11. Space down: the ring is up at once — his rows its wedges, the highlighted one lit, no cancel row, the panel's list at rest — and his feet are his
        //     own; a right click, a left click and the window losing the keys each put it away with nothing done (the right click not the launcher's)
        at(door, side); const p0 = [...pl.char.pos]; sdown();
        const V = IA.handRingView(g), ringUp = !!S.ring && S.open, noCancel = !g.nearby.some((r: any) => r.kind === 'cancel'), listShut = !pl.listOpen;
        inp.keys.add('KeyW'); R.step(12); inp.keys.delete('KeyW'); const walked = dist(pl.char.pos, p0), stillUp = !!S.ring;
        const gives = (what: () => void) => { at(door, side); sdown(); const up0 = !!S.ring; what(); R.step(); const gone = !S.ring && !S.open; sup(); R.step(20); const idle = !IA.runningVerb(g) && door.isClosed(); rest(); return up0 && gone && idle; };
        inp.keys.delete(SP); R.press('Escape'); rest();
        const rmb = gives(() => { inp.clicked |= 4; }), noLaunch = !pl.launchHeld, lmb = gives(() => { inp.clicked |= 1; }), blur = gives(() => { inp.keys.delete(SP); inp.pressed.add('Blur'); });
        line(ringUp && !!V && V.lit === 1 && V.wedges.length === 2 && / it open$/.test(V.wedges[0].text) && noCancel && listShut && walked > 0.08 && stillUp && rmb && noLaunch && lmb && blur, 'Space down: his own rows are up as a ring at once, the first lit, no cancel row; his feet are his own; a right click, a left click and a lost window each give nothing',
          `ring ${ringUp} on the frame the key went down · wedges ${V ? V.wedges.map((w: any) => `${w.key}:${w.text}`).join(' | ') : 'none'} · lit ${V?.lit} · under it '${V?.caption}' · cancel row ${noCancel ? 'not listed' : 'listed'} · W held 12 frames: ${walked.toFixed(2)} m, ring ${stillUp ? 'still up' : 'gone'} · nothing done on a right click ${rmb} (launcher ${noLaunch ? 'not begun' : 'begun'}), a left click ${lmb}, the window's blur ${blur}`);
        rest();
        // 12. a digit, or the cursor out of the ring's middle, lights another wedge — a digit is not his weapon slot, one with no row lights nothing — and
        //     letting go does the lit one
        at(door, side); const slot0 = pl.slot; sdown(); R.step(HOLD); const A = S.ring ? { x: S.ring.ax, y: S.ring.ay } : { x: 0, y: 0 };
        const to = (wedge: number, r: number) => { const a = (wedge - 1) * 2 * Math.PI / CMDRING.wedges; inp.mouseX = A.x + Math.sin(a) * r; inp.mouseY = A.y - Math.cos(a) * r; R.step(); return S.ring?.lit; };
        const l0 = to(2, CMDRING.flickPx * 0.6), l1 = to(2, CMDRING.flickPx * 1.5); inp.pressed.add('Digit1'); R.step(); const l2 = S.ring?.lit, slot1 = pl.slot;
        const l3 = to(2, CMDRING.flickPx * 2), l4 = to(1, CMDRING.flickPx * 0.2), l5 = to(2, CMDRING.flickPx * 1.5), l6 = to(4, CMDRING.flickPx * 1.5); inp.pressed.add('Digit5'); R.step(); const l7 = S.ring?.lit; sup();
        const ran = IA.runningVerb(g); inp.pressed.add(SP); inp.keys.add(SP); R.step(); inp.keys.delete(SP); R.step(2); const stopped = !IA.runningVerb(g);
        line(l0 === 1 && l1 === 2 && l2 === 1 && slot1 === slot0 && l3 === 1 && l4 === 1 && l5 === 2 && l6 === 2 && l7 === 2 && ran === `ease:${door.def.name}` && stopped, 'held, the cursor out of the middle or a digit lights another row; a digit is not his weapon slot; letting go does the lit row, and Space again stops it as it always did',
          `toward wedge 2: lit ${l0} inside the middle, ${l1} out of it · the digit 1: lit ${l2}, in his hands ${slot0} then ${slot1} · the cursor moved outside after the digit: ${l3}, back in the middle ${l4}, out again ${l5} · toward a wedge with no row: ${l6}, the digit 5: ${l7} · let go: ${ran || 'nothing running'} · Space again: ${stopped ? 'stopped' : 'still running'}`);
        rest();
        // 12b. a tap made with the hand moving is still the first wedge, on both rings; and Space under the squad's held ring opens no second one
        at(door, side); inp.keys.add(SP); inp.pressed.add(SP); R.step(); const B0 = S.ring ? { x: S.ring.ax, y: S.ring.ay } : { x: 0, y: 0 };
        inp.mouseX = B0.x + 30; inp.mouseY = B0.y - 12; R.step(); inp.mouseX = B0.x + 60; inp.mouseY = B0.y - 24; R.step(); const sweepLit = S.ring?.lit; sup(); R.step(3);
        const sweepRan = IA.runningVerb(g); R.until(() => !door.isClosed(), 3); const sweepOpen = !door.isClosed();
        rest(); at(door, side);
        CMDRING.holdSecs = 0;   // (the ring the moment the key goes down, as first built: its tap guard is what is asked here — with the hold a tap has no ring at all, lines 15 on)
        const n1 = O.log.length; inp.keys.add(CMDRING.key); inp.pressed.add(CMDRING.key); R.step(); const T0 = O.cmdRing ? { x: O.cmdRing.ax, y: O.cmdRing.ay } : { x: 0, y: 0 };
        inp.mouseX = T0.x + 40; inp.mouseY = T0.y + 40; R.step(); const tabLit = O.cmdRing?.lit; inp.pressed.add(SP); inp.keys.add(SP); R.step(); const two = !!S.ring; inp.keys.delete(SP); R.step();
        inp.clicked |= 4; R.step(); R.up(); R.step(2); CMDRING.holdSecs = HOLD_SECS;
        line(sweepLit === 1 && !sweepRan && sweepOpen && tabLit === 1 && !two && O.log.length === n1, 'a tap made with the hand moving is still the first wedge, on both rings; Space under the squad\'s held ring opens no second ring',
          `Space, the cursor 65 px out by the third frame: lit ${sweepLit}, ${sweepRan || 'nothing sustained running'}, the door ${sweepOpen ? 'pushed open' : 'still shut'} · the squad's key, the cursor 57 px out on the second frame: lit ${tabLit} · Space under it: his own ring ${two ? 'up as well' : 'not up'}`);
        rest();
        // 13. a tap is the tap it was: the highlighted row at once — the door is pushed open
        const d13 = [...g.doors.list].find((d: any) => d.isClosed() && [0.9, -0.9].some(k => { at(d, k); return verbs()[0] === 'push'; })) ?? door;
        inp.keys.add(SP); inp.pressed.add(SP); R.step(); sup(); R.until(() => !d13.isClosed(), 3); const opened = !d13.isClosed();
        line(opened && !S.ring, 'a tap is the tap it was: the door is pushed open', `${d13.def.name}: ${opened ? 'open' : 'still shut'} · ring ${S.ring ? 'still up' : 'gone'}`);
        rest();
        // 14. its own key off, the ring's on: Space is the list as it was — nothing opens for a quarter second, then the list with its cancel row, feet still
        const was = CMDRING.hands; CMDRING.hands = false;
        const d2 = [...g.doors.list].find((d: any) => d.isClosed() && d !== door && d !== d13 && [0.9, -0.9].some(k => { at(d, k); return verbs().length >= 2; })) ?? null;
        if (!d2) line(false, 'the list as it was with the ring\'s Space off', 'no second shut door with two rows');
        else { const q0 = [...pl.char.pos]; sdown(); const early = S.open || !!S.ring; R.step(20); const open = S.open && !S.ring, cancel = g.nearby.some((r: any) => r.kind === 'cancel');
          inp.keys.add('KeyW'); R.step(20); inp.keys.delete('KeyW'); const still = dist(pl.char.pos, q0); R.press('Escape'); sup();
          line(!early && open && cancel && still < 0.05, 'Space\'s own key off: the list as it was — a quarter second, then the list with its cancel row, feet still', `on the frame it went down: ${early ? 'open' : 'not open'} · 20 frames on: ${open ? 'the list' : 'no list'}, cancel row ${cancel ? 'listed' : 'not listed'} · W held 20 frames: ${still.toFixed(2)} m`); }
        CMDRING.hands = was; rest();
      }
    }
  } finally { CMDRING.on = keep.on; CMDRING.hint = keep.hint; CMDRING.hands = keep.hands; CMDRING.plan = keep.plan; CMDRING.planRts = keep.rts; CMDRING.holdSecs = keep.hold; AUTOPILOT.on = keep.ap; Math.random = keep.rnd; }
  console.log(fails ? `cmdring-check: ${fails} FAIL` : 'cmdring-check: ALL PASS');
  return fails === 0;
}

if (import.meta.main) process.exit((await cmdringCheck()) ? 0 : 1);
