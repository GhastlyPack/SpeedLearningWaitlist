"use client";

import Link from "next/link";
import { useWaitlistForm } from "@/lib/useWaitlistForm";
import "./cinema.css";

/**
 * /v/cinema — Cinematic Dark lander variant.
 *
 * OLED-black canvas, restrained warm-amber accent used sparingly, large
 * serif headline (Newsreader). Reads as premium / serious — the kind of
 * dark aesthetic used by film studios, fintech, watches. Lots of
 * negative space; type carries the design.
 *
 * Conversion structure (placeholder copy, real shapes):
 *   1. Topbar — wordmark + "Waitlist · open" mono metadata
 *   2. Hero — eyebrow with thin amber rules / oversized italic-accented
 *      serif headline / serif standfirst / centered dark form card
 *   3. Outputs — single-column elegant numbered list (not tiles)
 *   4. Pull quote — large italic blockquote with attribution
 *   5. Repeat CTA — dark form card again
 *   6. Footer — sparse mono metadata + amber back-home link
 */

const VARIANT = "cinema";

const OUTPUTS = [
  "Full report",
  "Audio summary",
  "Slide deck",
  "Mind map",
  "Flashcards",
  "Infographics",
  "Explainer video",
  "TLDR card",
  "Bibliography",
  "AI chat partner",
];

export default function CinemaVariantPage() {
  return (
    <div className="cn-page">
      <Topbar />
      <main>
        <Hero />
        <OutputsSection />
        <QuoteSection />
        <RepeatCta />
      </main>
      <Footer />
    </div>
  );
}

function Topbar() {
  return (
    <header className="cn-topbar">
      <div className="wordmark">SpeedLearning</div>
      <div className="meta">Waitlist · open</div>
    </header>
  );
}

function Hero() {
  return (
    <section className="cn-hero">
      <div className="cn-eyebrow">
        <span className="line" />
        Coming Q3 2026
        <span className="line" />
      </div>
      <h1 className="cn-headline">
        Learn anything. <em>In a single afternoon.</em>
      </h1>
      <p className="cn-subhead">
        Type a topic. SpeedLearning pulls 50+ vetted sources and synthesizes
        a complete learning library — report, deck, audio, mind map, more —
        cited and verifiable. One flat $50.
      </p>

      <FormCard
        heading="Reserve your seat."
        lede="Email + first name. We'll do the rest."
      />
    </section>
  );
}

function OutputsSection() {
  return (
    <section className="cn-section">
      <div className="cn-container">
        <div className="cn-section-head">
          <div className="kicker">One topic — ten artifacts</div>
          <h2>
            Everything you need to <em>actually</em> learn it.
          </h2>
        </div>
        <ol className="cn-output-list">
          {OUTPUTS.map((label, i) => (
            <li key={label} className="row">
              <span className="n">{String(i + 1).padStart(2, "0")} /</span>
              <span className="name">{label}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function QuoteSection() {
  return (
    <section className="cn-quote">
      <blockquote>
        &ldquo;The last $2,000 you&apos;ll never spend.&rdquo;
      </blockquote>
      <div className="attribution">— the only ad we needed to write</div>
    </section>
  );
}

function RepeatCta() {
  return (
    <section className="cn-repeat-cta">
      <div className="cn-section-head">
        <div className="kicker">50% off · first 1,000 readers</div>
        <h2>
          One topic. One library. <em>$50.</em>
        </h2>
      </div>
      <FormCard
        heading="Get on the list."
        lede="Last call before the gate closes."
      />
    </section>
  );
}

function Footer() {
  return (
    <footer className="cn-footer">
      <span>© 2026 SpeedLearning</span>
      <Link href="/">← Back to homepage</Link>
    </footer>
  );
}

function FormCard({ heading, lede }: { heading: string; lede: string }) {
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
      ? "cn-form-meta error"
      : status === "success"
      ? "cn-form-meta success"
      : "cn-form-meta";

  const idSeed = heading.replace(/[^a-z0-9]/gi, "");

  return (
    <div className="cn-form-card">
      <h2>{heading}</h2>
      <p className="lede">{lede}</p>

      <form className="cn-form" onSubmit={submit} noValidate>
        <div className="cn-field">
          <label htmlFor={`cn-first-${idSeed}`}>First name</label>
          <input
            id={`cn-first-${idSeed}`}
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
        <div className="cn-field">
          <label htmlFor={`cn-email-${idSeed}`}>Email</label>
          <input
            id={`cn-email-${idSeed}`}
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
        <button type="submit" className="cn-cta" disabled={locked}>
          {status === "submitting"
            ? "Submitting…"
            : status === "success"
            ? "Reserved"
            : "Reserve seat"}
        </button>
      </form>

      <div className={metaClass} aria-live="polite">
        {status === "success"
          ? `Reserved. We'll be in touch, ${submittedFirstName}.`
          : message ||
            "No spam. Unsubscribe anytime."}
      </div>
    </div>
  );
}
