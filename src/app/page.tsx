"use client";

import dynamic from "next/dynamic";

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
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "14px",
          letterSpacing: "0.2em",
        }}
      >
        LOADING NEXUS
      </div>
    ),
  }
);

export default function HomePage() {
  return (
    <main
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        background: "#000",
        overflow: "hidden",
      }}
    >
      <Experience />
    </main>
  );
}