interface CacheEntry<T> {
	data: T;
	expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const TTL_MS = (Number(process.env.CACHE_TTL_SECONDS) || 300) * 1000;

export const cache = {
	get<T>(key: string): T | null {
		const entry = store.get(key);
		if (!entry) return null;
		if (Date.now() > entry.expiresAt) {
			store.delete(key);
			return null;
		}
		return entry.data as T;
	},

	set<T>(key: string, data: T, ttlMs = TTL_MS): void {
		store.set(key, { data, expiresAt: Date.now() + ttlMs });
	},

	del(key: string): void {
		store.delete(key);
	},

	clear(): void {
		store.clear();
	},

	size(): number {
		return store.size;
	},
};
