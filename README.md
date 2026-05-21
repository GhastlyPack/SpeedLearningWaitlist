# SpeedLearning Waitlist

V1 landing page for [speedlearning.com](https://speedlearning.com). Email
signup flows into Customer.io via the in-browser CDP / Data Pipelines snippet
(`cioanalytics`).

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- IBM Plex Sans / JetBrains Mono / Newsreader via `next/font`
- No CSS framework — design tokens in `app/globals.css` per the SpeedLearning
  design system

## Local dev

```bash
npm install
npm run dev
```

Opens on http://localhost:3000. The CIO write key is baked into `app/layout.tsx`
so local submissions hit the live workspace by default. Override with
`NEXT_PUBLIC_CIO_WRITE_KEY` in `.env.local` if you want to point at a different
workspace.

## Customer.io wiring

On successful submit the client calls:

```js
cioanalytics.identify(email, {
  email,
  waitlist_signed_up_at: <ISO>,
  waitlist_source: "speedlearning.com",
});
cioanalytics.track("waitlist_signup", {
  source: "speedlearning.com",
  signed_up_at: <ISO>,
});
```

In Customer.io:
- People appear with the email as their `userId`.
- Build a segment on `waitlist_source = speedlearning.com` (or filter by the
  `waitlist_signup` event) for the launch broadcast.

## Google Analytics 4 (gtag.js)

GA4 is wired browser-side via the standard `gtag.js` snippet in
`app/layout.tsx` and overridable with `NEXT_PUBLIC_GA_MEASUREMENT_ID`. No
secrets, no server-side mirror — the Measurement ID is fully public.

- `page_view` fires automatically on load (Enhanced Measurement is on by
  default in the data stream).
- On a successful waitlist submit, the form fires:
  ```js
  gtag('event', 'waitlist_signup', {
    value: 0,
    currency: 'USD',
    method: 'email_form',
  });
  ```
- `waitlist_signup` must be marked as a **Key event** in
  Admin → Key events for it to count as a conversion.

### Dev mode automatically routes to DebugView

The init call passes `debug_mode: true` whenever `NODE_ENV !== 'production'`,
so events from `npm run dev` show up in GA4 → Admin → DebugView without
needing the Chrome extension or a debug querystring. Prod builds set
`debug_mode: false` so live traffic flows into the normal reports.

### Verifying after deploy

1. **Realtime report:** Reports → Realtime in GA4. Submit through the live
   form; `page_view` and `waitlist_signup` should appear within 10–30s with
   a "Key event" badge next to `waitlist_signup`.
2. **DebugView (dev only):** Admin → DebugView for events fired from `npm
   run dev`.

## Meta Pixel + Conversions API

The lander runs both halves of Meta's tracking spec:

- **Browser pixel** loaded via `app/layout.tsx` — fires `PageView` on load and
  `Lead` on a successful waitlist submit. Pixel ID is baked into the layout as
  a default and is overridable via `NEXT_PUBLIC_META_PIXEL_ID`.
- **Conversions API** at `POST /api/meta-capi` — server-side mirror of the
  same `Lead` event, deduped via a per-submit `event_id` (a UUID generated in
  the browser, sent to both endpoints). Email, first name, and last name are
  SHA-256 hashed before being sent to Meta; client IP and user-agent come from
  request headers; `_fbp` and `_fbc` cookies are read in the browser and
  passed through.

### Required env var (server-only)

| Var | Required | Notes |
| --- | --- | --- |
| `META_CAPI_TOKEN` | yes (for CAPI) | Conversions API access token. Generate in Events Manager → Settings → Conversions API → Generate Access Token. **Never commit this.** Set it in Vercel → Settings → Environment Variables for Production, Preview, and Development. If unset, `/api/meta-capi` is a silent no-op — the browser pixel still works alone. |

### Verifying in Events Manager

After deploying:
1. **Events Manager → Test Events** → enter the deployed URL → submit a real
   email through the form. You should see one `Lead` event arrive with both
   "Browser" and "Server" badges, deduplicated by `event_id`.
2. **Diagnostics** tab should show ≥80% match quality once Automatic Advanced
   Matching is enabled in Settings.

### Enable Automatic Advanced Matching (one-time)

Events Manager → your dataset → **Settings** → toggle **Automatic Advanced
Matching** on. Meta will pull hashed email/first name/last name from the
form fields automatically, on top of what we send server-side.

## Deploy (Vercel)

1. [vercel.com/new](https://vercel.com/new) → Import
   `GhastlyPack/SpeedLearningWaitlist`.
2. Settings:
   - **Vercel Team**: a team where you have create-project permission
     (the VAgents team appears to block creates — switch to your personal
     account or another team).
   - **Application Preset**: Next.js (not Other).
   - **Root Directory**: `./`
   - **Build / Output**: leave defaults.
   - **Environment Variables**:
     - `META_CAPI_TOKEN` — required for Conversions API. Without it, `/api/meta-capi` is a silent no-op. See the Meta Pixel section above.
     - Other env vars are optional overrides (see `.env.example`).
3. Settings → Domains → add `speedlearning.com` + `www.speedlearning.com`.
4. At GoDaddy → DNS, follow what Vercel shows (typically `A 76.76.21.21` on the
   apex and `CNAME cname.vercel-dns.com` on `www`).

## Internal Dashboard (`dash.speedlearning.com`)

Team-facing read-only dashboard rendering signups + GA4 metrics. Served
from the same Next.js app via `middleware.ts`:

- `dash.speedlearning.com/*` → rewritten to `/dashboard/*` (same app)
- HTTP Basic Auth gate on every `/dashboard/*` path using
  `DASHBOARD_PASSWORD` env var
- Marketing trackers (GA, Meta Pixel, Customer.io) are **skipped** on the
  dash subdomain so internal team usage doesn't pollute conversion data

### Data sources

- **GA4 Data API** via `@google-analytics/data` — page views, sessions,
  scrolls, form starts, signup events, daily trend, traffic sources,
  realtime active users
- **Customer.io App API** — total waitlist count + recent signups list

Each loader is wrapped in `Promise.allSettled` so a single API failure
doesn't blank the whole page — affected sections show an error banner
inline.

### Required env vars (all server-only, mark Sensitive in Vercel)

| Var | Purpose |
| --- | --- |
| `DASHBOARD_PASSWORD` | Basic Auth password for any `/dashboard/*` route. |
| `GA_PROPERTY_ID` | GA4 numeric Property ID (NOT the `G-XXXXXXX` Measurement ID). |
| `GOOGLE_APPLICATION_CREDENTIALS_BASE64` | Base64 of the GCP service account JSON key file. Service account must have **Viewer** on the GA4 property. |
| `CIO_APP_API_KEY` | Customer.io App API bearer token (read scopes). |
| `CIO_REGION` | `us` or `eu` (default `us`). |

### Wiring the subdomain

1. Vercel → project → Settings → Domains → add `dash.speedlearning.com`.
2. GoDaddy DNS → add CNAME `dash` → `cname.vercel-dns.com` (or whatever
   Vercel shows).
3. Once DNS resolves, hitting `dash.speedlearning.com` prompts Basic Auth,
   then renders the dashboard.

### Locally

```bash
# In .env.local, set all the dashboard env vars above.
npm run dev
# Then hit http://localhost:3000/dashboard (you'll get the Basic Auth prompt)
```

## V2 ideas

- Embed a product video above the form.
- Optional server-side `/api/waitlist` fallback for users who block the CIO
  snippet.
- Migrate GA Data API auth from JSON key to Workload Identity Federation
  (no static credential).
- Add Meta Marketing API to the dashboard (Lead counts, audience sizes)
  once a Facebook App is set up.
