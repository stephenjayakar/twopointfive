// NO PLACE OF A STACK IS DEALT ONTO A PIECE OF FURNITURE (doorway.ts DOORMANNERS.offFurniture; orders.ts onFurniture, asked in stackPlaces / rearPosts).
//   bun run tools/qa/stack-furniture-check.ts [id …] [--walks 4]        exit 0 = every line PASS, 1 = a FAIL line     (no id: the ten squad levels below)
// Headless, on the door rules' stand (the five door switches on, set below before anything is imported): nothing here looks at a picture.
//   places  every door of each level, both faces, the level's own team, Sam away and on each jamb: the stack's places asked with the rule OFF and ON.
//           OFF some places lie on a prop's footprint (the fault, counted: it must be there to be mended). ON: none does, but where keeping off the
//           furniture would leave the door 'no room' (then the set is the OFF set, whole: counted); no face that had places is refused 'no room' for
//           it; and a set that had no place on furniture is the same set (nothing else moves)
//   walk    the faces whose OFF set has a place on the most boxed-in furniture, PLAYED both ways: the men put on that face's floor a few metres back, Sam on the jamb
//           the set was asked with, 'stack' given, 14 s. OFF: counted, the men who end resting 0.35 to 1 m off the mark they were dealt (a carton on
//           open floor is shoved aside and is no fault; one wedged in a corner pushes the man back, his mark comes to him and the man behind is held
//           off his own). ON: no man ends so, and no more men than OFF are still a metre or more off. (How many rest short with the rule OFF is printed, not
//           judged: it hangs on where the levels' cartons stand, and they get moved)
export {};   // (a module: the top-level awaits below need it for the tools/qa typecheck)
for (const k of ['QA_DOORMANNERS', 'QA_DOORSTAY', 'QA_DOORBLAST', 'QA_FRAMEHOLDS', 'ONEWAY']) process.env[k] ??= '1';
const { ROOT } = await import('./headless.ts');
const BT: any = await import('./bang-tally.ts');
const { DOORMANNERS } = await import(`${ROOT}/src/game/doorway.ts`);
if (process.env.OWNPLACE_BREAK) BT.setKnobs({ DOORMANNERS: { ownPlace: false } });   // (OWNPLACE_BREAK=1: a man on his own mark is walked into again — the played line must go red where the stack's second rank stands in a mate's way)
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { FUR_M } = await import(`${ROOT}/src/game/orders.ts`);

const VERBOSE = process.argv.includes('--verbose');
const argv = process.argv.slice(2), WALKS = (() => { const i = argv.indexOf('--walks'); return i >= 0 ? +argv[i + 1] : 4; })();
const named = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--walks');   // (--verbose: every man of a played face who is still a metre or more off his mark, with where he is)
const IDS = named.length ? named : ['room-clear-four', 'hostage-rescue', 'depot-four', 'block-four', 'warehouse-four', 'compound-four', 'barracks-four', 'rescue-registry', 'rescue-consulate', 'records-pair'];
type V = number[];
const flat = (a: V, b: V) => Math.hypot(a[0] - b[0], a[2] - b[2]), at = (p: V) => `(${p[0].toFixed(2)}, ${p[2].toFixed(2)})`;
const log = console.log, quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = e; console.warn = w; } };
let all = true; const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
/** the check's own reading of 'on a piece of furniture': the point is inside a prop's footprint grown by `grow` (a centimetre inside the game's keep-off:
 *  a place on its very edge is not argued about) */
const propAt = (g: any, p: V, grow = FUR_M - 0.01): any => (g.props.props as any[]).find(q => { const dx = p[0] - q.x, dz = p[2] - q.z, lx = q.cs * dx - q.sn * dz, lz = q.sn * dx + q.cs * dz;
  return Math.hypot(Math.max(0, Math.abs(lx) - q.hx), Math.max(0, Math.abs(lz) - q.hz)) < grow; }) ?? null;
/** how boxed in a prop is: of eight points a hand past its rim, how many are wall to the nav grid (a carton out on open floor is shoved aside and costs
 *  nobody his mark; one in a corner is not) */
const wedged = (g: any, q: any): number => { let n = 0; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = q.radius + 0.25; if (g.col.nav.isBlocked(q.x + Math.cos(a) * r, q.z + Math.sin(a) * r)) n++; } return n; };
const stage = async (id: string) => { const S: any = await quiet(() => BT.stage(id, 1)); const g = S.g; for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile') await quiet(() => killGuard(g, x, [0, 0, 1], true)); return S; };
const frame = (d: any, side: 1 | -1) => { const th = d.def.closedDir, u = [Math.cos(th), Math.sin(th)], n = [-u[1] * side, u[0] * side], c = d.frameCentre as V;
  return { pt: (along: number, back: number): V => [c[0] + n[0] * back + u[0] * along, 0, c[2] + n[1] * back + u[1] * along] }; };
const same = (a: any[], b: any[]) => a.length === b.length && a.every(p => b.some(q => flat(p.pos, q.pos) < 0.02));

log(`=== stack-furniture-check: ${IDS.join(', ')} ===`);
interface Case { id: string; door: string; side: 1 | -1; where: string; sam: V; wedge: number }
const cases: Case[] = []; let faces = 0, sets = 0, marksOff = 0, onOff = 0, onOn = 0, noneOff = 0, noneOn = 0, lost = 0, moved = 0, kept = 0, keptN = 0, rearN = 0; const bad: string[] = [], shown: string[] = [];
for (const id of IDS) {
  let S: any; try { S = await stage(id); } catch (e) { all = false; log(`- FAIL — ${id} does not stage: ${(e as Error).message.slice(0, 120)}`); continue; }
  const g = S.g, O = g.orders, K = O.knobs, men: any[] = O.squad().filter((x: any) => x.state !== 'dead'), home: V = [...g.player.char.pos];
  for (const d of g.doors.list) for (const side of [1, -1] as const) { const F = frame(d, side), h = d.def.width / 2; let any = false;
    for (const [where, sam] of [['Sam away', [1e4, 0, 1e4]], ['Sam on a jamb', F.pt(h + K.jambPast, K.jambOut)], ['Sam on the other jamb', F.pt(-h - K.jambPast, K.jambOut)]] as [string, V][]) {
      g.player.char.pos[0] = sam[0]; g.player.char.pos[2] = sam[2];
      DOORMANNERS.offFurniture = false; const off: any[] | null = await quiet(() => O.stackPosts(d, side, men));
      DOORMANNERS.offFurniture = true; const on: any[] | null = await quiet(() => O.stackPosts(d, side, men));
      const tag = `${id} ${d.def.name}${side > 0 ? '+' : '−'}, ${where}`;
      if (!off) { noneOff++; if (!on) noneOn++; continue; } any = true; sets++; marksOff += off.length;
      const hit = off.filter(P => propAt(g, P.pos)); onOff += hit.length;
      if (!on) { noneOn++; lost++; bad.push(`${tag}: refused with the rule on`); continue; }
      const still = on.filter(P => propAt(g, P.pos));
      // (a REAR place — the second rank's, orders.ts rearPosts — is dealt off the furniture first and on it only when the floor behind the door has no other:
      //  such a place is the rule-off set's own place, kept, while the set as a whole has fewer places on furniture than it had)
      const rearKept = (P: any) => P.group === 2 && off.some(q => flat(P.pos, q.pos) < 0.02) && still.length < hit.length;
      if (still.length && same(off, on)) { kept++; keptN += still.length; }   // (no other floor for this stack: the old set, furniture and all — never a refusal)
      else for (const P of still) { if (rearKept(P)) { rearN++; continue; } onOn++; bad.push(`${tag}: ${at(P.pos)} is on ${propAt(g, P.pos).def.name} with the rule on`); }
      if (!off.some(P => propAt(g, P.pos, FUR_M + 0.01)) && !same(off, on)) { moved++; bad.push(`${tag}: no place was on furniture, and the set changed`); }
      if (hit.length) { if (shown.length < 6) shown.push(`${tag}: ${at(hit[0].pos)} on ${propAt(g, hit[0].pos).def.name}`); cases.push({ id, door: d.def.name, side, where, sam, wedge: Math.max(...hit.map(P => wedged(g, propAt(g, P.pos)))) }); }
    }
    if (any) faces++; }
  g.player.char.pos[0] = home[0]; g.player.char.pos[2] = home[2];
}
verdict(onOff > 0, 'the fault is there with the rule off', `${faces} door faces with places, ${sets} sets asked (Sam away and on each jamb), ${marksOff} places: ${onOff} lie on a piece of furniture in ${cases.length} sets — e.g. ${shown.join(' · ')}`);
const mended = cases.length - kept;   // (sets the rule really changed: with none, an inert rule would pass every line below)
verdict(mended > 0 && onOn === 0 && lost === 0 && moved === 0, 'with the rule on a place is on furniture only where the door has no other floor for its stack, no face is refused for it, and nothing else moves', `${mended} of ${cases.length} sets dealt off the furniture · ${onOn} places on furniture beside ${keptN} in ${kept} sets kept whole as they were for want of other floor and ${rearN} rear places kept in sets that lost another · ${lost} sets refused that had places ('no room' ${noneOff} off, ${noneOn} on) · ${moved} sets changed that had no place on furniture${bad.length ? ` — ${bad.slice(0, 12).join(' · ')}` : ''}`);

// ---------------------------------------------------------------- walk
const SHORT = 0.35, FAR = 1.0;   // (orders.ts's own band: between these a man who has stopped moving is 'as near his mark as he will get' and the mark comes to him; further off he is still on his way)
{ let played = 0, shortOff = 0, shortOn = 0, farOff = 0, farOn = 0; const tell: string[] = [], badOn: string[] = [];
  const walk = async (C: Case, rule: boolean): Promise<{ short: string[]; far: number; n: number } | null> => {
    const S = await stage(C.id), g = S.g, O = g.orders, d = g.doors.byName(C.door), men: any[] = O.squad().filter((x: any) => x.state !== 'dead'), F = frame(d, C.side), nav = g.col.nav;
    DOORMANNERS.offFurniture = rule;
    const spots: V[] = []; for (let back = 2.6; back < 7 && spots.length < men.length; back += 0.9) for (const along of [-0.7, 0.7]) { if (spots.length >= men.length) break; const p = F.pt(along, back);
      if (nav.isBlocked(p[0], p[2]) || g.col.solidBlocked([d.frameCentre[0], 0.45, d.frameCentre[2]], [p[0], 0.45, p[2]]) || propAt(g, p, 0.4) || flat(p, C.sam) < 1.2) continue; spots.push(p); }
    if (spots.length < men.length) return null;   // (no floor to put the men on in front of this face: another case is played)
    men.forEach((m, i) => { m.char.pos[0] = spots[i][0]; m.char.pos[2] = spots[i][2]; m.path = []; m.pathGoal = null; });
    if (C.where !== 'Sam away') await quiet(() => g.teleportPlayer([C.sam[0], 0, C.sam[2]]));   // ('away' = where the level starts him: a teleport to nowhere would land him on the nearest floor, which may be this door's)
    await quiet(() => S.step(3));
    const why = await quiet(() => O.give('stack', { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side: C.side }, 'all')); if (why) return null;
    const posts = men.map(m => O.of(m)?.post as V | null); if (posts.some(p => !p)) return null;
    { const c = d.frameCentre as V, q = F.pt(0, 1), nx = q[0] - c[0], nz = q[2] - c[2]; if (posts.some(p => (p![0] - c[0]) * nx + (p![2] - c[2]) * nz < 0)) return null; }   // (the order took the door's OTHER face — the squad of four's own pick: a walk round the building, which fourteen seconds do not hold. Another case is played)
    await quiet(() => { for (let f = 0; f < 14 * 60; f++) S.step(1); });
    const short: string[] = []; let far = 0; men.forEach((m, i) => { const gap = flat(m.char.pos, posts[i]!); if (gap >= FAR) { far++; if (VERBOSE) log(`    (far) ${C.id} ${C.door}${C.side > 0 ? '+' : '−'}, ${C.where}, rule ${rule ? 'on' : 'off'}: ${m.callsign} at ${at(m.char.pos)} is ${gap.toFixed(2)} m off ${at(posts[i]!)}, now ${O.of(m)?.post ? at(O.of(m).post) : 'no mark'}${O.of(m)?.arrived ? ' (arrived)' : ''}`); } else if (gap >= SHORT) short.push(`${m.callsign} ${gap.toFixed(2)} m off ${at(posts[i]!)}`); });
    return { short, far, n: men.length };
  };
  for (const C of [...cases].sort((a, b) => b.wedge - a.wedge)) { if (played >= WALKS) break;   // (the most boxed-in furniture first: that is where the fault shows)
    const off = await walk(C, false); if (!off) continue; const on = await walk(C, true); if (!on) continue; played++;
    shortOff += off.short.length; shortOn += on.short.length; farOff += off.far; farOn += on.far; const tag = `${C.id} ${C.door}${C.side > 0 ? '+' : '−'}, ${C.where}`;
    tell.push(`${tag}: off ${off.short.length ? off.short.join(', ') : 'all on their marks'}`); if (on.short.length) badOn.push(`${tag}: ${on.short.join(', ')}`); }
  DOORMANNERS.offFurniture = true;
  verdict(played > 0 && shortOn === 0 && farOn <= farOff, 'played with the rule on, no man rests short of the mark he was dealt, and no more are still on their way', `${played} faces played both ways, 14 s each: ${shortOn} men short with the rule on (${farOn} a metre or more off, ${farOff} with it off)${badOn.length ? ` — ${badOn.join(' · ')}` : ''}; with it off ${shortOff} (${tell.join(' · ')})`);
}
log(all ? '=== stack-furniture-check: ALL PASS ===' : '=== stack-furniture-check: FAIL ===');
process.exit(all ? 0 : 1);
