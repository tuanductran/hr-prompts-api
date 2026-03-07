import { bearer } from "@elysiajs/bearer";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { serverTiming } from "@elysiajs/server-timing";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { env, validateProductionEnv } from "@/env";
import { APIErrorCode, ClientErrorCode, isNotionClientError } from "@/notion";

// ─── Validate required env vars in production ─────────────────────────────────
if (env.VERCEL === "1") {
	validateProductionEnv();
}

import { HealthResponseSchema } from "@/models";
import {
	categoriesRoute,
	promptsRoute,
	searchRoute,
	summaryRoute,
	syncRoute,
	topicsRoute,
	webhookRoute,
} from "@/routes";

const PORT = env.PORT;
const API_KEY = env.API_KEY;

// Parse CORS origins from env — comma-separated list or default ChatGPT origins
const CORS_ORIGINS = env.CORS_ORIGINS
	? env.CORS_ORIGINS.split(",").map((o) => o.trim())
	: ["https://chat.openai.com", "https://chatgpt.com"];

const app = new Elysia()
	// ─── CORS — required for Custom GPT Actions ──────────────────────────────
	.use(
		cors({
			origin: CORS_ORIGINS,
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	// ─── Rate limiting — protect against abuse (Notion API is expensive) ─────
	.use(
		rateLimit({
			duration: env.RATE_LIMIT_WINDOW_MS,
			max: env.RATE_LIMIT_MAX,
			errorResponse: new Response(
				JSON.stringify({
					error: "Too many requests",
					message: "Rate limit exceeded. Try again in a minute.",
				}),
				{ status: 429, headers: { "Content-Type": "application/json" } },
			),
		}),
	)
	// ─── Server Timing — performance audit (dev only by default) ─────────────
	.use(serverTiming())
	// ─── Bearer auth — optional; set API_KEY env var to enable ───────────────
	.use(bearer())
	.onBeforeHandle(({ bearer, status, path }) => {
		if (
			!API_KEY ||
			path === "/health" ||
			path.startsWith("/openapi") ||
			path.startsWith("/webhook/notion")
		)
			return;
		if (bearer !== API_KEY) {
			return status(401, { error: "Unauthorized", message: "Invalid or missing API key." });
		}
		return;
	})
	// ─── Global error handler ─────────────────────────────────────────────────
	.onError(({ code, error, set }) => {
		// Handle Notion API errors using SDK type guards and error codes
		if (isNotionClientError(error)) {
			if (error.code === APIErrorCode.RateLimited) {
				set.status = 429;
				return {
					error: "Rate limited",
					message: "Notion API rate limit reached. Try again shortly.",
				};
			}
			if (
				error.code === APIErrorCode.Unauthorized ||
				error.code === APIErrorCode.RestrictedResource
			) {
				set.status = 503;
				return {
					error: "Notion auth error",
					message: "Invalid or missing Notion integration token.",
				};
			}
			if (error.code === APIErrorCode.ObjectNotFound) {
				set.status = 404;
				return { error: "Not found", message: "Notion resource not found." };
			}
			if (error.code === ClientErrorCode.RequestTimeout) {
				set.status = 504;
				return { error: "Timeout", message: "Notion API request timed out. Try again." };
			}
			if (
				error.code === APIErrorCode.InternalServerError ||
				error.code === APIErrorCode.ServiceUnavailable
			) {
				set.status = 502;
				return { error: "Notion unavailable", message: "Notion API is temporarily unavailable." };
			}
		}
		if (code === "VALIDATION") {
			set.status = 422;
			return { error: "Validation error", message: error.message };
		}
		if (code === "NOT_FOUND") {
			set.status = 404;
			return { error: "Not found", message: "The requested route does not exist." };
		}
		if (code === "PARSE") {
			set.status = 400;
			return { error: "Bad Request", message: error.message };
		}
		set.status = 500;
		return { error: "Internal server error", message: "Something went wrong." };
	})
	// ─── OpenAPI / Scalar UI ─────────────────────────────────────────────────
	.use(
		openapi({
			documentation: {
				info: {
					title: "HR Prompt Knowledge Base API",
					version: "1.0.0",
					description:
						"REST API serving an HR prompt knowledge base sourced from Notion. Provides categorized HR prompts for recruiting, compliance, performance management, and more. Designed for use with ChatGPT Custom Actions.",
				},
				...(env.DOMAIN
					? { servers: [{ url: `https://${env.DOMAIN}`, description: "Production" }] }
					: { servers: [{ url: "http://localhost:3000", description: "Development" }] }),
				tags: [
					{ name: "Categories", description: "HR topic categories" },
					{ name: "Topics", description: "HR topics and their prompts" },
					{ name: "Search", description: "Full-text search across prompts" },
					{ name: "Prompts", description: "Random prompt suggestions" },
					{ name: "Summary", description: "Database summary statistics" },
					{ name: "System", description: "Health, sync & webhook management" },
				],
				components: {
					securitySchemes: {
						bearerAuth: { type: "http", scheme: "bearer" },
					},
				},
				security: [{ bearerAuth: [] }],
			},
		}),
	)
	// ─── System routes ───────────────────────────────────────────────────────
	.get(
		"/health",
		() => ({
			status: "ok" as const,
			timestamp: new Date().toISOString(),
		}),
		{
			detail: {
				operationId: "getHealth",
				tags: ["System"],
				summary: "Health check",
				description: "Returns server health status and current UTC timestamp.",
			},
			response: { 200: HealthResponseSchema },
		},
	)
	// ─── Feature routes ──────────────────────────────────────────────────────
	.use(categoriesRoute)
	.use(topicsRoute)
	.use(searchRoute)
	.use(promptsRoute)
	.use(syncRoute)
	.use(webhookRoute)
	.use(summaryRoute);

// Listen only when running locally (not on Vercel serverless)
if (process.env.VERCEL !== "1") {
	app.listen(PORT);
	console.log(`🦊 HR Prompts API running at http://localhost:${PORT}`);
	console.log(`📖 OpenAPI docs:           http://localhost:${PORT}/openapi`);
}

export type App = typeof app;
export default app;
