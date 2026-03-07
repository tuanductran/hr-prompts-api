# Environment variables

Copy `.env.example` to `.env` and fill in the values before running locally.

```bash
cp .env.example .env
```

All environment variables are validated by Zod v4 in `src/env.ts`. Enum fields (`LOG_LEVEL`, `NODE_ENV`, `VERCEL`) will cause an immediate startup error if set to an unrecognized value.

---

## Required in production

These two variables are enforced at startup when running on Vercel (`VERCEL=1`).

| Variable | Description | Example |
|---|---|---|
| `NOTION_TOKEN` | Notion Internal Integration Secret. Create at [notion.so/profile/integrations](https://www.notion.so/profile/integrations). | `secret_abc123...` |
| `NOTION_PAGE_ID` | ID of the root Notion page containing the HR knowledge base. Found in the page URL after the last `/`. | `43c2803e380041b5a577de5aff91d2bf` |

---

## Database

| Variable | Default | Description |
|---|---|---|
| `TURSO_DATABASE_URL` | _(falls back to `file:./local.db`)_ | Turso libSQL connection URL (e.g. `libsql://your-db.turso.io`). When not set, a local SQLite file is used — suitable for development only. |
| `TURSO_AUTH_TOKEN` | _(none)_ | Turso database auth token. Required when `TURSO_DATABASE_URL` is set. Generate with `turso db tokens create <db-name>`. |

---

## Authentication and security

| Variable | Default | Description |
|---|---|---|
| `API_KEY` | _(none)_ | When set, all endpoints (except `/health`, `/openapi`, `/webhook/notion`) require `Authorization: Bearer <API_KEY>`. Set the same value in the ChatGPT Custom GPT Action authentication settings. When not set, the API is open. |
| `NOTION_WEBHOOK_SECRET` | _(none)_ | HMAC-SHA256 signing secret for Notion webhook event verification. This is the signing secret configured in Notion's webhook settings — **not** the `verification_token`. When not set, the signature check is skipped (useful for local testing). |

---

## Cache

| Variable | Default | Description |
|---|---|---|
| `CACHE_TTL_SECONDS` | `300` | Cache TTL in seconds. Applies to both in-memory and Redis cache entries. |
| `UPSTASH_REDIS_REST_URL` | _(none)_ | Upstash Redis REST URL. When set, replaces the in-memory `Map` cache with Redis. Recommended for Vercel (survives cold starts). Create a free database at [console.upstash.com](https://console.upstash.com/). |
| `UPSTASH_REDIS_REST_TOKEN` | _(none)_ | Upstash Redis REST token. Required when `UPSTASH_REDIS_REST_URL` is set. |

---

## Network and CORS

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port for local development. Ignored on Vercel (port binding is handled by the runtime). |
| `CORS_ORIGINS` | `https://chat.openai.com,https://chatgpt.com` | Comma-separated list of allowed CORS origins. Defaults to ChatGPT origins. |
| `RATE_LIMIT_MAX` | `60` | Maximum number of requests allowed per rate-limit window per IP. |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window duration in milliseconds (default: 1 minute). |

---

## Observability

| Variable | Default | Description |
|---|---|---|
| `SENTRY_DSN` | _(none)_ | Sentry DSN for error tracking. When not set, Sentry is inactive. Create a Bun project at [sentry.io](https://sentry.io/). |
| `LOG_LEVEL` | `info` | Pino log level. Accepted values: `trace`, `debug`, `info`, `warn`, `error`. |

---

## OpenAPI and links

| Variable | Default | Description |
|---|---|---|
| `DOMAIN` | _(none)_ | Production domain without protocol (e.g. `hr-prompts-api.vercel.app`). When set, the OpenAPI spec includes a `servers` entry pointing to `https://<DOMAIN>` — required for ChatGPT Custom Actions to know the API base URL. |
| `GITHUB_REPO` | _(none)_ | GitHub repository slug (e.g. `tuanductran/hr-prompts-api`). Used for documentation links. |

---

## Automatically set by Vercel

| Variable | Value | Description |
|---|---|---|
| `VERCEL` | `"1"` | Set automatically by Vercel. Causes the app to skip `app.listen()` and run `validateProductionEnv()` at startup. |
| `NODE_ENV` | `"production"` | Set automatically by Vercel in production deployments. |

---

## Setting variables on Vercel

Set environment variables in the Vercel dashboard: **Project → Settings → Environment Variables**. Select the **Production** environment for each variable.

Or use the Vercel CLI:

```bash
vercel env add NOTION_TOKEN production
vercel env add NOTION_PAGE_ID production
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add API_KEY production
vercel env add DOMAIN production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
```

Do not commit `.env` to git — it is listed in `.gitignore`.
