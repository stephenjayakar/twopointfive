// The 'cues' family (game/cues.ts — the defenders' net on the radio strip, ranked and rate-limited, and a line for the decisions they took in silence), run
// through probes.ts:   bun run tools/qa/probes.ts cues | cues-lines | cues-strip | cues-run
// PASS / FAIL each, all headless. No picture and no sound here: 'drawn' is the strip's own row list (stripRows — what both HUDs draw), not a screen.
//   cues-lines   every new line of the table falls in the class it was written for, and the defenders' existing calls fall where the ranking puts them
//   cues-strip   the strip's rules on a bare clock: a unit's radio line gets a row; the same words twice, a class inside its gap, a full strip of better
//                rows and a class with its two rows are held back; a better class takes the worst row; a 'radio: ' row is always drawn; switch off = the
//                message ring's rows exactly
//   cues-run     the team met in the mess on levels/block-squads.json, the same seed with the switch on and off: every man's state and place frame for
//                frame the same (a cue never moves a man, nor a die), no cue is ever written on a Guard, the net reaches the strip with it on and not off
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { CUES, Cues, cueClass, cueLines, stripRows } = await import(`${ROOT}/src/game/cues.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { roomName, placeName } = await import(`${ROOT}/src/game/dialogue.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}

/** the row of the ranking each new line belongs in (rebuild/telegraphing/decisions.md §7: 1 coming · 2 stood down · 3 holding on purpose · 4 the net knows · 5 fell back · 6 still alert; 0 = spoken, not a net line) */
const WANT: Record<string, number> = { help: 1, stay: 3, stayOurs: 3, huntOver: 2, calm: 2, cover: 2, still: 6, fellBack: 5, planted: 5, pinnedIn: 5, squadHears: 4, squadCopies: 4, squadWaits: 3, squadCopiesWaits: 3, squadStays: 3, squadQuiet: 2, surprised: 0, flinch: 0 };
/** the defenders' existing radio lines, as the 48 logged runs heard them, and the row of the ranking each belongs in */
const OLD: [string, number][] = [
  ['moving round — coming at him from the mess', 1], ['going around — coming at him from the mess', 1], ["copy — he's got one of ours. stay locked down. box him in. no shot unless it's clean", 1], ['Bravo: two going around — keep them there!', 1], ['coming up behind him. keep him where he is', 1], ["they're coming out — get around them, go!", 1], ['set', 1], ['go go go', 1], ['Bravo: two going round — keep them there!', 1], ['Bravo: moving to Alpha — 3 of us!', 1], ["can't wait — pushing, go", 1],
  ["he's down — hold where you are", 2],
  ['Charlie: holding — lock the doors, let them come!', 3], ["heard. they'll find this room ready.", 3], ["copy. we'll be ready for them.", 3], ['we hear it. getting ready for them here.', 3],
  ['Alpha: contact — mess!', 4], ['shots fired! on me!', 4], ['that was a shot — find him!', 4], ["he's moved — the mess", 4],
];

export async function cuesLines(): Promise<boolean> {
  const F = family('cues-lines: every line falls in the row of the ranking it was written for');
  const L = cueLines() as { kind: string; cls: number; text: string }[], net = L.filter(l => l.cls > 0);
  const bad = L.filter(l => l.cls !== WANT[l.kind]);
  F.verdict(net.length >= 14 && !bad.length && new Set(L.map(l => l.kind)).size === Object.keys(WANT).length, 'the new lines: each kind in its row (the table carries the class; the words do not decide it)', bad.length ? bad.map(l => `${l.kind} '${l.text}' is ${l.cls}, wanted ${WANT[l.kind]}`).join(' · ') : `${net.length} net lines + ${L.length - net.length} spoken over ${Object.keys(WANT).length} kinds`);
  const texts = L.map(l => l.text);
  F.verdict(new Set(texts).size === texts.length && L.filter(l => !l.cls).every(l => l.text.length <= 12), 'no line is in the table twice; the spoken ones are a breath long', `${texts.length} lines, ${L.length - net.length} spoken`);
  const off = OLD.filter(([t, c]) => cueClass(t) !== c);
  F.verdict(!off.length, "the defenders' existing calls fall where the ranking puts them", off.length ? off.map(([t, c]) => `'${t}' → ${cueClass(t)}, wanted ${c}`).join(' · ') : `${OLD.length} lines`);
  return F.done();
}

export async function cuesStrip(): Promise<boolean> {
  const F = family('cues-strip: one row a line, ranked, rate-limited; off = the message ring as ever');
  const was = { ...CUES };
  try {
    const played: number[] = [];
    const g: any = { time: 10, messages: [] as { text: string; t: number }[], audio: { play: (_n: string, _p: unknown, gain: number) => played.push(gain) }, fight: { log: [], defs: [], live: true }, level: {} };
    g.msg = (text: string) => { g.messages.push({ text, t: g.time }); if (g.messages.length > 5) g.messages.shift(); g.cues.raw(text); };
    g.cues = new Cues(g);
    const man = (callsign: string, team = 'hostile') => ({ callsign, team, unit: true });
    const rows = () => (stripRows(g) as { text: string }[]).map(r => r.text.slice(7));
    CUES.on = true;
    g.cues.heard(man('Blue 2', 'operative'), 'room clear'); g.cues.heard(man('Q1', 'guard'), 'stairs clear');
    F.verdict(rows().length === 0, "only the defenders' net is put on the strip: not the team's own, not the night game's response", `${rows().length} rows`);
    g.cues.heard(man('Tango 1'), 'contact — the mess!'); g.cues.tick();
    F.verdict(rows().join('|') === 'Tango 1: contact — the mess!' && played.length === 1, "a defender's radio line gets a row under his callsign, and one squelch", `${rows().join(' | ')} · ${played.length} squelch`);
    g.time += 0.5; g.cues.heard(man('Tango 2'), 'contact — the mess!');
    F.verdict(rows().length === 1 && g.cues.stats.dup === 1, 'the same words from another man inside ten seconds: not drawn twice', `${rows().length} row · dup ${g.cues.stats.dup}`);
    g.cues.heard(man('Tango 2'), 'shots fired! on me!'); g.cues.heard(man('Tango 3'), 'that was a shot — find him!');
    F.verdict(rows().length === 2 && g.cues.stats.gap === 1, 'with two rows up, a class that has just spoken waits', `${rows().join(' | ')} · gap ${g.cues.stats.gap}`);
    g.cues.heard(man('Tango 4'), 'Bravo: two going round — keep them there!');
    g.cues.heard(man('Tango 5'), "heard. they'll find this room ready.");
    F.verdict(rows().length === 3 && rows().includes("Tango 5: heard. they'll find this room ready.") && !rows().includes('Tango 1: contact — the mess!'), 'a full strip: a better class takes the place of the worst row, the oldest of them', rows().join(' | '));
    g.cues.heard(man('Tango 6'), "they're still out there — holding the mess");
    F.verdict(rows().length === 3 && !rows().some(r => /still out there/.test(r)) && g.cues.stats.full === 1, 'a worse class than every row up is held back', `${rows().join(' | ')} · full ${g.cues.stats.full}`);
    g.time += 3; g.cues.heard(man('Tango 7'), 'moving round — coming at him from the store'); g.time += 3; g.cues.heard(man('Tango 8'), 'go go go');
    const ones = rows().filter(r => cueClass(r.replace(/^Tango \d: /, '')) === 1).length;
    F.verdict(ones === 2 && rows().length === 3, 'no class holds more than two of the three rows', rows().join(' | '));
    g.msg('radio: CONTROL — all units, lock it down'); const n0 = played.length; g.cues.tick();
    F.verdict(rows().includes('CONTROL — all units, lock it down') && played.length - n0 <= 1, "a 'radio: ' row (control, the staff's net) is always drawn; rows of one frame squelch once", `${rows().join(' | ')} · ${played.length - n0} squelch for the frame`);
    g.time += 2; g.cues.reset(); g.messages = [{ text: 'radio: kept one', t: g.time - 1 }, { text: 'Tango 1 (radio): not a row', t: g.time - 1 }]; g.cues.adopt(g.messages);
    F.verdict(rows().join('|') === 'kept one', "a checkpoint loaded: the saved ring's 'radio: ' rows are the strip's again", rows().join(' | '));
    g.time += 9;
    F.verdict(rows().length === 0, 'a row is gone after eight seconds', `${rows().length} rows`);
    for (let i = 0; i < 7; i++) g.msg(`Tango ${i} (radio): row ${i}`);
    g.cues.heard(man('Tango 1'), 'falling back!'); g.msg('Tango 1 (radio): falling back!'); for (let i = 0; i < 6; i++) g.msg(`Tango ${i}: not drawn ${i}`);
    F.verdict(rows().join('|') === 'Tango 1: falling back!', 'rows nothing draws do not push a drawn one out (the strip is its own list, not the five-row ring)', `${rows().join(' | ')} · ring: ${g.messages.length} rows, none of them his`);
    CUES.on = false; g.msg('radio: one'); g.msg('Tango 1 (radio): two'); g.cues.heard(man('Tango 1'), 'two');
    const old = g.messages.filter((m: any) => g.time - m.t < 8 && m.text.startsWith('radio: ')).slice(-3).map((m: any) => m.text).join('|');
    F.verdict((stripRows(g) as { text: string }[]).map(r => r.text).join('|') === old && old === 'radio: one', "switch off: the strip is the message ring's 'radio: ' rows, as it was", old);
  } finally { Object.assign(CUES, was); }
  return F.done();
}

async function rig(seed: number, on: boolean) {
  CUES.on = on; Math.random = seeded(seed);
  const log = console.log, err = console.error, warn = console.warn; let W: any;
  try { console.log = console.error = console.warn = () => { };
    W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'block-squads.json'), 'utf8'))) });
    await startFromQuery(W.game, new URLSearchParams(`?levelFile=block-squads.json&roomclear=${seed}&squad4`));
  } finally { console.log = log; console.error = err; console.warn = warn; }
  return W;
}
export async function cuesRun(): Promise<boolean> {
  const F = family('cues-run: the same seed with the switch on and off — every man the same, frame for frame; the net on the strip only with it on');
  const was = { ...CUES };
  try {
    const out: { moves: string; strip: Set<string>; cueOnMan: number; stats: any; kinds: any; hold: string; place: string }[] = [];
    for (const on of [true, false]) {
      const W = await rig(2, on), g = W.game; g.godMode = true;
      const cueTexts = new Set<string>(); let moves = '', cueOnMan = 0; const strip = new Set<string>(); let hold = '';
      const frame = (i: number) => {
        if (i % 30 === 0) { const d = digestGame(g, true) as any; for (const x of d.guards) delete x.bubble; for (const x of d.civilians) delete x.bubble; if (d.player) delete d.player.bubble; moves += hashDigest(d) + ' '; }
        for (const r of stripRows(g) as { text: string }[]) strip.add(r.text);
        for (const l of g.cues.log) if (l.kind !== 'heard' && l.kind !== 'raw') cueTexts.add(l.text.replace(/^Tango \d+: /, ''));
        for (const gd of g.guards) { if (gd.bubble && cueTexts.has(gd.bubble.text)) cueOnMan++; if (gd.bubble && /hold where you are|back to your posts/.test(gd.bubble.text)) hold = gd.bubble.text; }
      };
      for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; W.step(DT); frame(i); }
      // Sam is stood where the first squad's first posted man is aiming — read off the level's own marks, so a rebuilt floor moves the staging with it
      // (a fixed point in the old mess was out of every eye on the rebuilt block: nobody called anything and three lines went red)
      const rc = g.level.scenarios?.roomClear, aim = rc?.rooms?.find((r: any) => r.id === rc.squads?.[0]?.rooms?.[0])?.marks?.[0]?.aimAt;
      if (!aim) throw new Error('cues-run: block-squads.json has no first squad room with a mark to stage Sam in front of');
      g.teleportPlayer([aim[0], 0, aim[2]]);
      for (let i = 60; i < 12 * 60; i++) { g.player.visibility = 1; W.step(DT); frame(i); }
      g.godMode = false;   // …and now their rounds count: Sam drops where he stands, and the floor's fight is over
      for (let i = 12 * 60; i < 50 * 60; i++) { if (!g.player.down) g.player.visibility = 1; W.step(DT); frame(i); }
      out.push({ moves, strip, cueOnMan, stats: { ...g.cues.stats }, kinds: { ...g.cues.kinds }, hold, place: placeName(g.level, [2, 0, 2]) + ' / ' + roomName(g.level, [2, 0, 2]) });
    }
    const [A, B] = out;
    F.verdict(A.moves === B.moves && A.moves.split(' ').length > 90, 'every man, door and item digests the same with the cues on and off, every half second for 50 s', `${A.moves.split(' ').length - 1} digests · ${A.moves === B.moves ? 'identical' : 'first difference at ' + (A.moves.split(' ').findIndex((h, i) => h !== B.moves.split(' ')[i]) * 0.5).toFixed(1) + ' s'}`);
    F.verdict(A.cueOnMan === 0, "no cue is ever written on a man (Guard.bubble is the bark clocks' to read)", `${A.cueOnMan} frames`);
    F.verdict([...A.strip].some(t => /^radio: Alpha: contact/.test(t)) && A.stats.heardDrawn >= 3 && B.strip.size === 0, "the defenders' net reaches the strip with the switch on, and none of it with it off", `on: ${A.stats.heardDrawn} of ${A.stats.heard} lines drawn (${[...A.strip].slice(0, 3).join(' · ')}…) · off: ${B.strip.size} rows`);
    F.verdict(A.stats.cues >= 2 && A.stats.cueDrawn >= 1 && B.stats.cues === 0, 'silent decisions get a line with it on (and none is made with it off)', `on: ${JSON.stringify(A.kinds)}, ${A.stats.cueDrawn} on the strip · off: ${B.stats.cues}`);
    F.verdict((A.hold === '' || /hold where you are/.test(A.hold)) && (B.hold === '' || /back to your posts/.test(B.hold)) && A.hold + B.hold !== '', "Sam down: the floor is told to hold where it is — 'back to your posts' only with the switch off", `on: '${A.hold}' · off: '${B.hold}'`);
    F.verdict(/^outside the [\w ]+ \/ the [\w ]+$/.test(A.place) && !/car park|back offices/.test(A.place) && B.place === 'the car park / the car park', "a place on the net, and the dialogue's room noun, are the level's own (off: 'the car park' for both, on a floor with none — the words as they were)", `on: '${A.place}' · off: '${B.place}'`);
  } finally { Object.assign(CUES, was); }
  return F.done();
}
