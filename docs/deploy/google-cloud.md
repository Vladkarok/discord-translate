# Google Cloud Translation setup

You end up with a `GOOGLE_TRANSLATE_API_KEY` value, restricted to the
Cloud Translation API, paid against the recurring monthly free credit
(~500K NMT characters/month at the time of writing — verify current
pricing at https://cloud.google.com/translate/pricing).

A billing account with a card on file is required even for free-tier
use. The bot's `GOOGLE_MONTHLY_CHAR_LIMIT` env (default `500000`) is
the local hard stop that refuses requests before they hit Google —
that's your primary protection against accidental overage.

## 1. Create or pick a GCP project

1. https://console.cloud.google.com → top bar project picker →
   **New Project**.
2. Name: anything (e.g. `discord-translate-bot`). Organization +
   billing account: pick one. **Create**.
3. Wait for creation → switch the picker to that project.

## 2. Enable the Cloud Translation API

1. **APIs & Services → Library**.
2. Search **Cloud Translation API** → click it → **Enable**.
3. (One-time) If billing isn't linked yet, the console will prompt.
   Link a billing account; the free credit applies automatically
   to qualifying NMT calls.

## 3. Create an API key

1. **APIs & Services → Credentials → Create Credentials → API key**.
2. The key appears in a modal. Copy it — this is
   `GOOGLE_TRANSLATE_API_KEY` for your `.env`.
3. **Edit API key** (pencil icon) to lock it down:
   - **Application restrictions:** *None* is fine for a
     server-side bot. If you want extra safety, *IP addresses*
     restricted to your VPS public IP works.
   - **API restrictions:** **Restrict key** → select only
     **Cloud Translation API**. This is the important one —
     even if the key leaks, an attacker can only spend translate
     quota, not access other GCP services.
4. **Save**.

## 4. Set a billing alert (recommended)

1. **Billing → Budgets & alerts → Create budget**.
2. Scope: the project you just made.
3. Amount: $1 (or whatever feels safe — the free credit covers
   ~500K NMT chars, beyond which it's $20/M chars).
4. Alert at 50% / 90% / 100% by email.

This catches misconfiguration (cache disabled, runaway loop, key
leak) before it costs real money.

## 5. Smoke test from your machine (optional)

```bash
curl -X POST \
  "https://translation.googleapis.com/language/translate/v2?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q":"Hello","target":"fr","format":"text"}'
```

Expected response includes `"translatedText": "Bonjour"`. If you get
`PERMISSION_DENIED` the API isn't enabled on the project; if
`API_KEY_INVALID` the key string is wrong or revoked.

## 6. Paste into `.env`

```
GOOGLE_TRANSLATE_API_KEY=AIza...
GOOGLE_MONTHLY_CHAR_LIMIT=500000
```

`500000` matches the free-tier monthly credit. If you intentionally
want to allow paid overflow (don't, in v1), raise this and live with
the consequences.

## Cost expectations at v1 scale

- ~10 messages translated per evening, 30 evenings, 3 users
- average message ~150 chars, average 1.5 translations per click
  (cache deduplicates panel re-runs at the same language pair)
- ≈ 30 × 10 × 3 × 150 × 1.5 ≈ **200K chars/month**
- Well under the free 500K. The bot will refuse before billing kicks in.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Bot logs `provider.error kind=auth` | API key invalid, revoked, or missing the Cloud Translation API in its restrictions list |
| Bot logs `provider.error kind=quota_exceeded` | You hit GCP-side quota (rare under free tier); reduce `GOOGLE_MONTHLY_CHAR_LIMIT` and investigate why local accounting drifted |
| `/quota status` keeps showing 0 | Reservation rollback bug (file a bug) or no calls have succeeded yet |
| GCP Console shows charges | Set up the budget alert in step 4; check whether `GOOGLE_MONTHLY_CHAR_LIMIT` matches the free-tier ceiling |
