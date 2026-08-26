import { VerificationUI } from "@/components/auth/VerificationUI";

export default function PhoneVerificationPage() {
  return <VerificationUI type="phone" redirect="/customer" />;
}