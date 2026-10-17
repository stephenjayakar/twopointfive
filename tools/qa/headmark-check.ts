// THE MARK OVER A MAN'S HEAD — the check behind src/ui/headmark.ts (no switch: the HUD only, nothing the simulation or a digest reads).
//   bun run tools/qa/headmark-check.ts        (also `probes.ts headmark`; the same on both stands)
// One room clear staged with the pair (doortools-probes.ts rig), nobody's senses on. What overlay.ts would draw over each man is asked of headMark itself:
//   own men   (1) a living teammate whose awareness a can or a blast wrote (0.6, 0.92): no mark — he carried a row of yellow dots, and under an order nothing drained them;
//             (2) a living teammate left searching after a fight went cold: no mark — he carried a yellow '?';
//             (3) what is not the stealth game's stays his: a plain '!' in a fight (never the '◎' of a man who has you lined up), the '✹' of a stun in the
//                 colour it had, 'zz' / '✕' on the floor;
//   the rest  (4) a defender with the same awareness: the dots, as ever (1 + floor(awareness × 6) of them, class sus);
//             (5) a defender searching: '?', class sus;
//             (3b) the '✹' goes from a stunned teammate once his figure says it (CONDITION.on and the blinded pose on): a defender keeps his;
//             (5b) a defender in a fight: '!', and '◎!' once the aim model has his man lined up;
//   the page  (6) overlay.ts takes each guard's mark from headMark and has no dots or '?' rule of its own.
// HEADMARK_BREAK=1 = the wary marks put back over his own men: (1), (2) and (3) must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');

export async function headmarkCheck(): Promise<boolean> {
  const { rig } = await import('./doortools-probes.ts');
  const { headMark, HEADMARK_QA } = await import(`${ROOT}/src/ui/headmark.ts`);
  let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== headmark: no wary mark over a man of your own; a defender\'s marks as they were ===');
  const R: any = await rig(5101, { stage: 'rc' }); const { game } = R;
  game.aiEnabled = false;   // (nobody's senses: every man keeps the state he is given)
  const mate = R.ops[0], other = R.ops[1], foe = R.hostiles.find((h: any) => h.state !== 'dead'), foe2 = R.hostiles.find((h: any) => h.state !== 'dead' && h !== foe) ?? foe;
  const was = HEADMARK_QA.ownWary; HEADMARK_QA.ownWary = process.env.HEADMARK_BREAK === '1';
  const set = (gd: any, state: string, awareness: number) => { gd.state = state; gd.awareness = awareness; gd.dazzledUntil = -1; };
  const show = (m: { text: string; cls: string }) => `'${m.text}' (${m.cls})`;
  try {
    // (1) the dots
    { set(mate, 'patrol', 0.6); set(other, 'patrol', 0.92); const a = headMark(game, mate), b = headMark(game, other);
      line(mate.team === 'operative' && other.team === 'operative' && a.text === '' && b.text === '', 'a living teammate whose awareness a can (0.6) or a blast (0.92) wrote: nothing over his head', `${mate.callsign} ${show(a)} · ${other.callsign} ${show(b)}`); }
    // (2) the '?'
    { set(mate, 'search', 0.5); set(other, 'suspicious', 0.5); const a = headMark(game, mate), b = headMark(game, other);
      line(a.text === '' && b.text === '', 'a living teammate left searching or suspicious: nothing over his head', `${mate.callsign} ${show(a)} · ${other.callsign} ${show(b)}`); }
    // (3) what stays his
    { const { CONDITION } = await import(`${ROOT}/src/game/condition.ts`); const { MOVES } = await import(`${ROOT}/src/game/character.ts`); const keepC = CONDITION.on, keepM = MOVES.on; CONDITION.on = false;   // (the stun's own mark, as it stands with the pose not saying it: 3b asks with it)
      const AM = await import(`${ROOT}/src/game/aim.ts`); const lined = (gd: any) => { gd.aim.track = 1; return AM.guardAcquired(game, gd) as boolean; };
      set(mate, 'alert', 1); const canLine = lined(mate), fight = headMark(game, mate);
      set(mate, 'patrol', 0.6); mate.dazzledUntil = game.time + 3; const stun = headMark(game, mate); mate.dazzledUntil = -1;
      const st = other.state, dk = other.downKind; other.state = 'dead'; other.downKind = 'struck'; const cold = headMark(game, other); other.downKind = 'shot'; const dead = headMark(game, other); other.state = st; other.downKind = dk;
      line(fight.cls === 'alert' && fight.text === '!' && stun.text === '✹' && stun.cls === 'sus' && cold.text === 'zz' && dead.text === '✕', 'a teammate in a fight keeps a plain \'!\', stunned the \'✹\' alone in its yellow, out cold \'zz\', dead \'✕\'', `fight ${show(fight)} (the aim model has him lined up: ${canLine}) · stunned ${show(stun)} · out cold ${show(cold)} · dead ${show(dead)}`);
      // (3b) …and no '✹' over him once the figure says it: the condition switch and the blinded pose both on (a defender keeps his)
      { CONDITION.on = true; MOVES.on = 1; set(mate, 'patrol', 0); mate.dazzledUntil = game.time + 3; const own = headMark(game, mate); mate.dazzledUntil = -1; set(foe, 'patrol', 0); foe.dazzledUntil = game.time + 3; const theirs = headMark(game, foe); foe.dazzledUntil = -1;
        MOVES.on = 0; mate.dazzledUntil = game.time + 3; const noPose = headMark(game, mate); mate.dazzledUntil = -1; CONDITION.on = keepC; MOVES.on = keepM;
        line(own.text === '' && theirs.text === '✹' && noPose.text === '✹', 'a stunned teammate carries no \'✹\' once his figure says it (the condition switch and the blinded pose on); a defender keeps his, and so does a teammate with the pose off', `teammate ${show(own)} · defender ${show(theirs)} · teammate with the pose off ${show(noPose)}`); }
      // (5b) the same question of a defender
      set(foe, 'alert', 1); const fl = lined(foe), fm = headMark(game, foe); set(foe, 'patrol', 0);
      line(fm.cls === 'alert' && fm.text === (fl ? '◎!' : '!'), 'a defender in a fight: \'!\', and \'◎!\' once the aim model has his man lined up', `lined up ${fl} · ${show(fm)}`); }
    // (4) a defender's dots
    { set(foe, 'patrol', 0.6); const a = headMark(game, foe); set(foe, 'patrol', 0.92); const b = headMark(game, foe); set(foe, 'patrol', 0); const c = headMark(game, foe);
      line(foe.team !== 'operative' && a.text === '····' && a.cls === 'sus' && b.text === '······' && b.cls === 'sus' && c.text === '', 'a defender with the same awareness: the dots as they were (four at 0.6, six at 0.92, none at 0)', `0.6 ${show(a)} · 0.92 ${show(b)} · 0 ${show(c)}`); }
    // (5) a defender searching
    { set(foe2, 'search', 0.5); const a = headMark(game, foe2); set(foe2, 'suspicious', 0.5); const b = headMark(game, foe2); set(foe2, 'patrol', 0);
      line(a.text === '?' && a.cls === 'sus' && b.text === '?' && b.cls === 'sus', 'a defender searching or suspicious: the \'?\' as it was', `search ${show(a)} · suspicious ${show(b)}`); }
    // (6) the page draws what headMark says
    { const src = readFileSync(`${ROOT}/src/ui/overlay.ts`, 'utf8'); const calls = /\bheadMark\(/.test(src) && src.includes("from './headmark'"), own = src.includes("'·'.repeat") || src.includes("=== 'suspicious' ||");
      line(calls && !own, 'overlay.ts takes each guard\'s mark from headMark and has no dots or \'?\' rule of its own', `calls headMark ${calls} · a rule of its own ${own}`); }
  } finally { HEADMARK_QA.ownWary = was; }
  console.log(all ? '\nheadmark: ALL PASS' : '\nheadmark: FAIL');
  return all;
}
if (import.meta.main) process.exit((await headmarkCheck()) ? 0 : 1);
