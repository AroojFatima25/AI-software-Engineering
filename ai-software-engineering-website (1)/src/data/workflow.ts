import {
  Code2,
  Compass,
  DraftingCompass,
  FlaskConical,
  MessageSquareText,
  ScanSearch,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { RunStage, WorkflowStep } from "@/types";

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "describe",
    number: "01",
    title: "Describe",
    description: "Tell AI what you want to build.",
  },
  {
    id: "plan",
    number: "02",
    title: "Plan",
    description: "AI turns your idea into requirements and tasks.",
  },
  {
    id: "architect",
    number: "03",
    title: "Architect",
    description: "The Architect Agent designs the technical solution.",
  },
  {
    id: "build",
    number: "04",
    title: "Build",
    description: "Coding Agents implement the required changes.",
  },
  {
    id: "test",
    number: "05",
    title: "Test",
    description: "Testing Agents verify the implementation.",
  },
  {
    id: "review",
    number: "06",
    title: "Review",
    description: "Reviewer and Security Agents inspect the work.",
  },
  {
    id: "approve",
    number: "07",
    title: "Approve",
    description: "The developer stays in control and approves changes.",
  },
];

export const RUN_REQUEST = "Add real-time collaborative editing to my application.";

export const RUN_STAGES: RunStage[] = [
  {
    id: "request",
    label: "User Request",
    kind: "user",
    detail: "“Add real-time collaborative editing to my application.”",
    icon: MessageSquareText,
  },
  {
    id: "manager",
    label: "Manager Agent",
    kind: "agent",
    detail: "Scoped the request into 4 tasks and started run #128.",
    icon: Compass,
  },
  {
    id: "architect",
    label: "Architect Agent",
    kind: "agent",
    detail: "Designed the WebSocket sync flow, CRDT update model, and persistence schema.",
    icon: DraftingCompass,
  },
  {
    id: "coding",
    label: "Coding Agent",
    kind: "agent",
    detail: "Implemented the CRDT sync provider and document gateway across 3 files.",
    icon: Code2,
  },
  {
    id: "testing",
    label: "Testing Agent",
    kind: "agent",
    detail: "Added 24 tests. 24 passed, 0 failed.",
    icon: FlaskConical,
  },
  {
    id: "security",
    label: "Security Agent",
    kind: "agent",
    detail: "Validated tenant isolation and reconnect tokens. No critical issues.",
    icon: ShieldCheck,
  },
  {
    id: "reviewer",
    label: "Reviewer Agent",
    kind: "agent",
    detail: "Reviewed the change set and left 1 suggestion.",
    icon: ScanSearch,
  },
  {
    id: "approval",
    label: "Human Approval",
    kind: "human",
    detail: "Waiting for you to approve or request a revision.",
    icon: UserCheck,
  },
];
