# Multer advisory remediation

Date: 24 October 2026

The installed Multer 2.4.0 matched the high-severity advisory [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m). The patched 2.5.0 release and its package integrity were verified directly with the official npm registry.

The dependency-only change updates `apps/api/package.json` from `^2.4.0` to `^2.5.0` and the generated `pnpm-lock.yaml` resolution from 2.4.0 to 2.5.0. The scoped pnpm update changed no unrelated dependency resolution. Installed runtime resolution is now 2.5.0. No application source, test, or CI file was changed in this increment.

Verification:

- Upload compatibility integration suite: **12 passed**, zero failed or skipped, using the explicit isolated localhost PostgreSQL fixture. This includes oversized, malformed, unsupported, and valid multipart requests.
- Fresh `pnpm audit --prod --json --registry=https://registry.npmjs.org`: exit code 0, **zero advisories** at every severity. The response reports 305 total production and optional dependency entries.
- Package and lockfile whitespace checks passed.

Evidence:

- `evidence/multer-remediation-receipt.json`: registry metadata, exact versions, commands, verification counts, and final package/lockfile hashes.
- `evidence/multer-audit-after.json`: unchanged raw audit response.
- `evidence/multer-upload-tests.tap`: complete focused test output.

The audit excludes development dependencies. This focused verification does not establish overall application security or exercise production uploads. No live environment, production database, provider payment, commit, push, or deployment was changed. The parent release task will rerun its full API suite and regenerate the complete review patch.
