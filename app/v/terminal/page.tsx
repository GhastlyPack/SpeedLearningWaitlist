"use client";

import Link from "next/link";
import { useWaitlistForm } from "@/lib/useWaitlistForm";
import "./terminal.css";

/**
 * /v/terminal — Cyberpunk / Terminal lander variant.
 *
 * Green-on-black phosphor terminal aesthetic. JetBrains Mono on
 * everything. Subtle CRT scanline + vignette overlay across the
 * viewport. Blinking cursors, ASCII rules, fake CLI prompt for the
 * form fields.
 *
 * Conversion bet: pure niche-coding. Tests whether the "developer /
 * hacker / power-user" register pulls a specific audience hard enough
 * to win on a CPL basis even if total volume is smaller.
 */

const VARIANT = "terminal";

const OUTPUTS = [
  "Full report",
  "Multimedia recap",
  "Slide deck",
  "Mind map",
  "Flashcards",
  "Infographics",
  "TLDR card",
  "AI chat partner",
];

const ASCII_RULE =
  "═══════════════════════════════════════════════════════════════════════════════";

export default function TerminalVariantPage() {
  return (
    <div className="tm-page">
      <Topbar />
      <main>
        <div className="tm-container">
          <Hero />
          <FormCard heading="join.waitlist" lede="Two args. One side effect: $50 off." />
          <OutputsSection />
          <FormCard
            heading="join.waitlist [retry]"
            lede="Same form. Last chance for the 50% off flag."
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Topbar() {
  return (
    <header className="tm-topbar">
      <span className="left">
        speedlearning@waitlist:~$ <span className="blink" />
      </span>
      <span className="right">conn: secure · uptime: ∞</span>
    </header>
  );
}

function Hero() {
  return (
    <section className="tm-hero">
      <div className="tm-ascii-rule">{ASCII_RULE}</div>
      <div className="tm-prompt">
        <span className="path">~/speedlearning</span>$ ./pitch.sh --short
      </div>

      <h1 className="tm-headline">
        learn anything.
        <br />
        $50 flat. cited.
        <span className="cursor" />
      </h1>

      <p className="tm-subhead">
        Pipe a topic into SpeedLearning. We synthesize 50+ vetted sources
        into 8 outputs — report, audio, slides, mind map, flashcards,
        more. Every claim sourced. Yours forever after one payment.
      </p>

      <div className="tm-output" role="region" aria-label="Sample run">
        <span className="line">
          <span className="info">[info]</span> reading sources... 52 found
        </span>
        <span className="line">
          <span className="info">[info]</span> filtering... 38 evaluated · 14 cut
        </span>
        <span className="line">
          <span className="info">[info]</span> synthesizing library...
        </span>
        <span className="line">
          <span className="ok">[ ok ]</span> 8 outputs ready · 47m 12s elapsed
        </span>
        <span className="line dim">
          → exit code 0
        </span>
      </div>

      <div className="tm-ascii-rule">{ASCII_RULE}</div>
    </section>
  );
}

function OutputsSection() {
  return (
    <section className="tm-section">
      <h2 className="section-head">// outputs(8):</h2>
      <div className="tm-output-list">
        {OUTPUTS.map((label, i) => (
          <div key={label} className="line">
            <span className="idx">[{String(i + 1).padStart(2, "0")}]</span>
            <span className="ok">✓</span>
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="tm-footer">
      <span>© 2026 speedlearning.com</span>
      <Link href="/">← cd ../homepage</Link>
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
      ? "tm-form-meta error"
      : status === "success"
      ? "tm-form-meta success"
      : "tm-form-meta";

  const idSeed = heading.replace(/[^a-z0-9]/gi, "");

  return (
    <div className="tm-form-card">
      <div className="tm-form-titlebar">
        <strong>./{heading}</strong>
        <span>--help</span>
      </div>
      <div className="tm-form-body">
        <h2>{heading}.sh</h2>
        <p className="lede">{lede}</p>

        <form className="tm-form" onSubmit={submit} noValidate>
          <div className="tm-field">
            <div className="prompt-line">
              <span>$</span> read --prompt <span className="arg">&quot;first_name&quot;</span>
            </div>
            <div className="input-line">
              <span className="gt">&gt;</span>
              <input
                id={`tm-first-${idSeed}`}
                type="text"
                autoComplete="given-name"
                placeholder="richard"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  clearError();
                }}
                required
                disabled={locked}
                aria-label="First name"
              />
            </div>
          </div>

          <div className="tm-field">
            <div className="prompt-line">
              <span>$</span> read --prompt <span className="arg">&quot;email&quot;</span>
            </div>
            <div className="input-line">
              <span className="gt">&gt;</span>
              <input
                id={`tm-email-${idSeed}`}
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
                aria-label="Email address"
              />
            </div>
          </div>

          <button type="submit" className="tm-cta" disabled={locked}>
            {status === "submitting"
              ? "executing…"
              : status === "success"
              ? "exit 0 ✓"
              : "$ ./join --waitlist"}
          </button>
        </form>

        <div className={metaClass} aria-live="polite">
          {status === "success"
            ? `[ ok ] welcome, ${submittedFirstName.toLowerCase()}. queued.`
            : message || "// no spam. unsubscribe whenever."}
        </div>
      </div>
    </div>
  );
}
