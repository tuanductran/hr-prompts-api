import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { topicsRoute } from "@/routes/topics";

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
	.use(topicsRoute);

describe("GET /topics", () => {
	it("returns 200", async () => {
		const response = await app.handle(new Request("http://localhost/topics"));
		expect(response.status).toBe(200);
	});

	it("response has expected shape", async () => {
		const response = await app.handle(new Request("http://localhost/topics"));
		const body = await response.json();
		expect(body).toHaveProperty("topics");
		expect(body).toHaveProperty("total");
		expect(body).toHaveProperty("page");
		expect(body).toHaveProperty("limit");
		expect(Array.isArray(body.topics)).toBe(true);
		expect(typeof body.total).toBe("number");
	});

	it("returns 422 when page is 0 (minimum is 1)", async () => {
		const response = await app.handle(new Request("http://localhost/topics?page=0"));
		expect(response.status).toBe(422);
	});

	it("returns 422 when limit exceeds 100", async () => {
		const response = await app.handle(new Request("http://localhost/topics?limit=200"));
		expect(response.status).toBe(422);
	});

	it("each topic item has the expected shape", async () => {
		const response = await app.handle(new Request("http://localhost/topics"));
		const body = await response.json();
		for (const item of body.topics as unknown[]) {
			const t = item as Record<string, unknown>;
			expect(typeof t.id).toBe("string");
			expect(typeof t.name).toBe("string");
			expect(typeof t.categoryId).toBe("string");
			expect(typeof t.categoryName).toBe("string");
			expect(typeof t.promptCount).toBe("number");
		}
	});
});

describe("GET /topics/:topic_id", () => {
	it("returns 404 for a non-existent topic id", async () => {
		const response = await app.handle(new Request("http://localhost/topics/does-not-exist"));
		expect(response.status).toBe(404);
	});

	it("404 body has error and message fields", async () => {
		const response = await app.handle(new Request("http://localhost/topics/does-not-exist"));
		const body = await response.json();
		expect(body).toHaveProperty("error");
		expect(body).toHaveProperty("message");
	});
});
