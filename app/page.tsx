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
            Learn anything.
            <br />
            <span className="accent">We do the reading.</span>
          </h1>

          <p className="lede">
            Course gurus charge thousands to repackage what&apos;s already
            published. SpeedLearning summarizes the originals &mdash; books,
            papers, lectures, articles &mdash; and shapes them to how you
            learn.
          </p>

          <WaitlistForm />

          <div className="divider" />

          <div className="bullets">
            <div className="bullet">
              <h3>Any topic</h3>
              <p>
                Cohort retention, GLP-1 drugs, Constantinople 1453. If
                someone&apos;s written about it, we&apos;ll read it for you.
              </p>
            </div>
            <div className="bullet">
              <h3>How you learn</h3>
              <p>
                TLDR, executive summary, full report, slide deck, mind map.
                Pick the format that fits your brain.
              </p>
            </div>
            <div className="bullet">
              <h3>Primary sources</h3>
              <p>
                Books, papers, lectures, articles. Citations included. Not
                other gurus&apos; rewarmed courses.
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
