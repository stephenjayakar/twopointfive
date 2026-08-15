// The 'glass' probe family (E3 — `bun run tools/qa/probes.ts glass | glass-flags | glass-sight | glass-sound | glass-shot | glass-blast | glass-off | glass-lines`):
// what a pane is to the file format, to the guards' eyes and ears, to a round (it STOPS in the pane and stars it: a 'glassHit' decal, the crack heard —
// the pane never breaks), to a stun charge beside it, to a restart, to the renderer's box lists, and to the guards' LINES across it (a sight line through
// a pane is not a shot line: the alert man goes round for a real one, the lone man takes no corner behind glass) — staged on the real game stood up
// headless (headless.ts), PASS / FAIL each with the numbers.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { BoxFlag, BoxWorld, MAX_GLASS } = await import(`${ROOT}/src/scene/boxes.ts`);
const { bitsToFlags, flagsToBits, validateLevelData, AUTHORED_FLAGS } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel, levelToData } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { buildLevel, OFFICE_DATA } = await import(`${ROOT}/src/scene/level.ts`);
const G = await import(`${ROOT}/src/game/glass.ts`);
const { GLASS, glassState, glassPanes, isPane, glassHit, hitSeed, crackCount } = G;
const { fireWeapon, armThrough } = await import(`${ROOT}/src/game/combat.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { fake } = await import('./headless.ts');

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2);
type Verdict = (ok: boolean, label: string, detail: string) => void;
function mkVerdict(): { verdict: Verdict; all: () => boolean } { let allPass = true; return { verdict: (ok, label, detail) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, all: () => allPass }; }

/** every guard from `keep` on: parked far off, held, pinned, deaf and blind */
function parkFrom(game: any, keep: number) {
  game.guards.slice(keep).forEach((o: any, i: number) => { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [37.5, 0, 25 + i * 1.2]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; o.flashlight.enabled = false; o.char.update(0); });
}
function placeGuard(gd: any, p: Vec3, face: Vec3, hold = true) {
  gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.char.aimPitch = 0;
  gd.state = 'patrol'; gd.awareness = 0; gd.lastKnown = null; gd.reactT = 0; gd.searchT = 0; gd.task = null; gd.bodyDuty = null; gd.path = []; gd.pathGoal = null; gd.hold = hold; gd.pinned = false; gd.dazzledUntil = -1; gd.heardUpTo = 0;
  gd.char.update(0); gd.char.update(DT);
}
async function floor(seed: number, sam: Vec3) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  game.godMode = true; game.aiEnabled = true; game.playerInvisible = false; game.infiniteAmmo = true;
  game.teleportPlayer(v3.copy(sam)); game.player.visibility = 0; game.player.crouch = false;
  for (let i = 0; i < 10; i++) W.step(DT);
  game.player.visibility = 0;
  return W;
}
/** the conference partition's panes (z = 10, x 6‥13.5): level box indices, west to east */
function conferencePanes(game: any): number[] {
  return glassPanes(game).filter((bi: number) => { const b = game.level.boxes[bi]; return Math.abs(b.c[2] - 10) < 0.05 && b.c[0] < 14; }).sort((a: number, b: number) => game.level.boxes[a].c[0] - game.level.boxes[b].c[0]);
}

// ================================================================ (a) the flag through the file format
export async function glassFlags(): Promise<boolean> {
  console.log('\n=== glass-flags: the Glass bit ⇄ its name through LevelData, the office\'s panes, the export round trip ===');
  const { verdict, all } = mkVerdict();
  verdict((AUTHORED_FLAGS as string[]).includes('Glass') && flagsToBits(['Glass']) === BoxFlag.Glass && bitsToFlags(BoxFlag.Glass).join() === 'Glass',
    "'Glass' is an authored flag name and round-trips to BoxFlag.Glass", `flagsToBits(['Glass']) = 0x${flagsToBits(['Glass']).toString(16)} · bitsToFlags(0x${BoxFlag.Glass.toString(16)}) = [${bitsToFlags(BoxFlag.Glass)}] · GPU bit BOX_GLASS 131072 = ${BoxFlag.Glass === 131072}`);
  verdict((BoxFlag.Glass & 0xff) === 0 && (BoxFlag.Glass & 0xff00) === 0 && BoxFlag.Glass !== BoxFlag.SoundSeal && !('Broken' in BoxFlag),
    'the bit sits past the GPU flag byte and the owner byte, apart from SoundSeal; there is no Broken bit (panes never shatter)', `Glass 1<<${Math.log2(BoxFlag.Glass)}, SoundSeal 1<<${Math.log2(BoxFlag.SoundSeal)}`);
  const inFile = OFFICE_DATA.boxes.filter((b: any) => (b.flags ?? []).includes('Glass'));
  const L = buildLevel(); const inLevel = L.boxes.filter((b: any) => b.flags & BoxFlag.Glass);
  verdict(inFile.length >= 12 && inFile.length === inLevel.length && inFile.length <= MAX_GLASS, `levels/office.json authors ${inFile.length} panes and loadLevel hands every one the bit (≤ MAX_GLASS ${MAX_GLASS})`,
    `groups: ${[...new Set(inFile.map((b: any) => b.group))].join(', ')} · materials: ${[...new Set(inFile.map((b: any) => b.material ?? 'inline'))].join(', ')}`);
  // a Glass box is EITHER a pane (a thin upright unrotated slab) OR solid glass (thicker than THICK_GLASS_HALF across its thin axis — the water-cooler bottle since 08-12:
  // the pane treatment on a thick box, no crack stars); nothing in between, nothing rotated
  const { THICK_GLASS_HALF } = await import(`${ROOT}/src/game/glass.ts`);
  const solid = inLevel.filter((b: any) => Math.min(b.h[0], b.h[2]) > THICK_GLASS_HALF); const sheets = inLevel.filter((b: any) => Math.min(b.h[0], b.h[2]) <= THICK_GLASS_HALF);
  const thin = sheets.every((b: any) => Math.min(b.h[0], b.h[2]) <= 0.01 && b.h[1] >= 0.2 && !b.rot) && solid.every((b: any) => !b.rot && b.h[1] >= 0.1) && solid.length <= 2 && sheets.length >= 12;
  verdict(thin, `every SHEET of glass is a thin upright unrotated slab (≤ 2 cm through, ≥ 40 cm tall) and the ${solid.length} SOLID glass box(es) (> ${THICK_GLASS_HALF * 200} cm through: the cooler bottle) are upright and unrotated`, sheets.slice(0, 3).map((b: any) => `c (${b.c.map(f2)}) h (${b.h.map(f2)})`).join(' · ') + ' … solid: ' + solid.map((b: any) => `c (${b.c.map(f2)}) h (${b.h.map(f2)})`).join(' · '));
  const conf = inLevel.filter((b: any) => Math.abs(b.c[2] - 10) < 0.05 && b.c[0] < 14), side = inLevel.filter((b: any) => Math.abs(b.c[2] - 10) < 0.05 && b.c[0] > 26 && b.c[0] < 27), lobbyS = inLevel.filter((b: any) => Math.abs(b.c[2] - 24) < 0.05 && b.c[0] < 11.5), lobbyW = inLevel.filter((b: any) => Math.abs(b.c[0] - 4) < 0.05 && b.c[2] > 16.5);
  verdict(conf.length === 6 && side.length === 1 && lobbyS.length === 4 && lobbyW.length === 4, 'the office as briefed: 6 conference partition panes, 1 manager sidelight, 4 + 4 lobby frontage bays', `conference ${conf.length} · sidelight ${side.length} · lobby south ${lobbyS.length} · lobby west ${lobbyW.length} · other windows ${inLevel.length - conf.length - side.length - lobbyS.length - lobbyW.length}`);
  // the live level exports its panes as Glass and validates; the reload carries the bit and nothing else past the byte
  let threw = ''; let D: any = null; try { D = levelToData(L, { name: 'live', materials: OFFICE_DATA.materials }); } catch (e: any) { threw = String(e.message ?? e); }
  const back = D ? D.boxes.filter((b: any) => (b.flags ?? []).includes('Glass')).length : -1;
  verdict(!threw && back === inFile.length && validateLevelData(D).length === 0, 'levelToData off the live level: no throw, every pane exports as Glass, the data validates', threw || `${back} panes back, ${D ? validateLevelData(D).length : '?'} validation errors`);
  const L2 = loadLevel(D); verdict(L2.boxes.filter((b: any) => b.flags & BoxFlag.Glass).every((b: any) => (b.flags >>> 16) === (BoxFlag.Glass >>> 16)), 'and reloads with Glass the only bit past the low sixteen', '');
  return all();
}

// ================================================================ (b) eyes through it, feet and reach not
export async function glassSight(): Promise<boolean> {
  console.log('\n=== glass-sight: a guard in the corridor, Sam lit in the conference room behind the glass — the sight line passes, the solid line does not, and he takes him ===');
  const { verdict, all } = mkVerdict();
  const W = await floor(911, [8.0, 0, 8.3]); const { game } = W;
  parkFrom(game, 1); const gd = game.guards[0];
  placeGuard(gd, [8.2, 0, 11.3], [8.0, 0, 8.3]);   // in the corridor facing north at the west glazing run, Sam 3 m beyond it by the table
  const eye: Vec3 = v3.add(gd.char.pos, [0, 1.65, 0]), chest: Vec3 = v3.add(game.player.char.pos, [0, 1.2, 0]);
  const sight = game.col.segmentBlocked(eye, chest), solid = game.col.solidBlocked(eye, chest);
  const panes = conferencePanes(game); const between = panes.find((bi: number) => { const b = game.level.boxes[bi]; return Math.abs(b.c[0] - 8.1) < 0.6; });
  verdict(!sight && solid && between !== undefined, 'eye → chest through the pane: segmentBlocked (sight) false, solidBlocked (sound / reach / feet) true', `sight blocked ${sight} · solid blocked ${solid} · pane between: box ${between} c (${between !== undefined ? game.level.boxes[between].c.map(f2) : '-'})`);
  // feet: Sam walks north→south into the glass and stops at it; a shard-free floor
  const p0 = v3.copy(game.player.char.pos);
  for (let i = 0; i < 90; i++) { W.input.keys.add('KeyS'); W.step(DT); } W.input.keys.delete('KeyS'); for (let i = 0; i < 5; i++) W.step(DT);
  const pz = game.player.char.pos[2];
  verdict(pz < 10 - 0.2 && pz > p0[2] + 0.5, 'Sam walking south into the partition is stopped at the glazing line (his centre stays north of z 9.8 — by the sill under the pane: no pane in this level reaches down into his collision band, so feet never meet glass directly)', `from z ${f2(p0[2])} to z ${f2(pz)} (sill face z 9.94, pane plane z 10.00, body radius ~0.42)`);
  game.teleportPlayer([8.0, 0, 8.3]); for (let i = 0; i < 5; i++) W.step(DT);
  // the take: lit, in his cone, 3 m off through glass → alert inside a couple of seconds
  game.player.visibility = 1; gd.hold = true;
  let alertAt = -1; const t0 = game.time;
  for (let i = 0; i < 60 * 4 && alertAt < 0; i++) { game.player.visibility = 1; W.step(DT); if (gd.state === 'alert') alertAt = game.time - t0; }
  verdict(alertAt >= 0 && alertAt < 3.5, 'lit behind the glass 3 m in front of him: he goes ALERT (the picture and the AI agree: glass hides nobody)', `alert after ${alertAt >= 0 ? f2(alertAt) + ' s' : 'never (4 s)'} · awareness ${f2(gd.awareness)} · state ${gd.state}`);
  // and dark again behind it: a fresh calm man does not take him (control: the pane is not what hid him — the dark is)
  placeGuard(gd, [8.2, 0, 11.3], [8.0, 0, 8.3]); game.player.visibility = 0;
  for (let i = 0; i < 60 * 3; i++) { game.player.visibility = 0; W.step(DT); }
  verdict(gd.state === 'patrol' && gd.awareness < 0.3, 'control: the same man, Sam DARK behind the glass and still — nothing (it is the light meter that decides, as everywhere)', `state ${gd.state} · awareness ${f2(gd.awareness)}`);
  return all();
}

// ================================================================ (c) ears: sealed by it, open once it is gone
export async function glassSound(): Promise<boolean> {
  console.log('\n=== glass-sound: a noise in the conference room, a listener in the corridor across the glass — round through the door, and no different once a round has starred the pane ===');
  const { verdict, all } = mkVerdict();
  const W = await floor(913, [12.4, 0, 8.9]); const { game } = W;
  parkFrom(game, 1); const gd = game.guards[0];
  const door = game.doors.byName('conference'); if (door) { door.angle = 0; door.vel = 0; door.latched = true; }   // pull the conference door to: the only open way round is now a shut leaf
  placeGuard(gd, [12.6, 0, 11.2], [30, 0, 11.2]);   // east glazing run, his back half to it, Sam 2.3 m north of him through the easternmost pane
  for (let i = 0; i < 5; i++) W.step(DT);
  const src: Vec3 = [12.4, 1.0, 8.9], dst: Vec3 = v3.add(gd.char.pos, [0, 1.5, 0]);
  const straight = v3.dist(src, dst);
  const before = game.col.sound.propagate(src, dst);
  verdict(!before.direct && before.carry <= 0.35 && before.pathLen > straight + 1, 'pane whole, door shut: NOT direct — routed round through the shut leaf (carry ≤ 0.35) or sealed (0.25), yards longer than the 2-odd metres straight', `straight ${f2(straight)} m · pathLen ${f2(before.pathLen)} m · direct ${before.direct} routed ${before.routed} · carry ${f2(before.carry)} muffle ${f2(before.muffle)}`);
  // a scrape at Sam's feet (a 'prop' noise at 0.35 — a chair nudged): unheard through the glass
  const aw0 = gd.awareness;
  game.events.push({ kind: 'prop', pos: [src[0], 0, src[2]], time: game.time, loud: false, level: 0.35, who: PLAYER_ID });
  for (let i = 0; i < 3; i++) W.step(DT);
  const aw1 = gd.awareness;
  verdict(aw1 - aw0 < 0.05, 'a chair scraped 2.3 m behind him through the glass: he does not stir', `awareness ${f2(aw0)} → ${f2(aw1)}`);
  // Sam's whistle likewise (V): nobody answers through a sealed pane
  W.input.pressed.add('KeyV'); W.step(DT); for (let i = 0; i < 3; i++) W.step(DT);
  verdict(gd.state === 'patrol' && gd.awareness - aw1 < 0.05, 'Sam whistles behind the glass: no answer (the whistle rides the same propagation)', `state ${gd.state} · awareness ${f2(gd.awareness)}`);
  // a round into the pane between them: it cracks, and cracked laminated glass seals exactly as it did — the same pair stays routed, the scrape stays unheard
  const panes = conferencePanes(game); const between = panes.reduce((best: number, bi: number) => Math.abs(game.level.boxes[bi].c[0] - 12.5) < Math.abs(game.level.boxes[best].c[0] - 12.5) ? bi : best, panes[0]);
  const hit = glassHit(game, between, [12.5, 1.2, 10.006], [0, 0, -1], 0, 'hand');
  gd.heardUpTo = 1e12; for (let i = 0; i < 40; i++) W.step(DT);   // (let the crack itself pass him by: this check is about the scrape)
  game.col.sound.tick(game.time + 10);   // (drop the half-second route cache)
  const after = game.col.sound.propagate(src, dst);
  verdict(hit && !after.direct && Math.abs(after.pathLen - before.pathLen) < 0.05 && Math.abs(after.carry - before.carry) < 1e-6, 'a round INTO that pane (it stars, it holds): the same pair is still NOT direct — path and carry exactly as before', `hit ${hit} (box ${between}) · pathLen ${f2(before.pathLen)} → ${f2(after.pathLen)} m · direct ${after.direct} · carry ${f2(after.carry)}`);
  placeGuard(gd, [12.6, 0, 11.2], [30, 0, 11.2]); const aw2 = gd.awareness;
  game.events.push({ kind: 'prop', pos: [src[0], 0, src[2]], time: game.time, loud: false, level: 0.35, who: PLAYER_ID });
  for (let i = 0; i < 3; i++) W.step(DT);
  verdict(gd.awareness - aw2 < 0.05, 'and the same scrape through the cracked pane still does not turn him', `awareness ${f2(aw2)} → ${f2(gd.awareness)}`);
  return all();
}

// ================================================================ (d) a round: it stops in the pane and stars it — every time; the floor hears it; the restart wipes the stars
export async function glassShot(): Promise<boolean> {
  console.log('\n=== glass-shot: Sam in the corridor fires north at the conference glass — every round STOPS in the pane and stars it (a glassHit decal seeded off the hit, the crack heard, a \'glass\' event), the pane holds; a man 20 m off hears it; N rounds → N stars; restart wipes them ===');
  const { verdict, all } = mkVerdict();
  const W = await floor(917, [7.5, 0, 11.4]); const { game, audioCounts } = W;
  parkFrom(game, 1); const gd = game.guards[0];
  placeGuard(gd, [27.0, 0, 11.2], [40, 0, 11.2]);   // far down the corridor, back turned: ~20 m of open corridor from the pane
  for (let i = 0; i < 5; i++) W.step(DT);
  const pc = game.player.char; game.player.holstered = false; game.player.slot = 'pistol'; for (let i = 0; i < 30; i++) W.step(DT);   // pistol up (the equip beat)
  const target: Vec3 = [7.5, 1.3, 5.0];   // the whiteboard wall beyond the table, through the west run's middle pane
  const panes = conferencePanes(game); const S = glassState(game);
  const cracks = () => game.decals.list.filter((d: any) => d.kind === 'glassHit');
  const n0 = panes.length, ev0 = game.events.length, crack0 = audioCounts.get('glassCrack') ?? 0, aw0 = gd.awareness, dec0 = cracks().length;
  fireWeapon(game, pc, target, true);
  const evGlass = game.events.slice(ev0).find((e: any) => e.kind === 'glass'); const shot1 = game.events.slice(ev0).find((e: any) => e.kind === 'shot');
  const c1 = cracks(); const d1 = c1[c1.length - 1];
  const paneHit = shot1 ? panes.find((bi: number) => { const b = game.level.boxes[bi]; return Math.abs(shot1.to[0] - b.c[0]) <= b.h[0] + 1e-3; }) : undefined;
  verdict(panes.every((bi: number) => isPane(game.level.boxes[bi])) && panes.length === n0 && !!evGlass && (audioCounts.get('glassCrack') ?? 0) === crack0 + 1 && !!shot1 && Math.abs(shot1.to[2] - 10) < 0.05,
    'round 1: the round STOPPED in the pane (z 10), the pane is still a pane, one \'glass\' event on the list, the crack played once', `event ${evGlass ? `level ${evGlass.level} loud ${evGlass.loud} who ${evGlass.who} at (${f2(evGlass.pos[0])}, ${f2(evGlass.pos[2])})` : 'none'} · round stopped at (${shot1 ? shot1.to.map(f2) : '?'}) · glassCrack ×${(audioCounts.get('glassCrack') ?? 0) - crack0}`);
  const wantSeed = shot1 && paneHit !== undefined ? (hitSeed(paneHit, shot1.to) >>> 8) & 0xfff : -1;
  verdict(c1.length === dec0 + 1 && !!d1 && paneHit !== undefined && d1.pane === paneHit && d1.seed === wantSeed && Math.abs(d1.pos[2] - 10) < 1e-3 && Math.abs(d1.n[2] - 1) < 1e-6 && d1.radius >= GLASS.rMin - 1e-9 && d1.radius <= GLASS.rMax + 1e-9 && crackCount(game) === c1.length,
    'exactly one glassHit decal: on THAT pane (its static index), centred on the mid-plane where the round met it, facing back at the shooter (+z), its 12-bit look seed = hitSeed(pane, point) — the same shot always draws the same star — reach inside GLASS.rMin‥rMax', d1 ? `pane ${d1.pane} (hit ${paneHit}) · pos (${d1.pos.map(f2)}) n (${d1.n.map(f2)}) r ${f2(d1.radius)} · seed ${d1.seed} want ${wantSeed} · param ${d1.param}` : 'no decal');
  verdict(game.player.noise >= GLASS.hearLevel - 1e-6, 'the SOUND meter shows the crack as Sam\'s (noise ≥ the event level)', `player.noise ${f2(game.player.noise)}`);
  // the man 20 m off hears it inside a few frames (event ids: next frame), goes suspicious toward the pane
  for (let i = 0; i < 4; i++) W.step(DT);
  verdict(gd.awareness >= 0.4 && gd.awareness > aw0 + 0.2 && !!gd.lastKnown && Math.abs(gd.lastKnown[2] - 10) < 2.5, 'the guard 20 m down the corridor: awareness up past 0.4, his fix at the glazing', `awareness ${f2(aw0)} → ${f2(gd.awareness)} · state ${gd.state} · fix ${gd.lastKnown ? `(${f2(gd.lastKnown[0])}, ${f2(gd.lastKnown[2])})` : 'none'} · said ${JSON.stringify(gd.bubble?.text ?? null)}`);
  // round 2 on the same line: stops in the same pane again (bullets never pass our glazing), a second star, a second crack
  for (let i = 0; i < 20; i++) W.step(DT);
  const ev1 = game.events.length; fireWeapon(game, pc, target, true);
  const shot2 = game.events.slice(ev1).find((e: any) => e.kind === 'shot'); const glass2 = game.events.slice(ev1).find((e: any) => e.kind === 'glass');
  verdict(!!shot2 && Math.abs(shot2.to[2] - 10) < 0.05 && !!glass2 && cracks().length === dec0 + 2, 'round 2 on the same line: stopped in the pane again (z 10), a second \'glass\' event, a second star (2 rounds → 2 decals)', `stopped at (${shot2 ? shot2.to.map(f2) : '?'}) · stars ${cracks().length}`);
  // a burst: N more rounds → N more decals, all on conference panes, distinct seeds unless two rounds share a millimetre
  const before = cracks().length; const N = 5;
  for (let k = 0; k < N; k++) { for (let i = 0; i < 14; i++) W.step(DT); fireWeapon(game, pc, [6.9 + 0.35 * k, 1.1 + 0.12 * k, 5.0], true); }
  const cs = cracks(); const fresh = cs.slice(before);
  verdict(cs.length === before + N && fresh.every((d: any) => panes.includes(d.pane)) && new Set(fresh.map((d: any) => d.seed)).size >= N - 1, `${N} rounds fanned across the west run → ${N} more stars, each on a conference pane, their seeds distinct`, `stars ${before} → ${cs.length} · panes [${fresh.map((d: any) => d.pane).join(', ')}] · seeds [${fresh.map((d: any) => d.seed).join(', ')}]`);
  // a guard's round stars glass too: put the man square to the east run and have him fire at the far wall through it
  placeGuard(gd, [11.0, 0, 11.3], [11.0, 0, 5]); for (let i = 0; i < 3; i++) W.step(DT);
  const g0 = cracks().length, evg = game.events.length;
  fireWeapon(game, gd.char, [11.0, 1.2, 5.0], false, { steady: true, spread: 0 });
  const gshot = game.events.slice(evg).find((e: any) => e.kind === 'guardShot');
  verdict(cracks().length === g0 + 1 && !!gshot && Math.abs(gshot.to[2] - 10) < 0.05, 'a guard\'s round at the east run: stopped in the pane, one more star', `stars ${g0} → ${cracks().length} · his round stopped at z ${gshot ? f2(gshot.to[2]) : '?'}`);
  // restart: the stars go with the encounter (decals clear with the level's state), the panes are what they always were, sound still sealed
  const hitsBefore = S.hits;
  game.restartEncounter(); for (let i = 0; i < 3; i++) W.step(DT);
  verdict(cracks().length === 0 && game.decals.count === 0 && panes.length >= 4 && panes.every((bi: number) => isPane(game.level.boxes[bi])), `restartEncounter: no stars left (the decal list is empty), every one of the ${panes.length} conference panes (≥ 4) still a pane`, `stars ${cracks().length} · decals ${game.decals.count} · hits logged this Game ${hitsBefore}`);
  const pr = game.col.sound.propagate([7.5, 1, 8.5], [7.5, 1.5, 11.4]);
  verdict(!pr.direct, 'and sound across the partition is walled off as ever', `direct ${pr.direct} · pathLen ${f2(pr.pathLen)} · carry ${f2(pr.carry)}`);
  // pressed right up to the glazing (the muzzle already through the sheet: armThrough's panel rule would swallow the round — the pane between shoulder and muzzle takes it instead)
  game.teleportPlayer([7.5, 0, 10.62]); game.player.holstered = false; game.player.slot = 'pistol'; game.player.char.bodyYaw = game.player.char.aimYaw = Math.PI;   // facing north, square at the pane
  W.cursorAt([7.5, 1.3, 5.0]); for (let i = 0; i < 30; i++) { game.player.char.bodyYaw = game.player.char.aimYaw = Math.PI; W.step(DT); }
  const pcz = game.player.char.pos[2]; const p0 = cracks().length;
  const wasThrough = armThrough(game, game.player.char);
  fireWeapon(game, game.player.char, [7.5, 1.3, 5.0], true);
  const p1 = cracks().length;
  verdict(p1 === p0 + 1 && wasThrough && game.player.char.muzzle[2] < 10.0, 'pressed to the glazing facing it (the muzzle already THROUGH the sheet — armThrough true), one round: the pane between shoulder and muzzle is starred all the same', `Sam at z ${f2(pcz)} · muzzle z ${f2(game.player.char.muzzle[2])} (pane 10.00) · armThrough ${wasThrough} · stars ${p0} → ${p1}`);
  return all();
}

// ================================================================ (e) the boot and the stun charge
export async function glassBlast(): Promise<boolean> {
  console.log('\n=== glass-blast: a stun charge in the corridor stars the panes within GLASS.bangM (GLASS.bangCracks quiet stars each) and no others; a door kicked in beside the manager\'s sidelight leaves it alone; events are read once ===');
  const { verdict, all } = mkVerdict();
  const W = await floor(919, [20, 0, 11.2]); const { game, audioCounts } = W;
  parkFrom(game, 0);
  const cracks = () => game.decals.list.filter((d: any) => d.kind === 'glassHit');
  const side = glassPanes(game).find((bi: number) => { const b = game.level.boxes[bi]; return Math.abs(b.c[2] - 10) < 0.05 && b.c[0] > 26 && b.c[0] < 27; });
  verdict(side !== undefined, 'the manager\'s sidelight is there (x 26.2‥26.75 on the corridor wall)', side !== undefined ? `box ${side} c (${game.level.boxes[side].c.map(f2)}) h (${game.level.boxes[side].h.map(f2)})` : 'missing');
  // a 'kick' event where the manager door's kick lands (by its latch jamb, x ≈ 26.1): glass takes no notice of a boot on a door
  const kickAt: Vec3 = [26.0, 0, 10.4]; const k0 = cracks().length;
  game.events.push({ kind: 'kick', pos: kickAt, time: game.time, loud: true, level: 1, who: PLAYER_ID });
  W.step(DT);
  verdict(cracks().length === k0, `a kick at (${kickAt[0]}, ${kickAt[2]}), 0.3 m from the sidelight: no star anywhere (a slammed leaf does not crack laminated glass)`, `stars ${k0} → ${cracks().length}`);
  // a bang in the corridor at (11.0, 0.3, 11.0): every pane whose nearest point is within bangM takes bangCracks quiet stars — count them geometrically and compare
  const bangAt: Vec3 = [11.0, 0.3, 11.0];
  const expect = glassPanes(game).filter((bi: number) => { const b = game.level.boxes[bi]; const dx = Math.max(Math.abs(bangAt[0] - b.c[0]) - b.h[0], 0), dy = Math.max(Math.abs(bangAt[1] - b.c[1]) - b.h[1], 0), dz = Math.max(Math.abs(bangAt[2] - b.c[2]) - b.h[2], 0); return Math.hypot(dx, dy, dz) <= GLASS.bangM; });   // (axis-aligned panes: the nearest-point distance by hand)
  const b0 = cracks().length, ev0 = game.events.length, snd0 = audioCounts.get('glassCrack') ?? 0;
  game.events.push({ kind: 'bang', pos: bangAt, time: game.time, loud: true });
  W.step(DT);
  const fresh = cracks().slice(b0);
  const byPane = new Map<number, number>(); for (const d of fresh) byPane.set(d.pane, (byPane.get(d.pane) ?? 0) + 1);
  const onlyExpected = [...byPane.keys()].every(bi => expect.includes(bi)) && expect.every((bi: number) => byPane.get(bi) === GLASS.bangCracks);
  const onPane = fresh.every((d: any) => { const b = game.level.boxes[d.pane]; return Math.abs(d.pos[0] - b.c[0]) <= b.h[0] + 1e-6 && Math.abs(d.pos[1] - b.c[1]) <= b.h[1] + 1e-6 && Math.abs(d.pos[2] - b.c[2]) <= b.h[2] + 1e-6 && d.param < 0.9; });
  const noNoise = game.events.slice(ev0 + 1).every((e: any) => e.kind !== 'glass') && (audioCounts.get('glassCrack') ?? 0) === snd0;
  verdict(expect.length >= 2 && fresh.length === expect.length * GLASS.bangCracks && onlyExpected && onPane && noNoise, `a stun charge at (${bangAt.join(', ')}): the ${expect.length} panes within ${GLASS.bangM} m take ${GLASS.bangCracks} stars each — ON the pane, blast-strength (no hole) — no other pane is touched, and the stars are quiet (no 'glass' event, no crack sound: the bang was the noise)`, `expected panes [${expect.join(', ')}] · stars by pane ${JSON.stringify([...byPane])} · on-pane ${onPane} · quiet ${noNoise}`);
  // determinism: the stars' seeds and positions come off the blast's position — the same bang on a fresh floor gives the same records
  const sig = (ds: any[]) => ds.map((d: any) => `${d.pane}:${d.seed}:${d.pos.map((x: number) => x.toFixed(3)).join(',')}`).sort().join('|');
  const W2 = await floor(919, [20, 0, 11.2]); parkFrom(W2.game, 0);
  W2.game.events.push({ kind: 'bang', pos: v3.copy(bangAt), time: W2.game.time, loud: true }); W2.step(DT);
  const sigA = sig(fresh), sigB = sig(W2.game.decals.list.filter((d: any) => d.kind === 'glassHit'));
  verdict(sigA === sigB && sigA.length > 0, 'the same bang on a fresh floor: the same stars (pane, seed, position) — nothing off Math.random', `${sigA.slice(0, 120)}…`);
  // the same event is not re-read next frame (each looked at once)
  const b1 = cracks().length; W.step(DT); W.step(DT);
  verdict(cracks().length === b1, 'events are consumed once: two more frames with the bang still on the list add nothing', `stars ${b1} → ${cracks().length} · events on the list: ${game.events.map((e: any) => e.kind).join(', ')}`);
  // a bang far from any pane: nothing
  const b2 = cracks().length;
  game.events.push({ kind: 'bang', pos: [20.5, 0.3, 16.0], time: game.time, loud: true });   // the middle of the cubicles: > 2.5 m from every window
  W.step(DT);
  verdict(cracks().length === b2, 'a stun charge in the middle of the cubicles (no pane within 2.5 m): no star', `stars ${b2} → ${cracks().length}`);
  // the ring is the bound: many bangs never grow the decal list past its cap, and resetLevelState empties it
  for (let k = 0; k < 40; k++) { game.events.push({ kind: 'bang', pos: [6 + (k % 8), 0.3, 11.0 + 0.01 * k], time: game.time, loud: true }); W.step(DT); }
  const peak = game.decals.count;
  game.resetLevelState(); W.step(DT);
  verdict(peak > b2 && peak <= game.decals.constructor.CAP && cracks().length === 0, `forty bangs along the glazing: they DO star panes (the list grows past ${b2}) and the decal list peaks at ${peak} (≤ the ring's ${game.decals.constructor.CAP}); resetLevelState empties it`, `after reset: ${game.decals.count} decals`);   // (peak > b2: the floor — bangs that starred nothing would bound nothing)
  return all();
}

// ================================================================ (f) the renderer's lists: off = the level without the panes; on = the same lists + the pane table
export async function glassOff(): Promise<boolean> {
  console.log('\n=== glass-off: what reaches the GPU — panes are never rasterised nor in the trace grid (on OR off); on lists them in SceneInfo.glass nearest-first, off lists none ===');
  const { verdict, all } = mkVerdict();
  const digest = (u: Uint32Array, n = u.length) => { let h = 2166136261 >>> 0; for (let i = 0; i < n; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
  const level = buildLevel();
  const mk = (boxes: any[], enabled: boolean) => { const w = new BoxWorld(fake('device')); for (const b of boxes) w.addStatic(b); w.glassEnabled = enabled; w.glassFocus = [9, 0, 11]; w.upload(); return w; };
  const on = mk(level.boxes, true), off = mk(level.boxes, false);
  const noGlass = mk(level.boxes.map((b: any) => (b.flags & BoxFlag.Glass) ? { ...b, flags: BoxFlag.NoShadow | BoxFlag.NoPrimary } : b), true);   // "main with those boxes removed": the same indices, the panes made into nothing (NoShadow + NoPrimary = in no list)
  const vis = (w: any) => digest(w.visible, w.visibleCount), grid = (w: any) => digest(w.cellStart) + '/' + digest(w.items, 2 * w.itemCount);
  verdict(vis(on) === vis(off) && vis(off) === vis(noGlass), 'visible (raster) list: on ≡ off ≡ the level with its panes made nothing', `${on.visibleCount} boxes · digests ${vis(on)} / ${vis(off)} / ${vis(noGlass)}`);
  verdict(grid(on) === grid(off) && grid(off) === grid(noGlass), 'trace grid (cells + items): on ≡ off ≡ the level with its panes made nothing — no traced ray can ever meet a pane', `${on.itemCount} items · digests ${grid(on)} | ${grid(off)} | ${grid(noGlass)}`);
  const W0 = BoxWorld.GLASS_WORD; const nOn = on.infoData[W0], nOff = off.infoData[W0];
  const nPanes = level.boxes.filter((b: any) => b.flags & BoxFlag.Glass).length;
  verdict(nOn === Math.min(nPanes, MAX_GLASS) && nOff === 0 && on.glassList.length === nOn && off.glassList.length === 0, `SceneInfo.glassInfo.x: on = ${nOn} (the level's ${nPanes} panes, cap ${MAX_GLASS}), off = ${nOff}`, `glassList on [${on.glassList.slice(0, 6).join(', ')} …] off [${off.glassList.join(', ')}]`);
  // nearest-first from the focus (9, ·, 11): the first listed pane is a conference one; the table carries centre / half / tint / index
  const first = on.glassList[0]; const b0 = level.boxes[first]; const f = on.infoF32;
  const rowOk = f[W0 + 4] === Math.fround(b0.c[0]) && f[W0 + 5] === Math.fround(b0.c[1]) && f[W0 + 6] === Math.fround(b0.c[2]) && f[W0 + 8] === Math.fround(b0.h[0]) && f[W0 + 12] === Math.fround(b0.albedo[0]) && f[W0 + 15] === first;
  verdict(Math.abs(b0.c[2] - 10) < 0.05 && b0.c[0] < 14 && rowOk, 'nearest-first: pane 0 is a conference pane, and its row holds (c, cos), (h, sin), (tint, index) as packed', `box ${first} c (${b0.c.map(f2)}) · row c (${[f[W0 + 4], f[W0 + 5], f[W0 + 6]].map(f2)}) cos ${f2(f[W0 + 7])} h (${[f[W0 + 8], f[W0 + 9], f[W0 + 10]].map(f2)}) sin ${f2(f[W0 + 11])} tint (${[f[W0 + 12], f[W0 + 13], f[W0 + 14]].map(f2)}) idx ${f[W0 + 15]}`);
  // the focus moving re-sorts the table (nearest-first) but never changes its membership
  on.glassFocus = [30, 0, 20]; on.upload(); const nMoved = on.infoData[W0]; const first2 = on.glassList[0];
  on.glassFocus = [9, 0, 11]; on.upload();
  verdict(nMoved === nOn && first2 !== first, 'the look-at moving across the floor: the same count listed, a different pane first', `${nOn} → ${nMoved} · first ${first} → ${first2}`);
  // the GPU flag word carries the Glass bit (bit 17) for a pane and never for anything else; the CPU-only bits never appear
  const gu = on.geoU32; let paneBits = true, othersClean = true;
  // (bits 18‥31 are the MARKING slot — scene/markings.ts MARK_SLOT_SHIFT: non-zero exactly on boxes that carry markings, which a pane never does)
  let markBits = true;
  level.boxes.forEach((b: any, i: number) => { const w = gu[i * 8 + 7]; if (b.flags & BoxFlag.Glass) paneBits &&= (w & 131072) !== 0 && (w >>> 18) === 0; else othersClean &&= (w & 131072) === 0; othersClean &&= (w & BoxFlag.SoundSeal) === 0; markBits &&= ((w >>> 18) !== 0) === !!(b.marks && b.marks.length && !(b.flags & BoxFlag.Glass)); });
  verdict(paneBits && othersClean && markBits, 'the uploaded flag word: BOX_GLASS (bit 17) on every pane, on nothing else; SoundSeal never uploaded; bits 18‥31 = the marking slot, set exactly on marked boxes (never a pane)', `panes ${paneBits} · others ${othersClean} · marks ${markBits}`);
  return all();
}

// ================================================================ (g) the guards' lines across it: a sight line through a pane is not a shot line
/** an alert man's fresh sighting on `fix` (eyes on him now: licensed), every chase clock fresh, free to move */
function armAlert(gd: any, game: any, fix: Vec3, resetChase: (gd: any) => void) {
  gd.hold = false; gd.pinned = false; gd.dazzledUntil = -1; gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0; gd.fireCd = 0.2; gd.weapon.rearm(); gd.reloadT = -1;
  gd.lastKnown = v3.copy(fix); gd.lastSeenT = game.time; gd.ledT = game.time; gd.stuckT = 0; resetChase(gd);
}
/** the pane is the ONLY thing between a and b: the sight line passes (segmentBlocked false), the shot line does not (shotBlocked true) */
function glassOnly(game: any, a: Vec3, b: Vec3): boolean { return !game.col.segmentBlocked(a, b) && game.col.shotBlocked(a, b); }
export async function glassLines(): Promise<boolean> {
  console.log('\n=== glass-lines: an alert man whose only line on a lit Sam runs through the conference glass does not plant on it and shoot the pane — he goes round for a real line; beside the pane, through the doorway, he plants and fires as ever; and the lone man never takes a corner that only SEES the fix through glass ===');
  const { verdict, all } = mkVerdict();
  const { resetChase, clearShot, shotOrigin } = await import(`${ROOT}/src/game/guards.ts`);
  const { loneRecord } = await import(`${ROOT}/src/game/tactics.ts`);
  /** Sam lit and rooted at `sam` facing the man, the man armed alert on him at `at`; run `secs`: rounds, cracks, hits, ground, the spells */
  async function duel(seed: number, at: Vec3, sam: Vec3, secs: number) {
    const W = await floor(seed, sam); const { game, audioCounts } = W;
    parkFrom(game, 1); const gd = game.guards[0];
    for (const dd of game.doors.list) dd.reset();
    game.teleportPlayer(v3.copy(sam)); game.player.visibility = 0.85; game.puppet = { goal: v3.copy(sam), aim: [at[0], 1.2, at[2]] };
    placeGuard(gd, at, sam, false); gd.char.anim.upper = 'aim'; gd.char.update(0); gd.char.update(DT); armAlert(gd, game, game.player.char.pos, resetChase);
    const trunkOf = () => { const pc = game.player.char; const tr = pc.bones.spine2 ?? pc.bones.hips; return [tr ? tr[0] : pc.pos[0], pc.pos[1] + 1.25, tr ? tr[2] : pc.pos[2]] as Vec3; };
    let shots = 0, shotsGlassOnly = 0, firstHit = -1, firstClearAt = -1, ground = 0, plant = 0, maxPlant = 0; const t0 = game.time; let last = v3.copy(gd.char.pos); const rows: string[] = [];
    const cracks0 = audioCounts.get('glassCrack') ?? 0, glassEv0 = game.events.filter((e: any) => e.kind === 'glass').length;
    const play = game.audio.play; game.audio.play = (n: string, ...rest: unknown[]) => { if (n === 'pistolLoud') { shots++; if (glassOnly(game, shotOrigin(gd.char), trunkOf())) shotsGlassOnly++; } return play(n, ...rest); };   // (counted the moment the round leaves: fireWeapon plays it from inside the guard's update, so the line read here is the line the fire gate saw)
    let closingAt6 = false, posAt6: Vec3 | null = null;
    for (let f = 0; f < 60 * secs; f++) {
      W.step(DT);
      const t = game.time - t0; const p = gd.char.pos;
      if (game.player.hitFlash > 0.94 && firstHit < 0) firstHit = t;
      const only = glassOnly(game, shotOrigin(gd.char), trunkOf());
      if (firstClearAt < 0 && gd.state === 'alert' && clearShot(game, gd.char, trunkOf())) firstClearAt = t;
      if (gd.state === 'alert' && gd.speed < 0.25 && gd.sawPlayerThisFrame && only) { plant += DT; maxPlant = Math.max(maxPlant, plant); } else plant = 0;
      ground += v3.distXZ(p, last); last = v3.copy(p);
      if (f === 60 * 6 - 1) { closingAt6 = gd.path.length > 0 && gd.pathI < gd.path.length && gd.speed > 0.5; posAt6 = v3.copy(p); }
      if (f % 30 === 29) rows.push(`${t.toFixed(1)}s ${gd.state} (${f2(p[0])}, ${f2(p[2])}) seen ${gd.sawPlayerThisFrame ? 'Y' : 'n'} line ${clearShot(game, gd.char, trunkOf()) ? 'CLEAR' : only ? 'glass' : 'blocked'} spd ${f2(gd.speed)} path ${gd.pathI}/${gd.path.length} shots ${shots} hits ${firstHit >= 0 ? 'Y' : 'n'}`);
    }
    game.audio.play = play; game.puppet = null;
    return { game, gd, shots, shotsGlassOnly, cracks: (audioCounts.get('glassCrack') ?? 0) - cracks0, glassEvents: game.events.filter((e: any) => e.kind === 'glass').length - glassEv0, firstHit, firstClearAt, ground, maxPlant, closingAt6, posAt6, rows };
  }
  // (1) the glass-only line: square in front of the east glazing, Sam four metres in, lit, still, facing him — every line from where he stands crosses a pane
  {
    const R = await duel(931, [12.0, 0, 11.2], [12.0, 0, 7.0], 8);
    const cameRound = R.firstClearAt >= 0 && R.firstClearAt <= 6, closing = R.ground >= 1 && R.closingAt6;
    verdict(R.shotsGlassOnly <= 1 && R.cracks <= 1 && R.maxPlant <= 1.5 && (cameRound || closing) && R.firstHit >= 0,   // (the crack COUNT is the audio's: game.events prunes itself, so the 'glass' events still listed at the end are information)
      '(1) Sam lit and still in the conference room, the man alert on the corridor with only the pane between them: at most one round into the glass, never planted on that line with eyes on him past 1.5 s, and inside six seconds he has EITHER stood where the line is clear (round through the door) OR covered a metre and is still closing — and a round of his reaches Sam in the eight',
      `rounds ${R.shots} (${R.shotsGlassOnly} on a glass-only line) · cracks heard ${R.cracks} ('glass' events still listed ${R.glassEvents}) · longest plant seeing him through the pane ${f2(R.maxPlant)} s · first CLEAR line at ${R.firstClearAt >= 0 ? f2(R.firstClearAt) + ' s' : 'never'} · ground ${f2(R.ground)} m${R.closingAt6 ? ' (still closing at 6 s)' : ''} · first round in Sam ${R.firstHit >= 0 ? f2(R.firstHit) + ' s' : 'never'} · ends ${R.gd.state} at (${f2(R.gd.char.pos[0])}, ${f2(R.gd.char.pos[2])})\n    ${R.rows.join('\n    ')}`);
  }
  // (2) the mirror: on the corridor in front of the DOORWAY (authored ajar into the room), Sam through the opening on a line that touches no glass — he plants where he stands and the rounds arrive, as they always did
  {
    const R = await duel(933, [9.5, 0, 11.3], [10.3, 0, 6.8], 5);
    verdict(R.firstHit >= 0 && R.firstHit < 3 && R.cracks === 0 && R.ground < 1.0 && R.firstClearAt >= 0 && R.firstClearAt < 0.3,
      '(2) the same man beside the pane with the doorway\'s clear line: CLEAR from the first frame, planted where he stood (< 1 m of ground), a round in Sam inside three seconds, not a crack',
      `first CLEAR line at ${R.firstClearAt >= 0 ? f2(R.firstClearAt) + ' s' : 'never'} · first round in Sam ${R.firstHit >= 0 ? f2(R.firstHit) + ' s' : 'never'} · rounds ${R.shots} · cracks ${R.cracks} · ground ${f2(R.ground)} m · ends at (${f2(R.gd.char.pos[0])}, ${f2(R.gd.char.pos[2])})\n    ${R.rows.join('\n    ')}`);
  }
  // (3) the lone man's corner (tactics.ts): alone at the corridor's west end, alert on an ARMED Sam's fix in the conference room's south-east corner nine metres off — the first place on his way
  //     his EYES have the fix is through the west panes, a stride from where he stands; that is no corner to hold a gun on it from: the first LINE on it is at the doorway's west jamb
  {
    const FIX: Vec3 = [12.5, 0, 5.5];
    const W = await floor(937, FIX); const { game } = W; const pl = game.player;
    parkFrom(game, 1); const A = game.guards[0];
    for (const dd of game.doors.list) dd.reset();
    game.teleportPlayer(v3.copy(FIX)); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = true; game.playerInvisible = true;
    placeGuard(A, [4.8, 0, 10.8], FIX, false);
    A.heardUpTo = game.eventSeq; A.state = 'alert'; A.awareness = 1; A.reactT = 0; A.fireCd = 0.5; A.reloadT = -1; A.lastKnown = v3.copy(FIX); A.lastSeenT = -100; A.sightT = -100; A.searchT = 0; A.searchPlan = null; A.standoff = null; A.script = null; resetChase(A);
    A.witness.heard.shots = 1; A.witness.heard.lastShotT = game.time; A.witness.heard.lastT = game.time; pl.lastFireT = game.time;   // (a shot of Sam's in his ears a moment ago: armed, as far as he knows — tactics-lone's staging)
    let planned: Vec3 | null = null, plannedLos = false, knelt: Vec3 | null = null, radioed = false; const trail: string[] = [];
    const say = game.say.bind(game); game.say = (gd: any, text: string, radio = false) => { if (gd === A && radio) radioed = true; return say(gd, text, radio); };
    for (let f = 0; f < 60 * 12; f++) {
      pl.visibility = 0.02; W.step(DT);
      const L = loneRecord(game, A);
      if (L && !planned && L.holdAt) { planned = v3.copy(L.holdAt); plannedLos = L.los; }   // the corner as loneCorner PLANNED it (holdAt is re-stamped with his feet once he kneels)
      if (L && L.holdT > 0 && !knelt) knelt = v3.copy(A.char.pos);
      if (f % 60 === 59) trail.push(`${(game.time).toFixed(0)}s ${A.state} (${f2(A.char.pos[0])}, ${f2(A.char.pos[2])}) ${L ? (L.released ? 'released:' + L.releasedWhy : L.holdT > 0 ? 'holding ' + L.holdT.toFixed(1) : 'to corner') : 'no lone record'} spd ${f2(A.speed)}`);
      if (game.tune.tactics && L?.released) break;
    }
    game.say = say;
    const at = (p: Vec3): Vec3 => [p[0], 1.15, p[2]], fixAt: Vec3 = [FIX[0], 1.0, FIX[2]];
    const plannedGlassOnly = planned ? glassOnly(game, at(planned), fixAt) : false, plannedShotOpen = planned ? !game.col.shotBlocked(at(planned), fixAt) : false;
    verdict(!!planned && !!knelt && !(plannedLos && !plannedShotOpen) && !plannedGlassOnly && radioed,
      '(3) the lone man at the corridor\'s west end, his fix in the glazed room\'s far corner: he takes a hold and calls it — and the corner loneCorner planned is NEVER one whose only line on the fix is through a pane (los claimed ⇒ the SHOT line is open from it; else the six-metres-up-the-route hold with no line claimed)',
      `planned corner ${planned ? `(${f2(planned[0])}, ${f2(planned[2])}) los ${plannedLos} · shot line open ${plannedShotOpen} · glass-only ${plannedGlassOnly}` : 'none'} · knelt at ${knelt ? `(${f2(knelt[0])}, ${f2(knelt[2])}) ${f2(v3.distXZ(knelt, FIX))} m off the fix` : 'never'} · radioed ${radioed}\n    ${trail.join('\n    ')}`);
  }
  return all();
}
