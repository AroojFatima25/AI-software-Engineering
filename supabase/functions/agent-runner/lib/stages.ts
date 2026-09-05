/**
 * The autonomous pipeline: stage order, owning agent, and the shape of each
 * stage's output.
 *
 * The seven stage keys below are written to `run_stages.stage_key` and rendered
 * verbatim by the dashboard (`RunsSection.tsx` labels them with `labelize`), so
 * they are part of the contract with the frontend and must not be renamed.
 *
 * Agent keys mirror the `agents.agent_key` values the dashboard already knows
 * (`src/data/agents.ts` + the icon switch in `ActivityRail.tsx`):
 *   manager · product · architect · coding · testing · security · reviewer · documentation
 */

export const AGENTS = [
  {
    agent_key: "manager",
    name: "Manager Agent",
    description: "Coordinates the engineering workflow and decides what should happen next.",
  },
  {
    agent_key: "product",
    name: "Product Agent",
    description: "Converts ideas into requirements, features, user stories, and acceptance criteria.",
  },
  {
    agent_key: "architect",
    name: "Architect Agent",
    description: "Designs the software architecture, APIs, database structure, and technical approach.",
  },
  {
    agent_key: "coding",
    name: "Coding Agent",
    description: "Creates and modifies application code.",
  },
  {
    agent_key: "testing",
    name: "Testing Agent",
    description: "Creates tests and checks whether implementations work correctly.",
  },
  {
    agent_key: "security",
    name: "Security Agent",
    description: "Looks for security risks and unsafe implementations.",
  },
  {
    agent_key: "reviewer",
    name: "Reviewer Agent",
    description: "Reviews AI-generated work before it reaches the developer.",
  },
  {
    agent_key: "documentation",
    name: "Documentation Agent",
    description: "Creates and maintains technical documentation.",
  },
] as const;

export type AgentKey = (typeof AGENTS)[number]["agent_key"];

export const AGENT_NAMES: Record<string, string> = Object.fromEntries(
  AGENTS.map((agent) => [agent.agent_key, agent.name]),
);

/** Stage keys in execution order. `stage_number` is 1-based. */
export const STAGE_KEYS = [
  "planning",
  "requirements",
  "architecture",
  "implementation",
  "testing",
  "security",
  "review",
] as const;

export type StageKey = (typeof STAGE_KEYS)[number];

export interface StageDefinition {
  key: StageKey;
  number: number;
  /** Human label stored in activity messages. */
  title: string;
  /** Agent that owns the stage; must exist in the `agents` table. */
  agentKey: AgentKey;
  /** One-line intent fed to the model. */
  purpose: string;
  /**
   * Whether the stage produces changed files. Only `implementation` does; the
   * later stages reason about those files rather than emitting new ones.
   */
  producesFiles: boolean;
}

export const STAGES: StageDefinition[] = STAGE_KEYS.map((key, index) => {
  const number = index + 1;
  switch (key) {
    case "planning":
      return {
        key,
        number,
        title: "Planning",
        agentKey: "manager",
        purpose: "Break the request into a concrete, ordered engineering plan and the tasks it implies.",
        producesFiles: false,
      };
    case "requirements":
      return {
        key,
        number,
        title: "Requirements",
        agentKey: "product",
        purpose: "Turn the request into precise, testable requirements with acceptance criteria.",
        producesFiles: false,
      };
    case "architecture":
      return {
        key,
        number,
        title: "Architecture",
        agentKey: "architect",
        purpose: "Design the technical approach: components, interfaces, data flow and trade-offs.",
        producesFiles: false,
      };
    case "implementation":
      return {
        key,
        number,
        title: "Implementation",
        agentKey: "coding",
        purpose: "Produce the concrete file-level changes that satisfy the architecture.",
        producesFiles: true,
      };
    case "testing":
      return {
        key,
        number,
        title: "Testing",
        agentKey: "testing",
        purpose: "Define the test coverage for the change and report the expected pass/fail totals.",
        producesFiles: false,
      };
    case "security":
      return {
        key,
        number,
        title: "Security",
        agentKey: "security",
        purpose: "Audit the proposed change for injection, authz, secrets and unsafe defaults.",
        producesFiles: false,
      };
    case "review":
      return {
        key,
        number,
        title: "Review",
        agentKey: "reviewer",
        purpose: "Review the change set for correctness and readability and summarise it for a human.",
        producesFiles: false,
      };
  }
});

export const STAGE_BY_KEY: Record<StageKey, StageDefinition> = Object.fromEntries(
  STAGES.map((stage) => [stage.key, stage]),
) as Record<StageKey, StageDefinition>;

/* ------------------------------------------------------------------ */
/* Stage output contract                                               */
/* ------------------------------------------------------------------ */

export interface PlannedTask {
  title: string;
  description: string | null;
  /** Must be one of `AGENTS[].agent_key`; falls back to the stage agent. */
  agent_key: string;
}

export interface PlannedFile {
  file_path: string;
  /** Lines added. Clamped to a non-negative integer before insert. */
  additions: number;
  deletions: number;
  diff_text: string | null;
  summary?: string | null;
}

export interface TestReport {
  total: number;
  passed: number;
  failed: number;
  notes: string | null;
}

export interface SecurityFinding {
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  detail: string;
}

export interface SecurityReport {
  summary: string;
  risk_level: "low" | "medium" | "high" | "critical";
  findings: SecurityFinding[];
}

export interface ReviewSuggestion {
  title: string;
  detail: string;
}

export interface ReviewReport {
  summary: string;
  suggestions: ReviewSuggestion[];
}

/** Everything a stage may return; stages populate only the fields they own. */
export interface StageOutput {
  /** Short human summary — stored on the activity event's `message`. */
  summary: string;
  tasks?: PlannedTask[];
  files?: PlannedFile[];
  tests?: TestReport;
  security?: SecurityReport;
  review?: ReviewReport;
  /** Full model narrative, kept in event metadata for debugging. */
  detail?: string | null;
}

/** Branch name written to `runs.branch_name` at claim time. */
export function branchNameFor(projectSlug: string, runId: string): string {
  const slug = projectSlug.replace(/[^a-z0-9-]/gi, "-").toLowerCase().replace(/-+/g, "-").replace(/^-|-$/g, "") || "project";
  return `ai/${slug.slice(0, 40)}/${runId.slice(0, 8)}`;
}
