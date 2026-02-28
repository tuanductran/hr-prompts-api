import { createHmac } from "node:crypto";
import Elysia, { t } from "elysia";
import { fullSync, syncPage } from "../db/sync";

const WEBHOOK_SECRET = process.env.NOTION_WEBHOOK_SECRET;

// Temporarily store the last verification token in memory so it can be retrieved via GET
let lastVerificationToken: { token: string; receivedAt: string } | null = null;

// Events that require a full re-sync of all topics in a category
const FULL_SYNC_EVENTS = new Set([
	"data_source.created",
	"data_source.deleted",
	"data_source.schema_updated",
	"data_source.undeleted",
	"page.deleted",
	"page.undeleted",
]);

// Events that trigger a partial re-sync of the affected page
const PAGE_SYNC_EVENTS = new Set([
	"page.content_updated",
	"page.properties_updated",
	"data_source.content_updated",
]);

// Verify HMAC-SHA256 signature from Notion webhook (signed with verification_token)
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
	const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
	return `sha256=${expected}` === signature;
}

export const webhookRoute = new Elysia()
	// ── Capture raw body BEFORE JSON parsing so HMAC verification works ───────
	// request.text() returns empty after Elysia consumes the body stream;
	// onParse intercepts first and exposes the raw JSON string as `body`.
	.onParse(async ({ request, contentType }) => {
		if (contentType.includes("application/json")) {
			return request.text(); // body = raw JSON string
		}
	})
	// ── GET /webhook/notion/token — retrieve the last verification token ──────
	.get(
		"/webhook/notion/token",
		({ status }) => {
			if (!lastVerificationToken) {
				return status(404, {
					error: "Not found",
					message:
						"No verification token received yet. Trigger it from Notion integration settings.",
				});
			}
			return lastVerificationToken;
		},
		{
			detail: {
				summary: "Get last webhook verification token",
				description:
					"Returns the last verification_token sent by Notion. Use it in Notion settings to activate the webhook subscription.",
				tags: ["System"],
			},
		},
	)
	// ── POST /webhook/notion — receive Notion webhook events ──────────────────
	.post(
		"/webhook/notion",
		async ({ body, request, status }) => {
			// body is the raw JSON string captured by onParse above
			const rawBody = typeof body === "string" ? body : JSON.stringify(body);
			let raw: Record<string, unknown>;
			try {
				raw = JSON.parse(rawBody) as Record<string, unknown>;
			} catch {
				return { received: true };
			}

			// ── Step 1: Notion subscription verification handshake ────────────────
			if (typeof raw.verification_token === "string") {
				lastVerificationToken = {
					token: raw.verification_token,
					receivedAt: new Date().toISOString(),
				};
				return { received: true };
			}

			// ── Step 2: Validate HMAC-SHA256 signature ────────────────────────────
			if (WEBHOOK_SECRET) {
				const sig = request.headers.get("x-notion-signature") ?? "";
				if (!verifySignature(rawBody, sig, WEBHOOK_SECRET)) {
					return status(401, { error: "Unauthorized", message: "Invalid webhook signature." });
				}
			}

			const eventType = typeof raw.type === "string" ? raw.type : "";
			const rawEntity = raw.entity;
			const entity =
				typeof rawEntity === "object" && rawEntity !== null && !Array.isArray(rawEntity)
					? (rawEntity as Record<string, unknown>)
					: undefined;
			const entityId = typeof entity?.id === "string" ? entity.id.replace(/-/g, "") : null;

			// ── Step 3: Dispatch based on event type ──────────────────────────────
			if (entityId && PAGE_SYNC_EVENTS.has(eventType)) {
				syncPage(entityId).catch(() => {});
			} else if (FULL_SYNC_EVENTS.has(eventType)) {
				fullSync().catch(() => {});
			}

			return { received: true };
		},
		{
			body: t.String(), // raw JSON string from onParse
			detail: {
				summary: "Notion webhook receiver",
				description:
					"Receives Notion webhook events. Partial sync on content changes, full sync on structural changes.",
				tags: ["System"],
			},
		},
	);
