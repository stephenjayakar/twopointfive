// 'radiohome' — THE HANDLER'S RADIO ASIDES ARE THE OFFICE NIGHT'S (WORDS.radioHome, dialogue.ts radioLive). The maintainer, off the stealth tutorial mission:
// "the 'subtle was twenty years ago' text with the handler keeps popping up -- should be confined to just the office level". Her dry lines and his answers
// (the drive, the rack, the floor's lights, a body found) were written for the solo night at the office, and were said on every level a solo night ran on:
// a tutorial mission restarted at a checkpoint heard the same pair again each time.
//   bun run tools/qa/radiohome-check.ts        (also `probes.ts radiohome`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   office    the office, the key up: the lights die and she says her line a beat later, he answers after it. Nothing is taken from the night it was written for.
//   away      three other levels (the stealth tutorial mission among them), the key up: the lights die, twelve seconds pass, and no line of hers or his is in
//             the strip; a beat asked for by hand is refused. The same levels with the key down: she speaks, as the build did.
//   harness   the key is a row of the two stands' list with its word, off on the frozen stand and on in the page (`?handlerall` puts it off), rides a
//             recording's tables, and a recording from before the key replays with it off.
// RADIOHOME_BREAK=1 = the key left down where `away` asks for it up: away must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU and no overlay: what is read is the game's own message list, which the radio strip draws.
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';

const { WORDS } = await import(`${ROOT}/src/game/words.ts`);
const D = await import(`${ROOT}/src/game/dialogue.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

const BREAK = process.env.RADIOHOME_BREAK === '1', DT = 1 / 60;
const AWAY = ['tut-quiet.json', 'quiet-yard.json', 'lights-out.json'];
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }

/** a level stood up with the player unseen, the key as given; the lights die; `secs` later: her lines and his in the strip, and what a beat asked by hand answers */
async function night(file: string | null, key: boolean, secs = 12): Promise<{ hers: string[]; his: string[]; asked: boolean; office: boolean; stage: string }> {
  const W: any = await quiet(() => standUp(file ? { uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${file}`, 'utf8'))) } : { uploadEvery: 4 })), g = W.game;
  WORDS.on = true; WORDS.radioHome = key;
  g.godMode = true; g.playerInvisible = true; g.player.visibility = 0.02; for (const x of g.guards) x.hold = true;
  for (let i = 0; i < 10; i++) W.step(DT);
  const from = g.messages.length;
  g.blackout.active = true; g.blackout.permanent = true; g.blackout.since = g.time; g.blackout.until = g.time + 1e6;   // (the edge tickRadio reads: the lights dying)
  for (let i = 0; i < Math.round(secs * 60); i++) { W.step(DT); for (const x of g.guards) if (x.state === 'alert') x.state = 'patrol'; }
  const said = g.messages.slice(from).map((m: any) => String(m.text));
  const asked = D.handlerBeat(g, 'bodyKo');   // (a beat nothing in this run has sounded)
  return { hers: said.filter((t: string) => t.startsWith(`radio: ${D.HANDLER_TAG} ▸ `)), his: said.filter((t: string) => t.startsWith('radio: you ▸ ')), asked, office: D.isOffice(g.level), stage: g.mission.stage };
}

async function office() {
  console.log('\n=== office: the night she was written for still hears her ===');
  const N = await night(null, true), pool = D.HANDLER_LINES.blackout;
  const h = N.hers[0]?.slice(`radio: ${D.HANDLER_TAG} ▸ `.length), s = N.his[0]?.slice('radio: you ▸ '.length), row = pool.find((L: any) => L.h === h);
  verdict(N.office && N.hers.length === 1 && N.his.length === 1 && !!row && row.s === s, 'the office, the key up: the lights die, she says one line of the blackout pool and he answers with its pair', `office ${N.office} · hers ${JSON.stringify(N.hers)} · his ${JSON.stringify(N.his)}`);
}
async function away() {
  console.log('\n=== away: no other level hears her ===');
  const rows: string[] = []; let bad = 0;
  for (const file of AWAY) {
    const up = await night(file, !BREAK), down = await night(file, false);
    const quietUp = up.hers.length === 0 && up.his.length === 0 && up.asked === false, spokeDown = down.hers.length === 1 && down.his.length === 1;
    if (up.office || !quietUp || !spokeDown) bad++;
    rows.push(`${file} (office ${up.office}, mission ${up.stage}): the key up ${up.hers.length} of hers, ${up.his.length} of his, a beat by hand ${up.asked ? 'sounded' : 'refused'} · the key down ${JSON.stringify(down.hers.concat(down.his))}`);
  }
  verdict(bad === 0, `${AWAY.length} other levels, the lights dying on each: with the key up nothing of hers or his is in the strip in twelve seconds and a beat asked by hand is refused; with it down she speaks as the build did`, rows.join('\n    '));
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page, and in a recording ===');
  const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_RADIOHOME, want = word !== undefined ? word === '1' : shipped;
  if (!shipped) WORDS.radioHome = !want;   // (the frozen stand's pin writes the key at every stand-up; the page's stand has it from the page's boot, read once when the harness loads)
  const W: any = await quiet(() => standUp({ uploadEvery: 4 })), stood = WORDS.radioHome;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = 'radioHome' in snap.tables.WORDS;
  WORDS.radioHome = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); WORDS.radioHome = false; JR.applyKnobs(W.game, snapUp); const kept = WORDS.radioHome;
  delete snap.tables.WORDS.radioHome; WORDS.radioHome = true; JR.applyKnobs(W.game, snap); const old = WORDS.radioHome;
  const read = (q: string) => { WORDS.radioHome = !WORDS.radioHome; PR.pageSwitches(new URLSearchParams(q)); return WORDS.radioHome; }, plain = read(''), off = read('handlerall');
  verdict((STAND_ENV as string[]).includes('TPS_RADIOHOME') && PR.FROZEN_HOLDS['WORDS.radioHome'] === 'TPS_RADIOHOME=1' && stood === want && found === want && had && kept === true && old === false && plain === true && off === false,
    'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, a recording from before it replays with it down, and the page\'s boot writes it on for a plain address and off for ?handlerall',
    `STAND_ENV ${(STAND_ENV as string[]).includes('TPS_RADIOHOME')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['WORDS.radioHome']} · found ${found}, stood up ${stood}, wanted ${want} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plain} · ?handlerall ${off}`);
}

/** the whole card (probes.ts 'radiohome'): true = every check passed. The switches are put back as they were found. */
export async function radioHomeCheck(): Promise<boolean> {
  const was = { ...WORDS }, rnd = Math.random; allPass = true; found = WORDS.radioHome;
  try { await harness(); await office(); await away(); }
  finally { Object.assign(WORDS, was); Math.random = rnd; }
  console.log(`\n=== radiohome: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await radioHomeCheck() ? 0 : 1);
