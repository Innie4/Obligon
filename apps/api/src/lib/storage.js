import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { serviceUnavailable } from "./errors.js";

let client = null;
function getClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw serviceUnavailable("File storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)");
  }
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
  return client;
}

const FOLDER_BY_KIND = {
  receipt: "receipts",
  invoice: "invoices",
  report: "reports",
  evidence: "evidence",
  resume: "resumes",
  asset: "station-assets",
  attachment: "attachments",
  avatar: "avatars"
};

export const STORAGE_BUCKET = env.SUPABASE_STORAGE_BUCKET;

/** Upload a buffer and return the storage path (bucket-relative). */
export async function uploadFile(kind, filename, buffer, contentType = "application/octet-stream") {
  const supabase = getClient();
  const folder = FOLDER_BY_KIND[kind] ?? "misc";
  const safeName = `${Date.now()}-${String(filename).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const path = `${folder}/${safeName}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, buffer, { contentType, upsert: false });
  if (error) throw serviceUnavailable(`File upload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL for secure download. */
export async function signedUrl(path, expiresInSeconds = 300) {
  if (!path) return null;
  const supabase = getClient();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw serviceUnavailable(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

export async function publicUrl(path) {
  if (!path) return null;
  const supabase = getClient();
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Ensure the storage bucket exists (run once at boot). */
export async function ensureBucket() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  const supabase = getClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === STORAGE_BUCKET)) {
    await supabase.storage.createBucket(STORAGE_BUCKET, { public: false, fileSizeLimit: "25MB" });
    console.log(`Created Supabase storage bucket "${STORAGE_BUCKET}"`);
  }
}
