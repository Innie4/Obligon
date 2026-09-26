import { env, configurationIssues, configurationWarnings, providerStatus } from "../config/env.js";

const issues = configurationIssues();
const warnings = configurationWarnings();

console.log("Obligon configuration check");
console.log(`Environment: ${env.NODE_ENV}`);
console.log(`Providers: ${Object.entries(providerStatus()).map(([name, configured]) => `${name}=${configured ? "configured" : "missing"}`).join(", ")}`);

if (warnings.length) {
  console.warn(`\nWarnings (${warnings.length}) — these degrade one feature but the API starts:`);
  for (const w of warnings) console.warn(`- ${w}`);
}

if (issues.length) {
  console.error(`\nFatal issues (${issues.length}) — the API will refuse to start:`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("\nNo fatal configuration issues. The API is safe to start.");
if (warnings.length) process.exitCode = 0;
