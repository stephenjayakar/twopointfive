/** EVERY DEATH EXPLAINS ITSELF — the end card's panel (the game's half is game/deathrecap.ts, which decides WHETHER anything may be shown: nothing while
 *  anybody still plays).
 *
 *  One small plan of the floor round the man who went down, fog lifted: every man where he stood, the man who did it and the round's line in the card's one
 *  orange, the lost man's gaze as a wedge (so 'shot from behind' is seen, not said). Under it three labels — who, with what, from how far — and no sentence.
 *
 *  IT PLAYS: the last seconds before he fell run at the speed they happened (never slowed), on past the fall for the moment kept after it, hold on the
 *  picture of who did it, and start again. A line along the foot is the clock, its orange tick the fall. More than one of ours lost = a chip a man, by name.
 *  Still (the moment of the fall alone) where the viewer asks for less motion or the host has no frame clock.
 *  The clock is the display's (never the game's: the card is up over a stopped run), a picture at most every PAINT_MS; it sleeps while the card is put away and
 *  stops for good once the card is unbuilt. `__recap` on the window = the panel on the card now (`seek(k)` a moment as a still, `show(i)`, `take`).
 *
 *  `mountRecap(host, game)` is the whole face: it appends the panel to `host` and returns it, or returns null with nothing appended when there is nothing to
 *  show (the switch off, the run still on, nobody of ours down). `drawRecap` draws one moment `t` of a take; `recapMenAt` is where every man was then. */
import type { Game } from '../game/game';
import { deathRecapOf, MAN_STRIDE } from '../game/deathrecap';
import type { RecapTake, RecapFrame, RecapMan, DeathRecap } from '../game/deathrecap';
import { mapOf } from '../game/replaybuf';
import type { ReplayMap } from '../replay/format';
import { gearText } from '../game/gear';
import { textZoom } from './textsize';

// the menu theme's tokens (ui/theme.ts), as literals: a canvas cannot read a CSS variable
const BASE = '#0c0b09', BRIGHT = '#f0e9d9', SOFT = '#a0977f', DIM = '#938b76', ACCENT_RGB = '240,145,46', ACCENT = `rgb(${ACCENT_RGB})`, EDGE = '214,200,170';
const VIEW_W = 420, VIEW_H = 250;
/** metres of floor always in the picture round the lost man, and beyond the furthest thing that matters */
const MIN_HALF_M = 3, PAD_M = 1.5;
/** seconds the playback rests on its last picture before it starts again; ms between two pictures of it (the record is 20 samples a second: 30 pictures a
 *  second is all it has to show); seconds of the way the man who did it came that the view is fitted to */
const HOLD_SECS = 1.8, PAINT_MS = 30, LEAD_SECS = 4;

export interface RecapFit { s: number; ox: number; oy: number; /** the view it was fitted to, CSS px */ w: number; h: number; }
export interface RecapUi {
  root: HTMLElement; /** the take shown */ take: RecapTake; /** false where the host has no 2D canvas (a headless stand-in): the labels alone */ drawn: boolean;
  /** true while it plays (false: a still) */ playing: boolean;
  /** show another of the men lost (an index into the takes as they stood when the card was built) */ show(i: number): void;
  /** one moment of the take shown, 0 = its first sample ‥ 1 = its last, as a still: the clock stops (stills, and a host whose frame clock does not run) */ seek(k: number): void;
  /** stop the playback's clock (it also stops by itself once the card is gone) */ stop(): void;
}
/** A man at one moment of a take. bits as in the game's frames: 1 down · 2 roused · 4 crouched. */
export interface RecapManAt { id: number; x: number; z: number; aim: number; bits: number; }

function el(tag: string, cls?: string) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

/** the frame that stands at `t`: the last one sampled at or before it */
export function frameAt(T: RecapTake, t: number): RecapFrame { return T.frames[frameIx(T, t)]; }
/** its index (0 for a moment before the first sample) — the ONE rule for which sample stands at a moment: the doors and the men both ask it */
function frameIx(T: RecapTake, t: number): number {
  const fr = T.frames; let lo = 0, hi = fr.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (fr[mid].t <= t + 1e-6) lo = mid; else hi = mid - 1; }
  return lo;
}

/** Where every man was at `t`: between the two samples round it (20 a second: a straight line between them is within a hand of where he was), his gun line
 *  turned the short way. A man in only one of the two samples stands where that one has him. */
export function recapMenAt(T: RecapTake, t: number): RecapManAt[] {
  const fr = T.frames, i = frameIx(T, t);
  const A = fr[i], B = i + 1 < fr.length ? fr[i + 1] : null; const out: RecapManAt[] = []; if (!A) return out;
  const gap = B ? B.t - A.t : 0, k = B && gap > 1e-6 && gap < 0.25 ? Math.max(0, Math.min(1, (t - A.t) / gap)) : 0;
  for (let j = 0; j < A.n; j++) {
    const o = j * MAN_STRIDE, id = A.men[o]; let x = A.men[o + 1], z = A.men[o + 2], aim = A.men[o + 3]; const bits = A.men[o + 4];
    if (B && k > 0) {
      let q = j < B.n && B.men[o] === id ? o : -1;
      if (q < 0) for (let m = 0; m < B.n; m++) if (B.men[m * MAN_STRIDE] === id) { q = m * MAN_STRIDE; break; }
      if (q >= 0) { x += (B.men[q + 1] - x) * k; z += (B.men[q + 2] - z) * k; const da = B.men[q + 3] - aim; aim += Math.atan2(Math.sin(da), Math.cos(da)) * k; }
    }
    out.push({ id, x, z, aim, bits });
  }
  return out;
}

/** The view: the lost man's own last steps, whoever did it and the last LEAD_SECS of the way he came (a man who ran the length of a corridor first does not
 *  shrink the picture to hold all of it: his trail runs in from the edge), the muzzle — never less than MIN_HALF_M round the lost man. */
export function recapFit(T: RecapTake, W: number, H: number): RecapFit {
  const d = T.death; let x0 = d.at[0], x1 = d.at[0], z0 = d.at[1], z1 = d.at[1];
  const add = (p: [number, number] | null) => { if (!p) return; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); };
  add(d.from); add(d.byAt);
  for (const f of T.frames) for (let i = 0; i < f.n; i++) { const id = f.men[i * MAN_STRIDE]; if (id === d.victim ? f.t <= d.t + 1e-6 : id === d.by && f.t >= d.t - LEAD_SECS) add([f.men[i * MAN_STRIDE + 1], f.men[i * MAN_STRIDE + 2]]); }
  x0 = Math.min(x0, d.at[0] - MIN_HALF_M); x1 = Math.max(x1, d.at[0] + MIN_HALF_M); z0 = Math.min(z0, d.at[1] - MIN_HALF_M); z1 = Math.max(z1, d.at[1] + MIN_HALF_M);
  const w = x1 - x0 + 2 * PAD_M, h = z1 - z0 + 2 * PAD_M, s = Math.min(W / w, H / h);
  return { s, ox: W / 2 - (x0 + x1) / 2 * s, oy: H / 2 - (z0 + z1) / 2 * s, w: W, h: H };
}

/** (replay/minimap.ts draws the same boxes for the F7 viewer, in that page's colours: this is its floor in the menu's — keep the two in step) */
function drawFloor(ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number, map: ReplayMap, f: RecapFit): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = BASE; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(dpr * f.s, 0, 0, dpr * f.s, dpr * f.ox, dpr * f.oy);
  const B = map.boxes, px = 1 / f.s;
  for (const pass of [1, 0, 2]) for (let i = 0; i + 5 < B.length; i += 6) {
    if (B[i + 5] !== pass) continue;
    const hw = Math.max(B[i + 2], pass === 1 ? 0 : 0.75 * px), hd = Math.max(B[i + 3], pass === 1 ? 0 : 0.75 * px);
    ctx.save(); ctx.translate(B[i], B[i + 1]); if (B[i + 4]) ctx.rotate(-B[i + 4] * Math.PI / 180);
    if (pass === 2) { ctx.strokeStyle = 'rgba(180,216,255,0.55)'; ctx.lineWidth = 1.1 * px; ctx.strokeRect(-B[i + 2], -B[i + 3], B[i + 2] * 2, B[i + 3] * 2); }
    else { ctx.fillStyle = pass === 0 ? `rgba(${EDGE},0.34)` : `rgba(${EDGE},0.08)`; ctx.fillRect(-hw, -hd, hw * 2, hd * 2); }
    ctx.restore();
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** One moment of a take over a floor already drawn. `t` in the take's own clock (game seconds). */
export function drawRecap(ctx: CanvasRenderingContext2D, dpr: number, T: RecapTake, f: RecapFit, t: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const X = (x: number) => f.ox + x * f.s, Y = (z: number) => f.oy + z * f.s;
  const d = T.death, F = frameAt(T, t), men = recapMenAt(T, t), fell = t >= d.t - 1e-6;
  const cast = new Map<number, RecapMan>(); for (const m of T.cast) cast.set(m.id, m);
  const r0 = Math.max(3.2, 0.26 * f.s);
  // doors: the leaf from its hinge, as it stood
  ctx.strokeStyle = `rgba(${EDGE},0.75)`; ctx.lineWidth = Math.max(1.2, 0.06 * f.s);
  for (let k = 0; k < T.doors.length && k * 2 + 1 < F.doors.length; k++) {
    const ux = F.doors[k * 2], uz = F.doors[k * 2 + 1]; if (!Number.isFinite(ux)) continue; const D = T.doors[k];
    ctx.beginPath(); ctx.moveTo(X(D.hinge[0]), Y(D.hinge[1])); ctx.lineTo(X(D.hinge[0] + ux * D.width), Y(D.hinge[1] + uz * D.width)); ctx.stroke();
  }
  // the way each of the two came: the lost man's last steps, and the steps of the man who did it
  const trail = (id: number, until: number, col: string, head: boolean) => {
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); let pen = false;
    const to = (x: number, z: number) => { if (pen) ctx.lineTo(X(x), Y(z)); else { ctx.moveTo(X(x), Y(z)); pen = true; } };
    for (const x of T.frames) { if (x.t > until + 1e-6) break; for (let i = 0; i < x.n; i++) if (x.men[i * MAN_STRIDE] === id) { to(x.men[i * MAN_STRIDE + 1], x.men[i * MAN_STRIDE + 2]); break; } }
    if (head) for (const m of men) if (m.id === id) { to(m.x, m.z); break; }   // up to where he is drawn now, between two samples
    ctx.stroke();
  };
  trail(d.victim, Math.min(t, d.t), `rgba(${EDGE},0.32)`, !fell);
  if (d.by >= 0 && d.by !== d.victim) trail(d.by, t, `rgba(${ACCENT_RGB},0.4)`, true);
  // his gaze: a wedge the way he was looking (frozen as he fell), so where the round came from reads against it
  let vx = d.at[0], vz = d.at[1], gaze = d.gaze;
  if (!fell) for (const m of men) if (m.id === d.victim) { vx = m.x; vz = m.z; gaze = m.aim; }
  { const a = Math.atan2(Math.cos(gaze), Math.sin(gaze)), L = Math.max(26, 2.6 * f.s), half = 0.6, cx = X(vx), cy = Y(vz);
    const fade = ctx.createRadialGradient(cx, cy, 0, cx, cy, L); fade.addColorStop(0, `rgba(${EDGE},0.3)`); fade.addColorStop(1, `rgba(${EDGE},0)`);
    ctx.fillStyle = fade; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, L, a - half, a + half); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(${EDGE},0.3)`; ctx.lineWidth = 1; ctx.beginPath();
    for (const e of [a - half, a + half]) { ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(e) * L * 0.6, cy + Math.sin(e) * L * 0.6); }
    ctx.stroke(); }
  // rounds and blasts of the last moments before `t`
  for (const s of T.shots) {
    const age = t - s.t; if (age < 0 || age > 0.4) continue; const al = 1 - age / 0.4;
    if (s.kind !== 'round') { ctx.strokeStyle = `rgba(${EDGE},${0.8 * al})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(X(s.from[0]), Y(s.from[1]), 5 + 26 * (age / 0.4), 0, 6.2832); ctx.stroke(); }
    else if (s.to) { ctx.strokeStyle = `rgba(${EDGE},${0.55 * al})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(s.from[0]), Y(s.from[1])); ctx.lineTo(X(s.to[0]), Y(s.to[1])); ctx.stroke(); }
  }
  // the round that did it: the muzzle to the man, in the one orange — it stays once he is down
  const src = d.from ?? d.byAt;
  if (fell && src && d.dist > 0.05) {
    const ax = X(src[0]), ay = Y(src[1]), bx = X(d.at[0]), by = Y(d.at[1]), L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L;
    const tx = bx - ux * (r0 + 2), ty = by - uy * (r0 + 2), h = Math.min(8, L * 0.4), lead = L > 3 * r0 + 16 ? r0 + 5 : 0;   // clear of his own ring where there is the room
    ctx.strokeStyle = ACCENT; ctx.fillStyle = ACCENT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax + ux * lead, ay + uy * lead); ctx.lineTo(tx - ux * h * 0.6, ty - uy * h * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - ux * h - uy * h * 0.5, ty - uy * h + ux * h * 0.5); ctx.lineTo(tx - ux * h + uy * h * 0.5, ty - uy * h - ux * h * 0.5); ctx.closePath(); ctx.fill();
    if (d.cause === 'blast') { ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(ax, ay, Math.max(7, 0.9 * f.s), 0, 6.2832); ctx.stroke(); }
  }
  // the men: the fallen first, then the living, the one who did it and the lost man last
  const rank = (id: number, down: boolean) => id === d.victim ? 4 : id === d.by ? 3 : down ? 0 : cast.get(id)?.kind === 'player' ? 2 : 1;
  men.sort((a, b) => rank(a.id, (a.bits & 1) === 1) - rank(b.id, (b.bits & 1) === 1));
  let sx = NaN, sy = NaN;
  for (const M of men) {
    const id = M.id, m = cast.get(id), down = (M.bits & 1) === 1 || (id === d.victim && fell);
    const x = X(id === d.victim && fell ? d.at[0] : M.x), y = Y(id === d.victim && fell ? d.at[1] : M.z), aim = M.aim;
    const mine = !!m && (m.side === 'player' || m.side === 'operative'), civ = !!m && m.kind === 'civ', did = id === d.by, r = r0 * (m?.kind === 'player' ? 1.15 : civ ? 0.75 : 1);
    if (did) { sx = x; sy = y; }
    if (down) {
      ctx.strokeStyle = id === d.victim ? BRIGHT : did ? ACCENT : DIM; ctx.lineWidth = id === d.victim || did ? 2 : 1.3;
      ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); continue;
    }
    const col = did ? ACCENT : mine ? BRIGHT : SOFT;
    if (!civ && !(did && fell)) { ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(aim) * r * 2.4, y + Math.cos(aim) * r * 2.4); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
    if (did || mine) { ctx.fillStyle = col; ctx.fill(); } else { ctx.fillStyle = BASE; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.stroke(); }
    if (did) { ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, 6.2832); ctx.stroke(); }
  }
  // two names and no more: who did it, and who was lost
  const label = (text: string, x: number, y: number, col: string) => {
    if (!text || !Number.isFinite(x)) return;
    ctx.font = '700 10px "Avenir Next Condensed","DIN Condensed","Roboto Condensed","Arial Narrow",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width, cx = Math.max(w / 2 + 3, Math.min(f.w - w / 2 - 3, x)), cy = Math.max(8, Math.min(f.h - 8, y));
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(12,11,9,0.9)'; ctx.strokeText(text, cx, cy); ctx.fillStyle = col; ctx.fillText(text, cx, cy);
  };
  if (!Number.isFinite(sx) && fell && d.byAt && d.by >= 0) { sx = X(d.byAt[0]); sy = Y(d.byAt[1]); }
  // each name on the side of its man away from the other one
  const up = !Number.isFinite(sy) || sy <= Y(vz) ? -1 : 1;
  if (d.by !== d.victim) label(d.byName.toUpperCase(), sx, sy + up * (r0 + 11), ACCENT);
  label(d.name.toUpperCase(), X(vx), Y(vz) - up * (r0 + 11), BRIGHT);
}

/** The three labels under the plan: who · with what · from how far. Nothing for a death nobody can be named for. */
export function recapLabels(T: RecapTake): string[] {
  const d = T.death; if (d.cause === 'unknown') return [];
  const out: string[] = [];
  if (d.byName) out.push(d.byName);
  if (d.cause === 'round' && d.weapon) out.push(gearText(d.weapon)); else if (d.cause === 'blast') out.push('blast');
  if (d.dist >= 0.5) out.push(`${d.dist < 10 ? d.dist.toFixed(1) : Math.round(d.dist)} m`);
  return out;
}

/** The take's clock as the playback runs it: from its first sample to its last, in seconds. */
export function recapSpan(T: RecapTake): [number, number] { const a = T.frames[0]?.t ?? T.death.t, b = T.frames[T.frames.length - 1]?.t ?? T.death.t; return [Math.min(a, T.death.t), Math.max(b, T.death.t)]; }

export function mountRecap(host: HTMLElement, game: Game): RecapUi | null {
  const G = globalThis as any;
  const R: DeathRecap | null = deathRecapOf(game); if (!R) { G.__recap = null; return null; }
  const takes = R.takes.slice();   // as they stand now: while the player is down the record's own list is live, and a chip must keep showing the man it names
  const root = el('div', 'db-recap'); host.appendChild(root);
  const cv = el('canvas', 'db-recap-cv') as HTMLCanvasElement; root.appendChild(cv);
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = typeof cv.getContext === 'function' ? cv.getContext('2d') : null; } catch { ctx = null; }
  const dpr = Math.max(1, Math.min(2, (G.devicePixelRatio || 1) * textZoom()));   // (drawn inside a zoomed layer: ui/textsize.ts)
  cv.width = Math.round(VIEW_W * dpr); cv.height = Math.round(VIEW_H * dpr);
  // the floor is drawn once a take, onto a canvas of its own, and laid under every moment
  let floor: HTMLCanvasElement | null = null, fctx: CanvasRenderingContext2D | null = null;
  if (ctx) try { floor = document.createElement('canvas'); floor.width = cv.width; floor.height = cv.height; fctx = floor.getContext('2d'); } catch { floor = null; fctx = null; }
  const map = ctx ? mapOf(game) : null;
  const cap = el('div', 'db-recap-cap'); root.appendChild(cap);
  let still = typeof G.requestAnimationFrame !== 'function';
  try { if (G.matchMedia?.('(prefers-reduced-motion: reduce)').matches) still = true; } catch { /* no window */ }
  const ui: RecapUi = { root, take: takes[R.main], drawn: !!ctx, playing: false, show, seek, stop };
  let fit = recapFit(ui.take, VIEW_W, VIEW_H), span = recapSpan(ui.take), began = 0, drew = -Infinity, raf = 0, wait: ReturnType<typeof setTimeout> | 0 = 0, seen = false;
  const chips: HTMLElement[] = [];

  function paint(t: number, k: number, clock: boolean): void {
    if (!ctx) return; const T = ui.take;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (floor && fctx) ctx.drawImage(floor, 0, 0); else if (map) drawFloor(ctx, VIEW_W, VIEW_H, dpr, map, fit);
    drawRecap(ctx, dpr, T, fit, t);
    if (clock) {   // the clock: a line along the foot, the fall its orange tick
      const y = VIEW_H - 1.5, kd = span[1] > span[0] ? (T.death.t - span[0]) / (span[1] - span[0]) : 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineCap = 'butt';
      ctx.strokeStyle = `rgba(${EDGE},0.12)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); ctx.stroke();
      ctx.strokeStyle = BRIGHT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW_W * k, y); ctx.stroke();
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(VIEW_W * kd, VIEW_H - 10); ctx.lineTo(VIEW_W * kd, VIEW_H); ctx.stroke();
    }
    if (cv.dataset) cv.dataset.k = k.toFixed(3);
  }
  function tick(now: number): void {
    raf = 0; wait = 0;
    if (root.isConnected) seen = true; else if (seen || now - began > 3000) { ui.playing = false; return; }   // the card is gone: the clock stops with it
    // the card put away but not unbuilt (the menu hides itself; the next card it builds replaces this one): no picture, a slow look for its return
    if (seen && (root as { offsetParent?: unknown }).offsetParent === null) { wait = setTimeout(() => tick(G.performance?.now?.() ?? now + 500), 500); return; }
    if (now - drew >= PAINT_MS) {
      drew = now; const len = span[1] - span[0], at = ((now - began) / 1000) % (len + HOLD_SECS), k = len > 0 ? Math.min(1, at / len) : 1;
      paint(span[0] + len * k, k, true);
    }
    raf = G.requestAnimationFrame(tick);
  }
  function stop(): void { if (raf) G.cancelAnimationFrame?.(raf); if (wait) clearTimeout(wait); raf = 0; wait = 0; ui.playing = false; }
  function seek(k: number): void { stop(); const q = Math.max(0, Math.min(1, k)); paint(span[0] + (span[1] - span[0]) * q, q, true); }
  function show(i: number): void {
    const T = takes[Math.max(0, Math.min(takes.length - 1, i))]; ui.take = T;
    fit = recapFit(T, VIEW_W, VIEW_H); span = recapSpan(T);
    if (fctx && map) drawFloor(fctx, VIEW_W, VIEW_H, dpr, map, fit);
    cap.textContent = ''; const labels = recapLabels(T);
    labels.forEach((s, n) => { const e = el(n === 0 && T.death.byName ? 'b' : 'span'); e.textContent = s; cap.appendChild(e); });
    cap.style.display = labels.length ? '' : 'none';
    chips.forEach((c, n) => c.classList.toggle('on', takes[n] === T));
    stop();
    if (still || !ctx || span[1] - span[0] < 0.2) { paint(T.death.t, 1, false); return; }   // a still: the moment of the fall, no clock
    began = G.performance?.now?.() ?? 0; drew = -Infinity; seen = root.isConnected; ui.playing = true; tick(began);
  }
  if (takes.length > 1) {   // more than one of ours lost: a chip a man, the one shown lit. The mouse's alone: a chip never takes the keyboard (Enter stays the card's)
    const who = el('div', 'db-recap-who');
    takes.forEach((T, n) => { const b = el('button', 'db-recap-chip') as HTMLButtonElement; b.type = 'button'; b.tabIndex = -1; b.textContent = T.death.name;
      b.addEventListener?.('mousedown', e => e.preventDefault()); b.addEventListener?.('click', () => show(n)); who.appendChild(b); chips.push(b); });
    root.appendChild(who);
  }
  show(R.main);
  G.__recap = ui;   // the panel on the card now, for a page check (`__recap.seek(k)`, `.show(i)`, `.take`)
  return ui;
}
