"use client";
import * as React from "react";
import { Check, Loader2, X } from "lucide-react";
import type { CompanyModalKey } from "@/lib/mock/company-data";
import { useToast } from "@/components/shared/Toast";
import { useDialogFocus } from "@/components/shared/useDialogFocus";
import { api, mutationsApi, saveBlob } from "@/lib/services";
import { companyApi, type FleetChoices } from "@/lib/services/company";
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
};
type Props = {
  modal: Exclude<CompanyModalKey, null>;
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
export function CompanyModals({ modal, context = {}, onClose, onSaved }: Props) {
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
          message = `Request received (${result.status}). Dispatch and arrival estimates will appear once confirmed.`;
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
