// Staging recipes for the cut-box cost measurement: two worst cases staged through the game's own code paths, usable headless (tools/qa/cut-cost-cpu.ts) and in the
// page (`const R = await import('/qa/cut-cost-recipes.js')`). Plain JS, no imports: everything is reached from the Game / engine objects.
//   step = a function that advances ONE frame. Headless: () => W.step(1/60). Page (no rendering): () => __game.update(1/60, __input, __cam, document.getElementById('view')).
//   Left out, the recipes build the page form themselves from window.__input / __cam.
// Boot-only switches (the recipes cannot raise them): the cut switch (on in the page; ?nocutboxes | localStorage twopointsix.cutboxes='0' = off), the destruction switch (page: on unless
// ?nodestruction; headless: DESTRUCTION.on = true before standUp), and the PICTURE of broken glass (?glassbreak: the GLASS_BREAK shader const; the simulation follows tune.glassBreak live).

export const PINS = {
  // { look, yaw, pitch, dist } for __stage(pin, …): radians; the eye sits at look + dist · (sin yaw · cos pitch, sin pitch, cos yaw · cos pitch)
  blast: { look: [19.4, 0.5, 11.1], yaw: 0.45, pitch: 0.8, dist: 8 },    // the corridor between x 15 and 24, seen from the south-east, 8 m
  glass: { look: [9.2, 0.4, 9.5], yaw: 0.35, pitch: 0.75, dist: 7 },     // the conference partition from the corridor side, the plates on the conference room floor behind it
};

function defaultStep(game) {
  const G = globalThis; const canvas = G.document?.getElementById?.('view') ?? G.document?.querySelector?.('canvas');
  return () => game.update(1 / 60, G.__input, G.__cam, canvas);
}

/** what the game would hand the renderer right now */
export function countScene(game, engine) {
  const D = game.destr.debris; const kinds = {}; for (const c of D.list) kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
  const statics = engine.world.statics, dyn = game.dynBoxes; const hist = {}; let planes = 0, planesS = 0, planesD = 0;
  const cutS = statics.filter(b => b.cut && b.cut.length > 0), cutD = dyn.filter(b => b.cut && b.cut.length > 0);
  for (const b of cutS) { hist[b.cut.length] = (hist[b.cut.length] ?? 0) + 1; planes += b.cut.length; planesS += b.cut.length; }
  for (const b of cutD) { hist[b.cut.length] = (hist[b.cut.length] ?? 0) + 1; planes += b.cut.length; planesD += b.cut.length; }
  const debrisBoxes = new Set(); for (const c of D.list) { debrisBoxes.add(c.box); }
  const pieceCut = D.list.filter(c => c.box.cut && c.box.cut.length > 0);
  let lo = 1 << 30, hi = -1; dyn.forEach((b, i) => { if (b.cut && b.cut.length > 0) { lo = Math.min(lo, i); hi = Math.max(hi, i); } });
  return {
    pieces: D.list.length, cap: D.cap(), moving: D.moving, kinds,
    piecesCut: pieceCut.length, piecePlanes: pieceCut.reduce((a, c) => a + c.box.cut.length, 0), glassPlates: D.list.filter(c => c.glass).length,
    statics: statics.length, staticsCut: cutS.length, staticPlanes: planesS,
    dynBoxes: dyn.length, dynCut: cutD.length, dynPlanes: planesD, dynCutNotInPool: cutD.filter(b => !debrisBoxes.has(b)).length,
    cutBoxes: cutS.length + cutD.length, planes, planesHist: hist,
    cutRowsDynRange: hi >= lo ? hi - lo + 1 : 0, cutBytesPerFrame: hi >= lo ? (hi - lo + 1) * 8 * 16 : 0,   // the dynamics' range of the cut table, re-sent every frame under the switch
    debrisStats: { ...D.stats },
  };
}

/** BLAST: breaching charges down the office corridor's two partitions (z 10 and z 12.2, x 15‥24) until the debris pool is full: the pieces thrown and heaped by the
 *  break table, the ragged ends on what still stands. Returns counts. */
export function stageBlast(game, engine, step) {
  step ??= defaultStep(game);
  const D = game.destr.debris;
  game.godMode = true; game.aiEnabled = false;      // nobody answers the noise
  game.tune.chaos = 0.5; game.tune.wallBreak = true; // run-time switches (the destruction switch and the cut switch are boot-only)
  for (let i = 0; i < 3; i++) step();
  // charges at the foot of a partition, 0.3 m off its face on the corridor side, alternating walls; the first is the room's own blast, the rest fill the pool
  const CHARGES = [[19.2, 0.3, 11.9], [21.6, 0.3, 10.3], [16.9, 0.3, 11.9], [23.6, 0.3, 10.3], [15.2, 0.3, 10.3], [21.4, 0.3, 11.9], [18.6, 0.3, 10.3], [13.0, 0.3, 11.9]];
  const blasts = []; let frames = 3, peak = 0, peakMoving = 0;
  const run = n => { for (let f = 0; f < n; f++) { step(); frames++; peak = Math.max(peak, D.list.length); peakMoving = Math.max(peakMoving, D.moving); } };
  for (const at of CHARGES) {
    if (D.list.length >= D.cap()) break;
    const r = game.destr.blast(at, { who: 0 });   // THE trigger: Destruction.blast → WallBreak.blast → the break table's pieces + bang()'s chaos (the Tab panel's 'charge at cursor' calls the same)
    run(90); blasts.push({ at, walls: r.walls, cover: r.cover, opened: r.opened, pool: D.list.length });
  }
  let settle = 0; while (settle < 600 && D.moving > 0) { step(); settle++; frames++; }
  run(2);
  return { case: 'blast', frames, settleFrames: settle, blasts, peak, peakMoving, full: D.list.length >= D.cap(), ...countScene(game, engine) };
}

/** GLASS: the conference partition (annealed float glass: the four sheets at z 10, x 6‥11.3, found by where they stand) shot out from the corridor, round robin across the four panes, until
 *  each is at least 70 % open (bounded): the plates on the conference room floor. Returns counts. (The lobby frontage is tempered: it dices into particles, no plates.) */
export function stageGlass(game, engine, step) {
  step ??= defaultStep(game);
  const D = game.destr.debris, gb = game.glassBreak;
  game.godMode = true; game.aiEnabled = false;
  game.tune.chaos = 0.5; game.tune.glassBreak = true; game.tune.glassShards = true;   // run-time for the SIMULATION (the picture of the holes is the boot const ?glassbreak)
  for (let i = 0; i < 3; i++) step();
  // (by place, never by index: a level export that adds a box moves every index after it — the door-size export of 10-10 left [109‥112] one wall strip and three panes)
  const PANES = game.level.boxes.map((_, bi) => bi).filter(bi => { const b = game.level.boxes[bi]; return Math.abs(b.c[2] - 10) < 0.01 && b.c[0] > 6 && b.c[0] < 11.3 && gb.typeOfPane(bi) === 'annealed'; });
  if (PANES.length !== 4) throw new Error(`cut-cost-recipes stageGlass: ${PANES.length} annealed panes on the conference partition (z 10, x 6‥11.3), wanted 4 — the level moved, re-read the recipe`);
  const h01 = n => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };   // the recipe's own dice
  let s = 1, rounds = 0, frames = 3, peak = 0, peakMoving = 0;
  const run = n => { for (let f = 0; f < n; f++) { step(); frames++; peak = Math.max(peak, D.list.length); peakMoving = Math.max(peakMoving, D.moving); } };
  for (let volley = 0; volley < 60; volley++) {   // ≤ 60 volleys of one round a pane, 6 frames between rounds (a 600 rpm burst walked along the glass)
    const left = PANES.filter(bi => gb.openFraction(bi) < 0.7); if (!left.length) break;
    for (const bi of left) {
      const b = game.level.boxes[bi]; const u = (h01(s++) * 2 - 1) * b.h[0] * 0.9, v = (h01(s++) * 2 - 1) * b.h[1] * 0.9;
      gb.hit(bi, [b.c[0] + u, b.c[1] + v, b.c[2]], [0, 0, -1], 1);   // what glass.ts glassHit hands a round's impact to (page, with the star decal and the noise: __glass.hit(bi, p, dir))
      rounds++; run(6);
    }
  }
  let settle = 0; while (settle < 600 && D.moving > 0) { step(); settle++; frames++; }
  run(2);
  const open = {}; for (const bi of PANES) open[bi] = +gb.openFraction(bi).toFixed(2);
  return { case: 'glass', frames, settleFrames: settle, rounds, panes: PANES, open, peak, peakMoving, ...countScene(game, engine) };
}
