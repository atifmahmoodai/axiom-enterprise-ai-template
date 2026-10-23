import { getPool } from "@/lib/server/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await getPool().query("SELECT 1");
    return Response.json(
      { status: "ready", version: "2.0.0" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
