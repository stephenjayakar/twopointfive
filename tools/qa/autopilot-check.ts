// B IS THE SQUAD'S AUTOPILOT (src/game/autopilot.ts, AUTOPILOT.on): the quick key through the game's own input, headless.
//   bun run tools/qa/autopilot-check.ts            (also `probes.ts autopilot`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/autopilot-check.ts      — the same lines on the page's stand
// PASS / FAIL each: the room clear on the office with its squad of four, everybody under god mode (the lines are about what is ORDERED, not who wins).
// Every B is a one-frame press of the quick key with the harness cursor on the thing; what is read back is the order book, the door tools' ops and the
// plan the overlay is handed (`floorPlan(g)`).
// AUTOPILOT_BREAK=1 = the switch left off and the same lines asked: they must fail (line 8, the switch off, is the one that still holds). The rules of
// the entry (line 2) are read off the HUD's B line as well as off the pick, so they fail with it too.
//   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const AP: any = await import(`${ROOT}/src/game/autopilot.ts`);
const FP: any = await import(`${ROOT}/src/game/floorplan.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const SIL: any = await import(`${ROOT}/src/game/silent.ts`);
const { AUTOPILOT, AUTOPILOT_STATS, autoPick, autoEntries } = AP;
const { PLAN, floorPlan } = FP;

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const BREAK = process.env.AUTOPILOT_BREAK === '1', VERBOSE = process.argv.includes('--verbose');

async function rig(seed: number, squad = 4) {
  const squad0 = NIGHTBREACH.squad; let W: any, why: any;
  try {
    Object.assign(NIGHTBREACH, { squad });
    Math.random = seeded(seed);
    W = await standUp();
    AUTOPILOT.on = !BREAK; PLAN.on = true; PLAN.menuOnly = true;
    W.game.godMode = true;
    why = W.game.roomClear.start(seed);
  } finally { Object.assign(NIGHTBREACH, { squad: squad0 }); }
  const game = W.game, O = game.orders, input = W.input;
  const R = { W, game, O, why,
    get team(): any[] { return O.squad(); },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; W.step(DT); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    /** B, one frame, with the cursor on p — and what the cursor was on, as the game's own input reads it */
    quick(p: number[]) { W.cursorAt([p[0], p[1], p[2]]); R.step(2); const on = O.hover?.() ?? null; input.pressed.add(ORDERS.quickKey); R.step(); return on; },
    /** the HUD's B line with the cursor on p */
    hudB(p: number[]): string { W.cursorAt([p[0], p[1], p[2]]); R.step(2); return (O.hud().status?.[0]?.opts ?? []).find((o: any) => o.key === 'B')?.text ?? ''; },
    tail() { return O.log[O.log.length - 1]; },
    listed() { return (floorPlan(game).men as any[]).length; },
    stacked() { return R.team.filter((m: any) => m.state !== 'dead').every((m: any) => O.of(m)?.order === 'stack' && O.of(m)?.arrived); },
    /** everybody back on Sam, nothing of the door tools running */
    home() { O.give('fallIn', O.targetAt(game.player.char.pos), 'all'); R.until(() => game.doorTools.ops.length === 0, 40); R.step(60); },
  };
  R.step(30);
  for (const m of R.team) m.god = true;
  return R;
}
/** the doors by how near Sam they are, each with the target the orders make of it */
function doorsNear(R: any): { d: any; t: any }[] {
  const s = R.game.player.char.pos, out: { d: any; t: any }[] = [];
  for (const d of [...R.game.doors.list].sort((a: any, b: any) => dist(a.frameCentre, s) - dist(b.frameCentre, s))) { const t = R.O.targetAt(d.frameCentre); if (t.kind === 'door' && t.door === d) out.push({ d, t }); }
  return out;
}
/** a point of that door's doorway the cursor on which IS that door, as the game's own input reads it (null: none — a door off the screen, behind a wall
 *  as drawn, or with a teammate's body under every such point) */
function aimOf(R: any, d: any): number[] | null {
  const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th);
  for (const y of [c[1], 0.05, 1.0, 1.8]) for (const k of [0, 0.35, -0.35]) { const p = [c[0] + nx * k, y, c[2] + nz * k]; R.W.cursorAt(p); R.step(2); const h = R.O.hover?.(); if (h?.kind === 'door' && h.door === d) return p; }
  return null;
}
const pointsAt = (R: any, d: any) => !!aimOf(R, d);
/** B on that door through the game's own input where the cursor can be put on it; else the input's own line asked of the target (orders.ts input()) */
function quickDoor(R: any, d: any): 'key' | 'call' {
  // (the press goes in the frame after the cursor was seen to be on the door: a man walking through the doorway a moment later is not what was pressed on)
  if (aimOf(R, d)) { R.W.input.pressed.add(ORDERS.quickKey); R.step(); return 'key'; }
  const O = R.O, t = O.targetAt(d.frameCentre); if (!(AUTOPILOT.on && AP.autoQuick(R.game, t))) { const def = O.defaultFor(t); if (def) O.give(def.id, t); } R.step();
  return 'call';
}
const farRoom = (g: any, t: any) => g.cleared.roomBy(t.door, t.side > 0 ? -1 : 1);

let fails = 0;
const line = (ok: boolean, name: string, detail: string) => { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); };

export async function autopilotCheck(): Promise<boolean> {
  fails = 0;
  const keep = { on: AUTOPILOT.on, show: AUTOPILOT.showSecs, kb: AUTOPILOT.keepBangs, plan: PLAN.on, menuOnly: PLAN.menuOnly, rnd: Math.random, sil: SIL.SILENT.on };
  console.log(`autopilot-check: B is the squad's autopilot${BREAK ? '  (AUTOPILOT_BREAK: the switch is left off — the lines must fail)' : ''}`);
  try {
    const R = await rig(5), g = R.game, O = R.O, T = g.doorTools;
    if (R.why) { line(false, 'the room clear stands up', String(R.why)); return false; }
    const all = () => O.men('all'), stackDef = O.defs.find((d: any) => d.id === 'stack');

    // the door: the nearest one whose far room nobody has stood in, that the four can stack on and that the cursor on its doorway is on
    let pick: { d: any; t: any } | null = null, w: string | null = 'no door';
    for (const x of doorsNear(R)) { const far = farRoom(g, x.t); if (!far || g.cleared.isKnown(far)) continue; w = O.whyNot(stackDef, O.forMen(x.t, all()), all()); if (!w && !pointsAt(R, x.d)) w = 'the cursor on it is not on it'; if (!w) { pick = x; break; } }
    if (!pick) { line(false, 'a door to stack on with an unknown room behind it', `none: ${w}`); return false; }
    const D = pick.d, at = D.frameCentre;

    // 1. B on a door nobody is on: stack up, as ever — and its plan is drawn, for showSecs, then gone
    const on1 = R.quick(aimOf(R, D) ?? at), row1 = R.tail(), n0 = R.listed();
    R.step(Math.round((PLAN.freshSecs + 0.5) * 60)); const nMid = R.listed();
    R.step(Math.round((AUTOPILOT.showSecs - PLAN.freshSecs) * 60)); const nEnd = R.listed();
    line(on1?.kind === 'door' && on1.door === D && row1?.order === 'stack' && row1.auto === true && n0 === 4 && nMid === 4 && nEnd === 0,
      'B on a door nobody is on: stack up, the plan drawn for its own time, then gone', `cursor on ${on1?.kind ?? 'nothing'} · order ${row1?.order} · stamped ${!!row1?.auto} · listed ${n0} at once, ${nMid} at ${f1(PLAN.freshSecs + 0.5)} s, ${nEnd} at ${f1(AUTOPILOT.showSecs + 0.5)} s`);
    const set = R.until(() => R.stacked(), 40);

    // 2. what they would choose, stacked on it — read off the HUD's B line (the first choice) and off the press's own pick (each row's `valid` asked)
    {
      const say = () => `${R.hudB(aimOf(R, D) ?? at).replace(/ · .*/, '')} / ${autoPick(g, O.targetAt(at)).id}`;
      const b = T.bangs, three = say();
      T.bangs = 1; const one = say();
      // (a staged sight: one living defender is stood a stride and a half past the frame line, in the room beyond, and the team's fog is told it has him)
      const tm = { ...pick.t, side: O.of(R.team[0])?.post ? (await import(`${ROOT}/src/game/orders.ts`)).sideOf(D, O.of(R.team[0]).post) : pick.t.side }, far = farRoom(g, tm);
      const foe = g.guards.find((o: any) => o.state !== 'dead' && o.team !== 'operative' && o.team !== 'civilian' && o.team !== 'player');
      let seen = '', dry = '', inRoom = false, fog = false;
      if (foe) {
        const F = g.fogOfWar, seen0 = F.seen, was = [...foe.char.pos], on0 = F.on;
        const c = D.frameCentre, th = D.def.closedDir, k = -tm.side * 1.5;
        foe.char.pos[0] = c[0] - Math.sin(th) * k; foe.char.pos[2] = c[2] + Math.cos(th) * k;
        inRoom = g.cleared.roomAt(foe.char.pos) === far; F.on = true; F.seen = (o: any) => o === foe || seen0.call(F, o); fog = F.active;
        const e1 = autoEntries(g, tm), h1 = R.hudB(aimOf(R, D) ?? at).replace(/ · .*/, ''); seen = `${h1} / ${e1.ids[0]} (${e1.why})`;
        T.bangs = 0; dry = `${R.hudB(aimOf(R, D) ?? at).replace(/ · .*/, '')} / ${autoEntries(g, tm).ids[0]}`;
        F.seen = seen0; F.on = on0; foe.char.pos[0] = was[0]; foe.char.pos[1] = was[1]; foe.char.pos[2] = was[2];
      }
      T.bangs = b; SIL.SILENT.on = true; SIL.setSilent(g, true); R.step(2);
      const silent = SIL.squadSilent(g), quiet = say();
      SIL.setSilent(g, false); R.step(2); SIL.SILENT.on = keep.sil;
      const bang = (x: string) => /^bang and clear \/ bangClear/.test(x), open = (x: string) => /^(open|kick|pick) and clear \/ openClear/.test(x);
      line(set && bang(three) && open(one) && !!foe && inRoom && fog && bang(seen) && /contact/.test(seen) && open(dry) && silent && open(quiet),
        'the entry they choose: a stun for an unknown room, the last one kept for a room with an enemy in sight, a silent squad stays silent',
        `stacked ${set} · HUD / pick — 3 stuns: ${three} · 1 stun: ${one} · 1 stun, an enemy in sight beyond (staged${inRoom ? '' : ', NOT in the room'}, fog ${fog ? 'on' : 'OFF'}): ${seen || 'no defender'} · none: ${dry} · silent, 3 stuns: ${quiet}`);
    }

    // 3. B on the door they are stacked on: they go in — a stun for a room nobody has stood in
    const want = autoPick(g, O.targetAt(at)), bangs0 = T.bangs, len0 = O.log.length;
    quickDoor(R, D); R.step(2);
    const row2 = R.tail(), op2 = T.ops.find((o: any) => o.door === D), n2 = R.listed();
    line(want.id === 'bangClear' && want.why === 'unknown' && O.log.length === len0 + 1 && row2.order === 'bangClear' && row2.auto === true && row2.who.length === 4 && op2?.kind === 'bangClear' && n2 === 4,
      'B on the door they are stacked on: they go in, with a stun for a room nobody has stood in', `pick ${want.id} (${want.why}) · order ${row2?.order} to ${row2?.who.length} · op ${op2?.kind ?? 'none'} · ${bangs0} stuns · listed ${n2}`);
    R.until(() => T.ops.length === 0, 60); R.step(30);
    const known = g.cleared.isKnown(farRoom(g, pick.t)), spent = T.stats.bangs;

    // 4. a second tap while they still walk is 'stack up' again; the same door, its room now the team's: no stun — and only the men ON the door go
    {
      R.home();
      for (let i = 0; i < 4 && R.tail()?.order !== 'stack'; i++) { quickDoor(R, D); R.step(10); }
      const walking = R.team.filter((m: any) => !O.of(m)?.arrived).length, lenA = O.log.length; quickDoor(R, D); R.step(2);
      const tap = R.tail(), tapOps = T.ops.length, tapNew = O.log.length - lenA;
      const s3 = R.until(() => R.stacked(), 40);
      if (VERBOSE) console.log('   4:', JSON.stringify(O.log.slice(-6).map((r: any) => `${r.t.toFixed(1)} ${r.order} ${r.who.length} ${r.target}`)), 'msgs', JSON.stringify((g.messages ?? g.log ?? []).slice?.(-8) ?? null), R.team.map((m: any) => `${m.callsign}:${O.of(m)?.order}:${O.of(m)?.arrived}`).join(' '));
      const left = R.team[3]; O.give('hold', O.targetAt(left.char.pos), O.squad().indexOf(left)); R.step(5);
      const want3 = autoPick(g, O.targetAt(at)); quickDoor(R, D); R.step(2);
      const row3 = R.tail(), leftOrder = O.of(left)?.order;
      line(walking > 0 && tapNew === 1 && tap.order === 'stack' && tapOps === 0 && known && s3 && want3.id === 'openClear' && want3.why === 'known' && row3.order === 'openClear' && row3.auto === true && row3.who.length === 3 && !row3.who.includes(left.callsign) && leftOrder === 'hold',
        'a tap while they walk stacks again; a room the team has stood in gets no stun; a man told to hold is left out', `second tap with ${walking} walking: ${tap.order}, ${tapOps} op · the room known ${known} (${spent} stun on the first entry) · pick ${want3.id} (${want3.why}) · order ${row3?.order} to ${row3?.who.join(', ')} · ${left.callsign}: ${leftOrder}`);
      R.until(() => T.ops.length === 0, 60); R.home();
    }

    // 5. a tool given on the word to one pair: B on that door is the word, for the men on it
    {
      let door: any = null, why: string | null = 'no door';
      for (const x of doorsNear(R)) { if (!pointsAt(R, x.d)) continue; why = O.give('openClear', x.t, 'red', { onWord: true }); if (!why) { door = x.d; break; } }
      R.step(30);
      const waits = () => T.ops.find((o: any) => o.door === door && !o.word);
      const before = !!waits(), wants = door ? autoPick(g, O.targetAt(door.frameCentre)) : null, len = O.log.length;
      if (door) quickDoor(R, door); R.step(2);
      const went = !waits(), row = R.tail(), red = O.men('red').map((m: any) => m.callsign).sort().join();
      line(!!door && before && wants?.word === true && went && O.log.length === len + 1 && row.order === 'go' && row.auto === true && [...row.who].sort().join() === red,
        'a door with a tool waiting on the word: B is the word, to the men on it', door ? `waiting ${before} · pick ${wants?.word ? 'the word' : wants?.id} · after B: ${went ? 'went' : 'STILL waiting'} · order ${row?.order} to ${row?.who.join(', ')}` : `refused everywhere: ${why}`);
      R.until(() => T.ops.length === 0, 60); R.home();
    }

    // 6. a charge set on a door: B on it blows it
    {
      let door: any = null, why: string | null = 'no door';
      for (const x of doorsNear(R)) { why = O.give('charge', x.t, 'blue'); if (!why) { door = x.d; break; } }
      const isSet = R.until(() => T.set.length > 0, 40); R.step(5);
      const wants = door ? autoPick(g, O.targetAt(door.frameCentre)) : null;
      const how = door ? quickDoor(R, door) : 'call', blown = R.until(() => T.set.length === 0, 6);
      line(!!door && isSet && (wants?.word === true || wants?.id === 'charge') && blown, 'a charge set on a door: B on it blows it', door ? `set ${isSet} · pick ${wants?.word ? 'the word' : `${wants?.id} (${wants?.why})`} · B (${how}): ${T.set.length} set after` : `refused everywhere: ${why}`);
      R.step(120); R.until(() => T.ops.length === 0, 30); R.home();
    }

    // 7. the squad's own change of plan is drawn for a moment (SquadOrders.show — doortools.ts haltAt calls it); a plain re-assign is not
    {
      const sp = g.player.char.pos; O.give('hold', O.targetAt(sp), 'all'); R.step(Math.round((AUTOPILOT.showSecs + 1) * 60));
      const m0 = R.team[0], A0 = O.of(m0), quiet = R.listed();
      const again = () => O.assign(m0, { order: A0.order, post: A0.post ?? [sp[0] + 1, 0, sp[2]], face: A0.face, going: A0.going, there: A0.there });
      again(); R.step(2); const re = R.listed();
      again(); O.show([m0]); R.step(2); const shown = R.listed();   // (the module that re-plans says so the frame it does: doortools.ts haltAt)
      R.step(Math.round((AUTOPILOT.showSecs + 0.5) * 60)); const gone = R.listed();
      line(quiet === 0 && re === 0 && shown === 1 && gone === 0, 'their own change of plan is drawn for a moment and goes; a silent re-assign is not drawn', `before ${quiet} · re-assigned ${re} · told ${shown} · ${f1(AUTOPILOT.showSecs + 0.5)} s on ${gone}`);
    }

    // 8. the switch off: B on a stacked door is 'stack up' again, nothing is stamped, nothing goes in
    {
      R.home(); AUTOPILOT.on = false;
      for (let i = 0; i < 4 && R.tail()?.order !== 'stack'; i++) { quickDoor(R, D); R.step(60); }   // (a man still walking back across the doorway is in its way: asked again)
      R.until(() => R.stacked(), 40);
      const a = R.tail(), hud = R.hudB(aimOf(R, D) ?? at); quickDoor(R, D); R.step(2); const b = R.tail();
      const ops = T.ops.length; O.show(R.team); R.step(Math.round((PLAN.freshSecs + 0.3) * 60)); const drawn = R.listed();
      AUTOPILOT.on = !BREAK;
      line(a.order === 'stack' && !a.auto && b !== a && b.order === 'stack' && !b.auto && ops === 0 && drawn === 0 && /^stack up/.test(hud), 'the switch off: B on a stacked door is the first row again', `B: ${a.order} · the HUD's B line: '${hud}' · B again: ${b.order} · stamped ${!!b.auto} · ${ops} op · a told change of plan draws ${drawn}`);
    }

    // 9. the pair: B, then B, goes in; its own set charge is blown by B (it has no 'go' order: the row's)
    {
      const P = await rig(7, 2), pg = P.game, PO = P.O, PT = pg.doorTools, pall = () => PO.men('all');
      let pd: { d: any; t: any } | null = null, pw: string | null = 'no door';
      for (const x of doorsNear(P)) { pw = PO.whyNot(stackDefOf(PO), PO.forMen(x.t, pall()), pall()); if (!pw && !pointsAt(P, x.d)) pw = 'the cursor on it is not on it'; if (!pw) { pd = x; break; } }
      if (!pd) line(false, 'the pair: a door to stack on', `none: ${pw}`);
      else {
        const pat = pd.d.frameCentre; quickDoor(P, pd.d); const ps = P.until(() => P.stacked(), 40);
        const pick2 = autoPick(pg, PO.targetAt(pat)), how2 = quickDoor(P, pd.d); P.step(2); const prow = P.tail(), pop = PT.ops.find((o: any) => o.door === pd!.d);
        P.until(() => PT.ops.length === 0, 60); P.home();
        let cd: any = null, cw: string | null = 'no door';
        for (const x of doorsNear(P)) { cw = PO.give('charge', x.t, 'all'); if (!cw) { cd = x.d; break; } }
        const cset = P.until(() => PT.set.length > 0, 40); P.step(5);
        const hud = cd ? (AUTOPILOT.on ? AP.autoHint(pg, PO.targetAt(cd.frameCentre)) ?? '' : 'stack up') : '', how3 = cd ? quickDoor(P, cd) : 'call', blown = P.until(() => PT.set.length === 0, 6);
        line(P.team.length === 2 && ps && (pick2.id === 'bangClear' || pick2.id === 'openClear') && prow.order === pick2.id && prow.auto === true && !!pop && !!cd && cset && blown && /blow|go/.test(hud),
          'the pair: B then B goes in; its set charge is blown by B', `${P.team.length} men · stacked ${ps} · pick ${pick2.id} (${pick2.why}) · B (${how2}): order ${prow?.order} · op ${pop?.kind ?? 'none'} · charge ${cd ? `set ${cset}, B would '${hud}', B (${how3}): ${PT.set.length} set after` : `refused: ${cw}`}`);
      }
    }
    if (VERBOSE) console.log('  stats', JSON.stringify(AUTOPILOT_STATS));
  } catch (e) { line(false, 'the lines threw', e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 4).join(' · ') : String(e)); }
  finally { AUTOPILOT.on = keep.on; AUTOPILOT.showSecs = keep.show; AUTOPILOT.keepBangs = keep.kb; PLAN.on = keep.plan; PLAN.menuOnly = keep.menuOnly; Math.random = keep.rnd; SIL.SILENT.on = keep.sil; }
  console.log(fails ? `autopilot-check: ${fails} FAIL` : 'autopilot-check: ALL PASS');
  return fails === 0;
}
const stackDefOf = (O: any) => O.defs.find((d: any) => d.id === 'stack');

if (import.meta.main) { const ok = await autopilotCheck(); process.exit(ok ? 0 : 1); }
