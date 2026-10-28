"use client";

import * as React from "react";
import { ADMIN_PAGES, ADMIN_ROLES, type AdminRole } from "../../../../packages/shared/admin-access.mjs";

export function AdminStaffFields({ initialRole = "", initialPages = [] }: { initialRole?: string; initialPages?: string[] }) {
  const [role, setRole] = React.useState(initialRole);
  const [pages, setPages] = React.useState(initialPages);
  const descriptions: Record<AdminRole, string> = {
    super_admin: "Can manage administrator access and approve ticket closures on assigned pages.",
    supervisor: "Can approve ticket closures on Operations. Administrator access is managed by a Super Admin.",
    staff: "Can work on assigned pages and request ticket closure. A Supervisor or Super Admin approves closure.",
  };
  const available = ADMIN_PAGES.filter(page => page.key !== "staff" || role === "super_admin");
  return <>
    <label>
      Role label
      <select name="role" required className="mt-2 block min-h-11 w-full rounded-xl border bg-white p-3 text-sm" value={role} onChange={event => {
        setRole(event.target.value);
        if (event.target.value !== "super_admin") setPages(current => current.filter(page => page !== "staff"));
      }} aria-describedby="admin-role-description">
        <option value="" disabled>Select a role</option>
        {ADMIN_ROLES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
    <p id="admin-role-description" className="text-sm leading-6 text-obligon-text">{descriptions[role as AdminRole] ?? "Select a role, then choose at least one page this administrator can access."}</p>
    <fieldset className="admin-page-permissions" aria-describedby="admin-pages-help">
      <legend>Pages they can access</legend>
      <p id="admin-pages-help" className="mb-2 text-sm leading-6 text-obligon-text">Choose at least one page. Access is enforced for page requests and their actions.</p>
      <div className="mb-2 flex flex-wrap gap-3">
        <button type="button" disabled={!role} className="admin-review-button" onClick={() => setPages(available.map(page => page.key))}>Select all available</button>
        <button type="button" disabled={!pages.length} className="admin-review-button" onClick={() => setPages([])}>Clear selection</button>
      </div>
      {ADMIN_PAGES.map(page => <label key={page.key} className="admin-page-permission">
        <input type="checkbox" name="permissions" value={page.key} checked={pages.includes(page.key)} disabled={!role || (page.key === "staff" && role !== "super_admin")} onChange={event => setPages(current => event.target.checked ? [...current, page.key] : current.filter(key => key !== page.key))} />
        <span>{page.title}{page.key === "staff" ? <small>Super Admin only.</small> : page.key === "operations" ? <small>Includes support, settlement and refund controls.</small> : page.key === "benefits" ? <small>Includes programme funding and repair review.</small> : null}</span>
      </label>)}
    </fieldset>
  </>;
}
