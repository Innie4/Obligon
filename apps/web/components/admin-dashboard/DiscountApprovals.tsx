"use client";
import * as React from 'react';
import { authenticatedRequest } from '@/lib/services';
interface Request {id:string;station_name:string;partner_name:string;fuel_type:string;rate_bp:number;starts_at:string;ends_at:string;status:string}
export function DiscountApprovals(){
 const [rows,setRows]=React.useState<Request[]>([]),[error,setError]=React.useState(''),[reason,setReason]=React.useState(''),[busy,setBusy]=React.useState(false);
 const load=React.useCallback(async()=>{try{setRows((await authenticatedRequest<{requests:Request[]}>('/api/admin/discount-requests')).requests);}catch(e){setError((e as Error).message);}},[]);
 React.useEffect(()=>{void load();},[load]);
 async function review(id:string,decision:string){setBusy(true);setError('');try{await authenticatedRequest(`/api/admin/discount-requests/${id}/review`,{method:'POST',body:JSON.stringify({decision,reason})});setReason('');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="p-8"><h1 className="text-3xl font-bold">Station Discount Approvals</h1>{error&&<p role="alert" className="my-4 text-red-700">{error}</p>}<label className="my-4 block">Review reason<input className="ml-3 rounded border p-2" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="space-y-4">{rows.map(r=><article key={r.id} className="rounded-xl border bg-white p-5"><h2 className="font-bold">{r.partner_name} — {r.station_name} / {r.fuel_type}</h2><p>{r.rate_bp/100}% · {new Date(r.starts_at).toLocaleString()} – {new Date(r.ends_at).toLocaleString()} · {r.status}</p><p className="my-2 text-sm">Customer discount and Obligon fee are each calculated from the undiscounted fuel price.</p>{r.status==='pending'&&<div className="flex gap-3"><button disabled={busy} onClick={()=>void review(r.id,'approved')} className="rounded bg-obligon-green p-2 text-white">Approve</button><button disabled={busy||!reason.trim()} onClick={()=>void review(r.id,'rejected')} className="rounded border p-2">Reject</button></div>}</article>)}{!rows.length&&<p>No discount requests.</p>}</div></section>;
}
