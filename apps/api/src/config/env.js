import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  // Supabase (database + storage + auth)
  DATABASE_URL: z.string().default(process.env.DATABASE_URL || (process.env.NODE_ENV === "test" ? "postgres://localhost:5432/obligon_test" : "")),
  SUPABASE_URL: z.string().default(process.env.NEXT_PUBLIC_SUPABASE_URL || ""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ""),
  SUPABASE_ANON_KEY: z.string().default(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""),
  SUPABASE_JWKS_URL: z.string().default(""),
  SUPABASE_STORAGE_BUCKET: z.string().default("obligon"),
  SUPABASE_AUTH_ENABLED: z
    .string()
    .default(process.env.SUPABASE_AUTH_ENABLED || (process.env.SUPABASE_SECRET_KEY && (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) ? "true" : "false"))
    .transform((v) => v === "true"),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(16).default("dev-access-secret-change-me-please"),
  JWT_REFRESH_SECRET: z.string().min(16).default("dev-refresh-secret-change-me-please"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  REMEMBER_REFRESH_TTL_DAYS: z.coerce.number().default(30),
  PROVIDER_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().max(120000).default(10000),
  PROVIDER_RETRY_COUNT: z.coerce.number().int().min(0).max(3).default(2),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().max(120000).default(10000),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().max(600000).default(30000),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().max(100).default(10),

  // Sudo Africa (virtual card issuing)
  SUDO_BASE_URL: z.string().default("https://api.sandbox.sudo.africa/v1"),
  SUDO_SECRET_API_KEY: z.string().default(""),
  SUDO_WEBHOOK_SECRET: z.string().default(""),

  // Paystack (top-ups, subscriptions, payouts)
  PAYSTACK_SECRET_KEY: z.string().default(""),
  PAYSTACK_PUBLIC_KEY: z.string().default(""),

  // Email
  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("Obligon <no-reply@obligon.com>"),

  // SMS
  TERMII_API_KEY: z.string().default(""),
  TERMII_SENDER_ID: z.string().default("Obligon"),

  // Web push
  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().default(""),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().default(""),
  WEB_PUSH_CONTACT: z.string().default("mailto:ops@obligon.com"),

  // Maps
  GOOGLE_MAPS_API_KEY: z.string().default(""),

  // Background scheduler (session/code purge + auto-settlement). Safe off in dev.
  ENABLE_SCHEDULER: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  // Feature flags: when a provider key is absent the API degrades to local
  // simulation instead of failing the whole request (recorded in audit logs).
  STRICT_PROVIDERS: z
    .string()
    .default("true")
    .transform((v) => v === "true")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

export function configurationIssues() {
  const issues = [];
  if (!env.DATABASE_URL) issues.push("DATABASE_URL is required");
  if (isProd && (env.JWT_ACCESS_SECRET.startsWith("dev-") || env.JWT_REFRESH_SECRET.startsWith("dev-"))) {
    issues.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be replaced with unique production secrets");
  }
  if (isProd && !env.SUPABASE_AUTH_ENABLED) issues.push("SUPABASE_AUTH_ENABLED=true is required in production");
  if (isProd && env.SUPABASE_AUTH_ENABLED && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_ANON_KEY)) {
    issues.push("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY are required when Supabase Auth is enabled");
  }
  if (isProd && !env.RESEND_API_KEY) issues.push("RESEND_API_KEY is required for production email verification and password recovery");
  if (isProd && !env.TERMII_API_KEY) issues.push("TERMII_API_KEY is required for production phone verification and SMS alerts");
  if (isProd && !env.PAYSTACK_SECRET_KEY) issues.push("PAYSTACK_SECRET_KEY is required for production wallet funding and transfers");
  if (isProd && !env.SUDO_SECRET_API_KEY) issues.push("SUDO_SECRET_API_KEY is required for production card issuing and card operations");
  if (isProd && env.SUDO_SECRET_API_KEY && !env.SUDO_WEBHOOK_SECRET) issues.push("SUDO_WEBHOOK_SECRET is required when Sudo card operations are enabled");
  if (isProd && env.PAYSTACK_SECRET_KEY && !env.PAYSTACK_PUBLIC_KEY) issues.push("PAYSTACK_PUBLIC_KEY is required when Paystack is enabled");
  return issues;
}

export const providerStatus = () => ({
  supabase: Boolean(env.DATABASE_URL),
  supabaseAuth: env.SUPABASE_AUTH_ENABLED === true && Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  storage: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  sudo: Boolean(env.SUDO_SECRET_API_KEY),
  paystack: Boolean(env.PAYSTACK_SECRET_KEY),
  email: Boolean(env.RESEND_API_KEY),
  sms: Boolean(env.TERMII_API_KEY),
  push: Boolean(env.WEB_PUSH_VAPID_PUBLIC_KEY && env.WEB_PUSH_VAPID_PRIVATE_KEY),
  maps: Boolean(env.GOOGLE_MAPS_API_KEY)
});
