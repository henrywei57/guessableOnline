# guessableOnline

Monitors `https://beta.guessable.gg/` on a schedule via GitHub Actions and emails
`henry.wh.wei@gmail.com` (via [Resend](https://resend.com)) the moment the site
transitions from down/erroring (502, other 5xx, timeout, network error) back to
accessible.

Note: Resend's free tier only delivers to the account's own signup address unless a
sending domain is verified — that's why alerts go to `henry.wh.wei@gmail.com` (the
Resend account owner) rather than another address. Verify a domain at
resend.com/domains to lift that restriction.

## How it works

- `.github/workflows/check.yml` runs `check.js` every 5 minutes (and on-demand via
  "Run workflow").
- `check.js` fetches `TARGET_URL`, compares the result to `status.json` from the last
  run, and calls the Resend API to send an email **only on the down → up transition**
  (so you get one alert, not one every 5 minutes).
- The updated `status.json` is committed back to the repo so state persists between
  runs (GitHub Actions runners are stateless otherwise).

## One-time setup

1. **Get a Resend API key** (free tier is fine): sign up at
   [resend.com](https://resend.com) → API Keys → Create API Key.
2. **Add repo secrets** (Settings → Secrets and variables → Actions → New repository
   secret), or via `gh`:
   ```
   gh secret set RESEND_API_KEY --body "re_your_key_here"
   ```
   Optional overrides (defaults shown):
   ```
   gh secret set ALERT_EMAIL_TO --body "henry.wh.wei@gmail.com"
   gh secret set ALERT_EMAIL_FROM --body "Guessable Monitor <onboarding@resend.dev>"
   ```
   `onboarding@resend.dev` works out of the box with no domain verification, but Resend
   may rate-limit or restrict it — verify your own sending domain in Resend for
   production use.
3. That's it — the workflow starts running on its schedule once the secret is set.

## Manual run / testing

- Trigger a check immediately: repo → Actions → "Monitor beta.guessable.gg" → "Run
  workflow".
- Run locally:
  ```
  RESEND_API_KEY=re_xxx node check.js
  ```

## Notes

- GitHub's schedule cron isn't guaranteed to the minute (5–15 min slippage under load
  is normal).
- "Down" = network/timeout error or any HTTP 5xx response (502 included).
