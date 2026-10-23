// THE CORNER PANEL IS THREE THINGS (game/handring.ts HANDRING.corner): the objective, what a quick press of his own key does, what a quick press of
// the squad's key does. Each is there only while it has something to say, and nothing else is: no heading over a row (the thing's name and state),
// no line per man of the squad, no counts of what the squad carries, no alternative under a key's line.
//
// This file is the reduction, with no page under it (ui/overlay.ts feeds it the rows it would have listed and draws what comes back;
// handring-check asks it directly). Imports the rule's own table and types.
import { HANDRING } from '../game/handring';
import type { InteractRow } from './overlay';

/** is the corner panel the three things: his ring's rule on, and not under the tour's puppet (its list is the list as it was) */
export const cornerOn = (puppet: boolean): boolean => HANDRING.corner && HANDRING.on && !puppet;

/** The objective line in its parts (null: none). The line's own word ends on '▸' ('objective ▸ …', 'training 2/7 ▸ …' — game/mission.ts objectiveText,
 *  lesson.ts): `label` is that word, `note` what stands in front of it (a par or a clock), `text` the rest. A line with no such word (a run's end:
 *  'structure taken · …', 'mission failed — …') is all text, under no label. */
export function objectiveParts(line: string): { label: string; note: string; text: string } | null {
  if (!line.trim()) return null; const cut = line.indexOf('▸'); if (cut < 0) return { label: '', note: '', text: line.trim() };
  const head = line.slice(0, cut).trim(), at = Math.max(head.lastIndexOf('·'), head.lastIndexOf('—'));
  return { label: head.slice(at + 1).trim(), note: at < 0 ? '' : head.slice(0, at).trim(), text: line.slice(cut + 1).trim() };
}
type Opt = InteractRow['opts'][number];
/** The corner as HANDRING.corner has it. `mine`: his own rows as the panel listed them (the highlighted row, a running verb's, a line no key gives,
 *  the word an empty tap left) · `primary`: which of them is the highlighted one (-1 none) · `squad`: the squad's block (orders.ts hud().status) ·
 *  `notes`: what the block and a door's heading say that the corner would lose, as a key's line or a warning under none (doortools.ts cornerNotes) · `objective`: the mission's line ('' =
 *  none, or a lesson's own line is up) · `stage`: the mission's stage, for the section's colour ('done', 'failed').
 *  Back: the objective as a section; then of his rows every line a key gives (the key's own, the two clicks on a man in reach) each by itself, and a
 *  row no key gives whole under no heading (a running verb's words and its bar, a committed move's, the word an empty tap left with how far); then
 *  the squad's lines a key gives (the quick key's, a plan's go, a charge to blow) and a set charge's warning; then its men lost, struck as they were (deathrecap.ts). */
export function cornerRows(mine: InteractRow[], primary: number, squad: InteractRow[], objective: string, notes: Opt[] = [], stage = ''): { rows: InteractRow[]; primary: number } {
  const rows: InteractRow[] = []; let lit = -1; const O = objectiveParts(objective);
  if (O) rows.push({ kind: 'objective', label: O.label, opts: [{ key: '', text: O.text }], inReach: true, off: false, sec: true, note: O.note, stage });
  mine.forEach((r, i) => {
    if (r.kind === 'cancel') return;
    const keyed = r.opts.filter(o => o.key), base = { kind: r.kind, inReach: r.inReach, off: r.off, one: true };
    if (!keyed.length) { rows.push({ ...base, label: r.opts.length ? '' : r.label, opts: r.opts, progress: r.progress, dist: r.dist }); return; }
    keyed.forEach((o, j) => { if (i === primary && j === 0) lit = rows.length; rows.push({ ...base, label: '', opts: [o], progress: j === 0 ? r.progress : undefined }); });
  });
  const sq = squad.flatMap(r => r.opts), line = (o: Opt): InteractRow => ({ kind: 'objective', label: '', opts: [{ key: o.key, text: o.text }], inReach: true, off: false, one: true });
  for (const o of notes) rows.push(line(o));
  for (const o of sq) if (o.key && !o.gone) rows.push(line(o));
  const lost = sq.filter(o => o.gone); if (lost.length) rows.push({ kind: 'objective', label: '', opts: lost, inReach: true, off: false, one: true });   // (the same lines: the page's arrow is set on them)
  return { rows, primary: lit };
}
