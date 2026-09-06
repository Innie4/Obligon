import rateLimit from "express-rate-limit";
import { tooMany, HttpError } from "../lib/errors.js";
import { z } from "zod";

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next) => next(tooMany("Too many authentication attempts. Try again in 15 minutes."))
});

export const webhookLimiter = rateLimit({ windowMs: 60 * 1000, limit: 600 });

/** zod body/query validation middleware. Returns 400 with field details. */
export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({ ...req.body, ...req.query, ...req.params });
    if (!result.success) {
      const details = result.error.flatten().fieldErrors;
      const first = Object.values(details)[0]?.[0];
      return next(new HttpError(400, first || "Invalid request", details));
    }
    req.valid = result.data;
    next();
  };
}

export { z };
