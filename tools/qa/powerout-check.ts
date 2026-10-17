// THE LIGHTS GO OUT AND SOMEBODY GOES TO PUT THEM BACK ON — the check behind src/game/powerout.ts (POWEROUT.on: on in the page, ?nopowerout; off on the frozen
// stand, TPS_POWEROUT=1).
//   bun run tools/qa/powerout-check.ts        (also `probes.ts powerout`; run it on BOTH stands: plain, and with TPS_PROFILE=shipped in front)
// A room clear staged as the mission deals it, the team left standing on its start marks, Sam out of everybody's sight, the mains thrown by hand. The switch is
// thrown by the check; so are the dialogue pass and the teammates' work rule (a frozen stand without them hands the stock errand to one of Sam's own men, who
// walks into the house: another check's business). Read on the first of LEVELS where a PAIR goes (the levels are rebuilt under this check: no floor is counted on):
//   (a) a calm garrison: their word is on the net before any man of theirs has left his post, and the first step comes `beat` after it; no more than `men` go;
//       every man who left his post is one the timeline sent; nobody else stirs (the posted men keep their posts); every room that had a man keeps one; the men
//       out file boots for the team's ears and burn their lamps while the mains are down; a man of theirs is at the lever when the mains come back, later than
//       the word by the lever's own fumble; every man out is back on the post he left, holding it as he held it;
//   (b) the lights go a second time: nobody walks out again — one line, and the word is out (powerOutWord);
//   (c) the garrison already knows (gunfire written into one man's witness record): nobody leaves, one line, the word is out;
//   (d) the breaker shot to scrap: a man gets to it, says so, the word is out, the mains stay down and every man out is back on his post;
//   (e) a fight while they are out (real gunfire where Sam stands): no man of the party is the rule's any more inside three seconds, and none stands at the lever;
//   (f) the state round-trips powerOutSnapshot / powerOutRestore in the middle of a walk;
//   (g) the breaker in a defender's own room (the first of LEVELS where the timeline says so): one man goes, and he never leaves that room;
//   (i) no bulb in any man's view but a lit floor in one's (the glasshouse, its one bare bulb put out first): he notices `darkAfter` after the trip by the floor;
//   (j) every mains-fed light already out: nobody knows, nothing is said, nobody leaves his post;
//   (k) the first man dazzled when the beat is up: the second walks to the lever in his place; (l) the first man put down without a sound: his mate says so;
//   (m) a lone man put down the same way: no word until he is overdue, then one line; (n) the switch thrown off under a walk: the men out go back to their posts;
//   (h) the switch off = the base: no line, nobody leaves his post, the mains stay down, and thirty seeded seconds digest as the stand that never had the rule on.
// POWEROUT_BREAK=1 = `beat` thrown to nothing for (a) and the rule left on for (h): (a) and (h) must fail.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: a lamp here is a light the CPU's estimate counts, a line on the net is a string. Nobody has seen or heard any of this in play.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');
const LEVELS = ['depot.json', 'mousehole.json', 'killhouse.json', 'hall.json', 'barracks.json', 'warehouse.json', 'compound.json', 'records.json'];

function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

export async function poweroutCheck(): Promise<boolean> {
  const { standUp } = await import('./headless.ts');
  const { POWEROUT, powerOutTimeline, powerOutOwns, powerOutWord, powerOutSnapshot, powerOutRestore } = await import(`${ROOT}/src/game/powerout.ts`);
  const { WORDS } = await import(`${ROOT}/src/game/words.ts`), { WORK } = await import(`${ROOT}/src/game/workthings.ts`);
  const { breakerResetNear } = await import(`${ROOT}/src/game/lighting.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const DT = 1 / 60, rnd0 = Math.random, was = { ...POWEROUT }, wordsWas = WORDS.on, workWas = { ...WORK }; let all = true;
  const BREAK = process.env.POWEROUT_BREAK === '1';
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== powerout: the lights go out and somebody goes to put them back on ===');
  const levelOf = (file: string) => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const foes = (g: any): any[] => g.guards.filter((x: any) => x.unit && x.team === 'hostile' && x.state !== 'dead');
  /** the switches as this check runs them (a stand-up writes the held ones again: thrown after every one) */
  const throwOn = (on = true, patch: object = {}) => { Object.assign(POWEROUT, was, { on }, patch); WORDS.on = true; Object.assign(WORK, { on: true, posted: true, ownFace: true }); };
  interface Stood { W: any; g: any; men: any[]; post: Map<any, number[]>; room: Map<any, any>; lines: { t: number; s: string }[]; file: string }
  const stand = async (file: string, seed: number, on = true, patch: object = {}): Promise<Stood> => {
    Math.random = seeded(seed); const W: any = await quiet(() => standUp({ uploadEvery: 4, level: levelOf(file) })); const g = W.game;
    g.playerInvisible = true; g.godMode = true; throwOn(on, patch);
    const why = await quiet(async () => g.roomClear.start(1)); if (why) throw new Error(`the room clear did not start on ${file}: ${why}`);
    await quiet(async () => { for (let i = 0; i < 90; i++) W.step(DT); });
    const men = foes(g), lines: Stood['lines'] = [], msg0 = g.msg.bind(g); g.msg = (s: string) => { lines.push({ t: g.time, s }); return msg0(s); };
    return { W, g, men, post: new Map(men.map(gd => [gd, [...gd.char.pos]])), room: new Map(men.map(gd => [gd, g.fight.defs.find((D: any) => D.gd === gd)?.room ?? null])), lines, file };
  };
  const step = (W: any, n = 1) => quiet(async () => { for (let i = 0; i < n; i++) W.step(DT); });
  const off = (S: Stood, gd: any) => flat(gd.char.pos, S.post.get(gd)!);
  const ours = (S: Stood) => S.lines.filter(l => /\(radio\): (power's out|breaker's wrecked|he's down at the breaker|nothing from the breaker)/.test(l.s));
  const TL = (g: any): any[] => powerOutTimeline(g);
  /** run a stood floor until `until` says so or `secs` have gone, with `each` asked after every frame */
  const runFor = async (S: Stood, secs: number, each?: (i: number) => void, until?: () => boolean) => { for (let i = 0; i < secs * 60; i++) { await step(S.W); each?.(i); if (until?.()) break; } };

  try {
    // ---- the floor: the first level where a pair goes
    let pick: { file: string; seed: number } | null = null, own: { file: string; seed: number } | null = null; const tried: string[] = [];
    for (const file of LEVELS) { if (pick && own) break;
      const S = await stand(file, 11); S.g.setBlackout(86400, 'hand'); await runFor(S, 8, undefined, () => TL(S.g).some(e => e.what === 'said' || e.what === 'stay' || e.what === 'nobody'));
      const said = TL(S.g).find(e => e.what === 'said'); tried.push(`${file}: ${said ? said.why.split(',')[0] : TL(S.g).at(-1)?.what ?? 'nothing'}`);
      if (said && / and /.test(said.why) && !pick) pick = { file, seed: 11 };
      if (said && /in his own room/.test(said.why) && !own) own = { file, seed: 11 }; }
    if (!pick) { line(false, 'a level of the list sends a pair to the breaker', tried.join(' · ')); return false; }

    // (a) a calm garrison
    { const S = await stand(pick.file, pick.seed, true, BREAK ? { beat: 0 } : {}), g = S.g, men = S.men; g.setBlackout(86400, 'hand'); const t0 = g.time;
      const calm = new Map(men.map(gd => [gd, { state: gd.state, hold: gd.hold }]));
      let wordT = -1, firstOffT = -1, restoredT = -1, atLever = false, leverPrev = false, emptied = 0, lampOut = 0, outFrames = 0, strayLamp = 0, boots = 0; const left = new Set<any>(), seenEv = new Set<any>();
      await runFor(S, 150, () => {
        if (wordT < 0 && ours(S).length) wordT = ours(S)[0].t;
        for (const gd of men) { const d = off(S, gd), out = powerOutOwns(g, gd);
          if (d > 0.6) { left.add(gd); if (firstOffT < 0) firstOffT = g.time; }
          if (out && d > 1 && g.blackout.active) { outFrames++; if (gd.flashlight.enabled) lampOut++; }
          if (!out && !left.has(gd) && gd.flashlight.enabled) strayLamp++; }
        for (const e of g.events) if (e.kind === 'step' && !seenEv.has(e)) { seenEv.add(e); if (men.some(gd => gd.char.id === e.who && powerOutOwns(g, gd))) boots++; }
        for (const R of new Set(S.room.values())) { if (!R) continue; const had = men.filter(gd => S.room.get(gd) === R); if (had.length && !had.some(gd => off(S, gd) <= 0.6)) emptied++; }
        if (g.blackout.active) leverPrev = men.some(gd => breakerResetNear(g, gd));   // (lighting.ts's own gate for the re-arm, asked while the mains are still down)
        else if (restoredT < 0) { restoredT = g.time; atLever = leverPrev; }
      }, () => restoredT >= 0 && g.time - restoredT > 2 && !men.some(gd => powerOutOwns(g, gd)));
      const tl = TL(g), sent = tl.filter(e => e.what === 'go').map(e => e.who), homes = tl.filter(e => e.what === 'home').map(e => e.who), goT = tl.find(e => e.what === 'go')?.t ?? -1;
      const strangers = [...left].filter(gd => !sent.includes(gd.callsign)).map(gd => gd.callsign);
      const back = [...left].every(gd => off(S, gd) <= 0.6 && gd.hold === calm.get(gd)!.hold && gd.state === calm.get(gd)!.state && g.fight.defs.find((D: any) => D.gd === gd)?.mode === 'hold');
      line(wordT >= 0 && firstOffT > wordT && goT - wordT >= was.beat - 2 * DT, 'their word is on the net before any man of theirs has left his post, and the first step comes the beat after it',
        `${pick.file} · the lights go at 0 · "${ours(S)[0]?.s ?? '—'}" at ${(wordT - t0).toFixed(1)} s · the men step off at ${(goT - t0).toFixed(1)} s · the first man 0.6 m off his post at ${(firstOffT - t0).toFixed(1)} s`);
      line(sent.length >= 2 && sent.length <= was.men && strangers.length === 0 && left.size === sent.length && emptied === 0, 'no more than the rule\'s men go, every man who left his post is one it sent, and every room that had a man keeps one',
        `sent ${sent.join(', ')} · left their posts ${[...left].map(gd => gd.callsign).join(', ')} of ${men.length}${strangers.length ? ` · NOT SENT: ${strangers.join(', ')}` : ''} · frames a room stood empty ${emptied}`);
      line(boots >= 4 && outFrames > 30 && lampOut === outFrames && strayLamp === 0, 'the men out file their boots for the team\'s ears and burn their lamps while the mains are down; nobody else\'s lamp burns',
        `${boots} boots filed · ${lampOut} of ${outFrames} frames out in the dark with the lamp burning · lamp frames of men who stayed ${strayLamp}`);
      line(restoredT >= 0 && atLever && restoredT - wordT >= 2.2, 'the mains come back with a man of theirs at the lever, later than the word by the lever\'s own fumble',
        `mains back ${(restoredT - t0).toFixed(1)} s after they went, ${(restoredT - wordT).toFixed(1)} s after the word · a defender at the panel ${atLever}`);
      line(homes.length === sent.length && back && !men.some(gd => powerOutOwns(g, gd)), 'every man out is back on the post he left, holding it as he held it',
        `home ${homes.join(', ') || 'nobody'} · ${[...left].map(gd => `${gd.callsign} ${off(S, gd).toFixed(1)} m off, ${gd.state}`).join(' · ')}`);

      // (b) the lights go a second time (the same floor)
      const n0 = ours(S).length; g.setBlackout(86400, 'hand'); let moved = 0;
      await runFor(S, 12, () => { for (const gd of men) if (off(S, gd) > 0.6) moved++; });
      const again = ours(S).slice(n0);
      line(again.length === 1 && /no fault/.test(again[0].s) && moved === 0 && g.blackout.active && men.every(gd => powerOutWord(g, gd)), 'the lights go a second time: nobody walks out again — one line, and the word is out',
        `"${again.map(l => l.s).join(' | ') || '—'}" · frames a man was off his post ${moved} · mains still down ${g.blackout.active}`); }

    // (c) the garrison already knows
    { const S = await stand(pick.file, pick.seed), g = S.g, men = S.men; men[men.length - 1].witness.heard.shots = 1; g.setBlackout(86400, 'hand'); let moved = 0;
      await runFor(S, 12, () => { for (const gd of men) if (off(S, gd) > 0.6) moved++; });
      line(ours(S).length === 1 && /that's them/.test(ours(S)[0].s) && moved === 0 && men.every(gd => powerOutWord(g, gd)) && !TL(g).some(e => e.what === 'go'), 'the garrison already knows: nobody leaves, one line, the word is out',
        `"${ours(S).map(l => l.s).join(' | ') || '—'}" · frames a man was off his post ${moved}`); }

    // (d) the breaker shot to scrap
    { const S = await stand(pick.file, pick.seed), g = S.g, men = S.men; g.setBlackout(Infinity, 'shot');
      await runFor(S, 150, undefined, () => TL(g).some(e => e.what === 'wrecked') && !men.some(gd => powerOutOwns(g, gd)));
      const tl = TL(g), wrecked = tl.find(e => e.what === 'wrecked'), sent = tl.filter(e => e.what === 'go').length, home = tl.filter(e => e.what === 'home').length;
      line(!!wrecked && ours(S).some(l => /breaker's wrecked/.test(l.s)) && g.blackout.active && men.every(gd => powerOutWord(g, gd)) && sent >= 1 && home === sent && men.every(gd => off(S, gd) <= 0.6),
        'the breaker shot to scrap: a man gets to it, says so, the word is out, the mains stay down and every man out is back on his post',
        `${wrecked ? `${wrecked.who} at the panel ${(wrecked.t - tl[0].t).toFixed(1)} s after the round` : 'nobody said it'} · sent ${sent}, home ${home} · furthest off his post now ${Math.max(...men.map(gd => off(S, gd))).toFixed(1)} m`); }

    // (e) a fight while they are out
    { const S = await stand(pick.file, pick.seed), g = S.g, men = S.men; g.setBlackout(86400, 'hand');
      await runFor(S, 30, undefined, () => men.some(gd => powerOutOwns(g, gd) && off(S, gd) > 2));
      const out = men.filter(gd => powerOutOwns(g, gd)); const t1 = g.time;
      for (let k = 0; k < 6; k++) { g.events.push({ kind: 'shot', pos: [...g.player.char.pos], time: g.time, loud: true, level: 2 }); await step(S.W, 6); }
      await runFor(S, 3, undefined, () => !men.some(gd => powerOutOwns(g, gd)));
      const still = men.filter(gd => powerOutOwns(g, gd)), aborts = TL(g).filter(e => e.what === 'abort').length;
      line(out.length >= 1 && still.length === 0 && aborts >= out.length && g.blackout.active, 'a fight while they are out: no man of the party is the rule\'s any more inside three seconds, and the mains are still down',
        `${out.map(gd => gd.callsign).join(', ') || 'nobody'} out when the shots came · still the rule's ${(g.time - t1).toFixed(1)} s on: ${still.map(gd => gd.callsign).join(', ') || 'nobody'} · aborts ${aborts}`); }

    // (f) the state's pair, in the middle of a walk
    { const S = await stand(pick.file, pick.seed), g = S.g, men = S.men; g.setBlackout(86400, 'hand');
      await runFor(S, 30, undefined, () => men.some(gd => powerOutOwns(g, gd) && off(S, gd) > 2));
      const snap = powerOutSnapshot(g), before = JSON.stringify(snap), owned = men.filter(gd => powerOutOwns(g, gd)).length;
      powerOutRestore(g, null); const gone = !men.some(gd => powerOutOwns(g, gd)) && powerOutSnapshot(g) === undefined;
      powerOutRestore(g, JSON.parse(before)); const after = JSON.stringify(powerOutSnapshot(g));
      line(owned >= 1 && gone && after === before && men.filter(gd => powerOutOwns(g, gd)).length === owned, 'the state round-trips powerOutSnapshot / powerOutRestore in the middle of a walk', `${owned} men out · cleared ${gone} · the same after ${after === before} (${before.length} bytes)`); }

    // (g) the breaker in a defender's own room
    if (own) { const S = await stand(own.file, own.seed), g = S.g, men = S.men; g.setBlackout(86400, 'hand'); const left = new Set<any>(); let outside = 0;
      await runFor(S, 90, () => { for (const gd of men) { if (off(S, gd) > 0.6) left.add(gd); if (powerOutOwns(g, gd) && S.room.get(gd) && g.fight.roomAt(gd.char.pos) !== S.room.get(gd) && !S.room.get(gd).entries.some((e: any) => flat(e.door.frameCentre, gd.char.pos) < 1.2)) outside++; } },
        () => !g.blackout.active && !men.some(gd => powerOutOwns(g, gd)));
      line(left.size === 1 && outside === 0 && !g.blackout.active, 'the breaker in a defender\'s own room: one man goes to it, he never leaves that room, and the mains come back',
        `${own.file} · ${[...left].map(gd => gd.callsign).join(', ') || 'nobody'} left his post · frames outside his room ${outside} · mains back ${!g.blackout.active}`); }
    else line(true, 'the breaker in a defender\'s own room: no level of the list has one today (not asked)', tried.join(' · '));

    // (i) no bulb in anybody's view, a lit floor in somebody's: the glasshouse with its one bare bulb put out first (its yard lamps hang where no man inside has a line to them)
    { const S = await stand('glasshouse.json', 11), g = S.g; const bulb = g.targets.find((t: any) => t.name === 'bulb_store'); if (bulb) bulb.on = false; await step(S.W, 30);
      g.setBlackout(86400, 'hand'); const t0 = g.time; await runFor(S, 12, undefined, () => TL(g).some(e => e.what === 'said' || e.what === 'stay' || e.what === 'nobody'));
      const saw = TL(g).find(e => e.what === 'noticed'), word = TL(g).find(e => e.what === 'said' || e.what === 'stay');
      line(!!bulb && !!saw && /floor/.test(saw.why) && saw.t - t0 >= POWEROUT.darkAfter - 1e-6 && saw.t - t0 <= POWEROUT.darkAfter + 0.1 && !!word && ours(S).length === 1,
        'no fixture in any man\'s view: the man whose lit floor goes dark is the one who notices, a moment after the trip, and their word follows',
        `${saw ? `${saw.who} at ${(saw.t - t0).toFixed(2)} s: ${saw.why}` : `nobody noticed (${TL(g).at(-1)?.why ?? 'no timeline'})`} · lines ${ours(S).length}`); }

    // (j) nothing of the mains burning anywhere: there is nothing to miss
    { const S = await stand(pick.file, pick.seed), g = S.g, men = S.men; for (const t of g.targets) if (t.mains && t.kind !== 'breaker') t.on = false; await step(S.W, 30);
      g.setBlackout(86400, 'hand'); let moved = 0; await runFor(S, 12, () => { for (const gd of men) if (off(S, gd) > 0.6) moved++; });
      line(TL(g).some(e => e.what === 'nobody') && ours(S).length === 0 && moved === 0, 'every mains-fed light already out: nobody knows the power went, nothing is said and nobody leaves his post',
        `${TL(g).map(e => e.what).join(', ') || 'no timeline'} · lines ${ours(S).length} · frames a man was off his post ${moved}`); }

    // (k) the first man cannot step off when the beat is up: the second goes for the lever in his place
    { const S = await stand(pick.file, pick.seed), g = S.g, men = S.men; g.setBlackout(86400, 'hand');
      await runFor(S, 12, undefined, () => TL(g).some(e => e.what === 'said'));
      const lead = men.find(gd => gd.callsign === TL(g).find(e => e.what === 'said')?.who); if (lead) lead.dazzledUntil = g.time + 20;
      await runFor(S, 60, undefined, () => !g.blackout.active);
      const go = TL(g).filter(e => e.what === 'go'), no = TL(g).filter(e => e.what === 'abort' && /does not step off/.test(e.why));
      line(!!lead && no.length === 1 && no[0].who === lead.callsign && go.length === 1 && go[0].who !== lead.callsign && /walks to the lever/.test(go[0].why) && !g.blackout.active && off(S, lead) < 0.6,
        'the first man dazzled as the beat ends: he stays, the second walks to the lever in his place, and the mains come back',
        `${no.map(e => `${e.who} ${e.why}`).join(' · ') || 'nobody stayed'} · ${go.map(e => `${e.who} ${e.why.split(',')[0]}`).join(' · ') || 'nobody went'} · mains back ${!g.blackout.active}`); }

    // (l) a man of the party put down without a sound: the mate out with him sees him on the floor and says so; (m) a lone man put down the same way is only missed
    { const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
      { const S = await stand(pick.file, pick.seed), g = S.g, men = S.men; g.setBlackout(86400, 'hand');
        await runFor(S, 30, undefined, () => men.filter(gd => powerOutOwns(g, gd) && off(S, gd) > 3).length >= 2);
        const lead = men.find(gd => gd.callsign === TL(g).find(e => e.what === 'go' && /walks to the lever/.test(e.why))?.who), n0 = ours(S).length;
        if (lead) killGuard(g, lead, [0, 0, 1], true); await runFor(S, 25, undefined, () => ours(S).length > n0 && !men.some(gd => powerOutOwns(g, gd)));
        const said = ours(S).slice(n0);
        line(!!lead && said.length === 1 && /he's down at the breaker/.test(said[0].s) && foes(g).some(gd => powerOutWord(g, gd)) && !men.some(gd => powerOutOwns(g, gd)),
          'the first man put down without a sound, his mate a few paces off: the mate says so, the word is out, and nobody is out for the lights any more',
          `${said.map(l => `"${l.s}"`).join(' · ') || 'nothing said'} · ${TL(g).slice(-2).map(e => `${e.who} ${e.what}`).join(', ')}`); }
      { const S = await stand(pick.file, pick.seed, true, { men: 1 }), g = S.g, men = S.men; g.setBlackout(86400, 'hand');
        await runFor(S, 30, undefined, () => men.some(gd => powerOutOwns(g, gd) && off(S, gd) > 1.5));
        const lone = men.find(gd => powerOutOwns(g, gd)), n0 = ours(S).length, t1 = g.time; if (lone) killGuard(g, lone, [0, 0, 1], true);
        let early = false, calm = true; const rousedNow = () => foes(g).some(gd => gd.state === 'alert' || gd.state === 'search');
        await runFor(S, 90, () => { if (rousedNow()) calm = false; if (calm && g.time - t1 < 5 && foes(g).some(gd => powerOutWord(g, gd))) early = true; }, () => TL(g).some(e => e.what === 'overdue') || !calm);
        const said = ours(S).slice(n0), od = TL(g).find(e => e.what === 'overdue');
        line(!!lone && !early && (calm ? !!od && said.length === 1 && /nothing from the breaker/.test(said[0].s) && foes(g).some(gd => powerOutWord(g, gd)) && od.t - t1 > 5 : said.length === 0),
          'a lone man put down without a sound: nobody is told by magic — the word comes only when he is overdue, in one line (or a man of theirs saw it and the fight is on)',
          `${calm ? `calm · overdue ${od ? `${(od.t - t1).toFixed(1)} s after he fell` : 'never'}` : 'a defender was roused by it'} · ${said.map(l => `"${l.s}"`).join(' · ') || 'nothing said'} · the word early ${early}`); } }

    // (n) the switch thrown off under a walk: the men out run back to their posts
    { const S = await stand(pick.file, pick.seed), g = S.g, men = S.men; g.setBlackout(86400, 'hand');
      await runFor(S, 30, undefined, () => men.filter(gd => powerOutOwns(g, gd) && off(S, gd) > 3).length >= 1);
      const out = men.filter(gd => powerOutOwns(g, gd) && off(S, gd) > 0.6); POWEROUT.on = false; await step(S.W, 60 * 25);
      line(out.length >= 1 && out.every(gd => off(S, gd) < 1.2) && g.blackout.active, 'the switch thrown off under a walk: every man out is back on his post, and the mains stay down',
        `${out.map(gd => `${gd.callsign} ${off(S, gd).toFixed(1)} m off, ${gd.state}`).join(' · ') || 'nobody was out'}`); }

    // (h) off = the base
    { const run = async (S: Stood) => { const g = S.g; let s = '', moved = 0; Math.random = seeded(361); g.setBlackout(86400, 'hand');
        for (let i = 0; i < 1800; i++) { await step(S.W); for (const gd of S.men) if (off(S, gd) > 0.6) moved++; if (i % 60 === 59) s += hashDigest(digestGame(g, true)) + ' '; }
        return { s, moved, lines: ours(S).length, down: g.blackout.active, tl: TL(g).length }; };
      const base = await run(await stand(pick.file, 36, false));
      { const S0 = await stand(pick.file, 37); S0.g.setBlackout(86400, 'hand'); await step(S0.W, 600); }   // (the rule has run in this process, on another floor)
      const So = await stand(pick.file, 36, BREAK); const o = await run(So);
      line(o.lines === 0 && o.moved === 0 && o.down && o.tl === 0 && o.s === base.s, 'the switch off: no line, nobody leaves his post, the mains stay down, and thirty seeded seconds digest as the stand that never had the rule on',
        `lines ${o.lines} · frames a man was off his post ${o.moved} (base ${base.moved}) · mains down ${o.down} · thirty digests equal ${o.s === base.s}`); }
  } finally { Object.assign(POWEROUT, was); WORDS.on = wordsWas; Object.assign(WORK, workWas); Math.random = rnd0; }
  console.log(`=== powerout: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await poweroutCheck()) ? 0 : 1);
