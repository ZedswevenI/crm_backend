import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';

const region = process.env.AWS_REGION || 'ap-south-1';

const sesClient = new SESClient({ region });

const wrapBase64 = (buf) => (buf.toString('base64').match(/.{1,76}/g) || []).join('\r\n');

const buildRawMimeMessage = ({ from, to, subject, html, text, attachments }) => {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject || '', 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(Buffer.from(html || text || '', 'utf8')),
    ''
  ];

  for (const att of attachments) {
    const buf = Buffer.isBuffer(att.data) ? att.data : Buffer.from(att.data, 'base64');
    const ctype = att.contentType || 'application/pdf';
    const fname = att.filename || 'attachment.pdf';
    lines.push(
      `--${boundary}`,
      `Content-Type: ${ctype}; name="${fname}"`,
      `Content-Disposition: attachment; filename="${fname}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(buf),
      ''
    );
  }
  lines.push(`--${boundary}--`);
  return Buffer.from(lines.join('\r\n'), 'utf8');
};

export const sendSesEmail = async ({ to, subject, html, text, attachments = [] }) => {
  if (!process.env.AWS_SES_FROM_EMAIL) throw new Error('AWS_SES_FROM_EMAIL missing');
  const from = String(process.env.AWS_SES_FROM_EMAIL).trim();

  if (Array.isArray(attachments) && attachments.length) {
    const rawData = buildRawMimeMessage({ from, to, subject, html, text, attachments });
    const command = new SendRawEmailCommand({
      Source: from,
      Destinations: [to],
      RawMessage: { Data: rawData }
    });
    const resp = await sesClient.send(command);
    return { id: resp.MessageId };
  }

  const body = { Html: { Data: html || '', Charset: 'UTF-8' } };
  if (text) body.Text = { Data: text, Charset: 'UTF-8' };

  const command = new SendEmailCommand({
    Source: from,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: body
    }
  });

  const resp = await sesClient.send(command);
  return { id: resp.MessageId };
};
