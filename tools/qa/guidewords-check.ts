// 'guidewords' — THE WRITING GUIDE'S SPOKEN WORDINGS ARE A KEY OF THEIR OWN (WORDS.guide, words.ts `wg`). A bubble's time on screen is its length and its text
// is in a run's digest, so the lines the guide (docs/agents/writing.md) rewrote are said only while the dialogue pass AND this key are both up. Three states:
// the pass off = the first words · the pass on, this key off = the pass's words, exactly as the page said them before the key · both on = the guide's words.
//   bun run tools/qa/guidewords-check.ts        (also `probes.ts guidewords`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   as it was   every spoken line the game can list (the staff's, the needs, hostages, the snatch, the net-quiet, morale, whistle, attention, dark-door, runner,
//               suppression, doze and stagger lists, the defender net with each line's class, every interrogation answer by kind, temper and what he knows and as each
//               room script shapes it, the length report's rows for the men and for Sam and his handler, the gun-in-a-hold pools, route names), with this key off:
//               the count and the digest pinned below, taken from the commit before the key, with the pass off and with it on. This key up and the pass off: the
//               first words still. A LINE OF THESE LISTS CHANGED ON PURPOSE MOVES THE PIN: GUIDEWORDS_PRINT=1 prints the two to put in AS_IT_WAS.
//   pairs       each wording the lists carry, pair by pair: the key off gives the old side and not the new, the key on gives the new; `wg` itself in all four states.
//   in place    the wordings the pass already had that the guide rewrote stand in the source byte for byte beside the guide's.
//   said        the office, her 'lockdown' aside sounded by hand in the three states: the strip carries "the lot", "the lot", "the works".
//   harness     the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?noguide` puts it off), rides a
//               recording's tables, and a recording from before the key replays with it off.
// GUIDEWORDS_BREAK=1 = the key left up where the check asks for it down: as it was, pairs and said must FAIL.   exit 0 = all hold · 1 = one does not
// NOT IN THIS CHECK: the lines said from inside a function (a `wg('…', '…')` at the say site) are listed by no table; `in place` reads the source for the ones
// the pass had, and nothing here plays them. THE HARNESS HAS NO GPU and no overlay: what is read is the game's own message list, which the radio strip draws.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { standUp, ROOT } from './headless.ts';

const { WORDS, wg } = await import(`${ROOT}/src/game/words.ts`);
const D = await import(`${ROOT}/src/game/dialogue.ts`);
const NQ = await import(`${ROOT}/src/game/netquiet.ts`), MO = await import(`${ROOT}/src/game/morale.ts`), WH = await import(`${ROOT}/src/game/whistle.ts`);
const CU = await import(`${ROOT}/src/game/cues.ts`), GH = await import(`${ROOT}/src/game/gunhold.ts`), AT = await import(`${ROOT}/src/game/attention.ts`);
const DD = await import(`${ROOT}/src/game/darkdoor.ts`), RU = await import(`${ROOT}/src/game/runner.ts`), SU = await import(`${ROOT}/src/game/suppression.ts`);
const DZ = await import(`${ROOT}/src/game/doze.ts`), LA = await import(`${ROOT}/src/game/launcher.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

const BREAK = process.env.GUIDEWORDS_BREAK === '1', PRINT = process.env.GUIDEWORDS_PRINT === '1', DT = 1 / 60;
/** the lists with this key off, at the commit before the key: [lines, digest] with the dialogue pass off, and with it on */
const AS_IT_WAS = { off: [2950, 'b9591495d37466ff'], on: [2961, '423e2213a39d22e3'] } as const;
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
/** the two switches as given for the length of `fn` (BREAK: this key never comes down) */
function at<T>(on: boolean, guide: boolean, fn: () => T): T { const was = { ...WORDS }; WORDS.on = on; WORDS.guide = guide || BREAK; WORDS.doors = false; WORDS.radioHome = false; try { return fn(); } finally { Object.assign(WORDS, was); } }   // (the other two keys down: the pins were taken so)

/** every spoken line the game can list, as the switches stand, a tag in front of each */
function dump(): string[] {
  const out: string[] = [];
  const put = (tag: string, list: string[]) => list.forEach((t, i) => out.push(`${tag}#${i}|${t}`));
  put('civ', D.civilianLines()); put('needs', D.needsLines(['Lindqvist'])); put('hostage', D.hostageLines()); put('snatch', D.snatchLines());
  put('netquiet', NQ.netQuietLines()); put('morale', MO.moraleLines()); put('whistle', WH.whistleLines()); put('cues', CU.cueLines().map((c: any) => `${c.kind}/${c.cls}/${c.text}`));
  put('attention', AT.attentionLines()); put('darkdoor', DD.darkDoorLines()); put('runner', RU.runnerLines()); put('suppression', SU.suppressionLines()); put('doze', DZ.dozeLines()); put('stagger', LA.staggerLines());
  for (const kind of D.INTEL_KINDS) for (const t of D.TEMPERAMENTS) for (const k of D.KNOWLEDGE) out.push(`intel ${kind}/${t}/${k}|${D.intelText(kind, t, k)}`);
  for (const sc of D.SCRIPTS ?? []) for (const kind of D.INTEL_KINDS) for (const t of D.TEMPERAMENTS) out.push(`shaped ${sc.id}/${kind}/${t}|${D.shapedIntelText(kind, sc, t)}`);
  { const R = D.lineLengthReport(); for (const x of R.men) out.push(`men ${x.where}|${x.text}`); for (const x of R.sam) out.push(`sam ${x.where}|${x.text}`); }
  for (const k of ['gun', 'shot', 'round', 'gone']) { put(`gunhold foe ${k}`, GH.gunHoldPool({ unit: {}, team: 'hostile' }, k)); put(`gunhold staff ${k}`, GH.gunHoldPool({ team: 'guard' }, k)); }
  { const names = ['corridor', 'laneW', 'roundW', 'roundE', 'yard_round', 'nowhere'], L: any = { routes: names.map(name => ({ name })) }; names.forEach((n, i) => out.push(`route ${n}|${D.routeName(L, i)}`)); }
  out.push(`lint|${D.lintDialogue().length}`);
  return out;
}
const digest = (lines: string[]) => createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 16);

function asItWas() {
  console.log('\n=== as it was: this key off, every line the game can list is the line it was ===');
  const off = at(false, false, dump), on = at(true, false, dump), offUp = BREAK ? off : at(false, true, dump), both = at(true, true, dump);
  if (PRINT) console.log(`    AS_IT_WAS = { off: [${off.length}, '${digest(off)}'], on: [${on.length}, '${digest(on)}'] }`);
  verdict(off.length === AS_IT_WAS.off[0] && digest(off) === AS_IT_WAS.off[1], 'the dialogue pass off: the lists are the first words, line for line', `${off.length} lines, digest ${digest(off)} · pinned ${AS_IT_WAS.off.join(', ')}`);
  verdict(on.length === AS_IT_WAS.on[0] && digest(on) === AS_IT_WAS.on[1], "the dialogue pass on, this key off: the lists are the pass's words as the page said them before the key, line for line", `${on.length} lines, digest ${digest(on)} · pinned ${AS_IT_WAS.on.join(', ')}`);
  verdict(digest(offUp) === digest(off), 'this key up with the dialogue pass off says nothing of its own', `digest ${digest(offUp)} · the pass off ${digest(off)}`);
  const had = new Set(on), fresh = both.filter(l => !had.has(l));
  verdict(fresh.length >= 100 && digest(both) !== digest(on), "both on: the guide's lines are in the lists", `${both.length} lines, ${fresh.length} of them not in the lists with the key off, digest ${digest(both)}`);
}

/** [where the line is listed, the wording before the key (the pass's), the guide's; `swap` = the list carries one or the other, never both] */
const PAIRS: [tag: string, was: string, now: string, swap: boolean][] = [
  ['civ', 'A MAN — {room} — creeping about in the dark —', 'A MAN — {room} — sneaking around in the dark —', false],
  ['civ', 'You lot never sleep.', 'You guys never sleep.', false],
  ['civ', "Careful by the stairs — lift's off again.", "Careful by the stairs — elevator's out again.", false],
  ['civ', 'Leave the bins, {name}. Go home.', 'Leave the trash, {name}. Go home.', false],
  ['needs', 'Legs have seized. Quick lap of the lobby.', 'My legs are stiff. Quick lap around the lobby.', false],
  ['whistle', "right — who's messing about?", "all right — who's messing around?", false],
  ['cues', 'squadWaits/3/{sq}: hold — let them come in. wait for my word!', 'squadWaits/3/{sq}: hold — let them come in. wait for my call!', true],
  ['intel rollcall/hard/none', 'Radio check {checkEta}. Silence gets a man sent. Do the sums.', 'Radio check {checkEta}. Silence gets somebody sent. Do the math.', true],
  ['intel drive/hard/none', 'Your rack went dark on the board. A man is on his way to it.', "Your rack went dark on the board. Somebody's on his way to it.", true],
  ['sam pool Sqd2', 'That keyed door on your round. How does it open?', 'That keyed door on your route. How does it open?', true],
  ['sam con-s3:1 sam', "Fire drill assessment. Don't turn round.", "Fire drill assessment. Don't turn around.", true],
  ['sam radio lockdown #1 handler', 'Lockdown. Doors, pairs, the lot. Your doing?', 'Lockdown. Doors, pairs, the works. Your doing?', true],
  ['route roundW', 'the west round', 'the west loop', true],
];
function pairs() {
  console.log('\n=== pairs: the key off gives the old side, the key on the new ===');
  const off = at(true, false, dump), on = at(true, true, dump), first = at(false, true, dump);
  const has = (L: string[], tag: string, text: string) => L.some(l => { const i = l.indexOf('|'); return l.slice(i + 1) === text && (l.slice(0, i) === tag || l.slice(0, i).startsWith(`${tag}#`)); });
  const bad: string[] = [];
  for (const [tag, was, now, swap] of PAIRS) {
    if (!has(off, tag, was) || has(off, tag, now)) bad.push(`${tag}: the key off — old ${has(off, tag, was)}, new ${has(off, tag, now)}`);
    if (!has(on, tag, now) || (swap && has(on, tag, was))) bad.push(`${tag}: the key on — new ${has(on, tag, now)}, old ${has(on, tag, was)}`);
    if (!BREAK && has(first, tag, now)) bad.push(`${tag}: the pass off, the key up — the guide's line is listed`);
  }
  verdict(bad.length === 0, `${PAIRS.length} wordings by name: the key off lists the old and not the new, the key on lists the new (and not the old where one replaces the other), and the key alone lists none`, bad.join('\n    ') || PAIRS.map(p => `${p[0]}: "${p[1]}" → "${p[2]}"`).join('\n    '));
  const four = [[false, false], [false, true], [true, false], [true, true]].map(([o, k]) => { const was = [WORDS.on, WORDS.guide]; WORDS.on = o; WORDS.guide = k; const r = wg('new', 'old'); WORDS.on = was[0]; WORDS.guide = was[1]; return r; });
  verdict(four.join() === 'old,old,old,new', "`wg` gives the guide's side only with the dialogue pass and the key both up", `off/off, off/up, on/off, on/up: ${four.join(', ')}`);
}

/** the pass's wordings the guide rewrote: each must stand in the source as the page had it, beside the guide's */
const IN_PLACE: [file: string, was: string, now: string][] = [
  ['dialogue.ts', `hard: "It's been missed. A man is on his way to look."`, `hard: "It's been missed. Somebody's on his way to look."`],
  ['dialogue.ts', "armoury_radio: 'the armoury side door'", "armoury_radio: 'the armory side door'"],
  ['dialogue.ts', "roundW: 'the west round'", "roundW: 'the west loop'"],
  ['breach.ts', "clear1: 'right side — clear. i have the door.'", `clear1: "right side — clear. i've got the door."`],
  ['weather.ts', "THUNDER_OUT = 'no let-up, is there.'", `THUNDER_OUT_GUIDE = "it's not letting up, is it."`],
  ['cues.ts', 'wait for my word!', 'wait for my call!'],
  ['pressure.ts', "'that was outside — they\\'re coming. stand to!'", "'that was outside — they\\'re coming. get ready!'"],
  ['rescueflush.ts', "'going round — I\\'ll take the other door!'", "'going around — I\\'ll take the other door!'"],
  ['guards.ts', `"someone's about"`, `"someone's around"`],
  ['tactics.ts', "wg('around', 'round')} — coming at", "wg('around', 'round')} — coming in from"],
];
function inPlace() {
  console.log("\n=== in place: the pass's own wordings stand in the source beside the guide's ===");
  const src = new Map<string, string>(), read = (f: string) => src.get(f) ?? (src.set(f, readFileSync(`${ROOT}/src/game/${f}`, 'utf8')), src.get(f)!);
  const bad = IN_PLACE.filter(([f, was, now]) => !read(f).includes(was) || !read(f).includes(now)).map(([f, was, now]) => `${f}: ${read(f).includes(was) ? '' : `gone: ${was}`} ${read(f).includes(now) ? '' : `gone: ${now}`}`);
  verdict(bad.length === 0, `${IN_PLACE.length} wordings the dialogue pass had and the guide rewrote: both sides are in the source, the pass's byte for byte`, bad.join('\n    ') || IN_PLACE.map(p => `${p[0]}: ${p[1]}`).join('\n    '));
}

/** the office stood up, the switches as given, her 'lockdown' aside sounded by hand on a run whose die picks the row the guide rewrote: her line in the strip */
async function lockdown(on: boolean, guide: boolean): Promise<string> {
  const W: any = await quiet(() => standUp({ uploadEvery: 4 })), g = W.game, was = [WORDS.on, WORDS.guide, WORDS.radioHome];
  WORDS.on = on; WORDS.guide = guide || BREAK; WORDS.radioHome = true;
  try {
    g.godMode = true; g.playerInvisible = true; g.player.visibility = 0.02; for (const x of g.guards) x.hold = true;
    for (let i = 0; i < 10; i++) W.step(DT);
    const pool = D.HANDLER_LINES.lockdown, row = pool.findIndex((L: any) => L.hNow);
    let t0 = 0; while (D.hashStr(`lockdown|${Math.round(t0 * 10)}`) % pool.length !== row) t0 += 0.1;
    g.mission.t0 = t0;
    const from = g.messages.length, asked = D.handlerBeat(g, 'lockdown');
    const hers = g.messages.slice(from).map((m: any) => String(m.text)).filter((t: string) => t.startsWith(`radio: ${D.HANDLER_TAG} ▸ `));
    return asked && hers.length === 1 ? hers[0].slice(`radio: ${D.HANDLER_TAG} ▸ `.length) : `(asked ${asked}, ${hers.length} of hers, office ${D.isOffice(g.level)})`;
  } finally { WORDS.on = was[0]; WORDS.guide = was[1]; WORDS.radioHome = was[2]; }
}
async function said() {
  console.log('\n=== said: one line through the game in the three states ===');
  const L = D.HANDLER_LINES.lockdown.find((x: any) => x.hNow), first = await lockdown(false, false), pass = await lockdown(true, false), both = await lockdown(true, true);
  verdict(!!L && first === L.h && pass === L.h && both === L.hNow && L.h !== L.hNow, "the office, her lockdown aside by hand: the pass off and the pass on with this key off say the line as it was, both on say the guide's", `pass off "${first}" · pass on, key off "${pass}" · both on "${both}"`);
}

async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_GUIDEWORDS, want = word !== undefined ? word === '1' : shipped;
  if (!shipped) WORDS.guide = !want;   // (`found` is the key before any stand-up, which a word on the frozen stand has not written yet; the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp({ uploadEvery: 4 })), stood = WORDS.guide;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = 'guide' in snap.tables.WORDS;
  WORDS.guide = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); WORDS.guide = false; JR.applyKnobs(W.game, snapUp); const kept = WORDS.guide;
  delete snap.tables.WORDS.guide; WORDS.guide = true; JR.applyKnobs(W.game, snap); const old = WORDS.guide;
  const read = (q: string) => { WORDS.guide = !WORDS.guide; PR.pageSwitches(new URLSearchParams(q)); return WORDS.guide; }, plain = read(''), off = read('noguide');
  verdict((STAND_ENV as string[]).includes('TPS_GUIDEWORDS') && PR.FROZEN_HOLDS['WORDS.guide'] === 'TPS_GUIDEWORDS=1' && stood === want && (word !== undefined || found === want) && had && kept === true && old === false && plain === true && off === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?noguide',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_GUIDEWORDS')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['WORDS.guide']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plain} · ?noguide ${off}`);
}

/** the whole card (probes.ts 'guidewords'): true = every check passed. The switches are put back as they were found. */
export async function guideWordsCheck(): Promise<boolean> {
  const was = { ...WORDS }, rnd = Math.random; allPass = true; found = WORDS.guide;
  console.log(`'guidewords': the writing guide's spoken wordings are a key of their own${BREAK ? ' — GUIDEWORDS_BREAK=1: the key left up where it is asked down (as it was, pairs and said must fail)' : ''}`);
  try { asItWas(); pairs(); inPlace(); await said(); await harness(); }   // (the harness last: it writes the page's switches)
  finally { Object.assign(WORDS, was); Math.random = rnd; }
  console.log(`\n=== guidewords: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await guideWordsCheck() ? 0 : 1);
