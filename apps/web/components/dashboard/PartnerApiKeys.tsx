"use client";
import * as React from "react";
import { authenticatedRequest } from "@/lib/services";
type Key = {
  id: string;
  label: string;
  token_hint: string;
  expires_at: string;
  revoked_at: string | null;
};
export function PartnerApiKeys() {
  const [keys, setKeys] = React.useState<Key[]>([]),
    [available, setAvailable] = React.useState(false),
    [token, setToken] = React.useState(""),
    [error, setError] = React.useState(""),
    [loadError, setLoadError] = React.useState(""),
    [loading, setLoading] = React.useState(true),
    [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await authenticatedRequest<{
        available: boolean;
        keys: Key[];
      }>("/api/partner/settings/api-keys");
      setKeys(result.keys);
      setAvailable(result.available);
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="mt-6 min-w-0 rounded-2xl border border-obligon-border bg-white p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold tracking-tight text-obligon-navy">Read-only API access</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-obligon-text">
        Owners and admins on a plan with API access can create up to five keys.
        Keys expire after 90 days and stop working when the plan expires or the
        creator loses access.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      {loading ? <p role="status" className="mt-4 rounded-xl bg-obligon-mist/60 p-4 text-sm text-obligon-text">Loading API access…</p> : null}
      {loadError ? <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p>{loadError}</p><button type="button" disabled={loading} onClick={() => void load()} className="mt-2 min-h-11 rounded-lg px-2 font-semibold underline disabled:opacity-60">Retry loading API access</button></div> : null}
      {available && !loadError ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const result = await authenticatedRequest<{ token: string }>(
                "/api/partner/settings/api-keys",
                {
                  method: "POST",
                  body: JSON.stringify(
                    Object.fromEntries(new FormData(e.currentTarget)),
                  ),
                },
              );
              setToken(result.token);
              await load();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block text-sm font-semibold text-obligon-navy">
            Integration name
            <input
              required
              maxLength={100}
              name="label"
              disabled={busy}
              className="mt-2 block min-h-12 w-full rounded-xl border border-obligon-border bg-white p-3 text-sm font-normal disabled:opacity-60"
            />
          </label>
          <button
            disabled={busy || loading}
            className="min-h-12 rounded-xl bg-obligon-green px-5 text-sm font-semibold text-white transition-colors hover:bg-obligon-green/90 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create key"}
          </button>
        </form>
      ) : !loading && !loadError ? (
        <p className="mt-4 rounded-xl bg-obligon-mist/60 p-4 text-sm leading-6 text-obligon-text">
          An active plan with API access is required to create and use keys.
        </p>
      ) : null}
      {token && (
        <div className="mt-5 rounded-xl border border-obligon-green/30 bg-obligon-mist/60 p-4">
          <p role="status" className="text-sm font-semibold text-obligon-green">Copy this key now. It is shown only once.</p>
          <code className="block break-all py-3 text-sm text-obligon-navy">{token}</code>
          <button
            type="button"
            className="min-h-12 underline"
            onClick={() => setToken("")}
          >
            Hide key
          </button>
        </div>
      )}
      {!loading && !loadError && available && keys.length === 0 ? <p className="mt-5 text-sm text-obligon-text">No API keys yet. Create a key for your integration above.</p> : null}
      <ul className="mt-5 divide-y divide-obligon-border">
        {keys.map((key) => (
          <li key={key.id} className="break-words py-4 text-sm leading-6 text-obligon-text">
            <strong>{key.label}</strong> · ending {key.token_hint} ·{" "}
            {key.revoked_at
              ? "Revoked"
              : new Date(key.expires_at) <= new Date()
                ? "Expired"
                : `Expires ${new Date(key.expires_at).toLocaleDateString()}`}
            {!key.revoked_at && (
              <button
                type="button"
                disabled={busy}
                className="ml-2 min-h-12 rounded-lg px-2 font-semibold text-red-800 underline disabled:opacity-60"
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await authenticatedRequest(
                      `/api/partner/settings/api-keys/${key.id}`,
                      { method: "DELETE" },
                    );
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
      <details className="mt-5 rounded-xl border border-obligon-border px-4 pb-3">
        <summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold text-obligon-navy">
          Integration endpoints
        </summary>
        <p className="py-2 text-sm">
          Send an Authorization: Bearer header with your key. GET requests are
          supported for these organization-scoped endpoints:
        </p>
        <ul className="space-y-2 break-all font-mono text-sm">
          {[
            "transactions",
            "transactions/export",
            "pricing",
            "stations",
            "reports",
            "reports/export",
          ].map((path) => (
            <li key={path}>/api/partner/{path}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
