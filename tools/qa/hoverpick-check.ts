// THE CURSOR'S PICK, READ FOR THE PICTURE, WRITES NOTHING OF THE GAME'S (src/game/orders.ts hover, HoverKept.pick; src/scene/collision.ts Collision.aside;
// src/scene/boxes.ts BoxWorld.rayAside; src/game/workthings.ts askAside; src/game/doors.ts Door.posAside; src/game/wallcharge.ts skyAside). What the
// cursor is on is asked by the page every frame for the HUD's lines and the ring's hint. The answer is kept in the asker's store; the PICK under it
// cast its rays on the game's own tables (the world's ray grid stamps, the collision's query stamps), remade the kept list of things to be worked,
// made a swung leaf's kept centre anew and added to the memo of sky faces, so a game whose cursor is read and the same game never read differed in
// whole state (run digest equal). A squad mission on the office, eight seconds, the cursor carried round Sam, onto a teammate, onto a door and (where
// the stand has outer walls to charge) onto a wall, moved AFTER the step so that the read comes before the simulation's own ask of the new point, a
// door swung twice on the way. The cursor's points are found on a game of their own, so the game "never read" is never read:
//   ask       ONE game: the state is hashed before each read (with the store, and with none) and after it, and the module variables looked at —
//             never a difference, with the cursor on each kind of thing and a leaf swinging under some of the reads.
//   state     two games of one seed, one read every frame and one never: the same whole state and the same run digest.
//   same      the pick asked aside ON THE KEPT STORE is the pick asked straight: the same target (kind, place, door and side, man, wall, thing),
//             on every frame.
// HOVERPICK_BREAK=1 = the read asks the pick the old way (targetUnder straight on the game's tables): `ask` and `state` must FAIL.   exit 0 = all hold · 1 = one does not
// THE HUD'S OWN ROW LIST (SquadOrders.hud) is read each frame beside the pick: its one writer, the wall charge's memo of digitless rows
// (wallcharge.ts standIns), is a module memo now, so the whole HUD read is held here, not the pick alone.
// NOT HELD HERE: a man of the other side under the cursor, a thing to be worked under it, a leaf drawn in the fog of war (none is on the cursor's way here).
import { ROOT } from './headless.ts';
import { rig } from './squadthrow-check.ts';

const OR: any = await import(`${ROOT}/src/game/orders.ts`);
const RB: any = await import(`${ROOT}/src/game/rollback.ts`);
const DG: any = await import(`${ROOT}/src/game/digest.ts`);
const SD: any = await import(`${ROOT}/src/math/side.ts`);
const WC: any = await import(`${ROOT}/src/game/wallcharge.ts`);
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }

export async function hoverpickCheck(): Promise<boolean> {
  const BREAK = process.env.HOVERPICK_BREAK === '1', SEED = 11, FRAMES = 480; let all = true; const rnd = Math.random;
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== hoverpick: the cursor's pick, read for the picture, writes nothing of the game's${BREAK ? ' (HOVERPICK_BREAK: asked the old way)' : ''} ===`);
  /** the rig, with the rule that only plan mode picks a part of the squad held off: these lines ask the cursor on a teammate as a man of his own, as the
   *  pick was built (wholesquad-check has that rule's lines) */
  const held = async () => { const R: any = await rig(SEED, true, {}); (await import(`${ROOT}/src/game/cmdring.ts`)).CMDRING.wholeSquad = false; return R; };
  try {
    // the cursor's points, found on a game of their own: a point of the screen that is a door, for each of two doors (the doors here are far from Sam: a
    // few points of each doorway are tried), the door to swing, and a point that is a wall a charge might go on (none where the stand has no such wall)
    const P = { doors: [] as number[][], swing: -1, wall: null as number[] | null, outer: false };
    { const R: any = await quiet(held), g = R.game, s = g.player.char.pos; R.step(); P.outer = !!(WC.WALLCHARGE.on && WC.WALLCHARGE.outer);
      const near = [...g.doors.list].sort((a: any, b: any) => Math.hypot(a.frameCentre[0] - s[0], a.frameCentre[2] - s[2]) - Math.hypot(b.frameCentre[0] - s[0], b.frameCentre[2] - s[2]));
      for (const d of near) { if (P.doors.length >= 2) break; const c = d.frameCentre, th = d.def.closedDir;
        for (const [y, k] of [[1, -0.6], [1, 0.6], [1, 0], [0.04, 0], [0.04, 0.6], [0.04, -0.6]]) { const q = [c[0] - Math.sin(th) * k, y, c[2] + Math.cos(th) * k]; R.cursor(q); const t = R.O.hover(); if (t?.kind === 'door' && t.door === d) { if (P.swing < 0 && !d.locked) P.swing = g.doors.list.indexOf(d); P.doors.push(q); break; } } }
      for (let r = 1; r <= 14 && !P.wall; r += 0.5) for (let a = 0; a < 16 && !P.wall; a++) { const q = [s[0] + Math.cos(a * Math.PI / 8) * r, 0.04, s[2] + Math.sin(a * Math.PI / 8) * r]; R.cursor(q); const t = R.O.hover(); if (t?.kind === 'floor' && t.wall) P.wall = q; }
    }
    Bun.gc(true);
    /** eight seconds with the cursor carried about and a door swung; `read`: what is asked each frame (null: nothing) */
    const run = async (read: ((R: any, kept: any) => any) | null, each?: (R: any, f: number, ask: () => any) => void) => {
      const R: any = await quiet(held), g = R.game, s = [...g.player.char.pos], kept = OR.hoverStore(), leaf = g.doors.list[P.swing]; let swung = 0;
      for (let f = 0; f < FRAMES; f++) {
        if (leaf && (f === 50 || f === 290)) g.doors.use(leaf, s, 0);   // (the leaf goes round, and comes back: the same in every run)
        const a0 = leaf?.angle; R.step(); if (leaf && leaf.angle !== a0) swung++;
        if (f % 6 === 0) {   // (round Sam, on a teammate, on a door, on a wall, in turn — after the step: the read below comes before the simulation has asked of the new point)
          const a = f / 24, leg = Math.floor(f / 30) % 4, m = R.team[Math.floor(f / 120) % R.team.length], d = P.doors[Math.floor(f / 120) % P.doors.length];
          R.cursor(leg === 1 && m ? [m.char.pos[0], 1, m.char.pos[2]] : leg === 2 && d ? d : leg === 3 && P.wall ? P.wall : [s[0] + Math.sin(a) * (1.5 + (f % 80) / 20), 0.04, s[2] + Math.cos(a) * (1.5 + (f % 80) / 20)]);
        }
        if (read) { const ask = () => read(R, kept); if (each) each(R, f, ask); else ask(); }
      }
      return { R, swung, hash: RB.stateHash(g, true, true) as string, dig: DG.hashDigest(DG.digestGame(g, true)) as string };
    };
    const old = (R: any) => { const v = R.O.view; return v.input && v.cam && v.canvas ? R.O.targetUnder(v.input, v.cam, v.canvas) : null; };
    const page = (R: any, kept: any) => { if (BREAK) return old(R); const t = R.O.hover(kept); R.O.hover(); R.O.hud(kept); return t; };   // (as the HUD's lines and the ring's hint ask it, with no store, and the HUD's whole row list after them)

    // ask: the state before each read against the state after it
    let wrote = 0, vars = 0, on = 0, what = ''; const names = new Set<string>(), kinds = new Map<string, number>(), V = SD.sideRegistry().vars;
    const one = await run(page, (R, f, ask) => {
      const g = R.game, h0 = RB.stateHash(g, true, true) as string, v0 = V.map((v: any) => v.get()), f0 = f % 6 === 0 && !what ? RB.stateFlat(g, true, true) : null;
      const t = ask(); if (t) { on++; const k = t.man ? 'man' : t.wall ? 'wall' : t.kind; kinds.set(k, (kinds.get(k) ?? 0) + 1); }
      if (RB.stateHash(g, true, true) !== h0) { wrote++; if (f0 && !what) what = (RB.flatDiff(f0, RB.stateFlat(g, true, true), 3) as string[]).map(l => l.split(': ')[0]).join(', '); }
      V.forEach((v: any, k: number) => { if (v.get() !== v0[k]) { vars++; names.add(v.name); } });
    });
    const want = ['floor', 'man', 'door', ...(P.outer ? ['wall'] : [])];
    verdict(wrote === 0 && vars === 0 && on >= FRAMES - 10 && want.every(k => (kinds.get(k) ?? 0) >= 10) && one.swung >= 10, `ask: no read of what the cursor is on, nor of the HUD's rows for it, changes the game's state or a module variable, with the cursor on ${want.join(', ')} and a leaf swinging`,
      `the read changed the game's state on ${wrote} of ${FRAMES} frames${what ? ` (${what})` : ''}, a module variable on ${vars}${names.size ? ` (${[...names].join(', ')})` : ''} · an answer on ${on} · ${[...kinds].map(([k, n]) => `${k} ${n}`).join(', ')} · the leaf moved on ${one.swung} frames${P.outer ? '' : ' · no outer walls to charge on this stand: no wall asked for'}`);

    // state: read every frame against never read
    const never = await run(null), diff = one.hash === never.hash ? '' : ' · ' + [...new Set((RB.stateDiff(one.R.game, never.R.game, 4000, true) as string[]).map(l => l.split(': ')[0].replace(/\[\d+\]/g, '[]')))].slice(0, 8).join(', ');
    verdict(one.hash === never.hash && one.dig === never.dig, 'state: a game whose cursor and HUD rows are read every frame and the same game never read hold the same whole state and the same run digest',
      `state ${one.hash === never.hash ? 'equal' : 'DIFFERS'}, digest ${one.dig === never.dig ? 'equal' : 'DIFFERS'}${diff}`);
    one.R = never.R = null; Bun.gc(true);

    // same: the pick aside, on the kept store, is the pick straight
    let differ = 0, asked = 0, first = '';
    const key = (R: any, t: any) => t ? `${t.kind} (${t.at[0].toFixed(3)}, ${t.at[2].toFixed(3)})${t.door ? ` door ${R.game.doors.list.indexOf(t.door)} side ${t.side}` : ''}${t.man ? ' ' + t.man.callsign : ''}${t.foe ? ' foe' : ''}${t.wall ? ` wall ${t.wall.index} ${t.wall.side} ${t.wall.u.toFixed(3)} ${t.wall.ok}` : ''}${t.thing ? ` thing ${t.thing.name}` : ''}` : 'none';
    await run((R: any, kept: any) => { kept.hov = null; const a = key(R, R.O.hover(kept)), b = key(R, old(R)); asked++; if (a !== b) { differ++; first ||= `${a} against ${b}`; } return null; });
    verdict(differ === 0 && asked === FRAMES, 'same: the pick asked aside on the kept store is the pick asked straight, on every frame', `${differ} of ${asked} frames differ${first ? ` (${first})` : ''}`);
  } finally { Math.random = rnd; }
  console.log(`\n=== hoverpick: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all;
}
if (import.meta.main) process.exit(await hoverpickCheck() ? 0 : 1);
