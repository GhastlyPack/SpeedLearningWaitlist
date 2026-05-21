import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono, Newsreader } from "next/font/google";
import Script from "next/script";
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

// Customer.io CDP (Data Pipelines) write key. Public — exposed to the browser
// by design. Override via NEXT_PUBLIC_CIO_WRITE_KEY in Vercel if it ever
// rotates.
const CIO_WRITE_KEY =
  process.env.NEXT_PUBLIC_CIO_WRITE_KEY || "c53bf992a3f95d7fa03f";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plex.variable} ${mono.variable} ${serif.variable}`}
    >
      <body>
        {children}
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
        <Script id="meta-pixel" strategy="afterInteractive">
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
        <Script id="cio-cdp-snippet" strategy="afterInteractive">
          {`
            !function(){var i="cioanalytics",analytics=(window[i]=window[i]||[]);if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware"];analytics.factory=function(e){return function(){var t=Array.prototype.slice.call(arguments);t.unshift(e);analytics.push(t);return analytics}};for(var e=0;e<analytics.methods.length;e++){var key=analytics.methods[e];analytics[key]=analytics.factory(key)}analytics.load=function(key,e){var t=document.createElement("script");t.type="text/javascript";t.async=!0;t.setAttribute("data-global-customerio-analytics-key",i);t.src="https://cdp.customer.io/v1/analytics-js/snippet/"+key+"/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(t,n);analytics._writeKey=key;analytics._loadOptions=e};analytics.SNIPPET_VERSION="4.15.3";analytics.load("${CIO_WRITE_KEY}");analytics.page();}}();
          `}
        </Script>
      </body>
    </html>
  );
}
