# Notion integration

The project reads HR content from a Notion workspace. Notion is the **source of truth** — all content is authored there, then synced into Turso.

## How it works

1. The `src/notion.ts` file defines the list of 20 HR categories, each with a Notion database ID or page ID.
2. On sync, the server calls the Notion API to list pages inside each database/page.
3. For each topic page, it reads the body blocks to extract prompt text.
4. All data is upserted into Turso via Drizzle ORM.

## Required setup

### 1. Create a Notion integration

1. Go to [https://www.notion.so/profile/integrations](https://www.notion.so/profile/integrations)
2. Click **+ New integration**
3. Name it (e.g. "HR Prompts API"), select your workspace
4. Set **Capabilities:** Read content, No user info
5. Click **Save** and copy the **Internal Integration Secret** (`secret_...`)
6. Set it as `NOTION_TOKEN` in `.env`

### 2. Connect the integration to your workspace

For the API to read your Notion content, you must connect the integration to each top-level page:

1. Open the HR knowledge base root page in Notion
2. Click **⋯** (three dots) in the top right
3. Go to **Connections** → **Connect to** → select your integration
4. Repeat for each sub-database if needed (or connect to the parent page which grants access to children)

### 3. Set the page ID

Copy the URL of your root HR knowledge base page. The **Page ID** is the hex string at the end of the URL:

```text
https://www.notion.so/My-HR-Knowledge-Base-43c2803e380041b5a577de5aff91d2bf
                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                            This is the Page ID
```

Set it as `NOTION_PAGE_ID` in `.env`.

## Triggering a sync

After setup, trigger the first full sync:

```bash
curl -X POST http://localhost:3000/sync
```

Subsequent syncs happen automatically via the [Notion webhook](./webhook.md) when content changes.

To manually re-sync at any time:

```bash
curl -X POST http://localhost:3000/sync \
  -H "Authorization: Bearer <API_KEY>"
```

## Sync behaviour

- **Upsert:** Existing categories and topics are updated, not duplicated.
- **Prompts:** On each sync, all prompts for a topic are deleted and re-inserted to preserve order.
- **Sync log:** Every sync is recorded in the `sync_log` table with status and timestamps.
- **Rate limits:** The Notion API has rate limits. The sync process pauses automatically when a 429 is received.
