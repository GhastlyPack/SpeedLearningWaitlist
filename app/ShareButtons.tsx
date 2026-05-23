"use client";

import { useState } from "react";

interface Props {
  /** Referral code from the signed-up person — encoded into share URLs as ?ref=  */
  referralCode?: string | null;
  /** Short message shown above the buttons */
  prompt?: string;
}

const BASE_URL = "https://speedlearning.com";
const SHARE_TEXT =
  "Just joined the SpeedLearning waitlist — learn anything in 30 to 60 minutes, $50 flat per topic.";

function buildShareUrl(channel: string, referralCode?: string | null): string {
  const u = new URL(BASE_URL);
  u.searchParams.set("utm_source", "referral");
  u.searchParams.set("utm_medium", "share");
  u.searchParams.set("utm_campaign", "waitlist");
  u.searchParams.set("utm_content", channel);
  if (referralCode) u.searchParams.set("ref", referralCode);
  return u.toString();
}

export default function ShareButtons({ referralCode, prompt }: Props) {
  const [copied, setCopied] = useState(false);

  const nativeShare = async () => {
    const url = buildShareUrl("native", referralCode);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "SpeedLearning",
          text: SHARE_TEXT,
          url,
        });
        return;
      } catch {
        // user cancelled — fall through to copy
      }
    }
    // No Web Share API (mostly desktop) — fall back to copying the link.
    copyToClipboard(url);
  };

  const copyToClipboard = (url?: string) => {
    const link = url ?? buildShareUrl("copy", referralCode);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    SHARE_TEXT
  )}&url=${encodeURIComponent(buildShareUrl("x", referralCode))}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    buildShareUrl("linkedin", referralCode)
  )}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    SHARE_TEXT + " " + buildShareUrl("whatsapp", referralCode)
  )}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(
    "Found something — SpeedLearning waitlist"
  )}&body=${encodeURIComponent(
    SHARE_TEXT + "\n\n" + buildShareUrl("email", referralCode)
  )}`;

  return (
    <div className="share">
      <div className="share-eyebrow">
        {prompt || "Share with friends · earn credits when they join"}
      </div>
      <div className="share-row">
        <button
          type="button"
          className="share-btn share-btn-primary"
          onClick={nativeShare}
        >
          Share
        </button>
        <a
          className="share-btn"
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          X
        </a>
        <a
          className="share-btn"
          href={linkedInUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
        <a
          className="share-btn"
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
        <a
          className="share-btn"
          href={emailUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Email
        </a>
        <button
          type="button"
          className="share-btn"
          onClick={() => copyToClipboard()}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
