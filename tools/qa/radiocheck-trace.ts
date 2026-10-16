// A pair-sneak run with the defender squads' timeline in step with it: every row the squads file in the room fight's log (enemysquads.ts: check / asks /
// looks / found / no sign / contact / …) and every line said on a radio is printed the frame it is made, between the tool's own rows, so a trace shows
// what the net knew and when. The switch itself is the harness's env (SQUADS=radiocheck) or left off:
//   SQUADS=radiocheck bun run tools/qa/radiocheck-trace.ts --one block-squads:433 --arm pair --trace
// Everything after the script's name goes to tools/qa/pair-sneak.ts as it stands (one run in this process: --one). Nothing here changes a run: it only reads.
// RC_DIGEST=1 adds a `[dg] <movement digest>` row every half second (game/digest.ts with nobody's speech bubble in it), so a run with the switch on can be
// laid beside the same seed with it off: the two agree row for row until the first frame the switch changes something (the squads' check keeps its own dice).
// RC_TOOL=playthrough runs tools/qa/playthrough.ts under the same rows instead (a LOUD run: `--one <scn>:<seed>`).
import { SQUADS } from '../../src/game/enemysquads';
import { Game } from '../../src/game/game';
import { digestGame, hashDigest } from '../../src/game/digest';

type Row = { t: number; who: string; what: string };
const out = console.log.bind(console), stamp = (t: number) => t.toFixed(2).padStart(9);
let game: Game | null = null, last: Row | null = null;
const DG = process.env.RC_DIGEST === '1'; let frames = 0;
const flush = () => {
  if (!game) return;
  const log = game.fight.log as Row[]; let i = 0;
  if (last) { const at = log.lastIndexOf(last); i = at >= 0 ? at + 1 : log.findIndex(r => r.t > last!.t); if (i < 0) i = log.length; }   // (the log trims its head: go on from the last row printed, or from the first one after its time)
  for (; i < log.length; i++) { const r = log[i]; if (r.what.startsWith('[squads] ')) out(`${stamp(r.t)}  [net] ${r.what.slice(9)}`); }
  if (log.length) last = log[log.length - 1];
};
const say = Game.prototype.say, msg = Game.prototype.msg, update = Game.prototype.update; let inSay = false;
Game.prototype.say = function (this: Game, gd, text, radio) { if (game !== this) { game = this; last = null; } flush(); if (radio) out(`${stamp(this.time)}  [radio] ${gd.callsign}: "${text}"`); inSay = true; try { return say.call(this, gd, text, radio); } finally { inSay = false; } };
// (a line on the net that is no bubble — the radio check's own, the last stand's — reaches the log as '<callsign> (radio): …' without passing say())
Game.prototype.msg = function (this: Game, text) { const m = inSay ? null : /^(.+?) \(radio\): (.*)$/.exec(text); if (m) { if (game !== this) { game = this; last = null; } flush(); out(`${stamp(this.time)}  [radio] ${m[1]}: "${m[2]}"`); } return msg.call(this, text); };
Game.prototype.update = function (this: Game, ...a: Parameters<Game['update']>) { if (game !== this) { game = this; last = null; } const r = update.apply(this, a); flush(); if (DG && ++frames % 30 === 0) { const d = digestGame(this, true) as any; for (const x of d.guards ?? []) delete x.bubble; for (const x of d.civilians ?? []) delete x.bubble; if (d.player) delete d.player.bubble; out(`${stamp(this.time)}  [dg] ${hashDigest(d)}`); } return r; };
console.log = (...a: unknown[]) => { flush(); out(...a); };
out(`radio check ${SQUADS.radioCheck ? `ON (every ${SQUADS.checkEvery} s ± ${SQUADS.checkJitter * 100} %, × ${SQUADS.checkAlertK} once the squad knows of the team; asks by name at ${SQUADS.checkAsk} s, men go at ${Math.max(SQUADS.checkSend, SQUADS.checkAsk + 1)} s)` : 'off'} · contact on eyes ${SQUADS.noticedEyes ? 'only once the man has noticed (alert / search)' : 'at the first hard sighting (as shipped)'}`);
if (process.env.RC_TOOL === 'playthrough') {   // (its main does not run under an import: one run, by its own play())
  const one = process.argv[process.argv.indexOf('--one') + 1] ?? ''; const [scn, seed] = one.split(':');
  const { play } = await import('./playthrough'); const r = await play(scn, Number(seed));
  out(`${scn}:${seed} ${r.end} ${r.t.toFixed(1)} s · team ${r.team}/${r.of}`);
} else await import('./pair-sneak');
flush();
