// HOW MANY ARE INSIDE IS A MYSTERY (src/ui/missions.ts MYSTERY, `?mystery=0`). The maintainer, 10-23: "we should also remove all defender counts from the
// menus, etc., it should be a mystery!" What a player reads BEFORE a mission, held to that: the Defenders cell every screen asks for, and the words of
// every mission row, start-page pick and difficulty sentence. Reads tables only: no stand, nothing of the game runs.
//   bun run tools/qa/mystery-check.ts [--list]      (also `probes.ts mystery`, in families ui and words)
//   cell     with the switch on no mission has a Defenders cell (defendersShown is '—', which the sheet, the kit step and the load page read as "no
//            cell"); with it off the cell says what the row says; a row's own `defenders` is the same either way (the stand-up and the probes count on it)
//   total    no row's place, job or pick line says its own head count: a number beside "enemies", "defenders", "guards", "men" … that IS the row's
//            `defenders`, any such number past five, "against eleven", "eleven hold". A smaller number is a part of the puzzle and stays ("two sentries
//            who watch each other"). The training and tutorial rows are lessons: their numbers are the exercise, listed and not judged
//   hard     the sentences that say what Hard is name no number of enemies
//   asks     no screen reads a row's `defenders` or the tally's roster for itself: under src/ui only missions.ts names `.defenders`, and a line that
//            names the roster names the switch
// MYSTERY_BREAK=1 puts the switch off and reads the old rows' and Hard's old sentences as theirs: 'cell', 'total' and 'hard' must FAIL.
// The page's own half (the cells not drawn, the large map left by a click beside it): tools/qa/mystery-page.cjs.
const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
import { readFileSync, readdirSync } from 'node:fs';

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
const N = `(${NUM.join('|')}|\\d+)`, FOE = '(?:enemies|enemy|defenders?|guards?|gunmen|gunman|men|sentries|sentry|captors?|hostiles?|shooters?)';
const valueOf = (w: string) => /^\d+$/.test(w) ? Number(w) : NUM.indexOf(w.toLowerCase());
/** every number a sentence puts on the enemy: [the words, the number, said as the whole floor ("against eleven", "eleven hold")] */
export function countsIn(text: string): [string, number, boolean][] {
  const out: [string, number, boolean][] = [];
  for (const m of text.matchAll(new RegExp(`\\b${N}\\s+(?:armed\\s+|more\\s+|other\\s+)?${FOE}\\b`, 'gi'))) out.push([m[0], valueOf(m[1]), false]);
  for (const m of text.matchAll(new RegExp(`\\bagainst\\s+${N}\\b|\\b${N}\\s+(?:hold|holds|holding|of\\s+us|inside|on\\s+shift|on\\s+patrol)\\b`, 'gi'))) out.push([m[0], valueOf(m[1] ?? m[2]), true]);
  return out;
}
/** the old rows, as they read before the counts came out: what MYSTERY_BREAK reads as a row's */
const OLD: [string, number][] = [["It's five against eleven. Three squads hold the block, each in its own rooms.", 11], ['Eleven enemies hold a building laid out as a ring.', 11],
  ['Three enemies hold a break room with four doors.', 3], ['Six enemies, and the clock starts on your first move.', 6], ['The hard one. Eleven hold a ring of rooms.', 11]];

export async function mysteryCheck(): Promise<boolean> {
  const BREAK = process.env.MYSTERY_BREAK === '1', LIST = process.argv.includes('--list');
  console.log(`\n=== mystery: no screen says how many are inside${BREAK ? ' — MYSTERY_BREAK: the switch off, the old sentences read as rows' : ''} ===`);
  let all = true; const line = (ok: boolean, label: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };
  const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { PICKS, pickEntry } = await import(`${ROOT}/src/scene/picks.ts`);
  const { SOLO_NIGHT, missionOf, MYSTERY, defendersShown } = await import(`${ROOT}/src/ui/missions.ts`);
  const { difficultyWords, squadsHeld } = await import(`${ROOT}/src/game/difficulty.ts`);
  const was = MYSTERY.on;
  try {
    const missions = [SOLO_NIGHT, ...ALL_MISSIONS.map((e: unknown) => missionOf(e))] as { id: string; defenders: string }[];
    // ---- cell
    MYSTERY.on = !BREAK; const shown = missions.filter(m => defendersShown(m) !== '—').map(m => `${m.id} "${defendersShown(m)}"`);
    line(shown.length === 0, 'cell: with the switch on, no mission has a Defenders cell', shown.length ? `drawn: ${shown.slice(0, 6).join(' · ')}${shown.length > 6 ? ` … ${shown.length} in all` : ''}` : `${missions.length} missions, each '—'`);
    MYSTERY.on = false; const kept = missions.filter(m => defendersShown(m) !== m.defenders).map(m => m.id), said = missions.filter(m => /\d/.test(m.defenders)).length;
    line(kept.length === 0 && said >= 10, "cell: with it off the cell says what the row says, and the rows still hold their counts", kept.length ? `differ: ${kept.join(' ')}` : `${said} of ${missions.length} rows carry a count`);
    MYSTERY.on = !BREAK;
    // ---- total
    const rows: { id: string; text: string; total: number; lesson: boolean }[] = (ALL_MISSIONS as { id: string; title: string; place?: string; blurb?: string; scene?: string; defenders?: number; group?: string }[]).map(e => (
      { id: e.id, text: [e.place, e.blurb, e.scene].filter(Boolean).join(' '), total: e.defenders ?? -1, lesson: e.group === 'training' || e.group === 'tutorial' }));
    rows.push({ id: SOLO_NIGHT.id, text: `${SOLO_NIGHT.place} ${SOLO_NIGHT.blurb}`, total: 3, lesson: false });
    for (const p of PICKS as { id: string; line: string }[]) rows.push({ id: `pick ${p.id}`, text: p.line, total: (pickEntry(p) as { defenders?: number } | null)?.defenders ?? 3, lesson: false });
    if (BREAK) for (const [text, total] of OLD) rows.push({ id: 'an old row', text, total, lesson: false });
    const bad: string[] = [], part: string[] = [], lessons: string[] = [];
    for (const r of rows) for (const [words, n, whole] of countsIn(r.text)) (r.lesson ? lessons : whole || n === r.total || n > 5 ? bad : part).push(`${r.id} "${words}"`);
    line(bad.length === 0, "total: no mission row or pick line says its own head count", bad.length ? bad.join(' · ') : `${rows.length} rows read · a part of the puzzle, kept: ${part.join(' · ') || 'none'}`);
    if (LIST) console.log(`    the lessons' own numbers (the exercise, not judged): ${lessons.join(' · ') || 'none'}`);
    // ---- hard
    const hard = [difficultyWords('hard', false), difficultyWords('standard', false), ...(ALL_MISSIONS as { level?: string; squads?: boolean; kind?: string }[]).filter(e => squadsHeld(e)).map(e => difficultyWords('hard', squadsHeld(e)))];
    if (BREAK) hard.push('On a hostage rescue the captor calls your assault on the radio and his two guards act on it. On the night breach the three defenders are drilled.');
    const told = [...new Set(hard.flatMap(w => countsIn(w).map(c => c[0])))];
    line(told.length === 0, 'hard: the sentences that say what Hard is name no number of enemies', told.length ? told.join(' · ') : `${hard.length} sentences read`);
    // ---- asks
    const ui = readdirSync(`${ROOT}/src/ui`).filter(f => f.endsWith('.ts')), own: string[] = [];
    for (const f of ui) readFileSync(`${ROOT}/src/ui/${f}`, 'utf8').split('\n').forEach((l, i) => { const code = l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if ((f !== 'missions.ts' && /\.defenders\b/.test(code)) || (/\.roster\b/.test(code) && !/MYSTERY\.on/.test(code))) own.push(`${f}:${i + 1}`); });
    line(own.length === 0, "asks: no screen reads a row's count or the tally's roster for itself", own.length ? own.join(' · ') : `${ui.length} files under src/ui read`);
  } finally { MYSTERY.on = was; }
  console.log(`=== mystery: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await mysteryCheck()) ? 0 : 1);
