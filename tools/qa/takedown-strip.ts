// TAKEDOWN STRIP: stick figures of a close-up takedown — the man doing it and the man it is done to — as a row of moments, with no GPU. Each move is staged in
// the real game stood up headless (the page's stand unless TPS_PROFILE says otherwise) and run through the game's own entry points: Sam's blows through
// player.ts startTakedown, the hold through startGrab and the held rows, the partner's through the pair's 'take him now' order.
//   bun run tools/qa/takedown-strip.ts [--out dir] [--tag name] [--move a,b,…] [--list]     → dir/<move>[-tag].svg (+ .png where a headless Chromium is found)
// Three rows a strip, all in the frame of the man being taken as he stood when it began: from his right side (he faces right), from in front of him, from above.
// Blue = the one doing it, orange = the one it is done to; the darker limb is each man's right; a dot = a hand; the tick on a head = where the face points.
process.env.TPS_PROFILE ??= 'shipped';
import { writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const { standUp, ROOT } = await import('./headless.ts');
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { startTakedown, startGrab } = await import(`${ROOT}/src/game/player.ts`);
const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { setHoldPhase, killEnd } = await import('./takedown-check.ts');   // (the kill from the hold as the check stages it: one staging, two readers)
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { RAG } = await import(`${ROOT}/src/game/ragdoll.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const SLM: any = await import(`${ROOT}/src/game/silent.ts`);
const PM: any = await import(`${ROOT}/src/game/pairorders.ts`);
type P3 = number[];
const DT = 1 / 60, DEG = Math.PI / 180, EAST = Math.PI / 2, LOBBY: P3 = [9.5, 0, 19.5];
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const log = console.log; const hush = () => { console.log = console.warn = () => {}; }, loud = () => { console.log = log; };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- what a moment keeps
const BONES = ['hips', 'spine2', 'chest', 'neck', 'head', 'thighL', 'shinL', 'footL', 'toeL', 'thighR', 'shinR', 'footR', 'toeR', 'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR'];
/** a man as five chains of points + his hands + where his face points (unit, on the plan; null once he is a ragdoll) */
interface Man { legL: P3[]; legR: P3[]; trunk: P3[]; armL: P3[]; armR: P3[]; head: P3; face: P3 | null; rag: boolean }
interface Moment { label: string; a: Man; v: Man }
function manOf(c: any, rel: (p: P3) => P3, dir: (d: P3) => P3): Man {
  const rag = c.ragdoll;
  if (rag) { const P = (i: number) => rel(rag.point(i)); const hip = rel(v3.lerp(rag.point(RAG.hipL), rag.point(RAG.hipR), 0.5));
    return { legL: [P(RAG.hipL), P(RAG.kneeL), P(RAG.ankL)], legR: [P(RAG.hipR), P(RAG.kneeR), P(RAG.ankR)], trunk: [hip, P(RAG.spine), P(RAG.neck), P(RAG.head)], armL: [P(RAG.shoL), P(RAG.elbL), P(RAG.handL)], armR: [P(RAG.shoR), P(RAG.elbR), P(RAG.handR)], head: P(RAG.head), face: null, rag: true }; }
  const b: Record<string, P3> = {}; for (const k of BONES) b[k] = rel(c.bones[k] ?? c.pos);
  const y = c.bodyYaw + (c.anim?.headYawShown ?? 0);
  return { legL: [b.hips, b.thighL, b.shinL, b.footL, b.toeL], legR: [b.hips, b.thighR, b.shinR, b.footR, b.toeR], trunk: [b.hips, b.spine2, b.chest, b.neck, b.head], armL: [b.chest, b.upperArmL, b.forearmL, b.handL], armR: [b.chest, b.upperArmR, b.forearmR, b.handR], head: b.head, face: dir([Math.sin(y), 0, Math.cos(y)]), rag: false };
}
/** the recorder of one move: the frame is the victim's, fixed where he stood when `begin` was called */
function recorder(att: any, vic: any) {
  let o: P3 = [0, 0, 0], f: P3 = [0, 0, 1], L: P3 = [1, 0, 0]; const moments: Moment[] = [];
  const dir = (d: P3): P3 => [d[0] * L[0] + d[2] * L[2], d[1], d[0] * f[0] + d[2] * f[2]];
  const rel = (p: P3): P3 => dir([p[0] - o[0], p[1], p[2] - o[2]]);
  return { moments,
    begin() { o = [vic.char.pos[0], 0, vic.char.pos[2]]; const y = vic.char.bodyYaw; f = [Math.sin(y), 0, Math.cos(y)]; L = [f[2], 0, -f[0]]; },
    snap(label: string) { moments.push({ label, a: manOf(att.char, rel, dir), v: manOf(vic.char, rel, dir) }); } };
}

// ---------------------------------------------------------------- the stagings
function place(gd: any, p: P3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; place(gd, [37.5, 0, 6 + i * 1.5], EAST); gd.heardUpTo = 1e12; }
/** the lobby's open floor: one man planted facing east, calm, the others parked; Sam's hands empty, unhurtable, nobody perceiving anything */
async function lobby(seed: number) {
  Math.random = seeded(seed); hush(); const W: any = await standUp(); loud(); const g = W.game; CLOSE.on = true;
  g.godMode = true; g.aiEnabled = false; g.player.visibility = 0.02; g.player.slot = 'pistol'; g.player.holstered = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = g.guards; park(B, 0); park(C, 1); place(A, LOBBY, EAST); A.wp = 1; A.hold = true;
  W.cam.yaw = 0; W.cam.rebuild?.();
  const step = (n = 1) => { for (let i = 0; i < n; i++) { W.step(DT); g.player.visibility = 0.02; } };
  const samAt = (bDeg: number, d: number, crouch = false) => { const a = A.char.bodyYaw + bDeg * DEG; g.teleportPlayer([A.char.pos[0] + Math.sin(a) * d, 0, A.char.pos[2] + Math.cos(a) * d]); g.player.crouch = crouch;
    const pl = g.player.char; pl.bodyYaw = pl.aimYaw = Math.atan2(A.char.pos[0] - pl.pos[0], A.char.pos[2] - pl.pos[2]); W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); step(20); };
  return { W, g, A, step, samAt };
}
/** the seconds after the blow starts at which a blow's strip looks (contact is 0.28 s, control back 0.62 s — player.ts) */
const BLOW_AT = [0, 0.1, 0.2, 0.28, 0.36, 0.48, 0.62, 0.9, 1.3, 2.4];
async function blow(bDeg: number, dist: number, lethal: boolean) {
  const S = await lobby(7001), { g, A } = S; S.samAt(bDeg, dist);
  const R = recorder(g.player, A); R.begin(); S.step(1); R.snap('ready');
  startTakedown(g, A, undefined, lethal); let f = 0;
  for (const t of BLOW_AT.slice(1)) { const n = Math.round(t * 60); S.step(n - f); f = n; R.snap(`${t.toFixed(2)} s${t === 0.28 ? ' · it lands' : t === 0.62 ? ' · his again' : ''}`); }
  return R.moments;
}
async function hold(end: 'choke' | 'whip' | 'kill', beats = false) {
  const S = await lobby(7002), { W, g, A } = S; S.samAt(180, 0.8, true); g.player.holstered = end !== 'whip'; S.step(2);
  const ahead = () => { const c = g.player.char; W.cursorAt([c.pos[0] + Math.sin(c.bodyYaw) * 6, 1.0, c.pos[2] + Math.cos(c.bodyYaw) * 6]); };
  const R = recorder(g.player, A); R.begin(); R.snap('behind him');
  startGrab(g, A); let f = 0; const to = (t: number, label: string) => { const n = Math.round(t * 60); for (; f < n; f++) { ahead(); S.step(1); } R.snap(label); };
  if (end === 'kill') {   // the kill's own clock, the cut marked; then the fall
    const T = HOLD.secs.kill, hit = HOLD.kill.hit * T; to(1.5, 'held'); setHoldPhase(g, 'kill'); const t0 = 1.5;   // (the phase put on and ended as takedown-check.ts stages it: a build whose own rule ends it is left to)
    const run = (t: number, label: string) => { const n = Math.round((t0 + t) * 60); for (; f < n; f++) { ahead(); S.step(1); killEnd(g); } R.snap(label); };
    for (const u of [0.12, 0.25]) run(u * T, `kill ${(u * T).toFixed(2)} s`);
    run(hit, `${hit.toFixed(2)} s · the cut`); for (const u of [0.42, 0.5, 0.62, 0.75, 0.88]) run(u * T, `kill ${(u * T).toFixed(2)} s`);
    run(T, `${T.toFixed(2)} s · let go`); run(T + 0.3, '+0.3 s'); run(T + 0.7, '+0.7 s'); run(T + 2.6, 'at rest');
    return R.moments;
  }
  if (beats) {   // the choke against the clips' beats: shares of its own clock (it starts HOLD.secs.chokeHold after the tap)
    to(1.5, 'held'); g.selectVerb('held', 'choke'); W.input.pressed.add('Space'); const t0 = 1.5 + HOLD.secs.chokeHold + 1 / 60, C = HOLD.secs.choke;
    for (const u of [0, 0.04, 0.1, 0.3, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9, 0.99]) to(t0 + u * C, `choke ${Math.round(u * 100)} % (${(u * C).toFixed(2)} s)`);
    to(t0 + C + 0.4, '+0.4 s'); to(t0 + C + 1, '+1.0 s'); to(t0 + C + 2.6, 'at rest');
    return R.moments;
  }
  to(0.12, 'grab 0.12 s'); to(0.25, 'grab 0.25 s'); to(0.45, 'grab 0.45 s'); to(1.5, 'held');
  g.selectVerb('held', end); W.input.pressed.add('Space'); const t0 = 1.5;
  if (end === 'choke') { to(t0 + 0.35, 'choke 0.35 s'); to(t0 + 1.2, 'choke 1.2 s'); to(t0 + 2.2, 'choke 2.2 s'); to(t0 + 2.95, 'choke 2.95 s'); to(t0 + 3.3, '+0.35 s'); to(t0 + 3.8, '+0.85 s'); to(t0 + 5.2, 'at rest'); }
  else { to(t0 + 0.15, 'whip 0.15 s'); to(t0 + 0.3, 'whip 0.30 s'); to(t0 + 0.45, 'whip 0.45 s'); to(t0 + 0.53, 'whip 0.53 s · coming down'); to(t0 + 0.6, 'whip 0.60 s'); to(t0 + 0.8, '+0.2 s'); to(t0 + 1.2, '+0.6 s'); to(t0 + 2.8, 'at rest'); }
  return R.moments;
}
/** the partner's: the room clear on the office with ONE teammate, silent; a defender stood on the open aisle, the partner told 'take him now' */
async function partner() {
  Object.assign(NIGHTBREACH, { squad: 1 }); Math.random = seeded(10); hush(); const W: any = await standUp(); const g = W.game;
  Object.assign(SLM.SILENT, { on: true }); Object.assign(PM.PAIR, { on: true }); g.godMode = true;
  const why = g.roomClear.start(10); loud(); if (why) throw new Error(`partner: the room clear did not start: ${why}`);
  const O = g.orders, step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
  step(30); SLM.setSilent(g, true); step(2);
  const mate = O.squad()[0], foe = g.guards.find((h: any) => h.callsign === 'Tango 1');
  const put = (gd: any, p: P3, yaw: number) => { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.lastPos = [p[0], 0, p[2]]; gd.path = []; gd.pathGoal = null; };
  put(foe, [22, 0, 17.6], EAST); foe.hold = true; put(mate, [19, 0, 17.6], EAST); g.teleportPlayer([11, 0, 18.5]); step(30);
  const no = O.give('pairTake', { kind: 'foe', at: [foe.char.pos[0], 0, foe.char.pos[2]], foe }); if (no) throw new Error(`partner: 'take him now' refused: ${no}`);
  const R = recorder(mate, foe); const hands = () => PM.PAIR_LOG.some((x: any) => String(x.what).startsWith('hands:'));
  let n = 0; while (!hands() && n++ < 900) { step(1); if (n % 20 === 0 && flat(mate.char.pos, foe.char.pos) < 2.2 && R.moments.length < 2) { R.begin(); R.snap('closing'); } }
  if (!hands()) throw new Error(`partner: his hands never went on (${PM.PAIR_LOG.map((x: any) => x.what).join(' | ')})`);
  R.begin(); R.snap('hands on · 0.00 s'); let f = 0;
  for (const t of [0.15, 0.3, 0.45, 0.6, 0.7, 0.9, 1.3, 2.6]) { const k = Math.round(t * 60); step(k - f); f = k; R.snap(`${t.toFixed(2)} s${t === 0.6 ? ' · out cold' : ''}`); }
  return R.moments;
}
const flat = (a: P3, b: P3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const MOVES: Record<string, { title: string; run: () => Promise<Moment[]> }> = {
  'knockout-behind': { title: 'the knockout from behind', run: () => blow(180, 0.6, false) },
  'knockout-side': { title: 'the knockout from his left side', run: () => blow(90, 0.8, false) },
  'knockout-front': { title: 'the knockout from in front', run: () => blow(0, 0.75, false) },
  'knife-behind': { title: 'the knife from behind', run: () => blow(180, 0.6, true) },
  'knife-side': { title: 'the knife from his left side', run: () => blow(90, 0.8, true) },
  'knife-front': { title: 'the knife from in front', run: () => blow(0, 0.75, true) },
  'grab-choke': { title: 'the grab from behind, the hold, the choke', run: () => hold('choke') },
  'grab-whip': { title: 'the grab from behind with the pistol out, the pistol whip', run: () => hold('whip') },
  'grab-kill': { title: 'the hold, the kill: a hand over his mouth, the blade across his throat and out wide, let down forward', run: () => hold('kill') },
  'choke-beats': { title: "the hold, the choke at the clips' beats (shares of its own clock)", run: () => hold('choke', true) },
  'partner': { title: "the partner's takedown ('take him now')", run: partner },
};

// ---------------------------------------------------------------- the drawing
const K = 92, CW = 232, RH = 214, TOPH = 190, PAD = 14, HEAD = 46;
const COL = { a: { l: '#7d93b8', r: '#3f5f96', t: '#23324d' }, v: { l: '#e0a070', r: '#b5622f', t: '#8a3d18' } };
function draw(title: string, ms: Moment[]): string {
  const Wd = PAD * 2 + ms.length * CW, Ht = HEAD + RH * 2 + TOPH + 26;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${Ht}" font-family="system-ui, sans-serif" font-size="12"><rect width="100%" height="100%" fill="#f6f4ee"/><text x="${PAD}" y="20" font-size="15" font-weight="600">${title}</text><text x="${PAD}" y="37" fill="#555">blue = the one doing it · orange = the one it is done to · darker limb = his right · row 1 from his right side (he faces right) · row 2 from in front of him · row 3 from above (he faces right)</text>`;
  ms.forEach((m, i) => { const ox = PAD + i * CW, cx = ox + CW / 2;
    const views: [(p: P3) => number, (p: P3) => number, number][] = [
      [p => cx - 14 + p[2] * K, p => HEAD + RH - 22 - p[1] * K, 0],
      [p => cx + p[0] * K, p => HEAD + RH * 2 - 22 - p[1] * K, 1],
      [p => cx - 14 + p[2] * K, p => HEAD + RH * 2 + TOPH / 2 + p[0] * K, 2]];
    for (const [x, y, vi] of views) { const top = HEAD + (vi === 2 ? RH * 2 : vi * RH), h = vi === 2 ? TOPH : RH;
      s += `<clipPath id="c${i}_${vi}"><rect x="${ox + 2}" y="${top + 2}" width="${CW - 4}" height="${h - 6}"/></clipPath><rect x="${ox + 2}" y="${top + 2}" width="${CW - 4}" height="${h - 6}" fill="#fff" stroke="#d9d4c7"/>`;
      if (vi < 2) s += `<line x1="${ox + 2}" y1="${top + RH - 22}" x2="${ox + CW - 2}" y2="${top + RH - 22}" stroke="#8a8272" stroke-width="2"/>`;
      s += `<g clip-path="url(#c${i}_${vi})">`;
      // the nearer man is drawn last: from his right side the nearer is the one further to his right (smaller x in his frame); from in front, further forward
      const depth = (M: Man) => vi === 0 ? -M.trunk[1][0] : vi === 1 ? M.trunk[1][2] : M.trunk[1][1];
      const order: ['a' | 'v', Man][] = [['a', m.a], ['v', m.v]]; order.sort((p, q) => depth(p[1]) - depth(q[1]));
      for (const [who, M] of order) { const c = COL[who]; const line = (pts: P3[], col: string, w: number) => `<polyline fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="0.92" points="${pts.map(p => `${x(p).toFixed(1)},${y(p).toFixed(1)}`).join(' ')}"/>`;
        const far = vi === 0 ? 'L' : null;   // (from his right side his left limbs are the far ones)
        const parts: [P3[], string, number][] = [[M.legL, c.l, 8], [M.armL, c.l, 6], [M.trunk, c.t, 12], [M.legR, c.r, 8], [M.armR, c.r, 6]];
        if (far !== 'L') parts.sort((p, q) => (p[0] === M.trunk ? 0 : 1) - (q[0] === M.trunk ? 0 : 1));
        for (const [pts, col, w] of parts) s += line(pts, col, w);
        const hx = x(M.head), hy = y(M.head) - (vi < 2 ? 6 : 0); s += `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="10" fill="${c.t}" opacity="0.92"/>`;
        if (M.face) { const tip: P3 = [M.head[0] + M.face[0] * 0.2, M.head[1], M.head[2] + M.face[2] * 0.2]; s += `<line x1="${hx.toFixed(1)}" y1="${hy.toFixed(1)}" x2="${x(tip).toFixed(1)}" y2="${(y(tip) - (vi < 2 ? 6 : 0)).toFixed(1)}" stroke="${c.t}" stroke-width="4" stroke-linecap="round"/>`; }
        for (const [h, col] of [[M.armL[M.armL.length - 1], c.l], [M.armR[M.armR.length - 1], c.r]] as [P3, string][]) s += `<circle cx="${x(h).toFixed(1)}" cy="${y(h).toFixed(1)}" r="4.5" fill="#fff" stroke="${col}" stroke-width="2.5"/>`; }
      s += '</g>'; }
    s += `<text x="${cx}" y="${HEAD + RH * 2 + TOPH + 14}" text-anchor="middle">${m.label}</text>`; });
  return s + '</svg>';
}

// ---------------------------------------------------------------- run
if (process.argv.includes('--list')) { for (const [k, m] of Object.entries(MOVES)) log(`${k.padEnd(18)} ${m.title}`); process.exit(0); }
const want = arg('--move')?.split(',') ?? Object.keys(MOVES), tag = arg('--tag'), dir = resolve(arg('--out') ?? `${ROOT}/docs/shots/takedowns`); mkdirSync(dir, { recursive: true });
const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'; let SHELL: string | null = null; if (existsSync(base)) for (const dd of readdirSync(base)) { const x = `${base}/${dd}/chrome-linux/headless_shell`; if (existsSync(x)) SHELL = x; }
let bad = 0;
for (const id of want) { const M = MOVES[id]; if (!M) { log(`unknown move '${id}' (--list)`); bad++; continue; }
  try { const ms = await M.run(); const s = draw(`${M.title}${tag ? ` — ${tag}` : ''}`, ms), out = `${dir}/${id}${tag ? '-' + tag : ''}`; writeFileSync(`${out}.svg`, s);
    const m = /width="(\d+)" height="(\d+)"/.exec(s)!; const r = SHELL ? spawnSync(SHELL, ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--screenshot=${out}.png`, `--window-size=${m[1]},${m[2]}`, `file://${out}.svg`]) : null;
    log(`${out}.svg${r && r.status === 0 ? ' (+ .png)' : ''} · ${ms.length} moments`); }
  catch (e) { loud(); log(`${id}: ${e instanceof Error ? e.stack : String(e)}`); bad++; } }
process.exit(bad ? 1 : 0);
