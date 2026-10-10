import { Router } from "express";
import { q, one, tx } from "../db.js";
import {
  asyncHandler,
  badRequest,
  notFound,
  forbidden,
} from "../lib/errors.js";
import { audit, notify } from "../lib/notify.js";
import { signedUrl } from "../lib/storage.js";
import { queueEmail, flushEmailOutbox } from "../lib/email-outbox.js";
const router = Router();
const id = (value) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(value),
    )
  )
    throw badRequest("Invalid record ID");
  return value;
};
const catalogs = {
  applications: {
    table: "job_applications",
    statuses: ["submitted", "in_review", "shortlisted", "rejected", "hired"],
  },
  leads: {
    table: "leads",
    statuses: ["new", "contacted", "qualified", "closed"],
  },
  privacy: {
    table: "data_requests",
    statuses: ["received", "processing", "completed", "rejected"],
  },
};
router.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const page = Math.max(0, Math.min(100000, Number(req.query.page) || 0));
    const search = String(req.query.search ?? "").slice(0, 100);
    const filter = `($1='' OR action ILIKE '%'||$1||'%' OR entity_id ILIKE '%'||$1||'%')`;
    const [records, total] = await Promise.all([
      q(
        `SELECT id,actor_role,action,entity_type,entity_id,metadata,created_at FROM audit_logs WHERE ${filter} ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $2`,
        [search, Math.floor(page) * 50],
      ),
      one(`SELECT count(*)::int total FROM audit_logs WHERE ${filter}`, [
        search,
      ]),
    ]);
    res.json({ records, total: total.total });
  }),
);
router.get(
  "/intake/:kind",
  asyncHandler(async (req, res) => {
    const spec = catalogs[req.params.kind];
    if (!spec) throw notFound("Queue not found");
    const page = Math.max(0, Math.min(100000, Number(req.query.page) || 0));
    const records = await q(
      `SELECT * FROM ${spec.table} ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $1`,
      [Math.floor(page) * 50],
    );
    const total = await one(`SELECT count(*)::int total FROM ${spec.table}`);
    res.json({ records, statuses: spec.statuses, total: total.total });
  }),
);
router.patch(
  "/intake/:kind/:id",
  asyncHandler(async (req, res) => {
    const spec = catalogs[req.params.kind];
    if (!spec) throw notFound("Queue not found");
    const status = req.body?.status,
      note = String(req.body?.note ?? "").trim();
    if (!spec.statuses.includes(status) || !note || note.length > 2000)
      throw badRequest("A valid status and review note are required");
    if (
      req.params.kind === "privacy" &&
      status === "completed" &&
      req.body?.identityVerified !== true
    )
      throw badRequest(
        "Verify the requester’s identity before completing a privacy request",
      );
    const record = await tx(async (t) => {
      const row = await t.one(
        `UPDATE ${spec.table} SET status=$2 WHERE id=$1 RETURNING *`,
        [id(req.params.id), status],
      );
      if (!row) throw notFound("Record not found");
      const decision = await t.one(
        "INSERT INTO audit_logs(actor_user_id,actor_role,action,entity_type,entity_id,metadata)VALUES($1,'admin',$2,$3,$4,$5) RETURNING id",
        [
          req.user.id,
          `${req.params.kind}.reviewed`,
          spec.table,
          row.id,
          JSON.stringify({
            status,
            note,
            identityVerified: req.body?.identityVerified === true,
          }),
        ],
      );
      if (req.params.kind !== "leads" && row.email)
        await queueEmail(t, {
          eventKey: `intake:${decision.id}`,
          to: row.email,
          subject: "Obligon — request update",
          body: `Your request is ${status.replaceAll("_", " ")}. ${note}`,
        });
      return row;
    });
    void flushEmailOutbox().catch(() => {});
    res.json({ ok: true, id: record.id });
  }),
);
router.get(
  "/job-applications/:id/resume",
  asyncHandler(async (req, res) => {
    const row = await one(
      "SELECT resume_path FROM job_applications WHERE id=$1",
      [id(req.params.id)],
    );
    if (!row?.resume_path) throw notFound("No resume attached");
    await audit({
      actorUserId: req.user.id,
      actorRole: "admin",
      action: "application.resume_viewed",
      entityId: req.params.id,
    });
    res.json({ url: await signedUrl(row.resume_path) });
  }),
);
router.get(
  "/jobs",
  asyncHandler(async (_req, res) =>
    res.json({
      jobs: await q("SELECT * FROM job_postings ORDER BY created_at DESC"),
    }),
  ),
);
router.post(
  "/jobs",
  asyncHandler(async (req, res) => {
    const { title, department, location, description, employmentType } =
      req.body ?? {};
    if (
      [title, department, location, description].some(
        (v) => typeof v !== "string" || !v.trim(),
      ) ||
      String(description).length > 10000 ||
      String(title).length > 200
    )
      throw badRequest(
        "Title, department, location and description are required",
      );
    const job = await one(
      "INSERT INTO job_postings(title,department,location,description,employment_type)VALUES($1,$2,$3,$4,$5)RETURNING id",
      [
        title.trim(),
        department.trim(),
        location.trim(),
        description.trim(),
        String(employmentType ?? "Full-time").slice(0, 80),
      ],
    );
    await audit({
      actorUserId: req.user.id,
      actorRole: "admin",
      action: "job.published",
      entityId: job.id,
    });
    res.status(201).json({ ok: true, id: job.id });
  }),
);
router.patch(
  "/jobs/:id",
  asyncHandler(async (req, res) => {
    if (!["open", "closed"].includes(req.body?.status))
      throw badRequest("Choose open or closed");
    const row = await one(
      "UPDATE job_postings SET status=$2 WHERE id=$1 RETURNING id",
      [id(req.params.id), req.body.status],
    );
    if (!row) throw notFound("Job not found");
    await audit({
      actorUserId: req.user.id,
      actorRole: "admin",
      action: "job.status_changed",
      entityId: row.id,
      metadata: { status: req.body.status },
    });
    res.json({ ok: true });
  }),
);
router.get(
  "/stations/review",
  asyncHandler(async (_req, res) =>
    res.json({
      stations:
        await q(`SELECT s.id,s.name,s.address,s.city,s.lat,s.lng,s.location_confirmed,s.fuels,s.status,s.review_note,o.name AS organization,o.verification_status
 FROM stations s JOIN organizations o ON o.id=s.partner_org_id ORDER BY s.created_at DESC`),
    }),
  ),
);
router.post(
  "/stations/:id/review",
  asyncHandler(async (req, res) => {
    const status = req.body?.status,
      note = String(req.body?.note ?? "").trim();
    if (
      !["active", "suspended"].includes(status) ||
      !note ||
      note.length > 2000
    )
      throw badRequest("Choose a review decision and provide a note");
    const station = await tx(async (t) => {
      const row = await t.one(
        "SELECT s.*,o.verification_status FROM stations s JOIN organizations o ON o.id=s.partner_org_id WHERE s.id=$1 FOR UPDATE OF s",
        [id(req.params.id)],
      );
      if (!row) throw notFound("Station not found");
      if (
        status === "active" &&
        (row.verification_status !== "verified" ||
          !row.location_confirmed ||
          row.lat === null ||
          row.lng === null)
      )
        throw forbidden(
          "Verify the partner and confirm station coordinates before publishing",
        );
      return t.one(
        "UPDATE stations SET status=$2,review_note=$3,reviewed_by=$4,reviewed_at=now() WHERE id=$1 RETURNING *",
        [row.id, status, note, req.user.id],
      );
    });
    await audit({
      actorUserId: req.user.id,
      actorRole: "admin",
      action: "station.reviewed",
      entityId: station.id,
      metadata: { status, note },
    });
    await notify({
      orgId: station.partner_org_id,
      title: "Station review completed",
      body: `${station.name}: ${status}. ${note}`,
      category: "general",
      link: "/dashboard/station-profile",
    });
    res.json({ ok: true });
  }),
);
router.get(
  "/financial-activity",
  asyncHandler(async (req, res) => {
    const page = Math.max(
      0,
      Math.min(100000, Math.floor(Number(req.query.page) || 0)),
    );
    const ledger = `SELECT id,reference,'fuel_purchase' AS kind,amount_kobo,status,created_at FROM transactions
 UNION ALL SELECT id,payment_reference,'first_card_subscription',charged_kobo,payment_status,created_at FROM card_requests WHERE payment_reference IS NOT NULL
 UNION ALL SELECT id,reference,'station_checkout',amount_kobo,status,created_at FROM fuel_orders
 UNION ALL SELECT id,reference,'wallet_topup',amount_kobo,status,created_at FROM top_ups
 UNION ALL SELECT id,reference,'subscription',amount_kobo,payment_status,created_at FROM subscription_payments
 UNION ALL SELECT id,provider_ref,'refund',amount_kobo,status,created_at FROM payment_refunds
 UNION ALL SELECT id,reference,'automatic_transfer',amount_kobo,status,created_at FROM payouts`;
    const [records, total] = await Promise.all([
      q(
        `SELECT * FROM (${ledger}) records ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $1`,
        [page * 50],
      ),
      one(`SELECT count(*)::int total FROM (${ledger}) records`),
    ]);
    res.json({ records, total: total.total });
  }),
);
router.get(
  "/email-delivery",
  asyncHandler(async (_req, res) =>
    res.json({
      messages: await q(
        "SELECT id,to_email,subject,status,attempts,last_error,created_at,accepted_at FROM email_outbox ORDER BY created_at DESC LIMIT 200",
      ),
    }),
  ),
);
router.post(
  "/email-delivery/retry",
  asyncHandler(async (req, res) => {
    await audit({
      actorUserId: req.user.id,
      actorRole: "admin",
      action: "email_delivery.retry_requested",
    });
    res.json(await flushEmailOutbox());
  }),
);
export default router;
