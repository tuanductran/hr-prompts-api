import { count } from "drizzle-orm";
import Elysia from "elysia";
import { cacheAdapter } from "@/cache-adapter";
import { db, schema } from "@/db";
import { SummaryResponseSchema } from "@/models";

export const summaryRoute = new Elysia().get(
	"/summary",
	async () => {
		const CACHE_KEY = "summary";
		const cached = await cacheAdapter.get<{ categories: number; topics: number; prompts: number }>(
			CACHE_KEY,
		);
		if (cached) return cached;

		// Use db.batch() to send all three COUNT queries in a single HTTP round-trip to Turso
		const [categoriesResult, topicsResult, promptsResult] = await db.batch([
			db.select({ count: count(schema.categories.id) }).from(schema.categories),
			db.select({ count: count(schema.topics.id) }).from(schema.topics),
			db.select({ count: count(schema.prompts.id) }).from(schema.prompts),
		]);

		const summaryResult = {
			categories: categoriesResult[0]?.count ?? 0,
			topics: topicsResult[0]?.count ?? 0,
			prompts: promptsResult[0]?.count ?? 0,
		};

		await cacheAdapter.set(CACHE_KEY, summaryResult);
		return summaryResult;
	},
	{
		detail: {
			operationId: "getSummary",
			summary: "Get database summary",
			description:
				"Returns the total count of categories, topics, and prompts in the database. Use this to give the user an overview of what the knowledge base contains.",
			tags: ["Summary"],
		},
		response: { 200: SummaryResponseSchema },
	},
);
