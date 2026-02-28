# Database

The project uses [Turso](https://turso.tech) — a distributed libSQL/SQLite database — accessed via [Drizzle ORM](https://orm.drizzle.team).

## Schema

Four tables store all content:

### `categories`

Top-level HR domains (e.g. Recruiting, Compliance).

| Column | Type | Description |
|---|---|---|
| `id` | text (PK) | Slugified name, e.g. `recruiting` |
| `name` | text | Display name |
| `type` | text enum | `database` or `page` (Notion source type) |
| `notion_id` | text | Notion data source ID or page ID |
| `synced_at` | integer | Timestamp of last sync |

### `topics`

Sub-topics within a category (e.g. "Conducting Reference Checks").

| Column | Type | Description |
|---|---|---|
| `id` | text (PK) | Slugified, e.g. `recruiting--conducting-reference-checks--02b0893c` |
| `category_id` | text (FK) | References `categories.id` |
| `name` | text | Display name |
| `description` | text | Optional description |
| `notion_id` | text | Notion page ID |
| `synced_at` | integer | Timestamp of last sync |

### `prompts`

Individual HR prompt text items within a topic.

| Column | Type | Description |
|---|---|---|
| `id` | integer (PK) | Auto-increment |
| `topic_id` | text (FK) | References `topics.id` |
| `text` | text | The prompt text |
| `order_index` | integer | Display order within the topic |

### `sync_log`

Records the history of data sync operations.

| Column | Type | Description |
|---|---|---|
| `id` | integer (PK) | Auto-increment |
| `status` | text enum | `started`, `completed`, or `failed` |
| `details` | text | Optional notes or error message |
| `started_at` | integer | When the sync started |
| `completed_at` | integer | When the sync finished |

## Migrations

Drizzle Kit manages schema migrations.

```bash
# After changing src/db/schema.ts, generate a new migration file
bun run db:generate

# Apply all pending migrations to the database
bun run db:migrate

# Browse the database in a web UI
bun run db:studio
```

Migration files are stored in `drizzle/`.

## Local development

When `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are not set, the database falls back to a local SQLite file:

```text
local.db
```

This file is listed in `.gitignore` and is only used during local development.

## Connection

The Drizzle client is configured in `src/db/index.ts`:

- **Production / Vercel:** uses `drizzle-orm/libsql/http` (HTTP transport — reliable on serverless)
- **Local fallback:** uses `file:./local.db`

The HTTP transport (not WebSocket) is used because it works reliably on Vercel's serverless edge functions.
