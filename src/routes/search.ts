import { and, eq, like } from "drizzle-orm";
import Elysia from "elysia";
import { db, schema } from "@/db";
import { ErrorSchema, SearchQuery, SearchResponseSchema } from "@/models";

export const searchRoute = new Elysia().get(
	"/search",
	async ({ query, status }) => {
		const { q, category_id, limit = 10 } = query;
		if (!q || q.trim().length < 2) {
			return status(400, {
				error: "Query too short",
				message: "Parameter 'q' must be at least 2 characters.",
			});
		}

		const term = `%${q.trim().toLowerCase()}%`;

		const rows = await db
			.select({
				topicId: schema.topics.id,
				topicName: schema.topics.name,
				categoryId: schema.topics.categoryId,
				categoryName: schema.categories.name,
				promptText: schema.prompts.text,
				promptOrder: schema.prompts.orderIndex,
			})
			.from(schema.prompts)
			.innerJoin(schema.topics, eq(schema.topics.id, schema.prompts.topicId))
			.innerJoin(schema.categories, eq(schema.categories.id, schema.topics.categoryId))
			.where(
				and(
					like(schema.prompts.text, term),
					category_id ? eq(schema.topics.categoryId, category_id) : undefined,
				),
			)
			.orderBy(schema.prompts.orderIndex)
			.limit(limit * 10); // over-fetch to group

		// Group prompts by topic
		const grouped = new Map<
			string,
			{
				topicId: string;
				topicName: string;
				categoryId: string;
				categoryName: string;
				matchedPrompts: { number: number; text: string }[];
			}
		>();

		for (const row of rows) {
			if (!grouped.has(row.topicId)) {
				grouped.set(row.topicId, {
					topicId: row.topicId,
					topicName: row.topicName,
					categoryId: row.categoryId,
					categoryName: row.categoryName,
					matchedPrompts: [],
				});
			}
			const entry = grouped.get(row.topicId);
			if (entry) {
				entry.matchedPrompts.push({
					number: entry.matchedPrompts.length + 1,
					text: row.promptText,
				});
			}
			if (grouped.size >= limit) break;
		}

		const results = Array.from(grouped.values()).slice(0, limit);
		return { query: q.trim(), totalResults: results.length, results };
	},
	{
		detail: {
			operationId: "searchPrompts",
			summary: "Search HR prompts",
			description:
				"Full-text search across all HR prompts. Use this when the user asks about a specific HR topic or keyword. Returns matched prompts grouped by topic.",
			tags: ["Search"],
		},
		query: SearchQuery,
		response: { 200: SearchResponseSchema, 400: ErrorSchema, 422: ErrorSchema },
	},
);
