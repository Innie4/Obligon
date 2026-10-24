import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest } from '../lib/errors.js';
import { requireCustomerPlan } from '../lib/subscriptions.js';
import { customerPurchaseAnalytics, customerSpendingAlertSettings, updateCustomerSpendingAlerts } from '../lib/customer-benefits.js';

const alertUpdate = z.object({ enabled: z.boolean().optional(), thresholds: z.array(z.number().int().min(1).max(100)).min(1).max(5).optional() }).strict().refine(value => Object.keys(value).length > 0);
const analyticsQuery = z.object({ range: z.enum(['7', '30', '90', '365']).optional() }).strict();

/** Mounted behind the existing customer authentication and paid-access middleware. */
export default function customerBenefitsRouter() {
  const router = Router();
  router.get('/analytics', asyncHandler(async (req, res) => {
    await requireCustomerPlan(req.user.id, 'Fuel Consumption Analytics');
    const parsed = analyticsQuery.safeParse(req.query);
    if (!parsed.success) throw badRequest('Choose a 7, 30, 90, or 365 day purchase history.');
    res.json({ analytics: await customerPurchaseAnalytics(req.user.id, parsed.data.range) });
  }));
  router.get('/spending-alerts', asyncHandler(async (req, res) => {
    await requireCustomerPlan(req.user.id, 'Intelligence Notifications');
    res.json({ spendingAlerts: await customerSpendingAlertSettings(req.user.id) });
  }));
  router.patch('/spending-alerts', asyncHandler(async (req, res) => {
    await requireCustomerPlan(req.user.id, 'Intelligence Notifications');
    const parsed = alertUpdate.safeParse(req.body);
    if (!parsed.success) throw badRequest('Choose valid spending-alert preferences and one to five thresholds between 1% and 100%.');
    res.json({ spendingAlerts: await updateCustomerSpendingAlerts(req.user.id, parsed.data) });
  }));
  return router;
}
