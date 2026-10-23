// THE LOOK PROTOTYPE's panel (the page /look; render/frame.ts lookConfig, shaders/look.wgsl): one slider a layer of the look, written straight into the g-buffer's
// uniform block, a button that shows the boxes plain while it is held, the hour and the quality preset, and what a frame costs. Made only on that page.
import type { Engine } from '../engine';
import { lookAmounts, LOOK_DEFAULTS } from '../render/gbuffer';
import { lookConfig } from '../render/frame';

const ROWS: readonly [keyof typeof lookAmounts, string, string, number][] = [
  ['paint', 'Paint', 'the colour the maps add to the box paint', 1.5],
  ['relief', 'Relief', 'how deep the normal maps cut', 1.6],
  ['shine', 'Finish', 'roughness from the maps', 1.5],
  ['cavity', 'Cavities', 'joints and pits hold shadow', 1.5],
  ['weather', 'Weather', 'damp wall feet, bleached tops, runs, trodden ground', 1.5],
  ['untile', 'Break the repeat', 'two turned copies cross-faded', 1],
  ['edges', 'Edges', 'small boxes: rounded, rubbed corners', 1.5],
  ['snow', 'Snow that clings', 'a snow level: blown against wall feet, lying on what was left out', 1.5],
  ['ground', 'Snow relief', '× the depth of lying snow\'s drifts, wind ridges and prints (1 = as the game draws it)', 3],
  ['crust', 'Snow crust', 'wind-glazed streaks of snow that hold a lamp\'s sheen', 1.5],
  ['stone', 'Stonework', 'a plinth of field stone under the mud walls and mud brick showing where the render has fallen', 1.5],
  ['marks', 'Painted marks', 'signs, stripes and rugs drawn as brushed, rubbed paint in place of square cells', 1],
  ['men', 'Men', 'the men drawn as cloth, webbing, steel and skin: a print on the uniforms, folds, scuffs, snow on their shoulders', 1.5],
  ['tailor', 'Kit detail', 'what was cut and sewn on the men: seams, pockets and patches, a combat shirt, bar tacks on the webbing, sand boots, knee pads, buttons', 1],
  ['air', 'Air', '× the haze that shows a lamp in the air', 4],
  ['size', 'Map size', '× the 2 m a map covers', 2],
];

export function buildLookPanel(engine: Engine, fps: () => number, shapes?: { on: boolean; flip: () => void }, hills?: { on: boolean; flip: () => void }, front?: { on: boolean; flip: () => void }): void {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;right:10px;top:10px;z-index:50;width:232px;padding:10px 12px;background:rgba(12,14,16,.86);color:#cfd6d2;font:11px/1.35 ui-monospace,Menlo,monospace;border:1px solid #2c3432;border-radius:4px;user-select:none';
  for (const ev of ['mousedown', 'click', 'pointerdown', 'wheel', 'contextmenu', 'dblclick']) el.addEventListener(ev, e => e.stopPropagation());   // (never the releases: the game clears a held button on the window's mouseup)
  const head = document.createElement('div'); head.textContent = 'Materials prototype'; head.style.cssText = 'font-weight:700;color:#e8efe9;margin-bottom:2px'; el.append(head);
  const cost = document.createElement('div'); cost.style.cssText = 'color:#8fa39a;margin-bottom:8px'; el.append(cost);
  const send = () => { engine.gbuffer.setLook(); lookConfig.air = lookAmounts.air; };
  const inputs: [keyof typeof lookAmounts, HTMLInputElement, HTMLSpanElement][] = [];
  let kept: typeof lookAmounts | null = null;   // the amounts as the sliders have them, while the boxes are shown plain
  for (const [key, name, tip, max] of ROWS) {
    const row = document.createElement('label'); row.title = tip; row.style.cssText = 'display:grid;grid-template-columns:96px 1fr 30px;gap:6px;align-items:center;margin:3px 0';
    const n = document.createElement('span'); n.textContent = name;
    const s = document.createElement('input'); s.type = 'range'; s.min = key === 'size' ? '0.5' : '0'; s.max = String(max); s.step = '0.05'; s.value = String(lookAmounts[key]); s.style.cssText = 'width:100%;accent-color:#9cb8a4';
    const v = document.createElement('span'); v.textContent = lookAmounts[key].toFixed(2); v.style.textAlign = 'right';
    s.addEventListener('input', () => { (kept ?? lookAmounts)[key] = +s.value; if (key === 'size') lookAmounts.size = +s.value; v.textContent = (+s.value).toFixed(2); send(); });
    s.addEventListener('change', () => s.blur());   // (a focused input takes the game's keys: game/input.ts typingTarget)
    row.append(n, s, v); el.append(row); inputs.push([key, s, v]);
  }
  const btn = (text: string, tip = '') => { const b = document.createElement('button'); b.textContent = text; b.title = tip; b.addEventListener('mousedown', e => e.preventDefault()); b.style.cssText = 'font:inherit;color:#dfe7e1;background:#232a28;border:1px solid #3a4441;border-radius:3px;padding:3px 7px;margin:2px 4px 2px 0;cursor:pointer'; return b; };
  const line = (label: string) => { const d = document.createElement('div'); d.style.marginTop = '8px'; const l = document.createElement('div'); l.textContent = label; l.style.color = '#8fa39a'; d.append(l); el.append(d); return d; };
  // plain while held; a click on the box leaves it plain
  const plain = (on: boolean) => {
    if (on && !kept) { kept = { ...lookAmounts }; for (const [k] of ROWS) if (k !== 'size') lookAmounts[k] = k === 'air' || k === 'ground' ? 1 : 0; }
    else if (!on && kept) { Object.assign(lookAmounts, kept); kept = null; }
    send();
  };
  const cmp = line('Compare');
  const hold = btn('Hold: plain boxes', 'the page as the game draws it today, while this is held'); hold.addEventListener('pointerdown', () => plain(true)); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) hold.addEventListener(ev, () => { if (!stay.checked) plain(false); });
  const stayL = document.createElement('label'); const stay = document.createElement('input'); stay.type = 'checkbox'; stay.addEventListener('change', () => { plain(stay.checked); stay.blur(); }); stayL.append(stay, ' stay plain'); stayL.style.marginLeft = '4px';
  cmp.append(hold, stayL);
  const reset = btn('Reset'); reset.addEventListener('click', () => { stay.checked = false; kept = null; for (const [k, s, v] of inputs) { lookAmounts[k] = LOOK_DEFAULTS[k]; s.value = String(LOOK_DEFAULTS[k]); v.textContent = LOOK_DEFAULTS[k].toFixed(2); } send(); }); cmp.append(reset);
  const w = window as any;
  const hours = line('Hour'); for (const h of ['night', 'dawn', 'midday', 'overcast', 'dusk']) { const b = btn(h); b.addEventListener('click', () => w.__hour?.set(h)); hours.append(b); }
  // THE SUN AND THE MOON (the maintainer, 10-23: "do we model a sun at all for dawn/midday? i think that's a big reason why it looks flat. and perhaps we should also
  // model a moon on night levels (and can configure it)"). Both are there: the hour's sun (game/hours.ts), which a snow level's cloud leaves 9 % of, and the level's
  // moon, which the pass has at 0.06. These rows set them for the visit: Sun = the share of the hour's own sun that comes through (window.__hour.sun: it then stands
  // against the cloud), Moon / height / bearing = the level's moon (window.__moon). The page shows what it has: a row follows the hour and the level.
  const skyRows: [() => number | null, HTMLInputElement, HTMLSpanElement, number][] = [];
  const skyRow = (host: HTMLElement, name: string, tip: string, min: number, max: number, step: number, digits: number, get: () => number | null, set: (v: number) => void) => {
    const row = document.createElement('label'); row.title = tip; row.style.cssText = 'display:grid;grid-template-columns:96px 1fr 30px;gap:6px;align-items:center;margin:3px 0';
    const n = document.createElement('span'); n.textContent = name;
    const s = document.createElement('input'); s.type = 'range'; s.min = String(min); s.max = String(max); s.step = String(step); s.style.cssText = 'width:100%;accent-color:#9cb8a4';
    const v = document.createElement('span'); v.style.textAlign = 'right';
    s.addEventListener('input', () => { set(+s.value); v.textContent = (+s.value).toFixed(digits); });
    s.addEventListener('change', () => s.blur());
    row.append(n, s, v); host.append(row); skyRows.push([get, s, v, digits]);
  };
  const sky = line('Sun and moon');
  skyRow(sky, 'Sun', 'by day: how much of the hour’s own sun comes through the weather’s cloud (a snow level leaves 0.09)', 0, 1, 0.01, 2, () => w.__hour && w.__hour.id !== 'night' ? w.__hour.sun() : null, v => w.__hour?.sun(v));
  skyRow(sky, 'Moon', 'at night: the moon’s strength (the pass has 0.06, the level kit’s own is 0.9)', 0, 1.5, 0.01, 2, () => { const m = w.__moon?.get(); return m && m.up ? m.k : null; }, v => w.__moon?.set({ k: v }));
  skyRow(sky, 'Moon height', 'degrees over the horizon: low = long shadows', 5, 85, 1, 0, () => { const m = w.__moon?.get(); return m && m.up ? m.elev : null; }, v => w.__moon?.set({ elev: v }));
  skyRow(sky, 'Moon bearing', 'where it stands, in degrees round the level', 0, 359, 1, 0, () => { const m = w.__moon?.get(); return m && m.up ? m.bearing : null; }, v => w.__moon?.set({ bearing: v }));
  const skySync = () => { for (const [get, s, v, digits] of skyRows) { const x = get(); s.disabled = x === null; if (x === null) v.textContent = '·'; else if (document.activeElement !== s) { s.value = String(x); v.textContent = x.toFixed(digits); } } };
  const qual = line('Quality'); for (const p of ['low', 'medium', 'high', 'ultra']) { const b = btn(p); b.addEventListener('click', () => { if (w.__quality) { w.__quality.auto = false; w.__quality.apply(p); } }); qual.append(b); }   // (auto off for the visit: the ladder would move the preset again)
  if (front) { const fr = line('House front (a trial)'); const b = btn(front.on ? 'Dressed by hand: on' : 'Dressed by hand: off', 'the tea house’s yard wall on the pass: its openings, paint and mends differ, and things were left against it. The page loads again to change it'); b.addEventListener('click', front.flip); fr.append(b); }   // A HOUSE FRONT DRESSED BY HAND (scene/frontTry.ts)
  if (shapes) { const sh = line('Shapes (a trial)'); const b = btn(shapes.on ? 'Round and broken: on' : 'Round and broken: off', 'round drums and tyres, a bite out of the yard wall’s top. The page loads again to change it'); b.addEventListener('click', shapes.flip); sh.append(b); }   // A GEOMETRY TRIAL (scene/geoTry.ts): made when the level loads, so the button loads the page again
  if (hills) { const hl = line('Ground (a trial)'); const b = btn(hills.on ? 'Hills cast shadows: on' : 'Hills cast shadows: off', 'the snow’s hills stand in the light’s way as their own round shape. The page loads again to change it'); b.addEventListener('click', hills.flip); hl.append(b); }   // GROUND THAT RAYS CAN SEE, A TRIAL (scene/groundField.ts): a const of the ray programs, so the button loads the page again
  document.body.append(el);
  setInterval(() => { skySync(); const f = fps(); cost.textContent = `${f.toFixed(0)} fps · ${(1000 / Math.max(f, 1)).toFixed(1)} ms a frame · ${engine.width}×${engine.height} → ${engine.outWidth}×${engine.outHeight}`; }, 500);
}
