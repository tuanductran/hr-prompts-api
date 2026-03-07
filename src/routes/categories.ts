import { count, eq } from "drizzle-orm";
import Elysia from "elysia";
import { cacheAdapter } from "@/cache-adapter";
import { db, schema } from "@/db";
import { CategoriesResponseSchema, CategoryDetailSchema, ErrorSchema } from "@/models";

export const categoriesRoute = new Elysia()
	.get(
		"/categories",
		async () => {
			const CACHE_KEY = "categories:all";
			const cached = await cacheAdapter.get<{
				categories: { id: string; name: string; description: string; topicCount: number }[];
			}>(CACHE_KEY);
			if (cached) return cached;

			const rows = await db
				.select({
					id: schema.categories.id,
					name: schema.categories.name,
					type: schema.categories.type,
					description: schema.categories.description,
					topicCount: count(schema.topics.id),
				})
				.from(schema.categories)
				.leftJoin(schema.topics, eq(schema.topics.categoryId, schema.categories.id))
				.groupBy(schema.categories.id)
				.orderBy(schema.categories.name);

			const result = {
				categories: rows.map((r) => ({
					id: r.id,
					name: r.name,
					description:
						r.description ??
						(r.type === "database"
							? "Topics with individual prompt collections"
							: "Comprehensive prompt collection"),
					topicCount: r.topicCount,
				})),
			};

			await cacheAdapter.set(CACHE_KEY, result);
			return result;
		},
		{
			detail: {
				operationId: "listCategories",
				summary: "List all HR categories",
				description:
					"Returns all top-level HR topic categories from the Notion knowledge base. Use this first to discover available categories before fetching topics.",
				tags: ["Categories"],
			},
			response: { 200: CategoriesResponseSchema },
		},
	)
	.get(
		"/categories/:id",
		async ({ params, status }) => {
			const CACHE_KEY = `category:${params.id}`;
			const cached = await cacheAdapter.get<{
				id: string;
				name: string;
				description: string;
				topics: {
					id: string;
					name: string;
					categoryId: string;
					categoryName: string;
					promptCount: number;
				}[];
			}>(CACHE_KEY);
			if (cached) return cached;

			const category = await db
				.select({
					id: schema.categories.id,
					name: schema.categories.name,
					type: schema.categories.type,
					description: schema.categories.description,
				})
				.from(schema.categories)
				.where(eq(schema.categories.id, params.id))
				.limit(1)
				.then((r) => r[0]);

			if (!category) {
				return status(404, {
					error: "Category not found",
					message: `No category found with id: ${params.id}`,
				});
			}

			const topicRows = await db
				.select({
					id: schema.topics.id,
					name: schema.topics.name,
					categoryId: schema.topics.categoryId,
					promptCount: count(schema.prompts.id),
				})
				.from(schema.topics)
				.leftJoin(schema.prompts, eq(schema.prompts.topicId, schema.topics.id))
				.where(eq(schema.topics.categoryId, params.id))
				.groupBy(schema.topics.id)
				.orderBy(schema.topics.name);

			const result = {
				id: category.id,
				name: category.name,
				description:
					category.description ??
					(category.type === "database"
						? "Topics with individual prompt collections"
						: "Comprehensive prompt collection"),
				topics: topicRows.map((t) => ({
					id: t.id,
					name: t.name,
					categoryId: t.categoryId,
					categoryName: category.name,
					promptCount: t.promptCount,
				})),
			};

			await cacheAdapter.set(CACHE_KEY, result);
			return result;
		},
		{
			detail: {
				operationId: "getCategoryById",
				summary: "Get category with its topics",
				description:
					"Returns a single HR category and all its topics. Use the topic IDs to fetch full prompt lists via GET /topics/:id.",
				tags: ["Categories"],
			},
			response: { 200: CategoryDetailSchema, 404: ErrorSchema },
		},
	);
