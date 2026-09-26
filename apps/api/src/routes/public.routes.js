import { Router } from "express";
import { q, one } from "../db.js";
import { asyncHandler, badRequest, notFound } from "../lib/errors.js";
import { attachUser } from "../middleware/auth.js";
import { naira, reference } from "../lib/format.js";
import { notify, sendEmail } from "../lib/notify.js";
import { paymentProviderStatus, checkoutIsSimulated } from "../lib/payments.js";
import { env } from "../config/env.js";
import { uploadFile } from "../lib/storage.js";
import multer from "multer";
import crypto from "node:crypto";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(attachUser);

/**
 * Payment configuration for the browser. Exposes only the active provider and
 * its browser-safe public key, so the checkout UI can name the processor
 * without the secret ever leaving the server.
 */
router.get("/payments/config", asyncHandler(async (_req, res) => {
  const status = paymentProviderStatus();
  res.json({
    provider: status.active,
    simulated: checkoutIsSimulated(status.active),
    // Public keys are safe to expose; secret keys never are.
    publicKeys: {
      paystack: env.PAYSTACK_PUBLIC_KEY || null,
      flutterwave: env.FLW_PUBLIC_KEY || null
    }
  });
}));

// ============ PRICING PLANS ============
router.get("/plans", asyncHandler(async (_req, res) => {
  const plans = await q("SELECT * FROM pricing_plans WHERE active = TRUE ORDER BY price_kobo");
  res.json({
    plans: plans.map((p) => ({
      code: p.code, name: p.name, priceLabel: naira(p.price_kobo),
      interval: p.interval, features: p.features, highlighted: p.highlighted
    }))
  });
}));

router.post("/plans/select", asyncHandler(async (req, res) => {
  const { planCode, contactName, companyName, email, phone, fleetSize, message } = req.valid ?? req.body ?? {};
  if (!planCode) throw badRequest("Choose a plan");
  const plan = await one("SELECT * FROM pricing_plans WHERE code = $1", [planCode]);
  if (!plan) throw notFound("Plan not found");
  await q(
    `INSERT INTO leads (type, contact_name, company_name, email, phone, fleet_size, message) VALUES ('onboarding',$1,$2,$3,$4,$5,$6)`,
    [contactName ?? null, companyName ?? null, email ?? "no-email@obligon.com", phone ?? null, fleetSize ?? null, `Plan selection: ${plan.name}`]
  );
  if (email) {
    void sendEmail({
      to: email,
      subject: `Obligon ${plan.name} plan — next steps`,
      text: `Thanks for choosing the ${plan.name} plan (${naira(plan.price_kobo)}/${plan.interval}). Our team will reach out within one business day to complete onboarding.`,
      html: `<div style="font-family:sans-serif"><h2>Great choice!</h2><p>You selected the <b>${plan.name}</b> plan (${naira(plan.price_kobo)}/${plan.interval}).</p><p>Our onboarding team will reach out within one business day.</p></div>`
    });
  }
  res.json({ ok: true, plan: plan.name, message: "Our onboarding team will contact you within one business day." });
}));

// ============ CONTENT (products/modules/partners/stories/FAQ) ============
router.get("/content", asyncHandler(async (req, res) => {
  const { kind } = req.query;
  const params = [];
  let where = "active = TRUE";
  if (kind) { params.push(kind); where += ` AND kind = $1`; }
  const items = await q(`SELECT * FROM content_items WHERE ${where} ORDER BY sort_order`, params);
  res.json({ items });
}));

// ============ CAREERS ============
router.get("/jobs", asyncHandler(async (req, res) => {
  const { department, employmentType } = req.query;
  const params = [];
  let where = `status = 'open'`;
  if (department) { params.push(`%${department}%`); where += ` AND department ILIKE $${params.length}`; }
  if (employmentType) { params.push(employmentType); where += ` AND employment_type = $${params.length}`; }
  const jobs = await q(`SELECT * FROM job_postings WHERE ${where} ORDER BY created_at DESC`, params);
  res.json({
    jobs: jobs.map((j) => ({
      id: j.id, title: j.title, department: j.department, location: j.location,
      employmentType: j.employment_type, description: j.description, requirements: j.requirements, posted: j.created_at
    }))
  });
}));

router.post("/jobs/apply", upload.single("resume"), asyncHandler(async (req, res) => {
  const { jobId, name, email, phone, coverNote } = req.valid ?? req.body ?? {};
  if (!name || !email) throw badRequest("Name and email are required");
  if (req.body?.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("Enter a valid email address");
  let resumePath = null;
  if (req.file) {
    if (!["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(req.file.mimetype)) {
      throw badRequest("Resume must be a PDF or Word document");
    }
    resumePath = await uploadFile("resume", req.file.originalname, req.file.buffer, req.file.mimetype);
  }
  if (jobId) {
    const job = await one("SELECT id FROM job_postings WHERE id = $1", [jobId]);
    if (!job) throw notFound("Job not found");
  }
  await q(
    `INSERT INTO job_applications (job_id, name, email, phone, resume_path, cover_note) VALUES ($1,$2,$3,$4,$5,$6)`,
    [jobId || null, name, email, phone ?? null, resumePath, coverNote ?? ""]
  );
  void sendEmail({
    to: email,
    subject: "We received your Obligon application",
    text: `Hi ${name}, thanks for applying to Obligon. Our team reviews every application and will reach out if there's a fit.`,
    html: `<div style="font-family:sans-serif"><h2>Application received</h2><p>Hi ${name}, thanks for applying to Obligon LTD. Our team reviews every application and will reach out if there's a match.</p></div>`
  });
  res.json({ ok: true, message: "Application received — we'll be in touch if there's a match." });
}));

// ============ LEADS / NEWSLETTER ============
router.post("/leads", asyncHandler(async (req, res) => {
  const { type = "sales", contactName, companyName, email, phone, fleetSize, message } = req.valid ?? req.body ?? {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("Enter a valid email address");
  await q(
    `INSERT INTO leads (type, contact_name, company_name, email, phone, fleet_size, message) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [type, contactName ?? null, companyName ?? null, email, phone ?? null, fleetSize ?? null, message ?? ""]
  );
  res.json({ ok: true, message: type === "newsletter" ? "You're subscribed to Obligon updates." : "Thanks — our sales team will reach out shortly." });
}));

// ============ PUBLIC SUPPORT / CONTACT ============
router.post("/contact", upload.single("attachment"), asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.valid ?? req.body ?? {};
  if (!name || !email || !message) throw badRequest("Name, email and message are required");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("Enter a valid email address");
  let attachmentPath = null;
  if (req.file) attachmentPath = await uploadFile("attachment", req.file.originalname, req.file.buffer, req.file.mimetype);
  await q(
    `INSERT INTO contact_messages (name, email, subject, message, attachment_path) VALUES ($1,$2,$3,$4,$5)`,
    [name, email, subject ?? "", message, attachmentPath]
  );
  // Route into the support ticket queue as well
  await q(
    `INSERT INTO support_tickets (reference, subject, category, message, status) VALUES ($1,$2,'general',$3,'queued')`,
    [reference("WEB"), subject || `Website contact from ${name}`, message]
  );
  void sendEmail({
    to: email,
    subject: "Obligon support — we got your message",
    text: `Hi ${name}, thanks for contacting Obligon support. We'll respond within a few hours.`,
    html: `<div style="font-family:sans-serif"><h2>Message received</h2><p>Hi ${name}, thanks for contacting Obligon support. We typically respond within a few hours.</p></div>`
  });
  res.json({ ok: true, message: "Message received — our team will respond within a few hours." });
}));

// ============ COOKIE CONSENT ============
router.post("/cookie-consent", asyncHandler(async (req, res) => {
  const { preferences, dntRespected, visitorId } = req.valid ?? req.body ?? {};
  await q(
    `INSERT INTO cookie_consents (user_id, visitor_id, preferences, dnt_respected, ip) VALUES ($1,$2,$3,$4,$5)`,
    [req.user?.id ?? null, visitorId ?? crypto.randomUUID(), JSON.stringify(preferences ?? {}), Boolean(dntRespected), req.ip]
  );
  res.json({ ok: true });
}));

// ============ LEGAL DATA REQUESTS ============
router.post("/data-requests", asyncHandler(async (req, res) => {
  const { email, requestType = "export", notes } = req.valid ?? req.body ?? {};
  if (!email) throw badRequest("Email is required");
  await q(`INSERT INTO data_requests (email, request_type, notes) VALUES ($1,$2,$3)`, [email, requestType, notes ?? ""]);
  res.json({ ok: true, message: "Your data request has been logged. We respond within 30 days as required by law." });
}));

// ============ ANALYTICS EVENTS ============
router.post("/events", asyncHandler(async (req, res) => {
  const { name, props } = req.valid ?? req.body ?? {};
  if (!name) return res.json({ ok: true });
  await q(`INSERT INTO analytics_events (user_id, name, props) VALUES ($1,$2,$3)`, [req.user?.id ?? null, String(name).slice(0, 100), JSON.stringify(props ?? {})]);
  res.json({ ok: true });
}));

export default router;
