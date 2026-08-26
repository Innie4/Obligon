import { VerificationUI } from "@/components/auth/VerificationUI";

export default function EmailVerificationPage() {
  return <VerificationUI type="email" redirect="/customer" />;
}