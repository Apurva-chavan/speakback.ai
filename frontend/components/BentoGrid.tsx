"use client";

import { AnimatePresence } from "framer-motion";
import { MODES, FilterKey } from "@/lib/modes";
import ModeCard from "./ModeCard";

interface Props {
  filter: FilterKey;
}

export default function BentoGrid({ filter }: Props) {
  const visible = MODES.filter((m) => m.filter.includes(filter));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
      <AnimatePresence mode="popLayout">
        {visible.map((mode) => (
          <ModeCard key={mode.id} mode={mode} />
        ))}
      </AnimatePresence>
    </div>
  );
}
