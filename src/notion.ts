import {
	APIErrorCode,
	Client,
	ClientErrorCode,
	collectPaginatedAPI,
	isFullBlock,
	isFullDatabase,
	isFullPage,
	isNotionClientError,
	iteratePaginatedAPI,
} from "@notionhq/client";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import pLimit from "p-limit";
import { cacheAdapter } from "@/cache-adapter";
import { env } from "@/env";
import type { Category, CategoryConfig, Prompt, SearchResult, Topic, TopicDetail } from "@/types";

export { APIErrorCode, ClientErrorCode, isNotionClientError };

// ─── Constants ────────────────────────────────────────────────────────────────
const NOTION_CONCURRENCY = 5;
const NOTION_PAGE_SIZE = 100;
const NOTION_MAX_RETRIES = 3;
const NOTION_API_VERSION = "2025-09-03";

export const notion = new Client({
	auth: env.NOTION_TOKEN,
	notionVersion: NOTION_API_VERSION,
	retry: { maxRetries: NOTION_MAX_RETRIES },
});

function getNotionPageId(): string {
	const id = env.NOTION_PAGE_ID;
	if (!id) {
		throw new Error("NOTION_PAGE_ID is not set in environment variables.");
	}
	return id;
}

// ─── Dynamic categories cache ─────────────────────────────────────────────────
let dynamicCategoriesCache: CategoryConfig[] | null = null;

/** Clear the in-memory category config cache. Call before a full sync so that
 *  any structural Notion changes (new/removed categories) are picked up. */
export function clearDynamicCategoriesCache(): void {
	dynamicCategoriesCache = null;
}

export async function getDynamicCategories(): Promise<CategoryConfig[]> {
	if (dynamicCategoriesCache) {
		return dynamicCategoriesCache;
	}

	const categories: CategoryConfig[] = [];
	await collectDatabaseCategories(getNotionPageId(), categories, 0);

	dynamicCategoriesCache = categories;
	return categories;
}

/**
 * Recursively traverses the Notion block tree rooted at `blockId` and collects
 * every `child_database` block as a DatabaseCategory.
 *
 * In the 2025-09-03 API, `notion.databases.retrieve()` returns a `data_sources`
 * array. We use `data_sources[0].id` — the actual data source ID required by
 * `notion.dataSources.query()` — instead of the database ID.
 *
 * Container blocks (`column_list`, `column`, `child_page`, etc.) are recursed
 * into but not added as categories themselves.
 */
async function collectDatabaseCategories(
	blockId: string,
	categories: CategoryConfig[],
	depth: number,
): Promise<void> {
	const MAX_DEPTH = 5;
	if (depth > MAX_DEPTH) return;

	const children = await getAllChildren(blockId);

	for (const block of children) {
		if (block.type === "child_database") {
			const db = await notion.databases.retrieve({ database_id: block.id });
			if (isFullDatabase(db)) {
				// In API version 2025-09-03, each database exposes its data sources.
				// The data_source_id is required by notion.dataSources.query().
				const dataSource = db.data_sources[0];
				if (!dataSource) continue; // Skip databases with no accessible data source
				categories.push({
					type: "database",
					name: extractPlainText(db.title),
					description: extractPlainText(db.description),
					dataSourceId: dataSource.id,
				});
			}
		} else if (block.type === "child_page") {
			const { description } = await extractPageCategoryPrompts(block.id);
			categories.push({
				type: "page",
				name: block.child_page.title,
				description,
				pageId: block.id,
			});
			// Recurse to find nested categories
			await collectDatabaseCategories(block.id, categories, depth + 1);
		} else if (block.has_children) {
			// Recurse into any other container block (e.g. column_list, column)
			await collectDatabaseCategories(block.id, categories, depth + 1);
		}
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

function extractPlainText(richText: { plain_text: string }[]): string {
	return richText.map((t) => t.plain_text).join("");
}

async function getAllChildren(blockId: string): Promise<BlockObjectResponse[]> {
	const all = await collectPaginatedAPI(notion.blocks.children.list, {
		block_id: blockId,
		page_size: NOTION_PAGE_SIZE,
	});
	return all.filter(isFullBlock);
}

// ─── Topic content extractors ─────────────────────────────────────────────────

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

async function queryDataSource(dataSourceId: string): Promise<{ id: string; name: string }[]> {
	const rows: { id: string; name: string }[] = [];

	for await (const row of iteratePaginatedAPI(notion.dataSources.query, {
		data_source_id: dataSourceId,
		filter_properties: ["title"],
		page_size: NOTION_PAGE_SIZE,
	})) {
		if (!isFullPage(row)) continue;
		const titleProp = Object.values(row.properties).find((p) => p.type === "title");
		const name = titleProp?.type === "title" ? extractPlainText(titleProp.title) : "";
		if (name) rows.push({ id: row.id.replace(/-/g, ""), name });
	}

	return rows;
}

// ─── Concurrency helper ───────────────────────────────────────────────────────

async function fetchDetailsConcurrently(
	topicIds: string[],
	concurrency = NOTION_CONCURRENCY,
): Promise<(TopicDetail | null)[]> {
	const limit = pLimit(concurrency);
	const settled = await Promise.allSettled(topicIds.map((id) => limit(() => getTopicDetail(id))));
	return settled.map((s) => (s.status === "fulfilled" ? s.value : null));
}

// ─── Public service methods ───────────────────────────────────────────────────

export { getAllChildren as getAllChildrenPublic };

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
	const cached = await cacheAdapter.get<Category[]>(CACHE_KEY);
	if (cached) return cached;

	const dynamicCategories = await getDynamicCategories();
	const categories: Category[] = dynamicCategories.map((c) => ({
		id: slugify(c.name),
		name: c.name,
		description: c.description,
		topicCount: c.type === "page" ? 1 : 0,
	}));

	await cacheAdapter.set(CACHE_KEY, categories);
	return categories;
}

export async function getTopics(categoryId?: string): Promise<Topic[]> {
	const CACHE_KEY = `topics:${categoryId ?? "all"}`;
	const cached = await cacheAdapter.get<Topic[]>(CACHE_KEY);
	if (cached) return cached;

	const topics: Topic[] = [];
	const allCategories = await getDynamicCategories();
	const targets = categoryId
		? allCategories.filter((c) => slugify(c.name) === categoryId)
		: allCategories;

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
					promptCount: 0,
				});
			}
		} else {
			topics.push({
				id: `${catId}--overview`,
				name: cat.name,
				categoryId: catId,
				categoryName: cat.name,
				promptCount: 0,
			});
		}
	}

	await cacheAdapter.set(CACHE_KEY, topics);
	return topics;
}

export async function getTopicDetail(topicId: string): Promise<TopicDetail | null> {
	const CACHE_KEY = `topic:${topicId}`;
	const cached = await cacheAdapter.get<TopicDetail>(CACHE_KEY);
	if (cached) return cached;

	const allCategories = await getDynamicCategories();
	for (const cat of allCategories) {
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
			await cacheAdapter.set(CACHE_KEY, detail);
			return detail;
		}

		if (cat.type === "database" && topicId.startsWith(`${catId}--`)) {
			const parts = topicId.split("--");
			const pageIdSuffix = parts[parts.length - 1];
			if (!pageIdSuffix) continue;

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
			await cacheAdapter.set(CACHE_KEY, detail);
			return detail;
		}
	}

	return null;
}

export async function searchPrompts(
	query: string,
	categoryId?: string,
	limit = 10,
): Promise<SearchResult[]> {
	const topics = await getTopics(categoryId);
	const q = query.toLowerCase();
	const results: SearchResult[] = [];

	for (let i = 0; i < topics.length && results.length < limit; i += NOTION_CONCURRENCY) {
		const batch = topics.slice(i, i + NOTION_CONCURRENCY);
		const details = await fetchDetailsConcurrently(
			batch.map((t) => t.id),
			NOTION_CONCURRENCY,
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
	const candidates = [...topics].sort(() => Math.random() - 0.5).slice(0, count * 3);
	const details = await fetchDetailsConcurrently(
		candidates.map((t) => t.id),
		NOTION_CONCURRENCY,
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
