import formData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(formData);

const getClient = () => {
  if (!process.env.MAILGUN_API_KEY) throw new Error('MAILGUN_API_KEY missing');
  return mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY
  });
};

export const sendMailgunEmail = async ({ to, subject, html, text }) => {
  if (!process.env.MAILGUN_DOMAIN) throw new Error('MAILGUN_DOMAIN missing');
  if (!process.env.MAILGUN_FROM_EMAIL) throw new Error('MAILGUN_FROM_EMAIL missing');

  const mg = getClient();

  const resp = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
    from: process.env.MAILGUN_FROM_EMAIL,
    to,
    subject,
    html,
    text: text || '',
    'o:tracking': true,
    'o:tracking-clicks': true,
    'o:tracking-opens': true
  });

  return resp;
};
