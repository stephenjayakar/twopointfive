// AN UNFOUND SQUAD NEVER FIRES FIRST — the check behind src/game/holdfire.ts (HOLDFIRE.on: on in the page, ?noholdfire; off on the frozen stand, TPS_HOLDFIRE=1).
//   bun run tools/qa/holdfire-check.ts        (also `probes.ts holdfire`; passes on both stands: it raises the switch itself)
// A loud room clear in the office (the pair, the four; hard), the team sent by a plain MOVE to the break room's west doorway with the leaf stood open and the
// room's men kept unaware, Sam walking TALL up and down behind them:
//   1  not a round from the team while nobody has found it, a gun on a man all the while — and with the switch off the same staging is shot on sight;
//   2  one round from Sam's own gun (the suppressed pistol: it rouses nobody by itself) and the hold is off for every man — they fire;
//   3  a plain hold / cover / move / fall in lifts nothing; a door tool (open and clear) lifts it for every man;
//   4  an order noted by its id — 'fragThere', a row of another part — lifts; an id that is not a fire order does not;
//   5  found means found: a defender roused, or gunfire in a teammate's ears, and nobody holds from that frame;
//   6  the lift runs out `liftSecs` after the last shot / order and the hold is back; a stamp from ahead of the clock (a load) is no lift; a restart resets;
//   7  a SILENT squad is the silent order's own: its holds are counted in SILENT_STATS, none here, and its run digests the same with this switch on and off;
//   8  switch off: every function inert, every count zero.
//   L  'go loud' told to a SILENT squad (HOLDFIRE.loud) is an order that means fire: held silent on unaware men, told loud by the order — a round goes;
//      with the sub-switch off they still hold; a squad that was never silent, or one taken out of silent by anything but that order, is lifted by
//      nothing here (it holds until Sam's shot); a recording from before the key replays with it off;
//   C  a plain stack beside unaware men: on their marks with their guns held on a man, the men are SET ('set.', the row's 'stacked') — no round, no door;
//      on a locked door nobody tries the handle while held, and the pair stays set through Sam in their line and Sam low; the men they are held on gone, the
//      handle is tried only with the lead's gun back on the door; and with only the SECOND man held (the lead's gun on the door) nobody tries it either;
//      the two sub-keys a recording from before each replays without: HOLDFIRE.stackSet off, the held pair on its marks is 'stacking' (the key raised sets
//      it); stackWait off, the second-man-held door has its handle tried by the lead; and journal.ts applyKnobs' rule for a recording without the keys;
// HOLDFIRE_BREAK=1 = the switch left off where the lines ask for it on: must fail.   exit 0 = all hold · 1 = one does not
import { ROOT } from './headless.ts';
import { Run } from './pairsneak.ts';

export async function holdfireCheck(): Promise<boolean> {
  const HF: any = await import(`${ROOT}/src/game/holdfire.ts`);
  const U: any = await import(`${ROOT}/src/game/unseen.ts`);
  const SL: any = await import(`${ROOT}/src/game/silent.ts`);
  const { FRIENDS } = (await import(`${ROOT}/src/game/friends.ts`)) as any;
  const { PLAYER_ID } = (await import(`${ROOT}/src/game/consts.ts`)) as any;
  const { DOORTOOLS } = (await import(`${ROOT}/src/game/doortools.ts`)) as any;
  const { killGuard } = (await import(`${ROOT}/src/game/combat.ts`)) as any;
  const BREAK = process.env.HOLDFIRE_BREAK === '1';
  const was = { hf: JSON.parse(JSON.stringify(HF.HOLDFIRE)), un: JSON.parse(JSON.stringify(U.UNSEEN)), low: FRIENDS.lowReady, rnd: Math.random, test: DOORTOOLS.testDoor };
  let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); return ok; };
  const zero = () => { HF.HOLDFIRE_STATS.held = HF.HOLDFIRE_STATS.heldGlass = 0; for (const k of Object.keys(HF.HOLDFIRE_STATS.lifts)) HF.HOLDFIRE_STATS.lifts[k] = 0; HF.HOLDFIRE_LOG.length = 0;
    for (const k of Object.keys(U.UNSEEN_STATS)) U.UNSEEN_STATS[k] = 0; for (const k of Object.keys(SL.SILENT_STATS)) SL.SILENT_STATS[k] = 0; };
  console.log('\n=== holdfire: a squad nobody has found never fires first ===');

  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const living = (R: Run) => R.ops.filter((o: any) => o.state !== 'dead');
  const foes = (R: Run) => R.hostiles.filter((h: any) => h.state !== 'dead');
  /** a fresh loud squad at the office's room clear, fallen in, the rule as asked (`on`: what the line wants — HOLDFIRE_BREAK leaves it off) */
  async function stand(query: string, on: boolean, hard = false): Promise<Run> {
    const R = await Run.start(query, 1, { hard }); R.stopOnNotice = false; R.cap = 900;
    Object.assign(HF.HOLDFIRE, was.hf, { on: on && !BREAK }); Object.assign(U.UNSEEN, { on: true, hold: true }); zero();   // (after the stand-up: the frozen stand holds both off)
    const why = R.g.orders.give('fallIn', { kind: 'none', at: [R.pos[0], 0, R.pos[2]] }); if (why) throw new Error(`fall in refused — ${why}`);
    R.wait(1); return R;
  }
  /** the longest clear run from Sam along the axes, and the way back (he walks it up and down, tall) */
  function runway(R: Run): number[][] { const nav = R.g.col.nav, dirs = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    const clear = (d: number[]) => { let k = 0; for (; k < 20; k++) if (nav.isBlocked(R.pos[0] + d[0] * (k + 1) * 0.5, R.pos[2] + d[2] * (k + 1) * 0.5)) break; return k; };
    dirs.sort((a, b) => clear(b) - clear(a)); const n = Math.min(4, clear(dirs[0]) * 0.5 - 0.5); return [[R.pos[0], 0, R.pos[2]], [R.pos[0] + dirs[0][0] * n, 0, R.pos[2] + dirs[0][2] * n]]; }
  interface Tally { /** EVERY round a teammate fired in the window */ all: number; /** door noises (a handle tried, a leaf worked) — and where each was */ door: number; doorAt: number[][]; /** frames this rule held a round */ held: number; aimed: number; tall: number; walked: number; frames: number;
    /** THE CHECK'S OWN MEASURE of 'nobody has found them', nothing of the rule's asked: frames a living defender had a squad man or Sam inside his cone with a clear line · loud events not the team's own (a round of Sam's or a defender's, a bang, a kick) · the frame of the first of each (−1: none) */
    eyes: number; loud: number; firstEyes: number; firstRound: number }
  const eyeOf = (c: any) => [c.pos[0], 1.55, c.pos[2]];
  /** does this defender have that body in front of his eyes: inside 62° of his chest or his gun line, within 30 m, nothing solid between (the check's own geometry) */
  const hasEyes = (R: Run, h: any, c: any) => { const hc = h.char, dx = c.pos[0] - hc.pos[0], dz = c.pos[2] - hc.pos[2], d = Math.hypot(dx, dz); if (d > 30) return false; if (d < 0.8) return true;
    const yaw = Math.atan2(dx, dz), off = (y: number) => Math.abs(Math.atan2(Math.sin(yaw - y), Math.cos(yaw - y)));
    return Math.min(off(hc.bodyYaw), off(hc.aimYaw)) < 62 * Math.PI / 180 && !R.g.col.segmentBlocked(eyeOf(hc), eyeOf(c)); };
  const bodies = (R: Run) => [R.g.player.char, ...living(R).map((o: any) => o.char)];
  const anyEyes = (R: Run, skip: any = null) => foes(R).some((h: any) => h !== skip && bodies(R).some(c => hasEyes(R, h, c)));
  /** the defenders kept UNAWARE and looking the other way (their backs to the squad), every frame — all but `skip` */
  const freeze = (R: Run, skip: any = null) => { const B = bodies(R), cx = B.reduce((a, c) => a + c.pos[0], 0) / B.length, cz = B.reduce((a, c) => a + c.pos[2], 0) / B.length;
    for (const h of foes(R)) { if (h === skip) continue; h.state = 'patrol'; h.awareness = 0; const c = h.char, yaw = Math.atan2(c.pos[0] - cx, c.pos[2] - cz); c.bodyYaw = c.aimYaw = yaw; for (const k of ['wantBody', 'wantAim']) if (Object.getOwnPropertyDescriptor(c, k)?.writable) c[k] = yaw; } };
  /** `secs` of play: the defenders kept unaware and turned away (`frozen`; `each` runs after the freeze, before the step), Sam walking between `ends` upright */
  function play(R: Run, secs: number, ends: number[][] | null, frozen = true, skip: any = null, each: (() => void) | null = null): Tally {
    const g = R.g, T: Tally = { all: 0, door: 0, doorAt: [], held: 0, aimed: 0, tall: 0, walked: 0, frames: 0, eyes: 0, loud: 0, firstEyes: -1, firstRound: -1 }; let leg = 1, prev = [...R.pos]; const h0 = HF.HOLDFIRE_STATS.held;
    for (let i = 0; i < secs * 60; i++) {
      if (frozen) freeze(R, skip); each?.();
      if (ends) { if (flat(R.pos, ends[leg]) < 0.4) leg = 1 - leg; R.goal = ends[leg]; }
      g.events.push = function (this: any[], e: any) { const team = R.ops.some((o: any) => o.char.id === e.who);
        if (e.kind === 'guardShot' && team) { T.all++; if (T.firstRound < 0) T.firstRound = i; } else if (e.kind === 'shot' || e.kind === 'guardShot' || e.kind === 'bang' || e.kind === 'kick') T.loud++; else if (e.kind === 'door') { T.door++; T.doorAt.push([...(e.pos ?? [NaN, 0, NaN])]); }
        return Array.prototype.push.call(this, e); } as any;
      R.step(); T.frames++; T.walked += flat(R.pos, prev); prev = [...R.pos];
      if (anyEyes(R, skip)) { T.eyes++; if (T.firstEyes < 0) T.firstEyes = i; }
      if (!R.pl.crouch && !R.pl.wall && R.pl.pace > 0.9) T.tall++;
      if (living(R).some((o: any) => { const t = g.fight.opOf(o)?.tgt; if (!t || t.state === 'dead') return false; const c = o.char, d = [t.char.pos[0] - c.pos[0], t.char.pos[2] - c.pos[2]], yaw = Math.atan2(d[0], d[1]); let e = yaw - c.aimYaw; e = Math.atan2(Math.sin(e), Math.cos(e)); return Math.abs(e) < 0.2; })) T.aimed++;
    }
    R.goal = null; T.held = HF.HOLDFIRE_STATS.held - h0; return T;
  }
  const quiet = (T: Tally) => T.eyes === 0 && T.loud === 0;
  const qw = (T: Tally) => `by the check's own measure: a defender with eyes on them ${T.eyes} frames, loud events not the team's ${T.loud}`;
  /** the team sent by a plain MOVE to the break room's west doorway, the leaf stood open: the room's men are in their sight from there */
  function toDoorway(R: Run): string | null {
    const g = R.g, d = R.door('breakroom_w'), c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), sd = (R.pos[0] - c[0]) * nx + (R.pos[2] - c[2]) * nz >= 0 ? 1 : -1;
    d.angle = (d.swing ?? 1) > 0 ? d.maxA : d.minA; d.latched = false; d.vel = 0; d.quietT = -3600;
    return g.orders.give('move', { kind: 'floor', at: R.free([c[0] - nx * sd * 0.9, 0, c[2] - nz * sd * 0.9]) });
  }
  /** would this man's round at that defender be held right now — asked of the fire gate's own function, for every living man against every unaware defender */
  const holdsAll = (R: Run) => { const hs = foes(R).filter((h: any) => h.state === 'patrol' && h.awareness < SL.SILENT.noticed); return hs.length > 0 && living(R).every((o: any) => hs.every((h: any) => SL.silentHolds(R.g, o, h))); };
  /** how far a man's gun is off a point, rad */
  const gunOff = (o: any, at: number[]) => { const e = Math.atan2(at[0] - o.char.pos[0], at[2] - o.char.pos[2]) - o.char.aimYaw; return Math.abs(Math.atan2(Math.sin(e), Math.cos(e))); };
  const holdsAny = (R: Run) => { const hs = foes(R).filter((h: any) => h.state === 'patrol' && h.awareness < SL.SILENT.noticed); return living(R).some((o: any) => hs.some((h: any) => SL.silentHolds(R.g, o, h))); };
  const samShot = (R: Run, at: number[]) => { const g = R.g, n0 = g.events.filter((e: any) => e.kind === 'shot' && e.who === PLAYER_ID).length; FRIENDS.lowReady = false;
    R.slot(1); R.cursor(at); R.step(20); R.I.buttons |= 1; R.I.clicked |= 1; R.step(3); R.I.buttons &= ~1; FRIENDS.lowReady = was.low;
    const ev = g.events.filter((e: any) => e.kind === 'shot' && e.who === PLAYER_ID); return { n: ev.length - n0, level: ev[ev.length - 1]?.level as number | undefined }; };

  try {
    // ---- 1: unfound, Sam walking tall — no round; and the same staging with the switch off is shot on sight (the pair and the four, standard defenders)
    for (const [tag, q] of [['the pair', 'roomclear=7&squad=1'], ['the four', 'roomclear=7&squad4']] as const) {
      { const R = await stand(q, true), ends = runway(R); const why = toDoorway(R); if (why) { line(false, `1 · ${tag}: the move was refused — ${why}`); continue; }
        const T = play(R, 22, ends);
        line(T.all === 0 && quiet(T) && T.held > 0 && T.aimed > 0 && U.UNSEEN_STATS.held === 0 && T.tall > T.frames * 0.95 && T.walked > 8,
          `1 · ${tag}: nobody has found them, Sam walking tall — NOT ONE team round in 22 s, a gun on a man, the rounds held by this rule and not the sneak's`,
          `team rounds ${T.all} · ${qw(T)} · held on ${T.held} frames (sneak's hold ${U.UNSEEN_STATS.held}) · a gun on a man ${T.aimed} frames · Sam upright at full pace ${T.tall}/${T.frames} frames, walked ${T.walked.toFixed(1)} m · ${HF.holdFireSummary(R.g)}`); }
      { const R = await stand(q, false), ends = runway(R); const why = toDoorway(R); const T = why ? null : play(R, 22, ends);
        const first = !!T && T.all > 0 && T.loud === 0 && (T.firstEyes < 0 || T.firstRound < T.firstEyes);
        line(first && HF.HOLDFIRE_STATS.held === 0, `1 · ${tag}, the same staging with the switch OFF: the team fires first, on men who have not seen it — the build`, T ? `team rounds ${T.all}, the first at frame ${T.firstRound} · first frame a defender had eyes on them ${T.firstEyes} · other loud events ${T.loud} · held ${HF.HOLDFIRE_STATS.held}` : `move refused — ${why}`); }
    }
    // ---- A: a defender 'alert' somewhere else who has seen nobody (a plant at the end of a walk, a dig-in on boots) does not end the hold
    { const R = await stand('roomclear=7&squad4', true), g = R.g; const why = toDoorway(R); const T0 = play(R, 12, null);
      const X = foes(R).filter((h: any) => !bodies(R).some(c => !g.col.segmentBlocked(eyeOf(h.char), eyeOf(c)))).sort((a: any, b: any) => flat(b.char.pos, R.pos) - flat(a.char.pos, R.pos))[0];
      if (why || !X) line(false, `A · not staged — ${why ?? 'no defender out of every line'}`); else {
        const at = [...X.char.pos]; let oldFound = 0, ownFound = 0, n = 0, saw = 0;
        const T = play(R, 10, null, true, X, () => { X.state = 'alert'; X.awareness = 1; X.char.pos[0] = at[0]; X.char.pos[2] = at[2]; n++; if (U.squadFound(g, living(R))) oldFound++; if (HF.holdFireFound(g, living(R))) ownFound++; if (X.lastSeenT >= 0) saw++; });
        freeze(R, X); X.state = 'alert'; const still = foes(R).filter((h: any) => h !== X).length > 0 && living(R).every((o: any) => foes(R).filter((h: any) => h !== X).every((h: any) => SL.silentHolds(g, o, h)));
        X.lastSeenT = g.time; const seen = !!HF.holdFireFound(g, living(R)) && !holdsAny(R); X.lastSeenT = -100;
        line(T0.all === 0 && T.all === 0 && quiet(T) && T.held > 0 && T.aimed > 0 && saw === 0 && oldFound > n * 0.9 && ownFound === 0 && still && seen,
          `A · ${X.callsign} made 'alert' in another room, having seen nobody: the hold stands for 10 s (not a team round, guns on unaware men) where the old found test called them found; the same man WITH a sighting ends it for everybody`,
          `team rounds ${T0.all} before, ${T.all} with him alert · ${qw(T)} · held ${T.held} frames, a gun on a man ${T.aimed} · he had a sighting on ${saw} frames · unseen.ts squadFound said found on ${oldFound}/${n} frames, this rule's test on ${ownFound} · all still held at the end ${still} · stamped as having seen them → found, nobody holds ${seen}`); } }

    // ---- 2: Sam's own round, a quiet one
    { const R = await stand('roomclear=7&squad4', true), ends = runway(R); const why = toDoorway(R); const T1 = play(R, 12, ends);
      freeze(R); const before = !why && holdsAll(R); const D = ends[1], shot = samShot(R, [D[0] + (D[0] - ends[0][0]), 1.2, D[2] + (D[2] - ends[0][2])]);
      freeze(R); const after = holdsAny(R), lifted = HF.holdFireLifted(R.g);
      const T2 = play(R, 12, null);
      line(T1.all === 0 && quiet(T1) && before && shot.n === 1 && (shot.level ?? 1) < 1 && lifted && !after && HF.HOLDFIRE_STATS.lifts.shot === 1 && T2.all > 0,
        `2 · Sam fires one suppressed round: the hold is off for every man of the squad at once, and they fire`,
        `team rounds before ${T1.all} (${qw(T1)}) · held for all before ${before} · his rounds ${shot.n} (report level ${shot.level}) · lifted ${lifted} · anybody still held ${after} · lifts by shot ${HF.HOLDFIRE_STATS.lifts.shot} · team rounds in the next 12 s ${T2.all}`);
    }

    // ---- 3: orders — the plain ones lift nothing (each ACCEPTED), a door tool lifts for all
    { const R = await stand('roomclear=7&squad4', true), g = R.g, O = g.orders, ends = runway(R); const here = () => ({ kind: 'none', at: [R.pos[0], 0, R.pos[2]] }); const got: string[] = []; let ok = true;
      for (const id of ['hold', 'cover', 'move', 'fallIn']) { freeze(R); const w = O.give(id, id === 'cover' || id === 'move' ? { kind: 'floor', at: R.free(ends[1]) } : here()); R.step(20); freeze(R); const l = HF.holdFireLifted(g); ok &&= !w && !l; got.push(`${id}${w ? ` (REFUSED: ${w})` : ''} → ${l ? 'LIFTED' : 'held'}`); }
      const why = toDoorway(R);
      if (why) line(false, `3 · the move was refused — ${why}`); else {
        const T0 = play(R, 12, null);
        freeze(R); const plain = ok && !HF.holdFireLifted(g) && holdsAll(R) && HF.HOLDFIRE_STATS.lifts.order === 0;
        line(T0.all === 0 && quiet(T0) && plain, `3 · hold, cover, move, fall in — each accepted: none of them starts the fight`, `${got.join(' · ')} · then 12 s at the doorway: team rounds ${T0.all}, ${qw(T0)}`);
        const w = O.give('openClear', O.targetAt(R.door('breakroom_w').frameCentre)); freeze(R); const lifted = HF.holdFireLifted(g), any = holdsAny(R);
        const T = play(R, 25, null);
        line(!w && lifted && !any && HF.HOLDFIRE_STATS.lifts.order === 1 && T.all > 0 && T.held === 0, `3 · 'open and clear' on the door: the fight is on for every man, and the room is shot`,
          `${w ? `refused: ${w}` : 'given'} · lifted ${lifted} · anybody still held ${any} · lifts by order ${HF.HOLDFIRE_STATS.lifts.order} · ${T.all} team rounds in 25 s · held frames after ${T.held}`); } }
    // ---- B: an order that WAITS lifts nothing until it goes — a tool given on the word, a charge set
    { const R = await stand('roomclear=7&squad4', true), g = R.g, O = g.orders, d = R.door('breakroom_w'); let liftedEarly = 0, ready = false, rounds = 0;
      const w = O.give('openClear', O.targetAt(d.frameCentre), 'all', { onWord: true });
      for (let k = 0; k < 40 && !ready; k++) { const T = play(R, 1, null); rounds += T.all; if (HF.holdFireLifted(g)) liftedEarly++; ready = g.doorTools.ops.some((op: any) => op.onWord && op.phase === 'ready'); }
      const T = play(R, 3, null); rounds += T.all; freeze(R); const waiting = ready && !HF.holdFireLifted(g) && HF.HOLDFIRE_STATS.lifts.order === 0 && holdsAll(R);
      const w2 = O.give('go', { kind: 'none', at: [R.pos[0], 0, R.pos[2]] }); freeze(R); const went = !w2 && HF.holdFireLifted(g) && HF.HOLDFIRE_STATS.lifts.order === 1 && !holdsAny(R);
      line(!w && liftedEarly === 0 && rounds === 0 && waiting && went, `B · 'wait · open and clear': nothing lifted through the walk and the wait on the door, every man still holds; the WORD lifts it for all`,
        `${w ? `refused: ${w}` : 'given on the word'} · stacked and ready ${ready} · lifted before the word on ${liftedEarly} checks · team rounds ${rounds} · held at the wait ${waiting} · 'go'${w2 ? ` refused: ${w2}` : ''} → lifted, one lift by order, nobody held ${went}`); }
    { const R = await stand('roomclear=7&squad4', true), g = R.g, O = g.orders, d = R.door('breakroom_w'); let liftedEarly = 0, rounds = 0, k = 0;
      const w = O.give('charge', O.targetAt(d.frameCentre));
      for (; k < 50 && !g.doorTools.set.length; k++) { const T = play(R, 1, null); rounds += T.all; if (HF.holdFireLifted(g)) liftedEarly++; }
      const T = play(R, 2, null); rounds += T.all; freeze(R); const set = g.doorTools.set.length > 0, waiting = set && !HF.holdFireLifted(g) && HF.HOLDFIRE_STATS.lifts.order === 0 && holdsAll(R);
      const blown = set && !!g.doorTools.blow(); const went = blown && HF.holdFireLifted(g) && HF.HOLDFIRE_STATS.lifts.order === 1 && !holdsAny(R);
      line(!w && liftedEarly === 0 && rounds === 0 && waiting && went, `B · a door charge: nothing lifted while it is set and the squad stands off; the BLOW lifts it for all`,
        `${w ? `refused: ${w}` : 'given'} · set after ${k} s ${set} · lifted before the blow on ${liftedEarly} checks · team rounds ${rounds} · held with it armed ${waiting} · blown → lifted, one lift by order, nobody held ${went}`); }

    // ---- C: a plain 'stack up' on a door INSIDE a room with unaware men in view — held on a man, on his mark, a man is stacked (orders.ts asks holdFireOnMan)
    { const R = await stand('roomclear=7&squad=2', true), g = R.g, O = g.orders, d = R.door('breakroom_n'), dw = R.door('breakroom_w'), n0 = foes(R).length; let secs = 0, set = false, rounds = 0, held = 0;
      dw.angle = (dw.swing ?? 1) > 0 ? dw.maxA : dw.minA; dw.latched = false; dw.vel = 0; dw.quietT = -3600; g.teleportPlayer([30.75, 0, 14.4]); rounds += play(R, 1, null).all;   // (the way in stood open, Sam inside by the north door: the stack is on his side of it)
      const w = O.give('stack', O.targetAt(d.frameCentre));
      for (; secs < 30 && !set; secs++) { const T = play(R, 1, null); rounds += T.all; held += T.held; set = living(R).every((o: any) => O.of(o)?.order === 'stack' && O.of(o).arrived); }
      const T = play(R, 6, null); rounds += T.all; freeze(R);
      const off = (o: any, at: number[]) => { const e = Math.atan2(at[0] - o.char.pos[0], at[2] - o.char.pos[2]) - o.char.aimYaw; return Math.abs(Math.atan2(Math.sin(e), Math.cos(e))); };
      const men = living(R).map((o: any) => { const A = O.of(o), t = g.fight.opOf(o)?.tgt; return { o, A, t, mark: A?.post ? flat(o.char.pos, A.post) : NaN, man: t ? off(o, t.char.pos) : NaN, door: off(o, d.frameCentre), rule: HF.holdFireOnMan(g, o) as boolean, word: O.statusOf(o) as string }; });
      line(!w && set && rounds === 0 && T.loud === 0 && held > 0 && T.held > 0 && foes(R).length === n0 && Math.abs(d.angle) < 0.05 && men.length === 2
        && men.every((m: any) => m.A?.order === 'stack' && m.A.arrived && m.A.setSaid && m.mark < 0.35 && m.word.startsWith('stacked') && m.t?.state === 'patrol' && m.man < 0.2 && m.door > 0.2 && m.rule),
        `C · told to stack on a door inside the room, unaware men in view: the pair is SET (on its marks, 'set.' said, the row says stacked) with not a round fired and each gun still held on a man`,
        `${w ? `refused: ${w}` : 'given'} · set ${set} after ${secs} s · team rounds ${rounds} · loud events not the team's ${T.loud} · held ${held} frames on the walk, ${T.held} in the 6 s after · defenders up ${foes(R).length}/${n0} · leaf angle ${d.angle.toFixed(2)} · ${men.map((m: any) => `${m.o.callsign}: ${m.mark.toFixed(2)} m off his mark, gun ${m.man.toFixed(2)} rad off ${m.t?.callsign ?? 'nobody'} and ${m.door.toFixed(2)} rad off the doorway, held on him by this rule ${m.rule}, set said ${!!m.A?.setSaid}, "${m.word}"`).join(' · ')}`); }

    // ---- C, HOLDFIRE.stackSet OFF (how a recording from before a held man counted as set replays): the same pair on its marks with its guns held on men is NOT
    //      set — not arrived, no 'set.', the row not 'stacked' — and the key raised in the same run sets it (the control: nothing else differs)
    { const R = await stand('roomclear=7&squad=2', true), g = R.g, O = g.orders, d = R.door('breakroom_n'), dw = R.door('breakroom_w'); let secs = 0, there = false, rounds = 0, arr = 0, n = 0; HF.HOLDFIRE.stackSet = false;
      dw.angle = (dw.swing ?? 1) > 0 ? dw.maxA : dw.minA; dw.latched = false; dw.vel = 0; dw.quietT = -3600; g.teleportPlayer([30.75, 0, 14.4]); rounds += play(R, 1, null).all;
      const w = O.give('stack', O.targetAt(d.frameCentre));
      for (; secs < 30 && !there; secs++) { rounds += play(R, 1, null).all; there = living(R).every((o: any) => { const A = O.of(o); return A?.order === 'stack' && !!A.post && flat(o.char.pos, A.post) < 0.35 && HF.holdFireOnMan(g, o); }); }
      const T = play(R, 8, null, true, null, () => { for (const o of living(R)) { n++; if (O.of(o)?.arrived) arr++; } }); rounds += T.all; freeze(R);
      const men = living(R).map((o: any) => { const A = O.of(o); return { o, order: A?.order, arrived: !!A?.arrived, said: !!A?.setSaid, stamp: !!A?.heldFire, mark: A?.post ? flat(o.char.pos, A.post) : NaN, rule: HF.holdFireOnMan(g, o) as boolean, word: O.statusOf(o) as string }; });
      const off = men.length === 2 && men.every((m: any) => m.order === 'stack' && !m.arrived && !m.said && !m.stamp && m.mark < 0.35 && m.rule && !m.word.startsWith('stacked'));
      HF.HOLDFIRE.stackSet = true; const T2 = play(R, 2, null); rounds += T2.all; freeze(R);
      const on = living(R).length === 2 && living(R).every((o: any) => O.of(o)?.arrived && O.of(o).setSaid && (O.statusOf(o) as string).startsWith('stacked'));
      line(!w && there && off && arr === 0 && T.held > 0 && on && rounds === 0 && Math.abs(d.angle) < 0.05,
        `C · HOLDFIRE.stackSet OFF, the same pair on its marks with its guns held on men, 8 s: NOT set — nobody arrived, no 'set.', the row not 'stacked', as before the key; the key raised in the same run: set`,
        `${w ? `refused: ${w}` : 'given'} · on their marks and held on a man after ${secs} s ${there} · man-frames counted arrived ${arr}/${n} · held ${T.held} frames · ${men.map((m: any) => `${m.o.callsign}: ${m.mark.toFixed(2)} m off his mark, held on a man by the rule ${m.rule}, arrived ${m.arrived}, set said ${m.said}, "${m.word}"`).join(' · ')} · with the key raised, 2 s on: set, 'set.' said, 'stacked' ${on} (${living(R).map((o: any) => `"${O.statusOf(o)}"`).join(' ')}) · team rounds ${rounds}`); }

    // ---- C, the door LOCKED and the handle rule on (DOORTOOLS.testDoor, as shipped): set and held on a man, the lead does not try the handle — no door noise for the
    //      man to hear, nobody says 'locked' — and the pair STAYS set with Sam walking through their line and Sam low (the sneak's hold answers first there)
    { const R = await stand('roomclear=7&squad=2', true), g = R.g, O = g.orders, d = R.door('breakroom_n'), dw = R.door('breakroom_w'); let secs = 0, set = false; DOORTOOLS.testDoor = true;   // (after the stand-up: the frozen stand holds it off)
      dw.angle = (dw.swing ?? 1) > 0 ? dw.maxA : dw.minA; dw.latched = false; dw.vel = 0; dw.quietT = -3600; g.teleportPlayer([30.75, 0, 14.4]); play(R, 1, null);
      d.locked = true; d.latched = true; d.keySide = g.doors.side(d, R.pos);   // (locked against the side they stack on)
      const said: string[] = [], say0 = g.say; g.say = function (this: any, gd: any, text: string, ...r: any[]) { said.push(text); return say0.call(this, gd, text, ...r); };
      let rattles = 0; const rattle0 = g.doors.rattle; g.doors.rattle = function (this: any, ...a: any[]) { rattles++; return rattle0.apply(this, a); };   // (a handle worked in its frame, from the order on)
      const w = O.give('stack', O.targetAt(d.frameCentre)), tested0 = g.doorTools.stats.tested; const walk: number[][] = [];   // (door noises on the way to the marks: the handle was tried BEFORE 'set.', so the count runs from the order — at THIS door: a leaf brushed on the walk in is not it)
      for (; secs < 30 && !set; secs++) { walk.push(...play(R, 1, null).doorAt); set = living(R).every((o: any) => O.of(o)?.order === 'stack' && O.of(o).arrived); }
      const T: Tally[] = []; let left = 0, onMan = 0, n = 0; const each = () => { for (const o of living(R)) { n++; if (!O.of(o)?.arrived) left++; if (HF.holdFireOnMan(g, o)) onMan++; } };
      const m = living(R)[0], t = g.fight.opOf(m)?.tgt, home = [...R.pos], mid = t ? [(m.char.pos[0] + t.char.pos[0]) / 2, 0, (m.char.pos[2] + t.char.pos[2]) / 2] : home;
      T.push(play(R, 6, null, true, null, each)); T.push(play(R, 10, [home, [2 * mid[0] - home[0], 0, 2 * mid[2] - home[2]]], true, null, each)); R.goal = home; T.push(play(R, 3, null, true, null, each)); R.goal = null;
      const u0 = U.UNSEEN_STATS.held; R.crouch(true); T.push(play(R, 6, null, true, null, each)); const sneak = U.UNSEEN_STATS.held - u0; R.crouch(false);
      const sum = (k: 'all' | 'door' | 'loud') => T.reduce((a, x) => a + x[k], 0), sets = said.filter(x => x === 'set.').length, locked = said.filter(x => /locked/.test(x)).length, tested = g.doorTools.stats.tested - tested0, atDoor = walk.filter(p => !(flat(p, d.frameCentre) > 1.5)).length;
      line(!w && set && DOORTOOLS.testDoor && g.doors.lockedOut(d, R.pos) && sum('all') === 0 && sum('loud') === 0 && atDoor === 0 && sum('door') === 0 && rattles === 0 && tested === 0 && locked === 0 && sets === 1 && left === 0 && onMan === n && sneak > 0 && Math.abs(d.angle) < 0.05,
        `C · the same on a LOCKED door, 25 s set (standing, Sam walking through their line, Sam low): no hand on the handle while the guns are held on a man — no noise at that door from the order on, nobody says 'locked' — the pair never leaves 'stacked', 'set.' said once`,
        `${w ? `refused: ${w}` : 'given'} · set ${set} after ${secs} s · team rounds ${sum('all')} · noises at the door on the walk to the marks ${atDoor} (elsewhere ${walk.length - atDoor}: ${walk.filter(p => flat(p, d.frameCentre) > 1.5).map(p => `${p[0].toFixed(1)},${p[2].toFixed(1)}`).join(' ') || 'none'}; the door at ${d.frameCentre[0].toFixed(1)},${d.frameCentre[2].toFixed(1)}), any door once set ${sum('door')} · handles rattled since the order ${rattles}, tried ${tested} · 'locked' said ${locked} · 'set.' said ${sets} · man-frames not arrived ${left}/${n}, held on a man by this rule ${onMan}/${n} · the sneak's hold answered on ${sneak} frames with Sam low · other loud events ${sum('loud')} · leaf angle ${d.angle.toFixed(2)}`);
      // … and THE FRAME THE MEN THEY ARE HELD ON ARE LOST (every one of them down, quietly): the handle is tried only once the lead's gun is the door's again —
      //     his gun as testStacks sees it, the frame before each try (doortools.ts runs before the orders' tick: read off the stamp, not asked afresh)
      { const t1 = g.doorTools.stats.tested, s1 = said.length, r1 = rattles; let tried = -1, worst = NaN, i = 0, pre: number[] = [];
        const guns = () => living(R).filter((o: any) => O.of(o)?.stance === 'stack' && O.of(o).watch).map((o: any) => gunOff(o, O.of(o).watch));
        const before = Math.max(0, ...guns()); for (const h of foes(R)) killGuard(g, h, [0, 0, 1], true);
        const eachB = () => { if (tried < 0 && g.doorTools.stats.tested > t1) { tried = i - 1; worst = Math.max(0, ...pre); } pre = guns(); i++; };
        const TB = play(R, 15, null, false, null, eachB); eachB(); const lockedB = said.slice(s1).filter(x => /locked/.test(x)).length;
        line(before > 0.2 && tried > 0 && worst < 0.2 && lockedB === 1 && rattles - r1 === 1 && TB.all === 0,
          `C · the men they were held on are gone (the same pair, the same locked door): the lead's hand goes to the handle only with his gun back on the door — not on the frame his man is lost — and he says what he found`,
          `the stacked lead's gun ${before.toFixed(2)} rad off his door when they went down · handle tried ${tried < 0 ? 'never in 15 s' : `${((tried + 1) / 60).toFixed(2)} s after (step ${tried})`}, his gun ${worst.toFixed(2)} rad off the door the frame before · 'locked' said ${lockedB} · handles rattled ${rattles - r1} · team rounds ${TB.all}`); }
      DOORTOOLS.testDoor = was.test; g.say = say0; g.doors.rattle = rattle0; }

    // ---- C, only the SECOND man held (one man left in the room and the lead's eyes out — dazzled: the room fight gives a blind man nobody, so his gun goes back
    //      to the door and he is stacked the plain way): the locked door's handle is still not tried, no 'locked', no door noise for the held, unaware man to hear
    //      — and with HOLDFIRE.stackWait OFF (how a recording from before the wait replays) the lead, no longer held himself, tries it as he did: once, with the second still held
    for (const wait of [true, false]) { const R = await stand('roomclear=7&squad=2', true), g = R.g, O = g.orders, d = R.door('breakroom_n'), dw = R.door('breakroom_w'); let secs = 0, set = false; DOORTOOLS.testDoor = true; HF.HOLDFIRE.stackWait = wait;
      dw.angle = (dw.swing ?? 1) > 0 ? dw.maxA : dw.minA; dw.latched = false; dw.vel = 0; dw.quietT = -3600; g.teleportPlayer([30.75, 0, 14.4]); play(R, 1, null);
      d.locked = true; d.latched = true; d.keySide = g.doors.side(d, R.pos);
      const said: string[] = [], say0 = g.say; g.say = function (this: any, gd: any, text: string, ...r: any[]) { said.push(text); return say0.call(this, gd, text, ...r); };
      let rattles = 0; const rattle0 = g.doors.rattle; g.doors.rattle = function (this: any, ...a: any[]) { rattles++; return rattle0.apply(this, a); };
      const w = O.give('stack', O.targetAt(d.frameCentre)), tested0 = g.doorTools.stats.tested;
      for (; secs < 30 && !set; secs++) { play(R, 1, null); set = living(R).every((o: any) => O.of(o)?.order === 'stack' && O.of(o).arrived); }
      const lead = living(R).find((o: any) => O.of(o)?.stance === 'stack'), second = living(R).find((o: any) => o !== lead), keep = second ? g.fight.opOf(second)?.tgt : null;
      if (w || !set || !lead || !second || !keep) line(false, `C · only the second man held: not staged — ${w ?? `set ${set}, a lead ${!!lead}, a second man ${!!second} with a man in his sight ${!!keep}`}`); else {
        const early = g.doorTools.stats.tested - tested0; for (const h of foes(R)) if (h !== keep) killGuard(g, h, [0, 0, 1], true);
        let n = 0, sec = 0, ld = 0, door = 0, left = 0, tryAt = -1, tryOff = NaN, pre = NaN, preSec = false, trySec = false;
        const each = () => { if (tryAt < 0 && g.doorTools.stats.tested > tested0) { tryAt = n - 1; tryOff = pre; trySec = preSec; } lead.dazzledUntil = g.time + 1; n++; const A = O.of(lead); pre = A?.watch ? gunOff(lead, A.watch) : NaN; preSec = !!O.of(second)?.heldFire || HF.holdFireOnMan(g, second);
          if (HF.holdFireOnMan(g, second)) sec++; if (HF.holdFireOnMan(g, lead)) ld++; if (A?.arrived && pre < 0.2) door++; if (!O.of(second)?.arrived) left++; };
        const T = play(R, 12, null, true, null, each); if (tryAt < 0 && g.doorTools.stats.tested > tested0) { tryAt = n - 1; tryOff = pre; trySec = preSec; } const tested = g.doorTools.stats.tested - tested0, locked = said.filter(x => /locked/.test(x)).length;
        line(wait ? early === 0 && T.all === 0 && T.loud === 0 && sec === n && ld < 30 && door > n / 2 && left === 0 && keep.state === 'patrol' && tested === 0 && rattles === 0 && locked === 0 && T.door === 0 && Math.abs(d.angle) < 0.05
          : early === 0 && tested === 1 && rattles === 1 && locked === 1 && tryAt >= 0 && trySec && Math.abs(d.angle) < 0.05,
          wait ? `C · only the SECOND man held on a man, the lead stacked with his gun on the LOCKED door, 12 s: no hand on the handle — nobody says 'locked', no noise at any door for the held man to hear`
          : `C · the same with HOLDFIRE.stackWait OFF (stackSet on): the lead, his own man lost and the second man still held, tries the locked handle as before the key (his own fresh answer alone keeps his hand off) — tried once, rattled once, 'locked' said once`,
          `set after ${secs} s · ${second.callsign} held on ${keep.callsign} by this rule ${sec}/${n} frames, off 'stacked' ${left} · the lead ${lead.callsign}: held on a man ${ld}/${n} frames, stacked with his gun on the door ${door}/${n} · handles tried ${tested} (before the staging ${early}${tryAt < 0 ? '' : `; at step ${tryAt}, the lead's gun ${tryOff.toFixed(2)} rad off the door the frame before, the second man held ${trySec}`}), rattled ${rattles} · 'locked' said ${locked} · door noises ${T.door} · team rounds ${T.all} · other loud events ${T.loud} · leaf angle ${d.angle.toFixed(2)} · ${HF.holdFireSummary(g)}`); }
      DOORTOOLS.testDoor = was.test; g.say = say0; g.doors.rattle = rattle0; }

    // ---- 4 · 5 · 6: an order by its id, found means found, the lift's end — asked at the start, where no teammate has a man in sight
    { const R = await stand('roomclear=7&squad4', true), g = R.g; freeze(R);
      const a = holdsAll(R); HF.holdFireOrder(g, 'move'); HF.holdFireOrder(g, 'silent'); const b = !HF.holdFireLifted(g);
      HF.holdFireOrder(g, 'fragThere'); const c = HF.holdFireLifted(g) && !holdsAny(R) && HF.HOLDFIRE_STATS.lifts.order === 1;
      line(a && b && c, `4 · an order noted by id: 'fragThere' starts the fight for every man; 'move' and 'silent' do not`, `held for all at the start ${a} · not lifted by move / silent ${b} · lifted by fragThere, nobody held ${c} · ids that lift: ${HF.LIFT_ORDERS.join(' ')}`);
      // 6: it runs out
      HF.HOLDFIRE.liftSecs = 3; R.wait(1); freeze(R); const mid = HF.holdFireLifted(g); HF.holdFireOrder(g, 'stunThere'); R.wait(2.5); freeze(R); const kept = HF.holdFireLifted(g) && HF.HOLDFIRE_STATS.lifts.order === 1; R.wait(1); freeze(R);
      const back = !HF.holdFireLifted(g) && holdsAll(R);
      HF.holdFireRestore(g, { liftT: g.time + 100, why: 'shot' }); const stale = !HF.holdFireLifted(g);
      const snap0 = HF.holdFireSnapshot(g); HF.holdFireOrder(g, 'bangClear'); const snap = HF.holdFireSnapshot(g); HF.holdFireRestore(g, null); const cleared = !HF.holdFireLifted(g); HF.holdFireRestore(g, snap); const again = HF.holdFireLifted(g);
      line(mid && kept && back && stale && snap0 === null && cleared && again, `6 · the lift lasts liftSecs after the LAST shot or order, then the hold is back; a stamp from ahead of the clock is no lift; the snapshot / restore pair carries it`,
        `(liftSecs 3) lifted at 1 s ${mid} · a second order at 1 s keeps it to 3.5 s as one lift ${kept} · held again at 4.5 s ${back} · stale stamp ignored ${stale} · snapshot null when nothing is lifted ${snap0 === null} · restore(null) clears ${cleared} · restore(snapshot) lifts ${again}`);
      Object.assign(HF.HOLDFIRE, was.hf, { on: !BREAK });
      g.restartEncounter(); R.step(30); freeze(R); const fresh = !HF.holdFireLifted(g) && HF.holdFireSnapshot(g) === null && holdsAll(R);
      line(fresh, `6 · a restart resets it: nothing lifted, every man holds`, `${HF.holdFireSummary(g)}`);
      // 5: found
      const h = foes(R)[0]; h.state = 'alert'; h.awareness = 1; h.lastSeenT = g.time; const roused = !holdsAny(R); h.state = 'patrol'; h.awareness = 0; h.lastSeenT = -100; const calm = holdsAll(R);
      h.awareness = SL.SILENT.noticed + 0.05; const one = living(R).every((o: any) => !SL.silentHolds(g, o, h)); const others = foes(R).length < 2 || living(R).every((o: any) => foes(R).filter((x: any) => x !== h).every((x: any) => SL.silentHolds(g, o, x))); h.awareness = 0;
      g.fight.opOf(living(R)[0]).hotT = g.time; const heard = !holdsAny(R);
      const lw = g.rescue.lastWarning; g.fight.opOf(living(R)[0]).hotT = -100; const calm2 = holdsAll(R); g.rescue.lastWarning = () => true; const urgent = !holdsAny(R); g.rescue.lastWarning = lw;
      line(roused && calm && one && others && heard && calm2 && urgent, `5 · found means found: one defender roused with eyes on them, or gunfire in ONE teammate's ears, and no man of the squad holds; a man who has noticed is shot while the others are still held on; a captor's last warning holds nothing`,
        `a defender alert who has seen them → nobody holds ${roused} · calm again → all hold ${calm} · a man past the noticed bar is not held ${one}, the rest still are ${others} · one teammate hears gunfire → nobody holds ${heard} · last warning → nobody holds ${urgent}`); }
    // 5, played: at the doorway, held — then the room's men are on them
    { const R = await stand('roomclear=7&squad4', true), ends = runway(R); const why = toDoorway(R);
      if (why) line(false, `5 · the move was refused — ${why}`); else { const T0 = play(R, 13, ends); for (const h of foes(R)) { h.state = 'alert'; h.awareness = 1; h.lastSeenT = R.g.time; } const T = play(R, 10, null, false);
        line(T0.all === 0 && quiet(T0) && T0.held > 0 && T.all > 0 && T.held === 0, `5 · played: held at the doorway, then the room's men are on them — the team shoots from that moment`, `${T0.all} team rounds before (${T0.held} frames held; ${qw(T0)}) · ${T.all} rounds in the 10 s after, ${T.held} frames held · up ${living(R).length}/${R.ops.length}`); } }

    // ---- 7: a silent squad is the silent order's own
    { const run = async (on: boolean) => { const R = await stand('roomclear=7&squad4', on); const w0 = R.g.orders.give('silent', { kind: 'none', at: [R.pos[0], 0, R.pos[2]] }); R.step(5); const w1 = toDoorway(R); const T = play(R, 18, null);
        return { why: w0 ?? w1, T, sil: SL.SILENT_STATS.held as number, hf: HF.HOLDFIRE_STATS.held as number, d: R.digest, silent: SL.squadSilent(R.g) as boolean }; };
      const a = await run(true), b = await run(false);
      line(!a.why && a.silent && a.T.all === 0 && a.sil > 0 && a.hf === 0 && a.d === b.d, `7 · a SILENT squad: held by the silent order's own rule (its count, none of this file's), and the run digests the same with this switch on and off`,
        `${a.why ? `refused: ${a.why}` : ''} silent ${a.silent} · ${a.T.all} rounds · SILENT_STATS.held ${a.sil} · HOLDFIRE_STATS.held ${a.hf} · digest on ${a.d} · off ${b.d}`); }

    // ---- L: 'go loud' told to a SILENT squad starts the fight (HOLDFIRE.loud) — and only that
    { const here = (R: Run) => ({ kind: 'none', at: [R.pos[0], 0, R.pos[2]] });
      /** a squad told silent, sent to the doorway, 12 s held there by the silent order's own rule — then told loud by the ORDER, and 12 s more (`low`: Sam
       *  crouched from 2 s before the order to the end — the sneak's hold, unseen.ts, is then the first to answer for a loud squad) */
      const told = async (loud: boolean, low = false) => { const R = await stand('roomclear=7&squad4', true), g = R.g, O = g.orders; HF.HOLDFIRE.loud = loud;
        const w0 = O.give('silent', here(R)); R.step(5); const w1 = toDoorway(R); const T0 = play(R, 12, null); freeze(R); const sil = SL.squadSilent(g) as boolean, silHeld = SL.SILENT_STATS.held as number;
        if (low) { R.crouch(true); T0.all += play(R, 2, null).all; freeze(R); } const u0 = U.UNSEEN_STATS.held as number;
        const w2 = O.give('loud', here(R)); freeze(R); const out = !SL.squadSilent(g), lifted = HF.holdFireLifted(g) as boolean, lifts = HF.HOLDFIRE_STATS.lifts.order as number, any = holdsAny(R), every = holdsAll(R), what = HF.HOLDFIRE_LOG[HF.HOLDFIRE_LOG.length - 1]?.what;
        // (the 'loud' lift's own stamp rides the snapshot: cleared, an older save's stamp without it, and its own way back)
        const snap = HF.holdFireSnapshot(g), was = !!HF.holdFireLoud?.(g); HF.holdFireRestore(g, null); const gone = !HF.holdFireLoud?.(g); if (snap) HF.holdFireRestore(g, { liftT: snap.liftT, why: snap.why }); const older = !HF.holdFireLoud?.(g) && (!snap || HF.holdFireLifted(g)); HF.holdFireRestore(g, snap);
        const saved = was === lifted && gone && older && !!HF.holdFireLoud?.(g) === lifted && (snap?.loudT === undefined) === !lifted;
        const T = play(R, 12, null); const sneak = U.UNSEEN_STATS.held - u0, down = !!R.pl.crouch; if (low) R.crouch(false);
        return { R, why: w0 ?? w1 ?? w2, T0, T, sil, silHeld, out, lifted, lifts, any, every, what, sneak, down, saved }; };
      const a = await told(true);
      line(!a.why && a.sil && a.T0.all === 0 && quiet(a.T0) && a.silHeld > 0 && a.out && a.lifted && a.lifts === 1 && a.what === 'loud' && !a.any && a.T.all > 0 && a.T.held === 0,
        `L · a SILENT squad holding on unaware men, told 'go loud' by the order: the fight is on for every man, and a round goes`,
        `${a.why ? `refused: ${a.why} · ` : ''}silent ${a.sil}, 12 s: team rounds ${a.T0.all}, held by the silent rule ${a.silHeld} (${qw(a.T0)}) · told loud: out of silent ${a.out} · lifted ${a.lifted} · lifts by order ${a.lifts} ('${a.what ?? ''}') · anybody still held ${a.any} · team rounds in the next 12 s ${a.T.all} · held frames after ${a.T.held}`);
      const b = await told(false);
      line(!b.why && b.sil && b.T0.all === 0 && b.out && !b.lifted && b.lifts === 0 && b.every && b.T.all === 0 && quiet(b.T) && b.T.held > 0,
        `L · the same with HOLDFIRE.loud OFF: told loud, the squad is loud and unfound — still held, not a round`,
        `${b.why ? `refused: ${b.why} · ` : ''}silent ${b.sil}, 12 s: team rounds ${b.T0.all} · told loud: out of silent ${b.out} · lifted ${b.lifted} · lifts by order ${b.lifts} · every man held ${b.every} · team rounds in the next 12 s ${b.T.all} (${qw(b.T)}) · held frames ${b.T.held}`);
      // Sam LOW (how a silent squad is usually led): loud, the sneak's hold answers before this rule's — while the lift his 'go loud' made stands it holds nobody either
      const c = await told(true, true);
      line(!c.why && c.sil && c.down && c.T0.all === 0 && c.out && c.lifted && c.lifts === 1 && !c.any && c.sneak === 0 && c.T.all > 0 && c.T.held === 0 && c.saved,
        `L · the same with Sam CROUCHED when he says it: the sneak's hold does not keep them either — the fight is on for every man, and a round goes`,
        `${c.why ? `refused: ${c.why} · ` : ''}silent ${c.sil}, Sam low ${c.down}: team rounds before ${c.T0.all} · told loud: out of silent ${c.out} · lifted ${c.lifted} · lifts by order ${c.lifts} · anybody still held ${c.any} · held by the sneak's rule after ${c.sneak} · team rounds in the next 12 s ${c.T.all} · held frames after ${c.T.held} · the 'loud' stamp in the snapshot, gone on restore(null), absent from an older save, back with its own ${c.saved}`);
      const e = await told(false, true);
      line(!e.why && e.sil && e.down && e.T0.all === 0 && e.out && !e.lifted && e.lifts === 0 && e.every && e.T.all === 0 && quiet(e.T) && e.sneak > 0 && e.saved,
        `L · Sam crouched, HOLDFIRE.loud OFF: told loud, still held (by the sneak's hold, as before the key) — not a round`,
        `${e.why ? `refused: ${e.why} · ` : ''}silent ${e.sil}, Sam low ${e.down}: team rounds before ${e.T0.all} · told loud: out of silent ${e.out} · lifted ${e.lifted} · every man held ${e.every} · held by the sneak's rule ${e.sneak} · team rounds in the next 12 s ${e.T.all} (${qw(e.T)})`);
      // … and ONLY that lift: an order that means fire, noted by id, with Sam low — this rule is lifted and the sneak's hold holds exactly as it did
      { const R = await stand('roomclear=7&squad4', true), g = R.g; const w1 = toDoorway(R); const T0 = play(R, 10, null); R.crouch(true); T0.all += play(R, 2, null).all; freeze(R);
        const u0 = U.UNSEEN_STATS.held as number; HF.holdFireOrder(g, 'fragThere'); freeze(R); const lifted = HF.holdFireLifted(g) as boolean, loud = !!HF.holdFireLoud?.(g), every = holdsAll(R);
        const T = play(R, 8, null); const sneak = U.UNSEEN_STATS.held - u0; freeze(R); const still = HF.holdFireLifted(g) && holdsAll(R); R.crouch(false);
        line(!w1 && T0.all === 0 && lifted && !loud && every && T.all === 0 && quiet(T) && sneak > 0 && T.held === 0 && still,
          `L · a lift that is NOT his 'go loud' (a fire order by id), Sam crouched: this rule is lifted and the sneak's hold keeps every man as it did — not a round`,
          `${w1 ? `refused: ${w1} · ` : ''}team rounds before ${T0.all} · 'fragThere': lifted ${lifted}, a 'loud' lift ${loud} · every man still held ${every} · 8 s: team rounds ${T.all} (${qw(T)}), held by the sneak's rule ${sneak}, by this rule ${T.held} · still lifted and held at the end ${still}`); }
      // never silent: 'go loud' told to a loud squad is nothing; nor is a silent squad taken out by anything but the order (the panel's / a staging's setSilent)
      { const R = await stand('roomclear=7&squad4', true), g = R.g, O = g.orders, ends = runway(R); const w1 = toDoorway(R); const T0 = play(R, 10, null); freeze(R);
        const w2 = O.give('loud', here(R)); freeze(R); const said = !HF.holdFireLifted(g) && holdsAll(R); const T1 = play(R, 8, null); freeze(R);
        SL.setSilent(g, true, 'api'); R.step(5); const sil = SL.squadSilent(g) as boolean; SL.setSilent(g, false, 'api'); freeze(R); const api = sil && !SL.squadSilent(g) && !HF.holdFireLifted(g) && holdsAll(R);
        HF.holdFireOrder(g, 'loud'); HF.holdFireOrder(g, 'loud', { silent: false }); const byId = !HF.holdFireLifted(g); const T2 = play(R, 8, null); freeze(R);
        const none = HF.HOLDFIRE_STATS.lifts.order === 0 && HF.HOLDFIRE_STATS.lifts.shot === 0 && holdsAll(R);
        const D = ends[1], shot = samShot(R, [D[0] + (D[0] - ends[0][0]), 1.2, D[2] + (D[2] - ends[0][2])]); freeze(R); const fired = shot.n === 1 && HF.holdFireLifted(g) && HF.HOLDFIRE_STATS.lifts.shot === 1 && !holdsAny(R);
        line(!w1 && !w2 && T0.all === 0 && said && T1.all === 0 && api && byId && T2.all === 0 && quiet(T2) && T2.held > 0 && none && fired,
          `L · a squad that was NEVER silent told 'go loud', and a silent one taken out by anything but that order: nothing lifted, not a round — they hold until Sam's shot`,
          `${w1 || w2 ? `refused: ${w1 ?? w2} · ` : ''}team rounds ${T0.all} before · 'loud' told to a loud squad → still held ${said}, ${T1.all} rounds in 8 s · silent then loud by setSilent (not the order) → still held ${api} · the id noted with no silent squad behind it → not lifted ${byId} · ${T2.all} rounds in 8 s more (${qw(T2)}), held ${T2.held} frames, no lift counted ${none} · then his one round → lifted for all ${fired}`); }
      // the journal: HOLDFIRE is one of a recording's own tables (JOURNAL_KNOBS), so the key rides there — as recorded; a recording from before the key = off
      { const R = await stand('roomclear=7&squad4', true), g = R.g, J: any = await import(`${ROOT}/src/game/journal.ts`), KN: any = await import(`${ROOT}/src/game/knobs.ts`), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g))), all = KN.knobsCopy();
        try {
          HF.HOLDFIRE.loud = true; const old = snap(); delete old.tables.HOLDFIRE.loud; J.applyKnobs(g, old); const before = HF.HOLDFIRE.loud, onKept = HF.HOLDFIRE.on;
          HF.HOLDFIRE.loud = true; const recOn = snap(); HF.HOLDFIRE.loud = false; J.applyKnobs(g, recOn); const kept = HF.HOLDFIRE.loud;
          HF.HOLDFIRE.loud = false; const recOff = snap(); HF.HOLDFIRE.loud = true; J.applyKnobs(g, recOff); const keptOff = HF.HOLDFIRE.loud;
          line(before === false && onKept === old.tables.HOLDFIRE.on && kept === true && keptOff === false && recOn.tables.HOLDFIRE?.loud === true && KN.JOURNAL_KNOBS.includes('HOLDFIRE'),
            `L · CONTROL (plumbing, not the rule: HOLDFIRE_BREAK does not touch it) — a recording carries HOLDFIRE.loud in its own tables: one from before the key (the hold on or off in it) replays with the key off, one made with it on replays on, off off`,
            `a recording without the key: ${before}, its own HOLDFIRE.on kept ${onKept === old.tables.HOLDFIRE.on} · recorded on: ${kept} · recorded off: ${keptOff} · in the recording's HOLDFIRE table: ${recOn.tables.HOLDFIRE?.loud} · HOLDFIRE in JOURNAL_KNOBS ${KN.JOURNAL_KNOBS.includes('HOLDFIRE')}`);
        } finally { KN.knobsBack(all); } }
      // … and the stack's two sub-keys (stackSet / stackWait), which came AFTER the behaviour they gate: a recording with no HOLDFIRE row, or a row from before
      //   `loud`, replays with both off; a row with `loud` and no `stackSet` (the build that set a held pair and kept the lead's hand off) with stackSet ON and
      //   stackWait off; a row with the keys as recorded. The live table stands the opposite way before each, and is put back after
      { const R = await stand('roomclear=7&squad4', true), g = R.g, J: any = await import(`${ROOT}/src/game/journal.ts`), KN: any = await import(`${ROOT}/src/game/knobs.ts`), H = HF.HOLDFIRE, all = KN.knobsCopy(), live = JSON.stringify(H);
        /** a recording made with the table as `made`, its HOLDFIRE row then without `drop` (null: no row at all), applied over a live table standing as `stood` */
        const replay = (made: any, drop: string[] | null, stood: any) => { Object.assign(H, { on: true, loud: true }, made); const s = JSON.parse(JSON.stringify(J.knobsSnapshot(g))); if (drop) for (const k of drop) delete s.tables.HOLDFIRE[k]; else delete s.tables.HOLDFIRE;
          Object.assign(H, stood); J.applyKnobs(g, s); return `${H.stackSet}/${H.stackWait}`; };
        const T = { stackSet: true, stackWait: true }, F = { stackSet: false, stackWait: false }; let got: string[] = [], carried = false;
        try {
          got = [replay(T, null, T), replay(T, ['loud', 'stackSet', 'stackWait'], T), replay(T, ['stackSet', 'stackWait'], { stackSet: false, stackWait: true }), replay(F, ['stackSet', 'stackWait'], { stackSet: false, stackWait: true }),
            replay(T, ['stackWait'], T), replay(T, [], F), replay(F, [], T), replay({ stackSet: true, stackWait: false }, [], { stackSet: false, stackWait: true })];
          Object.assign(H, T); const rec = J.knobsSnapshot(g).tables.HOLDFIRE; carried = rec?.stackSet === true && rec?.stackWait === true;
        } finally { KN.knobsBack(all); }
        const back = JSON.stringify(H) === live;
        line(got.join(' ') === 'false/false false/false true/false true/false true/false true/true false/false true/false' && carried && back && KN.JOURNAL_KNOBS.includes('HOLDFIRE'),
          `C · CONTROL (plumbing, not the rule: HOLDFIRE_BREAK does not touch it) — a recording without the stack's sub-keys replays as it was made: no HOLDFIRE row, or a row from before \`loud\`, both off; a row with \`loud\` and no \`stackSet\`, stackSet ON and stackWait off; keys recorded, as recorded; the live table put back`,
          `stackSet/stackWait after applyKnobs — no HOLDFIRE row: ${got[0]} · a row without loud: ${got[1]} · with loud, no stackSet / stackWait (made on): ${got[2]}, (made off: the keys were not there to be read) ${got[3]} · stackSet recorded on, no stackWait: ${got[4]} · both recorded on over a live off: ${got[5]} · both off over a live on: ${got[6]} · on / off over off / on: ${got[7]} · a new recording's row carries both ${carried} · the live table as before the line ${back}`); } }

    // ---- 8: switch off — inert
    { const R = await stand('roomclear=7&squad4', false), g = R.g; HF.HOLDFIRE.on = false; zero(); freeze(R);
      HF.holdFireOrder(g, 'openClear'); HF.holdFireShot(g, g.player.char); HF.holdFireDrill(g);
      const h = foes(R)[0], m = living(R)[0];
      const inert = !HF.holdFireLifted(g) && !HF.holdFireHolds(g, m, h, 0.5, false, () => false) && !HF.holdFireGlass(g, m) && !holdsAny(R) && HF.holdFireSnapshot(g) === null && HF.holdFireSummary(g) === 'off';
      const S = HF.HOLDFIRE_STATS, none = S.held === 0 && S.heldGlass === 0 && S.lifts.shot === 0 && S.lifts.order === 0 && S.lifts.drill === 0 && HF.HOLDFIRE_LOG.length === 0;
      line(inert && none, `8 · switch off: nothing lifts, nothing holds, every count zero`, `inert ${inert} · stats ${JSON.stringify(S)}`); }
  } catch (e: any) { line(false, `the check stopped — ${e?.stack ?? e}`); }
  finally { Object.assign(HF.HOLDFIRE, was.hf); Object.assign(U.UNSEEN, was.un); FRIENDS.lowReady = was.low; Math.random = was.rnd; DOORTOOLS.testDoor = was.test; }
  console.log(all ? '\n=== holdfire-check: ALL PASS ===' : '\n=== holdfire-check: FAILED ===');
  return all;
}

if (import.meta.main) process.exit((await holdfireCheck()) ? 0 : 1);
