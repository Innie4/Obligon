import { q, tx } from "../db.js";
import { sendEmail } from "./mailer.js";

export async function queueEmail(t, { eventKey, to, subject, body }) {
  return t.one(
    `INSERT INTO email_outbox(event_key,to_email,subject,body) VALUES($1,$2,$3,$4)
    ON CONFLICT(event_key) DO UPDATE SET event_key=EXCLUDED.event_key RETURNING id`,
    [eventKey, to, subject, body],
  );
}

export async function flushEmailOutbox() {
  const messages = await tx(async (t) =>
    t.query(`UPDATE email_outbox SET status='sending',attempts=attempts+1,next_attempt_at=now()+interval '10 minutes'
    WHERE id IN(SELECT id FROM email_outbox WHERE status IN('pending','failed','sending') AND next_attempt_at<=now()
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20) RETURNING *`),
  );
  for (const message of messages) {
    // Resend deduplicates the same idempotency key for 24 hours. Older ambiguous sends require human review.
    if (
      message.attempts > 1 &&
      Date.now() - new Date(message.created_at).getTime() > 23 * 3600000
    ) {
      await q(
        "UPDATE email_outbox SET status='review',last_error='Delivery requires provider reconciliation before retry' WHERE id=$1",
        [message.id],
      );
      continue;
    }
    try {
      const result = await sendEmail({
        to: message.to_email,
        subject: message.subject,
        text: message.body,
        idempotencyKey: `outbox/${message.id}`,
      });
      await q(
        `UPDATE email_outbox SET status=$2,last_error=$3,accepted_at=CASE WHEN $2='accepted' THEN now() ELSE NULL END,next_attempt_at=now()+interval '5 minutes' WHERE id=$1`,
        [
          message.id,
          result.delivered ? "accepted" : "failed",
          result.delivered
            ? null
            : "Email delivery is unavailable; check provider configuration",
        ],
      );
    } catch {
      await q(
        "UPDATE email_outbox SET status='failed',last_error='Provider response was unavailable; retry uses the same delivery key',next_attempt_at=now()+interval '5 minutes' WHERE id=$1",
        [message.id],
      );
    }
  }
  return { processed: messages.length };
}
