import { redirect } from "next/navigation";
import { VerificationUI } from "@/components/auth/VerificationUI";
import { routes } from "@/components/site/routes";

/**
 * The phone step no longer exists.
 *
 * Verification was two pages — /auth/verify-email and /auth/verify-phone —
 * because each channel had its own form and its own Send button, and a customer
 * verifying an account was asked to do the same thing twice to answer one
 * question. Both channels now share one page and one code field, so this route
 * sends anyone still holding the old link to it rather than showing a second
 * form. The URL is kept so links already sent out by email or SMS still work.
 */
export default function PhoneVerificationRedirect() {
  redirect(routes.verifyEmail);
}