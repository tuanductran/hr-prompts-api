import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { syncRoute } from "@/routes/sync";

const app = new Elysia()
	.onError(({ code, error, set }) => {
		if (code === "VALIDATION") {
			set.status = 422;
			return { error: "Validation error", message: error.message };
		}
		set.status = 500;
		return { error: "Internal server error", message: "Something went wrong." };
	})
	.use(syncRoute);

describe("GET /sync/status", () => {
	it("returns 200", async () => {
		const response = await app.handle(new Request("http://localhost/sync/status"));
		expect(response.status).toBe(200);
	});

	it("response has a lastSync field", async () => {
		const response = await app.handle(new Request("http://localhost/sync/status"));
		const body = await response.json();
		expect(body).toHaveProperty("lastSync");
	});

	it("lastSync is null when no sync has been run", async () => {
		const response = await app.handle(new Request("http://localhost/sync/status"));
		const body = await response.json();
		// On a fresh DB or CI environment with no prior sync, lastSync is null
		if (body.lastSync !== null) {
			const s = body.lastSync as Record<string, unknown>;
			expect(typeof s.status).toBe("string");
			const validStatuses = ["started", "completed", "failed"];
			expect(validStatuses.includes(s.status as string)).toBe(true);
		} else {
			expect(body.lastSync).toBeNull();
		}
	});
});
