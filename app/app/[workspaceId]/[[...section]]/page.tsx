import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/server/auth";
import { IntelligenceWorkspace } from "@/components/intelligence/workspace";
export const dynamic = "force-dynamic";
export default async function Workspace({
  params,
}: {
  params: Promise<{ workspaceId: string; section?: string[] }>;
}) {
  const { workspaceId, section } = await params;
  const active = section?.[0] || "overview";
  if (
    (section?.length ?? 0) > 1 ||
    ![
      "overview",
      "datasets",
      "analyst",
      "lab",
      "catalog",
      "evaluations",
      "reports",
      "governance",
    ].includes(active)
  )
    notFound();
  const session = await getSession(
    new Request(process.env.APP_URL || "http://localhost:3000", {
      headers: await headers(),
    }),
  );
  if (!session) redirect("/login");
  const membership = session.workspaces.find((w) => w.id === workspaceId);
  if (!membership) notFound();
  return (
    <IntelligenceWorkspace
      workspaceId={workspaceId}
      section={active}
      user={{
        id: session.user.id,
        name: session.user.name,
        role: membership.role,
      }}
      workspaces={session.workspaces}
      mode={process.env.AXIOM_MODE === "connected" ? "connected" : "demo"}
    />
  );
}
