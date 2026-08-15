// The 'carbine' family (rifles, docs/internal/sc20k-design.md §3 / §9 — lane R1: the guards' carbine RIG + the long-gun poses), run through probes.ts:
//   bun run tools/qa/probes.ts carbine-rig [--verbose]
// PASS / FAIL each, all headless:
//   (1) tune.carbineGuards 'none' (the default): every guard's hand props are today's kit exactly — the calm patrol's torch body + lens off RIG.torch and the
//       sidearm on the thigh, four boxes a man, every one carrying his owner byte — and no animator has a long gun in its hands;
//   (2) flipped to 'reyes' live: Reyes' list becomes the carbine's eleven parts (dims off RIG.carbine) + the holstered sidearm, with NO torch part and NO
//       weapon-light-lens-of-the-drawn-pistol part, nothing gun-shaped in his hand but the carbine, all finite, all owner-stamped; the other two men's lists are
//       what they were under 'none' to the millimetre; and back to 'none' Reyes' list is his old one again;
//   (3) his light is the carbine's: the flashlight's source sits within 3 cm of the weapon-light lens box and points down the bore, and when he turns (a held
//       patrol man's aim follows his body) the source moves with the muzzle and stays on the lens; hunting a fix to one side (suspicious, aim on a point) the
//       beam is Character.aimDir to the degree and still leaves from the lens;
//   (4) each of the four carriages forced in turn (anim.longStance) on the standing man and on the walking man — the calm carry, the low ready and the port on
//       the calm man, the shouldered aim the way the game gives it (over the aim layer: suspicious, covering / walking up on a fix ahead): the animator reports it,
//       no bone is NaN, the support hand is on its grip point (RIG.carbine.gripL through the gun frame off the real right hand) within 4 cm; for the first three the
//       trigger hand is within 4 cm of the carriage's own point off the chest; shouldered, the posed hand's bore is within 3° of aimDir, the wrist a forearm out
//       along the gun shoulder's own line to the target and the muzzle within 4 cm of that line (the AI's clearShot line and the round's flight one line, as the
//       pistol's are — or a jamb the shoulder clears takes every round);
//   (5) 'all': every man armed, two simulated minutes of the live AI with Sam teleported about to stir them — no NaN bone on anybody, every frame's hand-prop
//       list finite and owner-stamped, the long gun shown on every living man every frame.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { shotOrigin } = await import(`${ROOT}/src/game/guards.ts`);
const { handProps } = await import(`${ROOT}/src/game/combat.ts`);
const { RIG, carbineGrip } = await import(`${ROOT}/src/game/rigProps.ts`);
const { LONG, LONG_STANCES, LONG_PIVOT } = await import(`${ROOT}/src/game/character.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60, R2D = 180 / Math.PI;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);

/** a box's half extents as a sortable key (mm) — the Seg it came from is (thick, tall, (l1 − l0) / 2) */
const dimKey = (h: number[]) => h.map(x => Math.round(x * 1000)).join('×');
const segKey = (s: { l0: number; l1: number; thick: number; tall: number }) => dimKey([s.thick, s.tall, Math.max(0.001, (s.l1 - s.l0) / 2)]);
/** this frame's hand-prop boxes per guard (by owner byte), as combat.ts handProps emits them for the renderer */
function propsByGuard(game: any): Map<number, any[]> {
  const out: any[] = []; handProps(game, out);
  const m = new Map<number, any[]>(); for (const gd of game.guards) m.set(gd.char.id, []);
  for (const b of out) { const l = m.get(b.owner); if (l) l.push(b); }
  return m;
}
const listKey = (boxes: any[]) => boxes.map(b => dimKey(b.h)).sort().join(' ');
const finiteBox = (b: any) => [...b.c, ...b.h, b.yaw, ...(b.rot ?? [])].every(Number.isFinite);
const bonesFinite = (c: any) => Object.values(c.bones).every((p: any) => p.every(Number.isFinite));
/** the support hand's grip point in the world: the real right wrist + RIG.carbine.gripL taken through the gun frame rigProps draws the weapon in (z = gunDir, y = up ⊥ it) */
function gripPointL(c: any): Vec3 {
  const d = c.gunDir; const yW = v3.normalize(v3.mad([0, 1, 0], d, -d[1])); const xW = v3.cross(yW, d); const G = carbineGrip().wrist;
  return v3.add(c.bones.handR, v3.mad(v3.mad(v3.scale(xW, G[0]), yW, G[1]), d, G[2]));
}
/** the trigger hand's own point, as character.ts longArms places it: off the chest joint — or, by the carriage's `anchor`, off the gun shoulder — by [side, up, fwd],
 *  swung about the shoulders' pivot (LONG_PIVOT … the gun shoulder itself) by the aim's share of the pitch, the whole turned by the body yaw plus the chest's twist
 *  toward the aim (the carriage rides the twist like the pistol's; staged with the aim layer down, so the twist here is yaw only) */
function gripPointR(c: any, shape: any): Vec3 {
  const y = c.bodyYaw + c.anim.aimYawOffset; const s = Math.sin(y), co = Math.cos(y);
  const yawed = (o: Vec3): Vec3 => [o[0] * co + o[2] * s, o[1], -o[0] * s + o[2] * co], unyaw = (o: Vec3): Vec3 => [o[0] * co - o[2] * s, o[1], o[0] * s + o[2] * co];
  const k = shape.anchor ?? 0; const sh = v3.scale(unyaw(v3.sub(c.bones.upperArmR, c.bones.chest)), k);   // the anchor off the chest joint, model axes
  const pv: Vec3 = [0, LONG_PIVOT[1] * (1 - k) + sh[1] * k, LONG_PIVOT[2] * (1 - k) + sh[2] * k];
  const o: Vec3 = [sh[0] + shape.side, sh[1] + shape.up, sh[2] + shape.fwd];   // model: x = the figure's left, z = ahead
  const th = c.aimPitch * shape.aimK, ry = o[1] - pv[1], rz = o[2] - pv[2];
  o[1] = pv[1] + ry * Math.cos(th) + rz * Math.sin(th); o[2] = pv[2] - ry * Math.sin(th) + rz * Math.cos(th);
  return v3.add(c.bones.chest, yawed(o));
}

export async function carbineRig(verbose = process.argv.includes('--verbose')) {
  console.log('\n=== carbine-rig: the guards\' carbine — RIG.carbine on the right hand, the weapon light for his torch, the four long-gun carriages (tune.carbineGuards) ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  Math.random = seeded(4741);
  const W = await standUp(); const { game } = W;
  game.godMode = true; game.playerInvisible = true;
  for (let i = 0; i < 30; i++) W.step(DT);
  const reyes = game.guards.find((g: any) => g.callsign === 'Reyes'); if (!reyes) { verdict(false, 'staging', 'no guard called Reyes on this level'); return false; }
  const others = game.guards.filter((g: any) => g !== reyes);
  const C = RIG.carbine;
  const carbineParts = ['receiver', 'handguard', 'barrel', 'muzzle', 'mag', 'mag2', 'grip', 'stockTop', 'stockLow', 'light', 'lens'].map(k => ({ k, key: segKey(C[k]) }));
  const torchKeys = [segKey(RIG.torch.body), segKey(RIG.torch.lens)], pistolLensKey = segKey(RIG.guardPistol.lens), holsterKeys = [segKey(RIG.guardPistol.slide), segKey(RIG.guardPistol.grip)];

  // ---- (1) 'none': today's kit
  const base = propsByGuard(game); const baseKeys = new Map([...base].map(([id, l]) => [id, listKey(l)]));
  {
    const fails: string[] = [];
    if (game.tune.carbineGuards !== 'none') fails.push(`the default deal is '${game.tune.carbineGuards}', not 'none'`);
    const wantCalm = [...torchKeys, ...holsterKeys].sort().join(' ');
    for (const gd of game.guards) {
      const l = base.get(gd.char.id)!;
      if (gd.state === 'patrol' && !gd.drawn && listKey(l) !== wantCalm) fails.push(`${gd.callsign}: ${l.length} boxes [${listKey(l)}], want torch body + lens + holstered slide + grip [${wantCalm}]`);
      if (l.some((b: any) => b.owner !== gd.char.id)) fails.push(`${gd.callsign}: a box without his owner byte`);
      if (gd.char.anim.longGun || gd.char.anim.longShown) fails.push(`${gd.callsign}: animator has a long gun under 'none'`);
      if (Math.abs(gd.char.muzzleAhead - 0.26) > 1e-9) fails.push(`${gd.callsign}: muzzleAhead ${gd.char.muzzleAhead}, want 0.26`);
    }
    verdict(fails.length === 0, "(1) 'none': every man's hand props are the torch kit off RIG.torch + the thigh rig, owner-stamped, no long gun anywhere",
      fails.join('; ') || game.guards.map((gd: any) => `${gd.callsign} ${base.get(gd.char.id)!.length} boxes (${gd.state}${gd.drawn ? ', drawn' : ''})`).join(' · '));
  }

  // ---- (2) 'reyes', live
  game.tune.carbineGuards = 'reyes'; W.step(DT); W.step(DT);
  {
    const now = propsByGuard(game); const rl = now.get(reyes.char.id)!; const keys = rl.map((b: any) => dimKey(b.h));
    const fails: string[] = [];
    const missing = carbineParts.filter(p => !keys.includes(p.key)).map(p => p.k);
    if (missing.length) fails.push(`carbine parts missing from Reyes' list: ${missing.join(', ')}`);
    if (rl.length !== 13) fails.push(`Reyes draws ${rl.length} boxes, want 13 (11 carbine + holstered slide + grip)`);
    if (keys.some((k: string) => torchKeys.includes(k) && !carbineParts.some(p => p.key === k))) fails.push('a torch part is still drawn on Reyes');
    if (keys.includes(pistolLensKey) && !carbineParts.some(p => p.key === pistolLensKey)) fails.push('the drawn pistol\'s weapon-light lens is drawn on Reyes');
    { // exactly one sidearm, and it is the one on the thigh: two slide / grip-shaped parts as under 'none', both down by the thigh joint and not up at the wrist
      const th = reyes.char.bones.thighR, hand = reyes.char.bones.handR;
      const side = rl.filter((b: any) => holsterKeys.includes(dimKey(b.h)) && !carbineParts.some(p => p.key === dimKey(b.h)));
      if (side.length !== 2) fails.push(`${side.length} sidearm-shaped parts on him, want the thigh rig's 2`);
      const inHand = side.filter((b: any) => v3.dist(b.c, hand) < v3.dist(b.c, th));
      if (inHand.length) fails.push(`${inHand.length} sidearm part(s) nearer his wrist than his thigh (a pistol in the hand?)`);
    }
    if (!rl.every(finiteBox)) fails.push('a non-finite box on Reyes');
    if (rl.some((b: any) => b.owner !== reyes.char.id)) fails.push('a Reyes box without his owner byte');
    if (!reyes.char.anim.longGun) fails.push('Reyes\' animator was not armed (longGun false)');
    if (Math.abs(reyes.char.muzzleAhead - 0.5) > 0.01) fails.push(`Reyes' muzzleAhead ${f3(reyes.char.muzzleAhead)}, want 0.50`);
    for (const o of others) { const k = listKey(now.get(o.char.id)!); if (k !== baseKeys.get(o.char.id)) fails.push(`${o.callsign}'s list changed under 'reyes': [${k}] vs [${baseKeys.get(o.char.id)}]`); if (o.char.anim.longGun) fails.push(`${o.callsign} armed under 'reyes'`); }
    // and back
    game.tune.carbineGuards = 'none'; W.step(DT); W.step(DT);
    const back = listKey(propsByGuard(game).get(reyes.char.id)!); if (back !== baseKeys.get(reyes.char.id)) fails.push(`back on 'none' Reyes draws [${back}], not his old [${baseKeys.get(reyes.char.id)}]`);
    if (reyes.char.anim.longGun || Math.abs(reyes.char.muzzleAhead - 0.26) > 1e-9) fails.push('back on \'none\' Reyes is still armed');
    game.tune.carbineGuards = 'reyes'; W.step(DT); W.step(DT);
    verdict(fails.length === 0, "(2) 'reyes' live: Reyes = the carbine's 11 parts + thigh rig, no torch / drawn-pistol part, finite, owner-stamped; the others untouched; reversible",
      fails.join('; ') || `Reyes ${rl.length} boxes: ${carbineParts.map(p => p.k).join(', ')} + holster ×2 · ${others.map((o: any) => `${o.callsign} ${now.get(o.char.id)!.length} boxes as before`).join(' · ')}`);
  }

  // ---- (3) the light is on the gun
  {
    const fails: string[] = []; const notes: string[] = [];
    for (const o of others) { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; }   // the other two out of it
    reyes.hold = true; reyes.state = 'patrol'; reyes.awareness = 0; reyes.lastKnown = null; reyes.reactT = 0;
    const lensBox = () => { const l = propsByGuard(game).get(reyes.char.id)!.filter((b: any) => dimKey(b.h) === segKey(C.lens)); return l.length === 1 ? l[0] : null; };
    const check = (tag: string) => {
      const fl = reyes.flashlight, c = reyes.char, lb = lensBox();
      if (!lb) { fails.push(`${tag}: no single lens box to measure against`); return null; }
      const dLens = v3.dist(fl.pos, lb.c), ang = Math.acos(Math.min(1, v3.dot(v3.normalize(fl.dir), c.gunDir))) * R2D;
      if (dLens > 0.03) fails.push(`${tag}: light source ${f3(dLens)} m off the lens box`);
      if (ang > 1) fails.push(`${tag}: beam ${f2(ang)}° off the bore`);
      if (!fl.enabled) fails.push(`${tag}: his light is off`);
      notes.push(`${tag}: source ${(dLens * 100).toFixed(1)} cm off the lens, beam ${f2(ang)}° off the bore, yaw ${Math.round(Math.atan2(fl.dir[0], fl.dir[2]) * R2D)}° pitch ${Math.round(Math.asin(fl.dir[1]) * R2D)}°`);
      return { pos: v3.copy(fl.pos), dir: v3.copy(fl.dir) };
    };
    for (let i = 0; i < 60; i++) W.step(DT);
    const a = check('held on patrol');
    reyes.char.bodyYaw += 0.9; for (let i = 0; i < 60; i++) W.step(DT);   // a held patrol man's aim is his body yaw + the idle sweep: turn the body, the muzzle (and so the light) must come round
    const b = check('turned 52°');
    if (a && b) {
      const moved = v3.dist(a.pos, b.pos), swung = Math.acos(Math.min(1, v3.dot(v3.normalize(a.dir), v3.normalize(b.dir)))) * R2D;
      if (moved < 0.15) fails.push(`the source moved only ${f3(moved)} m when he turned`);
      if (swung < 30) fails.push(`the beam swung only ${f2(swung)}° when he turned 52°`);
      notes.push(`turning moved the source ${f2(moved)} m and swung the beam ${Math.round(swung)}°`);
    }
    // hunting: suspicious of a point off to one side → upper 'aim', the bore (and beam) on Character.aimDir
    reyes.hold = true; reyes.state = 'suspicious'; reyes.awareness = 0.5; reyes.reactT = 0; reyes.searchT = 0;
    const c = reyes.char; reyes.lastKnown = v3.add(c.pos, [Math.sin(c.bodyYaw + 0.7) * 6, 0, Math.cos(c.bodyYaw + 0.7) * 6]);
    for (let i = 0; i < 90; i++) { W.step(DT); reyes.awareness = 0.5; }
    const h = check('suspicious, covering a fix 40° left');
    if (h) { const offAim = Math.acos(Math.min(1, v3.dot(v3.normalize(h.dir), c.aimDir()))) * R2D; if (offAim > 3) fails.push(`hunting, the beam is ${f2(offAim)}° off aimDir`); /* (≤ 3° like the posed bore in (4): since review 08-10 #6 the beam rides the HANDS' bore — the drawn gun's own line — not the analytic aimDir a shooting man's gunDir used to be snapped to; a settled shouldered carriage holds the bore within ~2° of the aim) */ if (c.anim.longShown !== 'shoulder') fails.push(`hunting he shows '${c.anim.longShown}', not 'shoulder'`); notes.push(`hunting: beam ${f2(offAim)}° off aimDir, carriage ${c.anim.longShown}`); }
    verdict(fails.length === 0, '(3) the weapon light IS the muzzle: source on the lens box, beam down the bore, comes round with him, on the aim (≤ 3°) when he hunts', (fails.length ? fails.join('; ') + ' · ' : '') + notes.join(' · '));
    reyes.state = 'patrol'; reyes.awareness = 0; reyes.lastKnown = null;
  }

  // ---- (4) the four carriages, forced, standing and walking — the calm carry, the low ready and the port on the calm man (aim layer down: the trigger hand's point
  //      is checked against the carriage's own formula), 'shoulder' the way the game gives it (over the aim layer: suspicious, covering / walking up on a fix ahead),
  //      where what matters is checked instead — the wrist a forearm out along the gun shoulder's own line to the target and the muzzle on that line
  {
    const fails: string[] = []; const notes: string[] = [];
    for (const walking of [false, true]) {
      for (const ls of LONG_STANCES) {
        const an = reyes.char.anim, c = reyes.char; an.longStance = ls;
        reyes.wp = 1; reyes.wait = 0; reyes.path = []; reyes.pathGoal = null; reyes.reactT = 0; reyes.searchT = 0;
        if (ls === 'shoulder') { reyes.hold = !walking; reyes.state = 'suspicious'; reyes.awareness = 0.5; reyes.lastKnown = v3.add(c.pos, [Math.sin(c.bodyYaw) * 9, 0, Math.cos(c.bodyYaw) * 9]); }
        else { reyes.hold = !walking; reyes.state = 'patrol'; reyes.awareness = 0; reyes.lastKnown = null; }
        let worstL = 0, worstR = 0, worstAim = 0, worstLine = 0, alongLo = 9, alongHi = -9, nan = false, shownOk = true, moved = 0; const p0 = v3.copy(c.pos);
        for (let i = 0; i < 75; i++) {
          W.step(DT); reyes.awareness = ls === 'shoulder' ? 0.5 : 0;
          if (!bonesFinite(c)) nan = true;
          if (i >= 45) {   // settled (the springs are 90 % there in 0.3 s)
            worstL = Math.max(worstL, v3.dist(c.bones.handL, gripPointL(c)));
            if (an.longShown !== ls) shownOk = false;
            if (ls === 'shoulder') {
              const hd = v3.normalize(v3.sub(c.bones.fingerR, c.bones.handR)); worstAim = Math.max(worstAim, Math.acos(Math.min(1, v3.dot(hd, c.aimDir()))) * R2D);
              const sh = shotOrigin(c), ad = c.aimDir(), m = v3.sub(c.muzzle, sh); worstLine = Math.max(worstLine, v3.len(v3.mad(m, ad, -v3.dot(m, ad))));   // (shotOrigin: the very point clearShot judges the line from — one source of truth)   // the muzzle's distance off the gun shoulder's line along the aim: the AI's line of fire (guards.ts clearShot: shoulder → target) and the round's (muzzle → target) must be one line, as with the pistol at arm's length
              const along = v3.dot(v3.sub(c.bones.handR, c.bones.upperArmR), ad); alongLo = Math.min(alongLo, along); alongHi = Math.max(alongHi, along);   // (the wrist's reach out along the aim from the GUN SHOULDER bone — the ergonomic fact — whatever point the AI judges its line from)
            } else worstR = Math.max(worstR, v3.dist(c.bones.handR, gripPointR(c, LONG[ls])));
          }
        }
        moved = v3.distXZ(c.pos, p0);
        const tag = `${walking ? 'walking' : 'standing'} ${ls}${ls === 'shoulder' ? ' (hunting a fix ahead)' : ''}`;
        if (nan) fails.push(`${tag}: a NaN bone`);
        if (!shownOk) fails.push(`${tag}: animator shows '${an.longShown}'`);
        if (worstL > 0.04) fails.push(`${tag}: support hand ${f3(worstL)} m off its grip point`);
        if (ls !== 'shoulder' && worstR > 0.04) fails.push(`${tag}: trigger hand ${f3(worstR)} m off the carriage's point`);
        if (ls === 'shoulder' && worstAim > 3) fails.push(`${tag}: posed bore ${f2(worstAim)}° off aimDir`);
        if (ls === 'shoulder' && worstLine > 0.04) fails.push(`${tag}: the muzzle sits ${f3(worstLine)} m off the gun shoulder's aim line (clearShot and the round would disagree at a jamb)`);
        if (ls === 'shoulder' && (alongLo < 0.18 || alongHi > 0.42)) fails.push(   // (a plausible forearm's reach out from the gun shoulder: LONG.shoulder.fwd is measured from the ANCHOR, which the designer sets anywhere between chest and shoulder, so it is not this distance)
          `${tag}: the wrist ${f2(alongLo)}‥${f2(alongHi)} m out along the shoulder's line, want ≈ ${LONG.shoulder.fwd}`);
        if (walking && moved < 0.3) fails.push(`${tag}: he only covered ${f2(moved)} m (not walking?)`);
        notes.push(`${tag}: L ${(worstL * 100).toFixed(1)} cm ${ls === 'shoulder' ? `wrist ${f2(alongLo)}‥${f2(alongHi)} m out on the shoulder line, bore ${f2(worstAim)}°, muzzle ${(worstLine * 100).toFixed(1)} cm off the line` : `R ${(worstR * 100).toFixed(1)} cm`}${walking ? ` (${f2(moved)} m walked)` : ''}`);
      }
      reyes.char.anim.longStance = null; reyes.state = 'patrol'; reyes.awareness = 0; reyes.lastKnown = null;
    }
    verdict(fails.length === 0, '(4) each carriage, standing and on the move: reported, finite, the support hand on its grip point (≤ 4 cm); calm carry / low ready / port: the trigger hand on the carriage\'s point (≤ 4 cm); shouldered over the aim: bore on aimDir (≤ 3°), the wrist a forearm out on the gun shoulder\'s line and the muzzle on it (≤ 4 cm)', (fails.length ? fails.join('; ') + ' · ' : '') + notes.join(' · '));
  }

  // ---- (5) 'all', the live AI stirred for two minutes
  {
    Math.random = seeded(90210);
    const W2 = await standUp(); const g2 = W2.game; g2.godMode = true; g2.tune.carbineGuards = 'all';
    const fails: string[] = []; let frames = 0, boxesSeen = 0, shownMiss = 0; const spots: Vec3[] = [[8, 0, 16], [20, 0, 11.1], [30, 0, 17], [17, 0, 15.5], [26, 0, 8.6]];
    for (let f = 0; f < 120 * 60 && fails.length < 5; f++) {
      if (f % (24 * 60) === 0) g2.teleportPlayer(v3.copy(spots[(f / (24 * 60)) % spots.length]));   // Sam pops up round the floor: they see him, shoot, chase, search, calm
      W2.step(DT); frames++;
      for (const gd of g2.guards) {
        if (!bonesFinite(gd.char)) { fails.push(`frame ${f}: ${gd.callsign} has a NaN bone (${gd.state})`); break; }
        if (gd.state !== 'dead' && gd.char.anim.longShown === null) shownMiss++;
      }
      if (f % 30 === 0) { const m = propsByGuard(g2); for (const gd of g2.guards) { const l = m.get(gd.char.id)!; boxesSeen += l.length; if (!l.every(finiteBox)) fails.push(`frame ${f}: non-finite prop box on ${gd.callsign}`); if (l.some((b: any) => b.owner !== gd.char.id)) fails.push(`frame ${f}: ${gd.callsign} box without owner`); if (gd.state !== 'dead' && l.length !== 13) fails.push(`frame ${f}: ${gd.callsign} (${gd.state}) draws ${l.length} boxes, want 13`); } }
    }
    const states = g2.guards.map((gd: any) => `${gd.callsign} ${gd.state}`).join(', ');
    if (shownMiss > 0) fails.push(`${shownMiss} guard-frames with no carriage shown on a living rifleman`);
    verdict(fails.length === 0, "(5) 'all' under the live AI for two minutes, Sam popping up round the floor: no NaN, props finite + owner-stamped + 13 a living man, a carriage shown every frame",
      (fails.length ? fails.join('; ') + ' · ' : '') + `${frames} frames, ${boxesSeen} prop boxes checked, alarm level ${g2.escalation}, ended: ${states}`);
  }
  if (verbose) console.log('  RIG.carbine parts (thick × tall × half-length, mm): ' + carbineParts.map(p => `${p.k} ${p.key}`).join(' · '));
  console.log(`=== carbine-rig: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
