import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { AppError } from "./db";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_ROWS = 1_000_000;
const safePart = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,179}$/;
export function storagePath(workspaceId: string, key: string): string {
  if (
    !safePart.test(workspaceId) ||
    !/^[a-f0-9-]{36}\.(bin|json|parquet)$/.test(key)
  )
    throw new AppError(
      422,
      "invalid_storage_key",
      "Invalid stored object identifier.",
    );
  return path.join(
    path.resolve(process.env.AXIOM_STORAGE_DIR || ".data"),
    workspaceId,
    key,
  );
}
export async function writeObject(
  workspaceId: string,
  data: Uint8Array,
  extension: "bin" | "json" | "parquet" = "bin",
) {
  const key = `${randomUUID()}.${extension}`;
  const file = storagePath(workspaceId, key);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, data, { mode: 0o600, flag: "wx" });
  return {
    key,
    hash: createHash("sha256").update(data).digest("hex"),
    bytes: data.byteLength,
  };
}
export async function readObject(
  workspaceId: string,
  key: string,
  maxBytes = 128 * 1024 * 1024,
) {
  const file = storagePath(workspaceId, key);
  const metadata = await stat(file);
  if (metadata.size > maxBytes)
    throw new AppError(
      413,
      "object_too_large",
      "The stored object exceeds the read limit.",
    );
  return readFile(file);
}
export async function reserveObject(
  workspaceId: string,
  extension: "json" | "parquet",
) {
  const key = `${randomUUID()}.${extension}`;
  const file = storagePath(workspaceId, key);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  return { key, path: file };
}

/** Runs only the bundled trusted program; neither scripts nor command-line flags come from users. */
export async function runPython<T>(
  task: "profile" | "transform" | "rows" | "lab" | "query",
  input: Record<string, unknown>,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const program = path.join(process.cwd(), "python", "analytics.py");
  const encoded = JSON.stringify({ task, ...input });
  if (Buffer.byteLength(encoded) > 16 * 1024 * 1024)
    throw new AppError(
      413,
      "analysis_input_too_large",
      "Analysis input exceeds 16 MiB.",
    );
  return new Promise<T>((resolve, reject) => {
    const processChild = spawn(process.env.PYTHON_BIN || "python3", [program], {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        PATH: process.env.PATH,
        LANG: "C.UTF-8",
        TZ: "UTC",
        PYTHONNOUSERSITE: "1",
        PYTHONHASHSEED: "0",
        PYTHONUNBUFFERED: "1",
        OMP_NUM_THREADS: "1",
        OPENBLAS_NUM_THREADS: "1",
        MKL_NUM_THREADS: "1",
      },
    });
    let output = "",
      error = "",
      settled = false;
    const stop = () => {
      try {
        if (process.platform !== "win32" && processChild.pid)
          process.kill(-processChild.pid, "SIGKILL");
        else processChild.kill("SIGKILL");
      } catch {}
    };
    const finish = (err?: Error, result?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      err ? reject(err) : resolve(result as T);
    };
    const onAbort = () => {
      stop();
      finish(
        new AppError(409, "job_cancelled", "The operation was cancelled."),
      );
    };
    const timer = setTimeout(() => {
      stop();
      finish(
        new AppError(
          504,
          "analysis_timeout",
          "The operation exceeded its execution deadline.",
        ),
      );
    }, options.timeoutMs ?? 60_000);
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) {
      onAbort();
      return;
    }
    processChild.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (Buffer.byteLength(output) > 8 * 1024 * 1024) {
        stop();
        finish(
          new AppError(
            413,
            "analysis_output_too_large",
            "Analysis output exceeded its limit.",
          ),
        );
      }
    });
    processChild.stderr.on("data", (chunk: Buffer) => {
      if (error.length < 16_384) error += chunk.toString();
    });
    processChild.on("error", () =>
      finish(
        new AppError(
          503,
          "python_unavailable",
          "The analytical Python runtime is unavailable. Install requirements.txt.",
        ),
      ),
    );
    processChild.on("close", (code) => {
      if (settled) return;
      try {
        const decoded = JSON.parse(output);
        if (code !== 0 || decoded.error)
          finish(
            new AppError(
              422,
              decoded.code || "analysis_failed",
              String(decoded.error || "The analytical operation failed.").slice(
                0,
                500,
              ),
            ),
          );
        else finish(undefined, decoded as T);
      } catch {
        finish(
          new AppError(
            422,
            "analysis_failed",
            error.includes("ModuleNotFoundError")
              ? "Install the analytical dependencies from requirements.txt."
              : "The analytical operation returned an invalid result.",
          ),
        );
      }
    });
    processChild.stdin.on("error", () => {});
    processChild.stdin.end(encoded);
  });
}
