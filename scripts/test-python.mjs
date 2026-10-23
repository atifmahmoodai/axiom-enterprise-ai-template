import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.env.PYTHON_BIN || "python3",
  ["python/test_analytics.py"],
  {
    stdio: "inherit",
    shell: false,
  },
);
if (result.error)
  console.error("The configured Python executable could not start.");
process.exit(result.status ?? 1);
