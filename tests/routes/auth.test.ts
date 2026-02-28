import { describe, expect, it } from "bun:test";
import { bearer } from "@elysiajs/bearer";
import { Elysia } from "elysia";

// Build a minimal test app that mirrors the production auth middleware pattern.
// We create it inline to control the API_KEY per test without relying on env vars
// set before module load.
function createApp(apiKey: string | undefined) {
	return new Elysia()
		.use(bearer())
		.onBeforeHandle(({ bearer: token, status, path }) => {
			if (
				!apiKey ||
				path === "/health" ||
				path.startsWith("/openapi") ||
				path.startsWith("/webhook/notion")
			)
				return;
			if (token !== apiKey) {
				return status(401, { error: "Unauthorized", message: "Invalid or missing API key." });
			}
		})
		.get("/health", () => ({ status: "ok" }))
		.get("/protected", () => ({ data: "secret" }));
}

describe("bearer auth — no API_KEY configured", () => {
	const app = createApp(undefined);

	it("allows requests to protected routes without a token", async () => {
		const response = await app.handle(new Request("http://localhost/protected"));
		expect(response.status).toBe(200);
	});

	it("allows requests to /health", async () => {
		const response = await app.handle(new Request("http://localhost/health"));
		expect(response.status).toBe(200);
	});
});

describe("bearer auth — API_KEY configured", () => {
	const API_KEY = "test-secret-key";
	const app = createApp(API_KEY);

	it("returns 401 when no Authorization header is sent", async () => {
		const response = await app.handle(new Request("http://localhost/protected"));
		expect(response.status).toBe(401);
	});

	it("returns 401 when the wrong token is sent", async () => {
		const response = await app.handle(
			new Request("http://localhost/protected", {
				headers: { Authorization: "Bearer wrong-key" },
			}),
		);
		expect(response.status).toBe(401);
	});

	it("returns 200 when the correct token is sent", async () => {
		const response = await app.handle(
			new Request("http://localhost/protected", {
				headers: { Authorization: `Bearer ${API_KEY}` },
			}),
		);
		expect(response.status).toBe(200);
	});

	it("always allows /health regardless of token", async () => {
		const response = await app.handle(new Request("http://localhost/health"));
		expect(response.status).toBe(200);
	});

	it("always allows /webhook/notion paths regardless of token", async () => {
		const appWithWebhook = createApp(API_KEY).post("/webhook/notion", () => ({ ok: true }));
		const response = await appWithWebhook.handle(
			new Request("http://localhost/webhook/notion", { method: "POST" }),
		);
		expect(response.status).toBe(200);
	});
});

describe("error response shape", () => {
	const app = createApp("any-key");

	it("401 response has error and message fields", async () => {
		const response = await app.handle(new Request("http://localhost/protected"));
		const body = await response.json();
		expect(body).toHaveProperty("error");
		expect(body).toHaveProperty("message");
	});
});
