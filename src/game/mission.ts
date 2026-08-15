// Mission thread: stage machine (infiltrate → drive → exfil), the drive pull, the rack check errand, debrief stats, objective text/marker.
// (Split out of game.ts mechanically: plain functions taking the Game as their first argument; Game keeps one-line delegators for
//  anything other files call.)
import { Vec3, v3 } from '../math/vec';
import { Input } from './input';
import { PLAYER_ID, DRIVE_REACH, DRIVE_SECS } from './consts';
import type { Game, Guard, MissionStats } from './game';
import { fmtClock, missionRating } from './game';
import { chronSpotted, chronObjective, tickChronicle, debriefOf } from './chronicle';
import { handlerBeat } from './dialogue';

// ------------------------------------------------------------ mission
/** Live = a run is on and it really is the player playing. The showcase tour drives the player through these very rooms and flips switches, none of
 *  which is the mission: quietUtility is up for the tour's whole run (puppet only during its beats), so it doubles as the 'tour running' signal here.
 *  The tour's hand-over stop calls restartEncounter(), which starts a fresh Mission anyway. */
export function missionLive(g: Game): boolean { const s = g.mission.stage; return !g.quietUtility && !g.puppet && s !== 'done' && s !== 'failed'; }

/** kills = men the player shot dead; knockouts = men he put down breathing (combat.ts killGuard decides which by how / by — a colleague's round counts for neither); keys = keys taken off questioned men (player.ts takeKey) */
export function tally(g: Game, k: 'alerts' | 'spotted' | 'bodies' | 'shots' | 'kills' | 'knockouts' | 'keys') { if (missionLive(g)) g.mission.stats[k]++; }

/** The run in numbers as plain rows (the QA probes read these strings — ko-probes wants 'knocked out … · killed' = '0 · 1'; the card itself now lays the same
 *  numbers out as a grid, ui/debrief.ts). Bodies found counts the ones out cold too — a sleeping guard found is as much an alarm as a dead one — but only the shot
 *  ones are kills, which is what keeps a knockout nobody finds a clean run. The key row only when a key was taken. */
export function debriefRows(s: MissionStats): [string, string][] {
  const rows: [string, string][] = [
    ['time', fmtClock(s.elapsed)],
    ['alerts raised', String(s.alerts)],
    ['times spotted', String(s.spotted)],
    ['bodies found', String(s.bodies)],
    ['shots fired', String(s.shots)],
    ['knocked out (breathing) · killed', `${s.knockouts} · ${s.kills}`],   // the takedown, the choke, the whip, a ring to the head all leave a man breathing: the left number; only rounds kill
    ['blackout', s.blackout ? 'used' : 'no'],
  ];
  if (s.keys > 0) rows.push(['keys taken off them', String(s.keys)]);
  if (s.qrf >= 1) rows.push(['response team', `QRF on the floor at ${fmtClock(s.qrfAt)}${s.qrf >= 2 ? ' · exfil under perimeter lockdown' : ''}`]);   // (game/qrf.ts: it went loud enough for the response team — and, at 2, for the compound to be locked down round him)
  return rows;
}

/** Planar distance from a floor point to the mission rack's LED face (anywhere across its width counts: you can get at the caddy from either side). */
export function rackDist(g: Game, p: Vec3): number { const r = g.level.mission.rack; return Math.hypot(Math.max(0, Math.abs(p[0] - r.front[0]) - r.halfW), p[2] - r.front[2]); }

/** seconds after Sam goes down before the down card comes up over the (frozen) picture: long enough for the body to land and the round's echo to play */
export const DOWN_CARD_SECS = 2.6;

export function updateMission(g: Game, dt: number, input: Input) {
  const m = g.mission, pl = g.player, p = pl.char.pos, M = g.level.mission;
  if ((g.quietUtility || g.puppet) && !g.missionInTour) { m.driveT = -1; return; }   // the tour is running (see missionLive) — and a pull it interrupted does not resume on its own
  if (m.pulled) for (const t of g.rackTargets) t.on = false;    // the drive is out: its rack stays dark whatever the Lights panel switches back on (restartEncounter relights it: resetLevelState + a fresh Mission)
  if (m.sweepAt > 0 && g.time >= m.sweepAt) { m.sweepAt = -1; sendRackCheck(g); }
  if (m.stage === 'failed' && m.downCardAt > 0 && g.time >= m.downCardAt) { m.downCardAt = -1; m.debrief = true; }   // the down card, a beat after he dropped (main.ts opens whichever card mission.debrief asks for; headless nobody does and the flag just stands)
  if (m.stage === 'done' || m.stage === 'failed') return;
  if (pl.down) { m.stage = 'failed'; m.driveT = -1; m.downCardAt = g.missionInTour ? -1 : g.time + DOWN_CARD_SECS; return; }      // the existing down / Enter-to-restart flow does the rest (Enter before the card is up restarts as ever)
  m.stats.elapsed += dt;
  if (g.godMode || g.playerInvisible || !g.aiEnabled) m.stats.sandbox = true;   // a run with a cheat on says so on the card
  if (!g.missionInTour) tickChronicle(g);   // the debrief's path sample when it is due (twice a second of the mission clock) — the tour's drive beat is nobody's run
  const anyAlert = g.guards.some(gd => gd.state === 'alert');
  if (anyAlert && !m.alarmOn) m.stats.alerts++;                     // an alarm EPISODE: someone went to alert while nobody was (three men hearing one shot is one alarm, not three)
  m.alarmOn = anyAlert;
  // fully detected = an alert guard with eyes on you (the same sighting that licenses him to shoot), counted in episodes — a fresh one after 4 s unseen — not frames
  { const by = g.guards.find(gd => gd.state === 'alert' && gd.sawPlayerThisFrame); if (by) { if (g.time - m.spottedT > 4) { m.stats.spotted++; chronSpotted(g, by); } m.spottedT = g.time; } }
  if (m.stage === 'infiltrate') {
    const R = M.serverRoom;
    if (p[0] > R.x0 && p[0] < R.x1 && p[2] > R.z0 && p[2] < R.z1) { chronObjective(g, 'reached the server room'); m.stage = 'drive'; g.msg(`server room — the drive is in rack ${M.rack.index + 1}, the marked one in the east bank`); handlerBeat(g, 'server', 1.2); }   // (and a word from the handler a beat behind the objective line — dialogue.ts HANDLER_LINES; she waits out a fight or a man in his arm)
  } else if (m.stage === 'drive') {
    const rf = M.rack.front; const inReach = rackDist(g, p) < DRIVE_REACH;
    if (m.driveT < 0) {   // the rack's 'pull the drive' row (buildInteractables decides reach; interact.ts → Game.act): start pulling — it runs on its own from here, you just have to stay on it (a step, Space or Esc lets go: interact.ts cancelSustained → cancelDrive)
      if (g.act?.kind === 'objective' && g.act.verb === 'drive') { m.driveT = 0; g.audio.play('click', rf, 0.8); g.audio.play('magOut', rf, 0.4, { rate: 0.55 }); g.msg('pulling the drive — stay on it'); if (!m.handsOn) { m.handsOn = true; chronObjective(g, 'hands on the drive', rf); } }
    } else if (!inReach || pl.dragging || pl.takedown || pl.holding || pl.sprinting) cancelDrive(g);
    else { m.driveT += dt; if (m.driveT >= DRIVE_SECS) drivePulled(g); }
  } else if (m.stage === 'exfil') {
    if (p[0] > M.exfilX && Math.abs(p[2] - M.exfilZ) < 1.8) {   // out THROUGH the fire exit (its frame), not round the building
      chronObjective(g, 'out through the fire exit — mission complete');   // (written before the stage flips: a done run writes nothing more)
      m.stage = 'done'; m.debrief = true;
      const D = debriefOf(g); g.msg(`exfiltrated — ${fmtClock(m.stats.elapsed)} · ${D.rating} ${D.score}`);
    }
  }
}

/** hands off the drive before it is out (out of reach, hands or feet busy — updateMission; a step, Space or Esc — interact.ts): the pull starts over next time */
export function cancelDrive(g: Game) { const m = g.mission; if (m.driveT < 0) return; m.driveT = -1; g.msg('let go of the drive'); }

/** The caddy comes free: the rack drops off its UPS feed — its LEDs and the green wash they threw on the floor go dark, which is all the renderer needs to
 *  show it — the clunk goes into the hearing model as a modest noise (a man in the corridor may come and look), and a few seconds later somebody is
 *  sent to look at the rack that just dropped off the network (sendRackCheck). */
export function drivePulled(g: Game) {
  const m = g.mission, M = g.level.mission, rf = M.rack.front;
  chronObjective(g, `the drive is out — rack ${M.rack.index + 1} goes dark`, rf);
  m.driveT = -1; m.pulled = true; m.stage = 'exfil'; m.sweepAt = g.time + 7;
  for (const t of g.rackTargets) t.on = false;
  g.audio.play('rack', rf, 0.5, { rate: 0.7 }); g.audio.play('lightOff', rf, 0.7);
  g.events.push({ kind: 'prop', pos: [rf[0], 0, rf[2]], time: g.time, loud: false, level: 0.35, who: PLAYER_ID }); g.player.noise = Math.max(g.player.noise, 0.35);   // heard like a knocked chair: a look if he is close, no alarm
  g.msg(`drive out — rack ${M.rack.index + 1} is dark. leave by the fire exit`);
  handlerBeat(g, 'drive', 1.5);   // 'drive shows dark on my board' — his knees answer
}

/** The dead rack is noticed on the monitoring: the nearest calm patrol goes to look at it — the breaker errand's mechanism (a task that survives the
 *  suspicion decay), so he walks in, looks round the rack for a few seconds and, finding nobody, returns to his route. */
export function sendRackCheck(g: Game) {
  if (g.player.down) return;
  const M = g.level.mission; const goal: Vec3 = [M.rack.front[0], 0, M.rack.front[2] + 1.1];   // a step off its face
  let best: Guard | null = null, bd = 1e9;
  for (const gd of g.guards) { if (gd.state !== 'patrol' || gd.hold || gd.held || gd.script || gd.unit || gd.team !== 'guard' || gd.task) continue; const d = v3.dist(gd.char.pos, goal); if (d < bd) { bd = d; best = gd; } }   // (a calm STAFF man free to go: not the one in Sam's arm — his state stands 'patrol' through the hold, and the errand used to flip him suspicious with the pistol popping into his pinned fist (review A6.5) — nor a choreographed one, nor a unit off the shift's net)
  if (!best) return;   // everyone is already busy with something louder
  best.task = { kind: 'rack', pos: goal }; best.lastKnown = v3.copy(goal); best.awareness = Math.max(best.awareness, 0.42);
  best.state = 'suspicious'; best.reactT = 1.2; best.searchT = 0; best.path = []; best.pathGoal = null;
  g.say(best, `rack ${M.rack.index + 1} just dropped off the network — going to take a look`, true); g.audio.play('radio', best.char.pos, 0.6);
  handlerBeat(g, 'rack', 2.6);   // she heard that on their net too: a line behind his
}

/** Where the HUD's objective marker points (null: nothing to point at, or the tour is running). */
export function objectivePos(g: Game): Vec3 | null {
  if ((g.quietUtility || g.touring) && !g.missionInTour) return null;
  { const o = g.director?.objective; if (o) return o.pos; }   // a level-script program's own objective (director.ts c.objective) stands over the stage machine's while it runs
  const M = g.level.mission; const s = g.mission.stage;
  return s === 'infiltrate' ? (g.doors.byName(M.entryDoor)?.frameCentre ?? null) : s === 'drive' ? M.rack.front : s === 'exfil' ? (g.doors.byName(M.exfilDoor)?.frameCentre ?? null) : null;
}

/** The HUD's one objective line ('' while the tour runs). */
export function objectiveText(g: Game): string {
  if ((g.quietUtility || g.touring) && !g.missionInTour) return '';
  { const o = g.director?.objective; if (o) return 'objective ▸ ' + o.text; }
  const m = g.mission; const s = m.stage; const n = g.level.mission.rack.index + 1;
  if (s === 'infiltrate') return 'objective ▸ reach the server room';
  if (s === 'drive') return m.driveT >= 0 ? `objective ▸ pulling the drive… ${Math.min(99, Math.round(m.driveT / DRIVE_SECS * 100))}%` : `objective ▸ pull the drive from rack ${n} (Space at its face, then stay on it)`;
  if (s === 'exfil') return 'objective ▸ get out through the fire exit';
  if (s === 'done') { let t = doneLine.get(m); if (!t) { const D = debriefOf(g); t = `mission complete — ${fmtClock(m.stats.elapsed)} · ${D.rating} ${D.score}`; doneLine.set(m, t); } return t; }   // (worked out once per finished run, not sixty times a second: nothing on it can change any more)
  return 'mission failed — enter restarts it';
}
const doneLine = new WeakMap<object, string>();
