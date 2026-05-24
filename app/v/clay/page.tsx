"use client";

import Link from "next/link";
import { useWaitlistForm } from "@/lib/useWaitlistForm";
import "./clay.css";

/**
 * /v/clay — Claymorphism lander variant.
 *
 * Soft 3D pastel surfaces, big rounded corners, plump shadows. Friendly
 * and approachable — the inverse of brutalist's intentional harshness.
 *
 * Conversion bet: warmth and approachability lower the perceived
 * commitment. Tests against the polished/serious variants.
 */

const VARIANT = "clay";

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

export default function ClayVariantPage() {
  return (
    <div className="cl-page">
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
    <header className="cl-topbar">
      <div className="wordmark">SpeedLearning</div>
      <div className="pill">Waitlist · open</div>
    </header>
  );
}

function Hero() {
  return (
    <section className="cl-container cl-hero">
      <div>
        <span className="cl-eyebrow">$50 flat · 50+ sources · cited</span>
        <h1 className="cl-headline">
          Learn anything in{" "}
          <span className="accent">one afternoon</span>.
        </h1>
        <p className="cl-subhead">
          Type a topic. We synthesize 50+ sources into a complete learning
          library — report, audio, slides, mind map, flashcards, more.
          Every claim cited.
        </p>
        <div className="cl-bubbles">
          <span className="cl-bubble pink">$50 flat</span>
          <span className="cl-bubble mint">Cited sources</span>
          <span className="cl-bubble lavender">Yours forever</span>
          <span className="cl-bubble">50% off first 1,000</span>
        </div>
      </div>

      <FormCard heading="Save your seat" />
    </section>
  );
}

function OutputsSection() {
  return (
    <section className="cl-section">
      <div className="cl-container">
        <div className="cl-section-head">
          <div className="kicker">One topic, ten artifacts</div>
          <h2>Everything you need to actually learn it.</h2>
        </div>
        <div className="cl-blob-grid">
          {OUTPUTS.map((label) => (
            <div key={label} className="cl-blob">
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
    <section className="cl-repeat-cta">
      <div className="cl-section-head">
        <div className="kicker">50% off · first 1,000 readers</div>
        <h2>One topic. One library. $50.</h2>
      </div>
      <FormCard heading="Get on the list" />
    </section>
  );
}

function Footer() {
  return (
    <footer className="cl-footer">
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
      ? "cl-form-meta error"
      : status === "success"
      ? "cl-form-meta success"
      : "cl-form-meta";

  const idSeed = heading.replace(/[^a-z0-9]/gi, "");

  return (
    <div className="cl-form-card">
      <h2>{heading}</h2>
      <p className="lede">Email + first name. Two fields. That&apos;s it.</p>

      <form className="cl-form" onSubmit={submit} noValidate>
        <div className="cl-field">
          <label htmlFor={`cl-first-${idSeed}`}>First name</label>
          <input
            id={`cl-first-${idSeed}`}
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
        <div className="cl-field">
          <label htmlFor={`cl-email-${idSeed}`}>Email</label>
          <input
            id={`cl-email-${idSeed}`}
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
        <button type="submit" className="cl-cta" disabled={locked}>
          {status === "submitting"
            ? "Saving…"
            : status === "success"
            ? "Saved ✓"
            : "Save my seat"}
        </button>
      </form>

      <div className={metaClass} aria-live="polite">
        {status === "success"
          ? `You're in, ${submittedFirstName}. We'll be in touch.`
          : message || "No spam. Unsubscribe anytime."}
      </div>
    </div>
  );
}
