// The 'wounds' family: A HIT CAN WOUND A MAN INSTEAD OF KILLING HIM (src/game/wounds.ts, WOUND.on — off as shipped; ?wounds / --wounds / TPS_WOUNDS=1).
// Where the round landed decides — never a counter: the head / the middle of the trunk = dead, the trunk's edge / a leg = down wounded, out of the fight, posed.
//
//   bun run tools/qa/probes.ts wounds | wounds-zone | wounds-off | wounds-state | wounds-both | wounds-again | wounds-save | wounds-play
//
//   wounds-zone   · the rule as geometry on a bare figure: head, middle, flank either side, each leg; the lethal band is a band (a sweep across him goes
//                   side → centre → side with no gaps), standing and crouched
//   wounds-off    · the switch off: a flank round through fireWeapon kills and ragdolls, as ever, and nobody carries a wound
//   wounds-state  · the switch on, a defender hit in the flank by an operative's round: down ('dead' to the floor), breathing, no ragdoll, gun out of his hand,
//                   the pose reached and held, every bone finite; nobody's AI shoots him again; a round through the middle of a fresh man still kills
//   wounds-both   · the same rule the other way (a defender's round into an operative's flank) and the men it never applies to: a showcase, the man in an arm
//   wounds-again  · no counter: three more flank rounds from the player change nothing; one through the head finishes him (a ragdoll, shot, the card put right)
//   wounds-save   · the quiet game: Sam wounds a staff man → the checkpoint round-trips him (down, posed, settled, never a ragdoll) and a colleague FINDS him
//   wounds-play   · what the player meets: the reticle on a wounded man sends the round AT HIM (not over a kneeling man's head) and finishes him; a man wounded by
//                   somebody else and finished by Sam is a kill on the card with its row; with the turn weight on he stops turning the moment he goes down
//
// The family's own red path: WOUNDS_BREAK=1 bun run tools/qa/probes.ts wounds-zone must FAIL (the lethal band widened over the whole trunk).
import { ROOT, standUp, loadCharacter } from './headless.ts';
const CH: any = await import(`${ROOT}/src/game/character.ts`);
const WM: any = await import(`${ROOT}/src/game/wounds.ts`);
const CB: any = await import(`${ROOT}/src/game/combat.ts`);
const GM: any = await import(`${ROOT}/src/game/game.ts`);
const BREAK = !!process.env.WOUNDS_BREAK;
type V3 = [number, number, number];
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const DT = 1 / 60, cm = (m: number) => (m * 100).toFixed(1) + ' cm';
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]), norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1)), mid = (a: V3, b: V3, t = 0.5): V3 => add(a, mul(sub(b, a), t));
const keep = { on: WM.WOUND.on, centre: WM.WOUND.centre };
const restore = () => { WM.WOUND.on = keep.on; WM.WOUND.centre = keep.centre; WM.resetWoundStats(); };
const finite = (c: any) => Object.values(c.bones).every((p: any) => p.every((x: number) => Number.isFinite(x)));

/** the aim points on a man as seen from `from`: his head, the middle of his trunk, a flank (the trunk's line stepped `side` × 19 cm across the line of fire), a shin */
function points(c: any, from: V3) {
  const b = c.bones, trunk = mid(b.hips, b.chest, 0.6), d = norm([trunk[0] - from[0], 0, trunk[2] - from[2]]), across: V3 = [d[2], 0, -d[0]];
  return { head: add(b.head, [0, 0.07, 0]) as V3, centre: trunk, flankL: add(trunk, mul(across, 0.19)), flankR: add(trunk, mul(across, -0.19)), legL: mid(b.shinL, b.footL, 0.3), legR: mid(b.thighR, b.shinR, 0.6), across };
}
/** what the rule says of a round from `from` at `at` on this figure (through his own hit column: -1 = it missed him) */
function zoneOf(c: any, from: V3, at: V3): string {
  const rd = norm(sub(at, from)), t = CB.bodyHit(c, from, rd, 60, false);
  return t < 0 ? 'miss' : WM.hitZone(c, from, rd, t).zone;
}

export async function woundsZone(): Promise<boolean> {
  const F = family('wounds-zone: where the round landed, as geometry — head / middle = dead, flank / leg = wounded; a band, not a patchwork');
  try {
    if (BREAK) WM.WOUND.centre = 0.5;
    const gltf = await loadCharacter();
    const stand = (crouch: number) => { const c: any = new CH.Character(gltf, { id: 1, tint: [1, 1, 1], tint2: [1, 1, 1], pos: [0, 0, 0], yaw: 0 }); c.anim.phase = 0; c.anim.upper = 'aim'; c.anim.crouchTarget = crouch; for (let i = 0; i < 120; i++) c.update(DT); return c; };
    for (const [name, crouch] of [['standing', 0], ['crouched', 1]] as const) {
      const c = stand(crouch), rows: string[] = []; let ok = true;
      for (const ang of [0, 45, 90, 180, 270]) {   // from in front, the quarter, his left, behind, his right
        const a = ang * Math.PI / 180, from: V3 = [Math.sin(a) * 4, 1.35, Math.cos(a) * 4], P = points(c, from);
        const z = { head: zoneOf(c, from, P.head), centre: zoneOf(c, from, P.centre), flankL: zoneOf(c, from, P.flankL), flankR: zoneOf(c, from, P.flankR), legL: zoneOf(c, from, P.legL), legR: zoneOf(c, from, P.legR) };
        const legs = crouch && ang > 45 ? true : z.legL === 'leg' && z.legR === 'leg';   // (crouched, from the side or behind, a line to the shin crosses the folded thigh or the pelvis first: whatever the rule says of THAT line is right, and is not asked here)
        const good = z.head === 'head' && z.centre === 'centre' && z.flankL === 'side' && z.flankR === 'side' && legs; ok &&= good;
        rows.push(`${ang}°: head→${z.head} middle→${z.centre} flanks→${z.flankL}/${z.flankR} legs→${z.legL}/${z.legR}${good ? '' : '  ✗'}`);
      }
      F.verdict(ok, `${name}: the six aim points read head / centre / side / side / leg / leg from five bearings`, rows.join('\n    '));
      // the sweep: across the trunk at chest height from in front, one line every 1 cm — zones must run (miss) side… centre… side (miss), each a single stretch
      const from: V3 = [0, 1.35, 4], P = points(c, from); let seq = '', last = '';
      const w: Record<string, number> = { side: 0, centre: 0, leg: 0, head: 0 };
      for (let x = -0.4; x <= 0.4001; x += 0.01) { const z = zoneOf(c, from, add(P.centre, mul(P.across, x))); if (z !== 'miss') w[z]++; if (z !== last) { seq += (seq ? ' → ' : '') + z; last = z; } }
      F.verdict(/^miss → (side|leg)( → (side|leg))* → centre → (side|leg)( → (side|leg))* → miss$/.test(seq) && Math.abs(w.centre * 0.01 - 2 * WM.WOUND.centre) < 0.05,
        `${name}: a sweep across the trunk is edge, ONE middle, edge (a folded knee beside it reads leg) — and the middle is as wide as the rule says`, `${seq} · middle ${cm(w.centre * 0.01)} wide (the rule: ${cm(2 * WM.WOUND.centre)}), edges ${cm(w.side * 0.01)} in all`);
    }
  } catch (e) { F.verdict(false, 'the probe ran', String((e as Error)?.stack ?? e)); } finally { restore(); }
  return F.done();
}

type Want = 'lethal' | 'wounding' | 'head' | 'centre' | 'side' | 'leg';
const wants = (z: string, w: Want) => w === 'lethal' ? z === 'head' || z === 'centre' : w === 'wounding' ? z === 'side' || z === 'leg' : z === w;
/** a point on `v` that a round from `muzzle` reaches with nothing solid nearer and that the rule reads as `want` — searched over his own bones (the trunk's line,
 *  the head, both legs, stepped across the line of fire), so it holds for a man standing, kneeling or on his back; null if there is none from here */
function aimFor(g: any, v: any, muzzle: V3, want: Want): V3 | null {
  const b = v.char.bones, d = norm([b.hips[0] - muzzle[0], 0, b.hips[2] - muzzle[2]]), across: V3 = [d[2], 0, -d[0]];
  const base: V3[] = [mid(b.hips, b.chest, 0.6), mid(b.hips, b.chest, 0.25), b.chest, add(b.head, [0, 0.07, 0]), b.hips, mid(b.thighL, b.shinL, 0.6), mid(b.shinL, b.footL, 0.3), mid(b.thighR, b.shinR, 0.6), mid(b.shinR, b.footR, 0.3)];
  for (const p0 of base) for (const x of [0, 0.19, -0.19, 0.15, -0.15, 0.23, -0.23, 0.08, -0.08]) {
    const at = add(p0, mul(across, x)), rd = norm(sub(at, muzzle)), t = CB.bodyHit(v.char, muzzle, rd, 60, false); if (t < 0) continue;
    const st = g.col.raycast(muzzle, rd, 60); if (st && st.t < t) continue;
    if (wants(WM.hitZone(v.char, muzzle, rd, t).zone, want)) return at;
  }
  return null;
}
/** `sh` (a Guard, or 'player') stood ~2.6 m off the victim with a clear line and nobody else near it, and one round fired at a point the rule reads as `want`;
 *  false if no such spot / point was found */
function shootAt(g: any, sh: any, v: any, want: Want): boolean {
  const c = sh === 'player' ? g.player.char : sh.char, t = v.char.bones.hips as V3;
  const others: V3[] = [...g.guards.filter((x: any) => x !== v && x !== sh && x.char.alive).map((x: any) => x.char.pos), ...(sh === 'player' ? [] : [g.player.char.pos])];
  for (let k = 0; k < 24; k++) {
    const a = k * Math.PI / 12, r = k < 12 ? 2.6 : 1.8, p: V3 = [v.char.pos[0] + Math.sin(a) * r, 0, v.char.pos[2] + Math.cos(a) * r], e: V3 = [p[0], 1.3, p[2]];
    if (g.col.nav.isBlocked(p[0], p[2]) || g.col.solidBlocked(e, [t[0], Math.max(0.3, t[1]), t[2]]) || g.col.segmentBlockedDynamic(e, [t[0], Math.max(0.3, t[1]), t[2]])) continue;
    const L = Math.hypot(t[0] - p[0], t[2] - p[2]), ux = (t[0] - p[0]) / L, uz = (t[2] - p[2]) / L;
    if (others.some(o => { const s = (o[0] - p[0]) * ux + (o[2] - p[2]) * uz; return s > -0.6 && s < L + 0.6 && Math.abs((o[0] - p[0]) * uz - (o[2] - p[2]) * ux) < 0.75; })) continue;   // (somebody else in or by the lane: the round would be his)
    const was: V3 = [...c.pos] as V3, yaw0 = c.bodyYaw;
    const yaw = Math.atan2(t[0] - p[0], t[2] - p[2]);
    if (sh === 'player') g.teleportPlayer(p); else c.pos = [p[0], c.pos[1], p[2]];
    c.bodyYaw = yaw; c.aimYaw = yaw; c.vel = [0, 0, 0]; c.update(0);
    const at = CB.armThrough(g, c) ? null : aimFor(g, v, c.muzzle, want);
    if (!at) { if (sh !== 'player') { c.pos = was; c.bodyYaw = yaw0; c.update(0); } continue; }
    CB.fireWeapon(g, c, at, sh === 'player', { steady: true, spread: 0 });
    return true;
  }
  return false;
}
/** a staged room clear (the scenario's own start), with helpers to put a round from one man into another exactly where the rule is asked about */
async function staged(scn = 'night-breach', seed = 1) {
  const { stage } = await import('./bang-tally.ts');
  const S: any = await quiet(() => stage(scn, seed)); const g = S.g;
  const ops = () => g.guards.filter((x: any) => x.team === 'operative' && x.state !== 'dead'), foes = () => g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead');
  const shoot = (sh: any, v: any, want: Want) => shootAt(g, sh, v, want);
  return { ...S, g, ops, foes, shoot };
}
const describe = (v: any) => `${v.callsign}: state ${v.state} · downKind ${v.downKind} · wound ${v.wound ? `${v.wound.zone}/${v.wound.pose}` : 'none'} · ragdoll ${!!v.char.ragdoll} · gun ${v.dropped ? 'on the floor' : 'not dropped'}`;

export async function woundsOff(): Promise<boolean> {
  const F = family('wounds-off: the switch off — a round through the flank kills, as every round that finds a man always has');
  try {
    const S = await staged(); WM.WOUND.on = false; WM.resetWoundStats(); const v = S.foes()[0], sh = S.ops()[0];
    const fired = await quiet(() => S.shoot(sh, v, 'side'));
    F.verdict(fired && v.state === 'dead' && v.downKind === 'shot' && !!v.char.ragdoll && !v.wound && !v.char.anim.wound, 'a flank round kills and hands him to the ragdoll', describe(v));
    S.step(120);
    F.verdict(S.g.guards.every((x: any) => !x.wound && x.downKind !== 'wounded') && WM.WOUND_STATS.wounded === 0 && WM.WOUND_STATS.dead === 0, 'two seconds of the fight on: nobody carries a wound and the rule was never asked', `stats ${JSON.stringify(WM.WOUND_STATS)}`);
  } catch (e) { F.verdict(false, 'the probe ran', String((e as Error)?.stack ?? e)); } finally { restore(); }
  return F.done();
}

export async function woundsState(): Promise<boolean> {
  const F = family('wounds-state: the switch on — a defender hit in the flank is down, breathing, out of the fight, posed; the middle still kills');
  try {
    const S = await staged(); WM.WOUND.on = true; WM.resetWoundStats(); const g = S.g, v = S.foes()[0], sh = S.ops()[0], head0 = v.char.bones.head[1];
    const fired = await quiet(() => S.shoot(sh, v, 'side'));
    F.verdict(fired && v.state === 'dead' && v.downKind === 'wounded' && !!v.wound && !v.char.ragdoll && v.char.alive && GM.isBreathing(v) && !!v.dropped && !v.script && v.killerId === sh.char.id,
      'he is down to the floor\'s every question, breathing, not a ragdoll, his gun out of his hand, and it is on the shooter\'s record', describe(v));
    const said: string[] = g.log?.map?.((l: any) => l.text ?? l) ?? [];
    let worst = 0, againAI = 0; const a0 = WM.WOUND_STATS.again; let bad = '';
    for (let i = 0; i < 240; i++) { S.step(1); if (!finite(v.char)) bad ||= `a bone not finite at frame ${i}`; if (v.state !== 'dead' || !v.wound || v.char.ragdoll) bad ||= `state lost at frame ${i}: ${describe(v)}`; worst = Math.max(worst, Math.hypot(v.char.vel[0], v.char.vel[2])); }
    againAI = WM.WOUND_STATS.again - a0;
    const drop = head0 - v.char.bones.head[1], A = v.char.anim, b = v.char.bones;
    const handTo = len(sub(b.handL, v.wound?.zone === 'leg' ? mid(b.thighL, b.shinL, 0.45) : mid(b.hips, b.chest, 0.4)));
    F.verdict(!bad && A.woundShown > 0.99 && A.woundDown > 0.99 && drop > 0.45 && worst === 0, 'four seconds on: the pose is reached and held, he has not moved from where he went down, every bone finite',
      bad || `layer ${A.woundShown.toFixed(2)} · down ${A.woundDown.toFixed(2)} · head ${cm(drop)} lower than he stood (want > 45) · speed ${worst}`);
    F.verdict(handTo < 0.3, 'his support hand is at the wound', `left hand ${cm(handTo)} from his ${v.wound?.zone === 'leg' ? 'thigh' : 'ribs'} (want < 30)`);
    F.verdict(againAI === 0 && S.ops().every((o: any) => g.fight.opOf?.(o)?.tgt !== v), 'nobody\'s AI puts another round into him, and no operative holds him as a target', `rounds into a wounded man in those four seconds: ${againAI} · targets: ${S.ops().map((o: any) => `${o.callsign}→${g.fight.opOf?.(o)?.tgt?.callsign ?? '—'}`).join(' ')}`);
    void said;
    const st = JSON.stringify(WM.WOUND_STATS), side1 = WM.WOUND_STATS.wounded >= 1 && WM.WOUND_STATS.byZone.side >= 1;
    { const S2 = await staged(); WM.WOUND.on = true; const v2 = S2.foes()[0], f2 = await quiet(() => S2.shoot(S2.ops()[0], v2, 'centre'));
      F.verdict(f2 && v2.state === 'dead' && v2.downKind === 'shot' && !!v2.char.ragdoll && !v2.wound, 'the same staging, the round through the middle of him instead: dead outright, the ragdoll\'s', `${describe(v2)}${f2 ? '' : ' · (no clear spot found)'}`); }
    F.verdict(side1, 'the rule\'s own count agrees', st);
  } catch (e) { F.verdict(false, 'the probe ran', String((e as Error)?.stack ?? e)); } finally { restore(); }
  return F.done();
}

export async function woundsBoth(): Promise<boolean> {
  const F = family('wounds-both: the same rule for the team — and the men it never applies to');
  try {
    { const S = await staged(); WM.WOUND.on = true; WM.resetWoundStats(); const g = S.g, sh = S.foes()[0], v = S.ops()[0], n0 = S.ops().length;
      const fired = await quiet(() => S.shoot(sh, v, 'side'));
      F.verdict(fired && v.state === 'dead' && v.downKind === 'wounded' && !!v.wound && !v.char.ragdoll && S.ops().length === n0 - 1, 'a defender\'s round through an operative\'s flank: he is down wounded and the team is a man short', describe(v));
      let bad = ''; for (let i = 0; i < 300; i++) { S.step(1); if (!v.wound || v.state !== 'dead' || v.char.ragdoll) bad ||= `lost at frame ${i}: ${describe(v)}`; }
      F.verdict(!bad && v.char.anim.woundDown > 0.99, 'five seconds on he is still down, posed, and no order has picked him up', bad || `${describe(v)} · script ${!!v.script}`);
      void g; }
    { const S = await staged(); WM.WOUND.on = true; const g = S.g, sh = S.ops()[0], v = S.foes()[0]; g.touring = true;
      const fired = await quiet(() => S.shoot(sh, v, 'side')); g.touring = false;
      F.verdict(fired && v.downKind === 'shot' && !!v.char.ragdoll && !v.wound, 'under a showcase a flank round kills (its rounds are choreography)', describe(v)); }
    { const S = await staged(); WM.WOUND.on = true; const sh = S.ops()[0], v = S.foes()[0]; v.held = { by: 'player' };
      const fired = await quiet(() => S.shoot(sh, v, 'side'));
      F.verdict(fired && (v.state !== 'dead' || (v.downKind === 'shot' && !v.wound)), 'a man in somebody\'s arm is never wounded by this rule', describe(v)); }
  } catch (e) { F.verdict(false, 'the probe ran', String((e as Error)?.stack ?? e)); } finally { restore(); }
  return F.done();
}

export async function woundsAgain(): Promise<boolean> {
  const F = family('wounds-again: no counter — more rounds in the flank change nothing; one through the head finishes him');
  try {
    const S = await staged(); WM.WOUND.on = true; WM.resetWoundStats(); const g = S.g, v = S.foes()[0];
    for (const o of g.guards) if (o !== v && o.team === 'hostile') o.god = true;   // (the others out of this: only he is asked about)
    g.godMode = true;
    const k0 = { ...g.mission.stats };
    const first = await quiet(() => S.shoot('player', v, 'wounding')); S.step(150);
    F.verdict(first && !!v.wound && v.downBy === 'player', 'the player\'s round through his flank: down wounded, by the player', `${describe(v)} · card: kills ${g.mission.stats.kills - k0.kills}, knockouts ${g.mission.stats.knockouts - k0.knockouts}`);
    let hits = 0; for (let i = 0; i < 3; i++) { const a = WM.WOUND_STATS.again; await quiet(() => S.shoot('player', v, 'wounding')); hits += WM.WOUND_STATS.again - a; S.step(20); }
    F.verdict(hits >= 2 && !!v.wound && v.state === 'dead' && !v.char.ragdoll && WM.WOUND_STATS.finished === 0, 'three more rounds at his flank: the ones that find him change nothing — there is nothing to count down', `${hits} of 3 found him · ${describe(v)} · finished ${WM.WOUND_STATS.finished}`);
    let done = false, tries = 0; for (let i = 0; i < 3 && !done; i++) { tries++; await quiet(() => S.shoot('player', v, 'lethal')); if (!v.wound) done = true; else S.step(10); }
    F.verdict(done && v.downKind === 'shot' && !!v.char.ragdoll && !v.char.anim.wound && !GM.isBreathing(v), 'a round through his head or the middle of him: dead — the body is the ragdoll\'s, shot, no longer breathing', `${describe(v)} · after ${tries} round(s) · finished ${WM.WOUND_STATS.finished}`);
    S.step(120);
    F.verdict(finite(v.char), 'two seconds on the body is finite and lying there', describe(v));
  } catch (e) { F.verdict(false, 'the probe ran', String((e as Error)?.stack ?? e)); } finally { restore(); }
  return F.done();
}

export async function woundsSave(): Promise<boolean> {
  const F = family('wounds-save: the quiet game — a wounded staff man round-trips a checkpoint and is found by a colleague');
  try {
    const W: any = await quiet(() => standUp({ uploadEvery: 4 })); WM.WOUND.on = true; WM.resetWoundStats(); const g = W.game; g.godMode = true; g.playerInvisible = true; g.aiEnabled = true;
    const step = (n = 1) => { for (let i = 0; i < n; i++) W.step(DT); };
    step(30);
    const v = g.guards[0], k0 = { ...g.mission.stats };
    const fired = await quiet(() => shootAt(g, 'player', v, 'side'));
    if (!fired) { F.verdict(false, 'a clear spot to shoot from', `none round ${v.callsign}`); return F.done(); }
    F.verdict(!!v.wound && v.state === 'dead' && v.downKind === 'wounded' && g.mission.stats.knockouts - k0.knockouts === 1 && g.mission.stats.kills === k0.kills, 'Sam\'s round through a staff man\'s flank: down wounded — a knockout on the card, not a kill', `${describe(v)} · kills +${g.mission.stats.kills - k0.kills} knockouts +${g.mission.stats.knockouts - k0.knockouts}`);
    step(200); const hips0 = [...v.char.bones.hips] as V3, hand0 = [...v.char.bones.handL] as V3;
    for (const o of g.guards) if (o !== v) { o.state = 'patrol'; o.awareness = 0; }
    let snap: any = null, why = ''; try { snap = await quiet(() => W.snapshot('wounded', true)); } catch (e) { why = String((e as Error).message ?? e); }
    if (!snap) { F.verdict(false, 'the checkpoint files a wounded man', `refused: ${why}`); return F.done(); }
    const rec = snap.guards?.find((x: any) => x.callsign === v.callsign);
    F.verdict(!!rec?.wound && rec.downKind === 'wounded' && rec.rag === null, 'the file carries his wound and no ragdoll for him', `wound ${JSON.stringify(rec?.wound)} · downKind ${rec?.downKind} · rag ${rec?.rag === null ? 'null' : 'present'}`);
    await quiet(() => W.restore(JSON.parse(JSON.stringify(snap))));
    const r = g.guards.find((x: any) => x.callsign === v.callsign);
    const dh = len(sub(r.char.bones.hips, hips0)), dl = len(sub(r.char.bones.handL, hand0));
    F.verdict(r !== v && !!r.wound && r.state === 'dead' && r.downKind === 'wounded' && !r.char.ragdoll && r.char.anim.woundDown > 0.99 && r.char.anim.woundShown > 0.99 && dh < 0.06 && dl < 0.12,
      'loaded: a fresh man, down wounded, already settled in the pose he was filed in (no fall replayed, never a ragdoll)', `${describe(r)} · hips ${cm(dh)} and hand ${cm(dl)} from where they were filed`);
    step(60); F.verdict(!!r.wound && !r.char.ragdoll && finite(r.char), 'a second on he is still there, finite', describe(r));
    // found: a colleague walked up to him with eyes on him
    g.tune.bodyLight = false;
    const o = g.guards.find((x: any) => x !== r && x.state !== 'dead'), body = r.char.bones.hips as V3; let q: V3 | null = null;
    for (let k = 0; k < 16 && !q; k++) { const a = k * Math.PI / 8, s: V3 = [body[0] + Math.sin(a) * 3.2, 0, body[2] + Math.cos(a) * 3.2]; if (!g.col.nav.isBlocked(s[0], s[2]) && !g.col.solidBlocked([s[0], 1.5, s[2]], [body[0], 0.3, body[2]]) && !g.col.segmentBlockedDynamic([s[0], 1.5, s[2]], [body[0], 0.3, body[2]])) q = s; }
    if (!o || !q) { F.verdict(false, 'a colleague and a spot with eyes on him', `colleague ${!!o} spot ${!!q}`); return F.done(); }
    let found = -1; for (let i = 0; i < 600 && found < 0; i++) { if (o.state === 'patrol' || i < 5) { o.char.pos = [q[0], o.char.pos[1], q[2]]; const y = Math.atan2(body[0] - q[0], body[2] - q[2]); o.char.bodyYaw = y; o.char.aimYaw = y; o.path = []; } step(1); if (r.found) found = i; }
    F.verdict(found >= 0, 'a colleague with eyes on him finds him and calls it in — a wounded man is a body the floor answers to', found >= 0 ? `${o.callsign} found ${r.callsign} after ${(found * DT).toFixed(1)} s · ${o.callsign} now ${o.state} · bodies on the card ${g.mission.stats.bodies}` : `not found in 10 s · ${o.callsign} ${o.state}`);
  } catch (e) { F.verdict(false, 'the probe ran', String((e as Error)?.stack ?? e)); } finally { restore(); }
  return F.done();
}

export async function woundsPlay(): Promise<boolean> {
  const F = family('wounds-play: the reticle on a wounded man, the card when Sam finishes another\'s wounded man, and no turning once down');
  const turn0 = CH.TURN.on;
  try {
    // ---- the reticle: Sam wounds a staff man, walks round in front of him, puts the cursor on him and clicks — the round goes at him, where he is
    { const W: any = await quiet(() => standUp({ uploadEvery: 4 })); WM.WOUND.on = true; WM.resetWoundStats(); const g = W.game; g.godMode = true; g.playerInvisible = true; g.aiEnabled = false; g.infiniteAmmo = true;
      const step = (n = 1) => { for (let i = 0; i < n; i++) W.step(DT); };
      step(30); const v = g.guards[0], pl = g.player, k0 = { ...g.mission.stats };
      const fired = await quiet(() => shootAt(g, 'player', v, 'side')); step(200);
      if (!fired || !v.wound) { F.verdict(false, 'a man wounded to aim at', describe(v)); return F.done(); }
      const chest = v.char.bones.chest as V3; let spot: V3 | null = null;
      for (let k = 0; k < 16 && !spot; k++) { const a = v.char.bodyYaw + k * Math.PI / 8, p: V3 = [chest[0] + Math.sin(a) * 2.4, 0, chest[2] + Math.cos(a) * 2.4], e: V3 = [p[0], 1.3, p[2]]; if (!g.col.nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked(e, chest) && !g.col.segmentBlockedDynamic(e, chest)) spot = p; }
      if (!spot) { F.verdict(false, 'a clear spot in front of him', 'none'); return F.done(); }
      g.teleportPlayer(spot); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; W.cam.target = [chest[0], 0, chest[2]]; W.cam.rebuild?.();
      let onHim = false, snapOff = 9; for (let i = 0; i < 90; i++) { W.cursorAt(v.char.bones.chest); step(1); if (g.aimGuard === v && g.aimSnap) { onHim = true; snapOff = len(sub(g.aimSnap, v.char.bones.chest)); } }
      F.verdict(onHim && snapOff < 0.02, 'the cursor on a wounded man: the reticle has him, at his chest where it is now (not where a standing man\'s would be)', `aimGuard ${g.aimGuard?.callsign ?? 'nobody'} · snap ${cm(snapOff)} from his chest · his chest ${cm(chest[1])} off the floor`);
      const a0 = WM.WOUND_STATS.again; let clicks = 0;
      for (let i = 0; i < 4 && v.wound; i++) { clicks++; W.cursorAt(v.char.bones.chest); W.input.clicked |= 1; W.input.buttons |= 1; step(1); W.input.buttons &= ~1; for (let j = 0; j < 40; j++) { if (v.wound) W.cursorAt(v.char.bones.chest); step(1); } }
      const st = g.mission.stats, rows = (g.chronicle.events as any[]).filter(e => e.data?.who === v.callsign).map(e => `${e.kind}${e.data.method ? ':' + e.data.method : ''}`);
      F.verdict(WM.WOUND_STATS.again - a0 >= 1 && !v.wound && v.downKind === 'shot' && !!v.char.ragdoll, 'a click with the reticle on him: the round finds him, and through the middle of him it finishes him', `${clicks} click(s) · rounds into him ${WM.WOUND_STATS.again - a0} · ${describe(v)}`);
      F.verdict(st.kills - k0.kills === 1 && st.knockouts - k0.knockouts === 0 && rows.join(' ') === 'ko:wounded kill', 'the card: the knockout became a kill, and the timeline reads wounded, then killed', `kills +${st.kills - k0.kills} knockouts +${st.knockouts - k0.knockouts} · rows: ${rows.join(' → ') || 'none'}`); }
    // ---- another man's round wounded him, Sam's finishes him: a kill on Sam's card (no knockout was ever counted), by the player
    { const S = await staged(); WM.WOUND.on = true; WM.resetWoundStats(); const g = S.g, v = S.foes()[0], sh = S.ops()[0];
      for (const o of g.guards) if (o !== v && o.team === 'hostile') o.god = true; g.godMode = true;
      const k0 = { ...g.mission.stats }; const first = await quiet(() => S.shoot(sh, v, 'wounding')); S.step(150);
      const mid0 = { ...g.mission.stats };
      let done = false; for (let i = 0; i < 3 && !done; i++) { await quiet(() => S.shoot('player', v, 'lethal')); if (!v.wound) done = true; else S.step(10); }
      const st = g.mission.stats;
      F.verdict(first && done && mid0.kills === k0.kills && mid0.knockouts === k0.knockouts && st.kills - k0.kills === 1 && st.knockouts === k0.knockouts && v.downBy === 'player' && v.downKind === 'shot',
        'wounded by a teammate\'s round (nothing on Sam\'s card), finished by Sam\'s: one kill, no knockout, his', `${describe(v)} · after the wound: kills +${mid0.kills - k0.kills} knockouts +${mid0.knockouts - k0.knockouts} · after Sam: kills +${st.kills - k0.kills} knockouts +${st.knockouts - k0.knockouts} · downBy ${v.downBy}`); }
    // ---- the turn weight on (the page's default): a man hit in mid-turn stops turning as he goes down — the body that sinks is the one that was drawn
    { CH.TURN.on = 1; const S = await staged(); CH.TURN.on = 1; WM.WOUND.on = true; const v = S.foes()[0], sh = S.ops()[0], c = v.char;
      S.step(2); c.turn.on = true; c.bodyYaw += 1.3; c.aimYaw += 1.3; c.update(DT);   // (his AI's wish is 1.3 rad round from where he is drawn: mid-turn)
      const fired = await quiet(() => S.shoot(sh, v, 'wounding')); const y0 = c.bodyYaw, a0 = c.aimYaw; let worst = 0;
      for (let i = 0; i < 180; i++) { S.step(1); worst = Math.max(worst, Math.abs(c.bodyYaw - y0), Math.abs(c.aimYaw - a0)); }
      F.verdict(fired && !!v.wound && worst < 1e-9, 'three seconds on his facing has not moved', `${describe(v)} · most his yaws moved: ${(worst * 180 / Math.PI).toFixed(3)}°`); }
  } catch (e) { F.verdict(false, 'the probe ran', String((e as Error)?.stack ?? e)); } finally { CH.TURN.on = turn0; restore(); }
  return F.done();
}
