"use client";

export function WebGLFallback() {
  return (
    <div className="nexus-fallback">
      <div className="nexus-fallback__noise" />

      <header className="nexus-fallback__nav">
        <div className="nexus-fallback__logo">NEXUS</div>

        <div className="nexus-fallback__status">
          <span />
          EXPERIENCE MODE
        </div>
      </header>

      <main className="nexus-fallback__content">
        <div className="nexus-fallback__eyebrow">
          CINEMATIC DIGITAL EXPERIENCE
        </div>

        <h1>
          MOVE
          <br />
          <span>BEYOND</span>
          <br />
          ORDINARY.
        </h1>

        <p>
          An immersive journey through space, motion, products and
          interaction.
        </p>

        <div className="nexus-fallback__line" />

        <div className="nexus-fallback__meta">
          <span>01</span>
          <span>THE JOURNEY BEGINS</span>
        </div>
      </main>

      <div className="nexus-fallback__orb" />
      <div className="nexus-fallback__grid" />

      <footer className="nexus-fallback__footer">
        <span>NEXUS</span>
        <span>SCROLL TO EXPLORE</span>
      </footer>
    </div>
  );
}