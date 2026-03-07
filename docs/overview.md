# Overview

## What this project does

HR Expert Assistant is a REST API that serves a curated knowledge base of HR prompts across multiple HR categories and topics. It is designed to power a [ChatGPT Custom GPT](./custom-gpt.md) via OpenAI Actions.

## Architecture

```text
ChatGPT Custom GPT
       │  HTTP (Bearer token)
       ▼
  Elysia API  (Bun runtime, Vercel serverless)
       │
       ├── Turso DB (libSQL / SQLite)  ← primary data source for all reads
       │         ▲
       │         │  POST /sync  (full sync on demand)
       └── Notion ─────────────────────── webhook → POST /webhook/notion
```

### Components

| Component | Technology | Purpose |
|---|---|---|
| HTTP server | [Elysia v1](https://elysiajs.com) on [Bun](https://bun.sh) | Handles all API requests |
| Database | [Turso](https://turso.tech) (distributed libSQL/SQLite) | Stores categories, topics, prompts |
| ORM | [Drizzle ORM](https://orm.drizzle.team) | Type-safe SQL queries and migrations |
| Content source | [Notion](https://notion.so) | Maintains the HR prompt knowledge base |
| Cache | In-memory `Map` (dev) / [Upstash Redis](https://upstash.com) (prod) | Reduces DB round-trips |
| OpenAPI docs | [@elysiajs/openapi](https://elysiajs.com/plugins/openapi) + Scalar UI | Interactive API docs at `/openapi` |
| Auth | Bearer token via [@elysiajs/bearer](https://elysiajs.com/plugins/bearer) | Protects API endpoints |
| Error tracking | [Sentry](https://sentry.io) | Captures unhandled exceptions in production |

## Data flow

1. **Initial sync:** `POST /sync` pulls all data from Notion into Turso. Categories are discovered dynamically by traversing the Notion page tree — no hardcoded lists.
2. **API reads:** All read requests (`/categories`, `/topics`, `/search`, etc.) query Turso — never Notion directly. Responses are cached (in-memory or Redis) to keep latency low.
3. **Live updates:** When content changes in Notion, it sends a webhook to `POST /webhook/notion`. The handler verifies the HMAC signature and triggers a partial or full re-sync automatically.
4. **ChatGPT:** The Custom GPT calls the API using the OpenAPI spec served at `/openapi`. Authentication uses a Bearer token.

## Project structure

```text
hr-prompts-api/
├── src/
│   ├── index.ts          # App entry point — registers all plugins and routes
│   ├── env.ts            # Zod v4 env-var schema and production validation
│   ├── models.ts         # TypeBox schemas shared across routes
│   ├── types.ts          # Application-layer TypeScript types
│   ├── cache.ts          # In-memory TTL cache (Map-based)
│   ├── cache-adapter.ts  # Cache abstraction: in-memory (dev) or Upstash Redis (prod)
│   ├── notion.ts         # Notion SDK client and dynamic category/topic helpers
│   ├── logger.ts         # Pino structured logger
│   ├── instrument.ts     # Sentry initialisation (imported first in index.ts)
│   ├── db/
│   │   ├── index.ts      # Drizzle HTTP client (Turso or local SQLite)
│   │   ├── schema.ts     # Table definitions and inferred Row types
│   │   └── sync.ts       # Full sync and partial (page-level) sync logic
│   └── routes/
│       ├── index.ts      # Re-exports all route plugins
│       ├── categories.ts # GET /categories, GET /categories/:id
│       ├── topics.ts     # GET /topics, GET /topics/:topic_id
│       ├── search.ts     # GET /search
│       ├── prompts.ts    # GET /prompts/random
│       ├── summary.ts    # GET /summary
│       ├── sync.ts       # GET /sync/status, POST /sync
│       └── webhook.ts    # GET /webhook/notion/token, POST /webhook/notion
├── drizzle/              # Auto-generated SQL migration files
├── docs/                 # This documentation
├── tests/                # Bun unit tests
├── biome.json            # Biome linter/formatter config
├── drizzle.config.ts     # Drizzle Kit config
├── vercel.json           # Vercel deployment config
└── .env.example          # Environment variable template
```
