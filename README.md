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

## V2

- Embed a product video above the form.
- Optional server-side `/api/waitlist` fallback for users who block the CIO
  snippet.
