import type { LucideIcon } from "lucide-react";

/**
 * Domain types for the AI Software Engineering OS frontend.
 * These are intentionally shaped to map onto future Supabase tables
 * (agents, projects, runs, run_stages, tasks, reviews) and real-time
 * agent status channels.
 */

export type AgentStatus = "active" | "idle" | "waiting" | "reviewing" | "done";

export interface Agent {
  id: string;
  name: string;
  shortName: string;
  role: string;
  purpose: string;
  status: AgentStatus;
  exampleTask: string;
  icon: LucideIcon;
}

export type ActivityState = "done" | "active" | "pending";

export interface ActivityItem {
  id: string;
  label: string;
  state: ActivityState;
  timestamp?: string;
}

export interface ActiveAgent {
  id: string;
  name: string;
  task: string;
  status: AgentStatus;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  repository: string;
  branch: string;
  progress: number;
  tasksDone: number;
  tasksTotal: number;
  testsPassed: number;
  openReviews: number;
  currentRun: string;
  activeAgents: ActiveAgent[];
  activity: ActivityItem[];
  log: string[];
}

export interface WorkflowStep {
  id: string;
  number: string;
  title: string;
  description: string;
}

export interface RunStage {
  id: string;
  label: string;
  kind: "user" | "agent" | "human";
  detail: string;
  icon: LucideIcon;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface ProblemArea {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface ChangedFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface DiffLine {
  type: "add" | "remove" | "context";
  text: string;
}

export interface ProposedChange {
  id: string;
  title: string;
  summary: string;
  branch: string;
  filesChanged: ChangedFile[];
  testsPassed: number;
  testsTotal: number;
  securitySummary: string;
  /** Primary diff (used in compact previews). */
  diff: DiffLine[];
  /** Per-file diffs, aligned with `filesChanged`. */
  fileDiffs?: DiffLine[][];
}

export type ReviewDecision = "pending" | "approved" | "revision";

export interface NavLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: NavLink[];
}
