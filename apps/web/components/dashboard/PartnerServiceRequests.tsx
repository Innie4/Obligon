"use client";
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
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [notice, setNotice] = React.useState("");
  const openSequence = React.useRef(0);
  const load = React.useCallback(async () => {
    try {
      const result = await authenticatedRequest<{
        services: string[];
        tickets: Ticket[];
      }>("/api/partner/settings/service-requests");
      setServices(result.services);
      setTickets(result.tickets);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  async function open(ticket: Ticket) {
    const sequence = ++openSequence.current;
    setSelected(ticket);
    setMessages([]);
    try {
      const result = (
        await authenticatedRequest<{ messages: Message[] }>(
          `/api/partner/settings/service-requests/${ticket.id}`,
        )
      ).messages;
      if (sequence === openSequence.current) setMessages(result);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="mt-6 rounded-xl border bg-white p-6">
      <h2 className="text-2xl font-bold">Support and plan services</h2>
      <p className="mt-2 text-sm">
        Requests reach Obligon’s operations team. Service availability, timing
        and any quote are confirmed before booking.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-green-900">
          {notice}
        </p>
      )}
      <form
        className="mt-5 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          setBusy(true);
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
        <label className="block">
          Request type
          <select
            required
            name="service"
            className="mt-2 block min-h-12 w-full rounded border p-3"
          >
            <option>General support</option>
            {services.map((service) => (
              <option key={service}>{service}</option>
            ))}
          </select>
        </label>
        <label className="block">
          Describe your requirements
          <textarea
            required
            name="message"
            maxLength={5000}
            className="mt-2 block min-h-28 w-full rounded border p-3"
          />
        </label>
        <button
          disabled={busy}
          className="min-h-12 rounded bg-obligon-green px-5 font-bold text-white"
        >
          {busy ? "Submitting…" : "Send request"}
        </button>
      </form>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          {tickets.map((ticket) => (
            <button
              type="button"
              key={ticket.id}
              className="mb-2 block min-h-12 w-full rounded border p-3 text-left"
              onClick={() => void open(ticket)}
            >
              {ticket.reference} · {ticket.subject} · {ticket.status}
            </button>
          ))}
        </div>
        {selected && (
          <div>
            <h3 className="font-bold">{selected.subject}</h3>
            <button
              type="button"
              className="min-h-12 underline"
              onClick={() => void open(selected)}
            >
              Refresh replies
            </button>
            {messages.map((message) => (
              <p
                key={message.id}
                className="mt-3 whitespace-pre-wrap border-t pt-3"
              >
                <strong>{message.sender_role}: </strong>
                {message.body}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
