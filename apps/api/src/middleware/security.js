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

/**
 * For endpoints that authorise a code, a PIN, or a transfer.
 *
 * `/api/partner/pos/authorize` accepted a 6-digit code with no limiter at all, so
 * the credential space was fully brute-forceable by any authenticated station
 * account. Measured at ~660ms per attempt against an empty driver table, and each
 * attempt cost a bcrypt comparison per enrolled driver PIN. This makes a sustained
 * attempt visibly expensive and obvious in the logs.
 */
export const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(tooMany("Too many attempts on this code. Wait a minute before trying again."))
});

/**
 * For endpoints that move money or change who can move it.
 *
 * Distinct from `sensitiveLimiter` because the two have different blast radii: a
 * brute-force attempt wastes the attacker's own time, while a burst of payout
 * requests is a signal something is wrong with an account rather than with a
 * guesser.
 */
export const payoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next) => next(tooMany("Too many payout requests. Try again in a minute."))
});

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
