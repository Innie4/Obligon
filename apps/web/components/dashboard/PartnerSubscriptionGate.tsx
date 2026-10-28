"use client";
import { StatusPopup } from "@/components/shared/StatusPopup";
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { authenticatedRequest } from '@/lib/services';
import { PartnerContractPanel, type PartnerContractState } from './PartnerContractPanel';
export function PartnerSubscriptionGate({children}:{children:React.ReactNode}) {
 const path = usePathname();
 const [data, setData] = React.useState<PartnerContractState | null>(null);
 const [error, setError] = React.useState('');
 const [revision, setRevision] = React.useState(0);
 const exempt = /^\/dashboard\/(billing|settings|staff|station-profile|notifications|verify|workshop)(\/|$)/.test(path);
 React.useEffect(() => {
   let alive = true;
   let timer: ReturnType<typeof setTimeout> | undefined;
   setError('');
   if (exempt) return;
   setData(null);
   authenticatedRequest<PartnerContractState>('/api/partner/billing').then(result => {
     if (!alive) return;
     const delay = result.temporaryAccess && result.expiresAt ? new Date(result.expiresAt).getTime() - Date.now() : NaN;
     setData(Number.isFinite(delay) && delay <= 0 ? { ...result, active: false } : result);
     if (result.active && Number.isFinite(delay) && delay > 0) timer = setTimeout(() => {
       setData(null);
       setRevision(value => value + 1);
     }, Math.min(delay, 2_147_483_647));
   }).catch(failure => { if (alive) setError(failure.message); });
   return () => { alive = false; if (timer) clearTimeout(timer); };
 }, [path, exempt, revision]);
 if(exempt)return <>{children}</>;
 if(error)return <StatusPopup tone="error" title="Your contract status could not be checked." message={error} onRetry={()=>window.location.reload()} retryLabel="Retry" />;
 if(data===null)return <StatusPopup tone="loading" message="Checking contract approval…" />;
 return data.active?<>{children}</>:<PartnerContractPanel {...data}/>;
}
