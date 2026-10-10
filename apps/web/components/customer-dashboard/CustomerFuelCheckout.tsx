"use client";
import * as React from 'react';
import Link from 'next/link';
import { authenticatedRequest } from '@/lib/services';

interface StationFuel {stationId:string;name:string;city:string;fuelType:string;unitPriceKobo:number;discountPercent:number}
interface FuelOrder {reference:string;stationId:string;stationName?:string;fuelType:string;litres:number;amountKobo:number;baseAmountKobo:number;discountKobo:number;status:string;authorizationCode:string|null;createdAt:string;checkoutUrl:string|null;reviewReason:string|null}
const endpoint='/api/customer/fuel-checkout';
const money=(value:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(value/100);
export function CustomerFuelCheckout(){
 const [stations,setStations]=React.useState<StationFuel[]>([]),[orders,setOrders]=React.useState<FuelOrder[]>([]);
 const [selected,setSelected]=React.useState(''),[litres,setLitres]=React.useState('10'),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[loading,setLoading]=React.useState(true);
 const [card,setCard]=React.useState<{id:string;status:string;label:string}|null>(null),[pin,setPin]=React.useState(''),[walletCode,setWalletCode]=React.useState<{code:string;expiresAt:number}|null>(null);
 const requestKey=React.useRef<string|null>(null);
 const choice=stations.find(s=>`${s.stationId}:${s.fuelType}`===selected);
 const base=choice?Math.round(choice.unitPriceKobo*Number(litres)):0;
 const discount=choice?Math.round(base*choice.discountPercent/100):0;
 const refresh=React.useCallback(async()=>{
  const results=await Promise.allSettled([authenticatedRequest<{stations:StationFuel[]}>(endpoint+'/stations'),authenticatedRequest<{orders:FuelOrder[]}>(endpoint),authenticatedRequest<{card:{id:string;status:string;label:string}|null}>('/api/customer/card')]);
  if(results[0].status==='fulfilled'){const available=results[0].value.stations;setStations(available);setSelected(prev=>prev||(available[0]?`${available[0].stationId}:${available[0].fuelType}`:''));}
  else setError(results[0].reason instanceof Error?results[0].reason.message:'Could not load stations');
  if(results[1].status==='fulfilled')setOrders(results[1].value.orders);
  if(results[2].status==='fulfilled')setCard(results[2].value.card);
 },[]);
 React.useEffect(()=>{
  let alive=true;
  async function load(){
   const params=new URLSearchParams(window.location.search),reference=params.get('reference');
   if(reference){
    setBusy(true);
    try{await authenticatedRequest(endpoint+'/confirm',{method:'POST',body:JSON.stringify({reference,transactionId:params.get('transaction_id'),simulated:params.get('simulated')==='true'})});window.history.replaceState({},'',window.location.pathname);}
    catch(e){if(alive)setError(e instanceof Error?e.message:'Payment confirmation is pending. Retry from your order below.');}
    finally{if(alive)setBusy(false);}
   }
   await refresh();if(alive)setLoading(false);
  }
  void load();return()=>{alive=false;};
 },[refresh]);
 React.useEffect(()=>{if(!walletCode)return;const timeout=setTimeout(()=>setWalletCode(null),Math.max(0,walletCode.expiresAt-Date.now()));return()=>clearTimeout(timeout);},[walletCode]);
 async function authorizeWallet(event:React.FormEvent){
  event.preventDefault();if(!card)return;setBusy(true);setError('');
  try{const result=await authenticatedRequest<{code:string;expiresInSeconds:number}>(`/api/customer/cards/${card.id}/pos-code`,{method:'POST',body:JSON.stringify({pin})});setPin('');setWalletCode({code:result.code,expiresAt:Date.now()+result.expiresInSeconds*1000});}
  catch(e){setError(e instanceof Error?e.message:'Wallet authorization could not be generated');}
  finally{setBusy(false);}
 }
 async function confirm(reference:string){setBusy(true);setError('');try{await authenticatedRequest(endpoint+'/confirm',{method:'POST',body:JSON.stringify({reference})});await refresh();}catch(e){setError(e instanceof Error?e.message:'Payment is not confirmed yet');}finally{setBusy(false);}}
 async function pay(event:React.FormEvent){
  event.preventDefault();if(!choice)return;setBusy(true);setError('');requestKey.current??=crypto.randomUUID();
  try{
   const result=await authenticatedRequest<{authorization_url:string;simulated:boolean;reference:string}>(endpoint+'/checkout',{method:'POST',body:JSON.stringify({stationId:choice.stationId,fuelType:choice.fuelType,litres:Number(litres),idempotencyKey:requestKey.current})});
   if(result.simulated){await authenticatedRequest(endpoint+'/confirm',{method:'POST',body:JSON.stringify({reference:result.reference,simulated:true})});requestKey.current=null;await refresh();}
   else window.location.assign(result.authorization_url);
  }catch(e){setError(e instanceof Error?e.message:'Fuel checkout could not start');}finally{setBusy(false);}
 }
 return <section className="mx-auto max-w-5xl space-y-6 p-6 sm:p-10">
  <div><h1 className="text-3xl font-extrabold text-slate-900">Pay for fuel at a station</h1><p className="mt-2 text-slate-600">Choose a station and fuel quantity. After payment, present your fuel code at that station.</p><Link href="/customer/subscription" className="mt-2 inline-block font-semibold text-obligon-green underline">Manage your subscription</Link></div>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
  {loading?<p role="status">Loading station prices and fuel orders…</p>:<form onSubmit={event=>void pay(event)} className="rounded-xl border bg-white p-6">
   <label htmlFor="fuel-station" className="block font-semibold">Station and fuel</label>
   <select id="fuel-station" value={selected} onChange={event=>{setSelected(event.target.value);requestKey.current=null;}} disabled={busy||!stations.length} className="mt-2 w-full rounded-lg border p-3">{stations.map(s=><option key={`${s.stationId}:${s.fuelType}`} value={`${s.stationId}:${s.fuelType}`}>{s.name} — {s.city} — {s.fuelType} ({money(s.unitPriceKobo)}/L)</option>)}</select>
   {!stations.length&&<p className="mt-3 text-slate-600">No stations are available for direct fuel payment yet.</p>}
   <label htmlFor="fuel-litres" className="mt-5 block font-semibold">Litres</label><input id="fuel-litres" type="number" min="0.01" max="10000" step="0.01" required value={litres} onChange={event=>{setLitres(event.target.value);requestKey.current=null;}} disabled={busy} className="mt-2 w-full rounded-lg border p-3"/>
   {choice&&Number(litres)>0&&<dl className="my-5 space-y-2"><div className="flex justify-between"><dt>Station price</dt><dd>{money(base)}</dd></div><div className="flex justify-between text-obligon-green"><dt>Approved discount ({choice.discountPercent}%)</dt><dd>−{money(discount)}</dd></div><div className="flex justify-between border-t pt-3 text-lg font-bold"><dt>You pay</dt><dd>{money(base-discount)}</dd></div></dl>}
   <p className="mb-4 text-sm text-slate-500">The final price is confirmed when checkout starts. Your subscription fee and fuel wallet balance are separate.</p>
   {card?.status!=='active'&&<p className="mb-4 text-sm text-slate-600">An active customer fuel card is required before checkout.</p>}
   <button disabled={busy||!choice||Number(litres)<=0||card?.status!=='active'} className="rounded-lg bg-obligon-green px-6 py-3 font-bold text-white disabled:opacity-50">{busy?'Processing…':'Continue to payment'}</button>
  </form>}
  <section className="rounded-xl border bg-white p-6"><h2 className="text-xl font-bold">Use your fuel wallet</h2><p className="mt-2 text-slate-600">At the station, enter your card PIN here to generate a single-use authorization code. The station charges your wallet when it dispenses fuel.</p>{card?.status==='active'?<form onSubmit={event=>void authorizeWallet(event)} className="mt-4"><label htmlFor="wallet-card-pin" className="block font-semibold">Four-digit card PIN</label><input id="wallet-card-pin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} required value={pin} onChange={event=>setPin(event.target.value)} disabled={busy} className="mt-2 w-full max-w-xs rounded-lg border p-3"/><button disabled={busy||pin.length!==4} className="ml-0 mt-3 block rounded-lg border px-5 py-3 font-semibold disabled:opacity-50">Generate wallet fuel code</button>{walletCode&&<div className="mt-4 rounded-lg bg-green-50 p-4" role="status"><p className="font-mono text-3xl font-bold tracking-widest">{walletCode.code}</p><p className="mt-2 text-sm">Valid until {new Date(walletCode.expiresAt).toLocaleTimeString()}. Show only to your station operator.</p></div>}</form>:<p className="mt-4">An active fuel card is required. <Link href="/customer/card" className="font-semibold text-obligon-green underline">Manage your card</Link></p>}</section>
  <div><h2 className="text-xl font-bold">Your fuel orders</h2><p className="mt-1 text-sm text-slate-600">Paid codes stay here until the station fulfills your order.</p><div className="mt-4 space-y-4">{orders.map(order=><article key={order.reference} className="rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{order.stationName??'Selected station'} · {order.litres}L {order.fuelType}</h3><span className="font-semibold">{money(order.amountKobo)}</span></div><p className="mt-2 text-sm text-slate-500">{order.reference} · {new Date(order.createdAt).toLocaleDateString()}</p>{order.status==='paid'?<div className="mt-4 rounded-lg bg-green-50 p-4"><p className="text-sm font-semibold">Show this code at your selected station</p><p className="mt-1 font-mono text-3xl font-bold tracking-widest">{order.authorizationCode}</p></div>:order.status==='paid_review'?<p className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-900">{order.reviewReason??'Payment confirmed. Admin is reviewing your fuel order; do not pay again.'}</p>:order.status==='refund_pending'?<p className="mt-3 text-amber-800">Refund requested. Your confirmed payment is being returned.</p>:order.status==='refunded'?<p className="mt-3 font-semibold">Payment refunded</p>:order.status==='fulfilled'?<p className="mt-3 font-semibold text-obligon-green">Fuel collected</p>:<div className="mt-3 flex items-center gap-4"><span>Payment awaiting confirmation</span>{order.checkoutUrl&&<a href={order.checkoutUrl} className="font-semibold text-obligon-green underline">Resume payment</a>}<button disabled={busy} onClick={()=>void confirm(order.reference)} className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">Check payment</button></div>}</article>)}{!orders.length&&!loading&&<p className="text-slate-500">Your fuel orders will appear here.</p>}</div></div>
 </section>;
}
