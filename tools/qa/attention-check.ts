// A GUARD HAS ONE ATTENTION, AND WHERE IT IS CAN BE SEEN — the check behind src/game/attention.ts (ATTENTION.on: on in the page, ?noattention; off on the frozen
// stand, TPS_ATTENTION=1).
//   bun run tools/qa/attention-check.ts        (also `probes.ts attention`; run it on both stands: TPS_PROFILE=shipped in front)
// The office at night, the shift on its own beats, the switch thrown by hand. A 'clack' below is the ring airfoil's own event (launcher.ts clack: a 'prop' of
// RING.clackNoise with nobody behind it) filed five metres ahead of the corridor man:
//   (a) TAKEN, FOR A TIME: one clack and the calm man goes to look at it — his attention is on the place he put it, whole while he walks, then exactly
//       `noiseSecs` at the thing; he says he is done `tellSecs` before the end, says it once, and is back on his route. Without the switch the same clack leaves
//       him under the 'huh?' line (he never comes);
//   (b) WHAT IT COSTS HIM: at the thing, a lit man 35° off what he is looking at (inside his eye's cone) is taken in at `sideK` of the rate; 10° off it at the
//       whole rate; at arm's length the point-blank floor stands whole;
//   (c) A GLIMPSE AT THE EDGE WRITES NO FIX, THEN BREAKS IT: that lit man standing there feeds his awareness while his fix stays the thing; `breakGain` later
//       the hold is gone, he says so, and his fix is the man. It prints how long that took against the same man with the switch off;
//   (d) A FOOTFALL: a walking step three metres behind him does not reach a held ear (it does with the switch off); a running one does, breaks the hold and
//       turns him to it;
//   (e) ANYTHING LOUD rouses him as it did: a slammed door ends the hold with no line of this file's;
//   (f) HE IS NOT A FOOL: the second clack inside the memory is `wearK` as long, its ring starts part-spent and he says so; the third is a search, gun out;
//       after `memorySecs` of nothing it is fresh again;
//   (g) SHOWN: the mark is there from the taking to the end, its clock only ever runs down, it flags the last beat — and a man the fog of war hides has none;
//   (h) THE WHISTLE he answers holds him the same way for `whistleSecs`;
//   (i) LENT: another file's standing claim (a screen) holds a calm man for as long as it is renewed, with the lender's ears, and a real clack takes it over;
//   (j) a checkpoint carries a hold: continue ≡ load;
//   (k) the lines carry no compass word and no digit above 5;
//   (l) the switch off = the base: nothing is taken, nothing is drawn, and a seeded run with a clack in it digests as a stand that never had the rule on.
// ATTENTION_BREAK=1 = the rule left on for the 'off' lines: (l) must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

export async function attentionCheck(): Promise<boolean> {
  const { standUp } = await import('./headless.ts');
  const { ATTENTION, ATTENTION_STATS, ATTENTION_LOG, attentionOf, attentionOffDeg, attentionMarks, attentionLend, attentionLines } = await import(`${ROOT}/src/game/attention.ts`);
  const { sightGain, canSee } = await import(`${ROOT}/src/game/guards.ts`);
  const { RING } = await import(`${ROOT}/src/game/launcher.ts`);
  const { tryWhistle } = await import(`${ROOT}/src/game/whistle.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const DT = 1 / 60, rnd0 = Math.random, was = { ...ATTENTION }; let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== attention: a guard has one attention, and where it is can be seen ===');
  const FAR: [number, number, number] = [5.1, 0, 15.2];
  /** the office, Sam parked dark where he spawns, two seconds of the shift's own walk; the switch as asked */
  const stand = async (seed: number, on = true) => { Math.random = seeded(seed); const W: any = await quiet(() => standUp()); const g = W.game; ATTENTION.on = on; g.godMode = true; g.playerInvisible = true;   // (Sam is nobody's sighting but where a line below stands him up for one)
    const step = (n = 1, vis = 0) => { for (let i = 0; i < n; i++) { g.player.visibility = vis; W.step(DT); } };
    step(120); const A = g.guards[0]; return { W, g, A, step }; };
  type S = Awaited<ReturnType<typeof stand>>;
  const ahead = (A: any, m: number, side = 0): [number, number, number] => { const p = A.char.pos, f = A.char.forward(); return [p[0] + f[0] * m + f[2] * side, 0, p[2] + f[2] * m - f[0] * side]; };
  const clack = (g: any, at: number[]) => g.events.push({ kind: 'prop', pos: [at[0], 0, at[2]], time: g.time, loud: false, level: RING.clackNoise, who: 0, lure: true });
  const said = (g: any, A: any) => (A.bubble && g.time - A.bubble.t < DT * 1.5 ? A.bubble.text as string : '');
  /** step until `test` or `secs` are up; the seconds it took, or -1 */
  const until = (s: S, secs: number, test: () => boolean, vis = 0, each?: () => void): number => { for (let f = 0; f < secs * 60; f++) { s.step(1, vis); each?.(); if (test()) return (f + 1) * DT; } return -1; };
  /** a clack ahead of him, and on to the frame he is AT it (the hold's clock running) */
  const toThing = (s: S, at: number[]) => { clack(s.g, at); return until(s, 15, () => { const H = attentionOf(s.g, s.A); return !!H && H.until >= 0; }); };
  const zero = () => { for (const k of Object.keys(ATTENTION_STATS)) (ATTENTION_STATS as any)[k] = 0; ATTENTION_LOG.length = 0; };
  const WARY = ['again?', '…that\'s twice.'], SPENT = ['no. somebody\'s doing that.', 'that\'s no accident. come out.'], BROKE = ['—wait.', 'what—'];

  try {
    // ---- (a) taken, for a time
    { const s = await stand(3), { g, A } = s; zero(); const at = ahead(A, 5);
      clack(g, at); s.step(1);
      const H0 = attentionOf(g, A), took = !!H0 && H0.mode === 'go' && H0.kind === 'noise' && Math.hypot(H0.at[0] - at[0], H0.at[2] - at[2]) < 0.6 && A.state === 'suspicious';
      const lines: string[] = []; let leftMax = -1, leftUp = false, lastLeft = 2, marked = 0, frames = 0, ending = 0, dwell = 0, walk = 0, toldAt = -1, endAt = -1, t = 0;
      until(s, 30, () => A.state === 'patrol', 0, () => { t += DT; const H = attentionOf(g, A), M = attentionMarks(g).find((m: any) => m.gd === A), w = said(g, A); if (w && lines[lines.length - 1] !== w) { lines.push(w); if (w === 'must have been nothing') toldAt = t; }
        if (H) { frames++; if (M) { marked++; if (M.left > lastLeft + 1e-9) leftUp = true; lastLeft = M.left; leftMax = Math.max(leftMax, M.left); if (M.ending) ending++; } if (H.until >= 0) dwell += DT; else walk += DT; endAt = t; } });
      s.step(240); const after = said(g, A), nothings = lines.filter(x => x === 'must have been nothing').length + (after === 'must have been nothing' ? 1 : 0);
      line(took, 'one clack and the calm man\'s attention is on the place he put it, and he goes', `${A.callsign}: ${A.state === 'patrol' ? 'back on patrol' : A.state}; taken ${ATTENTION_STATS.taken}, the place ${H0 ? `(${H0.at[0].toFixed(1)}, ${H0.at[2].toFixed(1)})` : '—'} for a clack at (${at[0].toFixed(1)}, ${at[2].toFixed(1)})`);
      line(Math.abs(dwell - ATTENTION.noiseSecs) < 0.06 && walk > 0.5, `whole while he walks, then exactly noiseSecs at the thing`, `walked ${walk.toFixed(2)} s, at it ${dwell.toFixed(2)} s (noiseSecs ${ATTENTION.noiseSecs})`);
      line(toldAt > 0 && Math.abs((endAt - toldAt) - ATTENTION.tellSecs) < 0.06 && nothings === 1 && ATTENTION_STATS.released === 1, 'he says he is done tellSecs before his eye widens, and says it once', `told ${(endAt - toldAt).toFixed(2)} s before the end (tellSecs ${ATTENTION.tellSecs}); said: ${lines.join(' / ')}; 'must have been nothing' × ${nothings}`);
      line(marked === frames && frames > 0 && !leftUp && leftMax > 0.999 && lastLeft < 0.02 && ending > 0 && Math.abs(ending * DT - ATTENTION.tellSecs) < 0.06, '(g) the mark stands from the taking to the end, its clock only runs down, and it flags the last beat', `${marked} of ${frames} frames marked, the clock ${leftMax.toFixed(2)} → ${lastLeft.toFixed(2)}, ${ending} frames flagged`);
      const fog = g.fogOfWar.hidden; let hidden = -1; { const s2 = await stand(3), at2 = ahead(s2.A, 5); clack(s2.g, at2); s2.step(30); const shown = attentionMarks(s2.g).length; s2.g.fogOfWar.hidden = () => true; hidden = attentionMarks(s2.g).length; line(shown === 1 && hidden === 0, '(g) a man the fog of war hides has no mark', `${shown} shown, ${hidden} with every man hidden`); } void fog;
      const o = await stand(3, false); const at3 = ahead(o.A, 5); clack(o.g, at3); let peak = 0, sus = false; for (let i = 0; i < 300; i++) { o.step(1); peak = Math.max(peak, o.A.awareness); sus ||= o.A.state !== 'patrol'; }
      line(!sus && peak < 0.3, 'without the switch the same clack leaves him under the \'huh?\' line', `awareness peaked at ${peak.toFixed(2)}, state ${sus ? 'moved' : 'patrol throughout'}`);
      const u = await stand(3); zero(); const at4 = ahead(u.A, 5); u.g.events.push({ kind: 'prop', pos: at4, time: u.g.time, loud: false, level: RING.clackNoise, who: 0 }); let peakU = 0, susU = false; for (let i = 0; i < 300; i++) { u.step(1); peakU = Math.max(peakU, u.A.awareness); susU ||= u.A.state !== 'patrol'; }
      line(!susU && peakU < 0.3 && ATTENTION_STATS.taken === 0, 'a knock as faint that nobody made to be looked at (a chair a door swept) lures nobody: only the lure does', `awareness peaked at ${peakU.toFixed(2)}, ${ATTENTION_STATS.taken} taken`); }

    // ---- (b) what it costs him
    { const s = await stand(4), { g, A } = s; const at = ahead(A, 5); const t = toThing(s, at); const H = attentionOf(g, A)!;
      const eye = A.char.bones.head ?? A.char.pos, y = H.yaw ?? A.char.bodyYaw;
      const rateAt = (deg: number, m: number) => { const a = y + deg * Math.PI / 180; g.teleportPlayer([eye[0] + Math.sin(a) * m, 0, eye[2] + Math.cos(a) * m]); g.player.visibility = 0.9; g.player.crouch = false;
        const vis = canSee(g, A), offDeg = attentionOffDeg(g, A, g.player.char.pos) ?? -1;   // (where the level let him stand, measured: a teleport settles on free floor)
        ATTENTION.on = true; const on = sightGain(g, A, vis.dist); ATTENTION.on = false; const off = sightGain(g, A, vis.dist); ATTENTION.on = true; return { on, off, offDeg, dist: vis.dist }; };
      const side = rateAt(35, 4), mid = rateAt(10, 4), near = rateAt(35, 1.5); g.teleportPlayer(FAR);
      line(t > 0 && side.offDeg > ATTENTION.focusDeg && side.dist > 1.8 && Math.abs(side.on / side.off - ATTENTION.sideK) < 1e-9, 'a lit man outside focusDeg of what he is looking at is taken in at sideK of the rate', `${side.offDeg.toFixed(0)}° off it at ${side.dist.toFixed(1)} m: ${side.on.toFixed(3)} against ${side.off.toFixed(3)} a second (sideK ${ATTENTION.sideK})`);
      line(mid.offDeg < ATTENTION.focusDeg && mid.on === mid.off && mid.on > 0, 'inside it: the whole rate', `${mid.offDeg.toFixed(0)}° off it at ${mid.dist.toFixed(1)} m: ${mid.on.toFixed(3)} a second either way`);
      line(near.offDeg > ATTENTION.focusDeg && near.dist < 1.8 && near.on === near.off && near.on >= 3.5 - 1e-9, 'at arm\'s length the point-blank floor stands whole', `${near.offDeg.toFixed(0)}° off it at ${near.dist.toFixed(1)} m: ${near.on.toFixed(2)} a second either way`); }

    // ---- (c) a glimpse at the edge writes no fix, then breaks it
    { const run = async (on: boolean) => { const s = await stand(5, true), { g, A } = s; const at = ahead(A, 5); toThing(s, at); const H = attentionOf(g, A)!; const eye = A.char.pos, y = H.yaw ?? A.char.bodyYaw; g.playerInvisible = false; let P: [number, number, number] = FAR;
        spot: for (const m of [4, 5, 3.5, 3, 6]) for (const deg of [35, -35, 40, -40, 30, -30, 45, -45, 50, -50]) { const a = y + deg * Math.PI / 180; P = [eye[0] + Math.sin(a) * m, 0, eye[2] + Math.cos(a) * m]; g.teleportPlayer(P); P = [g.player.char.pos[0], 0, g.player.char.pos[2]]; const v = canSee(g, A); if (v.visible && v.dist > 2.6 && (attentionOffDeg(g, A, P) ?? 0) > ATTENTION.focusDeg + 3) break spot; }
        const clear = canSee(g, A).visible, dist = canSee(g, A).dist, deg = attentionOffDeg(g, A, P) ?? 0; ATTENTION.on = on; zero();
        let noFix = 0, grew = false, aw0 = A.awareness, w = '', fixAt = -1, t = 0, broke = -1;
        const contact = until(s, 12, () => A.state === 'alert', 0.45, () => { t += DT; const h = attentionOf(g, A); if (h) { if (A.lastKnown && Math.hypot(A.lastKnown[0] - h.at[0], A.lastKnown[2] - h.at[2]) < 0.6) noFix++; grew ||= A.awareness > aw0 + 0.02; } else if (broke < 0) { broke = t; w = said(g, A); }
          if (fixAt < 0 && A.lastKnown && Math.hypot(A.lastKnown[0] - P[0], A.lastKnown[2] - P[2]) < 0.5) fixAt = t; });
        return { noFix, grew, w, fixAt, broke, contact, clear, dist, deg, P, log: ATTENTION_LOG.map((x: any) => x.what).join(',') }; };
      const on = await run(true), off = await run(false);
      line(on.clear && on.dist > 2.6 && on.noFix > 3 && on.grew && on.log.includes('glimpse') && BROKE.includes(on.w) && on.fixAt >= on.broke - DT * 1.5, 'a lit man at the edge of a held eye feeds his awareness and writes no fix; breakGain later the hold breaks, he says so and turns to the man', `${on.noFix} frames with his fix still the thing, broke at ${on.broke.toFixed(2)} s saying '${on.w}', his fix the man from ${on.fixAt.toFixed(2)} s (${on.log}; a clear line to him: ${on.clear}, at ${on.P[0].toFixed(1)}, ${on.P[2].toFixed(1)})`);
      line(off.fixAt >= 0 && on.fixAt > off.fixAt + 0.2 && (on.contact < 0 || off.contact < 0 || on.contact > off.contact), 'that is a window the switch off does not give', `his head comes round after ${on.fixAt.toFixed(2)} s held, ${off.fixAt.toFixed(2)} s with the switch off; CONTACT after ${on.contact.toFixed(2)} s against ${off.contact.toFixed(2)} s (light 0.45, ${on.dist.toFixed(1)} m and ${on.deg.toFixed(0)}° off the thing, standing)`); }

    // ---- (d) a footfall
    { const heard = async (on: boolean, level: number) => { const s = await stand(6, true), { g, A } = s; const at = ahead(A, 5); toThing(s, at); ATTENTION.on = on; zero(); const b = ahead(A, -3), n0 = A.witness.heard.small;
        g.playerInvisible = false; g.events.push({ kind: 'step', pos: b, time: g.time, loud: false, level }); s.step(2); g.playerInvisible = true;
        return { heard: A.witness.heard.small > n0, held: !!attentionOf(g, A), toIt: !!A.lastKnown && Math.hypot(A.lastKnown[0] - b[0], A.lastKnown[2] - b[2]) < 1.5, log: ATTENTION_LOG.map((x: any) => x.what).join(',') }; };
      const walkOn = await heard(true, 0.3), walkOff = await heard(false, 0.3), runOn = await heard(true, 0.6);
      line(!walkOn.heard && walkOn.held && walkOff.heard, 'a walking step three metres behind a held man does not reach him; with the switch off it does', `held: heard ${walkOn.heard}, the hold ${walkOn.held ? 'stands' : 'gone'}; off: heard ${walkOff.heard}`);
      line(runOn.heard && !runOn.held && runOn.toIt && runOn.log.includes('step'), 'a running one does, breaks the hold and turns him to it', `heard ${runOn.heard}, hold ${runOn.held ? 'stands' : 'gone'} (${runOn.log}), his fix the step: ${runOn.toIt}`); }

    // ---- (e) anything loud
    { const s = await stand(7), { g, A } = s; const at = ahead(A, 5); toThing(s, at); zero(); const b = ahead(A, -3);
      g.events.push({ kind: 'door', pos: b, time: g.time, loud: true, level: 1, who: 1 }); s.step(2); const w = said(g, A);
      line(!attentionOf(g, A) && A.awareness >= ATTENTION.calmAw && ATTENTION_LOG.some((x: any) => x.what === 'roused') && !attentionLines().includes(w), 'a slammed door rouses him as it did: the hold is over, with no line of this file\'s', `awareness ${A.awareness.toFixed(2)}, ${ATTENTION_LOG.map((x: any) => x.what).join(',')}`); }

    // ---- (f) he is not a fool
    { const s = await stand(8), { g, A } = s; zero(); const calm = () => until(s, 40, () => A.state === 'patrol' && A.awareness < 0.02);
      const T = ahead(A, 5); clack(g, T); s.step(1); const h1 = attentionOf(g, A); calm();
      clack(g, T); s.step(1); const h2 = attentionOf(g, A), w2 = said(g, A), m2 = attentionMarks(g).find((m: any) => m.gd === A); let dwell2 = 0; until(s, 40, () => A.state === 'patrol' && A.awareness < 0.02, 0, () => { const h = attentionOf(g, A); if (h && h.until >= 0) dwell2 += DT; });
      clack(g, T); s.step(1); const w3 = said(g, A), st3 = A.state, h3 = attentionOf(g, A);
      line(!!h1 && h1.nth === 1 && !!h2 && h2.nth === 2 && Math.abs(h2.secs - ATTENTION.noiseSecs * ATTENTION.wearK) < 1e-9 && Math.abs(dwell2 - h2.secs) < 0.06 && WARY.includes(w2) && !!m2 && Math.abs(m2.left - ATTENTION.wearK) < 1e-6 && m2.worn,
        'the second clack inside the memory holds him wearK as long, its ring starts part-spent, and he says so', `${h2 ? h2.secs.toFixed(1) : '—'} s (at it ${dwell2.toFixed(2)} s), the ring from ${m2 ? m2.left.toFixed(2) : '—'}, '${w2}'`);
      line(st3 === 'search' && !h3 && SPENT.includes(w3) && ATTENTION_STATS.spent === 1, 'the third is no look at all: he searches the place', `state ${st3}, '${w3}'`);
      const f = await stand(8); zero(); const TF = ahead(f.A, 5); clack(f.g, TF); f.step(1); until(f, 40, () => f.A.state === 'patrol' && f.A.awareness < 0.02); f.step(Math.ceil((ATTENTION.memorySecs + 1) * 60));
      clack(f.g, [f.A.char.pos[0] + 1.5, 0, f.A.char.pos[2]]); f.step(1); const hf = attentionOf(f.g, f.A);
      line(!!hf && hf.nth === 1 && hf.secs === ATTENTION.noiseSecs, 'after memorySecs of nothing the next one is fresh', hf ? `taking ${hf.nth}, ${hf.secs} s` : `no hold (${f.A.state}, awareness ${f.A.awareness.toFixed(2)})`); }

    // ---- (f2) one happening is one taking
    { const s = await stand(8), { g, A } = s; zero(); const says: string[] = [];
      for (let k = 0; k < 3; k++) { clack(g, ahead(A, 4 + k * 1.3)); for (let i = 0; i < 21; i++) { s.step(1); const w = said(g, A); if (w && says[says.length - 1] !== w) says.push(w); } }
      const H = attentionOf(g, A);
      line(ATTENTION_STATS.taken === 1 && ATTENTION_STATS.spent === 0 && A.state === 'suspicious' && !!H && H.nth === 1 && !says.some(w => WARY.includes(w) || SPENT.includes(w)), 'three knocks a third of a second apart, each further on (a canister bouncing), are one taking that follows it', `${ATTENTION_STATS.taken} taken, ${ATTENTION_STATS.spent} spent, ${A.state}; said: ${says.join(' / ')}`); }

    // ---- (m) a turned head forgives nothing
    { const run = async (on: boolean) => { const s = await stand(13, on), { g, A } = s; zero(); g.playerInvisible = false; let ok = false;
        spot: for (const m of [4, 5, 3.5, 3]) for (const deg of [0, 15, -15, 30, -30]) { const a = A.char.bodyYaw + deg * Math.PI / 180; g.teleportPlayer([A.char.pos[0] + Math.sin(a) * m, 0, A.char.pos[2] + Math.cos(a) * m]); const v = canSee(g, A); if (v.visible && v.dist > 2.6) { ok = true; break spot; } }
        const lamp = ahead(A, 1.5, 1.2); g.events.push({ kind: 'lightOut', cause: 'ocp', pos: lamp, time: g.time, loud: false });
        let looked = false, drop = 0, nothing = false, prev = A.awareness; const contact = until(s, 15, () => A.state === 'alert', 0.46, () => { const h = attentionOf(g, A); looked ||= !!h && h.mode === 'look'; drop = Math.max(drop, prev - A.awareness); prev = A.awareness; nothing ||= said(g, A) === 'must have been nothing'; });
        return { ok, looked, drop, nothing, contact }; };
      const on = await run(true), off = await run(false);
      line(on.ok && on.looked && on.drop < 0.05 && !on.nothing && on.contact > 0 && off.contact > 0 && on.contact < off.contact + 2.0, 'a head a light turned, with a lit man standing in his view: nothing he has seen is forgiven when the look ends', `a look hold: ${on.looked}; the most his awareness fell in a frame ${on.drop.toFixed(3)}; 'must have been nothing': ${on.nothing}; CONTACT after ${on.contact.toFixed(2)} s against ${off.contact.toFixed(2)} s with the switch off`); }

    // ---- (h) the whistle
    { const s = await stand(9), { g, A } = s; zero(); g.teleportPlayer(ahead(A, 5)); g.playerInvisible = false; s.step(1); const blew = tryWhistle(g); s.step(2); const H = attentionOf(g, A);
      g.teleportPlayer(FAR); g.playerInvisible = true; let dwell = 0; until(s, 30, () => A.state === 'patrol', 0, () => { const h = attentionOf(g, A); if (h && h.until >= 0) dwell += DT; });
      line(blew && !!H && H.kind === 'whistle' && H.mode === 'go' && Math.abs(dwell - ATTENTION.whistleSecs) < 0.06, 'a whistle he answers holds him the same way, for whistleSecs', `${H ? `${H.kind}, ${H.mode}` : 'no hold'}, at it ${dwell.toFixed(2)} s; ${ATTENTION_STATS.looks} other head(s) turned`); }

    // ---- (i) lent
    { const s = await stand(10), { g, A } = s; zero(); const scr = ahead(A, 2, 1.5);
      for (let i = 0; i < 60; i++) { attentionLend(g, A, scr, { ears: 0.2, noises: 0.5 }); s.step(1); } const H = attentionOf(g, A), M = attentionMarks(g).find((m: any) => m.gd === A);
      const ok1 = !!H && H.mode === 'lent' && H.ears === 0.2 && H.noises === 0.5 && !!M && M.left === 1 && A.state === 'patrol';
      attentionLend(g, A, scr, { ears: 0.2, noises: 1 }); clack(g, ahead(A, 5)); s.step(1); const H2 = attentionOf(g, A);
      const t = await stand(10); for (let i = 0; i < 30; i++) { attentionLend(t.g, t.A, ahead(t.A, 2, 1.5)); t.step(1); } const had = !!attentionOf(t.g, t.A); t.step(Math.ceil(0.4 * 60)); const gone = !attentionOf(t.g, t.A);
      line(ok1 && !!H2 && H2.mode === 'go' && H2.kind === 'noise' && had && gone, 'another file\'s standing claim holds a calm man with the lender\'s ears, a real clack takes it over, and it ends when it is no longer renewed', `lent: ${H ? `${H.mode}, ears ${H.ears}, noises ${H.noises}` : '—'}; after a clack: ${H2 ? `${H2.mode} ${H2.kind}` : '—'}; unrenewed: ${gone ? 'gone' : 'still held'}`); }

    /** stand him at a waypoint (as a man at a screen would stand) somewhere a lit man can be seen well off the 'screen' two metres ahead of him; Sam parked again */
      const post = (s: S) => { const { g, A } = s; for (let k = 0; k < 40; k++) { A.wait = 60; s.step(20); const scr = ahead(A, 2), e = A.char.pos;
          for (const m of [3.5, 3, 4, 5, 2.5]) for (const side of [3, -3, 2.5, -2.5, 3.5, -3.5, 2, -2, 4, -4]) { g.playerInvisible = false; g.teleportPlayer(ahead(A, m, side)); g.player.visibility = 0.9; const v = canSee(g, A), q = g.player.char.pos, P: [number, number, number] = [q[0], 0, q[2]];
            const da = Math.atan2(q[0] - e[0], q[2] - e[2]) - Math.atan2(scr[0] - e[0], scr[2] - e[2]), off = Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) * 180 / Math.PI; g.teleportPlayer(FAR); g.playerInvisible = true;
            if (v.visible && v.dist > 2.6 && off > ATTENTION.focusDeg + 8) return { scr, P }; }
          A.wait = 0; s.step(40); } return null; };
    {
      const s = await stand(10), { g, A } = s; zero(); const at = post(s), scr = at?.scr ?? ahead(A, 2), lend = () => attentionLend(g, A, scr);
      for (let i = 0; i < 30; i++) { lend(); s.step(1); } const lent0 = !!attentionOf(g, A) && ATTENTION_STATS.lent === 1;
      g.playerInvisible = false; g.teleportPlayer(at?.P ?? FAR);
      let breaks = 0, w = '', brokeAt = -1, tt = 0; lend();   /* (the lender renews in front of every step, here as in the loop above: a claim not renewed since his last tick is over) */ const t = until(s, 12, () => A.state !== 'patrol', 0.9, () => { tt += DT; lend(); const x = said(g, A); if (BROKE.includes(x) && x !== w) breaks++; w = x; if (brokeAt < 0 && ATTENTION_LOG.some((x: any) => x.what === 'glimpse')) brokeAt = tt; });
      const relent = ATTENTION_STATS.lent, what = ATTENTION_LOG.map((x: any) => x.what).join(',');
      const d = await stand(10), atD = post(d), scrD = atD?.scr ?? ahead(d.A, 2); for (let i = 0; i < 30; i++) { attentionLend(d.g, d.A, scrD); d.step(1); } d.g.playerInvisible = false; d.g.teleportPlayer(atD?.P ?? FAR);
      attentionLend(d.g, d.A, scrD); const dim = until(d, 8, () => d.A.state !== 'patrol', 0.3, () => attentionLend(d.g, d.A, scrD));
      line(!!at && lent0 && t > 0 && brokeAt > 0 && brokeAt <= t && breaks === 0 && relent === 1 && (dim < 0 || dim > t), 'a well lit man at the edge of a lent hold breaks it once with no line, the lender does not get him back, and he is suspicious like any man; a dim one there takes longer or is not noticed', `${at ? `a clear line off the screen at (${at.P[0].toFixed(1)}, ${at.P[2].toFixed(1)})` : 'NO SPOT'}; lit 0.9: broke at ${brokeAt.toFixed(2)} s, suspicious after ${t.toFixed(2)} s, ${breaks} break line(s), lent ${relent} time(s) (${what}); lit 0.3: ${dim < 0 ? 'on his screen for eight seconds' : `suspicious after ${dim.toFixed(2)} s`}`); }

    // ---- (j) a checkpoint carries a hold
    { const s = await stand(11), { g, A, W } = s; toThing(s, ahead(A, 5)); s.step(60); const snap = await quiet(() => W.snapshot('attention'));
      const read = () => { const A2 = g.guards[0], H = attentionOf(g, A2); return H ? `${H.mode} ${H.kind} ${(H.until - g.time).toFixed(3)} ${H.nth} ${A2.state}` : `none ${A2.state}`; };
      const at0 = read(); s.step(90); const cont = read(); await quiet(() => W.restore(snap)); const back = read(); s.step(90); const load = read();
      line(at0 === back && cont === load && at0.startsWith('go'), 'a checkpoint carries a hold: continue ≡ load', `at the save '${at0}', loaded '${back}'; 1.5 s on '${cont}' against '${load}'`); }

    // ---- (j2) a checkpoint carries a LENT hold too: a man at his screen with somebody at the edge of his view is held, loaded, on the very frames the carried-on
    //      man is (the lender renewing in front of every step, as a lender does) — no frame of a whole eye, so no fix the carried-on run does not write — and
    //      loading takes nothing afresh. His AWARENESS is reported, not held: a loaded man's head is a frame settling (the checkpoint's own, the same with this
    //      rule off), so what he half-sees on that frame differs in the second decimal either way.
    { const s = await stand(10), { g, A, W } = s; zero(); const at = post(s), scr = at?.scr ?? ahead(A, 2), lend = () => attentionLend(g, g.guards[0], scr);
      for (let i = 0; i < 30; i++) { lend(); s.step(1); } g.playerInvisible = false; g.teleportPlayer(at?.P ?? FAR); for (let i = 0; i < 3; i++) { lend(); s.step(1, 0.9); }
      const read = () => { const A2 = g.guards[0], H = attentionOf(g, A2), k = A2.lastKnown; return `${H ? H.mode : 'none'} ${A2.state} fix ${k ? `${k[0].toFixed(2)},${k[2].toFixed(2)}` : '—'}`; };
      const run = (n: number) => { const out: string[] = [], aw: number[] = []; for (let i = 0; i < n; i++) { lend(); s.step(1, 0.9); out.push(read()); aw.push(g.guards[0].awareness); } return { out, aw }; };
      const snap = await quiet(() => W.snapshot('attention-lent')), at0 = read(), cont = run(12), n0 = ATTENTION_STATS.lent;
      await quiet(() => W.restore(snap)); g.playerInvisible = false; const back = read(), load = run(12), first = cont.out.findIndex((x, i) => x !== load.out[i]), dAw = Math.max(...cont.aw.map((a, i) => Math.abs(a - load.aw[i])));
      line(!!at && at0.startsWith('lent') && back === at0 && first < 0 && ATTENTION_STATS.lent === n0, 'a checkpoint carries a lent hold: a man at his screen with somebody at the edge of his view is held on the same frames loaded as carried on, writes no fix the other does not, and nothing is taken afresh', `${at ? '' : 'NO SPOT; '}at the save '${at0}', loaded '${back}'; ${first < 0 ? 'twelve frames alike' : `frame ${first + 1}: carried on '${cont.out[first]}' against loaded '${load.out[first]}'`}; lent takings ${n0} → ${ATTENTION_STATS.lent}; awareness apart by at most ${dAw.toFixed(4)} (not held)`); }

    // ---- (i2) a lend that is not renewed is over at once (not a quarter second later: he has got up from the screen)
    { const t = await stand(10); for (let i = 0; i < 30; i++) { attentionLend(t.g, t.A, ahead(t.A, 2, 1.5)); t.step(1); } const had = attentionOf(t.g, t.A)?.mode === 'lent';
      let frames = 0; while (frames < 30 && attentionOf(t.g, t.A)) { t.step(1); frames++; }
      line(had && frames <= 2 && attentionMarks(t.g).length === 0, 'a lend that is not renewed is over inside two frames, its mark with it', `${had ? 'lent' : 'NOT LENT'}; gone ${frames} frame(s) after the last call`); }

    // ---- (k) the lines
    { const L: string[] = attentionLines(); const compass = L.filter(t => /\b(north|south|east|west)/i.test(t)), digit = L.filter(t => /[6-9]/.test(t));
      line(L.length > 0 && !compass.length && !digit.length, 'no compass word and no digit above 5 in any line of it', `${L.length} lines`); }

    // ---- (l) the switch off = the base: every number of it scribbled, a lender claiming him every frame, a lure, a footfall and a lit man at his side — and the
    //      run digests as the same run with the table untouched (no hook reads a number past the switch). ATTENTION_BREAK=1 leaves the switch on: must fail.
    { const run = async (scribble: boolean) => { const keep = scribble && process.env.ATTENTION_BREAK === '1'; const s = await stand(12, keep), { g, A } = s; const table = { ...ATTENTION };
        if (scribble) Object.assign(ATTENTION, { focusDeg: 1, sideK: 0, earK: 0, breakGain: 9, calmAw: 0.99, drawAw: 0.9, floor: 0.9, noiseSecs: 1, doorSecs: 1, lightSecs: 1, whistleSecs: 1, tellSecs: 0.1, dwellSweep: 2, wearK: 0.1, spent: 1, sameSecs: 0, lentBackSecs: 0 });
        zero(); let d = '', marks = 0; clack(g, ahead(A, 5)); const scr = ahead(A, 2, 1.5);
        for (let i = 0; i < 600; i++) {
          if (scribble) attentionLend(g, A, scr, { ears: 0, noises: 0 });
          if (i === 200) { g.playerInvisible = false; g.events.push({ kind: 'step', pos: ahead(A, -3), time: g.time, loud: false, level: 0.3 }); }
          if (i === 202) g.playerInvisible = true;
          if (i === 300) { g.playerInvisible = false; g.teleportPlayer(ahead(A, 3, 3)); }
          if (i === 420) { g.playerInvisible = true; g.teleportPlayer(FAR); }
          s.step(1, i >= 300 && i < 420 ? 0.45 : 0); marks += attentionMarks(g).length; if (i % 60 === 59) d += hashDigest(digestGame(g, true)) + ' '; }
        Object.assign(ATTENTION, table);
        return { d, marks, taken: ATTENTION_STATS.taken + ATTENTION_STATS.looks + ATTENTION_STATS.lent }; };
      const off = await run(true), base = await run(false);
      line(off.taken === 0 && off.marks === 0 && off.d === base.d, 'the switch off: nothing is taken or drawn, and with every number of it scribbled and a lender claiming him the run digests as the untouched table\'s', `${off.taken} taken, ${off.marks} marks; digests ${off.d === base.d ? 'equal' : 'DIFFER'} over ten seconds (a lure, a footfall, a lit man at his side)`); }
  } finally { Object.assign(ATTENTION, was); Math.random = rnd0; }
  console.log(`=== attention: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
if (import.meta.main) process.exit((await attentionCheck()) ? 0 : 1);
