type StoredState = {
  dishes: unknown[];
  plan: Record<string, unknown[]>;
  pantryItems: string[];
  checkedItems: string[];
  seed: number;
};

type StateRow = {
  dishes_json: string;
  plan_json: string;
  pantry_items_json: string;
  checked_items_json: string;
  seed: number;
  revision: number;
  updated_at: number;
};

const createStateTableSql = `
  CREATE TABLE IF NOT EXISTS app_state (
    owner TEXT PRIMARY KEY NOT NULL,
    dishes_json TEXT NOT NULL,
    plan_json TEXT NOT NULL,
    pantry_items_json TEXT NOT NULL DEFAULT '[]',
    checked_items_json TEXT NOT NULL DEFAULT '[]',
    seed INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  )
`;

function getOwner(request: Request) {
  return request.headers.get("x-little-lunchbox-owner")?.trim().toLowerCase() || null;
}

function unauthorized() {
  return Response.json(
    { error: "Sign in through Cloudflare Access to synchronize Little Lunchbox." },
    { status: 401 },
  );
}

function isStoredState(value: unknown): value is StoredState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<StoredState>;
  return Array.isArray(state.dishes)
    && !!state.plan
    && typeof state.plan === "object"
    && Array.isArray(state.pantryItems)
    && Array.isArray(state.checkedItems)
    && typeof state.seed === "number";
}

async function ensureSchema() {
  const { getD1 } = await import("../../../db");
  const d1 = getD1();
  await d1.prepare(createStateTableSql).run();
  return d1;
}

export async function GET(request: Request) {
  const owner = getOwner(request);
  if (!owner) return unauthorized();

  try {
    const d1 = await ensureSchema();
    const row = await d1
      .prepare(`
        SELECT dishes_json, plan_json, pantry_items_json, checked_items_json,
               seed, revision, updated_at
        FROM app_state
        WHERE owner = ?1
      `)
      .bind(owner)
      .first<StateRow>();

    if (!row) return Response.json({ state: null });

    return Response.json({
      state: {
        dishes: JSON.parse(row.dishes_json),
        plan: JSON.parse(row.plan_json),
        pantryItems: JSON.parse(row.pantry_items_json),
        checkedItems: JSON.parse(row.checked_items_json),
        seed: row.seed,
      },
      revision: row.revision,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load your kitchen." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const owner = getOwner(request);
  if (!owner) return unauthorized();

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1_000_000) {
    return Response.json({ error: "Kitchen data is too large." }, { status: 413 });
  }

  try {
    const payload = await request.json();
    if (!isStoredState(payload)) {
      return Response.json({ error: "Invalid Little Lunchbox state." }, { status: 400 });
    }

    const now = Date.now();
    const d1 = await ensureSchema();
    await d1
      .prepare(`
        INSERT INTO app_state (
          owner, dishes_json, plan_json, pantry_items_json,
          checked_items_json, seed, revision, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7)
        ON CONFLICT(owner) DO UPDATE SET
          dishes_json = excluded.dishes_json,
          plan_json = excluded.plan_json,
          pantry_items_json = excluded.pantry_items_json,
          checked_items_json = excluded.checked_items_json,
          seed = excluded.seed,
          revision = app_state.revision + 1,
          updated_at = excluded.updated_at
      `)
      .bind(
        owner,
        JSON.stringify(payload.dishes),
        JSON.stringify(payload.plan),
        JSON.stringify(payload.pantryItems),
        JSON.stringify(payload.checkedItems),
        payload.seed,
        now,
      )
      .run();

    return Response.json({ saved: true, updatedAt: now });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to save your kitchen." },
      { status: 500 },
    );
  }
}
