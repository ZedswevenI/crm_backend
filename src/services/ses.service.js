import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const region = process.env.AWS_REGION || 'ap-south-1';

const sesClient = new SESClient({ region });

export const sendSesEmail = async ({ to, subject, html, text }) => {
  if (!process.env.AWS_SES_FROM_EMAIL) throw new Error('AWS_SES_FROM_EMAIL missing');

  const body = { Html: { Data: html || '', Charset: 'UTF-8' } };
  if (text) body.Text = { Data: text, Charset: 'UTF-8' };

  const command = new SendEmailCommand({
    Source: String(process.env.AWS_SES_FROM_EMAIL).trim(),
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: body
    }
  });

  const resp = await sesClient.send(command);
  return { id: resp.MessageId };
};
