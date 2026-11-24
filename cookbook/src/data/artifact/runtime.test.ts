import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from './runtime';

describe('CAPABILITIES.sample', () => {
  it('declares sample with images so the photo import may send a picture (catches a manifest without images: true)', () => {
    expect(CAPABILITIES.sample).toEqual({ images: true });
  });
});
