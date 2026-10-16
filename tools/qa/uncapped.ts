// MEN PAST THE RENDERER'S CAPS — HEADLESS ONLY. The game refuses a 17th character (guards.ts spawnUnit: the skinning's sixteen) and a 65th steady light because a
// real renderer could not draw them. A harness draws nothing, so to MEASURE what the simulation costs with 24 or 32 enemies (tools/qa/enemy-ceiling.ts,
// playthrough.ts PT_EXTRA) it stands men past both. Two halves:
//   uncap(W)        the skinning's staging arrays re-made four times the size, so Game.update's per-character copy (anim/characters.ts setInstance — a RangeError
//                   at the 17th drawn man) still runs, and still costs what it costs, for up to 64
//   spawnPast(g, o) guards.ts spawnUnit's own body without its three budget checks (characters, steady lights, both a renderer's) — the same Guard, the same
//                   weapon light record, the same one-point route. The light set uploads its first 64 and skips the rest, as it always did.
// Never import this from src/: a page that stood a 17th drawn man would throw every frame.
import { ROOT } from './headless.ts';
const { Guard } = await import(`${ROOT}/src/game/game.ts`);
const { torchLightDef } = await import(`${ROOT}/src/game/rigProps.ts`);

const TINT: Record<string, [number, number, number]> = { guard: [0.42, 0.36, 0.25], operative: [0.07, 0.09, 0.1], hostile: [0.36, 0.33, 0.24] };
const TINT2: Record<string, [number, number, number]> = { guard: [0.02, 0.02, 0.025], operative: [0.05, 0.07, 0.06], hostile: [0.09, 0.08, 0.05] };

export function uncap(W: any) {
  const C = W.game.chars;
  for (const k of ['instData', 'jointStaging']) { if (!(C[k] instanceof Float32Array)) throw new Error(`uncap: CharacterRenderer.${k} is not what it was`); C[k] = new Float32Array(C[k].length * 4); }
  C.instU32 = new Uint32Array(C.instData.buffer);
}

export function spawnPast(g: any, o: any): any {
  const used = new Set<number>([g.player.char.id, ...g.guards.map((x: any) => x.char.id)]);
  let id = 20; while (used.has(id)) id++;
  if (id > 250) throw new Error('spawnPast: no character id left in the owner byte');
  const name = o.name ?? `${o.team}-${id}`;
  const weapon = o.weapon ?? (o.team === 'operative' ? 'fn2000' : o.team === 'hostile' ? 'aks74u' : 'guard9mm');
  const route = { name, points: [[o.pos[0], 0, o.pos[2]]], wait: [0], weapon, keys: [] };
  const T = g.tune; const fl = g.engine.lights.add(torchLightDef(`unitlight${id}`, id, T.flashIntensity, T.flashInner, T.flashOuter));
  const gd = new Guard(g.ch, id, route, -1, fl, o.tint ?? TINT[o.team], { tint2: o.tint2 ?? TINT2[o.team], yaw: o.yaw ?? 0, name, team: o.team });
  gd.unit = { name, spawnedAt: g.time, light: o.light !== false }; if (o.pair) gd.unit.pair = o.pair; gd.hold = true;
  gd.heardUpTo = g.eventSeq;
  gd.char.update(0);
  g.guards.push(gd);
  return gd;
}
