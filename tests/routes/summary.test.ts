import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { summaryRoute } from "@/routes/summary";

// Build a minimal app with only the summary route
const app = new Elysia().use(summaryRoute);

describe("GET /summary", () => {
	it("returns 200 with category, topic, and prompt counts", async () => {
		const response = await app.handle(new Request("http://localhost/summary"));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toHaveProperty("categories");
		expect(body).toHaveProperty("topics");
		expect(body).toHaveProperty("prompts");
		expect(typeof body.categories).toBe("number");
		expect(typeof body.topics).toBe("number");
		expect(typeof body.prompts).toBe("number");
	});
});
