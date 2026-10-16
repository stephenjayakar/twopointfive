// The `hands` probes (src/game/hands.ts) — `bun run tools/qa/probes.ts hands`, or one of hands-body / hands-door / hands-team / hands-harness / hands-off.
// Staged headless on the real Game, on Training lesson 1 (levels/train-move.json: one man in the yard, the hut whose door opens INTO it), with the doors as the
// page has them (one-way, staying where they are left) and HANDS.on raised by the probe itself — the frozen stand holds it off (TPS_HANDS=1).
//   hands-body     the 'second time' bug (the head end of a body offers no row with the switch off, and does with it on) · a body is taken up by its beats
//                  (reach → rise → carry; no pin before the lift) from the feet AND from the head, hauled over a metre from either with both hands on the
//                  limbs he has, laid down (pins lowered before they come off), and taken again from the other end — never 'wedged'
//   hands-door     the hut door worked from four spots inside it (it opens toward him: the tight room) and two outside: the leaf never passes through him and
//                  never stands in him, it ends open, his hand comes onto it, it makes the row's one creak; then shut from where that left him: latched
//   hands-off      the switch off: no Haul, no DoorMove, the ankle pins on the frame of the tap, the leaf flung by Doors.use — and (documented, not wanted)
//                  the leaf passing through him from inside the hut
//   hands-team     a door somebody ELSE works (HANDS.team): the squad's lead ordered to open a door has his hand on the leaf on the frame his shove moves it, on a
//                  push face and on a pull face; a man who pulls a leaf to has a hand on it while it is in his reach; with the row off neither has, and the
//                  leaf moves on the same frames either way
//   hands-harness  the frozen stand holds it off, the page turns it on unless ?nohands, the table is a registered knob table a recording carries
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { bodyDist } = await import(`${ROOT}/src/game/player.ts`);
const { HANDS } = await import(`${ROOT}/src/game/hands.ts`);
const { MOVES } = await import(`${ROOT}/src/game/character.ts`);
const { DOORWAY, DOORSTAY } = await import(`${ROOT}/src/game/doors.ts`);
const { RAG } = await import(`${ROOT}/src/game/ragdoll.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60, LEVEL = 'train-move';
let allPass = true;
const verdict = (pass: boolean, what: string, detail = '') => { console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${what}${pass || !detail ? '' : `\n    ${detail}`}`); if (!pass) allPass = false; };
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x)), wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const f2 = (x: number) => x.toFixed(2), fp = (p: ArrayLike<number>) => `${f2(p[0])},${f2(p[2])}`;

/** the lesson stood up as the page plays it (one-way doors that stay, the quiet scenario started), the switch as asked; everything put back by `keep` */
async function rig(hands: boolean) {
  const log = console.log, warn = console.warn; console.log = console.warn = () => {};
  let W: any;
  try {
    DOORWAY.oneWay = true;
    W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${LEVEL}.json`, 'utf8'))), seed: 1 });
    DOORSTAY.on = true; HANDS.on = hands;
    startFromQuery(W.game, `?levelFile=${LEVEL}.json&quiet&difficulty=hard`);
  } finally { console.log = log; console.warn = warn; }
  const g = W.game, I = W.input, msgs: string[] = []; const om = g.msg.bind(g); g.msg = (s: string, ...a: any[]) => { msgs.push(s); return om(s, ...a); };
  g.aiEnabled = false; g.godMode = true; g.playerInvisible = true;
  const step = (n = 1, keys: string[] = [], each?: () => void) => { for (let i = 0; i < n; i++) { for (const k of keys) I.keys.add(k); W.step(DT); for (const k of keys) I.keys.delete(k); each?.(); } };
  const tap = (each?: () => void) => { I.keys.add('Space'); I.pressed.add('Space'); W.step(DT); I.keys.delete('Space'); each?.(); step(2, [], each); };
  /** the movement key that carries him along a floor direction, by the camera's own basis (his keys are the camera's) */
  const keyFor = (dir: number[]): string => { const { fwd, right } = W.cam.planarBasis(); const s = (k: number[]) => k[0] * dir[0] + k[2] * dir[2]; const c: [string, number][] = [['KeyW', s(fwd)], ['KeyS', -s(fwd)], ['KeyD', s(right)], ['KeyA', -s(right)]]; c.sort((a, b) => b[1] - a[1]); return c[0][0]; };
  /** the floor direction a movement key carries him along */
  const dirOf = (key: string): Vec3 => { const { fwd, right } = W.cam.planarBasis(); const d = key === 'KeyW' ? fwd : key === 'KeyS' ? v3.scale(fwd, -1) : key === 'KeyD' ? right : v3.scale(right, -1); return v3.normalize([d[0], 0, d[2]]); };
  /** metres of floor his own circle has along a direction before a static stops it (≤ 4): a walk staged with it goes where there is room, whatever the level stands round the spot */
  const freeM = (from: Vec3, d: Vec3): number => { for (let m = 0.25; m <= 4; m += 0.25) { const q: Vec3 = [from[0] + d[0] * m, 0, from[2] + d[2] * m], p = v3.copy(q); if (g.col.collideCircle(q, 0.34, 0.25, 1.5, 1) && v3.distXZ(q, p) > 0.005) return m - 0.25; } return 4; };
  /** the key with the most floor ahead of it from a spot, of those offered */
  const openKey = (from: Vec3, keys: string[] = ['KeyW', 'KeyS', 'KeyD', 'KeyA']): string => keys.map(k => [k, freeM(from, dirOf(k))] as [string, number]).sort((x, y) => y[1] - x[1])[0][0];
  step(30);
  return { W, g, I, msgs, step, tap, keyFor, dirOf, freeM, openKey };
}
async function keep(fn: () => Promise<boolean>): Promise<boolean> {
  const was = { on: HANDS.on, body: HANDS.body, door: HANDS.door, carry: HANDS.carry, ride: HANDS.carryRide, nearM: HANDS.carryNearM, stepM: HANDS.stepM, roundM: HANDS.roundM, oneWay: DOORWAY.oneWay, stay: DOORSTAY.on };
  try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; }
  finally { HANDS.on = was.on; HANDS.body = was.body; HANDS.door = was.door; HANDS.carry = was.carry; HANDS.carryRide = was.ride; HANDS.carryNearM = was.nearM; HANDS.stepM = was.stepM; HANDS.roundM = was.roundM; DOORWAY.oneWay = was.oneWay; DOORSTAY.on = was.stay; }
}

/** the one man of the lesson put out cold where he stands and left to settle; helpers round his ragdoll */
function body(R: Awaited<ReturnType<typeof rig>>) {
  const { g, step } = R; const gd = g.guards[0]; killGuard(g, gd, [1, 0, 0], true); step(150);
  const rag = gd.char.ragdoll, P = (i: number): Vec3 => rag.point(i), mid = (a: number, b: number): Vec3 => v3.lerp(P(a), P(b), 0.5);
  const feet = () => mid(RAG.ankL, RAG.ankR), head = () => mid(RAG.shoL, RAG.shoR), hips = () => P(RAG.pelvis);
  /** a spot `m` beyond an end of him, on the line from his hips through it */
  const beyond = (end: 'feet' | 'head', m: number): Vec3 => { const a = end === 'feet' ? feet() : head(), h = hips(); const d = v3.normalize([a[0] - h[0], 0, a[2] - h[2]]); return [a[0] + d[0] * m, 0, a[2] + d[2] * m]; };
  return { gd, rag, P, mid, feet, head, hips, beyond };
}
const hasRow = (g: any, verb: string) => g.nearby.some((r: any) => r.kind === 'body' && r.verb === verb && r.inReach !== false && !r.off);

// ================================================================ a body
export async function handsBody(): Promise<boolean> { return keep(async () => {
  console.log('\n=== hands-body: a body is picked up from wherever he stands at it and carried over the shoulder, upright; put down on the floor; picked up again. Along the floor (the carry off, or no room for it): taken by the end he is at, both hands on it ===');
  allPass = true;
  // (a) the reach: 0.9 m beyond the shoulders, the old reach (ankles, hips) offers nothing — the 'second time' — and the switch offers the row
  { const R = await rig(false), B = body(R), { g, step } = R; const at = B.beyond('head', 0.9);
    g.teleportPlayer(at); step(8); const off = { d: bodyDist(g, B.gd, 9), row: hasRow(g, 'drag') };
    HANDS.on = true; step(3); const on = { d: bodyDist(g, B.gd, 9), row: hasRow(g, 'drag') };
    verdict(!off.row && off.d >= 1.3 && on.row && on.d < 1.3, 'standing at the HEAD of a body: the switch off offers no row (the bug: nothing the second time, come back from the far end), on offers the row',
      `off: reach ${f2(off.d)} row ${off.row} · on: reach ${f2(on.d)} row ${on.row} · stood at ${fp(at)}, shoulders ${fp(B.head())}, feet ${fp(B.feet())}`); }
  // (b) OVER THE SHOULDER (the page's default): three pick-ups in a row on one body — from its feet, from its head, from beside it
  { const R = await rig(true), B = body(R), { g, step, tap, msgs, dirOf, freeM, openKey } = R, pl = g.player, c = pl.char;
    const hipMid = (): Vec3 => B.mid(RAG.hipL, RAG.hipR), label = () => g.nearby.find((r: any) => r.kind === 'body' && (r.verb === 'drag' || r.verb === 'drop'))?.line2 ?? '';
    let n = 0;
    for (const from of ['feet', 'head', 'side'] as const) {
      n++; const tag = `pick-up ${n} (from ${from === 'side' ? 'beside him' : 'his ' + from})`;
      if (from === 'side') { const h = hipMid(), t = v3.normalize(v3.sub(B.P(RAG.spine), h)); g.teleportPlayer([h[0] + t[2] * 0.75, 0, h[2] - t[0] * 0.75]); } else g.teleportPlayer(B.beyond(from, from === 'feet' ? 0.8 : 0.9));
      step(8); msgs.length = 0; const word = label(), sel = g.selectVerb('body', 'drag');
      const phases: string[] = []; let early = false, y0 = 0, lowHead = 9;
      const watch = () => { const h = pl.haul; if (!h) return; if (phases[phases.length - 1] !== h.phase) phases.push(h.phase); if (h.phase === 'reach') { if (!y0) y0 = hipMid()[1]; else if (hipMid()[1] > y0 + 0.05) early = true; } };
      tap(watch); step(240, [], watch);
      const up = hipMid()[1] - c.pos[1], head = c.bones.head[1] - c.pos[1], lGap = c.anim.haul ? v3.dist(c.bones.handL, c.anim.haul.l) : 9;
      verdict(sel && /pick him up/.test(word) && !!pl.dragging && !!pl.haul?.carry && phases.join('>') === 'reach>rise>carry' && !early && Math.abs(up - HANDS.carryUp) < 0.08 && !pl.crouch && head > 1.4 && lGap < 0.1 && B.rag.strain < 0.1,
        `${tag}: the row reads 'pick him up'; reach → rise → carry, nothing lifted before he is at it; then its hips are on his shoulder, he stands upright under it with his hand on its legs`,
        `row '${word}' selected ${sel} · dragging ${!!pl.dragging} · over the shoulder ${!!pl.haul?.carry} · beats ${phases.join('>')} · lifted during the reach ${early} · hips ${f2(up)} m up (want ${HANDS.carryUp}) · crouched ${pl.crouch} · head ${f2(head)} m · hand ↔ legs ${f2(lGap)} · strain ${f2(B.rag.strain)} · msgs ${msgs.join(' / ')}`);
      // walk off with it for 2.5 s, then turn square off that line for 1.5 s: it rides on his shoulder, he stays upright, his hand stays on it. He walks where the
      // level has floor (the way with the most room, then the roomier of the two turns off it) and what is asked is the ground his feet covered: the third
      // pick-up starts wherever the first two left the body, and a walk aimed off the body's own lie met whatever a level stood there
      const p0 = v3.copy(c.pos), key = openKey(c.pos), d1 = dirOf(key), run = Math.min(freeM(c.pos, d1), 2.2);
      const key2 = openKey([c.pos[0] + d1[0] * run, 0, c.pos[2] + d1[2] * run], key === 'KeyW' || key === 'KeyS' ? ['KeyD', 'KeyA'] : ['KeyW', 'KeyS']);
      let frames = 0, on = 0, off = 0, strain = 0, path = 0; lowHead = 9; let last = v3.copy(c.pos);
      const ride = () => { path += v3.distXZ(last, c.pos); last = v3.copy(c.pos); const h = pl.haul; if (!h || h.phase !== 'carry' || !c.anim.haul) return; frames++; lowHead = Math.min(lowHead, c.bones.head[1] - c.pos[1]); if (v3.dist(c.bones.handL, c.anim.haul.l) < 0.12) on++;
        off = Math.max(off, v3.distXZ(hipMid(), c.pos)); strain = Math.max(strain, B.rag.strain); };
      step(150, [key], ride); step(90, [key2], ride); step(30, [], ride);
      const walked = v3.distXZ(p0, c.pos), wedged = msgs.some(m => /wedged/.test(m));
      verdict(!!pl.dragging && path > 2.2 && walked > 1 && !wedged && frames > 250 && on / frames > 0.95 && lowHead > 1.35 && off < 0.4 && strain < 0.15, `${tag}: carried — he walks off upright with it over his shoulder (head never dips), through a turn, his hand on its legs, nothing stretched`,
        `still carrying ${!!pl.dragging} · his feet covered ${f2(path)} m, ending ${f2(walked)} m from where he lifted it (${key}, ${key2}) · lowest his head stood ${f2(lowHead)} m · hand on its legs ${on}/${frames} frames · its hips at most ${f2(off)} m off his feet · worst strain ${f2(strain)} · wedged ${wedged}`);
      console.log(`    (${tag}: covered ${f2(path)} m in 4 s, ${f2(walked)} m off, head ≥ ${f2(lowHead)} m, hips ≤ ${f2(off)} m off him, strain ≤ ${f2(strain)})`);
      // put it down
      msgs.length = 0; const wordD = label(), selD = g.selectVerb('body', 'drop'); let sawSet = false, relY = 9, setStrain = 0, setFrames = 0;
      const lay = () => { if (pl.haul?.phase === 'set') { sawSet = true; setFrames++; relY = hipMid()[1] - c.pos[1]; setStrain = Math.max(setStrain, B.rag.strain); } };
      tap(lay); step(140, [], lay);
      const laid = v3.copy(hipMid()); step(120); const slid = v3.distXZ(laid, hipMid()); let top = 0; for (let i = 0; i < 16; i++) top = Math.max(top, B.P(i)[1] - c.pos[1]);
      verdict(selD && /put him down/.test(wordD) && sawSet && !pl.dragging && !pl.haul && !c.anim.haul && relY < 0.3 && setStrain < 0.2 && msgs.includes('body set down') && !msgs.some(m => /wedged/.test(m)) && slid < 0.3 && top < 0.5,
        `${tag}: 'put him down' lays it on the floor by him — lowered all the way before his hands come off, never called wedged, and it stays where he laid it`,
        `row '${wordD}' selected ${selD} · a set beat ${sawSet} (${setFrames} frames) · dragging after ${!!pl.dragging} · hips ${f2(relY)} m up when let go · worst strain ${f2(setStrain)} · slid ${f2(slid)} m after · highest point at rest ${f2(top)} m · msgs ${msgs.join(' / ')} · he stood at ${fp(c.pos)} facing ${f2(c.bodyYaw)}`);
      step(60);
    }
  }
  // (b2) no room to carry (here: nowhere he may lift from) = the body along the floor, as below, without a word
  { const R = await rig(true), B = body(R), { g, step, tap, msgs } = R, pl = g.player, near = HANDS.carryNearM; HANDS.carryNearM = -9;
    g.teleportPlayer(B.beyond('feet', 0.8)); step(8); msgs.length = 0; g.selectVerb('body', 'drag'); tap(); step(260);
    verdict(!!pl.dragging && !!pl.haul && !pl.haul.carry && pl.haul.phase === 'carry' && pl.crouch && !msgs.some(m => /wedged|dropped/.test(m)), 'no room to lift it: he takes it along the floor instead — still in his hands, nothing dropped',
      `dragging ${!!pl.dragging} · haul ${pl.haul ? (pl.haul.carry ? 'shoulder' : 'floor') + '/' + pl.haul.phase : null} · crouched ${pl.crouch} · msgs ${msgs.join(' / ')}`);
    HANDS.carryNearM = near; }
  // (b4) HIS HEAD COMES ROUND WITH HIM: over the whole haul — taken up, walked off with through a turn, put down — his head never moves more than a few degrees in one
  // frame against his body. (It whipped to the new facing in a single frame as he took hold and as he turned to lay it down; and in the old floor haul the look at
  // his own hands, straight under his eyes, flipped side to side with the walk.)
  for (const carry of [true, false]) { const R = await rig(true), B = body(R), { g, step, tap, keyFor } = R, pl = g.player, c = pl.char; HANDS.carry = carry;
    g.teleportPlayer(B.beyond('feet', 0.8)); step(8);
    let prev: Vec3 | null = null, prevYaw = 0, worst = 0, at = '', frames = 0;
    const watch = () => { const hd = c.headDir(), by = c.bodyYaw; if (prev && pl.haul) { const turn = Math.abs(wrapAngle(by - prevYaw)), d = Math.max(0, Math.acos(clamp(v3.dot(prev, hd), -1, 1)) - turn) * 180 / Math.PI; frames++; if (d > worst) { worst = d; at = pl.haul.phase; } } prev = hd; prevYaw = by; };
    g.selectVerb('body', 'drag'); tap(watch); step(carry ? 200 : 80, [], watch);
    const h0 = B.mid(RAG.hipL, RAG.hipR), away = v3.normalize([c.pos[0] - h0[0] + 0.3, 0, c.pos[2] - h0[2] + 0.2]), key = keyFor(away), key2 = keyFor([-away[2], 0, away[0]]);
    step(150, [key], watch); step(30, [], watch); step(120, [key2], watch); step(90, [key, key2], watch);
    g.selectVerb('body', 'drop'); tap(watch); step(140, [], watch);
    verdict(frames > 400 && worst < 12 && !pl.haul, `${carry ? 'over the shoulder' : 'along the floor'}: his head never whips — it comes round with his body as he takes hold, walks, turns and lays it down`,
      `worst one-frame turn of his head against his body ${f2(worst)}° (in '${at}') over ${frames} frames of the haul · haul after ${pl.haul ? pl.haul.phase : null}`);
    console.log(`    (${carry ? 'shoulder' : 'floor'}: head ≤ ${f2(worst)}° a frame against his body, worst in '${at}', ${frames} frames)`); }
  // (b5) IT HANGS OFF HIM: walked to and fro and round a square with it on his shoulder, its arms, shins and head stay near the hang they have on a man standing
  // still, and no part of it gets far from him. (They streamed out behind every stride and turn — the body's damping was against the floor, not against the man
  // carrying it: 'ragdolls are a bit too floppy when carried'. With the ride off the same walk shows it.)
  { const sway = async (ride: number) => { const R = await rig(true), B = body(R), { g, step, tap, openKey } = R, pl = g.player, c = pl.char; const was = HANDS.carryRide; HANDS.carryRide = ride; HANDS.carry = true;
      try {
        g.teleportPlayer(B.beyond('feet', 0.8)); step(8); g.selectVerb('body', 'drag'); tap(); step(240);
        const up = pl.haul?.phase === 'carry' && !!pl.haul.carry, limbs: [number, number][] = [[RAG.shoL, RAG.handL], [RAG.shoR, RAG.handR], [RAG.kneeL, RAG.ankL], [RAG.kneeR, RAG.ankR], [RAG.neck, RAG.head]];
        const off = (a: number, b: number) => { const u = v3.normalize(v3.sub(B.P(b), B.P(a))); return Math.acos(clamp(-u[1], -1, 1)) * 180 / Math.PI; };
        let still = 0; for (const [a, b] of limbs) still = Math.max(still, off(a, b));
        let worst = 0, far = 0, frames = 0, strain = 0;
        const meas = () => { if (pl.haul?.phase !== 'carry') return; frames++; for (const [a, b] of limbs) worst = Math.max(worst, off(a, b)); for (let i = 0; i < 16; i++) far = Math.max(far, v3.distXZ(B.P(i), c.pos)); strain = Math.max(strain, B.rag.strain); };
        const k1 = openKey(c.pos), back: Record<string, string> = { KeyW: 'KeyS', KeyS: 'KeyW', KeyA: 'KeyD', KeyD: 'KeyA' }, k2 = openKey(c.pos, k1 === 'KeyW' || k1 === 'KeyS' ? ['KeyD', 'KeyA'] : ['KeyW', 'KeyS']);
        for (let i = 0; i < 3; i++) { step(45, [k1], meas); step(45, [back[k1]], meas); }
        for (let i = 0; i < 2; i++) for (const k of [k1, k2, back[k1], back[k2]]) step(30, [k], meas);
        return { up, still, worst, far, frames, strain, held: !!pl.dragging };
      } finally { HANDS.carryRide = was; } };
    const on = await sway(HANDS.carryRide), no = await sway(0);
    verdict(on.up && on.held && on.frames > 480 && on.still < 5 && on.worst < 35 && on.far < 0.8 && on.strain < 0.15, 'carried to and fro and round a square: its arms, shins and head hang off him and sway — never streaming out behind a stride or a turn — and no part of it gets far from him',
      `on his shoulder ${on.up} · still carried ${on.held} · ${on.frames} frames · standing still its limbs are ${f2(on.still)}° off the hang · walked: worst ${f2(on.worst)}° (bar 35) · farthest part ${f2(on.far)} m off him (bar 0.8) · strain ${f2(on.strain)}`);
    verdict(no.up && no.worst > 50 && no.far > on.far + 0.15, 'the ride off, the same walk shows the fault: limbs past 50° off the hang, parts of it further out from him',
      `ride off: worst ${f2(no.worst)}° · farthest part ${f2(no.far)} m (on: ${f2(on.far)} m)`);
    console.log(`    (ride ${HANDS.carryRide}: limbs ≤ ${f2(on.worst)}° off the hang, farthest part ${f2(on.far)} m · ride 0: ≤ ${f2(no.worst)}°, ${f2(no.far)} m)`); }
  // (b3) ALONG THE FLOOR (the carry switched off): three pick-ups in a row on one body: feet, head, feet
  { const R = await rig(true), B = body(R), { g, step, tap, msgs, keyFor } = R, pl = g.player, c = pl.char; HANDS.carry = false;
    let n = 0;
    for (const end of ['feet', 'head', 'feet'] as const) {
      n++; const tag = `pick-up ${n} (from the ${end})`;
      g.teleportPlayer(B.beyond(end, end === 'feet' ? 0.8 : 0.9)); step(8); msgs.length = 0;
      const sel = g.selectVerb('body', 'drag');
      const phases: string[] = []; let pinEarly = false, y0 = 0; const gripY = () => pl.haul ? (B.P(pl.haul.iL)[1] + B.P(pl.haul.iR)[1]) / 2 : 0;
      const watch = () => { const h = pl.haul; if (!h) return; if (phases[phases.length - 1] !== h.phase) phases.push(h.phase); if (h.phase === 'reach') { if (!y0) y0 = gripY(); else if (gripY() > y0 + 0.05) pinEarly = true; } };
      tap(watch); step(100, [], watch);
      const took = !!pl.dragging && pl.haul?.end === end && phases.join('>') === 'reach>rise>carry';
      const carryY = gripY(), wantY = end === 'feet' ? HANDS.carryFeet : HANDS.carryHead;
      verdict(sel && took && !pinEarly && Math.abs(carryY - wantY) < 0.06, `${tag}: taken by that end, reach → rise → carry, nothing lifted before the hands are down, then held at carry height`,
        `row selected ${sel} · dragging ${!!pl.dragging} · end ${pl.haul?.end} · beats ${phases.join('>')} · lifted during the reach ${pinEarly} · grip height ${f2(carryY)} (want ${wantY}) · msgs ${msgs.join(' / ')}`);
      // haul it away from itself for 2.5 s: it comes, his hands stay on the two limbs
      const h0 = v3.copy(B.hips()), away = v3.normalize([c.pos[0] - h0[0], 0, c.pos[2] - h0[2]]), key = keyFor(away);
      let frames = 0, on = 0, gap = 0;
      step(150, [key], () => { const h = pl.haul; if (!h || h.phase !== 'carry') return; frames++; const a = v3.dist(c.bones.handL, B.P(h.iL)), b = v3.dist(c.bones.handR, B.P(h.iR)); gap = Math.max(gap, a, b); if (a < 0.12 && b < 0.12) on++; });
      const moved = v3.distXZ(h0, B.hips()), wedged = msgs.some(m => /wedged/.test(m));
      verdict(!!pl.dragging && moved > 1.0 && !wedged && frames > 100 && on / frames > 0.9, `${tag}: hauled — the body comes over a metre, both wrists on the limbs he has, never torn out of his hands`,
        `still dragging ${!!pl.dragging} · hips moved ${f2(moved)} m (${key}) · wrists within 12 cm of their limbs ${on}/${frames} frames, worst ${f2(gap)} · wedged ${wedged}`);
      console.log(`    (${tag}: worst wrist ↔ limb gap ${f2(gap)} m over ${frames} frames of the haul, hips came ${f2(moved)} m)`);
      // lay it down
      step(20); msgs.length = 0; const selD = g.selectVerb('body', 'drop'); let sawSet = false, lowY = 9;
      tap(() => { if (pl.haul?.phase === 'set') { sawSet = true; lowY = Math.min(lowY, gripY()); } }); step(60, [], () => { if (pl.haul?.phase === 'set') { sawSet = true; lowY = Math.min(lowY, gripY()); } });
      verdict(selD && sawSet && !pl.dragging && !pl.haul && !c.anim.haul && lowY < 0.28 && msgs.includes('body set down'), `${tag}: 'let go of him' lays it down — the limbs lowered to the floor before the hands come off`,
        `row selected ${selD} · a set beat ${sawSet} · dragging after ${!!pl.dragging} · lowest the grip stood before release ${f2(lowY)} · msgs ${msgs.join(' / ')}`);
      step(90);
    }
    HANDS.carry = true;
  }
  // (c) torn out of his hands: a sprint is the old instant drop (from his shoulder too)
  { const R = await rig(true), B = body(R), { g, step, tap, keyFor } = R, pl = g.player, c = pl.char;
    g.teleportPlayer(B.beyond('feet', 0.8)); step(8); g.selectVerb('body', 'drag'); tap(); step(240);
    const had = !!pl.dragging && pl.haul?.phase === 'carry' && !!pl.haul.carry; const h = B.hips(), key = keyFor(v3.normalize([c.pos[0] - h[0], 0, c.pos[2] - h[2]]));
    step(6, [key, 'ShiftLeft']);
    verdict(had && !pl.dragging && !pl.haul, 'a sprint lets go of it at once (no laying down), and nothing of the hold is left behind', `held ${had} · dragging after ${!!pl.dragging} · haul ${JSON.stringify(pl.haul?.phase ?? null)}`);
    // …in any beat: planted in the lift, Shift + a movement key of his own still lets go; Shift alone (no key of his) never turns the step in to it into a sprint
    step(60); g.teleportPlayer(B.beyond('feet', 0.8)); step(8); g.selectVerb('body', 'drag'); tap(); let alone = true;
    step(12, ['ShiftLeft'], () => { if (!pl.dragging || pl.sprinting) alone = false; });
    const inRise = () => pl.haul?.phase === 'rise'; let n = 0; while (!inRise() && pl.dragging && n++ < 200) step(1);
    const rose = inRise(); step(3, [key, 'ShiftLeft']);
    verdict(alone && rose && !pl.dragging && !pl.haul, 'Shift alone never makes the step in to it a sprint; Shift + his own key in the middle of the lift lets go at once', `Shift alone kept it ${alone} · reached the lift ${rose} · dragging after ${!!pl.dragging}`); }
  // (d) rounds past him / a round into him while he hauls (the movement pass on, as the page has it): the reaction would turn the trunk under rigid arms — his hands stay on the limbs
  { const moves = MOVES.on;
    try { for (const carry of [true, false]) {
      const R = await rig(true), B = body(R), { g, step, tap } = R, pl = g.player, c = pl.char; MOVES.on = 1; HANDS.carry = carry;   // (after the stand-up: the frozen stand pins the pass off)
      g.teleportPlayer(B.beyond('feet', 0.8)); step(8); g.selectVerb('body', 'drag'); tap(); step(240);
      const had = !!pl.dragging && pl.haul?.phase === 'carry' && !!pl.haul.carry === carry; let frames = 0, gap = 0;
      const meas = () => { const h = pl.haul, a = c.anim.haul; if (!h || !a) return; frames++; gap = Math.max(gap, v3.dist(c.bones.handL, a.l), (a.rw ?? 1) > 0.9 ? v3.dist(c.bones.handR, a.r) : 0); };
      c.anim.flinchFrom([1, 0, 0]); step(45, [], meas); c.anim.hitFrom([0, 0, 1]); step(45, [], meas);
      verdict(had && !!pl.dragging && frames === 90 && gap < 0.08, `flinching and hit while he ${carry ? 'carries it over his shoulder' : 'hauls it along the floor'}: ${carry ? 'his hand stays on its legs' : 'both wrists stay on the limbs he has'} (the reaction yields to the haul as to the lock tools; without that a round home swings them 10 cm off)`,
        `held ${had} · still dragging ${!!pl.dragging} · frames ${frames} · worst wrist ↔ grip gap ${f2(gap)} m`); }
      HANDS.carry = true; }
    finally { MOVES.on = moves; } }
  return allPass;
}); }

// ================================================================ a door
const SPOTS: { name: string; at: Vec3; inside: boolean }[] = [
  { name: 'inside, mid-room', at: [23.9, 0, 9.6], inside: true }, { name: 'inside, by the hinge', at: [23.6, 0, 9.2], inside: true },
  { name: 'inside, in front of the handle', at: [23.6, 0, 10.0], inside: true }, { name: 'inside, off the latch jamb', at: [23.7, 0, 10.4], inside: true },
  { name: 'outside, at the door', at: [22.4, 0, 9.6], inside: false }, { name: 'outside, a stride off', at: [22.0, 0, 10.0], inside: false },
];
function leafGap(d: any, p: ArrayLike<number>): number {
  const u = d.dir(), vx = p[0] - d.def.hinge[0], vz = p[2] - d.def.hinge[1]; const t = Math.max(0, Math.min(d.def.width, vx * u[0] + vz * u[1]));
  return Math.hypot(vx - u[0] * t, vz - u[1] * t);
}
/** tap the door's first row and watch it for `secs` */
function work(R: Awaited<ReturnType<typeof rig>>, d: any, secs: number) {
  const { g, step, tap } = R, pl = g.player, c = pl.char; const old = new Set<any>(g.events), heard = new Set<any>();   // (g.events forgets a noise after half a second: they are counted as they pass)
  let passers = 0, minGap = 9, hand = 0, moved = false; const a0 = d.angle;
  const watch = () => { passers |= d.passers; for (const e of g.events) if (e.kind === 'door' && !old.has(e)) heard.add(e); if (Math.abs(d.angle - a0) > 0.02) moved = true; if (moved) minGap = Math.min(minGap, leafGap(d, c.pos)); const h = c.anim.doorHands(); hand = Math.max(hand, h.L, h.R); };
  g.selectVerb('door'); tap(watch); const began = !!pl.doorMove; step(Math.round(secs * 60), [], watch);
  return { began, passers, minGap, hand, heard: [...heard].map((e: any) => e.level as number) };
}
export async function handsDoor(): Promise<boolean> { return keep(async () => {
  console.log('\n=== hands-door: a door row brings the leaf round under his hand, him stepped clear of its swing — never through him; shut again, it latches ===');
  allPass = true;
  const R = await rig(true), { g, step } = R, d = g.doors.byName('hut'), need = 0.34 + d.thick / 2;
  for (const S of SPOTS) {
    d.reset(); g.teleportPlayer(S.at); step(12);
    const row = g.nearby.find((r: any) => r.kind === 'door')?.line2 ?? '?';
    const o = work(R, d, 2.2), open = Math.abs(d.angle);
    verdict(o.began && o.passers === 0 && o.minGap >= need - 0.04 && open >= 1.3 && o.hand >= 0.6, `${S.name} ('${String(row).trim()}'): the leaf comes round under his hand and ends open; it never passes through him nor stands in him`,
      `move began ${o.began} · passers ${o.passers} · nearest his centre came to the leaf's line ${f2(o.minGap)} (his body + the leaf: ${f2(need)}) · open ${f2(open)} rad · hand weight ${f2(o.hand)} · he ended at ${fp(g.player.char.pos)}`);
    const row2 = g.nearby.find((r: any) => r.kind === 'door')?.line2 ?? '?';
    const s = work(R, d, 2.4);
    verdict(s.began && s.passers === 0 && d.latched && Math.abs(d.angle) < 1e-6, `${S.name} ('${String(row2).trim()}'): shut from where that left him — it latches, and never through him`,
      `move began ${s.began} · passers ${s.passers} · latched ${d.latched} · angle ${f2(d.angle)} · nearest ${f2(s.minGap)}`);
  }
  // the sound of it: one opening = the row's one creak, as Doors.use always said it (level 0.2) — heard by the same ears
  { d.reset(); g.teleportPlayer(SPOTS[4].at); step(12); const ev = work(R, d, 1.6).heard;
    HANDS.on = false; d.reset(); g.teleportPlayer(SPOTS[4].at); step(40); const was = work(R, d, 1.6).heard; HANDS.on = true;
    verdict(ev.length === 1 && was.length >= 1 && Math.abs(ev[0] - was[0]) < 1e-9, 'an opening by hand files ONE door noise, as loud as the first one the flung leaf makes (the creak — and none of the flung leaf\'s knocks after it)', `by hand: ${JSON.stringify(ev)} · flung: ${JSON.stringify(was)}`); }
  // a step of his own takes his feet back; the leaf still never goes into him
  { d.reset(); g.teleportPlayer(SPOTS[0].at); step(12); const key = R.keyFor([0, 0, -1]);
    g.selectVerb('door'); R.tap(); let passers = 0, minGap = 9; step(90, [key], () => { passers |= d.passers; if (Math.abs(d.angle) > 0.02) minGap = Math.min(minGap, leafGap(d, g.player.char.pos)); });
    verdict(passers === 0 && minGap >= need - 0.04, 'walking his own way while the leaf comes: his feet are his, and the leaf waits for his body rather than pass through it', `passers ${passers} · nearest ${f2(minGap)} (need ${f2(need)}) · leaf ${f2(d.angle)} · he ended at ${fp(g.player.char.pos)}`); }
  // no room to stand clear: the row does what it always did (the leaf comes past him) — nobody is shut in
  { d.reset(); g.teleportPlayer(SPOTS[0].at); step(12); HANDS.stepM = 0.05; HANDS.roundM = 0.05; const o = work(R, d, 2.0); HANDS.stepM = 1.3; HANDS.roundM = 1.8;
    verdict(!o.began && Math.abs(d.angle) >= 1.0, 'with no standing room the sweep misses (step limit set to nothing), the move is refused and the row opens the door as it always did', `move began ${o.began} · open ${f2(Math.abs(d.angle))} · passers ${o.passers}`); }
  // a limp body lying in the leaf's swing, the door pushed from its other face. One-way doors: a hand's leaf moves him aside like any push (doors.ts). Two-way
  // doors (the frozen stand, `?twoway`): only the flung leaf leaving its latch does, so the move is refused and the row does what it always did — a leaf brought
  // round by hand used to stop a few degrees open on a limb, still shut to every test, with nothing but walking into it to get it open
  for (const oneWay of [true, false]) {
    const R2 = await rig(true), g2 = R2.g, d2 = g2.doors.byName('hut'), gd = g2.guards[0]; DOORWAY.oneWay = oneWay; d2.reset();
    const into = oneWay ? d2.swing : -1;   // (this leaf's negative angles are the hut's inside: x past the hinge's)
    killGuard(g2, gd, [1, 0, 0], true); R2.step(150);
    // (laid where the lesson run that found it had him: a knee 14 cm beyond the shut leaf's line, half way along it — the settled body moved there as it lies)
    const rag = gd.char.ragdoll, k = rag.point(RAG.kneeL), dx = d2.def.hinge[0] - into * 0.14 - k[0], dz = d2.def.hinge[1] + 0.57 - k[2];
    rag.settleAt(Array.from({ length: 48 }, (_, i) => rag.x[i] + (i % 3 === 0 ? dx : i % 3 === 2 ? dz : 0))); R2.step(6);
    const near = () => { let m = 9; for (let i = 0; i < 16; i++) m = Math.min(m, leafGap(d2, rag.point(i)) - rag.radius(i) - d2.thick / 2); return m; };
    const lies = near(); g2.teleportPlayer([d2.def.hinge[0] + into * 0.6, 0, 9.6]); R2.step(12);
    const o = work(R2, d2, 2.4), open = Math.abs(d2.angle);
    verdict(lies < 0.2 && (oneWay ? o.began : !o.began) && open >= 1.0 && !d2.isClosed(), oneWay
      ? 'a limp body lying in the swing of a one-way door: the leaf brought round by hand moves him aside and the door ends open'
      : 'a limp body lying in the swing of a two-way door: the hand move is refused and the row opens the door as it always did (it used to stop on him, still shut)',
      `one-way ${oneWay} · his nearest limb lay ${f2(lies)} m off the shut leaf · move began ${o.began} · open ${f2(open)} rad · still 'closed' ${d2.isClosed()}`);
  }
  // a door that opens TOWARD him, worked from its hinge half or from beside the hinge (the yard gate from the yard): the leaf must not end up standing between
  // him and the doorway. He used to be stepped into the pocket behind it — or left beside the hinge — and then walked into the leaf's back; now he comes out
  // round its free end as it comes, ends on the opening's side of it, and walks in. (The last start is the latch half: as it always was.)
  {
    const R3 = await rig(true), g3 = R3.g, d3 = g3.doors.byName('gate_w'), hx = d3.def.hinge[0], hz = d3.def.hinge[1], s = d3.swing > 0 ? -1 : 1, need3 = 0.34 + d3.thick / 2;
    const side = (a: number, q: ArrayLike<number>) => { const dir = d3.def.closedDir + a; return Math.cos(dir) * (q[2] - hz) - Math.sin(dir) * (q[0] - hx); };
    const latch = [hx + Math.cos(d3.def.closedDir) * d3.def.width, 0, hz + Math.sin(d3.def.closedDir) * d3.def.width];
    for (const [name, off] of [['beside the hinge', [0.5, -0.25]], ['in front of the hinge', [0.5, 0.1]], ['the hinge half', [0.5, 0.3]], ['the hinge half, further out', [0.7, 0.2]], ['well beyond the hinge', [0.45, -0.6]], ['the latch half', [0.9, 0.5]]] as const) {
      d3.reset(); d3.locked = false; const at: [number, number, number] = [hx + s * off[0], 0, hz + off[1]]; g3.teleportPlayer(at); R3.step(12);
      const row = g3.nearby.find((r: any) => r.kind === 'door')?.line2 ?? '?';
      const o = work(R3, d3, 2.6), p = [...g3.player.char.pos], open = Math.abs(d3.angle), front = side(d3.angle, p) * Math.sign(side(d3.angle, latch));
      const through = [hx - s * 1.0, 0, hz + d3.def.width * 0.5];
      let k = 0; for (; k < 240; k++) { const q = g3.player.char.pos; if ((q[0] - hx) * s < -0.4) break; R3.step(1, [R3.keyFor([through[0] - q[0], 0, through[2] - q[2]])]); }
      verdict(o.began && o.passers === 0 && o.minGap >= need3 - 0.04 && open >= 1.3 && front > 0.2 && k < 240, `a leaf that opens toward him, from ${name} ('${String(row).trim()}'): he ends on the opening's side of the open leaf and walks in through the doorway`,
        `start ${fp(at)} · move began ${o.began} · passers ${o.passers} · nearest the leaf's line ${f2(o.minGap)} (want ${f2(need3)}) · open ${f2(open)} rad · he ended ${fp(p)}, ${f2(front)} m on the opening's side of the leaf (want > 0.2) · walking at the opening: ${k < 240 ? 'through in ' + (k / 60).toFixed(1) + ' s' : 'NOT through, stuck at ' + fp(g3.player.char.pos)}`);
    }
  }
  // two-person stealth: Sam low at a shut door with a man beyond it and his silent partner behind him (sneak-probes.ts's sneak-door staging, the push row for its ease) —
  // the pair's door rule stands under a door worked by hand: the partner is out of the doorway's line and still before the leaf moves, the leaf never comes at
  // him or at Sam, and the men turned to the door as it opens see no more of him than under the flung leaf
  { const { Run, squadUp } = await import('./pairsneak.ts'); const flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
    const res: Record<string, { began: boolean; open: number; funnel: boolean; v: number; moved: number; mateGap: number; samGap: number; seen: number; face: string; need: number }> = {};
    for (const hands of [true, false]) {
      const P = await Run.start('roomclear=10&squad=1', 6, { sneak: true }); P.stopOnNotice = false; squadUp(P); HANDS.on = hands;
      const dd = P.door('breakroom_w'), fc = dd.frameCentre, T1 = P.hostiles[0]; dd.def.closer = false;
      const th = dd.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), in0 = Math.sign((T1.char.pos[0] - fc[0]) * nx + (T1.char.pos[2] - fc[2]) * nz) || 1;
      const spot = P.free([fc[0] + nx * in0 * 4.3, 0, fc[2] + nz * in0 * 4.3 + 0.3]); T1.char.pos[0] = spot[0]; T1.char.pos[2] = spot[2];
      // (their eyes held by hand, as sneak-probes.ts stares them: backs to the door for the walk up, turned to it as the row is tapped)
      const gaze = new Map<any, number[]>(), look = (to: (h: any) => number[]) => { for (const h of P.hostiles) { const c = h.char;
        if (!gaze.has(c)) { const dir = () => { const t = gaze.get(c)!, dx = t[0] - c.pos[0], dz = t[2] - c.pos[2], l = Math.hypot(dx, dz) || 1; return [dx / l, 0, dz / l]; }; Object.defineProperty(c, 'chestDir', { get: dir, set: () => {}, configurable: true }); c.headDir = dir; }
        const t = to(h); gaze.set(c, [t[0], 0, t[2]]); } };
      look(h => [h.char.pos[0] + nx * in0 * 8, 0, h.char.pos[2] + nz * in0 * 8]);
      P.crouch(true); P.go(P.free([fc[0] - nx * in0 * 5.5, 0, fc[2] - nz * in0 * 5.5]), 60); P.gather(); P.toDoor('breakroom_w'); P.wait(5);
      const m = P.mate, p0 = [...m.char.pos], e = T1.char.pos, v = Math.hypot(m.char.vel[0], m.char.vel[2]);
      const A = dd.def.hinge, B = [A[0] + Math.cos(th) * dd.def.width, A[1] + Math.sin(th) * dd.def.width], o = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
      const funnel = o(e[0], e[2], p0[0], p0[2], A[0], A[1]) * o(e[0], e[2], p0[0], p0[2], B[0], B[1]) <= 0 && o(A[0], A[1], B[0], B[1], e[0], e[2]) * o(A[0], A[1], B[0], B[1], p0[0], p0[2]) <= 0;
      look(() => [fc[0], 0, fc[2]]); const face = P.g.doors.pullFace?.(dd, P.pos) ? 'pull' : 'push', seen0 = P.mateSeenS, a0 = dd.angle; let began = false, mateGap = 9, samGap = 9;
      const row = P.doorVerb('breakroom_w', 'push'); began = !!P.pl.doorMove;
      for (let i = 0; i < 150; i++) { P.step(); if (P.pl.doorMove) began = true; if (Math.abs(dd.angle - a0) > 0.02) { mateGap = Math.min(mateGap, leafGap(dd, m.char.pos)); samGap = Math.min(samGap, leafGap(dd, P.pos)); } }
      res[String(hands)] = { began: row && began, open: Math.abs(dd.angle), funnel, v, moved: flat(p0, m.char.pos), mateGap, samGap, seen: P.mateSeenS - seen0, face, need: 0.34 + dd.thick / 2 };
    }
    HANDS.on = true; const a = res.true, b = res.false;
    const w = (x: typeof a) => `the ${x.face} face · move began ${x.began} · open ${f2(x.open)} rad · partner in the shut door's line ${x.funnel}, moving ${f2(x.v)} m/s before, moved ${f2(x.moved)} m after · leaf's line nearest the partner ${f2(x.mateGap)}, nearest Sam ${f2(x.samGap)} (a body + the leaf: ${f2(x.need)}) · eyes on the partner ${f2(x.seen)} s`;
    verdict(a.began && a.open >= 1.0 && !b.began && b.open >= 1.0, 'with a silent partner behind him: the push row works the door by hand and it ends open (the switch off: the flung leaf)', `by hand: ${w(a)}\n    flung: ${w(b)}`);
    verdict(!a.funnel && a.v < 0.1 && a.moved < 0.3, '… the partner is out of the doorway\'s line and still before the leaf moves, and stays where he is while it comes round', w(a));
    verdict(a.mateGap >= a.need - 0.04 && a.samGap >= a.need - 0.04, '… and the leaf comes at neither of them', w(a));
    console.log(`    (by hand: ${w(a)})\n    (flung: ${w(b)})`);
    verdict(a.seen < 0.1 && a.seen <= b.seen + 0.05, '… the men looking at the door as it opens do not see the partner (2.5 s of it), no more than under the flung leaf', `by hand ${f2(a.seen)} s · flung ${f2(b.seen)} s`); }
  return allPass;
}); }

// ================================================================ the switch off
export async function handsOff(): Promise<boolean> { return keep(async () => {
  console.log('\n=== hands-off: the switch off — the ankle drag on the frame of the tap, the leaf flung, no state of this module anywhere ===');
  allPass = true;
  const R = await rig(false), B = body(R), { g, step, tap } = R, pl = g.player, c = pl.char;
  g.teleportPlayer(B.beyond('feet', 0.8)); step(8); g.selectVerb('body', 'drag'); tap(); step(4);
  const pinned = Math.abs(B.P(RAG.ankL)[1] - 0.06) > 0.02;   // (the pins have begun to lift the ankles within a few frames of the tap)
  verdict(!!pl.dragging && pl.haul === null && c.anim.haul === null && pinned, 'a body: dragging at once, the ankles already on their way up, no Haul and nothing fed to the animator', `dragging ${!!pl.dragging} · haul ${pl.haul} · anim.haul ${c.anim.haul} · ankle height ${f2(B.P(RAG.ankL)[1])}`);
  g.selectVerb('body', 'drop'); tap(); verdict(!pl.dragging, "'let go of him' drops it on the frame of the tap", `dragging ${!!pl.dragging}`);
  const d = g.doors.byName('hut'); d.reset(); g.teleportPlayer(SPOTS[0].at); step(12);
  const o = work(R, d, 1.5);
  verdict(!o.began && pl.doorMove === null && Math.abs(d.angle) > 1.0, 'a door: no DoorMove, the leaf flung open by Doors.use as ever', `move began ${o.began} · open ${f2(Math.abs(d.angle))}`);
  console.log(`  (as it was, for the record: from inside the hut the leaf ${o.passers ? 'PASSES THROUGH him' : 'does not pass through him'} — passers ${o.passers}, nearest ${f2(o.minGap)})`);
  return allPass;
}); }

// ================================================================ a door somebody else works
/** the office's room clear with the four, doors as the page has them, every defender taken off the floor (doortools-probes.ts's rig: its first step resets the level) */
async function teamRig(team: boolean) {
  const { rig: dtRig } = await import('./doortools-probes.ts'); const { despawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
  const set = () => { DOORWAY.oneWay = true; DOORSTAY.on = true; HANDS.on = true; HANDS.team = team; };
  set(); const R: any = await dtRig(1, { stage: 'rc' }); set();
  for (const h of [...R.game.guards]) if (h.team === 'hostile') despawnUnit(R.game, h);
  R.step(10);
  return R;
}
const handW = (c: any) => { const h = c.anim.doorHands(); return Math.max(h.L, h.R); };
/** the door ordered open from one of its faces: the frame the leaf first moves, the lead's hand on that frame, the leaf's angle over the next half second */
async function orderedOpen(team: boolean, name: string, pull: boolean) {
  const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
  const R = await teamRig(team), g = R.game, d = R.door(name), c = d.def.closedDir, ux = Math.cos(c), uz = Math.sin(c), H = d.def.hinge, W = d.def.width;
  const off = (f: number, o: number): Vec3 => [H[0] + ux * W * 0.5 - uz * o * f, 0, H[1] + uz * W * 0.5 + ux * o * f];
  const pf = [1, -1].find(f => g.doors.pullFace(d, off(f, 0.8)))!, f = pull ? pf : -pf, sam = off(f, 2.6);
  d.locked = false; g.teleportPlayer(sam);   // (the room clear's staging has the door shut; Door.reset would put the level's own angle back — this one is authored open)
  // The squad starts on Sam's face of the door, beside him. Left where the staging stood them, a PAIR sent to the far face walks the short way to its marks
  // THROUGH the ordered door (orders.ts route: only the squad of four goes round the door it is to stack on, and ORDERS.roundCap no longer sends a pair round
  // an uncleared room by the long way) — the leaf's first move was then a walker's pull, not the order's shove, which is the thing asked about here.
  { const by: Vec3[] = [];
    for (const o of [2.0, 1.4, 2.6, 3.2, 3.8]) for (const s of [1.3, -1.3, 0.7, -0.7, 1.9, -1.9, 0]) { const q0 = off(f, o), q: Vec3 = [q0[0] + ux * s, 0, q0[2] + uz * s];
      if (g.col.nav.isBlocked(q[0], q[2]) || g.col.solidBlocked([q[0], 1, q[2]], [sam[0], 1, sam[2]]) || [sam, ...by].some(b => Math.hypot(b[0] - q[0], b[2] - q[2]) < 0.7)) continue;
      by.push(q); }
    R.ops.filter((x: any) => x.state !== 'dead').forEach((m: any, i: number) => { const q = by[i]; if (!q) return; m.char.pos = [...q] as Vec3; m.lastPos = [...q]; m.char.bodyYaw = m.char.aimYaw = Math.atan2(sam[0] - q[0], sam[2] - q[2]); }); }
  R.step(10);
  const op = R.D.order('openClear', R.ops.filter((x: any) => x.state !== 'dead'), d, sideOf(d, sam), null, false);
  if (typeof op === 'string') return { refused: op as string, at: -1, w: 0, trace: '' };
  let at = -1, w = 0; const tr: string[] = [];
  for (let i = 0; i < 60 * 25 && (at < 0 || tr.length < 30); i++) { R.step(1); if (at < 0 && Math.abs(d.angle) > 0.02) { at = i; w = handW(op.lead.char); } if (at >= 0) tr.push(d.angle.toFixed(4)); }
  return { refused: '', at, w, trace: tr.join(' ') };
}
/** a teammate stood half a metre off an open leaf pulls it to: the most his hand is on it, the leaf's angle every frame */
async function pulledTo(team: boolean) {
  const R = await teamRig(team), g = R.game, d = R.door('breakroom_w'), m = R.ops[0];
  d.locked = false; d.latched = false; d.angle = Math.abs(d.maxA) > 0.5 ? Math.min(1.4, d.maxA) : Math.max(-1.4, d.minA); d.vel = 0; d.place();
  const a = d.def.closedDir + d.angle, u = [Math.cos(a), Math.sin(a)], n = [-u[1], u[0]], H = d.def.hinge, W = d.def.width, end = [H[0] + u[0] * W * 0.8, H[1] + u[1] * W * 0.8];
  const at = [1, -1].map(s => [end[0] + n[0] * 0.55 * s, 0, end[1] + n[1] * 0.55 * s] as Vec3).find(q => !g.col.nav.isBlocked(q[0], q[2]))!;
  m.char.pos = at; m.lastPos = [...at]; m.char.bodyYaw = m.char.aimYaw = Math.atan2(end[0] - at[0], end[1] - at[2]);
  R.O.assign(m, { post: at, face: m.char.bodyYaw, watch: null, stance: 'none', upper: 'none', going: 'x', there: 'x' });   // (held on the spot: left to himself he falls in on Sam)
  R.step(20); const open0 = Math.abs(d.angle); g.doors.pullTo(d, m.char.id);
  let w = 0; const tr: string[] = [];
  for (let i = 0; i < 120; i++) { R.step(1); w = Math.max(w, handW(m.char)); tr.push(d.angle.toFixed(4)); }
  return { open0, w, end: Math.abs(d.angle), trace: tr.join(' ') };
}
export async function handsTeam(): Promise<boolean> { const was = HANDS.team; return keep(async () => {
  console.log('\n=== hands-team: a door somebody else works — the squad\'s lead ordered to open one, a man pulling one to: a hand on the leaf as it moves ===');
  allPass = true;
  const log = console.log, warn = console.warn; const quiet = async <T>(fn: () => Promise<T>): Promise<T> => { console.log = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.warn = warn; } };
  for (const [name, pull] of [['breakroom_w', false], ['fire_exit', false], ['fire_exit', true]] as [string, boolean][]) {
    const on = await quiet(() => orderedOpen(true, name, pull)), no = await quiet(() => orderedOpen(false, name, pull)), face = pull ? 'pull' : 'push';
    if (on.refused || no.refused) { verdict(false, `${name}, ordered open from its ${face} face`, `refused: ${on.refused || no.refused}`); continue; }
    verdict(on.at >= 0 && on.w >= 0.6, `${name}, ordered open from its ${face} face: the lead's hand is on the leaf on the frame it first moves`, `opened at frame ${on.at} · hand ${f2(on.w)}`);
    verdict(no.at >= 0 && no.w < 0.05, `${name}, ${face} face, the row off: no hand on it then (the leaf goes by itself, as it did)`, `opened at frame ${no.at} · hand ${f2(no.w)}`);
    verdict(on.at === no.at && on.trace === no.trace, `${name}, ${face} face: the leaf first moves on the same frame and turns the same either way`, `on: frame ${on.at} · off: frame ${no.at}${on.trace === no.trace ? '' : ' · the angles differ'}`);
    console.log(`  (${name}, ${face} face: the leaf moves at frame ${on.at}; the lead's hand ${f2(on.w)} with the row on, ${f2(no.w)} off)`);
  }
  const on = await quiet(() => pulledTo(true)), no = await quiet(() => pulledTo(false));
  verdict(on.open0 > 1 && on.end < on.open0 - 0.5 && on.w >= 0.6, 'a man pulling an open leaf to: it comes shut under his hand', `open ${f2(on.open0)} → ${f2(on.end)} · hand at most ${f2(on.w)}`);
  verdict(no.w < 0.05, 'the row off: no hand on a leaf he pulls to', `hand at most ${f2(no.w)}`);
  verdict(on.trace === no.trace, 'the leaf turns the same either way, every frame', `ended ${f2(on.end)} on · ${f2(no.end)} off`);
  console.log(`  (pulled to: ${f2(on.open0)} → ${f2(on.end)} rad in two seconds; his hand at most ${f2(on.w)} with the row on, ${f2(no.w)} off)`);
  return allPass;
}).finally(() => { HANDS.team = was; }); }

// ================================================================ the two stands, the page, the knob table
export async function handsHarness(): Promise<boolean> { return keep(async () => {
  console.log('\n=== hands-harness: the frozen stand holds the switch off, the page turns it on unless ?nohands, the table is a registered knob table ===');
  allPass = true; const P = await import(`${ROOT}/src/host/profile.ts`), K = await import(`${ROOT}/src/game/knobs.ts`), E = await import(`${ROOT}/src/host/standEnv.ts`);
  { const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_HANDS;
    if (frozen || word !== undefined) HANDS.on = word !== '1';
    const before = HANDS.on; await standUp(); const want = frozen || word !== undefined ? word === '1' : before;
    verdict(HANDS.on === want, frozen ? 'standUp() on the frozen stand puts HANDS.on to what TPS_HANDS says (unset: off — every stored digest read the ankle drag and the flung leaf)' : "standUp() on the shipped stand leaves HANDS.on to the page's boot (or to TPS_HANDS where it is given)", `before ${before} · after ${HANDS.on} · TPS_HANDS ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'}`); }
  { const row = P.FROZEN_HOLDS['HANDS.on']; verdict(typeof row === 'string' && /TPS_HANDS=1/.test(row) && E.STAND_ENV.includes('TPS_HANDS'), 'FROZEN_HOLDS names HANDS.on with the word that turns it on, and STAND_ENV carries that word', `FROZEN_HOLDS['HANDS.on'] = ${JSON.stringify(row)} · in STAND_ENV ${E.STAND_ENV.includes('TPS_HANDS')}`); }
  { const c = K.knobsCopy(); let a: unknown, b: unknown, o: unknown;
    try { HANDS.on = false; P.pageSwitches(new URLSearchParams('')); a = HANDS.on; P.pageSwitches(new URLSearchParams('nohands')); b = HANDS.on; P.pageSwitches(new URLSearchParams('noclose&nolightwall')); o = HANDS.on; } finally { K.knobsBack(c); }
    verdict(a === true && b === false && o === true, "the page's boot (pageSwitches): no flag → on · ?nohands → off · other flags leave it on", `'' → ${a} · 'nohands' → ${b} · 'noclose&nolightwall' → ${o}`); }
  { const reg = K.knobRegistry(), same = reg.HANDS === HANDS, inJ = K.JOURNAL_KNOBS.includes('HANDS'); const c = K.knobsCopy(), was = HANDS.doorRate; HANDS.doorRate = was + 1; K.knobsBack(c);
    verdict(same && inJ && HANDS.doorRate === was, 'knobRegistry().HANDS is the table, a recording carries it (JOURNAL_KNOBS), knobsCopy / knobsBack restore it', `registry is the table ${same} · in JOURNAL_KNOBS ${inJ} · doorRate put back ${HANDS.doorRate === was}`); }
  return allPass;
}); }

if (import.meta.main) {
  const which = process.argv[2] ?? 'all'; let ok = true;
  if (which === 'all' || which === 'body') ok = await handsBody() && ok;
  if (which === 'all' || which === 'door') ok = await handsDoor() && ok;
  if (which === 'all' || which === 'off') ok = await handsOff() && ok;
  if (which === 'all' || which === 'team') ok = await handsTeam() && ok;
  if (which === 'all' || which === 'harness') ok = await handsHarness() && ok;
  console.log(ok ? '\n=== hands: ALL PASS ===' : '\n=== hands: FAILED ==='); process.exit(ok ? 0 : 1);
}
