"use client";
import { StatusPopup } from "@/components/shared/StatusPopup";
import * as React from "react";
import { authenticatedRequest } from "@/lib/services";
interface Ticket {
  id: string;
  reference: string;
  subject: string;
  status: string;
}
interface Message {
  id: string;
  sender_role: string;
  body: string;
}
export function PartnerServiceRequests() {
  const [services, setServices] = React.useState<string[]>([]),
    [tickets, setTickets] = React.useState<Ticket[]>([]),
    [selected, setSelected] = React.useState<Ticket | null>(null),
    [messages, setMessages] = React.useState<Message[]>([]),
    [loading, setLoading] = React.useState(true),
    [loadingMessages, setLoadingMessages] = React.useState(false),
    [loadError, setLoadError] = React.useState(""),
    [messageError, setMessageError] = React.useState(""),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [notice, setNotice] = React.useState("");
  const openSequence = React.useRef(0);
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await authenticatedRequest<{
        services: string[];
        tickets: Ticket[];
      }>("/api/partner/settings/service-requests");
      setServices(result.services);
      setTickets(result.tickets);
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
  async function open(ticket: Ticket) {
    const sequence = ++openSequence.current;
    setSelected(ticket);
    setMessages([]);
    setMessageError("");
    setLoadingMessages(true);
    try {
      const result = (
        await authenticatedRequest<{ messages: Message[] }>(
          `/api/partner/settings/service-requests/${ticket.id}`,
        )
      ).messages;
      if (sequence === openSequence.current) setMessages(result);
    } catch (e) {
      if (sequence === openSequence.current) setMessageError((e as Error).message);
    } finally {
      if (sequence === openSequence.current) setLoadingMessages(false);
    }
  }
  return (
    <section className="mt-6 min-w-0 rounded-2xl border border-obligon-border bg-white p-5 sm:p-6">
      {(busy) ? <StatusPopup tone="pending" message="Sending support request…" /> : null}
      <h2 className="font-display text-xl font-bold tracking-tight text-obligon-navy">Support and plan services</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-obligon-text">
        Requests reach Obligon’s operations team. Service availability, timing
        and any quote are confirmed before booking.
      </p>
      {error && (
        <StatusPopup tone="error" message={error} />
      )}
      {notice && (
        <StatusPopup tone="info" message={notice} />
      )}
      <form
        className="mt-5 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          setBusy(true);
          setError("");
          setNotice("");
          try {
            const result = await authenticatedRequest<{ reference: string }>(
              "/api/partner/settings/service-requests",
              {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(new FormData(form))),
              },
            );
            await load();
            form.reset();
            setNotice(
              `Request ${result.reference} recorded. Select it below to follow replies.`,
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm font-semibold text-obligon-navy">
          Request type
          <select
            required
            name="service"
            disabled={busy}
            className="mt-2 block min-h-12 w-full rounded-xl border border-obligon-border bg-white p-3 text-sm font-normal disabled:opacity-60"
          >
            <option>General support</option>
            {services.map((service) => (
              <option key={service}>{service}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-obligon-navy">
          Describe your requirements
          <textarea
            required
            name="message"
            maxLength={5000}
            disabled={busy}
            className="mt-2 block min-h-28 w-full rounded-xl border border-obligon-border bg-white p-3 text-sm font-normal disabled:opacity-60"
          />
        </label>
        <button
          disabled={busy}
          className="min-h-12 rounded-xl bg-obligon-green px-5 text-sm font-semibold text-white transition-colors hover:bg-obligon-green/90 disabled:opacity-60"
        >
          {busy ? "Submitting…" : "Send request"}
        </button>
      </form>
      <div className="mt-8 grid gap-6 border-t border-obligon-border pt-6 md:grid-cols-2">
        <div className="min-w-0">
          <h3 className="mb-3 text-sm font-semibold text-obligon-navy">Your requests</h3>
          {loading ? <StatusPopup tone="loading" message="Loading your requests…" /> : null}
          {loadError ? <StatusPopup tone="error" message={loadError} action={<button type="button" disabled={loading} onClick={() => void load()} className="mt-2 min-h-11 rounded-lg px-2 font-semibold underline disabled:opacity-60">Retry loading requests</button>} /> : null}
          {!loading && !loadError && tickets.length === 0 ? <p className="rounded-xl bg-obligon-mist/60 p-4 text-sm leading-6 text-obligon-text">No requests yet. Send a request above and follow its progress here.</p> : null}
          {tickets.map((ticket) => (
            <button
              type="button"
              key={ticket.id}
              aria-pressed={selected?.id === ticket.id}
              className={`mb-2 block min-h-12 w-full break-words rounded-xl border p-4 text-left text-sm transition-colors ${selected?.id === ticket.id ? "border-obligon-green bg-obligon-mist text-obligon-green" : "border-obligon-border text-obligon-navy hover:bg-obligon-mist/60"}`}
              onClick={() => void open(ticket)}
            >
              {ticket.reference} · {ticket.subject} · {ticket.status}
            </button>
          ))}
        </div>
        {selected && (
          <div className="min-w-0 rounded-xl bg-obligon-mist/50 p-4">
            <h3 className="break-words text-sm font-semibold text-obligon-navy">{selected.subject}</h3>
            <button
              type="button"
              disabled={loadingMessages}
              className="min-h-12 rounded-lg text-sm font-semibold text-obligon-green underline disabled:opacity-60"
              onClick={() => void open(selected)}
            >
              Refresh replies
            </button>
            {loadingMessages ? <StatusPopup tone="loading" message="Loading replies…" /> : null}
            {messageError ? <StatusPopup tone="error" message={messageError} /> : null}
            {!loadingMessages && !messageError && messages.length === 0 ? <p className="py-3 text-sm text-obligon-text">There are no replies to this request yet.</p> : null}
            {messages.map((message) => (
              <p
                key={message.id}
                className="mt-3 break-words whitespace-pre-wrap border-t border-obligon-border pt-3 text-sm leading-6 text-obligon-navy"
              >
                <strong>{message.sender_role}: </strong>
                {message.body}
              </p>
            ))}
          </div>
        )}
        {!selected ? <p className="rounded-xl bg-obligon-mist/50 p-4 text-sm leading-6 text-obligon-text">Select a request to read replies from the support team.</p> : null}
      </div>
    </section>
  );
}
