# AGENTS.md

This file documents the project for AI coding agents. Read it before making changes.

---

## Project overview

`hr-prompts-api` is a REST API that serves an HR prompt knowledge base. It is built with [Elysia](https://elysiajs.com/) running on [Bun](https://bun.sh/). Content originates in Notion and is synced into a [Turso](https://turso.tech/) SQLite database (via [Drizzle ORM](https://orm.drizzle.team/)). The API is consumed by a ChatGPT Custom GPT via OpenAI Actions.

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Framework | Elysia v1 |
| Database | Turso (libSQL) — local fallback: `file:./local.db` |
| ORM | Drizzle ORM (`drizzle-orm/libsql/http`) |
| Schema validation | TypeBox via Elysia's `t` (request/response); Zod v4 (env vars) |
| Notion sync | `@notionhq/client` v5, API version `2025-09-03` |
| Linter / formatter | Biome v2 |
| Error tracking | Sentry (`@sentry/bun`) |
| Deploy target | Vercel (serverless) |

---

## Commands

```bash
bun run dev          # Start with hot reload (--watch)
bun run start        # Start without hot reload
bun run build        # Compile to dist/

bun run lint         # Biome lint src/
bun run format       # Biome format src/ (auto-fixes)
bun run check        # Biome check + fix src/
bun run ci           # Biome CI (no writes — use in CI pipelines)

bun run db:generate  # Generate Drizzle migration from schema changes
bun run db:migrate   # Apply pending migrations
bun run db:studio    # Open Drizzle Studio (local DB browser)

bun test             # Run all tests
bun run spell        # Spell-check Markdown and TypeScript files
bun run mdlint       # Markdown lint
```

Before committing, run the full check suite:

```bash
bun run ci && bun tsc --noEmit && bun test && bun run spell && bun run mdlint
```

---

## Project structure

```text
src/
  index.ts          # App entry point — registers plugins, middleware, routes
  env.ts            # Zod v4 env-var schema and validateProductionEnv()
  models.ts         # TypeBox schemas shared across routes (request/response)
  types.ts          # Application-layer TypeScript types (Category, Topic, etc.)
  cache.ts          # In-memory TTL cache (Map-based, used in local/dev)
  cache-adapter.ts  # Cache abstraction: in-memory (dev) or Upstash Redis (prod)
  notion.ts         # Notion SDK client, dynamic category discovery, data helpers
  logger.ts         # Pino structured logger
  instrument.ts     # Sentry initialisation — imported first in index.ts
  db/
    index.ts        # Drizzle HTTP client — connects to Turso or local SQLite
    schema.ts       # Four tables: categories, topics, prompts, sync_log
    sync.ts         # Full sync and partial (page-level) sync logic
  routes/
    index.ts        # Re-exports all route plugins
    categories.ts   # GET /categories, GET /categories/:id
    topics.ts       # GET /topics, GET /topics/:id
    prompts.ts      # GET /prompts/random
    search.ts       # GET /search
    summary.ts      # GET /summary
    sync.ts         # GET /sync/status, POST /sync
    webhook.ts      # GET /webhook/notion/token, POST /webhook/notion
drizzle/            # Auto-generated SQL migrations (do not edit manually)
docs/               # Project documentation (Markdown)
tests/              # Bun unit tests
```

---

## Key architecture decisions

### Database transport: HTTP, not WebSocket

`src/db/index.ts` uses `drizzle-orm/libsql/http`. Do not change this to WebSocket. HTTP transport is more reliable on Vercel serverless functions. The local fallback uses `file:./local.db` when `TURSO_DATABASE_URL` is not set.

### Vercel serverless entry point

`src/index.ts` exports `default app`. It only calls `app.listen()` when `process.env.VERCEL !== "1"`. This pattern is required for Vercel serverless — do not remove this condition.

### Env-var validation at startup

`src/env.ts` uses Zod v4 to parse `process.env`. All fields have defaults or are optional so parsing never throws at module load time. `validateProductionEnv()` is called in `src/index.ts` only when `VERCEL === "1"`, enforcing that `NOTION_TOKEN` and `NOTION_PAGE_ID` are set before the serverless function handles any request.

Enum fields use `z.enum()` so invalid values are caught immediately at startup rather than silently falling through:

- `LOG_LEVEL`: `"trace" | "debug" | "info" | "warn" | "error"` (default `"info"`)
- `NODE_ENV`: `"development" | "production" | "test"` (default `"development"`)
- `VERCEL`: `"1"` or absent

### Cache strategy

`src/cache-adapter.ts` provides a uniform `get / set / del / clear` API:

- **Local / development:** uses the in-memory `Map`-based TTL cache in `src/cache.ts`.
- **Production (Vercel):** when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, switches to Upstash Redis via `@upstash/redis`. All written keys are tracked in a Redis Set so `clear()` works correctly across cold-start serverless instances.

Do not access `src/cache.ts` directly from route files — always use `src/cache-adapter.ts`.

### Webhook HMAC verification

`src/routes/webhook.ts` uses an Elysia `.onParse()` hook to capture the raw request body as a string **before** Elysia's default JSON parser runs. This is required for HMAC-SHA256 signature verification against the `x-notion-signature` header. Do not refactor this to use the parsed body — the signature check will break.

The webhook endpoint handles two distinct cases:

1. **Verification handshake:** Notion sends a POST with `verification_token`. The server stores it in memory so it can be retrieved via `GET /webhook/notion/token`.
2. **Event dispatch:** Notion sends signed event payloads. The handler verifies the HMAC signature (when `NOTION_WEBHOOK_SECRET` is set) then triggers a full or partial sync based on the event type.

`NOTION_WEBHOOK_SECRET` is the HMAC signing secret configured in Notion's webhook settings. It is **not** the same as the `verification_token`.

### Bearer auth bypass list

The auth middleware in `src/index.ts` skips authentication for:

- `GET /health`
- Any path starting with `/openapi`
- Any path starting with `/webhook/notion`

Add new public paths to this list in `src/index.ts`, not in individual route files.

### CORS

CORS is configured in `src/index.ts` to allow requests from ChatGPT Custom GPT origins by default:

- `https://chat.openai.com`
- `https://chatgpt.com`

Override with the `CORS_ORIGINS` env var (comma-separated list). Allowed methods: `GET`, `POST`, `OPTIONS`. Allowed headers: `Content-Type`, `Authorization`. Credentials are enabled.

### Notion category discovery

Categories are **not** hardcoded. `getDynamicCategories()` in `src/notion.ts` traverses the Notion block tree rooted at `NOTION_PAGE_ID` (up to 5 levels deep), collecting every `child_database` block as a category. This means adding a new database to the Notion page automatically adds a new category on the next sync — no code changes required.

### Sentry error tracking

`src/instrument.ts` must be imported as the very first statement in `src/index.ts` to ensure Sentry is initialised before any other module. Error tracking is only active when `SENTRY_DSN` is set.

---

## Database schema

Four tables defined in `src/db/schema.ts`:

- **`categories`** — HR topic categories (e.g. Recruiting, Compliance). Primary key is a slug string (e.g. `recruiting`).
- **`topics`** — Sub-topics within a category. Primary key is a composite slug (e.g. `recruiting--conducting-reference-checks--02b0893c`).
- **`prompts`** — Individual HR prompts. Each belongs to a topic. Auto-increment integer primary key.
- **`sync_log`** — Records each sync operation (`started`, `completed`, or `failed`) with timestamps.

All foreign keys use `onDelete: 'cascade'`.

### Drizzle row type naming

`src/db/schema.ts` exports inferred row types with a `Row` suffix to avoid naming collisions with the application-layer types in `src/types.ts`:

```ts
export type CategoryRow = typeof categories.$inferSelect;
export type TopicRow    = typeof topics.$inferSelect;
export type PromptRow   = typeof prompts.$inferSelect;
export type SyncLogRow  = typeof syncLog.$inferSelect;
```

Do not rename these back to `Category`, `Topic`, etc. — those names are already used in `src/types.ts` for different shapes.

---

## Environment variables

Copy `.env.example` to `.env` before running locally.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NOTION_TOKEN` | Yes (prod) | — | Notion Internal Integration Secret (`secret_...`) |
| `NOTION_PAGE_ID` | Yes (prod) | — | Root Notion page ID containing the HR knowledge base |
| `TURSO_DATABASE_URL` | No | falls back to `file:./local.db` | Turso libSQL connection URL |
| `TURSO_AUTH_TOKEN` | No | — | Turso database auth token |
| `API_KEY` | No | — | When set, all endpoints require `Authorization: Bearer <API_KEY>`. Set the same value in ChatGPT Custom GPT authentication. |
| `NOTION_WEBHOOK_SECRET` | No | — | HMAC signing secret for Notion webhook signature verification. Set after configuring the webhook. |
| `DOMAIN` | No | — | Production domain (e.g. `hr-prompts-api.vercel.app`). Used in the OpenAPI `servers` field. |
| `PORT` | No | `3000` | HTTP port for local development. Ignored on Vercel. |
| `CACHE_TTL_SECONDS` | No | `300` | Cache TTL in seconds. |
| `CORS_ORIGINS` | No | `https://chat.openai.com,https://chatgpt.com` | Comma-separated list of allowed CORS origins. |
| `RATE_LIMIT_MAX` | No | `60` | Maximum requests per rate-limit window. |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate-limit window duration in milliseconds. |
| `UPSTASH_REDIS_REST_URL` | No | — | Upstash Redis REST URL. When set, replaces the in-memory cache. Recommended for Vercel. |
| `UPSTASH_REDIS_REST_TOKEN` | No | — | Upstash Redis REST token. Required when `UPSTASH_REDIS_REST_URL` is set. |
| `SENTRY_DSN` | No | — | Sentry DSN for error tracking. |
| `LOG_LEVEL` | No | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, or `error`. |
| `NODE_ENV` | No | `development` | Runtime environment: `development`, `production`, or `test`. |
| `GITHUB_REPO` | No | — | GitHub repository slug (used for documentation links). |
| `VERCEL` | — | set by Vercel | Automatically set to `"1"` by Vercel. Triggers production env validation and skips `app.listen()`. |

---

## API endpoints

All responses are JSON. Error responses use the shape `{ error: string, message: string }`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Health check |
| `GET` | `/openapi` | Public | Scalar UI (interactive API docs) |
| `GET` | `/categories` | Bearer | List all categories |
| `GET` | `/categories/:id` | Bearer | Get a category with its topics |
| `GET` | `/topics` | Bearer | List topics (paginated; optional `category_id` filter) |
| `GET` | `/topics/:topic_id` | Bearer | Get a topic with its full prompt list |
| `GET` | `/search` | Bearer | Full-text search across prompts |
| `GET` | `/prompts/random` | Bearer | Get random prompts |
| `GET` | `/summary` | Bearer | Database summary (category / topic / prompt counts) |
| `GET` | `/sync/status` | Bearer | Status and stats of the last Notion sync |
| `POST` | `/sync` | Bearer | Trigger a full Notion sync |
| `POST` | `/webhook/notion` | HMAC | Receive Notion change events |
| `GET` | `/webhook/notion/token` | Public | Retrieve last Notion verification token |

---

## Code conventions

- **TypeScript strict mode** — `tsconfig.json` enables `strict: true`. Fix type errors; do not use `any` or `@ts-ignore`.
- **Biome** — Used for both linting and formatting. Configuration is in `biome.json`. Run `bun run check` before committing.
- **Elysia route files** — Each route file exports a named `Elysia` plugin. All route files are re-exported from `src/routes/index.ts`.
- **No `console.log` in routes** — Use structured responses. `console.log` is acceptable only in `src/index.ts` for startup messages.
- **Schema validation** — Use TypeBox schemas (`src/models.ts`) for all query parameters and response shapes. Do not use plain TypeScript types as Elysia validators.
- **Env vars** — Access all environment variables through `src/env.ts`. Never read `process.env` directly in route or service files.

---

## Type safety rules

The following patterns are forbidden. Biome enforces `noExplicitAny` and `noNonNullAssertion` as errors. TypeScript enforces `noUnusedLocals` and `noUnusedParameters`.

### No `any`, `@ts-ignore`, or `@ts-nocheck`

```ts
// ❌ forbidden
const data: any = ...
// @ts-ignore
// @ts-nocheck
```

### No non-null assertions

Use an explicit null check or early return instead.

```ts
// ❌ forbidden
const id = rows[0]!.id;

// ✅ correct
const row = rows[0];
if (!row) return;
const id = row.id;
```

### No unsafe `as` casts on `unknown` — use type guards

When you receive data of type `unknown` (e.g. parsed JSON from a webhook body), narrow it with a type guard instead of asserting.

```ts
// ❌ forbidden
const entity = raw.entity as Record<string, unknown>;

// ✅ correct
const rawEntity = raw.entity;
const entity =
  typeof rawEntity === "object" && rawEntity !== null && !Array.isArray(rawEntity)
    ? (rawEntity as Record<string, unknown>)
    : undefined;
```

### No redundant casts on Drizzle column values

Drizzle infers TypeScript union types automatically from `{ enum: [...] }` on `text()` columns. Do not cast the value — doing so hides future type errors.

```ts
// Schema: type: text("type", { enum: ["database", "page"] }).notNull()
// Drizzle infers: "database" | "page"

// ❌ forbidden — cast is redundant and hides type errors
getTopicDetailFromNotion(id, category.type as "database" | "page");

// ✅ correct — Drizzle already infers the right type
getTopicDetailFromNotion(id, category.type);
```

### Do not shadow application types with Drizzle row types

`src/db/schema.ts` exports Drizzle-inferred row types with a `Row` suffix (`CategoryRow`, `TopicRow`, `PromptRow`, `SyncLogRow`). Do not rename them to `Category`, `Topic`, `Prompt`, or `SyncLog` — those names are reserved for the application-layer types in `src/types.ts`, which have different shapes.

### Use Notion SDK type guards — never cast Notion response objects

The `@notionhq/client` SDK ships first-class type guard functions. Use them instead of casting. Casting a partial response to a full response silently hides missing fields.

Available guards (verified from `@notionhq/client` type declarations):

| Guard | Narrows to |
|---|---|
| `isFullBlock(response)` | `BlockObjectResponse` |
| `isFullPage(response)` | `PageObjectResponse` |
| `isFullDatabase(response)` | `DatabaseObjectResponse` |
| `isFullDataSource(response)` | `DataSourceObjectResponse` |
| `isFullPageOrDataSource(response)` | `PageObjectResponse \| DataSourceObjectResponse` |
| `isFullUser(response)` | `UserObjectResponse` |
| `isNotionClientError(error)` | `NotionClientError` |

```ts
// ❌ forbidden — unsafe cast, partial responses lack most fields
const block = response as BlockObjectResponse;

// ✅ correct — type guard, skips partial responses safely
const blocks = rawBlocks.filter(isFullBlock);
```

Use `iteratePaginatedAPI` or `collectPaginatedAPI` to handle cursor pagination automatically. Do not implement manual cursor loops.

```ts
// ❌ forbidden — manual pagination loop
let cursor: string | undefined;
do {
  const res = await notion.blocks.children.list({ block_id, start_cursor: cursor });
  cursor = res.next_cursor ?? undefined;
} while (cursor);

// ✅ correct — SDK utility handles pagination
const blocks = await collectPaginatedAPI(notion.blocks.children.list, { block_id });
```

---

## Linting and type checking

Only the tools already configured in the project should be used. Do not add ESLint, Prettier, or other formatters.

```bash
bun run ci          # Biome CI — fails on any lint or format issues
bun tsc --noEmit    # TypeScript type check
```

Both must exit with code 0 before a change is complete.

---

## Commit conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```text
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

- **Subject**: imperative mood, lowercase, no trailing period, 72 characters or fewer.
- **Body**: explain *why*, not *what*. Wrap at 72 characters.
- **Footer**: reference issues (`Closes #12`) or note breaking changes (`BREAKING CHANGE: ...`).

### Types

| Type | When to use |
|---|---|
| `feat` | A new endpoint, feature, or user-facing behaviour |
| `fix` | A bug fix |
| `chore` | Maintenance that does not affect runtime behaviour (dependency updates, config changes) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | A change that improves performance |
| `test` | Adding or updating tests only |
| `docs` | Documentation changes only |
| `ci` | Changes to CI/CD workflows or GitHub Actions |
| `revert` | Reverts a previous commit |

### Scopes (optional)

Use a scope to identify the affected area:

- `routes` — changes to any route handler
- `db` — schema, migrations, or sync logic
- `cache` — cache adapter or in-memory cache
- `auth` — bearer auth middleware
- `webhook` — Notion webhook handler
- `notion` — Notion SDK integration
- `env` — environment variable schema
- `deps` — dependency updates

### Examples

```text
feat(routes): add GET /summary endpoint

fix(webhook): use raw body for HMAC verification

chore(deps): update elysia to 1.4.26

refactor(env): use z.enum for LOG_LEVEL and NODE_ENV

test(webhook): add HMAC signature verification tests

docs: update AGENTS.md with cache-adapter architecture
```

### Before committing

Run the full check suite:

```bash
bun run ci        # Biome lint + format
bun tsc --noEmit  # Type check
bun test          # Unit tests
bun run spell     # Spell check
bun run mdlint    # Markdown lint
```

All commands must exit with code 0 before a commit is pushed.

---

## Documentation

Detailed documentation for each area of the project is in `docs/`:

- [docs/overview.md](./docs/overview.md)
- [docs/getting-started.md](./docs/getting-started.md)
- [docs/environment-variables.md](./docs/environment-variables.md)
- [docs/api-reference.md](./docs/api-reference.md)
- [docs/database.md](./docs/database.md)
- [docs/notion.md](./docs/notion.md)
- [docs/webhook.md](./docs/webhook.md)
- [docs/authentication.md](./docs/authentication.md)
- [docs/custom-gpt.md](./docs/custom-gpt.md)
- [docs/deployment.md](./docs/deployment.md)
