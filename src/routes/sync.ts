import Elysia, { t } from "elysia";
import { fullSync, getLastSync } from "../db/sync";

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
							details: last.details ? JSON.parse(last.details) : null,
						}
					: null,
			};
		},
		{
			detail: {
				summary: "Last sync status",
				description: "Returns the status and stats of the most recent Notion sync.",
				tags: ["System"],
			},
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
				summary: "Trigger full sync from Notion",
				description:
					"Pulls all data from Notion and writes it to the database. Can take several minutes.",
				tags: ["System"],
			},
		},
	);
