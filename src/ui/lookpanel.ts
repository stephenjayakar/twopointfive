// THE LOOK PROTOTYPE's panel (the page /look; render/frame.ts lookConfig, shaders/look.wgsl): one slider a layer of the look, written straight into the g-buffer's
// uniform block, a button that shows the boxes plain while it is held, the hour and the quality preset, and what a frame costs. Made only on that page.
import type { Engine } from '../engine';
import { lookAmounts } from '../render/gbuffer';

const ROWS: readonly [keyof typeof lookAmounts, string, string, number][] = [
  ['paint', 'Paint', 'the colour the maps add to the box paint', 1.5],
  ['relief', 'Relief', 'how deep the normal maps cut', 1.6],
  ['shine', 'Finish', 'roughness from the maps', 1.5],
  ['cavity', 'Cavities', 'joints and pits hold shadow', 1.5],
  ['weather', 'Weather', 'damp wall feet, bleached tops, runs, trodden ground', 1.5],
  ['untile', 'Break the repeat', 'two turned copies cross-faded', 1],
  ['edges', 'Edges', 'small boxes: rounded, rubbed corners', 1.5],
  ['size', 'Map size', '× the 2 m a map covers', 2],
];

export function buildLookPanel(engine: Engine, fps: () => number): void {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;right:10px;top:10px;z-index:50;width:232px;padding:10px 12px;background:rgba(12,14,16,.86);color:#cfd6d2;font:11px/1.35 ui-monospace,Menlo,monospace;border:1px solid #2c3432;border-radius:4px;user-select:none';
  for (const ev of ['mousedown', 'click', 'pointerdown', 'wheel', 'contextmenu', 'dblclick']) el.addEventListener(ev, e => e.stopPropagation());   // (never the releases: the game clears a held button on the window's mouseup)
  const head = document.createElement('div'); head.textContent = 'Materials prototype'; head.style.cssText = 'font-weight:700;color:#e8efe9;margin-bottom:2px'; el.append(head);
  const cost = document.createElement('div'); cost.style.cssText = 'color:#8fa39a;margin-bottom:8px'; el.append(cost);
  const send = () => engine.gbuffer.setLook();
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
    if (on && !kept) { kept = { ...lookAmounts }; for (const [k] of ROWS) if (k !== 'size') lookAmounts[k] = 0; }
    else if (!on && kept) { Object.assign(lookAmounts, kept); kept = null; }
    send();
  };
  const cmp = line('Compare');
  const hold = btn('Hold: plain boxes', 'the page as the game draws it today, while this is held'); hold.addEventListener('pointerdown', () => plain(true)); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) hold.addEventListener(ev, () => { if (!stay.checked) plain(false); });
  const stayL = document.createElement('label'); const stay = document.createElement('input'); stay.type = 'checkbox'; stay.addEventListener('change', () => { plain(stay.checked); stay.blur(); }); stayL.append(stay, ' stay plain'); stayL.style.marginLeft = '4px';
  cmp.append(hold, stayL);
  const reset = btn('Reset'); reset.addEventListener('click', () => { stay.checked = false; kept = null; for (const [k, s, v] of inputs) { lookAmounts[k] = 1; s.value = '1'; v.textContent = '1.00'; } send(); }); cmp.append(reset);
  const w = window as any;
  const hours = line('Hour'); for (const h of ['night', 'dawn', 'midday', 'overcast', 'dusk']) { const b = btn(h); b.addEventListener('click', () => w.__hour?.set(h)); hours.append(b); }
  const qual = line('Quality'); for (const p of ['low', 'medium', 'high', 'ultra']) { const b = btn(p); b.addEventListener('click', () => { if (w.__quality) { w.__quality.auto = false; w.__quality.apply(p); } }); qual.append(b); }   // (auto off for the visit: the ladder would move the preset again)
  document.body.append(el);
  setInterval(() => { const f = fps(); cost.textContent = `${f.toFixed(0)} fps · ${(1000 / Math.max(f, 1)).toFixed(1)} ms a frame · ${engine.width}×${engine.height} → ${engine.outWidth}×${engine.outHeight}`; }, 500);
}
