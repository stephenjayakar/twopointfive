// DOM overlay: guard state markers, the F reticle + interaction panel, light / sound meters, kit column, message log, mission line, tour caption / timeline.
import { v3, clamp, lerp } from '../math/vec';
import { FollowCamera } from '../game/camera';
import { Game, Player, Interactable, isBreathing } from '../game/game';
import { FLOOR } from '../game/floor';
import { FLOOR_KEY } from '../game/doors';
import { playerAim, guardAcquired } from '../game/aim';
import { ocpable } from '../game/lighting';
import { needsTrip } from '../game/needs';
import { CKPT } from '../game/savestate';
import type { SlotKind } from '../game/game';
import type { Firearm } from '../game/weapons';
import { WindViz } from './windviz';

const EDGE = 1.1;   // markers / dots / the throw arc stay drawn until they are 10 % of the view past its edge (FollowCamera.project margin)
const MAX_ROWS = 5;     // …at most this many blocks, then '+N more' (player.ts MAX_NEAR verb rows + the cancel row while the selector is open, and one spare)

/** One block of the interaction panel — one ROW of the list (player.ts buildInteractables: a verb Space can do, or a running one): what the thing is (`label`,
 *  shown only on the first row of a thing — `cont` marks the rows of the same thing under it), the key → action pair plus hint lines (`opts`; key '' = a
 *  status / hint line such as 'picking… 40%' or 'or sprint into it'), whether it is within reach (else greyed, with `dist` in metres when known), `off` (a
 *  thrown breaker), and `progress` 0‥1 for a bar (a lock being picked, the drive coming out, the leaf easing round). */
export interface InteractRow { kind: Interactable['kind']; label: string; opts: { key: string; text: string }[]; inReach: boolean; off: boolean; dist?: number; progress?: number; cont?: boolean; }

/** The marker text is authored as 'key␠␠action  ·  key␠␠action  ·  hint' (player.ts buildInteractables): split it back into rows. 'F or sprint into it  kick…'
 *  keeps F as the key and puts the alternative on a hint line under it. (Until Interactable carries structured options this is the one place that knows the convention.) */
function parseOpts(line2: string): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  for (const raw of line2.split(/\s+·\s+/)) {
    const seg = raw.trim(); if (!seg) continue;
    const m = /^(.*?\S)\s{2,}(\S.*)$/.exec(seg);
    if (!m) { out.push({ key: '', text: seg }); continue; }
    const or = /^(\S+) or (.+)$/.exec(m[1]);
    out.push({ key: or ? or[1] : m[1], text: m[2].trim() });
    if (or) out.push({ key: '', text: `or ${or[2]}` });
  }
  return out;
}

export class Overlay {
  private root = document.getElementById('overlay')!;
  private meters = document.getElementById('meters')!;
  private lightFill = document.querySelector('#meters .light .fill') as HTMLElement; private lightNum = document.querySelector('#meters .light .num') as HTMLElement;
  private soundFill = document.querySelector('#meters .sound .fill') as HTMLElement; private soundNum = document.querySelector('#meters .sound .num') as HTMLElement; private soundPeak = document.querySelector('#meters .sound .peak') as HTMLElement;
  private soundLab = document.querySelector('#meters .sound .lab') as HTMLElement; private floorKey = '';   // 'SOUND · carpet': what your feet are on, dim, after the label (game.floorUnderPlayer)
  private peak = 0; private peakT = 0;
  private log = document.getElementById('log')!; private logKey = '';
  private captionEl = document.getElementById('caption')!; private captionKey = '';
  private tlEl = document.getElementById('timeline')!; private tlKey = ''; private tlFill: HTMLElement | null = null; private tlOnPick: ((k: number) => void) | null = null;
  private equip = document.getElementById('equip')!;
  private traj = document.getElementById('traj') as unknown as SVGSVGElement;
  private trajPath: SVGPolylineElement; private trajLand: SVGCircleElement;
  private equipKey = '';
  private markers: HTMLElement[] = [];
  private dots: HTMLElement[] = [];
  showLightDots = true;
  /** the wind field's debug view (Tab ▸ Weather & wind ▸ Wind — field view): a canvas of its own in #overlay, drawn only while one of its switches is on */
  readonly windViz = new WindViz(this.root);
  /** Tour timeline: one segment per stop (width ∝ duration) with its chapter title, the live one filled to its progress; segments are clickable. */
  setTimeline(ch: { list: { title: string; dur: number }[]; i: number; frac: number } | null, onPick: (k: number) => void) {
    this.tlOnPick = onPick;
    if (!ch) { if (this.tlKey) { this.tlKey = ''; this.tlEl.className = ''; this.tlEl.innerHTML = ''; this.tlFill = null; } return; }
    const key = ch.list.length + '|' + ch.i;
    if (key !== this.tlKey) {
      this.tlKey = key; const total = ch.list.reduce((s, c) => s + c.dur, 0) || 1;
      this.tlEl.innerHTML = ch.list.map((c, k) => `<div class="seg${k < ch.i ? ' done' : k === ch.i ? ' cur' : ''}" data-k="${k}" title="${k + 1}. ${c.title} — click or ←/→" style="flex:${(c.dur / total * 100).toFixed(2)} 1 0"><b></b><span>${c.title}</span></div>`).join('');
      this.tlEl.className = 'on'; this.tlFill = this.tlEl.querySelector('.seg.cur b');
      if (!this.tlEl.dataset.wired) { this.tlEl.dataset.wired = '1'; this.tlEl.addEventListener('click', ev => { const seg = (ev.target as HTMLElement).closest('.seg') as HTMLElement | null; if (seg && this.tlOnPick) this.tlOnPick(Number(seg.dataset.k)); }); }
    }
    if (this.tlFill) this.tlFill.style.width = `${(ch.frac * 100).toFixed(1)}%`;
  }
  setCaption(text: string, sub: string) {
    const key = text + '|' + sub; if (key === this.captionKey) return; this.captionKey = key;
    this.captionEl.className = text ? 'on' : '';
    if (text) this.captionEl.innerHTML = `<div class="cap">${text}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
  }
  private reticle: HTMLElement; private ring: HTMLElement; private ringKey = -1;   // the ring on the marker F acts on; ring: progress round it (Interactable.progress — a lock being picked, the drive coming out)
  private hint: HTMLElement; private hintKey = '';                                  // the right button's word beside the ring ('RMB  OCP' / 'RMB  RING') — only when the button would do something to what the ring is on
  private aimPx = 16; private aimStyled = false;                                     // the aim ring's eased diameter under the aim model (px), and whether its inline size / tint are on it (taken off again for the interaction ring / the model off)
  private iaEl = document.getElementById('interact')!; private iaKey = '';         // interaction panel (top-left): rebuilt when its rows change, distance / progress patched in place
  private iaLive: { em: HTMLElement; bar: HTMLElement | null; d: string; p: string }[] = [];
  private menuEl = document.getElementById('menu')!;                               // start / pause / debrief card up ('on'): no interaction panel behind it
  private objEl = document.getElementById('objective')!; private objKey = '\0';   // the mission's one line (top-centre)
  private alarmEl = document.getElementById('alarm')!; private alarmKey = '';       // alarm stage under it (hidden at calm)
  private ckEl = document.getElementById('checkpoint'); private ckKey = '';           // the CHECKPOINT tag (game.saves.flash: written / loaded), shown CKPT.flashSecs — absent on a page without the element
  private recEl = document.getElementById('journal'); private recKey = '';            // the session journal's REC tag (game.journal.hudText(): 'REC f=1234 · 38 KB' / why it waits) — journal.ts, F10 in main.ts; absent on a page without the element
  private objMark: HTMLElement;                                                    // diamond + distance on / toward the current objective
  constructor() {
    this.reticle = document.createElement('div'); this.reticle.className = 'reticle'; this.reticle.innerHTML = '<b></b><i></i>'; this.reticle.style.display = 'none'; this.root.appendChild(this.reticle);
    this.ring = this.reticle.firstChild as HTMLElement; this.hint = this.reticle.lastChild as HTMLElement; this.hint.style.display = 'none';
    this.objMark = document.createElement('div'); this.objMark.className = 'objmark'; this.objMark.innerHTML = '<i></i><span></span>'; this.objMark.style.display = 'none'; this.root.appendChild(this.objMark);
    const NS = 'http://www.w3.org/2000/svg';
    this.trajPath = document.createElementNS(NS, 'polyline') as SVGPolylineElement;
    this.trajPath.setAttribute('fill', 'none'); this.trajPath.setAttribute('stroke', 'rgba(150,240,220,0.85)'); this.trajPath.setAttribute('stroke-width', '2'); this.trajPath.setAttribute('stroke-dasharray', '5 6'); this.trajPath.setAttribute('stroke-linecap', 'round');
    this.trajLand = document.createElementNS(NS, 'circle') as SVGCircleElement;
    this.trajLand.setAttribute('r', '9'); this.trajLand.setAttribute('fill', 'rgba(150,240,220,0.12)'); this.trajLand.setAttribute('stroke', 'rgba(150,240,220,0.9)'); this.trajLand.setAttribute('stroke-width', '1.5');
    this.traj.appendChild(this.trajPath); this.traj.appendChild(this.trajLand);
    this.trajPath.style.display = 'none'; this.trajLand.style.display = 'none';
  }
  update(game: Game, cam: FollowCamera, canvas: HTMLCanvasElement) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    // guards
    while (this.markers.length < game.guards.length) { const el = document.createElement('div'); el.className = 'marker'; this.root.appendChild(el); this.markers.push(el); }
    game.guards.forEach((g, i) => {
      const el = this.markers[i];
      const head = g.char.bones.head ?? g.char.pos; const [x, y, vis] = cam.project([head[0], head[1] + 0.45, head[2]], w, h, EDGE);
      if (!vis) { el.style.display = 'none'; return; }
      el.style.display = 'block'; el.style.left = `${x}px`; el.style.top = `${y}px`;
      let text = '', cls = 'calm';
      if (g.state === 'dead') { if (isBreathing(g)) { text = 'zz'; cls = 'ko'; } else { text = '✕'; cls = 'dead'; } }   // out cold and breathing (the takedown, the choke, the whip, a ring to the head) reads asleep, not crossed out — the floor treats him as a body either way
      else if (g.state === 'alert') { text = guardAcquired(game, g) ? '◎!' : '!'; cls = 'alert'; }   // ◎: he has you lined up — his track on you is past the aim model's first-shot gate (aim.ts; never shown with the model off)
      else if (g.state === 'suspicious' || g.state === 'search') { text = '?'; cls = 'sus'; }
      else if (g.awareness > 0.05) { text = '·'.repeat(1 + Math.floor(g.awareness * 6)); cls = 'sus'; }
      if (g.state !== 'dead' && game.time < g.dazzledUntil) text = '✹' + text;   // dazzled by a stun canister
      if (game.showDebug) text += ` ${g.state} ${(g.awareness * 100) | 0}%${game.time < g.dazzledUntil ? ` dazzled ${(g.dazzledUntil - game.time).toFixed(1)}s` : ''}`;
      if (game.showDebug) { const T = needsTrip(g); if (T) text += ` ${T.kind}:${T.phase}${T.phase === 'telegraph' ? ` ${Math.ceil(T.departAt - game.time)}s` : T.phase === 'dwell' ? ` ${Math.ceil(T.dwellUntil - game.time)}s` : ''}`; }   // (the debug label only: in play the trip is told by the man himself — the watch, the word, the neck — never by the HUD; needs.ts)
      el.textContent = text; el.className = 'marker ' + cls;
    });
    // civilians (civilians.ts): a small marker of their own — nothing while calm at work, '?' startled, '!' frightened / running / telling / on the phone, '·' cowering,
    // 'zz' / '✕' on the floor; the debug label adds the state and what frightened her
    const civs = game.civilians; const nG = game.guards.length;
    while (this.markers.length < nG + civs.length) { const el = document.createElement('div'); el.className = 'marker'; this.root.appendChild(el); this.markers.push(el); }
    civs.forEach((cv, k) => {
      const el = this.markers[nG + k]; const C = cv.civ!;
      if (C.state === 'gone' || game.touring || game.quietUtility) { el.style.display = 'none'; return; }
      const head = cv.char.bones.head ?? cv.char.pos; const [x, y, vis] = cam.project([head[0], head[1] + 0.45, head[2]], w, h, EDGE);
      if (!vis) { el.style.display = 'none'; return; }
      let text = '', cls = 'calm civ';
      if (cv.state === 'dead') { if (isBreathing(cv)) { text = 'zz'; cls = 'ko'; } else { text = '✕'; cls = 'dead'; } }
      else if (C.state === 'startled') { text = '?'; cls = 'sus civ'; }
      else if (C.state === 'cower' || C.state === 'held') { text = '·'; cls = 'sus civ'; }
      else if (C.state !== 'work') { text = C.state === 'phone' ? '!☎' : '!'; cls = 'alert civ'; }
      else if (cv.awareness > 0.05) { text = '·'.repeat(1 + Math.floor(cv.awareness * 6)); cls = 'sus civ'; }
      if (game.showDebug) text += ` ${C.name} ${C.state}${C.cause ? ` [${C.cause}${C.armed ? '!' : ''}${C.reported ? ' told' : ''}]` : ''} ${(cv.awareness * 100) | 0}%`;
      if (!text) { el.style.display = 'none'; return; }
      el.style.display = 'block'; el.style.left = `${x}px`; el.style.top = `${y}px`; el.textContent = text; el.className = 'marker ' + cls;
    });
    for (let i = nG + civs.length; i < this.markers.length; i++) this.markers[i].style.display = 'none';   // (markers past the roster: a spawned unit despawned again — teams — or civilians gone, must not leave a mark hanging where they stood)
    // a faint dot on everything F can act on (lights, doors, bodies — so hidden ceiling panels and closed doors are discoverable)
    const its = game.interactables;
    while (this.dots.length < its.length) { const el = document.createElement('div'); el.className = 'idot'; el.style.cssText = 'position:absolute;width:5px;height:5px;border-radius:50%;transform:translate(-50%,-50%);'; this.root.appendChild(el); this.dots.push(el); }   // (the class is only a handle for index.html to hide them wholesale — attract mode — over the inline display this loop keys)
    this.dots.forEach((el, i) => {
      const it = its[i];
      if (!it || !this.showLightDots || it.pos === game.hover?.pos) { el.style.display = 'none'; return; }   // (the highlighted row is a copy of its thing's marker — same pos array — and the ring is on it already)
      const [x, y, vis] = cam.project(it.pos, w, h, EDGE);
      if (!vis) { el.style.display = 'none'; return; }
      el.style.display = 'block'; el.style.left = `${x}px`; el.style.top = `${y}px`;
      if (it.kind === 'guard') { el.style.display = 'none'; return; }   // living guards already carry a state marker; no extra dot
      el.style.background = it.kind === 'door' ? 'rgba(150,190,230,0.5)' : it.kind === 'body' ? 'rgba(230,140,120,0.6)' : it.kind === 'objective' ? 'rgba(143,240,180,0.75)' : it.off ? 'rgba(120,140,160,0.45)' : 'rgba(255,240,180,0.55)';
    });
    // the ring on the highlighted row's thing (what it offers is listed in the interaction panel, below — the ring only says WHICH thing Space means; the selector's cancel row has no thing)
    const hv = game.hover?.kind === 'cancel' ? null : game.hover; const pl = game.player;
    const gunOut = !!pl.gunInHand() && !pl.down;   // pistol OR the FN2000 actually in the hands (R5's rule), not the pistol's slot alone
    const model = game.tune.aimModel && gunOut && !pl.sprinting && !pl.dragging;   // the aim model's ring: at the snapped thing, or round the bare cursor's point when nothing is near — sized to his cone (aim.ts playerAim) at that distance
    let styled = false;
    // The right button, worded beside the ring ONLY when it would do something to what the ring is on (playtest 08-08: a right click on a man that silently did
    // nothing): the pistol out → the OCP, on a light or on the burning torch of the man under it (lighting.ts ocpable — a man with no light on gets no word and no
    // effect); the rifle up with the ring launcher selected → a ring (while any are left); the rifle with no attachment → nothing, and nothing is promised.
    let rmb = !gunOut || pl.sprinting ? '' : pl.pistolUp ? (ocpable(game) ? 'RMB  OCP' : '') : pl.rifleUp && pl.rifle.attachment === 'ring' && pl.rifle.rings > 0 ? 'RMB  RING' : '';
    if (hv) {
      const [x, y, vis] = cam.project(hv.pos, w, h, EDGE);
      this.reticle.style.display = vis ? 'block' : 'none'; this.reticle.style.left = `${x}px`; this.reticle.style.top = `${y}px`;
      this.reticle.className = 'reticle' + (hv.off ? ' off' : '') + (hv.inReach ? '' : ' far') + ` k-${hv.kind}`;
      const pr = hv.progress !== undefined && hv.progress > 0 ? Math.round(Math.min(1, hv.progress) * 200) : -1;   // half-percent steps: no style churn between them
      if (pr !== this.ringKey) { this.ringKey = pr; this.ring.style.display = pr >= 0 ? 'block' : 'none'; if (pr >= 0) this.ring.style.setProperty('--p', `${pr / 2}%`); }
      if (!(vis && rmb === 'RMB  OCP' && hv.guard && hv.guard === game.aimGuard && !game.aimTarget)) rmb = '';   // (the interaction ring sits on a ROW's thing, not on the aim's: the only right-button word that belongs beside it is the OCP's, when that thing is the very man whose torch the aim has snapped to — the ring launcher's arc is its own affordance wherever it points)
    } else if (gunOut && (game.aimSnap || model)) {   // nothing to interact with near him, a gun out: the ring shows what the auto-aim snapped to (a light: right click OCPs it with the pistol, click shoots it; a man's chest) — or, under the aim model, sits round the cursor's own point
      const at = game.aimSnap ?? game.aimPoint;
      const [x, y, vis] = cam.project(at, w, h, EDGE);
      this.reticle.style.display = vis ? 'block' : 'none'; this.reticle.style.left = `${x}px`; this.reticle.style.top = `${y}px`;
      this.reticle.className = 'reticle aim' + (game.aimGuard ? ' k-guard' : game.aimSnap ? ' k-light' : ' k-free');
      if (this.ringKey !== -1) { this.ringKey = -1; this.ring.style.display = 'none'; }
      if (model) {   // the ring IS his cone: its diameter the cone's width at the target's distance (spread × range over the metres a CSS pixel covers at the look-at depth), 10‥60 px, eased; brighter and thinner as the track settles
        const A = playerAim(game); const gunAt = pl.char.bones.handR ?? v3.add(pl.char.pos, [0, 1.4, 0]);
        const want = aimRingPx(A.spread, v3.dist(at, gunAt), cam, h);
        this.aimPx += (want - this.aimPx) * 0.3;
        const st = this.reticle.style, d = `${this.aimPx.toFixed(1)}px`; st.width = d; st.height = d;
        st.opacity = lerp(0.42, 0.95, A.track).toFixed(2); st.borderWidth = A.track > 0.97 ? '1px' : '1.5px';
        styled = true;
      }
    } else { this.reticle.style.display = 'none'; rmb = ''; }
    if (rmb !== this.hintKey) { this.hintKey = rmb; this.hint.textContent = rmb; this.hint.style.display = rmb ? 'block' : 'none'; }
    if (styled !== this.aimStyled) { this.aimStyled = styled; if (!styled) { const st = this.reticle.style; st.width = st.height = st.opacity = st.borderWidth = ''; this.aimPx = 16; } }   // (the class rules again for the interaction ring / the model off)
    // interaction panel (top-left): the rows Space can do, the highlighted one lit; open (Space held) it says so and grows its cancel row
    { const ia = this.deriveInteractions(game); this.setInteractions(ia.rows, ia.primary, ia.more, ia.open); }
    // light + sound meters (bottom-left): how lit you are (the GPU light meter) and how much noise you are making (peak-hold marker)
    const v = game.player.visibility;
    this.lightFill.style.width = `${(v * 100).toFixed(0)}%`; this.lightNum.textContent = game.showDebug ? `${(v * 100) | 0}  E ${game.player.irradiance.toFixed(3)}` : `${(v * 100) | 0}`;
    this.meters.classList.toggle('hot', v > 0.55);
    const n = Math.min(1, game.player.noise);
    this.soundFill.style.width = `${(n * 100).toFixed(0)}%`; this.soundNum.textContent = `${(n * 100) | 0}`;
    if (this.peakT > game.time) { this.peakT = game.time; this.peak = n; }   // (a checkpoint loaded put the clock back: the held peak was the abandoned future's)
    if (n >= this.peak) { this.peak = n; this.peakT = game.time; } else if (game.time - this.peakT > 1.2) this.peak = Math.max(n, this.peak - 0.02);
    this.soundPeak.style.left = `calc(${(this.peak * 100).toFixed(0)}% - 1px)`; this.soundPeak.style.opacity = this.peak > 0.02 ? '0.85' : '0';
    const fl = game.tune.floorMaterials ? game.floorUnderPlayer : ('' as const); if (fl !== this.floorKey) { this.floorKey = fl; this.soundLab.innerHTML = !fl ? 'SOUND' : `SOUND <i style="opacity:.5;font-style:normal">· ${FLOOR[fl].label.toUpperCase()}</i>`; }   // rebuilt only when he crosses onto another finish
    // log
    // radio traffic only: lines that went over the guards' net ('radio: …') within the last 8 s, newest last, older ones dimmed — the rest of game.messages
    // stays for the harness / probes but is not drawn (the interaction panel, the kit column and the world carry it)
    { const rx = game.messages.filter(m => game.time - m.t < 8 && m.text.startsWith('radio: ')).slice(-3);
      const key = rx.map(m => m.text + (game.time - m.t > 5 ? '~' : '')).join('|');
      if (key !== this.logKey) { this.logKey = key; this.log.innerHTML = rx.map(m => `<span class="rx${game.time - m.t > 5 ? ' old' : ''}"><b>·)) RADIO</b>${m.text.slice(7).replace(/[<>&]/g, c => c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;')}</span>`).join(''); } }
    // mission: the objective line, and a diamond + distance on the objective — clamped to the screen edge in its direction when it is off screen (the
    // usual case from this camera), faded out within a couple of metres so it never fights the F reticle / door marker that takes over there
    const ot = game.objectiveText();
    if (ot !== this.objKey) { this.objKey = ot; this.objEl.textContent = ot; this.objEl.className = game.mission.stage; }
    { // alarm stage: level, whole seconds left on its clock, and whether an episode is running — rebuilt only when that key changes
      const lvl = game.quietUtility ? 0 : game.escalation; const left = lvl > 0 && game.escalationT > game.time ? Math.ceil(game.escalationT - game.time) : 0;
      const live = lvl > 0 && game.alarm.episode;
      const key = lvl === 0 ? '' : `${lvl}|${left}|${live ? 1 : 0}`;
      if (key !== this.alarmKey) { this.alarmKey = key;
        if (!key) this.alarmEl.className = ''; else { this.alarmEl.className = `on l${lvl}${live ? ' live' : ''}`; this.alarmEl.innerHTML = `<i></i>${lvl === 1 ? 'ALARM I · heightened' : 'ALARM II · lockdown'}${live ? '' : left ? ` · ${left}s` : ''}`; } }
    }
    { // the checkpoint tag: up for a couple of seconds after a save / load (game/savestate.ts Checkpoints.flash), keyed so the DOM is touched only on change
      const F = game.saves.flash; const on = !!F && game.time - F.t >= 0 && game.time - F.t < CKPT.flashSecs; const key = on ? F!.text : '';
      if (key !== this.ckKey && this.ckEl) { this.ckKey = key; this.ckEl.className = on ? 'on' : ''; if (on) this.ckEl.innerHTML = `<b></b>${key}`; } }
    { // the REC tag: the journal's own line while it waits / records (updated when the text changes — the frame count moves it about once a frame, so it is throttled to whole tens of frames)
      const raw = game.journal.hudText(); const key = raw.replace(/f=(\d+)/, (_m, n) => `f=${Math.floor(Number(n) / 10) * 10}`);
      if (key !== this.recKey && this.recEl) { this.recKey = key; this.recEl.className = key ? (game.journal.recording ? 'on rec' : 'on') : ''; this.recEl.textContent = key ? (game.journal.recording ? '● ' : '') + key + (game.journal.recording ? '  (F10 stops)' : '') : ''; } }
    const op = game.objectivePos();
    const od = op ? v3.distXZ(op, game.player.char.pos) : 0;
    const floor = game.mission.stage === 'drive' && game.hover?.kind !== 'objective' ? 0.35 : 0;   // the rack has no marker of its own: keep a faint diamond on it until the cursor finds it (doors have their own dot / reticle)
    const alpha = op ? Math.max(floor, Math.min(0.9, (od - 1.6) / 1.5)) : 0;
    if (!op || alpha < 0.03) this.objMark.style.display = 'none';
    else {
      const vp = cam.viewProj; const cw = vp[3] * op[0] + vp[7] * op[1] + vp[11] * op[2] + vp[15];
      let nx = vp[0] * op[0] + vp[4] * op[1] + vp[8] * op[2] + vp[12], ny = vp[1] * op[0] + vp[5] * op[1] + vp[9] * op[2] + vp[13];
      if (cw > 1e-4) { nx /= cw; ny /= cw; } else { const l = Math.hypot(nx, ny) || 1; nx = nx / l * 9; ny = ny / l * 9; }   // behind the eye: keep the undivided clip direction (dividing by w < 0 would mirror it) and force it onto the edge
      const mx = 1 - 2 * 36 / w, my = 1 - 2 * 36 / h; const k = Math.max(1, Math.abs(nx) / mx, Math.abs(ny) / my); nx /= k; ny /= k;   // into a 36 px inset of the view
      const el = this.objMark; el.style.display = 'block'; el.style.opacity = alpha.toFixed(2); el.className = k > 1 ? 'objmark edge' : 'objmark';
      el.style.left = `${((nx * 0.5 + 0.5) * w).toFixed(1)}px`; el.style.top = `${((1 - (ny * 0.5 + 0.5)) * h).toFixed(1)}px`;
      (el.lastChild as HTMLElement).textContent = `${Math.round(od)}m`;
    }
    // throw preview
    const pv = game.player.throwPreview;
    if (pv && pv.points.length > 1) {
      const pts: string[] = [];
      for (const p of pv.points) { const [x, y, vis] = cam.project(p, w, h, EDGE); if (vis) pts.push(`${x.toFixed(1)},${y.toFixed(1)}`); }
      this.trajPath.setAttribute('points', pts.join(' ')); this.trajPath.style.display = 'block';
      const [lx, ly, lv] = cam.project(pv.land, w, h, EDGE); this.trajLand.style.display = lv ? 'block' : 'none'; this.trajLand.setAttribute('cx', lx.toFixed(1)); this.trajLand.setAttribute('cy', ly.toFixed(1));
    } else { this.trajPath.style.display = 'none'; this.trajLand.style.display = 'none'; }
    // equipment
    this.updateEquip(game);
    // the wind field's debug view (nothing drawn, nothing sampled unless a switch of it is on)
    this.windViz.update(game, cam, w, h);
  }

  /** Interaction panel: `rows` top to bottom, `primary` = index of the highlighted row (what a Space tap does / letting go performs; -1: none), `more` = how
   *  many were left off the end, `open` = the selector is open (Space held: index.html #interact.open — the frame brightens, a header says let go to act,
   *  the cancel row is among the rows). The DOM is rebuilt only when the rows' text / reach / kind change; the distance and the progress bar are patched in
   *  place every frame. Hidden when there is nothing to list or a menu card is up. update() feeds it from the game's rows (deriveInteractions). */
  setInteractions(rows: InteractRow[], primary = -1, more = 0, open = false) {
    if (!rows.length || this.menuEl.classList.contains('on')) { if (this.iaKey) { this.iaKey = ''; this.iaEl.className = ''; this.iaEl.textContent = ''; this.iaLive = []; } return; }
    const key = rows.map(r => `${r.kind}|${r.label}|${r.cont ? 1 : 0}|${r.opts.map(o => `${o.key}>${o.text}`).join('/')}|${r.inReach ? 1 : 0}${r.off ? 1 : 0}${r.dist !== undefined ? 1 : 0}${r.progress !== undefined ? 1 : 0}`).join('\n') + `#${primary}#${more}#${open ? 1 : 0}`;
    if (key !== this.iaKey) {
      this.iaKey = key;
      this.iaEl.innerHTML = (open ? '<div class="selhint">let go to do it · wheel / ↑↓ chooses · Esc backs out</div>' : '') + rows.map((r, i) =>
        r.kind === 'cancel' ? `<div class="it k-cancel${i === primary ? ' primary' : ''}"><div class="opt"><kbd>×</kbd>cancel — let go, do nothing</div></div>`
        : `<div class="it k-${r.kind}${i === primary ? ' primary' : ''}${r.inReach ? '' : ' far'}${r.off ? ' off' : ''}${r.cont ? ' cont' : ''}">${r.cont ? '<div class="what"><em></em></div>' : `<div class="what"><span>${esc(r.label)}</span><em></em></div>`}`
        + r.opts.map((o, j) => o.key ? `<div class="opt${j === 0 && /^space$/i.test(o.key) ? ' verb' : ''}"><kbd>${esc(o.key.toUpperCase())}</kbd>${esc(o.text)}</div>` : `<div class="hint">${esc(o.text)}</div>`).join('')   // (.verb: the row's own Space verb — lit only on the highlighted row; the hint keys under it, LMB / E, are always live and never dimmed)
        + (r.progress !== undefined ? '<div class="prog"><b></b></div>' : '') + '</div>').join('') + (more > 0 ? `<div class="more">+${more} more</div>` : '');
      this.iaEl.className = open ? 'on open' : 'on';
      const blocks = [...this.iaEl.querySelectorAll('.it')] as HTMLElement[];
      this.iaLive = rows.map((_, i) => { const el = blocks[i]; return { em: el.querySelector('.what em') as HTMLElement, bar: el.querySelector('.prog b') as HTMLElement | null, d: '', p: '' }; });
    }
    rows.forEach((r, i) => {
      const L = this.iaLive[i];
      const d = r.dist !== undefined ? `${r.dist < 10 ? r.dist.toFixed(1) : Math.round(r.dist)}m` : ''; if (L.em && d !== L.d) { L.d = d; L.em.textContent = d; }
      if (L.bar) { const p = `${(Math.round(Math.min(1, Math.max(0, r.progress ?? 0)) * 200) / 2).toFixed(1)}%`; if (p !== L.p) { L.p = p; L.bar.style.width = p; } }   // half-percent steps, like the ring
    });
  }

  /** What the panel lists this frame, from the same data Space reads: player.ts's rows (Game.nearby — one per verb, the running verb alone while it runs, the
   *  cancel row at the foot while the selector is open) in their stable priority order, the highlighted one (Game.hover) marked primary; rows of the same thing
   *  under its first are continuations (no second header). Light fixtures are never rows (they are ranged: the pistol's business). */
  private deriveInteractions(game: Game): { rows: InteractRow[]; primary: number; more: number; open: boolean } {
    const hv = game.hover, p = game.player.char.pos;
    const dist = (it: Interactable) => { let d = v3.distXZ(it.pos, p); if (it.door) d = Math.min(d, v3.distXZ(it.door.frameCentre, p)); return d; };   // doors: leaf or doorway centre, as the reach test measures it
    const list: Interactable[] = game.nearby;
    const thing = (it: Interactable) => `${it.kind}:${it.door?.def.name ?? it.guard?.callsign ?? ''}`;
    const rows = list.slice(0, MAX_ROWS).map((it, i): InteractRow => { const d = dist(it); return { kind: it.kind, label: it.line1, opts: it.kind === 'cancel' ? [] : parseOpts(it.line2), inReach: it.inReach, off: it.off, dist: it.inReach || it.kind === 'light' || it.kind === 'cancel' ? undefined : d, progress: it.progress, cont: i > 0 && it.kind !== 'cancel' && thing(list[i - 1]) === thing(it) }; });
    const primary = hv ? list.indexOf(hv) : -1;
    return { rows, primary: primary >= 0 && primary < MAX_ROWS ? primary : -1, more: Math.max(0, list.length - MAX_ROWS), open: game.player.sel.open };
  }


  /** Kit column (bottom-left, standing on the meters): key strip, condition pips, then the slots top to bottom in KIT_ORDER — 1 the pistol (its OCP charge as the
   *  tagged meter at the row's end), 2 the FN2000 (a greyed 'not in this kit' row without it: the numbering is per item, so smoke is 3 in every kit), 3 smoke, 4
   *  stun. Rebuilt only when something it shows changes. */
  private updateEquip(game: Game) {
    const pl = game.player; const gun = pl.pistol; const rf = pl.rifle; const rifleSel = pl.rifleSel;
    const paceShow = game.time - pl.paceShownT < 2.5 || pl.pace < 0.99;   // pace ticks: shown for a moment after a wheel step, and kept while below full pace
    const rifleKey = pl.hasRifle ? [rf.chamber, rf.mag, rf.spare.join(','), rf.reloading ? 1 : 0, rf.mode, rf.attIdx, rf.rings, rf.lightOn ? 1 : 0].join('/') : '-';   // (the rifle's row: rounds, the beat, SEMI / AUTO, the selected attachment and its rings, its light)
    const key = [pl.slot, gun.chamber, gun.mag, gun.spare.join(','), gun.reloading ? 1 : 0, pl.canisters, pl.flashbangs, pl.throwKind, gun.lightOn ? 1 : 0, pl.nv ? 1 : 0, (Math.round(pl.ocp.charge * 20) + (pl.ocp.ready() ? 100 : 0)), pl.hitsLeft, pl.down ? 1 : 0, game.godMode ? 1 : 0, pl.holstered ? 1 : 0, paceShow ? Math.round(pl.pace * 100) : -1, [...pl.keys].join(','), rifleKey].join('|');
    if (key === this.equipKey) return; this.equipKey = key;
    const el = this.equip; el.textContent = '';
    const mk = (tag: string, cls?: string, text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    const selCls = (k: SlotKind) => pl.slot === k ? (pl.holstered ? ' sel holstered' : ' sel') : '';   // the selected row lit; put away (E) it is lit-dashed with 'holstered · E' ('slung · E' on the rifle's row)
    // key strip: the selected gun's light and night vision. The right button's business is on the rows themselves — the OCP's charge closes the pistol's, the RING
    // tag lights on the rifle's while the launcher is selected — and beside the reticle when it would act (overlay update: 'RMB  OCP' / 'RMB  RING')
    const gad = mk('div', 'gadgets');
    gad.appendChild(mk('span', 'g' + ((rifleSel ? rf.lightOn : gun.lightOn) ? ' on' : ''), 'L LIGHT'));
    gad.appendChild(mk('span', 'g' + (pl.nv ? ' on' : ''), 'N NIGHT VISION'));
    el.appendChild(gad);
    // walking pace (mouse wheel): a row of ticks, PACE_MIN‥1 — lit up to the current notch; shown after a wheel step and while below full pace
    if (paceShow) { const pr = mk('div', 'pace'); pr.appendChild(mk('span', 'g', 'PACE')); const ticks = mk('span', 'ticks'); const N = 6; const lit = Math.round((pl.pace - 0.35) / 0.65 * (N - 1)) + 1; for (let i = 0; i < N; i++) ticks.appendChild(mk('i', i < lit ? 'on' : '')); pr.appendChild(ticks); pr.appendChild(mk('span', 'g', 'wheel')); el.appendChild(pr); }
    // condition: MAX_HITS pips (one: a single 9 mm round downs you); god mode shows a note instead (.god — the tour, which runs in god mode, hides that row).
    // At its end, while he has one: the KEY tag — a key taken off a questioned man (Player.keys, player.ts takeKey), the keyed doors his from then on; the one
    // floor key reads plain KEY, anything more particular names its locks
    const cond = mk('div', 'cond' + (pl.down ? ' down' : '') + (game.godMode ? ' god' : ''));
    if (game.godMode) cond.appendChild(mk('span', 'g on', 'GOD MODE'));
    else { cond.appendChild(mk('span', 'g', pl.down ? 'DOWN — ENTER' : 'CONDITION')); const pips = mk('span', 'pips'); for (let i = 0; i < Player.MAX_HITS; i++) pips.appendChild(mk('i', i < pl.hitsLeft ? '' : 'lost')); cond.appendChild(pips); }
    if (pl.keys.size) { const named = [...pl.keys].filter(k => k !== FLOOR_KEY); const tag = mk('span', 'keytag', named.length ? `KEY · ${named.join(' · ').toUpperCase()}` : 'KEY'); tag.title = 'taken off a man you questioned: the keyed doors open to you'; cond.appendChild(tag); }
    el.appendChild(cond);
    /** a gun's row body: a pip per round the magazine holds, the chambered round, the count, a little box per spare drawn as full as it is */
    const gunRow = (row: HTMLElement, f: Firearm) => {
      const D = f.def; const inMag = f.mag ?? 0;
      const rounds = mk('span', 'rounds'); for (let i = 0; i < D.magCapacity; i++) rounds.appendChild(mk('i', i < inMag ? '' : 'spent')); if (f.chamber) rounds.appendChild(mk('i', 'chamber')); row.appendChild(rounds);
      row.appendChild(mk('span', '', `${inMag}${f.chamber ? '+1' : '+0'}`));
      const mags = mk('span', 'mags'); for (const r of f.spareSorted()) { const m = mk('span', 'mag'); const b = mk('b'); b.style.height = `${Math.round((r / D.magCapacity) * 100)}%`; m.appendChild(b); m.title = `${r} rounds`; mags.appendChild(m); } row.appendChild(mags);
    };
    // 1: the pistol — its row's short name, its rounds; then its OCP: a small tagged meter of the charge at the row's end, lit when it is ready (right click with the
    // pistol out knocks out the light the reticle is on — the pistol's gadget, so it lives on the pistol's row like the RING tag lives on the rifle's)
    const s1 = mk('div', 'slot' + selCls('pistol'));
    s1.appendChild(mk('span', 'key', '1')); s1.appendChild(mk('span', 'name', gun.reloading ? `${gun.def.short} · reloading` : gun.def.short));
    gunRow(s1, gun);
    { const oc = mk('span', 'tag ocp' + (pl.ocp.ready() ? ' on' : ''), 'OCP'); const bar = mk('span', 'ocpbar'); const bb = mk('b'); bb.style.width = `${Math.round(pl.ocp.charge * 100)}%`; bar.appendChild(bb); oc.appendChild(bar); oc.title = 'the OCP on the pistol: right click with it out knocks out the light the reticle is on for a few seconds (or the torch of the man it is on); recharges'; s1.appendChild(oc); }
    el.appendChild(s1);
    // 2: the FN2000 — its short name and the selector's position (SEMI / AUTO off Z: what the LEFT button fires, always), thirty slim pips, the chamber, the count,
    // the spare boxes; then its attachment for the RIGHT button: RING ×n, lit while the launcher is selected (2 again with it in the hands), dim while merely
    // carried. 'holstered' here reads slung (index.html .slot.slung). Without the rifle in the kit the row stays, greyed, so 3 and 4 keep their numbers.
    if (pl.hasRifle) {
      const s2 = mk('div', 'slot slung' + selCls('rifle'));
      s2.appendChild(mk('span', 'key', '2'));
      s2.appendChild(mk('span', 'name', rf.reloading ? `${rf.def.short} · reloading` : rf.def.short));
      s2.appendChild(mk('span', 'tag on', rf.mode.toUpperCase()));   // (Z: the selector — always lit: the left button always fires rounds)
      gunRow(s2, rf);
      const rg = mk('span', 'tag rings' + (rf.attachment === 'ring' ? ' on' : ''), `RING ×${rf.rings}`); rg.title = 'ring airfoils: 2 again with the rifle up puts the launcher on the right button (lit), a right click fires one — head = out cold, body = staggered; spent, not retrievable'; s2.appendChild(rg);
      el.appendChild(s2);
    } else {
      const s2 = mk('div', 'slot absent'); s2.appendChild(mk('span', 'key', '2')); s2.appendChild(mk('span', 'name', rf.def.short)); s2.appendChild(mk('span', '', 'not in this kit')); s2.title = 'the start card / pause menu puts the rifle in the kit'; el.appendChild(s2);
    }
    // 3 / 4: smoke and stun canisters. "G" marks the one the quick-throw key will use (the throwable selected last)
    const gKind = pl.throwKind === 'flash' && pl.flashbangs > 0 ? 'flash' : pl.canisters > 0 ? 'smoke' : pl.flashbangs > 0 ? 'flash' : '';
    const s3 = mk('div', 'slot' + selCls('smoke'));
    s3.appendChild(mk('span', 'key', '3')); s3.appendChild(mk('span', 'name', 'smoke'));
    const cans = mk('span', 'cans'); for (let i = 0; i < pl.canisters; i++) cans.appendChild(mk('i')); s3.appendChild(cans);
    s3.appendChild(mk('span', '', pl.canisters ? `×${pl.canisters}${gKind === 'smoke' ? '  G quick-throw' : ''}` : 'empty'));
    el.appendChild(s3);
    const s4 = mk('div', 'slot' + selCls('flash'));
    s4.appendChild(mk('span', 'key', '4')); s4.appendChild(mk('span', 'name', 'stun'));
    const bangs = mk('span', 'cans bangs'); for (let i = 0; i < pl.flashbangs; i++) bangs.appendChild(mk('i')); s4.appendChild(bangs);
    s4.appendChild(mk('span', '', pl.flashbangs ? `×${pl.flashbangs}${gKind === 'flash' ? '  G quick-throw' : ''}` : 'empty'));
    el.appendChild(s4);
  }
}

function esc(t: string): string { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
/** The aim ring's diameter (CSS px) for a cone of `spread` rad (± half per axis: the cone is spread wide) at `dist` metres: that width over the metres one CSS pixel
 *  covers at the camera's look-at depth, clamped 10‥60. Pure — the QA probes read it (aim-probes.ts). */
export function aimRingPx(spread: number, dist: number, cam: { distance: number; fov: number }, viewH: number): number {
  const mPerCssPx = 2 * cam.distance * Math.tan(cam.fov / 2) / Math.max(200, viewH);
  return clamp(spread * dist / Math.max(mPerCssPx, 1e-4), 10, 60);
}
