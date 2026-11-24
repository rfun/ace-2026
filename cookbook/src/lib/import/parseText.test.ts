import { describe, expect, it } from 'vitest';
import { parseRecipeText } from './parseText';

const NOTES = `Besan Ladoo
Serves 4
Prep: 10 mins
Cook time: 25 minutes

Ingredients:
- 2 cups besan
- 1 ½ cups powdered sugar
- 200 g ghee
- 2 tbsp chopped almonds
- Pinch of cardamom

Method
1. Roast the besan in the ghee until fragrant.
2. Cool, then stir in the sugar.
3) Roll into balls.`;

describe('parseRecipeText: notes-style recipe', () => {
  const r = parseRecipeText(NOTES);
  it('takes the first line as the title (catches a title lost to the headings logic)', () => {
    expect(r.title).toBe('Besan Ladoo');
  });
  it('splits quantity and item including unicode fractions and unit words (catches a regex that drops ½ or the unit)', () => {
    expect(r.ingredients).toEqual([
      { quantity: '2 cups', item: 'besan' },
      { quantity: '1 ½ cups', item: 'powdered sugar' },
      { quantity: '200 g', item: 'ghee' },
      { quantity: '2 tbsp', item: 'chopped almonds' },
      { quantity: '', item: 'Pinch of cardamom' },
    ]);
  });
  it('strips "1." and "3)" step numbering and keeps order', () => {
    expect(r.steps).toEqual([
      'Roast the besan in the ghee until fragrant.',
      'Cool, then stir in the sugar.',
      'Roll into balls.',
    ]);
  });
  it('reads Serves and sums prep + cook when there is no total (10 + 25)', () => {
    expect(r.makes).toBe('Serves 4');
    expect(r.totalMinutes).toBe(35);
  });
  it('does not invent a story from a recipe with no intro', () => {
    expect(r.story).toBeUndefined();
  });
});

describe('parseRecipeText: headings variants', () => {
  it.each(['INGREDIENTS', 'ingredients:', '## Ingredients', 'Ingredients'])('accepts the heading %s', (h) => {
    const r = parseRecipeText(`Tea\n${h}\n1 cup milk\nDirections\nBoil it.`);
    expect(r.ingredients).toEqual([{ quantity: '1 cup', item: 'milk' }]);
    expect(r.steps).toEqual(['Boil it.']);
  });
  it.each(['Method', 'DIRECTIONS', 'Steps:', 'Instructions', 'preparation'])('accepts the method heading %s', (h) => {
    const r = parseRecipeText(`Tea\nIngredients\n1 cup milk\n${h}\nBoil it.`);
    expect(r.steps).toEqual(['Boil it.']);
  });
  it('reads bullets of every kind in ingredients', () => {
    const r = parseRecipeText('Tea\nIngredients\n* 1 cup milk\n• 2 tsp sugar\n▢ 1 pinch salt');
    expect(r.ingredients?.map((i) => i.item)).toEqual(['milk', 'sugar', 'salt']);
  });
  it('handles a range, a decimal and a slash fraction', () => {
    const r = parseRecipeText('X\nIngredients\n2-3 cloves garlic\n1.5 kg onions\n1/2 tsp salt\n1 1/2 cups rice');
    expect(r.ingredients).toEqual([
      { quantity: '2-3 cloves', item: 'garlic' },
      { quantity: '1.5 kg', item: 'onions' },
      { quantity: '1/2 tsp', item: 'salt' },
      { quantity: '1 1/2 cups', item: 'rice' },
    ]);
  });
  it('does not mistake "garlic" or "large" for the unit g / l', () => {
    const r = parseRecipeText('X\nIngredients\n2 garlic cloves\n1 large onion');
    expect(r.ingredients).toEqual([
      { quantity: '2', item: 'garlic cloves' },
      { quantity: '1', item: 'large onion' },
    ]);
  });
  it('turns "Total time: 1 hr 15 mins" into 75, and total wins over prep + cook', () => {
    const r = parseRecipeText('X\nPrep time: 10 mins\nTotal time: 1 hr 15 mins\nCook time: 20 mins\nIngredients\n1 egg');
    expect(r.totalMinutes).toBe(75);
  });
  it('reads "Prep Time" and its value on the next line, and a pipe-separated header', () => {
    const r = parseRecipeText('X\nPrep Time\n10 mins\nCook Time: 20 mins | Makes 24 ladoos\nIngredients\n1 egg');
    expect(r.totalMinutes).toBe(30);
    expect(r.makes).toBe('24 ladoos');
    expect(r.ingredients).toEqual([{ quantity: '1', item: 'egg' }]);
  });
  it('does not treat a step that starts with "Cook" as a time', () => {
    const r = parseRecipeText('X\nIngredients\n1 egg\nMethod\nCook 10 minutes then stir.');
    expect(r.steps).toEqual(['Cook 10 minutes then stir.']);
    expect(r.totalMinutes).toBeUndefined();
  });
  it('keeps an intro as the story only when it is real prose', () => {
    const r = parseRecipeText('Dal\nMy grandmother made this every Sunday after temple, and the whole street smelled of it.\nIngredients\n1 cup dal');
    expect(r.story).toContain('grandmother');
    expect(r.title).toBe('Dal');
  });
});

describe('parseRecipeText: copied web page with noise', () => {
  const WEB = `Skip to content
Home
Recipes
About
Jump to Recipe
Masala Chai
Print Recipe
By Priya | 120 comments
Prep Time
5 mins
Total Time
15 mins
Servings: 2
Ingredients
▢ 2 cups water
▢ 1 cup milk
▢ 2 tsp loose black tea
Instructions
Step 1: Boil the water with the spices.
Step 2: Add the tea and milk.
Notes
Use fresh ginger.
Comments
Great recipe! Boil the water longer
Leave a Reply`;
  const r = parseRecipeText(WEB);
  it('skips navigation noise to find the title', () => {
    expect(r.title).toBe('Masala Chai');
  });
  it('reads label-then-value times and Servings', () => {
    expect(r.totalMinutes).toBe(15);
    expect(r.makes).toBe('Serves 2');
  });
  it('lists ingredients and steps, drops "Step 1:" prefixes', () => {
    expect(r.ingredients).toHaveLength(3);
    expect(r.steps).toEqual(['Boil the water with the spices.', 'Add the tea and milk.']);
  });
  it('ignores notes and comments after the method (catches comment text leaking into steps)', () => {
    expect(JSON.stringify(r)).not.toContain('Great recipe');
    expect(JSON.stringify(r)).not.toContain('fresh ginger');
  });
});

describe('parseRecipeText: JSON-LD', () => {
  const LD = `<html><head><style>body{color:red}</style>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Site"},
{"@type":"Recipe","name":"Aloo &amp; Gobi","description":"A <b>weeknight</b> classic.",
"totalTime":"PT1H15M","recipeYield":["4","4 servings"],"recipeCategory":"Main","recipeCuisine":"Punjabi",
"suitableForDiet":"https://schema.org/VeganDiet",
"recipeIngredient":["2 cups cauliflower florets","1 ½ tsp cumin"],
"recipeInstructions":[{"@type":"HowToStep","text":"Fry the cumin."},
{"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"Add the vegetables."}]},"Serve hot."]}]}
</script></head><body>Some page</body></html>`;
  const r = parseRecipeText(LD);
  it('maps name, description, yield, time, cuisine, category, diet', () => {
    expect(r.title).toBe('Aloo & Gobi');
    expect(r.story).toBe('A weeknight classic.');
    expect(r.makes).toBe('4 servings');
    expect(r.totalMinutes).toBe(75);
    expect(r.origin).toBe('Punjabi');
    expect(r.course).toBe('main');
    expect(r.dietary).toEqual(['vegan']);
  });
  it('flattens HowToStep, HowToSection and plain-string instructions in order', () => {
    expect(r.steps).toEqual(['Fry the cumin.', 'Add the vegetables.', 'Serve hot.']);
  });
  it('splits ingredient strings', () => {
    expect(r.ingredients).toEqual([
      { quantity: '2 cups', item: 'cauliflower florets' },
      { quantity: '1 ½ tsp', item: 'cumin' },
    ]);
  });
  it('finds a bare JSON-LD object pasted without script tags', () => {
    const bare = parseRecipeText('{"@type":"Recipe","name":"Plain","recipeIngredient":["1 egg"],"recipeInstructions":"Boil.\\nPeel."}');
    expect(bare).toMatchObject({ title: 'Plain', steps: ['Boil.', 'Peel.'] });
  });
  it('sums prepTime + cookTime when there is no totalTime', () => {
    const t = parseRecipeText('{"@type":"Recipe","name":"T","prepTime":"PT10M","cookTime":"PT0H35M","recipeIngredient":["1 egg"]}');
    expect(t.totalMinutes).toBe(45);
  });
  it('falls back to headings when the JSON-LD is not a Recipe', () => {
    const t = parseRecipeText('{"@type":"WebSite","name":"Site"}\nSoup\nIngredients\n1 onion\nMethod\nChop it.');
    expect(t.ingredients).toEqual([{ quantity: '1', item: 'onion' }]);
    expect(t.steps).toEqual(['Chop it.']);
  });
});

describe('parseRecipeText: edge cases', () => {
  it('no headings: title plus every other line as steps, no crash', () => {
    const r = parseRecipeText('Quick Rice\nWash the rice.\nBoil it for 12 minutes.');
    expect(r.title).toBe('Quick Rice');
    expect(r.steps).toEqual(['Wash the rice.', 'Boil it for 12 minutes.']);
    expect(r.ingredients).toBeUndefined();
  });
  it('title only', () => {
    expect(parseRecipeText('Just a title')).toEqual({ title: 'Just a title' });
  });
  it('empty and whitespace-only strings give {}', () => {
    expect(parseRecipeText('')).toEqual({});
    expect(parseRecipeText('  \n\t \n')).toEqual({});
  });
  it('malformed JSON-LD-looking text does not throw', () => {
    expect(() => parseRecipeText('{"@type":"Recipe", "name": ')).not.toThrow();
  });
  it('caps a huge list at 60 ingredients / 40 steps', () => {
    const many = ['X', 'Ingredients', ...Array.from({ length: 100 }, (_, i) => `${i + 1} g item${i}`), 'Method', ...Array.from({ length: 80 }, (_, i) => `Do thing ${i}`)].join('\n');
    const r = parseRecipeText(many);
    expect(r.ingredients).toHaveLength(60);
    expect(r.steps).toHaveLength(40);
  });
});
