import { serviceUnavailable } from "./errors.js";
import { env } from "../config/env.js";

// All current callers consume small JSON/text provider envelopes, never file downloads.
export const MAX_PROVIDER_RESPONSE_BYTES = 1_048_576;

export async function providerFetch(url, { method = "GET", headers, body, safeToRetry = method === "GET", timeoutMs = env.PROVIDER_HTTP_TIMEOUT_MS } = {}) {
  const attempts = safeToRetry && ["GET", "HEAD"].includes(method.toUpperCase()) ? env.PROVIDER_RETRY_COUNT + 1 : 1;
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    let response, reader, timer, expired = false;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        controller.abort();
        if (reader) void reader.cancel().catch(() => {});
        reject(new DOMException("Provider response timed out", "AbortError"));
      }, timeoutMs);
    });
    try {
      response = await Promise.race([fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal
      }), deadline]);
      if (response.status >= 500 && attempt + 1 < attempts) {
        clearTimeout(timer);
        if (response.body) void response.body.cancel().catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
        continue;
      }
      const declared = response.headers.get("content-length");
      const tooLarge = () => {
        const error = serviceUnavailable("External provider response is too large. Please contact Support.");
        error.responseTooLarge = true;
        return error;
      };
      if (declared && /^\d+$/.test(declared) && BigInt(declared) > BigInt(MAX_PROVIDER_RESPONSE_BYTES)) throw tooLarge();
      const chunks = [];
      let bytes = 0;
      if (response.body) {
        reader = response.body.getReader();
        while (true) {
          const { done, value } = await Promise.race([reader.read(), deadline]);
          if (expired) throw new DOMException("Provider response timed out", "AbortError");
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_PROVIDER_RESPONSE_BYTES) throw tooLarge();
          chunks.push(value);
        }
      }
      // Reading is complete before the deadline is cleared. Callers can safely
      // parse the bounded in-memory response while retaining status and headers.
      const buffered = new Response([204,205,304].includes(response.status) || method.toUpperCase() === "HEAD" ? null : Buffer.concat(chunks, bytes), {
        status: response.status, statusText: response.statusText, headers: response.headers
      });
      Object.defineProperties(buffered, {
        url: { value: response.url }, redirected: { value: response.redirected }, type: { value: response.type }
      });
      return buffered;
    } catch (error) {
      lastError = error;
      if (error.responseTooLarge) throw error;
      if (attempt + 1 < attempts) {
        clearTimeout(timer);
        if (reader) void reader.cancel().catch(() => {});
        else if (response?.body) void response.body.cancel().catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
        continue;
      }
    } finally {
      clearTimeout(timer);
      if (reader) {
        void reader.cancel().catch(() => {});
        reader.releaseLock();
      } else if (response?.body && !response.bodyUsed) void response.body.cancel().catch(() => {});
    }
  }

  const reason = lastError?.name === "AbortError" ? "request timed out" : "provider is unreachable";
  throw serviceUnavailable(`External provider ${reason}. Please try again later.`);
}
