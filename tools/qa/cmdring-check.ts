// THE ORDERS RING, A PROTOTYPE (src/game/cmdring.ts, CMDRING.on — off unless asked for on the page and on both stands): the ring's key through the
// game's own input, headless.
//   bun run tools/qa/cmdring-check.ts            (also `probes.ts cmdring`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/cmdring-check.ts      — the same lines on the page's stand
// PASS / FAIL each: the room clear on the office with its squad of four, everybody under god mode (the lines are about what is ORDERED, not who wins).
// The check raises the switch itself (no stand has it on) and the quick key's autopilot with it, so the first wedge has something to choose. The key is
// HELD the way a hand holds it: in `input.keys` from the frame it goes down to the frame it comes up; a tap is down for one frame.
// CMDRING_BREAK=1 = the switch left off and the same lines asked: they must fail (the switch-off line and the old keys' line are the ones that hold).
//   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const CR: any = await import(`${ROOT}/src/game/cmdring.ts`);
const AP: any = await import(`${ROOT}/src/game/autopilot.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { CMDRING, CMDRING_STATS } = CR, { AUTOPILOT } = AP;

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const BREAK = process.env.CMDRING_BREAK === '1';

async function rig(seed: number, on = !BREAK) {
  const squad0 = NIGHTBREACH.squad; let W: any, why: any;
  try {
    Object.assign(NIGHTBREACH, { squad: 4 });
    Math.random = seeded(seed);
    W = await standUp();
    CMDRING.on = on; CMDRING.hint = on; AUTOPILOT.on = true;
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
    down() { input.keys.add(KEY); input.pressed.add(KEY); R.step(); },
    /** … and comes up: the frame it is read in */
    up() { input.keys.delete(KEY); R.step(); },
    /** a tap: down for one frame */
    tap() { R.down(); R.up(); },
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
  const keep = { on: CMDRING.on, hint: CMDRING.hint, ap: AUTOPILOT.on, rnd: Math.random };
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
      // (where the key would open no ring — Shift down — no hint; on Sam himself, the squad's own menu: a glyph and no outline)
      R.aim(spot); R.input.keys.add('ShiftLeft'); R.step(1); const hs = O.hintView(); R.input.keys.delete('ShiftLeft'); R.step(1);
      const sp = R.game.player.char.pos, hq = (R.aim([sp[0], sp[1] + 1.0, sp[2]]), O.hintView()), tq = O.hover();
      const okSquad = tq?.kind === 'none' && !tq.man ? (!!hq && hq.kind === 'squad' && !hq.seg && !hq.ring) : true;
      R.aim(spot); R.press(ORDERS.key); const hx = O.hintView(), menuUp = !!O.menu; R.press(ORDERS.key);
      const was = CMDRING.hint; CMDRING.hint = false; R.aim(spot); const hk = O.hintView(); CMDRING.hint = was;
      line(okFloor && okDoor && okHeld && okMan && okWall && okSquad && hs === null && menuUp && hx === null && hk === null, 'before the key the hint names what the ring would open on and outlines it; with the ring up it is the ring\'s own, in its middle',
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
  } finally { CMDRING.on = keep.on; CMDRING.hint = keep.hint; AUTOPILOT.on = keep.ap; Math.random = keep.rnd; }
  console.log(fails ? `cmdring-check: ${fails} FAIL` : 'cmdring-check: ALL PASS');
  return fails === 0;
}

if (import.meta.main) process.exit((await cmdringCheck()) ? 0 : 1);
