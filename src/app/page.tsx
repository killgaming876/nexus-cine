"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Experience = dynamic(
  () =>
    import("../components/scene/Experience").then(
      (mod) => mod.Experience
    ),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020202",
          color: "#fff",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.35em",
        }}
      >
        LOADING NEXUS
      </div>
    ),
  }
);

export default function HomePage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const documentHeight =
        document.documentElement.scrollHeight - window.innerHeight;

      const progress =
        documentHeight > 0
          ? Math.min(1, Math.max(0, scrollTop / documentHeight))
          : 0;

      setScrollProgress(progress);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToSection = (id: string) => {
    setMenuOpen(false);

    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#020202",
        color: "#fff",
        overflowX: "hidden",
      }}
    >
      {/* =========================================================
          FIXED 3D EXPERIENCE
          ========================================================= */}

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <Experience
          showNarration={true}
          atmosphereQuality="high"
        />
      </div>

      {/* =========================================================
          CINEMATIC VIGNETTE
          ========================================================= */}

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.45) 100%)",
        }}
      />

      {/* =========================================================
          TOP NAVIGATION
          ========================================================= */}

      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: "88px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 42px",
          pointerEvents: "none",
        }}
      >
        <button
          onClick={() => scrollToSection("hero")}
          style={{
            pointerEvents: "auto",
            border: "none",
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
            padding: 0,
            fontSize: "17px",
            fontWeight: 800,
            letterSpacing: "0.3em",
          }}
        >
          NEXUS
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "32px",
            pointerEvents: "auto",
          }}
        >
          <button
            onClick={() => scrollToSection("journey")}
            className="nexus-nav-link"
          >
            JOURNEY
          </button>

          <button
            onClick={() => scrollToSection("product")}
            className="nexus-nav-link"
          >
            PRODUCT
          </button>

          <button
            onClick={() => scrollToSection("contact")}
            className="nexus-nav-link"
          >
            CONTACT
          </button>

          <button
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Toggle menu"
            style={{
              width: "42px",
              height: "42px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.2)",
              backdropFilter: "blur(12px)",
              cursor: "pointer",
            }}
          >
            <span className="nexus-menu-line" />
            <span className="nexus-menu-line" />
          </button>
        </div>
      </header>

      {/* =========================================================
          MOBILE / EXPANDED MENU
          ========================================================= */}

      {menuOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 45,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.94)",
            backdropFilter: "blur(25px)",
          }}
        >
          <nav
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "28px",
            }}
          >
            {[
              ["hero", "HOME"],
              ["journey", "JOURNEY"],
              ["product", "PRODUCT"],
              ["contact", "CONTACT"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "clamp(28px, 5vw, 64px)",
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* =========================================================
          SIDE PROGRESS
          ========================================================= */}

      <div
        style={{
          position: "fixed",
          right: "34px",
          top: "50%",
          zIndex: 40,
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "1px",
            height: "130px",
            background: "rgba(255,255,255,0.15)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${scrollProgress * 100}%`,
              background: "#fff",
              transition: "height 100ms linear",
            }}
          />
        </div>

        <span
          style={{
            fontSize: "8px",
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.5)",
            writingMode: "vertical-rl",
          }}
        >
          {String(Math.round(scrollProgress * 100)).padStart(2, "0")}%
        </span>
      </div>

      {/* =========================================================
          HERO
          ========================================================= */}

      <section
        id="hero"
        style={{
          position: "relative",
          zIndex: 5,
          minHeight: "100vh",
          display: "flex",
          alignItems: "flex-end",
          padding:
            "0 clamp(24px, 8vw, 120px) clamp(80px, 12vh, 140px)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            maxWidth: "1000px",
          }}
        >
          <div className="nexus-eyebrow">
            NEXUS / 001
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(64px, 12vw, 190px)",
              lineHeight: 0.78,
              letterSpacing: "-0.075em",
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            ENTER
            <br />
            <span
              style={{
                color: "rgba(255,255,255,0.18)",
              }}
            >
              THE
            </span>
            <br />
            UNKNOWN.
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
              marginTop: "42px",
            }}
          >
            <span className="nexus-scroll-dot" />

            <span className="nexus-meta">
              SCROLL TO BEGIN THE JOURNEY
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================
          JOURNEY
          ========================================================= */}

      <section
        id="journey"
        style={{
          position: "relative",
          zIndex: 5,
          minHeight: "160vh",
          display: "flex",
          alignItems: "center",
          padding:
            "180px clamp(24px, 8vw, 120px)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1fr) minmax(260px, 420px)",
            gap: "10vw",
            alignItems: "center",
          }}
        >
          <div>
            <div className="nexus-eyebrow">
              02 / THE JOURNEY
            </div>

            <h2 className="nexus-heading">
              MOTION
              <br />
              BECOMES
              <br />
              MEMORY.
            </h2>
          </div>

          <div
            style={{
              paddingTop: "120px",
            }}
          >
            <p className="nexus-body">
              Space changes when you move through it. The station
              becomes the first chapter, carrying the camera through
              an evolving environment of light, depth and motion.
            </p>

            <div className="nexus-number">
              01
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          TRANSITION
          ========================================================= */}

      <section
        style={{
          position: "relative",
          zIndex: 5,
          minHeight: "120vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          pointerEvents: "none",
          padding: "120px 24px",
        }}
      >
        <div>
          <div className="nexus-eyebrow">
            THE TRANSITION
          </div>

          <p
            style={{
              margin: "28px auto 0",
              maxWidth: "600px",
              fontSize: "clamp(24px, 4vw, 52px)",
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              fontWeight: 600,
            }}
          >
            WHEN THE WORLD STOPS,
            <br />
            THE OBJECT STARTS MOVING.
          </p>
        </div>
      </section>

      {/* =========================================================
          PRODUCT
          ========================================================= */}

      <section
        id="product"
        style={{
          position: "relative",
          zIndex: 5,
          minHeight: "150vh",
          display: "flex",
          alignItems: "center",
          padding:
            "180px clamp(24px, 8vw, 120px)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns:
              "minmax(260px, 420px) minmax(0, 1fr)",
            gap: "10vw",
            alignItems: "center",
          }}
        >
          <div>
            <div className="nexus-eyebrow">
              03 / PRODUCT REVEAL
            </div>

            <h2 className="nexus-heading">
              FORM
              <br />
              FOLLOWS
              <br />
              MOTION.
            </h2>

            <p className="nexus-body">
              A product reveal built around scale, rotation,
              controlled lighting and cinematic camera movement.
            </p>
          </div>

          <div
            style={{
              minHeight: "500px",
            }}
          />
        </div>
      </section>

      {/* =========================================================
          FINAL HERO
          ========================================================= */}

      <section
        style={{
          position: "relative",
          zIndex: 5,
          minHeight: "110vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "120px 24px",
          pointerEvents: "none",
        }}
      >
        <div>
          <div className="nexus-eyebrow">
            04 / NEXUS
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: "clamp(64px, 13vw, 190px)",
              lineHeight: 0.78,
              letterSpacing: "-0.08em",
              fontWeight: 800,
            }}
          >
            KEEP
            <br />
            <span
              style={{
                color: "rgba(255,255,255,0.18)",
              }}
            >
              MOVING.
            </span>
          </h2>

          <p
            style={{
              maxWidth: "460px",
              margin: "45px auto 0",
              color: "rgba(255,255,255,0.48)",
              fontSize: "14px",
              lineHeight: 1.8,
            }}
          >
            The experience doesn't end at the object. It ends
            when you decide where to go next.
          </p>
        </div>
      </section>

      {/* =========================================================
          CONTACT / CTA
          ========================================================= */}

      <section
        id="contact"
        style={{
          position: "relative",
          zIndex: 5,
          minHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding:
            "120px clamp(24px, 8vw, 120px)",
        }}
      >
        <div className="nexus-eyebrow">
          NEXUS / FINAL
        </div>

        <h2 className="nexus-heading">
          WHAT'S
          <br />
          NEXT?
        </h2>

        <div
          style={{
            marginTop: "60px",
            display: "flex",
            gap: "18px",
            flexWrap: "wrap",
            pointerEvents: "auto",
          }}
        >
          <button
            onClick={() => scrollToSection("hero")}
            className="nexus-primary-button"
          >
            RETURN TO START
          </button>

          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="nexus-secondary-button"
          >
            REPLAY EXPERIENCE
          </button>
        </div>
      </section>

      {/* =========================================================
          FOOTER
          ========================================================= */}

      <footer
        style={{
          position: "relative",
          zIndex: 10,
          minHeight: "120px",
          padding: "35px 42px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop:
            "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.35)",
          fontSize: "9px",
          letterSpacing: "0.2em",
        }}
      >
        <span>NEXUS</span>

        <span>
          CINEMATIC DIGITAL EXPERIENCE
        </span>

        <span>
          2026
        </span>
      </footer>

      {/* =========================================================
          PAGE-SPECIFIC CSS
          ========================================================= */}

      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #020202;
        }

        .nexus-nav-link {
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.55);
          cursor: pointer;
          font-family: inherit;
          font-size: 9px;
          letter-spacing: 0.2em;
          transition:
            color 200ms ease,
            transform 200ms ease;
        }

        .nexus-nav-link:hover {
          color: #fff;
          transform: translateY(-1px);
        }

        .nexus-menu-line {
          display: block;
          width: 14px;
          height: 1px;
          background: rgba(255, 255, 255, 0.8);
        }

        .nexus-eyebrow {
          margin-bottom: 28px;
          color: rgba(255, 255, 255, 0.42);
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.35em;
        }

        .nexus-heading {
          margin: 0;
          font-size: clamp(58px, 9vw, 140px);
          line-height: 0.82;
          letter-spacing: -0.07em;
          font-weight: 800;
        }

        .nexus-body {
          margin: 0;
          max-width: 390px;
          color: rgba(255, 255, 255, 0.48);
          font-size: 14px;
          line-height: 1.9;
        }

        .nexus-meta {
          color: rgba(255, 255, 255, 0.42);
          font-size: 9px;
          letter-spacing: 0.25em;
        }

        .nexus-scroll-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 0 18px rgba(255, 255, 255, 0.8);
          animation: nexus-pulse 2s ease-in-out infinite;
        }

        .nexus-number {
          margin-top: 60px;
          color: rgba(255, 255, 255, 0.15);
          font-size: 100px;
          font-weight: 800;
          letter-spacing: -0.08em;
        }

        .nexus-primary-button,
        .nexus-secondary-button {
          min-height: 48px;
          padding: 0 25px;
          border-radius: 999px;
          cursor: pointer;
          font-family: inherit;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.2em;
          transition:
            transform 200ms ease,
            background 200ms ease,
            border-color 200ms ease;
        }

        .nexus-primary-button {
          border: 1px solid #fff;
          background: #fff;
          color: #000;
        }

        .nexus-secondary-button {
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.04);
          color: #fff;
        }

        .nexus-primary-button:hover,
        .nexus-secondary-button:hover {
          transform: translateY(-2px);
        }

        .nexus-secondary-button:hover {
          border-color: rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.08);
        }

        @keyframes nexus-pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.5;
          }

          50% {
            transform: scale(1.6);
            opacity: 1;
          }
        }

        @media (max-width: 800px) {
          header {
            padding-left: 22px !important;
            padding-right: 22px !important;
          }

          header > div > .nexus-nav-link {
            display: none;
          }

          .nexus-heading {
            font-size: clamp(48px, 14vw, 90px);
          }

          section {
            padding-left: 24px !important;
            padding-right: 24px !important;
          }

          #journey > div,
          #product > div {
            grid-template-columns: 1fr !important;
            gap: 60px !important;
          }

          #product > div > div:last-child {
            min-height: 250px !important;
          }

          footer {
            padding-left: 24px !important;
            padding-right: 24px !important;
          }

          footer span:nth-child(2) {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}
