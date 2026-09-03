import type { FooterColumn, NavLink } from "@/types";

export const NAV_LINKS: NavLink[] = [
  { label: "Product", href: "/product" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "AI Agents", href: "/agents" },
  { label: "Features", href: "/features" },
  { label: "Docs", href: "/docs" },
];

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "AI Agents", href: "/agents" },
      { label: "Documentation", href: "/docs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "GitHub", href: "/docs#github" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export const TRUST_LABELS = [
  "AI Agents",
  "Automation",
  "Code Intelligence",
  "Software Engineering",
  "Human-in-the-Loop",
];
