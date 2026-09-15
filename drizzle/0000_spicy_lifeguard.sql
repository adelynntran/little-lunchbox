CREATE TABLE `app_state` (
	`owner` text PRIMARY KEY NOT NULL,
	`dishes_json` text NOT NULL,
	`plan_json` text NOT NULL,
	`pantry_items_json` text DEFAULT '[]' NOT NULL,
	`checked_items_json` text DEFAULT '[]' NOT NULL,
	`seed` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
