// The scripted player of tools/qa/lesson-run.ts, standing on the REAL PAGE (tools/qa/sound-tapes.cjs bundles this file and puts it in the page): the same
// Bot the Training scripts under tools/qa/lessons/ are written against, over the page's own hooks (__game, __input, __cam, __runFrames), so a run made
// here is recorded by the page's run tape and plays back in the engine player (src/replay/engineplay.ts) on any machine.
//
// What differs from the headless runner, and why: EVERYTHING THE RUN DEPENDS ON MUST BE ON THE TAPE. The tape carries the input, the camera and every
// value the game reads off the renderer, so
//   - a row is chosen with the keys (Space held, the arrows, Space let go), never by Game.selectVerb, which writes the highlight from outside a step;
//   - Sam's light meter is fed as an ANSWER OF THE PROBE (the CPU estimate planted under his two keys before each step), never written on the Player.
// Nothing is drawn while it runs (the caller stubs the renderer), so no other GPU answer exists: every other reader takes its own stand-in.
import * as move from '../lessons/train-move';
import * as hands from '../lessons/train-hands';
import * as lights from '../lessons/train-lights';
import * as kit from '../lessons/train-kit';
import * as orders from '../lessons/train-orders';
import * as pairs from '../lessons/train-pairs';
import * as silent from '../lessons/train-silent';
import * as officeLoud from './office-loud';
import * as wallCharge from './wall-charge';
import * as whip from './whip';
import * as chairs from './chairs';
import * as reloads from './reloads';
import * as doors from './doors';
import type { Bot } from '../lesson-run';

type Vec = number[];
interface Script { query?: string; mode?: { unseen?: boolean; god?: boolean; noAi?: boolean; /** lesson-run's own (the moon on the CPU's meter): the page has the real meter */ moon?: boolean }; idleOk?: string[]; steps?: Record<string, (B: Bot) => void>; finish?: (B: Bot) => void; ended?: (g: any) => boolean; free?: (B: Bot) => void; level?: string; title?: string }
const LESSONS: Record<string, Script> = { 'train-move': move, 'train-hands': hands, 'train-lights': lights, 'train-kit': kit, 'train-orders': orders, 'train-pairs': pairs, 'train-silent': silent };
/** scripts that are no lesson: one function over the same Bot, on a level and query of their own */
const FREE: Record<string, Script> = { 'office-loud': officeLoud, 'wall-charge': wallCharge, whip, chairs, reloads, doors };

const DT = 1 / 60, flat = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[2] - b[2]), at = (p: Vec) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const Wn = window as any;

export interface TapeRun { code: 0 | 1 | 2; why: string; lines: string[]; steps: { id: string; t: number }[]; secs: number; frames: number; heard: [number, string][] }

function run(name: string, o: { cap?: number; pace?: number } = {}): TapeRun {
  const lesson = LESSONS[name], script = lesson ?? FREE[name];
  const lines: string[] = [], out: TapeRun = { code: 0, why: '', lines, steps: [], secs: 0, frames: 0, heard: [] };
  if (!script) return { ...out, code: 2, why: `no script '${name}'` };
  const g = Wn.__game, I = Wn.__input, cam = Wn.__cam, canvas = document.getElementById('view') as HTMLCanvasElement, hour = Wn.__hour, audio = Wn.__audio;
  const L = g.level.scenarios?.lesson;
  if (lesson && !L) return { ...out, code: 2, why: 'the level carries no scenarios.lesson block' };
  if (lesson) for (const T of L.steps) if (typeof script.steps?.[T.id] !== 'function') return { ...out, code: 2, why: `the script has no steps['${T.id}']` };
  const unseen = !!script.mode?.unseen;
  if (script.mode?.god) g.godMode = true;
  if (script.mode?.noAi) g.aiEnabled = false;   // (a sandbox switch: the run tape carries it, so the replay stands the same floor)

  let t = 0, frames = 0, goal: Vec | null = null, sprint = false, downT = 0, downSaid = false;
  const held = new Set<string>();
  // the sounds the mixer is asked for, by name, with the step they were asked on (the mute changes nothing here)
  { const play = audio.play.bind(audio); audio.play = (n: string, ...r: unknown[]) => { out.heard.push([frames, n]); return play(n, ...r); }; }
  const say = (s: string) => { lines.push(`${t.toFixed(1).padStart(6)}  ${s}`); };
  class Stop extends Error { }
  const pos = (): Vec => g.player.char.pos;
  const cap = o.cap ?? 600;
  const meter = () => {
    const c = g.player.char, id = c.id, chest = c.bones?.chest ?? [c.pos[0], c.pos[1] + 1.2, c.pos[2]], eye = c.bones?.head ?? [c.pos[0], c.pos[1] + 1.6, c.pos[2]];
    const E = unseen ? 0 : Math.max(hour.est(chest, id), hour.est(eye, id)), R = g.probe.results as Map<string, number[]>;
    R.clear(); R.set('playerChest', [E, E, E]); R.set('playerHead', [E, E, E]);
  };
  function step(n = 1) {
    for (let i = 0; i < n; i++) {
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k);
      const P = g.player;
      if (goal && !P.down) { const dx = goal[0] - pos()[0], dz = goal[2] - pos()[2], d = Math.hypot(dx, dz);
        if (d > 0.1) { const { fwd, right } = cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827; if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); } }
      if (sprint && goal) I.keys.add('ShiftLeft'); else if (!held.has('ShiftLeft')) I.keys.delete('ShiftLeft');
      for (const k of held) I.keys.add(k);
      meter();
      Wn.__runFrames(1, DT); t += DT; frames++;
      for (const x of [g.player, ...g.guards]) { const p = x.char.pos; if (!Number.isFinite(p[0] + p[1] + p[2])) throw new Error(`NaN position on ${x.callsign ?? 'the player'}`); }
      if (g.player.down && !downSaid) { downSaid = true; say(`   !! the player is down at ${at(pos())}`); }
      if (g.player.down && (downT += DT) > 2) throw new Stop(`the player went down at ${at(pos())} (mission stage ${g.mission.stage})`);
      if (t >= cap) throw new Stop(`time cap (${cap} s) at ${at(pos())}, mission stage ${g.mission.stage}`);
    }
  }
  const until = (pred: () => boolean, secs: number): boolean => { for (let i = 0; i < secs * 60 && !pred(); i++) step(); return pred(); };
  const aim = (p: Vec) => { const [sx, sy, front] = cam.project([p[0], p[1], p[2]], canvas.clientWidth, canvas.clientHeight); if (front) { I.mouseX = sx; I.mouseY = sy; } };
  const door = (nm: string) => { const d = g.doors.byName(nm); if (!d) throw new Stop(`the script names a door '${nm}' the level does not have`); return d; };
  const free = (p: Vec): Vec => { const nav = g.col.nav; const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : [p[0], 0, p[2]]; };
  const doorOnPath = (path: Vec[]): any | null => { let a = pos(); for (const b of path) { let best: any = null, bk = 2;
      for (const d of g.doors.list) { if (!d.isClosed()) continue; const H = d.def.hinge, th = d.def.closedDir, w = d.def.width + 0.15, hx = H[0] - Math.cos(th) * 0.15, hz = H[1] - Math.sin(th) * 0.15, ux = Math.cos(th) * (w + 0.15), uz = Math.sin(th) * (w + 0.15);
        const rx = b[0] - a[0], rz = b[2] - a[2], den = rx * uz - rz * ux; if (Math.abs(den) < 1e-9) continue;
        const k = ((hx - a[0]) * uz - (hz - a[2]) * ux) / den, m = ((hx - a[0]) * rz - (hz - a[2]) * rx) / den; if (k >= 0 && k <= 1 && m >= 0 && m <= 1 && k < bk) { bk = k; best = d; } }
      if (best) return best; a = b; } return null; };
  /** the row of `kind` / `v`: a tap when it is the highlighted one, else Space held, the arrows to it, Space let go — the keys a person would use, so the
   *  choice is on the tape */
  function verb(kind: string, v: string, aimAt?: Vec): boolean {
    const is = (r: any) => !!r && r.kind === kind && r.verb === v;
    for (let i = 0; i < 60; i++) {
      if (aimAt) aim(aimAt); step();
      if (!g.nearby.some(is)) continue;
      if (is(g.hover)) { I.pressed.add('Space'); step(2); say(`  Space: ${kind} ▸ ${v}`); return true; }
      I.pressed.add('Space'); held.add('Space'); let ok = false;
      for (let j = 0; j < 120 && !ok; j++) {
        if (aimAt) aim(aimAt); step();
        if (!g.player.sel.open) continue;
        const rows: any[] = g.nearby, want = rows.findIndex(is); if (want < 0) break;
        if (g.player.sel.ring && want < 5) { I.pressed.add(`Digit${want + 1}`); held.delete('Space'); I.keys.delete('Space'); step(2); say(`  Space held, ${want + 1}: ${kind} ▸ ${v}`); return true; }   // (his rows up as a ring — game/handring.ts: the wedge's digit does it at once)
        if (is(g.hover)) { ok = true; break; }
        I.pressed.add(want > rows.indexOf(g.hover) ? 'ArrowDown' : 'ArrowUp');
      }
      if (!ok) I.pressed.add('Escape');
      held.delete('Space'); I.keys.delete('Space'); step(2);
      if (ok) { say(`  Space held, to the row, let go: ${kind} ▸ ${v}`); return true; }
    }
    say(`  no '${kind} ▸ ${v}' row (rows: ${g.nearby.map((r: any) => `${r.kind}:${r.verb}`).join(' ') || 'none'})`); return false;
  }
  function openDoor(nm: string, v = 'push'): boolean {
    const d = door(nm); if (!d.isClosed()) return true;
    const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), s = (pos()[0] - c[0]) * nx + (pos()[2] - c[2]) * nz >= 0 ? 1 : -1;
    walk(free([c[0] + nx * s * 0.95, 0, c[2] + nz * s * 0.95]), 25, { stop: () => !d.isClosed(), noDoors: true }); if (!d.isClosed()) return true;
    if (!verb('door', v, [c[0], 1.0, c[2]])) return false;
    until(() => !d.isClosed(), 6); step(20); return !d.isClosed();
  }
  function walk(p: Vec, max: number, w: { stop?: () => boolean; sprint?: boolean; doorVerb?: string; near?: number; noDoors?: boolean } = {}, again = 0): boolean {
    const path: Vec[] = g.col.nav.findPath(pos(), p, 8000) ?? [p]; if (!path.length || flat(path[path.length - 1], p) > 0.05) path.push(p);
    if (!w.noDoors) { const d = doorOnPath(path); if (d && flat(pos(), d.frameCentre) < 40) { const was = sprint; sprint = false; const ok = openDoor(d.def.name, w.doorVerb ?? 'push'); sprint = was; if (!ok) { say(`  door ${d.def.name} would not open`); return false; } return walk(p, max, w, again); } }
    const t0 = t; let mark = [...pos()], markT = t; sprint = !!w.sprint;
    try {
      for (const wp of path) { goal = [wp[0], 0, wp[2]];
        while (flat(pos(), wp) > (wp === path[path.length - 1] ? (w.near ?? 0.3) : 0.55)) {
          aim([wp[0], 1.1, wp[2]]); step(); if (t - t0 > max) return false; if (w.stop && w.stop()) return false;
          if (flat(pos(), mark) > 0.15) { mark = [...pos()]; markT = t; } else if (t - markT > 1.5) {
            if (again >= 5) { say(`  stuck at ${at(pos())} short of ${at(wp)}`); return false; }
            const dx = wp[0] - pos()[0], dz = wp[2] - pos()[2], Ln = Math.hypot(dx, dz) || 1, sd = again % 2 ? -1 : 1, r = 0.9 + 0.25 * again;
            goal = [pos()[0] + dz / Ln * sd * r, 0, pos()[2] - dx / Ln * sd * r]; step(35);
            return walk(p, max - (t - t0), w, again + 1); } } }
      return true;
    } finally { goal = null; sprint = false; }
  }
  const B: Bot = {
    g, I, W: { canvas, cursorAt: (p: Vec) => aim(p) } as never, cam, t: () => t, pos, step, until, aim, verb, openDoor, door, say,
    wait: (secs) => step(Math.round(secs * 60)),
    press: (code, after = 1) => { I.pressed.add(code); step(1 + after); },
    hold: (codes, secs, stop) => { for (const c of codes) held.add(c); try { for (let i = 0; i < secs * 60; i++) { step(); if (stop && stop()) break; } } finally { for (const c of codes) { held.delete(c); I.keys.delete(c); } } },
    click: (button = 1, p) => { if (p) { aim(p); step(); if (p) aim(p); } I.clicked |= button === 2 ? 4 : 1; step(2); },
    wheel: (n) => { for (let i = 0; i < Math.abs(n); i++) { I.wheel += Math.sign(n) * 100; step(2); } },
    go: (p, max = 40, w = {}) => walk(free(p), max, w),
    nudge: (p, secs, stop) => { goal = [p[0], 0, p[2]]; try { for (let i = 0; i < secs * 60; i++) { aim([p[0], 1.1, p[2]]); step(); if (stop && stop()) break; } } finally { goal = null; } },
    crouch: (on) => { for (let i = 0; i < 3 && !!g.player.crouch !== on; i++) { I.pressed.add('KeyC'); step(4); } },
    fail: (why) => { throw new Stop(why); },
  };

  const idleOk = new Set<string>(script.idleOk ?? []), pace = o.pace ?? 0;
  try {
    step(20);
    if (!lesson) { script.free!(B); step(60); }
    else {
      for (let i = 0; i < L.steps.length; i++) {
        const T = L.steps[i];
        if (g.lesson.i !== i) throw new Stop(`step ${i + 1} '${T.id}' is not the step that is up (the lesson is on ${g.lesson.i + 1}: ${g.lesson.summary()})`);
        step(30);
        if (g.lesson.i !== i && !idleOk.has(T.id)) throw new Stop(`step ${i + 1} '${T.id}' went by with nothing done`);
        if (pace > 0) step(Math.round(pace * 60));
        say(`step ${i + 1}/${L.steps.length} '${T.id}': ${T.line}`);
        script.steps![T.id](B);
        step(30);
        if (g.lesson.i <= i) throw new Stop(`step ${i + 1} '${T.id}' did not go by after its script (player at ${at(pos())}, stage ${g.mission.stage}; test ${JSON.stringify(T.done)})`);
        out.steps.push({ id: T.id, t: Number(t.toFixed(2)) });
        if (g.player.down) throw new Stop(`the player went down in step '${T.id}'`);
      }
      if (!g.lesson.finished) throw new Stop('the lesson does not say it is finished after its last step');
      say('every step done; playing the mission out');
      const ended = script.ended ?? ((gg: any) => gg.mission.stage === 'done');
      if (!ended(g)) script.finish?.(B);
      if (!until(() => ended(g), 5)) throw new Stop(`the run did not end after the script's finish (stage ${g.mission.stage}, player at ${at(pos())}${g.player.down ? ', DOWN' : ''})`);
      say(`ended: ${g.objectiveText()}`);
      step(90);   // the end's own sounds, and a beat for whoever watches
    }
  } catch (e) {
    out.code = 1; out.why = e instanceof Stop ? e.message : `threw: ${(e as Error).stack ?? e}`;
    if (lesson) lines.push(...(g.lesson.log as string[]).slice(-6).map(l => `   lesson log: ${l}`));
  }
  out.secs = Number(t.toFixed(1)); out.frames = frames;
  return out;
}

Wn.__tapeBot = {
  names: [...Object.keys(LESSONS), ...Object.keys(FREE)],
  /** the page each script is recorded on (its query, without the '?') and what the replay is called */
  pages: Object.fromEntries([...Object.entries(LESSONS).map(([n, s]) => [n, { query: `levelFile=${n}.json&${String(s.query ?? '?quiet').replace(/^\?/, '')}`, title: '' }]),
    ...Object.entries(FREE).map(([n, s]) => [n, { query: String(s.query ?? '').replace(/^\?/, ''), title: s.title ?? n }])]),
  run,
};
