import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import * as oidc from "openid-client";
import type { Role, WorkspaceContext } from "@/lib/intelligence/contracts";
import { AppError, getPool } from "./db";

export type Session = {
  user: { id: string; name: string; email: string };
  workspaces: { id: string; name: string; role: Role }[];
  expiresAt: string;
};
export const roleRank: Record<Role, number> = {
  viewer: 0,
  analyst: 1,
  administrator: 2,
  owner: 3,
};
const sessionCookie = "axiom_session";
const transactionCookie = "axiom_oidc";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function cookies(request: Request): Record<string, string> {
  return Object.fromEntries(
    (request.headers.get("cookie") || "")
      .split(";")
      .map((part) => {
        const index = part.indexOf("=");
        return index < 0
          ? ["", ""]
          : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
      })
      .filter(([key]) => key),
  );
}
function appUrl() {
  return new URL(process.env.APP_URL || "http://localhost:3000");
}
function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${appUrl().protocol === "https:" ? "; Secure" : ""}`;
}
function equal(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    origin !== appUrl().origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw new AppError(
      403,
      "origin_denied",
      "This action must originate from this application.",
    );
  }
}
export async function getSession(request: Request): Promise<Session | null> {
  const token = cookies(request)[sessionCookie];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN READ ONLY");
    const session = await client.query<{
      id: string;
      name: string;
      email: string;
      expires_at: Date;
    }>(
      "SELECT u.id,u.name,u.email,s.expires_at FROM sessions s JOIN app_users u ON u.id=s.user_id WHERE s.id_hash=$1 AND s.expires_at>now()",
      [digest(token)],
    );
    if (!session.rowCount) {
      await client.query("COMMIT");
      return null;
    }
    const user = session.rows[0];
    await client.query(
      "SELECT set_config('app.user_id',$1,true),set_config('app.workspace_id','',true),set_config('app.role','',true)",
      [user.id],
    );
    const workspaces = await client.query<{
      id: string;
      name: string;
      role: Role;
    }>(
      "SELECT w.id,w.name,m.role FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=$1 ORDER BY w.name",
      [user.id],
    );
    await client.query("COMMIT");
    return {
      user: { id: user.id, name: user.name, email: user.email },
      workspaces: workspaces.rows,
      expiresAt: user.expires_at.toISOString(),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
export async function requireWorkspace(
  request: Request,
  workspaceId: string,
  minimumRole: Role = "viewer",
): Promise<WorkspaceContext> {
  const session = await getSession(request);
  if (!session)
    throw new AppError(401, "authentication_required", "Sign in to continue.");
  const membership = session.workspaces.find(
    (workspace) => workspace.id === workspaceId,
  );
  if (!membership || roleRank[membership.role] < roleRank[minimumRole])
    throw new AppError(
      403,
      "workspace_denied",
      "Your membership does not permit this operation.",
    );
  return { userId: session.user.id, workspaceId, role: membership.role };
}
async function createSession(
  userId: string,
  oldToken?: string,
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (oldToken)
      await client.query("DELETE FROM sessions WHERE id_hash=$1", [
        digest(oldToken),
      ]);
    await client.query(
      "INSERT INTO sessions(id_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
      [digest(token), userId],
    );
    await client.query("COMMIT");
    return token;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
export async function demoLogin(request: Request): Promise<Response> {
  assertSameOrigin(request);
  if (
    process.env.AXIOM_MODE !== "demo" ||
    process.env.AXIOM_DEMO_LOGIN !== "true"
  )
    throw new AppError(404, "demo_login_disabled", "Demo sign-in is disabled.");
  const body = (await request.json().catch(() => ({}))) as { userId?: string };
  const userId = body.userId || "demo-owner";
  if (
    !["demo-owner", "demo-analyst", "demo-viewer", "demo-helix"].includes(
      userId,
    )
  )
    throw new AppError(
      422,
      "invalid_demo_user",
      "Select an available demonstration account.",
    );
  const token = await createSession(userId, cookies(request)[sessionCookie]);
  return Response.json(
    {
      ok: true,
      redirect:
        userId === "demo-helix" ? "/app/helix/overview" : "/app/atlas/overview",
    },
    {
      headers: {
        "Set-Cookie": cookie(sessionCookie, token, 28_800),
        "Cache-Control": "no-store",
      },
    },
  );
}
export async function logout(request: Request): Promise<Response> {
  assertSameOrigin(request);
  const token = cookies(request)[sessionCookie];
  if (token)
    await getPool().query("DELETE FROM sessions WHERE id_hash=$1", [
      digest(token),
    ]);
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": cookie(sessionCookie, "", 0),
        "Cache-Control": "no-store",
      },
    },
  );
}
let configuration: Promise<oidc.Configuration> | undefined;
async function provider(): Promise<oidc.Configuration> {
  if (!process.env.OIDC_ISSUER || !process.env.OIDC_CLIENT_ID)
    throw new AppError(
      503,
      "identity_unconfigured",
      "An OIDC identity provider has not been configured.",
    );
  const issuer = new URL(process.env.OIDC_ISSUER);
  if (
    issuer.protocol !== "https:" &&
    process.env.AXIOM_ALLOW_INSECURE_OIDC !== "true"
  )
    throw new AppError(
      503,
      "identity_insecure",
      "OIDC requires HTTPS outside the explicit local development configuration.",
    );
  if (!configuration) {
    const options: oidc.DiscoveryRequestOptions =
      issuer.protocol === "http:"
        ? { execute: [oidc.allowInsecureRequests] }
        : {};
    if (process.env.OIDC_INTERNAL_ORIGIN) {
      const internal = new URL(process.env.OIDC_INTERNAL_ORIGIN);
      options[oidc.customFetch] = (input, init) => {
        const target = new URL(input);
        if (target.origin === issuer.origin) {
          target.hostname = internal.hostname;
          target.port = internal.port;
          target.protocol = internal.protocol;
        }
        const body =
          init.body instanceof Uint8Array
            ? new Uint8Array(init.body).buffer
            : init.body;
        return fetch(target, { ...init, body });
      };
    }
    configuration = oidc
      .discovery(
        issuer,
        process.env.OIDC_CLIENT_ID,
        process.env.OIDC_CLIENT_SECRET,
        undefined,
        options,
      )
      .catch((error) => {
        configuration = undefined;
        throw error;
      });
  }
  return configuration;
}
export async function startLogin(_request: Request): Promise<Response> {
  const config = await provider();
  const state = oidc.randomState(),
    nonce = oidc.randomNonce(),
    verifier = oidc.randomPKCECodeVerifier();
  await getPool().query(
    "INSERT INTO oidc_transactions(state_hash,verifier,nonce,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')",
    [digest(state), verifier, nonce],
  );
  const target = oidc.buildAuthorizationUrl(config, {
    redirect_uri: new URL("/api/auth/callback", appUrl()).href,
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.href,
      "Set-Cookie": cookie(transactionCookie, state, 600),
      "Cache-Control": "no-store",
    },
  });
}
export async function callbackLogin(request: Request): Promise<Response> {
  const currentUrl = new URL(request.url);
  const state = currentUrl.searchParams.get("state") || "";
  const storedCookie = cookies(request)[transactionCookie] || "";
  if (!state || !storedCookie || !equal(state, storedCookie))
    throw new AppError(
      400,
      "invalid_login_state",
      "The sign-in request expired or is not associated with this browser.",
    );
  const transaction = await getPool().query<{
    verifier: string;
    nonce: string;
  }>(
    "DELETE FROM oidc_transactions WHERE state_hash=$1 AND expires_at>now() RETURNING verifier,nonce",
    [digest(state)],
  );
  if (!transaction.rowCount)
    throw new AppError(400, "login_expired", "Start a new sign-in request.");
  const config = await provider();
  const canonical = new URL("/api/auth/callback", appUrl());
  canonical.search = currentUrl.search;
  const tokens = await oidc.authorizationCodeGrant(config, canonical, {
    pkceCodeVerifier: transaction.rows[0].verifier,
    expectedState: state,
    expectedNonce: transaction.rows[0].nonce,
  });
  const claims = tokens.claims();
  if (!claims?.sub)
    throw new AppError(
      401,
      "identity_invalid",
      "The provider did not return a valid identity.",
    );
  const issuer = String(claims.iss);
  const client = await getPool().connect();
  let userId: string;
  try {
    await client.query("BEGIN");
    const identity = await client.query<{ user_id: string }>(
      "SELECT user_id FROM identity_links WHERE issuer=$1 AND subject=$2",
      [issuer, claims.sub],
    );
    if (identity.rowCount) userId = identity.rows[0].user_id;
    else {
      userId = randomUUID();
      await client.query(
        "INSERT INTO app_users(id,name,email) VALUES($1,$2,$3)",
        [
          userId,
          typeof claims.name === "string"
            ? claims.name.slice(0, 180)
            : "Workspace member",
          typeof claims.email === "string" ? claims.email.slice(0, 320) : "",
        ],
      );
      await client.query(
        "INSERT INTO identity_links(issuer,subject,user_id) VALUES($1,$2,$3)",
        [issuer, claims.sub, userId],
      );
      // Membership is provisioned separately. An email address never grants access.
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  const token = await createSession(userId!, cookies(request)[sessionCookie]);
  const headers = new Headers({
    Location: new URL("/app", appUrl()).href,
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", cookie(sessionCookie, token, 28_800));
  headers.append("Set-Cookie", cookie(transactionCookie, "", 0));
  return new Response(null, { status: 302, headers });
}
