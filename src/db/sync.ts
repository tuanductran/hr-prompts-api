import { desc, eq } from "drizzle-orm";
import { cacheAdapter } from "@/cache-adapter";
import { db, schema } from "@/db";
import { logger } from "@/logger";
import {
	clearDynamicCategoriesCache,
	getDynamicCategories,
	getTopicDetailFromNotion,
	getTopicsFromNotion,
} from "@/notion";

// ─── Full sync: pull all Notion data → Turso DB ───────────────────────────────
export async function fullSync(): Promise<{ categories: number; topics: number; prompts: number }> {
	// Reset the in-memory category config cache so structural Notion changes
	// (new or removed categories) are picked up on this sync run.
	clearDynamicCategoriesCache();

	const startedAt = new Date();
	const logResult = await db
		.insert(schema.syncLog)
		.values({ status: "started", startedAt })
		.returning();
	const logId = logResult[0]?.id ?? 0;

	let catCount = 0;
	let topicCount = 0;
	let promptCount = 0;

	try {
		// ── Step 1: Fetch ALL data from Notion before opening any DB transaction ──
		// This avoids holding a DB write-lock while waiting on Notion HTTP calls.
		type NotionTopicData = {
			catId: string;
			catName: string;
			catType: "database" | "page";
			catNotionId: string;
			catDescription: string;
			topicId: string;
			topicName: string;
			topicNotionPageId: string;
			topicType: "database" | "page";
			description: string;
			prompts: { text: string }[];
		};

		const categories = await getDynamicCategories();
		const allTopicData: NotionTopicData[] = [];

		for (const cat of categories) {
			const catId = slugify(cat.name);
			const notionTopics = await getTopicsFromNotion(cat);

			for (const nt of notionTopics) {
				const detail = await getTopicDetailFromNotion(nt.notionPageId, nt.type);
				allTopicData.push({
					catId,
					catName: cat.name,
					catType: cat.type,
					catNotionId: cat.type === "database" ? cat.dataSourceId : cat.pageId,
					catDescription: cat.description,
					topicId: nt.id,
					topicName: nt.name,
					topicNotionPageId: nt.notionPageId,
					topicType: nt.type,
					description: detail.description,
					prompts: detail.prompts,
				});
			}
		}

		// ── Step 2: Write everything to DB in a single transaction ────────────
		// behavior: "immediate" acquires a write-lock upfront — avoids deadlocks
		// when multiple writers compete on Turso's HTTP transport.
		await db.transaction(
			async (tx) => {
				// Upsert categories
				const seenCatIds = new Set<string>();
				for (const td of allTopicData) {
					if (seenCatIds.has(td.catId)) continue;
					seenCatIds.add(td.catId);

					await tx
						.insert(schema.categories)
						.values({
							id: td.catId,
							name: td.catName,
							type: td.catType,
							notionId: td.catNotionId,
							description: td.catDescription,
							syncedAt: new Date(),
						})
						.onConflictDoUpdate({
							target: schema.categories.id,
							set: {
								name: td.catName,
								notionId: td.catNotionId,
								description: td.catDescription,
								syncedAt: new Date(),
							},
						});
					catCount++;
				}

				// Upsert topics + prompts
				for (const td of allTopicData) {
					await tx
						.insert(schema.topics)
						.values({
							id: td.topicId,
							categoryId: td.catId,
							name: td.topicName,
							description: td.description || null,
							notionId: td.topicNotionPageId,
							syncedAt: new Date(),
						})
						.onConflictDoUpdate({
							target: schema.topics.id,
							set: {
								name: td.topicName,
								notionId: td.topicNotionPageId,
								description: td.description || null,
								syncedAt: new Date(),
							},
						});
					topicCount++;

					await tx.delete(schema.prompts).where(eq(schema.prompts.topicId, td.topicId));
					if (td.prompts.length > 0) {
						await tx.insert(schema.prompts).values(
							td.prompts.map((p, i) => ({
								topicId: td.topicId,
								text: p.text,
								orderIndex: i,
							})),
						);
						promptCount += td.prompts.length;
					}
				}
			},
			{ behavior: "immediate" },
		);

		await db
			.update(schema.syncLog)
			.set({
				status: "completed",
				completedAt: new Date(),
				details: JSON.stringify({
					categories: catCount,
					topics: topicCount,
					prompts: promptCount,
				}),
			})
			.where(eq(schema.syncLog.id, logId));

		// Invalidate all cached route results — fresh data is now in the DB
		await cacheAdapter.clear();
	} catch (err) {
		await db
			.update(schema.syncLog)
			.set({ status: "failed", completedAt: new Date(), details: String(err) })
			.where(eq(schema.syncLog.id, logId));
		throw err;
	}

	return { categories: catCount, topics: topicCount, prompts: promptCount };
}

// ─── Partial sync: re-sync a single Notion page by its page ID ────────────────
export async function syncPage(notionPageId: string): Promise<boolean> {
	try {
		const [topic] = await db
			.select()
			.from(schema.topics)
			.where(eq(schema.topics.notionId, notionPageId))
			.limit(1);

		if (!topic) return false;

		const [category] = await db
			.select()
			.from(schema.categories)
			.where(eq(schema.categories.id, topic.categoryId))
			.limit(1);

		if (!category) return false;

		const detail = await getTopicDetailFromNotion(notionPageId, category.type);

		if (detail.description) {
			await db
				.update(schema.topics)
				.set({ description: detail.description, syncedAt: new Date() })
				.where(eq(schema.topics.notionId, notionPageId));
		}

		await db.delete(schema.prompts).where(eq(schema.prompts.topicId, topic.id));
		if (detail.prompts.length > 0) {
			await db.insert(schema.prompts).values(
				detail.prompts.map((p, i) => ({
					topicId: topic.id,
					text: p.text,
					orderIndex: i,
				})),
			);
		}

		return true;
	} catch (err) {
		logger.error({ notionPageId, err }, "syncPage failed to sync Notion page");
		return false;
	}
}

// ─── Latest sync status ───────────────────────────────────────────────────────
export async function getLastSync() {
	const [last] = await db.select().from(schema.syncLog).orderBy(desc(schema.syncLog.id)).limit(1);
	return last ?? null;
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}
