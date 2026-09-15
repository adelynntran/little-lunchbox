"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type DishType = "main" | "base" | "side" | "breakfast" | "complete";
type MealTime = "breakfast" | "lunch" | "dinner";
type View = "week" | "kitchen" | "grocery" | "leftovers";
type SyncStatus = "loading" | "saving" | "synced" | "local" | "offline";

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

type KitchenState = {
  dishes: Dish[];
  plan: WeekPlan;
  pantryItems: string[];
  checkedItems: string[];
  seed: number;
};

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

const LEGACY_STARTER_DISH_IDS = new Set([
  "viet-pork", "ginger-salmon", "miso-chicken", "tomato-eggs", "lemon-chicken",
  "rice", "udon", "pasta", "cucumber", "broccoli", "garlic-greens", "squash",
  "yogurt-bowl", "egg-toast", "banana-oats", "pho",
]);

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

  const breakfast: Meal[] = DAYS.map((_, dayIndex) => {
    const dish = breakfasts[dayIndex % Math.max(breakfasts.length, 1)];
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

function removeLegacyStarterData(state: KitchenState) {
  const dishes = state.dishes.filter((dish) => !LEGACY_STARTER_DISH_IDS.has(dish.id));
  const planUsesStarterData = Object.values(state.plan).some((meals) =>
    meals.some((meal) => meal.componentIds.some((id) => LEGACY_STARTER_DISH_IDS.has(id))),
  );
  if (dishes.length === state.dishes.length && !planUsesStarterData) return state;

  const seed = state.seed + 1;
  return {
    dishes,
    plan: buildWeek(dishes, seed),
    pantryItems: [],
    checkedItems: [],
    seed,
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

const makeId = (prefix: string) => `${prefix}-${globalThis.crypto.randomUUID()}`;

export default function Home() {
  const [view, setView] = useState<View>("week");
  const [mealTime, setMealTime] = useState<MealTime>("dinner");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [seed, setSeed] = useState(0);
  const [plan, setPlan] = useState<WeekPlan>(() => buildWeek([]));
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | DishType>("all");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [showAddDish, setShowAddDish] = useState(false);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [showPantry, setShowPantry] = useState(false);
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [newDish, setNewDish] = useState({
    name: "", type: "main" as DishType, families: "", servings: 2,
    recipe: "", link: "", ingredients: [blankIngredient()],
  });

  useEffect(() => {
    let active = true;

    async function hydrateKitchen() {
      let cachedDishes: Dish[] = [];
      let cachedPlan = buildWeek([]);
      let cachedPantry: string[] = [];
      let cachedChecked: string[] = [];
      let cachedSeed = 0;

      try {
        const savedDishes = localStorage.getItem("little-lunchbox-dishes");
        const savedPlan = localStorage.getItem("little-lunchbox-plan");
        const savedPantry = localStorage.getItem("little-lunchbox-pantry");
        const savedChecked = localStorage.getItem("little-lunchbox-checked");
        const savedSeed = localStorage.getItem("little-lunchbox-seed");
        if (savedDishes) cachedDishes = JSON.parse(savedDishes);
        if (savedPlan) cachedPlan = JSON.parse(savedPlan);
        if (savedPantry) cachedPantry = JSON.parse(savedPantry);
        if (savedChecked) cachedChecked = JSON.parse(savedChecked);
        if (savedSeed) cachedSeed = Number(savedSeed) || 0;
        const cleanedCache = removeLegacyStarterData({
          dishes: cachedDishes,
          plan: cachedPlan,
          pantryItems: cachedPantry,
          checkedItems: cachedChecked,
          seed: cachedSeed,
        });
        cachedDishes = cleanedCache.dishes;
        cachedPlan = cleanedCache.plan;
        cachedPantry = cleanedCache.pantryItems;
        cachedChecked = cleanedCache.checkedItems;
        cachedSeed = cleanedCache.seed;
        setDishes(cleanedCache.dishes);
        setPlan(cleanedCache.plan);
        setPantryItems(cleanedCache.pantryItems);
        setCheckedItems(cleanedCache.checkedItems);
        setSeed(cleanedCache.seed);
      } catch {
        // An empty kitchen remains available if the offline cache is malformed.
      }

      try {
        const response = await fetch("/api/state", { cache: "no-store", credentials: "same-origin" });
        if (!active) return;
        if (response.status === 401) {
          setSyncStatus("local");
          return;
        }
        if (!response.ok) throw new Error("Cloud sync is unavailable");

        const payload = await response.json() as {
          state: null | {
            dishes: Dish[];
            plan: WeekPlan;
            pantryItems: string[];
            checkedItems: string[];
            seed: number;
          };
        };

        if (payload.state) {
          const cleanedState = removeLegacyStarterData(payload.state);
          setDishes(cleanedState.dishes);
          setPlan(cleanedState.plan);
          setPantryItems(cleanedState.pantryItems);
          setCheckedItems(cleanedState.checkedItems);
          setSeed(cleanedState.seed);
        } else {
          const migrationResponse = await fetch("/api/state", {
            method: "PUT",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              dishes: cachedDishes,
              plan: cachedPlan,
              pantryItems: cachedPantry,
              checkedItems: cachedChecked,
              seed: cachedSeed,
            }),
          });
          if (!migrationResponse.ok) throw new Error("Could not create the cloud copy");
        }
        if (active) setSyncStatus("synced");
      } catch {
        if (active) setSyncStatus("offline");
      } finally {
        if (active) setLoaded(true);
      }
    }

    void hydrateKitchen();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem("little-lunchbox-dishes", JSON.stringify(dishes));
    localStorage.setItem("little-lunchbox-plan", JSON.stringify(plan));
    localStorage.setItem("little-lunchbox-pantry", JSON.stringify(pantryItems));
    localStorage.setItem("little-lunchbox-checked", JSON.stringify(checkedItems));
    localStorage.setItem("little-lunchbox-seed", String(seed));

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSyncStatus((current) => current === "local" ? current : "saving");
        const response = await fetch("/api/state", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dishes, plan, pantryItems, checkedItems, seed }),
          signal: controller.signal,
        });
        if (response.status === 401) setSyncStatus("local");
        else if (response.ok) setSyncStatus("synced");
        else setSyncStatus("offline");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSyncStatus("offline");
      }
    }, 700);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [dishes, plan, pantryItems, checkedItems, seed, loaded]);

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
    if (!dishes.length) {
      setView("kitchen");
      setToast("Add your first dish, then I can plan the week!");
      return;
    }
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
      const batch = makeId(`remix-${next.id}`);
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
      const stamp = makeId("remix");
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
      id: makeId(newDish.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
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
    setNewDish({ name: "", type: "main", families: "", servings: 2, recipe: "", link: "", ingredients: [blankIngredient()] });
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
              {item.id === "grocery" && <small>{Math.max(0, groceryItems.length - pantryItems.length)}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className={`sync-status status-${syncStatus}`}>
            <i />
            {syncStatus === "loading" && "opening your kitchen..."}
            {syncStatus === "saving" && "saving..."}
            {syncStatus === "synced" && "saved across devices"}
            {syncStatus === "local" && "saved on this device"}
            {syncStatus === "offline" && "offline · saved locally"}
          </div>
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
                <p className="subtitle">{dishes.length ? "Your week is planned, your leftovers are loved." : "Start with a few favorite dishes and I’ll plan the rest."}</p>
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
                {!dishes.length ? (
                  <div className="planner-empty">
                    <span>⌂</span>
                    <h2>Your menu is ready for its first recipe.</h2>
                    <p>Add dishes to your kitchen, then mix a week from your own food.</p>
                    <button onClick={() => setShowAddDish(true)}>＋ add my first dish</button>
                  </div>
                ) : DAYS.map((day, dayIndex) => {
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
                      {!!meal?.componentIds.length && <button className="remix" onClick={() => regenerateMeal(mealTime, dayIndex)} aria-label={`Regenerate ${day.long} ${mealTime}`}>↻</button>}
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
                {!dishes.length ? (
                  <div className="empty-kitchen"><p>Your kitchen is empty—make your first reusable dish card.</p><button onClick={() => setShowAddDish(true)}>＋ add a dish</button></div>
                ) : !filteredDishes.length && (
                  <div className="empty-kitchen"><p>No cards match that search.</p><button onClick={() => { setQuery(""); setTypeFilter("all"); }}>clear filters</button></div>
                )}
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
                  {!groceryItems.length && <div className="section-empty"><h2>Nothing to shop for yet.</h2><p>Build a weekly menu and its ingredients will gather here automatically.</p><button onClick={() => setView("kitchen")}>go to my kitchen →</button></div>}
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
                  {!leftoverBatches.length && <div className="section-empty"><h3>No leftover batches yet.</h3><p>Once your menu reuses a cooked dish, its path will appear here.</p><button onClick={() => setView("kitchen")}>add dishes →</button></div>}
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
        <div className="modal-backdrop">
          <button type="button" className="modal-backdrop-dismiss" aria-label="Close dish details" onClick={() => setSelectedDish(null)} />
          <section className={`dish-detail type-${selectedDish.type}`} role="dialog" aria-modal="true" aria-label={selectedDish.name}>
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
        <div className="modal-backdrop">
          <button type="button" className="modal-backdrop-dismiss" aria-label="Close add dish form" onClick={() => setShowAddDish(false)} />
          <form className="add-dish-modal" onSubmit={submitDish}>
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
