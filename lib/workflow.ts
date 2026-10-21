export type WorkflowNodeKind =
  "input" | "planner" | "research" | "review" | "output";

export interface WorkflowNode {
  id: string;
  kind: WorkflowNodeKind;
  name: string;
  model: string;
  instructions: string;
  x: number;
  y: number;
}

export interface WorkflowEdge {
  source: string;
  target: string;
}

export interface Workflow {
  version: 1;
  name?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export const WORKFLOW_WIDTH = 860;
export const WORKFLOW_HEIGHT = 444;
export const NODE_WIDTH = 158;
export const NODE_HEIGHT = 88;

export const nodeDefinitions: Record<
  WorkflowNodeKind,
  { label: string; description: string; model: string; instructions: string }
> = {
  input: {
    label: "Input trigger",
    description: "Receive an event",
    model: "Webhook",
    instructions: "Validate the incoming customer intelligence request.",
  },
  planner: {
    label: "Planning agent",
    description: "Break down the task",
    model: "GPT-4.1",
    instructions:
      "Decompose the request into independent research and quality assessment tasks.",
  },
  research: {
    label: "Research agent",
    description: "Retrieve context",
    model: "GPT-4.1 mini",
    instructions:
      "Retrieve relevant sources and produce a concise, cited analysis.",
  },
  review: {
    label: "Review agent",
    description: "Apply guardrails",
    model: "GPT-4.1",
    instructions:
      "Evaluate the request against data-handling and content policies.",
  },
  output: {
    label: "Output action",
    description: "Deliver the result",
    model: "JSON response",
    instructions:
      "Combine the research and review results into a structured response.",
  },
};

export function createSeedWorkflow(): Workflow {
  const specs: {
    kind: WorkflowNodeKind;
    name: string;
    x: number;
    y: number;
  }[] = [
    { kind: "input", name: "Event intake", x: 28, y: 177 },
    { kind: "planner", name: "Task planner", x: 240, y: 177 },
    { kind: "research", name: "Research agent", x: 452, y: 69 },
    { kind: "review", name: "Policy review", x: 452, y: 285 },
    { kind: "output", name: "Structured output", x: 664, y: 177 },
  ];
  return {
    version: 1,
    name: "Customer intelligence",
    nodes: specs.map(({ kind, ...rest }) => ({
      id: kind,
      kind,
      model: nodeDefinitions[kind].model,
      instructions: nodeDefinitions[kind].instructions,
      ...rest,
    })),
    edges: [
      { source: "input", target: "planner" },
      { source: "planner", target: "research" },
      { source: "planner", target: "review" },
      { source: "research", target: "output" },
      { source: "review", target: "output" },
    ],
  };
}

/** Checks the proposed edge before it can enter the persisted DAG. */
export function connectionError(
  workflow: Workflow,
  source: string,
  target: string,
): string | null {
  if (
    !workflow.nodes.some((node) => node.id === source) ||
    !workflow.nodes.some((node) => node.id === target)
  )
    return "Choose two existing nodes.";
  if (source === target) return "A node cannot connect to itself.";
  if (
    workflow.edges.some(
      (edge) => edge.source === source && edge.target === target,
    )
  )
    return "These nodes are already connected.";
  const visited = new Set<string>();
  const queue = [target];
  while (queue.length) {
    const id = queue.pop()!;
    if (id === source)
      return "That connection would create a cycle. Choose a downstream node.";
    if (visited.has(id)) continue;
    visited.add(id);
    queue.push(
      ...workflow.edges
        .filter((edge) => edge.source === id)
        .map((edge) => edge.target),
    );
  }
  return null;
}

/** Stable topological order: a simulated node runs only after all dependencies. */
export function executionOrder(workflow: Workflow): string[] {
  const pending = new Set(workflow.nodes.map((node) => node.id));
  const complete: string[] = [];
  while (pending.size) {
    const ready = [...pending].filter((id) =>
      workflow.edges.every(
        (edge) => edge.target !== id || complete.includes(edge.source),
      ),
    );
    if (!ready.length)
      throw new Error(
        "This workflow contains a cycle or an invalid connection.",
      );
    ready.forEach((id) => {
      pending.delete(id);
      complete.push(id);
    });
  }
  return complete;
}

/** Rejects malformed, oversized, or cyclic local data before restoring it. */
export function parseWorkflow(raw: string): Workflow | null {
  try {
    if (raw.length > 100_000) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const value = data as Partial<Workflow>;
    if (
      value.name !== undefined &&
      (typeof value.name !== "string" ||
        !value.name.trim() ||
        value.name.length > 80)
    )
      return null;
    if (
      value.version !== 1 ||
      !Array.isArray(value.nodes) ||
      !Array.isArray(value.edges) ||
      !value.nodes.length ||
      value.nodes.length > 12 ||
      value.edges.length > 132
    )
      return null;
    const kinds = Object.keys(nodeDefinitions);
    const ids = new Set<string>();
    for (const node of value.nodes) {
      if (
        !node ||
        typeof node.id !== "string" ||
        !node.id.trim() ||
        node.id.length > 80 ||
        ids.has(node.id) ||
        !kinds.includes(node.kind) ||
        typeof node.name !== "string" ||
        !node.name.trim() ||
        node.name.length > 40 ||
        typeof node.model !== "string" ||
        node.model.length > 80 ||
        typeof node.instructions !== "string" ||
        node.instructions.length > 1000 ||
        !Number.isFinite(node.x) ||
        !Number.isFinite(node.y) ||
        node.x < 0 ||
        node.y < 0 ||
        node.x > WORKFLOW_WIDTH - NODE_WIDTH ||
        node.y > WORKFLOW_HEIGHT - NODE_HEIGHT
      )
        return null;
      ids.add(node.id);
    }
    const result: Workflow = {
      version: 1,
      ...(value.name ? { name: value.name } : {}),
      nodes: value.nodes,
      edges: [],
    };
    for (const edge of value.edges) {
      if (
        !edge ||
        typeof edge.source !== "string" ||
        typeof edge.target !== "string" ||
        connectionError(result, edge.source, edge.target)
      )
        return null;
      result.edges.push({ source: edge.source, target: edge.target });
    }
    return result;
  } catch {
    return null;
  }
}

export const workflowTemplates = [
  {
    id: "customer",
    name: "Customer intelligence",
    description: "Research, qualify, and route every account.",
    tag: "REVENUE OPERATIONS",
    request:
      "Research the expansion opportunity for Meridian Labs and identify the next best action.",
  },
  {
    id: "document",
    name: "Document operations",
    description: "Extract structured data with a review gate.",
    tag: "DATA OPERATIONS",
    request:
      "Extract the renewal date, annual value, and key terms from the sample vendor agreement.",
  },
  {
    id: "risk",
    name: "Risk intelligence",
    description: "Gather evidence. Apply a policy checkpoint.",
    tag: "FINANCIAL OPERATIONS",
    request:
      "Review the sample supplier profile, collect supporting evidence, and flag policy exceptions.",
  },
] as const;
export type WorkflowTemplateId = (typeof workflowTemplates)[number]["id"];

export function createWorkflowTemplate(template: WorkflowTemplateId): Workflow {
  const workflow = createSeedWorkflow();
  const spec = workflowTemplates.find((item) => item.id === template)!;
  workflow.name = spec.name;
  if (template === "customer") return workflow;
  const names =
    template === "document"
      ? [
          "Document received",
          "Extraction planner",
          "Entity extraction",
          "Quality review",
          "Structured record",
        ]
      : [
          "Profile received",
          "Risk planner",
          "Evidence retrieval",
          "Policy assessment",
          "Decision brief",
        ];
  workflow.nodes = workflow.nodes.map((node, index) => ({
    ...node,
    name: names[index],
    instructions: `${nodeDefinitions[node.kind].instructions} Workflow context: ${spec.description}`,
  }));
  return workflow;
}

/** Checks runnable graph semantics independently of edit-time edge validation. */
export function workflowIssues(workflow: Workflow): string[] {
  const issues: string[] = [];
  const inputs = workflow.nodes.filter((node) => node.kind === "input");
  const outputs = workflow.nodes.filter((node) => node.kind === "output");
  if (!inputs.length) issues.push("Add an input trigger.");
  if (!outputs.length) issues.push("Add an output action.");
  try {
    executionOrder(workflow);
  } catch {
    issues.push("Remove cyclic or invalid connections.");
  }
  if (
    workflow.nodes.some(
      (node) =>
        !node.name.trim() || !node.model.trim() || !node.instructions.trim(),
    )
  )
    issues.push("Give every node a name, model or action, and instructions.");
  if (
    workflow.edges.some((edge) =>
      inputs.some((node) => node.id === edge.target),
    )
  )
    issues.push(
      "Input triggers must start the workflow; remove incoming connections.",
    );
  if (
    workflow.edges.some((edge) =>
      outputs.some((node) => node.id === edge.source),
    )
  )
    issues.push(
      "Output actions must end a branch; remove outgoing connections.",
    );
  const traverse = (start: string[], reverse = false) => {
    const found = new Set(start);
    const queue = [...start];
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of workflow.edges) {
        const from = reverse ? edge.target : edge.source;
        const to = reverse ? edge.source : edge.target;
        if (from === current && !found.has(to)) {
          found.add(to);
          queue.push(to);
        }
      }
    }
    return found;
  };
  if (
    inputs.length &&
    traverse(inputs.map((node) => node.id)).size !== workflow.nodes.length
  )
    issues.push("Connect every node to an input trigger.");
  if (
    outputs.length &&
    traverse(
      outputs.map((node) => node.id),
      true,
    ).size !== workflow.nodes.length
  )
    issues.push("Connect every branch to an output action.");
  return issues;
}
