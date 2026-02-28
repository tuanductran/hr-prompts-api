import { count, eq } from "drizzle-orm";
import Elysia from "elysia";
import { db, schema } from "../db";
import { CategoriesResponseSchema } from "../models";

export const categoriesRoute = new Elysia().get(
	"/categories",
	async () => {
		const rows = await db
			.select({
				id: schema.categories.id,
				name: schema.categories.name,
				type: schema.categories.type,
				topicCount: count(schema.topics.id),
			})
			.from(schema.categories)
			.leftJoin(schema.topics, eq(schema.topics.categoryId, schema.categories.id))
			.groupBy(schema.categories.id)
			.orderBy(schema.categories.name);

		const categories = rows.map((r) => ({
			id: r.id,
			name: r.name,
			description:
				r.type === "database"
					? "Topics with individual prompt collections"
					: "Comprehensive prompt collection",
			topicCount: r.topicCount,
		}));

		return { categories };
	},
	{
		detail: {
			summary: "List all HR categories",
			description: "Returns all top-level HR topic categories from the Notion knowledge base.",
			tags: ["Categories"],
		},
		response: { 200: CategoriesResponseSchema },
	},
);
