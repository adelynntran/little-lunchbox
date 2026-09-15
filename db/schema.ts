import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appState = sqliteTable("app_state", {
  owner: text("owner").primaryKey().notNull(),
  dishesJson: text("dishes_json").notNull(),
  planJson: text("plan_json").notNull(),
  pantryItemsJson: text("pantry_items_json").notNull().default("[]"),
  checkedItemsJson: text("checked_items_json").notNull().default("[]"),
  seed: integer("seed").notNull().default(0),
  revision: integer("revision").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
});
