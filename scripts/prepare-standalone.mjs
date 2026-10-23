import { cpSync, mkdirSync } from "node:fs";
mkdirSync(".next/standalone/.next", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
cpSync("public", ".next/standalone/public", { recursive: true });
// Fixed analytics programs are runtime assets, not executable customer content.
cpSync("python", ".next/standalone/python", { recursive: true });
console.log("Standalone static, font and analytics assets prepared.");
