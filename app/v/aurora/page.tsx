"use client";

import Link from "next/link";
import { useWaitlistForm } from "@/lib/useWaitlistForm";
import "./aurora.css";

/**
 * /v/aurora — Aurora UI lander variant.
 *
 * Full-bleed flowing gradient mesh in aurora-borealis colors (teal,
 * violet, magenta, indigo). Foreground is opaque white cards on the
 * gradient — different from /v/glass which uses semi-transparent
 * surfaces. Here the gradient is decoration; the content is solid.
 *
 * Minimal foreground — no tile grid, no comparison block. Just the
 * hero with form, an outputs pill row, and a repeat CTA. The aurora
 * is the show.
 */

const VARIANT = "aurora";

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

export default function AuroraVariantPage() {
  return (
    <div className="au-page">
      <Aurora />
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

function Aurora() {
  return (
    <div className="au-aurora" aria-hidden>
      <div className="swirl s1" />
      <div className="swirl s2" />
      <div className="swirl s3" />
      <div className="swirl s4" />
    </div>
  );
}

function Topbar() {
  return (
    <header className="au-topbar">
      <div className="wordmark">SpeedLearning</div>
      <div className="pill">Waitlist · open</div>
    </header>
  );
}

function Hero() {
  return (
    <section className="au-hero">
      <span className="au-eyebrow">$50 flat · launches Q3 2026</span>
      <h1 className="au-headline">
        Learn anything. <span className="accent">Properly.</span>
      </h1>
      <p className="au-subhead">
        Type a topic. SpeedLearning pulls 50+ vetted sources and synthesizes
        a complete learning library in one afternoon. Cited, verifiable,
        yours forever.
      </p>

      <FormCard heading="Reserve your seat" />
    </section>
  );
}

function OutputsSection() {
  return (
    <section className="au-section">
      <div className="au-container">
        <div className="au-section-head">
          <div className="kicker">One topic — ten artifacts</div>
          <h2>Every way you might want to learn it.</h2>
        </div>
        <div className="au-pill-grid">
          {OUTPUTS.map((label) => (
            <span key={label} className="au-pill">
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function RepeatCta() {
  return (
    <section className="au-repeat-cta">
      <div className="au-section-head">
        <div className="kicker">50% off · first 1,000 readers</div>
        <h2>One topic. One library. $50.</h2>
      </div>
      <FormCard heading="Get on the list" />
    </section>
  );
}

function Footer() {
  return (
    <footer className="au-footer">
      <span>© 2026 SpeedLearning</span>
      <Link href="/">← Back to homepage</Link>
    </footer>
  );
}

function FormCard({ heading }: { heading: string }) {
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
      ? "au-form-meta error"
      : status === "success"
      ? "au-form-meta success"
      : "au-form-meta";

  const idSeed = heading.replace(/[^a-z0-9]/gi, "");

  return (
    <div className="au-card">
      <h2>{heading}</h2>
      <p className="lede">Email + first name. We&apos;ll do the rest.</p>

      <form className="au-form" onSubmit={submit} noValidate>
        <div className="au-field">
          <label htmlFor={`au-first-${idSeed}`}>First name</label>
          <input
            id={`au-first-${idSeed}`}
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
        <div className="au-field">
          <label htmlFor={`au-email-${idSeed}`}>Email</label>
          <input
            id={`au-email-${idSeed}`}
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
        <button type="submit" className="au-cta" disabled={locked}>
          {status === "submitting"
            ? "Joining…"
            : status === "success"
            ? "Joined ✓"
            : "Join the waitlist"}
        </button>
      </form>

      <div className={metaClass} aria-live="polite">
        {status === "success"
          ? `You're in, ${submittedFirstName}.`
          : message || "No spam. Unsubscribe anytime."}
      </div>
    </div>
  );
}
