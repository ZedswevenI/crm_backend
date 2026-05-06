import formData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(formData);

const getClient = () => {
  if (!process.env.MAILGUN_API_KEY) throw new Error('MAILGUN_API_KEY missing');

  return mailgun.client({
    username: 'api',
    key: String(process.env.MAILGUN_API_KEY || '').trim(),
    url: String(process.env.MAILGUN_API_URL || 'https://api.mailgun.net').trim()
  });
};

export const sendMailgunEmail = async ({ to, subject, html, text }) => {
  if (!process.env.MAILGUN_DOMAIN) throw new Error('MAILGUN_DOMAIN missing');
  if (!process.env.MAILGUN_FROM_EMAIL) throw new Error('MAILGUN_FROM_EMAIL missing');

  const mg = getClient();

  return await mg.messages.create(String(process.env.MAILGUN_DOMAIN).trim(), {
    from: String(process.env.MAILGUN_FROM_EMAIL).trim(),
    to,
    subject,
    html,
    text: text || '',
    'o:tracking': true,
    'o:tracking-clicks': true,
    'o:tracking-opens': true
  });
};
