// SNATCHOUT-CHECK: how a snatch ends while src/game/snatchout.ts is up — asked of a staged room clear (the four) on levels/snatch.json, every situation set by hand.
//   bun run tools/qa/snatchout-check.ts            (exit 0 = every line PASS, 1 = a FAIL)
//   SNATCHOUT_BREAK=1     the rule switched off under the same lines: must fail
//   SNATCHOUT_BREAK=hold  the squad's bounds switched off under the same lines: the squad's lines must fail
// What it holds: the block's van stands on floor with a walk from his room · tied with men of theirs still up is not the end, and the row says where to take him
// · the row on him is the word (Space: on your feet — with me), not the arm · led, he follows; 'stay here' puts him down and a leader at the van alone wins
// nothing · led to the van's doors he walks the last steps, is in it, and the mission is WON with the house not taken · the house taken with him tied is not
// the end · a round that kills him on the way still loses it · the slice a save would carry comes back · THE RESPONSE: gunfire a man of the house lives six
// seconds to report brings the level's two men by one of its gates inside its time, eleven or fewer on the floor; a quiet floor brings nobody; the house
// taken does not call them off while he is still to be driven off · THE SQUAD: from the word, with no order given, one pair plants with its guns up while
// the other walks with the leader, the planted pair comes up when left behind, and a man the player orders is let go of · off (the switch) = the snatch as
// it was: the house taken with him tied wins it, no row, and gunfire brings nobody.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

type Vec3 = [number, number, number];
export async function snatchoutCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { SNATCH, checkSnatch } = await import(`${ROOT}/src/game/snatch.ts`), { SNATCHOUT } = await import(`${ROOT}/src/game/snatchout.ts`);
  const { RESPONSE } = await import(`${ROOT}/src/game/qrf.ts`);
  const { killGuard, fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { INTERACT_KEY } = await import(`${ROOT}/src/game/consts.ts`);
  const { PACE } = await import(`${ROOT}/src/game/guards.ts`);
  const brk = process.env.SNATCHOUT_BREAK ?? '', knobs0 = knobsCopy();
  let failed = false, checks = 0;
  const line = (ok: boolean, s: string) => { checks++; if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(f: () => Promise<T> | T): Promise<T> => { const l = console.log, w = console.warn; console.log = console.warn = () => { }; try { return await f(); } finally { console.log = l; console.warn = w; } };
  const levelOf = (file: string) => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const clearOf = (g: any, q: number[] | null) => !!q && !g.cover.openings.some((o: any) => o.kind !== 'rear' && flat(q, o.at) < o.half + 0.6);
  const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
  /** the switches a staging stands on (put up after the stand's own: the frozen stand holds them off) */
  let want = { on: true, hold: true, response: true };
  const set = (on: boolean, hold = true, response = true) => { want = { on, hold, response }; };
  const apply = () => { SNATCH.on = true; SNATCHOUT.on = want.on && brk !== '1'; SNATCHOUT.hold = want.hold && brk !== 'hold'; RESPONSE.on = want.response; RESPONSE.raid = true; RESPONSE.deal = true; };
  /** the room clear with the four staged on the snatch; Sam cannot be hurt. `keep` = how many of the house's men are left alive (the hut's first), held where
   *  they stand with no fight in them, so that 'not taken' is a fact of the floor and nobody's round decides a line */
  async function stage(seed = 7) {
    const W: any = await quiet(() => standUp({ uploadEvery: 4, level: levelOf('snatch.json'), seed }));
    const g = W.game; g.godMode = true; apply();
    const { why } = await quiet(() => startFromQuery(g, new URLSearchParams('levelFile=snatch.json&roomclear=1&squad4'))); if (why) throw new Error(`start refused — ${why}`);
    const step = (secs: number, until?: () => boolean) => quiet(() => { for (let i = 0; i < Math.round(secs * 60); i++) { W.step(1 / 60); if (until?.()) return true; } return !!until?.(); });
    await step(0.1);
    const S = g.snatch, X = S.out, N = g.level.scenarios.snatch;
    const hostiles = () => g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead'), ops = () => g.guards.filter((x: any) => x.unit && x.team === 'operative' && x.state !== 'dead');
    const house = hostiles().slice();
    const thin = (n: number) => quiet(() => { const hut = g.roomClear.rooms.find((r: any) => r.def.id === 'hut')?.defenders ?? []; const order = [...house.filter((h: any) => !hut.includes(h)), ...house.filter((h: any) => hut.includes(h))];
      for (const h of order.slice(0, Math.max(0, order.length - n))) if (h.state !== 'dead') killGuard(g, h, [0, 0, 1], false, 'shot', 'player');
      for (const h of hostiles()) { h.hold = true; } });
    const shot = (pos: number[]) => g.events.push({ kind: 'shot', pos: [pos[0], 1.2, pos[2]], time: g.time, loud: true, level: 1, who: g.player.char.id });
    /** Sam beside him until he is tied */
    const take = async () => { const p = S.man.char.pos; g.teleportPlayer([p[0] - 1.6, 0, p[2] + 0.3]); let up = await step(3, () => S.handsUp || S.tied); if (!up) { g.teleportPlayer([p[0] + 1.6, 0, p[2] - 0.3]); up = await step(3, () => S.handsUp || S.tied); } return step(SNATCH.cuffSecs + 2, () => S.tied); };
    /** Sam walked along the floor's own way to `to` at a walk (set down a stride at a time: headless, nobody holds a key), stopping when `until` */
    const walk = async (to: number[], until: () => boolean, speed = 2.0, max = 90) => {
      const way: Vec3[] = (g.col.nav.findPath(g.player.char.pos, to, 12000) ?? []) as Vec3[]; way.push([to[0], 0, to[2]]);
      let t = 0, q = [...g.player.char.pos];
      for (const w of way) { const L = flat(q, w), n = Math.max(1, Math.ceil(L / (speed / 60)));
        for (let i = 1; i <= n; i++) { g.teleportPlayer([q[0] + (w[0] - q[0]) * i / n, 0, q[2] + (w[2] - q[2]) * i / n]); await quiet(() => W.step(1 / 60)); t += 1 / 60; if (until() || t > max) return until(); }
        q = [...w]; }
      return step(6, until);
    };
    /** a press of the interaction key and its release inside one frame: the tap */
    const tap = () => { W.input.pressed.add(INTERACT_KEY); return step(2 / 60); };
    return { W, g, S, X, N, step, hostiles, ops, thin, shot, take, walk, tap };
  }
  try {
    // ---- 1 · the block; tied with men of theirs up is not the end; the row; the word; 'stay'
    set(true, false, false);
    { const A = await stage(), { g, S, X, N } = A; await A.thin(2);
      const bad = checkSnatch(g), V: Vec3 = N.van?.pos ?? [0, 0, 0];
      line(!!N.van && bad.length === 0 && flat(V, g.roomClear.startAt ?? g.level.playerSpawn) < 6, `the block names ${N.van?.name ?? '(no van)'} at ${at(V)}, ${flat(V, g.roomClear.startAt ?? g.level.playerSpawn).toFixed(1)} m from where the team starts, on floor with a walk from his room${bad.length ? ` — ${bad.join(' · ')}` : ''}`);
      const tied = await A.take(); await A.step(0.3);
      line(tied && !S.end && A.hostiles().length === 2 && !g.roomClear.end, `tied with ${A.hostiles().length} of theirs still up: not the end (end ${S.end}, the room clear ${g.roomClear.end ?? 'running'})`);
      const o1 = S.objective();
      line(!!o1 && /^objective ▸ get .* to the van$/.test(o1.text) && !!o1.pos && flat(o1.pos, S.man.char.pos) < 0.5, `the objective row: "${o1?.text ?? ''}", its marker on him`);
      const rows = () => (g.nearby ?? []).filter((r: any) => r.guard === S.man && r.verb).map((r: any) => r.verb);
      const p = S.man.char.pos; g.teleportPlayer([p[0] - 1.2, 0, p[2] + 0.2]); await A.step(0.3);
      const r1 = rows();
      line(r1.includes('lead') && !r1.includes('grab') && X.owns(S.man), `Sam beside him: the row is the word (${r1.join(', ') || 'no row'}), not the arm`);
      await A.tap(); const said = X.lead === g.player.char; await A.step(0.3);
      const o2 = S.objective(), r2 = rows();
      line(said && X.lead === g.player.char && !!o2?.pos && flat(o2.pos, V) < 0.1 && r2.includes('stay'), `Space on the row: he is led, the marker goes to the van ${at(o2?.pos ?? [0, 0, 0])}, the row now reads '${r2.join(', ')}'`);
      const p0 = [...S.man.char.pos]; await A.walk(p0[0] > 22 ? [20.4, 0, 10.6] : [24.6, 0, 10.9], () => false, 2.0, 4); await A.step(1.5);   // (across his own room's open floor: clear of every door's sweep)
      const followed = flat(S.man.char.pos, p0) > 1.5 && flat(S.man.char.pos, g.player.char.pos) < 3.2;
      line(followed && S.man.char.anim.bound === 1, `Sam walks off: he follows (${flat(S.man.char.pos, p0).toFixed(1)} m from where he was tied, ${flat(S.man.char.pos, g.player.char.pos).toFixed(1)} m behind), wrists still behind him (pose ${S.man.char.anim.bound})`);
      const snap = S.snapshot();
      const stay = X.word(null), p1 = [...S.man.char.pos]; g.teleportPlayer([V[0] + 1.0, 0, V[2]]); await A.step(4);
      line(stay && !X.lead && flat(S.man.char.pos, p1) < 1.2 && flat(S.man.char.pos, V) > 10 && !S.end, `'stay here', and Sam at the van alone: he stays where he was put (${flat(S.man.char.pos, p1).toFixed(2)} m from it, ${flat(S.man.char.pos, V).toFixed(0)} m from the van) and nothing is won (end ${S.end})`);
      S.restore(snap); const back = X.lead === g.player.char && X.led && !S.end; X.word(null);
      line(!!snap?.out && back, `the slice a save would carry puts the word back (lead ${back ? 'Sam' : 'nobody'})`);
    }
    // ---- 2 · led to the van with the house NOT taken: won
    { const A = await stage(), { g, S, X, N } = A; await A.thin(2); await A.take();
      const V: Vec3 = N.van.pos; X.word(g.player.char);
      const t0 = g.time, won = await A.walk([V[0] + 1.4, 0, V[2] - 0.5], () => !!S.end);
      const v = g.verdict?.result;
      line(won && S.end === 'won' && X.inAt >= 0 && S.man.civ.state === 'gone' && /in the van/.test(S.why), `led to the van's doors: ${S.end ?? 'no end'} — "${S.why}" after ${(g.time - t0).toFixed(0)} s on foot; he is off the floor (${S.man.civ.state})`);
      line(A.hostiles().length === 2 && g.roomClear.end !== 'taken' && g.mission.stage !== 'failed', `…with ${A.hostiles().length} of theirs still up and the house not taken (the room clear ${g.roomClear.end ?? 'running'})`);
      await A.step(0.2); const v2 = g.verdict?.result ?? v;
      line(!v2 || (v2.won && v2.word === 'TAKEN ALIVE'), `the end card's record: ${v2 ? `${v2.won ? 'won' : 'lost'} '${v2.word}' — ${v2.why}` : '(the verdict is off on this stand)'}`);
    }
    // ---- 3 · the house taken with him tied is not the end; a round that kills him on the way loses it
    { const A = await stage(), { g, S, X, N } = A; await A.thin(1); await A.take(); await A.thin(0); await A.step(0.5);
      line(g.roomClear.end === 'taken' && !S.end && S.owes && /van/.test(S.objective()?.text ?? ''), `the house taken (${g.roomClear.end}) with him tied: not the end (end ${S.end}); the row still reads "${S.objective()?.text ?? ''}"`);
      X.word(g.player.char); await A.step(0.5);
      const p = S.man.char.pos; g.teleportPlayer([p[0] - 2.4, 0, p[2]]); await A.step(0.2);
      await quiet(() => { for (let i = 0; i < 8 && S.man.state !== 'dead'; i++) { const ch = S.man.char.bones.chest ?? [p[0], 1.1, p[2]]; fireWeapon(g, g.player.char, ch, true); for (let k = 0; k < 14; k++) A.W.step(1 / 60); } });
      await A.step(0.3);
      line(S.end === 'lost' && S.lost === 'dead', `a round kills him on the way out: ${S.why || `(no end; he is ${S.man?.state})`} → ${S.end}`);
    }
    // ---- 4 · the response: gunfire a man of the house lives to report brings the level's men; quiet brings nobody; the house taken does not call them off
    set(true, false, true);
    { const A = await stage(3), { g, S } = A, Q = g.qrf, R = g.level.scenarios.response;
      await A.step(8);
      line(Q.state === 'idle', `eight quiet seconds: nobody is called (${Q.state})`);
      await quiet(() => { for (const h of A.hostiles()) { h.hold = true; } });
      await A.take();   // (in hand before the first round: loose, he would be out of the back gate before anybody could call)
      let called = false; for (let k = 0; k < RESPONSE.callSecs + 4 && !called; k++) { A.shot([16, 0, 20]); called = await A.step(1, () => Q.state !== 'idle'); }
      const eta = Q.arriveAt - Q.requestedAt, way = R.ways[Q.way];
      line(called && !!way && eta >= R.eta[0] - 0.5 && eta <= R.eta[1] + 0.5, `gunfire, and a man of the house alive ${RESPONSE.callSecs} s later: ${R.team} is called (${Q.state}), ${eta.toFixed(0)} s out (the level's ${R.eta[0]}‥${R.eta[1]}), by ${way?.name}`);
      const muster = way?.muster[0] ?? [0, 0, 0], nearest = Math.min(flat(g.player.char.pos, muster), ...A.ops().map((m: any) => flat(m.char.pos, muster)));
      line(nearest > RESPONSE.clearM, `the way dealt is not one a man of the team stands at: the nearest of them is ${nearest.toFixed(1)} m from its muster (over ${RESPONSE.clearM})`);
      // the house falls with them on the road and him not yet in the van: they still come
      await quiet(() => { for (const h of A.hostiles()) if (!Q.men.includes(h)) killGuard(g, h, [0, 0, 1], false, 'shot', 'player'); }); await A.step(0.5);
      const stillOn = Q.state !== 'idle';
      const down = await A.step(eta + 14, () => Q.state === 'deployed');
      const men = Q.men.filter((m: any) => m.state !== 'dead').length, all = g.guards.filter((x: any) => x.team === 'hostile').length;
      line(stillOn && down && men === R.men[0] && all <= 11 && !S.end, `the house falls with them on the road and him tied, not yet out: they are not called off — ${men} in by ${way?.name} (${Q.state}), ${all} of theirs on the floor all told (eleven is the cap), the run still on`);
      line(Q.men.length === 2 && Q.men.every((m: any) => m.team === 'hostile' && /^VILLAGE-\d$/.test(m.callsign)), `they stand with the defenders, under the level's own name: ${Q.men.map((m: any) => `${m.callsign} (${m.team})`).join(', ')}`);
    }
    // ---- 5 · the squad, by bounds: no order given
    set(true, true, false);
    { const A = await stage(), { g, S, X, N } = A, O = g.orders; await A.thin(2);
      // the four brought to him as a file behind Sam, then tied
      const p = S.man.char.pos; g.teleportPlayer([p[0] - 1.6, 0, p[2] + 0.3]);
      await quiet(() => { const spots = [[-2.6, 0.6], [-2.6, 1.4], [-3.6, 0.6], [-3.6, 1.4]]; A.ops().forEach((m: any, i: number) => { m.char.pos[0] = p[0] + spots[i][0]; m.char.pos[2] = p[2] + spots[i][1]; }); O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); });
      await A.step(SNATCH.cuffSecs + 3, () => S.tied); await A.step(1);
      const before = A.ops().map((m: any) => O.of(m)?.order).join(',');
      X.word(g.player.char); await A.step(1.2);
      const pl = X.planted, pair = new Set(pl.map((m: any) => O.pairOf(m)));
      line(pl.length === 2 && pair.size === 1 && pl.every((m: any) => O.of(m)?.order === 'hold' && clearOf(g, O.of(m).post)), `the word, and no order given (they were ${before}): one pair plants — ${pl.map((m: any) => m.callsign).join(' + ') || 'nobody'} (${[...pair].join('')}), each on a spot clear of every doorway; the other pair stays with Sam (${A.ops().filter((m: any) => !pl.includes(m)).map((m: any) => `${m.callsign} ${O.of(m)?.order}`).join(', ')})`);
      const first = pl.slice(), V: Vec3 = N.van.pos, at0 = first.map((m: any) => [...m.char.pos]);
      // Sam walks him out; the planted pair is left behind, comes up, and the other plants
      let swapped = false, cameUp = false, fast = 0; const b0 = X.bounds, was = new Map<any, number[]>();
      await A.walk([V[0] + 1.4, 0, V[2] - 0.5], () => { const now = X.planted;
        for (const m of A.ops()) { const q = was.get(m); if (q) fast = Math.max(fast, flat(m.char.pos, q) * 60); was.set(m, [...m.char.pos]); }   // (a frame is a sixtieth: metres a second, every teammate, every frame of the walk)
        if (first.some((m: any, i: number) => flat(m.char.pos, at0[i]) > 3)) cameUp = true; if (now.length && now.every((m: any) => !first.includes(m))) swapped = true; return !!S.end; });
      line(cameUp && swapped && X.bounds > b0, `on the walk out the planted pair comes up once left ${SNATCHOUT.trailM} m behind and the pair that was with Sam plants in its place (${X.bounds} bounds in all)`);
      line(S.end === 'won' && fast > 0.5 && fast <= PACE.max + 0.3 && X.planted.length === 0, `…and he is in the van: ${S.end ?? 'no end'} — "${S.why}"; nobody is left planted (${X.planted.length}) and no teammate ran on the way (the fastest ${fast.toFixed(1)} m/s, the walk's cap ${PACE.max})`);
    }
    { const A = await stage(), { g, S, X, N } = A; await A.thin(2); await A.take();
      const V: Vec3 = N.van.pos; X.word(g.player.char); await A.step(0.3);
      await quiet(() => { S.man.char.pos[0] = V[0] + 4.5; S.man.char.pos[2] = V[2] - 0.6; g.teleportPlayer([V[0] + 1.4, 0, V[2] - 0.5]); g.player.down = true; });
      await A.step(4, () => !!S.end);
      line(S.end !== 'won' && X.inAt < 0, `the one he follows goes down a step from the doors: nothing is won behind a man on the floor (${S.end ?? 'no end'}, in the van: ${X.inAt >= 0})`);
      g.player.down = false;
    }
    { const A = await stage(), { g, S, X } = A, O = g.orders; await A.thin(2);
      const p = S.man.char.pos; g.teleportPlayer([p[0] - 1.6, 0, p[2] + 0.3]);
      await quiet(() => { const spots = [[-2.6, 0.6], [-2.6, 1.4], [-3.6, 0.6], [-3.6, 1.4]]; A.ops().forEach((m: any, i: number) => { m.char.pos[0] = p[0] + spots[i][0]; m.char.pos[2] = p[2] + spots[i][1]; }); O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); });
      await A.step(SNATCH.cuffSecs + 3, () => S.tied);
      // one pair is the player's (a move order), a man of the other stands in the nearest doorway at the word: he does not plant in it
      const red = A.ops().filter((m: any) => O.pairOf(m) === O.pairOf(A.ops()[0])), blue = A.ops().filter((m: any) => !red.includes(m));
      // (staged at the house's front door, where there is floor to step to on either stand: he sits out in the courtyard, Sam beside him, the door between them and nothing)
      const door = g.cover.openings.find((o: any) => o.id === 'door:front'), free = (k: number, side: number): Vec3 => [door.at[0] + door.n[0] * k - door.n[1] * side, 0, door.at[2] + door.n[1] * k + door.n[0] * side];
      const out = [1, -1].find(k => !g.col.nav.isBlocked(...([free(4 * k, 0)[0], free(4 * k, 0)[2]] as [number, number])) && flat(free(4 * k, 0), A.N.van.pos) > flat(free(-4 * k, 0), A.N.van.pos)) ?? 1;
      await quiet(() => { const put = (c: any, q: Vec3) => { c.pos[0] = q[0]; c.pos[2] = q[2]; };
        put(S.man.char, free(4.5 * out, 0)); g.teleportPlayer(free(4.5 * out, 1.4)); put(red[0].char, free(0, 0)); put(red[1].char, free(2.4 * out, -1.6)); put(blue[0].char, free(3 * out, 3)); put(blue[1].char, free(3 * out, 4)); });
      await quiet(() => O.give('hold', O.targetAt(blue[0].char.pos), O.pairOf(blue[0])));
      X.word(g.player.char); await A.step(1.2);
      const post0 = O.of(red[0])?.post ?? door.at;
      line(X.planted.includes(red[0]) && clearOf(g, post0) && flat(post0, door.at) < SNATCHOUT.spotM + 0.5, `a man standing in a doorway at the word plants ${flat(post0, door.at).toFixed(1)} m out of it (${X.planted.includes(red[0]) ? 'planted' : `not planted: ${red.map((m: any) => `${m.callsign} ${O.of(m)?.order} at ${at(m.char.pos)}`).join(', ')} · the door ${door.id} at ${at(door.at)} · Sam ${at(g.player.char.pos)}`}), not in it`);
      const pl = X.planted.slice(), man = pl[0];
      const why = man ? await quiet(() => O.give('fallIn', O.targetAt(g.player.char.pos), 'all')) : 'nobody planted'; await A.step(1.6);
      line(pl.length > 0 && !why && X.planted.length === 0 && A.ops().every((m: any) => O.of(m)?.order === 'fallIn'), `an order from the player to everybody (fall in), one pair planted and one not: it stands for all four (${A.ops().map((m: any) => O.of(m)?.order).join(',')}) and nobody is planted again behind it (${X.planted.map((m: any) => m.callsign).join(' + ') || 'nobody'})${why ? ` — refused: ${why}` : ''}`);
      X.word(null); await A.step(1.2);
      line(X.planted.length === 0, `'stay here': nobody is left planted (${X.planted.length})`);
      // a planted man goes down: his mate's gun goes to where the round came from
      X.word(g.player.char); await A.step(1.2);
      const two = X.planted.slice(), h = A.hostiles()[0];
      if (two.length === 2 && h) { await quiet(() => { killGuard(g, two[0], [0, 0, 1], false, 'shot', 'guard'); two[0].killerId = h.char.id; }); await A.step(0.8); }
      const w = two[1] ? O.of(two[1])?.watch : null;
      line(two.length === 2 && !!h && !!w && flat(w, h.char.pos) < 1.5 && O.of(two[1])?.order === 'hold', `a planted man goes down (${two[0]?.callsign ?? '—'}): his mate's gun goes to where the round came from (${two[1]?.callsign ?? '—'} ${w ? `on ${at(w)}, ${flat(w, h.char.pos).toFixed(1)} m from the man who fired` : 'on nothing named'})`);
      // …and a round that kills him ends it with nobody left planted
      const left = X.planted.length, hp = S.man.char.pos; g.teleportPlayer([hp[0] - 2.4, 0, hp[2]]); await A.step(0.2);
      await quiet(() => { for (let i = 0; i < 8 && S.man.state !== 'dead'; i++) { const ch = S.man.char.bones.chest ?? [hp[0], 1.1, hp[2]]; fireWeapon(g, g.player.char, ch, true); for (let k = 0; k < 14; k++) A.W.step(1 / 60); } });
      await A.step(0.3);
      line(left > 0 && S.end === 'lost' && X.planted.length === 0, `lost with ${left} planted: the men go back to the file (${X.planted.length} planted, ${A.ops().map((m: any) => O.of(m)?.order).join(',')})`);
    }
    // ---- 6 · off: the snatch as it was
    set(false, true, true);
    { const A = await stage(3), { g } = A; await quiet(() => { for (const h of A.hostiles()) h.hold = true; });
      for (let k = 0; k < RESPONSE.callSecs + 4; k++) { A.shot([16, 0, 20]); await A.step(1); }
      line(g.qrf.state === 'idle', `SNATCHOUT.on false: gunfire brings nobody (${g.qrf.state})`);
    }
    { const A = await stage(), { g, S, X } = A; await A.thin(2); await A.take();
      const p = S.man.char.pos; g.teleportPlayer([p[0] - 1.2, 0, p[2] + 0.2]); await A.step(0.3);
      const rows = (g.nearby ?? []).filter((r: any) => r.guard === S.man && r.verb).map((r: any) => r.verb);
      line(S.tied && !X.ruled && !X.word(g.player.char) && !rows.includes('lead') && S.objective() === null, `…no word to give (his rows: ${rows.join(', ') || 'none'}), no row of his once he is in hand`);
      await A.thin(0); const won = await A.step(1, () => S.end === 'won');
      line(won && /taken alive/.test(S.why), `…and the house taken with him tied wins it, as it did: ${S.end} — ${S.why}`);
    }
  } catch (e: any) { failed = true; console.log(`- FAIL — threw: ${e?.stack ?? e}`); }
  finally { knobsBack(knobs0); }
  console.log(failed ? `=== snatchout-check: FAILED (${checks} lines) ===` : `=== snatchout-check: ALL PASS (${checks} lines) ===`);
  return !failed;
}
if (import.meta.main) process.exit((await snatchoutCheck()) ? 0 : 1);
