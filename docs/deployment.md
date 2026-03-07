# Deployment

The project is configured to deploy on [Vercel](https://vercel.com) with the Bun runtime.

## Prerequisites

- Vercel account (free Hobby tier works for low traffic)
- Vercel CLI: `bun add -g vercel`
- All [environment variables](./environment-variables.md) ready
- Turso database created and migrations applied (see [Getting started](./getting-started.md))

## Deploy to Vercel

### First deploy

```bash
cd hr-prompts-api
vercel deploy
```

Follow the prompts:

- **Set up and deploy:** Yes
- **Project name:** `hr-prompts-api` (or your choice)
- **Directory:** `./` (current directory)

### Promote to production

```bash
vercel --prod
```

Subsequent deploys:

```bash
vercel --prod
```

## Environment variables

Set all required env vars in the Vercel dashboard:

1. Go to your project → **Settings** → **Environment Variables**
2. Add each variable for the **Production** environment

Minimum required for a working deployment:

| Variable | Value |
|---|---|
| `NOTION_TOKEN` | `secret_...` |
| `NOTION_PAGE_ID` | your Notion page ID |
| `TURSO_DATABASE_URL` | `libsql://...turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJ...` |
| `API_KEY` | your generated secret token |
| `DOMAIN` | your Vercel domain, e.g. `hr-prompts-api.vercel.app` |

Recommended for production reliability:

| Variable | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | from Upstash dashboard |
| `UPSTASH_REDIS_REST_TOKEN` | from Upstash dashboard |
| `SENTRY_DSN` | from Sentry project settings |
| `NOTION_WEBHOOK_SECRET` | from Notion webhook settings (add after webhook is configured) |

Or set via the CLI:

```bash
vercel env add NOTION_TOKEN production
vercel env add NOTION_PAGE_ID production
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add API_KEY production
vercel env add DOMAIN production
```

## Vercel configuration

The project includes `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "bunVersion": "1.x"
}
```

This tells Vercel to use the Bun runtime. The entry point is `src/index.ts` (defined as `"module"` in `package.json`). The app exports `default app` and skips `app.listen()` when `VERCEL=1`.

## After deploying

### 1. Verify the deployment

```bash
curl https://<your-domain>/health
# → {"status":"ok","timestamp":"..."}
```

### 2. Run the initial data sync

```bash
curl -X POST https://<your-domain>/sync \
  -H "Authorization: Bearer <API_KEY>"
```

This may take a few minutes depending on the number of topics in Notion.

### 3. Configure the Notion webhook

Update the webhook URL in Notion to your production domain:

```text
https://<your-domain>/webhook/notion
```

Follow the verification steps in [Webhook setup](./webhook.md) and set `NOTION_WEBHOOK_SECRET` in Vercel env vars.

### 4. Update the ChatGPT Custom GPT

In the GPT builder → **Actions** → update the server URL to your production domain. See [Custom GPT](./custom-gpt.md) for details.

## Vercel function limits

Vercel's free (Hobby) plan limits relevant to this project:

| Limit | Hobby | Pro |
|---|---|---|
| Execution timeout | 10 seconds | 15 seconds |
| Memory | 1 GB | 1 GB |
| Requests/month | 100,000 | unlimited |

> **Note:** The full Notion sync (`POST /sync`) can take longer than 10 seconds on first run if there are many topics. Options:
>
> - Run the initial sync from your local machine (`bun run dev` + `curl POST /sync`) and rely on webhooks for subsequent updates.
> - Upgrade to the Vercel Pro plan.
> - Use Upstash Redis so cached data survives cold starts and reduces the need for frequent re-syncs.
