"use client";

import * as React from "react";
import { ArrowUpRight, Search } from "lucide-react";

type RecordRow = { id?: string; cells: string[]; status?: string };
function statusTone(status = "") {
  if (/reject|suspend|frozen|fail|locked|canceled/i.test(status)) return "error";
  if (/pending|review|trial|onboard|past.due/i.test(status)) return "warning";
  if (/active|approv|verified|resolv|paid|complete/i.test(status)) return "success";
  return "neutral";
}
function RecordStatus({ status }: { status?: string }) {
  return <span className="admin-status" data-tone={statusTone(status)}>{status || "Not recorded"}</span>;
}

export function AdminRecords<T extends RecordRow>({ title, columns, rows, busy, onReview }: {
  title: string;
  columns: string[];
  rows: T[];
  busy: boolean;
  onReview?: (row: T) => void;
}) {
  return <section aria-label={`${title} records`} className="admin-records">
    <header className="admin-records-heading"><h2>Records</h2><p className="admin-records-count">{rows.length} {rows.length === 1 ? "record" : "records"} in this view</p></header>
    {!rows.length ? <div role="status" className="px-6 py-14 text-center"><Search size={24} aria-hidden="true" className="mx-auto mb-4 text-obligon-text" /><p className="text-base font-semibold">No records match this view.</p><p className="mt-2 text-sm leading-6 text-obligon-text">Try another search or refresh the records.</p></div> : <>
      <ul className="divide-y divide-obligon-border md:hidden">
        {rows.map((row, index) => <li key={row.id ?? index} className="p-5">
          <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4">
            {row.cells.map((cell, cellIndex) => <div key={cellIndex} className={cellIndex === 0 ? "col-span-2 min-w-0" : "min-w-0"}>
              <dt className="text-xs font-medium text-obligon-text">{columns[cellIndex]}</dt>
              <dd className={`mt-1 whitespace-pre-line break-words text-sm ${cellIndex === 0 ? "text-base font-bold" : "font-medium"}`}>{cell}</dd>
            </div>)}
            <div className="col-span-2"><dt className="mb-2 text-xs font-medium text-obligon-text">{columns[row.cells.length] ?? "Status"}</dt><dd><RecordStatus status={row.status} /></dd></div>
          </dl>
          {onReview ? <button type="button" disabled={busy} onClick={() => onReview(row)} className="admin-review-button mt-5 w-full">Review record<ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only"> {row.cells[0]}</span></button> : null}
        </li>)}
      </ul>
      <div tabIndex={0} role="region" aria-label={`${title} table`} className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}{onReview ? <th scope="col">Review</th> : null}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={row.id ?? index}>
            {row.cells.map((cell, cellIndex) => <td key={cellIndex} className="max-w-sm whitespace-pre-line break-words">{cell}</td>)}
            <td><RecordStatus status={row.status} /></td>
            {onReview ? <td><button type="button" disabled={busy} onClick={() => onReview(row)} className="admin-review-button">Review record<ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only"> {row.cells[0]}</span></button></td> : null}
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </section>;
}
