/**
 * @file Shared HTTP helper used by all three provider adapters. Centralizes
 * timeout handling (AbortController) and the HTTP-failure -> AgentError
 * mapping so each provider file only deals with its own request/response
 * shape, not error plumbing.
 */

import { ProviderTimeoutError, ProviderUnavailableError } from '../core/AgentError';

export interface FetchJsonOptions {
  providerName: string;
  url: string;
  init: RequestInit;
  timeoutMs: number;
}

/**
 * Performs a fetch, enforcing timeoutMs via AbortController, and maps:
 *  - abort due to timeout -> ProviderTimeoutError
 *  - non-2xx response    -> ProviderUnavailableError (with response body as cause detail)
 *  - network/DNS/etc.    -> ProviderUnavailableError
 * On success, returns the parsed JSON body.
 */
export async function fetchJson<T = unknown>(opts: FetchJsonOptions): Promise<T> {
  const { providerName, url, init, timeoutMs } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '<unreadable body>');
      throw new ProviderUnavailableError(
        providerName,
        new Error(`HTTP ${res.status} ${res.statusText}: ${bodyText.slice(0, 500)}`),
      );
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ProviderUnavailableError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ProviderTimeoutError(providerName, timeoutMs);
    }
    throw new ProviderUnavailableError(providerName, err);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Issues a fetch expecting a streamable (SSE) response body, with the same
 * timeout-to-first-byte semantics. Returns the raw Response for the caller
 * to pipe through parseSSE() — timeout only guards connection setup, not
 * the full stream duration (a long legitimate stream shouldn't be killed
 * by a short request timeout).
 */
export async function fetchStream(opts: FetchJsonOptions): Promise<Response> {
  const { providerName, url, init, timeoutMs } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '<unreadable body>');
      throw new ProviderUnavailableError(
        providerName,
        new Error(`HTTP ${res.status} ${res.statusText}: ${bodyText.slice(0, 500)}`),
      );
    }
    if (!res.body) {
      throw new ProviderUnavailableError(providerName, new Error('Response had no readable body'));
    }
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof ProviderUnavailableError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ProviderTimeoutError(providerName, timeoutMs);
    }
    throw new ProviderUnavailableError(providerName, err);
  }
}
