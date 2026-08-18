"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Check, Download, Plus, Search, X } from "lucide-react";
import { dashboardPages, type DashboardPageKey, type DashboardRow, type DashboardStat } from "./dashboard-data";
import { MobileDashboardNav } from "./MobileDashboardNav";

const toneClasses = {
  green: "bg-obligon-green/10 text-obligon-green",
  blue: "bg-[#e6eeff] text-obligon-blue",
  amber: "bg-[#fff7df] text-[#8a5b00]",
  red: "bg-[#fff0f1] text-[#93000a]"
};

const statusClasses: Record<DashboardRow["status"], string> = {
  Live: "bg-obligon-green/10 text-obligon-green",
  Pending: "bg-[#fff7df] text-[#8a5b00]",
  Paid: "bg-obligon-green/10 text-obligon-green",
  Flagged: "bg-[#fff0f1] text-[#93000a]",
  Open: "bg-[#fff7df] text-[#8a5b00]",
  Resolved: "bg-[#e6eeff] text-obligon-blue",
  Active: "bg-obligon-green/10 text-obligon-green",
  Draft: "bg-[#eef1fb] text-obligon-text"
};

function StatCard({ stat }: { stat: DashboardStat }) {
  const positive = !stat.delta.toLowerCase().includes("failed") && !stat.delta.toLowerCase().includes("review");

  return (
    <article className="rounded-2xl border border-obligon-border bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <p className="text-xs font-bold uppercase tracking-[1.1px] text-obligon-text">{stat.label}</p>
      <p className="mt-3 font-display text-3xl font-extrabold tracking-[-0.4px] text-obligon-navy">{stat.value}</p>
      <span className={`mt-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${toneClasses[stat.tone ?? "green"]}`}>
        {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
        {stat.delta}
      </span>
    </article>
  );
}

function ActionModal({
  open,
  title,
  body,
  onClose
}: {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-obligon-navy/60 px-5 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-2xl border border-obligon-border bg-white p-6 shadow-hero">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[1.2px] text-obligon-green">Partner Action</p>
            <h2 className="mt-2 font-display text-2xl font-bold">{title}</h2>
          </div>
          <button className="grid size-9 place-items-center rounded-lg bg-obligon-mist text-obligon-text" onClick={onClose} type="button" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>
        <p className="mt-4 text-sm leading-6 text-obligon-text">{body}</p>
        <label className="mt-6 block">
          <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">Reference Note</span>
          <textarea className="mt-2 min-h-28 w-full rounded-lg border border-obligon-border px-4 py-3 text-sm outline-none focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20" placeholder="Add context for this request." />
        </label>
        <div className="mt-6 flex gap-3">
          <button className="h-11 flex-1 rounded-lg bg-obligon-green text-sm font-bold text-white" onClick={onClose} type="button">
            Submit
          </button>
          <button className="h-11 flex-1 rounded-lg border border-obligon-border text-sm font-bold text-obligon-navy" onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

export function DashboardScreen({ pageKey }: { pageKey: DashboardPageKey }) {
  const page = dashboardPages[pageKey];
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("All");
  const [modalOpen, setModalOpen] = React.useState(false);

  const filteredRows = page.rows.filter((row) => {
    const matchesQuery = `${row.id} ${row.primary} ${row.secondary} ${row.amount} ${row.meta}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesFilter = filter === "All" || row.status === filter;
    return matchesQuery && matchesFilter;
  });

  return (
    <>
      <MobileDashboardNav />
      <section className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[1.4px] text-obligon-green">{page.kicker}</p>
            <h1 className="mt-3 font-display text-[34px] font-extrabold leading-[42px] tracking-[-0.5px] sm:text-5xl sm:leading-[56px]">
              {page.title}
            </h1>
            <p className="mt-3 text-base leading-6 text-obligon-text">{page.description}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-obligon-green px-5 text-sm font-bold text-white shadow-green"
              onClick={() => setModalOpen(true)}
              type="button"
            >
              <Plus size={17} />
              {page.primaryAction}
            </button>
            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-obligon-border bg-white px-5 text-sm font-bold text-obligon-navy" type="button">
              <Download size={17} />
              Export
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {page.stats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-3">
          {page.panels.map((panel) => (
            <article key={panel.title} className="rounded-2xl border border-obligon-border bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-xl font-bold">{panel.title}</h2>
                {panel.value ? (
                  <span className="rounded-full bg-obligon-lime/30 px-3 py-1 text-xs font-extrabold text-[#131f00]">
                    {panel.value}
                  </span>
                ) : null}
              </div>
              <p className="mt-4 text-sm leading-6 text-obligon-text">{panel.body}</p>
              {panel.items ? (
                <ul className="mt-5 space-y-3">
                  {panel.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm font-semibold text-obligon-navy">
                      <Check className="text-obligon-green" size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>

        <section className="mt-8 overflow-hidden rounded-2xl border border-obligon-border bg-white">
          <div className="flex flex-col gap-4 border-b border-obligon-border p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold">{page.tableTitle}</h2>
              <p className="mt-1 text-sm text-obligon-text">Live preview data for the partnership dashboard flow.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex h-11 items-center gap-2 rounded-xl border border-obligon-border px-3">
                <Search size={16} className="text-obligon-text" />
                <input
                  className="w-full min-w-0 bg-transparent text-sm outline-none"
                  placeholder="Search rows"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {page.filters.map((item) => (
                  <button
                    key={item}
                    className={`h-11 shrink-0 rounded-xl px-4 text-xs font-bold ${
                      filter === item ? "bg-obligon-navy text-white" : "bg-obligon-mist text-obligon-text"
                    }`}
                    onClick={() => setFilter(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-obligon-border text-xs uppercase tracking-[1px] text-obligon-text">
                  <th className="px-5 py-4">Reference</th>
                  <th className="px-5 py-4">Details</th>
                  <th className="px-5 py-4">Amount / Type</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obligon-border">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-obligon-mist/70">
                    <td className="px-5 py-5 text-sm font-bold text-obligon-navy">{row.id}</td>
                    <td className="px-5 py-5">
                      <p className="text-sm font-bold text-obligon-navy">{row.primary}</p>
                      <p className="mt-1 text-xs text-obligon-text">{row.secondary}</p>
                    </td>
                    <td className="px-5 py-5 text-sm font-bold text-obligon-navy">{row.amount}</td>
                    <td className="px-5 py-5">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${statusClasses[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-5 text-right text-sm text-obligon-text">{row.meta}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-5 py-10 text-center text-sm text-obligon-text" colSpan={5}>
                      No matching records found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <ActionModal open={modalOpen} title={page.modalTitle} body={page.modalBody} onClose={() => setModalOpen(false)} />
    </>
  );
}

