import type { Project, ProposedChange } from "@/types";

/**
 * Mock data for the workspace preview. Shaped to be swapped for
 * Supabase queries + realtime subscriptions later.
 */
export const MOCK_PROJECT: Project = {
  id: "proj_01",
  name: "Realtime Collaborative Editor",
  slug: "realtime-collaborative-editor",
  repository: "open-dev/collab-editor",
  branch: "feat/crdt-sync",
  progress: 43,
  tasksDone: 9,
  tasksTotal: 21,
  testsPassed: 24,
  openReviews: 1,
  currentRun: "Run #128 · Add conflict-free live editing",
  activeAgents: [
    { id: "architect", name: "Architect Agent", task: "Designing sync protocol", status: "active" },
    { id: "coding", name: "Coding Agent", task: "Implementing CRDT updates", status: "active" },
    { id: "testing", name: "Testing Agent", task: "Waiting", status: "waiting" },
  ],
  activity: [
    { id: "a1", label: "Requirements created", state: "done", timestamp: "14:02" },
    { id: "a2", label: "Architecture completed", state: "done", timestamp: "14:11" },
    { id: "a3", label: "CRDT schema generated", state: "done", timestamp: "14:16" },
    { id: "a4", label: "Live sync implementation", state: "active", timestamp: "now" },
    { id: "a5", label: "Concurrency testing", state: "pending" },
    { id: "a6", label: "Security review", state: "pending" },
  ],
  log: [
    "[manager]   run #128 started · 4 stages queued",
    "[architect] proposing WebSocket gateway → CRDT document → persistence",
    "[architect] schema: add document_updates (document_id, version, payload)",
    "[coding]    writing src/sync/yjs-provider.ts",
    "[coding]    updating src/ws/documents.ts (+82 −14)",
    "[testing]   waiting for coding agent to finish…",
  ],
};

export const PROPOSED_CHANGE: ProposedChange = {
  id: "chg_128",
  title: "Add conflict-free collaborative editing",
  summary:
    "Introduces a CRDT-backed sync layer, WebSocket presence events, reconnect recovery, and integration tests for concurrent edits.",
  branch: "feat/crdt-sync",
  filesChanged: [
    { path: "src/sync/yjs-provider.ts", additions: 82, deletions: 0 },
    { path: "src/ws/documents.ts", additions: 49, deletions: 14 },
    { path: "tests/sync/concurrency.test.ts", additions: 76, deletions: 0 },
  ],
  testsPassed: 24,
  testsTotal: 24,
  securitySummary: "No critical issues",
  diff: [
    { type: "context", text: "export const documentRouter = Router();" },
    { type: "context", text: "" },
    { type: "add", text: "documentRouter.ws('/:id/sync', (socket, req) => {" },
    { type: "add", text: "  const doc = documents.get(req.params.id);" },
    { type: "add", text: "  socket.on('update', (update) => doc.apply(update));" },
    { type: "add", text: "  doc.on('update', (update) => broadcast(socket, update));" },
    { type: "add", text: "});" },
    { type: "add", text: "" },
    { type: "add", text: "documentRouter.ws('/:id/presence', presenceHandler);" },
    { type: "add", text: "documentRouter.post('/:id/reconnect', recoverPendingUpdates);" },
    { type: "remove", text: "documentRouter.post('/:id/save', legacySaveHandler);" },
  ],
  fileDiffs: [
    [
      { type: "add", text: "import * as Y from 'yjs';" },
      { type: "add", text: "import { WebsocketProvider } from 'y-websocket';" },
      { type: "add", text: "" },
      { type: "add", text: "export function createSyncProvider(id: string) {" },
      { type: "add", text: "  const doc = new Y.Doc();" },
      { type: "add", text: "  return new WebsocketProvider(SYNC_URL, id, doc);" },
      { type: "add", text: "}" },
    ],
    [
      { type: "context", text: "export const documentRouter = Router();" },
      { type: "context", text: "" },
      { type: "add", text: "documentRouter.ws('/:id/sync', (socket, req) => {" },
      { type: "add", text: "  const doc = documents.get(req.params.id);" },
      { type: "add", text: "  socket.on('update', (update) => doc.apply(update));" },
      { type: "add", text: "  doc.on('update', (update) => broadcast(socket, update));" },
      { type: "add", text: "});" },
      { type: "add", text: "" },
      { type: "add", text: "documentRouter.ws('/:id/presence', presenceHandler);" },
      { type: "add", text: "documentRouter.post('/:id/reconnect', recoverPendingUpdates);" },
      { type: "remove", text: "documentRouter.post('/:id/save', legacySaveHandler);" },
    ],
    [
      { type: "add", text: "describe('concurrent editing', () => {" },
      { type: "add", text: "  it('merges offline edits after reconnect', async () => {" },
      { type: "add", text: "    const [alice, bob] = await createEditors();" },
      { type: "add", text: "    await Promise.all([alice.edit('hello'), bob.edit('world')]);" },
      { type: "add", text: "    expect(await waitForSync(alice)).toEqual(await waitForSync(bob));" },
      { type: "add", text: "  });" },
      { type: "add", text: "" },
      { type: "add", text: "  it('rejects updates for another tenant', async () => {" },
      { type: "add", text: "    expect(await sendForeignUpdate()).toHaveStatus(403);" },
      { type: "add", text: "  });" },
      { type: "add", text: "});" },
    ],
  ],
};

export const SIDEBAR_ITEMS = [
  "Dashboard",
  "Projects",
  "Tasks",
  "AI Agents",
  "Repository",
  "Runs",
  "Reviews",
  "Settings",
] as const;
