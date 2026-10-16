// Sound lanes under the engine replay's timeline (`?playtape=…`): one row per sound the tape has asked the mixer for, a mark each time it was asked, the row's
// name lit while it sounds. The maintainer, 10-12: "a special replay viewer mode where we have the audio tracks in the timeline below, and I can see what's playing
// and then flag individual ones. and being able to pick between a few options (or maybe even parameterize them) would go a long way".
//
// A click on a row (or on one mark) opens its card: which TAKE plays on this page (before = audio/sfxWas.ts, after = audio/sfx.ts, new 1 / new 2 = audio/sfxAlt.ts),
// its pitch, tone and level, a flag and a few words. The takes and the three numbers are laid on live by the mixer (audio.ts `trims`), on replay pages only; the
// picks are this browser's (localStorage) and leave as ONE line of text ('copy picks') to paste into the chat.
//
// A TAKE CAN BE TUNED (replay/soundtune.ts): the card lists the take's LAYERS — the instrument calls it is made of — each with its numbers in ms / Hz / dB / cents,
// a mute and a solo, the seed it is made off, and a high-pass and a bell over the result. What he changed is the pick's `tune`; the voice made under it is one more
// take of the mixer's, 'tuned', rendered again a moment after a dial moves.
//
// THE LANES ONLY LISTEN (audio.ts `tap`) AND TRIM: nothing here is read by the game, so a tape plays the same run whatever is picked. A tape knows a sound only
// once it has asked for it, so the rows fill in as it plays and are kept (sessionStorage) across the page load a seek backwards costs.
import type { AudioEngine, SoundAsk, SoundMix, SoundTrim } from '../audio/audio';
import { SFX_TABLE } from '../audio/audio';
import type { SfxBuffer } from '../audio/backend';
import { sfxContext } from '../audio/backend';
import type { SfxName } from '../audio/sfx';
import { buildSfx } from '../audio/sfx';
import type { SfxNameWas } from '../audio/sfxWas';
import { WAS_IN_GAME, wasOnly } from '../audio/sfxWas';
import { altPicked, altTake, altTakes } from '../audio/sfxAlt';
import type { TapePlay } from './engineplay';
import { SoundFilm } from './soundfilm';
import { BELL_DB, BELL_HI, BELL_LO, HP_HI, HP_LO, Q_HI, Q_LO, SEED_MAX, dBOf, layerSays, madeOf, paramsOf, pulledOf, renderTune, said, shown, spectrum, tuneEmpty, tuneOf, tuneText, typed, type SoundTune, type Unit } from './soundtune';

/** what he picked for one sound (every field optional: none = the game's own) */
export interface SoundPick extends Kept { flag?: boolean; at?: string; note?: string; mine?: Kept[] }
/** how one sound plays: the take ('tuned' = `tune`'s base take made under it), the mixer's three trims (rate = pitch, tone = a low-pass in Hz, gain), the tune.
 *  `mine` = up to MINE_MAX of these he kept on the card to come back to. */
export interface Kept { take?: string; tune?: SoundTune; rate?: number; tone?: number; gain?: number }
interface Ev { f: number; n: number; heard: 0 | 1 | 2; gain: number; dur: number; mix?: SoundMix }

const PICKS_LS = 'twopointsix.soundpicks', OPEN_LS = 'twopointsix.soundlanes', EV_SS = 'twopointsix.soundlanes:', LOOP_SS = 'twopointsix.soundlanes.loop';
/** a stretch on a loop: this long between its end and its next pass; a drag on the strip shorter than this many px is a click */
const LOOP_GAP = 0.25, DRAG_PX = 4, LOOP_BACK = 5;
/** one wheel event (or one press of − / +) changes the seconds shown by at most this factor; the span is written to the store this long after the last change;
 *  an Esc let go this soon after a field lost the keyboard, or the replay's big map was up, was theirs */
const ZOOM_STEP = 1.25, KEEP_SPAN_MS = 300, ESC_THEIRS_MS = 600, NO_PICTURE = 'no picture here · play through it once';
const ROW = 13, RULE = 30, GOLD = '#f2cf6b', LIVE = '#8ff0b4', CYAN = '#7fc8ff', TONE_LO = 400, TONE_HI = 20000, RATE_LO = 0.5, RATE_HI = 2, LEVEL_LO = -24, GAIN_LO = Math.pow(10, LEVEL_LO / 20), MINE_MAX = 3, TUNE_MS = 80;
/** the lanes' own window of time: SPAN seconds wide (the wheel: SPAN_LO … SPAN_HI), the head HEAD_AT of the way across it, right of a GUT px gutter of names */
const GUT = 148, DOCK = 260, DOCK_MIN = 120, CARD = 360, SPAN_DEF = 30, SPAN_LO = 10, SPAN_HI = 120, HEAD_AT = 0.75, BG = '#111316';
// THREE COLOURS, the dock and its card alike: green (LIVE) = now (the tape's head, a lane sounding, the take and the numbers the mixer plays NOW) · gold = flags ·
// cyan = hearing again (checkpoints, its head, its stretch, the loop). No text under 11 px. GREEN MEANS ONLY "NOW" (the tape's head, a lane sounding): what is
// picked, selected or moved off its default is WHITE (an outline, a bold name, a white thumb and number), what is at rest is grey.
// THE RULER IS TWO ROWS: the checkpoints' flags (and the two heads' marks), then the times — nothing is drawn over a time. A stretch's handles hang BELOW it.
/** the game's own HUD and the replay's corner map, hidden while the RECORDED picture is up (they would show NOW's values, and now's places, over then's picture);
 *  the replay's bar stays, and so does its big map (M), which is asked for */
const HUD = ['#overlay', '#equip', '#lcol', '#meters', '#log', '#objective', '#alarm', '#checkpoint', '#journal', '#caption', '#blind', '#veil', '#tapemap'];
const CSS = `
#sndl{position:fixed;left:0;right:0;z-index:69;display:flex;flex-direction:column;height:${DOCK}px;box-sizing:border-box;border-top:1px solid rgba(233,226,214,.2);background:${BG};color:#e9e2d6;font:11px/1 var(--m-head,system-ui),system-ui,sans-serif;letter-spacing:.04em;user-select:none}
#sndl.shut{height:auto}
${HUD.map(h => `body.sndfilm-on ${h}`).join(',')}{visibility:hidden}
#sndfilmtag{position:fixed;padding:5px 8px;border:1px solid ${CYAN};border-radius:3px;background:${BG};color:${CYAN};font:12px/1 var(--m-head,system-ui),system-ui,sans-serif;letter-spacing:.04em;font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none}
#sndnopic{position:fixed;transform:translate(-50%,-50%);padding:6px 10px;border:1px solid ${CYAN};border-radius:3px;background:${BG};color:${CYAN};font:12px/1 var(--m-head,system-ui),system-ui,sans-serif;letter-spacing:.04em;white-space:nowrap;pointer-events:none}
#sndl[hidden]{display:none}
#sndl .hd{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;padding:4px 14px;text-transform:uppercase;white-space:nowrap}
#sndl .hd>*{flex:none}
#sndl .hd span{opacity:.8}
#sndl .hd b{font-weight:400;color:${GOLD}}
#sndl .hd button{all:unset;cursor:pointer;padding:3px 6px;border:1px solid rgba(233,226,214,.28);border-radius:3px}
#sndl .hd button[hidden]{display:none}
#sndl .hd button:hover{border-color:#e9e2d6}
#sndl .hd button.car{border-color:transparent;padding:3px 4px;min-width:1em;text-align:center}
#sndl .hd button.is,#sndl .hd button.chip{border-color:${CYAN};color:${CYAN}}
#sndl .hd button.lp.is{background:rgba(127,200,255,.2)}
#sndl .hd button.chip{padding:3px 3px 3px 5px;font-variant-numeric:tabular-nums}
#sndl .hd button.chip i{font-style:normal;margin-left:4px;padding:0 3px;opacity:.6}
#sndl .hd button.chip i:hover{opacity:1;color:#fff}
#sndl .hd button.chip.ahead,#sndl .rl .cp.ahead{opacity:.35;cursor:default}
#sndl .hd button.chip.ahead:hover{background:none}
#sndl .hd button.chip b{color:${BG};background:${CYAN};border-radius:2px;padding:0 3px;margin-right:1px}
#sndl .hd button.chip:hover{background:rgba(127,200,255,.2)}
#sndl .hd button.off{opacity:.35;cursor:default;border-color:rgba(233,226,214,.28)}
#sndl .hd .cps{display:flex;flex-wrap:wrap;gap:4px}
#sndl .hd .cps:empty{display:none}
#sndl .hd .cps>*{flex:none}
#sndl .mn{flex:1;min-height:0;display:flex}
#sndl.shut .mn{display:none}
#sndl .bd{position:relative;flex:1;min-width:0;display:flex;flex-direction:column}
#sndl .rl{position:relative;flex:none;height:${RULE}px;cursor:pointer;background:rgba(233,226,214,.05);overflow:hidden;touch-action:none}
#sndl .rl canvas{position:absolute;top:0;left:${GUT}px;pointer-events:none}
#sndl .rl .gut{position:absolute;left:0;top:0;width:${GUT}px;height:100%;box-sizing:border-box;padding:0 8px 0 14px;display:flex;align-items:center;justify-content:flex-end;gap:5px;background:${BG};color:rgba(233,226,214,.6);cursor:default;z-index:1}
#sndl .rl .gut button{all:unset;cursor:pointer;width:15px;height:15px;line-height:15px;text-align:center;border:1px solid rgba(233,226,214,.28);border-radius:3px;color:#e9e2d6}
#sndl .rl .gut button:hover{border-color:#e9e2d6}
#sndl .rl .cp{position:absolute;top:0;height:13px;min-width:5px;padding:0 3px;font:normal 11px/13px ui-monospace,Menlo,Consolas,monospace;letter-spacing:0;background:${CYAN};color:${BG};border-radius:0 2px 2px 0;cursor:pointer}
#sndl .rl .cp:hover{background:#fff}
#sndl .rows{position:relative;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden}
#sndl .lb{position:absolute;left:0;width:${GUT}px;height:${ROW}px;line-height:${ROW}px;padding:0 6px 0 14px;box-sizing:border-box;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:pointer;background:${BG};color:rgba(233,226,214,.6)}
#sndl .lb:hover,#sndl .lb.sel{color:#fff}
#sndl .lb.sel{background:#22262b}
#sndl .lb.on{color:${LIVE}}
#sndl.re .lb.on{color:${CYAN}}
#sndl .lb.flag,#sndl .lb.flag:hover{color:${GOLD}}
#sndl .lb.flag::before{content:'⚑ '}
#sndl .lb.cut::after{content:' •';color:#e9e2d6}
#sndl .lb.flag::before{color:${GOLD}}
#sndl .lb.sel,#sndl .lb.sel.on,#sndl .lb.sel.flag{color:#fff;font-weight:700}
#sndl .rows canvas{position:absolute;top:0;left:${GUT}px;cursor:pointer}
#sndl .ov{position:absolute;left:${GUT}px;right:0;top:0;bottom:0;overflow:hidden;pointer-events:none}
#sndl .ov>*{position:absolute;top:0;height:100%}
#sndl .ov .band{background:rgba(127,200,255,.13)}
#sndl .ov .reg{box-sizing:border-box;border:1px solid ${CYAN};border-top-width:2px;border-bottom:0;background:rgba(127,200,255,.07)}
#sndl .ov .hnd{top:${RULE}px;height:13px;width:8px;margin-left:-4px;box-sizing:border-box;border-radius:0 0 3px 3px;background:${CYAN};box-shadow:0 0 0 1px ${BG};cursor:ew-resize;touch-action:none;pointer-events:auto;z-index:2}
#sndl .ov .hnd:hover{background:#fff}
#sndl .ov .now{width:1px;background:${LIVE};z-index:3}
#sndl .ov .now::before{content:'';position:absolute;left:-4px;top:0;border:4px solid transparent;border-top:7px solid ${LIVE};border-bottom:0}
#sndl .ov .reh{width:2px;margin-left:-1px;background:${CYAN}}
#sndl .ov .reh::before{content:'↺';position:absolute;left:-6px;top:0;width:14px;height:13px;text-align:center;font-size:11px;line-height:13px;border-radius:7px;background:${CYAN};color:${BG}}
#sndl .ft{flex:none;width:${GUT}px;height:${ROW}px;line-height:${ROW}px;box-sizing:border-box;padding:0 6px 0 14px;white-space:nowrap;font-variant-numeric:tabular-nums;color:rgba(233,226,214,.8);pointer-events:none}
#sndl .fd{position:absolute;left:0;right:0;bottom:${ROW}px;height:16px;pointer-events:none;background:linear-gradient(rgba(17,19,22,0),${BG})}
#sndl [hidden]{display:none}
#sndcard{flex:none;width:min(${CARD}px,45%);box-sizing:border-box;overflow-y:auto;overflow-x:hidden;padding:8px 12px;display:flex;flex-direction:column;gap:6px;background:${BG};border-left:1px solid rgba(233,226,214,.28);color:#e9e2d6;font:11px/1.2 var(--m-head,system-ui),system-ui,sans-serif;letter-spacing:.04em}
#sndcard>*{flex:none}
#sndcard .t{display:flex;align-items:center;gap:8px}
#sndcard .t b{font-weight:400;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis}
#sndcard .t i{font-style:normal;opacity:.6}
#sndcard button{all:unset;cursor:pointer;padding:3px 8px;border:1px solid rgba(233,226,214,.28);border-radius:3px;text-transform:uppercase;font-size:11px}
#sndcard button:hover{border-color:#e9e2d6}
#sndcard button.is{border-color:#fff;color:#fff;box-shadow:inset 0 0 0 1px #fff}
#sndcard button.game::after{content:'in game';margin-left:6px;padding:0 4px;border-radius:2px;background:rgba(233,226,214,.16);text-transform:none;letter-spacing:0}
#sndcard button.flag.is{background:${GOLD};border-color:${GOLD};color:#111316;box-shadow:none}
#sndcard .tk{display:flex;flex-wrap:wrap;gap:6px}
#sndcard .d{display:grid;grid-template-columns:52px 1fr 56px 50px;align-items:center;gap:6px;text-transform:uppercase}
#sndcard .d i{font-style:normal;opacity:.6;text-transform:none;white-space:nowrap}
#sndcard .d3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
#sndcard .d3 .d{grid-template-columns:minmax(0,1fr) 44px 16px;grid-template-areas:"w n u" "s s s";gap:2px 3px}
#sndcard .d3 .d input.n{padding:2px 3px}
#sndcard .d3 .d>span{grid-area:w;white-space:nowrap}
#sndcard .d3 .d input[type=range]{grid-area:s}
#sndcard .d3 .d input.n{grid-area:n}
#sndcard .d3 .d i{grid-area:u}
#sndcard .d3 .d.ch>span::after{content:none}
#sndcard .d input.n,#sndcard .sd input.n{width:100%;box-sizing:border-box;min-width:0;background:rgba(233,226,214,.08);border:1px solid transparent;border-radius:3px;color:inherit;font:11px/1.2 ui-monospace,Menlo,Consolas,monospace;padding:2px 4px;text-align:right}
#sndcard .d input.n:focus,#sndcard .sd input.n:focus{border-color:rgba(233,226,214,.4);outline:none}
#sndcard .d.ch input.n,#sndcard .sd.ch input.n{color:#fff;font-weight:700}
#sndcard .d.ch>span::after,#sndcard .sd.ch>span::after{content:' •';color:#fff}
#sndcard .d.ch input[type=range]{accent-color:#fff}
#sndcard .sec{display:flex;align-items:center;gap:6px;opacity:.5;text-transform:uppercase;letter-spacing:.12em;margin-top:2px}
#sndcard .sec::after{content:'';flex:1;border-top:1px solid rgba(233,226,214,.18)}
#sndcard .sp{width:100%;height:54px;display:block;background:rgba(233,226,214,.04);border-radius:3px}
#sndcard .sd{display:grid;grid-template-columns:52px 80px auto 1fr;white-space:nowrap;align-items:center;gap:6px;text-transform:uppercase}
#sndcard .ly{display:flex;flex-direction:column;gap:2px;flex:none}
#sndcard .l{display:grid;grid-template-columns:18px 40px 1fr auto auto;align-items:center;gap:6px;height:17px;flex:none;cursor:pointer;font:11px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:0}
#sndcard .l:hover b,#sndcard .l.open b{color:#fff}
#sndcard .l b{font-weight:400}
#sndcard .l>span{opacity:.5;text-align:right}
#sndcard .l i{font-style:normal;opacity:.7;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#sndcard .l.ch>span{opacity:1;color:#fff}
#sndcard .l.off b,#sndcard .l.off i{opacity:.35;text-decoration:line-through}
#sndcard .l button{padding:0 5px}
#sndcard .lp{display:flex;flex-direction:column;gap:3px;padding:3px 0 5px 12px;border-left:1px solid rgba(233,226,214,.4);flex:none}
#sndcard .op{display:flex;flex-wrap:wrap;gap:6px}
#sndcard input[type=range]{width:100%;min-width:0;margin:0;height:14px;accent-color:#8d8a84}
#sndcard .pk{margin-top:-3px;text-align:right;opacity:.6;font:11px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:0}
#sndcard .pk.bad{opacity:1;color:#ff6a5a}
#sndcard.more::after{content:'';flex:none;position:sticky;bottom:-8px;height:22px;margin-top:-22px;pointer-events:none;background:linear-gradient(rgba(17,19,22,0),${BG})}
#sndcard .fl{display:flex;gap:6px}
#sndcard .fl input{flex:1;min-width:0;background:rgba(233,226,214,.08);border:1px solid rgba(233,226,214,.28);border-radius:3px;color:inherit;font:inherit;padding:3px 6px}
#sndcard button.re{border-color:${CYAN};color:${CYAN}}`;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
function read<T>(s: Storage | null, k: string, d: T): T { try { const v = s?.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } }
function write(s: Storage | null, k: string, v: unknown): boolean { try { s?.setItem(k, JSON.stringify(v)); return true; } catch { return false; /* a full or blocked store: the lanes still work for this page */ } }
const store = (which: 'localStorage' | 'sessionStorage'): Storage | null => { try { return window[which]; } catch { return null; } };
const num = (v: unknown, lo: number, hi: number): number | undefined => typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined;
/** a take's name as the card writes it, for a sound that could have it (whether this page's table really holds it is asked once the mixer is up: `apply`) */
/** a name every object answers to ('constructor', 'toString', '__proto__'): no sound, and a plain table would hand back a function for it */
const odd = (name: string) => name in Object.prototype;
const takeNamed = (name: string, take: string) => !odd(name) && (take === 'before' || take === 'after' || (/^new [1-9]$/.test(take) && +take.slice(4) <= altTakes(name) && !altPicked(name, +take.slice(4) - 1)));
/** one kept pick read as what it may be — another build's, a hand edit, another page's value under the same key: anything that is not a pick is dropped */
function keptOf(name: string, o: Record<string, unknown>, p: Kept): Kept {
  const rate = num(o.rate, RATE_LO, RATE_HI), tone = num(o.tone, TONE_LO, TONE_HI), gain = num(o.gain, GAIN_LO, 2), tune = tuneOf(o.tune, base => takeNamed(name, base));
  if (typeof o.take === 'string' && (o.take === 'tuned' ? !!tune : takeNamed(name, o.take))) p.take = o.take;
  if (tune) p.tune = tune;
  if (rate !== undefined && rate !== 1) p.rate = rate; if (tone !== undefined && tone < TONE_HI) p.tone = tone; if (gain !== undefined && gain !== 1) p.gain = gain;
  return p;
}
function pickOf(name: string, v: unknown): SoundPick | null {
  if (odd(name) || !v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>, p: SoundPick = keptOf(name, o, {});
  if (Array.isArray(o.mine)) { const mine = o.mine.slice(0, MINE_MAX).filter(m => m && typeof m === 'object' && !Array.isArray(m)).map(m => keptOf(name, m as Record<string, unknown>, {})).filter(m => Object.keys(m).length); if (mine.length) p.mine = mine; }
  if (o.flag === true) { p.flag = true; if (typeof o.at === 'string' && o.at) p.at = o.at.slice(0, 80); }
  if (typeof o.note === 'string' && o.note) p.note = o.note.slice(0, 400);
  return Object.keys(p).length ? p : null;
}
const NAME_MAX = 40, EV_MAX = 40000, KEEP_MS = 5000, REDRAW_MS = 500;
/** checkpoints: this many a replay (one more lets the oldest go), kept for this many replays; with none set, "again" is the last BACK_S seconds */
const CP_LS = 'twopointsix.soundlanes.cp', CP_MAX = 6, CP_TAPES = 24, BACK_S = 10;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
/** a kept voice's mix as the short row the session store holds (eight numbers for a sound with a place, five without) … */
const mixRow = (m: SoundMix): number[] => m.rel ? [r3(m.rel[0]), r3(m.rel[1]), r3(m.rel[2]), r3(m.gain), r3(m.rate), Math.round(m.cut ?? 0), r3(m.send ?? 0), m.hrtf ? 1 : 0]
  : [r3(m.gain), r3(m.rate), Math.round(m.cut ?? 0), m.pan === undefined ? 9 : r3(m.pan), r3(m.send ?? 0)];
/** … and read back as what it MAY be: every number clamped to what a mixer can be handed, any other shape = no mix (that mark is then not heard again) */
function mixOf(v: unknown): SoundMix | undefined {
  if (!Array.isArray(v) || (v.length !== 8 && v.length !== 5) || !v.every(x => typeof x === 'number' && isFinite(x))) return undefined;
  const a = v as number[], c = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x)), cut = (x: number) => x >= 20 ? Math.min(x, 24000) : undefined, send = (x: number) => x > 0 ? Math.min(x, 4) : undefined;
  return a.length === 8 ? { rel: [c(a[0], -400, 400), c(a[1], -400, 400), c(a[2], -400, 400)], gain: c(a[3], 0, 8), rate: c(a[4], 0.1, 4), cut: cut(a[5]), send: send(a[6]), hrtf: a[7] === 1 }
    : { gain: c(a[0], 0, 8), rate: c(a[1], 0.1, 4), cut: cut(a[2]), pan: Math.abs(a[3]) <= 1 ? a[3] : undefined, send: send(a[4]) };
}
function cpsOf(v: unknown): Record<string, number[]> {
  const out = Object.create(null) as Record<string, number[]>;
  if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k, a] of Object.entries(v)) if (k.length <= 400 && Array.isArray(a)) { const fs = [...new Set(a.filter((f): f is number => Number.isInteger(f) && f >= 0))].slice(-CP_MAX); if (fs.length) out[k] = fs; }
  return out;
}

export class SoundLanes {
  private tAt: Float64Array; private tEnd: number; private label: string;
  private names: string[] = []; private idx = new Map<string, number>(); private count: number[] = []; private durOf: number[] = [];
  private byStep = new Map<number, Ev[]>(); private fresh = new Set<number>();   // fresh = steps this page load has heard itself (their kept list is replaced, not added to)
  private lit: number[] = []; private litOn: boolean[] = [];
  private store: Record<string, SoundPick>;
  private loaded = new Set<string>(); private redone: Record<SfxName, SfxBuffer> | null = null; private applied = false;
  private bufs = new Map<string, SfxBuffer | null>(); private takeList = new Map<string, string[]>();   // (a take is rendered once, and asked for once, per page)
  private root = el('div'); private head = el('div', 'hd'); private tally = el('span'); private rows = el('div', 'rows'); private cv = el('canvas'); private now = el('div', 'now');
  /** the body under the head: the ruler, the lanes, and over both the heads and bands (`ov`); `span` = seconds across the lanes */
  private main = el('div', 'mn'); private body = el('div', 'bd'); private hl = el('i', 'hnd'); private hr = el('i', 'hnd'); private hdrag: { keep: number; id: number } | null = null; private backSaid = ''; private copyN = -1; private ov = el('div', 'ov'); private rc = el('canvas'); private gut = el('div', 'gut'); private gutSay = el('span'); private reh = el('div', 'reh'); private caret = el('button', 'car'); private fade = el('div', 'fd'); private foot = el('div', 'ft'); private cpBox = el('div', 'cps'); private copy = el('button', 'copy', 'copy picks');
  private span = SPAN_DEF; private drawn = '';
  /** checkpoints (steps, in the order they were set) and the strip they sit on; `re` = a stretch being heard again: the tape stands still, the lanes' own clock runs from
   *  `f0` to the step the tape stands at and hands each sound that was HEARD there back to the mixer (`AudioEngine.again`) under the picks as they are now */
  private cps: number[] = []; private rule = el('div', 'rl'); private band = el('div', 'band'); private flags: { f: number; e: HTMLElement; chip: HTMLElement; ahead: boolean }[] = []; private back = el('button', 'back', '↺ again'); private cpN = 0;
  private re: { f0: number; f1: number; t: number; end: number; list: Ev[]; i: number; last: number; resume: boolean; at: number; wait: number } | null = null;
  /** ⟳ = the stretch heard again REPEATS (LOOP_GAP after a pass ends the next one starts, under the takes and dials as they stand THEN) until it is stopped; `reg` = a
   *  stretch dragged out on the strip, [first step, the step it stops short of): what "again" hears while it is set; `rePass` = passes begun of the stretch last started */
  film: SoundFilm | null = null; private reShown = true; private frameWas: ((dt: number) => void) | null = null; private frameOwn = false; private noTag: HTMLElement | null = null; private filmTag: HTMLElement | null = null; private filmOn = false; private filmSaid = ''; private peakEl: HTMLElement | null = null; private styleEl: HTMLStyleElement | null = null;
  /** THE WINDOW HOLDS STILL under a stretch heard again and under a held drag: `win` = the window as it stood when that began (widened or shifted ONCE if the stretch
   *  did not fit it), null = it follows the tape's step */
  private win: { t0: number; span: number } | null = null; private zoomF = SPAN_DEF; private spanT = 0; private escTheirs = -1e9;
  private loopOn = false; private loopBtn = el('button', 'lp', '⟳ loop'); private reg: [number, number] | null = null; private regBand = el('div', 'reg'); private rePass = 0;
  private drag: { x: number; f: number; id: number; moved: boolean } | null = null; private dragged = false;
  private reLit: number[] = []; private reOn = false; private reN = 0; private reAll = 0; private lastFrom = -1;
  private labels: HTMLDivElement[] = []; private card: HTMLDivElement | null = null; private cardOf = ''; private cardAt = '';
  /** the tuned take of each sound as the mixer has it (`tunedKey` = the tune it was made under) and the ones a moving dial still owes (made TUNE_MS after it rests);
   *  on the card: the layer whose dials are open, the layer heard alone (never kept), the bell's place while its gain is 0, `hold` = no refill under a drag */
  private tunedKey = new Map<string, string>(); private tunedBuf = new Map<string, SfxBuffer>(); private due = new Set<string>(); private dueT = 0; private lazy = false; private hold = false;
  private openL = -1; private solo: number | undefined; private soloOf = ''; private bellF = 1000; private bellQ = 1; private spec: HTMLCanvasElement | null = null; private specOf = new Map<string, Float32Array>();
  private open: boolean; private dirty = true; private unsaved = 0; private geo = ''; private mute = false;
  private late: Ev[] = []; private stale = false; private fullAt = 0;   // late = marks heard since the last draw (drawn alone); stale = marks on the canvas that a second pass replaced (a whole redraw, at most every REDRAW_MS)
  private flagN = 0; private said = ''; private dead = false;
  private timer = 0; private onHide = () => { this.keep(); if (this.spanT) this.keepOpen(); }; private onVis = () => { if (document.hidden) this.onHide(); };
  // ESC: the first press stops a stretch being heard again (a loop too), the next shuts the card; with neither it is not the lanes' key. Read on its KEYUP: the replay
  // bar's keydown listener (engineplay.ts, made before this one) keeps the page's keys from every later listener. An Esc that a field used (it let go of the keyboard:
  // main.ts panelWantsEsc, the bar's note box) or that shut the bar's big map is not the lanes' — nothing here stops the event for anyone else.
  private onFocusOut = (e: FocusEvent) => { const t = e.target as HTMLElement | null; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) this.escTheirs = performance.now(); };
  private onKeyDown = (e: KeyboardEvent) => { if (e.code === 'Escape') this.escTheirs = performance.now(); };   // (an Esc keydown that gets this far was typed in a field: the bar lets those through)
  private onKeyUp = this.safe((e: KeyboardEvent) => {
    if (e.code !== 'Escape' || e.metaKey || e.ctrlKey || e.altKey || performance.now() - this.escTheirs < ESC_THEIRS_MS) return;
    const a = document.activeElement; if (a && /^(INPUT|SELECT)$/.test(a.tagName)) return;
    if (this.re) this.reStop(true); else if (this.card) this.shut();
  });

  constructor(private tape: TapePlay, private audio: AudioEngine) {
   try {   // (a throw part-way leaves nothing of the lanes on the page: `undo`)
    const T = tape.tape!, tAt = this.tAt = new Float64Array(T.ticks + 1);
    { let f = 0, t = 0; for (const [n, dt] of T.dt) for (let i = 0; i < n && f < T.ticks; i++) { t += dt; tAt[++f] = t; }
      const d = T.dt[T.dt.length - 1]?.[1] ?? 1 / 60; while (f < T.ticks) { t += d; tAt[++f] = t; } }
    this.tEnd = Math.max(tAt[T.ticks], 1e-3);
    // THE HEAR-AGAIN PICTURE (replay/soundfilm.ts): a small strip of the frames drawn while the replay PLAYS, taken right after each frame's render and in its task (a WebGPU
    // canvas is only good until it is presented: the lanes' own paint runs before the render and would read black), shown over the view under the stretch being heard again
    { const view = document.getElementById('view');
      if (view instanceof HTMLCanvasElement) { const film = this.film = new SoundFilm(view), fr = this.frameWas = tape.frame; film.box = () => this.above(); this.frameOwn = Object.prototype.hasOwnProperty.call(tape, 'frame');
        tape.frame = (dt: number) => { const sought = tape.seekTo > tape.f; fr.call(tape, dt);   // (the frame a seek lands on is not taken: the next played one is)
          if (!sought && !this.dead && !this.re && tape.playing && !(tape.seekTo > tape.f)) film.capture(tAt[Math.min(tape.f, tAt.length - 1)]); }; } }
    this.label = tape.id != null ? `shelf ${tape.id}` : (tape.src.split('/').pop() ?? '').replace(/\.json(\.gz)?$/, '');
    // what this browser kept is read as what it MAY be: a value of another shape is dropped, never thrown on (an uncaught error here is the page's fatal card)
    this.store = Object.create(null) as Record<string, SoundPick>;
    const picks = read<unknown>(store('localStorage'), PICKS_LS, null);
    if (picks && typeof picks === 'object' && !Array.isArray(picks)) for (const [name, v] of Object.entries(picks)) { const p = name.length <= NAME_MAX ? pickOf(name, v) : null; if (p) this.store[name] = p; }
    this.flagN = Object.values(this.store).filter(p => p.flag).length;
    const evs = read<unknown>(store('sessionStorage'), EV_SS + this.key, null);
    if (Array.isArray(evs)) for (const e of evs.slice(0, EV_MAX)) {
      if (!Array.isArray(e)) continue; const [f, name, heard, gain, dur, mix] = e as unknown[];
      if (typeof f !== 'number' || !Number.isInteger(f) || f < 0 || f > T.ticks || typeof name !== 'string' || !name || name.length > NAME_MAX || odd(name)) continue;
      this.add(f, name, heard === 2 ? 2 : heard === 1 ? 1 : 0, num(gain, 0, 8) ?? 1, num(dur, 0, 120) ?? 0, heard === 2 ? mixOf(mix) : undefined);
    }
    this.cps = (cpsOf(read<unknown>(store('localStorage'), CP_LS, null))[this.key] ?? []).filter(f => f <= T.ticks);
    // the loop and its stretch are this visit's and THIS replay's (a seek backwards is a page load: both come back together, or neither)
    { const lk = read<unknown>(store('sessionStorage'), LOOP_SS, null), o = lk && typeof lk === 'object' && !Array.isArray(lk) ? lk as { k?: unknown; reg?: unknown } : null;
      if (o && o.k === this.key) { this.loopOn = true; const r = o.reg; if (Array.isArray(r) && r.length === 2 && Number.isInteger(r[0]) && Number.isInteger(r[1]) && r[0] >= 0 && r[0] < r[1] && r[1] <= T.ticks) this.reg = [r[0] as number, r[1] as number]; } }
    const kept = read<unknown>(store('localStorage'), OPEN_LS, null);
    this.zoomF = this.span = Math.round(num(kept && typeof kept === 'object' ? (kept as { span?: unknown }).span : undefined, SPAN_LO, SPAN_HI) ?? SPAN_DEF);
    this.open = true;   // (a page that asks for the lanes shows them: folded is for this page load only, never kept)
    this.build();
    audio.tap = this.safe((a: SoundAsk) => this.heard(a));
    // kept when the page goes (a seek backwards is a page load), when it is hidden, and on a slow timer — never per sound: the whole list is one string
    addEventListener('pagehide', this.onHide); document.addEventListener('visibilitychange', this.onVis);
    addEventListener('keyup', this.onKeyUp, true); addEventListener('keydown', this.onKeyDown, true); document.addEventListener('focusout', this.onFocusOut, true);
    this.timer = window.setInterval(this.onHide, KEEP_MS);
    const loop = () => { if (this.dead) return; try { this.paint(); } catch (e) { this.fail(e); return; } requestAnimationFrame(loop); }; requestAnimationFrame(loop);
   } catch (e) { this.dead = true; this.undo(); throw e; }
  }
  /** a handler that can not throw into the page: the lanes are an overlay, and a fault in them takes the lanes down, not the replay */
  private safe<A extends unknown[]>(f: (...a: A) => void) { return (...a: A) => { if (this.dead) return; try { f(...a); } catch (e) { this.fail(e); } }; }
  private fail(e: unknown) {
    if (this.dead) return; this.dead = true;
    console.error('sound lanes stopped:', e);
    if (this.re) { this.re = null; try { this.audio.hush(30, true); } catch { /* the mixer is what failed */ } }
    this.undo();
  }
  /** everything the lanes put on the page, taken off again (a fault while they ran, or a throw while they were being made): the replay's own frame, the mixer's tap
   *  and trims, the timers and listeners, the style, the dock, the card, the tag on the view, the body's class and the root's height */
  private undo() {
    const steps: (() => void)[] = [   // (each by itself: whatever threw must not keep the rest on the page)
      () => { if (this.frameWas) { if (this.frameOwn) this.tape.frame = this.frameWas; else delete (this.tape as { frame?: unknown }).frame; this.frameWas = null; } },
      () => { this.audio.tap = null; }, () => { this.audio.trims.clear(); }, () => { this.film?.dispose(); this.film = null; },
      () => { clearInterval(this.timer); clearTimeout(this.spanT); clearTimeout(this.dueT); },
      () => { removeEventListener('pagehide', this.onHide); document.removeEventListener('visibilitychange', this.onVis); },
      () => { removeEventListener('keyup', this.onKeyUp, true); removeEventListener('keydown', this.onKeyDown, true); document.removeEventListener('focusout', this.onFocusOut, true); },
      () => { this.root.remove(); this.card?.remove(); this.card = null; this.noTag?.remove(); this.noTag = null; this.filmTag?.remove(); this.filmTag = null; this.styleEl?.remove(); this.styleEl = null; },
      () => { document.body.classList.remove('sndl', 'sndfilm-on'); document.documentElement.style.removeProperty('--sndl-h'); },
    ];
    for (const step of steps) try { step(); } catch { /* the next one all the same */ }
  }
  private get key() { return this.tape.id != null ? `shelf:${this.tape.id}` : this.tape.src; }

  // ---- what the tape asked for ----
  private add(f: number, name: string, heard: 0 | 1 | 2, gain: number, dur: number, mix?: SoundMix) {
    let n = this.idx.get(name);
    if (n === undefined) { n = this.names.length; this.names.push(name); this.idx.set(name, n); this.count.push(0); this.durOf.push(0); this.lit.push(-1); this.litOn.push(false); this.geo = ''; }
    if (dur > 0) this.durOf[n] = dur;
    let at = this.byStep.get(f); if (!at) this.byStep.set(f, at = []);
    const e: Ev = { f, n, heard, gain, dur, mix }; at.push(e); this.count[n]++; if (!this.dirty) this.late.push(e);
    return n;
  }
  private heard(a: SoundAsk) {
    if (this.mute) return;
    const f = Math.min(this.tape.f, this.tAt.length - 1);
    if (!this.fresh.has(f)) {                     // this step again (a reload walked back over it): what was heard then is kept where this pass is deaf (a seek runs with the mixer off)
      this.fresh.add(f); const was = this.byStep.get(f);
      if (was) { for (const e of was) this.count[e.n]--; this.byStep.set(f, []); (this.byStep.get(f) as Ev[] & { was?: Ev[] }).was = was; if (was.length) this.stale = true; }
    }
    const at = this.byStep.get(f) as (Ev[] & { was?: Ev[] }) | undefined, old = at?.was?.[at.length];
    const same = old && this.names[old.n] === a.name && a.heard === 0 ? old : null;
    const n = this.add(f, a.name, same ? old!.heard : a.heard, a.gain, a.dur || same?.dur || 0, a.mix ?? same?.mix);
    if (a.heard === 2) this.lit[n] = Math.max(this.lit[n], this.tAt[f] + Math.max(0.15, a.dur));
    this.unsaved++;
  }
  private keep() {
    if (!this.unsaved || this.dead) return; this.unsaved = 0;
    const out: unknown[][] = [];
    for (const at of this.byStep.values()) for (const e of at) { const row: unknown[] = [e.f, this.names[e.n], e.heard, +e.gain.toFixed(2), +e.dur.toFixed(3)]; if (e.mix) row.push(mixRow(e.mix)); out.push(row); }
    const s = store('sessionStorage');
    if (!write(s, EV_SS + this.key, out)) write(s, EV_SS + this.key, out.map(r => r.slice(0, 5)));   // (a store too full for the mixes keeps the marks alone)
  }

  // ---- takes and trims (the mixer's, on this page) ----
  /** the take the game plays as shipped */
  private gameTake(name: string) {
    if (SFX_TABLE.redone) return 'after';
    if (SFX_TABLE.was) return this.audio.backend?.sfxContext && !this.bufOf(name, 'before') ? 'after' : 'before';   // (the old table whole: a sound that was never redone has no 'before', the game plays the one there is)
    return (WAS_IN_GAME as readonly string[]).includes(name) ? 'before' : 'after';
  }
  private bufOf(name: string, take: string): SfxBuffer | null {
    const ctx = this.audio.backend?.sfxContext; if (!ctx || odd(name)) return null;
    const id = `${name}@${take}`, had = this.bufs.get(id); if (had !== undefined) return had;
    let buf: SfxBuffer | null = null;
    if (take === 'before') buf = (wasOnly(ctx, [name as SfxNameWas]) as Record<string, SfxBuffer | undefined>)[name] ?? null;
    else if (take === 'after') buf = (this.redone ??= buildSfx(ctx))[name as SfxName] ?? null;
    else { const k = /^new ([1-9])$/.exec(take); buf = k ? altTake(ctx, name, +k[1] - 1) : null; }
    this.bufs.set(id, buf); return buf;
  }
  /** the takes this page can PLAY of a sound: none with no mixer (a muted page), none for a name the tables do not hold */
  private takes(name: string): string[] {
    if (name === 'smokeHiss' || !this.audio.backend?.sfxContext) return [];       // the can's hiss is a loop the mixer builds itself: no takes, no trims
    let out = this.takeList.get(name); if (out) return out;
    out = ['before', 'after'].filter(t => this.bufOf(name, t));
    if (out.length) for (let i = 0; i < altTakes(name); i++) if (!altPicked(name, i)) out.push(`new ${i + 1}`);   // (a take he picked is the game's own now: 'after')
    this.takeList.set(name, out); return out;
  }
  private apply(name: string) {
    let p: SoundPick | undefined = this.store[name]; const trim: SoundTrim = {}, ctx = this.audio.backend?.sfxContext;
    const ts = p && ctx && (p.take || p.tune) ? this.takes(name) : null, noTune = !!ts && !!p!.tune && !ts.includes(p!.tune.base);
    const noTake = !!ts && !!p!.take && (p!.take === 'tuned' ? !p!.tune || noTune : p!.take === this.gameTake(name) || !ts.includes(p!.take));
    if (p && (noTake || noTune)) {                     // a kept take this page does not have, or that is the game's own now (a tune: one whose base take is not here): not a pick any more (and not in 'copy picks')
      p = { ...p }; if (noTake) delete p.take; if (noTune) delete p.tune;
      if (!SFX_TABLE.was && !SFX_TABLE.redone) {       // (a page on another table — ?oldsounds, ?newsounds — has another 'game's own': the kept pick does nothing here and STAYS kept for the shipped game)
        if (Object.keys(p).length) this.store[name] = p; else { delete this.store[name]; p = undefined; }
        write(store('localStorage'), PICKS_LS, this.store); this.dirty = true; this.geo = '';
      }
    }
    // the tuned take: his tune's base take made under it — or, a layer heard alone on the card, the take that is up made with only that layer
    const solo = this.soloOf === name ? this.solo : undefined;
    const tune: SoundTune | null = p?.take === 'tuned' && p.tune ? p.tune : solo !== undefined ? { base: p?.take ?? this.gameTake(name) } : null;
    if (tune && ctx) {
      const key = JSON.stringify([tune, solo ?? null]);
      if (this.tunedKey.get(name) !== key) {
        if (this.lazy && this.tunedKey.has(name)) { this.due.add(name); clearTimeout(this.dueT); this.dueT = window.setTimeout(this.safe(() => this.flush()), TUNE_MS); }   // (a dial on the move: the take as it was until it rests)
        else {
          this.due.delete(name); const buf = renderTune(ctx, name, tune, b => this.bufOf(name, b), solo);
          if (buf && this.audio.loadTake(name, 'tuned', buf)) { this.tunedKey.set(name, key); this.tunedBuf.set(name, buf); } else { this.tunedKey.delete(name); this.tunedBuf.delete(name); }
        }
      }
      if (this.tunedKey.has(name)) trim.take = `${name}@tuned`;
    } else if (p?.take && p.take !== 'tuned' && p.take !== this.gameTake(name)) {
      const id = `${name}@${p.take}`;
      if (!this.loaded.has(id)) { const buf = this.bufOf(name, p.take); if (buf && this.audio.loadTake(name, p.take, buf)) this.loaded.add(id); }
      if (this.loaded.has(id)) trim.take = id;
    }
    if (p?.rate && p.rate !== 1) trim.rate = p.rate;
    if (p?.gain !== undefined && p.gain !== 1) trim.gain = p.gain;
    if (p?.tone && p.tone < TONE_HI) trim.tone = p.tone;
    if (Object.keys(trim).length) this.audio.trims.set(name, trim); else this.audio.trims.delete(name);
  }
  /** make the tuned takes a moving dial still owes, now (before anything is played) */
  flush() {
    clearTimeout(this.dueT); if (!this.due.size) return;
    const names = [...this.due], lazy = this.lazy; this.due.clear(); this.lazy = false;
    try { for (const n of names) this.apply(n); } finally { this.lazy = lazy; }
    if (names.includes(this.cardOf)) this.drawSpec();
  }
  private changed(p: SoundPick) { return !!(p.take || (p.rate && p.rate !== 1) || (p.gain !== undefined && p.gain !== 1) || (p.tone && p.tone < TONE_HI)); }
  /** change one sound's pick (the card's controls and the page check both come through here) */
  pick(name: string, patch: SoundPick) {
    const p = { ...(this.store[name] ?? {}), ...patch };
    if (p.tune && tuneEmpty(p.tune)) { if (p.take === 'tuned') p.take = p.tune.base; delete p.tune; }
    if (!p.tune) { delete p.tune; if (p.take === 'tuned') delete p.take; }
    if (!p.mine?.length) delete p.mine;
    if (p.take === this.gameTake(name)) delete p.take;
    if (p.rate === 1) delete p.rate; if (p.gain === 1) delete p.gain; if (p.tone !== undefined && p.tone >= TONE_HI) delete p.tone;
    if (!p.flag) { delete p.flag; delete p.at; } if (!p.note) delete p.note;
    if (Object.keys(p).length) this.store[name] = p; else delete this.store[name];
    write(store('localStorage'), PICKS_LS, this.store);
    this.apply(name); this.dirty = true; this.geo = ''; this.flagN = Object.values(this.store).filter(q => q.flag).length;
    if (this.cardOf === name && !this.hold) this.fill();
  }
  /** change the tune of the take that is up (a first change starts one off that take); a tune with nothing left in it is the take again */
  tune(name: string, mut: (t: SoundTune) => void) {
    const p = this.store[name] ?? {}, cur = p.take ?? this.gameTake(name);
    const t: SoundTune = cur === 'tuned' && p.tune ? JSON.parse(JSON.stringify(p.tune)) as SoundTune : { base: cur };
    mut(t);
    if (t.over) { for (const k of Object.keys(t.over)) if (!Object.keys(t.over[k]).length) delete t.over[k]; if (!Object.keys(t.over).length) delete t.over; }
    if (!t.mute?.length) delete t.mute; if (!t.hp || t.hp <= HP_LO) delete t.hp; if (!t.bell || !t.bell[1]) delete t.bell;
    this.pick(name, tuneEmpty(t) ? { take: t.base, tune: cur === 'tuned' ? undefined : p.tune } : { take: 'tuned', tune: t });
  }
  private unsolo() { if (this.solo === undefined) return; const n = this.soloOf; this.solo = undefined; this.soloOf = ''; if (n) this.apply(n); }
  /** play it once as the page now has it, straight to the ears */
  audition(name: string) {
    this.audio.start(); this.sync(); this.flush();
    const was = this.audio.enabled; this.audio.enabled = true; this.mute = true;
    try { this.audio.play(name as SfxName, null, 1, { rate: 1 }); } finally { this.mute = false; this.audio.enabled = was; }
  }
  // ---- checkpoints, and a stretch heard again ----
  private stepAt(t: number) { let lo = 0, hi = this.tAt.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (this.tAt[m] < t) lo = m + 1; else hi = m; } return lo; }
  /** a checkpoint at step `f` (where the tape stands): the place "again" goes back to */
  checkpoint(f = this.tape.f) {
    f = Math.max(0, Math.min(this.tAt.length - 1, Math.floor(f))); this.lastFrom = f; if (this.cps.includes(f)) return;
    this.cps.push(f); while (this.cps.length > CP_MAX) this.cps.shift(); this.keepCps();
  }
  private uncheck(f: number) { this.cps = this.cps.filter(x => x !== f); if (this.lastFrom === f) this.lastFrom = -1; this.keepCps(); }
  private keepCps() {
    this.cpN++; const s = store('localStorage'), all = cpsOf(read<unknown>(s, CP_LS, null)), ks = Object.keys(all).filter(k => k !== this.key);
    delete all[this.key]; while (ks.length >= CP_TAPES) delete all[ks.shift()!]; if (this.cps.length) all[this.key] = this.cps; write(s, CP_LS, all);
  }
  /** hear the sounds from step `from` up to where the tape stands once more, mixed as they were and under the takes and dials AS THEY ARE NOW. Sound only: the tape is
   *  paused for it (and plays on after, if it was playing), no step is run and nothing is filed. No `from` = the place last marked or listened from, else the nearest
   *  checkpoint behind the tape, else the last BACK_S seconds. False = nothing to hear (a muted page, a place not behind the tape). */
  relisten(from?: number): boolean {
    const A = this.audio, fNow = Math.min(this.tape.f, this.tAt.length - 1), reg = from === undefined && this.reg && this.reg[1] <= fNow ? this.reg : null; let f0 = from ?? this.againFrom();
    if (from === undefined && f0 < 0) f0 = this.stepAt(Math.max(0, this.tAt[fNow] - BACK_S));
    f0 = Math.max(0, Math.floor(f0)); if (!(f0 < fNow) || this.tape.seekTo > this.tape.f) return false;   // (a seek under way runs unheard, the mixer off: nothing to hear until it lands)
    A.start(); this.sync(); this.flush(); if (!A.started) return false;
    const resume = this.re ? this.re.resume : this.tape.playing; this.re = null;
    if (this.tape.playing) this.tape.pause(); A.hush();
    // it ends at the dragged stretch's end, else at the next checkpoint between its start and the tape, else where the tape stands
    let f1 = fNow; if (reg) f1 = reg[1]; else for (const c of this.cps) if (c > f0 && c < f1) f1 = c;
    const list: Ev[] = []; for (const [f, at] of this.byStep) if (f >= f0 && f < f1) for (const e of at) if (e.heard === 2 && e.mix) list.push(e);
    list.sort((a, b) => a.f - b.f);
    this.re = { f0, f1, t: this.tAt[f0], end: this.tAt[f1], list, i: 0, last: performance.now(), resume, at: this.tape.f, wait: -1 }; this.reLit = []; this.lastFrom = f0; this.reAll = list.length; this.rePass = 1;
    this.reShown = true; this.win = this.fit(this.tAt[f0], this.tAt[f1]);
    return true;
  }
  /** the window a stretch [a, b] seconds is heard in: the one that is held if the stretch is in it, else the tape's own — widened about the tape's step while that
   *  stays within SPAN_HI, else laid round the stretch alone. Set ONCE as the stretch starts; every pass of a loop is then drawn in the same place. */
  private fit(a: number, b: number): { t0: number; span: number } {
    const w = this.win; if (w && a >= w.t0 && b <= w.t0 + w.span) return w;
    const now = this.tAt[Math.min(this.tape.f, this.tAt.length - 1)]; let span = this.span, t0 = Math.max(0, now - HEAD_AT * span);
    if (a < t0 || b > t0 + span) {
      const need = (now - a) / HEAD_AT * 1.05;
      if (need <= SPAN_HI) { span = Math.ceil(need); t0 = Math.max(0, now - HEAD_AT * span); } else { span = Math.ceil(Math.max(span, (b - a) * 1.1)); t0 = Math.max(0, a - (span - (b - a)) / 2); }
    }
    return { t0, span };
  }
  /** the window as it stands, held (a drag began) */
  private holdWin() { const v = this.view(); this.win = { t0: v.t0, span: v.span }; }
  /** the seconds the lanes show, times `k` (the wheel, the − and + beside the ruler): kept a moment after the last change; a held window is laid again under it */
  private zoom(k: number) {
    if (Math.round(this.zoomF) !== this.span) this.zoomF = this.span;
    this.zoomF = Math.min(SPAN_HI, Math.max(SPAN_LO, this.zoomF * k)); const to = Math.round(this.zoomF); if (to === this.span) return;
    this.span = to; clearTimeout(this.spanT); this.spanT = window.setTimeout(() => this.keepOpen(), KEEP_SPAN_MS);
    if (this.win) { this.win = null; if (this.re) this.win = this.fit(this.tAt[this.re.f0], this.re.end); else this.holdWin(); }
  }
  /** the step "again" would start from with nothing said: the dragged stretch's start, else the place last marked or heard from, else the nearest checkpoint behind the
   *  tape; -1 = none of those (the head's button is then off) */
  private againFrom(): number {
    const fNow = Math.min(this.tape.f, this.tAt.length - 1); if (this.reg && this.reg[1] <= fNow) return this.reg[0]; if (this.lastFrom >= 0 && this.lastFrom < fNow) return this.lastFrom;
    let f0 = -1; for (const c of this.cps) if (c < fNow && c > f0) f0 = c; return f0;
  }
  private reTick(dt: number) {
    const re = this.re; if (!re) return;
    if (this.tape.playing || this.tape.f !== re.at) { this.re = null; this.audio.hush(30, true); return; }   // (the replay itself went on, or was sent somewhere: its own sound again)
    re.last = performance.now();
    if (re.wait >= 0) {   // (between two passes of a loop: nothing asked of the mixer; the next pass starts whole on a tick of its own)
      if (!this.loopOn) { this.reStop(false); return; }
      re.wait -= dt; if (re.wait > 0) return;
      this.flush(); this.audio.hush(30, true); re.wait = -1; re.i = 0; re.t = this.tAt[re.f0]; this.reLit = []; this.rePass++; return;
    }
    re.t += dt;
    for (; re.i < re.list.length && this.tAt[re.list[re.i].f] <= re.t; re.i++) { const e = re.list[re.i];
      if (this.audio.again(this.names[e.n], e.mix!)) { this.reN++; this.reLit[e.n] = Math.max(this.reLit[e.n] ?? -1, this.tAt[e.f] + Math.max(0.15, e.dur)); } }
    if (re.t >= re.end) { if (this.loopOn) re.wait = LOOP_GAP; else this.reStop(false); }
    if (this.re && this.film) this.reShown = this.film.show(Math.min(re.t, re.end));   // (the picture recorded at the head's time; false = none was drawn there)
  }
  /** `cut`: stopped by hand (silence, the tape left paused); else the stretch ran out, and a tape that was playing plays on */
  private reStop(cut: boolean) {
    const re = this.re; if (!re) return; this.re = null; this.film?.hide(); this.noPicture(false); this.pictured(false); if (cut) this.audio.hush();
    if ((!cut || this.loopOn) && re.resume && !this.tape.playing && this.tape.f === re.at) this.tape.play();   // (a loop has no end of its own: stopping it is its end)
  }
  /** the loop switch (no argument = as it stands) */
  loop(on?: boolean) { if (on !== undefined && on !== this.loopOn) { this.loopOn = on; this.loopBtn.classList.toggle('is', on); this.keepLoop(); } return this.loopOn; }
  private keepLoop() { const s = store('sessionStorage'); if (this.loopOn) write(s, LOOP_SS, { k: this.key, reg: this.reg }); else try { s?.removeItem(LOOP_SS); } catch { /* no store */ } }
  private keepOpen() { clearTimeout(this.spanT); this.spanT = 0; write(store('localStorage'), OPEN_LS, { span: this.span }); }
  /** the tag ON the game's view while a stretch is heard again where no picture was recorded (before the film's first frame after a page load, or a stretch a seek
   *  ran over unseen): where the picture would be, in the middle of what the dock leaves of the view */
  private noPicture(on: boolean) {
    let t = this.noTag; if (!on) { if (t && !t.hidden) t.hidden = true; return; }
    const view = document.getElementById('view'); if (!view) return;
    if (!t) { t = this.noTag = el('div', '', NO_PICTURE); t.id = 'sndnopic'; (document.getElementById('sndfilm') ?? view).after(t); }
    const r = this.above(), L = `${Math.round(r.left + r.width / 2)}px`, T = `${Math.round(r.top + r.height / 2)}px`;
    if (t.style.left !== L) t.style.left = L; if (t.style.top !== T) t.style.top = T; if (t.hidden) t.hidden = false;
  }
  /** what the dock leaves of the game's view: from the view's top down to the dock's (the recorded picture is laid in it, whole) */
  private above() {
    const r = (document.getElementById('view') ?? document.body).getBoundingClientRect(), low = this.root.isConnected && !this.root.hidden ? Math.min(r.bottom, this.root.getBoundingClientRect().top) : r.bottom;
    return { left: r.left, top: r.top, width: r.width, height: Math.max(40, low - r.top) };
  }
  /** THE RECORDED PICTURE IS UP (or not): a worded tag in its corner — "↺ recorded m:ss", the stretch's head — and the game's live HUD out of the way (`body.sndfilm-on`:
   *  it would lay NOW's light, kit and log over THEN's picture); both gone the moment the picture is */
  private pictured(on: boolean) {
    let t = this.filmTag;
    if (!on || !this.re) { if (this.filmOn) { this.filmOn = false; document.body.classList.remove('sndfilm-on'); if (t) t.hidden = true; } return; }
    if (!this.filmOn) { this.filmOn = true; document.body.classList.add('sndfilm-on'); }
    if (!t) { t = this.filmTag = el('div'); t.id = 'sndfilmtag'; (document.getElementById('sndfilm') ?? document.getElementById('view') ?? document.body).after(t); this.filmSaid = ''; }
    const r = this.above(), L = `${Math.round(r.left + 8)}px`, T = `${Math.round(r.top + 8)}px`, say = `↺ recorded ${clock(Math.min(this.re.t, this.re.end))}`;
    if (say !== this.filmSaid) t.textContent = this.filmSaid = say;
    if (t.style.left !== L) t.style.left = L; if (t.style.top !== T) t.style.top = T; if (t.hidden) t.hidden = false;
  }
  /** a stretch of the tape behind where it stands, steps [f0, f1): what "again" hears (and loops) until it is cleared (`f1` null). False = no such stretch. */
  region(f0: number, f1: number | null): boolean {
    const was = this.reg;
    if (f1 === null) this.reg = null;
    else { const fNow = Math.min(this.tape.f, this.tAt.length - 1), a = Math.max(0, Math.floor(Math.min(f0, f1))), b = Math.min(fNow, Math.floor(Math.max(f0, f1))); this.reg = a < b ? [a, b] : null; }
    if (this.loopOn && (was?.[0] !== this.reg?.[0] || was?.[1] !== this.reg?.[1])) this.keepLoop();
    return f1 === null || !!this.reg;
  }

  private sync() { if (this.applied || !this.audio.started) return; this.applied = true; for (const n of Object.keys(this.store)) this.apply(n); }

  /** how one sound plays, in units: the take (a tuned one: only what differs from its base take as written), then the mixer's pitch, low-pass and level */
  private says(name: string, p: Kept): string[] {
    const b: string[] = [];
    if (p.take === 'tuned' && p.tune) {
      let layers: ReturnType<typeof madeOf> = null;   // (the base take's layers as written: their kinds, and what a kept number is held against. A page with no mixer makes them on a stand-in context.)
      try { layers = madeOf(this.audio.backend?.sfxContext ?? sfxContext(), name, { base: p.tune.base, seed: p.tune.seed }, base => this.bufOf(name, base)); } catch { /* said without the kinds */ }
      b.push(tuneText(p.tune, layers?.layers.length ? layers.layers : undefined));
    } else if (p.take) b.push(p.take);
    if (p.rate) b.push(`pitch ${said('¢', p.rate)}`); if (p.tone) b.push(`lp ${said('Hz', p.tone)}`);
    if (p.gain !== undefined) b.push(p.gain > 0 ? `level ${said('dB', dBOf(p.gain))}` : 'level off');
    return b;
  }
  /** the picks as one line to paste into the chat */
  copyText() {
    const parts: string[] = [];
    for (const [name, p] of Object.entries(this.store)) {
      const b = this.says(name, p);
      if (p.flag) b.push(`FLAG${p.at ? ` at ${p.at}` : ''}`); if (p.note) b.push(`"${p.note}"`);
      if (b.length) parts.push(`${name}: ${b.join(p.take === 'tuned' ? ' · ' : ', ')}`);
    }
    return `sound picks · ${parts.join(' · ') || 'none'}`;
  }

  // ---- the panel ----
  private build() {
    (this.styleEl = document.head.appendChild(el('style'))).textContent = CSS;
    const r = this.root; r.id = 'sndl';
    const copy = this.copy;
    copy.onclick = e => { e.stopPropagation(); copy.blur(); if (this.copyN <= 0) return; const text = this.copyText(), done = () => { copy.textContent = 'copied'; setTimeout(() => copy.textContent = `copy picks (${this.copyN})`, 1200); };
      const byHand = () => { const ta = document.body.appendChild(el('textarea')); ta.value = text; ta.select(); try { document.execCommand('copy'); } catch { /* shown selected instead */ } ta.remove(); done(); };
      try { navigator.clipboard.writeText(text).then(done, byHand); } catch { byHand(); } };
    // the head, left to right: the caret (the ONLY thing that folds the dock) · the tally · ＋ checkpoint · the checkpoints, numbered · ↺ again from m:ss (■ stop while hearing again; off with nowhere to go back to) · ⟳ loop · copy picks (N)
    const cp = el('button', 'add', '＋ checkpoint'), back = this.back, car = this.caret;
    car.onclick = this.safe(() => { car.blur(); this.open = !this.open; this.geo = ''; if (!this.open) this.shut(); });
    car.title = 'fold'; cp.title = 'mark this moment'; back.title = 'hear it again'; this.loopBtn.title = 'repeat the stretch'; copy.title = 'copy as text';
    cp.onclick = this.safe(() => { cp.blur(); this.checkpoint(); });
    back.onclick = this.safe(() => { back.blur(); if (this.re) this.reStop(true); else if (this.againFrom() >= 0) this.relisten(); });
    const lp = this.loopBtn;
    lp.classList.toggle('is', this.loopOn); // ⟳ loop LOOPS, at once, and SHOWS what it repeats: put on with no stretch set (or one the tape has not reached), it sets one — from where "again" would
    // start (else the last LOOP_BACK s) to the tape's step — drawn on the ruler with a handle at each end, and starts hearing it; put off, the sound stops and the stretch goes with it
    lp.onclick = this.safe(() => { lp.blur();
      if (this.loopOn) { this.reStop(true); this.loop(false); this.region(0, null); return; }
      this.loop(true); const fNow = Math.min(this.tape.f, this.tAt.length - 1);
      if (!this.reg || this.reg[1] > fNow) { const a = this.againFrom(); this.region(a >= 0 ? a : this.stepAt(Math.max(0, this.tAt[fNow] - LOOP_BACK)), fNow); }
      this.relisten(); });
    this.head.append(car, this.tally, cp, this.cpBox, back, lp, copy);
    // the seconds the lanes show, beside the ruler, with a − and a + (the wheel over the lanes does the same)
    { const less = el('button', '', '−'), more = el('button', '', '+'); less.title = 'fewer seconds'; more.title = 'more seconds';
      less.onclick = this.safe(() => { less.blur(); this.zoom(1 / ZOOM_STEP); }); more.onclick = this.safe(() => { more.blur(); this.zoom(ZOOM_STEP); }); this.gut.append(less, this.gutSay, more); }
    this.band.hidden = true; this.regBand.hidden = true; this.reh.hidden = true; this.ov.append(this.band, this.regBand, this.reh, this.hl, this.hr, this.now);
    this.rule.append(this.rc, this.gut); this.hl.hidden = this.hr.hidden = true;
    /** the step under a point of the ruler or the lanes, in the window's own time (null: over the gutter of names) */
    const stepOf = (clientX: number, edge = false): number | null => { const v = this.view(), x = clientX - this.rule.getBoundingClientRect().left - GUT; if (x < 0 && !edge) return null;
      return this.stepAt(Math.min(this.tEnd, Math.max(0, v.t0 + Math.min(v.width, Math.max(0, x)) / v.width * v.span))); };
    this.rule.onclick = this.safe((e: MouseEvent) => {
      if (this.dragged) { this.dragged = false; return; }   // (the click that ends a drag: the drag has been heard already)
      if (e.target !== this.rule) return; const f = stepOf(e.clientX); if (f !== null && this.relisten(f)) this.region(0, null);   // (a place the tape has not reached: nothing to hear, and the stretch that is set stays)
    });
    // a drag along the ruler = that stretch alone (heard at once; with ⟳ on, round and round); shorter than DRAG_PX it is the click above
    this.rule.onpointerdown = this.safe((e: PointerEvent) => { this.dragged = false; if (e.button !== 0 || e.target !== this.rule) return; const f = stepOf(e.clientX); if (f !== null) { this.drag = { x: e.clientX, f, id: e.pointerId, moved: false }; if (!this.win) this.holdWin(); } });
    this.rule.onpointermove = this.safe((e: PointerEvent) => {
      const d = this.drag; if (!d || e.pointerId !== d.id) return;
      if (!d.moved) { if (Math.abs(e.clientX - d.x) < DRAG_PX) return; d.moved = true; try { this.rule.setPointerCapture(d.id); } catch { /* a pointer that is gone */ } }
      this.region(d.f, stepOf(e.clientX, true)!);
    });
    const dragEnd = this.safe((e: PointerEvent) => {
      const d = this.drag; if (!d || e.pointerId !== d.id) return; this.drag = null; if (!d.moved) return;
      try { this.rule.releasePointerCapture(d.id); } catch { /* let go already */ }
      this.dragged = true;
      if (e.type === 'pointerup' && this.region(d.f, stepOf(e.clientX, true)!)) this.relisten(); else this.region(0, null);
    });
    this.rule.onpointerup = dragEnd; this.rule.onpointercancel = dragEnd;
    // a handle at each end of the stretch: dragged, that end moves (the stretch being heard starts over under it when the handle is let go)
    [this.hl, this.hr].forEach((h, edge) => {
      h.onpointerdown = this.safe((e: PointerEvent) => { e.stopPropagation(); if (e.button !== 0 || !this.reg) return; e.preventDefault(); this.hdrag = { keep: this.reg[1 - edge], id: e.pointerId }; if (!this.win) this.holdWin(); try { h.setPointerCapture(e.pointerId); } catch { /* a pointer that is gone */ } });
      h.onpointermove = this.safe((e: PointerEvent) => { const d = this.hdrag; if (!d || e.pointerId !== d.id) return; const was = this.reg; if (!this.region(d.keep, stepOf(e.clientX, true)!)) { this.reg = was; if (this.loopOn) this.keepLoop(); } });
      const end = this.safe((e: PointerEvent) => { const d = this.hdrag; if (!d || e.pointerId !== d.id) return; this.hdrag = null; try { h.releasePointerCapture(d.id); } catch { /* let go already */ } if (this.re) this.relisten(); });
      h.onpointerup = end; h.onpointercancel = end;
    });
    this.rule.oncontextmenu = this.safe((e: MouseEvent) => { if (e.target !== this.rule || !this.reg) return; e.preventDefault(); this.region(0, null); });
    // the wheel over the ruler or the lanes = how many seconds they show (over the names, a list too long for the panel scrolls)
    this.body.addEventListener('wheel', this.safe((e: WheelEvent) => {
      if ((e.target as HTMLElement | null)?.classList.contains('lb') && this.rows.scrollHeight > this.rows.clientHeight) return;
      // (the foot of the names, where "▾ 4" stands: the wheel there scrolls the list as it does over a name)
      if (!this.foot.hidden) { const f = this.foot.getBoundingClientRect(); if (e.clientY >= f.top && e.clientX < f.right) { e.preventDefault(); e.stopPropagation(); this.rows.scrollTop += e.deltaMode ? e.deltaY * 40 : e.deltaY; return; } }
      e.preventDefault(); e.stopPropagation(); if (!e.deltaY) return;
      this.zoom(Math.pow(ZOOM_STEP, Math.max(-1, Math.min(1, (e.deltaMode ? e.deltaY * 40 : e.deltaY) / 100))));   // (a notch of a wheel = one step; a trackpad's small deltas, small steps)
    }), { passive: false });
    this.rows.append(this.cv); this.rows.addEventListener('scroll', () => this.moreRows(), { passive: true });
    this.cv.onclick = this.safe((e: MouseEvent) => {
      const b = this.cv.getBoundingClientRect(), n = Math.floor((e.clientY - b.top) / ROW), x = e.clientX - b.left, v = this.view(); if (n < 0 || n >= this.names.length) return;
      let best: Ev | null = null, bd = 6;
      this.inView(v, ev => { if (ev.n === n) { const x0 = (this.tAt[ev.f] - v.t0) / v.span * v.width, d = x < x0 ? x0 - x : Math.max(0, x - x0 - Math.max(2, (ev.dur || 0.2) / v.span * v.width)); if (d < bd) { bd = d; best = ev; } } });
      this.show(this.names[n], best ? `${this.label} ${clock(this.tAt[(best as Ev).f])}` : '');
    });
    this.fade.hidden = this.foot.hidden = true; this.body.append(this.rule, this.rows, this.foot, this.ov, this.fade); this.main.append(this.body);
    r.append(this.head, this.main); document.body.appendChild(r); document.body.classList.add('sndl');
  }
  /** the lanes' window: `span` seconds from `t0`, the TAPE'S step HEAD_AT of the way across — never before the replay's start, where the head moves in from the left
   *  instead. While a stretch is heard again, or a drag is held, the window stands where it stood when that began (`win`): the hear-again head moves ACROSS it, pass
   *  after pass. `head` = the stretch's head, else the tape's; `width` = the lanes' px right of the names, `headX` the head's place in them */
  view() {
    if (this.win && !this.re && !this.drag && !this.hdrag) this.win = null;
    const re = this.re, w = this.win, now = this.tAt[Math.min(this.tape.f, this.tAt.length - 1)], head = re ? Math.min(re.t, re.end) : now, span = w ? w.span : this.span, t0 = w ? w.t0 : Math.max(0, now - HEAD_AT * span);
    const width = Math.max(1, (this.body.clientWidth || innerWidth) - GUT);
    return { t0, span, head, now, width, gutter: GUT, headX: (head - t0) / span * width };
  }
  /** every mark that can show in a window (a sound that began up to its length before the window is still sounding in it) */
  private inView(v: { t0: number; span: number }, each: (e: Ev) => void) {
    let back = 0.2; for (const d of this.durOf) if (d > back) back = d;
    const a = this.stepAt(Math.max(0, v.t0 - Math.min(30, back))), b = Math.min(this.tAt.length - 1, this.stepAt(v.t0 + v.span));
    if (b - a > this.byStep.size) { for (const [f, at] of this.byStep) if (f >= a && f <= b) for (const e of at) each(e); }
    else for (let f = a; f <= b; f++) { const at = this.byStep.get(f); if (at) for (const e of at) each(e); }
  }
  /** open one sound's card (`at` = the moment clicked, kept with a flag) */
  show(name: string, at = '') {
    if (this.cardOf === name && this.card && !at) { this.shut(); return; }
    this.audio.start(); this.sync();
    if (!this.card) {
      const c = this.card = this.main.appendChild(el('div')); c.id = 'sndcard';   // (the inspector: a column INSIDE the dock, right of the lanes — nothing of the lanes floats over the picture)
      // THE KEYS STAY THE REPLAY'S: a control of the card never keeps the keyboard (a focused slider or button would eat Space, the fly keys, and hand Esc to the game).
      // A pressed button and a let-go slider give the focus back; the note field keeps it while he types — Enter there is done, Esc lets go (main.ts panelWantsEsc).
      c.addEventListener('click', e => { const t = e.target as HTMLElement | null; if (t?.tagName === 'BUTTON') t.blur(); });
      c.addEventListener('scroll', () => this.more(), { passive: true });
      c.addEventListener('keydown', e => { const t = e.target as HTMLElement | null; if (t?.tagName !== 'INPUT') return; e.stopPropagation(); if (e.code === 'Enter' || e.code === 'NumpadEnter') t.blur(); });
    }
    if (this.cardOf !== name) { this.unsolo(); this.openL = -1; }
    this.cardOf = name; this.cardAt = at; this.fill(); this.geo = '';
  }
  private shut() { this.unsolo(); this.openL = -1; this.card?.remove(); this.card = null; this.spec = null; this.cardOf = ''; this.geo = ''; }
  private fill() {
    const c = this.card, name = this.cardOf; if (!c) return;
    const p = this.store[name] ?? {}, takes = this.takes(name), game = this.gameTake(name), cur = p.take ?? game;
    const top = c.scrollTop;   // (the card is ONE scroller, as tall as the dock's body)
    c.textContent = ''; this.spec = null;
    const t = el('div', 't'), play = el('button', '', '▶'), again = el('button', 're', '↺ again'), x = el('button', '', '✕');
    again.onclick = this.safe(() => { this.relisten(); });
    play.onclick = this.safe(() => this.audition(name)); x.onclick = this.safe(() => this.shut());
    t.append(el('b', '', name), el('i', '', this.cardAt.replace(this.label + ' ', '')), play, again, x); c.append(t);
    const take = (id: string) => this.safe(() => { this.unsolo(); this.openL = -1; this.pick(name, { take: id }); this.audition(name); });
    if (takes.length > 1) {
      const tk = el('div', 'tk');
      for (const id of takes) { const b = el('button', (id === cur ? 'is ' : '') + (id === game ? 'game' : ''), id); b.onclick = take(id); tk.append(b); }
      if (p.tune) { const b = el('button', cur === 'tuned' ? 'is' : '', 'tuned'); b.onclick = take('tuned'); tk.append(b); }
      c.append(tk);
    }
    // THE ORDER IS BY USE: the takes and ▶ / again, the flag and the note, the mixer's three dials (pitch · level · tone) in ONE row — all of it in sight with the
    // card unscrolled — then the picture, the take's own filters and its layers, which may need the card scrolled
    const fl = el('div', 'fl'), flag = el('button', 'flag' + (p.flag ? ' is' : ''), '⚑ flag'), note = el('input'), reset = el('button', '', 'clear');
    note.placeholder = 'note'; note.value = p.note ?? '';
    note.maxLength = 400;
    flag.onclick = this.safe(() => this.pick(name, p.flag ? { flag: false } : { flag: true, at: this.cardAt || undefined }));
    note.onchange = this.safe(() => { const cardOf = this.cardOf; this.cardOf = ''; try { this.pick(name, { note: note.value.trim() }); } finally { this.cardOf = cardOf; } });   // (no refill: the change comes with the blur, and the click that caused it must still land on its button)
    reset.onclick = this.safe(() => { const mine = this.store[name]?.mine; this.unsolo(); delete this.store[name]; this.pick(name, mine ? { mine } : {}); });
    fl.append(flag, note, reset); c.append(fl);
    const ctx = this.audio.backend?.sfxContext; this.peakEl = null;
    if (takes.length && ctx) {
      const tune: SoundTune = cur === 'tuned' && p.tune ? p.tune : { base: cur }, plain = (base: string) => this.bufOf(name, base);
      const tuneNow = (): SoundTune => { const q = this.store[name]; return q?.take === 'tuned' && q.tune ? q.tune : { base: cur }; };
      const sec = (word: string) => c.append(el('div', 'sec', word));
      const mix = c.appendChild(el('div', 'd3'));
      c.append(this.spec = el('canvas', 'sp'), this.peakEl = el('div', 'pk'));
      this.dial(mix, name, 'pitch', { unit: '¢', lo: RATE_LO, hi: RATE_HI, log: true, v: p.rate ?? 1, def: 1, set: v => this.pick(name, { rate: v }) });
      this.dial(mix, name, 'level', { unit: 'dB', lo: LEVEL_LO, hi: 6, v: p.gain === undefined ? 0 : Math.max(LEVEL_LO, Math.min(6, Math.round(dBOf(p.gain) * 10) / 10)), def: 0, set: v => this.pick(name, { gain: v === 0 ? 1 : Math.min(2, Math.max(GAIN_LO, Math.pow(10, v / 20))) }) });
      this.dial(mix, name, 'tone', { unit: 'Hz', lo: TONE_LO, hi: TONE_HI, log: true, v: p.tone ?? TONE_HI, def: TONE_HI, off: 'open', set: v => this.pick(name, { tone: v >= TONE_HI ? TONE_HI : Math.round(v) }) });
      sec('post');
      this.dial(c, name, 'hp', { unit: 'Hz', lo: HP_LO, hi: HP_HI, log: true, v: tune.hp ?? HP_LO, def: HP_LO, off: 'off', set: v => this.tune(name, t => { t.hp = v; }) });
      const bell = tune.bell ?? [this.bellF, 0, this.bellQ], bellNow = () => tuneNow().bell ?? [this.bellF, 0, this.bellQ];
      const setBell = (i: 0 | 1 | 2) => (v: number) => { const b = [...bellNow()] as [number, number, number]; b[i] = v; this.bellF = b[0]; this.bellQ = b[2]; this.tune(name, t => { t.bell = b; }); };
      this.dial(c, name, 'bell', { unit: 'Hz', lo: BELL_LO, hi: BELL_HI, log: true, v: bell[0], def: 1000, set: setBell(0) });
      this.dial(c, name, 'bell', { unit: 'dB', lo: -BELL_DB, hi: BELL_DB, v: bell[1], def: 0, set: setBell(1) });
      this.dial(c, name, 'bell', { unit: '', lo: Q_LO, hi: Q_HI, log: true, v: bell[2], def: 1, tail: () => 'Q', set: setBell(2) });
      // the take's layers as written under the seed that is up (what a dial goes back to); what a dial shows is that with the tune's own numbers laid over (the log files a layer BEFORE the tuner's numbers go on)
      const wr = madeOf(ctx, name, { base: tune.base, seed: tune.seed }, plain), dur = wr ? wr.raw.length / wr.sr : 1;
      if (wr?.layers.length) {
        sec('synth');
        if (wr.wrote !== undefined) {
          const wrote = wr.wrote, sd = el('div', 'sd' + (tune.seed !== undefined ? ' ch' : '')), n = el('input', 'n'), roll = el('button', '', 'roll seed'), seed = (v: number | undefined) => this.safe(() => { this.tune(name, t => { t.seed = v === wrote ? undefined : v; }); this.audition(name); });
          n.value = String(tune.seed ?? wrote); n.inputMode = 'numeric';
          n.onfocus = () => n.select();
          n.onchange = this.safe(() => { const v = parseInt(n.value, 10); if (n.dataset.esc || !(v >= 1 && v <= SEED_MAX)) { n.value = String(tuneNow().seed ?? wrote); return; }
            this.hold = true; try { seed(v)(); } finally { this.hold = false; } this.fillSoon(); });   // (no refill here: the change comes with the blur, and the click that caused it must still land on its button — the card is filled again after that click)
          roll.onclick = this.safe(() => { const a = new Uint32Array(1); crypto.getRandomValues(a); seed(1 + a[0] % SEED_MAX)(); });   // (never Math.random: on a replay page it is the tape's die)
          sd.ondblclick = this.safe((e: MouseEvent) => { if (e.target !== n && e.target !== roll) seed(undefined)(); });
          sd.append(el('span', '', 'seed'), n, roll); c.append(sd);
        }
        const ly = el('div', 'ly');
        wr.layers.forEach(wl => {
          const k = wl.k, cl = tune.over?.[k] ? { ...wl, p: { ...wl.p, ...tune.over[k] } } : wl, off = !!tune.mute?.includes(k), fx = wl.kind === 'slaps' || wl.kind === 'drive';
          const row = el('div', 'l' + (tune.over?.[k] || off ? ' ch' : '') + (off ? ' off' : '') + (this.openL === k ? ' open' : '')), M = el('button', off ? 'is' : '', 'M'), S = el('button', this.solo === k ? 'is' : '', 'S');
          M.title = fx ? 'bypass' : 'mute'; S.title = 'solo';
          row.onclick = this.safe(() => { this.openL = this.openL === k ? -1 : k; this.fill(); });
          M.onclick = this.safe((e: MouseEvent) => { e.stopPropagation(); this.tune(name, t => { const m = new Set(t.mute ?? []); if (!m.delete(k)) m.add(k); t.mute = [...m].sort((x, y) => x - y); }); this.audition(name); });
          S.onclick = this.safe((e: MouseEvent) => { e.stopPropagation(); this.solo = this.solo === k ? undefined : k; this.soloOf = name; this.apply(name); this.audition(name); this.fill(); });
          row.append(el('span', '', String(k)), el('b', '', wl.kind), el('i', '', layerSays(cl)), M, fx ? el('span') : S); ly.append(row);
          if (this.openL !== k) return;
          const lp = el('div', 'lp');
          for (const P of paramsOf(wl, dur)) if (P.key in wl.p) { const def = wl.p[P.key];
            this.dial(lp, name, P.word, { unit: P.unit, lo: Math.min(P.lo, def), hi: Math.max(P.hi, def), log: P.log && Math.min(P.lo, def) > 0, v: cl.p[P.key] ?? def, def,
              set: v => this.tune(name, t => { const r = ((t.over ??= {})[k] ??= {}); if (v === def) delete r[P.key]; else r[P.key] = v; }) }); }
          ly.append(lp);
        });
        c.append(ly);
      }
      // what he kept to come back to, and the way back to the take as written
      const kept = (q: Kept): Kept => { const m: Kept = {}; if (q.take) m.take = q.take; if (q.take === 'tuned' && q.tune) m.tune = q.tune; if (q.rate) m.rate = q.rate; if (q.tone) m.tone = q.tone; if (q.gain !== undefined) m.gain = q.gain; return m; };
      const mine = p.mine ?? [], here = JSON.stringify(kept(p)), op = el('div', 'op');
      if (this.changed(p) && !mine.some(m => JSON.stringify(m) === here)) { const b = el('button', '', 'keep'); b.onclick = this.safe(() => this.pick(name, { mine: [...mine, kept(p)].slice(-MINE_MAX) })); op.append(b); }
      mine.forEach((m, i) => { const b = el('button', JSON.stringify(m) === here ? 'is' : '', `mine ${i + 1}`); b.title = 'right-click: forget';
        b.onclick = this.safe(() => { this.unsolo(); this.pick(name, { take: m.take ?? game, rate: m.rate ?? 1, tone: m.tone ?? TONE_HI, gain: m.gain ?? 1, ...(m.take === 'tuned' ? { tune: m.tune } : {}) }); this.audition(name); });
        b.oncontextmenu = this.safe((e: MouseEvent) => { e.preventDefault(); this.pick(name, { mine: mine.filter((_, j) => j !== i) }); }); op.append(b); });
      if (this.changed(p)) { const b = el('button', '', 'reset'); b.title = `${tune.base} as written`; b.onclick = this.safe(() => { this.unsolo(); this.pick(name, { take: tune.base, tune: undefined, rate: 1, tone: TONE_HI, gain: 1 }); this.audition(name); }); op.append(b); }
      if (op.childElementCount) c.append(op);
    }
    c.scrollTop = top;
    this.drawSpec(); this.more();
  }
  /** more lanes than the dock has room for: a row of its own at the foot of the names (`ft`, there for as long as the lanes do not all fit) says how many are not wholly
   *  in sight below — "▾ 4", nothing at the list's end — and the lanes' bottom edge fades over the name that is cut (as the card's does). Neither takes the pointer. */
  private moreRows() {
    const r = this.rows, below = this.foot.hidden ? 0 : Math.max(0, this.names.length - Math.floor((r.scrollTop + r.clientHeight + 0.5) / ROW)), say = below ? `▾ ${below}` : '';
    if (this.foot.textContent !== say) this.foot.textContent = say; if (this.fade.hidden === !!below) this.fade.hidden = !below;
  }
  /** the card's bottom edge fades while there is more of it below */
  private more() { const c = this.card; if (c) c.classList.toggle('more', c.scrollHeight - c.scrollTop - c.clientHeight > 2); }
  /** the card filled again once the click that is under way has landed (a field's change comes with its blur, between a button's press and its click), or a moment later */
  private fillSoon() { let done = false; const go = () => { if (done) return; done = true; removeEventListener('click', on, true); if (this.card) this.safe(() => this.fill())(); }, on = () => { setTimeout(go, 0); }; addEventListener('click', on, true); setTimeout(go, 400); }
  /** the buffer on the card: its peak with the level laid on (dBFS), and how far the guard pulled it down when it was made (dB, 0 = not) */
  peak = 0; pulled = 0;
  /** one dial: a slider and its number beside it (which can be typed into), `v` and `def` in the instrument's units. Let go a hair from `def` it IS `def`; a double
   *  click puts `def` back; a value that is not `def` is marked. The slider's steps are the numbers as shown (whole cents, tenths of a dB). */
  private dial(host: HTMLElement, name: string, word: string, o: { unit: Unit; lo: number; hi: number; log?: boolean; v: number; def: number; off?: string; tail?: (v: number) => string; set: (v: number) => void }) {
    const row = el('div', 'd'), s = el('input'), n = el('input', 'n'), u = el('i'), clamp = (v: number) => Math.min(o.hi, Math.max(o.lo, v));
    const toK = (v: number) => Math.round(1000 * (o.log ? Math.log(clamp(v) / o.lo) / Math.log(o.hi / o.lo) : (clamp(v) - o.lo) / (o.hi - o.lo || 1))), kDef = toK(o.def);
    const ofK = (k: number) => { if (Math.abs(k - kDef) <= 6) return o.def; const v = o.log ? o.lo * Math.pow(o.hi / o.lo, k / 1000) : o.lo + (o.hi - o.lo) * k / 1000, r = typed(o.unit, shown(o.unit, v)); return isFinite(r) ? clamp(r) : v; };
    const say = (v: number) => { const off = !!o.off && v === o.def; n.value = off ? o.off! : shown(o.unit, v); u.textContent = off ? '' : o.tail ? o.tail(v) : o.unit; row.classList.toggle('ch', v !== o.def); };   // ('off', 'open': a word, no unit after it)
    const put = (v: number, live: boolean) => { say(v); this.hold = true; this.lazy = live; try { o.set(v); } finally { this.hold = false; this.lazy = false; } };
    s.type = 'range'; s.min = '0'; s.max = '1000'; s.step = '1'; s.value = String(toK(o.v)); say(o.v);
    s.oninput = this.safe(() => put(ofK(+s.value), true));
    s.onchange = this.safe(() => { s.blur(); this.flush(); this.audition(name); this.fill(); });
    s.onpointerup = () => { setTimeout(() => s.blur(), 0); };   // (a press that does not move the thumb fires no change: the keys are still the replay's after it)
    n.onfocus = () => n.select();
    n.onchange = this.safe(() => { const v = n.dataset.esc ? NaN : typed(o.unit, n.value); if (isFinite(v)) { const w = clamp(v); put(w, false); s.value = String(toK(w)); this.audition(name); this.drawSpec(); } else say(ofK(+s.value)); });   // (no refill: the change comes with the blur, and the click that caused it must still land on its button)
    row.ondblclick = this.safe((e: MouseEvent) => { if (e.target === n) return; put(o.def, false); this.audition(name); this.fill(); });
    row.append(el('span', '', word), s, n, u); host.append(row);
  }
  /** the picture on the card: the take as written (grey) under what the mixer now plays of it (the tune, the low-pass, the pitch and the level laid on), 30 Hz – 20 kHz on a log axis */
  private drawSpec() {
    const cv = this.spec, name = this.cardOf; if (!cv || !this.card || !cv.isConnected) return;
    const p = this.store[name] ?? {}, cur = p.take ?? this.gameTake(name), base = cur === 'tuned' && p.tune ? p.tune.base : cur;
    const a = this.bufOf(name, base), b = this.audio.trims.get(name)?.take === `${name}@tuned` ? this.tunedBuf.get(name) : a; if (!a || !b) return;
    const BINS = 110, F0 = 30, F1 = 20000, SPAN = 66, dpr = Math.min(2, devicePixelRatio || 1), W = cv.width = Math.round(320 * dpr), H = cv.height = Math.round(54 * dpr), g = cv.getContext('2d'); if (!g) return;
    const id = `${name}@${base}`; let A = this.specOf.get(id); if (!A) this.specOf.set(id, A = spectrum(a.getChannelData(0), a.sampleRate, BINS, F0, F1));
    const B = spectrum(b.getChannelData(0), b.sampleRate, BINS, F0, F1, p.tone ?? 0, p.rate ?? 1), lift = p.gain === undefined ? 0 : dBOf(p.gain);
    let top = -140; for (const v of A) if (v > top) top = v; top += 8;
    g.clearRect(0, 0, W, H); g.lineWidth = dpr; g.font = `${11 * dpr}px ui-monospace,Menlo,Consolas,monospace`;
    for (const [f, word] of [[100, '100'], [1000, '1k'], [10000, '10k']] as const) { const x = Math.log(f / F0) / Math.log(F1 / F0) * W; g.fillStyle = 'rgba(233,226,214,.14)'; g.fillRect(x, 0, dpr, H); g.fillStyle = 'rgba(233,226,214,.4)'; g.fillText(word, x + 3 * dpr, 11 * dpr); }
    const line = (S: Float32Array, add: number, colour: string) => { g.strokeStyle = colour; g.beginPath(); for (let i = 0; i < BINS; i++) { const x = (i + 0.5) / BINS * W, y = Math.min(H, Math.max(0, (top - S[i] - add) / SPAN * H)); if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); };
    line(A, 0, 'rgba(233,226,214,.45)'); if (b !== a || p.tone || p.rate || lift) line(B, lift, '#fff');
    // PEAK: of the buffer as the mixer is handed it with the level laid on, dBFS; 'over' past full scale (only the level dial can take it there: a tuned buffer that
    // came out over is pulled down when it is made, and the card says by how much)
    let pk = 0; const x = b.getChannelData(0); for (let i = 0; i < x.length; i++) { const m = Math.abs(x[i]); if (m > pk) pk = m; }
    const peak = this.peak = dBOf(Math.max(1e-9, pk * (p.gain ?? 1))), pulled = this.pulled = pulledOf(b), bad = peak > 0.05;
    const w = `peak ${peak >= 0 ? '+' : '−'}${Math.abs(peak).toFixed(1)} dBFS${bad ? ' over' : ''}${pulled ? ` · pulled ${pulled.toFixed(1)} dB` : ''}`;
    cv.dataset.peak = w; const pk2 = this.peakEl; if (pk2) { pk2.textContent = w; pk2.classList.toggle('bad', !!(bad || pulled)); }   // (said UNDER the picture, not over its curve)
  }

  /** lay out and draw (every animation frame; a page check calls it by hand, a hidden pane has no frames) */
  paint() {
    const bar = document.getElementById('tapebar');
    this.root.hidden = !bar; if (!bar) return;
    this.sync();
    const n = this.names.length, flags = this.flagN, W = Math.max(1, (this.body.clientWidth || innerWidth) - GUT), dpr = Math.min(2, devicePixelRatio || 1);
    if (this.root.classList.contains('shut') === this.open) { this.root.classList.toggle('shut', !this.open); this.geo = ''; }   // (before anything is measured: the lanes' width hangs on it)
    const geo = `${W},${bar.offsetHeight},${n},${this.open},${this.cardOf},${this.cpN},${this.head.offsetHeight}`;
    if (geo !== this.geo) {
      this.geo = geo; this.dirty = true; this.drawn = '';
      this.root.style.bottom = `${bar.offsetHeight}px`; this.caret.textContent = this.open ? '▾' : '▸';
      // THE DOCK IS AS TALL AS WHAT IS IN IT: its head, the ruler and the lanes it has (DOCK_MIN … DOCK, the lanes scroll past that); with the card up, DOCK. Folded: its head.
      { const hgt = !this.open ? '' : `${this.cardOf ? DOCK : Math.max(DOCK_MIN, Math.min(DOCK, this.head.offsetHeight + RULE + n * ROW + 2))}px`; if (this.root.style.height !== hgt) this.root.style.height = hgt; }
      while (this.labels.length < n) { const i = this.labels.length, lb = el('div', 'lb', this.names[i]); lb.style.top = `${i * ROW}px`; lb.onclick = this.safe(() => this.show(this.names[i])); this.rows.insertBefore(lb, this.cv); this.labels.push(lb); }
      for (let i = 0; i < n; i++) { const lb = this.labels[i], p = this.store[this.names[i]]; lb.classList.toggle('flag', !!p?.flag); lb.classList.toggle('cut', !!p && this.changed(p)); lb.classList.toggle('sel', this.cardOf === this.names[i]); }
      const h = Math.max(1, n * ROW);
      this.cv.style.width = `${W}px`; this.cv.style.height = `${h}px`; this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(h * dpr);
      this.rc.style.width = `${W}px`; this.rc.style.height = `${RULE}px`; this.rc.width = Math.round(W * dpr); this.rc.height = Math.round(RULE * dpr);
      // the checkpoints, numbered in time order: a chip in the head ("1 0:12") and a flag on the ruler ("1"), one click for both — hear from there (shift: the replay
      // itself goes there; right click: gone)
      for (const c of this.flags) c.e.remove(); this.flags = []; this.cpBox.textContent = '';
      // (a checkpoint the tape has not reached is drawn dim, and a click on it changes nothing: shift-click goes there). Each chip carries its own × — gone.
      this.checkpoints().forEach((f, i) => {
        const chip = el('button', 'chip'), flag = el('i', 'cp', String(i + 1)), x = el('i', '', '×'); chip.append(el('b', '', String(i + 1)), ` ${clock(this.tAt[f])}`, x);
        const go = this.safe((e: MouseEvent) => { e.stopPropagation(); chip.blur(); if (e.shiftKey || e.altKey) this.tape.seek(f); else if (this.relisten(f)) this.region(0, null); });
        const gone = this.safe((e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); chip.blur(); this.uncheck(f); });
        chip.onclick = go; flag.onclick = go; x.onclick = gone; flag.oncontextmenu = gone; flag.onpointerdown = e => e.stopPropagation(); flag.hidden = true;
        chip.title = flag.title = 'hear · shift-click: go'; x.title = 'delete checkpoint';
        this.cpBox.append(chip); this.rule.insertBefore(flag, this.gut); this.flags.push({ f, e: flag, chip, ahead: false });
      });
      const cn = Object.values(this.store).filter(p => p.take || p.rate || p.tone || p.gain !== undefined || p.flag || p.note).length;   // (the sounds 'copy picks' has a word for)
      if (cn !== this.copyN) { this.copyN = cn; this.copy.hidden = !cn; this.copy.textContent = `copy picks (${cn})`; }   // (nothing to copy: no button)
      document.documentElement.style.setProperty('--sndl-h', `${this.root.offsetHeight}px`);
      { const over = this.open && n * ROW > this.body.clientHeight - RULE + 0.5; if (this.foot.hidden === over) this.foot.hidden = !over; this.moreRows(); }   // (the body's height is the same with the foot or without)
    }
    const say = `${n} sound${n === 1 ? '' : 's'}${flags ? ` · <b>${flags} flagged</b>` : ''}`; if (say !== this.said) this.tally.innerHTML = this.said = say;
    if (this.re) this.reTick(Math.min(0.5, Math.max(0, (performance.now() - this.re.last) / 1000)));
    if (!this.re) this.film?.hide();
    this.noPicture(!!this.re && !this.reShown && !!this.film); this.pictured(!!this.re && this.reShown && !!this.film && this.film.count() > 0);   // (heard again where no picture was kept: said ON the view, where the picture would be)
    { const m = document.getElementById('tapemapbig'); if (m && !m.hidden) this.escTheirs = performance.now(); }   // (the bar's big map is up: the next Esc shuts IT)
    const re = this.re, fNow = Math.min(this.tape.f, this.tAt.length - 1);
    for (const c of this.flags) { const a = c.f >= fNow; if (a !== c.ahead) { c.ahead = a; c.chip.classList.toggle('ahead', a); c.e.classList.toggle('ahead', a); c.chip.title = c.e.title = a ? 'ahead · shift-click: go' : 'hear · shift-click: go'; } }
    if (!!re !== this.reOn) { this.reOn = !!re; this.root.classList.toggle('re', !!re); this.back.classList.toggle('is', !!re);   // (`re`: a lane lit under the stretch's head is cyan — green is the TAPE's now)
      this.reh.hidden = !re; this.band.hidden = !re; }
    const from = re ? -1 : this.againFrom(), back = re ? '■ stop' : from >= 0 ? `↺ again from ${clock(this.tAt[from])}` : '↺ again';   // (the button names where it will go back to)
    if (back !== this.backSaid) { this.back.textContent = this.backSaid = back; this.back.classList.toggle('off', !re && from < 0); this.back.title = re ? 'stop' : 'hear it again'; }
    if (!this.open) return;
    // THE WINDOW: everything below is placed in it
    const v = this.view(), t = v.head, x = (s: number) => (s - v.t0) / v.span * W;
    const put = (e: HTMLElement, a: number, b: number, min: number) => { const x0 = Math.max(-2, x(a)), x1 = Math.min(W + 2, Math.max(x(b), x(a) + min)); e.style.left = `${x0}px`; e.style.width = `${Math.max(0, x1 - x0)}px`; };
    if (re) { put(this.band, this.tAt[re.f0], re.end, 1); this.reh.style.left = `${x(t)}px`; }
    const rg = this.reg; if (this.regBand.hidden !== !rg) this.regBand.hidden = !rg;
    if (rg) put(this.regBand, this.tAt[rg[0]], this.tAt[rg[1]], 2);
    [this.hl, this.hr].forEach((h, i) => { const hx = rg ? x(this.tAt[rg[i]]) : -1, out = hx < 0 || hx > W; if (h.hidden !== out) h.hidden = out; if (!out) h.style.left = `${hx}px`; });
    this.now.style.left = `${x(v.now)}px`;
    for (let i = 0; i < n; i++) { const on = re ? t < (this.reLit[i] ?? -1) : this.tape.playing && t < this.lit[i]; if (on !== this.litOn[i]) { this.litOn[i] = on; this.labels[i].classList.toggle('on', on); } }
    // the window moved (or the layout, or a pick): the ruler and every mark in it drawn again; standing still, a sound that lands draws ITS mark
    const key = `${v.t0.toFixed(3)},${v.span},${W}`, moved = key !== this.drawn;
    const full = moved || this.dirty || (this.stale && performance.now() - this.fullAt > REDRAW_MS);
    if (moved) { this.drawn = key; this.ruler(v.t0, v.span, W, dpr); for (const c of this.flags) { const cx = x(this.tAt[c.f]), out = cx < 0 || cx > W; if (c.e.hidden !== out) c.e.hidden = out; if (!out) c.e.style.left = `${GUT + cx}px`; } }
    if (!full && !this.late.length) return;
    const g = this.cv.getContext('2d'); if (!g) { this.late.length = 0; return; }
    const Wp = this.cv.width, k = Wp / W;
    const mark = (e: Ev) => {
      const p = this.store[this.names[e.n]], x0 = x(this.tAt[e.f]) * k, w = Math.max(2 * k, (e.dur || this.durOf[e.n] || 0.2) / v.span * Wp); if (x0 > Wp || x0 + w < 0) return;
      g.fillStyle = p?.flag ? GOLD : '#e9e2d6';
      g.globalAlpha = e.heard === 2 ? 0.4 + 0.6 * Math.min(1, e.gain) : e.heard === 1 ? 0.22 : 0.3;       // (asked for but too faint to play where the listener stood, or asked while the mixer was off — a seek, a muted page: dim)
      g.fillRect(x0, (e.n * ROW + 3) * k, w, (ROW - 6) * k);
    };
    if (full) {
      this.dirty = false; this.stale = false; this.fullAt = performance.now();
      g.clearRect(0, 0, Wp, this.cv.height);
      for (let i = 0; i < n; i++) if (i & 1) { g.fillStyle = 'rgba(233,226,214,.035)'; g.fillRect(0, i * ROW * k, Wp, ROW * k); }
      this.inView(v, mark);
    } else for (const e of this.late) mark(e);
    this.late.length = 0; g.globalAlpha = 1;
  }
  /** the ruler over the lanes: a short tick and a long one by turns, m:ss at each long one — every 10 s while a label has room, else 20 / 30 / 60 */
  private ruler(t0: number, span: number, W: number, dpr: number) {
    const g = this.rc.getContext('2d'); if (!g) return;
    const say = `${span} s`; if (this.gutSay.textContent !== say) this.gutSay.textContent = say;
    let lab = 10; for (const s of [10, 20, 30, 60, 120, 300]) { lab = s; if (s / span * W >= 54) break; }
    const tick = lab / 2, H = RULE * dpr;
    g.clearRect(0, 0, this.rc.width, this.rc.height); g.font = `${11 * dpr}px ui-monospace,Menlo,Consolas,monospace`; g.textBaseline = 'alphabetic';
    for (let s = Math.ceil(t0 / tick) * tick; s <= t0 + span && s <= this.tEnd + tick; s += tick) {
      const x = Math.round((s - t0) / span * W * dpr), long = Math.round(s / tick) % 2 === 0;
      g.fillStyle = `rgba(233,226,214,${long ? 0.45 : 0.25})`; g.fillRect(x, H - (long ? 9 : 4) * dpr, dpr, (long ? 9 : 4) * dpr);
      if (long) { g.fillStyle = 'rgba(233,226,214,.55)'; g.fillText(clock(s), x + 3 * dpr, H - 2 * dpr); }
    }
  }

  // ---- for a page check ----
  checkpoints() { return [...this.cps].sort((a, b) => a - b); }
  /** the stretch being heard again, or the last one that was (`from` its first step, `n` its sounds; `played` = every sound handed back on this page) */
  relistening() { const re = this.re; return { on: !!re, from: this.lastFrom, to: re?.f1 ?? -1, t: re?.t ?? 0, end: re?.end ?? 0, n: this.reAll, played: this.reN, passes: this.rePass, loop: this.loopOn, region: this.reg ? [...this.reg] : null }; }
  /** (a page check's clock: the stretch moved on by `sec` whatever the frames did) */
  reStep(sec: number) { this.reTick(sec); }
  rowNames() { return this.names.map((name, i) => ({ name, asked: this.count[i], lit: this.litOn[i], pick: this.store[name] ?? null })); }
  events() { const out: { f: number; t: number; name: string; heard: number }[] = []; for (const at of this.byStep.values()) for (const e of at) out.push({ f: e.f, t: this.tAt[e.f], name: this.names[e.n], heard: e.heard }); return out.sort((a, b) => a.f - b.f); }
  picks() { return this.store; }
  /** a sound's tune as the card has it: the take that is up, the layers under it, how far the tuned buffer the mixer holds is from the base take's (the largest sample difference; -1 = no tuned buffer) */
  tuneState(name: string) {
    const p = this.store[name] ?? {}, cur = p.take ?? this.gameTake(name), ctx = this.audio.backend?.sfxContext, tune: SoundTune = cur === 'tuned' && p.tune ? p.tune : { base: cur };
    const made = ctx ? madeOf(ctx, name, tune, b => this.bufOf(name, b)) : null, a = this.bufOf(name, tune.base)?.getChannelData(0), b = this.tunedBuf.get(name)?.getChannelData(0);
    let diff = -1; if (a && b) { diff = Math.abs(a.length - b.length) ? 1 : 0; for (let i = 0; i < Math.min(a.length, b.length); i++) diff = Math.max(diff, Math.abs(a[i] - b[i])); }
    return { take: cur, base: tune.base, tune: p.tune ?? null, layers: (made?.layers ?? []).map(l => ({ k: l.k, kind: l.kind, p: { ...l.p } })), diff, due: this.due.has(name) };
  }
  takesOf(name: string) { return { takes: this.takes(name), game: this.gameTake(name), trim: this.audio.trims.get(name) ?? null }; }
}

/** stand the lanes up on a replay page (main.ts, once the tape's player is attached); nothing on a page whose replay was refused */
export function soundLanes(tape: TapePlay, audio: AudioEngine): SoundLanes | null {
  if (!tape.tape) return null;
  // A DEBUG MODE, OFF BY DEFAULT: the lanes exist only on a page whose address says `soundlanes` (`soundlanes=0` = off). Without it nothing of this file is on the
  // page — no dock, no style, no tap on the mixer, no hook — and the replay viewer is as if the file were not there
  { const q = new URLSearchParams(location.search); if (!q.has('soundlanes') || q.get('soundlanes') === '0') return null; }
  try {
    const L = new SoundLanes(tape, audio);
    (window as unknown as { __sndlanes: SoundLanes }).__sndlanes = L;
    return L;
  } catch (e) { console.error('sound lanes did not come up:', e); audio.tap = null; return null; }   // (an overlay: the replay plays without it)
}
