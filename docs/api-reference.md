# API reference

Base URL (local): `http://localhost:3000`  
Base URL (production): `https://hr-prompts-api.vercel.app`

Interactive docs (Scalar UI): `GET /openapi`

## Authentication

When `API_KEY` is set, all endpoints (except `/health`, `/openapi`, `/webhook/notion`) require a Bearer token:

```http
Authorization: Bearer <API_KEY>
```

---

## System

### `GET /health`

Returns the current server status. No authentication required.

**Response 200**

```json
{
  "status": "ok",
  "timestamp": "2026-02-28T00:00:00.000Z"
}
```

---

## Categories

### `GET /categories`

Returns all 20 HR categories with their topic counts.

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

## Topics

### `GET /topics`

Returns a paginated list of topics, optionally filtered by category.

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `category_id` | string | — | Filter by category slug (e.g. `recruiting`) |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Results per page (max 100) |

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

---

### `GET /topics/:topic_id`

Returns a single topic with all its prompts.

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

Full-text search across all 1,511 prompts. Results are grouped by topic.

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | **required** | Search query (minimum 2 characters) |
| `category_id` | string | — | Limit search to a specific category |
| `limit` | number | `10` | Maximum number of topics to return |

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

**Response 400**

```json
{
  "error": "Query too short",
  "message": "Parameter 'q' must be at least 2 characters."
}
```

---

## Prompts

### `GET /prompts/random`

Returns random HR prompts. Useful for inspiration and suggestions in the ChatGPT interface.

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `count` | number | `5` | Number of random prompts to return |
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

---

## Sync

### `GET /sync/status`

Returns the status and stats of the most recent Notion sync.

**Response 200**

```json
{
  "lastSync": {
    "status": "completed",
    "startedAt": "2026-02-28T00:00:00.000Z",
    "completedAt": "2026-02-28T00:01:00.000Z",
    "details": { "categories": 20, "topics": 262, "prompts": 1511 }
  }
}
```

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

---

## Webhook

### `GET /webhook/notion/token`

Returns the last verification token sent by Notion during webhook setup. No authentication required.

**Response 200**

```json
{
  "token": "v1:xxxx...",
  "receivedAt": "2026-02-28T02:30:00.000Z"
}
```

**Response 404**

```json
{
  "error": "Not found",
  "message": "No verification token received yet. Trigger it from Notion integration settings."
}
```

---

### `POST /webhook/notion`

Receives webhook events from Notion. Used for real-time content updates. No Bearer token required — authentication uses HMAC-SHA256 if `NOTION_WEBHOOK_SECRET` is set.

See [Webhook setup](./webhook.md) for configuration details.

---

## Error responses

All endpoints return errors in the same format:

```json
{
  "error": "<short error type>",
  "message": "<human-readable description>"
}
```

| Status | Error | When |
|---|---|---|
| 400 | Validation error | Invalid query parameters |
| 401 | Unauthorized | Missing or invalid Bearer token |
| 404 | Not found | Route or resource does not exist |
| 422 | Validation error | Request body failed schema validation |
| 429 | Too many requests | Rate limit exceeded (60 req/min per IP) |
| 500 | Internal server error | Unexpected server error |
| 502 | Notion unavailable | Notion API is temporarily down |
| 504 | Timeout | Notion API request timed out |
