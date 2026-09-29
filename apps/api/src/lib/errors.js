export class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = "Authentication required") => new HttpError(401, msg);
export const forbidden = (msg = "You do not have permission to perform this action") => new HttpError(403, msg);
export const notFound = (msg = "Resource not found") => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);
export const tooMany = (msg = "Too many requests, please slow down") => new HttpError(429, msg);
export const serviceUnavailable = (msg) => new HttpError(503, msg);

/**
 * The service is not configured for a capability it is being asked to perform,
 * and the message is written to be safe to show a customer.
 *
 * The production error handler replaces the message of any 5xx with a generic
 * apology, which is right for an unexpected crash but wrong here: it meant a
 * missing payment key produced the same opaque "Something went wrong on our
 * side" as a database fault, and the actual reason was only ever in the server
 * log. This flag lets the specific, actionable reason through while genuine
 * internal failures stay masked.
 */
export const misconfigured = (msg) => {
  const err = new HttpError(503, msg);
  err.expose = true;
  return err;
};

/** Wrap async route handlers so rejections reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
