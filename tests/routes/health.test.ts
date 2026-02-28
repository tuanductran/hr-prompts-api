import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

// Test the health endpoint in isolation — no auth or rate-limit middleware.
const app = new Elysia().get("/health", () => ({
	status: "ok",
	timestamp: new Date().toISOString(),
}));

describe("GET /health", () => {
	it("returns status 200", async () => {
		const response = await app.handle(new Request("http://localhost/health"));
		expect(response.status).toBe(200);
	});

	it("returns JSON with status: ok", async () => {
		const response = await app.handle(new Request("http://localhost/health"));
		const body = await response.json();
		expect(body).toHaveProperty("status", "ok");
	});

	it("returns a valid ISO timestamp", async () => {
		const response = await app.handle(new Request("http://localhost/health"));
		const body = await response.json();
		expect(body).toHaveProperty("timestamp");
		expect(() => new Date(body.timestamp as string).toISOString()).not.toThrow();
	});
});
