import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { AppError } from "./db";
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function errorResponse(error: unknown) {
  const requestId = randomUUID();
  if (error instanceof AppError)
    return Response.json(
      { error: { code: error.code, message: error.message }, requestId },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  if (error instanceof ZodError)
    return json(
      {
        error: {
          code: "invalid_input",
          message: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .slice(0, 5)
            .join("; "),
        },
        requestId,
      },
      422,
    );
  console.error(
    `Request ${requestId}:`,
    error instanceof Error ? error.message : "Unknown failure",
  );
  return json(
    {
      error: {
        code: "service_error",
        message:
          "This operation could not complete. Check service configuration and retry.",
      },
      requestId,
    },
    500,
  );
}
export async function readBody(request: Request, maxBytes = 1_048_576) {
  const bytes = await boundedBody(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AppError(422, "invalid_json", "Send a valid JSON request.");
  }
}
export async function boundedBody(request: Request, maxBytes: number) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError(
          413,
          "request_too_large",
          "The request exceeds this operation’s size limit.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
