// THE GRAB'S THREE VOICES — the check behind the sounds of HOLD.disarm (src/game/disarm.ts, player.ts startGrab; the voices are audio/sfx.ts grabCatch, gunStrip
// and gunDown). On in the page, ?disarm=0; off in the module and on the frozen stand, TPS_DISARM=1 with TPS_HOLDDROP=1.
//   bun run tools/qa/probes.ts grabvoice        (family `grab`)        GRABVOICE_BREAK=1 = the move off and the same lines asked: must FAIL
// the maintainer, 10-23: "we should also make the grab super satisfying. cool animation where sam disarms him and satisfying sounds".
// It asks WHAT IS PLAYED, WHEN, WHERE AND HOW LOUD (the headless audio is a list of calls: nobody here can listen — the voices themselves are measured by
// audio-render.ts and sound-takes-check.ts), and WHAT THE ROOM HEARS: the move adds nothing to the grab's one noise, which a second man hears to just under 4 m.
// The check raises HOLD.dropGun and HOLD.disarm itself, so it asks the same thing on both stands.
// THE STAGING is the hold probes' own (holddrop-check.ts): the office, one man placed with a gun in his hand, Sam behind him, startGrab as the game calls it.
import { standUp, ROOT } from './headless.ts';
import { place, park } from './standoff-probes.ts';
type Vec3 = [number, number, number];
const DT = 1 / 60, SEED = 4471, OTHER = 97;
export async function grabVoiceCheck(): Promise<boolean> {
  const BRK = process.env.GRABVOICE_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== grabvoice: the grab's three voices${BRK ? ' (the move off: must fail)' : ''} ===`);
  const { HOLD } = await import(`${ROOT}/src/game/character.ts`); const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
  const { DISARM_GAIN } = await import(`${ROOT}/src/game/disarm.ts`); const { inHand } = await import(`${ROOT}/src/game/guards.ts`);
  const { SOUNDS } = await import(`${ROOT}/src/sounds/catalog.ts`);
  const was = { drop: HOLD.dropGun, disarm: HOLD.disarm, first: HOLD.stripFirst }, log = console.log, AT: Vec3 = [14, 0, 11.2], YAW = Math.PI / 2, LOBBY: Vec3 = [10.2, 0, 19.5];
  const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) <= e;
  const guns = (g: any) => g.items.items.filter((it: any) => it.kind === 'rifle' || it.kind === 'pistol');
  /** one man with a gun in his hand taken from behind on a fresh stand, two seconds of it recorded: every audio call and every noise event from the grab on.
   *  `ear`: a second man stood that many metres ahead of him on the lobby's open floor, back turned, to hear it or not · `cancelAfter`: let go that many frames in ·
   *  `seed`: the game's own die (every take has one, so a red here can be run again) · `drop: false`: HOLD.dropGun left off under the move's key · `wall`: taken in
   *  the office, a wall 0.35 m off Sam's right hand (in the way of the thrown gun); every other take is on the lobby's open floor ·
   *  `first`: with the disarm leading (HOLD.stripFirst, as the page has it); every other take has it down · `key`: taken by the row's key inside a step,
   *  as the page takes him (the catch is heard on that frame, and the move's clock already reads one step at its end: called from out here the grab is a
   *  step ahead of its own voices, so every beat the page's rows are held to is counted on a take by the key) */
  const take = async (who: 'rifle' | 'pistol', rule: boolean, o: { gunHold?: boolean; ear?: number; seed?: number; cancelAfter?: number; drop?: boolean; wall?: boolean; first?: boolean; key?: boolean } = {}) => {
    console.log = () => { };
    try {
      const W: any = await standUp({ seed: o.seed ?? SEED }); HOLD.dropGun = o.drop !== false; HOLD.disarm = rule; HOLD.stripFirst = !!o.first; const g = W.game; g.godMode = true; g.player.visibility = 0.02; g.tune.carbineGuards = who === 'rifle' ? 'reyes' : 'none';
      for (let i = 0; i < 5; i++) W.step(DT);
      const A = g.guards.find((x: any) => x.callsign === 'Reyes'), B = o.ear ? g.guards.find((x: any) => x !== A) : null, at = o.wall ? AT : LOBBY;
      g.guards.forEach((x: any, i: number) => { if (x !== A && x !== B) park(x, i); });
      place(A, at, YAW); A.wp = 1; if (B) { place(B, [at[0] + o.ear!, 0, at[2]], YAW); B.hold = true; B.pinned = true; }
      g.teleportPlayer([at[0] - Math.sin(YAW) * 0.8, 0, at[2] - Math.cos(YAW) * 0.8]); g.player.crouch = true; g.player.slot = 'pistol'; g.player.holstered = !o.gunHold; W.step(DT); g.player.visibility = 0.02;
      if (who === 'pistol') { A.state = 'suspicious'; A.awareness = 0.5; }   // (a man with a reason to have it out: the sidearm, not the torch, is in his hand)
      if (B) { B.state = 'patrol'; B.awareness = 0; }
      const had = inHand(A); W.audioLog = []; let t0 = g.time, peak = 0; const noise: any[] = [];
      if (o.key) { g.selectVerb('guard', 'grab'); W.input.pressed.add('Space'); W.step(DT); t0 = g.time; } else startGrab(g, A);
      for (let i = 0; i < 120; i++) { for (const e of g.events) if (e.time >= t0 - 1e-9 && !noise.includes(e)) noise.push(e); g.player.visibility = 0.02; if (i === o.cancelAfter) g.freeHeld('cancel'); W.step(DT); if (B) peak = Math.max(peak, B.awareness); }
      const calls = (W.audioLog as any[]).map(c => ({ name: c.name, at: c.t - t0, gain: c.gain, rate: (c.opts?.rate as number) ?? 1, pos: c.pos as Vec3 | null }));
      return { W, g, A, B, had, calls, noise, peak, gun: guns(g)[0] ?? null, throat: [at[0], 1.4, at[2]] as Vec3 };
    } finally { console.log = log; }
  };
  const one = (R: { calls: any[] }, name: string) => R.calls.filter(c => c.name === name);
  const said = (R: { calls: any[] }) => R.calls.filter(c => c.name !== 'footstep').map(c => `${c.name} ${c.at.toFixed(2)} s at ${c.gain.toFixed(2)}${c.rate !== 1 ? ` x${c.rate.toFixed(2)}` : ''}`).join(' · ') || 'nothing';
  try {
    const rule = !BRK, K = HOLD.strip, G = DISARM_GAIN;
    // ---- the table: the three rows are voices of the game and have their rows on the listening page
    { const rows = ['grabCatch', 'gunStrip', 'gunDown'], onPage = rows.filter(n => !!(SOUNDS as any)[n]), pageGain = rows.map(n => (SOUNDS as any)[n]?.gain), want = [G.catch, G.strip, G.down];
      const long = ['gunStrip', 'gunDown'].map(n => ((SOUNDS as any)[n]?.also ?? []).some((a: any) => near(a.rate ?? 1, G.long)));
      verdict(onPage.length === 3 && pageGain.every((x, i) => near(x, want[i])) && long.every(Boolean),
        'the three voices have their rows on the listening page, which plays each at the gain the game does and the long gun\'s two at the game\'s lower rate',
        `on the page ${onPage.join(', ') || 'none'} at ${pageGain.join(' / ')} (the game: ${want.join(' / ')}) · a carbine's strip and knock at x${G.long}: ${long.join(' / ')}`); }
    // ---- staging: with the move off the grab is the old scuffle and a magazine's clatter
    const off = await take('pistol', false);
    verdict(off.had === 'weapon' && one(off, 'grabScuffle').length === 1 && one(off, 'grabCatch').length + one(off, 'gunStrip').length + one(off, 'gunDown').length === 0 && one(off, 'magDrop').length >= 1,
      'staging: with the move off the grab says what it always said (the scuffle, the knocked-out gun clattering like a magazine) and none of the three',
      `in his hand ${off.had} · ${said(off)}`);
    // ---- the three beats, a drawn pistol
    const on = await take('pistol', rule);
    { const c = one(on, 'grabCatch'), s = one(on, 'gunStrip'), d = one(on, 'gunDown'), it = on.gun;
      const atThroat = !!c[0]?.pos && Math.hypot(c[0].pos[0] - on.throat[0], c[0].pos[1] - on.throat[1], c[0].pos[2] - on.throat[2]) < 0.05;
      const onFloor = !!d[0]?.pos && !!it && d[0].pos[1] < 0.2 && Math.hypot(d[0].pos[0] - it.pos[0], d[0].pos[2] - it.pos[2]) < 0.35;
      verdict(c.length === 1 && near(c[0].at, 0) && near(c[0].gain, G.catch) && atThroat && one(on, 'grabScuffle').length === 0
        && s.length === 1 && Math.abs(s[0].at - K.take) <= 1.5 * DT && near(s[0].gain, G.strip) && near(s[0].rate, 1)
        && d.length === 1 && d[0].at > K.drop && d[0].at < K.drop + 0.6 && d[0].gain >= 0.5 * G.down - 1e-6 && d[0].gain <= G.down + 1e-6 && near(d[0].rate, 1) && onFloor && one(on, 'magDrop').length === 0,
        'a drawn pistol: the catch on the grab\'s frame at his throat, the strip on the frame the gun leaves his hand, the gun down ONCE where it lands; no scuffle, no magazine\'s clatter',
        `${said(on)} · the take is at ${K.take} s, let go at ${K.drop} s · the catch ${atThroat ? 'at his throat' : 'NOT at his throat'}, the knock ${onFloor ? 'on the floor by the gun' : 'NOT at the gun on the floor'}`); }
    // ---- the listening page's whole grab is the game's: the same beats, so a retimed move cannot leave the page (and the WAVs grab-sounds-render.ts cuts from it) behind
    const onK = await take('pistol', rule, { key: true });   // (taken by the key, as the page takes him: the beats its rows are held to)
    { const whole = (SOUNDS as any).grabCatch?.also?.[0]?.plus ?? [], pg = (n: string) => whole.find((l: any) => l.name === n)?.after as number | undefined, gs = one(onK, 'gunStrip')[0]?.at, gd = one(onK, 'gunDown')[0]?.at, hp = one(onK, 'heldProtest')[0]?.at;
      const ok = [[pg('gunStrip'), gs], [pg('gunDown'), gd], [pg('heldProtest'), hp]].every(([a, b]) => a !== undefined && b !== undefined && Math.abs(a - b) <= 0.01);
      verdict(ok && near((SOUNDS as any).grabCatch?.rate ?? 0, 1), 'taken by the key as the page takes him, the listening page plays the whole grab on the game\'s own beats (strip, his protest, the gun down, each to the frame: within 0.01 s) and the catch at the game\'s pinned rate',
        `the page: strip ${pg('gunStrip')} s, protest ${pg('heldProtest')} s, gun down ${pg('gunDown')} s · the game: ${gs?.toFixed(3) ?? '—'} / ${hp?.toFixed(3) ?? '—'} / ${gd?.toFixed(3) ?? '—'} s`); }
    // ---- one condition for all three: the move's key without HOLD.dropGun under it is the grab as it was
    { const N = await take('pistol', true, { drop: false });
      verdict(one(N, 'grabScuffle').length === 1 && one(N, 'grabCatch').length + one(N, 'gunStrip').length + one(N, 'gunDown').length === 0 && inHand(N.A) === 'weapon',
        'the move\'s key with HOLD.dropGun off: nothing is stripped, and the grab says the scuffle it always said (none of the three)', `${said(N)} · in his hand ${inHand(N.A)}`); }
    // ---- a carbine is the same two buffers played lower; the pistol hold raps it out a little brighter
    { const R = await take('rifle', rule, { key: true }), P = await take('pistol', rule, { gunHold: true }), s = one(R, 'gunStrip'), d = one(R, 'gunDown'), ps = one(P, 'gunStrip'), pd = one(P, 'gunDown');
      const row = (SOUNDS as any).grabCatch?.also?.[1]?.plus ?? [], pg = (n: string) => row.find((l: any) => l.name === n)?.after as number | undefined;
      const page = [[pg('gunStrip'), s[0]?.at], [pg('gunDown'), d[0]?.at]].every(([a, b]) => a !== undefined && b !== undefined && Math.abs(a - b) <= 0.01);
      verdict(s.length === 1 && near(s[0].rate, G.long) && d.length === 1 && near(d[0].rate, G.long) && page && ps.length === 1 && ps[0].rate > 1 && pd.length === 1 && pd[0].at < (one(on, 'gunDown')[0]?.at ?? 0),
        'a carbine: the strip and the knock at the long gun\'s lower rate, on the beats the listening page\'s carbine row plays them (to the frame); Sam\'s own pistol drawn: the gun rapped out (a brighter strip) falls from the man\'s hand and lands sooner',
        `carbine ${said(R)} · the page's carbine row: strip ${pg('gunStrip')} s, gun down ${pg('gunDown')} s · pistol hold ${said(P)}`); }
    // ---- the disarm leading (HOLD.stripFirst, on in the page): the strip, then the catch as the arm lands — and the knock on the SAME beat from the grab's
    //      start as with it down (he lets go sooner, the fall is that much longer); the page's two gun-first rows (under gunStrip, timed from the strip) are the game's
    { const open = one(onK, 'gunDown')[0]?.at ?? -9, lines: string[] = []; let ok = true;
      for (const [who, n] of [['pistol', 1], ['rifle', 2]] as const) {
        const F = await take(who, rule, { first: true, key: true }), s = one(F, 'gunStrip'), c = one(F, 'grabCatch'), d = one(F, 'gunDown'), hp = one(F, 'heldProtest')[0]?.at;
        const row = (SOUNDS as any).gunStrip?.also?.[n], plus = row?.plus ?? [], pg = (m: string) => plus.find((l: any) => l.name === m)?.after as number | undefined, s0 = s[0]?.at ?? -9;
        const page = [[pg('grabCatch'), c[0]?.at], [pg('heldProtest'), hp], [pg('gunDown'), d[0]?.at]].every(([a, b]) => a !== undefined && b !== undefined && Math.abs(a - (b - s0)) <= 0.01) && near(row?.rate ?? 0, who === 'rifle' ? G.long : 1);
        ok &&= s.length === 1 && c.length === 1 && d.length === 1 && s0 < c[0].at && Math.abs(d[0].at - open) <= 0.01 && page;
        lines.push(`${who}: ${said(F)} · the page's row from the strip: catch ${pg('grabCatch')} s, protest ${pg('heldProtest')} s, gun down ${pg('gunDown')} s (the game: ${c[0] ? (c[0].at - s0).toFixed(3) : '—'} / ${hp !== undefined ? (hp - s0).toFixed(3) : '—'} / ${d[0] ? (d[0].at - s0).toFixed(3) : '—'})`);
      }
      verdict(ok, 'with the disarm leading (as the page has it): the strip, then the catch, and the gun on the floor on the same frame from the grab\'s start as with it down, pistol and carbine; the listening page\'s gun-first rows are those beats, to the frame',
        `${lines.join(' · ')} · with it down the gun is down at ${open.toFixed(3)} s`); }
    // ---- by a wall: he throws it short of the wall, so the knock is on the open floor's frame, once, where the gun lies — in either order
    { const lines: string[] = []; let ok = true;
      for (const first of [false, true]) {
        const Wl = await take('pistol', rule, { wall: true, first }), Op = first ? await take('pistol', rule, { first }) : on, d = one(Wl, 'gunDown'), it = Wl.gun, open = one(Op, 'gunDown')[0]?.at ?? -9;
        const onFloor = !!d[0]?.pos && !!it && d[0].pos[1] < 0.2 && Math.hypot(d[0].pos[0] - it.pos[0], d[0].pos[2] - it.pos[2]) < 0.35;
        ok &&= d.length === 1 && onFloor && Math.abs(d[0].at - open) <= 0.01;
        lines.push(`${first ? 'the gun first' : 'the catch first'}: gun down ${d.map(c => `${c.at.toFixed(3)} s at height ${c.pos ? c.pos[1].toFixed(2) : '?'}`).join(', ') || 'never'} · on open floor ${open.toFixed(3)} s · the knock ${onFloor ? 'on the floor by the gun' : 'NOT at the gun on the floor'}`);
      }
      verdict(ok, 'taken beside a wall that stands in the way of the throw: one knock, at the floor where the gun lies (not at the wall), on the open floor\'s frame, with the catch first and with the gun first',
        lines.join(' · ')); }
    // ---- the same beats on other dice
    { const B = await take('pistol', rule, { seed: OTHER }), O = await take('pistol', false, { seed: OTHER }), a = one(on, 'gunDown')[0], b = one(B, 'gunDown')[0];
      const old = off.gun && O.gun ? Math.hypot(off.gun.pos[0] - O.gun.pos[0], off.gun.pos[2] - O.gun.pos[2]) : -1;   // (the staging's own proof that the dice were other dice: the knocked-out gun lies somewhere else)
      const same = !!a && !!b && near(a.at, b.at) && near(a.gain, b.gain, 1e-4) && !!on.gun && !!B.gun && Math.hypot(on.gun.pos[0] - B.gun.pos[0], on.gun.pos[2] - B.gun.pos[2]) < 1e-3;
      verdict(same && old > 0.01, 'the knock is on the same frame at the same gain, and the gun in the same place, whatever the dice (a beat a player can learn)',
        `gun down ${a ? a.at.toFixed(3) : '—'} / ${b ? b.at.toFixed(3) : '—'} s at ${a ? a.gain.toFixed(3) : '—'} / ${b ? b.gain.toFixed(3) : '—'} · the two guns lie ${on.gun && B.gun ? Math.hypot(on.gun.pos[0] - B.gun.pos[0], on.gun.pos[2] - B.gun.pos[2]).toFixed(4) : '—'} m apart (with the move off, on the same two dice, seeds ${SEED} and ${OTHER}: ${old.toFixed(2)} m apart)`); }
    // ---- let go before the take: nothing was stripped, nothing is said of it
    { const n = Math.max(1, Math.round(K.take * 60) - 4), E0 = await take('pistol', rule, { cancelAfter: n }), E = { calls: E0.calls, hand: inHand(E0.A), floor: guns(E0.g).length };
      verdict(rule && one(E, 'grabCatch').length === 1 && one(E, 'gunStrip').length === 0 && one(E, 'gunDown').length === 0 && E.hand === 'weapon' && E.floor === 0,
        'torn loose before the take: the catch was heard, no strip and no knock (the gun never left his hand)',
        `${said(E)} · in his hand ${E.hand} · guns on the floor ${E.floor}`); }
    // ---- what the room hears: the grab's one noise and nothing more, with the move or without
    { const lv = (R: { noise: any[] }) => R.noise.map(e => `${e.kind} ${e.level}`).join(', ') || 'none';
      const same = on.noise.length === 1 && off.noise.length === 1 && on.noise[0].kind === 'prop' && near(on.noise[0].level, off.noise[0].level);
      const ears = [3.5, 4.5], heard: number[] = []; for (const d of ears) heard.push((await take('pistol', rule, { ear: d })).peak);
      verdict(rule && same && heard[0] > 0.05 && heard[0] < 0.45 && heard[1] === 0,
        'the room hears the grab\'s one scuffle and nothing of the strip or the gun set down: a second man 3.5 m off turns an ear (well short of alarm), one 4.5 m off hears nothing',
        `noise events from the grab on, move on: ${lv(on)} · move off: ${lv(off)} · a man ${ears[0]} m off: awareness 0 → ${heard[0].toFixed(3)} · ${ears[1]} m off: 0 → ${heard[1].toFixed(3)}`); }
  } finally { console.log = log; HOLD.dropGun = was.drop; HOLD.disarm = was.disarm; HOLD.stripFirst = was.first; }
  console.log(`=== grabvoice: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) { const ok = await grabVoiceCheck(); (globalThis as any).process.exit(ok ? 0 : 1); }
