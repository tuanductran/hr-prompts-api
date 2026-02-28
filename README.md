# HR Prompts API

REST API built with [Elysia](https://elysiajs.com) on [Bun](https://bun.sh) that serves an HR prompt knowledge base synced from Notion. Powers the **HR Expert Assistant** Custom GPT on ChatGPT.

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Framework | [Elysia v1](https://elysiajs.com) |
| Database | [Turso](https://turso.tech) (libSQL) — local fallback: `file:./local.db` |
| ORM | [Drizzle ORM](https://orm.drizzle.team) |
| Data source | [Notion API `2025-09-03`](https://developers.notion.com/reference) via `@notionhq/client` v5 |
| API docs | [@elysiajs/openapi](https://elysiajs.com/plugins/openapi) (Scalar UI) |
| Deploy | [Vercel](https://vercel.com) (serverless) |

## Setup

```bash
# 1. Copy env file and fill in your values
cp .env.example .env

# 2. Install dependencies
bun install

# 3. Apply database migrations (first run only)
bun run db:migrate

# 4. Start dev server with hot reload
bun run dev
```

Open [http://localhost:3000/openapi](http://localhost:3000/openapi) for interactive API docs.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NOTION_TOKEN` | Yes | Notion integration secret (`secret_...`) |
| `NOTION_PAGE_ID` | Yes | Root Notion page ID containing the HR knowledge base |
| `TURSO_DATABASE_URL` | No | Turso database URL — falls back to `file:./local.db` |
| `TURSO_AUTH_TOKEN` | No | Turso auth token — required when using Turso |
| `API_KEY` | No | Bearer token to protect all endpoints — leave empty to disable |
| `WEBHOOK_SECRET` | No | HMAC-SHA256 secret for verifying Notion webhook payloads |
| `PORT` | No | HTTP port (default: `3000`) |
| `CACHE_TTL_SECONDS` | No | In-memory cache TTL in seconds (default: `300`) |

See [docs/environment-variables.md](./docs/environment-variables.md) for detailed setup instructions.

## Endpoints

All responses are JSON. Protected endpoints require `Authorization: Bearer <API_KEY>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Health check |
| `GET` | `/openapi` | Public | Scalar UI (interactive API docs) |
| `GET` | `/categories` | Bearer | List all HR categories |
| `GET` | `/categories/:id` | Bearer | Get a category with its topics |
| `GET` | `/topics` | Bearer | List topics (optional `?category_id=`) |
| `GET` | `/topics/:topic_id` | Bearer | Get a topic with all its prompts |
| `GET` | `/search?q=` | Bearer | Full-text search across all prompts |
| `GET` | `/prompts/random` | Bearer | Get random HR prompts |
| `GET` | `/sync/status` | Bearer | Last sync status and stats |
| `POST` | `/sync` | Bearer | Trigger a full Notion sync |
| `GET` | `/webhook/notion/token` | Bearer | Retrieve last Notion verification token |
| `POST` | `/webhook/notion` | HMAC | Receive Notion webhook events |

## Notion integration

The knowledge base is stored in Notion and synced to Turso via `POST /sync`. To set up:

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create an integration
2. Copy the **Internal Integration Token** → set as `NOTION_TOKEN`
3. Open your Notion page → **Share** → invite the integration
4. Copy the page ID from the URL → set as `NOTION_PAGE_ID`
5. Run `POST /sync` to populate the database

See [docs/notion.md](./docs/notion.md) and [docs/webhook.md](./docs/webhook.md) for details.

## ChatGPT Custom GPT

This API powers the HR Expert Assistant Custom GPT. To connect it:

1. Deploy to a public URL (see [docs/deployment.md](./docs/deployment.md))
2. In ChatGPT → **Configure** → **Actions** → upload `actions-gpt.yaml`
3. Set the server URL in `actions-gpt.yaml` to your deployed domain
4. Set authentication to **Bearer token** and enter your `API_KEY`
5. Add the privacy policy URL pointing to your hosted `PRIVACY.md`

See [docs/custom-gpt.md](./docs/custom-gpt.md) for step-by-step instructions.

## Commands

```bash
bun run dev          # Start with hot reload
bun run start        # Start without hot reload
bun run build        # Compile to dist/

bun run lint         # Biome lint
bun run format       # Biome format (auto-fixes)
bun run check        # Biome check + fix
bun run ci           # Biome CI (no writes)

bun run db:generate  # Generate Drizzle migration from schema changes
bun run db:migrate   # Apply pending migrations
bun run db:studio    # Open Drizzle Studio (local DB browser)
```

## Documentation

Full project documentation is in [docs/](./docs/):

- [Overview](./docs/overview.md)
- [Getting started](./docs/getting-started.md)
- [Environment variables](./docs/environment-variables.md)
- [API reference](./docs/api-reference.md)
- [Database](./docs/database.md)
- [Notion integration](./docs/notion.md)
- [Webhook](./docs/webhook.md)
- [Authentication](./docs/authentication.md)
- [ChatGPT Custom GPT](./docs/custom-gpt.md)
- [Deployment](./docs/deployment.md)

## License

MIT
