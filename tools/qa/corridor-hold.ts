// A HELD CORRIDOR — what the defenders do about a lane that has cost them (the maintainer, 10-11: "enemies do seem to run into held corridors a bit too
// eagerly, especially when they've already taken fire. was pretty easy to just hold a hallway and pick them off").
//   TPS_PROFILE=shipped bun run tools/qa/corridor-hold.ts [--scn block-four,block-squads] [--seeds 1-6] [--secs 150] [--level hard|standard]
//                                                         [--set '{"LANES":{"on":false}}'] [--trace] [--json f] [--noise 12]
//                                                         [--sam x,z --shoot [--leave S:x,z]]
// One run: the mission staged as the page stages it, the team told to HOLD where it starts (every start of a squad level looks down an approach; `block-four`, rebuilt 10-13 as one stay-put squad a room, draws nobody to it), Sam
// standing with them (he cannot be hurt and fires nothing), one loud report so the floor knows, and another every --noise seconds as a held lane's own
// gunfire would give. Nobody of the team moves. The tool watches, ten times a second, which defenders are IN THE HOLDERS' LINE OF FIRE (a clear line of fire
// from a living teammate's eye to his chest), and files:
//   kills      every defender down: when, where, what he was doing (on his post / sent / hunting), in the holders' line or not
//   walk-ins   a defender who came INTO the holders' line on his feet, off his post — and, of those, the ones that came AFTER THE LANE HAD COST THEM: inside
//              `--mem` seconds (40) of a mate dropped in the holders' line, within `--near` metres (14) of where that mate fell
//   fed        the walk-ins after a loss that died there inside 12 s: the thing the maintainer saw
// and what the team paid (teammates down). The numbers are the tool's, read off positions and lines — no rule of the game is asked what it meant.
// --sam x,z --shoot = the PLAYER's own hold (his replay of the records office, 10-11: "it's just way too easy to hold an angle while they come out the door …
// tango 4 should have seen his buddies go down and not go through the same door"): Sam stands at that spot and puts a rifle round into every defender he has a
// line of fire to — a third of a second after the man shows, a round each third of a second after — through the game's own fireWeapon. He cannot be hurt.
// --leave S:x,z = S seconds in he walks off the hold: put at x,z (somewhere the lane's mouth has no line to), still shooting what shows itself there — what the
// defenders make of a lane nobody is on any more (a look round the corner: lanes.ts LANES.peek).
// Exit 0 always (a measuring tool; tools/qa/corridor-check.ts is the verdict), 2 on bad flags.
import { writeFileSync } from 'node:fs';
import { lanesStats, laneHolds } from '../../src/game/lanes';
import { FRAG_LOG, FRAG_STATS, fragStatsReset } from '../../src/game/frag';
import { doorwayInWay } from '../../src/game/doorway';
if (import.meta.main) process.env.TPS_PROFILE ??= 'shipped';   // (run by name: the stand the page ships. Imported — corridor-check, probes.ts — it plays on the importer's stand: headless.ts reads the word as it loads)
const { standUp, ROOT } = await import('./headless.ts');
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { setDifficulty } = await import(`${ROOT}/src/game/difficulty.ts`);
const { knobRegistry } = await import(`${ROOT}/src/game/knobs.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { readFileSync } = await import('node:fs');
const { resolve } = await import('node:path');
const { killGuard, fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);

const argv = import.meta.main ? process.argv.slice(2) : [], flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const FLAGS = ['--scn', '--seeds', '--secs', '--level', '--set', '--trace', '--json', '--noise', '--mem', '--near', '--quiet', '--nohit', '--sam', '--shoot', '--leave'];
for (const a of argv) if (a.startsWith('--') && !FLAGS.includes(a)) { console.error(`unknown flag ${a} (${FLAGS.join(' ')})`); process.exit(2); }
const scns = (flag('--scn') ?? 'block-four,block-squads').split(','), SECS = Number(flag('--secs') ?? 150), LEVEL = (flag('--level') ?? 'hard') as 'hard' | 'standard';
const seeds: number[] = []; for (const part of (flag('--seeds') ?? '1-4').split(',')) { const m = /^(\d+)(?:-(\d+))?$/.exec(part); if (!m) { console.error(`bad --seeds ${part}`); process.exit(2); } for (let s = +m[1]; s <= +(m[2] ?? m[1]); s++) seeds.push(s); }
const SET = flag('--set') ? JSON.parse(flag('--set')!) as Record<string, Record<string, unknown>> : {}, TRACE = argv.includes('--trace'), NOHIT = argv.includes('--nohit'), QUIET = argv.includes('--quiet');
const SAM = flag('--sam') ? flag('--sam')!.split(',').map(Number) as [number, number] : null, SHOOT = argv.includes('--shoot');
const LEAVE = flag('--leave') ? (() => { const [t, xz] = flag('--leave')!.split(':'), [x, z] = (xz ?? '').split(',').map(Number); return { t: Number(t), at: [x, z] as [number, number] }; })() : null;
if (LEAVE && !(Number.isFinite(LEAVE.t) && LEAVE.at.every(Number.isFinite))) { console.error('bad --leave S:x,z'); process.exit(2); }
if (SAM && !(SAM.length === 2 && SAM.every(Number.isFinite))) { console.error('bad --sam x,z'); process.exit(2); }
const NOISE = Number(flag('--noise') ?? 12), MEM = Number(flag('--mem') ?? 40), NEAR = Number(flag('--near') ?? 14), FED_SECS = 12;
if (![SECS, NOISE, MEM, NEAR].every(Number.isFinite) || (LEVEL !== 'hard' && LEVEL !== 'standard')) { console.error('bad number / --level'); process.exit(2); }

function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;

export interface Kill { t: number; who: string; at: [number, number]; doing: string; inLine: boolean; by: string; off: number }
export interface WalkIn { t: number; who: string; at: [number, number]; doing: string; afterLoss: boolean; died: number | null; secs: number }
export interface HoldRun { scn: string; seed: number; secs: number; hostiles: number; kills: Kill[]; walkIns: WalkIn[]; fed: number; afterLoss: number; teamDown: number; team: number; samHits: number; /** the defenders' own grenades: left a hand · stayed in one · each burst of theirs — where, how far from the nearest of the team as it stood at the start, who it hit (name:result), whose it was */ frags?: { thrown: number; held: number; bursts: { at: [number, number]; teamM: number; hit: string[]; /** the thrower · his was a grenade the lane rule asked for (LANES.frag) */ by: string; lane: boolean }[] }; /** seconds the rule had a man stopped and standing still · of them in a doorway · of them with a rifle's line from a holder to his chest (through glass too) */ stops: { held: number; door: number; shot: number }; lanes?: unknown; notes: string[]; error?: string }

/** put a --set row on its knob table (deep, existing keys only: a mistyped key stops the tool) */
function put(name: string, o: Record<string, unknown>, undo: (() => void)[]) {
  const T = (knobRegistry() as Record<string, any>)[name]; if (!T) throw new Error(`--set: no knob table '${name}'`);
  for (const [k, v] of Object.entries(o)) { if (!(k in T)) throw new Error(`--set: ${name} has no key '${k}'`); const was = T[k]; undo.push(() => { T[k] = was; }); T[k] = v; }
}

/** the player's own hold: where Sam stands · he shoots what he has a line to */
export interface SamHold { at: [number, number] | null; shoot: boolean; leave?: { t: number; at: [number, number] } | null; /** rows put `t` seconds into the hold (and put back as it ends): the same fight up to there, a rule changed from there */ flip?: { t: number; set: Record<string, Record<string, unknown>> } | null }
export async function holdRun(scn: string, seed: number, secs = SECS, set = SET, trace = TRACE, hold: SamHold = { at: SAM, shoot: SHOOT, leave: LEAVE }): Promise<HoldRun> {
  const E = (SCENARIOS as any[]).find(e => e.id === scn); if (!E) throw new Error(`no squad mission '${scn}' (${(SCENARIOS as any[]).map(e => e.id).join(' ')})`);
  const out: HoldRun = { scn, seed, secs, hostiles: 0, kills: [], walkIns: [], fed: 0, afterLoss: 0, teamDown: 0, team: 0, samHits: 0, stops: { held: 0, door: 0, shot: 0 }, notes: [] };
  const undo: (() => void)[] = [], log = console.log, err = console.error, warn = console.warn, rnd = Math.random;
  const say = (x: string) => { if (trace) log(x); };
  try {
    setDifficulty(LEVEL, false);
    for (const [n, o] of Object.entries(set)) put(n, o, undo);
    Math.random = seeded(0x51ab + seed * 7919);
    let W: any; console.log = console.error = console.warn = () => { };
    try {
      const level = E.level ? loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', E.level), 'utf8'))) : undefined;
      W = await standUp({ uploadEvery: 4, ...(level ? { level } : {}) });
      for (const [n, o] of Object.entries(set)) put(n, o, undo);   // (standUp writes its own stand over the tables: a --set row is put again)
      W.game.godMode = true; W.game.tune.chaos = 0.5;
      const q = (scenarioQuery(E) as string).replace(/(^|[?&])roomclear(=\d+)?(?=&|$)/, `$1roomclear=${seed}`);
      const { why } = await startFromQuery(W.game, new URLSearchParams(q)); if (why) throw new Error(`start refused — ${why}`);
    } finally { if (!trace) { /* stays quiet through the run */ } else { console.log = log; console.error = err; console.warn = warn; } }
    const g = W.game, col = g.col, fight = g.fight;
    const team = () => (g.guards as any[]).filter(x => x.unit && x.team === 'operative'), foes = () => (g.guards as any[]).filter(x => x.team === 'hostile');
    const step = (n: number) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(1 / 60); } };
    fragStatsReset(); step(20); out.team = team().length; out.hostiles = foes().length;
    if (hold.at) { g.teleportPlayer([hold.at[0], 0, hold.at[1]]); step(2); }
    const teamAt: number[][] = team().map(o => [...o.char.pos]);
    if (process.env.HOLD_SOLVE === '1') {   // (what the throw solver costs a frame: its calls, their time, the worst frame's share — into the run's notes)
      const s0 = g.items.solve.bind(g.items), P = { n: 0, ms: 0, peak: 0, cur: 0, t: -1 };
      g.items.solve = (...a: any[]) => { if (g.time !== P.t) { P.peak = Math.max(P.peak, P.cur); P.cur = 0; P.t = g.time; } const t = performance.now(), r = s0(...a), dt = performance.now() - t; P.n++; P.ms += dt; P.cur += dt; return r; };
      undo.push(() => out.notes.push(`throw solver: ${P.n} calls, ${P.ms.toFixed(0)} ms, worst frame ${Math.max(P.peak, P.cur).toFixed(1)} ms`)); }
    const sam = g.player.char.pos, why = g.orders.give('hold', g.orders.targetAt([sam[0], 0, sam[2]]), 'all'); if (why) out.notes.push(`hold refused: ${why}`);
    // what the net and the room fight say, for --trace: every line a defender says, and the room fight's own notes
    if (trace) { const say0 = g.say.bind(g); g.say = (gd: any, text: string, ...rest: any[]) => { if (gd?.team === 'hostile') say(`  ${g.time.toFixed(1).padStart(6)}  “${text}” — ${gd.callsign} ${at(gd.char.pos)}`); return say0(gd, text, ...rest); };
    }
    const laneThrew = new Set<string>();   // (the men whose grenade the lane rule asked for and that left the hand: lanes.ts says so in the room fight's log)
    { const push0 = fight.log.push.bind(fight.log); fight.log.push = (...rows: any[]) => { for (const r of rows) { say(`  ${Number(r.t).toFixed(1).padStart(6)}  · ${r.who}: ${r.what}`); if (/^\[lanes\] .*the grenade is away/.test(r.what)) laneThrew.add(r.who); } return push0(...rows); }; }
    const eye = (c: any): number[] => [c.pos[0], c.pos[1] + 1.45, c.pos[2]], chest = (c: any): number[] => [c.pos[0], c.pos[1] + 1.1, c.pos[2]];
    const inLine = (h: any) => { const p = chest(h.char); for (const o of team()) { if (o.state === 'dead') continue; if (flat(o.char.pos, h.char.pos) < 45 && !col.shotBlocked(eye(o.char), p)) return true; } return flat(sam, h.char.pos) < 45 && !col.shotBlocked(eye(g.player.char), p); };
    const doing = (h: any) => { const D = fight.defs?.find((d: any) => d.gd === h); return `${D ? D.mode : '—'}/${h.state}${h.script ? '/script' : ''}`; };
    const home = new Map<any, number[]>(); for (const h of foes()) home.set(h, [h.char.pos[0], 0, h.char.pos[2]]);
    const spell = new Map<any, WalkIn>(), was = new Map<any, { p: number[]; line: boolean; up: boolean }>(), losses: { t: number; at: number[] }[] = [];
    // THE ROOM THAT IS HIT: the held room nearest the team, and in it the defender nearest the team — he is shot at the start (the team's round, as if through
    // the doorway), and the gunfire of the hold is heard at his place and at the team's from then on. That is what brings the others: a room of theirs hit.
    let hitAt: number[] | null = null;
    if (!NOHIT) { let best: any = null, bd = Infinity; for (const h of foes()) { const D = fight.defs?.find((d: any) => d.gd === h); if (!D?.room) continue; const d = flat(h.char.pos, sam); if (d < bd) { bd = d; best = h; } }
      if (best) { hitAt = [best.char.pos[0], 1, best.char.pos[2]]; out.notes.push(`first hit: ${best.callsign} ${at(best.char.pos)}`); const d = [best.char.pos[0] - sam[0], 0, best.char.pos[2] - sam[2]], l = Math.hypot(d[0], d[2]) || 1;
        home.delete(best); g.events.push({ kind: 'shot', pos: [sam[0], 1, sam[2]], time: g.time, loud: true, level: 1, who: g.player.char.id } as any); killGuard(g, best, [d[0] / l, 0, d[2] / l], false, 'shot', 'player'); was.set(best, { p: hitAt, line: false, up: false }); out.hostiles--; } }
    let t0 = g.time, nextNoise = 1, downSeen = 0, k = 0, hf = 0, seenAt = new Map<any, number>(), nextShot = 0, left = false, flipped = false;
    for (let f = 0; f < secs * 60; f++) {
      const t = g.time - t0;
      if (hold.flip && !flipped && t >= hold.flip.t) { flipped = true; for (const [n, o] of Object.entries(hold.flip.set)) put(n, o, undo); say(`  ${t.toFixed(1).padStart(6)}  ○ rows put: ${JSON.stringify(hold.flip.set)}`); }
      if (hold.leave && !left && t >= hold.leave.t) { left = true; g.teleportPlayer([hold.leave.at[0], 0, hold.leave.at[1]]); seenAt.clear(); say(`  ${t.toFixed(1).padStart(6)}  ○ Sam leaves the hold for (${hold.leave.at[0]}, ${hold.leave.at[1]})`); }
      if (hold.shoot) {   // Sam's rifle: the nearest man he has had a line of fire to for a third of a second
        const pc = g.player.char; let tgt: any = null, td = Infinity;
        for (const h of foes()) { if (h.state === 'dead') { seenAt.delete(h); continue; } const d = flat(pc.pos, h.char.pos); if (d > 45 || col.shotBlocked(eye(pc), chest(h.char))) { seenAt.delete(h); continue; }
          if (!seenAt.has(h)) seenAt.set(h, t); if (t - seenAt.get(h)! >= 0.33 && d < td) { td = d; tgt = h; } }
        if (tgt && t >= nextShot) { nextShot = t + 0.33; const c = chest(tgt.char); pc.aimYaw = pc.bodyYaw = Math.atan2(c[0] - pc.pos[0], c[2] - pc.pos[2]); fireWeapon(g, pc, c, true, { weapon: WEAPONS.fn2000 }); say(`  ${t.toFixed(1).padStart(6)}  ● Sam's round at ${tgt.callsign} ${at(tgt.char.pos)}`); }
      }
      if (t >= nextNoise) { nextNoise += NOISE; const p = hitAt && (k++ % 2 === 0) ? hitAt : [sam[0], 1, sam[2]]; g.events.push({ kind: 'shot', pos: [p[0], 1, p[2]], time: g.time, loud: true, level: 1, who: g.player.char.id } as any); }
      step(1);
      { const h = g.player.hitFlash ?? 0; if (h > hf + 1e-6) { out.samHits++; say(`  ${t.toFixed(1).padStart(6)}  ✚ Sam hit (he cannot be hurt here: ${out.samHits})`); } hf = h; }
      if (f % 6) continue;
      for (const h of foes()) {
        const w = was.get(h), up = h.state !== 'dead', line = up ? inLine(h) : (w?.line ?? false), p = [h.char.pos[0], 0, h.char.pos[2]];
        if (w?.up && !up) {
          const k: Kill = { t: +t.toFixed(1), who: h.callsign, at: [+w.p[0].toFixed(1), +w.p[2].toFixed(1)], doing: (h as any).__doing ?? '—', inLine: w.line, by: h.downBy ?? '—', off: +flat(w.p, home.get(h) ?? w.p).toFixed(1) };
          out.kills.push(k); if (w.line) losses.push({ t, at: w.p });
          const S = spell.get(h); if (S) { S.died = +(t - S.t).toFixed(1); S.secs = S.died; spell.delete(h); }
          say(`  ${t.toFixed(1).padStart(6)}  ✖ ${h.callsign} down ${at(w.p)} · ${k.doing} · ${k.inLine ? 'IN the holders\' line' : 'out of their line'} · ${k.off} m from his start`);
        }
        if (up) { (h as any).__doing = doing(h);
          if (w && flat(p, w.p) < 0.02 && laneHolds(g, h)) { out.stops.held += 0.1; if (doorwayInWay(g, p as any)) out.stops.door += 0.1;
            if ([g.player.char, ...team().filter(o => o.state !== 'dead').map(o => o.char)].some(c => !col.shotBlocked(eye(c), chest(h.char), undefined, 1))) out.stops.shot += 0.1; }
          const moved = w ? flat(p, w.p) / 0.1 : 0, offPost = flat(p, home.get(h) ?? p) > 2.5;
          if (line && !(w?.line) && offPost && moved > 0.4) {
            const loss = losses.find(L => t - L.t <= MEM && flat(L.at, p) <= NEAR);
            const S: WalkIn = { t: +t.toFixed(1), who: h.callsign, at: [+p[0].toFixed(1), +p[2].toFixed(1)], doing: doing(h), afterLoss: !!loss, died: null, secs: 0 }; spell.set(h, S); out.walkIns.push(S);
            say(`  ${t.toFixed(1).padStart(6)}  → ${h.callsign} walks into the holders' line ${at(p)} · ${S.doing}${loss ? ` · ${(t - loss.t).toFixed(0)} s after a mate dropped ${flat(loss.at, p).toFixed(0)} m from here` : ''}`);
          }
          if (!line && w?.line) { const S = spell.get(h); if (S) { S.secs = +(t - S.t).toFixed(1); spell.delete(h); say(`  ${t.toFixed(1).padStart(6)}  ← ${h.callsign} out of their line again ${at(p)} after ${S.secs} s`); } }
        }
        was.set(h, { p, line, up });
      }
      const down = team().filter(o => o.state === 'dead').length; if (down !== downSeen) { say(`  ${t.toFixed(1).padStart(6)}  ✚ a teammate down (${down} of ${out.team})`); downSeen = down; }
      if (foes().every(h => h.state === 'dead')) { out.secs = +t.toFixed(1); break; }
    }
    for (const S of spell.values()) S.secs = +((g.time - t0) - S.t).toFixed(1);
    out.afterLoss = out.walkIns.filter(S => S.afterLoss).length; out.fed = out.walkIns.filter(S => S.afterLoss && S.died !== null && S.died <= FED_SECS).length;
    out.teamDown = team().filter(o => o.state === 'dead').length;
    out.lanes = { ...lanesStats(g) };
    { const ids = new Set<number>(foes().map(h => h.char.id)), start = [sam, ...teamAt];
      const name = (id: number) => String(foes().find(h => h.char.id === id)?.callsign ?? id);
      out.frags = { thrown: FRAG_STATS.theirs, held: FRAG_STATS.held, bursts: FRAG_LOG.filter(b => ids.has(b.who)).map(b => ({ by: name(b.who), lane: laneThrew.has(name(b.who)), at: [+b.at[0].toFixed(1), +b.at[2].toFixed(1)] as [number, number], teamM: +Math.min(...start.map(q => flat(q, b.at))).toFixed(1), hit: b.hits.filter(h => h.result !== 'shielded').map(h => `${h.name}:${h.result}`) })) }; }
  } catch (e) { out.error = e instanceof Error ? `${e.message}\n${(e.stack ?? '').split('\n').slice(1, 5).join('\n')}` : String(e); }
  finally { console.log = log; console.error = err; console.warn = warn; Math.random = rnd; for (const u of undo.reverse()) u(); }
  return out;
}

if (import.meta.main) {
  const runs: HoldRun[] = [];
  console.log(`corridor-hold · ${LEVEL} · ${scns.join(', ')} · seeds ${seeds.join(',')} · ${SECS} s a run · the team holds where it starts${Object.keys(SET).length ? ` · --set ${JSON.stringify(SET)}` : ''}`);
  for (const scn of scns) for (const seed of seeds) {
    if (TRACE) console.log(`\n=== ${scn} : ${seed} ===`);
    const r = await holdRun(scn, seed); runs.push(r);
    if (r.error) { console.log(`${scn}:${seed}  ERROR ${r.error}`); continue; }
    const inL = r.kills.filter(k => k.inLine).length;
    if (!QUIET) console.log(`${(scn + ':' + seed).padEnd(18)} defenders down ${String(r.kills.length).padStart(2)} of ${r.hostiles} (${inL} in the holders' line) · walk-ins ${String(r.walkIns.length).padStart(2)}, after a loss there ${String(r.afterLoss).padStart(2)}, FED ${String(r.fed).padStart(2)} · team down ${r.teamDown} of ${r.team}, Sam hit ${r.samHits}× · ${r.secs.toFixed(0)} s${r.lanes ? ' · lanes ' + JSON.stringify(r.lanes) : ''}${r.notes.length ? ' · ' + r.notes.join('; ') : ''}`);
  }
  const ok = runs.filter(r => !r.error), sum = (f: (r: HoldRun) => number) => ok.reduce((a, r) => a + f(r), 0);
  console.log(`\nTOTAL over ${ok.length} runs: defenders down ${sum(r => r.kills.length)} of ${sum(r => r.hostiles)} · in the holders' line ${sum(r => r.kills.filter(k => k.inLine).length)} · walk-ins ${sum(r => r.walkIns.length)} · after a loss there ${sum(r => r.afterLoss)} · FED ${sum(r => r.fed)} · teammates down ${sum(r => r.teamDown)} of ${sum(r => r.team)}${runs.length - ok.length ? ` · ${runs.length - ok.length} ERRORS` : ''}`);
  if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify({ level: LEVEL, secs: SECS, set: SET, runs }, null, 1));
  process.exit(0);
}
