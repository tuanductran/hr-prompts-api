import { z } from "zod";

// ─── Schema ───────────────────────────────────────────────────────────────────
// All fields are optional or have defaults so parsing always succeeds.
// validateProductionEnv() enforces required vars at startup (call in index.ts).

const schema = z.object({
	NOTION_TOKEN: z.string().default(""),
	NOTION_PAGE_ID: z.string().default(""),
	TURSO_DATABASE_URL: z.string().optional(),
	TURSO_AUTH_TOKEN: z.string().optional(),
	API_KEY: z.string().optional(),
	NOTION_WEBHOOK_SECRET: z.string().optional(),
	PORT: z.coerce.number().default(3000),
	CACHE_TTL_SECONDS: z.coerce.number().default(300),
	CORS_ORIGINS: z.string().optional(),
	RATE_LIMIT_MAX: z.coerce.number().default(60),
	RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
	// Upstash Redis — set these when deploying to Vercel for a shared cache
	UPSTASH_REDIS_REST_URL: z.string().optional(),
	UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
	// Use z.enum() instead of z.string() so invalid values are caught at startup
	// rather than silently falling through as an unexpected string.
	LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
	// Vercel sets this to the string "1" — only that exact value is valid.
	VERCEL: z.enum(["1"]).optional(),
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	DOMAIN: z.string().optional(),
	GITHUB_REPO: z.string().optional(),
});

export const env = schema.parse(process.env);

/** Enforce required vars at startup — call this in src/index.ts only. */
export function validateProductionEnv(): void {
	const required = ["NOTION_TOKEN", "NOTION_PAGE_ID"] as const;
	const missing = required.filter((k) => !env[k]);
	if (missing.length > 0) {
		throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
	}
}
