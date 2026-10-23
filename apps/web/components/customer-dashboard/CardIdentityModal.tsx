"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { NIGERIA_STATES } from "../../../../packages/shared/nigeria-locations.mjs";
import { DateField } from "@/components/shared/Calendar/DateField";
import { StatusPopup } from "@/components/shared/StatusPopup";
import { calendarDateValue } from "@/lib/calendar-date";
import { canEditCardIdentity, identityDetailsError, nationalPhone, nigeriaIdentityPhone, type CardIdentityDetails } from "@/lib/card-identity";
import { mutationsApi, type CardRequest } from "@/lib/services";
import { ModalFrame } from "./CustomerModals";

const field = "mt-2 min-h-12 w-full min-w-0 rounded-xl border border-obligon-border bg-white px-3 py-3 text-base text-obligon-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obligon-green disabled:bg-obligon-mist disabled:text-obligon-text";
const label = "block text-sm font-semibold text-obligon-navy";
const primary = "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-obligon-green px-5 py-3 text-sm font-bold text-white disabled:opacity-50";

export function CardDetailsModal({ defaultName, defaultPhone, accountEmail, request, busy, onSubmit, onConfirmed, onClose }: {
  defaultName: string;
  defaultPhone: string;
  accountEmail: string;
  request: CardRequest | null;
  busy: boolean;
  onSubmit: (details: CardIdentityDetails) => Promise<CardRequest | null>;
  onConfirmed: (request: CardRequest) => void;
  onClose: () => void;
}) {
  const [details, setDetails] = React.useState<CardIdentityDetails>(() => ({ fullName: defaultName, dateOfBirth: "", address: "", state: "", city: "", postalCode: "", ...request?.identityDetails, phone: nationalPhone(request?.identityDetails?.phone || defaultPhone), bvn: "", identityConsent: false }));
  const [current, setCurrent] = React.useState(request);
  const [cities, setCities] = React.useState<readonly string[]>([]);
  const [cityQuery, setCityQuery] = React.useState("");
  const [citiesLoading, setCitiesLoading] = React.useState(false);
  const [cityLoadAttempt, setCityLoadAttempt] = React.useState(0);
  const [cityLoadFailed, setCityLoadFailed] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [emailBusy, setEmailBusy] = React.useState<"send" | "confirm" | null>(null);
  const [cooldown, setCooldown] = React.useState(0);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState("");
  const [editing, setEditing] = React.useState(Boolean(request && (request.emailConfirmationStatus === "verified" || request.identityStale) && canEditCardIdentity(request)));
  const emailStep = Boolean(current?.identityRevision) && !editing;
  const working = busy || Boolean(emailBusy);

  React.useEffect(() => {
    let active = true;
    setCities([]);
    setCityLoadFailed(false);
    if (!details.state || emailStep) return;
    setCitiesLoading(true);
    import("../../../../packages/shared/nigeria-cities.mjs").then(data => {
      if (active) setCities(data.NIGERIA_CITIES[details.state] ?? []);
    }).catch(() => { if (active) setCityLoadFailed(true); })
      .finally(() => { if (active) setCitiesLoading(false); });
    return () => { active = false; };
  }, [details.state, emailStep, cityLoadAttempt]);

  React.useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function change<K extends keyof CardIdentityDetails>(key: K, value: CardIdentityDetails[K]) {
    setDetails(previous => ({ ...previous, [key]: value, ...(key === "state" ? { city: "", postalCode: "" } : key === "city" ? { postalCode: "" } : {}) }));
    if (key === "state") setCityQuery("");
    setError("");
  }

  async function sendEmail(target: CardRequest = current!) {
    if (!target?.paymentReference || !target.identityRevision || working || cooldown) return;
    setEmailBusy("send"); setError("");
    try {
      const result = await mutationsApi.sendCardIdentityEmailCode(target.paymentReference, target.identityRevision);
      setCurrent(result.request); setSent(true); setCode(""); setCooldown(result.resendAfterSeconds);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to send your confirmation code."); }
    finally { setEmailBusy(null); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    const message = identityDetailsError(details);
    if (message) { setError(message); return; }
    if (!cities.includes(details.city)) { setError("Choose a city or town in the selected state."); return; }
    setError("");
    const result = await onSubmit({ ...details, ...(current?.identityRevision ? { identityRevision: current.identityRevision } : {}), fullName: details.fullName.trim(), address: details.address.trim(), phone: nigeriaIdentityPhone(details.phone)! });
    if (result) {
      setCurrent(result); setEditing(false); setDetails(previous => ({ ...previous, bvn: "" }));
      await sendEmail(result);
    }
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working || !current?.paymentReference || !current.identityRevision) return;
    if (!/^\d{6}$/.test(code)) { setError("Enter the six-digit code from your email."); return; }
    setEmailBusy("confirm"); setError("");
    try {
      const result = await mutationsApi.confirmCardIdentityEmail(current.paymentReference, current.identityRevision, code);
      onConfirmed(result.request);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to confirm your email code."); }
    finally { setEmailBusy(null); }
  }

  const matchingCities = cityQuery.trim() ? cities.filter(city => city.toLocaleLowerCase("en").includes(cityQuery.trim().toLocaleLowerCase("en"))) : cities;
  const cityOptions = details.city && !matchingCities.includes(details.city) ? [details.city, ...matchingCities] : matchingCities;

  return <ModalFrame title={emailStep ? "Confirm your card verification email" : "Card verification details"} onClose={working ? () => undefined : onClose}>
    {working ? <StatusPopup tone="pending" message={emailBusy === "send" ? "Sending your email code…" : emailBusy === "confirm" ? "Confirming your email…" : "Saving your verification details…"} /> : null}
    {error ? <StatusPopup tone="error" message={error} /> : null}
    <div className="p-5 sm:p-7">
      <div className="mb-5 flex items-center gap-3 text-xs font-bold text-obligon-text" aria-label={`Step ${emailStep ? 2 : 1} of 2`}>
        <span className={emailStep ? "text-obligon-text" : "text-obligon-green"}>1. Your details</span><span aria-hidden="true">/</span><span className={emailStep ? "text-obligon-green" : "text-obligon-text"}>2. Confirm email</span>
      </div>
      <h2 className="font-display text-2xl font-bold tracking-tight text-obligon-navy">{emailStep ? "Confirm this request" : "Verify your details"}</h2>
      {emailStep ? <form onSubmit={confirm} className="mt-4 space-y-5">
        <div className="flex items-start gap-3 rounded-xl bg-obligon-mist p-4"><Mail className="mt-0.5 shrink-0 text-obligon-green" size={22} aria-hidden="true" /><p className="min-w-0 break-words text-sm leading-6 text-obligon-text">{sent ? "We sent a code to " : "Send a confirmation code to "}<strong className="text-obligon-navy">{current?.identityEmailMasked || accountEmail}</strong>. Use it to confirm these card details.</p></div>
        <p className="text-sm leading-6 text-obligon-text">Your email code confirms this submission. The admin will separately check your BVN and legal name before approving your card.</p>
        <label className={label}>Email code<input autoFocus className={`${field} tracking-[0.25em]`} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={working} placeholder="6-digit code" /></label>
        <button type="submit" className={primary} disabled={working || code.length !== 6}>Confirm and send for review<ArrowRight size={17} aria-hidden="true" /></button>
        <button type="button" onClick={() => void sendEmail()} disabled={working || cooldown > 0} className="min-h-12 w-full rounded-xl border border-obligon-border px-4 text-sm font-bold text-obligon-navy disabled:opacity-50">{cooldown ? `Send again in ${cooldown}s` : sent ? "Send a new code" : "Send email code"}</button>
        <p className="text-xs leading-5 text-obligon-text">The code expires in 10 minutes. Check Spam if it does not arrive. Closing this popup saves your progress.</p>
        {current && canEditCardIdentity(current) ? <button type="button" className="min-h-11 w-full text-sm font-semibold text-obligon-green underline underline-offset-2" disabled={working} onClick={() => { setEditing(true); setSent(false); setCode(""); setCooldown(0); setError(""); }}>Correct submitted details</button> : null}
      </form> : <form onSubmit={submit} className="mt-4 space-y-5">
        <p className="text-sm leading-6 text-obligon-text">Use the name on your BVN. Your details go to an admin for identity review before your card is issued.</p>
        <fieldset disabled={working} className="min-w-0 space-y-5">
          <legend className="sr-only">Identity and contact details</legend>
          <label className={label}>Full legal name<input className={field} autoComplete="name" maxLength={120} value={details.fullName} onChange={event => change("fullName", event.target.value)} required /></label>
          <div className="grid gap-5 sm:grid-cols-2">
            <DateField label="Date of birth" required value={details.dateOfBirth} onChange={value => change("dateOfBirth", value)} max={calendarDateValue(new Date())} autoComplete="bday" />
            <label className={label}>BVN<input className={field} type="password" inputMode="numeric" autoComplete="off" minLength={11} maxLength={11} pattern="2[0-9]{10}" value={details.bvn} onChange={event => change("bvn", event.target.value.replace(/\D/g, "").slice(0, 11))} required aria-describedby="bvn-privacy" /></label>
          </div>
          <p id="bvn-privacy" className="text-xs leading-5 text-obligon-text">Your BVN is encrypted. It is used for an identity check and card issuance.</p>
          <label className={label}>Phone number<span className="mt-2 flex min-h-12 overflow-hidden rounded-xl border border-obligon-border bg-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-obligon-green"><span className="flex shrink-0 items-center border-r border-obligon-border bg-obligon-mist px-3 font-bold" aria-hidden="true">+234</span><input className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base font-normal outline-none" type="tel" inputMode="tel" autoComplete="tel-national" aria-label="Phone number, Nigeria +234" aria-describedby="identity-phone-help" value={details.phone} onChange={event => change("phone", nationalPhone(event.target.value).replace(/\D/g, ""))} maxLength={11} pattern="0?[789][0-9]{9}" required /></span><span id="identity-phone-help" className="mt-2 block text-xs font-normal leading-5 text-obligon-text">Enter 10 digits, or 11 digits starting with 0. We add +234.</span></label>
        </fieldset>
        <fieldset disabled={working} className="min-w-0 space-y-5 border-t border-obligon-border pt-5">
          <legend className="sr-only">Residential address</legend>
          <label className={label}>Residential address<input className={field} autoComplete="street-address" maxLength={200} value={details.address} onChange={event => change("address", event.target.value)} required /></label>
          <label className={label}>State / FCT<select className={field} autoComplete="address-level1" value={details.state} onChange={event => change("state", event.target.value)} required><option value="">Select state</option>{NIGERIA_STATES.map(state => <option key={state} value={state}>{state}</option>)}</select></label>
          {details.state ? <label className={label}>Find your city or town<input className={field} type="search" value={cityQuery} onChange={event => setCityQuery(event.target.value)} disabled={citiesLoading || cityLoadFailed} placeholder="Search by name" aria-controls="card-identity-city" /></label> : null}
          <label className={label}>City / town<select id="card-identity-city" className={field} autoComplete="address-level2" disabled={!details.state || citiesLoading || cityLoadFailed} value={details.city} onChange={event => change("city", event.target.value)} required aria-describedby="city-selection-help"><option value="">{!details.state ? "Select a state first" : citiesLoading ? "Loading cities…" : "Select city or town"}</option>{cityOptions.map(city => <option key={city} value={city}>{city}</option>)}</select></label>
          <p id="city-selection-help" className="text-xs leading-5 text-obligon-text">{details.state && !citiesLoading && !cityLoadFailed && !matchingCities.length ? "No matching towns. Try a shorter spelling or check your state." : "Choose the city or town for your residential address."}</p>
          {cityLoadFailed ? <StatusPopup tone="error" message="Unable to load cities. Your entered details are saved in this popup." onRetry={() => setCityLoadAttempt(value => value + 1)} /> : null}
          <label className={label}>Postal code <span className="font-normal text-obligon-text">(optional)</span><input className={field} autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={details.postalCode} onChange={event => change("postalCode", event.target.value.replace(/\D/g, ""))} /><span className="mt-2 block text-xs font-normal leading-5 text-obligon-text">You can submit without a postal code. The card issuer requires your six-digit code before issuance. <a href="https://postcode.gov.ng/find" target="_blank" rel="noopener noreferrer" className="font-semibold text-obligon-green underline underline-offset-2">Open NIPOST’s postcode finder<span className="sr-only"> in a new tab</span></a>. Its digital building codes use a different format.</span></label>
        </fieldset>
        <label className="flex items-start gap-3 rounded-xl bg-obligon-mist p-4 text-sm leading-6 text-obligon-text"><input className="mt-1 h-5 w-5 shrink-0 accent-obligon-green" type="checkbox" checked={details.identityConsent} onChange={event => change("identityConsent", event.target.checked)} disabled={working} required /><span>I consent to checking my BVN and matching my name for this card application. If requested, I will complete the provider’s separate identity consent.</span></label>
        <button type="submit" className={primary} disabled={working || citiesLoading || cityLoadFailed}><ShieldCheck size={18} aria-hidden="true" />Save details and confirm email<ArrowRight size={17} aria-hidden="true" /></button>
        <button type="button" onClick={onClose} disabled={working} className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-obligon-text"><ArrowLeft size={16} aria-hidden="true" />Back to My Card</button>
      </form>}
    </div>
  </ModalFrame>;
}
