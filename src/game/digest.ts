// One structured DIGEST of the game's deterministic state — what an identity claim is made over: Sam, every man of the shift, the doors, the mission, the
// chronicle, the lights that are not simply on, the devices, the items on the floor, the furniture that has moved, the floor's memory (escalation, the alarm
// episode, the radio check), the decal count, the civilians. Positions to the millimetre, clocks to the hundredth: two games that agree on this every couple
// of seconds are, for every purpose the QA harness has, the same game.
//
// Two readers: the checkpoint probes (tools/qa/checkpoint-probes.ts: continue ≡ load ≡ load-into-a-fresh-game — this function moved here from that file, its
// shape unchanged) and the SESSION JOURNAL (journal.ts / tools/qa/replay.ts): a recording carries one of these every JOURNAL_DIGEST_EVERY frames and a replay
// compares its own, naming the FIELD that first differs (diffDigest) — 'guards[1].aw 0.31 ≠ 0.29' says which man and what, not just 'diverged'.
import type { Game } from './game';
import { FRAG } from './frag';
import { rollcallState } from './guards';
import { LOOK_DECALS } from './lookDecals';
import { hashStr } from './dialogue';
import type { Vec3 } from '../math/vec';
import { LAUNCHER40 } from './weapons';

const f2 = (x: number) => (Number.isFinite(x) ? Number(x.toFixed(2)) : x);
const f3 = (x: number) => (Number.isFinite(x) ? Number(x.toFixed(3)) : x);
const p3 = (p: Vec3 | number[] | null | undefined) => p ? [f3(p[0]), f3(p[1]), f3(p[2])] : null;

/** the digest's shape: plain JSON (compared by JSON.stringify, diffed field by field) */
export type GameDigest = Record<string, unknown>;

/** ONE sample of everything the identity claim is over (see the head). The checkpoint rows / counters of the chronicle are left out: they ARE the legitimate
 *  difference between a game stepped on and one loaded. `compact` (the session journal's form, one every couple of seconds in a file): the same fields with the
 *  two that grow without bound folded — a speech bubble to its length + hash, the chronicle's kind list to a hash + its last three rows — ~2 KB instead of 3+. */
export function digestGame(game: Game, compact = false): GameDigest {
  const bub = (b: { text: string; t: number } | null | undefined) => !b ? null : compact ? `${b.text.length}#${hashStr(b.text).toString(36)}@${f2(b.t)}` : `${b.text}@${f2(b.t)}`;
  return {
    t: f2(game.time), esc: game.escalation, escT: f2(game.escalationT), episode: game.alarm.episode, placed: game.alarm.placed, blackout: game.blackout.active, seq: game.eventSeq,
    player: (() => { const pl = game.player, c = pl.char; return { pos: p3(c.pos), yaw: f2(c.bodyYaw), crouch: pl.crouch, slot: pl.slot, holstered: pl.holstered, cans: pl.canisters, bangs: pl.flashbangs, ...(pl.frags !== FRAG.issue ? { frags: pl.frags } : {}), pistol: `${pl.pistol.chamber}+${pl.pistol.mag}/${pl.pistol.spare.join(',')}`, rifle: `${pl.rifle.chamber}+${pl.rifle.mag}/${pl.rifle.spare.join(',')} r${pl.rifle.rings}${pl.rifle.shells !== LAUNCHER40.rounds ? ` g${pl.rifle.shells}` : ''}${pl.rifle.attachments.includes('cam') ? ` c${pl.rifle.cams}` : ''}`, ...(pl.cams.length ? { cams: pl.cams.map(c => `${p3(c.pos)}${c.vel ? '~' : ''}`).join(' ') } : {}), keys: [...pl.keys].sort(), codes: [...pl.codes].sort(), hits: pl.hitsLeft, down: pl.down, ocp: f2(pl.ocp.charge), nv: pl.nv }; })(),
    guards: game.guards.map(gd => ({ n: gd.callsign, st: gd.state, pos: p3(gd.char.pos), yaw: f2(gd.char.bodyYaw), aw: f2(gd.awareness), wp: gd.wp, wait: f2(gd.wait), spd: f2(gd.speed), fix: p3(gd.lastKnown), task: gd.task?.kind ?? null, duty: gd.bodyDuty ? `${gd.bodyDuty.role}:${gd.bodyDuty.stage}` : null, drawn: gd.drawn, found: gd.found, down: gd.downKind, torch: gd.flashlight.enabled, keys: compact ? [...gd.keys].sort().join(',') : [...gd.keys].sort(), leader: gd.leader?.callsign ?? null, post: gd.post?.name ?? null, path: `${gd.pathI}/${gd.path.length}`, bubble: bub(gd.bubble) })),
    doors: game.doors.list.map(d => `${d.def.name}:${f3(d.angle)}${d.latched ? 'L' : ''}${d.locked ? 'k' : ''}${d.lockBroken ? 'B' : ''}${d.pick > 0 ? 'p' + f2(d.pick) : ''}${d.noticed ? 'n' : ''}${d.off ? `X${f2(d.box.c[0])},${f2(d.box.c[2])}` : ''}`).join(' '),
    mission: { stage: game.mission.stage, pulled: game.mission.pulled, sweepAt: f2(game.mission.sweepAt), stats: { ...game.mission.stats, elapsed: f2(game.mission.stats.elapsed) } },
    chron: (() => { const ev = game.chronicle.events.filter(e => e.kind !== 'checkpoint'); const { saves, loads, ...counts } = game.chronicle.counts; void saves; void loads; const kinds = ev.map(e => `${e.kind}@${f2(e.t)}`); return compact ? { n: ev.length, last: kinds.slice(-3).join(','), h: hashStr(kinds.join(',')).toString(36), counts, pathN: game.chronicle.pathN } : { n: ev.length, kinds: kinds.join(','), counts, pathN: game.chronicle.pathN }; })(),
    targets: game.targets.filter(t => !t.on || t.broken || t.disabledUntil > 0 || t.factor < 0.999).map(t => `${t.name}:${t.on ? 1 : 0}${t.broken ? 'X' : ''}${f2(t.factor)}`).join(' '),
    devices: game.devices ? { cams: game.devices.cameras.map(c => `${c.state}:${f2(c.seen)}:${f2(c.yaw)}`), lasers: game.devices.lasers.map(l => `${l.trips}:${f2(l.lastTripAt)}`) } : null,
    items: game.items.items.map(it => `${it.kind}${it.fired ? '*' : ''}@${p3(it.pos)}${it.settled ? 's' : ''}`).join(' '),
    props: game.props.props.filter(p => Math.hypot(p.x - p.home[0], p.z - p.home[1]) > 0.005 || !p.asleep).map(p => `${p.id}:${f3(p.x)},${f3(p.z)},${f2(p.yaw)}${p.asleep ? '' : '!'}`).join(' '),
    events: game.events.length, rollcall: (() => { const R = rollcallState(game); return `${R.stage}:${f2(R.nextAt)}:${R.checks}`; })(),
    decals: game.decals.list.filter(d => !LOOK_DECALS.has(d)).length,
    civilians: (game.civilians ?? []).map(cv => { const C = cv.civ!; return { n: cv.callsign, st: cv.state, cs: C.state, pos: p3(cv.char.pos), yaw: f2(cv.char.bodyYaw), aw: f2(cv.awareness), wp: cv.wp, wait: f2(cv.wait), spd: f2(cv.speed), cause: C.cause, armed: C.armed, tgt: C.target?.name ?? null, rep: C.reported, to: C.reportTo?.callsign ?? null, complied: C.complied, path: `${cv.pathI}/${cv.path.length}`, heard: cv.heardUpTo, bubble: bub(cv.bubble), dice: C.dice }; }),   // (the cleaner / the late worker: in the file since review G3.1 — place, state, fright, target, ears, dice)
  };
}

/** one 32-bit hash of a digest (its JSON), hex — what a run of them folds into a single word */
export function hashDigest(d: GameDigest): string { return hashStr(JSON.stringify(d)).toString(16); }

/** Every field on which two digests differ, as 'path: a ≠ b' lines (narrowed into guards[i] / player / civilians[i] / mission.stats …), at most `max` of them.
 *  Empty = identical. Strings compared whole (the doors / items / props lines say which entry differs by their own text). */
export function diffDigest(a: unknown, b: unknown, max = 12): string[] {
  const out: string[] = [];
  const short = (x: unknown) => { const s = JSON.stringify(x); return s === undefined ? 'undefined' : s.length > 90 ? s.slice(0, 87) + '…' : s; };
  const walk = (x: unknown, y: unknown, path: string) => {
    if (out.length >= max) return;
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    const xo = x !== null && typeof x === 'object', yo = y !== null && typeof y === 'object';
    if (!xo || !yo || Array.isArray(x) !== Array.isArray(y)) { out.push(`${path || '(root)'}: ${short(x)} ≠ ${short(y)}`); return; }
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) { out.push(`${path}.length: ${x.length} ≠ ${y.length}`); }
      const n = Math.min(x.length, y.length);
      // a short array of numbers (a position) reads better whole than as '.0' / '.2'
      if (n <= 4 && x.every(v => typeof v === 'number') && y.every(v => typeof v === 'number')) { out.push(`${path}: ${short(x)} ≠ ${short(y)}`); return; }
      for (let i = 0; i < n && out.length < max; i++) { const tag = (x[i] as { n?: unknown } | null)?.n; walk(x[i], y[i], `${path}[${i}${typeof tag === 'string' ? ' ' + tag : ''}]`); }
      return;
    }
    const X = x as Record<string, unknown>, Y = y as Record<string, unknown>;
    for (const k of new Set([...Object.keys(X), ...Object.keys(Y)])) { if (out.length >= max) break; walk(X[k], Y[k], path ? `${path}.${k}` : k); }
  };
  walk(a, b, '');
  return out;
}

/** mulberry32 — the one seeded die the harness, the checkpoints' identity claim and the session journal all mean by 'seeded' (math/dice.ts) */
export { mulberry32 } from '../math/dice';
