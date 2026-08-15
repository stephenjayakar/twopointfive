// Start card + pause menu (Esc): the same panel in two modes. Start: title, the controls at a glance, a Start button (and the
// tour). Pause: Resume / Restart plus three tabs — the player's Settings page (Display · Sound · Game · Sandbox; art constants and renderer trade-offs are the Tab panel's,
// hundred knobs), the full Controls list, and 'Run so far' (the debrief of the run as it stands: ui/debrief.ts). A third mode is the
// mission's debrief card proper — up on mission complete (Again / Keep playing) and, a beat after Sam drops, as the down card
// (Restart): the rating word and score, the numbers, the badges, the floor map with his path and the pins, the timeline. While it is
// open main.ts freezes the simulation and keeps rendering the frozen frame underneath. Plain DOM, styled in index.html (#menu…).
import { saveSandbox } from '../game/sandbox';
export { loadSandbox, saveSandbox, SANDBOX_LS } from '../game/sandbox';
import { Engine } from '../engine';
import { Game } from '../game/game';
import { renderDebrief } from './debrief';
import { Quality, QualityName } from './quality';
import { AudioEngine } from '../audio/audio';
import { Overlay } from './overlay';

export const CONTROLS: [string, string][] = [   // ONE short line per key (playtest 08-09: 'the start page is WAY too wordy') — the long forms live in README
  ['W A S D', 'move · Shift sprint · C crouch · wheel = walking pace (slower is quieter)'],
  ['Mouse', 'aim; the ring snaps to a man or a light near the cursor'],
  ['LMB', 'fire what is in hand · throw a canister · hands empty behind a man: silent takedown'],
  ['RMB', 'pistol: OCP the light under the ring · FN2000 with RING selected: fire a ring airfoil'],
  ['Space', 'do the highlighted action (top-left) · hold to pick another (wheel / ↑↓, let go) · long actions run on their own; move or tap again to stop'],
  ['E', 'holster / draw the selected item (on a wall: choose what comes back in hand)'],
  ['Q', 'back to the wall beside you — slide, peek at its end; Q / away / Shift lets go'],
  ['1 2 3 4', 'Five-seveN · FN2000 (2 again: cycle its attachment) · smoke · stun'],
  ['Z · G · R', 'FN2000 semi / auto · quick-throw the last canister · reload'],
  ['L · N · V', 'weapon light · night vision · whistle (the nearest man comes to look)'],
  ['Ctrl + mouse / wheel', 'orbit the camera / zoom (or pinch)'],
  ['Esc · Tab', 'pause & settings · every knob'],
];

const TAGLINE = 'a ray-traced stealth sandbox — every light, shadow and wisp of smoke is live';
/** the two showcase buttons on the start / pause cards — OFF for now (the designer, 08-13: 'let's just actually disable both scenes for now (remove from main menu)'); ?demo, ?breach,
 *  the P key and __night / __breach still run them for us */
export const SHOWCASE_BUTTONS = false;
const START_NOTES = [...(SHOWCASE_BUTTONS ? ['New here? NIGHT SHOWCASE is three minutes through the office after dark — the renderer and the stealth systems — then hands you the floor. DAY SHOWCASE is the same office at ten in the morning: two operatives take a held room, then it goes loud — a firefight down the aisles, smoke, and out into the lot. Hands off, two minutes.'] : []),
 
  'The job: reach the server room, pull the drive from the marked rack, leave by the fire exit. The line at the top says what is next.'];

/** THE BOOT CARD: the start card's own layout — title, the three buttons DISABLED, the notes and the controls — up from the first tick of main.ts while the GPU process compiles
 *  the renderer's kernels in the background (engine.ts init), with a one-line status ('compiling shaders 40 / 97 …') main.ts rewrites as they resolve. Menu.open('start')
 *  re-renders the real card over it the moment everything is ready (the buttons come alive in place); `off()` clears it for boots that open no card (?demo / ?breach). */
export function bootCard(): { status(text: string): void; off(): void } {
  const root = document.getElementById('menu')!;
  root.innerHTML = '';
  const card = el('div', 'card'); root.appendChild(card);
  const head = el('div', 'head'); head.innerHTML = `<div class="t1">two<b>point</b>six</div><div class="t2">${TAGLINE}</div>`; card.appendChild(head);
  const actions = el('div', 'actions');
  for (const [text, cls] of [['Start', 'primary'], ...(SHOWCASE_BUTTONS ? [['Night showcase', ''], ['Day showcase', 'breach']] as const : [])] as const) { const b = button(text, () => { /* not yet */ }, cls) as HTMLButtonElement; b.disabled = true; actions.appendChild(b); }
  card.appendChild(actions);
  const status = el('div', 'note bootstatus'); status.textContent = 'starting the GPU…'; card.appendChild(status);
  for (const t of START_NOTES) { const n = el('div', 'note'); n.textContent = t; card.appendChild(n); }
  const body = el('div', 'body'); card.appendChild(body);
  const list = el('div', 'controls');
  for (const [k, v] of CONTROLS) { const row = el('div', 'row'); const kk = el('div', 'k'); kk.textContent = k; const vv = el('div', 'v'); vv.textContent = v; row.append(kk, vv); list.appendChild(row); }
  body.appendChild(list);
  const foot = el('div', 'foot'); foot.textContent = 'Esc pauses · Tab opens every knob'; card.appendChild(foot);
  root.classList.add('on');
  return { status(text: string) { status.textContent = text; }, off() { root.classList.remove('on'); root.innerHTML = ''; } };
}

export interface MenuDeps { engine: Engine; game: Game; quality: Quality; audio: AudioEngine; overlay: Overlay; startTour: () => void; stopTour?: () => void; onStart: () => void; focusGame?: () => void;
  /** the daytime breach showcase (game/breach.ts) — absent when the level has no daylight variant / plan: no button then */
  startBreach?: () => void;
  /** checkpoints (game/savestate.ts): load the stored slot `key` into the game — main.ts stops any show first and snaps the camera after; returns why not, or null */
  loadCheckpoint?: (key: string) => string | null; }

export class Menu {
  private root: HTMLElement; private body!: HTMLElement; private tab: 'settings' | 'controls' | 'run' = 'settings';
  private qNote: HTMLElement | null = null;   // the settings tab's 'auto is currently on …' line, refreshed in place when a calibration settles under the open card
  mode: 'start' | 'pause' | 'debrief' | 'closed' = 'closed';
  constructor(private d: MenuDeps) {
    this.root = document.getElementById('menu')!;
    this.root.addEventListener('mousedown', e => e.stopPropagation());      // clicks in the menu never reach the game canvas
    this.root.addEventListener('contextmenu', e => e.preventDefault());
  }
  get isOpen() { return this.mode !== 'closed'; }
  /** Auto's calibration has just settled (main.ts wires Quality.onCalibrated): say so on the open card without rebuilding it under the player's mouse. */
  refreshQualityNote() { if (this.isOpen && this.qNote?.isConnected) this.qNote.textContent = this.displayNote(); }

  open(mode: 'start' | 'pause' | 'debrief') { this.mode = mode; this.render(); this.root.classList.add('on'); }
  close() { if (this.mode === 'start') this.d.onStart(); this.mode = 'closed'; this.root.classList.remove('on'); this.d.focusGame?.(); }   // keys go to the game, not the (now hidden) button that had focus
  toggle() { if (this.isOpen) this.close(); else this.open('pause'); }

  private render() {
    const r = this.root; r.innerHTML = '';
    const card = el('div', 'card'); r.appendChild(card);
    if (this.mode === 'debrief') { card.classList.add('wide'); this.debrief(card); return; }
    if (this.mode === 'pause' && this.tab === 'run') card.classList.add('wide');   // the run-so-far tab wants the map beside the numbers
    const head = el('div', 'head');
    head.innerHTML = `<div class="t1">two<b>point</b>six</div><div class="t2">${this.mode === 'start' ? TAGLINE : 'paused'}</div>`;
    card.appendChild(head);
    const actions = el('div', 'actions');
    const primary = button(this.mode === 'start' ? 'Start' : 'Resume', () => this.close(), 'primary');
    actions.appendChild(primary);
    if (SHOWCASE_BUTTONS) actions.appendChild(button('Night showcase', () => { this.close(); this.d.startTour(); }));
    if (SHOWCASE_BUTTONS && this.d.startBreach) { const sb = this.d.startBreach; actions.appendChild(button('Day showcase', () => { this.d.stopTour?.(); this.close(); sb(); }, 'breach')); }   // (a running tour ends first; the breach itself refuses to start over one)
    if (this.mode === 'pause') { const ck = this.checkpointButton(); if (ck) actions.appendChild(ck); }   // 'Restart from checkpoint (40 s ago)' when one is stored (game/savestate.ts) — beside Resume here; on the down card it is THE default
    if (this.mode === 'pause') actions.appendChild(button('Restart encounter', () => { this.d.stopTour?.(); this.d.game.restartEncounter(); this.close(); }));   // (a running tour / breach ends first: its beat must not keep puppeting the fresh encounter)
    card.appendChild(actions);
    if (this.mode === 'start') { for (const t of START_NOTES) { const n = el('div', 'note'); n.textContent = t; card.appendChild(n); } this.sandboxRow(card); }   // (no loadout choice: the FN2000 is always in the kit — playtest 08-09)
    if (this.mode === 'pause') {
      const tabs = el('div', 'tabs');
      for (const t of ['settings', 'controls', 'run'] as const) { const b = button(t === 'settings' ? 'Settings' : t === 'controls' ? 'Controls' : 'Run so far', () => { this.tab = t; this.render(); }, this.tab === t ? 'tab on' : 'tab'); tabs.appendChild(b); }
      card.appendChild(tabs);
    }
    this.body = el('div', 'body'); card.appendChild(this.body);
    if (this.mode === 'start' || this.tab === 'controls') this.controls(this.mode === 'start');
    else if (this.mode === 'pause' && this.tab === 'run') renderDebrief(this.body, this.d.game);   // the debrief of the run as it stands (nothing to press but 'copy summary': Resume / Restart are the card's own, above)
    else this.settings();
    const foot = el('div', 'foot'); foot.textContent = this.mode === 'start' ? 'Esc pauses · Tab opens every knob' : 'Esc to resume'; card.appendChild(foot);
    setTimeout(() => primary.focus(), 0);
  }

  /** The debrief card (main.ts opens it whenever game.mission.debrief is raised): on MISSION COMPLETE — Again = a fresh encounter (and mission), Keep playing / Esc =
   *  back to the sandbox with the mission left done — and, a beat after Sam goes DOWN, as the down card — Restart (or Esc back to the floor, where Enter restarts
   *  as it always has). The contents are ui/debrief.ts's: rating + score, the numbers, the badges, the map, the timeline. */
  private debrief(card: HTMLElement) {
    const g = this.d.game; const down = g.mission.stage !== 'done';
    const shown = performance.now();
    const restart = () => { if (performance.now() - shown < 500) return; this.d.stopTour?.(); g.restartEncounter(); this.close(); };   // (armed after half a second: the card appears mid-stride, often a Space-tap after the fire door — that tap must not restart the run unseen)
    const info = down ? this.checkpointInfo() : null; const mine = !!info && g.saves.isThisRun(info);   // DOWN with a checkpoint of THIS run stored: 'Restart from checkpoint (N s ago)' is the default (focused, Enter — the bare key does the same before the card is up); an earlier run's is offered but never the default
    const ck = info ? this.checkpointButton(mine ? 'primary' : '', () => performance.now() - shown >= 500) : null;
    const primary = button(down ? 'Restart encounter' : 'Again', restart, ck && mine ? '' : 'primary');
    const actions: HTMLElement[] = down ? (ck ? (mine ? [ck, primary] : [primary, ck]).concat([button('Back to the floor', () => this.close())]) : [primary, button('Back to the floor', () => this.close())]) : [primary, button('Keep playing', () => this.close())];
    this.body = el('div', 'body'); card.appendChild(this.body);
    renderDebrief(this.body, g, actions);
    const foot = el('div', 'foot'); foot.textContent = down ? (ck && mine ? 'Enter goes back to the checkpoint · Shift+Enter restarts the encounter · Esc closes this' : 'Esc closes this · Enter or Shift+Enter restarts') : 'Esc keeps playing · Shift+Enter restarts any time · Esc ▸ Run so far shows this for a run in progress'; card.appendChild(foot);
    setTimeout(() => (ck && mine ? ck : primary).focus(), 0);
  }
  /** 'Restart from checkpoint (40 s ago)' for the newest stored checkpoint (this run's for choice), or null when there is none / no loader is wired: loads it
   *  through main.ts (any show stopped, the camera snapped) and closes the card; a refusal goes on the message line and re-renders the card. `armed`: the down
   *  card's half-second guard against the tap that raised it. */
  private checkpointButton(cls = '', armed: () => boolean = () => true): HTMLElement | null {
    const g = this.d.game, load = this.d.loadCheckpoint; if (!load) return null;
    const info = this.checkpointInfo(); if (!info) return null;
    return button(`Restart from checkpoint (${g.saves.ageWords(g, info)})`, () => { if (!armed()) return; const why = load(info.key); if (why) { g.msg(`checkpoint: ${why}`); this.render(); return; } this.close(); }, cls);
  }
  /** the slot the cards offer: this run's newest at or before now on the mission clock, else an earlier run's newest (null: none / no loader) */
  private checkpointInfo() { const g = this.d.game; return this.d.loadCheckpoint ? g.saves.newest(true, g.mission.stats.elapsed) : null; }

  private controls(brief: boolean) {
    const list = el('div', 'controls');
    for (const [k, v] of brief ? CONTROLS : CONTROLS) { const row = el('div', 'row'); const kk = el('div', 'k'); kk.textContent = k; const vv = el('div', 'v'); vv.textContent = v; row.append(kk, vv); list.appendChild(row); }
    this.body.appendChild(list);
  }

  /** the START card's sandbox row (the designer's ask, 08-12): god mode · guards don't think · unlimited ammo (magazines, canisters, rings) — set before the first frame,
   *  kept per machine (`SANDBOX_LS`), the same three flags the pause card's Settings ▸ Game and Tab ▸ Sandbox flip */
  private sandboxRow(card: HTMLElement) {
    const game = this.d.game; const row = el('div', 'sandbox');
    const box = (label: string, key: 'god' | 'noAi' | 'ammo', get: () => boolean, set: (v: boolean) => void, title: string) => { const l = el('label') as HTMLLabelElement; l.title = title; const i = el('input') as HTMLInputElement; i.type = 'checkbox'; i.checked = get(); i.onchange = () => { set(i.checked); saveSandbox(game, key); }; l.appendChild(i); l.appendChild(document.createTextNode(' ' + label)); row.appendChild(l); };
    box('god mode', 'god', () => game.godMode, v => { game.godMode = v; }, 'they still see and shoot you; hits do nothing');
    box('no AI', 'noAi', () => !game.aiEnabled, v => { game.aiEnabled = !v; }, 'the guards stand where they are: nobody sees, hears or thinks');
    box('unlimited ammo', 'ammo', () => game.infiniteAmmo, v => { game.infiniteAmmo = v; }, 'bottomless magazines (rounds still cycle and reload), smoke and stun canisters, ring airfoils');
    card.appendChild(row);
  }

  /** SETTINGS — the player's page (the designer, 08-13: 'make the graphics choices well thought out, and don't add stuff like nvg phosphor — art constants are not for
   *  the player to edit'). Three groups and nothing else: DISPLAY = the one real graphics decision (a quality tier, or Auto) said in the player's terms with what it costs on
   *  THIS machine live under it, the resolution it renders at, whether it may drop resolution to hold frame rate, brightness, a frame-rate read-out; SOUND = the four buses;
   *  GAME = autosave, the interaction hints, and the sandbox cheats named as cheats. Bloom / grain / phosphor / exposure-as-art, every renderer trade-off and every experiment
   *  live on the Tab panel where they belong; a preset owns its own trade-offs. */
  private settings() {
    const { engine, game, quality, audio, overlay } = this.d; const S = engine.settings;
    // ---------------------------------------------------------------- DISPLAY
    const g1 = group(this.body, 'Display');
    const TIERS: { v: 'auto' | QualityName; label: string; line: string }[] = [
      { v: 'auto',    label: 'Auto (recommended)', line: 'Measures this GPU for a couple of seconds behind the card, picks the tier and resolution that hold a steady frame rate, and keeps trimming as the scene changes. Never picks Ultra.' },
      { v: 'ultra',   label: 'Ultra',   line: 'The reference picture: every shadow ray, characters shadowed by their real mesh, reflections at full rate. For desktop GPUs with headroom — roughly twice High\'s cost.' },
      { v: 'high',    label: 'High',    line: 'The intended look. Ray-traced light and shadow, traced bounce light, volumetric beams and smoke, reflections in polished floors and glass. The tier the game is tuned on.' },
      { v: 'medium',  label: 'Medium',  line: 'The same lighting with the bounce light and the beams computed at reduced resolution and fewer shadow rays. Softer contact shadows; most people cannot tell in motion.' },
      { v: 'low',     label: 'Low',     line: 'For thin laptops: lower internal resolution, coarser bounce light, no ray-traced reflections. Still fully dynamic light — nothing is baked.' },
      { v: 'verylow', label: 'Very low', line: 'Integrated graphics: half resolution and one shadow ray per light with more temporal reuse. Grainy in the dark, but it plays.' },
    ];
    const cur = (): 'auto' | QualityName => quality.auto ? 'auto' : quality.current;
    { const r = rowOf(g1, 'Graphics quality'); const sel = el('select') as HTMLSelectElement;
      for (const t of TIERS) { const o = el('option') as HTMLOptionElement; o.value = t.v; o.textContent = t.label; sel.appendChild(o); }
      sel.value = cur(); sel.onchange = () => { const v = sel.value as 'auto' | QualityName; if (v === 'auto') quality.setAuto(); else quality.pin(v); this.render(); }; r.appendChild(sel); }
    { const n = el('div', 'note'); n.textContent = TIERS.find(t => t.v === cur())!.line; g1.appendChild(n); }
    this.qNote = null;
    { const n = el('div', 'note'); this.qNote = n; n.textContent = this.displayNote(); g1.appendChild(n); }   // what it is doing on THIS machine, live (refreshed when a calibration settles under the open card)
    // resolution: relative to the tier's own cap; touching it under Auto pins the tier (Auto would otherwise take it straight back)
    slider(g1, 'Render resolution', 50, 100, 5, () => Math.round(S.renderScale * 100), v => { if (quality.auto) quality.pin(quality.current); S.renderScale = v / 100; if (this.qNote) this.qNote.textContent = this.displayNote(); },
      'per cent of the tier\'s full resolution the scene is rendered at before it is upscaled to the window (temporal upsampling keeps edges clean down to about 60 %); under Auto, moving this pins the current tier');
    toggle(g1, 'Lower resolution to hold frame rate', () => quality.adaptive, v => { quality.adaptive = v; }, 'when the frame rate dips (smoke, a firefight, a big window) the render resolution steps down a notch at a time and comes back when there is headroom — never below half');
    slider(g1, 'Brightness', 0.5, 2.5, 0.05, () => S.exposure, v => { S.exposure = v; }, 'exposure before the tone map — raise it if your display crushes the dark rooms, lower it if the sodium lamps blow out ([ and ] step it in play)');
    { const ro = (window as unknown as { __readout?: { on: boolean; set(v: boolean): void } }).__readout;
      if (ro) toggle(g1, 'Show frame rate', () => ro.on, v => ro.set(v), 'frame time and the GPU\'s milliseconds per pass in the top-left corner'); }
    // ---------------------------------------------------------------- SOUND
    const g2 = group(this.body, 'Sound');
    slider(g2, 'Master volume', 0, 1, 0.05, () => audio.volume.master, v => { audio.volume.master = v; audio.setVolumes(); });
    slider(g2, 'Effects', 0, 1, 0.05, () => audio.volume.sfx, v => { audio.volume.sfx = v; audio.setVolumes(); }, 'footsteps, doors, gunfire, voices, the radio');
    slider(g2, 'Ambience', 0, 1, 0.05, () => audio.volume.ambience, v => { audio.volume.ambience = v; audio.setVolumes(); }, 'room tone, the rain, the hum of the fixtures');
    slider(g2, 'Music', 0, 1, 0.05, () => audio.volume.music, v => { audio.volume.music = v; audio.setVolumes(); }, 'the score follows the tension on the floor; 0 turns it off');
    // ---------------------------------------------------------------- GAME
    const g3 = group(this.body, 'Game');
    toggle(g3, 'Autosave checkpoints', () => game.saves.enabled, v => { game.saves.setEnabled(v); this.render(); }, 'a checkpoint is written by itself when the mission moves on, when you first enter a room, when you hide a body and every minute and a half of quiet play — never while anyone is on to you; Enter on the down card loads the newest');
    toggle(g3, 'Interaction hints', () => overlay.showLightDots, v => { overlay.showLightDots = v; }, 'the faint dots marking what Space and the right button can act on — lights, doors, bodies');
    const g4 = group(this.body, 'Sandbox');
    note(g4, 'Cheats for looking around. They are remembered on this machine and shown on the start card.');
    toggle(g4, 'God mode', () => game.godMode, v => { game.godMode = v; saveSandbox(game, 'god'); }, 'they still see you and shoot you; hits do nothing');
    toggle(g4, 'Guards do not think', () => !game.aiEnabled, v => { game.aiEnabled = !v; saveSandbox(game, 'noAi'); }, 'the shift stands where it is: nobody patrols, hears or sees');
    toggle(g4, 'Unlimited ammunition', () => game.infiniteAmmo, v => { game.infiniteAmmo = v; saveSandbox(game, 'ammo'); }, 'bottomless magazines, canisters and ring airfoils');
  }
  /** the Display group's live line: tier (and whether Auto chose it), internal → output resolution, GPU milliseconds and what that is in frames per second */
  private displayNote(): string {
    const { engine, quality } = this.d;
    const gpu = engine.timer?.unionMs?.() ?? 0; const fps = gpu > 0.5 ? Math.min(240, 1000 / gpu) : 0;
    const res = engine.width && engine.outWidth ? `${engine.width}×${engine.height} rendered → ${engine.outWidth}×${engine.outHeight} shown` : '';
    const tier = quality.auto ? `Auto is running ${quality.current}${/^(auto|calibrat)/.test(quality.lastChange ?? '') ? ' — ' + quality.lastChange : ''}` : `${quality.current[0].toUpperCase()}${quality.current.slice(1)} (pinned)`;
    return [tier, res, gpu > 0.5 ? `GPU ${gpu.toFixed(1)} ms a frame (≈ ${fps.toFixed(0)} fps of headroom)` : ''].filter(Boolean).join(' · ');
  }
}


// ---- tiny DOM helpers (menu-local styling lives in index.html)
function el(tag: string, cls?: string) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function button(text: string, run: () => void, cls = '') { const b = el('button', 'btn ' + cls) as HTMLButtonElement; b.textContent = text; b.onclick = run; return b; }
function group(parent: HTMLElement, title: string) { const g = el('div', 'group'); const h = el('div', 'gtitle'); h.textContent = title; g.appendChild(h); parent.appendChild(g); return g; }
function note(parent: HTMLElement, text: string) { const n = el('div', 'note'); n.textContent = text; parent.appendChild(n); return n; }
function rowOf(parent: HTMLElement, label: string, title?: string) { const r = el('div', 'srow'); const l = el('label'); l.textContent = label; if (title) r.title = title; r.appendChild(l); parent.appendChild(r); return r; }
function slider(parent: HTMLElement, label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, title?: string) {
  const r = rowOf(parent, label, title); const i = el('input') as HTMLInputElement; i.type = 'range'; i.min = String(min); i.max = String(max); i.step = String(step); i.value = String(get());
  const val = el('span', 'val'); val.textContent = fmt(get(), step);
  i.oninput = () => { set(parseFloat(i.value)); val.textContent = fmt(get(), step); }; r.append(i, val);
}
function toggle(parent: HTMLElement, label: string, get: () => boolean, set: (v: boolean) => void, title?: string) {
  const r = rowOf(parent, label, title); const i = el('input') as HTMLInputElement; i.type = 'checkbox'; i.checked = get(); i.onchange = () => set(i.checked); r.appendChild(i);
}
function select(parent: HTMLElement, label: string, opts: string[], get: () => string, set: (v: string) => void, title?: string) {
  const r = rowOf(parent, label, title); const s = el('select') as HTMLSelectElement;
  for (const o of opts) { const oe = el('option') as HTMLOptionElement; oe.value = o; oe.textContent = o; s.appendChild(oe); }
  s.value = get(); s.onchange = () => set(s.value); r.appendChild(s);
}
function fmt(v: number, step: number) { const d = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3; return v.toFixed(d); }
