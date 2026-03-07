import Elysia, { t } from "elysia";
import { fullSync, getLastSync } from "@/db/sync";
import { ErrorSchema, SyncResultResponseSchema, SyncStatusResponseSchema } from "@/models";

// Safely parse the stored sync details JSON string.
// Returns a typed counts object on success, or the raw string on failure.
// Avoids `as unknown` casts in the route handler and satisfies the TypeBox union schema.
function parseSyncDetails(
	raw: string,
): { categories: number; topics: number; prompts: number } | string {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
			const p = parsed as Record<string, unknown>;
			const { categories, topics, prompts } = p;
			if (
				typeof categories === "number" &&
				typeof topics === "number" &&
				typeof prompts === "number"
			) {
				return { categories, topics, prompts };
			}
		}
	} catch {
		// fall through to string fallback
	}
	return raw;
}

export const syncRoute = new Elysia()
	.get(
		"/sync/status",
		async () => {
			const last = await getLastSync();
			return {
				lastSync: last
					? {
							status: last.status,
							startedAt: last.startedAt?.toISOString() ?? null,
							completedAt: last.completedAt?.toISOString() ?? null,
							details: last.details ? parseSyncDetails(last.details) : null,
						}
					: null,
			};
		},
		{
			detail: {
				operationId: "getSyncStatus",
				summary: "Last sync status",
				description:
					"Returns the status and stats of the most recent Notion sync. Use this to check if the knowledge base is up to date.",
				tags: ["System"],
			},
			response: { 200: SyncStatusResponseSchema },
		},
	)
	.post(
		"/sync",
		async ({ status }) => {
			try {
				const result = await fullSync();
				return { success: true, ...result };
			} catch (err) {
				return status(500, {
					error: "Sync failed",
					message: err instanceof Error ? err.message : "Unknown error",
				});
			}
		},
		{
			body: t.Optional(t.Object({})),
			detail: {
				operationId: "triggerSync",
				summary: "Trigger full sync from Notion",
				description:
					"Pulls all data from Notion and writes it to the database. This is a consequential action that can take several minutes. Only use when explicitly asked to refresh the knowledge base.",
				tags: ["System"],
			},
			response: { 200: SyncResultResponseSchema, 500: ErrorSchema },
		},
	);
