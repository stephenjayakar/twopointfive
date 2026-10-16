// THE ISSUE KIT IS WORDS AND BOXES, AND ONE NUMBER (the Glock's fifteen-round magazines) — the check behind src/game/gear.ts (the 2010s rifle, pistol and two-tube goggles in place of the Splinter Cell kit).
//   bun run tools/qa/gear-check.ts
// What it holds, on one stood-up game with the switch thrown both ways:
//   (1) off: the two rows read as they did, the rifle is the bullpup's eleven boxes, the goggles one housing and three LIT lenses;
//   (2) on: the rows read Mk 18 / Glock 19 (9×19 mm) — nothing shown says M4A1 — and every other field of both rows is the same value BUT the pistol's magazine: 15 under the kit, 10 without (the rifle's 30 either way); the rifle is fourteen boxes under the bullpup's tag (the bullpup's eleven parts in their order, then the buffer tube, the laser box and the 40 mm tube,
//       whose mouth is round the port the sponge round leaves); the pistol's CALIBRE reads 9×19 mm, so its bullet holes are drawn a 9 mm's (marks.ts sizes a hole by it:
//       picture only, the size the guards' own 9 mm always drew);
//       the goggles are six boxes and NOT ONE of them emits, flipped down or up ("i don't think we need the NVG to glow in the dark");
//   (3) what the simulation reads off the rig — the support hand's grip, the muzzle's distance, the weapon light's pose, the launcher's port, the rifle's frame in
//       the hands and on the back — is the same number on and off; the parts both kits share (grip, can, post, light) are the same boxes hand and back; the reload's support hand works the
//       marks of the rifle that is drawn; a chronicle row names a weapon the same on and off;
//   (4) the kit's words: off, a line comes back character for character; on, no player-facing line of the list still names the old kit, and the OCP is still named.
//   (5) the fifteen: a pistol made under the kit is loaded 15 + 1 with three spares of 15, one made without it 10 + 1 and three of 10; a fresh encounter loads
//       Sam's the same way; a checkpoint saved at ten loads under the kit with its tens (and one saved at fifteen loads without the kit clamped to ten); thrown
//       on a running game the switch moves no round but those over ten when the kit comes off (Firearm.fit, the Tab row's call);
//   (6) the sponge round: in the air and spent it is three boxes under the ring's flags whichever kit is issued — the ring's three pale slats without the kit,
//       a slug with a blue nose leading along its flight (and lying flat on the floor, on its side) under it; the kit column's second launcher tag reads HE.
// Whole runs: `PT_DIGEST=1 bun run tools/qa/playthrough.ts` with the kit off agree digest for digest with the build before it; with TPS_GEAR=1 in front the digest's
// `pistol` field reads 1+15/15,15,15 for 1+10/10,10,10 and so the folded words differ — the runs themselves are the same. GEAR_BREAK=1 = the goggles' glass lit: must fail.
// exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const { standUp } = await import(`${ROOT}/tools/qa/headless.ts`);
const { GEAR, gearText, ringTag, shellTag, plainShort } = await import(`${ROOT}/src/game/gear.ts`);
const { RING_ITEM } = await import(`${ROOT}/src/game/throwables.ts`);
const { ringBoxes } = await import(`${ROOT}/src/game/launcher.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { reloadMarks } = await import(`${ROOT}/src/game/character.ts`);
const { WEAPONS, Pistol } = await import(`${ROOT}/src/game/weapons.ts`);
const R = await import(`${ROOT}/src/game/rigProps.ts`);
const { CONTROLS } = await import(`${ROOT}/src/ui/menu.ts`) as { CONTROLS: [string, string][] };   // (the card's own list of keys: the lines a player reads the kit's names in)

let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
const W: any = await standUp(); const game = W.game ?? W.g, c = game.player.char; c.update(1 / 60);
const was = GEAR.on;
const row = (id: 'fn2000' | 'fiveseven') => JSON.stringify(WEAPONS[id], (k, v) => k === 'name' || k === 'short' || k === 'calibre' || k === 'magCapacity' ? undefined : v);
/** a pistol's load as the digest writes it: chamber + magazine / spares */
const load = (p: any) => `${p.chamber}+${p.mag}/${p.spare.join(',')}`;
/** the ring / sponge round as it is drawn: one in the air flying +x and level, and one spent and lying still at the same spot */
const ROUND_AT = [20, 1.2, 11] as [number, number, number];
const inAir = () => { const out: any[] = []; const keep = game.rings; game.rings = [{ pos: [...ROUND_AT], vel: [30, 0, 0], age: 0.1, shooter: c, spin: 0.7 }]; ringBoxes(game, out); game.rings = keep; return out; };
const spent = () => { const out: any[] = []; const keep = game.items.items; const it = game.items.spawn('ring', [ROUND_AT[0], RING_ITEM.radius, ROUND_AT[2]], [0, 0, 0], { heading: 0 }); game.items.items = [it]; it.settled = true; it.yaw = 0.4; game.items.boxes(out); game.items.items = keep.filter((x: any) => x !== it); return out; };
const flagsOf = (bs: any[]) => bs.map(b => b.flags).join(','), blue = (b: any) => b.albedo[2] > 2 * Math.max(b.albedo[0], b.albedo[1]);
const sim = () => JSON.stringify([R.sc20kGrip(), R.sc20kMuzzleAhead(), R.sc20kLightPose(c), R.sc20kLauncherMuzzle(c)]);
/** the boxes both kits share, in the hands and on the back: the pistol grip (3), the can (5), the post (8), the light and its lens (9, 10) — the group's frame shows in every one */
const shared = (bs: any[]) => JSON.stringify([3, 5, 8, 9, 10].map(i => [bs[i].c, bs[i].h, bs[i].rot]));
const boxes = (where: 'hand' | 'slung') => { const out: any[] = []; R.sc20kBoxes(c, out, R.RIG.sc20k, where, [0, 0, 0], undefined, R.rifleM4(R.RIG)); return out; };
const goggles = (nv: boolean) => { const out: any[] = []; R.gogglesBoxes(c, nv, out, R.RIG.goggles); return out; };
const glow = (bs: any[]) => Math.max(...bs.flatMap(b => b.emissive as number[]));

GEAR.on = false;
const off = { rifle: row('fn2000'), pistol: row('fiveseven'), sim: sim(), hand: boxes('hand'), slung: boxes('slung') };
line(WEAPONS.fn2000.short === 'FN2000' && WEAPONS.fiveseven.short === 'Five-seveN' && WEAPONS.fiveseven.calibre === '5.7×28 mm', `off: the rows read ${WEAPONS.fn2000.short} and ${WEAPONS.fiveseven.short}, ${WEAPONS.fiveseven.calibre}`);
line(off.hand.length === 11 && off.slung.length === 11, `off: the rifle is the bullpup's ${off.hand.length} boxes in the hands, ${off.slung.length} slung`);
{ const d = goggles(true), u = goggles(false); line(d.length === 4 && u.length === 4 && glow(d) > 1 && glow(u) > 0, `off: the goggles are ${d.length} boxes with lit lenses (down ${glow(d)}, up ${glow(u)})`); }
{ const lines = ['FN2000 + Five-seveN', 'the ring launcher — but no ring airfoils left (2 again for the 40 mm)', ...CONTROLS.map(r => r[1])]; line(lines.every(s => gearText(s) === s) && ringTag() === 'RING', `off: ${lines.length} lines that name the kit come back as written`); }

line(WEAPONS.fiveseven.magCapacity === 10 && WEAPONS.fn2000.magCapacity === 30 && load(new Pistol()) === '1+10/10,10,10', `off: the pistol's magazine holds ${WEAPONS.fiveseven.magCapacity} (a fresh one is loaded ${load(new Pistol())}), the rifle's ${WEAPONS.fn2000.magCapacity}`);
const offRound = { air: inAir(), spent: spent() };
{ const a = offRound.air, s = offRound.spent, H = RING_ITEM.half, slat = (b: any, h: number[]) => b.h.join() === h.join() && b.albedo.join() === RING_ITEM.albedo.join();
  line(a.length === 3 && s.length === 3 && a.every(b => slat(b, [H[0], H[2], H[1]])) && s.every(b => slat(b, H)) && shellTag() === '40MM',
    `off: the ring is its three pale slats in the air (${a.length}) and spent (${s.length}), and the second launcher tag reads ${shellTag()}`); }
const save10 = W.snapshot('gear-check: saved without the kit');   // (Sam's pistol as the old kit loads it: 1+10/10,10,10)

GEAR.on = true;
if (process.env.GEAR_BREAK === '1') (R.RIG.goggles as any).tubes = undefined;   // (the old lit triangle under the new kit: the no-glow line must fail)
line(WEAPONS.fn2000.short === 'Mk 18' && WEAPONS.fn2000.name === 'Mk 18 (suppressed)' && WEAPONS.fiveseven.short === 'Glock 19' && WEAPONS.fiveseven.calibre === '9×19 mm', `on: the rows read ${WEAPONS.fn2000.name} and ${WEAPONS.fiveseven.name}, ${WEAPONS.fiveseven.calibre}`);
line(row('fn2000') === off.rifle && row('fiveseven') === off.pistol, 'on: every other field of both rows (spares, reload beats, cadence, report, spread, muzzle, rig, handling) is the value it was — but the pistol\'s magazine');
line(WEAPONS.fiveseven.magCapacity === 15 && WEAPONS.fn2000.magCapacity === 30 && load(new Pistol()) === '1+15/15,15,15', `on: the pistol's magazine holds ${WEAPONS.fiveseven.magCapacity} (a fresh one is loaded ${load(new Pistol())}), the rifle's ${WEAPONS.fn2000.magCapacity}`);
{ const h = boxes('hand'), s = boxes('slung'); const tagged = h.every(b => b.name === R.SC20K_TAG), finite = [...h, ...s].every(b => [...b.c, ...b.h, ...(b.rot ?? [])].every(Number.isFinite));
  line(h.length === R.M4_BOXES && s.length === R.M4_BOXES && R.M4_BOXES === 14 && tagged && finite, `on: the rifle is ${h.length} boxes in the hands, ${s.length} slung, all under the rifle's tag, all finite`);
  line(shared(h) === shared(off.hand) && shared(s) === shared(off.slung), 'on: the pistol grip, the can (the muzzle the rounds leave), the foregrip post, the weapon light and its lens are the same boxes in the same place, in the hands and on the back'); }
{ const M = reloadMarks(false), mag = M.mag as number[], top = R.RIG.m4.mag.adj.off as number[], len = R.RIG.m4.mag.l1 - R.RIG.m4.mag.l0;   // (moves-reload's own rule for 'the mark sits on the magazine the rig draws')
  line(Math.abs(mag[2] - top[2]) < 0.07 && mag[1] < top[1] - 0.03 && mag[1] > top[1] - len - 0.12 && mag[0] > 0.04 && mag[0] < 0.13, `on: the reload's support hand (the carbine's marks, ${mag.join(', ')}) is on the magazine the carbine draws (tops at ${top.join(', ')}, ${(len * 100).toFixed(0)} cm long)`); }
{ const h = boxes('hand'), port = R.sc20kLauncherMuzzle(c), gl = h[13], mouth = gl.c.map((x: number, k: number) => x + c.gunDir[k] * gl.h[2]), d = Math.hypot(port[0] - mouth[0], port[1] - mouth[1], port[2] - mouth[2]);
  line(d < Math.hypot(gl.h[0], gl.h[1]) + 0.004, `on: the 40 mm tube's mouth is round the port the sponge round leaves (${(d * 1000).toFixed(0)} mm from its centre, the mouth ${(gl.h[0] * 2000).toFixed(0)} × ${(gl.h[1] * 2000).toFixed(0)} mm)`); }
line(sim() === off.sim, 'on: the support hand\'s grip, the muzzle\'s distance, the light\'s pose and the launcher\'s port are the numbers they were');
{ const d = goggles(true), u = goggles(false); line(d.length === 6 && u.length === 6 && glow(d) === 0 && glow(u) === 0, `on: the goggles are two tubes on a bridge, ${d.length} boxes, and nothing on them emits (down ${glow(d)}, up ${glow(u)})`); }
{ const lines = ['FN2000 + Five-seveN', 'Five-seveN only', 'no FN2000 in this loadout', 'the ring launcher — but no ring airfoils left (2 again for the 40 mm)', 'ring airfoil ×5 on the right button', 'none for the launcher: rings only', ...CONTROLS.map(r => r[1])];
  const left = lines.map(s => gearText(String(s))).filter(s => /FN2000|Five-seveN|ring airfoil|ring launcher|\bRING\b|rings only|M4A1|\bM4\b/.test(s));
  { const shown = [WEAPONS.fn2000.name, WEAPONS.fn2000.short, gearText('FN2000 + Five-seveN'), gearText('no FN2000 in the kit'), gearText('reloading the FN2000')];
    line(shown.every(s => /Mk 18/.test(s) && !/M4/.test(s)) && shellTag() === 'HE', `on: the rifle is shown as the Mk 18 and nowhere as an M4 (${shown[2]} · ${shown[4]}), and the second launcher tag reads ${shellTag()}`); }
  line(left.length === 0 && ringTag() === 'SPONGE', `on: ${lines.length} lines that name the kit, ${left.length} still in the old kit's words${left.length ? ': ' + left[0] : ''}`);
  line(CONTROLS.length > 10 && CONTROLS.some(r => /OCP/.test(gearText(r[1]))), `on: the controls (${CONTROLS.length} rows) still name the OCP`); }
{ // what is written down, and whose reload marks his hand works, with the rifle really in his hands
  const pl = game.player, held = (on: boolean) => { GEAR.on = on; pl.slot = 'rifle'; pl.holstered = false; for (let i = 0; i < 40; i++) W.step(1 / 60); return pl.char.anim.reloadBack; };
  const offBack = held(false), onBack = held(true);
  line(offBack === true && onBack === false, `the reload works the bullpup's marks with the old kit (${offBack}) and the carbine's with the new (${!onBack})`);
  GEAR.on = true; const a = [plainShort(WEAPONS.fn2000), plainShort(WEAPONS.fiveseven), plainShort(WEAPONS.aks74u)]; GEAR.on = false; const b = [plainShort(WEAPONS.fn2000), plainShort(WEAPONS.fiveseven), plainShort(WEAPONS.aks74u)];
  line(JSON.stringify(a) === JSON.stringify(b) && a[0] === 'FN2000' && a[1] === 'Five-seveN', `a chronicle row names a weapon the same on and off (${a.join(' · ')}): a save or a recording made in one kit reads in the other`);
  GEAR.on = true; line(gearText(`fired ×3 (${a[0]})`) === 'fired ×3 (Mk 18)' && gearText('a ring to the head') === 'a sponge round to the head', 'on: …and it is worded as issued where it is shown'); }
{ // the sponge round, drawn: three boxes under the ring's flags either way; under the kit a slug, nose first
  GEAR.on = true; const a = inAir(), s = spent(); GEAR.on = false; const a0 = inAir(), s0 = spent(); GEAR.on = true;
  const sig = (sets: any[][]) => JSON.stringify(sets.map(bs => bs.map(b => [b.c, b.h, b.rot, b.albedo, b.flags])));
  const same = sig([a0, s0]) === sig([offRound.air, offRound.spent]);
  const NS = BoxFlag.Dynamic | BoxFlag.NoShadow, flags = [a, s, a0, s0].every(bs => bs.length === 3 && bs.every(b => b.flags === NS && b.owner === 0)) && flagsOf(a) === flagsOf(a0) && flagsOf(s) === flagsOf(s0);
  line(flags && same, `the round is three boxes under the ring's flags (raster only, no owner) in the air and spent, with the kit and without — and without it the ring comes back box for box`);
  const differs = (x: any[], y: any[]) => x.every((b, i) => b.h.join() !== y[i].h.join() && b.albedo.join() !== y[i].albedo.join());
  const nose = a.find(blue), tail = a.filter(b => !blue(b)), ahead = !!nose && tail.every(b => nose.c[0] > b.c[0] + 0.01) && a.every(b => Math.abs(b.c[1] - ROUND_AT[1]) < 1e-6 && Math.abs(b.c[2] - ROUND_AT[2]) < 1e-6);
  const len = Math.max(...a.map(b => b.c[0] + b.h[2])) - Math.min(...a.map(b => b.c[0] - b.h[2])), wide = 2 * Math.max(...a.map(b => Math.max(b.h[0], b.h[1])));
  line(differs(a, a0) && differs(s, s0) && a.filter(blue).length === 1 && ahead && len >= 2 * RING_ITEM.half[0] && wide >= 0.04 && wide <= 0.05,
    `on: in the air it is a slug, not the ring — a blue nose leading along its flight, ${(len * 1000).toFixed(0)} mm long and ${(wide * 1000).toFixed(0)} mm across (the ring: ${(RING_ITEM.half[0] * 2000).toFixed(0)} mm)`);
  const lo = Math.min(...s.map(b => b.c[1] - Math.max(b.h[0], b.h[1]))), flat = s.every(b => Math.abs(b.c[1] - s[0].c[1]) < 1e-6), sNose = s.find(blue), sBody = s.find(b => !blue(b)), along = sNose && sBody ? Math.hypot(sNose.c[0] - sBody.c[0], sNose.c[2] - sBody.c[2]) : 0;
  line(s.filter(blue).length === 1 && flat && lo >= 0 && lo < 0.006 && along > 0.02 && s.every(b => [...b.c, ...b.h, ...b.rot].every(Number.isFinite)),
    `on: spent it lies on its side on the floor (lowest face ${(lo * 1000).toFixed(1)} mm up, its length level), the same slug`); }
{ // the fifteen, on a game: a fresh encounter, a checkpoint from the other kit, the switch thrown on a running game
  const pl = () => game.player.pistol;
  GEAR.on = true; game.restartEncounter(); const fresh15 = load(pl());
  W.restore(save10); const kept10 = load(pl()); const room = pl().magRoom;
  game.restartEncounter(); const save15 = W.snapshot('gear-check: saved under the kit');
  GEAR.on = false; game.restartEncounter(); const fresh10 = load(pl());
  W.restore(save15); const clamped = load(pl());
  line(fresh15 === '1+15/15,15,15' && fresh10 === '1+10/10,10,10', `a fresh encounter loads Sam's pistol ${fresh15} under the kit and ${fresh10} without it`);
  line(kept10 === '1+10/10,10,10' && room === 15 && clamped === '1+10/10,10,10', `a checkpoint saved at ten loads under the kit with its tens (${kept10}, room for ${room}); one saved at fifteen loads without the kit as ${clamped}`);
  GEAR.on = true; game.restartEncounter(); GEAR.on = false; const before = load(pl()); pl().fit(); const off15 = load(pl());   // the kit taken off a running game (the Tab row: the switch, then fit)
  GEAR.on = true; pl().fit(); const on10 = load(pl());                                                                          // …and put back on: nothing moves
  line(before === '1+15/15,15,15' && off15 === '1+10/10,10,10' && on10 === off15, `the switch on a running game: off, what is over ten is put away (${before} → ${off15}); on, the magazines keep what they were loaded with (${on10}) until a restart loads the new size`);
  GEAR.on = was; game.restartEncounter(); }
GEAR.on = was;
console.log(failed ? '=== gear-check: FAILED ===' : '=== gear-check: ALL PASS ===');
process.exit(failed ? 1 : 0);
