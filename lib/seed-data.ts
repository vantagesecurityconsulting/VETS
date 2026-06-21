/**
 * Seed data for the VETS Canada Dartmouth food bank.
 *
 * A small, practical set of food-bank basics. Volunteers/managers can add
 * extra items to any category from within the app, so this is just a
 * sensible starting point — not an exhaustive list.
 *
 * Point value defaults to 1 when not given. Every category gets an
 * "Other" item appended (deduped case-insensitively).
 */

export interface SeedCategory {
  name: string;
  pointValue: number;
  items?: string[];
}

const DEFAULT_POINTS = 1;

const rawCategories: SeedCategory[] = [
  { name: "Canned Soup", pointValue: 1, items: ["chicken noodle", "tomato", "vegetable", "cream of mushroom"] },
  { name: "Canned Vegetables", pointValue: 1, items: ["corn", "peas", "green beans", "mixed vegetables", "carrots"] },
  { name: "Canned Fruit", pointValue: 1, items: ["peaches", "pears", "fruit cocktail", "pineapple", "applesauce"] },
  { name: "Canned Beans", pointValue: 1, items: ["baked beans", "kidney beans", "chickpeas", "black beans"] },
  { name: "Canned Meat & Fish", pointValue: 2, items: ["tuna", "chicken", "ham", "salmon"] },
  { name: "Pasta", pointValue: 1, items: ["spaghetti", "macaroni", "penne"] },
  { name: "Pasta Sauce", pointValue: 1, items: ["tomato", "marinara", "alfredo"] },
  { name: "Rice & Grains", pointValue: 1, items: ["white rice", "brown rice", "couscous"] },
  { name: "Cereal & Oatmeal", pointValue: 2, items: ["cereal", "oatmeal", "granola"] },
  { name: "Peanut Butter & Spreads", pointValue: 2, items: ["peanut butter", "jam", "honey"] },
  { name: "Bread & Bakery", pointValue: 0, items: ["white bread", "whole wheat bread", "buns"] },
  { name: "Milk & Dairy", pointValue: 0, items: ["milk", "cheese", "yogurt", "butter"] },
  { name: "Eggs", pointValue: 1, items: ["dozen eggs"] },
  { name: "Coffee & Tea", pointValue: 1, items: ["coffee", "tea", "hot chocolate"] },
  { name: "Juice & Drinks", pointValue: 1, items: ["apple juice", "orange juice", "water"] },
  { name: "Snacks", pointValue: 1, items: ["granola bars", "crackers", "cookies", "chips"] },
  { name: "Condiments", pointValue: 1, items: ["ketchup", "mustard", "mayonnaise", "salt", "pepper"] },
  { name: "Baby Items", pointValue: 0, items: ["baby food", "formula", "diapers", "baby wipes"] },
  { name: "Personal Hygiene", pointValue: 0, items: ["soap", "shampoo", "toothpaste", "toilet paper", "deodorant"] },
  { name: "Cleaning Supplies", pointValue: 0, items: ["dish soap", "laundry detergent", "paper towel"] },
  { name: "Fresh Produce", pointValue: 0, items: ["apples", "potatoes", "carrots", "onions", "bananas"] },
  { name: "Frozen Foods", pointValue: 2, items: ["frozen vegetables", "frozen meat", "frozen meals"] },
];

/**
 * Normalize categories: ensure each has at least one item (use the category
 * name for single-product categories) and append a deduped "Other" item.
 */
export const SEED_CATEGORIES: Required<SeedCategory>[] = rawCategories.map((cat) => {
  const baseItems = cat.items && cat.items.length > 0 ? [...cat.items] : [cat.name];
  const seen = new Set(baseItems.map((i) => i.toLowerCase()));
  if (!seen.has("other")) {
    baseItems.push("Other");
  }
  return {
    name: cat.name,
    pointValue: cat.pointValue ?? DEFAULT_POINTS,
    items: baseItems,
  };
});
