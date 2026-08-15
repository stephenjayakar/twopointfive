// The 'carbine-fire' probes (rifles, docs/internal/sc20k-design.md §3.3–§3.5 / §9 — lane R2: how a guard FIRES the carbine), run through probes.ts:
//   bun run tools/qa/probes.ts carbine-fire [--verbose]
// The AKS-74U row is dealt to Reyes (tune.carbineGuards 'reyes'), he is stood in the corridor alert and licensed on a lit, god-mode Sam standing in the open, and
// every round is read back off the 'guardShot' events fireWeapon raises (frame, the row that fired it, the segment it flew). PASS / FAIL each, all headless:
//   (1) burst structure at 8 m, 90 s of it: rounds come in groups of 2–4 (a box running dry may cut the last group of thirty short), 6 ± 1 frames apart inside a
//       group at 60 Hz and never two in a frame, 0.9–1.6 s between groups (the reload's 2.6 s where a box ran out), thirty to a box exactly; and the floor HEARS
//       it as gunfire — the two men parked out on the lot go to 0.92 on the first round, count every round, and 'shots fired!' is said once, not per round;
//   (2) the cone: within a burst the k-th round's miss off the aim line grows with k on average (first-round accuracy, then +0.03 a round) and the first round of
//       the NEXT burst is tight again;
//   (3) the reload beat: 'reloading!' + magOut the frame the thirtieth round goes, reloadT 2.6 s and no round inside it, the empty thirty-round box on the floor
//       0.7 s in (a 'mag' item, fill 2), a full box after;
//   (4) muzzle discipline holds per ROUND: Sam grabs a colleague between two rounds of a burst — not one more round of it, the burst record gone next frame;
//   (5) the opening burst goes wide (tune.suppressFirst) at 14 m: every round of Reyes' first burst passes ≥ 0.5 m off Sam's axis and stops in geometry, none in
//       him; his second burst is aimed (mean miss well inside that); with the flag off the first burst is aimed like the rest; at 8 m nothing goes wide either way;
//   (6) a dying rifleman lets the RIFLE go: exactly one new item and it is 'rifle' (no 'pistol', no 'torch'), finite, inside the building, settled within 3 s,
//       his light dark within a second and for good, the sidearm he never drew still drawn on the body and no carbine part on it; the same for a calm rifleman
//       shot on his round (no torch to drop: his light was on the gun) and for one taken down quietly (laid down, not flung);
//   (7) 'none' (the default) deals nobody anything: every man's row is the 9 mm, no burst state ever appears in 20 s of the same fight, and flipping the knob
//       re-deals live both ways (Reyes ↔ aks74u with a fresh box, muzzle 0.50 ↔ 0.26) — the pistols' identity probe (weapons-identity) is the rest of that promise.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon, killGuard, handProps } = await import(`${ROOT}/src/game/combat.ts`);
const { resetChase } = await import(`${ROOT}/src/game/guards.ts`);
const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
const { RIG } = await import(`${ROOT}/src/game/rigProps.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
/** A guard planted at `p` facing yaw, still, no path, posed twice (bones where the sight tests read them). */
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
/** parked out on the lot east of the building, held and pinned, facing east; deaf and blind too unless `hears` */
function park(gd: any, i: number, hears = false) { gd.hold = true; gd.pinned = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); if (!hears) { gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; } }
/** alert, licensed (a sighting this frame), planted where he is (pinned: fires from where he was put, at the trunk), the gun coming round in `fireCd` */
function armAlert(gd: any, game: any, fireCd = 0.3) { gd.hold = false; gd.pinned = true; gd.dazzledUntil = -1; gd.heardUpTo = 1e12; gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0; gd.fireCd = fireCd; gd.reloadT = -1; gd.lastKnown = v3.copy(game.player.char.pos); gd.lastSeenT = game.time; resetChase(gd); }
const chest = (gd: any): Vec3 => gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 1.1, 0]);
const REYES_AT: Vec3 = [17.5, 0, 11.3];   // in the corridor by the server-room door, facing east down its length (weapons-identity's spot for the sidearm)

interface Round { f: number; weapon: string; from: Vec3; to: Vec3; aim: Vec3; sam: Vec3; miss: number; offAxis: number; hitSam: boolean; }
/** Reyes with the carbine, alert on a lit god-mode Sam standing `range` m east of him in the corridor; the other two parked on the lot (hearing or not). Returns the
 *  world, Reyes, and a per-frame `step()` that advances one frame and returns the rounds Reyes let go in it (off the guardShot events stamped this frame). */
async function stage(seed: number, range: number, o: { othersHear?: boolean; suppressFirst?: boolean; deal?: 'reyes' | 'none' | 'all' } = {}) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W; const pl = game.player;
  game.godMode = true; game.aiEnabled = true; game.tune.carbineGuards = o.deal ?? 'reyes'; if (o.suppressFirst !== undefined) game.tune.suppressFirst = o.suppressFirst;
  for (let i = 0; i < 5; i++) W.step(DT);
  const reyes = game.guards.find((g: any) => g.callsign === 'Reyes'); const others = game.guards.filter((g: any) => g !== reyes);
  others.forEach((gd: any, i: number) => park(gd, i, !!o.othersHear));
  game.teleportPlayer([REYES_AT[0] + range, 0, 11.4]); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; pl.pistol.lightOn = false;
  place(reyes, REYES_AT, Math.PI / 2); W.step(DT); pl.visibility = 0.9;
  armAlert(reyes, game, 0.3);
  let frame = 0;
  const seen = new Set<any>();
  /** one frame; the rounds Reyes let go in it. Anything logged from INSIDE the step (game.say) belongs to frame `frame + 1` — the number this step's rounds get. */
  const step = (): Round[] => {
    pl.visibility = 0.9; pl.hitFlash = 0;
    const aim: Vec3 = [pl.char.bones.spine2?.[0] ?? pl.char.pos[0], pl.char.pos[1] + (pl.crouch ? 0.8 : 1.25), pl.char.bones.spine2?.[2] ?? pl.char.pos[2]];   // the alert branch's aim point on him this step (trunk at chest height, read before the step as the guard reads it: Sam stands still)
    W.step(DT); frame++;
    const out: Round[] = [];
    for (const e of game.events) {
      if (seen.has(e)) continue; seen.add(e);
      if (e.kind !== 'guardShot' || e.time !== game.time || v3.distXZ(e.pos, reyes.char.pos) > 0.05) continue;
      const from = e.from as Vec3, to = e.to as Vec3;
      const d = v3.normalize(v3.sub(to, from)), a = v3.normalize(v3.sub(aim, from)); const L = v3.dist(from, aim);
      const miss = Math.tan(Math.acos(Math.min(1, v3.dot(d, a)))) * L;   // metres off the aim line at Sam's range: the round's angular error, whatever it then hit
      const h = pl.char.bones.hips ?? pl.char.pos;   // closest the round's flat segment came to Sam's axis
      const sx = to[0] - from[0], sz = to[2] - from[2]; const L2 = sx * sx + sz * sz; const tt = L2 > 1e-6 ? Math.max(0, Math.min(1, ((h[0] - from[0]) * sx + (h[2] - from[2]) * sz) / L2)) : 0;
      const offAxis = Math.hypot(from[0] + sx * tt - h[0], from[2] + sz * tt - h[2]);
      out.push({ f: frame, weapon: e.weapon, from, to, aim, sam: v3.copy(pl.char.pos), miss, offAxis, hitSam: pl.hitFlash > 0.9 });   // (hitFlash: zeroed before the step, set to 1 by a round that reached him, 0.95 after the update's own decay — never two rounds a frame)
    }
    return out;
  };
  return { W, game, reyes, others, step, get frame() { return frame; } };
}
/** rounds → groups by frame gap (a new group where the gap to the previous round exceeds `split` frames) */
function groups(rounds: Round[], split = 12): Round[][] { const out: Round[][] = []; for (const r of rounds) { const g = out[out.length - 1]; if (g && r.f - g[g.length - 1].f <= split) g.push(r); else out.push([r]); } return out; }
const mean = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;

export async function carbineFire(verbose = process.argv.includes('--verbose')) {
  console.log('\n=== carbine-fire: how a rifleman fires the AKS-74U — bursts, the cone, the reload beat and its dropped box, discipline per round, the wide opening burst, the rifle that drops, and \'none\' = nothing (tune.carbineGuards \'reyes\') ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const B = WEAPONS.aks74u.burst!, RL = WEAPONS.aks74u.reload;

  // ---- (1) + (2) + (3): 90 s at 8 m, everything read off the events; the parked men hear it
  {
    const S = await stage(4701, 8, { othersHear: true }); const { game, reyes, others } = S;
    const lines: string[] = []; const origSay = game.say.bind(game); game.say = (gd: any, text: string, radio = false) => { lines.push(`${gd.callsign}:${text}:f${S.frame + 1}`); return origSay(gd, text, radio); };
    const audio: any[] = []; S.W.audioLog = audio;
    const rounds: Round[] = []; let multi = 0; const reloads: { start: number; span: number; t0: number; roundsInside: number; magItemAt: number; magFill: number; roundsBefore: number }[] = [];
    let rel: typeof reloads[0] | null = null; let wasRel = false; let itemsSeen = new Set<any>(game.items.items); let sinceReload = 0;
    let awarenessAfterFirst: number[] | null = null, shotsHeardAfterFirstBurst: number[] | null = null;
    for (let f = 0; f < 60 * 90; f++) {
      const rs = S.step(); if (rs.length > 1) multi++; rounds.push(...rs); sinceReload += rs.length;
      if (rounds.length >= 1 && S.frame >= rounds[0].f + 2 && !awarenessAfterFirst) awarenessAfterFirst = others.map((o: any) => o.awareness);   // (a round raised late in the update order reaches the others' ears the frame after)
      const isRel = reyes.reloadT >= 0;
      if (isRel && !wasRel) { rel = { start: S.frame, span: 0, t0: reyes.reloadT, roundsInside: 0, magItemAt: -1, magFill: -1, roundsBefore: sinceReload }; sinceReload = 0; }
      if (isRel && rel) { rel.roundsInside += rs.filter(r => r.f > rel!.start).length; for (const it of game.items.items) if (!itemsSeen.has(it)) { itemsSeen.add(it); if (it.kind === 'mag' && rel.magItemAt < 0) { rel.magItemAt = S.frame - rel.start; rel.magFill = it.fill; } } }
      if (!isRel && wasRel && rel) { rel.span = S.frame - rel.start; reloads.push(rel); rel = null; }
      wasRel = isRel;
      if (f === 60 * 5 && !shotsHeardAfterFirstBurst) shotsHeardAfterFirstBurst = others.map((o: any) => o.witness.heard.shots);
    }
    const gs = groups(rounds);
    // (1) structure
    {
      const fails: string[] = [];
      if (rounds.length < 60) fails.push(`only ${rounds.length} rounds in 90 s`);
      if (rounds.some(r => r.weapon !== 'aks74u')) fails.push(`a round from '${rounds.find(r => r.weapon !== 'aks74u')?.weapon}', not the carbine`);
      if (multi) fails.push(`${multi} frames with two rounds in them`);
      const intra: number[] = [], gaps: number[] = [], sizes: number[] = []; const shortNotAtBoxEnd: string[] = [];
      let cum = 0;
      gs.forEach((g, i) => {
        sizes.push(g.length); for (let k = 1; k < g.length; k++) intra.push(g[k].f - g[k - 1].f);
        if (i > 0) gaps.push(g[0].f - gs[i - 1][gs[i - 1].length - 1].f);
        const before = cum; cum += g.length;
        if (g.length < B.min && Math.floor(before / 30) === Math.floor((cum) / 30) && cum % 30 !== 0) shortNotAtBoxEnd.push(`group ${i} of ${g.length} at f${g[0].f} (rounds ${before}→${cum})`);   // a group under the minimum is only right where the box ran dry under it
        if (g.length > B.max) fails.push(`group ${i} of ${g.length} rounds (max ${B.max})`);
      });
      if (shortNotAtBoxEnd.length) fails.push(`short groups not at a box end: ${shortNotAtBoxEnd.join(', ')}`);
      const badIntra = intra.filter(x => x < 5 || x > 7); if (badIntra.length) fails.push(`intra-burst intervals outside 6±1 frames: ${badIntra.slice(0, 8).join(',')}`);
      const relGapLo = Math.round(RL.dur / DT) - 3, relGapHi = Math.round(RL.dur / DT) + Math.round(B.gapMax / DT) + 4;
      const normal = gaps.filter(x => x < relGapLo), long = gaps.filter(x => x >= relGapLo);
      const badGap = normal.filter(x => x < Math.floor(B.gapMin / DT) - 2 || x > Math.ceil(B.gapMax / DT) + 4); if (badGap.length) fails.push(`gaps between bursts outside ${B.gapMin}–${B.gapMax} s: ${badGap.slice(0, 8).map(x => (x * DT).toFixed(2) + ' s').join(', ')}`);
      const badLong = long.filter(x => x > relGapHi); if (badLong.length) fails.push(`a pause of ${badLong.map(x => (x * DT).toFixed(1)).join('/')}s — longer than a reload and a gap`);
      if (long.length !== reloads.length) fails.push(`${long.length} reload-length pauses but ${reloads.length} reloads`);
      // thirty to a box: rounds between reload starts
      const badBox = reloads.filter(r => r.roundsBefore !== 30); if (badBox.length) fails.push(`rounds per box ${reloads.map(r => r.roundsBefore).join('/')}, want 30 each`);
      // hearing: the parked men
      const aw = awarenessAfterFirst ?? []; if (aw.some(a => a < 0.9)) fails.push(`after the first round the parked men's awareness is ${aw.map(f3).join('/')}, want the gunfire floor 0.92 (less a frame or two of an alert man's slow decay)`);
      const firstBurstN = gs[0]?.length ?? 0; const heard = shotsHeardAfterFirstBurst ?? [];
      const roundsBy5s = rounds.filter(r => r.f <= 60 * 5).length; if (heard.some(n => n !== roundsBy5s)) fails.push(`by 5 s the parked men count ${heard.join('/')} shots heard, ${roundsBy5s} were fired`);
      const announces = lines.filter(l => /shots fired! on me!/.test(l)); if (announces.length !== 1) fails.push(`'shots fired! on me!' said ${announces.length}×, want once (${announces.slice(0, 3).join(' | ')})`);
      const dist = new Map<number, number>(); for (const s of sizes) dist.set(s, (dist.get(s) ?? 0) + 1);
      verdict(fails.length === 0, '(1) 8 m, 90 s: groups of 2–4 (short only where a box ran dry), 6±1 frames inside a group, never two a frame, 0.9–1.6 s between groups (a reload where the box went), 30 a box; heard as gunfire by the whole floor, counted per round, announced once',
        (fails.length ? fails.join('; ') + ' · ' : '') + `${rounds.length} rounds in ${gs.length} groups (sizes ${[...dist.entries()].sort().map(([k, n]) => `${k}×${n}`).join(' ')}), intra ${Math.min(...intra)}–${Math.max(...intra)} f, gaps ${normal.length ? (Math.min(...normal) * DT).toFixed(2) : '-'}–${normal.length ? (Math.max(...normal) * DT).toFixed(2) : '-'} s (+${long.length} reload pauses ${long.map(x => (x * DT).toFixed(2)).join('/')} s), ${reloads.length} reloads; first burst ${firstBurstN} rounds → parked men aw ${aw.map(f2).join('/')}, heard ${heard.join('/')} by 5 s; ${rounds.filter(r => r.hitSam).length} rounds found Sam (god mode)`);
    }
    // (2) the cone
    {
      const fails: string[] = [];
      const byK: number[][] = [[], [], [], []]; const firstOfLater: number[] = [];
      gs.forEach((g, i) => { g.forEach((r, k) => { if (k < 4) byK[k].push(r.miss); }); if (i > 0) firstOfLater.push(g[0].miss); });
      const m = byK.map(mean);
      for (let k = 1; k < 4; k++) if (byK[k].length >= 6 && m[k] < m[k - 1] * 0.9) fails.push(`round ${k + 1}'s mean miss ${f3(m[k])} m < round ${k}'s ${f3(m[k - 1])} m`);
      if (byK[2].length >= 6 && !(m[2] > m[0] * 1.5)) fails.push(`round 3 (${f3(m[2])} m) is not clearly wider than round 1 (${f3(m[0])} m)`);
      const reset = mean(firstOfLater); if (byK[2].length >= 6 && !(reset < m[2] * 0.75)) fails.push(`the next burst's first round (${f3(reset)} m) is not tight again against round 3 (${f3(m[2])} m)`);
      const expect = [0, 1, 2, 3].map(k => (WEAPONS.aks74u.aiSpread.base + Math.min(B.spreadCap, B.spreadPerRound * k)));
      verdict(fails.length === 0, '(2) the cone opens through a burst and closes for the next: mean miss off the aim line non-decreasing in k (round 3 ≥ 1.5× round 1), a new burst\'s first round tight again',
        (fails.length ? fails.join('; ') + ' · ' : '') + `mean miss by round index: ${m.map((x, k) => `k${k} ${f3(x)} m (n ${byK[k].length}, cone ±${(expect[k] / 2 * 8).toFixed(2)} m at 8 m)`).join(' · ')} · next burst's first ${f3(reset)} m (n ${firstOfLater.length})`);
    }
    // (3) the reload beat
    {
      const fails: string[] = [];
      if (reloads.length < 2) fails.push(`${reloads.length} reloads in 90 s (want ≥ 2)`);
      for (const [i, r] of reloads.entries()) {
        if (Math.abs(r.t0 - RL.dur) > 1e-9) fails.push(`reload ${i}: reloadT starts at ${r.t0}, want ${RL.dur}`);
        const wantSpan = Math.round(RL.dur / DT); if (r.span < wantSpan - 1 || r.span > wantSpan + 2) fails.push(`reload ${i}: ${r.span} frames, want ≈ ${wantSpan}`);
        if (r.roundsInside) fails.push(`reload ${i}: ${r.roundsInside} round(s) inside the beat`);
        const wantOut = Math.round(RL.out! / DT); if (r.magItemAt < wantOut - 2 || r.magItemAt > wantOut + 2) fails.push(`reload ${i}: the box hit the floor at +${r.magItemAt} f, want ≈ +${wantOut} (${RL.out} s)`);
        if (r.magFill !== 2) fails.push(`reload ${i}: the dropped item's fill is ${r.magFill}, want 2 (the thirty-round box)`);
      }
      const relLines = lines.filter(l => /^Reyes:reloading!/.test(l)); if (relLines.length !== reloads.length + (rel ? 1 : 0)) fails.push(`'reloading!' ×${relLines.length} for ${reloads.length} reloads`);
      const magOuts = audio.filter(a => a.name === 'magOut').length; if (magOuts < reloads.length) fails.push(`magOut played ${magOuts}× for ${reloads.length} reloads`);
      const relStarts = new Set(reloads.map(r => r.start)); const lineFrames = relLines.map(l => +l.split(':f')[1]); if (lineFrames.some(f => !relStarts.has(f) && !(rel && f === rel.start))) fails.push(`'reloading!' frames ${lineFrames.join('/')} vs reload starts ${[...relStarts].join('/')}`);
      const ready = reyes.weapon.roundsReady;
      verdict(fails.length === 0, '(3) the reload beat: \'reloading!\' + magOut the frame the box empties, 2.6 s with no round in it, the empty thirty-round box on the floor at 0.7 s (a \'mag\' item, fill 2), a full box after',
        (fails.length ? fails.join('; ') + ' · ' : '') + reloads.map((r, i) => `#${i + 1} at f${r.start} after ${r.roundsBefore} rounds: ${r.span} f, box down at +${r.magItemAt} f (fill ${r.magFill})`).join(' · ') + ` · 'reloading!' ×${relLines.length}, magOut ×${magOuts} · ${ready} ready at the end`);
    }
    S.W.audioLog = null;
  }

  // ---- (4) discipline per round: a colleague grabbed between two rounds of a burst
  {
    const S = await stage(4702, 8); const { game, reyes, others } = S; const pl = game.player;
    const novak = others.find((o: any) => o.callsign === 'Novak') ?? others[0];
    novak.hold = true; novak.pinned = false; novak.state = 'patrol'; novak.awareness = 0; place(novak, [pl.char.pos[0] + 2.0, 0, 10.6], Math.PI / 2); novak.heardUpTo = 1e12; novak.dazzledUntil = 1e9;   // a calm, deaf, blind colleague two metres on past Sam by the north wall, his back to it all — well out of Reyes' line and its margins
    const fails: string[] = []; const notes: string[] = [];
    let grabbedAt = -1, leftAtGrab = -1, roundsBefore = 0, roundsAfter = 0, burstGoneAt = -1, tries = 0;
    for (let f = 0; f < 60 * 30 && grabbedAt < 0; f++) {
      const rs = S.step(); roundsBefore += rs.length;
      const b = reyes.weapon.burst;
      if (rs.length === 1 && b && b.left > 0 && b.idx >= 1) {   // a round went this frame and the burst has more to give: grab now (between this round and the next, 6 frames off)
        tries++;
        startGrab(game, novak);
        if (pl.holding?.g === novak) { grabbedAt = S.frame; leftAtGrab = b.left; }
        else if (tries > 5) break;
      }
    }
    if (grabbedAt < 0) fails.push(`could not stage the grab mid-burst (${tries} tries, ${roundsBefore} rounds seen, novak ${novak.state})`);
    else {
      for (let f = 0; f < 120; f++) {
        const rs = S.step(); roundsAfter += rs.length;
        if (burstGoneAt < 0 && !reyes.weapon.burst) burstGoneAt = f + 1;
        if (f === 60 && !pl.holding) fails.push('the hold did not last a second (staging)');
      }
      if (roundsAfter) fails.push(`${roundsAfter} round(s) AFTER the grab with ${leftAtGrab} left in the burst — the shield did not hold per round`);
      if (burstGoneAt < 0 || burstGoneAt > 2) fails.push(`the burst record was still on the gun ${burstGoneAt < 0 ? 'two seconds' : burstGoneAt + ' frames'} after the grab`);
      if (!(reyes.fireCd > 0)) fails.push(`fireCd ${f2(reyes.fireCd)} with the shield up (want the release beat in hand)`);
      notes.push(`grabbed Novak at f${grabbedAt} with ${leftAtGrab} round(s) of the burst to come (${roundsBefore} rounds before it): ${roundsAfter} after, burst record gone in ${burstGoneAt} f, Reyes fireCd ${f2(reyes.fireCd)}, holding ${pl.holding ? pl.holding.phase : 'none'}, standoff ${reyes.standoff ? 'yes' : 'no'}`);
    }
    verdict(fails.length === 0, '(4) muzzle discipline per round: a colleague grabbed between two rounds of a burst — not one more round of it, the burst dropped next frame, the beat kept in hand', (fails.length ? fails.join('; ') + ' · ' : '') + notes.join(' · '));
  }

  // ---- (5) the opening burst goes wide at 14 m (flag on), aimed with the flag off, and never at 8 m
  {
    const fails: string[] = []; const notes: string[] = [];
    const run = async (seed: number, range: number, flag: boolean) => {
      const S = await stage(seed, range, { suppressFirst: flag });
      const rounds: Round[] = []; let wideRec: any = null;
      for (let f = 0; f < 60 * 12 && groups(rounds).length < 4; f++) { const b0 = S.reyes.weapon.burst; rounds.push(...S.step()); const b = S.reyes.weapon.burst; if (!wideRec && (b ?? b0)?.off) wideRec = { off: v3.copy((b ?? b0).off) }; }
      return { gs: groups(rounds), wideRec, S };
    };
    { // 14 m, on
      const { gs, wideRec, S } = await run(4703, 14, true);
      const g0 = gs[0] ?? [], g1 = gs[1] ?? [];
      if (g0.length < 2) fails.push(`14 m on: first burst has ${g0.length} rounds`);
      const near = g0.filter(r => r.offAxis < 0.5); if (near.length) fails.push(`14 m on: ${near.length} round(s) of the opening burst passed within 0.5 m of Sam's axis (${g0.map(r => f2(r.offAxis)).join('/')})`);
      if (g0.some(r => r.hitSam)) fails.push('14 m on: a round of the opening burst found Sam');
      const intoGeom = g0.filter(r => { const st = S.game.col.raycast(r.from, v3.normalize(v3.sub(r.to, r.from)), v3.dist(r.from, r.to) + 0.02); return !!st && Math.abs(st.t - v3.dist(r.from, r.to)) < 0.05; });
      if (intoGeom.length !== g0.length) fails.push(`14 m on: ${g0.length - intoGeom.length} round(s) of the opening burst did not stop in a static / leaf`);
      if (!wideRec) fails.push('14 m on: no burst carried a wide offset');
      else { const m = Math.hypot(wideRec.off[0], wideRec.off[2]); if (m < 0.6 - 1e-6 || m > 1.0 + 1e-6) fails.push(`14 m on: the offset is ${f2(m)} m flat, want 0.6–1.0`); if (Math.abs(wideRec.off[1] - 0.3) > 1e-6) fails.push(`14 m on: the offset is ${f2(wideRec.off[1])} m up, want 0.3`); }
      const m1 = mean(g1.map(r => r.miss)); if (g1.length < 2) fails.push(`14 m on: second burst has ${g1.length} rounds`); else if (m1 > 0.9) fails.push(`14 m on: the second burst's mean miss is ${f2(m1)} m — not aimed`);
      const upWalk = g0.length >= 2 ? g0[g0.length - 1].to[1] - g0[0].to[1] : 0;
      notes.push(`14 m, flag on: opening burst ${g0.length} rounds, off Sam's axis ${g0.map(r => f2(r.offAxis)).join('/')} m, all ${intoGeom.length} into geometry (impacts z ${g0.map(r => f2(r.to[2])).join('/')}, climbing ${f2(upWalk)} m), offset ${wideRec ? `${f2(Math.hypot(wideRec.off[0], wideRec.off[2]))} m ${wideRec.off[2] > 0 ? 'south' : 'north'} (+${f2(wideRec.off[1])} up)` : '—'}; second burst ${g1.length} rounds, mean miss ${f2(m1)} m, off axis ${g1.map(r => f2(r.offAxis)).join('/')}`);
    }
    { // 14 m, off
      const { gs, wideRec } = await run(4703, 14, false);
      const g0 = gs[0] ?? []; const m0 = mean(g0.map(r => r.miss));
      if (wideRec) fails.push('14 m off: a burst still carried a wide offset');
      if (g0.length < 2 || m0 > 0.9) fails.push(`14 m off: first burst ${g0.length} rounds, mean miss ${f2(m0)} m — want it aimed`);
      notes.push(`14 m, flag off: first burst ${g0.length} rounds aimed, mean miss ${f2(m0)} m, off axis ${g0.map(r => f2(r.offAxis)).join('/')}, ${g0.filter(r => r.hitSam).length} found Sam`);
    }
    { // 8 m, on: under SUPPRESS_FIRST_MIN_M nothing goes wide
      const { gs, wideRec } = await run(4704, 8, true);
      const g0 = gs[0] ?? []; const m0 = mean(g0.map(r => r.miss));
      if (wideRec) fails.push('8 m on: a burst carried a wide offset inside 10 m');
      if (g0.length < 2 || m0 > 0.7) fails.push(`8 m on: first burst ${g0.length} rounds, mean miss ${f2(m0)} m — want it aimed`);
      notes.push(`8 m, flag on: first burst aimed (${g0.length} rounds, mean miss ${f2(m0)} m)`);
    }
    verdict(fails.length === 0, '(5) the opening burst (tune.suppressFirst): at 14 m every round of the first burst ≥ 0.5 m off Sam\'s axis and into geometry, none in him, the offset 0.6–1.0 m beside + 0.3 up, the second burst aimed; flag off → aimed from the first; at 8 m never wide', (fails.length ? fails.join('; ') + ' · ' : '') + notes.join(' · '));
  }

  // ---- (6) what a dying rifleman lets go of
  {
    const fails: string[] = []; const notes: string[] = [];
    const holsterKeys = [RIG.guardPistol.slide, RIG.guardPistol.grip].map((s: any) => [s.thick, s.tall, Math.max(0.001, (s.l1 - s.l0) / 2)].map(x => Math.round(x * 1000)).join('×'));
    const propsOf = (game: any, gd: any) => { const out: any[] = []; handProps(game, out); return out.filter((b: any) => b.owner === gd.char.id); };
    const check = (tag: string, game: any, W: any, gd: any, kill: () => void, quiet: boolean) => {
      const items0 = new Set(game.items.items); const t0 = game.time;
      kill();
      const fresh = () => game.items.items.filter((it: any) => !items0.has(it));
      let lastLit = -1, litFrames = 0, settledAt = -1, nan = false, maxSpeed = 0;
      for (let f = 0; f < 60 * 3; f++) {
        W.step(DT);
        const its = fresh(); for (const it of its) { if (![...it.pos, ...it.vel, it.yaw, it.tumble].every(Number.isFinite)) nan = true; maxSpeed = Math.max(maxSpeed, v3.len(it.vel)); }
        const rifle = its.find((it: any) => it.kind === 'rifle'); if (rifle && rifle.settled && settledAt < 0) settledAt = f + 1;
        if (gd.flashlight.enabled) { lastLit = game.time - t0; litFrames++; }   // (it sputters on the way out like a dropped torch: what counts is when it was LAST alight, and that it stays out)
      }
      const darkAt = lastLit, litAgain = gd.flashlight.enabled;
      const its = fresh(); const kinds = its.map((it: any) => it.kind);
      if (gd.state !== 'dead') fails.push(`${tag}: he is ${gd.state}, not dead`);
      if (kinds.length !== 1 || kinds[0] !== 'rifle') fails.push(`${tag}: items dropped [${kinds.join(', ')}], want exactly one 'rifle'`);
      if (gd.dropped?.kind !== 'rifle') fails.push(`${tag}: gd.dropped is ${gd.dropped?.kind ?? 'null'}`);
      const rifle = its.find((it: any) => it.kind === 'rifle');
      if (rifle) {
        const p = rifle.pos; if (nan) fails.push(`${tag}: a non-finite item state`);
        if (p[0] < 0.3 || p[0] > 39.7 || p[2] < 0.3 || p[2] > 27.7 || p[1] < 0 || p[1] > 2.5) fails.push(`${tag}: the rifle ended at (${p.map(f2).join(', ')})`);
        if (settledAt < 0) fails.push(`${tag}: the rifle never settled in 3 s (speed now ${f2(v3.len(rifle.vel))})`);
        if (maxSpeed > 8) fails.push(`${tag}: the rifle reached ${f2(maxSpeed)} m/s`);
        if (rifle.radius !== 0.06 || rifle.life > 240 || rifle.life < 230) fails.push(`${tag}: radius ${rifle.radius} life ${f2(rifle.life)}`);
      }
      if (darkAt > 1.0) fails.push(`${tag}: his light was still alight ${f2(darkAt)} s after he died (want dark within a second)`);
      if (litFrames < 3) fails.push(`${tag}: his light was alight only ${litFrames} frames after he died — it should ride the falling rifle a moment, then die`);
      if (litAgain) fails.push(`${tag}: his light is on again 3 s after dying`);
      const boxes = propsOf(game, gd); const keys = boxes.map((b: any) => b.h.map((x: number) => Math.round(x * 1000)).join('×'));
      const holster = keys.filter((k: string) => holsterKeys.includes(k)).length; const carbineParts = boxes.length - holster;
      if (holster !== 2 || carbineParts !== 0) fails.push(`${tag}: the body draws ${boxes.length} hand-prop boxes (${holster} holster parts, ${carbineParts} others) — want the thigh rig's 2 and no carbine`);
      notes.push(`${tag}: dropped [${kinds.join(', ')}]${rifle ? ` r ${rifle.radius} · settled in ${settledAt} f at (${rifle.pos.map(f2).join(', ')}) · peak ${f2(maxSpeed)} m/s · life ${Math.round(rifle.life)} s` : ''} · light last alight ${darkAt < 0 ? '—' : f2(darkAt) + ' s'} after (${litFrames} lit frames)${quiet ? ' (laid down)' : ''} · body wears ${holster} holster parts, ${carbineParts} other`);
    };
    { // alert, mid-fight: Sam's round in the chest
      const S = await stage(4705, 8); const { game, reyes } = S;
      for (let f = 0; f < 90; f++) S.step();   // let him get a burst or two off first
      check('alert rifleman shot mid-fight', game, S.W, reyes, () => fireWeapon(game, game.player.char, chest(reyes), true), false);
    }
    { // calm on his round (carbine low across the front, its light his torch): one round from the dark
      Math.random = seeded(4706);
      const W = await standUp(); const { game } = W; game.godMode = true; game.tune.carbineGuards = 'reyes';
      for (let i = 0; i < 5; i++) W.step(DT);
      const reyes = game.guards.find((g: any) => g.callsign === 'Reyes'); game.guards.filter((g: any) => g !== reyes).forEach((gd: any, i: number) => park(gd, i));
      place(reyes, [30.0, 0, 11.3], -Math.PI / 2); reyes.hold = true; reyes.pinned = false; reyes.state = 'patrol'; reyes.awareness = 0; reyes.heardUpTo = 1e12;
      game.teleportPlayer([26.0, 0, 11.3]); game.player.slot = 'pistol'; game.player.holstered = false; game.player.visibility = 0; W.step(DT); W.step(DT);
      const lightBefore = reyes.flashlight.enabled, calm = reyes.state === 'patrol' && !reyes.drawn;
      if (!lightBefore || !calm) fails.push(`calm staging: light ${lightBefore}, state ${reyes.state}${reyes.drawn ? ' drawn' : ''}`);
      check('calm rifleman shot on his round', game, W, reyes, () => fireWeapon(game, game.player.char, chest(reyes), true), false);
    }
    { // taken down quietly from behind: laid down where he stood
      Math.random = seeded(4707);
      const W = await standUp(); const { game } = W; game.godMode = true; game.tune.carbineGuards = 'reyes';
      for (let i = 0; i < 5; i++) W.step(DT);
      const reyes = game.guards.find((g: any) => g.callsign === 'Reyes'); game.guards.filter((g: any) => g !== reyes).forEach((gd: any, i: number) => park(gd, i));
      place(reyes, [30.0, 0, 11.3], Math.PI / 2); reyes.hold = true; reyes.state = 'patrol'; reyes.awareness = 0; reyes.heardUpTo = 1e12;
      game.teleportPlayer([29.2, 0, 11.3]); game.player.visibility = 0; W.step(DT); W.step(DT);
      check('rifleman taken down quietly', game, W, reyes, () => killGuard(game, reyes, [1, 0, 0], true), true);
    }
    verdict(fails.length === 0, '(6) a dying rifleman lets the RIFLE go — one \'rifle\' item (no pistol, no torch), finite, in the building, settled inside 3 s, his light dark within a second for good, the undrawn sidearm still on the body and no carbine part on it — shot mid-fight, shot calm on his round, or taken down quietly', (fails.length ? fails.join('; ') + ' · ' : '') + notes.join(' · '));
  }

  // ---- (7) 'none' deals nothing; the knob re-deals live both ways
  {
    const fails: string[] = []; const notes: string[] = [];
    const S = await stage(4708, 8, { deal: 'none' }); const { game, reyes } = S;
    if (game.guards.some((g: any) => g.weapon.def.id !== 'guard9mm' || g.weapon.def.burst || g.carbine)) fails.push(`under 'none' somebody carries ${game.guards.map((g: any) => g.weapon.def.id).join('/')}`);
    let burstSeen = false, rounds = 0; const kinds = new Set<string>();
    for (let f = 0; f < 60 * 20; f++) { const rs = S.step(); rounds += rs.length; for (const r of rs) kinds.add(r.weapon); if (game.guards.some((g: any) => g.weapon.burst)) burstSeen = true; }
    if (burstSeen) fails.push('a burst record appeared under \'none\'');
    if ([...kinds].some(k => k !== 'guard9mm')) fails.push(`rounds from ${[...kinds].join('/')} under 'none'`);
    if (rounds < 10) fails.push(`only ${rounds} sidearm rounds in 20 s (staging)`);
    notes.push(`'none': ${rounds} rounds in 20 s, all ${[...kinds].join('/') || '—'}, no burst state, muzzle ${f2(reyes.char.muzzleAhead)} m`);
    // flip live. The deal is re-made at the TOP of the first step after the knob moves (game.ts, before the guards' loop), so every round Reyes lets go in the two
    // settle frames is already the FRESH gun's — and an alert man with Sam lit in his sights may well fire in them (seed 4708 does today: the fight has moved
    // since the probe was frozen and his trigger frame now falls inside them — the old literal read the box two frames late and called 11 ready a short deal;
    // measured 08-12: 11 in the gun + 1 let go in the settle frames = the twelve). A fresh row is loaded ALL TOLD (weapons.ts:
    // topUp false = magCapacity − 1 in the box + 1 chambered — "a guard's twelve, all told, never thirteen"; the AKS-74U's thirty likewise), so the box PLUS
    // what he was seen to fire from it in those frames must come to exactly that: 30 for the carbine, 12 for the sidearm.
    const AKS_ALL_TOLD = WEAPONS.aks74u.magCapacity + (WEAPONS.aks74u.topUp ? 1 : 0), P9_ALL_TOLD = WEAPONS.guard9mm.magCapacity + (WEAPONS.guard9mm.topUp ? 1 : 0);   // 30 · 12
    if (AKS_ALL_TOLD !== 30 || P9_ALL_TOLD !== 12) fails.push(`the rows moved: AKS-74U all told ${AKS_ALL_TOLD} (want 30), 9 mm all told ${P9_ALL_TOLD} (want 12)`);
    game.tune.carbineGuards = 'reyes'; const settleC = [...S.step(), ...S.step()];
    const firedC = settleC.filter(r => r.weapon === 'aks74u').length; if (settleC.length !== firedC) fails.push(`flipped to 'reyes': a '${settleC.find(r => r.weapon !== 'aks74u')?.weapon}' round AFTER the deal`);
    if (reyes.weapon.def.id !== 'aks74u' || !reyes.carbine || Math.abs(reyes.char.muzzleAhead - 0.5) > 0.01 || reyes.weapon.roundsReady + firedC !== AKS_ALL_TOLD || reyes.reloadT !== -1) fails.push(`flipped to 'reyes': Reyes carries ${reyes.weapon.def.id} (${reyes.weapon.roundsReady} ready + ${firedC} fired in the settle frames ≠ ${AKS_ALL_TOLD}, reloadT ${reyes.reloadT}), muzzle ${f2(reyes.char.muzzleAhead)}`);
    if (S.others.some((o: any) => o.weapon.def.id !== 'guard9mm')) fails.push('flipped to \'reyes\': another man was re-dealt too');
    let carbineRounds = 0; for (let f = 0; f < 60 * 6; f++) for (const r of S.step()) { if (r.weapon === 'aks74u') carbineRounds++; else fails.push(`after the flip Reyes fired a '${r.weapon}' round`); }
    if (carbineRounds < 4) fails.push(`only ${carbineRounds} carbine rounds in the 6 s after the flip`);
    game.tune.carbineGuards = 'none'; const settleP = [...S.step(), ...S.step()];
    const firedP = settleP.filter(r => r.weapon === 'guard9mm').length; if (settleP.length !== firedP) fails.push(`back on 'none': a '${settleP.find(r => r.weapon !== 'guard9mm')?.weapon}' round AFTER the deal`);
    if (reyes.weapon.def.id !== 'guard9mm' || reyes.carbine || reyes.weapon.burst || Math.abs(reyes.char.muzzleAhead - 0.26) > 1e-9 || reyes.weapon.roundsReady + firedP !== P9_ALL_TOLD || reyes.weapon.chamber !== 1) fails.push(`back on 'none': Reyes carries ${reyes.weapon.def.id} (${reyes.weapon.roundsReady} ready + ${firedP} fired in the settle frames ≠ ${P9_ALL_TOLD}, chamber ${reyes.weapon.chamber}), muzzle ${f2(reyes.char.muzzleAhead)}, burst ${!!reyes.weapon.burst}`);
    notes.push(`→ 'reyes': aks74u, ${AKS_ALL_TOLD} all told (${firedC} of them let go in the two settle frames), muzzle 0.50, ${carbineRounds} carbine rounds in 6 s → 'none': ${reyes.weapon.def.id}, ${reyes.weapon.roundsReady} ready + ${firedP} fired in the settle frames = ${reyes.weapon.roundsReady + firedP} all told, muzzle ${f2(reyes.char.muzzleAhead)}`);
    verdict(fails.length === 0, '(7) \'none\' deals nobody anything (all 9 mm, no burst state through 20 s of the same fight); the knob re-deals live: Reyes → the AKS-74U with a full box and the long muzzle, and back to a fresh sidearm', (fails.length ? fails.join('; ') + ' · ' : '') + notes.join(' · '));
  }
  if (verbose) console.log(`  aks74u: burst ${JSON.stringify(B)}, reload ${JSON.stringify(RL)}, aiSpread ${JSON.stringify(WEAPONS.aks74u.aiSpread)}`);
  console.log(`=== carbine-fire: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
