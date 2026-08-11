export type FilterKey = "All" | "Everyday" | "Career" | "Language";

export interface Mode {
  id: string;
  title: string;
  description: string;
  icon: string;
  filter: FilterKey[];
  span: "1" | "2"; // bento column span
  accent: string;
}

export const MODES: Mode[] = [
  {
    id: "general",
    title: "General Conversation",
    description: "Casual English chat with inline grammar & vocabulary coaching.",
    icon: "💬",
    filter: ["All", "Everyday"],
    span: "2",
    accent: "#6C63FF",
  },
  {
    id: "interview",
    title: "Job Interview Prep",
    description: "Upload your résumé for a personalised 5-round mock interview with STAR scoring.",
    icon: "💼",
    filter: ["All", "Career"],
    span: "1",
    accent: "#FF6584",
  },
  {
    id: "language",
    title: "Language Learning",
    description: "Word-by-word lessons with phonetic guides and XP tracking.",
    icon: "🌍",
    filter: ["All", "Language"],
    span: "1",
    accent: "#43D9AD",
  },
  {
    id: "public",
    title: "Public Speaking",
    description: "Delivery, structure, pacing, and confidence coaching.",
    icon: "🎤",
    filter: ["All", "Career", "Everyday"],
    span: "1",
    accent: "#F7B731",
  },
  {
    id: "ielts",
    title: "IELTS / TOEFL",
    description: "Examiner-style Part 1, 2, and 3 prompts with band scoring.",
    icon: "📝",
    filter: ["All", "Language"],
    span: "1",
    accent: "#45AAF2",
  },
  {
    id: "topic",
    title: "Your Own Topic",
    description: "Free-form practice on any subject you choose.",
    icon: "✨",
    filter: ["All", "Everyday"],
    span: "2",
    accent: "#A55EEA",
  },
];

export const METRICS = [
  { label: "Practice Modes", value: 6, suffix: "" },
  { label: "Fluency Improvement", value: 100, suffix: "%" },
  { label: "Free to Use", value: 100, suffix: "%" },
];

export const FILTERS: FilterKey[] = ["All", "Everyday", "Career", "Language"];
