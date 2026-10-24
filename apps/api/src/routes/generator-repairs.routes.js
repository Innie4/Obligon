import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler, badRequest, forbidden, tooMany } from '../lib/errors.js';
import { requireCustomerPlan } from '../lib/subscriptions.js';
import { createRepair, listRepairs, getRepair, quoteRepair, fundRepair, acceptRepair, startRepair, completeRepair, cancelRepair, repairPartners, repairId } from '../lib/generator-repairs.js';

const key = z.string().uuid();
const version = z.number().int().positive();
const create = z.object({description: z.string().trim().min(10).max(4000), idempotencyKey: key}).strict();
const quote = z.object({labourKobo: z.number().int().min(0).max(100_000_000_000), partsKobo: z.number().int().min(0).max(100_000_000_000), scope: z.string().trim().min(10).max(4000), partnerOrgId: key, idempotencyKey: key}).strict();
const accept = z.object({quoteVersion: version, idempotencyKey: key}).strict();
const currentVersion = z.object({quoteVersion: version}).strict();
const completion = z.object({quoteVersion: version, completionNote: z.string().trim().min(10).max(4000)}).strict();
const cancellation = z.object({reason: z.string().trim().min(5).max(1000)}).strict();
function body(schema, input) {
 const result = schema.safeParse(input);
 if (!result.success) throw badRequest('Check the repair details and current quote version, then try again.');
 return result.data;
}
function baseRouter(role) {
 const router = Router();
 router.use((req, _res, next) => req.user?.role === role ? next() : next(forbidden('This account cannot access that repair workflow.')));
 router.param('id', (req, _res, next, value) => { try { repairId(value); next(); } catch (error) { next(error); } });
 const limiter = rateLimit({windowMs: 60_000, limit: 120, keyGenerator: req => req.user.id, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (_req, _res, next) => next(tooMany('Too many repair updates. Try again in a minute.'))});
 router.use((req, res, next) => req.method === 'GET' ? next() : limiter(req, res, next));
 return router;
}
/** Existing parent authentication remains required; the customer router also enforces paid access. */
export function generatorRepairCustomerRouter() {
 const router = baseRouter('customer');
 router.use(asyncHandler(async (req, _res, next) => { await requireCustomerPlan(req.user.id); next(); }));
 router.get('/', asyncHandler(async (req, res) => res.json({repairs: await listRepairs(req.user)})));
 router.post('/', asyncHandler(async (req, res) => res.status(201).json({repair: await createRepair(req.user, body(create, req.body))})));
 router.get('/:id', asyncHandler(async (req, res) => res.json({repair: await getRepair(req.user, req.params.id)})));
 router.post('/:id/accept', asyncHandler(async (req, res) => res.json({repair: await acceptRepair(req.user, req.params.id, body(accept, req.body))})));
 router.post('/:id/cancel', asyncHandler(async (req, res) => res.json({repair: await cancelRepair(req.user, req.params.id, body(cancellation, req.body))})));
 return router;
}
export function generatorRepairAdminRouter() {
 const router = baseRouter('admin');
 router.get('/', asyncHandler(async (req, res) => res.json({repairs: await listRepairs(req.user), partners: await repairPartners()})));
 router.get('/:id', asyncHandler(async (req, res) => res.json({repair: await getRepair(req.user, req.params.id)})));
 router.post('/:id/quote', asyncHandler(async (req, res) => res.json({repair: await quoteRepair(req.user, req.params.id, body(quote, req.body))})));
 router.post('/:id/fund', asyncHandler(async (req, res) => res.json({repair: await fundRepair(req.user, req.params.id, body(currentVersion, req.body).quoteVersion)})));
 router.post('/:id/start', asyncHandler(async (req, res) => res.json({repair: await startRepair(req.user, req.params.id, body(currentVersion, req.body).quoteVersion)})));
 router.post('/:id/complete', asyncHandler(async (req, res) => res.json({repair: await completeRepair(req.user, req.params.id, body(completion, req.body))})));
 router.post('/:id/cancel', asyncHandler(async (req, res) => res.json({repair: await cancelRepair(req.user, req.params.id, body(cancellation, req.body))})));
 return router;
}
