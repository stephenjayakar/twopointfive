// The 'words' family (game/words.ts — THE DIALOGUE PASS: every line fits who says it and where), run through probes.ts:
//   bun run tools/qa/probes.ts words | words-lint | words-hostage | words-off   [--verbose]
// PASS / FAIL each, all headless. The switch (WORDS.on) is OFF on the frozen stand; each probe here raises it for itself and puts it back.
//   words-lint      the tables the pass added: every hostage line inside a bubble's length, none on the originality blocklist, none shared with the office
//                   civilians' table, every {other} line with a plain sibling in its pool; the whole of dialogue.ts's own lint still green with the switch on;
//                   and a defender's four pools for a pistol in a hold, with the pick (gunhold.ts)
//   words-hostage   a staged rescue with the switch on, the team standing still: every word out of a hostage's mouth is a hostage's line and never a
//                   civilian's; she pleads while he shouts, begs with his gun on her, the one beside her cries her name when she is shot; no message calls
//                   anybody a cleaner; and with the captor dead and a man of the team in the room, one of them speaks and a teammate answers
//   words-off       the switch off: the same staged run says only the lines the build said before the pass (the cleaner's corner lines), the label stands,
//                   and the message a shot hostage gets is the old one — off is the build as it was
//   words-routes    every patrol route of every level file is SAID as plain words with the switch on ('the north side', never 'the north b' off an id with no
//                   row nor 'the roundW'), and every line that says a route still fits a bubble with each level's two longest names in; the rule is also asked
//                   about two ids it must be red on. WORDS_BREAK=1 plants such a level in the list: the probe must fail
//   words-doors     every door a level's room clear structure lists is SAID by the rooms it joins when its id is shorthand ('hall-side mess door', never
//                   'm w door' / 'west west door'), and no two doors of a level are said the same. WORDS_BREAK=1 plants a level whose rooms cannot tell two
//                   doors apart by anything but the file's order, with the ordinals taken off: the probe must fail
import { readdirSync, readFileSync } from 'node:fs';
import { ROOT } from './headless.ts';
import { rig, family, guarded, give, up } from './rescue-probes.ts';
const { WORDS } = await import(`${ROOT}/src/game/words.ts`);
const D = await import(`${ROOT}/src/game/dialogue.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);

/** run `fn` with the switch as given, and put it back */
async function withWords<T>(on: boolean, fn: () => Promise<T>): Promise<T> { const was = WORDS.on; WORDS.on = on; try { return await fn(); } finally { WORDS.on = was; } }
/** a rescue stood and staged with the switch as given (the stand itself puts the switch down — src/host/standup.ts — so it is raised between the stand and the staging) */
async function staged(on: boolean, seed: number, knobs: Record<string, unknown>) { const T = await rig(seed, knobs, false); WORDS.on = on; T.why = T.R.start(); return T; }
/** every line a hostage says, and every message the HUD is handed, over a stepped stretch: [who, text, t] off the bubbles as they change */
function listen(T: any) {
  const said: { who: string; text: string; t: number }[] = [], msgs: string[] = [], last = new Map<any, any>(); let lastMsg: any = null;
  const tap = () => {
    for (const h of [...T.R.hostages, ...T.R.ops, ...T.R.hostiles]) { const b = h.bubble; if (b && last.get(h) !== b) { last.set(h, b); said.push({ who: h.callsign, text: b.text, t: T.game.time }); } }
    const M = T.game.messages; const m = M[M.length - 1]; if (m && m !== lastMsg) { const i = lastMsg ? M.indexOf(lastMsg) : -1; for (const x of M.slice(i + 1)) msgs.push(x.text); lastMsg = m; }
  };
  return { said, msgs, secs(s: number, until?: () => boolean) { for (let i = 0; i < Math.round(s * 60); i++) { T.step(); tap(); if (until?.()) return true; } return false; } };
}

export const wordsLint = guarded(async () => {
  const F = family('words-lint: the tables the dialogue pass added');
  const H: Record<string, string[]> = D.HOSTAGE_LINES, all: string[] = D.hostageLines(), civ = new Set<string>(D.civilianLines());
  const long = all.filter(t => t.replace(/\{other\}/g, 'Lindqvist').length > D.AIM_CHARS);
  F.verdict(all.length >= 25 && !long.length, `every hostage line fits a bubble (≤ ${D.AIM_CHARS} with the longest name in)`, `${all.length} lines · too long: ${long.join(' | ') || 'none'}`);
  const blocked = all.map(t => [t, D.blockedPhrase(t)]).filter(x => x[1]);
  F.verdict(!blocked.length, 'none on the originality blocklist', blocked.map(x => `'${x[0]}' (${x[1]})`).join(' · ') || 'clean');
  const shared = all.filter(t => civ.has(t));
  F.verdict(!shared.length, 'none shared with the office civilians\' table', shared.join(' | ') || `0 of ${all.length} in the ${civ.size} civilian lines`);
  const bare = Object.entries(H).filter(([k, pool]) => k !== 'team' && !pool.some(t => !t.includes('{other}')));
  F.verdict(!bare.length, 'every moment has a line that needs no second hostage', bare.map(x => x[0]).join(', ') || Object.entries(H).map(([k, p]) => `${k} ${p.length}`).join(' · '));
  const problems: string[] = await withWords(true, async () => D.lintDialogue());
  F.verdict(!problems.length, 'dialogue.ts\'s own lint is green with the switch on', problems.slice(0, 4).join(' · ') || 'no problems');
  // every other table the pass added a line to, as it reads with the switch on: inside a man's bubble with the longest tokens in (control's radio rows aside), nothing off the blocklist
  const others: [string, string[]][] = await withWords(true, async () => [['civilians', D.civilianLines()], ['needs', D.needsLines()], ['whistle', (await import(`${ROOT}/src/game/whistle.ts`)).whistleLines()],
    ['cues', (await import(`${ROOT}/src/game/cues.ts`)).cueLines().map((c: any) => c.text)], ['suppression', (await import(`${ROOT}/src/game/suppression.ts`)).suppressionLines()], ['doze', (await import(`${ROOT}/src/game/doze.ts`)).dozeLines()]]);
  const fill = (t: string) => t.replace(/\{(name|other|held|who)\}/g, 'Lindqvist').replace(/\{(room|at|the)\}/g, 'the manager\'s office').replace(/\{code\}/g, '4-7-1-9').replace(/\{[a-zA-Z]+\}/g, 'two');
  const bad = others.flatMap(([k, ls]) => ls.filter(t => (!/\bcontrol\b/.test(t) && fill(t).length > D.MAX_CHARS) || D.blockedPhrase(t))   // a line to or from control is the radio strip's, never a bubble
   .map(t => `${k}: '${t}'`));
  F.verdict(!bad.length && others.every(x => x[1].length > 0), 'the other tables\' lines fit a bubble and name nothing off the blocklist, switch on', bad.slice(0, 4).join(' · ') || others.map(x => `${x[0]} ${x[1].length}`).join(' · '));
  // the pistol-hold rule's four moments in a defender's mouth (gunhold.ts GUNHOLD_DEFENDER_LINES): a pool each, a short bark with no token in it, none of it the staff's line, the man in the arm never
  // called theirs (he can be a civilian), no office word, the errand round a 'coming round' row on their net and the 'gone' line neither 'stood down' nor 'fell back' — and the pick itself (gunHoldPool)
  const GM = await import(`${ROOT}/src/game/gunhold.ts`), GH: Record<string, string[]> = GM.GUNHOLD_DEFENDER_LINES, { cueClass } = await import(`${ROOT}/src/game/cues.ts`);
  const kinds = ['gun', 'shot', 'round', 'gone'], foe: any = { unit: {}, team: 'hostile' }, qrf: any = { unit: {}, team: 'guard' }, staff: any = { team: 'guard' };
  const staffLines = new Set<string>(kinds.flatMap(k => GM.gunHoldPool(staff, k)));
  const ghBad = kinds.flatMap(k => [...(GH[k].length ? [] : [`${k}: empty`]),
    ...GH[k].filter(t => t.length > D.AIM_CHARS || /[{}]/.test(t) || D.blockedPhrase(t) || staffLines.has(t) || /\b(one of ours|our man|ours)\b/i.test(t) || /\b(corridor|lift|fourth floor|desks?|cleaning staff|security|server room|guards?)\b/i.test(t)
      || (k === 'round' && cueClass(t) !== 1) || (k === 'gone' && [2, 5].includes(cueClass(t)))).map(t => `${k}: '${t}'`)]);
  F.verdict(!ghBad.length, 'a defender has his own words for a pistol in a hold', ghBad.join(' · ') || kinds.map(k => `${k} ${GH[k].length}`).join(' · '));
  const pickOn: boolean = await withWords(true, async () => kinds.every(k => GM.gunHoldPool(foe, k) === GH[k] && GM.gunHoldPool(qrf, k) !== GH[k] && GM.gunHoldPool(staff, k) !== GH[k]));
  const pickOff: boolean = await withWords(false, async () => kinds.every(k => GM.gunHoldPool(foe, k) === GM.gunHoldPool(staff, k)));
  F.verdict(pickOn && pickOff, 'only a defender draws from them, and only with the switch on', `switch on: defender own, response team and staff the staff\'s ${pickOn ? 'yes' : 'NO'} · switch off: defender the staff\'s ${pickOff ? 'yes' : 'NO'}`);
  return F.done();
});

export const wordsHostage = guarded(async () => withWords(true, async () => {
  const F = family('words-hostage: a hostage speaks as a hostage');
  const K = { resolveSpread: 0, resolveSecs: 20, secondHostageSecs: 6 };
  const mine = new Set<string>(D.hostageLines()), civ = new Set<string>(D.civilianLines());
  const names = (R: any) => R.hostages.map((h: any) => h.civ.name);
  const isHers = (R: any, text: string) => mine.has(text) || names(R).some((n: string) => D.hostageLines().some((t: string) => t.replace(/\{other\}/g, n) === text));
  { // the team stands still: the clock runs out, both are shot
    const T = await staged(true, 21, K), R = T.R, L = listen(T); give(T, 'hold'); T.step(); L.secs(40, () => !!R.result);
    const hs = new Set(R.hostages.map((h: any) => h.callsign)), hers = L.said.filter(s => hs.has(s.who));
    const wrong = hers.filter(s => !isHers(R, s.text)), fromCiv = hers.filter(s => civ.has(s.text));
    F.verdict(hers.length >= 3 && !wrong.length && !fromCiv.length, 'every word out of a hostage is a hostage\'s line, none the office civilians\'', `${hers.length} lines · not hers: ${wrong.map(s => s.text).join(' | ') || 'none'} · civilians': ${fromCiv.length}`);
    const t0 = R.t0, at = (w: string | RegExp) => T.at(w) ?? NaN, counting = at('step:counting'), act = at('act'), ex = at(/^executed:/);
    const threat = hers.filter(s => D.HOSTAGE_LINES.threat.includes(s.text)), early = threat.filter(s => s.t < counting - 0.01);
    F.verdict(threat.length >= 1 && !early.length, 'she pleads with his shouting once he is counting, not before', `threat lines at ${threat.map(s => (s.t - t0).toFixed(1)).join(', ') || '—'} s · counting from ${(counting - t0).toFixed(1)} s`);
    const begged = hers.find(s => D.HOSTAGE_LINES.aimed.includes(s.text) && Math.abs(s.t - act) < 0.05);
    F.verdict(!!begged, 'his gun on her: she begs, that frame', begged ? `${begged.who} at ${(begged.t - t0).toFixed(2)} s: '${begged.text}'` : `nothing at ${(act - t0).toFixed(2)} s`);
    const cried = hers.find(s => Math.abs(s.t - ex) < 0.05 && !D.HOSTAGE_LINES.aimed.includes(s.text));
    F.verdict(!!cried && isHers(R, cried.text), 'she is shot: the one beside her cries out', cried ? `${cried.who}: '${cried.text}'` : 'nothing');
    const office = L.msgs.filter(m => /cleaner|late worker|CIVILIAN CASUALTY|they (will|may) find/.test(m));
    F.verdict(!office.length && R.hostages.every((h: any) => h.civ.label === 'hostage') && L.msgs.some(m => /has been shot/.test(m)), 'no message calls her a cleaner; the rescue words the shot', office.join(' | ') || L.msgs.filter(m => /shot|FAILED/.test(m)).join(' | '));
    F.verdict(R.state === 'lost' && !T.bad, 'the run is what it was: lost with both shot', `state ${R.state} — ${R.result?.why}`);
  }
  { // the captor dead, nobody of his in the room: they call out; a teammate in the room: one speaks, he answers
    const T = await staged(true, 21, { ...K, doorMan: 'corridor', roamers: 0 }), R = T.R, L = listen(T), cap = R.hostiles[0]; give(T, 'hold'); T.step(); L.secs(4);
    killGuard(T.game, cap, [1, 0, 0], false, 'shot', 'player'); L.secs(24);
    const hs = new Set(R.hostages.map((h: any) => h.callsign));
    const alone = L.said.filter(s => hs.has(s.who) && D.HOSTAGE_LINES.alone.includes(s.text));
    F.verdict(alone.length >= 1 && up(R.hostages) === 2, 'nobody of theirs left in the room and nobody come yet: they call out', alone.map(s => `'${s.text}'`).join(' · ') || 'nothing');
    for (const h of R.hostiles) if (h.state !== 'dead') killGuard(T.game, h, [1, 0, 0], false, 'shot', 'player');
    const B = R.bounds, mid = [(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2], op = R.ops[0]; op.char.pos[0] = mid[0]; op.char.pos[2] = mid[2];
    // (how a rescue is won now — rescueend.ts, up on the shipped stand: nobody of theirs left on the floor is the win `clearSecs` 1.5 s later, sooner than the
    //  teammate's beat at 2.4 s. The answer is said all the same, after the result and before the end card (rescue.ts voices() runs on) — so the listening
    //  does not stop at the result, as it once did: it runs the beat out.)
    const n0 = L.said.length; L.secs(4);
    const after = L.said.slice(n0), rel = after.find(s => hs.has(s.who) && D.HOSTAGE_LINES.secured.includes(s.text)), ack = after.find(s => !hs.has(s.who) && D.HOSTAGE_LINES.team.includes(s.text));
    F.verdict(!!rel && !!ack && ack.t > rel.t + 1, 'the room is the team\'s: one of them speaks, a teammate answers a beat later', `${rel ? `${rel.who}: '${rel.text}'` : 'no hostage line'} · ${ack ? `${ack.who} +${(ack.t - (rel?.t ?? ack.t)).toFixed(1)} s: '${ack.text}'` : 'no answer'}`);
    const more = (() => { const n = L.said.length; if (R.result) L.secs(6); else L.secs(20, () => !!R.result); return L.said.slice(n).filter(s => hs.has(s.who)); })();   // (the result already in — the shipped stand's ending: a fixed stretch, not one step)
    F.verdict(!more.length && !T.bad, 'and then they are quiet: the room is held', more.map(s => s.text).join(' | ') || `state ${R.state}`);
  }
  return F.done();
}));

export const wordsOff = guarded(async () => withWords(false, async () => {
  const F = family('words-off: the switch off — every line as it was');
  const K = { resolveSpread: 0, resolveSecs: 20, secondHostageSecs: 6 };
  const T = await staged(false, 21, K), R = T.R, L = listen(T); give(T, 'hold'); T.step(); L.secs(40, () => !!R.result);
  const hs = new Set(R.hostages.map((h: any) => h.callsign)), hers = L.said.filter(s => hs.has(s.who)), mine = new Set<string>(D.hostageLines());
  const cower: string[] = D.CIV_LINES.cower;
  F.verdict(hers.length >= 1 && hers.every(s => cower.includes(s.text)) && !hers.some(s => mine.has(s.text)), 'a hostage says the corner lines the build had, and none of the new ones', `${hers.length} lines: ${[...new Set(hers.map(s => s.text))].join(' | ')}`);
  F.verdict(R.hostages.every((h: any) => h.civ.label !== 'hostage') && L.msgs.some(m => /, the (cleaner|late worker), is down/.test(m)), 'the label and the message of a shot hostage are the old ones', L.msgs.filter(m => /is down|has been shot/.test(m)).join(' | '));
  return F.done();
}));

/** a route's spoken name is plain words: 'the', then lower-case words of two letters or more (an id with no row falls back to its own letters: 'the north b', 'the roundW') */
const SAYABLE = /^the [a-z]{2,}(?: [a-z]{2,})*$/;
/** every string of dialogue.ts that says a route ({route} / {partnerRoute}), read off the source: the interrogation's rows, the 'routes' fact, the scripts */
function routeLines(): string[] {
  const out: string[] = [], has = /\{(partnerR|r)oute\}/i;
  for (const line of readFileSync(`${ROOT}/src/game/dialogue.ts`, 'utf8').split('\n')) { if (!has.test(line)) continue;
    for (const m of line.matchAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g)) { const t = m[0].slice(1, -1).replace(/\\(.)/g, '$1'); if (has.test(t)) out.push(t); } }
  return out;
}

export const wordsRoutes = guarded(async () => withWords(true, async () => {
  const F = family('words-routes: every patrol route has a name a man can say');
  const said = (ids: string[]) => { const L = { routes: ids.map(name => ({ name })) }; return ids.map((id, i) => ({ id, name: D.routeName(L, i) as string })); };
  const levels: { file: string; routes: { id: string; name: string }[] }[] = readdirSync(`${ROOT}/levels`).filter(f => f.endsWith('.json')).sort()
    .map(file => ({ file, routes: said((JSON.parse(readFileSync(`${ROOT}/levels/${file}`, 'utf8')).routes ?? []).map((r: any) => r.name ?? r.id)) })).filter(l => l.routes.length);
  if (process.env.WORDS_BREAK) levels.push({ file: '(planted)', routes: said(['gate', 'gate_b', 'roundN']) });
  const broken = levels.flatMap(l => l.routes.filter(r => !SAYABLE.test(r.name)).map(r => `${l.file} ${r.id} → '${r.name}'`));
  F.verdict(levels.length >= 8 && !broken.length, 'every route of every level file is said as plain words', broken.join(' · ') || `${levels.reduce((n, l) => n + l.routes.length, 0)} routes in ${levels.length} level files`);
  // the lines that say a route, with a level's own two longest names in (a man names his route and his partner's): still a bubble
  const lines = routeLines(), long: string[] = []; let worst = 0;
  for (const l of levels) { const by = [...new Set(l.routes.map(r => r.name))].sort((a, b) => b.length - a.length), route = by[0], partnerRoute = by[1] ?? by[0];
    for (const t of lines) { const x: string | null = D.expand(t, { route, partnerRoute, n: 'three', partner: 'Lindqvist' }); if (x === null) { long.push(`${l.file}: '${t}' does not resolve`); continue; }
      worst = Math.max(worst, x.length); if (x.length > D.MAX_CHARS) long.push(`${l.file}: ${x.length} — '${x}'`); } }
  F.verdict(lines.length >= 9 && !long.length, `every line that says a route fits a bubble (≤ ${D.MAX_CHARS}) on every level`, long.slice(0, 4).join(' · ') || `${lines.length} lines · longest ${worst}`);
  const twin = said(['gate', 'gate_b', 'roundN']).filter(r => !SAYABLE.test(r.name)).map(r => r.name);
  F.verdict(twin.length === 2, 'the rule is red on a twin with no row and on a mid-word capital', twin.join(' · ') || 'it let both through');
  return F.done();
}));

/** THE LOG'S OWN ROWS (from a tape of the compound, after the squad-names pass): a teammate the player's own round drops is not 'guard down — dead', a line the log
 *  already carries is not filed a second time when its man is dropped mid-word, and five men roused by one shot do not fill the five-row log with one word. Each
 *  asked with the switch on and off: off, the rows are the build's. */
export const wordsLog = guarded(async () => {
  const F = family('words-log: the log names a teammate, files a line once, and takes one CONTACT a second');
  const was = WORDS.on;
  try {
    for (const on of [true, false]) {
      const T = await staged(on, 23, {}), g = T.game, R = T.R; const said: string[] = []; { const msg = g.msg.bind(g); g.msg = (t: string) => { said.push(t); msg(t); }; }
      T.step(20);
      const [a, b] = R.ops; let n = said.length;
      killGuard(g, a, [1, 0, 0], false, 'shot', 'player'); const mine = said.slice(n); n = said.length;
      killGuard(g, b, [1, 0, 0], false, 'shot', 'guard'); const own = said.slice(n);
      const wantMine = on ? `${a.callsign} down — your round` : 'guard down — dead', wantOwn = on ? `${b.callsign} down — hit by his own side` : 'guard down — hit by his own side';
      F.verdict(mine.includes(wantMine) && own.includes(wantOwn) && (!on || !said.some(t => /^guard down/.test(t))), `words ${on ? 'on' : 'off'}: a teammate dropped by the player's round, and one by his own side's, read ${on ? 'by name' : 'as they did'}`, `want '${wantMine}' · '${wantOwn}' — got ${[...mine, ...own].join(' | ')}`);
      const hs = R.hostiles.filter((h: any) => h.state !== 'dead'); const h = hs[0]; n = said.length;
      g.say(h, 'who is that?', true); killGuard(g, h, [1, 0, 0], false, 'shot', 'player');
      const twice = said.slice(n).filter(t => t.endsWith('who is that?')).length;
      F.verdict(twice === (on ? 1 : 2), `words ${on ? 'on' : 'off'}: a line already in the log, its man dropped mid-word, is there ${on ? 'once' : 'twice, as it was'}`, said.slice(n).join(' | '));
      const rest = hs.slice(1); n = said.length; for (const x of rest) { x.bubble = null; x.standoff = null; x.state = 'patrol'; x.awareness = 1; }
      T.step(1);
      const rows = said.slice(n).filter(t => t.endsWith(': CONTACT!')).length, shouts = rest.filter((x: any) => x.bubble?.text === 'CONTACT!').length;
      F.verdict(shouts >= 2 && rows === (on ? 1 : shouts), `words ${on ? 'on' : 'off'}: ${shouts} men roused on one frame all shout it, and the log takes ${on ? 'one row' : 'a row a man, as it did'}`, `${shouts} bubbles · ${rows} rows — ${said.slice(n).join(' | ')}`);
    }
  } finally { WORDS.on = was; }
  return F.done();
});

/** a said door name that names nothing: only compass words / one- or two-letter tokens before 'door', or a word said twice running */
const NO_NAME = /^(?:(?:north|south|east|west|[a-z]{1,2}) )+door$|\b(\w+) \1\b/;
export const wordsDoors = guarded(async () => withWords(true, async () => {
  const F = family('words-doors: a door is said by the rooms it joins, one name a door');
  const N = await import(`${ROOT}/src/game/doornames.ts`), O = await import(`${ROOT}/src/game/orders.ts`);
  const levels: { file: string; rooms: string[]; lesson?: boolean; doors: { id: string; listed: boolean; name: string }[] }[] = [];
  for (const file of readdirSync(`${ROOT}/levels`).filter(f => f.endsWith('.json') && !/^office/.test(f)).sort()) {
    const L = JSON.parse(readFileSync(`${ROOT}/levels/${file}`, 'utf8')), rooms = L.scenarios?.roomClear?.rooms ?? []; if (!rooms.length) continue;
    const ids: string[] = (L.doors ?? []).map((d: any) => d.id), made: Map<string, string> = N.doorNamesOf(L, ids), listed = new Set(rooms.flatMap((r: any) => r.doors.map((d: any) => d.id)));
    levels.push({ file, rooms: rooms.map((r: any) => r.name), lesson: !!L.scenarios?.lesson, doors: ids.map(id => ({ id, listed: listed.has(id), name: made.get(id) ?? O.doorIdWords(id) })) });
  }
  if (process.env.WORDS_BREAK) levels.push({ file: '(planted)', rooms: [], doors: [{ id: 'w_w', listed: true, name: O.doorIdWords('w_w') }, { id: 'h_a', listed: true, name: 'hall door' }, { id: 'h_b', listed: true, name: 'hall door' }] });
  const empty = levels.flatMap(l => l.doors.filter(d => d.listed && NO_NAME.test(d.name)).map(d => `${l.file} ${d.id} → '${d.name}'`));
  const count = levels.reduce((n, l) => n + l.doors.filter(d => d.listed).length, 0);
  F.verdict(levels.length >= 8 && !empty.length, 'every door a structure lists has a name that names something', empty.slice(0, 6).join(' · ') || `${count} listed doors in ${levels.length} level files · longest name ${Math.max(...levels.flatMap(l => l.doors.map(d => d.name.length)))} characters`);
  const twins = levels.flatMap(l => l.doors.filter(d => d.listed && l.doors.some(o => o !== d && o.name === d.name)).map(d => `${l.file} ${d.id} → '${d.name}'`));
  F.verdict(!twins.length, 'no door a structure lists is said like another door of its level', twins.slice(0, 6).join(' · ') || 'all apart');
  const B = levels.find(l => l.file === 'block.json'), said = (id: string) => B?.doors.find(d => d.id === id)?.name ?? '(no such door)';
  const BEARING = /\b(?:north|south|east|west)(?:ern)?\b/;
  const bearing = levels.filter(l => !l.lesson).flatMap(l => l.doors.filter(d => d.listed && BEARING.test(d.name) && !l.rooms.some(r => BEARING.test(r))).map(d => `${l.file} ${d.id} → '${d.name}'`));
  F.verdict(bearing.length === 0, 'no said name carries a bearing its room\'s own name does not (a Training lesson\'s doors are its lines\' own: not asked)', bearing.slice(0, 6).join(' · ') || 'none');
  // (the block as rebuilt on 10-13: each held room has a hall door and one from the room behind it; the old floor's `w_w` and `mb` are gone)
  F.verdict(said('m_s') === 'hall-side mess door' && said('m_k') === 'kitchen-side mess door' && said('b_f') === 'comms room door from frame room', 'the block: a held room\'s two doors are named by the room and what each is taken from', `m_s '${said('m_s')}' · m_k '${said('m_k')}' · b_f '${said('b_f')}'`);
  // (an id of two places joined by 'to' is words, not shorthand: the squad's row and a defender's call say one name for it. WORDS_BREAK asks it of an id whose
  // joining token IS shorthand.)
  const joined = process.env.WORDS_BREAK ? 'kitchen_x_hall' : 'kitchen_to_hall';
  F.verdict(!N.shorthandId(joined) && N.shorthandId('m_to_k') && N.shorthandId('m_s') && O.doorIdWords('kitchen_to_hall') === 'kitchen to hall door', 'a door id of two places with \'to\' between reads as words on the squad\'s row and in a defender\'s call alike; letters either side of it are still shorthand', `${joined} ${N.shorthandId(joined) ? 'shorthand' : 'words'} · m_to_k ${N.shorthandId('m_to_k') ? 'shorthand' : 'words'} · said '${O.doorIdWords('kitchen_to_hall')}'`);
  return F.done();
}));

/** words-frag: the squad's refused frag says WHO is in it (squadthrow.ts `squadFragCatches`): a rescue's hostages are 'hostages', the man a snatch came for is named,
 *  anybody else unarmed is 'a civilian'; with the pass off all three are the one old line. Asked of the function itself on a staged rescue, the player and the
 *  team taken out of the question so only the unarmed are judged. WORDS_BREAK=1 expects the old line of the snatch's man with the pass on: must fail. */
export const wordsFrag = guarded(async () => {
  const F = family('words-frag'), { squadFragCatches } = await import(`${ROOT}/src/game/squadthrow.ts`), OLD = 'hostages. no frag.';
  {
    const T = await staged(true, 3, {}), g = T.game, h = T.R.hostages.find((x: any) => x.state !== 'dead');
    F.verdict(!!h, 'a rescue staged with a living hostage', T.why ?? '');
    if (!h) return F.done();
    const at: [number, number, number] = [h.char.pos[0], 0, h.char.pos[2]], name = h.civ?.name ?? 'our man';
    const base = { player: { down: true, char: g.player.char }, guards: g.guards.filter((x: any) => x.team !== 'operative') };
    const as = (over: Record<string, unknown>) => Object.assign(Object.create(g), base, over);
    const cases: [string, any, string][] = [
      ['a hostage', as({ snatch: { man: null }, civilians: [] }), OLD],
      ['the man a snatch came for', as({ rescue: null, snatch: { man: h }, civilians: [] }), process.env.WORDS_BREAK ? OLD : `${name} is in it. no frag.`],
      ['a civilian', as({ rescue: null, snatch: { man: null }, civilians: [h] }), 'a civilian is in it. no frag.'],
      ['nobody unarmed', as({ rescue: null, snatch: { man: null }, civilians: [] }), 'null'],
    ];
    for (const on of [true, false]) for (const [who, G, want] of cases) {
      const got = String(await withWords(on, async () => squadFragCatches(G, at, at))), exp = on || want === 'null' ? want : OLD;
      F.verdict(got === exp, `${on ? 'pass on' : 'pass off'} · ${who}: '${exp}'`, got === exp ? '' : `said '${got}'`);
    }
    F.verdict(!/hostage/i.test(`${name} is in it. no frag.`) && !/\b(north|south|east|west)\b/i.test(name), `the named line calls nobody a hostage ('${name} is in it. no frag.')`, '');
  }
  return F.done();
});

/** 'words-doornames' (game/doornames.ts authoredDoorNames, behind words.ts WORDS.doors — the page has it on, `?doornames=0` puts it off; off in the module
 *  and on the frozen stand, `TPS_DOORNAMES=1` raises it): a level says what its own doors are called where the rooms cannot (scenarios.doorNames), and no
 *  door's name on the HUD carries a bearing. All headless, read off the name the squad's row reads (orders.ts doorWords): no row seen on a page.
 *    1 · the lookup on a made-up level: a written name is the door's name, wins over a made one, is nothing with the key down (the same doors, the key
 *        asked when a name is read), names no door that is not there; a made name beside it is told apart as if the door had always been called that
 *    2 · every level file and the office: a written name says no bearing and begins with no 'the'; no two doors of a level are called the same
 *    3 · THE LIST OF WHAT IS OWED: the doors still called by a bearing are exactly DOORS_OWED below, door for door. A door that gets a name comes OFF the
 *        list in the same change (the line is red until it does), and no door not on it is ever called by one.
 *        `DOORNAMES_BREAK=1` reads the names with the key down: the office's two are owed again and the line must be red
 *    4 · the office stood up: the squad's row, a rear man's 'holding ·' and the response team's 'stack on …' say the one name with the key up, and what
 *        they said with it down
 *    5 · the two stands' row and word, and a recording from before the key */
const DOORS_OWED: Record<string, string> = {   // (10-19: 25 files, 96 doors, by id — the levels' own to name; the office's two are named)
  'barracks-gwot.json': 'n_yard ng_w s_end s_yard sg_e sg_w',
  'barracks.json': 'n_yard ng_w s_end s_yard sg_e sg_w',
  'bazaar.json': 'gate_e gate_n gate_s',
  'compound-gwot.json': 'c_n gate_n gate_w hall_n p_s yard_sw',
  'compound.json': 'c_n gate_n gate_w hall_n p_s yard_sw',
  'crossing.json': 'fence_e gate_e gate_n gate_ne gate_s gate_w hut_e imp_e rec_w shed_w',
  'gwot-yard.json': 'gate_w n_e n_w s_n s_w',
  'kit-yard.json': 'gate_s gate_w',
  'lights-out.json': 'gate_e gate_w',
  'police-post.json': 'gate_e gate_n gate_w hut_w shed_e side_e store_e yard_sw',
  'quiet-relay.json': 'gate_e gate_n gate_s gate_w',
  'quiet-yard.json': 'gate_s gate_w n_e n_w s_n s_w',
  'registry-gwot.json': 'stacks_w',
  'registry.json': 'stacks_w',
  'test-rooms.json': 'a ab b c',
  'train-hands.json': 'gate_e gate_w',
  'train-kit.json': 'gate_e gate_w',
  'train-lights.json': 'gate_e gate_w',
  'train-move.json': 'gate_e gate_w',
  'train-orders.json': 'gate_e gate_w hut_b_east',
  'train-pairs.json': 'gate_e gate_w hut_s hut_w store_n',
  'train-silent.json': 'gate_e gate_w',
  'vault.json': 'gate_e gate_w',
  'warehouse-gwot.json': 'b_s l_s p_s',
  'warehouse.json': 'b_s l_s p_s',
};
export const wordsDoorNames = guarded(async () => {
  const F = family('words-doornames: a level names its own doors where the rooms cannot, and no door\'s name carries a bearing');
  const N = await import(`${ROOT}/src/game/doornames.ts`), O = await import(`${ROOT}/src/game/orders.ts`), PR = await import(`${ROOT}/src/host/profile.ts`), JR = await import(`${ROOT}/src/game/journal.ts`);
  const shipped = process.env.TPS_PROFILE === 'shipped', was = { ...WORDS };
  const BEARING = /\b(?:north|south|east|west)|\b(?:N|S|E|W|NE|NW|SE|SW)\b/;   // (a bearing begun: 'northern', 'eastside', 'south-west'; or its letters)
  const bearing = (n: string) => BEARING.test(n) || /\b(?:north|south|east|west)/i.test(n);
  try {
    // ---- 5 (first: before the check writes any switch) · the two stands' row, the word, and a recording from before the key
    { const s = (await import(`${ROOT}/src/host/standEnv.ts`)).STAND_ENV as string[], word = process.env.TPS_DOORNAMES;
      const W = await (await import('./headless.ts')).standUp({ uploadEvery: 4 }), stood = WORDS.doors, want = word !== undefined ? word === '1' : shipped;   // (what THIS stand-up left the key at)
      const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); const had = 'doors' in snap.tables.WORDS;
      WORDS.doors = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); WORDS.doors = false; JR.applyKnobs(W.game, snapUp); const kept = WORDS.doors;
      delete snap.tables.WORDS.doors; WORDS.doors = true; JR.applyKnobs(W.game, snap); const old = WORDS.doors;
      F.verdict(s.includes('TPS_DOORNAMES') && PR.FROZEN_HOLDS['WORDS.doors'] === 'TPS_DOORNAMES=1' && had && old === false && kept === true && stood === want,
        'the key is a row of the two stands\' list with its word, stands up on the shipped stand and down on the frozen one (its word either way), rides a recording\'s tables, and a recording from before the key replays with it down',
        `STAND_ENV ${s.includes('TPS_DOORNAMES')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['WORDS.doors']} · stood up ${stood}, wanted ${want} (shipped ${shipped}, word ${word ?? 'none'}) · in the tables ${had} · an old recording: ${old} · one recorded with it up: ${kept}`);
      // ---- 4 · the office stood up: one name on the row, the rear man's row and the response team's line
      { WORDS.on = true; const g = W.game, d = g.doors.byName('breakroom_w'), RW = await import(`${ROOT}/src/game/rearwatch.ts`), T = await import(`${ROOT}/src/game/tactics.ts`);
        const read = () => `${O.doorWords(d)} | ${N.doorWrittenName(d) ?? `${T.doorLabel(d)} door`}`; void RW;
        WORDS.doors = true; const upRow = read(); WORDS.doors = false; const downRow = read();
        F.verdict(upRow === 'cubicles-side break room door | cubicles-side break room door' && downRow === 'break room west door | break room west door',
          'the office\'s break room door off the cubicles: the squad\'s row and a line that names it some other way say one name with the key up, and what each said with it down', `up: ${upRow} · down: ${downRow}`); } }
    WORDS.on = true;
    // ---- 1 · the lookup
    { const level: any = { scenarios: { roomClear: { rooms: [{ id: 'mess', name: 'mess', doors: [{ id: 'm_w', from: 'hall' }, { id: 'm_k', from: 'kitchen' }] }, { id: 'hall', name: 'hall', doors: [{ id: 'h_a', from: 'dock' }, { id: 'h_b', from: 'dock' }] }] },
        doorNames: [{ door: 'm_w', name: 'serving hatch' }, { door: 'gate_n', name: 'the yard gate' }, { door: 'h_a', name: 'loading door' }, { door: 'nobody', name: 'a door that is not there' }, { door: 'blank', name: '  ' }] } };
      const doors = (ids: string[]) => ids.map(id => ({ def: { name: id } })), said = (ds: any[]) => ds.map(d => O.doorWords(d)).join(' · ');
      // (the names are hung on the doors once, at construction, whatever the key says then; the key is asked each time a name is read)
      WORDS.doors = false; const ds = doors(['m_w', 'm_k', 'gate_n', 'gate_s', 'blank', 'h_a', 'h_b']); N.nameDoors(level, false, ds); const office = doors(['m_w', 'gate_n']); N.nameDoors(level, true, office);
      WORDS.doors = true; const up = said(ds), upOffice = said(office); WORDS.doors = false; const down = said(ds); WORDS.doors = true;
      F.verdict(up === 'serving hatch · kitchen-side mess door · yard gate · gate south door · blank door · loading door · hall door' && down === 'hall-side mess door · kitchen-side mess door · gate north door · gate south door · blank door · first hall door · second hall door' && upOffice === 'serving hatch · yard gate'
        && [...N.authoredDoorNames(level, ['m_w', 'gate_n']).keys()].join() === 'm_w,gate_n',
        'a written name is the door\'s name and wins over a made one (a leading \'the\' dropped); the door beside it is no longer a \'second\'; with the key down the same doors read as they were; a level with no made names (the office) takes them too; a row for no door, or an empty one, names nothing',
        `up: ${up} | down: ${down} | the office's rule: ${upOffice}`); }
    // ---- 2, 3 · the level files and the office
    WORDS.doors = !process.env.DOORNAMES_BREAK;
    const files: { file: string; L: any; office: boolean }[] = readdirSync(`${ROOT}/levels`).filter(f => f.endsWith('.json')).sort().map(file => ({ file, L: JSON.parse(readFileSync(`${ROOT}/levels/${file}`, 'utf8')), office: false }));
    const OS = (await import(`${ROOT}/levels/office.scenarios.ts`)).OFFICE_SCENARIOS;
    for (let i = files.length - 1; i >= 0; i--) if (!Array.isArray(files[i].L.doors)) files.splice(i, 1);   // (a lint list, a look file: not a level)
    for (const f of files) if (/^office/.test(f.file) && !f.L.scenarios) { f.L = { ...f.L, scenarios: OS }; f.office = true; }
    const bad: string[] = [], twins: string[] = [], owed: Record<string, string> = {}; let written = 0, doorsN = 0;
    for (const { file, L, office } of files) {
      const ids: string[] = (L.doors ?? []).map((d: any) => d.name ?? d.id);
      for (const r of L.scenarios?.doorNames ?? []) { written++; if (bearing(r.name)) bad.push(`${file} ${r.door}: '${r.name}' says a bearing`); if (/^the\s/i.test(r.name)) bad.push(`${file} ${r.door}: '${r.name}' begins with 'the'`); }
      const ds = ids.map(id => ({ def: { name: id } })); N.nameDoors(L, office, ds); const names = ds.map(d => O.doorWords(d)); doorsN += ids.length;
      names.forEach((n, i) => { if (names.indexOf(n) !== i) twins.push(`${file}: two doors called '${n}'`); });
      const k = ids.filter((_id, i) => bearing(names[i])).sort().join(' '); if (k) owed[file] = k;
    }
    F.verdict(files.length >= 30 && written >= 2 && !bad.length, 'every written name says no bearing and reads as a row does (no \'the\')', bad.slice(0, 8).join(' · ') || `${written} written names in ${files.length} level files`);
    F.verdict(!twins.length, 'no two doors of a level are called the same', twins.slice(0, 8).join(' · ') || `${doorsN} doors, each level's all apart`);
    const diff = [...new Set([...Object.keys(owed), ...Object.keys(DOORS_OWED)])].sort().filter(f => (owed[f] ?? '') !== (DOORS_OWED[f] ?? '')).map(f => `${f}: now [${owed[f] ?? ''}], on the list [${DOORS_OWED[f] ?? ''}]`);
    F.verdict(!diff.length, 'the doors still called by a bearing are exactly the list of what is owed, door for door (a door named comes off it; no other door gets one)', diff.join(' · ') || `${Object.keys(owed).length} files owed, ${Object.values(owed).reduce((a, b) => a + b.split(' ').length, 0)} doors · the office: ${files.filter(f => f.office).map(f => f.file).join(' ')} none`);
    if (process.env.DOORNAMES_CENSUS) console.log(Object.entries(owed).map(([f, k]) => `  '${f}': '${k}',`).join('\n'));
  } catch (e) { F.verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally { Object.assign(WORDS, was); }
  return F.done();
});
