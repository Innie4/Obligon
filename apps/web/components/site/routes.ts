export const routes = {
  home: "/",
  login: "/auth/login",
  signup: "/auth/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  authInProgress: "/auth/in-progress",
  authSuccess: "/auth/success",
  authFailure: "/auth/failure",
  sessionExpired: "/auth/session-expired",
  emailVerification: "/auth/verify-email",
  phoneVerification: "/auth/verify-phone",
  // Aliases for the verification steps. Signup chains the two, and it reads
  // better naming the steps in the flow than reaching into the long-form names.
  verifyEmail: "/auth/verify-email",
  verifyPhone: "/auth/verify-phone",
  mfaSetup: "/auth/mfa/setup",
  mfaChallenge: "/auth/mfa/challenge",
  logout: "/auth/logout",
  privacy: "/privacy-policy",
  terms: "/terms-of-service",
  cookies: "/cookie-policy",
  careers: "/careers",
  support: "/support",
  dashboard: "/dashboard",
  // The partner dashboard's own verification step. Distinct from
  // `verifyEmail`, which is the signup flow's page: a partner verifies after
  // signing in and lands back in the console, not on the customer dashboard.
  partnerVerification: "/dashboard/verify",
  customerDashboard: "/customer",
  companyDashboard: "/company",
  notifications: "/dashboard/notifications",
  fuelvista: "/solutions/fuelvista",
  energyvista: "/solutions/energyvista",
  genvista: "/solutions/genvista",
  adminLogin: "/admin/login",
  adminDashboard: "/admin"
} as const;
