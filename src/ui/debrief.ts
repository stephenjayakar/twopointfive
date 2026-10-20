// The debrief card's contents (menu.ts hosts it: the end card on mission complete, the down card a beat after Sam drops, and the pause card's 'Run so far' tab):
// the rating word big with the score beside it, what the score was docked for, a compact stats grid, the badges as chips (lit / dim), the floor map — the nav
// grid's walkable cells drawn light on dark, Sam's path over it coloured by the clock, a pin per notable event with its timeline row on hover, spawn / rack / exit
// marked — and the timeline itself as a scrollable list. Everything read comes from game/chronicle.ts (debriefOf: counts, score, badges, summary; the events; the
// path) so the QA probes see the same numbers the card shows. Plain DOM, styled in index.html (#menu .db-…); builds headlessly too (no canvas context: the map's
// pins and marks still land, the cells and the path are simply not painted).
import { gearText } from '../game/gear';
import type { Game } from '../game/game';
import { mountRecap } from './recap';
import { quietWords } from '../game/quiet';
import { debriefOf, fmtEvent, fmtMMSS, pinned, PIN, roomOf, indoors, roomsOf, ROOMS, eventText } from '../game/chronicle';
import type { Debrief, ChronEvent } from '../game/chronicle';
import { verdictLine, type RunVerdict } from '../game/verdict';
import { verdictHead, verdictMen, verdictSlot, verdictPanels, squadVerdict, fellWords } from './verdictCard';

/** the map's width in CSS px at most (the canvas is drawn at the nav grid's own resolution × an integer and scaled by CSS to the column it sits in) */
const MAP_MAX_W = 420;
/** a path segment longer than this between two half-second samples was a teleport / a restart artefact, not a walk: drawn as a gap */
const PATH_GAP_M = 3.5;

export interface DebriefUi { root: HTMLElement; debrief: Debrief; copyText: string; }

/** Build the card body into `into` for the run as it stands. `actions` (buttons) are the host's — passed in so the end card, the down card and the pause tab can each
 *  have their own; the 'copy summary' button is added here after them. Returns the record it rendered (the host words its header off it too). */
/** the death recap as a panel of the verdict's slot (verdictCard.ts verdictPanels): under the men's rows on a squad's card. Put on the list at the first card
 *  drawn, never as this module loads; `recapIn` = it drew this time, so the map's column does not get a second one. */
let recapIn = false;
const recapPanel = (slot: HTMLElement, game: Game): void => { if (mountRecap(slot, game)) recapIn = true; };
export function renderDebrief(into: HTMLElement, game: Game, actions: HTMLElement[] = []): DebriefUi {
  const D = debriefOf(game); const C = game.chronicle; const c = D.counts;
  const root = el('div', 'db'); into.appendChild(root);
  // ---- the verdict (game/verdict.ts), once the run is over: its head leads the card. A squad's mission then shows the men (their rows, their paths) where the
  // stealth game's rating, numbers and timeline stand — those are built all the same and hidden by the card's class (index.html .vd-squad): one builder, and
  // the stealth game's card keeps every part it had under the verdict's head. No verdict (the run still going, the switch off) = the card as it was.
  const V = game.verdict?.result ?? null, squad = !!V && squadVerdict(V);
  if (V) { root.classList.add('vd-on', squad ? 'vd-squad' : 'vd-solo'); root.appendChild(verdictHead(game, V, game.verdict.kept)); }
  // ---- header: the word, the score, what it is, what it cost
  const head = el('div', 'db-head');
  const rate = el('div', `db-rating r-${D.rating.toLowerCase()}`); const w = el('b'); w.textContent = D.rating; const sc = el('span', 'db-score'); sc.textContent = String(D.score); rate.append(w, sc);
  rate.title = D.lines.length ? D.lines.map(l => `−${l.pts}  ${l.label}`).join('\n') : 'nothing docked';
  const what = el('div', 'db-what');
  const t1 = el('div', 'db-t1'); t1.textContent = D.state === 'done' ? 'mission complete' : D.state === 'down' ? (c.down ? "you're down" : c.civKilled ? 'mission failed — a civilian is dead' : 'mission failed') : 'run so far';   // (failed on his feet: a civilian dead by his hand with the fail rule on — civilians.ts)
  const t2 = el('div', 'db-t2'); t2.textContent = `${fmtMMSS(c.elapsed)} on the clock · ${D.blurb}${c.sandbox ? ' · sandbox flags were on' : ''}`;
  const t3 = el('div', 'db-t3'); t3.textContent = D.lines.length ? D.lines.slice(0, 5).map(l => `−${l.pts} ${l.label}`).join('  ·  ') + (D.lines.length > 5 ? '  ·  …' : '') : 'a hundred, and nothing taken off it';
  what.append(t1, t2, t3); head.append(rate, what); root.appendChild(head);
  // ---- actions (the host's) + copy summary
  const acts = el('div', 'actions db-actions'); for (const a of actions) acts.appendChild(a);
  const copyText = V && squad ? verdictLine(V, game.verdict.kept) : D.summary;
  const copy = el('button', 'btn db-copy') as HTMLButtonElement; copy.textContent = 'Copy summary'; copy.title = copyText;
  copy.onclick = () => { const done = (ok: boolean) => { copy.textContent = ok ? 'Copied' : 'Select + copy ↓'; if (!ok) { note.textContent = copyText; note.classList.add('show'); } setTimeout(() => { copy.textContent = 'Copy summary'; }, 1600); };
    try { const cb = (globalThis as any).navigator?.clipboard; if (cb?.writeText) cb.writeText(copyText).then(() => done(true), () => done(false)); else done(false); } catch { done(false); } };
  acts.appendChild(copy); root.appendChild(acts);
  const note = el('div', 'db-copytext'); root.appendChild(note);   // the line itself, shown if the clipboard says no (an http page, a refused permission): select it by hand
  // ---- two columns: numbers + badges + timeline | map + legend
  const grid = el('div', 'db-grid'); root.appendChild(grid);
  const left = el('div', 'db-left'), right = el('div', 'db-right'); grid.append(left, right);
  recapIn = false; if (!verdictPanels.includes(recapPanel)) verdictPanels.push(recapPanel);
  if (V && (squad || V.of > 1)) { left.appendChild(verdictMen(game, V)); const slot = verdictSlot(game, V); if (slot) left.appendChild(slot); else recapIn = false; }
  // stats grid
  const stats = el('div', 'db-stats'); left.appendChild(stats);
  const st = (k: string, v: string | number, cls = '', title = '') => { const s = el('div', `st${cls ? ' ' + cls : ''}`); const i = el('i'); i.textContent = k; const b = el('b'); b.textContent = String(v); s.append(i, b); if (title) s.title = title; stats.appendChild(s); };
  { const P = game.par?.result(); if (P) st('par', P.medal === 'none' ? 'no medal' : P.medal, P.medal === 'none' ? 'warn' : 'good', game.par.shown ?? P.line); }   // (a level with a par block, its room clear taken: game/par.ts — one cell; the best time on its line is the page's, main.ts)
  st('time', fmtMMSS(c.elapsed)); st('seen', c.seen ? `×${c.seen}` : '0', c.seen ? 'bad' : 'good', 'sighting episodes: an alert man with eyes on you');
  st('alarms', c.alarms, c.alarms ? 'bad' : 'good', 'alarm episodes (somebody went to alert while nobody was)'); st('floor up', c.esc1 + c.esc2 ? `×${c.esc1 + c.esc2}` : '0', c.esc2 ? 'bad' : c.esc1 ? 'warn' : 'good', 'times the floor went to heightened / lockdown');
  st('bodies found', c.bodies, c.bodies ? 'warn' : ''); st('KOs', c.kos, '', gearText('men put down breathing: the takedown, the choke, the whip, a ring to the head')); st('kills', c.kills, c.kills ? 'bad' : 'good');
  st('shots', c.shots, '', `${c.shotsNearMen} of them into or near a man`); st('OCP', c.ocps); st('lights shot', c.lightsShot);
  st('doors kicked', c.kicked, c.kicked ? 'warn' : ''); st('locks picked', c.picked); st('keys', c.keys); st('intel', c.intel, '', `${c.questioned} of ${c.roster} men questioned`); st('called in', c.devices, c.devices ? 'warn' : '', 'a camera or a tripwire radioed you in');
  if (c.thrown) st('thrown', c.thrown, '', 'smoke and stun canisters, frag grenades, and 40 mm grenades off the launcher'); if (c.hits) st('hits taken', c.hits, 'bad'); if (c.loads) st('checkpoint loads', c.loads, 'warn'); if (c.blackout) st('blackout', 'used');
  if (c.civSeen || c.civReported || c.civKO || c.civKilled || c.civComplied) { st('civilians saw you', c.civSeen, c.civSeen ? 'warn' : 'good', 'times the cleaner / the late worker laid eyes on you (or had your hand on them)'); st('…and told them', c.civReported, c.civReported ? 'bad' : 'good', 'reports that reached the men: told to a guard, rung in, or control ringing the floor after she got out'); if (c.civComplied) st('told to stay down', c.civComplied); if (c.civKO) st('civilian KOs', c.civKO, 'bad', 'civilians you put out cold — priced hard'); if (c.civKilled) st('CIVILIANS KILLED', c.civKilled, 'bad'); }   // (the civilians' block only on a run that met one — civilians.ts)
  // badges
  const badges = el('div', 'db-badges'); left.appendChild(badges);
  for (const b of D.badges) { const chip = el('span', `chip${b.on ? ' on' : ''}`); chip.textContent = b.name; chip.title = b.hint; badges.appendChild(chip); }
  // timeline
  const tlHead = el('div', 'gtitle db-tlhead'); tlHead.textContent = `timeline · ${C.events.length} entr${C.events.length === 1 ? 'y' : 'ies'}${C.dropped ? ` (${C.dropped} more not kept)` : ''}`; left.appendChild(tlHead);
  const tl = el('div', 'db-timeline'); left.appendChild(tl);
  if (!C.events.length) { const e0 = el('div', 'ev empty'); e0.textContent = 'nothing yet — nobody has noticed a thing'; tl.appendChild(e0); }
  for (const e of C.events) { const row = el('div', `ev k-${e.kind}${e.kind === 'alarm' && !e.data.up ? ' down' : ''}`); const t = el('i'); t.textContent = fmtMMSS(e.t); const r = el('u'); r.textContent = e.room; const x = el('span'); x.textContent = eventText(e, game); row.append(t, r, x); tl.appendChild(row); }
  // map + legend
  if (!recapIn) mountRecap(right, game);   // every death explains itself (ui/recap.ts): who shot whom, from where — nothing while the run is still on. Over the map unless the verdict's slot took it
  right.appendChild(buildMap(game, C.events, V));
  const legend = el('div', 'db-legend');
  const seenLabels = new Set<string>();
  for (const k of Object.keys(PIN) as (keyof typeof PIN)[]) { const p = PIN[k]!; if (seenLabels.has(p.label)) continue; seenLabels.add(p.label); const s = el('span', `lg ${p.cls}`); const g = el('i'); g.textContent = p.glyph; s.append(g, ` ${p.label}`); legend.appendChild(s); }
  for (const [g, label] of [['S', 'insertion'], ['◎', quietWords(game)?.holder ?? 'the rack'], ['⇥', quietWords(game) ? 'a way out' : 'fire exit']] as const) { const s = el('span', 'lg mark'); const i = el('i'); i.textContent = g; s.append(i, ` ${label}`); legend.appendChild(s); }
  { const s = el('span', 'lg path'); const i = el('i'); i.textContent = '━'; s.append(i, ' his path, early → late'); legend.appendChild(s); }
  right.appendChild(legend);
  return { root, debrief: D, copyText };
}

/** The floor map: a canvas at the nav grid's resolution (walkable cells light — lighter indoors — blocked dark, so walls read as lines and doorways as gaps), the
 *  path as a polyline coloured by the clock (teal early → amber late; a jump longer than PATH_GAP_M is left as a gap), spawn / rack / exit marks; over it, one
 *  absolutely-placed glyph per pinned event (its timeline row as the tooltip), and the room under the cursor as the box's own tooltip. */
function buildMap(game: Game, events: ChronEvent[], V: RunVerdict | null = null): HTMLElement {
  const box = el('div', 'db-map'); const nav = game.col.nav; const W = nav.W, H = nav.H, cell = nav.cell;
  const wx = W * cell, wz = H * cell;   // world extent covered (40 × 28 m)
  const px = Math.max(2, Math.floor(MAP_MAX_W / W));   // canvas px per nav cell
  const cv = el('canvas', 'db-canvas') as HTMLCanvasElement; cv.width = W * px; cv.height = H * px; box.appendChild(cv);
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = typeof cv.getContext === 'function' ? cv.getContext('2d') : null; } catch { ctx = null; }
  if (ctx) {
    ctx.fillStyle = '#0c0b09'; ctx.fillRect(0, 0, cv.width, cv.height);
    const p: [number, number, number] = [0, 0, 0];
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const blocked = nav.blocked[z * W + x] === 1; p[0] = (x + 0.5) * cell; p[2] = (z + 0.5) * cell;
      ctx.fillStyle = blocked ? (indoors(p) ? '#1c1a16' : '#100f0c') : indoors(p) ? 'rgba(214,200,170,0.2)' : 'rgba(214,200,170,0.07)';
      ctx.fillRect(x * px, z * px, px, px);
    }
    // room names, faint, centred in each room
    ctx.font = `${Math.max(8, px * 1.8)}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(214,210,200,0.34)';
    const short = roomsOf(game.level) === ROOMS ? / room$| office$/ : /$^/;   // (the office's table is shortened to fit; another level's names are drawn whole — "registrar's" is no label)
    for (const r of roomsOf(game.level)) ctx.fillText(r.name.replace(short, ''), ((r.x0 + r.x1) / 2 / cell) * px, ((r.z0 + r.z1) / 2 / cell) * px);
    // the team's paths under a verdict: every man's in his own colour (a squad's mission: the player's too — the clock-coloured line below is the stealth game's)
    if (V) { const squad = squadVerdict(V); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (squad) { ctx.fillStyle = 'rgba(255,156,132,0.75)'; const r = Math.max(1.5, px * 0.45); for (let i = 0; i + 1 < V.foes.fell.length; i += 2) ctx.fillRect(V.foes.fell[i] / cell * px - r, V.foes.fell[i + 1] / cell * px - r, r * 2, r * 2); }   // where each defender fell: a small square
      for (const m of V.men) { if (m.human && !squad) continue; const P = m.path; ctx.lineWidth = Math.max(1.2, px * (m.human ? 0.42 : 0.32)); ctx.strokeStyle = TONE[m.tone ?? 'mate']; ctx.beginPath();
        for (let i = 0; i + 2 < P.length; i += 3) { const x = P[i] / cell * px, z = P[i + 1] / cell * px; if (i === 0 || Math.hypot(P[i] - P[i - 3], P[i + 1] - P[i - 2]) > PATH_GAP_M) ctx.moveTo(x, z); else ctx.lineTo(x, z); }
        ctx.stroke();
        if (m.state === 'up' && P.length >= 3) { ctx.fillStyle = TONE[m.tone ?? 'mate']; ctx.beginPath(); ctx.arc(P[P.length - 3] / cell * px, P[P.length - 2] / cell * px, px * 0.6, 0, Math.PI * 2); ctx.fill(); } } }
    // the path
    const C = game.chronicle, P = C.path, n = V && squadVerdict(V) ? 0 : C.pathN; const T = Math.max(1e-3, n ? P[(n - 1) * 3 + 2] : 1);
    ctx.lineWidth = Math.max(1.5, px * 0.45); ctx.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      const x0 = P[(i - 1) * 3], z0 = P[(i - 1) * 3 + 1], x1 = P[i * 3], z1 = P[i * 3 + 1], t = P[i * 3 + 2];
      if (Math.hypot(x1 - x0, z1 - z0) > PATH_GAP_M) continue;
      ctx.strokeStyle = pathColour(t / T); ctx.beginPath(); ctx.moveTo(x0 / cell * px, z0 / cell * px); ctx.lineTo(x1 / cell * px, z1 / cell * px); ctx.stroke();
    }
    if (n) { ctx.fillStyle = pathColour(1); ctx.beginPath(); ctx.arc(P[(n - 1) * 3] / cell * px, P[(n - 1) * 3 + 1] / cell * px, px * 0.7, 0, Math.PI * 2); ctx.fill(); }   // where he is / ended up
  }
  // marks + pins as DOM over the canvas (percent-placed, so they follow the CSS-scaled canvas)
  const place = (node: HTMLElement, x: number, z: number) => { node.style.left = `${(x / wx * 100).toFixed(2)}%`; node.style.top = `${(z / wz * 100).toFixed(2)}%`; box.appendChild(node); };
  const L = game.level, M = L.mission;
  const mark = (g: string, cls: string, x: number, z: number, title: string) => { const m = el('i', `mark ${cls}`); m.textContent = g; m.title = title; place(m, x, z); };
  { const at = game.roomClear?.startAt ?? L.playerSpawn; mark('S', 'spawn', at[0], at[2], 'insertion point'); }   // (a room clear stands Sam on its team start — and on a level with two ways in, on the one this visit took)
  const QW = quietWords(game);   // (a quiet mission: its own holder, thing and ways out — game/quiet.ts; null on the plain night)
  mark('◎', 'rack', M.rack.front[0], M.rack.front[2], QW ? `${QW.holder} — ${QW.thing}` : `rack ${M.rack.index + 1} — the drive`);
  if (QW) { for (const X of game.quiet.exits) { const ex = game.doors.byName(X.door)?.frameCentre ?? [X.x, 0, X.z]; mark('⇥', 'exit', ex[0], ex[2], X.name); } }
  else { const ex = game.doors.byName(M.exfilDoor)?.frameCentre; if (ex) mark('⇥', 'exit', ex[0], ex[2], 'the fire exit'); }
  for (const e of events) { if (!pinned(e)) continue; const p = PIN[e.kind]!; const pin = el('i', `pin ${p.cls}`); pin.textContent = p.glyph; pin.title = fmtEvent(e, game); place(pin, e.pos[0], e.pos[2]); }
  if (V) for (const m of V.men) { if (!m.downPos || (m.human && !squadVerdict(V))) continue; const x = el('i', `vfell t-${m.tone ?? 'mate'}`); x.textContent = m.state === 'dead' ? '✕' : m.state === 'wounded' ? '✚' : 'z'; x.title = fellWords(m); place(x, m.downPos[0], m.downPos[1]); }   // (where each man of the team fell; not a `mark`: the three marks are the level's)
  // the room under the cursor
  box.title = 'the floor';
  (box as any).onmousemove = (ev: MouseEvent) => { const r = cv.getBoundingClientRect?.(); if (!r || !r.width) return; const x = (ev.clientX - r.left) / r.width * wx, z = (ev.clientY - r.top) / r.height * wz; if (x >= 0 && z >= 0 && x < wx && z < wz) box.title = roomOf([x, 0, z], game.level); };
  return box;
}
/** teal at the start of the run through green to amber at its end */
/** a man's colour on the map (the rows' colours: index.html .vd-man.t-…) */
const TONE: Record<string, string> = { you: '#f0e9d9', red: '#c9655b', blue: '#5b8fc9', mate: '#b7a98a' };
function pathColour(u: number): string { const h = 170 - 130 * Math.min(1, Math.max(0, u)); return `hsl(${h.toFixed(0)}, 78%, ${(52 + 10 * u).toFixed(0)}%)`; }

function el(tag: string, cls?: string) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
