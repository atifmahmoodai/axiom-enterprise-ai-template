import {
  callbackLogin,
  demoLogin,
  getSession,
  logout,
  startLogin,
} from "@/lib/server/auth";
import { errorResponse, json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const { action } = await params;
    if (action === "login") return await startLogin(request);
    if (action === "callback") return await callbackLogin(request);
    if (action === "session") return json(await getSession(request));
    return json({ error: { message: "Not found." } }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const { action } = await params;
    if (action === "demo") return await demoLogin(request);
    if (action === "logout") return await logout(request);
    return json({ error: { message: "Not found." } }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
