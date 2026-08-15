// The level editor without a browser or a GPU (lane G1b): the Editor core over levels/office.json on a stand-in engine (BoxWorld / LightSet on the
// fake device, exactly as headless.ts stands the Game up), the Scene / View / Tools / Api layers on top, the Ui on a small fake DOM (like
// viewer-ui.ts), the dev server's level-file handler called with Request objects, and level lint on planted faults.
//   editor-doc     __ed: add box → select → move → resize → rotate → duplicate → delete, undo / redo round trips (digest back to the original
//                  after a full undo), light add / edit / aim, door add + make-frame (= the generator's frame) + cut opening, route draw, volume
//                  add, marks move, rename, delete cascades / refusals, validate() clean, lint() clean, serialize → parse → structuralDiff 0,
//                  scene sync (statics ≡ data.boxes, area lights, day / night), the tools driven by a synthetic pointer (click select, drag move,
//                  footprint, door place, route clicks, marquee)
//   editor-ui      the page chrome on a fake DOM: build, select every kind (a sheet per kind), click every button, flip toggles, run validate +
//                  lint into the problems panel, the outliner, menus
//   editor-save    tools/levels-api.ts: POST writes (canonical, validated) + GET index / file / sidecar + every refusal (name, host, origin,
//                  content-type, the editor's X-Level-Editor header, invalid data, size); localStorage autosave slot + play stash (fake storage); a live server on a random port if it binds
//   editor-restore review pass 4's fixes: a resized marked box stays valid (markings re-fitted / dropped + reported, one command); an INVALID autosave OPENS with
//                  its problems listed and an unopenable one is HELD, never overwritten, until the user edits (persist.ts AutosaveSession); Glass survives a flag
//                  toggle; keypad rename → the door's lock; floor users incl. chokepoints / civilians / devices / connector ends; doc.transact rollback; prop-part
//                  markings in the scene; lint's mark-rows + BoxWorld.resetMarkTable; route / chokepoint name types
//   level-lint     lint(office) clean with its sidecar; each planted fault reported with the right code; the CLI's exit codes
//   bun run tools/qa/probes.ts editor | level-lint      (each prints PASS / FAIL lines and a closing '=== <family>: all PASS | N FAIL ===')
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, fake } from './headless.ts';

/** a plain, un-owned box of the loaded document as the probes' test subject (a hard-coded 'box_0400' broke when the QRF landing renumbered the office's
 *  generated ids on merge — pick one from whatever the document is) */
function tb2(ed: any): string { const first = tb(ed); const bs = ed.data.boxes; const i = bs.findIndex((b: any) => b.id === first); const nb = bs.slice(i + 1).find((b: any) => /^box_\d+$/.test(b.id) && !(ed.data.switchables || []).some((w: any) => w.boxes.includes(b.id)) && !(b.flags && b.flags.length)); return (nb || bs[i + 1] || bs[0]).id; }
function tb(ed: any): string { return (ed.data.boxes.find((b: any) => /^box_\d+$/.test(b.id) && !(ed.data.switchables || []).some((w: any) => w.boxes.includes(b.id)) && !(b.flags && b.flags.length)) || ed.data.boxes[0]).id; }

let failures = 0; let passes = 0;
function verdict(ok: boolean, what: string, detail = '') { if (ok) passes++; else failures++; console.log(`  ${ok ? 'PASS' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`); }
export function editorProbeFailures() { return failures; }
const attempt = <T>(what: string, f: () => T): T | undefined => { try { return f(); } catch (e) { verdict(false, what, `threw: ${(e as Error)?.stack?.split('\n').slice(0, 3).join(' | ') ?? e}`); return undefined; } };

// ---------------------------------------------------------------- fake DOM (enough for Panel, the sheet, the Ui, the overlay canvas)
type Listener = (e: any) => void;
class Style { [k: string]: any; setProperty(k: string, v: string) { this[k] = v; } }
class ClassList { s = new Set<string>(); add(...c: string[]) { c.forEach(x => this.s.add(x)); } remove(...c: string[]) { c.forEach(x => this.s.delete(x)); } contains(c: string) { return this.s.has(c); } toggle(c: string, force?: boolean) { const on = force ?? !this.s.has(c); if (on) this.s.add(c); else this.s.delete(c); return on; } toString() { return [...this.s].join(' '); } }
class El {
  nodeType = 1; id = ''; title = ''; value = ''; type = ''; min = ''; max = ''; step = ''; checked = false; disabled = false; placeholder = ''; spellcheck = false; inputMode = ''; tabIndex = 0; href = ''; download = ''; width = 300; height = 150; files: any = null; accept = '';
  dataset: Record<string, string> = {}; style = new Style(); classList = new ClassList(); childNodes: any[] = []; parentElement: El | null = null; listeners = new Map<string, Listener[]>();
  onclick: Listener | null = null; onchange: Listener | null = null; oninput: Listener | null = null; onkeydown: Listener | null = null; _text = '';
  constructor(public tagName: string) {}
  get className() { return this.classList.toString(); } set className(v: string) { this.classList.s = new Set(v.split(/\s+/).filter(Boolean)); }
  get children() { return this.childNodes.filter(c => c.nodeType === 1); }
  get firstChild() { return this.childNodes[0] ?? null; }
  get options() { return this.children.filter((c: El) => c.tagName === 'OPTION'); }
  get clientWidth() { return this.id === 'view' || this.id === 'olay' ? 1600 : 300; } get clientHeight() { return this.id === 'view' || this.id === 'olay' ? 1000 : 600; }
  appendChild(c: any) { if (c.parentElement) c.parentElement.removeChild(c); this.childNodes.push(c); c.parentElement = this; return c; }
  append(...cs: any[]) { for (const c of cs) this.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); }
  insertBefore(c: any, ref: any) { const i = this.childNodes.indexOf(ref); if (c.parentElement) c.parentElement.removeChild(c); if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c); c.parentElement = this; return c; }
  removeChild(c: any) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentElement = null; return c; }
  remove() { this.parentElement?.removeChild(this); }
  get textContent(): string { return this.nodeType === 3 ? this._text : this.childNodes.map(c => c.textContent).join(''); }
  set textContent(v: string) { if (this.nodeType === 3) { this._text = v; return; } for (const c of this.childNodes) c.parentElement = null; this.childNodes = []; if (v) { const t = doc.createTextNode(v); this.childNodes.push(t); t.parentElement = this; } }
  set innerHTML(v: string) { this.textContent = v; }
  querySelector(sel: string): El | null { return this.querySelectorAll(sel)[0] ?? null; }
  querySelectorAll(sel: string): El[] { const [tag, cls] = sel.split('.'); const T = tag.toUpperCase(); const out: El[] = []; const walk = (e: El) => { for (const c of e.children) { if ((!T || c.tagName === T) && (!cls || c.classList.contains(cls))) out.push(c); walk(c); } }; walk(this); return out; }
  addEventListener(t: string, f: Listener) { const a = this.listeners.get(t) ?? []; a.push(f); this.listeners.set(t, a); } removeEventListener(t: string, f: Listener) { const a = this.listeners.get(t) ?? []; const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); }
  dispatch(t: string, e: any = {}) { const ev = { target: this, preventDefault() {}, stopPropagation() {}, button: 0, clientX: 0, clientY: 0, shiftKey: false, altKey: false, ctrlKey: false, ...e }; for (const f of this.listeners.get(t) ?? []) f(ev); const h = (this as any)['on' + t]; if (h) h(ev); return ev; }
  click() { this.dispatch('click'); }
  contains(el: any): boolean { for (let p = el; p; p = p.parentElement) if (p === this) return true; return false; }
  closest() { return null; } getBoundingClientRect() { return { top: 0, left: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight }; }
  focus() { doc.activeElement = this; } blur() { if (doc.activeElement === this) doc.activeElement = doc.body; this.dispatch('blur'); } select() {}
  setAttribute(k: string, v: string) { (this as any)[k] = v; } getAttribute(k: string) { return (this as any)[k] ?? null; }
  getContext() { return fake('ctx2d'); }
}
const byId = new Map<string, El>();
const doc: any = {
  body: new El('BODY'), activeElement: null as any, hidden: false,
  createElement: (t: string) => new El(t.toUpperCase()), createTextNode: (s: string) => { const t = new El('#text'); t.nodeType = 3; t._text = String(s); return t; },
  getElementById: (id: string) => { let e = byId.get(id); if (!e) { e = new El(id === 'filepick' ? 'INPUT' : id === 'view' || id === 'olay' ? 'CANVAS' : 'DIV'); e.id = id; byId.set(id, e); doc.body.appendChild(e); } return e; },
  createRange: () => ({ selectNodeContents() {} }), contains: (el: El) => doc.body.contains(el),
};
doc.activeElement = doc.body;
const winListeners = new Map<string, Listener[]>();
const store = new Map<string, string>();
const G = globalThis as any;
G.document = doc; G.window = G;
G.addEventListener = (t: string, f: Listener) => { const a = winListeners.get(t) ?? []; a.push(f); winListeners.set(t, a); }; G.removeEventListener = (t: string, f: Listener) => { const a = winListeners.get(t) ?? []; const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); };
G.innerWidth = 1930; G.innerHeight = 1100; G.devicePixelRatio = 1; G.getSelection = () => null;
G.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
G.location = { hash: '', search: '', pathname: '/editor' };
G.history = { replaceState() {} }; G.navigator = { clipboard: { writeText: async () => {} } }; G.confirm = () => true; G.open = () => null;
G.URL.createObjectURL ??= () => 'blob:fake'; G.URL.revokeObjectURL ??= () => {};

// ---------------------------------------------------------------- modules
const { OFFICE_DATA } = await import(`${ROOT}/src/scene/level.ts`);
const { BoxWorld, BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { LightSet } = await import(`${ROOT}/src/render/lights.ts`);
const { defaultSettings } = await import(`${ROOT}/src/engine.ts`);
const { Editor } = await import(`${ROOT}/src/editor/editor.ts`);
const { Scene } = await import(`${ROOT}/src/editor/scene.ts`);
const { View } = await import(`${ROOT}/src/editor/view.ts`);
const { Tools } = await import(`${ROOT}/src/editor/tools.ts`);
const { Overlay } = await import(`${ROOT}/src/editor/overlay.ts`);
const { makeApi } = await import(`${ROOT}/src/editor/api.ts`);
const { doorFrameBoxes } = await import(`${ROOT}/src/editor/geom.ts`);
const { levelDataDigest, structuralDiff, canonicalLevelData, parseLevelData, validateLevelData, serializeLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { lintLevel, formatLint } = await import(`${ROOT}/src/editor/lint.ts`);
const persist = await import(`${ROOT}/src/editor/persist.ts`);
const officeAllow = JSON.parse(readFileSync(`${ROOT}/levels/office.lint.json`, 'utf8')).allow;

/** the editor stack on a stand-in engine + a synthetic pointer, as main.ts wires it (minus WebGPU / rAF) */
function standUpEditor(data: any = OFFICE_DATA) {
  const device = fake('device');
  const engine: any = { device, world: new BoxWorld(device), lights: new LightSet(device), settings: defaultSettings() };
  const ed = new Editor(data, { lintAllow: officeAllow });
  const scene = new Scene(engine, ed); const view = new View(); view.w = 1600; view.h = 1000;
  const tools = new Tools(ed, scene, view);
  const overlay = new Overlay(doc.getElementById('olay') as any, ed, tools, view);
  const ptr = { mouseX: 800, mouseY: 500, buttons: 0, clicked: 0, wheel: 0, wheelCtrl: 0, keys: new Set<string>(), pressed: new Set<string>() };
  const msgs: string[] = []; ed.onMsg = (t: string) => msgs.push(t);
  const step = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) { tools.update(ptr, dt); scene.preview = tools.previews(); scene.sync(); view.update(dt); engine.lights.update(dt, 0); engine.world.upload(); overlay.draw(); ptr.pressed.clear(); ptr.clicked = 0; ptr.wheel = 0; ptr.wheelCtrl = 0; } };
  const api = makeApi({ ed, tools, view, scene, step });
  const at = (ref: string) => { const p = ed.posOf(ref); const [x, y] = view.project(p!); return [x, y] as [number, number]; };
  const P = {   // synthetic pointer gestures (each runs the frames it needs)
    move(x: number, y: number) { ptr.mouseX = x; ptr.mouseY = y; step(1); },
    press(x: number, y: number) { ptr.mouseX = x; ptr.mouseY = y; ptr.buttons |= 1; ptr.clicked |= 1; step(1); },
    release(x?: number, y?: number) { if (x !== undefined) { ptr.mouseX = x; ptr.mouseY = y!; } ptr.buttons &= ~1; step(1); },
    click(x: number, y: number) { P.move(x, y); P.press(x, y); P.release(x, y); step(1); },
    drag(x0: number, y0: number, x1: number, y1: number, n = 8) { P.move(x0, y0); P.press(x0, y0); for (let i = 1; i <= n; i++) { ptr.mouseX = x0 + (x1 - x0) * i / n; ptr.mouseY = y0 + (y1 - y0) * i / n; step(1); } P.release(x1, y1); step(1); },
    key(code: string, held: string[] = []) { for (const h of held) ptr.keys.add(h); ptr.pressed.add(code); step(1); for (const h of held) ptr.keys.delete(h); },
  };
  step(2);
  return { engine, ed, scene, view, tools, overlay, api, ptr, step, msgs, at, P };
}

// ================================================================ editor-doc
export async function editorDoc() {
  console.log('\n=== editor-doc: the editor core + __ed + scene + tools, headless over levels/office.json ===');
  const S = standUpEditor(); const { ed, api, scene, engine } = S;
  const d0 = api.digest();
  verdict(d0 === levelDataDigest(OFFICE_DATA), 'boots on the office: the document digest is the bundled file\'s', d0);
  verdict(scene.nBoxes === OFFICE_DATA.boxes.length && engine.world.statics.length > scene.nBoxes && scene.stats.areaLights > 20 && engine.lights.lights.length === OFFICE_DATA.lights.length + scene.stats.areaLights, `scene: statics ≡ data.boxes (${scene.nBoxes}) + ${engine.world.statics.length - scene.nBoxes} prop / volume boxes · ${engine.lights.lights.length} lights (${scene.stats.areaLights} derived area lights) · ${engine.world.dynamics.length} door leaf boxes`, `sync ${scene.stats.lastMs.toFixed(1)} ms`);
  verdict(engine.world.statics.every((b: any, i: number) => i >= scene.nBoxes || (b.c[0] === OFFICE_DATA.boxes[i].c[0] && b.c[2] === OFFICE_DATA.boxes[i].c[2])), 'world.statics[i].c ≡ data.boxes[i].c for every data box (pick index → id is sound)');
  // ---- box ops round trip
  const id = api.box.add({ preset: 'crate', c: [10, 0, 18] });
  verdict(!!api.box.get(id) && api.selection()[0] === `box:${id}` && api.box.get(id).material === 'cardboard' && Math.abs(api.box.get(id).c[1] - 0.45) < 1e-9, `box.add(crate) → ${id}, selected, on the floor (c.y = h.y), palette material`, JSON.stringify(api.box.get(id)));
  S.step(1); verdict(scene.nBoxes === OFFICE_DATA.boxes.length + 1 && engine.world.statics[scene.nBoxes - 1].c[0] === 10, 'scene re-synced: the new box is a static at the end of the data range');
  api.move(`box:${id}`, [1, 0, 0.5]); api.box.resize(id, '+x', 1); api.box.rotate(id, Math.PI / 7, { snapDeg: 15 }); const dup = api.box.duplicate(id, [2, 0, 0]);
  const b = api.box.get(id);
  verdict(b.c[0] === 11.5 && b.c[2] === 18.5 && b.h[0] === 0.95 && Math.abs(b.yaw * 180 / Math.PI - 30) < 1e-3, 'move (+1, +0.5) → resize +x by 1 (centre follows the face) → rotate π/7 snapped to 15° = 30°', JSON.stringify({ c: b.c, h: b.h, yawDeg: +(b.yaw * 57.29578).toFixed(3) }));
  verdict(dup.length === 1 && api.box.get(dup[0]).c[0] === 13.5 && api.selection()[0] === `box:${dup[0]}`, `duplicate → ${dup[0]} at +2 x, selected`);
  api.box.delete([id, dup[0]]);
  verdict(!api.box.get(id) && !api.box.get(dup[0]) && api.selection().length === 0 && api.validate().length === 0, 'delete both: gone, selection pruned, document valid');
  const depthAfterOps = api.history().undo.length;
  let n = 0; while (ed.doc.canUndo) { api.undo(); n++; }
  verdict(api.digest() === d0, `full undo (${n} steps of ${depthAfterOps}) → digest back to the original`, api.digest());
  let m = 0; while (ed.doc.canRedo) { api.redo(); m++; }
  verdict(m === n && !api.box.get(id) && api.validate().length === 0, `full redo (${m}) → the same end state (boxes deleted again), valid`);
  while (ed.doc.canUndo) api.undo(); verdict(api.digest() === d0, 'and undo again → original digest (undo / redo are inverse)');
  // ---- deep stack: 120 nudges coalesce NOT (separate commands), all undoable
  { for (let i = 0; i < 120; i++) api.nudge('box:' + tb(ed), 0.25, 0); let k = 0; while (ed.doc.canUndo) { api.undo(); k++; } verdict(k === 120 && api.digest() === d0, `120 nudges = 120 undo steps (depth ≥ 100), digest back`, `maxDepth ${ed.doc.maxDepth}`); }
  // ---- coalesced drag: many small moves under one key = ONE command
  { api.select('box:' + tb(ed)); for (let i = 0; i < 40; i++) ed.move(['box:' + tb(ed)], [0.05, 0, 0], { coalesce: 'dragX' }); ed.doc.seal(); verdict(api.history().undo.length === 1 && Math.abs(api.box.get(tb(ed)).c[0] - ((OFFICE_DATA.boxes.find((b: any) => b.id === tb(ed)) as any).c[0] + 2)) < 1e-6, '40 coalesced moves → one undo step, +2.0 m', `undo ${api.history().undo.length}`); api.undo(); verdict(api.digest() === d0, 'one undo takes the whole drag back'); }
  // ---- lights
  { const L = api.light.add({ preset: 'down', pos: [10, 0, 18] }); const l = api.light.get(L); api.light.aim(L, [12, 0, 18]); const dir = api.light.get(L).dir;
    verdict(l.kind === 'spot' && l.pos[1] === 2.9 && Math.abs(Math.hypot(...dir) - 1) < 1e-5 && dir[0] > 0.5 && dir[1] < 0, `light.add(down) at the preset height (2.9), aim → unit dir toward the target`, JSON.stringify({ pos: l.pos, dir }));
    api.light.update(L, { intensity: 44, color: [1, 0.5, 0.25], group: 'lobby' }); S.step(1);
    const rt = scene.lightsById.get(L); verdict(!!rt && rt.intensity === 44 && rt.color[1] === 0.5 && engine.lights.lights.includes(rt), 'edit intensity / color / group → the engine light follows on the next sync');
    api.light.delete(L); S.step(1); verdict(!api.light.get(L) && !scene.lightsById.has(L), 'delete → gone from data and engine'); while (ed.doc.canUndo) api.undo(); }
  // ---- switchable make + day/night
  { const bid = api.box.add({ preset: 'panel', c: [8, 0, 20] }); const sw = api.switchable.of(bid); S.step(1);
    verdict(!!sw && sw.boxes[0] === bid && sw.on && scene.areaLights.some((a: any) => a.name.startsWith(sw.id)), `panel preset → box + switchable ${sw?.id} → a derived area light in the scene`, `${scene.stats.areaLights} area lights`);
    api.switchable.update(sw.id, { on: false }); S.step(1); const bx = engine.world.statics[ed.doc.indexOf('boxes', bid)];
    verdict(bx.emissive[0] === 0 && !scene.areaLights.find((a: any) => a.name.startsWith(sw.id))?.enabled, 'switch it off → the box goes dark and its area light is disabled (as game.ts updateTargets has it)');
    const nightSky = [...engine.settings.skyZenith]; api.day(true); S.step(1); const sunOn = !!scene.sun && engine.lights.lights.includes(scene.sun); const daySky = [...engine.settings.skyZenith]; api.day(false); S.step(1);
    verdict(sunOn && daySky[2] > nightSky[2] && !scene.sun && engine.settings.skyZenith[2] === nightSky[2], 'day(true) → the sun is in the light set and the sky is the daylight sky; day(false) → back to night exactly', `zenith ${nightSky.map(x => x.toFixed(3))} ↔ ${daySky.map((x: number) => x.toFixed(3))}`);
    while (ed.doc.canUndo) api.undo(); verdict(api.digest() === d0, 'undo the panel → original'); }
  // ---- doors: add + frame (= generator) + cut opening
  { const gen = (name: string) => doorFrameBoxes(api.door.get(name), { floor: 'f0' }).map((x: any) => [...x.c, ...x.h]); const file = (name: string) => OFFICE_DATA.boxes.filter((x: any) => x.group === `doorframe.${name}`).map((x: any) => [...x.c, ...x.h]);
    const same = (a: number[][], b2: number[][]) => a.length === b2.length && a.every((r, i) => r.every((v, k) => Math.abs(v - b2[i][k]) < 1e-9));
    const doorsOk = OFFICE_DATA.doors.every((dd: any) => same(gen(dd.id), file(dd.id)));
    verdict(doorsOk, `doorFrameBoxes(door) reproduces the generator's frame for all ${OFFICE_DATA.doors.length} office doors (jambs, head, stops within 1e-9)`);
    const D = api.door.add({ hinge: [12, 20.3], closedDir: Math.PI / 2, width: 1.0 }, { frame: true }); const fb = api.door.frameBoxes(D);
    verdict(fb.length === 5 && api.validate().length === 0 && api.selection()[0] === `door:${D}`, `door.add(+frame) → ${D} with 5 frame boxes in group doorframe.${D}, valid, selected`);
    S.step(1); verdict(scene.doors.some((x: any) => x.id === D) && engine.world.dynamics.length >= (OFFICE_DATA.doors.length + 1), 'its leaf is a dynamic box in the scene (game/doors.ts Door at the authored angle)');
    // a door in the corridor's north wall west of the storage door: cutting splits that wall slab
    const D2 = api.door.add({ hinge: [23.4, 10.0], closedDir: 0, width: 1.2 }); /* (a clear stretch of the corridor's north wall; a 1.2 m leaf: its 1.24 m gap is walkable on the 0.5 m nav grid wherever it falls; a 1.0 m one is not — lint says so) */ const plan = api.door.framePlan(D2); const before = api.box.count(); const cut = api.door.cutOpening(D2);
    verdict(plan.cut.remove.length >= 1 && cut.removed.length === plan.cut.remove.length && api.box.count() === before - cut.removed.length + cut.added.length && api.validate().length === 0, `cutOpening on a wall run: ${cut.removed.length} slab(s) → ${cut.added.length} pieces (runs + lintel), valid`, JSON.stringify(cut.removed));
    const gapClear = cut.obstructions.length === 0 && api.door.obstructions(D2).length === 0;
    verdict(gapClear, 'after the cut nothing solid stands in the doorway (cutOpening reports no obstructions)');
    { const D3 = api.door.add({ hinge: [27.4, 10.0], closedDir: 0, width: 1.2 }); const c3 = api.door.cutOpening(D3); verdict(c3.obstructions.length >= 1 && ed.lint().findings.some((f: any) => f.code === 'door-sides' && f.ids.includes(`door:${D3}`)), `a door cut under the corridor notice board: cutOpening reports the board as an obstruction (${c3.obstructions.join(' ')}) and lint calls the doorway unwalkable`); }
    const lintDoor = ed.lint().findings.filter((f: any) => f.ids.includes(`door:${D2}`));
    verdict(!lintDoor.some((f: any) => f.code === 'door-gap' || f.code === 'door-sides'), `lint has no door-gap / door-sides complaint about ${D2}`, lintDoor.map((f: any) => f.code).join(' '));
    let refused = ''; try { api.door.delete('server'); } catch (e) { refused = String((e as Error).message); }
    verdict(/used by objective 'reach_room'/.test(refused) && !!api.door.get('server'), 'deleting a door the mission / plans use is refused, nothing changes', refused.slice(0, 80));
    api.rename('door:server', 'server_main'); verdict(api.validate().length === 0 && ed.data.mission.objectives[0].door === 'server_main' && ed.data.plans.roomClear.some((p: any) => p.door === 'server_main') && api.box.byGroup('doorframe.server_main').length === 5, 'rename door → objectives, clear plans and the frame group follow; valid');
    while (ed.doc.canUndo) api.undo(); verdict(api.digest() === d0, 'undo all door work → original'); }
  // ---- routes / volumes / marks / props / materials / floors
  { const R = api.route.draw([[6, 0, 18], [10, 0, 18], [10, 0, 22]]); const r = api.route.get(R);
    verdict(r.points.length === 3 && r.wait.length === 3 && api.selection()[0] === `route:${R}` && S.tools.tool === 'select', `route.draw (the P tool scripted) → ${R}: 3 points, waits zeroed, selected, tool back to select`);
    api.route.movePoint(R, 1, [10.5, 0, 18.5]); api.route.insertPoint(R, 3, [6, 0, 22], 1.5); api.route.setWait(R, 0, 2); api.route.update(R, { weapon: 'aks74u', keys: ['floor'] });
    const r2 = api.route.get(R); verdict(r2.points.length === 4 && r2.wait[3] === 1.5 && r2.wait[0] === 2 && r2.points[1][0] === 10.5 && r2.weapon === 'aks74u' && api.validate().length === 0, 'movePoint / insertPoint(+wait) / setWait / weapon + keys → valid', JSON.stringify(r2));
    api.route.removePoint(R, 3); verdict(api.route.get(R).points.length === 3 && api.route.get(R).wait.length === 3, 'removePoint keeps wait aligned');
    const V = api.volume.add({ kind: 'hide', c: [6, 0.5, 21], h: [0.6, 0.5, 0.4] }); S.step(1);
    verdict(api.volume.get(V).kind === 'hide' && scene.volRanges.some((x: any) => x.id === V) && api.validate().length === 0, `volume.add(hide) → ${V}, drawn as outline sticks in the scene, valid`);
    const sp0 = api.mark.spawn(); api.mark.move('spawn', [0.5, 0, 0]); api.mark.move('mark:exfil', [0, 0, 0.25]); api.mark.objective('pull_drive', { halfW: 0.4 });
    verdict(api.mark.spawn()[0] === sp0[0] + 0.5 && ed.data.mission.objectives.find((o: any) => o.kind === 'exfil').z === 20.85 && ed.data.mission.objectives.find((o: any) => o.kind === 'drive').halfW === 0.4 && api.validate().length === 0, 'marks: spawn +0.5 x, exfil +0.25 z, drive halfW → valid');
    let refused = ''; try { api.delete('mark:spawn'); } catch (e) { refused = String((e as Error).message); } verdict(/cannot be deleted/.test(refused), 'marks refuse deletion (v1 wants one of each)');
    api.prop.move('chair0', 9, 14.5, 1); verdict(api.prop.get('chair0').x === 9 && api.prop.get('chair0').yaw === 1, 'prop.move');
    api.material.set('teal', [0.1, 0.5, 0.45]); api.box.paint(tb(ed), 'teal'); verdict(api.box.get(tb(ed)).material === 'teal' && !api.box.get(tb(ed)).albedo && api.validate().length === 0, 'material.set + paint → the box references the new palette entry');
    let mref = ''; try { api.material.remove('teal'); } catch (e) { mref = String((e as Error).message); } verdict(/paints 1 thing/.test(mref), 'removing a material in use is refused');
    const F = api.floors.add({}); verdict(ed.data.floors.length === 2 && api.floor(F).id === F && api.validate().length === 0, `floors.add → ${F} (y above the first), selectable as current, valid`); api.floor('f0');
    while (ed.doc.canUndo) api.undo(); verdict(api.digest() === d0 && ed.data.floors.length === 1, 'undo everything → original (one floor again)'); }
  // ---- delete cascade: a switchable's only box
  { const sw0 = ed.data.switchables[0]; api.box.delete(sw0.boxes); verdict(!ed.data.switchables.some((s: any) => s.id === sw0.id) && api.validate().length === 0, `deleting ${sw0.boxes.join(',')} removes its emptied switchable ${sw0.id}; valid`); api.undo(); verdict(api.digest() === d0, 'undo → back');
    let refused = ''; try { api.box.delete('breaker_panel'); } catch (e) { refused = String((e as Error).message); } verdict(/breaker's panel/.test(refused), 'the breaker\'s boxes refuse deletion'); }
  // ---- validate / lint / round trip on the untouched office
  verdict(api.validate().length === 0, 'validate() clean on the office');
  { const L = api.lint(); verdict(L.errors === 0 && L.warnings === 0, `lint() clean on the office with its sidecar allowances (${L.summary})`); }
  { const rt = api.roundTrip(); verdict(rt.n === 0, 'serialize → parse → structuralDiff against the document = 0', rt.first.join(' | ')); }
  verdict(api.serialize() === serializeLevelData(OFFICE_DATA), 'serialize() of the untouched document === the canonical file text');
  // ---- tools through the synthetic pointer
  { const { P, at, tools, view } = S; api.select(null); api.camera({ look: [10, 0, 18], yaw: 0, pitch: 1.1, dist: 12 }); S.step(1);
    const cid = api.box.add({ preset: 'crate', c: [10, 0, 18] }); api.select(null); S.step(1);
    const [cx, cy] = at(`box:${cid}`); P.move(cx, cy);
    verdict(tools.hover?.ref === `box:${cid}`, 'pointer over the crate → hover = the crate (CPU pick through the scene)', String(tools.hover?.ref));
    P.click(cx, cy); verdict(api.selection().join() === `box:${cid}`, 'click → selected');
    const c0 = api.box.get(cid).c; const [tx, ty] = view.project([c0[0] + 2, c0[1], c0[2]]); P.drag(cx, cy, tx, ty, 10);   // press-drag on the SELECTED crate = move
    const c1 = api.box.get(cid).c; verdict(Math.abs(c1[0] - (c0[0] + 2)) < 0.26 && Math.abs(c1[2] - c0[2]) < 0.26 && api.history().undo.slice(-1)[0].startsWith('drag'), `drag 2 m along +x → the crate follows on the floor, snapped (${c0[0]} → ${c1[0]}), ONE undo step '${api.history().undo.slice(-1)[0]}'`);
    api.undo(); verdict(api.box.get(cid).c[0] === c0[0], 'undo the drag → back where it was');
    // resize handle (S) then rotate ring (R, ctrl)
    P.key('KeyS'); S.step(1); const fh = tools.handles.find((h: any) => h.id === 'face0'); verdict(tools.mode === 'resize' && tools.handles.length === 6 && !!fh, 'S → resize mode: six face handles on the selected box');
    if (fh) { const h0 = api.box.get(cid).h[0]; const [ex, ey] = view.project([fh.p[0] + 1, fh.p[1], fh.p[2]]); P.move(fh.x, fh.y); verdict(tools.hot?.id === 'face0', 'pointer on the +x handle → hot'); P.drag(fh.x, fh.y, ex, ey, 8); verdict(api.box.get(cid).h[0] > h0 + 0.3, `drag it outward → h.x ${h0} → ${api.box.get(cid).h[0]}`); }
    P.key('KeyR'); S.step(1); const ring = tools.handles.find((h: any) => h.kind === 'ring'); verdict(tools.mode === 'rotate' && !!ring?.pts?.length, 'R → rotate mode: a yaw ring');
    if (ring) { const y0 = api.box.get(cid).yaw ?? 0; P.move(ring.pts[0][0], ring.pts[0][1]); S.ptr.keys.add('ControlLeft'); P.press(ring.pts[0][0], ring.pts[0][1]); for (let k = 1; k <= 6; k++) { S.ptr.mouseX = ring.pts[k][0]; S.ptr.mouseY = ring.pts[k][1]; S.step(1); } P.release(); S.ptr.keys.delete('ControlLeft'); const y1 = api.box.get(cid).yaw ?? 0; const deg = Math.abs((y1 - y0) * 180 / Math.PI); verdict(deg >= 15 && Math.abs(deg / 15 - Math.round(deg / 15)) < 1e-6, `ctrl-drag the ring → yaw changed by a multiple of 15° (${deg.toFixed(2)}°)`); }
    P.key('KeyG');
    // B footprint, D door, P route, marquee, Delete, Esc
    P.key('KeyB'); verdict(tools.tool === 'box', 'B → box tool'); const g0 = view.project([6, 0, 15]), g1 = view.project([9, 0, 15.5]); P.drag(g0[0], g0[1], g1[0], g1[1], 6);
    const nb = api.selection()[0]; const nbd = nb && api.box.get(nb.slice(4)); verdict(!!nbd && nbd.group === 'walls' && nbd.h[1] === 1.5 && Math.abs(nbd.h[2] - 0.06) < 1e-9 && nbd.h[0] >= 1.25 && tools.tool === 'select', `B-drag a wall footprint → ${nb}: 3 m tall, 12 cm thick, along the drag, tool back to select`, JSON.stringify(nbd && { c: nbd.c, h: nbd.h }));
    P.key('KeyD'); const h0 = view.project([12, 0, 16]), h1 = view.project([13.2, 0, 16]); P.drag(h0[0], h0[1], h1[0], h1[1], 5); const nd = api.selection()[0];
    verdict(!!nd && nd.startsWith('door:') && api.door.get(nd.slice(5)).closedDir === 0 && api.door.frameBoxes(nd.slice(5)).length === 5, `D press-drag → ${nd} facing +x with its frame (doorAuto)`, JSON.stringify(nd && api.door.get(nd.slice(5))));
    P.key('KeyP'); for (const q of [[5, 0, 20], [8, 0, 20], [8, 0, 23]] as [number, number, number][]) { const [x, y] = view.project(q); P.click(x, y); } verdict(tools.routeDraft?.length === 3, 'P + three clicks → a 3-point draft'); P.key('Enter'); const nr = api.selection()[0];
    verdict(!!nr && nr.startsWith('route:') && api.route.get(nr.slice(6)).points.length === 3 && tools.tool === 'select', `Enter → ${nr} with 3 points`);
    api.select(null); api.camera({ look: [8, 0, 18], yaw: 0, pitch: 1.35, dist: 16 }); S.step(1); const m0 = view.project([4, 0, 13]), m1 = view.project([12, 0, 23]); P.drag(Math.min(m0[0], m1[0]), Math.min(m0[1], m1[1]), Math.max(m0[0], m1[0]), Math.max(m0[1], m1[1]), 4);   // press on the (unselected) floor + drag = marquee
    verdict(api.selection().length > 5, `press-drag from unselected floor = marquee over the lobby → ${api.selection().length} things selected`);
    { api.select(null); const gid = api.box.add({ preset: 'crate', c: [8, 0, 18] }); api.select(null); S.step(1); const [gx, gy] = at(`box:${gid}`); const g0 = api.box.get(gid).c; const [gx2, gy2] = view.project([g0[0] + 1.5, g0[1], g0[2]]); P.drag(gx, gy, gx2, gy2, 6); verdict(api.box.get(gid).c[0] === g0[0] && tools.drag === null, 'press-drag starting on an UNSELECTED box does not move it (it selects, then marquees)'); api.select(`box:${gid}`); P.drag(gx, gy, gx2, gy2, 6); verdict(api.box.get(gid).c[0] > g0[0] + 1, '… once selected, the same press-drag moves it'); }
    const nSel = api.selection().length, nBox = api.box.count(); P.key('Delete'); verdict(api.box.count() < nBox || api.selection().length < nSel, `Delete → the selection is deleted (${nBox} → ${api.box.count()} boxes)`); api.undo(); verdict(api.box.count() === nBox, 'undo → all back');
    P.key('Escape'); verdict(api.selection().length === 0, 'Esc → selection cleared');
    P.key('KeyT'); verdict(view.plan && Math.abs(view.cam.pitch - 89.5 * Math.PI / 180) < 1e-6, 'T → plan view (pitch 89.5°)'); P.key('KeyT'); verdict(!view.plan, 'T again → orbit');
    P.key('KeyX'); verdict(!ed.settings.snap, 'X → snap off'); P.key('KeyX');
    S.ptr.buttons = 4; const yaw0 = view.cam.yaw; S.ptr.mouseX += 40; S.step(1); S.ptr.buttons = 0; S.step(1); verdict(view.cam.yaw !== yaw0, 'RMB drag → the camera orbits');
    S.ptr.wheel = -240; const dist0 = view.cam.desiredDistance; S.step(1); verdict(view.cam.desiredDistance < dist0, 'wheel → zoom in');
    while (ed.doc.canUndo) api.undo(); verdict(api.digest() === d0, 'undo the whole pointer session → original digest'); }
  // ---- load / blank
  { const name0 = api.data.name; api.blank('scratch'); verdict(api.data.name === 'scratch' && api.validate().length === 0 && api.history().undo.length === 0 && api.box.count() >= 1, 'blank level: valid v1 document (ground + breaker + marks + a door), stacks cleared'); const L = api.lint(); verdict(L.errors === 0, `blank level lints without errors (${L.summary})`);
    api.load(serializeLevelData(OFFICE_DATA)); verdict(api.data.name === name0 && api.digest() === d0, 'load(text of the office) → the office again, same digest'); }
}

// ================================================================ editor-ui
export async function editorUi() {
  console.log('\n=== editor-ui: the page chrome on a fake DOM — build, every selection kind, buttons, toggles, problems panel ===');
  const S = standUpEditor(); const { ed, api } = S;
  { const si = G.setInterval.bind(G); G.setInterval = (f: any, ms: number) => { const t: any = si(f, ms); t?.unref?.(); return t; }; }   // (Panel's 400 ms refresher must not keep the process alive after the probes)
  const { Ui } = await import(`${ROOT}/src/editor/ui.ts`);
  let ui: any = null; const calls: string[] = [];
  ui = attempt('Ui constructor (top bar, palette, outliner, sheet)', () => new Ui({ ed, tools: S.tools, view: S.view, scene: S.scene, quality: (n?: string) => { if (n) calls.push('q:' + n); return 'medium'; }, play: () => calls.push('play'), hudLine: () => 'hud', server: { available: false, list: [] } }));
  if (!ui) { verdict(false, 'cannot continue without a Ui'); return; }
  verdict(doc.getElementById('topbar').querySelectorAll('button').length >= 12 && doc.getElementById('palette').querySelectorAll('button').length >= 20, `built: ${doc.getElementById('topbar').querySelectorAll('button').length} top-bar buttons, ${doc.getElementById('palette').querySelectorAll('button').length} palette entries, ${doc.getElementById('outliner').children.length} outliner rows`);
  let frame = 0; const tick = (n = 2) => { for (let i = 0; i < n; i++) { S.step(1); attempt(`ui.tick sel=${api.selection()[0] ?? '-'}`, () => ui.tick(++frame * 10)); } };
  tick();
  // every selection kind builds a sheet
  const V = api.volume.add({ kind: 'utility', c: [6, 0.5, 21], h: [0.5, 0.5, 0.5] }); const F = api.floors.add({});
  const kinds: [string, string][] = [['none', ''], ['box', 'box:' + tb(ed)], ['box (switchable member)', `box:${ed.data.switchables[1].boxes[0]}`], ['multi', `box:${tb(ed)},box:${tb2(ed)},light:desk_lamp`], ['light spot', 'light:desk_lamp'], ['light dir', 'light:moon'], ['switchable', `sw:${ed.data.switchables[2].id}`], ['door', 'door:server'], ['route', 'route:corridor'], ['waypoint', 'route:corridor#2'], ['volume', `volume:${V}`], ['prop', 'prop:chair0'], ['chokepoint', `chokepoint:${ed.data.chokepoints[0].id}`], ['spawn', 'mark:spawn'], ['reach', 'mark:reach_room'], ['drive', 'mark:pull_drive'], ['exfil', 'mark:exfil'], ['floor', `floor:${F}`]];
  for (const [what, refs] of kinds) { attempt(`select ${what}`, () => api.select(refs ? refs.split(',') : null)); tick(1); const rows = doc.getElementById('props').querySelectorAll('div.row').length; verdict(rows > 0, `sheet for ${what}: ${rows} rows`); attempt(`refresh ${what}`, () => ui.sheet.refresh()); }
  // click every button in the sheet for a plain box and for the level (skipping destructive file ops), flip every checkbox / select there and back
  const clickAll = (root: El, skip: RegExp) => { let n = 0; for (const b of root.querySelectorAll('button')) { const t = b.textContent; if (skip.test(t)) continue; attempt(`click "${t}"`, () => b.onclick?.({ target: b, stopPropagation() {}, preventDefault() {} })); n++; } return n; };
  const flipAll = (root: El) => { let n = 0; for (const e of root.querySelectorAll('input')) if (e.type === 'checkbox' && e.onchange) { for (let k = 0; k < 2; k++) { e.checked = !e.checked; attempt('checkbox', () => e.onchange!({ target: e })); } n++; } for (const e of root.querySelectorAll('select')) if (e.onchange && e.options.length > 1) { const vals = e.options.map((o: El) => o.value); const was = vals.includes(e.value) ? e.value : vals[0]; e.value = vals[(vals.indexOf(was) + 1) % vals.length]; attempt('select', () => e.onchange!({ target: e })); e.value = was; attempt('select back', () => e.onchange!({ target: e })); n++; } return n; };
  api.select('box:' + tb(ed)); tick(1); const nb = clickAll(doc.getElementById('props'), /^delete$|^duplicate$/); const nf = flipAll(doc.getElementById('props')); tick(1);   // (delete / duplicate are exercised in editor-doc; here they would orphan the rest of the sheet's buttons mid-sweep)
  verdict(nb >= 10 && api.validate().length === 0, `box sheet: ${nb} buttons clicked, ${nf} toggles / selects flipped, document still valid`); while (ed.doc.canUndo) ed.doc.undo();
  api.select(null); tick(1); const nl = clickAll(doc.getElementById('props'), /^$/); verdict(nl >= 2 && api.validate().length === 0, `level sheet: ${nl} buttons clicked, valid`);
  api.select('light:desk_lamp'); tick(1); flipAll(doc.getElementById('props')); api.select('door:conference'); tick(1); clickAll(doc.getElementById('props'), /delete/); api.select('route:cubicles#1'); tick(1); clickAll(doc.getElementById('props'), /delete route/);
  verdict(api.validate().length === 0, 'light toggles, door buttons (cut / frame / select), waypoint buttons → still valid');
  // top bar: tools / modes / toggles / validate / lint / play; palette entries; outliner rows; menus
  const nt = clickAll(doc.getElementById('topbar'), /load|save/); flipAll(doc.getElementById('topbar')); tick(1);
  verdict(nt >= 12 && calls.includes('play'), `top bar: ${nt} buttons clicked (validate, lint, play, tools, modes, undo/redo)`, calls.join(' '));
  attempt('runChecks(lint)', () => ui.runChecks(true)); const probs = doc.getElementById('problems'); verdict(!probs.classList.contains('hidden') && probs.querySelectorAll('div').length >= 2, `lint → the problems panel opens (${probs.querySelectorAll('div.pf').length} rows)`);
  { ed.updateLight('storage_bulb', { pos: [20, 1.5, 10.0] }); attempt('runChecks(lint) with a planted fault', () => ui.runChecks(true)); const rows = probs.querySelectorAll('div.pf'); const bad = rows.find((r: El) => /light-in-solid/.test(r.textContent)); verdict(!!bad, 'a light moved into a wall shows as a light-in-solid row'); if (bad) { attempt('click the finding', () => bad.onclick?.({})); verdict(api.selection().includes('light:storage_bulb'), 'clicking the row selects the light (and frames it)'); } api.undo(); }
  const np = clickAll(doc.getElementById('palette'), /^$/); tick(1); verdict(np >= 20, `palette: ${np} entries clicked (presets arm their tool; stubs say why)`);
  S.tools.setTool('select');
  const rows = doc.getElementById('outliner').querySelectorAll('div.n'); let clicked = 0; for (const r of rows.slice(0, 60)) { attempt('outliner row', () => r.onclick?.({ stopPropagation() {}, shiftKey: false })); clicked++; } tick(1);
  verdict(clicked > 10, `outliner: ${clicked} rows clicked (groups expand, entities select)`);
  attempt('menus', () => { (ui as any).toggleMenu('loadmenu'); (ui as any).toggleMenu('savemenu'); clickAll(doc.getElementById('savemenu'), /download|server/); ui.closeMenus(); });
  verdict(store.has(persist.LS.autosave), 'save ▾ autosave now → the localStorage slot is written');
  attempt('final ticks', () => tick(3));
  while (ed.doc.canUndo) ed.doc.undo();
}

// ================================================================ editor-save
export async function editorSave() {
  console.log('\n=== editor-save: the dev server\'s /levels/ handler, the autosave slot, the play stash ===');
  const { handleLevels, NAME_RE, MAX_BYTES } = await import(`${ROOT}/tools/levels-api.ts`);
  const dir = mkdtempSync(join(tmpdir(), 'tps-levels-'));
  const H = 'localhost:5999'; const base = `http://${H}`;
  const req = (path: string, init: RequestInit & { host?: string } = {}) => { const headers = new Headers(init.headers ?? {}); headers.set('host', init.host ?? H); return new Request(base + path, { ...init, headers }); };
  const text = serializeLevelData(OFFICE_DATA);
  try {
    let r = await handleLevels(req('/levels/'), dir); verdict(r.status === 200 && (await r.json()).levels.length === 0, 'GET /levels/ on an empty dir → 200 []');
    r = await handleLevels(req('/not-levels'), dir); verdict(r === null, 'a non-/levels path → null (falls through to the static handler)');
    r = await handleLevels(req('/levels/probe_office.json', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Level-Editor': '1', Origin: base }, body: text }), dir);
    const j = await r.json(); verdict(r.status === 200 && j.ok && existsSync(join(dir, 'levels', 'probe_office.json')), 'POST a valid level → 200, levels/probe_office.json written', JSON.stringify(j));
    verdict(readFileSync(join(dir, 'levels', 'probe_office.json'), 'utf8') === text, 'the written file is the canonical serialization byte for byte');
    r = await handleLevels(req('/levels/'), dir); const idx = await r.json(); verdict(idx.levels.length === 1 && idx.levels[0].name === 'probe_office' && idx.levels[0].bytes === Buffer.byteLength(text) && j.bytes === Buffer.byteLength(text), 'GET /levels/ lists it with its size (UTF-8 bytes, = what the POST reported)');
    r = await handleLevels(req('/levels/probe_office.json'), dir); verdict(r.status === 200 && (await r.text()) === text, 'GET /levels/probe_office.json → the file');
    r = await handleLevels(req('/levels/probe_office.lint.json'), dir); verdict(r.status === 404, 'GET a missing sidecar → 404'); writeFileSync(join(dir, 'levels', 'probe_office.lint.json'), JSON.stringify({ allow: {} })); r = await handleLevels(req('/levels/probe_office.lint.json'), dir); verdict(r.status === 200, '… present → 200');
    // refusals
    const shuffled = JSON.stringify(JSON.parse(text)); r = await handleLevels(req('/levels/probe_office.json', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Level-Editor': '1' }, body: shuffled }), dir); verdict(r.status === 200 && readFileSync(join(dir, 'levels', 'probe_office.json'), 'utf8') === text, 'POST non-canonical JSON of the same level → stored canonical (re-serialized, not raw bytes)');
    for (const bad of ['../x.json', 'a/b.json', 'x.txt', '.json', 'x..json', 'x.lint.json/y', encodeURIComponent('../package') + '.json']) { r = await handleLevels(req(`/levels/${bad}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Level-Editor': '1' }, body: text }), dir); verdict(r === null ? bad.startsWith('../') : r.status === 400, `POST /levels/${bad} → ${r === null ? 'not a /levels/ path once the URL is normalized (serve.ts also refuses "..")' : '400'} (name must match ${NAME_RE})`, String(r?.status ?? 'null')); }
    r = await handleLevels(req('/levels/x.lint.json', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Level-Editor': '1' }, body: '{}' }), dir); verdict(r.status === 405, 'POST a sidecar → 405');
    r = await handleLevels(req('/levels/x.json', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: text }), dir); verdict(r.status === 415, 'POST text/plain → 415 (forces a preflight cross-origin)');
    r = await handleLevels(req('/levels/x.json', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' }, body: text }), dir); verdict(r.status === 403 && !existsSync(join(dir, 'levels', 'x.json')), 'POST from a foreign Origin → 403, nothing written');
    r = await handleLevels(req('/levels/x.json', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: text }), dir); verdict(r.status === 403 && /X-Level-Editor/.test((await r.json()).error) && !existsSync(join(dir, 'levels', 'x.json')), "POST same-origin JSON WITHOUT the editor's X-Level-Editor header → 403, nothing written (review T4.5)");
    r = await handleLevels(req('/levels/', { host: 'rebind.example:5999' }), dir); verdict(r.status === 403, 'a non-loopback Host (DNS rebinding) → 403 even for GET');
    r = await handleLevels(req('/levels/x.json', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Level-Editor': '1' }, body: '{ "version": 1 ' }), dir); verdict(r.status === 400, 'POST broken JSON → 400');
    r = await handleLevels(req('/levels/x.json', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Level-Editor': '1' }, body: JSON.stringify({ ...JSON.parse(text), version: 2 }) }), dir); const e = await r.json(); verdict(r.status === 422 && /validation/.test(e.error) && !existsSync(join(dir, 'levels', 'x.json')), 'POST a document that fails validateLevelData → 422 with the list, nothing written', e.errors?.[0]);
    r = await handleLevels(req('/levels/x.json', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Level-Editor': '1', 'Content-Length': String(MAX_BYTES + 1) }, body: 'x' }), dir); verdict(r.status === 413, 'an oversized body → 413');
    r = await handleLevels(req('/levels/x.json', { method: 'DELETE' }), dir); verdict(r.status === 405, 'DELETE → 405');
    // a live server on a random port, if this environment lets bun bind (best effort: the handler above is the contract)
    let live = 'skipped';
    try {
      const srv = Bun.serve({ port: 0, fetch: (rq: Request) => handleLevels(rq, dir).then((x: Response | null) => x ?? new Response('nf', { status: 404 })) });
      try { const rr = await fetch(`http://localhost:${srv.port}/levels/`); const jj = await rr.json(); live = rr.status === 200 && jj.levels.some((l: any) => l.name === 'probe_office') ? `port ${srv.port}: index lists probe_office` : `unexpected ${rr.status}`; const pw = await fetch(`http://localhost:${srv.port}/levels/live_write.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Level-Editor': '1' }, body: text }); live += pw.status === 200 && existsSync(join(dir, 'levels', 'live_write.json')) ? ' · POST wrote live_write.json' : ` · POST ${pw.status}`; } finally { srv.stop(true); }
      verdict(/index lists/.test(live) && /wrote/.test(live), `live Bun.serve round trip — ${live}`);
    } catch (e2) { console.log(`  note: no live server in this environment (${String((e2 as Error).message).slice(0, 60)}) — the handler contract above stands`); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  // autosave slot + play stash on the fake storage
  { const S = standUpEditor(); store.clear(); const slot = S.api.save.autosave();
    verdict(!!slot && store.has(persist.LS.autosave) && JSON.parse(store.get(persist.LS.autosave)!).digest === S.api.digest(), 'autosave() writes { name, t, digest, text } under twopointsix.editor.autosave');
    S.api.box.add({ preset: 'crate', c: [10, 0, 18] }); const d1 = S.api.digest(); S.api.save.autosave(); S.api.load(serializeLevelData(OFFICE_DATA)); const back = S.api.save.restoreAutosave();
    verdict(!!back && S.api.digest() === d1, 'edit → autosave → load something else → restoreAutosave → the edited document is back (digest)');
    const url = S.api.save.local(); verdict(store.has(persist.LS.play) && /level=local/.test(url) && levelDataDigest(parseLevelData(store.get(persist.LS.play)!)) === d1, `save.local() stashes the document under ${persist.LS.play} and returns ${url}`); }
}

// ================================================================ editor-materials: the Materials + Markings tabs' operations (paint.ts), their API, identity, the panes on the fake DOM
export async function editorMaterials() {
  console.log('\n=== editor-materials: paints (set / rename / remove / users / presets / overrides), markings (add / paint / generate / ascii / palette / paste), coalescing, serialize identity, the panes ===');
  const Pt = await import(`${ROOT}/src/editor/paint.ts`);
  const fileText = readFileSync(`${ROOT}/levels/office.json`, 'utf8');
  const S = standUpEditor(); const { ed, api, scene, engine } = S;
  const d0 = api.digest();
  verdict(api.serialize() === fileText, 'boot: serialize() === levels/office.json byte for byte');
  // ---- materials: set is LIVE (the scene's boxes follow), rename rewrites references in palette order, remove refused / repaintTo, presets, duplicate, fromSelection
  { const lino0 = clonePlainLocal(ed.data.materials.lino); const users = api.material.users('lino').boxes;
    api.material.set('lino', { rough: 0.4, albedo: [0.2, 0.3, 0.4] }); S.step(1);
    const bi = ed.doc.indexOf('boxes', users[0]); const wb = engine.world.statics[bi];
    verdict(ed.data.materials.lino.rough === 0.4 && wb.rough === 0.4 && Math.abs(wb.albedo[2] - 0.4) < 1e-9, 'material.set(lino, {rough, albedo}) → the document AND the engine box painted with it follow on the next sync', JSON.stringify({ doc: ed.data.materials.lino, box: { rough: wb.rough, albedo: wb.albedo } }));
    verdict(/traced/.test(api.material.get('lino').trace) && /analytic/.test(api.material.traceHint(0.9)) && /fading/.test(api.material.traceHint(0.5)), 'traceHint words the tiers a roughness is traced on (0.4 traced · 0.5 fading on ultra · 0.9 analytic only)', `${api.material.traceHint(0.4)} | ${api.material.traceHint(0.5)} | ${api.material.traceHint(0.9)}`);
    api.material.set('lino', { rough: null }); verdict(ed.data.materials.lino.rough === undefined && !('rough' in ed.data.materials.lino), 'rough: null → the key is dropped (matte = ROUGH_DEFAULT, nothing written)');
    api.material.preset('lino', 'metal'); verdict(ed.data.materials.lino.rough === 0.28 && ed.data.materials.lino.metal === true, 'preset(metal) → rough 0.28 + metal');
    api.material.preset('lino', 'lino'); verdict(ed.data.materials.lino.rough === 0.22 && ed.data.materials.lino.metal === undefined, 'preset(lino) → 0.22, metal dropped (never written false)');
    const order0 = Object.keys(ed.data.materials); const at = order0.indexOf('lino');
    api.material.rename('lino', 'linoWaxed');
    verdict(Object.keys(ed.data.materials)[at] === 'linoWaxed' && !ed.data.boxes.some((b: any) => b.material === 'lino') && ed.data.boxes.filter((b: any) => b.material === 'linoWaxed').length === users.length && api.validate().length === 0, `rename → the palette slot is kept (${at}), ${users.length} box reference(s) rewritten, valid`);
    let refused = ''; try { api.material.remove('linoWaxed'); } catch (e) { refused = String((e as Error).message); }
    verdict(/paints \d+ thing/.test(refused) && 'linoWaxed' in ed.data.materials, 'remove while used → refused, nothing changes', refused.slice(0, 70));
    api.material.remove('linoWaxed', { repaintTo: 'stone' }); verdict(!('linoWaxed' in ed.data.materials) && users.every((id: string) => api.box.get(id).material === 'stone') && api.validate().length === 0, 'remove(…, {repaintTo: stone}) → users repainted first, then the paint goes; valid');
    const dup = api.material.duplicate('stone'); verdict(dup === 'stone_copy' && Object.keys(ed.data.materials).indexOf(dup) === Object.keys(ed.data.materials).indexOf('stone') + 1 && ed.data.materials[dup].rough === ed.data.materials.stone.rough, 'duplicate → stone_copy right after stone with the same finish');
    const created = api.material.create('tealGloss', { albedo: [0.1, 0.5, 0.45], rough: 0.3, notes: 'probe' }); verdict(created === 'tealGloss' && ed.data.materials.tealGloss.notes === 'probe' && Object.keys(ed.data.materials).slice(-1)[0] === 'tealGloss', 'create → appended at the end with its notes');
    let bad = ''; try { api.material.create('9lives'); } catch (e) { bad = String((e as Error).message); } verdict(/letter/.test(bad), 'a name starting with a digit is refused');
    const fromSel = api.material.fromSelection([tb(ed)], 'fromBox'); verdict(fromSel === 'fromBox' && api.box.get(tb(ed)).material === 'fromBox' && api.validate().length === 0, 'fromSelection → a paint from the box\'s resolved look, the box painted with it');
    verdict(api.material.selectUsers('fromBox') === 1 && api.selection()[0] === `box:${tb(ed)}`, 'selectUsers → the selection is the paint\'s users');
    api.select(null);
    let n = 0; while (ed.doc.canUndo) { api.undo(); n++; }
    verdict(api.digest() === d0 && JSON.stringify(ed.data.materials.lino) === JSON.stringify(lino0) && Object.keys(ed.data.materials).join() === order0.join(), `undo all ${n} material commands → original digest, lino as it was, palette ORDER as it was`);
    verdict(api.serialize() === fileText, 'serialize() === the file after material edits + undo'); }
  // ---- coalescing: a 30-step slider drag under one key = ONE undo step; sealed, the next drag is another
  { for (let i = 0; i < 30; i++) Pt.materialSet(ed, 'lino', { rough: 0.2 + i * 0.01 }, { coalesce: 'mat:lino:rough' }); ed.doc.seal();
    verdict(api.history().undo.length === 1 && Math.abs(ed.data.materials.lino.rough - 0.49) < 1e-9, '30 coalesced materialSet calls → 1 undo step (rough 0.49)', `undo ${api.history().undo.length}`);
    for (let i = 0; i < 10; i++) Pt.materialSet(ed, 'lino', { rough: 0.5 + i * 0.01 }, { coalesce: 'mat:lino:rough' }); ed.doc.seal();
    verdict(api.history().undo.length === 2, 'after seal() the next drag is a second step'); api.undo(); api.undo(); verdict(api.digest() === d0, 'two undos → original'); }
  // ---- per-box overrides: rough / metal over a paint, albedo → inline keeping the look, clear; what loadLevel makes of them
  { const id = ed.data.boxes.find((b: any) => b.material === 'wood' && !b.markings)!.id;
    api.box.override(id, { rough: 0.18 }); S.step(1); const bi = ed.doc.indexOf('boxes', id);
    verdict(api.box.get(id).rough === 0.18 && engine.world.statics[bi].rough === 0.18 && api.box.get(id).material === 'wood', 'override(rough 0.18) → written on the box over its paint; the engine box follows');
    api.box.override(id, { metal: true }); verdict(api.box.get(id).metal === true && api.box.look(id).metal === true, 'override(metal) → metal on the box');
    api.box.override(id, { albedo: [0.3, 0.2, 0.1] }); const ob = api.box.get(id);
    verdict(!ob.material && ob.albedo[0] === 0.3 && ob.rough === 0.18 && ob.metal === true && api.validate().length === 0, 'override(albedo) → INLINE (material dropped) with the finish it had kept explicit; valid', JSON.stringify(ob).slice(0, 140));
    const keys = Object.keys(ob); verdict(keys.indexOf('albedo') < keys.indexOf('rough') && keys.indexOf('h') < keys.indexOf('albedo'), 'the box record stays in the file\'s key order (canonBox)');
    api.box.override(id, null); verdict(api.box.get(id).rough === undefined && api.box.get(id).metal === undefined, 'override(null) clears rough + metal');
    api.box.finish([id], 'screen'); verdict(api.box.get(id).rough === 0.08, 'finish(screen) → 0.08 on the box');
    while (ed.doc.canUndo) api.undo(); verdict(api.digest() === d0 && api.serialize() === fileText, 'undo the overrides → original digest, serialize() === the file'); }
  // ---- markings: a storage-shelf carton (tape on top, print ±z)
  const carton = ed.data.boxes.find((b: any) => (b.markings?.length ?? 0) >= 3 && b.group === 'storage' && b.markings.some((m: any) => m.face === '+z' && m.res === 'fine'))!;
  const cid = carton.id; const marks0 = JSON.stringify(carton.markings);
  { const iz = carton.markings.findIndex((m: any) => m.face === '+z'); const art0 = api.marking.ascii(cid, iz);
    const L = api.marking.face(cid, '+z', 'fine'); verdict(L.maxW === 32 && L.maxH === 24 && Math.abs(L.t - 0.0125) < 1e-12, `face(+z, fine) → 1.25 cm cells, the face takes ${L.maxW} × ${L.maxH} (capped at 32)`, JSON.stringify(L));
    api.marking.paintCell(cid, iz, 0, 0, 1); verdict(api.marking.ascii(cid, iz)[0][0] === 'a', 'paintCell(0,0,a) → cells[0][0] = a (x = column, y = row from the top)');
    S.step(1); const wb = engine.world.statics[ed.doc.indexOf('boxes', cid)]; verdict(wb.marks && wb.marks[iz].cells[0][0] === 'a' && (engine.world.geoU32[ed.doc.indexOf('boxes', cid) * 8 + 7] >>> 18) > 0, 'the engine box carries the painted cells and a marking-table slot after the next upload (live in the view)');
    let threw = ''; try { api.marking.paintCell(cid, iz, 0, 0, 3); } catch (e) { threw = String((e as Error).message); } verdict(/palette has 2/.test(threw), 'painting with an entry the palette lacks is refused', threw.slice(0, 60));
    for (let x = 0; x < 12; x++) Pt.markingPaintCells(ed, cid, iz, [[x, 7]], 2, { coalesce: 'stroke1' }); ed.doc.seal();
    verdict(api.marking.ascii(cid, iz)[7] === 'bbbbbbbbbbbb' && api.history().undo.slice(-1)[0].startsWith('paint marking') && api.history().undo.length === 2, 'a 12-cell stroke under one coalesce key → one undo step');
    api.marking.fill(cid, iz, [3, 2, 5, 4], 0); verdict(api.marking.ascii(cid, iz).slice(2, 5).every((r: string) => r.slice(3, 6) === '...'), 'fill([3,2,5,4], 0) erases a 3 × 3 block');
    api.marking.mirror(cid, iz, 'h'); api.marking.mirror(cid, iz, 'h'); api.marking.shift(cid, iz, 5, 3); api.marking.shift(cid, iz, -5, -3); const back = api.marking.ascii(cid, iz);
    api.undo(); api.undo(); api.undo(); api.undo(); verdict(JSON.stringify(back) === JSON.stringify(api.marking.ascii(cid, iz)), 'mirror twice + shift there and back = identity (and each its own undo step)');
    api.marking.generate(cid, iz, 'grid', { keyboard: 1, cap: 2, deck: 1 }); const g = api.marking.ascii(cid, iz);
    verdict(g[0] === 'abababababab' && g[7] === 'aaaaaaaaaaaa' && /aab{3,}a/.test(g[6]) && !/bbb/.test(g[0]) && api.validate().length === 0, 'generate(grid, keyboard) → caps on a deck, the space bar only in the bottom cap row; valid', g.join('/'));
    api.marking.generate(cid, iz, 'window', { cols: 3, rows: 2 }); verdict(api.marking.get(cid, iz).pal.length === 3 && api.validate().length === 0, 'generate(window) names entry c on a 2-entry palette → a third entry is ADDED rather than writing cells the validator refuses');
    api.marking.generate(cid, iz, 'glyph', { glyph: 1, clear: 1 }); const gl = api.marking.ascii(cid, iz); verdict(gl.some((r: string) => /a...a/.test(r)) && gl.some((r: string) => /aaaaa/.test(r)), 'generate(glyph 1 = fragile) draws the stemmed glass', gl.join('/'));
    api.marking.generate(cid, iz, 'tape', { ink: 1 }); verdict(api.marking.get(cid, iz).pal[0].albedo?.[0] === 0.36 && api.marking.get(cid, iz).pal[0].rough === 0.35, 'generate(tape) makes the ink entry the packing-tape MATERIAL (albedo 0.36 0.22 0.10, rough 0.35)');
    // ascii round trip
    const lit = api.marking.literal(cid, iz, 'ART_T'); const parsed = api.marking.parseAscii(lit); verdict(JSON.stringify(parsed) === JSON.stringify(api.marking.ascii(cid, iz)) && /^const ART_T = \[\n  '/.test(lit), 'literal() → a markingDefaults-style array literal that parseAscii reads back exactly');
    verdict(JSON.stringify(api.marking.parseAscii("  [ '..a', \"ab.\", ]  // x\n b.. ")) === JSON.stringify(['..a', 'ab.', 'b..']), 'parseAscii takes quoted rows on one line, comments, and bare rows');
    let perr = ''; try { api.marking.parseAscii('const x = [\n "..a..",\n hello world\n]'); } catch (e) { perr = String((e as Error).message); } verdict(/not a row/.test(perr), 'parseAscii refuses a line that is not cells', perr.slice(0, 50));
    api.marking.fromAscii(cid, iz, art0.join('\n')); verdict(JSON.stringify(api.marking.ascii(cid, iz)) === JSON.stringify(art0) && api.marking.get(cid, iz).size[0] === 12, 'fromAscii(the original rows) → the art is back, size follows the rows');
    let big = ''; try { api.marking.fromAscii(cid, iz, Array.from({ length: 30 }, () => '.'.repeat(20))); } catch (e) { big = String((e as Error).message); } verdict(/does not fit/.test(big), 'fromAscii of art taller than the face takes → refused with the face\'s capacity', big.slice(0, 80));
    // frame edits clamp into the face; validate errors reported per marking
    api.marking.update(cid, iz, { size: [40, 40], at: [-500, 500] }); const mk = api.marking.get(cid, iz);
    verdict(mk.size[0] === 32 && mk.size[1] === 24 && api.marking.list(cid)[iz].errors.length === 0 && api.validate().length === 0, `update(size 40×40 at −500,500) → clamped to ${mk.size} at ${mk.at}, inside the face, valid`);
    api.marking.update(cid, iz, { res: 'coarse' }); const mc = api.marking.get(cid, iz); verdict(mc.res === 'coarse' && mc.size[1] <= 6 && api.validate().length === 0, `res → coarse re-clamps the bitmap onto the face (${mc.size})`);
    api.marking.update(cid, iz, { anchor: 'bl' }); const Lc = api.marking.face(cid, '+z', 'coarse'); verdict(api.marking.get(cid, iz).at[0] === Lc.uMin && api.marking.get(cid, iz).at[1] === Lc.vMin, 'anchor bl → at = the face\'s lower-left lattice cell');
    // planted invalid marking straight into the data → list() reports it, validate() too
    { const bi = ed.doc.indexOf('boxes', cid); const saved = clonePlainLocal(ed.data.boxes[bi].markings[iz]); ed.data.boxes[bi].markings[iz].at = [999, 999]; verdict(api.marking.list(cid)[iz].errors.some((e: string) => /leaves the face/.test(e)) && api.validate().some((e: string) => /leaves the face/.test(e)), 'a marking pushed off its face (planted) shows in marking.list(...).errors and validate()'); ed.data.boxes[bi].markings[iz] = saved; }
    // palette: one LAMP, per-entry filter hues (08-12): switching a second entry on keeps ITS OWN hue (its albedo's) at the asked level; the model reports the hue count + minority flux share; unify; emitOwnChroma; add / remove entries with cell remap; the cap
    api.marking.pal(cid, iz, 0, { emitLevel: 2, emitChroma: [1, 0.5, 0.25] }); if (api.marking.get(cid, iz).pal.length < 2) api.marking.addPal(cid, iz); api.marking.pal(cid, iz, 1, { mode: 'albedo', albedo: [0.16, 0.12, 0.08] }); api.marking.pal(cid, iz, 1, { emitLevel: 6 });
    let em = api.marking.emitModel(cid, iz); { const e1 = api.marking.get(cid, iz).pal[1].emit; verdict(Math.abs(em.levels[1] - 6) < 1e-9 && Math.abs(e1[0] - 6) < 1e-6 && Math.abs(e1[1] - 4.5) < 1e-6 && Math.abs(e1[2] - 3) < 1e-6, 'emitLevel on a second entry keeps ITS OWN hue (its albedo 0.16/0.12/0.08 → 6, 4.5, 3), not the first emitter\'s', JSON.stringify(api.marking.get(cid, iz).pal)); }
    verdict(!em.consistent && em.hues === 2 && em.minorityShare > 0 && em.minorityShare < 1, 'two hues → emitModel reports hues 2 + a minority flux share (an advisory, not an error)', JSON.stringify(em));
    api.marking.pal(cid, iz, 1, { emitOwnChroma: [0.1, 0.2, 1] }); { const e1 = api.marking.get(cid, iz).pal[1].emit; verdict(Math.abs(e1[2] - 6) < 1e-6 && Math.abs(e1[0] - 0.6) < 1e-6, 'emitOwnChroma re-hues one entry and keeps its level (0.1/0.2/1 × 6)', JSON.stringify(e1)); }
    api.marking.pal(cid, iz, 1, { emit: [0.1, 0.2, 6] }); em = api.marking.emitModel(cid, iz); verdict(!em.consistent, 'a raw emit of another hue (API power user) → emitModel says inconsistent (the UI shows the advisory)');
    api.marking.unifyChroma(cid, iz); em = api.marking.emitModel(cid, iz); verdict(em.consistent && Math.abs(em.levels[1] - 6) < 1e-9, 'unifyChroma → one chroma again, levels kept');
    api.marking.pal(cid, iz, 0, { emitChroma: [0.2, 0.4, 1] }); const p2 = api.marking.get(cid, iz).pal; verdict(Math.abs(p2[0].emit[2] - 2) < 1e-6 && Math.abs(p2[1].emit[2] - 6) < 1e-6 && Math.abs(p2[1].emit[0] - 1.2) < 1e-6, 'emitChroma rewrites EVERY emitter at its own level');
    while (api.marking.get(cid, iz).pal.length < 3) api.marking.addPal(cid, iz); let cap = ''; try { api.marking.addPal(cid, iz); } catch (e) { cap = String((e as Error).message); } verdict(/at most 3/.test(cap), 'a fourth palette entry is refused (2-bit cells)');
    api.marking.paintCell(cid, iz, 1, 0, 3); api.marking.paintCell(cid, iz, 2, 0, 2); api.marking.removePal(cid, iz, 1); const row0 = api.marking.ascii(cid, iz)[0];
    verdict(api.marking.get(cid, iz).pal.length === 2 && row0[1] === 'b' && row0[2] === '.' && api.validate().length === 0, 'removePal(b): its cells go transparent, c\'s cells become b, valid', row0);
    api.marking.pal(cid, iz, 0, { mode: 'albedo', albedo: [2, -1, 0.5] }); verdict(JSON.stringify(api.marking.get(cid, iz).pal[0].albedo) === '[1,0,0.5]' && api.marking.get(cid, iz).pal[0].mul === undefined, 'mode albedo clamps to [0,1] and drops mul (albedo OR mul)');
    api.marking.pal(cid, iz, 0, { mode: 'mul', mul: 0.5 }); verdict(api.marking.get(cid, iz).pal[0].mul === 0.5 && !api.marking.get(cid, iz).pal[0].albedo, 'mode mul drops the albedo');
    // add / duplicate / cap / remove
    const before = api.marking.list(cid).length; const k = api.marking.add(cid, { face: '-x', res: 'base', size: [4, 4], anchor: 'centre' });
    verdict(api.marking.list(cid).length === before + 1 && api.marking.get(cid, k).face === '-x' && api.validate().length === 0, `add(-x, 4×4 centred) → index ${k}, valid`);
    let capErr = ''; try { for (let q = 0; q < 4; q++) api.marking.add(cid, { face: '+y' }); } catch (e) { capErr = String((e as Error).message); } verdict(/cap|4 markings/.test(capErr) && api.marking.list(cid).length === 4, 'a fifth marking on a box is refused (MAX_MARKS_PER_BOX)');
    api.marking.remove(cid, api.marking.list(cid).length - 1); verdict(api.marking.list(cid).length === 3, 'remove → gone');
    // copy / paste onto same-size boxes; apply to pattern; recipe
    api.marking.copy(cid, iz); const same = api.box.matching('^box_', { sameSizeAs: cid }).filter((x: string) => x !== cid);
    const pr = api.marking.paste(same.slice(0, 3)); verdict(pr.pasted.length === Math.min(3, same.length) && pr.skipped.length === 0 && api.validate().length === 0, `copy + paste onto ${pr.pasted.length} same-size cartons (same face) → valid`, JSON.stringify(pr));
    const tiny = api.box.add({ c: [2, 0.05, 2], h: [0.05, 0.05, 0.05], albedo: [0.5, 0.5, 0.5] }); const pr2 = api.marking.paste([tiny]); verdict(pr2.pasted.length === 0 && /takes/.test(pr2.skipped[0] ?? ''), 'paste onto a box whose face is too small → skipped and named', pr2.skipped[0]);
    const ap = api.marking.applyToPattern(cid, iz, '^box_', { sameSize: true }); verdict(ap.matched === same.length && ap.pasted.length === same.length && api.validate().length === 0, `applyToPattern('^box_', sameSize) → all ${same.length} cartons of this size carry it`);
    const rc = api.marking.recipe(cid, 'carton'); verdict(rc.applied >= 3 && api.marking.list(cid).length === rc.applied && api.validate().length === 0, `recipe(carton) → the markingDefaults set for this size (${rc.applied} markings) replaces the box's`, JSON.stringify(rc));
    let rerr = ''; try { api.marking.recipe(tiny, 'lobbySign'); } catch (e) { rerr = String((e as Error).message); } verdict(/fits nothing/.test(rerr), 'a recipe nothing of which fits the box is refused whole', rerr.slice(0, 60));
    const sm = api.marking.summary(cid, 0); verdict(sm.stats.W > 0 && sm.base.length === 3, 'summary() → coverage stats + the base albedo');
    let n = 0; while (ed.doc.canUndo) { api.undo(); n++; }
    verdict(api.digest() === d0 && JSON.stringify(api.box.get(cid).markings) === marks0, `undo all ${n} marking commands → original digest, the carton's markings leaf for leaf`);
    verdict(api.serialize() === fileText, 'serialize() === the file after marking edits + undo'); }
  // ---- the marking table: an editing session that registers hundreds of lists is compacted before the append-only table fills
  { const big = api.box.add({ c: [3, 1, 3], h: [0.5, 0.5, 0.5], albedo: [0.5, 0.5, 0.5] }); const k = api.marking.add(big, { face: '+z', res: 'base', size: [32, 32] }); S.step(1);
    const W: any = engine.world; const rows0 = W.markRows;
    for (let s = 0; s < 170; s++) { api.marking.paintCell(big, k, s % 32, Math.floor(s / 32) % 32, 1); S.step(1); }
    const slot = (engine.world.geoU32[ed.doc.indexOf('boxes', big) * 8 + 7] >>> 18);
    verdict(scene.markCompactions >= 1 && W.markRows < 6144 * 0.66 && slot > 0, `170 strokes on a 32 × 32 bitmap (30 rows a list): the table was compacted ${scene.markCompactions}× (rows ${rows0} → ${W.markRows} of 6144) and the box still has its slot (${slot})`);
    while (ed.doc.canUndo) api.undo(); verdict(api.digest() === d0, 'undo → original'); }
  // ---- colour helpers: hex ⇄ linear round-trips every 8-bit sRGB step; swatch CSS
  { let worst = 0; for (let v = 0; v < 256; v += 5) { const hex = '#' + [v, 255 - v, (v * 7) % 256].map(x => x.toString(16).padStart(2, '0')).join(''); const back = Pt.linearToHex(Pt.hexToLinear(hex)); if (back !== hex) worst++; }
    verdict(worst === 0 && Pt.hexToLinear('#fff')![0] === 1 && Pt.hexToLinear('nope') === null, 'hexToLinear / linearToHex round-trip 8-bit sRGB exactly; #fff = 1; junk → null');
    verdict(/linear-gradient/.test(Pt.swatchCss([0.3, 0.3, 0.3], 0.2)) && !/gradient/.test(Pt.swatchCss([0.3, 0.3, 0.3])) && /linear-gradient/.test(Pt.swatchCss([0.5, 0.5, 0.48], 0.28, true)), 'swatchCss: a streak for a finished paint, none for matte, tinted for metal'); }
  // ---- the panes on the fake DOM: tabs, the materials pane over a selection, the markings pane over the carton, every button / toggle / select, painter keys
  { { const si = G.setInterval.__patched ? null : G.setInterval.bind(G); if (si) { G.setInterval = (f: any, ms: number) => { const t: any = si(f, ms); t?.unref?.(); return t; }; G.setInterval.__patched = true; } }   // (Panel's 400 ms refreshers must not keep the process alive after the probes)
    const { Ui } = await import(`${ROOT}/src/editor/ui.ts`);
    const ui: any = attempt('Ui with the paint tabs', () => new Ui({ ed, tools: S.tools, view: S.view, scene, overlay: S.overlay, viewEl: doc.getElementById('view'), quality: () => 'medium', play: () => {}, hudLine: () => 'hud', server: { available: false, list: [] } }));
    if (!ui) return;
    const pu = ui.paintUi; const tick = () => { S.step(1); ui.tick(10); };
    verdict(doc.getElementById('insphead').querySelectorAll('button.itab').length === 3, 'the PROPERTIES header carries three tabs (properties / materials / markings)');
    api.select([`box:${tb(ed)}`, `box:${tb2(ed)}`]); pu.show('materials'); pu.paint = 'wood'; pu.tick(true); tick();
    const matRows = doc.getElementById('matpane').querySelectorAll('div.mrow').length; verdict(matRows === Object.keys(ed.data.materials).length && !doc.getElementById('matpane').classList.contains('hidden') && doc.getElementById('props').classList.contains('hidden'), `materials tab up: ${matRows} paint rows, the sheet hidden`);
    const clickAll = (root: El, skip: RegExp) => { let n = 0; for (const b of root.querySelectorAll('button')) { const t = b.textContent; if (skip.test(t) || b.disabled) continue; attempt(`click "${t}"`, () => b.onclick?.({ target: b, stopPropagation() {}, preventDefault() {}, shiftKey: false })); pu.tick(); n++; } return n; };
    const flipAll = (root: El) => { let n = 0; for (const e of root.querySelectorAll('input')) if (e.type === 'checkbox' && e.onchange) { for (let q = 0; q < 2; q++) { e.checked = !e.checked; attempt('checkbox', () => e.onchange!({ target: e })); pu.tick(); } n++; } for (const e of root.querySelectorAll('select')) if (e.onchange && e.options.length > 1) { const vals = e.options.map((o: El) => o.value); const was = vals.includes(e.value) ? e.value : vals[0]; e.value = vals[(vals.indexOf(was) + 1) % vals.length]; attempt('select', () => e.onchange!({ target: e })); pu.tick(); n++; } for (const e of root.querySelectorAll('input')) if (e.type === 'range' && e.oninput) { e.value = '0.4'; attempt('range', () => { e.oninput!({ target: e }); e.onchange?.({ target: e }); }); n++; } return n; };
    pu.newName = 'probePaint'; const nm = clickAll(doc.getElementById('matpane'), /^delete$/); const fm = flipAll(doc.getElementById('matpane')); tick();
    verdict(nm >= 20 && fm >= 4 && api.validate().length === 0, `materials pane: ${nm} buttons clicked (new / duplicate / rename / from selection / users / paint sel. / finish presets / clear overrides …), ${fm} toggles / selects / sliders flipped — document valid`);
    api.select(`box:${cid}`); pu.show('markings'); tick();
    verdict(pu.mk.boxId === cid && doc.getElementById('markpane').querySelectorAll('div.mkrow').length === api.marking.list(cid).length && !!doc.getElementById('markpane').querySelector('canvas.paintcv'), `markings tab follows the selection: ${api.marking.list(cid).length} marking rows and the painter canvas for ${cid}`);
    verdict(!!S.overlay.markGizmo && S.overlay.markGizmo.boxId === cid, 'the overlay outlines the subject face (markGizmo set)');
    for (const h of doc.getElementById('markpane').querySelectorAll('h3')) if (/^▸/.test(h.textContent)) h.onclick?.({});   // open generators + ascii
    const nk = clickAll(doc.getElementById('markpane'), /^remove$|paste from clipboard/); const fk = flipAll(doc.getElementById('markpane')); tick();
    verdict(nk >= 30 && api.validate().length === 0, `markings pane: ${nk} buttons clicked (faces, add / duplicate / copy / paste / apply / recipe / anchors / nudges / mirror / shift / clear / entries / add entry / run generator / apply text …), ${fk} controls flipped — valid`);
    // painter keys through PaintUi.key (what the page's capture hook calls)
    pu.mk.i = 0; pu.painterFocus = true; pu.tick(true); const e0 = pu.mk.entry; const consumed = pu.key({ key: ']', code: 'BracketRight' } as any); const e1 = pu.mk.entry;
    const at0 = api.marking.get(cid, 0).at[1]; pu.key({ key: 'ArrowUp' } as any); pu.key({ key: 'ArrowDown' } as any); const at2 = api.marking.get(cid, 0).at[1];
    const del = pu.key({ key: 'Delete' } as any); const esc = pu.key({ key: 'Escape' } as any);
    verdict(consumed && e1 !== e0 && at2 === at0 && del && !!api.box.get(cid) && esc && !pu.painterFocus, '] cycles the entry, arrows move the bitmap and back, Delete is swallowed (the box stays), Esc hands the keys back');
    verdict(pu.key({ key: ']' } as any) === false, 'with the painter unfocused the keys are not consumed');
    pu.show('props'); verdict(!doc.getElementById('props').classList.contains('hidden') && S.overlay.markGizmo === null, 'back to properties: the sheet shows, the face outline goes');
    let n = 0; while (ed.doc.canUndo) { api.undo(); n++; } verdict(api.digest() === d0, `undo the whole UI session (${n} steps) → original digest`);
    verdict(api.serialize() === fileText, 'serialize() === the file after the UI session + undo'); }
}
const clonePlainLocal = (v: any) => JSON.parse(JSON.stringify(v));

// ================================================================ level-lint
export async function levelLintProbe() {
  console.log('\n=== level-lint: clean on the office, trips on planted faults, the CLI ===');
  const r0 = lintLevel(OFFICE_DATA, { allow: officeAllow });
  verdict(r0.errors === 0 && r0.warnings === 0, `office + sidecar: ${formatLint(r0)[0]}`);
  const rNo = lintLevel(OFFICE_DATA); verdict(rNo.errors === 0 && rNo.findings.every((f: any) => f.code === 'door-seal' && f.ids[0] === 'door:conference'), 'without the sidecar the only findings are the conference door\'s two door-seal warnings (its glazing is unglazed — documented in levels/office.lint.json)', rNo.findings.map((f: any) => f.code).join(' '));
  verdict(r0.ms < 250, `lint runs in ${r0.ms.toFixed(0)} ms (nav bake included)`);
  const base = JSON.stringify(OFFICE_DATA);
  const plant = (name: string, mut: (d: any) => void, code: string, sev = 'error') => { const d = JSON.parse(base); mut(d); const r = lintLevel(d, { allow: officeAllow }); const hit = r.findings.find((f: any) => f.code === code && f.severity === sev); verdict(!!hit, `planted: ${name} → ${sev} ${code}`, hit ? hit.message.slice(0, 110) : `NOT reported (${r.findings.slice(0, 3).map((f: any) => f.code).join(' ')})`); };
  plant('a light moved inside the corridor wall', d => { d.lights[1].pos = [20, 1.5, 10.0]; }, 'light-in-solid');
  plant('a light with range 0', d => { d.lights[0].range = 0; }, 'light-range');
  plant('a 5000-candela desk lamp', d => { d.lights[0].intensity = 5000; }, 'light-intensity', 'warn');
  plant('a spot with a 0° cone', d => { d.lights[0].outerDeg = 0; d.lights[0].innerDeg = 0; }, 'light-cone', 'warn');
  plant('a box with zero height', d => { d.boxes[300].h = [0.5, 0, 0.5]; }, 'box-extent');
  plant('an exact duplicate slab', d => { d.boxes.push({ ...d.boxes[400], id: 'box_dup' }); }, 'box-duplicate', 'warn');
  plant('a box poking out of the world', d => { d.boxes.push({ id: 'far', c: [45, 1, 14], h: [1, 1, 1], albedo: [1, 1, 1] }); }, 'box-bounds', 'warn');
  plant('the spawn inside the reception desk', d => { d.mission.playerSpawn = [8.2, 0, 15.2]; }, 'spawn-blocked');
  plant('every doorway into the server room walled up', d => { d.boxes.push({ id: 'blk1', c: [17.6, 1.1, 10.0], h: [0.7, 1.1, 0.06], material: 'wall' }); d.boxes.push({ id: 'blk2', c: [22.0, 1.1, 8.55], h: [0.06, 1.1, 0.6], material: 'wall' }); }, 'nav-objective');
  plant('… which also makes the server door itself unwalkable (its sides still meet through the manager\'s office: a warning)', d => { d.boxes.push({ id: 'blk1', c: [17.6, 1.1, 10.0], h: [0.7, 1.1, 0.06], material: 'wall' }); }, 'door-sides', 'warn');
  plant('both of a room\'s doors walled → its doors\' sides are disconnected (an error)', d => { d.boxes.push({ id: 'blk1', c: [17.6, 1.1, 10.0], h: [0.7, 1.1, 0.06], material: 'wall' }); d.boxes.push({ id: 'blk2', c: [22.0, 1.1, 8.55], h: [0.06, 1.1, 0.6], material: 'wall' }); }, 'door-sides');
  plant('a cabinet left standing in the storage doorway', d => { d.boxes.push({ id: 'cab', c: [32.6, 0.9, 10.0], h: [0.25, 0.9, 0.05], material: 'metal' }); }, 'door-gap', 'warn');
  plant('a door moved into the open lobby (nothing to seal against)', d => { d.doors[4].hinge = [7, 18]; }, 'door-seal', 'warn');
  plant('a patrol point inside a wall', d => { d.routes[0].points[1] = [20, 0, 10.0]; }, 'route-solid', 'warn');
  plant('a patrol leg to a sealed-off spot', d => { d.routes[1].points[2] = [38.5, 0, 2]; d.boxes.push({ id: 'pen1', c: [38.6, 1, 3.2], h: [1.45, 1, 0.06], material: 'wall' }, { id: 'pen2', c: [37.2, 1, 1.6], h: [0.06, 1, 1.7], material: 'wall' }); }, 'route-unreachable');   // (a pen in the lot's north-east corner, walls to the world's edge)
  plant('1700 boxes', d => { for (let i = 0; i < 760; i++) d.boxes.push({ id: 'bb' + i, c: [1 + (i % 30) * 0.05, 5, 1 + Math.floor(i / 30) * 0.05], h: [0.01, 0.01, 0.01], albedo: [1, 1, 1] }); }, 'box-budget', 'warn');
  plant('30 analytic lights', d => { for (let i = 0; i < 26; i++) d.lights.push({ ...d.lights[0], id: 'll' + i, pos: [10 + i * 0.9, 2.5, 20.5], fixture: undefined }); }, 'light-budget', 'warn');
  plant('a switchable that glows black', d => { d.switchables[3].baseEmissive = [0, 0, 0]; }, 'switchable-dark', 'warn');
  { const d = JSON.parse(base); const r = lintLevel(d, { allow: officeAllow }); const vend = d.switchables.find((s: any) => s.id === 'vending'); verdict(vend && !(vend.baseEmissive[0] + vend.baseEmissive[1] + vend.baseEmissive[2] > 0) && !r.findings.some((f: any) => f.code === 'switchable-dark'), 'a switchable lit through its boxes\' EMISSIVE MARKINGS (the vending front: baseEmissive black by construction) is not switchable-dark'); }
  plant('… but strip that marking\'s emission and it is dark again', d => { const b = d.boxes.find((x: any) => x.id === 'sw_vending'); for (const m of b.markings) for (const p of m.pal) delete p.emit; }, 'switchable-dark', 'warn');
  plant('a keypad buried in the wall it hangs on', d => { d.devices.find((x: any) => x.id === 'pad_side').pos = [22.0, 1.4, 9.36]; }, 'keypad-in-solid', 'warn');
  plant('a hole in the lobby floor (the stone finish and the base carpet moved away)', d => { for (const b of d.boxes) if (b.group === 'floors' || b.group === 'ground') { b.c = [b.c[0] + 100, b.c[1], b.c[2]]; } }, 'floor-hole', 'warn');
  plant('a schema error (unknown box in a switchable) is reported by lint too, as schema', d => { d.switchables[0].boxes[0] = 'nope'; }, 'schema');
  // allow-list mechanics
  { const d = JSON.parse(base); d.lights[0].intensity = 5000; const r = lintLevel(d, { allow: { ...officeAllow, 'light-intensity': { ids: ['light:desk_lamp'], reason: 'probe' } } }); verdict(!r.findings.some((f: any) => f.code === 'light-intensity'), 'an allow entry for (code, id) silences exactly that finding'); const r2 = lintLevel(d, { allow: { 'light-intensity': { ids: ['light:storage_bulb'], reason: 'probe' } } }); verdict(r2.findings.some((f: any) => f.code === 'light-intensity'), '… and not the same code on another id'); }
  // the CLI: exit 0 on the office, 1 on a file with an error, honours the sidecar
  { const dir = mkdtempSync(join(tmpdir(), 'tps-lint-')); try {
      const good = join(dir, 'good.json'); writeFileSync(good, serializeLevelData(OFFICE_DATA)); writeFileSync(join(dir, 'good.lint.json'), JSON.stringify({ allow: officeAllow }));
      const bad = join(dir, 'bad.json'); const bd = JSON.parse(base); bd.lights[0].range = 0; writeFileSync(bad, serializeLevelData(bd));
      const run = (f: string) => Bun.spawnSync({ cmd: [process.execPath, 'run', join(ROOT, 'tools/qa/level-lint.ts'), f, '--quiet'], cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
      const a = run(good), b2 = run(bad); const ao = new TextDecoder().decode(a.stdout), bo = new TextDecoder().decode(b2.stdout);
      verdict(a.exitCode === 0 && /PASS \(0 warnings\)/.test(ao), 'CLI on the office (with sidecar) → exit 0, "PASS (0 warnings)"', ao.trim().split('\n').pop());
      verdict(b2.exitCode === 1 && /light-range/.test(bo) && /FAIL \(1 error\)/.test(bo), 'CLI on a level with a range-0 light → exit 1, the finding printed', bo.trim().split('\n').slice(-2).join(' | ').slice(0, 160));
    } finally { rmSync(dir, { recursive: true, force: true }); } }
}

// ================================================================ editor-restore: review pass 4's editor fixes — a resized marked box stays valid (markings re-fitted / dropped and reported), a
// restore of an INVALID autosave opens WITH its problems and an unopenable one is never overwritten until the user edits (T4.1), Glass survives a flag toggle (T4.2), a renamed keypad takes
// its door's lock with it and a floor with only a chokepoint / civilian / device / connector end on it is not deletable (T4.6), a verb that throws leaves nothing behind (T4.7 transact), prop parts
// carry their markings into the editor's scene (T4.8), lint's mark-rows tally + BoxWorld.resetMarkTable (T4.12), route / chokepoint names are type-checked (T4.13)
export async function editorRestore() {
  console.log('\n=== editor-restore: resize keeps a marked box valid · lenient restore + the autosave hold · Glass flag · keypad rename → lock · floor users · transact rollback · prop-part markings · mark-rows · names ===');
  const marked = (ed: any) => ed.data.boxes.filter((b: any) => b.markings?.length);
  // ---- T4.1a: shrink a keyboard (its 14 × 4 key grid fills the top face) by every write path — the document stays valid, the bitmap re-fitted onto the smaller face, ONE undo puts both back
  { const S = standUpEditor(); const kb = S.ed.data.boxes.find((b: any) => b.markings?.length && Math.abs(b.h[1] - 0.012) < 0.002 && Math.abs(b.h[0] - 0.2) < 0.05); verdict(!!kb, 'the office has a marked keyboard to resize', kb?.id);
    if (kb) {
      const id = kb.id; const m0 = JSON.stringify(kb.markings); const h0 = [...kb.h]; const undo0 = S.ed.doc.undoStack.length;
      S.api.box.resize(id, '+x', -0.1);   // 40 cm → 30 cm wide: 14 base cells no longer fit (12 do)
      let b = S.api.box.get(id); let errs = S.ed.validate();
      verdict(errs.length === 0 && b.markings?.length === 1 && b.markings[0].size[0] <= 12 && b.h[0] < h0[0], `resize −10 cm on +x: still ${b.markings?.length} marking, re-fitted to ${b.markings?.[0]?.size.join('×')} (was 14×4), validate clean`, errs[0]);
      verdict(S.ed.doc.undoStack.length === undo0 + 1, 'size + markings moved in ONE command');
      S.api.undo(); b = S.api.box.get(id); verdict(JSON.stringify(b.markings) === m0 && b.h[0] === h0[0], 'undo: the 14×4 grid and the 40 cm width are both back');
      S.api.box.size(id, [0.3, 0.024, 0.1]); b = S.api.box.get(id); errs = S.ed.validate(); verdict(errs.length === 0 && b.markings?.[0]?.size[0] <= 12 && b.markings[0].size[1] <= 4, `box.size 30 × 10 cm: grid ${b.markings?.[0]?.size.join('×')}, validate clean`, errs[0]);
      const heard: string[] = []; S.ed.onProblems.push((items: any[]) => heard.push(...items.map(x => x.text)));
      S.api.box.update(id, { h: [0.05, 0.012, 0.03] }); b = S.api.box.get(id); errs = S.ed.validate(); verdict(errs.length === 0 && b.markings?.length === 1 && b.markings[0].size[0] <= 4 && b.markings[0].size[1] <= 2 && heard.length === 0, `box.update h → 10 × 6 cm: grid clamped to ${b.markings?.[0]?.size.join('×')} (the 2.5 cm world lattice puts 4 × 2 whole cells on it), still valid, nothing dropped`, errs[0]);
      S.api.box.update(id, { h: [0.05, 0.012, 0.02] }); b = S.api.box.get(id); errs = S.ed.validate();
      verdict(errs.length === 0 && !b.markings && heard.some(t => /dropped/.test(t) && t.includes(id)) && S.msgs.some((t: string) => /no longer fit/.test(t)), `box.update h → a 10 × 4 cm face (1.6 cells tall: no WHOLE lattice cell fits): the marking is DROPPED, the drop reported to the problems hook + status (${heard.length} item)`, errs[0] ?? heard[0]);
      S.api.undo(); S.api.undo(); S.api.undo(); b = S.api.box.get(id); verdict(JSON.stringify(b.markings) === m0 && b.h[0] === h0[0] && S.ed.validate().length === 0, 'three undos: the keyboard exactly as authored');
      // the gizmo's face drag lands in resizeBox too: drag +x in by 15 cm through the S handle path (ed.resizeBox with a coalesce key, as tools.ts does per mousemove)
      for (let i = 0; i < 5; i++) S.ed.resizeBox(id, 0, -0.03, { coalesce: 'probe-face' }); S.ed.doc.seal(); b = S.api.box.get(id); errs = S.ed.validate();
      verdict(errs.length === 0 && b.markings?.[0]?.size[0] < 14 && S.ed.doc.undoStack.length === undo0 + 1, `five coalesced face pushes (−15 cm): one command, grid ${b.markings?.[0]?.size.join('×')}, valid`, errs[0]); S.api.undo();
      const text = S.api.serialize(); const round = attempt('the serialized document parses strictly', () => parseLevelData(text)); verdict(!!round && marked(S.ed).length === marked({ data: round }).length, `serialize → parseLevelData (strict) round-trips with all ${marked(S.ed).length} marked boxes`); } }
  // ---- T4.1b: an INVALID but parseable level in the autosave slot (a keyboard's grid hanging off a shrunken face, as the old resize left it) → the restore OPENS it, problems listed; a strict load refuses it
  { const bad = JSON.parse(JSON.stringify(OFFICE_DATA)); bad.name = 'probe_autosaved'; const kb = bad.boxes.find((b: any) => b.markings?.length && Math.abs(b.h[1] - 0.012) < 0.002 && Math.abs(b.h[0] - 0.2) < 0.05); kb.h = [0.1, kb.h[1], kb.h[2]];   // (h shrunk, markings untouched = off the face)
    const badText = JSON.stringify(bad); const strictErrs = validateLevelData(bad); verdict(strictErrs.length > 0 && /inside|face|marking/i.test(strictErrs.join(' ')), `the planted document is invalid (${strictErrs.length} error: ${String(strictErrs[0]).slice(0, 90)})`);
    const S = standUpEditor(); store.clear(); store.set(persist.LS.autosave, JSON.stringify({ name: bad.name, t: Date.now() - 60000, digest: 'x', text: badText }));
    verdict(attempt('a strict load of it throws', () => { try { S.ed.load(badText); return false; } catch { return true; } }) === true, 'Editor.load (strict) refuses it — the office stays up');
    const heard: string[] = []; S.ed.onProblems.push((items: any[]) => heard.push(...items.map(x => x.text)));
    const session = new persist.AutosaveSession(S.ed); const r = attempt('restore', () => session.restore());
    verdict(!!r && r.ok && r.errors.length === strictErrs.length && S.ed.data.name === 'probe_autosaved' && S.ed.loadErrors.length === r.errors.length && heard.length === r.errors.length && !session.held, `AutosaveSession.restore(): the invalid level OPENS (name ${S.ed.data.name}), its ${r?.errors.length} problem(s) in ed.loadErrors + the problems hook, no hold`);
    verdict(S.api.save.restoreAutosave()?.errors?.length === strictErrs.length && S.ed.data.name === 'probe_autosaved', '__ed.save.restoreAutosave() (the load menu\'s path) opens it the same way, errors returned');
    const kb2 = S.ed.data.boxes.find((b: any) => b.id === kb.id); S.api.box.update(kb.id, { h: [kb2.h[0] + 0.001, kb2.h[1], kb2.h[2]] }); verdict(S.ed.validate().length === 0, 'and one touch of the offending box (any h change) re-fits its grid: the document validates again');
    // an UNOPENABLE slot (not JSON): the office stays up as a stand-in, the session HOLDS — the timer and the unload write nothing — until the first real edit
    const S2 = standUpEditor(); store.clear(); const junk = JSON.stringify({ name: 'probe_junk', t: 12345, digest: 'y', text: '{ "version": 1, "name": "half a level' }); store.set(persist.LS.autosave, junk);
    const s2 = new persist.AutosaveSession(S2.ed); const r2 = attempt('restore junk', () => s2.restore());
    verdict(!!r2 && !r2.ok && s2.held && !!s2.bootError && S2.ed.data.name === OFFICE_DATA.name, `a slot whose text is not a level: restore() → not ok, HELD, bootError worded ("${String(s2.bootError).slice(0, 70)}…"), the office up`);
    verdict(s2.tick() === null && s2.tick(true) === null && store.get(persist.LS.autosave) === junk, 'tick() (the 30 s timer) and tick(true) (unload) write NOTHING while held — the slot is byte for byte the user\'s');
    S2.api.box.add({ preset: 'crate', c: [10, 0, 18] }); const w = s2.tick();
    verdict(!s2.held && !!w && JSON.parse(store.get(persist.LS.autosave)!).name === OFFICE_DATA.name && s2.last === w, 'the first real edit releases the hold: the next tick writes the (now the user\'s) document');
    store.clear(); const s3 = new persist.AutosaveSession(standUpEditor().ed); verdict(!s3.restore().ok && !s3.held && /no autosave/.test(String(s3.bootError)) && s3.tick() !== null, 'an EMPTY slot: restore() not ok but no hold (nothing to protect) — the first tick fills it'); }
  // ---- T4.2: toggling one authored flag keeps the others — Glass included (setBoxFlags rebuilt the list from four hard-coded names and dropped a pane's Glass)
  { const S = standUpEditor(); const pane = S.ed.data.boxes.find((b: any) => b.flags?.includes('Glass')); verdict(!!pane, 'the office has a Glass pane', pane?.id);
    if (pane) { S.api.box.flags(pane.id, 'NoShadow', true); let f = S.api.box.get(pane.id).flags; verdict(f.includes('Glass') && f.includes('NoShadow'), `+NoShadow on ${pane.id}: flags ${JSON.stringify(f)} — Glass kept`); S.api.box.flags(pane.id, 'NoShadow', false); f = S.api.box.get(pane.id).flags; verdict(JSON.stringify(f) === JSON.stringify(pane.flags), 'and off again: exactly the authored flags'); verdict(attempt('an unknown flag name is refused', () => { try { S.api.box.flags(pane.id, 'Shiny', true); return false; } catch { return true; } }) === true, "flags('Shiny') throws (AUTHORED_FLAGS only)"); } }
  // ---- T4.6: rename a keypad → its door's lock follows (validate clean); a floor whose only users are a chokepoint / a civilian / a device / a connector end cannot be deleted; rename floor rewrites all of them
  { const S = standUpEditor(); const pad = S.ed.data.devices.find((v: any) => v.kind === 'keypad'); verdict(!!pad, 'the office has a keypad', pad?.id);
    if (pad) { S.api.rename(`device:${pad.id}`, 'pad_renamed'); const door = S.ed.data.doors.find((o: any) => o.id === pad.door); const errs = S.ed.validate(); verdict(door?.lock === 'pad_renamed' && errs.length === 0 && S.ed.data.devices.some((v: any) => v.id === 'pad_renamed'), `rename → door '${pad.door}'.lock = ${door?.lock}, validate clean`, errs[0]); S.api.undo(); verdict(S.ed.data.doors.find((o: any) => o.id === pad.door)?.lock === pad.id && S.ed.validate().length === 0, 'undo: pad and lock both back'); }
    const fid = S.api.floors.add({ name: 'probe wing', y: 4, ceiling: 3 });
    const tryDel = () => { try { S.api.delete([`floor:${fid}`]); return 'deleted'; } catch (e) { return String((e as Error).message); } };
    S.api.chokepoint.add({ pos: [20, 0, 14] }); const cp = S.ed.data.chokepoints[S.ed.data.chokepoints.length - 1]; S.ed.doc.update('chokepoints', cp.id, { floor: fid });
    verdict(/still has 1 thing/.test(tryDel()) && S.ed.data.floors.some((f: any) => f.id === fid), `a floor carrying only a chokepoint is NOT deletable ("${tryDel().slice(0, 60)}")`);
    S.ed.doc.update('chokepoints', cp.id, (c: any) => { const y = { ...c }; delete y.floor; return y; });
    const dv = S.ed.data.devices[0]; S.ed.doc.update('devices', dv.id, { floor: fid }); verdict(/still has 1 thing/.test(tryDel()), 'likewise a device on it');
    S.ed.doc.update('devices', dv.id, (v: any) => { const y = { ...v }; delete y.floor; return y; });
    if (S.ed.data.civilians?.length) { const cv = S.ed.data.civilians[0]; S.ed.doc.setPath(['civilians', 0], { ...cv, floor: fid }); verdict(/still has 1 thing/.test(tryDel()) && /civilian:/.test(tryDel()), `likewise a civilian (${cv.id}) — the refusal names her ref`); S.ed.doc.setPath(['civilians', 0], cv); } else verdict(true, '(no civilians block in this level — the table covers it, nothing to stage)');
    S.ed.doc.insert('connectors', { id: 'stair_probe', kind: 'stair', from: { floor: S.ed.data.floors[0].id, c: [5, 0, 5], h: [1, 0.1, 1] }, to: { floor: fid, c: [5, 4, 5], h: [1, 0.1, 1] } });
    verdict(/still has 1 thing/.test(tryDel()) && /connector:stair_probe/.test(tryDel()), 'likewise a connector END on it');
    // rename the floor: every user rewritten (the connector's `to.floor` included), validate clean; then delete goes once the connector goes
    S.ed.doc.setPath(['civilians', 0], S.ed.data.civilians?.length ? { ...S.ed.data.civilians[0], floor: fid } : undefined); S.ed.doc.update('devices', dv.id, { floor: fid });
    S.api.rename(`floor:${fid}`, 'wing2'); const errs = S.ed.validate(); const con = S.ed.data.connectors.find((c: any) => c.id === 'stair_probe');
    verdict(errs.length === 0 && con?.to.floor === 'wing2' && S.ed.data.devices[0].floor === 'wing2' && (!S.ed.data.civilians?.length || S.ed.data.civilians[0].floor === 'wing2'), `rename floor → 'wing2': connector end ${con?.to.floor}, device ${S.ed.data.devices[0].floor}${S.ed.data.civilians?.length ? `, civilian ${S.ed.data.civilians[0].floor}` : ''} — validate clean`, errs[0]);
    S.ed.doc.remove('connectors', 'stair_probe'); S.ed.doc.update('devices', dv.id, (v: any) => { const y = { ...v }; delete y.floor; return y; }); if (S.ed.data.civilians?.length) S.ed.doc.setPath(['civilians', 0, 'floor'], undefined);
    { const res = (() => { try { S.api.delete(['floor:wing2']); return 'deleted'; } catch (e) { return String((e as Error).message); } })(); const errs2 = S.ed.validate(); verdict(res === 'deleted' && !S.ed.data.floors.some((f: any) => f.id === 'wing2') && errs2.length === 0, 'with its users gone the floor deletes; validate clean', `${res.slice(0, 120)} · ${errs2[0] ?? ''}`); } }
  // ---- T4.7: a multi-op verb that THROWS half-way leaves nothing in the document and nothing on the undo stack (doc.transact rolls its level back)
  { const S = standUpEditor(); const d0 = S.api.digest(); const u0 = S.ed.doc.undoStack.length; const id = tb(S.ed);
    const before = S.api.digest();
    const t2 = attempt('transact throwing after two ops', () => { try { S.ed.doc.transact('probe: poisoned verb', () => { S.ed.updateBox(id, { group: 'poisoned' }); S.ed.addLight({ preset: 'bulb', pos: [10, 0, 18] }, { select: false }); throw new Error('deliberate'); }); return false; } catch (e) { return (e as Error).message === 'deliberate'; } });
    verdict(t2 === true && S.api.digest() === before && S.ed.doc.undoStack.length === u0 && S.api.box.get(id).group !== 'poisoned', 'transact(fn) where fn applies two ops then throws: the exception propagates, the document digest is unchanged, no command pushed');
    // nested: an inner transact that throws inside an outer one rolls back only its own ops; the outer goes on and commits its own
    S.ed.doc.transact('probe: outer', () => { S.ed.updateBox(id, { group: 'outer' }); try { S.ed.doc.transact('probe: inner', () => { S.ed.updateBox(id, { name: 'inner_name' }); throw new Error('inner'); }); } catch { /* the verb handles it */ } S.ed.updateBox(tb2(S.ed), { group: 'outer2' }); });
    const b1 = S.api.box.get(id); verdict(b1.group === 'outer' && b1.name === undefined && S.api.box.get(tb2(S.ed)).group === 'outer2' && S.ed.doc.undoStack.length === u0 + 1, 'nested: the inner level\'s op is gone, both outer ops stand, ONE command on the stack');
    S.api.undo(); verdict(S.api.digest() === d0, 'undo of that command: back to the pristine digest');
    // the tool's cross-frame gesture still works: begin … (nested verb) … rollback abandons all of it
    S.ed.doc.begin('probe gesture'); const nid = S.ed.addBox({ preset: 'crate', c: [12, 0, 18] }, { select: false }); S.ed.updateBox(nid, { c: [12.5, 0.5, 18] }, { coalesce: 'g' }); S.ed.updateBox(nid, { c: [13, 0.5, 18] }, { coalesce: 'g' }); S.ed.doc.rollback();
    verdict(S.api.digest() === d0 && !S.ed.doc.get('boxes', nid) && S.ed.doc.undoStack.length === u0, 'begin → addBox (a nested transact) → two coalesced updates → rollback: nothing left, nothing pushed (the footprint tool\'s Esc)'); }
  // ---- T4.8: a prop part's markings ride onto the box the editor's scene makes of it (the cartons' tape shows in the editor as in the game)
  { const S = standUpEditor(); const pi = S.ed.data.props.findIndex((p: any) => p.parts.some((q: any) => q.markings?.length)); verdict(pi >= 0, 'the office has a prop with marked parts', S.ed.data.props[pi]?.id);
    if (pi >= 0) { const rng = S.scene.propRanges[pi]; const parts = S.ed.data.props[pi].parts; const boxes = S.engine.world.statics.slice(rng.start, rng.start + rng.count); const want = parts.filter((q: any) => q.markings?.length).length; const got = boxes.filter((b: any) => b.marks?.length).length; verdict(rng.count === parts.length && got === want && got > 0, `prop ${S.ed.data.props[pi].id}: ${got}/${want} marked part(s) carry marks in world.statics`); } }
  // ---- T4.12: lint tallies the marking table's rows (stats.markRows; a warn / error as the level nears / passes MARK_TABLE_ROWS) and BoxWorld.resetMarkTable() is the public compaction the scene calls
  { const r = lintLevel(OFFICE_DATA, { allow: officeAllow }); verdict(typeof r.stats.markRows === 'number' && r.stats.markRows > 100 && r.stats.markRows < 6144 && !r.findings.some((f: any) => f.code === 'mark-rows'), `office: ${r.stats.markRows} marking-table rows, no mark-rows finding`);
    const d = JSON.parse(JSON.stringify(OFFICE_DATA)); const src = d.boxes.find((b: any) => b.markings?.length && b.markings[0].size[0] * b.markings[0].size[1] >= 40);
    for (let i = 0; i < 400; i++) { const nb = { ...JSON.parse(JSON.stringify(src)), id: `mrow${i}`, c: [1 + (i % 20) * 0.6, 6.5, 1 + Math.floor(i / 20) * 0.4], albedo: [0.3 + i * 0.001, 0.3, 0.3] }; delete nb.material; delete nb.name; d.boxes.push(nb); }   // 400 DISTINCT lists (albedo differs) of a big bitmap
    const r2 = lintLevel(d, { allow: officeAllow }); const f2 = r2.findings.find((f: any) => f.code === 'mark-rows');
    verdict(!!f2 && (f2.severity === 'error' || f2.severity === 'warn') && (r2.stats.markRows as number) > 6144 * 0.75, `+400 distinct big lists: ${r2.stats.markRows} rows → mark-rows ${f2?.severity}`, f2?.message.slice(0, 100));
    const S = standUpEditor(); const W = S.engine.world; const fill0 = W.markTableFill; verdict(fill0 > 0 && fill0 < 0.66, `BoxWorld.markTableFill after the office's upload: ${(fill0 * 100).toFixed(0)} %`);
    const taken = W.resetMarkTable(); verdict(taken > 0 && W.markTableFill === 0 && W.markStatsInfo.lists === 0, `resetMarkTable() → ${taken} rows freed, fill 0`); S.step(1); verdict(W.markTableFill > 0 && Math.abs(W.markTableFill - fill0) < 0.02, 'the next upload re-registers exactly the lists in use (fill back to what it was)');
    // paint until the scene compacts: many distinct strokes on one box push the append-only table past two thirds; Scene.compactMarkTable resets it through the public method
    const id = marked(S.ed)[0].id; const c0 = S.scene.markCompactions; let guard = 0;
    const mk = S.api.box.get(id).markings[0]; const W0 = mk.size[0], H0 = mk.size[1];
    let seed = 12345; const rnd = (n: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed >>> 13) % n; };   // (high bits: an LCG's low bits cycle in 2 / 4)
    while (S.scene.markCompactions === c0 && guard++ < 3000) { S.api.marking.paintCell(id, 0, rnd(W0), rnd(H0), rnd(2)); S.step(1); }   // (random strokes = bitmaps never seen before = a new list each; a step per stroke: the table only grows on upload)
    S.step(1); verdict(S.scene.markCompactions > c0 && W.markTableFill < 0.66, `${guard} paint strokes later the scene compacted the table ×${S.scene.markCompactions - c0} (fill now ${(W.markTableFill * 100).toFixed(0)} %)`); }
  // ---- T4.13: a route's / chokepoint's name must be a non-empty string when present
  { const d = JSON.parse(JSON.stringify(OFFICE_DATA)); d.routes[0].name = 7; d.chokepoints[0] = { ...d.chokepoints[0], name: '' }; const errs = validateLevelData(d);
    verdict(errs.some((e: string) => /routes\[0\].*name string/.test(e)) && errs.some((e: string) => /chokepoints\[0\].*name string/.test(e)), `a numeric route name and an empty chokepoint name → ${errs.length} error(s)`, errs.join(' | ').slice(0, 140)); }
}
