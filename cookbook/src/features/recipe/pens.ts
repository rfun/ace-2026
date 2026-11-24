export type Pen = 'navy' | 'green' | 'violet' | 'graphite';

const PENS: readonly Pen[] = ['navy', 'green', 'violet', 'graphite'];

/** Deterministic ink for a person: FNV-1a hash of the id, folded onto the four pens. */
export function penFor(userId: string): Pen {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i += 1) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // fold the high bits down so short, similar ids still spread across the four pens
  h = (h ^ (h >>> 16)) >>> 0;
  return PENS[h % PENS.length];
}
