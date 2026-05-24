"use client";

import Link from "next/link";
import { useWaitlistForm } from "@/lib/useWaitlistForm";
import "./brutalist.css";

/**
 * /v/brutalist — Neubrutalist lander variant.
 *
 * Visual identity:
 *   Acid yellow page, white form cards stacked on hard offset shadows,
 *   black 4px borders, uppercase mono labels, two display-weight headlines.
 *
 * Copy is placeholder — written to fill the conversion-optimized BLOCK
 * SHAPES (hero / form / "10 things" tiles / 3-col compare / repeat-CTA).
 * The team will refine the words; the shapes should stay because that's
 * what we're A/B-testing against the control.
 */

const VARIANT = "brutalist";

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

const COMPARE = {
  google: [
    "50 tabs to read",
    "No synthesis",
    "Top results are paid SEO",
    "You do all the work",
  ],
  chatgpt: [
    "Hallucinated facts",
    "No real citations",
    "Plain text output",
    "Can't verify what's true",
  ],
  speedlearning: [
    "50+ sources evaluated",
    "Every claim cited",
    "10 outputs, not just text",
    "30 to 60 minutes",
  ],
};

export default function BrutalistVariantPage() {
  return (
    <div className="brut-page">
      <Topbar />
      <main>
        <Hero />
        <OutputsSection />
        <CompareSection />
        <RepeatCtaSection />
      </main>
      <Footer />
    </div>
  );
}

function Topbar() {
  return (
    <div className="brut-topbar">
      <strong>SPEEDLEARNING</strong>
      <span className="badge">WAITLIST OPEN</span>
    </div>
  );
}

function Hero() {
  return (
    <section className="brut-container brut-hero">
      <div>
        <span className="brut-eyebrow">$50 flat · launches Q3</span>
        <h1 className="brut-headline">
          STOP PAYING <span className="strike">GURUS</span> FOR FREE INFO.
        </h1>
        <p className="brut-subhead">
          Type a topic. SpeedLearning pulls 50+ sources and synthesizes a
          complete learning library in 30 to 60 minutes. Cited. Verifiable.
          One flat price.
        </p>
        <span className="brut-price-chip">
          50% off · first 1,000 signups
        </span>
      </div>

      <FormCard
        heading="GET ON THE LIST."
        lede="EMAIL + FIRST NAME. ONE CLICK. DONE."
      />
    </section>
  );
}

function OutputsSection() {
  return (
    <section className="brut-section">
      <div className="brut-container">
        <span className="kicker">ONE TOPIC · 10 OUTPUTS</span>
        <h2>
          Everything you need
          <br />
          to actually learn it.
        </h2>
        <div className="brut-grid">
          {OUTPUTS.map((label, i) => (
            <div key={label} className="brut-tile">
              <span className="num">/ {String(i + 1).padStart(2, "0")}</span>
              <span className="name">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompareSection() {
  return (
    <section className="brut-section">
      <div className="brut-container">
        <span className="kicker">WHY NOT JUST USE GOOGLE / CHATGPT</span>
        <h2>
          Because they
          <br />
          can&apos;t do this.
        </h2>
        <div className="brut-compare">
          <div className="brut-col">
            <h3>Google</h3>
            <ul>
              {COMPARE.google.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
          <div className="brut-col">
            <h3>ChatGPT</h3>
            <ul>
              {COMPARE.chatgpt.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
          <div className="brut-col us">
            <h3>SpeedLearning</h3>
            <ul>
              {COMPARE.speedlearning.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function RepeatCtaSection() {
  return (
    <section className="brut-section repeat-cta">
      <div className="brut-container">
        <span className="kicker">LAST CALL FOR 50% OFF</span>
        <h2>
          $50 to learn
          <br />
          anything. Done.
        </h2>
        <FormCard
          heading="GET ON THE LIST."
          lede="WE&apos;LL EMAIL YOU AT LAUNCH."
        />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="brut-footer">
      <span>© 2026 SPEEDLEARNING</span>
      <Link
        href="/"
        style={{ color: "inherit", textDecoration: "underline" }}
      >
        ← BACK TO HOMEPAGE
      </Link>
    </footer>
  );
}

/**
 * Brutalist-styled form. Uses the shared useWaitlistForm hook so the
 * submit behavior matches every other variant + the control.
 */
function FormCard({ heading, lede }: { heading: string; lede: string }) {
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
      ? "brut-form-meta error"
      : status === "success"
      ? "brut-form-meta success"
      : "brut-form-meta";

  return (
    <div className="brut-form-card">
      <h2>{heading}</h2>
      <p className="lede">{lede}</p>

      <form className="brut-form" onSubmit={submit} noValidate>
        <div className="brut-field">
          <label htmlFor={`brut-first-${heading}`}>First name</label>
          <input
            id={`brut-first-${heading}`}
            type="text"
            autoComplete="given-name"
            placeholder="RICHARD"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              clearError();
            }}
            required
            disabled={locked}
          />
        </div>

        <div className="brut-field">
          <label htmlFor={`brut-last-${heading}`}>Last name (optional)</label>
          <input
            id={`brut-last-${heading}`}
            type="text"
            autoComplete="family-name"
            placeholder="HENDRICKS"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={locked}
          />
        </div>

        <div className="brut-field">
          <label htmlFor={`brut-email-${heading}`}>Email</label>
          <input
            id={`brut-email-${heading}`}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="RICHARD@PIEDPIPER.COM"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError();
            }}
            required
            disabled={locked}
          />
        </div>

        <button type="submit" className="brut-cta" disabled={locked}>
          {status === "submitting"
            ? "JOINING…"
            : status === "success"
            ? "JOINED"
            : "JOIN THE WAITLIST →"}
        </button>
      </form>

      <div className={metaClass} aria-live="polite">
        {status === "success"
          ? `YOU'RE ON THE LIST, ${submittedFirstName.toUpperCase()}.`
          : message ||
            "NO SPAM. UNSUBSCRIBE WHENEVER."}
      </div>
    </div>
  );
}
