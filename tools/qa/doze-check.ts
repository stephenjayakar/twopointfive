// DOZING IN THE DARK — the check behind src/game/doze.ts (DOZE.on: on in the page, ?nodoze; off on the frozen stand, TPS_DOZE=1).
//   bun run tools/qa/doze-check.ts        (also `probes.ts doze`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
// The police post's quiet mission (its hand-set deal), the shift on its own beats, Sam out of everybody's sight unless a line says so, the switch (and the close-in
// seat it sits a man with, CLOSE.on) thrown by hand:
//   (a) a man with a long wait in the dark bunk room sits in the chair there and sleeps: seated on the chair, his place dark, his torch out, the 'z' over him;
//   (b) asleep his eyes are shut: Sam stood lit in front of him for three seconds is not seen — and the same man standing the same wait awake (switch off) sees him;
//   (b2) the partner's sneak reads his eyes the same way: dark floor at a sleeper's elbow is not watched, at the same man's elbow awake it is;
//   (c) his ears are dull, not gone: crouched steps beside the chair and a walking step 2.8 m off do not wake him; a walking step beside the chair and a
//       running step 3.4 m off do;
//   (d) woken by a noise he is suspicious on the frame, placed on the noise, rooted while he comes round, out of the chair — and awake for the rest of the run;
//       a whistle beside him wakes him and he is the one who answers it;
//   (e) light on his face wakes him; (f) his chair shoved wakes him; (g) the floor going up has him on his feet;
//   (h) from behind, the close-in mode offers the take over the chair;
//   (i) the timetable stands: he leaves that waypoint when he does with the switch off;
//   (j) nobody sleeps in a lit place, over four minutes of the shift; the relay's picket (a 110 s stand in the dark, the lit door in his eye) never sits;
//   AT A SCREEN (the police post's terminal, built off, on the bunk room's footlocker):
//   (m) a man with a short wait in the dark pulls the chair up, sits to it and switches it on: facing it, its light on his face, torch out, awake, '♪' over him;
//   (n) headphones on: a walking step near him counts for less (or nothing) and he stays; running steps beside him have him up, the screen left on;
//   (n2) with the attention rule on, his attention is the screen's (a lent hold; the eye narrowed to the side of it) and the headphones count once;
//   (o) the screen going dark under his eyes has him up and looking at it;
//   (o2) got up from the screen, or hauled out of the chair, he leaves it lit, and it goes dark by itself `idleSecs` on;
//   (p) a checkpoint carries him: forty seconds after a load, twice, are the forty the game went on to — same words, up on time, the screen off again;
//   (q) six minutes of the shift: the one chair is a short wait's screen and a long wait's bed, one man at the screen at a time, nobody asleep by a lit screen;
//   (r) the half-switch DOZE.screen off: nobody sits to it, it stays dark, the men doze as they did;
//   (k) a checkpoint carries it: every man's record after a load is his record at the save, and ten seconds after a load, twice, are the same game;
//   (l) the switch off = the base: nobody is met, nobody sits, and a seeded minute digests as the stand that never had the rule on.
// DOZE_BREAK=1 = the rule left on for the 'off' lines: (l) must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');

function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

export async function dozeCheck(): Promise<boolean> {
  const { standUp } = await import('./headless.ts');
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { DOZE, DOZE_STATS, DOZE_LOG, dozeOf, dozeMark, dozeAsleep, dozeWoke, dozeAt, dozeLines } = await import(`${ROOT}/src/game/doze.ts`);
  const { CLOSE, closeAt, closeKindOf, closeSeated } = await import(`${ROOT}/src/game/close.ts`);
  const { workLit } = await import(`${ROOT}/src/game/calmtorch.ts`);
  const { raiseEscalation, lightEstimateAt, sightGain } = await import(`${ROOT}/src/game/guards.ts`);
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { sneakWalk } = await import(`${ROOT}/src/game/sneak.ts`);
  const { ATTENTION, attentionOf, attentionSideK, attentionOffDeg, attentionMarks } = await import(`${ROOT}/src/game/attention.ts`);
  const DT = 1 / 60, rnd0 = Math.random, was = { ...DOZE }, closeWas = CLOSE.on, BREAK = process.env.DOZE_BREAK === '1'; let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== doze: a calm man with a long wait in the dark sits in the chair there and sleeps; what wakes him ===');
  const text = readFileSync(resolve(ROOT, 'levels/police-post.json'), 'utf8');
  /** the police post's quiet mission, its hand-set deal (start 0 / spot 0 / patrol set 0), Sam unseen and unhurt — with the level's lived-in furniture on either stand
   *  (the bunk room's chair is part of it: the frozen stand leaves that furniture out) */
  const stand = async (seed: number, on = true) => { Math.random = seeded(seed);
    const W: any = await quiet(() => standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(text), { lived: true }) })); const g = W.game;
    DOZE.on = on; CLOSE.on = true;   // (after the stand-up: the frozen stand holds both off as it stands a game up)
    await quiet(() => { let pin = 0; for (; pin < 400; pin++) { const r = startFromQuery(g, `?quiet=${pin}`); if (r.why) throw new Error(`doze-check: the quiet mission would not start — ${r.why}`); const d = g.quiet.deal; if (d.start === 0 && d.spot === 0 && Math.max(0, d.patrol) === 0) break; } });
    g.playerInvisible = true; g.godMode = true; Math.random = seeded(seed + 1000); return W; };
  const staff = (g: any) => g.guards.filter((x: any) => !x.unit && x.team === 'guard');
  const flat = (a: any, b: any) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const chairOf = (g: any, gd: any) => g.props.props.filter((p: any) => p.def.kind === 'chair').sort((a: any, b: any) => Math.hypot(a.x - gd.char.pos[0], a.z - gd.char.pos[2]) - Math.hypot(b.x - gd.char.pos[0], b.z - gd.char.pos[2]))[0];
  /** step until a man with at least `left` s of his wait to go is asleep (the long wait: Reyes's forty-eight seconds in the bunk room) */
  const untilAsleep = (W: any, left = 30, cap = 120): any => { const g = W.game; for (let i = 0; i < cap * 60; i++) { W.step(DT); const m = staff(g).find((x: any) => dozeAsleep(x) && x.wait > left); if (m) return m; } return null; };
  /** a point `d` m from him with clear air and free floor between */
  const clearPoint = (g: any, gd: any, d: number): any => { const p = gd.char.pos; for (let k = 0; k < 72; k++) { const a = k * Math.PI / 36, q = [p[0] + Math.sin(a) * d, 0, p[2] + Math.cos(a) * d];
    if (!g.col.nav.isBlocked(q[0], q[2]) && !g.col.segmentBlocked([p[0], 1.2, p[2]], [q[0], 1.2, q[2]]) && !g.col.segmentBlocked([p[0], 0.4, p[2]], [q[0], 0.4, q[2]])) return q; } return null; };
  /** one of Sam's footfalls at a point, at a gait's level (player.ts: crouched 0.125, walking 0.26, running 0.6 — × the floor's) — heard for `frames` frames with Sam
   *  himself a man whose noise counts (the sandbox's invisible Sam makes none), then unseen again */
  const step = (W: any, at: any, level: number, frames: number) => { const g = W.game; g.playerInvisible = false; g.events.push({ kind: 'step', pos: [at[0], 0, at[2]], time: g.time, loud: false, level }); for (let i = 0; i < frames; i++) W.step(DT); g.playerInvisible = true; };
  /** a point in front of him, inside his cone, with clear air from his eyes to a standing man's chest and floor to stand on — where the game then really puts Sam */
  const frontPoint = (g: any, gd: any): any => { const p = gd.char.pos; for (const d of [2.2, 1.8, 2.6, 1.5]) for (const a of [0, 0.26, -0.26, 0.52, -0.52, 0.78, -0.78]) { const y = gd.char.bodyYaw + a, q = [p[0] + Math.sin(y) * d, 0, p[2] + Math.cos(y) * d];
    if (g.col.nav.isBlocked(q[0], q[2]) || g.col.segmentBlocked([p[0], 1.15, p[2]], [q[0], 1.1, q[2]]) || g.col.segmentBlocked([p[0], 1.15, p[2]], [q[0], 0.5, q[2]])) continue;
    g.teleportPlayer(q); if (flat(g.player.char.pos, q) < 0.35) return q; } return null; };
  const same = (g: any, name: string) => staff(g).find((x: any) => x.callsign === name);

  try {
    // (a) he sits and sleeps
    const W = await stand(21), g = W.game; const man = untilAsleep(W);
    if (!man) { line(false, 'a man with a long wait in the dark sits in the chair there and sleeps', 'nobody slept inside two minutes'); return false; }
    const name = man.callsign, ch = chairOf(g, man), sleptAt = g.time;
    { const c = man.char, hips = [c.pos[0] - Math.sin(c.bodyYaw) * 0.33, 0, c.pos[2] - Math.cos(c.bodyYaw) * 0.33];
      for (let i = 0; i < 90; i++) W.step(DT);   // (the slump eases in)
      const onChair = flat(hips, [ch.x, 0, ch.z]), dark = !workLit(g, c.pos[0], c.pos[2]), torch = !!man.flashlight.enabled, clip = c.anim.act?.clip ?? '-';
      line(onChair < 0.2 && dark && !torch && closeSeated(g, man) && clip === 'Sitting_Idle_Loop' && c.anim.slump === 1 && dozeMark(g, man) !== '' && man.state === 'patrol',
        'a man with a long wait in the dark sits in the chair there and sleeps: on the chair, his place dark, his torch out, the mark over him',
        `${name} asleep ${sleptAt.toFixed(1)} s in, ${man.wait.toFixed(0)} s of his ${man.route.wait[man.wp]} s wait to go · hips ${onChair.toFixed(2)} m off the chair · place ${dark ? 'dark' : 'LIT'} · torch ${torch ? 'BURNING' : 'out'} · clip ${clip} · mark '${dozeMark(g, man)}'`); }
    const recs = () => JSON.stringify(staff(g).map((x: any) => { const r = dozeOf(x); return r ? [x.callsign, r.phase, r.wp, r.why, +r.secs.toFixed(3)] : [x.callsign]; }));
    const snap = W.snapshot('doze', true), recs0 = recs();
    const back = () => { Math.random = seeded(77); W.restore(snap); const m = same(g, name); for (let i = 0; i < 60; i++) W.step(DT); return m; };   // (a second for the clip to have him down again)

    // (b) eyes shut
    { const m = back(), c = m.char; for (const o of staff(g)) if (o !== m) o.dazzledUntil = g.time + 10;   // (the others see nothing for the look: the line is about HIS eyes — a mate awake in the same room would see Sam and raise the floor)
      g.playerInvisible = false; const front = frontPoint(g, m); g.player.crouch = true; let peak = 0;
      for (let i = 0; i < 180; i++) { g.player.visibility = 1; W.step(DT); peak = Math.max(peak, m.awareness); }
      const still = dozeAsleep(m); g.playerInvisible = true;
      // the same man, the same wait, awake
      const W2 = await stand(21, false), g2 = W2.game; let m2: any = null; for (let i = 0; i < 120 * 60 && !m2; i++) { W2.step(DT); const x = same(g2, name); if (x.wp === m.wp && x.wait > 30) m2 = x; }
      let peak2 = 0; if (m2) { const c2 = m2.char; m2.hold = true; for (const o of staff(g2)) if (o !== m2) o.dazzledUntil = g2.time + 10; g2.playerInvisible = false;
        if (!frontPoint(g2, m2)) { const q = clearPoint(g2, m2, 2.2) ?? clearPoint(g2, m2, 1.8); if (q) { c2.bodyYaw = c2.aimYaw = Math.atan2(q[0] - c2.pos[0], q[2] - c2.pos[2]); g2.playerInvisible = true; for (let i = 0; i < 20; i++) W2.step(DT); g2.playerInvisible = false; g2.teleportPlayer(q); } }   // (no floor in front of him as he happens to stand: he is turned to face floor that is)
        g2.player.crouch = true;   // (held on his mark for the look: awake he sweeps his head about, and the line is about his eyes, not his neck)
        for (let i = 0; i < 180; i++) { g2.player.visibility = 1; W2.step(DT); peak2 = Math.max(peak2, m2.awareness); if (m2.state !== 'patrol') break; } }
      DOZE.on = true;
      line(!!front && still && peak < 0.05 && !!m2 && peak2 >= 0.3, 'asleep his eyes are shut: Sam stood lit two metres in front of him for three seconds is not seen — awake at the same wait he is', `asleep: ${front ? '' : 'NO FLOOR IN FRONT OF HIM · '}awareness peaked ${peak.toFixed(2)}, still asleep ${still} · awake (switch off): ${m2 ? `peaked ${peak2.toFixed(2)}, ${m2.state}` : 'never stood that wait'}`); }

    // (b2) the partner's sneak reads his eyes the same way (sneak.ts sneakWalk; eyesFor takes the same skip): of the dark floor all round a sleeper at an elbow's
    //      length, with a line to his head, none is watched — round the same man awake at the same wait, some is (the control: the ring, the line and the walker are the same)
    { const m = back(); const mateOf = (G: any) => ({ team: 'player', unit: {}, char: G.player.char, visibility: 0, irradiance: 0 });   // (a walker the staff are hostile to on a solo stand: Sam's side — on a partner's run teams.ts staffVsOperatives makes the operative one)
      const ring = (G: any, x: any) => { for (const o of staff(G)) if (o !== x) o.dazzledUntil = G.time + 10;   /* (HIS eyes: the sneak leaves a dazzled man out, and a mate awake in the next room would watch the same floor) */ const p = x.char.pos, eye = x.char.bones.head ?? [p[0], 1.6, p[2]], S = sneakWalk(G, mateOf(G), true); let clear = 0, seen = 0;
        for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12, q = [p[0] + Math.sin(a) * 1.3, 0, p[2] + Math.cos(a) * 1.3];
          if (G.col.nav.isBlocked(q[0], q[2]) || G.col.segmentBlocked(eye, [q[0], 1.0, q[2]]) || G.col.segmentBlocked(eye, [q[0], 0.5, q[2]])) continue; clear++; if (S.watched(q[0], q[2])) seen++; }
        return { clear, seen }; };
      const asleep = ring(g, m), still = dozeAsleep(m);
      const W3 = await stand(21, false), g3 = W3.game; let m3: any = null; for (let i = 0; i < 120 * 60 && !m3; i++) { W3.step(DT); const x = same(g3, name); if (x.wp === m.wp && x.wait > 30) m3 = x; }
      const awake = m3 ? ring(g3, m3) : { clear: 0, seen: 0 }; DOZE.on = true;
      line(still && asleep.clear >= 4 && asleep.seen === 0 && awake.clear >= 4 && awake.seen > 0, 'the partner\'s sneak reads him the same way: of the dark floor round a sleeper at an elbow\'s length none is watched — round the same man awake, some is',
        `asleep: ${asleep.seen} of ${asleep.clear} places with a line to his head watched · awake (switch off, the same wait): ${m3 ? `${awake.seen} of ${awake.clear}` : 'NEVER AT THAT WAIT'}`); }

    // (c) dull ears
    { let m = back(); const near = clearPoint(g, m, 1.0), far = clearPoint(g, m, 3.4), mid = clearPoint(g, m, 2.8);
      if (!near || !far || !mid) line(false, 'his ears are dull, not gone', 'no clear air round the chair to make the noises in');
      else {
        for (let i = 0; i < 12; i++) step(W, near, 0.125, 20); const crouch = dozeAsleep(m);
        step(W, mid, 0.26, 5); const walkFar = dozeAsleep(m);
        step(W, near, 0.26, 3); const walkNear = !dozeAsleep(m);
        m = back(); step(W, far, 0.6, 3); const run = !dozeAsleep(m);
        line(crouch && walkFar && walkNear && run, 'his ears are dull, not gone: crouched steps beside the chair and a walking step across the room leave him asleep; a walking step beside it and a run across the room wake him',
          `twelve crouched steps at 1 m: ${crouch ? 'asleep' : 'WOKE'} · a walking step at 2.8 m: ${walkFar ? 'asleep' : 'WOKE'} · a walking step at 1 m: ${walkNear ? 'woke' : 'SLEPT ON'} · a running step at 3.4 m: ${run ? 'woke' : 'SLEPT ON'}`); } }

    // (d) woken by a noise
    { const m = back(), at = clearPoint(g, m, 1.0), p0 = [m.char.pos[0], 0, m.char.pos[2]]; step(W, at, 0.26, 2);
      const sus = m.state === 'suspicious', placed = !!m.lastKnown && flat(m.lastKnown, at) < 0.6, seated = closeSeated(g, m), why = dozeWoke(g, m);
      let moved = 0; for (let i = 0; i < Math.floor((DOZE.stirSecs - 0.15) / DT); i++) { W.step(DT); moved = Math.max(moved, flat(m.char.pos, p0)); }
      let again = false; for (let i = 0; i < 240 * 60 && !again; i++) { W.step(DT); if (dozeAsleep(m)) again = true; }
      line(sus && placed && !seated && why === 'noise' && moved < 0.45 && !again, 'woken by a noise: suspicious on the frame, placed on the noise, out of the chair, rooted while he comes round — and awake for the four minutes after',
        `two frames on: ${m.state === 'patrol' && !sus ? 'still calm' : sus ? 'suspicious' : m.state} · fix ${m.lastKnown ? flat(m.lastKnown, at).toFixed(2) + ' m off the noise' : 'none'} · seated ${seated} · woken by ${why} · moved ${moved.toFixed(2)} m in the first ${(DOZE.stirSecs - 0.15).toFixed(2)} s · slept again ${again}`); }

    // (d2) a whistle beside him is his to answer
    { const m = back(), at = clearPoint(g, m, 1.0); const { WHISTLE, WHISTLE_LOG } = await import(`${ROOT}/src/game/whistle.ts`);
      g.playerInvisible = false; g.events.push({ kind: 'whistle', pos: [at[0], 0, at[2]], time: g.time, loud: false, level: WHISTLE.level, who: 1 }); for (let i = 0; i < 3; i++) W.step(DT); g.playerInvisible = true;
      const L = WHISTLE_LOG[WHISTLE_LOG.length - 1];
      line(!dozeAsleep(m) && dozeWoke(g, m) === 'noise' && L?.answered === m.callsign && m.state === 'suspicious', 'a whistle beside him is his to answer, as it is a waking man\'s: it wakes him and he is the one who comes', `asleep ${dozeAsleep(m)} · woken by ${dozeWoke(g, m)} · the whistle: heard by ${L?.hearers?.join('/') || 'nobody'}, answered by ${L?.answered ?? 'NOBODY'} · ${m.state}`); }

    // (e) light on his face
    { const m = back(), head = m.char.bones.head ?? [m.char.pos[0], 1.15, m.char.pos[2]], f = [Math.sin(m.char.bodyYaw), 0, Math.cos(m.char.bodyYaw)];
      const l = g.engine.lights.lights.find((x: any) => x.enabled && !x.owner && x.kind !== 2 && !(x.ttl >= 0)), keep = l ? { pos: [...l.pos], range: l.range, intensity: l.intensity, kind: l.kind, radius: l.radius } : null; let at = -1;
      if (l) { for (let i = 0; i < 180 && at < 0; i++) { l.pos[0] = head[0] + f[0] * 0.8; l.pos[1] = head[1] + 0.6; l.pos[2] = head[2] + f[2] * 0.8; l.kind = 0; l.range = Math.max(l.range, 6); l.intensity = Math.max(l.intensity, 6); W.step(DT); if (!dozeAsleep(m)) at = i + 1; }
        Object.assign(l, { range: keep!.range, intensity: keep!.intensity, kind: keep!.kind }); l.pos[0] = keep!.pos[0]; l.pos[1] = keep!.pos[1]; l.pos[2] = keep!.pos[2]; }
      const lim = Math.ceil((DOZE.lightSecs + 2 * DOZE.askSecs) / DT) + 2;
      line(at > 0 && at <= lim && dozeWoke(g, m) === 'light' && m.awareness >= 0.3, 'light on his face wakes him inside the dwell, suspicious', l ? `a lamp put a metre off his face: ${at < 0 ? 'SLEPT ON for three seconds' : `woke ${(at * DT).toFixed(2)} s on`} (the bar ${(lim * DT).toFixed(2)} s) · woken by ${dozeWoke(g, m)}` : 'the level has no lamp to move'); }

    // (f) the chair shoved · (g) the floor going up
    { let m = back(); const c0 = chairOf(g, m); c0.pushT = g.time; c0.lastWho = 1; W.step(DT); W.step(DT); const bump = dozeWoke(g, m) === 'bump' && m.state === 'suspicious' && !closeSeated(g, m);
      m = back(); await quiet(() => raiseEscalation(g, 1)); W.step(DT); W.step(DT); const up = !dozeAsleep(m) && !closeSeated(g, m), why = dozeWoke(g, m);
      line(bump && up, 'his chair shoved wakes him suspicious; the floor going up has him out of the chair', `shoved: ${bump ? 'woke (bump), suspicious' : `${dozeWoke(g, m)} / ${m.state}`} · alarm raised: ${up ? `up (${why})` : 'STILL IN THE CHAIR'}`); }

    // (h) the take over the chair
    { const m = back(), c = m.char, behind = [c.pos[0] - Math.sin(c.bodyYaw) * (0.33 + CLOSE.seatDist - 0.1), 0, c.pos[2] - Math.cos(c.bodyYaw) * (0.33 + CLOSE.seatDist - 0.1)];
      const o = closeAt(g, m, behind), kind = closeKindOf(o);
      line(kind === 'seat' && dozeAsleep(m), 'from behind his chair the close-in mode offers the take over the chair, and he sleeps on', `the window behind him: ${kind}${o.win ? '' : ' (none)'} · asleep ${dozeAsleep(m)}`); }

    // (i) the timetable
    { const m = back(), wp = m.wp; let onAt = -1; for (let i = 0; i < 90 * 60 && onAt < 0; i++) { W.step(DT); if (m.wp !== wp) onAt = g.time; }
      const W2 = await stand(21, false), g2 = W2.game; let offAt = -1, seen = false; for (let i = 0; i < 200 * 60 && offAt < 0; i++) { W2.step(DT); const x = same(g2, name); if (x.wp === wp && x.wait > 30) seen = true; if (seen && x.wp !== wp) offAt = g2.time; }
      DOZE.on = true;
      line(onAt > 0 && offAt > 0 && Math.abs(onAt - offAt) < 3, 'the timetable stands: he leaves that waypoint within three seconds of when he does with the switch off', `left at ${onAt.toFixed(1)} s dozing · ${offAt.toFixed(1)} s standing it`); }

    // (j) nobody sleeps in a lit place · the shift's dozes over four minutes
    { const W3 = await stand(22), g3 = W3.game; DOZE_LOG.length = 0; let frames = 0, lit = 0; const who = new Map<string, number>();
      for (let i = 0; i < 240 * 60; i++) { W3.step(DT); if (i % 15) continue; for (const x of staff(g3)) if (dozeAsleep(x)) { frames++; who.set(x.callsign, (who.get(x.callsign) ?? 0) + 0.25); if (workLit(g3, x.char.pos[0], x.char.pos[2])) lit++; } }
      line(frames > 100 && lit === 0, 'over four minutes of the shift nobody sleeps in a lit place', `${[...who].map(([k, v]) => `${k} asleep ${v.toFixed(0)} s`).join(' · ') || 'nobody slept'} · ${lit} readings in a lit place · rose at the end of a wait ${DOZE_LOG.filter((l: any) => l.why === 'time').length} times, woken ${DOZE_LOG.filter((l: any) => l.why !== 'time').length}`); }

    // (j2) a man POSTED in the dark with lit floor before him is a picket, not a dozer: the relay's, over six minutes (his stand: 110 s, a dark chair in reach)
    { Math.random = seeded(31); const W4: any = await quiet(() => standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels/quiet-relay.json'), 'utf8')), { lived: true }) })); const g4 = W4.game;
      DOZE.on = true; CLOSE.on = true; await quiet(() => startFromQuery(g4, '?quiet=0')); g4.playerInvisible = true; g4.godMode = true; Math.random = seeded(1031);
      const picket = g4.guards.find((x: any) => x.route?.name === 'picket'); let sat = 0; const slept = new Map<string, number>();
      for (let i = 0; i < 360 * 60; i++) { W4.step(DT); if (i % 15) continue; const r = picket && dozeOf(picket); if (r && r.phase !== 'no') sat++; for (const x of staff(g4)) if (dozeAsleep(x)) slept.set(x.callsign, (slept.get(x.callsign) ?? 0) + 0.25); }
      line(!!picket && sat === 0 && !slept.has(picket.callsign) && slept.size > 0, 'the relay\'s picket never sits his stand out (a post, and lit floor in his eye), while the man off watch does doze', picket ? `${picket.callsign} (picket, ${Math.max(...picket.route.wait)} s stand): ${sat} readings off his feet · asleep over six minutes: ${[...slept].map(([k, v]) => `${k} ${v.toFixed(0)} s`).join(' · ') || 'NOBODY'}` : 'the relay has no route named picket'); }

    // ---- AT A SCREEN (the police post's terminal on the footlocker, built off; the chair is the lived-in bunk room's) ----
    { const W5 = await stand(24), g5 = W5.game; DOZE_LOG.length = 0;
      const mon = g5.targets.find((t: any) => t.group === 'monitors'), chair = mon && g5.props.props.find((p: any) => p.def.kind === 'chair' && Math.hypot(p.x - mon.pos[0], p.z - mon.pos[2]) < DOZE.screenM);
      if (!mon || !chair) { line(false, 'the police post has a screen with a chair at it', `screen ${!!mon} · chair ${!!chair}`); return false; }
      const c0 = [chair.x, 0, chair.z], builtOn = mon.on, pool: string[] = dozeLines();
      const atWork = (x: any) => dozeOf(x)?.phase === 'work';
      let m: any = null; for (let i = 0; i < 240 * 60 && !m; i++) { W5.step(DT); m = staff(g5).find(atWork) ?? null; }
      if (!m) { line(false, 'a man with a short wait in the dark sits to the screen there', 'nobody sat to it inside four minutes'); return false; }
      for (let i = 0; i < 60; i++) W5.step(DT);
      // (m) he sits to it: on the chair, facing it, the screen on, its light on his face, his torch out, the mark over him
      { const c = m.char, hips = [c.pos[0] - Math.sin(c.bodyYaw) * 0.33, 0, c.pos[2] - Math.cos(c.bodyYaw) * 0.33], onChair = flat(hips, [chair.x, 0, chair.z]);
        const to = Math.atan2(mon.pos[0] - c.pos[0], mon.pos[2] - c.pos[2]), off = Math.abs(Math.atan2(Math.sin(to - c.bodyYaw), Math.cos(to - c.bodyYaw)));
        const head: any = [c.pos[0], 1.1, c.pos[2]], lit = g5.visibilityOf(lightEstimateAt(g5, head));
        for (const al of mon.areaLights ?? []) al.light.enabled = false; const dark = g5.visibilityOf(lightEstimateAt(g5, head)); for (const al of mon.areaLights ?? []) al.light.enabled = true;
        line(!builtOn && mon.on && mon.factor > 0.9 && onChair < 0.2 && off < 0.3 && flat([chair.x, 0, chair.z], c0) <= DOZE.pullM + 0.02 && lit > dark + 0.02 && !m.flashlight.enabled && closeSeated(g5, m) && dozeMark(g5, m) === '♪' && dozeAt(m) === 'screen' && !dozeAsleep(m) && m.state === 'patrol' && m.route.wait[m.wp] < DOZE.napWait,
          'a man with a short wait in the dark sits to the screen there and switches it on: on the chair, facing it, its light on his face, his torch out, awake, the mark over him',
          `${m.callsign} (${m.route.name}, a ${m.route.wait[m.wp]} s wait) · screen built ${builtOn ? 'ON' : 'off'}, now ${mon.on ? 'on' : 'OFF'} (supply ${mon.factor.toFixed(2)}) · the chair pulled ${flat([chair.x, 0, chair.z], c0).toFixed(2)} m up to it · hips ${onChair.toFixed(2)} m off the chair · ${(off * 180 / Math.PI).toFixed(0)}° off the screen · the light at his face ${lit.toFixed(3)} (${dark.toFixed(3)} with the screen dark) · torch ${m.flashlight.enabled ? 'BURNING' : 'out'} · mark '${dozeMark(g5, m)}'`); }
      const name5 = m.callsign, c1 = [chair.x, 0, chair.z], snap5 = W5.snapshot('doze-screen', true);
      const back5 = () => { Math.random = seeded(78); W5.restore(snap5); return same(g5, name5); };
      /** his next forty seconds, second by second — carried on from the save (no load), or after a load of it */
      const forty = (load: boolean) => { let x = m; if (load) x = back5(); Math.random = seeded(78);   /* (the harness's game draws Math.random: seeded here, after the load, so both ways start the same stream) */ let s = '', own = '', rose = -1; const said: string[] = []; let last = '';
        for (let i = 0; i < 40 * 60; i++) { W5.step(DT); if (atWork(x) && x.bubble && x.bubble.text !== last) { last = x.bubble.text; said.push(last); } if (rose < 0 && !dozeOf(x)) rose = i; if (i % 60 === 59) { own += `${atWork(x) ? 'w' : '-'}${mon.on ? 'L' : 'd'}${x.char.pos[0].toFixed(3)},${x.char.pos[2].toFixed(3)},${x.wp} `; s += hashDigest(digestGame(g5, true)) + ' '; } }
        return { s, own, rose, said, on: mon.on, factor: mon.factor, drift: flat([chair.x, 0, chair.z], c1), walking: !closeSeated(g5, x) && x.state === 'patrol', why: DOZE_LOG[DOZE_LOG.length - 1]?.why }; };
      const carried5 = forty(false);
      // (n) headphones on: the same footfall counts for a share at his ear — and a noise that does reach him has him up, the screen left on
      { const walkAt = (ears: number) => { const x = back5(); DOZE.ears = ears; const q = clearPoint(g5, x, 2.5); const a0 = x.awareness; if (q) step(W5, q, 0.26, 12); DOZE.ears = was.ears; return { q, d: x.awareness - a0, still: atWork(x) }; };
        const full = walkAt(1), half = walkAt(was.ears);
        const x = back5(), q = clearPoint(g5, x, 1.5); if (q) for (let k = 0; k < 4 && atWork(x); k++) step(W5, q, 0.6, 12);
        const r = dozeOf(x);
        line(!!full.q && full.d > 0.02 && half.d < full.d * 0.75 && half.still && !atWork(x) && !closeSeated(g5, x) && mon.on && r?.phase !== 'work' && x.awareness >= 0.3,
          'headphones on: a walking step near him counts for less than it would (or for nothing), and he stays at his screen — running steps beside him have him up and looking, the screen left on',
          `a walking step at 2.5 m: +${half.d.toFixed(3)} at his ear (+${full.d.toFixed(3)} with his ears whole) · after running steps at 1.5 m: ${r ? `${r.phase} (${r.why})` : 'no record'}, awareness ${x.awareness.toFixed(2)}, seated ${closeSeated(g5, x)}, screen ${mon.on ? 'on' : 'OFF'}`); }
      // (n2) the attention rule (attention.ts) on: his attention is the screen's — a lent hold at the screen, his eye narrowed off to the side of it, and the
      //      headphones counted ONCE (the lend passes 1 and 1: with his ears whole in this file, the same step adds what it adds with that rule off)
      { const wasA = ATTENTION.on, wasL = DOZE.lend;
        /** the game's own sight rate (guards.ts sightGain) for a man 2.2 m out, 40° off the way he faces, in the same light: on the post that is over the cots
         *  (no floor a man can stand on is at the edge of his view there), so the place is written, not walked to, and nothing is stepped */
        const edgeRate = (x: any) => { const P = g5.player, p = x.char.pos, y = x.char.bodyYaw + 40 * Math.PI / 180, q = [p[0] + 2.2 * Math.sin(y), 0, p[2] + 2.2 * Math.cos(y)];
          const p0 = [P.char.pos[0], P.char.pos[1], P.char.pos[2]], v0 = P.visibility, c0 = P.crouch; P.char.pos[0] = q[0]; P.char.pos[2] = q[2]; P.visibility = 0.5; P.crouch = false;
          const r = { rate: sightGain(g5, x, 2.2), deg: attentionOffDeg(g5, x, q) ?? -1 }; P.char.pos[0] = p0[0]; P.char.pos[2] = p0[2]; P.visibility = v0; P.crouch = c0; return r; };
        const run = (on: boolean, lend = true) => { ATTENTION.on = on; DOZE.lend = lend; let x = back5(); for (const o of staff(g5)) if (o !== x) o.dazzledUntil = g5.time + 10; for (let i = 0; i < 6; i++) W5.step(DT);
          const H = attentionOf(g5, x), front = attentionSideK(g5, x, mon.pos), marked = attentionMarks(g5).some((k: any) => k.gd === x && k.mode === 'lent') || !!H && g5.fogOfWar.hidden(x);
          const E = edgeRate(x), seen = E.rate, offDeg = E.deg;   // his EYE, by the game's own sight rate
          // his EARS: the same walking step with this file's dulling out of the way
          x = back5(); for (let i = 0; i < 6; i++) W5.step(DT); DOZE.ears = 1; const w = clearPoint(g5, x, 2.5), a1 = x.awareness; if (w) step(W5, w, 0.26, 12); DOZE.ears = was.ears;
          return { mode: H?.mode ?? 'none', ears: H?.ears ?? -1, noises: H?.noises ?? -1, off: H ? flat(H.at, mon.pos) : -1, front, marked, seen, offDeg, d: x.awareness - a1 }; };
        const onA = run(true), offA = run(false), noLend = run(true, false); ATTENTION.on = wasA; DOZE.lend = wasL;
        line(onA.mode === 'lent' && onA.off < 0.05 && onA.ears === 1 && onA.noises === 1 && onA.front === 1 && onA.marked && offA.mode === 'none' && noLend.mode === 'none'
          && offA.seen > 0.01 && Math.abs(onA.seen - offA.seen * ATTENTION.sideK) < 1e-6 && Math.abs(noLend.seen - offA.seen) < 1e-6 && offA.d > 0.02 && Math.abs(onA.d - offA.d) < 0.01,
          'with the attention rule on his attention is the screen\'s: a lent hold at the screen that the floor shows, a man at the edge of his view taken in at that rule\'s side rate by the game\'s own sight (whole with that rule off, or with `lend` off) — and the headphones count once (his ears are this rule\'s: the lend dulls nothing)',
          `rule on: ${onA.mode} hold ${onA.off.toFixed(2)} m from the screen, ears × ${onA.ears}, noises × ${onA.noises}, eye × ${onA.front} at the screen, on the floor ${onA.marked} · the sight rate of a man ${onA.offDeg.toFixed(0)}° off it at 2.2 m: ${onA.seen.toFixed(3)} a second (rule off ${offA.seen.toFixed(3)}, lend off ${noLend.seen.toFixed(3)}) · a walking step at 2.5 m with his ears whole: +${onA.d.toFixed(3)} (rule off: +${offA.d.toFixed(3)}, hold: ${offA.mode})`); }
      // (o) the screen dies under his eyes
      { const x = back5(); mon.on = false; for (let i = 0; i < 20; i++) W5.step(DT); const r = dozeOf(x);
        line(!atWork(x) && !closeSeated(g5, x) && r?.why === 'light' && x.awareness >= DOZE.wakeAw - 0.05 && !!x.lastKnown && flat(x.lastKnown, mon.pos) < 0.5,
          'the screen goes dark under his eyes: that he notices — up, and looking at it', `${r ? `${r.phase} (${r.why})` : 'no record'} · awareness ${x.awareness.toFixed(2)} · looking ${x.lastKnown ? `${flat(x.lastKnown, mon.pos).toFixed(2)} m from the screen` : 'NOWHERE'}`); }
      // (o2) got up from it, or hauled out of the chair, he leaves it lit — and a screen nobody touches blanks `idleSecs` on (or the next man at it switches it off as he leaves)
      { let x = back5(); x.held = true; W5.step(DT); const r0 = dozeOf(x), hauled = r0?.why === 'taken' && mon.on && W5.snapshot('doze-hauled', true).doze?.left?.length === 1;   // (the checkpoint's slice is the only window on the list of screens left lit)
        x = back5(); killGuard(g5, x, [0, 0, 1], true); W5.step(DT); const killed = x.state === 'dead' && mon.on && W5.snapshot('doze-killed', true).doze?.left?.length === 1;
        x = back5(); const q = clearPoint(g5, x, 1.5); if (q) for (let k = 0; k < 4 && atWork(x); k++) step(W5, q, 0.6, 12);
        const up0 = !atWork(x) && mon.on, t0 = g5.time, snapL = W5.snapshot('doze-left', true), inFile = snapL.doze?.left?.length === 1; let offAt = -1, satAgain = false; const ten = () => { for (let i = 0; i < 600; i++) { W5.step(DT); if (staff(g5).some(atWork)) satAgain = true; if (offAt < 0 && !mon.on) offAt = g5.time - t0; } };
        const dark = () => { offAt = -1; satAgain = false; Math.random = seeded(79); ten(); const at10 = mon.on || satAgain; for (let k = 0; k < Math.ceil(DOZE.idleSecs / 10) && offAt < 0; k++) ten(); return { at10, offAt, satAgain }; };
        const a = dark(); W5.restore(snapL); const b = dark();
        line(hauled && killed && up0 && inFile && a.at10 && a.offAt > 0 && (a.satAgain || Math.abs(a.offAt - DOZE.idleSecs) < 1.5) && Math.abs(a.offAt - b.offAt) < 0.05 && !mon.broken,
          'got up from his screen, hauled out of the chair or put down in it, he leaves it lit and it is on the list of screens left so — and a screen nobody touches goes dark by itself a minute on, the same after a load',
          `hauled out: ${r0 ? `${r0.phase} (${r0.why})` : 'no record'}, screen ${hauled ? 'on and listed' : 'OFF, NOT TAKEN OR NOT LISTED'} · put down in the chair: ${killed ? 'on and listed' : 'OFF, NOT DOWN OR NOT LISTED'} · got up by running steps: screen ${up0 ? 'on' : 'OFF'}, ten seconds on ${a.at10 ? 'still on' : 'OFF'}, dark ${a.offAt < 0 ? 'NEVER' : `${a.offAt.toFixed(1)} s after he got up`}${a.satAgain ? ' (a man sat to it again in between)' : ''} · in the checkpoint ${inFile}, dark ${b.offAt < 0 ? 'NEVER' : `${b.offAt.toFixed(1)} s`} after a load of it · idleSecs ${DOZE.idleSecs}`); }
      // (p) a checkpoint at the screen, and the end of his wait: the screen off again, the chair where it stood
      { const carried = Array.isArray(snap5.doze?.men) && snap5.doze.men.some((y: any) => y.phase === 'work' && y.mon >= 0);
        const a = forty(true), b = forty(true), strange = [...carried5.said, ...a.said].filter(t => !pool.includes(t));
        line(carried && a.own === carried5.own && a.own === b.own && a.said.join('|') === carried5.said.join('|') && a.s === b.s && a.s === carried5.s && a.rose > 0 && a.why === 'time' && !a.on && a.factor < 0.1 && a.drift < 0.1 && a.walking && strange.length === 0 && pool.every(t => t.length <= 90),
          'a checkpoint carries the man at his screen: his next forty seconds after a load, twice, are the forty the game went on to without one — he says the same things, gets up, the screen goes off again, the chair is where it stood, he walks on',
          `slice in the file ${carried} · his own forty seconds: load = carried on ${a.own === carried5.own}, load = load ${a.own === b.own} · the whole game's digests: load = carried on ${a.s === carried5.s}, load = load ${a.s === b.s} · up ${(a.rose / 60).toFixed(1)} s after the load (${a.why}) · screen ${a.on ? 'STILL ON' : 'off'} (supply ${a.factor.toFixed(2)}) · chair ${a.drift.toFixed(2)} m from where it stood · said: ${a.said.map(t => `"${t}"`).join(' ') || 'nothing in this sit'}${strange.length ? ` · NOT HIS LINES: ${strange.join(' | ')}` : ''}`); }
      // (q) a shift: the same chair is a short wait's screen and a long wait's bed; nobody sleeps by a lit screen; what is said is from the lines
      { const W6 = await stand(25), g6 = W6.game, mon6 = g6.targets.find((t: any) => t.group === 'monitors'), ch6 = g6.props.props.find((p: any) => p.def.kind === 'chair' && Math.hypot(p.x - mon6.pos[0], p.z - mon6.pos[2]) < DOZE.screenM), at0 = [ch6.x, 0, ch6.z];
        const work = new Map<string, number>(), nap = new Map<string, number>(), said = new Set<string>(); let both = 0, strange = 0, last = '', litNap = 0, longAtScreen = 0, lines0 = DOZE_STATS.lines; const marks: { at: number[]; sleep: boolean }[] = []; const wasIn = new Set<string>();
        for (let i = 0; i < 360 * 60; i++) { W6.step(DT);
          for (const x of staff(g6)) { const w = atWork(x); if (w && x.bubble && x.bubble.text !== last) { last = x.bubble.text; if (g6.time - x.bubble.t < 0.05) { said.add(last); if (!pool.includes(last)) strange++; } }
            if (i % 15) continue; if (w) { work.set(x.callsign, (work.get(x.callsign) ?? 0) + 0.25); if (x.route.wait[x.wp] >= DOZE.napWait) longAtScreen++; } if (dozeAsleep(x)) { nap.set(x.callsign, (nap.get(x.callsign) ?? 0) + 0.25); if (mon6.on) litNap++; }
            const inIt = (w || dozeAsleep(x)) && Math.hypot(x.char.pos[0] - ch6.x, x.char.pos[2] - ch6.z) < 1; if (inIt && !wasIn.has(x.callsign)) { wasIn.add(x.callsign); marks.push({ at: [ch6.x, 0, ch6.z], sleep: !w }); } else if (!inIt) wasIn.delete(x.callsign); }
          if (i % 15 === 0 && staff(g6).filter(atWork).length > 1) both++; }
        const drift = flat([ch6.x, 0, ch6.z], at0), spoke = DOZE_STATS.lines - lines0; let creep = 0, beds = 0; for (let k = 1; k < marks.length; k++) if (marks[k].sleep) { beds++; creep = Math.max(creep, flat(marks[k].at, marks[k - 1].at)); }   // (a sleeper finds the chair where the man before him — at the screen, or asleep — had it: nobody's rising moved it)
        line(work.size > 0 && nap.size > 0 && both === 0 && litNap === 0 && longAtScreen === 0 && strange === 0 && spoke > 0 && drift <= DOZE.pullM + 0.02 && beds > 0 && creep < 0.05 && !mon6.broken,
          'over six minutes of the shift the one chair is a short wait\'s screen and a long wait\'s bed: one man at the screen at a time, nobody asleep beside a lit screen, the chair no further from its place than a man pulls it to the screen and found by every sleeper where the man before him left it, every word to the screen one of its lines',
          `at the screen: ${[...work].map(([k, v]) => `${k} ${v.toFixed(0)} s`).join(' · ') || 'NOBODY'} · asleep: ${[...nap].map(([k, v]) => `${k} ${v.toFixed(0)} s`).join(' · ') || 'NOBODY'} · ${spoke} lines said (${said.size} different) · chair ${drift.toFixed(2)} m from where it stood, ${creep.toFixed(2)} m at most between where one man had it and where the next sleeper found it (${beds} such)`); }
      // (r) the half-switch: no screens — the men of that room doze or stand, as before the screen
      { DOZE.screen = false; const w0 = DOZE_STATS.worked, s0 = DOZE_STATS.slept; const W7 = await stand(24), g7 = W7.game, mon7 = g7.targets.find((t: any) => t.group === 'monitors'); let lit = 0;
        for (let i = 0; i < 90 * 60; i++) { W7.step(DT); if (mon7.on) lit++; } DOZE.screen = was.screen;
        line(DOZE_STATS.worked === w0 && lit === 0 && DOZE_STATS.slept > s0, 'the screen half off (DOZE.screen): nobody sits to it, it stays dark, and the men doze as they did', `sat to the screen ${DOZE_STATS.worked - w0} · frames with it on ${lit} · slept ${DOZE_STATS.slept - s0}`); }
    }

    // (k) a checkpoint
    { DOZE.on = true; const carried = Array.isArray(snap.doze?.men) && snap.doze.men.some((x: any) => x.phase === 'asleep');
      const run = () => { Math.random = seeded(99); let s = ''; for (let i = 0; i < 600; i++) { W.step(DT); s += staff(g).map((x: any) => dozeAsleep(x) ? 'z' : '-').join('') + (i % 60 === 59 ? hashDigest(digestGame(g, true)) + ' ' : ''); } return s; };
      Math.random = seeded(77); W.restore(snap); const recs1 = recs(), a = run(); Math.random = seeded(77); W.restore(snap); const b = run();
      line(carried && recs1 === recs0 && a === b && a.includes('z'), 'a checkpoint carries it: every man\'s record after a load is his record at the save (the sleeper, the men whose wait had no chair), and ten seconds after a load, twice, are the same sleepers and the same game', `slice in the file ${carried} · records ${recs1 === recs0 ? 'the same' : `DIFFER: saved ${recs0} · loaded ${recs1}`} · timelines equal ${a === b}${a === b ? '' : ` (first difference at character ${[...a].findIndex((ch2, i) => ch2 !== b[i])})`}`); }

    // (l) off = the base
    { const minute = async (touch: boolean) => { const sat0 = DOZE_STATS.sat; let Wm = await stand(23, false);
        if (touch) { DOZE.on = true; for (let i = 0; i < 30; i++) Wm.step(DT); Wm = await stand(23, BREAK); }
        const gm = Wm.game; let s = '', met = 0; Math.random = seeded(231);
        for (let i = 0; i < 3600; i++) { Wm.step(DT); if (i % 60 === 59) s += hashDigest(digestGame(gm, true)) + ' '; }
        for (const x of staff(gm)) if (dozeOf(x)) met++;
        return { s, met, sat: DOZE_STATS.sat - sat0 }; };
      const base = await minute(false), off = await minute(true);
      line(off.met === 0 && off.sat === 0 && off.s === base.s, 'the switch off: nobody is met, nobody sits, and a seeded minute digests as the stand that never had the rule on', `men met ${off.met} · sat ${off.sat} · sixty digests equal ${off.s === base.s}`); }
  } finally { Object.assign(DOZE, was); CLOSE.on = closeWas; Math.random = rnd0; }
  console.log(`=== doze: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await dozeCheck()) ? 0 : 1);
