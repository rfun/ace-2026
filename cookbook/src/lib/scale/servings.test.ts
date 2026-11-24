import { beforeEach, describe, expect, it } from 'vitest';
import { clampServings, readServings, writeServings } from './servings';

beforeEach(() => window.sessionStorage.clear());

describe('servings handoff', () => {
  it('returns the original when nothing is stored', () => {
    expect(readServings('r1', 4)).toBe(4);
  });
  it('round-trips a choice per recipe id (catches one recipe leaking its servings into another)', () => {
    writeServings('r1', 6, 4);
    expect(readServings('r1', 4)).toBe(6);
    expect(readServings('r2', 4)).toBe(4);
  });
  it('choosing the original forgets the choice', () => {
    writeServings('r1', 6, 4);
    writeServings('r1', 4, 4);
    expect(window.sessionStorage.getItem('cookbook.servings.r1')).toBeNull();
  });
  it.each(['0', '101', '2.5', 'abc', '', '-3'])('ignores stored garbage %j (catches NaN or 0 factors)', (raw) => {
    window.sessionStorage.setItem('cookbook.servings.r1', raw);
    expect(readServings('r1', 4)).toBe(4);
  });
  it('clamps to 1..100', () => {
    expect(clampServings(0)).toBe(1);
    expect(clampServings(150)).toBe(100);
    expect(clampServings(7.4)).toBe(7);
  });
});
