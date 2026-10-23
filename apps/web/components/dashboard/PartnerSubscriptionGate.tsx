"use client";
import { StatusPopup } from "@/components/shared/StatusPopup";
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
 if(error)return <StatusPopup tone="error" title="Your subscription status could not be checked." message={error} onRetry={()=>window.location.reload()} retryLabel="Retry" />;
 if(active===null)return <StatusPopup tone="loading" message="Checking subscription…" />;
 return active?<>{children}</>:<SubscriptionPanel kind="partner"/>;
}
