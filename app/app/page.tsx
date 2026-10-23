import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export default async function Application() {
  const session = await getSession(
    new Request(process.env.APP_URL || "http://localhost:3000", {
      headers: await headers(),
    }),
  );
  if (!session) redirect("/login");
  if (session.workspaces[0])
    redirect(`/app/${session.workspaces[0].id}/overview`);
  return (
    <div style={{ maxWidth: 600, margin: "15vh auto", padding: 24 }}>
      <h1>Membership required</h1>
      <p>
        Your identity is verified. Ask a workspace administrator to grant
        membership; signing in does not automatically grant access to customer
        data.
      </p>
      <a href="/login">Return to sign in</a>
    </div>
  );
}
