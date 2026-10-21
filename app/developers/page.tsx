import type { Metadata } from "next";
import { DeveloperWorkspace } from "@/components/developer-workspace";

export const metadata: Metadata = {
  title: "Developer workspace",
  description:
    "An interactive multi-language AI API playground, response inspector, and workspace key manager.",
};

export default function DevelopersPage() {
  return <DeveloperWorkspace />;
}
