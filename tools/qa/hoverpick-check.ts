// THE CURSOR'S PICK, READ FOR THE PICTURE, WRITES NOTHING OF THE GAME'S (src/game/orders.ts hover, HoverKept.pick; src/scene/collision.ts Collision.aside;
// src/scene/boxes.ts BoxWorld.rayAside; src/game/workthings.ts askAside). What the cursor is on is asked by the page every frame for the HUD's lines and
// the ring's hint. The answer is kept in the asker's store; the PICK under it cast its rays on the game's own tables (the world's ray grid stamps, the
// collision's query stamps) and remade the kept list of things to be worked, so a game whose cursor is read and the same game never read differed in
// whole state (run digest equal). A squad mission on the office, the cursor carried about for six seconds (round Sam, onto a teammate, onto a door):
//   ask       ONE game: the state is hashed before each read (with the store, and with none) and after it, and the module variables looked at —
//             never a difference, and the cursor was on the floor, a teammate and a door.
//   state     two games of one seed, one read every frame and one never: the same whole state and the same run digest.
//   same      the pick asked aside is the pick asked straight: the same kind of target at the same place, on every frame.
// HOVERPICK_BREAK=1 = the read asks the pick the old way (targetUnder straight on the game's tables): `ask` and `state` must FAIL.   exit 0 = all hold · 1 = one does not
// NOT HELD HERE: the HUD's own row list (SquadOrders.hud) — on the shipped stand it still fills a memo of the wall charge's (wallcharge.ts standIns).
import { ROOT } from './headless.ts';
import { rig } from './squadthrow-check.ts';

const OR: any = await import(`${ROOT}/src/game/orders.ts`);
const RB: any = await import(`${ROOT}/src/game/rollback.ts`);
const DG: any = await import(`${ROOT}/src/game/digest.ts`);
const SD: any = await import(`${ROOT}/src/math/side.ts`);
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }

export async function hoverpickCheck(): Promise<boolean> {
  const BREAK = process.env.HOVERPICK_BREAK === '1', SEED = 11, FRAMES = 360; let all = true; const rnd = Math.random;
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== hoverpick: the cursor's pick, read for the picture, writes nothing of the game's${BREAK ? ' (HOVERPICK_BREAK: asked the old way)' : ''} ===`);
  try {
    /** six seconds with the cursor carried about; `read`: what is asked each frame (null: nothing) */
    const run = async (read: ((R: any, kept: any) => any) | null, each?: (R: any, f: number, ask: () => any) => void) => {
      const R: any = await quiet(() => rig(SEED, true, {})), g = R.game, s = [...g.player.char.pos], kept = OR.hoverStore();
      // a point of the screen that is a door, for each of two doors (the doors here are far from Sam: found by trying a few points of each doorway, the same way in every run)
      const doors: number[][] = [], near = [...g.doors.list].sort((a: any, b: any) => Math.hypot(a.frameCentre[0] - s[0], a.frameCentre[2] - s[2]) - Math.hypot(b.frameCentre[0] - s[0], b.frameCentre[2] - s[2]));
      for (const d of near) { if (doors.length >= 2) break; const c = d.frameCentre, th = d.def.closedDir;
        for (const [y, k] of [[1, -0.6], [1, 0.6], [1, 0], [0.04, 0], [0.04, 0.6], [0.04, -0.6]]) { const q = [c[0] - Math.sin(th) * k, y, c[2] + Math.cos(th) * k]; R.cursor(q); const t = R.O.hover(); if (t?.kind === 'door' && t.door === d) { doors.push(q); break; } } }
      for (let f = 0; f < FRAMES; f++) {
        if (f % 8 === 0) {   // (round Sam, then on a teammate, then on the nearest door, in turn)
          const a = f / 24, leg = Math.floor(f / 40) % 3, m = R.team[Math.floor(f / 120) % R.team.length], d = doors[Math.floor(f / 120) % doors.length];
          R.cursor(leg === 1 && m ? [m.char.pos[0], 1, m.char.pos[2]] : leg === 2 && d ? d : [s[0] + Math.sin(a) * (1.5 + (f % 80) / 20), 0.04, s[2] + Math.cos(a) * (1.5 + (f % 80) / 20)]);
        }
        R.step();
        if (read) { const ask = () => read(R, kept); if (each) each(R, f, ask); else ask(); }
      }
      return { R, hash: RB.stateHash(g, true, true) as string, dig: DG.hashDigest(DG.digestGame(g, true)) as string };
    };
    const old = (R: any) => { const v = R.O.view; return v.input && v.cam && v.canvas ? R.O.targetUnder(v.input, v.cam, v.canvas) : null; };
    const page = (R: any, kept: any) => { if (BREAK) return old(R); const t = R.O.hover(kept); R.O.hover(); return t; };   // (as the HUD's lines and the ring's hint ask it, and with no store)

    // ask: the state before each read against the state after it
    let wrote = 0, vars = 0, on = 0, what = ''; const names = new Set<string>(), kinds = new Map<string, number>(), V = SD.sideRegistry().vars;
    const one = await run(page, (R, f, ask) => {
      const g = R.game, h0 = RB.stateHash(g, true, true) as string, v0 = V.map((v: any) => v.get()), f0 = f % 8 === 0 ? RB.stateFlat(g, true, true) : null;
      const t = ask(); if (t) { on++; const k = t.man ? 'man' : t.kind; kinds.set(k, (kinds.get(k) ?? 0) + 1); }
      if (RB.stateHash(g, true, true) !== h0) { wrote++; if (f0 && !what) what = (RB.flatDiff(f0, RB.stateFlat(g, true, true), 3) as string[]).map(l => l.split(': ')[0]).join(', '); }
      V.forEach((v: any, k: number) => { if (v.get() !== v0[k]) { vars++; names.add(v.name); } });
    });
    verdict(wrote === 0 && vars === 0 && on >= FRAMES - 10 && ['floor', 'man', 'door'].every(k => (kinds.get(k) ?? 0) >= 10), 'ask: no read of what the cursor is on changes the game\'s state or a module variable, and the cursor was on the floor, on a teammate and on a door',
      `the read changed the game's state on ${wrote} of ${FRAMES} frames${what ? ` (${what})` : ''}, a module variable on ${vars}${names.size ? ` (${[...names].join(', ')})` : ''} · an answer on ${on} · ${[...kinds].map(([k, n]) => `${k} ${n}`).join(', ')}`);

    // state: read every frame against never read
    const never = await run(null), diff = one.hash === never.hash ? '' : ' · ' + [...new Set((RB.stateDiff(one.R.game, never.R.game, 4000, true) as string[]).map(l => l.split(': ')[0].replace(/\[\d+\]/g, '[]')))].slice(0, 6).join(', ');
    verdict(one.hash === never.hash && one.dig === never.dig, 'state: a game whose cursor is read every frame and the same game never read hold the same whole state and the same run digest',
      `state ${one.hash === never.hash ? 'equal' : 'DIFFERS'}, digest ${one.dig === never.dig ? 'equal' : 'DIFFERS'}${diff}`);

    // same: the pick aside is the pick straight
    let differ = 0, asked = 0, first = '';
    const key = (t: any) => t ? `${t.kind} (${t.at[0].toFixed(2)}, ${t.at[2].toFixed(2)})${t.door ? ' door' : ''}${t.man ? ' ' + t.man.callsign : ''}${t.foe ? ' foe' : ''}` : 'none';
    await run((R: any) => { const a = key(R.O.hover()), b = key(old(R)); asked++; if (a !== b) { differ++; first ||= `${a} against ${b}`; } return null; });
    verdict(differ === 0 && asked === FRAMES, 'same: the pick asked aside is the pick asked straight, on every frame', `${differ} of ${asked} frames differ${first ? ` (${first})` : ''}`);
  } finally { Math.random = rnd; }
  console.log(`\n=== hoverpick: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all;
}
if (import.meta.main) process.exit(await hoverpickCheck() ? 0 : 1);
