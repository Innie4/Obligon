import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  // Supabase (database + storage + auth)
  DATABASE_URL: z.string().default(process.env.DATABASE_URL || (process.env.NODE_ENV === "test" ? "postgres://localhost:5432/obligon_test" : "")),
  SUPABASE_URL: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  SUPABASE_ANON_KEY: z.string().default(""),
  SUPABASE_STORAGE_BUCKET: z.string().default("obligon"),
  SUPABASE_AUTH_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(16).default("dev-access-secret-change-me-please"),
  JWT_REFRESH_SECRET: z.string().min(16).default("dev-refresh-secret-change-me-please"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  REMEMBER_REFRESH_TTL_DAYS: z.coerce.number().default(30),

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
    .default("false")
    .transform((v) => v === "true")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

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
