"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

interface Props {
  value: number;
  suffix?: string;
  label: string;
  delay?: number;
}

export default function MetricCounter({ value, suffix = "", label, delay = 0 }: Props) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const timeout = setTimeout(() => {
      const duration = 1500;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      const interval = setInterval(() => {
        current += increment;
        if (current >= value) {
          setCount(value);
          clearInterval(interval);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [inView, value, delay]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <span className="text-4xl font-serif font-bold" style={{ color: "var(--accent)" }}>
        {count}{suffix}
      </span>
      <span className="text-sm" style={{ color: "var(--muted)" }}>{label}</span>
    </div>
  );
}
