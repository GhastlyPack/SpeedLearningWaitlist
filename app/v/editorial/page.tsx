"use client";

import Link from "next/link";
import { useWaitlistForm } from "@/lib/useWaitlistForm";
import "./editorial.css";

/**
 * /v/editorial — Editorial Magazine lander variant.
 *
 * Reads as a long-form essay in a publication: masthead → headline →
 * lead art → multi-column manifesto body with drop cap and pull quotes
 * → integrated subscribe block mid-article → continued body → signature
 * → second subscribe at close → colophon.
 *
 * Conversion bet: trust earned through reading. The form isn't featured
 * in a giant card above the fold; it's integrated into the article so
 * by the time the user reaches it, they're sold. Comparison against the
 * control (which puts the form alongside the hero) is the actual test.
 *
 * Copy is placeholder — written to fill the block shapes, team will
 * refine the words. The shapes are what we're testing.
 */

const VARIANT = "editorial";

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

export default function EditorialVariantPage() {
  return (
    <div className="ed-page">
      <Masthead />

      <article>
        <ArticleHead />
        <div className="ed-container">
          <LeadArt />
          <BodyTop />
          <SubscribeBlock corner="/ subscribe" />
          <BodyBottom />
          <Signature />
          <SubscribeBlock
            corner="/ one more time"
            heading="Don't miss the launch issue."
            description="50% off our first 1,000 readers. Same form, last call."
          />
        </div>
      </article>

      <Colophon />
    </div>
  );
}

function Masthead() {
  return (
    <header className="ed-masthead">
      <div className="wordmark">SpeedLearning</div>
      <div className="issue">Vol. 01 · Issue 01 · May 2026</div>
      <div className="tagline">All the topics, any of the time.</div>
    </header>
  );
}

function ArticleHead() {
  return (
    <div className="ed-container ed-article-head">
      <div className="ed-kicker">A manifesto</div>
      <h1 className="ed-headline">
        We&apos;ve been <em>learning</em> wrong.
      </h1>
      <p className="ed-standfirst">
        Internet courses are a tax on curiosity. We&apos;re refunding it for
        $50 a topic.
      </p>
      <div className="ed-byline">
        By the SpeedLearning team
        <span className="dot">·</span>6 min read
        <span className="dot">·</span>May 2026
      </div>
    </div>
  );
}

function LeadArt() {
  return (
    <figure className="ed-lead-art">
      <div className="block" />
      <figcaption className="caption">
        The average $2,000 online course delivers ~3 hours of useful
        information. Source: every course graduate, ever.
      </figcaption>
    </figure>
  );
}

function BodyTop() {
  return (
    <section className="ed-body ed-body--cols">
      <p className="drop">
        Sometime in the last decade, a strange tax got introduced to the
        internet. The information was free, but the people who packaged
        it into &ldquo;courses&rdquo; started charging four-figure prices
        to sell it back to you. They added a private Discord and a money-
        back guarantee, and that was supposed to be enough.
      </p>
      <p>
        It worked, for a while. People paid. The gurus made a fortune. The
        students learned somewhere between a little and not much, then
        churned, then signed up for the next one.
      </p>
      <p>
        We think this is solvable. Not by writing a better course. By
        skipping the entire form factor.
      </p>

      <blockquote className="ed-pullquote">
        $50 flat. One library. Anything you want to learn.
      </blockquote>

      <p>
        Type a topic. SpeedLearning pulls 50+ sources from across the
        public internet — videos, articles, papers, podcasts — evaluates
        each one, and synthesizes a complete learning library that you
        can actually finish in a single afternoon.
      </p>
      <p>
        Every claim cites its source. Every output is something you can
        keep, share, or quiz yourself with. No Discord. No upsell. The
        whole thing is yours after one payment.
      </p>

      <h2 className="ed-subhead">What you&apos;ll receive</h2>
      <p>
        Ten artifacts per topic. Designed to be the last thing you need
        to read, watch, or open on the subject:
      </p>

      <ol className="ed-outputs">
        {OUTPUTS.map((label, i) => (
          <li key={label} className="row">
            <span className="n">{String(i + 1).padStart(2, "0")}</span>
            <span className="name">{label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function BodyBottom() {
  return (
    <section className="ed-body">
      <h2 className="ed-subhead">Why it&apos;s $50</h2>
      <p>
        Because the unit economics work at $50 and not at $0. The model
        runs costs, the synthesis layer runs costs, citation verification
        runs costs. Anything cheaper means we cut corners on one of those
        and the output rots. Anything more and we&apos;re selling you the
        same thing the gurus sell, with a different mark on the box.
      </p>
      <p>
        Fifty dollars puts it inside the range of &ldquo;cost of a
        textbook&rdquo; rather than &ldquo;cost of a course.&rdquo; That
        feels right.
      </p>

      <h2 className="ed-subhead">Why a waitlist</h2>
      <p>
        We&apos;re finishing the synthesis quality bar before opening it
        up. People on the list get 50% off the first deep dive, early
        access by a week or two, and the chance to vote on which topics
        we feature in the launch issue.
      </p>
    </section>
  );
}

function Signature() {
  return (
    <p className="ed-signature">— The SpeedLearning team</p>
  );
}

function Colophon() {
  return (
    <footer className="ed-colophon">
      <div className="line">© 2026 SpeedLearning · Vol. 01 · Issue 01</div>
      <div className="line">
        Filed under: AI, Learning, Waitlist ·{" "}
        <Link href="/">← Back to homepage</Link>
      </div>
    </footer>
  );
}

/**
 * Subscribe block — embedded inside the article, styled to look like a
 * pull-out callout rather than a marketing CTA. Uses the same
 * useWaitlistForm hook so wiring matches every other variant.
 */
function SubscribeBlock({
  corner,
  heading = "Get the launch issue.",
  description = "We'll send the first deep dive the day we open. No marketing in between.",
}: {
  corner: string;
  heading?: string;
  description?: string;
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
      ? "ed-form-meta error"
      : status === "success"
      ? "ed-form-meta success"
      : "ed-form-meta";

  const idSeed = corner.replace(/[^a-z0-9]/gi, "");

  return (
    <aside className="ed-subscribe">
      <span className="corner">{corner}</span>
      <h2>{heading}</h2>
      <p className="desc">{description}</p>

      <form className="ed-form" onSubmit={submit} noValidate>
        <div className="ed-field">
          <label htmlFor={`ed-first-${idSeed}`}>First name</label>
          <input
            id={`ed-first-${idSeed}`}
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
        <div className="ed-field">
          <label htmlFor={`ed-email-${idSeed}`}>Email</label>
          <input
            id={`ed-email-${idSeed}`}
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
        <div />
        <button type="submit" className="ed-cta" disabled={locked}>
          {status === "submitting"
            ? "Adding…"
            : status === "success"
            ? "Joined"
            : "Subscribe"}
        </button>
      </form>

      <div className={metaClass} aria-live="polite">
        {status === "success"
          ? `Welcome aboard, ${submittedFirstName}. The launch issue is en route.`
          : message ||
            "Unsubscribe anytime. We send the launch, then occasional dispatches."}
      </div>
    </aside>
  );
}
