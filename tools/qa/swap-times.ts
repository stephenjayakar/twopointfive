// HOW LONG EVERY CHANGE OF HANDS TAKES (a listing, not a check: it always exits 0).
//
//   bun run tools/qa/swap-times.ts            (markdown on stdout; ~2 min)
//
// The gun swap is the reference (character.ts KIT, kitanim.ts): the big slot's tools are weighed against it (src/game/kit.ts BIGSLOT.weight, bigkit.ts).
// Printed: the gun swaps as the game steps them, then the hammer and the breaching shotgun out of each thing YOU can have in your hands — your own gun to
// its place, the tool in your hands, the blow or the shell, the tool back, your gun up again — with the weight on and with it off (the build before), taken a
// step from the door and from where a stack's second man stands. The kit's own hand is raised by hand where the stand holds it off, so both stands print the
// same table. Headless: times off the game's clock, nothing here is a picture.
import { walkTo, gunSwap } from './bigslot-check.ts';

const f = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '?');
const out: string[] = ['# How long every change of hands takes', '', 'Seconds, off the game\'s own clock. "Front" = the rifle on its sling in front (a loud mission); "back" = across his back.', ''];
out.push('## The gun swap (the reference)', '', '| Swap | Seconds |', '|---|---|');
for (const [to, front] of [['rifle', false], ['pistol', false], ['rifle', true], ['pistol', true]] as const)
  out.push(`| ${to === 'rifle' ? 'pistol to rifle' : 'rifle to pistol'}, the rifle ${front ? 'in front' : 'on his back'} | ${f(await gunSwap(to, front))} |`);
const HANDS = [['empty hands', undefined, undefined], ['pistol', 'pistol', undefined], ['rifle, front', 'rifle', true], ['rifle, back', 'rifle', false]] as const;
for (const tool of ['hammer', 'shotgun'] as const) {
  out.push('', `## The ${tool === 'hammer' ? 'hammer' : 'breaching shotgun'}, you`, '', `| In your hands | From | | Own gun to its place | Tool in your hands at | ${tool === 'hammer' ? 'The blow' : 'The shell'} at | Tool back in | Gun up again after the ${tool === 'hammer' ? 'blow' : 'shell'} | Row to gun up |`, '|---|---|---|---|---|---|---|---|---|');
  for (const [name, hand, front] of HANDS) for (const [where, from] of [['a step from the door', [0.86 + 0.35, 0.6]], ['the stack\'s second place', [0.86 + 1.5, 0.6]]] as const) for (const noweight of [true, false]) {
    const r = await walkTo(61, tool, 'push', [from[0], from[1]], { hand, front, noweight, kit: true });
    const hit = r.landed[0] + r.lead;
    out.push(`| ${name} | ${where} | ${noweight ? 'before' : '**now**'} | ${r.lead > 0 ? f(r.lead) : r.held ? 'at once' : 'nothing to put away'} | ${f(r.lead + r.rec.equip)} | ${f(hit)} | ${f(r.rec.stow)} | ${f(r.gunAt)} | ${f(hit + r.gunAt)} |`);
  }
}
console.log(out.join('\n'));
process.exit(0);
