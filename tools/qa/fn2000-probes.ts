// The 'fn2000' family (alias 'sc20k', the name it shipped under) + its 'airfoil' sub-family (rifles, docs/internal/sc20k-design.md §5 / §9 — lane R5: Sam's FN2000, its selector, the sling, the kit's
// slots round it, and the ring-airfoil launcher on the right button), run through probes.ts:
//   bun run tools/qa/probes.ts fn2000 | airfoil | rifle-cadence | rifle-reload | rifle-spread | rifle-slot | rifle-suppression | kit-slots | airfoil-head | airfoil-torso |
//                              airfoil-miss | airfoil-preview | airfoil-hostage   [--verbose]
// PASS / FAIL each, all headless, all through the real input path where the player has one (1 / 2 / 3 / 4 / E / Z / LMB / RMB / R / Q / Space):
//   rifle-cadence      SEMI: a held trigger clicked every frame = one round per 0.2 s exactly (12 frames), a held one clicked once = ONE round, taps every 60 ms
//                      gated to the same; AUTO (Z): a held trigger = a round every 6th frame, a tap = one; every round a 'shot' at level 1 tagged fn2000, its own
//                      voice and card, the muzzle 0.52 out; nothing inside the equip beat
//   rifle-reload       30+1 topped up + two thirties; a partial back to storage, the fullest in, done at 2.4 s; an empty drops as a 'mag' fill 3 (his), the rack
//                      at 2.0 only when the chamber was empty; a sprint breaks it off; the kit row says '· reloading'
//   rifle-spread       rifleSpread's own numbers (still < moving, × crouch, × brace) AND the dispersion measured at a wall 12 m off through the input path:
//                      braced RMS ≤ 0.55 × unbraced, an AUTO string's late rounds wider than its first
//   rifle-slot         4 / X / X / E / E / the wall (Q on, Q off) / a click / the grab (Space) / E in the hold: what is in the hands, what the animator holds, the
//                      carriage per state (shoulder in the hands — standing, crouched, on a shot — lowLong at a sprint), and EVERY frame of it the rifle's
//                      eleven boxes in exactly one place — off the hand or across the back — finite, owner-stamped
//   rifle-carry        how it is HELD (the designer's four notes): the muzzle's side-to-side per stride under a bound crouch-walking / walking / running with it
//                      shouldered and sprinting with it low, the support hand on the foregrip every frame of a sprint → stop → walk → crouch run and of a wall hug
//                      let go (the one-hand regression), the carriage never the calm carry / never nothing while it is drawn in the hand; and SLUNG: flat on the
//                      back against the skinned mesh (on the shoulder blade, bridging the small of the back, rolled side-flat), no part's middle over 20 cm off
//                      the spine line, standing / walking / crouched / running / kicking; and PER POSTURE: the crouched table (LONG_CROUCH) moves a crouched
//                      man's carriage and not a standing one's, both hands stay on crouched and through crouch toggles
//   rifle-suppression  Sam's rifle rounds past a man raise his suppression like his pistol rounds do (same segment rule); a ring past him raises nothing
//   airfoil-head       a ring on a calm man's head at 8 m through 2 (RING) + the reticle + a RIGHT click: 'struck', breathing, by the player, his torch laid down, a thud-level
//                      noise, no 'shot' event, rings 5 → 4, one 'ring' item, a knockout on the card and no kill
//   airfoil-torso      a ring in the hips (fireRing at them): alive, staggered 1.5 s (rooted, gun down, no round though he has Sam lit in front of him), a yelp
//                      from the pool, then ALERT with his fix on the shooter's side; no damage ever
//   airfoil-miss       a ring into the wall 4 m from a calm man: the clack is a 'prop' 0.3 nobody made — he turns to look at IT (awareness up, his fix by the
//                      wall, not on Sam), a 'ring' item under the mark
//   airfoil-preview    ringSolve's polyline is the flight: every frame of a real ring lies within 5 cm of the previewed arc and it ends within 15 cm of `land`
//   airfoil-hostage    a ring fired at the pair from in front (a guard's Character as the shooter) meets the HELD man first: he goes down 'struck' by 'guard',
//                      the hold ends, Sam untouched
import { standUp, loadCharacter, ROOT } from './headless.ts';
const { v3, quat } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon, handProps } = await import(`${ROOT}/src/game/combat.ts`);
const { SC20K_TAG, KNIFE_TAG, RIG, sc20kBoxes, sc20kGrip, sc20kMuzzleAhead } = await import(`${ROOT}/src/game/rigProps.ts`);
const { Character, LONG_STEADY } = await import(`${ROOT}/src/game/character.ts`);
const { rifleSpread, RIFLE_SPREAD, RIFLE_EQUIP_SECS } = await import(`${ROOT}/src/game/player.ts`);
const { RING, fireRing, ringSolve, staggerLines } = await import(`${ROOT}/src/game/launcher.ts`);
const { WEAPONS, LAUNCHER } = await import(`${ROOT}/src/game/weapons.ts`);
const { SUPPRESSION } = await import(`${ROOT}/src/game/suppression.ts`);
const { isBreathing } = await import(`${ROOT}/src/game/game.ts`);
const { ocpable } = await import(`${ROOT}/src/game/lighting.ts`);
const fxm = await import(`${ROOT}/src/game/effects.ts`);
const { Overlay } = await import(`${ROOT}/src/ui/overlay.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
/** parked out on the lot east of the building, held and pinned, facing east, deaf */
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); gd.heardUpTo = 1e12; }
const kit = (r: any) => `chamber ${r.chamber} mag ${r.mag} spare [${r.spare.join(',')}]${r.reloading ? ' RELOADING' : ''}`;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}

/** Sam alone in the corridor, everyone parked deaf on the lot, god mode; the rifle brought round with the 2 key and the equip beat waited out (or not: `draw` false
 *  leaves him as spawned — pistol selected, holstered, the rifle slung). Facing east down the corridor. */
async function stage(seed: number, draw = true, at: Vec3 = [21.5, 0, 11.5]) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game, input } = W;
  game.godMode = true; game.player.visibility = 0.02;
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => park(gd, i));
  game.teleportPlayer(at); game.player.crouch = false; game.player.char.bodyYaw = Math.PI / 2; game.player.char.aimYaw = Math.PI / 2;
  W.cam.yaw = 0; W.cam.rebuild?.(); W.step(DT);
  if (draw) { input.pressed.add('Digit2'); W.step(DT); for (let i = 0; i < 40; i++) { W.cursorAt([at[0] + 6, 1.2, at[2]]); W.step(DT); } }
  return W;
}
/** the audio log from here on */
function listen(W: any): any[] { const a: any[] = []; W.audioLog = a; return a; }
/** the rifle's boxes among Sam's hand props this frame (combat.ts handProps → rigProps SC20K_TAG), and where they sit: 'hand' if their middle is nearer his right
 *  wrist than a point a hand behind his chest, else 'back'; spread = the largest distance of any of them from their middle (one rifle: under 0.45) */
function rifleBoxes(game: any): { n: number; where: 'hand' | 'back' | 'none'; spread: number; finite: boolean; owned: boolean; knife: number; total: number } {
  const out: any[] = []; handProps(game, out); const c = game.player.char;
  const mine = out.filter(b => b.owner === (c.id & 0xff)); const rb = mine.filter(b => b.name === SC20K_TAG);
  if (!rb.length) return { n: 0, where: 'none', spread: 0, finite: true, owned: true, knife: mine.filter(b => b.name === KNIFE_TAG).length, total: mine.length };
  const mid: Vec3 = [0, 0, 0]; for (const b of rb) { mid[0] += b.c[0] / rb.length; mid[1] += b.c[1] / rb.length; mid[2] += b.c[2] / rb.length; }
  const spread = Math.max(...rb.map(b => v3.dist(b.c, mid)));
  const hand = c.bones.handR, back = v3.mad(c.bones.chest, c.chestDir, -0.2);
  const finite = rb.every(b => [...b.c, ...b.h, ...(b.rot ?? [])].every(Number.isFinite));
  return { n: rb.length, where: v3.dist(mid, hand) < v3.dist(mid, back) ? 'hand' : 'back', spread, finite, owned: rb.every(b => b.owner === (c.id & 0xff)), knife: mine.filter(b => b.name === KNIFE_TAG).length, total: mine.length };
}
/** a static (wall) at least `want` metres off along one of eight bearings from chest height at `p`: the bearing, the distance and the point on it */
function longLine(game: any, p: Vec3, want: number): { dir: Vec3; dist: number; hit: Vec3 } | null {
  const from: Vec3 = [p[0], 1.3, p[2]];
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; const dir: Vec3 = [Math.sin(a), 0, Math.cos(a)]; const h = game.col.raycast(from, dir, 40); if (h && h.t >= want) return { dir, dist: h.t, hit: v3.mad(from, dir, h.t) }; }
  return null;
}
/** the kit column off the real overlay code on a stand-in DOM (weapons-probes.ts hudText, trimmed to the text) */
function hudText(game: any): string {
  type El = { tag: string; className: string; kids: El[]; text: string; style: Record<string, string>; title: string; appendChild(c: El): El; textContent: string };
  const mkEl = (tag: string): El => { const el: any = { tag, className: '', kids: [] as El[], text: '', style: {}, title: '', appendChild(c: El) { el.kids.push(c); return c; } }; Object.defineProperty(el, 'textContent', { get() { return el.text + el.kids.map((k: El) => k.textContent).join(''); }, set(v: string) { el.text = v ?? ''; el.kids = []; } }); return el as El; };
  const ser = (el: El): string => `${el.tag}${el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''}${el.text ? `{${el.text}}` : ''}${el.kids.length ? `(${el.kids.map(ser).join(' ')})` : ''}`;
  const G = globalThis as any; const had = 'document' in G; const prev = G.document; G.document = { createElement: (t: string) => mkEl(t) };
  try { const ctx = { equip: mkEl('div'), equipKey: '' }; (Overlay.prototype as any).updateEquip.call(ctx, game); return ctx.equip.kids.map(ser).join(' | '); }
  finally { if (had) G.document = prev; else delete G.document; }
}
/** collect gunfire / prop hearing events raised since the last call (by identity — game.events is re-filtered every frame) */
function eventTap(game: any) { const seen = new Set<any>(); const evs: any[] = []; return { pump() { for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); evs.push({ kind: e.kind, level: e.level, weapon: e.weapon, who: e.who, pos: e.pos && v3.copy(e.pos), from: e.from && v3.copy(e.from), to: e.to && v3.copy(e.to), t: e.time }); } }, evs }; }

// ================================================================================================ the rifle
export async function rifleCadence() {
  const F = family('rifle-cadence: SEMI one round a click at the row\'s 0.2 s, AUTO (Z) a round every 0.1 s under a held trigger, each a level-1 \'shot\' tagged fn2000 in its own voice');
  const W = await stage(2001); const { game, input } = W; const pl = game.player, rf = pl.rifle;
  const audio = listen(W); const tap = eventTap(game); const WALLPT: Vec3 = [27.5, 1.2, 10.0];
  game.infiniteAmmo = true; W.step(DT);
  const roundsBetween = (i0: number) => audio.slice(i0).filter(a => a.name === 'rifleSuppressed').map(a => Math.round(a.t * 60));
  // (0) staging: the rifle is what 4 put in his hands
  { const fails: string[] = [];
    if (pl.slot !== 'rifle' || pl.holstered || !pl.rifleUp || !pl.braced) fails.push(`slot ${pl.slot} holstered ${pl.holstered} rifleUp ${pl.rifleUp} braced ${pl.braced}`);
    if (rf.def.id !== 'fn2000' || !rf.def.enabled || rf.mode !== 'semi') fails.push(`carries ${rf.def.id} enabled ${rf.def.enabled} mode ${rf.mode}`);
    if (Math.abs(pl.char.muzzleAhead - 0.52) > 0.005) fails.push(`muzzleAhead ${f3(pl.char.muzzleAhead)} (want 0.52)`);
    if (!pl.char.anim.longGun) fails.push('the animator holds no long gun');
    if (pl.equipT > 0) fails.push(`equipT still ${f2(pl.equipT)} after 40 frames`);
    F.verdict(!fails.length, '(0) 2 brings it round: the rifle slot up and braced, the fn2000 row, SEMI, the muzzle 0.52 out, the animator armed, the equip beat over', fails.join('; ') || `${rf.name} · ${kit(rf)} · carriage ${pl.char.anim.longShown}`); }
  // (a) SEMI, trigger held AND clicked every frame for 60 frames
  { const i0 = audio.length; for (let f = 0; f < 60; f++) { W.cursorAt(WALLPT); input.buttons |= 1; input.clicked |= 1; W.step(DT); tap.pump(); } input.buttons = 0; W.step(DT);
    const fr = roundsBetween(i0); const gaps = fr.slice(1).map((x, i) => x - fr[i]);
    const shots = tap.evs.filter(e => e.kind === 'shot'); const fails: string[] = [];
    if (fr.length !== 5) fails.push(`${fr.length} rounds in 60 frames of clicking (want 5: one per 12)`);
    if (gaps.some(g => g !== 12)) fails.push(`gaps ${gaps.join(',')} (want all 12)`);
    if (shots.length !== fr.length || shots.some(e => e.level !== 1 || e.weapon !== 'fn2000')) fails.push(`events ${JSON.stringify(shots.map(e => `${e.kind}:${e.level}:${e.weapon}`))}`);
    if (pl.char.anim.longShown !== 'shoulder') fails.push(`carriage ${pl.char.anim.longShown} while firing (want shoulder)`);
    F.verdict(!fails.length, '(a) SEMI, the trigger held down and clicked every frame: one round per 12 frames, five in the second, each a level-1 shot tagged fn2000, fired from the shoulder', fails.join('; ') || `frames ${fr.join(',')} · noise meter ${f2(pl.noise)}`);
    tap.evs.length = 0; }
  // (b) SEMI, held with ONE click: one round only; (c) taps every 4 frames (≈ 67 ms): gated to 12
  { for (let f = 0; f < 20; f++) W.step(DT);
    let i0 = audio.length; for (let f = 0; f < 60; f++) { W.cursorAt(WALLPT); input.buttons |= 1; if (f === 0) input.clicked |= 1; W.step(DT); } input.buttons = 0; for (let f = 0; f < 15; f++) W.step(DT);
    const held = roundsBetween(i0).length;
    i0 = audio.length; for (let f = 0; f < 60; f++) { W.cursorAt(WALLPT); if (f % 4 === 0) input.clicked |= 1; W.step(DT); } for (let f = 0; f < 15; f++) W.step(DT);
    const fr = roundsBetween(i0); const gaps = fr.slice(1).map((x, i) => x - fr[i]);
    const fails: string[] = [];
    if (held !== 1) fails.push(`a trigger held 60 frames with one click let ${held} rounds go (SEMI: want 1)`);
    if (fr.length !== 5 || gaps.some(g => g < 12)) fails.push(`taps every 4 frames: ${fr.length} rounds, gaps ${gaps.join(',')} (want 5, none under 12)`);
    F.verdict(!fails.length, '(b) SEMI is semi: a held trigger is one round; taps quicker than the sear come out at the sear\'s 0.2 s', fails.join('; ') || `held → ${held}; taps → frames ${fr.join(',')}`); }
  // (d) AUTO
  { input.pressed.add('KeyZ'); W.step(DT); const modeAfterZ = rf.mode; const zMsg = game.messages.at(-1)?.text ?? '';
    for (let f = 0; f < 20; f++) W.step(DT);
    let i0 = audio.length; for (let f = 0; f < 60; f++) { W.cursorAt(WALLPT); input.buttons |= 1; if (f === 0) input.clicked |= 1; W.step(DT); }
    const idxHeld = rf.autoIdx; input.buttons = 0; for (let f = 0; f < 20; f++) W.step(DT); const idxAfter = rf.autoIdx;
    const fr = roundsBetween(i0); const gaps = fr.slice(1).map((x, i) => x - fr[i]);
    i0 = audio.length; W.cursorAt(WALLPT); input.buttons |= 1; input.clicked |= 1; W.step(DT); input.buttons = 0; for (let f = 0; f < 30; f++) W.step(DT); const tapN = roundsBetween(i0).length;
    input.pressed.add('KeyZ'); W.step(DT); const back = rf.mode;
    const fails: string[] = [];
    if (modeAfterZ !== 'auto' || !/AUTO/.test(zMsg)) fails.push(`Z → mode ${modeAfterZ}, "${zMsg}"`);
    if (fr.length !== 10 || gaps.some(g => g !== 6)) fails.push(`${fr.length} rounds in 60 held frames, gaps ${gaps.join(',')} (want 10, all 6)`);
    if (idxHeld < 9 || idxAfter !== 0) fails.push(`autoIdx ${idxHeld} at the end of the string, ${idxAfter} 0.33 s after letting go (want ≥ 9, then 0)`);
    if (tapN !== 1) fails.push(`a one-frame tap on AUTO let ${tapN} rounds go (want 1)`);
    if (back !== 'semi') fails.push(`Z again → ${back}`);
    F.verdict(!fails.length, '(d) AUTO on Z: 600 rpm under a held trigger (every 6th frame), the string\'s count building and lapsing 0.25 s after release, a tap still one round, Z back to SEMI', fails.join('; ') || `frames ${fr.join(',')} · autoIdx ${idxHeld} → ${idxAfter} · "${zMsg}"`); }
  // (e) what one round is: voice, card, flash owner, and nothing inside the equip beat
  { for (let f = 0; f < 20; f++) W.step(DT);
    const cards: any[] = []; const fxArr = game.fx; const origPush = fxArr.push; fxArr.push = function (...items: any[]) { for (const it of items) cards.push({ h: it.box.h.map((x: number) => +x.toFixed(3)), emissive: it.box.emissive.map((x: number) => +x.toFixed(1)) }); return origPush.apply(this, items); };
    const i0 = audio.length; W.cursorAt(WALLPT); input.clicked |= 1; W.step(DT); fxArr.push = origPush;
    const voice = audio.slice(i0).find(a => a.name === 'rifleSuppressed' || a.name === 'pistolSuppressed');
    const M = fxm.muzzleFx.sc20k; const card = cards[0];
    // the equip beat: 1 to the pistol and 2 back — no round for RIFLE_EQUIP_SECS
    for (let f = 0; f < 20; f++) W.step(DT);
    input.pressed.add('Digit1'); W.step(DT); input.pressed.add('Digit2'); W.step(DT); const eq0 = pl.equipT;
    const i1 = audio.length; for (let f = 0; f < 20; f++) { W.cursorAt(WALLPT); input.clicked |= 1; W.step(DT); } const during = roundsBetween(i1).length;
    for (let f = 0; f < 15; f++) W.step(DT); const i2 = audio.length; W.cursorAt(WALLPT); input.clicked |= 1; W.step(DT); const after = roundsBetween(i2).length;
    const fails: string[] = [];
    if (!voice || voice.name !== 'rifleSuppressed') fails.push(`report voice ${voice?.name}`);
    if (!card || card.h[2] !== M.cardHalf[2] || card.emissive[0] !== M.cardEmissive[0]) fails.push(`flash card ${JSON.stringify(card)} (want muzzleFx.sc20k ${JSON.stringify({ h: M.cardHalf, e: M.cardEmissive })})`);
    if (Math.abs(eq0 - RIFLE_EQUIP_SECS) > DT + 1e-6 || during !== 0 || after !== 1) fails.push(`equip beat ${f2(eq0)} s: ${during} rounds inside it, ${after} on the click after it (want ${RIFLE_EQUIP_SECS}, 0, 1)`);
    F.verdict(!fails.length, '(e) a round is the row\'s: \'rifleSuppressed\', muzzleFx.sc20k\'s card; and 1 away / 2 back costs the equip beat — clicks inside it fire nothing, the first after it does', fails.join('; ') || `voice ${voice?.name} · card ${JSON.stringify(card)} · equip ${f2(eq0)} s → ${during}/${after}`); }
  return F.done();
}

export async function rifleReload() {
  const F = family('rifle-reload: 30+1 and two thirties managed like the Five-seveN — the staged 2.4 s beat, the partial to storage, the empty on the floor as his black box');
  const W = await stage(2002); const { game, input } = W; const pl = game.player, rf = pl.rifle; const audio = listen(W); const WALLPT: Vec3 = [27.5, 1.2, 10.0];
  /** press R and step `n` frames: the beat's foley stamped with the frame index it played on (0 = the frame of the press), and the frame the Firearm was done */
  const reloadBeat = (n: number, each?: (f: number) => void): { beat: string[]; doneAt: number } => {
    const beat: string[] = []; let doneAt = -1; let idx = audio.length; input.pressed.add('KeyR');
    for (let f = 0; f < n; f++) { W.step(DT); each?.(f); for (; idx < audio.length; idx++) if (['magOut', 'magIn', 'rack'].includes(audio[idx].name)) beat.push(`${audio[idx].name}:f${f}`); if (doneAt < 0 && f > 0 && !rf.reloading) doneAt = f; }
    return { beat, doneAt };
  };
  // (a) fresh kit, five rounds, R: partial
  { const fresh = kit(rf); const D = rf.def;
    for (let f = 0; f < 60; f++) { W.cursorAt(WALLPT); if (f % 12 === 0) input.clicked |= 1; W.step(DT); } for (let f = 0; f < 10; f++) W.step(DT);
    const before = kit(rf); const items0 = new Set(game.items.items);
    let animAt0 = false, hudMid = '';
    const { beat, doneAt } = reloadBeat(170, f => { if (f === 0) animAt0 = pl.char.anim.reloading; if (f === 40) hudMid = hudText(game); });
    const after = kit(rf); const newItems = game.items.items.filter((it: any) => !items0.has(it));
    const fails: string[] = [];
    if (fresh !== 'chamber 1 mag 30 spare [30,30]') fails.push(`fresh kit "${fresh}" (want 30+1 [30,30])`);
    if (D.magCapacity !== 30 || D.spareMags !== 2 || !D.topUp || D.reload.dur !== 2.4) fails.push(`row: box ${D.magCapacity} spares ${D.spareMags} topUp ${D.topUp} dur ${D.reload.dur}`);
    if (before !== 'chamber 1 mag 25 spare [30,30]') fails.push(`after five rounds "${before}"`);
    if (JSON.stringify(beat) !== JSON.stringify(['magOut:f31', 'magIn:f91'])) fails.push(`beat ${JSON.stringify(beat)} (want magOut f31, magIn f91, no rack — one was up the pipe; 0.5 / 1.5 s land a frame late on the float dust of summed sixtieths, exactly as the pistol's 1.6 s reads f97 in weapons-identity)`);
    if (doneAt !== 145) fails.push(`done at f${doneAt} (want f145: 2.4 s + the same frame)`);
    if (after !== 'chamber 1 mag 30 spare [30,25]') fails.push(`after "${after}" (want the fullest in, the 25 to storage)`);
    if (newItems.length) fails.push(`${newItems.length} item(s) dropped on a partial reload`);
    if (!animAt0) fails.push('no reload one-shot on the animator');
    if (!/FN2000 · reloading/.test(hudMid)) fails.push(`kit row mid-reload lacks "FN2000 · reloading": ${hudMid.slice(-260)}`);
    F.verdict(!fails.length, '(a) five rounds then R: mag out at 0.5 s (the 25 back to storage), the fullest thirty in at 1.5, no rack, done 2.4 — 30+1 [30,25]; the row says reloading', fails.join('; ') || `${fresh} → ${before} → ${JSON.stringify(beat)} done f${doneAt} → ${after}`); }
  // (b) empty: the box drops (fill 3, his), the rack at 2.0
  { rf.mag = 0; rf.chamber = 0; W.step(DT); const items0 = new Set(game.items.items);
    const { beat, doneAt } = reloadBeat(170);
    const box = game.items.items.filter((it: any) => !items0.has(it));
    const fails: string[] = [];
    if (JSON.stringify(beat) !== JSON.stringify(['magOut:f31', 'magIn:f91', 'rack:f121'])) fails.push(`beat ${JSON.stringify(beat)} (want out f31 / in f91 / rack f121)`);
    if (box.length !== 1 || box[0].kind !== 'mag' || box[0].fill !== 3 || box[0].who !== 1) fails.push(`dropped ${JSON.stringify(box.map((b: any) => `${b.kind}/fill${b.fill}/who${b.who}`))} (want one mag fill 3 who 1)`);
    if (kit(rf) !== 'chamber 1 mag 29 spare [25]') fails.push(`after "${kit(rf)}" (want 29+1 [25]: the thirty in, one racked off it)`);
    if (doneAt !== 145) fails.push(`done at f${doneAt} (want f145)`);
    F.verdict(!fails.length, '(b) dry, then R: the empty thirty hits the floor at 0.5 s as HIS box (a mag item, fill 3), the fullest spare in, the charging handle at 2.0 s, 29+1 [25]', fails.join('; ') || `${JSON.stringify(beat)} · ${JSON.stringify(box.map((b: any) => `${b.kind}/fill${b.fill}`))} · ${kit(rf)}`); }
  // (c) refused when full; broken off by a sprint; nothing left → the line
  { const msgs: string[] = []; const orig = game.msg.bind(game); game.msg = (t: string) => { msgs.push(t); return orig(t); };
    rf.mag = 30; rf.chamber = 1; rf.spare = [30]; input.pressed.add('KeyR'); W.step(DT); const refused = !rf.reloading;   // (a full spare to hand: with only the 25 in storage a 29-round box is rightly not worth changing either)
    W.cursorAt(WALLPT); input.clicked |= 1; W.step(DT); for (let f = 0; f < 15; f++) W.step(DT);
    input.pressed.add('KeyR'); for (let f = 0; f < 10; f++) W.step(DT); const mid = rf.reloading && pl.char.anim.reloading;
    input.keys.add('ShiftLeft'); input.keys.add('KeyW'); for (let f = 0; f < 5; f++) W.step(DT); input.keys.delete('ShiftLeft'); input.keys.delete('KeyW'); for (let f = 0; f < 20; f++) W.step(DT);
    const broke = !rf.reloading && !pl.char.anim.reloading;
    rf.spare = []; rf.mag = 3; msgs.length = 0; input.pressed.add('KeyR'); W.step(DT); const none = !rf.reloading && msgs.some(m => /no spare magazines for the FN2000/.test(m));
    game.msg = orig;
    const fails: string[] = [];
    if (!refused) fails.push('R with 30+1 started a reload'); if (!mid) fails.push('R after a round did not start one'); if (!broke) fails.push('a sprint did not break it off'); if (!none) fails.push(`no spares: reloading ${rf.reloading}, log ${JSON.stringify(msgs)}`);
    F.verdict(!fails.length, '(c) nothing to gain → R does nothing; a sprint breaks a reload off (gun and animator); no spares → it says so', fails.join('; ') || 'refused · broken off · "no spare magazines for the FN2000"'); }
  return F.done();
}

export async function rifleSpreadProbe() {
  const F = family('rifle-spread: his hands on it — still / moving / crouched × the brace he is ALWAYS in with it up, by the numbers, and the dispersion measured at a wall 12 m off through the trigger (re-frozen 08-08 when the brace stopped being a button — before: braced 5.3 mrad ≤ 0.55 × unbraced 11.5 off RMB, that unbraced string also carrying the hip-to-shoulder lift; after: both strings shouldered, as shipped ≈ 5.5 mrad ≤ 0.66 × a braceK-forced-to-1 reference ≈ 9.5, shipped inside 0.9‥9 mrad)');
  const W = await stage(2003); const { game, input } = W; const pl = game.player, rf = pl.rifle;
  game.infiniteAmmo = true; W.step(DT);
  // (a) rifleSpread's arithmetic against RIFLE_SPREAD — Player.braced is a rule now (rifle up, not sprinting, not kicking), not a field: read it, and take the brace
  //     off for the reference by forcing braceK to 1 for a line (restored at once)
  { const S = RIFLE_SPREAD; const fails: string[] = []; const K = S.braceK;
    if (!pl.braced) fails.push(`staged with the rifle up but braced ${pl.braced} (rifleUp ${pl.rifleUp}, sprinting ${pl.sprinting})`);
    pl.crouch = false; const still = rifleSpread(game, 0), moving = rifleSpread(game, 1.5);
    pl.crouch = true; const crouched = rifleSpread(game, 0); pl.crouch = false;
    S.braceK = 1; const free = rifleSpread(game, 0); S.braceK = K;
    pl.holstered = true; const slungBraced = pl.braced; pl.holstered = false;   // (slung: nothing to brace)
    if (Math.abs(still - S.still * K) > 1e-9 || Math.abs(moving - S.moving * K) > 1e-9) fails.push(`still ${still} moving ${moving} (want ${S.still} × ${K} / ${S.moving} × ${K}: braced in the hands)`);
    if (!(moving > still)) fails.push('moving is not wider than still');
    if (Math.abs(crouched - S.still * S.crouchK * K) > 1e-9) fails.push(`crouched ${crouched} (want × ${S.crouchK} × ${K})`);
    if (Math.abs(free - S.still) > 1e-9 || K > 0.5) fails.push(`free-hand reference ${free} (want ${S.still}), braceK ${K} (want ≤ 0.5)`);
    if (slungBraced) fails.push('braced with the rifle slung');
    F.verdict(!fails.length, `(a) rifleSpread with it up: ${S.still} × ${K} still, ${S.moving} × ${K} on the move, × ${S.crouchK} crouched — braced whenever it is in the hands, never slung (the pistol has no such line: it stays dead-on)`, fails.join('; ') || `still ${f3(still)} · moving ${f3(moving)} · crouched ${f3(crouched)} · free-hand ref ${f3(free)} · slung braced ${slungBraced}`); }
  // (b) measured: 100 rounds standing as shipped vs 100 with the brace factor forced off (braceK 1: the free-hand reference), fired through a point 12 m out; RMS of the rounds' unit directions off their mean (≈ radians)
  const line = longLine(game, pl.char.pos, 12);
  if (!line) { F.verdict(false, '(b) staging', 'no wall 12 m off along any bearing from the corridor spot'); return F.done(); }
  const target: Vec3 = v3.mad([pl.char.pos[0], 1.3, pl.char.pos[2]], line.dir, 12);   // a point IN THE AIR 12 m out along the clear bearing, chest high: the round flies through it into the wall beyond, so the impact scatter is the cone × the wall's distance
  const shootN = (n: number, freeHand: boolean, auto: boolean): Vec3[] => {
    const pts: Vec3[] = []; const tap = eventTap(game); const K = RIFLE_SPREAD.braceK;
    if (auto !== (rf.mode === 'auto')) { input.pressed.add('KeyZ'); W.step(DT); }
    if (freeHand) RIFLE_SPREAD.braceK = 1;   // the reference: what his hands would do without the brace (nothing in the game reaches this any more)
    try {
      for (let f = 0; pts.length < n && f < n * 14 + 60; f++) {
        W.cursorAt(target); game.aimGuard = null;
        input.buttons = auto ? 1 : 0; if (auto ? f === 0 : f % 13 === 0) input.clicked |= 1;
        W.step(DT); tap.pump();
        while (tap.evs.length) { const e = tap.evs.shift(); if (e.kind === 'shot' && e.weapon === 'fn2000' && e.from && e.to) pts.push(v3.normalize(v3.sub(e.to, e.from))); }   // the round's DIRECTION (muzzle → where it stopped): the cone itself, whatever depth of corridor each round happens to end in
      }
    } finally { RIFLE_SPREAD.braceK = K; }
    input.buttons = 0; for (let f = 0; f < 30; f++) W.step(DT);
    return pts.slice(0, n);
  };
  const rmsOff = (pts: Vec3[]) => { const m: Vec3 = [0, 0, 0]; for (const p of pts) { m[0] += p[0] / pts.length; m[1] += p[1] / pts.length; m[2] += p[2] / pts.length; } return Math.sqrt(pts.reduce((s, p) => s + v3.dist(p, m) ** 2, 0) / pts.length); };
  { const wallD = line.dist;
    const free = shootN(100, true, false); const brace = shootN(100, false, false);
    const rF = rmsOff(free), rB = rmsOff(brace);
    const fails: string[] = [];
    if (free.length < 100 || brace.length < 100) fails.push(`only ${free.length} / ${brace.length} impacts recorded`);
    if (!(rB <= 0.66 * rF)) fails.push(`as shipped (braced) RMS ${(rB * 1000).toFixed(2)} mrad vs the free-hand reference ${(rF * 1000).toFixed(2)}: ratio ${f2(rB / rF)} (want ≤ 0.66: the cones are 0.45 apart, over the ~4 mrad the muzzle's own breathing sway puts under both strings of muzzle→impact directions)`);
    if (!(rF > 0.002 && rF < 0.02)) fails.push(`free-hand reference RMS ${(rF * 1000).toFixed(2)} mrad (want a visible cone off spread 0.010: ~4 mrad)`);
    if (!(rB > 0.0009 && rB < 0.009)) fails.push(`as shipped RMS ${(rB * 1000).toFixed(2)} mrad (want the old braced band, 0.9‥9 mrad: ~1.8)`);
    if (!pl.rifleUp || !pl.braced) fails.push('the rifle left his hands (or the brace) during the strings');
    F.verdict(!fails.length, `(b) 100 rounds standing, through a point 12 m down a ${wallD.toFixed(1)} m line: as shipped (braced, always) groups at ≤ 0.66 × the free-hand reference and inside 0.9‥9 mrad — what RMB-held used to buy is now simply how the rifle shoots`, fails.join('; ') || `RMS free-hand ref ${(rF * 1000).toFixed(2)} mrad (${f2(rF * 12)} m at 12 m) · as shipped ${(rB * 1000).toFixed(2)} mrad · ratio ${f2(rB / rF)}`); }
  // (c) AUTO: a 30-round held string — rounds 15‥29 wider than rounds 0‥4 (the string's growth, capped at +0.08)
  { const pts = shootN(30, false, true);
    const early = rmsOff(pts.slice(0, 5)), late = rmsOff(pts.slice(15, 30));
    const fails: string[] = [];
    if (pts.length < 30) fails.push(`only ${pts.length} rounds of the string recorded`);
    if (!(late > early * 1.5)) fails.push(`late RMS ${(late * 1000).toFixed(1)} mrad vs early ${(early * 1000).toFixed(1)} (want the string to open up: > 1.5×)`);
    if (rf.autoSpread > (rf.def.auto?.spreadCap ?? 0) + 1e-9) fails.push(`autoSpread ${rf.autoSpread} past the cap`);
    F.verdict(!fails.length, '(c) an AUTO string walks open: its second half groups wider than its first five (spreadPerRound 0.012 a round, capped 0.08)', fails.join('; ') || `early RMS ${(early * 1000).toFixed(1)} mrad · late ${(late * 1000).toFixed(1)} mrad`);
    if (rf.mode === 'auto') { input.pressed.add('KeyZ'); W.step(DT); } }
  return F.done();
}

export async function rifleSlot() {
  const F = family('rifle-slot: 2 / 1 / 2 / E / the wall / a shot / a sprint / the grab — what is in the hands, what the animator holds, which carriage (shouldered whenever it is up), and the eleven boxes in ONE place every frame');
  const W = await stage(2004, false, [21.5, 0, 11.2]); const { game, input } = W; const pl = game.player, rf = pl.rifle, an = pl.char.anim;
  const trace: string[] = []; const bad: string[] = []; let frames = 0;
  /** step n frames asserting the per-frame invariants: eleven rifle boxes, finite, owner-stamped, together (spread < 0.45), and where `want` says (or anywhere) */
  const run = (n: number, want: 'hand' | 'back' | 'either', tag: string, each?: (f: number) => void) => {
    for (let f = 0; f < n; f++) {
      each?.(f); W.step(DT); frames++;
      const rb = rifleBoxes(game);
      const bonesOk = Object.values(pl.char.bones).every((p: any) => p.every(Number.isFinite));
      if (rb.n !== 11) bad.push(`${tag} f${f}: ${rb.n} rifle boxes (want 11)`);
      else { if (!rb.finite || !rb.owned) bad.push(`${tag} f${f}: non-finite ${!rb.finite} / un-owned ${!rb.owned} rifle box`); if (rb.spread > 0.45) bad.push(`${tag} f${f}: rifle boxes ${f2(rb.spread)} m apart (two places?)`); if (want !== 'either' && rb.where !== want) bad.push(`${tag} f${f}: rifle drawn at the ${rb.where} (want ${want})`); }
      if (!bonesOk) bad.push(`${tag} f${f}: NaN bone`);
      if (an.longGun !== (rifleBoxes(game).where === 'hand') && f > 1) bad.push(`${tag} f${f}: animator longGun ${an.longGun} but the rifle is drawn at the ${rb.where}`);
    }
  };
  const state = () => `slot ${pl.slot}${pl.holstered ? ' holstered/slung' : ''} · inHand ${pl.gunInHand()?.def.short ?? '—'} · rifle ${rifleBoxes(game).where} · longGun ${an.longGun} ${an.longShown ?? '—'} · muzzleAhead ${f2(pl.char.muzzleAhead)}`;
  const expect = (label: string, cond: boolean) => { trace.push(`${label}: ${state()}`); if (!cond) bad.push(`${label}: ${state()}`); };
  const AHEAD: Vec3 = [27.5, 1.2, 11.2];
  // fresh: pistol selected, holstered; rifle slung
  run(5, 'back', 'fresh'); expect('fresh (holstered, rifle slung)', pl.slot === 'pistol' && pl.holstered && !an.longGun && pl.gunInHand() === null && Math.abs(pl.char.muzzleAhead - 0.26) < 1e-6);
  input.pressed.add('Digit2'); run(40, 'hand', '2', () => W.cursorAt(AHEAD)); expect('2 (rifle in the hands: shouldered)', pl.slot === 'rifle' && !pl.holstered && pl.gunInHand() === rf && an.longGun && an.longShown === 'shoulder' && Math.abs(pl.char.muzzleAhead - 0.52) < 0.005);
  pl.crouch = true; run(40, 'hand', 'crouch'); expect('crouched, still (shouldered too)', an.longShown === 'shoulder'); pl.crouch = false; run(20, 'hand', 'stand');
  W.cursorAt(AHEAD); input.clicked |= 1; run(20, 'hand', 'shot', () => W.cursorAt(AHEAD)); expect('a round (shouldered)', an.longShown === 'shoulder' && rf.spent === 1);
  for (let f = 0; f < 100; f++) { W.cursorAt(AHEAD); W.step(DT); }   // (let the aim lapse: 1.6 s)
  input.keys.add('ShiftLeft'); input.keys.add('KeyD'); run(30, 'hand', 'sprint'); expect('sprinting (the low ready, both hands)', pl.sprinting && an.longShown === 'lowLong'); input.keys.delete('ShiftLeft'); input.keys.delete('KeyD'); run(30, 'hand', 'stop'); expect('stopped (shouldered again)', !pl.sprinting && an.longShown === 'shoulder');
  game.teleportPlayer([21.5, 0, 11.2]); pl.char.bodyYaw = pl.char.aimYaw = Math.PI / 2; run(10, 'hand', 'tp');
  input.pressed.add('Digit1'); run(30, 'back', 'D1', () => W.cursorAt(AHEAD)); expect('1 (the pistol drawn, rifle on the back)', pl.slot === 'pistol' && !pl.holstered && pl.gunInHand() === pl.pistol && !an.longGun && !pl.braced && Math.abs(pl.char.muzzleAhead - 0.26) < 1e-6);
  input.pressed.add('Digit2'); run(30, 'hand', 'D2', () => W.cursorAt(AHEAD)); expect('2 again (the rifle back in the hands)', pl.slot === 'rifle' && pl.gunInHand() === rf && an.longGun);
  input.pressed.add('KeyE'); run(30, 'back', 'E1'); expect('E (slung, hands free)', pl.slot === 'rifle' && pl.holstered && pl.gunInHand() === null && !an.longGun && !pl.braced);
  { const viaClickTakedown = game.messages.some((m: any) => /slung/.test(m.text)); if (!viaClickTakedown) bad.push('E with the rifle: the line did not say "slung"'); }
  input.pressed.add('KeyE'); run(30, 'hand', 'E2'); expect('E again (in the hands)', !pl.holstered && an.longGun);
  // the wall: north wall of the corridor at z ≈ 10 — sidle spot
  game.teleportPlayer([21.5, 0, 10.7]); pl.char.bodyYaw = pl.char.aimYaw = 0; run(10, 'hand', 'tp2');
  input.pressed.add('KeyQ'); run(40, 'either', 'Q');
  expect('Q (back to the wall: slung for it)', !!pl.wall && pl.holstered && !an.longGun && rifleBoxes(game).where === 'back');
  input.pressed.add('KeyQ'); run(40, 'either', 'Qoff'); expect('Q again (off it: back in the hands)', !pl.wall && !pl.holstered && an.longGun && rifleBoxes(game).where === 'hand');
  // the grab: a calm man ahead facing away; Space on his row
  const A = game.guards[0]; A.hold = true; A.pinned = false; A.state = 'patrol'; A.awareness = 0; A.heardUpTo = 1e12;
  game.teleportPlayer([24.0, 0, 11.3]); pl.char.bodyYaw = pl.char.aimYaw = Math.PI / 2; place(A, [24.75, 0, 11.3], Math.PI / 2); run(20, 'hand', 'pre-grab', () => W.cursorAt(v3.add(A.char.pos, [0, 1.4, 0])));
  { const row = game.hover?.kind === 'guard' ? game.hover.line2 : ''; if (!/rifle goes on your back/.test(row)) bad.push(`guard row with the rifle up: "${row}"`); else trace.push(`guard row: "${row}"`); }
  input.pressed.add('Space'); run(60, 'either', 'grab', () => W.cursorAt(v3.add(A.char.pos, [0, 1.4, 0])));
  expect('Space (grabbed: the rifle to the sling, the arm variant, the knife out)', !!pl.holding && pl.holding.variant === 'arm' && pl.holstered && !an.longGun && rifleBoxes(game).where === 'back' && rifleBoxes(game).knife === 4);
  input.pressed.add('KeyE'); run(40, 'back', 'E-hold', () => W.cursorAt(v3.add(A.char.pos, [0, 1.4, 0])));
  expect('E in the hold (the PISTOL to his head — the rifle stays slung)', !!pl.holding && pl.holding.variant === 'gun' && pl.slot === 'pistol' && !pl.holstered && !an.longGun && rifleBoxes(game).where === 'back');
  const ok = bad.length === 0;
  F.verdict(ok, `${frames} frames through 4 · crouch · a shot · a sprint · X · X · E · E · Q · Q · Space · E — the rifle drawn in exactly one place on every one, the animator agreeing, the carriage shoulder in the hands (standing, crouched, firing) / lowLong at the sprint`,
    (ok ? '' : '✗ ' + bad.slice(0, 8).join('\n    ✗ ') + '\n    ') + (VERBOSE || !ok ? trace.join('\n    ') : trace.filter((_, i) => i % 3 === 0).join(' | ')));
  return F.done();
}

export async function rifleSuppression() {
  const F = family('rifle-suppression: Sam\'s rifle rounds past a man raise his suppression like his pistol\'s (one rule off the traced segment); a ring past him raises nothing');
  const W = await stage(2005, false); const { game } = W; const pl = game.player;
  const A = game.guards[0]; A.hold = true; A.pinned = true; A.state = 'alert'; A.awareness = 1; A.heardUpTo = 1e12; A.lastSeenT = -100;
  game.teleportPlayer([16.0, 0, 11.4]); pl.char.bodyYaw = pl.char.aimYaw = Math.PI / 2; place(A, [25.0, 0, 11.6], -Math.PI / 2); for (let f = 0; f < 10; f++) W.step(DT);
  const chestA = () => A.char.bones.chest ?? v3.add(A.char.pos, [0, 1.1, 0]);
  const past = (): Vec3 => { const c = chestA(); return [c[0] + 3, c[1], c[2] - 0.7]; };   // 0.7 m off his chest to his right, on into the corridor beyond him
  const one = (weapon: any) => { A.sup.v = 0; A.sup.kick = 0; W.step(DT); const before = A.sup.v; fireWeapon(game, pl.char, past(), true, { weapon, spread: 0 }); return A.sup.v - before; };
  pl.slot = 'pistol'; pl.holstered = false; for (let f = 0; f < 30; f++) W.step(DT); const dp = one(WEAPONS.fiveseven);
  pl.slot = 'rifle'; pl.holstered = false; for (let f = 0; f < 40; f++) W.step(DT); const dr = one(WEAPONS.fn2000);
  A.sup.v = 0; W.step(DT); fireRing(game, pl.char, v3.add(pl.char.pos, [0.4, 1.3, 0]), past()); for (let f = 0; f < 40; f++) W.step(DT); const dRing = A.sup.v;
  const fails: string[] = [];
  if (!(dp > 0.15)) fails.push(`the pistol round 0.7 m past him added ${f3(dp)} (staging: want > 0.15)`);
  if (!(dr > 0.15) || Math.abs(dr / dp - 1) > 0.25) fails.push(`the rifle round added ${f3(dr)} vs the pistol's ${f3(dp)} (want the same rule: within 25 %)`);
  if (dRing > 1e-9) fails.push(`a ring past him added ${dRing}`);
  if (!pl.rifleUp) fails.push('staging: the rifle was not up for its round');
  F.verdict(!fails.length, 'a Five-seveN round and an FN2000 round down the same line 0.7 m off an alert man\'s chest add alike (≥ 0.15 each, within 25 %); a ring along it adds 0', fails.join('; ') || `pistol +${f3(dp)} · rifle +${f3(dr)} · ring +${f3(dRing)} (flinch line ${SUPPRESSION.flinch})`);
  return F.done();
}

// ================================================================================================ the kit's slots round it (playtest 08-08: re-slotted, X and B gone, RMB per item)
/** what Sam's right hand / fist shows this frame, off the boxes combat.ts handProps emits: the rifle's tagged boxes and where they sit (rifleBoxes), a can by its
 *  body colour (rigProps heldCanBoxes: smoke olive, stun near-black — nothing else he wears is either), the pistol by gunmetal boxes about the wrist (the
 *  holstered one rides the thigh, well clear of a hand hanging or a hand on the rifle) */
function fistOf(game: any): { rifle: 'hand' | 'back' | 'none'; can: 'smoke' | 'flash' | null; pistolInHand: boolean } {
  const out: any[] = []; handProps(game, out); const c = game.player.char; const hand: Vec3 = c.bones.handR;
  const mine = out.filter(b => b.owner === (c.id & 0xff) && b.name !== SC20K_TAG && b.name !== KNIFE_TAG);
  const near = (b: any, r: number) => v3.dist(b.c, hand) < r;
  const isCol = (b: any, col: number[]) => Math.abs(b.albedo[0] - col[0]) < 1e-3 && Math.abs(b.albedo[1] - col[1]) < 1e-3 && Math.abs(b.albedo[2] - col[2]) < 1e-3;
  const can = mine.some(b => near(b, 0.25) && isCol(b, [0.25, 0.29, 0.2])) ? 'smoke' : mine.some(b => near(b, 0.25) && isCol(b, [0.07, 0.075, 0.08])) ? 'flash' : null;
  const pistolInHand = mine.filter(b => near(b, 0.2) && isCol(b, [0.05, 0.05, 0.055])).length >= 2;   // slide + grip about the wrist (the thigh holster is COL.gun too, but never within 0.2 of a hand that is up on a gun or swinging past the hip at rest? — checked against `holstered` below, both ways)
  return { rifle: rifleBoxes(game).where, can, pistolInHand };
}
export async function kitSlots() {
  const F = family('kit-slots: 1 pistol · 2 FN2000 (2 again = its attachment) · 3 smoke · 4 stun — the digits, the fist per slot (never a can beside the rifle), the kit column with the OCP on row 1, the right button\'s matrix, the loadout off, X and B dead');
  const W = await stage(2201, false, [21.5, 0, 11.5]); const { game, input } = W; const pl = game.player, rf = pl.rifle, an = pl.char.anim;
  const AHEAD: Vec3 = [27.5, 1.2, 11.5];
  const settle = (n = 36) => { for (let f = 0; f < n; f++) { W.cursorAt(AHEAD); W.step(DT); } };
  const press = (code: string, n = 36) => { input.pressed.add(code); settle(n); };
  const msgs: string[] = []; const origMsg = game.msg.bind(game); game.msg = (t: string) => { msgs.push(t); return origMsg(t); };
  const audio = listen(W);
  // (a) the digits and what they select; 2 again cycles the attachment; the selection remembered while the rifle is away; X and B do nothing
  { const fails: string[] = []; const tr: string[] = [];
    const st = () => `${pl.slot}${pl.holstered ? '/away' : ''} att ${rf.attachment ?? 'none'}`;
    if (pl.slot !== 'pistol' || !pl.holstered) fails.push(`fresh: ${st()} (want pistol, holstered)`);
    press('Digit2'); tr.push(`2 → ${st()}`); if (pl.slot !== 'rifle' || pl.holstered || !pl.rifleUp || rf.attachment !== null) fails.push(`2: ${st()} rifleUp ${pl.rifleUp} (want rifle up, no attachment)`);
    msgs.length = 0; press('Digit2'); tr.push(`2 again → ${st()}`); if (pl.slot !== 'rifle' || !pl.rifleUp || rf.attachment !== 'ring' || !msgs.some(m => /ring airfoil ×5 on the right button/.test(m))) fails.push(`2 again: ${st()} "${msgs.at(-1)}" (want RING, said so)`);
    press('KeyX'); tr.push(`X → ${st()}`); if (pl.slot !== 'rifle' || !pl.rifleUp) fails.push(`X changed something: ${st()}`);
    press('KeyB'); tr.push(`B → ${st()}`); if (rf.attachment !== 'ring') fails.push(`B changed the attachment: ${st()}`);
    press('KeyE'); tr.push(`E → ${st()}`); if (!pl.holstered || rf.attachment !== 'ring') fails.push(`E: ${st()} (want slung, RING kept)`);
    press('Digit2'); tr.push(`2 slung → ${st()}`); if (!pl.rifleUp || rf.attachment !== 'ring') fails.push(`2 with it slung: ${st()} (want it drawn, RING still selected — not cycled)`);
    press('Digit2'); tr.push(`2 again → ${st()}`); if (rf.attachment !== null) fails.push(`2 again off RING: ${st()} (want none)`);
    press('Digit3'); tr.push(`3 → ${st()}`); if (pl.slot !== 'smoke' || pl.holstered || pl.throwKind !== 'smoke') fails.push(`3: ${st()} throwKind ${pl.throwKind}`);
    press('Digit4'); tr.push(`4 → ${st()}`); if (pl.slot !== 'flash' || pl.holstered || pl.throwKind !== 'flash') fails.push(`4: ${st()} throwKind ${pl.throwKind}`);
    press('Digit1'); tr.push(`1 → ${st()}`); if (pl.slot !== 'pistol' || pl.holstered || pl.gunInHand() !== pl.pistol) fails.push(`1: ${st()}`);
    press('KeyX'); if (pl.slot !== 'pistol') fails.push(`X off the pistol went to ${st()}`);
    // a double-tapped 2 off the pistol: the first draws it, the second lands inside the equip beat and must NOT put the launcher on the button
    input.pressed.add('Digit2'); W.step(DT); input.pressed.add('Digit2'); W.step(DT); const dbl = st(); settle(30); tr.push(`2,2 quick → ${dbl}`);
    if (pl.slot !== 'rifle' || rf.attachment !== null) fails.push(`2 twice inside the equip beat: ${dbl} (want the rifle drawn, no attachment)`);
    press('Digit1');
    F.verdict(!fails.length, '(a) 2 = the rifle into the hands, 2 again = its attachment none → RING → none (said, and kept while it is slung: 2 off the sling draws, does not cycle; a double tap inside the draw does not cycle either), 3 smoke, 4 stun, 1 the pistol; X and B are dead keys', fails.join('; ') || tr.join(' · ')); }
  // (b) the fist per slot × drawn / put away — the boxes handProps actually emits
  { const fails: string[] = []; const tr: string[] = [];
    for (const k of ['pistol', 'rifle', 'smoke', 'flash'] as const) for (const away of [false, true]) {
      pl.slot = k; pl.holstered = away; settle(40);
      const f = fistOf(game); tr.push(`${k}${away ? '/away' : ''}: rifle ${f.rifle} can ${f.can ?? '—'} pistol ${f.pistolInHand ? 'hand' : 'thigh'}`);
      const wantRifle = k === 'rifle' && !away ? 'hand' : 'back';
      const wantCan = !away && (k === 'smoke' || k === 'flash') ? k : null;
      const wantPistol = k === 'pistol' && !away;
      if (f.rifle !== wantRifle) fails.push(`${k}${away ? ' put away' : ''}: rifle at the ${f.rifle} (want ${wantRifle})`);
      if (f.can !== wantCan) fails.push(`${k}${away ? ' put away' : ''}: can ${f.can} in the fist (want ${wantCan})`);
      if (f.pistolInHand !== wantPistol) fails.push(`${k}${away ? ' put away' : ''}: pistol ${f.pistolInHand ? 'in the hand' : 'not in the hand'} (want ${wantPistol ? 'in it' : 'on the thigh'})`);
      if ((an.longGun === true) !== (wantRifle === 'hand')) fails.push(`${k}${away ? ' put away' : ''}: animator longGun ${an.longGun}`);
    }
    // and the exact playtest report: the rifle drawn WITH smoke cans on the belt and smoke the last throwable — mid quick-throw wind-up excluded, nothing else may put a can there
    pl.slot = 'rifle'; pl.holstered = false; pl.throwKind = 'smoke'; settle(40); const f2k = fistOf(game);
    if (f2k.can) fails.push(`the rifle in the hands and a ${f2k.can} can in the fist — the 08-08 bug`);
    F.verdict(!fails.length, '(b) the fist shows the SELECTED item and nothing else: the pistol in it only on the pistol\'s slot drawn, a can only on a canister slot drawn, the rifle in the hands only on its slot drawn (else across the back) — never a can beside the rifle', (fails.length ? '✗ ' + fails.join('\n    ✗ ') + '\n    ' : '') + tr.join(' | ')); }
  // (c) the kit column: rows 1‥4 in the digits' order, the OCP tag closing row 1, nothing about the right button in the strip, RING lit only while selected; the loadout off
  { const fails: string[] = [];
    pl.slot = 'pistol'; pl.holstered = false; rf.attIdx = -1; settle(10); const h0 = hudText(game);
    const order = [...h0.matchAll(/span\.key\{(\d)\} span\.name\{([^}]*)\}/g)].map(m => `${m[1]}:${m[2]}`).join(',');
    if (order !== '1:Five-seveN,2:FN2000,3:smoke,4:stun') fails.push(`rows ${order}`);
    if (!/div\.slot\.sel\(span\.key\{1\}[^|]*span\.tag\.ocp\.on\{OCP\}\(span\.ocpbar/.test(h0)) fails.push(`row 1 lacks the lit OCP tag + meter: ${h0.split(' | ')[2]}`);
    if (/RMB/.test(h0.split(' | ')[0]) || /BRACE/.test(h0)) fails.push(`the strip still names the right button / a brace: ${h0.split(' | ')[0]}`);
    if (!/span\.tag\.rings\{RING ×5\}/.test(h0) || /tag\.rings\.on/.test(h0)) fails.push('RING tag missing or lit with no attachment selected');
    pl.ocp.charge = 0.4; settle(1); const hLow = hudText(game); pl.ocp.charge = 1;
    if (!/span\.tag\.ocp\{OCP\}\(span\.ocpbar\(b\)\)/.test(hLow)) fails.push(`OCP at 40 %: ${(hLow.match(/span\.tag\.ocp[^)]*\)\)/) ?? ['?'])[0]} (want the tag dim — not .on — while it recharges)`);   // (this file's hudText drops inline widths; weapons-identity's card keeps the meter's %)
    pl.slot = 'rifle'; settle(40); input.pressed.add('Digit2'); settle(2); const hRing = hudText(game);
    if (!/div\.slot\.slung\.sel\(span\.key\{2\}[^|]*span\.tag\.on\{SEMI\}[^|]*span\.tag\.rings\.on\{RING ×5\}/.test(hRing)) fails.push(`row 2 with RING selected: ${hRing.split(' | ').find(x => /key\{2\}/.test(x))}`);
    input.pressed.add('Digit2'); settle(2);
    // the loadout off: row 2 greyed and named, 3 / 4 keep their numbers, 2 says so and selects nothing, 3 still throws smoke
    game.setLoadout(false); settle(4); const hOff = hudText(game); msgs.length = 0;
    if (!/div\.slot\.absent\(span\.key\{2\} span\.name\{FN2000\} span\{not in this kit\}\)/.test(hOff)) fails.push(`loadout off, row 2: ${hOff.split(' | ').find(x => /key\{2\}/.test(x))}`);
    if (pl.slot !== 'pistol') fails.push(`loadout off with the rifle selected left slot ${pl.slot}`);
    input.pressed.add('Digit2'); settle(2); if (pl.slot !== 'pistol' || !msgs.some(m => /no FN2000 in this loadout/.test(m))) fails.push(`2 with no rifle: slot ${pl.slot}, "${msgs.at(-1)}"`);
    input.pressed.add('Digit3'); settle(2); if (pl.slot !== 'smoke') fails.push(`3 with no rifle: slot ${pl.slot} (want smoke — the numbers do not close up)`);
    if (fistOf(game).rifle !== 'none') fails.push('rifle boxes drawn with the loadout off');
    game.setLoadout(true); pl.slot = 'pistol'; pl.holstered = false; settle(10);
    F.verdict(!fails.length, '(c) the column reads 1 Five-seveN · 2 FN2000 · 3 smoke · 4 stun; the OCP\'s charge is a tagged meter closing row 1 (lit when ready); the strip says nothing of the right button or a brace; RING lights only while selected; without the rifle row 2 stays, greyed "not in this kit", 2 says so, 3 is still smoke', fails.join('; ') || `fresh: ${h0.split(' | ').slice(2).join(' | ').slice(0, 330)}…`); }
  // (d) the right button's matrix — pistol + light = OCP; pistol + a man whose torch is out = nothing; pistol + a man with it lit = his torch (electronics too);
  //     rifle + no attachment = nothing (the one-time word over a light); rifle + RING = a ring, 5 → 4; the pace no slower with the rifle up
  { const fails: string[] = []; const tr: string[] = [];
    const light = game.targets.filter((t: any) => t.interactive && t.kind !== 'breaker' && t.factor > 0 && !t.broken).sort((a: any, b: any) => v3.distXZ(a.pos, pl.char.pos) - v3.distXZ(b.pos, pl.char.pos)).find((t: any) => { W.cursorAt(t.pos); W.step(DT); return game.aimTarget === t; });
    if (!light) fails.push('staging: no fixture near the corridor spot the reticle would snap to');
    else {
      // pistol + light
      pl.slot = 'pistol'; pl.holstered = false; settle(30); W.cursorAt(light.pos); W.step(DT);
      const able = ocpable(game); msgs.length = 0; W.cursorAt(light.pos); input.clicked |= 4; W.step(DT);
      tr.push(`pistol+light: ocpable ${able}, charge ${f2(pl.ocp.charge)}, "${msgs.at(-1) ?? ''}"`);
      if (!able || pl.ocp.charge > 0.05 || !(light.disabledUntil > game.time) || !msgs.some(m => /^OCP → /.test(m))) fails.push(`pistol + light: ocpable ${able}, charge ${f2(pl.ocp.charge)}, disabledUntil ${f2(light.disabledUntil)}, "${msgs.at(-1)}"`);
      pl.ocp.charge = 1; light.disabledUntil = -1;
      // rifle + no attachment over the same light: nothing but the word, once
      pl.slot = 'rifle'; rf.attIdx = -1; settle(40); msgs.length = 0; const rounds0 = rf.spent, rings0 = rf.rings;
      W.cursorAt(light.pos); W.step(DT); const ableR = ocpable(game);   // (true — the light IS ocp-able; the overlay words the ring by what is in the hand, player.ts keeps the button dead)
      W.cursorAt(light.pos); input.clicked |= 4; W.step(DT); W.cursorAt(light.pos); input.clicked |= 4; W.step(DT); settle(5);
      const words = msgs.filter(m => /the OCP is on the pistol/.test(m)).length;
      tr.push(`rifle+none+light: charge ${f2(pl.ocp.charge)}, rings ${rf.rings}, words ${words}`);
      if (pl.ocp.charge < 0.99 || rf.rings !== rings0 || rf.spent !== rounds0 || game.rings.length || words !== 1 || light.disabledUntil > 0) fails.push(`rifle + no attachment + RMB×2 over the light: charge ${f2(pl.ocp.charge)}, rings ${rings0}→${rf.rings}, rounds ${rounds0}→${rf.spent}, in the air ${game.rings.length}, the word ×${words} (want nothing at all but the word once)`);
      void ableR;
    }
    // a calm man 7 m ahead: torch out → nothing; torch lit → fried
    const A = game.guards[0]; A.hold = true; A.pinned = false; A.state = 'patrol'; A.awareness = 0; A.heardUpTo = 1e12;
    place(A, [pl.char.pos[0] + 7, 0, pl.char.pos[2]], -Math.PI / 2);
    pl.slot = 'pistol'; pl.holstered = false; pl.ocp.charge = 1; settle(30);
    const chestA = () => A.char.bones.chest ?? v3.add(A.char.pos, [0, 1.2, 0]);
    A.torchLostAt = game.time - 5; for (let f = 0; f < 3; f++) { W.cursorAt(chestA()); W.step(DT); }   // his torch knocked out earlier and dark on the floor: no light of his burns
    const snapped = game.aimGuard === A; const ableOff = ocpable(game); msgs.length = 0; const a0 = audio.length;
    W.cursorAt(chestA()); input.clicked |= 4; W.step(DT);
    const noise = audio.slice(a0).filter(a => a.name === 'ocp' || a.name === 'deny').map(a => a.name);
    tr.push(`pistol+man(torch out): snapped ${snapped}, ocpable ${ableOff}, charge ${f2(pl.ocp.charge)}, sounds ${JSON.stringify(noise)}, msgs ${msgs.length}`);
    if (!snapped) fails.push('staging: the reticle did not snap to the man');
    if (ableOff || pl.ocp.charge < 0.99 || noise.length || msgs.length || A.lightDeadUntil > 0) fails.push(`pistol + a man with no light: ocpable ${ableOff}, charge ${f2(pl.ocp.charge)}, sounds ${JSON.stringify(noise)}, "${msgs.at(-1) ?? ''}" (want no affordance and NOTHING happening)`);
    A.torchLostAt = -1; for (let f = 0; f < 3; f++) { W.cursorAt(chestA()); W.step(DT); }   // the torch back in his hand and lit
    const ableOn = ocpable(game); msgs.length = 0; W.cursorAt(chestA()); input.clicked |= 4; W.step(DT);
    tr.push(`pistol+man(torch lit): ocpable ${ableOn}, charge ${f2(pl.ocp.charge)}, "${msgs.at(-1) ?? ''}"`);
    if (!ableOn || pl.ocp.charge > 0.05 || !(A.lightDeadUntil > game.time) || !msgs.some(m => /flashlight fried/.test(m))) fails.push(`pistol + a man with his torch lit: ocpable ${ableOn}, charge ${f2(pl.ocp.charge)}, lightDeadUntil ${f2(A.lightDeadUntil)}, "${msgs.at(-1) ?? ''}" (want his torch knocked out — it is a light)`);
    pl.ocp.charge = 1; A.lightDeadUntil = -1;
    // rifle + RING on him: a ring away on the right button, a round on the left
    pl.slot = 'rifle'; pl.holstered = false; rf.attIdx = -1; settle(40); input.pressed.add('Digit2'); W.step(DT);
    const headA = () => A.char.bones.head; for (let f = 0; f < 3; f++) { W.cursorAt(headA()); W.step(DT); }
    const preview = pl.throwPreview?.points.length ?? 0; const rings0 = rf.rings, spent0 = rf.spent;
    W.cursorAt(headA()); input.clicked |= 4; W.step(DT); const inAir = game.rings.length; const rings1 = rf.rings;
    for (let f = 0; f < 40; f++) { W.cursorAt(headA()); W.step(DT); }
    tr.push(`rifle+RING+RMB: preview ${preview} pts, rings ${rings0}→${rings1}, in the air ${inAir}, him ${A.state}/${A.downKind ?? '—'}`);
    if (preview < 2 || rings1 !== rings0 - 1 || inAir !== 1 || rf.spent !== spent0) fails.push(`rifle + RING + a right click: preview ${preview}, rings ${rings0}→${rings1}, in the air ${inAir}, rounds ${spent0}→${rf.spent} (want the arc, one ring away, no round)`);
    if (A.state !== 'dead' || A.downKind !== 'struck' || !isBreathing(A)) fails.push(`the ring on his head left him ${A.state}/${A.downKind} (want out cold)`);
    // the left button with RING still selected: a round, not a ring
    const WALLPT: Vec3 = [pl.char.pos[0] + 6, 1.2, pl.char.pos[2] - 1.5]; game.infiniteAmmo = true;
    for (let f = 0; f < 60; f++) { W.cursorAt(WALLPT); W.step(DT); }   // (the launcher's own 0.9 s to cycle, and the trigger's beat after a ring)
    const rings2 = rf.rings, shots1 = rf.shotsFired; W.cursorAt(WALLPT); input.clicked |= 1; W.step(DT); settle(6);
    tr.push(`rifle+RING+LMB: rounds fired ${shots1}→${rf.shotsFired}, rings ${rings2}→${rf.rings}`);
    if (rf.shotsFired !== shots1 + 1 || rf.rings !== rings2) fails.push(`a LEFT click with RING selected: rounds fired ${shots1}→${rf.shotsFired}, rings ${rings2}→${rf.rings} (want a round, no ring)`);
    game.infiniteAmmo = false;
    // the pace: the rifle up walks at the pistol's walk (no brace cap any more), braced the whole way
    const walk = (k: 'pistol' | 'rifle') => { pl.slot = k; pl.holstered = false; game.teleportPlayer([18.0, 0, 11.5]); pl.char.bodyYaw = pl.char.aimYaw = Math.PI / 2; settle(40); let v = 0, bracedAll = true; input.keys.add('KeyD'); for (let f = 0; f < 50; f++) { W.cursorAt([30, 1.2, 11.5]); W.step(DT); v = Math.hypot(pl.char.vel[0], pl.char.vel[2]); if (k === 'rifle' && !pl.braced) bracedAll = false; } input.keys.delete('KeyD'); settle(20); return { v, bracedAll }; };
    const wp = walk('pistol'), wr = walk('rifle');
    tr.push(`walk: pistol ${f2(wp.v)} m/s · rifle ${f2(wr.v)} m/s braced throughout ${wr.bracedAll}`);
    if (Math.abs(wr.v - wp.v) > 0.05 || Math.abs(wp.v - game.tune.playerWalk) > 0.1 || !wr.bracedAll) fails.push(`walking east 50 frames: pistol ${f2(wp.v)} m/s, rifle ${f2(wr.v)} m/s (want both the walk's ${game.tune.playerWalk}), braced throughout ${wr.bracedAll}`);
    F.verdict(!fails.length, '(d) RMB: the pistol out on a light → the OCP fires (charge spent, the fixture out); on a man whose torch is out → no affordance and nothing at all happens; on a man with it lit → his torch goes (it is a light); the rifle up with no attachment → nothing, bar the one word over a light; with RING → one ring per press (5 → 4, the arc previewed, the man out cold) while the LEFT button still fires rounds; and the rifle costs no pace, braced the whole way',
      (fails.length ? '✗ ' + fails.join('\n    ✗ ') + '\n    ' : '') + tr.join('\n    ')); }
  // (e) the takedown's words: holstered, a click behind a calm man — out cold, breathing, said so in the log, on the body's row and on the card
  { const fails: string[] = [];
    game.clearAftermath(); game.resetGuards(); for (let f = 0; f < 3; f++) W.step(DT); game.guards.forEach((gd: any, i: number) => { if (i > 0) park(gd, i); });
    const B = game.guards[0]; B.hold = true; B.pinned = false; B.state = 'patrol'; B.awareness = 0; B.heardUpTo = 1e12;
    game.teleportPlayer([24.0, 0, 11.3]); pl.char.bodyYaw = pl.char.aimYaw = Math.PI / 2; pl.slot = 'pistol'; pl.holstered = true; place(B, [24.75, 0, 11.3], Math.PI / 2);
    const stats0 = { ...game.mission.stats }; msgs.length = 0;
    for (let f = 0; f < 10; f++) { W.cursorAt(v3.add(B.char.pos, [0, 1.4, 0])); W.step(DT); }
    const row = game.hover?.kind === 'guard' ? game.hover.line2 : '(no guard row)';
    W.cursorAt(v3.add(B.char.pos, [0, 1.4, 0])); input.clicked |= 1; for (let f = 0; f < 60; f++) W.step(DT);
    for (let f = 0; f < 5; f++) { W.cursorAt(v3.add(B.char.bones.hips ?? B.char.pos, [0, 0.2, 0])); W.step(DT); }
    const bodyRow = game.interactables.find((it: any) => it.kind === 'body' && it.guard === B)?.line1 ?? '(no body marker)';
    const s1 = game.mission.stats;
    if (!/LMB {2}takedown — silent/.test(row)) fails.push(`guard row holstered: "${row}"`);
    if (B.state !== 'dead' || B.downKind !== 'struck' || !isBreathing(B)) fails.push(`him: ${B.state}/${B.downKind} breathing ${isBreathing(B)}`);
    if (!msgs.some(m => /takedown — out cold, breathing/.test(m))) fails.push(`log: ${JSON.stringify(msgs.slice(-3))}`);
    if (!/out cold — breathing/.test(bodyRow)) fails.push(`body row: "${bodyRow}"`);
    if (s1.knockouts !== stats0.knockouts + 1 || s1.kills !== stats0.kills) fails.push(`card: knockouts ${stats0.knockouts}→${s1.knockouts}, kills ${stats0.kills}→${s1.kills}`);
    F.verdict(!fails.length, '(e) holstered + a click behind him: the row promised "LMB takedown — silent", he is \'struck\' and breathing, the log says "takedown — out cold, breathing (a knockout, not a kill)", his body\'s row says out cold — breathing, the card counts a knockout and no kill', fails.join('; ') || `row "${row}" · body "${bodyRow}" · "${msgs.find(m => /takedown/.test(m))}"`); }
  game.msg = origMsg;
  return F.done();
}

// ================================================================================================ the ring airfoil
/** a calm man `d` metres east of Sam in the corridor, facing `yaw`, hearing normally (`deaf` false) or not */
async function stageRing(seed: number, d = 8, yaw = Math.PI / 2, deaf = true) {
  const W = await stage(seed, true, [16.0, 0, 11.4]); const { game } = W;
  const A = game.guards[0]; A.hold = true; A.pinned = false; A.state = 'patrol'; A.awareness = 0; A.reactT = 0; if (deaf) A.heardUpTo = 1e12; else A.heardUpTo = game.eventSeq;
  place(A, [16.0 + d, 0, 11.4], yaw); W.step(DT);
  return { W, A };
}
export async function airfoilHead() {
  const F = family('airfoil-head: 2 again (RING), the reticle on a calm man 8 m off, a RIGHT click — the ring takes him in the head: out cold, breathing, quietly, and the ring is spent (a left click would have been a round)');
  const { W, A } = await stageRing(2101, 8, Math.PI / 2); const { game, input } = W; const pl = game.player, rf = pl.rifle;
  const audio = listen(W); const tap = eventTap(game); const stats0 = { ...game.mission.stats };
  input.pressed.add('Digit2'); W.step(DT); const modeMsg = game.messages.at(-1)?.text ?? '';   // the rifle is up (stage): its digit again = the attachment, none → RING
  const head = () => A.char.bones.head;
  for (let f = 0; f < 3; f++) { W.cursorAt(head()); W.step(DT); }
  const snapped = game.aimGuard === A; const preview = pl.throwPreview ? pl.throwPreview.points.length : 0;
  const items0 = new Set(game.items.items);
  W.cursorAt(head()); input.clicked |= 4; W.step(DT); tap.pump(); const inAir = game.rings.length; const ringsAfter = rf.rings;
  let resolvedAt = -1; for (let f = 0; f < 90; f++) { W.cursorAt(head()); W.step(DT); tap.pump(); if (resolvedAt < 0 && !game.rings.length) resolvedAt = f; }
  const newItems = game.items.items.filter((it: any) => !items0.has(it)).map((it: any) => it.kind);
  const props = tap.evs.filter(e => e.kind === 'prop'); const shots = tap.evs.filter(e => e.kind === 'shot' || e.kind === 'guardShot');
  const fails: string[] = [];
  if (rf.attachment !== 'ring' || !/ring airfoil/.test(modeMsg)) fails.push(`2 again: attachment ${rf.attachment}, "${modeMsg}"`);
  if (!snapped) fails.push('the reticle did not snap to him'); if (preview < 2) fails.push(`no arc previewed (${preview} points)`);
  if (inAir !== 1 || ringsAfter !== LAUNCHER.rings - 1) fails.push(`after the click: ${inAir} in the air, rings ${ringsAfter} (want 1, ${LAUNCHER.rings - 1})`);
  if (A.state !== 'dead' || A.downKind !== 'struck' || A.downBy !== 'player' || !isBreathing(A) || A.char.alive) fails.push(`him: ${A.state} ${A.downKind}/${A.downBy} breathing ${isBreathing(A)} alive ${A.char.alive}`);
  if (!newItems.includes('ring')) fails.push(`no spent ring on the floor (${JSON.stringify(newItems)})`);
  if (!newItems.includes('torch')) fails.push(`his torch was not laid down (${JSON.stringify(newItems)})`);
  if (shots.length) fails.push(`${shots.length} gunfire event(s) off a ring`);
  { const launch = props.find(e => Math.abs(e.level - RING.launchNoise) < 1e-6 && e.who === 1), ko = props.find(e => Math.abs(e.level - RING.koNoise) < 1e-6 && e.who === 1);
    if (!launch || !ko) fails.push(`prop events ${JSON.stringify(props.map(e => `${e.level}@who${e.who}`))} (want the launch ${RING.launchNoise}@Sam and the fold ${RING.koNoise}@Sam)`);
    if (props.some(e => e.level > 0.5)) fails.push('a prop event louder than 0.5 — the launcher is meant to be near silent'); }
  if (!audio.some(a => a.name === 'launcher')) fails.push('no launcher voice'); if (audio.some(a => a.name === 'rifleSuppressed')) fails.push('a rifle report played for a ring');
  { const s = game.mission.stats; if (s.knockouts !== stats0.knockouts + 1 || s.kills !== stats0.kills || s.shots !== stats0.shots) fails.push(`card: knockouts ${stats0.knockouts}→${s.knockouts}, kills ${stats0.kills}→${s.kills}, shots ${stats0.shots}→${s.shots} (want +1 / +0 / +0)`); }
  if (resolvedAt < 0 || resolvedAt > 30) fails.push(`the ring took ${resolvedAt} frames to arrive over 8 m (want ≤ 30 at 30 m/s)`);
  F.verdict(!fails.length, 'RING selected, snapped, previewed, one ring away on the right button (5 → 4): he folds \'struck\' by the player — breathing, his torch on the floor, dark — a 0.45 launch and a 0.3 fold at Sam and nothing louder, no gunfire event, a knockout not a kill, the ring lying there',
    fails.join('; ') || `resolved in ${resolvedAt} f · items ${JSON.stringify(newItems)} · props ${JSON.stringify(props.map(e => `${e.level}@${e.who}`))} · "${game.messages.at(-1)?.text}"`);
  return F.done();
}
export async function airfoilTorso() {
  const F = family('airfoil-torso: a ring in the body staggers — rooted, gun down, no round though Sam stands lit before him, a yelp — then ALERT toward where it came from; never damage');
  const { W, A } = await stageRing(2102, 8, -Math.PI / 2); const { game } = W; const pl = game.player;
  game.aiEnabled = true; A.hold = true; A.pinned = true; pl.visibility = 0.9;   // pinned + lit Sam in front of him: once alert he WOULD fire from where he stands — the stagger must hold the round
  const tap = eventTap(game); const lines: string[] = []; const origSay = game.say.bind(game); game.say = (gd: any, t: string, r = false) => { if (gd === A) lines.push(t); return origSay(gd, t, r); };
  const from = v3.add(pl.char.pos, [0.4, 1.3, 0]); const hips: Vec3 = v3.copy(A.char.bones.hips);
  const t0 = game.time; fireRing(game, pl.char, from, hips);
  let hitAt = -1, alertAt = -1, roundsWhile = 0, gunDownWhile = 0, staggerFrames = 0; const items0 = game.items.items.length;
  for (let f = 0; f < 200; f++) {
    pl.visibility = 0.9; W.step(DT); tap.pump();
    if (hitAt < 0 && A.staggerUntil > game.time) hitAt = f;
    const staggered = game.time < A.staggerUntil;
    if (staggered) { staggerFrames++; if (A.char.anim.upper === 'none') gunDownWhile++; roundsWhile += tap.evs.filter(e => e.kind === 'guardShot').length; }
    tap.evs.length = 0;
    if (alertAt < 0 && A.state === 'alert') alertAt = f;
  }
  const fails: string[] = [];
  if (hitAt < 0) fails.push('the ring at his hips never registered (no stagger)');
  if (A.state === 'dead' || !A.char.alive) fails.push(`he went down (${A.downKind}) — a body hit must never do damage`);
  const staggerSecs = staggerFrames * DT;
  if (Math.abs(staggerSecs - RING.stagger) > 0.1) fails.push(`staggered ${f2(staggerSecs)} s (want ${RING.stagger})`);
  if (roundsWhile) fails.push(`${roundsWhile} round(s) from him while staggered`);
  if (gunDownWhile < staggerFrames - 3) fails.push(`gun down on ${gunDownWhile}/${staggerFrames} staggered frames`);
  if (alertAt < 0) fails.push(`never went alert (state ${A.state}, awareness ${f2(A.awareness)})`);
  const pool = new Set(staggerLines()); const yelp = lines.find(l => pool.has(l));
  if (!yelp) fails.push(`no yelp from the pool (said ${JSON.stringify(lines)})`);
  { const lk = A.lastKnown; const dSam = lk ? v3.distXZ(lk, pl.char.pos) : 99, dHim = v3.distXZ(A.char.pos, pl.char.pos); if (!lk || !(dSam < dHim)) fails.push(`his fix ${lk ? `(${f2(lk[0])}, ${f2(lk[2])}) ${f2(dSam)} m from Sam` : 'null'} — want it on the shooter's side (nearer Sam than his own ${f2(dHim)} m)`); }
  { const hitEv = tap.evs.length; void hitEv; }
  if (game.items.items.length !== items0 + 1 || game.items.items.at(-1)?.kind !== 'ring') fails.push('no spent ring dropped at his feet');
  F.verdict(!fails.length, `hips at 8 m: staggered ${f2(staggerSecs)} s from f${hitAt} (gun down, ${roundsWhile} rounds), "${yelp ?? '—'}", alert at f${alertAt}, alive — his fix put back up the ring's line toward Sam`,
    fails.join('; ') || `lines ${JSON.stringify(lines.slice(0, 3))} · lastKnown (${f2(A.lastKnown?.[0] ?? NaN)}, ${f2(A.lastKnown?.[2] ?? NaN)}) · Sam at (${f2(pl.char.pos[0])}, ${f2(pl.char.pos[2])})`);
  game.say = origSay;
  return F.done();
}
export async function airfoilMiss() {
  const F = family('airfoil-miss: a ring off the wall four metres from a calm man is a clack nobody made — he goes to look at IT, not at Sam; the ring lies under the mark');
  const { W, A } = await stageRing(2103, 9, Math.PI / 2, false); const { game } = W; const pl = game.player;
  game.aiEnabled = true; A.hold = false;
  // a wall point ~4 m from him: the corridor's north wall (z ≈ 10) level with a spot 4 m short of him
  const wallPt: Vec3 = [A.char.pos[0] - 3.0, 1.0, 10.05];
  const tap = eventTap(game); const audio = listen(W);
  const from = v3.add(pl.char.pos, [0.4, 1.3, 0]); fireRing(game, pl.char, from, wallPt);
  let clack: any = null; const aw0 = A.awareness;
  for (let f = 0; f < 120; f++) { W.step(DT); tap.pump(); clack ??= tap.evs.find(e => e.kind === 'prop' && e.who === 0 && Math.abs(e.level - RING.clackNoise) < 0.2); }
  const ring = game.items.items.find((it: any) => it.kind === 'ring');
  const fails: string[] = [];
  if (!clack) fails.push(`no clack event (props ${JSON.stringify(tap.evs.filter(e => e.kind === 'prop').map(e => `${e.level}@${e.who}`))})`);
  else if (v3.distXZ(clack.pos, wallPt) > 1.0) fails.push(`the clack was ${f2(v3.distXZ(clack.pos, wallPt))} m from the mark`);
  if (!audio.some(a => a.name === 'canisterBounce')) fails.push('no clack sound');
  if (!ring) fails.push('no ring item'); else if (v3.distXZ(ring.pos, wallPt) > 2.5) fails.push(`the ring lies ${f2(v3.distXZ(ring.pos, wallPt))} m from the mark`);
  if (!(A.awareness > aw0 + 0.05)) fails.push(`his awareness ${f2(aw0)} → ${f2(A.awareness)} (want it up: he heard it)`);
  { const lk = A.lastKnown; if (!lk) fails.push('no fix at all'); else if (v3.distXZ(lk, pl.char.pos) < v3.distXZ(lk, wallPt)) fails.push(`his fix (${f2(lk[0])}, ${f2(lk[2])}) is nearer Sam than the clack — the noise should pull him to IT`); }
  if (A.state === 'dead' || A.state === 'alert') fails.push(`he is ${A.state} off a clack`);
  F.verdict(!fails.length, `a 'prop' ${RING.clackNoise} with who 0 at the wall, the ping, the ring on the floor by it; the man 4 m off pricks up (awareness ${f2(aw0)} → ${f2(A.awareness)}, ${A.state}) with his fix by the wall, not on Sam`,
    fails.join('; ') || `clack at (${f2(clack.pos[0])}, ${f2(clack.pos[2])}) · ring at (${f2(ring.pos[0])}, ${f2(ring.pos[2])}) · his fix (${f2(A.lastKnown?.[0] ?? NaN)}, ${f2(A.lastKnown?.[2] ?? NaN)})`);
  return F.done();
}
export async function airfoilPreview() {
  const F = family('airfoil-preview: the previewed arc IS the flight — a real ring stays within 5 cm of ringSolve\'s polyline and ends within 15 cm of its landing');
  const W = await stage(2104, true, [16.0, 0, 11.4]); const { game } = W; const pl = game.player;
  const results: string[] = []; const fails: string[] = [];
  for (const [label, target] of [['level, 14 m down the corridor', [30.0, 1.3, 11.4]], ['lobbed at the far floor', [29.0, 0.1, 11.6]], ['up at the ceiling line 10 m off', [26.0, 2.7, 11.2]]] as [string, Vec3][]) {
    const from = v3.add(pl.char.pos, [0.4, 1.3, 0]);
    const sol = ringSolve(game, from, target);
    const ring = fireRing(game, pl.char, from, target);
    let worst = 0; let endP: Vec3 | null = null; const items0 = game.items.items.length;
    for (let f = 0; f < 120 && game.rings.includes(ring); f++) {
      W.step(DT);
      if (game.rings.includes(ring)) { let best = Infinity; for (let i = 0; i + 1 < sol.points.length; i++) best = Math.min(best, distToSeg(ring.pos, sol.points[i], sol.points[i + 1])); if (Number.isFinite(best)) worst = Math.max(worst, best); }
    }
    const it = game.items.items.length > items0 ? game.items.items[items0] : null; endP = it ? it.pos : null;
    // the item has already begun to bounce by the time we read it: compare the polyline's land against where the item was SPAWNED — its first recorded pos is within a frame of the impact
    const endOff = endP ? v3.dist(endP, sol.land) : Infinity;
    results.push(`${label}: worst ${f3(worst)} m off the arc, ended ${f2(endOff)} m from land (${sol.points.length} pts)`);
    if (worst > 0.05) fails.push(`${label}: ${f3(worst)} m off the arc`);
    if (endOff > 0.15 + 0.3) fails.push(`${label}: ended ${f2(endOff)} m from the previewed landing`);   // (+0.3: a frame or two of the item's own bounce off the impact before it is read)
    for (let f = 0; f < 30; f++) W.step(DT);
  }
  F.verdict(!fails.length, 'three arcs (level, lobbed low, up at the ceiling): the ring flies the line the overlay drew', (fails.length ? '✗ ' + fails.join('\n    ✗ ') + '\n    ' : '') + results.join('\n    '));
  return F.done();
}
function distToSeg(p: Vec3, a: Vec3, b: Vec3): number { const ab = v3.sub(b, a); const L2 = v3.dot(ab, ab); if (L2 < 1e-9) return v3.dist(p, a); const t = Math.max(0, Math.min(1, v3.dot(v3.sub(p, a), ab) / L2)); return v3.dist(p, v3.mad(a, ab, t)); }
export async function airfoilHostage() {
  const F = family('airfoil-hostage: a ring fired at the pair from in front strikes whoever it meets first — the held man: he goes down \'struck\' by that hand, the hold ends, Sam is untouched');
  const W = await stage(2105, false, [16.0, 0, 11.4]); const { game, input } = W; const pl = game.player;
  // a corridor spot with no door row within the panel's 3 m (a door listed before the man stands there keeps the highlight — the player's ↓ moves it; the probe just stands clear)
  let sx = 16.0; for (const x of [16, 17.5, 19, 20.5, 22, 23.5, 25, 26.5, 13, 11.5]) { const p: Vec3 = [x, 0, 11.4]; if (!game.col.nav.isBlocked(x, 11.4) && !game.col.nav.isBlocked(x + 0.75, 11.4) && game.doors.list.every((d: any) => v3.distXZ(d.pos, p) > 3.4 && v3.distXZ(d.frameCentre, p) > 3.4)) { sx = x; break; } }
  game.teleportPlayer([sx, 0, 11.4]); pl.char.bodyYaw = pl.char.aimYaw = Math.PI / 2; W.step(DT);
  const [A, B] = game.guards; for (const g2 of [A, B]) { g2.hold = true; g2.pinned = false; g2.state = 'patrol'; g2.awareness = 0; g2.heardUpTo = 1e12; }
  place(A, [sx + 0.75, 0, 11.4], Math.PI / 2);   // A just ahead of Sam, facing away: grab him
  place(B, [sx + 8, 0, 11.4], -Math.PI / 2);     // B eight metres on, facing the pair — the ring's shooter (any Character may fire one)
  for (let f = 0; f < 5; f++) { W.cursorAt(v3.add(A.char.pos, [0, 1.4, 0])); W.step(DT); }
  const hoverKind = game.hover?.kind;
  input.pressed.add('Space'); for (let f = 0; f < 60; f++) { W.cursorAt(v3.add(A.char.pos, [0, 1.4, 0])); W.step(DT); }
  const holding = pl.holding?.g === A && pl.holding.phase === 'held';
  const msgs: string[] = []; const orig = game.msg.bind(game); game.msg = (t: string) => { msgs.push(t); return orig(t); };
  let samFlinched = false; const origHit = pl.char.anim.hit.bind(pl.char.anim); pl.char.anim.hit = () => { samFlinched = true; origHit(); };
  const from = v3.add(B.char.pos, [0, 1.35, 0]); const samHead = v3.copy(pl.char.bones.head);
  fireRing(game, B.char, from, samHead);
  for (let f = 0; f < 60; f++) W.step(DT);
  game.msg = orig;
  const fails: string[] = [];
  if (!holding) fails.push(`staging: the grab did not take (hover ${hoverKind}, spot x ${sx})`);
  if (A.state !== 'dead' || A.downKind !== 'struck' || A.downBy !== 'guard') fails.push(`the held man: ${A.state} ${A.downKind}/${A.downBy} (want dead struck by guard)`);
  if (pl.holding) fails.push(`the hold is still on (${pl.holding.phase})`);
  if (samFlinched || msgs.some(m => /ring airfoil off the side of your head|in the ribs/.test(m))) fails.push('the ring reached Sam behind his shield');
  if (pl.down) fails.push('Sam is down');
  F.verdict(!fails.length, 'B\'s ring at Sam\'s head from 7 m in front of the pair takes A — in the arm, between them — in the head: A struck by \'guard\', the arm comes off a downed man, Sam never touched', fails.join('; ') || `spot x ${sx} · A ${A.state}/${A.downKind}/${A.downBy} · hold ${pl.holding ? pl.holding.phase : 'over'} · log ${JSON.stringify(msgs.slice(-2))}`);
  return F.done();
}

// ================================================================================================ how it is held: the sway, the two hands, the sling
/** the support hand's grip point in the world off the POSED trigger hand: the real right wrist + RIG.sc20k's foregrip point through the gun frame rigProps draws the
 *  weapon in (z = wrist → middle finger, y = up ⊥ it) — carbine-probes' gripPointL with the bullpup's numbers */
function sc20kGripPoint(c: any): Vec3 {
  const d = v3.normalize(v3.sub(c.bones.fingerR, c.bones.handR)); const yW = v3.normalize(v3.mad([0, 1, 0], d, -d[1])); const xW = v3.cross(yW, d); const G = sc20kGrip().wrist;
  return v3.add(c.bones.handR, v3.mad(v3.mad(v3.scale(xW, G[0]), yW, G[1]), d, G[2]));
}
const bonesFinite = (c: any) => Object.values(c.bones).every((p: any) => p.every(Number.isFinite));
const pp = (a: number[]) => a.length ? Math.max(...a) - Math.min(...a) : 0;
export async function rifleCarry() {
  const F = family('rifle-carry: the SC-20K steadied in the hands (side-to-side per stride bounded, both hands on it through sprint / stop / walk / crouch and off a wall), and slung flat on the back');
  const ch = await loadCharacter(); const R2D = 180 / Math.PI;
  // ---- (1) the sway, off a bare Character driven as player.ts drives him (armRifle: longSteady 1, the carriage forced), 120 Hz, measured over whole strides after 2.5 s
  //          of settling: the POSED muzzle's side-to-side (model x) peak-to-peak, the posed bore's yaw wobble, the support hand's worst distance off its grip point,
  //          the shoulder line's yaw swing — against the same run with the steadying off (longSteady 0: how the guards' riflemen still carry theirs)
  {
    const dt = 1 / 120;
    const drive = (stance: string, speed: number, crouch: number, upper: string, steady: number) => {
      const c = new Character(ch, { id: 1, tint: [0, 0, 0], tint2: [0, 0, 0], pos: [0, 0, 0], yaw: 0 }); const an: any = c.anim;
      an.phase = 0; an.speed = speed; an.crouchTarget = crouch; an.upper = upper; an.longGun = true; an.longStance = stance; an.longSteady = steady; an.longGrip = sc20kGrip(); c.muzzleAhead = sc20kMuzzleAhead();
      const adv = () => { c.pos = [0, 0, c.pos[2] + speed * dt]; c.update(dt); };
      for (let i = 0; i < Math.round(2.5 / dt); i++) adv();
      let prev = an.phase, wraps = 0, nan = false, gap = 0; const mx: number[] = [], yaw: number[] = [], shy: number[] = []; const shown = new Set<string>();
      for (let i = 0; i * dt < (speed > 0.05 ? 30 : 3) && wraps < 4; i++) {
        adv(); if (an.phase - prev < -0.5) wraps++; prev = an.phase; if (wraps < 1 && speed > 0.05) continue;   // (standing: no stride to wait for — three seconds of the idle as it comes)
        if (!bonesFinite(c)) nan = true;
        const b = c.bones; const hd = v3.normalize(v3.sub(b.fingerR, b.handR));
        mx.push(v3.mad(b.handR, hd, c.muzzleAhead)[0]); yaw.push(Math.atan2(hd[0], hd[2]) * R2D); shy.push(Math.atan2(b.upperArmR[2] - b.upperArmL[2], b.upperArmL[0] - b.upperArmR[0]) * R2D);
        gap = Math.max(gap, v3.dist(b.handL, sc20kGripPoint(c))); shown.add(String(an.longShown));
      }
      return { lat: pp(mx) * 100, yaw: pp(yaw), shYaw: pp(shy), gap: gap * 100, nan, shown: [...shown].join('/') };
    };
    // [carriage, speed, crouch, upper as player.ts leaves it (the shouldered gun brings the aim trunk itself), muzzle side-to-side bound cm, shoulder-line swing bound °]
    const cases: [string, string, number, number, string, number, number][] = [
      ['crouch-walk 1.3, shouldered', 'shoulder', 1.3, 1, 'none', 3.0, 15], ['walk 1.55, shouldered', 'shoulder', 1.55, 0, 'none', 1.5, 15], ['walk 1.55, shouldered, aim layer', 'shoulder', 1.55, 0, 'aim', 1.5, 15],
      ['jog 3.3, shouldered', 'shoulder', 3.3, 0, 'none', 2.0, 15], ['sprint 4.7, low ready', 'lowLong', 4.7, 0, 'none', 2.5, 20], ['sprint 4.7, port (a leaf ahead)', 'portLong', 4.7, 0, 'none', 3.5, 20], ['standing, shouldered', 'shoulder', 0, 0, 'none', 9, 5],
    ];
    const fails: string[] = [], notes: string[] = [];
    for (const [name, st, sp, cr, up, latMax, shMax] of cases) {
      const on = drive(st, sp, cr, up, 1), off = drive(st, sp, cr, up, 0);
      if (on.nan) fails.push(`${name}: a NaN bone`);
      if (on.shown !== st) fails.push(`${name}: shows ${on.shown}, not ${st}`);
      if (on.lat > latMax) fails.push(`${name}: muzzle side-to-side ${on.lat.toFixed(1)} cm p-p (bound ${latMax})`);
      if (on.gap > 4) fails.push(`${name}: support hand ${on.gap.toFixed(1)} cm off the foregrip at worst`);
      if (on.shYaw > shMax) fails.push(`${name}: shoulder line swings ${on.shYaw.toFixed(0)}° p-p (bound ${shMax})`);
      if (on.yaw > 1.5) fails.push(`${name}: posed bore yaw wobbles ${on.yaw.toFixed(2)}° p-p`);
      notes.push(`${name}: muzzle ${on.lat.toFixed(1)} cm p-p (unsteadied ${off.lat.toFixed(1)}), bore yaw ${on.yaw.toFixed(2)}° (${off.yaw.toFixed(2)}), hand off grip ≤ ${on.gap.toFixed(1)} cm (${off.gap.toFixed(1)}), shoulder line ${on.shYaw.toFixed(0)}° p-p (${off.shYaw.toFixed(0)})`);
    }
    F.verdict(!fails.length, `(1) steadied (LONG_STEADY tau ${LONG_STEADY.tau} / runYaw ${LONG_STEADY.runYaw}): the muzzle's side-to-side per stride under its bound in every player carriage × gait, the support hand within 4 cm of the foregrip throughout, the shoulder line held at a run, no NaN`, (fails.length ? '✗ ' + fails.join('\n    ✗ ') + '\n    ' : '') + notes.join('\n    '));
  }
  // ---- (2) both hands on it through the transitions, through the REAL input path: 4, then sprint 2 s → stop → 1.5 s still → walk 1 s → crouch-walk 1 s → stand; then a
  //          wall hug (Q) and off it (Q) and the same again — every frame the rifle is drawn in the hand: the animator has the long gun, the carriage is one of the
  //          player's three, and the support hand is within 4 cm of its grip point (3 frames' grace after each frame the rifle changes place or the sprint toggles)
  {
    const W = await stage(2011, true, [21.5, 0, 11.5]); const { game, input } = W; const pl = game.player, an = pl.char.anim, c = pl.char;
    const AHEAD: Vec3 = [27.5, 1.2, 11.5];
    const fails: string[] = [], notes: string[] = []; let frames = 0, worstGap = 0, worstAt = '', graceLeft = 0, lastWhere = 'hand', lastSprint = false, oneHandFrames = 0;
    const shownSeen = new Set<string>();
    const tick = (tag: string, each?: () => void) => {
      each?.(); W.cursorAt(AHEAD); W.step(DT); frames++;
      const where = rifleBoxes(game).where; if (where !== lastWhere || pl.sprinting !== lastSprint) graceLeft = 3; lastWhere = where; lastSprint = pl.sprinting;
      if (where !== 'hand') { graceLeft = Math.max(0, graceLeft - 1); return; }
      if (!bonesFinite(c)) fails.push(`${tag} f${frames}: NaN bone`);
      if (!an.longGun) fails.push(`${tag} f${frames}: rifle drawn in the hand but the animator has no long gun`);
      shownSeen.add(String(an.longShown));
      if (an.longShown !== 'shoulder' && an.longShown !== 'lowLong' && an.longShown !== 'portLong') fails.push(`${tag} f${frames}: carriage ${an.longShown} with the rifle in the hands`);
      const gap = v3.dist(c.bones.handL, sc20kGripPoint(c));
      if (graceLeft > 0) { graceLeft--; return; }
      if (gap > worstGap) { worstGap = gap; worstAt = `${tag} f${frames} (${an.longShown}, upper ${an.upper}${pl.sprinting ? ', sprinting' : ''})`; }
      if (gap > 0.04) oneHandFrames++;
    };
    const phase = (tag: string, n: number, each?: () => void) => { for (let i = 0; i < n; i++) tick(tag, each); notes.push(`${tag}: ${an.longGun ? an.longShown : 'slung'}${pl.sprinting ? ' (sprinting)' : ''}`); };
    phase('drawn, still', 30);
    input.keys.add('ShiftLeft'); input.keys.add('KeyD'); phase('sprint 2 s', 120); input.keys.delete('ShiftLeft'); input.keys.delete('KeyD');
    phase('stopped 1.5 s', 90);
    input.keys.add('KeyD'); phase('walk 1 s', 60);
    pl.crouch = true; phase('crouch-walk 1 s', 60); input.keys.delete('KeyD'); phase('crouched still', 40); pl.crouch = false; phase('stand', 30);
    input.keys.add('ShiftLeft'); input.keys.add('KeyA'); phase('sprint back 1.5 s', 90); input.keys.delete('ShiftLeft'); input.keys.delete('KeyA'); phase('stopped again', 60);
    // the wall: the corridor's north wall at z ≈ 10 — hug it (the rifle goes to the sling), come off it (back into the hands), then move about: before the fix the
    // wall hold's stale share switched the long-gun solve off for good here and the rifle hung from one hand in every un-aimed state
    game.teleportPlayer([21.5, 0, 10.7]); c.bodyYaw = c.aimYaw = 0; phase('at the wall', 10);
    input.pressed.add('KeyQ'); phase('Q: on the wall (slung)', 50);
    if (!pl.wall || !pl.holstered || rifleBoxes(game).where !== 'back') fails.push(`the wall hug did not take / did not sling it (wall ${!!pl.wall}, holstered ${pl.holstered}, rifle at the ${rifleBoxes(game).where})`);
    input.pressed.add('KeyQ'); phase('Q: off the wall (in the hands)', 60);
    if (pl.wall || pl.holstered || rifleBoxes(game).where !== 'hand') fails.push(`coming off the wall did not put it back in the hands (wall ${!!pl.wall}, holstered ${pl.holstered}, rifle at the ${rifleBoxes(game).where})`);
    game.teleportPlayer([21.5, 0, 11.5]); c.bodyYaw = c.aimYaw = Math.PI / 2; phase('after the wall, still', 60);
    input.keys.add('KeyD'); phase('after the wall, walking', 60); input.keys.delete('KeyD');
    input.keys.add('ShiftLeft'); input.keys.add('KeyD'); phase('after the wall, sprinting', 60); input.keys.delete('ShiftLeft'); input.keys.delete('KeyD'); phase('after the wall, stopped', 60);
    pl.crouch = true; input.keys.add('KeyA'); phase('after the wall, crouch-walking', 60); input.keys.delete('KeyA'); pl.crouch = false; phase('end', 20);
    if (oneHandFrames > 0) fails.push(`${oneHandFrames} frames with the support hand more than 4 cm off the foregrip — worst ${(worstGap * 100).toFixed(1)} cm at ${worstAt}`);
    if (shownSeen.has('patrolLong')) fails.push('the calm carry (patrolLong) showed on the player');
    F.verdict(!fails.length, `(2) ${frames} frames of sprint → stop → walk → crouch-walk → sprint → stop, then Q on / Q off a wall and all of it again: the long gun armed and the carriage one of shoulder / lowLong / portLong on every frame it is drawn in the hand, the support hand within 4 cm of the foregrip on every one past 3 frames' grace a toggle`,
      (fails.length ? '✗ ' + fails.join('\n    ✗ ') + '\n    ' : '') + `worst support-hand gap ${(worstGap * 100).toFixed(1)} cm at ${worstAt || '—'} · carriages seen ${[...shownSeen].join('/')} · ` + notes.filter((_, i) => i % 2 === 0).join(' | '));
  }
  // ---- (3) slung: flat ON the back — against the skinned MESH (meshbvh.ts skinCorners off the live jointData + a brute nearest-hit; the shadow capsules stand ~10 cm
  //          proud of the skin behind and would pass a rifle floating a hand off the back — the top-down 'plank'). A bare Character posed standing / pistol drawn /
  //          walking / crouched / crouch-walking / jogging / sprinting / at a kick's impact / aiming steeply down; per pose (three frames of the moving ones): the eleven
  //          slung boxes finite; the GAP between the rifle's body-side face and the skin, sampled every 7 cm from over the right shoulder blade to the fore-end where it crosses
  //          the waist (rays in toward the spine line): nearest within [lo, 4.5] cm (lo 0.5 still, 0.3 moving, the kick −2: the blade comes back into it for a frame), furthest ≤ 10.5 (the
  //          back is convex along the diagonal — it rests over the shoulder blade, bridges the small of the back, and its top stands off the slope of the trapezius); no box's middle over 20 cm off the spine line sideways
  //          (the torso's own left: hip and shoulder lines averaged); ROLLED flat — the hull's across axis within 8° of the hips-shoulders plane's normal taken square to
  //          the bore (20° sprinting: that clip wrings the trunk) — and the bore within 16° of that plane (22° sprinting); clear of the head capsule
  {
    const B = await import(`${ROOT}/src/render/meshbvh.ts`); const mesh = ch.mesh; const bvh = B.buildMeshBvh(mesh.positions, mesh.indices);
    const segDist = (p: Vec3, a: Vec3, b: Vec3) => { const ab = v3.sub(b, a), ap = v3.sub(p, a); const t = Math.max(0, Math.min(1, v3.dot(ap, ab) / Math.max(1e-9, v3.dot(ab, ab)))); return v3.dist(p, v3.mad(a, ab, t)); };
    const NAMES = ['hull', 'butt', 'mag', 'grip', 'fore', 'supp', 'rail', 'optic', 'foregrip', 'light', 'lens'];
    const ZS = [-0.16, -0.09, -0.02, 0.05, 0.12, 0.19, 0.26];   // along the bore from the group origin: from over the right shoulder blade (above that — the hull's top 13 cm and the butt — stands off behind the shoulder, where there is no back) down to the fore-end over the waist (the can beyond runs off past the hip)
    const halfAt = (z: number) => z < 0.12 ? RIG.sc20k.hull.thick : RIG.sc20k.fore.thick;
    const poses: { name: string; speed: number; crouch: number; upper: string; kick?: boolean; pitch?: number; lo: number; hi?: number; roll: number; tilt?: number; frames: number[] }[] = [
      { name: 'idle', speed: 0, crouch: 0, upper: 'none', lo: 0.5, roll: 8, frames: [30] }, { name: 'pistol drawn', speed: 0, crouch: 0, upper: 'relaxed', lo: 0.3, roll: 8, frames: [30] },
      { name: 'walk 1.55', speed: 1.55, crouch: 0, upper: 'relaxed', lo: 0.3, roll: 8, frames: [20, 45, 70] }, { name: 'crouched', speed: 0, crouch: 1, upper: 'relaxed', lo: 0.5, roll: 8, frames: [30] },
      { name: 'crouch-walk 1.3', speed: 1.3, crouch: 1, upper: 'relaxed', lo: 0.3, roll: 8, frames: [20, 50, 80] }, { name: 'jog 3.3', speed: 3.3, crouch: 0, upper: 'relaxed', lo: 0.3, roll: 8, frames: [15, 30, 45] },
      { name: 'sprint 4.7', speed: 4.7, crouch: 0, upper: 'none', lo: 0.3, hi: 12, roll: 20, tilt: 22, frames: [12, 24, 36] }, { name: 'kick (impact)', speed: 0, crouch: 0, upper: 'relaxed', kick: true, lo: -2, roll: 8, frames: [24] },
      { name: 'aiming 45° down', speed: 0, crouch: 0, upper: 'aim', pitch: -0.78, lo: 0.5, hi: 15, roll: 8, frames: [40] },   // (the trunk pitched 16° and twisted onto the aim: the shoulder blade comes forward off the top of it)
    ];
    const fails: string[] = [], notes: string[] = [];
    for (const P of poses) {
      const c = new Character(ch, { id: 1, tint: [0, 0, 0], tint2: [0, 0, 0], pos: [2, 0, 3], yaw: 0.7 }); const an: any = c.anim;
      an.phase = 0; an.speed = P.speed; an.crouchTarget = P.crouch; an.upper = P.upper; c.aimPitch = P.pitch ?? 0;
      const fwd = c.forward(); const adv = () => { c.pos = v3.mad(c.pos, fwd, P.speed * DT); c.update(DT); };
      for (let i = 0; i < 90; i++) adv(); if (P.kick) an.kickDoor();
      let lo = 9, hi = -9, lat = 0, latWhat = '', rollOff = 0, tilt = 0, head = -9, finite = true, f = 0;
      for (const stopAt of P.frames) {
        while (f < stopAt) { adv(); f++; }
        const out: any[] = []; sc20kBoxes(c, out, RIG.sc20k, 'slung');
        if (out.length !== 11 || !out.every((bx: any) => [...bx.c, ...bx.h, ...(bx.rot ?? [])].every(Number.isFinite))) { finite = false; break; }
        const b = c.bones; const shMid = v3.lerp(b.upperArmL, b.upperArmR, 0.5); const upS = v3.normalize(v3.sub(shMid, b.hips));
        let left = v3.lerp(v3.normalize(v3.sub(b.thighL, b.thighR)), v3.normalize(v3.sub(b.upperArmL, b.upperArmR)), 0.5); left = v3.normalize(v3.mad(left, upS, -v3.dot(left, upS)));
        const planeN = v3.normalize(v3.cross(v3.sub(b.upperArmL, b.hips), v3.sub(b.upperArmR, b.hips)));
        const headA = b.neck, headB = v3.mad(b.head, quat.rotate(c.headRot(), [0, 1, 0]), 0.13);
        // sideways spread, roll flatness, bore tilt, the head
        out.forEach((bx: any, i: number) => {
          const d = v3.sub(bx.c, b.hips); const on = v3.mad(b.hips, upS, v3.dot(d, upS)); const l = Math.abs(v3.dot(v3.sub(bx.c, on), left)); if (l > lat) { lat = l; latWhat = NAMES[i]; }
          for (const s of [-1, 0, 1]) head = Math.max(head, 0.105 - segDist(v3.mad(bx.c, quat.rotate(bx.rot, [0, 0, 1]), s * bx.h[2]), headA, headB));
        });
        const hull = out[0]; const gx = quat.rotate(hull.rot, [1, 0, 0]), gz = quat.rotate(hull.rot, [0, 0, 1]);
        const nSq = v3.mad(planeN, gz, -v3.dot(planeN, gz)); rollOff = Math.max(rollOff, Math.acos(Math.min(1, Math.abs(v3.dot(gx, v3.normalize(nSq))))) * R2D);
        tilt = Math.max(tilt, Math.asin(Math.min(1, Math.abs(v3.dot(gz, planeN)))) * R2D);
        // the gap to the skin along the length
        const tv = B.skinCorners(bvh, mesh.positions, mesh.joints, mesh.weights, new Float32Array(c.skel.jointData));
        const origin = v3.mad(hull.c, gz, -(RIG.sc20k.hull.l0 + RIG.sc20k.hull.l1) / 2);
        const onSpine = (p: Vec3): Vec3 => { const d = v3.sub(p, b.hips); return v3.mad(b.hips, upS, Math.max(-0.1, Math.min(v3.dist(b.hips, shMid) + 0.1, v3.dot(d, upS)))); };
        const toward = v3.dot(v3.sub(onSpine(origin), origin), gx) > 0 ? 1 : -1;
        for (const z of ZS) {
          const p = v3.mad(v3.mad(origin, gz, z), gx, toward * halfAt(z)); const tgt = onSpine(p); const dir = v3.normalize(v3.sub(tgt, p)); const L = v3.dist(p, tgt);
          const t = B.bruteNearest(bvh, tv, p, dir, L); let gap: number;
          if (t >= 0) gap = t; else { const t2 = B.bruteNearest(bvh, tv, p, v3.scale(dir, -1), 0.3); gap = t2 >= 0 ? -t2 : NaN; }
          if (Number.isFinite(gap)) { lo = Math.min(lo, gap); hi = Math.max(hi, gap); }
        }
      }
      if (!finite) { fails.push(`${P.name}: a non-finite / missing slung box`); continue; }
      if (lo * 100 < P.lo) fails.push(`${P.name}: the rifle's inner face comes ${(lo * 100).toFixed(1)} cm ${lo < 0 ? 'INTO' : 'off'} the skin at its nearest (want ≥ ${P.lo})`);
      if (lo * 100 > 4.5) fails.push(`${P.name}: nowhere nearer the skin than ${(lo * 100).toFixed(1)} cm (want ≤ 4.5: on the back, not floating off it)`);
      if (hi * 100 > (P.hi ?? 10.5)) fails.push(`${P.name}: ${(hi * 100).toFixed(1)} cm off the skin at its furthest over the torso (want ≤ ${P.hi ?? 10.5})`);
      if (lat > 0.20) fails.push(`${P.name}: the ${latWhat}'s middle ${(lat * 100).toFixed(1)} cm off the spine line sideways (want ≤ 20)`);
      if (rollOff > P.roll) fails.push(`${P.name}: rolled ${rollOff.toFixed(0)}° off side-flat (want ≤ ${P.roll})`);
      if (tilt > (P.tilt ?? 16)) fails.push(`${P.name}: the bore ${tilt.toFixed(0)}° out of the back's plane (want ≤ ${P.tilt ?? 16})`);
      if (head > 0) fails.push(`${P.name}: ${(head * 100).toFixed(1)} cm into the head capsule`);
      notes.push(`${P.name}: skin gap ${(lo * 100).toFixed(1)}‥${(hi * 100).toFixed(1)} cm, widest ${(lat * 100).toFixed(1)} cm (${latWhat}), roll ${rollOff.toFixed(0)}° tilt ${tilt.toFixed(0)}°`);
    }
    const S = RIG.sc20k.slung;
    F.verdict(!fails.length, `(3) slung (RIG.sc20k.slung off [${S.off.join(', ')}] bore [${S.bore.join(', ')}] roll ${S.roll} follow ${S.follow}): finite, ON the back against the skinned mesh — nearest 0.3‥4.5 cm (a kick's blade may come 2 cm into it for a frame), furthest ≤ 10.5 over the torso (12 sprinting, 15 pitched onto a steep aim) — rolled side-flat within 8° (20° sprinting), bore within 16° of the back's plane (22° sprinting), no part's middle over 20 cm off the spine line, clear of the head — nine poses`,
      (fails.length ? '✗ ' + fails.join('\n    ✗ ') + '\n    ' : '') + notes.join(' · '));
  }
  // ---- (4) per posture (LONG standing / LONG_CROUCH crouched, blended by the crouch shown ahead of the springs): (a) the crouched table is what a crouched man follows
  //          and only him — LONG_CROUCH.shoulder.side nudged 6 cm to his left moves the settled trigger hand of a CROUCHED shouldered figure by that (± 1.5 cm) and a
  //          standing one not at all (< 3 mm), the table put back after; (b) crouched still and crouch-walking, shouldered and at the low ready, as shipped (a copy of
  //          the standing numbers): the carriage reported, the support hand within 4 cm of the foregrip, no NaN; (c) crouch toggled every 25 frames for six seconds
  //          walking shouldered: no NaN and the support hand within 4 cm on every frame of it
  {
    const { LONG_CROUCH } = await import(`${ROOT}/src/game/character.ts`);
    const dt = 1 / 60; const fails: string[] = [], notes: string[] = [];
    const settle = (stance: string, crouch: number, speed: number, secs = 3) => {
      const c = new Character(ch, { id: 1, tint: [0, 0, 0], tint2: [0, 0, 0], pos: [0, 0, 0], yaw: 0 }); const an: any = c.anim;
      an.phase = 0; an.speed = speed; an.crouchTarget = crouch; an.upper = 'none'; an.longGun = true; an.longStance = stance; an.longSteady = 1; an.longGrip = sc20kGrip(); c.muzzleAhead = sc20kMuzzleAhead();
      let nan = false, gap = 0; const shown = new Set<string>();
      for (let i = 0; i < Math.round(secs / dt); i++) { c.pos = [0, 0, c.pos[2] + speed * dt]; c.update(dt); if (i > 60) { if (!bonesFinite(c)) nan = true; gap = Math.max(gap, v3.dist(c.bones.handL, sc20kGripPoint(c))); shown.add(String(an.longShown)); } }
      return { c, an, handX: c.bones.handR[0] - c.pos[0], nan, gap, shown: [...shown].join('/') };
    };
    // (a)
    { const stand0 = settle('shoulder', 0, 0), crouch0 = settle('shoulder', 1, 0);
      const keep = LONG_CROUCH.shoulder.side; LONG_CROUCH.shoulder.side = keep + 0.06;
      let stand1, crouch1; try { stand1 = settle('shoulder', 0, 0); crouch1 = settle('shoulder', 1, 0); } finally { LONG_CROUCH.shoulder.side = keep; }
      const dStand = stand1.handX - stand0.handX, dCrouch = crouch1.handX - crouch0.handX;
      if (Math.abs(dStand) > 0.003) fails.push(`(a) the STANDING trigger hand moved ${(dStand * 100).toFixed(1)} cm when LONG_CROUCH.shoulder.side was nudged (want < 0.3)`);
      if (Math.abs(dCrouch - 0.06) > 0.015) fails.push(`(a) the CROUCHED trigger hand moved ${(dCrouch * 100).toFixed(1)} cm for a 6 cm nudge of LONG_CROUCH.shoulder.side (want 6 ± 1.5)`);
      if (LONG_CROUCH.shoulder.side !== keep) fails.push('(a) LONG_CROUCH not restored');
      notes.push(`(a) side +6 cm in the crouched table: crouched hand ${(dCrouch * 100).toFixed(1)} cm, standing hand ${(dStand * 100).toFixed(2)} cm`); }
    // (b)
    for (const [name, st, sp] of [['crouched still, shouldered', 'shoulder', 0], ['crouch-walk 1.3, shouldered', 'shoulder', 1.3], ['crouched still, low ready', 'lowLong', 0], ['crouch-walk 1.3, low ready', 'lowLong', 1.3]] as [string, string, number][]) {
      const r = settle(st, 1, sp, 4);
      if (r.nan) fails.push(`(b) ${name}: a NaN bone`); if (r.shown !== st) fails.push(`(b) ${name}: shows ${r.shown}, not ${st}`); if (r.gap > 0.04) fails.push(`(b) ${name}: support hand ${(r.gap * 100).toFixed(1)} cm off the foregrip at worst`);
      notes.push(`(b) ${name}: ${r.shown}, hand off grip ≤ ${(r.gap * 100).toFixed(1)} cm`);
    }
    // (c)
    { const c = new Character(ch, { id: 1, tint: [0, 0, 0], tint2: [0, 0, 0], pos: [0, 0, 0], yaw: 0 }); const an: any = c.anim;
      an.phase = 0; an.speed = 1.0; an.crouchTarget = 0; an.upper = 'none'; an.longGun = true; an.longStance = 'shoulder'; an.longSteady = 1; an.longGrip = sc20kGrip(); c.muzzleAhead = sc20kMuzzleAhead();
      let nan = false, worst = 0, worstAt = -1, toggles = 0;
      for (let i = 0; i < 360 + 60; i++) {
        if (i >= 60 && (i - 60) % 25 === 0) { an.crouchTarget = an.crouchTarget ? 0 : 1; toggles++; }
        c.pos = [0, 0, c.pos[2] + 1.0 * dt]; c.update(dt);
        if (i >= 60) { if (!bonesFinite(c)) nan = true; const g = v3.dist(c.bones.handL, sc20kGripPoint(c)); if (g > worst) { worst = g; worstAt = i - 60; } }
      }
      if (nan) fails.push('(c) a NaN bone through the crouch toggles'); if (worst > 0.04) fails.push(`(c) support hand ${(worst * 100).toFixed(1)} cm off the foregrip at frame ${worstAt} of the toggling (want ≤ 4)`);
      notes.push(`(c) ${toggles} crouch toggles walking shouldered: worst hand gap ${(worst * 100).toFixed(1)} cm, NaN ${nan}`); }
    F.verdict(!fails.length, '(4) per posture: the crouched table moves a crouched man\'s carriage and not a standing one\'s; crouched still / crouch-walking at the shoulder and the low ready the support hand stays on (≤ 4 cm) with no NaN; crouch toggled every 25 frames under a shouldered walk stays finite with both hands on',
      (fails.length ? '✗ ' + fails.join('\n    ✗ ') + '\n    ' : '') + notes.join(' · '));
  }
  return F.done();
}

// ================================================================================================ family runners
export async function sc20kFamily(): Promise<boolean> { let ok = true; for (const f of [rifleCadence, rifleReload, rifleSpreadProbe, rifleSlot, rifleCarry, rifleSuppression]) ok = (await f()) && ok; ok = (await airfoilFamily()) && ok; return ok; }
export async function airfoilFamily(): Promise<boolean> { let ok = true; for (const f of [airfoilHead, airfoilTorso, airfoilMiss, airfoilPreview, airfoilHostage]) ok = (await f()) && ok; return ok; }
