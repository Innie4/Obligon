# Release scan evidence

The selected nine approved source/test files and their complete staged-inclusive diff were scanned with the installed Trivy 0.71.2 secret scanner. The scanner returned exit code 0 and found no secrets. No project environment files or npm configuration were copied. This scan does not cover repository history or hosting configuration.

A fresh, read-only `pnpm audit --prod --json --registry=https://registry.npmjs.org/` using pnpm 11.25.0 checked 305 dependencies: 262 production and 43 optional, with no development dependencies. It returned exit code 1 because it found **one Moderate advisory, zero High and zero Critical**. The lockfile is unchanged from the release base. No remediation was performed.

The finding is `qs` 6.16.0, GHSA-6pq8-jhm2-2vcw. Affected versions are >=6.7.0 through 6.16.0; the advisory lists >=6.16.1 as patched. The reported issue is an uncaught TypeError in `qs.stringify` with `arrayFormat: 'comma'` when an array element has a non-callable own `toString`. The dependency reaches the API through Express and body-parser, including Express used by express-rate-limit.

A bounded `rg` check found no direct `qs` imports or comma-array-format call sites in `apps/api/src`, `apps/web/lib`, `apps/web/components` or `packages/shared`. This informs exposure review but does not prove that the transitive dependency is safe or unreachable.

Both tools had a 120-second timeout. Trivy completed in less than one second; the registry audit completed in 1.92 seconds. The installed Trivy vulnerability database was not used because the selected scanner was secrets only; current dependency advisory evidence comes from the npm registry response. No source, dependencies, CI or production state were changed.

Full redacted counts, advisory details, source/lock/diff hashes and temporary raw-evidence location are in `release-scans-2026-10-31.json`. These checks do not establish overall launch readiness.
