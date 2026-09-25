import { sendMailgunEmail } from './mailgun.service.js';
import { sendSesEmail } from './ses.service.js';

// Single switch to move all outbound email between providers without touching call sites.
// Flip EMAIL_PROVIDER back to MAILGUN for an instant rollback if SES has delivery issues.
export const getActiveEmailProvider = () => (String(process.env.EMAIL_PROVIDER || 'MAILGUN').trim().toUpperCase() === 'SES' ? 'SES' : 'MAILGUN');

export const sendEmail = async ({ to, subject, html, text }) => {
  const provider = getActiveEmailProvider();
  const resp = provider === 'SES' ? await sendSesEmail({ to, subject, html, text }) : await sendMailgunEmail({ to, subject, html, text });
  return { provider, ...resp };
};
