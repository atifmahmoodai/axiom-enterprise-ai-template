import { getSession } from "@/lib/server/auth";
import { errorResponse, json } from "@/lib/server/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return json({
      session: await getSession(request),
      mode: process.env.AXIOM_MODE === "connected" ? "connected" : "demo",
      connections: {
        openai:
          process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL
            ? "configured"
            : "unconfigured",
        oidc: process.env.OIDC_ISSUER ? "configured" : "unconfigured",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
