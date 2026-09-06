import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { providerStatus } from "./config/env.js";
import { attachUser } from "./middleware/auth.js";
import { generalLimiter } from "./middleware/security.js";
import { HttpError } from "./lib/errors.js";
import authRoutes from "./routes/auth.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import companyRoutes from "./routes/company.routes.js";
import partnerRoutes from "./routes/partner.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import publicRoutes from "./routes/public.routes.js";
import webhookRoutes from "./routes/webhooks.routes.js";
import { sseHandler } from "./lib/sse.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  const origins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
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
    res.json({ ok: true, service: "obligon-api", time: new Date().toISOString(), providers: providerStatus() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/customer", customerRoutes);
  app.use("/api/company", companyRoutes);
  app.use("/api/partner", partnerRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/webhooks", webhookRoutes);

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
    res.status(status).json({
      error: {
        message: status >= 500 && env.NODE_ENV === "production" ? "Something went wrong on our side. Please try again." : err.message,
        ...(err.details ? { details: err.details } : {})
      }
    });
  });

  return app;
}
