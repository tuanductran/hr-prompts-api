# Environment variables

Copy `.env.example` to `.env` and fill in the required values before running the server.

```bash
cp .env.example .env
```

## Required

| Variable | Description | Example |
|---|---|---|
| `NOTION_TOKEN` | Notion Internal Integration Secret. Create at [notion.so/profile/integrations](https://www.notion.so/profile/integrations). | `secret_abc123...` |
| `NOTION_PAGE_ID` | ID of the Notion page that contains the HR knowledge base. Found in the page URL after the last `/`. | `43c2803e380041b5a577de5aff91d2bf` |
| `TURSO_DATABASE_URL` | libSQL connection URL for your Turso database. | `libsql://hr-skills-you.aws-us-east-1.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso database auth token. Generate with `turso db tokens create <db-name>`. | `eyJhbGci...` |

## Optional

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on locally. On Vercel, this is ignored. |
| `API_KEY` | _(none)_ | When set, all API endpoints require `Authorization: Bearer <API_KEY>`. If not set, the API is public. Set the same value in the ChatGPT Custom GPT Action authentication settings. |
| `NOTION_WEBHOOK_SECRET` | _(none)_ | When set, incoming webhook events from Notion are verified using HMAC-SHA256. Set this after configuring the Notion webhook. See [Webhook](./webhook.md). |
| `CACHE_TTL_SECONDS` | `300` | In-memory cache TTL in seconds. Cached responses skip the database query. |

## Vercel

When deploying to Vercel, set all environment variables in the **Vercel project dashboard → Settings → Environment Variables**. Do not commit `.env` to git.

The `VERCEL=1` environment variable is automatically set by Vercel. The server uses this to skip calling `app.listen()` (Vercel handles the port binding).
