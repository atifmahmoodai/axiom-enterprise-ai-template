import { startWorkers } from "../lib/server/jobs";
import { datasetJobHandlers } from "../lib/server/datasets";
import { evaluationHandler } from "../lib/server/evaluations";
import { powerBIJobHandlers } from "../lib/server/powerbi";
const boss = await startWorkers({
  ...datasetJobHandlers,
  ...powerBIJobHandlers,
  "evaluation.run": evaluationHandler,
});
console.log(
  "Axiom worker ready: ingestion, transformations, evaluations, Power BI export and refresh.",
);
const stop = async () => {
  await boss.stop({ graceful: true, timeout: 30000 });
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
