import { serviceUnavailable } from "./errors.js";
import { env } from "../config/env.js";

export async function providerFetch(url, { method = "GET", headers, body, safeToRetry = method === "GET", timeoutMs = env.PROVIDER_HTTP_TIMEOUT_MS } = {}) {
  const attempts = safeToRetry ? env.PROVIDER_RETRY_COUNT + 1 : 1;
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal
      });
      if (response.status >= 500 && attempt + 1 < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  const reason = lastError?.name === "AbortError" ? "request timed out" : "provider is unreachable";
  throw serviceUnavailable(`External provider ${reason}. Please try again later.`);
}
