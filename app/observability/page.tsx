import type { Metadata } from "next";
import { Observability } from "@/components/observability";

export const metadata: Metadata = {
  title: "Observability",
  description:
    "Explore requests, inference latency, token throughput, and model health in Axiom's interactive observability workspace.",
};

export default function ObservabilityPage() {
  return <Observability />;
}
