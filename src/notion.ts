import {
	APIErrorCode,
	Client,
	ClientErrorCode,
	collectPaginatedAPI,
	isFullBlock,
	isFullPage,
	isNotionClientError,
	iteratePaginatedAPI,
} from "@notionhq/client";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cache } from "./cache";
import type { Category, Prompt, SearchResult, Topic, TopicDetail } from "./types";

export { APIErrorCode, ClientErrorCode, isNotionClientError };
export type { CategoryConfig, DatabaseCategory, PageCategory };

export const notion = new Client({
	auth: process.env.NOTION_TOKEN,
	notionVersion: "2025-09-03",
	retry: { maxRetries: 3 },
});

// ─── Static category config (discovered from actual Notion structure) ────────
//
// Type A — "Database" categories: topics are rows in a Notion database.
//   Each topic page has: heading_2 "About" → paragraph → heading_2 "Prompts"
//   → numbered_list_items (prompts) → heading_2 "Tips" → numbered_list_items
//
// Type B — "Page" categories: prompts live directly in the page as
//   numbered_list_items (first paragraph = description).

interface DatabaseCategory {
	type: "database";
	name: string;
	dataSourceId: string;
}

interface PageCategory {
	type: "page";
	name: string;
	pageId: string;
}

type CategoryConfig = DatabaseCategory | PageCategory;

export const CATEGORIES: CategoryConfig[] = [
	// ── Type A: Database categories ──────────────────────────────────────────
	{ type: "database", name: "Recruiting", dataSourceId: "4747601b-12ae-4816-8d50-9af10ecbf7c8" },
	{
		type: "database",
		name: "Compensation & Benefits",
		dataSourceId: "09a7a31c-3b87-4b25-8212-2bb94595f6b2",
	},
	{ type: "database", name: "Compliance", dataSourceId: "0885db86-ee51-4089-a84f-5d734959a22c" },
	{
		type: "database",
		name: "Training & Development",
		dataSourceId: "6596ba3b-5962-4466-800e-f1d5e442540b",
	},
	{
		type: "database",
		name: "Data & Analytics",
		dataSourceId: "39ead630-f75e-4611-86ed-de143962242c",
	},
	{
		type: "database",
		name: "Performance Management",
		dataSourceId: "49b99586-8800-4cda-9007-e4fe956b44a9",
	},
	{ type: "database", name: "HR Technology", dataSourceId: "0d185ac9-3bca-4a88-a8ca-7786dde40600" },
	{
		type: "database",
		name: "Employee Relations",
		dataSourceId: "b7401bf2-bbae-4aa4-b5d6-144524de71e2",
	},
	{
		type: "database",
		name: "Workforce Planning",
		dataSourceId: "1221b651-fcef-409c-bfbe-d1354b8f6fc1",
	},
	{
		type: "database",
		name: "Leadership Development",
		dataSourceId: "d96e2701-ec3a-497a-9e51-9e4905dfb40b",
	},
	// ── Type B: Page categories (prompts stored directly in the page) ─────────
	{ type: "page", name: "Employee Onboarding", pageId: "533210e82b964a4f9edceb40536078d1" },
	{
		type: "page",
		name: "Performance Management (Overview)",
		pageId: "1ff63b3e7af3411295f897e3b582ba3e",
	},
	{ type: "page", name: "Conflict Resolution", pageId: "8e51c81687f540a5b38d6973767142ce" },
	{ type: "page", name: "Diversity and Inclusion", pageId: "74129123b32d44bdbde4617f966168db" },
	{ type: "page", name: "Employee Engagement", pageId: "55da36030ccb46b385a38e5e5bee19e5" },
	{ type: "page", name: "Talent Acquisition", pageId: "e96240eaec2147acb50b3933e13820c0" },
	{
		type: "page",
		name: "Employee Benefits and Compensation",
		pageId: "d32245a4dbaa4783b605901c69ac74d3",
	},
	{
		type: "page",
		name: "Workplace Policies and Compliance",
		pageId: "cc13a3b34de04fd99c94eb5bab6567b3",
	},
	{ type: "page", name: "Training and Development", pageId: "013f765535904ac0b4b8c92d479807e2" },
	{ type: "page", name: "Employee Offboarding", pageId: "113e7d5d60e04182bd528f059c0802a7" },
];

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

function extractPlainText(richText: { plain_text: string }[]): string {
	return richText.map((t) => t.plain_text).join("");
}

// Paginate through all children of a block using SDK utility
async function getAllChildren(blockId: string): Promise<BlockObjectResponse[]> {
	const all = await collectPaginatedAPI(notion.blocks.children.list, {
		block_id: blockId,
		page_size: 100,
	});
	return all.filter(isFullBlock);
}

// ─── Extract prompts from a DB-style topic page ──────────────────────────────
// Structure: heading_2 "About" → paragraph → heading_2 "Prompts"
//            → numbered_list_items → heading_2 "Tips" → numbered_list_items
async function extractTopicPagePrompts(
	pageId: string,
): Promise<{ description: string; prompts: Prompt[]; tips: Prompt[] }> {
	const blocks = await getAllChildren(pageId);
	let description = "";
	const prompts: Prompt[] = [];
	const tips: Prompt[] = [];
	let section: "none" | "about" | "prompts" | "tips" = "none";
	let promptNum = 0;
	let tipNum = 0;

	for (const block of blocks) {
		if (block.type === "heading_2") {
			const text = extractPlainText(block.heading_2.rich_text).toLowerCase().trim();
			if (text === "about") section = "about";
			else if (text === "prompts") section = "prompts";
			else if (text === "tips") section = "tips";
			continue;
		}
		if (block.type === "paragraph" && section === "about") {
			const text = extractPlainText(block.paragraph.rich_text).trim();
			if (text && !description) description = text;
			continue;
		}
		if (block.type === "numbered_list_item") {
			const text = extractPlainText(block.numbered_list_item.rich_text).trim();
			if (!text) continue;
			if (section === "prompts") {
				prompts.push({ number: ++promptNum, text });
			} else if (section === "tips") {
				tips.push({ number: ++tipNum, text });
			}
		}
	}

	return { description, prompts, tips };
}

// ─── Extract prompts from a Page-style category page ─────────────────────────
// Structure: paragraph (description) → numbered_list_items (all prompts)
async function extractPageCategoryPrompts(
	pageId: string,
): Promise<{ description: string; prompts: Prompt[] }> {
	const blocks = await getAllChildren(pageId);
	let description = "";
	const prompts: Prompt[] = [];
	let num = 0;

	for (const block of blocks) {
		if (block.type === "paragraph" && !description) {
			const text = extractPlainText(block.paragraph.rich_text).trim();
			if (text) description = text;
			continue;
		}
		if (block.type === "numbered_list_item") {
			const text = extractPlainText(block.numbered_list_item.rich_text).trim();
			if (text) prompts.push({ number: ++num, text });
		}
	}

	return { description, prompts };
}

// ─── Query all topic rows from a Notion data source ──────────────────────────
// Uses notion.dataSources.query() (SDK v5) with filter_properties for performance.
async function queryDataSource(dataSourceId: string): Promise<{ id: string; name: string }[]> {
	const rows: { id: string; name: string }[] = [];

	// iteratePaginatedAPI handles cursor pagination automatically
	for await (const row of iteratePaginatedAPI(notion.dataSources.query, {
		data_source_id: dataSourceId,
		filter_properties: ["title"],
		page_size: 100,
	})) {
		if (!isFullPage(row)) continue;
		// Find the title-type property regardless of its display name ("Name", "Title", etc.)
		const titleProp = Object.values(row.properties).find((p) => p.type === "title");
		const name = titleProp?.type === "title" ? extractPlainText(titleProp.title) : "";
		if (name) rows.push({ id: row.id.replace(/-/g, ""), name });
	}

	return rows;
}

// ─── Public service methods ───────────────────────────────────────────────────

// Expose getAllChildren for sync service
export { getAllChildren as getAllChildrenPublic };

// Raw Notion → typed rows for the sync service
export async function getTopicsFromNotion(cat: CategoryConfig): Promise<
	Array<{
		id: string;
		name: string;
		notionPageId: string;
		type: "database" | "page";
	}>
> {
	const catId = slugify(cat.name);
	if (cat.type === "database") {
		const rows = await queryDataSource(cat.dataSourceId);
		return rows.map((r) => ({
			id: `${catId}--${slugify(r.name)}--${r.id.slice(0, 8)}`,
			name: r.name,
			notionPageId: r.id,
			type: "database" as const,
		}));
	}
	return [
		{ id: `${catId}--overview`, name: cat.name, notionPageId: cat.pageId, type: "page" as const },
	];
}

// Raw Notion → prompts for the sync service
export async function getTopicDetailFromNotion(
	notionPageId: string,
	type: "database" | "page",
): Promise<{ description: string; prompts: { text: string }[] }> {
	if (type === "database") {
		const { description, prompts } = await extractTopicPagePrompts(notionPageId);
		return { description, prompts };
	}
	const { description, prompts } = await extractPageCategoryPrompts(notionPageId);
	return { description, prompts };
}

export async function getCategories(): Promise<Category[]> {
	const CACHE_KEY = "categories";
	const cached = cache.get<Category[]>(CACHE_KEY);
	if (cached) return cached;

	const categories: Category[] = CATEGORIES.map((c) => ({
		id: slugify(c.name),
		name: c.name,
		description:
			c.type === "database"
				? "Topics with individual prompt collections"
				: "Comprehensive prompt collection",
		topicCount: c.type === "page" ? 1 : 0, // DB counts fetched lazily
	}));

	cache.set(CACHE_KEY, categories);
	return categories;
}

export async function getTopics(categoryId?: string): Promise<Topic[]> {
	const CACHE_KEY = `topics:${categoryId ?? "all"}`;
	const cached = cache.get<Topic[]>(CACHE_KEY);
	if (cached) return cached;

	const topics: Topic[] = [];
	const targets = categoryId
		? CATEGORIES.filter((c) => slugify(c.name) === categoryId)
		: CATEGORIES;

	for (const cat of targets) {
		const catId = slugify(cat.name);

		if (cat.type === "database") {
			const rows = await queryDataSource(cat.dataSourceId);
			for (const row of rows) {
				topics.push({
					id: `${catId}--${slugify(row.name)}--${row.id.slice(0, 8)}`,
					name: row.name,
					categoryId: catId,
					categoryName: cat.name,
					promptCount: 0, // filled in getTopicDetail
				});
			}
		} else {
			// Page category — the page itself is the single "topic"
			topics.push({
				id: `${catId}--overview`,
				name: cat.name,
				categoryId: catId,
				categoryName: cat.name,
				promptCount: 0,
			});
		}
	}

	cache.set(CACHE_KEY, topics);
	return topics;
}

export async function getTopicDetail(topicId: string): Promise<TopicDetail | null> {
	const CACHE_KEY = `topic:${topicId}`;
	const cached = cache.get<TopicDetail>(CACHE_KEY);
	if (cached) return cached;

	// Find which category this topic belongs to
	for (const cat of CATEGORIES) {
		const catId = slugify(cat.name);

		if (cat.type === "page" && topicId === `${catId}--overview`) {
			const { description, prompts } = await extractPageCategoryPrompts(cat.pageId);
			const detail: TopicDetail = {
				id: topicId,
				name: cat.name,
				categoryId: catId,
				categoryName: cat.name,
				description,
				promptCount: prompts.length,
				prompts,
			};
			cache.set(CACHE_KEY, detail);
			return detail;
		}

		if (cat.type === "database" && topicId.startsWith(`${catId}--`)) {
			// Extract the Notion page ID suffix we stored (last 8 chars of UUID)
			const parts = topicId.split("--");
			const pageIdSuffix = parts[parts.length - 1];
			if (!pageIdSuffix) continue;

			// Lookup the full page ID from the data source
			const rows = await queryDataSource(cat.dataSourceId);
			const row = rows.find(
				(r) => r.id.startsWith(pageIdSuffix) || r.id.slice(0, 8) === pageIdSuffix,
			);
			if (!row) continue;

			const { description, prompts } = await extractTopicPagePrompts(row.id);
			const detail: TopicDetail = {
				id: topicId,
				name: row.name,
				categoryId: catId,
				categoryName: cat.name,
				description,
				promptCount: prompts.length,
				prompts,
			};
			cache.set(CACHE_KEY, detail);
			return detail;
		}
	}

	return null;
}

// Fetch topic details concurrently with a concurrency cap to avoid rate limits
async function fetchDetailsConcurrently(
	topicIds: string[],
	concurrency = 5,
): Promise<(TopicDetail | null)[]> {
	const results: (TopicDetail | null)[] = new Array(topicIds.length).fill(null);
	for (let i = 0; i < topicIds.length; i += concurrency) {
		const batch = topicIds.slice(i, i + concurrency);
		const settled = await Promise.allSettled(batch.map((id) => getTopicDetail(id)));
		for (let j = 0; j < settled.length; j++) {
			const s = settled[j];
			if (!s) continue;
			results[i + j] = s.status === "fulfilled" ? s.value : null;
		}
	}
	return results;
}

export async function searchPrompts(
	query: string,
	categoryId?: string,
	limit = 10,
): Promise<SearchResult[]> {
	const topics = await getTopics(categoryId);
	const q = query.toLowerCase();
	const results: SearchResult[] = [];

	// Fetch in batches; stop fetching once we have enough results
	const BATCH = 5;
	for (let i = 0; i < topics.length && results.length < limit; i += BATCH) {
		const batch = topics.slice(i, i + BATCH);
		const details = await fetchDetailsConcurrently(
			batch.map((t) => t.id),
			BATCH,
		);
		for (let j = 0; j < batch.length; j++) {
			const topic = batch[j];
			if (!topic) continue;
			const detail = details[j];
			if (!detail) continue;
			const matched = detail.prompts.filter((p) => p.text.toLowerCase().includes(q));
			if (matched.length > 0) {
				results.push({
					topicId: topic.id,
					topicName: topic.name,
					categoryId: topic.categoryId,
					categoryName: topic.categoryName,
					matchedPrompts: matched,
				});
				if (results.length >= limit) break;
			}
		}
	}

	return results;
}

export async function getRandomPrompts(count = 5, categoryId?: string): Promise<SearchResult[]> {
	const topics = await getTopics(categoryId);
	// Pick more candidates than needed to account for empty topics
	const candidates = [...topics].sort(() => Math.random() - 0.5).slice(0, count * 3);
	const details = await fetchDetailsConcurrently(
		candidates.map((t) => t.id),
		5,
	);

	const results: SearchResult[] = [];
	for (let i = 0; i < candidates.length && results.length < count; i++) {
		const topic = candidates[i];
		if (!topic) continue;
		const detail = details[i];
		if (!detail || detail.prompts.length === 0) continue;
		const idx = Math.floor(Math.random() * detail.prompts.length);
		const prompt = detail.prompts[idx];
		if (!prompt) continue;
		results.push({
			topicId: topic.id,
			topicName: topic.name,
			categoryId: topic.categoryId,
			categoryName: topic.categoryName,
			matchedPrompts: [prompt],
		});
	}

	return results;
}
