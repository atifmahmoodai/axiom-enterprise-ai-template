import { randomUUID } from "node:crypto";
import PgBoss from "pg-boss";
import type { JobRecord, WorkspaceContext } from "@/lib/intelligence/contracts";
import { AppError, audit, withWorkspace, workspaceQuery } from "./db";

type StoredJob = JobRecord & {
  payload: Record<string, unknown>;
  userId: string;
  bossId: string | null;
};
type HandlerOptions = {
  signal: AbortSignal;
  progress: (value: number) => Promise<void>;
  jobId: string;
};
export type JobHandler = (
  ctx: WorkspaceContext,
  payload: Record<string, unknown>,
  options: HandlerOptions,
) => Promise<unknown>;
const queueName = "axiom-background";
const globalBoss = globalThis as unknown as { axiomBoss?: Promise<PgBoss> };
const columns =
  'id,kind,status,progress,result,error,created_at AS "createdAt",payload,user_id AS "userId",boss_id AS "bossId"';
export async function getBoss(): Promise<PgBoss> {
  if (!process.env.JOB_DATABASE_URL)
    throw new AppError(
      503,
      "worker_unconfigured",
      "The durable job queue is not configured.",
    );
  return (globalBoss.axiomBoss ??= (async () => {
    const boss = new PgBoss({
      connectionString: process.env.JOB_DATABASE_URL!,
      schema: "pgboss",
      application_name: "axiom-jobs",
    });
    boss.on("error", (error) =>
      console.error(
        "Background queue error:",
        error instanceof Error ? error.name : "unknown",
      ),
    );
    await boss.start();
    await boss.createQueue(queueName);
    return boss;
  })().catch((error) => {
    globalBoss.axiomBoss = undefined;
    throw error;
  }));
}
function publicJob(job: StoredJob): JobRecord {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    progress: job.progress,
    result: job.result,
    error: job.error || undefined,
    createdAt: job.createdAt,
  };
}
export async function enqueueJob(
  ctx: WorkspaceContext,
  kind: string,
  payload: Record<string, unknown> = {},
): Promise<JobRecord> {
  if (!/^[a-z][a-z0-9._-]{1,63}$/.test(kind))
    throw new AppError(422, "invalid_job", "Invalid background operation.");
  if (Buffer.byteLength(JSON.stringify(payload)) > 1_048_576)
    throw new AppError(413, "job_too_large", "Job payload exceeds 1 MiB.");
  const boss = await getBoss();
  const id = randomUUID();
  const rows = await workspaceQuery<StoredJob>(
    ctx,
    `INSERT INTO jobs(id,workspace_id,user_id,kind,payload) VALUES($1,$2,$3,$4,$5) RETURNING ${columns}`,
    [id, ctx.workspaceId, ctx.userId, kind, JSON.stringify(payload)],
    false,
  );
  try {
    const bossId = await boss.send(
      queueName,
      { id, workspaceId: ctx.workspaceId, userId: ctx.userId },
      { retryLimit: 2, retryDelay: 5, expireInSeconds: 1800 },
    );
    if (!bossId) throw new Error("Queue did not accept job");
    await workspaceQuery(
      ctx,
      "UPDATE jobs SET boss_id=$1 WHERE id=$2 AND workspace_id=$3",
      [bossId, id, ctx.workspaceId],
      false,
    );
  } catch (error) {
    await workspaceQuery(
      ctx,
      "UPDATE jobs SET status='failed',error='Queue submission failed; retry the operation.',updated_at=now() WHERE id=$1",
      [id],
      false,
    );
    throw error;
  }
  await audit(ctx, "job.queued", id, { kind });
  return publicJob(rows[0]);
}
export async function listJobs(ctx: WorkspaceContext): Promise<JobRecord[]> {
  const rows = await workspaceQuery<StoredJob>(
    ctx,
    `SELECT ${columns} FROM jobs WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [ctx.workspaceId],
  );
  return rows.map(publicJob);
}
export async function getJob(
  ctx: WorkspaceContext,
  id: string,
): Promise<JobRecord> {
  const rows = await workspaceQuery<StoredJob>(
    ctx,
    `SELECT ${columns} FROM jobs WHERE workspace_id=$1 AND id=$2`,
    [ctx.workspaceId, id],
  );
  if (!rows.length)
    throw new AppError(
      404,
      "job_not_found",
      "The job does not exist in this workspace.",
    );
  return publicJob(rows[0]);
}
export async function cancelJob(
  ctx: WorkspaceContext,
  id: string,
): Promise<JobRecord> {
  const rows = await workspaceQuery<StoredJob>(
    ctx,
    `SELECT ${columns} FROM jobs WHERE workspace_id=$1 AND id=$2`,
    [ctx.workspaceId, id],
  );
  const job = rows[0];
  if (!job)
    throw new AppError(
      404,
      "job_not_found",
      "The job does not exist in this workspace.",
    );
  if (
    job.userId !== ctx.userId &&
    !["administrator", "owner"].includes(ctx.role)
  )
    throw new AppError(
      403,
      "job_denied",
      "Only the submitting analyst or an administrator can cancel this job.",
    );
  await workspaceQuery(
    ctx,
    "UPDATE jobs SET status='cancelled',updated_at=now() WHERE workspace_id=$1 AND id=$2 AND status IN ('queued','running')",
    [ctx.workspaceId, id],
    false,
  );
  if (job.bossId) await (await getBoss()).cancel(queueName, job.bossId);
  await audit(ctx, "job.cancelled", id);
  return getJob(ctx, id);
}
export async function startWorkers(
  handlers: Record<string, JobHandler>,
): Promise<PgBoss> {
  const boss = await getBoss();
  await boss.work<{ id: string; workspaceId: string; userId: string }>(
    queueName,
    { batchSize: 1, pollingIntervalSeconds: 1 },
    async (batch) => {
      for (const delivery of batch) {
        const { id, workspaceId, userId } = delivery.data;
        const ctx: WorkspaceContext = { userId, workspaceId, role: "analyst" };
        const controller = new AbortController();
        let poll: ReturnType<typeof setInterval> | undefined;
        let deadline: ReturnType<typeof setTimeout> | undefined;
        try {
          const stored = await withWorkspace(ctx, async (client) => {
            const membership = await client.query<{
              role: WorkspaceContext["role"];
            }>(
              "SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2",
              [workspaceId, userId],
            );
            ctx.role = membership.rows[0].role;
            const jobs = await client.query<StoredJob>(
              `SELECT ${columns} FROM jobs WHERE workspace_id=$1 AND id=$2 AND user_id=$3 FOR UPDATE`,
              [workspaceId, id, userId],
            );
            const job = jobs.rows[0];
            if (!job || ["completed", "cancelled"].includes(job.status))
              return null;
            await client.query(
              "UPDATE jobs SET status='running',progress=1,error=null,updated_at=now() WHERE id=$1",
              [id],
            );
            return job;
          });
          if (!stored) continue;
          const handler = handlers[stored.kind];
          if (!handler)
            throw new AppError(
              422,
              "unknown_job",
              "No worker is registered for this operation.",
            );
          deadline = setTimeout(
            () =>
              controller.abort(
                new Error("Background operation exceeded its deadline."),
              ),
            stored.kind === "evaluation.run" ? 900_000 : 90_000,
          );
          poll = setInterval(() => {
            void getJob(ctx, id)
              .then((job) => {
                if (job.status === "cancelled")
                  controller.abort(new Error("Job cancelled."));
              })
              .catch(() =>
                controller.abort(new Error("Workspace access changed.")),
              );
          }, 1000);
          const result = await handler(ctx, stored.payload, {
            signal: controller.signal,
            jobId: id,
            progress: async (value) => {
              controller.signal.throwIfAborted();
              const job = await getJob(ctx, id);
              if (job.status === "cancelled") {
                controller.abort();
                controller.signal.throwIfAborted();
              }
              await workspaceQuery(
                ctx,
                "UPDATE jobs SET progress=$1,updated_at=now() WHERE id=$2 AND status='running'",
                [Math.max(1, Math.min(99, Math.round(value))), id],
                false,
              );
            },
          });
          controller.signal.throwIfAborted();
          const body = JSON.stringify(result ?? null);
          if (Buffer.byteLength(body) > 8_388_608)
            throw new AppError(
              413,
              "job_result_too_large",
              "Store large results as an artifact instead of a job response.",
            );
          await workspaceQuery(
            ctx,
            "UPDATE jobs SET status='completed',progress=100,result=$1,updated_at=now() WHERE id=$2 AND status='running'",
            [body, id],
            false,
          );
          await audit(ctx, "job.completed", id, { kind: stored.kind });
        } catch (error) {
          const message =
            error instanceof AppError
              ? error.message
              : controller.signal.aborted
                ? "Operation cancelled, access changed, or deadline exceeded."
                : "Background operation failed. Inspect the worker logs for its request ID.";
          await workspaceQuery(
            ctx,
            "UPDATE jobs SET status='failed',error=$1,updated_at=now() WHERE id=$2 AND status NOT IN ('completed','cancelled')",
            [message.slice(0, 500), id],
            false,
          ).catch(() => {});
          console.error(
            `Job ${id} failed:`,
            error instanceof Error ? error.message : "Unknown error",
          );
          throw error;
        } finally {
          if (poll) clearInterval(poll);
          if (deadline) clearTimeout(deadline);
        }
      }
    },
  );
  return boss;
}
