# Webhook

Notion can send a webhook event to the API whenever content changes. This triggers an automatic re-sync so the Turso database stays current without manual intervention.

## How it works

1. Notion sends a `POST` request to `/webhook/notion` when a page in the connected workspace is updated.
2. The handler verifies the request signature using HMAC-SHA256 (when `NOTION_WEBHOOK_SECRET` is set).
3. If the signature is valid, it triggers a partial or full sync.

## HMAC verification

When `NOTION_WEBHOOK_SECRET` is set, every incoming webhook is verified:

```text
HMAC-SHA256(key=NOTION_WEBHOOK_SECRET, data=<raw request body>)
```

The computed signature is compared against the `x-notion-signature` header sent by Notion.  
Requests with an invalid or missing signature are rejected with `401 Unauthorized`.

> **Important:** The raw request body (before JSON parsing) must be used for HMAC computation. The server captures the raw bytes via an `.onParse()` hook for this reason.

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

## Configuring the webhook in Notion

1. Go to [https://www.notion.so/profile/integrations](https://www.notion.so/profile/integrations)
2. Open your integration → **Webhooks** tab
3. Click **Add webhook**
4. Set the URL to: `https://<your-tunnel-or-domain>/webhook/notion`
5. Select the events to subscribe to (e.g. `page.updated`, `database.updated`)
6. Click **Save**
7. Notion will send a **verification request** to your endpoint. The server automatically responds to it.
8. Copy the **Verification token** shown after verification — set it as `NOTION_WEBHOOK_SECRET` in `.env`

## Environment variable

```dotenv
NOTION_WEBHOOK_SECRET=v1:<verification_token_from_notion>
```

## Testing the webhook locally

After setup, you can simulate a webhook event:

```bash
curl -X POST http://localhost:3000/webhook/notion \
  -H "Content-Type: application/json" \
  -d '{"type":"page.updated","entity":{"id":"<notion-page-id>"}}'
```

Without `NOTION_WEBHOOK_SECRET` set, the signature check is skipped (useful for local testing).

## Production

When deploying to Vercel, update the webhook URL in Notion to your production domain:

```text
https://<your-domain>.vercel.app/webhook/notion
```

Update `NOTION_WEBHOOK_SECRET` in the Vercel environment variables to match the verification token from Notion.
