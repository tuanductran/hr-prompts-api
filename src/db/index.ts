import { drizzle } from "drizzle-orm/libsql/http";
import * as schema from "./schema";

// Use HTTP client — more reliable on serverless/edge (Vercel) than WebSocket default.
// Falls back to a local SQLite file when TURSO_DATABASE_URL is not set (local dev).
const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = drizzle({
	connection: { url, authToken },
	schema,
});

export type DB = typeof db;
export { schema };
