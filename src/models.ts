import { t } from "elysia";

// ─── primitives ─────────────────────────────────────────────────────────────

export const PromptSchema = t.Object({
	number: t.Number({ description: "Prompt sequence number" }),
	text: t.String({ description: "Full prompt text" }),
});

export const ErrorSchema = t.Object({
	error: t.String(),
	message: t.String(),
});

// ─── category ───────────────────────────────────────────────────────────────

export const CategorySchema = t.Object({
	id: t.String({ description: "Slugified category ID" }),
	name: t.String({ description: "Display name" }),
	description: t.String(),
	topicCount: t.Number(),
});

export const CategoriesResponseSchema = t.Object({
	categories: t.Array(CategorySchema),
});

// ─── topic ───────────────────────────────────────────────────────────────────

export const TopicSchema = t.Object({
	id: t.String({ description: "Slugified topic ID" }),
	name: t.String(),
	categoryId: t.String(),
	categoryName: t.String(),
	promptCount: t.Number(),
});

export const TopicDetailSchema = t.Object({
	id: t.String(),
	name: t.String(),
	categoryId: t.String(),
	categoryName: t.String(),
	description: t.String(),
	promptCount: t.Number(),
	prompts: t.Array(PromptSchema),
});

export const TopicsResponseSchema = t.Object({
	topics: t.Array(TopicSchema),
	total: t.Number(),
	page: t.Number(),
	limit: t.Number(),
});

// ─── search / random ─────────────────────────────────────────────────────────

export const SearchResultSchema = t.Object({
	topicId: t.String(),
	topicName: t.String(),
	categoryId: t.String(),
	categoryName: t.String(),
	matchedPrompts: t.Array(PromptSchema),
});

export const SearchResponseSchema = t.Object({
	query: t.String(),
	totalResults: t.Number(),
	results: t.Array(SearchResultSchema),
});

export const RandomPromptsResponseSchema = t.Object({
	prompts: t.Array(SearchResultSchema),
});

// ─── query params ────────────────────────────────────────────────────────────

export const PaginationQuery = t.Object({
	category_id: t.Optional(t.String({ description: "Filter by category slug" })),
	page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
	limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
});

export const SearchQuery = t.Object({
	q: t.String({ minLength: 2, description: "Search keyword (min 2 chars)" }),
	category_id: t.Optional(t.String()),
	limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50, default: 10 })),
});

export const RandomQuery = t.Object({
	category_id: t.Optional(t.String()),
	count: t.Optional(t.Numeric({ minimum: 1, maximum: 20, default: 5 })),
});
