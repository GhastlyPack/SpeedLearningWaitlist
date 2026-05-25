"use client";

import Link from "next/link";
import { useWaitlistForm } from "@/lib/useWaitlistForm";
import "./y2k.css";

/**
 * /v/y2k — Y2K Aesthetic lander variant.
 *
 * Deliberately over-the-top early-2000s web aesthetic. Pink/cyan/violet
 * gradient bg with subtle starfield, chrome metallic headline with hard
 * drop-shadows, fake "OS window" form card with titlebar + minimize/
 * maximize/close buttons. Inline SVG sparkles (per skill checklist —
 * never emojis).
 *
 * Conversion bet: pure attention-grab. Tests whether the playful /
 * nostalgic register converts at all in a saturated market.
 */

const VARIANT = "y2k";

const OUTPUTS = [
  "Full report",
  "Audio + video",
  "Slide deck",
  "Mind map",
  "Flashcards",
  "Infographics",
  "TLDR card",
  "AI chat partner",
];

function Sparkle({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="y2k-sparkle"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function Y2kVariantPage() {
  return (
    <div className="y2k-page">
      <div className="y2k-stars" aria-hidden />
      <Topbar />
      <main>
        <Hero />
        <OutputsSection />
        <RepeatCta />
      </main>
      <Footer />
    </div>
  );
}

function Topbar() {
  return (
    <header className="y2k-topbar">
      <div className="dots">
        <span />
        <span />
        <span />
      </div>
      <div className="url">https://speedlearning.com/v/y2k</div>
      <strong>SPEEDLEARNING.EXE</strong>
    </header>
  );
}

function Hero() {
  return (
    <section className="y2k-hero">
      <span className="y2k-eyebrow">
        <Sparkle size={11} /> NEW · $50 FLAT <Sparkle size={11} />
      </span>
      <h1 className="y2k-headline">
        LEARN <span className="accent">ANYTHING</span>.
        <br />
        FAST.
      </h1>
      <p className="y2k-subhead">
        Type a topic. SpeedLearning pulls 50+ sources and synthesizes 8
        ways to learn it in 30 to 60 minutes. All cited. All yours.
        $50 forever.
      </p>

      <FormWindow
        title="JOIN.WAITLIST"
        heading="GET ON THE LIST!!!"
        lede="50% off for the first 1000."
      />
    </section>
  );
}

function OutputsSection() {
  return (
    <section className="y2k-section">
      <div className="y2k-container">
        <div className="y2k-section-head">
          <span className="kicker">
            <Sparkle size={10} /> 8 OUTPUTS <Sparkle size={10} />
          </span>
          <h2>YOU GET ALL OF THIS.</h2>
        </div>
        <div className="y2k-sticker-grid">
          {OUTPUTS.map((label) => (
            <div key={label} className="y2k-sticker">
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RepeatCta() {
  return (
    <section className="y2k-repeat-cta">
      <div className="y2k-container">
        <div className="y2k-section-head">
          <span className="kicker">LAST CALL</span>
          <h2>
            <Sparkle size={28} /> $50. THAT&apos;S THE WHOLE PITCH. <Sparkle size={28} />
          </h2>
        </div>
        <FormWindow
          title="WAITLIST.EXE"
          heading="DON'T MISS IT."
          lede="It's literally just an email field."
        />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="y2k-footer">
      <span>© 2026 SPEEDLEARNING.COM</span>
      <Link href="/">← BACK TO HOMEPAGE.HTML</Link>
    </footer>
  );
}

/**
 * Fake-OS-window form. Has a titlebar with minimize/maximize/close, an
 * inset gray body, beveled inputs, chunky gradient CTA with hard shadow.
 */
function FormWindow({
  title,
  heading,
  lede,
}: {
  title: string;
  heading: string;
  lede: string;
}) {
  const {
    firstName,
    setFirstName,
    email,
    setEmail,
    status,
    message,
    submittedFirstName,
    locked,
    submit,
    clearError,
  } = useWaitlistForm({ variant: VARIANT });

  const metaClass =
    status === "error"
      ? "y2k-form-meta error"
      : status === "success"
      ? "y2k-form-meta success"
      : "y2k-form-meta";

  const idSeed = title.replace(/[^a-z0-9]/gi, "");

  return (
    <div className="y2k-window">
      <div className="y2k-window-titlebar">
        <strong>{title}</strong>
        <div className="buttons" aria-hidden>
          <span>_</span>
          <span>□</span>
          <span>×</span>
        </div>
      </div>
      <div className="y2k-window-body">
        <h2>{heading}</h2>
        <p className="lede">{lede}</p>

        <form className="y2k-form" onSubmit={submit} noValidate>
          <div className="y2k-field">
            <label htmlFor={`y2k-first-${idSeed}`}>First name</label>
            <input
              id={`y2k-first-${idSeed}`}
              type="text"
              autoComplete="given-name"
              placeholder="Richard"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                clearError();
              }}
              required
              disabled={locked}
            />
          </div>
          <div className="y2k-field">
            <label htmlFor={`y2k-email-${idSeed}`}>Email</label>
            <input
              id={`y2k-email-${idSeed}`}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="richard@piedpiper.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError();
              }}
              required
              disabled={locked}
            />
          </div>
          <button type="submit" className="y2k-cta" disabled={locked}>
            {status === "submitting"
              ? "LOADING…"
              : status === "success"
              ? "JOINED ★"
              : "JOIN NOW ►"}
          </button>
        </form>

        <div className={metaClass} aria-live="polite">
          {status === "success"
            ? `WELCOME ABOARD, ${submittedFirstName.toUpperCase()}.`
            : message || ">> NO SPAM. UNSUBSCRIBE ANYTIME."}
        </div>
      </div>
    </div>
  );
}
