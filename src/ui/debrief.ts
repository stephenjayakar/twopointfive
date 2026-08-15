// The debrief card's contents (menu.ts hosts it: the end card on mission complete, the down card a beat after Sam drops, and the pause card's 'Run so far' tab):
// the rating word big with the score beside it, what the score was docked for, a compact stats grid, the badges as chips (lit / dim), the floor map — the nav
// grid's walkable cells drawn light on dark, Sam's path over it coloured by the clock, a pin per notable event with its timeline row on hover, spawn / rack / exit
// marked — and the timeline itself as a scrollable list. Everything read comes from game/chronicle.ts (debriefOf: counts, score, badges, summary; the events; the
// path) so the QA probes see the same numbers the card shows. Plain DOM, styled in index.html (#menu .db-…); builds headlessly too (no canvas context: the map's
// pins and marks still land, the cells and the path are simply not painted).
import type { Game } from '../game/game';
import { debriefOf, fmtEvent, fmtMMSS, pinned, PIN, roomOf, indoors, ROOMS, eventText } from '../game/chronicle';
import type { Debrief, ChronEvent } from '../game/chronicle';

/** the map's width in CSS px at most (the canvas is drawn at the nav grid's own resolution × an integer and scaled by CSS to the column it sits in) */
const MAP_MAX_W = 420;
/** a path segment longer than this between two half-second samples was a teleport / a restart artefact, not a walk: drawn as a gap */
const PATH_GAP_M = 3.5;

export interface DebriefUi { root: HTMLElement; debrief: Debrief; copyText: string; }

/** Build the card body into `into` for the run as it stands. `actions` (buttons) are the host's — passed in so the end card, the down card and the pause tab can each
 *  have their own; the 'copy summary' button is added here after them. Returns the record it rendered (the host words its header off it too). */
export function renderDebrief(into: HTMLElement, game: Game, actions: HTMLElement[] = []): DebriefUi {
  const D = debriefOf(game); const C = game.chronicle; const c = D.counts;
  const root = el('div', 'db'); into.appendChild(root);
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
  const copyText = D.summary;
  const copy = el('button', 'btn db-copy') as HTMLButtonElement; copy.textContent = 'Copy summary'; copy.title = copyText;
  copy.onclick = () => { const done = (ok: boolean) => { copy.textContent = ok ? 'Copied' : 'Select + copy ↓'; if (!ok) { note.textContent = copyText; note.classList.add('show'); } setTimeout(() => { copy.textContent = 'Copy summary'; }, 1600); };
    try { const cb = (globalThis as any).navigator?.clipboard; if (cb?.writeText) cb.writeText(copyText).then(() => done(true), () => done(false)); else done(false); } catch { done(false); } };
  acts.appendChild(copy); root.appendChild(acts);
  const note = el('div', 'db-copytext'); root.appendChild(note);   // the line itself, shown if the clipboard says no (an http page, a refused permission): select it by hand
  // ---- two columns: numbers + badges + timeline | map + legend
  const grid = el('div', 'db-grid'); root.appendChild(grid);
  const left = el('div', 'db-left'), right = el('div', 'db-right'); grid.append(left, right);
  // stats grid
  const stats = el('div', 'db-stats'); left.appendChild(stats);
  const st = (k: string, v: string | number, cls = '', title = '') => { const s = el('div', `st${cls ? ' ' + cls : ''}`); const i = el('i'); i.textContent = k; const b = el('b'); b.textContent = String(v); s.append(i, b); if (title) s.title = title; stats.appendChild(s); };
  st('time', fmtMMSS(c.elapsed)); st('seen', c.seen ? `×${c.seen}` : '0', c.seen ? 'bad' : 'good', 'sighting episodes: an alert man with eyes on you');
  st('alarms', c.alarms, c.alarms ? 'bad' : 'good', 'alarm episodes (somebody went to alert while nobody was)'); st('floor up', c.esc1 + c.esc2 ? `×${c.esc1 + c.esc2}` : '0', c.esc2 ? 'bad' : c.esc1 ? 'warn' : 'good', 'times the floor went to heightened / lockdown');
  st('bodies found', c.bodies, c.bodies ? 'warn' : ''); st('KOs', c.kos, '', 'men put down breathing: the takedown, the choke, the whip, a ring to the head'); st('kills', c.kills, c.kills ? 'bad' : 'good');
  st('shots', c.shots, '', `${c.shotsNearMen} of them into or near a man`); st('OCP', c.ocps); st('lights shot', c.lightsShot);
  st('doors kicked', c.kicked, c.kicked ? 'warn' : ''); st('locks picked', c.picked); st('keys', c.keys); st('intel', c.intel, '', `${c.questioned} of ${c.roster} men questioned`); st('called in by security', c.devices, c.devices ? 'warn' : '', 'a camera or a tripwire radioed you in');
  if (c.thrown) st('canisters', c.thrown); if (c.hits) st('hits taken', c.hits, 'bad'); if (c.loads) st('checkpoint loads', c.loads, 'warn'); if (c.blackout) st('blackout', 'used');
  if (c.civSeen || c.civReported || c.civKO || c.civKilled || c.civComplied) { st('civilians saw you', c.civSeen, c.civSeen ? 'warn' : 'good', 'times the cleaner / the late worker laid eyes on you (or had your hand on them)'); st('…and told them', c.civReported, c.civReported ? 'bad' : 'good', 'reports that reached the men: told to a guard, rung in, or control ringing the floor after she got out'); if (c.civComplied) st('told to stay down', c.civComplied); if (c.civKO) st('civilian KOs', c.civKO, 'bad', 'civilians you put out cold — priced hard'); if (c.civKilled) st('CIVILIANS KILLED', c.civKilled, 'bad'); }   // (the civilians' block only on a run that met one — civilians.ts)
  // badges
  const badges = el('div', 'db-badges'); left.appendChild(badges);
  for (const b of D.badges) { const chip = el('span', `chip${b.on ? ' on' : ''}`); chip.textContent = b.name; chip.title = b.hint; badges.appendChild(chip); }
  // timeline
  const tlHead = el('div', 'gtitle db-tlhead'); tlHead.textContent = `timeline · ${C.events.length} entr${C.events.length === 1 ? 'y' : 'ies'}${C.dropped ? ` (${C.dropped} more not kept)` : ''}`; left.appendChild(tlHead);
  const tl = el('div', 'db-timeline'); left.appendChild(tl);
  if (!C.events.length) { const e0 = el('div', 'ev empty'); e0.textContent = 'nothing yet — nobody has noticed a thing'; tl.appendChild(e0); }
  for (const e of C.events) { const row = el('div', `ev k-${e.kind}${e.kind === 'alarm' && !e.data.up ? ' down' : ''}`); const t = el('i'); t.textContent = fmtMMSS(e.t); const r = el('u'); r.textContent = e.room; const x = el('span'); x.textContent = eventText(e); row.append(t, r, x); tl.appendChild(row); }
  // map + legend
  right.appendChild(buildMap(game, C.events));
  const legend = el('div', 'db-legend');
  const seenLabels = new Set<string>();
  for (const k of Object.keys(PIN) as (keyof typeof PIN)[]) { const p = PIN[k]!; if (seenLabels.has(p.label)) continue; seenLabels.add(p.label); const s = el('span', `lg ${p.cls}`); const g = el('i'); g.textContent = p.glyph; s.append(g, ` ${p.label}`); legend.appendChild(s); }
  for (const [g, label] of [['S', 'insertion'], ['◎', 'the rack'], ['⇥', 'fire exit']] as const) { const s = el('span', 'lg mark'); const i = el('i'); i.textContent = g; s.append(i, ` ${label}`); legend.appendChild(s); }
  { const s = el('span', 'lg path'); const i = el('i'); i.textContent = '━'; s.append(i, ' his path, early → late'); legend.appendChild(s); }
  right.appendChild(legend);
  return { root, debrief: D, copyText };
}

/** The floor map: a canvas at the nav grid's resolution (walkable cells light — lighter indoors — blocked dark, so walls read as lines and doorways as gaps), the
 *  path as a polyline coloured by the clock (teal early → amber late; a jump longer than PATH_GAP_M is left as a gap), spawn / rack / exit marks; over it, one
 *  absolutely-placed glyph per pinned event (its timeline row as the tooltip), and the room under the cursor as the box's own tooltip. */
function buildMap(game: Game, events: ChronEvent[]): HTMLElement {
  const box = el('div', 'db-map'); const nav = game.col.nav; const W = nav.W, H = nav.H, cell = nav.cell;
  const wx = W * cell, wz = H * cell;   // world extent covered (40 × 28 m)
  const px = Math.max(2, Math.floor(MAP_MAX_W / W));   // canvas px per nav cell
  const cv = el('canvas', 'db-canvas') as HTMLCanvasElement; cv.width = W * px; cv.height = H * px; box.appendChild(cv);
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = typeof cv.getContext === 'function' ? cv.getContext('2d') : null; } catch { ctx = null; }
  if (ctx) {
    ctx.fillStyle = '#050b09'; ctx.fillRect(0, 0, cv.width, cv.height);
    const p: [number, number, number] = [0, 0, 0];
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const blocked = nav.blocked[z * W + x] === 1; p[0] = (x + 0.5) * cell; p[2] = (z + 0.5) * cell;
      ctx.fillStyle = blocked ? (indoors(p) ? '#0d1a16' : '#070e0c') : indoors(p) ? 'rgba(121,214,154,0.22)' : 'rgba(121,214,154,0.07)';
      ctx.fillRect(x * px, z * px, px, px);
    }
    // room names, faint, centred in each room
    ctx.font = `${Math.max(8, px * 1.8)}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(190,240,210,0.32)';
    for (const r of ROOMS) ctx.fillText(r.name.replace(/ room$| office$/, ''), ((r.x0 + r.x1) / 2 / cell) * px, ((r.z0 + r.z1) / 2 / cell) * px);
    // the path
    const C = game.chronicle, P = C.path, n = C.pathN; const T = Math.max(1e-3, n ? P[(n - 1) * 3 + 2] : 1);
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
  mark('S', 'spawn', L.playerSpawn[0], L.playerSpawn[2], 'insertion point');
  mark('◎', 'rack', M.rack.front[0], M.rack.front[2], `rack ${M.rack.index + 1} — the drive`);
  { const ex = game.doors.byName(M.exfilDoor)?.frameCentre; if (ex) mark('⇥', 'exit', ex[0], ex[2], 'the fire exit'); }
  for (const e of events) { if (!pinned(e)) continue; const p = PIN[e.kind]!; const pin = el('i', `pin ${p.cls}`); pin.textContent = p.glyph; pin.title = fmtEvent(e); place(pin, e.pos[0], e.pos[2]); }
  // the room under the cursor
  box.title = 'the floor';
  (box as any).onmousemove = (ev: MouseEvent) => { const r = cv.getBoundingClientRect?.(); if (!r || !r.width) return; const x = (ev.clientX - r.left) / r.width * wx, z = (ev.clientY - r.top) / r.height * wz; if (x >= 0 && z >= 0 && x < wx && z < wz) box.title = roomOf([x, 0, z]); };
  return box;
}
/** teal at the start of the run through green to amber at its end */
function pathColour(u: number): string { const h = 170 - 130 * Math.min(1, Math.max(0, u)); return `hsl(${h.toFixed(0)}, 78%, ${(52 + 10 * u).toFixed(0)}%)`; }

function el(tag: string, cls?: string) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
