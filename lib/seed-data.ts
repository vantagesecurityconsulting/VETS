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
  /** Rough average market price (CAD) applied to each item as a starting point. */
  price: number;
  /** Rough average weight (in the configured unit) per item. */
  weight: number;
  items?: string[];
}

const DEFAULT_POINTS = 1;

const rawCategories: SeedCategory[] = [
  { name: "Canned Goods", pointValue: 1, price: 1.5, weight: 1.0, items: ["soup", "vegetables", "fruit", "beans", "meat & fish"] },
  { name: "Pasta & Rice", pointValue: 1, price: 2.0, weight: 1.0, items: ["pasta", "rice", "pasta sauce"] },
  { name: "Cereal & Breakfast", pointValue: 1, price: 4.0, weight: 0.75, items: ["cereal", "oatmeal"] },
  { name: "Bread & Bakery", pointValue: 0, price: 3.0, weight: 1.0, items: ["bread", "buns"] },
  { name: "Dairy & Eggs", pointValue: 0, price: 4.5, weight: 1.5, items: ["milk", "cheese", "eggs"] },
  { name: "Drinks", pointValue: 1, price: 2.5, weight: 2.0, items: ["juice", "coffee", "tea", "water"] },
  { name: "Snacks", pointValue: 1, price: 3.0, weight: 0.5, items: ["granola bars", "crackers", "cookies"] },
  { name: "Spreads & Condiments", pointValue: 1, price: 3.5, weight: 1.0, items: ["peanut butter", "jam", "ketchup"] },
  { name: "Fresh Produce", pointValue: 0, price: 2.0, weight: 1.0, items: ["fruit", "vegetables"] },
  { name: "Frozen Foods", pointValue: 2, price: 6.0, weight: 2.0, items: ["frozen meat", "frozen vegetables"] },
  { name: "Baby Items", pointValue: 0, price: 15.0, weight: 1.0, items: ["baby food", "formula", "diapers"] },
  { name: "Personal Hygiene", pointValue: 0, price: 4.0, weight: 0.5, items: ["soap", "shampoo", "toothpaste", "toilet paper"] },
  { name: "Household", pointValue: 0, price: 6.0, weight: 2.0, items: ["dish soap", "laundry detergent", "paper towel"] },
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
    price: cat.price ?? 0,
    weight: cat.weight ?? 0,
    items: baseItems,
  };
});
