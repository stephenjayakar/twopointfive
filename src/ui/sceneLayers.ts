// WHAT A SCENE IS MADE OF — the list the scene tweak panel shows (ui/sceneTweak.ts; `?tweak`): the picture's layers, back to front, each with its switch and its
// numbers. Written for the scene the maintainer sent on 10-15 (the snow pass at night: lying snow under a moon and a torch, flakes, blown snow, breath) and
// built from the tables the code already keeps, so a number added to one of them shows up here by itself:
//
//   a whole authored table (SNOWFX, SNOWGRAINS, AIR …)    → `table()`: every number in it is a row, its hover text the table's own comment (ui/sceneNotes.ts)
//   the WGSL constants of a look (SNOW_SPARKLE_*, GRAIN_*)  → `consts()`: read out of the shader's text; a move overrides the constant (render/shaderTune.ts)
//                                                            and rebuilds that one program — the shader file and every other page keep the bundled text
//   the renderer's settings, a weather's numbers          → rows by hand, where they are part of this picture
//
// Nothing here is a default and nothing is new in the game: every row writes a number that was already there. The rows marked `play` are the ones the simulation
// reads too (a torch's strength is what a guard sees by): they were always so, on the debugger's own sliders. All the rest is picture only.
//
// A NEW LAYER is one `layers.push({ … })` below; a new number in a table that is already listed needs nothing.
import type { Engine } from '../engine';
import type { Game } from '../game/game';
import { FrameFlags, snowLookConfig } from '../render/frame';
import { SHADER_TUNE, shaderConsts } from '../render/shaderTune';
import { compositeText } from '../render/passes';
import { particleTexts } from '../render/particles';
import { SNOW_SURF, snowCfgRows } from '../render/snowField';
import { AIR } from '../render/airField';
import { SNOWFX, SNOWWISPS, SNOWGRAINS, snowStats, wispStats, grainStats, oneAirActive } from '../game/snowFx';
import { SNOWBLAST, snowBlastAt, snowBlastStats } from '../game/snowBlast';
import { SNOWTRACKS, TRACK_RES } from '../game/snowTracks';
import { SNOWMARKS } from '../game/snowMarks';
import { SNOWBREATH, BREATHSTEAM, breathStats, steamOn } from '../game/snowBreath';
import { HARDBREATH } from '../game/character';   // (read inside a row's own closure only)
import { AIR_SIM, airSimStats } from '../game/airSim';
import { SNOW_LOOK, snowLevel } from '../game/weatherKinds';
import { levelNameOf } from '../scene/levelLoad';
import { WIND } from '../game/wind';
import { FOG } from '../game/fogofwar';
import { SCENE_NOTES } from './sceneNotes';
import { muting, type TweakLayer, type TweakSwitch, type TweakVar } from './sceneTweak';

interface Row { min?: number; max?: number; step?: number; when?: 'next' | 'build'; play?: boolean; label?: string }
type Rows = Record<string, Row>;

/** a slider's reach from the shipped value alone: 0 ‥ the next round number past 4 × it (a signed one runs both ways), in two hundred steps. The row's number
 *  box is held to the same reach: a typed value can not leave it. */
function reach(def: number): { min: number; max: number; step: number } {
  const a = Math.abs(def); if (a < 1e-9) return { min: 0, max: 1, step: 0.01 };
  const nice = (x: number, up: boolean) => { const p = 10 ** Math.floor(Math.log10(x)); const m = x / p; const k = up ? (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) : (m >= 5 ? 5 : m >= 2 ? 2 : 1); return k * p; };
  const max = nice(a * 4, true);
  return { min: def < 0 ? -max : 0, max, step: nice(max / 200, false) };
}
function mk(id: string, label: string, src: string, get: () => number, set: (v: number) => void, r: Row = {}, note?: string): TweakVar {
  const def = get(); const a = reach(def);
  return { id, label: r.label ?? label, src, get, set, def, min: r.min ?? a.min, max: r.max ?? Math.max(a.max, r.min ?? a.min), step: r.step ?? a.step, when: r.when, play: r.play, note: note ?? SCENE_NOTES[id] ?? HAND[id] ?? HAND[id.replace(/\[\d\]$/, '')] };
}
/** A blown man's steam (snowBreath.ts updateSnowBreath): the breath table's own numbers for it, read only with the hard breath rule off, and the rule's
 *  numbers that are read in their place while it is on (character.ts HARDBREATH; its chest numbers move bones and are no row here). */
export const BREATH_SOFT = ['everyHard', 'hardK', 'effortUp', 'effortDown'] as const;
export const BREATH_HARD = ['every', 'puffs', 'count', 'jet', 'size', 'carry', 'up', 'down'] as const;
/** the puffs' own look (snowBreath.ts SNOWBREATH): read by no breath that is steam through the smoke solver (SNOW_LOOK.steam) */
export const BREATH_PUFF = ['puffs', 'count', 'speed', 'spread', 'life', 'lifeJit', 'size', 'sizeJit', 'opacity', 'color[0]', 'color[1]', 'color[2]'] as const;
/** hover text for the numbers whose table carries no comment of their own (ui/sceneNotes.ts has the rest, generated from the tables) */
const HAND: Record<string, string> = {
  'HARDBREATH.every': 's between breaths when blown',
  'HARDBREATH.puffs': 'records a breath when blown (at rest: puffs)',
  'HARDBREATH.count': 'puffs a record when blown (at rest: count)',
  'HARDBREATH.jet': '× how fast the steam is thrown when blown',
  'HARDBREATH.size': '× size and opacity when blown',
  'HARDBREATH.carry': 'how much of his own pace the steam leaves with when blown (at rest: carry)',
  'HARDBREATH.up': 's of running until he is blown',
  'HARDBREATH.down': 's to get his wind back',
  'SNOWFX.sizeJit': 'how much flakes differ in size (0 = all alike)',
  'SNOWFX.minPx': 'a flake is never drawn thinner than this many pixels (thinner, it is drawn this wide and dimmed by as much)',
  'SNOWFX.maxPx': 'a flake is never drawn wider than this many pixels, however near the lens',
  'SNOWFX.boostCap': 'the most a flake held at the width ceiling may be brightened to make up for it (×)',
  'SNOWFX.nearFadeM': 'm from the lens inside which a flake fades out instead of filling the screen',
  'SNOWWISPS.lifeJit': 'how much wisps differ in how long they live (0 = all alike)',
  'SNOWWISPS.sizeJit': 'how much wisps differ in size (0 = all alike)',
  'SNOWGRAINS.sizeJit': 'how much grains differ in size (0 = all alike)',
  'SNOWBREATH.everyJit': 'how much the men differ in how often they breathe (0 = all alike)',
  'SNOWBREATH.lifeJit': 'how much puffs differ in how long they hang (0 = all alike)',
  'SNOWBREATH.sizeJit': 'how much puffs differ in size (0 = all alike)',
  'settings.exposure': 'the camera\'s exposure: the whole picture brighter or darker, ahead of the tone curve (the hour sets it when a level opens)',
  'settings.hazeDensity': 'how much the air itself scatters light: what makes a torch\'s or a lamp\'s beam show in the air',
  'settings.indirectScale': '× the light that has bounced off a surface (0 = only what a lamp reaches directly)',
  'settings.emissiveScale': '× every lamp\'s own strength',
  'tune.flashOuter': 'the torch cone\'s full width, degrees from its axis to where the light ends',
  'tune.flashInner': 'the cone\'s bright core, degrees from its axis to where it starts to fall off',
  'weather.wind[1]': 'the weather\'s wind vector: flakes, blown snow, dust and smoke outdoors all ride it',
  'FLAKE_WALL_IN': 'm: how far inside a roof\'s edge a surface must be before no flake is drawn in front of it (a wall\'s outer face and its top take the snow)',
  'FLAKE_TOP_IN': 'm: a top at the ceiling takes the snow only this near the roofs\' edge — an outer wall\'s; a partition\'s top deeper inside is under the roof (with ?snowunder=0 nothing reads it)',
  'WIND.stormK': '× the weather\'s wind outdoors (0 = dead calm)',
  'WIND.stormGustAmp': 'how hard the storm gusts: its speed swings by this share either way',
  'WIND.stormGustPeriod': 's: how long one gust and its lull take',
};
/** what each layer IS (its hover text) */
const ABOUT: Record<string, string> = {
  sky: 'The light of the sky dome and the moon: what an unlit yard is seen by. The hour and the weather set both.',
  lamps: 'Every fixed lamp in the level: bulbs, tubes, floodlights.',
  torch: 'The squad\'s weapon lights and your own: their strength and the shape of the cone.',
  bounce: 'Light that has bounced off walls, floor and snow: what fills a room a lamp does not reach directly.',
  beams: 'Light scattered by the air itself: the visible shaft of a torch or a lamp.',
  surface: 'The lying snow: one soft surface over the ground, its colour where fresh, packed or old, its roughness, the blue in its hollows.',
  sparkle: 'Glints off single ice crystals where a light meets the snow at the mirror angle.',
  glow: 'Light passing through the snow\'s top layer: the cold glow at a drift\'s lit edge.',
  prints: 'Boot prints pressed into the snow: how deep, the rim thrown up, how they scuff when a man runs or turns.',
  marks: 'What moves over the snow marks it: a pushed chair cuts furrows, a thrown thing dents where it lands and grooves where it rolls, and a mark sinks in over a moment and kicks loose snow up. Off: only boots print, and a print is whole at once.',
  blast: 'What a blast does to lying snow: the crater pressed into it, the snow thrown up, the puff of powder, the shove to the air.',
  flakes: 'Snow falling through the air: how many, how fast, how they catch the light.',
  oneair: 'One snow in one air: the flakes fall through the wind sim among the walls, a wisp is snow that wind lifts where it is fast enough, and there are no grains of their own. Off: flakes on the open wind, wisps in gusts, grains near the view.',
  wisps: 'Long low streaks of snow the wind lifts off the ground and carries along it.',
  grains: 'Fine snow picked up off the ground near the view and carried on the air around walls and men. Not drawn while the snow is one snow in one air.',
  breath: 'Steam off each man\'s breath in the cold: more and faster when he has been running. A blown man breathes by the `blown` rows while the hard breath rule is on (the page as it opens), and by everyHard, hardK, effortUp and effortDown with ?hardbreath=0: the rows nothing reads are dimmed. With the breath as real steam (the page as it opens; ?breathsteam=0 = puffs) a breath is gas in the smoke solver, off the mouth as the gun\'s is off the muzzle: the `steam` rows are what it is made of, and the rhythm, the mouth and the pitch rows above still hold.',
  air: 'The moving air the grains and smoke ride: a small wind simulation around the buildings.',
  storm: 'The weather\'s wind: its direction, strength and gusting. Flakes, blown snow and smoke outdoors ride it.',
  fog: 'How the parts of the level your team cannot see are shaded: how dark, how grey.',
  bloom: 'The soft halo around anything bright.',
  grain: 'Film grain over the finished picture.',
  tone: 'The camera: how bright the whole picture is exposed and how strong its colour.',
};
const AXES: Record<number, string[]> = { 2: ['a', 'b'], 3: ['r', 'g', 'b'], 4: ['a', 'b', 'c', 'd'] };

/** every number of an authored table as a row (a short array of numbers: one row a component). `only` / `skip` pick; `rows` bends a row's reach or says when it shows. */
function table(name: string, t: object, src: string, o: { only?: readonly string[]; skip?: readonly string[]; rows?: Rows; when?: 'next' | 'build' } = {}): TweakVar[] {
  const T = t as Record<string, unknown>; const out: TweakVar[] = [];
  for (const k of Object.keys(T)) {
    if (o.only ? !o.only.includes(k) : o.skip?.includes(k)) continue;
    const x = T[k]; const r: Row = { when: o.when, ...o.rows?.[k] };
    if (typeof x === 'number') out.push(mk(`${name}.${k}`, k, src, () => T[k] as number, v => { T[k] = v; }, r, SCENE_NOTES[`${name}.${k}`]));
    else if (Array.isArray(x) && x.length >= 2 && x.length <= 4 && x.every(n => typeof n === 'number')) {
      x.forEach((_, i) => out.push(mk(`${name}.${k}[${i}]`, `${k} ${AXES[x.length][i]}`, src, () => (T[k] as number[])[i], v => { (T[k] as number[])[i] = v; }, r, SCENE_NOTES[`${name}.${k}`])));
    }
  }
  return out;
}
/** the float constants of a shader's text whose names match, as rows: a move sets an override (none when it is back at the text's own value) */
function consts(text: string, pick: RegExp, src: string, rows: Rows = {}): TweakVar[] {
  const out: TweakVar[] = [];
  for (const c of shaderConsts(text, pick)) {
    const short = c.name.replace(pick, m => m.endsWith('_') ? '' : m).toLowerCase().replace(/_/g, ' ') || c.name.toLowerCase();
    c.value.forEach((_, i) => {
      const get = () => (SHADER_TUNE.get(c.name) ?? c.value)[i];
      const set = (v: number) => { const a = [...(SHADER_TUNE.get(c.name) ?? c.value)]; a[i] = v; if (a.every((x, j) => Math.abs(x - c.value[j]) < 1e-9)) SHADER_TUNE.delete(c.name); else SHADER_TUNE.set(c.name, a); };
      const one = c.value.length === 1;
      out.push(mk(one ? c.name : `${c.name}[${i}]`, one ? short : `${short} ${AXES[c.value.length][i]}`, src, get, set, { when: 'build', ...rows[c.name] }, HAND[c.name] ?? (c.note || undefined)));
    });
  }
  return out;
}
/** these rows are read only while `live()` holds: dimmed otherwise */
function readWhen(vars: TweakVar[], ids: readonly string[], live: () => boolean) {
  for (const id of ids) { const v = vars.find(x => x.id === id); if (!v) throw new Error(`scene layers: no row ${id} to dim (renamed in its table?)`); v.idle = () => !live(); }
}
/** a switch the page reads when it opens: flipping it reloads with (off) or without (on) its URL word */
function urlSwitch(get: () => boolean, word: string): TweakSwitch {
  return { reloads: true, get, set: on => { const q = new URLSearchParams(location.search); if (on) q.delete(word); else q.set(word, '0'); location.search = '?' + q.toString().replace(/=(?=&|$)/g, ''); } };
}

export function sceneLayers(engine: Engine, game: Game): TweakLayer[] {
  const S = engine.settings, P = engine.passes, tune = game.tune as unknown as Record<string, number>, W = game.weather;
  const layers: TweakLayer[] = [];
  const flagSwitch = (bit: number): TweakSwitch => ({ get: () => (S.flags & bit) !== 0, set: on => { S.flags = on ? S.flags | bit : S.flags & ~bit; } });
  const setting = (k: keyof typeof S & string, label: string, r: Row = {}) => mk(`settings.${k}`, label, 'src/settings.ts', () => S[k] as number, v => { (S as unknown as Record<string, number>)[k] = v; }, r, SCENE_NOTES[`S.${k}`]);

  // ---- a shader's constants: the program's owner rebuilds it from the text as it now stands, one at a time, and skips a text it already runs (so a move of
  //      one of the layer's plain numbers costs nothing, and nothing is ever built while the constants stand as the file has them)
  const compText = compositeText(), partText = particleTexts();
  const COMP = 'src/render/shaders/composite.wgsl', PART = 'src/render/shaders/particles.wgsl + particles_common.wgsl';
  const comp = (pick: RegExp, rows?: Rows) => consts(compText, pick, COMP, rows);
  const part = (pick: RegExp, rows?: Rows) => [...consts(partText.sim, pick, PART, rows), ...consts(partText.common, pick, PART, rows)];
  const rebuildComp = () => P.retuneComposite();
  const rebuildPart = () => engine.particles ? engine.particles.retune() : Promise.resolve({ ok: false, messages: ['no particles on this page'] });

  // ================================================================ LIGHT
  { // the sky's own light and the moon: the hour and the weather set both (a new colour each time they do; a row reads and writes whichever stands)
    const moon = () => engine.lights.lights.find(x => x.name === 'moon');
    const sky = (k: 'skyZenith' | 'skyHorizon', name: string) => [0, 1, 2].map(i => mk(`settings.${k}[${i}]`, `${name} ${AXES[3][i]}`, 'the level\'s hour (game/hours.ts) and its weather', () => S[k][i],
      v => { const c = [...S[k]] as [number, number, number]; c[i] = v; S[k] = c; }, { play: true }, name === 'overhead' ? 'the sky\'s light straight overhead, as the hour and the weather last set it' : 'the sky\'s light at the horizon'));
    const vars = [...sky('skyZenith', 'overhead'), ...sky('skyHorizon', 'horizon')];
    if (moon()) vars.push(mk('moon.intensity', 'moonlight', 'the level file\'s moon', () => moon()?.intensity ?? 0, v => { const m = moon(); if (m) m.intensity = v; }, { min: 0, max: 4, step: 0.05, play: true }, 'the level\'s moon: one directional light'));
    layers.push({ id: 'sky', name: 'Sky and moon', group: 'Light', vars, on: { ...muting(vars, vars.map(v => v.id)), play: true } });
  }
  layers.push({ id: 'lamps', name: 'Lamps', group: 'Light', vars: [setting('emissiveScale', 'lamps ×', { min: 0, max: 4, step: 0.05, play: true })], stat: () => `${engine.lights.activeCount} lights` });
  { const vars = [
      mk('tune.flashIntensity', 'squad torches', 'src/game/game.ts tune', () => tune.flashIntensity, v => { tune.flashIntensity = v; }, { min: 0, max: 300, step: 5, play: true }, 'every carried torch and every unit\'s weapon light'),
      mk('tune.playerLight', 'your light', 'src/game/game.ts tune', () => tune.playerLight, v => { tune.playerLight = v; }, { min: 0, max: 300, step: 5, play: true }, 'your own rail light'),
      mk('tune.flashOuter', 'cone outer °', 'src/game/game.ts tune', () => tune.flashOuter, v => { tune.flashOuter = v; tune.flashInner = Math.min(tune.flashInner, v - 2); }, { min: 8, max: 45, step: 1, play: true }),
      mk('tune.flashInner', 'cone inner °', 'src/game/game.ts tune', () => tune.flashInner, v => { tune.flashInner = Math.min(v, tune.flashOuter - 2); }, { min: 1, max: 30, step: 1, play: true }),
      setting('flashlightRadius', 'bezel radius', { min: 0.005, max: 0.1, step: 0.005, play: true }) ];
    layers.push({ id: 'torch', name: 'Torches', group: 'Light', vars, on: { ...muting(vars, ['tune.flashIntensity', 'tune.playerLight']), play: true } }); }
  layers.push({ id: 'bounce', name: 'Bounce light', group: 'Light', on: flagSwitch(FrameFlags.Indirect), vars: [setting('indirectScale', 'bounce ×', { min: 0, max: 2, step: 0.05 })] });
  layers.push({ id: 'beams', name: 'Beams in the air', group: 'Light', on: flagSwitch(FrameFlags.Volumetrics), vars: [setting('hazeDensity', 'haze', { min: 0, max: 0.2, step: 0.002 })] });

  // ================================================================ GROUND (a snow level's lying snow: render/snowField.ts, shaders/snow.wgsl, composite.wgsl)
  // (the surface's own layers stand where there IS a surface; its switch, the flakes and the blown snow wherever the level is a snow level — a page reloaded
  //  with the surface off still has the row that brings it back)
  const snowy = snowLevel(levelNameOf(game.level)), lying = !!game.snowField;
  const oneAir = () => oneAirActive(game);   // (is the snow one snow in one air on the frame last stepped: the switch on AND a wind sim to ride)
  const grainsRun = () => !SNOW_LOOK.oneAir;   // (the grains stand down on the SWITCH, in force or not: snowFx.ts grainsOn)
  const relook = () => { if (game.snowField) engine.gbuffer.setSnowCfg(snowCfgRows(game.snowField, game.snowTracks ? TRACK_RES : 0)); };
  const SURF = 'src/render/snowField.ts';
  const glints = ['sparkle', 'sparkleShare', 'sparkleRough', 'sparkleLean'], prints = ['trackDeep', 'trackRim'];
  if (snowy) layers.push({ id: 'surface', name: 'Snow surface', group: 'Ground', on: urlSwitch(() => SNOW_LOOK.on, 'snowlook'), apply: relook,
      vars: !lying ? [] : table('SNOW_SURF', SNOW_SURF, SURF, { skip: [...glints, ...prints], rows: { fresh: { max: 1.5, step: 0.01 }, packed: { max: 1.5, step: 0.01 }, old: { max: 1.5, step: 0.01 }, rough: { max: 1, step: 0.01 }, hollowBlue: { max: 2, step: 0.02 } } }),
      stat: () => { const f = game.snowField; return f ? `${f.w} × ${f.h}` : ''; } });
  if (lying) {
    { const vars = [...table('SNOW_SURF', SNOW_SURF, SURF, { only: glints, rows: { sparkle: { max: 5, step: 0.05 }, sparkleShare: { max: 0.5, step: 0.005 }, sparkleRough: { max: 1, step: 0.01 } } }),
        ...(SNOW_LOOK.sparkle ? comp(/^SNOW_SPARKLE_/, { SNOW_SPARKLE_COS0: { min: 0.98, max: 1, step: 0.00005 }, SNOW_SPARKLE_COS1: { min: 0.98, max: 1, step: 0.00005 }, SNOW_SPARKLE_GAIN: { max: 20, step: 0.1 }, SNOW_SPARKLE_SHARE: { max: 1, step: 0.01 }, SNOW_SPARKLE_FAR: { max: 80, step: 1 }, SNOW_SPARKLE_ROUGH: { max: 1, step: 0.01 } }) : [])];
      layers.push({ id: 'sparkle', name: 'Sparkle', group: 'Ground', vars, on: muting(vars, SNOW_LOOK.sparkle ? ['SNOW_SURF.sparkle', 'SNOW_SPARKLE_GAIN'] : ['SNOW_SURF.sparkle']), apply: relook, build: SNOW_LOOK.sparkle ? rebuildComp : undefined }); }
    if (SNOW_LOOK.glow) { const vars = comp(/^SNOW_GLOW_/, { SNOW_GLOW_GAIN: { max: 1, step: 0.01 }, SNOW_GLOW_WRAP: { max: 1, step: 0.01 }, SNOW_GLOW_TINT: { max: 1.5, step: 0.01 }, SNOW_GLOW_SHADE: { max: 1.5, step: 0.01 }, SNOW_GLOW_WHITEN: { max: 1, step: 0.01 } });
      layers.push({ id: 'glow', name: 'Glow through snow', group: 'Ground', vars, on: muting(vars, ['SNOW_GLOW_GAIN']), build: rebuildComp }); }
    if (SNOW_LOOK.tracks) { const vars = [...table('SNOW_SURF', SNOW_SURF, SURF, { only: prints, rows: { trackDeep: { max: 0.3, step: 0.002 }, trackRim: { max: 0.1, step: 0.001 } } }),
        ...table('SNOWTRACKS', SNOWTRACKS, 'src/game/snowTracks.ts', { when: 'next', rows: { mess: { max: 1, step: 0.01 }, puff: { step: 1 }, puffMost: { step: 1 }, puffRecs: { step: 1, max: 12 }, puffWait: { step: 1 } } })];
      layers.push({ id: 'prints', name: 'Boot prints', group: 'Ground', vars, on: muting(vars, ['SNOW_SURF.trackDeep', 'SNOW_SURF.trackRim']), apply: relook,
        stat: () => { const T = game.snowTracks; return T ? `${T.prints} prints` : ''; } }); }
    if (SNOW_LOOK.tracks) { const vars = table('SNOWMARKS', SNOWMARKS, 'src/game/snowMarks.ts', { when: 'next', rows: { mess: { max: 1, step: 0.01 }, itemMess: { max: 1, step: 0.01 }, rollDeep: { max: 1, step: 0.01 } } });
      layers.push({ id: 'marks', name: 'Things mark the snow', group: 'Ground', vars, on: { mode: true, get: () => SNOW_LOOK.marks, set: on => { SNOW_LOOK.marks = on; } },
        stat: () => { const T = game.snowTracks; return T ? `${T.marks} marks${T.forming.length ? ` · ${T.forming.length} forming` : ''}` : ''; } }); }
    { const vars = table('SNOWBLAST', SNOWBLAST, 'src/game/snowBlast.ts', { when: 'next', rows: { floor: { min: 0.6, max: 1, step: 0.01 }, rim: { min: 0.25 }, lobe: { max: 1 }, rag: { max: 0.5, step: 0.005 }, rays: { step: 1, max: 40 }, clods: { step: 1, max: 200 }, puff: { step: 1, max: 100 }, flakes: { step: 1, max: 600 }, dig: { max: 3, step: 0.05 }, digS: { max: 5, step: 0.1 }, throwShare: { max: 0.98, step: 0.01 } } });
      readWhen(vars, ['SNOWBLAST.throwS', 'SNOWBLAST.throwShare', 'SNOWBLAST.out', 'SNOWBLAST.up'], grainsRun);
      readWhen(vars, ['SNOWBLAST.flakes', 'SNOWBLAST.flakeUp', 'SNOWBLAST.flakeLife'], oneAir);
      // (the switch is read by every blast as it goes off: live, so the layer stands on a page opened with it off too. The button marks the snow three metres ahead of you as a frag there would — no blast, no sound, nothing the game reads)
      layers.push({ id: 'blast', name: 'Blast marks', group: 'Ground', vars, on: { get: () => SNOW_LOOK.blast, set: on => { SNOW_LOOK.blast = on; } },
        act: { label: 'blast', note: 'mark the snow three metres ahead of you as a grenade there would (picture only: no blast, no sound)', run: () => { const c = game.player.char; snowBlastAt(game, [c.pos[0] + Math.sin(c.aimYaw) * 3, 0.2, c.pos[2] + Math.cos(c.aimYaw) * 3], 2.5); } },
        stat: () => { const s = snowBlastStats(game); return s.blasts ? `${s.marked} of ${s.blasts} marked${s.why !== 'marked' ? ` · ${s.why}` : ''}` : ''; } }); }
  }

  // ================================================================ AIR
  const FX = 'src/game/snowFx.ts';
  if (snowy) {
    { const vars = [
        mk('weather.snowRate', 'snowfall', 'src/game/weatherKinds.ts WEATHER_PRESETS.snow', () => W.snowRate, v => { W.snowRate = v; }, { min: 0.01, max: 2, step: 0.01 }, 'how hard it snows (the weather\'s own number: 1 = SNOWFX.perM2 flakes over a square metre). The flakes alone thin with it; it stops short of none, where the game stands the wisps, grains and all of the snow down with it (snowFx.ts snowing) — the layer\'s switch is the way to see the scene without flakes'),
        ...table('SNOWFX', SNOWFX, FX, { rows: { size: { when: 'next' }, sizeJit: { when: 'next', max: 1 }, shutter: { max: 0.1, step: 0.0005 }, minPx: { max: 4, step: 0.05 }, maxPx: { max: 12, step: 0.1 }, iso: { max: 1 }, fwdK: { max: 1 }, fwdG: { max: 0.99 }, brightJit: { max: 1 }, sheetAmp: { max: 0.95 }, skid: { max: 1, step: 0.01 }, perM2: { step: 0.1 }, past: { max: 30, step: 0.5 } } }),
        ...part(/^FLAKE_/, { FLAKE_WALL_IN: { max: 0.5, step: 0.01 }, FLAKE_TOP_IN: { max: 1.5, step: 0.05 } }),
      ];
      readWhen(vars, ['SNOWFX.airLow', 'SNOWFX.airHigh', 'SNOWFX.airLift', 'SNOWFX.skid'], oneAir);
      readWhen(vars, ['FLAKE_TOP_IN'], () => snowLookConfig.under);   // (the shaders this page compiled: nothing reads the row with ?snowunder=0)
      readWhen(vars, ['SNOWFX.past'], () => SNOW_LOOK.past);   // (the snow past the level's rim: nothing reads the metres with ?snowpast=0)
      layers.push({ id: 'flakes', name: 'Falling flakes', group: 'Air', vars, on: muting(vars, ['SNOWFX.gain', 'SNOWFX.skyK']), build: rebuildPart, stat: () => { const s = snowStats(game); return s.active ? `${Math.round(s.pop)} in the air` : s.why; } }); }
    // (ONE SNOW IN ONE AIR: read every frame, so its switch is live — but only on a page whose particle shaders were built to read the wind sim)
    if (AIR_SIM.on && (SNOW_LOOK.oneAir || SNOW_LOOK.grains)) layers.push({ id: 'oneair', name: 'Snow in one air', group: 'Air', vars: [], on: { mode: true, get: () => SNOW_LOOK.oneAir, set: on => { SNOW_LOOK.oneAir = on; } },
      stat: () => oneAir() ? 'flakes and wisps ride the wind sim' : SNOW_LOOK.oneAir ? 'not in force' : 'flakes on the open wind' });
    if (SNOW_LOOK.wisps) { const live = { speedK: {}, opacity: { max: 1, step: 0.01 }, gain: {} } as Rows;
      const vars = [...table('SNOWWISPS', SNOWWISPS, FX, { when: 'next', rows: { speedK: { when: undefined, ...live.speedK }, opacity: { when: undefined, ...live.opacity }, gain: { when: undefined, ...live.gain }, lifeJit: { max: 1 }, sizeJit: { max: 1 },
        motes: { max: 1, step: 0.01 }, sparkle: { max: 1, step: 0.01 },
        liftLo: { when: undefined, max: 2, step: 0.01 }, liftHi: { when: undefined, max: 2, step: 0.01 }, dropK: { when: undefined, max: 1, step: 0.01 } } }), ...part(/^WISP_/)];
      readWhen(vars, ['SNOWWISPS.speedK', 'SNOWWISPS.gustLen', 'SNOWWISPS.gustPow'], () => !oneAir());
      readWhen(vars, ['SNOWWISPS.liftLo', 'SNOWWISPS.liftHi', 'SNOWWISPS.dropK'], oneAir);
      layers.push({ id: 'wisps', name: 'Blown wisps', group: 'Air', vars, on: muting(vars, ['SNOWWISPS.opacity']), build: rebuildPart, stat: () => { const s = wispStats(game); return s.active ? `aim ${Math.round(s.target)}` : s.why; } }); }
    if (SNOW_LOOK.grains) { const vars = [...table('SNOWGRAINS', SNOWGRAINS, FX, { rows: { max: { when: 'next', max: 6000, step: 50 }, size: { when: 'next' }, sizeJit: { when: 'next', max: 1 }, opacity: { max: 2, step: 0.01 }, wispsKeep: { max: 1 }, radius: { max: 30, step: 0.5 }, tail: { max: 1, step: 0.01 }, dash: { max: 15, step: 0.1 } } }), ...part(/^GRAIN_/)];
      layers.push({ id: 'grains', name: 'Blown grains', group: 'Air', vars, on: muting(vars, ['SNOWGRAINS.opacity']), build: rebuildPart, idle: () => SNOW_LOOK.oneAir, stat: () => { const s = grainStats(game); return s.active ? `${Math.round(s.pop)} · air ${s.u0.toFixed(2)} m/s` : s.why; } }); }
    if (SNOW_LOOK.breath) { const vars = table('SNOWBREATH', SNOWBREATH, 'src/game/snowBreath.ts', { when: 'next', rows: { opacity: { max: 2, step: 0.01 }, pitch: { min: -1, max: 1, step: 0.01 }, color: { max: 1.5, step: 0.01 }, puffs: { step: 1, max: 8 }, count: { step: 1, max: 20 } } });
      // (a blown man: with the hard breath rule on the steam reads the rule's own numbers, off the breath table's four — both are rows, the unread ones dimmed)
      vars.push(...table('HARDBREATH', HARDBREATH, 'src/game/character.ts', { only: BREATH_HARD, when: 'next', rows: { every: { label: 'blown every', max: 3, step: 0.01 }, puffs: { label: 'blown puffs', step: 1, max: 8 }, count: { label: 'blown count', step: 1, max: 20 },
        jet: { label: 'blown jet', max: 10, step: 0.05 }, size: { label: 'blown size', max: 5, step: 0.05 }, carry: { label: 'blown carry', max: 1, step: 0.01 }, up: { label: 'blown in', max: 10, step: 0.1 }, down: { label: 'wind back in', max: 60, step: 0.5 } } }));
      readWhen(vars, BREATH_SOFT.map(k => `SNOWBREATH.${k}`), () => !HARDBREATH.on); readWhen(vars, BREATH_HARD.map(k => `HARDBREATH.${k}`), () => HARDBREATH.on);
      // (the breath as gas in the smoke solver: its own rows, and the puffs' rows that nothing reads while a man steams are dimmed — past `reach` he still breathes puffs, so with a reach set they stay lit)
      if (SNOW_LOOK.steam) { vars.push(...table('BREATHSTEAM', BREATHSTEAM, 'src/game/snowBreath.ts', { when: 'next', rows: { radius: { label: 'steam radius', max: 0.15, step: 0.001 }, cells: { label: 'steam cells', max: 4, step: 0.1 }, density: { label: 'steam density', max: 30, step: 0.5 }, temp: { label: 'steam heat', max: 40, step: 0.5 },
        speed: { label: 'steam speed', max: 4, step: 0.05 }, push: { label: 'steam push', max: 90, step: 1 }, expand: { label: 'steam opens', max: 24, step: 0.5 }, attack: { label: 'steam attack', max: 0.5, step: 0.01 }, jitter: { label: 'steam jitter', max: 1, step: 0.01 }, carryK: { label: 'steam carry', max: 2, step: 0.05 },
        wake: { label: 'head wake', max: 0.5, step: 0.01 }, reach: { label: 'steam reach', max: 60, step: 1 } } }));
        readWhen(vars, BREATH_PUFF.map(k => `SNOWBREATH.${k}`), () => !(steamOn(game) && BREATHSTEAM.reach <= 0)); readWhen(vars, ['HARDBREATH.puffs', 'HARDBREATH.count'], () => HARDBREATH.on && !(steamOn(game) && BREATHSTEAM.reach <= 0));
        readWhen(vars, Object.keys(BREATHSTEAM).map(k => `BREATHSTEAM.${k}`), () => steamOn(game)); }
      layers.push({ id: 'breath', name: 'Breath', group: 'Air', vars, on: muting(vars, SNOW_LOOK.steam ? ['SNOWBREATH.opacity', 'BREATHSTEAM.density'] : ['SNOWBREATH.opacity']), stat: () => { const s = breathStats(game); return s.active ? `${s.shown} of ${s.men} men steaming` : s.why; } }); }
  }
  if (AIR_SIM.on) layers.push({ id: 'air', name: 'Wind sim', group: 'Air', on: { mode: true, get: () => S.airSim, set: on => { S.airSim = on; } },
    vars: [...table('AIR', AIR, 'src/render/airField.ts', { rows: { iterations: { min: 1, max: 40, step: 1 }, sor: { min: 1, max: 1.95, step: 0.01 }, follow: { max: 1, step: 0.01 }, seed: { min: 1, max: 20, step: 1 } } }),
      ...table('AIR_SIM', AIR_SIM, 'src/game/airSim.ts', { skip: ['minTop', 'maxFoot', 'glassOpen', 'leafStep'] }), setting('airEvery', 'step every', { min: 1, max: 4, step: 1 })],
    stat: () => { const s = airSimStats(game); const ms = engine.timer.results.get('air'); return s.active ? `${s.speed.toFixed(2)} m/s${ms !== undefined ? ` · ${ms.toFixed(2)} ms` : ''}` : s.why; } });
  layers.push({ id: 'storm', name: 'Storm wind', group: 'Air', vars: [
    mk('weather.wind[0]', 'wind x m/s', 'src/game/weatherKinds.ts WEATHER_PRESETS', () => W.wind[0], v => { W.wind[0] = v; }, { min: -4, max: 4, step: 0.05, play: true }, 'the weather\'s wind vector: flakes, blown snow, dust and smoke outdoors all ride it'),
    mk('weather.wind[1]', 'wind z m/s', 'src/game/weatherKinds.ts WEATHER_PRESETS', () => W.wind[1], v => { W.wind[1] = v; }, { min: -4, max: 4, step: 0.05, play: true }),
    ...table('WIND', WIND, 'src/game/wind.ts', { only: ['stormK', 'stormGustAmp', 'stormGustPeriod'], rows: { stormK: { max: 3, step: 0.05, play: true }, stormGustAmp: { max: 0.95, step: 0.01, play: true }, stormGustPeriod: { min: 0.5, max: 10, step: 0.1, play: true } } }) ],
    stat: () => `${Math.hypot(W.wind[0], W.wind[1]).toFixed(2)} m/s` });

  // ================================================================ LENS (what is done to the finished picture)
  // (the fog's SHADE only: the fog itself is a rule of the game — what the reticle snaps to, what can be worked — and its switch stays on the debugger)
  layers.push({ id: 'fog', name: 'Fog of war shade', group: 'Lens',
    vars: table('FOG', FOG, 'src/game/fogofwar.ts', { only: ['dim', 'desat'], rows: { dim: { max: 1, step: 0.01 }, desat: { max: 1, step: 0.01 } } }) });
  { const vars = [mk('passes.bloom', 'bloom', 'src/render/passes.ts', () => P.bloom, v => { P.bloom = v; }, { min: 0, max: 0.3, step: 0.005 }, 'share of the blurred picture added back before the tone curve')];
    layers.push({ id: 'bloom', name: 'Bloom', group: 'Lens', vars, on: muting(vars, ['passes.bloom']) }); }
  { const vars = [mk('passes.grain', 'film grain', 'src/render/passes.ts', () => P.grain, v => { P.grain = v; }, { min: 0, max: 0.1, step: 0.002 }, 'display-space grain, faded out of highlights')];
    layers.push({ id: 'grain', name: 'Film grain', group: 'Lens', vars, on: muting(vars, ['passes.grain']) }); }
  layers.push({ id: 'tone', name: 'Exposure and tone', group: 'Lens', vars: [
    setting('exposure', 'exposure', { min: 0.2, max: 8, step: 0.05 }),
    mk('passes.saturation', 'saturation', 'src/render/passes.ts', () => P.saturation, v => { P.saturation = v; }, { min: 0.6, max: 1.6, step: 0.01 }, '1 = the plain tone curve (rather grey)') ] });
  for (const L of layers) { L.note = ABOUT[L.id]; if (L.on) L.on.def = L.on.get(); }   // (how each switch stands as the scene opens: what `reset` goes back to, and what is not a change)
  return layers;
}
