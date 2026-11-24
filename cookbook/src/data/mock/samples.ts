import type { Person, Recipe, Tip } from '../../domain/types';

/** Clearly-fake sample data. Every person name ends in "Example". */
export const SAMPLE_PEOPLE: Person[] = [
  { id: 'u-you', name: 'Casey Example' },
  { id: 'u-jordan', name: 'Jordan Example' },
  { id: 'u-sam', name: 'Sam Example' },
  { id: 'u-lee', name: 'Lee Example' },
  { id: 'u-riley', name: 'Riley Example' },
];

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
      { id: 's2', text: 'Add the besan and roast, stirring constantly, 15-20 minutes until nutty and golden.' },
      { id: 's3', text: 'Take off the heat and let it cool until just warm.' },
      { id: 's4', text: 'Stir in the sugar and cardamom.' },
      { id: 's5', text: 'Shape into walnut-sized balls and press a pistachio piece on top.' },
    ],
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
