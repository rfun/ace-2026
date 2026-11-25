import { describe, expect, it } from 'vitest';
import { adjustStats, countLine, shelfStateOf } from './counts';

describe('countLine', () => {
  it('is empty when both counts are zero (catches a "Made by 0 · 0 want to make" line on every new card)', () => {
    expect(countLine({ madeBy: 0, wantCount: 0 })).toBe('');
  });
  it('says "Made by 1" for one person (catches a plural-s or "1 people" bug)', () => {
    expect(countLine({ madeBy: 1, wantCount: 0 })).toBe('Made by 1');
  });
  it('shows only the made part when nobody wants it (catches a dangling separator)', () => {
    expect(countLine({ madeBy: 4, wantCount: 0 })).toBe('Made by 4');
  });
  it('shows only the want part when nobody made it (catches a leading "Made by 0")', () => {
    expect(countLine({ madeBy: 0, wantCount: 6 })).toBe('6 want to make');
    expect(countLine({ madeBy: 0, wantCount: 1 })).toBe('1 want to make');
  });
  it('joins both parts with a middle dot (catches swapped order or a wrong separator)', () => {
    expect(countLine({ madeBy: 4, wantCount: 6 })).toBe('Made by 4 · 6 want to make');
  });
});

describe('adjustStats', () => {
  it('moves one person from want to made (catches counting them in both)', () => {
    expect(adjustStats({ madeBy: 1, wantCount: 2 }, 'want', 'made')).toEqual({ madeBy: 2, wantCount: 1 });
  });
  it('clearing a made mark only lowers madeBy (catches touching the want count)', () => {
    expect(adjustStats({ madeBy: 1, wantCount: 2 }, 'made', 'none')).toEqual({ madeBy: 0, wantCount: 2 });
  });
  it('never goes below zero when the store counts lag (catches "Made by -1")', () => {
    expect(adjustStats({ madeBy: 0, wantCount: 0 }, 'made', 'none')).toEqual({ madeBy: 0, wantCount: 0 });
  });
  it('same state is a no-op (catches a double count on re-render)', () => {
    const s = { madeBy: 3, wantCount: 3 };
    expect(adjustStats(s, 'want', 'want')).toBe(s);
  });
});

describe('shelfStateOf', () => {
  it('reads each list, with made winning a malformed double entry (catches a wrong pressed button)', () => {
    expect(shelfStateOf({ want: ['a'], made: ['b'] }, 'a')).toBe('want');
    expect(shelfStateOf({ want: ['a'], made: ['b'] }, 'b')).toBe('made');
    expect(shelfStateOf({ want: ['a'], made: ['b'] }, 'c')).toBe('none');
    expect(shelfStateOf({ want: ['a'], made: ['a'] }, 'a')).toBe('made');
  });
});
