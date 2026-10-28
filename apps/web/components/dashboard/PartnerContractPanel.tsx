"use client";

import * as React from "react";
import Link from "next/link";
import { authenticatedRequest } from "@/lib/services";
import { StatusPopup } from "@/components/shared/StatusPopup";

export type PartnerContractState = { active: boolean; contractStatus: string; temporaryAccess?: boolean; expiresAt?: string | null };

export function PartnerContractPanel({ active, contractStatus, temporaryAccess, expiresAt }: PartnerContractState) {
  return <section className="p-5 sm:p-10">
    <h1 className="font-display text-3xl font-extrabold">Partner contract</h1>
    <p className="mt-3 text-sm leading-6 text-obligon-text">{temporaryAccess ? `Temporary test access${expiresAt ? ` until ${new Date(expiresAt).toLocaleString("en-GB")}` : " is active"}. This does not confirm an agreed or approved contract.` : active ? "Your agreed contract has been approved. Partner operations are available." : "Station and workshop operations become available after your contract is agreed and an administrator approves it."}</p>
    <p className="mt-3 text-sm font-semibold">Contract status: {contractStatus.replaceAll("_", " ")}</p>
    <p className="mt-3 text-sm leading-6 text-obligon-text">Partners do not need a subscription. You can complete your profile, manage your team, verify your account and contact Support while approval is pending.</p>
    <Link href="/dashboard/settings" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-obligon-green px-5 font-bold text-white">Contact Support</Link>
  </section>;
}

export function PartnerContractBilling() {
  const [data, setData] = React.useState<PartnerContractState | null>(null);
  const [error, setError] = React.useState("");
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    authenticatedRequest<PartnerContractState>("/api/partner/billing")
      .then(result => { if (alive) setData(result); })
      .catch(failure => { if (alive) setError(failure.message); });
    return () => { alive = false; };
  }, [revision]);
  if (error) return <StatusPopup tone="error" title="Your contract status could not be checked." message={error} onRetry={() => setRevision(value => value + 1)} />;
  if (!data) return <StatusPopup tone="loading" message="Checking contract approval…" />;
  return <PartnerContractPanel {...data} />;
}
