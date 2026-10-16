// SNATCH-CHECK: the rules of game/snatch.ts asked of a staged room clear on levels/snatch.json — no play-through, every situation set by hand.
//   bun run tools/qa/snatch-check.ts            (exit 0 = every line PASS, 1 = a FAIL; SNATCH_BREAK=1 = the overlay switched off under the same lines: must fail)
// What it holds: the block's points stand on floor with a walk to every way out · he is staged with the room clear and keeps to his room while it is quiet ·
// gunfire in his ears sends him at his nearest way out and, nobody on it, he is gone = the mission failed · a man on the way out in the DARK is not seen: he
// runs into him and gives up; a man he makes out there (lit), far off, turns him; both ways held and seen, he goes to ground · one of the team close with a line = hands up, three seconds beside him = tied (the wrists-behind pose) · hands up and left
// alone, he bolts · a round or a grenade that kills him = failed, the killer's side named · the house taken with him loose is not the end, with him tied it is won · the
// slice a checkpoint would carry comes back · SNATCH.on false and a level without the block = no man, no objective line.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

export async function snatchCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { SNATCH, checkSnatch } = await import(`${ROOT}/src/game/snatch.ts`);
  const { killGuard, fireWeapon } = await import(`${ROOT}/src/game/combat.ts`), { blast } = await import(`${ROOT}/src/game/frag.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
  const { snatchLines } = await import(`${ROOT}/src/game/dialogue.ts`);
  const brk = process.env.SNATCH_BREAK === '1', knobs0 = knobsCopy();
  /** every line the man has had over his head in any staging of this run (the voice line asks: all his own) */
  const said = new Set<string>();
  let failed = false, checks = 0;
  const line = (ok: boolean, s: string) => { checks++; if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(f: () => Promise<T> | T): Promise<T> => { const l = console.log, w = console.warn; console.log = console.warn = () => { }; try { return await f(); } finally { console.log = l; console.warn = w; } };
  const levelOf = (file: string) => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
  /** a Game on `file`, the room clear (the pair) staged; Sam cannot be hurt; `harmless` = the defenders taken off the floor's fight (held where they stand, no AI of theirs runs) */
  async function stage(file = 'snatch.json') {
    const W: any = await quiet(() => standUp({ uploadEvery: 4, level: levelOf(file), seed: 7 }));
    const g = W.game; g.godMode = true;
    const why = await quiet(() => g.roomClear.start(1)); if (why) throw new Error(`the room clear did not start on ${file}: ${why}`);
    const light = { sam: null as number | null };   // (Sam's meter, held at this while set: headless nothing answers for it — the pair's is the game's own CPU estimate where they stand)
    const step = (secs: number, until?: () => boolean) => quiet(() => { for (let i = 0; i < Math.round(secs * 60); i++) { if (light.sam !== null) g.player.visibility = light.sam; W.step(1 / 60); const b = g.snatch?.man?.bubble?.text; if (b) said.add(b); if (until?.()) return true; } return !until; });
    await step(0.1);
    const S = g.snatch, hostiles = () => g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead'), ops = () => g.guards.filter((x: any) => x.team === 'operative');
    const shot = (pos: number[]) => g.events.push({ kind: 'shot', pos: [pos[0], 1.2, pos[2]], time: g.time, loud: true, level: 1, who: hostiles()[0]?.char.id ?? 0 });
    /** the pair moved by hand to stand at `spots` and kept there (their orders would walk them back) */
    const park = (spots: number[][]) => ops().forEach((m: any, i: number) => { const p = spots[i % spots.length]; m.char.pos[0] = p[0]; m.char.pos[2] = p[2]; m.hold = true; });
    const clearHouse = () => quiet(() => { for (const h of hostiles()) killGuard(g, h, [0, 0, 1], false, 'shot', 'player'); });
    return { W, g, S, step, light, hostiles, ops, shot, park, clearHouse, N: g.level.scenarios.snatch };
  }
  try {
    if (brk) SNATCH.on = false;
    // ---- 1 · the block, the staging, the quiet floor
    { const A = await stage(), { g, S, N } = A;
      const bad = checkSnatch(g);
      line(bad.length === 0, `the block's points stand on floor with a walk to each of its ${N.exits.length} ways out${bad.length ? ` — ${bad.join(' · ')}` : ''}`);
      line(!!S.active && !!S.man && g.civilians.includes(S.man) && S.man.team === 'civilian', `he is staged with the room clear: ${S.man ? `${S.man.civ.name}, team ${S.man.team}, at ${at(S.man.char.pos)}` : 'no man'}`);
      line(/^objective ▸ take .* alive/.test(g.objectiveText?.() ?? S.objective()?.text ?? ''), `the objective row is his while he is loose: "${S.objective()?.text ?? ''}"`);
      await A.step(6);
      const c = S.man?.civ, p = S.man?.char.pos ?? [0, 0, 0], home = flat(p, N.man.pos) < 6;
      line(!!c && (c.state === 'work' || c.state === 'startled') && home && !S.end, `six quiet seconds: he keeps to his room (${c?.state}, ${at(p)}, ${flat(p, N.man.pos).toFixed(1)} m from his mark)`);
      // ---- 2 · gunfire, nobody on his way out: gone, failed
      A.shot([16, 0, 15]);
      const ran = await A.step(3, () => c.state === 'flee');
      line(ran && c.target?.name === N.exits[0].name, `gunfire in the house: he runs for ${c.target?.name ?? '(nothing)'} (his nearest: ${N.exits[0].name})`);
      const out = await A.step(25, () => !!S.end);
      line(out && S.end === 'lost' && S.lost === 'gone' && g.mission.stage === 'failed', `nobody on it: ${S.why || 'still running'} → end ${S.end}, mission stage ${g.mission.stage}`);
    }
    // ---- 3 · a man on his way out: in the DARK he is not seen and is run into (hands up); LIT, he turns him; both ways held and seen, he goes to ground
    { const A = await stage(), { g, S, N } = A; await A.clearHouse(); await A.step(0.2);
      line(!S.end && !!g.roomClear.end, `the house taken (${g.roomClear.end}) with him loose is not the end (end ${S.end}); the row reads "${S.objective()?.text ?? ''}"`);
      const gate = N.exits[0].pos; A.light.sam = 0.02; g.teleportPlayer([gate[0] - 1.0, 0, gate[2] + 0.2]);
      A.shot([16, 0, 15]);
      const met = await A.step(20, () => S.handsUp || !!S.end), d = flat(S.man.char.pos, g.player.char.pos);
      line(met && S.handsUp && !S.end && S.stats.turned === 0 && d <= SNATCH.giveUpM + 0.6, `Sam in the dark on ${N.exits[0].name}: not seen, run into, hands up ${d.toFixed(1)} m from him (turned ${S.stats.turned}, ${S.end ?? 'no end'})`);
    }
    { const A = await stage(), { g, S, N } = A, c = S.man?.civ; await A.clearHouse(); await A.step(0.2);
      const gate = N.exits[0].pos, front = N.exits[1].pos;
      A.light.sam = 1; g.teleportPlayer([gate[0] - 1.0, 0, gate[2] + 0.2]); A.park([[front[0] - 0.8, 0, front[2] - 3.2], [front[0] + 0.8, 0, front[2] - 3.2]]);
      A.shot([16, 0, 15]);
      const turned = await A.step(12, () => S.stats.turned >= 1 || S.handsUp);
      line(turned && !S.handsUp && S.stats.turned >= 1, `Sam LIT on ${N.exits[0].name}, more than ${SNATCH.haltM.toFixed(1)} m off: he is turned from it (turned ${S.stats.turned}, hands ${S.handsUp ? 'up' : 'down'}), at ${at(S.man?.char.pos ?? [0, 0, 0])}`);
      const ground = await A.step(40, () => S.stats.turned >= 2 && c.state === 'cower' || !!S.end || S.handsUp);
      line(ground && !S.end && !S.handsUp, `the pair in the lit courtyard on ${N.exits[1].name} too: turned again (${S.stats.turned}) and gone to ground (${c?.state}) at ${at(S.man?.char.pos ?? [0, 0, 0])}, nobody's yet`);
      const p = S.man.char.pos; g.teleportPlayer([p[0] + 1.6, 0, p[2] + 0.4]);
      let near = await A.step(2, () => S.handsUp); if (!near) { g.teleportPlayer([p[0] - 1.6, 0, p[2] - 0.4]); near = await A.step(2, () => S.handsUp); }
      line(near && c.state === 'cower' && c.complied && !S.tied, `Sam within ${SNATCH.giveUpM} m with a line: hands up (${c?.state}, complied ${c?.complied}), not yet tied`);
      const snap = S.snapshot?.();
      const tied = await A.step(SNATCH.cuffSecs + 1.5, () => S.tied); await A.step(0.2);
      line(tied && S.inHand && S.man.char.anim.bound === 1, `${SNATCH.cuffSecs} s beside him: tied (in hand ${S.inHand}, bound pose ${S.man.char.anim.bound})`);
      const won = await A.step(1, () => S.end === 'won');
      line(won && g.mission.stage !== 'failed', `the house taken and him tied: ${S.end} — ${S.why}`);
      const s2 = S.snapshot?.(); S.restore?.(snap); const back = S.handsUp && !S.tied && !S.end; S.restore?.(s2);
      line(!!snap && back && S.tied && S.end === 'won', `the overlay's own slice goes back on the live game: hands up / not tied, then tied / won (a checkpoint is refused with a squad on the floor: nothing loads it today)`);
    }
    // ---- 4 · hands up and left alone: he bolts
    { const A = await stage(), { g, S } = A, c = S.man?.civ, p = S.man?.char.pos ?? [23, 0, 10.7]; await A.clearHouse();
      g.teleportPlayer([p[0] - 1.8, 0, p[2] + 0.3]);
      const up = await A.step(3, () => S.handsUp);
      g.teleportPlayer([4, 0, 26]);
      const bolted = await A.step(SNATCH.boltSecs + 3, () => S.stats.bolted >= 1);
      line(up && bolted && !S.handsUp && !S.tied && c.state !== 'cower', `hands up, then nobody in sight for ${SNATCH.boltSecs} s: he bolts (bolted ${S.stats.bolted}, ${c?.state})`);
    }
    // ---- 5 · a round kills him: failed, the killer named
    { const A = await stage(), { g, S } = A, p = S.man?.char.pos ?? [23, 0, 10.7];
      g.teleportPlayer([p[0] - 2.2, 0, p[2]]); await A.step(0.3);
      await quiet(() => { for (let i = 0; i < 6 && S.man.state !== 'dead'; i++) { const ch = S.man.char.bones.chest ?? [p[0], 1.1, p[2]]; fireWeapon(g, g.player.char, ch, true); for (let k = 0; k < 14; k++) A.W.step(1 / 60); } });
      await A.step(0.3);
      line(S.end === 'lost' && S.lost === 'dead' && S.killer?.side === 'player' && g.mission.stage === 'failed', `Sam's round kills him: ${S.why || `(no end; he is ${S.man?.state})`} → lost '${S.lost}', killer ${S.killer?.side}, stage ${g.mission.stage}`);
    }
    { const A = await stage(), { g, S } = A, p = S.man?.char.pos ?? [23, 0, 10.7], by = A.ops()[0];
      await quiet(() => blast(g, [p[0] + 0.4, 0, p[2]], { who: by.char.id, serial: 1, name: 'frag grenade' })); await A.step(0.3);
      line(S.end === 'lost' && S.lost === 'dead' && S.killer?.side === 'operative' && S.killer?.who === by.callsign && /grenade/.test(S.why), `a teammate's grenade kills him: ${S.why || `(no end; he is ${S.man?.state})`} → killer ${S.killer?.side} ${S.killer?.who}`);
    }
    // ---- 5b · his voice: over every staging above he said only his own lines (dialogue.ts SNATCH_LINES), never the office's late worker's
    { const mine = new Set<string>(snatchLines()), other = [...said].filter(s => !mine.has(s));
      line(said.size >= 3 && other.length === 0, `his voice: ${said.size} different lines over the run, all his own${other.length ? ` — NOT his: ${other.map(s => `"${s}"`).join(' · ')}` : ''}`); }
    // ---- 6 · off: the switch, and a level without the block
    { SNATCH.on = false; const A = await stage(); await A.step(1);
      line(!A.S.active && !A.S.man && !A.g.civilians.some((x: any) => x.civ?.name === A.N.man.name) && A.S.objective() === null, `SNATCH.on false: no man on the floor, no objective line (the room clear alone)`);
      SNATCH.on = !brk;
      const B = await stage('test-rooms.json'); await B.step(1);
      line(!B.S.active && !B.S.man && B.S.objective() === null && B.S.snapshot() === undefined, `a level without the block (test-rooms): nothing staged, no line`);
    }
  } catch (e: any) { failed = true; console.log(`- FAIL — threw: ${e?.stack ?? e}`); }
  finally { knobsBack(knobs0); }
  console.log(failed ? `=== snatch-check: FAILED (${checks} lines) ===` : `=== snatch-check: ALL PASS (${checks} lines) ===`);
  return !failed;
}
if (import.meta.main) process.exit((await snatchCheck()) ? 0 : 1);
