# Authentication

All API endpoints (except `/health`, `/openapi`, and `/webhook/notion`) are protected by an optional Bearer token.

## Enabling authentication

Set the `API_KEY` environment variable:

```dotenv
API_KEY=your-secret-token-here
```

When `API_KEY` is set, every request to a protected endpoint must include:

```http
Authorization: Bearer your-secret-token-here
```

When `API_KEY` is not set, the API is open and no authentication is required.

## Generating a secure token

Use one of the following methods to generate a cryptographically secure random token:

**With Bun:**

```bash
bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**With Node.js:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**With OpenSSL:**

```bash
openssl rand -hex 32
```

Example output:

```text
a3f8d2e1c4b7a9e0f6d5c2b1a8e7f4d3c0b9a6e5f2d1c8b7a4e3f0d9c6b5a2
```

Copy this value into `.env` as `API_KEY`.

## Setting the token in ChatGPT Custom GPT

1. Open your Custom GPT in ChatGPT → **Configure** → **Actions**
2. Click the action → **Authentication**
3. Set **Authentication type** to `API Key`
4. Set **Auth type** to `Bearer`
5. Paste the same value from `API_KEY` into the **API Key** field
6. Save

ChatGPT will now include `Authorization: Bearer <token>` in every API request.

## Unauthorized response

When authentication fails, the API returns:

```json
HTTP/1.1 401 Unauthorized

{
  "error": "Unauthorized",
  "message": "Invalid or missing API key."
}
```

## Endpoints that do not require authentication

| Endpoint | Reason |
|---|---|
| `GET /health` | Health check |
| `GET /openapi` | Interactive API docs |
| `POST /webhook/notion` | Notion webhook (uses HMAC instead of Bearer) |
| `GET /webhook/notion/token` | Retrieve last webhook verification token |
