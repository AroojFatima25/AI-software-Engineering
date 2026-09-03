import { ArrowRight, FolderKanban, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, inputClass, Modal } from "@/components/workspace/bits";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { MutationResult } from "@/lib/workspace";

export function NewProjectDialog() {
  const { ui, actions, workspace } = useWorkspace();
  const open = ui.newProjectOpen;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MutationResult | null>(null);

  if (!workspace) return null;

  const close = () => {
    if (busy) return;
    ui.closeNewProject();
    setName("");
    setDescription("");
    setRepositoryUrl("");
    setResult(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const res = await actions.createProject({
      name,
      description: description || undefined,
      repositoryUrl: repositoryUrl || undefined,
    });
    setResult(res);
    setBusy(false);
    if (res.ok) close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create a project"
      subtitle="A project is the repository your agents work in. Give it a name — the slug is generated for you."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Project name" hint="required">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Real-time collaborative editor"
            autoFocus
            maxLength={80}
            required
            autoComplete="off"
          />
        </Field>
        <Field label="What is it?">
          <textarea
            className="min-h-[84px] w-full resize-y rounded-xl border border-white/10 bg-ink/60 px-3.5 py-3 text-sm leading-relaxed text-snow placeholder:text-fog-2/70 transition focus:border-electric/60 focus:ring-2 focus:ring-electric/25"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — one or two sentences about the project so the agents have context."
            maxLength={500}
          />
        </Field>
        <Field label="Repository URL">
          <input
            className={inputClass}
            value={repositoryUrl}
            onChange={(e) => setRepositoryUrl(e.target.value)}
            placeholder="https://github.com/you/repo (optional)"
            type="url"
            autoComplete="off"
          />
        </Field>

        <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
          <FolderKanban className="mt-0.5 h-4 w-4 shrink-0 text-electric-light" />
          <p className="text-xs leading-relaxed text-fog">
            Created in <span className="text-snow">{workspace.name}</span> with you as the creator. Stored on your branch of the
            workspace — agents can start runs against it immediately.
          </p>
        </div>

        {result && !result.ok ? (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] leading-snug text-danger">{result.message}</p>
        ) : null}

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <Button variant="ghost" size="md" onClick={close} disabled={busy} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !name.trim()} className="min-w-[140px] justify-center">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create project
            {!busy ? <ArrowRight className="h-4 w-4" /> : null}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
