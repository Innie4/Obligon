import { MFASetupUI } from "@/components/auth/MFAUI";

export default function MFASetupPage() {
  return <MFASetupUI stage="setup" redirect="/customer" />;
}