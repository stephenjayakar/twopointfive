import { SideSet } from '../math/side';
// Decals laid only for the picture (scorch, wear, soot): tagged here so the digest counts the marks play lays and no others.
export const LOOK_DECALS = new SideSet<object>('lookDecals.LOOK_DECALS');
export function lookDecal<T extends object>(d: T | null): T | null { if (d) LOOK_DECALS.add(d); return d; }
