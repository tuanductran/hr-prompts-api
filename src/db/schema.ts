import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories = sqliteTable("categories", {
	id: text("id").primaryKey(), // slug, e.g. "recruiting"
	name: text("name").notNull(),
	type: text("type", { enum: ["database", "page"] }).notNull(),
	notionId: text("notion_id").notNull(), // data_source_id or page_id
	description: text("description"),
	syncedAt: integer("synced_at", { mode: "timestamp" }),
});

// ─── Topics ───────────────────────────────────────────────────────────────────
export const topics = sqliteTable("topics", {
	id: text("id").primaryKey(), // e.g. "recruiting--conducting-reference-checks--02b0893c"
	categoryId: text("category_id")
		.notNull()
		.references(() => categories.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	description: text("description"),
	notionId: text("notion_id").notNull(), // page_id
	syncedAt: integer("synced_at", { mode: "timestamp" }),
});

// ─── Prompts ──────────────────────────────────────────────────────────────────
export const prompts = sqliteTable("prompts", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	topicId: text("topic_id")
		.notNull()
		.references(() => topics.id, { onDelete: "cascade" }),
	text: text("text").notNull(),
	orderIndex: integer("order_index").notNull().default(0),
});

// ─── Sync log ─────────────────────────────────────────────────────────────────
export const syncLog = sqliteTable("sync_log", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	status: text("status", { enum: ["started", "completed", "failed"] }).notNull(),
	details: text("details"),
	startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
	completedAt: integer("completed_at", { mode: "timestamp" }),
});

// ─── Relations (enables db.query.* relational API) ───────────────────────────
export const categoriesRelations = relations(categories, ({ many }) => ({
	topics: many(topics),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
	category: one(categories, {
		fields: [topics.categoryId],
		references: [categories.id],
	}),
	prompts: many(prompts),
}));

export const promptsRelations = relations(prompts, ({ one }) => ({
	topic: one(topics, {
		fields: [prompts.topicId],
		references: [topics.id],
	}),
}));

// Row types — use the `Row` suffix to avoid shadowing the application-layer
// types of the same name defined in src/types.ts.
export type CategoryRow = typeof categories.$inferSelect;
export type TopicRow = typeof topics.$inferSelect;
export type PromptRow = typeof prompts.$inferSelect;
export type SyncLogRow = typeof syncLog.$inferSelect;
