"use client";
import * as React from "react";
import { authenticatedRequest } from "@/lib/services";
interface Ticket {
  id: string;
  reference: string;
  full_name: string;
  subject: string;
  message: string;
  status: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  category?: string;
  priority?: string;
  attachments?: string[];
}
interface Message {
  id: string;
  body: string;
  sender_role: string;
}
interface Order {
  id: string;
  reference: string;
  station_name: string;
  full_name: string;
  amount_kobo: number;
  review_reason: string;
  status: string;
}
interface Bank {
  id: string;
  organization: string;
  bankName: string;
  accountName: string;
  accountMask: string;
  verified: boolean;
  isDefault: boolean;
  needsRenomination: boolean;
}
interface Review {
  id: string;
  reference: string;
  organization: string;
  amount_kobo?: number;
  net_kobo?: number;
  failure_reason?: string;
}
function BankVerificationStatus({ loading, failed, empty }: { loading: boolean; failed: boolean; empty: boolean }) {
  if (loading) return <p role="status" className="mt-3 text-obligon-text">Loading partner bank accounts…</p>;
  if (failed) return <p role="status" className="mt-3 text-obligon-text">Bank accounts could not be loaded. Refresh operational records to try again.</p>;
  if (empty) return <p role="status" className="mt-3 text-obligon-text">No partner bank accounts are available for verification.</p>;
  return null;
}
export function OperationsInbox() {
  const [review, setReview] = React.useState<{
    payouts: Review[];
    settlements: Review[];
  }>({ payouts: [], settlements: [] });
  const [tickets, setTickets] = React.useState<Ticket[]>([]),
    [orders, setOrders] = React.useState<Order[]>([]),
    [banks, setBanks] = React.useState<Bank[]>([]),
    [selected, setSelected] = React.useState<Ticket | null>(null),
    [messages, setMessages] = React.useState<Message[]>([]),
    [text, setText] = React.useState(""),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const selectSequence = React.useRef(0);
  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setError("");
    try {
      const [t, o, b, r] = await Promise.all([
        authenticatedRequest<{ tickets: Ticket[] }>("/api/admin/support"),
        authenticatedRequest<{ orders: Order[] }>("/api/admin/fuel-review"),
        authenticatedRequest<{ accounts: Bank[] }>(
          "/api/admin/payout-accounts",
        ),
        authenticatedRequest<{ payouts: Review[]; settlements: Review[] }>(
          "/api/admin/settlement-review",
        ),
      ]);
      setReview(r);
      setTickets(t.tickets);
      setOrders(o.orders);
      setBanks(b.accounts);
    } catch (e) {
      setError((e as Error).message);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  async function select(t: Ticket) {
    const sequence = ++selectSequence.current;
    setError("");
    setText("");
    setSelected(t);
    setMessages([]);
    try {
      const result = await authenticatedRequest<{
        messages: Message[];
        ticket: Ticket;
      }>(`/api/admin/support/${t.id}/messages`);
      if (sequence === selectSequence.current) {
        setMessages(result.messages);
        setSelected({ ...t, ...result.ticket });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function action(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await authenticatedRequest(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (loading || loadFailed)
    return (
      <section className="mx-auto w-full min-w-0 max-w-[1600px] px-4 py-6 text-sm sm:px-6 sm:py-8 lg:px-8 [&_button]:min-h-11 [&_button]:rounded-lg [&_button]:px-4 [&_button]:font-semibold [&_textarea]:min-h-28 [&_textarea]:rounded-xl [&_p]:break-words">
        <h1 className="border-b border-obligon-border pb-6 text-2xl font-bold tracking-tight sm:text-3xl">Support and Settlement Review</h1>
        <button type="button" disabled={loading || busy} onClick={() => void load()} className="mt-4 min-h-12 rounded border px-4">Refresh</button>
        {loading ? <p role="status" className="mt-4">
          Loading operational records…
        </p> : <p role="alert" className="mt-4 text-red-700">{error}</p>}
        <h2 className="mt-8 text-xl font-bold">Partner bank verification</h2>
        <BankVerificationStatus loading={loading} failed={loadFailed} empty={banks.length === 0} />
      </section>
    );
  return (
    <section className="mx-auto w-full min-w-0 max-w-[1600px] px-4 py-6 text-sm sm:px-6 sm:py-8 lg:px-8 [&_button]:min-h-11 [&_button]:rounded-lg [&_button]:px-4 [&_button]:font-semibold [&_textarea]:min-h-28 [&_textarea]:rounded-xl [&_p]:break-words">
      <h1 className="border-b border-obligon-border pb-6 text-2xl font-bold tracking-tight sm:text-3xl">Support and Settlement Review</h1>
      <button type="button" disabled={loading || busy} onClick={() => void load()} className="mt-4 min-h-12 rounded border px-4">Refresh</button>
      {error && (
        <p role="alert" className="my-4 text-red-700">
          {error}
        </p>
      )}
      <h2 className="mt-6 text-xl font-bold">Customer support</h2>
      <div className="my-5 grid min-w-0 items-start gap-5 xl:grid-cols-2">
        <div>
          {tickets.map((t) => (
            <button
              key={t.id}
              className="mb-3 block w-full break-words rounded-xl border border-obligon-border bg-white p-4 text-left leading-6 hover:bg-obligon-mist"
              onClick={() => void select(t)}
            >
              {t.reference} ·{" "}
              {t.full_name ??
                t.contact_name ??
                t.contact_email ??
                "Public contact"}{" "}
              · {t.subject} · {t.status}
            </button>
          ))}
          {!tickets.length && <p>No support requests.</p>}
        </div>
        {selected && (
          <div className="min-w-0 rounded-xl border border-obligon-border bg-white p-5">
            <h3 className="font-bold">{selected.subject}</h3>
            <p className="mt-2 text-sm">
              {selected.category} · {selected.priority} priority ·{" "}
              {selected.status}
            </p>
            <p className="mt-3 text-sm">
              {selected.contact_name} {selected.contact_email}{" "}
              {selected.contact_phone}
            </p>
            <p className="my-3">{selected.message}</p>
            {selected.attachments?.map((_, index) => (
              <button
                type="button"
                key={index}
                className="mb-3 min-h-12 rounded border px-4"
                onClick={async () => {
                  try {
                    const result = await authenticatedRequest<{ url: string }>(
                      `/api/admin/support/${selected.id}/attachments/${index}`,
                    );
                    window.location.assign(result.url);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Open attachment {index + 1}
              </button>
            ))}
            <button
              disabled={busy}
              type="button"
              className="mb-3 ml-2 min-h-12 rounded border px-4"
              onClick={async () => {
                setBusy(true);
                try {
                  await authenticatedRequest(
                    `/api/admin/support/${selected.id}`,
                    {
                      method: "PATCH",
                      body: JSON.stringify({
                        status:
                          selected.status === "closed" ? "active" : "closed",
                      }),
                    },
                  );
                  await load();
                  setSelected(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {selected.status === "closed" ? "Reopen ticket" : "Close ticket"}
            </button>
            {messages.map((m) => (
              <p key={m.id} className="my-2 border-t pt-2">
                <strong>{m.sender_role}: </strong>
                {m.body}
              </p>
            ))}
            <label>
              Reply
              <textarea
                className="my-3 block w-full rounded border p-2"
                maxLength={5000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <button
              disabled={busy || !text.trim()}
              className="rounded bg-obligon-green p-2 text-white"
              onClick={async () => {
                if (
                  await action(`/api/admin/support/${selected.id}/messages`, {
                    message: text,
                  })
                ) {
                  setText("");
                  await select(selected);
                }
              }}
            >
              Send reply
            </button>
          </div>
        )}
      </div>
      <h2 className="mt-8 text-xl font-bold">Paid fuel exceptions</h2>
      {orders.map((o) => (
        <article key={o.id} className="my-4 rounded-xl border border-obligon-border bg-white p-5">
          <p>
            {o.reference} · {o.full_name} · {o.station_name} · ₦
            {(Number(o.amount_kobo) / 100).toLocaleString()} · {o.status}
          </p>
          <p className="my-2">{o.review_reason}</p>
          <button
            disabled={busy || o.status === "refund_pending"}
            className="rounded border p-2"
            onClick={() =>
              void action(`/api/admin/fuel-review/${o.id}/refund`, {
                reason: "Paid order could not be fulfilled within card limits",
              })
            }
          >
            Request original-payment refund
          </button>
        </article>
      ))}
      {!orders.length && <p className="mt-3">No paid fuel exceptions.</p>}
      <h2 className="mt-8 text-xl font-bold">Settlement exceptions</h2>
      <p className="my-2">
        Check processor statements before resolving uncertain transfers or
        historical accounting. Funds stay reserved while transfer status is
        unknown.
      </p>
      {review.payouts.map((p) => (
        <article key={p.id} className="my-4 rounded-xl border border-obligon-border bg-white p-5">
          <p>
            {p.organization} · {p.reference} · ₦
            {(Number(p.amount_kobo) / 100).toLocaleString()}
          </p>
          <p>{p.failure_reason}</p>
        </article>
      ))}
      {review.settlements.map((s) => (
        <article key={s.id} className="my-4 rounded-xl border border-obligon-border bg-white p-5">
          {s.organization} · {s.reference} · Historical settlement requires
          statement reconciliation.
        </article>
      ))}
      {!review.payouts.length && !review.settlements.length && (
        <p>No settlement exceptions.</p>
      )}
      <h2 className="mt-8 text-xl font-bold">Partner bank verification</h2>
      <BankVerificationStatus loading={loading} failed={loadFailed} empty={banks.length === 0} />
      {banks.map((b) => (
        <article key={b.id} className="my-4 rounded-xl border border-obligon-border bg-white p-5">
          <p>
            {b.organization} · {b.bankName} · {b.accountName} · {b.accountMask}{" "}
            ·{" "}
            {b.needsRenomination
              ? "Partner must re-add this bank account"
              : b.verified
                ? "Verified"
                : "Pending review"}
          </p>
          <button
            disabled={busy || !b.isDefault || b.needsRenomination}
            className="mt-3 rounded border p-2"
            onClick={() =>
              void action(`/api/admin/payout-accounts/${b.id}/verify`, {
                approved: !b.verified,
              })
            }
          >
            {b.verified ? "Revoke verification" : "Verify default account"}
          </button>
        </article>
      ))}
    </section>
  );
}
