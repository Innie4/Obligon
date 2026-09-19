import { env, configurationIssues, providerStatus } from "../config/env.js";

const issues = configurationIssues();
console.log("Obligon configuration check");
console.log(`Environment: ${env.NODE_ENV}`);
console.log("Providers:", Object.entries(providerStatus()).map(([name, configured]) => `${name}=${configured ? "configured" : "missing"}`).join(", "));

if (issues.length) {
  console.error("Configuration issues:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Configuration is valid for this environment.");
