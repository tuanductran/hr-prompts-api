import { count, eq } from "drizzle-orm";
import Elysia from "elysia";
import { cacheAdapter } from "@/cache-adapter";
import { db, schema } from "@/db";
import { ErrorSchema, PaginationQuery, TopicDetailSchema, TopicsResponseSchema } from "@/models";

export const topicsRoute = new Elysia()
	.get(
		"/topics",
		async ({ query }) => {
			const { category_id, page = 1, limit = 20 } = query;

			const CACHE_KEY = `topics:list:${category_id ?? "all"}:${page}:${limit}`;
			const cached = await cacheAdapter.get<{
				topics: {
					id: string;
					name: string;
					categoryId: string;
					categoryName: string;
					promptCount: number;
				}[];
				total: number;
				page: number;
				limit: number;
			}>(CACHE_KEY);
			if (cached) return cached;

			const where = category_id ? eq(schema.topics.categoryId, category_id) : undefined;

			const rows = await db
				.select({
					id: schema.topics.id,
					name: schema.topics.name,
					categoryId: schema.topics.categoryId,
					categoryName: schema.categories.name,
					promptCount: count(schema.prompts.id),
				})
				.from(schema.topics)
				.innerJoin(schema.categories, eq(schema.categories.id, schema.topics.categoryId))
				.leftJoin(schema.prompts, eq(schema.prompts.topicId, schema.topics.id))
				.where(where)
				.groupBy(schema.topics.id)
				.orderBy(schema.topics.name)
				.limit(limit)
				.offset((page - 1) * limit);

			const countResult = await db.select({ total: count() }).from(schema.topics).where(where);
			const total = countResult[0]?.total ?? 0;

			const result = {
				topics: rows.map((r) => ({
					id: r.id,
					name: r.name,
					categoryId: r.categoryId,
					categoryName: r.categoryName,
					promptCount: r.promptCount,
				})),
				total,
				page,
				limit,
			};

			await cacheAdapter.set(CACHE_KEY, result);
			return result;
		},
		{
			detail: {
				operationId: "listTopics",
				summary: "List topics",
				description:
					"Returns paginated HR topics. Filter by category_id to narrow results. Use the returned topic IDs with GET /topics/:id to fetch the full prompt list.",
				tags: ["Topics"],
			},
			query: PaginationQuery,
			response: { 200: TopicsResponseSchema, 422: ErrorSchema },
		},
	)
	.get(
		"/topics/:topic_id",
		async ({ params, status }) => {
			const CACHE_KEY = `topic:${params.topic_id}`;
			const cached = await cacheAdapter.get<{
				id: string;
				name: string;
				categoryId: string;
				categoryName: string;
				description: string;
				promptCount: number;
				prompts: { number: number; text: string }[];
			}>(CACHE_KEY);
			if (cached) return cached;

			const topic = await db
				.select({
					id: schema.topics.id,
					name: schema.topics.name,
					description: schema.topics.description,
					categoryId: schema.topics.categoryId,
					categoryName: schema.categories.name,
				})
				.from(schema.topics)
				.innerJoin(schema.categories, eq(schema.categories.id, schema.topics.categoryId))
				.where(eq(schema.topics.id, params.topic_id))
				.limit(1)
				.then((r) => r[0]);

			if (!topic) {
				return status(404, {
					error: "Topic not found",
					message: `No topic found with id: ${params.topic_id}`,
				});
			}

			const promptRows = await db
				.select({ text: schema.prompts.text, orderIndex: schema.prompts.orderIndex })
				.from(schema.prompts)
				.where(eq(schema.prompts.topicId, params.topic_id))
				.orderBy(schema.prompts.orderIndex);

			const topicResult = {
				id: topic.id,
				name: topic.name,
				categoryId: topic.categoryId,
				categoryName: topic.categoryName,
				description: topic.description ?? "",
				promptCount: promptRows.length,
				prompts: promptRows.map((p, i) => ({ number: i + 1, text: p.text })),
			};

			await cacheAdapter.set(CACHE_KEY, topicResult);
			return topicResult;
		},
		{
			detail: {
				operationId: "getTopicById",
				summary: "Get topic with prompts",
				description:
					"Returns a topic and its complete list of HR prompts. This is the primary endpoint for retrieving actual prompt text for a given topic.",
				tags: ["Topics"],
			},
			response: { 200: TopicDetailSchema, 404: ErrorSchema },
		},
	);
