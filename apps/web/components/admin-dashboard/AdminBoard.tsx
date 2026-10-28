"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";

type BoardLane = {
  id: string;
  title: string;
  count: number;
  description?: string;
  emptyMessage: string;
  tone?: "neutral" | "success" | "warning" | "error";
  children: React.ReactNode;
};

export function AdminBoard({ label, lanes }: { label: string; lanes: BoardLane[] }) {
  const [collapsed, setCollapsed] = React.useState<string[]>([]);
  const [maximized, setMaximized] = React.useState<string | null>(null);
  const boardId = React.useId();
  const visibleLanes = maximized ? lanes.filter(lane => lane.id === maximized) : lanes;

  return <section className="admin-board" aria-label={label} data-maximized={Boolean(maximized)}>
    {visibleLanes.map(lane => {
      const minimized = collapsed.includes(lane.id);
      const contentId = `${boardId}-${lane.id}`;
      return <section key={lane.id} className="admin-board-lane" aria-label={`${lane.title} column`} data-tone={lane.tone ?? "neutral"}>
        <header className="admin-board-heading">
          <div className="min-w-0">
            <h2>{lane.title}<span className="admin-board-count" aria-label={`${lane.count} ${lane.count === 1 ? "record" : "records"}`}>{lane.count}</span></h2>
            {lane.description ? <p>{lane.description}</p> : null}
          </div>
          <div className="admin-board-controls">
            <button type="button" aria-label={`${minimized ? "Expand" : "Minimize"} ${lane.title} column`} aria-expanded={!minimized} aria-controls={contentId} onClick={() => setCollapsed(current => current.includes(lane.id) ? current.filter(id => id !== lane.id) : [...current, lane.id])}>
              {minimized ? <ChevronDown size={17} aria-hidden="true" /> : <ChevronUp size={17} aria-hidden="true" />}
            </button>
            <button type="button" aria-label={maximized === lane.id ? "Restore all columns" : `Maximize ${lane.title} column`} aria-pressed={maximized === lane.id} onClick={() => {
              setMaximized(current => current === lane.id ? null : lane.id);
              setCollapsed(current => current.filter(id => id !== lane.id));
            }}>
              {maximized === lane.id ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
            </button>
          </div>
        </header>
        <div id={contentId} className="admin-board-content" hidden={minimized}>
          {lane.count ? lane.children : <p className="admin-board-empty">{lane.emptyMessage}</p>}
        </div>
      </section>;
    })}
  </section>;
}
