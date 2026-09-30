import { VerificationUI } from "@/components/auth/VerificationUI";

/**
 * The email half of signup verification. `next` carries the phone step so that
 * finishing the email leads to it rather than to the dashboard.
 */
export default function EmailVerificationPage() {
  return <VerificationUI type="email" redirect="/customer" />;
}
