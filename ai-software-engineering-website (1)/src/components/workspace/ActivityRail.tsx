import {
  Activity,
  BookOpenText,
  Bot,
  Code2,
  DraftingCompass,
  FlaskConical,
  GitPullRequest,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Badge, Card, PanelHeading } from "@/components/workspace/bits";
import { useWorkspace } from "@/hooks/useWorkspace";
import { timeAgo, truncate } from "@/lib/format";
import { isActiveRun, type ActivityEventRow } from "@/types/workspace";

export function ActivityRail() {
  const { snapshot } = useWorkspace();
  if (!snapshot) return null;
  const live = snapshot.runs.some((r) => isActiveRun(r.run.status));

  return (
    <aside id="workspace-activity" className="scroll-mt-24 space-y-4">
      <Card className="overflow-hidden">
        <PanelHeading
          title="Activity"
          right={
            live ? (
              <Badge tone="electric" pulse>
                live
              </Badge>
            ) : (
              <Badge tone="fog">idle</Badge>
            )
          }
        />
        {snapshot.activity.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-fog-2">
            Workspace events will stream here — agent milestones, task updates, and review decisions.
          </p>
        ) : (
          <ol className="max-h-[calc(100vh-9.5rem)] overflow-y-auto px-4 py-3 sm:px-5">
            {snapshot.activity.map((event) => (
              <ActivityRow key={event.id} event={event} />
            ))}
          </ol>
        )}
      </Card>
    </aside>
  );
}

function ActivityRow({ event }: { event: ActivityEventRow }) {
  const icon = agentIcon(event);
  const text = event.message ?? humanEvent(event.event_type);
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {icon ? (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-fog">
          {icon}
        </span>
      ) : (
        <span className="mt-2 ml-3 h-1.5 w-1.5 shrink-0 rounded-full bg-fog-2/60" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] leading-snug text-fog">
          <span className="font-medium text-snow">{truncate(text, 220)}</span>
          {event.agent ? <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-electric-light/80">[{event.agent.agent_key}]</span> : null}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[10px] uppercase tracking-wider text-fog-2">
          <span>{event.event_type.replace(/[_-]/g, " ")}</span>
          {event.project ? <span className="normal-case tracking-normal text-fog-2/80">· {event.project.name}</span> : null}
          <span>· {timeAgo(event.created_at)}</span>
        </p>
      </div>
    </li>
  );
}

function agentIcon(event: ActivityEventRow) {
  const key = event.agent?.agent_key ?? "";
  const type = event.event_type;
  if (type.includes("approval") || type.includes("review") || type.includes("decision")) return <UserCheck className="h-3.5 w-3.5" />;
  if (type.includes("proposed") || type.includes("change") || type.includes("pull")) return <GitPullRequest className="h-3.5 w-3.5" />;
  if (type.includes("run") || type.includes("stage") || type.includes("task")) return <Activity className="h-3.5 w-3.5" />;
  switch (key) {
    case "product":
      return <Sparkles className="h-3.5 w-3.5" />;
    case "architect":
      return <DraftingCompass className="h-3.5 w-3.5" />;
    case "coding":
      return <Code2 className="h-3.5 w-3.5" />;
    case "testing":
      return <FlaskConical className="h-3.5 w-3.5" />;
    case "security":
      return <ShieldCheck className="h-3.5 w-3.5" />;
    case "documentation":
      return <BookOpenText className="h-3.5 w-3.5" />;
    default:
      return <Bot className="h-3.5 w-3.5" />;
  }
}

function humanEvent(type: string): string {
  const t = type.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
