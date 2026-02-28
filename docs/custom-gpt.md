# ChatGPT Custom GPT

The HR Expert Assistant is designed to work as a [ChatGPT Custom GPT](https://openai.com/blog/introducing-gpts) with Actions — allowing ChatGPT to query the API in real time during a conversation.

## Files

| File | Purpose |
|---|---|
| `gpt.txt` | Full Custom GPT configuration — copy the relevant sections into the GPT builder |
| `prompt-gpt.txt` | System prompt to paste into the GPT's **Instructions** field |
| `actions-gpt.yaml` | OpenAPI spec to import as a GPT **Action** |

## Setup steps

### 1. Deploy the API

Deploy to Vercel (see [Deployment](./deployment.md)) and get your production URL, e.g.:

```text
https://hr-prompts-api.vercel.app
```

### 2. Update the OpenAPI spec

Edit `actions-gpt.yaml` and replace the server URL:

```yaml
servers:
  - url: https://hr-prompts-api.vercel.app
    description: Production API
```

### 3. Create the Custom GPT

1. Go to [https://chatgpt.com](https://chatgpt.com) → your account → **My GPTs** → **Create a GPT**
2. Switch to the **Configure** tab

### 4. Set the name and description

- **Name:** HR Expert Assistant
- **Description:** Helps HR professionals with prompts, frameworks, and guidance across all HR domains.

### 5. Paste the instructions

Open `prompt-gpt.txt` and copy the full contents into the **Instructions** field.

### 6. Add the Action

1. Click **Add action** (or **Create new action**)
2. Click **Import from URL** — paste your `actions-gpt.yaml` URL, or click **Paste schema** and paste the file contents directly
3. Under **Authentication**, set:
   - **Authentication type:** API Key
   - **Auth type:** Bearer
   - **API Key:** paste the value of your `API_KEY` environment variable
4. Click **Save**

### 7. Set the privacy policy URL

In the GPT builder, scroll down to **Additional settings** → **Privacy policy**:

```text
https://github.com/tuanductran/hr-prompts-api/blob/main/PRIVACY.md
```

This is **required** by OpenAI for any GPT that uses Actions with an external API.

### 8. Test and publish

Use the preview panel on the right to test queries like:

- "What are some good interview questions for a senior engineer?"
- "Give me prompts for a performance improvement plan"
- "Show me HR prompts about conflict resolution"

When satisfied, click **Save** → choose **Only me** or **Anyone with a link**.

## How the GPT uses the API

The GPT sends HTTP requests to the API based on the conversation. The OpenAPI spec in `actions-gpt.yaml` defines the available operations:

| User intent | API call |
|---|---|
| "Show me HR categories" | `GET /categories` |
| "What topics are in Recruiting?" | `GET /topics?category_id=recruiting` |
| "Give me prompts about onboarding" | `GET /search?q=onboarding` |
| "Random HR prompt ideas" | `GET /prompts/random` |
| "Prompts for topic X" | `GET /topics/:topic_id` |

## Updating the GPT after API changes

If you add new endpoints, update `actions-gpt.yaml` and re-import the schema in the GPT builder under **Actions → Edit → Import**.
