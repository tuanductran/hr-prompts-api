# Overview

## What this project does

HR Expert Assistant is a REST API that serves a curated knowledge base of **1,511 HR prompts** across **20 HR categories** and **262 topics**. It is designed to power a [ChatGPT Custom GPT](./custom-gpt.md) via OpenAI Actions.

## Architecture

```text
ChatGPT Custom GPT
       │  HTTP (Bearer token)
       ▼
  Elysia API  (Bun runtime)
       │
       ├── Turso DB (libSQL / SQLite)  ← primary data source for reads
       │         ▲
       │         │  full sync on startup / POST /sync
       └── Notion ─────────────────────── webhook → POST /webhook/notion
```

### Components

| Component | Technology | Purpose |
|---|---|---|
| HTTP server | [Elysia](https://elysiajs.com) on [Bun](https://bun.sh) | Handles all API requests |
| Database | [Turso](https://turso.tech) (distributed libSQL/SQLite) | Stores categories, topics, prompts |
| ORM | [Drizzle ORM](https://orm.drizzle.team) | Type-safe SQL queries and migrations |
| Content source | [Notion](https://notion.so) | Maintains the HR prompt knowledge base |
| OpenAPI docs | [@elysiajs/openapi](https://elysiajs.com/plugins/openapi) + Scalar UI | Interactive API docs |
| Auth | Bearer token via [@elysiajs/bearer](https://elysiajs.com/plugins/bearer) | Protects API endpoints |

## Data flow

1. **Initial sync:** On first run, `POST /sync` pulls all data from Notion into Turso.
2. **API reads:** All read requests (`/categories`, `/topics`, `/search`, etc.) query Turso — never Notion directly. This keeps response times under 50ms.
3. **Live updates:** When content changes in Notion, it sends a webhook to `POST /webhook/notion`. The handler re-syncs the affected data automatically.
4. **ChatGPT:** The Custom GPT calls the API using the OpenAPI spec defined in `actions-gpt.yaml`. Authentication uses a Bearer token.

## Project structure

```text
hr-prompts-api/
├── src/
│   ├── index.ts          # App entry point — registers all plugins and routes
│   ├── notion.ts         # Notion SDK client and data-fetch helpers
│   ├── models.ts         # TypeBox schemas shared across routes
│   ├── types.ts          # TypeScript type definitions
│   ├── cache.ts          # In-memory cache with TTL
│   ├── db/
│   │   ├── index.ts      # Drizzle client (Turso HTTP)
│   │   ├── schema.ts     # Table definitions
│   │   └── sync.ts       # Full-sync and webhook-sync logic
│   └── routes/
│       ├── index.ts      # Re-exports all route modules
│       ├── categories.ts # GET /categories
│       ├── topics.ts     # GET /topics, GET /topics/:id
│       ├── search.ts     # GET /search
│       ├── prompts.ts    # GET /prompts/random
│       ├── sync.ts       # GET /sync/status, POST /sync
│       └── webhook.ts    # GET /webhook/notion/token, POST /webhook/notion
├── drizzle/              # Auto-generated SQL migration files
├── docs/                 # This documentation
├── actions-gpt.yaml      # OpenAPI spec for ChatGPT Actions
├── gpt.txt               # Custom GPT configuration instructions
├── prompt-gpt.txt        # Custom GPT system prompt
├── drizzle.config.ts     # Drizzle Kit config
├── biome.json            # Biome linter/formatter config
└── vercel.json           # Vercel deployment config
```
