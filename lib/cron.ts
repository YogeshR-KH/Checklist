import { NextRequest } from 'next/server';

/**
 * Auth check for cron / privileged routes.
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * The same secret can be used for manual on-demand triggers.
 */
export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}
