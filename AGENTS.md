# AGENTS.md

This file documents the project for AI coding agents. Read it before making changes.

---

## Project overview

`hr-prompts-api` is a REST API that serves an HR prompt knowledge base. It is built with [Elysia](https://elysiajs.com/) running on [Bun](https://bun.sh/). Data originates in Notion and is synced into a [Turso](https://turso.tech/) SQLite database (via [Drizzle ORM](https://orm.drizzle.team/)).

The API powers an [HR Expert Assistant Custom GPT](./gpt.txt) on ChatGPT.

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Framework | Elysia v1 |
| Database | Turso (libSQL) — local fallback: `file:./local.db` |
| ORM | Drizzle ORM (`drizzle-orm/libsql/http`) |
| Schema validation | TypeBox via `drizzle-typebox` |
| Notion sync | `@notionhq/client` v5 |
| Linter / formatter | Biome |
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
```

Before committing, run `bun run check` then `bun tsc --noEmit` to verify there are no lint or type errors.

---

## Project structure

```text
src/
  index.ts          # App entry point — registers plugins, middleware, routes
  models.ts         # Shared Elysia response models (TypeBox)
  types.ts          # Shared TypeScript types
  cache.ts          # In-memory cache with TTL (used for categories/topics)
  notion.ts         # Notion SDK re-exports and type guards
  db/
    index.ts        # Drizzle client — connects to Turso or local SQLite
    schema.ts       # Four tables: categories, topics, prompts, sync_log
    sync.ts         # Full sync logic: pulls Notion data, upserts into DB
  routes/
    index.ts        # Re-exports all route modules
    categories.ts   # GET /categories, GET /categories/:id
    topics.ts       # GET /topics, GET /topics/:id
    prompts.ts      # GET /prompts/random
    search.ts       # GET /search
    sync.ts         # POST /sync
    webhook.ts      # POST /webhook/notion
drizzle/            # Generated SQL migrations
docs/               # Project documentation (Markdown)
actions-gpt.yaml    # OpenAPI spec for ChatGPT Custom GPT Actions
gpt.txt             # ChatGPT Custom GPT configuration instructions
prompt-gpt.txt      # System prompt for the Custom GPT
PRIVACY.md          # Privacy policy (required by ChatGPT Custom GPT)
```

---

## Key architecture decisions

### Database transport: HTTP, not WebSocket

`src/db/index.ts` uses `drizzle-orm/libsql/http`. Do not change this to WebSocket. HTTP transport is more reliable on Vercel serverless functions. The local fallback uses `file:./local.db` when `TURSO_DATABASE_URL` is not set.

### Vercel serverless entry point

`src/index.ts` exports `default app`. It only calls `app.listen()` when `process.env.VERCEL !== "1"`. This pattern is required for Vercel serverless — do not remove this condition.

### Webhook HMAC verification

`src/routes/webhook.ts` uses an Elysia `.onParse()` hook to capture the raw request body as a string **before** Elysia's default JSON parser runs. This is required for HMAC-SHA256 signature verification. Do not refactor this to use the parsed body — the signature check will break.

### Bearer auth bypass list

The auth middleware in `src/index.ts` skips authentication for:

- `GET /health`
- Any path starting with `/openapi`
- Any path starting with `/webhook/notion`

Add new public paths to this list in `src/index.ts`, not in individual route files.

### CORS

CORS is restricted to `https://chat.openai.com` and `https://chatgpt.com` for Custom GPT Actions. Do not widen the CORS origin list without a clear reason.

---

## Database schema

Four tables defined in `src/db/schema.ts`:

- **`categories`** — HR topic categories (for example, Recruiting, Compliance). Primary key is a slug string (for example, `recruiting`).
- **`topics`** — Sub-topics within a category. Primary key is a composite slug (for example, `recruiting--conducting-reference-checks--02b0893c`).
- **`prompts`** — Individual HR prompts. Each belongs to a topic. Auto-increment integer primary key.
- **`sync_log`** — Records each sync operation (started, completed, or failed) with timestamps.

All foreign keys use `onDelete: 'cascade'`.

---

## Environment variables

Copy `.env.example` to `.env` before running locally.

| Variable | Required | Description |
|---|---|---|
| `NOTION_TOKEN` | Yes | Notion integration secret token |
| `NOTION_PAGE_ID` | Yes | Root Notion page ID containing the HR knowledge base |
| `TURSO_DATABASE_URL` | No | Turso database URL (falls back to `file:./local.db`) |
| `TURSO_AUTH_TOKEN` | No | Turso auth token (required when using Turso) |
| `API_KEY` | No | Bearer token for endpoint authentication (leave empty to disable) |
| `WEBHOOK_SECRET` | No | HMAC secret for Notion webhook signature verification |
| `PORT` | No | HTTP port (default: `3000`) |
| `CACHE_TTL_SECONDS` | No | In-memory cache TTL in seconds (default: `300`) |

---

## API endpoints

All responses are JSON. Error responses use the shape `{ error: string, message: string }`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Health check |
| `GET` | `/openapi` | Public | Scalar UI (interactive API docs) |
| `GET` | `/categories` | Bearer | List all categories |
| `GET` | `/categories/:id` | Bearer | Get a category with its topics |
| `GET` | `/topics` | Bearer | List all topics (with optional `categoryId` filter) |
| `GET` | `/topics/:id` | Bearer | Get a topic with its prompts |
| `GET` | `/search` | Bearer | Full-text search across prompts |
| `GET` | `/prompts/random` | Bearer | Get random prompts |
| `POST` | `/sync` | Bearer | Trigger a full Notion sync |
| `POST` | `/webhook/notion` | HMAC | Receive Notion change events |

---

## Code conventions

- **TypeScript strict mode** — `tsconfig.json` enables `strict: true`. Fix type errors; do not use `any` or `@ts-ignore`.
- **Biome** — Used for both linting and formatting. Configuration is in `biome.json`. Run `bun run check` before committing.
- **Elysia route files** — Each route file exports a named `Elysia` plugin. All route files are re-exported from `src/routes/index.ts`.
- **No console.log in routes** — Use structured responses. `console.log` is acceptable only in `src/index.ts` for startup messages.
- **Schema validation** — Use TypeBox schemas (via `drizzle-typebox` or `@sinclair/typebox`) for all query parameters and response shapes. Do not use plain TypeScript types as Elysia validators.

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

When you receive data of type `unknown` (for example, parsed JSON from a webhook body), narrow it with a type guard instead of asserting.

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

Drizzle infers TypeScript union types automatically from `{ enum: [...] }` on `text()` columns ([Drizzle docs — SQLite text](https://orm.drizzle.team/docs/column-types/sqlite#text)). Do not cast the value — doing so hides future type errors.

```ts
// Schema: type: text("type", { enum: ["database", "page"] }).notNull()
// Drizzle infers: "database" | "page"

// ❌ forbidden — cast is redundant and hides type errors
getTopicDetailFromNotion(id, category.type as "database" | "page");

// ✅ correct — Drizzle already infers the right type
getTopicDetailFromNotion(id, category.type);
```

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
- `cache` — in-memory cache
- `auth` — bearer auth middleware
- `webhook` — Notion webhook handler
- `notion` — Notion SDK integration
- `deps` — dependency updates

### Examples

```text
feat(routes): add GET /categories/:id endpoint

fix(search): use and() instead of or() in Drizzle query

chore(deps): update elysia to 1.4.26

test(webhook): add HMAC signature verification tests

docs: add webhook.md to docs/

ci: add Biome and bun test steps to CI workflow
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
