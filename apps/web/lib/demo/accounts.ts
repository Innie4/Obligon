/**
 * One-click demo sign-in.
 *
 * Five accounts, one per role, each behind a single button on the sign-in page. The
 * point is to reach a dashboard in one click instead of finding an email address
 * and remembering a password, which is what a demo of a multi-dashboard product
 * otherwise turns into.
 *
 * These are shared, published, weak passwords for accounts with no second factor.
 * That is acceptable for a demo and unacceptable for anything else, so the whole
 * thing is behind `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`, which is off unless set. The
 * flag is a `NEXT_PUBLIC_` variable, so it is inlined into the bundle at build time
 * and the credentials are present in the JavaScript — which is exactly why it is a
 * deliberate, visible choice rather than a default.
 *
 * The API refuses to seed these accounts when `NODE_ENV=production`, so a
 * misconfigured deployment ends up with buttons that cannot work rather than with
 * working buttons that should not exist.
 */
import type { UserRole } from "@/lib/services/types";

export interface DemoAccount {
  email: string;
  password: string;
  role: UserRole;
  /** Shown on the button. */
  label: string;
  /** One line explaining what this role sees, so the choice is not a guess. */
  blurb: string;
  /** Where the sign-in page sends the browser afterwards. */
  landing: string;
  initials: string;
  /** Grouping in the panel. */
  group: "Platform" | "Operations";
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "admin@obligon.com",
    password: "Admin#1234",
    role: "admin",
    label: "Platform Admin",
    blurb: "Every organisation, dispute, payout and station across the platform.",
    landing: "/admin",
    initials: "AO",
    group: "Platform"
  },
  {
    email: "customer@obligon.com",
    password: "Customer#123",
    role: "customer",
    label: "Customer",
    blurb: "Fuel cards, wallet balance, top-ups and dispense history.",
    landing: "/customer",
    initials: "FB",
    group: "Operations"
  },
  {
    email: "fleet@obligon.com",
    password: "Company#123",
    role: "company",
    label: "Fleet Account",
    blurb: "Enrolled vehicles, drivers, cards and the fleet's own spend.",
    landing: "/company",
    initials: "AS",
    group: "Operations"
  },
  {
    email: "partner@obligon.com",
    password: "Partner#123",
    role: "partner",
    label: "Station Partner",
    blurb: "Revenue, POS authorisations, pricing, settlements and payouts.",
    landing: "/dashboard",
    initials: "CN",
    group: "Operations"
  },
  {
    email: "mechanic@obligon.com",
    password: "Mechanic#123",
    role: "mechanic",
    label: "Mechanic",
    blurb: "The partner dashboard, read-only: no pricing, payouts or disputes.",
    landing: "/dashboard",
    initials: "TB",
    group: "Operations"
  }
];

/**
 * Whether the demo panel is rendered.
 *
 * Read from the environment directly rather than from a config module: this value
 * is a build-time decision about what is compiled into the bundle, and the
 * credentials below are in the same module, so they share one gate. Deriving it
 * anywhere else could produce a panel with no accounts or vice versa.
 */
export const DEMO_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";

/** The destination for a signed-in role, mirroring the manual login form. */
export function destinationForRole(role: UserRole): string {
  if (role === "admin") return "/admin";
  if (role === "company") return "/company";
  if (role === "partner" || role === "mechanic") return "/dashboard";
  return "/customer";
}