// The mission pictures' recipes: for each mission id, the link it is booted from, the PLAY that leads to its moment (the body of an
// async function run in the page: ms = director.js, g = the Game) and the camera the still is drawn from. A play ends ON its moment —
// it waits on what happens (a can going off, a round fired, a wall coming down), not on a clock — so a recipe re-run gives that kind
// of moment again, not the same frame to the pixel (a man's stride and who fires first differ run to run). A play that RETURNS a
// sim / lead that ran out of time (hit false), or throws (ms.must), fails its picture: the old one is kept.
// Across a group no two share a moment, an hour and a camera: that is the point of the set.
const PI = Math.PI;
const Q = '&difficulty=hard&seed=7&freshstart=0';
const bang = door => `ms.bangBy('${door}', t0)`;   // a can has gone off by that door since the order (t0)
const R = {};

// ── Strongholds ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
R['block-four'] = {      // the mess, a room that turns a corner: the point man fires round the turn, the file behind him in the lit leg, a man waiting in the dark leg and one more behind the next wall
  query: 'levelFile=block.json&roomclear&squad4' + Q, quality: 'medium', frames: 8,
  play: `ms.approach('m_s', 3.0, 30); ms.order('openClear', 'm_s');
         return ms.sim(25, () => ms.shotNow() && ms.ops().some(o => o.char.pos[2] < 8 && o.char.pos[0] < 15.5));`,
  cam: { look: [14.7, 1, 7.4], yaw: -2.5, pitch: 1.1, dist: 11.5 } };
R['block-squads'] = {    // night; the workshop taken through its second door behind a can: the first two men through the tool crib's door, a round going, seen from the corner its men held
  query: 'levelFile=block-squads.json&roomclear&squad4' + Q, quality: 'medium', frames: 8,
  play: `ms.order('fallIn', [8.6, 0, 13.9]); ms.go([9.4, 0, 21.2]); ms.sim(25, () => ms.arrived());
         ms.order('bangClear', 'w_c'); const t0 = g.time; ms.must(ms.sim(40, () => ms.bangBy('w_c', t0)), 'the can');
         return ms.sim(8, () => ms.shotNow() && ms.ops().some(o => o.char.pos[0] > 17.05 && o.char.pos[2] > 18.6));`,
  cam: { look: [17.7, 1.1, 22.5], yaw: 2.4, pitch: 0.3, dist: 3.4 } };
R['pass-four'] = {       // night, snow; in by the gate and round the lorry's tail, a can through the tea room's door: the flash in the doorway and out of its windows, the door man black against it, the brazier, seen from the yard past the lorry's cab
  query: 'levelFile=pass.json&roomclear&squad4' + Q, quality: 'medium', frames: 8,
  play: `for (const w of [[19.8, 0, 23.6], [21.6, 0, 20.4]]) { ms.go(w); ms.must(ms.sim(25, () => ms.arrived()), 'the walk in by the gate'); }
         ms.order('bangClear', 'tea'); const t0 = g.time; ms.must(ms.sim(40, () => ms.bangBy('tea', t0)), 'the can');
         return { hit: ms.ops().length >= 2, t: g.time, ops: ms.ops().length };`,
  cam: { look: [17.0, 1, 11.8], yaw: 0.7, pitch: 0.42, dist: 10 } };
R['warehouse-four'] = {  // night; first man through the hall's south-west door behind the can, firing point blank on the man who held it, his mate in the frame behind
  query: 'levelFile=warehouse.json&roomclear&squad4' + Q, quality: 'medium', frames: 8,
  play: `ms.order('fallIn', [8, 0, 26.2]); ms.go([11.6, 0, 21.6]); ms.sim(25, () => ms.arrived());
         ms.order('bangClear', 'h_sw'); const t0 = g.time; ms.sim(40, () => ${bang('h_sw')});
         const inHall = () => ms.shooters().some(by => by.team === 'operative' && by.char.pos[0] > 13.6);
         return ms.sim(14, inHall);`,
  cam: { look: [13.4, 1, 21.3], yaw: PI / 2 - 0.35, pitch: 0.6, dist: 6.8 } };
R['compound-four'] = {   // dusk; the stack on the house's west door as the flashbang goes off inside
  query: 'levelFile=compound.json&roomclear&squad4&hour=dusk' + Q, quality: 'medium', frames: 9,
  play: `ms.order('fallIn', [2, 0, 17]); ms.go([8.5, 0, 15.2]); ms.sim(20, () => ms.arrived());
         ms.order('bangClear', 's_w'); const t0 = g.time; return ms.sim(30, () => ${bang('s_w')});`,
  cam: { look: [12.6, 1.0, 14.4], yaw: -PI / 2 - 0.42, pitch: 0.48, dist: 9.5 } };
R['barracks-four'] = {   // night; a bunk room's door shoved open from the gallery, the first round, seen from above as the game is played
  query: 'levelFile=barracks.json&roomclear&squad4' + Q, quality: 'medium', frames: 9,
  play: `ms.order('fallIn', [38.2, 0, 21.6]); ms.go([34.6, 0, 19]); ms.sim(20, () => ms.arrived());
         ms.order('openClear', 's3'); return ms.sim(40, () => ms.shotNow());`,
  cam: { look: [28, 1, 20.6], yaw: PI - 0.5, pitch: 0.85, dist: 9.5 } };
R['mousehole-four'] = {  // midday; the charge on the clinic's back wall goes and the wall comes apart, a pair stood off along it
  query: 'levelFile=mousehole.json&roomclear&squad4&hour=midday' + Q, quality: 'medium', frames: 8,
  play: `ms.order('fallIn', [12, 0, 3.4]); ms.order('wallCharge', [12, 0, 7.0]); ms.must(ms.sim(40, () => g.wallCharge.ops.some(o => o.phase === 'armed')), 'the wall charge');
         ms.go([6.2, 0, 4.2]); ms.sim(15, () => ms.arrived()); ms.tap('KeyF'); return await ms.lead(6);`,
  cam: { look: [11.6, 1, 6.2], yaw: PI - 0.62, pitch: 0.36, dist: 9.6 } };

// ── Raids ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
R['night-breach'] = {    // the group's tile. The F drill run to its end: boot, can, and the first man in the break room's door on his second target
  query: 'nightbreach' + Q, quality: 'medium', frames: 8,
  play: `const nb = g.nightBreach; ms.tap('KeyF'); ms.sim(40, () => nb.state === 'set');
         ms.tap('KeyF'); const t0 = g.time; ms.sim(25, () => ${bang('breakroom_w')});
         return ms.sim(10, () => ms.ops().some(x => x.char.pos[0] > 28.4) && ms.shotNow());`,
  cam: { look: [31, 1, 18.6], yaw: 0.9, pitch: 0.5, dist: 6.3 } };
R['room-clear-pair'] = { // the game's own view: the server room's lock booted, a can, the first man in and firing by the racks, his mate at the door, Sam on the corridor
  query: 'roomclear' + Q, quality: 'medium', frames: 8,
  play: `ms.approach('server', 3.2, 40); ms.order('bangClear', 'server'); const t0 = g.time; ms.must(ms.sim(60, () => ${bang('server')}), 'the can');
         return ms.sim(10, () => ms.shooters().some(x => x.team === 'operative'));`,
  cam: { look: [16.6, 1, 9.65], yaw: 0.25, pitch: 1.12, dist: 9.5 } };
R['room-clear-four'] = { // the game's own view, wide: the break room taken and held, a man firing from its west door, Sam among the cubicles as the floor's other men come round by the corridor
  query: 'roomclear&squad4' + Q, quality: 'medium', frames: 8,
  play: `ms.approach('breakroom_w', 3.5, 45); ms.order('bangClear', 'breakroom_w'); const t0 = g.time; ms.must(ms.sim(60, () => ${bang('breakroom_w')}), 'the can');
         const tb = g.time; return ms.sim(20, () => g.time > tb + 3.2 && ms.shooters().some(x => x.team === 'operative'));`,
  cam: { look: [26.8, 1, 16.1], yaw: 0.2, pitch: 1.08, dist: 14.6 } };
R['records-pair'] = {    // rain; on the way to the west door the pair's first man fires through the records room's window on the man inside
  query: 'levelFile=records.json&roomclear&weather=rain' + Q, quality: 'medium', frames: 8,
  play: `ms.order('fallIn', ms.sam()); ms.go([8.3, 0, 13]); ms.sim(30, () => ms.sam()[2] < 19.5);
         ms.approach('records_west', 3.2, 40); ms.order('bangClear', 'records_west'); const t0 = g.time;
         ms.must(ms.sim(60, () => ms.since(/glass/, t0)), 'a round through the window'); return await ms.lead(2);`,
  cam: { look: [9.9, 1.1, 11.6], yaw: -PI / 2 + 0.75, pitch: 0.4, dist: 5.9 } };

R['depot-four'] = {      // night rain; down the lee of the truck unseen, the first man through the workshop's door, seen from inside the dark workshop
  query: 'levelFile=depot.json&roomclear&squad4' + Q, quality: 'medium', frames: 8,
  play: `ms.tap('KeyC'); ms.sim(0.2);
         for (const w of [[5.5, 0, 15.6], [9.6, 0, 17.7], [14.9, 0, 17.7]]) { ms.go(w); ms.must(ms.sim(20, () => ms.arrived()), 'the walk down the lee of the truck'); }
         ms.order('stack', 'bay_to_yard'); ms.must(ms.sim(25, () => ms.ops().filter(o => Math.hypot(o.char.pos[0] - 16.3, o.char.pos[2] - 18) < 2.2).length >= 2), 'the stack'); ms.sim(5);
         ms.order('openClear', 'bay_to_yard'); const d = ms.door('bay_to_yard');
         const r = ms.sim(20, () => Math.abs(d.angle) > 0.8 && ms.ops().some(o => o.char.pos[2] > 18.45 && Math.abs(o.char.pos[0] - 16.25) < 0.6));
         return { hit: r.hit && ms.ops().length === 4, t: g.time, angle: d.angle };`,
  cam: { look: [16.1, 1.0, 18.5], yaw: 0.2, pitch: 0.16, dist: 4.2 } };
R['floodlit-four'] = {   // caught crossing the floodlit pad: the guard room's window opens up on the file, a man goes down, the first round goes back
  query: 'levelFile=floodlit.json&roomclear&squad4' + Q, quality: 'medium', frames: 8,
  play: `ms.order('fallIn', ms.sam()); ms.go([17.6, 0, 16.2]); ms.sim(30, () => ms.sam()[2] < 19.5);
         ms.must(ms.sim(20, () => ms.shotNow()), 'the first round'); return ms.sim(6, () => ms.shooters().some(x => x.team === 'operative'));`,
  cam: { look: [17.6, 1, 17.6], yaw: 0.55, pitch: 0.4, dist: 10.5 } };

R['hall-four'] = {       // the long hall from its front door: two of the four pushing down it and firing, a third man holding the doorway under the camera
  query: 'levelFile=hall.json&roomclear&squad4' + Q, quality: 'medium', frames: 8,
  play: `ms.approach('front', 3.2, 30); ms.order('openClear', 'front'); return ms.sim(40, () => ms.shooters().some(x => x.team === 'operative'));`,
  cam: { look: [14.5, 1, 14.1], yaw: -PI / 2 + 0.12, pitch: 0.34, dist: 6.2 } };
R['glasshouse-four'] = { // dusk; Sam's own rifle through the frontage on the man inside: the pane starred, glass in the air
  query: 'levelFile=glasshouse.json&roomclear&squad4&hour=dusk' + Q, quality: 'medium', frames: 8,
  play: `ms.order('fallIn', ms.sam()); ms.go([28.7, 0, 20.5]); ms.sim(14, () => ms.arrived());
         const t2 = ms.man('Tango 2'), t0 = g.time; let n = 0;
         ms.must(ms.sim(6, () => { ms.aim([t2.char.pos[0], 1.25, t2.char.pos[2]]); if (g.time > t0 + 0.5 && n++ % 12 === 0) ms.fire(); return ms.since(/glass/, t0); }), 'a round through the pane');
         return await ms.lead(3);`,
  cam: { look: [28.1, 1.0, 19.0], yaw: 0.6, pitch: 0.4, dist: 6.2 } };

// ── On the clock ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

R['hostage-rescue'] = { // the group's tile. The charge on the manager's office door has gone: the pair's lights come through its smoke, the captor drops by the desk, a hostage on the floor beyond it
  query: 'rescue' + Q, quality: 'medium', frames: 8,
  play: `ms.go([22.6, 0, 11.1]); ms.sim(25, () => ms.arrived());
         ms.order('charge', 'manager'); ms.must(ms.sim(40, () => g.doorTools.ops.some(o => o.phase === 'armed')), 'the charge');
         ms.tap('KeyF'); await ms.lead(2);
         return ms.sim(15, () => ms.ops().some(x => x.char.pos[2] < 9.5 && x.char.pos[0] > 22.2 && x.char.pos[0] < 30));`,
  cam: { look: [26.65, 1, 7.15], yaw: 2.2, pitch: 0.8, dist: 7.3 } };

R['rescue-registry'] = { // the game's own view, after the charge: the pair in the registrar's office with their lights on, its door flat on the rug, a hostage alive in the corner
  query: 'levelFile=registry.json&rescue' + Q, quality: 'medium', frames: 8,
  play: `ms.order('fallIn', ms.sam()); ms.go([26.6, 0, 8.6]); ms.sim(24, () => ms.arrived() || ms.sam()[0] > 25.5);
         ms.order('charge', 'office'); ms.must(ms.sim(30, () => g.doorTools.ops.some(o => o.phase === 'armed')), 'the charge');
         ms.tap('KeyF'); await ms.lead(2);
         ms.must(ms.sim(15, () => ms.ops().filter(x => x.char.pos[0] > 29.3 && x.char.pos[2] < 12.6).length >= 2), 'two men in the office'); return ms.sim(11);`,
  cam: { look: [32.0, 1, 7.7], yaw: 0.25, pitch: 1.0, dist: 11 } };

R['rescue-consulate'] = { // dusk; the four in by the suite's side door behind a can, from inside the suite: the first man in, the second in the doorway, their lights in the can's smoke
  query: 'levelFile=consulate.json&rescue&squad=4&hour=dusk' + Q, quality: 'medium', frames: 8,
  play: `ms.approach('suite_side', 3.4, 26); ms.order('bangClear', 'suite_side'); const t0 = g.time; ms.must(ms.sim(14, () => ${bang('suite_side')}), 'the can');
         return ms.sim(8, () => ms.ops().filter(x => x.char.pos[0] > 29.3).length >= 2);`,
  cam: { look: [30.7, 1.0, 17.0], yaw: Math.PI / 2 - 0.25, pitch: 0.16, dist: 4.6 } };

R['snatch-four'] = {    // dawn; Sam's rounds at the hut wake the house, the man runs for the side door and meets the stack coming in: on his knees in their lights
  query: 'levelFile=snatch.json&roomclear&squad4&hour=dawn' + Q, quality: 'medium', frames: 8,
  play: `const sn = g.snatch, d = ms.door('side'); ms.approach('side', 3.5, 45); ms.go([27.8, 0, 10.6]); ms.sim(6, () => ms.arrived());
         const t8 = ms.man('Tango 8'); let n = 0; ms.sim(10, () => { ms.aim([t8.char.pos[0], 1.2, t8.char.pos[2]]); if (n++ % 9 === 4) ms.fire(); return false; });
         ms.go([28.4, 0, 12.2]); ms.order('openClear', 'side');
         return ms.sim(14, () => Math.abs(d.angle) > 0.9 && ms.ops().some(x => x.char.pos[0] < 26.3) && !!sn.tied);`,
  cam: { look: [25.3, 1.05, 10.8], yaw: -1.3, pitch: 0.3, dist: 5.3 } };

R['defuse-four'] = {    // grey day; the west shop taken by its back door, Sam's hands on the charge at the bench with the clock running, a teammate's gun on the room beside him
  query: 'levelFile=defuse.json&roomclear&squad4&hour=overcast' + Q, quality: 'medium', frames: 8,
  play: `ms.approach('back_1', 3.4, 45); ms.order('bangClear', 'back_1'); const t0 = g.time; ms.must(ms.sim(25, () => ${bang('back_1')}), 'the can');
         const t3 = ms.man('Tango 3'), t4 = ms.man('Tango 4'); ms.sim(12, () => t3.state === 'dead' && t4.state === 'dead');
         ms.go([8.5, 0, 8.6]); ms.sim(12, () => ms.arrived());
         ms.order('move', [9.4, 0, 10.4]); ms.sim(4.5, () => ms.ops().filter(x => x.char.pos[0] > 6.3).length >= 2);
         ms.aim([8.5, 0.9, 7.65]); ms.sim(0.2); ms.verb('objective', 'defuse'); ms.sim(3.0); return { hit: !!g.defuse.sam };`,
  cam: { look: [8.9, 0.95, 8.1], yaw: -0.6, pitch: 0.4, dist: 4.3 } };
R['killhouse-four'] = { // midday; both pairs set on facing doors of the plywood hall, the word given: the first man through the tyre room's door fires
  query: 'levelFile=killhouse.json&roomclear&squad4&hour=midday' + Q, quality: 'medium', frames: 8,
  play: `ms.order('fallIn', ms.sam()); ms.go([13.6, 0, 13.3]); ms.sim(14, () => ms.arrived());
         ms.order('openClear', 'tyres', 'red', { onWord: true }); ms.order('openClear', 'store', 'blue', { onWord: true });
         ms.must(ms.sim(14, () => g.doorTools.ops.filter(o => o.phase === 'ready').length >= 2), 'both pairs ready');
         ms.tap('KeyF'); await ms.lead(1);
         return ms.sim(8, () => ms.shotNow() && ms.shooters().some(x => x.char.pos[2] < 12.2 && x.char.pos[0] < 16));`,
  cam: { look: [14.7, 1.0, 10.8], yaw: -2.475, pitch: 0.27, dist: 3.9 } };

// ── Quiet, alone ── (Sam is the subject: the camera stays with him)
R['solo-night'] = {     // the group's tile. Through his own goggles: Sam low at the back of the corridor man on his round, the next man ahead of him, the tripwire's line beyond
  query: 'solo' + Q, quality: 'medium', frames: 8,
  play: `ms.tap('KeyC'); ms.sim(0.2); const k = ms.man('Kowalski'); ms.must({ hit: ms.stalk(k, { near: 1.5, off: 0.9, secs: 45 }).why === 'behind' }, 'behind him at the end of the corridor');
         ms.sim(2.2); ms.go([34.3, 0, 10.65]); ms.sim(4, () => ms.arrived()); ms.sim(0.3);
         ms.tap('KeyN'); const r = ms.stalk(k, { near: 2.5, off: 2.0, secs: 8 }); return { hit: k.state === 'patrol', r };`,
  cam: `const p = ms.man('Kowalski').char.pos, s = ms.sam(); ms.cam({ look: [p[0] + 0.9, 0.95, 11.2], yaw: Math.PI / 2 - 0.07, pitch: 0.24, dist: (s[0] - p[0]) + 1.75 });` };
R['bazaar-quiet'] = {   // in by the north gate behind the man on his round, and down the alley after him to its mouth: Sam low a stride and a half off his back, his torch on the street and the shop fronts across it
  query: 'levelFile=bazaar.json&quiet' + Q, quality: 'medium', frames: 8,
  play: `ms.tap('KeyC'); ms.sim(0.2); const n = ms.man('Novak'); ms.must(ms.sim(40, () => n.char.pos[0] < 24.5), 'his round'); ms.sim(20, () => n.char.pos[0] < 20.0);
         ms.stalk(n, { near: 2.4, off: 1.8, secs: 30 }); const r = ms.stalk(n, { near: 1.5, off: 1.1, secs: 12 }); return { hit: r.why === 'behind', r };`,
  cam: `const n = ms.man('Novak').char.pos, s = ms.sam(), d = Math.hypot(s[0] - n[0], s[2] - n[2]), u = [(s[0] - n[0]) / d, (s[2] - n[2]) / d];   // over Sam's shoulder, on the line from the man back to him
        ms.cam({ look: [n[0] + u[0] * 0.31, 1.08, n[2] + u[1] * 0.31], yaw: Math.atan2(u[0], u[1]) - 0.25, pitch: 0.33, dist: 3.95 });` };
R['police-post-quiet'] = { // round the post to its east door while the perimeter man is on the far side: he comes back down the east wall with his torch, Sam low and still in the dark at the door
  query: 'levelFile=police-post.json&quiet' + Q, quality: 'medium', frames: 8,
  play: `const k = ms.man('Kowalski'), P = () => k.char.pos; ms.must(ms.sim(90, () => P()[0] < 11 && P()[2] > 9.5), 'his round');
         ms.go([31.8, 0, 13.3]); ms.must(ms.sim(50, () => ms.arrived()), 'the east door'); ms.tap('KeyC'); ms.aim([31, 1, 13.3]); ms.sim(0.4);
         ms.must(ms.sim(40, () => P()[0] > 32.6 && P()[2] > 7.4), 'his way back'); const r = ms.sim(2.9); return { hit: k.state === 'patrol', r };`,
  cam: { look: [32.15, 0.85, 11.4], yaw: 0.2, pitch: 0.19, dist: 6.0 } };
R['vault-quiet'] = {       // at the strongroom's back door when the man with the torch comes in by the gate: Sam's pistol goes off across the tripwire's corner of the yard (the game's own view)
  query: 'levelFile=vault.json&quiet' + Q, quality: 'medium', frames: 8,
  play: `ms.tap('KeyC'); ms.sim(0.2); ms.go([24.75, 0, 15.3]); ms.must(ms.sim(40, () => ms.arrived()), 'the back door');
         const b = ms.man('Brandt'), B = () => b.char.pos, d = () => Math.hypot(B()[0] - ms.sam()[0], B()[2] - ms.sam()[2]);
         ms.tap('Digit1'); ms.sim(0.8); ms.must(ms.sim(12, () => d() < 4.2 && b.state !== 'patrol'), 'he comes to look');
         ms.aim([B()[0], 1.3, B()[2]]); ms.sim(1.5); ms.aim([B()[0], 1.3, B()[2]]); ms.fire(); await ms.lead(1); return { hit: true, d: d() };`,
  cam: { look: [26.9, 0.6, 14.45], yaw: 0.25, pitch: 0.95, dist: 6.8 } };
R['quiet-yard-alone'] = {  // dusk; the yard's man shot from behind on his round, and Sam walking his body out of the open over his shoulder
  query: 'levelFile=quiet-yard.json&quiet&hour=dusk' + Q, quality: 'medium', frames: 8,
  play: `ms.tap('KeyC'); ms.sim(0.2); const k = ms.man('Kowalski'), K = () => k.char.pos;
         ms.go([20.3, 0, 21.2]); ms.sim(8, () => ms.arrived()); ms.tap('Digit1'); ms.sim(0.9);
         ms.must(ms.sim(60, () => K()[0] < 19.5 && K()[0] > 15 && K()[2] < 14.5), 'his back'); ms.go([20.6, 0, 15.0]); ms.sim(10, () => ms.arrived());
         for (let i = 0; i < 4 && k.state !== 'dead'; i++) { ms.aim([K()[0], 1.55, K()[2]]); ms.sim(0.5); ms.aim([K()[0], 1.55, K()[2]]); ms.fire(); ms.sim(0.15); }
         ms.must({ hit: k.state === 'dead' }, 'the man in the yard down'); ms.sim(0.6);
         ms.go([K()[0] + 1.0, 0, K()[2] + 0.1]); ms.sim(12, () => ms.arrived()); ms.sim(0.3); ms.must({ hit: ms.verb('body', 'drag') }, 'the body'); ms.sim(6.3);
         ms.go([13.6, 0, 19.6]); ms.sim(2.6); return { hit: !!(g.player.haul && g.player.haul.carry) };`,
  cam: `const s = ms.sam(); ms.cam({ look: [s[0] + 0.3, 1.0, s[2]], yaw: 0.75, pitch: 0.13, dist: 5.2 });` };

// ── Quiet, as two ── (the pair is the subject)
R['quiet-crossing-two'] = { // the group's tile. In by the south gate, the partner sent up on the checkpoint's man 'on your mark', the mark given: his blow lands under the lamp, Sam low behind the crates
  query: 'levelFile=crossing.json&quiet&squad=1' + Q, quality: 'medium', frames: 8,
  play: `ms.tap('KeyC'); ms.sim(0.2); ms.go([16.3, 0, 21.6]); ms.must(ms.sim(20, () => ms.arrived()), 'the crates'); ms.sim(6);
         const k = ms.man('Kowalski'), m = ms.ops()[0], d = () => Math.hypot(m.char.pos[0] - k.char.pos[0], m.char.pos[2] - k.char.pos[2]);
         window.__orders.give('pairMark', { kind: 'foe', at: [k.char.pos[0], 0, k.char.pos[2]], foe: k }, 'all'); ms.must(ms.sim(30, () => d() < 1.45), 'the partner set at his back');
         ms.tap('KeyF'); const r = ms.sim(12, () => k.state === 'dead'); return { hit: r.hit && k.downKind === 'struck', r };`,
  cam: { look: [16.1, 0.85, 18.8], yaw: 0.1, pitch: 0.24, dist: 5.4 } };
R['lights-out-two'] = {     // the partner sent to throw the breaker: the yard goes black, and the man who comes to look walks his torch into the shed where the pair wait in the dark
  query: 'levelFile=lights-out.json&quiet&squad=1' + Q, quality: 'medium', frames: 8,
  play: `ms.tap('KeyC'); ms.sim(0.2); ms.go([11.6, 0, 15.4]); ms.must(ms.sim(25, () => ms.arrived()), 'the shed'); ms.sim(1.5);
         const nr = g.work.near([13.15, 0, 16.4]); ms.must({ hit: !!nr }, 'the breaker'); window.__orders.give('work', nr.target, 'all');
         ms.must(ms.sim(40, () => g.blackout && g.blackout.active), 'the mains thrown');
         const o = ms.man('Okafor'), D = () => Math.hypot(o.char.pos[0] - 10, o.char.pos[2] - 16.3), loud = () => o.state === 'alert' || o.state === 'dead';
         ms.must(ms.sim(40, () => D() < 3.2 || loud()), 'he comes to look'); ms.aim([10, 1.2, 16.3]);
         ms.sim(8, () => D() < 1.5 || loud()); const r = ms.sim(8, () => o.char.pos[0] > 10.5 || loud()); return { hit: r.hit && !loud(), r };`,
  cam: { look: [11.75, 0.9, 16.05], yaw: 0.22, pitch: 0.85, dist: 5.0 } };
R['quiet-relay-two'] = {    // night; the picket marked for the partner and put out from behind on a word, the lens over the hut's door put dark by the pistol's OCP, Sam on a knee at the lock in the door lamp's pool
  query: 'levelFile=quiet-relay.json&quiet&squad=1' + Q, quality: 'medium', frames: 8,
  play: `const k = ms.man('Novak'), m = ms.ops()[0], d = () => Math.hypot(m.char.pos[0] - k.char.pos[0], m.char.pos[2] - k.char.pos[2]);
         ms.tap('KeyC'); ms.sim(0.2); ms.go([13.4, 0, 13.4]); ms.sim(4);
         window.__orders.give('pairMark', { kind: 'foe', at: [k.char.pos[0], 0, k.char.pos[2]], foe: k }, 'all'); ms.sim(40, () => ms.arrived());
         ms.must(ms.sim(60, () => d() < 1.45), 'the partner set behind the picket'); ms.tap('KeyF'); ms.must(ms.sim(12, () => k.state === 'dead'), 'the picket down');
         ms.go([13.6, 0, 15.1]); ms.sim(10, () => ms.arrived()); ms.tap('Digit1'); ms.sim(0.8); ms.aim([18.7, 2.7, 14.7]); ms.sim(0.5); window.__click(2); ms.sim(0.6); ms.tap('KeyE'); ms.sim(0.5);
         ms.go([16.77, 0, 15.15]); ms.sim(10, () => ms.arrived()); ms.aim([16.77, 1, 14.5]); ms.sim(0.3); ms.must({ hit: ms.verb('door', 'pick') }, 'the lock');
         const r = ms.sim(1.5), cam = g.devices.cameras.find(c => c.def.name === 'cam_door');
         return { hit: !!g.player.picking && k.downKind === 'struck' && cam.target.factor === 0 && g.guards.every(x => x.unit || x.state === 'dead' || (x.state === 'patrol' && x.awareness < 0.3)), r };`,
  cam: { look: [18.3, 0.9, 16.3], yaw: -1.55, pitch: 0.12, dist: 6.5 } };
R['quiet-yard-two'] = {     // dusk; the yard's man taken from behind on his round just inside the south gate and turned in off the gateway, Sam's arm round his neck; the partner in the gateway behind, covering the way in
  query: 'levelFile=quiet-yard.json&quiet&squad=1&hour=dusk' + Q, quality: 'medium', frames: 8,
  play: `ms.tap('KeyC'); ms.sim(0.2); const k = ms.man('Kowalski'), K = () => k.char.pos;
         ms.must(ms.sim(80, () => K()[2] > 19.6 && K()[0] > 14.5 && K()[0] < 17), 'his round'); ms.stalk(k, { near: 0.9, off: 0, secs: 25 });
         let held = false; for (let i = 0; i < 30 && !held; i++) { held = ms.verb('guard', 'grab'); ms.sim(0.15); } ms.must({ hit: held }, 'the grab'); ms.sim(1.5);
         ms.verb('held', 'question'); ms.sim(5); ms.aim([19.6, 0, 15]); ms.sim(1.2);
         const m = ms.ops()[0]; return { hit: !!m && m.char.pos[2] > 22.4 && (g.nearby || []).some(r => r.kind === 'held'), at: ms.sam() };`,
  cam: { look: [19.45, 1.1, 20.9], yaw: Math.PI - 0.42, pitch: 0.27, dist: 4.1 } };


module.exports = R;
