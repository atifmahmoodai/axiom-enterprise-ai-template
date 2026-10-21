import type { Metadata } from "next";
import { WorkflowBuilder } from "@/components/workflow-builder";

export const metadata: Metadata = {
  title: "Agent workflows",
  description:
    "Design, connect, and simulate autonomous agent workflows in a visual orchestration workspace.",
};

export default function WorkflowsPage() {
  return <WorkflowBuilder />;
}
