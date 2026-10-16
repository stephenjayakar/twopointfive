// A WALK TRIES THE DOOR (src/game/orders.ts ORDERS.walkTries, walkTry / walkStacks; src/game/doortools.ts walkTried) — a 'move there' whose only way in
// runs at a door locked against the team that nobody has tried is not refused with the door's name any more: the men walk up to it, the man on the jamb
// tries the handle, and the order ends there the way a door order ends 'found shut' — the same words, said once, the men left stacked on the door. Only
// then does the team know, and the same order is refused as it always was. It acts where DOORTOOLS.testDoor is on; the probe sets that key itself.
//   bun run tools/qa/probes.ts move-walktries       (family 'walktries'; TPS_PROFILE=shipped for the page's stand, TPS_WALKTRIES=1 raises the key on the frozen one)
// Headless, staged the same on either stand; nothing here looks at a picture or hears a voice (the lines are read off Game.say, the menu off Orders.hud()).
//   fault    key off, the office's manager's room from the corridor (both of its doors locked, nobody has tried either): 'move there' to a spot inside is
//            refused with the door's name, and the menu's row is greyed with the same words — a lock nobody tried, told
//   walk     key on, the same: not refused, not greyed; the men walk (never faster than a plain 'move' walks them); one man tries the leaf; the door
//            orders' own words are said once and logged; every man of the order is left stacked on that door, on his mark three seconds on, on his own
//            side of it, nobody inside the room, nobody moving after; the team knows, and the same order is now refused and greyed as with the key off
//   four     the same with the squad of four, one pair sent: that pair is halted on the door, the other pair is where it was
//   wedge    the Mousehole, the four, its store door wedged by hand against the corridor (the level's own wedges are a defender's to set): key on, all four
//            walk up, one says 'wedged from inside. holding on it — your call.', all four are left stacked on it, and the order again is refused; key
//            off, refused at once
//   free     the door unlocked, or opened from inside, two seconds into the walk: the move goes on to its places (one try and "it's not locked." once; an
//            open leaf is not tried)
//   second   two locks on the way, the first turning at the handle: the second gets its own try and its own 'found shut'; nobody is walked through it
//   other    another order mid-walk leaves nothing of the walk · the jamb's man down: his mate tries · the four, the other pair ordered meanwhile: each
//            pair its own 'set.' · no room to stack on the door (FORCED): 'no room on that door.' · DOORTOOLS.testDoor off: the key does nothing
//   open     a spot behind a door standing open: key on against key off, every man the same
//   known    a door the team already knows shut (a plain 'stack up' tried it first): refused the same key on and key off, every man the same
//   ring     a door Sam's ring opens: taken the same key on and key off, every man the same
//   twice    two key-on runs end with every man on the same spot
//   journal  a recording from before the key replays with it off (journal.ts applyKnobs); one that carries it keeps its own word
// WALKTRIES_BREAK=1 = the key is left off in this probe's key-on runs: every KEY ON line but 'twice' (and with them the verdict) must fail on both stands.
import { standUp, ROOT } from './headless.ts';
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { ORDERS, sideOf, doorWords } = await import(`${ROOT}/src/game/orders.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${p[0].toFixed(2)}, ${p[2].toFixed(2)})`;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
const DT_DEFAULTS = JSON.parse(JSON.stringify(DOORTOOLS)), RC_DEFAULTS = { ...ROOMCLEAR }, NB_DEFAULTS = { ...NIGHTBREACH }, ORD_DEFAULTS = { ...ORDERS, followBack: [...ORDERS.followBack] };
const back = () => { Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS); Object.assign(ORDERS, ORD_DEFAULTS, { followBack: [...ORD_DEFAULTS.followBack] }); };

// the office (the room clear's level). Sam stands down the corridor, off every lock's rows but the server door's: at a door's rows he would KNOW it
// (doortools.ts testStacks). INSIDE: floor in the manager's room, a stride and a half in from its corridor door. CONF: floor in the conference room,
// whose door stands open
const AWAY: number[] = [19.5, 0, 11.2], INSIDE: number[] = [25.75, 0, 8.5], CONF: number[] = [9.8, 0, 8.0], STORE: number[] = [32.75, 0, 8.0];
const NOT_LOCKED = /: it's not locked\.$/, NO_ROOM = 'no room on that door.';
const SHUT_LINE = /holding on it — your call\.$/;

interface Man { c: string; order: string; door: string; there: string; post: number[] | null; pos: number[]; side: number; /** he still carries the walk's `tries` */ tries: boolean; arrived: boolean; dead: boolean }
interface Row { off: boolean; text: string }
interface Run { row0: Row | null; why: string | null; said: string[]; menAt0: Man[]; halt: Man[]; later: Man[]; row1: Row | null; why2: string | null; end: Man[]; secs: number; top: number; walked: number[]; log: string[]; halted: number; tested: number;
  knew0: boolean; knew1: boolean; /** frames a walker still to try the door read 'in position' on the HUD */ lied: number; shutStill: boolean; frame: number[]; samSide: number; name: string; who: string[] }

/** one game: the room clear staged quiet (its defenders dazzled every frame: this is about feet), Sam down the corridor, the two keys set AFTER the stand-up
 *  (the frozen stand pins both off, the page's raises both — here each run is told) */
async function rig(key: boolean, squad: 2 | 4, testDoor = true) {
  back(); Object.assign(NIGHTBREACH, { squad }); Math.random = seeded(5);
  const W: any = await quiet(() => standUp()); const g = W.game, O = g.orders, D = g.doorTools, NB = g.nightBreach;
  g.godMode = true; await quiet(() => g.roomClear.start(5));
  DOORTOOLS.testDoor = testDoor; ORDERS.walkTries = key;
  const said: string[] = [], say = g.say.bind(g);
  g.say = (gd: any, text: string, ...rest: any[]) => { said.push(`${gd.callsign}: ${text}`); return say(gd, text, ...rest); };
  const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; for (const h of NB.hostiles) if (h.state !== 'dead') h.dazzledUntil = g.time + 5; W.step(DT); } };
  // (the page's squad opens following Sam, the frozen stand's with no order: told to hold where it stands, the same on both, before anything is read)
  await quiet(() => { step(30); g.teleportPlayer(AWAY); step(5); O.give('hold', O.targetAt(g.player.char.pos), 'all'); step(60); });
  return { g, O, D, said, step, door: (name: string): any => g.doors.list.find((d: any) => d.def.name === name) };
}
type Rig = Awaited<ReturnType<typeof rig>>;
/** what a staging does part-way through the walk: `[seconds after the order, what]` */
type Mid = [number, (R: Rig, d: any, sent: any[]) => void];
interface Opts { squad?: 2 | 4; who?: any; mids?: Mid[]; testDoor?: boolean; /** done once the game stands, before anything is asked */ before?: (R: Rig, d: any) => void
}

/** `mode`: 'locked' the manager's room, nobody has tried its door · 'known' the same after a plain 'stack up' has tried it · 'ring' the same with the
 *  door's key on Sam's ring · 'open' the conference room, its door standing open. 'move there' is given to `who`, read, played out, and given once more. */
async function play(mode: 'locked' | 'known' | 'ring' | 'open', key: boolean, o: Opts = {}): Promise<Run> {
  const who = o.who ?? 'all', mids = [...(o.mids ?? [])], R = await rig(key, o.squad ?? 2, o.testDoor ?? true), { g, O, D, said } = R, d = R.door('manager'), samSide = sideOf(d, g.player.char.pos), spot = mode === 'open' ? CONF : INSIDE;
  const team: any[] = O.men('all'), sent: any[] = O.men(who);
  const men = (l: any[] = team): Man[] => l.map((m: any) => { const A = O.of(m); return { c: m.callsign, order: String(A?.order ?? '-'), door: String(A?.door?.def.name ?? '-'), there: String(A?.there ?? '-'), post: A?.post ? [A.post[0], 0, A.post[2]] : null, pos: [m.char.pos[0], 0, m.char.pos[2]], side: sideOf(d, m.char.pos), tries: !!A?.tries, arrived: !!A?.arrived, dead: m.state === 'dead' }; });
  /** the menu opened on that spot as the player opens it: its 'move there' row — greyed or not, and its words */
  const row = (): Row | null => { const was = O.who; O.who = who; try { if (!O.open(O.targetAt(spot))) return null; const r = O.hud().menu?.rows.find((x: any) => String(x.opts[0]?.text ?? '').startsWith('move there')); return r ? { off: !!r.off, text: String(r.opts[0].text) } : null; } finally { O.close(); O.who = was; } };
  if (mode === 'known') await quiet(() => { O.give('stack', O.targetAt(d.frameCentre), who); for (let i = 0; i < 60 * 30 && !D.knownShut(d, samSide); i++) R.step(); R.step(60); });
  if (mode === 'ring') g.player.keys.add(d.lockId);
  o.before?.(R, d);
  const knew0 = D.knownShut(d, samSide), n0 = said.length, log0 = D.log.length, halted0 = D.stats.halted, tested0 = D.stats.tested, menAt0 = men();
  const row0 = row(), why = await quiet(() => O.give('move', O.targetAt(spot), who));
  // played until nobody has been on a 'move' short of his mark for half a second (30 s at most; `mids` done on their second): how long, the fastest any man went, how far each walked
  let secs = 0, top = 0, lied = 0; const walked = team.map(() => 0), last = team.map((m: any) => [...m.char.pos]);
  const going = () => mids.length > 0 || team.some((m: any) => { const A = O.of(m); return m.state !== 'dead' && A?.order === 'move' && !A.arrived; });
  await quiet(() => { for (let i = 0, still = 0; i < 60 * 30 && still < 30; i++) { while (mids.length && secs >= mids[0][0]) mids.shift()![1](R, d, sent); R.step(); secs += DT; still = going() ? 0 : still + 1;
    for (const m of team) if (O.of(m)?.tries && O.statusOf(m) !== 'moving') lied++;
    team.forEach((m: any, k: number) => { const s = dist(m.char.pos, last[k]); walked[k] += s; if (sent.includes(m)) top = Math.max(top, s / DT); last[k] = [...m.char.pos]; }); } });
  const halt = men(); await quiet(() => R.step(180)); const later = men(), heard = said.slice(n0);
  const knew1 = D.knownShut(d, samSide), row1 = row(), why2 = await quiet(() => O.give('move', O.targetAt(spot), who)); await quiet(() => R.step(120));
  return { row0, why: why ?? null, said: heard, menAt0, halt, later, row1, why2: why2 ?? null, end: men(), secs, top, walked, log: D.log.slice(log0).map((l: any) => String(l.what)), halted: D.stats.halted - halted0, tested: D.stats.tested - tested0,
    knew0, knew1, lied, shutStill: !!d.locked && !!d.latched, frame: [d.frameCentre[0], 0, d.frameCentre[2]], samSide, name: doorWords(d), who: sent.map((m: any) => m.callsign) };
}

/** TWO LOCKS ON THE WAY: the pair walked into the storage room (its door unlocked for that), the door then shut and locked by hand against the room's
 *  face with a lock of its own; 'move there' to the manager's room; a quarter of a second into the walk (the jamb is a stride off) that lock's key is put on Sam's ring. The storage door then
 *  reads free at the handle — and the manager's door, still locked and never tried, is the next one on the way. */
async function second(key: boolean) {
  const R = await rig(key, 2), { g, O, D, said } = R, st = R.door('storage'), mg = R.door('manager'), team: any[] = O.men('all'), corridor = sideOf(mg, g.player.char.pos);
  st.locked = false;
  await quiet(() => { O.give('move', O.targetAt(STORE), 'all'); for (let i = 0; i < 60 * 30 && !team.every((m: any) => O.of(m)?.arrived); i++) R.step(); R.step(60);
    st.angle = 0; st.vel = 0; st.closing = false; st.latched = true; st.locked = true; st.keySide = g.doors.side(st, team[0].char.pos); st.lockId = 'probe'; R.step(30); });
  const inStore = team.every((m: any) => sideOf(st, m.char.pos) === sideOf(st, STORE)), n0 = said.length, log0 = D.log.length, tested0 = D.stats.tested;
  const why = await quiet(() => O.give('move', O.targetAt(INSIDE), 'all')); let keyed = false, inMgr = 0;
  const going = () => !keyed || team.some((m: any) => { const A = O.of(m); return A?.order === 'move' && !A.arrived; });
  await quiet(() => { for (let i = 0, still = 0; i < 60 * 40 && still < 30; i++) { if (!keyed && i >= 15) { g.player.keys.add('probe'); keyed = true; } R.step(); still = going() ? 0 : still + 1;
    for (const m of team) if (m.char.pos[2] < mg.frameCentre[2] - 0.3 && Math.abs(m.char.pos[0] - mg.frameCentre[0]) < 3.2) inMgr++; } R.step(180); });
  const men = team.map((m: any) => { const A = O.of(m); return { c: m.callsign, order: String(A?.order ?? '-'), door: String(A?.door?.def.name ?? '-'), there: String(A?.there ?? '-'), on: !!A?.post && dist(m.char.pos, A.post) < 0.6, side: sideOf(mg, m.char.pos), pos: [...m.char.pos] }; });
  return { inStore, why: why ?? null, said: said.slice(n0), log: D.log.slice(log0).map((l: any) => String(l.what)), tested: D.stats.tested - tested0, men, corridor, inMgr, mgShut: !!mg.locked && !!mg.latched, name: doorWords(mg) };
}

/** the Mousehole with the four and nobody to fight, its store door wedged against the corridor's face; 'move there' to all four for a spot inside the store */
async function wedge(key: boolean) {
  const BT: any = await import('./bang-tally.ts'), { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const S: any = await quiet(() => BT.stage('mousehole-four', 1)); const g = S.g, O = g.orders, D = g.doorTools;
  for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile') await quiet(() => killGuard(g, x, [0, 0, 1], true));
  DOORTOOLS.testDoor = true; ORDERS.walkTries = key;
  const d = g.doors.list.find((x: any) => x.def.name === 'store'), c = d.frameCentre, th = d.def.closedDir, spot = [c[0] - Math.sin(th) * -1.5, 0, c[2] + Math.cos(th) * -1.5];   // (a stride and a half in on the leaf's −1 face: the store)
  d.locked = true; d.keySide = 1; d.lockId = `wedge:${d.def.name}`;
  const said: string[] = [], say = g.say.bind(g); g.say = (gd: any, text: string, ...rest: any[]) => { said.push(`${gd.callsign}: ${text}`); return say(gd, text, ...rest); };
  const team: any[] = O.men('all'), def = O.defs.find((x: any) => x.id === 'move'), pos = () => team.map((m: any) => [m.char.pos[0], 0, m.char.pos[2]]);
  const row0 = O.whyNot(def, O.targetAt(spot), team), at0 = pos(), why = await quiet(() => O.give('move', O.targetAt(spot), 'all'));
  // (played until the line is said — 30 s at most — and three seconds more: the file's last man is still coming onto his mark as the first tries the handle)
  await quiet(() => { for (let i = 0; i < 60 * 30 && !said.some(x => SHUT_LINE.test(x)); i++) S.step(1); S.step(180); });
  const men = team.map((m: any) => { const A = O.of(m); return { c: m.callsign, order: String(A?.order ?? '-'), door: String(A?.door?.def.name ?? '-'), there: String(A?.there ?? '-'), on: !!A?.post && dist(m.char.pos, A.post) < 0.6, side: sideOf(d, m.char.pos) }; }), at1 = pos();
  await quiet(() => S.step(120)); const at2 = pos(), row1 = O.whyNot(def, O.targetAt(spot), team);
  return { row0, why: why ?? null, said, men, row1, name: doorWords(d), moved: Math.max(...at0.map((p, i) => dist(p, at1[i]))), after: Math.max(...at1.map((p, i) => dist(p, at2[i]))), knows: D.knownShut(d, 1) };
}

const gap = (a: Man[], b: Man[]) => a.length === b.length && a.length > 0 ? Math.max(...a.map((m, i) => dist(m.pos, b[i].pos))) : Infinity;
const same = (a: Man[], b: Man[]) => gap(a, b) < 1e-6 && a.every((m, i) => m.order === b[i].order && m.door === b[i].door && m.there === b[i].there);
const line = (l: Man[]) => l.map(m => `${m.c} ${at(m.pos)} [${m.order} · ${m.there}]`).join(', ');
const rowWords = (r: Row | null) => r ? `${r.off ? 'GREYED' : 'live'} "${r.text}"` : 'NO ROW';

export async function moveWalkTries(): Promise<boolean> {
  const rnd = Math.random;   // (every staging seeds it; put back with the knob tables)
  try {
    console.log('\n=== move-walktries: a \'move there\' whose way runs at a door nobody has tried walks up and tries it (ORDERS.walkTries; DOORTOOLS.testDoor set here) ==='); let all = true;
    const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
    const BREAK = process.env.WALKTRIES_BREAK === '1'; if (BREAK) console.log('  (WALKTRIES_BREAK: ORDERS.walkTries is left off in this probe\'s key-on runs — the KEY ON lines must fail)');
    const off = await play('locked', false), on = await play('locked', !BREAK), ref = await play('open', false);
    const refusal = `${off.name} is locked.`;
    // ---- the fault, asserted so the check has teeth
    verdict(!off.knew0 && off.why === refusal && !!off.row0?.off && off.row0.text.includes(refusal) && off.said.length === 1 && off.said[0].endsWith(refusal) && gap(off.menAt0, off.later) < 0.05 && off.tested === 0,
      'CONTROL (WALKTRIES_BREAK does not touch it) — KEY OFF, the fault as it is: nobody has tried the door, and \'move there\' to a spot behind it is refused with the door\'s name, the menu\'s row greyed with the same words; nobody moves, no handle is tried',
      `team knew the door: ${off.knew0} · give('move') → ${JSON.stringify(off.why)} · menu row: ${rowWords(off.row0)} · said: ${off.said.join(' / ') || 'nothing'} · handles tried ${off.tested} · moved ${f2(gap(off.menAt0, off.later))} m`);
    // ---- the mend
    const K = `KEY ON${BREAK ? ' (WALKTRIES_BREAK: left off)' : ''}`;
    verdict(!on.knew0 && on.why === null && !!on.row0 && !on.row0.off && !/locked|wedged/.test(on.row0.text) && !on.said.some(s => /locked|wedged/.test(s) && !SHUT_LINE.test(s)),
      `${K} — nobody has tried the door: 'move there' is taken, the menu's row is live and names no lock, and no line names one before a hand is on the door`,
      `give('move') → ${JSON.stringify(on.why)} · menu row: ${rowWords(on.row0)} · said: ${on.said.join(' / ') || 'nothing'}`);
    const shutSaid = on.said.filter(s => SHUT_LINE.test(s)), tries = on.log.filter(l => / tried manager: /.test(l));
    verdict(on.walked.every(w => w > 1) && on.top > 0.5 && on.top <= ref.top + 0.05 && on.tested === 1 && tries.length === 1 && on.lied === 0,
      `${K} — the men walk to it, none faster than a plain 'move' walks a man (through the open conference door, key off), reading 'moving' until the handle is tried, and one man tries the leaf`,
      `read anything but 'moving' before the try: ${on.lied} frames · walked ${on.walked.map(f2).join(' / ')} m in ${f2(on.secs)} s · fastest ${f2(on.top)} m/s (a plain move: ${f2(ref.top)} m/s) · handles tried ${on.tested} · log: ${tries.join(' | ') || 'nothing'}`);
    verdict(shutSaid.length === 1 && /: locked\. holding on it — your call\.$/.test(shutSaid[0]) && on.halted === 1 && on.log.includes('move manager: tried the door · locked · halted') && on.log.includes('move manager: end: found shut'),
      `${K} — the order ends with the door orders' own words, said once by one man, and their log lines: tried, halted, 'found shut'`,
      `said: ${on.said.join(' / ') || 'nothing'} · halted ${on.halted} · log: ${on.log.join(' | ') || 'nothing'}`);
    { const stacked = (m: Man) => m.order === 'stack' && m.door === 'manager' && m.there === `stacked · ${on.name} · locked` && !!m.post && dist(m.pos, m.post) < 0.6 && dist(m.post, on.frame) < 2.6 && m.side === on.samSide;
      const told = (m: Man) => m.order === 'stack' && m.door === 'manager' && m.there === `stacked · ${on.name} · locked` && m.side === on.samSide;
      verdict(on.halt.length === 2 && on.halt.every(told) && on.later.every(stacked) && gap(on.later, on.end) < 0.05 && on.shutStill,
        `${K} — every man of the order is left stacked on that door ('stacked · <door> · locked', the halted door order's own carriage) as the line is said; three seconds on each stands on his mark, within 2.6 m of the frame on the corridor's side, nobody in the room, the leaf still shut and locked; and nobody moves in the two seconds after that`,
        `${on.later.map(m => `${m.c} ${at(m.pos)} mark ${m.post ? `${at(m.post)} ${f2(dist(m.post, on.frame))} m off the frame` : 'NONE'} side ${m.side} (Sam's ${on.samSide}) [${m.order} · ${m.there}]`).join(', ')} · as the line is said: ${line(on.halt)} · moved in the last 2 s: ${f2(gap(on.later, on.end))} m · door locked and shut: ${on.shutStill}`); }
    verdict(on.knew1 && on.why2 === refusal && !!on.row1?.off && on.row1.text.includes(refusal) && same(on.later, on.end) && off.why2 === refusal && on.row1.text === off.row0?.text,
      `${K} — the team knows now: the same order is refused and its row greyed, word for word as with the key off, and the men stay stacked`,
      `team knows the door: ${on.knew1} · give('move') again → ${JSON.stringify(on.why2)} · menu row: ${rowWords(on.row1)} · key off's: ${rowWords(off.row0)} · after it: ${line(on.end)}`);
    // ---- the squad of four, one pair sent
    { const a = await play('locked', !BREAK, { squad: 4, who: 'red' }), b = await play('locked', false, { squad: 4, who: 'red' }), red = (l: Man[]) => l.filter(m => a.who.includes(m.c)), rest = (l: Man[]) => l.filter(m => !a.who.includes(m.c));
      const stacked = (m: Man) => m.order === 'stack' && m.door === 'manager' && m.there.startsWith('stacked · ') && m.there.endsWith(' · locked') && !!m.post && dist(m.pos, m.post) < 0.6 && m.side === a.samSide;
      verdict(a.who.length === 2 && a.why === null && !!a.row0 && !a.row0.off && a.said.filter(s => SHUT_LINE.test(s)).length === 1 && red(a.later).every(stacked) && gap(red(a.later), red(a.end)) < 0.05 && gap(rest(a.menAt0), rest(a.end)) < 0.05 && a.why2 === refusal && !!a.row1?.off
        && b.why === refusal && !!b.row0?.off && gap(b.menAt0, b.later) < 0.05,
        `${K} — the squad of four, 'move there' to red alone: red walks up, tries it, says it once and is left stacked on the door, on its marks three seconds on and still after; blue has not moved; the order again is refused and greyed. Key off: refused and greyed at once`,
        `key on: give → ${JSON.stringify(a.why)}, row ${rowWords(a.row0)}, said: ${a.said.join(' / ') || 'nothing'} · ${line(red(a.later))} · red moved ${f2(gap(red(a.later), red(a.end)))} m after · blue moved ${f2(gap(rest(a.menAt0), rest(a.end)))} m · again → ${JSON.stringify(a.why2)} · key off: give → ${JSON.stringify(b.why)}, row ${rowWords(b.row0)}`); }
    // ---- a wedge, the four, another level
    { const a = await wedge(!BREAK), b = await wedge(false), no = `${a.name} is locked.`, lines = a.said.filter(x => SHUT_LINE.test(x));
      verdict(a.row0 === null && a.why === null && lines.length === 1 && /: wedged from inside\. holding on it — your call\.$/.test(lines[0]) && a.men.length === 4 && a.men.every(m => m.order === 'stack' && m.door === 'store' && m.there === `stacked · ${a.name} · wedged from inside` && m.on && m.side === 1) && a.after < 0.05 && a.knows && a.row1 === no
        && b.row0 === no && b.why === no && b.moved < 0.05 && !b.knows,
        `${K} — the Mousehole, the four, the store door wedged from inside and never tried: the move is taken, one man says the wedge's own halt line, all four are left stacked on the door, three seconds on each on his mark on the corridor's side and nobody moving in the two seconds after, and the order again is refused. Key off: refused at once, nobody moves`,
        `key on: row ${JSON.stringify(a.row0)}, give → ${JSON.stringify(a.why)}, said: ${a.said.join(' / ') || 'nothing'} · ${a.men.map(m => `${m.c} [${m.order} · ${m.there}]${m.on ? '' : ' OFF HIS MARK'}${m.side === 1 ? '' : ' INSIDE'}`).join(', ')} · moved after ${f2(a.after)} m · again → ${JSON.stringify(a.row1)} · key off: row ${JSON.stringify(b.row0)}, give → ${JSON.stringify(b.why)}, moved ${f2(b.moved)} m`); }
    // ---- the door turns out free, or is opened, while they walk: the move goes on and ends as a move
    { const a = await play('locked', !BREAK, { mids: [[2, (_R, d) => { d.locked = false; }]] }), inside = (m: Man) => m.order === 'move' && m.arrived && !m.tries && m.side === -a.samSide;
      verdict(a.why === null && a.said.filter(x => NOT_LOCKED.test(x)).length === 1 && !a.said.some(x => SHUT_LINE.test(x)) && a.said.filter(x => /: set\.$/.test(x)).length === 1 && a.tested === 1 && a.halted === 0 && a.later.every(inside),
        `${K} — the door unlocked two seconds into the walk: the man on the jamb tries it once and says the stack's own "it's not locked." once, nobody halts, and both go on to their places in the room on the 'move' they were given ('set.' once)`,
        `give → ${JSON.stringify(a.why)} · said: ${a.said.join(' / ') || 'nothing'} · handles tried ${a.tested} · ${line(a.later)} · inside: ${a.later.map(m => m.side === -a.samSide).join(' / ')}`); }
    { const a = await play('locked', !BREAK, { mids: [[2, (R, d) => { R.g.doors.use(d, INSIDE, R.g.player.char.id); }]] }), inside = (m: Man) => m.order === 'move' && m.arrived && !m.tries && m.side === -a.samSide;
      verdict(a.why === null && !a.said.some(x => SHUT_LINE.test(x) || /locked|wedged/.test(x)) && a.said.filter(x => /: set\.$/.test(x)).length === 1 && a.tested === 0 && a.halted === 0 && a.later.every(inside),
        `${K} — the door opened from inside two seconds into the walk: nobody tries a leaf that stands open, nothing is said of a lock, and both go on to their places in the room ('set.' once)`,
        `give → ${JSON.stringify(a.why)} · said: ${a.said.join(' / ') || 'nothing'} · handles tried ${a.tested} · ${line(a.later)}`); }
    // ---- two locks on the way: the first turns, the second gets its own try
    { const a = await second(!BREAK), shut = a.said.filter(x => SHUT_LINE.test(x)), stacked = a.men.every(m => m.order === 'stack' && m.door === 'manager' && m.there === `stacked · ${a.name} · locked` && m.on && m.side === a.corridor);
      verdict(a.inStore && a.why === null && a.said.filter(x => NOT_LOCKED.test(x)).length === 1 && shut.length === 1 && a.tested === 2 && a.log.filter((l: string) => l === 'move manager: end: found shut').length === 1 && !a.log.some((l: string) => /^move storage: /.test(l)) && stacked && a.inMgr === 0 && a.mgShut,
        `${K} — two locks on the way (the pair in the storage room, its door locked against them; the key to it on Sam's ring a quarter of a second into the walk; the manager's door beyond, locked, never tried): the first handle turns ("it's not locked." once), the walk is asked again and the manager's door gets its own try — 'found shut' once, both stacked on it in the corridor, the leaf still locked, nobody in the manager's room at any frame`,
        `started in the store: ${a.inStore} · give → ${JSON.stringify(a.why)} · said: ${a.said.join(' / ') || 'nothing'} · handles tried ${a.tested} · log: ${a.log.join(' | ') || 'nothing'} · ${a.men.map(m => `${m.c} ${at(m.pos)} [${m.order} · ${m.there}]${m.on ? '' : ' OFF HIS MARK'}`).join(', ')} · frames a man stood in the manager's room: ${a.inMgr} · its door locked and shut: ${a.mgShut}`); }
    // ---- another order while they walk: the walk is over, nothing of it is left on anybody
    { const a = await play('locked', !BREAK, { mids: [[2, (R) => { R.O.give('hold', R.O.targetAt(R.g.player.char.pos), 'all'); }]] });
      verdict(a.why === null && a.later.every(m => m.order === 'hold' && !m.tries) && a.tested === 0 && a.halted === 0 && !a.knew1 && !a.said.some(x => SHUT_LINE.test(x) || NOT_LOCKED.test(x)) && a.row1 !== null && !a.row1.off,
        `${K} — 'hold position' given two seconds into the walk: both hold, nobody carries the walk's try, no handle is tried and no door line is said in the seconds after, the team still does not know the door (the row is live again)`,
        `give → ${JSON.stringify(a.why)} · said: ${a.said.join(' / ') || 'nothing'} · handles tried ${a.tested} · ${line(a.later)} · still carrying the try: ${a.later.filter(m => m.tries).length} · team knows the door: ${a.knew1} · row after: ${rowWords(a.row1)}`); }
    // ---- the man dealt the jamb goes down on the way: his mate tries it
    { const { killGuard } = await import(`${ROOT}/src/game/combat.ts`); let down = '';
      const a = await play('locked', !BREAK, { mids: [[2, (R, _d, sent) => { const m = sent.find((x: any) => R.O.of(x)?.tries?.post.lead); if (m) { down = m.callsign; killGuard(R.g, m, [0, 0, 1], true); } }]] });
      const shut = a.said.filter(x => SHUT_LINE.test(x)), mate = a.later.filter(m => !m.dead);
      verdict(a.why === null && down !== '' && shut.length === 1 && !shut[0].startsWith(`${down}:`) && a.tested === 1 && mate.length === 1 && mate[0].order === 'stack' && mate[0].door === 'manager' && mate[0].there.endsWith(' · locked') && mate[0].side === a.samSide && gap(mate, a.end.filter(m => !m.dead)) < 0.05,
        `${K} — the man dealt the jamb is down two seconds into the walk: his mate comes onto his own mark, tries the door, says the line once and is left stacked on it, still`,
        `down: ${down || 'NOBODY'} · said: ${a.said.join(' / ') || 'nothing'} · handles tried ${a.tested} · ${line(mate)}`); }
    // ---- a walker taken off his walk and given it back after his mate has tried the door (what a throw on order does — squadthrow.ts hands him his order back, `tries` with it): he joins the stack, nothing is said or counted twice
    { let off = '', kept: any = null, who: any = null, knewThen = false;
      const a = await play('locked', !BREAK, { mids: [
        [1, (R, _d, sent) => { const ws = sent.filter((x: any) => R.O.of(x)?.tries), first = ws.find((x: any) => R.O.of(x).tries.post.lead) ?? ws[0]; who = ws.find((x: any) => x !== first) ?? null; if (!who) return;   // (not the man who will try it)
          const A = R.O.of(who), p = who.char.pos; off = who.callsign;
          kept = { order: A.order, post: A.post, face: A.face, watch: A.watch, door: A.door, shy: A.shy, stance: A.stance, upper: A.upper, move: A.move, stackSide: A.stackSide, going: A.going, there: A.there, tries: A.tries };
          R.O.assign(who, { order: 'hold', post: [p[0], 0, p[2]], face: who.char.bodyYaw, going: 'holding', there: 'holding' }); }],
        [14, (R, d) => { knewThen = R.D.knownShut(d, sideOf(d, R.g.player.char.pos)); if (who && kept) R.O.assign(who, kept); }]] });
      const shut = a.said.filter(x => SHUT_LINE.test(x));
      verdict(a.why === null && off !== '' && knewThen && shut.length === 1 && a.halted === 1 && a.tested === 1 && a.later.every(m => m.order === 'stack' && m.door === 'manager' && m.there.endsWith(' · locked') && !m.tries && m.side === a.samSide),
        `${K} — a walker taken off his walk a second in and given it back after his mate has tried the door (what a throw on order does): he is sent to his mark in the stack, and the line, the count and the try are not made twice`,
        `taken off: ${off || 'NOBODY'} · the team knew the door when he got it back: ${knewThen} · said: ${a.said.join(' / ') || 'nothing'} · halts counted ${a.halted} · handles tried ${a.tested} · ${line(a.later)}`); }
    // ---- the four: another order to the other pair while one pair walks at the door — each pair's 'set.' is its own
    { const a = await play('locked', !BREAK, { squad: 4, who: 'red', mids: [[1, (R) => { R.O.give('move', R.O.targetAt(CONF), 'blue'); }], [2, (_R, d) => { d.locked = false; }]] }), sets = a.said.filter(x => /: set\.$/.test(x));
      verdict(a.why === null && sets.length === 2 && sets.filter(x => x.startsWith('Blue')).length === 1 && sets.filter(x => x.startsWith('Red')).length === 1 && a.said.filter(x => NOT_LOCKED.test(x)).length === 1 && a.later.every(m => m.order === 'move' && m.arrived && !m.tries),
        `${K} — the four: red walking at the door, blue sent elsewhere a second later, the door unlocked a second after that: red goes on in, and each pair calls its own 'set.' once (red's handed-back move is a group of its own)`,
        `said: ${a.said.join(' / ') || 'nothing'} · ${line(a.later)}`); }
    // ---- no room to stack on the untried door: the stack's own refusal (never met at a real door here: the makers' answer for that door is forced to none)
    { const a = await play('locked', !BREAK, { before: (R, d) => { const real = R.O.stackPostsWait.bind(R.O); R.O.stackPostsWait = (dd: any, s: any, m: any) => dd === d ? null : real(dd, s, m); } });
      verdict(a.why === NO_ROOM && !!a.row0?.off && a.row0.text.endsWith(`— ${NO_ROOM}`) && a.said.length === 1 && a.said[0].endsWith(`: ${NO_ROOM}`) && gap(a.menAt0, a.later) < 0.05 && a.tested === 0 && !a.knew1,
        `${K} — FORCED (the stack's places for that door made to answer 'none'): the move is refused in the stack's words, 'no room on that door.', the row greyed with them; no lock is named, nobody moves, no handle is tried`,
        `give → ${JSON.stringify(a.why)} · menu row: ${rowWords(a.row0)} · said: ${a.said.join(' / ') || 'nothing'} · moved ${f2(gap(a.menAt0, a.later))} m`); }
    // ---- testDoor off: the key does nothing
    { const a = await play('locked', true, { testDoor: false });
      verdict(a.why === off.why && a.why === refusal && !!a.row0?.off && a.row0.text === off.row0?.text && a.said.join('|') === off.said.join('|') && gap(a.menAt0, a.later) < 0.05 && a.tested === 0 && same(a.later, off.later),
        'CONTROL (WALKTRIES_BREAK does not touch it) — DOORTOOLS.testDoor off with the key on: refused and greyed in the very words of the key-off run, the same line said, nobody moves',
        `give → ${JSON.stringify(a.why)} · menu row: ${rowWords(a.row0)} · said: ${a.said.join(' / ')} · key off's: ${JSON.stringify(off.why)}, ${rowWords(off.row0)}, ${off.said.join(' / ')}`); }
    // ---- controls: the same key on and key off (each on a fresh staging)
    { const a = await play('open', true);
      verdict(a.why === null && ref.why === null && !a.row0?.off && !ref.row0?.off && same(a.later, ref.later) && same(a.end, ref.end) && a.tested === ref.tested && a.said.join('|') === ref.said.join('|') && a.later.every(m => m.order === 'move') && Math.max(...a.walked) > 1,
        'CONTROL (WALKTRIES_BREAK does not touch it) — a spot behind a door standing open (the conference room): taken, and every man\'s order, words and place are the same key on and key off',
        `key on: ${line(a.later)} · key off: ${line(ref.later)} · differ ${f2(gap(a.later, ref.later))} m · said ${a.said.join(' / ') || 'nothing'} // ${ref.said.join(' / ') || 'nothing'}`); }
    { const a = await play('known', true), b = await play('known', false);
      verdict(a.knew0 && b.knew0 && a.why === refusal && b.why === refusal && !!a.row0?.off && a.row0.text === b.row0?.text && same(a.later, b.later) && same(a.end, b.end) && a.said.join('|') === b.said.join('|') && a.halted === 0 && a.tested === 0,
        'CONTROL (WALKTRIES_BREAK does not touch it) — a door the team already knows shut (a plain \'stack up\' tried it): the move is refused and greyed the same key on and key off, and every man stays as he was',
        `key on: knew ${a.knew0}, give → ${JSON.stringify(a.why)}, row ${rowWords(a.row0)}, ${line(a.later)} · key off: give → ${JSON.stringify(b.why)}, row ${rowWords(b.row0)} · differ ${f2(gap(a.later, b.later))} m`); }
    { const a = await play('ring', true), b = await play('ring', false);
      verdict(a.why === null && b.why === null && !a.row0?.off && !b.row0?.off && same(a.later, b.later) && same(a.end, b.end) && a.said.join('|') === b.said.join('|') && a.halted === 0 && a.later.every(m => m.order === 'move'),
        'CONTROL (WALKTRIES_BREAK does not touch it) — a door Sam\'s ring opens: the move is taken and walked the same key on and key off (nobody halts on it)',
        `key on: give → ${JSON.stringify(a.why)}, ${line(a.later)} · key off: give → ${JSON.stringify(b.why)}, ${line(b.later)} · differ ${f2(gap(a.later, b.later))} m`); }
    // ---- twice the same
    { const again = await play('locked', !BREAK);
      verdict(gap(on.halt, again.halt) < 1e-6 && gap(on.end, again.end) < 1e-6 && on.said.join('|') === again.said.join('|'), `${K} — played twice: every man ends on the same spot, the same lines said`, `differ ${gap(on.end, again.end).toFixed(6)} m at the end, ${gap(on.halt, again.halt).toFixed(6)} m at the halt · ${line(again.end)}`); }
    // ---- the journal: a recording from before the key replays with it off (journal.ts applyKnobs); one that carries it keeps its own word
    { const R = await rig(false, 2), g = R.g, J: any = await import(`${ROOT}/src/game/journal.ts`), KN: any = await import(`${ROOT}/src/game/knobs.ts`), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g))), kept = KN.knobsCopy();
      try {
        ORDERS.walkTries = true; const old = snap(); delete old.tables.ORDERS?.walkTries; delete old.flags?.walkTries; J.applyKnobs(g, old); const x = ORDERS.walkTries;
        ORDERS.walkTries = true; const yes = snap(); ORDERS.walkTries = false; J.applyKnobs(g, yes); const y = ORDERS.walkTries;
        ORDERS.walkTries = false; const no = snap(); ORDERS.walkTries = true; J.applyKnobs(g, no); const z = ORDERS.walkTries;
        verdict(x === false && y === true && z === false, 'CONTROL (plumbing: WALKTRIES_BREAK does not touch it) — the journal: a recording from before ORDERS.walkTries replays with it off, one made with it on replays on, one made with it off replays off', `old → ${x} · recorded on → ${y} · recorded off → ${z}`);
      } finally { KN.knobsBack(kept); } }
    console.log(`=== move-walktries: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
    return all;
  } finally { Math.random = rnd; back(); }
}
