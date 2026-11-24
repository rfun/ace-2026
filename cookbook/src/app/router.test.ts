import { describe, expect, it } from 'vitest';
import { formatHash, navigate, parseHash, type Route } from './router';

describe('router', () => {
  const cases: [Route, string][] = [
    [{ name: 'browse' }, '#/'],
    [{ name: 'recipe', id: 'r-1' }, '#/recipe/r-1'],
    [{ name: 'compose' }, '#/compose'],
    [{ name: 'compose', id: 'r-1' }, '#/compose/r-1'],
    [{ name: 'kitchen', id: 'r-1' }, '#/kitchen/r-1'],
  ];
  it.each(cases)('formats %j as %s and parses it back (catches format/parse drift)', (route, hash) => {
    expect(formatHash(route)).toBe(hash);
    expect(parseHash(hash)).toEqual(route);
  });
  it('round-trips ids containing slashes and spaces', () => {
    const route: Route = { name: 'recipe', id: 'a/b c' };
    expect(parseHash(formatHash(route))).toEqual(route);
  });
  it.each(['', '#', '#/', '#/nope', '#/recipe', '#/recipe/a/b', '#/kitchen', '#/compose/a/b'])(
    'unknown or malformed hash %j falls back to browse',
    (hash) => {
      expect(parseHash(hash)).toEqual({ name: 'browse' });
    },
  );
  it('navigate writes location.hash and hashchange is observable', () => {
    navigate({ name: 'recipe', id: 'x' });
    expect(window.location.hash).toBe('#/recipe/x');
    expect(parseHash(window.location.hash)).toEqual({ name: 'recipe', id: 'x' });
  });
});
