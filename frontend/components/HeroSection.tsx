"use client";

import { motion } from "framer-motion";

const words = ["Master", "your", "speech.", "Perfect", "your", "flow."];

export default function HeroSection() {
  return (
    <section className="flex flex-col items-center text-center gap-6 pt-24 pb-16 px-4">
      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-xs font-medium px-4 py-1.5 rounded-full border"
        style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--surface)" }}
      >
        Powered by Groq · Free to use
      </motion.div>

      {/* Headline — word-by-word reveal */}
      <h1 className="font-serif text-5xl md:text-7xl leading-tight max-w-3xl">
        {words.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
            className="inline-block mr-[0.25em]"
            style={{ color: i >= 3 ? "var(--accent)" : "var(--text)" }}
          >
            {word}
          </motion.span>
        ))}
      </h1>

      {/* Subheading */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="text-lg max-w-xl"
        style={{ color: "var(--muted)" }}
      >
        Real-time voice coaching across 6 modes — interviews, IELTS, public speaking, and more.
      </motion.p>

      {/* CTA */}
      <motion.a
        href="http://localhost:3000"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.85 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="mt-2 px-8 py-3 rounded-full text-white font-medium text-base shadow-lg"
        style={{ background: "var(--accent)" }}
      >
        Start Practicing →
      </motion.a>
    </section>
  );
}
