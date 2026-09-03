import { ArrowUpRight, FolderKanban, GitBranch, GitPullRequest, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState } from "@/components/workspace/bits";
import { useWorkspace } from "@/hooks/useWorkspace";
import { timeAgo, truncate } from "@/lib/format";
import type { ProjectSummary } from "@/types/workspace";

export function ProjectsSection() {
  const { snapshot, ui } = useWorkspace();
  if (!snapshot) return null;
  const projects = snapshot.projects;

  return (
    <section id="workspace-projects" className="scroll-mt-24">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-snow">Projects</h2>
          <p className="mt-0.5 text-[13px] text-fog">Repositories in this workspace. Agent runs happen against a project.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => ui.openNewProject()}>
          <Plus className="h-3.5 w-3.5" /> New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" />}
          title="No projects yet"
          description="Create a project to give the agents a repository to work in — then submit your first software-engineering request."
          action={
            <Button onClick={() => ui.openNewProject()}>
              Create your first project
              <Plus className="h-4 w-4" />
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const { ui } = useWorkspace();
  const done = project.tasksByStatus.completed ?? 0;
  const total = Object.values(project.tasksByStatus).reduce((a, b) => a + b, 0);
  const progress = total > 0 ? Math.round((done / total) * 100) : null;
  const archived = project.status === "archived";

  return (
    <Card className="group flex flex-col p-4 transition hover:border-white/[0.16]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-snow" title={project.name}>
            {project.name}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-fog-2">
            {project.slug}
            {project.repository_url ? (
              <a
                href={project.repository_url}
                target="_blank"
                rel="noreferrer"
                className="ml-2 inline-flex items-center gap-1 text-electric-light transition hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                repo <ArrowUpRight className="h-3 w-3" />
              </a>
            ) : null}
          </p>
        </div>
        {archived ? (
          <Badge tone="fog">archived</Badge>
        ) : project.activeRunCount > 0 ? (
          <Badge tone="electric" pulse>
            running
          </Badge>
        ) : null}
      </div>

      <p className="mt-2.5 line-clamp-2 min-h-[2rem] text-[12.5px] leading-relaxed text-fog">
        {project.description ? truncate(project.description, 160) : "No description yet."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone="fog">
          <GitBranch className="h-3 w-3" /> {project.default_branch}
        </Badge>
        <Badge tone="fog">{project.runCount} {project.runCount === 1 ? "run" : "runs"}</Badge>
        {project.reviewCount > 0 && !archived ? (
          <Badge tone="ember">
            <GitPullRequest className="h-3 w-3" /> {project.reviewCount} review{project.reviewCount === 1 ? "" : "s"} ready
          </Badge>
        ) : null}
        {progress !== null ? (
          <span className="ml-auto font-mono text-[11px] text-fog-2">
            {done}/{total} tasks
          </span>
        ) : null}
      </div>

      {total > 0 ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-gradient-to-r from-electric to-electric-light" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="text-[11px] text-fog-2">created {timeAgo(project.created_at)}</span>
        {archived ? (
          <span className="text-[11px] text-fog-2">archived project</span>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => ui.openNewRequest(project.id)}>
            <Send className="h-3 w-3" />
            New request
          </Button>
        )}
      </div>
    </Card>
  );
}
