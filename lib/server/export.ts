import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkspaceContext } from "@/lib/intelligence/contracts";
import { AppError, withWorkspace } from "./db";

export const EXPORT_REQUEST_BYTES = 2 * 1024 * 1024;
const EXPORT_CSV_BYTES = 2 * 1024 * 1024;
const snapshotSchema = z
  .object({
    rows: z.array(z.record(z.string(), z.json())).max(10_000),
    columns: z
      .array(z.string().min(1).max(200))
      .min(1)
      .max(128)
      .refine(
        (columns) => new Set(columns).size === columns.length,
        "Column names must be unique.",
      ),
    filename: z.string().max(180).optional(),
    datasetVersion: z.string().max(200).optional(),
  })
  .strict();

/** Exports a caller-supplied display snapshot, not a trusted recomputation. */
export async function exportSnapshot(ctx: WorkspaceContext, input: unknown) {
  return withWorkspace(ctx, async (db) => {
    const role = await db.query(
      "SELECT current_setting('app.role',true) AS role",
    );
    if (!["analyst", "administrator", "owner"].includes(role.rows[0]?.role))
      throw new AppError(
        403,
        "export_denied",
        "An analyst role is required to export snapshots.",
      );
    if (Buffer.byteLength(JSON.stringify(input) ?? "") > EXPORT_REQUEST_BYTES)
      throw new AppError(
        413,
        "export_too_large",
        "The snapshot exceeds the 2 MiB export request limit.",
      );
    const snapshot = snapshotSchema.parse(input);
    const quote = (value: unknown) => {
      let text =
        value === null || value === undefined
          ? ""
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
      // Spreadsheet apps may trim whitespace before recognizing formulas.
      if (
        typeof value !== "number" &&
        /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(text)
      )
        text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const lines = [snapshot.columns.map(quote).join(",")];
    let bytes = Buffer.byteLength(lines[0]);
    for (const row of snapshot.rows) {
      const line = snapshot.columns
        .map((column) => quote(row[column]))
        .join(",");
      bytes += 2 + Buffer.byteLength(line);
      if (bytes > EXPORT_CSV_BYTES)
        throw new AppError(
          413,
          "export_too_large",
          "The CSV exceeds the 2 MiB export limit. Narrow the result first.",
        );
      lines.push(line);
    }
    const id = randomUUID();
    const safeName = (snapshot.filename || "axiom-snapshot.csv")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 160);
    const filename = /\.csv$/i.test(safeName) ? safeName : `${safeName}.csv`;
    await db.query(
      "INSERT INTO audit_events(workspace_id,actor_id,action,resource_id,detail) VALUES($1,$2,'snapshot.exported',$3,$4)",
      [
        ctx.workspaceId,
        ctx.userId,
        id,
        JSON.stringify({
          source: "client-supplied-snapshot",
          verifiedRecomputation: false,
          rows: snapshot.rows.length,
          columns: snapshot.columns.length,
          bytes,
          claimedDatasetVersion: snapshot.datasetVersion ?? null,
        }),
      ],
    );
    return { id, csv: lines.join("\r\n"), filename };
  });
}
