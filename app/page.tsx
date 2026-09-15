"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type DishType = "main" | "base" | "side" | "breakfast" | "complete";
type MealTime = "breakfast" | "lunch" | "dinner";
type View = "week" | "kitchen" | "grocery" | "leftovers";

type Ingredient = {
  name: string;
  amount: number;
  unit: string;
  aisle: string;
};

type Dish = {
  id: string;
  name: string;
  type: DishType;
  families: string[];
  servings: number;
  ingredients: Ingredient[];
  recipe?: string;
  link?: string;
  symbol: string;
};

type Meal = {
  id: string;
  componentIds: string[];
  batchIds: Record<string, string>;
  leftover: boolean;
  cookedAt?: string;
};

type WeekPlan = Record<MealTime, Meal[]>;

const DAYS = [
  { short: "Mon", long: "Monday", date: "14" },
  { short: "Tue", long: "Tuesday", date: "15" },
  { short: "Wed", long: "Wednesday", date: "16" },
  { short: "Thu", long: "Thursday", date: "17" },
  { short: "Fri", long: "Friday", date: "18" },
  { short: "Sat", long: "Saturday", date: "19" },
  { short: "Sun", long: "Sunday", date: "20" },
];

const TYPE_LABELS: Record<DishType, string> = {
  main: "main dish",
  base: "base",
  side: "side dish",
  breakfast: "breakfast",
  complete: "complete meal",
};

const TYPE_SYMBOLS: Record<DishType, string> = {
  main: "◒",
  base: "▱",
  side: "❋",
  breakfast: "☼",
  complete: "✦",
};

const DEFAULT_DISHES: Dish[] = [
  {
    id: "viet-pork", name: "Vietnamese marinated pork", type: "main", families: ["Vietnamese"], servings: 3, symbol: "◒",
    ingredients: [
      { name: "pork shoulder", amount: 450, unit: "g", aisle: "Meat & seafood" },
      { name: "fish sauce", amount: 2, unit: "tbsp", aisle: "Pantry" },
      { name: "brown sugar", amount: 1, unit: "tbsp", aisle: "Pantry" },
      { name: "garlic", amount: 3, unit: "cloves", aisle: "Produce" },
    ],
    recipe: "Mix the marinade, coat the pork, then sear or grill until caramelized and cooked through.",
  },
  {
    id: "ginger-salmon", name: "Ginger soy salmon", type: "main", families: ["Japanese", "Neutral"], servings: 2, symbol: "♓",
    ingredients: [
      { name: "salmon fillet", amount: 2, unit: "pieces", aisle: "Meat & seafood" },
      { name: "soy sauce", amount: 2, unit: "tbsp", aisle: "Pantry" },
      { name: "ginger", amount: 1, unit: "thumb", aisle: "Produce" },
      { name: "honey", amount: 1, unit: "tbsp", aisle: "Pantry" },
    ],
    recipe: "Brush salmon with soy, ginger and honey. Bake until glossy and just cooked.",
  },
  {
    id: "miso-chicken", name: "Miso glazed chicken", type: "main", families: ["Japanese"], servings: 3, symbol: "◓",
    ingredients: [
      { name: "chicken thighs", amount: 500, unit: "g", aisle: "Meat & seafood" },
      { name: "white miso", amount: 2, unit: "tbsp", aisle: "Pantry" },
      { name: "soy sauce", amount: 1, unit: "tbsp", aisle: "Pantry" },
    ],
    recipe: "Coat the chicken in miso and soy, then roast until burnished at the edges.",
  },
  {
    id: "tomato-eggs", name: "Tomato & eggs", type: "main", families: ["Chinese", "Vietnamese"], servings: 2, symbol: "◎",
    ingredients: [
      { name: "eggs", amount: 4, unit: "", aisle: "Dairy & eggs" },
      { name: "tomatoes", amount: 3, unit: "", aisle: "Produce" },
      { name: "scallions", amount: 2, unit: "", aisle: "Produce" },
    ],
    recipe: "Soft-scramble the eggs, cook down the tomatoes, then fold everything together.",
  },
  {
    id: "lemon-chicken", name: "Lemony herb chicken", type: "main", families: ["Western", "Italian"], servings: 3, symbol: "◐",
    ingredients: [
      { name: "chicken breast", amount: 500, unit: "g", aisle: "Meat & seafood" },
      { name: "lemon", amount: 1, unit: "", aisle: "Produce" },
      { name: "dried oregano", amount: 1, unit: "tsp", aisle: "Pantry" },
    ],
    recipe: "Season with lemon and oregano, then pan-roast until golden.",
  },
  {
    id: "rice", name: "Steamed jasmine rice", type: "base", families: ["Vietnamese", "Chinese", "Japanese", "Neutral"], servings: 4, symbol: "▱",
    ingredients: [{ name: "jasmine rice", amount: 2, unit: "cups", aisle: "Pantry" }],
    recipe: "Rinse until the water runs mostly clear, then steam with the right amount of water.",
  },
  {
    id: "udon", name: "Udon noodles", type: "base", families: ["Japanese"], servings: 2, symbol: "≈",
    ingredients: [{ name: "udon noodles", amount: 2, unit: "packs", aisle: "Pantry" }],
  },
  {
    id: "pasta", name: "Buttered pasta", type: "base", families: ["Italian", "Western"], servings: 3, symbol: "⌇",
    ingredients: [
      { name: "short pasta", amount: 300, unit: "g", aisle: "Pantry" },
      { name: "butter", amount: 2, unit: "tbsp", aisle: "Dairy & eggs" },
    ],
  },
  {
    id: "cucumber", name: "Smashed cucumber salad", type: "side", families: ["Vietnamese", "Chinese", "Japanese"], servings: 3, symbol: "❋",
    ingredients: [
      { name: "cucumber", amount: 2, unit: "", aisle: "Produce" },
      { name: "rice vinegar", amount: 1, unit: "tbsp", aisle: "Pantry" },
      { name: "sesame oil", amount: 1, unit: "tsp", aisle: "Pantry" },
    ],
    recipe: "Smash, salt and drain the cucumbers. Toss with vinegar and sesame oil.",
  },
  {
    id: "broccoli", name: "Sesame broccoli", type: "side", families: ["Chinese", "Japanese", "Neutral"], servings: 3, symbol: "♣",
    ingredients: [
      { name: "broccoli", amount: 1, unit: "head", aisle: "Produce" },
      { name: "sesame seeds", amount: 1, unit: "tbsp", aisle: "Pantry" },
    ],
  },
  {
    id: "garlic-greens", name: "Garlic greens", type: "side", families: ["Vietnamese", "Chinese", "Neutral"], servings: 2, symbol: "♧",
    ingredients: [
      { name: "bok choy", amount: 1, unit: "bunch", aisle: "Produce" },
      { name: "garlic", amount: 2, unit: "cloves", aisle: "Produce" },
    ],
  },
  {
    id: "squash", name: "Roasted squash", type: "side", families: ["Japanese", "Western", "Neutral"], servings: 3, symbol: "◔",
    ingredients: [{ name: "kabocha squash", amount: 0.5, unit: "", aisle: "Produce" }],
  },
  {
    id: "yogurt-bowl", name: "Blueberry yogurt bowl", type: "breakfast", families: ["Breakfast"], servings: 1, symbol: "●",
    ingredients: [
      { name: "Greek yogurt", amount: 1, unit: "cup", aisle: "Dairy & eggs" },
      { name: "blueberries", amount: 0.5, unit: "cup", aisle: "Produce" },
      { name: "granola", amount: 0.25, unit: "cup", aisle: "Pantry" },
    ],
  },
  {
    id: "egg-toast", name: "Jammy egg toast", type: "breakfast", families: ["Breakfast"], servings: 1, symbol: "☼",
    ingredients: [
      { name: "eggs", amount: 2, unit: "", aisle: "Dairy & eggs" },
      { name: "sourdough bread", amount: 2, unit: "slices", aisle: "Bakery" },
    ],
  },
  {
    id: "banana-oats", name: "Banana cinnamon oats", type: "breakfast", families: ["Breakfast"], servings: 2, symbol: "◡",
    ingredients: [
      { name: "rolled oats", amount: 1, unit: "cup", aisle: "Pantry" },
      { name: "banana", amount: 2, unit: "", aisle: "Produce" },
      { name: "milk", amount: 2, unit: "cups", aisle: "Dairy & eggs" },
    ],
  },
  {
    id: "pho", name: "Quick chicken pho", type: "complete", families: ["Vietnamese"], servings: 3, symbol: "♨",
    ingredients: [
      { name: "rice noodles", amount: 300, unit: "g", aisle: "Pantry" },
      { name: "chicken breast", amount: 300, unit: "g", aisle: "Meat & seafood" },
      { name: "chicken broth", amount: 1, unit: "L", aisle: "Pantry" },
      { name: "bean sprouts", amount: 1, unit: "bag", aisle: "Produce" },
    ],
    recipe: "Warm the broth with ginger and spices. Add noodles and sliced chicken, then finish with sprouts.",
  },
];

function rotate<T>(items: T[], amount: number) {
  if (!items.length) return items;
  const point = amount % items.length;
  return [...items.slice(point), ...items.slice(0, point)];
}

function compatible(a: Dish, b: Dish) {
  return a.families.some((family) => b.families.includes(family) || b.families.includes("Neutral"));
}

function buildWeek(dishes: Dish[], seed = 0): WeekPlan {
  const breakfasts = rotate(dishes.filter((dish) => dish.type === "breakfast"), seed);
  const mains = rotate(dishes.filter((dish) => dish.type === "main"), seed);
  const bases = dishes.filter((dish) => dish.type === "base");
  const sides = dishes.filter((dish) => dish.type === "side");
  const fallback = dishes[0];

  const breakfast: Meal[] = DAYS.map((_, dayIndex) => {
    const dish = breakfasts[dayIndex % Math.max(breakfasts.length, 1)] || fallback;
    return {
      id: `breakfast-${seed}-${dayIndex}`,
      componentIds: dish ? [dish.id] : [],
      batchIds: dish ? { [dish.id]: `bf-${seed}-${dayIndex}-${dish.id}` } : {},
      leftover: false,
    };
  });

  const savory: Meal[] = [];
  let slot = 0;
  let block = 0;
  while (slot < 14 && mains.length) {
    const main = mains[block % mains.length];
    const matchingBases = bases.filter((dish) => compatible(main, dish));
    const matchingSides = sides.filter((dish) => compatible(main, dish));
    const base = matchingBases[(block + seed) % Math.max(matchingBases.length, 1)];
    const side = matchingSides[(block * 2 + seed) % Math.max(matchingSides.length, 1)];
    const components = [main, base, side].filter(Boolean) as Dish[];
    const uses = Math.min(Math.max(main.servings, 2), 3, 14 - slot);
    const batchIds = Object.fromEntries(components.map((dish) => [dish.id, `batch-${seed}-${block}-${dish.id}`]));

    for (let use = 0; use < uses; use += 1) {
      savory.push({
        id: `meal-${seed}-${slot}`,
        componentIds: components.map((dish) => dish.id),
        batchIds,
        leftover: use > 0,
        cookedAt: use > 0 ? `${DAYS[Math.floor(slot / 2)].short}` : undefined,
      });
      slot += 1;
    }
    block += 1;
  }

  while (savory.length < 14) {
    savory.push({ id: `empty-${savory.length}`, componentIds: [], batchIds: {}, leftover: false });
  }

  return {
    breakfast,
    lunch: DAYS.map((_, index) => savory[index * 2]),
    dinner: DAYS.map((_, index) => savory[index * 2 + 1]),
  };
}

function prettyAmount(amount: number) {
  if (Number.isInteger(amount)) return String(amount);
  if (amount === 0.25) return "¼";
  if (amount === 0.5) return "½";
  if (amount === 0.75) return "¾";
  return amount.toFixed(1).replace(/\.0$/, "");
}

const blankIngredient = (): Ingredient => ({ name: "", amount: 1, unit: "", aisle: "Produce" });

export default function Home() {
  const [view, setView] = useState<View>("week");
  const [mealTime, setMealTime] = useState<MealTime>("dinner");
  const [dishes, setDishes] = useState<Dish[]>(DEFAULT_DISHES);
  const [seed, setSeed] = useState(0);
  const [plan, setPlan] = useState<WeekPlan>(() => buildWeek(DEFAULT_DISHES));
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | DishType>("all");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [showAddDish, setShowAddDish] = useState(false);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [showPantry, setShowPantry] = useState(false);
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [newDish, setNewDish] = useState({
    name: "", type: "main" as DishType, families: "Vietnamese", servings: 2,
    recipe: "", link: "", ingredients: [blankIngredient()],
  });

  useEffect(() => {
    try {
      const savedDishes = localStorage.getItem("little-lunchbox-dishes");
      const savedPlan = localStorage.getItem("little-lunchbox-plan");
      const savedPantry = localStorage.getItem("little-lunchbox-pantry");
      if (savedDishes) setDishes(JSON.parse(savedDishes));
      if (savedPlan) setPlan(JSON.parse(savedPlan));
      if (savedPantry) setPantryItems(JSON.parse(savedPantry));
    } catch {
      // Keep the starter kitchen if local data is malformed.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("little-lunchbox-dishes", JSON.stringify(dishes));
    localStorage.setItem("little-lunchbox-plan", JSON.stringify(plan));
    localStorage.setItem("little-lunchbox-pantry", JSON.stringify(pantryItems));
  }, [dishes, plan, pantryItems, loaded]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const dishMap = useMemo(() => new Map(dishes.map((dish) => [dish.id, dish])), [dishes]);

  const filteredDishes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return dishes.filter((dish) => {
      const matchesType = typeFilter === "all" || dish.type === typeFilter;
      const matchesQuery = !needle || dish.name.toLowerCase().includes(needle) || dish.ingredients.some((item) => item.name.toLowerCase().includes(needle));
      return matchesType && matchesQuery;
    });
  }, [dishes, query, typeFilter]);

  const groceryItems = useMemo(() => {
    const cookedBatches = new Set<string>();
    const totals = new Map<string, Ingredient>();

    (Object.keys(plan) as MealTime[]).forEach((time) => {
      plan[time].forEach((meal) => {
        meal.componentIds.forEach((dishId) => {
          const batchId = meal.batchIds[dishId] || `${meal.id}-${dishId}`;
          if (cookedBatches.has(batchId)) return;
          cookedBatches.add(batchId);
          const dish = dishMap.get(dishId);
          dish?.ingredients.forEach((ingredient) => {
            const key = `${ingredient.name.toLowerCase()}|${ingredient.unit.toLowerCase()}`;
            const current = totals.get(key);
            totals.set(key, current ? { ...current, amount: current.amount + ingredient.amount } : { ...ingredient });
          });
        });
      });
    });

    return [...totals.entries()].map(([key, ingredient]) => ({ key, ...ingredient }));
  }, [plan, dishMap]);

  const groceryGroups = useMemo(() => {
    return groceryItems
      .filter((item) => !pantryItems.includes(item.key))
      .reduce<Record<string, typeof groceryItems>>((groups, item) => {
        (groups[item.aisle] ||= []).push(item);
        return groups;
      }, {});
  }, [groceryItems, pantryItems]);

  const leftoverBatches = useMemo(() => {
    const batches = new Map<string, { dish: Dish; uses: { day: string; time: MealTime }[] }>();
    (Object.keys(plan) as MealTime[]).forEach((time) => {
      plan[time].forEach((meal, dayIndex) => {
        meal.componentIds.forEach((dishId) => {
          const batchId = meal.batchIds[dishId];
          const dish = dishMap.get(dishId);
          if (!batchId || !dish) return;
          const entry = batches.get(batchId) || { dish, uses: [] };
          entry.uses.push({ day: DAYS[dayIndex].short, time });
          batches.set(batchId, entry);
        });
      });
    });
    return [...batches.values()].filter((batch) => batch.uses.length > 1);
  }, [plan, dishMap]);

  function regenerateWeek() {
    const nextSeed = seed + 1;
    setSeed(nextSeed);
    setPlan(buildWeek(dishes, nextSeed));
    setCheckedItems([]);
    setToast("A fresh week is on the table!");
  }

  function regenerateMeal(time: MealTime, dayIndex: number) {
    if (time === "breakfast") {
      const breakfasts = dishes.filter((dish) => dish.type === "breakfast");
      const current = plan.breakfast[dayIndex]?.componentIds[0];
      const index = breakfasts.findIndex((dish) => dish.id === current);
      const next = breakfasts[(index + 1 + breakfasts.length) % breakfasts.length];
      if (!next) return;
      const batch = `remix-${Date.now()}-${next.id}`;
      setPlan((currentPlan) => ({
        ...currentPlan,
        breakfast: currentPlan.breakfast.map((meal, indexOfMeal) => indexOfMeal === dayIndex ? {
          id: batch, componentIds: [next.id], batchIds: { [next.id]: batch }, leftover: false,
        } : meal),
      }));
    } else {
      const mains = dishes.filter((dish) => dish.type === "main");
      const currentMain = dishMap.get(plan[time][dayIndex]?.componentIds.find((id) => dishMap.get(id)?.type === "main") || "");
      const currentIndex = mains.findIndex((dish) => dish.id === currentMain?.id);
      const main = mains[(currentIndex + 1 + mains.length) % mains.length];
      if (!main) return;
      const base = dishes.find((dish) => dish.type === "base" && compatible(main, dish));
      const side = dishes.find((dish) => dish.type === "side" && compatible(main, dish));
      const components = [main, base, side].filter(Boolean) as Dish[];
      const stamp = `remix-${Date.now()}`;
      const newMeal: Meal = {
        id: stamp,
        componentIds: components.map((dish) => dish.id),
        batchIds: Object.fromEntries(components.map((dish) => [dish.id, `${stamp}-${dish.id}`])),
        leftover: false,
      };
      setPlan((currentPlan) => ({
        ...currentPlan,
        [time]: currentPlan[time].map((meal, index) => index === dayIndex ? newMeal : meal),
      }));
    }
    setToast(`${DAYS[dayIndex].long} ${time} remixed`);
  }

  function submitDish(event: FormEvent) {
    event.preventDefault();
    const validIngredients = newDish.ingredients.filter((ingredient) => ingredient.name.trim());
    if (!newDish.name.trim() || !validIngredients.length) return;
    const dish: Dish = {
      id: `${newDish.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name: newDish.name.trim(),
      type: newDish.type,
      families: newDish.families.split(",").map((family) => family.trim()).filter(Boolean),
      servings: Math.max(1, Number(newDish.servings)),
      ingredients: validIngredients,
      recipe: newDish.recipe.trim() || undefined,
      link: newDish.link.trim() || undefined,
      symbol: TYPE_SYMBOLS[newDish.type],
    };
    setDishes((current) => [...current, dish]);
    setNewDish({ name: "", type: "main", families: "Vietnamese", servings: 2, recipe: "", link: "", ingredients: [blankIngredient()] });
    setShowAddDish(false);
    setToast(`${dish.name} joined your kitchen`);
  }

  function removeDish(id: string) {
    const nextDishes = dishes.filter((dish) => dish.id !== id);
    setDishes(nextDishes);
    setPlan(buildWeek(nextDishes, seed + 1));
    setSelectedDish(null);
    setToast("Dish removed from your kitchen");
  }

  function updateIngredient(index: number, key: keyof Ingredient, value: string | number) {
    setNewDish((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, itemIndex) => itemIndex === index ? { ...ingredient, [key]: key === "amount" ? Number(value) : value } : ingredient),
    }));
  }

  const navItems: { id: View; label: string; icon: string }[] = [
    { id: "week", label: "this week", icon: "▦" },
    { id: "kitchen", label: "my kitchen", icon: "⌂" },
    { id: "grocery", label: "grocery list", icon: "☷" },
    { id: "leftovers", label: "leftovers", icon: "↺" },
  ];

  return (
    <main className={`site-shell view-${view}`}>
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("week")} aria-label="Little Lunchbox home">
          <span className="brand-mark">✿</span>
          <span>little<br />lunchbox</span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => setView(item.id)}>
              <span>{item.icon}</span>{item.label}
              {item.id === "grocery" && <small>{groceryItems.length - pantryItems.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-doodle">⌁</span>
          <p>Good food,<br />all figured out.</p>
        </div>
      </aside>

      <section className="content">
        {view === "week" && (
          <>
            <header className="page-header">
              <div>
                <p className="eyebrow">SEPTEMBER 14—20 · FOR ONE</p>
                <h1>What are we eating?</h1>
                <p className="subtitle">Your week is planned, your leftovers are loved.</p>
              </div>
              <button className="primary-button" onClick={regenerateWeek}><span>✦</span> mix me a new week</button>
            </header>

            <div className="planner-wrap">
              <div className="tape" aria-hidden="true" />
              <div className="planner-toolbar">
                <div className="meal-tabs" role="tablist" aria-label="Meal time">
                  {(["breakfast", "lunch", "dinner"] as MealTime[]).map((time) => (
                    <button role="tab" aria-selected={mealTime === time} className={mealTime === time ? "selected" : ""} key={time} onClick={() => setMealTime(time)}>{time}</button>
                  ))}
                </div>
                <p><span className="leftover-dot" /> softly shaded = leftovers</p>
              </div>
              <div className="week-grid">
                {DAYS.map((day, dayIndex) => {
                  const meal = plan[mealTime][dayIndex];
                  return (
                    <article className={`day-card ${dayIndex === 0 ? "today" : ""} ${meal?.leftover ? "has-leftover" : ""}`} key={day.short}>
                      <div className="day-heading">
                        <span>{day.short}</span>
                        <strong>{day.date}</strong>
                      </div>
                      {meal?.leftover && <span className="leftover-stamp">LEFTOVERS</span>}
                      <div className="meal-components">
                        {meal?.componentIds.map((dishId) => {
                          const dish = dishMap.get(dishId);
                          if (!dish) return null;
                          return (
                            <button className={`dish type-${dish.type}`} key={dish.id} onClick={() => setSelectedDish(dish)}>
                              <span className="dish-label">{TYPE_LABELS[dish.type]}</span>
                              <span className="dish-name">{dish.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      <button className="remix" onClick={() => regenerateMeal(mealTime, dayIndex)} aria-label={`Regenerate ${day.long} ${mealTime}`}>↻</button>
                    </article>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {view === "kitchen" && (
          <>
            <header className="page-header kitchen-header">
              <div>
                <p className="eyebrow">YOUR REUSABLE DISH BOX</p>
                <h1>My kitchen</h1>
                <p className="subtitle">Every dish you teach me makes next week easier.</p>
              </div>
              <button className="primary-button" onClick={() => setShowAddDish(true)}><span>＋</span> add a dish</button>
            </header>
            <section className="kitchen-paper">
              <div className="kitchen-controls">
                <label className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="search dishes or ingredients..." /></label>
                <div className="filter-row" aria-label="Filter dishes by type">
                  {(["all", "main", "base", "side", "breakfast", "complete"] as const).map((type) => (
                    <button key={type} className={typeFilter === type ? "selected" : ""} onClick={() => setTypeFilter(type)}>{type === "all" ? "all" : TYPE_LABELS[type]}</button>
                  ))}
                </div>
              </div>
              <div className="dish-grid">
                {filteredDishes.map((dish, index) => (
                  <button className={`recipe-card type-${dish.type}`} style={{ "--tilt": `${[-1.2, .8, -.4, 1.1][index % 4]}deg` } as React.CSSProperties} key={dish.id} onClick={() => setSelectedDish(dish)}>
                    <span className="card-symbol">{dish.symbol}</span>
                    <span className="card-type">{TYPE_LABELS[dish.type]}</span>
                    <strong>{dish.name}</strong>
                    <span className="card-family">{dish.families.join(" · ")}</span>
                    <span className="card-footer">makes {dish.servings} {dish.servings === 1 ? "meal" : "meals"}<b>→</b></span>
                  </button>
                ))}
                {!filteredDishes.length && <div className="empty-kitchen"><p>No cards match that search.</p><button onClick={() => { setQuery(""); setTypeFilter("all"); }}>clear filters</button></div>}
              </div>
            </section>
          </>
        )}

        {view === "grocery" && (
          <>
            <header className="page-header grocery-header">
              <div>
                <p className="eyebrow">SEPTEMBER 14—20</p>
                <h1>Grocery list</h1>
                <p className="subtitle">Combined, sorted, and ready for the shops.</p>
              </div>
              <div className="grocery-progress">
                <span>{checkedItems.length} of {groceryItems.length - pantryItems.length}</span>
                <div><i style={{ width: `${Math.min(100, (checkedItems.length / Math.max(groceryItems.length - pantryItems.length, 1)) * 100)}%` }} /></div>
              </div>
            </header>
            <div className="grocery-layout">
              <section className="grocery-paper">
                <div className="paper-holes" aria-hidden="true">••••••••••••</div>
                <div className="grocery-summary">
                  <p><strong>{groceryItems.length - pantryItems.length}</strong> things to pick up</p>
                  <button onClick={() => setShowPantry(!showPantry)}>{pantryItems.length} pantry {pantryItems.length === 1 ? "item" : "items"} hidden {showPantry ? "↑" : "↓"}</button>
                </div>
                {showPantry && (
                  <div className="pantry-tray">
                    <p>Already in your pantry</p>
                    {pantryItems.length ? pantryItems.map((key) => {
                      const item = groceryItems.find((grocery) => grocery.key === key);
                      return item ? <button key={key} onClick={() => setPantryItems((items) => items.filter((itemKey) => itemKey !== key))}>{item.name} <span>put back ＋</span></button> : null;
                    }) : <span>Nothing marked yet.</span>}
                  </div>
                )}
                <div className="grocery-columns">
                  {Object.entries(groceryGroups).map(([aisle, items]) => (
                    <div className="aisle-group" key={aisle}>
                      <h2>{aisle}</h2>
                      {items.map((item) => {
                        const done = checkedItems.includes(item.key);
                        return (
                          <div className={`grocery-item ${done ? "done" : ""}`} key={item.key}>
                            <button className="check-button" onClick={() => setCheckedItems((current) => done ? current.filter((key) => key !== item.key) : [...current, item.key])} aria-label={`${done ? "Uncheck" : "Check"} ${item.name}`}>{done ? "✓" : ""}</button>
                            <span className="grocery-name">{item.name}</span>
                            <span className="grocery-amount">{prettyAmount(item.amount)} {item.unit}</span>
                            <button className="pantry-button" onClick={() => setPantryItems((current) => [...current, item.key])} title="I already have this" aria-label={`Mark ${item.name} as already in pantry`}>⌂</button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </section>
              <aside className="grocery-art">
                <div className="art-card blueberries"><span>market day</span></div>
                <p>Tip: tap the little house beside anything you already have. I’ll tuck it away from your list.</p>
              </aside>
            </div>
          </>
        )}

        {view === "leftovers" && (
          <>
            <header className="page-header leftovers-header">
              <div>
                <p className="eyebrow">COOK ONCE, EAT HAPPILY</p>
                <h1>Leftover map</h1>
                <p className="subtitle">Every batch gets eaten within the next three or four days.</p>
              </div>
            </header>
            <div className="leftover-layout">
              <section className="leftover-board">
                <h2>This week’s batches</h2>
                <div className="batch-list">
                  {leftoverBatches.map((batch, index) => (
                    <article className={`batch-card type-${batch.dish.type}`} key={`${batch.dish.id}-${index}`}>
                      <div className="batch-icon">{batch.dish.symbol}</div>
                      <div>
                        <span>{TYPE_LABELS[batch.dish.type]}</span>
                        <h3>{batch.dish.name}</h3>
                        <div className="use-path">
                          {batch.uses.map((use, useIndex) => (
                            <span key={`${use.day}-${use.time}`}>{useIndex === 0 ? "cook" : "eat"} <b>{use.day}</b> · {use.time}</span>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <aside className="cat-note">
                <div className="cat-picture" />
                <h2>No forgotten containers.</h2>
                <p>Your generated menu keeps every repeat close to its cooking day.</p>
                <button onClick={() => setView("week")}>back to my week →</button>
              </aside>
            </div>
          </>
        )}
      </section>

      {selectedDish && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedDish(null)}>
          <section className={`dish-detail type-${selectedDish.type}`} role="dialog" aria-modal="true" aria-label={selectedDish.name} onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedDish(null)} aria-label="Close">×</button>
            <span className="detail-symbol">{selectedDish.symbol}</span>
            <p className="eyebrow">{TYPE_LABELS[selectedDish.type]}</p>
            <h2>{selectedDish.name}</h2>
            <div className="detail-meta"><span>makes {selectedDish.servings} meals</span><span>{selectedDish.families.join(" · ")}</span></div>
            <h3>Ingredients</h3>
            <ul>{selectedDish.ingredients.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.name}</span><b>{prettyAmount(item.amount)} {item.unit}</b></li>)}</ul>
            {selectedDish.recipe && <><h3>Little recipe note</h3><p className="recipe-note">{selectedDish.recipe}</p></>}
            {selectedDish.link && <a className="recipe-link" href={selectedDish.link} target="_blank" rel="noreferrer">open recipe link ↗</a>}
            <button className="delete-dish" onClick={() => removeDish(selectedDish.id)}>remove this card</button>
          </section>
        </div>
      )}

      {showAddDish && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAddDish(false)}>
          <form className="add-dish-modal" onSubmit={submitDish} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowAddDish(false)} aria-label="Close">×</button>
            <p className="eyebrow">A NEW RECIPE CARD</p>
            <h2>Add a dish</h2>
            <div className="form-grid two">
              <label><span>Dish name</span><input required value={newDish.name} onChange={(event) => setNewDish({ ...newDish, name: event.target.value })} placeholder="e.g. lemongrass pork" /></label>
              <label><span>Type</span><select value={newDish.type} onChange={(event) => setNewDish({ ...newDish, type: event.target.value as DishType })}>{(Object.keys(TYPE_LABELS) as DishType[]).map((type) => <option value={type} key={type}>{TYPE_LABELS[type]}</option>)}</select></label>
              <label><span>Pairing family</span><input required value={newDish.families} onChange={(event) => setNewDish({ ...newDish, families: event.target.value })} placeholder="Vietnamese, Neutral" /><small>Separate multiple families with commas.</small></label>
              <label><span>Meals from one batch</span><input type="number" min="1" max="8" required value={newDish.servings} onChange={(event) => setNewDish({ ...newDish, servings: Number(event.target.value) })} /></label>
            </div>
            <div className="ingredient-editor">
              <div className="editor-heading"><h3>Ingredients</h3><button type="button" onClick={() => setNewDish((current) => ({ ...current, ingredients: [...current.ingredients, blankIngredient()] }))}>＋ add ingredient</button></div>
              {newDish.ingredients.map((ingredient, index) => (
                <div className="ingredient-row" key={index}>
                  <input aria-label="Ingredient name" required value={ingredient.name} onChange={(event) => updateIngredient(index, "name", event.target.value)} placeholder="ingredient" />
                  <input aria-label="Amount" type="number" min="0" step="0.25" required value={ingredient.amount} onChange={(event) => updateIngredient(index, "amount", event.target.value)} />
                  <input aria-label="Unit" value={ingredient.unit} onChange={(event) => updateIngredient(index, "unit", event.target.value)} placeholder="unit" />
                  <select aria-label="Aisle" value={ingredient.aisle} onChange={(event) => updateIngredient(index, "aisle", event.target.value)}>
                    {["Produce", "Meat & seafood", "Dairy & eggs", "Pantry", "Bakery", "Frozen", "Other"].map((aisle) => <option key={aisle}>{aisle}</option>)}
                  </select>
                  {newDish.ingredients.length > 1 && <button type="button" className="remove-ingredient" onClick={() => setNewDish((current) => ({ ...current, ingredients: current.ingredients.filter((_, itemIndex) => itemIndex !== index) }))} aria-label="Remove ingredient">×</button>}
                </div>
              ))}
            </div>
            <div className="form-grid two">
              <label><span>Recipe note <i>optional</i></span><textarea value={newDish.recipe} onChange={(event) => setNewDish({ ...newDish, recipe: event.target.value })} placeholder="A few steps or reminders..." /></label>
              <label><span>Recipe link <i>optional</i></span><input type="url" value={newDish.link} onChange={(event) => setNewDish({ ...newDish, link: event.target.value })} placeholder="https://..." /></label>
            </div>
            <button className="primary-button form-submit" type="submit">pin it in my kitchen ✦</button>
          </form>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
