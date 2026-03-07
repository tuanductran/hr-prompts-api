import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { promptsRoute } from "@/routes/prompts";
import { searchRoute } from "@/routes/search";
import { topicsRoute } from "@/routes/topics";

// Use route modules directly — no auth middleware — to test TypeBox validation
// and handler-level input checks in isolation.
// onError must be registered before routes so it catches validation errors.
const app = new Elysia()
	.onError(({ code, error, set }) => {
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
	.use(searchRoute)
	.use(topicsRoute)
	.use(promptsRoute);

describe("GET /search — input validation", () => {
	it("returns 422 when the q parameter is missing", async () => {
		const response = await app.handle(new Request("http://localhost/search"));
		expect(response.status).toBe(422);
	});

	it("returns 422 when q is 1 character (TypeBox minLength: 2)", async () => {
		const response = await app.handle(new Request("http://localhost/search?q=a"));
		expect(response.status).toBe(422);
	});

	it("returns 400 when q is only whitespace (passes TypeBox, fails handler trim check)", async () => {
		// "  " has length 2 so TypeBox passes it, but trim() produces "" which is < 2 chars
		const response = await app.handle(new Request("http://localhost/search?q=%20%20"));
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body).toHaveProperty("error", "Query too short");
	});

	it("422 body has error and message fields", async () => {
		const response = await app.handle(new Request("http://localhost/search"));
		const body = await response.json();
		expect(body).toHaveProperty("error");
		expect(body).toHaveProperty("message");
	});
});

describe("GET /topics — query validation", () => {
	it("returns 422 when page is 0 (minimum is 1)", async () => {
		const response = await app.handle(new Request("http://localhost/topics?page=0"));
		expect(response.status).toBe(422);
	});

	it("returns 422 when limit exceeds 100", async () => {
		const response = await app.handle(new Request("http://localhost/topics?limit=200"));
		expect(response.status).toBe(422);
	});
});

describe("GET /prompts/random — query validation", () => {
	it("returns 422 when count exceeds 20", async () => {
		const response = await app.handle(new Request("http://localhost/prompts/random?count=99"));
		expect(response.status).toBe(422);
	});
});

describe("404 handling", () => {
	it("returns 404 for an unknown route", async () => {
		const response = await app.handle(new Request("http://localhost/does-not-exist"));
		expect(response.status).toBe(404);
	});

	it("404 body has error and message fields", async () => {
		const response = await app.handle(new Request("http://localhost/does-not-exist"));
		const body = await response.json();
		expect(body).toHaveProperty("error");
		expect(body).toHaveProperty("message");
	});
});
