// A DUMP OF KEPT REPLAYS, UNPACKED AND GONE THROUGH (src/replay/kept.ts — the page keeps every run by itself; 'Hand over replays' on the start page's Extras, or the
// replay page, downloads them all as one file):
//   bun run tools/qa/replay-dump.ts <dump.ndjson[.gz] | replay.json[.gz] | folder> … [--out DIR] [--moments N] [--again] [--quiet]
// Takes any mix of dumps and single replay files (F7's, the viewer's 'download with notes'), in any number, in any order, as often as they are sent:
//   · DE-DUPLICATED: a page visit is one tape however many dumps carry it (by its visit id and piece number: the fullest copy stands); a single file saved by the key
//     is a WINDOW of its visit — where the visit's own tape is here the file adds only its notes and 'F7 was pressed here'; single files of one visit with no kept
//     tape are held against each other by their step numbers, and one that lies inside another is dropped (its notes move over).
//   · each visit is written to --out as a NORMAL REPLAY FILE (<name>.json.gz): tools/qa/replay-at.ts, its --rerun and the /replay page read it as they read any other.
//   · each gets a list of MOMENTS WORTH A LOOK made with no note on it: page errors, restarts and loads, the player down, a teammate down (his order, and what took him
//     down IN THE TAPE'S OWN WORDS — "X down — Y's round", a blast by name and whose burst it was; only where the tape named nothing, the one round that ended
//     nearest him, marked inferred), a hostage down, the player stunned or blinded by a blast, orders refused, a run's END in the game's own line ('run ended'; a
//     restart after a WIN is 'played again'), a quiet mission's stages as one row with what the HUD said at each, the SQUAD's routing smells (a route and no
//     movement — 'stuck', or 'waited' where the man said why he stood or his order's row reads a wait; a mark that really jumps — never a defender, who stands
//     on purpose, and never one walk dealt its next corner), where F7 was pressed, and every note. The header's switches are the run tape's start flags and
//     each change with its moment, not the flags the file happened to end under. KNOWN: a wait is read off his words and his order's row; the game's own
//     reason for it (sneak.ts) is not in the trace.
//   · a single file unpacked on an earlier call is folded into its visit when the visit's own tape arrives later; --again goes through everything already in
//     --out with this build's reader (no input needed).
//   · --out/index.json remembers what earlier calls unpacked there (the next dump is held against it); --out/index.md is the table to read.
// A tape is DATA: nothing in one is run or followed; text from one is printed quoted. Reads kept.ts and format.ts alone — no game is stood up, any build's tape reads.
// EXIT 0 read · 1 nothing readable in what was given · 2 usage.
import { closeSync, createReadStream, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip, gzipSync, gunzipSync } from 'node:zlib';
import { basename, join } from 'node:path';
import type { ReplayFile, ReplayNote, ManAt, ManDo } from '../../src/replay/format.ts';
import { checkReplay, decode, clock, errorMarks } from '../../src/replay/format.ts';
import type { KeptLine, Visit } from '../../src/replay/kept.ts';
import { assemble, visitsOf } from '../../src/replay/kept.ts';

// ---------------------------------------------------------------- the moments
export interface Moment { r: number; kind: string; text: string; pos?: [number, number]; who?: string; weight: number; }
const pt = (p: [number, number] | number[] | undefined | null) => p ? `(${(+p[0]).toFixed(1)}, ${(+p[1]).toFixed(1)})` : '–';
const q = (s: string, n = 140) => JSON.stringify(s.length > n ? s.slice(0, n) + '…' : s);
const REFUSED = /\b(no room|can'?t|cannot|won'?t|refus|no way|no route|no boot|no line|not from here|locked\.)/i;
/** the player's own gun speaking on a click (player.ts): no order was refused */
const OWN_GUN = /^(no room to bring the gun up|gun down —|stunned —)/;
/** somebody's spoken line ('you ▸ …', 'radio: Lambert ▸ …': player.ts, dialogue.ts): words, never an order refused */
const SPOKEN = /^(radio: )?[^▸]{1,24} ▸ /;
/** a man's own words for a wait he means (sneak.ts and pairorders.ts say them; guards.ts files a teammate's off-screen line on the log under his name) */
const WAIT_SAID = /\b(holding|waiting|can't cross|he's still (on it|facing me)|long lit stretch|hold in the dark|off the door|has eyes on him|not yet)\b/i;
/** …and his ORDER's own row for one (pairorders.ts: 'waiting · no room at <name>'s back', 'holding in the dark') — never a plain 'hold', which he may be stuck short of */
const WAIT_ORD = /\bwaiting ·|\bholding in the dark\b/i;
/** does he stand on purpose? By what he said while he stood, or by the rows his order showed (replay-at.ts asks the same) */
export const meansToWait = (said: readonly string[], ords: readonly string[] = []): boolean => said.some(t => WAIT_SAID.test(t)) || ords.some(t => WAIT_ORD.test(t));
/** the still-with-a-route rule's own pieces, shared with replay-at.ts: how far his feet are from where his route ends (0 = no route asked; under STUCK_OFF he
 *  has arrived), and a man somebody else has stopped (held for a talk or a wait at his waypoint, in Sam's arm, planted on a post) */
export const STUCK_OFF = 0.75;
export const toGo = (a: { x: number; z: number; do: ManDo }): number => { const P = a.do.path; if (!P?.length) return 0; const e = a.do.goal ?? P[P.length - 1]; return Math.hypot(e[0] - a.x, e[1] - a.z); };
export const stoppedByOther = (d: ManDo): boolean => d.by === 'hold' || d.by === 'held' || d.by === 'pinned';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** what the tape itself said took a man down: its own "<name> down — <cause>" line nearest the moment (null = it named nothing) */
const saidCause = (F: ReplayFile, who: string, r: number): string | null => {
  const re = new RegExp(`^${esc(who)} (?:down|hit, down and breathing) — (.+)$`); let best: string | null = null, d = Infinity;
  for (const l of F.lines) { if (l.k !== 'msg' || l.r < r - 1 || l.r > r + 0.6) continue; const m = re.exec(l.text); if (m && Math.abs(l.r - r) < d) { d = Math.abs(l.r - r); best = m[1]; } }
  return best;
};
/** did the mark really change under him? Not when he had reached the old one (the next mark of the same job), nor when the new one lies on along the way he
 *  was already walking (one walk dealt its next corner) — unless it is a mark he was sent to moments ago and left (`seen`: to and fro) */
/** the order a man's row names ('wallCharge: standing off' → 'wallCharge'; '' = none) */
export const orderId = (ord: string | undefined): string => /^[^:]*/.exec(ord ?? '')![0].trim();
export const markJumped = (at: [number, number], old: [number, number], now: [number, number], seen: [number, number][] = []): boolean => {
  if (Math.hypot(now[0] - old[0], now[1] - old[1]) < 0.3) return false;
  if (seen.some(g => Math.hypot(now[0] - g[0], now[1] - g[1]) < 0.3)) return true;
  const ox = old[0] - at[0], oz = old[1] - at[1], nx = now[0] - at[0], nz = now[1] - at[1], lo = Math.hypot(ox, oz), ln = Math.hypot(nx, nz);
  if (lo < 1.2 || ln < 0.01) return false;
  return (ox * nx + oz * nz) / (lo * ln) < 0.5;
};

/** what a reader should look at first in a replay nobody put a note on. `f7` = moments (file clock) the key was pressed at */
export function momentsOf(F: ReplayFile, f7: { r: number; why?: string }[] = []): Moment[] {
  const D = decode(F), M: Moment[] = [], cast = F.cast, name = (ci: number) => cast[ci]?.name ?? '?';
  const side = (ci: number) => cast[ci]?.kind === 'player' ? 'player' : cast[ci]?.team ?? '?';
  const camp = (ci: number) => cast[ci]?.kind === 'player' ? 'operative' : cast[ci]?.team ?? '?';   // (whose side a round is of: the player's is the squad's)
  /** why he went down, in order of trust: the tape's own line (a round by name, or a blast — then whose burst it was, where the tape has it), else the
   *  one round that ended nearest him, the other side's before his own, and a burst that went off near him as he fell (guesses, and said to be: the
   *  player's own fall has no such line on any tape) */
  const cause = (ci: number, m: ManAt, r: number): { words: string; blast: boolean } => {
    const burst = (reach: number) => { let b: typeof F.events[number] | null = null; for (const e of F.events) if (e.k === 'frag' && e.who >= 0 && e.r >= r - 0.5 && e.r <= r + 0.25 && Math.hypot(e.x - m.x, e.z - m.z) <= reach && (!b || Math.abs(e.r - r) < Math.abs(b.r - r))) b = e;
      return b ? `${b.who === ci ? 'his own' : `${name(b.who)}'s`}, burst ${Math.hypot(b.x - m.x, b.z - m.z).toFixed(1)} m off` : ''; };
    const said = saidCause(F, name(ci), r), says = said ? ` · the tape says ${q(said, 80)}` : '';
    if (said && !/grenade|charge|blast|frag/i.test(said)) return { words: says, blast: false };   // (a round by name, his own side's, 'wounded, out of the fight')
    if (said) { const b = burst(Infinity); return { words: `${says}${b ? ` (${b})` : ''}`, blast: true }; }
    let best = -1, bd = Infinity;
    for (const e of F.events) { if (e.r < r - 1.5 || e.r > r + 0.1 || !/shot/i.test(e.k) || !e.to || e.who < 0 || e.who === ci || Math.hypot(e.to[0] - e.x, e.to[1] - e.z) < 0.05) continue;
      const d = Math.hypot(e.to[0] - m.x, e.to[1] - m.z); if (d > 1.6) continue; const score = d + (camp(e.who) === camp(ci) ? 10 : 0); if (score < bd) { bd = score; best = e.who; } }
    const b = burst(8);
    return { words: `${best < 0 ? '' : ` · nearest round ${name(best)}'s${camp(best) === camp(ci) ? ', of his own side' : ''} (inferred)`}${b ? ` · a blast as he fell: ${b} (inferred)` : ''}`, blast: false };
  };
  for (const e of errorMarks(F)) M.push({ r: e.r, kind: 'PAGE ERROR', text: q(e.text, 200), weight: 100 });
  for (const l of F.lines) if (l.k === 'mark' && !l.text.startsWith('the page hit an error')) M.push({ r: l.r, kind: 'mark', text: q(l.text), weight: /missing|kept nothing|tape ends/.test(l.text) ? 20 : 60 });
  for (const n of F.notes) M.push({ r: n.r, kind: 'NOTE', text: q(n.text, 400), pos: n.pos ?? undefined, weight: 200 });
  for (const p of f7) M.push({ r: p.r, kind: 'F7 pressed', text: p.why && p.why !== 'key' ? q(p.why) : 'he saved the last five minutes here', weight: 90 });
  // ---- men going down, by the change of state between two samples
  const prev: (ManAt | null)[] = [];
  for (let s = 0; s < D.r.length; s++) {
    const men = D.men[s];
    for (let ci = 0; ci < men.length; ci++) {
      const m = men[ci], was = prev[ci]; prev[ci] = m ?? null; if (!m || !was) continue;
      const wasUp = was.do.st !== 'dead' && was.do.st !== 'down', isDown = m.do.st === 'dead' || m.do.st === 'down'; if (!wasUp || !isDown) continue;
      const sd = side(ci), pos: [number, number] = [m.x, m.z]; if (sd !== 'player' && sd !== 'operative' && sd !== 'civilian') continue;
      // what took him down, and what he was doing (a teammate's own man is the room fight's, which the trace does not carry: a foe is named only where it has one)
      const C = cause(ci, m, D.r[s]), by = C.words, how = C.blast ? 'down to a blast' : m.do.down ?? '', foe = was.do.foe !== undefined && was.do.foe >= 0 ? name(was.do.foe) : '';
      const doing = [was.do.ord ? `order ${q(was.do.ord, 60)}` : '', was.do.task ? `errand ${was.do.task}` : '', was.do.by ?? '', foe ? `gun on ${foe}` : ''].filter(Boolean).join(' · ');
      if (sd === 'player') M.push({ r: D.r[s], kind: 'PLAYER DOWN', text: `at ${pt(pos)}${by}${was.do.slot ? ` · ${was.do.slot} in hand` : ''}`, pos, who: name(ci), weight: 95 });
      else if (sd === 'operative') M.push({ r: D.r[s], kind: 'teammate down', text: `${name(ci)} ${how} at ${pt(pos)}${by}${doing ? ` · he was: ${doing}` : ''}`, pos, who: name(ci), weight: 80 });
      else if (sd === 'civilian') M.push({ r: D.r[s], kind: 'civilian down', text: `${name(ci)} ${how} at ${pt(pos)}${by}`, pos, who: name(ci), weight: 85 });
    }
  }
  // ---- words: orders refused, the run's result
  // (A QUIET MISSION'S FOUR STAGES are four chronicle rows that read alike, 'objective (<room>)': the trace keeps a row's kind and room, not its words. What each
  //  was is on the HUD's line of the same instant where the game says one ('taking the vehicle log — stay on it', 'exfiltrated — 2:31 · GHOST 94'). So rows
  //  of one room inside OBJ_FOLD of each other, in one run, are ONE row carrying those lines, and the run's end is a row of its own, said in the game's words.
  //  THE END LINES are the game's own (roomclear.ts, rescue.ts, snatch.ts, defuse.ts, nightbreach.ts, mission.ts): every one but the quiet game's 'exfiltrated —'
  //  and the defuse win says how to stage it again. NOT an end, though they read like one: 'structure taken — …. not over: <the man still loose / the charges>',
  //  'the house is taken — the charges are still live', 'breach called off — …', '<men> down — the room is yours to take'.)
  const OBJ_FOLD = 20, ENDS = /stages it again|^exfiltrated —|mission failed|every charge safe, the house is yours/i, LIVE = /not over:|still live|called off|yours to take/i;
  const WON = /^(structure taken|exfiltrated|MISSION COMPLETE|CLEAN —|COSTLY —|room clear\.)|every charge safe, the house is yours/i, LOST = /^(sam|player) down/i;
  const STUNNED = /, stunned\b|— you are blinded|you were too close/i, NEWRUN = /^(restart|a checkpoint|an F10 recording)/i;
  const over = (t: string) => ENDS.test(t) && !LIVE.test(t);
  /** a teammate's own line filed on the log under his name ('Blue One: holding. it's lit and he's looking.'): his wait, said — never an order refused */
  const ownWait = (t: string) => { const m = /^([^:]{1,24}): (.+)$/.exec(t); return !!m && WAIT_SAID.test(m[2]) && cast.some((c, ci) => c.name === m[1] && side(ci) === 'operative'); };
  const hudAt = (r: number) => F.lines.filter(l => l.k === 'msg' && Math.abs(l.r - r) < 0.05 && !SPOKEN.test(l.text)).map(l => l.text);
  let obj: { r: number; last: number; room: string; n: number; said: string[] } | null = null;
  const objOut = () => { if (obj) M.push({ r: obj.r, kind: 'run', text: `${q(obj.room)}${obj.n > 1 ? ` · ${obj.n} stages over ${(obj.last - obj.r).toFixed(1)} s` : ''}${obj.said.length ? ` · the HUD said ${obj.said.map(t => q(t, 80)).join(', ')}` : ''}`, weight: 30 }); obj = null; };
  let ended: { r: number; text: string } | null = null;   // (the FIRST end line of the run being read: a later one — Sam dropped after the house was taken — does not make it a loss)
  for (const l of F.lines) {
    if (l.k === 'msg' && REFUSED.test(l.text) && !OWN_GUN.test(l.text) && !SPOKEN.test(l.text) && !ownWait(l.text) && !/^Tango|\(radio\)/.test(l.text)) M.push({ r: l.r, kind: 'said no', text: q(l.text), weight: 55 });
    if (l.k === 'msg' && over(l.text)) { if (!LOST.test(l.text)) M.push({ r: l.r, kind: 'run ended', text: q(l.text, 160), weight: 65 }); objOut(); ended ??= { r: l.r, text: l.text }; }   // (Sam down has its own row, with what dropped him)
    if (l.k === 'msg' && STUNNED.test(l.text) && !OWN_GUN.test(l.text)) M.push({ r: l.r, kind: 'player stunned', text: q(l.text, 160), weight: 65 });
    if (l.k === 'mark' && NEWRUN.test(l.text)) {   // (another run from here: nothing of the one before folds into it, and its end is not this one's)
      if (/^restart/i.test(l.text) && ended && WON.test(ended.text)) M.push({ r: l.r, kind: 'played again', text: `restarted ${(l.r - ended.r).toFixed(1)} s after ${q(ended.text, 60)}`, weight: 25 });
      objOut(); ended = null;
    }
    if (l.k !== 'chron' || !/\b(down|failed|complete|cleared|secured|exfil|hostage|objective)\b/i.test(l.text) || /^(contact|radio|shot|heard)/.test(l.text)) continue;
    if (!/^objective \(/.test(l.text)) { M.push({ r: l.r, kind: 'run', text: q(l.text), weight: 30 }); continue; }
    const said = hudAt(l.r); if (said.some(over)) continue;   // (the stage that ended the run: the 'run ended' row has it)
    if (obj && (obj.room !== l.text || l.r - obj.last > OBJ_FOLD || l.r < obj.last)) objOut();
    obj ??= { r: l.r, last: l.r, room: l.text, n: 0, said: [] }; obj.n++; obj.last = l.r; for (const t of said) if (!obj.said.includes(t)) obj.said.push(t);
  }
  objOut();
  // ---- the routing smells, over the whole file, for the squad's men
  // (STUCK = a route held, somewhere still to go, and no movement. A man standing ON his mark keeps a one-point route to his own cell: he is waiting, not stuck —
  //  every 'stuck' line of the first tape read was that. So: how far his feet are from where they are going, 0 with no route asked; under STUCK_OFF he has arrived.
  //  NOR IS A MAN SOMEBODY ELSE HAS STOPPED: a guard held for a talk or a wait at his waypoint ('hold'), one in Sam's arm ('held'), one planted on a post ('pinned')
  //  keeps the route he will walk next — five 'stuck' lines of a quiet tape were two guards chatting. A scripted man ('script': every teammate on an order) still counts.)
  for (let ci = 0; ci < cast.length; ci++) {
    if (side(ci) !== 'operative') continue;   // (a defender standing off a door for his own drill, or held short of a covered lane, stands on purpose)
    let still = 0, stillFrom = 0, stillGap = 0, stillAt: [number, number] = [0, 0], flagged = -1e9, waited = -1e9, px = NaN, pz = NaN; const said: string[] = [], ords: string[] = []; const goals: number[] = [], seen: { r: number; g: [number, number] }[] = []; let lastGoal: [number, number] | null = null, thrashAt = -1e9, lastOrd = '';
    // (A MAN WHO SAYS WHY HE STANDS IS WAITING: the sneak rule holds a follower short of lit floor a guard is looking at and he says so — "holding. it's lit
    //  and he's looking." — or his order's own row reads 'waiting · …' / 'holding in the dark': the rule at work, not a route gone wrong. What he said while he
    //  stood is on the row either way; the row is of the STRETCH — where it began, the order he stood under — and a wait never hides a stuck that follows it.
    //  A stretch is closed when he moves, when he leaves the floor and at the tape's end.)
    const stillOut = () => {
      const waits = meansToWait(said, ords);
      if (still >= 4 && stillFrom - (waits ? waited : flagged) > 10) {
        const words = said.length ? ` · he said ${said.slice(0, 3).map(t => q(t, 70)).join(', ')}` : '', ord = ords[0] ?? '';
        M.push({ r: stillFrom, kind: waits ? 'waited' : 'stuck', text: `${cast[ci].name} held a route with ${stillGap.toFixed(1)} m still to go and did not move for ${still.toFixed(1)} s at ${pt(stillAt)}${ord ? ` · order ${q(ord, 60)}` : ''}${words}`, pos: stillAt, who: cast[ci].name, weight: waits ? 20 : /hold/i.test(ord) ? 40 : 70 });
        if (waits) waited = stillFrom; else flagged = stillFrom;
      }
      still = 0;
    };
    for (let s = 0; s < D.r.length; s++) {
      const a = D.men[s][ci]; if (!a) { stillOut(); px = NaN; continue; }
      const up = a.do.st !== 'dead' && a.do.st !== 'down', dt = s ? D.r[s] - D.r[s - 1] : 0;
      if (!Number.isNaN(px) && up && !stoppedByOther(a.do) && toGo(a) > STUCK_OFF && Math.hypot(a.x - px, a.z - pz) < 0.02 * Math.max(1, dt * F.hz)) {
        if (!still) { stillFrom = D.r[s]; stillGap = toGo(a); stillAt = [a.x, a.z]; said.length = 0; ords.length = 0; }
        still += dt; if (a.do.say && !said.includes(a.do.say)) said.push(a.do.say); if (a.do.ord && !ords.includes(a.do.ord)) ords.push(a.do.ord);
      } else stillOut();
      px = a.x; pz = a.z;
      // (a follower's mark moves with the man he follows: no smell, and the changes made while he followed are not counted against the order he is given next;
      //  nor is the mark a NEW order gives him a change of mind under the old one)
      const g = up ? a.do.goal ?? null : null, ord = orderId(a.do.ord), fresh = ord !== lastOrd; lastOrd = ord;
      if (fresh || ord === 'fallIn') { goals.length = 0; seen.length = 0; lastGoal = g; } else if (g && !lastGoal) lastGoal = g; else if (g && lastGoal && (g[0] !== lastGoal[0] || g[1] !== lastGoal[1])) {
        while (seen.length && seen[0].r < D.r[s] - 10) seen.shift();
        const jumped = markJumped([a.x, a.z], lastGoal, g, seen.map(x => x.g)); seen.push({ r: D.r[s], g: lastGoal }); lastGoal = g; if (!jumped) continue;
        goals.push(D.r[s]); while (goals.length && goals[0] < D.r[s] - 10) goals.shift();
        if (goals.length >= 8 && D.r[s] - thrashAt > 15) {
          M.push({ r: goals[0], kind: 'mark thrash', text: `${cast[ci].name}: the mark he was going to changed ${goals.length} times in 10 s${a.do.ord ? ` · order ${q(a.do.ord, 60)}` : ''}`, pos: [a.x, a.z], who: cast[ci].name, weight: 50 }); thrashAt = D.r[s]; } }
    }
    stillOut();
  }
  return M.sort((a, b) => a.r - b.r || b.weight - a.weight);
}

/** a file's runs: the stretches between restarts / loads, each with how it went as far as the trace says */
/** the player's own row of a run's tally (no side's name: a side may be called 'player') */
const ME = '*player';
export function runsOf(F: ReplayFile): { r0: number; r1: number; words: string }[] {
  const D = decode(F), cuts = [0, ...F.lines.filter(l => l.k === 'mark' && /^(restart|a checkpoint|load)/i.test(l.text)).map(l => l.r), F.seconds + 0.001], out: { r0: number; r1: number; words: string }[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const r0 = cuts[i], r1 = cuts[i + 1]; if (r1 - r0 < 0.5) continue;
    let s1 = D.r.length - 1; while (s1 > 0 && D.r[s1] >= r1) s1--;
    const end = D.men[s1], tally: Record<string, [number, number]> = {};
    end.forEach((m, ci) => { if (!m) return; const k = F.cast[ci].kind === 'player' ? ME : F.cast[ci].team; const t = tally[k] ??= [0, 0]; t[1]++; if (m.do.st !== 'dead' && m.do.st !== 'down') t[0]++; });
    const orders = F.lines.filter(l => l.k === 'order' && l.r >= r0 && l.r < r1).length, ev = F.events.filter(e => e.r >= r0 && e.r < r1), shots = ev.filter(e => e.k === 'shot' && F.cast[e.who]?.kind === 'player').length, others = ev.filter(e => e.k === 'guardShot').length;
    out.push({ r0, r1, words: `${Object.entries(tally).map(([k, [up, n]]) => k === ME ? (up ? 'player up' : 'PLAYER DOWN') : `${k} ${up}/${n} up`).join(' · ')} · ${orders} orders · ${shots} of his rounds · ${others} of others'` });
  }
  return out;
}

// ---------------------------------------------------------------- reading what was given
const isGz = (b: Uint8Array) => b[0] === 0x1f && b[1] === 0x8b;
/** the first characters of a file's text (gzip or plain), without reading the rest: a dump can be hundreds of megabytes */
async function firstText(path: string, chars = 256): Promise<string> {
  const head = Buffer.alloc(2); { const fd = openSync(path, 'r'); readSync(fd, head, 0, 2, 0); closeSync(fd); }
  const file = createReadStream(path), src = isGz(head) ? file.pipe(createGunzip()) : file; let text = '';
  try { const dec = new TextDecoder(); for await (const chunk of src as AsyncIterable<Buffer>) { text += dec.decode(chunk, { stream: true }); if (text.length >= chars) break; } } catch { /* what was read stands */ }
  (file as unknown as { destroy(): void }).destroy(); return text.slice(0, chars);
}
/** a file's lines, streamed: gzip members one after another (a dump) or plain text; a line can be megabytes */
async function eachLine(path: string, on: (line: string) => void | Promise<void>): Promise<void> {
  const head = Buffer.alloc(2); { const fd = openSync(path, 'r'); readSync(fd, head, 0, 2, 0); closeSync(fd); }
  const src = isGz(head) ? createReadStream(path).pipe(createGunzip()) : createReadStream(path);
  const dec = new TextDecoder(); let parts: string[] = [];
  for await (const chunk of src as AsyncIterable<Buffer>) {
    let text = dec.decode(chunk, { stream: true }), nl: number;
    while ((nl = text.indexOf('\n')) >= 0) { parts.push(text.slice(0, nl)); const line = parts.join(''); parts = []; text = text.slice(nl + 1); if (line.trim()) await on(line); }
    if (text) parts.push(text);
  }
  const tail = parts.join('') + dec.decode(); if (tail.trim()) await on(tail);
}

interface Entry {
  /** the visit id (a kept tape), or 'file:<key>' for single files with no visit */
  id: string; name: string; from: string[]; kept: boolean;
  startedAt: string; savedAt: string; scenario: string; url: string; commit: string; seed: number | null; seconds: number;
  pieces: number; missing: number[]; n0: number; n1: number; tape: string; flags: string; notes: number; f7: { n: number; savedAt: string; why?: string }[];
  moments: number; top: string[]; runs: string[];
}
interface Index { v: 1; entries: Record<string, Entry>; }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'run';
/** the mission kind a page's address asks for, where the file itself names none (nothing was staged by the tape's first sample: the title, the start page) */
const askedKind = (F: ReplayFile): string => /[?&](roomclear|rescue|nightbreach|quiet)\b/.exec(F.url ?? '')?.[1] ?? '';
const scenarioWords = (F: ReplayFile): string => { if (F.level.scenario) return F.level.scenario; const f = F.level.file, k = askedKind(F); return f ? k ? `${f} (${k} asked, not staged when the tape began)` : f : 'the night'; };
const scenarioSlug = (F: ReplayFile): string => { if (F.level.scenario) return slug(F.level.scenario); const f = F.level.file, k = askedKind(F); return f ? `${slug(f.replace(/\.json$/, ''))}${k ? `-${k}-unstaged` : ''}` : 'night'; };
const fileName = (F: ReplayFile, start: string) => `${start.replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-')}-${scenarioSlug(F)}-${Math.round(F.seconds)}s`;
/** the moment (file clock) of a step count, by the nearest sample */
const rOfStep = (F: ReplayFile, n: number): number => { let best = 0, d = Infinity; for (const s of F.samples) { const x = Math.abs(s.n - n); if (x < d) { d = x; best = s.r; } } return best; };

const SWITCHES: [string, boolean, string][] = [['godMode', true, 'GOD MODE'], ['aiEnabled', false, 'AI OFF'], ['infiniteAmmo', true, 'unlimited ammo'], ['playerInvisible', true, 'invisible']];
/** the sandbox switches as they stood THROUGH the file, not at its end: the run tape's start flags, then each change with its moment ('AI OFF from 3:32.4').
 *  A file with no run tape has only the flags it was saved under, and says so. The difficulty is the file's own word where it has one, else the page's address; chaos the file's own number */
const switchWords = (F: ReplayFile): string => {
  const out: string[] = [], fl: Record<string, unknown> = F.flags ?? {};
  const diff = typeof fl.difficulty === 'string' && fl.difficulty ? fl.difficulty : fl.hard === true ? 'hard' : /[?&]difficulty=([a-z]+)/.exec(F.url ?? '')?.[1] ?? (/[?&]hard\b(?!=0)/.test(F.url ?? '') ? 'hard' : '');
  const T = F.rerun && 'recipe' in F.rerun ? F.rerun : null, start = (T?.recipe.knobs as { flags?: Record<string, unknown> } | null | undefined)?.flags;
  if (T && start && F.samples.length) {
    const n0 = F.samples[0].n, cur: Record<string, unknown> = { ...start }, rows = T.x.filter(x => x[1] === 'flags' && x[2] && typeof x[2] === 'object').sort((a, b) => a[0] - b[0]);
    for (const x of rows) if (x[0] <= n0) Object.assign(cur, x[2]);
    for (const [key, when, word] of SWITCHES) {
      let on = cur[key] === when; const parts: string[] = on ? [word] : [];
      for (const x of rows) { if (x[0] <= n0) continue; const v = (x[2] as Record<string, unknown>)[key]; if (v === undefined || (v === when) === on) continue; on = v === when; parts.push(on ? `${parts.length ? 'again' : word} from ${clock(rOfStep(F, x[0]))}` : `until ${clock(rOfStep(F, x[0]))}`); }
      if (fl[key] !== undefined && (fl[key] === when) !== on) parts.push(parts.length ? `${fl[key] === when ? 'on' : 'off'} as saved, past the tape's end` : `${word} as saved, past the tape's end`);
      if (parts.length) out.push(parts.join(' '));
    }
  } else { for (const [key, when, word] of SWITCHES) if (fl[key] === when) out.push(word); if (out.length) out[out.length - 1] += ' (as saved: no run tape says since when)'; }
  if (diff) out.push(diff); if (typeof fl.chaos === 'number') out.push(`chaos ${fl.chaos}`);
  return out.join(' · ');
};

if (import.meta.main) {
  const argv = process.argv.slice(2), val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const skip = new Set<number>(); argv.forEach((a, i) => { if (a === '--out' || a === '--moments') skip.add(i + 1); });
  const given = argv.filter((a, i) => !a.startsWith('--') && !skip.has(i)), out = val('out') ?? 'replay-dump-out', quiet = argv.includes('--quiet'), again = argv.includes('--again'), showN = Number(val('moments') ?? 14);
  if (!given.length && !again) { console.log('usage: bun run tools/qa/replay-dump.ts <dump.ndjson[.gz] | replay.json[.gz] | folder> … [--out DIR] [--moments N] [--again] [--quiet]'); process.exit(2); }
  const paths: string[] = [];
  for (const g of given) { if (!existsSync(g)) { console.log(`${g}: not there`); continue; } if (statSync(g).isDirectory()) { for (const f of readdirSync(g).sort()) if (/\.(json|ndjson)(\.gz)?$/.test(f)) paths.push(join(g, f)); } else paths.push(g); }
  mkdirSync(out, { recursive: true });
  const ixPath = join(out, 'index.json');
  let IX: Index = { v: 1, entries: {} }; try { if (existsSync(ixPath)) IX = JSON.parse(readFileSync(ixPath, 'utf8')); } catch { /* a fresh index */ }
  const say = (s: string) => { if (!quiet) console.log(s); };
  const report = { read: 0, bad: 0, visitsNew: 0, visitsGrown: 0, visitsSame: 0, windows: 0, loose: 0, looseDup: 0, unreadable: [] as string[] };
  const f7Of = new Map<string, { savedAt: string; n?: number; why?: string; notes: ReplayNote[] }[]>(), lateNotes = new Map<string, ReplayNote[]>(), loose: { F: ReplayFile; from: string }[] = [];
  const touched = new Set<string>();

  /** one visit, whole: written if it is new here or fuller than the copy an earlier call wrote */
  const settle = (V: Visit, from: string): void => {
    const had = IX.entries[V.sid];
    if (had && had.pieces >= V.pieces.size) { report.visitsSame++; if (!had.from.includes(from)) had.from.push(from); if (V.notes.length) lateNotes.set(V.sid, [...(lateNotes.get(V.sid) ?? []), ...V.notes]); say(`  visit ${V.sid}: already here (${had.pieces} pieces) — ${had.name}`); return; }
    const A = assemble(V); if (!A) { say(`  visit ${V.sid}: ${V.head ? 'no sample in its pieces' : 'no head'} — nothing to play back`); report.bad++; return; }
    const bad = checkReplay(A.file); if (bad) { say(`  visit ${V.sid}: ${bad}`); report.bad++; return; }
    if (had) { try {   // (the copy written before may hold notes this dump does not: from an F7 file, from a dump of notes alone)
      const old = JSON.parse(new TextDecoder().decode(gunzipSync(readFileSync(join(out, `${had.name}.json.gz`))))) as ReplayFile;
      for (const n of old.notes) if (!A.file.notes.some(x => x.id === n.id)) A.file.notes.push({ ...n, r: rOfStep(A.file, n.n) });
      A.file.notes.sort((a, b) => a.r - b.r);
    } catch { /* the old copy is gone: this one stands alone */ } }
    const first = [...V.pieces.entries()].sort((a, b) => a[0] - b[0])[0][1], name = had?.name ?? fileName(A.file, first.at);
    writeFileSync(join(out, `${name}.json.gz`), gzipSync(JSON.stringify(A.file)));
    IX.entries[V.sid] = { id: V.sid, name, from: [...new Set([...(had?.from ?? []), from])], kept: true, startedAt: first.at, savedAt: A.file.savedAt, scenario: scenarioWords(A.file), url: A.file.url ?? '', commit: A.file.commit ?? '', seed: A.file.seed ?? null,
      seconds: A.file.seconds, pieces: V.pieces.size, missing: A.missing, n0: A.n0, n1: A.n1, tape: A.tapeTicks ? `${A.tapeTicks} steps${A.tapeEnd ? ` — ends: ${A.tapeEnd}` : ''}` : `none${A.tapeEnd ? ` — ${A.tapeEnd}` : ''}`, flags: switchWords(A.file), notes: A.file.notes.length, f7: had?.f7 ?? [], moments: 0, top: [], runs: [] };
    touched.add(V.sid); if (had) report.visitsGrown++; else report.visitsNew++;
    say(`  visit ${V.sid}: ${had ? `grown ${had.pieces} → ` : ''}${V.pieces.size} pieces, ${clock(A.file.seconds)} of play${A.missing.length ? `, ${A.missing.length} piece(s) lost` : ''} → ${name}.json.gz`);
  };

  for (const p of paths) {
    const from = basename(p); report.read++;
    try {
      // a single replay file is one JSON object; a dump is lines. The first bytes say which
      const firstLine = (await firstText(p)).split('\n')[0];
      if (!/^\s*\{\s*"k"\s*:/.test(firstLine)) {   // (a replay file — small enough to read whole: a ring's five minutes, or a tape this tool wrote)
        const buf = readFileSync(p), F = JSON.parse(isGz(buf) ? new TextDecoder().decode(gunzipSync(buf)) : buf.toString('utf8')) as ReplayFile, bad = checkReplay(F);
        if (bad) { console.log(`${from}: ${bad}`); report.unreadable.push(from); continue; }
        say(`${from}: a replay file · ${scenarioWords(F)} · ${clock(F.seconds)} · saved ${F.savedAt} (${q(F.why, 40)}) · ${F.notes.length} notes${F.session ? ` · of visit ${F.session}` : ''}`);
        loose.push({ F, from }); continue;
      }
      say(`${from}: a dump`);
      let cur: Visit | null = null, nBad = 0;
      const flush = () => { if (cur) settle(cur, from); cur = null; };
      await eachLine(p, (line) => {
        let L: KeptLine; try { L = JSON.parse(line); } catch { nBad++; return; }
        if (!L || typeof L !== 'object' || typeof L.k !== 'string') { nBad++; return; }
        if (L.k === 'dump') say(`  made ${L.at} · lists ${L.visits.length} visit(s), ${L.shelf} from the F7 shelf${L.userAgent ? ` · ${q(L.userAgent, 90)}` : ''}`);
        else if (L.k === 'head' || L.k === 'piece' || L.k === 'notes') {
          if (L.k === 'notes' && (!cur || cur.sid !== L.sid)) { lateNotes.set(L.sid, [...(lateNotes.get(L.sid) ?? []), ...L.notes]); return; }
          if (!cur || cur.sid !== L.sid) { flush(); cur = { sid: L.sid, head: null, pieces: new Map(), notes: [] }; }
          visitsOf([L], new Map([[cur.sid, cur]]));
        }
        else if (L.k === 'f7') { if (L.session) f7Of.set(L.session, [...(f7Of.get(L.session) ?? []), { savedAt: L.savedAt, ...(typeof L.n === 'number' ? { n: L.n } : {}), why: L.why, notes: L.notes ?? [] }]); }
        else if (L.k === 'file') { const bad = checkReplay(L.file); if (bad) nBad++; else loose.push({ F: L.file, from }); }
      });
      flush(); if (nBad) { say(`  ${nBad} line(s) could not be read (a write cut short)`); report.bad += nBad; }
    } catch (e) { console.log(`${from}: could not be read — ${(e as Error).message}`); report.unreadable.push(from); }
  }

  // ---- single files: a window of a visit that is here adds its notes and its F7 moment; the rest are held against each other
  const reopen = (E: Entry): ReplayFile => JSON.parse(new TextDecoder().decode(gunzipSync(readFileSync(join(out, `${E.name}.json.gz`)))));
  const patched = new Map<string, ReplayFile>(), dirty = new Set<string>(), fileOf = (E: Entry) => { let F = patched.get(E.id); if (!F) patched.set(E.id, F = reopen(E)); return F; };
  const addNotes = (E: Entry, notes: ReplayNote[]): number => {   // (a note carries its step count: that places it on any file of the same visit)
    if (!notes.length) return 0; const F = fileOf(E); let added = 0;
    for (const n of notes) { const r = rOfStep(F, n.n), m = { ...n, r }, same = F.notes.find(x => x.id === m.id);
      if (same) { if (same.text !== m.text) { same.text = m.text; added++; } continue; }   // (a note edited since: the later words)
      if (F.notes.some(x => x.text === m.text && Math.abs(x.r - m.r) < 0.5)) continue; F.notes.push(m); added++; }
    if (added) { F.notes.sort((a, b) => a.r - b.r); E.notes = F.notes.length; touched.add(E.id); dirty.add(E.id); } return added;
  };
  for (const [sid, list] of f7Of) { const E = IX.entries[sid]; if (!E) continue; for (const p of list) { if (!E.f7.some(x => x.savedAt === p.savedAt)) { const F = fileOf(E); /* the key's file ends at the press: the last sample the page had by then */
        const at = Date.parse(p.savedAt), end = Date.parse(F.savedAt), r = Number.isFinite(at) && Number.isFinite(end) ? Math.max(0, Math.min(F.seconds, F.seconds - (end - at) / 1000)) : F.seconds; let n = F.samples[0].n, d = Infinity; for (const s of F.samples) { const x = Math.abs(s.r - r); if (x < d) { d = x; n = s.n; } }
        if (p.n !== undefined) n = p.n;   // (the file's own last step, where the shelf kept it: wall clocks drift from the game's while a page is paused)
        E.f7.push({ n, savedAt: p.savedAt, why: p.why }); touched.add(sid); } addNotes(E, p.notes); } }
  for (const [sid, notes] of lateNotes) { const E = IX.entries[sid]; if (E) addNotes(E, notes); }
  const key = (F: ReplayFile) => F.session ?? `${F.seed ?? '?'}|${F.url ?? ''}|${F.commit ?? ''}|${F.userAgent ?? ''}|${F.level.fp}`;
  const groups = new Map<string, { F: ReplayFile; from: string }[]>(); for (const l of loose) { const k = key(l.F); groups.set(k, [...(groups.get(k) ?? []), l]); }
  for (const [k, list] of groups) {
    const E = IX.entries[k];
    if (E?.kept && !E.missing.length) {   // (its visit's own tape is here, whole: with pieces lost the file may show what the tape does not, and stays)
      for (const { F, from } of list) { report.windows++; const last = F.samples[F.samples.length - 1].n; if (!E.f7.some(x => x.savedAt === F.savedAt)) { E.f7.push({ n: last, savedAt: F.savedAt, why: F.why }); touched.add(k); } const a = addNotes(E, F.notes); if (!E.from.includes(from)) E.from.push(from); say(`  ${from}: a window of visit ${k} (steps ${F.samples[0].n}–${last} of ${E.n0}–${E.n1})${a ? ` · ${a} note(s) moved onto the visit` : ''} — not written again`); }
      continue;
    }
    // no kept tape: the longest first; one whose steps lie inside a kept one is dropped
    list.sort((a, b) => (b.F.samples[b.F.samples.length - 1].n - b.F.samples[0].n) - (a.F.samples[a.F.samples.length - 1].n - a.F.samples[0].n));
    const keepers: { F: ReplayFile; from: string; id: string }[] = [];
    for (const l of list) {
      const a0 = l.F.samples[0].n, a1 = l.F.samples[l.F.samples.length - 1].n, id = `file:${k}:${a0}-${a1}`;
      const inside = keepers.find(x => x.F.samples[0].n <= a0 && x.F.samples[x.F.samples.length - 1].n >= a1 && x.F.samples.some(s => s.n === a0 && Math.abs(s.t - l.F.samples[0].t) < 0.01));
      const old = IX.entries[id] ?? Object.values(IX.entries).find(e => !e.kept && e.id.startsWith(`file:${k}:`) && e.n0 <= a0 && e.n1 >= a1);
      if (inside || old) { report.looseDup++; const into = inside ? IX.entries[inside.id] : old!; const a = addNotes(into, l.F.notes); if (!into.from.includes(l.from)) into.from.push(l.from); say(`  ${l.from}: the same play as ${into.name} (steps ${a0}–${a1})${a ? ` · ${a} note(s) moved over` : ''} — dropped`); continue; }
      const name = fileName(l.F, l.F.savedAt) + '-f7'; writeFileSync(join(out, `${name}.json.gz`), gzipSync(JSON.stringify(l.F)));
      const tape = l.F.rerun && 'ticks' in l.F.rerun ? `${l.F.rerun.ticks} steps` : `none${l.F.rerun ? ` — ${(l.F.rerun as { dead: string }).dead}` : ''}`;
      IX.entries[id] = { id, name, from: [l.from], kept: false, startedAt: l.F.savedAt, savedAt: l.F.savedAt, scenario: scenarioWords(l.F), url: l.F.url ?? '', commit: l.F.commit ?? '', seed: l.F.seed ?? null, seconds: l.F.seconds, pieces: 0, missing: [], n0: a0, n1: a1, tape, flags: switchWords(l.F), notes: l.F.notes.length, f7: [{ n: a1, savedAt: l.F.savedAt, why: l.F.why }], moments: 0, top: [], runs: [] };
      keepers.push({ ...l, id }); patched.set(id, l.F); touched.add(id); report.loose++; say(`  ${l.from}: a file with no kept visit → ${name}.json.gz`);
    }
  }

  // ---- a single file unpacked here on an earlier call, whose visit's own tape has come since: it is a window of that visit now (its notes and its press move
  //      over, its own copy and moments go — the tool's own output, nothing else is ever removed)
  for (const L of Object.values(IX.entries)) {
    if (L.kept) continue; const m = /^file:(.+):(\d+)-(\d+)$/.exec(L.id), V = m ? IX.entries[m[1]] : undefined; if (!V?.kept || V === L || L.n0 < V.n0 || L.n1 > V.n1) continue;
    if (V.missing.length) continue;   // (a kept tape with pieces lost may not hold what this file shows: both stay)
    let F: ReplayFile | null = null; try { F = fileOf(L); } catch { /* its copy is gone: the index row alone moves over */ }
    try { if (F) addNotes(V, F.notes); } catch (e) { say(`  ${L.name}: a window of ${V.name}, whose tape did not open (${(e as Error).message}) — left as it is`); continue; }
    for (const p of L.f7) if (!V.f7.some(x => x.savedAt === p.savedAt)) V.f7.push(p);
    for (const f of L.from) if (!V.from.includes(f)) V.from.push(f);
    for (const ext of ['.json.gz', '.moments.md']) rmSync(join(out, L.name + ext), { force: true });
    delete IX.entries[L.id]; patched.delete(L.id); dirty.delete(L.id); touched.delete(L.id); touched.add(V.id); report.windows++; say(`  ${L.name}: a window of the kept visit ${V.name} — folded into it`);
  }
  // ---- --again: everything unpacked here before is gone through again by this build's reader (its moments, runs and words; no tape changes)
  if (again) for (const E of Object.values(IX.entries)) if (existsSync(join(out, `${E.name}.json.gz`))) touched.add(E.id);

  // ---- every entry touched: written back if notes moved onto it, its moments listed
  for (const id of [...touched]) {
    const E = IX.entries[id]; let F: ReplayFile;
    try { F = fileOf(E); } catch (e) { touched.delete(id); report.bad++; console.log(`  ${E.name}.json.gz did not open (${(e as Error).message}): its moments are left as they were`); continue; }
    E.scenario = scenarioWords(F); E.flags = switchWords(F);
    if (dirty.has(id)) writeFileSync(join(out, `${E.name}.json.gz`), gzipSync(JSON.stringify(F)));   // (only a tape that took notes: the rest are on disk as they are)
    const f7 = E.f7.filter(p => !(!E.kept && p.n === E.n1)).map(p => ({ r: rOfStep(F, p.n), why: p.why }));
    const M = momentsOf(F, f7), runs = runsOf(F);
    E.moments = M.length; E.notes = F.notes.length; E.runs = runs.map(r => `${clock(r.r0)}–${clock(r.r1)}  ${r.words}`);
    const top = M.slice().sort((a, b) => b.weight - a.weight || a.r - b.r).slice(0, showN).sort((a, b) => a.r - b.r);
    E.top = top.map(m => `${clock(m.r)}  ${m.kind}: ${m.text}   [--at ${m.r.toFixed(1)}${m.pos ? ` --spot ${m.pos[0].toFixed(1)},${m.pos[1].toFixed(1)}` : ''}]`);
    const md = [`# ${E.name}`, '', `${E.scenario} · ${clock(E.seconds)} of play · page \`${E.url}\` · build ${E.commit || '?'} · seed ${E.seed ?? '?'}`, `${E.flags ? `Switches: ${E.flags}. ` : ''}Run tape: ${E.tape}. ${E.kept ? `Kept tape, ${E.pieces} pieces${E.missing.length ? `, ${E.missing.length} lost` : ''}.` : 'A single file saved by the key.'}`, '',
      '## Runs', ...E.runs.map(r => `- ${r}`), '', `## Moments worth a look (${M.length})`, '', 'Read one with `bun run tools/qa/replay-at.ts ' + E.name + '.json.gz --at SECONDS [--spot x,z]`. Words in quotes are the tape\'s own.', '',
      ...M.map(m => `- ${clock(m.r)} (${m.r.toFixed(1)}) **${m.kind}** ${m.text}${m.pos ? ` · spot ${m.pos[0].toFixed(1)},${m.pos[1].toFixed(1)}` : ''}`), ''].join('\n');
    writeFileSync(join(out, `${E.name}.moments.md`), md); patched.delete(id);
  }
  writeFileSync(ixPath, JSON.stringify(IX, null, 1));
  const rows = Object.values(IX.entries).sort((a, b) => a.startedAt < b.startedAt ? -1 : 1);
  writeFileSync(join(out, 'index.md'), ['# Replays unpacked here', '', '| file | when | mission | play | tape | switches | notes | F7 | moments | from |', '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(e => `| ${e.name}.json.gz | ${e.startedAt.slice(0, 16).replace('T', ' ')} | ${e.scenario} | ${clock(e.seconds)} | ${e.tape} | ${e.flags || '–'} | ${e.notes} | ${e.f7.length} | ${e.moments} | ${e.from.join(', ')} |`), ''].join('\n'));

  console.log(`\n=== ${report.read} file(s) read: ${report.visitsNew} new visit(s), ${report.visitsGrown} grown, ${report.visitsSame} already here · ${report.loose} single file(s) kept, ${report.looseDup} the same play as another, ${report.windows} a window of a kept visit${report.bad ? ` · ${report.bad} unreadable part(s)` : ''} ===`);
  for (const id of touched) { const E = IX.entries[id]; console.log(`\n${E.name}.json.gz — ${E.scenario} · ${clock(E.seconds)}${E.flags ? ` · ${E.flags}` : ''} · tape ${E.tape} · ${E.notes} notes · ${E.moments} moments (${E.name}.moments.md)`); for (const r of E.runs) console.log(`  run ${r}`); for (const t of E.top) console.log(`    ${t}`); }
  console.log(`\nindex: ${join(out, 'index.md')}`);
  process.exit(touched.size || report.visitsSame || report.looseDup || report.windows ? 0 : 1);
}
