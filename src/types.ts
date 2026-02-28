export interface Prompt {
	number: number;
	text: string;
}

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

export interface Category {
	id: string;
	name: string;
	description: string;
	topicCount: number;
}

export interface SearchResult {
	topicId: string;
	topicName: string;
	categoryId: string;
	categoryName: string;
	matchedPrompts: Prompt[];
}

export interface PaginatedTopics {
	topics: Topic[];
	total: number;
	page: number;
	limit: number;
}
