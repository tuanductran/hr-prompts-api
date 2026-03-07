import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { categoriesRoute } from "@/routes/categories";

// Uses the real DB (local fallback: file:./local.db).
// An empty DB returns empty arrays / 404 — both are valid structural assertions.
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
	.use(categoriesRoute);

describe("GET /categories", () => {
	it("returns 200", async () => {
		const response = await app.handle(new Request("http://localhost/categories"));
		expect(response.status).toBe(200);
	});

	it("response has a categories array", async () => {
		const response = await app.handle(new Request("http://localhost/categories"));
		const body = await response.json();
		expect(body).toHaveProperty("categories");
		expect(Array.isArray(body.categories)).toBe(true);
	});

	it("each category item has the expected shape", async () => {
		const response = await app.handle(new Request("http://localhost/categories"));
		const body = await response.json();
		for (const cat of body.categories as unknown[]) {
			const c = cat as Record<string, unknown>;
			expect(typeof c.id).toBe("string");
			expect(typeof c.name).toBe("string");
			expect(typeof c.description).toBe("string");
			expect(typeof c.topicCount).toBe("number");
		}
	});
});

describe("GET /categories/:id", () => {
	it("returns 404 for a non-existent category id", async () => {
		const response = await app.handle(new Request("http://localhost/categories/does-not-exist"));
		expect(response.status).toBe(404);
	});

	it("404 body has error and message fields", async () => {
		const response = await app.handle(new Request("http://localhost/categories/does-not-exist"));
		const body = await response.json();
		expect(body).toHaveProperty("error");
		expect(body).toHaveProperty("message");
	});
});
