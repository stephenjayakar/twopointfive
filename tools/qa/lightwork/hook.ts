// lightwork/hook — the ONE wrap of tools/qa/framecost-hooks.ts's per-frame call (globalThis.__FCG.frame) the lightwork preloads share: afterFrame(fn) runs fn(W, n)
// after every frame of the scripted play, in the order the preloads registered, whichever of them loaded first and whether __FCG existed yet or not.
const G = globalThis as any;
type Fn = (W: any, n: number) => void;
export const afterFrame = (fn: Fn): void => {
  const fns: Fn[] = (G.__lwAfter ??= []); fns.push(fn);
  if (fns.length > 1) return;   // (already wrapped, or waiting to)
  let n = 0;
  const wrap = (F: any): boolean => { if (!F?.frame || F.__lw) return !!F?.__lw; F.__lw = true; const frame = F.frame.bind(F); F.frame = (W: any, dt: number, follow: any) => { frame(W, dt, follow); for (const f of fns) f(W, n); n++; }; return true; };
  // __FCG is assigned when the harness stands its GPU stand-in up (framecost-gpu.ts, imported late, with no tick in between for a timer to run): catch the assignment itself
  if (!wrap(G.__FCG)) Object.defineProperty(G, '__FCG', { configurable: true, get() { return undefined; }, set(v) { Object.defineProperty(G, '__FCG', { value: v, writable: true, configurable: true }); wrap(v); } });
};
