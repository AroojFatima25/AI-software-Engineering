import {
  BookOpenText,
  Brain,
  Bug,
  ClipboardList,
  Code2,
  DraftingCompass,
  FileText,
  FlaskConical,
  GitBranch,
  ListChecks,
  Network,
  ScanSearch,
  ShieldCheck,
  UserCheck,
  Workflow,
  Layers,
} from "lucide-react";
import type { Feature, ProblemArea } from "@/types";

export const PROBLEM_AREAS: ProblemArea[] = [
  {
    id: "requirements",
    title: "Requirements",
    description: "Turning a vague idea into something precise enough to build.",
    icon: ClipboardList,
  },
  {
    id: "architecture",
    title: "Architecture",
    description: "Deciding on boundaries, data models, and APIs before code exists.",
    icon: DraftingCompass,
  },
  {
    id: "coding",
    title: "Coding",
    description: "Implementing changes consistently across a growing codebase.",
    icon: Code2,
  },
  {
    id: "testing",
    title: "Testing",
    description: "Writing and maintaining tests that actually catch regressions.",
    icon: FlaskConical,
  },
  {
    id: "debugging",
    title: "Debugging",
    description: "Tracing failures back through layers you didn't write yesterday.",
    icon: Bug,
  },
  {
    id: "security",
    title: "Security",
    description: "Remembering every unsafe default while shipping under pressure.",
    icon: ShieldCheck,
  },
  {
    id: "documentation",
    title: "Documentation",
    description: "Keeping docs true to the code after every change.",
    icon: FileText,
  },
  {
    id: "review",
    title: "Code Review",
    description: "Reviewing carefully when you're also the one who wrote it.",
    icon: ScanSearch,
  },
];

export const FEATURES: Feature[] = [
  {
    id: "planning",
    title: "AI Project Planning",
    description: "Ideas become structured requirements, milestones, and tasks.",
    icon: ClipboardList,
  },
  {
    id: "multi-agent",
    title: "Multi-Agent Engineering",
    description: "Specialised agents collaborate on each stage of the work.",
    icon: Network,
  },
  {
    id: "architecture",
    title: "Architecture Generation",
    description: "System design, API contracts, and schemas proposed up front.",
    icon: DraftingCompass,
  },
  {
    id: "codegen",
    title: "AI Code Generation",
    description: "Changes implemented inside your repository, in your conventions.",
    icon: Code2,
  },
  {
    id: "testing",
    title: "Automated Testing",
    description: "Tests written and executed for every proposed change.",
    icon: FlaskConical,
  },
  {
    id: "security",
    title: "Security Analysis",
    description: "Every change set checked for risky patterns and exposures.",
    icon: ShieldCheck,
  },
  {
    id: "review",
    title: "Code Review",
    description: "An AI review pass with a readable summary before you look.",
    icon: ScanSearch,
  },
  {
    id: "docs",
    title: "Documentation",
    description: "Technical docs generated and kept current with the code.",
    icon: BookOpenText,
  },
  {
    id: "github",
    title: "GitHub Integration",
    description: "Branches, commits, and pull requests in your existing flow.",
    icon: GitBranch,
  },
  {
    id: "memory",
    title: "Project Memory",
    description: "Decisions, conventions, and context persist across runs.",
    icon: Brain,
  },
  {
    id: "tasks",
    title: "Task Management",
    description: "Track what agents are doing and what is waiting on you.",
    icon: ListChecks,
  },
  {
    id: "approval",
    title: "Human Approval",
    description: "Nothing important ships without an explicit developer decision.",
    icon: UserCheck,
  },
];

export const CONTEXT_NODES = [
  "Projects",
  "Code",
  "Requirements",
  "Tasks",
  "AI Agents",
  "Tests",
  "Reviews",
  "Documentation",
];

export const TRADITIONAL_FLOW = [
  "Idea",
  "Docs",
  "Project Management",
  "IDE",
  "AI Chat",
  "Testing",
  "Code Review",
  "Documentation",
];

export const AIOS_FLOW = ["Idea", "AI Engineering Workspace", "Plan", "Build", "Test", "Review", "Ship"];

export const PRODUCTIVITY_POINTS = [
  {
    title: "One shared context",
    description: "Requirements, code, tests, and reviews live in the same workspace, so nothing is lost between tools.",
    icon: Layers,
  },
  {
    title: "Fewer handoffs",
    description: "Agents pass work to each other automatically. You step in where judgement matters.",
    icon: Workflow,
  },
  {
    title: "Reviewed before it ships",
    description: "Every change is tested, security-checked, and summarised before it reaches you.",
    icon: UserCheck,
  },
];
