import { MFASetupUI } from "@/components/auth/MFAUI";

export default function MFAChallengePage() {
  return <MFASetupUI stage="challenge" redirect="/customer" />;
}