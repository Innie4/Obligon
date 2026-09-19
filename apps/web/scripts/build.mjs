#!/usr/bin/env node
// `next build` must run with NODE_ENV=production. The monorepo-root `.env`
// (loaded via --env-file-if-exists for NEXT_PUBLIC_* build-time values) may
// set NODE_ENV=development for local dev convenience, and Node's --env-file
// does not override a variable that is already set in the environment. This
// wrapper pins NODE_ENV=production before that file loads, avoiding a Next.js
// 15.5 bug where building with an inherited NODE_ENV=development breaks the
// static /404 and /500 error pages ("<Html> should not be imported outside of
// pages/_document").
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const nextBin = path.join(webRoot, "node_modules", "next", "dist", "bin", "next");

const result = spawnSync(
  process.execPath,
  ["--env-file-if-exists=../../.env", nextBin, "build"],
  {
    cwd: webRoot,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" }
  }
);

process.exit(result.status ?? 1);
