# API reference

Base URL (local): `http://localhost:3000`

Base URL (production): set `DOMAIN` env var — the OpenAPI spec will reflect it automatically.

Interactive docs (Scalar UI): `GET /openapi`

## Authentication

When `API_KEY` is set, all endpoints (except `/health`, `/openapi`, and `/webhook/notion/*`) require a Bearer token:

```http
Authorization: Bearer <API_KEY>
```

See [Authentication](./authentication.md) for details.

---

## Error responses

All endpoints return errors in the same format:

```json
{
  "error": "<short error type>",
  "message": "<human-readable description>"
}
```

| Status | When |
|---|---|
| `400` | Query parameter failed handler-level validation (e.g. blank search query) |
| `401` | Missing or invalid Bearer token |
| `404` | Route or resource does not exist |
| `422` | Request failed TypeBox schema validation |
| `429` | Rate limit exceeded (default: 60 req/min per IP) |
| `500` | Unexpected server error |
| `502` | Notion API is temporarily unavailable |
| `503` | Invalid or missing Notion integration token |
| `504` | Notion API request timed out |

---

## System

### `GET /health`

Returns the current server status. No authentication required.

**Response 200**

```json
{
  "status": "ok",
  "timestamp": "2026-03-05T00:00:00.000Z"
}
```

---

## Categories

### `GET /categories`

Returns all HR categories with their topic counts.

**Response 200**

```json
{
  "categories": [
    {
      "id": "recruiting",
      "name": "Recruiting",
      "description": "Topics with individual prompt collections",
      "topicCount": 18
    }
  ]
}
```

---

### `GET /categories/:id`

Returns a single category with all its topics.

**Path parameters**

| Parameter | Description |
|---|---|
| `id` | Category slug from `GET /categories` (e.g. `recruiting`) |

**Response 200**

```json
{
  "id": "recruiting",
  "name": "Recruiting",
  "description": "Topics with individual prompt collections",
  "topics": [
    {
      "id": "recruiting--conducting-reference-checks--02b0893c",
      "name": "Conducting Reference Checks",
      "categoryId": "recruiting",
      "categoryName": "Recruiting",
      "promptCount": 7
    }
  ]
}
```

**Response 404**

```json
{
  "error": "Category not found",
  "message": "No category found with id: <id>"
}
```

---

## Topics

### `GET /topics`

Returns a paginated list of topics, optionally filtered by category.

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `category_id` | string | — | Filter by category slug (e.g. `recruiting`) |
| `page` | number | `1` | Page number (minimum: 1) |
| `limit` | number | `20` | Results per page (minimum: 1, maximum: 100) |

**Response 200**

```json
{
  "topics": [
    {
      "id": "recruiting--conducting-reference-checks--02b0893c",
      "name": "Conducting Reference Checks",
      "categoryId": "recruiting",
      "categoryName": "Recruiting",
      "promptCount": 7
    }
  ],
  "total": 262,
  "page": 1,
  "limit": 20
}
```

**Response 422** — returned when `page` or `limit` fail TypeBox validation.

---

### `GET /topics/:topic_id`

Returns a single topic with its complete list of prompts.

**Path parameters**

| Parameter | Description |
|---|---|
| `topic_id` | Topic ID from `GET /topics` |

**Response 200**

```json
{
  "id": "recruiting--conducting-reference-checks--02b0893c",
  "name": "Conducting Reference Checks",
  "categoryId": "recruiting",
  "categoryName": "Recruiting",
  "description": "",
  "promptCount": 7,
  "prompts": [
    { "number": 1, "text": "What are the most important qualities..." },
    { "number": 2, "text": "How should I structure..." }
  ]
}
```

**Response 404**

```json
{
  "error": "Topic not found",
  "message": "No topic found with id: <topic_id>"
}
```

---

## Search

### `GET /search`

Full-text search across all prompts. Results are grouped by topic.

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | **required** | Search query (minimum 2 characters) |
| `category_id` | string | — | Limit search to a specific category |
| `limit` | number | `10` | Maximum number of topics to return (maximum: 50) |

**Response 200**

```json
{
  "query": "performance review",
  "totalResults": 5,
  "results": [
    {
      "topicId": "performance-management--...",
      "topicName": "Performance Reviews",
      "categoryId": "performance-management",
      "categoryName": "Performance Management",
      "matchedPrompts": [
        { "number": 1, "text": "How do I conduct an effective performance review..." }
      ]
    }
  ]
}
```

**Response 400** — `q` is blank or contains only whitespace.

**Response 422** — `q` is shorter than 2 characters (TypeBox `minLength` validation).

---

## Prompts

### `GET /prompts/random`

Returns random HR prompts. Useful for inspiration and suggestions.

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `count` | number | `5` | Number of random prompts (minimum: 1, maximum: 20) |
| `category_id` | string | — | Limit to a specific category |

**Response 200**

```json
{
  "prompts": [
    {
      "topicId": "training-development--...",
      "topicName": "Onboarding New Employees",
      "categoryId": "training-development",
      "categoryName": "Training & Development",
      "matchedPrompts": [
        { "number": 1, "text": "What should be included in a 30-60-90 day plan..." }
      ]
    }
  ]
}
```

**Response 422** — `count` exceeds 20.

---

## Summary

### `GET /summary`

Returns the total count of categories, topics, and prompts currently in the database.

**Response 200**

```json
{
  "categories": 20,
  "topics": 262,
  "prompts": 1511
}
```

---

## Sync

### `GET /sync/status`

Returns the status and stats of the most recent Notion sync.

**Response 200**

```json
{
  "lastSync": {
    "status": "completed",
    "startedAt": "2026-03-05T00:00:00.000Z",
    "completedAt": "2026-03-05T00:01:00.000Z",
    "details": { "categories": 20, "topics": 262, "prompts": 1511 }
  }
}
```

`lastSync` is `null` when no sync has been run. `details` is a counts object on success or an error string on failure.

---

### `POST /sync`

Triggers a full re-sync of all Notion content into the Turso database. Requires authentication if `API_KEY` is set.

**Response 200**

```json
{
  "success": true,
  "categories": 20,
  "topics": 262,
  "prompts": 1511
}
```

**Response 500** — sync failed; `message` contains the error.

---

## Webhook

### `GET /webhook/notion/token`

Returns the last `verification_token` sent by Notion during webhook setup. No authentication required.

**Response 200**

```json
{
  "token": "v1:xxxx...",
  "receivedAt": "2026-03-05T02:30:00.000Z"
}
```

**Response 404** — no verification request has been received yet.

---

### `POST /webhook/notion`

Receives webhook events from Notion. No Bearer token required. When `NOTION_WEBHOOK_SECRET` is set, the HMAC-SHA256 signature in `x-notion-signature` is verified.

See [Webhook setup](./webhook.md) for full configuration details.

**Response 200**

```json
{ "received": true }
```

**Response 401** — signature verification failed.
