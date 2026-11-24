import type { Course, DietaryTag } from './types';

export interface TagInfo { label: string; symbol: string }

/** Card stock a course is printed on. Each maps to a --stock-* token and a .stock-* class. */
export type Stock = 'canary' | 'blush' | 'mint' | 'sky';
/** Ink a dietary stamp is printed in. Each maps to a --stamp-* token and a .stamp-* class. */
export type StampInk = 'green' | 'olive' | 'umber' | 'navy' | 'rust' | 'graphite' | 'teal' | 'violet';

export interface DietaryInfo extends TagInfo { ink: StampInk }
export interface CourseInfo extends TagInfo { stock: Stock }

export const DIETARY: Record<DietaryTag, DietaryInfo> = {
  vegetarian: { label: 'Vegetarian', symbol: '✓', ink: 'green' },
  vegan: { label: 'Vegan', symbol: '❦', ink: 'olive' },
  'gluten-free': { label: 'Gluten-free', symbol: '⊘', ink: 'umber' },
  'dairy-free': { label: 'Dairy-free', symbol: '∅', ink: 'navy' },
  'nut-free': { label: 'Nut-free', symbol: '◌', ink: 'rust' },
  'egg-free': { label: 'Egg-free', symbol: '○', ink: 'graphite' },
  halal: { label: 'Halal', symbol: '☾', ink: 'teal' },
  kosher: { label: 'Kosher', symbol: '✶', ink: 'violet' },
};

export const COURSES: Record<Course, CourseInfo> = {
  breakfast: { label: 'Breakfast', symbol: '◐', stock: 'canary' },
  snack: { label: 'Snack', symbol: '◇', stock: 'canary' },
  main: { label: 'Main', symbol: '■', stock: 'blush' },
  side: { label: 'Side', symbol: '▪', stock: 'mint' },
  dessert: { label: 'Dessert', symbol: '◆', stock: 'blush' },
  sweets: { label: 'Sweets', symbol: '✦', stock: 'blush' },
  drink: { label: 'Drink', symbol: '≈', stock: 'sky' },
  condiment: { label: 'Condiment', symbol: '※', stock: 'mint' },
};

/** The stock class for a course; unknown courses (old data) fall back to plain card paper. */
export function stockClass(course: Course): string {
  const info = COURSES[course];
  return info ? `stock-${info.stock}` : '';
}
