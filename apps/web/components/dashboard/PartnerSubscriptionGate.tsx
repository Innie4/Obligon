"use client";
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { authenticatedRequest } from '@/lib/services';
import { SubscriptionPanel } from '@/components/shared/SubscriptionPanel';
import { useSession } from '@/components/shared/AuthContext';
import { partnerAllowedFuels } from '../../../../packages/shared/partner-access.mjs';
export function PartnerSubscriptionGate({children}:{children:React.ReactNode}) {
 const {user}=useSession();
 const path=usePathname();const [active,setActive]=React.useState<boolean|null>(null),[error,setError]=React.useState('');
 const exempt=/^\/dashboard\/(billing|settings|settlements|disputes|notifications|verify|workshop)(\/|$)/.test(path)||(!partnerAllowedFuels(user).length&&['/dashboard','/mechanic'].includes(path));
 React.useEffect(()=>{let alive=true;setError('');if(exempt)return;setActive(null);authenticatedRequest<{active:boolean}>('/api/partner/billing').then(r=>{if(alive)setActive(r.active);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[path,exempt]);
 if(exempt)return <>{children}</>;
 if(error)return <div className="mx-4 my-6 rounded-2xl border border-red-200 bg-white p-5 text-sm text-red-800 sm:mx-8 sm:p-6" role="alert"><p className="font-semibold">Your subscription status could not be checked.</p><p className="mt-2 leading-6">{error}</p><button type="button" className="mt-4 min-h-11 rounded-xl border border-current px-4 font-semibold underline" onClick={()=>window.location.reload()}>Retry</button></div>;
 if(active===null)return <p role="status" className="mx-4 my-6 rounded-2xl border border-obligon-border bg-white px-5 py-10 text-center text-sm text-obligon-text sm:mx-8">Checking subscription…</p>;
 return active?<>{children}</>:<SubscriptionPanel kind="partner"/>;
}
