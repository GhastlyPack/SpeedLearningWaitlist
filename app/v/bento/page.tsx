"use client";

import Link from "next/link";
import { useWaitlistForm } from "@/lib/useWaitlistForm";
import "./bento.css";

/**
 * /v/bento — Bento Grid lander variant.
 *
 * Apple-style asymmetric tile grid. Every benefit / output / proof point
 * lives in its own tile. Form sits in the largest tile, anchoring the
 * top-left of the grid. Tile colors and sizes vary to create rhythm
 * without relying on shadows or borders.
 *
 * Conversion bet: skimmable surface area. Tests "every benefit visible
 * in one viewport" vs the narrative variants where you have to scroll.
 *
 * Copy is placeholder — sized to fit tile shapes.
 */

const VARIANT = "bento";

export default function BentoVariantPage() {
  return (
    <div className="bn-page">
      <Topbar />
      <main>
        <HeroHead />
        <BentoGrid />
        <RepeatCta />
      </main>
      <Footer />
    </div>
  );
}

function Topbar() {
  return (
    <header className="bn-topbar">
      <div className="wordmark">SpeedLearning</div>
      <div className="meta">Waitlist · open</div>
    </header>
  );
}

function HeroHead() {
  return (
    <section className="bn-hero-head">
      <span className="bn-eyebrow">$50 flat · 10 outputs · cited</span>
      <h1 className="bn-hero-headline">
        Everything you need to <span className="accent">actually learn it</span>.
      </h1>
      <p className="bn-hero-sub">
        Type a topic. We synthesize 50+ vetted sources into a complete
        learning library, in 30 to 60 minutes. Every claim cited.
      </p>
    </section>
  );
}

function BentoGrid() {
  return (
    <div className="bn-container">
      <div className="bn-grid">
        {/* The form tile — 2×2 on desktop, full-width on mobile */}
        <div className="bn-tile form-tile">
          <FormBlock heading="Save your seat." />
        </div>

        {/* Metric tile: source count */}
        <div className="bn-tile metric mint">
          <span className="label">Per topic</span>
          <div className="big">50+</div>
          <div className="desc">vetted sources evaluated, summarized, cited.</div>
        </div>

        {/* Price tile */}
        <div className="bn-tile metric electric">
          <span className="label">All-in</span>
          <div className="big">$50</div>
          <div className="desc">flat. No subscription. Yours forever.</div>
        </div>

        {/* Wide list tile: outputs */}
        <div className="bn-tile wide list lavender">
          <span className="label">You get</span>
          <h3>Ten artifacts per topic.</h3>
          <ul>
            <li>Full report</li>
            <li>Audio summary</li>
            <li>Slide deck</li>
            <li>Mind map</li>
            <li>Flashcards</li>
            <li>Infographics</li>
            <li>Explainer video</li>
            <li>TLDR card</li>
            <li>Bibliography</li>
            <li>AI chat partner</li>
          </ul>
        </div>

        {/* Compare tile: vs ChatGPT */}
        <div className="bn-tile graphite">
          <span className="label">vs ChatGPT</span>
          <h3>Every claim cited. No hallucinations.</h3>
          <p>Verifiable sources, not vibes.</p>
        </div>

        {/* Wide tile: timeline */}
        <div className="bn-tile wide rose">
          <span className="label">Time to fluent</span>
          <h3>One afternoon. Not one semester.</h3>
          <p>
            30 to 60 minutes of structured learning across the topic,
            from TLDR to deep-dive video.
          </p>
        </div>

        {/* Discount tile */}
        <div className="bn-tile amber">
          <span className="label">Waitlist bonus</span>
          <h3>50% off your first Deep Dive.</h3>
          <p>For the first 1,000 signups.</p>
        </div>
      </div>
    </div>
  );
}

function RepeatCta() {
  return (
    <section className="bn-repeat">
      <h2>Type any topic. Get the library.</h2>
      <div className="form-host">
        <FormBlock heading="Get on the list." />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bn-footer">
      <span>© 2026 SpeedLearning</span>
      <Link href="/">← Back to homepage</Link>
    </footer>
  );
}

/**
 * Form block — designed to fit inside either the big hero tile or the
 * stand-alone repeat-CTA tile. Uses the shared hook.
 */
function FormBlock({ heading }: { heading: string }) {
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
      ? "bn-form-meta error"
      : status === "success"
      ? "bn-form-meta success"
      : "bn-form-meta";

  const idSeed = heading.replace(/[^a-z0-9]/gi, "");

  return (
    <div className="bn-form-card-inner">
      <h2>
        {heading.split(" ").slice(0, -1).join(" ")}{" "}
        <span className="accent">{heading.split(" ").slice(-1)}</span>
      </h2>
      <p className="lede">Email plus first name. We&apos;ll do the rest.</p>

      <form className="bn-form" onSubmit={submit} noValidate>
        <div className="bn-field">
          <label htmlFor={`bn-first-${idSeed}`}>First name</label>
          <input
            id={`bn-first-${idSeed}`}
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
        <div className="bn-field">
          <label htmlFor={`bn-email-${idSeed}`}>Email</label>
          <input
            id={`bn-email-${idSeed}`}
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
        <button type="submit" className="bn-cta" disabled={locked}>
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
          : message || "Unsubscribe anytime. No spam."}
      </div>
    </div>
  );
}
