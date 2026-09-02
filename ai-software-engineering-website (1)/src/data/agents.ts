import {
  BookOpenText,
  Code2,
  Compass,
  DraftingCompass,
  FlaskConical,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Agent, AgentStatus } from "@/types";

export const AGENTS: Agent[] = [
  {
    id: "manager",
    name: "Manager Agent",
    shortName: "Manager",
    role: "Coordinates the engineering workflow and decides what should happen next.",
    purpose:
      "Owns the run. Breaks the request into stages, routes work to the right agent, and keeps the developer informed.",
    status: "active",
    exampleTask: "Plan run #128 for “Add Google authentication” and assign stages.",
    icon: Compass,
  },
  {
    id: "product",
    name: "Product Agent",
    shortName: "Product",
    role: "Converts ideas into requirements, features, user stories, and acceptance criteria.",
    purpose:
      "Turns loosely described intent into precise, testable requirements everyone downstream can build against.",
    status: "done",
    exampleTask: "Write acceptance criteria for OAuth sign-in and account linking.",
    icon: Sparkles,
  },
  {
    id: "architect",
    name: "Architect Agent",
    shortName: "Architect",
    role: "Designs the software architecture, APIs, database structure, and technical approach.",
    purpose:
      "Produces the technical design: system boundaries, endpoints, schema changes, and trade-offs, before code is written.",
    status: "active",
    exampleTask: "Design /auth/google callback flow and session storage schema.",
    icon: DraftingCompass,
  },
  {
    id: "coding",
    name: "Coding Agent",
    shortName: "Coding",
    role: "Creates and modifies application code.",
    purpose:
      "Implements the architecture inside your repository, following existing conventions and project memory.",
    status: "active",
    exampleTask: "Implement GoogleAuthProvider and wire it into the auth router.",
    icon: Code2,
  },
  {
    id: "testing",
    name: "Testing Agent",
    shortName: "Testing",
    role: "Creates tests and checks whether implementations work correctly.",
    purpose:
      "Writes unit and integration tests, runs the suite, and reports failures back to the Coding Agent.",
    status: "waiting",
    exampleTask: "Add integration tests for the OAuth callback and token refresh.",
    icon: FlaskConical,
  },
  {
    id: "security",
    name: "Security Agent",
    shortName: "Security",
    role: "Looks for security risks and unsafe implementations.",
    purpose:
      "Audits proposed changes for injection, secrets exposure, unsafe defaults, and dependency risks.",
    status: "idle",
    exampleTask: "Verify state parameter validation and secure cookie flags.",
    icon: ShieldCheck,
  },
  {
    id: "reviewer",
    name: "Reviewer Agent",
    shortName: "Reviewer",
    role: "Reviews AI-generated work before it reaches the developer.",
    purpose:
      "Performs a code review pass for correctness, readability, and consistency, then summarises what changed.",
    status: "reviewing",
    exampleTask: "Review 3 changed files and prepare the approval summary.",
    icon: ScanSearch,
  },
  {
    id: "docs",
    name: "Documentation Agent",
    shortName: "Docs",
    role: "Creates and maintains technical documentation.",
    purpose:
      "Keeps READMEs, API references, and architecture notes in sync with every approved change.",
    status: "idle",
    exampleTask: "Update the authentication section of the API reference.",
    icon: BookOpenText,
  },
];

export const STATUS_META: Record<AgentStatus, { label: string; dot: string; text: string }> = {
  active: { label: "Active", dot: "bg-electric", text: "text-electric-light" },
  reviewing: { label: "Reviewing", dot: "bg-ember", text: "text-ember-soft" },
  waiting: { label: "Waiting", dot: "bg-fog-2", text: "text-fog" },
  idle: { label: "Idle", dot: "bg-fog-2", text: "text-fog" },
  done: { label: "Completed", dot: "bg-success", text: "text-success" },
};
