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
    [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => {
    try {
      const result = await authenticatedRequest<{
        available: boolean;
        keys: Key[];
      }>("/api/partner/settings/api-keys");
      setKeys(result.keys);
      setAvailable(result.available);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="mt-6 rounded-xl border bg-white p-6">
      <h2 className="text-2xl font-bold">Read-only API access</h2>
      <p className="mt-2 text-sm">
        Owners and admins on a plan with API access can create up to five keys.
        Keys expire after 90 days and stop working when the plan expires or the
        creator loses access.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-red-800">
          {error}
        </p>
      )}
      {available ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
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
          <label className="block">
            Integration name
            <input
              required
              maxLength={100}
              name="label"
              className="mt-2 block min-h-12 w-full rounded border p-3"
            />
          </label>
          <button
            disabled={busy}
            className="min-h-12 rounded bg-obligon-green px-5 font-bold text-white"
          >
            {busy ? "Creating…" : "Create key"}
          </button>
        </form>
      ) : (
        <p className="mt-4">
          An active plan with API access is required to create and use keys.
        </p>
      )}
      {token && (
        <div className="mt-4 border-l-4 border-obligon-green pl-4">
          <p role="status">Copy this key now. It is shown only once.</p>
          <code className="block break-all py-3">{token}</code>
          <button
            type="button"
            className="min-h-12 underline"
            onClick={() => setToken("")}
          >
            Hide key
          </button>
        </div>
      )}
      <ul className="mt-4">
        {keys.map((key) => (
          <li key={key.id} className="border-t py-3">
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
                className="ml-3 min-h-12 underline"
                onClick={async () => {
                  setBusy(true);
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
      <details className="mt-4">
        <summary className="min-h-12 cursor-pointer">
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
