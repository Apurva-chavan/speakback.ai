"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import type { Mode } from "@/lib/modes";

interface Props {
  mode: Mode;
}

export default function ModeCard({ mode }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25 }}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`glow-card rounded-2xl p-6 flex flex-col gap-3 cursor-pointer group ${
        mode.span === "2" ? "md:col-span-2" : "col-span-1"
      }`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <span className="text-3xl">{mode.icon}</span>
      <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
        {mode.title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        {mode.description}
      </p>
      <div className="mt-auto pt-2">
        <span
          className="text-xs font-medium px-3 py-1 rounded-full"
          style={{ background: `${mode.accent}18`, color: mode.accent }}
        >
          {mode.filter.filter((f) => f !== "All").join(" · ") || "General"}
        </span>
      </div>
    </motion.div>
  );
}
