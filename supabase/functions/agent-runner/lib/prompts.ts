/**
 * Prompt construction for each pipeline stage.
 *
 * Prompts are deliberately explicit about the JSON contract because every stage
 * result is parsed and written into typed columns. They also carry the hard
 * product rule that the agent side never decides approval — the model is told
 * the run stops at `ready_for_review` for a human.
 */
import type { PlannedFile, PlannedTask, StageDefinition } from "./stages.ts";
import type { ProjectRow, RunRow } from "./schema.ts";

export interface StageContext {
  project: ProjectRow;
  run: RunRow;
  stage: StageDefinition;
  /** Summaries of already-completed stages, in order. */
  prior: Array<{ stage: string; title: string; summary: string }>;
  /** Files produced by `implementation`, supplied to later stages. */
  files: PlannedFile[];
  /** Tasks produced by `planning`. */
  tasks: PlannedTask[];
  /** Existing tasks in the project, for continuity on requeued runs. */
  existingTasks: Array<{ title: string; status: string }>;
  /** Attempt number for this run (1 = first try). */
  attempt: number;
  /** Error from the previous failed attempt, when this is a retry. */
  previousError: string | null;
}

const JSON_RULES = `Respond with a single JSON object and nothing else. No markdown fences, no commentary before or after the JSON.`;

const HUMAN_RULE = `You are one stage of an autonomous software-engineering pipeline. You NEVER approve, merge or reject work: the pipeline always stops at "ready_for_review" and a human developer makes the final decision. Do not claim a change is approved.`;

function projectBrief(project: ProjectRow): string {
  return [
    `Project: ${project.name} (slug: ${project.slug})`,
    project.description ? `Description: ${project.description}` : null,
    project.repository_url ? `Repository: ${project.repository_url}` : null,
    `Default branch: ${project.default_branch}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function priorBrief(prior: StageContext["prior"]): string {
  if (prior.length === 0) return "No earlier stages have run yet.";
  return prior.map((entry) => `- ${entry.title}: ${entry.summary}`).join("\n");
}

function taskBrief(tasks: StageContext["tasks"]): string {
  if (tasks.length === 0) return "No tasks have been planned yet.";
  return tasks.map((task, index) => `${index + 1}. [${task.agent_key}] ${task.title}`).join("\n");
}

function fileBrief(files: PlannedFile[]): string {
  if (files.length === 0) return "No files have been produced yet.";
  return files
    .map((file) => {
      const header = `- ${file.file_path} (+${file.additions}/-${file.deletions})${file.summary ? ` — ${file.summary}` : ""}`;
      return file.diff_text ? `${header}\n\`\`\`diff\n${truncate(file.diff_text, 3000)}\n\`\`\`` : header;
    })
    .join("\n\n");
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}\n… (truncated)`;
}

/** Per-stage JSON schema instructions. */
function outputContract(stage: StageDefinition): string {
  const base = `Always include "summary": a 1-3 sentence human-readable description of what this stage concluded.`;
  switch (stage.key) {
    case "planning":
      return `${base}
Also include "tasks": an array of 3-8 objects, each { "title": string, "description": string, "agent_key": string }.
Valid agent_key values: manager, product, architect, coding, testing, security, reviewer, documentation.
Order the tasks in the sequence they should be executed.`;
    case "requirements":
      return `${base}
Also include "tasks": an array of objects { "title": string, "description": string, "agent_key": string } capturing acceptance criteria as testable tasks. Return an empty array if the existing tasks already cover the requirements.`;
    case "architecture":
      return `${base}
Also include "detail": a string with the technical design — components, interfaces, data flow, and the trade-offs you considered.`;
    case "implementation":
      return `${base}
Also include "files": an array of 1-12 objects, each { "file_path": string, "additions": number, "deletions": number, "summary": string, "diff_text": string }.
"file_path" must be a repository-relative path. "diff_text" must be a unified diff for that file.`;
    case "testing":
      return `${base}
Also include "tests": { "total": number, "passed": number, "failed": number, "notes": string }.
Report the coverage you would run against this change. "passed" must be <= "total".`;
    case "security":
      return `${base}
Also include "security": { "summary": string, "risk_level": "low"|"medium"|"high"|"critical", "findings": [ { "title": string, "severity": "info"|"low"|"medium"|"high"|"critical", "detail": string } ] }.`;
    case "review":
      return `${base}
Also include "review": { "summary": string, "suggestions": [ { "title": string, "detail": string } ] }.
Write the summary for the human who will approve or reject this change.`;
  }
}

export function systemPrompt(context: StageContext): string {
  const { stage } = context;
  return [
    `You are the ${stage.agentKey === "manager" ? "Manager" : stage.agentKey.charAt(0).toUpperCase() + stage.agentKey.slice(1)} Agent in an autonomous software-engineering pipeline.`,
    `Your job in this stage: ${stage.purpose}`,
    HUMAN_RULE,
    JSON_RULES,
    outputContract(stage),
  ].join("\n\n");
}

export function userPrompt(context: StageContext): string {
  const { project, run, stage } = context;
  const sections = [
    `## Stage\n${stage.number}/7 — ${stage.title} (stage_key: ${stage.key})`,
    `## Project\n${projectBrief(project)}`,
    `## Software-engineering request from the developer\n${run.request_text}`,
    `## Earlier stage conclusions\n${priorBrief(context.prior)}`,
  ];

  if (context.existingTasks.length > 0) {
    sections.push(
      `## Tasks already tracked for this project\n${context.existingTasks
        .map((task) => `- ${task.title} (${task.status})`)
        .join("\n")}`,
    );
  }
  if (context.tasks.length > 0) {
    sections.push(`## Planned tasks\n${taskBrief(context.tasks)}`);
  }
  if (context.files.length > 0) {
    sections.push(`## Proposed file changes\n${fileBrief(context.files)}`);
  }
  if (context.attempt > 1) {
    sections.push(
      `## Retry\nThis is attempt ${context.attempt}. The previous attempt failed with: ${
        context.previousError ?? "unknown error"
      }\nProduce a corrected, complete result for this stage.`,
    );
  }

  sections.push(`## Your task now\n${stage.purpose} Then respond with the JSON object described above.`);
  return sections.join("\n\n");
}
