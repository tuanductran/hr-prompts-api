// ─── Cache ────────────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
	data: T;
	expiresAt: number;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

export interface Prompt {
	number: number;
	text: string;
}

// ─── Topics ───────────────────────────────────────────────────────────────────

export interface Topic {
	id: string;
	name: string;
	categoryId: string;
	categoryName: string;
	promptCount: number;
}

export interface TopicDetail extends Topic {
	description: string;
	prompts: Prompt[];
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface Category {
	id: string;
	name: string;
	description: string;
	topicCount: number;
}

interface DatabaseCategory {
	type: "database";
	name: string;
	description: string;
	dataSourceId: string;
}

interface PageCategory {
	type: "page";
	name: string;
	description: string;
	pageId: string;
}

export type CategoryConfig = DatabaseCategory | PageCategory;

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchResult {
	topicId: string;
	topicName: string;
	categoryId: string;
	categoryName: string;
	matchedPrompts: Prompt[];
}
