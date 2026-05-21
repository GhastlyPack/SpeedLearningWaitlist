import WaitlistForm from "./WaitlistForm";

export default function Home() {
  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          SpeedLearning
        </div>
        <div className="eyebrow">Waitlist · 2026</div>
      </header>

      <main className="hero">
        <div className="hero-inner">
          <div className="eyebrow hero-eyebrow">
            <span className="dot" />
            Now accepting early access
          </div>

          <h1>
            Learn anything in
            <br />
            <span className="accent">30 to 60 minutes.</span>
          </h1>

          <p className="lede">
            Type a topic. SpeedLearning pulls the top videos, articles, papers,
            and transcripts on it &mdash; then synthesizes a complete library:
            TLDR, full report with citations, slide deck, mind map, flashcards,
            explainer infographics, a deep-dive video, and an AI chat partner
            trained on every source.
          </p>

          <div className="form-bonus">
            <span className="bonus-tag">Bonus</span>
            <span>50% off your first Deep Dive &mdash; waitlist signups only.</span>
          </div>

          <WaitlistForm />

          <div className="divider" />

          <div className="bullets">
            <div className="bullet">
              <h3>30 to 60 minutes</h3>
              <p>
                From &ldquo;I want to learn X&rdquo; to a complete,
                source-cited library. Runs in the background while you work.
              </p>
            </div>
            <div className="bullet">
              <h3>Ten ways to learn</h3>
              <p>
                TLDR, executive summary, full report, slide deck, mind map,
                flashcards, explainer infographics, deep-dive video, source
                list, and a chat partner that knows every source.
              </p>
            </div>
            <div className="bullet">
              <h3>Flat $50 per topic</h3>
              <p>
                One price for a deep dive on anything. No subscription, no
                tiers. Earn free credits by inviting friends and completing
                assessment quizzes.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <div>&copy; SpeedLearning</div>
        <div>speedlearning.com</div>
      </footer>
    </div>
  );
}
