import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { providerStatus } from "./config/env.js";
import { attachUser } from "./middleware/auth.js";
import { generalLimiter } from "./middleware/security.js";
import { HttpError } from "./lib/errors.js";
import { schedulerState } from "./lib/scheduler.js";
import authRoutes from "./routes/auth.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import companyRoutes from "./routes/company.routes.js";
import partnerRoutes from "./routes/partner.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import publicRoutes from "./routes/public.routes.js";
import webhookRoutes from "./routes/webhooks.routes.js";
import pushRoutes from "./routes/push.routes.js";
import { sseHandler } from "./lib/sse.js";

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
