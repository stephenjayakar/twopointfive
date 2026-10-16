// The viewer's chrome without a browser: a small fake DOM (elements with classList / style / children / listeners, getElementById auto-creating the ids
// viewer.html has), a stand-in runtime with a REAL Character off the glTF (bones, animator outputs) and real LightSet / FollowCamera / stage / gait meter,
// then the real Ui on top: every scene ▸ variant is applied (the property sheet built for each), every selection kind selected (node / light / bone / item /
// stage / door / figure), the gear menu and the flat 'all knobs' list built, every panel refreshed and a few ticks run — any exception is a bug the page would
// have shown as a fatal. Also pokes the Panel's scrub field through its listeners (drag, arrows, Enter).   bun run tools/qa/viewer-ui.ts   (exit 1 on failure)
import { ROOT, fake, loadCharacter } from './headless.ts';

// ---------------------------------------------------------------- fake DOM
type Listener = (e: any) => void;
class Style { [k: string]: any; setProperty(k: string, v: string) { this[k] = v; } }
class ClassList { s = new Set<string>(); constructor(private el: El) {}
  add(...c: string[]) { c.forEach(x => this.s.add(x)); } remove(...c: string[]) { c.forEach(x => this.s.delete(x)); } contains(c: string) { return this.s.has(c); }
  toggle(c: string, force?: boolean) { const on = force ?? !this.s.has(c); if (on) this.s.add(c); else this.s.delete(c); return on; } toString() { return [...this.s].join(' '); } }
class El {
  nodeType = 1; id = ''; title = ''; value = ''; type = ''; min = ''; max = ''; step = ''; checked = false; placeholder = ''; spellcheck = false; inputMode = ''; tabIndex = 0; href = '';
  dataset: Record<string, string> = {}; style = new Style(); classList = new ClassList(this); childNodes: any[] = []; parentElement: El | null = null; listeners = new Map<string, Listener[]>();
  onclick: Listener | null = null; onchange: Listener | null = null; oninput: Listener | null = null; onkeydown: Listener | null = null; _text = '';
  constructor(public tagName: string) {}
  get className() { return this.classList.toString(); } set className(v: string) { this.classList.s = new Set(v.split(/\s+/).filter(Boolean)); }
  get children() { return this.childNodes.filter(c => c.nodeType === 1); }
  get firstChild() { return this.childNodes[0] ?? null; }
  appendChild(c: any) { if (c.parentElement) c.parentElement.removeChild(c); this.childNodes.push(c); c.parentElement = this; return c; }
  append(...cs: any[]) { for (const c of cs) this.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); }
  insertBefore(c: any, ref: any) { const i = this.childNodes.indexOf(ref); if (c.parentElement) c.parentElement.removeChild(c); if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c); c.parentElement = this; return c; }
  removeChild(c: any) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentElement = null; return c; }
  get textContent(): string { return this.nodeType === 3 ? this._text : this.childNodes.map(c => c.textContent).join(''); }
  set textContent(v: string) { if (this.nodeType === 3) { this._text = v; return; } for (const c of this.childNodes) c.parentElement = null; this.childNodes = []; if (v) { const t = doc.createTextNode(v); this.childNodes.push(t); t.parentElement = this; } }
  set innerHTML(v: string) { this.textContent = v; }
  querySelector(sel: string): El | null { const tag = sel.toUpperCase(); for (const c of this.children) { if (c.tagName === tag) return c; const d = c.querySelector(sel); if (d) return d; } return null; }
  addEventListener(t: string, f: Listener) { const a = this.listeners.get(t) ?? []; a.push(f); this.listeners.set(t, a); } removeEventListener(t: string, f: Listener) { const a = this.listeners.get(t) ?? []; const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); }
  dispatch(t: string, e: any = {}) { const ev = { target: this, preventDefault() {}, stopPropagation() {}, button: 0, clientX: 0, clientY: 0, shiftKey: false, altKey: false, ctrlKey: false, ...e }; for (const f of this.listeners.get(t) ?? []) f(ev); const h = (this as any)['on' + t]; if (h) h(ev); return ev; }
  contains(el: any): boolean { for (let p = el; p; p = p.parentElement) if (p === this) return true; return false; }
  closest() { return null; } getBoundingClientRect() { return { top: 0, left: 0, right: 300, bottom: 600, width: 300, height: 600 }; }
  focus() { doc.activeElement = this; } blur() { if (doc.activeElement === this) doc.activeElement = doc.body; this.dispatch('blur'); } select() {}
  setAttribute(k: string, v: string) { (this as any)[k] = v; }
}
const byId = new Map<string, El>();
const doc: any = {
  body: new El('BODY'), activeElement: null as any,
  createElement: (t: string) => new El(t.toUpperCase()), createTextNode: (s: string) => { const t = new El('#text'); t.nodeType = 3; t._text = String(s); return t; },
  getElementById: (id: string) => { let e = byId.get(id); if (!e) { e = new El(id === 'alloff' ? 'INPUT' : 'DIV'); e.id = id; byId.set(id, e); doc.body.appendChild(e); } return e; },
  createRange: () => ({ selectNodeContents() {} }), contains: (el: El) => doc.body.contains(el),
};
doc.activeElement = doc.body;
const winListeners = new Map<string, Listener[]>();
const store = new Map<string, string>();
const G = globalThis as any;
G.document = doc;
G.window = G; G.addEventListener = (t: string, f: Listener) => { const a = winListeners.get(t) ?? []; a.push(f); winListeners.set(t, a); }; G.removeEventListener = (t: string, f: Listener) => { const a = winListeners.get(t) ?? []; const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); };
G.innerWidth = 1600; G.innerHeight = 1000; G.devicePixelRatio = 1; G.getSelection = () => null;
G.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
G.location = { hash: '', search: '', pathname: '/viewer' };
G.history = { replaceState: (_a: unknown, _b: unknown, h: string) => { G.location.hash = h.startsWith('#') ? h : G.location.hash; } };
G.navigator = { clipboard: { writeText: async () => {} } };
const winDispatch = (t: string, e: any) => { for (const f of [...(winListeners.get(t) ?? [])]) f({ preventDefault() {}, stopPropagation() {}, ...e }); };

// ---------------------------------------------------------------- stand-in runtime: real Character, lights, camera, stage, gait meter; the engine a settings bag
const { Character } = await import(`${ROOT}/src/game/character.ts`);
const { LightSet, lightFromDef } = await import(`${ROOT}/src/render/lights.ts`);
const { FollowCamera } = await import(`${ROOT}/src/game/camera.ts`);
const { buildStage } = await import(`${ROOT}/src/scene/stage.ts`);
const { railLightDef, torchLightDef, rigBoxes, RIG } = await import(`${ROOT}/src/game/rigProps.ts`);
const { defaultSettings } = await import(`${ROOT}/src/engine.ts`);
const { defaultSmokeParams } = await import(`${ROOT}/src/smoke/smoke.ts`);
const { Sparks } = await import(`${ROOT}/src/game/sparks.ts`);
const { Tracers } = await import(`${ROOT}/src/game/tracers.ts`);
const fxm = await import(`${ROOT}/src/game/effects.ts`);
const { makeState, PLAYER_TINT, CHAR_ID } = await import(`${ROOT}/src/viewer/state.ts`);
const { GaitMeter } = await import(`${ROOT}/src/viewer/gait.ts`);
const { SCENES } = await import(`${ROOT}/src/viewer/scenes.ts`);
const { Ui } = await import(`${ROOT}/src/viewer/ui.ts`);
const { Panel } = await import(`${ROOT}/src/ui/panel.ts`);

let fails = 0; const bad = (m: string, e?: unknown) => { fails++; console.log('FAIL', m, e instanceof Error ? `\n  ${e.stack?.split('\n').slice(0, 4).join('\n  ')}` : e ?? ''); };
const attempt = (what: string, f: () => void) => { try { f(); } catch (e) { bad(what, e); } };

const ch = await loadCharacter();
const stage = buildStage(); const lights = new LightSet(fake('device'));
const calls: string[] = [];
const rt: any = {
  st: makeState(), stage, cam: new FollowCamera(), engine: { settings: defaultSettings(), timer: { results: new Map([['direct', 7.1], ['gather', 5.9]]), total: () => 13 }, passes: { bloom: 0.08, fxaaEnabled: true, setFxaa(v: boolean) { this.fxaaEnabled = v; } }, lights, width: 1600, height: 1000 },
  stageLights: stage.lights.map((ld: any) => lights.add(lightFromDef(ld))), railLight: lights.add(railLightDef(CHAR_ID, 60)), torchLight: lights.add(torchLightDef('flashlight0', CHAR_ID, 70, 7, 19)),
  smoke: { params: defaultSmokeParams(), stats: { live: 0, emitters: 0 }, clearAll() { calls.push('clearSmoke'); } }, sparks: new Sparks(fxm.sparks), tracers: new Tracers(lights, null), gunLine() { return 'AKS-74U —'; }, stageItems: { items: [] as any[] },
  quality: { current: 'high', adaptive: true, auto: true, apply(n: string) { this.current = n; } },
  gizmo: { selected: null as string | null, opacity: 0.9, busy: false, onSelect: () => {}, onChange: () => {}, node() { return rt.meta.find((m: any) => m.path === this.selected) ?? null; }, select(p: string | null) { if (p !== this.selected) { this.selected = p; this.onSelect(); } }, selectParent() {} },
  meta: [] as any[], dyn: [] as any[], messages: [] as any[], clipNames: [...ch.clips.keys()].sort(), gait: new GaitMeter(ch), skyScale: 1, time: 0,
  char: null as any,
  spawn() { calls.push('spawn'); this.char = new Character(ch, { id: CHAR_ID, tint: [...PLAYER_TINT.tint], tint2: [...PLAYER_TINT.tint2], pos: [...stage.center], yaw: 0 }); this.char.update(0); },
  die(k: string) { calls.push('die:' + k); this.char.ragdollize(null, this.char.forward(), true); }, resetMotion() { calls.push('reset'); }, setPath(i: number) { this.st.path = i; }, setBodyYaw(d: number) { this.st.bodyYawDeg = d; },
  frame(k: string) { calls.push('frame:' + k); }, setSky(v: number) { this.skyScale = v; }, shoot() { calls.push('shoot'); }, fireTac(i: number) { calls.push('tac:' + i); }, toss(k: string) { calls.push('toss:' + k); this.stageItems.items.push({ kind: k, pos: [0, 0, 0], vel: [0, 0, 0], settled: false, age: 0, bounces: 0 }); },
  smokeCan() { calls.push('smokeCan'); }, stunCan() { calls.push('stunCan'); }, shot: async () => 'no frame', msg(t: string) { this.messages.push({ text: t, t: 0 }); if (this.messages.length > 4) this.messages.shift(); },
  hudLines() { return ['hud 1', 'hud 2', 'hud 3']; }, upperMode() { return 'relaxed'; },
};
rt.spawn();
/** what runtime.step does for the outliner: emit the props' node metadata for the current kit */
const emitMeta = () => { rt.meta.length = 0; rt.dyn.length = 0; const st = rt.st; rigBoxes(rt.char, st.guard ? { goggles: false, nv: false, slot: 1, lightOn: st.lightOn, isGuard: true, torch: st.guardTorch && !st.carbine, weapon: st.carbine ? 'carbine' : 'pistol', lensColor: [1, 1, 1] } : { goggles: st.goggles, nv: st.nv, slot: st.slot, lightOn: st.lightOn, isGuard: false, holster: true, knife: st.hold.knife }, rt.dyn, RIG, rt.meta); };

// ---------------------------------------------------------------- the Ui: boot, every variant, every selection kind, gear, all knobs, ticks
let ui: any = null;
attempt('Ui constructor (boot: groups, sheet, top bar, gear, first scene)', () => { ui = new Ui(rt); });
if (!ui) { console.log('cannot continue'); process.exit(1); }
G.__ui = ui;
if (rt.st.sceneId !== 'sam' || rt.st.variantId !== 'idle') bad(`boot scene: ${rt.st.sceneId}/${rt.st.variantId}`);
if (G.location.hash !== '#sam/idle') bad(`boot hash: ${G.location.hash}`);
let frame = 0; const tick = (n = 3) => { for (let i = 0; i < n; i++) { emitMeta(); rt.char.update(1 / 60); attempt(`tick ${rt.st.sceneId}/${rt.st.variantId} sel=${rt.st.sel}`, () => ui.tick(++frame)); } };
tick();
for (const s of SCENES) for (const v of s.variants) {
  attempt(`applyScene ${s.id}/${v.id}`, () => ui.applyScene(s.id, v.id));
  tick(2);
  attempt(`refresh sheet ${s.id}/${v.id}`, () => (ui as any).sheet.refresh());
  if (G.location.hash !== `#${s.id}/${v.id}`) bad(`hash after ${s.id}/${v.id}: ${G.location.hash}`);
}
// selections of every kind (Sam kit with the pistol drawn so rig nodes exist)
attempt('back to sam/walk', () => ui.applyScene('sam', 'walk')); tick(2);
if (!rt.meta.length) bad('no rig meta for the Sam kit');
rt.toss('pistol');
for (const sel of ['stage', 'figure', 'door', 'light:key', 'light:pistol_light', 'light:flashlight0', 'bone:head', 'bone:toeL', 'item:0', ...rt.meta.map((m: any) => 'rig:' + m.path), 'rig:carbine.gripL', 'rig:nonexistent.part', null]) {
  attempt(`select ${sel}`, () => ui.select(sel)); tick(1); attempt(`refresh after select ${sel}`, () => (ui as any).sheet.refresh());
  if (sel && !G.location.hash.includes('&sel=')) bad(`hash lacks sel for ${sel}: ${G.location.hash}`);
}
// the gizmo's own selection path (a click in the view)
attempt('gizmo select echo', () => { rt.gizmo.select(rt.meta[0].path); }); if (rt.st.sel !== 'rig:' + rt.meta[0].path) bad(`gizmo select did not reach the state: ${rt.st.sel}`); tick(1);
attempt('gizmo deselect echo', () => { rt.gizmo.select(null); }); if (rt.st.sel !== null) bad('gizmo deselect did not clear the state');
// hash → scene
G.location.hash = '#guard/carbine-shoulder&sel=' + encodeURIComponent('light:key');
attempt('applyHash', () => { if (!ui.applyHash()) bad('applyHash returned false'); });
if (rt.st.sceneId !== 'guard' || rt.st.variantId !== 'carbine-shoulder' || rt.st.sel !== 'light:key' || !rt.st.carbine || rt.st.longStance !== 3) bad(`hash apply: ${JSON.stringify({ s: rt.st.sceneId, v: rt.st.variantId, sel: rt.st.sel, carbine: rt.st.carbine, long: rt.st.longStance })}`);
tick(2);
G.location.hash = '#nope/never'; if (ui.applyHash()) bad('applyHash accepted an unknown scene');
// __viewer.scene-style switching through the state object is main.ts's; here the Ui method it calls:
attempt('applyScene hold/whip', () => ui.applyScene('hold', 'whip')); tick(2);
if (!rt.st.hold.on || rt.st.hold.phase !== 3 || rt.st.hold.variant !== 1 || rt.st.guard) bad(`hold/whip state: ${JSON.stringify(rt.st.hold)} guard ${rt.st.guard}`);
// gear + all knobs + overlays
attempt('toggleGear', () => { ui.toggleGear(true); (ui as any).gearPanel.refresh(); });
attempt('toggleAllKnobs (builds every group flat)', () => { ui.toggleAllKnobs(true); (ui as any).allPanel.refresh(); });
if (!ui.overlayOpen) bad('overlayOpen false with all-knobs up');
attempt('closeOverlays', () => ui.closeOverlays()); if (ui.overlayOpen) bad('overlays still open');
attempt('toggleInspector ×2', () => { ui.toggleInspector(); ui.toggleInspector(); });
// every button in the sheet, the gear menu and the flat list: click it (actions are stubs; group tools reset / copy for real)
let clicked = 0;
const clickAll = (root: El) => { const walk = (e: El) => { if (e.tagName === 'BUTTON' && e.onclick) { attempt(`click "${e.textContent}"`, () => e.onclick!({ target: e, stopPropagation() {}, preventDefault() {} })); clicked++; } for (const c of e.children) walk(c); }; walk(root); };
attempt('applyScene fx/muzzle for button sweep', () => ui.applyScene('fx', 'muzzle')); tick(2);
clickAll(doc.getElementById('props')); clickAll(doc.getElementById('gear')); clickAll(doc.getElementById('allknobs'));
tick(2);
// every checkbox / select in the flat list: flip it there and back through its handler
let flipped = 0;
const flipAll = (root: El) => { const walk = (e: El) => { if (e.tagName === 'INPUT' && e.type === 'checkbox' && e.onchange) { for (let k = 0; k < 2; k++) { e.checked = !e.checked; attempt('checkbox flip', () => e.onchange!({ target: e })); } flipped++; } if (e.tagName === 'SELECT' && e.onchange) { const n = e.children.length; if (n > 1) { const was = e.value; e.value = String((parseInt(was || '0', 10) + 1) % n); attempt('select change', () => e.onchange!({ target: e })); e.value = was || '0'; attempt('select restore', () => e.onchange!({ target: e })); } flipped++; } for (const c of e.children) walk(c); }; walk(root); };
flipAll(doc.getElementById('allknobs')); tick(2);
attempt('final refresh of every panel', () => { (ui as any).sheet.refresh(); (ui as any).gearPanel.refresh(); (ui as any).allPanel.refresh(); });

// ---------------------------------------------------------------- the scrub field on its own: drag 40 px = 20 steps, Shift fine, arrows, Enter
{
  const root = doc.createElement('div'); const p = new Panel({ root, header: false, persistKey: null }); const sec = p.section('t');
  let val = 1; const inp: El = p.number(sec, 'x', () => val, (v: number) => { val = v; }, { step: 0.5, min: -100, max: 100, def: 1 });
  inp.dispatch('mousedown', { clientX: 100, button: 0 }); winDispatch('mousemove', { clientX: 102 }); winDispatch('mousemove', { clientX: 140 }); winDispatch('mouseup', {});
  if (Math.abs(val - (1 + 20 * 0.5)) > 1e-9) bad(`scrub: expected ${1 + 20 * 0.5}, got ${val}`);
  inp.dispatch('mousedown', { clientX: 100, button: 0 }); winDispatch('mousemove', { clientX: 60, shiftKey: true }); winDispatch('mouseup', {});
  if (Math.abs(val - (11 - 20 * 0.05)) > 1e-9) bad(`fine scrub: expected ${11 - 1}, got ${val}`);
  const row = inp.parentElement!; if (!row.classList.contains('changed')) bad('changed class missing after scrub');
  inp.dispatch('mousedown', { clientX: 100, button: 0 }); winDispatch('mouseup', {});   // a click: focus for typing
  if (doc.activeElement !== inp) bad('click did not focus the field');
  inp.value = '3.25'; inp.dispatch('keydown', { key: 'Enter' }); if (Math.abs(val - 3.25) > 1e-9) bad(`Enter commit: ${val}`);
  inp.focus(); inp.value = String(val); inp.dispatch('keydown', { key: 'ArrowUp', altKey: true }); if (Math.abs(val - 8.25) > 1e-9) bad(`Alt+ArrowUp: ${val}`);
  const rev = row.children.find((c: El) => c.classList.contains('rev')); if (!rev) bad('no revert dot'); else { rev.onclick!({ stopPropagation() {} }); if (val !== 1) bad(`revert: ${val}`); if (row.classList.contains('changed')) bad('changed class after revert'); }
  let vec = [0, 0, 0]; p.numbers(sec, 'v', 3, (i: number) => vec[i], (i: number, v: number) => { vec[i] = v; }, { step: 0.001, steps: [0.001, 0.001, 0.5], defs: () => [0, 0, 0] });
  const vrow = sec.children[sec.children.length - 1]; const f3 = vrow.children.filter((c: El) => c.tagName === 'INPUT');
  if (f3.length !== 3) bad('numbers(): expected 3 fields'); else { f3[2].dispatch('mousedown', { clientX: 0, button: 0 }); winDispatch('mousemove', { clientX: 10 }); winDispatch('mouseup', {}); if (Math.abs(vec[2] - 2.5) > 1e-9) bad(`per-component step: ${vec[2]}`); }
}

// ---------------------------------------------------------------- the game's legacy panel path (new Panel() on #panel: header + 'all knobs', persisted open set, advanced sections)
{
  let x = 0.5, on = false, pick = 1;
  attempt('legacy Panel (the game\'s Tab panel)', () => {
    const p = new Panel(); const a = p.section('Frame'); const b = p.section('Deep', false, true);
    p.slider(a, 's', 0, 1, 0.1, () => x, (v: number) => { x = v; }); p.toggleBox(a, 't', () => on, (v: boolean) => { on = v; }); p.select(b, 'sel', ['a', 'b', 'c'], () => pick, (v: number) => { pick = v; }); p.buttons(b, 'go', [{ text: 'run', run: () => { x = 1; } }]); p.text(b, () => `x ${x}`);
    p.toggle(); p.refresh(); p.toggle(); p.prune();
    if (!doc.getElementById('panel').querySelector('input')) throw new Error('legacy panel built no header input');
  });
}

console.log(fails ? `${fails} FAILURES` : `OK — ${SCENES.reduce((n: number, s: any) => n + s.variants.length, 0)} variants applied with sheets built, ${rt.meta.length ? 'rig' : 'NO rig'} / light / bone / item / stage selections, gear + all knobs, ${clicked} buttons clicked, ${flipped} toggles / selects flipped, scrub field arithmetic`);
process.exit(fails ? 1 : 0);
