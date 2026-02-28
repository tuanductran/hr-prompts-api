# Privacy Policy

**Last updated: February 28, 2026**

## Summary

This API collects no personal data beyond standard server access logs (IP address, request path, timestamp). No user accounts, no cookies, no tracking. The knowledge base contains only HR prompt content — no user data. Logs are deleted after 30 days.

---

## 1. Overview

This Privacy Policy describes how the HR Expert Assistant API ("Service") collects, uses, and protects information when you use our API or the associated ChatGPT Custom GPT ("HR Expert Assistant").

We are committed to protecting your privacy. The Service is designed to provide access to a read-only HR prompt knowledge base and does not require user registration or store personal information.

---

## 2. Information we collect

The Service collects minimal information necessary to operate:

**API request logs:** When you interact with the API, our server logs standard HTTP request data including IP address, request path, timestamp, and HTTP method. These logs are used solely for debugging, security monitoring, and rate limiting. Logs are retained for up to 30 days and then deleted.

**No personal data:** We do not collect names, email addresses, passwords, payment information, or any other personal identifiers. The Service does not require user accounts or registration.

**No cookies:** The API does not set cookies or use browser storage.

---

## 3. How we use information

We use the information collected solely to:

- Provide and maintain the Service
- Monitor for abuse, security threats, and rate limit violations
- Debug technical issues
- Improve the reliability and performance of the Service

We do not use your information for advertising, profiling, or marketing purposes.

---

## 4. Data storage and security

The HR prompt knowledge base is stored in Turso (a distributed SQLite database). The database contains only publicly available HR knowledge content — no user data is stored in the knowledge base.

API authentication tokens (Bearer tokens) are used to control access. These tokens are managed by the API operator and are not associated with individual end users.

All API communications use HTTPS/TLS encryption. Webhook integrations use HMAC-SHA256 signature verification. Rate limiting is applied to prevent abuse.

---

## 5. Third-party services

The Service integrates with the following third-party services:

**Notion** (notion.so): The source knowledge base is maintained in Notion. Notion's webhook system notifies our API when content changes. Notion's own Privacy Policy applies to data stored in Notion.

**Turso** (turso.tech): The production database is hosted on Turso's infrastructure. Turso's Privacy Policy applies to database hosting.

**Vercel** (vercel.com): The API is deployed on Vercel's serverless infrastructure. Vercel's Privacy Policy applies to hosting and CDN services.

**OpenAI / ChatGPT** (openai.com): The HR Expert Assistant is available as a ChatGPT Custom GPT. When you interact with the Custom GPT, OpenAI's Privacy Policy and Terms of Service apply to your conversation data.

We do not sell, trade, or otherwise transfer your information to any third parties beyond what is necessary to operate the Service.

---

## 6. ChatGPT Custom GPT

The HR Expert Assistant is available as a Custom GPT on ChatGPT. When using this Custom GPT:

- Your conversation messages are processed by OpenAI's systems and subject to OpenAI's Privacy Policy
- The Custom GPT sends search queries and API requests to the HR Expert Assistant API to retrieve HR prompts
- Query parameters (search keywords, category filters) are transmitted to our API as part of normal API operation
- We do not store or log the content of your ChatGPT conversations

Only the API request parameters (for example, search queries like "performance review") are visible to our API server and retained in standard request logs for up to 30 days.

---

## 7. Data retention

**Server logs:** Retained for up to 30 days, then deleted.

**Sync logs:** Records of Notion data synchronisation events (timestamps and counts only) are retained indefinitely for operational purposes.

**Knowledge base content:** HR prompt content is retained as long as the Service operates and is sourced from Notion.

We do not retain any personal data beyond standard server access logs.

---

## 8. Your rights

Since we do not collect personal data beyond standard server logs, most data subject rights (access, rectification, erasure) are not applicable.

If you believe our API has inadvertently collected personal information about you, or if you have questions about your data, please contact us at the email address below. We will respond within 30 days.

Residents of the European Economic Area (EEA), California (CCPA), and other jurisdictions with privacy rights may contact us with any questions or requests.

---

## 9. Children's privacy

The Service is not directed at children under the age of 13 (or 16 in the EEA). We do not knowingly collect personal information from children. If you believe a child has provided personal information to us, please contact us immediately.

---

## 10. Changes to this policy

We may update this Privacy Policy from time to time. When we make significant changes, we will update the "Last updated" date at the top of this document. Continued use of the Service after changes constitutes acceptance of the updated policy.

---

## 11. Contact

If you have any questions, concerns, or requests related to this Privacy Policy, please contact us at:

**Email:** contact@hr-expert-assistant.app

We will respond to all privacy-related inquiries within 30 days.
