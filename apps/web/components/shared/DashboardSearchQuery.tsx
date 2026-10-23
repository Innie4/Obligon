"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

type SearchQueryProps = { onSearch: (search: string) => void };

function SearchQueryReader({ onSearch }: SearchQueryProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const search = (params?.get("search") ?? "").trim().slice(0, 254);
  const applySearch = React.useRef(onSearch);
  applySearch.current = onSearch;

  // A changed URL applies its filter. Ordinary renders keep the user's edits.
  React.useEffect(() => { applySearch.current(search); }, [pathname, search]);
  return null;
}

export function DashboardSearchQuery(props: SearchQueryProps) {
  return <React.Suspense fallback={null}><SearchQueryReader {...props} /></React.Suspense>;
}
