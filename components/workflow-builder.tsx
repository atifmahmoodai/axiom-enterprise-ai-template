"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowRight,
  AlertCircle,
  Braces,
  Check,
  ChevronRight,
  CircleDot,
  GitBranch,
  Grip,
  Layers3,
  Link2,
  Play,
  Plus,
  RotateCcw,
  Save,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Undo2,
  Redo2,
  Upload,
  Download,
  Square,
  Webhook,
  X,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import {
  connectionError,
  createSeedWorkflow,
  createWorkflowTemplate,
  executionOrder,
  workflowIssues,
  workflowTemplates,
  type WorkflowTemplateId,
  NODE_HEIGHT,
  NODE_WIDTH,
  nodeDefinitions,
  parseWorkflow,
  WORKFLOW_HEIGHT,
  WORKFLOW_WIDTH,
  type Workflow,
  type WorkflowNode,
  type WorkflowNodeKind,
} from "@/lib/workflow";
import "./workflow-builder.css";

const nodeIcons = {
  input: Webhook,
  planner: Sparkles,
  research: ScanSearch,
  review: ShieldCheck,
  output: Braces,
};
const kinds = Object.keys(nodeDefinitions) as WorkflowNodeKind[];
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

export function WorkflowBuilder() {
  const { tenantId } = useWorkspace();
  const reducedMotion = useReducedMotion();
  const [workflow, setWorkflow] = useState<Workflow>(createSeedWorkflow);
  const [selectedId, setSelectedId] = useState("planner");
  const [sourceId, setSourceId] = useState("planner");
  const [targetId, setTargetId] = useState("output");
  const [message, setMessage] = useState(
    "Select a node to configure your workflow.",
  );
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [trace, setTrace] = useState<string[]>([]);
  const [zoom, setZoom] = useState(0.85);
  const [past, setPast] = useState<Workflow[]>([]);
  const [future, setFuture] = useState<Workflow[]>([]);
  const [request, setRequest] = useState<string>(workflowTemplates[0].request);
  const [result, setResult] = useState("");
  const [inspectorTab, setInspectorTab] = useState<"trace" | "output">("trace");
  const importInput = useRef<HTMLInputElement>(null);
  const issues = workflowIssues(workflow);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    moved: boolean;
    before: Workflow;
  } | null>(null);
  const canvasViewport = useRef<HTMLDivElement>(null);
  const selectedNode = workflow.nodes.find((node) => node.id === selectedId);

  useEffect(() => {
    const element = canvasViewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setZoom(
        Math.max(0.65, Math.min(1, entry.contentRect.width / WORKFLOW_WIDTH)),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
    setCompleted([]);
    setActiveId(null);
    setTrace([]);
    setResult("");
    setPast([]);
    setFuture([]);
    setRequest(workflowTemplates[0].request);
    let next = createSeedWorkflow();
    let status =
      "Starter workflow ready. Changes are saved only in this browser.";
    try {
      const stored = localStorage.getItem(`axiom:workflow:${tenantId}:v1`);
      if (stored) {
        const restored = parseWorkflow(stored);
        if (restored) {
          next = restored;
          status = "Saved workflow restored for this workspace.";
        } else
          status =
            "Stored workflow could not be validated. A starter workflow is ready.";
      }
    } catch {
      status =
        "Browser storage is unavailable. You can still edit and simulate this workflow.";
    }
    setWorkflow(next);
    setSelectedId(next.nodes[0]?.id ?? "");
    setSourceId(next.nodes[0]?.id ?? "");
    setTargetId(next.nodes[1]?.id ?? "");
    setMessage(status);
    setDirty(false);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tenantId]);

  function updateWorkflow(next: Workflow) {
    if (running) return;
    setPast((history) => [...history.slice(-29), workflow]);
    setFuture([]);
    setWorkflow(next);
    setDirty(true);
    setResult("");
    setCompleted([]);
    setTrace([]);
  }

  function updateNode(patch: Partial<WorkflowNode>) {
    updateWorkflow({
      ...workflow,
      nodes: workflow.nodes.map((node) =>
        node.id === selectedId ? { ...node, ...patch } : node,
      ),
    });
  }

  function addNode(kind: WorkflowNodeKind) {
    if (workflow.nodes.length >= 12) {
      setMessage("This interactive template supports up to 12 nodes.");
      return;
    }
    const id = `${kind}-${crypto.randomUUID()}`;
    const definition = nodeDefinitions[kind];
    const node: WorkflowNode = {
      id,
      kind,
      name: definition.label,
      model: definition.model,
      instructions: definition.instructions,
      x: 70 + (workflow.nodes.length % 3) * 230,
      y: 30 + (Math.floor(workflow.nodes.length / 3) % 3) * 120,
    };
    updateWorkflow({ ...workflow, nodes: [...workflow.nodes, node] });
    setSelectedId(id);
    setTargetId(id);
    setMessage(
      `${definition.label} added. Connect it to your workflow using the connection controls.`,
    );
  }

  function removeNode() {
    if (!selectedNode || workflow.nodes.length === 1) return;
    const remaining = workflow.nodes.filter((node) => node.id !== selectedId);
    updateWorkflow({
      ...workflow,
      nodes: remaining,
      edges: workflow.edges.filter(
        (edge) => edge.source !== selectedId && edge.target !== selectedId,
      ),
    });
    setSelectedId(remaining[0].id);
    if (sourceId === selectedId) setSourceId(remaining[0].id);
    if (targetId === selectedId)
      setTargetId(remaining[1]?.id ?? remaining[0].id);
    setMessage(`${selectedNode.name} and its connections were removed.`);
  }

  function connectNodes() {
    const error = connectionError(workflow, sourceId, targetId);
    if (error) {
      setMessage(error);
      return;
    }
    updateWorkflow({
      ...workflow,
      edges: [...workflow.edges, { source: sourceId, target: targetId }],
    });
    setMessage(
      `Connected ${workflow.nodes.find((node) => node.id === sourceId)?.name} to ${workflow.nodes.find((node) => node.id === targetId)?.name}.`,
    );
  }

  function beginDrag(
    event: PointerEvent<HTMLButtonElement>,
    node: WorkflowNode,
  ) {
    setSelectedId(node.id);
    if (running || event.button !== 0) return;
    dragRef.current = {
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      x: node.x,
      y: node.y,
      moved: false,
      before: workflow,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || running) return;
    const dx = (event.clientX - drag.startX) / zoom;
    const dy = (event.clientY - drag.startY) / zoom;
    if (Math.abs(dx) + Math.abs(dy) < 3 && !drag.moved) return;
    drag.moved = true;
    const x = Math.round(clamp(drag.x + dx, WORKFLOW_WIDTH - NODE_WIDTH));
    const y = Math.round(clamp(drag.y + dy, WORKFLOW_HEIGHT - NODE_HEIGHT));
    setWorkflow((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === drag.id ? { ...node, x, y } : node,
      ),
    }));
    setDirty(true);
  }

  function endDrag() {
    if (dragRef.current?.moved) {
      const before = dragRef.current.before;
      setPast((history) => [...history.slice(-29), before]);
      setFuture([]);
      setMessage(
        "Node position updated. Save to keep your changes in this browser.",
      );
    }
    dragRef.current = null;
  }

  function keyboardMove(
    event: KeyboardEvent<HTMLButtonElement>,
    node: WorkflowNode,
  ) {
    if (running) return;
    const offsets: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (!offsets[event.key]) return;
    event.preventDefault();
    const [dx, dy] = offsets[event.key];
    const step = event.shiftKey ? 1 : 10;
    updateWorkflow({
      ...workflow,
      nodes: workflow.nodes.map((item) =>
        item.id === node.id
          ? {
              ...item,
              x: clamp(item.x + dx * step, WORKFLOW_WIDTH - NODE_WIDTH),
              y: clamp(item.y + dy * step, WORKFLOW_HEIGHT - NODE_HEIGHT),
            }
          : item,
      ),
    });
  }

  function saveWorkflow() {
    if (!parseWorkflow(JSON.stringify(workflow))) {
      setMessage("Give every node a valid name before saving.");
      return;
    }
    try {
      localStorage.setItem(
        `axiom:workflow:${tenantId}:v1`,
        JSON.stringify(workflow),
      );
      setDirty(false);
      setMessage("Workflow saved in this browser for the current workspace.");
    } catch {
      setMessage(
        "Browser storage is unavailable or full. Your current workflow remains open.",
      );
    }
  }

  function loadWorkflow() {
    try {
      const raw = localStorage.getItem(`axiom:workflow:${tenantId}:v1`);
      const saved = raw ? parseWorkflow(raw) : null;
      if (!saved) {
        setMessage("No valid saved workflow exists for this workspace yet.");
        return;
      }
      updateWorkflow(saved);
      setSelectedId(saved.nodes[0].id);
      setSourceId(saved.nodes[0].id);
      setTargetId(saved.nodes[1]?.id ?? saved.nodes[0].id);
      setDirty(false);
      setCompleted([]);
      setTrace([]);
      setMessage("Last saved workflow loaded from this browser.");
    } catch {
      setMessage("Browser storage is unavailable.");
    }
  }

  function runWorkflow() {
    if (running) return;
    if (issues.length) {
      setMessage(issues[0]);
      return;
    }
    if (!request.trim()) {
      setMessage("Enter a test request before simulating.");
      return;
    }
    let order: string[];
    try {
      order = executionOrder(workflow);
    } catch {
      setMessage("Resolve invalid connections before simulating.");
      return;
    }
    setRunning(true);
    setResult("");
    setInspectorTab("trace");
    setCompleted([]);
    setTrace([
      "Simulation started · no models or external services are called.",
    ]);
    setActiveId(order[0]);
    setMessage("Simulation running. Editing will resume when it completes.");
    let index = 0;
    timerRef.current = setInterval(() => {
      const id = order[index];
      const node = workflow.nodes.find((item) => item.id === id)!;
      setCompleted((current) => [...current, id]);
      setTrace((current) => [
        ...current,
        `${String(index + 1).padStart(2, "0")} · ${node.name} · ${node.model} · simulated success`,
      ]);
      index += 1;
      setActiveId(order[index] ?? null);
      if (index >= order.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setRunning(false);
        setResult(
          JSON.stringify(
            {
              mode: "simulation",
              workspace: tenantId,
              workflow: workflow.name ?? "Untitled workflow",
              request: request.trim(),
              status: "completed",
              executedNodes: order.map((nodeId) => {
                const item = workflow.nodes.find((n) => n.id === nodeId)!;
                return {
                  name: item.name,
                  kind: item.kind,
                  model: item.model,
                  instructions: item.instructions,
                  dependencies: workflow.edges
                    .filter((edge) => edge.target === nodeId)
                    .map(
                      (edge) =>
                        workflow.nodes.find((n) => n.id === edge.source)!.name,
                    ),
                };
              }),
              note: "Graph execution verified. No inference or external actions performed.",
            },
            null,
            2,
          ),
        );
        setMessage(
          `Simulation complete. All ${order.length} nodes passed through in dependency order.`,
        );
      }
    }, 650);
  }

  function stopSimulation() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
    setActiveId(null);
    setTrace((events) => [...events, "Simulation stopped by you."]);
    setMessage("Simulation stopped. Your canvas is ready to edit.");
  }

  function restoreHistory(direction: "undo" | "redo") {
    if (running) return;
    const stack = direction === "undo" ? past : future;
    if (!stack.length) return;
    const next = stack[stack.length - 1];
    if (direction === "undo") {
      setPast(past.slice(0, -1));
      setFuture([...future, workflow]);
    } else {
      setFuture(future.slice(0, -1));
      setPast([...past, workflow]);
    }
    setWorkflow(next);
    setSelectedId(
      next.nodes.some((node) => node.id === selectedId)
        ? selectedId
        : next.nodes[0].id,
    );
    setSourceId(next.nodes[0].id);
    setTargetId(next.nodes[1]?.id ?? next.nodes[0].id);
    setDirty(true);
    setCompleted([]);
    setTrace([]);
    setResult("");
    setMessage(direction === "undo" ? "Change undone." : "Change restored.");
  }

  function downloadJson(content: string, name: string) {
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportWorkflow() {
    if (!parseWorkflow(JSON.stringify(workflow))) {
      setMessage("Give every node a valid name before exporting.");
      return;
    }
    downloadJson(
      JSON.stringify(workflow, null, 2),
      `axiom-${tenantId}-workflow.json`,
    );
    setMessage("Workflow exported as a portable JSON blueprint.");
  }

  async function importWorkflow(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 100_000) {
      setMessage("Choose a workflow JSON file smaller than 100 KB.");
      return;
    }
    try {
      const imported = parseWorkflow(await file.text());
      if (!imported) {
        setMessage(
          "This file is not a valid Axiom workflow. Check its nodes, coordinates, and connections.",
        );
        return;
      }
      updateWorkflow(imported);
      setSelectedId(imported.nodes[0].id);
      setSourceId(imported.nodes[0].id);
      setTargetId(imported.nodes[1]?.id ?? imported.nodes[0].id);
      setMessage(
        "Blueprint imported. Your previous canvas is available with Undo.",
      );
    } catch {
      setMessage(
        "This file could not be read. Choose another workflow JSON file.",
      );
    }
  }

  function selectTemplate(id: WorkflowTemplateId) {
    const next = createWorkflowTemplate(id);
    updateWorkflow(next);
    setSelectedId("planner");
    setSourceId("planner");
    setTargetId("output");
    setRequest(workflowTemplates.find((item) => item.id === id)!.request);
    setMessage(
      `${next.name} blueprint loaded. Your previous canvas is available with Undo.`,
    );
  }

  function resetWorkflow() {
    const seed = createSeedWorkflow();
    updateWorkflow(seed);
    setSelectedId("planner");
    setSourceId("planner");
    setTargetId("output");
    setMessage(
      "Starter workflow restored. Your saved version is available with Load saved until you save again.",
    );
  }

  return (
    <div className="page-container workflow-page">
      <div className="workflow-breadcrumb">
        <span>Platform</span>
        <ChevronRight size={12} aria-hidden="true" />
        <span>Agent orchestration</span>
      </div>
      <div className="workflow-page-heading">
        <div>
          <p className="eyebrow">
            <span className="workflow-status-dot" /> AGENT WORKFLOWS
          </p>
          <h1>Turn intent into action.</h1>
          <p className="workflow-page-description">
            Design autonomous systems with a human in control.
            <br className="workflow-desktop-break" /> Build, inspect, and test
            every step on one canvas.
          </p>
        </div>
        <div className="workflow-heading-note">
          <GitBranch size={18} aria-hidden="true" />
          <span>
            YOUR AGENT CONTROL PLANE
            <br />
            <strong>Build confidently. Scale deliberately.</strong>
          </span>
        </div>
      </div>

      <section
        className="workflow-blueprints"
        aria-label="Starter workflow blueprints"
      >
        {workflowTemplates.map((template, index) => (
          <button
            key={template.id}
            type="button"
            disabled={running}
            onClick={() => selectTemplate(template.id)}
            className={
              workflow.name === template.name
                ? "workflow-blueprint is-active"
                : "workflow-blueprint"
            }
            aria-pressed={workflow.name === template.name}
          >
            <span className="workflow-blueprint-number">0{index + 1}</span>
            <span>
              <small>{template.tag}</small>
              <strong>{template.name}</strong>
              <span>{template.description}</span>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        ))}
      </section>

      <section
        className="workflow-editor"
        aria-label="Interactive agent workflow editor"
      >
        <div className="workflow-toolbar">
          <div className="workflow-project-title">
            <span className="workflow-project-icon">
              <Layers3 size={17} aria-hidden="true" />
            </span>
            <div>
              <h2>{workflow.name ?? "Untitled workflow"}</h2>
              <span>
                {workflow.nodes.length} nodes <span aria-hidden="true">·</span>{" "}
                {workflow.edges.length} connections
              </span>
            </div>
            <span className="workflow-draft">
              {dirty ? "Unsaved" : "Draft"}
            </span>
          </div>
          <div className="workflow-toolbar-actions">
            <div className="workflow-history">
              <button
                type="button"
                aria-label="Undo last change"
                title="Undo last change"
                onClick={() => restoreHistory("undo")}
                disabled={running || !past.length}
              >
                <Undo2 size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Redo last change"
                title="Redo last change"
                onClick={() => restoreHistory("redo")}
                disabled={running || !future.length}
              >
                <Redo2 size={16} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className="workflow-small-button"
              onClick={saveWorkflow}
              disabled={running}
            >
              <Save size={14} aria-hidden="true" /> Save
            </button>
            <button
              type="button"
              className="button button-primary workflow-run-button"
              onClick={running ? stopSimulation : runWorkflow}
            >
              {running ? (
                <Square size={13} fill="currentColor" aria-hidden="true" />
              ) : (
                <Play size={13} fill="currentColor" aria-hidden="true" />
              )}
              {running ? "Stop simulation" : "Run simulation"}
            </button>
          </div>
        </div>

        <div className="workflow-editor-body">
          <aside className="workflow-palette" aria-label="Node library">
            <div className="workflow-section-label">
              NODE LIBRARY <span>05</span>
            </div>
            <p>The building blocks of your system.</p>
            <div className="workflow-palette-items">
              {kinds.map((kind) => {
                const Icon = nodeIcons[kind];
                return (
                  <button
                    type="button"
                    className={`workflow-palette-item workflow-kind-${kind}`}
                    key={kind}
                    onClick={() => addNode(kind)}
                    disabled={running || workflow.nodes.length >= 12}
                  >
                    <span className="workflow-type-icon">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{nodeDefinitions[kind].label}</strong>
                      <small>{nodeDefinitions[kind].description}</small>
                    </span>
                    <Plus
                      size={13}
                      className="workflow-add-icon"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
            <div className="workflow-palette-transfer">
              <button
                type="button"
                className="workflow-text-button"
                onClick={exportWorkflow}
                disabled={running}
              >
                <Download size={13} aria-hidden="true" /> Export blueprint
              </button>
              <button
                type="button"
                className="workflow-text-button"
                onClick={() => importInput.current?.click()}
                disabled={running}
              >
                <Upload size={13} aria-hidden="true" /> Import blueprint
              </button>
              <input
                ref={importInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={importWorkflow}
                aria-label="Import workflow JSON"
              />
            </div>
            <div className="workflow-palette-tip">
              <CircleDot size={15} aria-hidden="true" />
              <p>
                Small, focused agents.
                <br />
                Extraordinary together.
              </p>
            </div>
            <button
              type="button"
              className="workflow-text-button"
              onClick={loadWorkflow}
              disabled={running}
            >
              <ArrowDownToLine size={13} aria-hidden="true" /> Load saved
            </button>
            <button
              type="button"
              className="workflow-text-button"
              onClick={resetWorkflow}
              disabled={running}
            >
              <RotateCcw size={13} aria-hidden="true" /> Reset canvas
            </button>
          </aside>

          <div className="workflow-canvas-column">
            <div className="workflow-canvas-topline">
              <span>
                <span className="workflow-status-dot" />{" "}
                {running ? "SIMULATION RUNNING" : "WORKFLOW CANVAS"}
              </span>
              <span>Browser sandbox</span>
            </div>
            <div
              ref={canvasViewport}
              className="workflow-canvas-viewport"
              role="region"
              aria-label="Draggable workflow canvas"
              tabIndex={0}
              aria-describedby="workflow-canvas-help"
            >
              <div
                className="workflow-stage-shell"
                style={{
                  width: WORKFLOW_WIDTH * zoom,
                  height: WORKFLOW_HEIGHT * zoom,
                }}
              >
                <div
                  className="workflow-stage"
                  style={{
                    width: WORKFLOW_WIDTH,
                    height: WORKFLOW_HEIGHT,
                    transform: `scale(${zoom})`,
                  }}
                >
                  <svg
                    className="workflow-edges"
                    width={WORKFLOW_WIDTH}
                    height={WORKFLOW_HEIGHT}
                    aria-hidden="true"
                  >
                    <defs>
                      <marker
                        id="workflow-arrow"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#7d8190" />
                      </marker>
                      <linearGradient id="workflow-edge-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={WORKFLOW_WIDTH} y2={WORKFLOW_HEIGHT}>
                        <stop offset="0%" stopColor="#77bda7" />
                        <stop offset="100%" stopColor="#9587c1" />
                      </linearGradient>
                    </defs>
                    {workflow.edges.map((edge) => {
                      const source = workflow.nodes.find(
                        (node) => node.id === edge.source,
                      );
                      const target = workflow.nodes.find(
                        (node) => node.id === edge.target,
                      );
                      if (!source || !target) return null;
                      const x1 = source.x + NODE_WIDTH;
                      const y1 = source.y + NODE_HEIGHT / 2;
                      const x2 = target.x;
                      const y2 = target.y + NODE_HEIGHT / 2;
                      const curve = Math.max(30, Math.abs(x2 - x1) * 0.5);
                      return (
                        <path
                          key={`${edge.source}-${edge.target}`}
                          d={`M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke={
                            completed.includes(edge.source)
                              ? "#9df5ce"
                              : "url(#workflow-edge-gradient)"
                          }
                          strokeWidth={1.25}
                          markerEnd="url(#workflow-arrow)"
                          className={
                            activeId === edge.source && !reducedMotion
                              ? "workflow-edge-active"
                              : ""
                          }
                        />
                      );
                    })}
                  </svg>
                  {workflow.nodes.map((node) => {
                    const Icon = nodeIcons[node.kind];
                    const isComplete = completed.includes(node.id);
                    return (
                      <button
                        type="button"
                        key={node.id}
                        className={`workflow-node workflow-kind-${node.kind}${node.id === selectedId ? " workflow-node-selected" : ""}${activeId === node.id ? " workflow-node-active" : ""}${isComplete ? " workflow-node-complete" : ""}`}
                        style={{
                          left: node.x,
                          top: node.y,
                          width: NODE_WIDTH,
                          height: NODE_HEIGHT,
                        }}
                        onClick={() => setSelectedId(node.id)}
                        onPointerDown={(event) => beginDrag(event, node)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        onKeyDown={(event) => keyboardMove(event, node)}
                        aria-pressed={selectedId === node.id}
                      >
                        <span className="workflow-node-port workflow-node-port-in" />
                        <span className="workflow-node-top">
                          <span className="workflow-type-icon">
                            <Icon size={17} aria-hidden="true" />
                          </span>
                          <span className="workflow-node-kind">
                            {node.kind === "input"
                              ? "TRIGGER"
                              : node.kind === "output"
                                ? "ACTION"
                                : "AGENT"}
                          </span>
                          {isComplete ? (
                            <Check
                              size={13}
                              className="workflow-node-check"
                              aria-hidden="true"
                            />
                          ) : (
                            <Grip
                              size={13}
                              className="workflow-node-grip"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <strong>{node.name}</strong>
                        <span className="workflow-node-model">
                          {activeId === node.id ? "Simulating…" : node.model}
                        </span>
                        <span className="workflow-node-port workflow-node-port-out" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="workflow-canvas-footer">
              <span id="workflow-canvas-help">
                <Grip size={12} aria-hidden="true" /> Drag nodes · Arrow keys to
                move · Shift for precision
              </span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <div className="workflow-connect-panel">
              <div className="workflow-section-label">
                <Link2 size={13} aria-hidden="true" /> CONNECT NODES
              </div>
              <div className="workflow-connect-controls">
                <label>
                  <span>From</span>
                  <select
                    value={sourceId}
                    onChange={(event) => setSourceId(event.target.value)}
                    disabled={running}
                  >
                    {workflow.nodes.map((node) => (
                      <option value={node.id} key={node.id}>
                        {node.name}
                      </option>
                    ))}
                  </select>
                </label>
                <ArrowRight
                  className="workflow-connect-arrow"
                  size={15}
                  aria-hidden="true"
                />
                <label>
                  <span>To</span>
                  <select
                    value={targetId}
                    onChange={(event) => setTargetId(event.target.value)}
                    disabled={running}
                  >
                    {workflow.nodes.map((node) => (
                      <option value={node.id} key={node.id}>
                        {node.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="workflow-small-button"
                  onClick={connectNodes}
                  disabled={running}
                >
                  <Plus size={13} aria-hidden="true" /> Connect
                </button>
              </div>
            </div>
          </div>

          <aside
            className="workflow-properties"
            aria-label="Selected node configuration"
          >
            <div className="workflow-section-label">
              NODE CONFIGURATION{" "}
              <span>
                <SlidersIcon />
              </span>
            </div>
            <label className="workflow-node-select">
              Selected node
              <select
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {workflow.nodes.map((node) => (
                  <option value={node.id} key={node.id}>
                    {node.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedNode && (
              <>
                <div
                  className={`workflow-selected-kind workflow-kind-${selectedNode.kind}`}
                >
                  <span className="workflow-type-icon">
                    {(() => {
                      const Icon = nodeIcons[selectedNode.kind];
                      return <Icon size={20} aria-hidden="true" />;
                    })()}
                  </span>
                  <div>
                    <strong>{nodeDefinitions[selectedNode.kind].label}</strong>
                    <span>Changes apply to this canvas</span>
                  </div>
                </div>
                <div className="workflow-config-fields">
                  <label>
                    Node name
                    <input
                      value={selectedNode.name}
                      maxLength={40}
                      disabled={running}
                      onChange={(event) =>
                        updateNode({ name: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    {selectedNode.kind === "input"
                      ? "Trigger type"
                      : selectedNode.kind === "output"
                        ? "Response format"
                        : "Model"}
                    <input
                      value={selectedNode.model}
                      maxLength={80}
                      disabled={running}
                      onChange={(event) =>
                        updateNode({ model: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Instructions
                    <textarea
                      rows={4}
                      value={selectedNode.instructions}
                      maxLength={1000}
                      disabled={running}
                      onChange={(event) =>
                        updateNode({ instructions: event.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="workflow-connections-list">
                  <div className="workflow-section-label">CONNECTIONS</div>
                  {workflow.edges.filter(
                    (edge) =>
                      edge.source === selectedId || edge.target === selectedId,
                  ).length === 0 && <p>No connections yet.</p>}
                  {workflow.edges
                    .filter(
                      (edge) =>
                        edge.source === selectedId ||
                        edge.target === selectedId,
                    )
                    .map((edge) => {
                      const outgoing = edge.source === selectedId;
                      const other = workflow.nodes.find(
                        (node) =>
                          node.id === (outgoing ? edge.target : edge.source),
                      );
                      return (
                        <div key={`${edge.source}-${edge.target}`}>
                          <span>
                            <span className="workflow-connection-direction">
                              {outgoing ? "To" : "From"}
                            </span>
                            {other?.name}
                          </span>
                          <button
                            type="button"
                            disabled={running}
                            aria-label={`Remove connection from ${workflow.nodes.find((node) => node.id === edge.source)?.name} to ${workflow.nodes.find((node) => node.id === edge.target)?.name}`}
                            onClick={() => {
                              updateWorkflow({
                                ...workflow,
                                edges: workflow.edges.filter(
                                  (item) => item !== edge,
                                ),
                              });
                              setMessage("Connection removed.");
                            }}
                          >
                            <X size={12} aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                </div>
                <button
                  type="button"
                  className="workflow-remove-node"
                  onClick={removeNode}
                  disabled={running || workflow.nodes.length === 1}
                >
                  <Trash2 size={13} aria-hidden="true" /> Remove node
                </button>
              </>
            )}
          </aside>
        </div>
        <div className="workflow-status-bar" role="status" aria-live="polite">
          <CircleDot size={13} aria-hidden="true" />
          <span>{message}</span>
          <span className="workflow-status-workspace">
            {tenantId.toUpperCase()} / LOCAL
          </span>
        </div>
      </section>

      <div className="workflow-run-studio">
        <section
          className="workflow-test-input"
          aria-labelledby="workflow-input-title"
        >
          <div className="workflow-section-label">
            <span>01 / TEST INPUT</span>
            <span className="workflow-demo-label">SANDBOX</span>
          </div>
          <h2 id="workflow-input-title">Give your agents a mission.</h2>
          <label htmlFor="workflow-request" className="sr-only">
            Test request for this simulation
          </label>
          <textarea
            id="workflow-request"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            maxLength={2000}
            rows={4}
            disabled={running}
            placeholder="Describe a task to inspect through your workflow…"
          />
          <div className="workflow-validation" aria-live="polite">
            {issues.length ? (
              <>
                <AlertCircle size={15} aria-hidden="true" />
                <span>
                  {issues.length} {issues.length === 1 ? "issue" : "issues"} to
                  resolve
                  <ul>
                    {issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </span>
              </>
            ) : (
              <>
                <ShieldCheck size={15} aria-hidden="true" />
                <span>Graph validated. Every branch reaches an output.</span>
              </>
            )}
          </div>
        </section>
        <section
          className="workflow-trace panel"
          aria-label="Simulation inspector"
        >
          <div className="workflow-trace-heading">
            <div
              className="workflow-inspector-tabs"
              role="tablist"
              aria-label="Simulation inspector"
            >
              <button
                type="button"
                role="tab"
                id="workflow-trace-tab"
                aria-selected={inspectorTab === "trace"}
                aria-controls="workflow-trace-panel"
                onClick={() => setInspectorTab("trace")}
                tabIndex={inspectorTab === "trace" ? 0 : -1}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    setInspectorTab("output");
                    document.getElementById("workflow-output-tab")?.focus();
                  }
                }}
              >
                <Terminal size={14} aria-hidden="true" /> Execution trace
              </button>
              <button
                type="button"
                role="tab"
                id="workflow-output-tab"
                aria-selected={inspectorTab === "output"}
                aria-controls="workflow-output-panel"
                onClick={() => setInspectorTab("output")}
                tabIndex={inspectorTab === "output" ? 0 : -1}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    setInspectorTab("trace");
                    document.getElementById("workflow-trace-tab")?.focus();
                  }
                }}
              >
                <Braces size={14} aria-hidden="true" /> Output
              </button>
            </div>
            <span>
              {running
                ? `${completed.length}/${workflow.nodes.length} completed`
                : trace.length
                  ? `${completed.length} nodes completed`
                  : "Awaiting your first run"}
            </span>
          </div>
          <div
            id="workflow-trace-panel"
            role="tabpanel"
            aria-labelledby="workflow-trace-tab"
            hidden={inspectorTab !== "trace"}
            tabIndex={0}
          >
            <div
              className="workflow-trace-content"
              role="log"
              aria-label="Simulated execution events"
              aria-live="polite"
            >
              {trace.length ? (
                trace.map((entry, index) => (
                  <motion.div
                    key={`${tenantId}-${index}-${entry}`}
                    initial={reducedMotion ? false : { opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span className="workflow-trace-marker">
                      {index ? "✓" : "›"}
                    </span>
                    {entry}
                  </motion.div>
                ))
              ) : (
                <div className="workflow-trace-empty">
                  <GitBranch size={28} aria-hidden="true" />
                  <p>A clear view of every decision.</p>
                  <span>Run your workflow to inspect its execution path.</span>
                </div>
              )}
            </div>
          </div>
          <div
            id="workflow-output-panel"
            role="tabpanel"
            aria-labelledby="workflow-output-tab"
            hidden={inspectorTab !== "output"}
            tabIndex={0}
            className="workflow-output"
          >
            {result ? (
              <>
                <button
                  type="button"
                  className="workflow-text-button"
                  onClick={() =>
                    downloadJson(result, "axiom-simulation-report.json")
                  }
                >
                  <Download size={13} aria-hidden="true" /> Download run report
                </button>
                <pre>{result}</pre>
              </>
            ) : (
              <p>
                Complete a simulation to inspect your request, node
                configuration, and dependency report.
              </p>
            )}
          </div>
        </section>
      </div>
      <div className="workflow-bottom-note">
        <ShieldCheck size={14} aria-hidden="true" />
        <p>
          Built for experimentation. Simulation follows graph order; no models
          run and no data leaves this browser. Node settings are saved locally,
          without authentication or server-side tenant isolation.
        </p>
      </div>
    </div>
  );
}

function SlidersIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <path d="M2 4h12M2 12h12M5 1v6M11 9v6" />
    </svg>
  );
}
