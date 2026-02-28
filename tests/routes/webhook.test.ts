import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { Elysia } from "elysia";
import { webhookRoute } from "../../src/routes/webhook";

// Build a minimal app with only the webhook route.
// WEBHOOK_SECRET is read at module load time; since it is not set in the test
// environment, HMAC verification is skipped — all well-formed requests are accepted.
const app = new Elysia().use(webhookRoute);

function makeRequest(body: unknown, headers?: Record<string, string>) {
	return new Request("http://localhost/webhook/notion", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}

function hmacSignature(payload: string, secret: string): string {
	return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

describe("GET /webhook/notion/token — before any POST", () => {
	it("returns 404 when no verification token has been received", async () => {
		const response = await app.handle(new Request("http://localhost/webhook/notion/token"));
		expect(response.status).toBe(404);
	});

	it("404 body has error and message fields", async () => {
		const response = await app.handle(new Request("http://localhost/webhook/notion/token"));
		const body = await response.json();
		expect(body).toHaveProperty("error");
		expect(body).toHaveProperty("message");
	});
});

describe("POST /webhook/notion — verification handshake", () => {
	it("returns 200 with received: true when verification_token is present", async () => {
		const response = await app.handle(makeRequest({ verification_token: "test-token-abc123" }));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toHaveProperty("received", true);
	});

	it("stores the verification token so GET /token returns it", async () => {
		await app.handle(makeRequest({ verification_token: "stored-token-xyz" }));
		const response = await app.handle(new Request("http://localhost/webhook/notion/token"));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toHaveProperty("token", "stored-token-xyz");
		expect(body).toHaveProperty("receivedAt");
	});

	it("receivedAt is a valid ISO timestamp", async () => {
		await app.handle(makeRequest({ verification_token: "ts-check-token" }));
		const response = await app.handle(new Request("http://localhost/webhook/notion/token"));
		const body = await response.json();
		expect(() => new Date(body.receivedAt as string).toISOString()).not.toThrow();
	});
});

describe("POST /webhook/notion — event dispatch (no HMAC configured)", () => {
	it("returns received: true for a page content_updated event", async () => {
		const response = await app.handle(
			makeRequest({
				type: "page.content_updated",
				entity: { id: "test-page-id-1234" },
			}),
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toHaveProperty("received", true);
	});

	it("returns received: true for an unknown event type", async () => {
		const response = await app.handle(
			makeRequest({ type: "some.unknown.event", entity: { id: "abc" } }),
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toHaveProperty("received", true);
	});

	it("returns received: true for invalid JSON body", async () => {
		const response = await app.handle(
			new Request("http://localhost/webhook/notion", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "not-valid-json",
			}),
		);
		// The endpoint catches JSON parse errors and returns received: true
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toHaveProperty("received", true);
	});
});

describe("HMAC signature helper", () => {
	it("produces a sha256= prefixed hex string", () => {
		const sig = hmacSignature("test-payload", "secret");
		expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
	});

	it("produces different signatures for different secrets", () => {
		const sig1 = hmacSignature("payload", "secret1");
		const sig2 = hmacSignature("payload", "secret2");
		expect(sig1).not.toBe(sig2);
	});

	it("produces the same signature for the same inputs", () => {
		const sig1 = hmacSignature("payload", "secret");
		const sig2 = hmacSignature("payload", "secret");
		expect(sig1).toBe(sig2);
	});
});
