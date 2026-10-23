# body-parser request-parser patch

GitHub advisory GHSA-27r3-jxmh-p828 reports a high-severity denial of service in body-parser versions >=2.0.0 and <2.4.0. Official npm metadata confirms the patched version 2.4.0 and Node >=18 compatibility.

Only `apps/api/package.json` and the generated `pnpm-lock.yaml` changed. Express is pinned to the existing runtime 5.2.1, and its compatible body-parser dependency now resolves to 2.4.0. No application logic, tests, workspace configuration or unrelated dependency resolutions changed. A package.json pnpm override was considered but pnpm11 ignores it; the ineffective field was removed, leaving root package.json identical to HEAD.

Verification: existing full API suite passed 1,251 tests with zero failures, 13 opt-in external checks skipped, in 75.46 seconds. Both DATABASE_URL variables pointed only to task-owned PostgreSQL port55423, with no real environment file or live provider opt-ins. Full and production dependency audits both returned zero advisories and zero vulnerabilities. Diff check passed. Runtime resolution confirms Express5.2.1 loads body-parser2.4.0.

Hash-bound commands, metadata and evidence are in [body-parser-receipt.json](evidence/body-parser-receipt.json). No commit, push, browser action or deployment was performed by this subagent. Skipped external checks and broader launch requirements remain unverified.

The unchanged web source retains the verified production build and **646 passing web tests** from `13fc4f0`. The earlier Zod update remains installed at 4.6.6. These are bounded dependency/compatibility checks; real provider, device and operational launch requirements remain in the combined report. A version-only dependency update is an Edirae Learn skip.
