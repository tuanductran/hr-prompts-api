# Notion integration

The project reads HR content from a Notion workspace. Notion is the **source of truth** — all content is authored there, then synced into Turso for fast API reads.

## How it works

1. `POST /sync` (or a webhook event) triggers a sync.
2. `getDynamicCategories()` in `src/notion.ts` traverses the Notion block tree rooted at `NOTION_PAGE_ID`, recursively finding every `child_database` block (up to 5 levels deep). Each database becomes a category. **Categories are discovered dynamically — there is no hardcoded list.**
3. For each category database, the sync queries its rows (topics) via the Notion Data Sources API.
4. For each topic page, the sync reads the page's block content to extract prompt text.
5. All data is upserted into Turso via Drizzle ORM inside a single database transaction.

## Notion API version

This project uses Notion API version `2025-09-03`. It relies on the `data_sources` field on database objects and the `notion.dataSources.query()` method introduced in that version.

## Required setup

### 1. Create a Notion integration

1. Go to [https://www.notion.so/profile/integrations](https://www.notion.so/profile/integrations)
2. Click **+ New integration**
3. Name it (e.g. "HR Prompts API") and select your workspace
4. Under **Capabilities**: enable **Read content**; user info is not required
5. Click **Save** and copy the **Internal Integration Secret** (`secret_...`)
6. Set it as `NOTION_TOKEN` in `.env`

### 2. Connect the integration to your workspace

1. Open the HR knowledge base root page in Notion
2. Click **⋯** (three dots) → **Connections** → **Connect to** → select your integration
3. Connecting to the root page grants access to all child databases automatically

### 3. Set the page ID

Copy the URL of your root HR knowledge base page. The **Page ID** is the hex string at the end of the URL:

```text
https://www.notion.so/My-HR-Knowledge-Base-43c2803e380041b5a577de5aff91d2bf
                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                            This is the Page ID
```

Set it as `NOTION_PAGE_ID` in `.env`.

## Content structure expected in Notion

The sync reads content structured as follows:

- **Root page** (`NOTION_PAGE_ID`) — contains child databases, optionally nested inside columns or sub-pages
- **Category** — each `child_database` block found while traversing the root page
- **Topic** — each row in a category database
- **Topic page** — each topic row has a linked page; the sync reads its blocks:
  - A `heading_2` block with text `"Prompts"` marks the start of the prompt list
  - `numbered_list_item` blocks following that heading are extracted as prompts
  - A `heading_2` block with text `"About"` followed by a paragraph becomes the description

## Triggering a sync

Trigger the first full sync after setup:

```bash
curl -X POST http://localhost:3000/sync
# If API_KEY is set, add: -H "Authorization: Bearer <API_KEY>"
```

Subsequent syncs happen automatically via the [Notion webhook](./webhook.md) when content changes.

To manually re-sync at any time:

```bash
curl -X POST https://<your-domain>/sync \
  -H "Authorization: Bearer <API_KEY>"
```

## Sync behaviour

- **Category discovery:** Performed fresh at the start of each full sync by clearing the in-memory category cache and re-traversing the Notion block tree.
- **Upsert:** Existing categories and topics are updated in place, not duplicated.
- **Prompts:** On each sync, all prompts for a topic are deleted and re-inserted to preserve the correct order from Notion.
- **Transaction:** All DB writes for a full sync happen inside a single SQLite transaction (`behavior: "immediate"`) to avoid partial writes.
- **Sync log:** Every sync is recorded in the `sync_log` table with status, timestamps, and result counts (or error message on failure).
- **Cache invalidation:** After a successful full sync, the entire cache is cleared so subsequent reads reflect the new data.
- **Notion rate limits:** The sync uses `p-limit` to cap concurrent Notion API calls at 5. Notion `429` errors are surfaced as `429` responses from the API.
