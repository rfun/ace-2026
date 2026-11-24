import type { Course, DietaryTag } from './types';

export interface TagInfo { label: string; symbol: string }

export const DIETARY: Record<DietaryTag, TagInfo> = {
  vegetarian: { label: 'Vegetarian', symbol: '✓' },
  vegan: { label: 'Vegan', symbol: '❦' },
  'gluten-free': { label: 'Gluten-free', symbol: '⊘' },
  'dairy-free': { label: 'Dairy-free', symbol: '∅' },
  'nut-free': { label: 'Nut-free', symbol: '◌' },
  'egg-free': { label: 'Egg-free', symbol: '○' },
  halal: { label: 'Halal', symbol: '☾' },
  kosher: { label: 'Kosher', symbol: '✶' },
};

export const COURSES: Record<Course, TagInfo> = {
  breakfast: { label: 'Breakfast', symbol: '◐' },
  snack: { label: 'Snack', symbol: '◇' },
  main: { label: 'Main', symbol: '■' },
  side: { label: 'Side', symbol: '▪' },
  dessert: { label: 'Dessert', symbol: '◆' },
  sweets: { label: 'Sweets', symbol: '✦' },
  drink: { label: 'Drink', symbol: '≈' },
  condiment: { label: 'Condiment', symbol: '※' },
};
