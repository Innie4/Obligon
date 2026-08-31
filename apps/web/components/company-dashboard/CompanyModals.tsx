"use client";

import * as React from "react";
import { AlertTriangle, Car, CheckCircle2, CreditCard, Download, Loader2, UserPlus, Wrench, X, ShieldCheck, Snowflake, FileText, ChevronDown, Check } from "lucide-react";
import type { CompanyModalKey } from "@/lib/mock/company-data";
import { useToast } from "@/components/shared/Toast";

type CompanyModalsProps = {
  modal: CompanyModalKey;
  onClose: () => void;
  onVehicleAdded?: (v: { make: string; model: string; plate: string; card: string }) => void;
  onDriverAdded?: (d: { name: string; id: string; phone: string; license: string }) => void;
  onCardIssued?: (c: { cardNumber: string; driver: string; limit: string }) => void;
  onMaintenanceScheduled?: (m: { vehicle: string; service: string; date: string }) => void;
  onRoadsideRequested?: (r: { vehicle: string; location: string; issue: string }) => void;
};

export function CompanyModals({
  modal,
  onClose,
  onVehicleAdded,
  onDriverAdded,
  onCardIssued,
  onMaintenanceScheduled,
  onRoadsideRequested
}: CompanyModalsProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [submitting, setSubmitting] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // Form states
  const [vehicleForm, setVehicleForm] = React.useState({
    make: "Toyota",
    model: "Hilux Pickup",
    plate: "LND-234-XY",
    year: "2023",
    fuelType: "AGO Diesel",
    card: "Card #4092",
    status: "Active"
  });

  const [driverForm, setDriverForm] = React.useState({
    name: "Emeka Okafor",
    employeeId: "DRV-104",
    phone: "+234 802 987 6543",
    licenseNumber: "LAG-2049281-B",
    expiry: "2027-11-30",
    status: "Active"
  });

  const [assignForm, setAssignForm] = React.useState({
    driver: "Emeka Okafor (DRV-104)",
    vehicle: "Toyota Hilux (LND-234-XY)",
    card: "Fuelvista Card •••• 4092",
    dailyLimit: "50,000"
  });

  const [cardForm, setCardForm] = React.useState({
    type: "Physical Fuel Card",
    driver: "Emeka Okafor",
    vehicle: "Toyota Hilux (LND-234-XY)",
    dailyLimit: "75,000",
    monthlyLimit: "1,500,000"
  });

  const [maintenanceForm, setMaintenanceForm] = React.useState({
    vehicle: "LND-234-XY (Toyota Hilux)",
    service: "Engine Oil & Filter Service",
    date: "2026-09-15",
    priority: "Routine",
    technician: "Ade Auto Care (Lekki Hub)"
  });

  const [roadsideForm, setRoadsideForm] = React.useState({
    vehicle: "LND-234-XY (Unit #4092)",
    location: "Lekki-Epe Expressway, km 24 (Near Chevron Toll)",
    direction: "Eastbound towards Ajah",
    issue: "Flat Tyre & Wheel Hub Dislodged",
    priority: "Urgent",
    contact: "+234 802 987 6543"
  });

  const [teamForm, setTeamForm] = React.useState({
    name: "Chidinma Eze",
    email: "chidinma@apexlogistics.ng",
    role: "Fleet Dispatcher",
    department: "Logistics Operations"
  });

  const [exportForm, setExportForm] = React.useState({
    range: "Current Billing Cycle (Aug 2026)",
    format: "CSV / Excel Spreadsheet (.xlsx)",
    domain: "All Fleet Transactions & Receipts"
  });

  if (!modal) return null;

  async function handleVehicleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleForm.make || !vehicleForm.plate) {
      toastError("Please fill out vehicle make and license plate.");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    onVehicleAdded?.({ make: vehicleForm.make, model: vehicleForm.model, plate: vehicleForm.plate, card: vehicleForm.card });
    setSuccessMsg(`Vehicle ${vehicleForm.plate} registered successfully into fleet.`);
    toastSuccess(`Vehicle ${vehicleForm.plate} added.`);
  }

  async function handleDriverSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!driverForm.name || !driverForm.phone) {
      toastError("Driver name and phone number are required.");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    onDriverAdded?.({ name: driverForm.name, id: driverForm.employeeId, phone: driverForm.phone, license: driverForm.licenseNumber });
    setSuccessMsg(`Driver ${driverForm.name} added to roster.`);
    toastSuccess(`Driver ${driverForm.name} registered.`);
  }

  async function handleCardSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    setSubmitting(false);
    const cardNum = `•••• •••• •••• ${Math.floor(1000 + Math.random() * 8999)}`;
    onCardIssued?.({ cardNumber: cardNum, driver: cardForm.driver, limit: `₦${cardForm.dailyLimit}` });
    setSuccessMsg(`New ${cardForm.type} (${cardNum}) issued and assigned.`);
    toastSuccess("Fuelvista Card issued successfully.");
  }

  async function handleMaintenanceSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    onMaintenanceScheduled?.({ vehicle: maintenanceForm.vehicle, service: maintenanceForm.service, date: maintenanceForm.date });
    setSuccessMsg(`Maintenance booking confirmed for ${maintenanceForm.vehicle} on ${maintenanceForm.date}.`);
    toastSuccess("Service scheduled.");
  }

  async function handleRoadsideSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    onRoadsideRequested?.({ vehicle: roadsideForm.vehicle, location: roadsideForm.location, issue: roadsideForm.issue });
    setSuccessMsg(`Emergency dispatch received for ${roadsideForm.vehicle}. Technician en route.`);
    toastSuccess("Roadside dispatch initiated.");
  }

  async function handleExportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    const content = `Obligon LTD Company Export\nDate Range: ${exportForm.range}\nScope: ${exportForm.domain}\nGenerated: ${new Date().toLocaleString()}\n\nUnit,Plate,Driver,Station,Fuel,Volume,Amount,Status\n#4092,LND-234-XY,John Doe,TotalEnergies Lekki,Diesel,85L,₦87,125,APPROVED\n#4093,KJA-901-AZ,Jane Smith,Enyo Victoria Island,PMS,60L,₦61,500,APPROVED\n#4094,EKY-442-BR,Mike Johnson,Mobil Abuja,Diesel,120L,₦123,000,APPROVED`;
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Obligon_Fleet_Export_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toastSuccess("Export file downloaded.");
    onClose();
  }

  async function handleTeamSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamForm.email) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setSuccessMsg(`Invitation sent to ${teamForm.email} as ${teamForm.role}.`);
    toastSuccess(`Invited ${teamForm.name}`);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#07162f]/60 px-5 backdrop-blur-sm" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-[620px] overflow-y-auto rounded-2xl bg-white shadow-hero outline-none"
      >
        <div className="flex items-center justify-between border-b border-[#e1e6ee] p-6">
          <p className="font-display text-xl font-extrabold text-obligon-navy">Fleet Operations</p>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg bg-[#f3f6fa] text-obligon-navy hover:bg-[#e2e8f0] transition"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {successMsg ? (
          <div className="p-8 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e8fbd7] text-obligon-green">
              <Check size={32} />
            </span>
            <h2 className="mt-5 font-display text-2xl font-extrabold text-obligon-navy">Operation Completed</h2>
            <p className="mt-2 text-sm text-obligon-text">{successMsg}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 h-12 w-full rounded-xl bg-obligon-green font-extrabold text-white shadow-green"
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            {/* Modal Content Switch */}
            {modal === "vehicle" && (
              <form onSubmit={handleVehicleSubmit} className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-[#e8fbd7] text-obligon-green">
                    <Car size={22} />
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Add Fleet Vehicle</h2>
                    <p className="text-xs text-obligon-text">Register a new asset and link a Fuelvista card.</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 pt-2">
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Make</span>
                    <input
                      value={vehicleForm.make}
                      onChange={(e) => setVehicleForm((prev) => ({ ...prev, make: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Model</span>
                    <input
                      value={vehicleForm.model}
                      onChange={(e) => setVehicleForm((prev) => ({ ...prev, model: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">License Plate Number</span>
                    <input
                      value={vehicleForm.plate}
                      onChange={(e) => setVehicleForm((prev) => ({ ...prev, plate: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Fuel Type</span>
                    <select
                      value={vehicleForm.fuelType}
                      onChange={(e) => setVehicleForm((prev) => ({ ...prev, fuelType: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-3 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                    >
                      <option>AGO Diesel</option>
                      <option>PMS Petrol</option>
                      <option>CNG Gas</option>
                      <option>Electric (EV)</option>
                    </select>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#e1e6ee]">
                  <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl border border-[#07162f] text-sm font-extrabold">
                    Cancel
                  </button>
                  <button disabled={submitting} type="submit" className="h-11 px-6 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green flex items-center gap-2">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : "Save Vehicle"}
                  </button>
                </div>
              </form>
            )}

            {modal === "driver" && (
              <form onSubmit={handleDriverSubmit} className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-[#e8fbd7] text-obligon-green">
                    <UserPlus size={22} />
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Add Fleet Driver</h2>
                    <p className="text-xs text-obligon-text">Register an authorized vehicle operator.</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 pt-2">
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Full Name</span>
                    <input
                      value={driverForm.name}
                      onChange={(e) => setDriverForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Employee / Driver ID</span>
                    <input
                      value={driverForm.employeeId}
                      onChange={(e) => setDriverForm((prev) => ({ ...prev, employeeId: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Phone Number</span>
                    <input
                      value={driverForm.phone}
                      onChange={(e) => setDriverForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Driver's License Number</span>
                    <input
                      value={driverForm.licenseNumber}
                      onChange={(e) => setDriverForm((prev) => ({ ...prev, licenseNumber: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">License Expiry Date</span>
                    <input
                      type="date"
                      value={driverForm.expiry}
                      onChange={(e) => setDriverForm((prev) => ({ ...prev, expiry: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#e1e6ee]">
                  <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl border border-[#07162f] text-sm font-extrabold">
                    Cancel
                  </button>
                  <button disabled={submitting} type="submit" className="h-11 px-6 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green flex items-center gap-2">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : "Save Driver"}
                  </button>
                </div>
              </form>
            )}

            {modal === "newCard" && (
              <form onSubmit={handleCardSubmit} className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-[#e8fbd7] text-obligon-green">
                    <CreditCard size={22} />
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Issue Fuelvista Card</h2>
                    <p className="text-xs text-obligon-text">Assign a new payment instrument with strict spend limits.</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#061958] p-5 text-white my-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold tracking-wider text-obligon-lime">FUELVISTA ENTERPRISE</span>
                    <span className="text-xs text-white/60">ACTIVE</span>
                  </div>
                  <p className="mt-4 font-mono text-xl tracking-[4px]">•••• •••• •••• 4092</p>
                  <p className="mt-2 text-xs text-white/70">Assigned: {cardForm.driver}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Card Type</span>
                    <select
                      value={cardForm.type}
                      onChange={(e) => setCardForm((prev) => ({ ...prev, type: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-3 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                    >
                      <option>Physical Fuel Card</option>
                      <option>Virtual Fleet Card (NFC)</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Assign to Driver</span>
                    <input
                      value={cardForm.driver}
                      onChange={(e) => setCardForm((prev) => ({ ...prev, driver: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Daily Spend Limit (₦)</span>
                    <input
                      value={cardForm.dailyLimit}
                      onChange={(e) => setCardForm((prev) => ({ ...prev, dailyLimit: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Monthly Spend Limit (₦)</span>
                    <input
                      value={cardForm.monthlyLimit}
                      onChange={(e) => setCardForm((prev) => ({ ...prev, monthlyLimit: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#e1e6ee]">
                  <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl border border-[#07162f] text-sm font-extrabold">
                    Cancel
                  </button>
                  <button disabled={submitting} type="submit" className="h-11 px-6 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green flex items-center gap-2">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : "Issue Card"}
                  </button>
                </div>
              </form>
            )}

            {modal === "service" && (
              <form onSubmit={handleMaintenanceSubmit} className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-[#e8fbd7] text-obligon-green">
                    <Wrench size={22} />
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Schedule Maintenance</h2>
                    <p className="text-xs text-obligon-text">Book scheduled service at verified partner workshops.</p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Target Vehicle</span>
                    <input
                      value={maintenanceForm.vehicle}
                      onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, vehicle: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-extrabold uppercase text-obligon-text">Service Type</span>
                      <select
                        value={maintenanceForm.service}
                        onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, service: e.target.value }))}
                        className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-3 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      >
                        <option>Engine Oil &amp; Filter Service</option>
                        <option>Brake Pad &amp; Rotor Inspection</option>
                        <option>Tyre Rotation &amp; Alignment</option>
                        <option>Full Electrical Diagnostics</option>
                        <option>Comprehensive Preventive PM</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-extrabold uppercase text-obligon-text">Scheduled Date</span>
                      <input
                        type="date"
                        value={maintenanceForm.date}
                        onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, date: e.target.value }))}
                        className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                        required
                      />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#e1e6ee]">
                  <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl border border-[#07162f] text-sm font-extrabold">
                    Cancel
                  </button>
                  <button disabled={submitting} type="submit" className="h-11 px-6 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green flex items-center gap-2">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : "Confirm Schedule"}
                  </button>
                </div>
              </form>
            )}

            {modal === "roadside" && (
              <form onSubmit={handleRoadsideSubmit} className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-[#ffe8e8] text-[#c1121f]">
                    <AlertTriangle size={22} />
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Roadside Emergency Dispatch</h2>
                    <p className="text-xs text-obligon-text">Immediate priority assistance for broken down vehicles.</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Vehicle Unit</span>
                    <input
                      value={roadsideForm.vehicle}
                      onChange={(e) => setRoadsideForm((prev) => ({ ...prev, vehicle: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Precise Breakdown Location</span>
                    <input
                      value={roadsideForm.location}
                      onChange={(e) => setRoadsideForm((prev) => ({ ...prev, location: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-extrabold uppercase text-obligon-text">Issue Category</span>
                      <select
                        value={roadsideForm.issue}
                        onChange={(e) => setRoadsideForm((prev) => ({ ...prev, issue: e.target.value }))}
                        className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-3 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      >
                        <option>Flat Tyre &amp; Wheel Hub</option>
                        <option>Complete Engine Stalling</option>
                        <option>Out of Fuel / Fuel Contamination</option>
                        <option>Heavy Towing Required</option>
                        <option>Dead Battery / Starter Issue</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-extrabold uppercase text-obligon-text">Driver Contact Phone</span>
                      <input
                        value={roadsideForm.contact}
                        onChange={(e) => setRoadsideForm((prev) => ({ ...prev, contact: e.target.value }))}
                        className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                        required
                      />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#e1e6ee]">
                  <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl border border-[#07162f] text-sm font-extrabold">
                    Cancel
                  </button>
                  <button disabled={submitting} type="submit" className="h-11 px-6 rounded-xl bg-[#c1121f] text-sm font-extrabold text-white shadow flex items-center gap-2">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : "Dispatch Technician"}
                  </button>
                </div>
              </form>
            )}

            {modal === "export" && (
              <form onSubmit={handleExportSubmit} className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-[#eef3ff] text-obligon-blue">
                    <Download size={22} />
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Export Fleet Data</h2>
                    <p className="text-xs text-obligon-text">Generate audited transaction ledgers and reports.</p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Date Range</span>
                    <select
                      value={exportForm.range}
                      onChange={(e) => setExportForm((prev) => ({ ...prev, range: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-3 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                    >
                      <option>Current Billing Cycle (Aug 2026)</option>
                      <option>Last 30 Days</option>
                      <option>Quarter to Date (Q3 2026)</option>
                      <option>Year to Date (2026)</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Report Scope</span>
                    <select
                      value={exportForm.domain}
                      onChange={(e) => setExportForm((prev) => ({ ...prev, domain: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-3 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                    >
                      <option>All Fleet Transactions &amp; Receipts</option>
                      <option>Vehicle Fuel Consumption &amp; Efficiency</option>
                      <option>Driver Spend &amp; Limit Compliance</option>
                      <option>Scheduled Maintenance Logs</option>
                    </select>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#e1e6ee]">
                  <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl border border-[#07162f] text-sm font-extrabold">
                    Cancel
                  </button>
                  <button disabled={submitting} type="submit" className="h-11 px-6 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green flex items-center gap-2">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : "Download CSV"}
                  </button>
                </div>
              </form>
            )}

            {modal === "teamMember" && (
              <form onSubmit={handleTeamSubmit} className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-[#e8fbd7] text-obligon-green">
                    <UserPlus size={22} />
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Invite Team Member</h2>
                    <p className="text-xs text-obligon-text">Grant team members access to manage fleet operations.</p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Full Name</span>
                    <input
                      value={teamForm.name}
                      onChange={(e) => setTeamForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Corporate Email</span>
                    <input
                      value={teamForm.email}
                      onChange={(e) => setTeamForm((prev) => ({ ...prev, email: e.target.value }))}
                      type="email"
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Role &amp; Permissions</span>
                    <select
                      value={teamForm.role}
                      onChange={(e) => setTeamForm((prev) => ({ ...prev, role: e.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-3 text-sm font-bold text-obligon-navy outline-none focus:border-obligon-green"
                    >
                      <option>Fleet Manager (Full Operations &amp; Limits)</option>
                      <option>Fleet Dispatcher (Vehicle &amp; Roadside Only)</option>
                      <option>Finance Controller (Billing &amp; Invoices Only)</option>
                      <option>Auditor / Read-Only Viewer</option>
                    </select>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#e1e6ee]">
                  <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl border border-[#07162f] text-sm font-extrabold">
                    Cancel
                  </button>
                  <button disabled={submitting} type="submit" className="h-11 px-6 rounded-xl bg-obligon-green text-sm font-extrabold text-white shadow-green flex items-center gap-2">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : "Send Invitation"}
                  </button>
                </div>
              </form>
            )}

            {modal === "assign" && (
              <form onSubmit={(e) => { e.preventDefault(); toastSuccess("Driver asset assignment confirmed."); onClose(); }} className="p-6 sm:p-8 space-y-4">
                <h2 className="font-display text-2xl font-extrabold text-obligon-navy">Assign Vehicle &amp; Card</h2>
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Select Driver</span>
                    <input value={assignForm.driver} onChange={(e) => setAssignForm((p) => ({ ...p, driver: e.target.value }))} className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Select Vehicle</span>
                    <input value={assignForm.vehicle} onChange={(e) => setAssignForm((p) => ({ ...p, vehicle: e.target.value }))} className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase text-obligon-text">Select Fuel Card</span>
                    <input value={assignForm.card} onChange={(e) => setAssignForm((p) => ({ ...p, card: e.target.value }))} className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe5ec] px-4 text-sm font-bold text-obligon-navy" />
                  </label>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-[#e1e6ee]">
                  <button type="button" onClick={onClose} className="h-11 px-6 rounded-xl border border-[#07162f] text-sm font-extrabold">Cancel</button>
                  <button type="submit" className="h-11 px-6 rounded-xl bg-obligon-green text-sm font-extrabold text-white">Save Assignment</button>
                </div>
              </form>
            )}

            {modal === "cardConfirm" && (
              <div className="p-8 text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#fff3d8] text-[#9a6300]">
                  <Snowflake size={32} />
                </span>
                <h2 className="mt-5 font-display text-2xl font-extrabold text-obligon-navy">Freeze Physical Fuel Card</h2>
                <p className="mt-2 text-sm text-obligon-text">
                  This card will immediately decline all transactions at network pumps. You can unfreeze it at any time.
                </p>
                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border border-[#20251f] font-extrabold">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toastSuccess("Card status updated to FROZEN.");
                      onClose();
                    }}
                    className="h-12 flex-1 rounded-xl bg-[#bc5b00] font-extrabold text-white"
                  >
                    Confirm Freeze
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
