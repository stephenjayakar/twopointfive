// THE LOOK PROTOTYPE's panel (the page /look; render/frame.ts lookConfig, shaders/look.wgsl): one slider a layer of the look, written straight into the g-buffer's
// uniform block, a button that shows the boxes plain while it is held, the hour and the quality preset, and what a frame costs. Made only on that page.
import type { Engine } from '../engine';
import { lookAmounts, lookSync, LOOK_DEFAULTS } from '../render/gbuffer';
import type { PerfRecorder, PerfDump } from './perfrec';
import type { PerfSweep } from './perfsweep';
import { takeRead, takeWords, sendTake } from './perfsend';

const ROWS: readonly [keyof typeof lookAmounts, string, string, number][] = [
  ['clarity', 'Clarity', 'one number over Relief, Cavities, Edges and Snow relief: how hard neighbouring detail is set against each other. Lower = calmer surfaces', 1.5],
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
  ['marks', 'Painted marks', 'signs, stripes and rugs drawn as brushed, rubbed paint in place of square cells. 1 = all the way; all the way up (2) is a TEST PICTURE for a GPU where the marks stay square: each mark is drawn in three colours that say what the shader found there', 2],
  ['men', 'Men', 'the men drawn as cloth, webbing, steel and skin: a print on the uniforms, folds, scuffs, snow caked on their boots', 1.5],
  ['tailor', 'Kit detail', 'what was cut and sewn on the men: seams, pockets and patches, a combat shirt, bar tacks on the webbing, sand boots, knee pads, buttons', 1],
  ['print', 'Printed cloth', "the uniform's print as it is on the bolt: a ground that drifts from tan to sage, green and brown shapes, cream flecks. 0 = the first print", 1],
  ['air', 'Air', '× the haze that shows a lamp in the air', 4],
  ['sky', 'Sky light', '× the light the sky gives: what reaches under a roof and into shade by day (1 = the hour as it is). A measuring row. It moves the real light on this page, so the guards and your light meter see it too', 4],
  ['shade', 'Eyes adjust to shade', 'by day, a place that gets less light than the open air is shown brighter, the way your eyes open up when you look into a shed. 0 = one exposure for the whole picture, 1 = the shade is brought all the way up. The picture only: the guards and your light meter read the light as it is', 1],
  ['lamps', 'Lamps by day', 'by day, how far lamps, lanterns, flashlights and fire light drop toward their real strength against the sun. 0 = as the game has them today (a lantern as strong as the midday sun), 0.6 = the flashlight is right (about 1 in 170), 1 = a bulb is right (about 1 in 5000). Night is not changed. Flashes and blasts are not changed. It moves the real light on this page, so your light meter and what the guards see of you move with it', 1],
  ['size', 'Map size', '× the 2 m a map covers', 2],
];

export function buildLookPanel(engine: Engine, fps: () => number, shapes?: { on: boolean; flip: () => void }, hills?: { on: boolean; flip: () => void }, front?: { on: boolean; flip: () => void }, lorry?: { on: boolean; flip: () => void }): void {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;right:10px;top:10px;z-index:50;width:232px;padding:10px 12px;background:rgba(12,14,16,.86);color:#cfd6d2;font:11px/1.35 ui-monospace,Menlo,monospace;border:1px solid #2c3432;border-radius:4px;user-select:none;max-height:calc(100vh - 20px);box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain';   // (it is taller than a laptop's window: it scrolls by itself, and the wheel over it never reaches the game — the listeners below)
  for (const ev of ['mousedown', 'click', 'pointerdown', 'wheel', 'contextmenu', 'dblclick']) el.addEventListener(ev, e => e.stopPropagation());   // (never the releases: the game clears a held button on the window's mouseup)
  const head = document.createElement('div'); head.textContent = 'Materials prototype'; head.style.cssText = 'font-weight:700;color:#e8efe9;margin-bottom:2px'; el.append(head);
  const cost = document.createElement('div'); cost.style.cssText = 'color:#8fa39a;margin-bottom:8px'; el.append(cost);
  const send = () => { engine.gbuffer.setLook(); lookSync(); };
  const inputs: [keyof typeof lookAmounts, HTMLInputElement, HTMLSpanElement][] = [];
  let kept: typeof lookAmounts | null = null;   // the amounts as the sliders have them, while the boxes are shown plain
  for (const [key, name, tip, max] of ROWS) {
    const row = document.createElement('label'); row.title = tip; row.style.cssText = 'display:grid;grid-template-columns:96px 1fr 30px;gap:6px;align-items:center;margin:3px 0';
    const n = document.createElement('span'); n.textContent = name;
    const s = document.createElement('input'); s.type = 'range'; s.min = key === 'size' ? '0.5' : '0'; s.max = String(max); s.step = '0.05'; s.value = String(lookAmounts[key]); s.style.cssText = 'width:100%;accent-color:#9cb8a4';
    const v = document.createElement('span'); v.textContent = lookAmounts[key].toFixed(2); v.style.textAlign = 'right';
    s.addEventListener('input', () => { (kept ?? lookAmounts)[key] = +s.value; if (key === 'size' || key === 'sky' || key === 'lamps') lookAmounts[key] = +s.value; v.textContent = (+s.value).toFixed(2); send(); });
    s.addEventListener('change', () => s.blur());   // (a focused input takes the game's keys: game/input.ts typingTarget)
    row.append(n, s, v); el.append(row); inputs.push([key, s, v]);
  }
  const btn = (text: string, tip = '') => { const b = document.createElement('button'); b.textContent = text; b.title = tip; b.addEventListener('mousedown', e => e.preventDefault()); b.style.cssText = 'font:inherit;color:#dfe7e1;background:#232a28;border:1px solid #3a4441;border-radius:3px;padding:3px 7px;margin:2px 4px 2px 0;cursor:pointer'; return b; };
  const line = (label: string) => { const d = document.createElement('div'); d.style.marginTop = '8px'; const l = document.createElement('div'); l.textContent = label; l.style.color = '#8fa39a'; d.append(l); el.append(d); return d; };
  // plain while held; a click on the box leaves it plain
  const plain = (on: boolean) => {
    if (on && !kept) { kept = { ...lookAmounts }; for (const [k] of ROWS) if (k !== 'size' && k !== 'sky' && k !== 'lamps') lookAmounts[k] = k === 'air' || k === 'ground' || k === 'clarity' ? 1 : 0; }
    else if (!on && kept) { Object.assign(lookAmounts, kept); kept = null; }
    send();
  };
  const cmp = line('Compare');
  const hold = btn('Hold: plain boxes', 'the page as the game draws it today, while this is held'); let held = false; hold.addEventListener('pointerdown', () => { held = true; plain(true); }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) hold.addEventListener(ev, () => { if (!held) return; held = false; if (!stay.checked) plain(false); });   // (only a hold that began here ends here: the sweep's plain row is not ended by a pointer passing over)
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
  if (lorry) { const lr = line('Lorry (a trial)'); const b = btn(lorry.on ? 'Curved: on' : 'Curved: off', 'the lorry on the pass with a bowed tilt, an arched cab roof, a round bonnet between fenders and round wheels. The page loads again to change it'); b.addEventListener('click', lorry.flip); lr.append(b); }   // A LORRY WITH CURVES (scene/lorryTry.ts)
  if (shapes) { const sh = line('Shapes (a trial)'); const b = btn(shapes.on ? 'Round and broken: on' : 'Round and broken: off', 'round drums and tyres, a bite out of the yard wall’s top. The page loads again to change it'); b.addEventListener('click', shapes.flip); sh.append(b); }   // A GEOMETRY TRIAL (scene/geoTry.ts): made when the level loads, so the button loads the page again
  if (hills) { const hl = line('Ground (a trial)'); const b = btn(hills.on ? 'Hills cast shadows: on' : 'Hills cast shadows: off', 'the snow’s hills stand in the light’s way as their own round shape. The page loads again to change it'); b.addEventListener('click', hills.flip); hl.append(b); }   // GROUND THAT RAYS CAN SEE, A TRIAL (scene/groundField.ts): a const of the ray programs, so the button loads the page again
  // PERFORMANCE: the F9 recorder and the F8 sweep (ui/perfrec.ts, ui/perfsweep.ts) from two buttons, with the look's layers as rows of the sweep, and the take
  // sent where a hosted page can send it (ui/perfsend.ts): a page in a sandbox starts no download, so a take made there never left it. The maintainer, 10-25:
  // "it'd be good to have a way to collect a lot of perf data so you can see how it runs on my laptop", and "i do worry that we have a few stuttering frames even
  // if overall fps is pretty high". Record play = every frame's time while he plays (the slow frames are listed one by one); Price the layers = the sweep, hands off.
  const perfRows = (): boolean => {   // (the page makes its recorder after this panel: asked for until it is there)
    const rec = w.__perfrec as PerfRecorder | undefined, sweep = w.__perfsweep as PerfSweep | undefined;
    if (!rec || !sweep) return false;
    {
      const pf = line('Performance');
      const play = btn('Record play', 'records every frame while you play; press again to stop and send. A minute or two with a fight in it says most');
      const price = btn('Price the layers', 'hands off for a few minutes: the picture holds still and each layer is switched off in turn. The picture flickers. The prices are read from the take afterwards');
      const said = document.createElement('div'); said.style.cssText = 'color:#8fa39a;margin-top:4px;white-space:pre-wrap';
      const box = document.createElement('textarea'); box.readOnly = true; box.hidden = true; box.style.cssText = 'width:100%;height:70px;margin-top:4px;box-sizing:border-box;font:10px/1.3 ui-monospace,Menlo,monospace;background:#161b1a;color:#cfd6d2;border:1px solid #3a4441;border-radius:3px';
      const cp = btn('Copy the read'); cp.hidden = true;
      cp.addEventListener('click', () => { const done = () => { cp.textContent = 'Copied'; setTimeout(() => { cp.textContent = 'Copy the read'; }, 1500); }; const old = () => { box.focus(); box.select(); }; if (navigator.clipboard?.writeText) navigator.clipboard.writeText(box.value).then(done, old); else old(); });
      pf.append(play, price, said, box, cp);
      const OFF: (keyof typeof lookAmounts)[] = ['size', 'sky', 'air', 'clarity', 'untile', 'lamps'];   // (not layers with a cost of their own to switch off)
      sweep.extra = [
        { id: 'look.all', label: 'look: every layer off (plain boxes)', flip: () => kept ? 'the boxes are shown plain already' : { from: { look: 1 }, to: { look: 0 }, apply: () => { plain(true); return () => plain(false); } } },
        ...ROWS.filter(([k]) => !OFF.includes(k)).map(([key, name]) => ({ id: `look.${key}`, label: `look: ${name} off`, flip: () => { const from = lookAmounts[key], to = key === 'ground' ? 1 : 0; if (kept) return 'the boxes are shown plain'; if (from === to) return 'already off';   // (the snow's relief is × the game's own: 1 is off, as plain boxes have it)
          return { from: { [key]: from }, to: { [key]: to }, apply: () => { lookAmounts[key] = to; send(); return () => { lookAmounts[key] = from; send(); }; } }; } })),
      ];
      const deliver = rec.deliver.bind(rec);
      rec.deliver = (dump: PerfDump) => {
        // the recorder's own way out (a download, the shot server on this machine) where no store is handed in. With a store the page is a hosted one that
        // starts no download: the try only raises the host's "downloads aren't available" notice over a take that did get out
        if ((window as unknown as { __takeStore?: unknown }).__takeStore) (window as unknown as { __lastPerfDump?: PerfDump }).__lastPerfDump = dump; else deliver(dump);
        const id = `perf-${dump.startedAt.replace(/[:.]/g, '-')}`, read = takeRead(dump, id), words = takeWords(read).join('\n');
        box.value = JSON.stringify(read); box.hidden = false; cp.hidden = false; said.textContent = words;
        void sendTake(dump, read, t => { said.textContent = `${words}\n${t}`; }).then(t => { said.textContent = `${words}\n${t}`; said.scrollIntoView({ block: 'nearest' }); });
      };
      play.addEventListener('click', () => { if (sweep.active) return; if (rec.recording) rec.stop(); else { rec.start('look prototype: a play take (the panel)'); said.textContent = 'recording: play, then press Stop'; } });
      price.addEventListener('click', () => { if (sweep.active) { sweep.stop('the panel'); return; } if (rec.recording) return;
        const why = sweep.start({ only: [...sweep.extra.map(x => x.id), 'fog', 'sharp', 'reflect', 'meshNear', 'scaleDown'] }); if (!sweep.active) said.textContent = `not started (${why})`; });
      setInterval(() => { play.textContent = rec.recording && !sweep.active ? 'Stop and send' : 'Record play'; price.textContent = sweep.active ? `Stop (${sweep.progress})` : 'Price the layers'; }, 500);
    }
    return true;
  };
  // THE CHARACTER LAB (host/charlab.ts): the camera down on you at a man's height, and you in any outfit of the cast. The maintainer, 10-25: "we should just
  // iterate on the characters in a character lab". Its rows show while it is open.
  const labRows = (): boolean => {   // (made after this panel, like the recorder)
    const lab = w.__charlab as { state: { on: boolean; yaw: number; pitch: number; dist: number; height: number; turn: boolean }; open(): void; leave(): void; wear(pick: string | number): string; worn(): string; outfits(): string[] } | undefined;
    if (!lab) return false;
    const cl = line('Character lab');
    const open = btn('Open', 'the camera comes down to you and stays on you; nobody notices or hurts you. Walk into the light you want to judge a man in');
    const rows = document.createElement('div'); rows.hidden = true;
    const prev = btn('◀', 'the outfit before'), next = btn('▶', 'the next outfit'), worn = document.createElement('span'); worn.style.color = '#e8efe9';
    const wearRow = document.createElement('div'); wearRow.append(prev, next, worn);
    const said = document.createElement('div'); said.textContent = 'You are the mannequin. Walk him into the sun, the shade or by a lamp.'; said.style.cssText = 'color:#8fa39a;margin:3px 0';
    rows.append(wearRow);
    const S = lab.state;
    skyRow(rows, 'Angle', 'where the camera stands round you, in degrees', 0, 359, 1, 0, () => S.yaw, v => { S.yaw = v; });
    skyRow(rows, 'Height', 'how steeply it looks down, in degrees', 2, 80, 1, 0, () => S.pitch, v => { S.pitch = v; });
    skyRow(rows, 'Distance', 'metres from you', 1.2, 9, 0.1, 1, () => S.dist, v => { S.dist = v; });
    skyRow(rows, 'Looks at', 'the height on you it looks at, in metres: 1.6 is the face, 0.2 the boots', 0.1, 1.8, 0.05, 2, () => S.height, v => { S.height = v; });
    const turnL = document.createElement('label'); const turn = document.createElement('input'); turn.type = 'checkbox'; turn.addEventListener('change', () => { S.turn = turn.checked; turn.blur(); }); turnL.append(turn, ' turn slowly round him');
    rows.append(turnL, said);
    const show = () => { rows.hidden = !S.on; open.textContent = S.on ? 'Leave' : 'Open'; worn.textContent = S.on ? ` ${lab.worn()}` : ''; turn.checked = S.turn; };
    open.addEventListener('click', () => { if (S.on) lab.leave(); else lab.open(); show(); });
    prev.addEventListener('click', () => { lab.wear(-1); show(); }); next.addEventListener('click', () => { lab.wear(1); show(); });
    cl.append(open, rows); show();
    return true;
  };
  for (const made of [labRows, perfRows]) if (!made()) { const h = setInterval(() => { if (made()) clearInterval(h); }, 300); }
  document.body.append(el);
  setInterval(() => { skySync(); const f = fps(); cost.textContent = `${f.toFixed(0)} fps · ${(1000 / Math.max(f, 1)).toFixed(1)} ms a frame · ${engine.width}×${engine.height} → ${engine.outWidth}×${engine.outHeight}`; }, 500);
}
