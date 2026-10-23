// What a shot costs (src/game/aimcost.ts): a lamp needs a real hit, and moving feet open the cone.
//
//   bun run tools/qa/aimcost-check.ts            (probes.ts aimcost; also under `player`; passes on both stands)
//   AIMCOST_BREAK=1 bun run tools/qa/aimcost-check.ts     the two switches left OFF for the lines that ask for them: must fail
//
//  1  lampStruck: the bulb's own point, a round stopped just short of a recessed bulb, a fixture's own box, and the misses beside each
//  2  every fixture of several levels shot DEAD ON from all round it: the real-hit rule never refuses a round the old rule let break it
//     (and what it does refuse: the same shots laid 0.25 m off the bulb)
//  3  real rounds in the office: dead on breaks the lamp, 0.25 m under it does not (and is counted as 'passed near'); rule off, that round breaks it
//  4  a lamp is a thing to settle on: the reticle onto another lamp starts the settle over (rule off: it carries)
//  5  the pistol's cone standing / walking / 0.35 s and 0.7 s after stopping, rule on against off; the same for the rifle
//  6  the HIT TABLES those cones give (a seeded die laid the way combat.ts lays a round): a bulb at 10 / 15 / 20 m, a man at 5 / 10 / 15 m
//  7  the aiming ring opens past 60 px only under the rule
//  8  a guard starts no burst while his feet still remember the run — and is settled a second later (rule off: the cap lifts the frame he stops)
//  9  both switches off = the terms as they were; a recording with no AIMCOST table replays with both off

import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');

export async function aimcostCheck(): Promise<boolean> {
  const { stage } = await import('./fn2000-probes.ts');
  const { standUp } = await import('./headless.ts');
  const { AIMCOST, AIMCOST_STATS, lampStruck } = await import(`${ROOT}/src/game/aimcost.ts`);
  const { AIM, playerAim, trackGuard, trackPlayer } = await import(`${ROOT}/src/game/aim.ts`);
  const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
  const { rifleSpread } = await import(`${ROOT}/src/game/player.ts`);
  const { applyKnobs, knobsSnapshot } = await import(`${ROOT}/src/game/journal.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
  const seeded = (a: number) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const DT = 1 / 60; let all = true;
  const BREAK = process.env.AIMCOST_BREAK === '1';
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const was = { ...AIMCOST }, wasStats = { ...AIMCOST_STATS }, wasSnap = AIM.player.lightSnapPx;
  const rule = (lamp: boolean, move: boolean) => { AIMCOST.lamp = lamp && !BREAK; AIMCOST.move = move && !BREAK; };
  console.log(`\n=== what a shot costs: a lamp needs a real hit, moving feet open the cone${BREAK ? ' (AIMCOST_BREAK: the switches left off)' : ''} ===`);
  try {
    // ---- 1: the rule itself ------------------------------------------------------------------------------------------
    {
      const o: [number, number, number] = [0, 1.4, 0]; const leg = (ty: number, tz: number, end: number) => { const d = v3.normalize([10, ty - 1.4, tz]); return [{ o, d, end }]; };
      const bulb: [number, number, number] = [10, 1.4, 0];
      const a = lampStruck(bulb, [], false, leg(1.4, 0.10, 40)), b = lampStruck(bulb, [], false, leg(1.4, 0.20, 40));
      const c = lampStruck(bulb, [], false, leg(1.4, 0, 9.9)), d = lampStruck(bulb, [], false, leg(1.4, 0, 9.5));
      const tube = { c: [10, 1.4, 0], h: [0.02, 0.02, 0.6], yaw: 0, flags: 0 } as any;
      const e = lampStruck(bulb, [tube], false, leg(1.4, 0.5, 40)), f = lampStruck(bulb, [tube], false, leg(1.65, 0.5, 40));
      const s = lampStruck(bulb, [tube], true, leg(3, 3, 1));
      line(a && !b && c && !d && e && !f && s, '1 the rule: the bulb itself, a bulb just behind where the round stopped, the fixture\'s own box — and not beside them',
        `10 m: 0.10 m off the bulb ${a ? 'hit' : 'miss'}, 0.20 m off ${b ? 'hit' : 'miss'} · stopped 0.1 m short ${c ? 'hit' : 'miss'}, 0.5 m short ${d ? 'hit' : 'miss'} · through a tube 0.5 m from its middle ${e ? 'hit' : 'miss'}, 0.25 m over it ${f ? 'hit' : 'miss'} · the round's own ray stopped in it ${s ? 'hit' : 'miss'}`);
    }

    // ---- 2: every fixture of several levels, dead on and laid off --------------------------------------------------
    {
      const near = (t: any, legs: any[], slack: number) => { const rad = t.kind === 'emissive' ? 0.45 : t.kind === 'breaker' ? 0.4 : 0.3; for (const s of legs) { const toT = v3.sub(t.pos, s.o); const depth = v3.dot(toT, s.d); if (depth > s.end + slack) continue; if (v3.len(v3.sub(toT, v3.scale(s.d, Math.max(0, Math.min(depth, s.end))))) < rad) return true; } return false; };
      let shots = 0, oldDead = 0, newDead = 0, refused = 0, oldOff = 0, newOff = 0, fixtures = 0, behind = 0, behindOld = 0, behindNew = 0; const lost: string[] = [], shut: string[] = [];
      for (const name of ['office', 'bazaar', 'vault', 'lights-out', 'police-post', 'compound', 'records']) {
        Math.random = seeded(7);
        const W: any = await standUp({ level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${name}.json`, 'utf8'))) });
        const g = W.game, st = g.engine.world.statics;
        for (const t of g.targets) {
          if (!t.interactive || t.broken) continue; fixtures++;
          const slack = t.kind === 'breaker' ? 0.08 : 0.3; const boxes = t.boxes.map((i: number) => st[i]); let oldAny = false, newAny = false;
          for (const R of [4, 9, 15]) for (let k = 0; k < 16; k++) {
            const a = k / 16 * Math.PI * 2; const o: [number, number, number] = [t.pos[0] + Math.sin(a) * R, 1.35, t.pos[2] + Math.cos(a) * R];
            const cast = (at: number[]) => { const d = v3.normalize(v3.sub(at, o)); const h = g.col.raycast(o, d, 80); return { legs: [{ o, d, end: h ? h.t : 80 }], stopped: !!h && t.boxes.includes(h.index) }; };
            const dead = cast(t.pos); const dist = v3.dist(o, t.pos); const gap = dist - dead.legs[0].end;
            if (gap > 0.5 && !dead.stopped) continue;   // something else is in the way from here: no shot at it either way
            const od = near(t, dead.legs, slack), nd = lampStruck(t.pos, boxes, dead.stopped, dead.legs, AIMCOST.bare, Math.min(slack, AIMCOST.slack));
            if (od) oldAny = true; if (nd) newAny = true;
            // the round stopped in something that is NOT the fixture, more than `slack` short of it: the thing is behind cover from here
            // (the old rule's 0.3 m reach past the stop broke it THROUGH that cover; a real hit does not, on purpose)
            if (!dead.stopped && gap > AIMCOST.slack) { behind++; if (od) behindOld++; if (nd) behindNew++; continue; }
            shots++;
            if (od) oldDead++; if (nd) newDead++; if (od && !nd) { refused++; if (lost.length < 4) lost.push(`${name}:${t.name} from ${R} m (stopped ${gap.toFixed(2)} m short)`); }
            const off = cast([t.pos[0], t.pos[1] - 0.25, t.pos[2]]);
            if (near(t, off.legs, slack)) oldOff++; if (lampStruck(t.pos, boxes, off.stopped, off.legs, AIMCOST.bare, Math.min(slack, AIMCOST.slack))) newOff++;
          }
          if (oldAny && !newAny) shut.push(`${name}:${t.name}`);
        }
      }
      line(shots > 500 && refused === 0 && newDead >= oldDead && shut.length === 0, '2 every fixture of eight levels shot dead on from all round: the real-hit rule refuses no round that reaches the thing, and no fixture the old rule could break is left unbreakable',
        `${fixtures} fixtures, ${shots} clear shots · dead on: ${oldDead} broke by the old rule, ${newDead} by a real hit, refused ${refused}${lost.length ? ` (${lost.join(', ')})` : ''} · fixtures no angle breaks any more: ${shut.length}${shut.length ? ` (${shut.slice(0, 6).join(', ')})` : ''} · ${behind} more shots stopped in something else 0.15‥0.5 m short of the thing: the old rule broke it through that on ${behindOld}, a real hit on ${behindNew} · the clear shots laid 0.25 m under the bulb: ${oldOff} broke by the old rule, ${newOff} by a real hit (those ${newOff} still meet the fixture's own box)`);
    }

    // ---- the office, Sam with his pistol up -----------------------------------------------------------------------------
    const W: any = await stage(5101, false, [21.5, 0, 11.5]); const { game, input } = W; const pl = game.player, c = pl.char;
    AIM.player.lightSnapPx = 60;
    for (let i = 0; i < 3 && !pl.pistolUp; i++) { input.pressed.add(i === 0 ? 'Digit1' : 'KeyE'); for (let k = 0; k < 50; k++) W.step(DT); }
    const lamp = (n: string) => game.targets.find((t: any) => t.name === n);
    const eye = (p: number[]) => [p[0], 1.35, p[2]];
    /** floor near `from` about `d` metres from the thing with a clear line to it, where he really stands after being put there */
    const spotFor = (t: any, d: number): number[] | null => {
      for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; const p = [t.pos[0] + Math.sin(a) * d, 0, t.pos[2] + Math.cos(a) * d];
        const dir = v3.normalize(v3.sub(t.pos, eye(p))); const h = game.col.raycast(eye(p), dir, 60); const dist = v3.dist(eye(p), t.pos);
        if (h && h.t < dist - 0.3 && !t.boxes.includes(h.index)) continue;
        game.teleportPlayer(p); for (let i = 0; i < 4; i++) W.step(DT); pl.aim.clear();   // (cleared AFTER: being put somewhere reads as a 6 m/s step to the feet)
        if (v3.distXZ(c.pos, p) < 0.1) return p; }
      return null;
    };
    const hold = (p: number[], n: number, keys: string[] = []) => { for (let i = 0; i < n; i++) { for (const k of keys) input.keys.add(k); W.cursorAt(p); W.step(DT); for (const k of keys) input.keys.delete(k); } };

    // ---- 3: real rounds ----------------------------------------------------------------------------------------------
    {
      // (lit things: an unlit fixture — a beacon before the blackout — is no target to either rule)
      const shoot = (t: any, at: number[]) => { hold(at, 3); fireWeapon(game, c, at, true, { spread: 0 }); W.step(DT); return !!t.broken; };
      const place = (t: any) => { for (const d of [6, 4, 3, 2.2]) { const p = spotFor(t, d); if (p) return p; } return null; };
      const A = lamp('desk_lamp'), B = lamp('storage_bulb');
      rule(true, true);
      const pa = A ? place(A) : null; const deadOn = pa ? shoot(A, A.pos) : false;
      const pb = B ? place(B) : null; const n0 = AIMCOST_STATS.lampNear; const under = B ? [B.pos[0], B.pos[1] - 0.25, B.pos[2]] : [0, 0, 0];
      const offOn = pb ? shoot(B, under) : true; const counted = AIMCOST_STATS.lampNear - n0;
      rule(false, true); const offOld = pb ? shoot(B, under) : false; rule(true, true);
      line(!!pa && !!pb && deadOn && !offOn && counted === 1 && offOld, '3 real rounds: dead on breaks the lamp; 0.25 m under it does not, and is counted as passed near; with the rule off that same round breaks it',
        `the desk lamp dead on: ${deadOn ? 'broken' : 'STANDS'} · the storage bulb, the round 0.25 m under it: ${offOn ? 'BROKEN' : 'stands'} (passed near +${counted}) · rule off, the same round: ${offOld ? 'broken' : 'STANDS'}${!pa || !pb ? ' · NO PLACE TO SHOOT FROM' : ''}`);
    }

    // ---- 4: a lamp is a thing to settle on ---------------------------------------------------------------------------
    const L1 = lamp('panel_corridor_18'), L2 = lamp('panel_corridor_19');
    game.teleportPlayer([22.5, 0, 11.1]); for (let i = 0; i < 4; i++) W.step(DT);
    {
      const swing = () => { pl.aim.clear(); hold(L1.pos, 90); const on1 = game.aimTarget === L1; const t1 = pl.aim.track; hold(L2.pos, 2); return { on1, on2: game.aimTarget === L2, t1, t2: pl.aim.track }; };
      rule(true, true); const a = swing(); rule(false, true); const b = swing(); rule(true, true);
      line(a.on1 && a.on2 && a.t1 > 0.95 && a.t2 < 0.15 && b.t2 > 0.9, '4 the reticle onto another lamp starts the settle over (rule off: it carries, as it did)',
        `settled on one lamp ${a.t1.toFixed(2)} → two frames onto the next ${a.t2.toFixed(2)} · rule off ${b.t1.toFixed(2)} → ${b.t2.toFixed(2)} · the reticle had the lamps: ${a.on1 && a.on2}`);
    }

    // ---- 5: the cones -------------------------------------------------------------------------------------------------
    // (the corridor, walking west along it with the cursor held on a lamp down it)
    type Cones = { settled: number; snap: number; crouched: number; walk: number; s35: number; s70: number; s150: number; speed: number };
    const cones = (gun: () => number): Cones => {
      const far = lamp('panel_corridor_16'); pl.crouch = false;
      game.teleportPlayer([24, 0, 11.1]); for (let i = 0; i < 4; i++) W.step(DT); pl.aim.clear();
      hold(far.pos, 120); const settled = gun();
      hold([24, 0, 12.2], 30); hold(far.pos, 2); const snap = gun();
      pl.crouch = true; hold(far.pos, 120); const crouched = gun(); pl.crouch = false; hold(far.pos, 30);
      const x0 = c.pos[0]; let key = 'KeyA'; hold(far.pos, 20, [key]); if (Math.abs(c.pos[0] - x0) < 0.2) { for (const k of ['KeyW', 'KeyD', 'KeyS']) { const x = c.pos[0], z = c.pos[2]; hold(far.pos, 20, [k]); if (Math.hypot(c.pos[0] - x, c.pos[2] - z) > 0.2) { key = k; break; } } }
      hold(far.pos, 70, [key]); const speed = Math.hypot(c.vel[0], c.vel[2]); const walk = gun();
      hold(far.pos, 21); const s35 = gun(); hold(far.pos, 21); const s70 = gun(); hold(far.pos, 48); const s150 = gun();
      return { settled, snap, crouched, walk, s35, s70, s150, speed };
    };
    const fmt = (k: Cones) => `standing settled ${k.settled.toFixed(3)} · snap ${k.snap.toFixed(3)} · crouched ${k.crouched.toFixed(3)} · walking (${k.speed.toFixed(2)} m/s) ${k.walk.toFixed(3)} · 0.35 s after stopping ${k.s35.toFixed(3)} · 0.7 s ${k.s70.toFixed(3)} · 1.5 s ${k.s150.toFixed(3)}`;
    const pistol = () => playerAim(game).spread;
    rule(true, true); const pOn = cones(pistol); rule(true, false); const pOff = cones(pistol); rule(true, true);
    line(pl.pistolUp && pOn.speed > 1 && pOn.walk > pOff.walk * 1.6 && pOn.s35 > pOff.s35 * 2 && Math.abs(pOn.s150 - pOff.s150) < 1e-9 && Math.abs(pOn.settled - pOff.settled) < 1e-9,
      '5a the pistol: walking opens the cone, a stop does not close it on the same step, and stood still it is the cone it was',
      `rule on:  ${fmt(pOn)}\n    rule off: ${fmt(pOff)}`);
    // the rifle
    input.pressed.add('Digit2'); hold([28, 1.2, 11.1], 60);
    const rifle = () => rifleSpread(game, Math.hypot(c.vel[0], c.vel[2])) + playerAim(game).spread;
    rule(true, true); const rOn = cones(rifle); rule(true, false); const rOff = cones(rifle); rule(true, true);
    line(pl.rifleUp && rOn.walk > rOff.walk * 1.5 && rOn.s35 > rOff.s35 * 1.5 && Math.abs(rOn.s150 - rOff.s150) < 1e-9 && Math.abs(rOn.settled - rOff.settled) < 1e-9,
      '5b the rifle: the same, through its brace',
      `rule on:  ${fmt(rOn)}\n    rule off: ${fmt(rOff)}`);

    // ---- 6: what those cones hit --------------------------------------------------------------------------------------
    {
      // combat.ts lays a round as dir + (die − ½) × spread on each axis, normalised: the same here, on a die of the check's own
      const N = 20000;
      const rate = (spread: number, dist: number, hit: (dy: number, dz: number) => boolean) => { const die = seeded(991 + Math.round(dist * 10)); let n = 0; for (let i = 0; i < N; i++) { const x = 1 + (die() - 0.5) * spread, y = (die() - 0.5) * spread, z = (die() - 0.5) * spread; if (hit(y / x * dist, z / x * dist)) n++; } return n / N; };
      const bulb = (r: number) => (dy: number, dz: number) => Math.hypot(dy, dz) < r;
      const man = (dy: number, dz: number) => Math.abs(dz) < 0.2 && dy > -1.2 && dy < 0.45;   // a man's column 0.4 m wide, the round laid on his chest
      const row = (name: string, s: number, ds: number[], hit: (dy: number, dz: number) => boolean) => `${name.padEnd(34)} ${ds.map(d => `${d} m ${pct(rate(s, d, hit)).padStart(5)}`).join('  ')}`;
      const LD = [10, 15, 20], MD = [5, 10, 15];
      console.log('    A LAMP, the pistol (a real hit = within 0.12 m of the bulb; the old rule took 0.3 m — 0.45 for a lit panel):');
      for (const [n, s] of [['settled, standing', pOn.settled], ['settled, crouched', pOn.crouched], ['swing and click (unsettled)', pOn.snap], ['walking', pOn.walk], ['0.35 s after stopping', pOn.s35], ['0.7 s after stopping', pOn.s70]] as [string, number][])
        console.log(`      ${row(n, s, LD, bulb(AIMCOST.bare))}   · old rule ${LD.map(d => pct(rate(s === pOn.snap ? pOff.settled : n.startsWith('walking') ? pOff.walk : n.startsWith('0.35') ? pOff.s35 : n.startsWith('0.7') ? pOff.s70 : s, d, bulb(0.3)))).join(' / ')}`);
      console.log('    A MAN, the round laid on his chest (rule on · rule off):');
      for (const [n, a, b] of [['pistol, settled', pOn.settled, pOff.settled], ['pistol, walking', pOn.walk, pOff.walk], ['pistol, 0.35 s after stopping', pOn.s35, pOff.s35], ['pistol, 0.7 s after stopping', pOn.s70, pOff.s70], ['rifle, settled', rOn.settled, rOff.settled], ['rifle, walking', rOn.walk, rOff.walk], ['rifle, 0.35 s after stopping', rOn.s35, rOff.s35]] as [string, number, number][])
        console.log(`      ${row(n, a, MD, man)}   · ${MD.map(d => pct(rate(b, d, man))).join(' / ')}`);
      const settled10 = rate(pOn.settled, 10, bulb(AIMCOST.bare)), snap15 = rate(pOn.snap, 15, bulb(AIMCOST.bare)), walk10 = rate(pOn.walk, 10, bulb(AIMCOST.bare)), old15 = rate(pOff.settled, 15, bulb(0.3));
      const manWalkOn = rate(pOn.walk, 10, man), manWalkOff = rate(pOff.walk, 10, man), manStill = rate(pOn.settled, 10, man);
      line(settled10 > 0.95 && snap15 < 0.5 && walk10 < 0.15 && old15 > 0.95 && manWalkOn < manWalkOff * 0.7 && manStill > 0.95,
        '6 the hit tables: a settled pistol still takes a lamp at 10 m, a swing-and-click at 15 m mostly does not, a walking shot rarely; a walking shot at a man is clearly worse than it was and a planted one is not',
        `lamp: settled 10 m ${pct(settled10)}, swing-and-click 15 m ${pct(snap15)}, walking 10 m ${pct(walk10)} (the old rule at 15 m, any of them: ${pct(old15)}) · man at 10 m: planted ${pct(manStill)}, walking ${pct(manWalkOn)} (was ${pct(manWalkOff)})`);
    }

    // ---- 7: the ring ---------------------------------------------------------------------------------------------------
    {
      let ringOn = NaN, ringOff = NaN, how = 'overlay.ts aimRingPx';
      try {
        const { aimRingPx } = await import(`${ROOT}/src/ui/overlay.ts`);
        ringOn = aimRingPx(pOn.walk, 10, W.cam, 1000, AIMCOST.move ? AIMCOST.ringPx : 60); ringOff = aimRingPx(pOff.walk, 10, W.cam, 1000, 60);
      } catch (e) { how = `overlay.ts did not load headless (${String(e).slice(0, 60)})`; }
      line(Number.isFinite(ringOn) && ringOn > 60 && ringOn <= AIMCOST.ringPx && ringOff <= 60, '7 the aiming ring opens past 60 px only under the rule (what he reads the cost on)',
        `a walking pistol at 10 m, 1000 px tall view: ${ringOn.toFixed(0)} px with the rule, ${ringOff.toFixed(0)} px without · ${how}`);
    }

    // ---- 8: a guard plants before he shoots ----------------------------------------------------------------------------
    {
      const gd = game.guards[0]; const gc = gd.char;
      const run = () => {
        game.teleportPlayer([20, 0, 11.1]); for (let i = 0; i < 3; i++) W.step(DT);
        gc.pos = [27, 0, 11.1]; gd.state = 'alert'; gd.reactT = 0; gd.foe = 'player'; gd.pinned = false; gd.dazzledUntil = -1; gd.aim.clear();
        const face = () => { const tr = c.bones.spine2 ?? c.bones.hips ?? c.pos; const y = Math.atan2(tr[0] - gc.pos[0], tr[2] - gc.pos[2]); gc.aimYaw = y; gc.bodyYaw = y; const tn = (gc as any).tn; if (tn) tn.aim = y; gd.lastSeenT = game.time; };   // (tn: under turn weight the fire gate reads where the gun has GOT to — put it there, this asks about feet)
        const tick = (n: number, v: number) => { for (let i = 0; i < n; i++) { face(); gc.vel = [-v, 0, 0]; trackGuard(game, gd, DT); } };
        tick(60, 2.5); const running = gd.aim.track; tick(15, 0); const q = gd.aim.track; tick(75, 0); const settled = gd.aim.track;
        return { running, q, settled };
      };
      const saved = { pos: [...gc.pos], state: gd.state, reactT: gd.reactT, foe: gd.foe, pinned: gd.pinned, aimYaw: gc.aimYaw, bodyYaw: gc.bodyYaw, vel: [...gc.vel], lastSeenT: gd.lastSeenT };
      rule(true, false); const b = run(); rule(true, true); const a = run();
      gc.pos = saved.pos as any; gd.state = saved.state; gd.reactT = saved.reactT; gd.foe = saved.foe; gd.pinned = saved.pinned; gc.aimYaw = saved.aimYaw; gc.bodyYaw = saved.bodyYaw; gc.vel = saved.vel as any; gd.lastSeenT = saved.lastSeenT; gd.aim.clear();
      const min = AIM.guard.acquireMin;
      line(a.running < min && a.q < min && a.settled > 0.95 && b.q > a.q + 0.05, '8 a guard out of a run starts no burst while his feet still remember it, and is settled a second and a half later (rule off: the cap lifts the frame he stops)',
        `track running ${a.running.toFixed(2)} · 0.25 s after he stops ${a.q.toFixed(2)} (he fires from ${min}) · 1.5 s after ${a.settled.toFixed(2)} · rule off: ${b.running.toFixed(2)} / ${b.q.toFixed(2)} / ${b.settled.toFixed(2)}`);
    }

    // ---- 8b: the edges ---------------------------------------------------------------------------------------------------
    {
      rule(true, true);
      // (the rule alone) a leg born inside the fixture's own box meets it; a device's body is longer than a bulb
      const body = { c: [10, 1.4, 0], h: [0.3, 0.1, 0.6], yaw: 0, flags: 0 } as any;
      const born = lampStruck([10, 1.4, 0.5], [body], false, [{ o: [10, 1.4, -0.3], d: [1, 0, 0], end: 5 }], 0.01);
      const beside = lampStruck([10, 1.4, 0.5], [body], false, [{ o: [10.5, 1.4, -0.3], d: [1, 0, 0], end: 5 }], 0.01);
      const off14 = [{ o: [0, 1.4, 0.14], d: [1, 0, 0], end: 40 }] as any;
      const dev = lampStruck([10, 1.4, 0], [], false, off14, AIMCOST.bareDevice), bulb = lampStruck([10, 1.4, 0], [], false, off14);
      // being put somewhere is not a stride: no feet are remembered for it
      const home = [21.5, 0, 11.5]; game.teleportPlayer(home); for (let i = 0; i < 4; i++) W.step(DT); pl.aim.clear(); hold([26, 1.2, 11.5], 60);
      game.teleportPlayer([23.5, 0, 11.5]); hold([28, 1.2, 11.5], 2); const put = pl.aim.moveSm;
      // a show is the game as it was
      hold([28, 1.2, 11.5], 40, ['KeyD']); const walk = playerAim(game).spread; game.touring = true; const show = playerAim(game).spread; game.touring = false;
      rule(true, false); const plain = playerAim(game).spread; rule(true, true);
      hold([28, 1.2, 11.5], 120);
      // off a man, across a lamp, straight back onto the man: he has what he had
      const gd = game.guards[0], L = lamp('panel_corridor_18'); const keep = { g: game.aimGuard, t: game.aimTarget };
      pl.aim.clear(); game.aimGuard = gd; game.aimTarget = null; for (let i = 0; i < 90; i++) trackPlayer(game, DT); const onMan = pl.aim.track;
      game.aimGuard = null; game.aimTarget = L; trackPlayer(game, DT); const onLamp = pl.aim.track;
      game.aimGuard = gd; game.aimTarget = null; trackPlayer(game, DT); const backOn = pl.aim.track;
      game.aimGuard = keep.g; game.aimTarget = keep.t; pl.aim.clear();
      line(born && !beside && dev && !bulb && put < 0.05 && show === plain && plain < walk && !!L && onMan > 0.3 && onLamp < onMan * 0.5 && backOn > onMan - 0.05,
        '8b the edges: a round born inside a fixture meets it, a device\'s body is longer than a bulb, being put somewhere is no stride, a show plays as it was, and a lamp crossed on the way back to a man costs nothing',
        `born inside the box ${born ? 'hit' : 'miss'}, beside it flying away ${beside ? 'hit' : 'miss'} · 0.14 m off a device ${dev ? 'hit' : 'miss'}, off a bulb ${bulb ? 'hit' : 'miss'} · remembered feet after a 2 m put ${put.toFixed(2)} m/s · walking cone ${walk.toFixed(3)}, under a show ${show.toFixed(3)}, rule off ${plain.toFixed(3)} · track on the man ${onMan.toFixed(2)}, across the lamp ${onLamp.toFixed(2)}, back on him ${backOn.toFixed(2)}`);
    }

    // ---- 9: off, and an old recording ------------------------------------------------------------------------------------
    {
      AIMCOST.lamp = true; AIMCOST.move = true;
      let threw = '';
      try { const k = knobsSnapshot(game); delete (k.tables as any).AIMCOST; applyKnobs(game, k); } catch (e) { threw = String(e).slice(0, 80); }
      const replayOff = !AIMCOST.lamp && !AIMCOST.move;
      AIMCOST.lamp = false; AIMCOST.move = false; const base = cones(rifle);   // (the rifle is still in his hands from 5b)
      const same = Math.abs(base.walk - rOff.walk) < 1e-9 && Math.abs(base.s35 - rOff.s35) < 1e-9 && pl.aim.moveSm === 0;
      line(replayOff && same && !threw, '9 both off: the feet are not remembered and the cone is the one it was; a recording with no AIMCOST table replays with both off',
        `after applyKnobs with no table: lamp ${AIMCOST.lamp ? 'on' : 'off'} (was read ${replayOff ? 'off' : 'ON'}), move as lamp${threw ? ` · applyKnobs threw: ${threw}` : ''} · walking cone ${base.walk.toFixed(3)}, remembered feet ${pl.aim.moveSm}`);
    }

    // ---- 10: the breaker's panel (last: the mains stay off) ---------------------------------------------------------------
    {
      rule(true, true);
      const bt = game.targets.find((t: any) => t.kind === 'breaker'); const panel = bt ? game.engine.world.statics[game.level.breaker.boxes[0]] : null;
      const at = bt ? spotFor(bt, 2.5) : null;
      if (!bt || !panel || !at) line(false, '10 the breaker\'s panel', 'no breaker / no floor with a line to it');
      else {
        const shoot = (p: number[]) => { hold(p, 3); fireWeapon(game, c, p, true, { spread: 0 }); W.step(DT); };
        const face = panel.c[2] + (c.pos[2] < panel.c[2] ? -panel.h[2] : panel.h[2]);
        shoot([panel.c[0] + panel.h[0] + 0.25, panel.c[1], face]); const beside = game.blackout.active;
        const corner = [panel.c[0] + panel.h[0] - 0.04, panel.c[1] - panel.h[1] + 0.04, face]; shoot(corner); const struck = game.blackout.active;
        line(!beside && struck, '10 a round into the breaker\'s panel, off in its corner, takes the mains; one into the wall a hand beside the panel does not',
          `0.25 m beside the panel: mains ${beside ? 'OUT' : 'on'} · into its corner, ${v3.dist(corner, bt.pos).toFixed(2)} m from the lever: mains ${struck ? 'out' : 'STILL ON'}`);
      }
    }
  } finally {
    Object.assign(AIMCOST, was); Object.assign(AIMCOST_STATS, wasStats); AIM.player.lightSnapPx = wasSnap;
  }
  return all;
}

if (import.meta.main) { const ok = await aimcostCheck(); console.log(ok ? '\n=== aimcost-check: ALL PASS ===' : '\n=== aimcost-check: FAILED ==='); process.exit(ok ? 0 : 1); }
