// A GUARD'S ATTENTION, TAKEN AT ONE SPOT OF A QUIET MISSION — src/game/attention.ts (ATTENTION.on) played where a player would use it: the quiet yard
// (levels/quiet-yard.json), the quiet mission as a bare `?quiet` link deals it on the page (the first of each list: in by the west gate, the ledger in the radio
// room, the yard man and the bunkhouse man on shift), alone and with the one partner (`&squad=1`).
//   bun run tools/qa/attention-spot.ts [--seeds 1,2,3] [--trace]        (one bun, about 25 s a seed; --trace prints every arm's timeline)
// THE SPOT. The yard man (the route `yard`) walks the lit strip under the buildings, comes down through the dark corner inside the west gate and goes back along
// the bottom wall. A scripted Sam ON HIS OWN FEET (W A S D and Space, as tools/qa/solo-night.ts walks him — not Game.puppet, under which the room fight is off:
// upright, at the walk, never crouched, never sprinting) eases the west gate, steps into the gap between the bunk room and the perimeter wall (HIDE: dark, the
// bunk room's corner between him and the whole route) and waits. His way on is the bunk room's yard door, five metres along the building's wall from the mouth of
// that gap: the CROSSING, three seconds at the walk. The lure goes to the yard's dark corner short of the bottom wall (LURE), as the man walks away from it along
// that wall: he comes back to it facing the perimeter wall, the crossing 32° to 71° to the side of what he looks at and five and a half metres off.
//   ring     the ring airfoil's clack (launcher.ts: a 'prop' event of RING.clackNoise with nobody behind it, `lure`). Switch off, it does not move him: the base build;
//   knock    a plain knock, `lure` unset, of level KNOCK with nobody behind it (a thing gone over): loud enough that the base build's man goes to look too — the
//            arm that sets the held eye beside the old look round the room, the man at the thing on both;
//   whistle  Sam walks out to LURE behind the man's back and whistles (whistle.ts tryWhistle: the V key's own call). Printed for what it does, with no crossing:
//            the man who answers it turns with his torch and has Sam in the open inside a second, switch on or off — and from the gap a whistle brings him to the
//            mouth of the gap, which is where the crossing starts. This spot has no whistle that Sam can then walk away from.
// The lure filed, Sam comes up the gap to the last spot its corner still covers (READY); once the man is AT the thing (attentionOf(…).until >= 0; an arm with no
// hold leaves at the second the switch-on arm, alone, measured) he steps to the mouth and walks the crossing, then stands six seconds at the door. Per arm: did
// the man's fix land within a metre of Sam (or of the partner) in the crossing, his peak awareness in it, did he go 'alert', what he said, how long the hold
// lasted and whether the floor mark (the list ui/attentionviz.ts draws) was up for all of it.
// Sam's light meter is fed every frame from the CPU's estimate of the direct light on him (guards.ts lightEstimateAt, his own lights skipped: no bounce, no moon
// — the harness has no GPU meter). It reads this crossing BLACK (0.00), and a man in the black is taken in at no rate at all: so the crossing as the level lights
// it shows the lure's pull and the look AT the thing, not the narrowed eye. The arms marked PINNED play the same crossing with the meter held at PIN from the
// mouth of the gap on — not this level's light: what the held eye is worth where such a stretch is half lit. They are printed, never asserted.
// The same seed and the same script on both arms; the switch is thrown by hand (it is off on the harness's stand); SAMESTART on, as the page has it.
// WHAT A PASS LINE CLAIMS: only what held on every seed asked for. A difference between the arms is PRINTED ('measured, nothing asserted'), not claimed.
// AS TWO IT FAILS, AND SAYS WHY: with a partner on the floor the room fight is live (roomfight.ts: any operative unit) and attention.ts able() takes no man's
// attention while it is — no hold, no mark, on either lure; the ring's clack does not bring the man, the knock is answered as the base build answers it. The
// 'takes his attention' line is left asserted for the pair so that this prints FAIL until it is so; one diagnostic arm throws ROOMFIGHT.on off to show the cause.
// WHAT THIS DOES NOT SHOW: nothing here has been seen on a GPU or played by a person. No picture, no sound, a light meter without bounce or moon, and one script
// against one patrol: a player a second early or late meets a different angle.   exit 0 = every claim holds · 1 = one does not (today: the pair's)
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');
const LEVEL = 'quiet-yard.json', PIN = 0.35, KNOCK = 0.6;
type P3 = [number, number, number];
/** the places, in the level's own metres (x, z) */
const GATE_OUT: P3 = [7.0, 0, 14.25], GATE_IN: P3 = [9.7, 0, 14.3], MOUTH: P3 = [9.3, 0, 12.7], HIDE: P3 = [8.9, 0, 9.0], READY: P3 = [9.5, 0, 10.9], LURE: P3 = [12.0, 0, 18.4], OUT: P3 = [10.2, 0, 14.2], DOOR: P3 = [13.8, 0, 12.75];

function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2), at = (p: number[]) => `(${f1(p[0])}, ${f1(p[2])})`;

type Lure = 'ring' | 'knock' | 'whistle';
interface Arm { ok: boolean; leave: number; seed: number; found: string; fight: boolean; pin: number | null; why: string; lure: Lure; on: boolean; mate: boolean; deal: string; man: string; wayIn: number; lureT: number; heard: boolean; manAtLure: number; arrive: number; go: number; manAtGo: number; manState: string;
  walk: number; dwell: number; holdFrames: number; marked: number; fogged: number; ended: string; cross: { secs: number; reached: boolean; fix: boolean; fixMate: boolean; peak: number; aw0: number; alert: boolean; states: string; near: number; seen: number; cone: number; offMin: number; offMax: number; lit: number; litMax: number; frames: number };
  after: { peak: number; alert: boolean; fix: boolean; lit: number }; pre: { peak: number; alert: boolean; fix: boolean }; down: boolean; manDown: boolean; lines: string[]; others: number; mateAt: string; trace: string[] }

export async function attentionSpot(seeds: number[] = [1, 2, 3], trace = false): Promise<boolean> {
  const { standUp } = await import('./headless.ts');
  const { ATTENTION, attentionOf, attentionOffDeg, attentionMarks } = await import(`${ROOT}/src/game/attention.ts`);
  const { canSee, lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
  const { RING } = await import(`${ROOT}/src/game/launcher.ts`);
  const { tryWhistle } = await import(`${ROOT}/src/game/whistle.ts`);
  const { SAMESTART } = await import(`${ROOT}/src/game/samestart.ts`);
  const { ROOMFIGHT } = await import(`${ROOT}/src/game/roomfight.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const DT = 1 / 60, rnd0 = Math.random, was = { ...ATTENTION }, same0 = SAMESTART.on, fight0 = ROOMFIGHT.on; let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  const note = (s: string, detail = '') => console.log(`- PASS — (measured, nothing asserted) ${s}${detail ? `\n    ${detail}` : ''}`);

  /** one arm: the level stood up, the quiet mission started as the bare link deals it, the script played. `goAt` (the switch-off arm): seconds after the lure
   *  at which the switch-on arm of the same seed left the gap */
  async function arm(seed: number, lure: Lure, on: boolean, mate: boolean, goAt = -1, pin: number | null = null, noFight = false): Promise<Arm> {
    const A: Arm = { ok: false, leave: -1, seed, found: '', fight: false, pin, why: '', lure, on, mate, deal: '', man: '', wayIn: 0, lureT: -1, heard: false, manAtLure: -1, arrive: -1, go: -1, manAtGo: -1, manState: '', walk: 0, dwell: 0, holdFrames: 0, marked: 0, fogged: 0, ended: '',
      cross: { secs: 0, reached: false, fix: false, fixMate: false, peak: 0, aw0: 0, alert: false, states: '', near: 99, seen: 0, cone: 0, offMin: 999, offMax: -1, lit: 0, litMax: 0, frames: 0 }, after: { peak: 0, alert: false, fix: false, lit: 0 }, pre: { peak: 0, alert: false, fix: false }, down: false, manDown: false, lines: [], others: 0, mateAt: '', trace: [] };
    Math.random = seeded(seed);
    const W: any = await quiet(() => standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', LEVEL), 'utf8'))) }));
    const g = W.game, I = W.input, cam = W.cam; ATTENTION.on = on; SAMESTART.on = true; ROOMFIGHT.on = !noFight;   // (samestart.ts: on in the page — a bare ?quiet is the first of each of the block's lists)
    const r = await quiet(() => startFromQuery(g, `?quiet${mate ? '&squad=1' : ''}`)); if (r.why) { A.why = `the quiet mission did not start: ${r.why}`; return A; }
    { const Q = g.quiet, d = Q.deal; A.deal = `the deal: start ${d.start + 1}, ${Q.thing} in ${Q.spot?.holder}, ${Q.spot?.place}, on shift: ${Q.patrol.join(', ')}; ${mate ? 'the partner up' : 'alone'}`; }   // (its own words but the start's name: no compass word in a printed line)
    const ops: any[] = g.quiet.ops, staff: any[] = g.guards.filter((x: any) => !ops.includes(x)), K = staff.find((x: any) => g.level.routes[x.routeI]?.name === 'yard');
    if (!K) { A.why = 'no man on the route `yard` in this deal'; return A; } A.man = K.callsign;
    const pos = (): number[] => g.player.char.pos, bone = (c: any, b: string, h: number): P3 => c.bones?.[b] ?? [c.pos[0], c.pos[1] + h, c.pos[2]];
    let t = 0, goal: P3 | null = null, phase = 'in', lastLine = '', hadHold = false;
    const say = (s: string) => { const l = `${t.toFixed(1).padStart(6)}  ${s}`; A.trace.push(l); };
    const C = A.cross;
    function step(n = 1) { for (let i = 0; i < n; i++) {
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k);
      if (goal) { const dx = goal[0] - pos()[0], dz = goal[2] - pos()[2], d = Math.hypot(dx, dz); if (d > 0.1) { const { fwd, right } = cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827; if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); } }
      { const c = g.player.char, own = (o: number) => o === PLAYER_ID; g.player.visibility = g.visibilityOf(Math.max(lightEstimateAt(g, bone(c, 'chest', 1.2), own), lightEstimateAt(g, bone(c, 'head', 1.6), own))); if (pin !== null && (phase === 'cross' || phase === 'after')) g.player.visibility = pin; }
      W.step(DT); t += DT;
      // what the yard man does, every frame of the run
      const H = attentionOf(g, K), w = K.bubble && g.time - K.bubble.t < DT * 1.5 ? String(K.bubble.text) : '';
      if (w && w !== lastLine && A.lureT >= 0) { A.lines.push(w); say(`   ${K.callsign}: '${w}'`); } lastLine = w || (K.bubble && g.time - K.bubble.t < 3 ? lastLine : '');
      if (H) { hadHold = true; A.holdFrames++; if (H.until >= 0) A.dwell += DT; else A.walk += DT; if (g.fogOfWar.hidden(K)) A.fogged++; else if (attentionMarks(g).some((m: any) => m.gd === K)) A.marked++; }
      for (const x of staff) if (x !== K && x.state !== 'patrol') A.others++;
      const fixOn = (p: number[]) => !!K.lastKnown && flat(K.lastKnown, p) < 1.0;
      if (phase === 'in') A.wayIn = Math.max(A.wayIn, ...staff.map((x: any) => x.awareness));
      if (phase === 'wait') { A.pre.peak = Math.max(A.pre.peak, K.awareness); A.pre.alert ||= K.state === 'alert'; A.pre.fix ||= fixOn(pos()); }
      A.down ||= !!g.player.down; A.manDown ||= K.state === 'dead' || !!K.ko;
      if (phase === 'cross' || phase === 'after') { const Z = phase === 'cross' ? null : A.after, v = canSee(g, K);
        if (Z) { Z.peak = Math.max(Z.peak, K.awareness); Z.alert ||= K.state === 'alert'; Z.fix ||= fixOn(pos()); Z.lit = Math.max(Z.lit, g.player.visibility); }
        else { C.frames++; C.peak = Math.max(C.peak, K.awareness); C.alert ||= K.state === 'alert'; C.fix ||= fixOn(pos()); if (ops[0]) C.fixMate ||= fixOn(ops[0].char.pos); if (!C.states.split(' → ').includes(K.state)) C.states += (C.states ? ' → ' : '') + K.state;
          C.near = Math.min(C.near, v.dist); if (v.visible) C.seen++; if (v.inCone) C.cone++; const o = attentionOffDeg(g, K, pos() as P3); if (o !== null) { C.offMin = Math.min(C.offMin, o); C.offMax = Math.max(C.offMax, o); }
          C.lit += g.player.visibility; C.litMax = Math.max(C.litMax, g.player.visibility); } }
    } }
    const until = (pred: () => boolean, secs: number): boolean => { for (let i = 0; i < secs * 60 && !pred(); i++) step(); return pred(); };
    /** walk the legs in turn; false when `secs` run out short of the last */
    const go = (legs: P3[], secs: number): boolean => { const t0 = t; for (const p of legs) { goal = p; W.cursorAt([p[0], 1.1, p[2]]); if (!until(() => flat(pos(), p) < (p === legs[legs.length - 1] ? 0.3 : 0.5) || t - t0 > secs, secs + 1) || t - t0 > secs) { goal = null; return false; } } goal = null; return true; };
    const where = () => `${K.callsign} at ${at(K.char.pos)} ${K.state}, awareness ${f2(K.awareness)}`;

    await quiet(async () => {
      step(20); say(`${A.deal}`); say(`Sam at ${at(pos())}, ${where()}${ops[0] ? `, the partner at ${at(ops[0].char.pos)}` : ''}`);
      // ---- in: the west gate eased, into the gap beside the bunk room
      const gate = g.doors.byName('gate_w'); go([GATE_OUT], 6);
      for (let i = 0; i < 90 && gate.isClosed(); i++) { W.cursorAt([gate.frameCentre[0], 1.0, gate.frameCentre[2]]); step(); if (g.nearby.some((x: any) => x.kind === 'door' && x.door === gate && x.verb === 'ease') && g.selectVerb('door', 'ease')) { I.pressed.add('Space'); step(2); until(() => Math.abs(gate.angle) > 0.9, 4); } }
      if (gate.isClosed()) { A.why = `the gate did not give (rows: ${g.nearby.map((x: any) => `${x.kind}:${x.verb}`).join(' ') || 'none'})`; return; }
      if (!go([GATE_IN, MOUTH, HIDE], 14)) { A.why = `Sam never reached the gap (at ${at(pos())})`; return; }
      say(`Sam in the gap at ${at(pos())}, light ${f2(g.player.visibility)}; ${where()}; a line to him: ${canSee(g, K).visible}`);
      // ---- the lure, as the man walks away along the bottom wall
      const along = (x: number) => K.state === 'patrol' && K.char.pos[2] > 19.3 && K.char.pos[0] >= x;
      if (lure !== 'whistle') {
        if (!until(() => along(15.5), 90)) { A.why = `${K.callsign} never came along the bottom wall (${where()})`; return; }
        g.events.push(lure === 'ring' ? { kind: 'prop', pos: [LURE[0], 0, LURE[2]], time: g.time, loud: false, level: RING.clackNoise, who: 0, lure: true } : { kind: 'prop', pos: [LURE[0], 0, LURE[2]], time: g.time, loud: false, level: KNOCK, who: 0 });
      } else {
        if (!until(() => K.state === 'patrol' && K.char.pos[2] > 18.3 && K.char.pos[0] > 11.5, 90)) { A.why = `${K.callsign} never came along the bottom wall (${where()})`; return; }
        if (!go([MOUTH, OUT, LURE], 12)) { A.why = `Sam never reached the corner (at ${at(pos())})`; return; }
        if (!tryWhistle(g)) { A.why = 'the whistle was refused'; return; }
      }
      A.lureT = t; A.manAtLure = flat(K.char.pos, LURE); phase = 'wait'; say(`THE LURE (${lure}) at ${at(LURE)}: ${where()}, ${f1(A.manAtLure)} m from it; Sam at ${at(pos())}`);
      step(60); A.heard = K.state !== 'patrol'; A.fight = !!g.fight?.live;
      if (lure !== 'whistle') go([READY], 5);   // up the gap to its last spot the corner still covers from the lure, against the bunk room's wall say(`a second on: ${where()}${attentionOf(g, K) ? ', his attention taken' : ''}`);
      if (lure === 'whistle') {   // back the way he came — and what the man who answers it does to him on the way (no crossing is played on this arm: see the header)
        phase = 'cross'; const back = go([OUT, MOUTH], 10); let hit = false; until(() => { hit ||= (g.player.hitFlash ?? 0) > 0; return false; }, 6);
        A.found = `${K.callsign} ${f1(A.manAtLure)} m off when it is blown; ${A.heard ? 'he answers it' : 'he does not answer it'}; ${C.alert ? 'ALERT' : 'no alert'}, fix on Sam ${C.fix ? 'YES' : 'no'}, peak awareness ${f2(C.peak)}; Sam ${g.player.down ? 'DOWN' : hit ? 'hit' : 'unhurt'}${back ? ', back at the mouth of the gap' : `, stopped at ${at(pos())}`}; the light on Sam at its highest ${f2(C.litMax)}; said: ${A.lines.join(' / ') || '—'}`;
        say(A.found); A.ok = true; return; }
      // ---- he is at the thing (switch on: the hold's clock is running; switch off: the same second after the lure) and Sam is at the mouth of the gap
      if (on && hadHold) { if (!until(() => { const H = attentionOf(g, K); return !!H && H.until >= 0; }, 16)) { A.why = `${K.callsign} never got to the thing (${where()}; ${attentionOf(g, K) ? 'held, walking' : 'the hold ended on the way'})`; return; } A.arrive = t - A.lureT; }
      else until(() => t - A.lureT >= goAt - 1e-6, 30);
      A.leave = t - A.lureT;   // (no hold to wait on — the switch off, or on and nothing taken: the second the caller hands over)
      if (A.down || A.pre.alert) { say(`FOUND BEFORE THE CROSSING: ${where()}, fix ${K.lastKnown ? at(K.lastKnown) : '—'}; Sam ${g.player.down ? 'down' : 'up'} at ${at(pos())}`); until(() => false, 6); A.down ||= !!g.player.down; A.ended = K.state; A.go = t - A.lureT; A.ok = true; return; }
      if (!go([MOUTH], 6)) { if (g.player.down) { A.down = true; A.ok = true; A.ended = K.state; return; } A.why = `Sam never got back to the mouth of the gap (at ${at(pos())})`; return; }
      A.go = t - A.lureT; A.manAtGo = flat(K.char.pos, LURE); A.manState = K.state; C.aw0 = K.awareness;
      say(`THE CROSSING from ${at(pos())}: ${where()}, ${f1(A.manAtGo)} m from the lure, ${f1(flat(K.char.pos, pos()))} m from Sam${ops[0] ? `; the partner at ${at(ops[0].char.pos)}` : ''}`);
      phase = 'cross'; const t0 = t; C.reached = go([DOOR], 9); C.secs = t - t0;
      say(`at the bunk room's door ${at(pos())} after ${f1(C.secs)} s: ${where()}, fix ${K.lastKnown ? at(K.lastKnown) : '—'}, light on Sam ${f2(g.player.visibility)}`);
      // ---- six seconds stood at the door (the hold runs out under him)
      phase = 'after'; let ended = -1; until(() => { if (ended < 0 && hadHold && !attentionOf(g, K)) { ended = t; say(`   the hold is over: ${where()}`); } return false; }, 6);
      A.ended = K.state; say(`six seconds on: ${where()}, fix ${K.lastKnown ? at(K.lastKnown) : '—'}`);
      if (ops[0]) A.mateAt = `${ops[0].state === 'dead' ? 'down' : ops[0].state} at ${at(ops[0].char.pos)}, ${f1(flat(ops[0].char.pos, pos()))} m from Sam`;
      A.ok = true;
    });
    return A;
  }

  const head = (a: Arm) => `${a.lure}, ${a.mate ? 'as two' : 'alone'}, switch ${a.on ? 'ON ' : 'OFF'}${a.pin !== null ? `, meter pinned ${a.pin}` : ''}`;
  const nums = (a: Arm) => { const c = a.cross; return !a.ok ? `DID NOT PLAY: ${a.why}` : !c.frames ? `FOUND IN THE GAP BEFORE THE CROSSING (${a.man} at the thing${a.pre.alert ? ', ALERT' : ''}${a.pre.fix ? ', his fix on Sam' : ''}, peak awareness ${f2(a.pre.peak)}); Sam ${a.down ? 'DOWN' : 'up'}; then ${a.ended}; said: ${a.lines.join(' / ') || '—'}${a.manDown ? `; ${a.man} is down` : ''}` : `went ${f1(a.go)} s after the lure with ${a.man} ${f1(a.manAtGo)} m from it (${a.manState}); crossed in ${f1(c.secs)} s${c.reached ? '' : ' (NOT reached)'}; fix on Sam ${c.fix ? 'YES' : 'no'}${a.mate ? `, on the partner ${c.fixMate ? 'YES' : 'no'}` : ''}; awareness ${f2(c.aw0)} → peak ${f2(c.peak)}; alert ${c.alert ? 'YES' : 'no'}; ${c.states}; nearest ${f1(c.near)} m, a clear line ${c.seen} of ${c.frames} frames (in his cone ${c.cone})${c.offMax >= 0 ? `, ${c.offMin.toFixed(0)}° to ${c.offMax.toFixed(0)}° off the thing` : ''}; Sam's light mean ${f2(c.lit / Math.max(1, c.frames))} max ${f2(c.litMax)}; the hold: walking ${f1(a.walk)} s, at it ${f2(a.dwell)} s, marked ${a.marked} of ${a.holdFrames} frames; six seconds stood at the door: peak ${f2(a.after.peak)}, alert ${a.after.alert ? 'YES' : 'no'}, his fix written at Sam ${a.after.fix ? 'YES' : 'no'} (the light on Sam there up to ${f2(a.after.lit)}), then ${a.ended}; Sam ${a.down ? 'DOWN' : 'up'}${a.manDown ? `, ${a.man} DOWN` : ''}; said: ${a.lines.join(' / ') || '—'}${a.mate ? `; the partner ${a.mateAt}` : ''}`; };
  const per = (as: Arm[]) => as.map((a, i) => `seed ${seeds[i]}: ${nums(a)}`).join('\n    ');
  const spotted = (a: Arm) => a.cross.fix || a.cross.alert || a.cross.fixMate || a.pre.alert || a.down || a.after.alert;

  console.log(`\n=== attention-spot: the yard man's attention taken inside the gate Sam comes in by, the quiet yard (${LEVEL}, ?quiet), seeds ${seeds.join(', ')} ===`);
  const goOf: Record<string, number> = {};   // the second after the lure the switch-on arm, alone, left the gap: every arm with no hold of its own to wait on goes then
  const show = (as: Arm[]) => { if (trace) for (const a of as) { console.log(`  --- ${head(a)}`); for (const l of a.trace) console.log(`  ${l}`); } };
  const NAME: Record<Lure, string> = { ring: 'the ring\'s clack', knock: `a knock of level ${KNOCK}`, whistle: 'the whistle' };
  try {
    for (const mate of [false, true]) for (const lure of ['ring', 'knock'] as Lure[]) {
      const ons: Arm[] = [], offs: Arm[] = [], who = mate ? 'as two' : 'alone', secs = ATTENTION.noiseSecs;
      for (const seed of seeds) { const k = `${lure}:${seed}`, on = await arm(seed, lure, true, mate, goOf[k] ?? 6); if (!mate && on.ok) goOf[k] = on.leave; const off = await arm(seed, lure, false, mate, goOf[k] ?? 6); ons.push(on); offs.push(off); show([on, off]); }
      const played = [...ons, ...offs].every(a => a.ok);
      line(played, `${lure}, ${who}: the script plays to the bunk room's door on both arms of every seed`, `${ons[0].deal}${played ? '' : '\n    ' + [...ons, ...offs].filter(a => !a.ok).map(a => `${head(a)}: ${a.why}`).join('\n    ')}`);
      if (!played) continue;
      line(ons.every(a => a.arrive > 0 && a.manAtGo < 1.6 && Math.abs(a.dwell - secs) < 0.1 && a.walk > 0.3), `${lure}, ${who}, ON: ${NAME[lure]} takes the yard man's attention, he goes to it in the yard's dark corner and looks at it for its ${secs} seconds`,
        ons.map((a, i) => `seed ${seeds[i]}: filed with him ${f1(a.manAtLure)} m from it${a.holdFrames ? `, at it ${f1(a.arrive)} s later (${f1(a.manAtGo)} m off it), held walking ${f1(a.walk)} s, at it ${f2(a.dwell)} s` : `: NO HOLD TAKEN (he ${a.heard ? 'goes to look as the base build does' : 'does not come'}; the room fight is ${a.fight ? 'LIVE — attention.ts able() takes no man\'s attention while it is, and roomfight.ts is live whenever an operative unit is on the floor' : 'not live'})`}`).join('\n    '));
      if (ons.every(a => !a.holdFrames)) {   // nothing was taken: what follows is the base build on both arms — printed, with nothing more to claim for the rule
        note(`${lure}, ${who}, ON (no hold: the base build)`, per(ons)); note(`${lure}, ${who}, OFF`, per(offs)); }
      else {
      line(ons.every(a => a.holdFrames > 0 && a.marked > 0 && a.marked === a.holdFrames - a.fogged), `${lure}, ${who}, ON: a floor mark is up for every frame of the hold in which the fog of war shows the man at all`, ons.map((a, i) => `seed ${seeds[i]}: ${a.marked} of ${a.holdFrames - a.fogged} frames (${a.fogged} more with him in the fog: nothing of him is drawn then)`).join(' · '));
      line(ons.every(a => a.cross.reached && !a.cross.fix && !a.cross.fixMate && !a.cross.alert && !a.pre.alert && !a.down && !a.after.alert && !a.manDown), `${lure}, ${who}, ON: Sam walks the five metres from the gap to the bunk room's door, upright, with no fix on him${mate ? ' or the partner' : ''} in the crossing, and no alert then or in the six seconds he stands at the door`, per(ons));
      if (lure === 'ring') line(offs.every(a => !a.heard && a.manAtGo > 3), `${lure}, ${who}, OFF: the same clack does not bring him (the base build)`, per(offs));
      else note(`${lure}, ${who}, OFF: the same knock, the same second`, per(offs));
      }
      note(`${lure}, ${who}: the arms side by side`, `Sam found (the man's fix on him${mate ? ' or the partner' : ''} in the crossing, an alert, or Sam down): ON ${ons.filter(spotted).length} of ${seeds.length} seeds, OFF ${offs.filter(spotted).length} of ${seeds.length}; per seed, found with the switch off and not with it on: ${ons.map((a, i) => spotted(offs[i]) && !spotted(a) ? 'yes' : 'no').join(', ')}; others of the shift off their beat (frames, ON / OFF): ${ons.map((a, i) => `${a.others} / ${offs[i].others}`).join(', ')}; highest awareness of any man on Sam's way in: ${ons.map(a => f2(a.wayIn)).join(', ')}`);
      if (!mate) {   // the same crossing AS IF HALF LIT: the meter pinned from the mouth of the gap on (the CPU estimate reads this stretch black; the page's meter, with the moon and the bounce, has not been read here)
        const lon: Arm[] = [], loff: Arm[] = []; for (const seed of seeds) { const k = `${lure}:${seed}`; lon.push(await arm(seed, lure, true, false, goOf[k] ?? 6, PIN)); if (lure === 'knock') loff.push(await arm(seed, lure, false, false, goOf[k] ?? 6, PIN)); } show([...lon, ...loff]);
        note(`${lure}, alone, ON, Sam's meter PINNED at ${PIN} from the mouth of the gap on (not this level's light: what the held eye is worth where such a stretch IS half lit)`, per(lon));
        if (loff.length) { note(`${lure}, alone, OFF, the meter pinned the same`, per(loff));
          note(`${lure}, alone, pinned: the arms side by side`, `his fix on Sam in the crossing, ON / OFF: ${lon.map((a, i) => `${a.cross.fix ? 'yes' : 'no'} / ${loff[i].cross.fix ? 'yes' : 'no'}`).join(', ')}; seconds of the hold he gave it before it broke (of ${ATTENTION.noiseSecs}), ON: ${lon.map(a => f2(a.dwell)).join(', ')}; alert in the crossing, ON / OFF: ${lon.map((a, i) => `${a.cross.alert ? 'yes' : 'no'} / ${loff[i].cross.alert ? 'yes' : 'no'}`).join(', ')}; peak awareness ON / OFF: ${lon.map((a, i) => `${f2(a.cross.peak)} / ${f2(loff[i].cross.peak)}`).join(', ')}`); }
      } else if (lure === 'ring') {   // a diagnostic, not a stand anybody plays: the same arm with the room fight's own switch off
        const d = await arm(seeds[0], 'ring', true, true, goOf[`ring:${seeds[0]}`] ?? 6, null, true); show([d]);
        note(`ring, as two, ON, with ROOMFIGHT.on thrown off by hand (a diagnostic: nobody plays that stand)`, `seed ${seeds[0]}: ${d.holdFrames ? `the hold IS taken (${d.marked} of ${d.holdFrames} frames marked); ` : 'no hold either; '}${nums(d)}`);
      }
    }
    // the whistle (alone): Sam walks out to the same corner behind the man's back, blows it and walks back
    { const ws: Arm[] = []; for (const seed of seeds) for (const on of [true, false]) ws.push(await arm(seed, 'whistle', on, false)); show(ws);
      note('whistle, alone: blown from the same corner, in the open (what the man who answers it does; no crossing is played)', ws.map(a => `seed ${a.seed} ${a.on ? 'ON ' : 'OFF'}: ${a.ok ? a.found : `DID NOT PLAY: ${a.why}`}`).join('\n    ')); }
  } finally { Object.assign(ATTENTION, was); SAMESTART.on = same0; ROOMFIGHT.on = fight0; Math.random = rnd0; }
  console.log(`=== attention-spot: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
if (import.meta.main) { const argv = process.argv.slice(2), i = argv.indexOf('--seeds'); process.exit((await attentionSpot(i >= 0 ? argv[i + 1].split(',').map(Number) : [1, 2, 3], argv.includes('--trace'))) ? 0 : 1); }
