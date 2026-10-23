// THE WRITING GUIDE'S CHECK (the agents' index, "Writing for the player"; docs/agents/writing.md): the text a player reads, held to the patterns the guide
// rules out. It reads what is DATA: every level's lesson block (the big line, its other lines, the after lines, the cards) and every mission row (blurb,
// opening scene, the "You will learn" rows, the row's `only` line).
// A LESSON'S LINE IS READ AS THE PLAYER READS IT: a line or a card names a move by a token (`{grab him}`, game/lesson.ts TOKENS) and the build writes the
// token out by the keys it has, so each is put through `lessonLine` on all four ways the two switches can stand (the held click or the grab's key, the knife
// or none) and every sentence that comes out is held to the rules. The four tokens are written out of 'him' on their own as well, so a token no level uses
// yet is read too.
//   bun run tools/qa/writing-check.ts [--list]      (also `probes.ts writing`, in families ui and words; no stand: nothing of the game runs)
//   key      a key is pressed by "you": no key cap followed by a colon ("[B]: stack up"), no sentence of a line or a card that opens on a key cap
//            ("[B] on the door"; `[X]` is drawn "Hold Q" and may open one)
//   colon    no colon in a lesson's line or card: ideas are joined with words (a mission row may keep a colon that opens a list)
//   opener   a line does not open on a bare "In." / "On," / "To the …" / "Out by …" / "Back to …" / "Through …", on "Where …", or on a participle
//            ("Stacked on a door, …")
//   tail     no verbless phrase tacked on after a comma (", his back to you"; "with his back to you" is the sentence said whole)
//   words    everyday American words: no torch, mains, fuse box, lorry, "round" for around, armoury, metre, whilst, towards, "out cold", "take hold of",
//            "your word"; in a lesson and a tutorial row an enemy is an enemy or a guard, never "a man" / "men"
//   short    a pronoun and its verb are contracted (he's, they're, you'll, it's, don't, can't): "he is coming", "do not turn" are not how it is said
//   self     the rules catch the sentences the guide was written from and pass their rewrites: each BEFORE below trips a rule, each AFTER trips none
// WRITING_BREAK=1 = the BEFORE sentences are read as if a level carried them, and the grab's token is written out as a key and a colon ("[Space]: grab him"):
// the check must FAIL on both.   exit 0 = all hold · 1 = one does not
// A pattern catches a colon after a key or a missing contraction; only a reader catches a sentence nobody would say. The guide's review step (every changed
// line read aloud, by its writer and by a second reader) is not replaced by this.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
type Kind = 'line' | 'card' | 'title' | 'row' | 'teach';
interface Text { where: string; kind: Kind; text: string; lesson: boolean }

const KEY = /\[[^\]\n]{1,8}\]/g;
/** a sentence of a text: split at a full stop, a bang, a question mark or a new line */
const sentences = (t: string) => t.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);

const BRITISH: [RegExp, string][] = [
  [/\btorch(es)?\b/i, 'flashlight'], [/\bmains\b/i, 'breaker'], [/\bfuse box\b/i, 'breaker box'], [/\blorr(y|ies)\b/i, 'truck'], [/\barmoury\b/i, 'armory'],
  [/\bmetres?\b/i, 'meters'], [/\bwhilst\b/i, 'while'], [/\btowards\b/i, 'toward'], [/\bcolour/i, 'color'],
  [/\bround (the|to|a|an|him|her|them|it|behind|each|with|you)\b/i, 'around'], [/\b(go|goes|going|walk|walks|come|comes|work|works) round\b/i, 'around'],
  [/\bout cold\b/i, 'knock him out'], [/\btakes? hold of\b/i, 'grab'], [/\b(your|the|one) word\b(?! for)/i, '"say go", "until you say go"'],
];
const UNCONTRACTED = /\b(he|she|it|that|there|who) is (?=[a-z])|(?<!\bof )\b(they|you|we) are (?=[a-z])|\b(he|she|it|they|you|we|i) will (?=[a-z])|\bi am\b|\b(do|does|did|is|are|was|were|will|would|should|could|has|have) not\b|\bcannot\b/i;   // ('have' and 'has' are verbs of their own too often to rule on: "they have one to spare")
const OPENER = /^(in|on|out|up|through)[.,:]|^(to|out by|back to|through|on past) (the|a|its|his) |^where\b|^(stacked|kept|held|seen|given|sent|taken|left)\b[^.]*,/i;
const TAIL = /(?<!\bwith),\s(his|her|their|your|its)\s\w+\s(to|on|at|against|in)\b/i;
const MAN = /\b(a man|that man|the far man|the near man|men|man's)\b/i;

/** what a text breaks, in words; none = it holds */
export function faults(T: Text): string[] {
  const out: string[] = [], t = T.text, bare = t.replace(KEY, 'K');
  if (/\[[^\]\n]{1,8}\]\s*:/.test(t)) out.push('key: a key cap followed by a colon');
  if (T.kind === 'line' || T.kind === 'card') for (const s of sentences(t)) if (/^\[(?!X\])[^\]\n]{1,8}\]/.test(s) && !/^(\[[^\]\n]{1,8}\]\s*)+$/.test(s)) out.push(`key: a sentence opens on a key cap ("${s.slice(0, 28)}…")`);
  if ((T.kind === 'line' || T.kind === 'card' || T.kind === 'title' || T.kind === 'teach') && bare.includes(':')) out.push('colon: a colon where a word belongs');
  if (T.kind !== 'title' && T.kind !== 'teach') for (const s of sentences(bare)) if (OPENER.test(s)) out.push(`opener: "${s.slice(0, 28)}…"`);
  if (TAIL.test(bare)) out.push('tail: a verbless phrase after a comma');
  for (const [re, say] of BRITISH) if (re.test(bare)) out.push(`words: ${bare.match(re)![0]} (say: ${say})`);
  if (T.lesson && MAN.test(bare)) out.push(`words: ${bare.match(MAN)![0]} (say: an enemy, a guard, a teammate)`);
  if (UNCONTRACTED.test(bare)) out.push(`short: "${bare.match(UNCONTRACTED)![0].trim()}" is said contracted`);
  return out;
}

/** every text of a level's lesson block */
function lessonTexts(name: string, L: any): Text[] {
  const out: Text[] = [], S = L?.scenarios?.lesson; if (!S?.steps) return out;
  const put = (where: string, kind: Kind, text: unknown) => { if (typeof text === 'string' && text.trim()) out.push({ where: `${name} ${where}`, kind, text, lesson: true }); };
  for (const s of S.steps) { const id = s.id ?? '?';
    for (const k of ['line', 'menuLine', 'pageLine', 'noTap', 'ringLine', 'planLine', 'setupLine', 'blowLine']) put(`'${id}'.${k}`, 'line', s[k]);
    put(`'${id}'.after.line`, 'line', s.after?.line); put(`'${id}'.after.word`, 'line', s.after?.word);
    put(`'${id}'.card title`, 'title', s.explain?.title); put(`'${id}'.card`, 'card', s.explain?.text); }
  return out;
}

/** a lesson's line or card as the page writes it out, on each of the four ways the stalk and the knife can stand (game/lesson.ts lessonLine): the
 *  distinct sentences a player can be shown for one written text. The two switches are put back as they were found. */
interface Writer { lessonLine: (s: string) => string; STALK: { on: boolean; only: boolean; key: boolean }; CLOSE: { on: boolean; noKnife: boolean } }
function writtenOut(W: Writer, text: string): string[] {
  const { STALK, CLOSE } = W, was = [STALK.on, STALK.only, CLOSE.on, CLOSE.noKnife, STALK.key] as const, out = new Set<string>();
  try { for (const k of [0, 1, 2, 3, 5, 7]) { STALK.on = STALK.only = !!(k & 1); CLOSE.on = CLOSE.noKnife = !!(k & 2); STALK.key = !!(k & 4); out.add(W.lessonLine(text)); } }
  finally { [STALK.on, STALK.only, CLOSE.on, CLOSE.noKnife, STALK.key] = was; }
  return [...out];
}
/** …and a list of texts with every line and card replaced by what is written out of it (a title, a row and a list entry are shown as written) */
const asRead = (W: Writer, T: Text[]): Text[] => T.flatMap(t => t.kind !== 'line' && t.kind !== 'card' ? [t] : writtenOut(W, t.text).map((text, i, all) => ({ ...t, text, where: all.length > 1 ? `${t.where} (written out ${i + 1}/${all.length})` : t.where })));

/** the sentences the guide was written from, and their rewrites */
const BEFORE = [
  'Where the sound was he stops, his back to you.', 'Stacked on a door, they wait for your word.', '[B] on the door: stack up', 'When he stops: up behind him. [Space] grabs him',
  'Go round the wall, come up behind him, and [Space] takes hold of him.', 'Men fight by what they can see. In the dark they are slow, and they come with torches.',
  'In. Stay in the dark', 'To the back door', 'Right button: out cold. Left: the knife', '[B] on the mains box: lights out', 'He heard that, and he is coming to look.', 'Do not turn everybody: send part of the squad to cover the other way.',
];
const AFTER = [
  "He'll check out the sound and then stop, with his back to you.", "Once they're stacked on a door, they'll wait until you say go.", 'Press [B] on the door to stack up',
  'When he stops, sneak up behind him and {grab him}', 'Go around the wall, come up behind him, and {grab him}.',
  "Enemies can only fight what they can see. In the dark they'll slow down and turn on flashlights.", 'Go in and stay in the dark', 'Go to the back door',
  '{Knock him out}', 'Press [B] on the breaker box to cut the lights', "He heard that, and he's coming to take a look.", '[X] on the wall',
];

export async function writingCheck(): Promise<boolean> {
  const BREAK = process.env.WRITING_BREAK === '1', LIST = process.argv.includes('--list');
  console.log(`\n=== writing: the text a player reads, by the guide${BREAK ? ' — WRITING_BREAK: the old sentences are read as a level\'s' : ''} ===`);
  let all = true; const line = (ok: boolean, label: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };
  const { ALL_MISSIONS, TUTORIAL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const lessonMod = await import(`${ROOT}/src/game/lesson.ts`), W: Writer = { lessonLine: BREAK ? (t: string) => lessonMod.lessonLine(t).replace(/press \[Space\] to grab/gi, '[Space]: grab') : lessonMod.lessonLine, STALK: (await import(`${ROOT}/src/game/stalk.ts`)).STALK, CLOSE: (await import(`${ROOT}/src/game/close.ts`)).CLOSE };

  // ---- the lessons
  const texts: Text[] = []; const levels = readdirSync(join(ROOT, 'levels')).filter(f => f.endsWith('.json') && !f.endsWith('.lint.json')).sort(); let lessons = 0;
  for (const f of levels) { let L: any; try { L = JSON.parse(readFileSync(join(ROOT, 'levels', f), 'utf8')); } catch { continue; }
    const T = lessonTexts(f.replace(/\.json$/, ''), L); if (T.length) lessons++; texts.push(...T); }
  if (BREAK) BEFORE.forEach((t, i) => texts.push({ where: `the break word's sentence ${i + 1}`, kind: 'card', text: t, lesson: true }));
  const report = (T: Text[]) => { const bad = T.map(t => ({ t, f: faults(t) })).filter(x => x.f.length); return { n: bad.length, text: bad.slice(0, LIST ? 999 : 12).map(x => `${x.t.where}: "${x.t.text.replace(/\n/g, ' / ').slice(0, 90)}" — ${x.f.join(' · ')}`).join('\n    ') + (bad.length > 12 && !LIST ? `\n    … and ${bad.length - 12} more (--list shows all)` : '') }; };
  { const read = asRead(W, texts), R = report(read), brace = read.filter(t => (t.kind === 'line' || t.kind === 'card') && /[{}]/.test(t.text));
    line(lessons >= 6 && R.n === 0 && !brace.length, `every lesson's lines and cards hold to the guide as the page writes them out (${lessons} levels, ${texts.length} texts, ${read.length} as read)`,
      [R.n ? R.text : '', ...brace.slice(0, 6).map(t => `${t.where}: a brace is left in what the player reads ("${t.text.slice(0, 70)}")`)].filter(Boolean).join('\n    ')); }

  // ---- the tokens' own words: each of the four, of 'him', small and capital, on the four ways the keys can stand
  { const names: string[] = lessonMod.LESSON_TOKENS, cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1);
    const T: Text[] = names.flatMap(n => [`When he stops, ${`{${n}}`}`, `{${cap(n)}}`].map(text => ({ where: `token {${n}}`, kind: 'line' as Kind, text, lesson: true })));
    const read = asRead(W, T), R = report(read), left = read.filter(t => /[{}]/.test(t.text));
    line(names.length >= 4 && read.length > T.length && R.n === 0 && !left.length, `the words the ${names.length} lesson tokens write out hold to the guide (${read.length} sentences over the four ways the keys stand)`,
      [R.n ? R.text : '', ...left.map(t => `${t.where} is not written out: "${t.text}"`)].filter(Boolean).join('\n    ') || read.slice(0, 4).map(t => `"${t.text}"`).join(' · ')); }

  // ---- the mission rows
  { const rows: Text[] = []; const tut = new Set((TUTORIAL_MISSIONS as any[]).map(e => e.id));
    for (const e of ALL_MISSIONS as any[]) { const lesson = tut.has(e.id);
      if (e.blurb) rows.push({ where: `row ${e.id} blurb`, kind: 'row', text: e.blurb, lesson });
      if (e.scene) rows.push({ where: `row ${e.id} scene`, kind: 'row', text: e.scene, lesson });
      if (e.only) rows.push({ where: `row ${e.id} only`, kind: 'row', text: e.only, lesson });
      for (const [i, t] of (e.teaches ?? []).entries()) rows.push({ where: `row ${e.id} teaches ${i + 1}`, kind: 'teach', text: t, lesson }); }
    const R = report(rows);
    line(rows.length >= 40 && R.n === 0, `every mission row's blurb, scene and list hold to the guide (${rows.length} texts)`, R.n ? R.text : ''); }

  // ---- the rules themselves
  { const missed = BEFORE.filter(t => !faults({ where: '', kind: 'card', text: t, lesson: true }).length);
    const wrong = AFTER.flatMap(t => writtenOut(W, t)).map(t => ({ t, f: [...faults({ where: '', kind: 'card', text: t, lesson: true }), ...(/[{}]/.test(t) ? ['a brace left in it'] : [])] })).filter(x => x.f.length);
    line(!missed.length && !wrong.length, `the rules catch the ${BEFORE.length} sentences the guide was written from and pass their ${AFTER.length} rewrites`,
      [...missed.map(t => `not caught: "${t}"`), ...wrong.map(x => `caught: "${x.t}" — ${x.f.join(' · ')}`)].join('\n    ')); }

  console.log(`=== writing: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await writingCheck()) ? 0 : 1);
