# Getting started

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| [Bun](https://bun.sh) | 1.3+ | `curl -fsSL https://bun.sh/install \| bash` |
| [Notion account](https://notion.so) | — | Create a free account |
| [Turso account](https://turso.tech) | — | `brew install tursodatabase/tap/turso` |

## 1. Clone and install

```bash
git clone https://github.com/tuanductran/hr-prompts-api
cd hr-prompts-api
bun install
```

## 2. Create a Turso database

```bash
# Log in (first time only)
turso auth login

# Create a database
turso db create hr-prompts

# Get the connection URL
turso db show hr-prompts --url
# → libsql://hr-prompts-<you>.aws-us-east-1.turso.io

# Create an auth token
turso db tokens create hr-prompts
# → eyJ...
```

## 3. Create a Notion integration

1. Go to [https://www.notion.so/profile/integrations](https://www.notion.so/profile/integrations)
2. Click **New integration** → give it a name (e.g. "HR Prompts API")
3. Under **Capabilities**, enable **Read content**
4. Click **Save** and copy the **Internal Integration Secret** (starts with `secret_`)
5. In your Notion workspace, open the HR knowledge base root page → click **⋯** → **Connections** → **Connect to** → select your integration
6. Copy the page URL — the long hex string after the last `/` is the **Page ID**

## 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with the values from steps 2 and 3. Minimum required:

```dotenv
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_PAGE_ID=43c2803e380041b5a577de5aff91d2bf
TURSO_DATABASE_URL=libsql://hr-prompts-you.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=eyJ...
```

See [Environment variables](./environment-variables.md) for all options.

## 5. Run database migrations

```bash
bun run db:generate   # generate SQL from src/db/schema.ts
bun run db:migrate    # apply to Turso (or local.db if TURSO_DATABASE_URL is not set)
```

## 6. Start the server and sync data

```bash
bun run dev
```

In a second terminal, trigger the initial data sync:

```bash
curl -X POST http://localhost:3000/sync
# If API_KEY is set, add: -H "Authorization: Bearer <your-API_KEY>"
```

Expected response:

```json
{ "success": true, "categories": 20, "topics": 262, "prompts": 1511 }
```

## 7. Verify everything works

```bash
# Health check
curl http://localhost:3000/health
# → {"status":"ok","timestamp":"..."}

# List categories
curl http://localhost:3000/categories

# Search prompts
curl "http://localhost:3000/search?q=performance+review"

# Open the interactive API docs
open http://localhost:3000/openapi
```

## Development scripts

| Command | Description |
|---|---|
| `bun run dev` | Start with hot reload |
| `bun run start` | Start without hot reload |
| `bun run lint` | Run Biome linter |
| `bun run format` | Format all files with Biome |
| `bun run check` | Lint + format (auto-fix) |
| `bun run ci` | Lint check (no writes — for CI) |
| `bun test` | Run unit tests |
| `bun run db:generate` | Generate Drizzle migrations from schema |
| `bun run db:migrate` | Apply migrations to Turso |
| `bun run db:studio` | Open Drizzle Studio (DB browser UI) |
