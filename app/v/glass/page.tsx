"use client";

import Link from "next/link";
import { useWaitlistForm } from "@/lib/useWaitlistForm";
import "./glass.css";

/**
 * /v/glass — Glassmorphism lander variant.
 *
 * Frosted-glass panels layered over a soft gradient mesh of blurred
 * color blobs. Reads as polished modern SaaS — every primary surface
 * is a backdrop-filter blur with a 1px inner-glow border.
 *
 * Conversion structure (placeholder copy, real shapes):
 *   1. Topbar — wordmark + "live" status pill
 *   2. Hero — gradient mesh + glass eyebrow chip + headline (gradient
 *      text on accent word) + subhead + central glass form card
 *   3. "How it works" — 3 glass step cards
 *   4. "You get" — 10 glass output tiles in a 5×2 grid
 *   5. Repeat CTA — closing glass form card
 *   6. Footer — sparse, ink-muted
 */

const VARIANT = "glass";

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

export default function GlassVariantPage() {
  return (
    <div className="gl-page">
      <Mesh />
      <Topbar />
      <main>
        <Hero />
        <HowItWorks />
        <Outputs />
        <RepeatCta />
      </main>
      <Footer />
    </div>
  );
}

function Mesh() {
  return (
    <div className="gl-mesh" aria-hidden>
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
    </div>
  );
}

function Topbar() {
  return (
    <header className="gl-topbar">
      <div className="wordmark">SpeedLearning</div>
      <div className="pill">
        <span className="dot" />
        Waitlist open · launching Q3
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="gl-hero">
      <span className="gl-eyebrow">$50 flat · 50+ sources · cited</span>
      <h1 className="gl-headline">
        Learn anything in <span className="accent">30 to 60 minutes</span>.
      </h1>
      <p className="gl-subhead">
        Type a topic. SpeedLearning pulls the best of the public internet —
        videos, articles, papers, podcasts — and synthesizes a complete
        learning library. Every claim cited. One flat price.
      </p>

      <div className="gl-form-card">
        <FormCard heading="Join the waitlist" />
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "Type your topic",
      body: "Anything. From quantum computing to Renaissance painting techniques.",
    },
    {
      title: "We synthesize",
      body: "50+ sources evaluated and stitched into a library you can finish in an afternoon.",
    },
    {
      title: "Learn it, keep it",
      body: "Report, deck, mind map, flashcards, AI chat. Yours forever after one $50 payment.",
    },
  ];
  return (
    <section className="gl-section">
      <div className="gl-container">
        <div className="gl-section-head">
          <div className="kicker">How it works</div>
          <h2>Three steps from curiosity to fluent.</h2>
        </div>
        <div className="gl-three-up">
          {steps.map((s, i) => (
            <div key={s.title} className="gl-step">
              <span className="n">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Outputs() {
  return (
    <section className="gl-section">
      <div className="gl-container">
        <div className="gl-section-head">
          <div className="kicker">One topic, ten artifacts</div>
          <h2>Everything you need to actually learn it.</h2>
        </div>
        <div className="gl-output-grid">
          {OUTPUTS.map((label) => (
            <div key={label} className="gl-output-tile">
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
    <section className="gl-repeat-cta">
      <div className="gl-container">
        <div className="gl-section-head">
          <div className="kicker">50% off · first 1,000 readers</div>
          <h2>One topic. One library. $50.</h2>
        </div>
        <div className="gl-form-card">
          <FormCard heading="Save my seat" />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="gl-footer">
      <span>© 2026 SpeedLearning</span>
      <Link href="/">← Back to homepage</Link>
    </footer>
  );
}

/**
 * Glass form card. Bespoke markup, shared submit logic via the hook.
 */
function FormCard({ heading }: { heading: string }) {
  const {
    firstName,
    setFirstName,
    lastName,
    setLastName,
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
      ? "gl-form-meta error"
      : status === "success"
      ? "gl-form-meta success"
      : "gl-form-meta";

  const idSeed = heading.replace(/[^a-z0-9]/gi, "");

  return (
    <div className="gl-card">
      <h2
        style={{
          margin: "0 0 18px",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.5px",
        }}
      >
        {heading}
      </h2>

      <form className="gl-form" onSubmit={submit} noValidate>
        <div className="gl-field">
          <label htmlFor={`gl-first-${idSeed}`}>First name</label>
          <input
            id={`gl-first-${idSeed}`}
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
        <div className="gl-field">
          <label htmlFor={`gl-last-${idSeed}`}>
            Last name <span style={{ opacity: 0.55 }}>· optional</span>
          </label>
          <input
            id={`gl-last-${idSeed}`}
            type="text"
            autoComplete="family-name"
            placeholder="Hendricks"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={locked}
          />
        </div>
        <div className="gl-field">
          <label htmlFor={`gl-email-${idSeed}`}>Email</label>
          <input
            id={`gl-email-${idSeed}`}
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
        <button type="submit" className="gl-cta" disabled={locked}>
          {status === "submitting"
            ? "Joining…"
            : status === "success"
            ? "Joined ✓"
            : "Join the waitlist"}
        </button>
      </form>

      <div className={metaClass} aria-live="polite">
        {status === "success"
          ? `You're in, ${submittedFirstName}. Watch your inbox.`
          : message ||
            "Early access, updates, the occasional offer. Unsubscribe anytime."}
      </div>
    </div>
  );
}
