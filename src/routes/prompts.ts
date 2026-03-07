import { eq, sql } from "drizzle-orm";
import Elysia from "elysia";
import { db, schema } from "@/db";
import { ErrorSchema, RandomPromptsResponseSchema, RandomQuery } from "@/models";

export const promptsRoute = new Elysia().get(
	"/prompts/random",
	async ({ query }) => {
		const { category_id, count = 5 } = query;

		// Pick `count` random prompts (with topic + category info) via SQLite's RANDOM()
		const rows = await db
			.select({
				topicId: schema.topics.id,
				topicName: schema.topics.name,
				categoryId: schema.topics.categoryId,
				categoryName: schema.categories.name,
				promptText: schema.prompts.text,
			})
			.from(schema.prompts)
			.innerJoin(schema.topics, eq(schema.topics.id, schema.prompts.topicId))
			.innerJoin(schema.categories, eq(schema.categories.id, schema.topics.categoryId))
			.where(category_id ? eq(schema.topics.categoryId, category_id) : undefined)
			.orderBy(sql`RANDOM()`)
			.limit(count);

		const prompts = rows.map((r) => ({
			topicId: r.topicId,
			topicName: r.topicName,
			categoryId: r.categoryId,
			categoryName: r.categoryName,
			matchedPrompts: [{ number: 1, text: r.promptText }],
		}));

		return { prompts };
	},
	{
		detail: {
			operationId: "getRandomPrompts",
			summary: "Get random HR prompts",
			description:
				"Returns random HR prompts for inspiration. Use this when the user wants ideas or suggestions without a specific topic in mind. Optionally filter by category_id.",
			tags: ["Prompts"],
		},
		query: RandomQuery,
		response: { 200: RandomPromptsResponseSchema, 422: ErrorSchema },
	},
);
