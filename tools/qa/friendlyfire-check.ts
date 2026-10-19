// FRIENDLY FIRE — the check behind src/game/friendlyfire.ts (FRIENDLYFIRE.on: on in the page, ?nofriendlyfire; off on the frozen stand, TPS_FRIENDLYFIRE=1).
//   bun run tools/qa/friendlyfire-check.ts        (also `probes.ts friendlyfire`; passes on both stands: it throws the switches itself)
// One room clear staged with the pair (doortools-probes.ts rig), nobody's senses on and every man put back on his mark each frame, on the open aisle of the
// cubicles; Sam's rounds are real clicks, a teammate's are fireWeapon's own (the seam every one of his rounds is born through):
//   bodies  (1) the switch off: Sam's round along a line through a teammate passes him, as it did;
//           (2) on: the same click puts a teammate down, by Sam's hand, the log says whose round, and the card's kills and knockouts do not count him;
//           (3) on, the care held off: a teammate's round at a defender with Sam standing between goes into Sam;
//           (4b) …and with a mate standing between, into the mate, and the log says whose round;
//   care    (4) a teammate with a mate between his muzzle and his man does not press;
//           (5) the same with Sam between;
//           (6) a friend four metres BEYOND the man on the same line: held when the round could miss the man, his to press when it cannot (the room
//               fight's own lane asks one metre past him and is clear);
//           (7) a friend behind a wall the round does not go through holds nothing; behind a thin one it does go through (where that rule is live), he
//               holds it; nor does one whose column the muzzle is already inside;
//           (8) nobody in the way: pressed, and it finds the defender — and off, Sam in the way: pressed, through him, into the defender, as it did;
//   reticle (9) the cursor swept over every man on the floor: the reticle only ever takes a man hostile to Sam (friends.ts FRIENDS.noSnap's rule);
//   stands  (10) the row is in FROZEN_HOLDS with its word, the word in STAND_ENV, and the reticle's own row is still there;
//   words   (11) a round of Sam's close past a teammate's head: he says so; a metre further off: nothing.
// NOT here: the room fight's own gate holding for the cone (the fight is not run: `ff.held` on a play-through's runs counts it), a shell's pattern, the page.
// FRIENDLYFIRE_BREAK=1 = the switch left off for the 'on' lines, and the care held off: (2) to (7), (4b) and (11) must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

export async function friendlyfireCheck(): Promise<boolean> {
  const { rig } = await import('./doortools-probes.ts');
  const { FRIENDLYFIRE, FRIENDLYFIRE_STATS: ST, friendInCone, ffPast } = await import(`${ROOT}/src/game/friendlyfire.ts`);
  const { FRIENDS } = await import(`${ROOT}/src/game/friends.ts`);
  const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
  const { shotEnergy, roundEnergy } = await import(`${ROOT}/src/game/glasspen.ts`);
  const { wallPenLive, thinLine } = await import(`${ROOT}/src/game/wallpen.ts`);
  const { hostileTo } = await import(`${ROOT}/src/game/teams.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const P = await import(`${ROOT}/src/host/profile.ts`); const E = await import(`${ROOT}/src/host/standEnv.ts`);
  let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== friendlyfire: a round of his side finds the men of his side; a teammate does not press with a friend where his round could go ===');
  const R: any = await rig(5101, { stage: 'rc' }); const { W, game, input } = R; const pl = game.player, c = pl.char;
  const { WORDS } = await import(`${ROOT}/src/game/words.ts`);
  const was = { ff: { ...FRIENDLYFIRE }, fr: { ...FRIENDS }, words: WORDS.on }; WORDS.on = true; const brk = process.env.FRIENDLYFIRE_BREAK === '1';   // (the log's own words for a teammate, as the page has them)
  const msgs: string[] = R.said;
  game.aiEnabled = false;   // (nobody's senses: the floor stays calm and the men stay where they are put)
  const mate = R.ops[0], other = R.ops[1], foes = R.hostiles.filter((h: any) => h.state !== 'dead'), foe = foes[0];
  const chest = (gd: any): [number, number, number] => gd.char.bones.chest ?? [gd.char.pos[0], gd.char.pos[1] + 1.2, gd.char.pos[2]];
  const put = (gd: any, p: number[], yaw = 0) => { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel[0] = gd.char.vel[2] = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; };
  // the middle aisle of the cubicles, open from x 12 to 22 at z 17.6
  const Z = 17.6, AWAY = [15, 0, 21.5], AWAY2 = [16.5, 0, 21.5];
  const park = new Map<any, number[]>([[mate, [18, 0, Z]], [other, AWAY], [foe, [12, 0, Z]]]);
  const hold = () => { for (const [gd, p] of park) if (gd.state !== 'dead') put(gd, p, -Math.PI / 2); for (const h of game.guards) if (hostileTo(h, 'player') && h.state !== 'dead') { h.state = 'patrol'; h.awareness = 0; } };
  let aimAt: number[] = [22, 0.02, Z];
  const idle = (n: number, click = false) => { for (let i = 0; i < n; i++) { hold(); W.cursorAt(aimAt as any); if (click && i === 0) input.clicked |= 1; R.step(); } };
  const up = (gd: any) => gd.state !== 'dead' && gd.char.alive;
  const rifleUp = () => { if (!pl.rifleUp) { input.pressed.add('Digit2'); idle(1); if (!pl.rifleUp) { input.pressed.add('KeyE'); idle(1); } idle(90); } };
  const samShot = () => { const n0 = pl.rifle.shotsFired; pl.fireCd = 0; idle(1, true); idle(4); return pl.rifle.shotsFired - n0; };
  /** one round of a teammate's, born through fireWeapon at a man's chest: was it pressed (a shot of his on the event list), and what the tally says */
  const mateShot = (who: any, at: any, spread = 0.02) => { let n = 0; const an = who.char.anim, f = an.fire; an.fire = function (this: any, ...a: any[]) { n++; return f.apply(this, a); };
    const u0 = ST.unpressed; try { fireWeapon(game, who.char, chest(at), false, { steady: true, spread }); } finally { an.fire = f; } return { pressed: n, unpressed: ST.unpressed - u0 }; };
  try {
    FRIENDS.lowReady = false; FRIENDS.noSnap = true;   // (his gun is his own for these lines: the low ready out of a fight is friends-check's)
    game.teleportPlayer([15, 0, Z]); idle(30); rifleUp();
    const open = !game.col.segmentBlocked([15, 1.3, Z], chest(mate));
    // (1) off: through him
    { FRIENDLYFIRE.on = false; aimAt = [22, 0.02, Z]; idle(20); const n = samShot();
      line(open && n === 1 && up(mate), 'the switch off: Sam\'s round along a line through a teammate three metres ahead passes him, as it did', `line open ${open} · rounds ${n} · ${mate.callsign} ${mate.state}`); }
    // (11) words: a round of Sam's past a teammate's head
    { FRIENDLYFIRE.on = !brk; const h = mate.char.bones.head ?? [18, 1.6, Z], from = [h[0] - 3, h[1], h[2] + 0.4], to = [h[0] + 4, h[1], h[2] + 0.4]; const s0 = ST.said; mate.bubble = null;
      if (FRIENDLYFIRE.on) ffPast(game, from, to, null); const said = mate.bubble?.text ?? null; const far0 = ST.said; if (FRIENDLYFIRE.on) { mate.sup.barkT = -100; ffPast(game, [from[0], from[1], from[2] + 1], [to[0], to[1], to[2] + 1], null); }
      line(ST.said === s0 + 1 && !!said && ST.said === far0, 'a round of Sam\'s 0.4 m past a teammate\'s head: he says so (a colleague\'s own line); one 1.4 m past him: nothing', `said ${ST.said - s0}: ${JSON.stringify(said)}`); }
    // the lines about a teammate's own round: `other` the shooter on the aisle, Sam or `mate` the friend
    park.set(mate, AWAY); game.teleportPlayer(AWAY2); idle(5);
    const S = [20.5, 0, Z], MID = [17.5, 0, Z], FOE = [14, 0, Z]; park.set(other, S); park.set(foe, FOE);
    idle(20);
    /** a point of floor on the line from the shooter's muzzle to a man's chest, `d` metres short of him (negative: past him) */
    const onLine = (at: any, d: number): number[] => { const m = other.char.muzzle, f = chest(at), dx = f[0] - m[0], dz = f[2] - m[2], L = Math.hypot(dx, dz); return [f[0] - dx / L * d, 0, f[2] - dz / L * d]; };
    /** Sam stood on that line and kept on it while the shooter's arm settles (the muzzle is a bone: it moves a little every frame) */
    const samOnLine = (at: any, d: number) => { for (let i = 0; i < 12; i++) { game.teleportPlayer(onLine(at, d)); idle(1); } };
    const name = (w: any) => w === 'player' ? 'Sam' : w ? w.callsign : 'nobody';
    // (3) the care held off: a teammate's round goes into Sam
    { FRIENDLYFIRE.on = !brk; FRIENDLYFIRE.care = false; samOnLine(foe, 3); const s0 = ST.mateOnSam; pl.hitFlash = 0; const r = mateShot(other, foe, 0);
      line(r.pressed > 0 && ST.mateOnSam === s0 + 1 && pl.hitFlash > 0 && up(foe), 'on, the care held off: a teammate\'s round at a defender with Sam standing between goes into Sam', `pressed ${r.pressed} · into Sam ${ST.mateOnSam - s0} · hit flash ${pl.hitFlash} · the defender ${foe.state}`);
      FRIENDLYFIRE.care = true; }
    // (5) Sam between: not pressed
    { FRIENDLYFIRE.on = !brk; const r = mateShot(other, foe), who = friendInCone(game, other, other.char.muzzle, chest(foe), 0.02, undefined, foe.char);
      line(r.pressed === 0 && r.unpressed === 1 && who === 'player' && up(foe), 'Sam between a teammate\'s muzzle and his man: the round is not pressed', `pressed ${r.pressed} · unpressed ${r.unpressed} · in the cone: ${name(who)}`); }
    // (6) Sam four metres beyond the man
    { park.set(foe, MID); idle(3); samOnLine(foe, -4);   // (on the round's own line, four metres past him)
      const m = other.char.muzzle, L = Math.hypot(chest(foe)[0] - m[0], chest(foe)[2] - m[2]), wideS = 0.5 / L;   // (a spread whose cone is wider than the man where he stands: the round can miss him)
      const sure = friendInCone(game, other, m, chest(foe), 0.02, undefined, foe.char), wide = friendInCone(game, other, m, chest(foe), wideS, undefined, foe.char), noMan = friendInCone(game, other, m, chest(foe), 0.02), lane = game.fight.friendInLine(m, chest(foe), other);
      line(sure === null && wide === 'player' && noMan === 'player' && !lane, 'a friend four metres BEYOND the man on the same line: a round that cannot miss the man is his to press; one thrown wide enough to miss him is held (the room fight\'s own lane, a metre past him, is clear either way)',
        `the man ${L.toFixed(1)} m off · a tight round on him: ${name(sure)} · a wide one (${wideS.toFixed(2)}): ${name(wide)} · the same point with no man there: ${name(noMan)} · the lane: ${lane ? 'held' : 'clear'}`);
      park.set(foe, FOE); }
    // (7) behind a wall, through a thin one, and inside the muzzle's reach
    { idle(5); const m: number[] = [...other.char.muzzle]; const en = shotEnergy(game, other.char, other.weapon.def), thinOn = wallPenLive(game), re = roundEnergy(other.weapon.def); let q: number[] | null = null, tq: number[] | null = null;
      const solid = (p: number[], y: number) => game.col.shotBlocked(m, [p[0], y, p[2]], 0.02, en), pierced = (p: number[], y: number) => thinOn && thinLine(game, m, [p[0], y, p[2]], re) !== null;
      const round4 = (p: number[]) => [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].map(d => [p[0] + d[0], 0, p[2] + d[1]]); let qd = Infinity, td = Infinity;
      for (let gx = 6; gx <= 34; gx += 0.5) for (let gz = 4; gz <= 30; gz += 0.5) { const p = [gx, 0, gz], d = Math.hypot(gx - m[0], gz - m[2]); if (d < 2 || d >= Math.max(qd, td)) continue;
        const pts = round4(p); if (!pts.every(x => solid(x, 1.2) && solid(x, 1.6))) continue;   // (nothing of a man stood there shows round a corner)
        if (!pts.slice(1).every(x => !game.col.segmentBlocked([gx, 0.5, gz], [x[0], 0.5, x[2]]))) continue;   // (floor a man can stand on, a body's breadth of it)
        const n = pts.filter(x => pierced(x, 1.2)).length;
        if (n === pts.length && d < td) { td = d; tq = p; } else if (n === 0 && !pts.some(x => pierced(x, 1.6)) && d < qd) { qd = d; q = p; } }
      const ask = (p: number[]) => { game.teleportPlayer(p); idle(5); const at = Math.hypot(c.pos[0] - p[0], c.pos[2] - p[2]) < 0.3; return at ? friendInCone(game, other, m, [c.pos[0], 1.2, c.pos[2]], 0.02) : 'not stood there'; };
      const walled: any = q ? ask(q) : 'no walled place found', thinned: any = tq ? ask(tq) : null;
      game.teleportPlayer(onLine(foe, 3)); idle(5); const h = c.bones.hips ?? c.pos; const inside = friendInCone(game, other, [h[0] + 0.1, 1.3, h[2]], chest(foe), 0.02), outside = friendInCone(game, other, other.char.muzzle, chest(foe), 0.02);   // (asked of a muzzle a hand's breadth from his hips — a stack — and of the shooter's own, three metres back)
      line(!!q && walled === null && inside === null && (brk || outside === 'player') && (!tq || brk || thinned === 'player'), 'a friend behind a wall the round does not go through holds nothing; one behind a thin wall it does go through holds it; nor does one whose column the muzzle is already inside',
        `walled place ${q} → ${walled === null ? 'clear' : name(walled)} · thin walls ${thinOn ? 'live' : 'not live on this stand'}${tq ? `, a place behind one ${tq} → ${thinned === null ? 'clear' : thinned === 'player' ? 'held' : thinned}` : thinOn ? ', no place behind one found' : ''} · a muzzle inside his column → ${inside === null ? 'clear' : 'held'} (the shooter's own, from three metres: ${outside === null ? 'clear' : 'held'})`); }
    // (4) a mate between: not pressed
    { game.teleportPlayer(AWAY2); park.set(mate, onLine(foe, 3)); idle(10); const r = mateShot(other, foe), who = friendInCone(game, other, other.char.muzzle, chest(foe), 0.02, undefined, foe.char);
      line(r.pressed === 0 && r.unpressed === 1 && who === mate && up(mate) && up(foe), 'a mate between a teammate\'s muzzle and his man: the round is not pressed', `pressed ${r.pressed} · unpressed ${r.unpressed} · in the cone: ${name(who)}`); }
    // (4b) the care held off: it goes into the mate, and the log says whose round
    { FRIENDLYFIRE.care = false; msgs.length = 0; const s0 = ST.mateOnMate; let n = 0; for (let i = 0; i < 4 && up(mate); i++) { idle(2); n += mateShot(other, foe, 0).pressed; }
      const said = msgs.find(m => m.includes(mate.callsign) && m.includes(`${other.callsign}'s round`));
      line(!up(mate) && mate.killerId === other.char.id && ST.mateOnMate > s0 && !!said && up(foe), 'on, the care held off: a teammate\'s round at a defender with a mate standing between goes into the mate, and the log says whose round', `rounds ${n} · ${mate.callsign} ${mate.state}${mate.wound ? ' (wounded)' : ''} · tally ${ST.mateOnMate - s0} · ${JSON.stringify(said ?? msgs.slice(-2))}`);
      FRIENDLYFIRE.care = true; park.delete(mate); }
    // (8) on, nobody in the way: pressed — and off, Sam in the way: pressed, through him, into the defender
    { game.teleportPlayer(AWAY2); idle(10); FRIENDLYFIRE.on = !brk; const clear = friendInCone(game, other, other.char.muzzle, chest(foe), 0.02); const r1 = mateShot(other, foe, 0); const down1 = !up(foe);
      const foe2 = foes.find((h: any) => up(h)) ?? null; let off = 'no second defender';
      let ok2 = !!foe2; if (foe2) { park.set(foe2, FOE); idle(5); samOnLine(foe2, 3); FRIENDLYFIRE.on = false; const s0 = ST.mateOnSam; pl.hitFlash = 0; const r = mateShot(other, foe2, 0); ok2 = r.pressed > 0 && !up(foe2) && ST.mateOnSam === s0 && pl.hitFlash === 0; off = `pressed ${r.pressed} · the defender ${foe2.state} · into Sam ${ST.mateOnSam - s0}`; }
      line(clear === null && r1.pressed > 0 && down1, 'on, nobody in the way: the round is pressed and finds the defender', `in the cone: ${name(clear)} · pressed ${r1.pressed} · the defender ${foe.state}`);
      line(ok2, 'off, Sam between: the round is pressed, passes him and finds the defender, as it did', off); }
    // (9) the reticle (friends.ts FRIENDS.noSnap's rule, asked here of every man on the floor with this switch on)
    { FRIENDLYFIRE.on = !brk; FRIENDS.noSnap = true; game.teleportPlayer([15, 0, Z]); park.set(other, [18, 0, Z]); const men = [...game.guards, ...(game.civilians ?? [])].filter((x: any) => x.char.alive); let frames = 0, taken = 0; const bad: string[] = [];
      idle(5);
      for (const x of men) for (const d of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3], [0.6, 0.4], [-0.6, -0.4]]) { const cp = chest(x); aimAt = [cp[0] + d[0], cp[1], cp[2] + d[1]]; idle(2); frames++;
        const a = game.aimGuard; if (a) { taken++; if (a.civ || !hostileTo(a, 'player')) bad.push(a.callsign); } }
      const friends = men.filter((x: any) => x.civ || !hostileTo(x, 'player')).length;
      line(bad.length === 0 && taken > 0 && friends > 0, 'the cursor swept on and about every man on the floor: the reticle only ever takes a man hostile to Sam', `${men.length} men (${friends} not his enemy) · ${frames} cursor places · a man taken on ${taken} · not an enemy: ${bad.length ? [...new Set(bad)].join(', ') : 'never'}`); }
    // (2) on: Sam's own round into the teammate ahead of him
    { FRIENDLYFIRE.on = !brk; msgs.length = 0; const s0 = ST.samOnMate, k0 = game.mission.stats.kills + game.mission.stats.knockouts; aimAt = [22, 0.02, Z]; idle(20); let n = 0; for (let i = 0; i < 4 && up(other); i++) n += samShot();
      const said = msgs.find(m => m.includes(other.callsign) && m.includes('your round')), k1 = game.mission.stats.kills + game.mission.stats.knockouts;
      line(!up(other) && other.killerId === PLAYER_ID && !!said && ST.samOnMate > s0 && k1 === k0, 'on: the click that passed a teammate in (1) puts one down, by Sam\'s hand; the log says whose round it was, and the card\'s kills and knockouts do not count him', `rounds ${n} · ${other.callsign} ${other.state}${other.wound ? ' (wounded)' : ''} · killer ${other.killerId} · tally ${ST.samOnMate - s0} · kills + knockouts ${k0} → ${k1} · ${JSON.stringify(said ?? msgs.slice(-2))}`); }
    // (10) the stands
    { const row = (P as any).FROZEN_HOLDS?.['FRIENDLYFIRE.on'], snap = (P as any).FROZEN_HOLDS?.['FRIENDS.noSnap'], env = (E as any).STAND_ENV?.includes('TPS_FRIENDLYFIRE');
      line(row === 'TPS_FRIENDLYFIRE=1' && !!snap && env, 'the row is in FROZEN_HOLDS with its word, the word in STAND_ENV, and the reticle\'s own row is still there', `FRIENDLYFIRE.on → ${row} · FRIENDS.noSnap → ${snap} · STAND_ENV ${env}`); }
  } finally { Object.assign(FRIENDLYFIRE, was.ff); Object.assign(FRIENDS, was.fr); WORDS.on = was.words; }
  console.log(`=== friendlyfire: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
if (import.meta.main) process.exit((await friendlyfireCheck()) ? 0 : 1);
