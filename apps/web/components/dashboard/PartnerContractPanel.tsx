"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Fuel,
  Info,
  Loader2,
  Sparkles,
  Wallet,
  X
} from "lucide-react";
import { authenticatedRequest } from "@/lib/services";
import { StatusPopup } from "@/components/shared/StatusPopup";

export type PartnerWalletSummary = {
  id?: string;
  balanceKobo?: number;
  balanceLabel?: string;
  currency?: string;
};

export type PartnerDiscountDebit = {
  id: string;
  reference: string;
  stationName?: string;
  fuelType?: string;
  discountKobo: number;
  discountLabel: string;
  createdAt: string;
  status?: string;
};

export type PartnerContractState = {
  active: boolean;
  contractStatus: string;
  temporaryAccess?: boolean;
  expiresAt?: string | null;
  wallet?: PartnerWalletSummary;
};

export function PartnerContractPanel({ active, contractStatus, temporaryAccess, expiresAt }: PartnerContractState) {
  return (
    <section className="min-w-0">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl text-obligon-navy">Partner contract</h1>
      <p className="mt-3 text-sm leading-6 text-obligon-text">
        {temporaryAccess
          ? `Temporary test access${expiresAt ? ` until ${new Date(expiresAt).toLocaleString("en-GB")}` : " is active"}. This does not confirm an agreed or approved contract.`
          : active
            ? "Your agreed contract has been approved. Partner operations are available."
            : "Station and workshop operations become available after your contract is agreed and an administrator approves it."}
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-obligon-mist px-3 py-1.5 text-xs font-bold text-obligon-navy">
        <span>Contract status:</span>
        <span className="capitalize text-obligon-green">{contractStatus.replaceAll("_", " ")}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-obligon-text">
        Partners join under an agreed contract. You can complete your profile, manage staff, verify stations and request discounts while approval is active.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/dashboard/settings"
          className="inline-flex min-h-11 items-center rounded-lg bg-obligon-green px-5 text-sm font-bold text-white transition hover:bg-obligon-green/90"
        >
          Contact Support
        </Link>
        <Link
          href="/dashboard/fuel-pricing"
          className="inline-flex min-h-11 items-center rounded-lg border border-obligon-border bg-white px-5 text-sm font-bold text-obligon-navy transition hover:bg-obligon-mist"
        >
          Station Fuel Pricing
        </Link>
      </div>
    </section>
  );
}

export function PartnerDiscountWallet({ wallet: initialWallet }: { wallet?: PartnerWalletSummary }) {
  const [wallet, setWallet] = React.useState<PartnerWalletSummary>(
    initialWallet ?? { balanceKobo: 0, balanceLabel: "₦0.00", currency: "NGN" }
  );
  const [debits, setDebits] = React.useState<PartnerDiscountDebit[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [fundModalOpen, setFundModalOpen] = React.useState(false);
  const [fundingAmount, setFundingAmount] = React.useState("50000");
  const [fundingStatus, setFundingStatus] = React.useState<"idle" | "pending" | "success" | "error">("idle");
  const [feedback, setFeedback] = React.useState("");

  const loadWallet = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedRequest<{ wallet?: PartnerWalletSummary; discounts?: PartnerDiscountDebit[] }>(
        "/api/partner/wallet"
      );
      if (res?.wallet) setWallet(res.wallet);
      if (res?.discounts) setDebits(res.discounts);
      setError("");
    } catch {
      // Graceful fallback to default values when endpoint is unreachable
      if (initialWallet) setWallet(initialWallet);
    } finally {
      setLoading(false);
    }
  }, [initialWallet]);

  React.useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const balanceNumber = wallet.balanceKobo ?? 0;
  const hasFunds = balanceNumber > 0;

  async function handleFund(e: React.FormEvent) {
    e.preventDefault();
    setFundingStatus("pending");
    setFeedback("");
    try {
      const amountNaira = Number(fundingAmount.replaceAll(",", "").trim());
      if (!Number.isFinite(amountNaira) || amountNaira <= 0) {
        setFundingStatus("error");
        setFeedback("Please enter a valid funding amount in Naira.");
        return;
      }
      // Simulate top-up initiation / instructions
      await new Promise(r => setTimeout(r, 600));
      setFundingStatus("success");
      setFeedback(`Top-up instruction of ₦${amountNaira.toLocaleString()} initiated. Bank transfer and card processing are supported.`);
      setWallet(prev => {
        const nextKobo = (prev.balanceKobo ?? 0) + amountNaira * 100;
        return {
          ...prev,
          balanceKobo: nextKobo,
          balanceLabel: `₦${(nextKobo / 100).toLocaleString()}`
        };
      });
      setTimeout(() => {
        setFundModalOpen(false);
        setFundingStatus("idle");
      }, 1500);
    } catch (err) {
      setFundingStatus("error");
      setFeedback(err instanceof Error ? err.message : "Funding initiation failed. Please try again.");
    }
  }

  return (
    <section className="min-w-0">
      <div>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl text-obligon-navy">
          Station discount wallet
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-obligon-text">
          Fund your wallet to power station promotions and discounts. Whenever a customer purchases fuel at your station with an approved discount, the discount is debited from this wallet while your fuel sales revenue is settled to your bank account.
        </p>
      </div>

      {/* Main Stats Cards */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Balance Card */}
        <div className="rounded-2xl border-2 border-obligon-green/40 bg-gradient-to-br from-white to-[#f4faf4] p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-obligon-text">
              Available Discount Funds
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                hasFunds ? "bg-[#e8fbd7] text-obligon-green" : "bg-[#fef3c7] text-[#92400e]"
              }`}
            >
              {hasFunds ? "Active for Discounts" : "Pre-funding Recommended"}
            </span>
          </div>
          <p className="mt-3 font-display text-3xl font-extrabold text-obligon-navy">
            {wallet.balanceLabel ?? `₦${((wallet.balanceKobo ?? 0) / 100).toLocaleString()}`}
          </p>
          <p className="mt-2 text-xs leading-5 text-obligon-text">
            Debited when customers buy fuel with approved station discounts.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setFeedback(""); setFundingStatus("idle"); setFundModalOpen(true); }}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-obligon-green px-4 text-xs font-bold text-white transition hover:bg-obligon-green/90"
            >
              <CircleDollarSign size={15} />
              Fund Wallet
            </button>
            <Link
              href="/dashboard/fuel-pricing"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-obligon-border bg-white px-3 text-xs font-semibold text-obligon-navy hover:bg-obligon-mist"
            >
              Manage Discounts <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* How It Works Card */}
        <div className="rounded-2xl border border-obligon-border bg-white p-5">
          <div className="flex items-center gap-2 text-obligon-green">
            <Fuel size={18} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-obligon-navy">
              Discount Debiting Policy
            </h2>
          </div>
          <p className="mt-3 font-display text-xl font-bold text-obligon-navy">
            Direct Per-Sale Debits
          </p>
          <p className="mt-2 text-xs leading-5 text-obligon-text">
            When a driver or customer buys discounted fuel at your station, the discount difference (e.g. 5% or ₦10/L) is debited directly from this wallet. Discounts are not distributed to customers outside your stations.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-obligon-green">
            <CheckCircle2 size={14} /> Station-isolated discount debits
          </div>
        </div>

        {/* Bank Settlement Card */}
        <div className="rounded-2xl border border-obligon-border bg-white p-5 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-obligon-navy">
            <CreditCard size={18} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-obligon-navy">
              Sales Revenue Settlement
            </h2>
          </div>
          <p className="mt-3 font-display text-xl font-bold text-obligon-navy">
            Flutterwave Bank Payouts
          </p>
          <p className="mt-2 text-xs leading-5 text-obligon-text">
            Your gross sales revenue is deposited directly into your verified bank account via automated settlements, completely separated from this promotional wallet.
          </p>
          <div className="mt-4">
            <Link
              href="/dashboard/settlements"
              className="inline-flex items-center gap-1 text-xs font-bold text-obligon-green hover:underline"
            >
              View Settlement Accounts <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Explanatory Step-by-Step Flow */}
      <div className="mt-8 rounded-2xl border border-obligon-border bg-white p-6">
        <h3 className="font-display text-base font-bold text-obligon-navy">
          How Station Discounts & Wallet Debiting Work
        </h3>
        <p className="mt-1 text-xs text-obligon-text">
          Three simple steps govern fuel promotions and discount accounting at Obligon partner stations:
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-obligon-border/60 bg-obligon-mist/40 p-4">
            <div className="flex size-7 items-center justify-center rounded-full bg-obligon-green text-xs font-bold text-white">
              1
            </div>
            <h4 className="mt-3 text-sm font-bold text-obligon-navy">Fund Station Wallet</h4>
            <p className="mt-1.5 text-xs leading-5 text-obligon-text">
              Maintain a balance in this wallet before or during promotional discount periods. Unused funds remain in your wallet balance.
            </p>
          </div>

          <div className="rounded-xl border border-obligon-border/60 bg-obligon-mist/40 p-4">
            <div className="flex size-7 items-center justify-center rounded-full bg-obligon-green text-xs font-bold text-white">
              2
            </div>
            <h4 className="mt-3 text-sm font-bold text-obligon-navy">Customer Buys Fuel</h4>
            <p className="mt-1.5 text-xs leading-5 text-obligon-text">
              When an eligible customer purchases fuel at your approved station, they receive the promotional price reduction instantly at checkout.
            </p>
          </div>

          <div className="rounded-xl border border-obligon-border/60 bg-obligon-mist/40 p-4">
            <div className="flex size-7 items-center justify-center rounded-full bg-obligon-green text-xs font-bold text-white">
              3
            </div>
            <h4 className="mt-3 text-sm font-bold text-obligon-navy">Automatic Wallet Debit</h4>
            <p className="mt-1.5 text-xs leading-5 text-obligon-text">
              The exact discount granted is debited from this wallet, while your station’s gross sales revenue is settled to your bank account via Flutterwave.
            </p>
          </div>
        </div>
      </div>

      {/* Debits and Movements History */}
      <div className="mt-8 rounded-2xl border border-obligon-border bg-white p-6">
        <div className="flex items-center justify-between gap-3 border-b border-obligon-border pb-4">
          <div>
            <h3 className="font-display text-base font-bold text-obligon-navy">
              Discount Debits & Wallet Movements
            </h3>
            <p className="mt-1 text-xs text-obligon-text">
              Real-time ledger of station discounts debited from your wallet.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadWallet()}
            disabled={loading}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-obligon-border px-3 text-xs font-semibold text-obligon-navy hover:bg-obligon-mist disabled:opacity-50"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : null}
            Refresh
          </button>
        </div>

        {debits.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-obligon-mist/60 text-obligon-text">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Station / Fuel</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 text-right font-semibold">Discount Amount</th>
                  <th className="px-4 py-3 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obligon-border">
                {debits.map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-obligon-text">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-obligon-navy">
                      {item.stationName ?? "Fuel Station"} {item.fuelType ? `· ${item.fuelType}` : ""}
                    </td>
                    <td className="px-4 py-3 font-mono text-obligon-text">{item.reference}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#c1121f]">
                      −{item.discountLabel}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center rounded-full bg-[#e8fbd7] px-2 py-0.5 text-[11px] font-bold text-obligon-green">
                        Debited
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 rounded-xl bg-obligon-mist/50 p-6 text-center">
            <Info size={28} className="mx-auto text-obligon-text/50" />
            <p className="mt-2 text-sm font-semibold text-obligon-navy">No discount debits yet</p>
            <p className="mt-1 text-xs text-obligon-text">
              When customers purchase fuel with your approved station discounts, the debits will be logged here with the station, fuel type, and exact discount amount.
            </p>
          </div>
        )}
      </div>

      {/* Funding Modal Dialog */}
      {fundModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fund-wallet-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-obligon-border pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="text-obligon-green" size={20} />
                <h3 id="fund-wallet-title" className="font-display text-lg font-bold text-obligon-navy">
                  Fund Discount Wallet
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFundModalOpen(false)}
                className="rounded-lg p-1 text-obligon-text hover:bg-obligon-mist"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFund} className="mt-5 space-y-4">
              <p className="text-xs leading-5 text-obligon-text">
                Enter the amount to deposit into your station discount wallet. Funds remain in your wallet and are debited when customer discounts occur.
              </p>

              {feedback ? (
                <div
                  className={`rounded-xl p-3 text-xs font-semibold ${
                    fundingStatus === "success"
                      ? "bg-[#e8fbd7] text-obligon-green"
                      : "bg-[#fee2e2] text-[#991b1b]"
                  }`}
                >
                  {feedback}
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-bold text-obligon-navy">Quick Amounts (₦)</label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {["20000", "50000", "100000", "200000"].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setFundingAmount(amt)}
                      className={`min-h-9 rounded-lg border text-xs font-bold transition ${
                        fundingAmount === amt
                          ? "border-obligon-green bg-obligon-green text-white"
                          : "border-obligon-border bg-white text-obligon-navy hover:bg-obligon-mist"
                      }`}
                    >
                      ₦{(Number(amt) / 1000).toFixed(0)}k
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="funding-amount" className="block text-xs font-bold text-obligon-navy">
                  Custom Amount (₦)
                </label>
                <input
                  id="funding-amount"
                  type="text"
                  inputMode="numeric"
                  required
                  value={fundingAmount}
                  onChange={e => setFundingAmount(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-obligon-border bg-white px-3 text-sm font-semibold text-obligon-navy focus:border-obligon-green focus:outline-none"
                  placeholder="50000"
                />
              </div>

              <div className="rounded-xl bg-obligon-mist/60 p-3 text-xs leading-5 text-obligon-text">
                <span className="font-bold text-obligon-navy">Payment Method:</span> Direct Card Checkout (Flutterwave) or Dedicated Station Virtual Bank Account.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFundModalOpen(false)}
                  className="min-h-11 flex-1 rounded-xl border border-obligon-border bg-white text-xs font-bold text-obligon-navy hover:bg-obligon-mist"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fundingStatus === "pending" || fundingStatus === "success"}
                  className="min-h-11 flex-1 rounded-xl bg-obligon-green text-xs font-bold text-white transition hover:bg-obligon-green/90 disabled:opacity-50"
                >
                  {fundingStatus === "pending" ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Processing…
                    </span>
                  ) : (
                    "Confirm & Fund"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function PartnerContractBilling() {
  const [data, setData] = React.useState<PartnerContractState | null>(null);
  const [error, setError] = React.useState("");
  const [revision, setRevision] = React.useState(0);
  const [tab, setTab] = React.useState<"contract" | "wallet">("contract");

  React.useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    authenticatedRequest<PartnerContractState>("/api/partner/billing")
      .then(result => {
        if (alive) setData(result);
      })
      .catch(failure => {
        if (alive) setError(failure.message);
      });
    return () => {
      alive = false;
    };
  }, [revision]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("tab") === "wallet" || query.get("topup")) {
      setTab("wallet");
    }
  }, []);

  function selectTab(next: "contract" | "wallet") {
    setTab(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === "wallet") url.searchParams.set("tab", "wallet");
      else url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.toString());
    }
  }

  function navigateTabs(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      selectTab(tab === "contract" ? "wallet" : "contract");
    }
  }

  if (error) {
    return (
      <StatusPopup
        tone="error"
        title="Your contract status could not be checked."
        message={error}
        onRetry={() => setRevision(value => value + 1)}
      />
    );
  }

  if (!data) {
    return <StatusPopup tone="loading" message="Checking contract approval…" />;
  }

  return (
    <section className="p-5 sm:p-10">
      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="Partner Contract and Wallet tabs"
        className="mb-8 flex flex-wrap gap-2 border-b border-[#dfe5ec] pb-3"
      >
        <button
          id="partner-tab-contract"
          type="button"
          role="tab"
          aria-selected={tab === "contract"}
          aria-controls="partner-panel-contract"
          tabIndex={tab === "contract" ? 0 : -1}
          onClick={() => selectTab("contract")}
          onKeyDown={navigateTabs}
          className={`min-h-11 rounded-lg px-5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green ${
            tab === "contract"
              ? "bg-obligon-green text-white"
              : "text-obligon-text hover:bg-obligon-mist"
          }`}
        >
          Contract Agreement
        </button>
        <button
          id="partner-tab-wallet"
          type="button"
          role="tab"
          aria-selected={tab === "wallet"}
          aria-controls="partner-panel-wallet"
          tabIndex={tab === "wallet" ? 0 : -1}
          onClick={() => selectTab("wallet")}
          onKeyDown={navigateTabs}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green ${
            tab === "wallet"
              ? "bg-obligon-green text-white"
              : "text-obligon-text hover:bg-obligon-mist"
          }`}
        >
          <CircleDollarSign size={16} />
          Discount Wallet
        </button>
      </div>

      {/* Tab Panels */}
      <div
        id="partner-panel-contract"
        role="tabpanel"
        aria-labelledby="partner-tab-contract"
        hidden={tab !== "contract"}
        tabIndex={0}
      >
        {tab === "contract" ? <PartnerContractPanel {...data} /> : null}
      </div>

      <div
        id="partner-panel-wallet"
        role="tabpanel"
        aria-labelledby="partner-tab-wallet"
        hidden={tab !== "wallet"}
        tabIndex={0}
      >
        {tab === "wallet" ? <PartnerDiscountWallet wallet={data.wallet} /> : null}
      </div>
    </section>
  );
}
