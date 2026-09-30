import { VerificationUI } from "@/components/auth/VerificationUI";

/**
 * The phone half of signup verification. `next` carries the destination, so the
 * customer lands on their dashboard once both channels are confirmed.
 */
export default function PhoneVerificationPage() {
  return <VerificationUI type="phone" redirect="/customer" />;
}
