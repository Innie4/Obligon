import express from "express";
import helmet from "helmet";
import cors from "cors";
import multer from "multer";
import { env } from "./config/env.js";
import { providerStatus } from "./config/env.js";
import { attachUser } from "./middleware/auth.js";
import { generalLimiter } from "./middleware/security.js";
import { HttpError } from "./lib/errors.js";
import { schedulerState } from "./lib/scheduler.js";
import { businessTimeZone } from "./lib/time.js";
import authRoutes from "./routes/auth.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import companyRoutes from "./routes/company.routes.js";
import partnerRoutes from "./routes/partner.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import publicRoutes from "./routes/public.routes.js";
import webhookRoutes from "./routes/webhooks.routes.js";
import pushRoutes from "./routes/push.routes.js";
import { sseHandler } from "./lib/sse.js";

const uploadErrors = {
  LIMIT_FILE_SIZE: [413, "Each file must be 10 MB or smaller."],
  LIMIT_UNEXPECTED_FILE: [400, "Choose the supported file field and number of attachments."],
  LIMIT_FILE_COUNT: [400, "Too many files were selected."],
  LIMIT_PART_COUNT: [400, "The upload contains too many fields or files."],
  LIMIT_FIELD_COUNT: [400, "The upload contains too many fields."],
  LIMIT_FIELD_KEY: [400, "An upload field name is too long."],
  LIMIT_FIELD_VALUE: [400, "An upload field value is too long."],
  MISSING_FIELD_NAME: [400, "An upload field name is missing."],
  LIMIT_FIELD_NESTING: [400, "An upload field name is too deeply nested."],
  LIMIT_FIELD_ARRAY_INDEX: [400, "An upload field index is too large."],
  INVALID_FIELD_NAME: [400, "An upload field name is invalid."],
  STREAM_DESTROYED: [400, "The upload was interrupted. Select your files and try again."],
};
const malformedMultipartErrors = new Set([
  "Multipart: Boundary not found", "Malformed part header", "Unexpected end of form", "Unexpected end of file", "Malformed content type",
]);

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  const origins = [...new Set([
    ...env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    env.APP_URL.replace(/\/$/, ""),
    "https://obligon.vercel.app"
  ])];
  app.use(cors({ origin: origins.length ? origins : true, credentials: true }));

  // Raw body capture for webhook signature verification (mounted before json parser)
  app.use(express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(attachUser);
  app.use(generalLimiter);

  app.get("/health", (_req, res) => {
    // Scheduler *state*, not just whether it is configured to exist. A suspended
    // or restarted process drops its intervals while `ENABLE_SCHEDULER` stays
    // true, so a health check that only echoed configuration would have reported
    // a healthy service whose payment sweep had never run.
    res.json({
      ok: true,
      service: "obligon-api",
      time: new Date().toISOString(),
      // The timezone day boundaries are computed in. Worth surfacing: a figure that
      // disagreed with a partner's own reading of "today" is otherwise impossible
      // to diagnose from the outside.
      businessTimeZone: businessTimeZone(),
      providers: providerStatus(),
      scheduler: schedulerState()
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/customer", customerRoutes);
  app.use("/api/company", companyRoutes);
  app.use("/api/partner", partnerRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/push", pushRoutes);

  // Real-time stream (SSE) — token passed as query param because EventSource can't set headers
  app.get("/api/realtime/stream", (req, res, next) => {
    if (!req.user) return next(new HttpError(401, "Authentication required"));
    sseHandler(req, res);
  });

  // 404
  app.use((_req, _res, next) => next(new HttpError(404, "Endpoint not found")));

  // Central error handler — consistent envelope: { error: { message, details? } }
  app.use((err, _req, res, _next) => {
    // Multer delegates upload failures to Express. Its typed input errors have
    // no HTTP status; treating them as internal failures turned an oversized or
    // unexpected attachment into a 500. Do not echo client filenames or fields.
    const uploadError = err instanceof multer.MulterError && Object.hasOwn(uploadErrors, err.code) && uploadErrors[err.code];
    if (uploadError) err = new HttpError(...uploadError);
    // Busboy emits plain Errors for broken multipart framing. Limit this mapping
    // to errors originating in that parser, so an application/storage failure on
    // a multipart request still follows the ordinary 5xx handling below.
    else if (_req.is("multipart/form-data") && err.status == null &&
      malformedMultipartErrors.has(err.message) && /[/\\]busboy[/\\]lib[/\\]/.test(err.stack ?? "")) {
      err = new HttpError(400, "The upload could not be read. Select your files and try again.");
    }
    const status = err.status ?? 500;
    if (status >= 500) console.error("[api:error]", err);
    // An unexpected 5xx must not describe itself to a customer. A deliberate
    // "not configured" 503 is flagged `expose` and its message is written to be
    // safe, so the real reason reaches the caller instead of being masked into
    // the same generic apology a database fault produces.
    const safeToShow = status < 500 || err.expose === true;
    res.status(status).json({
      error: {
        message: safeToShow ? err.message : "Something went wrong on our side. Please try again.",
        // Tells the client the message is the real, deliberate one rather than a
        // generic apology, so it does not overwrite it with friendly wording and
        // hide the reason a payment could not be started.
        ...(err.expose === true ? { exposable: true } : {}),
        ...(err.details ? { details: err.details } : {})
      }
    });
  });

  return app;
}
