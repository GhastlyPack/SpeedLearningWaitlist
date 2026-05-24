"use client";

import Link from "next/link";
import { useWaitlistForm } from "@/lib/useWaitlistForm";
import "./blocks.css";

/**
 * /v/blocks — Vibrant Block-based lander variant (final, 10 of 10).
 *
 * Flat geometric blocks of saturated color, asymmetric layout, the
 * layout itself IS the decoration. Mailchimp / Stripe / Patagonia-era
 * design language. Bleeds to the page edges — no max-widths on the
 * primary blocks, no shadows or borders.
 *
 * Conversion bet: visual immediacy at full-page scale. Tests whether
 * unconstrained color blocks (no whitespace breathing room) convert
 * better than the polished centered variants.
 */

const VARIANT = "blocks";

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

export default function BlocksVariantPage() {
  return (
    <div className="bl-page">
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
    <header className="bl-topbar">
      <div className="wordmark">SpeedLearning</div>
      <div className="meta">Waitlist · open</div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bl-hero">
      <div className="bl-hero-left">
        <div className="bl-eyebrow">$50 flat · launches Q3</div>
        <h1 className="bl-headline">
          <span className="nl">Learn</span>
          <span className="nl">anything.</span>
          <span className="nl">For $50.</span>
        </h1>
        <p className="bl-subhead">
          Type a topic. Get 10 outputs — report, audio, slides, mind map,
          flashcards, more. Every claim cited. Yours forever.
        </p>
        <div className="bl-meta-bar">
          <span>50+ sources</span>
          <span>cited</span>
          <span>30 to 60 min</span>
        </div>
      </div>

      <div className="bl-hero-right">
        <FormCard heading="Join the waitlist" />
      </div>
    </section>
  );
}

function OutputsSection() {
  return (
    <section className="bl-output-section">
      <div className="header">
        <div className="kicker">One topic — ten outputs</div>
        <h2>You get every way to learn it.</h2>
      </div>

      <div className="bl-output-grid">
        {OUTPUTS.map((label, i) => (
          <div key={label} className="bl-output-block">
            <span className="n">{String(i + 1).padStart(2, "0")} / 10</span>
            <span className="name">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RepeatCta() {
  return (
    <section className="bl-repeat">
      <div className="inner">
        <div>
          <div className="kicker">Last call · 50% off first 1,000</div>
          <h2>
            Type a topic.
            <br />
            Get the library.
            <br />
            $50.
          </h2>
        </div>
        <FormCard heading="Get on the list" />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bl-footer">
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
      ? "bl-form-meta error"
      : status === "success"
      ? "bl-form-meta success"
      : "bl-form-meta";

  const idSeed = heading.replace(/[^a-z0-9]/gi, "");

  return (
    <div className="bl-form-card">
      <h2>{heading}</h2>
      <p className="lede">Two fields. One click.</p>

      <form className="bl-form" onSubmit={submit} noValidate>
        <div className="bl-field">
          <label htmlFor={`bl-first-${idSeed}`}>First name</label>
          <input
            id={`bl-first-${idSeed}`}
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
        <div className="bl-field">
          <label htmlFor={`bl-email-${idSeed}`}>Email</label>
          <input
            id={`bl-email-${idSeed}`}
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
        <button type="submit" className="bl-cta" disabled={locked}>
          {status === "submitting"
            ? "Joining…"
            : status === "success"
            ? "Joined"
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
