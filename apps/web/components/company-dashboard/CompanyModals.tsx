"use client";
import * as React from "react";
import { Check, Loader2, X } from "lucide-react";
import type { CompanyModalKey } from "@/lib/mock/company-data";
import { useToast } from "@/components/shared/Toast";
import { useDialogFocus } from "@/components/shared/useDialogFocus";
import { api, mutationsApi, publicApi, ApiError, saveBlob } from "@/lib/services";
import { companyApi, type FleetChoices, type CompanyWallet, type CompanyTicketMessages } from "@/lib/services/company";
import { useSession } from "@/components/shared/AuthContext";
import type { PaymentConfig } from "@/lib/services/types";
import { fundingQuote, fundingMoney, wholeNairaKobo, validFundingConfig } from "@/lib/customer-funding-quote";
import { companyAssignmentKnown, companyAssignmentPayload, companyAssignmentSelection, companyCardPayload, companyExportQuery } from "@/lib/company-input";
export type CompanyModalContext = {
  cardId?: string;
  vehicleId?: string;
  scope?: string;
  range?: string;
  vehicle?: string;
  driver?: string;
  driverId?: string;
  date?: string;
  ticketId?: string;
  reference?: string;
  maintenanceId?: string;
  status?: string;
};
export type CompanyOperationModalKey = CompanyModalKey | "walletFund" | "walletAllocate" | "posCode" | "supportConversation" | "maintenanceStatus";
type Props = {
  modal: Exclude<CompanyOperationModalKey, null>;
  context?: CompanyModalContext;
  onClose: () => void;
  onSaved: () => void;
};
const inputClass = "mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-[#dfe5ec] bg-white px-3 py-2 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green";
function Field({ label, children }: {
  label: string;
  children: React.ReactNode;
}) {
  return <label className="block min-w-0">

    <span className="text-xs font-extrabold text-obligon-text">{label}</span>

    {children}

  </label>;
}
const titles: Record<Exclude<CompanyModalKey, null>, string> = {
  vehicle: "Add Fleet Vehicle", driver: "Add Fleet Driver", assign: "Assign Card", newCard: "Issue Fuel Card", cardConfirm: "Manage Card",
  service: "Schedule Maintenance", roadside: "Request Roadside Assistance", teamMember: "Invite Team Member", supportTicket: "Raise Support Ticket", export: "Export Fleet Data", action: "Fleet Operations"
};
/** Mounted once per opening: draft state and completion messages never leak into another operation. */
function CompanyFleetModal({ modal, context = {}, onClose, onSaved }: Props & { modal: Exclude<CompanyModalKey, null> }) {
  const { success, error: toastError } = useToast();
  const dialogRef = React.useRef<HTMLElement>(null);
  const [submitting, setSubmitting] = React.useState(false);
  useDialogFocus(dialogRef, () => {
    if (!submitting)
      onClose();
  });
  const [completed, setCompleted] = React.useState<string | null>(null);
  const [choices, setChoices] = React.useState<FleetChoices>({ cards: [], vehicles: [], drivers: [], issuerCustomerConfigured: false });
  const [loadingChoices, setLoadingChoices] = React.useState(false);
  const [choicesError, setChoicesError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    make: "", model: "", plate: "", vehicleType: "pickup", fuelType: "Diesel", tankCapacity: "100", driverId: "", vehicleId: context.vehicleId ?? "", cardId: context.cardId ?? "",
    name: "", phone: "", licenseNo: "", label: "", dailyLimit: "", monthlyLimit: "", note: "", serviceType: "Engine Oil & Filter Service", scheduledDate: "",
    location: "", issueType: "Flat tyre", email: "", role: "dispatcher", subject: "", category: "general", message: "", priority: "normal",
    range: context.range ?? "30", scope: context.scope ?? "transactions", firstName: "", lastName: "", dob: "", bvn: "", address: "", city: "", state: "", postalCode: ""
  });
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const needsChoices = ["vehicle", "newCard", "assign", "cardConfirm", "service", "roadside"].includes(modal);
  React.useEffect(() => {
    if (!needsChoices)
      return;
    let active = true;
    setLoadingChoices(true);
    companyApi.choices().then(data => {
      if (active) {
        setChoices(data);
        setChoicesError(null);
        if (modal === "assign" || modal === "cardConfirm") {
          const selected = data.cards.find(card => context.cardId ? card.id === context.cardId : Boolean(context.vehicleId) && card.vehicle_id === context.vehicleId);
          if (selected)
            setForm(current => ({ ...current, ...companyAssignmentSelection(selected, context.vehicleId) }));
        }
      }
    })
      .catch(error => {
        if (active)
          setChoicesError(error instanceof Error ? error.message : "Could not load your fleet.");
      })
      .finally(() => {
        if (active)
          setLoadingChoices(false);
      });
    return () => { active = false; };
  }, [needsChoices, modal, context.cardId, context.vehicleId]);
  const selectedCard = choices.cards.find(card => card.id === form.cardId);
  const assignmentUnavailable = modal === "assign" && !companyAssignmentKnown(selectedCard);
  const field = (label: string, key: keyof typeof form, type = "text", required = true) => <Field label={label}>

    <input className={inputClass} type={type} autoComplete={key === "bvn" ? "off" : undefined} inputMode={key === "bvn" ? "numeric" : undefined} maxLength={key === "bvn" ? 11 : undefined} value={form[key]} required={required} onChange={e => update(key, e.target.value)} />

  </Field>;
  const vehicleSelect = (required = false) => <Field label="Vehicle">

    <select className={inputClass} value={form.vehicleId} required={required} onChange={e => update("vehicleId", e.target.value)}>

      <option value="">{required ? "Choose a vehicle" : "Unassigned"}</option>

      {choices.vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.model}</option>)}

    </select>

  </Field>;
  const driverSelect = () => <Field label="Driver">

    <select className={inputClass} value={form.driverId} onChange={e => update("driverId", e.target.value)}>

      <option value="">Unassigned</option>

      {choices.drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name} · {driver.phone || driver.licenseNo || `Driver ${driver.id.slice(-8)}`}</option>)}

    </select>

  </Field>;
  const cardSelect = () => <Field label="Card">

    <select className={inputClass} value={form.cardId} required onChange={e => { const card = choices.cards.find(candidate => candidate.id === e.target.value); setForm(current => ({ ...current, ...companyAssignmentSelection(card, context.vehicleId) })); }}>

      <option value="">Choose a card</option>

      {choices.cards.filter(card => ["active", "frozen"].includes(card.status)).map(card => <option key={card.id} value={card.id}>{card.label} · {card.masked_pan} · {card.status}</option>)}

    </select>

  </Field>;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || loadingChoices || choicesError || assignmentUnavailable)
      return;
    setSubmitting(true);
    try {
      let message = "Changes saved.";
      switch (modal) {
        case "vehicle":
          await mutationsApi.createVehicle({ plate: form.plate.trim(), model: `${form.make.trim()} ${form.model.trim()}`.trim(), vehicleType: form.vehicleType, fuelType: form.fuelType, tankCapacity: Number(form.tankCapacity), driverId: form.driverId || undefined });
          message = `Vehicle ${form.plate.trim()} added to the fleet.`;
          break;
        case "driver":
          await mutationsApi.createDriver({ name: form.name.trim(), phone: form.phone.trim(), licenseNo: form.licenseNo.trim() });
          message = `Driver ${form.name.trim()} registered.`;
          break;
        case "newCard": {
          const result = await mutationsApi.issueCompanyCard({ ...companyCardPayload(form), ...(!choices.issuerCustomerConfigured ? { holder: { firstName: form.firstName, lastName: form.lastName, dob: form.dob, bvn: form.bvn, address: form.address, city: form.city, state: form.state, postalCode: form.postalCode, phone: form.phone } } : {}) });
          message = `Fuel card issued${result.maskedPan ? ` (${result.maskedPan})` : ""}${form.vehicleId || form.driverId ? " with the selected assignment" : " without an assignment"}.`;
          break;
        }
        case "assign":
          if (!form.cardId)
            throw new Error("Choose a card.");
          await mutationsApi.assignCard(companyAssignmentPayload(selectedCard, form));
          message = "Card assignment saved.";
          break;
        case "cardConfirm":
          if (!selectedCard || !["active", "frozen"].includes(selectedCard.status))
            throw new Error("Choose an active or frozen card.");
          await mutationsApi.companyCardAction(selectedCard.id, selectedCard.status === "frozen" ? "unfreeze" : "freeze", { note: form.note });
          message = `Card ${selectedCard.masked_pan} ${selectedCard.status === "frozen" ? "unfrozen" : "frozen"}.`;
          break;
        case "service":
          await mutationsApi.bookMaintenance({ vehicleId: form.vehicleId, serviceType: form.serviceType, scheduledDate: form.scheduledDate, notes: form.note });
          message = "Maintenance schedule saved. Service provider confirmation is pending.";
          break;
        case "roadside": {
          const result = await mutationsApi.createRoadsideRequest({ vehicleId: form.vehicleId, location: form.location.trim(), issueType: form.issueType, priority: form.priority, details: [form.note, form.phone ? `Contact: ${form.phone}` : ""].filter(Boolean).join("\n") });
          message = `Request received (${result.status}). Request ID: ${result.requestId}. Assistance requires manual coordination. Use Support with this ID to confirm arrangements.`;
          break;
        }
        case "teamMember":
          await mutationsApi.inviteTeamMember({ email: form.email.trim(), role: form.role });
          message = `Invitation sent to ${form.email.trim()}.`;
          break;
        case "supportTicket": {
          const result = await mutationsApi.createCompanyTicket({ subject: form.subject.trim(), category: form.category, message: form.message.trim(), priority: form.priority });
          message = `Support ticket ${result.reference} submitted.`;
          break;
        }
        case "export": {
          const query = companyExportQuery({ ...context, range: form.range, scope: form.scope });
          const blob = await api.download(`/api/company/reports/export?${query}`);
          saveBlob(blob, `obligon-${form.scope}-${new Date().toISOString().slice(0, 10)}.csv`);
          success("Export downloaded.");
          onClose();
          return;
        }
        default: throw new Error("Choose an operation from the dashboard.");
      }
      setForm(current => ({ ...current, bvn: "", dob: "" }));
      setCompleted(message);
      success(message);
      onSaved();
    }
    catch (error) {
      toastError(error instanceof Error ? error.message : "Could not save. Please try again.");
    }
    finally {
      setSubmitting(false);
    }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#07162f]/60 p-3 sm:p-5 backdrop-blur-sm" onMouseDown={event => {
    if (event.target === event.currentTarget && !submitting)
      onClose();
  }}>


    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="company-dialog-title" className="max-h-[92dvh] w-full min-w-0 max-w-[620px] overflow-y-auto rounded-2xl bg-white shadow-hero outline-none">


      <header className="flex items-center justify-between gap-3 border-b border-[#e1e6ee] p-5">

        <h2 id="company-dialog-title" className="font-display text-xl font-extrabold text-obligon-navy">{titles[modal]}</h2>

        <button type="button" disabled={submitting} onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#f3f6fa]" aria-label="Close dialog">

          <X size={20} />

        </button>

      </header>


      {completed ? <div className="p-6 text-center">

        <Check size={32} className="mx-auto text-obligon-green" />

        <h3 className="mt-4 text-xl font-extrabold">Operation completed</h3>

        <p className="mt-2 text-sm text-obligon-text" role="status">{completed}</p>

        <button type="button" onClick={onClose} className="mt-6 min-h-11 w-full rounded-xl bg-obligon-green px-4 font-bold text-white">Done</button>

      </div> :
        <form onSubmit={submit} className="space-y-4 p-5 sm:p-7">


          {loadingChoices ? <p role="status" className="text-sm">Loading fleet choices…</p> : null}


          {choicesError ? <p role="alert" className="text-sm text-red-700">{choicesError} Close and reopen to retry.</p> : null}
          {modal === "assign" && selectedCard && assignmentUnavailable ? <p role="alert" className="text-sm text-red-700">Card assignment details are unavailable. Reopen this form before saving.</p> : null}


          <div className="grid min-w-0 gap-4 sm:grid-cols-2">


            {modal === "vehicle" ? <>
              {field("Make", "make")}
              {field("Model", "model")}
              {field("Plate number", "plate")}
              <Field label="Vehicle type">

                <select className={inputClass} value={form.vehicleType} onChange={e => update("vehicleType", e.target.value)}>

                  {["pickup", "truck", "van", "car", "bus"].map(type => <option key={type}>{type}</option>)}

                </select>

              </Field>
              <Field label="Fuel type">

                <select className={inputClass} value={form.fuelType} onChange={e => update("fuelType", e.target.value)}>

                  {["Diesel", "Petrol", "CNG", "Electric"].map(fuel => <option key={fuel}>{fuel}</option>)}

                </select>

              </Field>
              <Field label="Tank capacity (litres)">

                <input type="number" min="1" max="5000" required value={form.tankCapacity} onChange={e => update("tankCapacity", e.target.value)} className={inputClass} />

              </Field>
              {driverSelect()}
            </> : null}


            {modal === "driver" ? <>
              {field("Full name", "name")}
              {field("Phone number", "phone", "tel")}
              {field("Driving licence number", "licenseNo", "text", false)}
            </> : null}


            {modal === "newCard" ? <>
              {field("Card label", "label")}
              {vehicleSelect()}
              {driverSelect()}
              {field("Daily spend limit (₦)", "dailyLimit")}
              {field("Monthly spend limit (₦)", "monthlyLimit")}
              {choices.issuerCustomerConfigured ? <p className="text-sm text-obligon-text sm:col-span-2">Your existing issuer billing contact is reused for this fleet card. Vehicle and driver assignments control who operates it.</p> : null}
              {!choices.issuerCustomerConfigured && !loadingChoices ? <>
                <h3 className="mt-2 font-bold sm:col-span-2">First card: issuer identity setup</h3>
                <p className="text-sm text-obligon-text sm:col-span-2">Enter the authorized card holder’s identity. BVN is sent to the card issuer for verification and is not stored by Obligon. Issuance depends on issuer approval.</p>
                {field("Card holder first name", "firstName")}
                {field("Card holder last name", "lastName")}
                {field("Date of birth", "dob", "date")}
                {field("BVN", "bvn", "password")}
                {field("Contact phone", "phone", "tel")}
                {field("Residential address", "address")}
                {field("City", "city")}
                {field("State", "state")}
                {field("Postal code", "postalCode")}
              </> : null}
            </> : null}


            {modal === "assign" ? <>
              {cardSelect()}
              {vehicleSelect()}
              {driverSelect()}
              <p className="text-sm text-obligon-text sm:col-span-2">Choosing Unassigned clears that assignment. A vehicle can have one assigned card.</p>
            </> : null}


            {modal === "cardConfirm" ? <>
              {cardSelect()}
              {field("Reason (optional)", "note", "text", false)}
              <p className="text-sm text-obligon-text sm:col-span-2">

                {selectedCard?.status === "frozen" ? "Unfreeze the selected card to allow spending again." : "Freeze the selected card to stop spending until it is unfrozen."}

              </p>
            </> : null}


            {modal === "service" ? <>
              {vehicleSelect(true)}
              {field("Service type", "serviceType")}
              {field("Scheduled date", "scheduledDate", "date")}
              {field("Notes (optional)", "note", "text", false)}
            </> : null}


            {modal === "roadside" ? <>
              {vehicleSelect(true)}
              {field("Breakdown location", "location")}
              {field("Issue", "issueType")}
              {field("Contact phone", "phone", "tel")}
              <Field label="Priority">

                <select className={inputClass} value={form.priority} onChange={e => update("priority", e.target.value)}>

                  <option value="normal">Normal</option>

                  <option value="high">High</option>

                </select>

              </Field>
              {field("Details (optional)", "note", "text", false)}
            </> : null}


            {modal === "teamMember" ? <>
              {field("Email address", "email", "email")}
              <Field label="Access role">

                <select className={inputClass} value={form.role} onChange={e => update("role", e.target.value)}>

                  {["viewer", "dispatcher", "manager", "admin"].map(role => <option key={role} value={role}>{role}</option>)}

                </select>

              </Field>
            </> : null}


            {modal === "supportTicket" ? <>
              {field("Subject", "subject")}
              <Field label="Category">

                <select className={inputClass} value={form.category} onChange={e => update("category", e.target.value)}>

                  {["general", "billing", "card", "fleet"].map(category => <option key={category}>{category}</option>)}

                </select>

              </Field>
              <Field label="Message">

                <textarea required rows={4} className={inputClass} value={form.message} onChange={e => update("message", e.target.value)} />

              </Field>
              <Field label="Priority">

                <select className={inputClass} value={form.priority} onChange={e => update("priority", e.target.value)}>

                  <option value="normal">Normal</option>

                  <option value="high">High</option>

                </select>

              </Field>
            </> : null}


            {modal === "export" ? <>
              <Field label="Date range">

                <select className={inputClass} value={form.range} onChange={e => update("range", e.target.value)}>

                  {[7, 30, 90, 365].map(days => <option key={days} value={days}>Last {days} days</option>)}

                </select>

              </Field>
              <Field label="Data scope">

                <select className={inputClass} value={form.scope} onChange={e => update("scope", e.target.value)}>

                  <option value="transactions">Fleet transactions</option>

                  <option value="vehicles">Current fleet vehicles</option>

                  <option value="invoices">Invoices</option>

                  <option value="maintenance">Maintenance schedules</option>

                </select>

              </Field>
              <p className="text-sm text-obligon-text sm:col-span-2">CSV spreadsheet. Vehicle exports include the current fleet; other scopes use the selected period.{form.scope === "transactions" && (context.date || context.vehicle || context.driver || context.driverId) ? " Current transaction filters also apply; a selected date takes precedence over the period." : ""}</p>
            </> : null}


          </div>


          <div className="flex flex-wrap justify-end gap-3 border-t border-[#e1e6ee] pt-4">

            <button type="button" disabled={submitting} onClick={onClose} className="min-h-11 rounded-xl border border-[#dfe5ec] px-5 font-bold">Cancel</button>

            <button type="submit" disabled={submitting || loadingChoices || Boolean(choicesError) || assignmentUnavailable} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-obligon-green px-5 font-bold text-white disabled:opacity-50">

              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}

              {submitting ? "Saving…" : modal === "export" ? "Download CSV" : modal === "cardConfirm" ? selectedCard?.status === "frozen" ? "Unfreeze card" : "Freeze card" : "Save"}

            </button>

          </div>


        </form>}


    </section>


  </div>;
}

const operationButton = "inline-flex min-h-11 items-center justify-center rounded-xl bg-obligon-green px-5 font-bold text-white disabled:opacity-50";
function CompanyOperationDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = React.useRef<HTMLElement>(null);
  useDialogFocus(ref, () => { if (!busy) onClose(); });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#07162f]/60 p-3 sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="company-operation-title" className="max-h-[92dvh] w-full min-w-0 max-w-[620px] overflow-y-auto rounded-2xl bg-white shadow-hero">
      <header className="flex items-center justify-between gap-3 border-b border-[#e1e6ee] p-5"><h2 id="company-operation-title" className="font-display text-xl font-extrabold text-obligon-navy">{title}</h2><button type="button" disabled={busy} onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#f3f6fa]" aria-label="Close dialog"><X size={20} /></button></header>
      <div className="space-y-4 p-5 sm:p-7">{children}</div>
    </section>
  </div>;
}
function operationError(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }
export function companyTopupStorageKey(userId: string) { return `company-topup:${userId}`; }

function CompanyWalletFund({ onClose }: Props) {
  const { user } = useSession();
  const [amount, setAmount] = React.useState("1000");
  const [method, setMethod] = React.useState("Card / Bank");
  const [config, setConfig] = React.useState<PaymentConfig | null>(null);
  const [settingsError, setSettingsError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const submitting = React.useRef(false);
  React.useEffect(() => {
    let active = true; setConfig(null); setSettingsError(null);
    publicApi.getPaymentConfig().then(data => { if (active) { if (!validFundingConfig(data)) throw new Error("Payment settings are unavailable."); setConfig(data); } }).catch(err => { if (active) setSettingsError(operationError(err, "Could not load payment settings.")); });
    return () => { active = false; };
  }, [attempt]);
  let quote: ReturnType<typeof fundingQuote> | null = null, validation: string | null = null;
  if (config) { try { quote = fundingQuote(amount, config); } catch (err) { validation = operationError(err, "Enter whole naira."); } }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!quote || !user || submitting.current) return;
    submitting.current = true; setBusy(true); setError(null);
    let redirecting = false;
    try {
      const result = await mutationsApi.companyTopUpWallet(quote.baseKobo, method, quote.totalKobo);
      if (result.simulated || !result.reference || !result.paymentUrl || result.amountKobo !== quote.baseKobo || result.totalKobo !== quote.totalKobo) throw new Error("Payment checkout was not confirmed for this quote. No funding is confirmed. Retry after reviewing payment settings.");
      const url = new URL(result.paymentUrl);
      if (url.protocol !== "https:") throw new Error("The payment checkout URL is unavailable. Contact Support with your reference.");
      sessionStorage.setItem(companyTopupStorageKey(user.id), result.reference);
      window.location.assign(url.toString());
      redirecting = true;
    } catch (err) {
      setError(operationError(err, "Could not start company funding."));
      if (err instanceof ApiError && err.status === 409) setAttempt(value => value + 1);
    } finally { if (!redirecting) { submitting.current = false; setBusy(false); } }
  }
  return <CompanyOperationDialog title="Fund company wallet" busy={busy} onClose={onClose}>
    <p className="text-sm text-obligon-text">Fuel cards spend from this company wallet. Checkout is pending until the payment provider confirms it.</p>
    {settingsError ? <p role="alert" className="text-sm text-red-700">{settingsError} <button type="button" className="min-h-11 underline" onClick={() => setAttempt(value => value + 1)}>Retry payment settings</button></p> : !config ? <p role="status">Loading payment settings…</p> : null}
    <form onSubmit={submit} className="space-y-4">
      <Field label="Amount to credit (₦, whole naira)"><input type="text" inputMode="decimal" required disabled={busy} value={amount} onChange={event => setAmount(event.target.value)} className={inputClass} /></Field>
      <Field label="Payment method"><select value={method} onChange={event => setMethod(event.target.value)} disabled={busy} className={inputClass}><option>Card / Bank</option><option>Direct Bank Transfer</option><option>USSD</option></select></Field>
      {validation ? <p role="alert" className="text-sm text-red-700">{validation}</p> : null}
      {quote ? <dl className="space-y-2 rounded-xl bg-[#f2f6fa] p-4 text-sm"><div className="flex justify-between gap-3"><dt>Company wallet credit</dt><dd>{fundingMoney(quote.baseKobo)}</dd></div><div className="flex justify-between gap-3"><dt>Fee {quote.bearer === "platform" ? "paid by Obligon" : "including whole-naira rounding"}</dt><dd>{fundingMoney(quote.feeKobo)}</dd></div><div className="flex justify-between gap-3 font-bold"><dt>Total payment</dt><dd>{fundingMoney(quote.totalKobo)}</dd></div></dl> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={busy || !quote || !user} className={operationButton}>{busy ? "Opening payment…" : `Continue to payment${quote ? ` · ${fundingMoney(quote.totalKobo)}` : ""}`}</button>
    </form>
  </CompanyOperationDialog>;
}

type PendingAllocation = { organizationId: string; toUserId: string; amountKobo: number; note: string; idempotencyKey: string };
function CompanyWalletAllocate({ onClose, onSaved }: Props) {
  const { user } = useSession();
  const storageKey = `company-allocation:${user?.id ?? "unavailable"}:${user?.organizationId ?? "unavailable"}`;
  const [pending, setPending] = React.useState<PendingAllocation | null>(() => {
    if (typeof window === "undefined") return null;
    try { const data = JSON.parse(sessionStorage.getItem(storageKey) ?? "null"); return data && data.organizationId === user?.organizationId && typeof data.toUserId === "string" && Number.isSafeInteger(data.amountKobo) && data.amountKobo > 0 && typeof data.note === "string" && typeof data.idempotencyKey === "string" ? data : null; } catch { return null; }
  });
  const [member, setMember] = React.useState(pending?.toUserId ?? "");
  const [amount, setAmount] = React.useState(pending ? String(pending.amountKobo / 100) : "");
  const [note, setNote] = React.useState(pending?.note ?? "");
  const [wallet, setWallet] = React.useState<CompanyWallet | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [completed, setCompleted] = React.useState<string | null>(null);
  const submitting = React.useRef(false);
  React.useEffect(() => {
    let active = true; setLoadError(null); setWallet(null);
    companyApi.wallet().then(data => { if (active) setWallet(data); }).catch(err => { if (active) setLoadError(operationError(err, "Could not load authorized members.")); });
    return () => { active = false; };
  }, [attempt]);
  const kobo = wholeNairaKobo(amount);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (submitting.current || !wallet || !user?.organizationId || !kobo || !wallet.members.some(value => value.userId === member)) return;
    submitting.current = true; setBusy(true); setError(null);
    try {
      const payload = pending ?? { organizationId:user.organizationId, toUserId: member, amountKobo: kobo, note: note.trim(), idempotencyKey: crypto.randomUUID() };
      sessionStorage.setItem(storageKey, JSON.stringify(payload)); setPending(payload);
      const result = await mutationsApi.companyAllocateWallet(payload);
      sessionStorage.removeItem(storageKey); setPending(null); setCompleted(`Allocation confirmed. Reference: ${result.reference}`); onSaved();
    } catch (err) {
      setError(operationError(err, "Allocation is unconfirmed. Retry this request to check the same allocation."));
      if (err instanceof ApiError && [400, 403, 404].includes(err.status)) { sessionStorage.removeItem(storageKey); setPending(null); }
    } finally { submitting.current = false; setBusy(false); }
  }
  return <CompanyOperationDialog title="Allocate to a member wallet" busy={busy} onClose={onClose}>
    {completed ? <><p role="status">{completed}</p><button type="button" className={operationButton} onClick={onClose}>Done</button></> : <>
      <p className="text-sm text-obligon-text">This transfers company funds to an active member’s personal wallet. Fleet cards continue to use the company wallet.</p>
      {loadError ? <p role="alert" className="text-sm text-red-700">{loadError} <button type="button" className="min-h-11 underline" onClick={() => setAttempt(value => value + 1)}>Retry members</button></p> : !wallet ? <p role="status">Loading wallet and members…</p> : <p className="text-sm">Company balance: {wallet.company.balanceLabel}</p>}
      {pending ? <p role="status" className="text-sm">An allocation is awaiting confirmation. Retry preserves the same member, amount, and request key.</p> : null}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Member"><select required disabled={busy || Boolean(pending)} className={inputClass} value={member} onChange={event => setMember(event.target.value)}><option value="">Choose an active member</option>{wallet?.members.map(value => <option key={value.userId} value={value.userId}>{value.name} · {value.email}</option>)}</select></Field>
        <Field label="Amount (₦, whole naira)"><input required disabled={busy || Boolean(pending)} type="text" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} className={inputClass} /></Field>
        <Field label="Note (optional)"><input maxLength={140} disabled={busy || Boolean(pending)} value={note} onChange={event => setNote(event.target.value)} className={inputClass} /></Field>
        {amount && !kobo ? <p role="alert" className="text-sm text-red-700">Enter whole naira up to ₦5,000,000.</p> : null}
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" disabled={busy || !wallet || !kobo || !wallet.members.some(value => value.userId === member)} className={operationButton}>{busy ? "Checking allocation…" : pending ? "Retry same allocation" : "Confirm allocation"}</button>
      </form>
    </>}
  </CompanyOperationDialog>;
}

function CompanyPosCode({ context = {}, onClose }: Props) {
  const [cards, setCards] = React.useState<FleetChoices["cards"]>([]);
  const [cardId, setCardId] = React.useState(context.cardId ?? "");
  const [result, setResult] = React.useState<{ code: string; expiresAt: string; maskedPan: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [attempt, setAttempt] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const submitting = React.useRef(false);
  React.useEffect(() => {
    let active = true; setLoading(true); setError(null);
    companyApi.choices().then(data => { if (active) setCards(data.cards.filter(card => card.status === "active")); }).catch(err => { if (active) setError(operationError(err, "Could not load active fuel cards.")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (submitting.current || !cards.some(card => card.id === cardId)) return;
    submitting.current = true; setBusy(true); setError(null); setResult(null);
    try {
      const code = await mutationsApi.companyCardPosCode(cardId);
      if (!/^\d{6}$/.test(code.code) || !Number.isFinite(Date.parse(code.expiresAt))) throw new Error("The fuel code response is incomplete. Retry before sharing a code.");
      setResult(code);
    } catch (err) { setError(operationError(err, "Could not issue a fuel code.")); } finally { submitting.current = false; setBusy(false); }
  }
  return <CompanyOperationDialog title="Single-use fleet fuel code" busy={busy} onClose={onClose}>
    <p className="text-sm text-obligon-text">Share this code only with the driver or attendant for this fuel purchase. It debits the company wallet after the partner authorizes the sale and respects the card’s spend limits.</p>
    {loading ? <p role="status">Loading active cards…</p> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error} <button type="button" className="min-h-11 underline" onClick={() => setAttempt(value => value + 1)}>Retry card choices</button></p> : null}
    {result ? <div className="space-y-3 rounded-xl bg-[#f2f6fa] p-5"><p>{result.maskedPan}</p><p role="status" className="font-mono text-4xl font-bold tracking-widest">{result.code}</p><p className="text-sm">Expires: <time dateTime={result.expiresAt}>{new Date(result.expiresAt).toLocaleString("en-NG")}</time></p><p className="text-sm font-bold">Single-use. Generating another code replaces this one. A code alone does not confirm payment or fuel delivery.</p><button type="button" onClick={onClose} className={operationButton}>Done</button></div> : <form onSubmit={submit} className="space-y-4"><Field label="Active fuel card"><select required value={cardId} disabled={busy || loading} onChange={event => setCardId(event.target.value)} className={inputClass}><option value="">Choose a card</option>{cards.map(card => <option key={card.id} value={card.id}>{card.label} · {card.masked_pan}</option>)}</select></Field><button type="submit" disabled={busy || loading || !cards.some(card => card.id === cardId)} className={operationButton}>{busy ? "Issuing code…" : "Generate single-use code"}</button></form>}
  </CompanyOperationDialog>;
}

function CompanySupportConversation({ context = {}, onClose, onSaved }: Props) {
  const [thread, setThread] = React.useState<CompanyTicketMessages | null>(null);
  const [body, setBody] = React.useState("");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [replyError, setReplyError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const submitting = React.useRef(false);
  React.useEffect(() => {
    let active = true; setLoading(true); setLoadError(null);
    if (!context.ticketId) { setLoadError("Choose a support ticket."); setLoading(false); return; }
    companyApi.ticketMessages(context.ticketId).then(data => { if (active) setThread(data); }).catch(err => { if (active) setLoadError(operationError(err, "Could not load this conversation.")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [context.ticketId, attempt]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (submitting.current || !context.ticketId || !body.trim() || !thread || loading || loadError) return;
    submitting.current = true; setBusy(true); setReplyError(null);
    try { await mutationsApi.replyCompanyTicket(context.ticketId, body.trim()); setBody(""); setAttempt(value => value + 1); onSaved(); } catch (err) { setReplyError(operationError(err, "Could not send your reply.")); } finally { submitting.current = false; setBusy(false); }
  }
  return <CompanyOperationDialog title={`Support conversation${context.reference ? ` · ${context.reference}` : ""}`} busy={busy} onClose={onClose}>
    {loading ? <p role="status">Loading conversation…</p> : null}
    {loadError ? <p role="alert" className="text-sm text-red-700">{loadError} <button type="button" className="min-h-11 underline" onClick={() => setAttempt(value => value + 1)}>Retry conversation</button></p> : null}
    {thread ? <><p className="text-sm">Status: <span className="font-bold">{thread.status}</span>{thread.status === "closed" ? " · A reply reopens this ticket." : ""}</p><ol className="space-y-3">{thread.messages.map(message => <li key={message.id} className="rounded-xl border border-[#dfe5ec] p-4"><p className="text-xs font-bold">{message.sender} · {message.time}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body}</p></li>)}</ol><form onSubmit={submit} className="space-y-3"><Field label="Reply"><textarea required rows={4} maxLength={5000} disabled={busy} value={body} onChange={event => setBody(event.target.value)} className={inputClass} /></Field>{replyError ? <p role="alert" className="text-sm text-red-700">{replyError}</p> : null}<button type="submit" disabled={busy || loading || Boolean(loadError) || !body.trim()} className={operationButton}>{busy ? "Sending…" : "Send reply"}</button></form></> : null}
  </CompanyOperationDialog>;
}

function CompanyMaintenanceStatus({ context = {}, onClose, onSaved }: Props) {
  const [status, setStatus] = React.useState(context.status ?? "scheduled");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submitting = React.useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!context.maintenanceId || submitting.current) return;
    submitting.current = true; setBusy(true); setError(null);
    try { await mutationsApi.updateMaintenance(context.maintenanceId, status); onSaved(); onClose(); } catch (err) { setError(operationError(err, "Could not update this maintenance record.")); } finally { submitting.current = false; setBusy(false); }
  }
  return <CompanyOperationDialog title="Update maintenance record" busy={busy} onClose={onClose}><p className="text-sm text-obligon-text">Record only a status confirmed with your service provider. Saving a schedule does not book or dispatch a provider automatically.</p><form onSubmit={submit} className="space-y-4"><Field label="Confirmed status"><select value={status} onChange={event => setStatus(event.target.value)} disabled={busy} className={inputClass}>{context.status === "overdue" ? <option value="overdue" disabled>Overdue (recorded)</option> : null}{["scheduled", "in_progress", "completed", "cancelled"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>{error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}<button type="submit" disabled={busy || !context.maintenanceId || !["scheduled", "in_progress", "completed", "cancelled"].includes(status)} className={operationButton}>{busy ? "Saving…" : "Save confirmed status"}</button></form></CompanyOperationDialog>;
}

export function CompanyModals(props: Props) {
  switch (props.modal) {
    case "walletFund": return <CompanyWalletFund {...props} />;
    case "walletAllocate": return <CompanyWalletAllocate {...props} />;
    case "posCode": return <CompanyPosCode {...props} />;
    case "supportConversation": return <CompanySupportConversation {...props} />;
    case "maintenanceStatus": return <CompanyMaintenanceStatus {...props} />;
    default: return <CompanyFleetModal {...props} modal={props.modal} />;
  }
}
