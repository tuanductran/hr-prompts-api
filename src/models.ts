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

// ─── category detail ─────────────────────────────────────────────────────────

export const CategoryDetailSchema = t.Object({
	id: t.String({ description: "Slugified category ID" }),
	name: t.String({ description: "Display name" }),
	description: t.String(),
	topics: t.Array(TopicSchema),
});

// ─── summary ─────────────────────────────────────────────────────────────────

export const SummaryResponseSchema = t.Object({
	categories: t.Number({ description: "Total number of categories" }),
	topics: t.Number({ description: "Total number of topics" }),
	prompts: t.Number({ description: "Total number of prompts" }),
});

// ─── health ──────────────────────────────────────────────────────────────────

export const HealthResponseSchema = t.Object({
	status: t.Literal("ok"),
	timestamp: t.String({ description: "ISO 8601 server timestamp" }),
});

// ─── sync ─────────────────────────────────────────────────────────────────────

// The sync details field contains counts on success, or an error string on failure.
// Using a union instead of t.Unknown() gives the OpenAPI spec a concrete shape and
// prevents the TypeBox schema from silently accepting any value.
const SyncDetailsSchema = t.Nullable(
	t.Union([
		t.Object({
			categories: t.Number({ description: "Categories synced" }),
			topics: t.Number({ description: "Topics synced" }),
			prompts: t.Number({ description: "Prompts synced" }),
		}),
		t.String({ description: "Error message on failure" }),
	]),
);

export const SyncLastSchema = t.Object({
	status: t.Union([t.Literal("started"), t.Literal("completed"), t.Literal("failed")]),
	startedAt: t.Nullable(t.String({ description: "ISO 8601 timestamp" })),
	completedAt: t.Nullable(t.String({ description: "ISO 8601 timestamp" })),
	details: SyncDetailsSchema,
});

export const SyncStatusResponseSchema = t.Object({
	lastSync: t.Nullable(SyncLastSchema),
});

export const SyncResultResponseSchema = t.Object({
	success: t.Boolean(),
	categories: t.Number({ description: "Number of categories synced" }),
	topics: t.Number({ description: "Number of topics synced" }),
	prompts: t.Number({ description: "Number of prompts synced" }),
});

// ─── webhook ──────────────────────────────────────────────────────────────────

export const WebhookReceivedSchema = t.Object({
	received: t.Boolean(),
});

export const VerificationTokenSchema = t.Object({
	token: t.String({ description: "Notion verification token" }),
	receivedAt: t.String({ description: "ISO 8601 timestamp when the token was received" }),
});
