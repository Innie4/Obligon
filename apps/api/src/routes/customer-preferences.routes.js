import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { one } from '../db.js';
import { asyncHandler, badRequest, notFound, tooMany } from '../lib/errors.js';

const patchSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  stationLocation: z.object({
    prompted: z.literal(true).optional(),
    enabled: z.boolean().optional()
  }).strict().refine(value => Object.keys(value).length > 0).optional()
}).strict().refine(value => Object.keys(value).length > 0);

const preferenceColumns = 'ui_theme,station_location_prompted,station_location_enabled';
const preferences = row => ({
  theme: row.ui_theme,
  stationLocation: { prompted: row.station_location_prompted, enabled: row.station_location_enabled }
});
const locationPromptLimiter = rateLimit({
  windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (_req, _res, next) => next(tooMany('Too many location requests. Try again in a minute.'))
});

export default function customerPreferencesRouter() {
  const router = Router();
  router.get('/', asyncHandler(async (req, res) => {
    const row = await one(`SELECT ${preferenceColumns} FROM users WHERE id=$1`, [req.user.id]);
    if (!row) throw notFound('Account not found');
    res.json(preferences(row));
  }));
  router.patch('/', asyncHandler(async (req, res) => {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Choose a light or dark theme, or valid station location preferences. The location prompt cannot be reset.');
    const { theme, stationLocation } = parsed.data;
    const row = await one(`UPDATE users SET ui_theme=COALESCE($2,ui_theme),
      station_location_prompted=station_location_prompted OR $3,
      station_location_enabled=COALESCE($4,station_location_enabled),updated_at=now()
      WHERE id=$1 RETURNING ${preferenceColumns}`,
    [req.user.id, theme ?? null, Boolean(stationLocation), stationLocation?.enabled ?? null]);
    if (!row) throw notFound('Account not found');
    res.json(preferences(row));
  }));
  router.post('/location-prompt', locationPromptLimiter, asyncHandler(async (req, res) => {
    if (req.body !== undefined && !z.object({}).strict().safeParse(req.body).success) throw badRequest('The location prompt does not accept any fields.');
    const claimed = await one(`UPDATE users SET station_location_prompted=true,updated_at=now()
      WHERE id=$1 AND station_location_prompted=false RETURNING ${preferenceColumns}`, [req.user.id]);
    const row = claimed ?? await one(`SELECT ${preferenceColumns} FROM users WHERE id=$1`, [req.user.id]);
    if (!row) throw notFound('Account not found');
    res.json({ showPrompt: Boolean(claimed), preferences: preferences(row) });
  }));
  return router;
}
