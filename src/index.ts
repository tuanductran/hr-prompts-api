import { bearer } from "@elysiajs/bearer";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { serverTiming } from "@elysiajs/server-timing";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { APIErrorCode, ClientErrorCode, isNotionClientError } from "./notion";
import {
	categoriesRoute,
	promptsRoute,
	searchRoute,
	syncRoute,
	topicsRoute,
	webhookRoute,
} from "./routes";

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.API_KEY;

const app = new Elysia()
	// ─── CORS — required for Custom GPT Actions ──────────────────────────────
	.use(
		cors({
			origin: ["https://chat.openai.com", "https://chatgpt.com"],
			methods: ["GET", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	// ─── Rate limiting — protect against abuse (Notion API is expensive) ─────
	.use(
		rateLimit({
			duration: 60_000, // 1 minute window
			max: 60, // 60 requests per minute per IP
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
						"REST API serving 999 HR prompts from Notion — powers the HR Expert Assistant Custom GPT.",
				},
				tags: [
					{ name: "Categories", description: "HR topic categories" },
					{ name: "Topics", description: "HR topics and their prompts" },
					{ name: "Search", description: "Full-text search across prompts" },
					{ name: "Prompts", description: "Random prompt suggestions" },
					{ name: "System", description: "Health & cache management" },
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
			status: "ok",
			timestamp: new Date().toISOString(),
		}),
		{
			detail: { tags: ["System"], summary: "Health check" },
		},
	)
	// ─── Feature routes ──────────────────────────────────────────────────────
	.use(categoriesRoute)
	.use(topicsRoute)
	.use(searchRoute)
	.use(promptsRoute)
	.use(syncRoute)
	.use(webhookRoute);

// Listen only when running locally (not on Vercel serverless)
if (process.env.VERCEL !== "1") {
	app.listen(PORT);
	console.log(`🦊 HR Prompts API running at http://localhost:${PORT}`);
	console.log(`📖 OpenAPI docs:           http://localhost:${PORT}/openapi`);
}

export type App = typeof app;
export default app;
