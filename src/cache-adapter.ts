import { Redis } from "@upstash/redis";
import { cache as memCache } from "@/cache";
import { env } from "@/env";

const TTL_SECONDS = env.CACHE_TTL_SECONDS;

// Redis Set used to track all written keys so clear() works correctly
// across Vercel cold-start serverless instances.
const TRACKED_KEYS_SET = "cache:tracked_keys";

// Use Upstash Redis when credentials are available, otherwise fall back to
// the in-memory cache for local development.
const useRedis = !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

const redis = useRedis
	? new Redis({
			url: env.UPSTASH_REDIS_REST_URL as string,
			token: env.UPSTASH_REDIS_REST_TOKEN as string,
		})
	: null;

export const cacheAdapter = {
	async get<T>(key: string): Promise<T | null> {
		try {
			if (redis) return await redis.get<T>(key);
			return memCache.get<T>(key);
		} catch {
			return null; // cache miss on error — non-fatal
		}
	},

	async set<T>(key: string, data: T, ttlSeconds = TTL_SECONDS): Promise<void> {
		try {
			if (redis) {
				// Track the key so clear() can bulk-delete across cold starts.
				await redis.sadd(TRACKED_KEYS_SET, key);
				await redis.set(key, data, { ex: ttlSeconds });
			} else {
				memCache.set(key, data, ttlSeconds * 1000);
			}
		} catch {
			// Non-fatal — app works without cache
		}
	},

	async del(key: string): Promise<void> {
		try {
			if (redis) {
				await redis.srem(TRACKED_KEYS_SET, key);
				await redis.del(key);
			} else {
				memCache.del(key);
			}
		} catch {
			// Non-fatal
		}
	},

	async clear(): Promise<void> {
		try {
			if (redis) {
				// Fetch all tracked keys from the Redis Set — works across cold starts
				const keys = await redis.smembers<string[]>(TRACKED_KEYS_SET);
				if (keys.length > 0) {
					await redis.del(...keys);
				}
				await redis.del(TRACKED_KEYS_SET);
			} else {
				memCache.clear();
			}
		} catch {
			// Non-fatal
		}
	},
};
