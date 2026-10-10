import { Router } from "express";
import { q, one, tx } from "../db.js";
import { asyncHandler, badRequest, notFound } from "../lib/errors.js";
import { attachUser } from "../middleware/auth.js";
import { naira, reference } from "../lib/format.js";

import {
  paymentProviderStatus,
  checkoutIsSimulated,
  missingPaymentCredentials,
  feeSchedule,
  minimumTopupKobo,
} from "../lib/payments.js";
import { env } from "../config/env.js";
import { uploadFile } from "../lib/storage.js";
import multer from "multer";
import crypto from "node:crypto";
import { queueEmail, flushEmailOutbox } from "../lib/email-outbox.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
router.use(attachUser);

/**
 * Payment configuration for the browser. Exposes only the active provider and
 * its browser-safe public key, so the checkout UI can name the processor
 * without the secret ever leaving the server.
 */
router.get(
  "/payments/config",
  asyncHandler(async (_req, res) => {
    const status = paymentProviderStatus();
    const missing = missingPaymentCredentials();
    res.json({
      provider: status.active,
      simulated: checkoutIsSimulated(status.active),
      // Public keys are safe to expose; secret keys never are.
      publicKeys: {
        paystack: env.PAYSTACK_PUBLIC_KEY || null,
        flutterwave: env.FLW_PUBLIC_KEY || null,
      },
      // Published so the amount a customer is about to be charged can be shown
      // with the fee itemised before payment, rather than surprising them on a
      // statement afterwards.
      fee: feeSchedule(),
      // So the browser validates against the figure the server enforces, rather
      // than carrying its own copy that drifts out of step with this one.
      minimumTopupKobo: minimumTopupKobo(),
      // Names of absent credentials only, so a misconfigured deployment reports
      // itself here rather than as a bare 503 when a customer tries to pay.
      ...(missing.length ? { misconfigured: true, missing } : {}),
    });
  }),
);

// ============ PRICING PLANS ============
router.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    const plans = await q(
      "SELECT * FROM pricing_plans WHERE active = TRUE ORDER BY price_kobo",
    );
    const customerPlans = await q(
      "SELECT code,name,amount_kobo AS price_kobo,interval,features FROM card_plans WHERE active ORDER BY sort_order",
    );
    res.json({
      customerPlans,
      plans: plans.map((p) => ({
        code: p.code,
        name: p.name,
        price_kobo: Number(p.price_kobo),
        priceLabel: naira(p.price_kobo),
        interval: p.interval,
        features: p.features,
        highlighted: p.highlighted,
      })),
    });
  }),
);

function validatedContact(data) {
  for (const key of [
    "contactName",
    "companyName",
    "phone",
    "fleetSize",
    "message",
  ]) {
    const value = data[key];
    if (
      value != null &&
      (typeof value !== "string" ||
        value.length > (key === "message" ? 5000 : 200))
    )
      throw badRequest(`Enter a valid ${key}`);
  }
  if (
    typeof data.email !== "string" ||
    data.email.length > 254 ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)
  )
    throw badRequest("Enter a valid email address");
}
router.post(
  "/plans/select",
  asyncHandler(async (req, res) => {
    const data = req.body ?? {};
    validatedContact(data);
    const { planCode, contactName, companyName, email, phone, fleetSize } =
      data;
    if (typeof planCode !== "string" || planCode.length > 100)
      throw badRequest("Choose a plan");
    const plan = await one(
      "SELECT * FROM pricing_plans WHERE code=$1 AND active",
      [planCode],
    );
    if (!plan) throw notFound("Plan not found");
    await tx(async (t) => {
      const lead = await t.one(
        `INSERT INTO leads(type,contact_name,company_name,email,phone,fleet_size,message)VALUES('onboarding',$1,$2,$3,$4,$5,$6)RETURNING id`,
        [
          contactName ?? null,
          companyName ?? null,
          email,
          phone ?? null,
          fleetSize ?? null,
          `Plan selection: ${plan.name}`,
        ],
      );
      await queueEmail(t, {
        eventKey: `plan-inquiry:${lead.id}`,
        to: email,
        subject: `Obligon ${plan.name} plan — next steps`,
        body: `Your ${plan.name} plan inquiry has been recorded. Our onboarding team will contact you to confirm the requirements.`,
      });
    });
    void flushEmailOutbox().catch(() => {});
    res.json({
      ok: true,
      plan: plan.name,
      message: "Your inquiry has been recorded for our onboarding team.",
    });
  }),
);

// ============ CONTENT (products/modules/partners/stories/FAQ) ============
router.get(
  "/content",
  asyncHandler(async (req, res) => {
    const { kind } = req.query;
    const params = [];
    let where = "active = TRUE";
    if (kind) {
      params.push(kind);
      where += ` AND kind = $1`;
    }
    const items = await q(
      `SELECT * FROM content_items WHERE ${where} ORDER BY sort_order`,
      params,
    );
    res.json({ items });
  }),
);

// ============ CAREERS ============
router.get(
  "/jobs",
  asyncHandler(async (req, res) => {
    const { department, employmentType } = req.query;
    const params = [];
    let where = `status = 'open'`;
    if (department) {
      params.push(`%${department}%`);
      where += ` AND department ILIKE $${params.length}`;
    }
    if (employmentType) {
      params.push(employmentType);
      where += ` AND employment_type = $${params.length}`;
    }
    const jobs = await q(
      `SELECT * FROM job_postings WHERE ${where} ORDER BY created_at DESC`,
      params,
    );
    res.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        department: j.department,
        location: j.location,
        employmentType: j.employment_type,
        description: j.description,
        requirements: j.requirements,
        posted: j.created_at,
      })),
    });
  }),
);

router.post(
  "/jobs/apply",
  upload.single("resume"),
  asyncHandler(async (req, res) => {
    const { jobId, name, email, phone, coverNote } =
      req.valid ?? req.body ?? {};
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 200 ||
      typeof email !== "string" ||
      email.length > 254 ||
      String(phone ?? "").length > 40 ||
      String(coverNote ?? "").length > 5000
    )
      throw badRequest("Enter valid application details");
    if (req.body?.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      throw badRequest("Enter a valid email address");
    if (
      !jobId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        jobId,
      )
    )
      throw badRequest("Choose an open job from the careers page");
    const job = await one(
      "SELECT id FROM job_postings WHERE id=$1 AND status='open'",
      [jobId],
    );
    if (!job) throw notFound("This role is no longer accepting applications");
    let resumePath = null;
    if (req.file) {
      if (
        ![
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ].includes(req.file.mimetype)
      )
        throw badRequest("Resume must be a PDF or Word document");
      resumePath = await uploadFile(
        "resume",
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype,
      );
    }
    await tx(async (t) => {
      const application = await t.one(
        `INSERT INTO job_applications (job_id,name,email,phone,resume_path,cover_note) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [jobId, name, email, phone ?? null, resumePath, coverNote ?? ""],
      );
      await queueEmail(t, {
        eventKey: `application:${application.id}`,
        to: email,
        subject: "We received your Obligon application",
        body: `Hi ${name}, thanks for applying. Our team will review your application and contact you if there is a match.`,
      });
    });
    void flushEmailOutbox().catch(() => {});
    res.json({
      ok: true,
      message: "Application received — we'll be in touch if there's a match.",
    });
  }),
);

// ============ LEADS / NEWSLETTER ============
router.post(
  "/leads",
  asyncHandler(async (req, res) => {
    const {
      type = "sales",
      contactName,
      companyName,
      email,
      phone,
      fleetSize,
      message,
    } = req.valid ?? req.body ?? {};
    validatedContact({
      contactName,
      companyName,
      email,
      phone,
      fleetSize,
      message,
    });
    if (!["sales", "newsletter", "partner", "onboarding"].includes(type))
      throw badRequest("Choose a valid inquiry type");
    await q(
      `INSERT INTO leads (type, contact_name, company_name, email, phone, fleet_size, message) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        type,
        contactName ?? null,
        companyName ?? null,
        email,
        phone ?? null,
        fleetSize ?? null,
        message ?? "",
      ],
    );
    res.json({
      ok: true,
      message:
        type === "newsletter"
          ? "You're subscribed to Obligon updates."
          : "Thanks — our sales team will reach out shortly.",
    });
  }),
);

// ============ PUBLIC SUPPORT / CONTACT ============
router.post(
  "/contact",
  upload.single("attachment"),
  asyncHandler(async (req, res) => {
    const { name, email, subject, message, phone } = req.body ?? {};
    if (!String(name ?? "").trim() || !String(message ?? "").trim())
      throw badRequest("Name and message are required");
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      typeof name !== "string" ||
      typeof message !== "string" ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? "")
    )
      throw badRequest("Enter a valid email address");
    if (
      String(message).length > 5000 ||
      String(name).length > 200 ||
      String(subject ?? "").length > 200 ||
      String(phone ?? "").length > 40
    )
      throw badRequest("Contact details are too long");
    if (
      req.file &&
      ![
        "application/pdf",
        "image/png",
        "image/jpeg",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(req.file.mimetype)
    )
      throw badRequest("Attach a PDF, DOCX, PNG or JPEG file");
    const attachmentPath = req.file
      ? await uploadFile(
          "attachment",
          req.file.originalname,
          req.file.buffer,
          req.file.mimetype,
        )
      : null;
    const ticket = await tx(async (t) => {
      const contact = await t.one(
        `INSERT INTO contact_messages(name,email,subject,message,attachment_path,phone) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          name.trim(),
          email.trim(),
          subject ?? "",
          message.trim(),
          attachmentPath,
          phone ?? null,
        ],
      );
      const saved = await t.one(
        `INSERT INTO support_tickets(reference,user_id,subject,message,contact_message_id,contact_name,contact_email,contact_phone,attachments)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,reference`,
        [
          reference("WEB"),
          req.user?.id ?? null,
          subject || `Website inquiry from ${name}`,
          message.trim(),
          contact.id,
          name.trim(),
          email.trim(),
          phone ?? null,
          JSON.stringify(attachmentPath ? [attachmentPath] : []),
        ],
      );
      await t.query(
        "INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_role,body) VALUES($1,$2,'public',$3)",
        [saved.id, req.user?.id ?? null, message.trim()],
      );
      await queueEmail(t, {
        eventKey: `contact:${saved.id}`,
        to: email.trim(),
        subject: `Obligon support — ${saved.reference}`,
        body: `Your request ${saved.reference} has been received. Our team will respond by email.`,
      });
      return saved;
    });
    void flushEmailOutbox().catch(() => {});
    res
      .status(201)
      .json({
        ok: true,
        reference: ticket.reference,
        message: "Request received. Keep this reference for follow-up.",
      });
  }),
);

// ============ COOKIE CONSENT ============
router.post(
  "/cookie-consent",
  asyncHandler(async (req, res) => {
    const { preferences, dntRespected, visitorId } =
      req.valid ?? req.body ?? {};
    await q(
      `INSERT INTO cookie_consents (user_id, visitor_id, preferences, dnt_respected, ip) VALUES ($1,$2,$3,$4,$5)`,
      [
        req.user?.id ?? null,
        visitorId ?? crypto.randomUUID(),
        JSON.stringify(preferences ?? {}),
        Boolean(dntRespected),
        req.ip,
      ],
    );
    res.json({ ok: true });
  }),
);

// ============ LEGAL DATA REQUESTS ============
router.post(
  "/data-requests",
  asyncHandler(async (req, res) => {
    const {
      email,
      requestType = "export",
      notes,
    } = req.valid ?? req.body ?? {};
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    )
      throw badRequest("Enter a valid email address");
    if (
      !["export", "deletion", "correction"].includes(requestType) ||
      typeof (notes ?? "") !== "string" ||
      String(notes ?? "").length > 5000
    )
      throw badRequest("Enter a valid data request");
    await q(
      `INSERT INTO data_requests (email, request_type, notes) VALUES ($1,$2,$3)`,
      [email, requestType, notes ?? ""],
    );
    res.json({
      ok: true,
      message:
        "Your data request has been logged. Our privacy team will verify your identity and confirm the next steps.",
    });
  }),
);

// ============ ANALYTICS EVENTS ============
router.post(
  "/events",
  asyncHandler(async (req, res) => {
    const { name, props } = req.valid ?? req.body ?? {};
    if (!name) return res.json({ ok: true });
    await q(
      `INSERT INTO analytics_events (user_id, name, props) VALUES ($1,$2,$3)`,
      [
        req.user?.id ?? null,
        String(name).slice(0, 100),
        JSON.stringify(props ?? {}),
      ],
    );
    res.json({ ok: true });
  }),
);

export default router;
