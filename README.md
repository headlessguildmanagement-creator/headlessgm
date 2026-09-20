# HeadlessGM

**Headless Guild Management**

A configurable guild management platform for organized gaming communities.

This repository is intentionally separate from the HAVOC Guild Operations production application.

## Current status

Initial repository bootstrap for the HeadlessGM presentation/demo build.

The first production-facing implementation will provide:

- `/` — product/marketing experience
- `/demo` — interactive sample guild-management experience

No HAVOC production data, credentials, Discord webhooks, or Supabase secrets belong in this repository.


## Billing integration

HeadlessGM uses Lemon Squeezy as the subscription billing provider. The current test-mode catalog is mapped in `lib/billing/plans.mjs`.

Server environment variables:

- `LEMON_SQUEEZY_API_KEY`
- `LEMON_SQUEEZY_STORE_ID`
- `LEMON_SQUEEZY_WEBHOOK_SECRET`
- `LEMON_SQUEEZY_TEST_MODE=true`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

The webhook callback is `/api/billing/webhook`. Never commit API keys, webhook secrets, service-role keys, banking details, or identity documents.
