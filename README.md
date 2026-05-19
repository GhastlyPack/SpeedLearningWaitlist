# SpeedLearning Waitlist

V1 landing page for [speedlearning.com](https://speedlearning.com). Email signup
flows into Customer.io via the in-browser JS snippet.

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- IBM Plex Sans / JetBrains Mono / Newsreader via `next/font`
- No CSS framework — design tokens in `app/globals.css` per the SpeedLearning
  design system

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in your CIO Site ID
npm run dev
```

Opens on http://localhost:3000.

## Environment variables

| Var | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_CIO_SITE_ID` | yes (prod) | Customer.io workspace Site ID. Public, safe to expose to the browser. |
| `NEXT_PUBLIC_CIO_REGION` | no | `us` (default) or `eu` — controls which CIO CDN the snippet pulls from. |

Both are read by `app/layout.tsx`. If `NEXT_PUBLIC_CIO_SITE_ID` is unset, the
snippet is not injected and the form will log a dev-mode warning on submit.

## Customer.io wiring

On successful submit the client calls:

```js
_cio.identify({
  id: email,
  email,
  created_at: <unix>,
  waitlist_signed_up_at: <unix>,
  waitlist_source: "speedlearning.com",
});
_cio.track("waitlist_signup", { source: "speedlearning.com", signed_up_at: <unix> });
```

In Customer.io:
- People will appear under the email as their `id`.
- Create a segment on `waitlist_source = speedlearning.com` (or filter by the
  `waitlist_signup` event) for the launch broadcast.

## Deploy

1. Push to `GhastlyPack/SpeedLearningWaitlist`.
2. Import the repo into Vercel (no build config needed — auto-detected as
   Next.js).
3. Add `NEXT_PUBLIC_CIO_SITE_ID` (and optionally `NEXT_PUBLIC_CIO_REGION`) to
   Vercel → Settings → Environment Variables for **Production**, **Preview**,
   **Development**.
4. Add the `speedlearning.com` domain in Vercel → Settings → Domains.
5. At GoDaddy, point DNS to Vercel:
   - Apex (`speedlearning.com`): `A` record → `76.76.21.21`
   - `www`: `CNAME` → `cname.vercel-dns.com.`
   - Vercel will show the exact records to use; trust their UI over this README
     if they differ.

## V2

- Embed a video on the lander above the form.
- Optional: server-side `/api/waitlist` fallback for users with ad blockers
  that strip the CIO snippet.
