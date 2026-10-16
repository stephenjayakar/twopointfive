// EVERY DEATH EXPLAINS ITSELF — the check behind src/game/deathrecap.ts (RECAP.on: on on every stand, ?norecap) and the end card's panel src/ui/recap.ts.
//   bun run tools/qa/deathrecap-check.ts        (also `probes.ts deathrecap`)
// A man of the shift is stood at a known place BEHIND Sam with a line to him and puts one round into his back. Then:
//   (1) while Sam is up nothing is handed out; once he is down the card's record names that man, his gun, where the round left from and where he stood,
//       how far, and that it came from behind (degrees off Sam's gaze)
//   (2) the record carries the floor's last seconds: every man in every frame, the shooter where he was staged, frames to just past the fall and no longer
//       than the knobs say
//   (3) one of ours lost while a player still plays (a civilian, by Sam's own round) is kept — and still nothing is handed out
//   (4) the panel: the plan and the three labels (who · with what · how far) on the card when he is down; no panel while the run is on
//   (5) the switch off: nothing kept, nothing handed out, no panel
//   (6) it only reads the game: the same staged run with the switch on and off ends on the same digest
//   (7) a restart: that run's deaths are not the next run's
//   (9) the playback (ui/recap.ts recapMenAt): every man drawn where he really was over the last seconds, the shooter coming in, Sam's gun line turning
//       (RECAP_BREAK=snap = read off the last sample alone: must fail)
//   (10) its clock on a frame clock of the check's own: real speed, a rest on the end, round again; nothing drawn while the card is put away
//   (8) a man put out cold by a hand is not a death; a stun canister is not a killer, a fragmentation burst is; a hostage her captor shoots is his round;
//       a run played on past its end shows nothing that happened after it; the switch thrown on mid-run takes no old body for a new death
//   (11) while the run is on (RECAP.live, deathrecap.ts lostLive): a teammate lost where nobody still up sees him go down or hears it has his row struck and
//       nothing else, and a mate who finds him later changes nothing; heard = after a beat the way it came from, an eighth of the compass and no finer; seen
//       by his mate = that and the mate's word for the side; seen by the player = no word; never the shooter's name or place, the card's record shut
//       throughout; off = the row as it was; reads only   (RECAP_BREAK=seen = everybody sees through walls: must fail)
// RECAP_BREAK=1 = the round's line never reaches the module (neither by the combat.ts seam nor as the shot's event): (1) must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

export async function deathrecapCheck(): Promise<boolean> {
  const { rig } = await import('./frag-probes.ts');
  const M = await import(`${ROOT}/src/game/deathrecap.ts`);
  const { RECAP, deathRecapOf, recapDeathsForChecks, MAN_STRIDE } = M;
  const { fireWeapon, killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
  const { gearText } = await import(`${ROOT}/src/game/gear.ts`);
  let all = true; const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== deathrecap: the end card knows who shot whom, from where — and says nothing while the run is on ===');
  const was = { ...RECAP }; const brk = process.env.RECAP_BREAK === '1';
  const P: number[] = [22, 0, 17.6];   // the corridor outside the break room (frag-probes.ts P0)
  const chest = (c: any): number[] => c.bones?.chest ?? [c.pos[0], 1.2, c.pos[2]];
  /** Sam and one man of the shift in the open with a line between them, Sam's back to him, the AI off; `shoot()` = that man's one steady round at Sam's chest */
  const stage = async (seed: number) => {
    const R = await rig(seed); const g = R.game, pl = g.player, gd = g.guards[0]; g.aiEnabled = false; g.godMode = false;
    const a = R.spot(P, 3, true); if (!a) return null;
    const tried: number[][] = [a]; let b: number[] | null = null;
    for (let k = 0; k < 8 && !b; k++) {   // a place for him with a round's clear line to Sam's chest from his own muzzle as posed
      const q = R.spot(a, 4.5, true, tried); if (!q) break; tried.push(q);
      g.teleportPlayer([a[0], 0, a[2]]); const away = Math.atan2(a[0] - q[0], a[2] - q[2]); pl.char.bodyYaw = away; pl.char.aimYaw = away;
      for (let i = 0; i < 20; i++) { R.put(gd, q, a); R.step(1); }
      if (!g.col.shotBlocked(gd.char.muzzle, chest(pl.char), 0.05)) b = q;
    }
    if (!b) return null; const at = b;
    const far = [a[0] + (a[0] - at[0]) * 3, 1, a[2] + (a[2] - at[2]) * 3];   // Sam looks AWAY from him: the cursor a long way down the line from the man through Sam
    for (let i = 0; i < Math.ceil((RECAP.secs + 2) * 60); i++) { R.W.cursorAt(far); R.put(gd, at, a); R.step(1); }
    const shoot = () => { R.W.cursorAt(far); R.put(gd, at, a); const saved = RECAP.on; if (brk) RECAP.on = false; fireWeapon(g, gd.char, chest(pl.char), false, { steady: true }); RECAP.on = saved;
      if (brk) for (let i = g.events.length - 1; i >= 0; i--) if (g.events[i].kind === 'guardShot') g.events.splice(i, 1); };
    return { R, g, pl, gd, a, b: at, shoot };
  };
  try {
    // (1) + (2) + (4)
    { let S: any = null; for (let seed = 11; seed < 24 && !S; seed++) { RECAP.on = true; const T = await stage(seed); if (!T) continue; const before = deathRecapOf(T.g);
        const muzzle = [...T.gd.char.muzzle]; const gaze = T.pl.char.aimYaw; T.shoot(); T.R.step(1); if (!T.pl.down) continue; S = { ...T, before, muzzle, gaze, seed }; }
      if (!S) line(false, 'a staged round put Sam down (no seed did: the check looked at nothing)');
      else {
        const { R, g, pl, gd, a, b } = S; const early = deathRecapOf(g);
        const earlyTail = early ? early.takes[0].frames[early.takes[0].frames.length - 1].t - early.takes[0].death.t : NaN;   // (read now: the list is the game's own and the whole take replaces this one)
        R.step(Math.ceil((RECAP.after + 0.5) * 60));
        const rec = deathRecapOf(g), T = rec?.takes[rec.main], d = T?.death;
        line(S.before === null && !!d && d.player && d.victim === pl.char.id, 'nothing handed out while Sam is up; once he is down the record is his', `before ${S.before === null ? 'null' : 'a record'} · after ${d ? `${d.name} by ${d.byName || '?'} (${d.cause})` : 'null'} · seed ${S.seed}`);
        const dist = Math.hypot(S.muzzle[0] - a[0], S.muzzle[2] - a[2]);
        let offWant = Math.atan2(S.muzzle[0] - a[0], S.muzzle[2] - a[2]) - S.gaze; offWant = Math.abs(Math.atan2(Math.sin(offWant), Math.cos(offWant))) * 180 / Math.PI;
        const ok1 = !!d && d.cause === 'round' && d.by === gd.char.id && d.byName === gd.callsign && !!d.weapon && !!d.from && Math.hypot(d.from[0] - S.muzzle[0], d.from[1] - S.muzzle[2]) < 0.02
          && !!d.byAt && Math.hypot(d.byAt[0] - b[0], d.byAt[1] - b[2]) < 0.05 && Math.abs(d.dist - dist) < 0.25 && d.off > 120 && Math.abs(d.off - offWant) < 6;
        line(ok1, "it names the man, his gun, the muzzle the round left, where he stood, how far — and that it came from behind", d ? `${d.byName} · ${d.weapon} · from (${f2(d.from?.[0])}, ${f2(d.from?.[1])}) want (${f2(S.muzzle[0])}, ${f2(S.muzzle[2])}) · stood (${f2(d.byAt?.[0])}, ${f2(d.byAt?.[1])}) want (${f2(b[0])}, ${f2(b[2])}) · ${f2(d.dist)} m want ${f2(dist)} · ${d.off.toFixed(0)}° off his gaze want ${offWant.toFixed(0)}` : 'no record');
        line(!!early && early.takes.length === 1 && earlyTail < 0.1 && !!rec && rec.takes.length === 1, 'a card raised the frame he falls already has the record; the whole take replaces it once its last second has run', `early take ends ${f2(earlyTail)} s after the fall · ${rec?.takes.length} take kept`);
        if (T && d) {
          const men = 1 + g.guards.length + g.civilians.length; const span = T.frames[T.frames.length - 1].t - T.frames[0].t; const full = T.frames.every((f: any) => f.n === men && f.men.length === men * MAN_STRIDE);
          let at: number[] | null = null; for (const f of T.frames) { if (f.t > d.t) break; for (let i = 0; i < f.n; i++) if (f.men[i * MAN_STRIDE] === gd.char.id) at = [f.men[i * MAN_STRIDE + 1], f.men[i * MAN_STRIDE + 2]]; }
          const tail = T.frames[T.frames.length - 1].t - d.t; const shot = T.shots.some((s: any) => s.kind === 'round' && s.who === gd.char.id);
          line(full && !!at && Math.hypot(at[0] - b[0], at[1] - b[2]) < 0.05 && span <= RECAP.secs + RECAP.after + 0.11 && tail >= RECAP.after - 0.11 && tail <= RECAP.after + 0.11 && shot && T.cast.length === men && T.doors.length === g.doors.list.length,
            "it carries the floor's last seconds: every man in every frame, the shooter where he stood, his round, to just past the fall", `${T.frames.length} frames over ${f2(span)} s · ${f2(tail)} s after the fall · ${men} men · shooter at ${at ? `(${f2(at[0])}, ${f2(at[1])})` : '?'} · his round ${shot ? 'kept' : 'MISSING'}`);
        }
        // (4) the panel
        const ui = await panel(g); const want = d ? [d.byName, gearText(d.weapon), `${d.dist < 10 ? d.dist.toFixed(1) : Math.round(d.dist)} m`] : [];
        line(!!ui && ui.labels.join('|') === want.join('|') && ui.canvas, 'the card carries the plan and three labels: who · with what · how far', ui ? `[${ui.labels.join(' · ')}]${ui.canvas ? '' : ' · no canvas'}` : 'no panel on the card');
        // (7) a restart
        g.restartEncounter(); R.step(2);
        line(deathRecapOf(g) === null && recapDeathsForChecks(g).length === 0, "a restart: that run's deaths are not the next run's");
      }
    }
    // (3) one of ours lost while the player still plays
    { RECAP.on = true; const R = await rig(5); const g = R.game, pl = g.player; g.aiEnabled = false; R.step(10);
      const civ = g.civilians[0];
      if (!civ) line(false, 'a civilian stands on this floor to be lost (the stand has none: nothing was checked)');
      else { pl.holstered = false; pl.slot = 'pistol'; let n = 0;
        while (civ.state !== 'dead' && n < 8) { const k = n++ * 0.785, c = civ.char.pos; g.teleportPlayer([c[0] + Math.sin(k) * 1.8, 0, c[2] + Math.cos(k) * 1.8]); const y = Math.atan2(c[0] - pl.char.pos[0], c[2] - pl.char.pos[2]); pl.char.bodyYaw = y; pl.char.aimYaw = y; R.step(20);
          if (Math.hypot(pl.char.pos[0] - civ.char.pos[0], pl.char.pos[2] - civ.char.pos[2]) > 2.6) continue; fireWeapon(g, pl.char, chest(civ.char), true); R.step(2); }
        R.step(90); const ds = recapDeathsForChecks(g), d = ds[ds.length - 1];
        line(civ.state === 'dead' && !!d && d.victim === civ.char.id && d.by === pl.char.id && d.byName === 'Player' && !d.player && deathRecapOf(g) === null && (await panel(g)) === null,
          'one of ours lost while a player still plays is kept, by name — and nothing is handed out, no panel', d ? `${d.name} by ${d.byName} (${d.cause}) · handed out: ${deathRecapOf(g) ? 'YES' : 'no'}` : `no death kept (civilian ${civ.state})`); }
    }
    // (8) what is NOT a death to explain, what is one all the same, and what a run played on past its end may show
    {
      const fresh = async (seed: number) => { RECAP.on = true; const R = await rig(seed); const g = R.game; g.aiEnabled = false; R.step(10); return { R, g, pl: g.player, civ: g.civilians[0], civ2: g.civilians[1] }; };
      const kept = (g: any) => { const ds = recapDeathsForChecks(g); return ds[ds.length - 1]; };
      const away = (g: any, c: any) => g.teleportPlayer([c.pos[0] < 20 ? 34 : 6, 0, 14]);
      { const A = await fresh(6); if (!A.civ) line(false, 'a civilian to put out cold');
        else { killGuard(A.g, A.civ, [0, 0, 1], true, 'choked', 'player'); A.R.step(30);
          line(A.civ.state === 'dead' && recapDeathsForChecks(A.g).length === 0, 'a civilian put out cold by a hand is not a death to explain', `${A.civ.callsign} ${A.civ.state} (${A.civ.downKind}) · kept ${recapDeathsForChecks(A.g).length}`); } }
      { const A = await fresh(7); if (!A.civ) line(false, 'a civilian beside a stun canister');
        else { away(A.g, A.civ.char); A.R.step(2); const at = [A.civ.char.pos[0] + 1, 0.2, A.civ.char.pos[2]];
          A.g.events.push({ kind: 'bang', pos: at, time: A.g.time, loud: true }); killGuard(A.g, A.civ, [0, 0, 1], false, 'shot', 'world'); A.R.step(30); const d = kept(A.g);
          const B = await fresh(7); away(B.g, B.civ.char); B.R.step(2); const at2 = [B.civ.char.pos[0] + 1, 0.2, B.civ.char.pos[2]];
          B.g.events.push({ kind: 'bang', pos: at2, time: B.g.time, loud: true, level: 2, who: B.pl.char.id, frag: true }); killGuard(B.g, B.civ, [0, 0, 1], false, 'shot', 'world'); B.R.step(30); const e = kept(B.g);
          line(!!d && d.cause === 'unknown' && !!e && e.cause === 'blast' && e.by === B.pl.char.id, 'a stun canister going off beside a man who drops is not named his killer; a fragmentation burst is', `stun: ${d?.cause} · frag: ${e?.cause} by ${e?.byName}`); } }
      { const A = await fresh(8); const gd = A.g.guards[0]; let d: any = null, tried = 0;
        if (A.civ && gd) { away(A.g, A.civ.char); const c = A.civ.char;
          for (let k = 0; k < 8 && !d; k++) { const a = k * 0.785, p = [c.pos[0] + Math.sin(a) * 2.2, 0, c.pos[2] + Math.cos(a) * 2.2], face = Math.atan2(c.pos[0] - p[0], c.pos[2] - p[2]);
            for (let i = 0; i < 20; i++) { A.R.put(gd, p, c.pos); A.R.step(1); }
            if (Math.hypot(gd.char.pos[0] - p[0], gd.char.pos[2] - p[2]) > 0.3 || A.g.col.shotBlocked(gd.char.muzzle, chest(c), 0.05)) continue; tried++;
            fireWeapon(A.g, gd.char, chest(c), false, { steady: true, spread: 0.01 });   // rescue.ts's execution, statement for statement: an AI round never tests a civilian, the game puts her down by hand
            killGuard(A.g, A.civ, [Math.sin(face), 0, Math.cos(face)], false, 'shot', 'guard'); A.R.step(30); d = kept(A.g); } }
        line(!!d && d.cause === 'round' && d.by === gd.char.id && d.byName === gd.callsign && !!d.from && !!d.weapon, 'a hostage shot the way a captor shoots one (his round through her, put down by the game) is his round, by name', d ? `${d.name} by ${d.byName} · ${d.weapon} · ${d.cause}` : `not kept (${tried} clear lines tried)`); }
      { const A = await fresh(9); if (!A.civ || !A.civ2) line(false, 'two civilians: one lost before the run ends, one after');
        else { away(A.g, A.civ.char); A.R.step(2); A.g.events.push({ kind: 'bang', pos: [A.civ.char.pos[0] + 1, 0.2, A.civ.char.pos[2]], time: A.g.time, loud: true, frag: true, who: A.pl.char.id }); killGuard(A.g, A.civ, [0, 0, 1], false, 'shot', 'world'); A.R.step(120);
          const before = deathRecapOf(A.g); A.g.mission.stage = 'done'; A.R.step(5); const atEnd = deathRecapOf(A.g);
          A.g.events.push({ kind: 'bang', pos: [A.civ2.char.pos[0] + 1, 0.2, A.civ2.char.pos[2]], time: A.g.time, loud: true, frag: true, who: A.pl.char.id }); killGuard(A.g, A.civ2, [0, 0, 1], false, 'shot', 'world'); A.R.step(120);
          const on = deathRecapOf(A.g), n = recapDeathsForChecks(A.g).length;
          line(before === null && !!atEnd && atEnd.takes.length === 1 && n === 2 && !!on && on.takes.length === 1 && on.takes[0].death.victim === A.civ.char.id,
            'a run played on past its end shows what happened up to the end and nothing after it', `before the end: ${before ? 'handed out' : 'nothing'} · at the end: ${atEnd?.takes.length ?? 0} · played on, ${n} lost: ${on?.takes.length ?? 0} shown`); } }
      { const A = await fresh(10); if (!A.civ) line(false, 'a civilian lost with the switch off');
        else { RECAP.on = false; A.R.step(2); killGuard(A.g, A.civ, [0, 0, 1], false, 'shot', 'world'); A.R.step(10); RECAP.on = true; A.R.step(30);
          line(A.civ.state === 'dead' && recapDeathsForChecks(A.g).length === 0, 'the switch thrown on mid-run: a man who went down while it was off is not taken for a death just seen', `kept ${recapDeathsForChecks(A.g).length}`); } }
    }
    // (9) the playback: where it draws the men is where they were
    { RECAP.on = true; let done = false; const ui = await import(`${ROOT}/src/ui/recap.ts`), { recapSpan, frameAt } = ui;
      // RECAP_BREAK=snap: every man read off the last sample alone, nothing between two — the line must then fail
      const recapMenAt = process.env.RECAP_BREAK === 'snap' ? (T: any, t: number) => { const f = frameAt(T, t), out: any[] = []; for (let j = 0; j < f.n; j++) out.push({ id: f.men[j * 5], x: f.men[j * 5 + 1], z: f.men[j * 5 + 2], aim: f.men[j * 5 + 3], bits: f.men[j * 5 + 4] }); return out; } : ui.recapMenAt;
      for (let seed = 11; seed < 24 && !done; seed++) { const T = await stage(seed); if (!T) continue; const { R, g, pl, gd, a, b } = T;
        const ux = b[0] - a[0], uz = b[2] - a[2], L = Math.hypot(ux, uz) || 1; const log: { t: number; sx: number; sz: number; sa: number; gx: number; gz: number }[] = [];
        for (let i = 0; i < 300; i++) {   // he comes in from 2.5 m further out at a jog and stands on his mark the last three seconds; Sam's gun line swings meanwhile
          const k = Math.max(0, 1 - i / 110), p = [b[0] + ux / L * 2.5 * k, 0, b[2] + uz / L * 2.5 * k], w = Math.sin(i * 0.03) * 0.6, c = Math.cos(w), sn = Math.sin(w);
          R.W.cursorAt([a[0] - (ux * c - uz * sn) * 3, 1, a[2] - (ux * sn + uz * c) * 3]); R.put(gd, p, a); R.step(1);
          log.push({ t: g.time, sx: pl.char.pos[0], sz: pl.char.pos[2], sa: pl.char.aimYaw, gx: gd.char.pos[0], gz: gd.char.pos[2] }); }
        T.shoot(); R.step(1); if (!pl.down) continue; R.step(Math.ceil((RECAP.after + 0.5) * 60));
        const rec = deathRecapOf(g), take = rec?.takes[rec.main]; done = true;
        if (!take) { line(false, 'the playback has a take to play'); break; }
        const span = recapSpan(take); let worst = 0, rough = -1, worstA = 0, n = 0, jumps = 0, even = 0; const moved = Math.hypot(log[0].gx - log[log.length - 1].gx, log[0].gz - log[log.length - 1].gz);
        for (let q = 0; q < log.length; q++) { const s = log[q]; if (q < 4 || q > log.length - 4 || s.t < span[0] || s.t >= take.death.t) continue;   // (the first moments follow this check's own teleport of him)
          const men = recapMenAt(take, s.t), S = men.find((m: any) => m.id === pl.char.id), G = men.find((m: any) => m.id === gd.char.id);
          if (!S || !G) { worst = Infinity; break; } n++;
          // where his walk is even (the three frames either side on one straight line at one pace) he is drawn where he was, to half a centimetre: read off the last
          // sample alone he would be up to two frames stale. Where it is not (furniture he is stood in shoves him in a frame, he stops) a line between two
          // samples cannot know which frame it happened in: there, within what he moved in those frames
          const a = log[q - 3], b = log[q + 3], bendG = Math.hypot(a.gx + b.gx - 2 * s.gx, a.gz + b.gz - 2 * s.gz), bendS = Math.hypot(a.sx + b.sx - 2 * s.sx, a.sz + b.sz - 2 * s.sz);
          let moveS = 0, moveG = 0; for (let w = q - 3; w <= q + 3; w++) { moveS = Math.max(moveS, Math.hypot(log[w].sx - s.sx, log[w].sz - s.sz)); moveG = Math.max(moveG, Math.hypot(log[w].gx - s.gx, log[w].gz - s.gz)); }
          const eS = Math.hypot(S.x - s.sx, S.z - s.sz), eG = Math.hypot(G.x - s.gx, G.z - s.gz);
          if (bendG < 0.002 && moveG > 0.03) { even++; worst = Math.max(worst, eG); } else { if (moveG > 0.1) jumps++; rough = Math.max(rough, eG - moveG); }
          if (bendS < 0.002) worst = Math.max(worst, eS); else rough = Math.max(rough, eS - moveS);
          const da = S.aim - s.sa; worstA = Math.max(worstA, Math.abs(Math.atan2(Math.sin(da), Math.cos(da)))); }
        const fallen = recapMenAt(take, take.death.t + 0.5).find((m: any) => m.id === pl.char.id);
        line(n > 200 && even > 60 && moved > 1.5 && worst < 0.005 && rough < 0.01 && jumps < n / 10 && worstA < 0.03 && span[1] - span[0] > RECAP.secs && span[1] - span[0] <= RECAP.secs + RECAP.after + 0.2 && !!fallen && (fallen.bits & 1) === 1,
          'the playback puts every man where he was: the shooter walking in, Sam and his gun line, frame by frame over the last seconds', `${n} moments, ${even} of them the shooter in even stride: worst ${(worst * 1000).toFixed(1)} mm off there · elsewhere never ${rough > 0 ? `more than ${(rough * 100).toFixed(1)} cm ` : ''}past what he moved inside the sample (${jumps} moments he was shoved), ${(worstA * 57.3).toFixed(1)}° of gun line · the shooter walked ${moved.toFixed(1)} m · ${(span[1] - span[0]).toFixed(2)} s played`); }
      if (!done) line(false, 'a staged round put Sam down for the playback (no seed did)');
    }
    // (10) the playback's clock, on a frame clock of this check's own
    { RECAP.on = true; let done = false; const G = globalThis as any, hadR = G.requestAnimationFrame, hadC = G.cancelAnimationFrame;
      for (let seed = 11; seed < 24 && !done; seed++) { const T = await stage(seed); if (!T) continue; const { R, g, pl } = T; const civ = g.civilians[0]; if (civ) killGuard(g, civ, [0, 0, 1], false, 'shot', 'world'); R.step(20);   // a second of ours lost first, by nothing anybody can name
        T.shoot(); R.step(1); if (!pl.down) continue; R.step(Math.ceil((RECAP.after + 0.5) * 60)); done = true;
        let due: ((t: number) => void) | null = null, asked = 0; G.requestAnimationFrame = (f: (t: number) => void) => { due = f; return ++asked; }; G.cancelAnimationFrame = () => { due = null; };
        try {
          const t0 = performance.now(), Pn = await panel(g, true); const cv = Pn?.cv, ks: number[] = [], run = (ms: number) => { const f = due; due = null; f?.(t0 + ms); if (cv) ks.push(+cv.dataset.k); };
          const span = 8 + RECAP.after;   // about the take's length: read off the clock below, not assumed
          for (let ms = 0; ms <= 14000; ms += 100) run(ms);
          const top = ks.indexOf(1), rise = top > 0 && ks.slice(0, top + 1).every((k, i) => i === 0 || k >= ks[i - 1]), held = ks.filter(k => k === 1).length, again = ks.slice(top).findIndex(k => k < 0.5);
          line(!!cv && top > 60 && top < 110 && rise && ks[1] > 0 && ks[1] < 0.05 && held >= 15 && held <= 22 && again > 0,
            'the playback runs at the speed it happened: its clock rises to the end in the take\'s own seconds, rests there, and starts again', `0 → 1 in ${(top / 10).toFixed(1)} s for a take of about ${span.toFixed(1)} s · rested ${(held / 10).toFixed(1)} s · then from ${again > 0 ? ks[top + again].toFixed(2) : '—'}`);
          // two lost: a chip a man, the player's own shown first; the other man's chip shows HIS last seconds and names nobody
          { const hadD = 'document' in G, prevD = G.document; G.document = Pn?.doc; try { const U = G.__recap, chips = Pn?.chips ?? [], lit = () => chips.map((c: any) => c.cls.has('on') ? c.textContent : '').filter(Boolean).join(','); const first = `${U?.take.death.name}/${lit()}`;
            const other = chips.findIndex((c: any) => c.textContent !== pl.char.name && c.textContent !== U?.take.death.name); U?.show(other); const second = `${U?.take.death.name}/${lit()}`, cap = cv?.parentElement?.all((e: any) => e.cls.has('db-recap-cap'))[0];
            line(!!civ && chips.length === 2 && first === `${chips[1 - other]?.textContent}/${chips[1 - other]?.textContent}` && second === `${chips[other]?.textContent}/${chips[other]?.textContent}` && U.take.death.cause === 'unknown' && cap?.style.display === 'none' && U.playing === true,
              'two of ours lost: a chip a man, the player\'s own up first; the other chip plays that man\'s last seconds and, with nobody to name, names nobody', `${chips.length} chips · first ${first} · then ${second} (${U?.take.death.cause})`);
            U?.show(1 - other); } finally { if (hadD) G.document = prevD; else delete G.document; } }
          // the card put away: no picture is made, and it is back when the card is
          const root = cv?.parentElement; const before = asked; if (root) root.offsetParent = null; run(14100); const asleep = asked === before && due === null; if (root) delete root.offsetParent;
          // gone for good: one more frame and the clock is not asked for again
          G.__recap?.stop(); const stopped = due === null && G.__recap?.playing === false;
          line(asleep && stopped, 'put away it draws nothing and asks for no frame; stopped it stays stopped', `asleep ${asleep} · stopped ${stopped}`);
        } finally { G.__recap?.stop(); G.requestAnimationFrame = hadR; G.cancelAnimationFrame = hadC; }
      }
      if (!done) line(false, 'a staged round put Sam down for the playback\'s clock (no seed did)');
    }
    // (11) while the run is on: a man of the squad lost, as much as the squad knows
    { const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`); const { lostLive, RECAP_STATS } = M;
      const eye = (c: any): number[] => c.bones?.head ?? [c.pos[0], 1.65, c.pos[2]], lie = (p: number[]): number[] => [p[0], 0.4, p[2]];
      const rowOf = (g: any, name: string) => g.orders.hud().status.flatMap((r: any) => r.opts).find((o: any) => o.text.includes(name));
      const copy = (r: any) => r ? { gone: !!r.gone, from: r.lost ? r.lost.from && [...r.lost.from] : undefined } : null;   // (copied: the row hands out the live record)
      /** A room clear's pair. A defender puts one round into the first man at a place neither his mate nor Sam has a line to.
       *    Nobody hears it in any mode but `heard` (the hearing reach shut for the run), so each line below is about the eyes alone.
       *    deaf  = and nobody sees it        heard = nobody sees it, they hear it (the reach opened: the team starts further off than it carries)
       *    mate  = his mate stands where he sees him go down, Sam near but with no line   sam = Sam is the one who sees him go down
       *    late  = deaf, and his mate comes to where he sees him lie two seconds after   gone = mate, and the mate is himself put down a fifth of a second later */
      const run = async (live: boolean, mode: 'deaf' | 'heard' | 'mate' | 'sam' | 'late' | 'gone') => {
        RECAP.on = true; RECAP.live = live; Object.assign(RECAP, { liveHearM: mode === 'heard' ? 1e9 : 0, liveSeeM: was.liveSeeM, liveSideM: mode === 'mate' ? 1e9 : was.liveSideM });
        const R = await rig(31); const g = R.game; await startFromQuery(g, new URLSearchParams('?roomclear=3')); g.aiEnabled = false; g.godMode = false; R.step(30);
        const sq = g.orders.squad().filter((x: any) => x.state !== 'dead'), A = sq[0], B = sq[1]; if (!A || !B) return null;
        for (const H of g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead')) {
          const hp = [...H.char.pos], tried: number[][] = [];
          for (let k = 0; k < 4; k++) {
            const q = R.spot(hp, 2.6, true, tried); if (!q) break; tried.push(q);
            if (!g.col.segmentBlocked(eye(B.char), lie(q)) || !g.col.segmentBlocked(eye(g.player.char), lie(q))) continue;   // somebody still up would see him fall from where they start: not this place
            let w: number[] | null = null; const not: number[][] = [q, hp];   // a place with a line to where he will lie
            for (let j = 0; j < 6 && !w; j++) { const c = R.spot(q, 3, true, not); if (!c) break; not.push(c); if (!g.col.segmentBlocked([c[0], 1.65, c[2]], lie(q))) w = c; }
            if (!w) continue;
            for (let i = 0; i < 20; i++) { R.put(A, q, hp); R.put(H, hp, q); if (mode === 'mate' || mode === 'gone') R.put(B, w, q); R.step(1); }
            if (mode === 'sam') { g.teleportPlayer([w[0], 0, w[2]]); R.step(2); }
            if (A.state === 'dead' || g.col.shotBlocked(H.char.muzzle, chest(A.char), 0.05)) continue;
            const before = copy(rowOf(g, A.callsign)), calls0 = RECAP_STATS.calls, muzzle = [...H.char.muzzle];
            fireWeapon(g, H.char, chest(A.char), false, { steady: true }); R.step(1); if (A.state !== 'dead') continue;
            const at = [...A.char.pos]; let u = [muzzle[0] - at[0], muzzle[2] - at[2]]; { const L = Math.hypot(u[0], u[1]) || 1; u = [u[0] / L, u[1] / L]; }
            const seg = g.col.segmentBlocked; if (process.env.RECAP_BREAK === 'seen') { g.col.segmentBlocked = () => false; RECAP.liveSeeM = 1e9; }   // (the break: everybody sees through walls, any distance)
            const first = copy(rowOf(g, A.callsign));   // the frame after the fall: before any beat
            if (mode === 'gone') { R.step(12); killGuard(g, B, [0, 0, 1], true, 'struck', 'world'); }
            R.step(120); g.col.segmentBlocked = seg;
            if (mode === 'late') { for (let i = 0; i < 3; i++) { R.put(B, w, at); R.step(1); } R.step(90); }
            const L1 = lostLive(g).find((x: any) => x.id === A.char.id), said = (g.cues as any).bubbles.get(B)?.text ?? '';   // the cue itself: a bark of his own since would stand over it in bubbleOf
            const pc = g.player.char, side = g.fogOfWar.sideOf([pc.pos[0] + u[0] * 50, 0, pc.pos[2] + u[1] * 50]);
            const out = { g, A, B, H, before, first, L: L1 ? { ...L1, from: L1.from && [...L1.from] } : null, keys: Object.keys(L1 ?? {}).sort().join(' '), row: copy(rowOf(g, A.callsign)), said, side, u, calls: RECAP_STATS.calls - calls0, card: deathRecapOf(g), digest: '' };
            R.step(60); out.digest = JSON.stringify(digestGame(g, true));
            return out;
          }
        }
        return null;
      };
      const offDeg = (r: any) => r?.L?.from ? Math.acos(Math.max(-1, Math.min(1, r.L.from[0] * r.u[0] + r.L.from[1] * r.u[1]))) * 180 / Math.PI : NaN;
      const anEighth = (v: number[] | null | undefined) => !!v && v.every(x => [0, 1, Math.SQRT1_2].some(k => Math.abs(Math.abs(x) - k) < 1e-9));
      const deaf = await run(true, 'deaf');
      if (!deaf) line(false, 'a defender\'s round put a teammate down out of everybody\'s sight (no place did: the check looked at nothing)');
      else {
        line(!deaf.before!.gone && deaf.first!.gone && deaf.row!.gone && deaf.row!.from === null && !!deaf.L && deaf.L.from === null && deaf.L.knownAt === Infinity && deaf.calls === 0 && deaf.card === null,
          'lost where nobody still up sees him go down or hears it: his row is struck and that is all — no direction, no word, and the card\'s record stays shut while the run is on',
          `row before ${deaf.before!.gone ? 'struck' : 'plain'} → ${deaf.row!.gone ? 'struck' : 'plain'} · direction ${deaf.L?.from ? JSON.stringify(deaf.L.from) : 'none'} · words ${deaf.calls} · card ${deaf.card === null ? 'shut' : 'OPEN'}`);
        const late = await run(true, 'late');
        line(!!late && !!late.L && late.L.from === null && late.calls === 0, 'his mate finds him lying two seconds after: he is still only down (a man found tells nobody which way it came)', late ? `direction ${late.L?.from ? JSON.stringify(late.L.from) : 'none'}` : 'the run did not play');
        const heard = await run(true, 'heard');
        line(!!heard && heard.first!.from === null && !!heard.L && Number.isFinite(heard.L.knownAt) && heard.L.knownAt - heard.L.t >= RECAP.liveBeat - 1e-9 && anEighth(heard.L.from) && offDeg(heard) <= 22.5 + 1e-6 && heard.calls === 0,
          'nobody sees it but they hear the shot: after a beat the squad has the way it came from, to the nearest eighth of the compass and no finer; nobody saw, so nobody says',
          heard ? `${f2(heard.L ? heard.L.knownAt - heard.L.t : NaN)} s after · ${JSON.stringify(heard.L?.from?.map((x: number) => +x.toFixed(3)))} is ${f2(offDeg(heard))}° off the true line · words ${heard.calls}` : 'the run did not play');
        const mate = await run(true, 'mate'), word = mate ? (mate.side === 'front' ? 'from the front' : mate.side === 'behind' ? 'from behind us' : `from the ${mate.side}`) : '';
        line(!!mate && !!mate.L && anEighth(mate.L.from) && mate.calls === 1 && mate.said === `${word}!`,
          'his mate sees him go down: the squad has the way, and the mate says which side — the fog\'s own word for it, by the player\'s shoulders',
          mate ? `${mate.B.callsign}: "${mate.said}" · words ${mate.calls}` : 'the run did not play');
        { // nothing is DRAWN for that way (RECAP.liveArrows; RECAP_BREAK=arrows: the arrows left on — must FAIL)
          const fs = await import('node:fs'), ov: string = fs.readFileSync(`${ROOT}/src/ui/overlay.ts`, 'utf8'), pf: string = fs.readFileSync(`${ROOT}/src/host/profile.ts`, 'utf8');
          if (process.env.RECAP_BREAK === 'arrows') RECAP.liveArrows = true; else RECAP.liveArrows = was.liveArrows;
          const shipped = RECAP.liveArrows === false && M.lostArrowsShown() === false; RECAP.liveArrows = true; const back = M.lostArrowsShown() === true; RECAP.live = false; const dead = M.lostArrowsShown() === false; RECAP.live = true; RECAP.liveArrows = was.liveArrows;
          const sites = (ov.match(/lostArrowsShown\(\)/g) ?? []).length, stroke = /lostArrowsShown\(\) \? lostLive\(game\) : \[\]/.test(ov), rowMark = /o\.lost && lostArrowsShown\(\) \? lostArrow\(/.test(ov), flag = /RECAP\.liveArrows = q\.get\('recaparrows'\) === '1'/.test(pf);
          line(!!mate && !!mate.L && anEighth(mate.L.from) && mate.row!.gone && shipped && back && dead && stroke && rowMark && flag,
            'the way is known and said, and nothing is drawn for it: no arrow on his row, no stroke on the ground (RECAP.liveArrows off, as the page has it; ?recaparrows=1 = both back)',
            `row ${mate?.row?.gone ? 'struck' : 'plain'}, the way known ${!!mate?.L?.from} · drawn as shipped ${!shipped} · with the key on ${back} · with the live rule off ${!dead} · overlay.ts asks before the stroke ${stroke}, before the row's arrow ${rowMark} (${sites} asks) · the page's flag ${flag}`); }
        const told = mate ? JSON.stringify(mate.L ?? {}) + JSON.stringify(mate.row ?? {}) + mate.said : '';
        line(!!mate && !told.includes(mate.H.callsign) && mate.keys === 'at from id knownAt name t' && mate.card === null,
          'what the squad is handed is a way off the man: never the shooter\'s name, never his place — and the card\'s record is still shut', mate ? `fields: ${mate.keys}` : '');
        const gone = await run(true, 'gone');
        line(!!gone && !!gone.L && gone.L.from === null && gone.calls === 0 && gone.B.state === 'dead', 'the mate who saw is put down himself before the beat is out: what he saw goes with him', gone ? `direction ${gone.L?.from ? JSON.stringify(gone.L.from) : 'none'} · ${gone.B.callsign} ${gone.B.state}` : 'the run did not play');
        const sam = await run(true, 'sam');
        line(!!sam && !!sam.L && anEighth(sam.L.from) && sam.calls === 0, 'the player himself is the one who sees him go down: the way is known, nobody tells him what he watched', sam ? `words ${sam.calls}` : 'the run did not play');
        const off = await run(false, 'mate');
        line(!!off && !off.L && !off.row!.gone && off.calls === 0 && off.said === '', 'the live rule off (RECAP.live): the row as it was, nothing said', off ? `row ${off.row!.gone ? 'struck' : 'plain'} · words ${off.calls}` : 'the run did not play');
        line(!!off && !!mate && off.digest === mate.digest, 'it only reads the game: the same staged run ends on the same digest with the live rule on and off', off ? `${off.digest.length} bytes of digest` : '');
      }
      Object.assign(RECAP, was);
    }
    // (5) off, (6) reads only
    { const run = async (on: boolean) => { for (let seed = 11; seed < 24; seed++) { RECAP.on = on; const T = await stage(seed); if (!T) continue; T.shoot(); T.R.step(1); if (!T.pl.down) continue; T.R.step(150);
          return { seed, digest: JSON.stringify(digestGame(T.g, true)), rec: deathRecapOf(T.g), kept: recapDeathsForChecks(T.g).length, ui: await panel(T.g) }; } return null; };
      const off = await run(false), on = await run(true);
      line(!!off && off.rec === null && off.kept === 0 && off.ui === null, 'the switch off: nothing kept, nothing handed out, no panel');
      line(!!off && !!on && off.seed === on.seed && off.digest === on.digest && !!on.rec, 'it only reads the game: the staged run ends on the same digest with the switch on and off', off && on ? `seed ${on.seed} · ${on.digest.length} bytes of digest` : 'a run did not play');
    }
  } finally { Object.assign(RECAP, was); }
  console.log(all ? '=== deathrecap: ALL PASS ===' : '=== deathrecap: FAILED ===');
  return all;

  /** the card built over a stand-in document: is the panel on it, and what do its labels say */
  async function panel(g: any, draws = false): Promise<{ labels: string[]; canvas: boolean; cv: any; chips: any[]; /** the stand-in document it was built over (a caller that works the panel afterwards puts it back up for that) */ doc: any } | null> {
    const ctx2d: any = new Proxy({}, { get: (_o, k) => k === 'measureText' ? () => ({ width: 30 }) : () => ctx2d, set: () => true });   // a context that takes any call and draws nothing
    class El { isConnected = true; dataset: any = {}; children: any[] = []; _text = ''; nodeType = 1; cls = new Set<string>(); width = 0; height = 0; title = ''; onclick: any = null; onmousemove: any = null; onmouseleave: any = null; style: any = {};
      classList = { add: (...c: string[]) => c.forEach(x => this.cls.add(x)), remove: (...c: string[]) => c.forEach(x => this.cls.delete(x)), contains: (c: string) => this.cls.has(c), toggle: (c: string, on?: boolean) => { if (on ?? !this.cls.has(c)) this.cls.add(c); else this.cls.delete(c); } };
      constructor(public tagName: string) {}
      get className() { return [...this.cls].join(' '); } set className(v: string) { this.cls = new Set(v.split(/\s+/).filter(Boolean)); }
      appendChild(c: any) { this.children.push(c); c.parentElement = this; return c; }
      append(...cs: any[]) { for (const c of cs) this.appendChild(typeof c === 'string' ? Object.assign(new El('#text'), { nodeType: 3, _text: c }) : c); }
      get textContent(): string { return this.nodeType === 3 ? this._text : this._text + this.children.map(c => c.textContent).join(''); }
      set textContent(v: string) { this.children = []; this._text = v; }
      getContext() { return draws ? ctx2d : null; } getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 280 }; } setAttribute(k: string, v: string) { (this as any)[k] = v; } focus() {}
      all(sel: (e: El) => boolean, out: El[] = []): El[] { for (const c of this.children) if (c.nodeType === 1) { if (sel(c)) out.push(c); c.all(sel, out); } return out; }
    }
    const G = globalThis as any; const had = 'document' in G, prev = G.document; G.document = { createElement: (t: string) => new El(t.toUpperCase()) };
    try { const { renderDebrief } = await import(`${ROOT}/src/ui/debrief.ts`); const host = new El('DIV'); renderDebrief(host as any, g, []);
      const root = host.all(e => e.cls.has('db-recap'))[0]; if (!root) return null;
      const cvs = root.all(e => e.tagName === 'CANVAS');
      return { labels: (root.all(e => e.cls.has('db-recap-cap'))[0]?.children ?? []).map((c: any) => c.textContent), canvas: cvs.length === 1, cv: cvs[0], chips: root.all(e => e.cls.has('db-recap-chip')), doc: G.document };
    } finally { if (had) G.document = prev; else delete G.document; }
  }
}

if (import.meta.main) process.exit((await deathrecapCheck()) ? 0 : 1);
