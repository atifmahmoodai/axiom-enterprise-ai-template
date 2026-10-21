import assert from "node:assert/strict";
import test from "node:test";
import {
  connectionError,
  createSeedWorkflow,
  createWorkflowTemplate,
  workflowIssues,
  workflowTemplates,
  executionOrder,
  parseWorkflow,
} from "../lib/workflow";

test("connections reject direct and transitive cycles and duplicate edges", () => {
  const workflow = createSeedWorkflow();
  assert.match(connectionError(workflow, "input", "input")!, /itself/);
  assert.match(connectionError(workflow, "output", "input")!, /cycle/);
  assert.match(connectionError(workflow, "planner", "research")!, /already/);
  assert.equal(connectionError(workflow, "research", "review"), null);
});

test("execution respects every dependency including converging branches", () => {
  const workflow = createSeedWorkflow();
  const order = executionOrder(workflow);
  for (const edge of workflow.edges)
    assert.ok(order.indexOf(edge.source) < order.indexOf(edge.target));
  assert.equal(new Set(order).size, workflow.nodes.length);
});

test("stored workflows validate boundaries, identity, structure, and acyclicity", () => {
  const workflow = createSeedWorkflow();
  assert.deepEqual(parseWorkflow(JSON.stringify(workflow)), workflow);
  assert.equal(parseWorkflow("not-json"), null);
  assert.equal(
    parseWorkflow(
      JSON.stringify({ ...workflow, nodes: [{ ...workflow.nodes[0], x: -1 }] }),
    ),
    null,
  );
  assert.equal(
    parseWorkflow(
      JSON.stringify({
        ...workflow,
        edges: [...workflow.edges, { source: "output", target: "input" }],
      }),
    ),
    null,
  );
  assert.equal(
    parseWorkflow(
      JSON.stringify({
        ...workflow,
        nodes: [...workflow.nodes, workflow.nodes[0]],
      }),
    ),
    null,
  );
  assert.equal(
    parseWorkflow(
      JSON.stringify({
        ...workflow,
        edges: [{ source: "missing", target: "input" }],
      }),
    ),
    null,
  );
});

test("all starter blueprints have runnable paths and survive import/export", () => {
  for (const template of workflowTemplates) {
    const workflow = createWorkflowTemplate(template.id);
    assert.deepEqual(workflowIssues(workflow), []);
    assert.deepEqual(parseWorkflow(JSON.stringify(workflow)), workflow);
  }
});

test("disconnected nodes and reversed terminal semantics prevent execution", () => {
  const disconnected = createSeedWorkflow();
  disconnected.edges = disconnected.edges.filter(
    (edge) => edge.source !== "review" && edge.target !== "review",
  );
  assert.ok(
    workflowIssues(disconnected).some((issue) =>
      issue.includes("input trigger"),
    ),
  );
  assert.ok(
    workflowIssues(disconnected).some((issue) =>
      issue.includes("output action"),
    ),
  );
  const noOutput = createSeedWorkflow();
  noOutput.nodes = noOutput.nodes.filter((node) => node.kind !== "output");
  noOutput.edges = noOutput.edges.filter((edge) => edge.target !== "output");
  assert.ok(workflowIssues(noOutput).includes("Add an output action."));
});
