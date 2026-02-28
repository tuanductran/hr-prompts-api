import { desc, eq } from "drizzle-orm";
import { CATEGORIES, getTopicDetailFromNotion, getTopicsFromNotion } from "../notion";
import { db, schema } from "./index";

// ─── Full sync: pull all Notion data → Turso DB ───────────────────────────────
export async function fullSync(): Promise<{ categories: number; topics: number; prompts: number }> {
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
		for (const cat of CATEGORIES) {
			const catId = slugify(cat.name);
			const notionId = cat.type === "database" ? cat.dataSourceId : cat.pageId;

			// Upsert category
			await db
				.insert(schema.categories)
				.values({ id: catId, name: cat.name, type: cat.type, notionId, syncedAt: new Date() })
				.onConflictDoUpdate({
					target: schema.categories.id,
					set: { name: cat.name, notionId, syncedAt: new Date() },
				});
			catCount++;

			// Pull topics from Notion for this category
			const notionTopics = await getTopicsFromNotion(cat);

			for (const nt of notionTopics) {
				// Upsert topic (without prompts yet)
				await db
					.insert(schema.topics)
					.values({
						id: nt.id,
						categoryId: catId,
						name: nt.name,
						description: null,
						notionId: nt.notionPageId,
						syncedAt: new Date(),
					})
					.onConflictDoUpdate({
						target: schema.topics.id,
						set: { name: nt.name, notionId: nt.notionPageId, syncedAt: new Date() },
					});
				topicCount++;

				// Pull prompts for this topic
				const detail = await getTopicDetailFromNotion(nt.notionPageId, nt.type);

				// Update description
				if (detail.description) {
					await db
						.update(schema.topics)
						.set({ description: detail.description })
						.where(eq(schema.topics.id, nt.id));
				}

				// Delete old prompts & re-insert (simple upsert strategy)
				await db.delete(schema.prompts).where(eq(schema.prompts.topicId, nt.id));
				if (detail.prompts.length > 0) {
					await db.insert(schema.prompts).values(
						detail.prompts.map((p, i) => ({
							topicId: nt.id,
							text: p.text,
							orderIndex: i,
						})),
					);
					promptCount += detail.prompts.length;
				}
			}
		}

		await db
			.update(schema.syncLog)
			.set({
				status: "completed",
				completedAt: new Date(),
				details: JSON.stringify({ categories: catCount, topics: topicCount, prompts: promptCount }),
			})
			.where(eq(schema.syncLog.id, logId));
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
	// Find the topic in DB by notion_id
	const [topic] = await db
		.select()
		.from(schema.topics)
		.where(eq(schema.topics.notionId, notionPageId))
		.limit(1);

	if (!topic) return false;

	// Find category type to know how to parse
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
