# Webhook

Notion can send webhook events to the API whenever content changes. This triggers an automatic re-sync so the Turso database stays current without manual intervention.

## How it works

1. A content change in Notion triggers a signed `POST` to `/webhook/notion`.
2. The handler verifies the request signature using HMAC-SHA256 (when `NOTION_WEBHOOK_SECRET` is set).
3. If the signature is valid, the handler dispatches a partial or full sync based on the event type.

### Event dispatch rules

| Event type | Action |
|---|---|
| `page.content_updated`, `page.properties_updated`, `data_source.content_updated` | Partial sync — re-syncs only the affected Notion page |
| `data_source.created`, `data_source.deleted`, `data_source.schema_updated`, `data_source.undeleted`, `page.deleted`, `page.undeleted` | Full sync — re-syncs all categories and topics |
| Any other event | No action; returns `{ received: true }` |

## HMAC signature verification

When `NOTION_WEBHOOK_SECRET` is set, every incoming event is verified:

```text
HMAC-SHA256(key=NOTION_WEBHOOK_SECRET, data=<raw request body>)
```

The computed signature is compared against the `x-notion-signature` header sent by Notion.
Requests with an invalid or missing signature are rejected with `401 Unauthorized`.

> **Important:** The raw request body (before JSON parsing) is used for HMAC computation. The server captures it via an Elysia `.onParse()` hook before the body stream is consumed. Do not refactor this — the signature check will break.

`NOTION_WEBHOOK_SECRET` is the **HMAC signing secret** from Notion's webhook settings. It is **not** the `verification_token` used during webhook activation (see the setup steps below).

---

## Setup on localhost (for testing)

Notion webhooks require a public HTTPS URL. Use a tunneling tool to expose your local server:

**Option A — ngrok:**

```bash
brew install ngrok
ngrok http 3000
# → https://abc123.ngrok.io
```

**Option B — Cloudflare Tunnel:**

```bash
brew install cloudflare/cloudflare/cloudflared
cloudflared tunnel --url http://localhost:3000
# → https://abc123.trycloudflare.com
```

---

## Configuring the webhook in Notion

### Step 1 — Register the webhook

1. Go to [https://www.notion.so/profile/integrations](https://www.notion.so/profile/integrations)
2. Open your integration → **Webhooks** tab
3. Click **Add webhook**
4. Set the URL to: `https://<your-tunnel-or-domain>/webhook/notion`
5. Select the events to subscribe to
6. Click **Save**

### Step 2 — Complete the verification handshake

Notion immediately sends a `POST` request to your endpoint with a `verification_token` field. The server stores this token in memory automatically.

Retrieve it:

```bash
curl http://localhost:3000/webhook/notion/token
```

Response:

```json
{
  "token": "v1:xxxx...",
  "receivedAt": "2026-03-05T02:30:00.000Z"
}
```

Enter the `token` value into the Notion webhook UI when prompted to verify ownership.

### Step 3 — Set the signing secret

After verification, Notion provides an **HMAC signing secret** (separate from the `verification_token`). Set it as `NOTION_WEBHOOK_SECRET` in `.env`:

```dotenv
NOTION_WEBHOOK_SECRET=<signing_secret_from_notion>
```

Without this, the server still receives and processes events but skips signature verification.

---

## Testing a webhook event locally

Without `NOTION_WEBHOOK_SECRET` set, the signature check is skipped. You can simulate any event:

```bash
curl -X POST http://localhost:3000/webhook/notion \
  -H "Content-Type: application/json" \
  -d '{"type":"page.content_updated","entity":{"id":"<notion-page-id>"}}'
```

Expected response: `{ "received": true }`

---

## Production setup

When deploying to Vercel, update the webhook URL in Notion to your production domain:

```text
https://<your-domain>/webhook/notion
```

Set `NOTION_WEBHOOK_SECRET` in the Vercel environment variables to the signing secret from Notion.

After updating the URL, Notion will send a new verification request. Follow the verification handshake steps above using the production endpoint.
