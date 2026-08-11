"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import HeroSection from "@/components/HeroSection";
import FilterTabs from "@/components/FilterTabs";
import BentoGrid from "@/components/BentoGrid";
import MetricCounter from "@/components/MetricCounter";
import ThemeToggle from "@/components/ThemeToggle";
import { METRICS, FilterKey } from "@/lib/modes";

export default function Home() {
  const [filter, setFilter] = useState<FilterKey>("All");

  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* Navbar */}
      <nav
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md"
        style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}
      >
        <span className="font-serif text-xl" style={{ color: "var(--text)" }}>
          Speak<span style={{ color: "var(--accent)" }}>Back</span>
        </span>
        <ThemeToggle />
      </nav>

      {/* Hero */}
      <HeroSection />

      {/* Metrics strip */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="flex justify-center gap-16 py-12 px-4"
        style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
      >
        {METRICS.map((m, i) => (
          <MetricCounter key={m.label} value={m.value} suffix={m.suffix} label={m.label} delay={i * 150} />
        ))}
      </motion.section>

      {/* Modes section */}
      <section className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="font-serif text-3xl md:text-4xl" style={{ color: "var(--text)" }}>
            Choose your practice mode
          </h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Every session ends with a detailed report — fluency score, corrections, and more.
          </p>
        </div>

        <FilterTabs active={filter} onChange={setFilter} />
        <BentoGrid filter={filter} />
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-xs" style={{ color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
        SpeakBack · MIT License · Built with Groq + Next.js
      </footer>
    </main>
  );
}
