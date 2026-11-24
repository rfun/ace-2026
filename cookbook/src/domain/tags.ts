import type { Course, DietaryTag } from './types';

export interface TagInfo { label: string }

/** Card stock a course is printed on. Each maps to a --stock-* token and a .stock-* class. */
export type Stock = 'canary' | 'blush' | 'mint' | 'sky';
/** Ink a dietary stamp is printed in. Each maps to a --stamp-* token and a .stamp-* class. */
export type StampInk = 'green' | 'olive' | 'umber' | 'navy' | 'rust' | 'graphite' | 'teal' | 'violet';

export interface DietaryInfo extends TagInfo { ink: StampInk }
export interface CourseInfo extends TagInfo { stock: Stock }

export const DIETARY: Record<DietaryTag, DietaryInfo> = {
  vegetarian: { label: 'Vegetarian', ink: 'green' },
  vegan: { label: 'Vegan', ink: 'olive' },
  'gluten-free': { label: 'Gluten-free', ink: 'umber' },
  'dairy-free': { label: 'Dairy-free', ink: 'navy' },
  'nut-free': { label: 'Nut-free', ink: 'rust' },
  'egg-free': { label: 'Egg-free', ink: 'graphite' },
  halal: { label: 'Halal', ink: 'teal' },
  kosher: { label: 'Kosher', ink: 'violet' },
};

export const COURSES: Record<Course, CourseInfo> = {
  breakfast: { label: 'Breakfast', stock: 'canary' },
  snack: { label: 'Snack', stock: 'canary' },
  main: { label: 'Main', stock: 'blush' },
  side: { label: 'Side', stock: 'mint' },
  dessert: { label: 'Dessert', stock: 'blush' },
  sweets: { label: 'Sweets', stock: 'blush' },
  drink: { label: 'Drink', stock: 'sky' },
  condiment: { label: 'Condiment', stock: 'mint' },
};

/** The stock class for a course; unknown courses (old data) fall back to plain card paper. */
export function stockClass(course: Course): string {
  const info = COURSES[course];
  return info ? `stock-${info.stock}` : '';
}
