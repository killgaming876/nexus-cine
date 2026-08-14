"use client";

import Experience from "@/components/scene/Experience";

export default function HomePage() {
  const scrollToStart = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const replayExperience = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <main className="nexus-page">
      {/* =====================================================
          ACTUAL 3D EXPERIENCE
          ===================================================== */}

      <Experience />

      {/* =====================================================
          FIXED PROGRESS
          ===================================================== */}

      <div
        className="nexus-progress"
        aria-hidden="true"
      />

      {/* =====================================================
          HERO
          ===================================================== */}

      <section
        className="nexus-section nexus-section--hero"
        style={{
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          className="nexus-fill"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "32px",
          }}
        >
          <div
            style={{
              maxWidth: "1100px",
              width: "100%",
              transformStyle: "preserve-3d",
            }}
          >
            <div
              className="nexus-hud nexus-reveal nexus-reveal--delay-1"
              style={{
                marginBottom: "24px",
              }}
            >
              NEXUS / 00
            </div>

            <h1
              className="nexus-display nexus-gradient-text nexus-reveal nexus-reveal--delay-2"
              style={{
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              ENTER
              <br />
              THE UNKNOWN.
            </h1>

            <p
              className="nexus-reveal nexus-reveal--delay-3"
              style={{
                margin:
                  "42px auto 0",
                maxWidth: "580px",
                color:
                  "rgba(255,255,255,0.54)",
                fontSize:
                  "clamp(14px, 1.5vw, 18px)",
                lineHeight: 1.7,
                letterSpacing:
                  "0.03em",
              }}
            >
              A cinematic passage through
              space, motion, architecture
              and product form.
            </p>

            <button
              type="button"
              className="nexus-button nexus-button-shine nexus-reveal nexus-reveal--delay-4"
              style={{
                marginTop: "42px",
              }}
              onClick={() => {
                window.scrollTo({
                  top:
                    window.innerHeight * 0.95,
                  behavior: "smooth",
                });
              }}
            >
              <span>
                SCROLL TO BEGIN THE JOURNEY
              </span>

              <span
                aria-hidden="true"
                style={{
                  fontSize: "16px",
                }}
              >
                ↓
              </span>
            </button>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "40px",
            transform:
              "translateX(-50%)",
          }}
        >
          <div className="nexus-scroll-indicator" />
        </div>
      </section>

      {/* =====================================================
          JOURNEY
          ===================================================== */}

      <section
        className="nexus-section nexus-section--tall"
        style={{
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: "100%",
            padding:
              "10vh clamp(24px, 8vw, 120px)",
          }}
        >
          <div
            className="nexus-hud"
            style={{
              marginBottom: "20px",
            }}
          >
            02 / THE JOURNEY
          </div>

          <h2
            className="nexus-gradient-text"
            style={{
              margin: 0,
              maxWidth: "900px",
              fontSize:
                "clamp(3rem, 8vw, 8rem)",
              lineHeight: 0.9,
              letterSpacing: "-0.06em",
            }}
          >
            MOTION
            <br />
            BECOMES MEMORY.
          </h2>

          <p
            style={{
              maxWidth: "560px",
              marginTop: "42px",
              color:
                "rgba(255,255,255,0.55)",
              fontSize:
                "clamp(15px, 1.6vw, 20px)",
              lineHeight: 1.8,
            }}
          >
            Space changes when you move
            through it. The station becomes
            the first chapter, carrying the
            camera through an evolving
            environment of light, depth
            and motion.
          </p>

          <div
            className="nexus-glass nexus-corner-frame"
            style={{
              width:
                "min(390px, 100%)",
              padding: "24px",
              marginTop: "60px",
            }}
          >
            <div className="nexus-hud">
              CAMERA PATH
            </div>

            <div
              style={{
                marginTop: "12px",
                color: "#fff",
                fontSize: "18px",
                lineHeight: 1.5,
              }}
            >
              Depth
              <br />
              Perspective
              <br />
              Continuous Motion
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          TRANSITION
          ===================================================== */}

      <section
        className="nexus-section nexus-section--tall"
        style={{
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: "100%",
            padding:
              "10vh clamp(24px, 8vw, 120px)",
            display: "flex",
            justifyContent:
              "flex-end",
          }}
        >
          <div
            style={{
              width:
                "min(800px, 100%)",
            }}
          >
            <div
              className="nexus-hud"
              style={{
                marginBottom: "20px",
              }}
            >
              01
            </div>

            <h2
              style={{
                margin: 0,
                fontSize:
                  "clamp(3rem, 8vw, 7rem)",
                lineHeight: 0.92,
                letterSpacing: "-0.06em",
                textTransform:
                  "uppercase",
              }}
            >
              THE
              <br />
              <span className="nexus-gradient-text">
                TRANSITION
              </span>
            </h2>

            <p
              style={{
                marginTop: "32px",
                maxWidth: "540px",
                color:
                  "rgba(255,255,255,0.5)",
                fontSize:
                  "clamp(15px, 1.5vw, 18px)",
                lineHeight: 1.7,
              }}
            >
              WHEN THE WORLD STOPS,
              <br />
              THE OBJECT STARTS MOVING.
            </p>

            <div
              className="nexus-ring"
              style={{
                position: "relative",
                marginTop: "80px",
                width: "220px",
                height: "220px",
              }}
            >
              <div
                className="nexus-orbit"
                style={{
                  inset: "-20%",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          PRODUCT REVEAL
          ===================================================== */}

      <section
        className="nexus-section nexus-section--tall"
        style={{
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: "100%",
            padding:
              "10vh clamp(24px, 8vw, 120px)",
            display: "flex",
            alignItems: "flex-end",
            minHeight: "100%",
          }}
        >
          <div>
            <div
              className="nexus-hud"
              style={{
                marginBottom: "20px",
              }}
            >
              03 / PRODUCT REVEAL
            </div>

            <h2
              className="nexus-gradient-text"
              style={{
                margin: 0,
                fontSize:
                  "clamp(3.5rem, 9vw, 9rem)",
                lineHeight: 0.84,
                letterSpacing: "-0.07em",
              }}
            >
              FORM
              <br />
              FOLLOWS
              <br />
              MOTION.
            </h2>

            <p
              style={{
                maxWidth: "520px",
                marginTop: "36px",
                color:
                  "rgba(255,255,255,0.52)",
                fontSize:
                  "clamp(15px, 1.5vw, 19px)",
                lineHeight: 1.7,
              }}
            >
              A product reveal built around
              scale, rotation, controlled
              lighting and cinematic camera
              movement.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          NEXUS
          ===================================================== */}

      <section
        className="nexus-section nexus-section--tall"
        style={{
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: "100%",
            padding:
              "10vh clamp(24px, 8vw, 120px)",
          }}
        >
          <div className="nexus-hud">
            04 / NEXUS
          </div>

          <h2
            style={{
              marginTop: "20px",
              marginBottom: 0,
              fontSize:
                "clamp(4rem, 10vw, 10rem)",
              lineHeight: 0.83,
              letterSpacing: "-0.07em",
            }}
          >
            KEEP
            <br />
            <span className="nexus-gradient-text">
              MOVING.
            </span>
          </h2>

          <p
            style={{
              maxWidth: "560px",
              marginTop: "42px",
              color:
                "rgba(255,255,255,0.55)",
              fontSize:
                "clamp(15px, 1.5vw, 20px)",
              lineHeight: 1.8,
            }}
          >
            The experience doesn't end at
            the object. It ends when you
            decide where to go next.
          </p>
        </div>
      </section>

      {/* =====================================================
          FINAL
          ===================================================== */}

      <section
        className="nexus-section"
        style={{
          minHeight: "100svh",
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: "100%",
            textAlign: "center",
            padding: "40px 24px",
          }}
        >
          <div
            className="nexus-hud"
            style={{
              marginBottom: "22px",
            }}
          >
            NEXUS / FINAL
          </div>

          <h2
            className="nexus-gradient-text"
            style={{
              margin: 0,
              fontSize:
                "clamp(4rem, 11vw, 12rem)",
              lineHeight: 0.8,
              letterSpacing: "-0.08em",
            }}
          >
            WHAT'S
            <br />
            NEXT?
          </h2>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: "14px",
              marginTop: "54px",
            }}
          >
            <button
              type="button"
              className="nexus-button"
              onClick={replayExperience}
            >
              RETURN TO START
            </button>

            <button
              type="button"
              className="nexus-button nexus-button-shine"
              onClick={scrollToStart}
            >
              REPLAY EXPERIENCE
            </button>
          </div>

          <div
            style={{
              marginTop: "90px",
              color:
                "rgba(255,255,255,0.28)",
              fontFamily:
                '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
              fontSize: "10px",
              letterSpacing:
                "0.18em",
              lineHeight: 2,
            }}
          >
            NEXUS
            <br />
            CINEMATIC DIGITAL EXPERIENCE
            <br />
            2026
          </div>
        </div>
      </section>
    </main>
  );
}
