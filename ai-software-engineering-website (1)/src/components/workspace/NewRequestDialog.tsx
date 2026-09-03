import { ArrowRight, Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, inputClass, Modal, textareaClass } from "@/components/workspace/bits";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { MutationResult } from "@/lib/workspace";

/**
 * "New request" dialog. Submitting inserts a run (status `queued`) against a
 * project. Everything downstream — stages, tasks, agent activity, the
 * proposed change and its diff, the activity feed — is produced by the
 * autonomous agent pipeline, never by this form.
 */
export function NewRequestDialog() {
  const { ui, actions, snapshot } = useWorkspace();
  const open = ui.requestOpen;

  const projects = useMemo(() => (snapshot?.projects ?? []).filter((p) => p.status === "active"), [snapshot?.projects]);

  const [projectId, setProjectId] = useState("");
  const [requestText, setRequestText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MutationResult | null>(null);

  // Apply a preselection whenever the dialog is opened.
  useEffect(() => {
    if (!open) return;
    setResult(null);
    const preferred =
      ui.requestProjectId && projects.some((p) => p.id === ui.requestProjectId)
        ? ui.requestProjectId
        : projects[0]?.id ?? "";
    setProjectId((prev) => (projects.some((p) => p.id === prev) ? prev : preferred));
  }, [open, ui.requestProjectId, projects]);

  const close = () => {
    if (busy) return;
    ui.closeNewRequest();
    setRequestText("");
    setResult(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    setBusy(true);
    setResult(null);
    const res = await actions.createRun({ projectId, requestText });
    setResult(res);
    setBusy(false);
    if (res.ok) close();
  };

  const selected = projects.find((p) => p.id === projectId);

  return (
    <Modal
      open={open}
      onClose={close}
      title="Submit a software-engineering request"
      subtitle="Describe the outcome you want. The agents plan, implement, test, and secure it autonomously — you'll review the proposed change when they're done."
      wide
    >
      {projects.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-electric-light" />
          <p className="mt-3 text-sm font-medium text-snow">No projects yet</p>
          <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-fog">
            Requests run against a project. Create one first, then come back to launch your agents.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => {
              close();
              ui.openNewProject();
            }}
          >
            Create a project
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Project" hint="agents work in this repo">
            <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface text-snow">
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="What should the team build or change?" hint="required">
            <textarea
              className={`${textareaClass} min-h-[150px]`}
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder={"e.g. Add a live collaborative editing mode with conflict-free sync, reconnect recovery, and tests for concurrent edits.\n\nExample of a good request: clear outcome, the area of the codebase, and what ‘done’ looks like."}
              required
              maxLength={4000}
              autoFocus
            />
          </Field>

          <div className="flex items-start gap-2.5 rounded-xl border border-electric/20 bg-electric/[0.05] px-3.5 py-3">
            <Send className="mt-0.5 h-4 w-4 shrink-0 text-electric-light" />
            <p className="text-xs leading-relaxed text-fog">
              Once submitted, the run appears below as <span className="font-mono text-electric-light">queued</span> and the agents
              take over automatically{selected ? ` on “${selected.name}”` : ""} — no further input needed until the run is{" "}
              <span className="font-mono text-ember-soft">ready for review</span>.
            </p>
          </div>

          {result && !result.ok ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] leading-snug text-danger">{result.message}</p>
          ) : null}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <Button variant="ghost" onClick={close} disabled={busy} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !projectId || !requestText.trim()} className="min-w-[160px] justify-center">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Launch agents
              {!busy ? <ArrowRight className="h-4 w-4" /> : null}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
