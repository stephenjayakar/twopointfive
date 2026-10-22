// DOM overlay: guard state markers, the F reticle + interaction panel, light / sound meters, kit column, message log, mission line, tour caption / timeline.
import { railClear, type Box } from './railclear';
import { BIGSLOT } from '../game/kit';
import { railCard, type RailCard } from './railcard';
import type { HudLike } from '../host/hud';   // the loop's view of a HUD (src/host/loop.ts stepFrame): this class is the DOM one; a native host's display-list overlay is another
import { v3, clamp, lerp } from '../math/vec';
import type { Vec3 } from '../math/vec';
import { FollowCamera } from '../game/camera';
import { Game, Player, Interactable, isBreathing } from '../game/game';
import { FLOOR } from '../game/floor';
import { backName } from '../game/backkey';
import { KEYMAP, keyCap, keyText, camCap } from '../host/keymap';   // (the player's own keys: every key this HUD names is named as it is bound — the same string back while nothing is rebound)
import { FLOOR_KEY } from '../game/doors';
import { playerAim } from '../game/aim';
import { AIMCOST } from '../game/aimcost';
import { aimGunPoint, aimGunOn } from '../game/aimweight';
import { previewTooClose } from '../game/he40';
import { gunShut, throwRest, thingDist } from '../game/player';
import { GEAR, gearText, ringTag, shellTag } from '../game/gear';
import { HANDSLOT } from '../game/handslot';
import { HANDRING, EMPTY_WORD, EMPTY_WHY, EMPTY_SHOW_SECS } from '../game/handring';
import { emptyThing, emptyWord } from '../game/interact';
/** the reticle's ONE word: the 40 mm's arc is too short to arm (the plain 'RMB  OCP' / 'RMB  RING' / 'RMB  40 MM' words went on the 10-11 play note: "we can remove
 *  the RMB overlay on the cursor" — what the right button holds is read on the kit column's rows) */
const HE40_SHORT = '40 MM · TOO CLOSE TO ARM';
const HE40_SHORT_STROKE = 'rgba(255, 170, 90, 0.95)';
import { needsTrip } from '../game/needs';
import { headMark, waryDots } from './headmark';
import { stickyMarks } from '../game/stickycam';
import { CKPT } from '../game/savestate';
import { stripRows } from '../game/cues';
import { fragMarks } from '../game/frag';
import { RECAP, lostLive, lostArrowsShown, type LostMan } from '../game/deathrecap';
import { QUICKTHROW } from '../game/quickthrow';
import { SLOTSETUP } from '../game/slotsetup';
import { drawHandBox, handBoxKey, handBoxTick } from './handbox';
import { samBlind } from '../game/samstun';
import { CmdRingViz } from './cmdring';
import { closeMarks } from '../game/close';
import { PlanFloor } from './planfloor';
import { FindMeViz } from './findme';
import type { SlotKind } from '../game/game';
import type { Firearm } from '../game/weapons';
import { WindViz } from './windviz';
import { SquadThrowViz } from './squadthrowviz';
import { AttentionViz } from './attentionviz';
import { PictureViz } from './pictureviz';
import { menuTheme } from './theme';
import { textZoom } from './textsize';

const EDGE = 1.1;   // markers / dots / the throw arc stay drawn until they are 10 % of the view past its edge (FollowCamera.project margin)
/** The way off a lost man to where the round came from, as it lies on the screen: the turn, in degrees, of one right-pointing arrow ('' = the squad does not
 *  have it), a ` n` after it while it is fresh (it comes in with a pulse). The plan's way turned by the camera's own planar basis (no projection: a point
 *  behind the lens cannot mirror it), to the nearest eighth — the squad has it no finer (deathrecap.ts eighth). */
function lostArrow(L: LostMan, cam: FollowCamera, now: number): string {
  if (!L.from) return '';
  const { fwd, right } = cam.planarBasis(), sx = L.from[0] * right[0] + L.from[1] * right[2], sy = -(L.from[0] * fwd[0] + L.from[1] * fwd[2]);
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return '';
  return `${(((Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) % 8) + 8) % 8) * 45}${now - L.knownAt < 1.2 ? ' n' : ''}`;
}
const MAX_ROWS = 5;     // …at most this many blocks, then '+N more' (player.ts MAX_NEAR verb rows + the cancel row while the selector is open, and one spare)

/** One block of the interaction panel — one ROW of the list (player.ts buildInteractables: a verb Space can do, or a running one): what the thing is (`label`,
 *  shown only on the first row of a thing — `cont` marks the rows of the same thing under it), the key → action pair plus hint lines (`opts`; key '' = a
 *  status / hint line such as 'picking… 40%' or 'or sprint into it'), whether it is within reach (else greyed, with `dist` in metres when known), `off` (a
 *  thrown breaker), and `progress` 0‥1 for a bar (a lock being picked, the drive coming out, the leaf easing round). */
export interface InteractRow { kind: Interactable['kind']; label: string; opts: { key: string; text: string; tone?: string; /** a squad man lost (deathrecap.ts lostLive) · his line as drawn: struck, with an arrow turned this many degrees ('' = no direction known; ' n' after it = fresh) */ gone?: boolean; lost?: LostMan; mark?: string }[]; inReach: boolean; off: boolean; dist?: number; progress?: number; cont?: boolean; /** the squad's element this row is about (orders.ts Tone: gold / red / blue) — #interact .t-<tone> */ tone?: string; }

/** The marker text is authored as 'key␠␠action  ·  key␠␠action  ·  hint' (player.ts buildInteractables): split it back into rows. 'F or sprint into it  kick…'
 *  keeps F as the key and puts the alternative on a hint line under it. (Until Interactable carries structured options this is the one place that knows the convention.) */
export function parseOpts(line2: string): { key: string; text: string }[] {
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

export class Overlay implements HudLike {
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
  private trajPath: SVGPolylineElement; private trajLand: SVGCircleElement; private trajShort = false;
  private trajRoll: SVGPolylineElement; private trajTick: SVGCircleElement; private restKey = ''; private restN = 0; private rest: { at: Vec3; path: Vec3[] } | null = null;   // player.ts throwRest: the ring goes where the can comes to REST, a tick stays on its first touch, the floor between is dotted
  private squadThrow!: SquadThrowViz;
  private attention!: AttentionViz;
  private picture!: PictureViz;
  /** closer than ever (game/close.ts closeMarks): the windows round a man near Sam, each a floor polygon with its words — pooled path + text pairs in the throw arc's svg */
  private closeG!: SVGGElement; private closeEls: { path: SVGPathElement; text: SVGTextElement }[] = []; private closeShown = 0;
  private equipKey = '';
  private markers: HTMLElement[] = [];
  private fragMarksEl: HTMLElement[] = [];   // (frag.ts fragMarks: a defender's live grenade Sam has been cued on)
  private lostMarks: HTMLElement[] = [];   // (deathrecap.ts lostLive: the way the round came in at a squad man lost)
  private camMarks: HTMLElement[] = [];    // (stickycam.ts stickyMarks: a small lens on each of his own stuck sticky cameras while the fog of war is live — STICKY.mark)
  private seenMarks: HTMLElement[] = [];   // (fogofwar.ts lastSeen: a fading '?' where an enemy was last seen — FOG.lastSeen, 0 = none)
  /** the orders ring at the cursor (ui/cmdring.ts ← game/cmdring.ts — a prototype: nothing unless CMDRING.on — the ring while its key is down, and before it the hint of what it would open on) */
  readonly cmdRing = new CmdRingViz(this.traj);
  private dots: HTMLElement[] = [];
  showLightDots = true;
  /** the wind field's debug view (Tab ▸ Weather & wind ▸ Wind — field view): a canvas of its own in #overlay, drawn only while one of its switches is on */
  readonly windViz = new WindViz(this.root);
  /** the squad's plan on the floor (ui/planfloor.ts ← game/floorplan.ts): ways, marks, fans, who an open menu goes to */
  readonly plan = new PlanFloor(this.traj);
  /** the player's own man made easy to find (ui/findme.ts ← host/findme.ts): a ring at his feet — nothing unless his Options ask */
  readonly findme = new FindMeViz(this.traj);
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
    const key = text + '|' + sub + (GEAR.on ? '|g' : '') + (KEYMAP.rev ? `|k${KEYMAP.rev}` : ''); if (key === this.captionKey) return; this.captionKey = key;
    text = gearText(text); sub = gearText(sub);   // (a showcase's caption names the kit as issued)
    this.captionEl.className = text ? 'on' : '';
    if (text) this.captionEl.innerHTML = `<div class="cap">${keyText(text)}</div>${sub ? `<div class="sub">${keyText(sub)}</div>` : ''}`;
  }
  private wish: HTMLElement; private wishKey = '';   // aimweight.ts: the dot on what the reticle snapped to while the circle (where the gun points) is still swinging onto it
  private reticle: HTMLElement; private ring: HTMLElement; private ringKey = -1;   // the ring on the marker F acts on; ring: progress round it (Interactable.progress — a lock being picked, the drive coming out)
  private hint: HTMLElement; private hintKey = '';                                  // the one word beside the ring: the 40 mm's too-close warning (HE40_SHORT)
  private aimPx = 16; private aimStyled = false;                                     // the aim ring's eased diameter under the aim model (px), and whether its inline size / tint are on it (taken off again for the interaction ring / the model off)
  private iaEl = document.getElementById('interact')!; private iaKey = '';         // interaction panel (top-left): rebuilt when its rows change, distance / progress patched in place
  private iaLive: { em: HTMLElement; bar: HTMLElement | null; d: string; p: string }[] = [];
  private menuEl = document.getElementById('menu')!;                               // start / pause / debrief card up ('on'): no interaction panel behind it
  private objEl = document.getElementById('objective')!; private objKey = '\0';   // the mission's one line (top-centre)
  private alarmEl = document.getElementById('alarm')!; private alarmKey = '';       // alarm stage under it (hidden at calm)
  private blindEl = document.getElementById('blind'); private blindK = 0;             // the white of a stun canister in his eyes (game/samstun.ts samBlind) — absent on a page without the element
  private ckEl = document.getElementById('checkpoint'); private ckKey = '';           // the CHECKPOINT tag (game.saves.flash: written / loaded), shown CKPT.flashSecs — absent on a page without the element
  private recEl = document.getElementById('journal'); private recKey = '';            // the session journal's REC tag (game.journal.hudText(): 'REC f=1234 · 38 KB' / why it waits) — journal.ts, F10 in main.ts; absent on a page without the element
  private orderMark: HTMLElement;                                                  // the ring on what the squad's order menu is frozen on (orders.ts mark())
  private skyWas = false;
  private railEl: HTMLElement; private railKey = '\0'; private railNote = ''; private objTurn = ''; private railsWas = false; private railRest: Box | null = null; private railRestOf: [string, string, number, number] = ['\0', '', 0, 0]; private railMan = 0; private railBoxes: Box[] = [];                           // a tutorial mission's one big line, low in the middle (game/rails.ts prompt)
  private card: RailCard;                                                          // a tutorial step's card, up in the middle with the world held (ui/railcard.ts)
  /** a tutorial mission's card is up (main.ts holds the world still under it) */
  get cardUp(): boolean { return this.card.up; }
  /** a key went down while it may be the card's (main.ts, ahead of the game's own read of it): true = it was */
  cardKey(e: KeyboardEvent): boolean { return this.card.key(e); }
  /** main.ts: what a card does as it goes (the keyboard's focus back to the game) */
  set cardClosed(fn: (() => void) | null) { this.card.onClose = fn; }
  /** main.ts: this page shows no card (a replay's tape) */
  cards = true;
  private objMark: HTMLElement;                                                    // diamond + distance on / toward the current objective
  constructor() {
    menuTheme();   // the fight screen's rules read the menus' tokens (index.html `--h-…`)
    this.reticle = document.createElement('div'); this.reticle.className = 'reticle'; this.reticle.innerHTML = '<b></b><i></i>'; this.reticle.style.display = 'none'; this.root.appendChild(this.reticle);
    this.wish = document.createElement('div'); this.wish.className = 'aimwish'; this.wish.style.display = 'none'; this.root.appendChild(this.wish);
    this.ring = this.reticle.firstChild as HTMLElement; this.hint = this.reticle.lastChild as HTMLElement; this.hint.style.display = 'none';
    this.orderMark = document.createElement('div'); this.orderMark.className = 'ordermark'; this.orderMark.innerHTML = '<i></i><span></span>'; this.orderMark.style.display = 'none'; this.root.appendChild(this.orderMark);
    this.railEl = document.createElement('div'); this.railEl.id = 'railprompt'; this.root.appendChild(this.railEl);
    this.card = railCard(this.root);
    this.objMark = document.createElement('div'); this.objMark.className = 'objmark'; this.objMark.innerHTML = '<i></i><u><b></b><b></b><b></b></u><span></span>'; this.objMark.style.display = 'none'; this.root.appendChild(this.objMark);
    const NS = 'http://www.w3.org/2000/svg';
    this.trajPath = document.createElementNS(NS, 'polyline') as SVGPolylineElement;
    this.trajPath.setAttribute('fill', 'none'); this.trajPath.setAttribute('class', 'trajpath'); this.trajPath.setAttribute('stroke-width', '2'); this.trajPath.setAttribute('stroke-dasharray', '5 6'); this.trajPath.setAttribute('stroke-linecap', 'round');
    this.trajLand = document.createElementNS(NS, 'circle') as SVGCircleElement;
    this.trajLand.setAttribute('r', '9'); this.trajLand.setAttribute('class', 'trajland'); this.trajLand.setAttribute('stroke-width', '1.5');
    this.closeG = document.createElementNS(NS, 'g') as SVGGElement; this.closeG.setAttribute('class', 'closewin'); this.traj.appendChild(this.closeG);   // (under the throw arc: the floor's own marks first)
    this.trajRoll = document.createElementNS(NS, 'polyline') as SVGPolylineElement;
    this.trajRoll.setAttribute('fill', 'none'); this.trajRoll.setAttribute('class', 'trajpath trajroll'); this.trajRoll.setAttribute('stroke-width', '2'); this.trajRoll.setAttribute('stroke-dasharray', '1 6'); this.trajRoll.setAttribute('stroke-linecap', 'round');
    this.trajTick = document.createElementNS(NS, 'circle') as SVGCircleElement;
    this.trajTick.setAttribute('r', '3'); this.trajTick.setAttribute('class', 'trajland trajtick'); this.trajTick.setAttribute('stroke-width', '1.5');
    this.trajRoll.style.display = 'none'; this.trajTick.style.display = 'none';
    this.traj.appendChild(this.trajPath); this.traj.appendChild(this.trajRoll); this.traj.appendChild(this.trajTick); this.traj.appendChild(this.trajLand);
    this.squadThrow = new SquadThrowViz(this.traj, this.trajPath);   // (a squad throw's ring, walk and arc: over the floor's marks, under his own throw arc)
    this.attention = new AttentionViz(this.traj, this.traj.firstChild as Element | null);   // (where a guard's attention is — game/attention.ts: a thread and a ring on the floor, under everything else drawn there)
    this.picture = new PictureViz(this.traj, this.traj.firstChild as Element | null);   // (one man's picture of the fight — game/picture.ts: a debug view, nothing unless PICTURE.show asks)
    this.trajPath.style.display = 'none'; this.trajLand.style.display = 'none';
  }
  /** The close-in windows on the floor (game/close.ts): every window of every man near Sam as its outline projected through the camera — the one he stands in
   *  filled and bright, the open ones outlined, a shut one amber and broken — with what it gives in a few words just outside its arc. Nothing with the switch
   *  off (closeMarks returns none and the pool stays hidden: no element is touched). */
  private drawClose(game: Game, cam: FollowCamera, w: number, h: number) {
    const marks = closeMarks(game); let n = 0;
    if (marks.length) {
      const NS = 'http://www.w3.org/2000/svg';
      for (const m of marks) {
        let el = this.closeEls[n];
        if (!el) { el = { path: document.createElementNS(NS, 'path') as SVGPathElement, text: document.createElementNS(NS, 'text') as SVGTextElement }; el.text.setAttribute('text-anchor', 'middle'); el.text.setAttribute('dominant-baseline', 'middle'); this.closeG.appendChild(el.path); this.closeG.appendChild(el.text); this.closeEls.push(el); }
        n++;
        let d = '', seen = false;
        for (let i = 0; i < m.pts.length; i++) { const [x, y, vis] = cam.project(m.pts[i], w, h, 3); if (vis) seen = true; d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }
        const cls = `cw-${m.state}`;
        if (seen && d) { el.path.setAttribute('d', d + 'Z'); if (el.path.getAttribute('class') !== cls) el.path.setAttribute('class', cls); el.path.style.opacity = m.alpha.toFixed(2); el.path.style.display = 'block'; } else el.path.style.display = 'none';
        const [lx, ly, lv] = cam.project(m.labelAt, w, h, 3);
        if (seen && lv && m.label) { if (el.text.textContent !== m.label) el.text.textContent = m.label; if (el.text.getAttribute('class') !== cls) el.text.setAttribute('class', cls); el.text.setAttribute('x', lx.toFixed(1)); el.text.setAttribute('y', ly.toFixed(1)); el.text.style.opacity = (m.alpha * (m.state === 'in' ? 1 : 0.8)).toFixed(2); el.text.style.display = 'block'; } else el.text.style.display = 'none';
      }
    }
    for (let i = n; i < this.closeShown; i++) { const el = this.closeEls[i]; el.path.style.display = 'none'; el.text.style.display = 'none'; }
    this.closeShown = n;
  }
  update(game: Game, cam: FollowCamera, canvas: HTMLCanvasElement) {
    const tz = textZoom(), w = canvas.clientWidth / tz, h = canvas.clientHeight / tz;   // (the layer's own pixels: ui/textsize.ts)
    // guards
    while (this.markers.length < game.guards.length) { const el = document.createElement('div'); el.className = 'marker'; this.root.appendChild(el); this.markers.push(el); }
    game.guards.forEach((g, i) => {
      const el = this.markers[i];
      const head = g.char.bones.head ?? g.char.pos; const [x, y, vis] = cam.project([head[0], head[1] + 0.45, head[2]], w, h, EDGE);
      if (!vis || game.fogOfWar.hidden(g)) { el.style.display = 'none'; return; }   // (fog of war: no marker over a man nobody on the team sees — never true while it is off)
      el.style.display = 'block'; el.style.left = `${x}px`; el.style.top = `${y}px`;
      const mark = headMark(game, g), cls = mark.cls; let text = mark.text;   // (headmark.ts: which glyph, which colour — a living man of your own carries no wary mark)
      if (game.showDebug) text += ` ${g.state} ${(g.awareness * 100) | 0}%${game.time < g.dazzledUntil ? ` dazzled ${(g.dazzledUntil - game.time).toFixed(1)}s` : ''}`;
      if (game.showDebug) { const T = needsTrip(g); if (T) text += ` ${T.kind}:${T.phase}${T.phase === 'telegraph' ? ` ${Math.ceil(T.departAt - game.time)}s` : T.phase === 'dwell' ? ` ${Math.ceil(T.dwellUntil - game.time)}s` : ''}`; }   // (the debug label only: in play the trip is told by the man himself — the watch, the word, the neck — never by the HUD; needs.ts)
      el.textContent = text; el.className = 'marker ' + cls;
    });
    // where an enemy who has gone out of the team's sight was last seen (fogofwar.ts lastSeen — empty unless FOG.lastSeen is turned up): a '?' on the spot, fading
    { const seen = game.fogOfWar.lastSeen();   // (each mark fades over its own life: FOG.lastSeen, or the wand's WAND.markSecs for a man its lens had)
      while (this.seenMarks.length < seen.length) { const el = document.createElement('div'); el.className = 'marker lastseen'; el.textContent = '(?)'; this.root.appendChild(el); this.seenMarks.push(el); }
      this.seenMarks.forEach((el, i) => { const s = seen[i]; if (!s) { el.style.display = 'none'; return; }
        const [x, y, vis] = cam.project([s.at[0], s.at[1] + 2.1, s.at[2]], w, h, EDGE); if (!vis) { el.style.display = 'none'; return; }
        el.style.display = 'block'; el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.opacity = String(Math.max(0.15, 1 - s.age / Math.max(0.01, s.life))); }); }
    // his own stuck sticky cameras under the fog of war (stickycam.ts stickyMarks — none unless STICKY.mark is up and the fog is live): a small lens on each, red in the one that sends
    { const cams = stickyMarks(game); let n = 0;
      for (const m of cams) {
        const [x, y, vis] = cam.project(m.at, w, h, EDGE); if (!vis) continue;
        let el = this.camMarks[n]; if (!el) { el = document.createElement('div'); this.root.appendChild(el); this.camMarks.push(el); }
        n++; const cls = m.sends ? 'cammark live' : 'cammark'; if (el.className !== cls) el.className = cls;
        const st = el.style; st.display = 'block'; st.left = `${x}px`; st.top = `${y}px`;
      }
      for (let i = n; i < this.camMarks.length; i++) this.camMarks[i].style.display = 'none'; }
    // a man of the squad lost, once the squad has the way it came from (deathrecap.ts lostLive: somebody saw him go down, or heard it) AND only while the way is drawn at all (RECAP.liveArrows: off as shipped): a stroke on the ground at him, toward it
    { const lost = lostArrowsShown() ? lostLive(game) : [], life = RECAP.liveMarkSecs; let n = 0;
      for (const L of lost) {
        const age = game.time - L.knownAt; if (!L.from || !(age >= 0) || age > life) continue;
        const [ax, ay, av] = cam.project([L.at[0] + L.from[0] * 0.35, 0.05, L.at[1] + L.from[1] * 0.35], w, h, EDGE), [bx, by, bv] = cam.project([L.at[0] + L.from[0] * 1.9, 0.05, L.at[1] + L.from[1] * 1.9], w, h, EDGE);   // (off the man, toward where it came from: the row's arrow, on the ground)
        if (!av || !bv) continue;
        let el = this.lostMarks[n]; if (!el) { el = document.createElement('div'); el.className = 'lostfrom'; this.root.appendChild(el); this.lostMarks.push(el); }
        n++; const st = el.style; st.display = 'block'; st.left = `${ax}px`; st.top = `${ay}px`; st.width = `${Math.hypot(bx - ax, by - ay).toFixed(1)}px`;
        st.transform = `rotate(${Math.atan2(by - ay, bx - ax).toFixed(3)}rad)`; st.opacity = Math.min(1, (life - age) / 4).toFixed(2);
      }
      for (let i = n; i < this.lostMarks.length; i++) this.lostMarks[i].style.display = 'none'; }
    // a defender's live grenade Sam has seen or heard land (frag.ts fragMarks): a blinking '!' over it with the seconds left — the cue he acts on
    { const marks = fragMarks(game);
      while (this.fragMarksEl.length < marks.length) { const el = document.createElement('div'); el.className = 'marker frag'; this.root.appendChild(el); this.fragMarksEl.push(el); }
      this.fragMarksEl.forEach((el, i) => { const m = marks[i]; if (!m) { el.style.display = 'none'; return; }
        const [x, y, vis] = cam.project([m.at[0], m.at[1] + 0.6, m.at[2]], w, h, EDGE); if (!vis) { el.style.display = 'none'; return; }
        el.style.display = 'block'; el.style.left = `${x}px`; el.style.top = `${y}px`; el.textContent = `! ${Math.max(0, m.left).toFixed(1)}`; el.style.opacity = Math.floor(m.left * 6) % 2 ? '1' : '0.55'; }); }
    // civilians (civilians.ts): a small marker of their own — nothing while calm at work, '?' startled, '!' frightened / running / telling / on the phone, '·' cowering,
    // 'zz' / '✕' on the floor; the debug label adds the state and what frightened her
    const civs = game.civilians; const nG = game.guards.length;
    while (this.markers.length < nG + civs.length) { const el = document.createElement('div'); el.className = 'marker'; this.root.appendChild(el); this.markers.push(el); }
    civs.forEach((cv, k) => {
      const el = this.markers[nG + k]; const C = cv.civ!;
      if (C.state === 'gone' || game.touring || game.quietUtility || game.fogOfWar.hidden(cv)) { el.style.display = 'none'; return; }
      const head = cv.char.bones.head ?? cv.char.pos; const [x, y, vis] = cam.project([head[0], head[1] + 0.45, head[2]], w, h, EDGE);
      if (!vis) { el.style.display = 'none'; return; }
      let text = '', cls = 'calm civ';
      if (cv.state === 'dead') { if (isBreathing(cv)) { text = 'zz'; cls = 'ko'; } else { text = '✕'; cls = 'dead'; } }
      else if (C.state === 'startled') { text = '?'; cls = 'sus civ'; }
      else if (C.state === 'cower' || C.state === 'held') { text = '·'; cls = 'sus civ'; }
      else if (C.state !== 'work') { text = C.state === 'phone' ? '!☎' : '!'; cls = 'alert civ'; }
      else if (waryDots(cv.awareness)) { text = waryDots(cv.awareness); cls = 'sus civ'; }
      if (game.showDebug) text += ` ${C.name} ${C.state}${C.cause ? ` [${C.cause}${C.armed ? '!' : ''}${C.reported ? ' told' : ''}]` : ''} ${(cv.awareness * 100) | 0}%`;
      if (!text) { el.style.display = 'none'; return; }
      el.style.display = 'block'; el.style.left = `${x}px`; el.style.top = `${y}px`; el.textContent = text; el.className = 'marker ' + cls;
    });
    for (let i = nG + civs.length; i < this.markers.length; i++) this.markers[i].style.display = 'none';   // (markers past the roster: a spawned unit despawned again — teams — or civilians gone, must not leave a mark hanging where they stood)
    // a faint dot on everything F can act on (lights, doors, bodies — so hidden ceiling panels and closed doors are discoverable)
    const its = game.interactables;
    const camMarked = stickyMarks(game).length > 0;   // (his stuck cameras carry their own lens mark: no dot inside it)
    while (this.dots.length < its.length) { const el = document.createElement('div'); el.className = 'idot'; el.style.cssText = 'position:absolute;width:5px;height:5px;border-radius:50%;transform:translate(-50%,-50%);'; this.root.appendChild(el); this.dots.push(el); }   // (the class is only a handle for index.html to hide them wholesale — attract mode — over the inline display this loop keys)
    this.dots.forEach((el, i) => {
      const it = its[i];
      if (!it || !this.showLightDots || it.pos === game.hover?.pos) { el.style.display = 'none'; return; }   // (the highlighted row is a copy of its thing's marker — same pos array — and the ring is on it already)
      const [x, y, vis] = cam.project(it.pos, w, h, EDGE);
      if (!vis || (it.guard && game.fogOfWar.hidden(it.guard))) { el.style.display = 'none'; return; }
      el.style.display = 'block'; el.style.left = `${x}px`; el.style.top = `${y}px`;
      if (it.kind === 'guard' || (it.kind === 'cam' && camMarked)) { el.style.display = 'none'; return; }   // living guards already carry a state marker, a stuck camera its lens mark; no extra dot
      el.style.background = it.kind === 'door' ? 'rgba(150,190,230,0.5)' : it.kind === 'body' ? 'rgba(230,140,120,0.6)' : it.kind === 'objective' ? 'rgba(var(--h-acc-rgb),0.8)' : it.off ? 'rgba(120,140,160,0.45)' : 'rgba(255,240,180,0.55)';
    });
    // the ring on the highlighted row's thing (what it offers is listed in the interaction panel, below — the ring only says WHICH thing Space means; the selector's cancel row has no thing)
    const hv = game.hover?.kind === 'cancel' || game.hover?.kind === 'charge' ? null : game.hover; const pl = game.player;   // (charge: ownblow.ts's row is on his list wherever he stands — it is no thing under the cursor, and the gun's ring stays his)
    const gunOut = !!pl.gunInHand() && !pl.down;   // pistol OR the FN2000 actually in the hands (R5's rule), not the pistol's slot alone
    const model = game.tune.aimModel && gunOut && !pl.sprinting && !pl.dragging;   // the aim model's ring: at the snapped thing, or round the bare cursor's point when nothing is near — sized to his cone (aim.ts playerAim) at that distance
    let styled = false;
    const gp = gunOut && !pl.sprinting && !pl.dragging ? aimGunPoint(game) : null, trail = !!gp && !aimGunOn(game);   // aimweight.ts: the circle is where the GUN points — it trails the cursor and swings onto it; null = the circle is the cursor's (switch off, a show, a branch that drives his aim itself)
    let wishKey = '';
    const shut = gunOut && !pl.sprinting && !pl.dragging && gunShut(game);   // (player.ts gunShut: his gun cannot get a round out from here — the ring is barred, or, while the ring is busy on a thing Space acts on, the gun's own small circle is)
    // Beside the ring: nothing but the 40 mm's too-close warning. The right button's own words ('RMB  OCP' on a light or a man's burning torch, 'RMB  RING' /
    // 'RMB  40 MM' with the rifle up) were taken off the cursor on the maintainer's play note; the kit column says what the button holds (the OCP's meter, the lit load tag).
    let rmb = gunOut && !pl.sprinting && pl.rifleUp && pl.rifle.attachment === 'he40' && pl.rifle.shells > 0 && previewTooClose(game) ? HE40_SHORT : '';   // (a WARNING, not a prompt: the arc the 40 mm would fly is shorter than its arming distance, said before the click)
    if (hv) {
      const [x, y, vis] = cam.project(hv.pos, w, h, EDGE);
      this.reticle.style.display = vis ? 'block' : 'none'; this.reticle.style.left = `${x}px`; this.reticle.style.top = `${y}px`;
      this.reticle.className = 'reticle' + (hv.off ? ' off' : '') + (hv.inReach ? '' : ' far') + ` k-${hv.kind}`;
      const pr = hv.progress !== undefined && hv.progress > 0 ? Math.round(Math.min(1, hv.progress) * 200) : -1;   // half-percent steps: no style churn between them
      if (pr !== this.ringKey) { this.ringKey = pr; this.ring.style.display = pr >= 0 ? 'block' : 'none'; if (pr >= 0) this.ring.style.setProperty('--p', `${pr / 2}%`); }
      if ((trail && gp) || shut) { const [gx, gy, gv] = cam.project(gp ?? game.aimPoint, w, h, EDGE); if (gv) { wishKey = shut ? 'x' : 'c'; this.wish.style.left = `${gx}px`; this.wish.style.top = `${gy}px`; } }   // (the ring is on the thing Space acts on: the gun's own point still shows while it is off the cursor — a round goes there)
    } else if (gunOut && (game.aimSnap || model || gp)) {   // nothing to interact with near him, a gun out: the ring shows what the auto-aim snapped to (a light: right click OCPs it with the pistol, click shoots it; a man's chest) — or, under the aim model, sits round the cursor's own point
      const at = gp ?? game.aimSnap ?? game.aimPoint;
      const [x, y, vis] = cam.project(at, w, h, EDGE);
      if (trail && game.aimSnap) { const [wx, wy, wv] = cam.project(game.aimSnap, w, h, EDGE); if (wv) { wishKey = game.aimGuard ? 'g' : 'l'; this.wish.style.left = `${wx}px`; this.wish.style.top = `${wy}px`; } }   // what it will settle on, marked while it travels (bare floor needs none: the cursor is the mark)
      this.reticle.style.display = vis ? 'block' : 'none'; this.reticle.style.left = `${x}px`; this.reticle.style.top = `${y}px`;
      this.reticle.className = 'reticle aim' + (trail ? ' k-free trail' : game.aimGuard ? ' k-guard' : game.aimSnap ? ' k-light' : ' k-free') + (shut ? ' shut' : '');   // (it takes the man's / the light's colour only once the gun is on it)
      if (this.ringKey !== -1) { this.ringKey = -1; this.ring.style.display = 'none'; }
      if (model) {   // the ring IS his cone: its diameter the cone's width at the target's distance (spread × range over the metres a CSS pixel covers at the look-at depth), 10‥60 px, eased; brighter and thinner as the track settles
        const A = playerAim(game); const gunAt = pl.char.bones.handR ?? v3.add(pl.char.pos, [0, 1.4, 0]);
        const want = aimRingPx(A.spread, v3.dist(at, gunAt), cam, h, AIMCOST.move ? AIMCOST.ringPx : 60);   // moving feet may open it past 60 (aimcost.ts)
        this.aimPx += (want - this.aimPx) * 0.3;
        const st = this.reticle.style, d = `${this.aimPx.toFixed(1)}px`; st.width = d; st.height = d;
        st.opacity = (lerp(0.42, 0.95, A.track) * (trail ? 0.7 : 1)).toFixed(2); st.borderWidth = A.track > 0.97 ? '1px' : '1.5px';
        styled = true;
      }
    } else { this.reticle.style.display = 'none'; rmb = ''; }
    if (wishKey !== this.wishKey) { this.wishKey = wishKey; this.wish.style.display = wishKey ? 'block' : 'none'; this.wish.className = 'aimwish' + (wishKey === 'g' ? ' k-guard' : wishKey === 'c' ? ' gun' : wishKey === 'x' ? ' gun shut' : ''); }
    rmb = keyText(rmb);
    if (rmb !== this.hintKey) { this.hintKey = rmb; this.hint.textContent = rmb; this.hint.style.display = rmb ? 'block' : 'none'; }
    if (styled !== this.aimStyled) { this.aimStyled = styled; if (!styled) { const st = this.reticle.style; st.width = st.height = st.opacity = st.borderWidth = ''; this.aimPx = 16; } }   // (the class rules again for the interaction ring / the model off)
    // interaction panel (top-left): the rows Space can do, the highlighted one lit; open (Space held) it says so and grows its cancel row
    { const ia = this.deriveInteractions(game);
      for (const r of ia.rows) for (const o of r.opts) if (o.gone) o.mark = o.lost && lostArrowsShown() ? lostArrow(o.lost, cam, game.time) : '';   // (the way the round came from, as it lies on the screen)
      this.setInteractions(ia.rows, ia.primary, ia.more, ia.open, ia.hint, ia.cancel); }
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
    // …and, with CUES.overheard, one dim row for a shout that reached an ear from a man the fog hides ('heard: …' — cues.ts overheard)
    { const rx = stripRows(game);   // (cues.ts: the defenders' net ranked and rate-limited; with its switch off, the message ring's 'radio: ' rows as ever)
      const key = rx.map(m => m.text + (game.time - m.t > 5 ? '~' : '')).join('|');
      if (key !== this.logKey) { this.logKey = key; this.log.innerHTML = rx.map(m => { const heard = m.text.startsWith('heard: ');   // (cues.ts overheard: a shout that reached an ear — the strip's own dim row from the start, under its own word; no colour of its own)
        return `<span class="rx${heard ? ' heard old' : game.time - m.t > 5 ? ' old' : ''}"><b>${heard ? 'HEARD' : '·)) RADIO'}</b>${m.text.slice(7).replace(/[<>&]/g, c => c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;')}</span>`; }).join(''); } }
    // mission: the objective line, and a diamond + distance on the objective — clamped to the screen edge in its direction when it is off screen (the
    // usual case from this camera), faded out within a couple of metres so it never fights the F reticle / door marker that takes over there
    // A TUTORIAL MISSION (game/rails.ts): its step is the one instruction on screen — big, low in the middle, each key it names drawn as a key ('[B]' in the
    // line), a pip for every step. The small row at the top stands down while it is up, and the seat with nobody on the floor hides the rows of a man's own kit.
    const rail = game.rails.prompt();
    // (each cap in brackets is one key, asked of the key map by itself: a line of several — '[W] [A] [S] [D]' — follows a rebind of any of them)
    const caps = (line: string) => line.split(/(\[[^\]]+\])/).map(t => /^\[[^\]]+\]$/.test(t) ? (t === '[X]' && KEYMAP.qOnly ? `Hold <kbd>${esc(keyCap('B'))}</kbd>` : `<kbd>${esc(t === '[Ctrl]' ? camCap() : keyCap(t.slice(1, -1)))}</kbd>`) : esc(keyText(t))).join('').replace(/(<kbd>[^<]*<\/kbd>)([:,.;!?])/g, '<span class="nb">$1$2</span>');   // (…and a cap is never parted from the mark after it: a second row that begins ': behind the van')
    const railWords = rail ? caps(rail.line) : '', railNote = rail?.note ? caps(rail.note) : '';   // (a note: the words under the line after a tap the step refused)
    { const key = rail ? `${rail.n}|${rail.of}|${rail.watch ? 'w' : ''}|${railWords}` : '';
      if (key !== this.railKey) { this.railKey = key;
        if (!rail) { this.railEl.className = ''; this.railEl.innerHTML = ''; }
        else { const words = railWords;
          let pips = ''; for (let i = 1; i <= rail.of; i++) pips += `<i class="${i < rail.n ? 'done' : i === rail.n ? 'now' : ''}"></i>`;
          this.railEl.innerHTML = `<div class="line${rail.watch ? ' watch' : ''}">${words}</div><div class="note"></div><div class="pips">${pips}</div>`; this.railNote = '';
          this.railEl.className = ''; void this.railEl.offsetWidth; this.railEl.className = 'on'; } }
      this.card.update(this.cards ? game.rails.card() : null, caps);
      // (the note is its own piece: it comes and goes under a line that stays put, and the line is shaken once as it comes)
      if (rail && railNote !== this.railNote) { this.railNote = railNote; const n = this.railEl.querySelector?.('.note'), l = this.railEl.querySelector?.('.line') as HTMLElement | null;
        if (n) n.innerHTML = railNote; if (l) { l.classList.remove('nudge'); if (railNote) { void l.offsetWidth; l.classList.add('nudge'); } } }
      const sky = game.rails.skyOn; if (sky !== this.skyWas) { this.skyWas = sky; document.body.classList.toggle('skyseat', sky); }
      const on = game.rails.live; if (on !== this.railsWas) { this.railsWas = on; document.body.classList.toggle('onrails', on); } }   // (…and on any tutorial mission the place the line points at is marked big: index.html .objmark)
    // …and the line stays clear of your own men (ui/railclear.ts): with the view led up the screen, or in a short window, it lay over the player and his
    // partner. Where it lies is measured once a line (offsets are the layout's: no transform, no animation in them). With a ring up it is at home: the
    // ring's own step of it (ui/cmdring.ts) is the only one. At the bottom edge it is where the radio's rows live, so they go up over it (`--raillog`)
    { let s = 0; const men = rail && !this.cmdRing.ringUp ? game.rails.lineMen() : [], E = this.railEl, O = this.railRestOf;
      if (men.length) {
        if (O[0] !== this.railKey || O[1] !== this.railNote || O[2] !== w || O[3] !== h) { O[0] = this.railKey; O[1] = this.railNote; O[2] = w; O[3] = h;
          const W = E.offsetWidth, H = E.offsetHeight, L = E.offsetLeft, T = E.offsetTop; this.railRest = W > 0 && H > 0 ? { l: L - W / 2, r: L + W / 2, t: T, b: T + H } : null; }
        if (this.railRest) { const B = this.railBoxes; let n = 0;
          for (const c of men) { const p = c.pos, hd = c.bones.head, [fx, fy, fv] = cam.project(p, w, h, 1.2), [hx, hy] = cam.project(hd ? [hd[0], hd[1] + 0.25, hd[2]] : [p[0], p[1] + 1.85, p[2]], w, h, 1.2); if (!fv) continue;
            const hw = Math.max(18, 0.32 * Math.hypot(fx - hx, fy - hy)), q = B[n] ?? (B[n] = { l: 0, r: 0, t: 0, b: 0 }); n++; q.l = Math.min(fx, hx) - hw; q.r = Math.max(fx, hx) + hw; q.t = Math.min(fy, hy); q.b = Math.max(fy, hy) + 8; }
          B.length = n; s = railClear(this.railRest, B, h, this.railMan > 0); } }
      else if (!rail) O[0] = '\0';
      if (s !== this.railMan) { this.railMan = s; E.style.setProperty?.('--railman', `${s.toFixed(0)}px`); const st = document.body.style;
        if (s > 0 && this.railRest) st?.setProperty?.('--raillog', `${(h - this.railRest.t - s + 6).toFixed(0)}px`); else st?.removeProperty?.('--raillog'); } }
    const ot = rail ? '' : keyText(game.objectiveText());
    if (ot !== this.objKey) { this.objKey = ot; const W = 'objective ▸', cut = ot.indexOf(W);   // the line's own word is set apart as its label (a par clock in front of it is not part of it); the text read back is unchanged
      if (cut < 0) this.objEl.textContent = ot; else this.objEl.innerHTML = `${esc(ot.slice(0, cut))}<b>${W}</b>${esc(ot.slice(cut + W.length))}`;
      this.objEl.className = game.mission.stage; }
    { // alarm stage: level, whole seconds left on its clock, and whether an episode is running — rebuilt only when that key changes
      const lvl = game.quietUtility ? 0 : game.escalation; const left = lvl > 0 && game.escalationT > game.time ? Math.ceil(game.escalationT - game.time) : 0;
      const live = lvl > 0 && game.alarm.episode;
      const key = lvl === 0 ? '' : `${lvl}|${left}|${live ? 1 : 0}`;
      if (key !== this.alarmKey) { this.alarmKey = key;
        if (!key) this.alarmEl.className = ''; else { this.alarmEl.className = `on l${lvl}${live ? ' live' : ''}`; this.alarmEl.innerHTML = `<i></i>${lvl === 1 ? 'ALARM I · heightened' : 'ALARM II · lockdown'}${live ? '' : left ? ` · ${left}s` : ''}`; } }
    }
    { const b = Math.round(samBlind(game) * 50) / 50; if (b !== this.blindK && this.blindEl) { this.blindK = b; this.blindEl.style.opacity = String(0.97 * b); document.body.classList.toggle('blinded', b > 0.5); } }   // blind: the picture whites out, clearing over the dazzle's last seconds
    { // the checkpoint tag: up for a couple of seconds after a save / load (game/savestate.ts Checkpoints.flash), keyed so the DOM is touched only on change
      const F = game.saves.flash; const on = !!F && game.time - F.t >= 0 && game.time - F.t < CKPT.flashSecs; const key = on ? F!.text : '';
      if (key !== this.ckKey && this.ckEl) { this.ckKey = key; this.ckEl.className = on ? 'on' : ''; if (on) this.ckEl.innerHTML = `<b></b>${key}`; } }
    { // the REC tag: the journal's own line while it waits / records (updated when the text changes — the frame count moves it about once a frame, so it is throttled to whole tens of frames)
      const raw = game.journal.hudText(); const key = raw.replace(/f=(\d+)/, (_m, n) => `f=${Math.floor(Number(n) / 10) * 10}`);
      if (key !== this.recKey && this.recEl) { this.recKey = key; this.recEl.className = key ? (game.journal.recording ? 'on rec' : 'on') : ''; this.recEl.textContent = key ? (game.journal.recording ? '● ' : '') + key + (game.journal.recording ? '  (F10 stops)' : '') : ''; } }
    const op = game.objectivePos();
    const skySeat = game.rails.skyOn;   // (nobody on the floor is the player: the marker is a place to point at, not a walk to it — no fade near it, no metres)
    const far = op ? v3.distXZ(op, game.player.char.pos) : 0, od = op ? (skySeat || game.rails.arrow() ? 99 : far) : 0;   // (…nor near a step's arrow: it is drawn for the last pace, where the diamond would have faded out)
    const floor = game.mission.stage === 'drive' && game.hover?.kind !== 'objective' ? 0.35 : 0;   // the rack has no marker of its own: keep a faint diamond on it until the cursor finds it (doors have their own dot / reticle)
    const alpha = op ? Math.max(floor, Math.min(0.9, (od - 1.6) / 1.5)) : 0;
    if (!op || alpha < 0.03 || rail?.watch) this.objMark.style.display = 'none';   // (a line that asks for nothing marks no place to press on: rails.ts prompt)
    else {
      const vp = cam.viewProj; const cw = vp[3] * op[0] + vp[7] * op[1] + vp[11] * op[2] + vp[15];
      let nx = vp[0] * op[0] + vp[4] * op[1] + vp[8] * op[2] + vp[12], ny = vp[1] * op[0] + vp[5] * op[1] + vp[9] * op[2] + vp[13];
      if (cw > 1e-4) { nx /= cw; ny /= cw; } else { const l = Math.hypot(nx, ny) || 1; nx = nx / l * 9; ny = ny / l * 9; }   // behind the eye: keep the undivided clip direction (dividing by w < 0 would mirror it) and force it onto the edge
      const mx = 1 - 2 * 36 / w, my = 1 - 2 * 36 / h; const k = Math.max(1, Math.abs(nx) / mx, Math.abs(ny) / my); nx /= k; ny /= k;   // into a 36 px inset of the view
      const el = this.objMark; el.style.display = 'block'; el.style.opacity = alpha.toFixed(2);
      // (a tutorial step's `toward`: the mark is an arrow lying from the place to where it points, turned as the view has the two — never at the picture's edge, where the ring says 'that way')
      const to = k > 1 ? null : game.rails.arrow(); let turn = '';
      if (to) { const [ax, ay, av] = cam.project(op, w, h, EDGE), [bx, by] = cam.project(to, w, h); if (av && Math.hypot(bx - ax, by - ay) > 4) turn = `${(Math.atan2(by - ay, bx - ax) * 180 / Math.PI).toFixed(1)}deg`; }
      el.className = k > 1 ? 'objmark edge' : turn ? 'objmark arrow' : 'objmark'; if (turn !== this.objTurn) { this.objTurn = turn; el.style.setProperty?.('--turn', turn || '0deg'); }
      el.style.left = `${((nx * 0.5 + 0.5) * w).toFixed(1)}px`; el.style.top = `${((1 - (ny * 0.5 + 0.5)) * h).toFixed(1)}px`;
      (el.lastChild as HTMLElement).textContent = skySeat || turn ? '' : `${Math.round(far)}m`;   // (an arrow lies at his feet and says which way, not how far: under it the metres read '99m', the number that keeps it from fading)
    }
    // the squad's order menu: a ring on the door / spot / man it was opened on, in the addressed element's colour (it stays there while Sam walks and aims on)
    this.cmdRing.update(game, cam, w, h, tz);
    { const om = game.orders.mark(), el = this.orderMark; let shown = false;
      if (om) { const [ox, oy, ov] = cam.project(om.at, w, h, EDGE); if (ov) { shown = true; el.className = om.tone ? `ordermark t-${om.tone}` : 'ordermark'; el.style.left = `${ox.toFixed(1)}px`; el.style.top = `${oy.toFixed(1)}px`; const sp = el.lastChild as HTMLElement; const t = keyText(om.text); if (sp.textContent !== t) sp.textContent = t; } }
      el.style.display = shown ? 'block' : 'none'; }
    this.squadThrow.update(game, cam, w, h, EDGE);
    this.attention.update(game, cam, w, h, EDGE);
    this.picture.update(game, cam, w, h, EDGE);
    // throw preview
    const pv = game.player.throwPreview;
    if (pv && pv.points.length > 1) {
      const pts: string[] = [];
      for (const p of pv.points) { const [x, y, vis] = cam.project(p, w, h, EDGE); if (vis) pts.push(`${x.toFixed(1)},${y.toFixed(1)}`); }
      this.trajPath.setAttribute('points', pts.join(' ')); this.trajPath.style.display = 'block';
      { const short = previewTooClose(game); if (short !== this.trajShort) { this.trajShort = short; this.trajPath.style.stroke = this.trajLand.style.stroke = short ? HE40_SHORT_STROKE : ''; this.trajPath.style.strokeDasharray = short ? '3 7' : ''; } }   // (a 40 mm arc too short to arm: amber, broken — whatever the reticle is busy saying)
      // WHERE IT COMES TO REST (player.ts throwRest; null = the mark off, or the launcher's arc): reckoned again when the arc has changed, and four times a second under one held still (a door swung, a chair shoved)
      { const p0 = pv.points[0], k = `${p0[0].toFixed(2)},${p0[1].toFixed(2)},${p0[2].toFixed(2)},${pv.v0[0].toFixed(2)},${pv.v0[1].toFixed(2)},${pv.v0[2].toFixed(2)},${game.player.heldKind},${Math.floor(game.time * 4)}`; if (k !== this.restKey && (!this.restKey || (this.restN++ & 1) === 0)) { this.restKey = k; this.rest = throwRest(game); } }   // (every other frame under a moving cursor: the replay is some tenths of a millisecond, the ring trails the arc by a frame)
      const rest = this.rest, ring = rest ? rest.at : pv.land;
      const [lx, ly, lv] = cam.project(ring, w, h, EDGE); this.trajLand.style.display = lv ? 'block' : 'none'; this.trajLand.setAttribute('cx', lx.toFixed(1)); this.trajLand.setAttribute('cy', ly.toFixed(1));
      if (rest) {
        const [tx, ty, tv] = cam.project(pv.land, w, h, EDGE), far = Math.hypot(rest.at[0] - pv.land[0], rest.at[2] - pv.land[2]) > 0.3;   // (a can that stays where it lands needs no tick under its ring)
        this.trajTick.style.display = tv && far ? 'block' : 'none'; this.trajTick.setAttribute('cx', tx.toFixed(1)); this.trajTick.setAttribute('cy', ty.toFixed(1));
        const rp: string[] = []; if (far) for (const p of [pv.land, ...rest.path, rest.at]) { const [x, y, vis] = cam.project(p, w, h, EDGE); if (vis) rp.push(`${x.toFixed(1)},${y.toFixed(1)}`); }
        this.trajRoll.setAttribute('points', rp.join(' ')); this.trajRoll.style.display = rp.length > 1 ? 'block' : 'none';
      } else { this.trajTick.style.display = 'none'; this.trajRoll.style.display = 'none'; }
    } else { this.trajPath.style.display = 'none'; this.trajLand.style.display = 'none'; this.trajTick.style.display = 'none'; this.trajRoll.style.display = 'none'; this.restKey = ''; this.rest = null; }
    this.drawClose(game, cam, w, h);
    this.plan.update(game, cam, w, h);
    this.findme.update(game, cam, w, h, this.plan.youOn);
    // equipment
    this.updateEquip(game);
    // the wind field's debug view (nothing drawn, nothing sampled unless a switch of it is on)
    this.windViz.update(game, cam, w, h);
  }

  /** Interaction panel: `rows` top to bottom, `primary` = index of the highlighted row (what a Space tap does / letting go performs; -1: none), `more` = how
   *  many were left off the end, `open` = the selector is open (Space held: index.html #interact.open — the frame brightens, a header says let go to act,
   *  the cancel row is among the rows). The DOM is rebuilt only when the rows' text / reach / kind change; the distance and the progress bar are patched in
   *  place every frame. Hidden when there is nothing to list or a menu card is up. update() feeds it from the game's rows (deriveInteractions). */
  setInteractions(rows: InteractRow[], primary = -1, more = 0, open = false, hint = `let go to do it · wheel / ↑↓ chooses · ${backName()} backs out`, cancel = 'cancel — let go, do nothing') {
    if (!rows.length || this.menuEl.classList.contains('on')) { if (this.iaKey) { this.iaKey = ''; this.iaEl.className = ''; this.iaEl.textContent = ''; this.iaLive = []; } return; }
    const key = rows.map(r => `${r.kind}|${r.label}|${r.cont ? 1 : 0}|${r.tone ?? ''}|${r.opts.map(o => `${o.key}>${o.text}>${o.tone ?? ''}${o.mark !== undefined ? `~${o.mark}` : ''}`).join('/')}|${r.inReach ? 1 : 0}${r.off ? 1 : 0}${r.dist !== undefined ? 1 : 0}${r.progress !== undefined ? 1 : 0}`).join('\n') + `#${primary}#${more}#${open ? `1${hint}` : 0}#${cancel}#${KEYMAP.rev}`;
    if (key !== this.iaKey) {
      this.iaKey = key;
      this.iaEl.innerHTML = (open ? `<div class="selhint">${esc(keyText(hint))}</div>` : '') + rows.map((r, i) =>
        r.kind === 'cancel' ? `<div class="it k-cancel${i === primary ? ' primary' : ''}"><div class="opt"><kbd>×</kbd>${esc(keyText(cancel))}</div></div>`
        : `<div class="it k-${r.kind}${i === primary ? ' primary' : ''}${r.inReach ? '' : ' far'}${r.off ? ' off' : ''}${r.cont ? ' cont' : ''}${r.tone ? ` t-${r.tone}` : ''}">${r.cont ? '<div class="what"><em></em></div>' : `<div class="what"><span>${esc(r.label)}</span><em></em></div>`}`
        + r.opts.map((o, j) => o.key ? `<div class="opt${j === 0 && /^space$/i.test(o.key) ? ' verb' : ''}${o.tone ? ` t-${o.tone}` : ''}"><kbd>${esc(keyCap(o.key).toUpperCase())}</kbd>${esc(keyText(o.text))}</div>` : o.mark !== undefined ? `<div class="hint lost${o.tone ? ` t-${o.tone}` : ''}"><s>${esc(keyText(o.text))}</s>${o.mark ? `<b${o.mark.endsWith(' n') ? ' class="n"' : ''} style="transform:rotate(${parseInt(o.mark, 10)}deg)">→</b>` : ''}</div>` : `<div class="hint${o.tone ? ` t-${o.tone}` : ''}">${esc(keyText(o.text))}</div>`).join('')   // (.verb: the row's own Space verb — lit only on the highlighted row; the hint keys under it, LMB / E, are always live and never dimmed)
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
  private deriveInteractions(game: Game): { rows: InteractRow[]; primary: number; more: number; open: boolean; hint?: string; cancel?: string } {
    const sq = game.orders.hud(); if (sq.menu) return sq.menu;   // the squad's command menu, while it is open, IS the panel (orders.ts)
    const hv = game.hover, p = game.player.char.pos;
    const dist = (it: Interactable) => thingDist(it, p);   // doors: leaf or doorway centre, as the reach test measures it
    // (handring.ts: the corner shows ONE line, what the key would do now — the highlighted row, or a running verb's own; none while the ring's lit wedge
    // is the whistle — and nothing where it does nothing; the rest of what is on offer is the ring's. A line no key gives stays under it)
    const hint = (): Interactable[] => game.nearby.filter(r => !r.verb && r !== hv).slice(0, 1);   // (a line no key gives: the status of a committed move, or what the two clicks do to the man in reach — close.ts)
    const list: Interactable[] = !HANDRING.on || game.puppet ? game.nearby : hv && hv.kind !== 'cancel' && (hv.verb || hv.running) && !game.player.sel.ring?.whistle ? [hv, ...hint()] : hint();
    const thing = (it: Interactable) => `${it.kind}:${it.door?.def.name ?? it.guard?.callsign ?? ''}`;
    const cap = MAX_ROWS + (list.some(it => it.kind === 'cam') ? 1 : 0);   // (stickycam.ts: a stuck camera's 'take it back' is one row past every row the list had before it — it is always drawn)
    const rows = list.slice(0, cap).map((it, i): InteractRow => { const d = dist(it); return { kind: it.kind, label: it.line1, opts: it.kind === 'cancel' ? [] : parseOpts(it.line2), inReach: it.inReach, off: it.off, dist: it.inReach || it.kind === 'light' || it.kind === 'cancel' ? undefined : d, progress: it.progress, cont: i > 0 && it.kind !== 'cancel' && thing(list[i - 1]) === thing(it) }; });
    // (handring.ts `empty`: the key tapped with no row to give — said here for a moment, where his rows come up. `near`: beside a thing the word names
    // it, with how far off a door a step short is; every such tap answers, and the word is up only while it is still what a tap would say — a step into
    // reach, or away, takes it down. With `near` off, as it was: the log's newest line, while that is the word)
    if (HANDRING.empty && !list.length && !game.puppet && !game.player.down) { const S = game.player.sel, young = (t: number) => game.time >= t && game.time - t < EMPTY_SHOW_SECS;
      if (!HANDRING.near) { const m = game.messages[game.messages.length - 1]; if (m?.text === EMPTY_WORD && young(m.t)) rows.push({ kind: 'wall', label: EMPTY_WORD, opts: [], inReach: false, off: false }); }
      else if (S.word && young(S.wordT)) { const T = emptyThing(game);
        if (emptyWord(game, T) === S.word) rows.push({ kind: T ? T.it.kind : 'wall', label: S.word, opts: [], inReach: false, off: false, dist: T && T.why === EMPTY_WHY.far ? T.d : undefined }); } }
    rows.push(...sq.status);   // … and otherwise the squad's block under the Space rows: who the orders go to, what each man is doing (nothing without a squad)
    const primary = hv ? list.indexOf(hv) : -1;
    return { rows, primary: primary >= 0 && primary < cap ? primary : -1, more: Math.max(0, list.length - cap), open: game.player.listOpen };   // (up as a ring — cmdring.ts CMDRING.hands — the panel's list is the list at rest)
  }


  /** Kit column (bottom-left, standing on the meters): key strip, condition pips, then the slots top to bottom in KIT_ORDER — 1 the pistol (its OCP charge as the
   *  tagged meter at the row's end), 2 the FN2000 (a greyed 'not in this kit' row without it: the numbering is per item, so smoke is 3 in every kit), 3 smoke, 4
   *  stun. Rebuilt only when something it shows changes. */
  private updateEquip(game: Game) {
    const pl = game.player; const gun = pl.pistol; const rf = pl.rifle; const rifleSel = pl.rifleSel;
    const paceShow = game.time - pl.paceShownT < 2.5 || pl.pace < 0.99;   // pace ticks: shown for a moment after a wheel step, and kept while below full pace
    const rifleKey = pl.hasRifle ? [rf.chamber, rf.mag, rf.spare.join(','), rf.reloading ? 1 : 0, rf.mode, rf.attIdx, rf.rings, rf.shells, rf.attachments.length, rf.cams, rf.lightOn ? 1 : 0].join('/') : '-';   // (the rifle's row: rounds, the beat, SEMI / AUTO, the selected attachment and its rings, its light)
    const big = BIGSLOT.on && !game.touring ? pl.bigKit : 'none', bigAt = big === 'none' ? '' : big + (game.nearby.some(r => r.kind === 'door' && (r.verb === 'breach' || r.verb === 'hammer')) ? '!' : '') + (BIGSLOT.shut ? 's' : '');   // (the big slot's row: what he carries, and whether a door in reach offers it now)
    const key = [pl.slot, gun.chamber, gun.mag, gun.spare.join(','), gun.reloading ? 1 : 0, pl.canisters, pl.flashbangs, pl.frags, pl.throwKind, gun.lightOn ? 1 : 0, pl.nv ? 1 : 0, (Math.round(pl.ocp.charge * 20) + (pl.ocp.ready() ? 100 : 0)), pl.hitsLeft, pl.down ? 1 : 0, game.godMode ? 1 : 0, pl.holstered ? 1 : 0, paceShow ? Math.round(pl.pace * 100) : -1, [...pl.keys].join(','), rifleKey, GEAR.on ? 1 : 0, bigAt, KEYMAP.rev, HANDSLOT.on ? 1 : 0].join('|');   // (…and which kit's words the rows are in)
    if (SLOTSETUP.on) { const k2 = key + handBoxKey(game); if (k2 !== this.equipKey) { this.equipKey = k2; document.body?.classList?.toggle('handslot', HANDSLOT.on); drawHandBox(this.equip, game, paceShow, bigAt); } handBoxTick(game); return; }   // (ui/handbox.ts: the column as one box of what is in his hands and a strip of the rest — game/slotsetup.ts's switch)
    if (key === this.equipKey) return; this.equipKey = key;
    document.body?.classList?.toggle('handslot', HANDSLOT.on);   // (index.html: the put-away mark names E only while E is the way back — game/handslot.ts)
    const el = this.equip; el.textContent = ''; el.classList?.remove('hand', 'setup', 'pop');
    const mk = (tag: string, cls?: string, text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = cls === 'key' ? keyCap(text) : keyText(text); return e; };   // (.key: a slot's own cap)
    const selCls = (k: SlotKind) => pl.slot === k ? (pl.holstered ? ' sel holstered' : ' sel') : '';   // the selected row lit; put away (E) it is lit-dashed with 'holstered · E' ('slung · E' on the rifle's row)
    // key strip: the selected gun's light and night vision. The right button's business is on the rows themselves — the OCP's charge closes the pistol's, the RING
    // tag lights on the rifle's while the launcher is selected (nothing is worded beside the reticle any more but the 40 mm's too-close warning)
    const gad = mk('div', 'gadgets');
    gad.appendChild(mk('span', 'g' + ((rifleSel ? rf.lightOn : gun.lightOn) ? ' on' : ''), 'L LIGHT'));
    if (!game.rails?.locks('nvg')) gad.appendChild(mk('span', 'g' + (pl.nv ? ' on' : ''), 'N NIGHT VISION'));   // (a tutorial mission names no key it has not taught)
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
    /** a gun's row body: a pip per round the magazine holds, the chambered round, the count, a little box per spare drawn as full as it is. THE PIPS ARE DRAWN ON A
     *  LINE OF THEIR OWN under the row (index.html `#equip .slot .rounds`: the Mk 18's thirty made the row too long — the 10-11 play note); the element stays
     *  where it was in the row's markup, so the count, the spares and the tags close up and nothing that reads the row's order moves. */
    const gunRow = (row: HTMLElement, f: Firearm) => {
      const D = f.def; const inMag = f.mag ?? 0;
      const per = D.magCapacity > 60 ? 5 : D.magCapacity > 34 ? 2 : 1;   // (a belt of a hundred, a magazine of forty: a pip stands for five rounds, for two — the line stays the length the thirty made it)
      const rounds = mk('span', 'rounds'); for (let i = 0; i < Math.ceil(D.magCapacity / per); i++) rounds.appendChild(mk('i', i < Math.ceil(inMag / per) ? '' : 'spent')); if (f.chamber) rounds.appendChild(mk('i', 'chamber')); row.appendChild(rounds);
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
    // the spare boxes; then its launcher's two loads for the RIGHT button: RING ×n and 40MM ×n, the one that is UP lit (2 again with it in the hands flips them), the
    // other dim. 'holstered' here reads slung (index.html .slot.slung). Without the rifle in the kit the row stays, greyed, so 3 and 4 keep their numbers.
    if (pl.hasRifle) {
      const s2 = mk('div', 'slot slung' + selCls('rifle'));
      s2.appendChild(mk('span', 'key', '2'));
      s2.appendChild(mk('span', 'name', rf.reloading ? `${rf.def.short} · reloading` : rf.def.short));
      s2.appendChild(mk('span', 'tag on', rf.mode.toUpperCase()));   // (Z: the selector — always lit: the left button always fires rounds)
      gunRow(s2, rf);
      if (rf.attachments.includes('ring')) { const rg = mk('span', 'tag rings' + (rf.attachment === 'ring' ? ' on' : ''), `${ringTag()} ×${rf.rings}`); rg.title = gearText(`ring airfoils: lit = the load on the right button (2 again with the rifle up ${rf.attachments.includes('cam') ? 'steps to the next load' : 'flips to the 40 mm and back'}); a right click fires one, held it shows the arc first — head = out cold, body = staggered; spent, not retrievable`); s2.appendChild(rg); }   // (the shotgun in this slot has no launcher: no tag)
      if (rf.attachments.includes('he40')) { const sg = mk('span', 'tag rings shells' + (rf.attachment === 'he40' ? ' on' : ''), `${shellTag()} ×${rf.shells}`); sg.title = gearText('40 mm high-explosive grenades: 2 again with the rifle up puts them on the right button (lit) in place of the RING, a right click fires one, held it shows the arc first — it goes off on what it hits with a frag grenade\'s blast, but only past its arming distance (nearer: a dud); spent, not retrievable'); s2.appendChild(sg); }
      if (rf.attachments.includes('cam')) { const cg = mk('span', 'tag rings cams' + (rf.attachment === 'cam' ? ' on' : ''), `CAM ×${rf.cams}`); cg.title = 'sticky cameras: 2 again with the rifle up puts them on the right button (lit); a right click sends one to the first wall past the cursor, held it shows the arc first — it lifts the fog of war round what it watches'; s2.appendChild(cg); }   // (stickycam.ts: only on a rifle that was issued some)
      el.appendChild(s2);
    } else {
      const s2 = mk('div', 'slot absent'); s2.appendChild(mk('span', 'key', '2')); s2.appendChild(mk('span', 'name', rf.def.short)); s2.appendChild(mk('span', '', 'not in this kit')); s2.title = 'the start card / pause menu puts the rifle in the kit'; el.appendChild(s2);
    }
    // 3 / 4: smoke and stun canisters. Where the quick throw is on (quickthrow.ts: not in the page) "G" marks the one its key will use (the throwable selected last)
    const gKind = !QUICKTHROW.on ? '' : pl.throwKind === 'flash' && pl.flashbangs > 0 ? 'flash' : pl.canisters > 0 ? 'smoke' : pl.flashbangs > 0 ? 'flash' : '';
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
    // 5: fragmentation grenades (frag.ts) — selected with 5 and thrown with a click; the quick-throw key never takes one, in the fist or not
    const s5 = mk('div', 'slot' + selCls('frag'));
    s5.appendChild(mk('span', 'key', '5')); s5.appendChild(mk('span', 'name', 'frag'));
    const frags = mk('span', 'cans frags'); for (let i = 0; i < pl.frags; i++) frags.appendChild(mk('i')); s5.appendChild(frags);
    s5.appendChild(mk('span', '', pl.frags ? `×${pl.frags}` : 'empty'));
    el.appendChild(s5);
    // the big slot (kit.ts BIGSLOT, bigkit.ts): the hammer or the breaching shotgun is not a thing his hands select — it is worked AT A DOOR, on the key every
    // door is worked with. So its row carries that key where the others carry a digit and says where it works; it lights while a door in reach offers it (the
    // row by the door, player.ts). No row when he carries neither.
    if (big !== 'none') {
      const sb = mk('div', 'slot big' + (bigAt.includes('!') ? ' sel' : ''));
      sb.appendChild(mk('span', 'key', 'SPACE')); sb.appendChild(mk('span', 'name', big === 'shotgun' ? 'breaching shotgun' : 'hammer'));
      sb.appendChild(mk('span', '', BIGSLOT.shut ? 'at a shut door' : 'at a locked door'));
      el.appendChild(sb);
    }
  }
}

function esc(t: string): string { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
/** The aim ring's diameter (CSS px) for a cone of `spread` rad (± half per axis: the cone is spread wide) at `dist` metres: that width over the metres one CSS pixel
 *  covers at the camera's look-at depth, clamped 10‥`cap` (60; aimcost.ts hands `ringPx` while moving costs the shot). Pure — the QA probes read it (aim-probes.ts). */
export function aimRingPx(spread: number, dist: number, cam: { distance: number; fov: number }, viewH: number, cap = 60): number {
  const mPerCssPx = 2 * cam.distance * Math.tan(cam.fov / 2) / Math.max(200, viewH);
  return clamp(spread * dist / Math.max(mPerCssPx, 1e-4), 10, Math.max(10, cap));
}
