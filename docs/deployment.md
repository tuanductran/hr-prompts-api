# Deployment

The project is configured to deploy on [Vercel](https://vercel.com) with Bun runtime.

## Prerequisites

- Vercel account (free tier works)
- Vercel CLI: `bun add -g vercel` or `npm i -g vercel`
- All [environment variables](./environment-variables.md) ready

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

### Subsequent deploys

```bash
vercel --prod
```

## Environment variables

Set all required env vars in the Vercel dashboard:

1. Go to your project → **Settings** → **Environment Variables**
2. Add each variable for the **Production** environment:

| Variable | Value |
|---|---|
| `NOTION_TOKEN` | `secret_...` |
| `NOTION_PAGE_ID` | your Notion page ID |
| `TURSO_DATABASE_URL` | `libsql://...turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJ...` |
| `API_KEY` | your generated secret token |
| `NOTION_WEBHOOK_SECRET` | from Notion webhook setup (add after webhook is configured) |

Or set them via the CLI:

```bash
vercel env add NOTION_TOKEN production
vercel env add NOTION_PAGE_ID production
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add API_KEY production
```

## Vercel configuration

The project includes `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "bunVersion": "1.x"
}
```

This tells Vercel to use the Bun runtime. The app entry point is `src/index.ts` (defined as `"module"` in `package.json`).

## After deploying

### 1. Run the initial data sync

```bash
curl -X POST https://hr-prompts-api.vercel.app/sync \
  -H "Authorization: Bearer <API_KEY>"
```

### 2. Update the Notion webhook URL

In Notion integrations → Webhooks → update the URL to:

```text
https://hr-prompts-api.vercel.app/webhook/notion
```

### 3. Update the OpenAPI spec

Edit `actions-gpt.yaml` — update the `servers.url` to your production domain.

### 4. Update the ChatGPT Custom GPT

In the GPT builder → **Actions** → re-import the updated `actions-gpt.yaml` schema.  
Update the **Privacy policy** URL to `https://github.com/tuanductran/hr-prompts-api/blob/main/PRIVACY.md`.

## Vercel function limits

Vercel's free (Hobby) plan has the following limits relevant to this project:

| Limit | Value |
|---|---|
| Execution time | 10 seconds (Hobby), 15s (Pro) |
| Memory | 1 GB |
| Requests/month | 100,000 |

The full Notion sync (`POST /sync`) may take longer than 10 seconds on first run if there are many topics. Use the Pro plan or run the initial sync from localhost and let webhooks keep it updated from then on.

## Health check

Verify the production deployment:

```bash
curl https://hr-prompts-api.vercel.app/health
# → {"status":"ok","timestamp":"..."}
```
