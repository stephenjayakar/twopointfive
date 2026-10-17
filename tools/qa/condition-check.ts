// A MAN'S CONDITION — the check behind src/game/condition.ts (CONDITION.on: on in the page, ?nocondition; off on the frozen stand, TPS_CONDITION=1).
//   bun run tools/qa/condition-check.ts        (also `probes.ts condition`; run it on both stands: it sets the switch itself)
// One room clear staged with the pair (doortools-probes.ts rig), the AI off. One burst in the open with a teammate, a defender and the player each stood in
// its wound band, in its line, the same way for every line below:
//   (1) the switch off: the burst folds all three and nobody is hurt (the build as it was)
//   (2) the switch on: the same burst leaves all three HURT, and folds each for the seconds his distance owes with the switch off — hurt adds nothing to that
//   (3) pace: a hurt defender asked for his chase pace is walked at the hurt pace by the legs' own functions (followPath, and stepAlongPath, which the
//       stand-off and a gun in a hold step him by), a sound one at his chase; a hurt teammate asked for the team's top pace the same, through followPath
//   (4) the player: hurt, Shift and W held never make a sprint (a walk's speed); sound, they do
//   (5) spread: with no fire on him a hurt defender's rounds open as at `hurtSup` (a sound one's: nothing), the player's the same by his own reader, and a
//       hurt teammate is over the line the room fight and the covering man widen his rounds at (both files ask conditionSup). Fire on him past `hurtSup`
//       opens them as that fire does, no more (the larger of the two, never a sum), and how fast he fires is the fire's alone: hurt changes no gap
//   (6) one round still puts each of them down: a hurt defender, a hurt teammate, the hurt player (one hit is all he has, hurt or not)
//   (7) god mode: the burst folds the player as it did and does not leave him hurt
//   (8) the score: a teammate at rest with a blast's wariness written on him and nobody else stirring is not tension (it was, at a third, with the switch off)
//   (9) a checkpoint taken with a man and the player hurt puts both back hurt; taken with nobody hurt it carries no such key, and loaded over hurt men
//       it leaves nobody hurt
//   (10) the registry: the knob table, the journal's list (a file without the table plays with it off), the two stands' row and word
//   (11) the figures: all three are dealt the hurt look and the fold by conditionPose; the switch off takes it back the next frame (how each reads on the
//        bones: condition-pose-check.ts)
//   (12) who is NOT hurt: a man the burst had no line to (a wall between, 'shielded') beside one in the open who is; nobody while a showcase runs (and a
//        man hurt before it reads sound for as long as it does); with `hurtSecs` set, a man that long past his blast
// CONDITION_BREAK=1 = the switch left off for the 'on' lines: (2), (3), (4), (5), (8), (9), (11) and (12) must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');

export async function conditionCheck(): Promise<boolean> {
  const { rig } = await import('./doortools-probes.ts');
  const C = await import(`${ROOT}/src/game/condition.ts`); const { CONDITION, isHurt, conditionOf, conditionSup, conditionSummary } = C;
  const { FRAG, blast, exposure } = await import(`${ROOT}/src/game/frag.ts`);
  const GU = await import(`${ROOT}/src/game/guards.ts`);
  const SU = await import(`${ROOT}/src/game/suppression.ts`);
  const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
  const { Player } = await import(`${ROOT}/src/game/game.ts`);
  const SAVE = await import(`${ROOT}/src/game/savestate.ts`);
  const KN = await import(`${ROOT}/src/game/knobs.ts`);
  const JO = await import(`${ROOT}/src/game/journal.ts`);
  const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);
  let all = true; const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  console.log('\n=== condition: a blast that leaves a man standing leaves him hurt — the player, his men and the defenders by one rule; one round still puts anyone down ===');
  const was = { ...CONDITION }; const brk = process.env.CONDITION_BREAK === '1', ON = !brk;
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const put = (gd: any, p: number[], face: number[]) => { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathI = 0; gd.pathGoal = null; gd.speed = 0; gd.lastPos = [p[0], 0, p[2]]; const y = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.char.bodyYaw = y; gd.char.aimYaw = y; };
  /** a burst point with three spots `r` m off it, free floor, each in its line head to foot, 2 m apart (searched out from the player), and none of `clear`
   *  (the men who stay where the stage stood them) inside its reach */
  const place = (g: any, r: number, clear: any[]): { at: number[]; spots: number[][] } | null => {
    const nav = g.col.nav, p0 = g.player.char.pos;
    for (let k = 0; k < 600; k++) { const a = k * 2.399963, rr = 0.6 * Math.sqrt(k); const at = [p0[0] + Math.sin(a) * rr, 0, p0[2] + Math.cos(a) * rr]; if (nav.isBlocked(at[0], at[2]) || clear.some(x => dist(x.char.pos, at) < FRAG.woundM + 1.5)) continue;
      const from = [at[0], FRAG.lift, at[2]], spots: number[][] = [];
      for (let j = 0; j < 90 && spots.length < 3; j++) { const b = j * 2.399963, q = [at[0] + Math.sin(b) * r, 0, at[2] + Math.cos(b) * r];
        if (nav.isBlocked(q[0], q[2]) || spots.some(s => dist(s, q) < 2) || exposure(g, from, q, [q[0], 1.65, q[2]]) !== 1) continue; spots.push(q); }
      if (spots.length === 3) return { at, spots }; }
    return null;
  };
  /** the room clear stood up, the three men placed, one burst: who it left how (null = the dice took one of them at every serial tried) */
  const staged = async (on: boolean, o: { god?: boolean } = {}): Promise<any> => {
    for (let serial = 1; serial <= 6; serial++) {
      const R: any = await hushed(() => rig(5101, { stage: 'rc' })); const g = R.game, pl = g.player; g.aiEnabled = false; g.godMode = !!o.god; CONDITION.on = on;
      const mate = R.ops[0], foe = R.hostiles.find((h: any) => h.state !== 'dead'); const P = mate && foe ? place(g, 7.2, g.guards.filter((x: any) => x !== mate && x !== foe)) : null; if (!mate || !foe || !P) return { err: `staging: teammate ${!!mate} · defender ${!!foe} · floor ${!!P}` };
      put(mate, P.spots[0], P.at); put(foe, P.spots[1], P.at); g.teleportPlayer([P.spots[2][0], 0, P.spots[2][2]]); pl.staggerUntil = -1; pl.dazzledUntil = -1; pl.sup.v = 0; mate.sup.v = 0; foe.sup.v = 0;
      const t0 = g.time, rep = blast(g, P.at, { who: 0, serial, fx: false });
      const of = (id: number) => rep.hits.find((h: any) => h.id === id);
      const hm = of(mate.char.id), hf = of(foe.char.id), hp = rep.hits.find((h: any) => h.name === 'you');
      if (mate.state === 'dead' || foe.state === 'dead' || pl.down || hm?.result !== 'wounded' || hf?.result !== 'wounded' || rep.player !== 'wounded') continue;   // (the dice took one of them at this serial: the next)
      return { R, g, pl, mate, foe, P, rep, t0, serial, d: { mate: hm.d, foe: hf.d, you: hp.d } };
    }
    return { err: 'no serial left all three standing' };
  };
  const owed = (d: number) => FRAG.stagger[0] + (FRAG.stagger[1] - FRAG.stagger[0]) * Math.min(1, Math.max(0, d / FRAG.woundM));
  const hurts = (S: any) => ({ mate: isHurt(S.g, S.mate), foe: isHurt(S.g, S.foe), you: isHurt(S.g, S.pl) });
  const J = (o: unknown) => JSON.stringify(o);
  try {
    // (1) off
    { const S = await staged(false); if (S.err) line(false, '(1) the switch off', S.err); else { const h = hurts(S), g = S.g;
        const folded = S.mate.staggerUntil > g.time && S.foe.staggerUntil > g.time && S.pl.staggerUntil > g.time;
        line(folded && !h.mate && !h.foe && !h.you && S.mate.hurtAt === -1 && S.foe.hurtAt === -1 && S.pl.hurtAt === -1 && conditionSummary(g) === 'condition ▸ off',
          '(1) the switch off: a burst 7 m off in the open folds a teammate, a defender and the player, and nobody is hurt', `serial ${S.serial} · ${S.mate.callsign} ${f2(S.d.mate)} m · ${S.foe.callsign} ${f2(S.d.foe)} m · you ${f2(S.d.you)} m · folded ${folded} · hurt ${J(h)} · '${conditionSummary(g)}'`); } }
    // (2) on — and the lines that ask a hurt man
    { const S = await staged(ON); if (S.err) line(false, '(2) the switch on', S.err); else { const g = S.g, pl = S.pl, mate = S.mate, foe = S.foe, h = hurts(S);
        const left = { mate: mate.staggerUntil - g.time, foe: foe.staggerUntil - g.time, you: pl.staggerUntil - g.time }, owe = { mate: owed(S.d.mate), foe: owed(S.d.foe), you: owed(S.d.you) };
        const same = Math.abs(left.mate - owe.mate) < 0.02 && Math.abs(left.foe - owe.foe) < 0.02 && Math.abs(left.you - owe.you) < 0.02;
        const co = conditionOf(g, foe), cm = conditionOf(g, mate), cy = conditionOf(g, pl);
        line(h.mate && h.foe && h.you && same && co.hurt && co.folded && !co.down && cm.hurt && cm.folded && cy.hurt && cy.folded && pl.hitsLeft === Player.MAX_HITS,
          '(2) the switch on: the same burst leaves all three hurt, and folds each for the seconds his distance owes with the switch off', `serial ${S.serial} · hurt ${J(h)} · folded ${f2(left.mate)} / ${f2(left.foe)} / ${f2(left.you)} s, owed ${f2(owe.mate)} / ${f2(owe.foe)} / ${f2(owe.you)} s · '${conditionSummary(g)}'`);
        // (11) the figures: what conditionPose deals each of the three this frame, and takes back with the switch off
        { const an = (m: any) => m.char.anim, of = () => [mate, foe, pl].map(m => ({ hurt: an(m).hurt, fold: an(m).foldToo }));
          S.R.step(1); const on = of(), shaken = an(pl).shaken; CONDITION.on = false; S.R.step(1); const off = of(), shakenOff = an(pl).shaken; CONDITION.on = ON; S.R.step(1);
          line(on.every(x => x.hurt === 1 && x.fold === true) && shaken > 0.9 && off.every(x => x.hurt === 0 && x.fold === false) && shakenOff === 0,
            '(11) each of the three figures is dealt the hurt look and the fold, the player\'s the tucked head of a man with the blast still on him; with the switch off the next frame takes all of it back', `on ${J(on)} · the player shaken ${f2(shaken)} · off ${J(off)} · shaken ${f2(shakenOff)}`); }
        // (3) pace — the legs' own function, a clear run of floor ahead of him, asked for the chase
        const legs = (gd: any, speed: number, fn: any = GU.followPath) => { const c = gd.char, keep = { st: gd.staggerUntil, rt: gd.reactT, p: [...c.pos], path: gd.path, pi: gd.pathI, sp: gd.speed, lp: gd.lastPos, yaw: c.bodyYaw };
          const to = [S.P.at[0], 0, S.P.at[2]]; gd.staggerUntil = -1; gd.path = [to]; gd.pathI = 0; gd.speed = 0; c.bodyYaw = Math.atan2(to[0] - c.pos[0], to[2] - c.pos[2]); let top = 0;
          for (let i = 0; i < 120; i++) { c.pos = [...keep.p]; gd.lastPos = [...keep.p]; fn(g, gd, 1 / 60, speed); top = Math.max(top, gd.speed); }
          c.pos = keep.p; gd.staggerUntil = keep.st; gd.reactT = keep.rt; gd.path = keep.path; gd.pathI = keep.pi; gd.speed = keep.sp; gd.lastPos = keep.lp; c.bodyYaw = keep.yaw; c.vel = [0, 0, 0]; return top; };
        const chase = g.tune.guardChase, hurtTop = legs(foe, chase); const at = foe.hurtAt; foe.hurtAt = -1; const soundTop = legs(foe, chase); foe.hurtAt = at;
        const sideTop = legs(foe, chase, GU.stepAlongPath); foe.hurtAt = -1; const sideSound = legs(foe, chase, GU.stepAlongPath); foe.hurtAt = at;
        const mateP = legs(mate, GU.PACE.max); const mAt = mate.hurtAt; mate.hurtAt = -1; const mateSound = legs(mate, GU.PACE.max); mate.hurtAt = mAt;
        const cap = CONDITION.hurtPace + 1e-6;
        line(hurtTop > 0.8 && hurtTop <= cap && soundTop > CONDITION.hurtPace + 0.5 && sideTop > 0.8 && sideTop <= cap && sideSound > CONDITION.hurtPace + 0.5 && mateP > 0.8 && mateP <= cap && mateSound > CONDITION.hurtPace + 0.3,
          '(3) a hurt defender asked for his chase pace is walked at the hurt pace by followPath and by stepAlongPath, a sound one at his chase; a hurt teammate asked for the team\'s top pace the same', `defender asked ${f2(chase)}: followPath hurt ${f2(hurtTop)} m/s · sound ${f2(soundTop)} · stepAlongPath hurt ${f2(sideTop)} · sound ${f2(sideSound)} · teammate asked ${f2(GU.PACE.max)}: hurt ${f2(mateP)} · sound ${f2(mateSound)} · hurtPace ${CONDITION.hurtPace}`);
        // (5) spread — nothing on any of them
        mate.sup.v = 0; foe.sup.v = 0; pl.sup.v = 0; const S0 = SU.SUPPRESSION;
        const gf = SU.guardFireMods(g, foe).spread, ys = SU.samSpread(g), ms = conditionSup(g, mate, 0);
        foe.hurtAt = -1; const gf0 = SU.guardFireMods(g, foe).spread; foe.hurtAt = at; const yAt = pl.hurtAt; pl.hurtAt = -1; const ys0 = SU.samSpread(g); pl.hurtAt = yAt;
        const src = (f: string) => /conditionSup\(g, gd, gd\.sup\.v\) >= SUPPRESSION\.flinch/.test(readFileSync(`${ROOT}/src/game/${f}`, 'utf8'));
        const gap0 = SU.guardFireMods(g, foe).gap, over = Math.min(1, CONDITION.hurtSup + 0.3); foe.sup.v = over; const hi = SU.guardFireMods(g, foe); foe.hurtAt = -1; const hiSound = SU.guardFireMods(g, foe); foe.hurtAt = at; foe.sup.v = 0;
        line(Math.abs(gf - S0.guardSpread * CONDITION.hurtSup) < 1e-9 && gf0 === 0 && Math.abs(ys - S0.samSpread * CONDITION.hurtSup) < 1e-9 && ys0 === 0 && ms >= S0.flinch && src('roomfight.ts') && src('coverfire.ts')
            && gap0 === 1 && hi.spread === hiSound.spread && hi.gap === hiSound.gap && hi.spread > gf,
          '(5) with no fire on him a hurt defender\'s and the hurt player\'s rounds open as at hurtSup (sound: nothing) and he fires as fast as ever; with more fire than that on him he is as a sound man under it; a hurt teammate is over the line his rounds widen at',
          `defender ${gf.toFixed(4)} rad (sound ${gf0}), gap ×${f2(gap0)} · with ${f2(over)} on him: hurt ${hi.spread.toFixed(4)} rad ×${f2(hi.gap)}, sound ${hiSound.spread.toFixed(4)} rad ×${f2(hiSound.gap)} · you ${ys.toFixed(4)} rad (sound ${ys0}) · teammate reads ${f2(ms)} against the flinch line ${S0.flinch} · roomfight.ts ${src('roomfight.ts')} · coverfire.ts ${src('coverfire.ts')}`);
        // (8) the score
        { const keep = g.guards.map((x: any) => [x.state, x.awareness]); for (const x of g.guards) if (x.state !== 'dead') { x.state = 'patrol'; x.awareness = 0; } mate.awareness = 0.92;
          const on = GU.tension(g); CONDITION.on = false; const off = GU.tension(g); CONDITION.on = ON; g.guards.forEach((x: any, i: number) => { x.state = keep[i][0]; x.awareness = keep[i][1]; });
          line(on < 0.25 && off > 0.3 && on < off - 0.05, '(8) a teammate at rest with a blast\'s wariness on him and nobody else stirring is not tension for the score (it was, with the switch off)', `tension ${f2(on)} with the switch as this run has it · ${f2(off)} off`); }
        // (4) the player's legs: Shift and W held, his stamps run out
        { const drive = () => { pl.staggerUntil = -1; pl.dazzledUntil = -1; pl.fireCd = 0; let top = 0, sprint = 0; S.R.step(2);
            for (let i = 0; i < 90; i++) { const p = [...pl.char.pos]; S.R.input.keys.add('KeyW'); S.R.input.keys.add('ShiftLeft'); S.R.step(); top = Math.max(top, dist(p, pl.char.pos) * 60); if (pl.sprinting) sprint++; }
            S.R.input.keys.delete('KeyW'); S.R.input.keys.delete('ShiftLeft'); S.R.step(20); return { top, sprint }; };
          const from = [...pl.char.pos]; const a = drive(); g.teleportPlayer([from[0], 0, from[2]]); const yAt2 = pl.hurtAt; pl.hurtAt = -1; const b = drive(); pl.hurtAt = yAt2; g.teleportPlayer([from[0], 0, from[2]]);
          line(a.sprint === 0 && a.top > 0.5 && a.top <= g.tune.playerWalk + 0.1 && b.sprint > 30 && b.top > g.tune.playerWalk + 1,
            '(4) hurt, Shift and W held never make a sprint: he walks; sound, the same keys from the same spot are a sprint', `hurt: ${a.sprint} sprint frames, top ${f2(a.top)} m/s · sound: ${b.sprint} sprint frames, top ${f2(b.top)} m/s · walk ${g.tune.playerWalk} · sprint ${g.tune.playerSprint}`); }
        // (6) one round each, from 2.5 m, at the chest
        { g.godMode = false; const chest = (c: any) => [c.pos[0], 1.2, c.pos[2]];
          /** `sh` stood 2.5 m from the man with his muzzle's line to him clear head to foot (the first such spot round him, from the burst's side) */
          const stand = (sh: any, target: any): boolean => { const c = target.char, a0 = Math.atan2(S.P.at[0] - c.pos[0], S.P.at[2] - c.pos[2]);
            for (let k = 0; k < 24; k++) { const a = a0 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * Math.PI / 12, q = [c.pos[0] + Math.sin(a) * 2.5, 0, c.pos[2] + Math.cos(a) * 2.5]; if (g.col.nav.isBlocked(q[0], q[2])) continue;
              put(sh, q, c.pos); sh.char.update(0); if (exposure(g, sh.char.muzzle, c.pos, [c.pos[0], 1.65, c.pos[2]]) === 1) return true; }
            return false; };
          put(mate, S.P.spots[0], S.P.at); put(foe, S.P.spots[1], S.P.at); mate.char.update(0); foe.char.update(0);   // (back on their spots: the frames above let them walk)
          const hurtF = isHurt(g, foe), hurtM = isHurt(g, mate), hurtY = isHurt(g, pl), hits = pl.hitsLeft;
          const gun = g.guards.find((x: any) => x.state !== 'dead' && x !== foe && x.team === foe.team);   // (another defender: his round for the teammate and for the player)
          let downF = false, downM = false, downY = false;
          const other = S.R.ops.find((x: any) => x !== mate && x.state !== 'dead');   // (the other teammate's round for the hurt defender)
          const lines = { foe: !!other && stand(other, foe), mate: false, you: false };
          if (lines.foe) { fireWeapon(g, other.char, chest(foe.char), false, { spread: 0 }); S.R.step(2); downF = foe.state === 'dead'; }
          if (gun && (lines.mate = stand(gun, mate))) { fireWeapon(g, gun.char, chest(mate.char), false, { spread: 0 }); S.R.step(2); downM = mate.state === 'dead'; }
          if (gun && (lines.you = stand(gun, pl))) { fireWeapon(g, gun.char, chest(pl.char), false, { spread: 0 }); S.R.step(2); downY = pl.down; }
          line((ON ? hurtF && hurtM && hurtY : true) && Player.MAX_HITS === 1 && hits === 1 && downF && downM && downY,
            '(6) one round still puts each of them down: the hurt defender, the hurt teammate, the hurt player (one hit is all he has)', `hurt before the round ${J({ foe: hurtF, mate: hurtM, you: hurtY })} · hits he had ${hits} of ${Player.MAX_HITS} · down after one round: defender ${downF} · teammate ${downM} · you ${downY} · a clear line for each round ${J(lines)}`); }
      } }
    // (7) god mode
    { CONDITION.on = true; let S: any = null;
      for (let k = 0; k < 1 && !S; k++) { const T = await staged(true, { god: true }); S = T; }
      if (S.err) line(false, '(7) god mode', S.err); else { const g = S.g;
        line(!isHurt(g, S.pl) && S.pl.hurtAt === -1 && S.pl.staggerUntil > g.time && isHurt(g, S.foe), '(7) god mode: the burst folds the player as it did and does not leave him hurt (the defender beside him is)', `you: hurt ${isHurt(g, S.pl)} · folded ${f2(S.pl.staggerUntil - g.time)} s · ${S.foe.callsign}: hurt ${isHurt(g, S.foe)}`); } }
    // (9) the checkpoint — alone on the office floor (a floor with a spawned unit on it takes no checkpoint)
    { const FR = await import('./frag-probes.ts'); const R: any = await hushed(() => FR.rig(71)); const g = R.game, pl = g.player, gd = g.guards.find((x: any) => x.state !== 'dead'); g.aiEnabled = false; g.godMode = false; CONDITION.on = ON; R.step(5);
      const s0 = J(SAVE.saveState(g, { kind: 'harness', force: true })); C.conditionHurt(g, gd); R.step(30); C.conditionHurt(g, pl); R.step(30);
      const had = { man: gd.hurtAt, you: pl.hurtAt }, i = g.guards.indexOf(gd), s1: any = SAVE.saveState(g, { kind: 'harness', force: true }); gd.hurtAt = -1; pl.hurtAt = -1;
      await hushed(() => SAVE.loadState(g, s1)); const back = { man: R.game.guards[i]?.hurtAt, you: R.game.player.hurtAt }, hurtBack = isHurt(R.game, R.game.guards[i]) && isHurt(R.game, R.game.player);
      await hushed(() => SAVE.loadState(g, JSON.parse(s0))); const clean = { man: R.game.guards[i]?.hurtAt, you: R.game.player.hurtAt };
      line(had.man >= 0 && had.you > had.man && back.man === had.man && back.you === had.you && hurtBack && !s0.includes('"hurtAt"') && J(s1).includes('"hurtAt"') && clean.man === -1 && clean.you === -1,
        '(9) a checkpoint taken with a man and the player hurt puts both back hurt; taken with nobody hurt it carries no key, and loaded over them it leaves nobody hurt', `saved ${J(had)} · loaded ${J(back)} · the key in a save with nobody hurt: ${s0.includes('"hurtAt"')} · that save loaded over the hurt men ${J(clean)}`); }
    // (12) who is not hurt
    { const S = await staged(ON); if (S.err) line(false, '(12) who is not hurt', S.err); else { const g = S.g, foe = S.foe, nav = g.col.nav, from = [S.P.at[0], FRAG.lift, S.P.at[2]];
        // a second defender stood where the same burst point has no line to him, inside the band it wounds in
        const hid = g.guards.find((x: any) => x.state !== 'dead' && x !== foe && x.team === foe.team && !x.civ); let spot: number[] | null = null;
        for (let k = 0; k < 400 && !spot; k++) { const a = k * 2.399963, r = 4.5 + (k % 7) * 0.45, q = [S.P.at[0] + Math.sin(a) * r, 0, S.P.at[2] + Math.cos(a) * r];
          if (!nav.isBlocked(q[0], q[2]) && exposure(g, from, q, [q[0], 1.65, q[2]]) === 0) spot = q; }
        let res = 'no floor behind a wall within its reach', hidHurt = true, openHurt = false;
        if (hid && spot) { put(hid, spot, S.P.at); foe.hurtAt = -1; foe.staggerUntil = -1; let rep: any = null;
          for (let serial = 11; serial <= 16; serial++) { rep = blast(g, S.P.at, { who: 0, serial, fx: false }); if (foe.state !== 'dead') break; }
          res = rep.hits.find((h: any) => h.id === hid.char.id)?.result ?? 'not reached'; hidHurt = isHurt(g, hid) || hid.hurtAt !== -1; openHurt = isHurt(g, foe); }
        // a showcase: nobody is left hurt by it, and a man hurt before it reads sound while it runs
        const tour = g.touring; foe.hurtAt = g.time; g.touring = true; const inShow = isHurt(g, foe), mate2 = S.mate; mate2.hurtAt = -1; const took = C.conditionHurt(g, mate2); g.touring = tour; const after = isHurt(g, foe);
        // an hour glass on it
        const secs = CONDITION.hurtSecs, age = g.time; foe.hurtAt = 0; CONDITION.hurtSecs = age * 0.5; const past = isHurt(g, foe); CONDITION.hurtSecs = age * 2; const within = isHurt(g, foe); CONDITION.hurtSecs = secs;
        line((res === 'shielded' || res === 'not reached') && !hidHurt && openHurt && !inShow && !took && mate2.hurtAt === -1 && after && age > 0 && !past && within,
          '(12) a man the burst has no line to is not hurt (the one in the open beside him is); a showcase leaves nobody hurt and reads a hurt man as sound while it runs; with hurtSecs set a man that long past his blast is sound again',
          `behind the wall: '${res}', hurt ${hidHurt} · in the open: hurt ${openHurt} · under a showcase: reads hurt ${inShow}, a blast's mark taken ${took} · after it: ${after} · a man hurt ${f2(age)} s ago: with hurtSecs at half that ${past}, at twice that ${within}`); } }
    // (10) the registry
    { const reg = KN.knobRegistry().CONDITION === CONDITION, jn = KN.JOURNAL_KNOBS.includes('CONDITION'), hold = FROZEN_HOLDS['CONDITION.on'] === 'TPS_CONDITION=1', env = (STAND_ENV as readonly string[]).includes('TPS_CONDITION');
      const R: any = await hushed(() => rig(5101, { stage: 'rc' })); CONDITION.on = true; const k = JO.knobsSnapshot(R.game); const has = !!k.tables.CONDITION; delete k.tables.CONDITION; await hushed(() => JO.applyKnobs(R.game, k)); const old = CONDITION.on;
      line(reg && jn && hold && env && has && old === false, '(10) the knob table is registered, the journal carries it and a file without it plays with it off, the frozen stand holds it with a word of its own', `registry ${reg} · journal list ${jn} · snapshot carries it ${has} · a file without the table → on: ${old} · FROZEN_HOLDS ${J(FROZEN_HOLDS['CONDITION.on'])} · STAND_ENV ${env}`); }
  } finally { Object.assign(CONDITION, was); }
  console.log(all ? '\ncondition: ALL PASS' : '\ncondition: FAIL');
  return all;
}
if (import.meta.main) process.exit((await conditionCheck()) ? 0 : 1);
