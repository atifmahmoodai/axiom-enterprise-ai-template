import { spawn } from "node:child_process";
import path from "node:path";
const python = process.env.PYTHON_BIN || "python3";
const child = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    HOSTNAME: process.env.AXIOM_BIND_HOST || "0.0.0.0",
    AXIOM_STORAGE_DIR: path.resolve(process.env.AXIOM_STORAGE_DIR || ".data"),
    PYTHON_BIN: python.includes("/") ? path.resolve(python) : python,
  },
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
