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
   - **Environment Variables**: none required for the default workspace.
3. Settings → Domains → add `speedlearning.com` + `www.speedlearning.com`.
4. At GoDaddy → DNS, follow what Vercel shows (typically `A 76.76.21.21` on the
   apex and `CNAME cname.vercel-dns.com` on `www`).

## V2

- Embed a product video above the form.
- Optional server-side `/api/waitlist` fallback for users who block the CIO
  snippet.
