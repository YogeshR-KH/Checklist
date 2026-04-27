import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM_EMAIL ?? 'CheckFlow <noreply@example.com>';

export async function sendEmail(opts: { to: string | string[]; subject: string; html: string }) {
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping send', opts.subject);
    return { skipped: true };
  }
  const resend = new Resend(apiKey);
  return resend.emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html });
}
