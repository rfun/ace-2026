import type { Person, Recipe, Tip } from '../../domain/types';

/** Clearly-fake sample data. Every person name ends in "Example". */
export const SAMPLE_PEOPLE: Person[] = [
  { id: 'u-you', name: 'Casey Example' },
  { id: 'u-jordan', name: 'Jordan Example' },
  { id: 'u-sam', name: 'Sam Example' },
  { id: 'u-lee', name: 'Lee Example' },
  { id: 'u-riley', name: 'Riley Example' },
];

/** Small illustrative SVG (a plate silhouette in the palette). Clearly a drawing, not a photo. */
function plateSvg(bg: string, food: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">` +
    `<rect width="400" height="300" fill="${bg}"/>` +
    `<ellipse cx="200" cy="160" rx="150" ry="100" fill="#fbf7ee" stroke="#c69c6d" stroke-width="6"/>` +
    `<ellipse cx="200" cy="160" rx="105" ry="68" fill="none" stroke="#9fb7d6" stroke-width="3"/>` +
    `<circle cx="170" cy="155" r="26" fill="${food}"/><circle cx="215" cy="150" r="26" fill="${food}"/>` +
    `<circle cx="195" cy="185" r="26" fill="${food}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1);

export const SAMPLE_RECIPES: Recipe[] = [
  {
    id: 'r-besan-ladoo',
    title: 'Besan Ladoo',
    authorId: 'u-jordan',
    team: 'Revenue Cycle',
    city: 'Salt Lake City',
    origin: 'Punjab, India',
    occasions: ['Diwali'],
    course: 'sweets',
    dietary: ['vegetarian', 'gluten-free'],
    serves: 8,
    makes: 'Makes 16',
    totalMinutes: 40,
    story:
      'My grandmother made these every Diwali, and the whole house smelled of roasting gram flour for days. She never measured anything; this is my best attempt at writing her hands down.',
    ingredients: [
      { quantity: '2 cups', item: 'besan (gram flour)' },
      { quantity: '1/2 cup', item: 'ghee' },
      { quantity: '3/4 cup', item: 'powdered sugar' },
      { quantity: '1/2 tsp', item: 'ground cardamom' },
      { quantity: '2 tbsp', item: 'chopped pistachios' },
    ],
    steps: [
      { id: 's1', text: 'Melt the ghee in a heavy pan over low heat.' },
      {
        id: 's2',
        text: 'Add the besan and roast, stirring constantly, 15-20 minutes until nutty and golden.',
        photo: {
          assetId: 'sample-ladoo-step',
          url: plateSvg('#cfe0f1', '#e0b252'),
          alt: 'Illustration of golden roasted besan on a plate (sample drawing, not a real photo)',
        },
      },
      { id: 's3', text: 'Take off the heat and let it cool until just warm.' },
      { id: 's4', text: 'Stir in the sugar and cardamom.' },
      { id: 's5', text: 'Shape into walnut-sized balls and press a pistachio piece on top.' },
    ],
    mainPhoto: {
      assetId: 'sample-ladoo-main',
      url: plateSvg('#f6e7a1', '#c69c6d'),
      alt: 'Illustration of a plate with three round ladoo (sample drawing, not a real photo)',
    },
    createdAt: T0,
    updatedAt: T0,
    sample: true,
  },
  {
    id: 'r-example-congee',
    title: 'Sample Ginger Congee',
    authorId: 'u-riley',
    team: 'Client Success',
    city: 'Austin',
    origin: 'Guangdong, China',
    occasions: ['Lunar New Year'],
    course: 'breakfast',
    dietary: ['vegan', 'dairy-free', 'nut-free'],
    serves: 4,
    makes: 'Serves 4',
    totalMinutes: 60,
    story: 'A sample recipe used to show how a savory card looks. Not a real family recipe.',
    ingredients: [
      { quantity: '1 cup', item: 'jasmine rice' },
      { quantity: '8 cups', item: 'water' },
      { quantity: '2 inch', item: 'fresh ginger, sliced' },
      { quantity: '1 tsp', item: 'salt' },
    ],
    steps: [
      { id: 's1', text: 'Rinse the rice and add it to a pot with the water and ginger.' },
      { id: 's2', text: 'Simmer, stirring now and then, until the rice breaks down, about 50 minutes.' },
      { id: 's3', text: 'Season with salt and serve hot.' },
    ],
    mainPhoto: {
      assetId: 'sample-congee-main',
      url: plateSvg('#cfe6d3', '#eadfc8'),
      alt: 'Illustration of a plate with a bowl of congee (sample drawing, not a real photo)',
    },
    createdAt: T0 + DAY,
    updatedAt: T0 + DAY,
    sample: true,
  },
  {
    id: 'r-example-empanadas',
    title: 'Sample Baked Empanadas',
    authorId: 'u-sam',
    team: 'Engineering',
    city: 'Remote',
    origin: 'Buenos Aires, Argentina',
    occasions: ['Potluck'],
    course: 'snack',
    dietary: ['nut-free'],
    makes: 'Makes 12',
    totalMinutes: 75,
    story: 'A sample recipe used to show how a snack card looks. Not a real family recipe.',
    ingredients: [
      { quantity: '12', item: 'empanada discs' },
      { quantity: '1 lb', item: 'seasoned ground beef' },
      { quantity: '1', item: 'egg, beaten, for brushing' },
    ],
    steps: [
      { id: 's1', text: 'Fill each disc with a spoonful of beef and fold closed.' },
      { id: 's2', text: 'Brush with egg and bake at 400F for 25 minutes until golden.' },
    ],
    createdAt: T0 + 2 * DAY,
    updatedAt: T0 + 2 * DAY,
    sample: true,
  },
];

export const SAMPLE_TIPS: Tip[] = [
  {
    id: 't-ladoo-1',
    recipeId: 'r-besan-ladoo',
    authorId: 'u-sam',
    text: 'Roast on the lowest flame. Patience is the whole recipe.',
    createdAt: T0 + 3 * DAY,
    sample: true,
  },
  {
    id: 't-ladoo-2',
    recipeId: 'r-besan-ladoo',
    authorId: 'u-lee',
    text: 'A pinch of salt makes the cardamom sing.',
    createdAt: T0 + 4 * DAY,
    sample: true,
  },
  {
    id: 't-ladoo-3',
    recipeId: 'r-besan-ladoo',
    authorId: 'u-riley',
    text: 'Sift the besan first for a smoother crumb.',
    createdAt: T0 + 5 * DAY,
    sample: true,
  },
];
