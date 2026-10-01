import { VerificationUI } from "@/components/auth/VerificationUI";

/**
 * Account verification: one code, sent to the email address and the phone number
 * together.
 *
 * The contact details are fetched by the component from the signed-in account
 * rather than passed through the query string. They were `?contact=` parameters
 * before, which put an email address and a phone number into browser history,
 * referrer headers and every proxy log along the way. Nothing needs them in the
 * URL.
 */
export default function VerifyAccountPage() {
  return <VerificationUI />;
}