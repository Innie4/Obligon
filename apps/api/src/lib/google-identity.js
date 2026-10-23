import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { z } from "zod";
import { env } from "../config/env.js";
import { providerFetch } from "./http.js";

const issuer = "https://accounts.google.com";
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), {
  timeoutDuration: env.PROVIDER_HTTP_TIMEOUT_MS,
  cacheMaxAge: 600_000,
  cooldownDuration: 30_000,
  [customFetch]: (url, { headers }) => providerFetch(url, { headers, safeToRetry: false })
});
const emailSchema = z.string().email().max(254);
const identifier = (value, max) => typeof value === "string" && value.length <= max && /^[\x21-\x7e]+$/.test(value);
const invalidIdentity = () => new Error("Google identity could not be verified.");

// The optional resolver is supplied only by trusted callers for isolated signature tests.
export async function verifyGoogleIdentityToken(credential, { clientId, nonce, keyResolver } = {}) {
  if (typeof credential !== "string" || !credential.length || credential.length > 16_384 ||
      !identifier(clientId, 512) || !identifier(nonce, 256) ||
      (keyResolver !== undefined && typeof keyResolver !== "function")) throw invalidIdentity();

  try {
    const { payload } = await jwtVerify(credential, keyResolver ?? googleKeys, {
      algorithms: ["RS256"],
      issuer: [issuer, "accounts.google.com"],
      audience: clientId,
      requiredClaims: ["iss", "sub", "aud", "exp", "nonce"]
    });
    if (!identifier(payload.sub, 255) || payload.nonce !== nonce ||
        (payload.azp !== undefined && payload.azp !== clientId) ||
        (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId)) throw invalidIdentity();

    if (payload.email !== undefined && (payload.email_verified !== true || !emailSchema.safeParse(payload.email).success)) {
      throw invalidIdentity();
    }
    return {
      issuer,
      subject: payload.sub,
      ...(payload.email !== undefined ? { email: payload.email, emailVerified: true } : {})
    };
  } catch {
    throw invalidIdentity();
  }
}
