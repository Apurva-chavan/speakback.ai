"use client";

import { useEffect, useRef, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  function toggle() {
    const btn = btnRef.current;
    const overlay = overlayRef.current;
    if (!btn || !overlay) return;

    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    overlay.style.setProperty("--origin-x", `${x}px`);
    overlay.style.setProperty("--origin-y", `${y}px`);
    overlay.style.background = dark ? "#F5F4F0" : "#0B0F19";
    overlay.classList.add("expanding");

    setTimeout(() => {
      setDark((d) => !d);
      overlay.classList.remove("expanding");
    }, 600);
  }

  return (
    <>
      <div ref={overlayRef} className="theme-transition-overlay" />
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Toggle theme"
        className="w-9 h-9 rounded-full flex items-center justify-center border transition-colors"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
      >
        {dark ? "☀️" : "🌙"}
      </button>
    </>
  );
}
