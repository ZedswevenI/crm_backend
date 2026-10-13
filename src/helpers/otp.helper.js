import crypto from 'crypto';
import Otp from '../models/otp.model.js';
import { sendEmail } from '../services/mail.service.js';
import logger from './logger.js';

const OTP_EXPIRY_MINUTES = 5;

const hashOtp = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

export const generateAndSaveOtp = async (userId, tenantId, type) => {
  const raw = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = hashOtp(raw);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  await Otp.deleteMany({ userId, type });
  await Otp.create({ userId, tenantId, otpHash, type, expiresAt, isUsed: false });
  return raw;
};

export const sendOtpEmail = async (email, name, otp, purpose = 'Verification') => {
  const subject = `Your ${purpose} OTP`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
      <h2 style="margin-top:0;color:#111827">${subject}</h2>
      <p style="color:#374151">Hi ${name || 'User'},</p>
      <p style="color:#374151">Use the OTP below to complete your <strong>${purpose}</strong>. It is valid for <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:10px;text-align:center;padding:20px;background:#F3F4F6;border-radius:6px;color:#111827;margin:20px 0">
        ${otp}
      </div>
      <p style="color:#6B7280;font-size:13px">Do not share this OTP with anyone. If you did not request this, please ignore this email.</p>
    </div>
  `;
  await sendEmail({ to: email, subject, html });
  logger.info(`OTP email sent to ${email} for ${purpose}`);
};

export const verifyOtp = async (userId, type, rawOtp) => {
  const record = await Otp.findOne({ userId, type, isUsed: false });
  if (!record) return { valid: false, message: 'OTP not found or already used' };
  if (record.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: record._id });
    return { valid: false, message: 'OTP has expired. Please request a new one.' };
  }
  const incoming = hashOtp(rawOtp);
  if (incoming !== record.otpHash) return { valid: false, message: 'Invalid OTP' };
  await Otp.updateOne({ _id: record._id }, { $set: { isUsed: true } });
  return { valid: true };
};
