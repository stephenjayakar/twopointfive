// 'words-overheard' (game/cues.ts overheard, behind CUES.overheard — the page has it on, `?overheard=0` puts it off; off in the module and on the frozen
// stand, `TPS_OVERHEARD=1` raises it), run through probes.ts:   bun run tools/qa/probes.ts words-overheard
// A defender the fog hides who SHOUTS a line (not on his net) where the player's ears or a living teammate's really get it is a quiet row of its own on the
// radio strip: his words alone. PASS / FAIL each, all headless: no picture and no sound here — 'drawn' is the strip's own row list (stripRows), not a screen.
//   1 · on a bare clock, a made-up floor (straight-line hearing, a `carry` the check sets): who gets a row and who does not; the row's words; the strip's
//       own rows are never pushed off by one and push it off first; the same words and two shouts close together; the clock gone back; off = nothing
//       asked, no row
//   2 · the team met on levels/block-squads.json under the fog: every hidden defender shouts in turn — a row exactly where the game's own hearing law
//       (hearPath, the path under the reach × its carry) says an ear gets it, from where the player stands and with his ear brought beside the man;
//       and the questions the row asks leave nothing in the route cache the AI's own hearing reads
//   3 · the same seed with the switch down and up, a hidden defender made to shout beside the player through the game's own say(): every digest the
//       same (a row moves nobody and no die); up, the row is on the strip
//   4 · the switch is a row of the two stands' list with its word, rides a recording's tables, and a recording from before the key replays with it down
// OVERHEARD_BREAK=1 leaves the switch down where the check raises it: 1, 2 and 3 must then FAIL (exit 1).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { CUES, Cues, isShout, stripRows } = await import(`${ROOT}/src/game/cues.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { hearPath } = await import(`${ROOT}/src/game/weather.ts`);
const { isHostile } = await import(`${ROOT}/src/game/teams.ts`);
const { DIGIN } = await import(`${ROOT}/src/game/digin.ts`);

const BREAK = process.env.OVERHEARD_BREAK === '1';
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
async function rig(seed: number) {
  Math.random = seeded(seed);
  const log = console.log, err = console.error, warn = console.warn; let W: any;
  try { console.log = console.error = console.warn = () => { };
    W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'block-squads.json'), 'utf8'))) });
    await startFromQuery(W.game, new URLSearchParams(`?levelFile=block-squads.json&roomclear=${seed}&squad4`));
  } finally { console.log = log; console.error = err; console.warn = warn; }
  return W;
}

export async function wordsOverheard(): Promise<boolean> {
  const F = family("words-overheard: a hidden defender's shout that reaches an ear is a quiet row on the strip, his words alone");
  const was = { ...CUES }, rnd = Math.random, stoodTop = CUES.overheard;   // (the shipped stand writes its switches once, at load: what it stood on is read here, before the check writes any)
  try {
    // ---- 1 · the bare clock
    {
      let asked = 0, carry = 1;
      const hid = new Set<any>();
      const man = (callsign: string, team: string, x: number) => ({ callsign, team, unit: true, state: 'alert', char: { pos: [x, 0, 0], alive: true } });
      const g: any = { time: 10, messages: [] as { text: string; t: number }[], audio: { play: () => { } }, fight: { log: [], defs: [], live: true }, level: {}, guards: [] as any[],
        player: { down: false, char: { pos: [0, 0, 0] } }, fogOfWar: { hidden: (gd: any) => hid.has(gd) },
        col: { sound: { propagate: (a: number[], b: number[]) => { asked++; return { pathLen: Math.hypot(a[0] - b[0], a[2] - b[2]), carry, muffle: 0 }; } } } };
      g.msg = (text: string) => { g.messages.push({ text, t: g.time }); if (g.messages.length > 5) g.messages.shift(); g.cues.raw(text); };
      g.cues = new Cues(g);
      const rows = () => (stripRows(g) as { text: string }[]).map(r => r.text);
      const fresh = () => { g.cues.reset(); g.time += 60; asked = 0; carry = 1; g.player.down = false; };
      CUES.on = true; CUES.overheard = !BREAK;
      const foe = man('Tango 3', 'hostile', 10), far = man('Tango 4', 'hostile', 25), seen = man('Tango 5', 'hostile', 10), mate = man('Vega', 'operative', -60), foeByMate = man('Tango 6', 'hostile', -66);
      hid.add(foe); hid.add(far); hid.add(foeByMate); hid.add(mate); g.guards = [foe, far, seen, mate, foeByMate];

      fresh(); const drew = g.cues.overheard(foe, 'find them!'); const r1 = rows();
      F.verdict(drew === true && r1.length === 1 && r1[0] === 'heard: find them!' && !/Tango|\d|radio/.test(r1[0]) && g.cues.rows.length === 0 && g.cues.heardRow?.text === 'find them!', 'a hidden defender shouts ten metres off in open air: one row, his words alone under the strip\'s own word for a thing heard — no name, no number, no place — and it is no row of the net\'s own list', `drew ${drew} · strip [${r1.join(' | ')}]`);
      const sq = (g.cues as any).squelchDue;
      F.verdict(sq === false && g.cues.netWait(1) === 0 && g.cues.netWait(6) === 0, 'it is not on the net: no squelch is owed, and no class of the net waits on it', `squelch owed ${sq} · netWait 1: ${g.cues.netWait(1)} · 6: ${g.cues.netWait(6)}`);

      const no: [string, () => boolean][] = [
        ['a man the team sees (his bubble is over him)', () => g.cues.overheard(seen, 'find them!')],
        ['a line with no shout in it', () => g.cues.overheard(foe, 'must have been nothing.')],
        ['a shout further off than a shout carries', () => g.cues.overheard(far, 'find them!')],
        ['a shout ten metres off through walls (carry 0.3)', () => { carry = 0.3; return g.cues.overheard(foe, 'find them!'); }],
        ['a teammate the fog hides', () => g.cues.overheard(mate, 'find them!')],
        ['a dead man', () => { foe.state = 'dead'; const r = g.cues.overheard(foe, 'find them!'); foe.state = 'alert'; return r; }],
        ['the player down and no teammate in reach', () => { g.player.down = true; return g.cues.overheard(foe, 'find them!'); }],
      ];
      const got = no.map(([label, fn]) => { fresh(); const d = fn(); return { label, d, n: rows().length }; });
      F.verdict(isShout('find them!') && !isShout('must have been nothing.') && got.every(x => x.d === false && x.n === 0), 'no row for: a man in sight, a line that is not shouted, a shout out of reach or through walls, a teammate, a dead man, nobody up to hear it', got.map(x => `${x.label}: ${x.d ? 'DREW' : 'no'}${x.n ? ` (${x.n} rows)` : ''}`).join(' · '));

      fresh(); g.player.down = true; const byMate = g.cues.overheard(foeByMate, 'they\'re at the door!'); mate.state = 'dead'; g.time += 20; const byDead = g.cues.overheard(foeByMate, 'get ready!'); mate.state = 'alert';
      F.verdict(byMate === true && byDead === false, 'the player down: a shout six metres from a LIVING teammate is a row, and with that teammate dead it is none', `living ${byMate} · dead ${byDead}`);

      // the strip's own rows are never pushed off, and push a heard row off first
      fresh(); g.msg('radio: one'); g.msg('radio: two'); g.msg('radio: three'); const full = g.cues.overheard(foe, 'find them!'); const r2 = rows(), fullAsked = asked;
      F.verdict(full === false && fullAsked === 0 && r2.join('|') === 'radio: one|radio: two|radio: three', 'a full strip: the shout is no row, every row of the net stays, and the hearing model is not asked', `drew ${full} · ${fullAsked} paths asked · [${r2.join(' | ')}]`);
      fresh(); g.msg('radio: one'); g.time += 3; g.msg('radio: two'); const third = g.cues.overheard(foe, 'find them!'); const r3 = rows(); g.time += 0.2; g.msg('radio: three'); const r4 = rows(); g.time += CUES.secs - 3; const r4b = rows();
      F.verdict(third === true && r3.join('|') === 'radio: one|radio: two|heard: find them!' && r4.join('|') === 'radio: one|radio: two|radio: three' && r4b.join('|') === 'radio: two|radio: three', 'two net rows and a shout heard, then a third net row: the heard row gives its place up, both older net rows stay — and it does not come back when a place falls free', `[${r3.join(' | ')}] → [${r4.join(' | ')}] → [${r4b.join(' | ')}]`);
      { // a unit's net line inside its class's gap is held back only when the strip is nearly full of the NET's rows: a heard row is not counted
        const net = (text: string) => g.cues.heard(man('Tango 7', 'hostile', 40), text);
        fresh(); net('shots fired! on me!'); g.time += 0.3; const lone = (net("he's moved — the mess"), rows().length);
        fresh(); net('shots fired! on me!'); g.cues.overheard(foe, 'find them!'); g.time += 0.3; net("he's moved — the mess"); const withShout = rows();
        F.verdict(lone === 2 && withShout.filter(t => t.startsWith('radio: ')).length === 2, 'a net row that would be drawn with the shout not there is drawn with it there (the heard row is not counted against the net\'s gap rule)', `without the shout ${lone} rows · with it [${withShout.join(' | ')}]`);
      }
      fresh(); const a1 = g.cues.overheard(foe, 'find them!'); g.time += 1; const a2 = g.cues.overheard(foe, 'get ready!'); g.time += CUES.overheardGap; const a3 = g.cues.overheard(foe, 'find them!'); const a4 = g.cues.overheard(foe, 'get ready!'); const r5 = rows();
      g.time += CUES.dupSecs; const a5 = g.cues.overheard(foe, 'find them!');
      F.verdict(a1 && !a2 && !a3 && a4 && r5.join('|') === 'heard: get ready!' && a5, 'one heard row at a time: a second shout a second later is none; the same words inside the strip\'s own ten seconds are none; a new shout past the gap takes the older one\'s place', `first ${a1} · a second later ${a2} · the same words again ${a3} · a new shout past the gap ${a4} · [${r5.join(' | ')}] · the first words again past ten seconds ${a5}`);

      fresh(); const b1 = g.cues.overheard(foe, 'find them!'); g.time -= 30; const b2 = rows().length; const b3 = g.cues.overheard(foe, 'find them!'); const b4 = rows(); g.cues.adopt([]); const b5 = rows().length;
      F.verdict(b1 && b2 === 0 && b3 && b4.join('|') === 'heard: find them!' && b5 === 0, 'the clock goes back half a minute (a checkpoint loaded): the row from the time ahead is not drawn, the same shout is a row again at once, and the load itself (adopt) clears it', `before ${b1} · rows after the clock went back ${b2} · the same shout again ${b3} [${b4.join(' | ')}] · after adopt ${b5}`);

      fresh(); CUES.overheard = false; const off = g.cues.overheard(foe, 'find them!'); const offAsked = asked, offRows = rows().length; CUES.overheard = !BREAK;
      fresh(); CUES.on = false; const cuesOff = g.cues.overheard(foe, 'find them!'); CUES.on = true;
      F.verdict(off === false && offAsked === 0 && offRows === 0 && cuesOff === false, 'the switch down: no row and the hearing model is not even asked; with the cues off altogether, none either', `down: drew ${off}, ${offAsked} paths asked, ${offRows} rows · cues off: ${cuesOff}`);
    }

    // ---- 2 · the real floor, the game's own hearing law
    const earsOf = (g: any) => { const at = (p: number[]) => [p[0], p[1] + 1.6, p[2]]; const out: number[][] = []; if (!g.player.down) out.push(at(g.player.char.pos)); for (const o of g.guards) if (o.team === 'operative' && o.state !== 'dead' && o.char.alive) out.push(at(o.char.pos)); return out; };
    let routed = 0;   // (how many of the law's questions went round walls: the ones a kept answer would have left in the route cache)
    const law = (g: any, gd: any) => { const p = gd.char.pos, m = [p[0], p[1] + 1.2, p[2]]; return earsOf(g).some(e => { if (Math.hypot(m[0] - e[0], m[2] - e[2]) > DIGIN.shoutM) return false; const h = hearPath(g, m, e, false); if (h.routed) routed++; return h.pathLen < DIGIN.shoutM * h.carry; }); };
    const ROUND = [[2, 0], [-2, 0], [0, 2], [0, -2], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]];
    const stagePlayer = (W: any, g: any) => { for (let i = 0; i < 60; i++) { g.player.visibility = 0.05; W.step(DT); }   // (cues-run's own staging: the player stood where the first squad's first posted man is aiming, read off the level's marks)
      const rc = g.level.scenarios?.roomClear, aim = rc?.rooms?.find((r: any) => r.id === rc.squads?.[0]?.rooms?.[0])?.marks?.[0]?.aimAt;
      if (!aim) throw new Error('words-overheard: block-squads.json has no first squad room with a mark to stage the player in front of');
      g.teleportPlayer([aim[0], 0, aim[2]]); };
    {
      const W = await rig(2), g = W.game; g.godMode = true; CUES.on = true; CUES.overheard = !BREAK; stagePlayer(W, g);
      let near = 0, farN = 0, seenRow = 0, frames = 0, named = 0, grew = 0; const wrong: string[] = []; const cache = (g.col.sound as any).cache as Map<string, unknown>; routed = 0;
      const ask = (gd: any, hidden: boolean, i: number) => {
        const want = hidden && law(g, gd);
        const C = g.cues as any, keep = { rows: C.rows, row: C.heardRow, said: C.heardSaid, shoutT: C.shoutT, log: C.heardLog.length, stats: JSON.stringify(C.stats) };
        C.rows = []; C.heardRow = null; C.heardSaid = new Map(); C.shoutT = undefined;   // (a bare strip for the question; put back after it — the run itself is never told)
        const c0 = cache.size; const drew = g.cues.overheard(gd, 'over here!'); grew += cache.size - c0; const row = (stripRows(g) as { text: string }[]).map(r => r.text);
        if (drew !== want) wrong.push(`${gd.callsign} @${(i / 60).toFixed(1)}s hidden ${hidden} law ${want} drew ${drew}`);
        if (drew) { if (row.join('|') !== 'heard: over here!') wrong.push(`${gd.callsign}: [${row.join(' | ')}]`); if (row.some(t => t.includes(gd.callsign))) named++; }
        if (!hidden) seenRow += drew ? 1 : 0; else if (want) near++; else farN++;
        C.rows = keep.rows; C.heardRow = keep.row; C.heardSaid = keep.said; C.shoutT = keep.shoutT; C.heardLog.length = keep.log; C.stats = JSON.parse(keep.stats);
      };
      for (let i = 0; i < 60 * 12; i++) {
        g.player.visibility = 1; W.step(DT); frames++;
        if (i % 30) continue;
        for (const gd of g.guards as any[]) {
          if (gd.state === 'dead' || !isHostile(gd.team, 'player')) continue;
          const hidden = g.fogOfWar.hidden(gd); ask(gd, hidden, i);   // where the player stands
          if (!hidden) continue;
          const pp = g.player.char.pos, was = [pp[0], pp[1], pp[2]];   // …and with his ear brought two metres from the man, eight ways round (walls between or not: the law says)
          for (const [dx, dz] of ROUND) { pp[0] = gd.char.pos[0] + dx; pp[2] = gd.char.pos[2] + dz; ask(gd, true, i); }
          pp[0] = was[0]; pp[1] = was[1]; pp[2] = was[2];
        }
      }
      F.verdict(g.fogOfWar.on === true && near >= 20 && farN >= 20 && !wrong.length && seenRow === 0 && named === 0, 'the block under the fog: each defender shouts in turn, from where the player stands and with his ear brought beside the man — a row exactly where a path under the reach × its carry gets to an ear of the team\'s, none where it does not, none for a man in sight, never his name', `${frames} frames · ${near} shouts in earshot drew · ${farN} out of it drew none · ${seenRow} rows for a man in sight · wrong: ${wrong.length ? wrong.slice(0, 4).join(' ; ') : 'none'}`);
      F.verdict(routed >= 20 && grew === 0, 'the row\'s own questions leave nothing behind: with that many of them going round walls, the route cache the AI\'s hearing reads did not grow by one entry across them', `${routed} of the law's questions went round walls · the cache grew by ${grew} across every question the row asked`);
    }

    // ---- 3 · the switch moves nobody; the say() road
    {
      const out: { moves: string; shouts: number; drawn: number; row: boolean; who: string; ring: string }[] = [];
      for (const on of [false, !BREAK]) {
        const W = await rig(2), g = W.game; g.godMode = true; CUES.on = true; CUES.overheard = on;   // (after the stand-up: on the frozen stand a stand-up writes every held switch down again)
        stagePlayer(W, g); let moves = '', row = false, who = '', ring = '';
        for (let i = 0; i < 60 * 30; i++) { g.player.visibility = 1; W.step(DT);
          if (i === 600) {   // ten seconds in: the player is stood two metres from a hidden defender who then shouts through the game's own say()
            pick: for (const gd of g.guards as any[]) { if (gd.state === 'dead' || !isHostile(gd.team, 'player') || !g.fogOfWar.hidden(gd)) continue;
              for (const [dx, dz] of ROUND) { g.teleportPlayer([gd.char.pos[0] + dx, 0, gd.char.pos[2] + dz]);   // (the teleport stands him on free floor: the law is asked from where he ended up — the same tries, in the same order, switch down or up)
                if (law(g, gd)) { g.cues.rows = []; g.say(gd, 'over here!'); who = gd.callsign; ring = g.messages[g.messages.length - 1]?.text ?? ''; break pick; } } } }
          if (i % 30 === 0) moves += hashDigest(digestGame(g, true) as any) + ' ';
          if (i >= 600 && i < 600 + 60 * 3) for (const r of stripRows(g) as { text: string }[]) if (r.text === 'heard: over here!') row = true; }
        out.push({ moves, shouts: g.cues.stats.shouts, drawn: g.cues.stats.shoutsDrawn, row, who, ring });
      }
      const [a, b] = out;
      F.verdict(a.moves === b.moves && a.shouts === 0 && !a.row && !!a.who && a.who === b.who, 'the same seed, the switch down and up, 30 s of the fight with a hidden defender made to shout beside the player: every digest the same (a heard row moves no man and no die); down, nothing is asked and nothing drawn', `${a.moves.split(' ').length - 1} digests ${a.moves === b.moves ? 'equal' : 'DIFFER'} · the man: ${a.who || 'NONE FOUND'} · down: ${a.shouts} asked, row ${a.row}`);
      F.verdict(b.row === true && b.drawn >= 1 && b.ring === `${b.who}: over here!`, 'up: his shout through say() is on the strip as a heard row — and the message ring nobody draws has the same line under his name, as it always had', `row ${b.row} · ${b.shouts} hidden shouts offered, ${b.drawn} drawn · the ring: '${b.ring}'`);
    }

    // ---- 4 · the two stands' row, the word, and a recording from before the key
    {
      const s = (await import(`${ROOT}/src/host/standEnv.ts`)).STAND_ENV as string[], PR = await import(`${ROOT}/src/host/profile.ts`), JR = await import(`${ROOT}/src/game/journal.ts`);
      const shipped = process.env.TPS_PROFILE === 'shipped';
      const W = await rig(3), stood = shipped ? stoodTop : CUES.overheard;   // (frozen: every stand-up writes the held switches again, so the one just made says it; shipped: the value from before the check)
      const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); const had = 'overheard' in snap.tables.CUES;
      CUES.overheard = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); CUES.overheard = false; JR.applyKnobs(W.game, snapUp); const kept = CUES.overheard;
      delete snap.tables.CUES.overheard; CUES.overheard = true; JR.applyKnobs(W.game, snap); const old = CUES.overheard;
      F.verdict(s.includes('TPS_OVERHEARD') && PR.FROZEN_HOLDS['CUES.overheard'] === 'TPS_OVERHEARD=1' && had && old === false && kept === true && stood === (shipped || process.env.TPS_OVERHEARD === '1'),
        'the switch is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one, rides a recording\'s tables, and a recording from before the key replays with it down',
        `STAND_ENV ${s.includes('TPS_OVERHEARD')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['CUES.overheard']} · stood up ${stood} (shipped ${shipped}) · in the tables ${had} · an old recording: ${old} · one recorded with it up: ${kept}`);
    }
  } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally { Object.assign(CUES, was); Math.random = rnd; }
  return F.done();
}
