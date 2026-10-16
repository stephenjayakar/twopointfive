// Decals laid only for the picture (scorch, wear, soot): tagged here so the digest counts the marks play lays and no others.
export const LOOK_DECALS = new WeakSet<object>();
export function lookDecal<T extends object>(d: T | null): T | null { if (d) LOOK_DECALS.add(d); return d; }
