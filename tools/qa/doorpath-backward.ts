// THE DOOR WALK LETTING AN ENTRY GO BACK TO FRONT — preloaded in front of the watched runs by doorpath-probes.ts `doorpath-file` under
// DOORPATH_FILE_BREAK=1 (bun run --preload), never imported. The walk lets only the HEAD of an entry's queue go (doorpath.ts mayGo: i === 0), once the
// man before him has made room. Here only the TAIL may go, by that same room rule: the men are dealt in one order and let go in the other, and
// doorpath-file must read them as crossing out of turn. Like doorpath-inert.ts this makes doorpath.ts the first game module the process evaluates —
// safe while it imports nothing but types, which doorpath-off checks.
import { DoorPath } from '../../src/game/doorpath';

const P = DoorPath.prototype as unknown as { mayGo(op: { queue: unknown[] }, q: unknown, i: number): boolean }, mayGo = P.mayGo;
if (typeof mayGo !== 'function') throw new Error('doorpath-backward: DoorPath has no mayGo() — this red path is out of date');
P.mayGo = function (op, q, i) { return i === op.queue.length - 1 && mayGo.call(this, op, q, 0); };
