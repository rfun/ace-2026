import { describe, expect, it } from 'vitest';
import { SAMPLE_PEOPLE, SAMPLE_RECIPES, SAMPLE_TIPS } from './samples';

describe('sample data', () => {
  it('has exactly 3 recipes', () => {
    expect(SAMPLE_RECIPES).toHaveLength(3);
  });
  it('flags every recipe and tip sample: true (catches fake data passing as real)', () => {
    for (const r of SAMPLE_RECIPES) expect(r.sample).toBe(true);
    for (const t of SAMPLE_TIPS) expect(t.sample).toBe(true);
  });
  it('every person name ends in "Example" (catches real names slipping in)', () => {
    for (const p of SAMPLE_PEOPLE) expect(p.name).toMatch(/ Example$/);
  });
  it('every author id resolves to a sample person', () => {
    const ids = new Set(SAMPLE_PEOPLE.map((p) => p.id));
    for (const r of SAMPLE_RECIPES) expect(ids.has(r.authorId)).toBe(true);
    for (const t of SAMPLE_TIPS) expect(ids.has(t.authorId)).toBe(true);
  });
  it('includes the Besan Ladoo card from the mock with 5 ingredients and 5 steps', () => {
    const r = SAMPLE_RECIPES.find((x) => x.title === 'Besan Ladoo');
    expect(r).toBeDefined();
    expect(r!.ingredients).toHaveLength(5);
    expect(r!.steps).toHaveLength(5);
    expect(r!.dietary).toEqual(['vegetarian', 'gluten-free']);
  });
});
