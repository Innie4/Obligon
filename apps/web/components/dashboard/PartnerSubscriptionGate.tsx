"use client";
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { authenticatedRequest } from '@/lib/services';
import { SubscriptionPanel } from '@/components/shared/SubscriptionPanel';
export function PartnerSubscriptionGate({children}:{children:React.ReactNode}) {
 const path=usePathname();const [active,setActive]=React.useState<boolean|null>(null),[error,setError]=React.useState('');
 const exempt=/^\/dashboard\/(billing|settings|settlements|disputes|notifications|verify)(\/|$)/.test(path);
 React.useEffect(()=>{let alive=true;setActive(null);authenticatedRequest<{active:boolean}>('/api/partner/billing').then(r=>{if(alive)setActive(r.active);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[path]);
 if(exempt)return <>{children}</>;
 if(error)return <div className="p-8" role="alert">{error}<button className="ml-3 underline" onClick={()=>window.location.reload()}>Retry</button></div>;
 if(active===null)return <p className="p-8">Checking subscription…</p>;
 return active?<>{children}</>:<SubscriptionPanel kind="partner"/>;
}
