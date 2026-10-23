"use client";

import * as React from "react";

type RecordRow = { id?: string; cells: string[]; status?: string };

export function AdminRecords<T extends RecordRow>({ title, columns, rows, busy, onReview }: {
  title: string;
  columns: string[];
  rows: T[];
  busy: boolean;
  onReview?: (row: T) => void;
}) {
  return <section aria-label={`${title} records`} className="mt-6 min-w-0 overflow-hidden rounded-xl border border-obligon-border bg-white">
    {!rows.length ? <div role="status" className="px-5 py-12 text-center"><p className="font-semibold text-obligon-navy">No records match this view.</p><p className="mt-2 text-sm text-obligon-text">Try another search or refresh the records.</p></div> : <>
      <ul className="divide-y divide-obligon-border md:hidden">
        {rows.map((row, index) => <li key={row.id ?? index} className="p-4 sm:p-5">
          <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4">
            {row.cells.map((cell, cellIndex) => <div key={cellIndex} className={cellIndex === 0 ? "col-span-2 min-w-0" : "min-w-0"}>
              <dt className="text-xs font-medium text-obligon-text">{columns[cellIndex]}</dt>
              <dd className={`mt-1 whitespace-pre-line break-words text-sm text-obligon-navy ${cellIndex === 0 ? "font-bold" : "font-medium"}`}>{cell}</dd>
            </div>)}
            <div className="col-span-2"><dt className="text-xs font-medium text-obligon-text">{columns[row.cells.length] ?? "Status"}</dt><dd className="mt-1 inline-flex rounded-lg bg-obligon-mist px-2.5 py-1 text-xs font-semibold text-obligon-navy">{row.status}</dd></div>
          </dl>
          {onReview ? <button type="button" disabled={busy} onClick={() => onReview(row)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-obligon-border px-4 text-sm font-bold text-obligon-green hover:bg-obligon-mist disabled:opacity-50">Review record<span className="sr-only"> {row.cells[0]}</span></button> : null}
        </li>)}
      </ul>
      <div tabIndex={0} role="region" aria-label={`${title} table`} className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="bg-[#f2f6fa] text-xs text-obligon-text"><tr>{columns.map(column => <th scope="col" key={column} className="px-5 py-4 font-semibold">{column}</th>)}{onReview ? <th scope="col" className="px-5 py-4 font-semibold">Review</th> : null}</tr></thead>
          <tbody className="divide-y divide-obligon-border">{rows.map((row, index) => <tr key={row.id ?? index} className="transition-colors hover:bg-obligon-mist/50">
            {row.cells.map((cell, cellIndex) => <td key={cellIndex} className="max-w-sm whitespace-pre-line break-words px-5 py-4 align-top">{cell}</td>)}
            <td className="px-5 py-4 align-top"><span className="inline-flex whitespace-nowrap rounded-lg bg-obligon-mist px-2.5 py-1 text-xs font-semibold text-obligon-navy">{row.status}</span></td>
            {onReview ? <td className="px-5 py-3 align-top"><button type="button" disabled={busy} onClick={() => onReview(row)} className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-obligon-green hover:bg-obligon-mist disabled:opacity-50">Review record<span className="sr-only"> {row.cells[0]}</span></button></td> : null}
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </section>;
}
