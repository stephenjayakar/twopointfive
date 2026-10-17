// The 'irlaser' family: THE TEAM'S LASERS ARE INFRARED BEHIND GOGGLES (the maintainer, 10-06: "and then we could also model IR lasers (assuming enemies don't
// have night vision)" · "ready or not is a good base case here"). The rule is game/irlaser.ts; this family is its check. Run through probes.ts:
//   bun run tools/qa/probes.ts irlaser | ir-draw | ir-sam | ir-unseen | ir-off
// PASS / FAIL each, all headless (the Game of headless.ts stood up on each scenario's own level, started as a click on its row starts it — bang-tally.ts
// stage()). What is asked is WHICH BOXES the lasers' draw hands the renderer and whether anything in the game goes differently for them. Nothing is drawn: how
// an infrared line LOOKS through the tube is not judged here, and the GPU's light meter is not run (headless it is the CPU stand-in) — what is held instead is
// the mechanism the meter rests on: a laser is boxes flagged NoShadow (in no ray's grid) and never a light (the light list is hashed frame for frame).
//   ir-draw    A TEAMMATE'S LASER FOLLOWS HIS GOGGLES, AND THE PICTURE'S: every scenario, every teammate, his laser laid eight ways.
//                · goggles down: not one box for a bare-eyed picture; for the tube's, the line and dot the red laser had — same place, same size, to the
//                  field — in the infrared tint, every box NoShadow;
//                · the line between the two pictures is the shader's (Player.nvAmount past 0.5), not the N key;
//                · goggles up (a lit place, or behind his white light): the red laser of the build before, field for field, in either picture;
//                · through Game.update, a lit walk: every man's band is his own goggles' every frame, both bands seen, and what his draw gives a bare-eyed
//                  picture is nothing when down and the red line when up;
//                · WHEN IT IS ON: Sam's goggles down and the team standing easy, every frame's boxes hold a goggled man's infrared line on his bore exactly
//                  while his gun is at his shoulder (never with the muzzle lowered for a colleague); IR.carry off: none (nobody is hunting);
//                · an enemy handed his laser back (LASER.enemy) is never infrared, whoever looks.
//   ir-sam     SAM'S OWN: a scenario's team on the floor and the gun in his hands — a line and a dot on his bore in the infrared with his goggles down, in step
//              with the picture's swap to the tube frame for frame, both ways; nothing with goggles up, holstered, sprinting, down, with IR.sam or IR.on off,
//              or in a game with no team (the office at night, alone).
//   ir-unseen  NOBODY READS ONE. Every scenario played through a held door from the same seed five times: Sam's goggles down with IR on (infrared lines in
//              the frames' boxes), with IR off (none), on again (the control); Sam's goggles up with IR on (a goggled man's laser in NO frame's boxes) and
//              off. Hashed every frame: the whole game's digest, every man's awareness and light, every camera's integrator, the light list. On ≡ off both
//              ways — no enemy's awareness and no light is any different for an infrared laser or for none — while the counts say it is not vacuous
//              (frames an infrared beam lay ON a living enemy). In these plays Sam is the sandbox's invisible man and no camera has him, so then, closely:
//              Sam plainly lit and visible, his goggles down, 3.5 m in front of an enemy with his laser on (the enemy's awareness RISES — identically with
//              the laser on, off and on again). CAMERAS do not run while a scenario's machine has the floor (devices.ts sensing), and only a scenario
//              has a team: with a team, Sam lit in a lens fills nothing, laser or not; alone in the office the lens fills and no laser exists — no laser
//              and a running camera ever share a frame today (if that changes: a lens reads Sam's meter, never a box). What no scenario has is a RED teammate laser to compare (a scenario's teammate never shows one): the red line's own
//              invisibility to every reader is the same mechanism (NoShadow boxes, no light) and is held by ir-draw's 'every box NoShadow'.
//   ir-off     THE SWITCH: IR.on false is the build before — every teammate's laser the old red draw field for field whatever his goggles and the picture
//              do, Sam with none; flipped in play it takes hold inside a frame; the Team feel rows are kept by teamfeel.ts. (The frame-for-frame identity
//              against the merged base is `bun run tools/qa/irlaser-probes.ts digest`: one hash per scenario of a scripted minute with the switch off, the
//              frames' boxes included; the same file copied into a checkout of the base must print the same lines.)
// The family's own red path: IR_BREAK=1 bun run tools/qa/probes.ts ir-draw must FAIL (a bare-eyed picture told it is the tube's).
import { ROOT } from './headless.ts';
import { stage } from './bang-tally.ts';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { standUp } = await import('./headless.ts');
const CBM: any = await import(`${ROOT}/src/game/combat.ts`);
const NVM: any = await import(`${ROOT}/src/game/nvg.ts`);
const GDM: any = await import(`${ROOT}/src/game/guards.ts`);
const RFM: any = await import(`${ROOT}/src/game/roomfight.ts`);
const DTM: any = await import(`${ROOT}/src/game/doortools.ts`);
const IRM: any = await import(`${ROOT}/src/game/irlaser.ts`).catch(() => null);
const CUM: any = await import(`${ROOT}/src/game/cues.ts`).catch(() => null);   // (the defenders' cues, a later default-on switch that rewords lines the digest carries: off for `digest`, where the checkout has it)   // (null in a checkout from before the module: only `digest` runs there)
const BDM: any = await import(`${ROOT}/src/game/buddy.ts`).catch(() => null);   // (the lone defender's radio call: null in a checkout from before it)
const DWM: any = await import(`${ROOT}/src/game/doorway.ts`).catch(() => null);   // (doorway manners: a later default-on switch, pinned off in `digest` where the checkout has it)
const RWM: any = await import(`${ROOT}/src/game/rearwatch.ts`).catch(() => null);   // (the stack's rear man on the door behind: a later default-on switch, pinned off in `digest` where the checkout has it)
const DGM: any = await import(`${ROOT}/src/game/digin.ts`).catch(() => null);   // (the dig-in: `digest` pins its later default-on brace rule off where the checkout has it)
const SLM: any = await import(`${ROOT}/src/game/silent.ts`).catch(() => null);   // (the squad's posture: a later default-on switch, pinned off in `digest` where the checkout has it)
const ILM: any = await import(`${ROOT}/src/game/irlight.ts`).catch(() => null);   // (the infrared light on the goggles, a later default-on switch: pinned off in `digest` where the checkout has it)
const IR: any = IRM?.IR ?? { on: false };
const LASER = CBM.LASER;
const laserBoxesOld: (g: any, gd: any, out: any[]) => void = ((await import('./laser-probes.ts')) as any).laserBoxesOld;   // the draw before combat.ts LASER, kept verbatim there: the reference (not exported in a checkout from before this file — `digest` does not use it)

const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
const BREAK = !!process.env.IR_BREAK;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const IR_DEFAULTS = JSON.parse(JSON.stringify(IR));
const reset = () => { Object.assign(IR, JSON.parse(JSON.stringify(IR_DEFAULTS))); LASER.enemy = false; };
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { reset(); } };
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const IDS: string[] = (SCENARIOS as any[]).map(e => e.id);

// ---------------------------------------------------------------- what a laser's boxes look like
const thin = (b: any) => !!b.emissive && b.h[0] < 0.02 && b.h[1] < 0.02;
/** an infrared laser's line or dot: no hue, no albedo (combat.ts beamBoxes' `ir`) */
const isIr = (b: any) => thin(b) && b.emissive[0] > 0 && b.emissive[0] === b.emissive[1] && b.emissive[1] === b.emissive[2] && b.albedo[0] === 0 && b.albedo[1] === 0;
/** a red laser's line or dot (a weapon's or a tripwire's) */
const isRed = (b: any) => thin(b) && b.emissive[0] > 0.1 && b.emissive[1] < b.emissive[0] * 0.1 && (b.albedo[0] === 0.02 || b.albedo[0] === 0.05);
const noShadow = (b: any) => !!(b.flags & BoxFlag.NoShadow);
/** a box on this character's bore (his laser, not a tripwire across the corridor or another man's) */
const onBore = (c: any, b: any) => { const m = c.muzzle, d = c.gunDir, r = v3.sub(b.c, m), t = v3.dot(r, d); return t > 0 && v3.len(v3.sub(r, v3.scale(d, t))) < 0.05; };
const draw = (g: any, gd: any) => { const out: any[] = []; CBM.laserBoxes(g, gd, out); return out; };
const drawOld = (g: any, gd: any) => { const out: any[] = []; laserBoxesOld(g, gd, out); return out; };
const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
/** the same boxes but for their colour: place, size, turn, flags */
const sameShape = (a: any[], b: any[]) => a.length === b.length && a.every((x, i) => same([x.c, x.h, x.yaw, x.rot, x.flags], [b[i].c, b[i].h, b[i].yaw, b[i].rot, b[i].flags]));
/** lay a man's laser by hand: a muzzle half a metre off his chest and a unit bore (what the draw reads; nothing is stepped in between) */
const WAYS: number[][] = []; for (let k = 0; k < 8; k++) WAYS.push([Math.sin(k * Math.PI / 4 + 0.2), 0, Math.cos(k * Math.PI / 4 + 0.2)]);
const lay = (gd: any, dir: number[]) => { const c = gd.char, ch = c.bones.chest ?? [c.pos[0], 1.2, c.pos[2]]; c.muzzle = [ch[0] + dir[0] * 0.5, ch[1], ch[2] + dir[2] * 0.5]; c.gunDir = [...dir]; };
/** the picture: the tube's (as the shader has it once the goggles are down) or the bare eye's — written straight, for a draw asked between frames */
const picture = (g: any, tube: boolean) => { g.player.nv = tube; g.player.nvAmount = BREAK ? 1 : tube ? 1 : 0; };
const samLight = (g: any, on: boolean) => { const pl = g.player; if (on) { pl.slot = 'pistol'; pl.holstered = false; } pl.pistol.lightOn = on; };
const mates = (g: any): any[] => g.orders.squad().filter((x: any) => x.state !== 'dead');
const doorsOf = (S: any): any[] => { const sam = S.g.player.char.pos; const c: { ent: any; dist: number }[] = []; for (const d of S.defs) for (const e of d.room.entries) if (!c.some(q => q.ent === e)) c.push({ ent: e, dist: flat(sam, e.at) }); c.sort((a, b) => a.dist - b.dist); return c.map(q => q.ent); };
/** a scenario as its row starts it, the team fallen in on Sam and four seconds on: every man's goggles are where his place puts them */
async function settled(id: string) {
  const S: any = await quiet(() => stage(id, 1)); const { g, step } = S;
  await quiet(() => g.orders.give('fallIn', g.orders.targetAt(g.player.char.pos), 'all')); step(240);
  return S;
}
function fnv() { let h = 0x811c9dc5 >>> 0; return { eat: (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } }, hex: () => (h >>> 0).toString(16).padStart(8, '0') }; }

// ---------------------------------------------------------------- ir-draw
export const irDraw = guarded(async () => {
  const F = family('ir-draw: a teammate\'s laser is infrared behind his goggles — in the tube\'s picture only — and the red one it was with them up');
  let downMen = 0, upMen = 0;
  for (const id of IDS) {
    const S = await settled(id); const { g } = S; const team = mates(g);
    // ---- every man where his goggles are, his laser laid eight ways, both pictures
    let bare = 0, tubeBad = 0, tubeBoxes = 0, upBad = 0, upBoxes = 0, upOff = 0, down = 0, up = 0, shadowed = 0, ownOff = 0;
    for (const x of team) {
      const isDown = NVM.nvgDown(g, x); if (isDown) down++; else up++;
      for (const d of WAYS) { lay(x, d); const old = drawOld(g, x);
        picture(g, false); const a = draw(g, x); picture(g, true); const b = draw(g, x); picture(g, false);
        if (isDown) { bare += a.length; tubeBoxes += b.length; shadowed += b.filter(q => !noShadow(q)).length;
          const R = CBM.laserReach(g, x.char, x, true), own = !!R && !!R.on && IRM.paintsOwn(g, x, R.on), civ = !!R && !!R.on && !own && !g.guards.some((o: any) => o.char === R.on);   // (laid onto Sam or a teammate: thumb off the switch; onto a hostage: it ends there, where the red one went on)
          if (own) { ownOff++; if (b.length) tubeBad++; } else if (civ) { if (!b.every(isIr) || b.length === 0) tubeBad++; } else if (!sameShape(b, old) || !b.every(isIr) || b.length === 0) tubeBad++; }
        else { upBoxes += a.length; if (!same(a, old) || !same(b, old) || a.length === 0) upBad++; }
      } }
    downMen += down; upMen += up;
    F.verdict(bare === 0 && tubeBad === 0 && upBad === 0 && upOff === 0 && shadowed === 0 && down + up === team.length && team.length > 0, `${id}: ${down} of ${team.length} on goggles — each man's laser laid eight ways`,
      `goggles down: boxes in a bare-eyed picture ${bare} (want 0) · in the tube's: ${tubeBoxes}, stagings not the old line and dot in the infrared tint ${tubeBad} (want 0; ${ownOff} laid onto Sam or a teammate: no line, as wanted), boxes not NoShadow ${shadowed} · goggles up: ${upBoxes} boxes, stagings not the old red draw field for field in either picture ${upBad} (want 0)`);
  }
  F.verdict(downMen >= 4 && upMen >= 1, 'not vacuous: men with goggles down and men with them up were both read', `${downMen} man-stagings goggles down, ${upMen} goggles up, over ${IDS.length} scenarios`);
  // ---- the line between the two pictures is the shader's, not the key's
  { const S = await settled(IDS[0]); const { g } = S; const x = mates(g).find((m: any) => NVM.nvgDown(g, m)); let detail = 'no goggled man';
    let ok = !!x; if (x) { const way = WAYS.find(w => { lay(x, w); const R = CBM.laserReach(g, x.char, x, true); return !!R && !(R.on && IRM.paintsOwn(g, x, R.on)); }) ?? WAYS[0]; lay(x, way);   // (a way his bore lies on none of his own: laid onto Sam or a teammate the infrared line is off whatever the picture)
      const at = (nv: boolean, amt: number) => { g.player.nv = nv; g.player.nvAmount = BREAK ? 1 : amt; return draw(g, x).length; };
      const r = [at(true, 0), at(true, 0.49), at(true, 0.51), at(false, 0.51), at(false, 0.49), at(false, 0)]; picture(g, false);
      ok = r[0] === 0 && r[1] === 0 && r[2] > 0 && r[3] > 0 && r[4] === 0 && r[5] === 0;
      detail = `${x.callsign} goggled, his laser's boxes at N on + tube 0 / 0.49 / 0.51: ${r[0]} / ${r[1]} / ${r[2]} · N off + tube 0.51 / 0.49 / 0: ${r[3]} / ${r[4]} / ${r[5]} (the picture is the tube's past 0.5: post.wgsl)`; }
    F.verdict(ok, 'shown exactly while the picture is the tube\'s: the goggles coming down show nothing infrared to the bare-eyed frames before the swap', detail); }
  // ---- through Game.update: a lit walk, every man's band his own goggles' every frame
  for (const id of [IDS[0], IDS[IDS.length - 1]]) {
    const S = await settled(id); const { g, step } = S; const team = mates(g); const O = g.orders;
    let frames = 0, bandBad = 0, drawBad = 0, irMan = 0, redMan = 0, flips = 0; const last = new Map<any, boolean>();
    const watch = () => { frames++; for (const x of team) { if (x.state === 'dead') continue; const isDown = NVM.nvgDown(g, x), band = IRM.laserBand(g, x);
        if (band !== (isDown ? 'ir' : 'visible')) bandBad++; if (isDown) irMan++; else redMan++;
        if (last.has(x) && last.get(x) !== isDown) flips++; last.set(x, isDown);
        const b = draw(g, x), old = drawOld(g, x); if (isDown ? b.length !== 0 : !same(b, old)) drawBad++; } };   // (Sam's goggles are up the whole walk: a bare-eyed picture)
    for (let f = 0; f < 60; f++) { step(); watch(); }
    samLight(g, true); step(30);
    for (const e of doorsOf(S)) if (!(await quiet(() => O.give('stack', O.targetAt(e.door.frameCentre), 'all')))) break;
    for (let f = 0; f < 60 * 12; f++) { step(); watch(); }
    samLight(g, false);
    for (let f = 0; f < 60 * 6; f++) { step(); watch(); }
    F.verdict(bandBad === 0 && drawBad === 0 && irMan > 0 && redMan > 0 && flips >= 2, `${id}: a walk with Sam's light switched on and off again, Sam bare-eyed`,
      `${frames} frames · man-frames goggles down ${irMan}, up ${redMan}, goggles flipped ${flips} times · frames a man's band was not his own goggles' ${bandBad} (want 0) · frames his draw was not 'nothing when down, the old red line when up' ${drawBad} (want 0)`);
  }
  // ---- when it is on: the gun at his shoulder, through Game.update, Sam's goggles down
  for (const id of [IDS[0], IDS[2]]) {
    const S = await settled(id); const { g, step } = S; const team = mates(g); g.player.nv = true; step(30);
    let up = 0, upShown = 0, lowered = 0, loweredShown = 0, bad = 0, frames = 0;
    const O = g.orders; for (const e of doorsOf(S)) if (!(await quiet(() => O.give('stack', O.targetAt(e.door.frameCentre), 'all')))) break;
    // (Sam's own line is told from a man's by BEING Sam's — the boxes irlaser.ts draws for him this frame — not by lying near Sam's bore: a teammate's 0.6 m
    //  line onto a wall beside him had both its boxes within 5 cm of Sam's bore for one frame of a walk, and read as not shown with the line there)
    const watch = (count: boolean) => { let shownAny = 0; const samB: any[] = []; IRM.samLaserBoxes(g, samB); const sams = (b: any) => samB.some((q: any) => q.c[0] === b.c[0] && q.c[1] === b.c[1] && q.c[2] === b.c[2]);
      for (const x of team) { if (x.state === 'dead') continue; const reach = CBM.laserReach(g, x.char, x, true), own = !!reach && !!reach.on && IRM.paintsOwn(g, x, reach.on), on = IRM.laserOn(g, x) && !own, shown = g.dynBoxes.some((b: any) => isIr(b) && onBore(x.char, b) && !sams(b));
        if (shown) shownAny++; if (!count) continue;
        if (on) { up++; if (shown) upShown++; else if (reach) bad++; } else { lowered++; if (shown) { loweredShown++; bad++; } } } return shownAny; };
    for (let f = 0; f < 60 * 12; f++) { step(); frames++; watch(true); }
    IR.carry = false; let carryOff = 0; for (let f = 0; f < 60; f++) { step(); carryOff += watch(false); } IR.carry = true;
    const st = team.map((x: any) => x.state).filter((s: string, i: number, a: string[]) => a.indexOf(s) === i).join(', ');
    F.verdict(bad === 0 && upShown > 0 && lowered > 0 && carryOff === 0, `${id}: when a goggled man's laser is on — a walk to a stack, Sam's goggles down`,
      `${frames} frames, the team in state ${st} throughout · man-frames with the gun at the shoulder ${up}: his infrared line in that frame's boxes ${upShown} · man-frames with it lowered or off the shoulder ${lowered}: shown ${loweredShown} (want 0) · mismatches ${bad} (want 0) · IR.carry off, the next second: ${carryOff} teammates' lines (want 0 — nobody hunting, as before the file)`);
  }
  // ---- an enemy handed his laser back is never infrared
  { const S = await settled(IDS[0]); const { g } = S; const foe = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead'); let ir = 0, red = 0, off = 0;
    if (foe) { foe.state = 'alert'; for (const d of WAYS) { lay(foe, d); for (const tube of [false, true]) { picture(g, tube); off += draw(g, foe).length; LASER.enemy = true; const b = draw(g, foe); LASER.enemy = false; ir += b.filter(isIr).length; red += b.filter(isRed).length; } } picture(g, false); }
    F.verdict(!!foe && ir === 0 && off === 0 && (red > 0 || !g.fogOfWar.seen(foe)), `${IDS[0]}: an enemy (${foe?.callsign ?? 'none'}) has no goggles and no infrared`, `his laser eight ways in both pictures: ${off} boxes as shipped (want 0) · with LASER.enemy on: ${red} red, ${ir} infrared (want 0)`); }
  // ---- a hostage stops an infrared line (the red one never stopped on a civilian and is left alone)
  { const id = IDS.find(i => /rescue/.test(i)) ?? IDS[0]; const S = await settled(id); const { g } = S; const x = mates(g)[0];
    const hs: any[] = (g.civilians ?? []).filter((c: any) => c.state !== 'dead' && c.char.alive); let stopped = 0, through = 0, tried = 0, note = 'no hostage standing';
    if (x && hs.length) { const h = hs[0], hc = h.char.bones.chest ?? [h.char.pos[0], 0.9, h.char.pos[2]], keep = [x.char.muzzle, x.char.gunDir];
      for (const d of WAYS) { x.char.muzzle = [hc[0] - d[0] * 1.2, hc[1], hc[2] - d[2] * 1.2]; x.char.gunDir = [...d];
        const body = h.char.rayHit(v3.mad(x.char.muzzle, d, 0.02), d, 30); if (body < 0) continue;
        const ir = CBM.laserReach(g, x.char, x, true), red = CBM.laserReach(g, x.char, x, false);
        if (!red || red.L < body - 1e-6) continue;   // (a wall or a man between this muzzle and the body: not a line onto it)
        tried++; if (ir && Math.abs(ir.L - body) < 1e-6 && ir.dot) stopped++; if (red.L > body + 0.05) through++; }
      [x.char.muzzle, x.char.gunDir] = keep; note = `${h.callsign ?? 'a hostage'}, ${tried} lines laid onto the body from 1.2 m: the infrared one ends on it in ${stopped}, the red one's reach went on past it in ${through}`; }
    F.verdict(tried > 0 && stopped === tried, `${id}: an infrared line ends on a hostage in its way`, note); }
  return F.done();
});

// ---------------------------------------------------------------- ir-sam
/** Sam's laser among a frame's boxes: infrared boxes on his own bore */
const samIr = (g: any) => g.dynBoxes.filter((b: any) => isIr(b) && onBore(g.player.char, b));
export const irSam = guarded(async () => {
  const F = family('ir-sam: Sam\'s own gun carries one — infrared with his goggles down, nothing with them up');
  for (const id of [IDS[0], IDS[IDS.length - 1]]) {
    const S = await settled(id); const { g, step } = S; const pl = g.player;
    const hp = () => { const out: any[] = []; CBM.handProps(g, out); return out; };
    // goggles up: nothing of his
    const upNow = samIr(g).length, upOn = hp().length; IR.on = false; const upOff = hp().length; IR.on = true;
    // goggles down, through Game.update: in step with the picture's swap
    let early = 0, late = 0, shown = 0, f0 = -1; pl.nv = true;
    for (let f = 0; f < 60; f++) { step(); const n = samIr(g).length, tube = pl.nvAmount > 0.5; if (n > 0 && !tube) early++; if (n === 0 && tube) late++; if (n > 0) { shown++; if (f0 < 0) f0 = f; } }
    const boxes = samIr(g), line = boxes.find((b: any) => b.h[2] > 0.02), dot = boxes.find((b: any) => b.h[2] <= 0.02);
    const from = v3.mad(pl.char.muzzle, pl.char.gunDir, 0.02), startsAtMuzzle = !!line && v3.len(v3.sub(v3.mad(line.c, pl.char.gunDir, -line.h[2]), from)) < 0.03;   // (dynBoxes are this frame's: the muzzle is this frame's too)
    const allNoShadow = boxes.every(noShadow), gun = pl.rifleUp ? 'rifle' : pl.pistolUp ? 'pistol' : 'nothing';
    const lightsOn = g.engine.lights.lights.length;
    IR.sam = false; step(2); const noSam = samIr(g).length; IR.sam = true; IR.on = false; step(2); const noIr = samIr(g).length; IR.on = true; step(2); const back = samIr(g).length;
    pl.holstered = true; step(3); const holst = samIr(g).length; pl.holstered = false; step(30); const drawn = samIr(g).length;
    // goggles up again: gone the frame the key is pressed
    let afterUp = 0; pl.nv = false; for (let f = 0; f < 30; f++) { step(); afterUp += samIr(g).length; }
    F.verdict(upNow === 0 && upOn === upOff && early === 0 && late === 0 && shown > 30 && !!line && startsAtMuzzle && allNoShadow && noSam === 0 && noIr === 0 && back > 0 && holst === 0 && drawn > 0 && afterUp === 0, `${id}: the ${gun} in his hands`,
      `goggles up: ${upNow} infrared boxes on his bore, his rig the same ${upOn} boxes with IR on as off (${upOff}) · N pressed: first shown ${f0 + 1} frames on, frames shown before the picture was the tube's ${early}, not shown once it was ${late} (want 0, 0) · then a line ${line ? (2 * line.h[2]).toFixed(2) + ' m from the muzzle' : 'MISSING'}${dot ? ' and a dot' : ', no dot (nothing inside 30 m)'}, all NoShadow ${allNoShadow} · IR.sam off ${noSam}, IR.on off ${noIr}, back on ${back} · holstered ${holst}, drawn again ${drawn} · N again: infrared boxes over the next half second ${afterUp} (want 0) · lights in the list throughout: ${lightsOn}`);
    // sprinting / down
    pl.nv = true; step(30); const before = samIr(g).length; const his = () => hp().filter((q: any) => isIr(q) && onBore(pl.char, q)).length;   // (his own: the teammates' lines are in the same frame)
    const hpN = his(); pl.sprinting = true; const sprint = his(); pl.sprinting = false; pl.down = true; const dn = his(); pl.down = false;
    F.verdict(before > 0 && hpN > 0 && sprint === 0 && dn === 0, `${id}: not while he sprints, not from a downed man`, `gun up ${hpN} · sprinting ${sprint} · down ${dn}`);
    // the pistol: only once it is pointed — at the relaxed carry the bore is not where he aims
    pl.slot = 'pistol'; pl.holstered = false; pl.pistol.lightOn = false; step(90); const carry = pl.char.anim.upper, relaxed = samIr(g).length;
    pl.pistol.lightOn = true; step(60); const upper = pl.char.anim.upper, pointed = samIr(g).length; pl.pistol.lightOn = false;
    F.verdict(carry !== 'aim' && relaxed === 0 && upper === 'aim' && pointed > 0, `${id}: the pistol — no line from the relaxed carry, one once the gun is up`, `carried '${carry}': ${relaxed} infrared boxes on his bore (want 0) · brought up (behind its light) '${upper}': ${pointed}`);
  }
  // no team, no device: the office at night alone
  { const W: any = await quiet(() => standUp()); const g = W.game; g.godMode = true; g.playerInvisible = true; const pl = g.player;
    pl.slot = 'pistol'; pl.holstered = false; pl.nv = true; for (let i = 0; i < 60; i++) W.step(DT);
    const n = g.dynBoxes.filter(isIr).length, st = IRM.irState(g);
    F.verdict(n === 0 && !st.sam && st.men.length === 0 && pl.nvAmount > 0.5, 'the office at night with no team: goggles down, pistol up — no laser (the solo game as it was)', `infrared boxes ${n} · irState sam ${st.sam}, men ${st.men.length} · "${IRM.irSummary(g)}"`); }
  return F.done();
});

// ---------------------------------------------------------------- ir-unseen
interface Play { hash: string; frames: number; irFrames: number; irMateFrames: number; redMateFrames: number; onFoe: number; hunting: number; gogHunting: number; camSeen: number; awMax: number; lightsMin: number; lightsMax: number; unshadowed: number; shots: number; down: number; raw: any }
/** a scenario played through a held door from its own seed: fall in, stack, open and clear, the room's men alive — every frame hashed and its boxes counted */
async function play(id: string, nv: boolean, irOn: boolean): Promise<Play | null> {
  const S: any = await quiet(() => stage(id, 1)); const { g, step } = S; const O = g.orders; IR.on = irOn; g.player.nv = nv;
  const team = mates(g), foes = g.guards.filter((x: any) => x.team === 'hostile'); const H = fnv();
  const R: Play = { hash: '', frames: 0, irFrames: 0, irMateFrames: 0, redMateFrames: 0, onFoe: 0, hunting: 0, gogHunting: 0, camSeen: 0, awMax: 0, lightsMin: Infinity, lightsMax: 0, unshadowed: 0, shots: 0, down: 0, raw: null };
  const shots0 = foes.reduce((n: number, x: any) => n + x.weapon.shotsFired, 0);
  const frame = () => { step(); R.frames++;
    H.eat(JSON.stringify(digestGame(g, true)));
    for (const x of g.guards) H.eat(`${x.callsign}:${x.state}:${x.awareness.toFixed(5)}:${x.flashlight?.enabled ? 1 : 0}:${x.char.pos[0].toFixed(4)},${x.char.pos[2].toFixed(4)},${x.char.aimYaw.toFixed(4)}:${(x.irradiance ?? 0).toFixed(5)}:${(x.visibility ?? 0).toFixed(5)}|`);
    for (const c of g.devices?.cameras ?? []) { H.eat(`cam:${c.seen.toFixed(5)}:${c.state}|`); R.camSeen = Math.max(R.camSeen, c.seen); }
    const L = g.engine.lights.lights; R.lightsMin = Math.min(R.lightsMin, L.length); R.lightsMax = Math.max(R.lightsMax, L.length);
    for (const l of L) H.eat(`${l.name}:${l.kind}:${l.enabled ? 1 : 0}:${l.intensity.toFixed(4)}:${l.pos[0].toFixed(3)},${l.pos[1].toFixed(3)},${l.pos[2].toFixed(3)}|`);
    H.eat(`sam:${g.player.visibility.toFixed(5)}:${(g.player.irradiance ?? 0).toFixed(5)}|`);
    for (const x of foes) if (x.state !== 'dead') R.awMax = Math.max(R.awMax, x.awareness);
    const lasers = g.dynBoxes.filter((b: any) => isIr(b) || isRed(b)); R.unshadowed += lasers.filter((b: any) => !noShadow(b)).length;
    if (lasers.some(isIr)) R.irFrames++;
    let irMate = false, redMate = false;
    for (const x of team) { if (x.state === 'dead') continue; const gog = NVM.nvgDown(g, x), armed = gog ? x.char.anim.upper === 'aim' && !x.muzzleDown && !x.held : (x.state === 'alert' || x.state === 'search') && !x.muzzleDown && !x.held; if (!armed) continue; R.hunting++;   // (the frames his laser is on with IR on — asked of the man, not of the switch: the IR-off runs count the same frames)
      if (gog) R.gogHunting++;
      if (lasers.some((b: any) => isIr(b) && onBore(x.char, b))) irMate = true; if (lasers.some((b: any) => isRed(b) && onBore(x.char, b))) redMate = true;
      if (gog) { const reach = CBM.laserReach(g, x.char, x); if (reach) for (const h of foes) if (h.state !== 'dead' && Math.abs(h.char.rayHit(reach.from, reach.dir, reach.L + 0.05) - reach.L) < 0.02) { R.onFoe++; break; } } }
    if (irMate) R.irMateFrames++; if (redMate) R.redMateFrames++;
  };
  const sam = g.player.char.pos; await quiet(() => O.give('fallIn', O.targetAt([sam[0], 0, sam[2]]), 'all')); for (let f = 0; f < 120; f++) frame();
  let fc: any = null, why: string | void = 'no door';
  for (const e of doorsOf(S)) { fc = e.door.frameCentre; why = await quiet(() => O.give('stack', O.targetAt(fc), 'all')); if (!why) break; }
  if (why) return null;
  for (let f = 0; f < 60 * 14; f++) frame();
  await quiet(() => O.give('openClear', O.targetAt(fc), 'all')); for (let f = 0; f < 60 * 30; f++) frame();
  R.hash = H.hex(); R.shots = foes.reduce((n: number, x: any) => n + x.weapon.shotsFired, 0) - shots0; R.down = foes.filter((x: any) => x.state === 'dead').length; R.raw = digestGame(g, true);
  reset(); return R;
}
export const irUnseen = guarded(async () => {
  const F = family('ir-unseen: nobody reads a laser — no enemy\'s awareness, no camera and no light differs for an infrared one, a red one or none');
  let onFoe = 0, irMate = 0;
  for (const id of IDS) {
    const A = await play(id, true, true), B = await play(id, true, false), A2 = await play(id, true, true), C = await play(id, false, true), D = await play(id, false, false);
    if (!A || !B || !A2 || !C || !D) { F.verdict(false, `${id}: a door to stack on`, 'the stack order was refused'); continue; }
    onFoe += A.onFoe; irMate += A.irMateFrames;
    const tubeSame = A.hash === B.hash, control = A.hash === A2.hash, bareSame = C.hash === D.hash;
    F.verdict(tubeSame && control && bareSame && A.irFrames > 0 && B.irFrames === 0 && C.irFrames === 0 && D.irFrames === 0 && A.redMateFrames === 0 && A.unshadowed + B.unshadowed + C.unshadowed + D.unshadowed === 0 && A.lightsMin === B.lightsMin && A.lightsMax === B.lightsMax, `${id}: ${A.frames} frames through a held door, five times from one seed`,
      `Sam's goggles DOWN — IR on: infrared boxes in ${A.irFrames} frames (a teammate's in ${A.irMateFrames}, on a living enemy in ${A.onFoe}), a teammate's red line in ${A.redMateFrames}; IR off: infrared in ${B.irFrames}, a teammate's red line in ${B.redMateFrames}; the game, every man's awareness, every camera and the light list, frame for frame: ${tubeSame ? 'identical' : 'DIFFERENT'} (the control, on twice: ${control ? 'identical' : 'DIFFERENT — this harness run is not deterministic'}) · `
      + `Sam's goggles UP — IR on: infrared boxes in ${C.irFrames} frames (want 0) over ${C.gogHunting} man-frames of a goggled teammate with his gun up, red in ${C.redMateFrames}; IR off: red in ${D.redMateFrames}; frame for frame: ${bareSame ? 'identical' : 'DIFFERENT'} · `
      + `enemies: highest awareness ${A.awMax.toFixed(2)} / ${B.awMax.toFixed(2)}, rounds ${A.shots} / ${B.shots}, down ${A.down} / ${B.down} · cameras' integrators peak ${A.camSeen.toFixed(2)} · lights in the list ${A.lightsMin}‥${A.lightsMax} / ${B.lightsMin}‥${B.lightsMax} · laser boxes not NoShadow: ${A.unshadowed + B.unshadowed + C.unshadowed + D.unshadowed}`);
  }
  F.verdict(onFoe > 0 && irMate > 0, 'not vacuous: infrared beams were in the frames and lay on living enemies', `${irMate} frames with a teammate's infrared line over ${IDS.length} scenarios, ${onFoe} man-frames of one ending on a living enemy`);
  // ---- an enemy and a camera looked at closely: Sam LIT and seen (the plays above keep him the sandbox's invisible man in the dark), his IR laser on, in their view
  { type Look = { hash: string; peak: number; ir: number; frames: number; who: string };
    const look = async (id: string | null, what: 'foe' | 'cam', irOn: boolean): Promise<Look | null> => {
      const dice = Math.random; if (!id) { let k = 0x1f2e3d; Math.random = () => { k = (k + 0x6D2B79F5) | 0; let t = Math.imul(k ^ (k >>> 15), 1 | k); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }   // (the solo office is stood up bare: seed its dice as stage() seeds a scenario's, or two runs are two shifts)
      const S: any = id ? await quiet(() => stage(id, 1)) : { W: await quiet(() => standUp()) }; const W = S.W, g = W.game; IR.on = irOn; const pl = g.player; g.godMode = true;
      if (!id) { pl.slot = 'pistol'; pl.holstered = false; }   // (the office at night, alone: the one game the level's cameras run in)
      pl.nv = true; g.playerInvisible = false; g.aiEnabled = true;
      const lit = () => { pl.visibility = 1; W.step(DT); };   // (the meter's stand-in: plainly lit)
      const foe = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead'), cams: any[] = g.devices?.cameras ?? [];
      if (what === 'foe' ? !foe : !cams.length) { reset(); if (!id) Math.random = dice; return null; }
      const H = fnv(); let peak = 0, ir = 0, frames = 0, who = '';
      if (what === 'foe') { who = foe.callsign; await quiet(() => g.teleportPlayer([foe.char.pos[0] + Math.sin(foe.char.bodyYaw) * 3.5, 0, foe.char.pos[2] + Math.cos(foe.char.bodyYaw) * 3.5])); }
      else { const c = cams[0]; who = c.def.name ?? 'camera 1'; const p = c.def.pos, y = c.def.yaw; await quiet(() => g.teleportPlayer([p[0] + Math.sin(y) * 3, 0, p[2] + Math.cos(y) * 3])); }
      for (let f = 0; f < 60 * 8; f++) { await quiet(lit); frames++; if (what === 'foe' ? samIr(g).length : g.dynBoxes.some(isIr)) ir++;
        for (const c of cams) { H.eat(`cam:${c.seen.toFixed(6)}:${c.state}|`); if (what === 'cam') peak = Math.max(peak, c.seen); }
        for (const x of g.guards) if (x.team === 'hostile') { H.eat(`${x.state}:${x.awareness.toFixed(6)}|`); if (what === 'foe' && x.state !== 'dead') peak = Math.max(peak, x.awareness); }
        H.eat(`sam:${pl.visibility.toFixed(6)}|${g.engine.lights.lights.length}|`); }
      reset(); if (!id) Math.random = dice; return { hash: H.hex(), peak, ir, frames, who };
    };
    { const id = IDS[0]; const a = await look(id, 'foe', true), b = await look(id, 'foe', false), a2 = await look(id, 'foe', true);
      if (!a || !b || !a2) F.verdict(false, `${id}: an enemy's eyes`, 'no living enemy to stand in front of');
      else F.verdict(a.hash === b.hash && a.hash === a2.hash && a.ir > 0 && b.ir === 0 && a.peak > 0.05, `${id}: Sam lit and in an enemy's eyes (${a.who}) with his IR laser on, eight seconds`,
        `IR on: his infrared line in ${a.ir} of ${a.frames} frames; off: ${b.ir} · every enemy's awareness and state, every camera's integrator, Sam's meter and the light count, frame for frame: ${a.hash === b.hash ? 'identical' : 'DIFFERENT'} (control: ${a.hash === a2.hash ? 'identical' : 'DIFFERENT'}) · the enemies' awareness peaked ${a.peak.toFixed(2)} / ${b.peak.toFixed(2)} (he IS seen — and no differently for the laser)`); }
    // CAMERAS: the level's cameras do not run while a scenario's machine has the floor (devices.ts sensing) — the only games that have a team and so a laser.
    // Held both ways: with a team, Sam lit in a lens fills nothing, laser or not; alone in the office, where they run, the lens fills and nothing infrared exists.
    { const id = IDS[1]; const a = await look(id, 'cam', true), b = await look(id, 'cam', false);
      const c = await look(null, 'cam', true), d = await look(null, 'cam', false);
      if (!a || !b || !c || !d) F.verdict(false, 'a camera\'s lens', 'no camera on the office level');
      else F.verdict(a.hash === b.hash && a.ir > 0 && b.ir === 0 && a.peak === 0 && b.peak === 0 && c.hash === d.hash && c.peak > 0.05 && c.ir === 0 && d.ir === 0, `a camera's lens (${c.who}), Sam lit in it for eight seconds: no laser and a running camera ever share a frame`,
        `${id} (a team on the floor): infrared boxes in ${a.ir} of ${a.frames} frames with IR on, ${b.ir} off — the integrator stays ${a.peak.toFixed(2)} / ${b.peak.toFixed(2)} (the cameras do not run in a scenario), frame for frame ${a.hash === b.hash ? 'identical' : 'DIFFERENT'} · the office alone (cameras running): the integrator fills to ${c.peak.toFixed(2)} / ${d.peak.toFixed(2)}, infrared boxes ${c.ir} / ${d.ir} (no team, no laser), frame for frame ${c.hash === d.hash ? 'identical' : 'DIFFERENT'}`); }
  }
  return F.done();
});

// ---------------------------------------------------------------- ir-off
export const irOff = guarded(async () => {
  const F = family('ir-off: the switch off is the lasers of the build before; its rows are kept like the other team-feel rows');
  let bad = 0, n = 0, samBoxes = 0, men = 0;
  for (const id of IDS) {
    const S = await settled(id); const { g, step } = S; IR.on = false;
    for (const tube of [false, true]) { picture(g, tube);
      for (const x of mates(g)) { men++; for (const d of WAYS) { lay(x, d); const a = draw(g, x), old = drawOld(g, x); n += old.length; if (!same(a, old)) bad++; } } }
    g.player.nv = true; step(30); samBoxes += g.dynBoxes.filter(isIr).length; reset();
  }
  F.verdict(bad === 0 && n > 0 && samBoxes === 0, 'IR.on false: every teammate\'s laser is the old draw, goggles and picture regardless; Sam has none', `${men} man-pictures over ${IDS.length} scenarios, eight ways each: ${bad} stagings differ from the draw before the switch (want 0; ${n} boxes compared field for field) · infrared boxes in a frame with Sam's goggles down: ${samBoxes} (want 0)`);
  // a flip in play
  { const S = await settled(IDS[0]); const { g, step } = S; g.player.nv = true; step(30); const was = samIr(g).length; IR.on = false; step(1); const mid = g.dynBoxes.filter(isIr).length; IR.on = true; step(1); const back = samIr(g).length;
    F.verdict(was > 0 && mid === 0 && back > 0, 'flipped in play: off inside a frame, on again inside a frame', `infrared boxes ${was} → ${mid} → ${back}`); }
  // the panel's rows
  { const TFM: any = await import(`${ROOT}/src/game/teamfeel.ts`); const rows = ['on', 'sam', 'carry'], kept = rows.filter(k => TFM.feelRange('IR', k) === null);
    F.verdict(kept.length === rows.length && TFM.feelTables().IR === IR && rows.every(k => k in IR) && IR_DEFAULTS.on === true, 'the Team feel rows: three switches, the table the module reads, shipped on', `kept as switches: ${kept.join(', ')} · feelTables().IR is irlaser.ts IR: ${TFM.feelTables().IR === IR} · shipped: ${JSON.stringify(IR_DEFAULTS)}`); }
  return F.done();
});

// ---------------------------------------------------------------- digest (the cross-commit identity: run this file's `digest` here and in a checkout of the merged base)
/** one hash per scenario of a scripted minute with IR.on false (or with no irlaser.ts at all): fall in, stack, open and clear with the room's men alive, Sam's
 *  goggles down for the middle of it — the game's digest, every man's place and light, and EVERY BOX the frame hands the renderer */
export async function digestLines(): Promise<string[]> {
  const out: string[] = [], sights0 = RFM.ROOMFIGHT.sights, buddy0 = DTM.DOORTOOLS.buddy, other0 = (DTM.DOORTOOLS as any).otherDoorM, cues0 = CUM?.CUES.on, call0 = BDM?.BUDDY.on, door0 = DWM?.DOORMANNERS.on;
  if (DWM) DWM.DOORMANNERS.on = false;   // (before the first staging: stage() steps frames of its own)
  const CVM: any = await import(`${ROOT}/src/game/cover.ts`).catch(() => null), keep0 = CVM?.COVER.backKeep; if (CVM && 'backKeep' in CVM.COVER) CVM.COVER.backKeep = false;   // (a later default-on rule of the cover's: off for the whole digest, put back at its end)
  const brace0 = DGM?.DIGIN.braceInRoom, fbIn0 = RFM.ROOMFIGHT.fallBackIn; if (DGM && 'braceInRoom' in DGM.DIGIN) DGM.DIGIN.braceInRoom = false;   // (the brace goal rule: a later default-on rule, off for the whole digest, put back at its end)
  for (const id of IDS) {
    const S: any = await quiet(() => stage(id, 1)); const { g, step } = S; const O = g.orders; IR.on = false; if (ILM) ILM.IRLIGHT.on = false; if (CUM) CUM.CUES.on = false; if ('litMan' in GDM.LIGHTS) GDM.LIGHTS.litMan = false; if ('sights' in RFM.ROOMFIGHT) RFM.ROOMFIGHT.sights = false; if ('workOut' in O.knobs) O.knobs.workOut = false; if ('hallFile' in O.knobs) O.knobs.hallFile = false; if ('secondFloor' in O.knobs) O.knobs.secondFloor = false; if ('cleared' in O.knobs) Object.assign(O.knobs, { cleared: false, knownFace: false, ownDoor: false }); if ('roundCap' in O.knobs) O.knobs.roundCap = 0; if ('fileHold' in O.knobs) O.knobs.fileHold = false; if ('backEnd' in O.knobs) O.knobs.backEnd = false; if ('inWay' in O.knobs) O.knobs.inWay = false; if ('walkTries' in O.knobs) O.knobs.walkTries = false; if ('buddy' in DTM.DOORTOOLS) DTM.DOORTOOLS.buddy = false; if ('otherDoorM' in DTM.DOORTOOLS) (DTM.DOORTOOLS as any).otherDoorM = 0; if ('ownCan' in DTM.DOORTOOLS) (DTM.DOORTOOLS as any).ownCan = false; if ('behindSam' in DTM.DOORTOOLS) (DTM.DOORTOOLS as any).behindSam = false; if ('haltBack' in DTM.DOORTOOLS) (DTM.DOORTOOLS as any).haltBack = false; if ('thrHand' in DTM.DOORTOOLS) (DTM.DOORTOOLS as any).thrHand = false; for (const k of ['thrNoCan', 'thrFragHold', 'fragHold', 'thrDoorsLeaf']) if (k in DTM.DOORTOOLS) (DTM.DOORTOOLS as any)[k] = false; if (BDM) BDM.BUDDY.on = false; if (SLM) SLM.SILENT.on = false; if (DWM) DWM.DOORMANNERS.on = false; if (RWM) { RWM.REARWATCH.on = false; RWM.REARWATCH.room = false; } if ('fallBackIn' in RFM.ROOMFIGHT) RFM.ROOMFIGHT.fallBackIn = false; const H = fnv(); let lasers = 0;   // (litMan, sights: later default-on rules, off where the checkout has them so this stays the base's digest; stage() puts them back)
    const frame = () => { step(); H.eat(JSON.stringify(digestGame(g, true)));
      for (const x of g.guards) H.eat(`${x.flashlight?.enabled ? 1 : 0}${x.state[0]}${x.char.pos[0].toFixed(4)},${x.char.pos[2].toFixed(4)},${x.char.aimYaw.toFixed(4)}`);
      for (const b of g.dynBoxes) { H.eat(`${b.c[0].toFixed(4)},${b.c[1].toFixed(4)},${b.c[2].toFixed(4)};${b.h[0].toFixed(4)},${b.h[1].toFixed(4)},${b.h[2].toFixed(4)};${b.flags};${b.emissive ? b.emissive.map((e: number) => e.toFixed(3)).join(',') : ''}|`); if (isRed(b)) lasers++; } };
    const sam = g.player.char.pos; await quiet(() => O.give('fallIn', O.targetAt([sam[0], 0, sam[2]]), 'all')); for (let f = 0; f < 120; f++) frame();
    let fc: any = null; for (const e of doorsOf(S)) { fc = e.door.frameCentre; if (!(await quiet(() => O.give('stack', O.targetAt(fc), 'all')))) break; }
    for (let f = 0; f < 60 * 8; f++) frame();
    g.player.nv = true; for (let f = 0; f < 60 * 7; f++) frame();
    await quiet(() => O.give('openClear', O.targetAt(fc), 'all')); for (let f = 0; f < 60 * 20; f++) frame();
    g.player.nv = false; for (let f = 0; f < 60 * 20; f++) frame();
    out.push(`${id}: ${H.hex()} · ${g.guards.filter((x: any) => x.state !== 'dead').length} of ${g.guards.length} standing at ${g.time.toFixed(2)} s · red laser boxes hashed ${lasers}`);
    reset();
  }
  if ('sights' in RFM.ROOMFIGHT) RFM.ROOMFIGHT.sights = sights0; if ('buddy' in DTM.DOORTOOLS) DTM.DOORTOOLS.buddy = buddy0; if ('otherDoorM' in DTM.DOORTOOLS) (DTM.DOORTOOLS as any).otherDoorM = other0; if ('ownCan' in DTM.DOORTOOLS) (DTM.DOORTOOLS as any).ownCan = true; if (CUM) CUM.CUES.on = cues0; if (BDM) BDM.BUDDY.on = call0; if (DWM) DWM.DOORMANNERS.on = door0;
  if (DGM && 'braceInRoom' in DGM.DIGIN) DGM.DIGIN.braceInRoom = brace0; if ('fallBackIn' in RFM.ROOMFIGHT) RFM.ROOMFIGHT.fallBackIn = fbIn0;
  if (CVM && 'backKeep' in CVM.COVER) CVM.COVER.backKeep = keep0;
  return out;
}
if (import.meta.main && process.argv[2] === 'digest') { for (const l of await digestLines()) console.log(l); process.exit(0); }
