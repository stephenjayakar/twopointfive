// The 'shutdoor' family: A TEAMMATE SHUTS A DOOR WHEN TOLD, AND ONLY THEN (src/game/shutdoor.ts; the maintainer's tap 10-08 "On order": "A shut that door row goes on
// the door menu and teammates shut one only when told."). Run through probes.ts:
//   bun run tools/qa/probes.ts shutdoor | shutdoor-menu | shutdoor-refuse | shutdoor-man | shutdoor-who | shutdoor-file | shutdoor-lock | shutdoor-never
// and again on the shipped doors: ONEWAY=1 QA_DOORSTAY=1 (QA_DOORBLAST=1 QA_DOORMANNERS=1) bun run tools/qa/probes.ts shutdoor
// PASS / FAIL each, all headless: the Game of headless.ts under the room clear's staging with four teammates, Sam in god mode and dark. A leaf is stood open
// by hand (its angle set, its closer held off as a showcase holds one) so the family reads the same with the old closers and with doors that stay. Nothing
// here looks at a picture: there is no hand on a handle to see, and nobody has watched the leaf come to.
//   shutdoor-menu    X, 5 on a SHUT door: the door tools' page as it was (… 3 breach with a charge …). On a door that stands open (0.6 rad and more, the door
//                    tools' own line): 3 is 'shut that door', the other rows and every digit as they were, nothing above 5; a leaf only ajar, and a door with
//                    a charge set on it, keep the charge's row. X, 5, 3 gives the order
//   shutdoor-refuse  greyed with its reason, each one: the leaf off its hinges · Sam in its swing · a teammate in its swing · a body in its swing · no place to
//                    shut it from · an enemy in sight through it. A refusal moves nobody and logs nothing; with the cause gone the same row is given
//   shutdoor-man     the four holding at four distances, the order to all: ONE man takes it, the one with the shortest walk to the place he is sent; the other
//                    three keep the very assignments they had. He never goes above the team's pace (the silent pace when silent, his word over the net), the
//                    leaf is pulled only with him clear of the floor it crosses, within reach of its handle and on the face he stood on, nothing louder than
//                    its latch is heard of it, it latches, he says so once, and he holds by the door. From both faces of the leaf, and from inside the room
//   shutdoor-who     addressed to one pair: a man of that pair, with a man of the other pair standing nearer; addressed to one man: him
//   shutdoor-file    a man taken from 'fall in' goes back into the file when the door is shut — told twice too — and one on the far face of the door from
//                    Sam comes through and shuts it from Sam's side
//   shutdoor-lock    a keyed door shut on order is locked as it latches (the door's own rule)
//   shutdoor-never   five minutes of a played room clear (stack, open and clear, fall in, room after room) on doors that stay open, the order never given:
//                    the row is never assigned, its counters and log stay empty, teammates open leaves and none they touched last comes to its latch. The
//                    same five minutes with the order given once move all of those (so the lines can go red)
import { standUp, ROOT } from './headless.ts';
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { DOORWAY, DOORSTAY } = await import(`${ROOT}/src/game/doors.ts`);
const { PACE } = await import(`${ROOT}/src/game/guards.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { setSilent, squadSilent, SILENT } = await import(`${ROOT}/src/game/silent.ts`);
const { SHUTDOOR_STATS, SHUTDOOR_LOG, SHUT_ID, shutSpot } = await import(`${ROOT}/src/game/shutdoor.ts`);
const FRAG_KEY = 'G';   // (the shared build's frag row sits on the door tools' page on a key of its own, never a digit)

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} (doors: ${doors()}) ===`); return all; } };
}
const DT_DEFAULTS = JSON.parse(JSON.stringify(DOORTOOLS)), RC_DEFAULTS = { ...ROOMCLEAR }, NB_DEFAULTS = { ...NIGHTBREACH };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const guarded = (fn: () => Promise<boolean>) => async () => { const silentOn = SILENT.on, stayOn = DOORSTAY.on; try { return await fn(); } finally { SILENT.on = silentOn; DOORSTAY.on = stayOn; Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS); } };
const logText = () => SHUTDOOR_LOG.map((l: any) => `${l.who}: ${l.what}`).join(' | ');
const doors = () => `one-way ${DOORWAY.oneWay ? 'on' : 'off'}, stay open ${DOORSTAY.on ? 'on' : 'off'}`;

// the door's own geometry, worked here from its definition (not through the module under test)
const frame = (d: any) => { const c = d.def.closedDir, ux = Math.cos(c), uz = Math.sin(c); return { hx: d.def.hinge[0], hz: d.def.hinge[1], ux, uz, nx: -uz, nz: ux, W: d.def.width as number }; };
const pt = (d: any, along: number, o: number): [number, number, number] => { const F = frame(d); return [F.hx + F.ux * along + F.nx * o, 0, F.hz + F.uz * along + F.nz * o]; };
const handle = (d: any) => pt(d, d.def.width - 0.14, 0);
const faceOf = (d: any, p: number[]) => { const F = frame(d); return ((p[0] - F.hx) * F.nx + (p[2] - F.hz) * F.nz) >= 0 ? 1 : -1; };
/** is (x, z) — a body of radius r — on the floor the leaf has still to cross to come shut from the angle it stands at */
function inWay(d: any, p: number[], r: number): boolean {
  const F = frame(d), px = p[0] - F.hx, pz = p[2] - F.hz, R = Math.hypot(px, pz); if (R > F.W + r) return false;
  const along = px * F.ux + pz * F.uz, perp = px * F.nx + pz * F.nz; if (along > -r && along < F.W + r && Math.abs(perp) < r) return true;
  let th = Math.atan2(perp, along) * (Math.sign(d.angle) || 1); return th >= 0 && th <= Math.abs(d.angle);
}
/** stand a leaf open at `a` rad (sign = the face it stands on; one-way doors open one way only) with its closer held off */
function prop(d: any, a = 1.35, face?: number) { const s = DOORWAY.oneWay ? d.swing : (face ?? 1); d.latched = false; d.off = false; d.angle = s * Math.min(a, Math.abs(s > 0 ? d.maxA : d.minA)); d.vel = 0; d.closing = false; d.quietT = -3600; d.place(); }
function shut(d: any) { d.off = false; d.angle = 0; d.vel = 0; d.closing = false; d.latched = true; d.quietT = 10; d.place(); }
function pathLen(g: any, a: number[], b: number[]): number { if (dist(a, b) < 0.5) return dist(a, b); const p = g.col.nav.findPath(a, b); if (!p) return Infinity; let L = 0, q = a; for (const w of p) { L += dist(q, w); q = w; } return L + dist(q, b); }

/** One game under a seed: the room clear staged with four teammates, Sam in god mode and dark, the defenders kept dazzled unless `fight`. */
async function rig(seed: number, o: { fight?: boolean; squad?: 2 | 4; keep?: boolean } = {}) {
  Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS, { squad: o.squad ?? 4 });
  SHUTDOOR_LOG.length = 0; for (const k of Object.keys(SHUTDOOR_STATS)) (SHUTDOOR_STATS as any)[k] = 0;
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game, input = W.input; const RC = game.roomClear, NB = game.nightBreach, O = game.orders, D = game.doorTools;
  game.godMode = true;
  const why = RC.start(seed);
  const heard = new WeakSet<any>(), seen = new Set<any>();
  const R = { W, game, input, RC, NB, O, D, why, quiet: !o.fight, lines: [] as { who: string; text: string; t: number; net: boolean }[],
    /** hearing events of kind 'door' and their levels, as filed · run after every frame */
    doorEvents: [] as { t: number; level: number; who: number }[], post: null as null | (() => void),
    /** every frame a man had the order: how many had it at once at most · their top speed */
    most: 0, top: 0, everHad: new Set<any>(),
    get ops(): any[] { return NB.ops; }, get hostiles(): any[] { return NB.hostiles; },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        game.player.visibility = 0.05;
        if (R.quiet) for (const h of NB.hostiles) if (h.state !== 'dead') h.dazzledUntil = game.time + 5;
        const was = R.ops.map((x: any) => [x, x.char.pos[0], x.char.pos[2], O.of(x)?.order === SHUT_ID] as const);
        W.step(DT);
        let n = 0; for (const [x, px, pz, had] of was) { const has = O.of(x)?.order === SHUT_ID; if (has) { n++; R.everHad.add(x); } if (had && has && x.state !== 'dead') R.top = Math.max(R.top, Math.hypot(x.char.pos[0] - px, x.char.pos[2] - pz) / DT); }
        R.most = Math.max(R.most, n);
        for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); if (e.kind === 'door') R.doorEvents.push({ t: e.time, level: e.level, who: e.who }); }
        for (const gd of game.guards) { const b = gd.bubble; if (b && !heard.has(b)) { heard.add(b); R.lines.push({ who: gd.callsign, text: b.text, t: game.time, net: !!b.radio }); } }
        R.post?.();
      }
    },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(name: string): any { return game.doors.list.find((d: any) => d.def.name === name); },
    target(name: string) { return O.targetAt(R.door(name).frameCentre); },
    give(id: string, name: string, who: any = 'all'): string | null { return O.give(id, R.target(name), who); },
    /** put the teammates at these places, standing, and have them hold there */
    stand(places: number[][]) { R.ops.forEach((x: any, i: number) => { const p = places[i]; if (!p) return; x.char.pos[0] = p[0]; x.char.pos[2] = p[2]; x.char.vel[0] = x.char.vel[2] = 0; }); R.step(2); O.give('hold', { kind: 'none' }, 'all'); R.step(20); },
    /** X pressed on p: the first page's rows, then the door tools' page behind its opener (ids, digits, words, greyed, reasons), Esc, Esc */
    menuOn(p: number[]) {
      W.cursorAt([p[0], p[1], p[2]]); input.pressed.add(ORDERS.key); R.step(); R.step(24);
      const read = () => { const M = O.menu, hud = O.hud().menu; return M ? { ids: M.rows.map((r: any) => r.id) as string[], why: [...M.why] as (string | null)[],
        rows: (hud?.rows ?? []).slice(1).filter((r: any) => r.kind !== 'cancel').map((r: any) => ({ key: String(r.opts[0]?.key), text: String(r.opts[0]?.text), off: !!r.off })) } : null; };
      const first = read(); if (!first) { input.pressed.add('Escape'); R.step(); return null; }
      const opener = O.menu.rows.find((r: any) => r.opens); let tools: ReturnType<typeof read> = null;
      if (opener) { input.pressed.add(`Digit${opener.key}`); R.step(); R.step(4); tools = O.menu?.page === opener.opens ? read() : null; input.pressed.add('Escape'); R.step(); }
      input.pressed.add('Escape'); R.step();
      return { first, tools };
    },
    /** X on p, then the digits a third of a second later, as a player gives a row behind a page */
    pick(p: number[], ...n: number[]) { W.cursorAt([p[0], p[1], p[2]]); input.pressed.add(ORDERS.key); R.step(); R.step(20); for (const k of n) { input.pressed.add(`Digit${k}`); R.step(); R.step(4); } },
    said(who: any, since: number) { return R.lines.filter(l => l.who === who.callsign && l.t >= since).map(l => l.text); },
  };
  R.step(30);
  if (!o.fight && !o.keep) { NB.hostiles.forEach((h: any, i: number) => { h.char.pos[0] = PARK[0] + i * 1.2; h.char.pos[2] = PARK[2]; }); R.step(30); }   // (the defenders out of every sight line: the lot outside, dazzled)
  return R;
}
type Rig = Awaited<ReturnType<typeof rig>>;
/** the row of the door tools' page on digit 3, as the menu shows it on that door */
const row3 = (R: Rig, d: any) => { const m = R.menuOn(d.frameCentre), i = m?.tools?.rows.findIndex((r: any) => r.key === '3') ?? -1; return { m, id: i >= 0 ? m!.tools!.ids[i] : '', row: i >= 0 ? m!.tools!.rows[i] : null, why: i >= 0 ? m!.tools!.why[i] : null }; };
// the corridor outside the break room's west door, and the lobby: four places a man can hold at, nearest the door first
const WEST = [[25.6, 0, 18.6], [23.0, 0, 18.2], [20.0, 0, 18.0], [16.0, 0, 17.6]];
const SAM_W = [24.2, 0, 19.2];
const PARK = [44, 0, 30];
const INSIDE = [29.6, 0, 18.4];   // in the break room, the far face of its west door from the corridor

// ---------------------------------------------------------------- menu
export const shutdoorMenu = guarded(async () => {
  const { verdict, done } = family(`shutdoor-menu: the row sits on the charge's digit while the door stands open, and nowhere else`);
  const R = await rig(3); const { O, D, game: g } = R; const d = R.door('breakroom_w');
  g.teleportPlayer(SAM_W); R.stand(WEST);
  shut(d); R.step(5);
  const a = R.menuOn(d.frameCentre), a3 = a?.tools?.rows[2];
  verdict(!!a && a.first.ids.join(' ') === 'stack cover fallIn hold tools' && a.tools?.ids.join(' ') === 'openClear bangClear charge thr fragClear' && a3?.key === '3' && /^breach with a charge/.test(a3.text),
    'a SHUT door: the first page and the door tools\' page as they were — 3 is breach with a charge', `${a?.first.ids.join(' ')} ▸ ${a?.tools?.ids.join(' ')} · 3 "${a3?.text}"`);
  prop(d); R.step(5);
  const b = R.menuOn(d.frameCentre), b3 = b?.tools?.rows[2], keys = [...(b?.first.rows ?? []), ...(b?.tools?.rows ?? [])].map(r => r.key);
  verdict(!!b && b.first.ids.join(' ') === 'stack cover fallIn hold tools' && b.tools?.ids.join(' ') === `openClear bangClear ${SHUT_ID} thr fragClear` && b3?.key === '3' && b3.text === 'shut that door' && !b3.off && b.tools!.why[2] === null,
    'the same door standing OPEN: 3 is shut that door, lit; rows 1, 2 and 4 of the page and the first page are the ones they were', `${b?.first.ids.join(' ')} ▸ ${b?.tools?.ids.join(' ')} · 3 "${b3?.text}" off ${b3?.off} why ${b?.tools?.why[2]}`);
  verdict(keys.length >= 9 && keys.every(k => /^[1-5]$/.test(k) || k === FRAG_KEY) && (b?.tools?.rows.map((r: any) => r.key).join('').startsWith('1234')) && JSON.stringify(b?.tools?.rows.map((r: any) => r.key)) === JSON.stringify(a?.tools?.rows.map((r: any) => r.key)), 'no row of either page is on a digit above 5, and the page\'s digits are the ones the shut door\'s page has', `open: ${b?.tools?.rows.map((r: any) => `${r.key} ${r.text}`).join(' | ')} · shut: ${a?.tools?.rows.map((r: any) => `${r.key} ${r.text}`).join(' | ')}`);
  // 'stands open' is the door tools' own line (0.6 rad: where a charge is refused "it's open."): past it the row, short of it the charge's row as ever
  prop(d, 0.7); R.step(2); const c = row3(R, d); prop(d, 0.5); R.step(2); const c2 = row3(R, d); prop(d, 0.05); R.step(2); const c3 = row3(R, d);
  verdict(c.id === SHUT_ID && !c.row?.off && c2.id === 'charge' && c3.id === 'charge', 'a leaf 0.7 rad open gets the row; one ajar at 0.5 rad and one a hair off its latch keep the charge row', `0.7 rad: ${c.id} · 0.5 rad: ${c2.id} "${c2.row?.text}" · 0.05 rad: ${c3.id}`);
  { const w = O.give(SHUT_ID, O.targetAt(d.frameCentre)); verdict(/all but shut/.test(w ?? ''), '  given by its id on a leaf only ajar: refused — it\'s all but shut', `give: "${w}"`); }
  // a charge set on the door: the charge's row stays (it blows it)
  shut(d); R.step(5); const w = R.give('charge', 'breakroom_w'); const set = R.until(() => !!D.chargeOn(d), 40); R.stand(WEST);   // (the man at the lock stood back: at the leaf he would shoulder it open)
  prop(d, 0.3); R.step(5); const e = row3(R, d);
  verdict(w === null && set && !!D.chargeOn(d) && e.id === 'charge' && /^blow the charge/.test(e.row?.text ?? ''), 'a door with a charge set on it, come ajar (0.3 rad): the charge\'s row stays — blow the charge (a leaf come wide open drops its charge: doortools.ts)', `charge order: ${w} · set ${set} · still on ${!!D.chargeOn(d)} · 3 is ${e.id} "${e.row?.text}"`);
  // X, 5, 3 gives it
  const R2 = await rig(3); const d2 = R2.door('breakroom_w'); R2.game.teleportPlayer(SAM_W); R2.stand(WEST); prop(d2); R2.step(5);
  const n0 = R2.O.log.length; R2.pick(d2.frameCentre, 5, 3); R2.step(10);
  const last = R2.O.log[R2.O.log.length - 1], has = R2.ops.filter((x: any) => R2.O.of(x)?.order === SHUT_ID);
  verdict(R2.O.log.length === n0 + 1 && last?.order === SHUT_ID && last.target === 'door:breakroom_w' && has.length === 1 && R2.O.menu === null,
    'X, 5, 3 on the open door gives the order: one row in the order log, one man under it, the menu away', `log +${R2.O.log.length - n0}: ${last?.order} ${last?.target} to ${last?.who} · under it: ${has.map((x: any) => x.callsign)} · menu ${R2.O.menu === null ? 'closed' : 'open'}`);
  return done();
});

// ---------------------------------------------------------------- refusals
export const shutdoorRefuse = guarded(async () => {
  const { verdict, done } = family(`shutdoor-refuse: greyed with its reason, never gone, and a refusal moves nobody`);
  const R = await rig(5); const { O, game: g } = R; const d = R.door('breakroom_w');
  g.teleportPlayer(SAM_W); R.stand(WEST); prop(d); R.step(5);
  const mid = () => { const F = frame(d), a = d.angle / 2, r = F.W * 0.6, c = d.def.closedDir + a; return [F.hx + Math.cos(c) * r, 0, F.hz + Math.sin(c) * r]; };   // the middle of the floor the leaf crosses
  const snap = () => R.ops.map((x: any) => O.of(x));
  /** the row as the menu shows it and as give() answers it, with nobody's assignment touched and nothing logged */
  const refused = (want: RegExp) => { const before = snap(), n0 = O.log.length; const r = row3(R, d), w = O.give(SHUT_ID, O.targetAt(d.frameCentre)); R.step(3);
    const same = snap().every((a: any, i: number) => a === before[i]) && O.log.length === n0;
    return { ok: r.id === SHUT_ID && !!r.row?.off && want.test(r.why ?? '') && want.test(w ?? '') && same, text: `row 3: ${r.id}${r.row?.off ? ' (greyed)' : ' (lit)'} "${r.why}" · give: "${w}" · assignments ${same ? 'untouched' : 'CHANGED'}` }; };
  // off its hinges
  d.off = true; d.angle = Math.sign(d.angle) * Math.PI / 2; d.place(); R.step(2);
  { const x = refused(/off its hinges/); verdict(x.ok, 'the leaf off its hinges: the row is there, greyed — it\'s off its hinges', x.text); }
  prop(d); R.step(2);
  // Sam in its swing
  g.teleportPlayer(mid()); R.step(3);
  { const x = refused(/you're in its way/); verdict(x.ok, 'Sam standing where the leaf comes round: you\'re in its way', `Sam ${at(g.player.char.pos)} · ${x.text}`); }
  g.teleportPlayer(SAM_W); R.step(3);
  // a teammate in its swing, the order addressed to another man
  { const a = R.ops[3], p = mid(); a.char.pos[0] = p[0]; a.char.pos[2] = p[2]; R.step(1); O.give('hold', { kind: 'none' }, 3); R.step(3);
    const before = snap(), n0 = O.log.length, w = O.give(SHUT_ID, O.targetAt(d.frameCentre), 0); R.step(2);
    verdict(new RegExp(`${a.callsign} is in its way`).test(w ?? '') && snap().every((q: any, i: number) => q === before[i]) && O.log.length === n0, 'a teammate standing in it, the order addressed to another man: refused, naming him', `give to ${R.ops[0].callsign}: "${w}"`);
    // … and addressed to all, he is the nearest: he takes it himself and steps out of it
    const w2 = O.give(SHUT_ID, O.targetAt(d.frameCentre)); const took = R.ops.find((x: any) => O.of(x)?.order === SHUT_ID); const ok = R.until(() => d.latched, 20);
    verdict(w2 === null && took === a && ok, '… addressed to all, the man in the swing is the nearest: he takes it, steps clear and shuts it', `give: ${w2} · taken by ${took?.callsign} · latched ${ok} · ${logText()}`);
    R.until(() => !R.ops.some((x: any) => O.of(x)?.order === SHUT_ID), 5); prop(d); R.stand(WEST); }   // (his order over before the leaf is stood open again: a man still on it pulls a leaf that stopped a second time, as he should)
  // no place to shut it from: no floor anybody can stand on
  { R.step(1); const nav = g.col.nav, real = nav.isBlocked, before = snap(), n0 = O.log.length; let w: string | null = null; nav.isBlocked = () => true; try { w = O.give(SHUT_ID, O.targetAt(d.frameCentre)); } finally { nav.isBlocked = real; }
    R.step(2); const same = snap().every((a: any, i: number) => a === before[i]) && O.log.length === n0;
    verdict(/no place to shut it from/.test(w ?? '') && same, 'no floor to stand on by its latch jamb (the walkers\' grid blanked for the one question — the menu asks the same function): no place to shut it from', `give: "${w}" · assignments ${same ? 'untouched' : 'CHANGED'}`); }
  // an enemy in sight through it
  { const R3 = await rig(5, { fight: true }); const g3 = R3.game, d3 = R3.door('breakroom_w'); g3.teleportPlayer(SAM_W); prop(d3); R3.stand([[26.0, 0, 17.6], [24.5, 0, 18.4], [22, 0, 18], [16, 0, 17.6]]);
    const h = R3.hostiles.find((x: any) => x.state !== 'dead'); for (const o of R3.hostiles) if (o !== h) { o.char.pos[0] = 6; o.char.pos[2] = 30; o.dazzledUntil = 1e9; }
    const F = frame(d3), far = pt(d3, F.W / 2, -faceOf(d3, R3.ops[0].char.pos) * 2.6);   // inside the room, on the far face from the corridor men
    h.char.pos[0] = far[0]; h.char.pos[2] = far[2]; h.dazzledUntil = 1e9; h.god = true;
    const sees = R3.until(() => g3.fight.seenBy(h).length > 0, 6);
    const r = row3(R3, d3), w = R3.O.give(SHUT_ID, R3.O.targetAt(d3.frameCentre));
    verdict(sees && r.id === SHUT_ID && !!r.row?.off && /contact through that door/.test(r.why ?? '') && /contact through that door/.test(w ?? ''), 'a defender the team has in sight through the doorway: contact through that door',
      `${h.callsign} at ${at(h.char.pos)} seen by ${g3.fight.seenBy(h).map((x: any) => x.callsign)} · row 3: ${r.id}${r.row?.off ? ' (greyed)' : ''} "${r.why}" · give: "${w}"`); }
  // a body in its swing
  { const R4 = await rig(5, { keep: true }); const g4 = R4.game, d4 = R4.door('breakroom_w'); g4.teleportPlayer(SAM_W); R4.stand(WEST); prop(d4); R4.step(5);
    const F = frame(d4), c = d4.def.closedDir + d4.angle / 2, p = [F.hx + Math.cos(c) * F.W * 0.6, 0, F.hz + Math.sin(c) * F.W * 0.6];
    const h = R4.hostiles[0]; R4.hostiles.forEach((o: any, i: number) => { if (o !== h) { o.char.pos[0] = PARK[0] + i * 1.2; o.char.pos[2] = PARK[2]; } });
    h.char.pos[0] = p[0]; h.char.pos[2] = p[2]; R4.step(1); killGuard(g4, h, [0, 0, 0.01], true, 'struck', 'player'); R4.step(150);
    { const rg = h.char.ragdoll, q = rg.point(0), dx = p[0] - q[0], dz = p[2] - q[2]; for (let i = 0; i * 3 < rg.x.length; i++) rg.nudge(i, dx, dz); }   // (laid where the leaf comes round whichever way he fell: a real door's swing is too short to count on his fall ending in it)
    prop(d4); R4.step(2);
    const rag = h.char.ragdoll, before = R4.ops.map((x: any) => R4.O.of(x)), r = row3(R4, d4), w = R4.O.give(SHUT_ID, R4.O.targetAt(d4.frameCentre)); R4.step(3);
    verdict(h.state === 'dead' && r.id === SHUT_ID && !!r.row?.off && /body's in its way/.test(r.why ?? '') && /body's in its way/.test(w ?? '') && R4.ops.every((x: any, i: number) => R4.O.of(x) === before[i]),
      'a body lying where the leaf comes round: a body\'s in its way', `${h.callsign} ${h.state}, pelvis ${rag ? at(rag.point(0)) : 'no ragdoll'} · row 3: ${r.id}${r.row?.off ? ' (greyed)' : ' (lit)'} "${r.why}" · give: "${w}"`); }
  // with nothing in the way the same row is given
  { const r = row3(R, d), w = O.give(SHUT_ID, O.targetAt(d.frameCentre)); const ok = R.until(() => d.latched, 20);
    verdict(r.id === SHUT_ID && !r.row?.off && w === null && ok, 'with every cause gone the same row is lit, given, and the door shut', `row 3: ${r.id}${r.row?.off ? ' (greyed)' : ' (lit)'} · give: ${w} · latched ${ok}`); }
  // a shut door has no such order to take
  { const w = O.give(SHUT_ID, O.targetAt(d.frameCentre)); verdict(/it's shut/.test(w ?? ''), 'given by its id on a door that is shut: refused — it\'s shut', `give: "${w}"`); }
  return done();
});

/** one order on one door with the four holding at `places`: who took it, what the others kept, his pace, where he stood when the leaf first moved, how it ended */
async function oneShut(seed: number, name: string, places: number[][], sam: number[], o: { face?: number; who?: any; silent?: boolean; fallIn?: boolean; pre?: (R: Rig, d: any) => void; again?: number } = {}) {
  const R = await rig(seed); const { O, game: g } = R; const d = R.door(name);
  g.teleportPlayer(sam); R.stand(places); if (o.silent) { SILENT.on = true; setSilent(g, true); R.step(5); }
  if (o.fallIn) { O.give('fallIn', { kind: 'none' }, 'all'); R.step(60 * 4); }
  prop(d, 1.35, o.face); R.step(5); o.pre?.(R, d);
  const before = R.ops.map((x: any) => O.of(x)), spots = [1, -1].map(s => shutSpot(g, d, s)), t0 = g.time, a0 = d.angle, ev0 = R.doorEvents.length;
  const why = O.give(SHUT_ID, O.targetAt(d.frameCentre), o.who ?? 'all');
  const man = R.ops.find((x: any) => O.of(x)?.order === SHUT_ID) ?? null, post = man ? [...O.of(man).post] : null, pos0 = man ? [...man.char.pos] : null, sam0 = [...g.player.char.pos];
  const walks = post ? R.ops.map((x: any) => pathLen(g, x.char.pos, post)) : [];
  let moved: null | { t: number; pos: number[]; reach: number; inWay: boolean } = null, others = true, lastA = Math.abs(d.angle), reopened = false;
  R.post = () => { if (!moved && man && Math.abs(d.angle) < Math.abs(a0) - 1e-4) moved = { t: g.time, pos: [...man.char.pos], reach: dist(man.char.pos, handle(d)), inWay: inWay(d, man.char.pos, 0.3) };
    if (moved && Math.abs(d.angle) > lastA + 0.02) reopened = true; lastA = Math.abs(d.angle);
    R.ops.forEach((x: any, i: number) => { if (x !== man && O.of(x) !== before[i]) others = false; }); };
  let again: string | null | undefined; if (o.again && man) { R.step(Math.round(o.again * 60)); again = O.give(SHUT_ID, O.targetAt(d.frameCentre), R.ops.indexOf(man)); }   // (told a second time, on his way)
  const latched = R.until(() => d.latched && !R.ops.some((x: any) => O.of(x)?.order === SHUT_ID), 40); const secs = g.time - t0;
  R.post = null; R.step(60);
  return { R, g, O, d, why, man, post, pos0, sam0, a0, again, walks, before, spots, moved: moved as null | { t: number; pos: number[]; reach: number; inWay: boolean }, others, reopened, latched, secs, t0,
    loud: Math.max(0, ...R.doorEvents.slice(ev0).map(e => e.level)), after: man ? O.of(man) : null };
}

// ---------------------------------------------------------------- the man
export const shutdoorMan = guarded(async () => {
  const { verdict, done } = family(`shutdoor-man: one man, the nearest by his walk, at the team's pace, clear of the swing, to the latch — and the rest keep their orders`);
  const cases: { name: string; places: number[][]; sam: number[]; face?: number; silent?: boolean; label: string }[] = [
    { name: 'breakroom_w', places: WEST, sam: SAM_W, face: 1, label: 'break room west door, leaf stood on its + face' },
    { name: 'breakroom_w', places: WEST, sam: SAM_W, face: -1, label: 'break room west door, leaf stood on its − face' },
    { name: 'breakroom_w', places: [WEST[2], WEST[3], WEST[0], WEST[1]], sam: SAM_W, face: 1, label: 'the same with the men dealt the other way round' },
    { name: 'breakroom_w', places: WEST, sam: SAM_W, face: 1, silent: true, label: 'under the silent posture' },
    { name: 'breakroom_w', places: [INSIDE, WEST[1], WEST[2], WEST[3]], sam: SAM_W, face: 1, label: 'a man holding INSIDE the room, the nearest' },
  ];
  for (const c of cases) {
    const x = await oneShut(7, c.name, c.places, c.sam, c); const { R, d, man, O } = x;
    if (DOORWAY.oneWay && c.face === -1) { console.log(`- (skipped — ${c.label}: a one-way leaf stands on one face only)`); continue; }
    const i = man ? R.ops.indexOf(man) : -1, least = Math.min(...x.walks);
    verdict(x.why === null && !!man && R.most === 1 && R.everHad.size === 1 && x.walks[i] <= least + 1e-6 && O.log.filter((l: any) => l.order === SHUT_ID).length === 1,
      `${c.label}: ONE man takes it, and his is the shortest walk to the place`, `give: ${x.why} · ${man?.callsign} sent to ${x.post ? at(x.post) : '—'} · walks ${R.ops.map((o: any, k: number) => `${o.callsign} ${f2(x.walks[k])}`).join(', ')} · most under it at once ${R.most}`);
    verdict(x.others, '  the other three keep the very assignments they had, every frame of it', `others untouched: ${x.others} · ${R.ops.filter((o: any) => o !== man).map((o: any) => `${o.callsign} ${O.of(o)?.order}`).join(', ')}`);
    const cap = c.silent ? SILENT.pace : PACE.max; verdict(R.top > 0.3 && R.top <= cap + 0.05, c.silent ? '  he walks at the silent pace' : '  he walks: never above the team\'s pace', `top speed under the order ${f2(R.top)} m/s (cap ${cap})${c.silent ? ` · silent ${squadSilent(x.g)}` : ''}`);
    // (a man who was holding shuts it from the face he stood on: he is not sent through the doorway to shut himself out of his room)
    const m = x.moved, own = x.pos0 ? faceOf(d, x.pos0) : 0; verdict(!!m && !m.inWay && m.reach <= 1.5 + 0.05 && faceOf(d, m.pos) === own,
      '  the leaf first moves with him clear of the floor it crosses, within reach of its handle, on the face of the door he was standing on when told', m ? `leaf moved at +${f2(m.t - x.t0)} s with him at ${at(m.pos)}, ${f2(m.reach)} m from the handle, in its way: ${m.inWay} · face ${faceOf(d, m.pos)} (his own: ${own})` : 'the leaf never moved');
    const word = man ? R.said(man, x.t0) : [];
    const done1 = R.lines.filter(l => man && l.who === man.callsign && l.t >= x.t0 && /door's shut|it's shut/.test(l.text));
    verdict(x.latched && !x.reopened && x.loud <= 0.2 && done1.length === 1 && (!c.silent || done1[0].net), `  it comes to and latches without swinging back, nothing louder than a latch is heard of it, and he says so once${c.silent ? ' — over the net, not aloud' : ''}`, `latched ${x.latched} in ${f2(x.secs)} s · swung back ${x.reopened} · loudest door event ${f2(x.loud)} · he said: ${word.join(' / ')}${c.silent ? ` · over the net: ${done1.map(l => l.net)}` : ''}`);
    const A = x.after; verdict(!!A && A.order === 'hold' && !!A.post && dist(A.post, handle(d)) <= 1.6 && dist(man.char.pos, A.post) < 0.6 && !inWay({ def: d.def, angle: x.a0 }, man.char.pos, 0.3),
      '  then he holds by the door, his body off the floor the leaf came over', `${man?.callsign}: ${A?.order} "${A?.there}" at ${A?.post ? at(A.post) : '—'}, ${A?.post ? f2(dist(A.post, handle(d))) : '—'} m from the handle`);
    if (c.silent) verdict(squadSilent(x.g), '  (the squad was silent throughout)', `silent: ${squadSilent(x.g)}`);
  }
  return done();
});

// ---------------------------------------------------------------- who
export const shutdoorWho = guarded(async () => {
  const { verdict, done } = family(`shutdoor-who: addressed to a pair it is that pair's man; addressed to one man it is him`);
  { const probe = await rig(9); const pairs = probe.ops.map((x: any) => probe.O.pairOf(x)); const far = pairs[3];   // the pair of the man who will stand farthest
    // the men of `far`'s pair stand at the two FAR places, the other pair at the two near ones
    const order = [...probe.ops.keys()].sort((a, b) => Number(pairs[a] === far) - Number(pairs[b] === far)), places: number[][] = []; order.forEach((oi, rank) => { places[oi] = WEST[rank]; });
    const x = await oneShut(9, 'breakroom_w', places, SAM_W, { who: far }); const { R, O, man } = x;
    const nearer = R.ops.filter((o: any) => O.pairOf(o) !== far).map((o: any) => `${o.callsign} ${f2(x.walks[R.ops.indexOf(o)])}`);
    verdict(x.why === null && !!man && O.pairOf(man) === far && Math.min(...x.walks) < x.walks[R.ops.indexOf(man)] - 1 && x.others && x.latched,
      `to the ${far} pair, with both men of the other pair standing nearer: a ${far} man shuts it, and of the two the nearer`, `give: ${x.why} · ${man?.callsign} (${man ? O.pairOf(man) : '—'}) walk ${man ? f2(x.walks[R.ops.indexOf(man)]) : '—'} · the other pair: ${nearer.join(', ')} · others untouched ${x.others} · latched ${x.latched}`);
    const mates = R.ops.filter((o: any) => O.pairOf(o) === far); verdict(!!man && x.walks[R.ops.indexOf(man)] <= Math.min(...mates.map((o: any) => x.walks[R.ops.indexOf(o)])) + 1e-6, '  … the nearer of that pair', mates.map((o: any) => `${o.callsign} ${f2(x.walks[R.ops.indexOf(o)])}`).join(', ')); }
  { const x = await oneShut(9, 'breakroom_w', WEST, SAM_W, { who: 3 }); const { R, man } = x;
    verdict(x.why === null && man === R.ops[3] && x.others && x.latched, 'to one man — the farthest of the four: he shuts it', `give: ${x.why} · ${man?.callsign} (asked: ${R.ops[3].callsign}) · walks ${x.walks.map(f2).join(', ')} · others untouched ${x.others} · latched ${x.latched} in ${f2(x.secs)} s`); }
  return done();
});

// ---------------------------------------------------------------- back to the file
export const shutdoorFile = guarded(async () => {
  const { verdict, done } = family(`shutdoor-file: a man taken from fall in goes back into the file, and shuts it from Sam's side`);
  { const x = await oneShut(11, 'breakroom_w', WEST, SAM_W, { fallIn: true }); const { R, O, man } = x;
    const was = man ? x.before[R.ops.indexOf(man)] : null; R.step(60 * 2);
    verdict(x.why === null && !!man && was?.order === 'fallIn' && was.post === null && x.latched && x.after?.order === 'fallIn' && x.after.post === null && SHUTDOOR_STATS.toFile === 1 && SHUTDOOR_STATS.stayed === 0,
      'the four on fall in, the order given: the man who shut it is on fall in again', `${man?.callsign}: ${was?.order} → ${SHUT_ID} → ${x.after?.order} · latched ${x.latched} in ${f2(x.secs)} s · toFile ${SHUTDOOR_STATS.toFile} · stayed ${SHUTDOOR_STATS.stayed}`);
    const near = R.until(() => !!man && dist(man.char.pos, x.g.player.char.pos) < 4.5, 20);
    verdict(near && x.others, '  and he walks back to Sam; the other three never left the file', `${man?.callsign} ${man ? f2(dist(man.char.pos, x.g.player.char.pos)) : '—'} m from Sam · others untouched ${x.others}`); }
  // a man of the file who is on the far face of the door from Sam (he trailed in, or went through first): he comes back through and shuts it from Sam's side —
  // shutting it from where he stands would put the door between him and the man he follows
  { const x = await oneShut(11, 'breakroom_w', WEST, SAM_W, { fallIn: true, who: 0, pre: R => { const a = R.ops[0]; a.char.pos[0] = INSIDE[0]; a.char.pos[2] = INSIDE[2]; a.char.vel[0] = a.char.vel[2] = 0; } }); const { R, d, man } = x;
    const m = x.moved, his = x.pos0 ? faceOf(d, x.pos0) : 0, sams = faceOf(d, x.sam0);
    verdict(x.why === null && man === R.ops[0] && his === -sams && !!m && faceOf(d, m.pos) === sams && !m.inWay && x.latched && x.after?.order === 'fallIn',
      'a man of the file standing on the far face of the door from Sam, told to shut it: he comes through and shuts it from Sam\'s side, then falls in', `${man?.callsign} was on face ${his}, Sam on ${sams} · the leaf moved with him on face ${m ? faceOf(d, m.pos) : '—'} at ${m ? at(m.pos) : '—'} · latched ${x.latched} in ${f2(x.secs)} s · then ${x.after?.order} · ${logText()} · he said: ${man ? R.said(man, x.t0).join(' / ') : ''}`); }
  // told a second time on his way (the same door): he still goes back into the file afterwards
  { const x = await oneShut(11, 'breakroom_w', WEST, SAM_W, { fallIn: true, again: 0.7 }); const { man } = x;
    verdict(x.why === null && x.again === null && x.latched && x.after?.order === 'fallIn' && x.after.post === null && SHUTDOOR_STATS.given === 2 && SHUTDOOR_STATS.toFile === 1,
      'a man of the file told a second time on his way: he shuts it and still goes back into the file', `${man?.callsign}: second give ${x.again} · latched ${x.latched} · then ${x.after?.order} · given ${SHUTDOOR_STATS.given} · toFile ${SHUTDOOR_STATS.toFile}`); }
  return done();
});

// ---------------------------------------------------------------- a keyed door
export const shutdoorLock = guarded(async () => {
  const { verdict, done } = family(`shutdoor-lock: a keyed door shut on order locks again as it latches`);
  const name = 'storage', places = [[31.0, 0, 11.2], [29.0, 0, 11.2], [27.0, 0, 11.2], [25.0, 0, 11.2]];
  const x = await oneShut(13, name, places, [30.0, 0, 11.6]); const { d, g, man } = x;
  const out = pt(d, d.def.width / 2, d.keySide * 1.0);
  verdict(!!d.def.locked && x.why === null && x.latched && d.locked && !d.lockBroken && g.doors.lockedOut(d, out) && !g.doors.lockedOut(d, out, new Set([d.lockId])),
    'the storage door (keyed), stood open and shut on order: latched with its lock home (the door\'s own rule: nothing here writes the lock) — a wall to a man without its key, a door to one with it', `authored locked ${!!d.def.locked} · give: ${x.why} · ${man?.callsign} · latched ${x.latched} · locked ${d.locked} · keyless from the key side: ${g.doors.lockedOut(d, out) ? 'locked out' : 'OPEN'}`);
  return done();
});

// ---------------------------------------------------------------- never, unless told
export const shutdoorNever = guarded(async () => {
  const { verdict, done } = family(`shutdoor-never: five minutes of a played room clear with the order never given — nobody shuts a door`);
  /** the commander: each room in turn — stack on its door, open and clear, fall in, walk on — for five minutes of game time. `told`: one shut order on the way */
  const play = async (told: boolean) => {
    // (doors that stay open, whatever the harness stood up with: with the old closers every leaf comes to by itself and the lines below would say nothing)
    const R = await rig(21, { fight: true }); const { O, game: g, RC } = R; DOORSTAY.on = true; const ids = new Set(R.ops.map((x: any) => x.char.id));
    let assigned = 0, shutBy = 0, opened = 0, restsTo = 0; const wasOpen = new Map<any, boolean>(g.doors.list.map((d: any) => [d, !d.latched])); const wasTo = new Set<any>();   // (restsTo: leaves a body brought to the frame that rest there unlatched — Door.swept: nobody shut them, and the count is what the walk round an open leaf has left to mend)
    R.post = () => { for (const x of R.ops) if (O.of(x)?.order === SHUT_ID) assigned++;
      for (const d of g.doors.list) { const open = !d.latched; if (wasOpen.get(d) && !open && ids.has(d.lastWho)) shutBy++; if (!wasOpen.get(d) && open && ids.has(d.lastWho)) opened++; wasOpen.set(d, open);
        const to = open && !d.off && !!d.swept && Math.abs(d.angle) < 0.012 && Math.abs(d.vel) < 1e-6; if (to && !wasTo.has(d)) restsTo++; if (to) wasTo.add(d); else wasTo.delete(d); } };
    const t0 = g.time, left = () => 300 - (g.time - t0); let given: string | null | undefined, rooms = 0;
    // (told: the first open door of the floor that takes the order, before the walk — and failing that the first door of the walk that does: a body across a
    // threshold refuses one, as it should)
    if (told) for (const d of g.doors.list) { if (d.latched || d.off || Math.abs(d.angle) < 0.6) continue; given = O.give(SHUT_ID, O.targetAt(d.frameCentre)); if (given === null) { R.until(() => d.latched, 30); break; } }
    for (const room of RC.rooms) { if (left() <= 0) break; const sd = room.def.doors?.[0]; const d = sd ? R.door(typeof sd === 'string' ? sd : (sd.door ?? sd.name ?? sd.id)) : null; if (!d) continue; rooms++;
      const side = faceOf(d, g.player.char.pos), stand = pt(d, d.def.width / 2 + 1.6, side * 2.2);
      if (!g.col.nav.isBlocked(stand[0], stand[2])) g.teleportPlayer(stand);
      O.give('fallIn', { kind: 'none' }, 'all'); R.until(() => left() <= 0, 6);
      O.give('stack', O.targetAt(d.frameCentre)); R.until(() => left() <= 0, 8);
      O.give('openClear', O.targetAt(d.frameCentre)); R.until(() => left() <= 0, 25);
      if (told && given !== null && !d.latched && !d.off) { O.give('hold', { kind: 'none' }, 'all'); R.step(30); prop(d, Math.max(0.8, Math.abs(d.angle))); given = O.give(SHUT_ID, O.targetAt(d.frameCentre)); R.until(() => d.latched || left() <= 0, 25); }
      O.give('fallIn', { kind: 'none' }, 'all'); R.until(() => left() <= 0, 8); }
    R.until(() => left() <= 0, 300);
    return { R, assigned, shutBy, opened, restsTo, given, rooms, secs: g.time - t0, up: R.ops.filter((x: any) => x.state !== 'dead').length, orders: O.log.length, stats: { ...SHUTDOOR_STATS }, log: SHUTDOOR_LOG.length };
  };
  const a = await play(false);
  verdict(a.secs >= 299 && a.rooms >= 3 && a.assigned === 0 && a.stats.given === 0 && a.stats.shut === 0 && a.log === 0 && !a.R.O.log.some((l: any) => l.order === SHUT_ID),
    'never ordered: over five minutes no man is ever under the order, its counters and its log are empty', `${f2(a.secs)} s · ${a.rooms} rooms worked · ${a.up}/4 teammates up · frames a man was under it: ${a.assigned} · given ${a.stats.given} · shut ${a.stats.shut} · log rows ${a.log}`);
  verdict(a.shutBy === 0 && a.opened > 0, '  with doors that stay open: teammates open doors in those five minutes, and no leaf a teammate last touched comes to its latch', `leaves a teammate opened: ${a.opened} · open → latched with a teammate's hand last on it: ${a.shutBy} · (not judged) brought to its frame by a man's body and resting there unlatched: ${a.restsTo}`);
  const b = await play(true);
  verdict(b.given === null && b.assigned > 0 && b.stats.given === 1 && b.log > 0 && b.shutBy >= 1, '  (the same five minutes with the order given once: the counters move, and a leaf a teammate touched last does latch — the lines above can go red)', `give: ${b.given} · frames under it ${b.assigned} · open → latched by a teammate ${b.shutBy} · given ${b.stats.given} · shut ${b.stats.shut} · gave up ${b.stats.gaveUp} · log rows ${b.log}`);
  return done();
});
