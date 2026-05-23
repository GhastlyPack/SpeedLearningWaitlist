import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono, Newsreader } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import UtmCapture from "./UtmCapture";
import "./globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal"],
  variable: "--font-serif",
  display: "swap",
});

// Meta Pixel ID. Public — exposed to the browser by design. The matching
// secret CAPI access token lives in META_CAPI_TOKEN (server-only) and is
// read by app/api/meta-capi/route.ts.
const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || "2100944364633594";

// Google Analytics 4 Measurement ID. Public — exposed to the browser by
// design. gtag.js uses this for both pageview tracking and key events.
const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-8MWGMTH7WN";

// Route dev-mode events to GA4 DebugView (Admin → DebugView) instead of
// the regular reporting pipeline so we don't pollute prod numbers while
// iterating locally.
const GA_DEBUG = process.env.NODE_ENV !== "production";

export const metadata: Metadata = {
  title: "SpeedLearning — learn anything in 30 to 60 minutes",
  description:
    "Type a topic. SpeedLearning pulls the best videos, articles, and papers and synthesizes a complete learning library — TLDR, report, slide deck, mind map, flashcards, explainer infographics, deep-dive video, and an AI chat partner. $50 flat. Join the waitlist.",
  metadataBase: new URL("https://speedlearning.com"),
  openGraph: {
    title: "SpeedLearning",
    description:
      "Learn anything in 30 to 60 minutes. Join the waitlist.",
    url: "https://speedlearning.com",
    siteName: "SpeedLearning",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SpeedLearning",
    description:
      "Learn anything in 30 to 60 minutes. Join the waitlist.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Skip marketing trackers (GA, Meta Pixel, Customer.io) on the internal
  // dashboard subdomain so team usage doesn't pollute conversion data.
  const headersList = await headers();
  const host = (headersList.get("host") || "").toLowerCase();
  const isDashSubdomain = host.startsWith("dash.");

  return (
    <html
      lang="en"
      className={`${plex.variable} ${mono.variable} ${serif.variable}`}
    >
      <body>
        {children}
        {!isDashSubdomain && <UtmCapture />}
        {!isDashSubdomain && (
          <>
        <Script
          id="ga4-loader"
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', { debug_mode: ${GA_DEBUG} });
          `}
        </Script>
        <Script id="meta-pixel" strategy="beforeInteractive">
          {`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');
          `}
        </Script>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
          {/* Customer.io browser snippet intentionally removed.
              All CIO writes now go through /api/cio-track (server-side
              Track API) — bypasses ad blockers AND the fragile CDP -> Journeys
              destination that lost data on 2026-05-21. */}
          </>
        )}
      </body>
    </html>
  );
}
