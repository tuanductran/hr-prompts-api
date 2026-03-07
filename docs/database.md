# Database

The project uses [Turso](https://turso.tech) — a distributed libSQL/SQLite database — accessed via [Drizzle ORM](https://orm.drizzle.team).

## Schema

Four tables are defined in `src/db/schema.ts`.

### `categories`

Top-level HR domains (e.g. Recruiting, Compliance). Populated dynamically from Notion.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` (PK) | Slugified category name, e.g. `recruiting` |
| `name` | `text NOT NULL` | Display name |
| `type` | `text NOT NULL` | `"database"` or `"page"` — reflects the Notion source type |
| `notion_id` | `text NOT NULL` | Notion data source ID (for `database`) or page ID (for `page`) |
| `description` | `text` | Optional description |
| `synced_at` | `integer` (timestamp) | Unix timestamp of last sync |

### `topics`

Sub-topics within a category (e.g. "Conducting Reference Checks").

| Column | Type | Notes |
|---|---|---|
| `id` | `text` (PK) | Composite slug, e.g. `recruiting--conducting-reference-checks--02b0893c` |
| `category_id` | `text NOT NULL` (FK → `categories.id`) | Cascades on delete |
| `name` | `text NOT NULL` | Display name |
| `description` | `text` | Optional description extracted from the Notion page |
| `notion_id` | `text NOT NULL` | Notion page ID |
| `synced_at` | `integer` (timestamp) | Unix timestamp of last sync |

### `prompts`

Individual HR prompt text items within a topic.

| Column | Type | Notes |
|---|---|---|
| `id` | `integer` (PK, auto-increment) | |
| `topic_id` | `text NOT NULL` (FK → `topics.id`) | Cascades on delete |
| `text` | `text NOT NULL` | The prompt text |
| `order_index` | `integer NOT NULL` | Display order within the topic (default: 0) |

### `sync_log`

Records the history of data sync operations.

| Column | Type | Notes |
|---|---|---|
| `id` | `integer` (PK, auto-increment) | |
| `status` | `text NOT NULL` | `"started"`, `"completed"`, or `"failed"` |
| `details` | `text` | JSON-encoded counts on success; error message string on failure |
| `started_at` | `integer NOT NULL` (timestamp) | When the sync started |
| `completed_at` | `integer` (timestamp) | When the sync finished (null if still running) |

## Drizzle row types

`src/db/schema.ts` exports inferred types with a `Row` suffix:

```ts
export type CategoryRow = typeof categories.$inferSelect;
export type TopicRow    = typeof topics.$inferSelect;
export type PromptRow   = typeof prompts.$inferSelect;
export type SyncLogRow  = typeof syncLog.$inferSelect;
```

These are different from the application-layer types in `src/types.ts` (`Category`, `Topic`, `Prompt`) which have different shapes designed for API responses.

## Migrations

Drizzle Kit manages schema migrations. Migration files are stored in `drizzle/` and should not be edited manually.

```bash
# After changing src/db/schema.ts, generate a new migration file
bun run db:generate

# Apply all pending migrations to the database
bun run db:migrate

# Browse the database in a web UI
bun run db:studio
```

## Connection

The Drizzle client in `src/db/index.ts` uses the HTTP transport (`drizzle-orm/libsql/http`):

- **Production:** connects to Turso using `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- **Local / dev:** falls back to `file:./local.db` when `TURSO_DATABASE_URL` is not set

Do not change the transport from HTTP to WebSocket — HTTP is required for reliable operation on Vercel serverless functions.

## Local development

When Turso credentials are not set, the database falls back to a local SQLite file `local.db` in the project root. This file is listed in `.gitignore`.

Run migrations against the local file before starting the dev server:

```bash
bun run db:migrate
```
