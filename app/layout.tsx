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

export const metadata: Metadata = {
  title: "SpeedLearning — learn anything, free, from the greatest minds on earth",
  description:
    "Stop paying course gurus thousands for what's already free. SpeedLearning summarizes any topic and presents it in the way you learn best. Join the waitlist.",
  metadataBase: new URL("https://speedlearning.com"),
  openGraph: {
    title: "SpeedLearning",
    description:
      "Learn anything, free, from the greatest minds on earth. Join the waitlist.",
    url: "https://speedlearning.com",
    siteName: "SpeedLearning",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SpeedLearning",
    description:
      "Learn anything, free, from the greatest minds on earth. Join the waitlist.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteId = process.env.NEXT_PUBLIC_CIO_SITE_ID;
  const region = (process.env.NEXT_PUBLIC_CIO_REGION || "us").toLowerCase();
  const trackerSrc =
    region === "eu"
      ? "https://assets.customer.io/assets/track-eu.js"
      : "https://assets.customer.io/assets/track.js";

  return (
    <html lang="en" className={`${plex.variable} ${mono.variable} ${serif.variable}`}>
      <body>
        {children}
        {siteId ? (
          <Script id="cio-snippet" strategy="afterInteractive">
            {`
              var _cio = _cio || [];
              (function() {
                var a,b,c;
                a = function(f){return function(){_cio.push([f].concat(Array.prototype.slice.call(arguments,0)));};};
                b = ["load","identify","sidentify","track","page","on","off"];
                for(c=0;c<b.length;c++){_cio[b[c]] = a(b[c]);}
                var t = document.createElement('script'),
                    s = document.getElementsByTagName('script')[0];
                t.async = true;
                t.id    = 'cio-tracker';
                t.setAttribute('data-site-id', '${siteId}');
                t.src   = '${trackerSrc}';
                s.parentNode.insertBefore(t, s);
              })();
            `}
          </Script>
        ) : null}
      </body>
    </html>
  );
}
