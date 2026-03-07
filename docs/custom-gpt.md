# ChatGPT Custom GPT

The HR Expert Assistant is designed to work as a [ChatGPT Custom GPT](https://openai.com/blog/introducing-gpts) with Actions — allowing ChatGPT to query the API in real time during a conversation.

## Prerequisites

- A deployed API instance with `DOMAIN` set (see [Deployment](./deployment.md))
- An `API_KEY` configured on the server and in the GPT builder

## Setup steps

### 1. Deploy the API

Deploy to Vercel and confirm the production URL responds:

```bash
curl https://<your-domain>/health
# → {"status":"ok","timestamp":"..."}
```

### 2. Create the Custom GPT

1. Go to [https://chatgpt.com](https://chatgpt.com) → your account icon → **My GPTs** → **Create a GPT**
2. Switch to the **Configure** tab

### 3. Set the name and description

- **Name:** HR Expert Assistant
- **Description:** Helps HR professionals with prompts, frameworks, and guidance across all HR domains.

### 4. Write the instructions

Paste a system prompt into the **Instructions** field describing how the GPT should behave. For example:

```text
You are an HR Expert Assistant with access to a curated knowledge base of HR prompts
across recruiting, compliance, performance management, and other HR domains.

When a user asks for HR guidance, prompts, or frameworks:
1. Use the API to search or browse the knowledge base.
2. Return relevant prompts directly — do not paraphrase or summarize unless asked.
3. If the user mentions a specific topic or category, look it up first.
4. Use GET /summary to give users an overview of the available content.
```

### 5. Add the Action

1. Click **Add action** → **Create new action**
2. Click **Import from URL** and paste:

   ```text
   https://<your-domain>/openapi.json
   ```

   Or click **Paste schema** and paste the raw OpenAPI JSON from `https://<your-domain>/openapi.json`.

3. Under **Authentication**:
   - **Authentication type:** API Key
   - **Auth type:** Bearer
   - **API Key:** paste the value of your `API_KEY` environment variable

4. Click **Save**

### 6. Set the privacy policy URL

In the GPT builder → **Additional settings** → **Privacy policy**:

```text
https://github.com/tuanductran/hr-prompts-api/blob/main/PRIVACY.md
```

This is required by OpenAI for any GPT that uses Actions with an external API.

### 7. Test and publish

Use the preview panel to test queries such as:

- "What are some good interview questions for a senior engineer?"
- "Give me prompts for a performance improvement plan"
- "Show me HR prompts about conflict resolution"
- "What categories are available in the knowledge base?"

When satisfied, click **Save** → choose **Only me** or **Anyone with a link**.

## How the GPT uses the API

The GPT sends HTTP requests based on the conversation. The OpenAPI spec exposed at `/openapi.json` defines the available operations with descriptive `operationId` names:

| User intent | Operation | API call |
|---|---|---|
| "Show me HR categories" | `listCategories` | `GET /categories` |
| "What topics are in Recruiting?" | `listTopics` | `GET /topics?category_id=recruiting` |
| "Give me prompts about onboarding" | `searchPrompts` | `GET /search?q=onboarding` |
| "Random HR prompt ideas" | `getRandomPrompts` | `GET /prompts/random` |
| "Prompts for topic X" | `getTopicById` | `GET /topics/:topic_id` |
| "How many prompts are there?" | `getSummary` | `GET /summary` |

## Updating the GPT after API changes

If you add new endpoints, the OpenAPI spec at `/openapi.json` updates automatically. Re-import in the GPT builder: **Actions → Edit → Import from URL**.
