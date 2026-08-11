"use client";

import { motion } from "framer-motion";
import { FILTERS, FilterKey } from "@/lib/modes";

interface Props {
  active: FilterKey;
  onChange: (f: FilterKey) => void;
}

export default function FilterTabs({ active, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-full p-1 gap-1"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className="relative px-5 py-1.5 rounded-full text-sm font-medium transition-colors z-10"
          style={{ color: active === f ? "#fff" : "var(--muted)" }}
        >
          {active === f && (
            <motion.span
              layoutId="pill"
              className="absolute inset-0 rounded-full z-[-1]"
              style={{ background: "var(--accent)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          {f}
        </button>
      ))}
    </div>
  );
}
